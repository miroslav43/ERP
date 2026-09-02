// src/domain/evaluations/kpi.ts

/**
 * Calculul KPI-ului lunar.
 *
 * Al doilea tip de evaluare (`0119_kpi_lunar.sql`) e independent de cea anuală:
 * acolo se notează criterii pe o scală, aici se măsoară realizări față de
 * ținte. De aceea formula stă separat de `scor.ts`, nu ca al treilea mod al
 * lui `calculeazaScor` — cele două n-au niciun numitor comun.
 *
 * ── DE CE SE RENORMALIZEAZĂ PONDERILE ─────────────────────────────────────
 * Angajatul își vede scorul CONSTANT, inclusiv pe 5 ale lunii, când managerul
 * n-a apucat să completeze decât o linie din patru. Dacă liniile necompletate
 * ar intra cu zero, omul ar deschide portalul și ar vedea 25 % — o cifră care
 * nu spune nimic despre el, ci despre agenda managerului, și care s-ar plimba
 * în sus toată luna fără ca el să fi făcut ceva. Media se face deci numai peste
 * ce e completat, cu ponderile aduse la suta lor. E aceeași decizie ca `din`
 * din `scor.ts`, luată aici din același motiv.
 *
 * ── DE CE `sens` SCHIMBĂ FORMULA, NU DOAR SEMNUL ──────────────────────────
 * „Vizite: țintă 40" și „rebut: maxim 2 %" se citesc invers. Pe creștere,
 * procentul e raportul obișnuit `realizat / țintă`. Pe descreștere, raportul
 * s-ar fi dus la infinit exact în cazul cel mai bun (realizat zero), deci se
 * folosește abaterea simetrică `2 − realizat / țintă`: dă 100 % pe țintă
 * atinsă, 200 % la zero, 0 % la dublul țintei, și nu împarte niciodată la
 * valoarea măsurată.
 *
 * ── DE CE UN PLAFON ───────────────────────────────────────────────────────
 * `kpi_valori.procent` și `kpi_evaluari_lunare.scor_procent` sunt
 * `numeric(6,2)`. O țintă de 0,01 cu realizat 1000 dă 10 milioane de procente
 * și baza respinge INSERT-ul cu 22003 — o eroare pe care utilizatorul n-ar
 * avea cum s-o lege de ce a tastat. Plafonul e o constrângere de stocare
 * declarată, nu o judecată de produs.
 */

export type TipIndicatorKpi = "masurat" | "apreciat";
export type SensKpi = "crestere" | "descrestere";

/** Plafonul impus de `numeric(6,2)` din migrarea 0119. */
export const PROCENT_MAXIM = 9999.9;

export interface LinieKpi {
  readonly cod: string;
  readonly tip: TipIndicatorKpi;
  /** Obligatoriu la `masurat`, absent la `apreciat`. */
  readonly sens: SensKpi | null;
  readonly pondere: number;
  /** Obligatoriu la `apreciat`. */
  readonly scala_max: number | null;
  /** Ținta efectivă a lunii, deja înghețată pe rând. Obligatorie la `masurat`. */
  readonly tinta: number | null;
  /** `null` = necompletat. NU se confundă cu zero. */
  readonly realizat: number | null;
  /** `null` = nenotat. NU se confundă cu zero. */
  readonly nota: number | null;
}

export interface ScorLunar {
  /** 0..PROCENT_MAXIM cu o zecimală, sau `null` când nu e nimic de mediat. */
  readonly procent: number | null;
  readonly completate: number;
  readonly necompletate: number;
}

const SCOR_GOL: ScorLunar = { procent: null, completate: 0, necompletate: 0 };

/** O zecimală, fără zgomotul de virgulă mobilă al lui `toFixed` + `Number`. */
function rotunjeste(n: number): number {
  return Math.round(n * 10) / 10;
}

function incadreaza(procent: number): number {
  return rotunjeste(Math.min(Math.max(procent, 0), PROCENT_MAXIM));
}

const numar = (v: number | null): v is number => v !== null && Number.isFinite(v);

/**
 * Procentul de îndeplinire al unei singure linii.
 *
 * `null` înseamnă „nu se poate calcula" — linie necompletată, sau o definiție
 * din care lipsește ce trebuie. Niciodată zero: zero e un rezultat prost, nu o
 * absență, iar confuzia dintre ele e defectul din care s-a născut `scor.ts`.
 */
export function procentLinie(linie: LinieKpi): number | null {
  if (linie.tip === "apreciat") {
    if (!numar(linie.nota)) return null;
    const scala = linie.scala_max;
    if (!numar(scala) || scala <= 0) return null;
    // Se plafonează la citire, nu se aruncă: o notă peste scală poate exista
    // deja în bază, dintr-un indicator a cărui scală a scăzut între timp.
    return incadreaza((Math.min(Math.max(linie.nota, 0), scala) / scala) * 100);
  }

  if (!numar(linie.realizat)) return null;
  const tinta = linie.tinta;
  if (!numar(tinta)) return null;

  if (linie.sens === "descrestere") {
    // Ținta zero („zero accidente") nu e un raport, e un prag: atins sau ratat.
    if (tinta === 0) return linie.realizat <= 0 ? 100 : 0;
    return incadreaza((2 - linie.realizat / tinta) * 100);
  }

  // Creștere. O țintă de zero de depășit nu înseamnă nimic — orice realizare ar
  // fi infinit de bună, deci linia se raportează ca necalculabilă.
  if (tinta <= 0) return null;
  return incadreaza((linie.realizat / tinta) * 100);
}

/**
 * Scorul lunii: media ponderată a liniilor completate, cu ponderile
 * renormalizate. Vezi antetul pentru de ce necompletatele nu intră cu zero.
 */
export function calculeazaScorLunar(linii: readonly LinieKpi[]): ScorLunar {
  if (linii.length === 0) return SCOR_GOL;

  let suma = 0;
  let ponderi = 0;
  let completate = 0;
  let necompletate = 0;

  for (const linie of linii) {
    const procent = procentLinie(linie);
    if (procent === null) {
      necompletate += 1;
      continue;
    }
    completate += 1;
    const pondere = Number.isFinite(linie.pondere) ? Math.max(linie.pondere, 0) : 0;
    suma += pondere * procent;
    ponderi += pondere;
  }

  return {
    // `ponderi === 0` acoperă și „nimic completat", și „completat, dar toate
    // liniile au pondere zero". În ambele, o medie ar fi 0/0.
    procent: ponderi === 0 ? null : rotunjeste(suma / ponderi),
    completate,
    necompletate,
  };
}

/**
 * Ținta care se scrie pe rândul lunii: abaterea angajatului dacă există,
 * altfel implicita funcției.
 *
 * `??`, nu `||`: zero e o țintă legitimă („zero reclamații"), iar `||` ar fi
 * înlocuit-o tăcut cu ținta funcției — adică exact angajatul cu cerința cea
 * mai strictă ar fi fost măsurat cu cea mai relaxată.
 */
export function tintaEfectiva(implicita: number, abatere: number | null): number {
  return abatere ?? implicita;
}
