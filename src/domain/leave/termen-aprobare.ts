// src/domain/leave/termen-aprobare.ts
//
// Termenul de decizie al unei sarcini de aprobare, tradus în treapta comună de
// scadență a produsului.
//
// De ce nu `treaptaDinScadenta` din `@/domain/scadente`: acela primește o ZI
// calendaristică (`"2026-03-09"`), fiindcă SSM, flota și mentenanța urmăresc
// documente care expiră la sfârșit de zi. `approval_tasks.termen_la` e un
// `timestamptz` calculat ca `now() + sla_ore` (0009_leave.sql) — un termen de
// patru ore expiră în aceeași zi în care s-a născut. Turtit la zi, un termen
// depășit de șase ore ar fi apărut „în regulă”.

import type { TreaptaScadenta } from "@/domain/scadente";

const ORA_MS = 3_600_000;

/** Sub atâtea ore rămase, termenul e critic. */
const PRAG_CRITIC_ORE = 24;
/** Sub atâtea ore rămase, termenul se apropie. */
const PRAG_AVERTIZARE_ORE = 72;

/**
 * Câte ore mai sunt până la termen. Negativ = termenul a trecut.
 *
 * Fracționar, nu rotunjit: apelantul decide cum îl arată. Rotunjirea aici ar fi
 * făcut ca un termen depășit cu zece minute să dea exact 0 și să cadă, la
 * comparația `<= 0`, pe ramura greșită.
 */
export function oreParaTermen(termenLa: string, acum: Date): number {
  return (new Date(termenLa).getTime() - acum.getTime()) / ORA_MS;
}

/**
 * Treapta unui termen de decizie.
 *
 * `null` ⇒ `neaplicabil`, iar asta NU e o alegere implicită: un pas de flux
 * fără `sla_ore` n-are termen deloc (`termen_la` rămâne NULL în trigger), deci
 * nu există nimic de depășit. A-l fi tratat ca „lipsă” — treapta cea mai gravă
 * din `RANG_SCADENTA` — ar fi aprins toată coada unei firme fără SLA configurat.
 */
export function treaptaTermenDecizie(termenLa: string | null, acum: Date): TreaptaScadenta {
  if (termenLa === null) return "neaplicabil";
  const ore = oreParaTermen(termenLa, acum);
  if (ore < 0) return "expirat";
  if (ore <= PRAG_CRITIC_ORE) return "critic";
  if (ore <= PRAG_AVERTIZARE_ORE) return "curand";
  return "in_regula";
}
