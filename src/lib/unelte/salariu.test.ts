import { describe, expect, it } from "vitest";

import {
  brutMinimLegal,
  calculeazaDinBrut,
  calculeazaDinNet,
  dinBrut,
  dinNet,
  OPTIUNI_IMPLICITE,
} from "./salariu";

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

describe("deducerea personală suplimentară (art. 77 alin. (10))", () => {
  const O = OPTIUNI_IMPLICITE;

  it("sub 26 de ani, brut 5.000: deducere 562 + 649 = 1.211, net 3.046", () => {
    // 15% × 4.325 = 648,75 → 649. Impozit (5.000 − 1.250 − 500 − 1.211) × 10% = 203,9 → 204.
    // Net 5.000 − 1.250 − 500 − 204 = 3.046 (fără deducerea suplimentară: 2.981).
    expect(calculeazaDinBrut(5000, { ...O, sub26: true })).toMatchObject({
      deducereDeBaza: 562,
      deducereSub26: 649,
      deducerePersonala: 1211,
      impozit: 204,
      net: 3046,
    });
  });

  it("sub 26 de ani se oprește la minim + 2.000: 6.325 o primește, 6.326 nu", () => {
    // 6.325: deducerea de bază e 0% (pasul 40), cea suplimentară 649. CAS 1.581,25 → 1.581,
    // CASS 632,50 → 633; impozit (6.325 − 1.581,25 − 632,5 − 649) × 10% = 346,225 → 346; net 3.765.
    expect(calculeazaDinBrut(6325, { ...O, sub26: true })).toMatchObject({
      deducereSub26: 649,
      net: 3765,
    });
    // 6.326: nicio deducere. CAS 1.581,50 → 1.582; CASS 632,60 → 633;
    // impozit (6.326 − 1.581,5 − 632,6) × 10% = 411,19 → 411; net 6.326 − 1.582 − 633 − 411 = 3.700.
    expect(calculeazaDinBrut(6326, { ...O, sub26: true })).toMatchObject({
      deducereSub26: 0,
      net: 3700,
    });
  });

  it("copiii la școală: 100 de lei pe copil, indiferent de venit — brut 8.000, un copil: net 4.690", () => {
    // Peste minim + 2.000 nu există deducere de bază. Impozit (8.000 − 2.000 − 800 − 100) × 10% = 510;
    // net 8.000 − 2.000 − 800 − 510 = 4.690 (fără copil: impozit 520, net 4.680).
    expect(calculeazaDinBrut(8000, { ...O, copiiScoala: 1 })).toMatchObject({
      deducereCopii: 100,
      net: 4690,
    });
    expect(calculeazaDinBrut(8000, O).net).toBe(4680);
  });

  it("sub 26 de ani și doi copii, brut 5.000: 1.411 lei deducere, net 3.066", () => {
    // 562 + 649 + 200 = 1.411. Impozit (5.000 − 1.250 − 500 − 1.411) × 10% = 183,9 → 184; net 3.066.
    expect(calculeazaDinBrut(5000, { ...O, sub26: true, copiiScoala: 2 })).toMatchObject({
      deducerePersonala: 1411,
      net: 3066,
    });
  });

  it("în afara funcției de bază, nicio deducere — nici cea suplimentară (alin. (1))", () => {
    // 4.325 fără facilitate (cere funcția de bază): CAS 1.081,25 → 1.081; CASS 432,50 → 433;
    // impozit (4.325 − 1.081,25 − 432,5) × 10% = 281,125 → 281; net 4.325 − 1.081 − 433 − 281 = 2.530.
    expect(
      calculeazaDinBrut(4325, { ...O, functieDeBaza: false, sub26: true, copiiScoala: 3 }),
    ).toMatchObject({ deducerePersonala: 0, deducereSub26: 0, deducereCopii: 0, net: 2530 });
  });

  it("deducerea afișată nu trece de venitul impozabil (art. 77 alin. (2))", () => {
    // 1.000 brut, 4 persoane: grila dă 45% × 4.325 = 1.946,25 → 1.946, dar venitul după CAS (250)
    // și CASS (100) e 650. Impozitul e 0 oricum; acum și cifra afișată e 650.
    expect(calculeazaDinBrut(1000, { ...O, persoane: 4 })).toMatchObject({
      deducereDeBaza: 1946,
      deducerePersonala: 650,
      impozit: 0,
      net: 650,
    });
  });

  it("⚠ comportamentul de azi, de confirmat (NOTES.md §3): CAS și CASS NErotunjite în baza de impozit", () => {
    // 4.453: deducere pasul 3, 18,5% × 4.325 = 800,125 → 800. (4.453 − 1.113,25 − 445,30 − 800) × 10%
    // = 209,445 → 209. Cu CAS și CASS rotunjite întâi: 209,5 → 210. O schimbare trebuie să fie deliberată.
    expect(dinBrut(4453, 0, true).impozit).toBe(209);
  });

  it("⚠ comportamentul de azi, de confirmat: 18% × 4.325 = 778,50 se rotunjește în sus, la 779", () => {
    expect(dinBrut(4500, 0, true).deducerePersonala).toBe(779);
  });
});

describe("tichetele de masă", () => {
  const O = OPTIUNI_IMPLICITE;
  const T = { valoare: 45, numar: 20 };

  it("brut 5.000 și 20 × 45 lei: CASS și impozit pe tichete, CAS și CAM nu — net 2.771, cost 6.013", () => {
    // Tichete 900. CAS 25% × 5.000 = 1.250 (art. 142 lit. r): fără tichete). CASS 10% × 5.900 = 590
    // (art. 157 alin. (1) lit. ț)). Deducerea pe venitul de 5.900 (⚠ tichetele incluse): minim + 1.575,
    // pasul 32, 4% × 4.325 = 173. Impozit (5.000 − 1.250 − 590 − 173 + 900) × 10% = 388,7 → 389.
    // Net în cont 5.000 − 1.250 − 590 − 389 = 2.771. CAM 2,25% × 5.000 = 112,50 → 113, fără tichete
    // (art. 220^4 alin. (2)). Cost 5.000 + 113 + 900 = 6.013.
    expect(calculeazaDinBrut(5000, { ...O, tichete: T })).toMatchObject({
      tichete: 900,
      cas: 1250,
      cass: 590,
      deducerePersonala: 173,
      impozit: 389,
      net: 2771,
      cam: 113,
      costTotal: 6013,
    });
  });

  it("la salariul minim, tichetele nu strică facilitatea: plafonul OUG 89 le exclude", () => {
    // Baza 4.125. CAS 1.031,25 → 1.031. CASS 10% × (4.125 + 900) = 502,50 → 503.
    // Deducerea pe 5.225: pasul 18, 11% × 4.325 = 475,75 → 476.
    // Impozit (4.125 − 1.031,25 − 502,5 − 476 + 900) × 10% = 301,525 → 302.
    // Net 4.125 − 1.031 − 503 − 302 + 200 = 2.489. CAM 2,25% × 4.125 = 92,81 → 93; cost 4.325 + 93 + 900 = 5.318.
    expect(calculeazaDinBrut(4325, { ...O, tichete: T })).toMatchObject({
      sumaNeimpozabila: 200,
      cass: 503,
      deducerePersonala: 476,
      impozit: 302,
      net: 2489,
      costTotal: 5318,
    });
  });

  it("tichete cu bani: 21 × 40,18 = 843,78 lei, la ban", () => {
    expect(calculeazaDinBrut(5000, { ...O, tichete: { valoare: 40.18, numar: 21 } }).tichete).toBe(
      843.78,
    );
  });

  it("net → brut ține cont de tichete: 2.771 în cont cere 5.000 brut", () => {
    expect(calculeazaDinNet(2771, { ...O, tichete: T })?.rezultat.brut).toBe(5000);
  });

  it("cu tichete, pragul deducerii coboară în brut: 4 persoane, 20 × 45 lei — cel mai mic brut, pe toată plaja", () => {
    // Venitul grilei e brut + 900, deci deducerea dispare la 5.426 de lei brut, nu la 6.326:
    // netul cade de la 3.110 (5.425) la 3.002 (5.426). Cu pragul socotit fără tichete, simularea a dat 50 de ținte
    // greșite între 2.900 și 3.400; de exemplu, 3.062 întorcea 5.527 în loc de 5.339.
    const o = { ...O, persoane: 4, tichete: T };
    const bruturi = Array.from({ length: 2400 }, (_, i) => 4325 + i);
    const neturi = bruturi.map((b) => calculeazaDinBrut(b, o).net);
    for (let tinta = 2900; tinta <= 3400; tinta += 7) {
      const minim = bruturi.find((_, i) => (neturi[i] ?? 0) >= tinta);
      expect(calculeazaDinNet(tinta, o)?.rezultat.brut, String(tinta)).toBe(minim);
    }
    // Chiar sub prag, rotunjirea mută netul cu un leu. 5.424: CASS (5.424 + 900) × 10% = 632,40 → 632,
    // impozit (5.424 − 1.356 − 632,4 − 1.081 + 900) × 10% = 325,46 → 325, net 3.111.
    // 5.425: CASS 632,50 → 633, impozit 325,525 → 326, net 3.110. Pentru 3.111, răspunsul e 5.424.
    expect(calculeazaDinNet(3111, o)?.rezultat.brut).toBe(5424);
  });

  it("valoare fără număr sau număr fără valoare înseamnă fără tichete", () => {
    expect(calculeazaDinBrut(5000, { ...O, tichete: { valoare: 45, numar: 0 } }).net).toBe(2981);
    expect(calculeazaDinBrut(5000, { ...O, tichete: { valoare: 0, numar: 20 } }).net).toBe(2981);
  });

  it("tichete de 23 × 100 de lei: pragul deducerii (4.025) cade sub minim, iar net → brut rămâne legal și minim", () => {
    // Review Focus 5: fereastra de cinci lei de sub prag cade sub minimul legal.
    const o = { ...O, persoane: 4, tichete: { valoare: 100, numar: 23 } };
    const bruturi = Array.from({ length: 4000 }, (_, i) => 4325 + i);
    const neturi = bruturi.map((b) => calculeazaDinBrut(b, o).net);
    for (let tinta = 2000; tinta <= 4000; tinta += 37) {
      const minim = bruturi.find((_, i) => (neturi[i] ?? 0) >= tinta);
      expect(calculeazaDinNet(tinta, o)?.rezultat.brut, String(tinta)).toBe(minim);
    }
  });
});

describe("timpul parțial și contribuția minimă (Codul fiscal art. 146 alin. (5^6)–(5^9))", () => {
  const P4 = { ...OPTIUNI_IMPLICITE, oreZi: 4 };

  it("4 ore, brut 2.163: angajatul plătește pe brut, firma diferența până la 4.125 — cost 2.899", () => {
    // Fără sumă scutită (cere normă întreagă). CAS 25% × 2.163 = 540,75 → 541; CASS 216,30 → 216.
    // Deducere 20% × 4.325 = 865. Impozit (2.163 − 540,75 − 216,3 − 865) × 10% = 54,095 → 54.
    // Net 2.163 − 541 − 216 − 54 = 1.352.
    // Baza minimă 4.325 − 200 = 4.125: CAS minim 1.031,25 → 1.031, CASS minim 412,50 → 413.
    // Firma: 1.031 − 541 = 490 și 413 − 216 = 197 (alin. (5^9)). CAM 2,25% × 2.163 = 48,67 → 49.
    // Cost 2.163 + 49 + 490 + 197 = 2.899.
    expect(calculeazaDinBrut(2163, P4)).toMatchObject({
      sumaNeimpozabila: 0,
      cas: 541,
      cass: 216,
      impozit: 54,
      net: 1352,
      casSuportatAngajator: 490,
      cassSuportatAngajator: 197,
      cam: 49,
      costTotal: 2899,
    });
  });

  it("cu o excepție din alin. (5^7), firma nu mai plătește diferența: cost 2.212", () => {
    expect(calculeazaDinBrut(2163, { ...P4, contributieMinima: false })).toMatchObject({
      net: 1352,
      casSuportatAngajator: 0,
      cassSuportatAngajator: 0,
      costTotal: 2212,
    });
  });

  it("în ianuarie–iunie, baza minimă e 3.750: la 2.025 brut, 4 ore, firma plătește 432 + 172", () => {
    // CAS 506,25 → 506; CASS 202,50 → 203. Minim: 25% × 3.750 = 937,50 → 938; 10% × 3.750 = 375.
    // Diferențe 938 − 506 = 432 și 375 − 203 = 172. Impozit (2.025 − 506,25 − 202,5 − 810) × 10%
    // = 50,625 → 51; net 2.025 − 506 − 203 − 51 = 1.265. CAM 45,56 → 46; cost 2.025 + 46 + 432 + 172 = 2.675.
    expect(calculeazaDinBrut(2025, { ...P4, perioada: "2026-1" })).toMatchObject({
      casSuportatAngajator: 432,
      cassSuportatAngajator: 172,
      net: 1265,
      costTotal: 2675,
    });
  });

  it("la timp parțial, 4.325 nu primește suma scutită: net 2.616", () => {
    // CAS 1.081,25 → 1.081; CASS 432,50 → 433; impozit (4.325 − 1.081,25 − 432,5 − 865) × 10% = 194,625 → 195;
    // net 4.325 − 1.081 − 433 − 195 = 2.616 (la normă întreagă: 2.699).
    expect(calculeazaDinBrut(4325, P4)).toMatchObject({
      sumaNeimpozabila: 0,
      net: 2616,
      casSuportatAngajator: 0,
    });
  });

  it("brutul minim legal e proporțional cu norma, rotunjit în sus la leu", () => {
    expect(brutMinimLegal(P4)).toBe(2163); // 4.325 × 4 / 8 = 2.162,50
    expect(brutMinimLegal({ ...OPTIUNI_IMPLICITE, oreZi: 6 })).toBe(3244); // 3.243,75
    expect(brutMinimLegal({ ...P4, perioada: "2026-1" })).toBe(2025);
    expect(brutMinimLegal(OPTIUNI_IMPLICITE)).toBe(4325);
  });

  it("net → brut la 4 ore nu coboară sub 2.163", () => {
    expect(calculeazaDinNet(1000, P4)).toMatchObject({
      ridicatLaMinim: true,
      rezultat: { brut: 2163, net: 1352 },
    });
    expect(calculeazaDinNet(1353, P4)?.rezultat.brut).toBe(2164);
  });

  it("la normă întreagă, peste minim, firma nu plătește nicio diferență", () => {
    for (const b of [4325, 4326, 5000]) {
      expect(calculeazaDinBrut(b, OPTIUNI_IMPLICITE).casSuportatAngajator, String(b)).toBe(0);
      expect(calculeazaDinBrut(b, OPTIUNI_IMPLICITE).cassSuportatAngajator, String(b)).toBe(0);
    }
  });

  it("4 ore, brut 2.163 și 20 × 45 lei tichete: firma plătește 490 la CAS, dar doar 107 la CASS", () => {
    // Review Focus 4. CAS 541 (fără tichete); CASS (2.163 + 900) × 10% = 306,30 → 306. Deducerea pe 3.063: 865.
    // Impozit (2.163 − 540,75 − 306,3 − 865 + 900) × 10% = 135,095 → 135; net 2.163 − 541 − 306 − 135 = 1.181.
    // Firma: 1.031 − 541 = 490 și 413 − 306 = 107. Cost 2.163 + 49 + 900 + 490 + 107 = 3.709.
    expect(
      calculeazaDinBrut(2163, {
        ...OPTIUNI_IMPLICITE,
        oreZi: 4,
        tichete: { valoare: 45, numar: 20 },
      }),
    ).toMatchObject({
      net: 1181,
      casSuportatAngajator: 490,
      cassSuportatAngajator: 107,
      costTotal: 3709,
    });
  });
});
