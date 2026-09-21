#!/usr/bin/env node
// scripts/checks/lastmod.mjs
//
// Poarta pentru datele de `lastmod` rămase în urmă față de conținutul pe care
// îl descriu.
//
// ── DE CE EXISTĂ ───────────────────────────────────────────────────────────
// Auditul din 18 sept 2026 a măsurat: 41 din 48 de adrese din sitemap purtau
// `lastmod = 2026-09-17`, deși conținutul lor fusese schimbat în aceeași zi la
// 08:18, de comitul `77ae57f`. `/cere-demo` arăta 22 august, cu 27 de zile în
// urma ultimei editări.
//
// Partea care face din asta o poartă, nu o corectură: comentariul din capul lui
// `harta.ts` spune că exact defectul ăsta a fost reparat pe 17 septembrie —
// cele nouăsprezece module purtau o singură dată, mai veche decât ultima
// editare. S-a reprodus a doua zi, cu alt set de pagini. Un defect care se
// întoarce la o zi după reparație nu e o greșeală de om, e o lipsă de poartă.
//
// ── DE CE NU E UN TEST DIN `pnpm verify` ───────────────────────────────────
// Verificarea are nevoie de ISTORIC GIT, iar `ci.yml` face checkout superficial
// (adâncime 1). Acolo `git log -1 -- <fișier>` întoarce același commit pentru
// orice fișier, deci testul ar raporta TOTUL ca învechit — o poartă care
// strigă mereu e una pe care oamenii o opresc. Rulează deci ca script separat,
// ca `docs:lint`, pe o copie completă: local, înainte de livrare.
//
// ── DE CE `git log -L`, NU `git log -- <fișier>` ───────────────────────────
// Cele nouăsprezece fișe de modul stau în ACELAȘI fișier. Comparate cu data
// ultimei atingeri a fișierului, o editare pe o singură fișă le-ar marca pe
// toate nouăsprezece ca învechite — optsprezece fals-pozitive, adică exact
// felul de zgomot care omoară o poartă. `git log -L <start>,<sfârșit>:<fișier>`
// întoarce ultimul commit care a atins ACELE LINII, deci fiecare fișă se
// compară cu propria ei istorie.
//
// ── CE NU PRINDE ───────────────────────────────────────────────────────────
// Schimbările de text care stau în `ro.ts` și alimentează mai multe pagini
// deodată: git nu poate spune care pagină a fost atinsă. Pentru paginile fără
// fișier de conținut propriu se compară cu `page.tsx`-ul lor, ceea ce prinde
// rescrierile de pagină, dar nu și retușul de copy din `ro.ts`. Fals-negative,
// nu fals-pozitive — alegerea deliberată, în ambele sensuri, e aceeași ca la
// `use-server-exports.mjs`: ce semnalează, semnalează sigur.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const HARTA = "src/content/landing/harta.ts";
const FISE = "src/content/landing/fise-module.ts";
const RADACINA_MARKETING = "src/app/(marketing)";

/** `git`, fără shell. Întoarce `null` când comanda n-are ce spune. */
function git(argumente) {
  try {
    const iesire = execFileSync("git", argumente, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const prima = iesire.split("\n").find((l) => l.trim() !== "");
    return prima?.trim() ?? null;
  } catch {
    return null;
  }
}

/** Data ultimului commit care a atins fișierul, ca `YYYY-MM-DD`. */
const dataFisierului = (fisier) => git(["log", "-1", "--format=%cs", "--", fisier]);

/** Data ultimului commit care a atins liniile `[de..pana]` din fișier. */
const dataLiniilor = (fisier, de, pana) =>
  git(["log", "-L", `${String(de)},${String(pana)}:${fisier}`, "--format=%cs", "-s", "-1"]);

const probleme = [];
const semnaleaza = (ce, declarat, real, unde) => {
  probleme.push(`${ce}\n    declară ${declarat}, dar ${unde} s-a schimbat pe ${real}`);
};

// ── 0. Copia trebuie să aibă istoric ───────────────────────────────────────
if (git(["rev-parse", "--is-shallow-repository"]) !== "false") {
  console.log("lastmod: copie superficială (fără istoric) — verificarea se sare.");
  process.exit(0);
}

// ── 1. Fișele de modul, fiecare cu propriile ei linii ──────────────────────
const fise = readFileSync(FISE, "utf8").split("\n");
const inceputuri = [];
fise.forEach((linie, i) => {
  const cheie = /^\s{4}cheie: "([a-z_]+)",\s*$/u.exec(linie);
  if (cheie !== null) inceputuri.push({ cheie: cheie[1], linie: i + 1 });
});

for (const [i, fisa] of inceputuri.entries()) {
  const sfarsit = inceputuri[i + 1] === undefined ? fise.length : inceputuri[i + 1].linie - 1;
  const bucata = fise.slice(fisa.linie - 1, sfarsit).join("\n");
  const declarat = /actualizat: "(\d{4}-\d{2}-\d{2})"/u.exec(bucata)?.[1];
  if (declarat === undefined) continue;

  const real = dataLiniilor(FISE, fisa.linie, sfarsit);
  if (real !== null && declarat < real) {
    semnaleaza(`fișa „${fisa.cheie}" (/module/…)`, declarat, real, "textul ei");
  }
}

// ── 2. Paginile cu dată scrisă literal în hartă ────────────────────────────
//
// Cele care își iau data din conținut (`X.actualizatIso`, `fisaModulului(...)`)
// se sar: ele nu pot rămâne în urmă prin COPIERE, fiindcă nu se copiază nimic.
// Fișele de modul sunt acoperite la sursă de punctul 1; paginile-lege, din
// motivul scris la punctul 3.
//
// Blocurile se taie ÎNTÂI, și abia apoi se caută data în fiecare.
//
// Varianta cu un singur regex peste tot fișierul — `cale: "…"` urmat de
// `actualizat: "…"` într-o fereastră de caractere — împerechea calea unui bloc
// cu data ALTUIA: intrările care își iau data din conținut (`DIURNA.actualizatIso`)
// n-au literal de dată, iar căutarea negreedy sărea în blocul următor. Așa a
// raportat `/ghid/diurna` ca învechită, deși ea nu poate fi.
const harta = readFileSync(HARTA, "utf8");
const taieturi = [...harta.matchAll(/cale: "([^"]+)"/gu)];
for (const [i, taietura] of taieturi.entries()) {
  const de = taietura.index ?? 0;
  const pana = taieturi[i + 1]?.index ?? harta.length;
  const bloc = harta.slice(de, pana);
  const cale = taietura[1];
  const declarat = /actualizat: "(\d{4}-\d{2}-\d{2})"/u.exec(bloc)?.[1];
  // Fără literal de dată înseamnă că data vine din conținut — vezi mai sus.
  if (declarat === undefined) continue;
  // `/module/[modul]` e generată, nu are fișier propriu; `/` e rădăcina.
  const dir = cale === "/" ? "" : cale;
  const pagina = `${RADACINA_MARKETING}${dir}/page.tsx`;
  if (!existsSync(pagina)) continue;

  const real = dataFisierului(pagina);
  if (real !== null && declarat < real) {
    semnaleaza(`pagina ${cale}`, declarat, real, `\`${pagina}\``);
  }
}

// ── 3. Paginile-lege NU se verifică aici, și e o distincție, nu o scăpare ──
//
// Pe ele, `actualizatIso` nu înseamnă „ultima modificare a fișierului", ci
// „data la care textele de lege au fost verificate la sursă" — pagina o și
// scrie, sub titlu: „Textele verificate în {actualizat}".
//
// Prima variantă a scriptului le compara cu data ultimei atingeri a fișierului
// și raporta trei ca învechite. Erau fals-pozitive: fișierele fuseseră atinse
// pe 19 septembrie ca să primească `publicatIso`, o schimbare de metadate care
// n-a recitit niciun articol de lege. Ridicarea datei ar fi fost o afirmație
// falsă despre verificare — exact opusul a ce apără paginile astea.
//
// Rămâne o inexactitate cunoscută și acceptată: `lastmod`-ul lor urmează data
// verificării, nu a editării. E direcția sigură a greșelii — spune „mai vechi
// decât e", nu „mai nou".

// ── Raport ─────────────────────────────────────────────────────────────────
if (probleme.length === 0) {
  console.log("lastmod: toate datele din sitemap sunt cel puțin la zi cu conținutul lor.");
  process.exit(0);
}

console.error(
  `\nlastmod: ${String(probleme.length)} ${probleme.length === 1 ? "dată rămasă" : "date rămase"} în urma conținutului.\n`,
);
for (const p of probleme) console.error(`  · ${p}\n`);
console.error(
  "Un `lastmod` în care nu se poate avea încredere e ignorat de motoare — de aceea\n" +
    "nu se pune `new Date()`, ci se ridică data acolo unde conținutul chiar s-a schimbat.\n",
);
process.exit(1);
