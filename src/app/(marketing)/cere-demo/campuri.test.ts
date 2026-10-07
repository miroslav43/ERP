import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MESAJE_EN, MESAJE_RO, valideazaCerereDemo, type CereDemoInput } from "./campuri";
import { creeazaSchemaCereDemo } from "./schema";

/**
 * Clientul validează fără Zod (`campuri.ts`), serverul cu Zod (`schema.ts`).
 * Două implementări ale aceleiași reguli se despart tăcut la prima modificare;
 * testul le pune pe aceleași exemple și cere același verdict pe fiecare câmp.
 */
const BUN: CereDemoInput = {
  nume: "Ana Popescu",
  firma: "Construct SRL",
  email: "ana@construct.ro",
  telefon: "0767 991 625",
  nrAngajati: "10-49",
  mesaj: "",
};

const EXEMPLE: readonly Partial<Record<keyof CereDemoInput, string>>[] = [
  {},
  { nume: "Al" },
  { nume: "a".repeat(121) },
  { firma: "X" },
  { firma: "f".repeat(161) },
  { email: "ana" },
  { email: "ana@construct" },
  { email: "ana construct@firma.ro" },
  { telefon: "12345" },
  { telefon: "0767-991-625" },
  { telefon: "+40 (767) 991.625" },
  { telefon: "0767 abc 625" },
  { telefon: "1".repeat(33) },
  { nrAngajati: "100" },
  { mesaj: "m".repeat(2001) },
  { nume: "Al", email: "x", telefon: "abc" },
];

describe("validarea cererii de demonstrație", () => {
  for (const [index, exemplu] of EXEMPLE.entries()) {
    it(`clientul și serverul resping aceleași câmpuri — exemplul ${String(index)}`, () => {
      const valori = { ...BUN, ...exemplu };
      const client = Object.keys(valideazaCerereDemo(valori, MESAJE_RO)).sort();
      const rezultat = creeazaSchemaCereDemo(MESAJE_RO).safeParse(valori);
      const server = rezultat.success
        ? []
        : [...new Set(rezultat.error.issues.map((p) => String(p.path[0])))].sort();
      expect(client).toEqual(server);
    });
  }

  it("mesajele clientului sunt în limba paginii", () => {
    expect(valideazaCerereDemo({ ...BUN, email: "x" }, MESAJE_EN).email).toBe(MESAJE_EN.email);
    expect(valideazaCerereDemo({ ...BUN, email: "x" }, MESAJE_RO).email).toBe(MESAJE_RO.email);
  });

  it("formularul nu aduce Zod sau react-hook-form în JavaScript-ul paginii de start", () => {
    // Auditul din 7 oct 2026: trei fișiere, ~88 KB gzip, pe calea de hidratare a
    // paginii de start, descărcate de orice pagină prin prefetch-ul spre `/`.
    const sursa = readFileSync("src/app/(marketing)/cere-demo/formular-demo.tsx", "utf8");
    expect(sursa).not.toMatch(/from ["'](zod|react-hook-form|@hookform\/resolvers[^"']*)["']/);
    expect(sursa).not.toMatch(/from ["']\.\/schema["']/);
    const campuri = readFileSync("src/app/(marketing)/cere-demo/campuri.ts", "utf8");
    expect(campuri).not.toMatch(/from ["']zod["']/);
  });
});
