#!/usr/bin/env node
// scripts/checks/use-server-exports.mjs
//
// Poarta pentru singura clasă de defect pe care NUMAI `next build` o prindea.
//
// ── DE CE EXISTĂ ───────────────────────────────────────────────────────────
// Un fișier cu directiva `"use server"` nu poate exporta decât funcții async.
// O constantă exportată de acolo produce, la build:
//
//   A "use server" file can only export async functions, found object.
//
// `pnpm typecheck`, `pnpm lint` și `pnpm test` o ratează pe toate trei — apare
// EXCLUSIV la `next build`, în faza „Collecting page data", după minute de
// TypeScript. S-a întâmplat pe 2026-09-05, la build-ul de producție din
// Docker, unde costul unei reveniri e cel mai mare: `FELURI_NOTIFICARE` era
// exportat din `(portal)/portal/notificarile-mele/actions.ts`.
//
// CLAUDE.md avertizează despre clasa asta de trei versiuni. Un avertisment în
// proză nu e o poartă; asta e.
//
// ── CE VERIFICĂ, ȘI CE NU POATE ────────────────────────────────────────────
// Verificarea e STATICĂ, deci nu poate ști ce întoarce un apel la rulare.
// Regula aleasă: se semnalează exporturile a căror valoare e VIZIBIL nefuncție
// — literal de obiect, de tablou, șir, număr, boolean, template, `new`, sau o
// clasă. Se acceptă tot ce POATE fi o funcție async: declarații de funcție,
// funcții-săgeată, expresii de apel (`createAction({...})` — tiparul casei),
// identificatori.
//
// Deci: zero fals-pozitive prin construcție, cu prețul unor fals-negative pe
// forme exotice. Ce prinde, prinde sigur; ce scapă, scapă la build, ca înainte.
// Un `export type` / `export interface` nu contează — tipurile se șterg.
//
// Rulare: `node scripts/checks/use-server-exports.mjs [cale...]`
// Ieșiri: 0 curat · 1 s-a găsit ceva · 2 nu s-a putut rula.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const RADACINA = fileURLToPath(new URL("../..", import.meta.url));
const EXTENSII = new Set([".ts", ".tsx", ".mts", ".cts"]);
const SARITE = new Set(["node_modules", ".next", ".git", "mobil", "dist", "out"]);

/** Toate fișierele TS/TSX de sub `radacina`, fără directoarele de artefacte. */
function* fisiere(radacina) {
  for (const intrare of readdirSync(radacina)) {
    if (SARITE.has(intrare)) continue;
    const cale = join(radacina, intrare);
    const stare = statSync(cale);
    if (stare.isDirectory()) yield* fisiere(cale);
    else if (EXTENSII.has(intrare.slice(intrare.lastIndexOf(".")))) yield cale;
  }
}

/** Are fișierul directiva `"use server"` la nivel de MODUL (nu în funcție)? */
function areDirectivaDeModul(sursa) {
  for (const instructiune of sursa.statements) {
    if (!ts.isExpressionStatement(instructiune)) break;
    const expresie = instructiune.expression;
    if (!ts.isStringLiteral(expresie) && !ts.isNoSubstitutionTemplateLiteral(expresie)) break;
    if (expresie.text === "use server") return true;
  }
  return false;
}

/** Scoate `as const`, `satisfies X` și parantezele, ca să vedem valoarea reală. */
function dezbraca(nod) {
  let n = nod;
  while (
    n !== undefined &&
    (ts.isAsExpression(n) || ts.isSatisfiesExpression(n) || ts.isParenthesizedExpression(n))
  ) {
    n = n.expression;
  }
  return n;
}

/** Numele felului de valoare, dacă e VIZIBIL o nefuncție. Altfel `null`. */
function felDeNefunctie(nod) {
  const n = dezbraca(nod);
  if (n === undefined) return "valoare fără inițializator";
  if (ts.isObjectLiteralExpression(n)) return "obiect";
  if (ts.isArrayLiteralExpression(n)) return "tablou";
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return "șir";
  if (ts.isTemplateExpression(n)) return "șir";
  if (ts.isNumericLiteral(n)) return "număr";
  if (ts.isBigIntLiteral(n)) return "număr";
  if (n.kind === ts.SyntaxKind.TrueKeyword || n.kind === ts.SyntaxKind.FalseKeyword) {
    return "boolean";
  }
  if (n.kind === ts.SyntaxKind.NullKeyword) return "null";
  if (ts.isNewExpression(n)) return "instanță de clasă";
  if (ts.isRegularExpressionLiteral(n)) return "expresie regulată";
  return null;
}

function areModificator(nod, fel) {
  return (ts.canHaveModifiers(nod) ? (ts.getModifiers(nod) ?? []) : []).some((m) => m.kind === fel);
}

function verificaFisier(cale) {
  const text = readFileSync(cale, "utf8");
  if (!text.includes("use server")) return [];

  const sursa = ts.createSourceFile(cale, text, ts.ScriptTarget.Latest, true);
  if (!areDirectivaDeModul(sursa)) return [];

  const gasite = [];
  const raporteaza = (nod, nume, fel) => {
    const { line } = sursa.getLineAndCharacterOfPosition(nod.getStart(sursa));
    gasite.push({ cale, linie: line + 1, nume, fel });
  };

  for (const instructiune of sursa.statements) {
    if (!areModificator(instructiune, ts.SyntaxKind.ExportKeyword)) continue;

    if (ts.isVariableStatement(instructiune)) {
      for (const declaratie of instructiune.declarationList.declarations) {
        const fel = felDeNefunctie(declaratie.initializer);
        if (fel !== null) raporteaza(declaratie, declaratie.name.getText(sursa), fel);
      }
      continue;
    }
    if (ts.isClassDeclaration(instructiune)) {
      raporteaza(instructiune, instructiune.name?.getText(sursa) ?? "(clasă anonimă)", "clasă");
      continue;
    }
    if (ts.isEnumDeclaration(instructiune)) {
      raporteaza(instructiune, instructiune.name.getText(sursa), "enum");
      continue;
    }
    // Declarațiile de funcție se verifică separat: trebuie să fie `async`.
    if (ts.isFunctionDeclaration(instructiune)) {
      if (!areModificator(instructiune, ts.SyntaxKind.AsyncKeyword)) {
        raporteaza(
          instructiune,
          instructiune.name?.getText(sursa) ?? "(funcție)",
          "funcție NEasync",
        );
      }
    }
  }
  return gasite;
}

// ── Rulare ─────────────────────────────────────────────────────────────────
const argumente = process.argv.slice(2);
const radacini = argumente.length > 0 ? argumente : [join(RADACINA, "src")];

let toate = [];
try {
  for (const radacina of radacini) {
    const stare = statSync(radacina);
    if (stare.isDirectory()) {
      for (const cale of fisiere(radacina)) toate = toate.concat(verificaFisier(cale));
    } else {
      toate = toate.concat(verificaFisier(radacina));
    }
  }
} catch (eroare) {
  console.error(`use-server-exports: nu am putut rula — ${eroare.message}`);
  process.exit(2);
}

if (toate.length === 0) {
  process.exit(0);
}

console.error("");
console.error('  Exporturi nepermise dintr-un fișier "use server":');
console.error("");
for (const g of toate) {
  console.error(`  ${relative(RADACINA, g.cale)}:${g.linie}`);
  console.error(`    ${g.nume} — ${g.fel}`);
}
console.error("");
console.error('  Un fișier "use server" nu poate exporta decât funcții async.');
console.error("  Next refuză build-ul; tsc, eslint și vitest tac toate trei.");
console.error("  Leacul: mută valoarea într-un modul alături și importă-o.");
console.error("");
process.exit(1);
