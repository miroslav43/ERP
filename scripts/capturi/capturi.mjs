#!/usr/bin/env node
/**
 * Capturi de ecran din aplicația reală, pentru paginile publice de prezentare.
 *
 * Produce fișierele din `public/capturi/`, pe care le arată `prin-geam.tsx` pe
 * `/module/<cheie>` și `in-mana.tsx` pe `/pontaj-pe-telefon`.
 *
 *   node scripts/capturi/capturi.mjs               # toate rutele din RUTE
 *   node scripts/capturi/capturi.mjs leave         # doar cheile date
 *
 * ── CE FACE, ȘI CE NU FACE ────────────────────────────────────────────────
 * Se autentifică pe producție cu conturile demonstrative — legate EXCLUSIV de
 * „Administrativo Demo SRL", o firmă cu date inventate. Navighează fiecare rută,
 * fotografiază fereastra, și scrie două lățimi WebP. Nu trimite niciun formular
 * și nu apasă niciun buton de scriere.
 *
 * NU folosi `demo_admin@gmail.com`: e administrator de PLATFORMĂ și vede firme
 * reale ale clienților. O captură de acolo ar publica date care nu sunt ale
 * noastre.
 *
 * ── DE CE TREI PROFILURI, NU UNUL ─────────────────────────────────────────
 * Viewport-ul, scara și cookie-ul de sesiune sunt proprietăți ale CONTEXTULUI,
 * nu ale paginii: nu se pot schimba între două `goto`-uri. Iar cele trei feluri
 * de captură cer lucruri incompatibile:
 *   · ecranele de birou — 1440×900, cont `org_admin`;
 *   · portalul — 390×844 la scara 3, și cont `employee`, fiindcă
 *     `(portal)/layout.tsx:57` refuză orice alt rol;
 *   · afișul cu cod QR — o foaie, nu o fereastră: 900×1200.
 * Deci trei contexte, fiecare cu autentificarea lui. Browserul rămâne unul.
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
 *   · `/ssm/instruiri` arată o matrice corectă, dar 30 din 32 de celule sunt
 *     roșii („Niciodată efectuată"). Corect ca produs, dezastruos ca reclamă.
 *   · `/portal/ponteaza/<cod>` afișează „Pontarea prin cod nu e activată" dacă
 *     `setari_pontare_rapida.mod_pontare_rapida` e `oprit` — ecran complet
 *     valid, care NU e gol și NU dă eroare. De-aia fiecare rută își declară
 *     `cere:`, un text care TREBUIE să apară: garda negativă (redirect, stare
 *     goală, cod HTTP) n-ar fi prins-o niciodată.
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
const PAROLA = process.env["PAROLA_CAPTURA"] ?? "12345678";
const IESIRE = "public/capturi";

/**
 * Codul de pontare al punctului de lucru demonstrativ și id-ul lui.
 *
 * Amândouă sunt scrise de `scripts/demo/populeaza.mjs`, etapa `puncteLucru`, cu
 * valori FIXE tocmai ca să poată fi scrise aici. Dacă etapa se rescrie cu un
 * cod generat, afișul tipărit și captura ies din sincron tăcut.
 */
const COD_PONTAJ = "demo-sediu-mare-cod-de-pontare";
const PUNCT_LUCRU = process.env["PUNCT_LUCRU"] ?? "";

/**
 * Profilurile de captură. `latimi` sunt lățimile fișierelor scrise pe disc și
 * TREBUIE să corespundă cataloagelor din `_componente/vitrine.ts`.
 */
const PROFILE = {
  birou: {
    cont: "demo_orgadmin@gmail.com",
    viewport: { width: 1440, height: 900 },
    scale: 2,
    latimi: [960, 1920],
  },
  telefon: {
    cont: "demo_employee@gmail.com",
    viewport: { width: 390, height: 844 },
    scale: 3,
    latimi: [390, 780],
  },
  hartie: {
    cont: "demo_orgadmin@gmail.com",
    viewport: { width: 900, height: 1200 },
    scale: 2,
    latimi: [600, 1200],
  },
};

/**
 * Cheia fișierului → ruta care o produce.
 *
 * `cere` e textul care dovedește că ecranul e CEL așteptat, nu doar unul care
 * a răspuns 200. Se caută în `main`, cu potrivire simplă de subșir.
 */
const RUTE = {
  nucleu: { profil: "birou", ruta: "/angajati", cere: "Angajați" },
  attendance: {
    profil: "birou",
    ruta: "/pontaj?an=2026&luna=8&vizualizare=luna",
    cere: "Pontaj",
  },
  leave: { profil: "birou", ruta: "/concedii/calendar", cere: "Calendarul de concedii" },
  // „Net de plată" e capul de tabel al fluturașilor — exact ce dispare tăcut
  // când perioada e ciornă. Un „Salarizare" din antet ar fi trecut peste asta.
  payroll: {
    profil: "birou",
    ruta: "/salarizare/44a8f5d4-c2c7-4f2f-ac5a-609817f33597",
    cere: "Net de plată",
  },
  rapoarte: { profil: "birou", ruta: "/rapoarte?an=2026", cere: "Rapoarte" },
  ssm: { profil: "birou", ruta: "/ssm/instruiri", cere: "Instruiri" },
  fleet: { profil: "birou", ruta: "/flota", cere: "Parc auto" },
  inventory: { profil: "birou", ruta: "/inventar", cere: "Inventar" },
  ticketing: { profil: "birou", ruta: "/ticketing/coada", cere: "Coada de tichete" },
  announcements: { profil: "birou", ruta: "/anunturi", cere: "Anunțuri" },
  courses: { profil: "birou", ruta: "/cursuri", cere: "Cursurile firmei" },
  onboarding: { profil: "birou", ruta: "/onboarding", cere: "Onboarding" },
  evaluations: { profil: "birou", ruta: "/evaluari", cere: "Evaluări" },
  // `/evaluari/kpi` filtrează IMPLICIT pe luna curentă, care are o singură
  // ciornă. Fără parametri, captura ar arăta un ecran aproape gol dintr-un
  // modul care are douăsprezece luni de date.
  kpi: { profil: "birou", ruta: "/evaluari/kpi?an=2026&luna=8", cere: "KPI lunar" },
  maintenance: { profil: "birou", ruta: "/mentenanta", cere: "Mentenanță" },
  per_diem: { profil: "birou", ruta: "/diurna", cere: "Deplasări" },

  // Portalul: rol `employee`, ecran de telefon.
  //
  // `golPermis`, fiindcă tabloul portalului e un teanc de carduri, iar unele au
  // voie să fie goale („Niciun anunț nou") fără ca ECRANUL să fie gol. Garda
  // negativă a fost scrisă pentru ecranele de modul, unde tot conținutul e o
  // listă; aici dădea alarmă falsă. Rămâne `cere`, care e oricum mai tare.
  //
  // `deruleaza`, fiindcă garda `cere` se uită în TEXTUL paginii, iar captura
  // fotografiază FEREASTRA. Pe telefon, cardul de pontare al portalului cade
  // sub prima fereastră, în spatele salutului și al cardului de concediu: prima
  // rulare a trecut garda cu un ecran în care butonul nu se vedea deloc.
  "portal-pontare": {
    profil: "telefon",
    ruta: "/portal",
    cere: "Am intrat",
    golPermis: true,
    deruleaza: "#azi",
  },
  "portal-scanare": {
    profil: "telefon",
    ruta: `/portal/ponteaza/${COD_PONTAJ}`,
    cere: "ați scanat codul",
  },

  // Afișul tipărit. Ruta cere id-ul punctului de lucru, dat prin `PUNCT_LUCRU`.
  "afis-pontare": {
    profil: "hartie",
    ruta: `/puncte-lucru/${PUNCT_LUCRU}/afis`,
    cere: "Scanați codul cu telefonul",
  },
};

/** Frazele cu care aplicația își anunță stările goale. */
const TIPAR_GOL = /Niciun |Nicio |Nu există |Nu aveți |nimic de afișat/i;

const cerute = process.argv.slice(2);
const lucru = Object.entries(RUTE).filter(([c]) => cerute.length === 0 || cerute.includes(c));
if (lucru.length === 0) {
  console.error(`Nicio cheie cunoscută. Disponibile: ${Object.keys(RUTE).join(", ")}`);
  process.exit(1);
}
if (lucru.some(([c]) => c === "afis-pontare") && PUNCT_LUCRU === "") {
  console.error("`afis-pontare` cere PUNCT_LUCRU=<id>. Îl scrie `populeaza.mjs puncteLucru`.");
  process.exit(1);
}

mkdirSync(IESIRE, { recursive: true });

const browser = await chromium.launch({ executablePath: EXEC, args: ["--no-sandbox"] });
let stricate = 0;

for (const [numeProfil, profil] of Object.entries(PROFILE)) {
  const aleMele = lucru.filter(([, f]) => f.profil === numeProfil);
  if (aleMele.length === 0) continue;

  console.log(`\n▸ ${numeProfil} — ${profil.cont} @ ${String(profil.viewport.width)}px`);
  const context = await browser.newContext({
    viewport: profil.viewport,
    deviceScaleFactor: profil.scale,
    locale: "ro-RO",
    timezoneId: "Europe/Bucharest",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();

  await page.goto(`${BAZA}/autentificare`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.fill("#email", profil.cont);
  await page.fill("#parola", PAROLA);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("autentificare"), { timeout: 45000 }),
    page.click('button[type="submit"]'),
  ]);

  for (const [cheie, fisa] of aleMele) {
    const erori = [];
    const asculta = (e) => erori.push(String(e).slice(0, 160));
    page.on("pageerror", asculta);

    try {
      // `domcontentloaded` la `goto`, `networkidle` separat și TOLERANT.
      // Cu `waitUntil: "networkidle"` direct, o pagină care ține o conexiune
      // deschisă — `/puncte-lucru/<id>/afis` o ține — face `goto` să arunce
      // după 60 s fără să fi fost nimic în neregulă cu ea: ecranul era desenat
      // de mult. Așteptarea de liniște devine astfel o optimizare, nu o
      // condiție.
      const raspuns = await page.goto(`${BAZA}${fisa.ruta}`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      // Lasă `Suspense` să se rezolve și fonturile să se așeze.
      await page.waitForTimeout(1800);

      // Un 404 randează o pagină întreagă, cu antet și meniu: garda de redirect
      // o lasă să treacă, iar cea de stare goală la fel. Codul HTTP e singurul
      // care o numește.
      const cod = raspuns === null ? 0 : raspuns.status();
      if (cod < 200 || cod >= 300) {
        console.error(`  ${cheie}: HTTP ${String(cod)} — se sare`);
        stricate += 1;
        continue;
      }

      const url = new URL(page.url());
      const ajuns = url.pathname + url.search;
      const text = await page
        .locator("main")
        .first()
        .innerText()
        .catch(() => "");

      // Un redirect tăcut e cea mai costisitoare greșeală de aici: captura ar
      // arăta ALT ecran, iar nimic n-ar semnala nepotrivirea.
      if (ajuns !== fisa.ruta) {
        console.error(`  ${cheie}: REDIRECT către ${ajuns} — se sare`);
        stricate += 1;
        continue;
      }
      if (fisa.golPermis !== true && TIPAR_GOL.test(text)) {
        console.error(`  ${cheie}: ecranul pare GOL — se sare`);
        stricate += 1;
        continue;
      }
      // Garda POZITIVĂ. Vezi antetul: un ecran corect, cu alt conținut decât
      // cel promis, trece de toate celelalte trei.
      if (!text.includes(fisa.cere)) {
        console.error(`  ${cheie}: lipsește „${fisa.cere}" din ecran — se sare`);
        stricate += 1;
        continue;
      }

      if (fisa.deruleaza !== undefined) {
        await page.locator(fisa.deruleaza).first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
      }

      const brut = await page.screenshot({ fullPage: false });
      for (const w of profil.latimi) {
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

  await context.close();
}

await browser.close();
if (stricate > 0) {
  console.error(
    `\n${String(stricate)} rute n-au produs captură. Fișierele vechi au rămas neatinse.`,
  );
  process.exit(1);
}
