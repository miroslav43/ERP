// src/app/(app)/mentenanta/interventii/actions.ts
"use server";

import { createAction } from "@/lib/actions/create-action";
import { notFound } from "@/lib/actions/errors";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  actualizeazaInterventieSchema,
  anuleazaInterventieSchema,
  piesaNouaSchema,
  stergePiesaSchema,
} from "@/schemas/maintenance";

import { traduEroare } from "../erori";

// Gesturile de pe intervenție (0192): corectarea, anularea, liniile de piese.
// Înregistrarea rămâne în `../actions.ts` (`inregistreazaInterventie`), unde o
// cheamă fișa echipamentului, „Execută” de pe plan și caseta listei.
//
// Toate pe `maintenance:update`/team — aceeași poartă ca politica de UPDATE a
// intervențiilor —, cu `.select()` după UPDATE: zero rânduri = intervenție
// anulată între timp sau inaccesibilă (capcana #17). Ce NU se poate face o
// spune garda din bază (P0001, tradus): anularea intervenției care a rezolvat o
// sesizare, schimbarea echipamentului, reactivarea.

type InterventieAtinsa = Readonly<{
  id: string;
  equipment_id: string;
  plan_id: string | null;
}>;

/**
 * Căile pe care le schimbă o intervenție: lista, fișa ei, PV-ul tipărit, fișa
 * echipamentului, planul (scadența se mută) și panoul. Datele vin din
 * `.select()`-ul handlerului — memoria „revalidate fixează tipul”: adnotarea
 * de pe `revalidate` decide `TData`.
 */
const CAI_INTERVENTIE = (d: InterventieAtinsa): readonly string[] => [
  "/mentenanta",
  "/mentenanta/interventii",
  `/mentenanta/interventii/${d.id}`,
  `/mentenanta/interventii/${d.id}/proces-verbal`,
  `/mentenanta/echipamente/${d.equipment_id}`,
  "/mentenanta/planuri",
  ...(d.plan_id === null ? [] : [`/mentenanta/planuri/${d.plan_id}`]),
];

/**
 * Corectarea unei intervenții. Planul, echipamentul și sesizarea NU se schimbă
 * de aici (schema nu le are, garda le refuză). Cât intervenția are linii de
 * piese, `cost_piese` trimis e ignorat: îl rescrie garda din linii (cazul 32).
 * O dată sau o citire corectată mută planul (`ssm_intervention_apply`, 0192).
 */
export const actualizeazaInterventie = createAction({
  name: "maintenance.intervention.update",
  feature: "maintenance",
  permission: "maintenance:update",
  minScope: "team",
  input: actualizeazaInterventieSchema,
  audit: {
    action: "update",
    entityType: "maintenance_intervention",
    entityId: (input) => input.id,
    allow: [
      "id",
      "tip",
      "data",
      "durata_ore",
      "executant_employee_id",
      "cost_piese",
      "cost_manopera",
      "rezultat",
      "garantie_lucrare_pana",
      "acoperit_de_garantie",
    ],
  },
  revalidate: (_input, data: InterventieAtinsa) => CAI_INTERVENTIE(data),
  handler: async (ctx, input): Promise<InterventieAtinsa> => {
    const { id, ...campuri } = input;
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("maintenance_interventions")
      .update(campuri)
      .eq("id", id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id, equipment_id, plan_id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw notFound("Intervenția nu a fost găsită, a fost anulată sau nu vă este accesibilă.");
    }
    return data;
  },
});

/**
 * Anularea (ștergere logică). Planul revine la intervenția reușită anterioară
 * (0180), oprirea planificată iese din jurnal (0181), iar intervenția care a
 * rezolvat o sesizare se anulează doar după redeschiderea ei (0192, cazul 31).
 * Rândul din registru (`pv_interventie`) rămâne: registrul e append-only.
 */
export const anuleazaInterventie = createAction({
  name: "maintenance.intervention.cancel",
  feature: "maintenance",
  permission: "maintenance:update",
  minScope: "team",
  input: anuleazaInterventieSchema,
  audit: {
    action: "delete",
    entityType: "maintenance_intervention",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: (_input, data: InterventieAtinsa) => CAI_INTERVENTIE(data),
  handler: async (ctx, input): Promise<InterventieAtinsa> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("maintenance_interventions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id, equipment_id, plan_id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw notFound("Intervenția nu a fost găsită sau a fost deja anulată.");
    }
    return data;
  },
});

/**
 * O linie de piese. `valoare` e GENERATĂ (cantitate × preț), iar `cost_piese`
 * al intervenției îl rescrie triggerul din liniile vii — acțiunea nu-l atinge.
 * Pe o intervenție anulată, garda refuză cu P0001.
 */
export const adaugaPiesa = createAction({
  name: "maintenance.intervention.part.create",
  feature: "maintenance",
  permission: "maintenance:update",
  minScope: "team",
  input: piesaNouaSchema,
  audit: {
    action: "create",
    entityType: "maintenance_intervention_part",
    entityId: (_input, data: Readonly<{ id: string; intervention_id: string }>) => data.id,
    allow: ["intervention_id", "denumire", "cod", "cantitate", "unitate", "pret_unitar"],
  },
  revalidate: (input) => [
    "/mentenanta/interventii",
    `/mentenanta/interventii/${input.intervention_id}`,
    `/mentenanta/interventii/${input.intervention_id}/proces-verbal`,
  ],
  handler: async (ctx, input): Promise<Readonly<{ id: string; intervention_id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("maintenance_intervention_parts")
      .insert({
        organization_id: ctx.tenant.organizationId,
        intervention_id: input.intervention_id,
        denumire: input.denumire,
        cod: input.cod,
        cantitate: input.cantitate,
        unitate: input.unitate,
        pret_unitar: input.pret_unitar,
      })
      .select("id, intervention_id")
      .single();
    if (error !== null) traduEroare(error);
    return data;
  },
});

/** Ștergerea logică a unei linii; fără nicio linie vie, `cost_piese` devine 0. */
export const stergePiesa = createAction({
  name: "maintenance.intervention.part.delete",
  feature: "maintenance",
  permission: "maintenance:update",
  minScope: "team",
  input: stergePiesaSchema,
  audit: {
    action: "delete",
    entityType: "maintenance_intervention_part",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: (_input, data: Readonly<{ id: string; intervention_id: string }>) => [
    "/mentenanta/interventii",
    `/mentenanta/interventii/${data.intervention_id}`,
    `/mentenanta/interventii/${data.intervention_id}/proces-verbal`,
  ],
  handler: async (ctx, input): Promise<Readonly<{ id: string; intervention_id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("maintenance_intervention_parts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id, intervention_id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw notFound("Piesa nu a fost găsită sau a fost deja ștearsă.");
    }
    return data;
  },
});
