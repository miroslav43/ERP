// src/app/(app)/pontaj/actions.ts
"use server";

import { randomUUID } from "node:crypto";

import { createAction } from "@/lib/actions/create-action";
import { businessRule, notFound } from "@/lib/actions/errors";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatMonthYear } from "@/lib/format/date";
import { zileNelucratoare } from "@/lib/queries/leave";
import {
  aprobaPontajBlocSchema,
  decideZiPontajSchema,
  deschidePerioadaSchema,
  idPerioadaSchema,
  salveazaZiPontajSchema,
  sincronizeazaConcediileSchema,
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
  // salvează o zi și se întoarce pe „Pontajul meu" fără s-o vadă.
  "/portal",
  "/portal/pontajul-meu",
] as const;

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

    let employeeId = input.employee_id;
    if (employeeId === null) {
      // Fișa proprie via clientul admin: rolul `employee` are
      // `employees:read = none`, deci clientul autentificat NU poate citi nici
      // măcar propria fișă (0005_hr_rls.sql, `employees_select`). Tiparul e
      // cel din `concedii/actions.ts`.
      const admin = createAdminSupabase();
      const { data: fisa, error: eroareFisa } = await admin
        .from("employees")
        .select("id")
        .eq("organization_id", ctx.tenant.organizationId)
        .eq("user_id", ctx.user.id)
        .eq("is_primary", true)
        .is("deleted_at", null)
        .maybeSingle();
      if (eroareFisa !== null) throw eroareFisa;
      if (fisa === null) {
        throw businessRule(
          "Contul dvs. nu este legat de o fișă de angajat activă în această organizație. Contactați administratorul.",
        );
      }
      employeeId = fisa.id;
    }

    // Tipul zilei: alegerea explicită a utilizatorului, sau derivarea
    // automată — COPIE a `internal.pontaj_intrare_pregateste` (vezi
    // `etichete.ts`). Necesară fiindcă tipul generat marchează `tip_zi`
    // obligatoriu și nenul, deși triggerul l-ar deriva singur la `null`.
    let tipZi = input.tip_zi;
    if (tipZi === null) {
      const an = Number(input.data.slice(0, 4));
      const { nationale, organizatie } = await zileNelucratoare(ctx.tenant.organizationId, an, an);
      tipZi = tipZiAutomat(
        input.data,
        new Set(nationale.map((z) => z.data)),
        new Set(organizatie.filter((z) => z.tip === "zi_recuperare").map((z) => z.data)),
        new Set(organizatie.filter((z) => z.tip === "liber_suplimentar").map((z) => z.data)),
      );
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
          ore_lucrate: input.ore_lucrate,
          ore_suplimentare: input.ore_suplimentare,
          ore_noapte: input.ore_noapte,
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
        ore_lucrate: input.ore_lucrate,
        ore_suplimentare: input.ore_suplimentare,
        ore_noapte: input.ore_noapte,
        tip_zi: tipZi,
        observatii: input.observatii,
      })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);

    return { id: data.id };
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
  handler: async (ctx, input): Promise<Readonly<{ id: string; liniiAprobate: number }>> => {
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
    const { data: liniiVizibile, error: eroareLinii } = await ctx.supabase
      .from("attendance_entries")
      .select("id, employee_id")
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("period_id", input.period_id)
      .is("approved_at", null)
      .is("deleted_at", null);
    if (eroareLinii !== null) throw eroareLinii;

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

    const idDeAprobat = (liniiVizibile ?? [])
      .filter((l) => idAngajatiDepartament === null || idAngajatiDepartament.has(l.employee_id))
      .map((l) => l.id);
    if (idDeAprobat.length === 0) {
      throw businessRule("Nu există linii de pontaj neaprobate pentru selecția aleasă.");
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
      // „deschisă", iar blocarea ulterioară ar eșua fără explicație.
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

    return { id: lot.id, liniiAprobate: idDeAprobat.length };
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
        // Tipul șters logic între timp → „concediu", ca înainte de 0064.
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
