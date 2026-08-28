// src/lib/pdf/document.ts
// Stratul subțire peste `pdf-lib` pentru documentele oficiale ale aplicației.
//
// De ce o librărie și nu HTML printabil, ca la contractul de muncă:
// contractul și fișa postului se tipăresc o dată, de om, din browser. Statul de
// plată și fluturașii se generează LUNAR, pentru toți angajații, și pleacă pe
// e-mail — un flux în care „apasă Ctrl+P și alege Salvează ca PDF" nu e un pas,
// e un blocaj. Aici e nevoie de un fișier `.pdf` real, descărcabil și atașabil.
//
// De ce NU un browser headless (Puppeteer/Playwright): ar fi reutilizat
// șabloanele HTML deja scrise, dar cere Chromium în imaginea Docker — ~300 MB
// și un proces separat pe un Swarm care rulează deja la limită. `pdf-lib` e JS
// pur, fără binare native.
//
// Diacriticele: cele 14 fonturi standard PDF folosesc codarea WinAnsi, care nu
// conține `ș`/`ț` cu virgulă dedesubt (U+0219/U+021B). Un stat de plată scris
// cu Helvetica ar tipări „indemnizaie". De aici fontul încorporat din
// `fonturi/`, cu subsetare — proba de control a dat 6,7 KB, nu 760 KB.
import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";

/** A4 în puncte PostScript (72 dpi): 210 × 297 mm. */
export const LATIME_A4 = 595.28;
export const INALTIME_A4 = 841.89;
export const MARGINE = 40;

export const NEGRU: RGB = rgb(0.1, 0.1, 0.12);
export const GRI: RGB = rgb(0.42, 0.45, 0.5);
export const LINIE: RGB = rgb(0.85, 0.86, 0.88);
export const ACCENT: RGB = rgb(0.13, 0.35, 0.72);

/**
 * Fonturile se citesc de pe disc o singură dată per proces.
 *
 * `outputFileTracingIncludes` din `next.config.ts` le duce în build-ul
 * `standalone` — trasarea importurilor nu vede un `readFileSync` cu cale
 * construită, deci fără regula aia containerul ar porni și ar cădea la primul
 * PDF cu ENOENT.
 */
const CALE_FONTURI = path.join(process.cwd(), "src", "lib", "pdf", "fonturi");
let cacheFonturi: { readonly normal: Uint8Array; readonly aldin: Uint8Array } | null = null;

function citesteFonturile(): { readonly normal: Uint8Array; readonly aldin: Uint8Array } {
  if (cacheFonturi !== null) return cacheFonturi;
  cacheFonturi = {
    normal: new Uint8Array(readFileSync(path.join(CALE_FONTURI, "DejaVuSans.ttf"))),
    aldin: new Uint8Array(readFileSync(path.join(CALE_FONTURI, "DejaVuSans-Bold.ttf"))),
  };
  return cacheFonturi;
}

export interface Fonturi {
  readonly normal: PDFFont;
  readonly aldin: PDFFont;
}

export interface ContextPdf {
  readonly doc: PDFDocument;
  readonly fonturi: Fonturi;
}

export async function pornesteDocument(titlu: string, autor: string): Promise<ContextPdf> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const brute = citesteFonturile();
  const fonturi: Fonturi = {
    normal: await doc.embedFont(brute.normal, { subset: true }),
    aldin: await doc.embedFont(brute.aldin, { subset: true }),
  };
  doc.setTitle(titlu);
  doc.setAuthor(autor);
  doc.setProducer("Administrativo");
  doc.setCreator("Administrativo");
  return { doc, fonturi };
}

/**
 * Un cursor de scriere pe pagină.
 *
 * `pdf-lib` are originea în COLȚUL DIN STÂNGA JOS și nu are noțiune de flux de
 * text: fiecare `drawText` cere coordonate absolute. Cursorul ăsta ține minte
 * unde a rămas și coboară singur, ca apelantul să scrie de sus în jos, cum
 * gândește un document.
 */
export class Cursor {
  private pagina: PDFPage;
  private y: number;

  constructor(
    private readonly context: ContextPdf,
    private readonly latime = LATIME_A4,
    private readonly inaltime = INALTIME_A4,
  ) {
    this.pagina = context.doc.addPage([latime, inaltime]);
    this.y = inaltime - MARGINE;
  }

  get paginaCurenta(): PDFPage {
    return this.pagina;
  }

  get yCurent(): number {
    return this.y;
  }

  get latimeUtila(): number {
    return this.latime - 2 * MARGINE;
  }

  /** Coboară cu `puncte`; deschide pagină nouă dacă s-ar ieși sub marginea de jos. */
  coboara(puncte: number): void {
    this.y -= puncte;
    if (this.y < MARGINE + 30) this.paginaNoua();
  }

  paginaNoua(): void {
    this.pagina = this.context.doc.addPage([this.latime, this.inaltime]);
    this.y = this.inaltime - MARGINE;
  }

  /** Rezervă `puncte` pe pagina curentă; dacă nu încap, trece la una nouă. */
  asiguraSpatiu(puncte: number): void {
    if (this.y - puncte < MARGINE + 30) this.paginaNoua();
  }

  text(
    continut: string,
    optiuni: {
      readonly x?: number;
      readonly marime?: number;
      readonly aldin?: boolean;
      readonly culoare?: RGB;
      readonly coboaraCu?: number;
    } = {},
  ): void {
    const marime = optiuni.marime ?? 9;
    const font = optiuni.aldin === true ? this.context.fonturi.aldin : this.context.fonturi.normal;
    this.pagina.drawText(continut, {
      x: optiuni.x ?? MARGINE,
      y: this.y,
      size: marime,
      font,
      color: optiuni.culoare ?? NEGRU,
    });
    if (optiuni.coboaraCu !== undefined) this.coboara(optiuni.coboaraCu);
  }

  /** Text aliniat la DREAPTA lui `xDreapta` — obligatoriu pentru coloanele de sume. */
  textDreapta(
    continut: string,
    xDreapta: number,
    optiuni: { readonly marime?: number; readonly aldin?: boolean; readonly culoare?: RGB } = {},
  ): void {
    const marime = optiuni.marime ?? 9;
    const font = optiuni.aldin === true ? this.context.fonturi.aldin : this.context.fonturi.normal;
    const latime = font.widthOfTextAtSize(continut, marime);
    this.pagina.drawText(continut, {
      x: xDreapta - latime,
      y: this.y,
      size: marime,
      font,
      color: optiuni.culoare ?? NEGRU,
    });
  }

  linie(optiuni: { readonly grosime?: number; readonly culoare?: RGB } = {}): void {
    this.pagina.drawLine({
      start: { x: MARGINE, y: this.y },
      end: { x: this.latime - MARGINE, y: this.y },
      thickness: optiuni.grosime ?? 0.5,
      color: optiuni.culoare ?? LINIE,
    });
  }

  /**
   * Lățimea unui text, în puncte.
   *
   * Expusă fiindcă `pdf-lib` NU are noțiune de flux: încadrarea unui paragraf
   * (`src/lib/pdf/flux.ts`) trebuie să măsoare cuvânt cu cuvânt ca să știe unde
   * să rupă rândul, iar fonturile sunt private aici.
   */
  latimeText(continut: string, marime = 9, aldin = false): number {
    const font = aldin ? this.context.fonturi.aldin : this.context.fonturi.normal;
    return font.widthOfTextAtSize(continut, marime);
  }

  /**
   * Taie un text la lățimea disponibilă, cu „…" la capăt.
   *
   * Fără asta, un nume lung intră peste coloana următoare — `pdf-lib` nu
   * decupează nimic, desenează pur și simplu în afara casetei.
   */
  trunchiaza(continut: string, latimeMaxima: number, marime = 9, aldin = false): string {
    const font = aldin ? this.context.fonturi.aldin : this.context.fonturi.normal;
    if (font.widthOfTextAtSize(continut, marime) <= latimeMaxima) return continut;
    let taiat = continut;
    while (taiat.length > 1 && font.widthOfTextAtSize(`${taiat}…`, marime) > latimeMaxima) {
      taiat = taiat.slice(0, -1);
    }
    return `${taiat}…`;
  }
}

export interface AntetOrganizatie {
  readonly denumire: string;
  readonly cui: string | null;
  readonly regCom: string | null;
  readonly adresa: string | null;
}

/** Antetul comun tuturor documentelor oficiale: firma emitentă, apoi titlul. */
export function deseneazaAntet(
  cursor: Cursor,
  organizatie: AntetOrganizatie,
  titlu: string,
  subtitlu: string | null,
): void {
  cursor.text(organizatie.denumire, { marime: 12, aldin: true, coboaraCu: 13 });

  const identificare = [
    organizatie.cui === null ? null : `CUI ${organizatie.cui}`,
    organizatie.regCom === null ? null : `Reg. com. ${organizatie.regCom}`,
  ].filter((v): v is string => v !== null);
  if (identificare.length > 0) {
    cursor.text(identificare.join(" · "), { marime: 8, culoare: GRI, coboaraCu: 10 });
  }
  if (organizatie.adresa !== null) {
    cursor.text(organizatie.adresa, { marime: 8, culoare: GRI, coboaraCu: 10 });
  }

  cursor.coboara(10);
  cursor.linie({ grosime: 1, culoare: ACCENT });
  cursor.coboara(18);

  cursor.text(titlu, { marime: 14, aldin: true, coboaraCu: subtitlu === null ? 20 : 14 });
  if (subtitlu !== null) {
    cursor.text(subtitlu, { marime: 9, culoare: GRI, coboaraCu: 20 });
  }
}

/**
 * Numerotarea paginilor, la final.
 *
 * Se desenează DUPĂ ce tot conținutul e scris: până atunci nu se știe câte
 * pagini sunt, iar un stat de plată fără „pagina 2 din 7" e un document pe care
 * nu poți dovedi că l-ai primit întreg.
 */
export function numeroteazaPaginile(context: ContextPdf, subsol: string): void {
  const pagini = context.doc.getPages();
  const total = pagini.length;
  pagini.forEach((pagina, index) => {
    const eticheta = `${subsol} · pagina ${String(index + 1)} din ${String(total)}`;
    const latime = context.fonturi.normal.widthOfTextAtSize(eticheta, 7);
    pagina.drawText(eticheta, {
      x: (pagina.getWidth() - latime) / 2,
      y: MARGINE / 2,
      size: 7,
      font: context.fonturi.normal,
      color: GRI,
    });
  });
}

/** Numele fișierului, curățat de diacritice și de orice n-ar trece prin `Content-Disposition`. */
export function numeFisier(baza: string): string {
  const fara = baza.normalize("NFD").replace(/\p{M}+/gu, "");
  return fara
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}
