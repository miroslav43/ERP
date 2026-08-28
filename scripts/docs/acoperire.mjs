#!/usr/bin/env node
// Raportul COD → VAULT: ce există în cod și n-are pagină.
//
// Triajul răspunde la „ce pagină s-a învechit". Întrebarea complementară — „ce
// s-a construit și nu e documentat deloc" — nu are cine s-o pună: o pagină care
// nu există nu poate fi marcată învechită. Fără raportul ăsta, un modul nou
// rămâne invizibil la nesfârșit, iar vault-ul pare complet fiindcă tot ce conține
// e proaspăt.
//
// Nu scrie nimic și nu pică niciodată: e un raport, nu o poartă. Golul de
// acoperire e o decizie de prioritizare pentru om, nu un defect de commit.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RADACINA = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const VAULT = join(RADACINA, ".claude/docs");
const ZILE = Number(process.env.ZILE_ACOPERIRE || 1);

const git = (...a) => {
  try {
    return execFileSync("git", a, { cwd: RADACINA, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  } catch {
    return "";
  }
};

const paginiVault = () => {
  const out = [];
  const mers = (d) => {
    if (!existsSync(d)) return;
    for (const n of readdirSync(d)) {
      if (n === ".cache" || n === ".obsidian") continue;
      const c = join(d, n);
      if (statSync(c).isDirectory()) mers(c);
      else if (n.endsWith(".md")) out.push(c);
    }
  };
  mers(VAULT);
  return out;
};

const textVault = paginiVault()
  .map((c) => readFileSync(c, "utf8"))
  .join("\n");

// Module de rută: directoare sub src/app/(app)/ care chiar au o pagină.
const dirApp = join(RADACINA, "src/app/(app)");
const module_ = existsSync(dirApp)
  ? readdirSync(dirApp).filter((n) => {
      const c = join(dirApp, n);
      return statSync(c).isDirectory() && existsSync(join(c, "page.tsx"));
    })
  : [];

const faraPagina = module_.filter((m) => !existsSync(join(VAULT, `modul/${m}.md`)));

// Migrări nemenționate nicăieri în vault.
const dirMig = join(RADACINA, "supabase/migrations");
const migrari = existsSync(dirMig) ? readdirSync(dirMig).filter((n) => n.endsWith(".sql")) : [];
const migrariNementionate = migrari.filter((m) => !textVault.includes(m));

// Ce s-a mișcat în fereastra dată, dar n-are pagină — partea acționabilă acum.
const deLa = `--since=${ZILE} days ago`;
const atinseRecent = new Set(
  git("log", deLa, "--name-only", "--format=")
    .split("\n")
    .filter((l) => l.startsWith("src/app/(app)/"))
    .map((l) => l.split("/")[2])
    .filter(Boolean),
);
const fierbintiFaraPagina = faraPagina.filter((m) => atinseRecent.has(m));

const raport = {
  module: { total: module_.length, cuPagina: module_.length - faraPagina.length, faraPagina },
  migrariNementionate: migrariNementionate.length,
  fierbintiFaraPagina,
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(raport));
} else {
  console.log(`### Acoperire cod → vault\n`);
  console.log(
    `Module de rută: **${raport.module.cuPagina}** din **${raport.module.total}** au pagină.\n`,
  );
  if (fierbintiFaraPagina.length) {
    console.log(
      `**Atinse în ultimele ${ZILE} zile și fără pagină — astea contează acum:**\n`,
    );
    for (const m of fierbintiFaraPagina) console.log(`- \`src/app/(app)/${m}/\``);
    console.log("");
  }
  if (faraPagina.length) {
    console.log(`Fără pagină, în total: ${faraPagina.map((m) => `\`${m}\``).join(", ")}\n`);
  }
  if (migrariNementionate.length)
    console.log(`Migrări nemenționate în nicio pagină: ${migrariNementionate.length}.`);
}
