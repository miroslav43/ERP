#!/usr/bin/env node
// scripts/checks/rute-publice.mjs
//
// Poarta pe site-ul VIU: fiecare adresă din sitemap răspunde 200 și indexabil,
// de N ori la rând.
//
// ── DE CE EXISTĂ ───────────────────────────────────────────────────────────
// Pe 23 sept 2026, auditul SEO a găsit 23 din 48 de adrese din sitemap
// (`/module/*`, `/domenii/*`) răspunzând 404 + `noindex` la exact jumătate din
// cereri: o deconectare din aplicație invalidase cache-ul uneia dintre cele
// două replici, iar rutele cu `dynamicParams = false` nu se mai puteau regenera
// acolo (capcana #45). Build-ul, testele și `/healthz` erau verzi; defectul
// există doar într-un proces viu, după o anumită acțiune.
//
// ── DE CE N CERERI, NU UNA ─────────────────────────────────────────────────
// Cu două replici în spatele unui balansor, un singur `curl` are 50% șanse să
// nimerească replica sănătoasă și să spună „e în regulă". O poartă care minte
// jumătate din timp e mai rea decât niciuna. Implicit: 10 cereri pe adresă.
//
// ── CE CERE ────────────────────────────────────────────────────────────────
// Pentru fiecare adresă: status final 200 (redirecturile se urmează — `fetch`
// ignoră și răspunsurile informative 103 Early Hints, care păcăleau un
// `curl -w %{http_code}` naiv) și niciun `noindex` în `<meta name="robots">`
// sau în antetul `X-Robots-Tag`.
//
// Pe staging, `noindex` e CORECT — un mediu de probă nu are ce căuta în Google.
// Acolo se trece `--fara-indexare`, iar poarta cere doar statusul. Prima rulare
// pe staging, fără opțiune, a picat pe 48 de pagini „200+noindex": poarta avea
// dreptate despre pagini și greșea despre mediu.
//
// Utilizare:
//   node scripts/checks/rute-publice.mjs [baza] [--cereri N] [--fara-indexare]
//   baza implicită: https://administrativo.ro
//   ADM_AUTENTIFICARE_BASIC="utilizator:parola" pentru staging (în spatele
//   `auth_basic`); nu se afișează niciodată.

const argumente = process.argv.slice(2);
const iCereri = argumente.indexOf("--cereri");
const cereri = iCereri >= 0 ? Number(argumente[iCereri + 1]) : 10;
const verificaIndexarea = !argumente.includes("--fara-indexare");
// Baza e singurul argument pozițional; valoarea de după `--cereri` nu e una.
const baza = (
  argumente.find((a, i) => !a.startsWith("--") && i !== iCereri + 1) ?? "https://administrativo.ro"
).replace(/\/$/, "");
if (!Number.isInteger(cereri) || cereri < 1) {
  console.error("--cereri trebuie să fie un întreg pozitiv.");
  process.exit(2);
}

const antete = { "user-agent": "administrativo-poarta-rute-publice/1" };
if (process.env.ADM_AUTENTIFICARE_BASIC) {
  antete.authorization = `Basic ${Buffer.from(process.env.ADM_AUTENTIFICARE_BASIC).toString("base64")}`;
}

async function cere(url) {
  const r = await fetch(url, { headers: antete, redirect: "follow", cache: "no-store" });
  const corp = await r.text();
  const robotsMeta = /<meta[^>]+name="robots"[^>]+content="([^"]*)"/i.exec(corp)?.[1] ?? "";
  const robotsAntet = r.headers.get("x-robots-tag") ?? "";
  return {
    status: r.status,
    noindex: /noindex/i.test(robotsMeta) || /noindex/i.test(robotsAntet),
    cache: r.headers.get("x-nextjs-cache") ?? "-",
  };
}

const raspunsHarta = await fetch(`${baza}/sitemap.xml`, { headers: antete });
if (!raspunsHarta.ok) {
  console.error(`✗ ${baza}/sitemap.xml a răspuns ${raspunsHarta.status}.`);
  process.exit(1);
}
// Adresele din sitemap poartă domeniul de producție; pe staging se cer pe baza dată.
const adrese = [...(await raspunsHarta.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  (m) => baza + new URL(m[1]).pathname,
);
if (adrese.length === 0) {
  console.error("✗ sitemap.xml nu conține nicio adresă.");
  process.exit(1);
}

const esecuri = [];
for (const adresa of adrese) {
  const rezultate = [];
  for (let i = 0; i < cereri; i++) rezultate.push(await cere(adresa));
  const rele = rezultate.filter((r) => r.status !== 200 || (verificaIndexarea && r.noindex));
  if (rele.length > 0) {
    esecuri.push(
      `${adresa}\n      ${rele.length}/${cereri} rele: ` +
        rele.map((r) => `${r.status}${r.noindex ? "+noindex" : ""}(${r.cache})`).join(" "),
    );
  }
}

if (esecuri.length > 0) {
  console.error(
    `✗ ${esecuri.length} din ${adrese.length} adrese nu răspund stabil 200 + indexabil:`,
  );
  for (const e of esecuri) console.error(`  · ${e}`);
  console.error(
    "\n  404 cu x-nextjs-cache HIT doar pe o parte din cereri = o replică cu cache-ul invalidat" +
      "\n  (capcana #45). Restart-ul replicilor îl ascunde, nu îl repară.",
  );
  process.exit(1);
}
console.log(
  `✓ ${adrese.length} adrese × ${cereri} cereri: toate 200` +
    `${verificaIndexarea ? " și indexabile" : " (indexarea nu se cere aici)"} (${baza}).`,
);
