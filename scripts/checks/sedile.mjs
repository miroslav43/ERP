#!/usr/bin/env node
// scripts/checks/sedile.mjs
//
// Poarta pentru „ş”/„ţ” cu SEDILĂ în codul aplicației.
//
// ── DE CE EXISTĂ ───────────────────────────────────────────────────────────
// Regula proiectului e virgula dedesubt: ș/ț (U+0219/U+021B), Ș/Ț
// (U+0218/U+021A). Sedila (U+015F/U+0163, U+015E/U+0162) arată aproape la fel
// pe ecran, deci nici ochiul, nici `tsc`, `eslint` sau `vitest` n-o văd. QA din
// oct 2026 a găsit-o în 454 de denumiri din nomenclatorul CAEN (ONB-016),
// copiate dintr-un PDF, și în mesajele P0001 ale flotei (ADM-021). Un
// selector de cod CAEN care scrie „Activităţi” lângă „Activități” e exact
// felul de defect pe care nimeni nu-l raportează până nu-l caută.
//
// ── CE VERIFICĂ, ȘI CE NU ──────────────────────────────────────────────────
// Fișierele `.ts`/`.tsx` din `src/`, fără teste: acolo sedila e adesea chiar
// intrarea verificată („mesajul vechi din bază ajunge cu virgulă”). Se
// verifică doar TOKENURILE — șiruri, șabloane, JSX, expresii regulate,
// identificatori. Comentariile (inclusiv JSDoc) sunt sărite: în ele sedila
// apare legitim, când se explică de ce e rea.
//
// Codul care chiar trebuie să numească litera cu sedilă (de exemplu tabela
// `cuVirgula` din `src/lib/text/diacritice.ts`) o scrie ca secvență `ş`,
// nu ca literă — sursa rămâne citibilă și poarta, curată.
//
// Migrările SQL vechi sunt imuabile (forward-only), deci rămân în afara porții.
//
// Rulare: `node scripts/checks/sedile.mjs [cale...]`
// Ieșiri: 0 curat · 1 s-a găsit ceva · 2 nu s-a putut rula.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const RADACINA = fileURLToPath(new URL("../..", import.meta.url));
const EXTENSII = new Set([".ts", ".tsx"]);
const SARITE = new Set(["node_modules", ".next", ".git", "dist", "out"]);
const SEDILA = /[\u015E\u015F\u0162\u0163]/u;

function esteTest(cale) {
  return /\.test\.tsx?$/u.test(cale) || /[\\/]__tests__[\\/]/u.test(cale);
}

/** Toate fișierele TS/TSX de sub `radacina`, fără teste și artefacte. */
function* fisiere(radacina) {
  const stare = statSync(radacina);
  if (!stare.isDirectory()) {
    yield radacina;
    return;
  }
  for (const intrare of readdirSync(radacina)) {
    if (SARITE.has(intrare)) continue;
    const cale = join(radacina, intrare);
    if (statSync(cale).isDirectory()) yield* fisiere(cale);
    else if (EXTENSII.has(intrare.slice(intrare.lastIndexOf("."))) && !esteTest(cale)) yield cale;
  }
}

function esteJsDoc(nod) {
  return nod.kind >= ts.SyntaxKind.FirstJSDocNode && nod.kind <= ts.SyntaxKind.LastJSDocNode;
}

/** Liniile (1-based) pe care un token nefiind comentariu conține sedilă. */
function liniiCuSedila(cale) {
  const text = readFileSync(cale, "utf8");
  if (!SEDILA.test(text)) return [];
  const sursa = ts.createSourceFile(
    cale,
    text,
    ts.ScriptTarget.Latest,
    true,
    cale.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const linii = new Set();
  const viziteaza = (nod) => {
    if (esteJsDoc(nod)) return;
    const copii = nod.getChildren(sursa);
    if (copii.length === 0) {
      // Frunză: textul ei NU include trivia (spațiile și comentariile dinainte).
      const inceput = nod.getStart(sursa);
      const bucata = text.slice(inceput, nod.getEnd());
      if (SEDILA.test(bucata)) {
        const index = inceput + bucata.search(SEDILA);
        linii.add(sursa.getLineAndCharacterOfPosition(index).line + 1);
      }
      return;
    }
    for (const copil of copii) viziteaza(copil);
  };
  viziteaza(sursa);
  return [...linii].sort((a, b) => a - b);
}

function main() {
  const argumente = process.argv.slice(2);
  const tinte = argumente.length > 0 ? argumente : [join(RADACINA, "src")];
  const gasite = [];
  for (const tinta of tinte) {
    for (const cale of fisiere(tinta)) {
      for (const linie of liniiCuSedila(cale)) {
        gasite.push(`${relative(RADACINA, cale)}:${String(linie)}`);
      }
    }
  }
  if (gasite.length === 0) {
    console.log("sedile: curat — nicio literă ş/ţ cu sedilă în codul din src/.");
    return 0;
  }
  console.error(
    `sedile: ${String(gasite.length)} linii de cod cu ş/ţ cu SEDILĂ (regula e ș/ț cu virgulă dedesubt):`,
  );
  for (const g of gasite) console.error(`  ${g}`);
  console.error(
    "\nÎnlocuiți ş→ș, ţ→ț, Ş→Ș, Ţ→Ț. Dacă litera cu sedilă e chiar subiectul codului, scrieți-o ca `\\u015F`.",
  );
  return 1;
}

try {
  process.exitCode = main();
} catch (eroare) {
  console.error("sedile: verificarea n-a putut rula:", eroare);
  process.exitCode = 2;
}
