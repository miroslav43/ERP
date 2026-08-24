// src/schemas/job-position.ts
import { z } from "zod";

import { codCorExista } from "@/domain/hr/cor-nomenclator";

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
  )
  /**
   * Codul trebuie să EXISTE în nomenclator, nu doar să aibă șase cifre.
   *
   * Până acum singura verificare era formatul. Șase cifre inventate treceau
   * nedetectate până la exportul REVISAL, unde codul e blocant — adică luni mai
   * târziu, la prima transmitere către ITM, când funcția e deja pe contractele
   * semnate ale mai multor oameni.
   */
  .refine(
    (valoare) => valoare === null || codCorExista(valoare),
    "Codul COR nu există în Clasificarea Ocupațiilor din România. Căutați ocupația după denumire.",
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

// ── Filtrele nomenclatorului ─────────────────────────────────────────────────

/**
 * Coloanele după care se poate sorta lista de funcții.
 *
 * `cor` și `angajati` NU sunt coloane în bază: prima e denumirea ocupației,
 * care trăiește în nomenclatorul COR din `src/domain/hr/`, a doua e o
 * numărătoare peste `employees`. Amândouă se sortează în memorie — vezi nota
 * din `src/lib/queries/job-positions.ts` despre de ce nomenclatorul se citește
 * întreg.
 */
export const SORTARI_FUNCTII = ["denumire", "cod", "cor", "angajati"] as const;
export type SortareFunctii = (typeof SORTARI_FUNCTII)[number];

/**
 * Fiecare câmp are `.default(...)`: `filtreDinUrl` cade pe `schema.parse({})`
 * când adresa conține o valoare invalidă, iar fără implicite acolo n-ar avea pe
 * ce cădea și ar arunca.
 *
 * `stare` NU e implicit „activă". Ar ascunde tăcut funcțiile dezactivate, iar
 * omul care caută una și n-o găsește n-ar avea niciun indiciu că lista e
 * filtrată — exact felul de gol fără explicație pe care îl documentează
 * `docs/design/ecrane/capcane.md`.
 */
export const filtreFunctiiSchema = z.object({
  q: textOptional(120),
  stare: z.enum(["activa", "inactiva"]).nullable().default(null),
  /** `lipsa` — doar funcțiile fără cod COR, cele care blochează REVISAL-ul. */
  cor: z.enum(["lipsa"]).nullable().default(null),
  /** Forma din URL: `denumire` crescător, `-denumire` descrescător. */
  sort: textOptional(40),
});

export type FiltreFunctii = z.infer<typeof filtreFunctiiSchema>;
