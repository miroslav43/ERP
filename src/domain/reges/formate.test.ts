// src/domain/reges/formate.test.ts
import { describe, expect, it } from "vitest";

import { esteZi, momentIso, text, uuid, zecimal, zi, ziCaMoment } from "./formate";

describe("zile", () => {
  it("acceptă o zi reală", () => {
    expect(esteZi("2026-03-14")).toBe(true);
    expect(zi("2026-03-14")).toBe("2026-03-14");
  });

  it("respinge zilele care nu există", () => {
    expect(esteZi("2026-02-31")).toBe(false);
    expect(esteZi("2026-13-01")).toBe(false);
    expect(esteZi("2026-00-10")).toBe(false);
  });

  it("acceptă 29 februarie doar în an bisect", () => {
    expect(esteZi("2028-02-29")).toBe(true);
    expect(esteZi("2026-02-29")).toBe(false);
  });

  it("respinge formele aproape corecte", () => {
    expect(esteZi("2026-3-14")).toBe(false);
    expect(esteZi("14-03-2026")).toBe(false);
    expect(esteZi("2026-03-14T00:00:00Z")).toBe(false);
    expect(esteZi(20260314)).toBe(false);
  });

  it("NU mută ziua înapoi — capcana pentru care există modulul", () => {
    // `new Date("2026-03-14").toISOString()` în ora României dă 2026-03-13.
    // Diferența dintre „în termen" și „contravenție" e exact aici.
    expect(zi("2026-03-14")).toBe("2026-03-14");
    expect(ziCaMoment("2026-03-14").startsWith("2026-03-14")).toBe(true);
  });

  it("pune ziua la miezul zilei, nu al nopții", () => {
    expect(ziCaMoment("2026-01-01")).toBe("2026-01-01T12:00:00.000Z");
  });

  it("aruncă pentru o zi invalidă în loc s-o transmită", () => {
    expect(() => zi("2026-02-31")).toThrow(/Zi invalidă/);
  });
});

describe("zecimale", () => {
  it("păstrează punctul și taie zgomotul de virgulă mobilă", () => {
    expect(zecimal(4000)).toBe(4000);
    expect(zecimal(1234.56)).toBe(1234.56);
    expect(zecimal(4000.0000000000005)).toBe(4000);
  });

  it("rotunjește la doi zecimali", () => {
    expect(zecimal(1234.567)).toBe(1234.57);
  });

  it("refuză valorile care nu sunt numere", () => {
    expect(() => zecimal(Number.NaN)).toThrow();
    expect(() => zecimal(Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe("uuid", () => {
  it("normalizează la litere mici", () => {
    expect(uuid("4F8CB938-EA29-498D-A897-377A9794B204")).toBe(
      "4f8cb938-ea29-498d-a897-377a9794b204",
    );
  });

  it("respinge ce nu e canonic 8-4-4-4-12", () => {
    expect(() => uuid("4f8cb938ea29498da897377a9794b204")).toThrow();
    expect(() => uuid("nu-e-uuid")).toThrow();
  });
});

describe("text", () => {
  it("taie spațiile de la capete", () => {
    expect(text("  Strada Morii  ")).toBe("Strada Morii");
  });

  it("întoarce undefined pentru gol, ca cheia să lipsească din JSON", () => {
    // REGES tratează șirul gol ca VALOARE, nu ca absență: un `mentiuni: ""`
    // transmis explicit nu e același lucru cu a nu transmite deloc câmpul.
    expect(text("")).toBeUndefined();
    expect(text("   ")).toBeUndefined();
    expect(text(null)).toBeUndefined();
    expect(text(undefined)).toBeUndefined();
  });
});

describe("momentIso", () => {
  it("dă un ISO-8601 cu fus explicit", () => {
    expect(momentIso(new Date("2026-06-18T14:19:58.917Z"))).toBe("2026-06-18T14:19:58.917Z");
  });

  it("refuză o dată invalidă", () => {
    expect(() => momentIso(new Date("nu e o dată"))).toThrow();
  });
});
