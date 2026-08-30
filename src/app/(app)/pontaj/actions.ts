// src/app/(app)/pontaj/actions.ts
"use server";

import { randomUUID } from "node:crypto";

import { createAction } from "@/lib/actions/create-action";
import { businessRule, notFound } from "@/lib/actions/errors";
import {
  configZiDin,
  intervalulPropus,
  oreleZilei,
  type ConfigZi,
} from "@/domain/attendance/calcul-ore";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatMonthYear, oraInBucharest, todayInBucharest } from "@/lib/format/date";
import type { ActionContext } from "@/lib/actions/types";
import { stareaCeasului } from "@/domain/attendance/ceas";
import { setariPontaj } from "@/lib/queries/attendance";
import { zileNelucratoare } from "@/lib/queries/leave";
import {
  aprobaPontajBlocSchema,
  confirmaZiuaStandardSchema,
  decideZiPontajSchema,
  deschidePerioadaSchema,
  idPerioadaSchema,
  MOD_PONTARE_IMPLICIT,
  pontezaIesireaSchema,
  pontezaIntrareaSchema,
  salveazaZiPontajSchema,
  sincronizeazaConcediileSchema,
  type ModPontareRapida,
  stergeZiPontajSchema,
} from "@/schemas/attendance";

import { tipZiAutomat } from "./etichete";
import { traduEroare } from "./erori";
import { sincronizeazaZileleDeConcediu, type TipZiPontaj } from "./sincronizare-concediu";

const CAI_REVALIDARE = [
  "/pontaj",
  "/pontaj/perioade",
  "/pontaj/aprobare",
  // Aceleași date, celălalt înveliș: fără căile astea, angajatul
  // salvează o zi și se întoarce pe „Pontajul meu” fără s-o vadă.
  "/portal",
  "/portal/pontajul-meu",
] as const;

/**
 * Cât întoarce PostgREST pe o cerere: `max_rows = 1000`, tăiat TĂCUT.
 * Constantele NU se exportă: un fișier `"use server"` care exportă altceva
 * decât funcții asincrone e refuzat la build (`tsc` tace).
 */
const PAGINA_APROBARE = 1000;
/** 20 × 1000 = 20 000 de linii neaprobate într-o lună. Peste, se cere departament. */
const MAXIM_PAGINI_APROBARE = 20;

/** Prima și ultima zi calendaristică a unei luni, ca șiruri ISO. */
function intervalulLunii(
  an: number,
  luna: number,
): { readonly inceput: string; readonly sfarsit: string } {
  const ultimaZi = new Date(Date.UTC(an, luna, 0)).getUTCDate();
  const doiCifre = (n: number) => String(n).padStart(2, "0");
  return {
    inceput: `${String(an)}-${doiCifre(luna)}-01`,
    sfarsit: `${String(an)}-${doiCifre(luna)}-${doiCifre(ultimaZi)}`,
  };
}

/**
 * Fișa de angajat a utilizatorului curent, prin clientul ADMIN.
 *
 * Ocolirea RLS e obligatorie aici, nu comodă: rolul `employee` are
 * `employees:read` la scope `own`, dar politica `employees_select`
 * (0005_hr_rls.sql) nu-i deschide drumul ăsta, deci clientul autentificat nu-și
 * poate citi nici măcar propria fișă. Filtrul pe `organization_id` e explicit,
 * ca ESLint-ul să-l poată vedea și ca nimeni să nu-l scoată din greșeală.
 *
 * `is_primary = true` e cerința lui `app.current_employee_id(org)`: un cont a
 * cărui unică fișă nu e principală primește refuz de la bază oricum, deci mai
 * bine îl primește aici, cu un mesaj care spune ce e de făcut.
 */
async function fisaProprie(ctx: ActionContext): Promise<string> {
  const admin = createAdminSupabase();
  const { data: fisa, error } = await admin
    .from("employees")
    .select("id")
    .eq("organization_id", ctx.tenant.organizationId)
    .eq("user_id", ctx.user.id)
    .eq("is_primary", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (error !== null) throw error;
  if (fisa === null) {
    throw businessRule(
      "Contul dvs. nu este legat de o fișă de angajat activă în această organizație. Contactați administratorul.",
    );
  }
  return fisa.id;
}

/**
 * Tipul zilei, derivat din calendar — COPIE a `internal.pontaj_intrare_pregateste`.
 *
 * Necesară fiindcă tipul generat marchează `tip_zi` obligatoriu și nenul, deși
 * triggerul l-ar deriva singur dintr-un `null`. Vezi `etichete.ts`.
 */
async function tipZiDerivat(ctx: ActionContext, data: string): Promise<TipZiPontaj> {
  const an = Number(data.slice(0, 4));
  const { nationale, organizatie } = await zileNelucratoare(ctx.tenant.organizationId, an, an);
  return tipZiAutomat(
    data,
    new Set(nationale.map((z) => z.data)),
    new Set(organizatie.filter((z) => z.tip === "zi_recuperare").map((z) => z.data)),
    new Set(organizatie.filter((z) => z.tip === "liber_suplimentar").map((z) => z.data)),
  );
}

export const deschidePerioada = createAction({
  name: "attendance.period.open",
  feature: "attendance",
  permission: "attendance:create",
  minScope: "all",
  input: deschidePerioadaSchema,
  audit: {
    action: "create",
    entityType: "attendance_period",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    // `observatii` NU intră în audit — text liber, potențial cu date personale
    // ale angajaților (motiv de absență, context medical). Doar id-uri, date,
    // ore, statusuri.
    allow: ["an", "luna"],
  },
  revalidate: [...CAI_REVALIDARE],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { inceput, sfarsit } = intervalulLunii(input.an, input.luna);

    // `data_inceput`/`data_sfarsit`: coloane NOT NULL FĂRĂ DEFAULT, calculate
    // de `internal.pontaj_perioada_tranzitie` — care le SUPRASCRIE
    // necondiționat la INSERT, indiferent de ce trimite clientul (verificat în
    // migrare: ramura `if tg_op = 'INSERT'` le atribuie direct, fără să
    // verifice ce a primit `new`). Tipul generat le marchează totuși
    // obligatorii, tocmai fiindcă DDL-ul nu are DEFAULT; le calculăm identic cu
    // triggerul doar ca să satisfacem tipul — NU pentru că am avea nevoie de
    // ele. `status`/`blocata_la`/`blocata_de` NU se trimit: politica INSERT
    // cere `status = 'deschisa', blocata_la is null, blocata_de is null`,
    // exact valorile implicite ale coloanelor.
    const { data, error } = await db
      .from("attendance_periods")
      .insert({
        organization_id: ctx.tenant.organizationId,
        an: input.an,
        luna: input.luna,
        data_inceput: inceput,
        data_sfarsit: sfarsit,
        observatii: input.observatii,
      })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);

    return { id: data.id };
  },
});

export const salveazaZiPontaj = createAction({
  name: "attendance.entry.save",
  feature: "attendance",
  permission: "attendance:create",
  minScope: "own",
  input: salveazaZiPontajSchema,
  audit: {
    action: "update",
    entityType: "attendance_entry",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: [
      "employee_id",
      "data",
      "ora_inceput",
      "ora_sfarsit",
      "ore_lucrate",
      "ore_suplimentare",
      "ore_noapte",
      "tip_zi",
    ],
  },
  revalidate: [...CAI_REVALIDARE],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    // Rolul `employee` are `attendance:create = own`: nu poate scrie decât
    // pentru sine, chiar dacă a trimis explicit un `employee_id` străin.
    if (ctx.scope !== "all" && input.employee_id !== null) {
      throw businessRule("Nu aveți dreptul să înregistrați pontaj pentru alt angajat.");
    }

    const employeeId = input.employee_id ?? (await fisaProprie(ctx));

    // Tipul zilei: alegerea explicită a utilizatorului, sau derivarea automată.
    const tipZi = input.tip_zi ?? (await tipZiDerivat(ctx, input.data));

    // ── Orele, rescrise pe server când ziua vine dintr-un interval ──────────
    //
    // Cine are `attendance:create = all` — responsabilul de pontaj, în foaia
    // colectivă — își păstrează dreptul de a suprascrie cifrele: acolo calculul
    // e o SUGESTIE, tocmai pentru pauzele neobișnuite și turele peste miezul
    // nopții pe care modelul cu un rând pe zi nu le exprimă.
    //
    // Cine scrie în scope `own` — angajatul, din portal — NU. Formularul lui
    // arată orele ca text needitabil, iar dacă serverul ar crede pur și simplu
    // ce primește, „needitabil" ar fi o decorație de ecran: o cerere fabricată
    // ar scrie orice număr de ore suplimentare pe propria fișă, cu spor.
    // Intervalul e singurul lucru pe care angajatul îl declară; restul se
    // derivă aici, din setările organizației.
    let oreLucrate = input.ore_lucrate;
    let oreSuplimentare = input.ore_suplimentare;
    let oreNoapte = input.ore_noapte;

    if (ctx.scope !== "all") {
      if (input.ora_inceput !== null && input.ora_sfarsit !== null) {
        // `input.data`, nu începutul perioadei: setările au istoric
        // (`valabil_de_la`), iar ziua pontată e data la care se aplică.
        const setari = await setariPontaj(ctx.tenant.organizationId, input.data);
        const derivate = oreleZilei(input.ora_inceput, input.ora_sfarsit, configZiDin(setari));
        if (derivate === null) {
          throw businessRule(
            "Ora de ieșire trebuie să fie după ora de intrare, în aceeași zi. Tura care trece de miezul nopții se înregistrează de responsabilul de pontaj.",
          );
        }
        oreLucrate = derivate.lucrate;
        oreSuplimentare = derivate.suplimentare;
        oreNoapte = derivate.noapte;
      } else {
        /*
         * GAURA DE ÎNCREDERE, închisă.
         *
         * Rederivarea de mai sus se făcea DOAR când ambele ore erau prezente.
         * Cu ora de ieșire lipsă, cifrele venite de la client se scriau ca
         * atare — inclusiv pentru scope `own`. Cât timp formularul angajatului
         * cerea obligatoriu ambele ore, combinația nu se producea niciodată și
         * defectul dormea.
         *
         * Pontarea în doi timpi (0096) o face LEGITIMĂ: o zi deschisă cu ceasul
         * are exact forma asta. Fără ramura de aici, o cerere fabricată ar scrie
         * orice număr de ore suplimentare, cu spor, pe propria fișă.
         *
         * ZERO explicit, nu `null`: `ore_lucrate` e `not null default 0`
         * (0013:141), iar tipul generat o marchează opțională, nu nullabilă —
         * un `null` ar trece de `tsc` și ar cădea cu 23502 abia la runtime.
         */
        oreLucrate = 0;
        oreSuplimentare = 0;
        oreNoapte = 0;
      }
    }

    const db = await createServerSupabase();

    // Citire-apoi-INSERT-sau-UPDATE, niciodată `.upsert()`: indexul unic
    // `attendance_entries_zi_uq` e PARȚIAL (`WHERE deleted_at IS NULL`), iar
    // PostgREST nu emite predicatul în `ON CONFLICT` — un `.upsert()` ar cădea
    // cu 42P10.
    const { data: existenta, error: eroareExistenta } = await db
      .from("attendance_entries")
      .select("id, leave_request_id")
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("employee_id", employeeId)
      .eq("data", input.data)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareExistenta !== null) throw eroareExistenta;
    if (existenta !== null && existenta.leave_request_id !== null) {
      throw businessRule(
        "Ziua este completată automat din concediul aprobat — se modifică din modulul Concedii.",
      );
    }

    if (existenta !== null) {
      // Un UPDATE respins de clauza USING a politicii nu produce eroare —
      // afectează ZERO rânduri, tăcut (ex. rândul e deja aprobat și cine scrie
      // nu are drept de aprobare). `.select().maybeSingle()` transformă
      // tăcerea într-un conflict explicit.
      const { data: actualizata, error } = await db
        .from("attendance_entries")
        .update({
          ora_inceput: input.ora_inceput,
          ora_sfarsit: input.ora_sfarsit,
          ore_lucrate: oreLucrate,
          ore_suplimentare: oreSuplimentare,
          ore_noapte: oreNoapte,
          tip_zi: tipZi,
          observatii: input.observatii,
        })
        .eq("id", existenta.id)
        .eq("organization_id", ctx.tenant.organizationId)
        .select("id")
        .maybeSingle();
      if (error !== null) traduEroare(error);
      if (actualizata === null) {
        throw businessRule(
          "Ziua a fost deja aprobată sau perioada a fost blocată între timp, deci nu mai poate fi modificată manual.",
        );
      }
      return { id: actualizata.id };
    }

    const { data, error } = await db
      .from("attendance_entries")
      .insert({
        organization_id: ctx.tenant.organizationId,
        // Placeholder inert: `internal.pontaj_intrare_pregateste` suprascrie
        // necondiționat `period_id` la INSERT — sau aruncă P0001 (luna
        // neschisă / blocată) ÎNAINTE de atribuire. Coloana e NOT NULL fără
        // DEFAULT, deci obligatorie în tipul generat; valoarea reală vine
        // mereu din trigger, niciodată de aici.
        period_id: randomUUID(),
        employee_id: employeeId,
        data: input.data,
        ora_inceput: input.ora_inceput,
        ora_sfarsit: input.ora_sfarsit,
        ore_lucrate: oreLucrate,
        ore_suplimentare: oreSuplimentare,
        ore_noapte: oreNoapte,
        tip_zi: tipZi,
        observatii: input.observatii,
      })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);

    return { id: data.id };
  },
});

// ── Pontarea rapidă (0096) ───────────────────────────────────────────────────
//
// Trei acțiuni care au în comun un lucru esențial: NU primesc de la client nici
// ora, nici orele, nici angajatul. Ora vine din `ctx.now` — ceasul serverului —,
// orele se derivă din setările organizației, iar fișa se rezolvă din sesiune.
// Un telefon cu ora mutată nu poate produce ore de muncă.

/** Ce a aflat preambulul comun, înainte ca vreo scriere să înceapă. */
interface PregatirePontare {
  readonly employeeId: string;
  /** Ziua calendaristică ROMÂNEASCĂ, nu UTC. */
  readonly azi: string;
  /** `"07:32"`, din ceasul serverului. */
  readonly acum: string;
  readonly config: ConfigZi;
  readonly setari: Awaited<ReturnType<typeof setariPontaj>>;
  readonly punctLucruId: string | null;
  /** Numele punctului scanat, ca ecranul să poată confirma UNDE s-a pontat. */
  readonly punctLucruDenumire: string | null;
}

/**
 * Preambulul comun celor trei acțiuni: modul activ, dovada de prezență, fișa.
 *
 * Ordinea nu e arbitrară — se verifică întâi ce e ieftin și refuză cel mai des
 * (modul oprit), abia apoi se plătesc drumurile la bază.
 */
async function pregatirePontareRapida(
  ctx: ActionContext,
  cod: string | null,
  moduriPermise: readonly ModPontareRapida[],
): Promise<PregatirePontare> {
  const azi = todayInBucharest();
  const setari = await setariPontaj(ctx.tenant.organizationId, azi);

  const mod = (setari?.mod_pontare_rapida ?? MOD_PONTARE_IMPLICIT) as ModPontareRapida;
  if (!moduriPermise.includes(mod)) {
    throw businessRule(
      "Pontarea rapidă nu este activată în acest fel pentru firma dumneavoastră. Completați ziua din „Pontajul meu”.",
    );
  }

  /*
   * Dovada de prezență.
   *
   * Codul se rezolvă cu clientul ADMIN, cu filtru explicit pe organizație:
   * politica `puncte_lucru_select` (0030) cere `departments:read <> 'none'`, iar
   * rolul `employee` n-are NICIO permisiune pe `departments` (0002:1206-1219).
   * Deci angajatul nu poate — și nu trebuie să poată — citi tabela.
   *
   * Se spune pe față ce dovedește: că cineva a fost lângă afiș. Nu că angajatul
   * era acolo. E o frână, nu o probă.
   */
  let punctLucruId: string | null = null;
  let punctLucruDenumire: string | null = null;
  if ((setari?.verificare_pontare ?? "fara") === "cod_qr") {
    if (cod === null) {
      throw businessRule("Firma cere scanarea codului de la punctul de lucru înainte de pontare.");
    }
    const admin = createAdminSupabase();
    const { data: punct, error } = await admin
      .from("puncte_lucru")
      .select("id, denumire")
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("cod_pontaj", cod)
      .eq("activ", true)
      .is("deleted_at", null)
      .maybeSingle();
    if (error !== null) throw error;
    if (punct === null) {
      throw businessRule(
        "Codul scanat nu aparține niciunui punct de lucru activ al firmei. Cereți un afiș nou responsabilului.",
      );
    }
    punctLucruId = punct.id;
    punctLucruDenumire = punct.denumire;
  }

  return {
    employeeId: await fisaProprie(ctx),
    azi,
    acum: oraInBucharest(ctx.now),
    config: configZiDin(setari),
    setari,
    punctLucruId,
    punctLucruDenumire,
  };
}

/** Ziua de azi a angajatului, în forma de care are nevoie `stareaCeasului`. */
async function ziuaDeAzi(
  ctx: ActionContext,
  employeeId: string,
  azi: string,
): Promise<{
  readonly id: string;
  readonly ora_inceput: string | null;
  readonly ora_sfarsit: string | null;
  readonly ore_lucrate: number | null;
  readonly leave_request_id: string | null;
  readonly tip_zi: string;
} | null> {
  // Citire-apoi-INSERT-sau-UPDATE, niciodată `.upsert()`: indexul unic
  // `attendance_entries_zi_uq` e PARȚIAL (`where deleted_at is null`), iar
  // PostgREST nu emite predicatul în `ON CONFLICT` — un `.upsert()` cade cu 42P10.
  const { data, error } = await ctx.supabase
    .from("attendance_entries")
    .select("id, ora_inceput, ora_sfarsit, ore_lucrate, leave_request_id, tip_zi")
    .eq("organization_id", ctx.tenant.organizationId)
    .eq("employee_id", employeeId)
    .eq("data", azi)
    .is("deleted_at", null)
    .maybeSingle();
  if (error !== null) throw error;
  return data;
}

export const pontezaIntrarea = createAction({
  name: "attendance.entry.clock_in",
  feature: "attendance",
  permission: "attendance:create",
  minScope: "own",
  input: pontezaIntrareaSchema,
  audit: {
    action: "create",
    entityType: "attendance_entry",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    // Lista e GOALĂ deliberat: singurul câmp de intrare e codul de pe afiș, un
    // token care n-are ce căuta scris în clar în jurnalul de audit. Ce contează
    // — cine, când, pe ce rând — e deja înregistrat de `createAction`.
    allow: [],
  },
  revalidate: [...CAI_REVALIDARE],
  handler: async (
    ctx,
    input,
  ): Promise<
    Readonly<{
      id: string;
      ora_inceput: string;
      reluare: boolean;
      punct_lucru: string | null;
    }>
  > => {
    const p = await pregatirePontareRapida(ctx, input.cod_punct_lucru, ["ceas", "ambele"]);
    const existenta = await ziuaDeAzi(ctx, p.employeeId, p.azi);
    const stare = stareaCeasului(existenta, p.acum);

    /*
     * IDEMPOTENȚĂ, nu eroare.
     *
     * `createAction` n-are limitare de rată, iar o a doua atingere pe o rețea
     * proastă e cel mai firesc lucru din lume. Fără ramura asta, al doilea INSERT
     * cade cu 23505 pe indexul unic parțial, iar omul citește „Există deja o zi
     * de pontaj" pentru o operațiune care A REUȘIT. Prima lui experiență cu
     * „pontarea rapidă" devine „nu merge".
     */
    if (stare.fel === "in_curs" && existenta !== null) {
      return {
        id: existenta.id,
        ora_inceput: stare.oraInceput,
        reluare: true,
        punct_lucru: p.punctLucruDenumire,
      };
    }
    if (stare.fel === "incheiata") {
      throw businessRule(
        `Ziua de azi este deja pontată, de la ${stare.oraInceput} până la ${stare.oraSfarsit}.`,
      );
    }
    if (stare.fel === "alta_sursa") {
      throw businessRule(
        "Ziua de azi este deja înregistrată — din concediu, din foaia colectivă sau ca absență. Pentru o corectură, întrebați responsabilul de pontaj.",
      );
    }

    const randNou = {
      ora_inceput: p.acum,
      ora_sfarsit: null,
      // ZERO explicit, niciodată `null`: `ore_lucrate` e `not null default 0`
      // (0013:141) și ar cădea cu 23502, cu typecheck verde.
      ore_lucrate: 0,
      ore_suplimentare: 0,
      ore_noapte: 0,
      punct_lucru_id: p.punctLucruId,
      sursa: "pontare_rapida" as const,
    };

    if (existenta !== null) {
      // Rând gol, fără interval și fără ore — un loc liber pe care îl deschidem.
      const { data, error } = await ctx.supabase
        .from("attendance_entries")
        .update(randNou)
        .eq("id", existenta.id)
        .eq("organization_id", ctx.tenant.organizationId)
        .select("id")
        .maybeSingle();
      if (error !== null) traduEroare(error);
      if (data === null) {
        throw businessRule(
          "Ziua a fost aprobată sau luna a fost blocată între timp, deci nu mai poate fi deschisă.",
        );
      }
      return {
        id: data.id,
        ora_inceput: p.acum,
        reluare: false,
        punct_lucru: p.punctLucruDenumire,
      };
    }

    const { data, error } = await ctx.supabase
      .from("attendance_entries")
      .insert({
        organization_id: ctx.tenant.organizationId,
        // Placeholder inert: `internal.pontaj_intrare_pregateste` suprascrie
        // necondiționat `period_id` la INSERT — sau aruncă P0001 (luna
        // nedeschisă / blocată) ÎNAINTE de atribuire.
        period_id: randomUUID(),
        employee_id: p.employeeId,
        data: p.azi,
        tip_zi: await tipZiDerivat(ctx, p.azi),
        ...randNou,
      })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);

    return {
      id: data.id,
      ora_inceput: p.acum,
      reluare: false,
      punct_lucru: p.punctLucruDenumire,
    };
  },
});

export const pontezaIesirea = createAction({
  name: "attendance.entry.clock_out",
  feature: "attendance",
  permission: "attendance:create",
  minScope: "own",
  input: pontezaIesireaSchema,
  audit: {
    action: "update",
    entityType: "attendance_entry",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: [],
  },
  revalidate: [...CAI_REVALIDARE],
  handler: async (
    ctx,
    input,
  ): Promise<Readonly<{ id: string; ora_sfarsit: string; ore_lucrate: number }>> => {
    const p = await pregatirePontareRapida(ctx, input.cod_punct_lucru, ["ceas", "ambele"]);
    const existenta = await ziuaDeAzi(ctx, p.employeeId, p.azi);
    const stare = stareaCeasului(existenta, p.acum);

    if (existenta === null || stare.fel !== "in_curs") {
      throw businessRule("Nu aveți nicio zi deschisă astăzi. Apăsați întâi „Am intrat”.");
    }

    const derivate = oreleZilei(stare.oraInceput, p.acum, p.config);
    if (derivate === null) {
      /*
       * Două cauze, același refuz. Ori ziua a fost deschisă aseară și n-a fost
       * închisă — modelul are un rând pe zi și ore fără dată, deci tura peste
       * miezul nopții nu se poate exprima —, ori ieșirea cade exact pe ora
       * intrării. În ambele cazuri, corectura e a responsabilului de pontaj.
       */
      throw businessRule(
        `Ziua a fost deschisă la ${stare.oraInceput} și nu se poate închide la ${p.acum}. Tura care trece de miezul nopții se înregistrează de responsabilul de pontaj.`,
      );
    }

    // `.select()` DUPĂ `.update()`: un UPDATE respins de clauza `USING` afectează
    // ZERO rânduri, fără nicio eroare. Aici se întâmplă exact atunci când ziua a
    // fost aprobată în bloc la prânz — cazul pentru care există și constrângerea
    // `attendance_entries_aprobare_zi_incheiata_ck` din 0096.
    const { data, error } = await ctx.supabase
      .from("attendance_entries")
      .update({
        ora_sfarsit: p.acum,
        ore_lucrate: derivate.lucrate,
        ore_suplimentare: derivate.suplimentare,
        ore_noapte: derivate.noapte,
      })
      .eq("id", existenta.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule(
        "Ziua a fost aprobată sau luna a fost blocată între timp, deci nu mai poate fi închisă. Anunțați responsabilul de pontaj.",
      );
    }

    return { id: data.id, ora_sfarsit: p.acum, ore_lucrate: derivate.lucrate };
  },
});

export const confirmaZiuaStandard = createAction({
  name: "attendance.entry.confirm_standard",
  feature: "attendance",
  permission: "attendance:create",
  minScope: "own",
  input: confirmaZiuaStandardSchema,
  audit: {
    action: "create",
    entityType: "attendance_entry",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: [],
  },
  revalidate: [...CAI_REVALIDARE],
  handler: async (
    ctx,
    input,
  ): Promise<
    Readonly<{ id: string; ora_inceput: string; ora_sfarsit: string; ore_lucrate: number }>
  > => {
    const p = await pregatirePontareRapida(ctx, input.cod_punct_lucru, ["confirmare", "ambele"]);

    const programStart = p.setari?.program_start;
    if (programStart === null || programStart === undefined) {
      throw businessRule(
        "Firma nu are declarată ora de început a programului, deci nu se poate propune un interval.",
      );
    }
    // `time` din Postgres vine cu secunde: `"08:00:00"`.
    const interval = intervalulPropus(programStart.slice(0, 5), p.config);
    if (interval === null) {
      throw businessRule(
        "Programul declarat de firmă nu încape într-o singură zi calendaristică. Completați ziua din „Pontajul meu”.",
      );
    }
    const derivate = oreleZilei(interval.inceput, interval.sfarsit, p.config);
    if (derivate === null) {
      throw businessRule("Programul declarat de firmă nu produce un interval valid.");
    }

    const existenta = await ziuaDeAzi(ctx, p.employeeId, p.azi);
    const stare = stareaCeasului(existenta, p.acum);
    if (stare.fel === "in_curs") {
      throw businessRule(
        `Aveți o zi deschisă de la ${stare.oraInceput}. Închideți-o cu „Am ieșit”.`,
      );
    }
    if (stare.fel === "incheiata") {
      throw businessRule(
        `Ziua de azi este deja pontată, de la ${stare.oraInceput} până la ${stare.oraSfarsit}.`,
      );
    }
    if (stare.fel === "alta_sursa") {
      throw businessRule(
        "Ziua de azi este deja înregistrată — din concediu, din foaia colectivă sau ca absență. Pentru o corectură, întrebați responsabilul de pontaj.",
      );
    }

    const valori = {
      ora_inceput: interval.inceput,
      ora_sfarsit: interval.sfarsit,
      ore_lucrate: derivate.lucrate,
      ore_suplimentare: derivate.suplimentare,
      ore_noapte: derivate.noapte,
      punct_lucru_id: p.punctLucruId,
      sursa: "pontare_rapida" as const,
    };

    if (existenta !== null) {
      const { data, error } = await ctx.supabase
        .from("attendance_entries")
        .update(valori)
        .eq("id", existenta.id)
        .eq("organization_id", ctx.tenant.organizationId)
        .select("id")
        .maybeSingle();
      if (error !== null) traduEroare(error);
      if (data === null) {
        throw businessRule(
          "Ziua a fost aprobată sau luna a fost blocată între timp, deci nu mai poate fi completată.",
        );
      }
      return {
        id: data.id,
        ora_inceput: interval.inceput,
        ora_sfarsit: interval.sfarsit,
        ore_lucrate: derivate.lucrate,
      };
    }

    const { data, error } = await ctx.supabase
      .from("attendance_entries")
      .insert({
        organization_id: ctx.tenant.organizationId,
        period_id: randomUUID(),
        employee_id: p.employeeId,
        data: p.azi,
        tip_zi: await tipZiDerivat(ctx, p.azi),
        ...valori,
      })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);

    return {
      id: data.id,
      ora_inceput: interval.inceput,
      ora_sfarsit: interval.sfarsit,
      ore_lucrate: derivate.lucrate,
    };
  },
});

export const stergeZiPontaj = createAction({
  name: "attendance.entry.delete",
  feature: "attendance",
  permission: "attendance:create",
  minScope: "own",
  input: stergeZiPontajSchema,
  audit: {
    action: "delete",
    entityType: "attendance_entry",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: [...CAI_REVALIDARE],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();

    const { data: existenta, error: eroareExistenta } = await db
      .from("attendance_entries")
      .select("id, leave_request_id")
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareExistenta !== null) throw eroareExistenta;
    if (existenta === null) {
      throw notFound("Ziua de pontaj nu a fost găsită sau nu vă este accesibilă.");
    }
    if (existenta.leave_request_id !== null) {
      throw businessRule(
        "Ziua este completată automat din concediul aprobat și nu poate fi ștearsă manual.",
      );
    }

    // Nicio tabelă `attendance_*` nu are politică DELETE: ștergerea e
    // întotdeauna `update { deleted_at }` — care trece prin ACELAȘI trigger de
    // pregătire, deci o lună blocată respinge și ștergerea logică.
    const { data: stearsa, error } = await db
      .from("attendance_entries")
      .update({ deleted_at: ctx.now.toISOString() })
      .eq("id", existenta.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (stearsa === null) {
      throw businessRule(
        "Ziua a fost deja aprobată sau perioada a fost blocată între timp, deci nu mai poate fi ștearsă.",
      );
    }

    return { id: stearsa.id };
  },
});

export const aprobaPontajBloc = createAction({
  name: "attendance.batch.approve",
  feature: "attendance",
  permission: "attendance:approve",
  minScope: "team",
  input: aprobaPontajBlocSchema,
  audit: {
    action: "update",
    entityType: "attendance_approval_batch",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    // `observatii` NU intră în audit — vezi comentariul din `deschidePerioada`.
    allow: ["period_id", "department_id"],
  },
  revalidate: [...CAI_REVALIDARE],
  handler: async (
    ctx,
    input,
  ): Promise<Readonly<{ id: string; liniiAprobate: number; zileDeschise: number }>> => {
    // (1) Perioada, cu clientul utilizatorului.
    const { data: perioada, error: eroarePerioada } = await ctx.supabase
      .from("attendance_periods")
      .select("id, an, luna, status")
      .eq("id", input.period_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroarePerioada !== null) throw eroarePerioada;
    if (perioada === null) {
      throw notFound("Perioada de pontaj nu a fost găsită sau nu vă este accesibilă.");
    }
    if (perioada.status === "blocata") {
      throw businessRule(
        `Perioada de pontaj ${formatMonthYear(perioada.an, perioada.luna)} este deja blocată.`,
      );
    }

    // (2) ID-urile de aprobat, cu clientul utilizatorului: RLS
    // (`attendance_entries_select` → `app.poate_vedea_pontaj`) le restrânge
    // deja la own/team, în funcție de scope-ul de CITIRE al aprobatorului.
    //
    // CITITE PAGINAT, nu dintr-o dată: PostgREST taie la `max_rows = 1000`
    // fără nicio eroare. La 46 de angajați × 22 de zile = 1012 linii, aprobarea
    // „în bloc” marca primele 1000, scria `linii_aprobate = 1000` pe lot, muta
    // luna în „în aprobare” și raporta succes — cele 12 rămase nu apăreau
    // nicăieri ca problemă, iar o blocare ulterioară le îngheța neaprobate,
    // fără cale de întoarcere în afară de redeschiderea lunii.
    const liniiVizibile: {
      readonly id: string;
      readonly employee_id: string;
      readonly ora_inceput: string | null;
      readonly ora_sfarsit: string | null;
    }[] = [];
    let completCitit = false;
    for (let pagina = 0; pagina < MAXIM_PAGINI_APROBARE; pagina += 1) {
      const deLa = pagina * PAGINA_APROBARE;
      const { data: lot, error: eroareLinii } = await ctx.supabase
        .from("attendance_entries")
        .select("id, employee_id, ora_inceput, ora_sfarsit")
        .eq("organization_id", ctx.tenant.organizationId)
        .eq("period_id", input.period_id)
        .is("approved_at", null)
        .is("deleted_at", null)
        // Ordine TOTALĂ (`id` e unic): fără ea, `.range()` poate întoarce de
        // două ori același rând și sări peste altul între pagini.
        .order("id", { ascending: true })
        .range(deLa, deLa + PAGINA_APROBARE - 1);
      if (eroareLinii !== null) throw eroareLinii;
      const randuri = lot ?? [];
      liniiVizibile.push(...randuri);
      if (randuri.length < PAGINA_APROBARE) {
        completCitit = true;
        break;
      }
    }
    if (!completCitit) {
      throw businessRule(
        `Luna are peste ${String(liniiVizibile.length)} de linii neaprobate — mai multe decât poate aproba o singură apăsare. Aprobați pe departamente, unul câte unul.`,
      );
    }

    // Filtrul de departament, tot cu clientul utilizatorului.
    let idAngajatiDepartament: ReadonlySet<string> | null = null;
    if (input.department_id !== null) {
      const { data: angajatiDepartament, error: eroareAngajati } = await ctx.supabase
        .from("employees")
        .select("id")
        .eq("organization_id", ctx.tenant.organizationId)
        .eq("department_id", input.department_id);
      if (eroareAngajati !== null) throw eroareAngajati;
      idAngajatiDepartament = new Set((angajatiDepartament ?? []).map((a) => a.id));
    }

    const inSelectie = liniiVizibile.filter(
      (l) => idAngajatiDepartament === null || idAngajatiDepartament.has(l.employee_id),
    );

    /*
     * ZILELE ÎN CURS SE SAR, ȘI SE SPUNE CÂTE.
     *
     * O zi deschisă cu ceasul la 07:32 și neînchisă încă arată exact ca o zi
     * neaprobată oarecare. Aprobată la prânz, „Am ieșit" de la ora 17 e apoi
     * respins de clauza `USING` a politicii — ZERO rânduri, FĂRĂ eroare — iar
     * ziua rămâne înghețată la 0 ore, pe care salarizarea le agregă tăcut.
     *
     * Constrângerea `attendance_entries_aprobare_zi_incheiata_ck` (0096) ar face
     * acum aprobarea să cadă cu 23514 — dar ar cădea ÎNTREGUL lot, pentru o
     * singură zi deschisă. Deci filtrul de aici nu e ornament pe lângă
     * constrângere: e calea normală, iar constrângerea e plasa de sub ea.
     */
    const deschise = inSelectie.filter((l) => l.ora_inceput !== null && l.ora_sfarsit === null);
    const idDeAprobat = inSelectie
      .filter((l) => !(l.ora_inceput !== null && l.ora_sfarsit === null))
      .map((l) => l.id);
    if (idDeAprobat.length === 0) {
      throw businessRule(
        deschise.length === 0
          ? "Nu există linii de pontaj neaprobate pentru selecția aleasă."
          : "Toate zilele neaprobate din selecție sunt încă deschise — cineva a apăsat „Am intrat” și n-a apăsat „Am ieșit”. Nu se pot aproba așa.",
      );
    }

    // (3) Lotul, cu clientul utilizatorului. `linii_aprobate` rămâne pe
    // valoarea implicită 0 — politica INSERT o cere exact așa.
    const { data: lot, error: eroareLot } = await ctx.supabase
      .from("attendance_approval_batches")
      .insert({
        organization_id: ctx.tenant.organizationId,
        period_id: input.period_id,
        department_id: input.department_id,
        observatii: input.observatii,
      })
      .select("id")
      .single();
    if (eroareLot !== null) traduEroare(eroareLot);

    // (4) Marcarea liniilor CU CLIENTUL ADMIN: rolul `manager` are
    // `attendance:approve = team` dar NU are `attendance:create`, iar
    // `attendance_entries_update` cere `app.poate_scrie_pontaj` (care se uită
    // la `attendance:create`) — RLS ar refuza un manager care aprobă. Mulțimea
    // de id-uri e deja mărginită de RLS la pasul (2), cu clientul
    // utilizatorului, deci ocolirea RLS aici e strict pentru scriere, nu
    // pentru vizibilitate.
    // Rămâne fără `.select()`: scrierea trece cu clientul admin, deci nicio
    // politică n-o poate refuza tăcut, iar mulțimea de id-uri tocmai a fost
    // citită la pasul (2) — un rezultat gol n-ar însemna „refuzat”, ci că
    // rândurile au dispărut fizic, ceea ce nicio tabelă `attendance_*` nu
    // permite (n-au politică DELETE).
    const admin = createAdminSupabase();
    const { error: eroareMarcare } = await admin
      .from("attendance_entries")
      .update({ approved_at: ctx.now.toISOString(), approved_by: ctx.user.id, batch_id: lot.id })
      .in("id", idDeAprobat)
      .eq("organization_id", ctx.tenant.organizationId);
    if (eroareMarcare !== null) throw eroareMarcare;

    // (5) Lotul + statusul perioadei, cu clientul utilizatorului.
    // `attendance_batches_update` cere din nou `attendance:approve = team`
    // (0013_attendance.sql). Respins de `USING`, UPDATE-ul afectează zero
    // rânduri fără eroare: liniile ar rămâne aprobate, dar lotul ar arăta la
    // nesfârșit „0 linii aprobate” — un contor care nu urmează lista.
    const { data: lotActualizat, error: eroareActualizareLot } = await ctx.supabase
      .from("attendance_approval_batches")
      .update({ linii_aprobate: idDeAprobat.length })
      .eq("id", lot.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (eroareActualizareLot !== null) throw eroareActualizareLot;
    if (lotActualizat === null) {
      throw businessRule(
        "Liniile au fost aprobate, dar numărul lor nu a putut fi înscris pe lotul de aprobare, care rămâne afișat cu 0 linii. Reîncărcați pagina și verificați dacă mai aveți dreptul de aprobare.",
      );
    }

    if (perioada.status === "deschisa") {
      // Tranziția `deschisa -> in_aprobare` trece prin `attendance_periods_update`.
      // Un manager cu `attendance:approve = team` NU o poate face — politica cere
      // scope `all` (capcana 9). Respins de `USING`, UPDATE-ul afectează zero
      // rânduri fără eroare (capcana 17): lotul s-ar aproba, dar luna ar rămâne
      // „deschisă”, iar blocarea ulterioară ar eșua fără explicație.
      const { data: perioadaTrecuta, error: eroareStatus } = await ctx.supabase
        .from("attendance_periods")
        .update({ status: "in_aprobare" })
        .eq("id", perioada.id)
        .eq("organization_id", ctx.tenant.organizationId)
        .select("id")
        .maybeSingle();
      if (eroareStatus !== null) throw eroareStatus;
      if (perioadaTrecuta === null) {
        throw businessRule("Liniile au fost aprobate, dar luna nu a putut trece în „în aprobare”.");
      }
    }

    // `zileDeschise` NU e un detaliu tehnic: e numărul de oameni care au uitat
    // să-și închidă ziua și pe care aprobarea tocmai i-a sărit. Ecranul îl
    // afișează; tăcut, ar fi exact tiparul de defect pe care îl repară.
    return { id: lot.id, liniiAprobate: idDeAprobat.length, zileDeschise: deschise.length };
  },
});

export const blocheazaPerioada = createAction({
  name: "attendance.period.lock",
  feature: "attendance",
  permission: "attendance:approve",
  minScope: "all",
  input: idPerioadaSchema,
  audit: {
    action: "update",
    entityType: "attendance_period",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: [...CAI_REVALIDARE],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    // NU se trimit `blocata_la`/`blocata_de`/`an`/`luna`/`data_*`: triggerul
    // le rescrie oricum (pe cele din urmă din OLD, la UPDATE).
    const { data, error } = await db
      .from("attendance_periods")
      .update({ status: "blocata" })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw notFound("Perioada de pontaj nu a fost găsită sau nu vă este accesibilă.");
    }
    return { id: data.id };
  },
});

export const redeschidePerioada = createAction({
  name: "attendance.period.unlock",
  feature: "attendance",
  permission: "attendance:approve",
  minScope: "all",
  input: idPerioadaSchema,
  audit: {
    action: "update",
    entityType: "attendance_period",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: [...CAI_REVALIDARE],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    // Redeschiderea duce ÎNTOTDEAUNA în 'deschisa': „blocata → in_aprobare” e
    // o tranziție refuzată de trigger, cu P0001 (verificat live).
    const { data, error } = await db
      .from("attendance_periods")
      .update({ status: "deschisa" })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw notFound("Perioada de pontaj nu a fost găsită sau nu vă este accesibilă.");
    }
    return { id: data.id };
  },
});

export const sincronizeazaConcediile = createAction({
  name: "attendance.leave.sync",
  feature: "attendance",
  permission: "attendance:create",
  minScope: "all",
  input: sincronizeazaConcediileSchema,
  audit: {
    action: "create",
    entityType: "attendance_entry",
    allow: ["an", "luna"],
  },
  revalidate: [...CAI_REVALIDARE],
  handler: async (
    ctx,
    input,
  ): Promise<Readonly<{ create: number; actualizate: number; pastrate: number }>> => {
    // `app.sincronizeaza_pontaj_concedii` există în bază, dar trăiește în
    // schema `app`, neexpusă prin PostgREST (supabase/config.toml:
    // schemas = ["public","graphql_public"]) — `.rpc()` n-ar funcționa deși
    // funcția are GRANT EXECUTE. Logica ei e portată aici, în TypeScript.
    if (!ctx.features.has("leave")) {
      throw businessRule(
        "Modulul de concedii nu este activ pentru această organizație, deci nu există ce sincroniza.",
      );
    }

    const db = await createServerSupabase();
    const { inceput, sfarsit } = intervalulLunii(input.an, input.luna);

    // Sursa: zilele de concediu APROBAT, lucrătoare, din intervalul lunii.
    // `leave_request_days` NU are `employee_id` propriu (vezi 0009_leave.sql)
    // — vine doar prin `leave_requests` îmbinată. `.returns<T>()` e obligatoriu
    // — generatorul emite `Relationships: []` pentru toate tabelele, deci
    // embed-ul nu se tipează singur.
    interface ZiConcediuBruta {
      readonly data: string;
      readonly leave_request_id: string;
      readonly cerere: Readonly<{
        employee_id: string;
        status: string;
        // `tip_zi_pontaj` decide dacă zilele se plătesc (0064). Embed pe două
        // niveluri: ziua → cererea → tipul de concediu.
        tip: Readonly<{ tip_zi_pontaj: TipZiPontaj }> | null;
      }> | null;
    }
    const { data: zileConcediu, error: eroareConcediu } = await db
      .from("leave_request_days")
      .select(
        "data, leave_request_id, cerere:leave_requests!leave_request_id(employee_id, status, tip:leave_types!leave_requests_leave_type_id_fkey(tip_zi_pontaj))",
      )
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("este_lucratoare", true)
      .gte("data", inceput)
      .lte("data", sfarsit)
      .returns<ZiConcediuBruta[]>();
    if (eroareConcediu !== null) throw eroareConcediu;

    const zileAprobate = (zileConcediu ?? [])
      .filter((z) => z.cerere?.status === "aprobata")
      .map((z) => ({
        employee_id: (z.cerere as { employee_id: string }).employee_id,
        data: z.data,
        leave_request_id: z.leave_request_id,
        // Tipul șters logic între timp → „concediu”, ca înainte de 0064.
        tip_zi: z.cerere?.tip?.tip_zi_pontaj ?? ("concediu" as TipZiPontaj),
      }));
    if (zileAprobate.length === 0) {
      return { create: 0, actualizate: 0, pastrate: 0 };
    }

    return sincronizeazaZileleDeConcediu(db, ctx.tenant.organizationId, zileAprobate);
  },
});

/**
 * Aprobă sau respinge o SINGURĂ zi de pontaj.
 *
 * Completează `aprobaPontajBloc`, care decide pe toată luna. Până în 0067
 * bloc-ul era singura opțiune, iar respingerea nu exista deloc: aprobatorul
 * care găsea o zi greșită într-o lună de 200 de angajați putea aproba tot,
 * inclusiv greșeala, sau nimic.
 *
 * `minScope: "team"` — managerul direct decide pentru echipa lui, patronul
 * pentru toată firma. HR a ieșit din aprobări în 0067, la fel ca la concedii.
 *
 * Decizia trece prin `public.decide_zi_pontaj`, nu printr-un UPDATE direct:
 * politica de UPDATE ar bloca un rând deja aprobat, iar funcția verifică
 * explicit dreptul, garda de tenant și starea perioadei.
 */
export const decideZiPontaj = createAction({
  name: "attendance.entry.decide",
  feature: "attendance",
  permission: "attendance:approve",
  minScope: "team",
  input: decideZiPontajSchema,
  audit: {
    action: "update",
    entityType: "attendance_entry",
    entityId: (input) => input.entry_id,
    // `motiv` NU intră în audit: descrie o problemă a unei persoane anume, iar
    // jurnalul e citibil de oricine are `audit:read`.
    allow: ["entry_id", "aproba"],
  },
  revalidate: [...CAI_REVALIDARE],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const { data, error } = await ctx.supabase.rpc("decide_zi_pontaj", {
      p_organization_id: ctx.tenant.organizationId,
      p_entry_id: input.entry_id,
      p_aproba: input.aproba,
      ...(input.motiv === null ? {} : { p_motiv: input.motiv }),
    });
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule("Ziua de pontaj nu a putut fi decisă.");
    }
    return { id: data };
  },
});
