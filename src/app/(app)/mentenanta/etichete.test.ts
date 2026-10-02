// src/app/(app)/mentenanta/etichete.test.ts
//
// Formatările modulului de mentenanță — contoare, periodicitate, numărul cu
// substantivul lui — și etichetele/tonurile. Completitudinea pe enum o impune
// deja `Record<Enum, …>` la tsc; aici rămân textul (nevid, fără sedilă,
// distinct) și tonurile ca invarianți, nu recopiate valoare cu valoare.

import { describe, expect, it } from "vitest";

import {
  REZULTATE_INTERVENTIE,
  STATUS_ECHIPAMENT,
  STATUSURI_SESIZARE,
  TIPURI_CONTOR,
  TIPURI_MENTENANTA,
  URGENTE_SESIZARE,
} from "@/schemas/maintenance";

import {
  ETICHETE_REZULTAT_INTERVENTIE,
  ETICHETE_STARE_SCADENTA,
  ETICHETE_STATUS_ECHIPAMENT,
  ETICHETE_STATUS_SESIZARE,
  ETICHETE_TIP_CONTOR,
  ETICHETE_TIP_MENTENANTA,
  ETICHETE_URGENTA_SESIZARE,
  formatCifraContor,
  formatContor,
  formatPeriodicitate,
  textNumarat,
  TONURI_REZULTAT_INTERVENTIE,
  TONURI_STATUS_ECHIPAMENT,
  TONURI_STATUS_SESIZARE,
  TONURI_URGENTA_SESIZARE,
  UNITATI_CONTOR,
} from "./etichete";

const SEDILA = /[ŞşŢţ]/u;

describe("formatContor", () => {
  it.each([
    [1284, "ore", "1.284 ore"],
    [12840, "km", "12.840 km"],
    [0, "cicluri", "0 cicluri"],
    [1284.567, "ore", "1.284,57 ore"],
    [1284.5, "km", "1.284,5 km"],
    [1500000, "km", "1.500.000 km"],
  ] as const)("%s %s ⇒ „%s” (separator de mii, zecimale doar dacă există)", (v, tip, text) => {
    expect(formatContor(v, tip)).toBe(text);
  });
});

describe("formatCifraContor", () => {
  it.each([
    [1284, "1.284"],
    [7, "7"],
    [0.125, "0,13"],
    [10000.1, "10.000,1"],
  ])("%s ⇒ „%s”, fără unitate", (v, text) => {
    expect(formatCifraContor(v)).toBe(text);
  });
});

describe("formatPeriodicitate", () => {
  it.each([
    [{ periodicitate_zile: null, periodicitate_contor: 500, tip_contor: "ore" }, "La 500 ore"],
    [{ periodicitate_zile: null, periodicitate_contor: 1250.5, tip_contor: "km" }, "La 1.250,5 km"],
    [{ periodicitate_zile: null, periodicitate_contor: null, tip_contor: null }, "—"],
    // Contor fără tip: nu se poate scrie unitatea, deci nu se scrie deloc.
    [{ periodicitate_zile: null, periodicitate_contor: 500, tip_contor: null }, "—"],
  ] as const)("%j ⇒ „%s”", (plan, text) => {
    expect(formatPeriodicitate(plan)).toBe(text);
  });

  it("ambele periodicități: zilele întâi, contorul după, despărțite de „ · ”", () => {
    const text = formatPeriodicitate({
      periodicitate_zile: 7,
      periodicitate_contor: 10000,
      tip_contor: "km",
    });
    const [zile, contor, ...rest] = text.split(" · ");
    expect(rest).toEqual([]);
    expect(zile).toMatch(/^La 7 zile$/u);
    expect(contor).toBe("La 10.000 km");
  });

  it("zile + contor fără tip: rămân doar zilele", () => {
    const text = formatPeriodicitate({
      periodicitate_zile: 7,
      periodicitate_contor: 500,
      tip_contor: null,
    });
    expect(text).not.toContain("·");
    expect(text).not.toContain("500");
    expect(text).toMatch(/^La 7 /u);
  });

  it("zilele urmează regula de numărare a modulului („La 1 zi”, „La 30 de zile”)", () => {
    // `textNumarat`, din același fișier, există tocmai pentru „1 planuri” și
    // „3 de planuri”; periodicitatea lipește „zile” fix, oricare ar fi cifra.
    const doar = (zile: number) =>
      formatPeriodicitate({
        periodicitate_zile: zile,
        periodicitate_contor: null,
        tip_contor: null,
      });
    expect(doar(1)).toBe("La 1 zi");
    expect(doar(30)).toBe("La 30 de zile");
    expect(doar(14)).toBe("La 14 zile");
  });
});

describe("textNumarat", () => {
  it.each([
    [0, "0 planuri"],
    [1, "1 plan"],
    [2, "2 planuri"],
    [19, "19 planuri"],
    [20, "20 de planuri"],
    [21, "21 de planuri"],
    [99, "99 de planuri"],
    [100, "100 de planuri"],
    [101, "101 planuri"],
    [119, "119 planuri"],
    [120, "120 de planuri"],
    [1000, "1.000 de planuri"],
    [1001, "1.001 planuri"],
    [1019, "1.019 planuri"],
    [-1, "-1 plan"],
    [-25, "-25 de planuri"],
  ])("%s ⇒ „%s” (regula lui „de” după ultimele două cifre)", (n, text) => {
    expect(textNumarat(n, "plan", "planuri")).toBe(text);
  });
});

describe("etichetele", () => {
  it.each([
    ["status echipament", STATUS_ECHIPAMENT, ETICHETE_STATUS_ECHIPAMENT],
    ["tonuri status echipament", STATUS_ECHIPAMENT, TONURI_STATUS_ECHIPAMENT],
    ["tip contor", TIPURI_CONTOR, ETICHETE_TIP_CONTOR],
    ["unități contor", TIPURI_CONTOR, UNITATI_CONTOR],
    ["tip mentenanță", TIPURI_MENTENANTA, ETICHETE_TIP_MENTENANTA],
    ["rezultat intervenție", REZULTATE_INTERVENTIE, ETICHETE_REZULTAT_INTERVENTIE],
    ["tonuri rezultat", REZULTATE_INTERVENTIE, TONURI_REZULTAT_INTERVENTIE],
    ["urgență", URGENTE_SESIZARE, ETICHETE_URGENTA_SESIZARE],
    ["tonuri urgență", URGENTE_SESIZARE, TONURI_URGENTA_SESIZARE],
    ["status sesizare", STATUSURI_SESIZARE, ETICHETE_STATUS_SESIZARE],
    ["tonuri status sesizare", STATUSURI_SESIZARE, TONURI_STATUS_SESIZARE],
  ] as const)("%s: fiecare valoare are text nevid, fără sedilă", (_n, valori, harta) => {
    for (const valoare of valori) {
      const text = (harta as Readonly<Record<string, string>>)[valoare] ?? "";
      expect(text.trim().length).toBeGreaterThan(0);
      expect(text).not.toMatch(SEDILA);
    }
  });

  it("stările de scadență au cuvinte distincte", () => {
    const texte = Object.values(ETICHETE_STARE_SCADENTA);
    expect(Object.keys(ETICHETE_STARE_SCADENTA).sort()).toEqual(
      ["fara_scadenta", "in_intarziere", "in_regula", "scadenta_apropiata"].sort(),
    );
    expect(new Set(texte).size).toBe(texte.length);
  });
});

describe("tonurile", () => {
  it("urgența e o scară: niciun „succes” pe ea, doar critica e pericol", () => {
    expect(Object.values(TONURI_URGENTA_SESIZARE)).not.toContain("succes");
    expect(TONURI_URGENTA_SESIZARE.critica).toBe("pericol");
    expect(TONURI_URGENTA_SESIZARE.scazuta).toBe("neutru");
  });

  it("succesul sesizării e numai „rezolvat”; „în lucru” rămâne atenție", () => {
    const deSucces = STATUSURI_SESIZARE.filter((s) => TONURI_STATUS_SESIZARE[s] === "succes");
    expect(deSucces).toEqual(["rezolvat"]);
    expect(TONURI_STATUS_SESIZARE.in_lucru).toBe("atentie");
    expect(TONURI_STATUS_SESIZARE.respins).toBe("pericol");
  });

  it("intervenția: doar reușita e succes, doar eșuata e pericol, cea parțială cere atenție", () => {
    const pe = (ton: string) =>
      REZULTATE_INTERVENTIE.filter((r) => TONURI_REZULTAT_INTERVENTIE[r] === ton);
    expect(pe("succes")).toEqual(["reusita"]);
    expect(pe("pericol")).toEqual(["esuata"]);
    expect(TONURI_REZULTAT_INTERVENTIE.partiala).toBe("atentie");
  });

  it("echipamentul în reparație cere atenție, nu e o reușită", () => {
    expect(TONURI_STATUS_ECHIPAMENT.in_reparatie).toBe("atentie");
    expect(TONURI_STATUS_ECHIPAMENT.in_functiune).toBe("succes");
  });
});
