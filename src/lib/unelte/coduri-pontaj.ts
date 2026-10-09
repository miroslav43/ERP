import { CODURI_TIP_ZI } from "@/domain/attendance/coduri-zi";

/**
 * Codurile foii de pontaj și ale condicii gratuite.
 *
 * ── DE CE DIN `CODURI_TIP_ZI` ─────────────────────────────────────────────
 * Aplicația scrie în foaia colectivă din arhiva lunară CO, CM, AN, D, L și SL
 * (`src/domain/attendance/coduri-zi.ts`). Unealta gratuită folosește exact
 * aceleași litere: cine trece de pe hârtie în aplicație nu învață altă legendă.
 *
 * CFS e singurul cod în plus. Aplicația ține concediul fără salariu ca TIP DE
 * CONCEDIU (`fara_plata`), nu ca tip de zi, deci n-are cod de celulă; pe o
 * foaie de hârtie, fără el, contabilul l-ar scrie de mână, fiecare altfel.
 *
 * Orele suplimentare și cele de noapte NU sunt coduri: au coloane proprii, ca
 * „Supl.” și „Noapte” din arhiva aplicației.
 */

export type CodFoaie = Readonly<{ cod: string; denumire: string }>;

/** Absențele numărate în coloanele de total, în ordinea coloanelor. */
export const CODURI_ABSENTA: readonly CodFoaie[] = [
  { cod: CODURI_TIP_ZI.concediu, denumire: "concediu de odihnă" },
  { cod: CODURI_TIP_ZI.medical, denumire: "concediu medical" },
  { cod: "CFS", denumire: "concediu fără salariu" },
  { cod: CODURI_TIP_ZI.absenta_nemotivata, denumire: "absență nemotivată" },
  { cod: CODURI_TIP_ZI.delegatie, denumire: "delegație" },
];

/** Ziua din afara programului: repaus săptămânal. */
export const COD_REPAUS = CODURI_TIP_ZI.weekend;

/** Sărbătoare legală în care nu se lucrează. */
export const COD_SARBATOARE = CODURI_TIP_ZI.sarbatoare;

export const CODURI_LEGENDA: readonly CodFoaie[] = [
  ...CODURI_ABSENTA,
  { cod: COD_REPAUS, denumire: "zi de repaus" },
  { cod: COD_SARBATOARE, denumire: "sărbătoare legală" },
];

/** Lista din validarea Excel: aceleași coduri, în ordinea legendei. */
export const LISTA_CODURI: readonly string[] = CODURI_LEGENDA.map((c) => c.cod);

export const TEXT_LEGENDA = `Legendă: cifra = ore lucrate; ${CODURI_LEGENDA.map(
  (c) => `${c.cod} = ${c.denumire}`,
).join("; ")}.`;
