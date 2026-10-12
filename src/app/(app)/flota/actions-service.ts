// src/app/(app)/flota/actions-service.ts
"use server";

/**
 * Service, cheltuieli și anvelope pe vehicul (0200): planurile de service,
 * intervențiile făcute și cheltuielile care nu sunt pe foaie.
 *
 * „use server”: se exportă DOAR funcții async (capcana 39).
 *
 * ── POARTA ───────────────────────────────────────────────────────────────────
 * Toate cele șase scrieri cer `vehicles:update = all`, literal ca politicile
 * `vsp_*` / `vse_*` / `vex_*`: o poartă mai largă ar lăsa un rol să apese butonul
 * și să cadă tăcut pe `WITH CHECK`, cu zero rânduri și mesaj de reușită.
 *
 * ── CE FACE BAZA, NU ACȚIUNEA ────────────────────────────────────────────────
 * Ultima/următoarea scadență a planului, ridicarea `vehicles.km_curent` la o
 * intervenție, trecerea anvelopelor pe vehicul și proiecția în `expirables` sunt
 * triggere (`vsp_inainte`, `vse_dupa`, `vsp_dupa`). Acțiunile scriu rândul și
 * atât: niciun al doilea apel, deci nicio stare pe jumătate.
 *
 * ── CE NU EXISTĂ ─────────────────────────────────────────────────────────────
 * „Modifică intervenția” și „Modifică cheltuiala”. Intervenția nu se schimbă
 * după salvare (baza refuză cu P0001): se șterge logic și se reintroduce, ca un
 * plan să nu poată fi mutat de o corectură tăcută. Cheltuiala, la fel, pentru
 * simetrie și audit curat.
 */

import { createAction } from "@/lib/actions/create-action";
import { businessRule } from "@/lib/actions/errors";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  actualizeazaPlanServiceSchema,
  cheltuialaSchema,
  intrareServiceSchema,
  planServiceSchema,
  stergeCheltuialaSchema,
  stergeIntrareServiceSchema,
} from "@/schemas/fleet-service";

import { traduEroareService } from "./erori";

/** Fișa vehiculului și lista de parc (semaforul nu se schimbă, dar cartela da). */
const caiVehicul = (vehicleId: string): string[] => ["/flota", `/flota/${vehicleId}`];

// ── Planurile ───────────────────────────────────────────────────────────────

export const creeazaPlanService = createAction({
  name: "fleet.service_plan.create",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: planServiceSchema,
  audit: {
    action: "create",
    entityType: "vehicle_service_plan",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: [
      "vehicle_id",
      "denumire",
      "tip",
      "interval_km",
      "interval_luni",
      "baza_data",
      "baza_km",
      "prag_avertizare_km",
    ],
  },
  revalidate: (input) => caiVehicul(input.vehicle_id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("vehicle_service_plans")
      .insert({
        ...input,
        organization_id: ctx.tenant.organizationId,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error !== null) traduEroareService(error);
    return { id: data.id };
  },
});

/**
 * Corectura planului: denumire, intervale, baza, pragul — și `activ`. Un plan
 * oprit iese din scadențe și din alerte (triggerul închide rândul din
 * `expirables`), dar rămâne în istoric și se poate reporni.
 *
 * Zero rânduri = CONFLICT: un UPDATE respins de `USING` nu ridică eroare.
 */
export const actualizeazaPlanService = createAction({
  name: "fleet.service_plan.update",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: actualizeazaPlanServiceSchema,
  audit: {
    action: "update",
    entityType: "vehicle_service_plan",
    entityId: (input) => input.id,
    allow: [
      "id",
      "vehicle_id",
      "denumire",
      "tip",
      "interval_km",
      "interval_luni",
      "baza_data",
      "baza_km",
      "prag_avertizare_km",
      "activ",
    ],
  },
  revalidate: (input) => caiVehicul(input.vehicle_id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    // `vehicle_id` NU se scrie: e în schemă doar ca `revalidate` să compună
    // calea fișei, iar baza refuză mutarea unui plan pe alt vehicul.
    const { id, vehicle_id: _vehicul, ...campuri } = input;
    const { data, error } = await db
      .from("vehicle_service_plans")
      .update({ ...campuri, updated_by: ctx.user.id })
      .eq("id", id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareService(error);
    if (data === null) {
      throw businessRule(
        "Planul nu a putut fi modificat: a fost șters între timp sau nu aveți dreptul de a administra parcul auto. Reîncărcați fișa vehiculului.",
      );
    }
    return { id: data.id };
  },
});

// ── Intervențiile ───────────────────────────────────────────────────────────

export const adaugaIntrareService = createAction({
  name: "fleet.service_entry.add",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: intrareServiceSchema,
  audit: {
    action: "create",
    entityType: "vehicle_service_entry",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: [
      "vehicle_id",
      "plan_id",
      "data_interventiei",
      "km",
      "tip",
      "cost_piese",
      "cost_manopera",
      "anvelope_montate",
    ],
  },
  revalidate: (input) => caiVehicul(input.vehicle_id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("vehicle_service_entries")
      .insert({
        ...input,
        organization_id: ctx.tenant.organizationId,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error !== null) traduEroareService(error);
    return { id: data.id };
  },
});

/**
 * Ștergerea logică a unei intervenții greșite. Planul legat revine la
 * intervenția anterioară sau la bază (triggerul `vse_dupa`), iar anvelopele
 * montate la cea din urmă intervenție de anvelope rămasă. Kilometrajul
 * vehiculului NU coboară: bordul din service a fost totuși citit odată; dacă
 * cifra a fost greșită, corectura e `corecteazaKilometraj`, cu motiv auditat.
 */
export const stergeIntrareService = createAction({
  name: "fleet.service_entry.remove",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: stergeIntrareServiceSchema,
  audit: {
    action: "delete",
    entityType: "vehicle_service_entry",
    entityId: (input) => input.id,
    allow: ["id", "vehicle_id"],
  },
  revalidate: (input) => caiVehicul(input.vehicle_id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("vehicle_service_entries")
      .update({ deleted_at: ctx.now.toISOString(), updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareService(error);
    if (data === null) {
      throw businessRule(
        "Intervenția nu a fost ștearsă: fusese deja scoasă sau nu aveți dreptul de a administra parcul auto. Reîncărcați fișa vehiculului.",
      );
    }
    return { id: data.id };
  },
});

// ── Cheltuielile ────────────────────────────────────────────────────────────

export const adaugaCheltuiala = createAction({
  name: "fleet.expense.add",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: cheltuialaSchema,
  audit: {
    action: "create",
    entityType: "vehicle_expense",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: ["vehicle_id", "categorie", "data_cheltuielii", "suma", "litri", "km_bord"],
  },
  revalidate: (input) => caiVehicul(input.vehicle_id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("vehicle_expenses")
      .insert({
        ...input,
        organization_id: ctx.tenant.organizationId,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error !== null) traduEroareService(error);
    return { id: data.id };
  },
});

export const stergeCheltuiala = createAction({
  name: "fleet.expense.remove",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: stergeCheltuialaSchema,
  audit: {
    action: "delete",
    entityType: "vehicle_expense",
    entityId: (input) => input.id,
    allow: ["id", "vehicle_id"],
  },
  revalidate: (input) => caiVehicul(input.vehicle_id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("vehicle_expenses")
      .update({ deleted_at: ctx.now.toISOString(), updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareService(error);
    if (data === null) {
      throw businessRule(
        "Cheltuiala nu a fost ștearsă: fusese deja scoasă sau nu aveți dreptul de a administra parcul auto. Reîncărcați fișa vehiculului.",
      );
    }
    return { id: data.id };
  },
});
