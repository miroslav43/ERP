#!/usr/bin/env node
// Igiena celor ~118 definiții `createAction` din `src/**/actions.ts`.
// Cinci reguli, niciuna verificabilă azi de `tsc`, ESLint sau vitest.
//
//   A1 EROARE  `revalidatePath(` chemat din handler în loc de `revalidate:` declarat
//   A2 AVERT   definiție fără `feature:` într-un modul care ARE feature flag
//   A3 EROARE  câmp sensibil în `audit.allow` (CNP/IBAN/salariu/motiv medical…)
//   A4 EROARE  `.update(` fără `.select(` în următoarele 6 rânduri  → capcana 17
//   A5 EROARE  fișier "use server" care exportă o constantă         → build refuzat
//
// `--diff` restrânge la fișierele din `git diff --name-only HEAD`.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { execSync } from "node:child_process";

const RADACINA = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
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

function* fisiereActiuni(dir) {
  for (const intrare of readdirSync(dir)) {
    if (intrare === "node_modules" || intrare === ".next") continue;
    const cale = join(dir, intrare);
    if (statSync(cale).isDirectory()) yield* fisiereActiuni(cale);
    else if (intrare === "actions.ts") yield cale;
  }
}

let fisiere = [...fisiereActiuni(join(RADACINA, "src"))];
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

for (const f of fisiere) {
  const sursa = readFileSync(f, "utf8");
  const rel = relative(RADACINA, f);

  // A5 — "use server" care exportă o constantă care nu e o acțiune.
  const primaExec = sursa
    .split("\n")
    .find(
      (l) =>
        l.trim() &&
        !l.trim().startsWith("//") &&
        !l.trim().startsWith("*") &&
        !l.trim().startsWith("/*"),
    );
  if (primaExec && /^["']use server["']/.test(primaExec.trim())) {
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
      const seg = rel.match(/src\/app\/\(app\)\/([a-z-]+)\//);
      const candidat = seg?.[1]?.replace(/-/g, "_");
      if (candidat && FEATURE_KEYS.has(candidat)) {
        adauga(
          "AVERT",
          "A2",
          f,
          linieBloc,
          `definiție fără \`feature:\` într-un modul cu flag („${candidat}”). Dacă e intenționat (acțiune de nucleu), spune-o într-un comentariu — altfel dezactivarea modulului nu blochează scrierea.`,
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

    // A4 — .update() fără .select() în apropiere
    const liniiBloc = b.text.split("\n");
    liniiBloc.forEach((l, i) => {
      if (!/^[^/*]*\.update\(/.test(l)) return;
      // Fereastra e INSTRUCȚIUNEA, nu un număr fix de rânduri: un `.update({...})`
      // cu multe coloane se întinde pe 10+ rânduri, iar `.select()` vine după
      // `.eq()`-uri. O fereastră fixă produce fals pozitive.
      let fereastra = "",
        j = i;
      for (; j < liniiBloc.length && j < i + 30; j++) {
        fereastra += liniiBloc[j] + "\n";
        if (/;\s*$/.test(liniiBloc[j])) break;
      }
      if (/\.select\(/.test(fereastra)) return;
      // Tranziție de status = cazul exact al capcanei 17, cel mai scump.
      const tranzitie =
        /\b(status|aprobat|approved_at|approved_by|respins|blocat|blocata_la|anulat|finalizata_la|confirmat)\b/.test(
          fereastra,
        );
      // Clientul admin ocolește RLS, deci un refuz tăcut din politică e improbabil.
      const clientAdmin = /\b(admin|createAdminSupabase\(\))\s*$|\badmin\b\s*\n?\s*\.from\(/.test(
        liniiBloc.slice(Math.max(0, i - 3), i + 1).join("\n"),
      );
      adauga(
        tranzitie && !clientAdmin ? "EROARE" : "AVERT",
        "A4",
        f,
        linieBloc + i,
        `\`.update()\` fără \`.select()\` după el${tranzitie ? " pe o TRANZIȚIE de status" : ""}. Un UPDATE respins de clauza \`USING\` a politicii afectează ZERO rânduri, FĂRĂ eroare — utilizatorul vede „succes” și nu s-a schimbat nimic (capcana 17). Tratează rezultatul gol drept CONFLICT.`,
      );
    });
  }
}

const erori = constatari.filter((c) => c.nivel === "EROARE");
const averturi = constatari.filter((c) => c.nivel === "AVERT");

if (CA_JSON) console.log(JSON.stringify({ fisiere: fisiere.length, constatari }, null, 2));
else {
  console.log(`audit-actiuni — ${fisiere.length} fișiere actions.ts\n`);
  for (const c of [...erori, ...averturi])
    console.log(`${c.nivel.padEnd(6)} ${c.regula}  ${c.unde}\n         ${c.mesaj}`);
  console.log(`\nRezumat: ${erori.length} erori, ${averturi.length} avertismente.`);
}
if (erori.length > 0) process.exit(1);
if (STRICT && averturi.length > 0) process.exit(2);
process.exit(0);
