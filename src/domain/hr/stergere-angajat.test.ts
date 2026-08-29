// src/domain/hr/stergere-angajat.test.ts

import { describe, expect, it } from "vitest";

import {
  mesajRefuzStergere,
  motiveleRefuzuluiStergerii,
  type PiediciStergere,
} from "./stergere-angajat";

const LIBER: PiediciStergere = {
  contracteActive: 0,
  subordonatiDirecti: 0,
  esteFisaProprie: false,
};

describe("piedicile la ștergerea unei fișe", () => {
  it("nu inventează motive când fișa e liberă", () => {
    expect(motiveleRefuzuluiStergerii(LIBER)).toEqual([]);
    expect(mesajRefuzStergere(LIBER)).toBeNull();
  });

  it("le enumeră pe TOATE, nu doar pe prima", () => {
    // Regula cerută explicit: omul trebuie să vadă dintr-o citire tot ce are de
    // rezolvat, nu să afle a doua piedică abia după ce o repară pe prima.
    const motive = motiveleRefuzuluiStergerii({
      contracteActive: 1,
      subordonatiDirecti: 3,
      esteFisaProprie: true,
    });
    expect(motive).toHaveLength(3);
  });

  it("păstrează ordinea efortului: contract, subordonați, fișă proprie", () => {
    const motive = motiveleRefuzuluiStergerii({
      contracteActive: 1,
      subordonatiDirecti: 1,
      esteFisaProprie: true,
    });
    expect(motive[0]).toContain("contract");
    expect(motive[1]).toContain("manager");
    expect(motive[2]).toContain("contului");
  });

  it("acordă numeralul: un / două / douăzeci DE", () => {
    const unul = motiveleRefuzuluiStergerii({ ...LIBER, subordonatiDirecti: 1 })[0] ?? "";
    const trei = motiveleRefuzuluiStergerii({ ...LIBER, subordonatiDirecti: 3 })[0] ?? "";
    const douazeci = motiveleRefuzuluiStergerii({ ...LIBER, subordonatiDirecti: 20 })[0] ?? "";

    expect(unul).toContain("un angajat");
    expect(trei).toContain("3 angajați");
    // Fără „de”, „20 angajați” se citește ca o greșeală de tipar exact în
    // propoziția care refuză o operațiune.
    expect(douazeci).toContain("20 de angajați");
  });

  it("scrie propoziția o singură dată, pentru ecran și pentru server deopotrivă", () => {
    const mesaj = mesajRefuzStergere({
      contracteActive: 2,
      subordonatiDirecti: 0,
      esteFisaProprie: false,
    });
    expect(mesaj).toMatch(/^Nu se poate șterge fișa, pentru că /u);
    expect(mesaj).toContain("2 contracte de muncă active");
    expect(mesaj?.endsWith(".")).toBe(true);
  });

  it("desparte motivele cu punct și virgulă, ca să se citească drept listă", () => {
    const mesaj = mesajRefuzStergere({
      contracteActive: 1,
      subordonatiDirecti: 2,
      esteFisaProprie: false,
    });
    expect(mesaj).toContain("; ");
  });

  it("nu folosește niciodată sedila", () => {
    // Regula proiectului: ș/ț cu virgulă dedesubt (U+0219/U+021B). O sedilă
    // strecurată aici ar ajunge direct sub ochii utilizatorului.
    const toate = motiveleRefuzuluiStergerii({
      contracteActive: 1,
      subordonatiDirecti: 1,
      esteFisaProprie: true,
    }).join(" ");
    expect(toate).not.toMatch(/[şţ]/u);
  });
});
