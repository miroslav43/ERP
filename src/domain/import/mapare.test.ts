// src/domain/import/mapare.test.ts
import { describe, expect, it } from "vitest";
import { mapeazaColoane, normalizeazaAntet } from "./mapare";

describe("normalizeazaAntet", () => {
  it("elimină diacriticele cu virgulă și cu sedilă deopotrivă", () => {
    expect(normalizeazaAntet("Data Nașterii")).toBe("data nasterii");
    expect(normalizeazaAntet("Data Naşterii")).toBe("data nasterii");
  });

  it("colapsează spațiile și punctuația", () => {
    expect(normalizeazaAntet("  NUME   ȘI  PRENUME ")).toBe("nume si prenume");
    expect(normalizeazaAntet("Nr. contract")).toBe("nr contract");
  });
});

describe("mapeazaColoane", () => {
  it("acceptă denumiri diferite pentru același câmp", () => {
    for (const varianta of ["Nume", "NUMELE", "nume de familie"]) {
      expect(
        mapeazaColoane(["Marca", varianta, "Prenume", "Data angajarii"]).dupaCamp.get("nume"),
      ).toBe(varianta);
    }
  });

  it("recunoaște numele complet ca alternativă la nume + prenume", () => {
    const rezultat = mapeazaColoane(["Marca", "NUME ȘI PRENUME", "Data angajării"]);
    expect(rezultat.dupaCamp.get("nume_complet")).toBe("NUME ȘI PRENUME");
    expect(rezultat.campuriLipsa).toEqual([]);
  });

  it("semnalează lipsa numelui când nu există nici nume complet, nici nume + prenume", () => {
    const rezultat = mapeazaColoane(["Marca", "Nume", "Data angajării"]);
    expect(rezultat.campuriLipsa).toContain("nume_complet");
  });

  it("semnalează coloanele obligatorii absente", () => {
    expect(mapeazaColoane(["Nume complet"]).campuriLipsa).toEqual(
      expect.arrayContaining(["data_angajarii"]),
    );
  });

  it("marca NU mai e obligatorie — contorul o atribuie când lipsește", () => {
    // Schimbat în 0069. Cerând-o, importul avea un regim de numerotare paralel
    // cu `urmatoarea_marca`, iar contorul rămânea în urmă: un import de
    // 0001–0200 urmat de o înrolare producea „0001" a doua oară.
    expect(mapeazaColoane(["Nume complet", "Data angajării"]).campuriLipsa).not.toContain("marca");
  });

  it("ignoră coloanele necunoscute și duplicatele, păstrând prima potrivire", () => {
    const rezultat = mapeazaColoane([
      "Marca",
      "Nume complet",
      "Data angajarii",
      "Observatii interne",
      "marca",
    ]);
    expect(rezultat.dupaCamp.get("marca")).toBe("Marca");
    expect(rezultat.coloaneIgnorate).toEqual(["Observatii interne", "marca"]);
  });
});
