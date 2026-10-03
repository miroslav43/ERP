import { describe, expect, it } from "vitest";

import { dinBrut, dinNet } from "./salariu";

describe("calculul public de salariu", () => {
  it("netul NU e strict monoton: la fiecare prag de 50 de lei scade cu cel mult 5 lei", () => {
    // Revizuirea finală: deducerea personală scade în trepte de 0,5% din minim
    // (~21,6 lei) la fiecare 50 de lei, deci netul coboară puțin la prag —
    // brut 4.375 → 2.643,71, brut 4.376 → 2.642,13. Testul vechi mergea din 250
    // în 250 de lei și nu vedea treptele.
    // Fără salariul minim însuși: acolo netul sare intenționat, cu suma
    // neimpozabilă (testat separat, mai jos).
    let anterior = dinBrut(4326, 0, true).net;
    let celMaiMareRecul = 0;
    for (let brut = 4327; brut <= 6400; brut += 1) {
      const { net } = dinBrut(brut, 0, true);
      celMaiMareRecul = Math.max(celMaiMareRecul, anterior - net);
      anterior = net;
    }
    expect(celMaiMareRecul).toBeGreaterThan(0);
    // 2–3 lei din treapta deducerii, plus până la 1–2 lei din rotunjirea la leu.
    expect(celMaiMareRecul).toBeLessThanOrEqual(5);
  });

  it("dinNet întoarce CEL MAI MIC brut care atinge netul cerut, și lângă praguri", () => {
    const bruturi = Array.from({ length: 1201 }, (_, i) => 3500 + i);
    const neturi = bruturi.map((b) => dinBrut(b, 0, true).net);
    for (const tinta of [2600, 2642.13, 2643, 2650, 2700]) {
      const minim = bruturi.find((_, i) => (neturi[i] ?? 0) >= tinta);
      expect(dinNet(tinta, 0, true).brut, String(tinta)).toBe(minim);
    }
  });

  it("net → brut → net se închide la cel mult 1 leu, deasupra netului de la minim", () => {
    for (const net of [3000, 4500, 7000, 12000]) {
      const r = dinNet(net, 1, true);
      expect(Math.abs(r.net - net), String(net)).toBeLessThanOrEqual(1);
    }
  });

  it("un net sub cel de la salariul minim întoarce salariul minim, nu un brut sub el", () => {
    // Cu o persoană în întreținere, netul la minim e peste 2.700: niciun brut
    // legal cu normă întreagă nu dă exact 2.700.
    const r = dinNet(2700, 1, true);
    expect(r.brut).toBe(4325);
    expect(r.net).toBeGreaterThanOrEqual(2700);
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

describe("vectorii de control, publicați pentru a doua jumătate a lui 2026", () => {
  // Surse încrucișate pe 3 oct 2026: HotNews, Știrile ProTV, salariile.ro,
  // calculvenituri.ro — toate dau aceleași cifre, iar ele ies și din textele de
  // lege (HG 146/2026, OUG 89/2025 art. III, Codul fiscal art. 77, 138, 156).
  it("salariul minim 4.325 → net 2.699, cu 200 de lei neimpozabili (OUG 89/2025 art. III)", () => {
    const r = dinBrut(4325, 0, true);
    expect(r.sumaNeimpozabila).toBe(200);
    expect(r.cas).toBe(1031);
    expect(r.cass).toBe(413);
    expect(r.impozit).toBe(182);
    expect(r.net).toBe(2699);
  });

  it("brut 5.000, fără persoane → deducere 562, impozit 269, net 2.981", () => {
    const r = dinBrut(5000, 0, true);
    expect(r.sumaNeimpozabila).toBe(0);
    expect(r.deducerePersonala).toBe(562);
    expect(r.cas).toBe(1250);
    expect(r.cass).toBe(500);
    expect(r.impozit).toBe(269);
    expect(r.net).toBe(2981);
  });

  it("facilitatea cere funcția de bază și salariul de bază egal cu minimul", () => {
    expect(dinBrut(4325, 0, false).sumaNeimpozabila).toBe(0);
    expect(dinBrut(4326, 0, true).sumaNeimpozabila).toBe(0);
  });

  it("net 2.699 → brutul minim, nu unul de deasupra lui", () => {
    expect(dinNet(2699, 0, true).brut).toBe(4325);
  });
});
