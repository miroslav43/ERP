// src/app/(marketing)/unelte/adeverinta-salariat/model.test.ts
import { describe, expect, it } from "vitest";

import { constructorPentru } from "@/lib/unelte/registru";

import { INTREBARI_ADEVERINTA } from "./intrebari";
import { citesteAdeverinta, citesteSuma, construiesteAdeverinta } from "./model";

const AZI = "2026-10-08";
const citeste = (s: string) => citesteAdeverinta(new URLSearchParams(s), AZI);
const corp = (s: string) => construiesteAdeverinta(citeste(s).parametri).paragrafe.join("\n");

describe("citesteSuma: cum scrie un român", () => {
  it.each([
    ["4.325", 4325],
    ["4325", 4325],
    ["4 325", 4325],
    ["4.325,50", 4325.5],
    ["4325,5", 4325.5],
    ["4325.50", 4325.5],
    ["5.000 lei", 5000],
  ])("„%s” → %d", (brut, asteptat) => {
    expect(citesteSuma(brut)).toBe(asteptat);
  });

  it.each(["", "abc", "4,325,00", "-100", "0", "1.000.000"])("„%s” → null", (brut) => {
    expect(citesteSuma(brut)).toBeNull();
  });
});

describe("citesteAdeverinta", () => {
  it("fără nimic: normă întreagă, durată nedeterminată, fără salariu, emisă azi", () => {
    expect(citeste("").parametri).toEqual({
      firma: "",
      cui: "",
      nr: "",
      nume: "",
      functie: "",
      angajare: "",
      durata: "nedeterminata",
      ore: 8,
      salariu: null,
      scop: "",
      emitere: AZI,
    });
  });

  it("data angajării poate fi veche, dar nu în viitor și nu inexistentă", () => {
    expect(citeste("angajare=2011-05-02").parametri.angajare).toBe("2011-05-02");
    expect(citeste("angajare=2027-01-01").avertismente).toEqual([
      "Data angajării: „2027-01-01” nu e o zi reală între 1950 și azi; am lăsat-o de completat de mână.",
    ]);
    expect(citeste("angajare=2025-02-30").parametri.angajare).toBe("");
  });

  it("un salariu necitibil e spus, nu pus zero", () => {
    expect(citeste("salariu=abc")).toMatchObject({
      parametri: { salariu: null },
      avertismente: ["Salariul „abc” nu e o sumă; l-am lăsat afară din adeverință."],
    });
  });
});

describe("documentul", () => {
  it("adeverește funcția, contractul, norma și data angajării; CNP-ul rămâne de scris de mână", () => {
    const t = corp(
      "nume=Popescu%20Ana&functie=contabil&firma=Administrativo%20Demo%20SRL&angajare=2025-02-03&ore=6&durata=determinata",
    );
    expect(t).toContain("Popescu Ana, CNP ______________________________");
    expect(t).toContain("este angajat(ă) la Administrativo Demo SRL");
    expect(t).toContain("în funcția de contabil");
    expect(t).toContain("pe durată determinată");
    expect(t).toContain("normă parțială (6 ore pe zi)");
    expect(t).toContain("din data de 03.02.2025");
  });

  it("salariul apare doar dacă e dat, scris românește", () => {
    expect(corp("salariu=4.325")).toContain("Salariul de bază brut lunar este de 4.325 lei.");
    expect(corp("")).not.toContain("Salariul");
  });

  it("scopul și temeiul", () => {
    expect(corp("scop=medicul%20de%20familie")).toContain(
      "se eliberează la cererea salariatului, pentru a-i servi la medicul de familie, potrivit art. 34 alin. (5) din Codul muncii.",
    );
  });

  it("numărul și data emiterii stau sus; semnăturile jos", () => {
    const d = construiesteAdeverinta(
      citeste("nr=154&firma=Administrativo%20Demo%20SRL&cui=12345").parametri,
    );
    expect(d.titlu).toBe("Adeverință");
    expect(d.subtitlu).toBe("Administrativo Demo SRL, CUI 12345");
    expect(d.campuri).toEqual([
      { eticheta: "Nr.", valoare: "154" },
      { eticheta: "Data", valoare: "08.10.2026" },
    ]);
    expect(d.semnaturi).toEqual(["Reprezentant legal", "Întocmit"]);
  });

  it("e servită de ruta comună", () => {
    expect(constructorPentru("adeverinta-salariat")).toBeTypeOf("function");
  });
});

describe("întrebările paginii", () => {
  it("se termină cu „?”, răspunsurile cu punct, fără ș/ț cu sedilă", () => {
    for (const r of INTREBARI_ADEVERINTA) {
      expect(r.q).toMatch(/\?$/u);
      expect(r.a).toMatch(/\.$/u);
      expect(`${r.q}${r.a}${r.temei ?? ""}`).not.toMatch(/[\u015E\u015F\u0162\u0163]/u);
    }
  });
});
