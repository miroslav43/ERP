// src/domain/ticketing/prioritate.ts
// Prioritatea nu se alege, se calculează. Angajatul declară doar dacă
// activitatea îi e blocată; restul rezultă din tip și din câți alții au lovit
// aceeași problemă.
//
// Oglindă a `internal.tickets_calculeaza_prioritatea` din
// 0046_ticketing_it_reguli.sql. Vezi nota din `stari.ts` despre duplicare:
// baza decide, aici doar anticipăm pentru interfață.

import type { TipTichet } from "./stari";

export const PRIORITATI = ["scazuta", "normala", "ridicata", "critica"] as const;
export type Prioritate = (typeof PRIORITATI)[number];

const RANG: Readonly<Record<Prioritate, number>> = {
  scazuta: 0,
  normala: 1,
  ridicata: 2,
  critica: 3,
};

export function prioritateMaiMare(a: Prioritate, b: Prioritate): Prioritate {
  return RANG[a] >= RANG[b] ? a : b;
}

/** Praguri de duplicate pentru bug-uri. Câți oameni au lovit aceeași problemă
 *  e cel mai bun semnal de impact pe care îl avem fără triaj uman. */
const PRAG_CRITICA = 5;
const PRAG_RIDICATA = 2;

export type DateleTichetului = Readonly<{
  tip: TipTichet;
  /** Doar la `defectiune`; `null` pentru celelalte tipuri. */
  blocheazaActivitatea?: boolean | null;
  /** Doar la `bug_erp`: câte tichete îl au ca părinte. */
  numarDuplicate?: number;
}>;

/**
 * `null` înseamnă „nu recalcula" — prioritatea a fost suprascrisă manual de
 * IT, cu justificare, și nu are voie să fie dată peste cap de un recalcul.
 */
export function calculeazaPrioritatea(
  date: DateleTichetului,
  suprascrisaManual: boolean,
): Prioritate | null {
  if (suprascrisaManual) return null;

  if (date.tip === "defectiune") {
    return date.blocheazaActivitatea === true ? "ridicata" : "normala";
  }

  if (date.tip === "bug_erp") {
    const duplicate = date.numarDuplicate ?? 0;
    if (duplicate >= PRAG_CRITICA) return "critica";
    if (duplicate >= PRAG_RIDICATA) return "ridicata";
    return "normala";
  }

  return "normala";
}
