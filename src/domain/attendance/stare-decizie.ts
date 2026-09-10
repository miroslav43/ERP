// src/domain/attendance/stare-decizie.ts
//
// În ce stadiu de decizie e o zi de pontaj: aprobată, respinsă, sau încă
// nedecisă.
//
// ── DE CE E O FUNCȚIE, ȘI NU DOUĂ BOOLEENE CITITE LA FIECARE CELULĂ ─────────
// Baza ține două coloane, `approved_at` și `respins_la`, cu o constrângere care
// interzice să fie amândouă nenule (`attendance_entries_decizie_ck`, 0067:63).
// Deci sunt TREI stări, nu patru — dar fiecare ecran care le citea ca doi
// booleeni independenți trebuia să știe singur asta, iar ordinea verificărilor
// era la voia fiecăruia. Aici e o singură traducere, cu o singură ordine.
//
// ── DE CE CONTEAZĂ ACUM ─────────────────────────────────────────────────────
// Foaia colectivă și calendarul lunii colorează celula după starea asta. O
// culoare care se schimbă după ordinea a doi booleeni ar fi exact felul de
// defect care nu produce nicio eroare: verde pe o zi respinsă, și nimeni nu
// află până la control.
import type { StatusPerioada } from "@/schemas/attendance";

/** Cele trei stadii posibile ale unei zile care EXISTĂ în bază. */
export type StareDecizie = "aprobata" | "respinsa" | "de_decis";

/**
 * Stadiul deciziei pentru o zi.
 *
 * Respinsul se verifică ÎNAINTEA aprobatului, deși constrângerea le interzice
 * pe amândouă: dacă vreodată un rând scapă cu ambele (o migrare care le scrie
 * cu clientul de serviciu, care nu trece prin constrângere la fel), varianta
 * care trebuie să iasă la suprafață e cea care cere acțiune, nu cea liniștită.
 */
export function stareaDeciziei(
  intrare: Readonly<{ aprobat: boolean; respins: boolean }>,
): StareDecizie {
  if (intrare.respins) return "respinsa";
  if (intrare.aprobat) return "aprobata";
  return "de_decis";
}

/**
 * Ziua mai poate fi decisă de un aprobator?
 *
 * `de_decis` e singura care CERE o decizie, dar o zi deja decisă se poate
 * răzgândi cât timp luna nu e blocată — `public.decide_zi_pontaj` (0067) o
 * acceptă, iar aprobarea ștearsă e chiar felul în care o respingere redeschide
 * ziua pentru corecție. Singurul refuz real vine din starea lunii.
 */
export function ziuaSeMaiPoateDecide(status: StatusPerioada): boolean {
  return status !== "blocata";
}
