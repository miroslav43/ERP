import { describe, expect, it } from "vitest";

import { curataDocument, textAntetRulant, type DocumentTabelar } from "./document-tabelar";

/**
 * Documentele cu secțiuni (fișa SSM, anexa 11 la HG 1425/2006): mai multe
 * tabele, rubrici de semnătură etichetate, casete de viză, antet pe fiecare
 * pagină și „Pagina x din y”. Auditul din 8 oct 2026 a găsit fișa fără cinci
 * părți ale anexei, cu rânduri de 5,6 mm și o a doua pagină fără nume.
 */

const SEMNATURI = [
  "Semnătura celui instruit",
  "Semnătura celui care a efectuat instruirea",
  "Semnătura celui care a verificat însușirea cunoștințelor",
];

const CU_SECTIUNI: DocumentTabelar = {
  titlu: "Fișă de instruire individuală privind securitatea și sănătatea în muncă",
  subtitlu: "Întreprinderea/unitatea: Țesătoria Ardeleana SRL",
  campuri: [{ eticheta: "Numele și prenumele", valoare: "Popescu Ștefanța" }],
  paragrafe: [],
  coloane: [],
  randuri: [],
  umbrite: [],
  note: ["Se păstrează la conducătorul locului de muncă."],
  semnaturi: [],
  orientare: "portret",
  numeFisier: "fisa-ssm-test",
  antetRulant: "Fișă de instruire individuală SSM — Popescu Ștefanța — Țesătoria Ardeleana SRL",
  sectiuni: [
    {
      tip: "text",
      titlu: "Instruirea la angajare",
      paragrafe: ["1) Instruirea introductiv-generală a fost efectuată la data __________."],
      semnaturi: SEMNATURI,
    },
    {
      tip: "tabel",
      titlu: "Instruirea periodică",
      coloane: [
        { eticheta: "Data\ninstruirii", latime: 2 },
        { eticheta: "Materialul predat", latime: 5 },
        { eticheta: "Semnătura\ncelui\ninstruit", latime: 2 },
      ],
      randuri: Array.from({ length: 40 }, () => ["", "", ""]),
      inaltimeRand: 28,
    },
    {
      tip: "tabel",
      titlu: "Rezultatele testărilor",
      coloane: [
        { eticheta: "Data", latime: 2 },
        { eticheta: "Calificativ", latime: 3 },
      ],
      randuri: Array.from({ length: 5 }, () => ["", ""]),
    },
    {
      tip: "casete",
      titlu: "Control medical periodic",
      numar: 7,
      rubrica: "Observații de specialitate",
      semnaturi: ["Semnătura și parafa medicului de medicina muncii", "Data vizei"],
      nota: "* notă de test",
    },
  ],
};

/** Același document, fără secțiuni și fără antet: cum arată celelalte unelte. */
const { sectiuni: _sectiuni, antetRulant: _antet, ...BAZA } = CU_SECTIUNI;
const SIMPLU: DocumentTabelar = {
  ...BAZA,
  coloane: [{ eticheta: "Nume", latime: 1 }],
  randuri: [["Ana"]],
};

describe("curățarea textului ajunge și în secțiuni", () => {
  it("curataDocument curăță titlurile, celulele, rubricile și antetul rulant", () => {
    const murdar: DocumentTabelar = {
      ...CU_SECTIUNI,
      antetRulant: "Popa\u000BIon",
      sectiuni: [
        { tip: "text", titlu: "A\u0001", paragrafe: ["b\u0000c"], semnaturi: ["d\u001F"] },
        {
          tip: "tabel",
          titlu: "T\u000C",
          coloane: [{ eticheta: "E\u0002", latime: 1 }],
          randuri: [["x\u0007"]],
        },
        {
          tip: "casete",
          titlu: "C",
          numar: 2,
          rubrica: "R\u0003",
          semnaturi: ["S"],
          nota: "N\u0004",
        },
      ],
    };
    const d = curataDocument(murdar);
    expect(d.antetRulant).toBe("Popa Ion");
    expect(JSON.stringify(d.sectiuni)).not.toMatch(/\\u000[0-9a-f]|\\u001[0-9a-f]/u);
    expect(d.sectiuni?.[2]).toMatchObject({ numar: 2, rubrica: "R", nota: "N" });
  });

  it("antetul rulant e numele lucrătorului când documentul îl dă", () => {
    expect(textAntetRulant(CU_SECTIUNI)).toBe(CU_SECTIUNI.antetRulant);
    expect(textAntetRulant(SIMPLU)).toBe(`${SIMPLU.titlu} · ${SIMPLU.subtitlu ?? ""}`);
  });

  it("un document fără secțiuni nu primește chei noi", () => {
    const d = curataDocument(SIMPLU);
    expect("sectiuni" in d).toBe(false);
    expect("antetRulant" in d).toBe(false);
  });
});
