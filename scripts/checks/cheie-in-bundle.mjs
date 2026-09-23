#!/usr/bin/env node
// scripts/checks/cheie-in-bundle.mjs
//
// Poarta care ține cheia publicabilă Supabase AFARĂ din JavaScript-ul livrat
// browserului.
//
// ── DE CE EXISTĂ ───────────────────────────────────────────────────────────
// Auditul din 21 sept 2026 a pus o întrebare simplă — „atinge frontendul baza
// direct?" — și a găsit ușa deschisă: cheia publicabilă coaptă în bundle plus
// sesiunea lizibilă din `document.cookie` înseamnă un client PostgREST complet
// în browser. Cu el, orice regulă care trăiește doar în `createAction` (Zod,
// tranziții de status, `minScope`, poarta de modul, auditul) se ocolește dintr-o
// linie de consolă: baza vede doar un `authenticated` legitim.
//
// Ușa s-a închis în cod (clientul de browser a dispărut, cheia a trecut în
// `src/config/cheie-supabase.ts`, marcat `server-only`). Dar închiderea e o
// STARE, nu o garanție: e de-ajuns ca un singur fișier de client să importe
// ceva care referă `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY` și Next coace
// valoarea la loc în bundle, tăcut. Nici `tsc`, nici `eslint`, nici `vitest`
// n-au cum s-o vadă — se vede doar în fișierele de sub `.next/static`.
//
// ── CE VERIFICĂ ────────────────────────────────────────────────────────────
//   1. valoarea cheii, literal, în orice fișier servit browserului;
//   2. clasele SDK-ului Supabase ajunse acolo (`createBrowserClient`,
//      `GoTrueClient`, `PostgrestClient`) — semnul că cineva a reintrodus un
//      client de browser, pe oricare din cele două fabrici (`@supabase/ssr` sau
//      `@supabase/supabase-js`). Se caută numele CLASELOR, nu `createClient`:
//      identificatorul ăla e prea comun ca să nu producă fals-pozitive.
//
// Se uită DOAR în `.next/static` (și în `.next/dev/static`, pentru serverul de
// dezvoltare). Bundle-urile de server — `.next/server/**` — au voie să conțină
// cheia: acolo e chiar locul ei.
//
// Rulare: `node scripts/checks/cheie-in-bundle.mjs` după `pnpm build`.
// Ieșiri: 0 curat · 1 s-a găsit ceva · 2 nu s-a putut rula.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RADACINA = fileURLToPath(new URL("../..", import.meta.url));
const DIRECTOARE = [join(RADACINA, ".next", "static"), join(RADACINA, ".next", "dev", "static")];

/** Cheia din mediu, altfel din `.env.local` — scriptul rulează și local, și în CI. */
function cheiaDinMediu() {
  const dinProces = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (typeof dinProces === "string" && dinProces.trim() !== "") return dinProces.trim();

  try {
    const brut = readFileSync(join(RADACINA, ".env.local"), "utf8");
    for (const linie of brut.split("\n")) {
      const potrivire = /^\s*NEXT_PUBLIC_SUPABASE_ANON_KEY\s*=\s*(.*)$/u.exec(linie);
      if (potrivire === null) continue;
      return potrivire[1].trim().replace(/^["']|["']$/gu, "");
    }
  } catch {
    // fără `.env.local` — mergem mai departe cu mesajul de mai jos
  }
  return null;
}

function fisiere(director) {
  let intrari;
  try {
    intrari = readdirSync(director);
  } catch {
    return [];
  }
  return intrari.flatMap((intrare) => {
    const cale = join(director, intrare);
    return statSync(cale).isDirectory() ? fisiere(cale) : [cale];
  });
}

const cheie = cheiaDinMediu();
if (cheie === null) {
  console.error(
    "cheie-in-bundle: SĂRIT — NEXT_PUBLIC_SUPABASE_ANON_KEY nu e nici în mediu, nici în .env.local.",
  );
  process.exit(2);
}

const toate = DIRECTOARE.flatMap(fisiere).filter((c) => /\.(js|mjs|json|txt|map)$/u.test(c));
if (toate.length === 0) {
  console.error("cheie-in-bundle: SĂRIT — nu există `.next/static`. Rulează întâi `pnpm build`.");
  process.exit(2);
}

const MARTORI_SDK = ["createBrowserClient", "GoTrueClient", "PostgrestClient"];

const gasite = [];
for (const cale of toate) {
  const continut = readFileSync(cale, "utf8");
  if (continut.includes(cheie)) gasite.push([cale, "cheia publicabilă Supabase"]);
  for (const martor of MARTORI_SDK) {
    if (continut.includes(martor)) gasite.push([cale, `${martor} (SDK Supabase)`]);
  }
}

if (gasite.length > 0) {
  console.error(
    `cheie-in-bundle: ${gasite.length} potriviri în JavaScript-ul de browser.\n` +
      "Browserul redevine astfel un client PostgREST complet. Vezi src/config/cheie-supabase.ts.\n",
  );
  for (const [cale, ce] of gasite) {
    console.error(`  ${cale.slice(RADACINA.length + 1)} — ${ce}`);
  }
  process.exit(1);
}

console.log(`cheie-in-bundle: curat (${toate.length} fișiere servite browserului).`);
