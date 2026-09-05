import { existsSync, readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { arePrinGeam, cheiCuCaptura, notaVitrinei } from "./vitrine";

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

  it("componenta benzii nu e de client și nu reexportă catalogul", () => {
    /*
     * Când banda arăta un `<iframe>` cu demonstrație interactivă, avea nevoie de
     * `<dialog>` + JavaScript, deci era `"use client"` — și de acolo a pornit
     * defectul. Acum mărirea se face cu `popover` nativ, deci fișierul e
     * Server Component, iar clasa de defect e imposibilă pe drumul ăsta.
     *
     * Testul păzește AMBELE capete: să nu redevină de client la o refactorizare
     * care reintroduce JavaScript, și să nu reexporte catalogul — un
     * `export { arePrinGeam } from "./vitrine"` ar arăta inofensiv și ar recrea
     * defectul întocmai dacă fișierul ar fi vreodată marcat din nou.
     */
    const sursaComponenta = readFileSync("src/app/(marketing)/_componente/prin-geam.tsx", "utf8");
    expect(
      /^\s*["']use client["']/m.test(sursaComponenta),
      "Banda a redevenit `use client`. Dacă e nevoie de JavaScript, mută-l într-un copil dedicat — exporturile fișierului ăstuia sunt atinse din graful de server.",
    ).toBe(false);
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

  it("fiecare cheie din catalog are ambele fișiere pe disc", () => {
    /*
     * Poarta care prinde greșeala cea mai probabilă de aici înainte: cineva
     * adaugă o cheie în catalog fără să genereze capturile, sau redenumește un
     * fișier. Pagina publică ar randa o imagine ruptă — un pătrat cu alt-text
     * pe pagina de vânzare a modulului — fără nicio eroare, fără niciun test
     * roșu, fiindcă `<img>` nu se plânge de un `src` care dă 404.
     */
    for (const cheie of cheiCuCaptura()) {
      for (const latime of [960, 1920]) {
        const cale = `public/capturi/${cheie}-${String(latime)}.webp`;
        expect(existsSync(cale), `lipsește ${cale}`).toBe(true);
      }
    }
  });

  it("nu există capturi orfane pe disc, fără cheie în catalog", () => {
    // Reversul: fișiere rămase după ce o cheie a fost scoasă. Nu strică nimic
    // vizibil, dar umflă imaginea de deployment și induc în eroare pe cine
    // caută de ce nu se vede o captură care „există".
    const peDisc = new Set(
      readdirSync("public/capturi")
        .filter((f) => f.endsWith(".webp"))
        .map((f) => f.replace(/-\d+\.webp$/, "")),
    );
    expect([...peDisc].sort()).toEqual([...cheiCuCaptura()].sort());
  });

  it("captura modulului `leave` își declară limita, ca pagina să nu se contrazică", () => {
    /*
     * `ro.ts` promite, în punctele modulului, „Unsprezece tipuri, fiecare cu
     * temeiul legal notat". Captura arată UN ecran, pe O lună. Ambele texte
     * ajung pe aceeași pagină, la câțiva centimetri distanță, deci fără notă
     * pagina s-ar contrazice sub ochii unui prospect.
     *
     * Asertarea nu cere un cuvânt anume — un tipar pe „subset" ar fi căzut la
     * prima reformulare, fără ca nimic să se strice de fapt. Cere ca nota să
     * existe, să fie o frază adevărată, și să numească explicit cele
     * unsprezece tipuri față de care se declară mai mică.
     */
    const nota = notaVitrinei("leave") ?? "";
    expect(nota.length).toBeGreaterThan(40);
    expect(nota).toMatch(/unsprezece|11/i);
    expect(notaVitrinei("courses")).toBeUndefined();
  });
});
