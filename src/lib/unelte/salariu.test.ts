import { describe, expect, it } from "vitest";

import { dinBrut, dinNet } from "./salariu";

describe("calculul public de salariu", () => {
  it("netul crește cu brutul (monoton), pe tot intervalul uzual", () => {
    let anterior = -1;
    for (let brut = 4000; brut <= 20000; brut += 250) {
      const { net } = dinBrut(brut, 0, true);
      expect(net, String(brut)).toBeGreaterThan(anterior);
      anterior = net;
    }
  });

  it("net → brut → net se închide la cel mult 1 leu", () => {
    for (const net of [2700, 3000, 4500, 7000, 12000]) {
      const r = dinNet(net, 1, true);
      expect(Math.abs(r.net - net), String(net)).toBeLessThanOrEqual(1);
    }
  });

  it("persoanele în întreținere nu scad netul, iar funcția de bază contează", () => {
    expect(dinBrut(5000, 2, true).net).toBeGreaterThan(dinBrut(5000, 0, true).net);
    // În afara funcției de bază nu se acordă deducerea personală (art. 77 alin. (1)).
    expect(dinBrut(5000, 2, false).deducerePersonala).toBe(0);
    expect(dinBrut(5000, 0, true).deducerePersonala).toBeGreaterThan(0);
  });

  it("descompunerea se închide: brut − CAS − CASS − impozit = net", () => {
    const r = dinBrut(6000, 1, true);
    expect(Math.abs(r.brut - r.cas - r.cass - r.impozit - r.net)).toBeLessThanOrEqual(0.02);
    expect(r.costTotal).toBeCloseTo(r.brut + r.cam, 2);
  });

  it("intrările absurde sunt mărginite, nu aruncă", () => {
    expect(() => dinBrut(-100, 0, true)).not.toThrow();
    expect(() => dinBrut(Number.NaN, 0, true)).not.toThrow();
    expect(() => dinNet(10_000_000, 99, true)).not.toThrow();
    expect(dinBrut(-100, 0, true).brut).toBeGreaterThanOrEqual(1);
  });

  // Vectorii de control ai contabilului (brut, persoane → net, la leu) se adaugă
  // aici, ca `it(...)` concrete, în momentul confirmării valorilor din
  // `salarizare-publica.ts`. Până atunci, proprietățile de mai sus țin motorul pe loc.
});
