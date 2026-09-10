// src/app/(app)/pontaj/saptamana/scrie-pontajul.test.ts
//
// Testul există din cauza unui defect REAL, prins pe date de producție: cinci
// zile au intrat în pontaj cu intervalul corect (08:30–17:00) și ZERO ore.
//
// Cauza: Postgres întoarce `time` ca `"08:30:00"`, iar `minuteDinOra` cere
// EXACT `"HH:MM"`. Cu secunde, expresia nu se potrivea, `oreleZilei` întorcea
// `null`, iar `?? 0` scria zero ore fără nicio eroare — nici în jurnal, nici pe
// ecran. Calendarul arăta „0" pe zile lucrate.
//
// Clasa de defect: o valoare de rezervă (`?? 0`) pusă peste o funcție care
// semnalează eșecul cu `null`. Rezerva transformă un refuz în date false.
import { describe, expect, it } from "vitest";

import { oreleZilei, type ConfigZi } from "@/domain/attendance/calcul-ore";

/** Setările reale ale firmei din care a venit raportarea. */
const CONFIG: ConfigZi = {
  orePeZi: 8,
  noapteStart: "22:00",
  noapteSfarsit: "06:00",
  pauzaMinute: 30,
  pauzaInclusaInProgram: false,
  pauzaObligatoriePesteOre: 0,
};

/** Aceeași tăiere ca în `scrie-pontajul.ts`. */
const ora = (valoare: string | null): string => (valoare ?? "").slice(0, 5);

describe("orele unei zile venite din baza de date", () => {
  it("formatul Postgres, cu secunde, NU se potrivește direct", () => {
    // Dovada defectului: fără tăiere, funcția refuză.
    expect(oreleZilei("08:30:00", "17:00:00", CONFIG)).toBeNull();
  });

  it("tăiat la `HH:MM`, dă orele corecte", () => {
    const rezultat = oreleZilei(ora("08:30:00"), ora("17:00:00"), CONFIG);
    expect(rezultat).not.toBeNull();
    // 8h30 brut − 30 min pauză neinclusă = 8h.
    expect(rezultat?.lucrate).toBe(8);
    expect(rezultat?.suplimentare).toBe(0);
  });

  it("pauza chiar se scade — altfel ziua ar ieși cu o jumătate de oră în plus", () => {
    const cuPauza = oreleZilei("08:30", "17:00", CONFIG);
    const faraPauza = oreleZilei("08:30", "17:00", { ...CONFIG, pauzaMinute: 0 });
    expect(faraPauza?.lucrate).toBe(8.5);
    expect(cuPauza?.lucrate).toBe(8);
  });

  it("o zi mai lungă produce ore suplimentare", () => {
    const rezultat = oreleZilei(ora("08:00:00"), ora("19:00:00"), CONFIG);
    // 11h − 30 min = 10h30; peste norma de 8 rămân 2h30.
    expect(rezultat?.lucrate).toBe(10.5);
    expect(rezultat?.suplimentare).toBe(2.5);
  });

  it("un interval inversat rămâne `null`, nu devine zero", () => {
    // Apelantul trebuie să SARĂ ziua, nu s-o scrie la zero: o zi lipsă se vede
    // și se corectează, una la zero pare deja rezolvată.
    expect(oreleZilei(ora("17:00:00"), ora("08:30:00"), CONFIG)).toBeNull();
  });

  it("un interval gol rămâne `null`", () => {
    expect(oreleZilei(ora(null), ora(null), CONFIG)).toBeNull();
    expect(oreleZilei(ora(""), ora("17:00:00"), CONFIG)).toBeNull();
  });
});
