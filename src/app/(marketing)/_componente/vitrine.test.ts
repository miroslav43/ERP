import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { arePrinGeam, notaVitrinei } from "./vitrine";

/**
 * Poarta care ar fi prins defectul livrat în producție.
 *
 * ── CE S-A ÎNTÂMPLAT ──────────────────────────────────────────────────────
 * `arePrinGeam` a trăit o vreme în `prin-geam.tsx`, un fișier `"use client"`,
 * și era APELAT din `module/[modul]/page.tsx`, care e Server Component. Next
 * rescrie fiecare export numit al unui modul `"use client"` într-un
 * `registerClientReference`, iar proxy-ul acela aruncă la apel în graful de
 * server: o referință de client e o adresă de trimis browserului, nu o funcție
 * de executat. Cum `generateStaticParams` prerandează toate cele nouăsprezece
 * chei la build, fiecare pagină `/module/*` executa apelul și `next build`
 * cădea cu „Error occurred prerendering page".
 *
 * Nici `tsc`, nici ESLint nu văd nimic: tipurile se potrivesc perfect, importul
 * există, apelul e legal. Se vede DOAR la build sau la rulare.
 *
 * ── CE VERIFICĂ TESTUL ────────────────────────────────────────────────────
 * Invarianta generală („niciun Server Component nu apelează un export dintr-un
 * fișier `"use client"`") ar cere un graf de importuri; testul de față o
 * verifică pe cea care s-a stricat efectiv, cu două afirmații ieftine:
 *
 *   1. modulul care exportă `arePrinGeam` NU conține directiva `"use client"`;
 *   2. pagina de modul îl importă de acolo, nu din componenta de client.
 *
 * Împreună, cele două nu pot fi ocolite prin mutarea funcției înapoi: mutată,
 * cade (1); reimportată din `prin-geam`, cade (2).
 */
describe("catalogul vitrinelor e citibil din graful de server", () => {
  const SURSA_VITRINE = readFileSync("src/app/(marketing)/_componente/vitrine.ts", "utf8");
  const SURSA_PAGINA = readFileSync("src/app/(marketing)/module/[modul]/page.tsx", "utf8");

  it("modulul care exportă `arePrinGeam` nu e marcat `use client`", () => {
    expect(SURSA_VITRINE).toMatch(/export function arePrinGeam/);
    expect(
      /^\s*["']use client["']/m.test(SURSA_VITRINE),
      "`arePrinGeam` e apelat din Server Component; un fișier `use client` l-ar transforma într-o referință care aruncă la apel și ar rupe prerandarea tuturor paginilor /module/*.",
    ).toBe(false);
  });

  it("pagina de modul importă `arePrinGeam` din catalog, nu din componenta de client", () => {
    expect(SURSA_PAGINA).toMatch(
      /import \{ arePrinGeam \} from "\.\.\/\.\.\/_componente\/vitrine"/,
    );
    expect(
      /import \{[^}]*\barePrinGeam\b[^}]*\} from "[^"]*prin-geam"/.test(SURSA_PAGINA),
      "`prin-geam.tsx` e `use client`; importul de acolo readuce exact defectul reparat.",
    ).toBe(false);
  });

  it("componenta de client nu reexportă catalogul", () => {
    /*
     * Un `export { arePrinGeam } from "./vitrine"` scris în `prin-geam.tsx` ar
     * arăta inofensiv și ar recrea defectul întocmai: reexportul dintr-un fișier
     * `"use client"` e la fel de mult o referință de client ca definiția însăși.
     */
    const sursaComponenta = readFileSync("src/app/(marketing)/_componente/prin-geam.tsx", "utf8");
    expect(sursaComponenta).toMatch(/^\s*["']use client["']/m);
    expect(/export\s*\{[^}]*\barePrinGeam\b/.test(sursaComponenta)).toBe(false);
  });
});

describe("catalogul vitrinelor", () => {
  it("știe pentru care module există vitrină", () => {
    expect(arePrinGeam("leave")).toBe(true);
    expect(arePrinGeam("courses")).toBe(false);
  });

  it("nu confundă cheile moștenite de pe `Object.prototype` cu module", () => {
    // `"constructor" in VITRINE` ar fi fost `true` cu un `in` naiv, iar pagina
    // /module/constructor — dacă ar exista vreodată o cheie cu numele ăsta —
    // ar fi randat o bandă către o vitrină inexistentă.
    expect(arePrinGeam("constructor")).toBe(false);
    expect(arePrinGeam("toString")).toBe(false);
  });

  it("nu întoarce funcția moștenită de pe `Object.prototype` drept notă", () => {
    // Aceeași capcană ca mai sus, dar pe `notaVitrinei`: `VITRINE["toString"]`
    // cu acces direct cu paranteze întoarce FUNCȚIA moștenită, nu `undefined`
    // — React ar primi un copil de tip funcție în loc de text sau nimic.
    expect(notaVitrinei("constructor")).toBeUndefined();
    expect(notaVitrinei("toString")).toBeUndefined();
  });

  it("fiecare vitrină își declară subsetul, ca pagina să nu se contrazică", () => {
    // `ro.ts` promite unsprezece tipuri de concediu; `src/demo/lume.ts` are
    // trei. Nota e singurul loc unde diferența e spusă cu voce tare.
    const nota = notaVitrinei("leave");
    expect(nota).toBeDefined();
    expect(nota ?? "").toMatch(/subset/i);
    expect(notaVitrinei("courses")).toBeUndefined();
  });
});
