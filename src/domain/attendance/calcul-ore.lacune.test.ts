// src/domain/attendance/calcul-ore.lacune.test.ts
//
// Lacunele confirmate de audit în derivarea orelor unei zile: rotunjirea dublă
// a pauzei, baza zilnică a orelor suplimentare și pragul de noapte pe zi.

import { describe, expect, it } from "vitest";

import { oreleZilei, sporDeNoapteSeAplica, type ConfigZi } from "./calcul-ore";

const CONFIG: ConfigZi = {
  orePeZi: 8,
  noapteStart: "22:00",
  noapteSfarsit: "06:00",
  pauzaMinute: 30,
  pauzaInclusaInProgram: false,
  pauzaObligatoriePesteOre: 6,
};

describe("oreleZilei — pauza scade minute, nu sutimi deja rotunjite", () => {
  it("o pauză care dă sutimi exacte nu pierde nimic", () => {
    // 08:00–16:30 = 510 min, pauză 30 min → 480 min = 8 h exact.
    expect(oreleZilei("08:00", "16:30", CONFIG)).toMatchObject({
      brut: 8.5,
      pauza: 0.5,
      lucrate: 8,
      suplimentare: 0,
    });
  });

  // În `oreleZilei`, lucrate = round2(brut) − round2(pauză). Pentru
  // 08:00–16:08 cu 7 minute de pauză, timpul lucrat e 481 min = 8,0167 h, adică
  // 8,02 h și 0,02 h suplimentare. Codul scădea 0,12 din 8,13 și dădea 8,01 /
  // 0,01; acum scade în minute și rotunjește o singură dată.
  it.each([
    { inceput: "08:00", sfarsit: "16:08", pauzaMinute: 7 },
    { inceput: "08:00", sfarsit: "16:41", pauzaMinute: 40 },
  ])(
    "$inceput–$sfarsit cu $pauzaMinute min de pauză dă 481 min lucrate, adică 8,02 h",
    ({ inceput, sfarsit, pauzaMinute }) => {
      const zi = oreleZilei(inceput, sfarsit, { ...CONFIG, pauzaMinute });
      expect(zi?.lucrate).toBe(8.02);
      expect(zi?.suplimentare).toBe(0.02);
    },
  );
});

describe("oreleZilei — orele suplimentare se socotesc pe zi", () => {
  // Valoare de confirmat: NOTES.md §3 Timp de muncă (procentul și regulile
  // orelor suplimentare). Codul muncii art. 120 alin. (1) raportează munca
  // suplimentară la durata normală SĂPTĂMÂNALĂ (art. 112); codul o socotește PE
  // ZI. O săptămână de 34 h cu o zi lungă produce azi 2 h suplimentare plătite
  // cu spor, deși săptămâna e sub 40 h. Testul fixează comportamentul ACTUAL.
  it("o zi de 10 h într-o săptămână de 34 h produce azi 2 h suplimentare", () => {
    const luni = oreleZilei("08:00", "18:30", CONFIG);
    const restul = ["marti", "miercuri", "joi", "vineri"].map(() =>
      oreleZilei("08:00", "14:00", CONFIG),
    );
    expect(luni).toMatchObject({ brut: 10.5, pauza: 0.5, lucrate: 10, suplimentare: 2 });
    // 6 h nu trec de pragul pauzei (> 6), deci pauza nu se scade.
    for (const zi of restul) {
      expect(zi).toMatchObject({ brut: 6, pauza: 0, lucrate: 6, suplimentare: 0 });
    }
    const zile = [luni, ...restul];
    const totalLucrate = zile.reduce((s, z) => s + (z?.lucrate ?? 0), 0);
    const totalSuplimentare = zile.reduce((s, z) => s + (z?.suplimentare ?? 0), 0);
    expect(totalLucrate).toBe(34);
    expect(totalSuplimentare).toBe(2);
  });
});

describe("sporDeNoapteSeAplica — pragul pe zi față de pragul pe lună", () => {
  // Valoare de confirmat: NOTES.md §3 Timp de muncă (prag de ore de noapte).
  // Art. 125–126 leagă sporul de cel puțin 3 ore de noapte PE ZI. Motorul de
  // salarizare (`calculatePayrollEntry`, `sporNoapteSeAplica`) cheamă funcția pe totalul LUNII, ca aproximare
  // declarată. O tură 14:00–23:00 are o oră de noapte și nu trece pragul în
  // nicio zi, dar 20 de asemenea ture trec împreună.
  it("pe zi, o tură cu o singură oră de noapte rămâne sub pragul de 3", () => {
    const zi = oreleZilei("14:00", "23:00", CONFIG);
    expect(zi?.noapte).toBe(1);
    expect(sporDeNoapteSeAplica(zi?.noapte ?? 0, 3)).toBe(false);
  });

  it("pe totalul a 20 de asemenea zile, pragul e trecut — aproximarea de azi din salarizare", () => {
    expect(sporDeNoapteSeAplica(20 * 1, 3)).toBe(true);
  });

  it("pe zile, un amestec [4, 1, 3] h are doar două zile eligibile, 7 h", () => {
    const eligibile = [4, 1, 3].filter((ore) => sporDeNoapteSeAplica(ore, 3));
    expect(eligibile.reduce((s, ore) => s + ore, 0)).toBe(7);
  });
});
