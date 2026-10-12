// src/schemas/flota-fiscal.ts
// Validările de intrare pentru fiscalul flotei (0202, F10): regimul fiscal al
// vehiculului pe perioade, norma proprie de consum și regimul de impozitare al
// firmei.
//
// Fișier separat de `fleet.ts`, pe care îl scriu și fazele paralele ale
// flotei. Regulile de formă le repetă pe cele ale bazei (CHECK-urile `vfr_*` și
// `vcn_*`), ca omul să afle pe câmp, înainte de bază, ce nu se potrivește.

import { z } from "zod";

import {
  EXCEPTII_FISCALE,
  REGIMURI_FISCALE,
  REGIMURI_IMPOZITARE,
  TITLURI_FOLOSINTA,
  esteMasinaPersonala,
} from "@/domain/fleet/fiscal";

import { enumOptional, numarObligatoriu, numarOptional, textOptional } from "./comun";

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/u;

/** Folosită și de amenzi și incidente (`flota-amenzi.ts`): o singură parsare a datei calendaristice. */
export function dataObligatorie(lipsa: string) {
  return z
    .string(lipsa)
    .trim()
    .min(1, lipsa)
    .refine((v) => RE_DATA.test(v) && !Number.isNaN(Date.parse(v)), "Data nu este validă.");
}

export const dataOptionala = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .transform((v) => (v === null || v.length === 0 ? null : v))
  .refine(
    (v) => v === null || (RE_DATA.test(v) && !Number.isNaN(Date.parse(v))),
    "Data nu este validă.",
  );

export const idOptional = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .transform((v) => (v === null || v.length === 0 ? null : v))
  .refine((v) => v === null || z.uuid().safeParse(v).success, "Persoana aleasă nu este validă.");

/** Titlurile la care avantajul se evaluează la nivelul chiriei. */
const TITLURI_CU_CHIRIE = new Set(["inchiriat", "leasing_operational", "chirie_persoana_fizica"]);

/** O perioadă nouă a regimului fiscal. Corectura e ștergere + perioadă nouă. */
export const regimFiscalNouSchema = z
  .object({
    vehicle_id: z.uuid("Vehiculul nu este valid."),
    valabil_de_la: dataObligatorie("Scrieți data de la care se aplică regimul."),
    regim: z.enum(REGIMURI_FISCALE, "Alegeți regimul de deducere."),
    exceptie: enumOptional(EXCEPTII_FISCALE, "Alegeți categoria exceptată."),
    motiv: z
      .string("Scrieți motivul încadrării.")
      .trim()
      .min(3, "Scrieți motivul încadrării, în cel puțin 3 caractere.")
      .max(1000, "Motivul are cel mult 1.000 de caractere."),
    titlu_folosinta: z
      .enum(TITLURI_FOLOSINTA, "Alegeți al cui e vehiculul.")
      .default("proprietate"),
    proprietar_employee_id: idOptional,
    chirie_lunara: numarOptional({
      min: 0,
      max: 10_000_000,
      mesaj: "Chiria trebuie să fie un număr.",
      interval: "Chiria lunară e între 0 și 10.000.000 lei.",
    }),
    contract_numar: textOptional(60),
    contract_data: dataOptionala,
  })
  .superRefine((v, ctx) => {
    if (v.regim === "exceptat_categorie" && v.exceptie === null) {
      ctx.addIssue({
        code: "custom",
        path: ["exceptie"],
        message: "Alegeți categoria exceptată (art. 25 alin. (3) lit. l) pct. 1–5).",
      });
    }
    if (v.regim !== "exceptat_categorie" && v.exceptie !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["exceptie"],
        message: "Categoria exceptată se alege doar la regimul „categorie exceptată”.",
      });
    }
    const personala = esteMasinaPersonala(v.titlu_folosinta);
    if (personala && v.proprietar_employee_id === null) {
      ctx.addIssue({
        code: "custom",
        path: ["proprietar_employee_id"],
        message: "Alegeți angajatul a cărui mașină personală o folosește firma.",
      });
    }
    if (!personala && v.proprietar_employee_id !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["proprietar_employee_id"],
        message: "Proprietarul se alege doar pentru mașina personală (comodat sau chirie).",
      });
    }
    if (v.chirie_lunara !== null && !TITLURI_CU_CHIRIE.has(v.titlu_folosinta)) {
      ctx.addIssue({
        code: "custom",
        path: ["chirie_lunara"],
        message:
          "Chiria se completează doar la vehiculul închiriat, în leasing operațional sau cu chirie de la o persoană fizică.",
      });
    }
  });
export type RegimFiscalNou = z.output<typeof regimFiscalNouSchema>;

/** O normă proprie de consum, cu decizia internă care o stabilește. */
export const normaConsumNouaSchema = z.object({
  vehicle_id: z.uuid("Vehiculul nu este valid."),
  valabil_de_la: dataObligatorie("Scrieți data de la care se aplică norma."),
  l_100km: numarObligatoriu({
    min: 0.01,
    max: 300,
    lipsa: "Scrieți norma, în litri la 100 km.",
    mesaj: "Norma trebuie să fie un număr.",
    interval: "Norma e între 0,01 și 300 de litri la 100 km.",
  }),
  decizie_numar: textOptional(60),
  decizie_data: dataOptionala,
  observatii: textOptional(1000),
});
export type NormaConsumNoua = z.output<typeof normaConsumNouaSchema>;

/** Ștergerea logică a unei perioade (regim sau normă). */
export const stergePerioadaFiscalaSchema = z.object({
  id: z.uuid(),
  vehicle_id: z.uuid(),
});

/** Regimul de impozitare al firmei; gol = nestabilit. */
export const regimImpozitareSchema = z.object({
  regim_impozitare: enumOptional(REGIMURI_IMPOZITARE, "Alegeți regimul de impozitare."),
});
export type RegimImpozitareFirma = z.output<typeof regimImpozitareSchema>;

/**
 * Luna paginii fiscale, din `?luna=AAAA-LL`. Orice altceva (lipsă, format
 * greșit, lună inexistentă) cade pe luna implicită primită de la apelant.
 */
export function lunaDinParametru(valoare: string | undefined, implicit: string): string {
  if (valoare === undefined || !/^\d{4}-(0[1-9]|1[0-2])$/u.test(valoare)) return implicit;
  return valoare;
}
