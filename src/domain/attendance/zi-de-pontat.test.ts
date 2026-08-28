import { describe, expect, it } from "vitest";

import { meritaPontata, type RegimZile } from "./zi-de-pontat";

/** Firma lucrează șapte zile din șapte, sărbători incluse. */
const NONSTOP: RegimZile = { lucreazaWeekend: true, lucreazaSarbatori: true };

/** Program de birou: luni–vineri, fără sărbători legale. */
const BIROU: RegimZile = { lucreazaWeekend: false, lucreazaSarbatori: false };

describe("meritaPontata", () => {
  it("o zi lucrătoare obișnuită se pontează în ambele regimuri", () => {
    // 2026-08-28 e vineri și nu e sărbătoare.
    expect(meritaPontata("2026-08-28", BIROU)).toBe(true);
    expect(meritaPontata("2026-08-28", NONSTOP)).toBe(true);
  });

  it("weekendul se pontează doar dacă firma lucrează în weekend", () => {
    // Sâmbătă, apoi duminică.
    expect(meritaPontata("2026-08-29", BIROU)).toBe(false);
    expect(meritaPontata("2026-08-30", BIROU)).toBe(false);
    expect(meritaPontata("2026-08-29", NONSTOP)).toBe(true);
    expect(meritaPontata("2026-08-30", NONSTOP)).toBe(true);
  });

  it("sărbătoarea legală într-o zi de lucru ascultă de `lucreazaSarbatori`", () => {
    // 1 Decembrie 2026 cade marți; 1 Mai 2026 cade vineri.
    expect(meritaPontata("2026-12-01", BIROU)).toBe(false);
    expect(meritaPontata("2026-05-01", BIROU)).toBe(false);
    expect(meritaPontata("2026-12-01", NONSTOP)).toBe(true);
    expect(meritaPontata("2026-05-01", NONSTOP)).toBe(true);
  });

  it("cele două reguli sunt independente", () => {
    // Firma lucrează în weekend, dar nu de sărbători — și invers.
    const doarWeekend: RegimZile = { lucreazaWeekend: true, lucreazaSarbatori: false };
    const doarSarbatori: RegimZile = { lucreazaWeekend: false, lucreazaSarbatori: true };

    expect(meritaPontata("2026-08-29", doarWeekend)).toBe(true);
    expect(meritaPontata("2026-12-01", doarWeekend)).toBe(false);

    expect(meritaPontata("2026-08-29", doarSarbatori)).toBe(false);
    expect(meritaPontata("2026-12-01", doarSarbatori)).toBe(true);
  });

  it("o sărbătoare căzută în weekend e refuzată de oricare dintre reguli", () => {
    /*
     * 15 august 2026 (Adormirea Maicii Domnului) cade sâmbătă. E cazul în care
     * cele două porți se suprapun: ca ziua să merite pontată trebuie să treacă
     * de AMÂNDOUĂ, nu de una singură.
     */
    expect(meritaPontata("2026-08-15", BIROU)).toBe(false);
    expect(meritaPontata("2026-08-15", { lucreazaWeekend: true, lucreazaSarbatori: false })).toBe(
      false,
    );
    expect(meritaPontata("2026-08-15", { lucreazaWeekend: false, lucreazaSarbatori: true })).toBe(
      false,
    );
    expect(meritaPontata("2026-08-15", NONSTOP)).toBe(true);
  });

  it("sărbătorile mobile se mișcă odată cu Paștele", () => {
    // Paștele ortodox 2026 e pe 12 aprilie; a doua zi de Paști, 13 aprilie, e luni.
    expect(meritaPontata("2026-04-13", BIROU)).toBe(false);
    expect(meritaPontata("2026-04-13", NONSTOP)).toBe(true);
    // Aceeași zi din 2027 e o luni obișnuită — Paștele cade pe 2 mai.
    expect(meritaPontata("2027-04-13", BIROU)).toBe(true);
  });

  it("fără setări nu se insistă pe nicio zi", () => {
    /*
     * Regimul lipsește doar cât timp firmei nu i s-a scris încă rândul de
     * `attendance_settings`. Nu inventăm o politică implicită: greșeala ieftină
     * e să tăcem, nu să-i cerem omului să se ponteze duminica.
     */
    expect(meritaPontata("2026-08-28", null)).toBe(false);
    expect(meritaPontata("2026-08-29", null)).toBe(false);
  });

  it("refuză o zi care nu e `YYYY-MM-DD`", () => {
    expect(meritaPontata("28-08-2026", NONSTOP)).toBe(false);
    expect(meritaPontata("", NONSTOP)).toBe(false);
    expect(meritaPontata("2026-13-45", NONSTOP)).toBe(false);
  });
});
