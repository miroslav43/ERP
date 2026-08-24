// src/app/(app)/ticketing/etichete.ts
import type { TonStare } from "@/components/ui/badge";
import type { StatusTichet, TipTichet } from "@/domain/ticketing/stari";
import type { Prioritate } from "@/domain/ticketing/prioritate";

export const ETICHETE_TIP: Readonly<Record<TipTichet, string>> = {
  software: "Cerere software",
  hardware: "Cerere hardware",
  defectiune: "Defecțiune",
  bug_erp: "Problemă în aplicație",
};

/** Text scurt, la persoana întâi, pentru ecranul de alegere a tipului. */
export const DESCRIERI_TIP: Readonly<Record<TipTichet, string>> = {
  software: "Am nevoie de o aplicație instalată pe calculator.",
  hardware: "Am nevoie de un echipament pe care nu îl am.",
  defectiune: "Ceva ce am în primire s-a stricat.",
  bug_erp: "Aplicația se comportă greșit.",
};

export const ETICHETE_STATUS: Readonly<Record<StatusTichet, string>> = {
  nou: "Nou",
  in_aprobare: "În aprobare",
  respins: "Respins",
  in_lucru: "În lucru",
  in_asteptare: "Așteaptă răspunsul tău",
  rezolvat: "Rezolvat",
  inchis: "Închis",
  anulat: "Anulat",
  redeschis: "Redeschis",
};

export const TONURI_STATUS: Readonly<Record<StatusTichet, TonStare>> = {
  // Tichet deschis, dar neluat încă de nimeni — „neînceput”, nu „în lucru”.
  nou: "ciorna",
  in_aprobare: "atentie",
  respins: "pericol",
  // „În lucru” e atenție, nu succes: lucrul e început, nu terminat.
  in_lucru: "atentie",
  // Era deliberat cel mai vizibil status, fiindcă e singurul în care mingea e la
  // solicitant. Distincția o poartă acum CUVÂNTUL („Așteaptă răspunsul tău”), nu
  // o nuanță proprie de portocaliu.
  in_asteptare: "atentie",
  rezolvat: "succes",
  inchis: "neutru",
  anulat: "neutru",
  // Redeschis e o stare activă — munca s-a întors la echipă —, deci atenție, nu
  // neutru, deși vechea culoare era violet.
  redeschis: "atentie",
};

export const ETICHETE_PRIORITATE: Readonly<Record<Prioritate, string>> = {
  scazuta: "Scăzută",
  normala: "Normală",
  ridicata: "Ridicată",
  critica: "Critică",
};

export const TONURI_PRIORITATE: Readonly<Record<Prioritate, TonStare>> = {
  scazuta: "neutru",
  normala: "neutru",
  ridicata: "atentie",
  critica: "pericol",
};

/** Cum se numesc câmpurile în istoricul tichetului. */
export const ETICHETE_CAMP: Readonly<Record<string, string>> = {
  status: "Stare",
  prioritate: "Prioritate",
};
