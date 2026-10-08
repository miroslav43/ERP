## A. Confidențialitate: datele din formulare nu mai pleacă la terți

**Scop:** ce scrie un vizitator într-o unealtă gratuită (nume de angajați, firmă, șofer, salariu) să nu mai ajungă la Google Analytics, în Umami, în jurnalele nginx sau într-un cache comun, iar ce promite pagina `/unelte` și politica de confidențialitate să fie exact adevărat.

**De ce:** auditul live din 8 oct 2026 (agentul transversal, confirmat adversarial) a scris „Zzsecret Popescu” în foaia de pontaj și a găsit numele:

- la **Google Analytics**, în `dl=` pe `page_view`, `click`, `scroll` și `user_engagement`, **fără consimțământ** (`gcs=G100`). Cauza: `src/app/(marketing)/_componente/analitice.tsx:67` face `gtag('config', ID)` cu adresa brută;
- la **Umami**, în `url` și `referrer`, pe `pageview` și `performance`. Cauza: `ScriptUmami` (`analitice.tsx:111-123`) nu are `data-exclude-search`;
- în **jurnalele nginx**: `deploy/nginx/30-administrativo.ro.conf:55` scrie `"$request"`, adică adresa cu tot cu query, în `/var/log/nginx/administrativo.log` și în jurnalul docker al edge-ului (`:153-154`). Am numărat azi, cu `grep` în container, **1 792 de rânduri** cu query pe `/unelte` în `administrativo.log`, dintre care **264** cu câmpuri de nume (`angajati=`, `salariat=`, `sofer=`, `nume=`, `firma=`, `angajator=`). Formatul `main` al edge-ului scrie și `$http_referer`, iar referer-ul cererilor din aceeași origine poartă adresa completă a uneltei;
- în **error_log**: am pornit un nginx efemer cu vhost-ul din repo. La un 502 scrie `request: "GET /unelte/foaie-de-pontaj?…angajati=Zzjurnal…"` și `referrer: "…?firma=…"`. În proba mea au ieșit 11 marcaje în jurnalul docker și 3 în `administrativo.log`.

Am rulat pe producție prototipul porții live din A1. Cererile spre colectoare au fost anulate, deci nu s-a numărat nimic. Rezultat: **14 din 14 scenarii au căzut** (7 unelte × fără/cu consimțământ). Peste asta, **13 antete sunt greșite**: 6 descărcări vin cu `cache-control: public, max-age=3600`, iar cele 7 pagini cu `referrer-policy: strict-origin-when-cross-origin`. La fiecare scenariu au plecat între 136 și 214 cereri spre același server, toate cu `Referer` care conține valorile. Promisiunea de pe hub (`src/app/(marketing)/unelte/page.tsx`: „niciuna nu reține ce scrii”, plus titlul benzii „fără să rețină ceva”) e falsă. `src/content/legal/confidentialitate.ts` nu pomenește nici uneltele, nici jurnalul de acces.

**Decizii luate**

1. **Rămânem pe GET.** O adresă care se poate pune la favorite e o funcție declarată a uneltei („revii la aceeași configurație”). Am respins POST din trei motive: rupe favoritele și linkul trimis colegului, cere rescrierea a 7 formulare și a butoanelor `formAction`, iar corpul tot trece prin Cloudflare. Curățăm deci tot ce pleacă din adresă, iar politica spune cinstit că adresa rămâne în browser.
2. **Listă albă, nu listă neagră.** Spre statistici pleacă din query doar `utm_source|utm_medium|utm_campaign|utm_term|utm_content` și `m` (marcajul `?m=<timestamp>` cu care auditurile noastre se recunosc în Umami). Orice câmp nou al unei unelte noi e tăiat automat. Un test citește câmpurile celor 8 pagini `page.tsx` din `/unelte` (26 de nume azi) și cade dacă vreunul ar purta un nume păstrat.

   Identificatorii de clic ai reclamelor (`gclid`, `gbraid`, `wbraid`, `dclid`, `_gl`, `fbclid`, `msclkid`, în `PARAMETRI_RECLAMA`) NU închid poarta GA de la punctul 3. Fără excepția asta, orice vizită dintr-o reclamă Google Ads (`?gclid=…`) ar fi rămas complet în afara GA, iar campaniile recomandate în `docs/comercial/refacere-site-2026-10-06.md` n-ar fi avut cum să-și lege conversiile. Spre Umami nu pleacă: acolo trec doar `utm_*` și `m`. (Adăugat la verificarea planului; varianta inițială ar fi tăcut GA pe orice `?gclid=`.)
3. **GA4: poartă, nu curățare.** Un document a cărui adresă poartă măcar un parametru din afara listei albe (și din afara identificatorilor de reclamă, `PARAMETRI_RECLAMA`) nu configurează deloc GA, cât trăiește documentul. Am mutat `js` + `config` din scriptul inline `ga-pornire` într-un client component, `PornireGa`. Dacă componenta nu rulează, GA nu trimite nimic (sistemul se închide la eroare). Am ales poarta în locul lui `page_location` curățat din trei motive:
   - nu depindem de felul nedocumentat în care gtag completează `dl`/`dr` la navigările din istorie;
   - în proiect, GA e oricum „sub consimțământ, nu-l folosi pentru cifre” (memoria `erp-analitice-fapte-verificate`);
   - setările din GA4 Admin (`dataRedactionSettings`, `pageChangesEnabled`) există în Admin API v1alpha, verificat în documentul de discovery, dar cer `analytics.edit`, iar robotul `claude-seo@…` are doar rol de Vizualizator. În plus, nu sunt versionate și nu se pot testa în repo.

   `page_referrer` se curăță doar când `document.referrer` poartă date.
4. **Umami: `data-exclude-search="true"` + `data-before-send`.** Am citit sursa `analitice.administrativo.ro/script.js` (Umami 3.3.1): `exclude-search` taie `search` din `url` ȘI din `referrer` în funcția internă `B()`, înaintea oricărei trimiteri. `before-send` e căutat ca `window[nume]` la fiecare trimitere, inclusiv la `track(fn)` și la `performance`. Așadar Umami taie singur, iar funcția noastră doar readaugă UTM-ul paginii curente. Dacă funcția lipsește, se pierd doar UTM-urile, nu se scurge nimic.
5. **nginx: hărți `map`, nu `location` cu `add_header`.** Se aplică trei hărți:
   - `$adm_cerere_jurnal` scrie pe `/unelte*` și `/api/unelte*` doar calea, plus `?format=` pe descărcări, pentru numărătoare. Restul sitului își păstrează query-ul;
   - `$adm_referer_jurnal` taie query-ul din referer pe tot situl;
   - `$adm_politica_referrer` dă `Referrer-Policy: strict-origin` pe `/unelte*` și lasă `strict-origin-when-cross-origin` în rest. Antetul rămâne declarat o singură dată, la nivel de `server` („regula de aur” din fișier).

   Avem nevoie de `Referrer-Policy` deși Referer-ul spre terți e deja doar originea. Proba efemeră a arătat că referer-ul complet al cererilor din aceeași origine (CSS, JS, RSC, descărcarea) ajunge în `error_log`, iar acolo formatul nu se poate configura. În plus, o `location ~ ^/(?:api/)?unelte(?:/|$)` cu `error_log stderr crit` scoate cererile uneltelor din jurnalul de erori. Toate cele 4 nume `adm_*` sunt libere în `/srv/apps/Strawboss/nginx/conf.d/*.conf` (verificat cu `grep`).
6. **Descărcările: `cache-control: private, no-store`**, ca paginile, care au deja `private, no-store`. Valoarea stă într-o constantă exportată din `src/lib/unelte/raspuns.ts`. O folosește și ruta Excel a foii de pontaj, care avea o a doua copie a antetului.
7. **Trei porți, fiecare pentru ce vede:**
   - **teste de unitate** pentru funcțiile pure și pentru structura componentelor (rulează în `pnpm test`);
   - **`scripts/checks/nginx-jurnale-unelte.sh`**, un nginx efemer din imaginea EXACTĂ a edge-ului (ID-ul din `docker inspect strawboss-nginx-1`, nu eticheta `nginx:alpine`, care se mută la `docker pull`). Prototipul a trecut verificat de la roșu (8 căderi) la verde (10/10), și pe nginx/1.29.7 al edge-ului;
   - **`scripts/checks/unelte-fara-scurgeri.mjs`**, playwright pe situl viu, cu colectoarele anulate. Prototipul e roșu azi pe producție, cu numere nevide.

   Poarta live cere și cereri văzute, nu doar zero scurgeri (memoria „workflow verde prin sărire”).
8. **Datele vechi** (jurnalele existente, rândurile din Umami, GA4) nu se șterg din plan fără decizia utilizatorului. Taskul A9 e scris complet, dar e blocat pe răspuns: ștergerea e ireversibilă și atinge infrastructură partajată.

**Harta fișierelor**

| Fișier | Responsabilitate | Task |
| --- | --- | --- |
| `scripts/checks/unelte-fara-scurgeri.mjs` (Create) | Poarta live: GA, Umami, Referer, antete de cache și de referrer | A1 |
| `src/app/(marketing)/_componente/adresa-analitice.ts` (Create) | Lista albă, `PARAMETRI_RECLAMA`, `adresaCurata`, `areDateDeFormular`, `cuParametriiPastrati`, `pregatestePentruUmami`, `FUNCTIE_UMAMI` | A2 |
| `src/app/(marketing)/_componente/adresa-analitice.test.ts` (Create) | Teste pure + paza numelor de câmpuri + paza rescrierii adresei din client | A2 |
| `src/app/(marketing)/_componente/pornire-ga.tsx` (Create) | `js`/`config` GA cu poarta „fără date de formular” | A3 |
| `src/app/(marketing)/_componente/pornire-ga.test.tsx` (Create) | Testele porții GA (happy-dom) | A3 |
| `src/app/(marketing)/_componente/analitice.tsx` (Modify) | Scoate `PORNIRE_GA`/`ga-pornire`, montează `PornireGa`; `ScriptUmami` cu `exclude-search`, `before-send`, `PregatireUmami` | A3, A4 |
| `src/app/(marketing)/_componente/analitice.test.ts` (Create) | Structura `Analitice` și `ScriptUmami` | A3, A4 |
| `src/app/(marketing)/_componente/pregatire-umami.tsx` (Create) | Funcția globală din `data-before-send` | A4 |
| `src/app/(marketing)/_componente/pregatire-umami.test.tsx` (Create) | Testul funcției globale | A4 |
| `src/lib/unelte/raspuns.ts` (Modify) | `ANTET_CACHE_DESCARCARE = "private, no-store"` | A5 |
| `src/lib/unelte/randari.test.ts` (Modify) | Antetul de cache al răspunsului comun + paza pe toate rutele de unelte | A5 |
| `src/app/api/unelte/foaie-de-pontaj/route.ts` (Modify) | Excel-ul folosește constanta | A5 |
| `src/app/api/unelte/foaie-de-pontaj/route.test.ts` (Create) | Antetul pe xlsx și pdf | A5 |
| `src/app/api/unelte/[unealta]/route.test.ts` (Modify) | Antetul pe ruta comună | A5 |
| `deploy/nginx/30-administrativo.ro.conf` (Modify) | Hărți, `adm_main`, `durate` fără query, Referrer-Policy, `error_log crit` pe unelte | A6 |
| `deploy/nginx/32-staging.administrativo.ro.conf` (Modify) | `adm_main` și Referrer-Policy pe staging | A6 |
| `scripts/checks/nginx-jurnale-unelte.sh` (Create) | Poarta locală nginx (container efemer) | A6 |
| `src/app/(marketing)/unelte/page.tsx` (Modify) | Promisiunea reformulată exact + legătura spre politică | A7 |
| `src/content/legal/confidentialitate.ts` (Modify) | Uneltele, jurnalul de acces, temeiul, excepția GA, Umami fără valori | A7 |
| `src/content/legal/confidentialitate.test.ts` (Create) | Politica și hub-ul spun ce trebuie | A7 |
| `src/content/landing/harta.ts` (Modify) | `actualizat` pe `/unelte` și `/legal/confidentialitate` | A7 |
| — | Deploy staging → producție, poarta live, verificare la 360 px | A8 |
| — (condiționat) | Curățarea datelor vechi | A9 |

Formatarea: codul din plan e scris pentru `printWidth: 100`. Dacă `prettier --check` cade pe un fișier al taskului, se rulează `pnpm exec prettier --write` pe același fișier, se reverifică testele și abia apoi se comite. Nu se schimbă nimic altceva.

Ordinea contează. Textele (A7) spun că jurnalele sunt curate, deci nginx (A6) se instalează înaintea deploy-ului care le publică (A8). Push-ul nu face deploy (memoria `erp-deploy-productie`), așa că A2–A7 se pot comite oricând.

---

### Task A1: poarta live — ce scrii nu pleacă la statistici

**Fișiere:**
- Create: `scripts/checks/unelte-fara-scurgeri.mjs`
- Test: scriptul însuși (rulează pe situl viu; nu intră în `pnpm test`)

**Interfețe:**
- Consumă: `chromium` din `@playwright/test` (singurul pachet playwright declarat în `package.json`; același tipar ca `scripts/capturi/capturi.mjs:56`), `headless_shell` din `~/.cache/ms-playwright/chromium_headless_shell-1148`.
- Produce: `node scripts/checks/unelte-fara-scurgeri.mjs [baza]` → cod 0 dacă toate cele 14 scenarii sunt curate și cele 13 antete sunt corecte, altfel cod 1 cu lista problemelor. Variabila `ADM_AUTENTIFICARE_BASIC` e citită pentru staging.

- [ ] **Pasul 1: Scrie testul care pică** — `scripts/checks/unelte-fara-scurgeri.mjs`:

```js
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
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând** (pe producție; cererile spre colectoare sunt anulate, deci nimic nu ajunge în statistici):

```bash
cd /srv/apps/ERP && node scripts/checks/unelte-fara-scurgeri.mjs; echo "cod=$?"
```

Eșecul așteptat, reprodus de prototip pe 8 oct 2026:
- 6 rânduri `✗ /api/unelte/… — 200, cache-control: public, max-age=3600`;
- 7 rânduri `✗ /unelte/… — referrer-policy: strict-origin-when-cross-origin`;
- 14 rânduri `✗ /unelte/… — GA 1+N, Umami 1+N, Referer 1xx` cu `SCURGERE ga (trimisa)`, `SCURGERE umami (trimisa)`, `SCURGERE Referer (trimisa)` și `după trimitere au plecat N cereri GA`;
- ultima linie `unelte-fara-scurgeri: 14 din 14 scenarii au căzut, 13 antete greșite.`, apoi `cod=1`.

Dacă în schimb apare „verificare vidă”, scriptul nu vede colectoarele și trebuie reparat înainte de orice altceva.

Verificatorul planului a rulat versiunea de mai sus (cu `waitForURL`) pe producție, pe 8 oct 2026: exact rezultatul descris, în 3 min 18 s. Contorul GA de după trimitere a scăzut cu 1 față de prototip (5→4 fără consimțământ, 4→3 cu Accept): `user_engagement`-ul documentului curat, numărat greșit de prototip ca „trimisa”, cade acum în „completare”. Cu prototipul (`waitForLoadState`, care se rezolvă imediat pe documentul deja încărcat), cererea aceea, curată, ar fi declanșat „după trimitere au plecat 1 cereri GA” și după reparație — un roșu fals, în funcție de cursa dintre clic și descărcarea documentului.
- [ ] **Pasul 3: Implementarea minimă** — nu există cod de produs în taskul ăsta: poarta trebuie să rămână roșie până la A8.
- [ ] **Pasul 4: Verificări**

```bash
cd /srv/apps/ERP && node --check scripts/checks/unelte-fara-scurgeri.mjs && pnpm exec eslint scripts/checks/unelte-fara-scurgeri.mjs && pnpm exec prettier --check scripts/checks/unelte-fara-scurgeri.mjs
```

- [ ] **Commit**

```bash
cd /srv/apps/ERP
git status --short -- scripts/checks/unelte-fara-scurgeri.mjs
git fetch origin main
git diff --name-only HEAD origin/main
git add -- scripts/checks/unelte-fara-scurgeri.mjs
git commit --only -m "test(unelte): poarta live — ce scrii într-o unealtă nu pleacă la statistici

Roșie pe producție la scriere (14/14 scenarii, 13 antete): numele ajung la
GA (și fără consimțământ), la Umami și în Referer. Colectoarele sunt anulate,
deci rularea nu se numără.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- scripts/checks/unelte-fara-scurgeri.mjs
git merge origin/main
git push origin main
```

---

### Task A2: adresa fără valorile din formular

**Fișiere:**
- Create: `src/app/(marketing)/_componente/adresa-analitice.ts`
- Test: `src/app/(marketing)/_componente/adresa-analitice.test.ts` (proiectul `unit`, `environment: "node"`)

**Interfețe:**
- Consumă: `URL`, `URLSearchParams` (globale în Node 20 și în browser); `node:fs`/`node:path` doar în test.
- Produce:

```ts
export const PARAMETRI_PASTRATI: ReadonlySet<string>;
export const PARAMETRI_RECLAMA: ReadonlySet<string>;
export const FUNCTIE_UMAMI: "admUmamiInainteDeTrimitere";
export type PayloadUmami = Readonly<Record<string, unknown>>;
export function adresaCurata(adresa: string): string;
export function areDateDeFormular(adresa: string): boolean;
export function cuParametriiPastrati(adresa: string, adresaCurenta: string): string;
export function pregatestePentruUmami(payload: PayloadUmami, adresaCurenta: string): PayloadUmami;
```

- [ ] **Pasul 1: Scrie testul care pică** — `src/app/(marketing)/_componente/adresa-analitice.test.ts`:

```ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  FUNCTIE_UMAMI,
  PARAMETRI_PASTRATI,
  PARAMETRI_RECLAMA,
  adresaCurata,
  areDateDeFormular,
  cuParametriiPastrati,
  pregatestePentruUmami,
} from "./adresa-analitice";

const PONTAJ =
  "https://administrativo.ro/unelte/foaie-de-pontaj?luna=10&an=2026&angajati=Zzsecret+Popescu%0D%0AZzsecret+Ionescu&utm_source=fisier#documentul";

describe("adresaCurata", () => {
  it("taie valorile din formular și fragmentul, păstrează campania", () => {
    expect(adresaCurata(PONTAJ)).toBe(
      "https://administrativo.ro/unelte/foaie-de-pontaj?utm_source=fisier",
    );
  });

  it("o cale relativă rămâne relativă", () => {
    expect(adresaCurata("/unelte/condica-de-prezenta?firma=Zzsecret&m=1728")).toBe(
      "/unelte/condica-de-prezenta?m=1728",
    );
  });

  it("fără parametri permiși dispare și semnul întrebării", () => {
    expect(adresaCurata("https://administrativo.ro/unelte/fisa-evaluare?nume=Zzsecret")).toBe(
      "https://administrativo.ro/unelte/fisa-evaluare",
    );
  });

  it("șirul gol și adresa de necitit dau șir gol, nu adresa brută", () => {
    expect(adresaCurata("")).toBe("");
    expect(adresaCurata("http://[::1/unelte?nume=Zzsecret")).toBe("");
  });

  it("identificatorul de clic al reclamei nu pleacă spre Umami", () => {
    expect(adresaCurata("https://administrativo.ro/preturi?gclid=abc&utm_source=google")).toBe(
      "https://administrativo.ro/preturi?utm_source=google",
    );
  });

  it("o sursă externă fără parametri trece neschimbată", () => {
    expect(adresaCurata("https://www.google.com/")).toBe("https://www.google.com/");
  });
});

describe("areDateDeFormular", () => {
  it("valorile unei unelte înseamnă date", () => {
    expect(areDateDeFormular(PONTAJ)).toBe(true);
    expect(areDateDeFormular("https://administrativo.ro/unelte/calculator-salariu?suma=5000")).toBe(
      true,
    );
  });

  it("doar campanie și marcaj de audit nu înseamnă date", () => {
    expect(areDateDeFormular("https://administrativo.ro/unelte?utm_source=fisier&m=1")).toBe(false);
    expect(areDateDeFormular("https://administrativo.ro/unelte/foaie-de-pontaj")).toBe(false);
    expect(areDateDeFormular("")).toBe(false);
  });

  it("identificatorii de clic ai reclamelor nu închid poarta, valorile da", () => {
    expect(areDateDeFormular("https://administrativo.ro/unelte/foaie-de-pontaj?gclid=abc")).toBe(
      false,
    );
    expect(areDateDeFormular("https://administrativo.ro/?gclid=abc&angajati=Zzsecret")).toBe(true);
  });

  it("o adresă de necitit închide poarta", () => {
    expect(areDateDeFormular("http://[::1/unelte?nume=Zzsecret")).toBe(true);
  });
});

describe("cuParametriiPastrati", () => {
  it("readaugă campania paginii curente, fără valorile din formular", () => {
    expect(
      cuParametriiPastrati(
        "https://administrativo.ro/unelte/foaie-de-pontaj",
        "https://administrativo.ro/unelte/foaie-de-pontaj?utm_source=fisier&angajati=Zzsecret",
      ),
    ).toBe("https://administrativo.ro/unelte/foaie-de-pontaj?utm_source=fisier");
  });

  it("nu mută campania pe altă pagină", () => {
    expect(cuParametriiPastrati("/preturi", "https://administrativo.ro/module?utm_source=x")).toBe(
      "/preturi",
    );
  });

  it("fără campanie pe pagina curentă, adresa rămâne cum era", () => {
    expect(
      cuParametriiPastrati(
        "https://administrativo.ro/preturi",
        "https://administrativo.ro/preturi?nume=Zzsecret",
      ),
    ).toBe("https://administrativo.ro/preturi");
  });
});

describe("pregatestePentruUmami", () => {
  it("niciun câmp trimis nu mai conține valorile, iar restul trec neatinse", () => {
    const rezultat = pregatestePentruUmami(
      {
        website: "id",
        url: PONTAJ,
        referrer: "/unelte/condica-de-prezenta?firma=Zzsecret",
        name: "foaie-pdf",
      },
      PONTAJ,
    );
    expect(rezultat).toEqual({
      website: "id",
      url: "https://administrativo.ro/unelte/foaie-de-pontaj?utm_source=fisier",
      referrer: "/unelte/condica-de-prezenta",
      name: "foaie-pdf",
    });
    expect(JSON.stringify(rezultat)).not.toContain("Zzsecret");
  });

  it("un corp fără url și referrer trece neschimbat", () => {
    expect(pregatestePentruUmami({ website: "id", data: { secunde: 4 } }, PONTAJ)).toEqual({
      website: "id",
      data: { secunde: 4 },
    });
  });

  it("numele funcției globale e un identificator valid", () => {
    expect(FUNCTIE_UMAMI).toMatch(/^[A-Za-z_$][\w$]*$/u);
  });
});

/**
 * Paza listei albe și a porții GA, citite direct din paginile uneltelor:
 * `name="…"` în JSX și `nume: "…"` în listele de câmpuri.
 */
describe("paginile uneltelor", () => {
  const RADACINA = "src/app/(marketing)/unelte";
  const pagini = readdirSync(RADACINA, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"))
    .map((f) => readFileSync(join(RADACINA, f), "utf8"));
  // `(?:async )?`: cele șapte unelte sunt `export default async function`
  // (citesc `searchParams`); fără el, doar hub-ul s-ar număra (1 < 8).
  const surseDePagina = pagini.filter((s) => /export default (?:async )?function/u.test(s));
  const nume = new Set(
    pagini.flatMap((sursa) => [
      ...[...sursa.matchAll(/\bname="([a-z_]+)"/gu)].map((m) => m[1] ?? ""),
      ...[...sursa.matchAll(/\bnume: "([a-z_]+)"/gu)].map((m) => m[1] ?? ""),
    ]),
  );

  it("scanarea găsește câmpurile (altfel testul ar trece gol)", () => {
    expect(surseDePagina.length).toBeGreaterThanOrEqual(8);
    expect(nume.size).toBeGreaterThanOrEqual(20);
    expect(nume).toContain("angajati");
    expect(nume).toContain("sofer");
  });

  it("niciun câmp nu poartă numele unui parametru păstrat", () => {
    expect([...nume].filter((n) => PARAMETRI_PASTRATI.has(n) || PARAMETRI_RECLAMA.has(n))).toEqual(
      [],
    );
  });

  /**
   * Poarta GA (`pornire-ga.tsx`) se decide O DATĂ, la încărcarea documentului.
   * O unealtă care și-ar scrie valorile în adresă din client — `next/form`,
   * `router.replace`, `history.replaceState` — le-ar pune într-un document
   * deja măsurat, iar GA le-ar trimite la următoarea afișare din istorie.
   */
  it("nicio unealtă nu-și rescrie adresa din client", () => {
    const interzise = /from "next\/form"|useRouter\(|history\.(?:push|replace)State/u;
    expect(pagini.filter((s) => interzise.test(s))).toEqual([]);
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project unit "src/app/(marketing)/_componente/adresa-analitice.test.ts"
```

Eșecul așteptat: `Failed to resolve import "./adresa-analitice"` (sau `Cannot find module`), 0 teste rulate.

- [ ] **Pasul 3: Implementarea minimă** — `src/app/(marketing)/_componente/adresa-analitice.ts`:

```ts
/**
 * Adresa paginii, așa cum are voie să plece spre statistici.
 *
 * ── DE CE EXISTĂ ───────────────────────────────────────────────────────────
 * Formularele uneltelor gratuite sunt `method="get"`: numele angajaților,
 * firma, șoferul și salariul stau în adresă, ca pagina să se poată pune la
 * favorite. Auditul din 8 oct 2026 a scris „Zzsecret Popescu” în foaia de
 * pontaj și a găsit numele la Google Analytics (în `dl=`, și FĂRĂ
 * consimțământ) și la Umami (în `url` și `referrer`). Spre statistici pleacă
 * doar adresa trecută prin funcțiile de mai jos.
 *
 * ── LISTĂ ALBĂ, NU LISTĂ NEAGRĂ ────────────────────────────────────────────
 * Se păstrează doar parametrii numiți aici; orice altceva se taie. O unealtă
 * nouă, cu un câmp nou, e acoperită fără ca cineva să-și amintească de
 * fișierul ăsta. `adresa-analitice.test.ts` citește câmpurile tuturor
 * uneltelor și cade dacă vreunul ar purta numele unui parametru păstrat.
 *
 * `m` rămâne: e marcajul `?m=<timestamp>` cu care auditurile noastre își
 * recunosc vizitele în Umami, nu o valoare scrisă de vizitator.
 *
 * Fișierul NU are directivă: îl importă și `analitice.tsx` (server), și
 * componentele de client. Vezi nota din `consimtamant.ts` despre proxy-ul
 * care se stringifică.
 */
export const PARAMETRI_PASTRATI: ReadonlySet<string> = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "m",
]);

/**
 * Identificatorii de clic ai rețelelor de reclamă (Google Ads, Meta, Microsoft)
 * și parametrul de legătură între domenii al gtag (`_gl`). Nu sunt valori
 * scrise de vizitator, deci NU închid poarta GA din `areDateDeFormular`: altfel
 * o vizită venită dintr-o reclamă (`?gclid=…`) n-ar ajunge deloc în GA, iar
 * conversia n-ar mai putea fi legată de campanie. Spre Umami NU pleacă:
 * `adresaCurata` păstrează doar `PARAMETRI_PASTRATI`.
 */
export const PARAMETRI_RECLAMA: ReadonlySet<string> = new Set([
  "gclid",
  "gbraid",
  "wbraid",
  "dclid",
  "_gl",
  "fbclid",
  "msclkid",
]);

/**
 * Numele funcției globale pe care scriptul Umami o cheamă înaintea fiecărei
 * trimiteri (`data-before-send`). Un singur șir, folosit în ambele grafuri.
 */
export const FUNCTIE_UMAMI = "admUmamiInainteDeTrimitere";

/** Corpul unei trimiteri Umami: câmpuri libere, dintre care contează `url` și `referrer`. */
export type PayloadUmami = Readonly<Record<string, unknown>>;

/**
 * Baza pentru adresele relative: Umami scurtează la cale `referrer`-ul venit
 * de pe propriul domeniu. `http:`, nu `https:`: testul de furnizori din
 * `continut.test.ts` caută literali `https://` în `src/` și ar cere ca
 * domeniul ăsta inexistent să fie declarat în politica de confidențialitate.
 */
const BAZA_RELATIVA = "http://adresa-relativa.invalid";

function eAbsoluta(adresa: string): boolean {
  return /^[a-z][a-z\d+.-]*:/iu.test(adresa);
}

function analizeaza(adresa: string): URL | null {
  try {
    return new URL(adresa, BAZA_RELATIVA);
  } catch {
    return null;
  }
}

function doarPastrati(parametri: URLSearchParams): URLSearchParams {
  const rezultat = new URLSearchParams();
  for (const [cheie, valoare] of parametri) {
    if (PARAMETRI_PASTRATI.has(cheie)) rezultat.append(cheie, valoare);
  }
  return rezultat;
}

/** Aceeași formă ca la intrare: adresa absolută rămâne absolută, calea rămâne cale. */
function inFormaLui(url: URL, original: string): string {
  return eAbsoluta(original) ? url.toString() : `${url.pathname}${url.search}`;
}

/**
 * Adresa fără parametrii nepermiși și fără fragment. O adresă care nu se poate
 * citi devine șir gol: mai bine o sursă lipsă în raport decât una cu nume.
 */
export function adresaCurata(adresa: string): string {
  if (adresa === "") return "";
  const url = analizeaza(adresa);
  if (url === null) return "";
  url.search = doarPastrati(url.searchParams).toString();
  url.hash = "";
  return inFormaLui(url, adresa);
}

/**
 * Adevărat dacă adresa poartă măcar un parametru din afara listei albe și din
 * afara identificatorilor de reclamă — pe paginile uneltelor, adică valori
 * scrise de vizitator. O adresă de necitit se tratează ca având date: poarta
 * se închide, nu se deschide.
 */
export function areDateDeFormular(adresa: string): boolean {
  const url = analizeaza(adresa);
  if (url === null) return true;
  for (const cheie of url.searchParams.keys()) {
    if (!PARAMETRI_PASTRATI.has(cheie) && !PARAMETRI_RECLAMA.has(cheie)) return true;
  }
  return false;
}

/**
 * Pune înapoi pe `adresa` parametrii păstrați ai paginii CURENTE, dar numai
 * dacă e aceeași pagină. Cu `data-exclude-search`, Umami taie tot query
 * string-ul, inclusiv `utm_source=fisier` din legăturile puse în documentele
 * descărcate; fără funcția asta, campaniile ar dispărea din raport.
 *
 * Comparația pe cale contează: evenimentele `performance` și `citire` pleacă
 * uneori DUPĂ o navigare soft, când `location` arată deja pagina următoare.
 */
export function cuParametriiPastrati(adresa: string, adresaCurenta: string): string {
  const tinta = analizeaza(adresa);
  const curenta = analizeaza(adresaCurenta);
  if (tinta === null || curenta === null || tinta.pathname !== curenta.pathname) return adresa;
  const pastrati = doarPastrati(curenta.searchParams).toString();
  if (pastrati === "") return adresa;
  tinta.search = pastrati;
  tinta.hash = "";
  return inFormaLui(tinta, adresa);
}

/**
 * Funcția din `data-before-send`, fără `window`: curăță `url` și `referrer`,
 * apoi readaugă campania paginii curente. Restul câmpurilor trec neatinse.
 */
export function pregatestePentruUmami(payload: PayloadUmami, adresaCurenta: string): PayloadUmami {
  const rezultat: Record<string, unknown> = { ...payload };
  const url = payload["url"];
  if (typeof url === "string") {
    rezultat["url"] = cuParametriiPastrati(adresaCurata(url), adresaCurenta);
  }
  const referrer = payload["referrer"];
  if (typeof referrer === "string") {
    rezultat["referrer"] = adresaCurata(referrer);
  }
  return rezultat;
}
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project unit "src/app/(marketing)/_componente/adresa-analitice.test.ts" src/content/landing/continut.test.ts
```

Așteptat: toate verzi. `continut.test.ts` e inclus fiindcă scanează literalii `https://` din `src/`, iar `BAZA_RELATIVA` e `http:` tocmai pentru el.

Verificat pe o copie a repo-ului: 19/19 în `adresa-analitice.test.ts`. Varianta inițială a pazei (`/export default function/u`) găsea o singură pagină din opt și cădea după implementare.

- [ ] **Pasul 5: Lanțul**

```bash
cd /srv/apps/ERP && pnpm typecheck && pnpm check:server && pnpm lint && pnpm test && node scripts/checks/lastmod.mjs && pnpm exec prettier --check "src/app/(marketing)/_componente/adresa-analitice.ts" "src/app/(marketing)/_componente/adresa-analitice.test.ts"
```

- [ ] **Commit**

```bash
cd /srv/apps/ERP
P1="src/app/(marketing)/_componente/adresa-analitice.ts"; P2="src/app/(marketing)/_componente/adresa-analitice.test.ts"
git status --short -- "$P1" "$P2"
git fetch origin main
git diff --name-only HEAD origin/main
git add -- "$P1" "$P2"
git commit --only -m "feat(unelte): adresa fără valorile din formular, pentru statistici

Listă albă (utm_*, m); orice câmp al unei unelte e tăiat. Testul citește
câmpurile celor opt pagini și cade dacă vreunul ar trece de listă.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "$P1" "$P2"
git merge origin/main
git push origin main
```

---

### Task A3: Google Analytics tace pe pagina cu valori completate

**Fișiere:**
- Create: `src/app/(marketing)/_componente/pornire-ga.tsx`
- Modify: `src/app/(marketing)/_componente/analitice.tsx`: importurile `:1-5`, constanta `PORNIRE_GA` `:63-68`, `<Script id="ga-pornire">` `:136-138`
- Test: `src/app/(marketing)/_componente/pornire-ga.test.tsx` (proiectul `ui`, happy-dom), `src/app/(marketing)/_componente/analitice.test.ts` (proiectul `unit`)

**Interfețe:**
- Consumă: `adresaCurata`, `areDateDeFormular` din `./adresa-analitice` (A2). Funcția globală `gtag`, definită de `CONSIMTAMANT_IMPLICIT` la parsare (`analitice.tsx:46-61`); de ea depinde deja `bara-consimtamant.tsx:57-60`. `ID_GA` din `analitice.tsx:37`.
- Produce: `export function PornireGa({ id }: Readonly<{ id: string }>): null`. Contractul: cel mult o configurare GA pe document, și niciuna dacă documentul s-a deschis cu date de formular în adresă.

- [ ] **Pasul 1: Scrie testul care pică** — `src/app/(marketing)/_componente/pornire-ga.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PornireGa } from "./pornire-ga";

type FereastraGa = { gtag?: (...argumente: unknown[]) => void; __admGaPornit?: boolean };
const fereastra = () => window as unknown as FereastraGa;
let apeluri: unknown[][] = [];

function cuReferitor(valoare: string) {
  Object.defineProperty(document, "referrer", { value: valoare, configurable: true });
}

const configurari = () => apeluri.filter((a) => a[0] === "config");

beforeEach(() => {
  apeluri = [];
  fereastra().gtag = (...argumente: unknown[]) => {
    apeluri.push(argumente);
  };
  cuReferitor("");
});

afterEach(() => {
  delete fereastra().gtag;
  delete fereastra().__admGaPornit;
  window.history.replaceState(null, "", "/");
});

describe("PornireGa", () => {
  it("pe o pagină fără valori în adresă configurează GA o dată", () => {
    window.history.replaceState(null, "", "/unelte/foaie-de-pontaj?utm_source=fisier");
    render(<PornireGa id="G-TEST" />);
    expect(apeluri[0]?.[0]).toBe("js");
    expect(configurari()).toEqual([["config", "G-TEST", {}]]);
  });

  it("o sursă cu valori de formular pleacă curățată", () => {
    window.history.replaceState(null, "", "/preturi");
    cuReferitor("https://administrativo.ro/unelte/condica-de-prezenta?firma=Zzsecret");
    render(<PornireGa id="G-TEST" />);
    expect(configurari()).toEqual([
      [
        "config",
        "G-TEST",
        { page_referrer: "https://administrativo.ro/unelte/condica-de-prezenta" },
      ],
    ]);
  });

  it("documentul deschis cu valori completate nu configurează GA deloc", () => {
    window.history.replaceState(
      null,
      "",
      "/unelte/foaie-de-pontaj?luna=10&angajati=Zzsecret+Popescu",
    );
    render(<PornireGa id="G-TEST" />);
    expect(apeluri).toEqual([]);
  });

  it("după o pagină cu valori, documentul rămâne fără GA și pe paginile curate", () => {
    window.history.replaceState(null, "", "/unelte/fisa-evaluare?nume=Zzsecret");
    render(<PornireGa id="G-TEST" />).unmount();
    window.history.replaceState(null, "", "/preturi");
    render(<PornireGa id="G-TEST" />);
    expect(apeluri).toEqual([]);
  });

  it("o a doua montare în același document nu mai trimite configurarea", () => {
    window.history.replaceState(null, "", "/unelte");
    render(<PornireGa id="G-TEST" />).unmount();
    render(<PornireGa id="G-TEST" />);
    expect(configurari()).toHaveLength(1);
  });

  it("fără gtag (scriptul de consimțământ blocat) nu cade", () => {
    delete fereastra().gtag;
    window.history.replaceState(null, "", "/unelte");
    expect(() => render(<PornireGa id="G-TEST" />)).not.toThrow();
  });
});
```

`src/app/(marketing)/_componente/analitice.test.ts`:

```ts
import { Children, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

type Element = ReactElement<Record<string, unknown>>;

function copiiDin(element: unknown): Element[] {
  expect(element).not.toBeNull();
  return Children.toArray(
    (element as ReactElement<{ children?: ReactNode }>).props.children,
  ) as Element[];
}

describe("Analitice", () => {
  it("pornește GA prin PornireGa, nu prin scriptul inline „ga-pornire”", async () => {
    const { Analitice, ID_GA } = await import("./analitice");
    const { PornireGa } = await import("./pornire-ga");
    const copii = copiiDin(Analitice());
    expect(copii.filter((c) => c.type === PornireGa).map((c) => c.props["id"])).toEqual([ID_GA]);
    expect(copii.some((c) => c.props["id"] === "ga-pornire")).toBe(false);
  });

  it("consimțământul implicit rămâne primul copil, înaintea bibliotecii", async () => {
    const { Analitice } = await import("./analitice");
    const [primul] = copiiDin(Analitice());
    expect(primul?.type).toBe("script");
  });
});
```

- [ ] **Pasul 2: Rulează-le și vezi-le picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/_componente/pornire-ga.test.tsx" "src/app/(marketing)/_componente/analitice.test.ts"
```

Eșecuri așteptate:
- `pornire-ga.test.tsx`: `Failed to resolve import "./pornire-ga"`;
- `analitice.test.ts`: primul test cade cu `Cannot find module '/src/app/(marketing)/_componente/pornire-ga'` (importul dinamic e lăsat pe seama rulării în proiectul `unit`). Al doilea test trece: primul copil e deja `<script>`. Verificat pe o copie a repo-ului: 1 căzut, 1 trecut.

- [ ] **Pasul 3: Implementarea minimă** — `src/app/(marketing)/_componente/pornire-ga.tsx`:

```tsx
"use client";

import { useEffect } from "react";

import { adresaCurata, areDateDeFormular } from "./adresa-analitice";

type FereastraGa = { gtag?: (...argumente: unknown[]) => void; __admGaPornit?: boolean };

/**
 * Pornirea Google Analytics: `js` + `config`, o singură dată pe document.
 *
 * ── DE CE NU MAI E SCRIPT INLINE ──────────────────────────────────────────
 * Până la 8 oct 2026, `ga-pornire` din `analitice.tsx` făcea `gtag('config')`
 * cu adresa brută. Pe o unealtă trimisă prin GET, adresa e
 * `?angajati=Popescu+Ion…`. Auditul a văzut-o plecând la Google în `dl=` pe
 * `page_view`, `click`, `scroll` și `user_engagement`, și FĂRĂ consimțământ:
 * Consent Mode trimite semnale fără cookie-uri, dar cu adresa întreagă.
 *
 * ── POARTA ───────────────────────────────────────────────────────────────
 * Un document deschis cu date de formular în adresă (`areDateDeFormular`) nu
 * configurează GA DELOC, cât trăiește documentul. Fără `config` nu există
 * etichetă, deci gtag nu trimite nimic, nici după „Accept”. Am ales poarta în
 * locul unui `page_location` curățat, fiindcă felul în care gtag completează
 * `dl`/`dr` la navigările din istorie nu e documentat. Dacă efectul nu
 * rulează, GA tace: poarta se închide la eroare.
 *
 * Steagul stă pe `window`, nu în modul: `window` trăiește exact cât
 * documentul. Layout-ul `(marketing)` se remontează la trecerea prin alt grup
 * de rute, iar un al doilea `config` ar număra o a doua afișare.
 *
 * Costul: pagina generată și navigările soft de după ea nu apar în GA. GA e
 * oricum o felie (sub consimțământ). Cifra reală e în Umami, care primește
 * aceeași pagină fără query string (`ScriptUmami`).
 */
export function PornireGa({ id }: Readonly<{ id: string }>) {
  useEffect(() => {
    const fereastra = window as unknown as FereastraGa;
    if (fereastra.__admGaPornit === true) return;
    const gtag = fereastra.gtag;
    if (gtag === undefined) return;
    fereastra.__admGaPornit = true;
    if (areDateDeFormular(window.location.href)) return;
    gtag("js", new Date());
    // `document.referrer` poate fi pagina unei unelte deschise cu valori, într-un
    // browser care ignoră `Referrer-Policy: strict-origin` (nginx).
    gtag(
      "config",
      id,
      areDateDeFormular(document.referrer)
        ? { page_referrer: adresaCurata(document.referrer) }
        : {},
    );
  }, [id]);

  return null;
}
```

În `src/app/(marketing)/_componente/analitice.tsx`, importurile. Vechi (`:1-5`):

```tsx
import Script from "next/script";

import { BaraConsimtamant } from "./bara-consimtamant";
import { CHEIE_CONSIMTAMANT } from "./consimtamant";
import { MasurareCitire } from "./masurare-citire";
```

Nou:

```tsx
import Script from "next/script";

import { BaraConsimtamant } from "./bara-consimtamant";
import { CHEIE_CONSIMTAMANT } from "./consimtamant";
import { MasurareCitire } from "./masurare-citire";
import { PornireGa } from "./pornire-ga";
```

Vechi (`:63-68`), se șterge cu totul, inclusiv rândul gol de după:

```tsx
const PORNIRE_GA = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${ID_GA}');
`;
```

Vechi (`:136-138`):

```tsx
      <Script id="ga-pornire" strategy="afterInteractive">
        {PORNIRE_GA}
      </Script>
```

Nou:

```tsx
      {/* `js` + `config` dintr-un efect, cu poarta „fără date de formular în
          adresă” (`pornire-ga.tsx`, auditul din 8 oct 2026). */}
      <PornireGa id={ID_GA} />
```

Tot în `analitice.tsx`, în comentariul de sus (`:29-35`, „DE CE `next/script`…”), după fraza „Inversate, cookie-ul ar fi deja scris când sosește refuzul.”, se adaugă rândul ` * Pornirea (`js` + `config`) nu mai e script inline din 8 oct 2026: vezi `pornire-ga.tsx`.`

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/_componente/pornire-ga.test.tsx" "src/app/(marketing)/_componente/analitice.test.ts" "src/app/(marketing)/_componente/masurare-citire.test.tsx"
```

- [ ] **Pasul 5: Lanțul**

```bash
cd /srv/apps/ERP && pnpm typecheck && pnpm check:server && pnpm lint && pnpm test && node scripts/checks/lastmod.mjs && pnpm exec prettier --check "src/app/(marketing)/_componente/pornire-ga.tsx" "src/app/(marketing)/_componente/pornire-ga.test.tsx" "src/app/(marketing)/_componente/analitice.tsx" "src/app/(marketing)/_componente/analitice.test.ts"
```

Mai e o verificare manuală: `grep -n "PORNIRE_GA\|ga-pornire" "src/app/(marketing)/_componente/analitice.tsx"` NU trebuie să întoarcă nimic (comentariile noi scriu `pornire-ga.tsx`, nu `ga-pornire`; verificat pe o copie). Comportamentul în browser NU se poate verifica local (memoria `erp-next-dev-nu-hidrateaza`), așa că se declară neverificat până la poarta live din A8.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
D="src/app/(marketing)/_componente"
git status --short -- "$D/pornire-ga.tsx" "$D/pornire-ga.test.tsx" "$D/analitice.tsx" "$D/analitice.test.ts"
git fetch origin main
git diff --name-only HEAD origin/main
git add -- "$D/pornire-ga.tsx" "$D/pornire-ga.test.tsx" "$D/analitice.test.ts"
git commit --only -m "fix(unelte): Google Analytics tace pe pagina deschisă cu valori completate

gtag('config') primea adresa cu numele angajaților și o trimitea și fără
consimțământ (gcs=G100). Acum documentul cu date de formular în adresă nu
configurează GA deloc; poarta se închide la eroare.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "$D/pornire-ga.tsx" "$D/pornire-ga.test.tsx" "$D/analitice.tsx" "$D/analitice.test.ts"
git merge origin/main
git push origin main
```

---

### Task A4: Umami primește adresa fără query string, cu UTM păstrat

**Fișiere:**
- Create: `src/app/(marketing)/_componente/pregatire-umami.tsx`
- Modify: `src/app/(marketing)/_componente/analitice.tsx`: importurile și corpul lui `ScriptUmami` (`:107-125` înainte de A3; ancora e textul, nu numărul)
- Test: `src/app/(marketing)/_componente/pregatire-umami.test.tsx` (ui), `src/app/(marketing)/_componente/analitice.test.ts` (unit, extins)

**Interfețe:**
- Consumă: `FUNCTIE_UMAMI`, `pregatestePentruUmami`, `type PayloadUmami` din `./adresa-analitice` (A2). Atributele Umami 3.3.1 `data-exclude-search` și `data-before-send`, verificate în sursa `https://analitice.administrativo.ro/script.js`: `k=w("before-send")`, `n=t[k]` la fiecare trimitere, iar `B()` face `e.search=""` pe `url` și `referrer`.
- Produce: `export function PregatireUmami(): null`, care pune `window[FUNCTIE_UMAMI] = (tip: string, payload: PayloadUmami) => PayloadUmami`. `ScriptUmami` randează `<PregatireUmami />` înaintea `<Script>`.

- [ ] **Pasul 1: Scrie testul care pică** — `src/app/(marketing)/_componente/pregatire-umami.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FUNCTIE_UMAMI, type PayloadUmami } from "./adresa-analitice";
import { PregatireUmami } from "./pregatire-umami";

type Functie = (tip: string, payload: PayloadUmami) => PayloadUmami;
const functie = () => (window as unknown as Record<string, Functie | undefined>)[FUNCTIE_UMAMI];

afterEach(() => {
  delete (window as unknown as Record<string, unknown>)[FUNCTIE_UMAMI];
  window.history.replaceState(null, "", "/");
});

describe("PregatireUmami", () => {
  it("pune pe window funcția numită în data-before-send", () => {
    expect(functie()).toBeUndefined();
    render(<PregatireUmami />);
    expect(typeof functie()).toBe("function");
  });

  it("curăță adresa și sursa și păstrează campania paginii curente", () => {
    window.history.replaceState(
      null,
      "",
      "/unelte/foaie-de-pontaj?utm_source=fisier&angajati=Zzsecret",
    );
    render(<PregatireUmami />);
    const rezultat = functie()?.("event", {
      website: "id",
      url: `${window.location.origin}/unelte/foaie-de-pontaj`,
      referrer: "/unelte/condica-de-prezenta?firma=Zzsecret",
    });
    expect(rezultat).toEqual({
      website: "id",
      url: `${window.location.origin}/unelte/foaie-de-pontaj?utm_source=fisier`,
      referrer: "/unelte/condica-de-prezenta",
    });
  });
});
```

Extinderea lui `src/app/(marketing)/_componente/analitice.test.ts`. Prima linie de import devine:

```ts
import { Children, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
```

La sfârșitul fișierului se adaugă:

```ts
describe("ScriptUmami", () => {
  beforeEach(() => {
    // `UMAMI_SRC`/`UMAMI_ID` se citesc la evaluarea modulului: mediu întâi, import după.
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_UMAMI_SRC", "https://analitice.administrativo.ro/script.js");
    vi.stubEnv("NEXT_PUBLIC_UMAMI_ID", "id-test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("cere tăierea query string-ului și numește funcția de dinainte de trimitere", async () => {
    const { ScriptUmami } = await import("./analitice");
    const { FUNCTIE_UMAMI } = await import("./adresa-analitice");
    const { PregatireUmami } = await import("./pregatire-umami");
    const copii = copiiDin(ScriptUmami());
    const indiceScript = copii.findIndex((c) => c.props["data-website-id"] === "id-test");
    const script = copii[indiceScript];
    expect(script?.props["data-exclude-search"]).toBe("true");
    expect(script?.props["data-before-send"]).toBe(FUNCTIE_UMAMI);
    const indicePregatire = copii.findIndex((c) => c.type === PregatireUmami);
    expect(indicePregatire).toBeGreaterThanOrEqual(0);
    expect(indicePregatire).toBeLessThan(indiceScript);
  });

  it("fără identificatorul sitului nu randează nimic", async () => {
    vi.stubEnv("NEXT_PUBLIC_UMAMI_ID", "");
    const { ScriptUmami } = await import("./analitice");
    expect(ScriptUmami()).toBeNull();
  });
});
```

- [ ] **Pasul 2: Rulează-le și vezi-le picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/_componente/pregatire-umami.test.tsx" "src/app/(marketing)/_componente/analitice.test.ts"
```

Eșecuri așteptate:
- `pregatire-umami.test.tsx`: `Failed to resolve import "./pregatire-umami"`;
- în `analitice.test.ts`, „cere tăierea…”: tot importul eșuat. Fără el, `ScriptUmami()` întoarce un singur `<Script>`, iar `copii` iese gol, deci `expected undefined to be "true"`;
- „fără identificatorul sitului…” trece deja.

- [ ] **Pasul 3: Implementarea minimă** — `src/app/(marketing)/_componente/pregatire-umami.tsx`:

```tsx
"use client";

import { useEffect } from "react";

import { FUNCTIE_UMAMI, pregatestePentruUmami, type PayloadUmami } from "./adresa-analitice";

/**
 * Pune pe `window` funcția numită în `data-before-send` a scriptului Umami.
 *
 * Umami 3.3.1 o caută ca `window[nume]` la FIECARE trimitere (afișare,
 * eveniment, `performance`, `track(fn)` din `masurare-citire.tsx`), deci
 * ajunge să existe înainte de prima. Efectul rulează la hidratare, iar
 * scriptul `afterInteractive` se execută abia după ce sosește din rețea.
 *
 * Tăierea query string-ului o face Umami însuși (`data-exclude-search`).
 * Funcția readaugă doar campania paginii curente și curăță încă o dată
 * `url`/`referrer`, ca plasă dacă atributul ar dispărea. Dacă funcția
 * lipsește, se pierd doar UTM-urile, nu se scurge nimic.
 *
 * Nu se scoate la demontare: scriptul rămâne viu în document după o navigare
 * soft, iar fără funcție ar trimite tot fără query, doar fără UTM.
 */
export function PregatireUmami() {
  useEffect(() => {
    (window as unknown as Record<string, unknown>)[FUNCTIE_UMAMI] = (
      _tip: string,
      payload: PayloadUmami,
    ): PayloadUmami => pregatestePentruUmami(payload, window.location.href);
  }, []);

  return null;
}
```

În `analitice.tsx`, importurile (după A3). Vechi:

```tsx
import { BaraConsimtamant } from "./bara-consimtamant";
import { CHEIE_CONSIMTAMANT } from "./consimtamant";
import { MasurareCitire } from "./masurare-citire";
import { PornireGa } from "./pornire-ga";
```

Nou:

```tsx
import { FUNCTIE_UMAMI } from "./adresa-analitice";
import { BaraConsimtamant } from "./bara-consimtamant";
import { CHEIE_CONSIMTAMANT } from "./consimtamant";
import { MasurareCitire } from "./masurare-citire";
import { PornireGa } from "./pornire-ga";
import { PregatireUmami } from "./pregatire-umami";
```

Corpul lui `ScriptUmami`. Vechi:

```tsx
  return (
    <Script
      src={UMAMI_SRC}
      data-website-id={UMAMI_ID}
      data-domains="administrativo.ro"
      data-do-not-track="true"
      // LCP, CLS, INP măsurate la vizitatorii reali. CrUX nu publică nimic
      // pentru un sit cu traficul ăsta, iar PageSpeed e o simulare de laborator;
      // altă sursă de teren nu există.
      data-performance="true"
      strategy="afterInteractive"
      defer
    />
  );
```

Nou:

```tsx
  return (
    <>
      {/* Funcția numită în `data-before-send` trebuie să existe înainte ca
          scriptul să trimită ceva. */}
      <PregatireUmami />
      <Script
        src={UMAMI_SRC}
        data-website-id={UMAMI_ID}
        data-domains="administrativo.ro"
        data-do-not-track="true"
        // LCP, CLS, INP măsurate la vizitatorii reali. CrUX nu publică nimic
        // pentru un sit cu traficul ăsta, iar PageSpeed e o simulare de laborator;
        // altă sursă de teren nu există.
        data-performance="true"
        // Fără query string în `url` și `referrer`: formularele uneltelor sunt
        // GET, deci acolo stau numele angajaților (auditul din 8 oct 2026).
        // Umami taie singur; funcția pune înapoi doar campania (`utm_*`, `m`).
        data-exclude-search="true"
        data-before-send={FUNCTIE_UMAMI}
        strategy="afterInteractive"
        defer
      />
    </>
  );
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/_componente/pregatire-umami.test.tsx" "src/app/(marketing)/_componente/analitice.test.ts" "src/app/(marketing)/_componente/masurare-citire.test.tsx"
```

- [ ] **Pasul 5: Lanțul**

```bash
cd /srv/apps/ERP && pnpm typecheck && pnpm check:server && pnpm lint && pnpm test && node scripts/checks/lastmod.mjs && pnpm exec prettier --check "src/app/(marketing)/_componente/pregatire-umami.tsx" "src/app/(marketing)/_componente/pregatire-umami.test.tsx" "src/app/(marketing)/_componente/analitice.tsx" "src/app/(marketing)/_componente/analitice.test.ts"
```

`src/app/(auth)/inregistrare/page.tsx:34` montează tot `ScriptUmami`, deci primește aceeași protecție fără nicio modificare. `pnpm typecheck` confirmă că fragmentul întors e un `ReactNode` valid acolo.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
D="src/app/(marketing)/_componente"
git status --short -- "$D/pregatire-umami.tsx" "$D/pregatire-umami.test.tsx" "$D/analitice.tsx" "$D/analitice.test.ts"
git fetch origin main
git diff --name-only HEAD origin/main
git add -- "$D/pregatire-umami.tsx" "$D/pregatire-umami.test.tsx"
git commit --only -m "fix(unelte): Umami primește adresa fără query string, cu UTM păstrat

data-exclude-search taie valorile din url și referrer înainte de orice
trimitere; data-before-send readaugă doar utm_* și m ale paginii curente.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "$D/pregatire-umami.tsx" "$D/pregatire-umami.test.tsx" "$D/analitice.tsx" "$D/analitice.test.ts"
git merge origin/main
git push origin main
```

---

### Task A5: descărcările cu date personale nu mai sunt cache public

**Fișiere:**
- Modify: `src/lib/unelte/raspuns.ts:20-34`
- Modify: `src/app/api/unelte/foaie-de-pontaj/route.ts:14` (import) și `:191` (antet)
- Modify (test): `src/lib/unelte/randari.test.ts` (blocul `describe("răspunsul HTTP")`), `src/app/api/unelte/[unealta]/route.test.ts`
- Create (test): `src/app/api/unelte/foaie-de-pontaj/route.test.ts`

**Interfețe:**
- Produce: `export const ANTET_CACHE_DESCARCARE = "private, no-store";` în `src/lib/unelte/raspuns.ts` (modul `server-only`, nu `"use server"`, deci exportul constantei e permis; `check:server` vede doar fișierele `"use server"`).
- Consumă: `raspunsDocument(d: DocumentTabelar, format: Format): Promise<Response>` (neschimbat), `GET(cerere: NextRequest): Promise<Response>` din ruta foii.

- [ ] **Pasul 1: Scrie testele care pică.** În `src/lib/unelte/randari.test.ts`, înăuntrul lui `describe("răspunsul HTTP", () => { … })`, după testul „pune tipul, numele ASCII și atașamentul”:

```ts
  it("descărcarea nu intră în niciun cache comun: poate purta nume de angajați", async () => {
    const r = await raspunsDocument(DOC, "pdf");
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });

  it("nicio rută de unealtă nu mai declară cache public", () => {
    const rute = readdirSync("src/app/api/unelte", { recursive: true, encoding: "utf8" })
      .filter((f) => f.endsWith("route.ts"))
      .map((f) => readFileSync(join("src/app/api/unelte", f), "utf8"));
    expect(rute.length).toBeGreaterThanOrEqual(2);
    expect(rute.filter((s) => /cache-control["']?\s*:\s*["']public/iu.test(s))).toEqual([]);
  });
```

Și în capul fișierului, înaintea importului `jszip`:

```ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

```

În `src/app/api/unelte/[unealta]/route.test.ts`, în `describe("ruta comună de descărcare")`:

```ts
  it("fișierul generat iese cu cache-control private, no-store", async () => {
    const r = await cere(
      "/api/unelte/condica-de-prezenta?luna=10&an=2026&firma=Firma+Test&format=pdf",
      "condica-de-prezenta",
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });
```

`src/app/api/unelte/foaie-de-pontaj/route.test.ts`:

```ts
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET } from "./route";

const cere = (interogare: string) =>
  GET(new NextRequest(`http://localhost/api/unelte/foaie-de-pontaj?${interogare}`));

describe("ruta foii de pontaj", () => {
  it("Excel-ul cu nume iese cu cache-control private, no-store", async () => {
    const r = await cere("luna=10&an=2026&angajati=Ion+Popa");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("spreadsheetml");
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });

  it("PDF-ul trece prin răspunsul comun, cu același antet", async () => {
    const r = await cere("luna=10&an=2026&angajati=Ion+Popa&format=pdf");
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });
});
```

- [ ] **Pasul 2: Rulează-le și vezi-le picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project unit src/lib/unelte/randari.test.ts "src/app/api/unelte/[unealta]/route.test.ts" src/app/api/unelte/foaie-de-pontaj/route.test.ts
```

Eșecuri așteptate:
- cele 4 teste de antet dau `expected 'public, max-age=3600' to be 'private, no-store'`;
- paza pe surse dă `expected [ Array(1) ] to deeply equal []`: o singură sursă, ruta foii. `raspuns.ts` nu e un `route.ts`, deci nu intră în scanare; antetul lui e prins de primul test.

Verificat pe o copie a repo-ului: 5 căzute înainte, 20/20 verzi după.

- [ ] **Pasul 3: Implementarea minimă.** `src/lib/unelte/raspuns.ts`. Vechi:

```ts
/**
 * Fișierul ca răspuns de descărcare. `new Uint8Array(...)` copiază într-un
 * `ArrayBuffer` propriu: tipurile din `lib.dom` nu acceptă ca `BodyInit` un
 * `Uint8Array<ArrayBufferLike>`, iar `Buffer`-ul din `docx` e exact asta.
 */
export async function raspunsDocument(d: DocumentTabelar, format: Format): Promise<Response> {
  const continut = await RANDARI[format](d);
  return new Response(new Uint8Array(continut), {
    headers: {
      "content-type": TIP[format],
      "content-disposition": `attachment; filename="${numeFisierSigur(d.numeFisier)}.${format}"`,
      "cache-control": "public, max-age=3600",
    },
  });
}
```

Nou:

```ts
/**
 * Antetul de cache al oricărei descărcări de unealtă.
 *
 * A fost `public, max-age=3600` până la 8 oct 2026, pe fișiere care poartă
 * numele angajaților, firma și salariul. `public` dă voie oricărui cache
 * intermediar să păstreze o oră documentul unui alt om. Acum e aceeași
 * politică pe care Next o pune deja paginilor uneltelor.
 */
export const ANTET_CACHE_DESCARCARE = "private, no-store";

/**
 * Fișierul ca răspuns de descărcare. `new Uint8Array(...)` copiază într-un
 * `ArrayBuffer` propriu: tipurile din `lib.dom` nu acceptă ca `BodyInit` un
 * `Uint8Array<ArrayBufferLike>`, iar `Buffer`-ul din `docx` e exact asta.
 */
export async function raspunsDocument(d: DocumentTabelar, format: Format): Promise<Response> {
  const continut = await RANDARI[format](d);
  return new Response(new Uint8Array(continut), {
    headers: {
      "content-type": TIP[format],
      "content-disposition": `attachment; filename="${numeFisierSigur(d.numeFisier)}.${format}"`,
      "cache-control": ANTET_CACHE_DESCARCARE,
    },
  });
}
```

`src/app/api/unelte/foaie-de-pontaj/route.ts`. Vechi (`:14`):

```ts
import { raspunsDocument } from "@/lib/unelte/raspuns";
```

Nou:

```ts
import { ANTET_CACHE_DESCARCARE, raspunsDocument } from "@/lib/unelte/raspuns";
```

Vechi (`:188-193`):

```ts
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${nume}"`,
      "cache-control": "public, max-age=3600",
    },
```

Nou:

```ts
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${nume}"`,
      "cache-control": ANTET_CACHE_DESCARCARE,
    },
```

- [ ] **Pasul 4: Rulează testele, trec** (aceeași comandă ca la Pasul 2), apoi lanțul:

```bash
cd /srv/apps/ERP && pnpm typecheck && pnpm check:server && pnpm lint && pnpm test && node scripts/checks/lastmod.mjs && pnpm exec prettier --check src/lib/unelte/raspuns.ts src/lib/unelte/randari.test.ts src/app/api/unelte/foaie-de-pontaj/route.ts src/app/api/unelte/foaie-de-pontaj/route.test.ts "src/app/api/unelte/[unealta]/route.test.ts"
```

- [ ] **Commit**

```bash
cd /srv/apps/ERP
F="src/lib/unelte/raspuns.ts src/lib/unelte/randari.test.ts src/app/api/unelte/foaie-de-pontaj/route.ts src/app/api/unelte/foaie-de-pontaj/route.test.ts"
git status --short -- $F "src/app/api/unelte/[unealta]/route.test.ts"
git fetch origin main
git diff --name-only HEAD origin/main
git add -- src/app/api/unelte/foaie-de-pontaj/route.test.ts
git commit --only -m "fix(unelte): descărcările cu date personale nu mai sunt cache public

cache-control: private, no-store pe toate fișierele generate (ca paginile);
un test cade dacă o rută de unealtă declară din nou public.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- $F "src/app/api/unelte/[unealta]/route.test.ts"
git merge origin/main
git push origin main
```

---

### Task A6: jurnalele nginx fără valorile din formulare; Referrer-Policy strict-origin pe /unelte

**Fișiere:**
- Create: `scripts/checks/nginx-jurnale-unelte.sh`
- Modify: `deploy/nginx/30-administrativo.ro.conf`: `:55-56` (`log_format durate`), `:64-66` (server `:80`), `:87-90` (server `www`), `:128` (Referrer-Policy), `:153` (`access_log … main`), `:237-240` (`location /`)
- Modify: `deploy/nginx/32-staging.administrativo.ro.conf`: `:56` (Referrer-Policy), `:64` (`access_log … main`)

**Interfețe:**
- Consumă: imaginea EXACTĂ a lui `strawboss-nginx-1`, luată prin `docker inspect strawboss-nginx-1 --format '{{.Image}}'` (nginx/1.29.7 pe 8 oct 2026). NU eticheta `nginx:alpine`: la verificarea planului, eticheta locală arăta deja spre nginx/1.31.5, deci „aceeași imagine” nu mai era adevărat. Poarta, rulată la verificare pe imaginea edge-ului: 8 căderi pe configul actual, 10/10 pe cel nou. `log_format main` al edge-ului, citit din container: `'$remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent" "$http_x_forwarded_for"'`. Comenzile `./administrativo.sh nginx:check`, `nginx:vhost` (cu backup, `nginx -t`, revenire automată și reload) și `ADM_MEDIU=staging ./administrativo.sh nginx:vhost`.
- Produce: variabilele `$adm_cerere_jurnal`, `$adm_referer_jurnal` și `$adm_politica_referrer`, plus `log_format adm_main`. Toate sunt globale pe VM (context `http`), iar numele lor sunt verificate libere în `conf.d`.

- [ ] **Pasul 1: Scrie testul care pică** — `scripts/checks/nginx-jurnale-unelte.sh` (prototip rulat pe 8 oct 2026, roșu 8/10 pe fișierele actuale, verde 10/10 pe cele noi):

```bash
#!/usr/bin/env bash
# scripts/checks/nginx-jurnale-unelte.sh
#
# Poarta pentru jurnalele nginx: ce scrie un vizitator într-o unealtă gratuită
# nu ajunge în jurnalele serverului.
#
# ── DE CE EXISTĂ ───────────────────────────────────────────────────────────
# Formularele uneltelor sunt GET, deci numele angajaților, firma și salariul
# stau în adresă. Până la 8 oct 2026, `log_format durate` și `main` scriau
# `"$request"` — adică adresa cu tot cu valori — în /var/log/nginx/administrativo.log
# și în jurnalul docker al edge-ului (fără plafon de mărime). Același lucru
# pentru `error_log`, care scrie `request: "GET …?angajati=…"` la orice 502.
#
# ── CUM ────────────────────────────────────────────────────────────────────
# Pornește un nginx EFEMER, din aceeași imagine ca edge-ul (ID-ul ei, nu eticheta),
# cu vhost-urile din repo și certificate autosemnate, într-o rețea docker
# proprie (ca `resolver 127.0.0.11` să răspundă repede „Host not found” →
# 502, nu să aștepte 30 s). Trimite cereri cu marcaj și citește jurnalele.
# Edge-ul real NU e atins: niciun fișier din /srv/apps/Strawboss, niciun reload.
#
# Utilizare:  bash scripts/checks/nginx-jurnale-unelte.sh
#             ADM_VHOSTURI=<director> pentru alt director decât deploy/nginx.
set -euo pipefail

RADACINA="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VHOSTURI="${ADM_VHOSTURI:-$RADACINA/deploy/nginx}"
NUME="adm-poarta-jurnale-$$"
PORT_HTTPS=18443
PORT_HTTP=18080
MARCAJ="Zzjurnal"
# Imaginea EXACTĂ a edge-ului, nu eticheta `nginx:alpine`: eticheta se mută la
# fiecare `docker pull` (pe 8 oct 2026, local era deja nginx/1.31.5, iar edge-ul
# rula 1.29.7). Fără edge pe mașină (alt calculator), se cade pe etichetă și se
# spune asta.
IMAGINE="${ADM_IMAGINE_NGINX:-$(docker inspect strawboss-nginx-1 --format '{{.Image}}' 2>/dev/null || true)}"
if [ -z "$IMAGINE" ]; then
  IMAGINE="nginx:alpine"
  echo "  (edge-ul strawboss-nginx-1 nu e pe mașină: rulez pe nginx:alpine, care poate fi altă versiune)" >&2
fi
LUCRU="$(mktemp -d)"

curata() {
  docker rm -f "$NUME" >/dev/null 2>&1 || true
  docker network rm "$NUME-net" >/dev/null 2>&1 || true
  rm -rf "$LUCRU"
}
trap curata EXIT

mkdir -p "$LUCRU/conf.d"
cp "$VHOSTURI/30-administrativo.ro.conf" "$VHOSTURI/32-staging.administrativo.ro.conf" "$LUCRU/conf.d/"
: > "$LUCRU/conf.d/.htpasswd-staging"
for domeniu in administrativo.ro staging.administrativo.ro; do
  mkdir -p "$LUCRU/le/live/$domeniu"
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 -subj "/CN=$domeniu" \
    -keyout "$LUCRU/le/live/$domeniu/privkey.pem" \
    -out "$LUCRU/le/live/$domeniu/fullchain.pem" 2>/dev/null
done
chmod -R a+rX "$LUCRU"

docker network create "$NUME-net" >/dev/null
docker run -d --name "$NUME" --network "$NUME-net" \
  -p "127.0.0.1:$PORT_HTTPS:443" -p "127.0.0.1:$PORT_HTTP:80" \
  -v "$LUCRU/conf.d:/etc/nginx/conf.d:ro" -v "$LUCRU/le:/etc/letsencrypt:ro" \
  "$IMAGINE" >/dev/null
sleep 1
docker exec "$NUME" nginx -v
docker exec "$NUME" nginx -t

cere() { # cere <cale> [antet]
  local argumente=(-sk -m 10 -o /dev/null --resolve "administrativo.ro:$PORT_HTTPS:127.0.0.1")
  [ $# -ge 2 ] && argumente+=(-H "$2")
  curl "${argumente[@]}" "https://administrativo.ro:$PORT_HTTPS$1" || true
}
cere "/unelte/foaie-de-pontaj?luna=10&an=2026&angajati=$MARCAJ+Popescu%0D%0A$MARCAJ+Ionescu" \
  "Referer: https://administrativo.ro/unelte/condica-de-prezenta?firma=$MARCAJ+Firma"
cere "/api/unelte/foaie-de-parcurs?sofer=$MARCAJ+Sofer&format=pdf&firma=$MARCAJ"
cere "/api/unelte/cerere-concediu?format=docx"
cere "/unelte?x=$MARCAJ"
cere "/preturi?utm_source=poarta" "Referer: https://administrativo.ro/unelte/calculator-salariu?suma=$MARCAJ"
curl -s -m 5 -o /dev/null --resolve "administrativo.ro:$PORT_HTTP:127.0.0.1" \
  "http://administrativo.ro:$PORT_HTTP/unelte/fisa-evaluare?nume=$MARCAJ" || true
sleep 1

JURNAL_DOCKER="$(docker logs "$NUME" 2>&1)"
JURNAL_DURATE="$(docker exec "$NUME" cat /var/log/nginx/administrativo.log)"
politica() {
  curl -skI -m 10 --resolve "administrativo.ro:$PORT_HTTPS:127.0.0.1" "https://administrativo.ro:$PORT_HTTPS$1" \
    | tr -d '\r' | awk -F': ' 'tolower($1)=="referrer-policy"{print $2}'
}

probleme=0
cere_ca() { # cere_ca <descriere> <condiție-bash>
  if eval "$2"; then echo "  ✓ $1"; else echo "  ✗ $1" >&2; probleme=$((probleme + 1)); fi
}
ACCES_DOCKER="$(grep -v '\[error\]\|\[crit\]\|\[warn\]\|\[notice\]\|docker-entrypoint\|^/docker' <<<"$JURNAL_DOCKER" || true)"
EROARE_UNELTE="$(grep '\[error\]' <<<"$JURNAL_DOCKER" | grep 'request: "GET /\(api/\)\{0,1\}unelte' || true)"

cere_ca "jurnalul de acces (docker, adm_main) fără marcaj" '! grep -q "$MARCAJ" <<<"$ACCES_DOCKER"'
cere_ca "administrativo.log (durate) fără marcaj" '! grep -q "$MARCAJ" <<<"$JURNAL_DURATE"'
cere_ca "error_log fără cererile uneltelor" '[ -z "$EROARE_UNELTE" ]'
cere_ca "unealta apare, fără argumente" 'grep -q "\"GET /unelte/foaie-de-pontaj HTTP/2.0\"" <<<"$JURNAL_DURATE"'
cere_ca "descărcarea își păstrează formatul" 'grep -q "\"GET /api/unelte/foaie-de-parcurs?format=pdf HTTP/2.0\"" <<<"$JURNAL_DURATE"'
cere_ca "restul sitului își păstrează query string-ul" 'grep -q "\"GET /preturi?utm_source=poarta HTTP/2.0\"" <<<"$JURNAL_DURATE"'
cere_ca "Referer-ul e scris fără argumente" 'grep -q "\"https://administrativo.ro/unelte/condica-de-prezenta\"" <<<"$ACCES_DOCKER"'
cere_ca "Referrer-Policy strict-origin pe /unelte/*" '[ "$(politica /unelte/foaie-de-pontaj)" = "strict-origin" ]'
cere_ca "Referrer-Policy strict-origin pe /unelte" '[ "$(politica /unelte)" = "strict-origin" ]'
cere_ca "Referrer-Policy neschimbată în rest" '[ "$(politica /preturi)" = "strict-origin-when-cross-origin" ]'

if [ "$probleme" -gt 0 ]; then
  echo "" >&2
  echo "nginx-jurnale-unelte: $probleme verificări au căzut. Jurnalul docker:" >&2
  echo "$JURNAL_DOCKER" | tail -20 >&2
  exit 1
fi
echo "nginx-jurnale-unelte: jurnalele nu păstrează valorile din unelte."
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând** (pe fișierele din repo, încă neschimbate):

```bash
cd /srv/apps/ERP && chmod +x scripts/checks/nginx-jurnale-unelte.sh && bash scripts/checks/nginx-jurnale-unelte.sh; echo "cod=$?"
```

Așteptat:
- `nginx version: nginx/1.29.7` (versiunea edge-ului) și `nginx -t` trece;
- 8 rânduri `✗` (toate în afară de „restul sitului își păstrează query string-ul” și „Referrer-Policy neschimbată în rest”);
- `nginx-jurnale-unelte: 8 verificări au căzut`, apoi `cod=1`.

- [ ] **Pasul 3: Implementarea minimă.** `deploy/nginx/30-administrativo.ro.conf`. Vechi (`:55-56`):

```nginx
log_format durate '$remote_addr $host "$request" $status $body_bytes_sent '
                  'rt=$request_time urt=$upstream_response_time "$http_x_forwarded_for"';
```

Nou:

```nginx
# ── Fără valorile din formularele uneltelor (8 oct 2026) ─────────────────────
# Uneltele de la /unelte trimit formularele prin GET: numele angajaților,
# firma, șoferul, salariul stau în query string. `"$request"` le scria în
# ambele jurnale (pe 8 oct 2026: 1 792 de rânduri cu query pe /unelte în
# administrativo.log, 264 cu nume). Pe /unelte și /api/unelte se scrie doar
# calea, plus `format` pe descărcări, pentru numărătoare; restul sitului își
# păstrează query string-ul (UTM, `?m=` al auditurilor).
#
# Numele `adm_*` sunt verificate libere în tot conf.d-ul VM-ului: un `map` sau
# un `log_format` duplicat face `nginx -t` să pice pentru TOATE site-urile.
# Poarta locală, înaintea oricărei instalări:
#   bash scripts/checks/nginx-jurnale-unelte.sh
map $request_uri $adm_cerere_jurnal {
    "~^(/api/unelte/[^?]*)\?(?:[^#]*&)?format=(pdf|docx|xlsx)(?:&|$)"  "$request_method $1?format=$2 $server_protocol";
    "~^(/(?:api/)?unelte(?:/[^?]*)?)(?:\?|$)"                            "$request_method $1 $server_protocol";
    default                                                              $request;
}

# Referer-ul se scrie fără query string, pe tot situl: cererile de pe pagina
# unei unelte (CSS, JS, RSC, descărcarea) îl purtau cu adresa completă.
map $http_referer $adm_referer_jurnal {
    "~^([^?]*)\?"  $1;
    default         $http_referer;
}

# `strict-origin` pe paginile uneltelor: cererile spre propriul server și
# `document.referrer` al paginii următoare primesc doar originea. Altfel,
# referer-ul complet ajungea în `error_log`, al cărui format nu se poate
# configura. Antetul rămâne declarat O DATĂ, la nivel de `server` (vezi
# „regula de aur” de mai jos); de aici vine doar valoarea.
map $uri $adm_politica_referrer {
    "~^/unelte(?:/|$)"  "strict-origin";
    default             "strict-origin-when-cross-origin";
}

# `main` din nginx.conf-ul edge-ului (nu al nostru, nu-l putem schimba), cu
# cererea și referer-ul de mai sus.
log_format adm_main '$remote_addr - $remote_user [$time_local] "$adm_cerere_jurnal" '
                    '$status $body_bytes_sent "$adm_referer_jurnal" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

log_format durate '$remote_addr $host "$adm_cerere_jurnal" $status $body_bytes_sent '
                  'rt=$request_time urt=$upstream_response_time "$http_x_forwarded_for"';
```

Vechi (`:64-66`):

```nginx
server {
    listen 80;
    server_name administrativo.ro www.administrativo.ro;
```

Nou:

```nginx
server {
    listen 80;
    server_name administrativo.ro www.administrativo.ro;
    # Fără asta, redirectul 301 se scria în `main` (moștenit din http{}), cu query.
    access_log /dev/stdout adm_main;
```

Vechi (`:87-90`):

```nginx
server {
    listen 443 ssl;
    http2 on;
    server_name www.administrativo.ro;
```

Nou:

```nginx
server {
    listen 443 ssl;
    http2 on;
    server_name www.administrativo.ro;
    access_log /dev/stdout adm_main;
```

Vechi (`:128`):

```nginx
    add_header Referrer-Policy        "strict-origin-when-cross-origin" always;
```

Nou:

```nginx
    # `strict-origin` pe /unelte, neschimbat în rest — vezi `map $adm_politica_referrer`.
    add_header Referrer-Policy        $adm_politica_referrer always;
```

Vechi (`:153`):

```nginx
    access_log /dev/stdout main;
```

Nou:

```nginx
    access_log /dev/stdout adm_main;
```

Vechi (`:237-240`):

```nginx
    location / {
        set $u administrativo-web:3000;
        proxy_pass         http://$u;
    }
```

Nou:

```nginx
    # Uneltele gratuite: aceeași trimitere ca `location /`. Singura diferență e
    # `error_log`: la `error`, nginx scrie `request: "GET /unelte/…?angajati=…"`
    # la orice 502 (verificat cu un nginx efemer). `crit` păstrează doar ce
    # oprește serverul. Diagnosticul unei unelte căzute e în jurnalul Next.
    # Fără `add_header` și fără `proxy_set_header` aici: s-ar pierde moștenirea.
    location ~ ^/(?:api/)?unelte(?:/|$) {
        error_log stderr crit;
        set $u administrativo-web:3000;
        proxy_pass         http://$u;
    }

    location / {
        set $u administrativo-web:3000;
        proxy_pass         http://$u;
    }
```

`deploy/nginx/32-staging.administrativo.ro.conf`. Vechi (`:56`):

```nginx
    add_header Referrer-Policy        "strict-origin-when-cross-origin" always;
```

Nou:

```nginx
    # Valoarea vine din `map $adm_politica_referrer` (30-administrativo.ro.conf).
    add_header Referrer-Policy        $adm_politica_referrer always;
```

Vechi (`:64`):

```nginx
    access_log /dev/stdout main;
```

Nou:

```nginx
    access_log /dev/stdout adm_main;
```

La comentariul din capul lui `32-…conf` (`:9`, „`log_format durate` și `map $http_upgrade $connection_upgrade` se declară în…”), după `log_format durate` se adaugă `, `log_format adm_main`, `map $adm_politica_referrer``.

- [ ] **Pasul 4: Rulează testul, trece**

```bash
cd /srv/apps/ERP && bash scripts/checks/nginx-jurnale-unelte.sh; echo "cod=$?"
```

Așteptat: 10 rânduri `✓`, apoi `nginx-jurnale-unelte: jurnalele nu păstrează valorile din unelte.` și `cod=0`. Apoi:

```bash
cd /srv/apps/ERP && grep -rhn 'adm_cerere_jurnal\|adm_referer_jurnal\|adm_politica_referrer\|log_format adm_main' /srv/apps/Strawboss/nginx/conf.d/*.conf | grep -v '^\s*#'
```

Comanda trebuie să nu întoarcă NIMIC înainte de instalare. Orice rând înseamnă un nume deja luat, iar instalarea s-ar opri la `nginx -t` pe tot VM-ul. Urmează `bash -n scripts/checks/nginx-jurnale-unelte.sh` (fișierele `.conf` și `.sh` nu trec prin prettier, iar taskul nu atinge niciun fișier JS/TS).

- [ ] **Commit**

```bash
cd /srv/apps/ERP
F="deploy/nginx/30-administrativo.ro.conf deploy/nginx/32-staging.administrativo.ro.conf scripts/checks/nginx-jurnale-unelte.sh"
git status --short -- $F
git fetch origin main
git diff --name-only HEAD origin/main
git add -- scripts/checks/nginx-jurnale-unelte.sh
git commit --only -m "fix(unelte): jurnalele nginx fără valorile din formulare; Referrer-Policy strict-origin pe /unelte

\$request scria numele angajaților în administrativo.log și în jurnalul docker
al edge-ului (1 792 de rânduri, 264 cu nume). Hărți map pentru cerere,
referer și Referrer-Policy; error_log crit pe unelte. Poarta locală pornește
un nginx efemer din aceeași imagine.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- $F
git merge origin/main
git push origin main
```

- [ ] **Pasul 5: Instalarea pe edge-ul partajat — OPREȘTE-TE și cere confirmarea utilizatorului.** nginx-ul servește ~10 site-uri. Mesajul către utilizator: „Instalez vhost-urile administrativo.ro și staging pe nginx-ul partajat (backup, `nginx -t`, revenire automată la eșec, reload)?”. Doar după „da”:

```bash
cd /srv/apps/ERP
./administrativo.sh nginx:check
./administrativo.sh nginx:vhost                       # ÎNTÂI 30: declară adm_main și hărțile
ADM_MEDIU=staging ./administrativo.sh nginx:vhost     # abia apoi 32, care le folosește
```

Ordinea e obligatorie. Cu 32 instalat înaintea lui 30, `nginx -t` pică pe `unknown log format "adm_main"`, iar comanda revine singură la varianta anterioară.

- [ ] **Pasul 6: Verificarea pe edge-ul viu**

```bash
curl -sI "https://administrativo.ro/unelte/foaie-de-pontaj" | grep -i '^referrer-policy'      # → strict-origin
curl -sI "https://administrativo.ro/preturi" | grep -i '^referrer-policy'                     # → strict-origin-when-cross-origin
curl -s -o /dev/null "https://administrativo.ro/unelte/foaie-de-pontaj?luna=10&angajati=Zzverifjurnal"
curl -s -o /dev/null "https://administrativo.ro/api/unelte/fisa-evaluare?format=pdf&nume=Zzverifjurnal"
sleep 2
docker exec strawboss-nginx-1 tail -n 200 /var/log/nginx/administrativo.log | grep -c Zzverifjurnal   # → 0
docker logs --since 2m strawboss-nginx-1 2>&1 | grep -c Zzverifjurnal                                  # → 0
docker exec strawboss-nginx-1 tail -n 200 /var/log/nginx/administrativo.log | grep -c '"GET /api/unelte/fisa-evaluare?format=pdf HTTP'  # → ≥ 1
for d in nortiauno.com video.tedde-auto.ro serviceproof.ro buget.scoala-ai.ro; do printf '%s ' "$d"; curl -s -o /dev/null -w '%{http_code}\n' -m 10 "https://$d/"; done   # celelalte site-uri răspund ca înainte
```

---

### Task A7: promisiunea de confidențialitate spusă exact, plus politica

**Fișiere:**
- Modify: `src/app/(marketing)/unelte/page.tsx`: banda „Ce au în comun” (`:119-145`; ancora e textul, fiindcă alte secțiuni ale planului ating `lead`-ul și `AN_MIN` din aceeași bandă)
- Modify: `src/content/legal/confidentialitate.ts`: `:17-22` (sursele), `:29` (data), `:50` (secțiunea 2), `:59` (secțiunea 3), `:102-103` (secțiunea 8)
- Modify: `src/content/landing/harta.ts`: blocul `cale: "/unelte"` (`:315-322`) și `cale: "/legal/confidentialitate"` (`:433-439`)
- Test: `src/content/legal/confidentialitate.test.ts` (Create, proiectul `unit`)

**Interfețe:**
- Consumă: `SECTIUNI_CONFIDENTIALITATE: readonly SectiuneLegala[]` (neschimbat ca tip). `Link` din `next/link`, deja importat în `unelte/page.tsx:4`. Ancora `#sectiunea-2`, produsă de `ancoraClauza("2. Ce date prelucrăm")` (`src/content/legal/cuprins.ts:52-58`).
- Produce: textul nou. Taskul e permis doar după A6 instalat; textul se publică abia la deploy-ul din A8.

- [ ] **Pasul 1: Scrie testul care pică** — `src/content/legal/confidentialitate.test.ts`:

```ts
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { SECTIUNI_CONFIDENTIALITATE } from "./confidentialitate";

const politica = JSON.stringify(SECTIUNI_CONFIDENTIALITATE);

describe("politica despre uneltele gratuite", () => {
  it("numește uneltele și spune unde ajung valorile din câmpuri", () => {
    expect(politica).toContain("administrativo.ro/unelte");
    expect(politica).toMatch(/nu ajung în statisticile de vizitare/u);
    expect(politica).toMatch(/istoricul browserului/u);
    expect(politica).toMatch(/Cloudflare/u);
  });

  it("declară jurnalul de acces al serverului și temeiul lui", () => {
    expect(politica).toMatch(/jurnalul de acces al serverului —/u);
    expect(politica).toMatch(/Jurnalul de acces al serverului: interesul nostru legitim/u);
  });

  it("spune că GA tace pe pagina de unealtă cu valori completate", () => {
    expect(politica).toMatch(/nu trimite nimic la Google Analytics/u);
  });
});

describe("promisiunea de pe /unelte", () => {
  const pagina = readFileSync("src/app/(marketing)/unelte/page.tsx", "utf8");

  it("nu mai promite că nimic nu e reținut", () => {
    expect(pagina).not.toMatch(/niciuna\s+nu\s+reține\s+ce\s+scrii/u);
    expect(pagina).not.toMatch(/fără să rețină ceva/u);
  });

  it("spune că valorile rămân în adresă și trimite la politică", () => {
    expect(pagina).toMatch(/istoricul\s+browserului/u);
    expect(pagina).toContain('href="/legal/confidentialitate#sectiunea-2"');
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project unit src/content/legal/confidentialitate.test.ts
```

Eșecuri așteptate: 5 din 5. Politica nu conține „administrativo.ro/unelte”, nici „jurnalul de acces”, nici „nu trimite nimic la Google Analytics”. Pagina conține încă „niciuna nu reține ce scrii” și nu are legătura.

- [ ] **Pasul 3: Implementarea minimă.** `src/app/(marketing)/unelte/page.tsx`. Vechi:

```tsx
        titlu="Fără cont, fără abonament, fără să rețină ceva"
```

Nou:

```tsx
        titlu="Fără cont, fără plată, fără să păstrăm ce scrii"
```

(47 de caractere: convenția proiectului cere titluri de cel mult 48. „Fără cont, fără abonament, fără să păstrăm ce scrii” ar fi avut 51.)

Vechi:

```tsx
          <p className="text-mk-text-slab text-[0.9375rem] leading-[1.7]">
            Documentele se tipăresc direct sau se descarcă în Word, PDF sau Excel, după unealtă.
            Niciuna nu cere cont sau adresă de e-mail și niciuna nu reține ce scrii: alegerile stau
            în adresa paginii, iar dacă o pui la favorite, revii la aceeași configurație. Ce nu fac:
            nu țin minte lunile trecute și nu leagă documentele între ele — pentru asta e nevoie de
            evidența din aplicație, unde ziua are oră de început și de sfârșit.
          </p>
```

Nou:

```tsx
          {/* Până la 8 oct 2026 banda promitea că uneltele nu păstrează nimic din
              ce completezi, iar numele din formular plecau la Google Analytics,
              la Umami și în jurnalele serverului. Fraza de acum descrie ce face
              codul după reparație. Vechea formulare NU se citează aici:
              `confidentialitate.test.ts` caută textul ei în fișier. */}
          <p className="text-mk-text-slab text-[0.9375rem] leading-[1.7]">
            Documentele se tipăresc direct sau se descarcă în Word, PDF sau Excel, după unealtă.
            Niciuna nu cere cont sau adresă de e-mail. Ce completezi nu se salvează la noi:
            documentul se face pe loc și nu intră în nicio bază de date, iar statisticile de
            vizitare și jurnalul serverului înregistrează doar ce unealtă ai deschis, fără valorile
            din câmpuri. Valorile stau în adresa paginii, ca s-o poți pune la favorite și să revii
            la aceeași configurație. Asta înseamnă că rămân în istoricul browserului tău și pleacă
            odată cu linkul, dacă îl trimiți cuiva.{" "}
            <Link
              href="/legal/confidentialitate#sectiunea-2"
              className="underline underline-offset-4"
            >
              Detaliile, în politica de confidențialitate
            </Link>
            .
          </p>
          <p className="text-mk-text-slab text-[0.9375rem] leading-[1.7]">
            Ce nu fac: nu țin minte lunile trecute și nu leagă documentele între ele — pentru asta e
            nevoie de evidența din aplicație, unde ziua are oră de început și de sfârșit.
          </p>
```

`src/content/legal/confidentialitate.ts`. Vechi (`:21-22`):

```ts
 *   - sesiunea, 400 de zile ca plafon de cookie: `src/lib/supabase/optiuni-cookie.ts`;
 *   - serverul: Contabo GmbH, Germania (`whois` pe adresa VM-ului, 17 sept 2026).
```

Nou:

```ts
 *   - sesiunea, 400 de zile ca plafon de cookie: `src/lib/supabase/optiuni-cookie.ts`;
 *   - serverul: Contabo GmbH, Germania (`whois` pe adresa VM-ului, 17 sept 2026);
 *   - uneltele gratuite: GA tace pe documentul cu valori (`_componente/pornire-ga.tsx`),
 *     Umami primește adresa fără query (`_componente/analitice.tsx`, `ScriptUmami`),
 *     nginx scrie fără argumente (`deploy/nginx/30-administrativo.ro.conf`) — 8 oct 2026.
```

Vechi (`:29`):

```ts
export const DATA_CONFIDENTIALITATE = "17 septembrie 2026";
```

Nou (data zilei în care se comite; în exemplu, 8 oct 2026):

```ts
export const DATA_CONFIDENTIALITATE = "8 octombrie 2026";
```

Vechi (`:50`):

```ts
      "Pe paginile publice: statistici de vizitare, descrise la secțiunea 8.",
```

Nou:

```ts
      "Pe paginile publice: statistici de vizitare, descrise la secțiunea 8, și jurnalul de acces al serverului — adresa IP, ora, pagina cerută fără valorile din formulare, pagina de pe care ai venit și identificarea browserului —, folosit pentru securitate și pentru diagnosticarea erorilor.",
      "Uneltele gratuite de la administrativo.ro/unelte — foaia de pontaj, condica de prezență, cererea de concediu, foaia de parcurs, fișa de instruire SSM, fișa de evaluare și calculatorul de salariu — generează documentul pe loc, din ce completezi, fără cont și fără să salveze ceva într-o bază de date. Valorile din câmpuri, de pildă numele angajaților, firma sau salariul, stau în adresa paginii, ca s-o poți pune la favorite. Ele nu ajung în statisticile de vizitare și nici în jurnalul serverului: acolo se înregistrează doar unealta și formatul cerut. Adresa completă rămâne în istoricul browserului tău, pleacă odată cu linkul dacă îl trimiți cuiva și trece, criptată, prin Cloudflare, ca orice cerere spre site.",
```

Vechi (`:59`):

```ts
      "Statistica paginilor publice cu Google Analytics: consimțământul tău, litera a, dat din bara de jos. Statistica fără cookie-uri: interesul nostru legitim de a ști ce pagini sunt citite.",
```

Nou:

```ts
      "Statistica paginilor publice cu Google Analytics: consimțământul tău, litera a, dat din bara de jos. Statistica fără cookie-uri: interesul nostru legitim de a ști ce pagini sunt citite.",
      "Jurnalul de acces al serverului: interesul nostru legitim de a ține situl sigur și de a diagnostica erorile, litera f.",
```

Vechi (`:102-103`):

```ts
      "Google Analytics 4 scrie cookie-urile _ga și _ga_ urmat de identificatorul proprietății, cu durata de doi ani, numai după ce apeși „Accept”. Până atunci, refuzul e implicit: biblioteca Google se încarcă totuși și trimite semnale fără cookie-uri, cum prevede modul de consimțământ al Google.",
      "Statistica proprie, pe serverul nostru, nu folosește cookie-uri și nu urmărește vizitatorii de la un site la altul.",
```

Nou:

```ts
      "Google Analytics 4 scrie cookie-urile _ga și _ga_ urmat de identificatorul proprietății, cu durata de doi ani, numai după ce apeși „Accept”. Până atunci, refuzul e implicit: biblioteca Google se încarcă totuși și trimite semnale fără cookie-uri, cum prevede modul de consimțământ al Google. Excepție: o pagină de unealtă deschisă cu valori completate nu trimite nimic la Google Analytics, nici după „Accept”.",
      "Statistica proprie, pe serverul nostru, nu folosește cookie-uri și nu urmărește vizitatorii de la un site la altul. Primește adresa paginii fără valorile din formulare; din parametrii adresei păstrează doar pe cei de campanie (utm_…) și marcajul m, cu care ne recunoaștem propriile verificări.",
```

**Temeiurile textului nou, verificate pe sursa primară (verificatorul planului, 8 oct 2026):**

- „interesul nostru legitim …, litera f”: art. 6 alin. (1) lit. f din Regulamentul (UE) 2016/679, textul românesc de pe EUR-Lex (`CELEX:32016R0679`). Art. 13 alin. (1) lit. d cere ca interesul legitim să fie NUMIT; fraza nouă o face („a ține situl sigur și de a diagnostica erorile”). ⚠ Rămâne de confirmat de jurist, ca restul temeiurilor (avertismentul politicii).
- ⚠ Art. 13 alin. (2) lit. a cere și perioada de stocare, sau criteriile ei. Secțiunea 6 („Cât timp păstrăm datele”) nu pomenește jurnalul de acces, iar azi nu există un termen (json-file fără `max-size`, `administrativo.log` fără rotație). Textul de mai sus NU inventează un termen: e a doua întrebare pentru utilizator. Până la răspuns, politica are o lipsă declarată, nu o afirmație falsă.
- Consimțământul pentru cookie-urile GA (neschimbat de task): art. 4 alin. (5) lit. a din Legea 506/2004, consolidarea din 10.07.2022 (`legislatie.just.ro/Public/DetaliiDocument/257056`).

`src/content/landing/harta.ts`. Vechi:

```ts
    cale: "/unelte",
    prioritate: 0.5,
    limba: "ro",
    traducere: null,
    // 6 oct: titlul și descrierea numesc toate cele șapte unelte.
    actualizat: "2026-10-07",
```

Nou (data commitului):

```ts
    cale: "/unelte",
    prioritate: 0.5,
    limba: "ro",
    traducere: null,
    // 8 oct: promisiunea de confidențialitate spusă exact, cu legătură spre politică.
    actualizat: "2026-10-08",
```

Vechi:

```ts
    cale: "/legal/confidentialitate",
    prioritate: 0.3,
    limba: "ro",
    traducere: null,
    actualizat: "2026-10-07",
```

Nou:

```ts
    cale: "/legal/confidentialitate",
    prioritate: 0.3,
    limba: "ro",
    traducere: null,
    // 8 oct: uneltele gratuite, jurnalul de acces, excepția GA (secțiunile 2, 3, 8).
    actualizat: "2026-10-08",
```

Dacă o altă secțiune a ridicat deja aceste date la o zi mai nouă, data rămâne cea mai nouă. Data nu coboară niciodată.

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project unit src/content/legal/confidentialitate.test.ts src/content/landing/continut.test.ts src/content/legal/pagini.test.ts
```

Verificat pe o copie a repo-ului: 5/5 roșii înainte, 5/5 verzi după. În varianta inițială, comentariul JSX nou din `page.tsx` cita fraza veche („niciuna nu reține…”), iar „nu mai promite că nimic nu e reținut” cădea DUPĂ implementare; comentariul a fost reformulat.

- [ ] **Pasul 5: Lanțul**, cu `lastmod` după commit (poarta compară cu istoricul git):

```bash
cd /srv/apps/ERP && pnpm typecheck && pnpm check:server && pnpm lint && pnpm test && pnpm exec prettier --check "src/app/(marketing)/unelte/page.tsx" src/content/legal/confidentialitate.ts src/content/legal/confidentialitate.test.ts src/content/landing/harta.ts
```

- [ ] **Commit**, cu `lastmod` în același commit:

```bash
cd /srv/apps/ERP
git status --short -- "src/app/(marketing)/unelte/page.tsx" src/content/legal/confidentialitate.ts src/content/legal/confidentialitate.test.ts src/content/landing/harta.ts
git fetch origin main
git diff --name-only HEAD origin/main
git add -- src/content/legal/confidentialitate.test.ts
git commit --only -m "fix(unelte): promisiunea de confidențialitate spusă exact, plus politica

„Niciuna nu reține ce scrii” era fals. Acum: nimic în bază, statistici și
jurnale fără valorile din câmpuri, iar adresa rămâne în browser și pleacă cu
linkul. Politica numește uneltele, jurnalul de acces și excepția GA.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "src/app/(marketing)/unelte/page.tsx" src/content/legal/confidentialitate.ts src/content/legal/confidentialitate.test.ts src/content/landing/harta.ts
node scripts/checks/lastmod.mjs
git merge origin/main
git push origin main
```

`node scripts/checks/lastmod.mjs` trebuie să spună „toate datele din sitemap sunt cel puțin la zi”. Dacă nu, data din `harta.ts` se repară cu `git commit --amend --only -- src/content/landing/harta.ts`, ÎNAINTE de push.

---

### Task A8: deploy și verificarea live

**Fișiere:** niciunul (deploy + porți).

**Interfețe:**
- Consumă: `ADM_MEDIU=staging ./administrativo.sh stack:deploy`, `./administrativo.sh prod` (care rulează singur și `rute-publice.mjs`), `scripts/checks/unelte-fara-scurgeri.mjs` (A1), `@playwright/test`.
- Produce: producția cu A3, A4, A5 și A7 active.

- [ ] **Pasul 1: Staging întâi** (memoria `erp-staging-cade-tacut`):

```bash
cd /srv/apps/ERP
ADM_MEDIU=staging ./administrativo.sh stack:deploy
ADM_AUTENTIFICARE_BASIC="coleg:$(cat ~/.secrete/administrativo/parola-staging.txt)" node scripts/checks/unelte-fara-scurgeri.mjs https://staging.administrativo.ro
```

Așteptat:
- 14 rânduri `✓`, cu `GA ≥1+0`;
- linia `Umami: inactiv pe staging.administrativo.ro (data-domains)`;
- 6 descărcări cu `private, no-store` și cele 7 pagini cu `strict-origin` (nginx-ul de staging e instalat din A6);
- cod 0.

O rulare care se termină sub 30 de secunde a sărit scenariile: se citește numărul de rânduri, nu doar codul (memoria „workflow verde prin sărire”).
- [ ] **Pasul 2: OPREȘTE-TE și cere confirmarea utilizatorului pentru producție** („Fac deploy pe producție cu reparația de confidențialitate a uneltelor?”). Doar după „da”:

```bash
cd /srv/apps/ERP && ./administrativo.sh prod && ./administrativo.sh stack:status
```

- [ ] **Pasul 3: Poarta live pe producție, verde**

```bash
cd /srv/apps/ERP && node scripts/checks/unelte-fara-scurgeri.mjs; echo "cod=$?"
```

Așteptat:
- 6 `✓ /api/unelte/… — cache-control: private, no-store`;
- 14 `✓ /unelte/… — GA ≥1+0, Umami ≥1+≥1, Referer N`;
- linia `unelte-fara-scurgeri: toate cele 14 scenarii curate.`, apoi `cod=0`.

Rulează de 3 ori la rând: sunt 2 replici în spatele balansorului (memoria `rute-publice.mjs`).
- [ ] **Pasul 4: Verificare headless la 360 px** (hub-ul și politica au text nou):

```bash
cd /srv/apps/ERP && node --input-type=module -e '
import { chromium } from "@playwright/test";
const b = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell`, args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 360, height: 800 } });
await p.route(/google-analytics\.com\/g\/collect|analitice\.administrativo\.ro\/api\/send/u, (r) => r.abort());
for (const cale of ["/unelte", "/legal/confidentialitate"]) {
  await p.goto(`https://administrativo.ro${cale}`, { waitUntil: "load" });
  const [sw, cw] = await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  const nume = cale.replaceAll("/", "_");
  await p.screenshot({ path: `/tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/plan/lucru-confidentialitate/360${nume}.png`, fullPage: true });
  console.log(cale, "scrollWidth", sw, "clientWidth", cw, sw === cw ? "OK" : "DEPĂȘIRE");
}
const legatura = await (await b.newPage()).goto("https://administrativo.ro/legal/confidentialitate#sectiunea-2");
console.log("ancora sectiunea-2:", legatura?.status());
await b.close();'
```

Așteptat:
- `scrollWidth === clientWidth` pe ambele pagini (`OK`);
- în captura `/unelte`, paragraful nou și legătura „Detaliile, în politica de confidențialitate” se citesc fără rupturi;
- în captura politicii, secțiunea 2 are cele două paragrafe noi;
- `ancora sectiunea-2: 200`.

---

### Task A9 (BLOCAT pe decizia utilizatorului): datele scurse înainte de reparație

**Fișiere:** niciunul în repo. Taskul se execută DOAR dacă utilizatorul răspunde „da” la întrebarea despre ștergerea retroactivă și numai pe părțile aprobate. Ștergerea e ireversibilă.

- [ ] **Pasul 1 — `administrativo.log` (12 MB, al nostru):** rescriere pe loc, în același inod, ca nginx să scrie mai departe în fișierul curat:

```bash
docker exec strawboss-nginx-1 sh -c '
  f=/var/log/nginx/administrativo.log
  sed -E "s#(\"[A-Z]+ /(api/)?unelte[^ ?\"]*)\?[^ \"]*#\1#" "$f" > /tmp/adm-curat.log &&
  cat /tmp/adm-curat.log > "$f" && rm /tmp/adm-curat.log'
docker exec strawboss-nginx-1 grep -c '"GET /\(api/\)\{0,1\}unelte[^ ]*?' /var/log/nginx/administrativo.log   # → 0
```

Aceeași comandă, cu `f=/var/log/nginx/staging.administrativo.log`, curăță jurnalul de staging. Rândurile scrise între `sed` și `cat` (câteva milisecunde) se pierd.
- [ ] **Pasul 2 — jurnalul docker al `strawboss-nginx-1`** (json-file de ~780 MB, comun celor ~10 site-uri): nu se editează cât rulează containerul. Singurele opțiuni sunt trunchierea, care pierde jurnalele tuturor site-urilor, sau recrearea containerului, care pune toate site-urile jos câteva secunde. Se face doar ce alege utilizatorul.
- [ ] **Pasul 3 — Umami:** citirea bazei Umami mi-a fost refuzată de clasificator în sesiunea de planificare, deci coloanele sunt ⚠ NEVERIFICATE. Primul pas e inspecția:

```bash
docker exec "$(docker ps -qf name=umami_umami-db)" psql -U umami -d umami -c '\d website_event'
# ⚠ Containerul e o sarcină Swarm (`umami_umami-db.1.<id>`), nu `umami_umami-db`:
#   numele scurt dă „No such container”. Utilizatorul și baza (`umami`) sunt
#   NEVERIFICATE: dacă psql refuză, se citesc din `docker inspect` (POSTGRES_USER/POSTGRES_DB).
```

Abia dacă există `url_query` și `referrer_query` (iar UTM-urile stau în coloane separate `utm_*`):

```sql
begin;
update website_event set url_query = null where url_path like '/unelte%' and url_query is not null;
update website_event set referrer_query = null where referrer_path like '/unelte%' and referrer_query is not null;
-- numărul de rânduri afectate se compară cu un SELECT count(*) dinainte; apoi commit;
```

- [ ] **Pasul 4 — GA4:** cererea de ștergere a parametrilor `page_location`/`page_referrer` pentru 3 sept 2026 → data deploy-ului se face din Admin → Data deletion requests, de către utilizator: robotul are doar rol de Vizualizator. Cererea șterge parametrul pe TOATE paginile din interval, nu doar pe unelte.

---

**Review Focus** — ce nu prinde niciun test din secțiune și ar mușca un vizitator real:

1. **O unealtă nouă care își scrie valorile în adresă din client** (`next/form`, `router.replace`, previzualizare „live”). Poarta GA se decide o dată, la încărcarea documentului, deci un document deja măsurat ar trimite valorile la următoarea afișare din istorie. Testul există în A2: „nicio unealtă nu-și rescrie adresa din client” scanează sursele din `src/app/(marketing)/unelte`. O secțiune care adaugă interactivitate client trebuie să-l păstreze verde, nu să-l relaxeze.
2. **O rută de descărcare nouă care nu trece prin `raspunsDocument`** și își pune singură antetele, cum făcea ruta Excel a foii. Testul există în A5: „nicio rută de unealtă nu mai declară cache public” scanează `src/app/api/unelte/**/route.ts`.
3. **Un câmp nou numit ca un parametru păstrat** (`m`, `utm_*`) ar trece de curățare în Umami și ar deschide poarta GA. Testul există în A2 („niciun câmp nu poartă numele unui parametru păstrat”), cu o pază anti-vid de ≥ 20 de nume și ≥ 8 pagini.
4. **Un browser care ignoră `Referrer-Policy`, sau o eroare 5xx pe o resursă din afara `/unelte`** cerută de pe pagina unei unelte. `error_log` scrie `referrer: "…?angajati=…"`, iar formatul lui nu se poate configura. Partea acoperibilă e verificată în A6: poarta efemeră asertează `strict-origin` pe `/unelte` și `/unelte/*` și lipsa cererilor de unelte din `error_log`. Riscul rezidual e declarat aici, nu ascuns.
5. **Fereastra de deploy rulant cu 2 replici:** câteva minute, o replică veche servește pagina cu `ga-pornire` inline. Poarta live (A8, pasul 3) se rulează de 3 ori, DUPĂ ce `stack:status` arată ambele replici pe imaginea nouă. Altfel un verde poate veni de pe o singură replică.
