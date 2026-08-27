// src/schemas/comun.test.ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { optional, textOptional } from "./comun";

const DIRECTOR = join(process.cwd(), "src/schemas");

/**
 * Cele trei forme ale absenței.
 *
 * `null` lipsea din uniune, iar asta a ținut modulul de cursuri mort la scriere
 * pe toate drumurile lui și a rupt bifarea pașilor de integrare. Testul le
 * fixează pe toate trei, ca reparația să nu se poată pierde la o refactorizare.
 */
describe("optional — cele trei forme ale absenței", () => {
  const schema = optional(z.coerce.number().int().min(1).max(365));

  it("acceptă `undefined` (cheia lipsește din obiect)", () => {
    expect(schema.parse(undefined)).toBeNull();
  });

  it('acceptă `""` (controlul există dar e golit)', () => {
    // `FormData.get()` pe un input randat întoarce ȘIRUL GOL, niciodată `null`.
    expect(schema.parse("")).toBeNull();
  });

  it("acceptă `null` (apelantul spune explicit „nu se aplică”)", () => {
    // Forma pe care o trimit formularele proiectului. Lipsea din uniune.
    expect(schema.parse(null)).toBeNull();
  });

  it("lasă valoarea validă să treacă neatinsă", () => {
    expect(schema.parse("30")).toBe(30);
    expect(schema.parse(30)).toBe(30);
  });

  it("respinge în continuare o valoare invalidă", () => {
    expect(schema.safeParse("0").success).toBe(false);
    expect(schema.safeParse("400").success).toBe(false);
    expect(schema.safeParse("abc").success).toBe(false);
  });

  it("nu confundă `null` cu zero — capcana care a produs mesajul înșelător", () => {
    // `z.coerce.number()` pe `null` dă `Number(null) === 0`, deci înainte ieșea
    // plafonul câmpului („are cel puțin 1”) pentru un câmp pe care omul îl
    // lăsase gol intenționat. Acum `null` nu mai ajunge la coerciție.
    expect(schema.parse(null)).toBeNull();
    expect(schema.safeParse(0).success).toBe(false);
  });

  it("merge și peste scheme care nu sunt numerice", () => {
    const uuid = optional(z.uuid());
    expect(uuid.parse(null)).toBeNull();
    expect(uuid.parse("")).toBeNull();
    expect(uuid.parse("8b867d05-d4c0-4a42-9bc7-ce21abe20ac4")).toBe(
      "8b867d05-d4c0-4a42-9bc7-ce21abe20ac4",
    );
    expect(uuid.safeParse("nu-e-uuid").success).toBe(false);
  });
});

describe("textOptional", () => {
  const schema = textOptional(100);

  it("normalizează absența la `null`", () => {
    expect(schema.parse(undefined)).toBeNull();
    expect(schema.parse(null)).toBeNull();
    expect(schema.parse("")).toBeNull();
    expect(schema.parse("   ")).toBeNull();
  });

  it("taie spațiile și păstrează textul", () => {
    expect(schema.parse("  ceva  ")).toBe("ceva");
  });

  it("respinge textul peste plafon", () => {
    expect(schema.safeParse("x".repeat(101)).success).toBe(false);
  });
});

/**
 * Poarta. Fără ea, nimic din comentariul lui `comun.ts` nu ține.
 *
 * Ajutorul a trăit copiat în șapte fișiere, octet cu octet identic, iar
 * capcana fusese deja descoperită o dată și ocolită prin disciplină într-un
 * singur modul. Modulul următor a copiat ajutorul fără disciplina lui.
 * Un al treilea l-ar copia pe cel reparat sau pe cel stricat — la noroc.
 */
describe("niciun ajutor local", () => {
  const fisiere = readdirSync(DIRECTOR)
    .filter((nume) => nume.endsWith(".ts") && !nume.endsWith(".test.ts") && nume !== "comun.ts")
    .map((nume) => ({ nume, sursa: readFileSync(join(DIRECTOR, nume), "utf8") }));

  it("găsește fișierele de scheme", () => {
    // Fără asta, o redenumire de director ar face testul verde pe zero fișiere.
    expect(fisiere.length).toBeGreaterThan(5);
  });

  /**
   * Poarta e pe NUMELE `optional`, exact, și doar pe el.
   *
   * Două variante din depozit seamănă cu forma stricată și sunt corecte —
   * poarta nu le atinge, iar motivul e scris aici ca să nu fie „reparate”
   * din greșeală de cineva care vede tiparul:
   *
   * · `evaluation.ts` — `optionalUrl`. Alimentează EXCLUSIV filtre citite din
   *   query string, unde `null` nu poate apărea. Numele diferit e marcajul.
   * · `ssm.ts` — `textOptional`, `uuidOptional`, `dataOptionala`. Aplică
   *   `.nullable()` DUPĂ `transform`, deci `null` scurtcircuitează întreaga
   *   conductă și e acceptat. Uniunea fără `z.null()` e acolo inofensivă.
   *
   * `textOptional` nu e în poartă fiindcă n-a fost niciodată stricat:
   * `.nullable()` e în corpul lui de la început. Zece fișiere îl mai declară
   * local; e duplicare, nu defect, și nu merită atinse zece module pentru zero
   * schimbare de comportament.
   */
  it("`optional` nu se declară local în niciun fișier de scheme", () => {
    const tipar = /^\s*(?:export\s+)?const optional\s*=/mu;
    const vinovate = fisiere.filter((f) => tipar.test(f.sursa)).map((f) => f.nume);
    expect(
      vinovate,
      `Declarat local în: ${vinovate.join(", ")}. Importă-l din "./comun" — copia diverge tăcut.`,
    ).toEqual([]);
  });
});
