// src/domain/payroll/erori.test.ts
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
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

describe("catalogul acoperă tot ce emit etapele", () => {
  // Etapele întorc coduri ca ȘIRURI, deliberat: altfel fiecare etapă nouă ar
  // cere o modificare în catalog, adică exact punctul de coliziune pe care
  // structura îl evită. Prețul e că un cod poate rămâne neînregistrat, iar
  // atunci `problemaDinEtapa` îl degradează la o problemă generică — vizibilă,
  // dar fără cauză și fără mod de reparare.
  //
  // Testul citește modulele ca TEXT, ca în `config/permissions.test.ts`:
  // verificarea trebuie să meargă fără să importe fiecare etapă.
  const RADACINA = join(process.cwd(), "src/domain/payroll");

  function coduriEmise(): ReadonlySet<string> {
    const directoare = ["etape", "bancar", "contabil"];
    const gasite = new Set<string>();
    for (const director of directoare) {
      const cale = join(RADACINA, director);
      if (!existsSync(cale)) continue;
      for (const fisier of readdirSync(cale)) {
        if (!fisier.endsWith(".ts") || fisier.endsWith(".test.ts")) continue;
        const sursa = readFileSync(join(cale, fisier), "utf8");
        for (const potrivire of sursa.matchAll(/"(SAL_[A-Z_]+)"/g)) {
          if (potrivire[1] !== undefined) gasite.add(potrivire[1]);
        }
      }
    }
    return gasite;
  }

  it("s-au găsit coduri de verificat — altfel testul ar trece fals-pozitiv", () => {
    expect(coduriEmise().size).toBeGreaterThan(10);
  });

  it("fiecare cod emis de o etapă e înregistrat în catalog", () => {
    const declarate = new Set<string>(CODURI_PROBLEMA);
    const lipsa = [...coduriEmise()].filter((cod) => !declarate.has(cod)).sort();
    expect(
      lipsa,
      `Coduri emise fără intrare în catalog — ar apărea fără cauză și fără mod de reparare: ${lipsa.join(", ")}`,
    ).toEqual([]);
  });
});
