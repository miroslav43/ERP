// src/app/(app)/flota/etichete.ts
import type { TonStare } from "@/components/ui/badge";
import type { CategorieVehicul, Combustibil, StatusFoaie, StatusVehicul } from "@/schemas/fleet";

export const ETICHETE_STATUS_VEHICUL: Readonly<Record<StatusVehicul, string>> = {
  activ: "În parc",
  in_service: "În service",
  vandut: "Vândut",
  casat: "Casat",
};

export const TONURI_STATUS_VEHICUL: Readonly<Record<StatusVehicul, TonStare>> = {
  activ: "succes",
  // „În service" nu e o defecțiune, e o indisponibilitate temporară: vehiculul
  // se întoarce în parc. Atenție, nu pericol.
  in_service: "atentie",
  // Vândut și casat sunt sfârșituri de viață, nu probleme — ies din parc și nu
  // mai cer nicio acțiune.
  vandut: "neutru",
  casat: "neutru",
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

export const TONURI_STATUS_FOAIE: Readonly<Record<StatusFoaie, TonStare>> = {
  draft: "ciorna",
  // Trimisă = așteaptă pe altcineva. E o stare deschisă, care cere o acțiune de
  // la aprobator, deci atenție — nu succes și nici stare neutră.
  trimis: "atentie",
  aprobat: "succes",
  respins: "pericol",
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

export const TONURI_SCADENTA: Readonly<Record<StareScadenta, TonStare>> = {
  expirat: "pericol",
  curand: "atentie",
  in_regula: "succes",
  // „Lipsește" e MAI GRAV decât „Expirat", nu o stare neutră: documentul nu
  // există deloc, deci nu are nicio dată de la care să se numere și nu se va
  // aprinde niciodată singur în „Expiră curând". Un RCA absent rămâne absent
  // tăcut până când îl vede cineva pe listă.
  lipsa: "pericol",
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
