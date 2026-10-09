import type { Scrisoare } from "./scrisoare";

/**
 * Așezarea unei `Scrisoare` pe pagini A4, ca listă de operații de desen.
 *
 * ── DE CE SEPARAT DE PDF ───────────────────────────────────────────────────
 * `pdf-lib` desenează la coordonate absolute și nu are flux de text. Dacă
 * geometria ar sta în randare, singurul test posibil ar fi „PDF-ul se
 * deschide” — nu și „«CERERE» e centrat” sau „nimic nu iese din margine”.
 * Aici geometria e o funcție pură, cu măsurarea textului injectată: testele o
 * verifică cu o măsură falsă și cu fontul real, iar randarea doar execută.
 *
 * Constantele A4 sunt scrise aici, nu importate din `src/lib/pdf/document.ts`:
 * acela e `server-only`. Un test le compară.
 */

/** A4 portret, în puncte PostScript. */
export const LATIME_PAGINA = 595.28;
export const INALTIME_PAGINA = 841.89;
/** 2 cm, marginea obișnuită a unei scrisori. */
export const MARGINE_SCRISOARE = 57;
/** Locul păstrat jos pentru rândul cu legătura spre unealtă. */
export const REZERVA_SUBSOL = 28;

export type Masoara = (text: string, marime: number, aldin: boolean) => number;

export type OperatieText = Readonly<{
  tip: "text";
  text: string;
  x: number;
  /** Linia de bază. */
  y: number;
  marime: number;
  aldin: boolean;
  /** Gri: notele și etichetele semnăturilor. */
  slab: boolean;
}>;
export type OperatieLinie = Readonly<{
  tip: "linie";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}>;
export type Operatie = OperatieText | OperatieLinie;
export type PaginaAsezata = readonly Operatie[];

const CORP = 11;
const INTERLINIE = 1.45;
/** Lățimea coloanei semnăturii salariatului, în dreapta. */
const COLOANA_SEMNATURA = 170;

/**
 * Rupe textul pe cuvinte, în rânduri care încap în `latime`. Un cuvânt mai lat
 * decât rândul se rupe pe litere, pe mai multe rânduri — nu se taie cu „…”:
 * într-o cerere de semnat, un nume trunchiat e mai rău decât unul rupt.
 * Literele se numără ca puncte de cod, ca un emoji să nu fie tăiat în două.
 */
export function rupe(text: string, latime: number, masoara: (t: string) => number): string[] {
  const randuri: string[] = [];
  let curent = "";
  for (const cuvant of text.split(/\s+/u).filter((c) => c !== "")) {
    const incercare = curent === "" ? cuvant : `${curent} ${cuvant}`;
    if (masoara(incercare) <= latime) {
      curent = incercare;
      continue;
    }
    if (curent !== "") randuri.push(curent);
    let litere = Array.from(cuvant);
    while (litere.length > 0 && masoara(litere.join("")) > latime) {
      // Cel mai lung prefix care încape, prin căutare binară (ca `taie` din pdf.ts).
      let jos = 1;
      let sus = litere.length;
      while (jos < sus) {
        const mijloc = Math.ceil((jos + sus) / 2);
        if (masoara(litere.slice(0, mijloc).join("")) <= latime) jos = mijloc;
        else sus = mijloc - 1;
      }
      randuri.push(litere.slice(0, jos).join(""));
      litere = litere.slice(jos);
    }
    curent = litere.join("");
  }
  if (curent !== "") randuri.push(curent);
  return randuri.length > 0 ? randuri : [""];
}

type Aliniere = "stanga" | "dreapta" | "centru";

export function asezaScrisoarea(s: Scrisoare, masoara: Masoara): readonly PaginaAsezata[] {
  const latimePagina = LATIME_PAGINA;
  const margine = MARGINE_SCRISOARE;
  const util = latimePagina - 2 * margine;
  let pagina: Operatie[] = [];
  const pagini: Operatie[][] = [pagina];
  let y = INALTIME_PAGINA - margine;

  const paginaNoua = () => {
    pagina = [];
    pagini.push(pagina);
    y = INALTIME_PAGINA - margine;
  };
  const asigura = (necesar: number) => {
    if (y - necesar < margine + REZERVA_SUBSOL) paginaNoua();
  };
  const coboara = (puncte: number) => {
    y -= puncte;
  };

  /** Un text rupt pe rânduri: fiecare rând coboară întâi, apoi se scrie pe linia de bază. */
  const bloc = (
    text: string,
    marime: number,
    aliniere: Aliniere,
    optiuni: Readonly<{ aldin?: boolean; slab?: boolean; x?: number; latime?: number }> = {},
  ) => {
    const aldin = optiuni.aldin ?? false;
    const slab = optiuni.slab ?? false;
    const x0 = optiuni.x ?? margine;
    const latime = optiuni.latime ?? util;
    const pas = marime * INTERLINIE;
    for (const rand of rupe(text, latime, (t) => masoara(t, marime, aldin))) {
      asigura(pas);
      y -= pas;
      const w = masoara(rand, marime, aldin);
      const x =
        aliniere === "stanga"
          ? x0
          : aliniere === "dreapta"
            ? x0 + latime - w
            : x0 + (latime - w) / 2;
      pagina.push({ tip: "text", text: rand, x, y, marime, aldin, slab });
    }
  };

  bloc(s.inregistrare, 10, "stanga");
  coboara(4);
  bloc(s.catre, CORP, "dreapta", { x: margine + util * 0.4, latime: util * 0.6 });
  coboara(36);
  bloc(s.titlu, 16, "centru", { aldin: true });
  if (s.subtitlu !== null) bloc(s.subtitlu, CORP, "centru");
  coboara(20);
  for (const p of s.paragrafe) {
    bloc(p, CORP, "stanga");
    coboara(8);
  }

  // Locul și data în stânga, semnătura în dreapta, pe aceeași linie de bază.
  coboara(24);
  asigura(CORP * INTERLINIE * 3 + 40);
  const xSemnatura = latimePagina - margine - COLOANA_SEMNATURA;
  const yRand = y;
  bloc(s.locSiData, CORP, "stanga", { latime: xSemnatura - margine - 12 });
  const yDupaLoc = y;
  y = yRand;
  bloc(s.semnatura, CORP, "centru", { x: xSemnatura, latime: COLOANA_SEMNATURA });
  coboara(30);
  pagina.push({ tip: "linie", x1: xSemnatura, y1: y, x2: latimePagina - margine, y2: y });
  y = Math.min(y, yDupaLoc);

  if (s.rubrica !== null) {
    const r = s.rubrica;
    coboara(30);
    // Rubrica se ține pe o singură pagină: titlul, rândurile și semnăturile.
    asigura(10 * INTERLINIE * (r.randuri.length + 1) + 70);
    pagina.push({ tip: "linie", x1: margine, y1: y, x2: latimePagina - margine, y2: y });
    coboara(6);
    bloc(r.titlu, 10, "stanga", { aldin: true });
    coboara(2);
    for (const rand of r.randuri) bloc(rand, 10, "stanga");
    if (r.semnaturi.length > 0) {
      coboara(40);
      const lat = util / r.semnaturi.length;
      const yLinie = y;
      let yMinim = y;
      r.semnaturi.forEach((eticheta, i) => {
        const x = margine + i * lat;
        pagina.push({ tip: "linie", x1: x, y1: yLinie, x2: x + lat - 18, y2: yLinie });
        y = yLinie;
        bloc(eticheta, 9, "stanga", { x, latime: lat - 18, slab: true });
        yMinim = Math.min(yMinim, y);
      });
      y = yMinim;
    }
  }

  if (s.note.length > 0) {
    coboara(16);
    for (const n of s.note) bloc(n, 8, "stanga", { slab: true });
  }

  return pagini;
}
