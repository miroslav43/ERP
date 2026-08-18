#!/usr/bin/env node
/**
 * Trece interfața de la paletele străine (zinc, slate, blue, rose, amber…) la
 * tokenii semantici ai platformei.
 *
 * De ce a fost nevoie: aplicația are O SINGURĂ temă — crem cu navy — dar codul
 * era plin de clase `dark:*`, care se activează din setarea sistemului de operare
 * al utilizatorului, nu din tema aplicației. Rezultatul, pe un macOS cu temă
 * întunecată: antet de tabel negru pe pagină crem, rând care la hover devenea
 * negru cu text negru, câmpuri ilizibile.
 *
 * Regulile vin din `docs/design/stari-de-interactiune.md`, unde sunt și
 * contrastele calculate. Principiul: două fundaluri opace — `bg-background` în
 * repaus, `bg-surface` pentru orice e atins sau recesat — iar restul stărilor se
 * fac din chenar și din cuvânt, nu din suprafață.
 *
 *   node scripts/codemod-tokeni.mjs --dry     doar raportează
 *   node scripts/codemod-tokeni.mjs           aplică
 */

import { readFileSync, writeFileSync } from "node:fs";
import { globSync } from "node:fs";
import path from "node:path";

const DRY = process.argv.includes("--dry");
const RADACINA = path.join(import.meta.dirname, "..");

/**
 * Perechile 1:1. Ordinea CONTEAZĂ: cele mai lungi întâi, altfel un tipar scurt
 * consumă o bucată dintr-unul lung și restul rămâne orfan.
 */
const PERECHI = [
  // ── fundal, neutre ────────────────────────────────────────────────────────
  ["hover:bg-zinc-50 dark:hover:bg-zinc-900", "hover:bg-surface"],
  ["hover:bg-zinc-50 dark:hover:bg-zinc-800", "hover:bg-surface"],
  ["hover:bg-zinc-100 dark:hover:bg-zinc-800", "hover:bg-surface"],
  ["bg-zinc-50/50 dark:bg-zinc-900/40", "bg-surface"],
  ["bg-zinc-50 dark:bg-zinc-900", "bg-surface"],
  ["bg-zinc-50 dark:bg-zinc-800", "bg-surface"],
  ["bg-zinc-50 dark:bg-zinc-950", "bg-surface"],
  ["bg-zinc-100 dark:bg-zinc-800", "bg-surface"],
  ["bg-zinc-100 dark:bg-zinc-700", "bg-surface"],
  ["bg-zinc-200 dark:bg-zinc-800", "bg-surface"],
  ["bg-zinc-200 dark:bg-zinc-700", "bg-surface"],
  ["bg-white dark:bg-zinc-900", "bg-background"],
  ["bg-white dark:bg-zinc-950", "bg-background"],
  ["bg-slate-100 dark:bg-slate-800", "bg-surface"],
  ["bg-zinc-900 dark:bg-zinc-100", "bg-primary"],

  // ── chenare și separatoare de STRUCTURĂ ───────────────────────────────────
  ["border-zinc-200 dark:border-zinc-700", "border-border"],
  ["border-zinc-200 dark:border-zinc-800", "border-border"],
  ["border-zinc-100 dark:border-zinc-800", "border-border"],
  ["border-zinc-50 dark:border-zinc-900", "border-border"],
  ["border-slate-200 dark:border-slate-700", "border-border"],
  ["divide-zinc-200 dark:divide-zinc-800", "divide-border"],
  ["divide-zinc-200 dark:divide-zinc-700", "divide-border"],
  ["divide-zinc-100 dark:divide-zinc-800", "divide-border"],
  ["divide-slate-200 dark:divide-slate-700", "divide-border"],

  // ── chenar de CONTROL ─────────────────────────────────────────────────────
  // `border-foreground/60` și nu un token solid: o modulație a cernelii compune
  // mereu peste crem, deci ține 4,23:1 și pe pagină, și pe panoul de filtre. Un
  // gri solid ar coborî la 3,40:1 exact acolo unde e nevoie de marjă.
  ["border-zinc-300 dark:border-zinc-700", "border-foreground/60"],
  ["border-zinc-300 dark:border-zinc-600", "border-foreground/60"],
  ["border-slate-300 dark:border-slate-600", "border-foreground/60"],

  // ── text, neutre ──────────────────────────────────────────────────────────
  ["hover:text-zinc-900 dark:hover:text-zinc-100", "hover:text-foreground"],
  ["hover:text-zinc-900 dark:hover:text-zinc-50", "hover:text-foreground"],
  ["text-zinc-600 dark:text-zinc-300", "text-muted-foreground"],
  ["text-zinc-600 dark:text-zinc-400", "text-muted-foreground"],
  ["text-zinc-500 dark:text-zinc-400", "text-muted-foreground"],
  ["text-zinc-400 dark:text-zinc-600", "text-muted-foreground"],
  ["text-zinc-300 dark:text-zinc-700", "text-muted-foreground"],
  ["text-slate-600 dark:text-slate-300", "text-muted-foreground"],
  ["text-zinc-700 dark:text-zinc-200", "text-foreground"],
  ["text-zinc-700 dark:text-zinc-300", "text-foreground"],
  ["text-zinc-800 dark:text-zinc-100", "text-foreground"],
  ["text-zinc-900 dark:text-zinc-100", "text-foreground"],
  ["text-slate-700 dark:text-slate-200", "text-foreground"],
  ["text-slate-800 dark:text-slate-100", "text-foreground"],
  ["text-slate-900 dark:text-slate-100", "text-foreground"],
  ["text-slate-900 dark:text-slate-50", "text-foreground"],

  // ── albastru = navy ───────────────────────────────────────────────────────
  ["hover:bg-blue-800", "hover:bg-primary-hover"],
  ["bg-blue-700", "bg-primary"],
  ["bg-sky-700", "bg-primary"],
  ["bg-slate-900", "bg-primary"],
  ["text-blue-700 dark:text-blue-300", "text-primary"],
  ["text-blue-800 dark:text-blue-300", "text-primary"],
  ["border-blue-700 dark:border-blue-400", "border-primary"],
  ["border-blue-200 dark:border-blue-800", "border-border"],
  ["bg-blue-50/40 dark:bg-blue-950/30", "bg-surface"],
  ["bg-blue-50 dark:bg-blue-950", "bg-surface"],
  ["bg-blue-100 dark:bg-blue-950", "bg-surface"],
  ["bg-blue-100 dark:bg-blue-900", "bg-surface"],
  ["text-blue-900 dark:text-blue-100", "text-foreground"],
  ["text-blue-900 dark:text-blue-50", "text-foreground"],

  // ── roșu = danger ─────────────────────────────────────────────────────────
  ["hover:bg-rose-50 dark:hover:bg-rose-950", "hover:bg-danger hover:text-danger-foreground"],
  ["hover:bg-rose-800", "hover:bg-danger"],
  ["hover:bg-red-800", "hover:bg-danger"],
  ["bg-rose-700", "bg-danger"],
  ["bg-red-700", "bg-danger"],
  ["text-red-700 dark:text-red-400", "text-danger"],
  ["text-red-800 dark:text-red-200", "text-danger"],
  ["text-red-900 dark:text-red-100", "text-danger"],
  ["text-rose-600 dark:text-rose-400", "text-danger"],
  ["text-rose-700 dark:text-rose-300", "text-danger"],
  ["text-rose-800 dark:text-rose-200", "text-danger"],
  ["text-rose-900 dark:text-rose-50", "text-danger"],
  ["text-rose-900 dark:text-rose-100", "text-danger"],
  ["border-rose-300 dark:border-rose-700", "border-danger"],
  ["border-rose-200 dark:border-rose-900", "border-danger/40"],
  ["border-red-300 dark:border-red-900", "border-danger/40"],
  ["bg-rose-50/60 dark:bg-rose-950/30", "bg-danger/8"],
  ["bg-rose-50 dark:bg-rose-950", "bg-danger/8"],
  ["bg-red-50 dark:bg-red-950", "bg-danger/8"],

  // ── galben = warning ──────────────────────────────────────────────────────
  // Cuvântul rămâne `text-foreground`: `text-warning` pe fundal deschis pică
  // pragul de 4,5:1. Culoarea o poartă chenarul și bulina.
  ["border-amber-300 dark:border-amber-900", "border-warning/40"],
  ["border-amber-300 dark:border-amber-700", "border-warning/40"],
  ["bg-amber-50 dark:bg-amber-950", "bg-warning/12"],
  ["bg-amber-100 dark:bg-amber-950", "bg-warning/12"],
  ["text-amber-900 dark:text-amber-100", "text-foreground"],
  ["text-amber-900 dark:text-amber-50", "text-foreground"],
  ["text-amber-700 dark:text-amber-400", "text-foreground"],
  ["text-orange-900 dark:text-orange-100", "text-foreground"],
  ["text-orange-900 dark:text-orange-50", "text-foreground"],

  // ── verde = success ───────────────────────────────────────────────────────
  ["border-emerald-300 dark:border-emerald-800", "border-success/40"],
  ["border-emerald-300 dark:border-emerald-700", "border-success/40"],
  ["bg-emerald-100 dark:bg-emerald-950", "bg-surface"],
  ["bg-emerald-50 dark:bg-emerald-950", "bg-surface"],
  ["hover:bg-emerald-800", "hover:bg-primary-hover"],
  ["bg-emerald-700", "bg-primary"],
  ["text-emerald-700 dark:text-emerald-400", "text-foreground"],
  ["text-emerald-800 dark:text-emerald-200", "text-foreground"],
  ["text-emerald-900 dark:text-emerald-100", "text-foreground"],
  ["text-emerald-900 dark:text-emerald-50", "text-foreground"],

  // ── focus: inelul e global, în globals.css ────────────────────────────────
  // Fiecare clasă de mai jos fie îl dublează, fie — mai rău — îl omoară.
  ["focus-visible:outline-offset-2", ""],
  ["focus-visible:outline-slate-900", ""],
  ["focus-visible:outline-sky-600", ""],
  ["focus-visible:outline-none", ""],
  ["focus-visible:outline-2", ""],
  ["focus-visible:ring-ring", ""],
  ["focus-visible:ring-2", ""],

  // ── disabled: opacitatea stinge și textul, nu doar fundalul ───────────────
  [
    "disabled:opacity-60",
    "disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground",
  ],
  [
    "disabled:opacity-50",
    "disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground",
  ],
];

/** Orice `dark:` rămas se șterge: nu există temă întunecată de care să asculte. */
const DARK_RAMAS = /\s*\bdark:[a-z0-9:[\]/._-]+/g;

/** `outline-none` singur omoară inelul global de focus. */
const OUTLINE_NONE = /\s*\boutline-none\b/g;

const fisiere = globSync("src/**/*.{ts,tsx}", { cwd: RADACINA })
  .map((f) => path.join(RADACINA, f))
  .filter((f) => !f.endsWith(".test.ts") && !f.endsWith(".test.tsx"));

let atinse = 0;
let inlocuiri = 0;
let darkSterse = 0;

for (const cale of fisiere) {
  const original = readFileSync(cale, "utf8");
  let text = original;

  for (const [vechi, nou] of PERECHI) {
    if (!text.includes(vechi)) continue;
    const bucati = text.split(vechi);
    inlocuiri += bucati.length - 1;
    text = bucati.join(nou);
  }

  const inainteDeDark = text;
  text = text.replace(DARK_RAMAS, "");
  darkSterse += (inainteDeDark.match(DARK_RAMAS) ?? []).length;

  text = text.replace(OUTLINE_NONE, "");

  // Curăță spațiile duble lăsate de ștergeri, DOAR în literale de clasă — nu în
  // tot fișierul, ca să nu strice indentarea sau textele în română.
  text = text.replace(/className=(["'`])([^"'`]*)\1/g, (potrivire, ghilimea, continut) => {
    const curatat = continut.replace(/\s+/g, " ").trim();
    return `className=${ghilimea}${curatat}${ghilimea}`;
  });

  if (text !== original) {
    atinse += 1;
    if (!DRY) writeFileSync(cale, text);
  }
}

console.log(`  fișiere atinse:      ${atinse} din ${fisiere.length}`);
console.log(`  înlocuiri 1:1:       ${inlocuiri}`);
console.log(`  clase dark: șterse:  ${darkSterse}`);
if (DRY) console.log("\n  (--dry: nu s-a scris nimic)");
