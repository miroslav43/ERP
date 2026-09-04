// src/lib/incarcare/stiati-ca.test.ts
import { describe, expect, it } from "vitest";

import { MESAJE, mesajAleator } from "./stiati-ca";

/**
 * Ce apără fișierul: constrângerile pe care ochiul nu le vede la review.
 *
 * Sedila e cea care scapă cel mai des: ş și ţ (U+015F/U+0163) aparțin
 * alfabetului turc, iar în Inter cu subsetul `latin-ext` browserul cade pe un
 * font de rezervă exact pentru ele — textul apare cu grosimi amestecate în
 * mijlocul cuvântului. Se citește ca o defecțiune, nu ca o greșeală de scriere.
 */

const SEDILE = /[şŞţŢ]/u;
const LUNGIME_MAXIMA = 120;

describe("mesajele „Știați că…”", () => {
  it("sunt nouăzeci și nouă", () => {
    expect(MESAJE).toHaveLength(99);
  });

  it("încap într-o așteptare: cel mult 120 de caractere", () => {
    const prea_lungi = MESAJE.filter((m) => m.text.length > LUNGIME_MAXIMA);
    expect(prea_lungi.map((m) => `${String(m.text.length)}: ${m.text}`)).toEqual([]);
  });

  it("folosesc virgula dedesubt, nu sedila", () => {
    expect(MESAJE.filter((m) => SEDILE.test(m.text)).map((m) => m.text)).toEqual([]);
  });

  it("nu se repetă", () => {
    const texte = MESAJE.map((m) => m.text);
    expect(new Set(texte).size).toBe(texte.length);
  });

  it("nu strigă la utilizator", () => {
    expect(MESAJE.filter((m) => m.text.includes("!")).map((m) => m.text)).toEqual([]);
  });

  it("au toate o categorie nevidă", () => {
    expect(MESAJE.filter((m) => m.categorie.trim() === "")).toEqual([]);
  });

  it("`mesajAleator` nu întoarce niciodată mesajul exclus", () => {
    const exclus = MESAJE[0]?.text ?? "";
    for (let i = 0; i < 200; i++) {
      expect(mesajAleator(exclus).text).not.toBe(exclus);
    }
  });

  it("niciun mesaj din categoria „Concedii” nu promite jumătăți de zi (scoase de migrarea 0112_concediu_doar_zi_intreaga.sql)", () => {
    // Nu se caută șirul exact de azi, ci fraza care ar recidiva: „jumătate”
    // (de zi) sau soldul fracționat „0,5”. Restricția la categoria „Concedii”
    // e intenționată — „0,5 zile” la diurnă (fereastra incompletă) e adevărat
    // și despre altă funcție; testul nu trebuie să-l pice.
    const PROMISIUNE_JUMATATE_ZI = /jum[aă]tate|0,5/iu;
    const concedii = MESAJE.filter((m) => m.categorie === "Concedii");
    expect(concedii.filter((m) => PROMISIUNE_JUMATATE_ZI.test(m.text)).map((m) => m.text)).toEqual(
      [],
    );
  });
});
