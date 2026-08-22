// src/app/(platform)/super-admin/organizatii/nou/actions.ts
"use server";

import { businessRule } from "@/lib/actions/errors";
import { createPlatformAction } from "@/lib/actions/platform";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { amprentaSensibila, catreBytea, encrypt, versiuneCaNumar } from "@/lib/crypto/aes-gcm";
import {
  creeazaOrganizatieMinimaSchema,
  onboardeazaOrganizatieSchema,
} from "@/schemas/organization";
import { ZILE_EXPIRARE_IMPLICIT } from "@/schemas/membership";

import { invitaMembru } from "../[orgId]/membri/actions";

const CAI_REVALIDATE = ["/super-admin", "/super-admin/organizatii"] as const;

interface RezultatOnboarding {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly invitatie:
    | Readonly<{ trimisa: true; prinEmail: boolean; linkInvitatie: string }>
    | Readonly<{ trimisa: false; eroare: string }>;
}

/**
 * Un singur pas de wizard, o singură scriere secvențială — același tipar
 * neatomic ca `creeazaOrganizatie` (`organizations` + `organization_features`
 * separate). Dacă invitația owner-ului eșuează la final (ex. limită de
 * rate-limit sau plafon de locuri), organizația TOT rămâne creată — se
 * retrimite invitația manual din ecranul de membri, nu se pierde restul
 * datelor completate la înrolare.
 */
export const onboardeazaOrganizatie = createPlatformAction<
  typeof onboardeazaOrganizatieSchema,
  RezultatOnboarding
>({
  name: "platforma.org.onboard",
  input: onboardeazaOrganizatieSchema,
  rateLimit: { max: 10, windowSeconds: 3600 },
  audit: {
    action: "org_created",
    entityType: "organizations",
    entityId: (_input, data) => data.id,
    organizationId: (_input, data) => data.id,
    allow: [
      "id",
      "name",
      "slug",
      "cui",
      "plan",
      "seats_limit",
      "judet",
      "oras",
      "forma_juridica",
      "cod_caen",
      "cod_caen_secundare",
    ],
  },
  revalidate: CAI_REVALIDATE,
  handler: async (ctx, input) => {
    const admin = createAdminSupabase();

    const { data: existent, error: eroareCautare } = await admin
      .from("organizations")
      .select("id, name, cui, slug")
      .or(`cui_normalizat.eq.${input.cui},slug.eq.${input.slug}`)
      .limit(1)
      .maybeSingle();
    if (eroareCautare) throw eroareCautare;
    if (existent) {
      throw businessRule(
        existent.cui === input.cui
          ? `Există deja o organizație cu CUI-ul ${input.cui}: „${existent.name}”.`
          : `Identificatorul „${input.slug}” este deja folosit de organizația „${existent.name}”.`,
      );
    }

    const { data: organizatie, error } = await admin
      .from("organizations")
      // Câmpurile opționale se omit complet când lipsesc (exactOptionalPropertyTypes).
      .insert({
        name: input.name,
        legal_name: input.legal_name,
        forma_juridica: input.forma_juridica,
        cui: input.cui,
        platitor_tva: input.platitor_tva,
        ...(input.reg_com === undefined ? {} : { reg_com: input.reg_com }),
        slug: input.slug,
        email_contact: input.email_contact,
        telefon_contact: input.telefon_contact,
        judet: input.judet,
        oras: input.oras,
        ...(input.adresa === undefined ? {} : { adresa: input.adresa }),
        ...(input.cod_postal === undefined ? {} : { cod_postal: input.cod_postal }),
        // Cod ISO 3166-1 alpha-2, NU denumirea țării: coloana are
        // `check (tara ~ '^[A-Z]{2}$')` din 0001_kernel.sql, iar „România”
        // făcea ca fiecare înrolare să pice cu 23514 (violare de CHECK),
        // afișat utilizatorului ca „Datele nu respectă regulile de validare”.
        tara: "RO",
        ...(input.website === undefined ? {} : { website: input.website }),
        ...(input.reprezentant_legal === undefined
          ? {}
          : { reprezentant_legal: input.reprezentant_legal }),
        ...(input.capital_social === undefined ? {} : { capital_social: input.capital_social }),
        ...(input.cod_caen === undefined ? {} : { cod_caen: input.cod_caen }),
        cod_caen_secundare: input.cod_caen_secundare,
        ...(input.sector === undefined ? {} : { sector: input.sector }),
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
        plan: input.plan,
        seats_limit: input.seats_limit,
        status: "pending",
        subscription_status: input.plan === "trial" ? "trialing" : "active",
        timezone: "Europe/Bucharest",
        locale: "ro-RO",
        moneda: "RON",
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id, name, slug")
      .single();
    if (error) throw error;

    // Modulele de bază se activează automat; restul se comută din fișa organizației.
    const { data: moduleDeBaza, error: eroareModule } = await admin
      .from("features")
      .select("feature_key")
      .eq("is_core", true);
    if (eroareModule) throw eroareModule;
    if (moduleDeBaza && moduleDeBaza.length > 0) {
      const { error: eroareActivare } = await admin.from("organization_features").insert(
        moduleDeBaza.map((modul) => ({
          organization_id: organizatie.id,
          feature_key: modul.feature_key,
          enabled: true,
          activated_at: ctx.now.toISOString(),
          activated_by: ctx.user.id,
        })),
      );
      if (eroareActivare) throw eroareActivare;
    }

    // CNP-ul reprezentantului legal (opțional) — exclusiv prin RPC, cu
    // sesiunea reală a apelantului (RPC-ul citește auth.uid() pentru audit).
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

    // Cont bancar principal (opțional, unul singur la înrolare — restul se
    // adaugă ulterior din ecranul dedicat).
    if (input.banca_nume !== undefined && input.banca_iban !== undefined) {
      const { error: eroareBanca } = await admin.from("organization_bank_accounts").insert({
        organization_id: organizatie.id,
        banca: input.banca_nume,
        iban: input.banca_iban,
        este_principal: true,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      });
      if (eroareBanca) throw eroareBanca;
    }

    // Punct de lucru principal (opțional, la fel — unul singur la înrolare).
    if (input.punct_lucru_denumire !== undefined) {
      const { error: eroarePunct } = await admin.from("puncte_lucru").insert({
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
    // ulterior din /salarizare/setari, cu avertismentul „neverificat de contabil”
    // deja existent acolo.
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

    // Invitația owner-ului — reutilizează fluxul existent (link magic, fără
    // parolă), doar declanșat automat aici, nu ca pas manual separat.
    const rezultatInvitatie = await invitaMembru({
      organizationId: organizatie.id,
      email: input.owner_email,
      role: "org_admin",
      expiraInZile: ZILE_EXPIRARE_IMPLICIT,
      nume: input.owner_nume,
      prenume: input.owner_prenume,
      telefon: input.owner_telefon,
    });

    return {
      id: organizatie.id,
      name: organizatie.name,
      slug: organizatie.slug,
      invitatie: rezultatInvitatie.ok
        ? {
            trimisa: true,
            prinEmail: rezultatInvitatie.data.prinEmail,
            linkInvitatie: rezultatInvitatie.data.linkInvitatie,
          }
        : { trimisa: false, eroare: rezultatInvitatie.error.message },
    };
  },
});


/**
 * Creează firma cu minimul și predă restul administratorului ei.
 *
 * Rămâne în `pending` — starea pe care o citește poarta din layout-ul
 * aplicației și care îl trimite pe administrator în asistent la prima intrare.
 * Nu se activează aici: activarea E terminarea asistentului.
 *
 * Modulele de bază se activează totuși acum: fără `nucleu`, `requireFeature`
 * dă 404 pe propriul tablou de bord, deci administratorul n-ar avea unde
 * ateriza nici măcar ca să completeze datele.
 */
export const creeazaOrganizatieMinima = createPlatformAction({
  name: "creeazaOrganizatieMinima",
  input: creeazaOrganizatieMinimaSchema,
  audit: {
    action: "update",
    entityType: "organizations",
    entityId: (_input, data) => (data as { id?: string } | null)?.id ?? null,
    allow: ["name", "cui", "status"],
  },
  revalidate: CAI_REVALIDATE,
  handler: async (ctx, input) => {
    const admin = createAdminSupabase();

    const { data: organizatie, error } = await admin
      .from("organizations")
      .insert({
        name: input.name,
        slug: input.slug,
        cui: input.cui,
        status: "pending",
        plan: "trial",
        seats_limit: 10,
        subscription_status: "trialing",
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id, name, slug")
      .single();
    if (error) throw error;

    const { data: moduleDeBaza } = await admin
      .from("features")
      .select("feature_key")
      .eq("is_core", true);
    if (moduleDeBaza && moduleDeBaza.length > 0) {
      const { error: eroareActivare } = await admin.from("organization_features").insert(
        moduleDeBaza.map((modul) => ({
          organization_id: organizatie.id,
          feature_key: modul.feature_key,
          enabled: true,
          activated_at: ctx.now.toISOString(),
          activated_by: ctx.user.id,
        })),
      );
      if (eroareActivare) throw eroareActivare;
    }

    // Invitația pleacă pe e-mail (Resend, live de la 2026-08-22). Linkul rămâne
    // în răspuns ca plasă de siguranță dacă mesajul nu ajunge.
    const rezultatInvitatie = await invitaMembru({
      organizationId: organizatie.id,
      email: input.admin_email,
      role: "org_admin",
      expiraInZile: ZILE_EXPIRARE_IMPLICIT,
    });

    return {
      id: organizatie.id,
      name: organizatie.name,
      slug: organizatie.slug,
      invitatie: rezultatInvitatie.ok
        ? {
            trimisa: true as const,
            prinEmail: rezultatInvitatie.data.prinEmail,
            linkInvitatie: rezultatInvitatie.data.linkInvitatie,
          }
        : { trimisa: false as const, eroare: rezultatInvitatie.error.message },
    };
  },
});
