// src/app/(app)/setari/organizatie/actions.ts
"use server";

import { z } from "zod";

import { createAction } from "@/lib/actions/create-action";
import { notFound } from "@/lib/actions/errors";

const textOptional = (maxim: number) => z.string().trim().max(maxim).optional();

const schemaOrganizatie = z.object({
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
