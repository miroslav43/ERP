#!/usr/bin/env node
// Triajul vault-ului: CE pagini merită rescrise, calculat FĂRĂ LLM.
//
// Rulează înaintea oricărei invocări de Opus. Dacă lista iese goală, workflow-ul
// se oprește aici și nu cheltuie nimic — plata ca să afli că n-ai ce face e exact
// tiparul pe care îl evităm.
//
// Prospețimea e o INTERSECȚIE de mulțimi de SHA-uri, nu o uniune. Varianta naivă
// `git log A..HEAD -- caile-paginii sursele-structurale` tratează pathspec-urile
// ca uniune, iar în repo-ul ăsta jumătate din commit-uri ating sursele
// structurale — tot vault-ul ar fi marcat „putred" în 48 de ore și eticheta ar
// deveni zgomot.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RADACINA = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const VAULT = join(RADACINA, ".claude/docs");

// Sursele care schimbă STRUCTURA, nu doar conținutul: schema, tipurile generate,
// uniunea de permisiuni, lista de module.
const STRUCTURALE = [
  "supabase/migrations",
  "src/types/database.ts",
  "src/config/permissions.ts",
  "src/config/features.ts",
];

const PRAGURI = {
  invechita: { commits: 8, structural: 2 },
  putreda: { commits: 20, structural: 5, zile: 45 },
};

const git = (...args) => {
  try {
    return execFileSync("git", args, {
      cwd: RADACINA,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch {
    return "";
  }
};

const fisiereMd = (dir) => {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const nume of readdirSync(dir)) {
    if (nume === ".cache" || nume === ".obsidian") continue;
    const cale = join(dir, nume);
    if (statSync(cale).isDirectory()) out.push(...fisiereMd(cale));
    else if (nume.endsWith(".md")) out.push(cale);
  }
  return out;
};

const frontmatter = (text) => {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!m) return null;
  const fm = {};
  let cheie = null;
  for (const linie of m[1].split("\n")) {
    const item = /^\s+-\s+(.*)$/.exec(linie);
    if (item && cheie) {
      fm[cheie].push(item[1].trim().replace(/^["']|["']$/g, ""));
      continue;
    }
    const p = /^([a-z_]+):\s*(.*)$/.exec(linie);
    if (!p) continue;
    const val = p[2].trim();
    if (val === "") {
      fm[p[1]] = [];
      cheie = p[1];
    } else if (val.startsWith("[")) {
      fm[p[1]] = val
        .slice(1, val.lastIndexOf("]"))
        .split(",")
        .map((x) => x.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      cheie = null;
    } else {
      fm[p[1]] = val.replace(/^["']|["']$/g, "");
      cheie = null;
    }
  }
  return fm;
};

const sha = git("rev-parse", "HEAD").trim();

// Santinelă: într-o clonă superficială `git log <sha>..HEAD` întoarce gol pentru
// orice, iar triajul ar raporta senin „totul e proaspăt". Mai bine cade zgomotos.
const adancime = git("rev-list", "--count", "HEAD").trim();
const superficial = existsSync(join(RADACINA, ".git/shallow"));

const pagini = [];
for (const cale of fisiereMd(VAULT)) {
  const rel = relative(RADACINA, cale);
  const fm = frontmatter(readFileSync(cale, "utf8"));
  if (!fm) continue;
  if (!fm.scris_pe || fm.scris_pe === "MANUAL") continue; // scrisă de om, nu intră în coadă
  const cai = (fm.cai || []).filter(Boolean);
  if (!cai.length) continue;

  const A = new Set(
    git("log", "--format=%H", `${fm.scris_pe}..HEAD`, "--", ...cai)
      .split("\n")
      .filter(Boolean),
  );
  const B = new Set(
    git("log", "--format=%H", `${fm.scris_pe}..HEAD`, "--", ...STRUCTURALE)
      .split("\n")
      .filter(Boolean),
  );
  const commits = A.size;
  const structural = [...A].filter((x) => B.has(x)).length;

  const dataScris = git("log", "-1", "--format=%ct", fm.scris_pe).trim();
  const zile = dataScris ? Math.floor((Date.now() / 1000 - Number(dataScris)) / 86400) : 0;

  let stare = "proaspata";
  if (
    commits >= PRAGURI.putreda.commits ||
    structural >= PRAGURI.putreda.structural ||
    zile >= PRAGURI.putreda.zile
  )
    stare = "putreda";
  else if (commits >= PRAGURI.invechita.commits || structural >= PRAGURI.invechita.structural)
    stare = "invechita";
  else if (commits > 0) stare = "atinsa";

  pagini.push({ pagina: rel, stare, commits, structural, zile, scris_pe: fm.scris_pe, cai });
}

const deLucru = pagini
  .filter((p) => p.stare !== "proaspata")
  .sort((a, b) => b.structural - a.structural || b.commits - a.commits);

const arePutrede = deLucru.some((p) => p.stare === "putreda");
const PLAFON = Number(process.env.PLAFON_PAGINI || (arePutrede ? 10 : 6));
const alese = deLucru.slice(0, PLAFON);

if (process.argv.includes("--json")) {
  console.log(
    JSON.stringify({ sha, superficial, alese, total: pagini.length, deLucru: deLucru.length }),
  );
} else {
  if (superficial)
    console.log("⚠ clonă superficială — prospețimea nu e de încredere (`fetch-depth: 0`)");
  console.log(
    `HEAD ${sha.slice(0, 7)} · ${adancime} commit-uri în istoric · ${pagini.length} pagini urmărite\n`,
  );
  for (const p of pagini.sort((a, b) => b.structural - a.structural || b.commits - a.commits)) {
    const semn = { proaspata: " ", atinsa: "·", invechita: "⚠", putreda: "✗" }[p.stare];
    console.log(
      `  ${semn} ${p.pagina.padEnd(34)} commits=${String(p.commits).padStart(3)} structural=${String(p.structural).padStart(2)} zile=${String(p.zile).padStart(3)}  ${p.stare}`,
    );
  }
  console.log(
    `\nÎn coadă: ${deLucru.length}; de rescris în rularea asta: ${alese.length} (plafon ${PLAFON}).`,
  );
  if (deLucru.length > alese.length)
    console.log(
      `Amânate: ${deLucru.length - alese.length} — intervalul e per pagină, deci se recuperează la rularea următoare.`,
    );
}
