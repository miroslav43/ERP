import { describe, expect, it } from "vitest";

import { calculeazaDinBrut, calculeazaDinNet, dinBrut, dinNet, OPTIUNI_IMPLICITE } from "./salariu";

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

  it("dinNet întoarce CEL MAI MIC brut LEGAL care atinge netul cerut, și lângă praguri", () => {
    // Bruturile încep la salariul minim: sub el, niciun brut nu e un răspuns (auditul din 8 oct 2026).
    const bruturi = Array.from({ length: 1201 }, (_, i) => 4325 + i);
    const neturi = bruturi.map((b) => dinBrut(b, 0, true).net);
    for (const tinta of [2600, 2700, 2710, 2731.5, 2750, 3000]) {
      const minim = bruturi.find((_, i) => (neturi[i] ?? 0) >= tinta);
      expect(dinNet(tinta, 0, true).brut, String(tinta)).toBe(minim);
    }
  });

  it("net → brut atinge netul cerut, niciodată cu un leu sub el", () => {
    for (const net of [3000, 4500, 7000, 12000]) {
      const r = dinNet(net, 1, true);
      expect(r.net, String(net)).toBeGreaterThanOrEqual(net);
      expect(r.net - net, String(net)).toBeLessThanOrEqual(5);
    }
  });

  it("net → brut, pe toate țintele rotunde 2.700–15.000: netul atins, brutul cel mai mic", () => {
    // Auditul din 7 oct 2026: 26 din 124 de ținte ieșeau cu netul = ținta − 1
    // (5.000 → brut 8.545, net 4.999; corect: 8.548).
    for (let tinta = 2700; tinta <= 15000; tinta += 100) {
      const r = dinNet(tinta, 0, true);
      expect(r.net, `ținta ${String(tinta)}`).toBeGreaterThanOrEqual(tinta);
      for (let b = r.brut - 1; b >= r.brut - 60; b -= 1) {
        expect(dinBrut(b, 0, true).net, `brut ${String(b)} pentru ${String(tinta)}`).toBeLessThan(
          tinta,
        );
      }
    }
    expect(dinNet(5000, 0, true).brut).toBe(8548);
  });

  it("un net sub cel de la salariul minim întoarce salariul minim, nu un brut sub el", () => {
    // Cu o persoană în întreținere, netul la minim e peste 2.700: niciun brut
    // legal cu normă întreagă nu dă exact 2.700.
    const r = dinNet(2700, 1, true);
    expect(r.brut).toBe(4325);
    expect(r.net).toBeGreaterThanOrEqual(2700);
    // Fără persoane, cazul pe care testul vechi nu-l acoperea: 2.614 întorcea 4.320.
    expect(dinNet(2614, 0, true).brut).toBe(4325);
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

describe("perioada ianuarie–iunie 2026", () => {
  const S1 = { ...OPTIUNI_IMPLICITE, perioada: "2026-1" } as const;

  it("4.050 brut → 2.574 net, cost 4.134, cu 300 de lei scutiți", () => {
    // Baza: 4.050 − 300 = 3.750. CAS 25% = 937,50 → 938; CASS 10% = 375.
    // Deducere 20% × 4.050 = 810. Impozit (3.750 − 937,50 − 375 − 810) × 10% = 162,75 → 163.
    // Net 3.750 − 938 − 375 − 163 + 300 = 2.574. CAM 2,25% × 3.750 = 84,375 → 84; cost 4.050 + 84 = 4.134.
    expect(calculeazaDinBrut(4050, S1)).toMatchObject({
      sumaNeimpozabila: 300,
      cas: 938,
      cass: 375,
      deducerePersonala: 810,
      impozit: 163,
      net: 2574,
      cam: 84,
      costTotal: 4134,
    });
  });

  it("4.051 pierde facilitatea: net 2.449", () => {
    // CAS 1.012,75 → 1.013; CASS 405,10 → 405; deducerea, pasul 1: 19,5% × 4.050 = 789,75 → 790.
    // Impozit (4.051 − 1.012,75 − 405,10 − 790) × 10% = 184,315 → 184. Net 4.051 − 1.013 − 405 − 184 = 2.449.
    expect(calculeazaDinBrut(4051, S1).net).toBe(2449);
  });

  it("4.050 în iulie–decembrie nu mai e salariul minim: fără scutire", () => {
    expect(calculeazaDinBrut(4050, OPTIUNI_IMPLICITE).sumaNeimpozabila).toBe(0);
  });

  it("net 2.575 cere 4.280 de lei brut: capcana de după minim e mai lungă în prima jumătate", () => {
    // Peste 4.050, cei 300 de lei scutiți se pierd: netul revine peste 2.574 abia la 4.280.
    expect(calculeazaDinNet(2575, S1)?.rezultat.brut).toBe(4280);
    expect(calculeazaDinNet(2574, S1)?.rezultat.brut).toBe(4050);
  });
});

describe("rotunjirea la leu nu mai depinde de virgula mobilă", () => {
  // Auditul din 8 oct 2026: motorul primea luna ca 21 de zile, iar 5.394 / 21 × 21 iese
  // 5.393,999… — CAS 1.348,50 se rotunjea în jos. Circa 225 de bruturi între 4.325 și 20.000.
  it("brut 5.394: CAS 1.348,50 → 1.349, net 3.194", () => {
    // CASS 539,4 → 539; deducere la minim + 1.069: pasul 22, 9% × 4.325 = 389,25 → 389;
    // impozit (5.394 − 1.348,5 − 539,4 − 389) × 10% = 311,71 → 312; net 5.394 − 1.349 − 539 − 312 = 3.194.
    expect(dinBrut(5394, 0, true)).toMatchObject({ cas: 1349, net: 3194 });
  });

  it("brut 5.415: CASS 541,50 → 542", () => {
    expect(dinBrut(5415, 0, true).cass).toBe(542);
  });
});

describe("net → brut nu coboară sub minimul legal și nu plafonează tăcut", () => {
  it("fără persoane, orice net sub 2.699 întoarce 4.325, marcat ca ridicare la minim", () => {
    // Auditul din 8 oct 2026, live: 2.614 → 4.320, 2.500 → 4.127, 1.500 → 2.417.
    for (const tinta of [2614, 2500, 1500, 1]) {
      const r = calculeazaDinNet(tinta, OPTIUNI_IMPLICITE);
      expect(r?.rezultat.brut, String(tinta)).toBe(4325);
      expect(r?.rezultat.net, String(tinta)).toBe(2699);
      expect(r?.ridicatLaMinim, String(tinta)).toBe(true);
    }
  });

  it("exact netul de la minim nu e o ridicare", () => {
    expect(calculeazaDinNet(2699, OPTIUNI_IMPLICITE)).toMatchObject({
      ridicatLaMinim: false,
      rezultat: { brut: 4325 },
    });
  });

  it("în ianuarie–iunie, minimul legal e 4.050", () => {
    const r = calculeazaDinNet(2000, { ...OPTIUNI_IMPLICITE, perioada: "2026-1" });
    expect(r?.rezultat.brut).toBe(4050);
    expect(r?.ridicatLaMinim).toBe(true);
  });

  it("un net peste ce dă brutul de 500.000 de lei e refuzat, nu plafonat", () => {
    // 500.000 brut: CAS 125.000, CASS 50.000, fără deducere; impozit 32.500; net 292.500.
    expect(calculeazaDinNet(292_500, OPTIUNI_IMPLICITE)?.rezultat.brut).toBe(500_000);
    expect(calculeazaDinNet(292_501, OPTIUNI_IMPLICITE)).toBeNull();
    expect(calculeazaDinNet(500_000, OPTIUNI_IMPLICITE)).toBeNull();
  });

  it("lângă pragul de minim + 2.000, cu 3–4 persoane, brutul nu iese cu 100+ lei prea mare", () => {
    // Live, 8 oct 2026: net 3.715 cu 4 persoane → brut 6.291 (net 3.788), iar 6.153 dă exact 3.715.
    // 6.153: minim + 1.828, pasul 37, 45% − 18,5 = 26,5% × 4.325 = 1.146,13 → 1.146.
    // Impozit (6.153 − 1.538,25 − 615,3 − 1.146) × 10% = 285,345 → 285; net 6.153 − 1.538 − 615 − 285 = 3.715.
    expect(dinNet(3715, 4, true).brut).toBe(6153);
    expect(dinNet(3800, 4, true).brut).toBe(6311);
    for (const persoane of [3, 4]) {
      const bruturi = Array.from({ length: 2400 }, (_, i) => 4325 + i);
      const neturi = bruturi.map((b) => dinBrut(b, persoane, true).net);
      for (let tinta = 3600; tinta <= 3900; tinta += 5) {
        const minim = bruturi.find((_, i) => (neturi[i] ?? 0) >= tinta);
        expect(
          dinNet(tinta, persoane, true).brut,
          `${String(persoane)} pers., ${String(tinta)}`,
        ).toBe(minim);
      }
    }
  });
});
