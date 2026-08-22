"use server";

import { revalidatePath } from "next/cache";

import { createAction } from "@/lib/actions/create-action";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { businessRule } from "@/lib/actions/errors";
import { amprentaSensibila, catreBytea, encrypt, versiuneCaNumar } from "@/lib/crypto/aes-gcm";
import { completeazaFirmaSchema } from "@/schemas/organization";

/**
 * Administratorul completează datele firmei la prima intrare.
 *
 * Oglindă a lui `onboardeazaOrganizatie` din consolă, cu două diferenţe:
 * organizația EXISTĂ deja (deci `update`, nu `insert`) și proprietarul e chiar
 * apelantul (deci pasul 6 nu are ce colecta).
 *
 * Scrie prin clientul de SESIUNE, nu prin `createAdminSupabase()`: un
 * `org_admin` are dreptul pe propria firmă, iar RLS îl confirmă. Aici ocolirea
 * n-ar fi doar inutilă, ci ar șterge singura verificare care garantează că
 * nimeni nu completează datele ALTEI firme.
 *
 * Terminarea trece organizația din `pending` în `active` — exact poarta pe care
 * o citește layout-ul aplicației.
 */
export const completeazaDateleFirmei = createAction({
  name: "completeazaDateleFirmei",
  feature: "nucleu",
  permission: "organizations:update",
  minScope: "all",
  input: completeazaFirmaSchema,
  audit: {
    action: "update",
    entityType: "organizations",
    entityId: () => null,
    allow: ["legal_name", "status"],
  },
  revalidate: ["/bun-venit", "/panou"],
  handler: async (ctx, input) => {
    const { data: organizatie, error: eroareCitire } = await ctx.supabase
      .from("organizations")
      .select("id, status")
      .eq("id", ctx.tenant.organizationId)
      .maybeSingle();

    if (eroareCitire !== null) throw eroareCitire;
    if (organizatie === null) {
      throw businessRule("Organizația nu a fost găsită.");
    }
    if (organizatie.status !== "pending") {
      // Doi administratori care termină asistentul în paralel: al doilea află
      // că nu mai are ce completa, în loc să suprascrie tăcut munca primului.
      throw businessRule("Datele firmei au fost deja completate.");
    }

    const { data: actualizata, error } = await ctx.supabase
      .from("organizations")
      .update({
        legal_name: input.legal_name,
        forma_juridica: input.forma_juridica,
        ...(input.reg_com === undefined ? {} : { reg_com: input.reg_com }),
        platitor_tva: input.platitor_tva,
        ...(input.capital_social === undefined ? {} : { capital_social: input.capital_social }),
        ...(input.cod_caen === undefined ? {} : { cod_caen: input.cod_caen }),
        ...(input.cod_caen_secundare === undefined
          ? {}
          : { cod_caen_secundare: input.cod_caen_secundare }),
        judet: input.judet,
        oras: input.oras,
        ...(input.sector === undefined ? {} : { sector: input.sector }),
        ...(input.email_contact === undefined ? {} : { email_contact: input.email_contact }),
        ...(input.telefon_contact === undefined ? {} : { telefon_contact: input.telefon_contact }),
        ...(input.reprezentant_legal === undefined
          ? {}
          : { reprezentant_legal: input.reprezentant_legal }),
        ...(input.functie_reprezentant_legal === undefined
          ? {}
          : { functie_reprezentant_legal: input.functie_reprezentant_legal }),
        ...(input.ssm_furnizor_extern === undefined
          ? {}
          : { ssm_furnizor_extern: input.ssm_furnizor_extern }),
        ...(input.ssm_persoana_responsabila === undefined
          ? {}
          : { ssm_persoana_responsabila: input.ssm_persoana_responsabila }),
        zile_concediu_anual_implicit: input.zile_concediu_anual_implicit,
        status: "active",
        activated_at: ctx.now.toISOString(),
        updated_by: ctx.user.id,
      })
      .eq("id", organizatie.id)
      // `pending` explicit în filtru: dacă altcineva a activat între citirea de
      // mai sus și scrierea asta, actualizarea nu prinde niciun rând.
      .eq("status", "pending")
      .select("id, name, status")
      .maybeSingle();

    if (error !== null) throw error;
    // Un UPDATE respins de clauza `USING` afectează ZERO rânduri, fără eroare.
    // Fără `.select()` de mai sus și verificarea asta, refuzul ar arăta ca succes.
    if (actualizata === null) {
      throw businessRule("Datele firmei au fost completate între timp de altcineva.");
    }

    // `plan`, `seats_limit` și datele proprietarului ajung în input fiindcă
    // schema e comună cu înrolarea, dar NU se scriu: primele două sunt decizii
    // comerciale ale platformei, ultimele descriu un membru care există deja.
    // CNP-ul reprezentantului legal — exclusiv prin RPC, cu sesiunea reală:
    // funcția citește `auth.uid()` pentru audit.
    if (input.reprezentant_cnp !== undefined) {
      const criptat = encrypt(input.reprezentant_cnp);
      const { error: eroareCnp } = await ctx.supabase.rpc("org_write_sensitive", {
        p_organization_id: organizatie.id,
        p_cnp_ciphertext: catreBytea(criptat.ciphertext),
        p_cnp_iv: catreBytea(criptat.iv),
        p_cnp_tag: catreBytea(criptat.tag),
        p_cnp_key_version: versiuneCaNumar(criptat.keyVersion),
        p_cnp_last4: input.reprezentant_cnp.slice(-4),
        p_cnp_hash: amprentaSensibila(input.reprezentant_cnp),
      });
      if (eroareCnp) throw eroareCnp;
    }

    if (input.banca_nume !== undefined && input.banca_iban !== undefined) {
      const { error: eroareBanca } = await ctx.supabase.from("organization_bank_accounts").insert({
        organization_id: organizatie.id,
        banca: input.banca_nume,
        iban: input.banca_iban,
        este_principal: true,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      });
      if (eroareBanca) throw eroareBanca;
    }

    if (input.punct_lucru_denumire !== undefined) {
      const { error: eroarePunct } = await ctx.supabase.from("puncte_lucru").insert({
        organization_id: organizatie.id,
        denumire: input.punct_lucru_denumire,
        ...(input.punct_lucru_adresa === undefined ? {} : { adresa: input.punct_lucru_adresa }),
        ...(input.punct_lucru_judet === undefined ? {} : { judet: input.punct_lucru_judet }),
        ...(input.punct_lucru_oras === undefined ? {} : { oras: input.punct_lucru_oras }),
        ...(input.punct_lucru_cod_postal === undefined
          ? {}
          : { cod_postal: input.punct_lucru_cod_postal }),
        sediu_principal: true,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      });
      if (eroarePunct) throw eroarePunct;
    }

    // Setările de salarizare pornesc cu cotele statutare curente — editabile
    // ulterior din /salarizare/setari, unde stă și avertismentul „neverificat
    // de contabil". Oglindă a ceea ce face `onboardeazaOrganizatie` la crearea
    // completă; fără ele, prima încercare de stat de plată n-are pe ce se baza.
    //
    // `createAdminSupabase()` ocolește RLS DELIBERAT, și e singura cale care
    // funcționează: politica `payroll_settings_insert` cere
    // `app.feature_on(organization_id, 'payroll')`, iar la crearea minimă se
    // activează doar modulele `is_core` — `payroll` nu e printre ele. Cu
    // clientul de sesiune, inserarea ar fi refuzată TĂCUT: zero rânduri, nicio
    // eroare, iar lipsa s-ar afla abia la prima salarizare.
    //
    // Filtrul pe organizație e explicit prin `organization_id` de mai jos, iar
    // dreptul de a ajunge aici a fost deja verificat de `createAction`.
    const admin = createAdminSupabase();
    const { error: eroareSetari } = await admin.from("payroll_settings").insert({
      organization_id: organizatie.id,
      valabil_de_la: ctx.now.toISOString().slice(0, 10),
      cota_cas: 0.25,
      cota_cass: 0.1,
      cota_impozit: 0.1,
      cota_cam_angajator: 0.0225,
      plata_avans: input.plata_avans,
      ...(input.ziua_plata_avans === undefined ? {} : { ziua_plata_avans: input.ziua_plata_avans }),
      ...(input.ziua_plata_lichidare === undefined
        ? {}
        : { ziua_plata_lichidare: input.ziua_plata_lichidare }),
      ...(input.tichete_furnizor === undefined ? {} : { tichete_furnizor: input.tichete_furnizor }),
      created_by: ctx.user.id,
      updated_by: ctx.user.id,
    });
    if (eroareSetari) throw eroareSetari;

    // Layout-ul aplicației citește starea firmei memoizat, per request; după
    // activare, următoarea navigare trebuie să vadă `active`, nu cache-ul.
    revalidatePath("/", "layout");

    return { id: actualizata.id, name: actualizata.name };
  },
});
