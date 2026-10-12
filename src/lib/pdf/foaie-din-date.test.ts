// src/lib/pdf/foaie-din-date.test.ts
import { describe, expect, it } from "vitest";

import { modelFoaieDinDate, type DateFoaiePdf, type VehiculPdf } from "./foaie-din-date";

const FOAIE: DateFoaiePdf = {
  numar: "FP-2026-0007",
  data: "2026-09-02",
  status: "aprobat",
  vehicul_nr: "B100ABC",
  vehicul_categorie: "autoturism",
  vehicul_combustibil: "motorina",
  norma_l_100km: 7.5,
  km_plecare: 1000,
  km_sosire: 1100,
  observatii: null,
  trimis_la: "2026-09-02T15:00:00Z",
  aprobat_la: "2026-09-03T08:30:00Z",
};

const VEHICUL: VehiculPdf = {
  nr_inmatriculare: "B999XYZ",
  categorie: "autoutilitara",
  tip_combustibil: "benzina",
  consum_mediu_declarat: 9,
};

const baza = {
  sofer: "Popescu Ion",
  aprobator: "Ionescu Maria",
  curse: [],
  alimentari: [],
};

const rubrica = (m: ReturnType<typeof modelFoaieDinDate>, nume: string) =>
  m.rubrici.find(([eticheta]) => eticheta.startsWith(nume))?.[1];

describe("modelFoaieDinDate", () => {
  it("foaia trimisă se citește din instantaneu, nu din vehiculul de azi", () => {
    const m = modelFoaieDinDate({ ...baza, foaie: FOAIE, vehicul: VEHICUL });
    expect(rubrica(m, "Vehicul")).toBe("B100ABC");
    expect(rubrica(m, "Categoria")).toBe("Autoturism");
    expect(rubrica(m, "Combustibil")).toBe("Motorină");
    expect(rubrica(m, "Norma")).toBe("7,50 l/100 km");
  });

  it("pe o ciornă, fără instantaneu, se ia vehiculul de azi", () => {
    const m = modelFoaieDinDate({
      ...baza,
      foaie: {
        ...FOAIE,
        status: "draft",
        vehicul_nr: null,
        vehicul_categorie: null,
        vehicul_combustibil: null,
        norma_l_100km: null,
      },
      vehicul: VEHICUL,
    });
    expect(rubrica(m, "Vehicul")).toBe("B999XYZ");
    expect(rubrica(m, "Categoria")).toBe("Autoutilitară");
    expect(rubrica(m, "Norma")).toBe("9,00 l/100 km");
  });

  it("vehiculul care nu se mai vede și nu are instantaneu: „—”, nu o excepție", () => {
    const m = modelFoaieDinDate({
      ...baza,
      foaie: { ...FOAIE, vehicul_nr: null, vehicul_categorie: null, vehicul_combustibil: null },
      vehicul: undefined,
    });
    expect(rubrica(m, "Vehicul")).toBe("—");
  });

  it("vehiculul electric se măsoară în kWh", () => {
    const m = modelFoaieDinDate({
      ...baza,
      foaie: { ...FOAIE, vehicul_combustibil: "electric" },
      vehicul: VEHICUL,
    });
    expect(rubrica(m, "Norma")).toBe("7,50 kWh/100 km");
  });

  it("aprobarea poartă numele aprobatorului", () => {
    const m = modelFoaieDinDate({ ...baza, foaie: FOAIE, vehicul: VEHICUL });
    expect(m.aprobare).toContain("Ionescu Maria");
    expect(rubrica(m, "Conducător")).toBe("Popescu Ion");
  });
});
