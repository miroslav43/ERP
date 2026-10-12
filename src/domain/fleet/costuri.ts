// src/domain/fleet/costuri.ts

import { consumLa100Km } from "./consum";

/**
 * Costurile unui vehicul (0200): totalul, costul pe kilometru, consumul real pe
 * perioadă și defalcarea cheltuielilor pe categorii. Funcții pure, fără I/O:
 * apelantul aduce rândurile deja citite și deja plafonate pe perioadă.
 *
 * ── DE CE ÎN BANI ÎNTREGI ────────────────────────────────────────────────────
 * Sumele vin din coloane `numeric(12,2)`. Adunate ca numere cu virgulă mobilă,
 * 0,1 + 0,2 ies 0,30000000000000004, iar un total de pe ecran care nu se potrivește
 * cu suma rândurilor de sub el e exact felul de defect pe care îl găsește
 * contabilul. Toate adunările trec prin bani întregi (`Math.round(x * 100)`).
 *
 * ── CE ESTE „COSTUL TOTAL” ───────────────────────────────────────────────────
 * Patru surse, fiecare cu originea ei, ca nimic să nu fie numărat de două ori:
 *  · `service` — `vehicle_service_entries.cost_total` (piese + manoperă);
 *  · `combustibilFoi` — alimentările de pe foile APROBATE (`fuel_entries.cost`);
 *  · `cheltuieli` — `vehicle_expenses.suma`, inclusiv „combustibil fără foaie”,
 *    care prin definiție nu e pe nicio foaie;
 *  · `documente` — `vehicle_documents.cost` (RCA, ITP, rovinietă…), pentru
 *    documentele a căror valabilitate începe în perioadă.
 */

/** Bani întregi: 344,00 lei → 34400. */
const bani = (lei: number): number => Math.round(lei * 100);

/** Suma în lei, exactă la ban; valorile lipsă nu se numără. */
export function sumaLei(valori: readonly (number | null | undefined)[]): number {
  let total = 0;
  for (const v of valori) {
    if (v !== null && v !== undefined) total += bani(v);
  }
  return total / 100;
}

export type PartiCost = Readonly<{
  service: number;
  combustibilFoi: number;
  cheltuieli: number;
  documente: number;
}>;

export function costTotal(parti: PartiCost): number {
  return sumaLei([parti.service, parti.combustibilFoi, parti.cheltuieli, parti.documente]);
}

/**
 * Lei pe kilometru, rotunjit la ban, sau `null` fără kilometri: „0 lei/km” ar
 * fi o cifră inventată, iar o împărțire la zero ar da `Infinity` pe ecran.
 */
export function costPeKm(cost: number, kmParcursi: number | null): number | null {
  if (kmParcursi === null || kmParcursi <= 0) return null;
  return Math.round((cost / kmParcursi) * 100) / 100;
}

/**
 * Litri la 100 km pe o perioadă: litrii alimentați pe foile aprobate împărțiți
 * la kilometrii acelorași foi. Aceeași regulă ca pe foaia singură
 * (`consumLa100Km`): fără kilometri sau fără litri, nicio cifră. Combustibilul
 * „fără foaie” NU intră aici — nu are kilometri cu care să fie pereche, iar
 * amestecat ar strica tocmai cifra pe care o verifică.
 */
export function consumRealPerioada(litri: number, kmParcursi: number | null): number | null {
  return consumLa100Km(litri, kmParcursi);
}

export type RandCategorie<C extends string> = Readonly<{ categorie: C; suma: number }>;
export type TotalCategorie<C extends string> = Readonly<{
  categorie: C;
  suma: number;
  numar: number;
}>;

/**
 * Suma și numărul de rânduri pe categorie, cele mai mari întâi. La sume egale,
 * ordinea alfabetică a categoriei: fără ea, două reîncărcări ale aceleiași pagini
 * ar putea aranja rândurile diferit.
 */
export function defalcarePeCategorii<C extends string>(
  randuri: readonly RandCategorie<C>[],
): readonly TotalCategorie<C>[] {
  const harta = new Map<C, { bani: number; numar: number }>();
  for (const r of randuri) {
    const curent = harta.get(r.categorie) ?? { bani: 0, numar: 0 };
    harta.set(r.categorie, { bani: curent.bani + bani(r.suma), numar: curent.numar + 1 });
  }
  return [...harta.entries()]
    .map(([categorie, v]) => ({ categorie, suma: v.bani / 100, numar: v.numar }))
    .sort((a, b) => b.suma - a.suma || a.categorie.localeCompare(b.categorie));
}

/**
 * Prima zi a ferestrei „ultimele N luni”: ziua dată minus N luni calendaristice.
 * Ziua 31 cade pe ultima zi a lunii mai scurte (31 mai − 3 luni = 28 februarie),
 * cum face și Postgres la `date + interval`. `azi` e `todayInBucharest()`.
 */
export function dataDeLaLuni(azi: string, luni: number): string {
  return adaugaLuniLaZi(azi, -luni);
}

/** Adaugă (sau scade) luni calendaristice la o zi ISO, cu clampare la sfârșit de lună. */
export function adaugaLuniLaZi(zi: string, luni: number): string {
  const [an = 0, luna = 1, ziua = 1] = zi.split("-").map(Number);
  const total = an * 12 + (luna - 1) + luni;
  const anNou = Math.floor(total / 12);
  const lunaNoua = (((total % 12) + 12) % 12) + 1;
  const ultimaZi = new Date(Date.UTC(anNou, lunaNoua, 0)).getUTCDate();
  const ziNoua = Math.min(ziua, ultimaZi);
  return `${String(anNou).padStart(4, "0")}-${String(lunaNoua).padStart(2, "0")}-${String(ziNoua).padStart(2, "0")}`;
}
