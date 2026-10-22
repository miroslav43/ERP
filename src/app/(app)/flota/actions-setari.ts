// src/app/(app)/flota/actions-setari.ts
"use server";

/**
 * Setările flotei (0201, `fleet_settings`): responsabilii de flotă, pragul de
 * salt al kilometrajului și pragurile de alertă. Pragurile ajung în
 * `alert_rules` printr-un trigger din bază, nu de aici: `alert_rules` cere
 * `compliance:*`, iar aceste setări le schimbă cine are `vehicles:update = all`.
 *
 * „use server”: se exportă DOAR funcții async (capcana 39).
 */

import { createAction } from "@/lib/actions/create-action";
import { businessRule } from "@/lib/actions/errors";
import { createServerSupabase } from "@/lib/supabase/server";
import { setariFlotaSchema } from "@/schemas/fleet";
import { campuriSetariRezervari } from "@/schemas/fleet-rezervari";

import { traduEroareSetari } from "./erori";

// F12d (0216): cele trei setări ale rezervărilor de pool merg în același rând
// `fleet_settings`, sub aceeași poartă. Schema le adaugă aici, nu în
// `schemas/fleet.ts`, pe care îl editează în paralel și alte extensii.
const setariFlotaCuRezervariSchema = setariFlotaSchema.extend(campuriSetariRezervari);

// Poarta e cea a politicilor `fleet_settings_insert`/`_update`: literal
// `vehicles:update = all`. Una mai largă ar lăsa managerul să treacă de acțiune
// și să cadă tăcut pe USING, cu zero rânduri.
export const salveazaSetariFlota = createAction({
  name: "fleet.settings.save",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: setariFlotaCuRezervariSchema,
  audit: {
    action: "update",
    entityType: "fleet_settings",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: [
      "responsabili",
      "prag_salt_km",
      "praguri_alerta_zile",
      "rezervari_cu_aprobare",
      "rezervare_obligatorie",
      "rezervari_max_zile",
    ],
  },
  revalidate: ["/flota/setari", "/flota", "/flota/rezervari", "/portal/masina-mea/rezervari"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data: existent, error: eroareCitire } = await db
      .from("fleet_settings")
      .select("id")
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareCitire !== null) throw eroareCitire;

    // Prima salvare: firma n-are încă rând (implicitele coloanelor). Două
    // salvări simultane se ciocnesc pe `fleet_settings_org_uq`, iar a doua
    // primește CONFLICT, nu o suprascriere tăcută.
    if (existent === null) {
      const { data, error } = await db
        .from("fleet_settings")
        .insert({
          ...input,
          organization_id: ctx.tenant.organizationId,
          created_by: ctx.user.id,
          updated_by: ctx.user.id,
        })
        .select("id")
        .single();
      if (error !== null) traduEroareSetari(error);
      return { id: data.id };
    }

    const { data, error } = await db
      .from("fleet_settings")
      .update({ ...input, updated_by: ctx.user.id })
      .eq("id", existent.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareSetari(error);
    if (data === null)
      throw businessRule(
        "Setările flotei nu au putut fi salvate: au fost șterse între timp. Reîncărcați pagina.",
      );
    return { id: data.id };
  },
});
