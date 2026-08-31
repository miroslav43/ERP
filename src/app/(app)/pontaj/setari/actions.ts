"use server";

import { createAction } from "@/lib/actions/create-action";
import { businessRule } from "@/lib/actions/errors";
import { setariPontajSchema, setariPontareRapidaSchema } from "@/schemas/attendance";
import { createServerSupabase } from "@/lib/supabase/server";

import { traduEroare } from "../erori";

/**
 * Salvează o versiune nouă a parametrilor de dreptul muncii.
 *
 * Versionare prin `valabil_de_la`, ca la setările de salarizare: o modificare
 * NU rescrie trecutul. O lună deja calculată trebuie să rămână explicabilă cu
 * parametrii care erau în vigoare atunci, nu cu cei de azi.
 */
export const salveazaSetariPontaj = createAction({
  name: "attendance.settings.save",
  feature: "attendance",
  permission: "attendance:update",
  minScope: "all",
  input: setariPontajSchema,
  audit: { action: "create", entityType: "attendance_settings", allow: ["valabil_de_la"] },
  revalidate: ["/pontaj", "/pontaj/setari"],
  handler: async (ctx, input) => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("attendance_settings")
      .insert({ organization_id: ctx.tenant.organizationId, ...input })
      .select("id")
      .single<{ id: string }>();
    if (error !== null) traduEroare(error);
    return { id: data.id };
  },
});

/**
 * Salvează cum se pontează de pe telefon.
 *
 * ── DE CE E O ACȚIUNE SEPARATĂ ──────────────────────────────────────────────
 * Cele trei câmpuri stăteau în `salveazaSetariPontaj`, adică într-o scriere
 * VERSIONATĂ care cere o dată de intrare în vigoare și toți parametrii juridici
 * odată. Pornirea unui buton devenea astfel o declarație de dreptul muncii.
 * Aici nu există `valabil_de_la`: un rând per firmă, rescris.
 *
 * ── DE CE NU `.upsert()` ────────────────────────────────────────────────────
 * `setari_pontare_rapida_org_uq` e index unic PARȚIAL (`where deleted_at is
 * null`), iar PostgREST nu emite predicatul în `ON CONFLICT`: Postgres respinge
 * inferența la PLANIFICARE, deci `.upsert()` ar cădea cu 42P10 la fiecare apel,
 * nu doar la conflict. Citire-apoi-INSERT-sau-UPDATE, ca peste tot în proiect.
 */
export const salveazaPontareaRapida = createAction({
  name: "attendance.quick_settings.save",
  feature: "attendance",
  permission: "attendance:update",
  minScope: "all",
  input: setariPontareRapidaSchema,
  audit: {
    action: "update",
    entityType: "setari_pontare_rapida",
    allow: ["mod_pontare_rapida", "verificare_pontare", "program_start", "necesita_aprobare"],
  },
  // Ecranele care desenează butoanele de pontare stau în portal, nu sub
  // `/pontaj`: fără căile astea, patronul pornește pontarea și angajatul se uită
  // la un ecran care încă spune că nu e activată.
  revalidate: ["/pontaj", "/pontaj/setari", "/portal", "/portal/ceas"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();

    /*
     * Refuzul care apără firma de ea însăși.
     *
     * `cod_qr` ascunde butonul obișnuit și cere scanarea unui afiș. Fără niciun
     * punct de lucru cu cod generat, nu există afiș de scanat — deci alegerea
     * asta oprește pontarea pentru TOATĂ firma, tăcut, iar cel care a făcut-o
     * n-are cum să lege cele două ecrane. Nu se poate exprima ca `check` în
     * bază: ar cere un subselect peste altă tabelă.
     */
    if (input.verificare_pontare === "cod_qr") {
      const { count, error: eroareAfise } = await db
        .from("puncte_lucru")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.tenant.organizationId)
        .eq("activ", true)
        .not("cod_pontaj", "is", null)
        .is("deleted_at", null);
      if (eroareAfise !== null) throw eroareAfise;
      if ((count ?? 0) === 0) {
        throw businessRule(
          "Niciun punct de lucru activ nu are cod de pontare, deci nu există afiș de scanat. " +
            "Generați codul din „Puncte de lucru”, sau alegeți „Codul QR e opțional”.",
        );
      }
    }

    const { data: existent, error: eroareCitire } = await db
      .from("setari_pontare_rapida")
      .select("id")
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .maybeSingle<{ id: string }>();
    if (eroareCitire !== null) throw eroareCitire;

    if (existent === null) {
      const { data, error } = await db
        .from("setari_pontare_rapida")
        .insert({ organization_id: ctx.tenant.organizationId, ...input })
        .select("id")
        .single<{ id: string }>();
      if (error !== null) traduEroare(error);
      return { id: data.id };
    }

    // `.select()` după `.update()`, obligatoriu: un UPDATE respins de clauza
    // `USING` afectează ZERO rânduri, fără eroare. Rezultatul gol e singurul
    // semn că politica a refuzat.
    const { data, error } = await db
      .from("setari_pontare_rapida")
      .update(input)
      .eq("id", existent.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle<{ id: string }>();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule(
        "Setările n-au putut fi salvate. Reîncărcați pagina și încercați din nou.",
      );
    }
    return { id: data.id };
  },
});
