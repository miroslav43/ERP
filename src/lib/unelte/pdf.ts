import "server-only";

import { rgb, type PDFFont } from "pdf-lib";

import {
  GRI,
  INALTIME_A4,
  LATIME_A4,
  LINIE,
  MARGINE,
  NEGRU,
  pornesteDocument,
} from "@/lib/pdf/document";

import { LINIE_GOALA, type DocumentTabelar } from "./document-tabelar";

/**
 * `DocumentTabelar` → PDF.
 *
 * Folosește `pornesteDocument` din `src/lib/pdf/document.ts`, adică fontul
 * DejaVu încorporat: cele 14 fonturi standard PDF nu au `ș`/`ț` cu virgulă și
 * ar arunca la primul nume românesc.
 */

const UMBRA = rgb(0.92, 0.93, 0.92);
const MARIME = 8;
const INALT_RAND = 16;
/** Spațiul păstrat sub ultimul rând pentru mențiunea din subsol. */
const REZERVA_SUBSOL = 20;

/** Taie textul la lățimea dată, cu „…” la final. `masoara` e injectat ca să fie testabil. */
export function taie(text: string, latime: number, masoara: (t: string) => number): string {
  if (masoara(text) <= latime) return text;
  let t = text;
  while (t.length > 0 && masoara(`${t}…`) > latime) t = t.slice(0, -1);
  return `${t}…`;
}

/**
 * Rupe proza pe cuvinte, în rânduri care încap în lățime. Un cuvânt mai lung
 * decât rândul întreg se taie cu `taie`, ca bucla să nu se blocheze pe el.
 */
export function imparte(text: string, latime: number, masoara: (t: string) => number): string[] {
  const randuri: string[] = [];
  let curent = "";
  for (const cuvant of text.split(/\s+/u).filter((c) => c !== "")) {
    const incercare = curent === "" ? cuvant : `${curent} ${cuvant}`;
    if (masoara(incercare) <= latime) {
      curent = incercare;
      continue;
    }
    if (curent !== "") randuri.push(curent);
    curent = masoara(cuvant) <= latime ? cuvant : taie(cuvant, latime, masoara);
  }
  if (curent !== "") randuri.push(curent);
  return randuri.length > 0 ? randuri : [""];
}

export async function randeazaPdf(d: DocumentTabelar): Promise<Uint8Array> {
  const { doc, fonturi } = await pornesteDocument(d.titlu, "Administrativo");
  const [latime, inaltime] =
    d.orientare === "peisaj" ? [INALTIME_A4, LATIME_A4] : [LATIME_A4, INALTIME_A4];
  const util = latime - 2 * MARGINE;
  const totalRelativ = d.coloane.reduce((s, c) => s + c.latime, 0);
  const latimi = d.coloane.map((c) => (totalRelativ === 0 ? 0 : (c.latime / totalRelativ) * util));

  let pagina = doc.addPage([latime, inaltime]);
  let y = inaltime - MARGINE;

  const masoara = (font: PDFFont, marime: number) => (t: string) =>
    font.widthOfTextAtSize(t, marime);
  const paginaNoua = () => {
    pagina = doc.addPage([latime, inaltime]);
    y = inaltime - MARGINE;
  };
  const asiguraLoc = (necesar: number) => {
    if (y - necesar < MARGINE + REZERVA_SUBSOL) paginaNoua();
  };
  /** Proză pe mai multe rânduri; doar celulele de tabel se taie cu „…”. */
  const scrie = (text: string, marime: number, font: PDFFont, culoare = NEGRU) => {
    const randuri = imparte(text, util, masoara(font, marime));
    randuri.forEach((rand, k) => {
      asiguraLoc(marime + 6);
      pagina.drawText(rand, { x: MARGINE, y: y - marime, size: marime, font, color: culoare });
      y -= k === randuri.length - 1 ? marime + 6 : marime + 3;
    });
  };

  scrie(d.titlu, 14, fonturi.aldin);
  if (d.subtitlu !== null) scrie(d.subtitlu, 9, fonturi.normal, GRI);
  y -= 4;
  for (const c of d.campuri) {
    scrie(`${c.eticheta}: ${c.valoare === "" ? LINIE_GOALA : c.valoare}`, 9, fonturi.normal);
  }
  y -= 4;
  for (const p of d.paragrafe) scrie(p, 10, fonturi.normal);

  /**
   * Un rând de tabel. Etichetele pot avea `\n` (antetul foii de pontaj pune
   * ziua deasupra literei): rândul crește cu numărul de linii, iar fiecare linie
   * se taie separat la lățimea coloanei.
   */
  const rand = (celule: readonly string[], aldin: boolean) => {
    const font = aldin ? fonturi.aldin : fonturi.normal;
    const linii = celule.map((c) => c.split("\n"));
    const nrLinii = Math.max(1, ...linii.map((l) => l.length));
    const inalt = INALT_RAND + (nrLinii - 1) * (MARIME + 2);
    let x = MARGINE;
    latimi.forEach((w, i) => {
      if (d.umbrite.includes(i)) {
        pagina.drawRectangle({ x, y: y - inalt, width: w, height: inalt, color: UMBRA });
      }
      pagina.drawRectangle({
        x,
        y: y - inalt,
        width: w,
        height: inalt,
        borderColor: LINIE,
        borderWidth: 0.5,
      });
      (linii[i] ?? [""]).forEach((linie, k) => {
        pagina.drawText(taie(linie, w - 4, masoara(font, MARIME)), {
          x: x + 2,
          y: y - 11 - k * (MARIME + 2),
          size: MARIME,
          font,
          color: NEGRU,
        });
      });
      x += w;
    });
    y -= inalt;
  };

  if (d.coloane.length > 0) {
    const antet = d.coloane.map((c) => c.eticheta);
    asiguraLoc(INALT_RAND * 3);
    rand(antet, true);
    for (const r of d.randuri) {
      if (y - INALT_RAND < MARGINE + REZERVA_SUBSOL) {
        paginaNoua();
        rand(antet, true); // antetul se repetă pe fiecare pagină
      }
      rand(r, false);
    }
  }

  y -= 10;
  for (const n of d.note) scrie(n, 8, fonturi.normal, GRI);

  if (d.semnaturi.length > 0) {
    asiguraLoc(50);
    y -= 30;
    const pas = util / d.semnaturi.length;
    d.semnaturi.forEach((eticheta, i) => {
      const x = MARGINE + i * pas;
      pagina.drawLine({
        start: { x, y },
        end: { x: x + pas - 24, y },
        thickness: 0.5,
        color: GRI,
      });
      pagina.drawText(taie(eticheta, pas - 24, masoara(fonturi.normal, 8)), {
        x,
        y: y - 11,
        size: 8,
        font: fonturi.normal,
        color: GRI,
      });
    });
    y -= 20;
  }

  pagina.drawText("Generat gratuit cu administrativo.ro", {
    x: MARGINE,
    y: MARGINE / 2,
    size: 7,
    font: fonturi.normal,
    color: GRI,
  });

  return doc.save();
}
