// src/domain/attendance/limite-legale.lacune.test.ts
//
// Lacuna confirmată de audit: pragurile repausului zilnic și ale mediei pe
// perioada de referință, verificate exact la limită. Valorile (12 h, art. 135;
// 48 h ca medie, art. 114) vin din setările firmei și sunt ⚠ în NOTES.md §3
// Timp de muncă; aici se verifică doar că granița e inclusă corect.

import { describe, expect, it } from "vitest";

import { avertismenteZi, type LimiteFirmei, type ZiLucrata } from "./limite-legale";

const LIMITE: LimiteFirmei = {
  orePeSaptamana: 40,
  oreMaximeSaptamanale: 48,
  perioadaReferintaLuni: 4,
  repausZilnicMinimOre: 12,
  repausSaptamanalMinimOre: 48,
  termenCompensareSarbatoareZile: 30,
  admiteOreSuplimentare: true,
  lucreazaNoaptea: true,
  lucreazaWeekend: true,
  lucreazaSarbatori: true,
};

function zi(data: string, peste: Partial<ZiLucrata> = {}): ZiLucrata {
  return {
    data,
    oraInceput: "08:00",
    oraSfarsit: "16:00",
    oreLucrate: 8,
    oreSuplimentare: 0,
    oreNoapte: 0,
    esteSarbatoare: false,
    ...peste,
  };
}

/** Marți 08:00–20:00, 12 h. */
const IERI = zi("2026-08-25", { oraSfarsit: "20:00", oreLucrate: 12 });

function repausZilnic(azi: ZiLucrata) {
  return avertismenteZi({
    zi: azi,
    ziuaDinainte: IERI,
    saptamana: [IERI, azi],
    referinta: null,
    limite: LIMITE,
  }).find((a) => a.cod === "repaus_zilnic");
}

function medie(ore: number, saptamani: number) {
  const azi = zi("2026-08-26");
  return avertismenteZi({
    zi: azi,
    ziuaDinainte: null,
    saptamana: [azi],
    referinta: { ore, saptamani },
    limite: LIMITE,
  }).find((a) => a.cod === "medie_perioada_referinta");
}

describe("avertismenteZi — repausul zilnic la limită", () => {
  it("exact 12 h de repaus (20:00 → 08:00) nu ridică avertisment", () => {
    expect(repausZilnic(zi("2026-08-26", { oraInceput: "08:00" }))).toBeUndefined();
  });

  it("un minut mai puțin (20:00 → 07:59) ridică avertismentul, cu 11:59 h", () => {
    const avertisment = repausZilnic(zi("2026-08-26", { oraInceput: "07:59" }));
    expect(avertisment).toBeDefined();
    expect(avertisment?.mesaj).toContain("11:59 h");
    expect(avertisment?.mesaj).not.toContain("estimat");
  });
});

describe("avertismenteZi — media pe perioada de referință la limită", () => {
  it("exact 48 h pe săptămână în medie (960 h / 20) nu ridică avertisment", () => {
    expect(medie(960, 20)).toBeUndefined();
  });

  it("peste 48 h în medie (961 h / 20 = 48,05) ridică avertismentul", () => {
    const avertisment = medie(961, 20);
    expect(avertisment).toBeDefined();
    expect(avertisment?.mesaj).toContain("4 luni");
  });
});
