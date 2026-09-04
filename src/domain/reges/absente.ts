// src/domain/reges/absente.ts
// Serii de absențe nemotivate, din pontajul unei luni. Modul PUR: fără I/O,
// fără importuri de infrastructură, fără `Date` — zilele sunt `AAAA-LL-ZZ` și
// se compară lexicografic, ca peste tot în `domain/reges`.
//
// ┌ Ce înseamnă „consecutive" ────────────────────────────────────────────────
// │ NU „zile calendaristice la rând": o absență de vineri urmată de una de luni
// │ e o serie de două zile, fiindcă sâmbăta și duminica nu erau zile de lucru.
// │ Seria se rupe de o zi în care omul a FĂCUT ceva — a lucrat, a fost în
// │ concediu, a fost în medical — nu de trecerea timpului.
// │
// │ De aceea funcția primește TOATE zilele de pontaj ale lunii, nu doar
// │ absențele: fără zilele dintre ele n-ar exista niciun criteriu de rupere, iar
// │ două absențe la distanță de trei săptămâni ar apărea ca o serie de două.
// └───────────────────────────────────────────────────────────────────────────

export type ZiIso = string;

/** O zi din pontaj, redusă la ce contează pentru ruperea seriei. */
export interface ZiPontaj {
  readonly employeeId: string;
  readonly data: ZiIso;
  readonly tipZi: string;
  readonly oreLucrate: number;
}

export interface SerieAbsente {
  readonly employeeId: string;
  readonly dataInceput: ZiIso;
  /** Ultima zi de absență a seriei. Seria poate fi încă deschisă în realitate. */
  readonly dataSfarsit: ZiIso;
  readonly zile: number;
}

/**
 * Zilele care NU rup o serie de absențe, deși nu sunt ele însele absențe.
 *
 * Weekendul și sărbătoarea legală întrerup absența doar dacă omul a lucrat
 * atunci — altfel sunt zile în care oricum n-avea obligația să vină, deci nu
 * spun nimic despre întoarcerea lui.
 */
const NEUTRE = new Set(["weekend", "sarbatoare"]);

/**
 * Pragul de la care o serie merită semnalată către resurse umane.
 *
 * DOI, nu unu: o absență de o zi are prea multe explicații nevinovate — telefon
 * mort, accident, urgență în familie — iar o suspendare transmisă la ITM și apoi
 * retrasă e o corecție de registru pe care o vede toată lumea. E o convenție de
 * produs, nu o regulă legală; de aceea stă aici și nu în `reges_termene`.
 */
export const PRAG_ZILE_ALERTA = 2;

/**
 * Seriile de absențe nemotivate, per angajat, din zilele de pontaj primite.
 *
 * Zilele NU trebuie sortate de apelant: funcția le sortează pe angajat și dată,
 * fiindcă ordinea din PostgREST depinde de indexul folosit și s-a schimbat deja
 * o dată sub picioarele unui apelant.
 */
export function seriiDeAbsente(
  zile: readonly ZiPontaj[],
  pragZile: number = PRAG_ZILE_ALERTA,
): readonly SerieAbsente[] {
  const ordonate = [...zile].sort(
    (a, b) => a.employeeId.localeCompare(b.employeeId) || a.data.localeCompare(b.data),
  );

  interface SerieInLucru {
    employeeId: string;
    inceput: ZiIso;
    sfarsit: ZiIso;
    zile: number;
  }

  const serii: SerieAbsente[] = [];
  let curenta: SerieInLucru | null = null;

  const inchide = (): void => {
    if (curenta !== null && curenta.zile >= pragZile) {
      serii.push({
        employeeId: curenta.employeeId,
        dataInceput: curenta.inceput,
        dataSfarsit: curenta.sfarsit,
        zile: curenta.zile,
      });
    }
    curenta = null;
  };

  for (const zi of ordonate) {
    if (curenta !== null && curenta.employeeId !== zi.employeeId) inchide();

    if (zi.tipZi === "absenta_nemotivata") {
      if (curenta === null) {
        curenta = { employeeId: zi.employeeId, inceput: zi.data, sfarsit: zi.data, zile: 1 };
      } else {
        curenta.sfarsit = zi.data;
        curenta.zile += 1;
      }
      continue;
    }

    // O zi neutră în care nu s-a lucrat lasă seria deschisă; orice altceva o rupe.
    if (NEUTRE.has(zi.tipZi) && zi.oreLucrate === 0) continue;
    inchide();
  }
  inchide();

  return serii;
}
