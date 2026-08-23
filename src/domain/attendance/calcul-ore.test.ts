// src/domain/attendance/calcul-ore.test.ts

import { describe, expect, it } from "vitest";
import {
  oreLucrateDinInterval,
  oreNoapteDinInterval,
  oreSuplimentareDinLucrate,
  sporDeNoapteSeAplica,
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
