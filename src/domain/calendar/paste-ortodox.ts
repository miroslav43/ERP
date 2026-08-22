// src/domain/calendar/paste-ortodox.ts

/**
 * Calculează data Paștelui ortodox (calendar gregorian) pentru un an dat.
 *
 * Algoritmul Meeus/Jones/Butcher (varianta iuliană) dă luna și ziua în
 * calendarul IULIAN; decalajul dintre calendare se adaugă separat pentru
 * a obține data corespunzătoare pe calendarul gregorian (cel folosit de
 * `date` în Postgres și de `Date` în JavaScript). Corespunde exact
 * funcției `internal.paste_ortodox` din supabase/migrations/0009_leave.sql.
 *
 * Funcție PURĂ: nu citește ceasul sistemului, nu accesează rețeaua sau
 * baza de date. Pentru același an întoarce mereu aceeași dată.
 */
export function pasteOrtodox(an: number): Date {
  if (!Number.isInteger(an) || an < 1900 || an > 2199) {
    throw new RangeError(
      "Anul pentru calculul Paștelui ortodox trebuie să fie un număr întreg între 1900 și 2199.",
    );
  }

  const a = an % 4;
  const b = an % 7;
  const c = an % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;

  // 3 = martie, 4 = aprilie — luna în calendarul IULIAN.
  const lunaIuliana = Math.floor((d + e + 114) / 31);
  const ziuaIuliana = ((d + e + 114) % 31) + 1;

  // Decalajul dintre calendarul iulian și cel gregorian, valabil în intervalul suportat.
  const decalajZile = Math.floor(an / 100) - Math.floor(an / 400) - 2;

  // Date.UTC normalizează automat depășirile de zi/lună (echivalent cu
  // a construi data iuliană și a-i adăuga apoi `decalajZile` zile).
  return new Date(Date.UTC(an, lunaIuliana - 1, ziuaIuliana + decalajZile));
}
