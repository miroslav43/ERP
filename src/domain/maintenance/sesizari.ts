// src/domain/maintenance/sesizari.ts
//
// Mașina de stări a sesizării de defecțiune — partea PURĂ, fără bază și fără
// React. Ecranul întreabă aici ce butoane să arate; triggerul din bază
// (`internal.ssm_fault_guard`, iar din M3 `fault_reports_tranzitie`) rămâne
// judecătorul final. Cele două trebuie să spună același lucru, iar testul
// `sesizari.test.ts` e locul unde se citește contractul dintr-o privire.
//
// Până la M3 stările sunt cele cinci din 0011: `nou`, `in_analiza`, `in_lucru`,
// `rezolvat`, `respins`. Ultimele două sunt terminale în APLICAȚIE
// (`trieazaSesizare`/`rezolvaSesizare` pun `.in("status", deschise)` pe UPDATE);
// baza nu păzește ieșirea din ele — capcana #17 și vault-ul, „Ce refuză baza tăcut”.

import type { StatusSesizare } from "@/schemas/maintenance";

/** Stările din care nu se mai iese. */
export const STARI_TERMINALE_SESIZARE: readonly StatusSesizare[] = ["rezolvat", "respins"];

/** Stările în care sesizarea e încă „deschisă” — exact filtrul `.in("status", …)` al acțiunilor. */
export const STARI_DESCHISE_SESIZARE: readonly StatusSesizare[] = ["nou", "in_analiza", "in_lucru"];

export type TranzitieSesizare = "in_analiza" | "in_lucru" | "rezolvat" | "respins";

export interface ActorSesizare {
  /** `can(permisiuni, "maintenance:update", "team")` — cine triază, rezolvă, respinge. */
  readonly poateGestiona: boolean;
}

export function esteTerminala(status: StatusSesizare): boolean {
  return STARI_TERMINALE_SESIZARE.includes(status);
}

/**
 * Ce poate face actorul cu o sesizare aflată în `status`.
 *
 * O stare nu se „schimbă în ea însăși”: pe o sesizare deja în analiză butonul
 * „În analiză” nu are ce face și nu apare — ecranul vechi le arăta pe toate
 * patru oricând, inclusiv pe cea curentă, și omul nu știa dacă apăsarea a
 * făcut ceva. Ordinea întoarsă e ordinea butoanelor: întâi pașii înainte, apoi
 * rezolvarea, la coadă respingerea (distructivă, vizual separată).
 */
export function tranzitiiPermise(
  status: StatusSesizare,
  actor: ActorSesizare,
): readonly TranzitieSesizare[] {
  if (!actor.poateGestiona || esteTerminala(status)) return [];
  const pasi: TranzitieSesizare[] = [];
  if (status !== "in_analiza") pasi.push("in_analiza");
  if (status !== "in_lucru") pasi.push("in_lucru");
  pasi.push("rezolvat", "respins");
  return pasi;
}
