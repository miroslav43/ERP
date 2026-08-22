// src/domain/payroll/erori.test.ts
import { describe, expect, it } from "vitest";

import {
  CODURI_PROBLEMA,
  areBlocante,
  descriereCompleta,
  esteBlocanta,
  problema,
  sorteazaProbleme,
  type CodProblema,
  type ProblemaSalarizare,
} from "./erori";

const TOATE: readonly ProblemaSalarizare[] = CODURI_PROBLEMA.map((cod) => problema(cod));

describe("catalogul de probleme — invariante de text", () => {
  it("fiecare cod produce o problemă completă, fără câmpuri goale", () => {
    for (const p of TOATE) {
      expect(p.mesaj.length, p.cod).toBeGreaterThan(0);
      expect(p.cauza.length, p.cod).toBeGreaterThan(0);
      expect(p.cumSeRepara.length, p.cod).toBeGreaterThan(0);
    }
  });

  it("fiecare mesaj, cauză și reparare se termină cu punct", () => {
    for (const p of TOATE) {
      for (const [nume, text] of [
        ["mesaj", p.mesaj],
        ["cauza", p.cauza],
        ["cumSeRepara", p.cumSeRepara],
      ] as const) {
        expect(text.endsWith("."), `${p.cod}.${nume}: „${text}”`).toBe(true);
      }
    }
  });

  it("diacriticele sunt cu virgulă dedesubt, nu cu sedilă", () => {
    // ş/ţ (U+015F/U+0163) sunt caracterele turcești, greșite pentru română.
    const SEDILE = /[şţŞŢ]/u;
    for (const p of TOATE) {
      const tot = [p.mesaj, p.cauza, p.cumSeRepara].join(" ");
      expect(SEDILE.test(tot), `${p.cod} conține sedilă`).toBe(false);
    }
  });

  it("`unde` e fie o rută absolută din aplicație, fie null", () => {
    for (const p of TOATE) {
      if (p.unde !== null) expect(p.unde.startsWith("/"), p.cod).toBe(true);
    }
  });

  it("nu există coduri duplicate", () => {
    expect(new Set(CODURI_PROBLEMA).size).toBe(CODURI_PROBLEMA.length);
  });
});

describe("problema()", () => {
  it("atașează cifrele cazului fără să atingă textul din catalog", () => {
    const fara = problema("SAL_RETINERE_PLAFONATA");
    const cu = problema("SAL_RETINERE_PLAFONATA", {
      detalii: "1.240,00 lei plafonați la 980,00 lei.",
      employeeId: "11111111-1111-1111-1111-111111111111",
    });

    expect(fara.detalii).toBeNull();
    expect(fara.employeeId).toBeNull();
    expect(cu.detalii).toBe("1.240,00 lei plafonați la 980,00 lei.");
    expect(cu.employeeId).toBe("11111111-1111-1111-1111-111111111111");
    // Textul fix rămâne identic — el trăiește într-un singur loc.
    expect(cu.mesaj).toBe(fara.mesaj);
    expect(cu.cauza).toBe(fara.cauza);
  });

  it("severitatea vine din catalog, nu de la apelant", () => {
    expect(problema("SAL_CONTRACT_LIPSA").severitate).toBe("blocant");
    expect(problema("SAL_SCUTIRI_MULTIPLE").severitate).toBe("avertisment");
  });
});

describe("severitate și sortare", () => {
  const lista: readonly ProblemaSalarizare[] = [
    problema("SAL_RETINERE_PLAFONATA"),
    problema("SAL_CONTRACT_LIPSA"),
    problema("SAL_SCUTIRI_MULTIPLE"),
    problema("SAL_TRUNCHIERE_CITIRE"),
  ];

  it("blocantele ies primele", () => {
    const sortate = sorteazaProbleme(lista);
    expect(sortate.slice(0, 2).map((p) => p.cod)).toEqual([
      "SAL_CONTRACT_LIPSA",
      "SAL_TRUNCHIERE_CITIRE",
    ]);
  });

  it("sortarea e stabilă între probleme de aceeași severitate", () => {
    const sortate = sorteazaProbleme(lista);
    expect(sortate.slice(2).map((p) => p.cod)).toEqual([
      "SAL_RETINERE_PLAFONATA",
      "SAL_SCUTIRI_MULTIPLE",
    ]);
  });

  it("sortarea nu modifică lista primită", () => {
    const copie = [...lista];
    sorteazaProbleme(lista);
    expect(lista).toEqual(copie);
  });

  it("areBlocante distinge o listă care oprește aprobarea de una care doar avertizează", () => {
    expect(areBlocante(lista)).toBe(true);
    expect(areBlocante(lista.filter((p) => !esteBlocanta(p)))).toBe(false);
    expect(areBlocante([])).toBe(false);
  });
});

describe("descriereCompleta()", () => {
  it("pune cifrele imediat după mesaj, înaintea cauzei", () => {
    const p = problema("SAL_CONTRACT_LIPSA", { detalii: "Popescu Ion, marca 042." });
    const text = descriereCompleta(p);
    expect(text.indexOf(p.detalii as string)).toBeGreaterThan(text.indexOf(p.mesaj));
    expect(text.indexOf(p.detalii as string)).toBeLessThan(text.indexOf(p.cauza));
  });

  it("sare peste detaliile lipsă fără să lase spații duble", () => {
    const text = descriereCompleta(problema("SAL_CONTRACT_LIPSA"));
    expect(text).not.toContain("  ");
  });

  it("spune, pentru fiecare cod, și ce are omul de făcut", () => {
    for (const cod of CODURI_PROBLEMA satisfies readonly CodProblema[]) {
      expect(descriereCompleta(problema(cod))).toContain(problema(cod).cumSeRepara);
    }
  });
});
