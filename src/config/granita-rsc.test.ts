// Poarta graniței server→client.
//
// Trăiește sub `src/` din același motiv ca `docs.test.ts`: `vitest.config.mts`
// limitează proiectul `unit` la `include: ["src/**/*.test.ts"]`. Pus în
// `tests/`, n-ar rula niciodată.
//
// ── CE PRINDE ȘI DE CE N-O PRINDEA NIMIC ALTCEVA ─────────────────────────────
// O Componentă de Server nu poate trece o FUNCȚIE unei Componente de Client:
// RSC serializează props-urile, iar o funcție n-are reprezentare. Next aruncă
// „Functions cannot be passed directly to Client Components”, pagina cade în
// `error.tsx` și omul vede un dreptunghi roșu cu un cod de incident.
//
// Nici una dintre cele patru porți n-o vede:
//   · `tsc`      — tipul `(deschide: () => void) => ReactElement` e corect;
//   · `eslint`   — nu are noțiunea de graniță RSC;
//   · `vitest`   — testele randează componentele ca pe niște componente React
//                  obișnuite, fără graniță, deci acolo funcția merge;
//   · `build`    — paginile sunt dinamice (`requireTenant` citește cookie-uri),
//                  deci nu se prerandează nimic la build; serializarea se
//                  întâmplă abia la prima cerere reală.
//
// S-a întâmplat: `/evaluari/sabloane` și fișa angajatului au ajuns pe producție
// căzute în întregime, cu tot cu listele lor, pentru un buton.
//
// ── LIMITA ───────────────────────────────────────────────────────────────────
// Scanarea prinde funcția scrisă LA FAȚA LOCULUI (`prop={() => …}`,
// `prop={function …}`). Nu prinde `prop={numeleFunctiei}`, care ar cere
// urmărirea legăturilor. Toate cele trei apariții reale erau scrise la fața
// locului, iar tiparul „declanșator randat de apelant” așa se scrie.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..");

function plimba(dir: string): string[] {
  const gasite: string[] = [];
  for (const intrare of readdirSync(dir, { withFileTypes: true })) {
    const cale = join(dir, intrare.name);
    if (intrare.isDirectory()) gasite.push(...plimba(cale));
    else if (/\.tsx?$/.test(intrare.name)) gasite.push(cale);
  }
  return gasite;
}

/**
 * Directiva se caută în capul fișierului: mai jos ar fi doar un șir oarecare.
 *
 * Comentariile de deasupra ei se sar. Jumătate din fișierele de client din
 * depozit încep cu linia de cale (`// src/app/…/formular-saptamana.tsx`) și abia
 * apoi cu `"use client"` — perfect valid pentru Next, care cere doar ca
 * directiva să fie prima INSTRUCȚIUNE. Cât timp regula cerea directiva pe
 * primul rând fizic, poarta le socotea Componente de Server și le raporta
 * fiecare `onSchimba={…}` drept abatere: un fals pozitiv care ar fi împins
 * exact la mutarea codului corect.
 */
function esteClient(text: string): boolean {
  const faraComentarii = text
    .slice(0, 2000)
    .replace(/^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*/, "");
  return /^\s*(["'])use client\1/.test(faraComentarii);
}

const fisiere = plimba(SRC);
const continut = new Map(fisiere.map((f) => [f, readFileSync(f, "utf8")]));

const moduleClient = new Set(
  fisiere.filter((f) => esteClient(continut.get(f) ?? "")).map((f) => f.replace(/\.tsx?$/, "")),
);

/** `@/…` și căile relative; pachetele din `node_modules` nu ne interesează. */
function rezolva(specificator: string, dinFisier: string): string | null {
  let baza: string;
  if (specificator.startsWith("@/")) baza = join(SRC, specificator.slice(2));
  else if (specificator.startsWith(".")) baza = normalize(join(dirname(dinFisier), specificator));
  else return null;
  for (const candidat of [baza, join(baza, "index")]) {
    if (moduleClient.has(candidat)) return candidat;
  }
  return null;
}

/** Numele importate din module „use client”, oricare ar fi forma importului. */
function identificatoriDeClient(text: string, fisier: string): Map<string, string> {
  const harta = new Map<string, string>();
  for (const potrivire of text.matchAll(
    /import\s+(?:type\s+)?([^;]+?)\s+from\s+["']([^"']+)["']/g,
  )) {
    const tinta = rezolva(potrivire[2] ?? "", fisier);
    if (tinta === null) continue;
    const clauza = potrivire[1] ?? "";
    const acolade = /\{([^}]*)\}/.exec(clauza);
    const implicit = clauza
      .replace(/\{[^}]*\}/, "")
      .replace(/,/g, "")
      .trim();
    if (implicit !== "" && !implicit.startsWith("*")) harta.set(implicit, tinta);
    for (const bucata of (acolade?.[1] ?? "").split(",")) {
      const nume = bucata
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (nume !== undefined && nume !== "") harta.set(nume, tinta);
    }
  }
  return harta;
}

/** Textul tagului de deschidere, de la `<Nume` până la `>` din afara acoladelor. */
function tagDeschidere(text: string, de: number): string {
  let i = de;
  let adancime = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "{") adancime += 1;
    else if (c === "}") adancime -= 1;
    else if (c === ">" && adancime === 0) break;
    i += 1;
  }
  return text.slice(de, i);
}

const PROP_FUNCTIE = [
  /(\w+)=\{\s*(?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g,
  /(\w+)=\{\s*(?:async\s+)?function\b/g,
];

describe("graniță server→client: niciun prop-funcție trecut unei Componente de Client", () => {
  it("nu există apeluri care ar cădea la prima cerere", () => {
    const abateri: string[] = [];

    for (const fisier of fisiere) {
      if (!fisier.endsWith(".tsx")) continue;
      if (fisier.endsWith(".test.tsx")) continue; // randate direct, fără graniță
      const text = continut.get(fisier) ?? "";
      if (esteClient(text)) continue; // client → client e permis

      const deClient = identificatoriDeClient(text, fisier);
      if (deClient.size === 0) continue;

      for (const potrivire of text.matchAll(/<([A-Z][A-Za-z0-9_]*)\b/g)) {
        const componenta = potrivire[1] ?? "";
        if (!deClient.has(componenta)) continue;
        const inceput = potrivire.index;
        const tag = tagDeschidere(text, inceput + potrivire[0].length);
        for (const tipar of PROP_FUNCTIE) {
          for (const prop of tag.matchAll(tipar)) {
            const linie = text.slice(0, inceput).split("\n").length;
            const relativ = fisier.slice(SRC.length + 1);
            abateri.push(`src/${relativ}:${String(linie)} — <${componenta} ${prop[1] ?? "?"}={…}>`);
          }
        }
      }
    }

    expect(
      abateri,
      "o Componentă de Server trece o funcție unei Componente de Client; " +
        "mută declanșatorul de partea clientului, lângă componenta pe care o deschide",
    ).toEqual([]);
  });

  it("scanarea chiar vede fișiere — altfel poarta ar fi verde degeaba", () => {
    // O sondă de control: dacă `plimba` sau detecția „use client” se strică,
    // testul de mai sus ar trece cu zero abateri fiindcă n-a citit nimic.
    expect(fisiere.length).toBeGreaterThan(200);
    expect(moduleClient.size).toBeGreaterThan(50);
  });
});
