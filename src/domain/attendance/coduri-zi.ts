// src/domain/attendance/coduri-zi.ts
//
// Codurile de pontaj scrise în celula unei zile fără ore lucrate.
//
// ── DE CE AU IEȘIT DIN `etichete.ts` ────────────────────────────────────────
// Au stat până acum în `src/app/(app)/pontaj/etichete.ts`, alături de clasele
// Tailwind și de tonurile de pastilă — adică într-un fișier de prezentare, în
// arborele de rute. Când generatorul de Excel al arhivei (0134) a avut nevoie
// de aceleași coduri, singura cale era un import din `src/lib/` către
// `src/app/`, adică exact pe dos față de cum curge restul proiectului.
//
// Codurile nu sunt prezentare: sunt convenția românească de foaie colectivă,
// aceeași pe ecran, în Excel și pe hârtia dusă la control. `etichete.ts` le
// reexportă, deci niciun consumator existent nu s-a schimbat.
import type { TipZi } from "@/schemas/attendance";

/**
 * Codul scris ÎN celulă când ziua n-are ore lucrate.
 *
 * `0` pe o zi lucrătoare înseamnă „zi înregistrată, zero ore" — altceva decât o
 * zi fără nicio intrare, care rămâne „—". Restul sunt codurile consacrate din
 * practica românească.
 */
export const CODURI_TIP_ZI: Readonly<Record<TipZi, string>> = {
  lucratoare: "0",
  weekend: "L",
  sarbatoare: "SL",
  concediu: "CO",
  medical: "CM",
  absenta_nemotivata: "AN",
  delegatie: "D",
};
