// src/domain/calendar/grila-lunara.test.ts
import { describe, expect, it } from "vitest";

import { construiesteSaptamani, isoDowPrimaZi, numarZileLuna, ziIso } from "./grila-lunara";

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
