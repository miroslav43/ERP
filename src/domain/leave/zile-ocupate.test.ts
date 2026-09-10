// src/domain/leave/zile-ocupate.test.ts
import { describe, expect, it } from "vitest";

import { zileOcupate, type IntervalOcupat } from "./zile-ocupate";

const ANA = "ana";
const BOGDAN = "bogdan";

function interval(
  employeeId: string,
  dataInceput: string,
  dataSfarsit: string,
  eticheta = "Concediu de odihnă, aprobată",
): IntervalOcupat {
  return { employeeId, dataInceput, dataSfarsit, eticheta };
}

describe("zileOcupate", () => {
  it("desface un interval în zile, cu ambele capete incluse", () => {
    const harta = zileOcupate([interval(ANA, "2026-09-01", "2026-09-03")], ANA);
    expect(Object.keys(harta).sort()).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
  });

  it("prinde și o cerere de o singură zi", () => {
    const harta = zileOcupate([interval(ANA, "2026-09-17", "2026-09-17")], ANA);
    expect(Object.keys(harta)).toEqual(["2026-09-17"]);
  });

  it("trece peste granița de lună și de an", () => {
    const harta = zileOcupate([interval(ANA, "2026-12-30", "2027-01-02")], ANA);
    expect(Object.keys(harta).sort()).toEqual([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
  });

  it("nu amestecă angajații", () => {
    const harta = zileOcupate(
      [interval(ANA, "2026-09-01", "2026-09-02"), interval(BOGDAN, "2026-10-01", "2026-10-02")],
      ANA,
    );
    expect(Object.keys(harta).sort()).toEqual(["2026-09-01", "2026-09-02"]);
  });

  it("fără angajat ales nu marchează nimic", () => {
    // Marcajul spune „TU ai concediu atunci". Fără să știm despre cine e vorba,
    // orice zi desenată ar fi o afirmație despre altcineva.
    expect(zileOcupate([interval(ANA, "2026-09-01", "2026-09-02")], null)).toEqual({});
  });

  it("păstrează eticheta primei cereri care prinde ziua", () => {
    const harta = zileOcupate(
      [
        interval(ANA, "2026-09-01", "2026-09-05", "Concediu de odihnă, aprobată"),
        interval(ANA, "2026-09-05", "2026-09-06", "Concediu medical, trimisă"),
      ],
      ANA,
    );
    expect(harta["2026-09-05"]).toBe("Concediu de odihnă, aprobată");
    expect(harta["2026-09-06"]).toBe("Concediu medical, trimisă");
  });

  it("ignoră un interval întors pe dos, în loc să se învârtă la nesfârșit", () => {
    expect(zileOcupate([interval(ANA, "2026-09-10", "2026-09-01")], ANA)).toEqual({});
  });

  it("acoperă o variantă lungă, de tipul creșterii copilului", () => {
    // 1095 de zile e varianta reală din `leave_type_variants`; plafonul intern
    // e 1200, deci trebuie să încapă întreagă.
    const harta = zileOcupate([interval(ANA, "2026-01-01", "2028-12-30")], ANA);
    expect(Object.keys(harta).length).toBe(1095);
    expect(harta["2028-12-30"]).toBeDefined();
  });

  it("nu cade pe o listă goală", () => {
    expect(zileOcupate([], ANA)).toEqual({});
  });
});
