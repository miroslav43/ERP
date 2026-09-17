// src/components/ui/dialog-inchis.test.ts
//
// POARTA: un `<dialog>` nu are voie să-și declare `display` necondiționat.
//
// ── DEFECTUL PE CARE ÎL PRINDE ──────────────────────────────────────────────
// Foaia de stil a browserului ține `dialog:not([open]) { display: none }`. Dar
// CSS-ul autorului bate foaia UA ÎNTOTDEAUNA, indiferent de specificitate —
// deci o clasă `flex` scrisă simplu pe `<dialog>` anulează regula aceea
// definitiv: dialogul ÎNCHIS rămâne o cutie reală, cu `position: absolute`
// (implicitul UA pentru un dialog nemodal — doar `dialog:modal` e `fixed`),
// așezată la poziția ei statică din flux și numărată în `scrollHeight`.
//
// Invizibil pe ecran, vizibil doar în bara de derulare. Măsurat pe
// `/departamente`, la o fereastră de 1365×969: documentul ieșea 1575px în
// vizualizarea listă și 1696px în organigramă, adică între 606 și 727 de
// pixeli de derulare în gol sub conținut, din `PanouLateral` — un panou închis,
// `h-dvh` înalt și `max-w-xl` lat. Reclamația care l-a scos la iveală n-a fost
// „panoul e stricat", ci „de ce pot să derulez atâta".
//
// Nici `tsc`, nici `eslint`, nici un test de componentă nu spun nimic: marcajul
// e valid, componenta se randează, panoul se deschide și se închide corect.
// Singura urmă e înălțimea documentului, măsurată în browser.
//
// ── FORMA CORECTĂ ───────────────────────────────────────────────────────────
// `hidden … open:flex`: `hidden` repetă implicitul UA, iar varianta `open:`
// leagă randarea strict de atributul `open`. Comutarea lui `display` e și cea
// pe care o așteaptă `globals.css`, unde regula de pe `dialog` animă `display`
// cu `allow-discrete` plus `@starting-style` — cu un `flex` fix nu era nimic
// de comutat. Un `<dialog>` fără nicio clasă de `display` e la fel de corect:
// atunci decide foaia UA, care e exact ce trebuie.
//
// ── ISTORIC ─────────────────────────────────────────────────────────────────
// Prima dată în `command-palette.tsx`, unde paleta închisă rămânea vizibilă pe
// orice pagină. A doua oară în `ui/dialog.tsx`, în `PanouLateral` și în
// `Dialog` — găsit pe 17 sept 2026, prin măsurare în browser. Poarta asta
// există fiindcă a treia oară n-ar mai fi o coincidență.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const RADACINA = join(import.meta.dirname, "..", "..");

/** Aceeași plimbare ca în `traseu-lipit.test.ts`, fără dependență nouă. */
function plimba(dir: string): string[] {
  const gasite: string[] = [];
  for (const intrare of readdirSync(dir, { withFileTypes: true })) {
    const cale = join(dir, intrare.name);
    if (intrare.isDirectory()) gasite.push(...plimba(cale));
    else if (/\.tsx$/u.test(intrare.name) && !/\.test\.tsx$/u.test(intrare.name)) gasite.push(cale);
  }
  return gasite;
}

/**
 * Comentariile plecă înainte de orice numărare de acolade.
 *
 * Nu e curățenie de dragul curățeniei: notele din lista de atribute a paletei
 * conțin chiar `dialog:not([open]) { display: none }`, cu acolade cu tot. Lăsate
 * pe loc, ar dezechilibra numărătoarea și scanarea s-ar opri în mijlocul
 * etichetei.
 */
function faraComentarii(sursa: string): string {
  let iesire = "";
  let ghilimea: string | null = null;
  for (let i = 0; i < sursa.length; i++) {
    const c = sursa[i] ?? "";
    if (ghilimea !== null) {
      iesire += c;
      if (c === "\\") {
        iesire += sursa[i + 1] ?? "";
        i++;
      } else if (c === ghilimea) ghilimea = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      ghilimea = c;
      iesire += c;
      continue;
    }
    if (c === "/" && sursa[i + 1] === "/") {
      while (i < sursa.length && sursa[i] !== "\n") i++;
      iesire += "\n";
      continue;
    }
    if (c === "/" && sursa[i + 1] === "*") {
      i += 2;
      while (i < sursa.length && !(sursa[i] === "*" && sursa[i + 1] === "/")) i++;
      i++;
      iesire += " ";
      continue;
    }
    iesire += c;
  }
  return iesire;
}

/** Eticheta de deschidere `<dialog …>`, cu acoladele JSX echilibrate. */
function etichetaDeschisa(sursa: string, start: number): string {
  let adancime = 0;
  let ghilimea: string | null = null;
  for (let i = start; i < sursa.length; i++) {
    const c = sursa[i] ?? "";
    if (ghilimea !== null) {
      if (c === "\\") i++;
      else if (c === ghilimea) ghilimea = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") ghilimea = c;
    else if (c === "{") adancime++;
    else if (c === "}") adancime--;
    else if (c === ">" && adancime === 0) return sursa.slice(start, i + 1);
  }
  return sursa.slice(start);
}

/** Valoarea lui `className`, ca text brut — fie `"…"`, fie `{…}`. */
function valoareaClassName(eticheta: string): string | null {
  const potrivire = /className\s*=\s*/u.exec(eticheta);
  if (potrivire === null) return null;
  const start = potrivire.index + potrivire[0].length;
  if (eticheta[start] === '"') {
    const sfarsit = eticheta.indexOf('"', start + 1);
    return sfarsit === -1 ? null : eticheta.slice(start, sfarsit + 1);
  }
  if (eticheta[start] !== "{") return null;
  let adancime = 0;
  for (let i = start; i < eticheta.length; i++) {
    if (eticheta[i] === "{") adancime++;
    else if (eticheta[i] === "}" && --adancime === 0) return eticheta.slice(start, i + 1);
  }
  return null;
}

const SIRURI = /"([^"\n]*)"/gu;

/**
 * Toate clasele care ajung pe element, inclusiv prin `className={CONSTANTA}`.
 *
 * Constanta contează: `celula-zi.tsx` își ține clasele într-un `const` de
 * deasupra componentei, iar o poartă care se uită doar în etichetă ar fi trecut
 * pe lângă ea fără să spună nimic — cea mai rea formă de verde.
 */
function claseleDialogului(sursa: string, eticheta: string): string {
  const valoare = valoareaClassName(eticheta);
  if (valoare === null) return "";
  let text = [...valoare.matchAll(SIRURI)].map((m) => m[1] ?? "").join(" ");
  for (const [, nume] of valoare.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/gu)) {
    const declaratie = new RegExp(`\\bconst\\s+${nume ?? ""}\\s*=([\\s\\S]*?);`, "u").exec(sursa);
    if (declaratie !== null)
      text += " " + [...(declaratie[1] ?? "").matchAll(SIRURI)].map((m) => m[1] ?? "").join(" ");
  }
  return text;
}

/**
 * O clasă care declară `display`, cu lanțul ei de variante.
 *
 * `flex-col`, `grid-cols-2`, `table-auto` NU se potrivesc: după cuvânt trebuie
 * să urmeze spațiu sau capătul șirului, nu o cratimă.
 *
 * Lanțul de variante acceptă și forma cu paranteze drepte — `[@media(max-height:
 * 26rem)]:block` e tot un `display` necondiționat, doar cu o condiție mai
 * îngustă. Un tipar care ar fi cerut variante din litere mici ar fi lăsat exact
 * cazul ăsta să treacă, adică pe cel mai greu de observat cu ochiul.
 */
const DISPLAY =
  /(?:^|\s)((?:(?:\[[^\]\s]*\]|[a-z0-9-]+):)*)((?:inline-)?(?:flex|grid|block|table|flow-root|contents)|hidden)(?=\s|$)/gu;

describe("un <dialog> închis nu rămâne în flux", () => {
  const fisiere = plimba(RADACINA);

  it("găsește fișiere de analizat", () => {
    expect(fisiere.length).toBeGreaterThan(100);
  });

  it("niciun <dialog> nu-și declară `display` în afara variantei `open:`", () => {
    const vinovate: string[] = [];

    for (const cale of fisiere) {
      const sursa = faraComentarii(readFileSync(cale, "utf8"));
      for (const { index } of sursa.matchAll(/<dialog(?=[\s>])/gu)) {
        const clase = claseleDialogului(sursa, etichetaDeschisa(sursa, index));
        for (const [, variante, baza] of clase.matchAll(DISPLAY)) {
          // `hidden` e chiar implicitul UA scris pe față, deci mereu în regulă.
          if (baza === "hidden") continue;
          if ((variante ?? "").includes("open:")) continue;
          vinovate.push(`${relative(RADACINA, cale)}: ${variante ?? ""}${baza ?? ""}`);
        }
      }
    }

    expect(
      vinovate,
      "Un `display` necondiționat pe `<dialog>` bate regula `dialog:not([open]) " +
        "{ display: none }` a browserului: dialogul închis rămâne o cutie așezată " +
        "absolut în flux, invizibilă, dar numărată în înălțimea documentului — " +
        "adică derulare în gol sub conținut. Scrie `hidden … open:flex`.",
    ).toEqual([]);
  });
});
