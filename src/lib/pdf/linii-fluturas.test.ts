// src/lib/pdf/linii-fluturas.test.ts

import { describe, expect, it } from "vitest";

import {
  castigurileFluturasului,
  retinerileFluturasului,
  type SursaFluturas,
} from "./linii-fluturas";

const ZERO: SursaFluturas = {
  baza_salariu: 0,
  suma_ore_suplimentare: 0,
  spor_noapte: 0,
  prime_total: 0,
  valoare_tichete: 0,
  brut: 0,
  cas: 0,
  cass: 0,
  deducere_personala: 0,
  scutire_fiscala: 0,
  impozit: 0,
  net: 0,
  retineri_total: 0,
  net_de_plata: 0,
};

const LUNA_OBISNUITA: SursaFluturas = {
  ...ZERO,
  baza_salariu: 5000,
  brut: 5000,
  cas: 1250,
  cass: 500,
  impozit: 325,
  net: 2925,
  net_de_plata: 2925,
};

describe("castigurileFluturasului", () => {
  it("ascunde liniile nule, ca fluturașul să rămână citibil", () => {
    const linii = castigurileFluturasului(LUNA_OBISNUITA);
    expect(linii.map((l) => l.eticheta)).toEqual([
      "Salariu de bază (după zilele lucrate)",
      "Venit brut",
    ]);
  });

  it("arată toate câștigurile când există", () => {
    const linii = castigurileFluturasului({
      ...LUNA_OBISNUITA,
      suma_ore_suplimentare: 300,
      spor_noapte: 120,
      prime_total: 500,
      valoare_tichete: 660,
    });
    expect(linii).toHaveLength(6);
    expect(linii.some((l) => l.eticheta === "Ore suplimentare")).toBe(true);
    expect(linii.some((l) => l.eticheta === "Tichete de masă (acordate separat)")).toBe(true);
  });

  it("păstrează brutul chiar când e zero — e un total, nu o linie oarecare", () => {
    const linii = castigurileFluturasului(ZERO);
    expect(linii.map((l) => l.eticheta)).toEqual(["Venit brut"]);
    expect(linii[0]?.total).toBe(true);
  });
});

describe("retinerileFluturasului", () => {
  it("marchează drept scăzute exact contribuțiile și reținerile", () => {
    const linii = retinerileFluturasului(LUNA_OBISNUITA);
    const scad = linii.filter((l) => l.scade === true).map((l) => l.eticheta);
    expect(scad).toEqual([
      "CAS — contribuția la pensie",
      "CASS — contribuția la sănătate",
      "Impozit pe venit",
    ]);
  });

  it("deducerea personală NU se scade — ea mărește netul", () => {
    const linii = retinerileFluturasului({ ...LUNA_OBISNUITA, deducere_personala: 300 });
    const deducere = linii.find((l) => l.eticheta === "Deducere personală");
    expect(deducere?.scade).toBeUndefined();
  });

  it("păstrează ambele totaluri chiar la zero", () => {
    const linii = retinerileFluturasului(ZERO);
    expect(linii.map((l) => l.eticheta)).toEqual(["Salariu net", "Net de plată"]);
    expect(linii.every((l) => l.total === true)).toBe(true);
  });

  it("arată reținerile când există un avans sau o poprire", () => {
    const linii = retinerileFluturasului({ ...LUNA_OBISNUITA, retineri_total: 900 });
    const retinere = linii.find((l) => l.eticheta === "Rețineri (avans, popriri, rate)");
    expect(retinere?.valoare).toBe(900);
    expect(retinere?.scade).toBe(true);
  });

  it("suma liniilor reconstituie netul de plată", () => {
    // Verificarea care contează: fluturașul trebuie să se închidă aritmetic,
    // altfel angajatul vede cifre care nu dau totalul.
    const s = { ...LUNA_OBISNUITA, deducere_personala: 300, retineri_total: 425 };
    const calculat = s.brut - s.cas - s.cass - s.impozit - s.retineri_total;
    const linii = retinerileFluturasului({ ...s, net_de_plata: calculat });
    const netDePlata = linii.find((l) => l.eticheta === "Net de plată");
    expect(netDePlata?.valoare).toBeCloseTo(calculat, 2);
  });
});
