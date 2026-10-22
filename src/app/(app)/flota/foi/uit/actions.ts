// src/app/(app)/flota/foi/uit/actions.ts
"use server";

/**
 * Codurile UIT (RO e-Transport) de pe cursele foii (F12f, 0217). Aplicația le
 * ține minte și le verifică; nu declară nimic la ANAF.
 *
 * Fișierul se numește `actions.ts` (nu `actions-uit.ts`, cum scria
 * specificația): uneltele proiectului recunosc Server Actions doar după nume
 * (`audit-actiuni.mjs`, ESLint `src/**\/actions.ts`, garda demo `**\/actions`).
 * Portalul le importă de aici. „use server”: se exportă DOAR funcții async
 * (capcana 39, `pnpm check:server`), deci căile sunt o funcție locală.
 *
 * ── CE JUDECĂ BAZA, NU ACȚIUNEA ─────────────────────────────────────────────
 * `internal.uit_inainte`: codul se scrie doar pe ciornă (ca liniile, 0200
 * §D1), cursa trebuie să fie a foii trimise, codul și cursa nu se mută. Formatul
 * și cifrele de control le refuză CHECK-ul `tsu_uit_format` (schema le prinde
 * înainte). Cine scrie: `uit_insert`/`uit_update`, pe `trip_sheets:update`
 * (`app.poate_scrie_foaie`) — șoferul pe foaia lui, `org_admin` pe oricare.
 *
 * `created_by`/`updated_by` se trimit explicit (capcana #23): politicile le cer
 * nominal, iar fără `updated_by` un UPDATE dă 42501.
 */

import { createAction } from "@/lib/actions/create-action";
import { businessRule } from "@/lib/actions/errors";
import { createServerSupabase } from "@/lib/supabase/server";
import { actualizeazaUitSchema, adaugaUitSchema, stergeUitSchema } from "@/schemas/fleet";

import { traduEroareUit } from "../../erori";

/** Rutele atinse de o scriere pe codurile unei foi: lista, foaia, coada, portalul. */
function caiFoaie(foaieId: string): readonly string[] {
  return [
    "/flota/foi",
    `/flota/foi/${foaieId}`,
    "/flota/aprobari",
    "/portal",
    "/portal/masina-mea",
    `/portal/masina-mea/foi/${foaieId}`,
  ];
}

export const adaugaUit = createAction({
  name: "fleet.uit.add",
  feature: "fleet",
  permission: "trip_sheets:update",
  minScope: "own",
  input: adaugaUitSchema,
  audit: {
    action: "create",
    entityType: "trip_sheet_uit",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: ["trip_sheet_id", "cursa_id", "uit", "data_inceput", "valabilitate_zile", "observatii"],
  },
  revalidate: (input) => caiFoaie(input.trip_sheet_id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    // `expira_la` NU se trimite: e GENERATED (428C9 altfel, capcana #22).
    const { data, error } = await db
      .from("trip_sheet_uit")
      .insert({
        organization_id: ctx.tenant.organizationId,
        trip_sheet_id: input.trip_sheet_id,
        cursa_id: input.cursa_id,
        uit: input.uit,
        data_inceput: input.data_inceput,
        valabilitate_zile: input.valabilitate_zile,
        observatii: input.observatii,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error !== null) traduEroareUit(error);
    return { id: data.id };
  },
});

export const actualizeazaUit = createAction({
  name: "fleet.uit.update",
  feature: "fleet",
  permission: "trip_sheets:update",
  minScope: "own",
  input: actualizeazaUitSchema,
  audit: {
    action: "update",
    entityType: "trip_sheet_uit",
    entityId: (input) => input.id,
    allow: ["data_inceput", "valabilitate_zile", "observatii"],
  },
  revalidate: (input) => caiFoaie(input.trip_sheet_id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    // `.select()` obligatoriu: un cod pe foaia altcuiva cade pe `USING` cu
    // ZERO rânduri, fără eroare (capcana 17).
    const { data, error } = await db
      .from("trip_sheet_uit")
      .update({
        data_inceput: input.data_inceput,
        valabilitate_zile: input.valabilitate_zile,
        observatii: input.observatii,
        updated_by: ctx.user.id,
      })
      .eq("id", input.id)
      .eq("trip_sheet_id", input.trip_sheet_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareUit(error);
    if (data === null) {
      throw businessRule(
        "Codul UIT nu a fost modificat: foaia nu mai e în lucru sau nu aveți dreptul. Reîncărcați foaia.",
      );
    }
    return { id: data.id };
  },
});

export const stergeUit = createAction({
  name: "fleet.uit.remove",
  feature: "fleet",
  permission: "trip_sheets:update",
  minScope: "own",
  input: stergeUitSchema,
  audit: {
    action: "delete",
    entityType: "trip_sheet_uit",
    entityId: (input) => input.id,
    allow: ["id", "trip_sheet_id"],
  },
  revalidate: (input) => caiFoaie(input.trip_sheet_id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("trip_sheet_uit")
      .update({ deleted_at: ctx.now.toISOString(), updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("trip_sheet_id", input.trip_sheet_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareUit(error);
    if (data === null) {
      throw businessRule(
        "Codul UIT nu a fost șters: a fost deja șters, foaia nu mai e în lucru sau nu aveți dreptul. Reîncărcați foaia.",
      );
    }
    return { id: data.id };
  },
});
