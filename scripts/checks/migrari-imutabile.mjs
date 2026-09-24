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
// Ștergerile nu sunt păzite aici. Redenumirea CU conținut neschimbat trece:
// redenumirea unei migrări NEaplicate e reparația documentată pentru o coliziune
// de numerotare. Redenumirea CU conținut editat e o editare și se cere declarată
// ca atare — git o raportează ca `R`, nu ca `M`, și tocmai pe acolo trecea.
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

// `--name-status -z`: pentru M o singură cale, pentru R calea veche ȘI cea nouă.
// `--diff-filter=M` sărea exact redenumirile CU conținut editat.
const brut = git("diff", "--name-status", "-M", "-z", baza, "HEAD", "--", "supabase/migrations/")
  .split("\0")
  .filter((c) => c !== "");

const modificate = [];
for (let i = 0; i < brut.length; i++) {
  const stare = brut[i];
  if (stare.startsWith("R") || stare.startsWith("C")) {
    const veche = brut[++i];
    const noua = brut[++i];
    if (stare.startsWith("R") && noua?.endsWith(".sql")) modificate.push({ veche, noua });
  } else {
    const cale = brut[++i];
    if (stare === "M" && cale?.endsWith(".sql")) modificate.push({ veche: cale, noua: cale });
  }
}

const declarate = new Set(
  readFileSync("supabase/reconcilieri-migrari.tsv", "utf8")
    .split("\n")
    .filter((l) => l.trim() !== "" && !l.startsWith("#"))
    .map((l) => l.split("\t").slice(0, 3).join("\t")),
);

const nedeclarate = [];
let editate = 0;
for (const f of modificate) {
  const nume = f.noua.split("/").pop();
  const numeVechi = f.veche.split("/").pop();
  const veche = suma(execFileSync("git", ["show", `${baza}:${f.veche}`]));
  const noua = suma(execFileSync("git", ["show", `HEAD:${f.noua}`]));
  // Conținut identic (redenumire curată, schimbare de mod) — nu e o editare.
  if (veche === noua) continue;
  editate++;
  if (!declarate.has(`${nume}\t${veche}\t${noua}`))
    nedeclarate.push({ nume, numeVechi, veche, noua });
}

if (nedeclarate.length > 0) {
  console.error("✗ Migrări existente editate fără reconciliere declarată:");
  for (const { nume, numeVechi, veche, noua } of nedeclarate)
    console.error(
      `    ${numeVechi === nume ? nume : `${numeVechi} → ${nume}`}  ${veche} → ${noua}`,
    );
  console.error(
    "\n  Forward-only: schimbarea merge într-o migrare NOUĂ." +
      "\n  Excepția — migrarea a picat pe un mediu (tranzacție derulată înapoi) și e deja aplicată" +
      "\n  pe altul — se declară în supabase/reconcilieri-migrari.tsv (TAB):" +
      "\n    <nume>\t<suma veche>\t<suma nouă>\t<motiv>" +
      "\n  La o redenumire, <nume> e numele NOU (registrul bazei e indexat după numele de pe disc)." +
      "\n  Fără linia aia, db:migrate refuză pe mediul unde varianta veche e aplicată, în tăcere.",
  );
  process.exit(1);
}
console.log(`✓ ${editate} migrări existente editate, toate declarate (bază: ${baza}).`);
