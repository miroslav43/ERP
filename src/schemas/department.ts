// src/schemas/department.ts
import { z } from "zod";

const textOptional = (maxim: number) =>
  z
    .string()
    .trim()
    .max(maxim, `Textul nu poate depăși ${String(maxim)} de caractere.`)
    .nullable()
    .default(null)
    .transform((valoare) => (valoare === null || valoare.length === 0 ? null : valoare));

const uuidOptional = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .transform((valoare) => (valoare === null || valoare.length === 0 ? null : valoare))
  .refine(
    (valoare) => valoare === null || z.uuid().safeParse(valoare).success,
    "Departamentul superior selectat nu este valid.",
  );

export const creeazaDepartamentSchema = z.object({
  cod: z.string().trim().min(1, "Codul departamentului este obligatoriu.").max(32),
  denumire: z.string().trim().min(2, "Denumirea trebuie să aibă cel puțin 2 caractere.").max(160),
  descriere: textOptional(1000),
  parent_id: uuidOptional,
  manager_employee_id: uuidOptional,
  cost_center: textOptional(40),
});

export const actualizeazaDepartamentSchema = creeazaDepartamentSchema
  .omit({ cod: true })
  .extend({ id: z.uuid("Departamentul selectat nu este valid.") });

export const mutaDepartamentSchema = z.object({
  id: z.uuid("Departamentul selectat nu este valid."),
  parent_id: uuidOptional,
});

export const dezactiveazaDepartamentSchema = z.object({
  id: z.uuid("Departamentul selectat nu este valid."),
});
