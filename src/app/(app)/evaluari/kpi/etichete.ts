// src/app/(app)/evaluari/kpi/etichete.ts

/**
 * Vocabularul KPI-ului lunar.
 *
 * Separat de `../etichete.ts` fiindcă portalul îl importă direct, iar acolo nu
 * are ce căuta vocabularul evaluării anuale. Convenția `etichete.ts` per modul
 * există tocmai ca harta să nu fie copiată în pagină și apoi în portal.
 */

import type { TonStare } from "@/components/ui/badge";

export const LUNI_RO = [
  "ianuarie",
  "februarie",
  "martie",
  "aprilie",
  "mai",
  "iunie",
  "iulie",
  "august",
  "septembrie",
  "octombrie",
  "noiembrie",
  "decembrie",
] as const;

/** „martie 2026". Luna e 1..12; în afara intervalului se întoarce doar anul. */
export function numeLuna(an: number, luna: number): string {
  const nume = LUNI_RO[luna - 1];
  return nume === undefined ? String(an) : `${nume} ${String(an)}`;
}

/**
 * Tonul unui procent de îndeplinire.
 *
 * Pragurile diferă de `tonPunctaj` al evaluării anuale, și nu din neglijență:
 * acolo procentul e „cât din maximul posibil", deci 100 % e plafonul. Aici e
 * „cât din ținta pusă", iar 100 % e NORMA, nu excelența. Un agent la 95 % din
 * țintă nu e „la limită", e aproape de plan; unul la 60 % chiar e în urmă.
 */
export function tonKpi(procent: number | null): "neutru" | "bun" | "atentie" | "rau" {
  if (procent === null) return "neutru";
  if (procent >= 100) return "bun";
  if (procent >= 85) return "neutru";
  if (procent >= 70) return "atentie";
  return "rau";
}

export const ETICHETE_STATUS_KPI: Readonly<Record<"draft" | "finalizat", string>> = {
  draft: "În lucru",
  finalizat: "Închisă",
};

/**
 * `draft` e „în lucru", nu „neterminat".
 *
 * Angajatul VEDE luna în draft — asta e cerința. Pastila trebuie deci să-i
 * spună că cifra se mai poate schimba, fără să sugereze că cineva a întârziat.
 */
export const TONURI_STATUS_KPI: Readonly<Record<"draft" | "finalizat", TonStare>> = {
  draft: "ciorna",
  finalizat: "succes",
};

/** „37 / 40 vizite" — unitatea lipsește la indicatorii apreciați. */
export function formatValoare(valoare: number | null, unitate: string | null): string {
  if (valoare === null) return "—";
  const cifra = Number.isInteger(valoare) ? String(valoare) : valoare.toFixed(2).replace(".", ",");
  return unitate === null || unitate === "" ? cifra : `${cifra} ${unitate}`;
}
