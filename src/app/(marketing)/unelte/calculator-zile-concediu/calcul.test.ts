import { describe, expect, it } from "vitest";

import { calculeaza, citesteCalculul, DREPT_MINIM } from "./calcul";

const citeste = (parametri: Record<string, string>) =>
  citesteCalculul(new URLSearchParams(parametri), 2026);

describe("zilele de concediu cuvenite într-un an", () => {
  it("fără nimic completat: anul curent, minimul legal, an întreg", () => {
    const { intrare, probleme } = citeste({});
    expect(probleme).toEqual([]);
    expect(intrare).toEqual({
      an: 2026,
      dreptAnual: DREPT_MINIM,
      suplimentar: 0,
      dataAngajarii: null,
      dataIncetarii: null,
    });
    expect(calculeaza(intrare)).toEqual({
      dreptTotal: 20,
      luniLucrate: 12,
      proportional: 20,
      inJos: 20,
      inSus: 20,
      anIntreg: true,
    });
  });

  it("angajat pe 15 martie: martie–decembrie, 10 luni din 12", () => {
    const r = calculeaza(citeste({ drept: "20", angajare: "2026-03-15" }).intrare);
    expect(r.luniLucrate).toBe(10);
    expect(r.proportional).toBe(16.67);
    expect(r.inJos).toBe(16);
    expect(r.inSus).toBe(17);
    expect(r.anIntreg).toBe(false);
  });

  it("plecat pe 10 septembrie, angajat de ani buni: ianuarie–septembrie", () => {
    const r = calculeaza(
      citeste({ drept: "21", angajare: "2024-05-02", incetare: "2026-09-10" }).intrare,
    );
    expect(r.luniLucrate).toBe(9);
    expect(r.proportional).toBe(15.75);
  });

  it("zilele suplimentare din art. 147 se adună la drept", () => {
    expect(calculeaza(citeste({ drept: "21", suplimentar: "3" }).intrare).dreptTotal).toBe(24);
  });

  it("sub minimul legal, date greșite și date în ordine inversă sunt refuzate", () => {
    expect(citeste({ drept: "18" }).probleme.join(" ")).toMatch(/art\. 145 alin\. \(1\)/u);
    expect(citeste({ angajare: "2036-01-01" }).probleme.join(" ")).toMatch(/2036/u);
    expect(citeste({ angajare: "2026-09-01", incetare: "2026-03-01" }).probleme.join(" ")).toMatch(
      /înaintea datei angajării/u,
    );
    expect(citeste({ an: "2026", angajare: "2027-02-01" }).probleme.join(" ")).toMatch(
      /după anul 2026/u,
    );
  });
});
