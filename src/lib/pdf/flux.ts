// src/lib/pdf/flux.ts
// Flux de text peste `Cursor`: paragrafe încadrate, titluri, liste numerotate.
//
// ── CE LIPSEA ────────────────────────────────────────────────────────────────
// `pdf-lib` nu are noțiune de flux: `drawText` desenează la coordonate absolute
// și NU rupe rândul. Un paragraf lung iese pur și simplu din pagină, în afara
// casetei, fără nicio eroare. `Cursor` (`document.ts`) rezolvase coborârea și
// paginarea — destul pentru fluturași și state de plată, care sunt tabele — dar
// nu și încadrarea, de care are nevoie orice document cu clauze.
//
// Aici stă doar aritmetica: măsoară, rupe, coboară. Fonturile rămân în
// `document.ts`, unde sunt încărcate o singură dată per proces.
import "server-only";

import { Cursor, GRI, NEGRU, type ContextPdf } from "./document";

/** Înălțimea unui rând, ca multiplu al mărimii literei. */
const INTERLINIE = 1.45;

/**
 * Rupe un text la lățimea dată, cuvânt cu cuvânt.
 *
 * Un cuvânt mai lat decât rândul întreg (un URL, un IBAN lipit) primește rând
 * propriu și iese în afară — deliberat: alternativa e ruperea în mijlocul lui,
 * iar într-un contract un IBAN tăiat în două e mai rău decât unul care atinge
 * marginea.
 */
export function rupeInRanduri(
  cursor: Cursor,
  continut: string,
  latime: number,
  marime: number,
  aldin: boolean,
): readonly string[] {
  const cuvinte = continut.split(/\s+/u).filter((c) => c !== "");
  if (cuvinte.length === 0) return [];

  const randuri: string[] = [];
  let curent = "";

  for (const cuvant of cuvinte) {
    const incercare = curent === "" ? cuvant : `${curent} ${cuvant}`;
    if (curent !== "" && cursor.latimeText(incercare, marime, aldin) > latime) {
      randuri.push(curent);
      curent = cuvant;
    } else {
      curent = incercare;
    }
  }
  if (curent !== "") randuri.push(curent);
  return randuri;
}

export type OptiuniParagraf = Readonly<{
  marime?: number;
  aldin?: boolean;
  /** Retragere la stânga, pentru elementele de listă. */
  indent?: number;
  /** Spațiul lăsat dedesubt, în puncte. */
  spatiuDupa?: number;
  gri?: boolean;
}>;

/**
 * Un paragraf, încadrat la lățimea utilă a paginii.
 *
 * `asiguraSpatiu` înaintea FIECĂRUI rând, nu o dată la început: un paragraf de
 * opt rânduri început la două rânduri de marginea de jos ar fi desenat șase
 * rânduri peste subsol dacă rezervarea s-ar face în bloc.
 */
export function paragraf(cursor: Cursor, continut: string, optiuni: OptiuniParagraf = {}): void {
  const marime = optiuni.marime ?? 9;
  const aldin = optiuni.aldin ?? false;
  const indent = optiuni.indent ?? 0;
  const inaltimeRand = marime * INTERLINIE;

  const randuri = rupeInRanduri(cursor, continut, cursor.latimeUtila - indent, marime, aldin);
  for (const rand of randuri) {
    cursor.asiguraSpatiu(inaltimeRand);
    cursor.text(rand, {
      x: 40 + indent,
      marime,
      aldin,
      culoare: optiuni.gri === true ? GRI : NEGRU,
      coboaraCu: inaltimeRand,
    });
  }
  if (optiuni.spatiuDupa !== undefined && randuri.length > 0) cursor.coboara(optiuni.spatiuDupa);
}

/** O bucată de text cu o singură greutate de literă. */
export type Segment = Readonly<{ text: string; aldin: boolean }>;

/** Un cuvânt, cu bucățile lui de greutăți diferite și lățimea totală. */
type Cuvant = Readonly<{ runuri: readonly Segment[]; latime: number }>;

/**
 * Taie segmentele în cuvinte, păstrând greutatea fiecărei litere.
 *
 * Se lucrează pe un șir aplatizat cu o hartă de greutăți per unitate UTF-16, nu
 * segment cu segment: `text<strong>aldin</strong>` n-are spațiu la graniță, deci
 * e UN cuvânt cu două greutăți, iar tăierea pe segmente l-ar fi rupt în două cu
 * un spațiu inventat între ele.
 */
function inCuvinte(
  cursor: Cursor,
  segmente: readonly Segment[],
  marime: number,
): readonly Cuvant[] {
  let plat = "";
  const greutati: boolean[] = [];
  for (const segment of segmente) {
    for (let i = 0; i < segment.text.length; i += 1) greutati.push(segment.aldin);
    plat += segment.text;
  }

  const cuvinte: Cuvant[] = [];
  const tipar = /\S+/gu;
  let potrivire: RegExpExecArray | null;

  while ((potrivire = tipar.exec(plat)) !== null) {
    const inceput = potrivire.index;
    const runuri: Segment[] = [];
    let pornire = inceput;

    for (let i = inceput; i <= inceput + potrivire[0].length; i += 1) {
      const sfarsit = i === inceput + potrivire[0].length;
      if (sfarsit || greutati[i] !== greutati[pornire]) {
        runuri.push({ text: plat.slice(pornire, i), aldin: greutati[pornire] === true });
        pornire = i;
      }
    }
    cuvinte.push({
      runuri,
      latime: runuri.reduce((suma, r) => suma + cursor.latimeText(r.text, marime, r.aldin), 0),
    });
  }
  return cuvinte;
}

/**
 * Un paragraf în care unele bucăți sunt aldine.
 *
 * `paragraf()` primește un `string` și o singură greutate, fiindcă atât cereau
 * șabloanele scrise de noi. De când o firmă își poate îngroșa singură o clauză
 * în editor, `<strong>` trebuie să ajungă pe hârtie — altfel bara editorului
 * promite o formatare pe care PDF-ul o pierde tăcut.
 *
 * Fontul aldin e deja încorporat și subsetat în `document.ts`; aici nu se adaugă
 * niciun fișier.
 */
export function paragrafBogat(
  cursor: Cursor,
  segmente: readonly Segment[],
  optiuni: OptiuniParagraf = {},
): void {
  const marime = optiuni.marime ?? 9;
  const indent = optiuni.indent ?? 0;
  const cuvinte = inCuvinte(cursor, segmente, marime);
  if (cuvinte.length === 0) return;

  const randuri = incadreaza(cursor, cuvinte, cursor.latimeUtila - indent, marime);
  const culoare = optiuni.gri === true ? GRI : NEGRU;
  for (const rand of randuri) {
    deseneazaRand(cursor, rand, { x: 40 + indent, marime, culoare });
  }
  if (optiuni.spatiuDupa !== undefined) cursor.coboara(optiuni.spatiuDupa);
}

/**
 * Încadrarea lacomă, pe lățimi deja măsurate.
 *
 * Aceeași regulă ca în `rupeInRanduri`: un cuvânt mai lat decât rândul întreg
 * primește rând propriu și iese în afară, în loc să fie rupt în mijloc — într-un
 * contract, un IBAN tăiat în două e mai rău decât unul care atinge marginea.
 */
function incadreaza(
  cursor: Cursor,
  cuvinte: readonly Cuvant[],
  latimeDisponibila: number,
  marime: number,
): readonly (readonly Cuvant[])[] {
  const latimeSpatiu = cursor.latimeText(" ", marime, false);
  const randuri: Cuvant[][] = [];
  let curent: Cuvant[] = [];
  let latimeCurenta = 0;

  for (const cuvant of cuvinte) {
    const cuSpatiu = curent.length === 0 ? cuvant.latime : latimeSpatiu + cuvant.latime;
    if (curent.length > 0 && latimeCurenta + cuSpatiu > latimeDisponibila) {
      randuri.push(curent);
      curent = [cuvant];
      latimeCurenta = cuvant.latime;
    } else {
      curent.push(cuvant);
      latimeCurenta += cuSpatiu;
    }
  }
  if (curent.length > 0) randuri.push(curent);
  return randuri;
}

/**
 * Desenează un rând și coboară cu o interlinie.
 *
 * `asiguraSpatiu` se cheamă înaintea FIECĂRUI rând, ca în `paragraf`: altfel un
 * paragraf lung început lângă marginea de jos s-ar desena peste subsol.
 */
function deseneazaRand(
  cursor: Cursor,
  rand: readonly Cuvant[],
  optiuni: Readonly<{ x: number; marime: number; culoare?: typeof NEGRU; marcator?: string }>,
): void {
  const inaltimeRand = optiuni.marime * INTERLINIE;
  const latimeSpatiu = cursor.latimeText(" ", optiuni.marime, false);
  cursor.asiguraSpatiu(inaltimeRand);

  if (optiuni.marcator !== undefined) {
    cursor.text(optiuni.marcator, { x: 40, marime: optiuni.marime });
  }

  let x = optiuni.x;
  rand.forEach((cuvant, indice) => {
    if (indice > 0) x += latimeSpatiu;
    for (const run of cuvant.runuri) {
      cursor.text(run.text, {
        x,
        marime: optiuni.marime,
        aldin: run.aldin,
        ...(optiuni.culoare === undefined ? {} : { culoare: optiuni.culoare }),
      });
      x += cursor.latimeText(run.text, optiuni.marime, run.aldin);
    }
  });
  cursor.coboara(inaltimeRand);
}

/**
 * O listă ale cărei elemente pot conține bucăți aldine.
 *
 * Ca la `lista()`, marcatorul se desenează pe primul rând al elementului, iar
 * continuarea se aliniază sub text, nu sub marcator.
 */
export function listaBogata(
  cursor: Cursor,
  elemente: readonly (readonly Segment[])[],
  optiuni: Readonly<{ numerotata?: boolean; marime?: number }> = {},
): void {
  const marime = optiuni.marime ?? 9;
  const indent = 16;

  elemente.forEach((element, indice) => {
    const cuvinte = inCuvinte(cursor, element, marime);
    if (cuvinte.length === 0) return;
    const randuri = incadreaza(cursor, cuvinte, cursor.latimeUtila - indent, marime);

    randuri.forEach((rand, pozitie) => {
      deseneazaRand(cursor, rand, {
        x: 40 + indent,
        marime,
        ...(pozitie === 0
          ? { marcator: optiuni.numerotata === true ? `${String(indice + 1)}.` : "•" }
          : {}),
      });
    });
  });
}

/** Un titlu de secțiune — aldin, cu aer înainte și după. */
export function titluSectiune(cursor: Cursor, continut: string, marime = 10): void {
  cursor.coboara(6);
  paragraf(cursor, continut, { marime, aldin: true, spatiuDupa: 3 });
}

/**
 * O listă, numerotată sau cu bulină.
 *
 * Marcatorul se desenează pe primul rând al elementului, iar continuarea se
 * aliniază sub text, nu sub marcator — altfel al doilea rând al unei clauze ar
 * porni din dreptul cifrei și lista și-ar pierde forma.
 */
export function lista(
  cursor: Cursor,
  elemente: readonly string[],
  optiuni: Readonly<{ numerotata?: boolean; marime?: number }> = {},
): void {
  const marime = optiuni.marime ?? 9;
  const inaltimeRand = marime * INTERLINIE;
  const indent = 16;

  elemente.forEach((element, indice) => {
    const marcator = optiuni.numerotata === true ? `${String(indice + 1)}.` : "•";
    const randuri = rupeInRanduri(cursor, element, cursor.latimeUtila - indent, marime, false);

    randuri.forEach((rand, pozitie) => {
      cursor.asiguraSpatiu(inaltimeRand);
      if (pozitie === 0) cursor.text(marcator, { x: 40, marime });
      cursor.text(rand, { x: 40 + indent, marime, coboaraCu: inaltimeRand });
    });
  });
}

/** Locul de semnătură, la finalul unui document oficial. */
export function semnaturi(cursor: Cursor, stanga: string, dreapta: string): void {
  cursor.asiguraSpatiu(60);
  cursor.coboara(28);
  cursor.text(stanga, { marime: 9, aldin: true });
  cursor.text(dreapta, { x: 320, marime: 9, aldin: true, coboaraCu: 16 });
  cursor.text("_______________________", { marime: 9, culoare: GRI });
  cursor.text("_______________________", { x: 320, marime: 9, culoare: GRI, coboaraCu: 14 });
}

/** Re-export, ca apelantul să nu importe din două module pentru un singur PDF. */
export type { ContextPdf };
export { Cursor };
