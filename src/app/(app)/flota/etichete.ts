// src/app/(app)/flota/etichete.ts
import type { TonStare } from "@/components/ui/badge";
import type { CategorieVehicul, Combustibil, StatusFoaie, StatusVehicul } from "@/schemas/fleet";
import type { StareScadentaFlota } from "@/domain/fleet/scadente";

export const ETICHETE_STATUS_VEHICUL: Readonly<Record<StatusVehicul, string>> = {
  activ: "În parc",
  in_service: "În service",
  vandut: "Vândut",
  casat: "Casat",
};

export const TONURI_STATUS_VEHICUL: Readonly<Record<StatusVehicul, TonStare>> = {
  activ: "succes",
  // „În service” nu e o defecțiune, e o indisponibilitate temporară: vehiculul
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

/**
 * Scadențele: aici rămâne doar cum ARATĂ o treaptă, nu cum se calculează.
 *
 * `stareScadenta` și pragul de 30 de zile au plecat în `@/domain/fleet/scadente`
 * (decizia B1 din `docs/design/redesign/0-decizii-de-pornire.md`): un fișier de
 * rută nu e testabil de proiectul `unit`, iar portalul importă acest `etichete.ts`
 * fără să aibă nevoie de logică. Numele vechi rămâne exportat de aici cât timp
 * `page.tsx` și `[id]/page.tsx` îl mai importă sub el.
 */
export { stareScadentaFlota as stareScadenta } from "@/domain/fleet/scadente";
export type { StareScadentaFlota as StareScadenta } from "@/domain/fleet/scadente";

export const ETICHETE_SCADENTA: Readonly<Record<StareScadentaFlota, string>> = {
  expirat: "Expirat",
  curand: "Expiră curând",
  in_regula: "În regulă",
  lipsa: "Lipsește",
};

export const TONURI_SCADENTA: Readonly<Record<StareScadentaFlota, TonStare>> = {
  expirat: "pericol",
  curand: "atentie",
  in_regula: "succes",
  // „Lipsește” e MAI GRAV decât „Expirat”, nu o stare neutră: documentul nu
  // există deloc, deci nu are nicio dată de la care să se numere și nu se va
  // aprinde niciodată singur în „Expiră curând”. Un RCA absent rămâne absent
  // tăcut până când îl vede cineva pe listă.
  lipsa: "pericol",
};
