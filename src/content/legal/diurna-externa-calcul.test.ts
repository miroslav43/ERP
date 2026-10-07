import { describe, expect, it } from "vitest";

import { calculeazaDiurnaExterna } from "./diurna-externa-calcul";

const ora = (zi: number, h: number, m = 0) => new Date(Date.UTC(2026, 9, zi, h, m));

describe("calculul diurnei externe", () => {
  it("exemplul din ghid: luni 7:00 – vineri 21:00, Germania", () => {
    // 4 zile întregi + 14 ore: restul trece de 12 ore, deci încă o zi întreagă.
    const r = calculeazaDiurnaExterna({
      cuantum: 35,
      plecare: ora(5, 7),
      intoarcere: ora(9, 21),
      platitPeZi: 60,
    });
    expect(r?.zile).toBe(5);
    expect(r?.diurnaLegala).toBe(175);
    expect(r?.plafonNeimpozabil).toBe(437.5);
    // 60 €/zi × 5 = 300 €, sub plafon: totul e neimpozabil, cum spune ghidul.
    expect(r?.platit).toBe(300);
    expect(r?.impozabil).toBe(0);
  });

  it("fracțiunea: până la 12 ore inclusiv 50%, peste 12 ore 100%", () => {
    expect(
      calculeazaDiurnaExterna({ cuantum: 35, plecare: ora(5, 8), intoarcere: ora(6, 20) })?.zile,
    ).toBe(1.5);
    expect(
      calculeazaDiurnaExterna({ cuantum: 35, plecare: ora(5, 8), intoarcere: ora(6, 20, 1) })?.zile,
    ).toBe(2);
    expect(
      calculeazaDiurnaExterna({ cuantum: 35, plecare: ora(5, 8), intoarcere: ora(6, 8) })?.zile,
    ).toBe(1);
  });

  it("partea plătită peste plafon e impozabilă", () => {
    // Bulgaria, 32 €: plafon 80 €/zi. Plătit 100 €/zi pe 2 zile: 40 € peste plafon.
    const r = calculeazaDiurnaExterna({
      cuantum: 32,
      plecare: ora(5, 6),
      intoarcere: ora(7, 6),
      platitPeZi: 100,
    });
    expect(r?.plafonNeimpozabil).toBe(160);
    expect(r?.impozabil).toBe(40);
  });

  it("cenții nu se pierd în virgulă mobilă", () => {
    // 33,33 × 2,5 = 83,325 → 83,33 (rotunjit la cent), nu 83,32.
    const r = calculeazaDiurnaExterna({
      cuantum: 33.33,
      plecare: ora(5, 0),
      intoarcere: ora(6, 0),
    });
    expect(r?.plafonNeimpozabil).toBe(83.33);
  });

  it("o întoarcere înaintea plecării nu e o deplasare", () => {
    expect(
      calculeazaDiurnaExterna({ cuantum: 35, plecare: ora(9, 0), intoarcere: ora(5, 0) }),
    ).toBeNull();
    expect(
      calculeazaDiurnaExterna({ cuantum: 35, plecare: ora(9, 0), intoarcere: ora(9, 0) }),
    ).toBeNull();
  });
});
