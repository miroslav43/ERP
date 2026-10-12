// src/app/(app)/flota/etichete-service.ts
//
// Textele de interfață pentru service, costuri și anvelope (0203). Separat de
// `etichete.ts`, ca fiecare fază a flotei să-și țină hărțile fără să atingă un
// fișier comun; `etichete-service.test.ts` le lipește de enumurile schemei.
import type { TonStare } from "@/components/ui/badge";
import type { StarePlan } from "@/domain/fleet/service";
import type { AnvelopeMontate } from "@/schemas/fleet";
import type { CategorieCheltuiala, TipService } from "@/schemas/fleet-service";

export const ETICHETE_TIP_SERVICE: Readonly<Record<TipService, string>> = {
  revizie: "Revizie",
  reparatie: "Reparație",
  anvelope: "Anvelope",
  dauna: "Daună",
  altele: "Altele",
};

export const ETICHETE_CATEGORIE_CHELTUIALA: Readonly<Record<CategorieCheltuiala, string>> = {
  combustibil_fara_foaie: "Combustibil fără foaie",
  parcare: "Parcare",
  spalatorie: "Spălătorie",
  taxa_drum: "Taxă de drum",
  taxa_pod: "Taxă de pod",
  tollro: "TollRo",
  altele: "Altele",
};

export const ETICHETE_ANVELOPE: Readonly<Record<AnvelopeMontate, string>> = {
  vara: "Vară",
  iarna: "Iarnă",
  all_season: "All-season",
};

/** Cuvântul din pastila unui plan. „Oprit” și „fără scadență” nu sunt probleme. */
export const ETICHETE_STARE_PLAN: Readonly<Record<StarePlan, string>> = {
  oprit: "Oprit",
  fara_scadenta: "Fără scadență",
  in_regula: "În regulă",
  curand: "Curând",
  depasit: "Întârziat",
};

export const TONURI_STARE_PLAN: Readonly<Record<StarePlan, TonStare>> = {
  oprit: "neutru",
  fara_scadenta: "neutru",
  in_regula: "succes",
  curand: "atentie",
  depasit: "pericol",
};
