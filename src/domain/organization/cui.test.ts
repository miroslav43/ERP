// src/domain/organization/cui.test.ts
import { describe, expect, it } from "vitest";
import {
  areCifraControlValida,
  calculeazaCifraControl,
  formateazaCui,
  normalizeazaCui,
  validateazaCui,
} from "./cui";

// CUI-uri reale, verificate manual cu algoritmul oficial.
const CUI_VALIDE = ["14399840", "5022670", "13548146", "19"] as const;
const CUI_INVALIDE = ["14399841", "5022671", "13548147", "18"] as const;

describe("normalizeazaCui", () => {
  it("elimină prefixul RO, spațiile, punctele și cratimele", () => {
    expect(normalizeazaCui("RO 14 399 840")).toBe("14399840");
    expect(normalizeazaCui("ro14.399.840")).toBe("14399840");
    expect(normalizeazaCui(" 14399840 ")).toBe("14399840");
    expect(normalizeazaCui("RO-5022670")).toBe("5022670");
  });

  it("întoarce șir gol pentru intrare fără cifre", () => {
    expect(normalizeazaCui("RO")).toBe("");
    expect(normalizeazaCui("   ")).toBe("");
  });
});

describe("calculeazaCifraControl", () => {
  it("aliniază la dreapta pe 9 poziții", () => {
    expect(calculeazaCifraControl("1439984")).toBe(0);
    expect(calculeazaCifraControl("502267")).toBe(0);
    expect(calculeazaCifraControl("1354814")).toBe(6);
    expect(calculeazaCifraControl("1")).toBe(9);
  });
});

describe("areCifraControlValida", () => {
  it.each(CUI_VALIDE)("acceptă %s", (cui) => {
    expect(areCifraControlValida(cui)).toBe(true);
  });

  it.each(CUI_INVALIDE)("respinge %s", (cui) => {
    expect(areCifraControlValida(cui)).toBe(false);
  });
});

describe("validateazaCui", () => {
  it("acceptă formatul cu prefix și spații și normalizează", () => {
    const rezultat = validateazaCui("RO 14 399 840");
    expect(rezultat.valid).toBe(true);
    if (rezultat.valid) expect(rezultat.normalizat).toBe("14399840");
  });

  it("semnalează câmpul gol", () => {
    const rezultat = validateazaCui("   ");
    expect(rezultat).toMatchObject({ valid: false, motiv: "gol" });
  });

  it("semnalează caractere nepermise", () => {
    const rezultat = validateazaCui("RO14A99840");
    expect(rezultat).toMatchObject({ valid: false, motiv: "caractere" });
  });

  it("semnalează lungimea greșită", () => {
    expect(validateazaCui("9")).toMatchObject({ valid: false, motiv: "lungime" });
    expect(validateazaCui("12345678901")).toMatchObject({ valid: false, motiv: "lungime" });
  });

  it("semnalează cifra de control greșită", () => {
    const rezultat = validateazaCui("14399841");
    expect(rezultat).toMatchObject({ valid: false, motiv: "cifra_control" });
    if (!rezultat.valid) expect(rezultat.mesaj).toContain("cifra de control");
  });
});

describe("formateazaCui", () => {
  it("adaugă prefixul RO doar pentru plătitorii de TVA", () => {
    expect(formateazaCui("14399840", true)).toBe("RO 14399840");
    expect(formateazaCui("14399840", false)).toBe("14399840");
  });
});
