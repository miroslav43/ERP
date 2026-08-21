// src/app/(app)/setari/organizatie/actions.ts
"use server";

import { z } from "zod";

import { createAction } from "@/lib/actions/create-action";
import { notFound } from "@/lib/actions/errors";
import { caenClasaSchema } from "@/schemas/organization";
import { valideazaSelectieCaen } from "@/domain/organization/caen-reguli";

const textOptional = (maxim: number) => z.string().trim().max(maxim).optional();

const schemaOrganizatie = z
  .object({
    name: z.string().trim().min(2, "Denumirea trebuie să aibă cel puțin 2 caractere.").max(160),
    legal_name: textOptional(200),
    forma_juridica: textOptional(40),
    cui: z
      .string()
      .trim()
      .regex(
        /^(RO)?\s?\d{2,10}$/i,
        "CUI-ul trebuie să conțină între 2 și 10 cifre, opțional prefixat cu RO.",
      )
      .optional(),
    platitor_tva: z.boolean(),
    reg_com: textOptional(40),
    adresa: textOptional(240),
    judet: textOptional(60),
    oras: textOptional(80),
    cod_postal: textOptional(12),
    tara: textOptional(60),
    email_contact: z.union([z.literal(""), z.email("Adresa de e-mail nu este validă.")]).optional(),
    telefon_contact: textOptional(30),
    website: z
      .union([z.literal(""), z.url("Adresa de web trebuie să înceapă cu https://")])
      .optional(),
    reprezentant_legal: textOptional(160),
    functie_reprezentant_legal: textOptional(120),
    capital_social: z
      .union([z.literal(""), z.coerce.number().min(0, "Capitalul social nu poate fi negativ.")])
      .optional(),
    cod_caen: z.union([z.literal(""), caenClasaSchema]).optional(),
    cod_caen_secundare: z.array(caenClasaSchema).max(50).default([]),
    sector: textOptional(4),
    ssm_furnizor_extern: textOptional(200),
    ssm_persoana_responsabila: textOptional(160),
    zile_concediu_anual_implicit: z.coerce
      .number("Numărul de zile trebuie să fie o cifră.")
      .int()
      .min(0)
      .max(60),
  })
  .superRefine((valori, ctx) => {
    const principal = valori.cod_caen === "" ? undefined : valori.cod_caen;
    const rezultat = valideazaSelectieCaen(
      valori.forma_juridica ?? "SRL",
      principal,
      valori.cod_caen_secundare,
    );
    if (!rezultat.valid) {
      ctx.addIssue({ code: "custom", message: rezultat.eroare, path: ["cod_caen_secundare"] });
    }
  });

const CAMPURI_AUDITATE = [
  "name",
  "legal_name",
  "forma_juridica",
  "cui",
  "platitor_tva",
  "reg_com",
  "adresa",
  "judet",
  "oras",
  "cod_postal",
  "tara",
  "email_contact",
  "telefon_contact",
  "website",
  "reprezentant_legal",
  "functie_reprezentant_legal",
  "capital_social",
  "cod_caen",
  "cod_caen_secundare",
  "sector",
  "ssm_furnizor_extern",
  "ssm_persoana_responsabila",
  "zile_concediu_anual_implicit",
] as const;

function golSauNull(valoare: string | undefined): string | null {
  if (valoare === undefined) {
    return null;
  }
  const curatat = valoare.trim();
  return curatat.length === 0 ? null : curatat;
}

export type DateOrganizatieActualizate = Readonly<{ id: string; name: string }>;

/**
 * plan, seats_limit, subscription_status și status NU fac parte din schemă: sunt blocate
 * de trigger în baza de date pentru org_admin (S9) și se modifică doar din panoul de super-admin.
 */
export const actualizeazaOrganizatia = createAction<
  typeof schemaOrganizatie,
  DateOrganizatieActualizate
>({
  name: "org.update_settings",
  input: schemaOrganizatie,
  permission: "organizations:update",
  minScope: "all",
  audit: {
    action: "update",
    entityType: "organizations",
    entityId: (_input, data) => data.id,
    allow: CAMPURI_AUDITATE,
  },
  revalidate: ["/setari/organizatie", "/panou"],
  handler: async (ctx, input): Promise<DateOrganizatieActualizate> => {
    // `cui` și `tara` sunt NOT NULL în baza de date: dacă lipsesc din payload,
    // câmpul se omite din UPDATE (păstrează valoarea existentă / implicită),
    // în loc să fie trimis `null`.
    const cui = golSauNull(input.cui)?.toUpperCase().replace(/\s+/g, "");
    const tara = golSauNull(input.tara);
    const capitalSocial =
      input.capital_social === undefined || input.capital_social === ""
        ? null
        : input.capital_social;
    const codCaen = golSauNull(input.cod_caen);

    // S1: organizația vine din tenant, nu din payload-ul clientului.
    const { data, error } = await ctx.supabase
      .from("organizations")
      .update({
        name: input.name.trim(),
        legal_name: golSauNull(input.legal_name),
        forma_juridica: golSauNull(input.forma_juridica),
        ...(cui === undefined ? {} : { cui }),
        platitor_tva: input.platitor_tva,
        reg_com: golSauNull(input.reg_com),
        adresa: golSauNull(input.adresa),
        judet: golSauNull(input.judet),
        oras: golSauNull(input.oras),
        cod_postal: golSauNull(input.cod_postal),
        ...(tara === null ? {} : { tara }),
        email_contact: golSauNull(input.email_contact),
        telefon_contact: golSauNull(input.telefon_contact),
        website: golSauNull(input.website),
        reprezentant_legal: golSauNull(input.reprezentant_legal),
        functie_reprezentant_legal: golSauNull(input.functie_reprezentant_legal),
        capital_social: capitalSocial,
        cod_caen: codCaen,
        cod_caen_secundare: input.cod_caen_secundare,
        sector: golSauNull(input.sector),
        ssm_furnizor_extern: golSauNull(input.ssm_furnizor_extern),
        ssm_persoana_responsabila: golSauNull(input.ssm_persoana_responsabila),
        zile_concediu_anual_implicit: input.zile_concediu_anual_implicit,
        updated_by: ctx.user.id,
        updated_at: ctx.now.toISOString(),
      })
      .eq("id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id, name")
      .maybeSingle();

    if (error !== null) {
      throw error;
    }
    if (data === null) {
      throw notFound("Organizația nu a fost găsită sau nu mai este activă.");
    }
    return { id: data.id, name: data.name };
  },
});
