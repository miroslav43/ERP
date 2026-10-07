// src/app/(app)/mentenanta/actions.ts
"use server";

import { createAction } from "@/lib/actions/create-action";
import { businessRule, forbidden, notFound } from "@/lib/actions/errors";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { verificaContinuitate } from "@/domain/fleet/kilometraj";
import { STARI_DESCHISE_SESIZARE } from "@/domain/maintenance/sesizari";
import {
  actualizeazaEchipamentSchema,
  actualizeazaPlanSchema,
  autorizatieIscirNouaSchema,
  cautaEchipamentSchema,
  contorNouSchema,
  echipamentSchema,
  interventieNouaSchema,
  planNouSchema,
  rezolvaSesizareSchema,
  sesizareNouaSchema,
  trieazaSesizareSchema,
  type StatusSesizare,
  type UrgentaSesizare,
} from "@/schemas/maintenance";
import { z } from "zod";

import { tiparContine } from "@/lib/queries/cursor";

import { traduEroare } from "./erori";

// ── Sesizări ────────────────────────────────────────────────────────────

/**
 * Creează o sesizare de defecțiune. Fișa proprie a angajatului NU vine din
 * formular — s-ar putea trimite una străină — ci se rezolvă aici, cu
 * `createAdminSupabase()`, exact ca în `concedii/actions.ts`. Fără
 * `raportat_de_employee_id` scris explicit, politica SELECT (coloana de scope
 * e `raportat_de_employee_id`) ascunde rândul abia inserat, iar `.select("id")`
 * cade cu 42501 (verificat empiric — vezi capcane.md #28).
 *
 * ── ADMINISTRATORUL FĂRĂ FIȘĂ DE ANGAJAT ──────────────────────────────────
 * Un `org_admin` care nu e și angajat (patronul, contabilul extern cu drepturi
 * de administrare) primea „Contul dvs. nu este legat de o fișă de angajat" și
 * nu putea raporta NIMIC, deși administrează tot modulul. Politica din 0150
 * acceptă `raportat_de_employee_id = null` când apelantul are
 * `maintenance:create` pe `team` sau mai sus (ramura `p_employee is null` din
 * `app.ssm_acces`), iar politica SELECT lasă rândul vizibil celor cu `read ≥
 * team` — deci `.select("id")` trece. Pragul se verifică AICI, pe
 * `maintenance:update`/`team` (cine administrează modulul), nu pe `create`:
 * un `employee` are `create = all` din seed, dar fără fișă nu are ce raporta.
 */
export const creeazaSesizare = createAction({
  name: "maintenance.fault.create",
  feature: "maintenance",
  permission: "maintenance:create",
  minScope: "own",
  input: sesizareNouaSchema,
  audit: {
    action: "create",
    entityType: "fault_report",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: ["equipment_id", "descriere", "urgenta", "opreste_functionarea"],
  },
  revalidate: ["/mentenanta", "/mentenanta/sesizari"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
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

    let raportorId: string | null = fisa?.id ?? null;
    if (raportorId === null) {
      const permisiuni = await getPermissionMap(
        ctx.tenant.organizationId,
        ctx.tenant.role,
        ctx.tenant.memberId,
      );
      if (!can(permisiuni, "maintenance:update", "team")) {
        throw businessRule(
          "Contul dvs. nu este legat de o fișă de angajat activă în această organizație. Contactați administratorul.",
        );
      }
      raportorId = null;
    }

    const db = await createServerSupabase();
    // NU se trimit `status`/`raportat_la`/`rezolvat_la`/`intervention_id`: au
    // valori implicite sau sunt scrise de `fault_reports_guard`.
    const { data, error } = await db
      .from("fault_reports")
      .insert({
        organization_id: ctx.tenant.organizationId,
        equipment_id: input.equipment_id,
        raportat_de_employee_id: raportorId,
        descriere: input.descriere,
        urgenta: input.urgenta,
        opreste_functionarea: input.opreste_functionarea,
      })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);

    return { id: data.id };
  },
});

export interface EchipamentCautat {
  readonly id: string;
  readonly cod: string;
  readonly denumire: string;
  readonly locatie: string | null;
  /** Cea mai veche sesizare ÎNCĂ deschisă pe utilaj — avertismentul de duplicat din casetă. */
  readonly sesizare_deschisa: Readonly<{ id: string; numar: string }> | null;
}

type EchipamentBrut = Omit<EchipamentCautat, "sesizare_deschisa">;

/**
 * Atașează fiecărui echipament găsit sesizarea deschisă (dacă există), cu
 * clientul admin filtrat pe organizație — un `employee` nu poate citi
 * sesizările colegilor, dar trebuie să afle că „SZ-2026-0007 e deja deschisă
 * pe presa asta” înainte s-o raporteze a doua oară.
 */
async function cuSesizareaDeschisa(
  admin: ReturnType<typeof createAdminSupabase>,
  organizationId: string,
  randuri: readonly EchipamentBrut[],
): Promise<readonly EchipamentCautat[]> {
  if (randuri.length === 0) return [];
  const { data, error } = await admin
    .from("fault_reports")
    .select("id, numar, equipment_id")
    .eq("organization_id", organizationId)
    .in(
      "equipment_id",
      randuri.map((r) => r.id),
    )
    .is("deleted_at", null)
    .in("status", STARI_DESCHISE_SESIZARE)
    .order("raportat_la", { ascending: true });
  if (error !== null) throw error;

  const prima = new Map<string, Readonly<{ id: string; numar: string }>>();
  for (const s of data ?? []) {
    if (!prima.has(s.equipment_id)) prima.set(s.equipment_id, { id: s.id, numar: s.numar });
  }
  return randuri.map((r) => ({ ...r, sesizare_deschisa: prima.get(r.id) ?? null }));
}

/**
 * Căutarea de echipament pentru formularul de sesizare (și prefill din QR).
 *
 * `createAdminSupabase()` obligatoriu: un `employee` are `maintenance:read =
 * own`, iar `equipment` are coloana de scope `null` (rând de organizație) —
 * `app.ssm_acces` cere măcar `team` pe ramura `p_employee is null`. Fără
 * clientul admin, căutarea nu ar întoarce niciodată vreun rând pentru omul
 * care tocmai trebuie să raporteze o defecțiune (capcane.md #27).
 */
export const cautaEchipament = createAction({
  name: "maintenance.equipment.search",
  feature: "maintenance",
  permission: "maintenance:create",
  minScope: "own",
  input: cautaEchipamentSchema,
  audit: { action: "view", entityType: "equipment", allow: ["q"] },
  handler: async (ctx, input): Promise<readonly EchipamentCautat[]> => {
    const admin = createAdminSupabase();
    const termen = input.q.trim();

    // Prefill din QR: `?echipament=<uuid>` trimite id-ul direct, nu un termen
    // de căutat. Aceeași acțiune servește ambele cazuri — un id exact caută
    // exact rândul, altfel nu s-ar mai putea afișa cod/denumire ale unui
    // echipament pe care un `employee` nu are voie să-l citească direct.
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(termen)) {
      const { data, error } = await admin
        .from("equipment")
        .select("id, cod, denumire, locatie")
        .eq("organization_id", ctx.tenant.organizationId)
        .eq("id", termen)
        .is("deleted_at", null)
        .maybeSingle<EchipamentBrut>();
      if (error !== null) throw error;
      return cuSesizareaDeschisa(admin, ctx.tenant.organizationId, data === null ? [] : [data]);
    }

    // Virgula și parantezele sunt sintaxă în filtrul `or()` al PostgREST; `:`
    // și ghilimelele pot rupe și ele expresia — se curăță înainte de interpolare.
    const curatat = termen.replace(/[,()*:"]/gu, "");
    if (curatat.length < 2) return [];

    const { data, error } = await admin
      .from("equipment")
      .select("id, cod, denumire, locatie")
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .neq("status", "casat")
      .or(`cod.ilike.${tiparContine(curatat)},denumire.ilike.${tiparContine(curatat)}`)
      .limit(10)
      .returns<EchipamentBrut[]>();
    if (error !== null) throw error;

    return cuSesizareaDeschisa(admin, ctx.tenant.organizationId, data ?? []);
  },
});

export interface SesizareProprie {
  readonly id: string;
  readonly numar: string;
  readonly raportat_de_employee_id: string | null;
  readonly raportat_de_user_id: string | null;
  readonly atribuit_employee_id: string | null;
  readonly descriere: string;
  readonly urgenta: UrgentaSesizare;
  readonly status: StatusSesizare;
  readonly raportat_la: string;
  readonly opreste_functionarea: boolean;
  readonly rezolvat_la: string | null;
  readonly motiv_respingere: string | null;
  readonly echipament: Readonly<{ cod: string; denumire: string }> | null;
}

/**
 * Sesizările PROPRII, cu numele echipamentului atașat — pentru `<SesizarileMele/>`.
 *
 * Fără input real; `createAction` cere totuși o schemă. Apelată DIRECT dintr-un
 * Server Component (`await numeleEchipamentelorMele({})`), nu dintr-un
 * formular — de aceea NU are `revalidate`: `revalidatePath` în timpul
 * randării aruncă (capcane.md #34).
 *
 * Sesizările se citesc cu `ctx.supabase` (RLS le mărginește deja la propriile
 * rânduri, prin `raportat_de_employee_id`); numele echipamentelor NU pot fi
 * citite la fel — `equipment` are coloana de scope `null`, deci cere `team` —
 * așa că se citesc separat, cu clientul admin, filtrate explicit pe id-urile
 * deja obținute (nu poate enumera tot parcul de echipamente).
 */
export const numeleEchipamentelorMele = createAction({
  name: "maintenance.equipment.mine",
  feature: "maintenance",
  permission: "maintenance:read",
  minScope: "own",
  input: z.object({}),
  audit: { action: "view", entityType: "fault_report", allow: [] },
  handler: async (ctx): Promise<readonly SesizareProprie[]> => {
    const { data: proprii, error } = await ctx.supabase
      .from("fault_reports")
      // Un singur literal: concatenat, tipul devine `string` și PostgREST-js
      // pierde coloanele (`GenericStringError`).
      .select(
        "id, numar, equipment_id, raportat_de_employee_id, raportat_de_user_id, atribuit_employee_id, descriere, urgenta, status, raportat_la, opreste_functionarea, rezolvat_la, motiv_respingere",
      )
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .order("raportat_la", { ascending: false })
      .limit(100);
    if (error !== null) throw error;

    const randuri = proprii ?? [];
    const idUnice = [...new Set(randuri.map((r) => r.equipment_id))];

    let denumiri = new Map<string, Readonly<{ cod: string; denumire: string }>>();
    if (idUnice.length > 0) {
      const admin = createAdminSupabase();
      const { data: echipamente, error: eroareEchip } = await admin
        .from("equipment")
        .select("id, cod, denumire")
        .eq("organization_id", ctx.tenant.organizationId)
        .in("id", idUnice);
      if (eroareEchip !== null) throw eroareEchip;
      denumiri = new Map(
        (echipamente ?? []).map((e) => [e.id, { cod: e.cod, denumire: e.denumire }]),
      );
    }

    return randuri.map((r) => ({
      id: r.id,
      numar: r.numar,
      raportat_de_employee_id: r.raportat_de_employee_id,
      raportat_de_user_id: r.raportat_de_user_id,
      atribuit_employee_id: r.atribuit_employee_id,
      descriere: r.descriere,
      urgenta: r.urgenta,
      status: r.status,
      raportat_la: r.raportat_la,
      opreste_functionarea: r.opreste_functionarea,
      rezolvat_la: r.rezolvat_la,
      motiv_respingere: r.motiv_respingere,
      echipament: denumiri.get(r.equipment_id) ?? null,
    }));
  },
});

// ── Echipamente ──────────────────────────────────────────────────────────
//
// Poarta aplicației e "maintenance:update"/"team" — mai STRICTĂ decât cere
// baza. Politica INSERT a lui `equipment` (coloană de scope `null`) trece deja
// pentru `employee`/`manager`, care au `maintenance:create = all` din seed
// (rândul e gândit pentru sesizări). Fără poarta suplimentară de aici, orice
// angajat ar putea crea echipamente (capcane.md #35).

export const creeazaEchipament = createAction({
  name: "maintenance.equipment.create",
  feature: "maintenance",
  permission: "maintenance:update",
  minScope: "team",
  input: echipamentSchema,
  audit: {
    action: "create",
    entityType: "equipment",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: [
      "cod",
      "denumire",
      "serie",
      "producator",
      "model",
      "an_fabricatie",
      "locatie",
      "department_id",
      "responsabil_employee_id",
      "status",
      "este_iscir",
      "tip_autorizare_necesara",
      "data_punerii_in_functiune",
      "categorie",
      "punct_lucru_id",
      "garantie_expira",
      "parent_equipment_id",
      "marcaj_ce",
      "risc_specific",
      "folosit_in_afara_sediului",
    ],
  },
  revalidate: ["/mentenanta/echipamente", "/mentenanta"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    // `created_by`/`updated_by` NU se trimit: `equipment_actor` (trigger
    // `set_actor`, atașat pe toate cele 26 de tabele din 0011) le completează
    // din `auth.uid()`. `derogare_acordata_de`/`derogare_acordata_la` NU se
    // trimit: `equipment_iscir_guard` le calculează sau le golește singur.
    const { data, error } = await db
      .from("equipment")
      .insert({
        ...input,
        organization_id: ctx.tenant.organizationId,
      })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);

    return { id: data.id };
  },
});

export const actualizeazaEchipament = createAction({
  name: "maintenance.equipment.update",
  feature: "maintenance",
  permission: "maintenance:update",
  minScope: "team",
  input: actualizeazaEchipamentSchema,
  audit: {
    action: "update",
    entityType: "equipment",
    entityId: (input) => input.id,
    allow: [
      "id",
      "cod",
      "denumire",
      "serie",
      "producator",
      "model",
      "an_fabricatie",
      "locatie",
      "department_id",
      "responsabil_employee_id",
      "status",
      "este_iscir",
      "tip_autorizare_necesara",
      "data_punerii_in_functiune",
      "categorie",
      "punct_lucru_id",
      "garantie_expira",
      "parent_equipment_id",
      "marcaj_ce",
      "risc_specific",
      "folosit_in_afara_sediului",
    ],
  },
  revalidate: (input) => ["/mentenanta/echipamente", `/mentenanta/echipamente/${input.id}`],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { id, ...campuri } = input;

    const { data, error } = await db
      .from("equipment")
      .update(campuri)
      .eq("id", id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw notFound("Echipamentul nu a fost găsit sau nu vă este accesibil.");
    }

    return { id: data.id };
  },
});

// ── Contoare ────────────────────────────────────────────────────────────

/**
 * Poarta e `maintenance:read`/own din 0182: citirea o înregistrează gestionarul
 * SAU responsabilul echipamentului (din portal, „echipamentele în grija mea”),
 * iar cine poate pe ce utilaj decide politica de INSERT — care NU mai trece
 * prin `create = all` al angajaților. Un străin primește 42501, tradus.
 */
export const inregistreazaContor = createAction({
  name: "maintenance.meter.create",
  feature: "maintenance",
  permission: "maintenance:read",
  minScope: "own",
  input: contorNouSchema,
  audit: {
    action: "create",
    entityType: "equipment_meter",
    // Adnotare EXACTĂ pe `data` (include `avertismentSalt`): o adnotare mai
    // îngustă aici ar fixa `TData` înaintea lui `handler` (proprietate
    // ulterioară în literal) și ar pierde tăcut câmpul din tipul exportat —
    // exact ce s-a întâmplat o dată, prins abia la apelul din formular.
    entityId: (_input, data: Readonly<{ id: string; avertismentSalt: string | null }>) => data.id,
    allow: ["equipment_id", "tip", "citire", "data_citirii", "resetare_contor", "sursa"],
  },
  revalidate: (input) => [
    `/mentenanta/echipamente/${input.equipment_id}`,
    "/mentenanta",
    "/mentenanta/contoare",
    "/portal/sesizari",
  ],
  handler: async (
    ctx,
    input,
  ): Promise<Readonly<{ id: string; avertismentSalt: string | null }>> => {
    const db = await createServerSupabase();

    // Resetarea contorului mută țintele planurilor pe contor — adică editează
    // planuri. O face doar cine administrează mentenanța; responsabilul
    // utilajului (din portal) înregistrează citiri obișnuite. Politica de
    // INSERT refuză oricum (42501); aici omul primește motivul.
    if (input.resetare_contor) {
      const permisiuni = await getPermissionMap(
        ctx.tenant.organizationId,
        ctx.tenant.role,
        ctx.tenant.memberId,
      );
      if (!can(permisiuni, "maintenance:update", "team")) {
        throw forbidden(
          "Resetarea contorului o înregistrează responsabilul de mentenanță, nu responsabilul utilajului. Înregistrați o citire obișnuită.",
        );
      }
    }

    // Pre-verificare, replicată din trigger-ul `ssm_meter_guard`, pentru
    // feedback imediat — decizia finală rămâne oricum a bazei de date.
    const { data: precedenta, error: eroarePrec } = await db
      .from("equipment_meters")
      .select("citire")
      .eq("equipment_id", input.equipment_id)
      .eq("tip", input.tip)
      .is("deleted_at", null)
      .order("data_citirii", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (eroarePrec !== null) throw eroarePrec;

    let avertismentSalt: string | null = null;
    const ultimaCitire = precedenta?.citire ?? null;
    if (ultimaCitire !== null) {
      const continuitate = verificaContinuitate(ultimaCitire, input.citire, null);
      if (continuitate === "regres" && !input.resetare_contor) {
        throw businessRule(
          `Citirea (${String(input.citire)}) este mai mică decât ultima citire înregistrată (${String(ultimaCitire)}). Corectați valoarea sau bifați „Resetare contor”.`,
        );
      }
      if (continuitate === "salt") {
        avertismentSalt = `Citirea (${String(input.citire)}) este cu mult peste ultima citire cunoscută (${String(ultimaCitire)}). Contorul a fost înregistrat — verificați dacă valoarea e corectă.`;
      }
    }

    const { data, error } = await db
      .from("equipment_meters")
      .insert({
        ...input,
        organization_id: ctx.tenant.organizationId,
      })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);

    return { id: data.id, avertismentSalt };
  },
});

// ── Planuri de mentenanță ──────────────────────────────────────────────────

export const creeazaPlan = createAction({
  name: "maintenance.plan.create",
  feature: "maintenance",
  permission: "maintenance:update",
  minScope: "team",
  input: planNouSchema,
  audit: {
    action: "create",
    entityType: "maintenance_plan",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: [
      "equipment_id",
      "denumire",
      "tip",
      "periodicitate_zile",
      "periodicitate_contor",
      "tip_contor",
      "responsabil_employee_id",
      "activ",
    ],
  },
  revalidate: (input) => [
    `/mentenanta/echipamente/${input.equipment_id}`,
    "/mentenanta/planuri",
    "/mentenanta",
  ],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    // `urmatoarea_scadenta`/`urmatoarea_scadenta_contor` NU se trimit:
    // `maintenance_plans_calc` le recalculează necondiționat la fiecare
    // insert și update.
    const { data, error } = await db
      .from("maintenance_plans")
      .insert({
        ...input,
        organization_id: ctx.tenant.organizationId,
      })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);

    return { id: data.id };
  },
});

export const actualizeazaPlan = createAction({
  name: "maintenance.plan.update",
  feature: "maintenance",
  permission: "maintenance:update",
  minScope: "team",
  input: actualizeazaPlanSchema,
  audit: {
    action: "update",
    entityType: "maintenance_plan",
    entityId: (input) => input.id,
    allow: [
      "id",
      "denumire",
      "tip",
      "periodicitate_zile",
      "periodicitate_contor",
      "tip_contor",
      "responsabil_employee_id",
      "activ",
    ],
  },
  revalidate: (input) => [
    `/mentenanta/echipamente/${input.equipment_id}`,
    "/mentenanta/planuri",
    "/mentenanta",
  ],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { id, ...campuri } = input;

    const { data, error } = await db
      .from("maintenance_plans")
      .update(campuri)
      .eq("id", id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw notFound("Planul de mentenanță nu a fost găsit sau nu vă este accesibil.");
    }

    return { id: data.id };
  },
});

// ── Intervenții ──────────────────────────────────────────────────────────

export const inregistreazaInterventie = createAction({
  name: "maintenance.intervention.create",
  feature: "maintenance",
  permission: "maintenance:update",
  minScope: "team",
  input: interventieNouaSchema,
  audit: {
    action: "create",
    entityType: "maintenance_intervention",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: [
      "plan_id",
      "equipment_id",
      "tip",
      "data",
      "durata_ore",
      "executant_employee_id",
      "cost_piese",
      "cost_manopera",
      "rezultat",
    ],
  },
  revalidate: (input) => [
    `/mentenanta/echipamente/${input.equipment_id}`,
    "/mentenanta/interventii",
    "/mentenanta/planuri",
    "/mentenanta",
  ],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    // `cost_total` NU se trimite: e GENERATED ALWAYS. Nu se actualizează planul
    // de mână — `maintenance_interventions_apply` (AFTER) îi scrie
    // `ultima_executie`/`ultima_citire_contor` când `rezultat = 'reusita'`.
    const { data, error } = await db
      .from("maintenance_interventions")
      .insert({
        ...input,
        organization_id: ctx.tenant.organizationId,
      })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);

    return { id: data.id };
  },
});

// ── Sesizări: triaj și rezolvare ────────────────────────────────────────

/**
 * Triajul: în analiză, în lucru, în așteptare, respins. Poarta e
 * `maintenance:update`/team — tehnicianul atribuit își trece sesizarea în lucru
 * prin `sesizari/actions.ts` (`incepeLucrul`), pe drepturile lui nominale.
 *
 * Tranzițiile le judecă `internal.fault_reports_garda` (0181): „în lucru” cere
 * tehnician atribuit, „respins” cere motiv și tipul lui, iar din stările
 * terminale nu se iese. Filtrul `.in("status", deschise)` rămâne pe UPDATE, nu
 * într-o citire prealabilă, ca să țină și la doi operatori simultani.
 */
export const trieazaSesizare = createAction({
  name: "maintenance.fault.triage",
  feature: "maintenance",
  permission: "maintenance:update",
  minScope: "team",
  input: trieazaSesizareSchema,
  audit: {
    action: "update",
    entityType: "fault_report",
    entityId: (input) => input.id,
    allow: ["id", "status", "motiv_respingere", "motiv_respingere_tip", "duplicat_al_id"],
  },
  revalidate: (input) => [
    "/mentenanta/sesizari",
    `/mentenanta/sesizari/${input.id}`,
    "/mentenanta",
  ],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const respinge = input.status === "respins";
    const { data, error } = await db
      .from("fault_reports")
      .update({
        status: input.status,
        motiv_respingere: respinge ? input.motiv_respingere : null,
        motiv_respingere_tip: respinge ? (input.motiv_respingere_tip ?? "altul") : null,
        duplicat_al_id: respinge ? input.duplicat_al_id : null,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .in("status", STARI_DESCHISE_SESIZARE)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw notFound(
        "Sesizarea nu a fost găsită, nu vă este accesibilă sau a fost deja închisă (rezolvată, respinsă ori retrasă).",
      );
    }

    return { id: data.id };
  },
});

/**
 * Rezolvarea unei sesizări: creează întâi intervenția care a rezolvat-o, apoi
 * marchează sesizarea rezolvată cu `intervention_id`-ul ei. Garda din bază
 * refuză `status = 'rezolvat'` fără intervenție — ordinea contează, nu doar
 * stilistic.
 *
 * ── CINE O CHEAMĂ ─────────────────────────────────────────────────────────
 * Gestionarul, pe orice sesizare deschisă; dar ȘI tehnicianul atribuit, pe a
 * lui — de aceea poarta e `maintenance:read`/own, nu `update`: politica de
 * INSERT pe intervenții are ramura „sesizarea e atribuită mie”, iar garda
 * sesizării îi dă tehnicianului câmpurile `status`, `intervention_id`,
 * `nota_rezolvare`. Un străin trece de poartă și e refuzat de bază cu 42501
 * sau P0001 — tradus, nu ascuns.
 *
 * ── OPRIREA SE ÎNCHIDE ───────────────────────────────────────────────────
 * Triggerul `fault_reports_oprire` închide oprirea la `rezolvat_la`;
 * `repus_in_functiune_la` o mută la momentul REAL în care utilajul a mers din
 * nou (poate fi înainte de completarea formularului).
 */
export const rezolvaSesizare = createAction({
  name: "maintenance.fault.resolve",
  feature: "maintenance",
  permission: "maintenance:read",
  minScope: "own",
  input: rezolvaSesizareSchema,
  audit: {
    action: "update",
    entityType: "fault_report",
    entityId: (input) => input.id,
    allow: ["id", "tip", "data", "durata_ore", "cost_piese", "cost_manopera", "rezultat"],
  },
  revalidate: (input) => [
    "/mentenanta/sesizari",
    `/mentenanta/sesizari/${input.id}`,
    "/mentenanta/interventii",
    "/mentenanta",
    "/portal/sesizari",
    `/portal/sesizari/${input.id}`,
  ],
  handler: async (ctx, input): Promise<Readonly<{ id: string; interventionId: string }>> => {
    const db = await createServerSupabase();

    const { data: sesizare, error: eroareSesizare } = await db
      .from("fault_reports")
      .select("id, equipment_id, status")
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareSesizare !== null) throw eroareSesizare;
    if (sesizare === null) {
      throw notFound("Sesizarea nu a fost găsită sau nu vă este accesibilă.");
    }
    if (!STARI_DESCHISE_SESIZARE.includes(sesizare.status)) {
      throw businessRule(
        "Această sesizare nu mai e deschisă: a fost rezolvată, respinsă sau retrasă.",
      );
    }
    // „Rezolvat” pleacă DOAR din „în lucru” (mașina de stări). Verificat aici,
    // înainte de a insera intervenția: altfel garda ar refuza UPDATE-ul, iar
    // pentru tehnician compensarea de mai jos n-ar putea anula intervenția
    // (politica de UPDATE pe intervenții cere `update ≥ team`) — ar rămâne o
    // intervenție orfană, cu costuri, în registru.
    if (sesizare.status !== "in_lucru") {
      throw businessRule(
        "Sesizarea trebuie să fie „În lucru” ca să fie rezolvată. Treceți-o întâi în lucru (sau atribuiți-o), apoi înregistrați intervenția.",
      );
    }

    const {
      id: sesizareId,
      repus_in_functiune_la: repusLa,
      nota_rezolvare: notaRezolvare,
      ...campuriInterventie
    } = input;

    const { data: interventie, error: eroareInterventie } = await db
      .from("maintenance_interventions")
      .insert({
        ...campuriInterventie,
        plan_id: null,
        equipment_id: sesizare.equipment_id,
        fault_report_id: sesizareId,
        organization_id: ctx.tenant.organizationId,
      })
      .select("id")
      .single();
    if (eroareInterventie !== null) traduEroare(eroareInterventie);

    // `rezolvat_la` NU se trimite: garda îl completează singură.
    //
    // UPDATE-ul e CONDIȚIONAT pe starea deschisă: doi operatori care rezolvă
    // simultan aceeași sesizare treceau amândoi de citirea de mai sus, inserau
    // câte o intervenție (cu costuri), iar ultimul câștiga `intervention_id`,
    // fără nicio eroare. Acum doar unul câștigă; celălalt primește zero rânduri.
    const { data, error } = await db
      .from("fault_reports")
      .update({
        status: "rezolvat",
        intervention_id: interventie.id,
        nota_rezolvare: notaRezolvare,
      })
      .eq("id", sesizareId)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .eq("status", "in_lucru")
      .select("id")
      .maybeSingle();
    if (error !== null || data === null) {
      // Compensare: intervenția abia inserată nu rezolvă nimic, deci se anulează
      // logic (DELETE e revocat pe tabelă; `maintenance_interventions_apply`
      // ignoră rândurile cu `deleted_at`). Eroarea anulării nu o ascunde pe cea
      // originală. Zero rânduri la anulare (tehnicianul n-are UPDATE pe
      // intervenții) se jurnalizează: e cazul de curățat de mână.
      const { data: anulate } = await db
        .from("maintenance_interventions")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", interventie.id)
        .eq("organization_id", ctx.tenant.organizationId)
        .select("id");
      if ((anulate ?? []).length === 0) {
        console.warn(
          `[rezolvaSesizare] intervenția ${interventie.id} nu a putut fi anulată după cursa pierdută pe sesizarea ${sesizareId}`,
        );
      }
      if (error !== null) traduEroare(error);
      throw businessRule(
        "Sesizarea a fost închisă între timp de altcineva (sau nu mai e accesibilă). Intervenția nu a fost înregistrată. Reîncărcați pagina.",
      );
    }

    // Momentul real al repunerii în funcțiune, dacă utilajul a stat. Triggerul
    // a închis deja oprirea la `rezolvat_la`; aici se corectează la ce a spus
    // omul. Eșecul nu anulează rezolvarea: oprirea rămâne închisă la rezolvat_la.
    if (repusLa !== null) {
      const { data: opriri, error: eroareOprire } = await db
        .from("equipment_opriri")
        .update({ sfarsit: repusLa })
        .eq("organization_id", ctx.tenant.organizationId)
        .eq("fault_report_id", sesizareId)
        .is("deleted_at", null)
        .gte("sfarsit", repusLa)
        .select("id");
      if (eroareOprire !== null) {
        console.warn(`[rezolvaSesizare] oprirea nu s-a putut corecta: ${eroareOprire.message}`);
      } else if ((opriri ?? []).length === 0) {
        console.warn(
          `[rezolvaSesizare] nicio oprire de corectat pe sesizarea ${sesizareId} (zero rânduri)`,
        );
      }
    }

    return { id: data.id, interventionId: interventie.id };
  },
});

// ── Autorizații ISCIR ──────────────────────────────────────────────────────

export const adaugaAutorizatieIscir = createAction({
  name: "maintenance.iscir.create",
  feature: "maintenance",
  permission: "maintenance:update",
  minScope: "team",
  input: autorizatieIscirNouaSchema,
  audit: {
    action: "create",
    entityType: "iscir_authorization",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: ["equipment_id", "numar", "tip", "emitent", "emis_la", "valabil_pana"],
  },
  // Și panoul: afișează autorizațiile care expiră, deci o autorizație nouă
  // (sau reînnoită) trebuie să-i schimbe lista.
  revalidate: (input) => [`/mentenanta/echipamente/${input.equipment_id}`, "/mentenanta"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("iscir_authorizations")
      .insert({
        ...input,
        organization_id: ctx.tenant.organizationId,
      })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);

    return { id: data.id };
  },
});
