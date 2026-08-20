// src/schemas/job-position.ts
import { z } from "zod";

const textOptional = (maxim: number) =>
  z
    .string()
    .trim()
    .max(maxim, `Textul nu poate depăși ${String(maxim)} de caractere.`)
    .nullable()
    .default(null)
    .transform((valoare) => (valoare === null || valoare.length === 0 ? null : valoare));

const codCorOptional = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .transform((valoare) => (valoare === null || valoare.length === 0 ? null : valoare))
  .refine(
    (valoare) => valoare === null || /^[0-9]{6}$/.test(valoare),
    "Codul COR are 6 cifre (ex. 251401), conform ultimei variante REVISAL.",
  );

export const creeazaFunctieSchema = z.object({
  cod: z.string().trim().min(1, "Codul funcției este obligatoriu.").max(32),
  denumire: z.string().trim().min(2, "Denumirea trebuie să aibă cel puțin 2 caractere.").max(160),
  cod_cor: codCorOptional,
  nivel_studii: textOptional(80),
  descriere: textOptional(1000),
});

export const actualizeazaFunctieSchema = creeazaFunctieSchema
  .omit({ cod: true })
  .extend({ id: z.uuid("Funcția selectată nu este validă.") });

export const dezactiveazaFunctieSchema = z.object({
  id: z.uuid("Funcția selectată nu este validă."),
});
