import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  Footer,
  Header,
  HeightRule,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ISectionOptions,
} from "docx";

import { ADRESA_SITE } from "@/content/landing/contact";

import {
  adresaDinFisier,
  LINIE_GOALA,
  SEMNATURA_FISIER,
  textAntetRulant,
  type Coloana,
  type DocumentTabelar,
  type Sectiune,
} from "./document-tabelar";

/** Înălțimile de rând din `docx` sunt în twipi: 20 pe punct. */
const TWIPI_PE_PUNCT = 20;

/**
 * Aceleași înălțimi ca în PDF (`INALT_SEMNATURA` și `INALT_CASETA` din
 * `pdf.ts`), în puncte. Nu se importă de acolo: `pdf.ts` e `server-only` și
 * trage fontul, iar Word-ul n-are nevoie de el.
 */
const INALT_SEMNATURA = 46;
const INALT_CASETA = 96;

/** Celula unui tabel de secțiune: lățimea în procente, `\n` devine rând nou. */
function celulaSectiune(text: string, procent: number, aldin: boolean): TableCell {
  return new TableCell({
    width: { size: procent, type: WidthType.PERCENTAGE },
    children: [
      new Paragraph({
        children: text
          .split("\n")
          .map(
            (linie, k) =>
              new TextRun({ text: linie, bold: aldin, size: 16, ...(k > 0 ? { break: 1 } : {}) }),
          ),
      }),
    ],
  });
}

function paragrafSectiune(
  text: string,
  optiuni: Readonly<{ bold?: boolean; size?: number; color?: string }> = {},
): Paragraph {
  return new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, ...optiuni })] });
}

/** Un rând de casete egale; o casetă fără conținut rămâne goală (perechea lipsă). */
function randCasete(continut: readonly (readonly Paragraph[])[], inaltime: number): TableRow {
  return new TableRow({
    cantSplit: true,
    height: { value: inaltime * TWIPI_PE_PUNCT, rule: HeightRule.ATLEAST },
    children: continut.map(
      (copii) =>
        new TableCell({
          width: { size: Math.round(100 / continut.length), type: WidthType.PERCENTAGE },
          children: copii.length > 0 ? [...copii] : [new Paragraph("")],
        }),
    ),
  });
}

/** O secțiune a documentului (fișa SSM) ca paragrafe și tabele Word. */
function blocuriSectiune(s: Sectiune): (Paragraph | Table)[] {
  switch (s.tip) {
    case "text": {
      const blocuri: (Paragraph | Table)[] = [];
      if (s.titlu !== null) blocuri.push(paragrafSectiune(s.titlu, { bold: true, size: 22 }));
      for (const p of s.paragrafe) blocuri.push(paragrafSectiune(p, { size: 20 }));
      if (s.semnaturi.length > 0) {
        blocuri.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              randCasete(
                s.semnaturi.map((e) => [
                  new Paragraph({
                    children: [new TextRun({ text: e, size: 14, color: "6B7280" })],
                  }),
                ]),
                INALT_SEMNATURA,
              ),
            ],
          }),
          paragrafSectiune(""),
        );
      }
      return blocuri;
    }
    case "tabel": {
      if (s.coloane.length === 0) return [];
      const total = s.coloane.reduce((suma, c) => suma + c.latime, 0) || 1;
      const procent = (i: number) => Math.round(((s.coloane[i]?.latime ?? 0) / total) * 100);
      const inaltime = Math.max(16, s.inaltimeRand ?? 16);
      return [
        paragrafSectiune(s.titlu, { bold: true, size: 22 }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              tableHeader: true,
              cantSplit: true,
              children: s.coloane.map((c, i) => celulaSectiune(c.eticheta, procent(i), true)),
            }),
            ...s.randuri.map(
              (r) =>
                new TableRow({
                  cantSplit: true,
                  height: { value: inaltime * TWIPI_PE_PUNCT, rule: HeightRule.ATLEAST },
                  children: s.coloane.map((_, i) => celulaSectiune(r[i] ?? "", procent(i), false)),
                }),
            ),
          ],
        }),
        paragrafSectiune(""),
      ];
    }
    case "casete": {
      const caseta = () => [
        new Paragraph({ children: [new TextRun({ text: s.rubrica, size: 16 })] }),
        ...[1, 2, 3].map(
          () => new Paragraph({ children: [new TextRun({ text: LINIE_GOALA, size: 16 })] }),
        ),
        new Paragraph({
          children: [new TextRun({ text: s.semnaturi.join("    "), size: 14, color: "6B7280" })],
        }),
      ];
      const randuri: TableRow[] = [];
      for (let k = 0; k < s.numar; k += 2) {
        randuri.push(randCasete([caseta(), k + 1 < s.numar ? caseta() : []], INALT_CASETA));
      }
      const blocuri: (Paragraph | Table)[] = [
        paragrafSectiune(s.titlu, { bold: true, size: 22 }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: randuri }),
      ];
      if (s.nota !== null) blocuri.push(paragrafSectiune(s.nota, { size: 14, color: "6B7280" }));
      blocuri.push(paragrafSectiune(""));
      return blocuri;
    }
  }
}

/** „Pagina X din Y”, pe secțiune: fiecare fișă din documentul cu mai multe se numără singură. */
function subsol(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            children: ["Pagina ", PageNumber.CURRENT, " din ", PageNumber.TOTAL_PAGES_IN_SECTION],
            size: 14,
            color: "6B7280",
          }),
        ],
      }),
    ],
  });
}

/** Un `DocumentTabelar` ca secțiune Word. Mărimile în `docx` sunt în jumătăți de punct: 16 = 8 pt. */
function sectiune(d: DocumentTabelar): ISectionOptions {
  /** `procent` = lățimea coloanei din tabelul ei; `umbrita` = weekend, sărbătoare. */
  const celula = (text: string, procent: number, umbrita: boolean, aldin: boolean) =>
    new TableCell({
      width: { size: procent, type: WidthType.PERCENTAGE },
      // `exactOptionalPropertyTypes`: cheia lipsește, nu e `undefined`.
      ...(umbrita ? { shading: { type: ShadingType.CLEAR, color: "auto", fill: "E6E9E6" } } : {}),
      children: [
        new Paragraph({
          // `\n` din etichetă devine rând nou în celulă (antetul foii de pontaj).
          children: text
            .split("\n")
            .map(
              (linie, k) =>
                new TextRun({ text: linie, bold: aldin, size: 16, ...(k > 0 ? { break: 1 } : {}) }),
            ),
        }),
      ],
    });

  const paragraf = (
    text: string,
    optiuni: Readonly<{ bold?: boolean; size?: number; color?: string }> = {},
  ) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, ...optiuni })] });

  /**
   * Un tabel pe toată lățimea, cu antetul repetat pe fiecare pagină.
   * `inaltimeRand` e doar a tabelului principal (rândul de semnătură al condicii).
   */
  const tabel = (
    coloane: readonly Coloana[],
    randuri: readonly (readonly string[])[],
    umbrite: readonly number[],
    inaltimeRand?: number,
  ) => {
    const totalRelativ = coloane.reduce((s, c) => s + c.latime, 0) || 1;
    const procente = coloane.map((c) => Math.round((c.latime / totalRelativ) * 100));
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: coloane.map((c, i) =>
            celula(c.eticheta, procente[i] ?? 0, umbrite.includes(i), true),
          ),
        }),
        ...randuri.map(
          (r) =>
            new TableRow({
              // Un rând de semnătură rupt între două pagini nu mai e semnabil.
              cantSplit: true,
              ...(inaltimeRand === undefined
                ? {}
                : {
                    height: {
                      value: Math.round(inaltimeRand * TWIPI_PE_PUNCT),
                      rule: HeightRule.ATLEAST,
                    },
                  }),
              children: coloane.map((_, i) =>
                celula(r[i] ?? "", procente[i] ?? 0, umbrite.includes(i), false),
              ),
            }),
        ),
      ],
    });
  };

  const copii: (Paragraph | Table)[] = [paragraf(d.titlu, { bold: true, size: 28 })];
  if (d.subtitlu !== null) copii.push(paragraf(d.subtitlu, { size: 18, color: "6B7280" }));
  for (const c of d.campuri) {
    copii.push(
      paragraf(`${c.eticheta}: ${c.valoare === "" ? LINIE_GOALA : c.valoare}`, { size: 20 }),
    );
  }
  for (const p of d.paragrafe) copii.push(paragraf(p, { size: 22 }));
  if (d.coloane.length > 0) copii.push(tabel(d.coloane, d.randuri, d.umbrite, d.inaltimeRand));
  for (const t of d.tabeleSuplimentare ?? []) {
    if (t.coloane.length === 0) continue;
    copii.push(paragraf(""), paragraf(t.titlu, { bold: true, size: 20 }));
    copii.push(tabel(t.coloane, t.randuri, []));
  }
  for (const s of d.sectiuni ?? []) copii.push(...blocuriSectiune(s));
  for (const n of d.note) copii.push(paragraf(n, { size: 16, color: "6B7280" }));
  if (d.semnaturi.length > 0) {
    copii.push(
      paragraf(""),
      paragraf(d.semnaturi.map((s) => `${s}: ____________________`).join("        "), {
        size: 18,
      }),
    );
  }
  copii.push(
    new Paragraph({
      children: [
        new ExternalHyperlink({
          link: adresaDinFisier(d, "docx", ADRESA_SITE),
          children: [
            new TextRun({ text: SEMNATURA_FISIER, size: 14, color: "6B7280", underline: {} }),
          ],
        }),
      ],
    }),
  );

  return {
    properties: {
      // Prima pagină fără antet rulant: are deja titlul mare.
      titlePage: true,
      page: {
        size: {
          orientation:
            d.orientare === "peisaj" ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
        },
      },
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            children: [new TextRun({ text: textAntetRulant(d), size: 14, color: "6B7280" })],
          }),
        ],
      }),
      first: new Header({ children: [new Paragraph({ children: [] })] }),
    },
    footers: { default: subsol(), first: subsol() },
    children: copii,
  };
}

/** Mai multe documente într-un singur .docx, câte o secțiune (deci pagină nouă) fiecare. */
export async function randeazaDocxMultiplu(
  documente: readonly DocumentTabelar[],
): Promise<Uint8Array> {
  const primul = documente[0];
  if (primul === undefined) throw new Error("Niciun document de randat.");
  const document = new Document({
    creator: "Administrativo",
    title: primul.titlu,
    sections: documente.map((d) => sectiune(d)),
  });
  return new Uint8Array(await Packer.toBuffer(document));
}

/** `DocumentTabelar` → .docx. */
export async function randeazaDocx(d: DocumentTabelar): Promise<Uint8Array> {
  return randeazaDocxMultiplu([d]);
}
