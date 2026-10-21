// src/schemas/mesaje-zod.test.ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { cuDe, mesajZod } from "./mesaje-zod";

const RADACINA = process.cwd();
const DIRECTOR = join(RADACINA, "src/schemas");

/**
 * Cazurile probate în campania QA: fiecare formă de problemă pe care zod o
 * produce fără mesaj propriu, cu valoarea care o declanșează.
 */
const CAZURI: ReadonlyArray<readonly [string, z.ZodType, unknown]> = [
  ["number.max(31) ← 40", z.number().max(31), 40],
  ["coerce.number.max(60) ← „61”", z.coerce.number().max(60), "61"],
  ["string ← undefined", z.string(), undefined],
  ["string.min(3) ← „ab”", z.string().min(3), "ab"],
  ["string.min(1) ← „”", z.string().min(1), ""],
  ["string.max(160) ← 214 caractere", z.string().max(160), "x".repeat(214)],
  ["uuid ← „”", z.uuid(), ""],
  ["uuid ← „abc”", z.uuid(), "abc"],
  ["iso.date ← „”", z.iso.date(), ""],
  ["regex VIN ← „ABC”", z.string().regex(/^[A-HJ-NPR-Z0-9]{11,17}$/iu), "ABC"],
  ["number.min(0) ← -50", z.number().min(0), -50],
  ["number.min(1900) ← 1800", z.number().min(1900), 1800],
  ["int ← 1.5", z.number().int(), 1.5],
  ["enum ← „x”", z.enum(["a", "b"]), "x"],
  ["email ← „x”", z.email(), "x"],
  ["coerce.number ← „abc”", z.coerce.number(), "abc"],
  ["number ← undefined", z.number(), undefined],
  ["cheie lipsă în object", z.object({ nume: z.string() }), {}],
  ["custom fără mesaj", z.string().refine(() => false), "a"],
  ["union ← null", z.union([z.string(), z.number()]), null],
];

describe("mesajZod — harta globală", () => {
  it.each(CAZURI)("%s: mesaj românesc, cu punct, fără nimic tehnic", (_nume, schema, valoare) => {
    const rezultat = schema.safeParse(valoare);
    expect(rezultat.success).toBe(false);
    const mesaje = rezultat.error?.issues.map((i) => i.message) ?? [];
    expect(mesaje.length).toBeGreaterThan(0);
    for (const mesaj of mesaje) {
      expect(mesaj).toMatch(/\.$/u);
      expect(mesaj).not.toMatch(/^(Too |Invalid|Expected)/u);
      for (const interzis of ["/^", "number", "string", "undefined", "NaN", "expected"]) {
        expect(mesaj).not.toContain(interzis);
      }
      expect(mesaj).not.toMatch(/[şţŞŢ]/u);
    }
  });

  it("textele de referință", () => {
    const mesaj = (schema: z.ZodType, valoare: unknown) =>
      schema.safeParse(valoare).error?.issues[0]?.message;
    expect(mesaj(z.number().max(31), 40)).toBe("Valoarea nu poate depăși 31.");
    expect(mesaj(z.string().max(160), "x".repeat(214))).toBe(
      "Textul nu poate depăși 160 de caractere.",
    );
    expect(mesaj(z.string().min(3), "ab")).toBe("Textul trebuie să aibă cel puțin 3 caractere.");
    expect(mesaj(z.uuid(), "")).toBe("Alegeți o opțiune din listă.");
    expect(mesaj(z.enum(["a"]), "x")).toBe("Alegeți o opțiune din listă.");
    expect(mesaj(z.iso.date(), "")).toBe("Introduceți o dată validă (zz.ll.aaaa).");
    expect(mesaj(z.coerce.number(), "abc")).toBe("Introduceți un număr.");
    expect(mesaj(z.number().int(), 1.5)).toBe("Introduceți un număr întreg.");
    expect(mesaj(z.string(), undefined)).toBe("Câmpul este obligatoriu.");
  });

  it("mesajul de pe regulă bate harta", () => {
    const r = z.number().max(31, "Ziua trebuie să fie între 1 și 31.").safeParse(40);
    expect(r.error?.issues[0]?.message).toBe("Ziua trebuie să fie între 1 și 31.");
  });

  it("funcția e pură: o problemă brută dă textul fără parsare", () => {
    expect(
      mesajZod({
        code: "too_big",
        origin: "number",
        maximum: 1_000_000,
        inclusive: true,
        input: 2_000_000,
      }),
    ).toBe("Valoarea nu poate depăși 1.000.000.");
  });
});

describe("acordul numeralului", () => {
  it.each([
    [3, "3 caractere"],
    [19, "19 caractere"],
    [20, "20 de caractere"],
    [101, "101 caractere"],
    [160, "160 de caractere"],
    [1, "un caracter"],
  ])("%i → %s", (n, asteptat) => {
    expect(cuDe(n, "caracter", "caractere")).toBe(asteptat);
  });

  it("numerele mari se grupează românește", () => {
    expect(cuDe(1_000_000, "caracter", "caractere")).toBe("1.000.000 de caractere");
  });
});

/**
 * Poarta: harta funcționează doar dacă modulul ei e ÎNCĂRCAT în bundle-ul care
 * parsează. Un fișier de scheme nou fără import ar scăpa iar textul englezesc
 * pe client, unde zodResolver și `safeParse` direct nu trec prin createAction.
 */
describe("harta e încărcată peste tot", () => {
  const fisiere = readdirSync(DIRECTOR)
    .filter(
      (nume) => nume.endsWith(".ts") && !nume.endsWith(".test.ts") && nume !== "mesaje-zod.ts",
    )
    .map((nume) => ({ nume, sursa: readFileSync(join(DIRECTOR, nume), "utf8") }));

  it("găsește fișierele de scheme", () => {
    expect(fisiere.length).toBeGreaterThan(5);
  });

  it("orice fișier din src/schemas importă ./mesaje-zod sau o valoare din ./comun", () => {
    // `import type … from "./comun"` dispare la compilare, deci nu încarcă harta.
    const prinComun = /^import\s+(?!type\b)[^;]*from\s+"\.\/comun";/mu;
    const vinovate = fisiere
      .filter((f) => !f.sursa.includes('import "./mesaje-zod";') && !prinComun.test(f.sursa))
      .map((f) => f.nume);
    expect(
      vinovate,
      `Fără harta de mesaje: ${vinovate.join(", ")}. Adaugă \`import "./mesaje-zod";\`.`,
    ).toEqual([]);
  });

  it.each([
    "src/lib/actions/create-action.ts",
    "src/lib/actions/public-action.ts",
    "src/lib/actions/platform.ts",
  ])("%s încarcă harta", (cale) => {
    expect(readFileSync(join(RADACINA, cale), "utf8")).toContain('import "@/schemas/mesaje-zod";');
  });
});
