#!/usr/bin/env node
/**
 * Capturile „model completat” ale uneltelor gratuite, în `public/capturi/unelte/`.
 *
 *   pnpm dev -H 127.0.0.1 -p 3917          # alt terminal
 *   node scripts/capturi/capturi-unelte.mjs
 *
 * ── CUM ȘTIE CE SĂ FOTOGRAFIEZE ───────────────────────────────────────────
 * Nu are listă proprie. Deschide hub-ul `/unelte`, intră în fiecare unealtă și
 * caută banda `ExempluCompletat` (`figure[data-exemplu]`): de acolo ia adresa
 * exemplului și numele celor două fișiere. Exemplele stau într-un singur loc,
 * `src/content/landing/exemple-unelte.ts`.
 *
 * ── DE CE LOCAL ───────────────────────────────────────────────────────────
 * Previzualizarea e HTML randat pe server; `next dev` îl dă corect, chiar dacă
 * nu hidratează (memoria `erp-next-dev-nu-hidrateaza`). Pe producție imaginea
 * n-ar exista încă la primul deploy al paginii care o cere.
 *
 * Imaginea e pătrată, 1200 și 600 px, cu documentul încadrat pe alb: aceleași
 * dimensiuni pe care pagina le declară în `width`/`height`, deci fără salt de
 * aranjare.
 */
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";

import { chromium } from "@playwright/test";

// Ca în `capturi.mjs`: `sharp` vine cu Next, rezolvat din pachetul care îl declară.
const sharp = createRequire(import.meta.resolve("next"))("sharp");

const EXEC =
  process.env["CHROMIUM"] ??
  `${process.env["HOME"] ?? ""}/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell`;
const BAZA = process.env["BAZA"] ?? "http://127.0.0.1:3917";
const LATURA = 1200;

// Bara de cookie-uri e `fixed`: o captură de element ia pixelii din dreptunghiul
// lui, deci și bara, dacă se suprapune. Alegerea salvată o ține ascunsă (K13 o
// randează pe server), iar `style` o scoate oricum din captură.
// Antetul sitului e `sticky`: la un document mai înalt decât fereastra (fișa SSM,
// fișa de evaluare), Playwright derulează și antetul acoperă capul documentului
// (văzut la prima rulare, 9 oct 2026). `static` îl lasă sus, în afara foii.
const FARA_BARA = [
  '[aria-label="Cookie-uri de analiză"] { display: none !important; }',
  "header.sticky { position: static !important; }",
].join("\n");

const browser = await chromium.launch({ executablePath: EXEC });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
});
await context.addInitScript(() => {
  try {
    localStorage.setItem("adm-consimtamant", "refuzat");
  } catch {
    /* stocare blocată: rămâne `style` */
  }
});
const pagina = await context.newPage();

await pagina.goto(`${BAZA}/unelte`, { waitUntil: "networkidle" });
const unelte = [
  ...new Set(
    await pagina.$$eval('a[href^="/unelte/"]', (legaturi) =>
      legaturi
        .map((a) => a.getAttribute("href") ?? "")
        .filter((h) => /^\/unelte\/[a-z-]+$/u.test(h)),
    ),
  ),
];

let facute = 0;
for (const cale of unelte) {
  await pagina.goto(`${BAZA}${cale}`, { waitUntil: "networkidle" });
  const figura = await pagina.$("figure[data-exemplu]");
  if (figura === null) continue;
  const { adresa, mare, mic } = await figura.evaluate((f) => ({
    adresa: f.querySelector("a[data-exemplu-adresa]")?.getAttribute("href") ?? "",
    mare: f.querySelector("img")?.getAttribute("src") ?? "",
    mic: f.getAttribute("data-exemplu-mic") ?? "",
  }));
  if (adresa === "" || mare === "" || mic === "") {
    throw new Error(`${cale}: banda exemplului e incompletă.`);
  }

  await pagina.goto(`${BAZA}${adresa}`, { waitUntil: "networkidle" });
  const foaie = await pagina.$("#documentul figure.mk-foaie");
  if (foaie === null) {
    throw new Error(`${cale}: exemplul nu are previzualizare (#documentul figure.mk-foaie).`);
  }
  const png = await foaie.screenshot({ type: "png", style: FARA_BARA });

  for (const [tinta, latura] of [
    [mare, LATURA],
    [mic, LATURA / 2],
  ]) {
    const iesire = `public${tinta}`;
    mkdirSync(dirname(iesire), { recursive: true });
    await sharp(png)
      .resize(latura, latura, { fit: "contain", background: "#ffffff" })
      .webp({ quality: 82 })
      .toFile(iesire);
    console.log(iesire);
  }
  facute += 1;
}

await browser.close();
if (facute === 0) {
  console.error("Nicio bandă de exemplu găsită. Rulează `pnpm dev` la BAZA?");
  process.exit(1);
}
