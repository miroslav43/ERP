// src/app/(app)/flota/[id]/iesire/actions.ts
"use server";

// Ieșirea vehiculului din parc (0218, F12h).
//
// Calea e `flota/[id]/iesire/actions.ts`: auditul acțiunilor, ESLint și garda
// demo recunosc o Server Action DOAR după numele `actions.ts` (README F12 §2.4).
// Fișierul exportă DOAR funcții async (capcana 39, `pnpm check:server`).
//
// Un singur INSERT face tot (Decizia 1): triggerul închide alocarea la data
// ieșirii, trece vehiculul în `vandut`/`casat` și creează termenele. Toate cer
// `vehicles:update = all`, fiindcă politicile cer literal `= 'all'`. Autorul se
// trimite explicit: flota n-are `internal.set_actor` (capcana 23), iar politicile
// îl cer. `vehicle_id` e în fiecare schemă doar pentru `revalidate`.

import { createAction } from "@/lib/actions/create-action";
import { businessRule } from "@/lib/actions/errors";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  anuleazaIesireaSchema,
  finalizeazaObligatiaSchema,
  iesireDinParcSchema,
  redeschideObligatiaSchema,
} from "@/schemas/flota-iesire";

import { traduEroareIesire } from "./erori-iesire";

const caiVehicul = (vehiculId: string): readonly string[] => ["/flota", `/flota/${vehiculId}`];

/**
 * „Scoate din parc”. Cumpărătorul (D6: dată personală la persoana fizică) și
 * prețul NU intră în audit; nici în `audit_logs` scris de trigger (0218 §11).
 */
export const scoateDinParc = createAction({
  name: "fleet.vehicle.exit",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: iesireDinParcSchema,
  audit: {
    action: "create",
    entityType: "vehicle_exit",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: [
      "vehicle_id",
      "tip",
      "destinatie_epava",
      "motiv_radiere",
      "data_iesire",
      "km_iesire",
      "motiv",
      "nr_document",
      "pastreaza_numarul",
      "incident_id",
    ],
  },
  revalidate: (input) => caiVehicul(input.vehicle_id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("vehicle_exits")
      .insert({
        organization_id: ctx.tenant.organizationId,
        vehicle_id: input.vehicle_id,
        tip: input.tip,
        destinatie_epava: input.destinatie_epava,
        motiv_radiere: input.motiv_radiere,
        data_iesire: input.data_iesire,
        km_iesire: input.km_iesire,
        motiv: input.motiv,
        cumparator: input.cumparator,
        pret: input.pret,
        nr_document: input.nr_document,
        pastreaza_numarul: input.pastreaza_numarul,
        observatii: input.observatii,
        // F12h: incidentul care a dus la dauna totală (0218, `vexit_incident_ck`).
        incident_id: input.incident_id,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error !== null) traduEroareIesire(error);

    return { id: data.id };
  },
});

/**
 * Anularea: vehiculul revine în parc, termenele ies din alerte. Alocarea și
 * rezervările NU revin. Al doilea clic găsește ieșirea anulată: zero rânduri,
 * CONFLICT, nu P0001.
 */
export const anuleazaIesirea = createAction({
  name: "fleet.vehicle.exit.cancel",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: anuleazaIesireaSchema,
  audit: {
    action: "update",
    entityType: "vehicle_exit",
    entityId: (input) => input.id,
    allow: ["id", "vehicle_id", "motiv_anulare"],
  },
  revalidate: (input) => caiVehicul(input.vehicle_id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("vehicle_exits")
      .update({
        anulat_la: ctx.now.toISOString(),
        motiv_anulare: input.motiv_anulare,
        updated_by: ctx.user.id,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("anulat_la", null)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareIesire(error);
    if (data === null) {
      throw businessRule(
        "Ieșirea fusese deja anulată sau nu mai există. Reîncărcați fișa vehiculului.",
      );
    }

    return { id: data.id };
  },
});

/**
 * „Făcut la …” sau „Nu se aplică”, pe un termen DESCHIS. Datele bifării le
 * judecă baza (P0001 pe `finalizat_la`); autorul îl scrie tot baza.
 */
export const finalizeazaObligatia = createAction({
  name: "fleet.vehicle.exit.task.done",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: finalizeazaObligatiaSchema,
  audit: {
    action: "update",
    entityType: "vehicle_exit_obligation",
    entityId: (input) => input.id,
    allow: ["id", "vehicle_id", "stare", "finalizat_la", "nota"],
  },
  revalidate: (input) => caiVehicul(input.vehicle_id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("vehicle_exit_obligations")
      .update(
        input.stare === "facut"
          ? { finalizat_la: input.finalizat_la, nota: input.nota, updated_by: ctx.user.id }
          : { nu_se_aplica: true, nota: input.nota, updated_by: ctx.user.id },
      )
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("finalizat_la", null)
      .eq("nu_se_aplica", false)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareIesire(error);
    if (data === null) {
      throw businessRule(
        "Termenul fusese deja închis sau ieșirea a fost anulată. Reîncărcați fișa vehiculului.",
      );
    }

    return { id: data.id };
  },
});

/** Redeschiderea unui termen închis din greșeală. Baza refuză dacă un termen dependent e făcut. */
export const redeschideObligatia = createAction({
  name: "fleet.vehicle.exit.task.reopen",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: redeschideObligatiaSchema,
  audit: {
    action: "update",
    entityType: "vehicle_exit_obligation",
    entityId: (input) => input.id,
    allow: ["id", "vehicle_id"],
  },
  revalidate: (input) => caiVehicul(input.vehicle_id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("vehicle_exit_obligations")
      .update({ finalizat_la: null, nu_se_aplica: false, updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .or("finalizat_la.not.is.null,nu_se_aplica.eq.true")
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareIesire(error);
    if (data === null) {
      throw businessRule("Termenul era deja deschis. Reîncărcați fișa vehiculului.");
    }

    return { id: data.id };
  },
});
