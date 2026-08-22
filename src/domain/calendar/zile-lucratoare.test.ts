// src/domain/calendar/zile-lucratoare.test.ts

import { describe, expect, it } from "vitest";
import { calculeazaZileLucratoare } from "./zile-lucratoare";

function zi(an: number, luna: number, ziua: number): Date {
  return new Date(Date.UTC(an, luna - 1, ziua));
}

describe("calculeazaZileLucratoare", () => {
  it("un interval de o singură zi lucrătoare numără o zi", () => {
    // 5 ianuarie 2026 este luni.
    expect(calculeazaZileLucratoare(zi(2026, 1, 5), zi(2026, 1, 5))).toBe(1);
  });

  it("un interval de o singură zi de weekend numără zero", () => {
    // 3 ianuarie 2026 este sâmbătă.
    expect(calculeazaZileLucratoare(zi(2026, 1, 3), zi(2026, 1, 3))).toBe(0);
  });

  it("un interval care începe și se termină în weekend numără doar zilele lucrătoare dintre ele", () => {
    // Sâmbătă 3 ian. -> sâmbătă 10 ian. 2026: 5 zile lucrătoare (luni-vineri).
    expect(calculeazaZileLucratoare(zi(2026, 1, 3), zi(2026, 1, 10))).toBe(5);
  });

  it("un interval care conține o sărbătoare scade acea zi din total", () => {
    // Luni 5 ian. -> vineri 9 ian. 2026, cu o sărbătoare miercuri 7 ian.
    const sarbatori = [zi(2026, 1, 7)];
    expect(calculeazaZileLucratoare(zi(2026, 1, 5), zi(2026, 1, 9), sarbatori)).toBe(4);
  });

  it("o sărbătoare căzută în weekend nu scade de două ori", () => {
    // Aceeași săptămână ca testul de weekend, dar sărbătoarea cade duminică 4 ian.
    const sarbatori = [zi(2026, 1, 4)];
    expect(calculeazaZileLucratoare(zi(2026, 1, 3), zi(2026, 1, 10), sarbatori)).toBe(5);
  });

  it("o zi liberă a firmei scade acea zi, chiar dacă nu e sărbătoare legală", () => {
    const zileFirmei = [zi(2026, 1, 8)]; // joi, zi liberă suplimentară acordată de firmă
    expect(calculeazaZileLucratoare(zi(2026, 1, 5), zi(2026, 1, 9), [], zileFirmei)).toBe(4);
  });

  it("respinge un interval inversat (sfârșit înainte de început)", () => {
    expect(() => calculeazaZileLucratoare(zi(2026, 1, 10), zi(2026, 1, 5))).toThrow(RangeError);
  });
});
