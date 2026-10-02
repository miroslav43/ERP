import { describe, expect, it } from "vitest";

import { dinBrut, dinNet } from "./salariu";

describe("calculul public de salariu", () => {
  it("netul NU e strict monoton: la fiecare prag de 50 de lei scade cu cel mult 3 lei", () => {
    // Revizuirea finală: deducerea personală scade în trepte de 0,5% din minim
    // (~21,6 lei) la fiecare 50 de lei, deci netul coboară puțin la prag —
    // brut 4.375 → 2.643,71, brut 4.376 → 2.642,13. Testul vechi mergea din 250
    // în 250 de lei și nu vedea treptele.
    let anterior = dinBrut(4300, 0, true).net;
    let celMaiMareRecul = 0;
    for (let brut = 4301; brut <= 6400; brut += 1) {
      const { net } = dinBrut(brut, 0, true);
      celMaiMareRecul = Math.max(celMaiMareRecul, anterior - net);
      anterior = net;
    }
    expect(celMaiMareRecul).toBeGreaterThan(0);
    expect(celMaiMareRecul).toBeLessThanOrEqual(3);
  });

  it("dinNet întoarce CEL MAI MIC brut care atinge netul cerut, și lângă praguri", () => {
    const bruturi = Array.from({ length: 1201 }, (_, i) => 3500 + i);
    const neturi = bruturi.map((b) => dinBrut(b, 0, true).net);
    for (const tinta of [2600, 2642.13, 2643, 2650, 2700]) {
      const minim = bruturi.find((_, i) => (neturi[i] ?? 0) >= tinta);
      expect(dinNet(tinta, 0, true).brut, String(tinta)).toBe(minim);
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
