// src/app/(app)/evaluari/kpi/actions.ts
"use server";

import { completeazaCoduri } from "@/domain/evaluations/criterii";
import { calculeazaScorLunar, procentLinie, tintaEfectiva } from "@/domain/evaluations/kpi";
import { createAction } from "@/lib/actions/create-action";
import { businessRule, mapPostgrestError, notFound } from "@/lib/actions/errors";
import { normalizeazaFunctie } from "@/lib/queries/kpi";
import type { ActionContext } from "@/lib/actions/types";
import {
  actualizeazaSetKpiSchema,
  arhiveazaSetKpiSchema,
  creeazaSetKpiSchema,
  deschideLunaKpiSchema,
  finalizeazaLunaKpiSchema,
  salveazaLunaKpiSchema,
  seteazaTintaKpiSchema,
  stergeTintaKpiSchema,
  type IndicatorKpiIntrare,
} from "@/schemas/kpi";

/**
 * Scrierile KPI-ului lunar.
 *
 * ── CE PĂZEȘTE BAZA, ȘI DE CE NU SE REPETĂ AICI ───────────────────────────
 * `0119_kpi_lunar.sql` cere managerul DIRECT pentru orice scriere
 * (`app.este_manager_direct`), iar `minScope: "team"` de mai jos e doar poarta
 * de aplicație. Cele două nu spun același lucru: `team` trece și pentru șeful
 * șefului, baza nu-l lasă. Asta e intenționat — poarta de aplicație oprește
 * devreme ce se poate opri ieftin, baza decide.
 *
 * Consecința practică, pe care fiecare handler o tratează: un UPDATE respins de
 * clauza `USING` afectează ZERO rânduri FĂRĂ EROARE. De aceea fiecare scriere
 * face `.select()` după `.update()` și tratează rezultatul gol drept CONFLICT.
 */

const CAI_KPI = ["/evaluari/kpi", "/evaluari/kpi/seturi"] as const;

const caiLuna = (id: string, employeeId: string): readonly string[] => [
  ...CAI_KPI,
  `/evaluari/kpi/${id}`,
  `/angajati/${employeeId}`,
  "/portal/kpi-ul-meu",
];

// ── Seturi ────────────────────────────────────────────────────────────────────

/** Coloanele de indicator care se scriu, derivate din intrarea validată. */
function randIndicator(
  organizationId: string,
  setId: string,
  intrare: IndicatorKpiIntrare,
  cod: string,
  ordine: number,
) {
  return {
    organization_id: organizationId,
    set_id: setId,
    cod,
    denumire: intrare.denumire,
    descriere: intrare.descriere,
    tip: intrare.tip,
    unitate: intrare.unitate,
    sens: intrare.sens,
    tinta_implicita: intrare.tinta_implicita,
    scala_max: intrare.scala_max,
    pondere: intrare.pondere,
    ordine,
  };
}

export const creeazaSetKpi = createAction<typeof creeazaSetKpiSchema, Readonly<{ id: string }>>({
  name: "kpi_seturi.create",
  feature: "evaluations",
  permission: "evaluations:update",
  minScope: "team",
  input: creeazaSetKpiSchema,
  audit: {
    action: "create",
    entityType: "kpi_seturi",
    entityId: (_input, data) => data.id,
    allow: ["functie", "denumire"],
  },
  revalidate: () => CAI_KPI,
  handler: async (ctx, input) => {
    const { data: set, error } = await ctx.supabase
      .from("kpi_seturi")
      .insert({
        organization_id: ctx.tenant.organizationId,
        functie: input.functie,
        denumire: input.denumire,
        descriere: input.descriere,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id")
      .maybeSingle<{ id: string }>();
    if (error !== null) {
      // Indexul parțial `kpi_seturi_functie_uniq` — un set activ per funcție.
      if (error.code === "23505") {
        throw businessRule(
          "Funcția are deja un set de indicatori activ. Editați-l pe acela sau arhivați-l întâi.",
        );
      }
      throw mapPostgrestError(error, ctx.requestId);
    }
    if (set === null) throw businessRule("Setul nu a putut fi creat. Reîncărcați pagina.");

    const coduri = completeazaCoduri(input.indicatori);
    const randuri = input.indicatori.map((ind, i) =>
      randIndicator(
        ctx.tenant.organizationId,
        set.id,
        ind,
        coduri[i] ?? `indicator_${String(i + 1)}`,
        i,
      ),
    );
    const { error: eroareIndicatori } = await ctx.supabase
      .from("kpi_indicatori")
      .insert(randuri.map((r) => ({ ...r, created_by: ctx.user.id, updated_by: ctx.user.id })));
    if (eroareIndicatori !== null) {
      // Compensare: fără indicatori, setul e o cochilie care ar apărea în listă
      // și ar bloca funcția prin indexul unic. Nu există tranzacție peste două
      // apeluri PostgREST, deci curățenia se face explicit.
      await ctx.supabase
        .from("kpi_seturi")
        .update({ deleted_at: new Date().toISOString(), updated_by: ctx.user.id })
        .eq("id", set.id)
        .eq("organization_id", ctx.tenant.organizationId);
      throw mapPostgrestError(eroareIndicatori, ctx.requestId);
    }

    return { id: set.id };
  },
});

interface IndicatorExistent {
  readonly id: string;
  readonly cod: string;
}

/**
 * Editarea setului: indicatorii se reconciliază DUPĂ COD, nu se rescriu.
 *
 * Codul e cheia sub care stau valorile deja scrise în lunile trecute
 * (`kpi_valori_uniq` e pe `evaluare_id, cod`). Un cod regenerat la fiecare
 * salvare ar fi rupt legătura cu istoricul fără nicio eroare.
 *
 * Ordinea contează: întâi se șterg (soft) cei scoși, apoi se inserează cei noi.
 * Invers, un cod scos și readăugat în aceeași salvare ar fi lovit indexul
 * parțial `kpi_indicatori_cod_uniq`, care numără doar rândurile nevestejite.
 */
export const actualizeazaSetKpi = createAction<
  typeof actualizeazaSetKpiSchema,
  Readonly<{ id: string }>
>({
  name: "kpi_seturi.update",
  feature: "evaluations",
  permission: "evaluations:update",
  minScope: "team",
  input: actualizeazaSetKpiSchema,
  audit: {
    action: "update",
    entityType: "kpi_seturi",
    entityId: (input) => input.id,
    allow: ["denumire"],
  },
  revalidate: (input) => [...CAI_KPI, `/evaluari/kpi/seturi/${input.id}`],
  handler: async (ctx, input) => {
    const { data: existente, error: eroareCitire } = await ctx.supabase
      .from("kpi_indicatori")
      .select("id, cod")
      .eq("set_id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .returns<IndicatorExistent[]>();
    if (eroareCitire !== null) throw mapPostgrestError(eroareCitire, ctx.requestId);

    const coduri = completeazaCoduri(input.indicatori);
    const codDupaPozitie = input.indicatori.map(
      (_, i) => coduri[i] ?? `indicator_${String(i + 1)}`,
    );
    const pastrate = new Set(codDupaPozitie);
    const dupaCod = new Map((existente ?? []).map((e) => [e.cod, e.id]));
    const acum = new Date().toISOString();

    const deSters = (existente ?? []).filter((e) => !pastrate.has(e.cod)).map((e) => e.id);
    if (deSters.length > 0) {
      const { error } = await ctx.supabase
        .from("kpi_indicatori")
        .update({ deleted_at: acum, updated_by: ctx.user.id })
        .in("id", deSters)
        .eq("organization_id", ctx.tenant.organizationId);
      if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    }

    const actualizari = input.indicatori
      .map((ind, i) => ({
        ind,
        i,
        cod: codDupaPozitie[i] ?? "",
        id: dupaCod.get(codDupaPozitie[i] ?? ""),
      }))
      .filter((x): x is typeof x & { id: string } => x.id !== undefined);
    for (const { ind, i, cod, id } of actualizari) {
      const { error } = await ctx.supabase
        .from("kpi_indicatori")
        .update({
          ...randIndicator(ctx.tenant.organizationId, input.id, ind, cod, i),
          updated_by: ctx.user.id,
        })
        .eq("id", id)
        .eq("organization_id", ctx.tenant.organizationId);
      if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    }

    const noi = input.indicatori
      .map((ind, i) => ({ ind, i, cod: codDupaPozitie[i] ?? "" }))
      .filter((x) => !dupaCod.has(x.cod));
    if (noi.length > 0) {
      const { error } = await ctx.supabase.from("kpi_indicatori").insert(
        noi.map(({ ind, i, cod }) => ({
          ...randIndicator(ctx.tenant.organizationId, input.id, ind, cod, i),
          created_by: ctx.user.id,
          updated_by: ctx.user.id,
        })),
      );
      if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    }

    const { data, error } = await ctx.supabase
      .from("kpi_seturi")
      .update({
        denumire: input.denumire,
        descriere: input.descriere,
        updated_by: ctx.user.id,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle<{ id: string }>();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    if (data === null) {
      throw businessRule("Setul nu a putut fi salvat: fie nu mai există, fie nu aveți dreptul.");
    }
    return { id: data.id };
  },
});

export const arhiveazaSetKpi = createAction<typeof arhiveazaSetKpiSchema, Readonly<{ id: string }>>(
  {
    name: "kpi_seturi.archive",
    feature: "evaluations",
    permission: "evaluations:update",
    minScope: "team",
    input: arhiveazaSetKpiSchema,
    audit: {
      action: "update",
      entityType: "kpi_seturi",
      entityId: (input) => input.id,
      allow: [],
    },
    revalidate: () => CAI_KPI,
    handler: async (ctx, input) => {
      // `activ = false`, nu `deleted_at`: lunile deja evaluate păstrează
      // `set_id` cu `on delete restrict`, iar istoricul rămâne citibil.
      const { data, error } = await ctx.supabase
        .from("kpi_seturi")
        .update({ activ: false, updated_by: ctx.user.id })
        .eq("id", input.id)
        .eq("organization_id", ctx.tenant.organizationId)
        .eq("activ", true)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle<{ id: string }>();
      if (error !== null) throw mapPostgrestError(error, ctx.requestId);
      if (data === null) throw businessRule("Setul era deja arhivat sau nu mai există.");
      return { id: data.id };
    },
  },
);

// ── Ținte per angajat ─────────────────────────────────────────────────────────

/**
 * Abaterea de țintă: se citește întâi, apoi se inserează SAU se actualizează.
 *
 * NU se face `upsert`. `kpi_tinte_angajat_uniq` e un index PARȚIAL
 * (`where deleted_at is null`), iar `on conflict` peste el cere predicatul
 * repetat în clauză — pe care PostgREST nu-l poate trimite. Fără el, Postgres
 * răspunde 42P10 „no unique or exclusion constraint matching the ON CONFLICT
 * specification", o eroare care n-are nicio legătură cu ce a tastat omul.
 */
export const seteazaTintaKpi = createAction<
  typeof seteazaTintaKpiSchema,
  Readonly<{ id: string; employee_id: string }>
>({
  name: "kpi_tinte_angajat.set",
  feature: "evaluations",
  permission: "evaluations:update",
  minScope: "team",
  input: seteazaTintaKpiSchema,
  audit: {
    action: "update",
    entityType: "kpi_tinte_angajat",
    entityId: (_input, data) => data.id,
    allow: ["employee_id", "indicator_id", "tinta"],
  },
  revalidate: (input) => [...CAI_KPI, `/angajati/${input.employee_id}`, "/portal/kpi-ul-meu"],
  handler: async (ctx, input) => {
    const { data: existenta, error: eroareCitire } = await ctx.supabase
      .from("kpi_tinte_angajat")
      .select("id")
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("employee_id", input.employee_id)
      .eq("indicator_id", input.indicator_id)
      .is("deleted_at", null)
      .maybeSingle<{ id: string }>();
    if (eroareCitire !== null) throw mapPostgrestError(eroareCitire, ctx.requestId);

    if (existenta !== null) {
      const { data, error } = await ctx.supabase
        .from("kpi_tinte_angajat")
        .update({ tinta: input.tinta, motiv: input.motiv, updated_by: ctx.user.id })
        .eq("id", existenta.id)
        .eq("organization_id", ctx.tenant.organizationId)
        .select("id, employee_id")
        .maybeSingle<{ id: string; employee_id: string }>();
      if (error !== null) throw mapPostgrestError(error, ctx.requestId);
      if (data === null) {
        throw businessRule(
          "Ținta nu a putut fi schimbată. Sunteți managerul direct al angajatului?",
        );
      }
      return { id: data.id, employee_id: data.employee_id };
    }

    const { data, error } = await ctx.supabase
      .from("kpi_tinte_angajat")
      .insert({
        organization_id: ctx.tenant.organizationId,
        employee_id: input.employee_id,
        indicator_id: input.indicator_id,
        tinta: input.tinta,
        motiv: input.motiv,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id, employee_id")
      .maybeSingle<{ id: string; employee_id: string }>();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    if (data === null) throw businessRule("Ținta nu a putut fi pusă. Reîncărcați pagina.");
    return { id: data.id, employee_id: data.employee_id };
  },
});

export const stergeTintaKpi = createAction<
  typeof stergeTintaKpiSchema,
  Readonly<{ id: string; employee_id: string }>
>({
  name: "kpi_tinte_angajat.remove",
  feature: "evaluations",
  permission: "evaluations:update",
  minScope: "team",
  input: stergeTintaKpiSchema,
  audit: {
    action: "update",
    entityType: "kpi_tinte_angajat",
    entityId: (input) => input.id,
    allow: [],
  },
  revalidate: (_input, data) => [...CAI_KPI, `/angajati/${data.employee_id}`, "/portal/kpi-ul-meu"],
  handler: async (ctx, input) => {
    const { data, error } = await ctx.supabase
      .from("kpi_tinte_angajat")
      .update({ deleted_at: new Date().toISOString(), updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id, employee_id")
      .maybeSingle<{ id: string; employee_id: string }>();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    if (data === null) throw businessRule("Ținta nu mai există sau nu aveți dreptul s-o scoateți.");
    return { id: data.id, employee_id: data.employee_id };
  },
});

// ── Luna ──────────────────────────────────────────────────────────────────────

interface IndicatorPentruLuna {
  readonly id: string;
  readonly cod: string;
  readonly denumire: string;
  readonly tip: "masurat" | "apreciat";
  readonly unitate: string | null;
  readonly sens: "crestere" | "descrestere" | null;
  readonly tinta_implicita: number | null;
  readonly scala_max: number | null;
  readonly pondere: number;
  readonly ordine: number;
}

/**
 * Deschiderea lunii: instantaneul se ia ACUM, nu la finalizare.
 *
 * Liniile copiază definiția indicatorului și ținta efectivă (abaterea
 * angajatului, altfel implicita funcției). Din clipa asta, o editare a setului
 * nu mai atinge luna — vezi antetul migrării 0119.
 */
export const deschideLunaKpi = createAction<
  typeof deschideLunaKpiSchema,
  Readonly<{ id: string; employee_id: string }>
>({
  name: "kpi_evaluari_lunare.open",
  feature: "evaluations",
  permission: "evaluations:create",
  minScope: "team",
  input: deschideLunaKpiSchema,
  audit: {
    action: "create",
    entityType: "kpi_evaluari_lunare",
    entityId: (_input, data) => data.id,
    allow: ["employee_id", "an", "luna"],
  },
  revalidate: (_input, data) => caiLuna(data.id, data.employee_id),
  handler: async (ctx, input) => {
    const { data: angajat, error: eroareAngajat } = await ctx.supabase
      .from("employees")
      .select("id, functie")
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("id", input.employee_id)
      .is("deleted_at", null)
      .maybeSingle<{ id: string; functie: string | null }>();
    if (eroareAngajat !== null) throw mapPostgrestError(eroareAngajat, ctx.requestId);
    if (angajat === null) throw notFound("Angajatul nu mai există.");
    const functie = normalizeazaFunctie(angajat.functie);
    if (functie === null) {
      throw businessRule(
        "Angajatul nu are funcție scrisă în fișă, deci nu are set de indicatori. Completați-i funcția, apoi reveniți.",
      );
    }

    const { data: set, error: eroareSet } = await ctx.supabase
      .from("kpi_seturi")
      .select(
        `id, indicatori:kpi_indicatori(id, cod, denumire, tip, unitate, sens,
           tinta_implicita, scala_max, pondere, ordine)`,
      )
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("functie_norm", functie)
      .eq("activ", true)
      .is("deleted_at", null)
      .is("indicatori.deleted_at", null)
      .maybeSingle<{ id: string; indicatori: IndicatorPentruLuna[] | null }>();
    if (eroareSet !== null) throw mapPostgrestError(eroareSet, ctx.requestId);
    if (set === null) {
      throw businessRule("Funcția angajatului nu are încă un set de indicatori activ.");
    }
    const indicatori = set.indicatori ?? [];
    if (indicatori.length === 0) {
      throw businessRule("Setul funcției nu are niciun indicator. Completați-l întâi.");
    }

    const { data: abateri, error: eroareAbateri } = await ctx.supabase
      .from("kpi_tinte_angajat")
      .select("indicator_id, tinta")
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("employee_id", input.employee_id)
      .is("deleted_at", null)
      .returns<{ indicator_id: string; tinta: number }[]>();
    if (eroareAbateri !== null) throw mapPostgrestError(eroareAbateri, ctx.requestId);
    const abatereDupaIndicator = new Map((abateri ?? []).map((a) => [a.indicator_id, a.tinta]));

    const { data: luna, error: eroareLuna } = await ctx.supabase
      .from("kpi_evaluari_lunare")
      .insert({
        organization_id: ctx.tenant.organizationId,
        employee_id: input.employee_id,
        set_id: set.id,
        an: input.an,
        luna: input.luna,
        status: "draft" as const,
        evaluator_id: ctx.user.id,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id, employee_id")
      .maybeSingle<{ id: string; employee_id: string }>();
    if (eroareLuna !== null) {
      if (eroareLuna.code === "23505") {
        throw businessRule("Luna e deja deschisă pentru angajatul acesta.");
      }
      throw mapPostgrestError(eroareLuna, ctx.requestId);
    }
    if (luna === null) {
      throw businessRule("Luna nu a putut fi deschisă. Sunteți managerul direct al angajatului?");
    }

    const { error: eroareValori } = await ctx.supabase.from("kpi_valori").insert(
      [...indicatori]
        .sort((a, b) => a.ordine - b.ordine)
        .map((ind, i) => ({
          organization_id: ctx.tenant.organizationId,
          evaluare_id: luna.id,
          indicator_id: ind.id,
          cod: ind.cod,
          denumire: ind.denumire,
          tip: ind.tip,
          unitate: ind.unitate,
          sens: ind.sens,
          pondere: ind.pondere,
          scala_max: ind.scala_max,
          tinta:
            ind.tip === "masurat"
              ? tintaEfectiva(ind.tinta_implicita ?? 0, abatereDupaIndicator.get(ind.id) ?? null)
              : null,
          ordine: i,
          created_by: ctx.user.id,
          updated_by: ctx.user.id,
        })),
    );
    if (eroareValori !== null) {
      // O lună fără linii ar bloca indexul unic și ar arăta ca un formular gol
      // pe care nu-l poate repara nimeni. Se retrage, ca la crearea setului.
      await ctx.supabase
        .from("kpi_evaluari_lunare")
        .update({ deleted_at: new Date().toISOString(), updated_by: ctx.user.id })
        .eq("id", luna.id)
        .eq("organization_id", ctx.tenant.organizationId);
      throw mapPostgrestError(eroareValori, ctx.requestId);
    }

    return { id: luna.id, employee_id: luna.employee_id };
  },
});

/** Exact coloanele de care are nevoie calculul — fără `id`, care nu se citește. */
type LinieCalcul = Omit<ValoareExistenta, "id">;

interface ValoareExistenta {
  readonly id: string;
  readonly cod: string;
  readonly tip: "masurat" | "apreciat";
  readonly sens: "crestere" | "descrestere" | null;
  readonly pondere: number;
  readonly scala_max: number | null;
  readonly tinta: number | null;
  readonly realizat: number | null;
  readonly nota: number | null;
}

/** Citește luna și liniile ei, cu verificările comune celor două scrieri. */
async function citesteLunaDraft(
  ctx: ActionContext,
  id: string,
): Promise<Readonly<{ employee_id: string; valori: readonly ValoareExistenta[] }>> {
  const { data, error } = await ctx.supabase
    .from("kpi_evaluari_lunare")
    .select(
      `id, employee_id, status,
       valori:kpi_valori(id, cod, tip, sens, pondere, scala_max, tinta, realizat, nota)`,
    )
    .eq("id", id)
    .eq("organization_id", ctx.tenant.organizationId)
    .is("deleted_at", null)
    .is("valori.deleted_at", null)
    .maybeSingle<{
      id: string;
      employee_id: string;
      status: "draft" | "finalizat";
      valori: ValoareExistenta[] | null;
    }>();
  if (error !== null) throw mapPostgrestError(error, ctx.requestId);
  if (data === null) throw notFound("Luna nu mai există sau nu aveți acces la ea.");
  if (data.status === "finalizat") {
    throw businessRule("Luna e finalizată și nu se mai redeschide.");
  }
  return { employee_id: data.employee_id, valori: data.valori ?? [] };
}

/**
 * Salvarea liniilor lunii.
 *
 * ── DE CE SE RECITEȘTE ÎNAINTE DE A SCRIE SCORUL ──────────────────────────
 * Liniile se actualizează una câte una — nu există tranzacție peste apeluri
 * PostgREST. Dacă a treia pică, primele două rămân scrise. Scorul se calculează
 * deci din ce e EFECTIV în bază după scriere, nu din ce a trimis clientul:
 * altfel `scor_procent` ar fi putut afirma un total pe care liniile de sub el
 * nu-l susțin, iar cifra din portal ar fi mințit fără să pară stricată.
 */
export const salveazaLunaKpi = createAction<
  typeof salveazaLunaKpiSchema,
  Readonly<{ id: string; employee_id: string; procent: number | null }>
>({
  name: "kpi_evaluari_lunare.save",
  feature: "evaluations",
  permission: "evaluations:update",
  minScope: "team",
  input: salveazaLunaKpiSchema,
  audit: {
    action: "update",
    entityType: "kpi_evaluari_lunare",
    entityId: (input) => input.id,
    // Valorile în sine nu intră în jurnal — conținut de evaluare, ca
    // `raspunsuri` la evaluarea anuală.
    allow: [],
  },
  revalidate: (_input, data) => caiLuna(data.id, data.employee_id),
  handler: async (ctx, input) => {
    const { employee_id, valori } = await citesteLunaDraft(ctx, input.id);
    const dupaCod = new Map(valori.map((v) => [v.cod, v]));

    for (const trimisa of input.valori) {
      const rand = dupaCod.get(trimisa.cod);
      // Codurile necunoscute se ignoră: sunt resturi ale unui set schimbat
      // între deschiderea formularului și trimiterea lui, nu greșeli de om.
      if (rand === undefined) continue;

      const masurat = rand.tip === "masurat";
      const realizat = masurat ? trimisa.realizat : null;
      const nota = masurat ? null : trimisa.nota;

      // Nota peste scală ar fi lovit `kpi_valori_nota_in_scala` și ar fi ieșit
      // ca 23514 — „datele nu respectă regulile de validare", plus un cod de
      // referință. Adevărat, dar neacționabil. Se refuză aici, cu numele
      // liniei și scala ei. Aceeași alegere ca `noteInAfaraScalei` la
      // evaluarea anuală: la SCRIERE se raportează, nu se plafonează.
      if (nota !== null && rand.scala_max !== null && (nota < 0 || nota > rand.scala_max)) {
        throw businessRule(
          `Nota pentru „${rand.cod}" trebuie să fie între 0 și ${String(rand.scala_max)}.`,
        );
      }

      const procent = procentLinie({ ...rand, realizat, nota });

      const { error } = await ctx.supabase
        .from("kpi_valori")
        .update({
          realizat,
          nota,
          procent,
          comentariu: trimisa.comentariu,
          updated_by: ctx.user.id,
        })
        .eq("id", rand.id)
        .eq("organization_id", ctx.tenant.organizationId)
        .is("deleted_at", null);
      if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    }

    const { data: dupaScriere, error: eroareRecitire } = await ctx.supabase
      .from("kpi_valori")
      .select("cod, tip, sens, pondere, scala_max, tinta, realizat, nota")
      .eq("evaluare_id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .returns<LinieCalcul[]>();
    if (eroareRecitire !== null) throw mapPostgrestError(eroareRecitire, ctx.requestId);

    const scor = calculeazaScorLunar(dupaScriere ?? []);

    const { data, error } = await ctx.supabase
      .from("kpi_evaluari_lunare")
      .update({
        scor_procent: scor.procent,
        concluzie: input.concluzie,
        updated_by: ctx.user.id,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("status", "draft")
      .select("id")
      .maybeSingle<{ id: string }>();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    if (data === null) {
      throw businessRule(
        "Luna nu a fost salvată: fie a finalizat-o altcineva între timp, fie nu aveți dreptul. Reîncărcați pagina.",
      );
    }

    return { id: input.id, employee_id, procent: scor.procent };
  },
});

/**
 * Finalizarea. Nu există pereche: luna finalizată NU se redeschide.
 *
 * Politica de UPDATE din 0119 cere `status = 'draft'` în `USING`, deci un rând
 * finalizat nu mai trece de clauză — nici pentru `org_admin`, nici pentru
 * `super_admin`. Corectura se face înainte de semnătură, nu după.
 */
export const finalizeazaLunaKpi = createAction<
  typeof finalizeazaLunaKpiSchema,
  Readonly<{ id: string; employee_id: string }>
>({
  name: "kpi_evaluari_lunare.finalize",
  feature: "evaluations",
  permission: "evaluations:update",
  minScope: "team",
  input: finalizeazaLunaKpiSchema,
  audit: {
    action: "update",
    entityType: "kpi_evaluari_lunare",
    entityId: (input) => input.id,
    allow: [],
  },
  revalidate: (_input, data) => caiLuna(data.id, data.employee_id),
  handler: async (ctx, input) => {
    const { employee_id, valori } = await citesteLunaDraft(ctx, input.id);

    // O lună finalizată fără nicio valoare e o semnătură pe o foaie goală —
    // aceeași regulă ca la evaluarea anuală.
    if (calculeazaScorLunar(valori).completate === 0) {
      throw businessRule("Completați cel puțin o linie înainte de a închide luna.");
    }

    const { data, error } = await ctx.supabase
      .from("kpi_evaluari_lunare")
      .update({
        status: "finalizat" as const,
        finalizat_la: new Date().toISOString(),
        evaluator_id: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("status", "draft")
      .select("id")
      .maybeSingle<{ id: string }>();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    if (data === null) {
      throw businessRule(
        "Luna nu a fost închisă: fie a închis-o altcineva între timp, fie nu aveți dreptul. Reîncărcați pagina.",
      );
    }
    return { id: input.id, employee_id };
  },
});
