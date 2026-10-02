import {
  Document,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import { LINIE_GOALA, type DocumentTabelar } from "./document-tabelar";

/** `DocumentTabelar` → .docx. Mărimile în `docx` sunt în jumătăți de punct: 16 = 8 pt. */
export async function randeazaDocx(d: DocumentTabelar): Promise<Uint8Array> {
  const totalRelativ = d.coloane.reduce((s, c) => s + c.latime, 0) || 1;
  const celula = (text: string, i: number, aldin: boolean) =>
    new TableCell({
      width: {
        size: Math.round(((d.coloane[i]?.latime ?? 0) / totalRelativ) * 100),
        type: WidthType.PERCENTAGE,
      },
      // `exactOptionalPropertyTypes`: cheia lipsește, nu e `undefined`.
      ...(d.umbrite.includes(i)
        ? { shading: { type: ShadingType.CLEAR, color: "auto", fill: "E6E9E6" } }
        : {}),
      children: [new Paragraph({ children: [new TextRun({ text, bold: aldin, size: 16 })] })],
    });

  const paragraf = (
    text: string,
    optiuni: Readonly<{ bold?: boolean; size?: number; color?: string }> = {},
  ) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, ...optiuni })] });

  const copii: (Paragraph | Table)[] = [paragraf(d.titlu, { bold: true, size: 28 })];
  if (d.subtitlu !== null) copii.push(paragraf(d.subtitlu, { size: 18, color: "6B7280" }));
  for (const c of d.campuri) {
    copii.push(
      paragraf(`${c.eticheta}: ${c.valoare === "" ? LINIE_GOALA : c.valoare}`, { size: 20 }),
    );
  }
  for (const p of d.paragrafe) copii.push(paragraf(p, { size: 22 }));
  if (d.coloane.length > 0) {
    copii.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: d.coloane.map((c, i) => celula(c.eticheta, i, true)),
          }),
          ...d.randuri.map(
            (r) =>
              new TableRow({ children: d.coloane.map((_, i) => celula(r[i] ?? "", i, false)) }),
          ),
        ],
      }),
    );
  }
  for (const n of d.note) copii.push(paragraf(n, { size: 16, color: "6B7280" }));
  if (d.semnaturi.length > 0) {
    copii.push(
      paragraf(""),
      paragraf(d.semnaturi.map((s) => `${s}: ____________________`).join("        "), {
        size: 18,
      }),
    );
  }
  copii.push(paragraf("Generat gratuit cu administrativo.ro", { size: 14, color: "6B7280" }));

  const document = new Document({
    creator: "Administrativo",
    title: d.titlu,
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation:
                d.orientare === "peisaj" ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
            },
          },
        },
        children: copii,
      },
    ],
  });
  return new Uint8Array(await Packer.toBuffer(document));
}
