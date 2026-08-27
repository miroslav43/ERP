// src/domain/attendance/calcul-ore.test.ts

import { describe, expect, it } from "vitest";
import {
  oreLucrateDinInterval,
  oreNoapteDinInterval,
  oreSuplimentareDinLucrate,
  oreleZilei,
  sporDeNoapteSeAplica,
  type ConfigZi,
} from "./calcul-ore";

describe("oreLucrateDinInterval", () => {
  it("calculează orele dintr-un interval simplu", () => {
    expect(oreLucrateDinInterval("08:00", "16:00")).toBe(8);
  });

  it("rotunjește la sutimi pentru minute care nu se împart exact", () => {
    expect(oreLucrateDinInterval("08:00", "16:45")).toBe(8.75);
  });

  it("întoarce null dacă sfârșitul nu e strict după început", () => {
    expect(oreLucrateDinInterval("16:00", "16:00")).toBeNull();
    expect(oreLucrateDinInterval("16:00", "08:00")).toBeNull();
  });

  it("întoarce null pentru ore invalide", () => {
    expect(oreLucrateDinInterval("25:00", "16:00")).toBeNull();
    expect(oreLucrateDinInterval("08:00", "")).toBeNull();
  });
});

describe("oreSuplimentareDinLucrate", () => {
  it("întoarce zero când orele lucrate nu depășesc pragul", () => {
    expect(oreSuplimentareDinLucrate(8, 8)).toBe(0);
    expect(oreSuplimentareDinLucrate(6, 8)).toBe(0);
  });

  it("calculează diferența peste prag", () => {
    expect(oreSuplimentareDinLucrate(10, 8)).toBe(2);
  });

  it("respectă pragul organizației, nu unul hardcodat", () => {
    expect(oreSuplimentareDinLucrate(7, 6)).toBe(1);
  });
});

describe("oreNoapteDinInterval", () => {
  const NOAPTE_START = "22:00";
  const NOAPTE_SFARSIT = "06:00";

  it("nu găsește ore de noapte într-o tură de zi", () => {
    expect(oreNoapteDinInterval("09:00", "17:00", NOAPTE_START, NOAPTE_SFARSIT)).toBe(0);
  });

  it("numără doar coada turei care intră în noapte", () => {
    // 14:00–23:00 → o oră după 22:00.
    expect(oreNoapteDinInterval("14:00", "23:00", NOAPTE_START, NOAPTE_SFARSIT)).toBe(1);
  });

  it("numără doar începutul turei care iese din noapte", () => {
    // 04:00–12:00 → două ore înainte de 06:00.
    expect(oreNoapteDinInterval("04:00", "12:00", NOAPTE_START, NOAPTE_SFARSIT)).toBe(2);
  });

  it("însumează ambele ferestre pentru o tură care le atinge pe amândouă", () => {
    // 05:00–23:30: o oră dimineața (05–06) + o oră și jumătate seara (22–23:30).
    expect(oreNoapteDinInterval("05:00", "23:30", NOAPTE_START, NOAPTE_SFARSIT)).toBe(2.5);
  });

  it("o tură integral în fereastra de dimineață se numără toată", () => {
    expect(oreNoapteDinInterval("00:00", "06:00", NOAPTE_START, NOAPTE_SFARSIT)).toBe(6);
  });

  it("acceptă un interval de noapte care NU trece peste miezul nopții", () => {
    // Configurație neobișnuită, dar permisă de bază.
    expect(oreNoapteDinInterval("10:00", "16:00", "12:00", "14:00")).toBe(2);
  });

  it("întoarce null pentru o tură care nu se închide în aceeași zi", () => {
    expect(oreNoapteDinInterval("22:00", "06:00", NOAPTE_START, NOAPTE_SFARSIT)).toBeNull();
  });

  it("întoarce null pentru ore invalide", () => {
    expect(oreNoapteDinInterval("24:00", "06:00", NOAPTE_START, NOAPTE_SFARSIT)).toBeNull();
    expect(oreNoapteDinInterval("09:00", "17:00", "aa:bb", NOAPTE_SFARSIT)).toBeNull();
  });

  it("lucrează la minut, nu la oră întreagă", () => {
    // 21:45–22:15 → 15 minute de noapte.
    expect(oreNoapteDinInterval("21:45", "22:15", NOAPTE_START, NOAPTE_SFARSIT)).toBe(0.25);
  });
});

describe("sporDeNoapteSeAplica", () => {
  it("nu se acordă sub pragul legal de 3 ore", () => {
    expect(sporDeNoapteSeAplica(2.5, 3)).toBe(false);
  });

  it("se acordă exact la prag", () => {
    expect(sporDeNoapteSeAplica(3, 3)).toBe(true);
  });

  it("pragul zero înseamnă fără prag — orice fracțiune primește spor", () => {
    expect(sporDeNoapteSeAplica(0.25, 0)).toBe(true);
  });

  it("zero ore de noapte nu primesc spor, oricare ar fi pragul", () => {
    expect(sporDeNoapteSeAplica(0, 0)).toBe(false);
    expect(sporDeNoapteSeAplica(0, 3)).toBe(false);
  });
});

describe("oreleZilei", () => {
  /** Firma-etalon: 8h/zi, pauză de 30 min neplătită, obligatorie peste 6h. */
  const CONFIG: ConfigZi = {
    orePeZi: 8,
    noapteStart: "22:00",
    noapteSfarsit: "06:00",
    pauzaMinute: 30,
    pauzaInclusaInProgram: false,
    pauzaObligatoriePesteOre: 6,
  };

  it("scade pauza din 08:30–17:00 și NU produce ore suplimentare", () => {
    // Cazul care a pornit totul. Fără scăderea pauzei, omul primea 0,5 ore
    // suplimentare în fiecare zi lucrată, plătite cu spor.
    expect(oreleZilei("08:30", "17:00", CONFIG)).toEqual({
      brut: 8.5,
      pauza: 0.5,
      lucrate: 8,
      suplimentare: 0,
      noapte: 0,
    });
  });

  it("nu scade nimic când pauza e inclusă în program", () => {
    const rezultat = oreleZilei("08:30", "17:00", { ...CONFIG, pauzaInclusaInProgram: true });
    expect(rezultat?.pauza).toBe(0);
    expect(rezultat?.lucrate).toBe(8.5);
    expect(rezultat?.suplimentare).toBe(0.5);
  });

  it("nu scade pauza sub pragul de obligativitate", () => {
    // 09:00–12:00 = 3h. Nimeni n-a luat masa de prânz într-o tură de trei ore.
    expect(oreleZilei("09:00", "12:00", CONFIG)).toEqual({
      brut: 3,
      pauza: 0,
      lucrate: 3,
      suplimentare: 0,
      noapte: 0,
    });
  });

  it("scade pauza exact peste prag, nu la prag", () => {
    // Pragul e „peste 6 ore”, deci fix 6 ore nu declanșează scăderea.
    expect(oreleZilei("09:00", "15:00", CONFIG)?.pauza).toBe(0);
    expect(oreleZilei("09:00", "15:01", CONFIG)?.pauza).toBe(0.5);
  });

  it("numără ca suplimentare doar ce depășește norma DUPĂ pauză", () => {
    // 08:00–19:00 = 11h brut, 10,5 nete, 2,5 peste norma de 8.
    expect(oreleZilei("08:00", "19:00", CONFIG)).toEqual({
      brut: 11,
      pauza: 0.5,
      lucrate: 10.5,
      suplimentare: 2.5,
      noapte: 0,
    });
  });

  it("derivă orele de noapte din fereastra organizației", () => {
    // 14:00–23:00: o oră cade după 22:00.
    const rezultat = oreleZilei("14:00", "23:00", CONFIG);
    expect(rezultat?.noapte).toBe(1);
    expect(rezultat?.lucrate).toBe(8.5);
  });

  it("plafonează orele de noapte la orele lucrate", () => {
    // Prag de pauză 0 = pauza se scade mereu. Tura 22:00–23:00 e integral
    // noapte: fără plafonare ar ieși noapte 1 > lucrate 0,5, iar CHECK-ul
    // `attendance_entries_noapte_ck` ar respinge scrierea cu 23514.
    const rezultat = oreleZilei("22:00", "23:00", { ...CONFIG, pauzaObligatoriePesteOre: 0 });
    expect(rezultat?.lucrate).toBe(0.5);
    expect(rezultat?.noapte).toBe(0.5);
  });

  it("nu duce ziua sub zero când pauza e mai lungă decât tura", () => {
    const rezultat = oreleZilei("09:00", "09:20", {
      ...CONFIG,
      pauzaMinute: 60,
      pauzaObligatoriePesteOre: 0,
    });
    expect(rezultat?.lucrate).toBe(0);
    expect(rezultat?.noapte).toBe(0);
  });

  it("întoarce null pentru o tură care nu se închide în aceeași zi", () => {
    // Modelul are un rând pe zi: 22:00–06:00 nu se poate exprima.
    expect(oreleZilei("22:00", "06:00", CONFIG)).toBeNull();
    expect(oreleZilei("09:00", "09:00", CONFIG)).toBeNull();
  });

  it("întoarce null pentru ore invalide", () => {
    expect(oreleZilei("8:30", "17:00", CONFIG)).toBeNull();
    expect(oreleZilei("08:30", "25:00", CONFIG)).toBeNull();
  });

  it("respectă cele două CHECK-uri ale tabelei pe orice interval de sfert de oră", () => {
    // Proba pe care nicio unitate izolată n-o dă: indiferent de interval,
    // rezultatul trebuie să treacă de `_suplimentare_ck` și `_noapte_ck`.
    for (let inceput = 0; inceput < 24 * 60; inceput += 15) {
      for (let sfarsit = inceput + 15; sfarsit < 24 * 60; sfarsit += 15) {
        const ca = (m: number) =>
          `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
        const rezultat = oreleZilei(ca(inceput), ca(sfarsit), {
          ...CONFIG,
          pauzaObligatoriePesteOre: 0,
        });
        if (rezultat === null) continue;
        expect(rezultat.lucrate).toBeGreaterThanOrEqual(0);
        expect(rezultat.suplimentare).toBeLessThanOrEqual(rezultat.lucrate);
        expect(rezultat.noapte).toBeLessThanOrEqual(rezultat.lucrate);
      }
    }
  });
});
