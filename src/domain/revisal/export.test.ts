// src/domain/revisal/export.test.ts
import { describe, expect, it } from "vitest";

import {
  construiesteExport,
  laCsv,
  mascheazaCnp,
  numeFisierExport,
  type IntrareExport,
} from "./export";

const ANGAJATOR = { cui: "RO12345678", denumire: "Firma Test SRL", registruComert: "J40/1/2020" };

function intrare(suprascrieri: Partial<IntrareExport> = {}): IntrareExport {
  return {
    evenimentId: "ev-1",
    tip: "angajare",
    codEveniment: "A",
    dataEvenimentului: "2026-06-02",
    termenTransmitere: "2026-05-29",
    salariat: {
      employeeId: "emp-1",
      marca: "001",
      nume: "Popescu",
      prenume: "Ion",
      cnpUltimele4: "1234",
      cetatenie: "RO",
    },
    contract: {
      contractId: "c-1",
      numar: "15/2026",
      dataContract: "2026-05-25",
      valabilDeLa: "2026-06-02",
      valabilPana: null,
      durata: "nedeterminat",
      normaOreSaptamana: 40,
      normaOreZi: 8,
      codCor: "251401",
      denumireFunctie: "Programator",
      conditiiMunca: "normale",
      salariuBaza: 8500,
      moneda: "RON",
      codRevisal: null,
      temeiIncetare: null,
      dataIncetare: null,
    },
    ...suprascrieri,
  };
}

describe("construiesteExport", () => {
  it("acceptă o angajare completă", () => {
    const rezultat = construiesteExport({
      angajator: ANGAJATOR,
      intrari: [intrare()],
      azi: "2026-05-27",
    });
    expect(rezultat.probleme).toHaveLength(0);
    expect(rezultat.gataDeTransmis).toEqual(["ev-1"]);
  });

  it("blochează lipsa CNP-ului și a codului COR", () => {
    const fara = intrare({
      salariat: { ...intrare().salariat, cnpUltimele4: null },
      contract: { ...intrare().contract!, codCor: null },
    });
    const rezultat = construiesteExport({
      angajator: ANGAJATOR,
      intrari: [fara],
      azi: "2026-05-27",
    });
    expect(rezultat.probleme.filter((p) => p.blocant)).toHaveLength(2);
    expect(rezultat.gataDeTransmis).toEqual([]);
  });

  it("semnalează termenul depășit fără să blocheze exportul", () => {
    const rezultat = construiesteExport({
      angajator: ANGAJATOR,
      intrari: [intrare()],
      azi: "2026-06-10",
    });
    expect(rezultat.probleme).toHaveLength(1);
    expect(rezultat.probleme[0]?.blocant).toBe(false);
    expect(rezultat.gataDeTransmis).toEqual(["ev-1"]);
  });

  it("cere temeiul legal la încetare", () => {
    const rezultat = construiesteExport({
      angajator: ANGAJATOR,
      intrari: [intrare({ tip: "incetare", codEveniment: "I" })],
      azi: "2026-05-27",
    });
    expect(rezultat.probleme.some((p) => p.camp === "temei_incetare" && p.blocant)).toBe(true);
  });
});

describe("CSV interimar", () => {
  it("maschează CNP-ul", () => {
    expect(mascheazaCnp("1234")).toBe("*********1234");
    expect(mascheazaCnp(null)).toBe("");
  });

  it("protejează separatorul și ghilimelele din denumiri", () => {
    const cu = intrare({
      contract: { ...intrare().contract!, denumireFunctie: 'Inginer; „senior"' },
    });
    const csv = laCsv(
      construiesteExport({ angajator: ANGAJATOR, intrari: [cu], azi: "2026-05-27" }),
    );
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Inginer; „senior"""');
    expect(csv.split("\r\n").filter((r) => r.length > 0)).toHaveLength(2);
  });

  it("compune un nume de fișier stabil", () => {
    expect(numeFisierExport("RO12345678", "2026-05-27")).toBe("revisal-RO12345678-2026-05-27.csv");
  });
});
