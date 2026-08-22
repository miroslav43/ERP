// src/domain/fleet/kilometraj.ts

/**
 * Continuitatea kilometrajului între foi de parcurs succesive, replicată la
 * nivel de aplicaţie din triggerele `internal.foi_parcurs_inainte` /
 * `internal.foi_parcurs_dupa` (0012_fleet.sql), pentru feedback imediat în
 * formular — decizia finală rămâne oricum a bazei de date.
 *
 * Regres = kilometrajul de plecare sau de sosire e mai mic decât ultimul
 * kilometraj cunoscut: fizic imposibil, se blochează. Salt = diferenţa dintre
 * plecare şi ultimul kilometraj cunoscut depăşeşte pragul: posibil, dar
 * suspect (o foaie lipsă) — doar se semnalează.
 */

export const PRAG_SALT_KM_IMPLICIT = 1500;

export type RezultatContinuitateKm = "ok" | "regres" | "salt";

export function verificaContinuitate(
  kmUltim: number,
  kmPlecare: number,
  kmSosire: number | null | undefined,
  pragSalt: number = PRAG_SALT_KM_IMPLICIT,
): RezultatContinuitateKm {
  if (kmUltim < 0 || kmPlecare < 0) {
    throw new Error("Kilometrajul nu poate fi negativ.");
  }
  if (kmSosire !== null && kmSosire !== undefined && kmSosire < 0) {
    throw new Error("Kilometrajul nu poate fi negativ.");
  }
  if (pragSalt <= 0) {
    throw new Error("Pragul de salt trebuie să fie un număr pozitiv de kilometri.");
  }

  if (kmPlecare < kmUltim) {
    return "regres";
  }
  if (kmSosire !== null && kmSosire !== undefined && kmSosire < kmPlecare) {
    return "regres";
  }
  if (kmPlecare - kmUltim > pragSalt) {
    return "salt";
  }
  return "ok";
}
