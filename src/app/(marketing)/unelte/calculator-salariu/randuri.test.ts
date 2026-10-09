import { describe, expect, it } from "vitest";

import { calculeazaDinBrut, dinBrut, OPTIUNI_IMPLICITE } from "@/lib/unelte/salariu";

import { impartireaCostului, randuriDesfasurator } from "./randuri";

const suma = (randuri: readonly { valoare: number; fel: string }[], fel: string) =>
  randuri.filter((r) => r.fel === fel).reduce((s, r) => s + r.valoare, 0);

describe("rândurile desfășurătorului", () => {
  it("la angajat se închid cu creionul: brut − ce se scade = net", () => {
    for (const brut of [4325, 4500, 5000, 6000, 10000]) {
      const r = dinBrut(brut, 0, true);
      const { angajat } = randuriDesfasurator(r);
      expect(r.brut - suma(angajat, "minus"), String(brut)).toBe(r.net);
      expect(angajat.at(-1)).toEqual({ eticheta: "Salariu net", valoare: r.net, fel: "total" });
    }
  });

  it("la firmă se închid pe cost: brut + CAM = cost total", () => {
    const r = dinBrut(5000, 0, true);
    const { angajator } = randuriDesfasurator(r);
    expect(suma(angajator, "plus")).toBe(r.costTotal);
    expect(angajator.at(-1)?.eticheta).toBe("Cost total pentru firmă");
  });

  it("suma neimpozabilă apare doar la salariul minim", () => {
    const eticheta = "Din care neimpozabil (OUG 89/2025)";
    const laMinim = randuriDesfasurator(dinBrut(4325, 0, true)).angajat.map((x) => x.eticheta);
    const pesteMinim = randuriDesfasurator(dinBrut(4326, 0, true)).angajat.map((x) => x.eticheta);
    expect(laMinim).toContain(eticheta);
    expect(pesteMinim).not.toContain(eticheta);
  });

  it("deducerile suplimentare apar pe rânduri, iar totalul plafonat spune că e plafonat", () => {
    const r = calculeazaDinBrut(5000, { ...OPTIUNI_IMPLICITE, sub26: true, copiiScoala: 2 });
    const randuri = randuriDesfasurator(r).angajat.map((x) => [x.eticheta, x.valoare]);
    expect(randuri).toContainEqual(["Deducere de bază", 562]);
    expect(randuri).toContainEqual(["Deducere sub 26 de ani", 649]);
    expect(randuri).toContainEqual(["Deducere pentru copiii înscriși la școală", 200]);
    expect(randuri).toContainEqual(["Deducere personală, total", 1411]);
    const mic = calculeazaDinBrut(1000, { ...OPTIUNI_IMPLICITE, persoane: 4 });
    expect(randuriDesfasurator(mic).angajat.map((x) => [x.eticheta, x.valoare])).toContainEqual([
      "Deducere personală, în limita venitului",
      650,
    ]);
  });

  it("cu tichete, ambele desfășurătoare se închid, iar tichetele apar pe card și în cost", () => {
    const r = calculeazaDinBrut(5000, {
      ...OPTIUNI_IMPLICITE,
      tichete: { valoare: 45, numar: 20 },
    });
    const { angajat, angajator } = randuriDesfasurator(r);
    expect(r.brut - suma(angajat, "minus")).toBe(r.net);
    expect(suma(angajator, "plus")).toBe(r.costTotal);
    expect(angajat.map((x) => [x.eticheta, x.valoare])).toContainEqual([
      "Tichete de masă, pe card",
      900,
    ]);
    expect(angajat.map((x) => [x.eticheta, x.valoare])).toContainEqual([
      "Net și tichete, împreună",
      3671,
    ]);
    expect(angajator.map((x) => x.eticheta)).toContain("Tichete de masă");
  });

  it("la timp parțial, diferențele plătite de firmă apar în cost și desfășurătorul se închide", () => {
    const r = calculeazaDinBrut(2163, { ...OPTIUNI_IMPLICITE, oreZi: 4 });
    const { angajator } = randuriDesfasurator(r);
    expect(suma(angajator, "plus")).toBe(r.costTotal);
    expect(angajator.map((x) => [x.eticheta, x.valoare])).toContainEqual([
      "CAS până la baza minimă, plătit de firmă",
      490,
    ]);
    expect(angajator.map((x) => [x.eticheta, x.valoare])).toContainEqual([
      "CASS până la baza minimă, plătit de firmă",
      197,
    ]);
  });

  it("impozitul scutit spune temeiul", () => {
    const r = calculeazaDinBrut(5000, { ...OPTIUNI_IMPLICITE, scutitImpozit: true });
    expect(randuriDesfasurator(r).angajat.map((x) => [x.eticheta, x.valoare])).toContainEqual([
      "Impozit pe venit — scutit, Codul fiscal art. 60 pct. 1",
      0,
    ]);
  });
});

describe("împărțirea costului firmei", () => {
  it("5.000 brut: din 100 de lei, 58 ajung la angajat, 42 la stat", () => {
    // 2.981 / 5.113 = 58,3% → 58; statul = 100 − 58 = 42.
    expect(impartireaCostului(dinBrut(5000, 0, true))).toEqual({ net: 58, tichete: 0, stat: 42 });
  });

  it("la salariul minim, 61 / 39", () => {
    // 2.699 / 4.418 = 61,09% → 61.
    expect(impartireaCostului(dinBrut(4325, 0, true))).toEqual({ net: 61, tichete: 0, stat: 39 });
  });

  it("cu tichete, cele trei părți fac tot 100", () => {
    // Net 2.771, tichete 900, cost 6.013: 46,08% → 46; 14,97% → 15; statul 39.
    const r = calculeazaDinBrut(5000, {
      ...OPTIUNI_IMPLICITE,
      tichete: { valoare: 45, numar: 20 },
    });
    expect(impartireaCostului(r)).toEqual({ net: 46, tichete: 15, stat: 39 });
  });
});
