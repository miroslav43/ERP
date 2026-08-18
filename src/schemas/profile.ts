// src/schemas/profile.ts
// Validarea pentru profilul propriu — nu ține de nicio organizație, deci nu
// împarte schema cu niciun modul de business.

import { z } from "zod";

const textOptional = (maxim: number) =>
  z
    .string()
    .trim()
    .max(maxim, `Textul nu poate depăși ${String(maxim)} de caractere.`)
    .nullable()
    .default(null)
    .transform((valoare) => (valoare === null || valoare.length === 0 ? null : valoare));

export const schemaProfilPropriu = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, "Numele nu poate fi gol.")
    .max(200, "Numele nu poate depăși 200 de caractere."),
  phone: textOptional(30),
});

export type IntrareProfilPropriu = z.output<typeof schemaProfilPropriu>;

export const schemaParolaNoua = z
  .object({
    parola_noua: z.string().min(8, "Parola trebuie să aibă cel puțin 8 caractere."),
    confirma_parola: z.string(),
  })
  .refine((valori) => valori.parola_noua === valori.confirma_parola, {
    message: "Parolele nu coincid.",
    path: ["confirma_parola"],
  });

export type IntrareParolaNoua = z.output<typeof schemaParolaNoua>;
