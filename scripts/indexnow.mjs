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
// Utilizare:
//   node scripts/indexnow.mjs [baza] [--doar-verifica]
//   baza implicită: https://administrativo.ro. Trimiterea are sens doar pe
//   producție: adresele din sitemap poartă domeniul de producție.

const CHEIE = "14d9bcf9985b547c5822c218b8db468a";

const argumente = process.argv.slice(2);
const doarVerifica = argumente.includes("--doar-verifica");
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
const adrese = [...(await harta.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (adrese.length === 0) {
  console.error("✗ sitemap.xml nu conține nicio adresă.");
  process.exit(1);
}

if (doarVerifica) {
  console.log(`✓ Cheia e servită; ${adrese.length} adrese ar fi trimise. Nu s-a trimis nimic.`);
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
console.log(`✓ IndexNow: ${adrese.length} adrese trimise (${raspuns.status}).`);
