// src/schemas/mesaje-zod.ts
// Harta globală a mesajelor Zod: ce vede omul când o regulă n-are mesaj propriu.
//
// ── CE S-A ÎNTÂMPLAT ────────────────────────────────────────────────────────
// Campania QA din octombrie 2026 a găsit pe câmp, în ecrane reale, textele
// implicite ale lui zod: „Too big: expected number to be <=31” (asistentul de
// înrolare), „Too small: expected string to have >=3 characters” (parcul auto),
// „Invalid UUID” (medicina muncii), „Invalid ISO date” (instruiri) și chiar
// expresia regulată brută a VIN-ului („must match pattern /^[A-HJ-NPR-Z0-9]…”).
// Fiecare regulă fără al doilea argument era o scurgere; erau zeci.
//
// Mesajele explicite rămân calea bună — numesc câmpul și limita („Denumirea nu
// poate depăși 160 de caractere.”). Harta e plasa de sub ele: o regulă uitată
// spune ceva românesc și corect, niciodată englezește.
//
// ── ORDINEA ÎN ZOD 4 ───────────────────────────────────────────────────────
// La parsare, mesajul se ia din: mesajul de pe regulă > `error` de la apel >
// `customError` (aici) > `localeError`. Deci harta NU atinge niciun mesaj
// explicit existent — doar umple golurile.
//
// ── DE CE NU `z.locales.ro()` ──────────────────────────────────────────────
// Probat pe zod 4.4.3: dă „Prea mare: așteptat ca number să fie <=31” și „Șir
// invalid: trebuie să se potrivească cu modelul /^…/” — scurge numele tipurilor
// și expresia regulată, fără punct final. Ar fi schimbat limba, nu problema.
//
// ── DE CE IMPORT CU EFECT, NU `instrumentation.ts` ─────────────────────────
// `z.config` scrie pe instanța `zod` din bundle-ul care îl execută. Next
// compilează `instrumentation.ts` separat de rute, deci nu garantează aceeași
// instanță, și oricum nu ajunge în bundle-ul clientului (zodResolver,
// `safeParse` din componente). Mecanismul fiabil e `import "./mesaje-zod"` în
// fiecare fișier de scheme (sau prin `./comun`) și în fabricile de acțiuni.
// Poarta e în `mesaje-zod.test.ts`: un fișier de scheme nou fără import o pică.

import { z } from "zod";

/** Numărul așa cum îl citește omul: `1.000.000`, `0,5`. */
function numar(n: number | bigint): string {
  return n.toLocaleString("ro-RO");
}

/**
 * Acordul numeralului în română: „19 caractere”, dar „20 de caractere”.
 *
 * Regula e pe ultimele două cifre: „de” apare când ele fac 0 (în afară de
 * zero însuși: „100 de”) sau trec de 19 („120 de”, dar „101 caractere”).
 * Aici se numără doar caractere și opțiuni, deci întregi; o fracție rămâne
 * fără „de”.
 */
export function cuDe(n: number | bigint, singular: string, plural: string): string {
  const valoare = Number(n);
  if (valoare === 1) return `un ${singular}`;
  const rest = Math.abs(valoare) % 100;
  const cuPrepozitie = Number.isInteger(valoare) && ((rest === 0 && valoare !== 0) || rest >= 20);
  return `${numar(n)} ${cuPrepozitie ? "de " : ""}${plural}`;
}

/** Valoarea absentă: cheia lipsă din obiect, `undefined` sau `null`. */
function absent(issue: z.core.$ZodRawIssue): boolean {
  return !("input" in issue) || issue.input === undefined || issue.input === null;
}

function esteNumeric(origin: unknown): boolean {
  return origin === "number" || origin === "int" || origin === "bigint";
}

const GENERIC_FORMAT = "Valoarea nu are formatul așteptat.";
const GENERIC = "Valoarea nu este validă.";
const ALEGERE = "Alegeți o opțiune din listă.";

function preaMic(issue: z.core.$ZodRawIssue<z.core.$ZodIssueTooSmall>): string {
  const { origin, minimum } = issue;
  const inclusiv = issue.inclusive !== false;
  if (origin === "string") {
    if (issue.exact === true) {
      return `Textul trebuie să aibă exact ${cuDe(minimum, "caracter", "caractere")}.`;
    }
    if (Number(minimum) <= 1) return "Câmpul este obligatoriu.";
    return `Textul trebuie să aibă cel puțin ${cuDe(minimum, "caracter", "caractere")}.`;
  }
  if (esteNumeric(origin)) {
    return inclusiv
      ? `Valoarea trebuie să fie cel puțin ${numar(minimum)}.`
      : `Valoarea trebuie să fie mai mare decât ${numar(minimum)}.`;
  }
  if (origin === "array" || origin === "set") {
    return `Alegeți cel puțin ${cuDe(minimum, "opțiune", "opțiuni")}.`;
  }
  if (origin === "date") return "Data este prea veche.";
  return GENERIC;
}

function preaMare(issue: z.core.$ZodRawIssue<z.core.$ZodIssueTooBig>): string {
  const { origin, maximum } = issue;
  const inclusiv = issue.inclusive !== false;
  if (origin === "string") {
    if (issue.exact === true) {
      return `Textul trebuie să aibă exact ${cuDe(maximum, "caracter", "caractere")}.`;
    }
    return `Textul nu poate depăși ${cuDe(maximum, "caracter", "caractere")}.`;
  }
  if (esteNumeric(origin)) {
    return inclusiv
      ? `Valoarea nu poate depăși ${numar(maximum)}.`
      : `Valoarea trebuie să fie mai mică decât ${numar(maximum)}.`;
  }
  if (origin === "array" || origin === "set") {
    return `Puteți alege cel mult ${cuDe(maximum, "opțiune", "opțiuni")}.`;
  }
  if (origin === "date") return "Data este prea îndepărtată.";
  if (origin === "file") return "Fișierul este prea mare.";
  return GENERIC;
}

function formatInvalid(format: string): string {
  switch (format) {
    case "uuid":
    case "guid":
      return ALEGERE;
    case "date":
      return "Introduceți o dată validă (zz.ll.aaaa).";
    case "datetime":
      return "Introduceți data și ora.";
    case "time":
      return "Introduceți o oră validă (hh:mm).";
    case "email":
      return "Introduceți o adresă de email validă.";
    case "url":
      return "Introduceți o adresă web validă.";
    default:
      // Inclusiv `regex`: expresia (`issue.pattern`) NU ajunge niciodată în text.
      return GENERIC_FORMAT;
  }
}

/**
 * Mesajul românesc pentru o problemă fără mesaj propriu. Funcție PURĂ.
 *
 * Toate textele se termină cu punct și nu poartă nimic tehnic: niciun nume de
 * tip, nicio expresie regulată, nicio valoare primită.
 */
export function mesajZod(issue: z.core.$ZodRawIssue): string {
  switch (issue.code) {
    case "invalid_type": {
      if (absent(issue)) return "Câmpul este obligatoriu.";
      if (issue.expected === "int") return "Introduceți un număr întreg.";
      if (issue.expected === "number" || issue.expected === "bigint") {
        return "Introduceți un număr.";
      }
      return GENERIC_FORMAT;
    }
    case "too_small":
      return preaMic(issue);
    case "too_big":
      return preaMare(issue);
    case "invalid_format":
      return formatInvalid(issue.format);
    case "invalid_value":
      return ALEGERE;
    case "invalid_union":
      return GENERIC_FORMAT;
    case "unrecognized_keys":
      return "Datele conțin câmpuri necunoscute.";
    case "not_multiple_of":
      return `Valoarea trebuie să fie un multiplu de ${numar(issue.divisor)}.`;
    default:
      return GENERIC;
  }
}

z.config({ customError: mesajZod });
