// src/domain/leave/zile-cerere.ts

/**
 * Previzualizarea zilelor consumate de o cerere de concediu, calculată
 * CLIENT-SIDE, fără round-trip la server.
 *
 * Replică EXACT ordinea de decizie din `app.este_zi_lucratoare`
 * (supabase/migrations/0009_leave.sql):
 *
 *   1. `zi_recuperare` (organization_holidays) ⇒ lucrătoare, chiar sâmbăta.
 *   2. ISO-dow 6 sau 7 (sâmbătă/duminică)      ⇒ nelucrătoare.
 *   3. `public_holidays` (tara = 'RO')          ⇒ nelucrătoare.
 *   4. `liber_suplimentar` (organization_holidays) ⇒ nelucrătoare.
 *   5. altfel                                   ⇒ lucrătoare.
 *
 * NU folosiți `calculeazaZileLucratoare` din `@/domain/calendar`: nu cunoaște
 * zilele de recuperare. Sursa zilelor speciale este `public_holidays` /
 * `organization_holidays` — NU `sarbatoriAnului()` — altfel cifra afișată aici
 * ar diferi de cea scrisă de `internal.leave_requests_pregateste` la INSERT.
 *
 * ── FĂRĂ JUMĂTĂȚI DE ZI ────────────────────────────────────────────────────
 * Concediul se cere pe zile ÎNTREGI. Funcția a primit până la 0112 două
 * porțiuni (`leave_day_portion`) și adăuga 0,5 la extremitățile parțiale;
 * coloanele mai există în bază, dar o constrângere le ține pe `zi_intreaga`,
 * iar `app.numara_zile_lucratoare` a pierdut cei doi parametri odată cu ele.
 * Rezultatul e de acum ÎNTOTDEAUNA un întreg.
 *
 * Funcție PURĂ: seturile de zile speciale se primesc ca parametru, calculate
 * o singură dată pe server și pasate componentei client.
 */

/** Zi calendaristică ISO, `"2026-03-09"`. */
export type ZiCalendaristica = string;

export interface RezultatZileCerere {
  /** Zile lucrătoare consumate din sold — număr întreg, o zi pentru fiecare zi. */
  readonly zileLucratoare: number;
  /** Numărul brut de zile calendaristice ale intervalului (inclusiv capetele). */
  readonly zileCalendaristice: number;
}

const RE_ZI = /^\d{4}-\d{2}-\d{2}$/u;

function parseZi(valoare: string, eticheta: string): Date {
  if (!RE_ZI.test(valoare)) {
    throw new RangeError(
      `${eticheta} trebuie să fie o zi calendaristică în formatul AAAA-LL-ZZ: ${valoare}`,
    );
  }
  const parti = valoare.split("-");
  const an = Number(parti[0]);
  const luna = Number(parti[1]);
  const zi = Number(parti[2]);
  const data = new Date(Date.UTC(an, luna - 1, zi));
  // Verifică faptul că data chiar există (respinge 31.02, 29.02 nebisect).
  if (data.getUTCFullYear() !== an || data.getUTCMonth() !== luna - 1 || data.getUTCDate() !== zi) {
    throw new RangeError(`${eticheta} nu este o zi calendaristică validă: ${valoare}`);
  }
  return data;
}

function adaugaOZi(data: Date): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate() + 1));
}

function laSirIso(data: Date): ZiCalendaristica {
  const an = String(data.getUTCFullYear()).padStart(4, "0");
  const luna = String(data.getUTCMonth() + 1).padStart(2, "0");
  const zi = String(data.getUTCDate()).padStart(2, "0");
  return `${an}-${luna}-${zi}`;
}

/** ISO-dow: luni = 1 … duminică = 7 (spre deosebire de `Date#getUTCDay()`, unde duminica e 0). */
function esteWeekend(data: Date): boolean {
  const isoDow = data.getUTCDay() === 0 ? 7 : data.getUTCDay();
  return isoDow === 6 || isoDow === 7;
}

function esteZiLucratoare(
  ziIso: ZiCalendaristica,
  data: Date,
  sarbatoriRo: ReadonlySet<string>,
  liberSuplimentar: ReadonlySet<string>,
  zileRecuperare: ReadonlySet<string>,
): boolean {
  if (zileRecuperare.has(ziIso)) return true;
  if (esteWeekend(data)) return false;
  if (sarbatoriRo.has(ziIso)) return false;
  if (liberSuplimentar.has(ziIso)) return false;
  return true;
}

/**
 * Numără zilele lucrătoare consumate de o cerere de concediu.
 *
 * `sarbatoriRo` = `public_holidays.data` (tara = 'RO') pentru anii relevanți.
 * `liberSuplimentar` = `organization_holidays.data` cu `tip = 'liber_suplimentar'`.
 * `zileRecuperare` = `organization_holidays.data` cu `tip = 'zi_recuperare'`.
 */
export function numaraZileCerere(
  dataInceput: ZiCalendaristica,
  dataSfarsit: ZiCalendaristica,
  sarbatoriRo: readonly ZiCalendaristica[],
  liberSuplimentar: readonly ZiCalendaristica[],
  zileRecuperare: readonly ZiCalendaristica[],
): RezultatZileCerere {
  const inceput = parseZi(dataInceput, "Data de început");
  const sfarsit = parseZi(dataSfarsit, "Data de sfârșit");
  if (sfarsit.getTime() < inceput.getTime()) {
    throw new RangeError("Data de sfârșit este anterioară datei de început.");
  }

  const setSarbatori = new Set(sarbatoriRo);
  const setLiber = new Set(liberSuplimentar);
  const setRecuperare = new Set(zileRecuperare);

  let zileLucratoare = 0;
  let zileCalendaristice = 0;
  let ziua = inceput;
  while (ziua.getTime() <= sfarsit.getTime()) {
    const ziIso = laSirIso(ziua);
    zileCalendaristice += 1;

    if (esteZiLucratoare(ziIso, ziua, setSarbatori, setLiber, setRecuperare)) {
      zileLucratoare += 1;
    }
    ziua = adaugaOZi(ziua);
  }

  return { zileLucratoare, zileCalendaristice };
}
