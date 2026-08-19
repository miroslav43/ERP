// src/schemas/announcement.ts
import { z } from "zod";

export const anuntNouSchema = z.object({
  titlu: z.string().trim().min(1, "Titlul este obligatoriu.").max(200),
  continut: z.string().trim().min(1, "Conținutul este obligatoriu.").max(10000),
  fixat: z.coerce.boolean().default(false),
  publica_acum: z.coerce.boolean().default(false),
  expira_la: z
    .string()
    .trim()
    .nullable()
    .default(null)
    .transform((v) => (v === null || v.length === 0 ? null : v)),
});
export type IntrareAnuntNou = z.output<typeof anuntNouSchema>;

export const idAnuntSchema = z.object({ id: z.uuid() });
