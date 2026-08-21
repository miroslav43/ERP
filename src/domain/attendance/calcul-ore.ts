// src/domain/attendance/calcul-ore.ts
// Funcții pure pentru derivarea orelor dintr-o zi de pontaj — folosite din UI
// (`celula-zi.tsx`) ca sugestie editabilă, nu ca sursă finală de adevăr:
// utilizatorul poate suprascrie oricând valoarea calculată.

/** `"08:30"` → minute de la miezul nopții, sau `null` dacă formatul e invalid. */
function minuteDinOra(ora: string): number | null {
  const potrivire = /^([01]\d|2[0-3]):([0-5]\d)$/u.exec(ora);
  if (potrivire === null) return null;
  const ore = potrivire[1];
  const minute = potrivire[2];
  if (ore === undefined || minute === undefined) return null;
  return Number(ore) * 60 + Number(minute);
}

/**
 * Ore lucrate dintr-un interval `oraInceput`–`oraSfarsit` (format `"HH:MM"`).
 * `null` dacă vreo oră lipsește/e invalidă sau dacă sfârșitul nu e strict
 * după început — modelul are un rând pe zi, deci un tur peste miezul nopții
 * nu se poate exprima aici (rămâne de introdus manual, ca și până acum).
 */
export function oreLucrateDinInterval(oraInceput: string, oraSfarsit: string): number | null {
  const inceput = minuteDinOra(oraInceput);
  const sfarsit = minuteDinOra(oraSfarsit);
  if (inceput === null || sfarsit === null || sfarsit <= inceput) return null;
  return Math.round(((sfarsit - inceput) / 60) * 100) / 100;
}

/** Ore suplimentare peste pragul legal de ore/zi al organizației (implicit 8h). */
export function oreSuplimentareDinLucrate(oreLucrate: number, orePeZi: number): number {
  return Math.max(0, Math.round((oreLucrate - orePeZi) * 100) / 100);
}
