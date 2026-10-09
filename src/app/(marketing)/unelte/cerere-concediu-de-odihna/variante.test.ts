import { describe, expect, it } from "vitest";

import {
  esteEveniment,
  esteTipCerere,
  EVENIMENTE,
  EVENIMENTE_ORDINE,
  SAPTAMANI_PATERNAL,
  TIPURI_CERERE,
  VARIANTE,
  ZILE_AVANS_CERERE_ODIHNA,
  ZILE_FORMARE_PLATITA,
  ZILE_FRACTIUNE_NEINTRERUPTA,
  ZILE_INGRIJITOR,
  ZILE_PATERNAL,
  ZILE_PATERNAL_PUERICULTURA,
} from "./variante";

describe("variantele cererii", () => {
  it("lista și catalogul au aceleași chei, iar fiecare variantă își spune temeiul", () => {
    expect([...TIPURI_CERERE].sort()).toEqual(Object.keys(VARIANTE).sort());
    for (const tip of TIPURI_CERERE) {
      const v = VARIANTE[tip];
      expect(v.tip, tip).toBe(tip);
      expect(v.titlu, tip).toMatch(/^Cerere de /u);
      expect(v.temei, tip).toMatch(/art\. \d+/u);
      expect(v.temei.endsWith("."), tip).toBe(true);
    }
  });

  it("soldul se cere doar acolo unde cererea consumă din concediul de odihnă", () => {
    const cuSold = TIPURI_CERERE.filter((t) => VARIANTE[t].cuSold);
    expect(cuSold).toEqual(["odihna", "reprogramare"]);
  });

  it("cheile prototipului nu sunt tipuri și nici evenimente", () => {
    for (const cheie of ["constructor", "__proto__", "toString"]) {
      expect(esteTipCerere(cheie), cheie).toBe(false);
      expect(esteEveniment(cheie), cheie).toBe(false);
    }
    expect(esteTipCerere("paternal")).toBe(true);
  });

  /*
   * Fir de declanșare, nu demonstrație: cifrele sunt citite din textul legii
   * (legislatie.just.ro, 8 oct 2026), iar o schimbare a lor trebuie să treacă
   * printr-o recitire a sursei, nu printr-o corectură de cod.
   */
  it("cifrele legale sunt cele din sursă", () => {
    expect(ZILE_PATERNAL).toBe(10); // Legea 210/1999 art. 2 alin. (1)
    expect(ZILE_PATERNAL_PUERICULTURA).toBe(5); // art. 4 alin. (1)
    expect(SAPTAMANI_PATERNAL).toBe(8); // art. 2 alin. (2)
    expect(ZILE_INGRIJITOR).toBe(5); // Codul muncii art. 152¹ alin. (1)
    expect(ZILE_FORMARE_PLATITA).toBe(10); // art. 157 alin. (1)
    expect(ZILE_FRACTIUNE_NEINTRERUPTA).toBe(10); // art. 148 alin. (5)
    expect(ZILE_AVANS_CERERE_ODIHNA).toBe(60); // art. 148 alin. (4)
    expect(EVENIMENTE_ORDINE.map((e) => EVENIMENTE[e].zileBugetar)).toEqual([5, 3, 3, 3, null]);
  });
});
