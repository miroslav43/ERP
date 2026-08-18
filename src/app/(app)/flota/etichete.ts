// src/app/(app)/flota/etichete.ts
import type {
  CategorieVehicul,
  Combustibil,
  StatusFoaie,
  StatusVehicul,
} from "@/schemas/fleet";

export const ETICHETE_STATUS_VEHICUL: Readonly<Record<StatusVehicul, string>> = {
  activ: "În parc",
  in_service: "În service",
  vandut: "Vândut",
  casat: "Casat",
};

export const CLASE_STATUS_VEHICUL: Readonly<Record<StatusVehicul, string>> = {
  activ: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  in_service: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  vandut: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100",
  casat: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100",
};

export const ETICHETE_CATEGORIE: Readonly<Record<CategorieVehicul, string>> = {
  autoturism: "Autoturism",
  autoutilitara: "Autoutilitară",
  camion: "Camion",
  autobuz: "Autobuz",
  microbuz: "Microbuz",
  remorca: "Remorcă",
  semiremorca: "Semiremorcă",
  utilaj: "Utilaj",
  motocicleta: "Motocicletă",
  altele: "Altele",
};

export const ETICHETE_COMBUSTIBIL: Readonly<Record<Combustibil, string>> = {
  benzina: "Benzină",
  motorina: "Motorină",
  gpl: "GPL",
  gnc: "GNC",
  electric: "Electric",
  hibrid: "Hibrid",
  hibrid_plugin: "Hibrid plug-in",
  altul: "Altul",
};

export const ETICHETE_STATUS_FOAIE: Readonly<Record<StatusFoaie, string>> = {
  draft: "Ciornă",
  trimis: "Trimisă spre aprobare",
  aprobat: "Aprobată",
  respins: "Respinsă",
};

export const CLASE_STATUS_FOAIE: Readonly<Record<StatusFoaie, string>> = {
  draft: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100",
  trimis: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100",
  aprobat: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  respins: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100",
};

/** Câte zile înainte de expirare scadența devine portocalie. */
export const PRAG_AVERTIZARE_ZILE = 30;

export type StareScadenta = "expirat" | "curand" | "in_regula" | "lipsa";

export const ETICHETE_SCADENTA: Readonly<Record<StareScadenta, string>> = {
  expirat: "Expirat",
  curand: "Expiră curând",
  in_regula: "În regulă",
  lipsa: "Lipsește",
};

export const CLASE_SCADENTA: Readonly<Record<StareScadenta, string>> = {
  expirat: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100",
  curand: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  in_regula: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  lipsa: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100",
};

/**
 * Starea unei scadențe, comparând DOAR șiruri de zile calendaristice.
 *
 * `expira_la` e `date` în Postgres, deci vine ca „2026-12-01". Convertit în
 * `Date`, ar deveni miezul nopții UTC, iar în București asta e deja ziua
 * precedentă la ora 02:00 — un document care expiră azi ar apărea expirat de
 * ieri. Comparația lexicografică pe ISO e exactă și nu are fus orar.
 */
export function stareScadenta(expiraLa: string | null, azi: string): StareScadenta {
  if (expiraLa === null) return "lipsa";
  if (expiraLa < azi) return "expirat";

  const prag = new Date(`${azi}T00:00:00Z`);
  prag.setUTCDate(prag.getUTCDate() + PRAG_AVERTIZARE_ZILE);
  const pragText = prag.toISOString().slice(0, 10);

  return expiraLa <= pragText ? "curand" : "in_regula";
}
