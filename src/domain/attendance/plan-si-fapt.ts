// src/domain/attendance/plan-si-fapt.ts
//
// Cum arată o zi din „Planul săptămânii" când ziua a fost DEJA pontată.
//
// ── DE CE EXISTĂ ────────────────────────────────────────────────────────────
// Pontajul are două tabele, pe două intenții: `attendance_week_submission_days`
// e ce ai PLANIFICAT, `attendance_entries` e ce ai LUCRAT. Până în 0118 nu se
// vedeau deloc una pe alta: pontai marți de acasă, trăgând peste grila orară,
// și planul săptămânii continua să spună „La birou, 8 ore" — adică ecranul care
// se trimite spre aprobare contrazicea ecranul din care se pontează.
//
// Legătura se face AICI, la citire, nu printr-o a doua scriere. O scriere ar fi
// modificat, după fapt, planul unei săptămâni deja trimise sau aprobate: cineva
// ar fi deschis o săptămână decisă și ar fi găsit alte cifre decât cele pe care
// le-a aprobat, fără nicio urmă.
//
// ── REGULA, ȘI DE CE E PE CÂMP, NU PE RÂND ─────────────────────────────────
// „Faptul bate planul" aplicat pe tot rândul ar fi stricat exact cazul pentru
// care s-a construit pontarea rapidă: o zi deschisă cu „Am intrat" și încă
// neînchisă are `ora_sfarsit` null. Copiat peste plan, golul ăla ar fi șters
// intervalul planificat de pe ecran — iar `trimite_saptamana_pontaj` face
// `delete` + reinserare (0084), deci următoarea trimitere l-ar fi șters și din
// bază. Fără nicio eroare, ca de obicei.
//
// Deci: fiecare câmp trece de la fapt la plan doar dacă faptul are ce spune.
// Intervalul e o PERECHE — ori amândouă orele, ori niciuna — fiindcă asta cere
// și `_interval_ck` (0075), și refinement-ul din `ziPlanificataSchema`.
//
// Observația NU se preia deloc. Nota de pe ziua pontată explică ziua lucrată
// („am plecat mai devreme la ANAF"); nota de pe plan explică intenția. Trecute
// una în alta, ar produce un text pe care nu l-a scris nimeni pentru locul unde
// apare.

import type { TipPrezenta } from "@/schemas/attendance";

/** Ce știe planul despre o zi. Forma citită din `citesteSaptamanaPontaj`. */
export interface ZiPlanificataCitita {
  readonly tip_prezenta: TipPrezenta;
  /** `time` din Postgres, cu secunde: `"08:30:00"`. */
  readonly ora_inceput: string | null;
  readonly ora_sfarsit: string | null;
  readonly observatii: string | null;
}

/** Ce știe pontajul real despre aceeași zi. Forma citită din `intrariLuna`. */
export interface ZiPontataCitita {
  readonly tip_prezenta: TipPrezenta | null;
  readonly ora_inceput: string | null;
  readonly ora_sfarsit: string | null;
}

/** Forma cerută de formularul săptămânii — ore `HH:MM`, fără `null`. */
export interface ZiInitialaPlan {
  readonly data: string;
  readonly tip_prezenta: TipPrezenta;
  readonly ora_inceput: string;
  readonly ora_sfarsit: string;
  readonly observatii: string;
}

/** Locul de muncă implicit al unei zile despre care nu s-a declarat nimic. */
export const TIP_PREZENTA_IMPLICIT: TipPrezenta = "birou";

/** `"08:30:00"` → `"08:30"`; `null` → `""`. */
function oraFormular(ora: string | null | undefined): string {
  return ora === null || ora === undefined ? "" : ora.slice(0, 5);
}

/**
 * Ziua cu care pornește formularul planului.
 *
 * `planificata` — rândul din submisia săptămânii, sau `null` dacă săptămâna n-a
 * fost niciodată salvată. `pontata` — ziua din `attendance_entries`, sau `null`
 * dacă n-a fost pontată.
 *
 * Amândouă lipsă înseamnă o zi goală: nici măcar weekendul nu primește un
 * interval presupus (defectul reparat în 0080 — șapte zile × 8 ore trimise de
 * cineva care doar a apăsat „Trimite").
 */
export function ziuaInitialaPlan(
  data: string,
  planificata: ZiPlanificataCitita | null,
  pontata: ZiPontataCitita | null,
): ZiInitialaPlan {
  // Intervalul se ia de la fapt doar ÎNTREG. O zi încă deschisă („Am intrat"
  // fără „Am ieșit") lasă planul neatins.
  const intervalPontat =
    pontata !== null && pontata.ora_inceput !== null && pontata.ora_sfarsit !== null
      ? { inceput: pontata.ora_inceput, sfarsit: pontata.ora_sfarsit }
      : null;

  return {
    data,
    tip_prezenta: pontata?.tip_prezenta ?? planificata?.tip_prezenta ?? TIP_PREZENTA_IMPLICIT,
    ora_inceput: oraFormular(intervalPontat?.inceput ?? planificata?.ora_inceput),
    ora_sfarsit: oraFormular(intervalPontat?.sfarsit ?? planificata?.ora_sfarsit),
    observatii: planificata?.observatii ?? "",
  };
}
