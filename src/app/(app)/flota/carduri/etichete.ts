// src/app/(app)/flota/carduri/etichete.ts
// Etichetele ecranelor de carduri (0214, F12b): stările de potrivire,
// categoriile din extras și starea cardului, cu tonul pastilei.

import type { CategorieTranzactie } from "@/domain/fleet/carduri/categorii";
import type { StarePotrivire } from "@/domain/fleet/carduri/potrivire";
import type { TonStare } from "@/components/ui/badge";
import type { StatusCard } from "@/domain/fleet/carduri/card";

export const ETICHETE_STARE_POTRIVIRE: Readonly<Record<StarePotrivire, string>> = {
  potrivita: "Potrivită",
  diferenta: "Diferență",
  fara_alimentare: "Fără alimentare declarată",
  fara_foaie: "Fără foaie în ziua aceea",
  vehicul_necunoscut: "Vehicul necunoscut",
  card_necunoscut: "Card neînregistrat",
  necombustibil: "Nu e combustibil",
  ignorata: "Ignorată",
};

export const TON_STARE_POTRIVIRE: Readonly<Record<StarePotrivire, TonStare>> = {
  potrivita: "succes",
  diferenta: "atentie",
  fara_alimentare: "pericol",
  fara_foaie: "pericol",
  vehicul_necunoscut: "atentie",
  card_necunoscut: "atentie",
  necombustibil: "neutru",
  ignorata: "neutru",
};

/** Ordinea din raportul de nepotriviri: întâi ce cere o decizie. */
export const ORDINE_STARI: readonly StarePotrivire[] = [
  "fara_alimentare",
  "fara_foaie",
  "diferenta",
  "card_necunoscut",
  "vehicul_necunoscut",
  "necombustibil",
  "ignorata",
  "potrivita",
];

export const ETICHETE_CATEGORIE: Readonly<Record<CategorieTranzactie, string>> = {
  combustibil: "Combustibil",
  adblue: "AdBlue",
  taxa_drum: "Taxă de drum",
  spalatorie: "Spălătorie",
  parcare: "Parcare",
  magazin: "Magazin",
  corectie: "Corecție (storno)",
  altele: "Altele",
};

export const ETICHETE_STATUS_CARD: Readonly<Record<StatusCard, string>> = {
  activ: "Activ",
  blocat: "Blocat",
  anulat: "Anulat",
};

export const TON_STATUS_CARD: Readonly<Record<StatusCard, TonStare>> = {
  activ: "succes",
  blocat: "atentie",
  anulat: "neutru",
};
