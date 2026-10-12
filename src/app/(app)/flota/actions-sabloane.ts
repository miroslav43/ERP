// src/app/(app)/flota/actions-sabloane.ts
"use server";

/**
 * Șabloanele de traseu (0200): rutele recurente ale firmei, din care caseta
 * „Cursă nouă” precompletează locurile, scopul și km estimați.
 *
 * „use server”: se exportă DOAR funcții async (capcana 39).
 */

import { createAction } from "@/lib/actions/create-action";
import { businessRule } from "@/lib/actions/errors";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  actualizeazaSablonTraseuSchema,
  sablonTraseuSchema,
  stergeSablonTraseuSchema,
} from "@/schemas/fleet";

import { traduEroare } from "./erori";

// ── Șabloanele de traseu ────────────────────────────────────────────────────
//
// Le administrează responsabilul de flotă: `sabloane_traseu_insert`/`_update`
// cer literal `trip_sheets:update = all`, deci poarta aplicației e aceeași —
// una mai largă ar lăsa un rol să treacă de acțiune și să cadă tăcut pe USING.

export const creeazaSablonTraseu = createAction({
  name: "fleet.route_template.create",
  feature: "fleet",
  permission: "trip_sheets:update",
  minScope: "all",
  input: sablonTraseuSchema,
  audit: {
    action: "create",
    entityType: "trip_route_template",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: ["denumire", "de_la_loc", "pana_la_loc", "scop", "km_estimat"],
  },
  revalidate: ["/flota/foi/sabloane"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("trip_route_templates")
      .insert({
        ...input,
        organization_id: ctx.tenant.organizationId,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);
    return { id: data.id };
  },
});

export const actualizeazaSablonTraseu = createAction({
  name: "fleet.route_template.update",
  feature: "fleet",
  permission: "trip_sheets:update",
  minScope: "all",
  input: actualizeazaSablonTraseuSchema,
  audit: {
    action: "update",
    entityType: "trip_route_template",
    entityId: (input) => input.id,
    allow: ["id", "denumire", "de_la_loc", "pana_la_loc", "scop", "km_estimat"],
  },
  revalidate: ["/flota/foi/sabloane"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { id, ...campuri } = input;
    const { data, error } = await db
      .from("trip_route_templates")
      .update({ ...campuri, updated_by: ctx.user.id })
      .eq("id", id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule("Șablonul nu a putut fi modificat: a fost șters între timp.");
    }
    return { id: data.id };
  },
});

export const stergeSablonTraseu = createAction({
  name: "fleet.route_template.delete",
  feature: "fleet",
  permission: "trip_sheets:update",
  minScope: "all",
  input: stergeSablonTraseuSchema,
  audit: {
    action: "delete",
    entityType: "trip_route_template",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: ["/flota/foi/sabloane"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("trip_route_templates")
      .update({ deleted_at: new Date().toISOString(), updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule("Șablonul nu a putut fi șters: a fost deja șters.");
    }
    return { id: data.id };
  },
});
