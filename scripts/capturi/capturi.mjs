#!/usr/bin/env node
/**
 * Capturi de ecran din aplicația reală, pentru paginile publice de prezentare.
 *
 * Produce fișierele din `public/capturi/`, pe care banda „Ecran real" din
 * `src/app/(marketing)/_componente/prin-geam.tsx` le arată pe `/module/<cheie>`.
 *
 *   node scripts/capturi/capturi.mjs            # toate rutele din RUTE
 *   node scripts/capturi/capturi.mjs leave      # doar cheile date
 *
 * ── CE FACE, ȘI CE NU FACE ────────────────────────────────────────────────
 * Se autentifică O SINGURĂ DATĂ pe producție, ca `demo_orgadmin@gmail.com` —
 * cont legat EXCLUSIV de „Administrativo Demo SRL", o firmă cu date inventate.
 * Navighează apoi fiecare rută, fotografiază fereastra, și scrie două lățimi
 * WebP. Nu trimite niciun formular și nu apasă niciun buton de scriere.
 *
 * NU folosi `demo_admin@gmail.com`: e administrator de PLATFORMĂ și vede firme
 * reale ale clienților. O captură de acolo ar publica date care nu sunt ale
 * noastre.
 *
 * ── DE CE NU SUNT TOATE MODULELE AICI ─────────────────────────────────────
 * Fiindcă firma demonstrativă e goală pentru paisprezece dintre ele. O captură
 * a unei stări goale („0 / 0", „Niciun element înregistrat") vinde mai prost
 * decât nicio captură, iar una cu date de test — un obiect numit „Laptop Dell
 * VERIFICARE", o deplasare numită „Verificare adversa - audit" — ar ajunge pe o
 * pagină publică arătând ca o scăpare. Lista crește când firma capătă date, nu
 * când cineva mai scrie cod.
 *
 * ── CAPCANE PLĂTITE, NU IPOTEZE ───────────────────────────────────────────
 *   · `/pontaj` fără parametri cade pe luna curentă, aproape goală. Cu
 *     `vizualizare=lista` iese un zid de avertismente „Luna depășește regulile
 *     firmei", fiindcă firma demo are maximul pe 20 h/săptămână. Vederea
 *     `luna` e singura care arată produsul, nu plângerile lui.
 *   · `/concedii` fără parametri redirectează spre calendar (`page.tsx:98`).
 *   · `/concedii/echipa` EXCLUDE fișa contului conectat — dacă cineva schimbă
 *     contul de captură pe cel al angajatului cu cereri, tabelul iese gol deși
 *     baza are opt rânduri.
 *   · `/salarizare/[id]` cere un UUID care există ȘI e aprobat; pe „ciornă",
 *     tabelul nu se mai cheamă deloc și ecranul se golește tăcut.
 *   · `/portal/**` e inaccesibil oricărui rol != `employee`
 *     (`(portal)/layout.tsx:57`): scriptul ar captura tabloul de bord de
 *     administrare crezând că a capturat portalul.
 *   · `/ssm/instruiri` arată o matrice corectă, dar 30 din 32 de celule sunt
 *     roșii („Niciodată efectuată"). Corect ca produs, dezastruos ca reclamă.
 */
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

// `@playwright/test`, nu `playwright-core`: pnpm nu expune dependențele
// tranzitive, iar `@playwright/test` e singurul dintre ele declarat în
// `package.json`. Reexportă aceleași lansatoare de browser.
import { chromium } from "@playwright/test";

// `sharp` vine cu Next, dar tot ca dependență tranzitivă — deci se rezolvă
// pornind din pachetul care ÎL declară. Alternativa ar fi fost să-l adaug în
// `package.json`, adică să ating `pnpm-lock.yaml`: fișierul cel mai periculos
// de atins într-un repo lucrat de mai multe sesiuni deodată.
const sharp = createRequire(import.meta.resolve("next"))("sharp");

const EXEC =
  process.env["CHROMIUM"] ??
  `${process.env["HOME"] ?? ""}/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell`;
const BAZA = process.env["BAZA"] ?? "https://administrativo.ro";
const CONT = process.env["CONT_CAPTURA"] ?? "demo_orgadmin@gmail.com";
const PAROLA = process.env["PAROLA_CAPTURA"] ?? "12345678";
const IESIRE = "public/capturi";

/** Lățimile din `srcset`. Pe telefon se descarcă prima, de vreo trei ori mai ușoară. */
const LATIMI = [960, 1920];

/** Cheia de modul → ruta care îl reprezintă cel mai bine. */
const RUTE = {
  nucleu: "/angajati",
  attendance: "/pontaj?an=2026&luna=8&vizualizare=luna",
  leave: "/concedii/calendar",
  payroll: "/salarizare/44a8f5d4-c2c7-4f2f-ac5a-609817f33597",
  rapoarte: "/rapoarte?an=2026",
};

/** Frazele cu care aplicația își anunță stările goale. */
const TIPAR_GOL = /Niciun |Nicio |Nu există |Nu aveți |nimic de afișat/i;

const cerute = process.argv.slice(2);
const lucru = Object.entries(RUTE).filter(([c]) => cerute.length === 0 || cerute.includes(c));
if (lucru.length === 0) {
  console.error(`Nicio cheie cunoscută. Disponibile: ${Object.keys(RUTE).join(", ")}`);
  process.exit(1);
}

mkdirSync(IESIRE, { recursive: true });

const browser = await chromium.launch({ executablePath: EXEC, args: ["--no-sandbox"] });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: "ro-RO",
  timezoneId: "Europe/Bucharest",
  reducedMotion: "reduce",
});
const page = await context.newPage();

await page.goto(`${BAZA}/autentificare`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.fill("#email", CONT);
await page.fill("#parola", PAROLA);
await Promise.all([
  page.waitForURL((u) => !u.pathname.includes("autentificare"), { timeout: 45000 }),
  page.click('button[type="submit"]'),
]);

let stricate = 0;

for (const [cheie, ruta] of lucru) {
  const erori = [];
  const asculta = (e) => erori.push(String(e).slice(0, 160));
  page.on("pageerror", asculta);

  try {
    await page.goto(`${BAZA}${ruta}`, { waitUntil: "networkidle", timeout: 60000 });
    // Lasă `Suspense` să se rezolve și fonturile să se așeze.
    await page.waitForTimeout(1800);

    const url = new URL(page.url());
    const ajuns = url.pathname + url.search;
    const text = await page
      .locator("main")
      .first()
      .innerText()
      .catch(() => "");

    // Un redirect tăcut e cea mai costisitoare greșeală de aici: captura ar
    // arăta ALT ecran, iar nimic n-ar semnala nepotrivirea.
    if (ajuns !== ruta) {
      console.error(`  ${cheie}: REDIRECT către ${ajuns} — se sare`);
      stricate += 1;
      continue;
    }
    if (TIPAR_GOL.test(text)) {
      console.error(`  ${cheie}: ecranul pare GOL — se sare`);
      stricate += 1;
      continue;
    }

    const brut = await page.screenshot({ fullPage: false });
    for (const w of LATIMI) {
      const info = await sharp(brut)
        .resize({ width: w })
        .webp({ quality: 80 })
        .toFile(`${IESIRE}/${cheie}-${String(w)}.webp`);
      console.log(`  ${cheie}-${String(w)}.webp  ${String(Math.round(info.size / 1024))} KB`);
    }
    if (erori.length > 0) console.error(`  ${cheie}: ${String(erori.length)} erori de pagină`);
  } catch (e) {
    console.error(`  ${cheie}: EȘEC — ${String(e).slice(0, 160)}`);
    stricate += 1;
  } finally {
    page.off("pageerror", asculta);
  }
}

await browser.close();
if (stricate > 0) {
  console.error(`\n${String(stricate)} rute n-au produs captură. Fișierele vechi au rămas neatinse.`);
  process.exit(1);
}
