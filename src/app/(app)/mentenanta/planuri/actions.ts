// src/app/(app)/mentenanta/planuri/actions.ts
"use server";

import { createAction } from "@/lib/actions/create-action";
import { notFound } from "@/lib/actions/errors";
import { createServerSupabase } from "@/lib/supabase/server";
import { amanaPlanSchema, comutaPlanActivSchema, stergePlanSchema } from "@/schemas/maintenance";

import { traduEroare } from "../erori";

// Gesturile de pe planul de mentenanță (0183): amânarea, activarea /
// dezactivarea, ștergerea logică. Crearea și editarea rămân în `../actions.ts`.
// Toate pe `maintenance:update`/team, cu `.select()` după UPDATE: zero rânduri
// = plan dispărut sau inaccesibil (capcana #17). `ssm_plan_calc` recalculează
// scadența doar din intrările lui — aici se scriu exact ele.

// `revalidate` primește și DATELE întoarse de handler, nu doar intrarea: fișa
// echipamentului listează planurile, iar `equipment_id` îl știe abia handlerul.
// Memoria „revalidate fixează tipul”: adnotarea de aici decide `TData`, deci
// `data` e tipat exact pe ce întoarce handlerul.
const CAI_PLAN = (id: string, data: Readonly<{ equipment_id: string }>): readonly string[] => [
  "/mentenanta",
  "/mentenanta/planuri",
  `/mentenanta/planuri/${id}`,
  `/mentenanta/echipamente/${data.equipment_id}`,
];

/**
 * Amânarea: scadența devine `greatest(calc, amanat_pana)`, iar contorul de
 * amânări crește (garda). O execuție reușită o șterge. Nu se poate amâna un
 * plan doar pe contor — baza refuză cu P0001, tradus.
 */
export const amanaPlan = createAction({
  name: "maintenance.plan.postpone",
  feature: "maintenance",
  permission: "maintenance:update",
  minScope: "team",
  input: amanaPlanSchema,
  audit: {
    action: "update",
    entityType: "maintenance_plan",
    entityId: (input) => input.id,
    allow: ["id", "amanat_pana"],
  },
  revalidate: (input, data: Readonly<{ id: string; equipment_id: string }>) =>
    CAI_PLAN(input.id, data),
  handler: async (ctx, input): Promise<Readonly<{ id: string; equipment_id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("maintenance_plans")
      .update({ amanat_pana: input.amanat_pana, motiv_amanare: input.motiv_amanare })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id, equipment_id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) throw notFound("Planul nu a fost găsit sau nu vă este accesibil.");
    return { id: data.id, equipment_id: data.equipment_id };
  },
});

/** Activ ↔ inactiv: planul inactiv dispare din scadențe și din alertele zilnice, dar rămâne pe fișă. */
export const comutaPlanActiv = createAction({
  name: "maintenance.plan.toggle",
  feature: "maintenance",
  permission: "maintenance:update",
  minScope: "team",
  input: comutaPlanActivSchema,
  audit: {
    action: "update",
    entityType: "maintenance_plan",
    entityId: (input) => input.id,
    allow: ["id", "activ"],
  },
  revalidate: (input, data: Readonly<{ id: string; equipment_id: string; activ: boolean }>) =>
    CAI_PLAN(input.id, data),
  handler: async (
    ctx,
    input,
  ): Promise<Readonly<{ id: string; equipment_id: string; activ: boolean }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("maintenance_plans")
      .update({ activ: input.activ })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .neq("activ", input.activ)
      .select("id, equipment_id, activ")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw notFound("Planul nu a fost găsit, nu vă este accesibil sau e deja în starea aleasă.");
    }
    return { id: data.id, equipment_id: data.equipment_id, activ: data.activ };
  },
});

/**
 * Ștergerea logică. Intervențiile legate rămân în registru cu `plan_id`-ul lor
 * (istoric); planul nu mai apare nicăieri și iese din scadențe
 * (`maintenance_plan_exp` cu `deleted_at`).
 */
export const stergePlan = createAction({
  name: "maintenance.plan.delete",
  feature: "maintenance",
  permission: "maintenance:update",
  minScope: "team",
  input: stergePlanSchema,
  audit: {
    action: "delete",
    entityType: "maintenance_plan",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: (input, data: Readonly<{ id: string; equipment_id: string }>) =>
    CAI_PLAN(input.id, data),
  handler: async (ctx, input): Promise<Readonly<{ id: string; equipment_id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("maintenance_plans")
      .update({ deleted_at: new Date().toISOString(), activ: false })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id, equipment_id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) throw notFound("Planul nu a fost găsit sau e deja șters.");
    return { id: data.id, equipment_id: data.equipment_id };
  },
});
