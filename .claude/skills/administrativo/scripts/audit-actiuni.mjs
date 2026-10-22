#!/usr/bin/env node
// Igiena definițiilor `createAction` din TOATE fișierele de Server Actions din
// `src/`: `actions.ts`, dar și `actions-*.ts`, `*-actions.ts`, `actiuni-*.ts`
// sau orice alt fișier cu directiva `"use server"` la nivel de modul.
//
// Până pe 22 oct 2026 auditul citea DOAR fișierele numite exact `actions.ts`.
// Flota (F3–F11) și-a scris acțiunile în `actions-amenzi.ts`, `actions-service.ts`
// și încă opt fișiere separate, deci zeci de definiții stăteau în afara lui —
// iar revizuirea automată a semnalat „authorization” exact într-unul dintre ele.
//
// Reguli, niciuna verificabilă azi de `tsc`, ESLint sau vitest:
//
//   A1 AVERT   `revalidatePath(` chemat din handler în loc de `revalidate:` declarat
//   A2 AVERT   definiție fără `feature:` într-un modul care ARE feature flag
//   A3 EROARE  câmp sensibil în `audit.allow` (CNP/IBAN/salariu/motiv medical…)
//   A4 EROARE  `.update(` fără `.select(` în aceeași instrucțiune  → capcana 17
//   A5 EROARE  fișier "use server" care exportă o constantă         → build refuzat
//   A6 EROARE  `createAdminSupabase` importat (ca valoare) dintr-un fișier de
//              acțiuni care NU se numește `actions.ts` și nu e în lista de
//              excepții din `eslint.config.mjs` — oglinda regulii ESLint, care
//              altfel poate fi tăcută cu un `eslint-disable`
//   A7 EROARE  `.update(` / `.delete(` pe clientul ADMIN fără `organization_id`
//              în instrucțiune: service_role ocolește RLS, iar filtrul explicit
//              pe organizație e singura graniță (CLAUDE.md)
//
// Modulul unei acțiuni (pentru A2) se ia din `src/config/porti-ruta.ts`, după
// cel mai lung prefix de rută: `flota/` → `fleet`, `evaluari/kpi/` → `kpi`.
// Fără harta asta, regula se aplica doar directoarelor numite exact ca cheia
// (`ssm`, `reges`), iar flota, mentenanța sau pontajul nu erau verificate deloc.
//
// `--diff` restrânge la fișierele din `git diff --name-only HEAD`.
// `--radacina <dir>` auditează alt depozit (testele scriu un `src/` minimal).

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import { execSync } from "node:child_process";

const argRadacina = process.argv.indexOf("--radacina");
const RADACINA =
  argRadacina >= 0 && process.argv[argRadacina + 1] !== undefined
    ? process.argv[argRadacina + 1]
    : (process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
const DOAR_DIFF = process.argv.includes("--diff");
const CA_JSON = process.argv.includes("--json");
const STRICT = process.argv.includes("--strict");

if (!existsSync(join(RADACINA, "src/lib/actions/create-action.ts"))) {
  console.error("audit-actiuni: nu sunt în repo-ul Administrativo.");
  process.exit(3);
}

// `motiv` simplu NU e aici: în acest repo apare ca motiv de suspendare a unei
// organizații sau de emitere a unui document — date de business, nu art. 9.
// Modulul concedii (unde motivul medical AR fi sensibil) nu îl auditează deloc.
const CAMPURI_SENSIBILE =
  /^(cnp|iban|salariu|salariu_brut|salariu_net|suma_neta|motiv_medical|numar_certificat|serie_certificat|parola|password|token|hash|diagnostic)$/i;

const SARITE = new Set(["node_modules", ".next", ".git"]);

/** Prima linie de cod (nu comentariu, nu goală) a unui fișier. */
function primaLinieDeCod(sursa) {
  return sursa
    .split("\n")
    .find(
      (l) =>
        l.trim() &&
        !l.trim().startsWith("//") &&
        !l.trim().startsWith("*") &&
        !l.trim().startsWith("/*"),
    );
}

const areUseServer = (sursa) => {
  const prima = primaLinieDeCod(sursa);
  return prima !== undefined && /^["']use server["']/.test(prima.trim());
};

/**
 * Fișierele de acțiuni: `actions.ts` oriunde (chiar fără directivă: așa le
 * numea auditul de la început), plus orice `.ts`/`.tsx` care nu e test și are
 * `"use server"` la nivel de modul.
 */
function* fisiereActiuni(dir) {
  for (const intrare of readdirSync(dir)) {
    if (SARITE.has(intrare)) continue;
    const cale = join(dir, intrare);
    if (statSync(cale).isDirectory()) {
      yield* fisiereActiuni(cale);
      continue;
    }
    if (intrare === "actions.ts") {
      yield cale;
      continue;
    }
    if (
      !/\.tsx?$/.test(intrare) ||
      /\.(test|spec)\.tsx?$/.test(intrare) ||
      intrare.endsWith(".d.ts")
    )
      continue;
    if (areUseServer(readFileSync(cale, "utf8"))) yield cale;
  }
}

let fisiere = [...fisiereActiuni(join(RADACINA, "src"))].sort();
if (DOAR_DIFF) {
  let modificate = [];
  try {
    modificate = execSync("git diff --name-only HEAD", { cwd: RADACINA, encoding: "utf8" })
      .split("\n")
      .filter(Boolean)
      .map((f) => join(RADACINA, f));
  } catch {
    /* fără git: auditează tot */
  }
  if (modificate.length) fisiere = fisiere.filter((f) => modificate.includes(f));
}

const FEATURE_KEYS = (() => {
  const f = join(RADACINA, "src/config/features.ts");
  if (!existsSync(f)) return new Set();
  const ts = readFileSync(f, "utf8");
  const start = ts.indexOf("FEATURE_KEYS = [");
  if (start < 0) return new Set();
  return new Set(
    [...ts.slice(start, ts.indexOf("] as const", start)).matchAll(/"([a-z_]+)"/g)].map((m) => m[1]),
  );
})();

/** `[ruta, modul]` din `porti-ruta.ts` (`p("/flota/foi", "fleet", …)`), cele mai lungi întâi. */
const PORTI_RUTA = (() => {
  const f = join(RADACINA, "src/config/porti-ruta.ts");
  if (!existsSync(f)) return [];
  const perechi = [...readFileSync(f, "utf8").matchAll(/\bp\(\s*"(\/[^"]*)"\s*,\s*"([a-z_]+)"/g)]
    .map((m) => [m[1], m[2]])
    .filter(([, modul]) => FEATURE_KEYS.has(modul) && modul !== "nucleu");
  return perechi.sort((a, b) => b[0].length - a[0].length);
})();

/** Ruta unui fișier de sub `src/app`, fără grupurile `(x)`: `/flota`, `/evaluari/kpi`. */
function rutaFisierului(rel) {
  const parti = rel.split(/[\\/]/);
  if (parti[0] !== "src" || parti[1] !== "app") return null;
  const segmente = parti.slice(2, -1).filter((s) => !/^\(.*\)$/.test(s));
  return "/" + segmente.join("/");
}

/** Modulul (feature flag) căruia îi aparține un fișier de acțiuni, sau `null`. */
function modulFisierului(rel) {
  const ruta = rutaFisierului(rel);
  if (ruta !== null) {
    for (const [prefix, modul] of PORTI_RUTA) {
      if (ruta === prefix || ruta.startsWith(prefix + "/")) return modul;
    }
  }
  // Rezerva veche: directorul de modul se numește exact ca cheia (`ssm`, `reges`).
  const seg = rel.match(/src[\\/]app[\\/]\(app\)[\\/]([a-z-]+)[\\/]/);
  const candidat = seg?.[1]?.replace(/-/g, "_");
  return candidat && FEATURE_KEYS.has(candidat) && candidat !== "nucleu" ? candidat : null;
}

/**
 * Căile care au voie să importe `createAdminSupabase` pe lângă `actions.ts`,
 * citite din blocul `administrativo/securitate-exceptii` al `eslint.config.mjs`.
 * Doar căile EXACTE (fără `*`): globurile de acolo (`src/**\/actions.ts`,
 * `src/app/api/**\/route.ts`, `scripts/**`) nu sunt fișiere de acțiuni.
 */
const EXCEPTII_ADMIN = (() => {
  const f = join(RADACINA, "eslint.config.mjs");
  if (!existsSync(f)) return new Set();
  const cfg = readFileSync(f, "utf8");
  const start = cfg.indexOf('"administrativo/securitate-exceptii"');
  if (start < 0) return new Set();
  const bloc = cfg.slice(start, cfg.indexOf("]", cfg.indexOf("files:", start)));
  return new Set(
    [...bloc.matchAll(/^\s*"([^"*]+\.tsx?)"/gm)].map((m) => m[1]).filter((c) => !c.includes("*")),
  );
})();

const constatari = [];
const adauga = (nivel, regula, fisier, linie, mesaj) =>
  constatari.push({ nivel, regula, unde: `${relative(RADACINA, fisier)}:${linie}`, mesaj });

/** Extrage blocurile create*Action({ … }) prin potrivire de acolade. */
function blocuri(sursa) {
  const out = [];
  for (const m of sursa.matchAll(/create(?:Platform|Public)?Action\s*(?:<[^>]*>)?\s*\(\s*\{/g)) {
    let i = m.index + m[0].length - 1,
      adanc = 0;
    for (; i < sursa.length; i++) {
      if (sursa[i] === "{") adanc++;
      else if (sursa[i] === "}") {
        adanc--;
        if (adanc === 0) break;
      }
    }
    out.push({ start: m.index, text: sursa.slice(m.index, i + 1) });
  }
  return out;
}
const liniaLa = (sursa, idx) => sursa.slice(0, idx).split("\n").length;

/**
 * Instrucțiunea care începe pe rândul `i`: până la primul `;` final, cel mult 60
 * de rânduri. 30 era prea puțin: actualizarea firmei din `bun-venit` are 40 de
 * rânduri de coloane opționale, iar `.select()` venea pe rândul 38 (fals pozitiv).
 */
function instructiunea(linii, i) {
  let fereastra = "";
  for (let j = i; j < linii.length && j < i + 60; j++) {
    fereastra += linii[j] + "\n";
    if (/;\s*$/.test(linii[j])) break;
  }
  return fereastra;
}

/**
 * Începutul lanțului care conține rândul `i` (`await admin` / `admin.from(`),
 * căutat înapoi cel mult 6 rânduri: cine primește `.from(...).update(...)`.
 */
function inceputulLantului(linii, i) {
  let text = linii[i];
  for (let j = i; j > 0 && j > i - 6 && /^\s*\./.test(linii[j]); j--) {
    text = linii[j - 1] + "\n" + text;
  }
  return text;
}

for (const f of fisiere) {
  const sursa = readFileSync(f, "utf8");
  const rel = relative(RADACINA, f);
  const numitActions = basename(f) === "actions.ts";
  const useServer = areUseServer(sursa);

  // A5 — "use server" care exportă o constantă care nu e o acțiune.
  if (useServer) {
    for (const m of sursa.matchAll(/^export const (\w+)\s*(?::[^=]+)?=\s*(.*)$/gm)) {
      const dreapta = m[2].trim();
      if (
        !/^(create(Platform|Public)?Action|async|\(|function)/.test(dreapta) &&
        !/=>\s*$/.test(dreapta)
      ) {
        adauga(
          "EROARE",
          "A5",
          f,
          liniaLa(sursa, m.index),
          `\`export const ${m[1]}\` într-un fișier "use server": Next refuză build-ul („A 'use server' file can only export async functions”). \`tsc\` NU semnalează. Mută constanta într-un fișier alăturat (ex. constante.ts).`,
        );
      }
    }
  }

  // A6 — clientul admin într-un fișier de acțiuni care nu se numește `actions.ts`.
  const relPosix = rel.split(sep).join("/");
  if (!numitActions && !EXCEPTII_ADMIN.has(relPosix)) {
    for (const m of sursa.matchAll(
      /^import\s+(?!type\b)\{([^}]*)\}\s+from\s+["'][^"']*lib\/supabase\/admin["']/gm,
    )) {
      const valori = m[1]
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith("type "));
      if (valori.some((s) => /^createAdminSupabase\b/.test(s))) {
        adauga(
          "EROARE",
          "A6",
          f,
          liniaLa(sursa, m.index),
          "`createAdminSupabase` importat dintr-un fișier de acțiuni care nu se numește `actions.ts`. Regula ESLint îl permite DOAR în `actions.ts` (și în căile enumerate în `administrativo/securitate-exceptii`, fiecare cu motivul scris). Mută acțiunea care ocolește RLS în `actions.ts`, cu comentariul DE CE și cu filtru explicit pe `organization_id`, sau adaugă calea în lista de excepții, cu motivul.",
        );
      }
    }
  }

  // Identificatorii clientului admin din fișier (`const admin = createAdminSupabase()`).
  const numeAdmin = new Set(
    [...sursa.matchAll(/\bconst\s+(\w+)\s*=\s*(?:await\s+)?createAdminSupabase\(\)/g)].map(
      (m) => m[1],
    ),
  );
  const eAdmin = (text) =>
    /createAdminSupabase\(\)\s*\.from\(/.test(text) ||
    [...numeAdmin].some((n) => new RegExp(`(^|[^.\\w])${n}\\s*\\.from\\(`).test(text)) ||
    /(^|[^.\w])admin\s*\n?\s*\.from\(/.test(text);

  for (const b of blocuri(sursa)) {
    const linieBloc = liniaLa(sursa, b.start);

    // A1 — revalidatePath în handler
    if (/handler\s*:/.test(b.text) && /revalidatePath\s*\(/.test(b.text)) {
      adauga(
        "AVERT",
        "A1",
        f,
        linieBloc,
        "`revalidatePath()` chemat din handler. Se DECLARĂ `revalidate: [...]` în definiție — altfel acțiunea nu poate fi apelată dintr-un Server Component (revalidatePath în timpul randării aruncă; capcana 34).",
      );
    }

    // A2 — feature: absent, deși modulul are feature flag
    if (!/\bfeature\s*:/.test(b.text)) {
      const modul = modulFisierului(rel);
      if (modul !== null) {
        adauga(
          "AVERT",
          "A2",
          f,
          linieBloc,
          `definiție fără \`feature:\` într-un modul cu flag („${modul}”). Dacă e intenționat (acțiune de nucleu), spune-o într-un comentariu — altfel dezactivarea modulului nu blochează scrierea.`,
        );
      }
    }

    // A3 — câmp sensibil în audit.allow
    const allow = /allow\s*:\s*\[([^\]]*)\]/.exec(b.text);
    if (allow) {
      for (const c of allow[1].matchAll(/["']([^"']+)["']/g)) {
        const ultim = c[1].split(".").pop();
        if (CAMPURI_SENSIBILE.test(ultim)) {
          adauga(
            "EROARE",
            "A3",
            f,
            linieBloc,
            `\`audit.allow\` conține „${c[1]}”. Allow-list-ul ajunge în \`audit_logs\`; CNP/IBAN/salariu și motivul medical (art. 9 GDPR) nu au ce căuta acolo.`,
          );
        }
      }
    }
  }

  // A4 + A7 pe TOT fișierul, nu doar în `createAction({ … })`: o funcție
  // ajutătoare din același fișier (chemată din handler) scrie la fel de real.
  const linii = sursa.split("\n");
  linii.forEach((l, i) => {
    const esteUpdate = /^[^/*]*\.update\(/.test(l);
    const esteDelete = /^[^/*]*\.delete\(/.test(l);
    if (!esteUpdate && !esteDelete) return;
    // Fereastra e INSTRUCȚIUNEA, nu un număr fix de rânduri: un `.update({...})`
    // cu multe coloane se întinde pe 10+ rânduri, iar `.select()` vine după
    // `.eq()`-uri. O fereastră fixă produce fals pozitive.
    const fereastra = instructiunea(linii, i);
    // Clientul admin ocolește RLS, deci un refuz tăcut din politică e improbabil,
    // dar filtrul pe organizație devine OBLIGATORIU.
    const cap = inceputulLantului(linii, i);
    const clientAdmin = eAdmin(cap);
    // Pe `organizations` firma ESTE rândul: filtrul e `.eq("id", …)`.
    const peOrganizatii = /\.from\(\s*["']organizations["']\s*\)/.test(cap);
    const filtruFirma = peOrganizatii
      ? /\.eq\(\s*["']id["']/.test(fereastra)
      : /organization_id/.test(fereastra);

    // A7 — clientul admin fără filtru pe organizație. Consola de platformă
    // (`(platform)/`) e exceptată: acolo super_admin lucrează PESTE firme prin
    // construcție (poarta e `platform_admins`, nu tenantul), iar tabelele ei
    // (`demo_requests`) nu au organizație.
    if (clientAdmin && !filtruFirma && !/[\\/]\(platform\)[\\/]/.test(rel)) {
      adauga(
        "EROARE",
        "A7",
        f,
        i + 1,
        `\`.${esteUpdate ? "update" : "delete"}()\` pe clientul admin fără \`organization_id\` în instrucțiune. service_role ocolește RLS: fără \`.eq("organization_id", ctx.tenant.organizationId)\` un id venit din client atinge rândul ORICĂREI firme.`,
      );
    }

    // A4 — .update() fără .select() în aceeași instrucțiune
    if (!esteUpdate || /\.select\(/.test(fereastra)) return;
    // Tranziție de status = cazul exact al capcanei 17, cel mai scump.
    const tranzitie =
      /\b(status|stadiu|aprobat|approved_at|approved_by|respins|blocat|blocata_la|anulat|finalizata_la|confirmat)\b/.test(
        fereastra,
      );
    adauga(
      tranzitie && !clientAdmin ? "EROARE" : "AVERT",
      "A4",
      f,
      i + 1,
      `\`.update()\` fără \`.select()\` după el${tranzitie ? " pe o TRANZIȚIE de status" : ""}. Un UPDATE respins de clauza \`USING\` a politicii afectează ZERO rânduri, FĂRĂ eroare — utilizatorul vede „succes” și nu s-a schimbat nimic (capcana 17). Tratează rezultatul gol drept CONFLICT.`,
    );
  });
}

const erori = constatari.filter((c) => c.nivel === "EROARE");
const averturi = constatari.filter((c) => c.nivel === "AVERT");
const numiteActions = fisiere.filter((f) => basename(f) === "actions.ts").length;

if (CA_JSON) console.log(JSON.stringify({ fisiere: fisiere.length, constatari }, null, 2));
else {
  console.log(
    `audit-actiuni — ${fisiere.length} fișiere de acțiuni (${numiteActions} actions.ts, ${fisiere.length - numiteActions} alte fișiere "use server")\n`,
  );
  for (const c of [...erori, ...averturi])
    console.log(`${c.nivel.padEnd(6)} ${c.regula}  ${c.unde}\n         ${c.mesaj}`);
  console.log(`\nRezumat: ${erori.length} erori, ${averturi.length} avertismente.`);
}
if (erori.length > 0) process.exit(1);
if (STRICT && averturi.length > 0) process.exit(2);
process.exit(0);
