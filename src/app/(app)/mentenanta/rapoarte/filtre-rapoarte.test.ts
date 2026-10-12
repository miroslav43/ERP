// src/app/(app)/mentenanta/rapoarte/filtre-rapoarte.test.ts
import { describe, expect, it } from "vitest";

import { hrefPerioada, perioadeRapide } from "./filtre-rapoarte";

describe("perioadele rapide ale raportului", () => {
  it("12 luni, anul curent, luna curentă și luna trecută, toate până azi sau în trecut", () => {
    expect(perioadeRapide("2026-03-31")).toEqual([
      { eticheta: "Ultimele 12 luni", perioada: { deLa: "2025-04-01", panaLa: "2026-03-31" } },
      { eticheta: "Anul curent", perioada: { deLa: "2026-01-01", panaLa: "2026-03-31" } },
      { eticheta: "Luna curentă", perioada: { deLa: "2026-03-01", panaLa: "2026-03-31" } },
      // Februarie 2026 are 28 de zile; luna trecută a lui ianuarie e decembrie.
      { eticheta: "Luna trecută", perioada: { deLa: "2026-02-01", panaLa: "2026-02-28" } },
    ]);
    expect(perioadeRapide("2026-01-15")[3]?.perioada).toEqual({
      deLa: "2025-12-01",
      panaLa: "2025-12-31",
    });
  });

  it("adresa poartă ambele capete", () => {
    expect(hrefPerioada({ deLa: "2026-09-01", panaLa: "2026-09-30" })).toBe(
      "/mentenanta/rapoarte?de_la=2026-09-01&pana_la=2026-09-30",
    );
  });
});
