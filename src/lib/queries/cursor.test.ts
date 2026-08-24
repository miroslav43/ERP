// src/lib/queries/cursor.test.ts
import { describe, expect, it } from "vitest";

import {
  codificaCursor,
  decodificaCursor,
  ghilimeleaza,
  predicatKeyset,
  scrieSortare,
  sortareCeruta,
} from "./cursor";

/**
 * Cursorul e singura bucată din paginare pe care o poate strica un text venit
 * din bază sau din URL. Testele de aici apără exact acele două margini.
 */

describe("codificaCursor / decodificaCursor", () => {
  it("închide bucla pe valori obișnuite", () => {
    const c = { valoare: "Ionescu Ana", id: "a1b2c3" };
    expect(decodificaCursor(codificaCursor(c))).toEqual(c);
  });

  it.each([
    ["diacritice", "Ștefănescu Țucă"],
    ["virgulă", "Popescu, Ion"],
    ["ghilimele", 'Firma "Alfa" SRL'],
    ["paranteze", "Secția (A) — nord"],
    ["bară inversă", "C:\\dosar\\fișier"],
    ["dată ISO", "2026-08-23"],
    ["sumă", "612.400,55"],
    ["gol", ""],
  ])("supraviețuiește la %s", (_nume, valoare) => {
    const c = { valoare, id: "00000000-0000-0000-0000-000000000001" };
    expect(decodificaCursor(codificaCursor(c))).toEqual(c);
  });

  it("întoarce null pentru text stricat, fără să arunce", () => {
    for (const rau of ["", "nu-e-base64", "!!!", "YQ", "%%%%"]) {
      expect(() => decodificaCursor(rau)).not.toThrow();
    }
    // Un cursor fără identificator nu e utilizabil.
    expect(decodificaCursor(Buffer.from("doar-valoare", "utf8").toString("base64url"))).toBeNull();
  });

  it("e sigur într-un URL — base64url, fără +, / sau =", () => {
    // `base64` obișnuit produce `+`, `/` și `=`, care într-un query string
    // înseamnă spațiu, separator de cale și, respectiv, capătul valorii.
    for (const valoare of ["Ștefănescu Țucă", "a+b/c=d", "«»", "🙂"]) {
      const c = codificaCursor({ valoare, id: "3f8c1d2e" });
      expect(c).not.toMatch(/[+/=]/);
      expect(decodificaCursor(c)).toEqual({ valoare, id: "3f8c1d2e" });
    }
  });

  it("un nume gol cu identificator valid rămâne acceptat", () => {
    // Se poate întâmpla legitim: un rând al cărui câmp de sortare e gol.
    expect(decodificaCursor(codificaCursor({ valoare: "", id: "3f8c1d2e" }))).toEqual({
      valoare: "",
      id: "3f8c1d2e",
    });
  });

  it("nu se lasă rupt de un separator prezent în valoare", () => {
    // Separatorul e octetul nul, care nu poate veni dintr-un `text` din Postgres.
    const c = { valoare: "a b c", id: "x" };
    expect(decodificaCursor(codificaCursor(c))).toEqual(c);
  });
});

describe("ghilimeleaza", () => {
  it("escapează exact ce poate rupe expresia `or=`", () => {
    expect(ghilimeleaza("Popescu, Ion")).toBe('"Popescu, Ion"');
    expect(ghilimeleaza('Firma "Alfa"')).toBe('"Firma \\"Alfa\\""');
    expect(ghilimeleaza("C:\\dosar")).toBe('"C:\\\\dosar"');
  });
});

describe("predicatKeyset", () => {
  it("crescător cere valori strict mai mari, cu departajare pe identificator", () => {
    const p = predicatKeyset("full_name", { valoare: "Ionescu", id: "abc" }, "asc");
    expect(p).toBe('full_name.gt."Ionescu",and(full_name.eq."Ionescu",id.gt."abc")');
  });

  it("descrescător inversează amândouă comparațiile", () => {
    // Dacă doar prima s-ar inversa, rândurile cu valori egale ar reapărea.
    const p = predicatKeyset("data_evenimentului", { valoare: "2026-08-23", id: "z" }, "desc");
    expect(p).toBe(
      'data_evenimentului.lt."2026-08-23",and(data_evenimentului.eq."2026-08-23",id.lt."z")',
    );
  });

  it("ghilimelează și valoarea, și identificatorul", () => {
    const p = predicatKeyset("denumire", { valoare: "Alfa, SRL", id: "i,d" }, "asc");
    expect(p).toContain('"Alfa, SRL"');
    expect(p).toContain('"i,d"');
  });
});

describe("sortareCeruta", () => {
  const permise = ["nume", "data", "status"] as const;
  const implicit = { cheie: "nume", directie: "asc" } as const;

  it("citește forma din URL", () => {
    expect(sortareCeruta("data", permise, implicit)).toEqual({ cheie: "data", directie: "asc" });
    expect(sortareCeruta("-data", permise, implicit)).toEqual({ cheie: "data", directie: "desc" });
  });

  it("cade pe implicit când lipsește", () => {
    expect(sortareCeruta(null, permise, implicit)).toEqual(implicit);
  });

  /**
   * Numele coloanei ajunge într-un predicat construit ca TEXT. Dacă ar trece
   * liber din query string, un URL ar putea injecta o expresie PostgREST.
   */
  it.each([
    "coloana_inexistenta",
    "id",
    "organization_id",
    "full_name.gt.x",
    "salariu_baza",
    "-",
    "'; drop",
  ])("refuză „%s” și cade tăcut pe implicit", (rau) => {
    expect(sortareCeruta(rau, permise, implicit)).toEqual(implicit);
  });

  it("scrierea și citirea se închid una pe alta", () => {
    for (const s of [
      { cheie: "nume", directie: "asc" },
      { cheie: "data", directie: "desc" },
    ] as const) {
      expect(sortareCeruta(scrieSortare(s), permise, implicit)).toEqual(s);
    }
  });
});
