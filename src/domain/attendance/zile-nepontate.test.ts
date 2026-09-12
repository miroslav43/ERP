import { describe, expect, it } from "vitest";

import { zileNepontate } from "./zile-nepontate";
import type { RegimZile } from "./zi-de-pontat";

/** Program de birou: luni–vineri, fără sărbători legale. */
const BIROU: RegimZile = { lucreazaWeekend: false, lucreazaSarbatori: false };

/** Firma lucrează șapte zile din șapte, sărbători incluse. */
const NONSTOP: RegimZile = { lucreazaWeekend: true, lucreazaSarbatori: true };

describe("zileNepontate", () => {
  it("întoarce zilele lucrătoare scurse și nescrise, în ordine", () => {
    // Septembrie 2026: 1 e marți, deci 1–4 sunt zile de lucru, 5–6 weekend,
    // 7–11 zile de lucru. Azi e sâmbătă, 12.
    const lipsa = zileNepontate(2026, 9, "2026-09-12", [{ data: "2026-09-01" }], BIROU);
    expect(lipsa).toEqual([
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
    ]);
  });

  it("ziua curentă nu e restanță, oricât ar fi de nescrisă", () => {
    // 2026-09-10 e joi și nu e pontată. Cerută ca „azi", nu apare.
    const lipsa = zileNepontate(2026, 9, "2026-09-10", [], BIROU);
    expect(lipsa).not.toContain("2026-09-10");
    expect(lipsa.at(-1)).toBe("2026-09-09");
  });

  it("weekendul intră doar în regimul care îl lucrează", () => {
    // 5 și 6 septembrie 2026 sunt sâmbătă și duminică.
    expect(zileNepontate(2026, 9, "2026-09-07", [], BIROU)).not.toContain("2026-09-05");
    expect(zileNepontate(2026, 9, "2026-09-07", [], NONSTOP)).toContain("2026-09-05");
  });

  it("sărbătoarea legală nu se cere firmei care n-o lucrează", () => {
    // 1 Decembrie 2026 cade marți.
    expect(zileNepontate(2026, 12, "2026-12-05", [], BIROU)).not.toContain("2026-12-01");
    expect(zileNepontate(2026, 12, "2026-12-05", [], NONSTOP)).toContain("2026-12-01");
  });

  it("fără rândul de setări al firmei nu se cere nimic", () => {
    expect(zileNepontate(2026, 9, "2026-09-12", [], null)).toEqual([]);
  });

  it("o lună întreagă deja trecută se numără până la capăt", () => {
    // Azi e în octombrie, deci nicio zi din septembrie nu mai e „înainte".
    const lipsa = zileNepontate(2026, 9, "2026-10-01", [], BIROU);
    expect(lipsa).toHaveLength(22);
    expect(lipsa.at(-1)).toBe("2026-09-30");
  });

  it("o dată scrisă aiurea nu produce zile", () => {
    expect(zileNepontate(2026, 9, "azi", [], BIROU)).toEqual([]);
  });
});
