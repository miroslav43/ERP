// src/domain/attendance/totaluri.test.ts
//
// HR-013: ziua RESPINSĂ ieșea din aprobare (`liniiDeAprobat` filtrează
// `respins_la is null`), legenda o arăta „tăiată”, dar orele ei intrau în
// „Ore”, „Supl.” și „Noapte” — în foaia colectivă, pe pagina de start a
// portalului și în „Pontajul meu”, fiecare cu adunarea lui. Regula stă acum
// într-un singur loc, iar cele cinci adunări trec prin ea.

import { describe, expect, it } from "vitest";

import { conteazaInTotaluri, totalurileZilelor, ziDeTotalizat } from "./totaluri";

const APROBATA = { oreLucrate: 8, oreSuplimentare: 0, oreNoapte: 0, respinsa: false } as const;
const NEDECISA = { oreLucrate: 9, oreSuplimentare: 1, oreNoapte: 2, respinsa: false } as const;
const RESPINSA = { oreLucrate: 8.5, oreSuplimentare: 0.5, oreNoapte: 1, respinsa: true } as const;

describe("conteazaInTotaluri", () => {
  it("ziua respinsă nu contează", () => {
    expect(conteazaInTotaluri(RESPINSA)).toBe(false);
  });

  it("ziua aprobată și cea nedecisă contează", () => {
    expect(conteazaInTotaluri(APROBATA)).toBe(true);
    expect(conteazaInTotaluri(NEDECISA)).toBe(true);
  });
});

describe("totalurileZilelor", () => {
  it("ziua respinsă cu 8:30 și 0:30 suplimentare nu intră în niciun total", () => {
    // Cazul din constatare: 8 + 9 + 8 + 8:30 dădea 33:30 și 1:30 suplimentare.
    expect(totalurileZilelor([APROBATA, NEDECISA, APROBATA, RESPINSA])).toEqual({
      lucrate: 25,
      suplimentare: 1,
      noapte: 2,
    });
  });

  it("ziua aprobată și ziua nedecisă intră amândouă", () => {
    expect(totalurileZilelor([APROBATA, NEDECISA])).toEqual({
      lucrate: 17,
      suplimentare: 1,
      noapte: 2,
    });
  });

  it("lista goală dă zerouri, nu `NaN`", () => {
    expect(totalurileZilelor([])).toEqual({ lucrate: 0, suplimentare: 0, noapte: 0 });
  });

  it("nu acumulează eroare de virgulă mobilă pe sferturi de oră", () => {
    const sfert = { oreLucrate: 0.1, oreSuplimentare: 0.1, oreNoapte: 0.1, respinsa: false };
    const r = totalurileZilelor([sfert, sfert, sfert]);
    expect(r.lucrate).toBe(0.3);
    expect(r.suplimentare).toBe(0.3);
    expect(r.noapte).toBe(0.3);
  });
});

describe("ziDeTotalizat — rândul din bază", () => {
  it("`respins_la` nenul înseamnă respinsă; orele nule devin zero", () => {
    expect(
      ziDeTotalizat({
        ore_lucrate: null,
        ore_suplimentare: null,
        ore_noapte: null,
        respins_la: "2026-07-15T10:00:00Z",
      }),
    ).toEqual({ oreLucrate: 0, oreSuplimentare: 0, oreNoapte: 0, respinsa: true });
  });

  it("rândul nedecis își păstrează orele", () => {
    expect(
      ziDeTotalizat({ ore_lucrate: 8.5, ore_suplimentare: 0.5, ore_noapte: 0, respins_la: null }),
    ).toEqual({ oreLucrate: 8.5, oreSuplimentare: 0.5, oreNoapte: 0, respinsa: false });
  });
});
