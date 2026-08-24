// src/domain/departments/arbore.test.ts
import { describe, expect, it } from "vitest";

import { construiesteArbore, type NodArbore } from "./arbore";

/**
 * Funcțiile astea trăiau în `departamente/page.tsx`, deci nu putea fi testată
 * niciuna. Cazurile de mai jos nu sunt ipotetice: orfanul apare de fiecare dată
 * când un părinte e șters logic, iar efectivul cumulat e cifra pe care
 * organigrama o afișează în pătrat — dacă e greșită, e greșită tăcut.
 */

interface Rand {
  readonly id: string;
  readonly parent_id: string | null;
  readonly denumire: string;
}

const rand = (id: string, parent_id: string | null, denumire = id): Rand => ({
  id,
  parent_id,
  denumire,
});

/** Toate id-urile din arbore, aplatizate — ca să se poată număra duplicatele. */
function toateIdUrile(noduri: readonly NodArbore<Rand>[]): string[] {
  return noduri.flatMap((n) => [n.date.id, ...toateIdUrile(n.copii)]);
}

describe("construiesteArbore", () => {
  it("întoarce lista goală pentru intrare goală", () => {
    expect(construiesteArbore<Rand>([], new Map())).toEqual([]);
  });

  it("așază la rădăcină nodurile cu parent_id null", () => {
    const arbore = construiesteArbore([rand("a", null), rand("b", null)], new Map());
    expect(arbore.map((n) => n.date.id)).toEqual(["a", "b"]);
    expect(arbore[0]?.copii).toEqual([]);
  });

  it("promovează la rădăcină un nod al cărui părinte lipsește din set", () => {
    // Părintele „x" e șters logic sau invizibil prin RLS. Nodul NU se pierde.
    const arbore = construiesteArbore([rand("orfan", "x")], new Map());
    expect(arbore.map((n) => n.date.id)).toEqual(["orfan"]);
    expect(arbore[0]?.nivel).toBe(1);
  });

  it("păstrează ordinea dintre frați exact cum a primit-o", () => {
    const arbore = construiesteArbore(
      [rand("p", null), rand("z", "p"), rand("a", "p"), rand("m", "p")],
      new Map(),
    );
    expect(arbore[0]?.copii.map((n) => n.date.id)).toEqual(["z", "a", "m"]);
  });

  it("numără efectivul direct din hartă, zero când lipsește", () => {
    const arbore = construiesteArbore([rand("a", null)], new Map([["a", 5]]));
    expect(arbore[0]?.efectivDirect).toBe(5);
    const gol = construiesteArbore([rand("b", null)], new Map());
    expect(gol[0]?.efectivDirect).toBe(0);
  });

  it("cumulează efectivul pe tot subarborele, pe trei niveluri", () => {
    const randuri = [rand("r", null), rand("c1", "r"), rand("c2", "r"), rand("n", "c1")];
    const efectiv = new Map([
      ["r", 1],
      ["c1", 2],
      ["c2", 4],
      ["n", 8],
    ]);
    const arbore = construiesteArbore(randuri, efectiv);
    expect(arbore[0]?.efectivCumulat).toBe(15);
    expect(arbore[0]?.copii[0]?.efectivCumulat).toBe(10); // c1 + n
    expect(arbore[0]?.copii[1]?.efectivCumulat).toBe(4); // c2 singur
  });

  it("numerotează nivelurile de la 1", () => {
    const arbore = construiesteArbore([rand("r", null), rand("c", "r")], new Map());
    expect(arbore[0]?.nivel).toBe(1);
    expect(arbore[0]?.copii[0]?.nivel).toBe(2);
  });

  it("nu intră în buclă infinită pe un ciclu și nu pierde nodurile ciclate", () => {
    // Baza împiedică ciclurile prin trigger, dar funcția asta nu poate presupune
    // asta: primește ce i se dă. Contractul e că se OPREȘTE și nu pierde nimic.
    const arbore = construiesteArbore([rand("a", "b"), rand("b", "a")], new Map());
    expect(toateIdUrile(arbore).sort()).toEqual(["a", "b"]);
  });

  it("nu DUPLICĂ un nod prins într-un ciclu", () => {
    // Apărarea reparației: coada care promovează nodurile neatinse trebuie să
    // verifice `vizitate` la fiecare iterație. Un `.filter().map()` evaluează
    // filtrul integral ÎNAINTE de prima construcție, deci al doilea nod al
    // ciclului ar apărea și ca fiu al primului, și ca rădăcină separată.
    const arbore = construiesteArbore(
      [rand("a", "b"), rand("b", "a"), rand("liber", null)],
      new Map(),
    );
    const idUri = toateIdUrile(arbore);
    expect(idUri.length).toBe(new Set(idUri).size);
    expect(idUri.sort()).toEqual(["a", "b", "liber"]);
  });

  it("nu duplică nimic nici pe un ciclu de trei", () => {
    const arbore = construiesteArbore(
      [rand("x", "z"), rand("y", "x"), rand("z", "y")],
      new Map(),
    );
    const idUri = toateIdUrile(arbore);
    expect(idUri.length).toBe(new Set(idUri).size);
    expect(idUri.sort()).toEqual(["x", "y", "z"]);
  });
});
