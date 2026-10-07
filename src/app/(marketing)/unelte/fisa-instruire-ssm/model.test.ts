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
  it("dau minimul de o oră din art. 80¹, nu cele 8 ore abrogate în 2016", () => {
    // Auditul SEO din 7 oct 2026: pagina citea consolidarea din 2011 și dădea
    // „cel puțin 8 ore” pe fază. Art. 87 alin. (2) e abrogat prin HG 767/2016,
    // care a introdus art. 80¹: cel puțin o oră, stabilită prin programul firmei.
    const dupa = (tip: string) => INSTRUIRI_SSM.find((r) => r.tip === tip);
    for (const tip of ["Introductiv-generală", "La locul de muncă", "Suplimentară"]) {
      expect(dupa(tip)?.regula, tip).toMatch(/o oră/u);
      expect(dupa(tip)?.temei, tip).toMatch(/80¹/u);
    }
    expect(INSTRUIRI_SSM.some((r) => /8 ore/u.test(r.regula))).toBe(false);
  });

  it("spun că fișa se poate ține și în format electronic (HG 259/2022)", () => {
    const consemnarea = INSTRUIRI_SSM.find((r) => r.tip === "Consemnarea");
    expect(consemnarea?.regula).toMatch(/format electronic/u);
    expect(INSTRUIRI_SSM.some((r) => /pix|stilou/u.test(r.regula))).toBe(false);
  });
});
