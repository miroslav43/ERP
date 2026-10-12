import "server-only";

import { PDFName, PDFString } from "pdf-lib";

import { ADRESA_SITE } from "@/content/landing/contact";
import { GRI, NEGRU, pornesteDocument } from "@/lib/pdf/document";

import { SEMNATURA_FISIER } from "./document-tabelar";
import { adresaScrisoare, curataScrisoarea, type Scrisoare } from "./scrisoare";
import {
  asezaScrisoarea,
  INALTIME_PAGINA,
  LATIME_PAGINA,
  MARGINE_SCRISOARE,
} from "./scrisoare-asezare";

/**
 * `Scrisoare` → PDF. Geometria vine din `asezaScrisoarea`; aici doar se
 * desenează, cu fontul DejaVu încorporat (cele 14 fonturi standard PDF n-au
 * „ș”/„ț” cu virgulă).
 *
 * Rândul „Generat gratuit cu administrativo.ro” stă în marginea de jos a
 * ultimei pagini, la 7 pt, sub rubrica angajatorului — în afara textului care
 * se semnează. Decizia e scrisă în planul din 8 oct 2026, secțiunea F.
 */
export async function randeazaScrisoarePdf(intrare: Scrisoare): Promise<Uint8Array> {
  const s = curataScrisoarea(intrare);
  const { doc, fonturi } = await pornesteDocument(s.titluDocument, "Administrativo");
  const font = (aldin: boolean) => (aldin ? fonturi.aldin : fonturi.normal);

  // Memorizat: fiecare măsurătoare e o așezare OpenType completă.
  const masurate = new Map<string, number>();
  const masoara = (text: string, marime: number, aldin: boolean): number => {
    const cheie = `${aldin ? "a" : "n"}${String(marime)}|${text}`;
    let latime = masurate.get(cheie);
    if (latime === undefined) {
      latime = font(aldin).widthOfTextAtSize(text, marime);
      masurate.set(cheie, latime);
    }
    return latime;
  };

  const pagini = asezaScrisoarea(s, masoara).map((operatii) => {
    const pagina = doc.addPage([LATIME_PAGINA, INALTIME_PAGINA]);
    for (const op of operatii) {
      if (op.tip === "text") {
        pagina.drawText(op.text, {
          x: op.x,
          y: op.y,
          size: op.marime,
          font: font(op.aldin),
          color: op.slab ? GRI : NEGRU,
        });
      } else {
        pagina.drawLine({
          start: { x: op.x1, y: op.y1 },
          end: { x: op.x2, y: op.y2 },
          thickness: 0.6,
          color: GRI,
        });
      }
    }
    return pagina;
  });

  const ultima = pagini.at(-1);
  if (ultima !== undefined) {
    const y = MARGINE_SCRISOARE / 2;
    ultima.drawText(SEMNATURA_FISIER, {
      x: MARGINE_SCRISOARE,
      y,
      size: 7,
      font: fonturi.normal,
      color: GRI,
    });
    // Legătura: adnotare `Link` cu acțiune `URI` peste text (ISO 32000, 12.5.6.5),
    // ca în `pdf.ts` — `pdf-lib` n-are un API pentru ea.
    const latimeText = fonturi.normal.widthOfTextAtSize(SEMNATURA_FISIER, 7);
    const legatura = doc.context.register(
      doc.context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: [MARGINE_SCRISOARE, y - 2, MARGINE_SCRISOARE + latimeText, y + 8],
        Border: [0, 0, 0],
        A: { Type: "Action", S: "URI", URI: PDFString.of(adresaScrisoare(s, "pdf", ADRESA_SITE)) },
      }),
    );
    ultima.node.set(PDFName.of("Annots"), doc.context.obj([legatura]));
  }

  return doc.save();
}
