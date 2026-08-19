// src/schemas/punct-lucru.ts
import { z } from "zod";
import { judetSchema } from "@/schemas/organization";

const textOptional = (maxim: number) =>
  z
    .string()
    .trim()
    .max(maxim, `Textul nu poate depăși ${String(maxim)} de caractere.`)
    .nullable()
    .default(null)
    .transform((valoare) => (valoare === null || valoare.length === 0 ? null : valoare));

export const creeazaPunctLucruSchema = z.object({
  denumire: z.string().trim().min(2, "Denumirea trebuie să aibă cel puțin 2 caractere.").max(160),
  adresa: textOptional(240),
  judet: judetSchema.nullable().default(null),
  oras: textOptional(80),
  cod_postal: textOptional(10),
  sediu_principal: z.boolean().default(false),
  observatii: textOptional(1000),
});

export const actualizeazaPunctLucruSchema = creeazaPunctLucruSchema.extend({
  id: z.uuid("Punctul de lucru selectat nu este valid."),
});

export const dezactiveazaPunctLucruSchema = z.object({
  id: z.uuid("Punctul de lucru selectat nu este valid."),
});
