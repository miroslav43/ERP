// src/domain/calendar/paste-gregorian.ts

/**
 * Data Paștelui după calendarul gregorian — Paștele romano-catolic și cel al
 * cultelor protestante.
 *
 * ── DE CE EXISTĂ ───────────────────────────────────────────────────────────
 * Art. 139 alin. (2¹) din Codul muncii (introdus prin Legea 37/2020, în
 * vigoare de la 06.04.2020; verificat pe forma consolidată de pe
 * legislatie.just.ro, documentul 128647, descărcată pe 8 oct 2026): salariații
 * unui cult religios legal, creștin, primesc Vinerea Mare, Paștele și Rusaliile
 * „în funcție de data la care sunt celebrate de acel cult”. Pentru un salariat
 * romano-catolic sau reformat, sărbătorile mobile vin din data de aici, nu din
 * `pasteOrtodox`.
 *
 * ── ALGORITMUL ─────────────────────────────────────────────────────────────
 * „Anonim gregorian” (Meeus/Jones/Butcher), valabil pe tot calendarul
 * gregorian. Întoarce direct luna și ziua gregoriene — spre deosebire de
 * `pasteOrtodox`, nu e nevoie de decalajul iulian–gregorian.
 *
 * Funcție PURĂ, același interval de ani ca `pasteOrtodox`.
 */
export function pasteGregorian(an: number): Date {
  if (!Number.isInteger(an) || an < 1900 || an > 2199) {
    throw new RangeError(
      "Anul pentru calculul Paștelui gregorian trebuie să fie un număr întreg între 1900 și 2199.",
    );
  }

  const a = an % 19;
  const b = Math.floor(an / 100);
  const c = an % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const luna = Math.floor((h + l - 7 * m + 114) / 31);
  const zi = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(Date.UTC(an, luna - 1, zi));
}
