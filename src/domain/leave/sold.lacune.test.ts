// src/domain/leave/sold.lacune.test.ts
//
// Lacuna confirmată de audit: ramura „an în curs” a acumulării proporționale
// (nota B din migrare) și ramura „angajarea e după luna curentă”. Toate testele
// existente au data de referință în anul următor sau rezultat zero.

import { describe, expect, it } from "vitest";

import { calculeazaAcumulareProportionala } from "./sold";

const zi = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

describe("calculeazaAcumulareProportionala — anul în curs", () => {
  it("acumulează până la luna curentă inclusiv: 21/12 × 3 la 15 martie", () => {
    expect(
      calculeazaAcumulareProportionala(
        zi("2020-01-01"),
        2026,
        21,
        "fara_rotunjire",
        zi("2026-03-15"),
      ),
    ).toBe(5.25);
  });

  it("la ultima zi a lunii, luna e numărată o singură dată: 20/12 × 5, rotunjit în jos", () => {
    // 8,33 → 8
    expect(
      calculeazaAcumulareProportionala(zi("2020-01-01"), 2026, 20, "zi_in_jos", zi("2026-05-31")),
    ).toBe(8);
    expect(
      calculeazaAcumulareProportionala(
        zi("2020-01-01"),
        2026,
        20,
        "fara_rotunjire",
        zi("2026-05-31"),
      ),
    ).toBe(8.33);
  });

  it("angajarea în anul curent pornește din luna angajării", () => {
    // Iunie–septembrie: 4 luni × 21/12 = 7.
    expect(
      calculeazaAcumulareProportionala(
        zi("2026-06-15"),
        2026,
        21,
        "fara_rotunjire",
        zi("2026-09-30"),
      ),
    ).toBe(7);
  });

  it("angajarea după luna curentă, în același an, nu acumulează nimic", () => {
    expect(
      calculeazaAcumulareProportionala(
        zi("2026-06-15"),
        2026,
        21,
        "fara_rotunjire",
        zi("2026-03-01"),
      ),
    ).toBe(0);
  });
});
