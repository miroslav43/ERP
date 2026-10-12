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
import { formatDate } from "@/lib/format/date";

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

/** De ce o zi nu POATE fi pontată, oricare ar fi regimul firmei. */
export type MotivRefuzZi = "viitor" | "inainte_de_angajare";

/**
 * Ziua care nu se pontează deloc — nici de angajat, nici de responsabilul de
 * pontaj din foaia colectivă (ANG-004, ANG-005).
 *
 * Pontajul e înregistrarea a ce s-a întâmplat. O zi care n-a venit încă n-are
 * ce înregistra: planificarea are drumul ei, fișa săptămânii, iar
 * `scrieSaptamanaInPontaj` scrie legitim zile viitoare din planul aprobat —
 * de aceea regula stă AICI, în acțiunea zilei, și nu într-un CHECK pe tabelă.
 * O zi dinaintea angajării nu era a firmei.
 *
 * Pe șiruri ISO, ca `meritaPontata` și `autorulPoateRetrage`: ordinea
 * lexicografică a lui `YYYY-MM-DD` e ordinea cronologică, iar `azi` vine din
 * `todayInBucharest()` — un `Date` în fusul serverului ar aluneca peste
 * granița zilei exact în noaptea în care contează.
 *
 * `angajatDin === null` sare verificarea angajării: importul poate lăsa
 * `hired_on` gol, iar un refuz pe o informație absentă ar bloca omul fără să-i
 * poată spune ce să repare. Viitorul se verifică primul — e singurul pe care
 * omul nu-l poate „repara” schimbând data.
 */
export function refuzulZilei(
  zi: string,
  azi: string,
  angajatDin: string | null,
): MotivRefuzZi | null {
  if (zi > azi) return "viitor";
  if (angajatDin !== null && zi < angajatDin) return "inainte_de_angajare";
  return null;
}

/**
 * Mesajul refuzului, pentru om. `angajatDin` intră doar în al doilea: spune
 * data de pe fișă, ca omul să știe ce să ceară la HR dacă e greșită.
 */
export function mesajRefuzZi(motiv: MotivRefuzZi, angajatDin: string | null): string {
  if (motiv === "viitor") {
    return "Ziua nu a venit încă: pontajul se completează pentru azi sau pentru zile trecute. Planificarea se face din fișa săptămânii.";
  }
  const data = angajatDin === null ? "data de angajare de pe fișă" : formatDate(angajatDin);
  return `Nu erați angajat la această dată: fișa spune angajat din ${data}.`;
}
