import { describe, expect, it } from "vitest";

import { INALTIME_A4, LATIME_A4 } from "@/lib/pdf/document";

import { adresaScrisoare, curataScrisoarea, type Scrisoare } from "./scrisoare";
import {
  asezaScrisoarea,
  INALTIME_PAGINA,
  LATIME_PAGINA,
  MARGINE_SCRISOARE,
  rupe,
  type Operatie,
  type OperatieText,
} from "./scrisoare-asezare";

/** Măsura falsă: lățimea crește cu numărul de litere și cu mărimea. */
const masoara = (t: string, marime: number, aldin: boolean) =>
  Array.from(t).length * marime * (aldin ? 0.6 : 0.5);

const SCRISOARE: Scrisoare = {
  titluDocument: "Cerere de concediu de odihnă",
  inregistrare: "Nr. înregistrare ________ din ____________",
  catre: "Către: Exemplu SRL",
  titlu: "CERERE",
  subtitlu: "de concediu de odihnă",
  paragrafe: [
    "Subsemnatul/Subsemnata Ilie Maria, angajat(ă) în funcția de contabil, vă rog să binevoiți a-mi aproba efectuarea concediului de odihnă aferent anului 2026, în perioada 21.12.2026 – 31.12.2026 inclusiv, reprezentând 8 zile lucrătoare.",
    "Menționez că în intervalul solicitat nu se numără cele 2 zile de weekend și nici sărbătorile legale: 25.12.2026 (Crăciunul).",
  ],
  locSiData: "Arad, 02.10.2026",
  semnatura: "Semnătura salariatului",
  rubrica: {
    titlu: "Se completează de angajator",
    randuri: [
      "☐ Se aprobă / ☐ Nu se aprobă",
      "Zile de concediu de odihnă cuvenite pentru anul 2026: ________",
      "Zile rămase din anul anterior: ________",
      "Zile efectuate până la data cererii: ________",
      "Zile rămase după această cerere: ________",
    ],
    semnaturi: ["Șef ierarhic", "Resurse umane", "Conducătorul unității"],
  },
  note: [
    "Sărbătorile legale în care nu se lucrează nu sunt incluse în durata concediului de odihnă — art. 145 alin. (3) din Codul muncii.",
  ],
  numeFisier: "cerere-odihna-2026-12-21",
  sursa: "/unelte/cerere-concediu-de-odihna",
};

const texte = (pagini: readonly (readonly Operatie[])[]): OperatieText[] =>
  pagini.flat().filter((o): o is OperatieText => o.tip === "text");

function gaseste(
  lista: readonly OperatieText[],
  cauta: (o: OperatieText) => boolean,
): OperatieText {
  const gasit = lista.find(cauta);
  if (gasit === undefined) throw new Error("Operația căutată lipsește din așezare.");
  return gasit;
}

describe("așezarea scrisorii", () => {
  it("constantele A4 sunt aceleași cu ale stratului PDF", () => {
    expect(LATIME_PAGINA).toBe(LATIME_A4);
    expect(INALTIME_PAGINA).toBe(INALTIME_A4);
  });

  it("„CERERE” e centrat, „Către” e la dreapta, locul și data la stânga", () => {
    const t = texte(asezaScrisoarea(SCRISOARE, masoara));
    const titlu = gaseste(t, (o) => o.text === "CERERE");
    expect(titlu.x + masoara("CERERE", titlu.marime, titlu.aldin) / 2).toBeCloseTo(
      LATIME_PAGINA / 2,
      5,
    );
    const catre = gaseste(t, (o) => o.text.startsWith("Către"));
    expect(catre.x + masoara(catre.text, catre.marime, catre.aldin)).toBeCloseTo(
      LATIME_PAGINA - MARGINE_SCRISOARE,
      5,
    );
    expect(gaseste(t, (o) => o.text.startsWith("Arad")).x).toBe(MARGINE_SCRISOARE);
  });

  it("semnătura salariatului stă pe aceeași linie cu locul și data", () => {
    const t = texte(asezaScrisoarea(SCRISOARE, masoara));
    expect(gaseste(t, (o) => o.text === "Semnătura salariatului").y).toBe(
      gaseste(t, (o) => o.text.startsWith("Arad")).y,
    );
  });

  it("o cerere obișnuită încape pe o pagină, cu rubrica angajatorului întreagă", () => {
    const pagini = asezaScrisoarea(SCRISOARE, masoara);
    expect(pagini).toHaveLength(1);
    const t = texte(pagini).map((o) => o.text);
    expect(t).toContain("☐ Se aprobă / ☐ Nu se aprobă");
    for (const s of ["Șef ierarhic", "Resurse umane", "Conducătorul unității"]) {
      expect(t).toContain(s);
    }
  });

  it("nimic nu iese din margini, nici cu un nume de 120 de litere fără spațiu", () => {
    const lung: Scrisoare = {
      ...SCRISOARE,
      catre: `Către: ${"Ă".repeat(120)}`,
      paragrafe: [`Subsemnatul ${"Ș".repeat(120)}, vă rog.`],
      locSiData: `${"Ț".repeat(60)}, 02.10.2026`,
    };
    for (const o of texte(asezaScrisoarea(lung, masoara))) {
      expect(o.x, o.text).toBeGreaterThanOrEqual(MARGINE_SCRISOARE - 1e-6);
      expect(o.x + masoara(o.text, o.marime, o.aldin), o.text).toBeLessThanOrEqual(
        LATIME_PAGINA - MARGINE_SCRISOARE + 1e-6,
      );
    }
  });

  it("un text uriaș trece pe pagina următoare, fără să coboare sub margine", () => {
    const pagini = asezaScrisoarea({ ...SCRISOARE, paragrafe: ["cuvânt ".repeat(1500)] }, masoara);
    expect(pagini.length).toBeGreaterThan(1);
    for (const o of pagini.flat()) {
      const y = o.tip === "text" ? o.y : Math.min(o.y1, o.y2);
      expect(y).toBeGreaterThanOrEqual(MARGINE_SCRISOARE);
    }
  });
});

describe("ruperea în rânduri", () => {
  const m = (t: string) => Array.from(t).length * 5;

  it("rupe pe cuvinte, fără să piardă nimic", () => {
    const text = "Subsemnatul Popa Ion vă rog să binevoiți a aproba concediul de odihnă";
    const randuri = rupe(text, 100, m);
    expect(randuri.length).toBeGreaterThan(1);
    expect(randuri.join(" ")).toBe(text);
    for (const r of randuri) expect(m(r)).toBeLessThanOrEqual(100);
  });

  it("un cuvânt mai lung decât rândul se rupe pe litere, nu se taie", () => {
    const randuri = rupe("a".repeat(65), 100, m);
    expect(randuri.join("")).toBe("a".repeat(65));
    for (const r of randuri) expect(m(r)).toBeLessThanOrEqual(100);
  });
});

describe("modelul scrisorii", () => {
  it("adresa din subsol duce la pagina uneltei, cu UTM", () => {
    expect(adresaScrisoare(SCRISOARE, "pdf", "https://administrativo.ro")).toBe(
      "https://administrativo.ro/unelte/cerere-concediu-de-odihna?utm_source=fisier&utm_medium=pdf&utm_campaign=unelte",
    );
  });

  it("curățarea scoate caracterele de control din fiecare câmp", () => {
    const murdar: Scrisoare = {
      ...SCRISOARE,
      catre: "Către: A\u000BB",
      paragrafe: ["x\u0001y"],
      rubrica: { titlu: "t\u001F", randuri: ["r\u000C"], semnaturi: ["s\u0000"] },
    };
    const curat = JSON.stringify(curataScrisoarea(murdar));
    expect(curat).not.toMatch(/\\u000[0-9a-f]|\\u001[0-9a-f]/u);
  });
});
