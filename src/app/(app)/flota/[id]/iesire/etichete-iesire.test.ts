// src/app/(app)/flota/[id]/iesire/etichete-iesire.test.ts
import { describe, expect, it } from "vitest";

import { DESTINATII_EPAVA, MOTIVE_RADIERE, TIPURI_IESIRE } from "@/schemas/flota-iesire";

import {
  DESCRIERE_TERMENE_PE_TIP,
  ETICHETE_DESTINATIE_EPAVA,
  ETICHETE_MOTIV_RADIERE,
  ETICHETE_NATURA_TERMEN,
  ETICHETE_TIP_IESIRE,
  NOTA_VANZARE,
  etichetaDatei,
  etichetaIesirii,
} from "./etichete-iesire";

const SEDILA = /[ŞşŢţ]/u;

describe("etichetaIesirii", () => {
  it.each([
    ["vanzare", null, null, "Vândut"],
    ["casare", null, null, "Casat"],
    ["dauna_totala", "instrainata", null, "Daună totală — epava înstrăinată"],
    ["dauna_totala", "casata", null, "Daună totală — epava casată"],
    ["radiere", null, "export", "Radiat — export"],
    ["radiere", null, "furt", "Radiat — furt"],
    ["radiere", null, "retragere_depozitare", "Retras din circulație"],
    ["restituire_leasing", null, null, "Predat locatorului"],
  ] as const)("%s + %s + %s → %s", (tip, destinatie, motiv, asteptat) => {
    expect(etichetaIesirii(tip, destinatie, motiv)).toBe(asteptat);
  });

  it("fiecare combinație are o etichetă distinctă de status", () => {
    const etichete = new Set<string>();
    for (const tip of TIPURI_IESIRE) {
      for (const d of tip === "dauna_totala" ? DESTINATII_EPAVA : [null]) {
        for (const m of tip === "radiere" ? MOTIVE_RADIERE : [null]) {
          etichete.add(etichetaIesirii(tip, d, m));
        }
      }
    }
    expect(etichete.size).toBe(8);
  });
});

describe("etichetaDatei", () => {
  it("spune ce zi e data ieșirii, pe fiecare fel", () => {
    expect(etichetaDatei("vanzare", null)).toBe("Data vânzării");
    expect(etichetaDatei("radiere", "furt")).toBe("Data declarării furtului");
    expect(etichetaDatei("restituire_leasing", null)).toMatch(/locator/u);
  });
});

describe("textele", () => {
  it("au ș/ț cu virgulă, nu cu sedilă", () => {
    const toate = [
      ...Object.values(DESCRIERE_TERMENE_PE_TIP),
      ...Object.values(ETICHETE_TIP_IESIRE),
      ...Object.values(ETICHETE_DESTINATIE_EPAVA),
      ...Object.values(ETICHETE_MOTIV_RADIERE),
      ...Object.values(ETICHETE_NATURA_TERMEN),
      NOTA_VANZARE,
      ...TIPURI_IESIRE.map((t) => etichetaDatei(t, null)),
      ...MOTIVE_RADIERE.map((m) => etichetaDatei("radiere", m)),
    ];
    for (const text of toate) expect(text).not.toMatch(SEDILA);
  });

  it("fiecare tip are o descriere a termenelor", () => {
    for (const tip of TIPURI_IESIRE)
      expect(DESCRIERE_TERMENE_PE_TIP[tip].length).toBeGreaterThan(20);
  });
});
