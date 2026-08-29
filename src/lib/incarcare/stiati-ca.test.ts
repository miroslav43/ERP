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
  it("sunt o sută", () => {
    expect(MESAJE).toHaveLength(100);
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
});
