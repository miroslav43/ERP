// src/schemas/profile.ts
// Validarea pentru profilul propriu — nu ține de nicio organizație, deci nu
// împarte schema cu niciun modul de business. Împarte însă ajutoarele comune
// (`telefonOptional` din `./comun`) și politica de parolă (`parolaSchema` din
// `./auth`): un număr de telefon sau o parolă nu au altă regulă aici decât în
// restul aplicației.

import { z } from "zod";

import { parolaSchema } from "./auth";
import { telefonOptional } from "./comun";

export const schemaProfilPropriu = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, "Numele nu poate fi gol.")
    .max(200, "Numele nu poate depăși 200 de caractere."),
  phone: telefonOptional,
});

export type IntrareProfilPropriu = z.output<typeof schemaProfilPropriu>;

/**
 * Parola nouă din cont: 12–72 de caractere, ca la invitație și la resetare.
 * Până la 8 oct 2026 pragul era 8 (QA, ANG-030) — un cont deschis cu o parolă
 * de 12 putea coborî la 8 din profil.
 */
export const schemaParolaNoua = z
  .object({
    parola_noua: parolaSchema,
    confirma_parola: z.string(),
  })
  .refine((valori) => valori.parola_noua === valori.confirma_parola, {
    message: "Parolele nu coincid.",
    path: ["confirma_parola"],
  });

export type IntrareParolaNoua = z.output<typeof schemaParolaNoua>;
