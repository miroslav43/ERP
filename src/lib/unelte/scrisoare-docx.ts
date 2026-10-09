import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  Packer,
  Paragraph,
  Tab,
  TabStopType,
  TextRun,
} from "docx";

import { ADRESA_SITE } from "@/content/landing/contact";

import { SEMNATURA_FISIER } from "./document-tabelar";
import { adresaScrisoare, curataScrisoarea, type Scrisoare } from "./scrisoare";

/**
 * `Scrisoare` → .docx, cu același aspect ca previzualizarea și PDF-ul.
 *
 * Mărimile în `docx` sunt în jumătăți de punct (22 = 11 pt); distanțele în
 * twips (567 = 1 cm). Marginile sunt de 2 cm, ca în PDF, deci lățimea utilă a
 * unui A4 (11.906 twips) e 9.638 — acolo stă oprirea de tabulator din dreapta.
 *
 * Rândul „Generat gratuit cu administrativo.ro” e în SUBSOLUL paginii, nu în
 * corp: nu face parte din textul care se semnează, iar cine nu-l vrea îl
 * șterge din subsol fără să atingă cererea.
 */
const MARGINE_TWIPS = 1134;
const LATIME_UTILA_TWIPS = 11906 - 2 * MARGINE_TWIPS;
const ALINIERE = {
  stanga: AlignmentType.LEFT,
  dreapta: AlignmentType.RIGHT,
  centru: AlignmentType.CENTER,
} as const;

type OptiuniRand = Readonly<{
  aliniere?: keyof typeof ALINIERE;
  marime?: number;
  aldin?: boolean;
  slab?: boolean;
  inainte?: number;
  dupa?: number;
}>;

function rand(text: string, o: OptiuniRand = {}): Paragraph {
  return new Paragraph({
    alignment: ALINIERE[o.aliniere ?? "stanga"],
    spacing: { before: o.inainte ?? 0, after: o.dupa ?? 120 },
    children: [
      new TextRun({
        text,
        size: o.marime ?? 22,
        bold: o.aldin ?? false,
        ...(o.slab === true ? { color: "6B7280" } : {}),
      }),
    ],
  });
}

export async function randeazaScrisoareDocx(intrare: Scrisoare): Promise<Uint8Array> {
  const s = curataScrisoarea(intrare);
  const copii: Paragraph[] = [
    rand(s.inregistrare, { marime: 20 }),
    rand(s.catre, { aliniere: "dreapta", inainte: 120 }),
    rand(s.titlu, { aliniere: "centru", marime: 32, aldin: true, inainte: 600, dupa: 60 }),
  ];
  if (s.subtitlu !== null) copii.push(rand(s.subtitlu, { aliniere: "centru", dupa: 360 }));
  for (const p of s.paragrafe) {
    copii.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: 567 },
        spacing: { after: 160, line: 360 },
        children: [new TextRun({ text: p, size: 22 })],
      }),
    );
  }
  copii.push(
    new Paragraph({
      spacing: { before: 480, after: 0 },
      tabStops: [{ type: TabStopType.RIGHT, position: LATIME_UTILA_TWIPS }],
      children: [
        new TextRun({ text: s.locSiData, size: 22 }),
        new TextRun({ children: [new Tab(), s.semnatura], size: 22 }),
      ],
    }),
    rand("______________________", { aliniere: "dreapta", inainte: 480 }),
  );

  if (s.rubrica !== null) {
    const r = s.rubrica;
    copii.push(
      new Paragraph({
        spacing: { before: 600, after: 120 },
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: "999999", space: 8 } },
        children: [new TextRun({ text: r.titlu, bold: true, size: 20 })],
      }),
    );
    for (const linie of r.randuri) copii.push(rand(linie, { marime: 20, dupa: 60 }));
    if (r.semnaturi.length > 0) {
      const pas = Math.floor(LATIME_UTILA_TWIPS / r.semnaturi.length);
      const opriri = r.semnaturi.slice(1).map((_, i) => ({
        type: TabStopType.LEFT,
        position: pas * (i + 1),
      }));
      const randCuTaburi = (texte: readonly string[], marime: number, inainte: number) =>
        new Paragraph({
          spacing: { before: inainte, after: 0 },
          tabStops: opriri,
          children: texte.map(
            (t, i) =>
              new TextRun({
                children: i === 0 ? [t] : [new Tab(), t],
                size: marime,
                color: "6B7280",
              }),
          ),
        });
      copii.push(
        randCuTaburi(
          r.semnaturi.map(() => "________________"),
          20,
          720,
        ),
        randCuTaburi(r.semnaturi, 18, 60),
      );
    }
  }

  s.note.forEach((n, i) => {
    copii.push(rand(n, { marime: 16, slab: true, inainte: i === 0 ? 360 : 0, dupa: 60 }));
  });

  const subsol = new Footer({
    children: [
      new Paragraph({
        children: [
          new ExternalHyperlink({
            link: adresaScrisoare(s, "docx", ADRESA_SITE),
            children: [
              new TextRun({ text: SEMNATURA_FISIER, size: 14, color: "6B7280", underline: {} }),
            ],
          }),
        ],
      }),
    ],
  });

  const document = new Document({
    creator: "Administrativo",
    title: s.titluDocument,
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: MARGINE_TWIPS,
              bottom: MARGINE_TWIPS,
              left: MARGINE_TWIPS,
              right: MARGINE_TWIPS,
            },
          },
        },
        footers: { default: subsol },
        children: copii,
      },
    ],
  });
  return new Uint8Array(await Packer.toBuffer(document));
}
