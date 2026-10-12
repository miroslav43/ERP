// src/schemas/soferi.ts
// Validările de intrare pentru șoferii flotei (0201, F9): permisul de
// conducere și legarea foii de parcurs de o deplasare.
//
// Fișier separat de `fleet.ts`, pe care îl scriu și fazele paralele ale
// flotei (F6–F8): o schemă nouă aici nu atinge liniile lor.

import { z } from "zod";

import { CATEGORII_PERMIS } from "@/domain/fleet/soferi";

import { textOptional } from "./comun";

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/u;

/** Data calendaristică obligatorie, `AAAA-LL-ZZ`, cu mesajul pe câmp. */
function dataObligatorie(lipsa: string) {
  return z
    .string(lipsa)
    .trim()
    .min(1, lipsa)
    .refine((v) => RE_DATA.test(v) && !Number.isNaN(Date.parse(v)), "Data nu este validă.");
}

/** Data calendaristică opțională: șirul gol devine `null`. */
const dataOptionala = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .transform((v) => (v === null || v.length === 0 ? null : v))
  .refine(
    (v) => v === null || (RE_DATA.test(v) && !Number.isNaN(Date.parse(v))),
    "Data nu este validă.",
  );

/**
 * Categoriile, în lista închisă din OUG 195/2002 art. 20. Comparația e fără
 * majuscule (`tr` = `Tr`); forma canonică și ordinea le pune baza
 * (`internal.permise_inainte`), schema doar refuză ce nu există.
 */
const categorii = z
  .array(z.string().trim(), "Alegeți cel puțin o categorie de permis.")
  .min(1, "Alegeți cel puțin o categorie de permis.")
  .max(
    CATEGORII_PERMIS.length,
    "Lista de categorii este mai lungă decât cea de pe permisul de conducere.",
  )
  .transform((lista) =>
    lista.map((c) => CATEGORII_PERMIS.find((k) => k.toUpperCase() === c.toUpperCase()) ?? c),
  )
  .refine(
    (lista) => lista.every((c) => (CATEGORII_PERMIS as readonly string[]).includes(c)),
    "Una dintre categorii nu există pe permisul de conducere românesc.",
  );

const campuriPermis = {
  numar: z
    .string("Scrieți numărul permisului.")
    .trim()
    .min(3, "Numărul permisului are cel puțin 3 caractere.")
    .max(30, "Numărul permisului are cel mult 30 de caractere."),
  categorii,
  eliberat_la: dataOptionala,
  expira_la: dataObligatorie("Scrieți data până la care e valabil permisul."),
  observatii: textOptional(1000),
};

function intervalCorect(
  v: Readonly<{ eliberat_la: string | null; expira_la: string }>,
  ctx: z.RefinementCtx,
): void {
  if (v.eliberat_la !== null && v.expira_la < v.eliberat_la) {
    ctx.addIssue({
      code: "custom",
      path: ["expira_la"],
      message: "Valabilitatea permisului nu se poate încheia înainte de data eliberării.",
    });
  }
}

/** Permisul nou, pe fișa unui angajat. */
export const permisNouSchema = z
  .object({ employee_id: z.uuid("Angajatul nu este valid."), ...campuriPermis })
  .superRefine(intervalCorect);
export type PermisNou = z.output<typeof permisNouSchema>;

/**
 * Reînnoirea sau corectura. `employee_id` călătorește doar pentru `revalidate`
 * (calea fișei); baza refuză oricum mutarea permisului pe alt om.
 */
export const actualizeazaPermisSchema = z
  .object({ id: z.uuid(), employee_id: z.uuid(), ...campuriPermis })
  .superRefine(intervalCorect);
export type ActualizeazaPermis = z.output<typeof actualizeazaPermisSchema>;

export const stergePermisSchema = z.object({ id: z.uuid(), employee_id: z.uuid() });

/**
 * Foaia de parcurs legată de deplasarea (delegația) șoferului. `null` = fără
 * legătură. Garda de firmă și de angajat stă în bază
 * (`internal.foi_deplasare_garda`).
 */
export const legaDeplasareaSchema = z.object({
  id: z.uuid(),
  business_trip_id: z
    .string()
    .trim()
    .nullable()
    .default(null)
    .transform((v) => (v === null || v.length === 0 ? null : v))
    .refine(
      (v) => v === null || z.uuid().safeParse(v).success,
      "Deplasarea aleasă nu este validă.",
    ),
});
export type LegaDeplasarea = z.output<typeof legaDeplasareaSchema>;
