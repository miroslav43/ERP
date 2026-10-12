#!/usr/bin/env node
// scripts/checks/client-imports-server-only.mjs
//
// Poarta pentru a doua clasă de defect pe care NUMAI `next build` o prinde.
//
// ── DE CE EXISTĂ ───────────────────────────────────────────────────────────
// Un fișier `"use client"` care importă o VALOARE dintr-un modul cu
// `import "server-only"` — direct sau printr-un lanț de module — pică la build:
//
//   Error: 'server-only' cannot be imported from a Client Component module
//
// `pnpm typecheck`, `pnpm lint` și `pnpm test` tac toate trei; `vitest` chiar
// aliasează `server-only` ca să poată testa citirile. S-a întâmplat pe
// 2026-10-08, la a7c2b58: `registru/filtre-registru.tsx` importa listele de
// stări din `lib/queries/registru.ts`. CI a picat după 5 minute de build, iar
// staging a rămas pe versiunea veche.
//
// ── CE VERIFICĂ, ȘI CE NU POATE ────────────────────────────────────────────
// Static: graful importurilor de VALOARE dintre fișierele proiectului
// (`import x from`, `export … from`; NU `import type`, NU specificatorii
// `type X`). Din fiecare fișier `"use client"` se caută un drum până la un
// fișier cu `import "server-only"`. Un fișier `"use server"` e graniță:
// clientul primește acolo o referință, nu codul, deci drumul se oprește.
//
// Nu urmărește `import()` dinamic, nici pachetele din `node_modules`. Ce prinde,
// prinde sigur; ce scapă, scapă la build, ca înainte.
//
// Rulare: `node scripts/checks/client-imports-server-only.mjs [fișier-client...]`
// Fără argumente verifică toate fișierele client din `src/`.
// Ieșiri: 0 curat · 1 s-a găsit ceva · 2 nu s-a putut rula.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const RADACINA = fileURLToPath(new URL("../..", import.meta.url));
const SRC = join(RADACINA, "src");
const EXTENSII = [".ts", ".tsx", ".mts", ".cts"];
const SARITE = new Set(["node_modules", ".next", ".git", "mobil", "dist", "out"]);

function* fisiere(radacina) {
  for (const intrare of readdirSync(radacina)) {
    if (SARITE.has(intrare)) continue;
    const cale = join(radacina, intrare);
    const stare = statSync(cale);
    if (stare.isDirectory()) yield* fisiere(cale);
    else if (EXTENSII.includes(intrare.slice(intrare.lastIndexOf(".")))) yield cale;
  }
}

/** Directiva de la nivel de MODUL (`"use client"` / `"use server"`), dacă există. */
function directiva(sursa) {
  for (const instructiune of sursa.statements) {
    if (!ts.isExpressionStatement(instructiune)) break;
    const expresie = instructiune.expression;
    if (!ts.isStringLiteral(expresie) && !ts.isNoSubstitutionTemplateLiteral(expresie)) break;
    if (expresie.text === "use client" || expresie.text === "use server") return expresie.text;
  }
  return null;
}

/** Specificatorii de modul importați ca VALOARE (nu `import type`). */
function importuriDeValoare(sursa) {
  const rezultat = [];
  for (const s of sursa.statements) {
    if (ts.isImportDeclaration(s)) {
      if (!ts.isStringLiteral(s.moduleSpecifier)) continue;
      const clauza = s.importClause;
      // `import "server-only"` — efect secundar, fără clauză: e o valoare.
      if (clauza === undefined) {
        rezultat.push(s.moduleSpecifier.text);
        continue;
      }
      if (clauza.isTypeOnly) continue;
      const legaturi = clauza.namedBindings;
      if (
        clauza.name === undefined &&
        legaturi !== undefined &&
        ts.isNamedImports(legaturi) &&
        legaturi.elements.every((e) => e.isTypeOnly)
      ) {
        continue;
      }
      rezultat.push(s.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(s)) {
      if (s.moduleSpecifier === undefined || !ts.isStringLiteral(s.moduleSpecifier)) continue;
      if (s.isTypeOnly) continue;
      const clauza = s.exportClause;
      if (
        clauza !== undefined &&
        ts.isNamedExports(clauza) &&
        clauza.elements.every((e) => e.isTypeOnly)
      ) {
        continue;
      }
      rezultat.push(s.moduleSpecifier.text);
    }
  }
  return rezultat;
}

/** Calea pe disc a unui specificator din proiect, sau `null` pentru pachete. */
function rezolva(specificator, dinFisier) {
  let baza;
  if (specificator.startsWith("@/")) baza = join(SRC, specificator.slice(2));
  else if (specificator.startsWith(".")) baza = resolve(dirname(dinFisier), specificator);
  else return null;
  for (const ext of ["", ...EXTENSII]) {
    const cale = baza + ext;
    if (existsSync(cale) && statSync(cale).isFile()) return cale;
  }
  for (const ext of EXTENSII) {
    const cale = join(baza, `index${ext}`);
    if (existsSync(cale)) return cale;
  }
  return null;
}

function citeste(cale) {
  return ts.createSourceFile(cale, readFileSync(cale, "utf8"), ts.ScriptTarget.Latest, false);
}

function main() {
  const argumente = process.argv.slice(2).map((a) => resolve(a));
  const toate = [...fisiere(SRC)];

  /** Per fișier: directiva și importurile de valoare rezolvate în proiect. */
  const info = new Map();
  const ia = (cale) => {
    const gata = info.get(cale);
    if (gata !== undefined) return gata;
    const sursa = citeste(cale);
    const intrare = {
      directiva: directiva(sursa),
      serverOnly: false,
      importuri: [],
    };
    for (const spec of importuriDeValoare(sursa)) {
      if (spec === "server-only") intrare.serverOnly = true;
      const tinta = rezolva(spec, cale);
      if (tinta !== null) intrare.importuri.push(tinta);
    }
    info.set(cale, intrare);
    return intrare;
  };

  const clienti =
    argumente.length > 0 ? argumente : toate.filter((c) => ia(c).directiva === "use client");

  /** Drumul de la un fișier client la primul `server-only`, dacă există. */
  function drumSpreServer(start) {
    const stiva = [[start, [start]]];
    const vazute = new Set([start]);
    while (stiva.length > 0) {
      const [cale, drum] = stiva.pop();
      const i = ia(cale);
      if (i.serverOnly) return drum;
      // Un fișier `"use server"` e graniță: clientul primește o referință.
      if (cale !== start && i.directiva === "use server") continue;
      for (const urm of i.importuri) {
        if (vazute.has(urm)) continue;
        vazute.add(urm);
        stiva.push([urm, [...drum, urm]]);
      }
    }
    return null;
  }

  const gasite = [];
  for (const client of clienti) {
    const drum = drumSpreServer(client);
    if (drum !== null) gasite.push(drum);
  }

  if (gasite.length === 0) {
    console.log(
      `client-imports-server-only: curat — ${clienti.length} fișiere "use client" verificate.`,
    );
    return 0;
  }

  console.error(
    `client-imports-server-only: ${gasite.length} fișier(e) "use client" ajung la \`server-only\`.`,
  );
  for (const drum of gasite) {
    console.error("");
    console.error(`  ${relative(RADACINA, drum[0])}`);
    for (const pas of drum.slice(1)) console.error(`    → ${relative(RADACINA, pas)}`);
  }
  console.error("");
  console.error(
    "  Mută valorile importate într-un modul fără `server-only` (ex. `src/lib/<modul>/filtre.ts`)\n" +
      "  sau folosește `import type`. Build-ul ar pica cu „'server-only' cannot be imported\n" +
      "  from a Client Component module”.",
  );
  return 1;
}

try {
  process.exitCode = main();
} catch (eroare) {
  console.error(`client-imports-server-only: nu s-a putut rula — ${String(eroare)}`);
  process.exitCode = 2;
}
