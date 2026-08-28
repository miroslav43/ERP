#!/usr/bin/env node
// Poarta vault-ului `.claude/docs/`.
//
// Verifică EXISTENȚĂ, niciodată CANTITATE. Motivul e scris în
// `src/config/docs.test.ts`: prima versiune a testului de documentație compara
// numărul de migrări citat în CLAUDE.md cu discul, și era greșit proiectată —
// pica pentru munca CORECTĂ (orice migrare nouă o înroșea) și taxa pe cel care
// adăuga migrarea, pentru o linie scrisă de altcineva.
//
// Deci: o cale care nu se rezolvă e o eroare. „Modulul are 15 acțiuni" nu se
// verifică — se INTERZICE, fiindcă e o afirmație care putrezește garantat.
//
// Nu rescrie niciodată nimic. Ieșire 1 dacă există erori, 0 altfel.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// ── Rădăcina ───────────────────────────────────────────────────────────────
const RADACINA = (() => {
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR;
  let d = process.cwd();
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(d, "supabase/migrations"))) return d;
    d = join(d, "..");
  }
  return process.cwd();
})();

// Domeniul e DECLARAT, nu dedus. O parcurgere „orice .md cu frontmatter" ar
// înghiți cele 22 de fișiere din `.claude/` al căror frontmatter aparține
// încărcătorului de plugin-uri, și prima rulare pe un vault gol ar da 22 de
// erori false. Prima experiență cu poarta ar fi „poarta e stricată".
const VAULT = join(RADACINA, ".claude/docs");

const PLAFOANE = {
  modul: { tinta: 8192, dur: 12288 },
  date: { tinta: 8192, dur: 12288 },
  strat: { tinta: 8192, dur: 12288 },
  rol: { tinta: 4096, dur: 6144 },
  decizie: { tinta: 2048, dur: 3072 },
  meta: { tinta: 6144, dur: 12288 },
};
const CAMPURI_OBLIGATORII = ["tip", "titlu", "cai", "tabele", "permisiuni", "capcane", "scris_pe"];

// Prefixe din afara repo-ului: nu sunt afirmații despre proiect.
const IN_AFARA = /^(~\/|https?:|mailto:|\/(home|run|srv|tmp|var|etc|usr|opt|proc|dev|c)\/)/;
const EXTENSII = /\.(ts|tsx|sql|md|mjs|cjs|js|jsx|sh|json|ya?ml|css|toml|py|txt)$/;
const RADACINI_REPO = /^(src|docs|supabase|tests|scripts|ops|deploy|public|\.claude|\.github)\//;

// ── Utilitare ──────────────────────────────────────────────────────────────
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

// Parser de frontmatter: subsetul pe care îl folosim (scalari, liste inline,
// liste pe rânduri). Nu importăm un YAML întreg pentru zece câmpuri.
const frontmatter = (text) => {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!m) return { fm: null, corp: text, decalaj: 0 };
  const fm = {};
  let cheieCurenta = null;
  for (const linie of m[1].split("\n")) {
    const listaItem = /^\s+-\s+(.*)$/.exec(linie);
    if (listaItem && cheieCurenta) {
      fm[cheieCurenta].push(listaItem[1].trim().replace(/^["']|["']$/g, ""));
      continue;
    }
    const pereche = /^([a-z_]+):\s*(.*)$/.exec(linie);
    if (!pereche) continue;
    const [, cheie, brut] = pereche;
    const val = brut.trim();
    if (val === "") {
      fm[cheie] = [];
      cheieCurenta = cheie;
    } else if (val.startsWith("[")) {
      fm[cheie] = val
        .slice(1, val.lastIndexOf("]"))
        .split(",")
        .map((x) => x.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      cheieCurenta = null;
    } else {
      fm[cheie] = val.replace(/^["']|["']$/g, "");
      cheieCurenta = null;
    }
  }
  return { fm, corp: text.slice(m[0].length), decalaj: m[0].split("\n").length - 1 };
};

// Împarte corpul în segmente: proză (cu spans inline) și blocuri îngrădite.
const segmente = (corp, decalaj = 0) => {
  const proza = [];
  const blocuri = [];
  let inBloc = false;
  let limbaj = "";
  corp.split("\n").forEach((linie, i) => {
    const fence = /^\s*```(\w*)/.exec(linie);
    if (fence) {
      if (!inBloc) {
        inBloc = true;
        limbaj = fence[1] || "";
      } else {
        inBloc = false;
        limbaj = "";
      }
      return;
    }
    (inBloc ? blocuri : proza).push({ linie, nr: i + 1 + decalaj, limbaj });
  });
  return { proza, blocuri };
};

// ── Surse de adevăr ────────────────────────────────────────────────────────
const citeste = (cale) => readFileSync(join(RADACINA, cale), "utf8");

const NR_CAPCANE = (() => {
  try {
    return [...citeste("docs/design/ecrane/capcane.md").matchAll(/^(\d+)\. /gm)].length;
  } catch {
    return 0;
  }
})();

const MIGRARI = (() => {
  const d = join(RADACINA, "supabase/migrations");
  return existsSync(d) ? new Set(readdirSync(d)) : new Set();
})();

// Rutele reale: page.tsx + route.ts sub src/app, cu grupurile (…) eliminate.
const RUTE = (() => {
  const out = [];
  const parcurge = (dir) => {
    if (!existsSync(dir)) return;
    for (const nume of readdirSync(dir)) {
      const cale = join(dir, nume);
      if (statSync(cale).isDirectory()) parcurge(cale);
      else if (nume === "page.tsx" || nume === "route.ts") {
        const rel = relative(join(RADACINA, "src/app"), dir);
        const ruta =
          "/" +
          rel
            .split("/")
            .filter((s) => s && !/^\(.*\)$/.test(s))
            .join("/");
        out.push(ruta === "/" ? "/" : ruta);
      }
    }
  };
  parcurge(join(RADACINA, "src/app"));
  return out;
})();

const rutaExista = (ruta) =>
  RUTE.some((r) => {
    const a = r.split("/").filter(Boolean);
    const b = ruta.split("/").filter(Boolean);
    if (a.length !== b.length) return false;
    return a.every((seg, i) => /^\[.*\]$/.test(seg) || /^\[.*\]$/.test(b[i]) || seg === b[i]);
  });

// ── Clasa P — repo public ──────────────────────────────────────────────────
const TIPARE_P = [
  { re: /\bnybmhorngsajoqaxjlbr\b/, ce: "project_ref Supabase" },
  { re: /\bproject_ref\s*[=:]\s*\S/, ce: "project_ref cu valoare" },
  { re: /\beyJ[A-Za-z0-9_-]{20,}/, ce: "cheie JWT (anon/service)" },
  { re: /\bparol[ăa]\s*[:=]\s*[`"']?\S{4,}/i, ce: "parolă cu valoare" },
  { re: /\b12345678\b/, ce: "parola conturilor demo" },
  { re: /\bSUPABASE_(SERVICE_ROLE|DB)_\w*\s*[=:]\s*\S/, ce: "secret cu valoare" },
  {
    re: /lipse[șs]te\s+politica|nu\s+exist[ăa]\s+politic[ăa]|f[ăa]r[ăa]\s+politic[ăa]\s+RLS/i,
    ce: "gol de autorizare descris",
  },
  {
    re: /nimeni\s+nu\s+verific[ăa]|poate\s+fi\s+ocolit[ăa]?\s+prin/i,
    ce: "gol de autorizare descris",
  },
];

// ── Verificarea unei pagini ────────────────────────────────────────────────
const verifica = (cale) => {
  const rel = relative(RADACINA, cale);
  const erori = [];
  const averts = [];
  const verificari = Object.create(null);
  const num = (clasa) => {
    verificari[clasa] = (verificari[clasa] || 0) + 1;
  };
  const vazute = new Set();
  const E = (clasa, nr, mesaj) => {
    const cheie = `${clasa}|${nr}|${mesaj}`;
    if (vazute.has(cheie)) return;
    vazute.add(cheie);
    erori.push({ clasa, nr, mesaj });
  };
  const A = (clasa, nr, mesaj) => averts.push({ clasa, nr, mesaj });

  const brut = readFileSync(cale);
  if (brut.includes(0)) {
    E("S", 1, "octet NUL literal — scrie-l ca secvență de evadare (capcana #11)");
    return { rel, erori, averts, verificari };
  }
  const text = brut.toString("utf8");
  const { fm, corp, decalaj } = frontmatter(text);

  // ── Frontmatter ──
  if (!fm) {
    E("FM", 1, "lipsește frontmatter-ul");
    return { rel, erori, averts, verificari };
  }
  for (const c of CAMPURI_OBLIGATORII) {
    if (fm[c] === undefined) E("FM", 1, `frontmatter fără câmpul obligatoriu \`${c}\``);
  }
  if (fm.scris_pe && fm.scris_pe !== "MANUAL" && !/^[0-9a-f]{40}$/.test(fm.scris_pe))
    E(
      "FM",
      1,
      `\`scris_pe\` trebuie să fie SHA complet (40 de caractere) sau MANUAL, nu „${fm.scris_pe}”`,
    );
  if (Array.isArray(fm.citeste_daca) && fm.citeste_daca.length > 3)
    E("FM", 1, `\`citeste_daca\` are ${fm.citeste_daca.length} intrări, maximum e 3`);
  if (fm.stare !== undefined) E("FM", 1, "`stare:` nu se scrie — se derivă din git");
  if (fm.migrari !== undefined) E("FM", 1, "`migrari:` nu se scrie — se derivă din `tabele:`");
  if (Array.isArray(fm.cai) && fm.cai.length === 0 && fm.tip !== "meta")
    E("FM", 1, "`cai:` gol — pagina devine nemuritoare (nu se învechește niciodată)");

  // Scutiri declarate: `neverificat: ["token — motiv de cel puțin 20 de caractere"]`
  //
  // Motivul obligatoriu de 20+ caractere e ce le ține oneste: o scutire fără
  // justificare nu se aplică, iar toate sunt vizibile în frontmatter, la
  // revizuire. Fără mecanismul ăsta, o pagină care DESCRIE regulile (`_index`,
  // `meta/conventii`) pică pe propriile exemple negative — și un lint cu
  // fals-pozitive e dezactivat în trei zile.
  const scutiri = [];
  for (const s of fm.neverificat || []) {
    const [tok, motiv] = s.split(/\s+[—-]\s+/);
    if (motiv && motiv.trim().length >= 20) scutiri.push(tok.trim());
  }
  const scutit = (text) => scutiri.some((sc) => text.includes(sc));

  // ── R — plafoane ──
  const plafon = PLAFOANE[fm.tip] || PLAFOANE.meta;
  const octetiCorp = Buffer.byteLength(corp, "utf8");
  if (octetiCorp > plafon.dur)
    E(
      "R",
      1,
      `corpul are ${octetiCorp} de octeți, plafonul dur pentru \`${fm.tip}\` e ${plafon.dur} — sparge pagina`,
    );
  else if (octetiCorp > plafon.tinta)
    A("R", 1, `corpul are ${octetiCorp} de octeți, ținta pentru \`${fm.tip}\` e ${plafon.tinta}`);

  const { proza, blocuri } = segmente(corp, decalaj);

  // ── N — diacritice cu sedilă ──
  for (const { linie, nr } of [...proza, ...blocuri]) {
    num("N");
    const m = /[şţŞŢ]/.exec(linie);
    if (m)
      E("N", nr, `diacritic cu sedilă „${m[0]}” — folosește virgula dedesubt (ș/ț, U+0219/U+021B)`);
  }

  // ── P — repo public ──
  for (const { linie, nr, limbaj } of [...proza, ...blocuri]) {
    num("P");
    if (scutit(linie)) continue;
    for (const { re, ce } of TIPARE_P) if (re.test(linie)) E("P", nr, `repo public: ${ce}`);
    if (/^\s*(using|with check)\s*\(/i.test(linie) && /sql/i.test(limbaj || ""))
      E("P", nr, "repo public: corp de politică RLS — descrie forma, nu predicatul");
  }

  const semnaleaza = (tok, nr, clasa, mesaj) => {
    if (scutit(tok)) return;
    E(clasa, nr, mesaj);
  };

  // ── A, B, J din spans inline (proză) ──
  for (const { linie, nr } of proza) {
    for (const m of linie.matchAll(/`([^`\n]+)`/g)) {
      const tok = m[1].trim();
      if (tok.includes("<") || tok.includes("*") || IN_AFARA.test(tok)) continue;

      // B — migrare
      if (/^\d{4}[a-z]?_[a-z0-9_]+\.sql$/.test(tok)) {
        num("B");
        if (!MIGRARI.has(tok))
          semnaleaza(tok, nr, "B", `migrarea \`${tok}\` nu e în \`supabase/migrations/\``);
        continue;
      }
      // A — cale de repo
      if (RADACINI_REPO.test(tok) && EXTENSII.test(tok)) {
        num("A");
        if (!existsSync(join(RADACINA, tok)))
          semnaleaza(tok, nr, "A", `calea \`${tok}\` nu există pe disc`);
        continue;
      }
      if (RADACINI_REPO.test(tok) && !tok.includes(" ") && !EXTENSII.test(tok)) {
        num("A");
        if (!existsSync(join(RADACINA, tok.replace(/\/$/, ""))))
          semnaleaza(tok, nr, "A", `directorul \`${tok}\` nu există pe disc`);
        continue;
      }
      // J — rută
      if (/^\/[a-z][a-z0-9-]*(\/[A-Za-z0-9_[\]-]+)*\/?$/.test(tok)) {
        num("J");
        const ruta = tok.replace(/\/$/, "");
        if (!rutaExista(ruta))
          semnaleaza(
            tok,
            nr,
            "J",
            `ruta \`${ruta}\` nu se rezolvă la niciun \`page.tsx\`/\`route.ts\``,
          );
        continue;
      }
    }
  }

  // ── A, B din blocuri îngrădite (acolo pune un model majoritatea căilor) ──
  for (const { linie, nr } of blocuri) {
    for (const m of linie.matchAll(
      /(?:^|[\s"'`(=])((?:src|docs|supabase|tests|scripts|ops|\.claude|\.github)\/[A-Za-z0-9_./()[\]-]*[A-Za-z0-9_)\]])/g,
    )) {
      const tok = m[1];
      if (tok.includes("<") || tok.includes("*") || !EXTENSII.test(tok)) continue;
      num("A");
      if (!existsSync(join(RADACINA, tok)))
        semnaleaza(tok, nr, "A", `calea \`${tok}\` (în bloc de cod) nu există pe disc`);
    }
  }

  // ── G — capcane ──
  for (const { linie, nr } of [...proza, ...blocuri]) {
    for (const m of linie.matchAll(/capcana\s+#(\d+)/gi)) {
      num("G");
      const n = Number(m[1]);
      if (NR_CAPCANE === 0)
        A("G", nr, "n-am putut citi `capcane.md` — verificarea capcanelor e sărită");
      else if (n < 1 || n > NR_CAPCANE)
        E("G", nr, `capcana #${n} nu există (documentul are ${NR_CAPCANE} intrări)`);
    }
    if (/\[\[\s*capcana/i.test(linie) && !scutit(linie))
      E("H", nr, "capcanele nu se scriu ca wikilink — folosește `capcana #N` plus `capcane: [N]`");
  }
  for (const n of fm.capcane || []) {
    num("G");
    const v = Number(n);
    if (NR_CAPCANE && (!Number.isInteger(v) || v < 1 || v > NR_CAPCANE))
      E("G", 1, `frontmatter \`capcane:\` conține ${n}, care nu e o capcană existentă`);
  }

  // ── H — wikilink-uri ──
  const propria = relative(VAULT, cale).replace(/\.md$/, "");
  for (const { linie, nr } of [...proza, ...blocuri]) {
    for (const m of linie.matchAll(/\[\[([^\]]+)\]\]/g)) {
      const tinta = m[1].split("|")[0].trim();
      if (/^capcana/i.test(tinta) || scutit(linie)) continue;
      num("H");
      if (!tinta.includes("/")) {
        E(
          "H",
          nr,
          `wikilink scurt \`[[${tinta}]]\` — scrie calea completă (există perechi cu același basename)`,
        );
        continue;
      }
      if (tinta === propria) {
        E("H", nr, `wikilink către propria pagină \`[[${tinta}]]\``);
        continue;
      }
      if (!existsSync(join(VAULT, `${tinta}.md`)))
        E("H", nr, `wikilink mort \`[[${tinta}]]\` — nu există \`.claude/docs/${tinta}.md\``);
    }
  }

  return { rel, erori, averts, verificari };
};

// ── Rulare ─────────────────────────────────────────────────────────────────
const argumente = process.argv.slice(2);
const caJson = argumente.includes("--json");
const idxExplica = argumente.indexOf("--explica");
const doarUnul = idxExplica >= 0 ? argumente[idxExplica + 1] : null;

let pagini = fisiereMd(VAULT);
if (doarUnul)
  pagini = pagini.filter((p) => relative(RADACINA, p) === doarUnul || p.endsWith(doarUnul));

if (!existsSync(VAULT)) {
  console.log("Vault-ul `.claude/docs/` nu există încă. Nimic de verificat.");
  process.exit(0);
}

const rezultate = pagini.map(verifica);
const totalErori = rezultate.reduce((s, r) => s + r.erori.length, 0);
const totalAverts = rezultate.reduce((s, r) => s + r.averts.length, 0);
const totalVerificari = rezultate.reduce(
  (s, r) => s + Object.values(r.verificari).reduce((a, b) => a + b, 0),
  0,
);

if (caJson) {
  console.log(
    JSON.stringify({ pagini: rezultate, totalErori, totalAverts, totalVerificari }, null, 2),
  );
  process.exit(totalErori > 0 ? 1 : 0);
}

for (const r of rezultate) {
  if (!r.erori.length && !r.averts.length && !doarUnul) continue;
  console.log(`\n${r.rel}`);
  for (const e of r.erori) console.log(`  ✗ [${e.clasa}] linia ${e.nr}: ${e.mesaj}`);
  for (const a of r.averts) console.log(`  ⚠ [${a.clasa}] linia ${a.nr}: ${a.mesaj}`);
  if (doarUnul) {
    const perClasa = Object.entries(r.verificari)
      .map(([c, n]) => `${c}=${n}`)
      .join(" ");
    console.log(`  afirmații verificate efectiv: ${perClasa || "niciuna"}`);
  }
}

// „0 erori" nu are voie să însemne „0 verificări".
console.log(
  `\n${pagini.length} pagini · ${totalVerificari} afirmații verificate · ` +
    `${totalErori} erori · ${totalAverts} avertismente`,
);
if (totalVerificari === 0 && pagini.length > 0)
  console.log(
    "⚠ zero afirmații verificate — scrie artefactele în backticks, altfel poarta e decorativă",
  );

process.exit(totalErori > 0 ? 1 : 0);
