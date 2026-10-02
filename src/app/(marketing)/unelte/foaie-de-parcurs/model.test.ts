import { describe, expect, it } from "vitest";

import { construiesteFoaieParcurs, foaieParcursDinParametri, parametriFoaieParcurs } from "./model";

describe("foaia de parcurs", () => {
  it("are un rând pe fiecare zi a lunii, cu data completată, și coloanele de kilometri", () => {
    const d = construiesteFoaieParcurs({
      an: 2026,
      luna: 2,
      nrAuto: "B-123-ABC",
      marca: "Dacia Logan",
      sofer: "Radu Andrei",
      firma: "",
    });
    expect(d.randuri).toHaveLength(28);
    expect(d.randuri[0]?.[0]).toBe("01.02.2026");
    expect(d.coloane.map((c) => c.eticheta)).toEqual([
      "Data",
      "Ora\nplecării",
      "Traseul (de la – la)",
      "Scopul deplasării",
      "Km la\nplecare",
      "Km la\nsosire",
      "Km\nparcurși",
      "Semnătura",
    ]);
    expect(d.campuri).toContainEqual({ eticheta: "Nr. de înmatriculare", valoare: "B-123-ABC" });
    expect(d.orientare).toBe("peisaj");
  });

  it("taie câmpurile de text la 120 de caractere și mărginește anul și luna", () => {
    const p = parametriFoaieParcurs(
      new URLSearchParams({ sofer: "x".repeat(500), an: "9999", luna: "0" }),
    );
    expect(p.sofer).toHaveLength(120);
    expect(p.an).toBeLessThanOrEqual(2035);
    expect(p.luna).toBeGreaterThanOrEqual(1);
    const d = foaieParcursDinParametri(new URLSearchParams({ sofer: "x".repeat(500) }));
    expect(d.campuri.find((c) => c.eticheta === "Conducător auto")?.valoare).toHaveLength(120);
  });
});
