// src/domain/reges/operatii.lacune.test.ts
//
// Lacuna confirmată de audit: `propuneTipNorma` și `propuneNormaTimpMunca` se
// folosesc împreună (src/lib/reges/compune.ts) și se contrazic.

import { describe, expect, it } from "vitest";

import { propuneNormaTimpMunca, propuneTipNorma } from "./operatii";

describe("propuneTipNorma și propuneNormaTimpMunca — propuneri coerente", () => {
  it("8/40 e normă întreagă în ambele propuneri", () => {
    expect(propuneTipNorma(40)).toBe("NormaIntreaga");
    expect(propuneNormaTimpMunca(8, 40)).toBe("NormaIntreaga840");
  });

  it("4/20 e timp parțial în ambele propuneri", () => {
    expect(propuneTipNorma(20)).toBe("TimpPartial");
    expect(propuneNormaTimpMunca(4, 20)).toBe("TimpPartial");
  });

  // Cele două propuneri NU sunt consecvente pentru 6/30, iar asta e o decizie de
  // produs ⚠, nu un defect: 30 h/săptămână e implicit TIMP PARȚIAL; norma
  // întreagă redusă există doar pentru minori sau condiții speciale. Ambele sunt
  // PROPUNERI afișate (reges/[id]/page.tsx) și suprascrise de coloanele reges_*.
  // A le alinia pe „NormaIntreaga” ar declara la ITM part-timerii drept normă
  // întreagă. Testul fixează starea de azi.
  it("6/30: norma propusă e cea redusă, tipul propus e timp parțial (decizie ⚠ deschisă)", () => {
    expect(propuneNormaTimpMunca(6, 30)).toBe("NormaIntreaga630");
    expect(propuneTipNorma(30)).toBe("TimpPartial");
  });

  // Valoare de confirmat: NOTES.md §3 REVISAL. Comentariul descrie norma redusă
  // ca 6/30; un part-time obișnuit de 7 h pe zi și 35 pe săptămână cade azi tot
  // în `NormaIntreaga630`. Când se aplică norma redusă decide juristul; testul
  // fixează comportamentul ACTUAL.
  it("7/35 e propus azi ca normă redusă 6/30, iar tipul de normă ca timp parțial", () => {
    expect(propuneNormaTimpMunca(7, 35)).toBe("NormaIntreaga630");
    expect(propuneTipNorma(35)).toBe("TimpPartial");
  });
});
