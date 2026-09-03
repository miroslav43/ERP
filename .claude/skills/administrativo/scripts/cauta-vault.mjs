#!/usr/bin/env node
// Cine deține ce, în vault-ul `.claude/docs/`.
//
// Răspunde la întrebarea de dinaintea citirii: „ce pagină vorbește despre
// tabela asta / permisiunea asta / fișierul ăsta?". Fără ea, singura cale e
// `grep -r` peste tot vault-ul, adică exact citirea pe care plafonul de 12 KB
// per sarcină o interzice.
//
// NU există index pe disc. Frontmatter-ul se citește LA RULARE, ca la
// `capcana.mjs`: un index generat ar rugini exact în ziua în care cineva adaugă
// o pagină și uită să-l regenereze.
//
// Utilizare:
//   node cauta-vault.mjs --tabela leave_requests
//   node cauta-vault.mjs --permisiune per_diem:approve
//   node cauta-vault.mjs --cale src/lib/queries/leave.ts
//   node cauta-vault.mjs --capcana 17
//   node cauta-vault.mjs --tip rol
//   node cauta-vault.mjs deplasare            căutare liberă în titlu și alias
//   node cauta-vault.mjs --toate              inventarul complet

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

function radacina() {
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR;
  let d = process.cwd();
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(d, "supabase/migrations"))) return d;
    const p = dirname(d);
    if (p === d) break;
    d = p;
  }
  return process.cwd();
}

const RADACINA = radacina();
const VAULT = join(RADACINA, ".claude/docs");
if (!existsSync(VAULT)) {
  console.error(
    `cauta-vault: nu găsesc ${VAULT}. Rulează din repo-ul Administrativo sau setează CLAUDE_PROJECT_DIR.`,
  );
  process.exit(3);
}

// ── Frontmatter, minimal și deliberat ──────────────────────────────────────
// Se citesc doar formele pe care convenția le folosește: scalar, listă inline
// `[a, b]` (eventual pe mai multe rânduri) și listă pe rânduri cu `- `. Un
// parser YAML complet ar fi o dependență pentru un fișier pe care îl scriem noi.
function frontmatter(text) {
  if (!text.startsWith("---\n")) return null;
  const sfarsit = text.indexOf("\n---", 3);
  if (sfarsit === -1) return null;

  // Se strâng întâi perechile (cheie, bloc brut) — un bloc fiind restul liniei
  // plus toate liniile următoare care nu încep o cheie nouă. Abia apoi se
  // decide forma. Altfel lista inline scrisă pe mai multe rânduri, forma pe
  // care o folosesc paginile cu multe tabele, se pierde tăcut.
  const linii = text.slice(4, sfarsit + 1).split("\n");
  const blocuri = [];
  for (const linie of linii) {
    const m = /^([a-z_]+):\s*(.*)$/.exec(linie);
    if (m) blocuri.push([m[1], m[2]]);
    else if (blocuri.length > 0) blocuri[blocuri.length - 1][1] += "\n" + linie;
  }

  const camp = Object.create(null);
  for (const [cheie, brut] of blocuri) {
    const elemente = brut
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("- "))
      .map((l) => curata(l.slice(2)));
    if (elemente.length > 0) {
      camp[cheie] = elemente;
      continue;
    }
    const plat = brut.replace(/\n/g, " ").trim();
    if (plat.startsWith("[")) {
      camp[cheie] = plat
        .replace(/^\[|\]$/g, "")
        .split(",")
        .map((v) => curata(v))
        .filter(Boolean);
    } else {
      camp[cheie] = curata(plat);
    }
  }
  return camp;
}

const curata = (v) => v.trim().replace(/^["']|["']$/g, "");

function pagini() {
  const gasite = [];
  const mergi = (dir) => {
    for (const nume of readdirSync(dir)) {
      if (nume.startsWith(".")) continue;
      const cale = join(dir, nume);
      if (statSync(cale).isDirectory()) mergi(cale);
      else if (nume.endsWith(".md")) gasite.push(cale);
    }
  };
  mergi(VAULT);
  return gasite.sort().map((cale) => {
    const fm = frontmatter(readFileSync(cale, "utf8")) || {};
    return { slug: relative(VAULT, cale).replace(/\.md$/, ""), fm };
  });
}

// ── Argumente ──────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
if (argv.length === 0 || argv[0] === "--ajutor" || argv[0] === "-h") {
  console.log(
    [
      "cauta-vault — cine deține ce în `.claude/docs/`",
      "",
      "  --tabela <nume>        pagina care ține tabela",
      "  --permisiune <cheie>   pagini care numesc permisiunea",
      "  --cale <cale>          pagini a căror `cai:` acoperă fișierul",
      "  --capcana <n>          pagini care citează capcana",
      "  --tip <modul|date|rol|strat|decizie|meta>",
      "  --toate                inventarul complet",
      "  <text>                 căutare liberă în titlu și alias",
    ].join("\n"),
  );
  process.exit(0);
}

const steag = argv[0].startsWith("--") ? argv[0].slice(2) : null;
const valoare = (steag ? argv.slice(1) : argv).join(" ").trim().toLowerCase();

// Un steag necunoscut NU cade în căutarea liberă. Ar returna tot vault-ul cu
// aer de răspuns — exact ce a pățit prima rulare, sub `zsh`, care nu desparte
// în cuvinte un parametru necitat: `--capcana 17` a ajuns UN singur argument.
const STEAGURI = ["tabela", "permisiune", "cale", "capcana", "tip", "toate"];
if (steag !== null && !STEAGURI.includes(steag)) {
  console.error(`cauta-vault: steag necunoscut „--${steag}”. Cele valide: ${STEAGURI.join(", ")}.`);
  console.error("Dacă ai vrut căutare liberă, scrie textul fără „--”.");
  process.exit(2);
}
if (steag !== null && steag !== "toate" && valoare === "") {
  console.error(`cauta-vault: „--${steag}” cere o valoare.`);
  process.exit(2);
}

const toate = pagini();

// `cai:` conține globuri (`src/app/(app)/concedii/**`). Potrivirea se face pe
// prefixul dinaintea primului metacaracter — suficient și previzibil; un
// matcher complet de glob ar fi o dependență pentru zece pagini.
const acopera = (tipar, cale) => {
  const prefix = tipar.split(/[*?[]/)[0].replace(/\/$/, "");
  return prefix !== "" && cale.startsWith(prefix);
};

const potrivit = (p) => {
  const are = (camp, v) => (p.fm[camp] || []).some((x) => String(x).toLowerCase() === v);
  switch (steag) {
    case "toate":
      return true;
    case "tabela":
      return are("tabele", valoare);
    case "permisiune":
      return are("permisiuni", valoare);
    case "capcana":
      return (p.fm.capcane || []).some((x) => String(x).trim() === valoare);
    case "tip":
      return String(p.fm.tip || "").toLowerCase() === valoare;
    case "cale":
      return (p.fm.cai || []).some((t) => acopera(t, valoare));
    default: {
      const camp = [p.slug, p.fm.titlu || "", ...(p.fm.aliases || [])].join(" ").toLowerCase();
      return camp.includes(valoare);
    }
  }
};

const rezultate = toate.filter(potrivit);
const antet = steag ? `--${steag}${valoare ? " " + valoare : ""}` : valoare;
console.log(`vault — ${toate.length} pagini · filtru: ${antet} · ${rezultate.length} rezultate\n`);

if (rezultate.length === 0) {
  console.log("Nicio pagină. Dacă subiectul e real, lipsa paginii E defectul de raportat —");
  console.log("nu se compensează citind codul până se lămurește.");
  process.exit(1);
}

for (const p of rezultate) {
  const t = p.fm.tip ? `[${p.fm.tip}]` : "";
  console.log(`── ${p.slug} ${t}`);
  if (p.fm.titlu) console.log(`   ${p.fm.titlu}`);
  const tabele = p.fm.tabele || [];
  if (tabele.length > 0) console.log(`   tabele: ${tabele.join(", ")}`);
  const capcane = p.fm.capcane || [];
  if (capcane.length > 0) console.log(`   capcane: ${capcane.join(", ")}`);
  console.log(`   ↳ .claude/docs/${p.slug}.md`);
  console.log("");
}
