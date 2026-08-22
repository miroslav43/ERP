#!/usr/bin/env node
// Căutare în cele 36 de capcane ale schemei Administrativo.
//
// NU există un index JSON separat. Scriptul parsează
// `docs/design/ecrane/capcane.md` LA RULARE, deci nu poate rugini: dacă
// documentul crește de la 36 la 40 de capcane, căutarea le vede imediat.
// (Documentul a avut un octet NUL literal care îl făcea binar pentru `grep` —
// de asta citim cu 'utf8' și nu ne bazăm pe unelte de text.)
//
// Utilizare:
//   node capcana.mjs 42501                 după cod de eroare
//   node capcana.mjs --tabela attendance_entries
//   node capcana.mjs --modul flota
//   node capcana.mjs --rol manager
//   node capcana.mjs --tacute              capcanele FĂRĂ cod de eroare
//   node capcana.mjs --nr 7                textul integral al unei capcane

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

// Urcă până la directorul care conține supabase/migrations/ — ca să nu depindem
// de poziția relativă a plugin-ului față de rădăcina repo-ului.
function radacina() {
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR;
  let d = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(d, "supabase/migrations"))) return d;
    const p = dirname(d);
    if (p === d) break;
    d = p;
  }
  return process.cwd();
}

const RADACINA = radacina();
const DOC = join(RADACINA, "docs/design/ecrane/capcane.md");
if (!existsSync(DOC)) {
  console.error(`capcana: nu găsesc ${DOC}. Rulează din repo-ul Administrativo sau setează CLAUDE_PROJECT_DIR.`);
  process.exit(3);
}

const CODURI = ["42501", "42P10", "23505", "42703", "428C9", "22P02", "P0001", "PGRST116", "PGRST202", "PGRST205"];
const SENS = {
  "42501": "RLS a respins o SCRIERE (WITH CHECK sau USING). La SELECT, RLS nu aruncă — filtrează.",
  "42P10": "ON CONFLICT nu găsește constrângere — indexul unic e PARȚIAL.",
  "23505": "Violare de unicitate — de regulă reordonare fără slot de parcare.",
  "42703": "Coloană inexistentă — de regulă `deleted_at` pe o tabelă care n-o are.",
  "428C9": "Coloană GENERATED ALWAYS trimisă din client.",
  "22P02": "Format nepermis — șir gol dintr-un filtru URL ajuns la uuid/date/enum.",
  "P0001": "`raise exception` dintr-un trigger sau o funcție — regulă de business.",
  "PGRST116": "`.single()` pe un rând ascuns de politica SELECT. Mapat la NEGĂSIT, nu INTERZIS.",
  "PGRST202": "Funcția RPC nu e vizibilă prin PostgREST — probabil e în schema `app`.",
  "PGRST205": "Tabela nu e în cache-ul PostgREST.",
};
const SUFIXE_TABELA = /_(entries|periods|requests|items|types|rules|logs|records|data|documents|trainings|instances|templates|batches|codes|sheets|expenses|trips|plans|reports|meters|authorizations|extinguishers|issuances|accidents|permits|parameters|features|balances|components|exemptions|settings|holidays|policies|rates|members|admins|permissions|limits)$/;
const TABELE_SIMPLE = new Set(["employees","organizations","expirables","vehicles","equipment","departments","notifications","features"]);
const MARCI_TACUTE = [
  /f[ăa]r[ăa] (nicio )?eroare/i, /t[ăa]cut/i, /zero r[âa]nduri/i, /silen[țt]/i,
  /list[ăa] goal[ăa]/i, /meniu (complet )?gol/i, /vine NULL/i, /trunchiaz/i, /nu apare/i,
];
const MODULE = ["attendance","pontaj","leave","concedii","payroll","salarizare","ssm","fleet","flota",
  "inventory","inventar","maintenance","mentenanta","checklists","per_diem","diurna","announcements",
  "evaluations","evaluari","onboarding","revisal","portal","employee_portal"];
const ROLURI = ["super_admin","org_admin","manager","hr","employee","angajat"];

const brut = readFileSync(DOC, "utf8");
const capcane = [];
for (const m of brut.matchAll(/^(\d+)\.\s([\s\S]*?)(?=\n\n\d+\.\s|\n*$)/gm)) {
  const nr = Number(m[1]);
  const text = m[2].replace(/\s+/g, " ").trim();
  capcane.push({
    nr,
    text,
    coduri: CODURI.filter((c) => text.includes(c)),
    tabele: [...new Set([...text.matchAll(/\b(?:public\.)?([a-z][a-z0-9]*(?:_[a-z0-9]+){0,4})\b/g)]
      .map((x) => x[1]).filter((t) => SUFIXE_TABELA.test(t) || TABELE_SIMPLE.has(t)))],
    module: MODULE.filter((x) => new RegExp(`\\b${x}\\b`, "i").test(text)),
    roluri: ROLURI.filter((x) => new RegExp(`\`?${x}\`?`, "i").test(text)),
    rezolvata: /^\*\*\[REZOLVAT/.test(text),
  });
  const ultim = capcane[capcane.length - 1];
  ultim.tacut = ultim.coduri.length === 0 && MARCI_TACUTE.some((re) => re.test(text));
}

const argv = process.argv.slice(2);
const optie = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const pozitional = argv.find((a) => !a.startsWith("--") && argv[argv.indexOf(a) - 1]?.startsWith("--") !== true);

let rezultate = capcane, titlu = "toate capcanele";
const nr = optie("--nr");
const tabela = optie("--tabela");
const modul = optie("--modul");
const rol = optie("--rol");

if (nr) { rezultate = capcane.filter((c) => c.nr === Number(nr)); titlu = `capcana ${nr}`; }
else if (tabela) { rezultate = capcane.filter((c) => c.tabele.includes(tabela)); titlu = `tabela ${tabela}`; }
else if (modul) { rezultate = capcane.filter((c) => c.module.includes(modul)); titlu = `modulul ${modul}`; }
else if (rol) { rezultate = capcane.filter((c) => c.roluri.includes(rol)); titlu = `rolul ${rol}`; }
else if (argv.includes("--tacute")) { rezultate = capcane.filter((c) => c.tacut); titlu = "capcane TĂCUTE (fără cod de eroare)"; }
else if (pozitional) {
  const cod = CODURI.find((c) => c.toLowerCase() === pozitional.toLowerCase());
  if (cod) {
    rezultate = capcane.filter((c) => c.coduri.includes(cod));
    titlu = `${cod} — ${SENS[cod]}`;
  } else {
    const q = pozitional.toLowerCase();
    rezultate = capcane.filter((c) => c.text.toLowerCase().includes(q));
    titlu = `text conținând „${pozitional}”`;
  }
}

const LAT = Number(process.env.COLUMNS ?? 100);
const rupe = (t, ind = "   ") => {
  const cuv = t.split(" "); const out = []; let l = ind;
  for (const c of cuv) { if ((l + " " + c).length > LAT) { out.push(l); l = ind + c; } else l += (l === ind ? "" : " ") + c; }
  out.push(l); return out.join("\n");
};

console.log(`capcane.md — ${capcane.length} capcane · filtru: ${titlu} · ${rezultate.length} rezultate\n`);
for (const c of rezultate) {
  const et = [c.coduri.join(" "), c.tacut ? "TĂCUTĂ" : "", c.rezolvata ? "REZOLVATĂ" : ""].filter(Boolean).join(" · ");
  console.log(`── ${c.nr} ${et ? "[" + et + "]" : ""}`);
  console.log(rupe(nr ? c.text : c.text.slice(0, 400) + (c.text.length > 400 ? " […]" : "")));
  console.log(`   ↳ docs/design/ecrane/capcane.md, capcana ${c.nr}\n`);
}
if (rezultate.length === 0) console.log("   Nicio capcană. Asta NU înseamnă că e sigur — citește documentul.");
process.exit(0);
