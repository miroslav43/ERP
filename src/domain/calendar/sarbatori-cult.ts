// src/domain/calendar/sarbatori-cult.ts

import { pasteGregorian } from "./paste-gregorian";
import { sarbatoriAnului, sarbatoriDupaZi, type Sarbatoare } from "./sarbatori";

/**
 * Sărbătorile legale ale unui salariat, după calendarul după care își serbează
 * cultul lui Paștele.
 *
 * ── TEMEIUL ────────────────────────────────────────────────────────────────
 * Codul muncii, forma consolidată de pe legislatie.just.ro (documentul 128647,
 * descărcată pe 8 oct 2026):
 *  · art. 139 alin. (2¹) — pentru salariații unui cult religios legal, creștin,
 *    Vinerea Mare, prima și a doua zi de Paști, prima și a doua zi de Rusalii
 *    „se acordă în funcție de data la care sunt celebrate de acel cult”;
 *  · alin. (3¹) — cine a primit zilele libere și la datele cultului lui, și la
 *    ale altui cult creștin, recuperează zilele suplimentare.
 * Deci pentru un salariat romano-catolic, datele ortodoxe NU mai sunt libere:
 * le înlocuiesc cele gregoriene. Interpretarea a fost confirmată de jurist pe
 * 9 oct 2026 (NOTES.md §3).
 *
 * ── DE CE CALENDARUL, NU NUMELE CULTULUI ───────────────────────────────────
 * Legea trimite la data cultului, nu la o listă de culte. Pentru cultele
 * creștine din România sunt două date posibile: cea din calendarul iulian (a
 * Bisericii Ortodoxe) și cea din calendarul gregorian (romano-catolici,
 * reformați, evanghelici, unitarieni). Nu legăm aici un cult anume de un
 * calendar; interfața arată ambele date ale anului, iar omul o alege pe a lui.
 *
 * ── DE CE FIXELE VIN DIN `sarbatoriAnului` ─────────────────────────────────
 * Alin. (2¹) mută doar cele cinci zile mobile. Fixele se iau din aceeași
 * funcție ca restul aplicației, deci orice corecție de acolo (de exemplu 6–7
 * ianuarie doar din 2024) ajunge și aici, fără o a doua listă.
 */
export type CalendarPaste = "ortodox" | "gregorian";

export const CALENDARE_PASTE: readonly CalendarPaste[] = ["ortodox", "gregorian"];

function adaugaZile(data: Date, zile: number): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate() + zile));
}

function cheie(data: Date): string {
  return `${String(data.getUTCFullYear()).padStart(4, "0")}-${String(data.getUTCMonth() + 1).padStart(2, "0")}-${String(data.getUTCDate()).padStart(2, "0")}`;
}

/** Lista sărbătorilor anului; pentru `"ortodox"`, exact `sarbatoriAnului(an)`. */
export function sarbatoriAnuluiPentruCult(
  an: number,
  calendar: CalendarPaste,
): readonly Sarbatoare[] {
  if (calendar === "ortodox") return sarbatoriAnului(an);
  const paste = pasteGregorian(an);
  const mobile: readonly Sarbatoare[] = [
    { data: adaugaZile(paste, -2), denumire: "Vinerea Mare", tip: "mobil" },
    { data: paste, denumire: "Paștele", tip: "mobil" },
    { data: adaugaZile(paste, 1), denumire: "A doua zi de Paște", tip: "mobil" },
    { data: adaugaZile(paste, 49), denumire: "Rusaliile", tip: "mobil" },
    { data: adaugaZile(paste, 50), denumire: "A doua zi de Rusalii", tip: "mobil" },
  ];
  return [...sarbatoriAnului(an).filter((s) => s.tip === "fix"), ...mobile].sort(
    (prima, aDoua) => prima.data.getTime() - aDoua.data.getTime(),
  );
}

/**
 * Perechea lui `sarbatoriDupaZi`, pe calendarul cultului: ziua ISO →
 * denumirea, cu denumirile ADUNATE când două sărbători cad în aceeași zi.
 */
export function sarbatoriDupaZiPentruCult(
  an: number,
  calendar: CalendarPaste,
): ReadonlyMap<string, string> {
  if (calendar === "ortodox") return sarbatoriDupaZi(an);
  const dupaZi = new Map<string, string>();
  for (const sarbatoare of sarbatoriAnuluiPentruCult(an, calendar)) {
    const zi = cheie(sarbatoare.data);
    const dinainte = dupaZi.get(zi);
    dupaZi.set(
      zi,
      dinainte === undefined ? sarbatoare.denumire : `${dinainte} · ${sarbatoare.denumire}`,
    );
  }
  return dupaZi;
}
