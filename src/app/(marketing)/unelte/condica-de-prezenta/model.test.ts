import { describe, expect, it } from "vitest";

import { condicaDinParametri, construiesteCondica, parametriCondica } from "./model";

describe("condica de prezență", () => {
  it("are câte un rând pe om pe fiecare zi LUCRĂTOARE, fără weekenduri și sărbători", () => {
    // Decembrie 2026: 23 de zile de luni–vineri, minus 1 și 25 decembrie = 21.
    const d = construiesteCondica(2026, 12, ["Popa Ion", "Ilie Maria"], "");
    expect(d.randuri).toHaveLength(21 * 2);
    expect(d.randuri[0]?.[0]).toBe("02.12.2026"); // 1 decembrie sare
    expect(d.randuri.some((r) => r[0] === "25.12.2026")).toBe(false);
    expect(d.coloane.map((c) => c.eticheta)).toEqual([
      "Data",
      "Nume și prenume",
      "Ora sosirii",
      "Semnătura",
      "Ora plecării",
      "Semnătura",
    ]);
  });

  it("fără nume dă câte 10 rânduri goale pe zi", () => {
    const d = condicaDinParametri(new URLSearchParams({ an: "2026", luna: "12" }));
    expect(d.randuri).toHaveLength(21 * 10);
  });

  it("condica e mărginită la intrare enormă", () => {
    const q = new URLSearchParams({
      an: "9999",
      luna: "13",
      angajati: Array.from({ length: 10_000 }, (_, i) => `Om ${String(i)}`).join("\n"),
      firma: "F".repeat(5000),
    });
    const p = parametriCondica(q);
    expect(p.angajati.length).toBeLessThanOrEqual(60);
    expect(p.an).toBeGreaterThanOrEqual(2020);
    expect(p.an).toBeLessThanOrEqual(2035);
    expect(p.luna).toBeGreaterThanOrEqual(1);
    expect(p.luna).toBeLessThanOrEqual(12);
    expect(p.firma.length).toBeLessThanOrEqual(120);
    const d = condicaDinParametri(q);
    expect(new Set(d.randuri.map((r) => r[1])).size).toBeLessThanOrEqual(60);
  });
});
