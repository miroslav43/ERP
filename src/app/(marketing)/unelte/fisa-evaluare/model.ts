import type { DocumentTabelar } from "@/lib/unelte/document-tabelar";

/**
 * Fișa de evaluare a performanțelor profesionale.
 *
 * Codul muncii nu dă un model; dă doar dreptul angajatorului de a stabili
 * obiectivele și criteriile de evaluare (art. 40 alin. (1) lit. f)) și
 * obligația de a le comunica salariatului (art. 17 alin. (3) lit. e)) —
 * verificate pe forma consolidată la 2 oct 2026. De aceea criteriile se pot
 * înlocui cu ale firmei; lista implicită e doar un punct de plecare.
 */

export const CRITERII_IMPLICITE: readonly string[] = [
  "Cunoștințe și competențe profesionale",
  "Calitatea muncii",
  "Respectarea termenelor",
  "Comunicare și lucru în echipă",
  "Inițiativă și rezolvarea problemelor",
  "Respectarea procedurilor (SSM, regulament intern)",
];

const MAX_CRITERII = 15;
const text = (v: string | null) => (v ?? "").trim().slice(0, 120);

export type ParametriFisaEvaluare = Readonly<{
  nume: string;
  functie: string;
  perioada: string;
  evaluator: string;
  firma: string;
  criterii: readonly string[];
}>;

export function parametriFisaEvaluare(q: URLSearchParams): ParametriFisaEvaluare {
  const proprii = (q.get("criterii") ?? "")
    .split(/\n/u)
    .map((c) => c.trim().slice(0, 120))
    .filter((c) => c !== "")
    .slice(0, MAX_CRITERII);
  return {
    nume: text(q.get("nume")),
    functie: text(q.get("functie")),
    perioada: text(q.get("perioada")),
    evaluator: text(q.get("evaluator")),
    firma: text(q.get("firma")),
    criterii: proprii.length > 0 ? proprii : CRITERII_IMPLICITE,
  };
}

export function construiesteFisaEvaluare(o: ParametriFisaEvaluare): DocumentTabelar {
  return {
    titlu: "Fișa de evaluare a performanțelor profesionale",
    subtitlu: o.firma === "" ? null : o.firma,
    campuri: [
      { eticheta: "Angajat", valoare: o.nume },
      { eticheta: "Funcția", valoare: o.functie },
      { eticheta: "Perioada evaluată", valoare: o.perioada },
      { eticheta: "Evaluator", valoare: o.evaluator },
    ],
    paragrafe: [],
    coloane: [
      { eticheta: "Criteriu", latime: 7.5 },
      { eticheta: "Pondere\n(%)", latime: 1.6 },
      { eticheta: "Nota\n(1–5)", latime: 1.6 },
      { eticheta: "Observații", latime: 4.5 },
    ],
    randuri: [...o.criterii.map((c) => [c, "", "", ""]), ["Total", "100", "", ""]],
    umbrite: [],
    note: [
      "Nota finală = suma (pondere × notă) / 100.",
      "Criteriile de evaluare se aduc la cunoștința salariatului — art. 17 alin. (3) lit. e) din Codul muncii.",
    ],
    semnaturi: ["Evaluator", "Am luat la cunoștință (angajat)"],
    orientare: "portret",
    numeFisier: `fisa-evaluare-${o.nume === "" ? "necompletata" : o.nume}`,
  };
}

export function fisaEvaluareDinParametri(q: URLSearchParams): DocumentTabelar {
  return construiesteFisaEvaluare(parametriFisaEvaluare(q));
}
