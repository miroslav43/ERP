// src/app/(marketing)/unelte/cerere-demisie/model.test.ts
import { describe, expect, it } from "vitest";

import { EroareIntrare } from "@/lib/unelte/document-tabelar";
import { constructorPentru } from "@/lib/unelte/registru";

import { INTREBARI_DEMISIE } from "./intrebari";
import { calculeazaPreaviz, citesteDemisie, construiesteDemisie, PLAFON_PREAVIZ } from "./model";

const AZI = "2026-10-08";
const citeste = (s: string) => citesteDemisie(new URLSearchParams(s), AZI);
const text = (s: string) => {
  const d = construiesteDemisie(citeste(s).parametri);
  return [d.titlu, ...d.paragrafe, ...d.note, ...d.semnaturi].join("\n");
};

describe("preavizul", () => {
  it("plafoanele din art. 81 alin. (4)", () => {
    expect(PLAFON_PREAVIZ).toEqual({ executie: 20, conducere: 45 });
  });

  it("20 de zile lucrătoare de la 8 oct 2026: ultima zi e joi, 5 noiembrie", () => {
    expect(calculeazaPreaviz("2026-10-08", 20)).toEqual({
      zile: 20,
      ultimaZi: "2026-11-05",
      sarbatoriSarite: [],
    });
  });

  it("45 de zile peste sărbătorile de iarnă le enumeră pe cele sărite", () => {
    const p = calculeazaPreaviz("2026-12-10", 45);
    expect(p.ultimaZi).toBe("2027-02-17");
    expect(p.sarbatoriSarite.map((s) => s.denumire)).toEqual([
      "Crăciunul",
      "Anul Nou",
      "Bobotează",
      "Soborul Sfântului Ioan Botezătorul",
    ]);
  });

  it("depusă duminică, numărătoarea începe luni", () => {
    expect(calculeazaPreaviz("2026-10-11", 1).ultimaZi).toBe("2026-10-12");
  });

  it("un preaviz care trece de 2035 e o EroareIntrare, deci 400 pe rută", () => {
    expect(() => calculeazaPreaviz("2035-12-20", 20)).toThrow(EroareIntrare);
  });
});

describe("citesteDemisie", () => {
  it("fără nimic: demisie cu preaviz, funcție de execuție, 20 de zile, depusă azi", () => {
    expect(citeste("")).toEqual({
      parametri: {
        tip: "preaviz",
        categorie: "executie",
        nume: "",
        functie: "",
        angajator: "",
        contract: "",
        depunere: AZI,
        zilePreaviz: 20,
        dataAcord: AZI,
      },
      avertismente: [],
    });
  });

  it("funcția de conducere ridică plafonul la 45", () => {
    expect(citeste("categorie=conducere").parametri.zilePreaviz).toBe(45);
  });

  it("un preaviz peste plafon e plafonat, cu motivul spus", () => {
    const c = citeste("preaviz=30");
    expect(c.parametri.zilePreaviz).toBe(20);
    expect(c.avertismente).toEqual([
      "Preavizul nu poate depăși 20 de zile lucrătoare pentru o funcție de execuție (art. 81 alin. (4)); am folosit 20.",
    ]);
  });

  it("un preaviz mai scurt, din contract, e păstrat", () => {
    expect(citeste("preaviz=10").parametri.zilePreaviz).toBe(10);
  });

  it("un preaviz necitibil și o dată inexistentă sunt spuse pe nume", () => {
    expect(citeste("preaviz=abc&depunere=2026-02-30").avertismente).toEqual([
      "Data depunerii: „2026-02-30” nu e o zi reală între 2024 și 2035; am folosit ziua de azi.",
      "Preavizul „abc” nu e un număr întreg de zile; am folosit plafonul legal, 20.",
    ]);
  });

  it("un tip necunoscut devine demisia cu preaviz; textul e curățat de rânduri noi", () => {
    const c = citeste("tip=altceva&nume=Popescu%0AAna");
    expect(c.parametri.tip).toBe("preaviz");
    expect(c.parametri.nume).toBe("Popescu Ana");
  });
});

describe("documentul", () => {
  it("cu preaviz: temeiul, numărul de zile și ultima zi, în cuvinte", () => {
    const t = text(
      "nume=Popescu%20Ana&functie=contabil&angajator=Administrativo%20Demo%20SRL&depunere=2026-10-08",
    );
    expect(t).toContain("Cerere de demisie");
    expect(t).toContain("Popescu Ana");
    expect(t).toContain("art. 81 din Codul muncii");
    expect(t).toContain("20 de zile lucrătoare");
    expect(t).toContain("joi, 5 noiembrie 2026");
    expect(t).toContain("art. 81 alin. (7)");
  });

  it("fără preaviz: alin. (8), cu loc pentru obligația neîndeplinită", () => {
    const t = text("tip=fara-preaviz");
    expect(t).toContain("art. 81 alin. (8)");
    expect(t).toContain("______________________________");
    expect(t).not.toContain("ultima zi de preaviz");
  });

  it("în perioada de probă: art. 31 alin. (3), fără preaviz", () => {
    expect(text("tip=proba&depunere=2026-10-12")).toContain("art. 31 alin. (3)");
    expect(text("tip=proba&depunere=2026-10-12")).toContain("luni, 12 octombrie 2026");
  });

  it("acordul părților: art. 55 lit. b), data convenită și semnătura angajatorului", () => {
    const d = construiesteDemisie(citeste("tip=acord&data_acord=2026-10-30").parametri);
    expect(d.titlu).toBe("Cerere de încetare a contractului prin acordul părților");
    expect(d.paragrafe.join(" ")).toContain("art. 55 lit. b)");
    expect(d.paragrafe.join(" ")).toContain("vineri, 30 octombrie 2026");
    expect(d.semnaturi).toEqual(["Salariat", "De acord — angajator"]);
  });

  it("câmpurile goale devin linii de completat de mână, iar fișierul are nume curat", () => {
    const d = construiesteDemisie(citeste("").parametri);
    expect(d.paragrafe[0]).toContain("______________________________");
    expect(d.numeFisier).toBe("cerere-demisie-necompletata");
    expect(d.orientare).toBe("portret");
  });

  it("e servită de ruta comună", () => {
    expect(constructorPentru("cerere-demisie")).toBeTypeOf("function");
  });
});

describe("întrebările paginii", () => {
  it("se termină cu „?”, răspunsurile cu punct, fără ș/ț cu sedilă", () => {
    for (const r of INTREBARI_DEMISIE) {
      expect(r.q).toMatch(/\?$/u);
      expect(r.a).toMatch(/\.$/u);
      expect(`${r.q}${r.a}${r.temei ?? ""}`).not.toMatch(/[\u015E\u015F\u0162\u0163]/u);
    }
  });

  it("răspunde la „zile lucrătoare sau calendaristice”, întrebarea cea mai căutată", () => {
    expect(INTREBARI_DEMISIE[0]?.q).toMatch(/lucrătoare sau calendaristice/u);
  });
});
