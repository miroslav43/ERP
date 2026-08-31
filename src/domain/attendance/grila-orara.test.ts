import { describe, expect, it } from "vitest";

import { configZiDin, oreleZilei } from "./calcul-ore";
import {
  INTERVAL_IMPLICIT,
  PAS_MINUTE,
  inaltimeaInOre,
  intervalulGrilei,
  liniileOrare,
  minutulDinFractie,
  minutulOrei,
  pozitiaBlocului,
  selectiaDinTragere,
} from "./grila-orara";

const CONFIG = configZiDin(null);

describe("minutulOrei", () => {
  it("citește ora canonică pe care o produce câmpul de oră", () => {
    expect(minutulOrei("00:00")).toBe(0);
    expect(minutulOrei("08:30")).toBe(510);
    expect(minutulOrei("23:59")).toBe(1439);
  });

  it("tolerează secundele cu care o coloană `time` ajunge în client", () => {
    // Cazul care ar fi făcut blocurile să dispară tăcut: `intrariLuna` întoarce
    // `ora_inceput` exact așa, iar `minuteDinOra` singur îl respinge.
    expect(minutulOrei("08:30:00")).toBe(510);
    expect(minutulOrei("17:05:30")).toBe(1025);
  });

  it("întoarce null pentru absență și pentru ce nu e oră", () => {
    expect(minutulOrei(null)).toBeNull();
    expect(minutulOrei(undefined)).toBeNull();
    expect(minutulOrei("")).toBeNull();
    expect(minutulOrei("24:00")).toBeNull();
    expect(minutulOrei("8,5")).toBeNull();
  });
});

describe("intervalulGrilei", () => {
  it("rămâne la programul obișnuit când totul încape în el", () => {
    expect(
      intervalulGrilei([
        { oraInceput: "08:00", oraSfarsit: "16:30" },
        { oraInceput: "09:15", oraSfarsit: "18:00" },
      ]),
    ).toEqual(INTERVAL_IMPLICIT);
  });

  it("coboară marginea de sus pentru o tură care începe devreme", () => {
    // 05:20 rotunjit la ora întreagă: 05:00, nu 05:20 — rigla scrie ore, nu sferturi.
    const interval = intervalulGrilei([{ oraInceput: "05:20", oraSfarsit: "13:00" }]);
    expect(interval.de).toBe(5 * 60);
    expect(interval.pana).toBe(INTERVAL_IMPLICIT.pana);
  });

  it("ridică marginea de jos pentru o tură care se termină târziu", () => {
    const interval = intervalulGrilei([{ oraInceput: "14:00", oraSfarsit: "23:10" }]);
    expect(interval.de).toBe(INTERVAL_IMPLICIT.de);
    expect(interval.pana).toBe(24 * 60);
  });

  it("face loc și zilei deschise cu ceasul, neîncheiate", () => {
    // „Am intrat" la 04:50, fără „Am ieșit": trebuie să se vadă, deși n-are durată.
    const interval = intervalulGrilei([{ oraInceput: "04:50", oraSfarsit: null }]);
    expect(interval.de).toBe(4 * 60);
  });

  it("ignoră zilele fără oră de început — concediu, sau doar un număr de ore", () => {
    expect(intervalulGrilei([{ oraInceput: null, oraSfarsit: null }])).toEqual(INTERVAL_IMPLICIT);
    expect(intervalulGrilei([{ oraInceput: null, oraSfarsit: "16:00" }])).toEqual(
      INTERVAL_IMPLICIT,
    );
    expect(intervalulGrilei([])).toEqual(INTERVAL_IMPLICIT);
  });

  it("marginile rămân întotdeauna ore întregi, în ordine", () => {
    const interval = intervalulGrilei([
      { oraInceput: "00:10", oraSfarsit: "03:40" },
      { oraInceput: "21:05", oraSfarsit: "23:55" },
    ]);
    expect(interval.de % 60).toBe(0);
    expect(interval.pana % 60).toBe(0);
    expect(interval.de).toBe(0);
    expect(interval.pana).toBe(24 * 60);
  });
});

describe("liniileOrare și inaltimeaInOre", () => {
  it("scrie fiecare oră întreagă, fără marginea de jos", () => {
    const linii = liniileOrare({ de: 6 * 60, pana: 9 * 60 });
    expect(linii).toEqual(["06:00", "07:00", "08:00"]);
  });

  it("numără orele ferestrei implicite", () => {
    expect(inaltimeaInOre(INTERVAL_IMPLICIT)).toBe(16);
    expect(liniileOrare(INTERVAL_IMPLICIT)).toHaveLength(16);
  });

  it("nu scrie niciodată `24:00`, care nu e o oră", () => {
    const linii = liniileOrare({ de: 0, pana: 24 * 60 });
    expect(linii).toHaveLength(24);
    expect(linii.at(-1)).toBe("23:00");
  });
});

describe("minutulDinFractie", () => {
  it("capetele ferestrei sunt capetele fracțiunii", () => {
    expect(minutulDinFractie(0, INTERVAL_IMPLICIT)).toBe(6 * 60);
    expect(minutulDinFractie(1, INTERVAL_IMPLICIT)).toBe(22 * 60);
  });

  it("aliniază la cel mai apropiat sfert, nu în jos", () => {
    // Fereastra implicită are 960 de minute. Două minute sub 09:00 (adică
    // fracțiunea lui 08:58) trebuie să dea 09:00: omul a vrut ora rotundă.
    const fractie = (8 * 60 + 58 - 6 * 60) / 960;
    expect(minutulDinFractie(fractie, INTERVAL_IMPLICIT)).toBe(9 * 60);
  });

  it("plafonează pointerul ieșit din coloană", () => {
    // `setPointerCapture` lasă dinadins degetul să iasă din dreptunghi.
    expect(minutulDinFractie(-0.5, INTERVAL_IMPLICIT)).toBe(6 * 60);
    expect(minutulDinFractie(1.4, INTERVAL_IMPLICIT)).toBe(22 * 60);
  });

  it("produce doar multipli ai pasului", () => {
    for (let i = 0; i <= 100; i += 1) {
      expect(minutulDinFractie(i / 100, INTERVAL_IMPLICIT) % PAS_MINUTE).toBe(0);
    }
  });
});

describe("selectiaDinTragere", () => {
  it("dă intervalul tras de sus în jos", () => {
    expect(selectiaDinTragere(9 * 60, 17 * 60 + 30, INTERVAL_IMPLICIT)).toEqual({
      inceput: "09:00",
      sfarsit: "17:30",
    });
  });

  it("tragerea de jos în sus dă exact același interval", () => {
    // Se trage în ambele sensuri la fel de des.
    expect(selectiaDinTragere(17 * 60 + 30, 9 * 60, INTERVAL_IMPLICIT)).toEqual(
      selectiaDinTragere(9 * 60, 17 * 60 + 30, INTERVAL_IMPLICIT),
    );
  });

  it("atingerea fără mișcare dă un sfert de oră, nu un interval gol", () => {
    // Un început egal cu sfârșitul ar fi refuzat de `oreleZilei` cu `null`, iar
    // dialogul s-ar deschide cu un interval pe care salvarea îl respinge.
    expect(selectiaDinTragere(9 * 60, 9 * 60, INTERVAL_IMPLICIT)).toEqual({
      inceput: "09:00",
      sfarsit: "09:15",
    });
  });

  it("ultimul sfert al zilei se scrie 23:45–23:59, fiindcă 24:00 nu se poate salva", () => {
    const zi = { de: 0, pana: 24 * 60 };
    expect(selectiaDinTragere(23 * 60 + 45, 24 * 60, zi)).toEqual({
      inceput: "23:45",
      sfarsit: "23:59",
    });
  });

  it("nu mai rămâne loc pentru un interval care începe la 23:59", () => {
    expect(selectiaDinTragere(1439, 1439, { de: 0, pana: 24 * 60 })).toBeNull();
  });

  it("nu iese niciodată deasupra ferestrei", () => {
    const selectie = selectiaDinTragere(2 * 60, 8 * 60, INTERVAL_IMPLICIT);
    expect(selectie?.inceput).toBe("06:00");
  });

  it("orice tragere produce un interval pe care `oreleZilei` îl acceptă", () => {
    /*
      Testul purtător al modulului. Dacă pică, înseamnă că omul trage, dialogul
      se deschide, iar salvarea cade pe server cu „Ora de ieșire trebuie să fie
      după ora de intrare" — o eroare pe care n-are cum s-o lege de ce a făcut.
    */
    const ferestre = [INTERVAL_IMPLICIT, { de: 0, pana: 24 * 60 }, { de: 5 * 60, pana: 23 * 60 }];
    for (const fereastra of ferestre) {
      for (let a = fereastra.de; a <= fereastra.pana; a += PAS_MINUTE) {
        for (const b of [a, a + PAS_MINUTE, a + 210, fereastra.pana, fereastra.de]) {
          const selectie = selectiaDinTragere(a, b, fereastra);
          if (selectie === null) continue;
          expect(
            oreleZilei(selectie.inceput, selectie.sfarsit, CONFIG),
            `${a}→${b}`,
          ).not.toBeNull();
        }
      }
    }
  });
});

describe("pozitiaBlocului", () => {
  it("așază ziua de opt ore în fereastra implicită", () => {
    const pozitie = pozitiaBlocului("08:00", "16:00", INTERVAL_IMPLICIT);
    // 08:00 e la 2 ore din 16 = 12,5 %; 8 ore din 16 = 50 %.
    expect(pozitie?.susProcent).toBeCloseTo(12.5);
    expect(pozitie?.inaltimeProcent).toBeCloseTo(50);
    expect(pozitie?.taiat).toBe(false);
  });

  it("ziua neîncheiată primește un sfert de oră, cât să se vadă", () => {
    const pozitie = pozitiaBlocului("08:00", null, INTERVAL_IMPLICIT);
    expect(pozitie?.inaltimeProcent).toBeCloseTo((15 / 960) * 100);
  });

  it("marchează blocul tăiat de marginea ferestrei, nu-l scurtează tăcut", () => {
    const pozitie = pozitiaBlocului("05:00", "13:00", INTERVAL_IMPLICIT);
    expect(pozitie?.susProcent).toBe(0);
    expect(pozitie?.taiat).toBe(true);
  });

  it("nu desenează nimic pentru o zi fără interval sau cu intervalul întors", () => {
    expect(pozitiaBlocului(null, "16:00", INTERVAL_IMPLICIT)).toBeNull();
    expect(pozitiaBlocului("16:00", "08:00", INTERVAL_IMPLICIT)).toBeNull();
    expect(pozitiaBlocului("08:00", "08:00", INTERVAL_IMPLICIT)).toBeNull();
  });

  it("nu desenează nimic pentru un bloc căzut în întregime în afara ferestrei", () => {
    expect(pozitiaBlocului("01:00", "03:00", INTERVAL_IMPLICIT)).toBeNull();
  });

  it("blocul stă întotdeauna în fereastră, pentru orice interval al zilei", () => {
    const interval = intervalulGrilei([{ oraInceput: "04:30", oraSfarsit: "23:30" }]);
    for (let m = 0; m < 24 * 60; m += 30) {
      const inceput = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      const pozitie = pozitiaBlocului(inceput, null, interval);
      if (pozitie === null) continue;
      expect(pozitie.susProcent, inceput).toBeGreaterThanOrEqual(0);
      expect(pozitie.susProcent + pozitie.inaltimeProcent, inceput).toBeLessThanOrEqual(100.0001);
    }
  });
});
