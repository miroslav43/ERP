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
