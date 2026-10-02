// src/domain/per-diem/ferestre.lacune.test.ts
//
// Lacuna confirmată de audit: data ferestrei, folosită la departajarea
// `tara_cu_valoare_mai_mare`, se ia în UTC, nu în ziua României.

import { describe, expect, it } from "vitest";

import { calculeazaZileDiurna, type ParametriiFerestre } from "./ferestre";

const RO = "11111111-1111-1111-1111-111111111111";
const DE = "22222222-2222-2222-2222-222222222222";

const PLECARE = new Date("2026-10-01T05:00:00Z"); // 08:00 ora României
const SOSIRE = new Date("2026-10-02T15:00:00Z"); // 18:00 ora României
const INTRARE_IN_DE = new Date("2026-10-02T09:00:00Z");

/** Parametrii unei deplasări de două zile calendaristice, cu frontiera trecută în a doua. */
function parametri(cautaValoareBarem: ParametriiFerestre["cautaValoareBarem"]): ParametriiFerestre {
  return {
    modCalculZile: "zile_calendaristice",
    plecare: PLECARE,
    sosire: SOSIRE,
    pragOreMinim: 12,
    pragOreZiIntreaga: 24,
    fractiuneZiPartiala: 0.5,
    acordaZiuaTrecerii: true,
    regulaTrecere: "tara_cu_valoare_mai_mare",
    taraImplicitaId: RO,
    etape: [
      { deLa: PLECARE, countryId: RO },
      { deLa: INTRARE_IN_DE, countryId: DE },
    ],
    cautaValoareBarem,
  };
}

describe("calculeazaZileDiurna — zile calendaristice, trecere de frontieră", () => {
  it("fiecare zi a României e o fereastră, iar ziua trecerii merge țării cu baremul mai mare", () => {
    const ferestre = calculeazaZileDiurna(
      parametri((tara) => (tara === DE ? 35 : tara === RO ? 23 : null)),
    );
    expect(ferestre).toHaveLength(2);
    expect(ferestre.map((f) => f.taraId)).toEqual([RO, DE]);
    // A doua fereastră începe la miezul nopții de la București.
    expect(ferestre[1]?.deLa.toISOString()).toBe("2026-10-01T21:00:00.000Z");
  });

  // `construiesteFereastra` trimite `laZiIso(deLa)`, adică data UTC. Pentru fereastra
  // zilei de 2 octombrie, care începe la 2026-10-01T21:00Z, baremul se caută la
  // 1 octombrie — o zi mai devreme. La o schimbare de barem pe 1 ale lunii,
  // departajarea folosește baremul vechi.
  it.fails("DEFECT: baremul pentru departajare se caută la data României a ferestrei", () => {
    const dateCerute: string[] = [];
    calculeazaZileDiurna(
      parametri((_tara, data) => {
        dateCerute.push(data);
        return 10;
      }),
    );
    expect(dateCerute.length).toBeGreaterThan(0);
    expect(new Set(dateCerute)).toEqual(new Set(["2026-10-02"]));
  });
});
