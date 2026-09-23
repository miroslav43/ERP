#!/usr/bin/env node
// scripts/checks/migrari-imutabile.mjs
//
// Poarta pentru migrările editate după ce au ajuns pe main.
//
// ── DE CE EXISTĂ ───────────────────────────────────────────────────────────
// Pe 10 sept 2026, `0136_registru_conectare_totala.sql` a fost aplicată pe
// staging (21:39), a picat pe producție pe o dată tastată greșit și a fost
// reparată ÎN LOC (21:46, `b327297`). Poarta de sume din `db:migrate` a făcut
// exact ce trebuia: a refuzat. Numai că refuzul s-a întâmplat pe staging, la
// fiecare push, în tăcere — 12 zile fără niciun deploy acolo, descoperite abia
// de un audit SEO pe 23 sept. Nimic din CI nu se uita la migrări editate.
//
// ── CE CERE ────────────────────────────────────────────────────────────────
// Orice migrare EXISTENTĂ în baza comparației și MODIFICATĂ în HEAD trebuie să
// aibă o linie în `supabase/reconcilieri-migrari.tsv` cu (nume, suma veche,
// suma nouă) exacte. Linia e și calea pe care `db:migrate` o folosește ca să
// accepte schimbarea pe mediile unde varianta veche e deja aplicată — deci
// poarta nu cere o ceremonie în plus, cere exact fișierul care face deploy-ul
// să treacă.
//
// Redenumirile și ștergerile nu sunt păzite aici: redenumirea unei migrări
// NEaplicate e reparația documentată pentru o coliziune de numerotare.
//
// Utilizare: node scripts/checks/migrari-imutabile.mjs [baza]
//   baza implicită: origin/main. În CI: SHA-ul dinaintea push-ului sau baza PR-ului.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const baza = process.argv[2] || "origin/main";

if (/^0+$/.test(baza)) {
  console.log("✓ Ramură nouă, fără bază de comparat.");
  process.exit(0);
}

const git = (...a) => execFileSync("git", a, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const suma = (continut) => createHash("sha256").update(continut).digest("hex").slice(0, 16);

const modificate = git(
  "diff",
  "--name-only",
  "--diff-filter=M",
  baza,
  "HEAD",
  "--",
  "supabase/migrations/",
)
  .split("\n")
  .filter((f) => f.endsWith(".sql"));

const declarate = new Set(
  readFileSync("supabase/reconcilieri-migrari.tsv", "utf8")
    .split("\n")
    .filter((l) => l.trim() !== "" && !l.startsWith("#"))
    .map((l) => l.split("\t").slice(0, 3).join("\t")),
);

const nedeclarate = [];
for (const f of modificate) {
  const nume = f.split("/").pop();
  const veche = suma(execFileSync("git", ["show", `${baza}:${f}`]));
  const noua = suma(execFileSync("git", ["show", `HEAD:${f}`]));
  if (!declarate.has(`${nume}\t${veche}\t${noua}`)) nedeclarate.push({ nume, veche, noua });
}

if (nedeclarate.length > 0) {
  console.error("✗ Migrări existente editate fără reconciliere declarată:");
  for (const { nume, veche, noua } of nedeclarate) console.error(`    ${nume}  ${veche} → ${noua}`);
  console.error(
    "\n  Forward-only: schimbarea merge într-o migrare NOUĂ." +
      "\n  Excepția — migrarea a picat pe un mediu (tranzacție derulată înapoi) și e deja aplicată" +
      "\n  pe altul — se declară în supabase/reconcilieri-migrari.tsv (TAB):" +
      "\n    <nume>\t<suma veche>\t<suma nouă>\t<motiv>" +
      "\n  Fără linia aia, db:migrate refuză pe mediul unde varianta veche e aplicată, în tăcere.",
  );
  process.exit(1);
}
console.log(`✓ ${modificate.length} migrări existente editate, toate declarate (bază: ${baza}).`);
