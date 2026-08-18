// src/app/(app)/mentenanta/actions.ts
"use server";

import { createAction } from "@/lib/actions/create-action";
import { businessRule, notFound } from "@/lib/actions/errors";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { verificaContinuitate } from "@/domain/fleet/kilometraj";
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

import { traduEroare } from "./erori";

// ── Sesizări ────────────────────────────────────────────────────────────

/**
 * Creează o sesizare de defecțiune. Fișa proprie a angajatului NU vine din
 * formular — s-ar putea trimite una străină — ci se rezolvă aici, cu
 * `createAdminSupabase()`, exact ca în `concedii/actions.ts`. Fără
 * `raportat_de_employee_id` scris explicit, politica SELECT (coloana de scope
 * e `raportat_de_employee_id`) ascunde rândul abia inserat, iar `.select("id")`
 * cade cu 42501 (verificat empiric — vezi capcane.md #28).
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
    if (fisa === null) {
      throw businessRule(
        "Contul dvs. nu este legat de o fișă de angajat activă în această organizație. Contactați administratorul.",
      );
    }

    const db = await createServerSupabase();
    // NU se trimit `status`/`raportat_la`/`rezolvat_la`/`intervention_id`: au
    // valori implicite sau sunt scrise de `fault_reports_guard`.
    const { data, error } = await db
      .from("fault_reports")
      .insert({
        organization_id: ctx.tenant.organizationId,
        equipment_id: input.equipment_id,
        raportat_de_employee_id: fisa.id,
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
        .maybeSingle<EchipamentCautat>();
      if (error !== null) throw error;
      return data === null ? [] : [data];
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
      .or(`cod.ilike.%${curatat}%,denumire.ilike.%${curatat}%`)
      .limit(10)
      .returns<EchipamentCautat[]>();
    if (error !== null) throw error;

    return data ?? [];
  },
});

export interface SesizareProprie {
  readonly id: string;
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
      .select(
        "id, equipment_id, descriere, urgenta, status, raportat_la, opreste_functionarea, rezolvat_la, motiv_respingere",
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
      denumiri = new Map((echipamente ?? []).map((e) => [e.id, { cod: e.cod, denumire: e.denumire }]));
    }

    return randuri.map((r) => ({
      id: r.id,
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

export const inregistreazaContor = createAction({
  name: "maintenance.meter.create",
  feature: "maintenance",
  permission: "maintenance:update",
  minScope: "team",
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
  revalidate: (input) => [`/mentenanta/echipamente/${input.equipment_id}`, "/mentenanta"],
  handler: async (
    ctx,
    input,
  ): Promise<Readonly<{ id: string; avertismentSalt: string | null }>> => {
    const db = await createServerSupabase();

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
    allow: ["id", "status", "motiv_respingere"],
  },
  revalidate: (input) => ["/mentenanta/sesizari", `/mentenanta/sesizari/${input.id}`, "/mentenanta"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("fault_reports")
      .update({
        status: input.status,
        motiv_respingere: input.status === "respins" ? input.motiv_respingere : null,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw notFound("Sesizarea nu a fost găsită sau nu vă este accesibilă.");
    }

    return { id: data.id };
  },
});

/**
 * Rezolvarea unei sesizări: creează întâi intervenția care a rezolvat-o, apoi
 * marchează sesizarea rezolvată cu `intervention_id`-ul ei. Garda din bază
 * (`fault_reports_guard`) refuză `status = 'rezolvat'` fără intervenție —
 * ordinea contează, nu doar stilistic.
 */
export const rezolvaSesizare = createAction({
  name: "maintenance.fault.resolve",
  feature: "maintenance",
  permission: "maintenance:update",
  minScope: "team",
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
    if (sesizare.status === "rezolvat") {
      throw businessRule("Această sesizare a fost deja rezolvată.");
    }

    const { id: sesizareId, ...campuriInterventie } = input;

    const { data: interventie, error: eroareInterventie } = await db
      .from("maintenance_interventions")
      .insert({
        ...campuriInterventie,
        plan_id: null,
        equipment_id: sesizare.equipment_id,
        organization_id: ctx.tenant.organizationId,
      })
      .select("id")
      .single();
    if (eroareInterventie !== null) traduEroare(eroareInterventie);

    // `rezolvat_la` NU se trimite: `fault_reports_guard` îl completează singur.
    const { data, error } = await db
      .from("fault_reports")
      .update({ status: "rezolvat", intervention_id: interventie.id })
      .eq("id", sesizareId)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw notFound("Sesizarea nu a fost găsită sau nu vă este accesibilă.");
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
  revalidate: (input) => [`/mentenanta/echipamente/${input.equipment_id}`],
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
