import { describe, expect, it } from "vitest";

import { construiesteFisaSsm, fisaSsmDinParametri, INSTRUIRI_SSM } from "./model";

describe("fișa individuală de instruire SSM", () => {
  it("are antetul din anexa 11 la HG 1425/2006, cu datele lucrătorului completate", () => {
    const d = construiesteFisaSsm({
      nume: "Popa Ion",
      functie: "Electrician",
      locMunca: "Șantier Cluj",
      firma: "Exemplu SRL",
    });
    const etichete = d.campuri.map((c) => c.eticheta);
    for (const e of ["Numele și prenumele", "Funcția", "Locul de muncă", "Calificarea"]) {
      expect(etichete).toContain(e);
    }
    expect(d.campuri).toContainEqual({ eticheta: "Numele și prenumele", valoare: "Popa Ion" });
    expect(d.subtitlu).toBe("Întreprinderea/unitatea: Exemplu SRL");
  });

  it("consemnează instruirea la angajare și tabelul de instruiri cu cele trei semnături", () => {
    const d = construiesteFisaSsm({ nume: "", functie: "", locMunca: "", firma: "" });
    expect(d.paragrafe.join(" ")).toMatch(/introductiv-generală/u);
    expect(d.paragrafe.join(" ")).toMatch(/la locul de muncă/u);
    expect(d.paragrafe.join(" ")).toMatch(/Admis la lucru/u);
    const coloane = d.coloane.map((c) => c.eticheta.replace(/\n/gu, " "));
    expect(coloane).toContain("Semnătura celui instruit");
    expect(coloane).toContain("Semnătura celui care a instruit");
    expect(coloane).toContain("Semnătura celui care a verificat");
    expect(d.randuri.length).toBeGreaterThanOrEqual(12);
    expect(d.randuri.some((r) => r[0] === "Suplimentară")).toBe(true);
  });

  it("taie câmpurile la 120 de caractere", () => {
    const d = fisaSsmDinParametri(new URLSearchParams({ nume: "x".repeat(300) }));
    expect(d.campuri.find((c) => c.eticheta === "Numele și prenumele")?.valoare).toHaveLength(120);
  });
});

describe("regulile afișate pe pagină", () => {
  it("dau minimul de 8 ore la toate trei instruirile care îl au în norme", () => {
    // Revizuirea finală: pagina dădea 8 ore doar la introductiv-generală, deși
    // art. 92 alin. (2) și art. 99 îl cer și la locul de muncă și la suplimentară.
    const dupa = (tip: string) => INSTRUIRI_SSM.find((r) => r.tip === tip);
    expect(dupa("Introductiv-generală")?.regula).toMatch(/8 ore/u);
    expect(dupa("La locul de muncă")?.regula).toMatch(/8 ore/u);
    expect(dupa("La locul de muncă")?.temei).toBe("art. 92 alin. (2)");
    expect(dupa("Suplimentară")?.regula).toMatch(/8 ore/u);
    expect(dupa("Suplimentară")?.temei).toBe("art. 98 și 99");
  });
});
