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
  mapeazaTexte,
  SEMNATURA_FISIER,
  textAntetRulant,
  textPagina,
  type Coloana,
  type DocumentTabelar,
  type SectiuneCasete,
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

/** Rubrica de semnătură dintr-o secțiune de text: eticheta sus, loc de semnat dedesubt. */
const INALT_SEMNATURA = 46;
/** Caseta de viză (medicina muncii, psiholog): rubrica, trei linii, etichetele de jos. */
export const INALT_CASETA = 96;
const SPATIU_CASETE = 12;
/** Antetul de tabel cel mai înalt al fișei SSM: trei rânduri de etichetă. */
const INALT_ANTET_MAX = INALT_RAND + 2 * (MARIME + 2);
/** Tabelele de secțiune cu atâtea rânduri sau mai puține nu se rup între pagini. */
const RANDURI_NERUPTE = 6;

/**
 * Ce desenează randarea, pentru teste. `pdf-lib` nu poate citi textul înapoi:
 * fontul e subsetat, iar în fișier glifele sunt identificatori CID, nu litere.
 * `pagina` se numără în documentul curent, de la 1; `inaltime` e în puncte.
 */
export type SondaPdf = Readonly<{
  text: (pagina: number, text: string) => void;
  cutie: (pagina: number, inaltime: number) => void;
}>;

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

/**
 * Caracterele pe care fontul nu le are devin „?”.
 *
 * DejaVu nu are emoji și nici ideograme: `pdf-lib` le desena ca glifa 0, adică
 * un pătrățel gol, fără niciun semn că s-a pierdut ceva (auditul din 8 oct 2026,
 * „Conducător auto: □□□X□”). Un „?” se vede și se poate corecta de mână.
 * Selectorii de variantă (U+FE00–U+FE0F) care însoțesc emoji-urile se scot, ca
 * „❤️” să dea un singur „?”, nu două. `are` e injectat ca să fie testabil.
 */
export function inlocuiesteGlifeLipsa(text: string, are: (cod: number) => boolean): string {
  let rezultat = "";
  for (const caracter of text) {
    const cod = caracter.codePointAt(0) ?? 0;
    if (cod >= 0xfe00 && cod <= 0xfe0f) continue;
    rezultat += caracter === "\n" || are(cod) ? caracter : "?";
  }
  return rezultat;
}

/**
 * Codurile pe care DejaVu le are în AMBELE grosimi, calculate o dată pe proces:
 * `getCharacterSet()` întoarce ~5.900 de coduri și costă ~20 ms pe apel.
 */
let glifeComune: ReadonlySet<number> | null = null;

export async function randeazaPdf(d: DocumentTabelar, sonda?: SondaPdf): Promise<Uint8Array> {
  return randeazaPdfMultiplu([d], sonda);
}

/**
 * Mai multe documente într-un singur PDF, fiecare de la pagină nouă și cu
 * numerotarea lui („Pagina 1 din 1” nu se scrie). Fontul se încorporează O
 * DATĂ: lipite din PDF-uri separate, 60 de fișe ar fi purtat 60 de subseturi.
 */
export async function randeazaPdfMultiplu(
  bruteDocumente: readonly DocumentTabelar[],
  sonda?: SondaPdf,
): Promise<Uint8Array> {
  const primul = bruteDocumente[0];
  if (primul === undefined) throw new Error("Niciun document de randat.");
  const { doc, fonturi } = await pornesteDocument(primul.titlu, "Administrativo");
  if (glifeComune === null) {
    const aldin = new Set(fonturi.aldin.getCharacterSet());
    glifeComune = new Set(fonturi.normal.getCharacterSet().filter((c) => aldin.has(c)));
  }
  const glife = glifeComune;
  const documente = bruteDocumente.map((d) =>
    mapeazaTexte(d, (t) => inlocuiesteGlifeLipsa(t, (c) => glife.has(c))),
  );

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

  for (const d of documente) deseneaza(doc, fonturi, masoara, d, sonda);
  return doc.save();
}

function deseneaza(
  doc: PDFDocument,
  fonturi: Fonturi,
  masoara: Masurare,
  d: DocumentTabelar,
  sonda: SondaPdf | undefined,
): void {
  const [latime, inaltime] = dimensiuni(d);
  const util = latime - 2 * MARGINE;
  /** Cât încape pe o pagină goală, între marginea de sus și rezerva subsolului. */
  const inaltimeUtila = inaltime - 2 * MARGINE - REZERVA_SUBSOL;
  const latimi = latimiColoane(d);
  const inaltCorp = Math.max(INALT_RAND, d.inaltimeRand ?? INALT_RAND);

  const pagini: PDFPage[] = [];
  let pagina = doc.addPage([latime, inaltime]);
  pagini.push(pagina);
  let y = inaltime - MARGINE;

  /**
   * Singurul loc care scrie text în corpul paginii: sonda testelor vede tot ce
   * apare și pe ce pagină (numărată în documentul curent, de la 1).
   */
  const text = (
    continut: string,
    x: number,
    yText: number,
    marime: number,
    font: PDFFont,
    culoare = NEGRU,
  ) => {
    pagina.drawText(continut, { x, y: yText, size: marime, font, color: culoare });
    if (continut !== "") sonda?.text(pagini.length, continut);
  };
  const paginaNoua = () => {
    pagina = doc.addPage([latime, inaltime]);
    pagini.push(pagina);
    y = inaltime - MARGINE;
  };
  const asiguraLoc = (necesar: number) => {
    if (y - necesar < MARGINE + REZERVA_SUBSOL) paginaNoua();
  };
  /** Proză pe mai multe rânduri; doar celulele de tabel se taie cu „…”. */
  const scrie = (continut: string, marime: number, font: PDFFont, culoare = NEGRU) => {
    const randuri = imparte(continut, util, masoara(font, marime));
    randuri.forEach((rand, k) => {
      asiguraLoc(marime + 6);
      text(rand, MARGINE, y - marime, marime, font, culoare);
      y -= k === randuri.length - 1 ? marime + 6 : marime + 3;
    });
  };

  scrie(d.titlu, 14, fonturi.aldin);
  if (d.subtitlu !== null) scrie(d.subtitlu, 9, fonturi.normal, GRI);
  y -= 4;
  const textCamp = (c: DocumentTabelar["campuri"][number]) =>
    `${c.eticheta}: ${c.valoare === "" ? LINIE_GOALA : c.valoare}`;
  if (d.campuriPeDouaColoane === true) {
    // Câte două câmpuri pe rând; fiecare se rupe pe cuvinte în coloana lui, iar
    // rândul ia înălțimea celui mai lung, ca perechea următoare să nu-l calce.
    const spatiu = 16;
    const latimeColoana = (util - spatiu) / 2;
    for (let i = 0; i < d.campuri.length; i += 2) {
      const pereche = d.campuri
        .slice(i, i + 2)
        .map((c) => imparte(textCamp(c), latimeColoana, masoara(fonturi.normal, 9)));
      const linii = Math.max(...pereche.map((p) => p.length));
      asiguraLoc(linii * 12 + 3);
      pereche.forEach((randuri, k) => {
        randuri.forEach((rand, j) => {
          text(rand, MARGINE + k * (latimeColoana + spatiu), y - 9 - j * 12, 9, fonturi.normal);
        });
      });
      y -= linii * 12 + 3;
    }
  } else {
    for (const c of d.campuri) scrie(textCamp(c), 9, fonturi.normal);
  }
  y -= 4;
  for (const p of d.paragrafe) scrie(p, 10, fonturi.normal);

  /**
   * Un rând de tabel. Etichetele pot avea `\n` (antetul foii de pontaj pune
   * ziua deasupra literei): rândul crește cu numărul de linii, iar fiecare linie
   * se taie separat la lățimea coloanei. Un rând mai înalt decât textul lui
   * (condica, 22 pt) își centrează textul pe verticală. Tabelele suplimentare și
   * cele ale secțiunilor (fișa SSM) își dau propriile lățimi.
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
        text(
          taie(linie, w - 4, masoara(font, MARIME)),
          x + 2,
          y - sus - k * (MARIME + 2),
          MARIME,
          font,
        );
      });
      x += w;
    });
    sonda?.cutie(pagini.length, inalt);
    y -= inalt;
  };

  /** Un tabel cu antetul repetat pe fiecare pagină nouă. */
  const tabel = (
    coloane: readonly Coloana[],
    randuri: readonly (readonly string[])[],
    inaltMinim: number,
    latimiRand: readonly number[] = latimi,
    umbrite: readonly number[] = d.umbrite,
  ) => {
    const antet = coloane.map((c) => c.eticheta);
    asiguraLoc(INALT_RAND * 3);
    rand(antet, true, INALT_RAND, latimiRand, umbrite);
    for (const r of randuri) {
      if (y - inaltMinim < MARGINE + REZERVA_SUBSOL) {
        paginaNoua();
        rand(antet, true, INALT_RAND, latimiRand, umbrite); // antetul se repetă pe fiecare pagină
      }
      rand(r, false, inaltMinim, latimiRand, umbrite);
    }
  };

  /** Rubrici de semnătură etichetate, pe un rând: eticheta sus, loc de semnat dedesubt. */
  const caseteSemnatura = (etichete: readonly string[]) => {
    const pas = util / etichete.length;
    asiguraLoc(INALT_SEMNATURA + 6);
    y -= 4;
    etichete.forEach((eticheta, i) => {
      const x = MARGINE + i * pas;
      pagina.drawRectangle({
        x,
        y: y - INALT_SEMNATURA,
        width: pas - 6,
        height: INALT_SEMNATURA,
        borderColor: CHENAR,
        borderWidth: 0.5,
      });
      imparte(eticheta, pas - 14, masoara(fonturi.normal, 7))
        .slice(0, 2)
        .forEach((r, k) => {
          text(r, x + 4, y - 10 - k * 9, 7, fonturi.normal, GRI);
        });
      sonda?.cutie(pagini.length, INALT_SEMNATURA);
    });
    y -= INALT_SEMNATURA + 6;
  };

  /** O casetă de viză, cu colțul din stânga sus la (x, y). */
  const caseta = (x: number, w: number, s: SectiuneCasete) => {
    pagina.drawRectangle({
      x,
      y: y - INALT_CASETA,
      width: w,
      height: INALT_CASETA,
      borderColor: CHENAR,
      borderWidth: 0.5,
    });
    text(taie(s.rubrica, w - 12, masoara(fonturi.normal, 8)), x + 6, y - 14, 8, fonturi.normal);
    for (const jos of [30, 44, 58]) {
      pagina.drawLine({
        start: { x: x + 6, y: y - jos },
        end: { x: x + w - 6, y: y - jos },
        thickness: 0.5,
        color: CHENAR,
      });
    }
    const pas = (w - 12) / Math.max(1, s.semnaturi.length);
    s.semnaturi.forEach((eticheta, i) => {
      imparte(eticheta, pas - 6, masoara(fonturi.normal, 7))
        .slice(0, 2)
        .forEach((r, k) => {
          text(r, x + 6 + i * pas, y - 74 - k * 9, 7, fonturi.normal, GRI);
        });
    });
    sonda?.cutie(pagini.length, INALT_CASETA);
  };

  if (d.coloane.length > 0) tabel(d.coloane, d.randuri, inaltCorp);

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

  // Secțiunile (fișa SSM), după tabelele suplimentare și înaintea notelor.
  for (const s of d.sectiuni ?? []) {
    switch (s.tip) {
      case "text": {
        y -= 6;
        if (s.titlu !== null) {
          asiguraLoc(60);
          scrie(s.titlu, 10, fonturi.aldin);
        }
        for (const p of s.paragrafe) scrie(p, 9, fonturi.normal);
        if (s.semnaturi.length > 0) caseteSemnatura(s.semnaturi);
        break;
      }
      case "tabel": {
        if (s.coloane.length === 0) break;
        const inaltMinim = Math.max(INALT_RAND, s.inaltimeRand ?? INALT_RAND);
        y -= 6;
        // Titlul nu rămâne singur jos pe pagină: încape cu antetul și două rânduri.
        // Un tabel scurt (testări, accidente, sancțiuni: 5 rânduri) nu se rupe deloc.
        const intreg = 16 + INALT_ANTET_MAX + s.randuri.length * inaltMinim;
        asiguraLoc(
          s.randuri.length <= RANDURI_NERUPTE && intreg <= inaltimeUtila
            ? intreg
            : 16 + INALT_RAND + 2 * inaltMinim,
        );
        scrie(s.titlu, 10, fonturi.aldin);
        tabel(s.coloane, s.randuri, inaltMinim, latimiTabel(d, s.coloane), []);
        break;
      }
      case "casete": {
        y -= 6;
        // Grupul de casete stă pe o singură pagină când încape; altfel măcar un rând.
        const intreg = 16 + Math.ceil(s.numar / 2) * (INALT_CASETA + SPATIU_CASETE);
        asiguraLoc(intreg <= inaltimeUtila ? intreg : 16 + INALT_CASETA + SPATIU_CASETE);
        scrie(s.titlu, 10, fonturi.aldin);
        const w = (util - SPATIU_CASETE) / 2;
        for (let k = 0; k < s.numar; k += 2) {
          asiguraLoc(INALT_CASETA + SPATIU_CASETE);
          caseta(MARGINE, w, s);
          if (k + 1 < s.numar) caseta(MARGINE + w + SPATIU_CASETE, w, s);
          y -= INALT_CASETA + SPATIU_CASETE;
        }
        if (s.nota !== null) scrie(s.nota, 8, fonturi.normal, GRI);
        break;
      }
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
      text(taie(eticheta, pas - 24, masoara(fonturi.normal, 8)), x, y - 11, 8, fonturi.normal, GRI);
    });
    y -= 20;
  }

  // Marginile se scriu la sfârșit: abia acum se știe câte pagini are documentul.
  // Rândul de jos, cu legătura lui, stă pe FIECARE pagină. Până pe 8 oct 2026
  // apărea doar pe ultima: o foaie de parcurs de patru pagini se capsează, se
  // scanează și circulă pe bucăți. Textul devine clicabil printr-o adnotare
  // `Link` cu acțiune `URI`, întinsă exact peste el. `pdf-lib` n-are un API
  // pentru legături; dicționarul e cel din specificația PDF (ISO 32000, 12.5.6.5).
  const latimeText = fonturi.normal.widthOfTextAtSize(SEMNATURA_FISIER, MARIME_MARGINE);
  const adresa = adresaDinFisier(d, "pdf", ADRESA_SITE);
  const masoaraMic = masoara(fonturi.normal, MARIME_MARGINE);
  const antetRulant = taie(textAntetRulant(d), util, masoaraMic);
  pagini.forEach((p, i) => {
    p.drawText(SEMNATURA_FISIER, {
      x: MARGINE,
      y: MARGINE / 2,
      size: MARIME_MARGINE,
      font: fonturi.normal,
      color: GRI,
    });
    const legatura = doc.context.register(
      doc.context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: [MARGINE, MARGINE / 2 - 2, MARGINE + latimeText, MARGINE / 2 + 8],
        Border: [0, 0, 0],
        A: { Type: "Action", S: "URI", URI: PDFString.of(adresa) },
      }),
    );
    p.node.set(PDFName.of("Annots"), doc.context.obj([legatura]));
    if (i > 0) {
      p.drawText(antetRulant, {
        x: MARGINE,
        y: inaltime - MARGINE / 2 - 4,
        size: MARIME_MARGINE,
        font: fonturi.normal,
        color: GRI,
      });
      sonda?.text(i + 1, antetRulant);
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
      sonda?.text(i + 1, numar);
    }
  });
}
