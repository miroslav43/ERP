#!/usr/bin/env node
/**
 * Starea deploy-urilor de staging — scriere și randare.
 *
 * DE CE EXISTĂ: la orice eșec, subdomeniul arată perfect și nimic nu spune că
 * push-ul colegului n-a ajuns. Prima versiune scria pagina O SINGURĂ DATĂ, la
 * finalul rulării, deci nu putea răspunde la „mai rulează?" sau „unde a ajuns?".
 * Comenzile de aici se apelează la începutul fiecărui pas, iar pagina se
 * reîmprospătează singură cât timp rularea e în curs.
 *
 * Fișierele trăiesc în `~/.stare-staging/`, montat read-only în containerul
 * santinelă (deploy/stare-stack.yml). Containerul e SEPARAT de aplicație:
 * momentul în care ai nevoie de pagină e exact momentul în care aplicația nu
 * pornește.
 *
 *   node scripts/stare/stare.mjs incepe --sha X --mesaj "..." --autor Y --url Z
 *   node scripts/stare/stare.mjs pas "Verificare"
 *   node scripts/stare/stare.mjs termina success --imagine administrativo-web-staging:abc
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const DIR = process.env.ADM_STARE_DIR ?? join(process.env.HOME ?? "", ".stare-staging");
const F_STARE = join(DIR, "stare.json");
const F_ISTORIC = join(DIR, "istoric.json");
const F_HTML = join(DIR, "index.html");

/** Câte rulări încheiate ținem. Peste zece, pagina devine un jurnal, nu o stare. */
const ISTORIC_MAX = 10;

// ── citire/scriere ──────────────────────────────────────────────────────────

function citeste(cale, implicit) {
  try {
    return JSON.parse(readFileSync(cale, "utf8"));
  } catch {
    return implicit;
  }
}

function scrie(cale, valoare) {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(cale, JSON.stringify(valoare, null, 2) + "\n", "utf8");
}

// ── argumente ───────────────────────────────────────────────────────────────

function argumente(argv) {
  const pozitionale = [];
  const numite = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      numite[argv[i].slice(2)] = argv[i + 1] ?? "";
      i++;
    } else {
      pozitionale.push(argv[i]);
    }
  }
  return { pozitionale, numite };
}

// ── comenzi ─────────────────────────────────────────────────────────────────

function incepe({ sha, mesaj, autor, url }) {
  const stare = {
    stare: "in_curs",
    sha: sha || "necunoscut",
    mesaj: mesaj || "",
    autor: autor || "",
    url: url || "",
    pornit_la: new Date().toISOString(),
    terminat_la: null,
    pasi: [],
  };
  scrie(F_STARE, stare);
  return stare;
}

function pas(nume) {
  const stare = citeste(F_STARE, null);
  if (!stare) return incepe({ sha: "necunoscut" });

  // Versiunea de dinainte de 2026-09-05 scria `pasi` ca ȘIR („verify / migrări /
  // deploy"), nu ca tablou. Un `.push()` pe un șir aruncă, iar `.at(-1)` pe el
  // întoarce un caracter — deci fără garda asta prima rulare de după livrare ar
  // fi picat pe un fișier rămas din formatul vechi.
  if (!Array.isArray(stare.pasi)) stare.pasi = [];

  const ultim = stare.pasi.at(-1);

  // Același pas anunțat de două ori nu e un pas nou. Se întâmplă la o reluare a
  // unui pas din workflow, iar fără garda asta lista ar arăta „Build imagine"
  // de trei ori la rând, ca și cum s-ar fi întâmplat de trei ori.
  if (ultim && ultim.stare === "in_curs" && ultim.nume === nume) {
    scrie(F_STARE, stare);
    return stare;
  }

  // Pasul anterior se închide ca reușit: dacă ar fi picat, jobul s-ar fi oprit
  // și `termina` l-ar fi marcat el.
  if (ultim && ultim.stare === "in_curs") {
    ultim.stare = "ok";
    ultim.durata_s = secunde(ultim.pornit_la, new Date().toISOString());
  }

  stare.pasi.push({ nume, stare: "in_curs", pornit_la: new Date().toISOString() });
  scrie(F_STARE, stare);
  return stare;
}

function termina(rezultat, { imagine }) {
  const stare = citeste(F_STARE, null) ?? incepe({ sha: "necunoscut" });
  const acum = new Date().toISOString();

  const ultim = stare.pasi.at(-1);
  if (ultim && ultim.stare === "in_curs") {
    ultim.stare = rezultat === "success" ? "ok" : rezultat;
    ultim.durata_s = secunde(ultim.pornit_la, acum);
  }

  stare.stare = rezultat;
  stare.terminat_la = acum;
  stare.durata_s = secunde(stare.pornit_la, acum);
  if (imagine) stare.imagine = imagine;
  scrie(F_STARE, stare);

  const istoric = citeste(F_ISTORIC, []);
  istoric.unshift({
    sha: stare.sha,
    mesaj: stare.mesaj,
    stare: stare.stare,
    durata_s: stare.durata_s,
    cand: acum,
    url: stare.url,
  });
  scrie(F_ISTORIC, istoric.slice(0, ISTORIC_MAX));
  return stare;
}

function secunde(de_la, pana_la) {
  const a = Date.parse(de_la);
  const b = Date.parse(pana_la);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, Math.round((b - a) / 1000)) : 0;
}

// ── randare ─────────────────────────────────────────────────────────────────

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const e = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

function durata(s) {
  if (!Number.isFinite(s) || s < 0) return "—";
  // Zero secunde e o durată MĂSURATĂ, nu una lipsă. „—" s-ar citi „necunoscut".
  if (s === 0) return "sub 1 s";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m} min ${r} s` : `${r} s`;
}

/** Media rulărilor ÎNCHEIATE CU BINE — reperul onest pentru „cât mai durează". */
function mediaReusitelor(istoric) {
  const bune = istoric.filter((i) => i.stare === "success" && i.durata_s > 0);
  if (bune.length === 0) return null;
  return Math.round(bune.reduce((s, i) => s + i.durata_s, 0) / bune.length);
}

const ETICHETE = {
  in_curs: { text: "rulează acum", culoare: "curs" },
  success: { text: "a ajuns pe staging", culoare: "bun" },
  failure: { text: "NU a ajuns — staging e pe versiunea anterioară", culoare: "rau" },
  cancelled: { text: "anulată de un push mai nou", culoare: "neutru" },
};

function randeaza(stare, istoric) {
  const et = ETICHETE[stare.stare] ?? { text: stare.stare, culoare: "neutru" };
  const inCurs = stare.stare === "in_curs";
  const medie = mediaReusitelor(istoric);

  const pasiHtml = stare.pasi
    .map((p) => {
      const simbol = { ok: "✓", in_curs: "•", failure: "✗", cancelled: "⊘" }[p.stare] ?? "·";
      const d = p.stare === "in_curs" ? "" : durata(p.durata_s);
      return `<li class="p-${p.stare}"><span class="s">${simbol}</span>
        <span class="n">${e(p.nume)}</span><span class="d">${e(d)}</span></li>`;
    })
    .join("\n");

  const istoricHtml = istoric
    .map(
      (i) => `<tr class="i-${i.stare}">
        <td><code>${e(i.sha.slice(0, 8))}</code></td>
        <td class="m">${e(i.mesaj)}</td>
        <td class="d">${e(durata(i.durata_s))}</td>
        <td class="c">${e(new Date(i.cand).toLocaleString("ro-RO"))}</td>
      </tr>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="ro">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
${inCurs ? '<meta http-equiv="refresh" content="10">' : ""}
<title>Staging — ${e(stare.sha.slice(0, 8))}</title>
<style>
  :root {
    --fundal: #fbfbfc; --card: #fff; --text: #1b1f24; --slab: #626a73;
    --linie: #e3e6ea; --bun: #0a7d55; --rau: #c23934; --curs: #b06f00; --neutru: #626a73;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --fundal: #13161a; --card: #1a1e24; --text: #e8eaed; --slab: #9aa3ad;
      --linie: #2a2f37; --bun: #35c48b; --rau: #ff6b64; --curs: #e0a63a; --neutru: #9aa3ad;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 2rem 1.25rem 4rem; background: var(--fundal); color: var(--text);
         font: 15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
  .lat { max-width: 46rem; margin: 0 auto; }
  h1 { font-size: 1.05rem; font-weight: 600; margin: 0 0 1.25rem; color: var(--slab);
       letter-spacing: .01em; }
  .card { background: var(--card); border: 1px solid var(--linie); border-radius: 12px;
          padding: 1.25rem 1.4rem; margin-bottom: 1rem; }
  .banda { border-left: 4px solid var(--c); }
  .bun { --c: var(--bun); } .rau { --c: var(--rau); }
  .curs { --c: var(--curs); } .neutru { --c: var(--neutru); }
  .stare { color: var(--c); font-weight: 650; font-size: 1.15rem; margin: 0 0 .35rem; }
  .sub { color: var(--slab); font-size: .9rem; margin: 0; }
  code { font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
         background: var(--fundal); border: 1px solid var(--linie);
         padding: .08em .38em; border-radius: 5px; }
  .ceas { font-variant-numeric: tabular-nums; font-weight: 650; }
  h2 { font-size: .78rem; text-transform: uppercase; letter-spacing: .07em;
       color: var(--slab); margin: 0 0 .7rem; font-weight: 600; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { display: flex; align-items: baseline; gap: .6rem; padding: .3rem 0;
       border-bottom: 1px solid var(--linie); }
  li:last-child { border-bottom: 0; }
  .s { width: 1.1rem; text-align: center; font-weight: 700; }
  .n { flex: 1; }
  .d { color: var(--slab); font-size: .85rem; font-variant-numeric: tabular-nums; }
  .p-ok .s { color: var(--bun); }
  .p-failure .s, .p-failure .n { color: var(--rau); }
  .p-in_curs .s { color: var(--curs); }
  .p-cancelled { opacity: .55; }
  table { width: 100%; border-collapse: collapse; font-size: .88rem; }
  th { text-align: left; font-weight: 600; color: var(--slab); font-size: .76rem;
       text-transform: uppercase; letter-spacing: .06em; padding-bottom: .5rem; }
  td { padding: .42rem .9rem .42rem 0; border-top: 1px solid var(--linie);
       vertical-align: top; }
  td:last-child { padding-right: 0; }
  td.m { color: var(--slab); }
  td.d { white-space: nowrap; font-variant-numeric: tabular-nums; }
  td.c { color: var(--slab); white-space: nowrap; text-align: right; }
  .i-success code { color: var(--bun); } .i-failure code { color: var(--rau); }
  .i-cancelled { opacity: .55; }
  a { color: inherit; }
  .jos { color: var(--slab); font-size: .82rem; text-align: center; margin-top: 1.5rem; }
</style>
<div class="lat">
  <h1>Administrativo · mediul de probă</h1>

  <div class="card banda ${et.culoare}">
    <p class="stare">${e(et.text)}</p>
    <p class="sub">
      <code>${e(stare.sha.slice(0, 8))}</code>
      ${stare.mesaj ? "&nbsp;" + e(stare.mesaj) : ""}
      ${stare.autor ? '<br><span style="opacity:.8">' + e(stare.autor) + "</span>" : ""}
    </p>
  </div>

  <div class="card">
    <h2>Timp</h2>
    <p class="sub">
      ${
        inCurs
          ? `rulează de <span class="ceas" id="ceas" data-de-la="${e(stare.pornit_la)}">…</span>`
          : `a durat <span class="ceas">${e(durata(stare.durata_s))}</span>`
      }
      ${medie ? `<br>media rulărilor reușite: <span class="ceas">${e(durata(medie))}</span>` : ""}
      ${stare.imagine ? `<br>imagine: <code>${e(stare.imagine)}</code>` : ""}
    </p>
  </div>

  ${stare.pasi.length ? `<div class="card"><h2>Pași</h2><ul>${pasiHtml}</ul></div>` : ""}

  ${
    istoric.length
      ? `<div class="card"><h2>Rulări anterioare</h2><table>
           <tr><th>commit</th><th>mesaj</th><th>durată</th><th style="text-align:right">când</th></tr>
           ${istoricHtml}
         </table></div>`
      : ""
  }

  <p class="jos">
    ${stare.url ? `<a href="${e(stare.url)}">log-ul complet în GitHub Actions</a> · ` : ""}
    <a href="https://staging.administrativo.ro/">înapoi la aplicație</a>
    ${inCurs ? "<br>pagina se reîmprospătează la 10 secunde" : ""}
  </p>
</div>
<script>
  // Ceasul rulează în browser, ca minutele să curgă între reîmprospătări.
  var c = document.getElementById("ceas");
  if (c) {
    var t0 = Date.parse(c.dataset.deLa);
    var bate = function () {
      var s = Math.max(0, Math.round((Date.now() - t0) / 1000));
      var m = Math.floor(s / 60);
      c.textContent = m > 0 ? m + " min " + (s % 60) + " s" : s + " s";
    };
    // O bătaie ACUM, nu peste o secundă: pagina se reîmprospătează la 10
    // secunde, deci un „…" inițial ar fi vizibil la fiecare încărcare.
    bate();
    setInterval(bate, 1000);
  }
</script>
</html>
`;
}

// ── dispecer ────────────────────────────────────────────────────────────────

const { pozitionale, numite } = argumente(process.argv.slice(2));
const comanda = pozitionale[0];

let stare;
if (comanda === "incepe") stare = incepe(numite);
else if (comanda === "pas") stare = pas(pozitionale[1] ?? "pas");
else if (comanda === "termina") stare = termina(pozitionale[1] ?? "failure", numite);
else {
  console.error("Comenzi: incepe | pas <nume> | termina <success|failure|cancelled>");
  process.exit(2);
}

const istoric = citeste(F_ISTORIC, []);
mkdirSync(DIR, { recursive: true });
writeFileSync(F_HTML, randeaza(stare, istoric), "utf8");
console.log(`  stare: ${stare.stare}  ·  pași: ${stare.pasi.length}  ·  ${DIR}`);
