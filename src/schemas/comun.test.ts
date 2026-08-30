// src/schemas/comun.test.ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  codCorOptional,
  enumOptional,
  numarCuImplicit,
  numarObligatoriu,
  numarOptional,
  optional,
  textOptional,
} from "./comun";

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
 * `enumOptional` — defectul care făcea butonul „Continuă” să pară mort.
 *
 * Un `<select>` cu `<option value="">— Niciunul —</option>` trimite ȘIRUL GOL
 * prin `register()`. `z.enum(X).nullable()` îl respinge, iar câmpul vinovat
 * (`special_regime` în pasul 3, `stare_civila` în pasul 1) nu randa niciun
 * mesaj: validarea pica, pasul nu avansa, ecranul tăcea.
 */
describe("enumOptional", () => {
  const REGIMURI = ["ucenicie", "internship", "zilier"] as const;
  const schema = enumOptional(REGIMURI, "Alegeți un regim special din listă.");

  it('acceptă `""` — opțiunea „— Niciunul —” a unui `<select>`', () => {
    // Exact valoarea pe care o trimitea formularul și pe care o respingea
    // `z.enum(X).nullable()`.
    expect(schema.parse("")).toBeNull();
  });

  it("acceptă și celelalte două forme ale absenței", () => {
    expect(schema.parse(null)).toBeNull();
    expect(schema.parse(undefined)).toBeNull();
  });

  it("lasă o valoare din enum să treacă neatinsă", () => {
    expect(schema.parse("internship")).toBe("internship");
  });

  it("respinge o valoare din afara enum-ului, în română", () => {
    const rezultat = schema.safeParse("altceva");
    expect(rezultat.success).toBe(false);
    expect(rezultat.error?.issues[0]?.message).toBe("Alegeți un regim special din listă.");
  });

  it("dă mesajul românesc pe AMBELE căi de raportare", () => {
    // `zodResolver` desface `invalid_union` și ia mesajul RAMURII; serverul,
    // prin `z.flattenError`, îl citește pe cel al UNIUNII. De aceea mesajul e
    // dat de două ori în ajutor — cu unul singur, una dintre căi ar scăpa
    // textul englezesc al lui zod pe ecran.
    const obiect = z.object({ regim: schema });
    const plat = z.flattenError(obiect.safeParse({ regim: "altceva" }).error!);
    expect(plat.fieldErrors["regim"]).toEqual(["Alegeți un regim special din listă."]);
  });
});

/**
 * Ajutoarele numerice — a doua cale către același ecran mut.
 *
 * `z.coerce.number()` pe `""` dă `Number("") === 0`. Un salariu de bază golit
 * se scria tăcut 0 RON, iar o normă golită pica `min(0.5)` cu textul englezesc
 * al lui zod, pe un câmp fără afișare de eroare.
 */
describe("ajutoarele numerice", () => {
  it("numarOptional normalizează golul la `null`, nu la zero", () => {
    const schema = numarOptional({
      min: 0,
      max: 365,
      mesaj: "Introduceți un număr.",
      interval: "Valoarea trebuie să fie între 0 și 365.",
    });
    expect(schema.parse("")).toBeNull();
    expect(schema.parse("   ")).toBeNull();
    expect(schema.parse(null)).toBeNull();
    expect(schema.parse(undefined)).toBeNull();
    // Un zero TASTAT rămâne zero: e o valoare, nu o absență.
    expect(schema.parse("0")).toBe(0);
    expect(schema.parse("30")).toBe(30);
  });

  it("numarObligatoriu spune „lipsește”, nu plafonul calculat pe zero", () => {
    const schema = numarObligatoriu({
      min: 0.5,
      max: 48,
      lipsa: "Norma săptămânală este obligatorie.",
      mesaj: "Norma săptămânală trebuie să fie un număr.",
      interval: "Norma săptămânală este între 0,5 și 48 de ore.",
    });
    expect(schema.safeParse("").error?.issues[0]?.message).toBe(
      "Norma săptămânală este obligatorie.",
    );
    expect(schema.safeParse(null).error?.issues[0]?.message).toBe(
      "Norma săptămânală este obligatorie.",
    );
    // Conducta păstrează mesajele interioare, deci „nu e număr” și „în afara
    // intervalului” rămân distincte — o uniune le-ar fi colapsat.
    expect(schema.safeParse("abc").error?.issues[0]?.message).toBe(
      "Norma săptămânală trebuie să fie un număr.",
    );
    expect(schema.safeParse("60").error?.issues[0]?.message).toBe(
      "Norma săptămânală este între 0,5 și 48 de ore.",
    );
    expect(schema.parse("40")).toBe(40);
  });

  it("numarCuImplicit revine la implicit când câmpul e golit", () => {
    const schema = numarCuImplicit({
      min: 0,
      max: 60,
      implicit: 21,
      mesaj: "Introduceți un număr de zile.",
      interval: "Zilele de concediu sunt între 0 și 60.",
    });
    expect(schema.parse("")).toBe(21);
    expect(schema.parse(undefined)).toBe(21);
    expect(schema.parse("25")).toBe(25);
    expect(schema.safeParse("61").success).toBe(false);
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

  /**
   * A doua poartă: tiparul `z.enum(X).nullable()`, care RESPINGE `""`.
   *
   * Un `<select>` cu opțiune goală trimite șirul gol, nu `null`. Când cele două
   * s-au întâlnit în asistentul de înrolare, butonul „Continuă” a devenit mut:
   * validarea pica pe `special_regime`, iar câmpul nu randa niciun mesaj.
   *
   * Excepțiile de mai jos sunt PERMISE, cu motivul scris. Ca să adaugi una,
   * scrie aici de ce câmpul nu poate primi `""` — nu o adăuga doar ca să treacă
   * testul.
   *
   * · `permisiuni-membru.ts` — `scope` n-are `.default(null)`, iar
   *   `enumOptional` i l-ar adăuga. O cheie lipsă dintr-un payload malformat ar
   *   deveni tăcut „revino la implicit”, adică o retragere de drept fără
   *   eroare. Interfața (`matrice-permisiuni.tsx`) trimite oricum `null`
   *   explicit, prin opțiunea `value="implicit"`.
   * · `checklist.ts` — `verificare_automata` descrie forma unui RÂND CITIT din
   *   bază, nu intrarea unui formular. Nu există `<select>` în spatele lui.
   *
   * Tiparul `z.array(z.enum(X)).nullable()` (leave.ts, checklist.ts) nu intră
   * în poartă: `.nullable()` se aplică listei, după un `transform` care mapează
   * deja `""` la `null`. Altă construcție, deja corectă.
   */
  it("`z.enum(...).nullable()` nu se mai folosește pe câmpuri de formular", () => {
    const permise: Readonly<Record<string, readonly string[]>> = {
      "permisiuni-membru.ts": ["scope: z.enum(PERMISSION_SCOPES).nullable(),"],
      "checklist.ts": ["verificare_automata: z.enum(CHECKLIST_VERIFICARE).nullable(),"],
    };
    const tipar = /z\.enum\((?:[^()]|\([^()]*\))*\)\s*\.nullable\(\)/u;

    const vinovate = fisiere.flatMap((f) =>
      f.sursa
        .split("\n")
        .map((linie) => linie.trim())
        .filter((linie) => tipar.test(linie))
        .filter((linie) => !(permise[f.nume] ?? []).includes(linie))
        .map((linie) => `${f.nume}: ${linie}`),
    );

    expect(
      vinovate,
      `Respinge șirul gol pe care îl trimite un <select>. Folosește enumOptional din "./comun":\n${vinovate.join("\n")}`,
    ).toEqual([]);
  });

  /**
   * A treia poartă: ajutoarele numerice.
   *
   * Au trăit local în două fișiere, cu comportamente DIFERITE pe aceeași
   * intrare. Probă rulată pe copia din `ssm.ts`: `numarOptional(0, 1_000_000)`
   * pe `""` dădea `0`, iar `numarOptional(0.1, 200)` pe `""` dădea `null` —
   * aceeași funcție, două rezultate, după cum era minimul. Un cost golit se
   * scria zero lei fără niciun mesaj.
   */
  it("ajutoarele numerice nu se declară local", () => {
    const tipar =
      /^\s*(?:export\s+)?const (?:enumOptional|numarOptional|numarObligatoriu|numarCuImplicit|codCorOptional)\s*=/mu;
    const vinovate = fisiere.filter((f) => tipar.test(f.sursa)).map((f) => f.nume);
    expect(
      vinovate,
      `Declarat local în: ${vinovate.join(", ")}. Importă-l din "./comun" — copia diverge tăcut.`,
    ).toEqual([]);
  });
});

/**
 * Codul COR, mutat aici din `job-position.ts` când nomenclatorul de funcții a
 * fost desființat (migrarea 0110).
 *
 * Ajutorul nu s-a schimbat la mutare — verifica deja și formatul, și existența
 * în nomenclator. S-a schimbat însă CINE îl folosește: până acum un singur
 * formular, cel al nomenclatorului; de acum fișa angajatului, contractul și
 * patru ecrane de reguli. De aceea îi trebuie un test propriu: până acum n-avea
 * niciunul.
 */
describe("codCorOptional", () => {
  it("acceptă un cod care există în Clasificarea Ocupațiilor", () => {
    expect(codCorOptional.parse("251401")).toBe("251401");
  });

  it("normalizează toate formele golului la null", () => {
    expect(codCorOptional.parse("")).toBeNull();
    expect(codCorOptional.parse(null)).toBeNull();
    expect(codCorOptional.parse(undefined)).toBeNull();
    expect(codCorOptional.parse("   ")).toBeNull();
  });

  it("respinge un cod cu format greșit", () => {
    expect(() => codCorOptional.parse("12345")).toThrow();
    expect(() => codCorOptional.parse("abcdef")).toThrow();
  });

  /**
   * Poarta care contează. Șase cifre inventate treceau nedetectate până la
   * exportul REVISAL, unde codul e blocant — adică luni mai târziu, la prima
   * transmitere către ITM, cu funcția deja pe contractele semnate.
   */
  it("respinge șase cifre care nu sunt o ocupație reală", () => {
    expect(() => codCorOptional.parse("999999")).toThrow();
  });
});
