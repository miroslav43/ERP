// src/domain/leave/zile-cerere.lacune.test.ts
//
// Lacuna confirmată de audit: `numaraZileCerere` e și sursa zilelor lucrătoare
// ale LUNII pentru salarizare (`zileLucratoareLuna`, src/lib/queries/payroll.ts),
// dar testele existente acoperă doar intervale de 1–7 zile.

import { describe, expect, it } from "vitest";

import { numaraZileCerere } from "./zile-cerere";

describe("numaraZileCerere — o lună întreagă", () => {
  it("decembrie 2026: 23 de zile luni–vineri minus 1 și 25 decembrie", () => {
    // 1 decembrie e marți, 25 vineri; 26 decembrie e sâmbătă și nu scade nimic.
    expect(
      numaraZileCerere(
        "2026-12-01",
        "2026-12-31",
        ["2026-12-01", "2026-12-25", "2026-12-26"],
        [],
        [],
      ),
    ).toEqual({ zileLucratoare: 21, zileCalendaristice: 31 });
  });

  it("februarie 2028, an bisect: 29 februarie e acceptat și numărat", () => {
    // 1 februarie 2028 e marți: 4 + 5 + 5 + 5 + 2 zile lucrătoare.
    expect(numaraZileCerere("2028-02-01", "2028-02-29", [], [], [])).toEqual({
      zileLucratoare: 21,
      zileCalendaristice: 29,
    });
  });

  it("februarie 2027, an nebisect: 29 februarie e respins", () => {
    expect(() => numaraZileCerere("2027-02-01", "2027-02-29", [], [], [])).toThrow();
  });

  it("o sărbătoare care vine de două ori din public_holidays nu scade de două ori", () => {
    // 1 iunie 2026 e și Ziua Copilului, și a doua zi de Rusalii.
    expect(
      numaraZileCerere("2026-06-01", "2026-06-30", ["2026-06-01", "2026-06-01"], [], []),
    ).toEqual({ zileLucratoare: 21, zileCalendaristice: 30 });
  });

  it("o lună întreagă cu o zi liberă a firmei și o sâmbătă de recuperare", () => {
    // Martie 2026: 22 de zile luni–vineri, minus luni 9 (liber), plus sâmbătă 14.
    expect(
      numaraZileCerere("2026-03-01", "2026-03-31", [], ["2026-03-09"], ["2026-03-14"]),
    ).toEqual({ zileLucratoare: 22, zileCalendaristice: 31 });
  });
});
