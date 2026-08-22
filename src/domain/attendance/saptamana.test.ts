import { describe, expect, it } from "vitest";

import { adaugaZile, esteLuni, lunieaUrmatoare, zileleSaptamanii } from "./saptamana";

describe("adaugaZile", () => {
  it("trece corect peste granița lunii și a anului", () => {
    expect(adaugaZile("2026-01-31", 1)).toBe("2026-02-01");
    expect(adaugaZile("2026-12-31", 1)).toBe("2027-01-01");
    expect(adaugaZile("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("tratează anul bisect", () => {
    expect(adaugaZile("2028-02-28", 1)).toBe("2028-02-29");
    expect(adaugaZile("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("o săptămână înainte și înapoi se anulează", () => {
    expect(adaugaZile(adaugaZile("2026-08-22", 7), -7)).toBe("2026-08-22");
  });
});

describe("esteLuni", () => {
  it("recunoaște lunea", () => {
    // 2026-08-17 e luni; 2026-08-22 e sâmbătă.
    expect(esteLuni("2026-08-17")).toBe(true);
    expect(esteLuni("2026-08-22")).toBe(false);
  });

  it("respinge orice nu are formatul unei zile", () => {
    // Parametrul vine din bara de adrese: `?saptamana=…`. O valoare stricată
    // trebuie să cadă pe implicit, nu să ajungă la Postgres și să dea 22P02.
    for (const valoare of ["", "azi", "2026-8-17", "2026-08-17T00:00:00Z", "'; drop table"]) {
      expect(esteLuni(valoare), valoare).toBe(false);
    }
  });
});

describe("lunieaUrmatoare", () => {
  it("dintr-o zi de lucru dă lunea săptămânii viitoare", () => {
    // 2026-08-17 luni → 2026-08-24; 2026-08-21 vineri → tot 2026-08-24.
    expect(lunieaUrmatoare("2026-08-17")).toBe("2026-08-24");
    expect(lunieaUrmatoare("2026-08-21")).toBe("2026-08-24");
  });

  it("sâmbăta și duminica dau tot lunea imediat următoare", () => {
    // Duminica e capătul săptămânii ISO, deci lunea următoare e a doua zi —
    // ramura pe care o inversare de semn ar trimite cu o săptămână mai încolo.
    expect(lunieaUrmatoare("2026-08-22")).toBe("2026-08-24");
    expect(lunieaUrmatoare("2026-08-23")).toBe("2026-08-24");
  });

  it("rezultatul e întotdeauna o zi de luni, în orice zi a anului", () => {
    let zi = "2026-01-01";
    for (let i = 0; i < 400; i += 1) {
      expect(esteLuni(lunieaUrmatoare(zi)), zi).toBe(true);
      zi = adaugaZile(zi, 1);
    }
  });

  it("rezultatul e mereu în viitor, niciodată ziua curentă", () => {
    let zi = "2026-01-01";
    for (let i = 0; i < 400; i += 1) {
      expect(lunieaUrmatoare(zi) > zi, zi).toBe(true);
      zi = adaugaZile(zi, 1);
    }
  });
});

describe("zileleSaptamanii", () => {
  it("dă șapte zile consecutive, începând cu lunea dată", () => {
    expect(zileleSaptamanii("2026-08-17")).toEqual([
      "2026-08-17",
      "2026-08-18",
      "2026-08-19",
      "2026-08-20",
      "2026-08-21",
      "2026-08-22",
      "2026-08-23",
    ]);
  });
});
