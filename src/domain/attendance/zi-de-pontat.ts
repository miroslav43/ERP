// src/domain/attendance/zi-de-pontat.ts
/**
 * Decide dacă o zi anume MERITĂ pontată de angajat — adică dacă are rost să i
 * se ceară asta pe ecran.
 *
 * Regula nu vine din calendar, ci din firmă: `attendance_settings` are
 * `lucreaza_weekend` și `lucreaza_sarbatori` (0080_pontaj_feluri_de_munca.sql:50-51),
 * pe care le alege administratorul. O firmă de producție cu schimburi lucrează
 * sâmbăta; un birou nu. A presupune una dintre ele înseamnă a cere jumătate
 * dintre firme să se ponteze în repausul săptămânal.
 *
 * NU se putea refolosi `esteZiLucratoare` din `calendar/zile-lucratoare.ts`:
 * pe lângă faptul că nu e exportată, ea tratează weekendul ca nelucrător prin
 * construcție, fără să știe de setările firmei. E corectă acolo — numără zile
 * de concediu — și greșită aici.
 *
 * Funcție PURĂ, pe șiruri `YYYY-MM-DD` în UTC, ca tot restul modulului: coloana
 * e `date` în Postgres, iar un `Date` construit în fusul serverului ar aluneca
 * peste granița zilei.
 */

import { sarbatoriAnului } from "@/domain/calendar/sarbatori";

const ZI_ISO = /^\d{4}-\d{2}-\d{2}$/u;

/** Sâmbătă și duminică în numerotarea `getUTCDay()`. */
const WEEKEND: ReadonlySet<number> = new Set([0, 6]);

/** Partea din `attendance_settings` care spune ce zile se lucrează. */
export interface RegimZile {
  readonly lucreazaWeekend: boolean;
  readonly lucreazaSarbatori: boolean;
}

/**
 * `true` doar când ziua e una în care firma chiar lucrează.
 *
 * `regim === null` înseamnă că firmei nu i s-a scris încă rândul de setări.
 * Atunci răspunsul e `false`: nu inventăm o politică implicită pentru o firmă
 * despre care nu știm nimic — tăcerea e greșeala ieftină, insistența nu.
 */
export function meritaPontata(zi: string, regim: RegimZile | null): boolean {
  if (regim === null || !ZI_ISO.test(zi)) return false;

  const data = new Date(`${zi}T00:00:00Z`);
  // `2026-13-45` trece de regex, dar produce `Invalid Date`.
  if (Number.isNaN(data.getTime())) return false;

  if (!regim.lucreazaWeekend && WEEKEND.has(data.getUTCDay())) return false;
  if (!regim.lucreazaSarbatori && esteSarbatoare(data)) return false;

  return true;
}

/** Sărbătorile se compară pe zi calendaristică, toate fiind construite în UTC. */
function esteSarbatoare(data: Date): boolean {
  return sarbatoriAnului(data.getUTCFullYear()).some((s) => s.data.getTime() === data.getTime());
}
