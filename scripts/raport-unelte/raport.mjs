#!/usr/bin/env node
// scripts/raport-unelte/raport.mjs
/**
 * Raportul săptămânal al uneltelor gratuite: vizitatori, descărcări și conturi,
 * pe unealtă, din Umami.
 *
 *   node scripts/raport-unelte/raport.mjs                     # ultima săptămână ISO încheiată
 *   node scripts/raport-unelte/raport.mjs --de-la 2026-10-01 --pana-la 2026-10-07
 *   node scripts/raport-unelte/raport.mjs --json              # pentru alte scripturi
 *
 * Parola: `UMAMI_ADMIN_PAROLA` din mediu sau din `.env.production`, citită pe
 * linie, nu cu `source`. Nu se tipărește niciodată, nici ea, nici tokenul;
 * erorile spun doar codul HTTP.
 *
 * ── DE CE DIN UMAMI ȘI NU DIN JURNALELE nginx ─────────────────────────────
 * Jurnalul edge-ului e stdout-ul unui container comun cu ~10 site-uri și se
 * pierde la recreare; din 8 oct 2026 nici nu mai poartă query-ul uneltelor (A6).
 * Plus o capcană de citire: o aterizare din Google apare cu IP-ul proxy-ului de
 * preîncărcare Chrome (2001:4860:7:*), iar omul abia la cererile următoare, cu
 * IP-ul lui. Numărătoarea de care e nevoie o trimite serverul nostru la Umami.
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

import {
  intervalExplicit,
  numar,
  parseazaEvenimente,
  randeazaDate,
  randeazaRaport,
  saptamanaTrecuta,
  valoareDinEnv,
} from "./agregare.mjs";

const { values: arg } = parseArgs({
  options: {
    "de-la": { type: "string" },
    "pana-la": { type: "string" },
    json: { type: "boolean", default: false },
  },
});

function mor(mesaj, cod = 1) {
  process.stderr.write(`✗ ${mesaj}\n`);
  process.exit(cod);
}

let env = "";
try {
  env = readFileSync(new URL("../../.env.production", import.meta.url), "utf8");
} catch {
  // Fără fișier: rămân variabilele din mediu.
}

const parola = process.env.UMAMI_ADMIN_PAROLA ?? valoareDinEnv(env, "UMAMI_ADMIN_PAROLA");
const site = process.env.UMAMI_SITE_ID ?? valoareDinEnv(env, "NEXT_PUBLIC_UMAMI_ID");
const script = valoareDinEnv(env, "NEXT_PUBLIC_UMAMI_SRC");
const gazda =
  process.env.UMAMI_GAZDA ??
  (script === null ? "https://analitice.administrativo.ro" : new URL(script).origin);
if (parola === null || parola === "") {
  mor("UMAMI_ADMIN_PAROLA lipsește — nici în mediu, nici în .env.production.");
}
if (site === null)
  mor("Identificatorul sitului lipsește (NEXT_PUBLIC_UMAMI_ID sau UMAMI_SITE_ID).");

let interval;
try {
  interval =
    arg["de-la"] !== undefined || arg["pana-la"] !== undefined
      ? intervalExplicit(arg["de-la"] ?? "", arg["pana-la"] ?? "")
      : saptamanaTrecuta(new Date());
} catch (eroare) {
  mor(eroare instanceof Error ? eroare.message : "Interval greșit.");
}

const login = await fetch(`${gazda}/api/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    username: process.env.UMAMI_ADMIN_UTILIZATOR ?? "admin",
    password: parola,
  }),
  signal: AbortSignal.timeout(20_000),
}).catch(() => null);
if (login === null || !login.ok) {
  mor(`Autentificarea la Umami a eșuat (HTTP ${login?.status ?? "fără răspuns"}).`, 2);
}
const { token } = await login.json();

async function api(cale) {
  const r = await fetch(`${gazda}${cale}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (r === null || !r.ok)
    mor(`Umami a răspuns ${r?.status ?? "nimic"} la ${cale.split("?")[0]}.`, 2);
  return r.json();
}

/** Ca `api`, dar fără să oprească raportul: `null` dacă Umami nu răspunde cu 200. */
async function apiPoate(cale) {
  const r = await fetch(`${gazda}${cale}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (r === null || !r.ok) return null;
  return r.json().catch(() => null);
}

/**
 * Datele evenimentelor de server (`payload.data`, proprietăți de eveniment în
 * Umami): câte valori are fiecare câmp. Doar `dl:` și `calc:` — evenimentele din
 * browser nu poartă date. Un API care nu răspunde dă `null`, nu oprește raportul.
 */
async function dateEvenimente(fereastra) {
  const proprietati = await apiPoate(`/api/websites/${site}/event-data/properties?${fereastra}`);
  if (!Array.isArray(proprietati)) return null;
  const rezultat = [];
  for (const p of proprietati) {
    const eveniment = p?.eventName;
    const camp = p?.propertyName;
    if (typeof eveniment !== "string" || typeof camp !== "string") continue;
    if (!/^(?:dl|calc):/u.test(eveniment)) continue;
    const q = new URLSearchParams({ event: eveniment, propertyName: camp });
    const valori = await apiPoate(
      `/api/websites/${site}/event-data/values?${fereastra}&${q.toString()}`,
    );
    rezultat.push({
      eveniment,
      camp,
      valori: Array.isArray(valori)
        ? valori.map((v) => ({ valoare: String(v?.value ?? ""), numar: numar(v?.total) }))
        : [],
    });
  }
  return rezultat;
}

const fereastra = `startAt=${interval.de.getTime()}&endAt=${interval.pana.getTime()}`;
const evenimenteBrute = await api(
  `/api/websites/${site}/metrics?type=event&${fereastra}&limit=500`,
);
const cai = await api(
  `/api/websites/${site}/metrics?type=path&${fereastra}&country=eq.RO&limit=500`,
);
const evenimente = parseazaEvenimente(evenimenteBrute);

const slugs = new Set(evenimente.unelte.keys());
for (const { x } of cai) {
  const m = /^\/unelte\/([a-z0-9-]+)$/u.exec(x);
  if (m !== null) slugs.add(m[1]);
}

const vizitatori = new Map();
for (const slug of [...slugs].sort()) {
  const s = await api(
    `/api/websites/${site}/stats?${fereastra}&path=eq./unelte/${slug}&country=eq.RO`,
  );
  vizitatori.set(slug, numar(s.visitors));
}

const date = await dateEvenimente(fereastra);

if (arg.json) {
  const iesire = {
    eticheta: interval.eticheta,
    de: interval.de.toISOString(),
    pana: interval.pana.toISOString(),
    vizitatori: Object.fromEntries(vizitatori),
    evenimente: evenimenteBrute,
    date,
  };
  process.stdout.write(`${JSON.stringify(iesire, null, 2)}\n`);
} else {
  process.stdout.write(
    randeazaRaport({
      eticheta: interval.eticheta,
      de: interval.de,
      pana: interval.pana,
      vizitatori,
      evenimente,
    }) +
      "\n" +
      randeazaDate(date),
  );
}
