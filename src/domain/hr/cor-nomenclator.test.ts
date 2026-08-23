// src/domain/hr/cor-nomenclator.test.ts

import { describe, expect, it } from "vitest";

import { NOMENCLATOR_COR, cautaOcupatii, codCorExista, ocupatiaDupaCod } from "./cor-nomenclator";

describe("integritatea nomenclatorului COR", () => {
  it("are peste patru mii de ocupații", () => {
    // Ediția 2024 are 4422. Pragul e mai jos ca să nu pice testul la o
    // actualizare, dar destul de sus ca o extragere ruptă să nu treacă.
    expect(NOMENCLATOR_COR.length).toBeGreaterThan(4000);
  });

  it("toate codurile au exact șase cifre", () => {
    const gresite = NOMENCLATOR_COR.filter((o) => !/^\d{6}$/u.test(o.cod));
    expect(gresite).toEqual([]);
  });

  it("niciun cod nu se repetă", () => {
    const unice = new Set(NOMENCLATOR_COR.map((o) => o.cod));
    expect(unice.size).toBe(NOMENCLATOR_COR.length);
  });

  it("nicio denumire goală", () => {
    expect(NOMENCLATOR_COR.filter((o) => o.denumire.trim().length === 0)).toEqual([]);
  });

  it("păstrează ordinea din sursa oficială, inclusiv cele două inversiuni ale ei", () => {
    // Lista publicată de data.gov.ro se numește „în ordinea crescătoare a
    // codurilor" și chiar este — cu DOUĂ excepții, verificate în sursă:
    // 313404 înaintea lui 313403 și 721114 înaintea lui 721113.
    //
    // Nu le sortăm. Un nomenclator oficial se reproduce cum e publicat; a-l
    // „repara" ar însemna că lista noastră nu mai e identică cu a lor, iar la
    // următoarea actualizare diferența ar fi imposibil de urmărit. Testul le
    // fixează ca fapt cunoscut: dacă apare a treia, cineva trebuie s-o vadă.
    const inversiuni: string[] = [];
    for (let i = 1; i < NOMENCLATOR_COR.length; i += 1) {
      const anterior = NOMENCLATOR_COR[i - 1];
      const curent = NOMENCLATOR_COR[i];
      if (anterior === undefined || curent === undefined) continue;
      if (curent.cod <= anterior.cod) inversiuni.push(`${anterior.cod}→${curent.cod}`);
    }
    expect(inversiuni).toEqual(["313404→313403", "721114→721113"]);
  });

  it("nicio denumire nu conține resturi de marcaj XML", () => {
    // Extragerea a citit celule de tabel Word; un regex prea lax ar fi lăsat
    // fragmente de `<w:...>` în text. Aici se vede dacă s-a întâmplat.
    const murdare = NOMENCLATOR_COR.filter((o) => /[<>]/u.test(o.denumire));
    expect(murdare).toEqual([]);
  });
});

describe("căutarea în nomenclator", () => {
  it("găsește o ocupație după cod exact", () => {
    const primul = NOMENCLATOR_COR[0];
    expect(primul).toBeDefined();
    if (primul === undefined) return;
    expect(ocupatiaDupaCod(primul.cod)?.denumire).toBe(primul.denumire);
  });

  it("respinge un cod inventat — exact ce nu se putea verifica până acum", () => {
    expect(codCorExista("999999")).toBe(false);
    expect(ocupatiaDupaCod("999999")).toBeNull();
  });

  it("caută după prefix de cod, nu după denumire, când se tastează cifre", () => {
    const rezultate = cautaOcupatii("1111");
    expect(rezultate.length).toBeGreaterThan(0);
    expect(rezultate.every((o) => o.cod.startsWith("1111"))).toBe(true);
  });

  it("caută în denumire fără să ceară diacritice", () => {
    // Cine tastează „ingrijitor" trebuie să găsească „îngrijitor…".
    const cuDiacritice = cautaOcupatii("îngrijitor");
    const faraDiacritice = cautaOcupatii("ingrijitor");
    expect(faraDiacritice.length).toBeGreaterThan(0);
    expect(faraDiacritice.length).toBe(cuDiacritice.length);
  });

  it("tratează ș și ț cu virgulă la fel ca pe cele cu sedilă", () => {
    expect(cautaOcupatii("sofer").length).toBeGreaterThan(0);
  });

  it("nu caută pe mai puțin de două caractere", () => {
    expect(cautaOcupatii("a")).toEqual([]);
    expect(cautaOcupatii("")).toEqual([]);
  });

  it("respectă limita cerută", () => {
    expect(cautaOcupatii("or", 5).length).toBeLessThanOrEqual(5);
  });
});
