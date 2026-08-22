#!/usr/bin/env node
// Hook PreToolUse. NU BLOCHEAZĂ NICIODATĂ: ieșire 0 mereu, fără
// `permissionDecision`. Doar avertizează, pe trei reguli verificabile mecanic.
//
//   1. `.upsert()` pe un index unic PARȚIAL          → 42P10 (capcana 7)
//   2. import de client admin în afara listei ESLint → `pnpm lint` pică
//   3. `.rpc()` pe o funcție din schema `app`        → capcanele 1 și 14
//
// Fiecare regulă e proiectată să NU dea fals pozitiv; vezi comentariile.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const RADACINA = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const DIR_MIGRARI = join(RADACINA, "supabase/migrations");
const iesiCurat = () => process.exit(0);

let ev;
try {
  ev = JSON.parse(readFileSync(0, "utf8"));
} catch {
  iesiCurat();
}
const cale = ev?.tool_input?.file_path ?? "";
if (!cale || !existsSync(DIR_MIGRARI)) iesiCurat(); // alt repo: tăcere

const ti = ev.tool_input ?? {};
const text = [
  ti.content,
  ti.new_string,
  ...(Array.isArray(ti.edits) ? ti.edits.map((e) => e?.new_string) : []),
]
  .filter((s) => typeof s === "string")
  .join("\n");
if (!text) iesiCurat();

const linii = text.split("\n");
const rel = cale.startsWith(RADACINA) ? cale.slice(RADACINA.length + 1) : cale;
const avertismente = [];

const migrari = () =>
  readdirSync(DIR_MIGRARI)
    .filter((f) => f.endsWith(".sql"))
    .sort();

// ── Regula 1 — `.upsert()` pe index unic PARȚIAL (capcana 7 → 42P10) ─────────
// `^[^/*]*` elimină liniile de comentariu: în repo, 4 din 6 apariții ale lui
// `.upsert(` sunt în comentarii care AVERTIZEAZĂ despre exact această capcană.
if (rel.startsWith("src/") && /^[^/*]*\.upsert\(/m.test(text)) {
  const partiale = new Map(),
    pline = new Map();
  const pune = (m, tabela, coloane, nume, predicat) => {
    if (!m.has(tabela)) m.set(tabela, []);
    m.get(tabela).push({ coloane, nume, predicat });
  };
  for (const f of migrari()) {
    const sql = readFileSync(join(DIR_MIGRARI, f), "utf8");
    for (const m of sql.matchAll(
      /create\s+unique\s+index\s+(?:if\s+not\s+exists\s+)?(\w+)\s+on\s+(?:public\.)?(\w+)\s*\(([^)]+)\)([^;]*);/gi,
    )) {
      const coloane = m[3]
        .split(",")
        .map((c) => c.trim().replace(/\s+(asc|desc)$/i, ""))
        .sort()
        .join(",");
      const tinta = /\bwhere\b/i.test(m[4]) ? partiale : pline;
      pune(tinta, m[2], coloane, m[1], m[4].trim());
    }
    for (const t of sql.matchAll(/create\s+table\s+(?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
      for (const c of t[2].matchAll(/^\s*(\w+)\s+[\w()[\]]+[^,\n]*\bprimary key\b/gim)) {
        pune(pline, t[1], c[1], `${t[1]}_pkey`, "");
      }
    }
  }
  linii.forEach((linie, i) => {
    if (!/^[^/*]*\.upsert\(/.test(linie)) return;
    let tabela = null;
    for (let k = i; k >= Math.max(0, i - 10) && tabela === null; k--) {
      const m = /\.from\(\s*["'](\w+)["']/.exec(linii[k]);
      if (m) tabela = m[1];
    }
    const mc = /onConflict\s*:\s*["']([^"']+)["']/.exec(linii.slice(i, i + 4).join(" "));
    if (tabela === null) {
      avertismente.push(
        `\`.upsert(\` la linia ${i + 1}: n-am putut identifica tabela. Verifică manual dacă indexul unic e PARȚIAL (\`where deleted_at is null\`) — PostgREST nu emite predicatul în ON CONFLICT ⇒ 42P10 (capcana 7).`,
      );
      return;
    }
    if (!mc) return; // fără onConflict, PostgREST cade pe cheia primară
    const cerute = mc[1]
      .split(",")
      .map((c) => c.trim())
      .sort()
      .join(",");
    const partial = (partiale.get(tabela) ?? []).find((ix) => ix.coloane === cerute);
    const plin = (pline.get(tabela) ?? []).find((ix) => ix.coloane === cerute);
    if (partial) {
      avertismente.push(
        `42P10 GARANTAT (capcana 7): \`.upsert\` pe \`${tabela}\` cu onConflict "${mc[1]}" țintește indexul PARȚIAL \`${partial.nume}\` (${partial.predicat}). Postgres respinge inferența la PLANIFICARE, deci pică la FIECARE apel, nu doar la conflict. Folosește citire-apoi-INSERT-sau-UPDATE (vezi src/app/(app)/pontaj/actions.ts).`,
      );
    } else if (!plin) {
      avertismente.push(
        `\`.upsert\` pe \`${tabela}\` cu onConflict "${mc[1]}": n-am găsit niciun index unic care să acopere exact aceste coloane în supabase/migrations/. Fără index potrivit, Postgres dă 42P10.`,
      );
    }
  });
}

// ── Regula 2 — client admin în afara listei albe ESLint ──────────────────────
// Cere cuvântul `from`, nu doar calea: altfel ar semnala comentariul din
// src/lib/email/send.ts care MENȚIONEAZĂ calea ca să explice de ce n-o importă.
const LISTA_ALBA = [
  /^src\/lib\/supabase\/admin\.ts$/,
  /^src\/.*\/actions\.ts$/,
  /^src\/app\/api\/.*\/route\.ts$/,
  /^src\/lib\/utils\/rate-limit\.ts$/,
  /^scripts\//,
  /^tests\//,
];
if (
  /from\s*["'](?:@\/|[^"']*)lib\/supabase\/admin["']/.test(text) &&
  !LISTA_ALBA.some((re) => re.test(rel))
) {
  avertismente.push(
    `\`${rel}\` importă clientul admin (service_role — OCOLEȘTE COMPLET RLS). ESLint \`no-restricted-imports\` îl permite doar în: src/lib/supabase/admin.ts, src/**/actions.ts, src/app/api/**/route.ts, src/lib/utils/rate-limit.ts, scripts/**, tests/**. \`pnpm lint\` va pica. Mută helperul într-un \`createAction\` din actions.ts (capcanele 10, 27, 34) și scrie în comentariu DE CE ocolești RLS.`,
  );
}

// ── Regula 3 — `.rpc()` pe o funcție din schema `app` (capcanele 1, 14) ──────
// Seturile `app.*` și `public.*` sunt disjuncte în acest repo, deci nu există
// coliziuni de nume. Lista se derivă la rulare, ca să nu ruginească.
if (/\.rpc\(\s*["']/.test(text)) {
  const inApp = new Set(),
    inPublic = new Set();
  for (const f of migrari()) {
    const sql = readFileSync(join(DIR_MIGRARI, f), "utf8");
    for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+app\.(\w+)/gi))
      inApp.add(m[1]);
    for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)/gi))
      inPublic.add(m[1]);
  }
  for (const m of text.matchAll(/\.rpc\(\s*["'](\w+)["']/g)) {
    if (inApp.has(m[1]) && !inPublic.has(m[1])) {
      avertismente.push(
        `\`.rpc("${m[1]}")\` — \`app.${m[1]}\` trăiește în schema \`app\`, iar supabase/config.toml expune la PostgREST doar ["public","graphql_public"]. Funcția NU e apelabilă și NU apare în Database["public"]["Functions"]: cod care nici nu compilează, nici nu rulează. Portează logica în TypeScript (capcanele 1 și 14).`,
      );
    }
  }
}

if (avertismente.length === 0) iesiCurat();
const mesaj = "ADMINISTRATIVO — capcane cunoscute:\n• " + avertismente.join("\n• ");
process.stdout.write(
  JSON.stringify({
    systemMessage: mesaj,
    hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: mesaj },
  }),
);
process.exit(0);
