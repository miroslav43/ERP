import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Câmpurile de dată native din lotul QA (UX-026, ONB-033).
 *
 * `<input type="date">` își alege formatul după limba INTERFEȚEI browserului:
 * pe un Chrome în engleză, utilizatorul român vedea „mm/dd/yyyy” în Evaluări,
 * Integrare, Registru, Setări salarizare și în asistentul de înrolare, lângă
 * `IntrareData` („zz.ll.aaaa”) din Concedii și Diurnă. Fișierele de mai jos
 * sunt exact lotul numit de QA; restul aplicației (alte ~30 de fișiere) e o
 * lucrare separată, deci poarta NU e globală — doar împiedică întoarcerea
 * controlului nativ în ecranele deja reparate.
 */

const RADACINA = fileURLToPath(new URL(".", import.meta.url));

const LOT_QA = [
  "(app)/angajati/nou/_components/pas-1-identitate.tsx",
  "(app)/angajati/nou/_components/pas-3-contract.tsx",
  "(app)/angajati/nou/_components/pas-5-bunuri-certificari.tsx",
  "(app)/evaluari/filtre-evaluari.tsx",
  "(app)/onboarding/filtre-instante.tsx",
  "(app)/onboarding/noua/formular-instanta.tsx",
  "(app)/registru/filtre-registru.tsx",
  "(app)/registru/dialog-document-primit.tsx",
  "(app)/registru/nomenclator/dialoguri.tsx",
  "(app)/salarizare/setari/formular-setari.tsx",
] as const;

describe("lotul QA nu mai are câmpuri de dată native", () => {
  it.each(LOT_QA)("%s folosește IntrareData", (cale) => {
    const sursa = readFileSync(join(RADACINA, cale), "utf8");
    expect(sursa).not.toMatch(/type="date"/u);
    expect(sursa).toMatch(/IntrareData/u);
  });
});
