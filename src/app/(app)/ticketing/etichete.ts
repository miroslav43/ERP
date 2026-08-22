// src/app/(app)/ticketing/etichete.ts
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

export const CLASE_STATUS: Readonly<Record<StatusTichet, string>> = {
  nou: "bg-sky-100 text-sky-900",
  in_aprobare: "bg-amber-100 text-amber-900",
  respins: "bg-rose-100 text-rose-900",
  in_lucru: "bg-indigo-100 text-indigo-900",
  // Deliberat cel mai vizibil: e singurul status în care mingea e la
  // solicitant, iar cerința era să se distingă clar în listă.
  in_asteptare: "bg-orange-200 text-orange-950 font-medium",
  rezolvat: "bg-emerald-100 text-emerald-900",
  inchis: "bg-zinc-200 text-zinc-800",
  anulat: "bg-zinc-200 text-zinc-600 line-through",
  redeschis: "bg-violet-100 text-violet-900",
};

export const ETICHETE_PRIORITATE: Readonly<Record<Prioritate, string>> = {
  scazuta: "Scăzută",
  normala: "Normală",
  ridicata: "Ridicată",
  critica: "Critică",
};

export const CLASE_PRIORITATE: Readonly<Record<Prioritate, string>> = {
  scazuta: "bg-zinc-100 text-zinc-700",
  normala: "bg-zinc-100 text-zinc-800",
  ridicata: "bg-amber-100 text-amber-900",
  critica: "bg-rose-200 text-rose-950 font-medium",
};

/** Cum se numesc câmpurile în istoricul tichetului. */
export const ETICHETE_CAMP: Readonly<Record<string, string>> = {
  status: "Stare",
  prioritate: "Prioritate",
};
