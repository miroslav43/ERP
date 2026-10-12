// src/app/(app)/flota/actions-curse.ts
"use server";

/**
 * Cursele foii zilnice (0197). Șabloanele de traseu stau în `actions-sabloane.ts`.
 *
 * Fișier separat de `actions.ts`, care trecuse de 900 de rânduri. „use server”:
 * se exportă DOAR funcții async (capcana 39, `pnpm check:server`), deci căile
 * portalului sunt o constantă locală, nu una importată.
 *
 * ── CE JUDECĂ BAZA, NU ACȚIUNEA ─────────────────────────────────────────────
 * `internal.curse_inainte`: ziua foii, ordinea cronologică, kilometrajul
 * monoton între curse vecine, „doar ultima cursă poate rămâne deschisă”, și
 * că același șofer nu conduce două vehicule deodată. Toate vin ca P0001 cu
 * mesajul pe câmp (`traduEroare`). Tot baza refuză orice scriere pe o foaie
 * care nu e ciornă (§D1): o foaie trimisă se retrage întâi.
 *
 * Antetul (orele și kilometrii zilei) se recalculează singur în bază după
 * fiecare scriere; acțiunea nu-l atinge.
 *
 * `created_by`/`updated_by` se trimit explicit, ca la toate tabelele flotei
 * (capcana #23): `curse_insert` le cere nominal, chiar dacă `set_actor` le-ar
 * completa.
 */

import { createAction } from "@/lib/actions/create-action";
import { businessRule } from "@/lib/actions/errors";
import { createServerSupabase } from "@/lib/supabase/server";
import { actualizeazaCursaSchema, cursaSchema, stergeCursaSchema } from "@/schemas/fleet";

import { traduEroare } from "./erori";

/** Rutele atinse de o scriere pe cursele unei foi: lista, foaia, portalul. */
function caiFoaie(foaieId: string): readonly string[] {
  return [
    "/flota/foi",
    `/flota/foi/${foaieId}`,
    "/portal",
    "/portal/masina-mea",
    `/portal/masina-mea/foi/${foaieId}`,
  ];
}

export const adaugaCursa = createAction({
  name: "fleet.trip_leg.add",
  feature: "fleet",
  permission: "trip_sheets:update",
  minScope: "own",
  input: cursaSchema,
  audit: {
    action: "create",
    entityType: "trip_sheet_leg",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: [
      "trip_sheet_id",
      "sablon_id",
      "plecare_la",
      "sosire_la",
      "de_la_loc",
      "pana_la_loc",
      "scop",
      "km_plecare",
      "km_sosire",
      "observatii",
    ],
  },
  revalidate: (input) => caiFoaie(input.trip_sheet_id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    // `sablon_id` e doar urma din audit: locurile și scopul vin din formular,
    // precompletate din șablon, ca omul să le poată corecta înainte.
    // `ordine` nu se trimite: o renumerotează baza, cronologic.
    const { sablon_id: _sablon, ...cursa } = input;
    const { data, error } = await db
      .from("trip_sheet_curse")
      .insert({
        ...cursa,
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

export const actualizeazaCursa = createAction({
  name: "fleet.trip_leg.update",
  feature: "fleet",
  permission: "trip_sheets:update",
  minScope: "own",
  input: actualizeazaCursaSchema,
  audit: {
    action: "update",
    entityType: "trip_sheet_leg",
    entityId: (input) => input.id,
    allow: [
      "id",
      "trip_sheet_id",
      "plecare_la",
      "sosire_la",
      "de_la_loc",
      "pana_la_loc",
      "scop",
      "km_plecare",
      "km_sosire",
      "observatii",
    ],
  },
  revalidate: (input) => caiFoaie(input.trip_sheet_id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { id, trip_sheet_id, observatii, ...campuri } = input;
    // `.select()` obligatoriu: o cursă pe foaia altcuiva cade pe `USING` cu
    // ZERO rânduri, fără eroare (capcana 17). Observațiile goale nu șterg ce
    // era: caseta de pe foaie nu are câmpul.
    const { data, error } = await db
      .from("trip_sheet_curse")
      .update({
        ...campuri,
        ...(observatii === null ? {} : { observatii }),
        updated_by: ctx.user.id,
      })
      .eq("id", id)
      .eq("trip_sheet_id", trip_sheet_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule(
        "Cursa nu a putut fi modificată: a fost ștearsă între timp sau nu aveți dreptul de a modifica foaia.",
      );
    }
    return { id: data.id };
  },
});

export const stergeCursa = createAction({
  name: "fleet.trip_leg.delete",
  feature: "fleet",
  permission: "trip_sheets:update",
  minScope: "own",
  input: stergeCursaSchema,
  audit: {
    action: "delete",
    entityType: "trip_sheet_leg",
    entityId: (input) => input.id,
    allow: ["id", "trip_sheet_id"],
  },
  revalidate: (input) => caiFoaie(input.trip_sheet_id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("trip_sheet_curse")
      .update({ deleted_at: new Date().toISOString(), updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("trip_sheet_id", input.trip_sheet_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule(
        "Cursa nu a putut fi ștearsă: a fost deja ștearsă sau nu aveți dreptul de a modifica foaia.",
      );
    }
    return { id: data.id };
  },
});
