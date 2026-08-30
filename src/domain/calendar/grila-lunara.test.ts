// src/domain/calendar/grila-lunara.test.ts
import { describe, expect, it } from "vitest";

import {
  adaugaZileIso,
  construiesteSaptamani,
  deplaseazaLuna,
  isoDowPrimaZi,
  numarZileLuna,
  ziIso,
} from "./grila-lunara";

describe("isoDowPrimaZi", () => {
  it("dă 7 pentru o lună care începe duminica, nu 0", () => {
    // 1 martie 2026 e duminică. Cu `getUTCDay()` brut ar ieși 0, iar umplutura
    // s-ar calcula ca -1: prima zi a lunii ar sări în coloana de sâmbătă.
    expect(isoDowPrimaZi(2026, 3)).toBe(7);
  });

  it("dă 1 pentru o lună care începe luni", () => {
    expect(isoDowPrimaZi(2026, 6)).toBe(1);
  });

  it("nu alunecă în luna precedentă", () => {
    // Fiecare 1 ianuarie al deceniului, ziua săptămânii cunoscută.
    expect(isoDowPrimaZi(2024, 1)).toBe(1); // luni
    expect(isoDowPrimaZi(2025, 1)).toBe(3); // miercuri
    expect(isoDowPrimaZi(2026, 1)).toBe(4); // joi
    expect(isoDowPrimaZi(2027, 1)).toBe(5); // vineri
  });
});

describe("numarZileLuna", () => {
  it("dă lungimile obișnuite", () => {
    expect(numarZileLuna(2026, 1)).toBe(31);
    expect(numarZileLuna(2026, 4)).toBe(30);
    expect(numarZileLuna(2026, 12)).toBe(31);
  });

  it("prinde februarie bisect", () => {
    expect(numarZileLuna(2026, 2)).toBe(28);
    expect(numarZileLuna(2028, 2)).toBe(29);
    // 2100 nu e bisect: divizibil cu 100, dar nu cu 400.
    expect(numarZileLuna(2100, 2)).toBe(28);
    expect(numarZileLuna(2000, 2)).toBe(29);
  });
});

describe("ziIso", () => {
  it("completează cu zero luna și ziua", () => {
    expect(ziIso(2026, 3, 9)).toBe("2026-03-09");
    expect(ziIso(2026, 12, 31)).toBe("2026-12-31");
  });
});

describe("construiesteSaptamani", () => {
  it("umple începutul până la luni", () => {
    // 1 martie 2026 cade duminica: șase căsuțe goale înaintea ei.
    expect(construiesteSaptamani(2026, 3)[0]).toEqual([null, null, null, null, null, null, 1]);
  });

  it("începe cu o săptămână plină când luna chiar începe într-o luni", () => {
    expect(construiesteSaptamani(2026, 6)[0]).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("dă numai rânduri de câte șapte, pentru orice lună a anului", () => {
    for (let luna = 1; luna <= 12; luna += 1) {
      for (const saptamana of construiesteSaptamani(2026, luna)) {
        expect(saptamana).toHaveLength(7);
      }
    }
  });

  it("nu pierde și nu inventează nicio zi a lunii", () => {
    for (let luna = 1; luna <= 12; luna += 1) {
      const zile = construiesteSaptamani(2026, luna)
        .flat()
        .filter((z): z is number => z !== null);
      expect(zile).toEqual(Array.from({ length: numarZileLuna(2026, luna) }, (_, i) => i + 1));
    }
  });

  it("prinde ziua 29 în februarie bisect", () => {
    const zile = construiesteSaptamani(2028, 2)
      .flat()
      .filter((z) => z !== null);
    expect(zile).toHaveLength(29);
  });

  it("completează coada până la duminică", () => {
    const saptamani = construiesteSaptamani(2026, 3);
    expect(saptamani.at(-1)).toHaveLength(7);
    expect(saptamani.at(-1)?.at(-1)).toBeNull();
  });
});

/**
 * Cele două deplasări de care are nevoie navigarea din calendar. Stau aici, nu
 * în componentă, din același motiv pentru care stă și restul modulului: sunt
 * aritmetică, iar aritmetica greșită de calendar nu aruncă nicio eroare.
 */
describe("adaugaZileIso", () => {
  it("trece peste capătul lunii", () => {
    expect(adaugaZileIso("2026-08-31", 1)).toBe("2026-09-01");
  });

  it("trece peste capătul anului", () => {
    expect(adaugaZileIso("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("merge și înapoi, peste capătul anului", () => {
    expect(adaugaZileIso("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("sare o săptămână întreagă", () => {
    expect(adaugaZileIso("2026-08-12", -7)).toBe("2026-08-05");
  });

  /**
   * 2028 e bisect. Un salt care sare peste 29 februarie ar însemna că
   * aritmetica se face pe luni, nu pe zile.
   */
  it("numără 29 februarie într-un an bisect", () => {
    expect(adaugaZileIso("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("sare peste 29 februarie într-un an nebisect", () => {
    expect(adaugaZileIso("2027-02-28", 1)).toBe("2027-03-01");
  });
});

describe("deplaseazaLuna", () => {
  it("trece din decembrie în ianuarie ANUL URMĂTOR", () => {
    expect(deplaseazaLuna(2026, 12, 1)).toEqual({ an: 2027, luna: 1 });
  });

  it("trece din ianuarie în decembrie anul precedent", () => {
    expect(deplaseazaLuna(2026, 1, -1)).toEqual({ an: 2025, luna: 12 });
  });

  it("nu schimbă anul într-o deplasare obișnuită", () => {
    expect(deplaseazaLuna(2026, 8, 1)).toEqual({ an: 2026, luna: 9 });
  });

  /** Săgeata de an e o deplasare de douăsprezece luni, nu un caz aparte. */
  it("douăsprezece luni înapoi înseamnă același număr de lună, anul precedent", () => {
    expect(deplaseazaLuna(2026, 8, -12)).toEqual({ an: 2025, luna: 8 });
  });
});
