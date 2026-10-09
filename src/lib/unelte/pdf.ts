import "server-only";

import { PDFName, PDFString, rgb, type PDFDocument, type PDFFont, type PDFPage } from "pdf-lib";

import { ADRESA_SITE } from "@/content/landing/contact";

import {
  GRI,
  INALTIME_A4,
  LATIME_A4,
  MARGINE,
  NEGRU,
  pornesteDocument,
  type Fonturi,
} from "@/lib/pdf/document";

import {
  adresaDinFisier,
  LINIE_GOALA,
  SEMNATURA_FISIER,
  textAntetRulant,
  textPagina,
  type Coloana,
  type DocumentTabelar,
} from "./document-tabelar";

/**
 * `DocumentTabelar` → PDF.
 *
 * Folosește `pornesteDocument` din `src/lib/pdf/document.ts`, adică fontul
 * DejaVu încorporat: cele 14 fonturi standard PDF nu au `ș`/`ț` cu virgulă și
 * ar arunca la primul nume românesc.
 */

const UMBRA = rgb(0.92, 0.93, 0.92);
/**
 * Chenarul tabelului. A fost `LINIE` (#D9DBE0, 0,5 pt): curat pe ecran, abia
 * vizibil pe hârtie — iar condica și fișele se completează și se semnează pe
 * liniile astea (auditul din 8 oct 2026).
 */
const CHENAR = rgb(0.45, 0.47, 0.5);
const MARIME = 8;
const INALT_RAND = 16;
/** Spațiul păstrat sub ultimul rând pentru mențiunea din subsol. */
const REZERVA_SUBSOL = 20;
/** Un tabel suplimentar cu atâtea rânduri sau mai puține nu se rupe între pagini. */
const RANDURI_TABEL_SCURT = 12;
/** Mărimea textelor din margine: antetul rulant și numărul paginii. */
const MARIME_MARGINE = 7;

type Masurare = (font: PDFFont, marime: number) => (t: string) => number;

/**
 * Taie textul la lățimea dată, cu „…” la final. `masoara` e injectat ca să fie testabil.
 *
 * Căutare binară pe lungimea prefixului: fiecare măsurătoare a fontului
 * încorporat e o așezare OpenType completă, iar varianta liniară (un caracter
 * scos pe pas) ținea condica cu un nume de 300 de caractere 5,7 s pe proces.
 */
export function taie(text: string, latime: number, masoara: (t: string) => number): string {
  if (masoara(text) <= latime) return text;
  let jos = 0;
  let sus = text.length;
  while (jos < sus) {
    const mijloc = Math.ceil((jos + sus) / 2);
    if (masoara(`${text.slice(0, mijloc)}…`) <= latime) jos = mijloc;
    else sus = mijloc - 1;
  }
  return `${text.slice(0, jos)}…`;
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

function dimensiuni(d: DocumentTabelar): readonly [number, number] {
  return d.orientare === "peisaj" ? [INALTIME_A4, LATIME_A4] : [LATIME_A4, INALTIME_A4];
}

/**
 * Lățimea fiecărei coloane în puncte: lățimile relative, întinse pe lățimea
 * utilă. Exportată ca testele uneltelor să verifice, pe fontul real, că nicio
 * etichetă nu ajunge la „…”.
 */
export function latimiColoane(d: DocumentTabelar): readonly number[] {
  return latimiTabel(d, d.coloane);
}

/** Lățimile relative ale unui tabel al documentului, în puncte, pe toată lățimea utilă. */
function latimiTabel(d: DocumentTabelar, coloane: readonly Coloana[]): readonly number[] {
  const [latime] = dimensiuni(d);
  const util = latime - 2 * MARGINE;
  const total = coloane.reduce((s, c) => s + c.latime, 0);
  return coloane.map((c) => (total === 0 ? 0 : (c.latime / total) * util));
}

export async function randeazaPdf(d: DocumentTabelar): Promise<Uint8Array> {
  return randeazaPdfMultiplu([d]);
}

/**
 * Mai multe documente într-un singur PDF, fiecare de la pagină nouă și cu
 * numerotarea lui („Pagina 1 din 1” nu se scrie). Fontul se încorporează O
 * DATĂ: lipite din PDF-uri separate, 60 de fișe ar fi purtat 60 de subseturi.
 */
export async function randeazaPdfMultiplu(
  documente: readonly DocumentTabelar[],
): Promise<Uint8Array> {
  const primul = documente[0];
  if (primul === undefined) throw new Error("Niciun document de randat.");
  const { doc, fonturi } = await pornesteDocument(primul.titlu, "Administrativo");

  // Memorizat pe randare: la condică același nume apare pe fiecare zi lucrătoare,
  // iar fiecare măsurătoare e o așezare OpenType completă. Fără cache, 60 de nume
  // × 21 de zile costau ~2,4 s; cheile sunt mărginite de document.
  const masurate = new Map<string, number>();
  const masoara: Masurare = (font, marime) => (t) => {
    const cheie = `${font === fonturi.aldin ? "a" : "n"}${String(marime)}|${t}`;
    let latimeText = masurate.get(cheie);
    if (latimeText === undefined) {
      latimeText = font.widthOfTextAtSize(t, marime);
      masurate.set(cheie, latimeText);
    }
    return latimeText;
  };

  for (const d of documente) deseneaza(doc, fonturi, masoara, d);
  return doc.save();
}

function deseneaza(
  doc: PDFDocument,
  fonturi: Fonturi,
  masoara: Masurare,
  d: DocumentTabelar,
): void {
  const [latime, inaltime] = dimensiuni(d);
  const util = latime - 2 * MARGINE;
  const latimi = latimiColoane(d);
  const inaltCorp = Math.max(INALT_RAND, d.inaltimeRand ?? INALT_RAND);

  const pagini: PDFPage[] = [];
  let pagina = doc.addPage([latime, inaltime]);
  pagini.push(pagina);
  let y = inaltime - MARGINE;

  const paginaNoua = () => {
    pagina = doc.addPage([latime, inaltime]);
    pagini.push(pagina);
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
   * se taie separat la lățimea coloanei. Un rând mai înalt decât textul lui
   * (condica, 22 pt) își centrează textul pe verticală.
   */
  const rand = (
    celule: readonly string[],
    aldin: boolean,
    inaltMinim: number,
    latimiRand: readonly number[] = latimi,
    umbrite: readonly number[] = d.umbrite,
  ) => {
    const font = aldin ? fonturi.aldin : fonturi.normal;
    const linii = celule.map((c) => c.split("\n"));
    const nrLinii = Math.max(1, ...linii.map((l) => l.length));
    const inaltText = INALT_RAND + (nrLinii - 1) * (MARIME + 2);
    const inalt = Math.max(inaltMinim, inaltText);
    const sus = 11 + (inalt - inaltText) / 2;
    let x = MARGINE;
    latimiRand.forEach((w, i) => {
      if (umbrite.includes(i)) {
        pagina.drawRectangle({ x, y: y - inalt, width: w, height: inalt, color: UMBRA });
      }
      pagina.drawRectangle({
        x,
        y: y - inalt,
        width: w,
        height: inalt,
        borderColor: CHENAR,
        borderWidth: 0.5,
      });
      (linii[i] ?? [""]).forEach((linie, k) => {
        pagina.drawText(taie(linie, w - 4, masoara(font, MARIME)), {
          x: x + 2,
          y: y - sus - k * (MARIME + 2),
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
    rand(antet, true, INALT_RAND);
    for (const r of d.randuri) {
      if (y - inaltCorp < MARGINE + REZERVA_SUBSOL) {
        paginaNoua();
        rand(antet, true, INALT_RAND); // antetul se repetă pe fiecare pagină
      }
      rand(r, false, inaltCorp);
    }
  }

  // Tabelele suplimentare: titlu, antet, rânduri. Unul scurt (cel mult
  // `RANDURI_TABEL_SCURT`) nu se rupe între pagini: trece întreg pe pagina
  // următoare. Unul lung cere măcar titlul, antetul și două rânduri deodată,
  // ca titlul să nu rămână singur la capăt de pagină.
  for (const t of d.tabeleSuplimentare ?? []) {
    if (t.coloane.length === 0) continue;
    const latimiT = latimiTabel(d, t.coloane);
    const antetT = t.coloane.map((c) => c.eticheta);
    const randuriCerute = t.randuri.length <= RANDURI_TABEL_SCURT ? t.randuri.length : 2;
    y -= 10;
    asiguraLoc(16 + INALT_RAND * (randuriCerute + 2));
    scrie(t.titlu, 10, fonturi.aldin);
    rand(antetT, true, INALT_RAND, latimiT, []);
    for (const r of t.randuri) {
      if (y - INALT_RAND < MARGINE + REZERVA_SUBSOL) {
        paginaNoua();
        rand(antetT, true, INALT_RAND, latimiT, []);
      }
      rand(r, false, INALT_RAND, latimiT, []);
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

  pagina.drawText(SEMNATURA_FISIER, {
    x: MARGINE,
    y: MARGINE / 2,
    size: MARIME_MARGINE,
    font: fonturi.normal,
    color: GRI,
  });
  // Textul devine clicabil printr-o adnotare `Link` cu acțiune `URI`, întinsă
  // exact peste el. `pdf-lib` n-are un API pentru legături; dicționarul e cel
  // din specificația PDF (ISO 32000, 12.5.6.5).
  const latimeText = fonturi.normal.widthOfTextAtSize(SEMNATURA_FISIER, MARIME_MARGINE);
  const legatura = doc.context.register(
    doc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [MARGINE, MARGINE / 2 - 2, MARGINE + latimeText, MARGINE / 2 + 8],
      Border: [0, 0, 0],
      A: {
        Type: "Action",
        S: "URI",
        URI: PDFString.of(adresaDinFisier(d, "pdf", ADRESA_SITE)),
      },
    }),
  );
  pagina.node.set(PDFName.of("Annots"), doc.context.obj([legatura]));

  // Marginile se scriu la sfârșit: abia acum se știe câte pagini are documentul.
  const masoaraMic = masoara(fonturi.normal, MARIME_MARGINE);
  const antetRulant = taie(textAntetRulant(d), util, masoaraMic);
  pagini.forEach((p, i) => {
    if (i > 0) {
      p.drawText(antetRulant, {
        x: MARGINE,
        y: inaltime - MARGINE / 2 - 4,
        size: MARIME_MARGINE,
        font: fonturi.normal,
        color: GRI,
      });
    }
    const numar = textPagina(i, pagini.length);
    if (numar !== null) {
      p.drawText(numar, {
        x: latime - MARGINE - masoaraMic(numar),
        y: MARGINE / 2,
        size: MARIME_MARGINE,
        font: fonturi.normal,
        color: GRI,
      });
    }
  });
}
