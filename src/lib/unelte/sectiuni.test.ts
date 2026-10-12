import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { SaxesParser } from "saxes";
import { describe, expect, it } from "vitest";

import {
  curataDocument,
  textAntetRulant,
  textPagina,
  type DocumentTabelar,
} from "./document-tabelar";
import { randeazaDocx } from "./docx";
import { INALT_CASETA, randeazaPdf, type SondaPdf } from "./pdf";
import { raspunsDocument } from "./raspuns";
import { randeazaXlsx } from "./xlsx";

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

function sonda() {
  const texte: { pagina: number; text: string }[] = [];
  const cutii: { pagina: number; inaltime: number }[] = [];
  const s: SondaPdf = {
    text: (pagina, text) => texte.push({ pagina, text }),
    cutie: (pagina, inaltime) => cutii.push({ pagina, inaltime }),
  };
  return { s, texte, cutii };
}

describe("PDF cu secțiuni", () => {
  it("scrie fiecare titlu de secțiune și fiecare rubrică de semnătură, întreagă", async () => {
    const { s, texte } = sonda();
    await randeazaPdf(CU_SECTIUNI, s);
    const tot = texte.map((t) => t.text).join("\n");
    for (const titlu of [
      "Instruirea la angajare",
      "Instruirea periodică",
      "Rezultatele testărilor",
      "Control medical periodic",
    ]) {
      expect(tot).toContain(titlu);
    }
    // Eticheta lungă se rupe pe rânduri, nu se taie cu „…”.
    expect(tot.replace(/\n/gu, " ")).toContain("însușirea cunoștințelor");
    expect(texte.filter((t) => t.text.includes("…"))).toEqual([]);
  });

  it("rândurile de completat de mână au înălțimea cerută (28 pt ≈ 9,9 mm)", async () => {
    const { s, cutii } = sonda();
    await randeazaPdf(CU_SECTIUNI, s);
    // 40 de rânduri cu 28 pt; antetele și tabelul fără `inaltimeRand` rămân mai joase.
    expect(cutii.filter((c) => c.inaltime === 28)).toHaveLength(40);
    expect(cutii.filter((c) => c.inaltime === 16).length).toBeGreaterThanOrEqual(5);
  });

  it("desenează câte o casetă de viză pentru fiecare, inclusiv ultima, fără pereche", async () => {
    const { s, cutii } = sonda();
    await randeazaPdf(CU_SECTIUNI, s);
    expect(cutii.filter((c) => c.inaltime === INALT_CASETA)).toHaveLength(7);
  });

  it("pune numele pe fiecare pagină de la a doua și „Pagina x din y” pe toate", async () => {
    const { s, texte } = sonda();
    const pdf = await PDFDocument.load(await randeazaPdf(CU_SECTIUNI, s));
    const n = pdf.getPageCount();
    expect(n).toBeGreaterThan(1);
    for (let p = 1; p <= n; p += 1) {
      const pePagina = texte.filter((t) => t.pagina === p).map((t) => t.text);
      expect(pePagina, `pagina ${String(p)}`).toContain(textPagina(p - 1, n));
      if (p > 1) expect(pePagina, `pagina ${String(p)}`).toContain(CU_SECTIUNI.antetRulant);
    }
    expect(pdf.getPage(0).getHeight()).toBeGreaterThan(pdf.getPage(0).getWidth()); // portret
  });

  it("taie antetul rulant la lățimea paginii când numele și firma sunt la plafon", async () => {
    // Nume și firmă de câte 120 de caractere dau un antet de ~280; la 7 pt încap ~140.
    const lung = `Fișă de instruire individuală SSM — ${"Popescu ".repeat(18)}— ${"Firma ".repeat(18)}`;
    expect(lung.length).toBeGreaterThan(250);
    const { s, texte } = sonda();
    await randeazaPdf({ ...CU_SECTIUNI, antetRulant: lung }, s);
    const antet = texte.find((t) => t.pagina === 2 && t.text.startsWith("Fișă de instruire"));
    expect(antet?.text.endsWith("…")).toBe(true);
    expect(antet?.text.length ?? 999).toBeLessThanOrEqual(160);
  });
});

function eroriXml(xml: string): readonly string[] {
  const erori: string[] = [];
  const parser = new SaxesParser({ xmlns: true });
  parser.on("error", (eroare) => {
    erori.push(eroare.message);
  });
  parser.write(xml).close();
  return erori;
}

describe("Word cu secțiuni", () => {
  it("are antetul cu numele, subsolul numerotat pe secțiune și rânduri de cel puțin 28 pt", async () => {
    const zip = await JSZip.loadAsync(await randeazaDocx(CU_SECTIUNI));
    const fisiere = Object.keys(zip.files);
    const antet = fisiere.find((f) => /^word\/header\d+\.xml$/u.test(f));
    const subsol = fisiere.find((f) => /^word\/footer\d+\.xml$/u.test(f));
    expect(antet).toBeDefined();
    expect(subsol).toBeDefined();
    expect(await zip.file(antet ?? "")?.async("string")).toContain("Popescu Ștefanța");
    const xmlSubsol = (await zip.file(subsol ?? "")?.async("string")) ?? "";
    expect(xmlSubsol).toContain("Pagina ");
    expect(xmlSubsol).toContain("SECTIONPAGES");
    const document = (await zip.file("word/document.xml")?.async("string")) ?? "";
    // 28 pt = 560 twips; 40 de rânduri periodice. Casetele au 96 pt = 1920.
    expect(document.match(/<w:trHeight w:val="560" w:hRule="atLeast"\/>/gu)).toHaveLength(40);
    expect(document.match(/<w:trHeight w:val="1920" w:hRule="atLeast"\/>/gu)).toHaveLength(4);
    for (const titlu of [
      "Instruirea la angajare",
      "Rezultatele testărilor",
      "Control medical periodic",
    ]) {
      expect(document).toContain(titlu);
    }
    expect(document).toContain("Semnătura celui care a verificat însușirea cunoștințelor");
    expect(document).toContain('w:orient="portrait"');
  });

  it("repetă antetul fiecărui tabel de secțiune pe pagina următoare", async () => {
    // Word real nu rulează pe mașina asta; `tblHeader` e ce cere repetarea.
    const zip = await JSZip.loadAsync(await randeazaDocx(CU_SECTIUNI));
    const document = (await zip.file("word/document.xml")?.async("string")) ?? "";
    const tabele = (CU_SECTIUNI.sectiuni ?? []).filter((s) => s.tip === "tabel").length;
    expect(tabele).toBeGreaterThanOrEqual(2);
    expect((document.match(/<w:tblHeader\/>/gu) ?? []).length).toBeGreaterThanOrEqual(tabele);
  });

  it("rămâne XML valid cu caractere de control în secțiuni", async () => {
    const murdar: DocumentTabelar = {
      ...CU_SECTIUNI,
      antetRulant: "Popa\u000BIon\u0001",
      sectiuni: [
        { tip: "text", titlu: "A\u0001", paragrafe: ["b\u0000c"], semnaturi: ["d\u001F"] },
        {
          tip: "casete",
          titlu: "C\u000B",
          numar: 1,
          rubrica: "R\u0003",
          semnaturi: ["S"],
          nota: null,
        },
      ],
    };
    const r = await raspunsDocument(murdar, "docx");
    const zip = await JSZip.loadAsync(await r.arrayBuffer());
    for (const parte of Object.keys(zip.files).filter((f) => /^word\/.*\.xml$/u.test(f))) {
      expect(eroriXml((await zip.file(parte)?.async("string")) ?? ""), parte).toEqual([]);
    }
  });
});

describe("Excel", () => {
  it("refuză un document cu secțiuni, în loc să le piardă tăcut", async () => {
    await expect(randeazaXlsx(CU_SECTIUNI)).rejects.toThrow(/secțiuni/u);
    await expect(randeazaXlsx(SIMPLU)).resolves.toBeInstanceOf(Uint8Array);
  });
});
