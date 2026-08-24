#!/usr/bin/env node
// Driftul vocabularului de permisiuni, în 6 direcții.
//
// `src/config/permissions.test.ts` acoperă deja R1 și R2; le repetăm ca
// scriptul să fie folosibil în afara vitest (hook, agent, comandă slash).
// R3–R6 sunt noi.
//
//   R1  nav ⊆ cod                  EROARE
//   R2  cod ⊆ seed                 EROARE
//   R3  can()/scopeFor() ⊆ seed    EROARE  — `PermissionKey` din
//       `src/lib/auth/permissions.ts` e `string`, deci TypeScript NU prinde o
//       cheie inventată; `has_permission` întoarce 'none' și butonul dispare tăcut.
//   R4  politici RLS ⊆ seed        EROARE  — politică moartă, nimeni nu trece.
//   R5  politici ⊄ PERMISSION_KEYS AVERT   — baza păzește o cheie pe care
//       interfața nu o poate exprima.
//   R6  cod nefolosit              INFO
//
// DELIBERAT ABSENT: „seed ⊄ cod”. Seed-ul e un produs cartezian resurse ×
// acțiuni, deci direcția aceea întoarce zeci de perechi fără sens
// (`audit:create`, `branding:approve`). Un checker zgomotos se stinge.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const RADACINA = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const DIR_MIGRARI = join(RADACINA, "supabase/migrations");
// Seed-ul de permisiuni NU stă într-un singur fișier. `0002_authz.sql` e doar
// primul: modulele apărute mai târziu își aduc propriile perechi
// rol×resursă×acțiune în migrarea lor (ticketing, de pildă, în
// `0046_ticketing_it_reguli.sql`). Citind doar `0002`, verificatorul raporta
// șase erori „permisiune folosită în cod dar neseedată" pentru chei care
// EXISTAU — un checker zgomotos se stinge, cum spune chiar antetul de mai sus,
// iar aici se stingea pe cele mai noi module, adică exact pe cele care au
// nevoie de el.
const F_SEED = join(DIR_MIGRARI, "0002_authz.sql");
/** Toate migrările, în ordine — seed-ul se citește din toate. */
const FISIERE_SEED = () =>
  readdirSync(DIR_MIGRARI)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => join(DIR_MIGRARI, f));
const F_PERMISIUNI = join(RADACINA, "src/config/permissions.ts");
const F_NAVIGATIE = join(RADACINA, "src/config/navigation.ts");
const DIR_SRC = join(RADACINA, "src");

const STRICT = process.argv.includes("--strict");
const CA_JSON = process.argv.includes("--json");

if (!existsSync(F_SEED)) {
  console.error(
    "verifica-permisiuni: nu sunt în repo-ul Administrativo (lipsește 0002_authz.sql).",
  );
  process.exit(3);
}

const constatari = [];
const adauga = (nivel, regula, unde, mesaj) => constatari.push({ nivel, regula, unde, mesaj });
const literale = (bloc) => [...bloc.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

function cheiDinSeed() {
  const sql = FISIERE_SEED()
    .map((f) => readFileSync(f, "utf8"))
    .join("\n;\n");
  const chei = new Set();
  // Forma 1: from unnest(array[resurse]) r cross join unnest(array[acțiuni]) a
  for (const m of sql.matchAll(
    /unnest\s*\(\s*array\[([^\]]+)\]\s*\)[^;]*?cross\s+join\s+unnest\s*\(\s*array\[([^\]]+)\]\s*\)/gis,
  )) {
    for (const r of literale(m[1])) for (const a of literale(m[2])) chei.add(`${r}:${a}`);
  }
  // Forma 2: ('rol','resursă','scope','{acțiune,acțiune}')
  for (const m of sql.matchAll(
    /\(\s*'[a-z_]+'\s*,\s*'([a-z_]+)'\s*,\s*'[a-z]+'\s*,\s*'\{([a-z_,\s]+)\}'\s*\)/g,
  )) {
    for (const a of m[2].split(",").map((s) => s.trim())) if (a) chei.add(`${m[1]}:${a}`);
  }
  // Forma 3: (null, 'rol', 'resursă', 'acțiune', 'scope')
  for (const m of sql.matchAll(
    /\(\s*null\s*,\s*'[a-z_]+'\s*,\s*'([a-z_]+)'\s*,\s*'([a-z_]+)'\s*,\s*'[a-z]+'\s*\)/g,
  )) {
    chei.add(`${m[1]}:${m[2]}`);
  }
  return chei;
}

function cheiDinCod() {
  const ts = readFileSync(F_PERMISIUNI, "utf8");
  const start = ts.indexOf("PERMISSION_KEYS = [");
  if (start < 0) return new Set();
  const bloc = ts.slice(start, ts.indexOf("] as const", start));
  return new Set([...bloc.matchAll(/"([a-z_]+:[a-z_]+)"/g)].map((m) => m[1]));
}

function cheiDinNavigatie() {
  const gasite = new Map();
  readFileSync(F_NAVIGATIE, "utf8")
    .split("\n")
    .forEach((linie, i) => {
      const m = /permission:\s*"([a-z_]+:[a-z_]+)"/.exec(linie);
      if (m && !gasite.has(m[1])) gasite.set(m[1], `src/config/navigation.ts:${i + 1}`);
    });
  return gasite;
}

function cheiDinPolitici() {
  const gasite = new Map();
  for (const f of readdirSync(DIR_MIGRARI)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    readFileSync(join(DIR_MIGRARI, f), "utf8")
      .split("\n")
      .forEach((linie, i) => {
        for (const m of linie.matchAll(
          /app\.(?:can|has_permission|ssm_acces)\s*\(\s*[^,]+,\s*'([a-z_]+)'\s*,\s*'([a-z_]+)'/g,
        )) {
          const cheie = `${m[1]}:${m[2]}`;
          if (!gasite.has(cheie)) gasite.set(cheie, `supabase/migrations/${f}:${i + 1}`);
        }
      });
  }
  return gasite;
}

function* fisiereTs(dir) {
  for (const intrare of readdirSync(dir)) {
    if (intrare === "node_modules" || intrare === ".next") continue;
    const cale = join(dir, intrare);
    if (statSync(cale).isDirectory()) yield* fisiereTs(cale);
    else if (/\.tsx?$/.test(intrare) && !/\.test\.tsx?$/.test(intrare)) yield cale;
  }
}

function cheiDinCan() {
  const gasite = new Map();
  for (const cale of fisiereTs(DIR_SRC)) {
    readFileSync(cale, "utf8")
      .split("\n")
      .forEach((linie, i) => {
        for (const m of linie.matchAll(
          /\b(?:can|scopeFor)\s*\(\s*[A-Za-z_$][\w.$]*\s*,\s*"([a-z_]+:[a-z_]+)"/g,
        )) {
          if (!gasite.has(m[1])) gasite.set(m[1], `${relative(RADACINA, cale)}:${i + 1}`);
        }
      });
  }
  return gasite;
}

let seed, cod, nav, politici, canuri;
try {
  seed = cheiDinSeed();
  cod = cheiDinCod();
  nav = cheiDinNavigatie();
  politici = cheiDinPolitici();
  canuri = cheiDinCan();
} catch (e) {
  console.error(`verifica-permisiuni: nu am putut citi sursele — ${e.message}`);
  process.exit(3);
}

// Auto-verificare: dacă parsarea eșuează tăcut, TOATE regulile ar trece
// fals-pozitiv. Pragurile sunt mult sub valorile reale.
if (seed.size < 60 || cod.size < 40 || politici.size < 20) {
  console.error(
    `verifica-permisiuni: parsare suspectă (seed=${seed.size}, cod=${cod.size}, politici=${politici.size}). ` +
      `Formatul seed-ului sau al politicilor s-a schimbat — actualizează expresiile regulate ÎNAINTE de a te încrede în rezultat.`,
  );
  process.exit(3);
}

for (const [k, unde] of nav)
  if (!cod.has(k)) adauga("EROARE", "R1", unde, `meniul cere "${k}", absentă din PERMISSION_KEYS`);
for (const k of cod)
  if (!seed.has(k))
    adauga(
      "EROARE",
      "R2",
      "src/config/permissions.ts",
      `"${k}" nu are rând în seed ⇒ has_permission întoarce 'none' (refuz tăcut)`,
    );
for (const [k, unde] of canuri)
  if (!seed.has(k))
    adauga(
      "EROARE",
      "R3",
      unde,
      `can("${k}") — cheia nu există în seed; can() acceptă string, deci compilează și întoarce MEREU false`,
    );
for (const [k, unde] of politici)
  if (!seed.has(k))
    adauga(
      "EROARE",
      "R4",
      unde,
      `politica cere "${k}", pereche absentă din seed ⇒ politică moartă`,
    );
for (const [k, unde] of politici)
  if (seed.has(k) && !cod.has(k))
    adauga(
      "AVERT",
      "R5",
      unde,
      `baza păzește "${k}" dar cheia lipsește din PERMISSION_KEYS ⇒ interfața nu o poate exprima`,
    );
for (const k of cod)
  if (!politici.has(k) && !nav.has(k) && !canuri.has(k))
    adauga(
      "INFO",
      "R6",
      "src/config/permissions.ts",
      `"${k}" nu e folosită de nicio politică, intrare de meniu sau can()`,
    );

const erori = constatari.filter((c) => c.nivel === "EROARE");
const averturi = constatari.filter((c) => c.nivel === "AVERT");
const infos = constatari.filter((c) => c.nivel === "INFO");

if (CA_JSON) {
  console.log(
    JSON.stringify(
      {
        surse: {
          seed: seed.size,
          cod: cod.size,
          politici: politici.size,
          can: canuri.size,
          nav: nav.size,
        },
        constatari,
      },
      null,
      2,
    ),
  );
} else {
  console.log("verifica-permisiuni — vocabularul de permisiuni\n");
  console.log(`  seed 0002_authz.sql ........... ${String(seed.size).padStart(4)} perechi`);
  console.log(`  PERMISSION_KEYS ............... ${String(cod.size).padStart(4)} chei`);
  console.log(`  politici RLS (toate migrările)   ${String(politici.size).padStart(3)} perechi`);
  console.log(`  can()/scopeFor() în src ....... ${String(canuri.size).padStart(4)} chei`);
  console.log(`  navigation.ts ................. ${String(nav.size).padStart(4)} chei\n`);
  for (const c of [...erori, ...averturi, ...infos])
    console.log(`${c.nivel.padEnd(6)} ${c.regula}  ${c.unde}\n         ${c.mesaj}`);
  console.log(
    `\nRezumat: ${erori.length} erori, ${averturi.length} avertismente, ${infos.length} informative.`,
  );
}

if (erori.length > 0) process.exit(1);
if (STRICT && averturi.length > 0) process.exit(2);
process.exit(0);
