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
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";

import {
  randuriBlocFirma,
  type AntetOrganizatie,
  type SiglaOrganizatie,
} from "@/lib/documents/bloc-firma";

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

// Tipul trăiește lângă regula care îl compune (`randuriBlocFirma`), fiindcă
// regula e juridică, nu grafică — vezi capul lui `bloc-firma.ts`. Se reexportă
// de aici ca importurile existente (`din-html`, `fluturas`, `stat-plata`) să
// rămână neatinse.
export type { AntetOrganizatie, SiglaOrganizatie } from "@/lib/documents/bloc-firma";

/** Înălțimea maximă a siglei în antet. Lățimea se deduce păstrând proporția. */
const INALTIME_SIGLA = 34;
/** În subsol e mai mică: acolo încap trei rânduri de text și numerotarea paginii. */
const INALTIME_SIGLA_SUBSOL = 20;

/**
 * Încorporează sigla și întoarce dimensiunile la care se desenează.
 *
 * `null` la orice eșec: `pdf-lib` aruncă pe un PNG stricat sau pe un JPEG
 * progresiv, iar un contract care nu se mai generează din cauza unei imagini
 * decorative ar fi cel mai prost compromis posibil.
 */
async function incorporeazaSigla(
  context: ContextPdf,
  sigla: SiglaOrganizatie,
  inaltimeMaxima: number,
): Promise<{
  readonly imagine: PDFImage;
  readonly latime: number;
  readonly inaltime: number;
} | null> {
  try {
    const imagine =
      sigla.tip === "image/png"
        ? await context.doc.embedPng(sigla.octeti)
        : await context.doc.embedJpg(sigla.octeti);
    const scara = inaltimeMaxima / imagine.height;
    // Sigle foarte late (bannere) ar împinge textul în afara paginii: lățimea se
    // plafonează la un sfert din lățimea utilă, chiar dacă înălțimea scade.
    const latimeMaxima = (LATIME_A4 - 2 * MARGINE) / 4;
    const latime = Math.min(imagine.width * scara, latimeMaxima);
    return { imagine, latime, inaltime: imagine.height * (latime / imagine.width) };
  } catch {
    return null;
  }
}

/**
 * Antetul comun tuturor documentelor oficiale: firma emitentă, apoi titlul.
 *
 * Când firma a ales SUBSOLUL, blocul de identificare nu se desenează aici — îl
 * pune `deseneazaSubsolFirma()` pe fiecare pagină, la final. Titlul rămâne sus
 * în ambele cazuri: e titlul documentului, nu al firmei.
 */
export async function deseneazaAntet(
  cursor: Cursor,
  context: ContextPdf,
  organizatie: AntetOrganizatie,
  titlu: string,
  subtitlu: string | null,
): Promise<void> {
  if (organizatie.pozitie === "antet") {
    const randuri = randuriBlocFirma(organizatie);
    const sigla =
      organizatie.sigla === null
        ? null
        : await incorporeazaSigla(context, organizatie.sigla, INALTIME_SIGLA);

    // Sigla se desenează la stânga, iar textul se retrage cu lățimea ei plus un
    // spațiu. Fără retragere, un logo pătrat ar sta peste denumirea firmei.
    const xText = sigla === null ? MARGINE : MARGINE + sigla.latime + 12;
    if (sigla !== null) {
      cursor.asiguraSpatiu(sigla.inaltime);
      cursor.paginaCurenta.drawImage(sigla.imagine, {
        x: MARGINE,
        // `yCurent` e linia de bază a primului rând de text; imaginea se agață
        // de ea și crește în sus, ca să fie aliniată cu denumirea.
        y: cursor.yCurent - (sigla.inaltime - 12),
        width: sigla.latime,
        height: sigla.inaltime,
      });
    }

    const [denumire, ...restul] = randuri;
    cursor.text(denumire ?? organizatie.denumire, {
      x: xText,
      marime: 12,
      aldin: true,
      coboaraCu: 13,
    });
    for (const rand of restul) {
      cursor.text(rand, { x: xText, marime: 8, culoare: GRI, coboaraCu: 10 });
    }

    // Sigla poate fi mai înaltă decât rândurile de text; fără corecție, linia de
    // accent ar tăia logoul.
    if (sigla !== null) {
      const inaltimeText = 13 + restul.length * 10;
      if (sigla.inaltime > inaltimeText) cursor.coboara(sigla.inaltime - inaltimeText);
    }

    cursor.coboara(10);
    cursor.linie({ grosime: 1, culoare: ACCENT });
    cursor.coboara(18);
  }

  cursor.text(titlu, { marime: 14, aldin: true, coboaraCu: subtitlu === null ? 20 : 14 });
  if (subtitlu !== null) {
    cursor.text(subtitlu, { marime: 9, culoare: GRI, coboaraCu: 20 });
  }
}

/**
 * Blocul de identificare tipărit JOS, pe fiecare pagină.
 *
 * Se apelează la final, ca `numeroteazaPaginile()` și din același motiv: până
 * atunci nu se știe câte pagini are documentul. Ordinea contează — blocul ăsta
 * ocupă banda dintre y = 30 și y = 62, iar numerotarea stă sub el, la
 * `MARGINE / 2` = 20. Podeaua conținutului rămâne `MARGINE + 30` = 70
 * (`Cursor.coboara`), deci nimic nu se suprapune.
 *
 * Nicio normă nu cere antetul: Legea 31/1990 art. 74 cere ca datele să fie ÎN
 * document, nu în capul lui. Subsolul e la fel de legal.
 */
export async function deseneazaSubsolFirma(
  context: ContextPdf,
  organizatie: AntetOrganizatie,
): Promise<void> {
  if (organizatie.pozitie !== "subsol") return;

  const randuri = randuriBlocFirma(organizatie);
  if (randuri.length === 0) return;

  const sigla =
    organizatie.sigla === null
      ? null
      : await incorporeazaSigla(context, organizatie.sigla, INALTIME_SIGLA_SUBSOL);
  const xText = sigla === null ? MARGINE : MARGINE + sigla.latime + 8;

  for (const pagina of context.doc.getPages()) {
    pagina.drawLine({
      start: { x: MARGINE, y: 64 },
      end: { x: pagina.getWidth() - MARGINE, y: 64 },
      thickness: 0.5,
      color: LINIE,
    });

    if (sigla !== null) {
      pagina.drawImage(sigla.imagine, {
        x: MARGINE,
        y: 62 - sigla.inaltime,
        width: sigla.latime,
        height: sigla.inaltime,
      });
    }

    // De sus în jos, pornind imediat sub linie.
    randuri.forEach((rand, index) => {
      const primul = index === 0;
      pagina.drawText(rand, {
        x: xText,
        y: 54 - index * 9,
        size: primul ? 8 : 7,
        font: primul ? context.fonturi.aldin : context.fonturi.normal,
        color: primul ? NEGRU : GRI,
      });
    });
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
