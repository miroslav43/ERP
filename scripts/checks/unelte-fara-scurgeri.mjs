#!/usr/bin/env node
// scripts/checks/unelte-fara-scurgeri.mjs
//
// Poarta pe site-ul VIU: ce scrie un vizitator într-o unealtă gratuită nu
// pleacă spre statistici (Google Analytics, Umami) și nu apare în antetul
// `Referer` al cererilor spre propriul server.
//
// ── DE CE EXISTĂ ───────────────────────────────────────────────────────────
// Auditul din 8 oct 2026 a scris „Zzsecret Popescu” în foaia de pontaj și a
// găsit numele în `dl=` la Google Analytics — și FĂRĂ consimțământ, cu
// `gcs=G100` — și în `url`/`referrer` la Umami. Formularele sunt GET, deci
// valorile stau în adresă; niciun test de unitate nu vede ce trimite un
// script terț dintr-un browser real.
//
// ── CE NU STRICĂ ───────────────────────────────────────────────────────────
// Cererile spre colectoare sunt interceptate și ANULATE după ce li se citește
// conținutul: nimic nu ajunge în statistici. `gtag.js` și `script.js` se
// încarcă normal — fără ele n-ar exista cereri de verificat.
//
// ── DE CE CERE ȘI CERERI VĂZUTE, NU DOAR ZERO SCURGERI ─────────────────────
// O poartă care nu vede nicio cerere spre statistici „trece” la fel de bine
// când scripturile nu s-au încărcat deloc (vezi memoria „workflow verde prin
// sărire”). Pe pagina curată se cer ≥ 1 cerere GA și ≥ 1 cerere Umami; după
// trimiterea formularului, ≥ 1 cerere Umami (afișarea paginii generate).
//
// Utilizare:
//   node scripts/checks/unelte-fara-scurgeri.mjs [baza]
//   baza implicită: https://administrativo.ro
//   ADM_AUTENTIFICARE_BASIC="utilizator:parola" pentru staging (în spatele
//   `auth_basic`); nu se afișează niciodată.
//   Pe alt domeniu decât administrativo.ro, Umami nu trimite nimic
//   (`data-domains`), iar poarta o spune și verifică doar GA și Referer.

import { chromium } from "@playwright/test";

const BAZA = (process.argv[2] ?? "https://administrativo.ro").replace(/\/$/, "");
const UMAMI_ACTIV = new URL(BAZA).hostname === "administrativo.ro";
const EXEC =
  process.env["CHROMIUM"] ??
  `${process.env["HOME"] ?? ""}/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell`;
const MARCAJ = "Zzscurgere";
const BASIC = process.env["ADM_AUTENTIFICARE_BASIC"];
const [UTILIZATOR = "", PAROLA = ""] = BASIC?.split(/:(.*)/su) ?? [];
const ANTETE = { "user-agent": "administrativo-poarta-scurgeri/1" };
if (BASIC !== undefined) ANTETE.authorization = `Basic ${Buffer.from(BASIC).toString("base64")}`;

const UNELTE = [
  "/unelte/foaie-de-pontaj",
  "/unelte/condica-de-prezenta",
  "/unelte/cerere-concediu-de-odihna",
  "/unelte/foaie-de-parcurs",
  "/unelte/fisa-instruire-ssm",
  "/unelte/fisa-evaluare",
  "/unelte/calculator-salariu",
];

const COLECTOR_GA = /(google-analytics\.com|analytics\.google\.com)\/g\/collect/u;
const COLECTOR_UMAMI = /\/api\/send(\?|$)/u;
const ALTE_GOOGLE = /doubleclick\.net/u;

/** Textul cererii, decodat cât se poate, ca marcajul să se vadă și din `%5A` sau `+`. */
function decodat(text) {
  let rezultat = text.replaceAll("+", " ");
  for (let i = 0; i < 3; i += 1) {
    try {
      const urmator = decodeURIComponent(rezultat);
      if (urmator === rezultat) break;
      rezultat = urmator;
    } catch {
      break;
    }
  }
  return rezultat;
}

async function verificaUnealta(browser, cale, cuConsimtamant) {
  const context = await browser.newContext(
    BASIC === undefined ? {} : { httpCredentials: { username: UTILIZATOR, password: PAROLA } },
  );
  if (cuConsimtamant) {
    await context.addInitScript(() => {
      try {
        localStorage.setItem("adm-consimtamant", "acceptat");
      } catch {
        /* fără stocare: rulează ca refuz */
      }
    });
  }
  const pagina = await context.newPage();
  // Trei faze: „curata” (pagina deschisă fără valori), „completare” (câmpurile
  // se umplu, documentul vechi se descarcă — GA poate trimite `user_engagement`
  // pentru el, cu adresa curată) și „trimisa” (documentul cu valori în adresă).
  const statistici = []; // { faza, tip, text }
  const referere = []; // { faza, referer }
  let faza = "curata";

  await pagina.route(
    (url) =>
      COLECTOR_GA.test(url.href) ||
      ALTE_GOOGLE.test(url.href) ||
      (url.hostname.startsWith("analitice.") && COLECTOR_UMAMI.test(url.pathname)),
    async (ruta) => {
      const cerere = ruta.request();
      const tip = COLECTOR_GA.test(cerere.url()) || ALTE_GOOGLE.test(cerere.url()) ? "ga" : "umami";
      statistici.push({ faza, tip, text: `${cerere.url()}\n${cerere.postData() ?? ""}` });
      await ruta.abort();
    },
  );
  pagina.on("request", (cerere) => {
    if (cerere.url().startsWith(BAZA)) {
      const referer = cerere.headers()["referer"];
      if (referer !== undefined) referere.push({ faza, referer });
    }
  });

  // `load` + o pauză fixă, nu `networkidle`: o pagină cu prefetch-uri și
  // `keepalive` poate să nu ajungă niciodată „liniștită”.
  await pagina.goto(`${BAZA}${cale}`, { waitUntil: "load" });
  await pagina.waitForTimeout(2500);

  faza = "completare";
  const campuri = pagina.locator(
    'form[method="get"] textarea, form[method="get"] input[type="text"]',
  );
  const numar = await campuri.count();
  for (let i = 0; i < numar; i += 1) await campuri.nth(i).fill(`${MARCAJ} ${String(i)}`);
  // `waitForURL` pe adresa cu marcaj, nu `waitForLoadState("load")`: acesta din
  // urmă se rezolvă IMEDIAT, fiindcă documentul vechi e deja „load”. Faza ar
  // deveni „trimisa” înaintea descărcării documentului curat, iar
  // `user_engagement`-ul lui ar fi numărat drept cerere GA de după trimitere —
  // poarta ar rămâne roșie și după reparație.
  await Promise.all([
    pagina.waitForURL((url) => decodat(url.href).includes(MARCAJ), { waitUntil: "load" }),
    pagina.locator('form[method="get"] button[type="submit"]:not([formaction])').first().click(),
  ]);
  faza = "trimisa";
  await pagina.waitForTimeout(2500);
  const adresaGenerata = pagina.url();

  await pagina.mouse.wheel(0, 4000);
  await pagina.waitForTimeout(1000);
  await pagina.locator('a[href="/unelte"]').first().click();
  await pagina.waitForURL(`${BAZA}/unelte`);
  await pagina.waitForTimeout(2000);
  await pagina.close({ runBeforeUnload: true });
  await context.close();

  const probleme = new Set();
  if (numar === 0) probleme.add("niciun câmp de text găsit — scenariul n-a rulat");
  if (!decodat(adresaGenerata).includes(MARCAJ)) {
    probleme.add(
      `după trimitere, adresa nu poartă marcajul (${adresaGenerata}) — scenariul n-a rulat`,
    );
  }
  for (const s of statistici) {
    if (decodat(s.text).includes(MARCAJ)) {
      probleme.add(
        `SCURGERE ${s.tip} (${s.faza}): ${decodat(s.text).split("\n")[0]?.slice(0, 200) ?? ""}`,
      );
    }
  }
  for (const r of referere) {
    if (decodat(r.referer).includes(MARCAJ))
      probleme.add(`SCURGERE Referer (${r.faza}): ${r.referer.slice(0, 120)}`);
  }
  const numara = (f, t) => statistici.filter((s) => s.faza === f && s.tip === t).length;
  if (numara("curata", "ga") === 0)
    probleme.add("pe pagina curată nu s-a văzut nicio cerere GA — verificare vidă");
  if (UMAMI_ACTIV && numara("curata", "umami") === 0) {
    probleme.add("pe pagina curată nu s-a văzut nicio cerere Umami — verificare vidă");
  }
  // Documentul deschis cu valori în adresă nu configurează deloc GA
  // (`_componente/pornire-ga.tsx`): orice cerere GA după trimitere e o regresie,
  // chiar dacă azi n-ar purta marcajul.
  if (numara("trimisa", "ga") > 0) {
    probleme.add(
      `după trimitere au plecat ${String(numara("trimisa", "ga"))} cereri GA — documentul trebuia să rămână nemăsurat de GA`,
    );
  }
  if (UMAMI_ACTIV && numara("trimisa", "umami") === 0) {
    probleme.add("după trimitere nu s-a văzut nicio cerere Umami — verificare vidă");
  }
  return {
    probleme: [...probleme],
    rezumat: `GA ${String(numara("curata", "ga"))}+${String(numara("trimisa", "ga"))}, Umami ${String(numara("curata", "umami"))}+${String(numara("trimisa", "umami"))}, Referer ${String(referere.length)}`,
  };
}

/**
 * Descărcările: răspunsul cu date personale nu se ține în niciun cache comun,
 * iar paginile uneltelor trimit `Referrer-Policy: strict-origin` (nginx).
 */
const DESCARCARI = [
  `/api/unelte/foaie-de-pontaj?format=xlsx&luna=10&an=2026&angajati=${MARCAJ}`,
  `/api/unelte/condica-de-prezenta?format=pdf&luna=10&an=2026&firma=${MARCAJ}`,
  `/api/unelte/cerere-concediu?format=docx&tip=odihna&de_la=2027-03-01&pana_la=2027-03-05&salariat=${MARCAJ}`,
  `/api/unelte/foaie-de-parcurs?format=pdf&luna=10&an=2026&sofer=${MARCAJ}`,
  `/api/unelte/fisa-instruire-ssm?format=pdf&nume=${MARCAJ}`,
  `/api/unelte/fisa-evaluare?format=docx&nume=${MARCAJ}`,
];
let antetGresite = 0;
for (const cale of DESCARCARI) {
  const raspuns = await fetch(`${BAZA}${cale}`, { headers: ANTETE });
  await raspuns.arrayBuffer();
  const cache = raspuns.headers.get("cache-control") ?? "";
  if (raspuns.status !== 200 || !cache.includes("private") || !cache.includes("no-store")) {
    antetGresite += 1;
    console.error(
      `  ✗ ${cale.split("?")[0] ?? cale} — ${String(raspuns.status)}, cache-control: ${cache}`,
    );
  } else {
    console.log(`  ✓ ${cale.split("?")[0] ?? cale} — cache-control: ${cache}`);
  }
}
for (const cale of UNELTE) {
  const raspuns = await fetch(`${BAZA}${cale}`, { headers: ANTETE });
  await raspuns.arrayBuffer();
  const politica = raspuns.headers.get("referrer-policy") ?? "";
  if (politica !== "strict-origin") {
    antetGresite += 1;
    console.error(`  ✗ ${cale} — referrer-policy: ${politica}`);
  }
}

const browser = await chromium.launch({ executablePath: EXEC, args: ["--no-sandbox"] });
let cazute = 0;
for (const cuConsimtamant of [false, true]) {
  for (const cale of UNELTE) {
    let rezultat;
    try {
      rezultat = await verificaUnealta(browser, cale, cuConsimtamant);
    } catch (eroare) {
      rezultat = {
        probleme: [`scenariul a căzut: ${String(eroare).split("\n")[0]}`],
        rezumat: "—",
      };
    }
    const { probleme, rezumat } = rezultat;
    const eticheta = `${cale} ${cuConsimtamant ? "(Accept)" : "(fără consimțământ)"}`;
    if (probleme.length === 0) {
      console.log(`  ✓ ${eticheta} — ${rezumat}`);
    } else {
      cazute += 1;
      console.error(`  ✗ ${eticheta} — ${rezumat}`);
      for (const p of probleme) console.error(`      · ${p}`);
    }
  }
}
await browser.close();
if (!UMAMI_ACTIV)
  console.log(
    `Umami: inactiv pe ${new URL(BAZA).hostname} (data-domains) — verificat doar GA și Referer.`,
  );
if (cazute > 0 || antetGresite > 0) {
  console.error(
    `\nunelte-fara-scurgeri: ${String(cazute)} din ${String(UNELTE.length * 2)} scenarii au căzut, ${String(antetGresite)} antete greșite.`,
  );
  process.exit(1);
}
console.log(`\nunelte-fara-scurgeri: toate cele ${String(UNELTE.length * 2)} scenarii curate.`);
