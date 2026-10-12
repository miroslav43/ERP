import { describe, expect, it } from "vitest";

import { MAX_CRITERII } from "./calcul";
import {
  CRITERII_IMPLICITE,
  fisaEvaluareDinParametri,
  parametriFisaEvaluare,
  rezultatFisa,
} from "./model";
import { setDupaCheie } from "./seturi";

/** Adresa exact cum o trimite formularul: câte un criteriu, o pondere și o notă pe rând. */
function adresa(randuri: readonly (readonly [string, string, string])[], extra = {}) {
  const q = new URLSearchParams(extra);
  for (const [criteriu, pondere, nota] of randuri) {
    q.append("criteriu", criteriu);
    q.append("pondere", pondere);
    q.append("nota", nota);
  }
  return q;
}

const NOTATA = [
  ["Cunoștințe profesionale", "20", "4"],
  ["Calitatea muncii", "20", "5"],
  ["Respectarea termenelor", "15", "3"],
  ["Comunicare", "15", "4"],
  ["Inițiativă", "15", "3"],
  ["Respectarea procedurilor", "15", "4"],
] as const;

describe("fișa de evaluare: parametrii", () => {
  it("fără nimic, setul general cu ponderile lui și fără note", () => {
    const p = parametriFisaEvaluare(new URLSearchParams());
    expect(p.set).toBe("general");
    expect(p.grila.map((r) => r.criteriu)).toEqual(CRITERII_IMPLICITE);
    expect(p.grila.map((r) => r.pondere)).toEqual([20, 20, 15, 15, 15, 15]);
    expect(p.grila.every((r) => r.nota === null)).toBe(true);
  });

  it("rândurile din formular, aliniate pe poziție, chiar cu ponderi goale la mijloc", () => {
    const p = parametriFisaEvaluare(
      adresa([
        ["A", "50", "4"],
        ["B", "", "3"],
        ["C", "50", ""],
      ]),
    );
    expect(p.grila).toEqual([
      { criteriu: "A", pondere: 50, nota: 4 },
      { criteriu: "B", pondere: null, nota: 3 },
      { criteriu: "C", pondere: 50, nota: null },
    ]);
  });

  it("rândurile fără criteriu se sar, iar valorile de neînțeles devin necompletate", () => {
    const p = parametriFisaEvaluare(
      adresa([
        ["   ", "30", "4"],
        ["A", "150", "7"],
        ["B", "2e1", "3.456"],
      ]),
    );
    expect(p.grila).toEqual([
      { criteriu: "A", pondere: null, nota: null },
      { criteriu: "B", pondere: null, nota: null },
    ]);
  });

  it("cel mult 15 criterii, fiecare cel mult 120 de caractere", () => {
    const randuri = Array.from(
      { length: 40 },
      (_, i) => [`${"x".repeat(200)}${String(i)}`, "", ""] as const,
    );
    const p = parametriFisaEvaluare(adresa(randuri));
    expect(p.grila).toHaveLength(MAX_CRITERII);
    expect(p.grila[0]?.criteriu).toHaveLength(120);
  });

  it("linkurile vechi cu `criterii` pe rânduri merg, fără ponderi", () => {
    const p = parametriFisaEvaluare(new URLSearchParams({ criterii: "Unu\n\nDoi\r\nTrei" }));
    expect(p.grila).toEqual([
      { criteriu: "Unu", pondere: null, nota: null },
      { criteriu: "Doi", pondere: null, nota: null },
      { criteriu: "Trei", pondere: null, nota: null },
    ]);
  });

  it("`incarca=set` înlocuiește rândurile scrise cu setul ales", () => {
    const p = parametriFisaEvaluare(
      adresa([["A", "100", "4"]], { set: "productie", incarca: "set" }),
    );
    expect(p.set).toBe("productie");
    expect(p.grila.map((r) => r.criteriu)).toEqual(
      setDupaCheie("productie").criterii.map((c) => c.criteriu),
    );
  });

  it("data: ISO sau românească, validată; altfel goală", () => {
    expect(parametriFisaEvaluare(new URLSearchParams({ data: "2026-12-15" })).data).toBe(
      "2026-12-15",
    );
    expect(parametriFisaEvaluare(new URLSearchParams({ data: "15.12.2026" })).data).toBe(
      "2026-12-15",
    );
    for (const gresit of ["2026-02-31", "1899-01-01", "mâine", "2026-13-01"]) {
      expect(parametriFisaEvaluare(new URLSearchParams({ data: gresit })).data, gresit).toBe("");
    }
  });

  it("rubricile păstrează rândurile, strâng spațiile și se opresc la 500 de caractere", () => {
    const p = parametriFisaEvaluare(
      new URLSearchParams({
        obiective: "  Raport   lunar \r\n\r\n Curs Excel ",
        dezvoltare: "y".repeat(900),
      }),
    );
    expect(p.obiective).toBe("Raport lunar\nCurs Excel");
    expect(p.dezvoltare).toHaveLength(500);
  });

  it("pragurile din adresă, sau implicitele cu semn că s-au corectat", () => {
    expect(parametriFisaEvaluare(new URLSearchParams({ prag_fb: "4,75" })).praguri.foarteBine).toBe(
      475,
    );
    const gresite = parametriFisaEvaluare(new URLSearchParams({ prag_fb: "2", prag_b: "4" }));
    expect(gresite.praguriCorectate).toBe(true);
    expect(gresite.praguri.foarteBine).toBe(450);
  });
});

describe("fișa de evaluare: documentul", () => {
  it("calculează punctajul, totalul, nota finală și calificativul", () => {
    const d = fisaEvaluareDinParametri(adresa(NOTATA));
    expect(d.coloane.map((c) => c.eticheta)).toEqual([
      "Criteriu",
      "Pondere\n(%)",
      "Nota\n(1–5)",
      "Punctaj",
      "Observații",
    ]);
    expect(d.randuri[0]).toEqual(["Cunoștințe profesionale", "20", "4", "0,80", ""]);
    expect(d.randuri.slice(-2)).toEqual([
      ["Total (nota finală)", "100", "", "3,90", ""],
      ["Calificativ", "", "", "", "Bine"],
    ]);
  });

  it("ponderi care nu fac 100: totalul arată suma, nota finală rămâne de completat", () => {
    const d = fisaEvaluareDinParametri(
      adresa(NOTATA.map((r, i) => (i === 0 ? [r[0], "10", r[2]] : r))),
    );
    expect(d.randuri.slice(-2)).toEqual([
      ["Total (nota finală)", "90", "", "", ""],
      ["Calificativ", "", "", "", ""],
    ]);
  });

  it("o pondere lipsă: totalul rămâne gol, nu o sumă parțială", () => {
    const d = fisaEvaluareDinParametri(new URLSearchParams({ criterii: "Unu\nDoi" }));
    expect(d.randuri.at(-2)).toEqual(["Total (nota finală)", "", "", "", ""]);
  });

  it("fișa completă: scala, formula, pragurile, temeiul, rubricile, trei semnături cu dată", () => {
    const d = fisaEvaluareDinParametri(new URLSearchParams({ data: "2026-12-15" }));
    expect(d.campuri).toContainEqual({ eticheta: "Data evaluării", valoare: "15.12.2026" });
    expect(d.note.join(" ")).toMatch(/1 — mult sub cerințele postului/u);
    expect(d.note.join(" ")).toMatch(/Foarte bine de la 4,50/u);
    expect(d.note.join(" ")).toMatch(/art\. 17 alin\. \(3\) lit\. e\), \(4\) și \(5\)/u);
    expect(d.rubrici?.map((r) => r.titlu)).toEqual([
      "Puncte forte",
      "De îmbunătățit",
      "Obiective pentru perioada următoare",
      "Plan de dezvoltare (formare, îndrumare)",
      "Comentariile angajatului",
    ]);
    expect(d.semnaturi).toHaveLength(3);
    expect(d.dataLaSemnaturi).toBe(true);
    expect(d.coloane[0]?.rupe).toBe(true);
    expect(d.inaltimeRand).toBeGreaterThanOrEqual(24);
  });

  it("rezultatul pentru grilă e cel din calcul", () => {
    const r = rezultatFisa(parametriFisaEvaluare(adresa(NOTATA)));
    expect(r.notaFinala).toBe(390);
    expect(r.calificativ).toBe("Bine");
  });
});
