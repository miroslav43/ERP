#!/usr/bin/env node
// scripts/indexnow.mjs
//
// Anunță Bing, Yandex și restul rețelei IndexNow că adresele din sitemap s-au
// schimbat. Rulează după fiecare deploy de producție, din `ops/01-main.sh`.
//
// ── DE CE ──────────────────────────────────────────────────────────────────
// Auditul din 2 oct 2026: Google avea 48/48 de pagini, Brave 0, Bing
// neconfirmat. Search Console nu ajunge la Bing; IndexNow da, fără cont.
//
// Brave NU e în rețeaua IndexNow (participanții sunt Bing, Yandex, Seznam,
// Naver, Yep), deci scriptul ăsta nu-l atinge — comentariul de aici spunea
// altceva până la auditul din 7 oct 2026. Brave are formularul lui,
// https://search.brave.com/submit-url, o adresă pe rând, trimisă de om.
//
// ── CE VERIFICĂ ÎNAINTE ────────────────────────────────────────────────────
// Că fișierul cheii e servit pe domeniu și conține cheia. Fără el, IndexNow
// răspunde 403 — mai bine aflăm de aici, cu un mesaj clar. Cheia NU e un
// secret: specificația o vrea publică, la `/<cheie>.txt`.
//
// ── CE TRIMITE ─────────────────────────────────────────────────────────────
// Doar adresele al căror `lastmod` e la sau după ultima trimitere reușită. Până
// la auditul din 7 oct 2026 trimitea la fiecare deploy tot sitemap-ul, iar
// ghidul IndexNow spune exact invers: „Avoid submitting the same URL many times
// a day unless there are meaningful content changes” — cotă de crawl irosită.
// `lastmod` e scris de mână, doar unde conținutul chiar s-a schimbat
// (`harta.ts`, păzit de `check:lastmod`), deci filtrul e de încredere.
//
// Data ultimei trimiteri stă pe mașina care face deploy, în
// `$INDEXNOW_STARE` (implicit `~/.administrativo-indexnow.json`), scrisă doar
// după un 200/202. Fără fișier — prima rulare — sau cu `--toate`, pleacă tot.
// Comparația e inclusivă: două deploy-uri în aceeași zi retrimit paginile zilei,
// în loc să le piardă pe ale celui de-al doilea.
//
// Utilizare:
//   node scripts/indexnow.mjs [baza] [--doar-verifica] [--toate]
//   baza implicită: https://administrativo.ro. Trimiterea are sens doar pe
//   producție: adresele din sitemap poartă domeniul de producție.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CHEIE = "14d9bcf9985b547c5822c218b8db468a";

const argumente = process.argv.slice(2);
const doarVerifica = argumente.includes("--doar-verifica");
const toate = argumente.includes("--toate");
const STARE = process.env.INDEXNOW_STARE ?? join(homedir(), ".administrativo-indexnow.json");

/** Ziua de azi în România, `YYYY-MM-DD` — aceeași formă ca `lastmod`. */
const azi = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest" }).format(new Date());

/** Data ultimei trimiteri reușite, sau `null` dacă nu există una citibilă. */
function ultimaTrimitere() {
  if (!existsSync(STARE)) return null;
  try {
    const data = JSON.parse(readFileSync(STARE, "utf8")).ultimaTrimitere;
    return typeof data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : null;
  } catch {
    return null;
  }
}
const baza = (argumente.find((a) => !a.startsWith("--")) ?? "https://administrativo.ro").replace(
  /\/$/,
  "",
);
const antete = { "user-agent": "administrativo-indexnow/1" };

const fisier = await fetch(`${baza}/${CHEIE}.txt`, { headers: antete });
const continut = fisier.ok ? (await fisier.text()).trim() : "";
if (continut !== CHEIE) {
  console.error(
    `✗ ${baza}/${CHEIE}.txt a răspuns ${fisier.status} și nu conține cheia. ` +
      "Fișierul e în `public/`; dacă lipsește de pe server, imaginea e veche.",
  );
  process.exit(1);
}

const harta = await fetch(`${baza}/sitemap.xml`, { headers: antete });
if (!harta.ok) {
  console.error(`✗ ${baza}/sitemap.xml a răspuns ${harta.status}.`);
  process.exit(1);
}
const intrari = [...(await harta.text()).matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => ({
  loc: /<loc>([^<]+)<\/loc>/.exec(m[1])?.[1],
  // Doar ziua: `lastmod` poate veni și cu oră; o adresă fără el se trimite.
  lastmod: /<lastmod>([^<]+)<\/lastmod>/.exec(m[1])?.[1]?.slice(0, 10) ?? null,
}));
if (intrari.length === 0 || intrari.some((i) => i.loc === undefined)) {
  console.error("✗ sitemap.xml nu conține adrese citibile.");
  process.exit(1);
}

const dela = toate ? null : ultimaTrimitere();
const adrese = intrari
  .filter((i) => dela === null || i.lastmod === null || i.lastmod >= dela)
  .map((i) => i.loc);
const motiv = dela === null ? "toate" : `schimbate din ${dela}`;

if (doarVerifica) {
  console.log(
    `✓ Cheia e servită; ${adrese.length} din ${intrari.length} adrese ar fi trimise (${motiv}). Nu s-a trimis nimic.`,
  );
  process.exit(0);
}

if (adrese.length === 0) {
  console.log(`✓ IndexNow: nicio adresă schimbată din ${dela}; nu s-a trimis nimic.`);
  process.exit(0);
}

const raspuns = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { ...antete, "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: new URL(baza).host,
    key: CHEIE,
    keyLocation: `${baza}/${CHEIE}.txt`,
    urlList: adrese,
  }),
});
// 200 = primit și verificat; 202 = primit, cheia se verifică ulterior.
if (raspuns.status !== 200 && raspuns.status !== 202) {
  console.error(`✗ IndexNow a răspuns ${raspuns.status}: ${await raspuns.text()}`);
  process.exit(1);
}
writeFileSync(STARE, `${JSON.stringify({ ultimaTrimitere: azi }, null, 2)}\n`);
console.log(
  `✓ IndexNow: ${adrese.length} din ${intrari.length} adrese trimise (${motiv}, ${raspuns.status}).`,
);
