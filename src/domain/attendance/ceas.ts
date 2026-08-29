// src/domain/attendance/ceas.ts
// Ceasul de pontaj: cât a trecut de la „Am intrat" și cum se scrie durata aia
// pe un ecran de telefon. Funcții PURE, fără I/O și fără `Date.now()` — ora
// curentă vine ÎNTOTDEAUNA de la apelant, fiindcă autoritatea ei e ceasul
// serverului, nu al telefonului. Un telefon cu ora greșită n-are voie să
// producă ore de muncă.

/** `"08:30"` → minute de la miezul nopții, sau `null` dacă formatul e invalid. */
function minuteDinOra(ora: string): number | null {
  const potrivire = /^([01]\d|2[0-3]):([0-5]\d)$/u.exec(ora);
  if (potrivire === null) return null;
  const ore = potrivire[1];
  const minute = potrivire[2];
  if (ore === undefined || minute === undefined) return null;
  return Number(ore) * 60 + Number(minute);
}

/**
 * Minutele scurse de la intrare până la ora curentă, în aceeași zi.
 *
 * `null` când vreo oră e invalidă sau când „acum" e ÎNAINTEA intrării. Al doilea
 * caz nu e teoretic: e ziua deschisă aseară la 22:00 și rămasă neînchisă, privită
 * a doua zi dimineața. Modelul are un rând pe zi și ore fără dată, deci durata
 * aceea nu se poate exprima — ecranul trebuie să spună „zi neîncheiată", nu să
 * afișeze o cifră negativă sau, mai rău, una plauzibilă și greșită.
 */
export function minuteScurse(oraInceput: string, oraAcum: string): number | null {
  const inceput = minuteDinOra(oraInceput);
  const acum = minuteDinOra(oraAcum);
  if (inceput === null || acum === null) return null;
  if (acum < inceput) return null;
  return acum - inceput;
}

/**
 * Durata, scrisă pentru cineva care se uită la telefon în drum spre mașină.
 *
 * `„4 h 12 min"`, `„45 min"`, `„8 h"` — niciodată `„4.2 h"` și niciodată
 * `„4 h 0 min"`. Zecimalele sunt limbajul fluturașului de salariu, nu al omului
 * care vrea să știe de cât timp e la muncă.
 */
export function formatDurata(minute: number): string {
  if (!Number.isFinite(minute) || minute < 0) return "—";
  const intregi = Math.floor(minute);
  const ore = Math.floor(intregi / 60);
  const rest = intregi % 60;
  if (ore === 0) return `${String(rest)} min`;
  if (rest === 0) return `${String(ore)} h`;
  return `${String(ore)} h ${String(rest)} min`;
}

/**
 * Zilele în care nu s-a muncit, deci nici ceasul n-are ce căuta. Weekendul și
 * sărbătoarea lipsesc intenționat: se poate munci în ele.
 */
const TIPURI_ZI_ABSENTA: ReadonlySet<string> = new Set([
  "concediu",
  "medical",
  "absenta_nemotivata",
]);

/** Starea ceasului pentru ziua de azi, așa cum o vede ecranul. */
export type StareCeas =
  /** Nu există rând pe ziua de azi: se poate deschide. */
  | { readonly fel: "neinceputa" }
  /** Există `ora_inceput`, lipsește `ora_sfarsit`: se poate închide. */
  | { readonly fel: "in_curs"; readonly oraInceput: string; readonly minute: number | null }
  /** Ziua e completă. */
  | { readonly fel: "incheiata"; readonly oraInceput: string; readonly oraSfarsit: string }
  /**
   * Ziua există, dar NU vine din ceas: concediu sincronizat, zi scrisă din foaia
   * colectivă fără interval, sărbătoare. Ceasul nu o atinge.
   */
  | { readonly fel: "alta_sursa" };

/**
 * Ce poate face ceasul cu ziua de azi.
 *
 * Se decide pe FORMA rândului, nu pe `sursa`: o zi cu început și fără sfârșit e
 * „în curs" oricine ar fi scris-o, iar una cu amândouă e încheiată. `sursa` se
 * folosește doar ca să recunoască rândurile pe care ceasul nu are voie să le
 * atingă — cele venite din concediu.
 *
 * `oraSalvata` primește formatul din bază (`"08:00:00"`), deci se taie la
 * `HH:MM` înainte de orice comparație. Cine uită tăierea primește `null` din
 * `minuteScurse` și un ecran care spune „zi neîncheiată" fără motiv.
 */
export function stareaCeasului(
  zi: Readonly<{
    ora_inceput: string | null;
    ora_sfarsit: string | null;
    ore_lucrate: number | null;
    leave_request_id: string | null;
    tip_zi: string;
  }> | null,
  oraAcum: string,
): StareCeas {
  if (zi === null) return { fel: "neinceputa" };
  /*
   * Ce NU e al ceasului: ziua venită din concediul aprobat și zilele de absență.
   * `salveazaZiPontaj` refuză oricum rândurile de concediu, dar un buton care
   * duce sigur într-un refuz e un defect de ecran.
   *
   * Weekendul și sărbătoarea NU sunt pe lista asta, deliberat. Sunt zile în care
   * se poate munci — cu spor, tocmai de aceea. O condiție `tip_zi !==
   * "lucratoare"` ar fi făcut imposibilă închiderea unei zile deschise sâmbăta,
   * adică exact ziua în care greșeala costă cel mai mult.
   */
  if (zi.leave_request_id !== null || TIPURI_ZI_ABSENTA.has(zi.tip_zi)) {
    return { fel: "alta_sursa" };
  }

  // Formatul din bază e `"08:00:00"`; comparațiile se fac pe `HH:MM`.
  const inceput = zi.ora_inceput === null ? null : zi.ora_inceput.slice(0, 5);
  const sfarsit = zi.ora_sfarsit === null ? null : zi.ora_sfarsit.slice(0, 5);

  if (inceput === null) {
    // Rând fără interval. Dacă poartă ore, l-a scris responsabilul de pontaj din
    // foaia colectivă și ceasul nu-l atinge. Dacă e gol, e un loc liber pe care
    // pontarea îl poate deschide.
    return (zi.ore_lucrate ?? 0) > 0 || sfarsit !== null
      ? { fel: "alta_sursa" }
      : { fel: "neinceputa" };
  }
  if (sfarsit === null) {
    return { fel: "in_curs", oraInceput: inceput, minute: minuteScurse(inceput, oraAcum) };
  }
  return { fel: "incheiata", oraInceput: inceput, oraSfarsit: sfarsit };
}
