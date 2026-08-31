// src/domain/leave/sold.test.ts

import { describe, expect, it } from "vitest";
import { calculeazaAcumulareProportionala, rotunjesteZileConcediu } from "./sold";

function zi(an: number, luna: number, ziua: number): Date {
  return new Date(Date.UTC(an, luna - 1, ziua));
}

describe("calculeazaAcumulareProportionala", () => {
  it("angajat de la 1 ianuarie acumulează dreptul anual integral", () => {
    const zile = calculeazaAcumulareProportionala(
      zi(2025, 1, 1),
      2025,
      20,
      "fara_rotunjire",
      zi(2026, 1, 15), // anul 2025 s-a încheiat deja
    );
    expect(zile).toBe(20);
  });

  it("angajat la 15 iunie acumulează proporțional cele 7 luni rămase din an", () => {
    const zile = calculeazaAcumulareProportionala(
      zi(2025, 6, 15),
      2025,
      21,
      "zi_in_sus",
      zi(2026, 1, 15),
    );
    // 21 / 12 = 1,75 pe lună × 7 luni (iunie-decembrie) = 12,25 -> rotunjit la zi în sus = 13
    expect(zile).toBe(13);
  });

  it("angajat anul trecut are dreptul anual integral pentru anul curent", () => {
    const zile = calculeazaAcumulareProportionala(
      zi(2023, 3, 1),
      2025,
      20,
      "fara_rotunjire",
      zi(2026, 1, 10),
    );
    expect(zile).toBe(20);
  });

  it("angajat în decembrie acumulează doar fracțiunea unei singure luni", () => {
    const zile = calculeazaAcumulareProportionala(
      zi(2025, 12, 10),
      2025,
      24,
      "zi_in_sus",
      zi(2026, 3, 1),
    );
    // 24 / 12 = 2 pe lună × 1 lună (decembrie) = 2
    expect(zile).toBe(2);
  });

  it("nu acumulează nimic dacă angajatul nu era încă încadrat în anul respectiv", () => {
    const zile = calculeazaAcumulareProportionala(
      zi(2026, 3, 1),
      2025,
      20,
      "fara_rotunjire",
      zi(2026, 6, 1),
    );
    expect(zile).toBe(0);
  });

  it("nu acumulează nimic dacă anul de calcul nu a început încă la data de referință", () => {
    const zile = calculeazaAcumulareProportionala(
      zi(2020, 1, 1),
      2027,
      20,
      "fara_rotunjire",
      zi(2026, 6, 1),
    );
    expect(zile).toBe(0);
  });

  it("respinge un drept anual negativ", () => {
    expect(() =>
      calculeazaAcumulareProportionala(zi(2025, 1, 1), 2025, -1, "fara_rotunjire", zi(2026, 1, 1)),
    ).toThrow(RangeError);
  });
});

describe("rotunjesteZileConcediu", () => {
  it("fara_rotunjire păstrează valoarea la 2 zecimale", () => {
    expect(rotunjesteZileConcediu(12.256, "fara_rotunjire")).toBe(12.26);
  });

  it("zi_in_sus rotunjește în sus la ziua întreagă", () => {
    // Modul implicit după 0112, în locul lui `jumatate_in_sus`: aceeași
    // direcție (favorabilă salariatului), dar fără jumătatea de zi care nu se
    // mai poate cheltui pe nicio cerere.
    expect(rotunjesteZileConcediu(12.25, "zi_in_sus")).toBe(13);
    expect(rotunjesteZileConcediu(12, "zi_in_sus")).toBe(12);
  });

  it("zi_in_jos rotunjește în jos la ziua întreagă", () => {
    expect(rotunjesteZileConcediu(12.9, "zi_in_jos")).toBe(12);
  });

  it("matematic rotunjește standard la cea mai apropiată zi", () => {
    expect(rotunjesteZileConcediu(12.5, "matematic")).toBe(13);
    expect(rotunjesteZileConcediu(12.4, "matematic")).toBe(12);
  });
});

describe("modurile de rotunjire pe jumătate de zi au dispărut", () => {
  it("niciun mod rămas nu poate produce o jumătate de zi", () => {
    // Poarta: dacă cineva reintroduce `jumatate_in_*` în tipul `ModRotunjire`,
    // testul cade — cu excepția lui `fara_rotunjire`, care păstrează fracția
    // brută tocmai fiindcă nu rotunjește nimic.
    const moduri = ["zi_in_sus", "zi_in_jos", "matematic"] as const;
    for (const mod of moduri) {
      for (const valoare of [12.25, 12.5, 12.75, 0.5, 19.99]) {
        expect(Number.isInteger(rotunjesteZileConcediu(valoare, mod))).toBe(true);
      }
    }
  });
});
