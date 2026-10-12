// src/app/(app)/mentenanta/rapoarte/csv-raport.test.ts
import { describe, expect, it } from "vitest";

import { calculeazaRaport, type EchipamentRaport } from "@/domain/maintenance/indicatori";

import { ANTET_CSV_RAPORT, celulaCsv, continutCsvRaport, liniiCsvRaport } from "./csv-raport";

const ECHIPAMENTE: readonly EchipamentRaport[] = [
  {
    id: "e1",
    cod: "=CMD",
    denumire: 'Compresor "mare"',
    valoare_achizitie: 1_000,
    casat_la: null,
    data_punerii_in_functiune: null,
  },
];

const raport = calculeazaRaport({
  perioada: { deLa: "2026-09-01", panaLa: "2026-09-30" },
  azi: "2026-10-12",
  acum: "2026-10-12T09:00:00Z",
  program: { orePeZi: 8, zilePeSaptamana: 5, costOraOprire: null },
  echipamente: ECHIPAMENTE,
  interventii: [
    {
      id: "i1",
      equipment_id: "e1",
      data: "2026-09-10",
      tip: "corectiva",
      rezultat: "reusita",
      cost_total: 512.5,
      acoperit_de_garantie: false,
      executant_extern: null,
      plan_id: null,
    },
    {
      id: "i2",
      equipment_id: "e9",
      data: "2026-09-11",
      tip: "preventiva",
      rezultat: "reusita",
      cost_total: 10,
      acoperit_de_garantie: false,
      executant_extern: "Service",
      plan_id: null,
    },
  ],
  executiiPlanuri: [],
  planuri: [],
  sesizari: [],
  opriri: [],
});

describe("CSV-ul raportului", () => {
  it("o linie pe echipament, cu zecimală virgulă și celule goale fără numitor", () => {
    const linii = liniiCsvRaport(raport, new Map(ECHIPAMENTE.map((e) => [e.id, e])));
    expect(linii).toHaveLength(2);
    const [e1, e9] = linii;
    expect(e1).toHaveLength(ANTET_CSV_RAPORT.length);
    expect(e1?.[0]).toBe("=CMD");
    expect(e1?.[4]).toBe("512,5");
    // Cost/valoare: 512,5 / 1000 = 51,3 %, peste prag.
    expect(e1?.[12]).toBe("51,3");
    expect(e1?.[13]).toBe("da");
    // Fără cost al orei de oprire: celula e goală, nu „—”.
    expect(e1?.[20]).toBe("");
    // MTBF fără nicio cădere: gol.
    expect(e1?.[19]).toBe("");
    // Echipament șters sau invizibil: rândul rămâne, cu numele generic.
    expect(e9?.[1]).toBe("Echipament indisponibil");
    expect(e9?.[11]).toBe("");
  });

  it("celulele care încep ca o formulă primesc apostrof; ghilimelele se dublează", () => {
    expect(celulaCsv("=CMD")).toBe(`"'=CMD"`);
    expect(celulaCsv('Compresor "mare"')).toBe(`"Compresor ""mare"""`);
    const continut = continutCsvRaport(raport, new Map(ECHIPAMENTE.map((e) => [e.id, e])));
    expect(continut.startsWith("﻿")).toBe(true);
    expect(continut.split("\r\n")).toHaveLength(3);
    expect(continut).toContain(`"'=CMD";"Compresor ""mare"""`);
  });
});
