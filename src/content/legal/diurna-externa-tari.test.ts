import { describe, expect, it } from "vitest";

import { DIURNA_EXTERNA_TARI, plafonNeimpozabil } from "./diurna-externa-tari";

describe("diurna externă pe țări", () => {
  it("plafonul neimpozabil e 2,5 × cuantumul, la cenți", () => {
    expect(plafonNeimpozabil(35)).toBe(87.5);
    expect(plafonNeimpozabil(33.33)).toBe(83.33);
  });

  it("are toate cele 166 de rânduri ale anexei, fiecare țară o singură dată", () => {
    expect(DIURNA_EXTERNA_TARI).toHaveLength(166);
    const nume = DIURNA_EXTERNA_TARI.map((t) => t.tara);
    expect(new Set(nume).size).toBe(nume.length);
    for (const t of DIURNA_EXTERNA_TARI) {
      expect(t.cuantum).toBeGreaterThan(0);
      expect(t.moneda).toMatch(/^(EUR|USD)$/u);
    }
  });

  it("are țările căutate, cu cifrele din anexă verificate de mână", () => {
    const dupa = (tara: string) => DIURNA_EXTERNA_TARI.find((t) => t.tara === tara);
    expect(dupa("Germania")).toEqual({ tara: "Germania", moneda: "EUR", cuantum: 35 });
    expect(dupa("Bulgaria")).toEqual({ tara: "Bulgaria", moneda: "EUR", cuantum: 32 });
    expect(dupa("Ungaria")).toEqual({ tara: "Ungaria", moneda: "EUR", cuantum: 35 });
    expect(dupa("Turcia")).toEqual({ tara: "Turcia", moneda: "USD", cuantum: 38 });
    expect(dupa("S.U.A.")).toEqual({ tara: "S.U.A.", moneda: "USD", cuantum: 53 });
  });

  it("e ordonată alfabetic, ca tabelul să se poată parcurge", () => {
    const nume = DIURNA_EXTERNA_TARI.map((t) => t.tara);
    expect(nume).toEqual([...nume].sort((a, b) => a.localeCompare(b, "ro")));
  });
});
