// src/schemas/registru.ts
//
// Schemele registrului de înregistrare a documentelor.
//
// Înregistrarea manuală acoperă documentele INTRATE pe hârtie, pe care nicio
// tabelă nu le are: o demisie, o adresă de la inspectorat, o citație. Ordinul
// 217/1996 art. 8 cere înregistrarea TUTUROR documentelor intrate, iar Codul
// muncii art. 81 obligă expres la înregistrarea demisiei.
//
// `sens = "iesire"` lipsește deliberat din enum: ce emite firma are o sursă în
// bază și un trigger care înregistrează singur. O ieșire introdusă de mână ar fi
// un document pe care aplicația nu-l are. Baza refuză oricum, cu P0001; schema
// oprește mai devreme, cu un mesaj mai bun.

import { z } from "zod";

const textOptional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .default(null)
    .transform((v) => (v === null || v.length === 0 ? null : v));

const ziOptionala = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .transform((v) => (v === null || v.length === 0 ? null : v))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data nu are formatul așteptat.");

const intregOptional = (max: number) =>
  z
    .string()
    .trim()
    .nullable()
    .default(null)
    .transform((v) => (v === null || v.length === 0 ? null : Number(v)))
    .refine(
      (v) => v === null || (Number.isInteger(v) && v >= 0 && v <= max),
      `Valoarea trebuie să fie un număr întreg între 0 și ${max}.`,
    );

export const inregistrareManualaSchema = z.object({
  sens: z.enum(["intrare", "intern"], {
    message: "Manual se pot înregistra doar documente intrate sau de uz intern.",
  }),
  tip_document: z
    .string()
    .trim()
    .regex(
      /^[a-z][a-z0-9_]{1,63}$/,
      "Tipul documentului se scrie cu litere mici, cifre și liniuță de subliniere.",
    ),
  // Art. 9 cere „conţinutul documentului în rezumat”. Fără el, rândul de registru
  // nu spune nimic la un control — de aceea e singurul câmp obligatoriu în plus.
  continut_rezumat: z
    .string()
    .trim()
    .min(3, "Conținutul documentului în rezumat este obligatoriu.")
    .max(500),
  numar_document_emitent: textOptional(120),
  data_document_emitent: ziOptionala,
  emitent: textOptional(200),
  numar_file: intregOptional(9999),
  numar_anexe: intregOptional(9999),
  punct_lucru_id: z
    .string()
    .trim()
    .nullable()
    .default(null)
    .transform((v) => (v === null || v.length === 0 ? null : v))
    .refine((v) => v === null || z.uuid().safeParse(v).success, "Punctul de lucru nu e valid."),
});
export type IntrareInregistrareManuala = z.output<typeof inregistrareManualaSchema>;

/** Anul se închide DUPĂ 31 decembrie — art. 9. Baza verifică din nou. */
export const anExercitiuSchema = z.object({
  an: z.coerce.number().int().min(2000).max(2200),
});

export const redeschidereExercitiuSchema = z.object({
  an: z.coerce.number().int().min(2000).max(2200),
  motiv: z
    .string()
    .trim()
    .min(3, "Redeschiderea unui exercițiu cere un motiv.")
    .max(500, "Motivul are cel mult 500 de caractere."),
});

/* ---------------------------- nomenclatorul ------------------------------ */

/**
 * Ce poate schimba o firmă la un dosar din nomenclator: conținutul și termenul
 * de păstrare. Indicativul NU e editabil — art. 11 îl derivă din cifra romană,
 * litera și cifra arabă, iar baza îl calculează ca o coloană generată.
 */
export const dosarNomenclatorSchema = z.object({
  id: z.uuid(),
  continut: z
    .string()
    .trim()
    .min(3, "Conținutul dosarului este obligatoriu.")
    .max(500, "Conținutul are cel mult 500 de caractere."),
  termen_pastrare: z
    .string()
    .trim()
    .min(1, "Termenul de păstrare este obligatoriu.")
    .max(20, "Termenul de păstrare are cel mult 20 de caractere."),
});

/** Confirmarea nomenclatorului de către Arhivele Naționale — art. 5 lit. a). */
export const avizNomenclatorSchema = z.object({
  avizat_la: ziOptionala,
  numar_aviz: textOptional(60),
  directia_judeteana: textOptional(120),
  observatii: textOptional(1000),
});
