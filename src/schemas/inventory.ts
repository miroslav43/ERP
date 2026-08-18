// src/schemas/inventory.ts
// Validările de intrare pentru obiectele de inventar și circuitul predare/returnare.

import { z } from "zod";

export const STARI_OBIECT = ["nou", "bun", "uzat", "defect"] as const;
export type StareObiect = (typeof STARI_OBIECT)[number];

export const STATUSURI_OBIECT = ["in_stoc", "alocat", "in_reparatie", "casat"] as const;
export type StatusObiect = (typeof STATUSURI_OBIECT)[number];

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/u;
// Identic cu `inventory_items_numar_ck` din 0010_inventory.sql.
const RE_NUMAR_INVENTAR = /^[A-Za-z0-9][A-Za-z0-9 ._/-]{0,39}$/u;

/** Text opțional: cheia rămâne mereu prezentă (null), ca să nu lovim exactOptionalPropertyTypes. */
const textOptional = (maxim: number) =>
  z
    .string()
    .trim()
    .max(maxim, `Textul nu poate depăși ${String(maxim)} de caractere.`)
    .nullable()
    .default(null)
    .transform((valoare) => (valoare === null || valoare.length === 0 ? null : valoare));

const textObligatoriu = (minim: number, maxim: number, camp: string) =>
  z
    .string()
    .trim()
    .min(minim, `Câmpul „${camp}” este obligatoriu.`)
    .max(maxim, `Câmpul „${camp}” nu poate depăși ${String(maxim)} de caractere.`);

const dataOptionala = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .transform((valoare) => (valoare === null || valoare.length === 0 ? null : valoare))
  .refine(
    (valoare) => valoare === null || RE_DATA.test(valoare),
    "Data trebuie scrisă în formatul AAAA-LL-ZZ.",
  );

/** Moment opțional (timestamptz), acceptat ca șir ISO dintr-un `datetime-local`. */
const momentOptional = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .transform((valoare) => (valoare === null || valoare.length === 0 ? null : valoare))
  .refine(
    (valoare) => valoare === null || !Number.isNaN(Date.parse(valoare)),
    "Data și ora introduse nu sunt valide.",
  )
  .transform((valoare) => (valoare === null ? null : new Date(valoare).toISOString()));

const uuidOptional = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .transform((valoare) => (valoare === null || valoare.length === 0 ? null : valoare))
  .refine(
    (valoare) => valoare === null || z.uuid().safeParse(valoare).success,
    "Identificatorul selectat nu este valid.",
  );

// ── Filtre de listare (paginare keyset) ────────────────────────────────────

export const filtreInventarSchema = z.object({
  q: textOptional(200),
  numar: textOptional(40),
  status: z.enum(STATUSURI_OBIECT).nullable().default(null),
  stare: z.enum(STARI_OBIECT).nullable().default(null),
  category_id: uuidOptional,
  cursor: textOptional(400),
  limita: z.coerce.number().int().min(5).max(100).default(25),
});

export type FiltreInventar = z.infer<typeof filtreInventarSchema>;

// ── Obiect de inventar ──────────────────────────────────────────────────────

const campuriObiect = z.object({
  denumire: textObligatoriu(2, 200, "Denumire"),
  numar_inventar: z
    .string()
    .trim()
    .min(1, "Câmpul „Număr de inventar” este obligatoriu.")
    .max(40, "Numărul de inventar nu poate depăși 40 de caractere.")
    .regex(
      RE_NUMAR_INVENTAR,
      "Numărul de inventar poate conține litere, cifre, spații și „. _ / -”, și trebuie să înceapă cu o literă sau o cifră.",
    ),
  serie: textOptional(100),
  model: textOptional(120),
  producator: textOptional(120),
  category_id: uuidOptional,
  data_achizitie: dataOptionala,
  // Nu `z.union([z.coerce.number(), z.null()])`: `Number("")` dă `0`, nu `NaN`,
  // deci un câmp lăsat gol în formular ar fi trecut ca „0 lei” în loc de „necompletat”.
  // Golul se taie explicit, ÎNAINTE de coerciție.
  valoare: z
    .union([z.string(), z.number(), z.null()])
    .nullable()
    .default(null)
    .transform((valoare) => {
      if (valoare === null) return null;
      const text = String(valoare).trim();
      return text.length === 0 ? null : text;
    })
    .refine(
      (valoare) => valoare === null || /^-?\d+([.,]\d+)?$/u.test(valoare),
      "Valoarea introdusă nu este un număr valid.",
    )
    .transform((valoare) => (valoare === null ? null : Number(valoare.replace(",", "."))))
    .refine(
      (valoare) => valoare === null || (Number.isFinite(valoare) && valoare >= 0),
      "Valoarea nu poate fi negativă.",
    ),
  garantie_expira: dataOptionala,
  stare: z.enum(STARI_OBIECT).default("nou"),
  locatie: textOptional(200),
  observatii: textOptional(2000),
});

/** Garanția nu poate expira înainte de data achiziției — verificat și de `inventory_items_garantie_ck`. */
function valideazaGarantie(
  valoare: Readonly<{ garantie_expira: string | null; data_achizitie: string | null }>,
  ctx: z.RefinementCtx,
): void {
  if (
    valoare.garantie_expira !== null &&
    valoare.data_achizitie !== null &&
    valoare.garantie_expira < valoare.data_achizitie
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["garantie_expira"],
      message: "Garanția nu poate expira înainte de data achiziției.",
    });
  }
}

export const creeazaObiectSchema = campuriObiect.superRefine(valideazaGarantie);
export type CreeazaObiectInput = z.infer<typeof creeazaObiectSchema>;

export const actualizeazaObiectSchema = campuriObiect
  .extend({ id: z.uuid("Obiectul selectat nu este valid.") })
  .superRefine(valideazaGarantie);
export type ActualizeazaObiectInput = z.infer<typeof actualizeazaObiectSchema>;

// ── Predare / returnare / confirmare / casare ──────────────────────────────

export const predaObiectSchema = z.object({
  item_id: z.uuid("Obiectul selectat nu este valid."),
  employee_id: z.uuid("Angajatul selectat nu este valid."),
  predat_la: momentOptional,
  stare_la_predare: z.enum(STARI_OBIECT).default("bun"),
  observatii: textOptional(2000),
  pv_document_path: textOptional(500),
});
export type PredaObiectInput = z.infer<typeof predaObiectSchema>;

export const returneazaObiectSchema = z.object({
  id: z.uuid("Predarea-primirea selectată nu este validă."),
  returnat_la: momentOptional,
  stare_la_returnare: z.enum(STARI_OBIECT),
  observatii: textOptional(2000),
});
export type ReturneazaObiectInput = z.infer<typeof returneazaObiectSchema>;

export const confirmaPrimireaSchema = z.object({
  id: z.uuid("Predarea-primirea selectată nu este validă."),
});
export type ConfirmaPrimireaInput = z.infer<typeof confirmaPrimireaSchema>;

export const caseazaObiectSchema = z.object({
  id: z.uuid("Obiectul selectat nu este valid."),
});
export type CaseazaObiectInput = z.infer<typeof caseazaObiectSchema>;
