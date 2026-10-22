// src/app/(app)/flota/rezervari/actions.ts
"use server";

// Rezervările mașinilor de pool (0216, F12d).
//
// Calea e `flota/rezervari/actions.ts`, nu `flota/actions-rezervari.ts`:
// auditul acțiunilor (`audit-actiuni.mjs`), ESLint (`src/**/actions.ts`) și
// garda demo (`**/actions`) recunosc o Server Action DOAR după numele
// `actions.ts` (decizia 12 a specificației).
//
// Fișierul exportă DOAR funcții async (capcana 39, `pnpm check:server`).
//
// Statusul NU se trimite la creare: îl pune triggerul `rezervari_inainte`
// (confirmată fără aprobare sau pentru cine are `approve = all`, altfel cerută).
// `created_by`/`updated_by` pleacă explicit: flota n-are `internal.set_actor`
// (capcana 23), iar politicile le cer. Orice tranziție face `.select()` după
// UPDATE: zero rânduri = CONFLICT, nu succes tăcut.

import { createAction } from "@/lib/actions/create-action";
import { businessRule } from "@/lib/actions/errors";
import { createServerSupabase } from "@/lib/supabase/server";
import type { StatusRezervare } from "@/domain/fleet/rezervari";
import {
  anuleazaRezervareSchema,
  decizieRezervareSchema,
  rezervareNouaSchema,
  scurteazaRezervareSchema,
} from "@/schemas/fleet-rezervari";

import { traduEroareRezervare } from "./erori";

const CAI_REZERVARI: readonly string[] = [
  "/flota/rezervari",
  "/portal/masina-mea",
  "/portal/masina-mea/rezervari",
  "/panou",
];

const cai = (vehiculId: string): readonly string[] => [...CAI_REZERVARI, `/flota/${vehiculId}`];

/**
 * Fișa PRINCIPALĂ a contului, prin RLS (ca `fisaProprieFoaie` din
 * `flota/actions.ts`): `employee` are `employees:read = own` din 0023, deci își
 * vede fișa, iar managerul și administratorul o văd oricum. Fără client admin.
 */
async function fisaProprie(organizationId: string, userId: string): Promise<string> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employees")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("is_primary", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (error !== null) throw error;
  if (data === null) {
    throw businessRule(
      "Contul dumneavoastră nu este legat de o fișă de angajat principală în această organizație. Rezervarea se face pe fișa angajatului; contactați administratorul.",
    );
  }
  return data.id;
}

/**
 * Rezervarea nouă. Sub `all` (angajatul, managerul: `own`) omul rezervă doar
 * pentru el: fișa se rezolvă AICI, iar un `employee_id` trimis e refuzat înainte
 * de bază (politica de INSERT l-ar refuza oricum, dar cu un 42501 care nu spune
 * ce anume). Cu `all`, `null` = fișa proprie.
 */
export const creeazaRezervare = createAction({
  name: "fleet.reservation.create",
  feature: "fleet",
  permission: "vehicle_reservations:create",
  minScope: "own",
  input: rezervareNouaSchema,
  audit: {
    action: "create",
    entityType: "vehicle_reservation",
    entityId: (_input, data: Readonly<{ id: string; status: StatusRezervare }>) => data.id,
    // Fără scop, destinație sau observații: minimizarea datelor (⚠ jurist).
    allow: ["vehicle_id", "employee_id", "de_la", "pana_la"],
  },
  revalidate: (input) => cai(input.vehicle_id),
  handler: async (ctx, input): Promise<Readonly<{ id: string; status: StatusRezervare }>> => {
    if (ctx.scope !== "all" && input.employee_id !== null) {
      throw businessRule(
        "Rezervați doar pentru dumneavoastră. Rezervarea unui coleg o face el însuși sau administratorul flotei.",
      );
    }
    const employeeId =
      input.employee_id ?? (await fisaProprie(ctx.tenant.organizationId, ctx.user.id));

    const db = await createServerSupabase();
    const { data, error } = await db
      .from("vehicle_reservations")
      .insert({
        organization_id: ctx.tenant.organizationId,
        vehicle_id: input.vehicle_id,
        employee_id: employeeId,
        de_la: input.de_la,
        pana_la: input.pana_la,
        scop: input.scop,
        destinatie: input.destinatie,
        observatii: input.observatii,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id, status")
      .single();
    if (error !== null) traduEroareRezervare(error);

    return { id: data.id, status: data.status };
  },
});

/**
 * Aprobarea sau respingerea unei cereri. Auto-decizia o refuză BAZA (P0001):
 * `manager_path` conține și fișa omului, deci RLS-ul l-ar lăsa.
 */
export const decideRezervarea = createAction({
  name: "fleet.reservation.decide",
  feature: "fleet",
  permission: "vehicle_reservations:approve",
  minScope: "team",
  input: decizieRezervareSchema,
  audit: {
    action: "update",
    entityType: "vehicle_reservation",
    entityId: (input) => input.id,
    allow: ["id", "decizie"],
  },
  revalidate: (input) => cai(input.vehicle_id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("vehicle_reservations")
      .update({
        status: input.decizie,
        motiv_respingere: input.decizie === "respinsa" ? input.motiv : null,
        updated_by: ctx.user.id,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("status", "ceruta")
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareRezervare(error);
    if (data === null) {
      throw businessRule(
        "Rezervarea nu mai așteaptă o decizie: a fost decisă sau anulată din altă parte. Reîncărcați pagina.",
      );
    }
    return { id: data.id };
  },
});

/**
 * Anularea. Managerul trece de poarta `own` (își anulează propria rezervare),
 * iar pe ale echipei de RLS prin ramura `approve = team`. Motivul îl cere baza
 * când rezervarea nu e a apelantului.
 */
export const anuleazaRezervarea = createAction({
  name: "fleet.reservation.cancel",
  feature: "fleet",
  permission: "vehicle_reservations:update",
  minScope: "own",
  input: anuleazaRezervareSchema,
  audit: {
    action: "update",
    entityType: "vehicle_reservation",
    entityId: (input) => input.id,
    allow: ["id", "vehicle_id"],
  },
  revalidate: (input) => cai(input.vehicle_id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("vehicle_reservations")
      .update({ status: "anulata", motiv_anulare: input.motiv, updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .in("status", ["ceruta", "confirmata"])
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareRezervare(error);
    if (data === null) {
      throw businessRule(
        "Rezervarea nu a fost anulată: era deja închisă sau nu o puteți modifica. Reîncărcați pagina.",
      );
    }
    return { id: data.id };
  },
});

/** „Returnez mai devreme”: doar scurtare, până cel mult azi și nu sub o foaie legată. */
export const scurteazaRezervarea = createAction({
  name: "fleet.reservation.shorten",
  feature: "fleet",
  permission: "vehicle_reservations:update",
  minScope: "own",
  input: scurteazaRezervareSchema,
  audit: {
    action: "update",
    entityType: "vehicle_reservation",
    entityId: (input) => input.id,
    allow: ["id", "vehicle_id", "pana_la"],
  },
  revalidate: (input) => cai(input.vehicle_id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("vehicle_reservations")
      .update({ pana_la: input.pana_la, updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .in("status", ["ceruta", "confirmata"])
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareRezervare(error);
    if (data === null) {
      throw businessRule(
        "Rezervarea nu a fost scurtată: era deja închisă sau nu o puteți modifica. Reîncărcați pagina.",
      );
    }
    return { id: data.id };
  },
});
