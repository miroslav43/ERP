// src/app/(app)/flota/actions-tipuri.ts
"use server";

/**
 * Nomenclatorul de documente al firmei (0202): setarea pe un tip DE PLATFORMĂ
 * (activ / obligatoriu, doar pentru ea) și tipurile PROPRII firmei.
 *
 * Porțile sunt ale politicilor, literal: `vehicle_document_type_setari_*` și
 * `vdt_update` cer `vehicles:update = all`, `vdt_insert` cere
 * `vehicles:create = all`. Una mai largă ar lăsa managerul să treacă de acțiune
 * și să cadă tăcut pe USING, cu zero rânduri.
 *
 * „use server”: se exportă DOAR funcții async (capcana 39).
 */

import { createAction } from "@/lib/actions/create-action";
import { businessRule, invalidInput, notFound } from "@/lib/actions/errors";
import { createServerSupabase } from "@/lib/supabase/server";
import { codDinDenumire } from "@/domain/fleet/tipuri-document";
import {
  actualizeazaTipDocumentSchema,
  setareTipDocumentSchema,
  tipDocumentPropriuSchema,
} from "@/schemas/fleet";

import { traduEroareTipuri } from "./erori";

/** Ecranele pe care se vede nomenclatorul: setările, lista (semaforul), portalul. */
const CAI_TIPURI: readonly string[] = ["/flota/setari/documente", "/flota", "/portal/masina-mea"];

export const salveazaSetareTipDocument = createAction({
  name: "fleet.document_type.setting",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: setareTipDocumentSchema,
  audit: {
    action: "update",
    entityType: "vehicle_document_type_setari",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: ["document_type_id", "activ", "obligatoriu"],
  },
  revalidate: CAI_TIPURI,
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();

    // Doar tipurile de platformă primesc setare; baza o refuză pe cele proprii
    // (P0001), dar mesajul de aici spune ce să facă în loc.
    const { data: tip, error: eroareTip } = await db
      .from("vehicle_document_types")
      .select("id, organization_id")
      .eq("id", input.document_type_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareTip !== null) throw eroareTip;
    if (tip === null) throw notFound("Tipul de document nu mai există. Reîncărcați pagina.");
    if (tip.organization_id !== null) {
      throw businessRule("Un tip propriu se modifică direct, din lista tipurilor firmei.");
    }

    const { data: existent, error: eroareCitire } = await db
      .from("vehicle_document_type_setari")
      .select("id")
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("document_type_id", input.document_type_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareCitire !== null) throw eroareCitire;

    // Fără `.upsert()`: unicitatea e PARȚIALĂ (`where deleted_at is null`), iar
    // PostgREST nu emite predicatul în ON CONFLICT (capcana 7). Două prime
    // salvări simultane se ciocnesc pe `vdts_org_tip_uq` → CONFLICT.
    if (existent === null) {
      const { data, error } = await db
        .from("vehicle_document_type_setari")
        .insert({
          ...input,
          organization_id: ctx.tenant.organizationId,
          created_by: ctx.user.id,
          updated_by: ctx.user.id,
        })
        .select("id")
        .single();
      if (error !== null) traduEroareTipuri(error);
      return { id: data.id };
    }

    const { data, error } = await db
      .from("vehicle_document_type_setari")
      .update({ activ: input.activ, obligatoriu: input.obligatoriu, updated_by: ctx.user.id })
      .eq("id", existent.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareTipuri(error);
    if (data === null) {
      throw businessRule(
        "Setarea tipului nu a putut fi salvată: a fost schimbată între timp. Reîncărcați pagina.",
      );
    }
    return { id: data.id };
  },
});

export const creeazaTipDocument = createAction({
  name: "fleet.document_type.create",
  feature: "fleet",
  permission: "vehicles:create",
  minScope: "all",
  input: tipDocumentPropriuSchema,
  audit: {
    action: "create",
    entityType: "vehicle_document_type",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: ["denumire", "cere_expirare", "obligatoriu", "categorii_aplicabile", "masa_max_kg"],
  },
  revalidate: CAI_TIPURI,
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const cod = codDinDenumire(input.denumire);

    // Codul unui tip propriu nu poate fi al unuia de platformă (0018 §F6, P0001
    // „Codul … Alegeți alt cod”). Omul n-a scris niciun cod, deci refuzul se
    // spune pe DENUMIRE, cu tipul de platformă pe care îl poate activa în loc.
    const { data: platforma, error: eroarePlatforma } = await db
      .from("vehicle_document_types")
      .select("denumire")
      .is("organization_id", null)
      .eq("cod", cod)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroarePlatforma !== null) throw eroarePlatforma;
    if (platforma !== null) {
      const mesaj = `Există deja tipul „${platforma.denumire}” în nomenclatorul comun. Activați-l din lista de mai sus în loc să creați unul nou.`;
      throw invalidInput(mesaj, { denumire: [mesaj] });
    }

    // `activ: true` explicit — `vdt_insert` îl cere; `created_by` și
    // `updated_by` sunt cerute nominal de WITH CHECK (tabela n-are set_actor).
    const { data, error } = await db
      .from("vehicle_document_types")
      .insert({
        ...input,
        cod,
        organization_id: ctx.tenant.organizationId,
        activ: true,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error !== null) traduEroareTipuri(error);
    return { id: data.id };
  },
});

export const actualizeazaTipDocument = createAction({
  name: "fleet.document_type.update",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: actualizeazaTipDocumentSchema,
  audit: {
    action: "update",
    entityType: "vehicle_document_type",
    entityId: (input) => input.id,
    allow: [
      "id",
      "denumire",
      "cere_expirare",
      "obligatoriu",
      "categorii_aplicabile",
      "masa_max_kg",
      "activ",
    ],
  },
  revalidate: CAI_TIPURI,
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { id, ...campuri } = input;
    // Filtrul pe organizație exclude și rândurile de platformă (au NULL): un
    // tip comun nu se modifică de aici, ci prin setarea firmei.
    const { data, error } = await db
      .from("vehicle_document_types")
      .update({
        ...campuri,
        // Un tip retras nu se cere nimănui (aceeași regulă ca `vdts_inainte`).
        obligatoriu: campuri.activ && campuri.obligatoriu,
        updated_by: ctx.user.id,
      })
      .eq("id", id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareTipuri(error);
    if (data === null) {
      throw notFound(
        "Tipul de document nu a fost găsit sau nu aparține firmei. Reîncărcați pagina.",
      );
    }
    return { id: data.id };
  },
});
