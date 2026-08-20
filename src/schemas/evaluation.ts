// src/schemas/evaluation.ts
import { z } from "zod";

const textOptional = (maxim: number) =>
  z
    .string()
    .trim()
    .max(maxim, `Textul nu poate depăși ${String(maxim)} de caractere.`)
    .nullable()
    .default(null)
    .transform((valoare) => (valoare === null || valoare.length === 0 ? null : valoare));

export const STATUSURI_EVALUARE = ["draft", "finalizat"] as const;
export type StatusEvaluare = (typeof STATUSURI_EVALUARE)[number];

// ── Șabloane ──────────────────────────────────────────────────────────────────
// Criteriile intră ca text, câte unul pe linie — codul se generează server-side
// (slug din denumire), ca la atribuțiile fișei postului din wizard-ul de
// înrolare. Scala e fixă (1-5): un editor de scale pe rând, per criteriu, ar
// adăuga complexitate disproporționată față de valoarea reală aici.
export const creeazaSablonEvaluareSchema = z.object({
  denumire: z.string().trim().min(2, "Denumirea trebuie să aibă cel puțin 2 caractere.").max(160),
  descriere: textOptional(500),
  criterii_text: z
    .string()
    .trim()
    .min(1, "Adăugați cel puțin un criteriu, câte unul pe linie."),
});

export const dezactiveazaSablonEvaluareSchema = z.object({
  id: z.uuid("Șablonul selectat nu este valid."),
});

// ── Evaluări ──────────────────────────────────────────────────────────────────

export const raspunsCriteriuSchema = z.object({
  criteriu_cod: z.string().trim().min(1).max(80),
  scor: z.coerce.number().int().min(0).max(10),
  comentariu: z
    .string()
    .trim()
    .max(1000)
    .nullable()
    .default(null)
    .transform((v) => (v === null || v.length === 0 ? null : v)),
});

export const creeazaEvaluareSchema = z.object({
  employee_id: z.uuid("Angajatul selectat nu este valid."),
  template_id: z.uuid("Alegeți un șablon de evaluare."),
  data_evaluarii: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/u, "Data trebuie scrisă în formatul AAAA-LL-ZZ."),
  raspunsuri: z.array(raspunsCriteriuSchema).min(1, "Completați cel puțin un criteriu."),
  concluzie: textOptional(4000),
  status: z.enum(STATUSURI_EVALUARE).default("finalizat"),
});
