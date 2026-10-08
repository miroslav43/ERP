## K. SEO, unelte noi și distribuție: rangul în Google

**Scop:** uneltele de pe `/unelte` să fie găsite și apăsate în Google, așa că: snippetul și titlul vin dintr-o sursă păzită de test; hub-ul e pe categorii; fiecare unealtă primește legături din cel puțin trei pagini; apar patru unelte noi pe cererea măsurată (calculator de zile lucrătoare, cerere de demisie cu preaviz calculat, programarea concediilor, adeverință de salariat); apar „modelele completate” cu imagine; GA se încarcă abia după „Accept”, bara de cookie-uri nu mai e LCP; iar paginile ajung la Bing, Brave, GSC și pe LinkedIn.

**De ce:** ce a găsit auditul live din 8 oct 2026, plus măsurătorile mele de azi:

- **Search Console, 90 de zile** (`sc-domain:administrativo.ro`, interogat azi prin API): uneltele au 32 de afișări și 2 clicuri, adică 13% din afișările sitului. **Cererea de concediu**: 16 afișări, poziția medie 6,0 și 0 clicuri, toate între 21 sept și 2 oct, pe interogări anonimizate (sub pragul de confidențialitate al Google). **Fișa SSM**: 1 afișare, poziția 8. **Foaia de pontaj**: 11 afișări, poziția 26,3, cu „foaie de pontaj lunar” pe 28. **Condica**: poziția 24,5. **Calculatorul, fișa de evaluare și foaia de parcurs**: 0 afișări. Toate cele 8 adrese sunt „Trimisă și indexată”, deci indexarea nu e problema.
- **Cele 0 clicuri pe poziția 6 nu dovedesc un snippet slab.** La un CTR tipic de 3–6% pe poziția 6, 16 afișări înseamnă 0,5–1 clic așteptat. Rescriem descrierea pe intenție, fiindcă nu costă nimic, dar pârghia reală e numărul de interogări pe care pagina apare. De aici cele trei direcții: conținut pe întrebările căutate, legături interne și pagini noi.
- **Bing are indexată doar pagina de start** (auditul SEO din 7 oct). ChatGPT și Copilot caută prin Bing. Eticheta `msvalidate.01` lipsește din HTML-ul de producție (`curl` azi): Bing Webmaster Tools nu a fost legat.
- **Zero legături din afară** (auditul din 7 oct, „Autoritate 2/10”).
- **Viteza paginilor de unelte:** HTML de 483–563 KB necomprimat, dar 45–53 KB pe fir (br). `gtag.js` are 180 KB și se încarcă fără consimțământ. Pe hub, la CPU ×4, LCP e 3,7 s, iar elementul LCP e paragraful din bara de cookie-uri, fiindcă bara apare abia după hidratare.
- **Cererea pentru unelte noi.** Am măsurat-o azi cu aceeași metodă ca în `docs/comercial/cuvinte-cheie.md`: completarea automată Google, `hl=ro&gl=ro`, subiectul plus a–z, iar scorul e suma lui `10 − poziție`. Scriptul și ieșirile JSON sunt în scratchpad-ul secțiunii, `lucru-seo-unelte-noi/sugestii/`. **Scorul NU e volum lunar.** Ca reper: „calcul salariu net” are scorul 1.007 și Keyword Planner îi dă 10K–100K pe lună, iar „cerere concediu de odihna” are 783 și 100–1K pe forma „word”.

| Familie (seed)                                   | Termeni | Scor  | Unealtă propusă                                                    |
| ------------------------------------------------ | ------: | ----: | ------------------------------------------------------------------ |
| model demisie                                    |     139 | 1.014 | **cerere de demisie** (K8)                                         |
| cerere demisie                                   |     143 |   994 | idem                                                               |
| preaviz demisie                                  |      91 |   777 | idem; primul termen e „preaviz demisie 15 zile lucratoare sau calendaristice” (26) |
| adeverinta de salariat                           |     133 |   992 | **adeverință de salariat** (K10)                                   |
| zile lucratoare 2026                             |     118 |   861 | deja acoperit de `/ghid/zile-libere`; calculatorul (K7) îl leagă   |
| programare concedii                              |      32 |   338 | **programarea concediilor** (K9); „…de odihna 2026 excel” (31)     |
| planificare concedii                             |      24 |   315 | idem; „planificare concedii odihna excel” (29)                     |
| calculator zile lucratoare                       |      21 |   242 | **calculator de zile lucrătoare** (K7)                             |
| zile lucratoare intre doua date                  |       5 |   103 | idem                                                               |
| calculator preaviz                               |       9 |   118 | acoperit de K8 + K7                                                |
| calculator concediu medical                      |      64 |   554 | respins (vezi Decizii)                                             |
| contract de munca model                          |     174 | 1.105 | respins (vezi Decizii)                                             |
| fisa postului model                              |      69 |   623 | respins (vezi Decizii)                                             |
| calculator vechime                               |      44 |   482 | respins (vezi Decizii)                                             |

Interogările de concurență pentru demisie (WebSearch azi): zarinacrm.ro (model static), hipo.ro (articol), wps.com (șabloane) și firele de pe avocatnet.ro. Niciunul nu calculează ultima zi de preaviz cu sărbătorile.

**Decizii luate**

1. **FAQPage și HowTo NU se pun.** Google a retras rezultatele îmbogățite FAQ pentru toate siturile la 7 mai 2026. Documentația Search Central scrie că din 15 iunie 2026 „is no longer shown in Google Search results” (citit azi). HowTo e retras din 2023. Proiectul a hotărât deja asta în `date-structurate.tsx:28-30` și în `intrebari/page.tsx:14-17`. Întrebările rămân vizibile, ca `<h3>` + răspuns, prin componenta `IntrebariUnealta` din E7. Ce citează un motor sau un asistent AI e perechea întrebare–răspuns din HTML, nu marcajul.
2. **Schema rămâne `WebApplication` cu `offers.price = "0"`** (`nodUnealta`, `noduri-json-ld.ts:198`), plus `BreadcrumbList` din `AntetSecundar` (`antet-secundar.tsx:55`). Ambele există deja pe toate cele 7 unelte și le primesc și cele 4 noi. Fără `aggregateRating`, Google nu dă rezultat îmbogățit de aplicație. Recenzii inventate nu punem, așa că nodul servește dezambiguizării, nu unui snippet. K11 îi adaugă doar `image`, cu captura modelului completat.
3. **Titlul și descrierea fiecărei unelte stau într-un singur fișier, `src/content/landing/seo-unelte.ts`**, cu termenul principal declarat. Testul cere titlu ≤ 48 de caractere în orice an, descriere de 70–160, termenul în titlu și termenul în `cuvinte-tinta.tsv`. Motivul: secțiunile C, E și F rescriu pe rând aceleași blocuri `metadatePagina({...})`. E13 ar fi pus pe foaia de pontaj „Foaie de pontaj Excel cu formule, PDF și Word”, adică ar fi scos „lunar”, singurul termen pentru care Google afișează pagina. **K1 rulează după C11, E13, E14, F13, F14, G8, H7 și I9**, preia textele lor și păstrează „lunar”.
4. **Cele 4 unelte noi, alese din tabelul de mai sus, după trei criterii: cerere măsurată, temei verificabil în Codul muncii și refolosirea calendarului.** Demisia are cea mai mare cerere și un diferențiator pe care nu-l are niciun concurent găsit: ultima zi de preaviz calculată pe zile lucrătoare, cu sărbătorile. Programarea concediilor e recomandată și de auditul SEO din 7 oct („Unealtă nouă: programarea concediilor”). Adeverința are cerere mare și un temei simplu (art. 34 alin. (5)). Calculatorul de zile lucrătoare e cel mai ieftin, refolosește integral `domain/calendar` și ține legătura dintre ghidul zilelor libere și restul.
5. **Respinse, cu motiv.** **Calculator concediu medical:** OUG 158/2005 s-a schimbat în 2025, cererea e pe coduri și luni („cod 01”, „iulie 2026”), iar fără confirmarea contabilului (NOTES §3, „codurile de indemnizație CM ⚠️”) ar fi o cifră publică greșită. **Contract de muncă model:** documentul e cu miză juridică mare și se face după modelul-cadru din ordinul ministrului. Un generator gratuit care greșește o clauză face rău. **Fișa postului:** intenția e pe meserii („mecanic agricol”, „încărcător”), nu un formular, deci nu se poate face mai bine decât un model Word. **Calculator vechime:** intenția e de pensie („casa de pensii”, „cnpp”), alt public. **Calculatorul de zile de concediu cuvenite** există deja în F13, deci nu se dublează.
6. **Preavizul la demisie curge din ziua următoare înregistrării și se împlinește în ultima zi lucrătoare a termenului.** Temeiul e RIL nr. 8/2024, publicat în MO nr. 573 din 19.06.2024 și citat chiar în forma consolidată a Codului muncii din 27.04.2026, la art. 75. RIL-ul e dat pentru preavizul la concediere (art. 75 și art. 278), iar demisia o aplicăm prin analogie. Pagina o spune pe față, iar NOTES.md primește ⚠ pentru jurist.
7. **CNP-ul nu se cere în niciun formular nou.** Tot ce scrii stă în adresa paginii, iar CNP-ul rămâne linie de completat de mână. Numele și salariul trec prin lista albă din A2, care taie automat orice câmp nou. A2 își păzește singură câmpurile, deci nu dublăm testul.
8. **Uneltele noi rămân fără bază de date și fără sesiune**, ca restul: parametri GET, `DocumentTabelar`, `/api/unelte/[unealta]`.
9. **`gtag.js` se încarcă pe `/unelte*` abia după „Accept”** (K12). Pe restul sitului rămâne cum e: decizia pe tot situl e marcată „decizie a utilizatorului” în auditul din 7 oct, iar sarcina mea e uneltele. Pe unelte, A3 oprește oricum `config` când adresa are date de formular. Consent Mode fără cookie-uri adusese tocmai scurgerea din audit, iar cifra de referință e în Umami (memoria `erp-analitice-fapte-verificate`). Ce pierdem: semnalele modelate de GA pentru refuzuri, doar pe unelte. Schimbarea e reversibilă dintr-o singură componentă.
10. **CSS-ul triplat (`experimental.inlineCss`) nu se atinge aici.** Măsurarea efectului cere `pnpm build`, pe care utilizatorul l-a interzis, iar pe fir costul e de ~8 KB br pe copie (53 KB documentul întreg). Rămâne decizia din auditul din 7 oct („se decide după o măsurătoare PSI pe producție”).
11. **Bara de consimțământ se randează pe server și se arată din primul cadru** (K13): un atribut pus de scriptul de consimțământ la parsare, plus o regulă CSS. Am respins două alternative. Bara mai mică nu schimbă momentul apariției. Ruperea paragrafului în bucăți e un truc pe metrică, nu o reparație.
12. **Imaginile „model completat” se generează local** (`next dev -H 127.0.0.1`, memoria `erp-next-dev-nu-hidrateaza`: HTML-ul și CSS-ul se randează corect) și se comit în `public/capturi/unelte/`. Le fac doar pentru documentele construite integral din intrări: cele 3 noi plus fișa SSM și fișa de evaluare. Foaia de parcurs completată cere rânduri cu trasee, iar structura ei e a secțiunii care o deține. Testul din K11 construiește fiecare exemplu prin registrul uneltelor, deci prinde orice parametru redenumit de altă secțiune.
13. **Paginile-lege nu își ridică `actualizatIso` când primesc doar o legătură.** Data înseamnă „textele verificate la sursă” (`scripts/checks/lastmod.mjs`, punctul 3). Fișele de modul își ridică `actualizat`, iar harta ridică datele paginilor de unealtă și ale lui `/`, `/en`, `/unelte` atinse.
14. **Outreach: doar lista și mesajul.** Nu trimitem nimic și nu folosim directoare, pachete de linkuri sau comentarii de forum fără răspuns complet în text (`vizibilitate-organica.md:105`).

**Harta fișierelor**

| Fișier | Responsabilitate | Task |
| --- | --- | --- |
| `src/content/landing/seo-unelte.ts` (Create) | `META_UNELTE`, `metaUnealta(cale, azi)`; placeholderul `{an-programare}` din K9 | K1, K7–K10 |
| `src/content/landing/seo-unelte.test.ts` (Create) | titlu ≤ 48 în orice an, descriere 70–160, termen în titlu, pagini legate | K1 |
| `src/app/(marketing)/unelte/*/page.tsx` (Modify, 8 pagini) | `metadatePagina(metaUnealta(...))` | K1 |
| `src/content/landing/hub-unelte.ts` (Create) + `.test.ts` | categoriile hub-ului și poarta „fiecare unealtă e în hub” | K2, K7–K10 |
| `src/app/(marketing)/unelte/page.tsx` (Modify) | hub pe categorii, cu ancore | K2 |
| `src/content/landing/legaturi-unelte.test.ts` (Create) | poarta celor trei surse de legături | K3 |
| `src/content/landing/legaturi.ts`, `fise-module.ts`, `src/content/legal/{concediu-odihna,zile-libere,reges}.ts` (Modify) | legături interne spre unelte | K3, K7–K10 |
| `docs/comercial/cuvinte-tinta.tsv` (Modify) + `src/content/landing/cuvinte-tinta.test.ts` (Create) | termenii-țintă și poarta lor | K4, K7–K10 |
| `src/domain/calendar/interval-lucrator.ts` (Create) + `.test.ts` | zile lucrătoare între date, a N-a zi lucrătoare, `dataLunga`, `anulProgramarii` | K6 |
| `src/app/(marketing)/unelte/calculator-zile-lucratoare/{calcul.ts,calcul.test.ts,intrebari.ts,page.tsx}` (Create) | calculatorul de zile lucrătoare | K7 |
| `src/app/(marketing)/unelte/cerere-demisie/{model.ts,model.test.ts,intrebari.ts,page.tsx}` (Create) | cererea de demisie | K8 |
| `src/app/(marketing)/unelte/programare-concedii/{model.ts,model.test.ts,intrebari.ts,page.tsx}` (Create) | programarea concediilor | K9 |
| `src/app/(marketing)/unelte/adeverinta-salariat/{model.ts,model.test.ts,intrebari.ts,page.tsx}` (Create) | adeverința de salariat | K10 |
| `src/lib/unelte/registru.ts` (Modify) | trei constructori noi | K8–K10 |
| `src/app/api/unelte/[unealta]/route.test.ts` (Modify) | 200/400 pe slug-urile noi | K8–K10 |
| `src/content/landing/unelte.ts`, `harta.ts`, `ro.ts`, `en.ts`, `src/app/llms.txt/route.ts` (Modify) | înregistrarea paginilor noi | K7–K10 |
| `NOTES.md` (Modify) | ⚠ numărarea preavizului la demisie | K8 |
| `src/content/landing/exemple-unelte.ts` (Create) + `.test.ts` | exemplele completate, verificate prin registru | K11 |
| `scripts/capturi/capturi-unelte.ts` (Create) | capturile WebP ale exemplelor | K11 |
| `public/capturi/unelte/*.webp` (Create, 10 fișiere) | imaginile „model completat” | K11 |
| `src/app/(marketing)/_componente/exemplu-completat.tsx` (Create) | banda cu imaginea și legăturile exemplului | K11 |
| `src/app/(marketing)/_componente/noduri-json-ld.ts` (Modify) + `.test.ts` | `image` opțional pe `nodUnealta` | K11 |
| `src/app/(marketing)/_componente/consimtamant.ts` (Modify) | `EVENIMENT_CONSIMTAMANT` | K12 |
| `src/app/(marketing)/_componente/biblioteca-ga.tsx` (Create) + `.test.tsx` | `gtag.js` după „Accept” pe `/unelte*` | K12 |
| `src/app/(marketing)/_componente/analitice.tsx` (Modify) | `BibliotecaGa`; scriptul de consimțământ pune `data-consimtamant` | K12, K13 |
| `src/app/(marketing)/_componente/bara-consimtamant.tsx` (Modify) + `bara-consimtamant.test.tsx` (Create) | evenimentul la alegere; randare pe server | K12, K13 |
| `src/app/globals.css` (Modify) | regula de afișare a barei | K13 |
| `docs/comercial/outreach-unelte.md` (Create), `docs/comercial/linkedin/*` (prin skill) | distribuția | K14 |
| — (pași în GSC, Bing, Brave, făcuți de utilizator) | indexarea | K5, K14 |

**Dependențe de alte secțiuni** (citite în fișierele lor, nu presupuse):
- **A3** (`PornireGa` în `analitice.tsx`): înaintea lui K12.
- **B1** (calendarul cu `inVigoareDin`): înaintea lui K6. Semnăturile publice ale `sarbatoriDupaZi` rămân aceleași.
- **B3** (`citesteAngajati` în `foaie.ts`): înaintea lui K9.
- **B5** (`data-tipar` pe bară): înaintea lui K13.
- **E7** (`IntrebariUnealta`, `IntrebareUnealta`): înaintea lui K7–K10.
- **F6** (`zileLucratoareText` din `cerere-concediu-de-odihna/text-zile.ts`): înaintea lui K7–K8.
- **E12, F12, G6, I7, H5** (`registru.ts`): primele patru scot condica, cererea de concediu, foaia de parcurs și fișa de evaluare din `UNELTE`. I7 șterge și importul `fisaEvaluareDinParametri`. H5 adaugă `formatePentru` și `FORMATE_RESTRANSE`. K8–K10 nu se ancorează pe liniile scoase, iar K8 și K10 trec scrisorile lor pe PDF și Word. (Adăugat la verificare, 8 oct 2026.)
- **C11, E13, E14, F13, F14, G8, H7, I9** (ultimele scrieri în metadatele și notele uneltelor existente): înaintea lui K1 și K2. (G8, H7, I9 adăugate la verificare: rescriu metadatele foii de parcurs, ale fișei SSM și ale fișei de evaluare, iar I9 și nota din hub.)

Formatul: codul e scris pentru `printWidth: 100`. Dacă `prettier --check` cade, se rulează `pnpm exec prettier --write` pe fișierele taskului, se reiau testele și abia apoi se comite.

**Ordinea, după ce aduce clicuri mai repede.** K1–K5 lucrează pe paginile care au deja afișări: cererea e pe poziția 6, fișa SSM pe 8. Urmează K6–K10, cererea nouă. K11 aduce imaginile, adică Google Imagini și forma „model completat”. K12–K13 sunt viteză, cu efect mic pe rang. K14 e promovarea, după deploy.

---
### Task K1: Titlul și descrierea uneltelor, dintr-o singură sursă păzită

Rulează după C11, E13, E14, F13, F14, **G8, H7 și I9**. Acolo se scriu ultimele variante ale metadatelor din paginile pe care le atinge acest task. (Corectat la verificare, 8 oct 2026: prima versiune numea doar C/E/F, iar `META_UNELTE` avea pentru foaia de parcurs, fișa SSM, fișa de evaluare și calculatorul de salariu textele de AZI. Rulat după G8/H7/I9/C11, K1 le-ar fi readus tăcut pe cele vechi. Valorile de mai jos sunt cele scrise de acele taskuri: `G-foaie-parcurs.md:4251`, `H-fisa-ssm.md:3139`, `I-fisa-evaluare.md:3777`, `C-calculator-salariu.md:5180`, `F-cerere-concediu.md:4868` (liniile recitite la a doua verificare; ele se mută când se editează planurile). În comentariile din `seo-unelte.ts` se numesc doar taskurile, fără căi spre fișierele de plan, fiindcă acestea nu ajung în repo.)

**Pasul 0: forma reală de pe `main`.** Înainte de Pasul 3 se citește blocul `metadatePagina` din fiecare pagină. Dacă un titlu sau o descriere diferă de valoarea din `META_UNELTE` de mai jos și nu e una dintre cele două rescrieri deliberate ale lui K1 (foaia de pontaj, descrierea cererii) sau „model” adăugat la fișa de evaluare, în `META_UNELTE` intră valoarea de pe `main`. Altfel K1 ar șterge munca altei secțiuni.

```bash
cd /srv/apps/ERP && for d in "src/app/(marketing)/unelte"/*/; do echo "== $d"; grep -n -A6 'metadatePagina(' "$d/page.tsx" | grep -E 'titlu|"[A-ZȘȚĂÎÂ]'; done
```

**Fișiere:**
- Create: `src/content/landing/seo-unelte.ts`
- Test: `src/content/landing/seo-unelte.test.ts`
- Modify (fiecare, blocul `metadatePagina({ … })` și importurile):
  - `src/app/(marketing)/unelte/foaie-de-pontaj/page.tsx` (azi `:49-54`)
  - `src/app/(marketing)/unelte/condica-de-prezenta/page.tsx` (azi `:31-36`)
  - `src/app/(marketing)/unelte/cerere-concediu-de-odihna/page.tsx` (azi `:61-68`)
  - `src/app/(marketing)/unelte/calculator-zile-concediu/page.tsx` (din F13)
  - `src/app/(marketing)/unelte/foaie-de-parcurs/page.tsx` (azi `:32-37`)
  - `src/app/(marketing)/unelte/fisa-instruire-ssm/page.tsx` (azi `:28-33`)
  - `src/app/(marketing)/unelte/fisa-evaluare/page.tsx` (azi `:27-32`)
  - `src/app/(marketing)/unelte/calculator-salariu/page.tsx` (azi `:34-41`)
- Modify: `src/content/landing/harta.ts`: `actualizat` pe `/unelte/foaie-de-pontaj`, `/unelte/cerere-concediu-de-odihna` și `/unelte/fisa-evaluare`, singurele trei al căror text de snippet se schimbă (la evaluare, doar „model” în titlu). (Corectat la verificare, 8 oct 2026: prima versiune rescria și descrierea condicii și arunca textul lui E14, care numește sâmbetele, turele și orele calculate. Condica păstrează acum titlul și descrierea lui E14.)
- Modify: `scripts/checks/lastmod-fara-continut.txt`, în al doilea commit, pentru cele cinci pagini mutate fără text nou (condica, foaia de parcurs, fișa SSM, calculatorul de salariu, calculatorul de zile de concediu)

**Interfețe:**
- Consumă: `todayInBucharest(): DateString` (`@/lib/format/date:115`); `metadatePagina({ titlu, descriere, cale })` (`../../_componente/metadate`, citit).
- Produce:
  ```ts
  export type MetaUnealta = Readonly<{ titlu: string; descriere: string; termen: string }>;
  export const META_UNELTE: Readonly<Record<string, MetaUnealta>>;
  export function metaUnealta(
    cale: string,
    azi?: string,
  ): Readonly<{ titlu: string; descriere: string; cale: string }>;
  ```

- [ ] **Pasul 1: Scrie testul care pică**: `src/content/landing/seo-unelte.test.ts`

```ts
// src/content/landing/seo-unelte.test.ts
import { existsSync, readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { META_UNELTE, metaUnealta } from "./seo-unelte";

const DIR = "src/app/(marketing)/unelte";
const PAGINI = readdirSync(DIR)
  .filter((d) => existsSync(`${DIR}/${d}/page.tsx`))
  .map((d) => `/unelte/${d}`)
  .sort();

/** „Fișa de instruire SSM” → {fisa, de, instruire, ssm}: fără diacritice, fără punctuație. */
function cuvinte(text: string): ReadonlySet<string> {
  return new Set(
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/gu, "")
      .toLowerCase()
      .split(/[^a-z0-9]+/u)
      .filter((c) => c !== ""),
  );
}

const ZILE = ["2026-01-15", "2026-10-08", "2026-12-31", "2035-12-31"] as const;

describe("metadatele uneltelor", () => {
  it("fiecare unealtă de pe disc are o intrare, și nicio intrare nu e în plus", () => {
    expect(Object.keys(META_UNELTE).sort()).toEqual(PAGINI);
  });

  it("titlul are cel mult 48 de caractere în orice an, fără marcă", () => {
    for (const cale of PAGINI) {
      for (const azi of ZILE) {
        const { titlu } = metaUnealta(cale, azi);
        expect(titlu.length, `${cale} ${azi}: ${titlu}`).toBeLessThanOrEqual(48);
        expect(titlu, cale).not.toMatch(/Administrativo|\{/u);
      }
    }
  });

  it("descrierea are 70–160 de caractere și e unică", () => {
    const descrieri = PAGINI.map((c) => metaUnealta(c, "2026-10-08").descriere);
    for (const [i, d] of descrieri.entries()) {
      expect(d.length, PAGINI[i]).toBeGreaterThanOrEqual(70);
      expect(d.length, PAGINI[i]).toBeLessThanOrEqual(160);
    }
    expect(new Set(descrieri).size).toBe(descrieri.length);
  });

  it("titlul conține fiecare cuvânt al termenului principal", () => {
    for (const cale of PAGINI) {
      const meta = META_UNELTE[cale];
      expect(meta, cale).toBeDefined();
      if (meta === undefined) continue;
      const dinTitlu = [...cuvinte(metaUnealta(cale, "2026-10-08").titlu)];
      for (const c of cuvinte(meta.termen)) {
        // „de” lipsește din forma căutată sau din titlu fără să schimbe intenția.
        if (c === "de") continue;
        // Prefix, nu egalitate: „angajati” din căutare e „angajaților” în titlu,
        // „concedii” e „concediilor” — aceeași intenție, altă flexiune.
        expect(
          dinTitlu.some((t) => t.startsWith(c)),
          `${cale}: „${c}” din „${meta.termen}”`,
        ).toBe(true);
      }
      expect(meta.termen, cale).toMatch(/^[a-z0-9 ]+$/u);
    }
  });

  it("anul din titlu e anul cererii, nu al build-ului", () => {
    expect(metaUnealta("/unelte/cerere-concediu-de-odihna", "2027-03-01").titlu).toContain("2027");
    expect(metaUnealta("/unelte/cerere-concediu-de-odihna", "2026-12-31").titlu).toContain("2026");
  });

  it("fiecare pagină de unealtă își ia metadatele de aici", () => {
    for (const cale of PAGINI) {
      const sursa = readFileSync(`src/app/(marketing)${cale}/page.tsx`, "utf8");
      expect(sursa, cale).toMatch(/metaUnealta\((?:"[^"]+"|CALE)/u);
      expect(sursa, cale).not.toMatch(/metadatePagina\(\{/u);
    }
  });

  it("o cale necunoscută e o eroare, nu un titlu gol", () => {
    expect(() => metaUnealta("/unelte/inexistenta")).toThrow(/n-are metadate/u);
    expect(() => metaUnealta("constructor")).toThrow(/n-are metadate/u);
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/content/landing/seo-unelte.test.ts
```

Așteptat: `Failed to resolve import "./seo-unelte"`. Toate testele cad la import.

- [ ] **Pasul 3: Implementarea minimă**

`src/content/landing/seo-unelte.ts`:

```ts
// src/content/landing/seo-unelte.ts
import { todayInBucharest } from "@/lib/format/date";

/**
 * Titlul și descrierea fiecărei unelte gratuite, într-un singur loc.
 *
 * ── DE CE AICI, NU ÎN `page.tsx` ──────────────────────────────────────────
 * Până la 8 oct 2026 fiecare pagină își scria singură titlul, iar planurile
 * paralele (pontaj, cerere, calculator) le rescriau pe rând. Foaia de pontaj
 * era cât pe ce să-și piardă „lunar” din titlu — singurul termen pentru care
 * Google o afișa (poziția 28, 7 afișări în 90 de zile). Aici fiecare unealtă
 * își declară și TERMENUL PRINCIPAL, iar testul cere ca titlul să-l conțină și
 * ca termenul să fie urmărit în `docs/comercial/cuvinte-tinta.tsv`.
 *
 * ── DESCRIEREA ────────────────────────────────────────────────────────────
 * Ce primește omul, în ordinea în care decide: documentul, ce face singur,
 * formatul, „fără cont”. Între 70 și 160 de caractere: Google taie pe la 155.
 *
 * ── `{an}` ────────────────────────────────────────────────────────────────
 * Anul calendaristic al zilei cererii, în România. Paginile care îl folosesc
 * își declară metadatele cu `generateMetadata`, nu cu o constantă: o constantă
 * se evaluează la build și ar fi ținut „2026” în titlu și în ianuarie 2027.
 */

export type MetaUnealta = Readonly<{
  /** Fără marcă — o adaugă șablonul din layout. Cel mult 48 de caractere după înlocuiri. */
  titlu: string;
  descriere: string;
  /** Forma căutată, fără diacritice, ca în `docs/comercial/cuvinte-tinta.tsv`. */
  termen: string;
}>;

export const META_UNELTE: Readonly<Record<string, MetaUnealta>> = {
  "/unelte/foaie-de-pontaj": {
    titlu: "Foaie de pontaj lunar: model PDF, Word, Excel",
    descriere:
      "Foaie de pontaj lunar pentru orice lună, cu weekendurile și sărbătorile legale marcate singure. Descarci în PDF, Word sau Excel cu totaluri, fără cont.",
    termen: "foaie de pontaj lunar",
  },
  "/unelte/condica-de-prezenta": {
    // Titlul și descrierea scrise la E14 (sâmbete și ture, pauza, orele calculate).
    titlu: "Condica de prezență: model Word, PDF și Excel",
    descriere:
      "Condica de prezență pentru orice lună, cu sâmbete și ture, ora sosirii și a plecării, pauza și orele calculate în Excel. Word, PDF sau Excel, gratuit.",
    termen: "condica de prezenta model",
  },
  "/unelte/cerere-concediu-de-odihna": {
    // Titlul e al lui F14 („Word/PDF gratuit”, 48 de caractere cu anul pe 4 cifre).
    titlu: "Cerere concediu de odihnă {an}, Word/PDF gratuit",
    descriere:
      "Cerere de concediu de odihnă completată online: scrii numele și perioada, iar zilele lucrătoare se numără singure, fără sărbători. Word sau PDF, fără cont.",
    termen: "cerere concediu de odihna",
  },
  "/unelte/calculator-zile-concediu": {
    titlu: "Calculator zile de concediu de odihnă {an}",
    descriere:
      "Câte zile de concediu de odihnă ți se cuvin în anul angajării sau al plecării: minimul legal, zilele suplimentare și calculul proporțional. Gratuit, fără cont.",
    termen: "calculator zile concediu de odihna",
  },
  "/unelte/foaie-de-parcurs": {
    // Titlul și descrierea scrise la G8 (cele patru elemente din normele fiscale).
    titlu: "Foaie de parcurs: model Word, PDF și Excel",
    descriere:
      "Foaie de parcurs cu cele 4 elemente cerute de normele Codului fiscal: mai multe curse pe zi, alimentări, Excel cu formule. Gratuită, în Word și PDF, fără cont.",
    termen: "foaie de parcurs model",
  },
  "/unelte/fisa-instruire-ssm": {
    // Titlul și descrierea scrise la H7 (anexa 11 completă).
    titlu: "Fișa individuală de instruire SSM: model gratuit",
    descriere:
      "Fișa individuală de instruire SSM completă, după anexa 11 la HG 1425/2006: la angajare, periodică, suplimentară, testări, control medical. Word sau PDF.",
    termen: "fisa instruire ssm model",
  },
  "/unelte/fisa-evaluare": {
    // Descrierea scrisă la I9. Titlul de la I9 („Fișă de
    // evaluare angajați, cu nota calculată”) pierdea „model” din termenul urmărit
    // în `cuvinte-tinta.tsv`; același principiu ca „lunar” la pontaj. 48 de caractere.
    titlu: "Fișă de evaluare angajați: model, nota calculată",
    descriere:
      "Fișa de evaluare a angajaților: criterii pe tipuri de post, pondere, notă 1–5, nota finală și calificativul calculate. Excel cu formule, Word sau PDF.",
    termen: "fisa evaluare angajati model",
  },
  "/unelte/calculator-salariu": {
    // Descrierea scrisă la C11, 154 de caractere.
    titlu: "Calcul salariu net și brut 2026: calculator",
    descriere:
      "Calcul salariu net din brut și brut din net, 2026: CAS, CASS, impozit, deducerea pentru copii și sub 26 de ani, tichete de masă, timp parțial, cost firmă.",
    termen: "calcul salariu net",
  },
};

/**
 * Datele pentru `metadatePagina`. `azi` e ziua cererii (`YYYY-MM-DD`, ora
 * României); parametrul există pentru teste.
 *
 * `Object.hasOwn`, ca în `registru.ts`: indexarea directă ar întoarce
 * `Object.prototype.constructor` pentru „constructor”.
 */
export function metaUnealta(
  cale: string,
  azi: string = todayInBucharest(),
): Readonly<{ titlu: string; descriere: string; cale: string }> {
  const meta = Object.hasOwn(META_UNELTE, cale) ? META_UNELTE[cale] : undefined;
  if (meta === undefined) throw new Error(`Unealta ${cale} n-are metadate în seo-unelte.ts.`);
  return {
    titlu: meta.titlu.replaceAll("{an}", azi.slice(0, 4)),
    descriere: meta.descriere,
    cale,
  };
}
```

Intrarea `/unelte/calculator-salariu` rămâne cu „2026” scris, nu `{an}`: titlul descrie valorile pe care le calculează pagina, nu anul calendaristic. Banner-ul de după 31.12.2026 e al lui C3.

Paginile. În fiecare se adaugă importul (în grupul `@/content/landing/*`, ordonat alfabetic):

```ts
import { metaUnealta } from "@/content/landing/seo-unelte";
```

**`foaie-de-pontaj/page.tsx`**. Vechi: blocul de mai jos, în forma de azi sau, după E13, cu `titlu: "Foaie de pontaj Excel cu formule, PDF și Word"` și descrierea lui E13 (`E-pontaj-condica.md:4823`). Se înlocuiește oricare dintre ele.

```ts
export const metadata: Metadata = metadatePagina({
  titlu: "Foaie de pontaj lunar: model PDF, Word, Excel",
  descriere:
    "Model de foaie colectivă de pontaj pentru orice lună, cu weekendurile și sărbătorile legale marcate automat. Descarci în PDF, Word sau Excel, fără cont.",
  cale: "/unelte/foaie-de-pontaj",
});
```

Nou:

```ts
// Titlul și descrierea: `seo-unelte.ts` (8 oct 2026). „lunar” rămâne în titlu:
// e singurul termen pentru care Google afișa pagina.
export const metadata: Metadata = metadatePagina(metaUnealta("/unelte/foaie-de-pontaj"));
```

**`condica-de-prezenta/page.tsx`**. Vechi: după E14, blocul lui E14 (`E-pontaj-condica.md:5426-5431`, descrierea „…cu sâmbete și ture…”), care e chiar textul din `META_UNELTE`; înainte de E14, forma de azi, dată mai jos. Se înlocuiește oricare:

```ts
export const metadata: Metadata = metadatePagina({
  titlu: "Condica de prezență: model Word, PDF și Excel",
  descriere:
    "Condica de prezență completată cu zilele lucrătoare ale lunii, ora sosirii, ora plecării și semnătura. Model gratuit în Word, PDF sau Excel. E obligatorie?",
  cale: "/unelte/condica-de-prezenta",
});
```

Nou:

```ts
export const metadata: Metadata = metadatePagina(metaUnealta("/unelte/condica-de-prezenta"));
```

**`cerere-concediu-de-odihna/page.tsx`**. Vechi: după F14 blocul e cel din `F-cerere-concediu.md:4868-4877` (comentariul „Word/PDF gratuit…”, titlul cu „, Word/PDF gratuit”, `cale: PAGINA_CERERE`); înainte de F14, forma de azi (`:61-68`), dată mai jos. Se înlocuiește oricare, cu comentariu cu tot. Dacă `PAGINA_CERERE` nu mai e folosit în pagină după înlocuire, se scoate din import (lint-ul îl semnalează).

```ts
export function generateMetadata(): Metadata {
  return metadatePagina({
    titlu: `Cerere concediu de odihnă ${todayInBucharest().slice(0, 4)}: model Word, PDF`,
    descriere:
      "Cerere de concediu de odihnă cu zilele lucrătoare calculate, plus variantele fără plată și pentru evenimente familiale. Model gratuit Word sau PDF, fără cont.",
    cale: "/unelte/cerere-concediu-de-odihna",
  });
}
```

Nou:

```ts
export function generateMetadata(): Metadata {
  return metadatePagina(metaUnealta("/unelte/cerere-concediu-de-odihna"));
}
```

Dacă `todayInBucharest` nu mai e folosit în pagină după înlocuire, se scoate din importul de la `@/lib/format/date`. Lint-ul îl semnalează ca neutilizat.

**`calculator-zile-concediu/page.tsx`** (F13). Vechi:

```ts
export function generateMetadata(): Metadata {
  return metadatePagina({
    titlu: `Calculator zile de concediu de odihnă ${todayInBucharest().slice(0, 4)}`,
    descriere:
      "Câte zile de concediu de odihnă ți se cuvin în anul angajării sau al plecării: minimul legal, zilele suplimentare și calculul proporțional. Gratuit, fără cont.",
    cale: CALE,
  });
}
```

Nou:

```ts
export function generateMetadata(): Metadata {
  return metadatePagina(metaUnealta(CALE));
}
```

`todayInBucharest` rămâne importat acolo: pagina îl folosește și pentru `anCurent`.

**`foaie-de-parcurs/page.tsx`**, **`fisa-instruire-ssm/page.tsx`**, **`fisa-evaluare/page.tsx`**, **`calculator-salariu/page.tsx`**. În fiecare, blocul `export const metadata: Metadata = metadatePagina({ … });` (textele scrise de G8, H7, I9 și C11 sunt cele din `META_UNELTE`; singura diferență e „model” în titlul fișei de evaluare) devine, cu calea paginii:

```ts
export const metadata: Metadata = metadatePagina(metaUnealta("/unelte/foaie-de-parcurs"));
```

```ts
export const metadata: Metadata = metadatePagina(metaUnealta("/unelte/fisa-instruire-ssm"));
```

```ts
export const metadata: Metadata = metadatePagina(metaUnealta("/unelte/fisa-evaluare"));
```

```ts
export const metadata: Metadata = metadatePagina(metaUnealta("/unelte/calculator-salariu"));
```

Comentariile de deasupra blocurilor (de ce titlul arată așa) rămân. La calculator, comentariul de la `:35-36` stă ÎN obiectul care dispare („7 oct 2026: titlul pe forma căutată…”), deci se mută deasupra lui `export const metadata`, neschimbat.

**`harta.ts`**. Pe blocurile `cale: "/unelte/foaie-de-pontaj"`, `cale: "/unelte/cerere-concediu-de-odihna"` și `cale: "/unelte/fisa-evaluare"`, `actualizat` devine data commitului (`date +%F`). Deasupra fiecărui `actualizat` se adaugă comentariul `// <data>: descrierea din rezultat rescrisă pe intenție (seo-unelte.ts).` (la fișa de evaluare: `// <data>: „model” în titlu (seo-unelte.ts).`)

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/content/landing/seo-unelte.test.ts "src/app/(marketing)/_componente/descrieri.test.ts" "src/app/(marketing)/_componente/metadate.test.ts" src/content/landing/continut.test.ts
```

Așteptat: toate verzi. `descrieri.test.ts` reimportă paginile și vede aceleași descrieri, acum din `META_UNELTE`. Apoi lanțul:

```bash
cd /srv/apps/ERP && pnpm typecheck && pnpm check:server && pnpm lint && pnpm test && pnpm exec prettier --check src/content/landing/seo-unelte.ts src/content/landing/seo-unelte.test.ts src/content/landing/harta.ts "src/app/(marketing)/unelte"
```

- [ ] **Pasul 5: Verificare locală a HTML-ului**

```bash
cd /srv/apps/ERP && (pnpm dev -H 127.0.0.1 -p 3917 > /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/k1-dev.log 2>&1 &) ; sleep 25
for c in foaie-de-pontaj condica-de-prezenta cerere-concediu-de-odihna calculator-zile-concediu foaie-de-parcurs fisa-instruire-ssm fisa-evaluare calculator-salariu; do curl -s "http://127.0.0.1:3917/unelte/$c" | grep -o '<title>[^<]*</title>\|<meta name="description" content="[^"]*"' ; done
```

Trebuie să iasă 8 perechi `<title>`/`description`, identice cu `META_UNELTE`, cu „ · Administrativo” la titlu și cu anul curent la cerere și la calculatorul de zile. Serverul se oprește într-un apel separat, cu tiparul `391[7]` (memoria `erp-pkill-se-omoara-singur`), iar apoi se șterge `.next/dev/types/validator.ts` dacă typecheck-ul cade în `.next/dev/types` (memoria `erp-next-dev-corupe-validator`):

```bash
pkill -f "next dev.*391[7]" ; rm -f /srv/apps/ERP/.next/dev/types/validator.ts /srv/apps/ERP/.next/dev/types/routes.d.ts
```

- [ ] **Commit**: două commit-uri în același push. Al doilea scutește de lastmod cele cinci pagini mutate fără text nou.

```bash
cd /srv/apps/ERP
P="src/app/(marketing)/unelte"
CAI=(src/content/landing/seo-unelte.ts src/content/landing/seo-unelte.test.ts src/content/landing/harta.ts "$P/foaie-de-pontaj/page.tsx" "$P/condica-de-prezenta/page.tsx" "$P/cerere-concediu-de-odihna/page.tsx" "$P/calculator-zile-concediu/page.tsx" "$P/foaie-de-parcurs/page.tsx" "$P/fisa-instruire-ssm/page.tsx" "$P/fisa-evaluare/page.tsx" "$P/calculator-salariu/page.tsx")
git status --short -- "${CAI[@]}"
git fetch origin main
git diff --name-only HEAD origin/main -- "${CAI[@]}"
git add -- src/content/landing/seo-unelte.ts src/content/landing/seo-unelte.test.ts
git commit --only -m "feat(unelte): titlul și descrierea uneltelor dintr-o singură sursă, cu poartă" -m "seo-unelte.ts ține titlul, descrierea și termenul principal al fiecărei unelte; testul cere titlu ≤ 48 în orice an, descriere 70–160, termenul în titlu. Foaia de pontaj păstrează „lunar”; descrierea cererii de concediu, rescrisă pe ce primește omul." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "${CAI[@]}"
SHA=$(git rev-parse --short HEAD)
# Un `>>` pe un fișier fără linie nouă finală lipește două rânduri (memoria `erp-timer-systemd-nu-ajunge`).
[ -z "$(tail -c1 scripts/checks/lastmod-fara-continut.txt)" ] || echo >> scripts/checks/lastmod-fara-continut.txt
printf '%s 8 oct 2026: metadatele uneltelor mutate în seo-unelte.ts — titlul și descrierea neschimbate pe condică, parcurs, SSM, calculatorul de salariu și calculatorul de zile de concediu\n' "$SHA" >> scripts/checks/lastmod-fara-continut.txt
git commit --only -m "chore(seo): lastmod — mutarea metadatelor nu e schimbare de conținut" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- scripts/checks/lastmod-fara-continut.txt
node scripts/checks/lastmod.mjs
git merge origin/main
git push origin main
```

`lastmod.mjs` trebuie să spună „toate datele din sitemap sunt cel puțin la zi cu conținutul lor” ÎNAINTE de push; dacă pică, se ridică data semnalată în `harta.ts` și se face un al treilea commit, `git commit --only -m "chore(seo): lastmod pe <cale>" -- src/content/landing/harta.ts`, tot înainte de push (memoria `erp-lastmod-acelasi-commit`).

---
### Task K2: Hub-ul `/unelte` pe categorii, cu poarta „fiecare unealtă e în hub”

Rulează după A7, care rescrie a doua bandă a hub-ului, după F13, care adaugă al optulea rând, și după C11, E13, E14, F14, G8, H7 și I9, care schimbă notele din `PAGINI`. Taskul atinge doar importurile, `PAGINI` și prima bandă.

**Fișiere:**
- Create: `src/content/landing/hub-unelte.ts`
- Test: `src/content/landing/hub-unelte.test.ts`
- Modify: `src/app/(marketing)/unelte/page.tsx`: importurile (azi `:2-21`), constanta `PAGINI` (azi `:41-85`, inclusiv rândul adăugat de F13 și notele schimbate de C11, E13, E14, F14) și prima `Banda` (azi `:103-118`)
- Modify: `src/content/landing/harta.ts`, `actualizat` pe `/unelte`

**Interfețe:**
- Consumă: `ANTET_FOAIE_PONTAJ`, `ANTET_CONDICA`, `ANTET_CERERE_CONCEDIU`, `ANTET_CALCULATOR_CONCEDIU` (F13), `ANTET_CALCULATOR`, `ANTET_FISA_SSM`, `ANTET_FISA_EVALUARE`, `ANTET_FOAIE_PARCURS` din `./unelte`; `ListaHub({ pagini })` (`../_componente/lista-hub`, citit: acceptă `nota?: string`); `Banda({ id, inaltime, supratitlu, titlu, lead })`.
- Produce:
  ```ts
  export type RandHub = Readonly<{ href: string; titlu: string; lead: string; nota: string }>;
  export type GrupHub = Readonly<{ id: string; supratitlu: string; titlu: string; lead: string; pagini: readonly RandHub[] }>;
  export const GRUPURI_HUB: readonly GrupHub[];
  ```

- [ ] **Pasul 1: Scrie testul care pică**: `src/content/landing/hub-unelte.test.ts`

```ts
// src/content/landing/hub-unelte.test.ts
import { existsSync, readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { GRUPURI_HUB } from "./hub-unelte";

const DIR = "src/app/(marketing)/unelte";
const PAGINI = readdirSync(DIR)
  .filter((d) => existsSync(`${DIR}/${d}/page.tsx`))
  .map((d) => `/unelte/${d}`)
  .sort();

describe("hub-ul uneltelor", () => {
  it("fiecare unealtă de pe disc apare exact o dată, într-o singură categorie", () => {
    const hrefuri = GRUPURI_HUB.flatMap((g) => g.pagini.map((p) => p.href));
    expect([...hrefuri].sort()).toEqual(PAGINI);
    expect(new Set(hrefuri).size).toBe(hrefuri.length);
  });

  it("categoriile au ancore unice, text și cel puțin o unealtă", () => {
    const iduri = GRUPURI_HUB.map((g) => g.id);
    expect(new Set(iduri).size).toBe(iduri.length);
    for (const g of GRUPURI_HUB) {
      expect(g.id, g.titlu).toMatch(/^[a-z][a-z-]*$/u);
      // `documentul` și `rezultat` sunt ancorele uneltelor; hub-ul nu le refolosește.
      expect(["documentul", "rezultat"], g.id).not.toContain(g.id);
      expect(g.pagini.length, g.id).toBeGreaterThanOrEqual(1);
      for (const p of g.pagini) {
        expect(p.titlu.trim(), p.href).not.toBe("");
        expect(p.lead.trim(), p.href).not.toBe("");
        expect(p.nota.trim(), p.href).not.toBe("");
      }
    }
  });

  it("pagina hub-ului randează categoriile, nu o listă scrisă în pagină", () => {
    const sursa = readFileSync(`${DIR}/page.tsx`, "utf8");
    expect(sursa).toContain("GRUPURI_HUB.map(");
    expect(sursa).not.toMatch(/const PAGINI\s*=/u);
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/content/landing/hub-unelte.test.ts
```

Așteptat: `Failed to resolve import "./hub-unelte"`.

- [ ] **Pasul 3: Implementarea minimă**

`src/content/landing/hub-unelte.ts`:

```ts
// src/content/landing/hub-unelte.ts
import {
  AN_MAX as AN_MAX_CERERE,
  AN_MIN as AN_MIN_CERERE,
} from "@/app/(marketing)/unelte/cerere-concediu-de-odihna/cerere";
import { AN_MAX, AN_MIN, MAX_ANGAJATI } from "@/app/(marketing)/unelte/foaie-de-pontaj/foaie";

import {
  ANTET_CALCULATOR,
  ANTET_CALCULATOR_CONCEDIU,
  ANTET_CERERE_CONCEDIU,
  ANTET_CONDICA,
  ANTET_FISA_EVALUARE,
  ANTET_FISA_SSM,
  ANTET_FOAIE_PARCURS,
  ANTET_FOAIE_PONTAJ,
} from "./unelte";

/**
 * Hub-ul `/unelte`, pe categorii.
 *
 * ── DE CE CATEGORII ───────────────────────────────────────────────────────
 * O listă plată mergea la șapte rânduri. Odată cu uneltele noi din oct 2026
 * (zile lucrătoare, demisie, programarea concediilor, adeverință) trece de
 * doisprezece, iar omul care caută „ceva pentru concedii” trebuia să citească
 * tot. Fiecare categorie e o `Banda` cu ancoră și `h2`, iar uneltele rămân `h3`
 * (`ListaHub`) — structura pe care o citesc și cititorul de ecran, și motorul.
 *
 * Titlurile și lead-urile vin din antetele paginilor (`unelte.ts`), nu se
 * rescriu aici. Nota e a hub-ului: ce te face să alegi unealta, într-un rând.
 * Notele de mai jos sunt cele scrise de secțiunile care dețin uneltele (C11,
 * E13, E14, F13, F14, G8, H7, I9), mutate aici neschimbate. Anii vin din
 * constantele uneltelor, nu se scriu de mână.
 *
 * ── POARTA ────────────────────────────────────────────────────────────────
 * `hub-unelte.test.ts` compară lista cu directoarele de pe disc: o unealtă nouă
 * fără rând aici pică testul, în același commit.
 */

export type RandHub = Readonly<{ href: string; titlu: string; lead: string; nota: string }>;

export type GrupHub = Readonly<{
  id: string;
  supratitlu: string;
  titlu: string;
  lead: string;
  pagini: readonly RandHub[];
}>;

const rand = (
  href: string,
  antet: Readonly<{ titlu: string; lead: string }>,
  nota: string,
): RandHub => ({ href, titlu: antet.titlu, lead: antet.lead, nota });

export const GRUPURI_HUB: readonly GrupHub[] = [
  {
    id: "pontaj",
    supratitlu: "Pontaj și prezență",
    titlu: "Orele lunii, pe hârtie sau în Excel",
    lead: "Foaia de pontaj și condica de prezență, cu weekendurile și sărbătorile legale calculate pentru orice lună.",
    pagini: [
      rand(
        "/unelte/foaie-de-pontaj",
        ANTET_FOAIE_PONTAJ,
        `${AN_MIN}–${AN_MAX} · colectivă sau individuală · normă pe angajat · Excel cu formule · până la ${MAX_ANGAJATI} de angajați`,
      ),
      rand(
        "/unelte/condica-de-prezenta",
        ANTET_CONDICA,
        "toate zilele, inclusiv ture · ore lucrate calculate în Excel · Word, PDF, Excel",
      ),
    ],
  },
  {
    id: "concedii",
    supratitlu: "Concedii",
    titlu: "Zilele de concediu, numărate corect",
    lead: "Cererea cu zilele lucrătoare calculate și câte zile ți se cuvin într-un an.",
    pagini: [
      rand(
        "/unelte/cerere-concediu-de-odihna",
        ANTET_CERERE_CONCEDIU,
        `${AN_MIN_CERERE}–${AN_MAX_CERERE} · odihnă, fără plată, paternal, îngrijitor · Word, PDF`,
      ),
      rand(
        "/unelte/calculator-zile-concediu",
        ANTET_CALCULATOR_CONCEDIU,
        "minimul legal, zile suplimentare, an lucrat parțial · fără cont",
      ),
    ],
  },
  {
    id: "salarii",
    supratitlu: "Salarii",
    titlu: "Cât iese net și cât costă firma",
    lead: "Brut, net și costul total, cu valorile legale în vigoare.",
    pagini: [
      rand(
        "/unelte/calculator-salariu",
        ANTET_CALCULATOR,
        "net și brut · tichete, deduceri, timp parțial · ambele perioade din 2026",
      ),
    ],
  },
  {
    id: "documente",
    supratitlu: "SSM, evaluări, mașini",
    titlu: "Fișele cerute la control și la evaluare",
    lead: "Documentele pe care le cere inspectorul sau contabilul, cu datele trecute o singură dată.",
    pagini: [
      rand(
        "/unelte/fisa-instruire-ssm",
        ANTET_FISA_SSM,
        "toate rubricile anexei 11 la HG 1425/2006 · Word, PDF",
      ),
      rand(
        "/unelte/fisa-evaluare",
        ANTET_FISA_EVALUARE,
        "nota finală calculată · Excel cu formule, Word, PDF",
      ),
      rand(
        "/unelte/foaie-de-parcurs",
        ANTET_FOAIE_PARCURS,
        "cele 4 elemente din normele fiscale · până la 4 curse pe zi · Excel cu formule",
      ),
    ],
  },
];
```

**`src/app/(marketing)/unelte/page.tsx`**. Importul. Vechi (azi `:6-15`, plus `ANTET_CALCULATOR_CONCEDIU` adăugat de F13):

```ts
import { RO } from "@/content/landing/ro";
import {
  ANTET_CALCULATOR,
  ANTET_CERERE_CONCEDIU,
  ANTET_CONDICA,
  ANTET_FISA_EVALUARE,
  ANTET_FISA_SSM,
  ANTET_FOAIE_PARCURS,
  ANTET_FOAIE_PONTAJ,
} from "@/content/landing/unelte";
```

Nou:

```ts
import { GRUPURI_HUB } from "@/content/landing/hub-unelte";
import { RO } from "@/content/landing/ro";
```

Importul `import { AN_MAX, AN_MIN, MAX_ANGAJATI } from "./foaie-de-pontaj/foaie";` rămâne: îl folosește banda a doua. Importul adăugat de F14 (`AN_MAX as AN_MAX_CERERE, AN_MIN as AN_MIN_CERERE` din `./cerere-concediu-de-odihna/cerere`, `F-cerere-concediu.md:5434-5440`) se șterge: îl folosea doar nota cererii din `PAGINI`, iar lint-ul l-ar semnala neutilizat. Constanta `PAGINI` se șterge cu totul, de la `const PAGINI = [` până la `];` inclusiv. Înainte de ștergere, fiecare `nota` din `PAGINI` se compară cu cea din `GRUPURI_HUB`; dacă o secțiune a scris între timp altă notă decât cea din plan, în `GRUPURI_HUB` intră nota de pe `main`. Comentariul de deasupra exportului implicit („Scurtătura spre luna curentă NU poartă parametri…”) rămâne.

Prima bandă. Vechi:

```tsx
      <Banda inaltime="medie" supratitlu="Toate uneltele" titlu="Gata de folosit">
        <ListaHub pagini={PAGINI} />
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <p className="font-mk-date text-mk-text-slab text-[0.6875rem] tracking-[0.14em] uppercase">
            Sari direct la
          </p>
          <Link
            href="/unelte/foaie-de-pontaj"
            className="text-[0.9375rem] underline underline-offset-4"
          >
            Foaia de pontaj a lunii curente
          </Link>
        </div>
      </Banda>
```

Nou:

```tsx
      <Banda inaltime="scurta" supratitlu="Toate uneltele" titlu="Gata de folosit">
        {/* Cuprinsul categoriilor: pe telefon, a patra categorie e la trei
            ecrane distanță. Ancorele sunt `id`-urile benzilor de mai jos. */}
        <nav aria-label="Categoriile de unelte" className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
          {GRUPURI_HUB.map((g) => (
            <a
              key={g.id}
              href={`#${g.id}`}
              className="text-[0.9375rem] underline underline-offset-4"
            >
              {g.supratitlu}
            </a>
          ))}
          <Link
            href="/unelte/foaie-de-pontaj"
            className="text-[0.9375rem] underline underline-offset-4"
          >
            Foaia de pontaj a lunii curente
          </Link>
        </nav>
      </Banda>

      {GRUPURI_HUB.map((g) => (
        <Banda
          key={g.id}
          id={g.id}
          inaltime="scurta"
          supratitlu={g.supratitlu}
          titlu={g.titlu}
          lead={g.lead}
        >
          <ListaHub pagini={g.pagini} />
        </Banda>
      ))}
```

**`harta.ts`**: pe blocul `cale: "/unelte"`, `actualizat` devine data commitului, cu comentariul `// <data>: hub-ul pe categorii (hub-unelte.ts).`

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/content/landing/hub-unelte.test.ts src/content/landing/continut.test.ts "src/app/(marketing)/_componente/descrieri.test.ts"
cd /srv/apps/ERP && pnpm typecheck && pnpm check:server && pnpm lint && pnpm test && pnpm exec prettier --check src/content/landing/hub-unelte.ts src/content/landing/hub-unelte.test.ts "src/app/(marketing)/unelte/page.tsx" src/content/landing/harta.ts
```

- [ ] **Pasul 5: Verificare headless la 360 px și 1366 px**

Se pornește `pnpm dev -H 127.0.0.1 -p 3917` ca la K1, Pasul 5. Apoi:

```bash
cd /srv/apps/ERP && cat > /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/k2-hub.mjs <<'JS'
import { chromium } from "/srv/apps/ERP/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core/index.mjs";
const browser = await chromium.launch({ executablePath: "/home/miro/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell" });
for (const latime of [360, 1366]) {
  const p = await browser.newPage({ viewport: { width: latime, height: 900 } });
  await p.goto("http://127.0.0.1:3917/unelte", { waitUntil: "networkidle" });
  const r = await p.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
    h2: [...document.querySelectorAll("section h2")].map((h) => h.textContent?.trim()),
    h3: document.querySelectorAll("section h3").length,
    ancore: [...document.querySelectorAll('nav[aria-label="Categoriile de unelte"] a')].map((a) => a.getAttribute("href")),
  }));
  console.log(latime, JSON.stringify(r));
  await p.screenshot({ path: `/tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/k2-hub-${latime}.png`, fullPage: true });
}
await browser.close();
JS
node /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/k2-hub.mjs
```

Trebuie să iasă `sw === cw` la ambele lățimi. `h2` trebuie să conțină cele patru titluri de categorie, după „Gata de folosit”. `h3` trebuie să fie egal cu numărul de unelte. `ancore` trebuie să fie `["#pontaj","#concedii","#salarii","#documente","/unelte/foaie-de-pontaj"]`. Capturile se deschid cu Read și se verifică vizual la 360 px: nicio etichetă tăiată, cuprinsul pe mai multe rânduri. Serverul se oprește ca la K1.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
CAI=(src/content/landing/hub-unelte.ts src/content/landing/hub-unelte.test.ts "src/app/(marketing)/unelte/page.tsx" src/content/landing/harta.ts)
git status --short -- "${CAI[@]}"
git fetch origin main
git diff --name-only HEAD origin/main -- "${CAI[@]}"
git add -- src/content/landing/hub-unelte.ts src/content/landing/hub-unelte.test.ts
git commit --only -m "feat(unelte): hub-ul pe categorii, cu poarta „fiecare unealtă e în hub”" -m "Pontaj, concedii, salarii și documente, fiecare cu ancoră și h2; lista vine din hub-unelte.ts, iar testul o compară cu directoarele de pe disc." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "${CAI[@]}"
node scripts/checks/lastmod.mjs
git merge origin/main
git push origin main
```

---

### Task K3: Cel puțin trei pagini trimit spre fiecare unealtă

**Fișiere:**
- Test: `src/content/landing/legaturi-unelte.test.ts` (Create)
- Modify: `src/content/landing/fise-module.ts`: fișa `kpi` (între `legaturi` și `nuFace`, azi `:976-983`) și fișa `leave` (`ghiduri`, azi `:597-615`), plus `actualizat` pe ambele (azi `:930` și `:539`)
- Modify: `src/content/landing/legaturi.ts`, cheia `"/unelte/cerere-concediu-de-odihna"` (azi `:16-24`)
- Modify: `src/content/legal/concediu-odihna.ts`, `legaturiConexe` (azi `:256-267`)

**Interfețe:**
- Consumă: `PAGINI_LEGE` (`@/content/legal/pagini`), cu `legaturaSecundara` și `legaturiConexe?` (`src/content/legal/tipuri.ts:130,137`); `FISE` (`./fise-module:104`), cu `ghiduri?` (`:100`); `LEGATURI_CONEXE` (`./legaturi`).
- Produce: doar date. Contractul testului: pentru orice `/unelte/<x>` de pe disc, numărul de pagini DISTINCTE care trimit spre ea din ghiduri, fișe de modul și „Pe același subiect” e cel puțin 3. Hub-ul și pagina de start nu se numără, fiindcă trimit spre toate.

- [ ] **Pasul 1: Scrie testul care pică**: `src/content/landing/legaturi-unelte.test.ts`

```ts
// src/content/landing/legaturi-unelte.test.ts
import { existsSync, readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PAGINI_LEGE } from "@/content/legal/pagini";

import { FISE } from "./fise-module";
import { LEGATURI_CONEXE } from "./legaturi";

/**
 * Câte pagini trimit spre o unealtă, în afară de hub și de pagina de start.
 *
 * Auditul din 5 oct 2026: „URL is unknown to Google” pe exact paginile noi cu
 * cele mai puține legături interne. Hub-ul și pagina de start trimit spre toate
 * uneltele, deci nu spun nimic despre una anume. Contează paginile pe subiect:
 * ghidul, fișa modulului, unealta vecină.
 */
const DIR = "src/app/(marketing)/unelte";
const UNELTE = readdirSync(DIR)
  .filter((d) => existsSync(`${DIR}/${d}/page.tsx`))
  .map((d) => `/unelte/${d}`);

const faraAncora = (href: string): string => href.split("#")[0] ?? "";

function surseSpre(cale: string): ReadonlySet<string> {
  const surse = new Set<string>();
  for (const p of PAGINI_LEGE) {
    const legaturi = [p.legaturaSecundara, ...(p.legaturiConexe ?? [])];
    if (legaturi.some((l) => faraAncora(l.href) === cale)) surse.add(p.cale);
  }
  for (const [de, lista] of Object.entries(LEGATURI_CONEXE)) {
    if (de !== cale && lista.some((l) => faraAncora(l.href) === cale)) surse.add(de);
  }
  for (const f of FISE) {
    if ((f.ghiduri ?? []).some((l) => faraAncora(l.href) === cale)) surse.add(`modul:${f.cheie}`);
  }
  return surse;
}

describe("legăturile interne spre unelte", () => {
  it("fiecare unealtă primește legături din cel puțin trei pagini pe subiect", () => {
    expect(UNELTE.length).toBeGreaterThanOrEqual(8);
    for (const cale of UNELTE) {
      const surse = surseSpre(cale);
      expect(surse.size, `${cale} ← ${[...surse].join(", ")}`).toBeGreaterThanOrEqual(3);
    }
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/content/landing/legaturi-unelte.test.ts
```

Așteptat: picare pe `/unelte/fisa-evaluare ← /domenii/servicii, modul:evaluations` (2). Dacă F14 n-a adăugat legături spre calculator, picare și pe `/unelte/calculator-zile-concediu`, care primește legătură doar de pe pagina cererii, randată în JSX, nu din date.

- [ ] **Pasul 3: Implementarea minimă**

**`fise-module.ts`, fișa `kpi`.** Vechi:

```ts
      {
        catre: "employee_portal",
        text: "Omul își vede propriile ținte și cum stă față de ele, fără să întrebe.",
      },
    ],
    nuFace: [
      "Nu culege singur valorile din alte programe. Realizările se completează sau se importă, nu vin automat.",
```

Nou:

```ts
      {
        catre: "employee_portal",
        text: "Omul își vede propriile ținte și cum stă față de ele, fără să întrebe.",
      },
    ],
    // 8 oct 2026: evaluarea anuală e pasul de după ținte; fișa de evaluare avea
    // doar două pagini care trimiteau spre ea (`legaturi-unelte.test.ts`).
    ghiduri: [{ href: "/unelte/fisa-evaluare", eticheta: "Fișa de evaluare anuală: model" }],
    nuFace: [
      "Nu culege singur valorile din alte programe. Realizările se completează sau se importă, nu vin automat.",
```

În aceeași fișă, `actualizat: "2026-10-07"` (azi `:930`) devine data commitului.

**`fise-module.ts`, fișa `leave`.** Vechi (ultimul element din `ghiduri`):

```ts
      {
        href: "/unelte/cerere-concediu-de-odihna",
        eticheta: "Cerere de concediu cu zilele calculate",
      },
    ],
```

Nou:

```ts
      {
        href: "/unelte/cerere-concediu-de-odihna",
        eticheta: "Cerere de concediu cu zilele calculate",
      },
      {
        href: "/unelte/calculator-zile-concediu",
        eticheta: "Câte zile de concediu ți se cuvin: calculator",
      },
    ],
```

În aceeași fișă, `actualizat` (azi `:539`) devine data commitului.

**`legaturi.ts`, cheia `"/unelte/cerere-concediu-de-odihna"`.** Vechi:

```ts
    { eticheta: "Program de concedii: cerere, aprobare și sold", href: "/module/concedii" },
    { eticheta: "Pentru firmele de servicii și birouri", href: "/domenii/servicii" },
  ],
  "/unelte/condica-de-prezenta": [
```

Nou:

```ts
    { eticheta: "Program de concedii: cerere, aprobare și sold", href: "/module/concedii" },
    { eticheta: "Câte zile de concediu ți se cuvin pe an", href: "/unelte/calculator-zile-concediu" },
    { eticheta: "Pentru firmele de servicii și birouri", href: "/domenii/servicii" },
  ],
  "/unelte/condica-de-prezenta": [
```

Dacă F14 a pus deja în lista asta o intrare cu `href: "/unelte/calculator-zile-concediu"`, nu se mai adaugă a doua.

**`concediu-odihna.ts`, `legaturiConexe`.** Vechi:

```ts
  legaturiConexe: [
    {
      eticheta: "Unealtă: cerere de concediu cu zilele calculate",
      href: "/unelte/cerere-concediu-de-odihna",
    },
```

Nou:

```ts
  legaturiConexe: [
    {
      eticheta: "Unealtă: cerere de concediu cu zilele calculate",
      href: "/unelte/cerere-concediu-de-odihna",
    },
    {
      eticheta: "Unealtă: câte zile de concediu ți se cuvin într-un an",
      href: "/unelte/calculator-zile-concediu",
    },
```

`actualizatIso` NU se schimbă: data înseamnă verificarea textelor de lege (`scripts/checks/lastmod.mjs`, punctul 3).

**`zile-libere.ts` NU se atinge** (corectat la verificare, 8 oct 2026). Prima versiune adăuga în `legaturiConexe` o legătură spre `/unelte/foaie-de-pontaj`, dar pagina o are deja ca `legaturaSecundara` (`src/content/legal/zile-libere.ts:313-316`), iar poarta o numără de acolo: `/unelte/foaie-de-pontaj` are azi 9 surse. A doua legătură spre aceeași țintă, pe aceeași pagină, nu aduce nimic.

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/content/landing/legaturi-unelte.test.ts src/content/landing/continut.test.ts
cd /srv/apps/ERP && pnpm typecheck && pnpm check:server && pnpm lint && pnpm test && node scripts/checks/lastmod.mjs && pnpm exec prettier --check src/content/landing/legaturi-unelte.test.ts src/content/landing/fise-module.ts src/content/landing/legaturi.ts src/content/legal/concediu-odihna.ts
```

`continut.test.ts` verifică de la sine că destinațiile sunt în sitemap și că ancorele există.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
CAI=(src/content/landing/legaturi-unelte.test.ts src/content/landing/fise-module.ts src/content/landing/legaturi.ts src/content/legal/concediu-odihna.ts)
git status --short -- "${CAI[@]}"
git fetch origin main
git diff --name-only HEAD origin/main -- "${CAI[@]}"
git add -- src/content/landing/legaturi-unelte.test.ts
git commit --only -m "feat(seo): cel puțin trei pagini pe subiect trimit spre fiecare unealtă" -m "Poarta numără ghidurile, fișele de modul și „Pe același subiect”, fără hub și fără pagina de start. Fișa de evaluare primește legătura din KPI, calculatorul de zile de concediu din ghid, din modul și de lângă cerere." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "${CAI[@]}"
node scripts/checks/lastmod.mjs
git merge origin/main
git push origin main
```

---

### Task K4: Termenii-țintă ai uneltelor, păziți de test, și linia de bază

**Fișiere:**
- Modify: `docs/comercial/cuvinte-tinta.tsv` (se adaugă rânduri la final)
- Test: `src/content/landing/cuvinte-tinta.test.ts` (Create)
- Modify: `docs/comercial/cuvinte-cheie-progres.md` (ieșirea lui `scripts/seo/pozitii.py`, adăugată la final)

**Interfețe:**
- Consumă: `intrariSitemap()` (`./harta`), `ADRESA_SITE` (`./contact`), `META_UNELTE` (`./seo-unelte`, K1). Fișierul TSV are antetul `termen\tpagina` (citit: `scripts/seo/pozitii.py` îl citește cu `csv.DictReader(delimiter="\t")`).
- Produce: contractul fișierului: termen ASCII cu litere mici, fără duplicate; pagina e în sitemap; fiecare unealtă are cel puțin un termen; termenul principal din `META_UNELTE` e urmărit pe pagina lui.

- [ ] **Pasul 1: Scrie testul care pică**: `src/content/landing/cuvinte-tinta.test.ts`

```ts
// src/content/landing/cuvinte-tinta.test.ts
import { existsSync, readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ADRESA_SITE } from "./contact";
import { intrariSitemap } from "./harta";
import { META_UNELTE } from "./seo-unelte";

/**
 * `docs/comercial/cuvinte-tinta.tsv` e lista pe care `scripts/seo/pozitii.py`
 * o caută EXACT în Search Console. Un termen cu diacritice sau cu majuscule nu
 * se potrivește niciodată („equals”), iar o pagină scoasă din sitemap ar fi
 * măsurată la nesfârșit fără să mai existe.
 */
const randuri = readFileSync("docs/comercial/cuvinte-tinta.tsv", "utf8")
  .split("\n")
  .filter((r) => r.trim() !== "");
const [antet, ...date] = randuri;
const tinte = date.map((r) => {
  const [termen = "", pagina = "", ...rest] = r.split("\t");
  return { termen, pagina, rest };
});

describe("termenii-țintă", () => {
  it("are antetul pe care îl citește pozitii.py", () => {
    expect(antet).toBe("termen\tpagina");
  });

  it("fiecare rând: termen ASCII cu litere mici, unic, și o pagină din sitemap", () => {
    const sitemap = new Set(intrariSitemap().map((i) => i.url.replace(ADRESA_SITE, "") || "/"));
    const vazute = new Set<string>();
    for (const t of tinte) {
      expect(t.rest, t.termen).toEqual([]);
      expect(t.termen, t.termen).toMatch(/^[a-z0-9]+(?: [a-z0-9]+)*$/u);
      expect(vazute.has(t.termen), `dublură: ${t.termen}`).toBe(false);
      vazute.add(t.termen);
      expect(sitemap.has(t.pagina), `${t.termen} → ${t.pagina}`).toBe(true);
    }
  });

  it("fiecare unealtă e măsurată pe cel puțin un termen, iar termenul ei principal e printre ei", () => {
    const dir = "src/app/(marketing)/unelte";
    const unelte = readdirSync(dir)
      .filter((d) => existsSync(`${dir}/${d}/page.tsx`))
      .map((d) => `/unelte/${d}`);
    for (const cale of unelte) {
      const ale = tinte.filter((t) => t.pagina === cale).map((t) => t.termen);
      expect(ale.length, cale).toBeGreaterThanOrEqual(1);
      expect(ale, cale).toContain(META_UNELTE[cale]?.termen);
    }
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/content/landing/cuvinte-tinta.test.ts
```

Așteptat: picare pe `/unelte/calculator-zile-concediu` (niciun termen). Restul trece, fiindcă termenii principali din K1 au fost aleși chiar din fișier.

- [ ] **Pasul 3: Implementarea minimă**: se adaugă la finalul `docs/comercial/cuvinte-tinta.tsv`, separat cu TAB, cu linie nouă finală. Toate sunt forme din completarea automată de azi (`lucru-seo-unelte-noi/sugestii/`):

```
calculator zile concediu de odihna	/unelte/calculator-zile-concediu
calculator zile concediu odihna	/unelte/calculator-zile-concediu
cerere concediu de odihna pdf	/unelte/cerere-concediu-de-odihna
cerere concediu de odihna o zi	/unelte/cerere-concediu-de-odihna
condica de prezenta pdf	/unelte/condica-de-prezenta
foaie de parcurs model completat	/unelte/foaie-de-parcurs
foaie de parcurs excel	/unelte/foaie-de-parcurs
foaie colectiva de pontaj pdf	/unelte/foaie-de-pontaj
```

Comanda, fără `>>` pe un fișier fără linie nouă finală:

```bash
cd /srv/apps/ERP && [ -z "$(tail -c1 docs/comercial/cuvinte-tinta.tsv)" ] || echo >> docs/comercial/cuvinte-tinta.tsv
cd /srv/apps/ERP && printf '%s\t%s\n' \
  "calculator zile concediu de odihna" /unelte/calculator-zile-concediu \
  "calculator zile concediu odihna" /unelte/calculator-zile-concediu \
  "cerere concediu de odihna pdf" /unelte/cerere-concediu-de-odihna \
  "cerere concediu de odihna o zi" /unelte/cerere-concediu-de-odihna \
  "condica de prezenta pdf" /unelte/condica-de-prezenta \
  "foaie de parcurs model completat" /unelte/foaie-de-parcurs \
  "foaie de parcurs excel" /unelte/foaie-de-parcurs \
  "foaie colectiva de pontaj pdf" /unelte/foaie-de-pontaj >> docs/comercial/cuvinte-tinta.tsv
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/content/landing/cuvinte-tinta.test.ts
cd /srv/apps/ERP && pnpm typecheck && pnpm check:server && pnpm lint && pnpm test && pnpm exec prettier --check src/content/landing/cuvinte-tinta.test.ts
```

- [ ] **Pasul 5: Linia de bază**: înainte de orice deploy al lui K1–K3, ca să existe un „înainte”:

```bash
cd /srv/apps/ERP && ~/.claude/plugins/data/claude-seo-agricidaniel-claude-seo/.venv/bin/python scripts/seo/pozitii.py >> docs/comercial/cuvinte-cheie-progres.md && tail -60 docs/comercial/cuvinte-cheie-progres.md
```

Tabelul nou trebuie să aibă un rând pentru fiecare termen, inclusiv cei opt noi, cu „—” unde nu există afișări. Absența e informație.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
CAI=(docs/comercial/cuvinte-tinta.tsv docs/comercial/cuvinte-cheie-progres.md src/content/landing/cuvinte-tinta.test.ts)
git status --short -- "${CAI[@]}"
git fetch origin main
git diff --name-only HEAD origin/main -- "${CAI[@]}"
git add -- src/content/landing/cuvinte-tinta.test.ts
git commit --only -m "chore(seo): termenii-țintă ai uneltelor, cu poartă, și linia de bază din 8 oct" -m "Fiecare unealtă are cel puțin un termen urmărit, iar termenul ei principal (seo-unelte.ts) e printre ei; termenii sunt ASCII, unici, pe pagini din sitemap." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "${CAI[@]}"
git merge origin/main
git push origin main
```

---

### Task K5: Indexarea paginilor schimbate: GSC, Bing, Brave, IndexNow

Pasul ăsta nu e cod. Se face după ce utilizatorul confirmă deploy-ul lui K1–K4 prin `./administrativo.sh` (memoria `erp-deploy-productie`). Pașii din conturile Google, Microsoft și Brave îi face utilizatorul: cer autentificare, iar Indexing API-ul Google nu servește pagini obișnuite, doar `JobPosting`/`BroadcastEvent`. Agentul pregătește lista și verifică rezultatele.

**Fișiere:** niciunul în repo. Se scrie doar scriptul de verificare din scratchpad.

- [ ] **Pasul 1 (agent): producția servește metadatele noi**

```bash
for c in cerere-concediu-de-odihna fisa-instruire-ssm foaie-de-pontaj condica-de-prezenta; do curl -s "https://administrativo.ro/unelte/$c?m=k5$(date +%s)" | grep -o '<title>[^<]*</title>\|<meta name="description" content="[^"]*"'; done
curl -s "https://administrativo.ro/unelte?m=k5$(date +%s)" | grep -o 'id="\(pontaj\|concedii\|salarii\|documente\)"' | sort -u
```

Patru perechi identice cu `META_UNELTE` și patru ancore de categorie. `?m=` e marcajul cu care auditurile se recunosc în Umami (memoria `erp-analitice-fapte-verificate`).

- [ ] **Pasul 2 (utilizator): Search Console → Inspectarea adresei URL → „Solicitați indexarea”**, în ordinea asta (cel mult ~10 pe zi):
  1. `https://administrativo.ro/unelte/cerere-concediu-de-odihna`: poziția 6, descriere nouă
  2. `https://administrativo.ro/unelte/fisa-instruire-ssm`: poziția 8
  3. `https://administrativo.ro/unelte/foaie-de-pontaj`
  4. `https://administrativo.ro/unelte`: hub nou
  5. `https://administrativo.ro/unelte/calculator-zile-concediu`
  6. `https://administrativo.ro/unelte/fisa-evaluare`: legătură nouă din KPI
  7. `https://administrativo.ro/ghid/concediu-de-odihna`: legătură nouă spre calculatorul de zile de concediu

  Condica nu e în listă: își păstrează titlul și descrierea lui E14 (corectat la verificare).

- [ ] **Pasul 3 (utilizator): Bing Webmaster Tools.** Pe https://www.bing.com/webmasters, „Import your sites from Google Search Console” → se alege `administrativo.ro`. Importul aduce și verificarea, deci nu e nevoie de `BING_SITE_VERIFICATION`. Apoi „Sitemaps” → `https://administrativo.ro/sitemap.xml` și „URL Submission” pentru aceleași 7 adrese.

- [ ] **Pasul 4 (utilizator): Brave.** https://search.brave.com/submit-url, câte o adresă, aceleași 7. Brave nu e în rețeaua IndexNow (`scripts/indexnow.mjs:12-14`).

- [ ] **Pasul 5 (agent): IndexNow a plecat la deploy**

```bash
cat ~/.administrativo-indexnow.json 2>/dev/null || echo "fără stare: încă nicio trimitere reușită de pe mașina asta"
```

`ultimaTrimitere` trebuie să fie data deploy-ului. Dacă deploy-ul s-a făcut de pe altă mașină, se rulează de aici, fără `--toate`: `cd /srv/apps/ERP && node scripts/indexnow.mjs`. Scriptul trimite doar adresele cu `lastmod` la sau după ultima trimitere.

- [ ] **Pasul 6 (agent, la 3 și la 10 zile după Pasul 2): ce a recitit Google**. Folosește URL Inspection API, doar citire:

```bash
cat > /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/k5-inspectie.py <<'PY'
import json, os
from google.oauth2 import service_account
from googleapiclient.discovery import build
cale = json.load(open(os.path.expanduser("~/.config/claude-seo/google-api.json")))["service_account_path"]
cred = service_account.Credentials.from_service_account_file(cale, scopes=["https://www.googleapis.com/auth/webmasters.readonly"])
s = build("searchconsole", "v1", credentials=cred, cache_discovery=False)
for c in ["/unelte/cerere-concediu-de-odihna", "/unelte/fisa-instruire-ssm", "/unelte/foaie-de-pontaj", "/unelte", "/unelte/calculator-zile-concediu", "/unelte/fisa-evaluare"]:
    r = s.urlInspection().index().inspect(body={"inspectionUrl": "https://administrativo.ro" + c, "siteUrl": "sc-domain:administrativo.ro"}).execute()
    i = r["inspectionResult"]["indexStatusResult"]
    print(c, i.get("coverageState"), i.get("lastCrawlTime"))
PY
~/.claude/plugins/data/claude-seo-agricidaniel-claude-seo/.venv/bin/python -I /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/k5-inspectie.py
```

`lastCrawlTime` trebuie să fie după data Pasului 2, pe cel puțin primele trei. Altfel Pasul 2 se repetă pentru ele, o singură dată.

- [ ] **Pasul 7 (agent, săptămânal, 4 săptămâni):** `scripts/seo/pozitii.py >> docs/comercial/cuvinte-cheie-progres.md`, apoi commit `chore(seo): pozițiile săptămânii <data>`, cu ritualul `--only` + merge + push. Regula de decizie: dacă la 4 săptămâni după indexare cererea are ≥ 50 de afișări pe poziție ≤ 8 și CTR 0, descrierea se rescrie a doua oară, în `seo-unelte.ts`. Sub 50 de afișări nu există semnal.

---
### Task K6: `interval-lucrator`: zilele lucrătoare dintre două date și a N-a zi lucrătoare

Rulează după B1. Valorile din teste au fost calculate independent, în Python, cu algoritmul Meeus pentru Paștele ortodox și cu lista din art. 139 alin. (1), forma consolidată la 27.04.2026 (`lucru-seo-unelte-noi/verif_calendar.py`). Ies 250 de zile lucrătoare în 2026 și 252 în 2027, ca pe `/ghid/zile-libere`.

**Fișiere:**
- Create: `src/domain/calendar/interval-lucrator.ts`
- Test: `src/domain/calendar/interval-lucrator.test.ts`

**Interfețe:**
- Consumă: `sarbatoriDupaZi(an: number): ReadonlyMap<string, string>` (`./sarbatori`, citit: cheia e `YYYY-MM-DD`, iar două sărbători în aceeași zi sunt unite cu „ · ”).
- Produce:
  ```ts
  export type ZiIso = string;
  export const AN_MIN_INTERVAL = 2024;
  export const AN_MAX_INTERVAL = 2035;
  export const MAX_ZILE_DE_ADAUGAT = 400;
  export type SarbatoareInInterval = Readonly<{ data: ZiIso; denumire: string }>;
  export type IntervalLucrator = Readonly<{
    deLa: ZiIso; panaLa: ZiIso; zileCalendaristice: number; zileLucratoare: number;
    zileWeekend: number; sarbatoriScazute: readonly SarbatoareInInterval[];
  }>;
  export function ziValida(v: string): ZiIso | null;
  export function ziuaUrmatoare(zi: ZiIso): ZiIso;
  export function esteZiLucratoare(zi: ZiIso): boolean;
  export function numaraInterval(deLa: ZiIso, panaLa: ZiIso): IntervalLucrator; // RangeError
  export function aNaZiLucratoareDupa(dupa: ZiIso, numar: number): ZiIso; // RangeError
  export function sarbatoriSarite(dupa: ZiIso, pana: ZiIso): readonly SarbatoareInInterval[];
  export function dataLunga(zi: ZiIso): string; // „joi, 5 noiembrie 2026”
  export function anulProgramarii(azi: ZiIso): number;
  ```

- [ ] **Pasul 1: Scrie testul care pică**: `src/domain/calendar/interval-lucrator.test.ts`

```ts
// src/domain/calendar/interval-lucrator.test.ts
import { describe, expect, it } from "vitest";

import {
  aNaZiLucratoareDupa,
  anulProgramarii,
  dataLunga,
  esteZiLucratoare,
  numaraInterval,
  sarbatoriSarite,
  ziuaUrmatoare,
  ziValida,
} from "./interval-lucrator";

describe("numaraInterval", () => {
  it("săptămâna Paștelui 2026: scade Vinerea Mare și a doua zi de Paște", () => {
    expect(numaraInterval("2026-04-06", "2026-04-17")).toEqual({
      deLa: "2026-04-06",
      panaLa: "2026-04-17",
      zileCalendaristice: 12,
      zileLucratoare: 8,
      zileWeekend: 2,
      sarbatoriScazute: [
        { data: "2026-04-10", denumire: "Vinerea Mare" },
        { data: "2026-04-13", denumire: "A doua zi de Paște" },
      ],
    });
  });

  it("peste Anul Nou: Crăciunul, 1, 6 și 7 ianuarie", () => {
    const r = numaraInterval("2026-12-21", "2027-01-08");
    expect(r.zileLucratoare).toBe(11);
    expect(r.zileWeekend).toBe(4);
    expect(r.sarbatoriScazute.map((s) => s.data)).toEqual([
      "2026-12-25",
      "2027-01-01",
      "2027-01-06",
      "2027-01-07",
    ]);
  });

  it("1 iunie 2026 e o singură zi cu două sărbători, numărată o dată", () => {
    const r = numaraInterval("2026-05-25", "2026-06-05");
    expect(r.zileLucratoare).toBe(9);
    expect(r.sarbatoriScazute).toEqual([
      { data: "2026-06-01", denumire: "Ziua Copilului · A doua zi de Rusalii" },
    ]);
  });

  it("anii întregi: 250 de zile lucrătoare în 2026, 252 în 2027", () => {
    expect(numaraInterval("2026-01-01", "2026-12-31").zileLucratoare).toBe(250);
    expect(numaraInterval("2027-01-01", "2027-12-31").zileLucratoare).toBe(252);
  });

  it("octombrie 2026: 22 de zile lucrătoare, 9 de weekend", () => {
    const r = numaraInterval("2026-10-01", "2026-10-31");
    expect([r.zileLucratoare, r.zileWeekend, r.sarbatoriScazute.length]).toEqual([22, 9, 0]);
  });

  it("un interval doar cu sărbători dă zero, nu eroare", () => {
    expect(numaraInterval("2026-11-30", "2026-12-01").zileLucratoare).toBe(0);
    expect(numaraInterval("2026-10-10", "2026-10-11").zileLucratoare).toBe(0);
  });

  it("intervalul inversat, ziua inexistentă și anul din afară sunt refuzate", () => {
    expect(() => numaraInterval("2026-12-20", "2026-12-10")).toThrow(/înaintea/u);
    expect(() => numaraInterval("2026-02-30", "2026-03-10")).toThrow(RangeError);
    expect(() => numaraInterval("2023-01-01", "2023-01-31")).toThrow(/2024 și 2035/u);
  });
});

describe("aNaZiLucratoareDupa", () => {
  it("numărătoarea începe a doua zi: 20 de zile lucrătoare după 8 oct 2026", () => {
    expect(aNaZiLucratoareDupa("2026-10-08", 20)).toBe("2026-11-05");
  });

  it("peste Crăciun și Anul Nou, 20 și 45 de zile", () => {
    expect(aNaZiLucratoareDupa("2026-12-10", 20)).toBe("2027-01-13");
    expect(aNaZiLucratoareDupa("2026-12-10", 45)).toBe("2027-02-17");
  });

  it("sare peste Sfântul Andrei și 1 decembrie", () => {
    expect(aNaZiLucratoareDupa("2026-11-27", 1)).toBe("2026-12-02");
  });

  it("zero zile întoarce ziua de pornire", () => {
    expect(aNaZiLucratoareDupa("2026-10-09", 0)).toBe("2026-10-09");
  });

  it("pornirea dintr-o duminică nu numără duminica", () => {
    expect(aNaZiLucratoareDupa("2026-10-11", 1)).toBe("2026-10-12");
  });

  it("un termen care trece de 2035 e refuzat, nu ghicit", () => {
    expect(() => aNaZiLucratoareDupa("2035-12-20", 20)).toThrow(/2035/u);
  });

  it("numărul de zile trebuie să fie întreg, între 0 și 400", () => {
    expect(() => aNaZiLucratoareDupa("2026-10-08", -1)).toThrow(RangeError);
    expect(() => aNaZiLucratoareDupa("2026-10-08", 2.5)).toThrow(RangeError);
    expect(() => aNaZiLucratoareDupa("2026-10-08", 401)).toThrow(RangeError);
  });
});

describe("sarbatoriSarite", () => {
  it("sărbătorile de luni–vineri dintre pornire (exclusiv) și termen (inclusiv)", () => {
    expect(sarbatoriSarite("2026-12-10", "2027-02-17").map((s) => s.denumire)).toEqual([
      "Crăciunul",
      "Anul Nou",
      "Bobotează",
      "Soborul Sfântului Ioan Botezătorul",
    ]);
    expect(sarbatoriSarite("2026-10-09", "2026-10-09")).toEqual([]);
  });
});

describe("ajutoarele", () => {
  it("ziValida: doar zile reale din 2024–2035, cu spații tăiate", () => {
    expect(ziValida(" 2026-10-08 ")).toBe("2026-10-08");
    expect(ziValida("2026-02-29")).toBeNull();
    expect(ziValida("2028-02-29")).toBe("2028-02-29");
    expect(ziValida("2036-01-01")).toBeNull();
    expect(ziValida("08.10.2026")).toBeNull();
  });

  it("ziuaUrmatoare trece peste lună și an", () => {
    expect(ziuaUrmatoare("2026-12-31")).toBe("2027-01-01");
    expect(ziuaUrmatoare("2028-02-28")).toBe("2028-02-29");
  });

  it("esteZiLucratoare", () => {
    expect(esteZiLucratoare("2026-10-08")).toBe(true);
    expect(esteZiLucratoare("2026-10-10")).toBe(false);
    expect(esteZiLucratoare("2026-12-01")).toBe(false);
  });

  it("dataLunga, cu ziua săptămânii", () => {
    expect(dataLunga("2026-11-05")).toBe("joi, 5 noiembrie 2026");
    expect(dataLunga("2027-02-17")).toBe("miercuri, 17 februarie 2027");
    expect(dataLunga("2026-10-31")).toBe("sâmbătă, 31 octombrie 2026");
  });

  it("anulProgramarii: din octombrie se programează anul următor (art. 148 alin. (1))", () => {
    expect(anulProgramarii("2026-09-30")).toBe(2026);
    expect(anulProgramarii("2026-10-01")).toBe(2027);
    expect(anulProgramarii("2026-12-31")).toBe(2027);
    expect(anulProgramarii("2027-01-01")).toBe(2027);
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/domain/calendar/interval-lucrator.test.ts
```

Așteptat: `Failed to resolve import "./interval-lucrator"`.

- [ ] **Pasul 3: Implementarea minimă**: `src/domain/calendar/interval-lucrator.ts`

```ts
// src/domain/calendar/interval-lucrator.ts
import { sarbatoriDupaZi } from "./sarbatori";

/**
 * Intervale de zile lucrătoare, pentru uneltele publice: câte zile lucrătoare
 * are un interval și care e a N-a zi lucrătoare după o dată.
 *
 * Funcții PURE, pe zile calendaristice ISO (`2026-11-05`). `Date` apare doar
 * în UTC, ca pas de calcul: comparațiile se fac pe șiruri, deci fusul orar al
 * mașinii nu poate muta o zi. Sărbătorile vin din `sarbatoriDupaZi`, același
 * calendar ca foaia de pontaj și cererea de concediu.
 *
 * ── CE NU SCADE ───────────────────────────────────────────────────────────
 * Zilele libere din contractul colectiv sau din regulamentul intern: sunt ale
 * fiecărei firme. Paginile care folosesc modulul o spun.
 *
 * ── A N-A ZI „DUPĂ” ───────────────────────────────────────────────────────
 * Ziua de pornire nu se numără. E regula pe care ÎCCJ a stabilit-o pentru
 * preavizul la concediere (RIL nr. 8/2024, MO nr. 573 din 19.06.2024, citat
 * în Codul muncii consolidat la 27.04.2026, sub art. 75): termenul curge din
 * ziua următoare comunicării și se împlinește în ultima zi a lui.
 */

export type ZiIso = string;

/** Anii pentru care uneltele răspund. Calendarul e corect din 2017 (B1); oferim 2024–2035. */
export const AN_MIN_INTERVAL = 2024;
export const AN_MAX_INTERVAL = 2035;
/** Cel mai lung preaviz legal e de 45 de zile lucrătoare; 400 acoperă orice termen rezonabil. */
export const MAX_ZILE_DE_ADAUGAT = 400;

export type SarbatoareInInterval = Readonly<{ data: ZiIso; denumire: string }>;

export type IntervalLucrator = Readonly<{
  deLa: ZiIso;
  panaLa: ZiIso;
  zileCalendaristice: number;
  zileLucratoare: number;
  zileWeekend: number;
  /** Sărbătorile căzute luni–vineri, adică cele care chiar au scăzut o zi. */
  sarbatoriScazute: readonly SarbatoareInInterval[];
}>;

const ZI_MS = 86_400_000;
const FORMA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/u;

const LUNI = [
  "ianuarie",
  "februarie",
  "martie",
  "aprilie",
  "mai",
  "iunie",
  "iulie",
  "august",
  "septembrie",
  "octombrie",
  "noiembrie",
  "decembrie",
] as const;

/** Duminica e prima, ca la `getUTCDay()`. */
const ZILE = ["duminică", "luni", "marți", "miercuri", "joi", "vineri", "sâmbătă"] as const;

function dinIso(valoare: string): Date | null {
  const potrivire = FORMA_ISO.exec(valoare);
  if (potrivire === null) return null;
  const [, a, l, z] = potrivire;
  const an = Number(a);
  const luna = Number(l);
  const zi = Number(z);
  const data = new Date(Date.UTC(an, luna - 1, zi));
  // `Date.UTC` mută tăcut „30 februarie” pe 2 martie; o zi inexistentă e refuzată.
  if (data.getUTCFullYear() !== an || data.getUTCMonth() !== luna - 1 || data.getUTCDate() !== zi) {
    return null;
  }
  return data;
}

function laIso(data: Date): ZiIso {
  return `${String(data.getUTCFullYear()).padStart(4, "0")}-${String(data.getUTCMonth() + 1).padStart(2, "0")}-${String(data.getUTCDate()).padStart(2, "0")}`;
}

function inWeekend(data: Date): boolean {
  const zi = data.getUTCDay();
  return zi === 0 || zi === 6;
}

/** Harta sărbătorilor, construită o dată pe an. */
const sarbatoriPeAn = new Map<number, ReadonlyMap<string, string>>();
function sarbatoarea(zi: ZiIso): string | undefined {
  const an = Number(zi.slice(0, 4));
  let harta = sarbatoriPeAn.get(an);
  if (harta === undefined) {
    harta = sarbatoriDupaZi(an);
    sarbatoriPeAn.set(an, harta);
  }
  return harta.get(zi);
}

/** Ziua reală dintr-un an acoperit, ca ISO, sau `null`. */
export function ziValida(valoare: string): ZiIso | null {
  const data = dinIso(valoare.trim());
  if (data === null) return null;
  const an = data.getUTCFullYear();
  return an >= AN_MIN_INTERVAL && an <= AN_MAX_INTERVAL ? laIso(data) : null;
}

function cereZi(valoare: string): Date {
  const valida = ziValida(valoare);
  const data = valida === null ? null : dinIso(valida);
  if (data === null) {
    throw new RangeError(
      `„${valoare.slice(0, 20)}” nu e o zi reală între ${String(AN_MIN_INTERVAL)} și ${String(AN_MAX_INTERVAL)}.`,
    );
  }
  return data;
}

export function ziuaUrmatoare(zi: ZiIso): ZiIso {
  const data = dinIso(zi);
  if (data === null) throw new RangeError(`„${zi.slice(0, 20)}” nu e o zi calendaristică.`);
  return laIso(new Date(data.getTime() + ZI_MS));
}

export function esteZiLucratoare(zi: ZiIso): boolean {
  const data = cereZi(zi);
  return !inWeekend(data) && sarbatoarea(laIso(data)) === undefined;
}

export function numaraInterval(deLa: ZiIso, panaLa: ZiIso): IntervalLucrator {
  const inceput = cereZi(deLa);
  const sfarsit = cereZi(panaLa);
  if (sfarsit.getTime() < inceput.getTime()) {
    throw new RangeError("Data de sfârșit e înaintea celei de început.");
  }
  let zileLucratoare = 0;
  let zileWeekend = 0;
  const sarbatoriScazute: SarbatoareInInterval[] = [];
  for (let t = inceput.getTime(); t <= sfarsit.getTime(); t += ZI_MS) {
    const data = new Date(t);
    if (inWeekend(data)) {
      zileWeekend += 1;
      continue;
    }
    const zi = laIso(data);
    const denumire = sarbatoarea(zi);
    if (denumire !== undefined) {
      sarbatoriScazute.push({ data: zi, denumire });
      continue;
    }
    zileLucratoare += 1;
  }
  return {
    deLa: laIso(inceput),
    panaLa: laIso(sfarsit),
    zileCalendaristice: Math.round((sfarsit.getTime() - inceput.getTime()) / ZI_MS) + 1,
    zileLucratoare,
    zileWeekend,
    sarbatoriScazute,
  };
}

export function aNaZiLucratoareDupa(dupa: ZiIso, numar: number): ZiIso {
  const pornire = cereZi(dupa);
  if (!Number.isInteger(numar) || numar < 0 || numar > MAX_ZILE_DE_ADAUGAT) {
    throw new RangeError(
      `Numărul de zile lucrătoare trebuie să fie întreg, între 0 și ${String(MAX_ZILE_DE_ADAUGAT)}.`,
    );
  }
  let ramase = numar;
  let t = pornire.getTime();
  while (ramase > 0) {
    t += ZI_MS;
    const data = new Date(t);
    if (data.getUTCFullYear() > AN_MAX_INTERVAL) {
      throw new RangeError(
        `Termenul trece de ${String(AN_MAX_INTERVAL)}, ultimul an pentru care avem calendarul.`,
      );
    }
    if (!inWeekend(data) && sarbatoarea(laIso(data)) === undefined) ramase -= 1;
  }
  return laIso(new Date(t));
}

/** Sărbătorile de luni–vineri dintre `dupa` (exclusiv) și `pana` (inclusiv). */
export function sarbatoriSarite(dupa: ZiIso, pana: ZiIso): readonly SarbatoareInInterval[] {
  if (pana <= dupa) return [];
  return numaraInterval(ziuaUrmatoare(dupa), pana).sarbatoriScazute;
}

/** „joi, 5 noiembrie 2026”. */
export function dataLunga(zi: ZiIso): string {
  const data = dinIso(zi);
  if (data === null) return zi;
  return `${ZILE[data.getUTCDay()] ?? ""}, ${String(data.getUTCDate())} ${LUNI[data.getUTCMonth()] ?? ""} ${String(data.getUTCFullYear())}`;
}

/**
 * Anul pentru care are sens programarea concediilor. Art. 148 alin. (1) din
 * Codul muncii: „Programarea se face până la sfârșitul anului calendaristic
 * pentru anul următor” (consolidat la 27.04.2026). Din octombrie, ce caută
 * firma e anul următor.
 */
export function anulProgramarii(azi: ZiIso): number {
  const an = Number(azi.slice(0, 4));
  const luna = Number(azi.slice(5, 7));
  return luna >= 10 ? an + 1 : an;
}
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/domain/calendar/
cd /srv/apps/ERP && pnpm typecheck && pnpm check:server && pnpm lint && pnpm test && pnpm exec prettier --check src/domain/calendar/interval-lucrator.ts src/domain/calendar/interval-lucrator.test.ts
```

Dacă B1 nu rulase încă, testul „peste Anul Nou” trece oricum, fiindcă 2027 e după 09.03.2023. Taskul nu are ani dinainte de 2024.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
CAI=(src/domain/calendar/interval-lucrator.ts src/domain/calendar/interval-lucrator.test.ts)
git status --short -- "${CAI[@]}"
git fetch origin main
git diff --name-only HEAD origin/main -- "${CAI[@]}"
git add -- "${CAI[@]}"
git commit --only -m "feat(calendar): zilele lucrătoare dintre două date și a N-a zi lucrătoare" -m "Pe calendarul sărbătorilor din domain/calendar; ziua de pornire nu se numără (RIL 8/2024); 250 de zile lucrătoare în 2026, 252 în 2027, verificate independent." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "${CAI[@]}"
git merge origin/main
git push origin main
```

---
### Task K7: Calculatorul de zile lucrătoare (`/unelte/calculator-zile-lucratoare`)

Cererea măsurată azi: familia „calculator zile lucratoare” are scorul 242, iar primul termen e „calculator zile lucratoare intre doua date” (27). Familia „zile lucratoare intre doua date” are 103 („cate zile lucratoare sunt intre doua date”, 19). „Calculator zile lucratoare de la data” are 23. Pagina răspunde la ambele întrebări. Implicit arată luna curentă, fiindcă se caută și „zile lucratoare octombrie 2026” (`keyword-planner-lista.txt`).

Rulează după K1, K2, K3, K4, K6, E7 și F6.

**Fișiere:**
- Create: `src/app/(marketing)/unelte/calculator-zile-lucratoare/calcul.ts`
- Create: `src/app/(marketing)/unelte/calculator-zile-lucratoare/intrebari.ts`
- Create: `src/app/(marketing)/unelte/calculator-zile-lucratoare/page.tsx`
- Test: `src/app/(marketing)/unelte/calculator-zile-lucratoare/calcul.test.ts`
- Modify: `src/content/landing/unelte.ts` (antet nou, la final), `src/content/landing/seo-unelte.ts` (`META_UNELTE`), `src/content/landing/hub-unelte.ts` (grupul `pontaj`), `src/content/landing/legaturi.ts` (cheie nouă și două legături de intrare), `src/content/legal/zile-libere.ts` (`legaturiConexe`), `src/content/landing/ro.ts` și `en.ts` (`unelteGratuite.unelte`), `src/app/llms.txt/route.ts`, `src/content/landing/harta.ts`, `docs/comercial/cuvinte-tinta.tsv`

**Interfețe:**
- Consumă: din K6, `numaraInterval`, `aNaZiLucratoareDupa`, `sarbatoriSarite`, `ziValida`, `dataLunga`, `MAX_ZILE_DE_ADAUGAT`, `AN_MIN_INTERVAL`, `AN_MAX_INTERVAL` și tipurile `IntervalLucrator`, `SarbatoareInInterval`, `ZiIso`. Din F6, `zileLucratoareText(n: number): string` (`../cerere-concediu-de-odihna/text-zile`): `0 → "nicio zi lucrătoare"`, `1 → "1 zi lucrătoare"`, `20 → "20 de zile lucrătoare"`. Din `@/content/legal/zile-libere`, `calendarulAnului(an): CalendarAn`. Din E7, `IntrebareUnealta` (`@/content/landing/intrebari-pontaj`) și `IntrebariUnealta({ titlu, intrebari })` (`../../_componente/intrebari-unealta`).
- Produce:
  ```ts
  // calcul.ts
  export type Mod = "interval" | "adauga";
  export type CitireCalcul = Readonly<{ mod: Mod; deLa: ZiIso; panaLa: ZiIso; zile: number; probleme: readonly string[] }>;
  export type RezultatCalcul =
    | Readonly<{ mod: "interval"; interval: IntervalLucrator }>
    | Readonly<{ mod: "adauga"; deLa: ZiIso; zile: number; rezultat: ZiIso; sarite: readonly SarbatoareInInterval[] }>;
  export function citesteCalculul(q: URLSearchParams, azi: ZiIso): CitireCalcul;
  export function calculeaza(c: CitireCalcul): RezultatCalcul; // RangeError
  export function titluRezultat(r: RezultatCalcul): string;
  // intrebari.ts
  export function intrebariZileLucratoare(an: number): readonly IntrebareUnealta[];
  ```

- [ ] **Pasul 1: Scrie testul care pică**: `src/app/(marketing)/unelte/calculator-zile-lucratoare/calcul.test.ts`

```ts
// src/app/(marketing)/unelte/calculator-zile-lucratoare/calcul.test.ts
import { describe, expect, it } from "vitest";

import { calculeaza, citesteCalculul, titluRezultat } from "./calcul";
import { intrebariZileLucratoare } from "./intrebari";

const q = (s: string) => new URLSearchParams(s);
const AZI = "2026-10-08";

describe("citesteCalculul", () => {
  it("fără nimic: luna curentă, numărată între prima și ultima zi", () => {
    expect(citesteCalculul(q(""), AZI)).toEqual({
      mod: "interval",
      deLa: "2026-10-01",
      panaLa: "2026-10-31",
      zile: 20,
      probleme: [],
    });
  });

  it("februarie într-un an bisect se termină pe 29", () => {
    expect(citesteCalculul(q(""), "2028-02-10").panaLa).toBe("2028-02-29");
  });

  it("o dată greșită e spusă pe nume, nu înlocuită tăcut", () => {
    const c = citesteCalculul(q("de_la=2026-02-30&pana_la=2026-03-10"), AZI);
    expect(c.probleme).toEqual(["De la: „2026-02-30” nu e o zi reală între 2024 și 2035."]);
  });

  it("intervalul inversat e o problemă", () => {
    const c = citesteCalculul(q("de_la=2026-12-20&pana_la=2026-12-10"), AZI);
    expect(c.probleme).toEqual(["Data de sfârșit e înaintea celei de început."]);
  });

  it("modul „adaugă”: numărul de zile e citit și validat", () => {
    expect(citesteCalculul(q("mod=adauga&de_la=2026-10-08&zile=20"), AZI)).toMatchObject({
      mod: "adauga",
      deLa: "2026-10-08",
      zile: 20,
      probleme: [],
    });
    expect(citesteCalculul(q("mod=adauga&zile=abc"), AZI).probleme).toEqual([
      "Zile lucrătoare: „abc” nu e un număr întreg între 0 și 400.",
    ]);
    // În modul „între două date”, câmpul de zile nu contează.
    expect(citesteCalculul(q("zile=abc"), AZI).probleme).toEqual([]);
  });
});

describe("calculeaza", () => {
  it("intervalul: octombrie 2026 are 22 de zile lucrătoare", () => {
    const r = calculeaza(citesteCalculul(q(""), AZI));
    expect(r.mod).toBe("interval");
    if (r.mod !== "interval") return;
    expect(r.interval.zileLucratoare).toBe(22);
    expect(titluRezultat(r)).toBe("22 de zile lucrătoare");
  });

  it("intervalul doar cu sărbători: „nicio zi lucrătoare”", () => {
    const r = calculeaza(citesteCalculul(q("de_la=2026-11-30&pana_la=2026-12-01"), AZI));
    expect(titluRezultat(r)).toBe("nicio zi lucrătoare");
  });

  it("adaugă: a 20-a zi lucrătoare după 10 dec 2026 sare peste sărbători", () => {
    const r = calculeaza(citesteCalculul(q("mod=adauga&de_la=2026-12-10&zile=20"), AZI));
    expect(r).toMatchObject({ mod: "adauga", rezultat: "2027-01-13" });
    if (r.mod !== "adauga") return;
    expect(r.sarite.map((s) => s.data)).toEqual([
      "2026-12-25",
      "2027-01-01",
      "2027-01-06",
      "2027-01-07",
    ]);
    expect(titluRezultat(r)).toBe("miercuri, 13 ianuarie 2027");
  });

  it("un termen dincolo de 2035 e o eroare cu mesaj", () => {
    expect(() => calculeaza(citesteCalculul(q("mod=adauga&de_la=2035-12-20&zile=20"), AZI))).toThrow(
      /2035/u,
    );
  });
});

describe("întrebările paginii", () => {
  it("se termină cu „?”, răspunsurile cu punct, fără ș/ț cu sedilă", () => {
    for (const r of intrebariZileLucratoare(2026)) {
      expect(r.q).toMatch(/\?$/u);
      expect(r.a).toMatch(/\.$/u);
      expect(`${r.q}${r.a}`).not.toMatch(/[\u015E\u015F\u0162\u0163]/u);
    }
  });

  it("totalurile anuale vin din calendar, nu sunt scrise de mână", () => {
    const texte = intrebariZileLucratoare(2026).map((r) => r.a).join(" ");
    expect(texte).toContain("250 de zile lucrătoare");
    expect(texte).toContain("252 de zile lucrătoare");
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte/calculator-zile-lucratoare/"
```

Așteptat: `Failed to resolve import "./calcul"`.

- [ ] **Pasul 3: Implementarea minimă**

`calcul.ts`:

```ts
// src/app/(marketing)/unelte/calculator-zile-lucratoare/calcul.ts
import {
  AN_MAX_INTERVAL,
  AN_MIN_INTERVAL,
  aNaZiLucratoareDupa,
  dataLunga,
  MAX_ZILE_DE_ADAUGAT,
  numaraInterval,
  sarbatoriSarite,
  ziValida,
  type IntervalLucrator,
  type SarbatoareInInterval,
  type ZiIso,
} from "@/domain/calendar/interval-lucrator";

import { zileLucratoareText } from "../cerere-concediu-de-odihna/text-zile";

/**
 * Calculatorul de zile lucrătoare: două întrebări, un singur calendar.
 *
 * „Între două date” numără ambele capete, ca o cerere de concediu. „Peste N
 * zile lucrătoare” nu numără ziua de pornire, ca un termen de preaviz
 * (`aNaZiLucratoareDupa`). Formular GET, ca restul uneltelor: rezultatul stă
 * în adresă și se poate trimite.
 *
 * O dată greșită NU e înlocuită tăcut: se spune pe nume, iar pagina nu arată
 * un rezultat pentru alte date decât cele cerute.
 */

export type Mod = "interval" | "adauga";

export type CitireCalcul = Readonly<{
  mod: Mod;
  deLa: ZiIso;
  panaLa: ZiIso;
  zile: number;
  probleme: readonly string[];
}>;

export type RezultatCalcul =
  | Readonly<{ mod: "interval"; interval: IntervalLucrator }>
  | Readonly<{
      mod: "adauga";
      deLa: ZiIso;
      zile: number;
      rezultat: ZiIso;
      sarite: readonly SarbatoareInInterval[];
    }>;

const ZILE_IMPLICITE = 20;

function ultimaZiALunii(azi: ZiIso): ZiIso {
  const an = Number(azi.slice(0, 4));
  const luna = Number(azi.slice(5, 7));
  const zi = new Date(Date.UTC(an, luna, 0)).getUTCDate();
  return `${azi.slice(0, 8)}${String(zi).padStart(2, "0")}`;
}

export function citesteCalculul(q: URLSearchParams, azi: ZiIso): CitireCalcul {
  const mod: Mod = q.get("mod") === "adauga" ? "adauga" : "interval";
  const probleme: string[] = [];

  const data = (cheie: string, eticheta: string, implicit: ZiIso): ZiIso => {
    const brut = (q.get(cheie) ?? "").trim();
    if (brut === "") return implicit;
    const valida = ziValida(brut);
    if (valida === null) {
      probleme.push(
        `${eticheta}: „${brut.slice(0, 20)}” nu e o zi reală între ${String(AN_MIN_INTERVAL)} și ${String(AN_MAX_INTERVAL)}.`,
      );
      return implicit;
    }
    return valida;
  };

  const deLa = data("de_la", "De la", `${azi.slice(0, 8)}01`);
  const panaLa = mod === "interval" ? data("pana_la", "Până la", ultimaZiALunii(azi)) : ultimaZiALunii(azi);

  let zile = ZILE_IMPLICITE;
  const brutZile = (q.get("zile") ?? "").trim();
  if (mod === "adauga" && brutZile !== "") {
    const n = Number(brutZile);
    if (!Number.isInteger(n) || n < 0 || n > MAX_ZILE_DE_ADAUGAT) {
      probleme.push(
        `Zile lucrătoare: „${brutZile.slice(0, 10)}” nu e un număr întreg între 0 și ${String(MAX_ZILE_DE_ADAUGAT)}.`,
      );
    } else {
      zile = n;
    }
  }

  if (mod === "interval" && probleme.length === 0 && panaLa < deLa) {
    probleme.push("Data de sfârșit e înaintea celei de început.");
  }
  return { mod, deLa, panaLa, zile, probleme };
}

/** Aruncă `RangeError` (cu mesaj gata de afișat) pentru un termen dincolo de calendar. */
export function calculeaza(c: CitireCalcul): RezultatCalcul {
  if (c.mod === "interval") return { mod: "interval", interval: numaraInterval(c.deLa, c.panaLa) };
  const rezultat = aNaZiLucratoareDupa(c.deLa, c.zile);
  return { mod: "adauga", deLa: c.deLa, zile: c.zile, rezultat, sarite: sarbatoriSarite(c.deLa, rezultat) };
}

/** Titlul benzii de rezultat: numărul, respectiv data. */
export function titluRezultat(r: RezultatCalcul): string {
  return r.mod === "interval" ? zileLucratoareText(r.interval.zileLucratoare) : dataLunga(r.rezultat);
}
```

`intrebari.ts`:

```ts
// src/app/(marketing)/unelte/calculator-zile-lucratoare/intrebari.ts
import type { IntrebareUnealta } from "@/content/landing/intrebari-pontaj";
import { calendarulAnului } from "@/content/legal/zile-libere";

import { zileLucratoareText } from "../cerere-concediu-de-odihna/text-zile";

/**
 * Întrebările paginii. Articolele sunt citite pe forma consolidată a Codului
 * muncii la 27.04.2026 (legislatie.just.ro, DetaliiDocument/309240):
 * art. 139 alin. (1), art. 145 alin. (1), art. 81 alin. (4), art. 75 alin. (1);
 * RIL nr. 8/2024 e citat acolo, sub art. 75. Totalurile anuale vin din
 * `calendarulAnului`, nu se scriu: anul viitor ar fi rămas cu cifra de azi.
 */
export function intrebariZileLucratoare(an: number): readonly IntrebareUnealta[] {
  const curent = calendarulAnului(an);
  const urmator = calendarulAnului(an + 1);
  return [
    {
      q: "Ce zile nu sunt lucrătoare?",
      a: "Sâmbăta, duminica și cele 17 sărbători legale: 1 și 2 ianuarie, 6 și 7 ianuarie, 24 ianuarie, Vinerea Mare, prima și a doua zi de Paște, 1 mai, 1 iunie, prima și a doua zi de Rusalii, 15 august, 30 noiembrie, 1 decembrie, 25 și 26 decembrie. Paștele e cel ortodox, deci Vinerea Mare și Rusaliile se mută în fiecare an.",
      temei: "art. 139 alin. (1) Codul muncii",
    },
    {
      q: `Câte zile lucrătoare are anul ${String(an)}?`,
      a: `${zileLucratoareText(curent.zileLucratoare)} în ${String(an)} și ${zileLucratoareText(urmator.zileLucratoare)} în ${String(an + 1)}. Pe fiecare lună le găsești în ghidul zilelor libere.`,
      legatura: { href: "/ghid/zile-libere", eticheta: "Zilele libere și zilele lucrătoare pe luni" },
    },
    {
      q: "Se numără și ziua de început?",
      a: "Între două date, da: ambele capete intră, ca într-o cerere de concediu. Peste un număr de zile lucrătoare, nu: numărătoarea începe a doua zi. Așa a stabilit Înalta Curte pentru preaviz — termenul curge din ziua următoare comunicării și se împlinește în ultima lui zi.",
      temei: "RIL nr. 8/2024 (ÎCCJ), pentru art. 75 alin. (1) Codul muncii",
    },
    {
      q: "Zilele libere date de firmă se scad?",
      a: "Nu aici. Zilele libere din contractul colectiv sau din regulamentul intern sunt ale fiecărei firme; calculatorul folosește doar sărbătorile legale. Dacă firma ta are o zi liberă în plus în interval, o scazi din rezultat.",
    },
    {
      q: "Unde contează zilele lucrătoare?",
      a: "La concediul de odihnă, care are cel puțin 20 de zile lucrătoare pe an. La preavizul la demisie, de cel mult 20 de zile lucrătoare pentru funcțiile de execuție și 45 pentru cele de conducere. La preavizul la concediere, de cel puțin 20 de zile lucrătoare. Și la norma lunară: zilele lucrătoare înmulțite cu orele pe zi.",
      temei: "art. 145 alin. (1), art. 81 alin. (4), art. 75 alin. (1) Codul muncii",
    },
  ];
}
```

`page.tsx`:

```tsx
// src/app/(marketing)/unelte/calculator-zile-lucratoare/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { LEGATURI_CONEXE } from "@/content/landing/legaturi";
import { RO } from "@/content/landing/ro";
import { metaUnealta } from "@/content/landing/seo-unelte";
import { ANTET_CALCULATOR_ZILE_LUCRATOARE } from "@/content/landing/unelte";
import { dataLunga } from "@/domain/calendar/interval-lucrator";
import { todayInBucharest } from "@/lib/format/date";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";
import { IntrebariUnealta } from "../../_componente/intrebari-unealta";
import { JsonLd } from "../../_componente/json-ld";
import { metadatePagina } from "../../_componente/metadate";
import { nodUnealta } from "../../_componente/noduri-json-ld";
import { PeAcelasiSubiect } from "../../_componente/pe-acelasi-subiect";
import { zileLucratoareText } from "../cerere-concediu-de-odihna/text-zile";
import { calculeaza, citesteCalculul, titluRezultat, type RezultatCalcul } from "./calcul";
import { intrebariZileLucratoare } from "./intrebari";

/**
 * Calculatorul de zile lucrătoare, gratuit, fără cont.
 *
 * Completarea automată Google, 8 oct 2026: „calculator zile lucratoare intre
 * doua date” e primul termen al familiei, iar „…de la data” al doilea. Pagina
 * răspunde la amândouă și, fără parametri, la a treia întrebare frecventă:
 * câte zile lucrătoare are luna asta.
 */
const CALE = "/unelte/calculator-zile-lucratoare";

export const metadata: Metadata = metadatePagina(metaUnealta(CALE));

type Proprietati = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const unul = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2.5 text-base";

const CLASA_BUTON =
  "bg-mk-cerneala text-mk-text-inv inline-flex h-11 w-full items-center justify-center rounded px-5 text-[0.9375rem] font-medium transition-opacity hover:opacity-90";

function Explicatie({ r }: { r: RezultatCalcul }) {
  if (r.mod === "interval") {
    const i = r.interval;
    return (
      <div className="mt-4 max-w-[68ch] space-y-3 text-[0.9375rem] leading-[1.7]">
        <p>
          Între {dataLunga(i.deLa)} și {dataLunga(i.panaLa)}, inclusiv: {i.zileCalendaristice}{" "}
          {i.zileCalendaristice === 1 ? "zi calendaristică" : "zile calendaristice"}, dintre care{" "}
          {i.zileWeekend} în weekend și {i.sarbatoriScazute.length}{" "}
          {i.sarbatoriScazute.length === 1 ? "sărbătoare legală" : "sărbători legale"} în timpul
          săptămânii.
        </p>
        {i.sarbatoriScazute.length > 0 && (
          <ul className="list-disc space-y-1 pl-5">
            {i.sarbatoriScazute.map((s) => (
              <li key={s.data}>
                {dataLunga(s.data)}: {s.denumire}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  return (
    <div className="mt-4 max-w-[68ch] space-y-3 text-[0.9375rem] leading-[1.7]">
      <p>
        {r.zile === 0
          ? `Fără zile adăugate, termenul e chiar ${dataLunga(r.deLa)}.`
          : `${r.zile === 1 ? "Prima zi lucrătoare" : `A ${String(r.zile)}-a zi lucrătoare`} după ${dataLunga(r.deLa)}. Numărătoarea începe a doua zi și sare peste sâmbete, duminici și sărbătorile legale.`}
      </p>
      {r.sarite.length > 0 && (
        <ul className="list-disc space-y-1 pl-5">
          {r.sarite.map((s) => (
            <li key={s.data}>
              {dataLunga(s.data)}: {s.denumire}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function PaginaCalculatorZileLucratoare({ searchParams }: Proprietati) {
  const p = await searchParams;
  const q = new URLSearchParams();
  for (const cheie of ["mod", "de_la", "pana_la", "zile"]) {
    const v = unul(p[cheie]);
    if (v !== undefined && v !== "") q.set(cheie, v);
  }
  const azi = todayInBucharest();
  const citire = citesteCalculul(q, azi);
  let rezultat: RezultatCalcul | null = null;
  let problema: string | null = citire.probleme[0] ?? null;
  if (problema === null) {
    try {
      rezultat = calculeaza(citire);
    } catch (eroare) {
      if (!(eroare instanceof RangeError)) throw eroare;
      problema = eroare.message;
    }
  }
  const an = Number(azi.slice(0, 4));

  return (
    <Cadru text={RO}>
      <JsonLd
        date={nodUnealta({
          cale: CALE,
          nume: ANTET_CALCULATOR_ZILE_LUCRATOARE.titlu,
          descriere: ANTET_CALCULATOR_ZILE_LUCRATOARE.lead,
        })}
      />
      <AntetSecundar
        text={ANTET_CALCULATOR_ZILE_LUCRATOARE}
        firimituri={[
          { eticheta: "Acasă", href: "/" },
          { eticheta: "Unelte", href: "/unelte" },
          { eticheta: "Calculator zile lucrătoare", href: CALE },
        ]}
      />

      <Banda inaltime="scurta" supratitlu="Între două date" titlu="Câte zile lucrătoare sunt">
        <form method="get" action="#rezultat" className="mt-6 grid gap-4 sm:grid-cols-3">
          <input type="hidden" name="mod" value="interval" />
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">De la (inclusiv)</span>
            <input type="date" name="de_la" defaultValue={citire.deLa} className={CLASA_CAMP} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Până la (inclusiv)</span>
            <input type="date" name="pana_la" defaultValue={citire.panaLa} className={CLASA_CAMP} />
          </label>
          <div className="flex items-end">
            <button type="submit" data-umami-event="zile-lucratoare-interval" className={CLASA_BUTON}>
              Numără zilele
            </button>
          </div>
        </form>
      </Banda>

      <Banda inaltime="scurta" supratitlu="Peste un număr de zile" titlu="Ce dată e peste N zile lucrătoare">
        <form method="get" action="#rezultat" className="mt-6 grid gap-4 sm:grid-cols-3">
          <input type="hidden" name="mod" value="adauga" />
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Data de pornire</span>
            <input type="date" name="de_la" defaultValue={citire.deLa} className={CLASA_CAMP} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Zile lucrătoare de adăugat</span>
            <input
              type="number"
              name="zile"
              min={0}
              max={400}
              inputMode="numeric"
              defaultValue={String(citire.zile)}
              className={CLASA_CAMP}
            />
          </label>
          <div className="flex items-end">
            <button type="submit" data-umami-event="zile-lucratoare-adauga" className={CLASA_BUTON}>
              Află data
            </button>
          </div>
        </form>
      </Banda>

      <Banda
        id="rezultat"
        inaltime="scurta"
        supratitlu="Rezultatul"
        titlu={rezultat === null ? "De corectat" : titluRezultat(rezultat)}
      >
        {problema !== null && (
          <p role="status" className="border-mk-rigla mt-4 max-w-[68ch] border-l-2 pl-4 text-[0.9375rem]">
            {problema}
          </p>
        )}
        {rezultat !== null && <Explicatie r={rezultat} />}
        <p className="text-mk-text-slab mt-6 max-w-[68ch] text-[0.875rem] leading-[1.6]">
          Doar sărbătorile legale se scad; zilele libere din contractul colectiv sau din
          regulamentul intern, nu. Pentru un concediu, zilele le numără direct{" "}
          <Link href="/unelte/cerere-concediu-de-odihna" className="underline underline-offset-4">
            cererea de concediu
          </Link>
          .
        </p>
      </Banda>

      <IntrebariUnealta titlu="Ce se mai întreabă despre zilele lucrătoare" intrebari={intrebariZileLucratoare(an)} />

      <Banda inaltime="scurta" supratitlu="Fără calcule de mână" titlu="Zilele lucrătoare, direct în pontaj">
        <p className="text-mk-text-slab mt-4 max-w-[68ch] text-[0.9375rem] leading-[1.7]">
          În aplicație, norma fiecărei luni ({zileLucratoareText(22)} în octombrie 2026, de
          exemplu) și concediile se calculează pe același calendar, cu zilele libere ale firmei
          adăugate o dată.{" "}
          <Link href="/module/pontaj" className="underline underline-offset-4">
            Cum arată modulul de pontaj
          </Link>
          .
        </p>
        <PeAcelasiSubiect legaturi={LEGATURI_CONEXE["/unelte/calculator-zile-lucratoare"]} />
      </Banda>
    </Cadru>
  );
}
```

`LEGATURI_CONEXE["/unelte/calculator-zile-lucratoare"]` se scrie cu cheia literală, nu cu `CALE`: `continut.test.ts` („legăturile conexe ale paginilor…”) caută în `page.tsx` exact șirul `LEGATURI_CONEXE["<cale>"]`. Aceeași regulă se aplică la K8–K10. Banda de rezultat trimite spre cererea de concediu. K8 adaugă alături legătura spre cererea de demisie (Pasul 3 din K8), când pagina aceea există. Banda „Fără calcule de mână” pomenește 22 de zile ca exemplu fix, pentru octombrie 2026: e o afirmație despre o lună trecută, nu despre luna curentă, deci nu îmbătrânește.

Înregistrările (aceleași reguli ca la F13, citite în `F-cerere-concediu.md:4600-4710`):

`src/content/landing/unelte.ts`, la finalul fișierului:

```ts

/**
 * Calculatorul de zile lucrătoare: „între două date” și „peste N zile”
 * (completarea automată Google, 8 oct 2026). Același calendar ca foaia de
 * pontaj și cererea de concediu.
 */
export const ANTET_CALCULATOR_ZILE_LUCRATOARE: AntetPagina = {
  supratitlu: "Unealtă gratuită",
  titlu: "Calculator de zile lucrătoare",
  lead: "Câte zile lucrătoare sunt între două date sau ce dată cade peste un număr de zile lucrătoare: weekendurile și sărbătorile legale se scad singure, inclusiv Paștele ortodox și Rusaliile.",
};
```

`src/content/landing/seo-unelte.ts`, în `META_UNELTE`, după intrarea `/unelte/calculator-zile-concediu`:

```ts
  "/unelte/calculator-zile-lucratoare": {
    titlu: "Calculator zile lucrătoare între două date",
    descriere:
      "Câte zile lucrătoare sunt între două date, fără weekend și sărbători legale, sau ce dată e peste N zile lucrătoare. Pentru termene, preaviz și concedii.",
    termen: "calculator zile lucratoare",
  },
```

`src/content/landing/hub-unelte.ts`: importul primește `ANTET_CALCULATOR_ZILE_LUCRATOARE`, iar grupul `pontaj` primește al treilea rând:

```ts
      rand(
        "/unelte/calculator-zile-lucratoare",
        ANTET_CALCULATOR_ZILE_LUCRATOARE,
        "între două date sau peste N zile · sărbătorile scăzute · fără cont",
      ),
```

`src/content/landing/legaturi.ts`, cheie nouă, înaintea lui `"/unelte/calculator-salariu": [`:

```ts
  "/unelte/calculator-zile-lucratoare": [
    { eticheta: "Zilele libere legale și zilele lucrătoare pe luni", href: "/ghid/zile-libere" },
    { eticheta: "Foaie de pontaj lunar, gratuită", href: "/unelte/foaie-de-pontaj" },
    {
      eticheta: "Cerere de concediu cu zilele lucrătoare calculate",
      href: "/unelte/cerere-concediu-de-odihna",
    },
  ],
```

În același fișier, legăturile de intrare. În lista `"/unelte/foaie-de-pontaj"`, după `{ eticheta: "Zilele libere legale și zilele lucrătoare pe luni", href: "/ghid/zile-libere" },`:

```ts
    { eticheta: "Calculator de zile lucrătoare între două date", href: "/unelte/calculator-zile-lucratoare" },
```

În lista `"/unelte/cerere-concediu-de-odihna"`, după intrarea spre calculatorul de zile de concediu (din K3):

```ts
    { eticheta: "Zile lucrătoare între două date: calculator", href: "/unelte/calculator-zile-lucratoare" },
```

`src/content/legal/zile-libere.ts`, `legaturiConexe`, după intrarea spre cererea de concediu (`href: "/unelte/cerere-concediu-de-odihna"`, azi `:322-325`). K3 nu mai adaugă aici o legătură spre foaia de pontaj: pagina o are deja ca `legaturaSecundara`.

```ts
    {
      eticheta: "Calculator: zile lucrătoare între două date",
      href: "/unelte/calculator-zile-lucratoare",
    },
```

`src/content/landing/ro.ts`, în `unelteGratuite.unelte`, după obiectul cu `href: "/unelte/condica-de-prezenta"`:

```ts
      {
        titlu: "Calculator de zile lucrătoare",
        text: "Câte zile lucrătoare sunt între două date, sau ce dată e peste un număr de zile lucrătoare.",
        formate: "Online",
        href: "/unelte/calculator-zile-lucratoare",
      },
```

`src/content/landing/en.ts`, în același loc:

```ts
      {
        titlu: "Working days calculator",
        text: "How many working days there are between two dates, or which date falls N working days later, with Romanian public holidays.",
        formate: "Online",
        href: "/unelte/calculator-zile-lucratoare",
      },
```

`src/app/llms.txt/route.ts`, înaintea elementului `[\n    "/unelte/condica-de-prezenta",`:

```ts
  [
    "/unelte/calculator-zile-lucratoare",
    "Unealtă gratuită: câte zile lucrătoare sunt între două date (ambele incluse) sau ce dată cade peste N zile lucrătoare (ziua de pornire nu se numără, ca la preaviz — RIL nr. 8/2024). Scade sâmbetele, duminicile și cele 17 sărbători legale din art. 139 Codul muncii, cu Paștele ortodox calculat; nu scade zilele libere din contractul colectiv. Exemplu: 20 de zile lucrătoare după 10 decembrie 2026 = 13 ianuarie 2027. Fără cont.",
  ],
```

`src/content/landing/harta.ts`, după blocul cu `cale: "/unelte/condica-de-prezenta"`:

```ts
  {
    // 8 oct 2026: „calculator zile lucratoare intre doua date” (completarea automată).
    cale: "/unelte/calculator-zile-lucratoare",
    prioritate: 0.7,
    limba: "ro",
    traducere: null,
    actualizat: "<data commitului, date +%F>",
    sectiune: "Unelte și comparații",
  },
```

Tot în `harta.ts`, `actualizat` devine data commitului pe `/unelte` (hub-ul are un rând nou), pe `/` și pe `/en` (lista din `ro.ts`/`en.ts`, pe care poarta lastmod nu o vede). Pe fiecare se adaugă comentariul `// <data>: calculatorul de zile lucrătoare în lista de unelte.`

`docs/comercial/cuvinte-tinta.tsv`, cu aceeași gardă de linie nouă finală ca la K4:

```bash
cd /srv/apps/ERP && [ -z "$(tail -c1 docs/comercial/cuvinte-tinta.tsv)" ] || echo >> docs/comercial/cuvinte-tinta.tsv
cd /srv/apps/ERP && printf '%s\t%s\n' \
  "calculator zile lucratoare" /unelte/calculator-zile-lucratoare \
  "calculator zile lucratoare intre doua date" /unelte/calculator-zile-lucratoare \
  "zile lucratoare intre doua date" /unelte/calculator-zile-lucratoare \
  "cate zile lucratoare sunt intre doua date" /unelte/calculator-zile-lucratoare >> docs/comercial/cuvinte-tinta.tsv
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte/calculator-zile-lucratoare/" src/content/landing/ "src/app/(marketing)/_componente/descrieri.test.ts" "src/app/(marketing)/_componente/noduri-json-ld.test.ts"
```

Așteptat: verzi. Așa se verifică harta, `llms.txt`, hub-ul (K2), cele trei surse de legături (K3: ghidul zilelor libere, foaia de pontaj, cererea), termenii (K4), metadatele (K1), descrierea (152 de caractere), nodul `WebApplication`, lista de pe pagina de start și paritatea RO/EN. Apoi lanțul:

```bash
cd /srv/apps/ERP && pnpm typecheck && pnpm check:server && pnpm lint && pnpm test && pnpm exec prettier --check "src/app/(marketing)/unelte/calculator-zile-lucratoare" src/content/landing src/content/legal/zile-libere.ts src/app/llms.txt/route.ts
```

- [ ] **Pasul 5: Verificare headless la 360 px**, cu `pnpm dev -H 127.0.0.1 -p 3917` pornit ca la K1:

```bash
cat > /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/k7.mjs <<'JS'
import { chromium } from "/srv/apps/ERP/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core/index.mjs";
const b = await chromium.launch({ executablePath: "/home/miro/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell" });
const p = await b.newPage({ viewport: { width: 360, height: 800 } });
for (const [nume, adresa] of [
  ["implicit", "/unelte/calculator-zile-lucratoare"],
  ["paste", "/unelte/calculator-zile-lucratoare?mod=interval&de_la=2026-04-06&pana_la=2026-04-17"],
  ["adauga", "/unelte/calculator-zile-lucratoare?mod=adauga&de_la=2026-12-10&zile=20"],
  ["gresit", "/unelte/calculator-zile-lucratoare?de_la=2026-02-30"],
]) {
  await p.goto(`http://127.0.0.1:3917${adresa}`, { waitUntil: "networkidle" });
  const r = await p.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
    titlu: document.querySelector("#rezultat h2")?.textContent?.trim(),
    status: document.querySelector('#rezultat [role="status"]')?.textContent?.trim() ?? null,
  }));
  console.log(nume, JSON.stringify(r));
  await p.screenshot({ path: `/tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/k7-${nume}.png`, fullPage: true });
}
await b.close();
JS
node /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/k7.mjs
```

Așteptat: `sw === cw` pe toate patru. `implicit` dă titlul cu numărul de zile lucrătoare al lunii curente (22 în octombrie 2026). `paste` dă „8 zile lucrătoare”, `adauga` „miercuri, 13 ianuarie 2027”, iar `gresit` „De corectat”, cu `status` „De la: „2026-02-30” nu e o zi reală între 2024 și 2035.”. Capturile se verifică vizual: câmpurile de dată nu ies din coloană la 360 px.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
D="src/app/(marketing)/unelte/calculator-zile-lucratoare"
CAI=("$D/calcul.ts" "$D/calcul.test.ts" "$D/intrebari.ts" "$D/page.tsx" src/content/landing/unelte.ts src/content/landing/seo-unelte.ts src/content/landing/hub-unelte.ts src/content/landing/legaturi.ts src/content/legal/zile-libere.ts src/content/landing/ro.ts src/content/landing/en.ts src/app/llms.txt/route.ts src/content/landing/harta.ts docs/comercial/cuvinte-tinta.tsv)
git status --short -- "${CAI[@]}"
git fetch origin main
git diff --name-only HEAD origin/main -- "${CAI[@]}"
git add -- "$D/calcul.ts" "$D/calcul.test.ts" "$D/intrebari.ts" "$D/page.tsx"
git commit --only -m "feat(unelte): calculatorul de zile lucrătoare — între două date sau peste N zile" -m "Pe calendarul din domain/calendar (Paștele ortodox, 6–7 ianuarie, 1 iunie); ziua de pornire nu se numără la „peste N zile” (RIL 8/2024). Înregistrat în hub, harta, llms.txt, pagina de start, cu trei legături de intrare și termenii-țintă." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "${CAI[@]}"
node scripts/checks/lastmod.mjs
git merge origin/main
git push origin main
```

---
### Task K8: Cererea de demisie, cu ultima zi de preaviz calculată (`/unelte/cerere-demisie`)

Cererea măsurată azi: „model demisie” (1.014, 139 de termeni), „cerere demisie” (994), „preaviz demisie” (777). Formele de top sunt „model demisie la zi” (25), „cerere demisie fara preaviz” (19), „preaviz demisie 15 zile lucratoare sau calendaristice” (26), „model demisie cu acordul partilor” (15) și „model demisie fara preaviz art 81 alin 7” (18). Ultima e și o confuzie de temei: renunțarea angajatorului la preaviz e alin. (7), demisia fără preaviz e alin. (8). Pagina le desparte.

Textele de lege sunt citite azi pe forma consolidată din 27.04.2026 (`legislatie.just.ro/Public/DetaliiDocument/309240`): art. 81 alin. (1)–(8), art. 31 alin. (3), art. 55 lit. b), art. 50 lit. b), plus nota RIL nr. 8/2024 de sub art. 75. Codul civil art. 2.553 (consolidarea din 03.05.2026, `DetaliiDocument/309285`) are aceeași notă RIL. Atenție la sens: RIL-ul spune că art. 2.553 alin. (1) Cod civil și art. 181 C.proc.civ. NU se aplică preavizului. Ziua de pornire nu se numără, dar ziua în care termenul se împlinește SE numără, adică e ultima zi de preaviz. Nu se citează 2.553 ca temei al regulii. (Precizat la verificare, 8 oct 2026, pe textul de sub art. 75 din forma din 27.04.2026, recitit cu curl.)

Rulează după K6, K7, E7 și F6.

**Fișiere:**
- Create: `src/app/(marketing)/unelte/cerere-demisie/model.ts`
- Create: `src/app/(marketing)/unelte/cerere-demisie/intrebari.ts`
- Create: `src/app/(marketing)/unelte/cerere-demisie/page.tsx`
- Test: `src/app/(marketing)/unelte/cerere-demisie/model.test.ts`
- Modify: `src/lib/unelte/registru.ts` (import și cheie; plus `FORMATE_RESTRANSE` dacă H5 e pe `main`) și `src/lib/unelte/registru.test.ts` (filtrul testului lui H5)
- Modify: `src/app/api/unelte/[unealta]/route.test.ts` (bloc nou la final)
- Modify: înregistrările, ca la K7: `unelte.ts`, `seo-unelte.ts`, `hub-unelte.ts` (grup nou `plecare`), `legaturi.ts`, `fise-module.ts` (fișa `reges`), `concediu-odihna.ts` (`legaturiConexe`), `ro.ts`, `en.ts`, `llms.txt/route.ts`, `harta.ts`, `cuvinte-tinta.tsv`
- Modify: `src/app/(marketing)/unelte/calculator-zile-lucratoare/page.tsx` (legătura din banda de rezultat)
- Modify: `NOTES.md` (⚠ sub „Registrul de documente”, după nota „Fluxul de demisie nu există în aplicație.”)

**Interfețe:**
- Consumă: `aNaZiLucratoareDupa`, `sarbatoriSarite`, `dataLunga`, `ziValida`, tipurile `ZiIso` și `SarbatoareInInterval` (K6); `DocumentTabelar`, `EroareIntrare`, `LINIE_GOALA` (`@/lib/unelte/document-tabelar`, citit); `todayInBucharest` (`@/lib/format/date`); `zileLucratoareText` (F6); `IntrebareUnealta`, `IntrebariUnealta` (E7); `Descarcari({ actiune, eveniment, formate })`, `PrevizualizareDocument({ document })` (citite).
- Produce:
  ```ts
  export type TipDemisie = "preaviz" | "fara-preaviz" | "proba" | "acord";
  export type Categorie = "executie" | "conducere";
  export const TIPURI_DEMISIE: readonly Readonly<{ cheie: TipDemisie; eticheta: string }>[];
  export const PLAFON_PREAVIZ: Readonly<Record<Categorie, number>>; // { executie: 20, conducere: 45 }
  export type ParametriDemisie = Readonly<{
    tip: TipDemisie; categorie: Categorie; nume: string; functie: string; angajator: string;
    contract: string; depunere: ZiIso; zilePreaviz: number; dataAcord: ZiIso;
  }>;
  export type Preaviz = Readonly<{ zile: number; ultimaZi: ZiIso; sarbatoriSarite: readonly SarbatoareInInterval[] }>;
  export function citesteDemisie(q: URLSearchParams, azi: ZiIso): Readonly<{ parametri: ParametriDemisie; avertismente: readonly string[] }>;
  export function calculeazaPreaviz(depunere: ZiIso, zile: number): Preaviz; // EroareIntrare
  export function construiesteDemisie(p: ParametriDemisie): DocumentTabelar; // EroareIntrare
  export function demisieDinParametri(q: URLSearchParams): DocumentTabelar;
  export const INTREBARI_DEMISIE: readonly IntrebareUnealta[]; // intrebari.ts
  ```

- [ ] **Pasul 1: Scrie testul care pică**: `src/app/(marketing)/unelte/cerere-demisie/model.test.ts`

```ts
// src/app/(marketing)/unelte/cerere-demisie/model.test.ts
import { describe, expect, it } from "vitest";

import { EroareIntrare } from "@/lib/unelte/document-tabelar";
import { constructorPentru } from "@/lib/unelte/registru";

import { INTREBARI_DEMISIE } from "./intrebari";
import { calculeazaPreaviz, citesteDemisie, construiesteDemisie, PLAFON_PREAVIZ } from "./model";

const AZI = "2026-10-08";
const citeste = (s: string) => citesteDemisie(new URLSearchParams(s), AZI);
const text = (s: string) => {
  const d = construiesteDemisie(citeste(s).parametri);
  return [d.titlu, ...d.paragrafe, ...d.note, ...d.semnaturi].join("\n");
};

describe("preavizul", () => {
  it("plafoanele din art. 81 alin. (4)", () => {
    expect(PLAFON_PREAVIZ).toEqual({ executie: 20, conducere: 45 });
  });

  it("20 de zile lucrătoare de la 8 oct 2026: ultima zi e joi, 5 noiembrie", () => {
    expect(calculeazaPreaviz("2026-10-08", 20)).toEqual({
      zile: 20,
      ultimaZi: "2026-11-05",
      sarbatoriSarite: [],
    });
  });

  it("45 de zile peste sărbătorile de iarnă le enumeră pe cele sărite", () => {
    const p = calculeazaPreaviz("2026-12-10", 45);
    expect(p.ultimaZi).toBe("2027-02-17");
    expect(p.sarbatoriSarite.map((s) => s.denumire)).toEqual([
      "Crăciunul",
      "Anul Nou",
      "Bobotează",
      "Soborul Sfântului Ioan Botezătorul",
    ]);
  });

  it("depusă duminică, numărătoarea începe luni", () => {
    expect(calculeazaPreaviz("2026-10-11", 1).ultimaZi).toBe("2026-10-12");
  });

  it("un preaviz care trece de 2035 e o EroareIntrare, deci 400 pe rută", () => {
    expect(() => calculeazaPreaviz("2035-12-20", 20)).toThrow(EroareIntrare);
  });
});

describe("citesteDemisie", () => {
  it("fără nimic: demisie cu preaviz, funcție de execuție, 20 de zile, depusă azi", () => {
    expect(citeste("")).toEqual({
      parametri: {
        tip: "preaviz",
        categorie: "executie",
        nume: "",
        functie: "",
        angajator: "",
        contract: "",
        depunere: AZI,
        zilePreaviz: 20,
        dataAcord: AZI,
      },
      avertismente: [],
    });
  });

  it("funcția de conducere ridică plafonul la 45", () => {
    expect(citeste("categorie=conducere").parametri.zilePreaviz).toBe(45);
  });

  it("un preaviz peste plafon e plafonat, cu motivul spus", () => {
    const c = citeste("preaviz=30");
    expect(c.parametri.zilePreaviz).toBe(20);
    expect(c.avertismente).toEqual([
      "Preavizul nu poate depăși 20 de zile lucrătoare pentru o funcție de execuție (art. 81 alin. (4)); am folosit 20.",
    ]);
  });

  it("un preaviz mai scurt, din contract, e păstrat", () => {
    expect(citeste("preaviz=10").parametri.zilePreaviz).toBe(10);
  });

  it("un preaviz necitibil și o dată inexistentă sunt spuse pe nume", () => {
    expect(citeste("preaviz=abc&depunere=2026-02-30").avertismente).toEqual([
      "Data depunerii: „2026-02-30” nu e o zi reală între 2024 și 2035; am folosit ziua de azi.",
      "Preavizul „abc” nu e un număr întreg de zile; am folosit plafonul legal, 20.",
    ]);
  });

  it("un tip necunoscut devine demisia cu preaviz; textul e curățat de rânduri noi", () => {
    const c = citeste("tip=altceva&nume=Popescu%0AAna");
    expect(c.parametri.tip).toBe("preaviz");
    expect(c.parametri.nume).toBe("Popescu Ana");
  });
});

describe("documentul", () => {
  it("cu preaviz: temeiul, numărul de zile și ultima zi, în cuvinte", () => {
    const t = text("nume=Popescu%20Ana&functie=contabil&angajator=Administrativo%20Demo%20SRL&depunere=2026-10-08");
    expect(t).toContain("Cerere de demisie");
    expect(t).toContain("Popescu Ana");
    expect(t).toContain("art. 81 din Codul muncii");
    expect(t).toContain("20 de zile lucrătoare");
    expect(t).toContain("joi, 5 noiembrie 2026");
    expect(t).toContain("art. 81 alin. (7)");
  });

  it("fără preaviz: alin. (8), cu loc pentru obligația neîndeplinită", () => {
    const t = text("tip=fara-preaviz");
    expect(t).toContain("art. 81 alin. (8)");
    expect(t).toContain("______________________________");
    expect(t).not.toContain("ultima zi de preaviz");
  });

  it("în perioada de probă: art. 31 alin. (3), fără preaviz", () => {
    expect(text("tip=proba&depunere=2026-10-12")).toContain("art. 31 alin. (3)");
    expect(text("tip=proba&depunere=2026-10-12")).toContain("luni, 12 octombrie 2026");
  });

  it("acordul părților: art. 55 lit. b), data convenită și semnătura angajatorului", () => {
    const d = construiesteDemisie(citeste("tip=acord&data_acord=2026-10-30").parametri);
    expect(d.titlu).toBe("Cerere de încetare a contractului prin acordul părților");
    expect(d.paragrafe.join(" ")).toContain("art. 55 lit. b)");
    expect(d.paragrafe.join(" ")).toContain("vineri, 30 octombrie 2026");
    expect(d.semnaturi).toEqual(["Salariat", "De acord — angajator"]);
  });

  it("câmpurile goale devin linii de completat de mână, iar fișierul are nume curat", () => {
    const d = construiesteDemisie(citeste("").parametri);
    expect(d.paragrafe[0]).toContain("______________________________");
    expect(d.numeFisier).toBe("cerere-demisie-necompletata");
    expect(d.orientare).toBe("portret");
  });

  it("e servită de ruta comună", () => {
    expect(constructorPentru("cerere-demisie")).toBeTypeOf("function");
  });
});

describe("întrebările paginii", () => {
  it("se termină cu „?”, răspunsurile cu punct, fără ș/ț cu sedilă", () => {
    for (const r of INTREBARI_DEMISIE) {
      expect(r.q).toMatch(/\?$/u);
      expect(r.a).toMatch(/\.$/u);
      expect(`${r.q}${r.a}${r.temei ?? ""}`).not.toMatch(/[\u015E\u015F\u0162\u0163]/u);
    }
  });

  it("răspunde la „zile lucrătoare sau calendaristice”, întrebarea cea mai căutată", () => {
    expect(INTREBARI_DEMISIE[0]?.q).toMatch(/lucrătoare sau calendaristice/u);
  });
});
```

Și la finalul lui `src/app/api/unelte/[unealta]/route.test.ts`:

```ts
describe("cererea de demisie prin ruta comună", () => {
  it("dă un PDF pentru o cerere obișnuită", async () => {
    const r = await cere(
      "/api/unelte/cerere-demisie?tip=preaviz&nume=Popescu%20Ana&depunere=2026-10-08&format=pdf",
      "cerere-demisie",
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/pdf");
  });

  it("un preaviz dincolo de calendar dă 400 cu motivul, nu un fișier", async () => {
    const r = await cere(
      "/api/unelte/cerere-demisie?tip=preaviz&depunere=2035-12-20&format=docx",
      "cerere-demisie",
    );
    expect(r.status).toBe(400);
    expect(await r.text()).toMatch(/2035/u);
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte/cerere-demisie/" "src/app/api/unelte/[unealta]/route.test.ts"
```

Așteptat: `Failed to resolve import "./intrebari"`. În `route.test.ts`, cele două teste noi pică cu `expected 404 to be 200` și `expected 404 to be 400`.

- [ ] **Pasul 3: Implementarea minimă**

`model.ts`:

```ts
// src/app/(marketing)/unelte/cerere-demisie/model.ts
import {
  aNaZiLucratoareDupa,
  AN_MAX_INTERVAL,
  AN_MIN_INTERVAL,
  dataLunga,
  sarbatoriSarite,
  ziValida,
  type SarbatoareInInterval,
  type ZiIso,
} from "@/domain/calendar/interval-lucrator";
import { todayInBucharest } from "@/lib/format/date";
import { EroareIntrare, LINIE_GOALA, type DocumentTabelar } from "@/lib/unelte/document-tabelar";

import { zileLucratoareText } from "../cerere-concediu-de-odihna/text-zile";

/**
 * Cererea de demisie, cu ultima zi de preaviz calculată.
 *
 * ── TEMEIURILE (Codul muncii, consolidat la 27.04.2026) ──────────────────
 * Art. 81: demisia e notificarea scrisă a salariatului (alin. (1)), pe care
 * angajatorul e obligat s-o înregistreze (alin. (2)); nu se motivează
 * (alin. (3)); preavizul e cel din contract, dar cel mult 20 de zile
 * lucrătoare pentru funcțiile de execuție și 45 pentru cele de conducere
 * (alin. (4)); contractul încetează la expirarea preavizului sau când
 * angajatorul renunță la el (alin. (7)); fără preaviz, dacă angajatorul nu-și
 * îndeplinește obligațiile din contract (alin. (8)). Art. 31 alin. (3):
 * în perioada de probă, notificare scrisă, fără preaviz. Art. 55 lit. b):
 * acordul părților, la data convenită.
 *
 * ── NUMĂRĂTOAREA ──────────────────────────────────────────────────────────
 * Din ziua următoare înregistrării, până la ultima zi lucrătoare a termenului:
 * regula RIL nr. 8/2024 pentru preavizul la concediere (art. 75), aplicată
 * prin analogie. ⚠ în NOTES.md, pentru jurist.
 */

export type TipDemisie = "preaviz" | "fara-preaviz" | "proba" | "acord";
export type Categorie = "executie" | "conducere";

export const TIPURI_DEMISIE: readonly Readonly<{ cheie: TipDemisie; eticheta: string }>[] = [
  { cheie: "preaviz", eticheta: "Demisie cu preaviz (art. 81)" },
  {
    cheie: "fara-preaviz",
    eticheta: "Demisie fără preaviz: angajatorul nu își respectă obligațiile (art. 81 alin. (8))",
  },
  { cheie: "proba", eticheta: "În perioada de probă, fără preaviz (art. 31 alin. (3))" },
  { cheie: "acord", eticheta: "Încetare prin acordul părților (art. 55 lit. b))" },
];

/** Art. 81 alin. (4): plafoanele preavizului la demisie, în zile lucrătoare. */
export const PLAFON_PREAVIZ: Readonly<Record<Categorie, number>> = { executie: 20, conducere: 45 };

export type ParametriDemisie = Readonly<{
  tip: TipDemisie;
  categorie: Categorie;
  nume: string;
  functie: string;
  angajator: string;
  /** „nr. 12 din 03.02.2025”, cum îl scrie omul. */
  contract: string;
  depunere: ZiIso;
  zilePreaviz: number;
  dataAcord: ZiIso;
}>;

export type Preaviz = Readonly<{
  zile: number;
  ultimaZi: ZiIso;
  sarbatoriSarite: readonly SarbatoareInInterval[];
}>;

const text = (v: string | null, maxim = 120): string =>
  (v ?? "").replace(/[\r\n\t]+/gu, " ").trim().slice(0, maxim);

const ETICHETA_CATEGORIE: Readonly<Record<Categorie, string>> = {
  executie: "execuție",
  conducere: "conducere",
};

export function citesteDemisie(
  q: URLSearchParams,
  azi: ZiIso,
): Readonly<{ parametri: ParametriDemisie; avertismente: readonly string[] }> {
  const avertismente: string[] = [];
  const tipBrut = q.get("tip");
  const tip = TIPURI_DEMISIE.find((t) => t.cheie === tipBrut)?.cheie ?? "preaviz";
  const categorie: Categorie = q.get("categorie") === "conducere" ? "conducere" : "executie";

  const data = (cheie: string, eticheta: string): ZiIso => {
    const brut = (q.get(cheie) ?? "").trim();
    if (brut === "") return azi;
    const valida = ziValida(brut);
    if (valida !== null) return valida;
    avertismente.push(
      `${eticheta}: „${brut.slice(0, 20)}” nu e o zi reală între ${String(AN_MIN_INTERVAL)} și ${String(AN_MAX_INTERVAL)}; am folosit ziua de azi.`,
    );
    return azi;
  };
  const depunere = data("depunere", "Data depunerii");
  const dataAcord = data("data_acord", "Data încetării");

  const plafon = PLAFON_PREAVIZ[categorie];
  let zilePreaviz = plafon;
  const brutPreaviz = (q.get("preaviz") ?? "").trim();
  if (brutPreaviz !== "") {
    const n = Number(brutPreaviz);
    if (!Number.isInteger(n) || n < 1) {
      avertismente.push(
        `Preavizul „${brutPreaviz.slice(0, 10)}” nu e un număr întreg de zile; am folosit plafonul legal, ${String(plafon)}.`,
      );
    } else if (n > plafon) {
      avertismente.push(
        `Preavizul nu poate depăși ${zileLucratoareText(plafon)} pentru o funcție de ${ETICHETA_CATEGORIE[categorie]} (art. 81 alin. (4)); am folosit ${String(plafon)}.`,
      );
    } else {
      zilePreaviz = n;
    }
  }

  return {
    parametri: {
      tip,
      categorie,
      nume: text(q.get("nume")),
      functie: text(q.get("functie")),
      angajator: text(q.get("angajator")),
      contract: text(q.get("contract"), 60),
      depunere,
      zilePreaviz,
      dataAcord,
    },
    avertismente,
  };
}

/** Ultima zi de preaviz: a N-a zi lucrătoare după înregistrare. */
export function calculeazaPreaviz(depunere: ZiIso, zile: number): Preaviz {
  try {
    const ultimaZi = aNaZiLucratoareDupa(depunere, zile);
    return { zile, ultimaZi, sarbatoriSarite: sarbatoriSarite(depunere, ultimaZi) };
  } catch (eroare) {
    if (eroare instanceof RangeError) throw new EroareIntrare(eroare.message);
    throw eroare;
  }
}

const sauLinie = (v: string): string => (v === "" ? LINIE_GOALA : v);

export function construiesteDemisie(p: ParametriDemisie): DocumentTabelar {
  const contract = p.contract === "" ? "nr. ______ din ____________" : p.contract;
  const identitate = `Subsemnatul(a) ${sauLinie(p.nume)}, angajat(ă) în funcția de ${sauLinie(p.functie)} la ${sauLinie(p.angajator)}, în baza contractului individual de muncă ${contract},`;
  const inregistrare =
    "Angajatorul e obligat să înregistreze demisia; dacă refuză, salariatul o poate dovedi prin orice mijloc de probă — art. 81 alin. (2) din Codul muncii.";
  const faraMotiv = "Salariatul are dreptul să nu își motiveze demisia — art. 81 alin. (3).";

  const comun = {
    subtitlu: null,
    campuri: [
      { eticheta: "Către", valoare: p.angajator },
      { eticheta: "Înregistrată la nr. / data", valoare: "" },
    ],
    coloane: [],
    randuri: [],
    umbrite: [],
    orientare: "portret",
    numeFisier: `cerere-demisie-${p.nume === "" ? "necompletata" : p.nume}`,
  } as const;

  if (p.tip === "preaviz") {
    const pv = calculeazaPreaviz(p.depunere, p.zilePreaviz);
    const sarite =
      pv.sarbatoriSarite.length === 0
        ? []
        : [
            `Sărbători legale sărite în preaviz: ${pv.sarbatoriSarite.map((s) => `${dataLunga(s.data)} (${s.denumire})`).join("; ")}.`,
          ];
    return {
      ...comun,
      titlu: "Cerere de demisie",
      paragrafe: [
        `${identitate} vă notific prin prezenta demisia mea, în temeiul art. 81 din Codul muncii.`,
        `Voi respecta termenul de preaviz de ${zileLucratoareText(pv.zile)}, care curge din ziua următoare înregistrării prezentei cereri. Pentru o cerere înregistrată ${dataLunga(p.depunere)}, ultima zi de preaviz este ${dataLunga(pv.ultimaZi)}, iar contractul încetează la această dată, dacă nu renunțați total sau parțial la preaviz (art. 81 alin. (7)).`,
      ],
      note: [
        inregistrare,
        faraMotiv,
        "Preavizul se numără în zile lucrătoare: fără sâmbete, duminici și sărbători legale (art. 139). Zilele libere din contractul colectiv sau din regulamentul intern nu sunt scăzute.",
        "Dacă în timpul preavizului contractul se suspendă (de exemplu, pentru concediu medical), preavizul se suspendă și el — art. 81 alin. (6).",
        ...sarite,
      ],
      semnaturi: ["Data și semnătura salariatului"],
    };
  }

  if (p.tip === "fara-preaviz") {
    return {
      ...comun,
      titlu: "Cerere de demisie fără preaviz",
      paragrafe: [
        `${identitate} vă notific prin prezenta demisia mea fără preaviz, în temeiul art. 81 alin. (8) din Codul muncii, întrucât angajatorul nu își îndeplinește obligațiile asumate prin contractul individual de muncă, și anume: ${LINIE_GOALA}.`,
        "Solicit încetarea contractului la data înregistrării prezentei cereri.",
      ],
      note: [
        inregistrare,
        "Temeiul cere ca angajatorul să nu își fi îndeplinit obligațiile din contract; păstrați dovezile obligației neîndeplinite.",
      ],
      semnaturi: ["Data și semnătura salariatului"],
    };
  }

  if (p.tip === "proba") {
    return {
      ...comun,
      titlu: "Notificare de încetare în perioada de probă",
      paragrafe: [
        `${identitate} vă notific încetarea contractului individual de muncă în perioada de probă, fără preaviz, în temeiul art. 31 alin. (3) din Codul muncii, începând cu ${dataLunga(p.depunere)}.`,
      ],
      note: [
        "Pe durata sau la sfârșitul perioadei de probă, contractul poate înceta printr-o notificare scrisă, fără preaviz și fără motivare, la inițiativa oricăreia dintre părți — art. 31 alin. (3).",
      ],
      semnaturi: ["Data și semnătura salariatului"],
    };
  }

  return {
    ...comun,
    titlu: "Cerere de încetare a contractului prin acordul părților",
    paragrafe: [
      `${identitate} vă propun încetarea contractului individual de muncă prin acordul părților, în temeiul art. 55 lit. b) din Codul muncii, la data de ${dataLunga(p.dataAcord)}.`,
    ],
    note: [
      "Acordul părților nu e demisie: contractul încetează la data convenită de părți, iar cererea produce efecte doar dacă angajatorul semnează de acord — art. 55 lit. b).",
    ],
    semnaturi: ["Salariat", "De acord — angajator"],
  };
}

export function demisieDinParametri(q: URLSearchParams): DocumentTabelar {
  return construiesteDemisie(citesteDemisie(q, todayInBucharest()).parametri);
}
```

`intrebari.ts`:

```ts
// src/app/(marketing)/unelte/cerere-demisie/intrebari.ts
import type { IntrebareUnealta } from "@/content/landing/intrebari-pontaj";

/**
 * Întrebările despre demisie, în ordinea în care se caută (completarea
 * automată Google, 8 oct 2026). Fiecare răspuns e citit pe Codul muncii
 * consolidat la 27.04.2026; regula de numărare a preavizului e prin analogie
 * cu RIL nr. 8/2024 și o spunem așa.
 */
export const INTREBARI_DEMISIE: readonly IntrebareUnealta[] = [
  {
    q: "Preavizul la demisie e în zile lucrătoare sau calendaristice?",
    a: "Plafonul din lege e în zile lucrătoare: preavizul e cel din contractul individual sau din contractul colectiv, dar nu mai mult de 20 de zile lucrătoare pentru funcțiile de execuție și 45 pentru cele de conducere. Dacă în contract scrie un număr de zile lucrătoare, sâmbetele, duminicile și sărbătorile legale nu intră în numărătoare. Dacă scrie zile calendaristice, se numără așa, dar fără să treacă de plafon. Unealta numără doar zile lucrătoare.",
    temei: "art. 81 alin. (4) Codul muncii",
  },
  {
    q: "De când începe să curgă preavizul?",
    a: "Din ziua următoare înregistrării demisiei. Pentru preavizul la concediere, Înalta Curte a stabilit exact asta: termenul curge din ziua următoare comunicării și se împlinește în ultima lui zi. Codul nu spune altceva pentru demisie, iar unealta aplică aceeași regulă. Dacă firma numără altfel, ultima zi se mută cu o zi.",
    temei: "art. 81 alin. (1) și (7); RIL nr. 8/2024 (ÎCCJ), pentru art. 75",
  },
  {
    q: "Pot pleca la zi, fără preaviz?",
    a: "Da, în trei situații: angajatorul renunță la preaviz, total sau parțial; angajatorul nu își îndeplinește obligațiile din contract; ești în perioada de probă. Altfel, plecarea la o dată aleasă de amândoi e acordul părților, pe care angajatorul trebuie să-l semneze.",
    temei: "art. 81 alin. (7) și (8), art. 31 alin. (3), art. 55 lit. b) Codul muncii",
  },
  {
    q: "Ce se întâmplă cu preavizul dacă intru în concediu medical?",
    a: "Concediul pentru incapacitate temporară de muncă suspendă contractul de drept, iar preavizul se suspendă odată cu el. Ultima zi se mută mai târziu, cu perioada suspendării.",
    temei: "art. 50 lit. b) și art. 81 alin. (6) Codul muncii",
  },
  {
    q: "Pot să-mi iau concediu de odihnă în preaviz?",
    a: "Codul nu interzice. Pe durata preavizului contractul își produce toate efectele, deci concediul se ia ca oricând, cu programarea sau acordul angajatorului. Concediul de odihnă nu e un caz de suspendare a contractului, așa că nu mută ultima zi; concediul medical o mută.",
    temei: "art. 81 alin. (5) Codul muncii",
  },
  {
    q: "Trebuie să motivez demisia?",
    a: "Nu. Salariatul are dreptul să nu își motiveze demisia, iar modelul de aici nu are un rând pentru motiv.",
    temei: "art. 81 alin. (3) Codul muncii",
  },
  {
    q: "Ce fac dacă angajatorul refuză să înregistreze demisia?",
    a: "Angajatorul e obligat s-o înregistreze. Dacă refuză, o poți dovedi prin orice mijloc de probă — de exemplu, o trimiți prin poștă cu confirmare de primire și păstrezi dovada.",
    temei: "art. 81 alin. (2) Codul muncii",
  },
];
```

`page.tsx`:

```tsx
// src/app/(marketing)/unelte/cerere-demisie/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { LEGATURI_CONEXE } from "@/content/landing/legaturi";
import { RO } from "@/content/landing/ro";
import { metaUnealta } from "@/content/landing/seo-unelte";
import { ANTET_CERERE_DEMISIE } from "@/content/landing/unelte";
import { dataLunga } from "@/domain/calendar/interval-lucrator";
import { todayInBucharest } from "@/lib/format/date";
import { EroareIntrare, type DocumentTabelar } from "@/lib/unelte/document-tabelar";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";
import { Descarcari } from "../../_componente/descarcari";
import { IntrebariUnealta } from "../../_componente/intrebari-unealta";
import { JsonLd } from "../../_componente/json-ld";
import { metadatePagina } from "../../_componente/metadate";
import { nodUnealta } from "../../_componente/noduri-json-ld";
import { PeAcelasiSubiect } from "../../_componente/pe-acelasi-subiect";
import { PrevizualizareDocument } from "../../_componente/previzualizare-document";
import { zileLucratoareText } from "../cerere-concediu-de-odihna/text-zile";
import { INTREBARI_DEMISIE } from "./intrebari";
import {
  calculeazaPreaviz,
  citesteDemisie,
  construiesteDemisie,
  PLAFON_PREAVIZ,
  TIPURI_DEMISIE,
  type Preaviz,
} from "./model";

/**
 * Cererea de demisie, gratuită, fără cont.
 *
 * Completarea automată Google, 8 oct 2026: „model demisie”, „cerere demisie” și
 * „preaviz demisie” sunt cele mai largi familii măsurate în zona HR. Modelele
 * găsite (zarinacrm, hipo, wps) lasă data încetării goală; aici ultima zi de
 * preaviz se calculează pe zile lucrătoare, cu sărbătorile legale.
 */
const CALE = "/unelte/cerere-demisie";

export const metadata: Metadata = metadatePagina(metaUnealta(CALE));

type Proprietati = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const unul = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2.5 text-base";

const CAMPURI = [
  { nume: "nume", eticheta: "Numele și prenumele", exemplu: "Popescu Ana" },
  { nume: "functie", eticheta: "Funcția", exemplu: "contabil" },
  { nume: "angajator", eticheta: "Angajatorul", exemplu: "Administrativo Demo SRL" },
  { nume: "contract", eticheta: "Contractul (nr. și data)", exemplu: "nr. 12 din 03.02.2025" },
] as const;

const CHEI = [
  "tip",
  "categorie",
  "nume",
  "functie",
  "angajator",
  "contract",
  "depunere",
  "preaviz",
  "data_acord",
] as const;

export default async function PaginaCerereDemisie({ searchParams }: Proprietati) {
  const p = await searchParams;
  const q = new URLSearchParams();
  for (const cheie of CHEI) {
    const v = unul(p[cheie]);
    if (v !== undefined && v !== "") q.set(cheie, v);
  }
  const { parametri, avertismente } = citesteDemisie(q, todayInBucharest());
  let document: DocumentTabelar | null = null;
  let preaviz: Preaviz | null = null;
  let problema: string | null = null;
  try {
    document = construiesteDemisie(parametri);
    if (parametri.tip === "preaviz") {
      preaviz = calculeazaPreaviz(parametri.depunere, parametri.zilePreaviz);
    }
  } catch (eroare) {
    if (!(eroare instanceof EroareIntrare)) throw eroare;
    problema = eroare.message;
  }
  const valori: Readonly<Record<(typeof CAMPURI)[number]["nume"], string>> = {
    nume: parametri.nume,
    functie: parametri.functie,
    angajator: parametri.angajator,
    contract: parametri.contract,
  };

  return (
    <Cadru text={RO}>
      <JsonLd
        date={nodUnealta({
          cale: CALE,
          nume: ANTET_CERERE_DEMISIE.titlu,
          descriere: ANTET_CERERE_DEMISIE.lead,
        })}
      />
      <div data-tipar="ascunde">
        <AntetSecundar
          text={ANTET_CERERE_DEMISIE}
          firimituri={[
            { eticheta: "Acasă", href: "/" },
            { eticheta: "Unelte", href: "/unelte" },
            { eticheta: "Cerere de demisie", href: CALE },
          ]}
        />
      </div>

      <div data-tipar="ascunde">
        <Banda inaltime="scurta" supratitlu="Pe scurt" titlu="Ce spune Codul muncii despre demisie">
          <div className="mt-4 max-w-[68ch] space-y-3 text-[0.9375rem] leading-[1.7]">
            <p>
              Demisia e o notificare scrisă prin care anunți angajatorul că pleci, după un termen
              de preaviz (art. 81 alin. (1)). Nu trebuie motivată (alin. (3)), iar angajatorul e
              obligat s-o înregistreze (alin. (2)).
            </p>
            <p>
              Preavizul e cel din contract, dar cel mult {zileLucratoareText(PLAFON_PREAVIZ.executie)}{" "}
              pentru o funcție de execuție și {zileLucratoareText(PLAFON_PREAVIZ.conducere)} pentru
              una de conducere (alin. (4)). Contractul încetează în ultima zi de preaviz sau mai
              devreme, dacă angajatorul renunță la preaviz (alin. (7)).
            </p>
          </div>
        </Banda>
      </div>

      <Banda inaltime="scurta">
        <form
          action="#documentul"
          method="get"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          data-tipar="ascunde"
        >
          <label className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
            <span className="text-[0.875rem] font-medium">Ce fel de cerere</span>
            <select name="tip" defaultValue={parametri.tip} className={CLASA_CAMP}>
              {TIPURI_DEMISIE.map((t) => (
                <option key={t.cheie} value={t.cheie}>
                  {t.eticheta}
                </option>
              ))}
            </select>
          </label>
          {CAMPURI.map((c) => (
            <label key={c.nume} className="flex flex-col gap-1.5">
              <span className="text-[0.875rem] font-medium">{c.eticheta}</span>
              <input
                type="text"
                name={c.nume}
                maxLength={c.nume === "contract" ? 60 : 120}
                defaultValue={valori[c.nume]}
                placeholder={c.exemplu}
                className={CLASA_CAMP}
              />
            </label>
          ))}
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Funcția e de</span>
            <select name="categorie" defaultValue={parametri.categorie} className={CLASA_CAMP}>
              <option value="executie">execuție (preaviz de cel mult 20 de zile)</option>
              <option value="conducere">conducere (preaviz de cel mult 45 de zile)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Preavizul din contract (zile lucrătoare)</span>
            <input
              type="number"
              name="preaviz"
              min={1}
              max={45}
              inputMode="numeric"
              defaultValue={String(parametri.zilePreaviz)}
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Data înregistrării cererii</span>
            <input type="date" name="depunere" defaultValue={parametri.depunere} className={CLASA_CAMP} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Data încetării (doar la acordul părților)</span>
            <input type="date" name="data_acord" defaultValue={parametri.dataAcord} className={CLASA_CAMP} />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              data-umami-event="demisie-genereaza"
              className="bg-mk-cerneala text-mk-text-inv inline-flex h-11 w-full items-center justify-center rounded px-5 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
            >
              Completează cererea
            </button>
          </div>
          <Descarcari actiune="/api/unelte/cerere-demisie" eveniment="demisie" formate={["docx", "pdf"]} />
        </form>
        {(avertismente.length > 0 || problema !== null) && (
          <ul role="status" className="border-mk-rigla mt-6 max-w-[68ch] space-y-1 border-l-2 pl-4 text-[0.9375rem]" data-tipar="ascunde">
            {[...avertismente, ...(problema === null ? [] : [problema])].map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        )}
      </Banda>

      {preaviz !== null && (
        <div data-tipar="ascunde">
          <Banda
            id="rezultat"
            inaltime="scurta"
            supratitlu="Ultima zi de preaviz"
            titlu={dataLunga(preaviz.ultimaZi)}
          >
            <p className="text-mk-text-slab mt-4 max-w-[68ch] text-[0.9375rem] leading-[1.7]">
              {zileLucratoareText(preaviz.zile)} numărate de a doua zi după {dataLunga(parametri.depunere)}
              , fără sâmbete și duminici
              {preaviz.sarbatoriSarite.length > 0
                ? ` și fără ${preaviz.sarbatoriSarite.map((s) => s.denumire).join(", ")}`
                : ""}
              . Alt termen?{" "}
              <Link
                href={`/unelte/calculator-zile-lucratoare?mod=adauga&de_la=${parametri.depunere}&zile=${String(preaviz.zile)}#rezultat`}
                className="underline underline-offset-4"
              >
                Calculatorul de zile lucrătoare
              </Link>
              .
            </p>
          </Banda>
        </div>
      )}

      {document !== null && (
        <Banda id="documentul" inaltime="scurta">
          <PrevizualizareDocument document={document} />
        </Banda>
      )}

      <div data-tipar="ascunde">
        <IntrebariUnealta titlu="Ce se mai întreabă despre demisie" intrebari={INTREBARI_DEMISIE} />

        <Banda inaltime="scurta" supratitlu="Fără hârtie" titlu="Plecarea unui om, ținută la zi">
          <p className="text-mk-text-slab mt-4 max-w-[68ch] text-[0.9375rem] leading-[1.7]">
            În aplicație, încetarea contractului devine un eveniment de transmis în REGES-ONLINE,
            cu termenul lui calculat.{" "}
            <Link href="/module/reges" className="underline underline-offset-4">
              Cum arată modulul REGES
            </Link>
            .
          </p>
          <PeAcelasiSubiect legaturi={LEGATURI_CONEXE["/unelte/cerere-demisie"]} />
        </Banda>
      </div>
    </Cadru>
  );
}
```

Afirmația din banda „Fără hârtie” e aceeași pe care o face fișa modulului REGES (`fise-module.ts:780`: „Fiecare eveniment din viața unui contract — angajare, modificare de salariu, suspendare, încetare — are propriul lui număr de zile”). Evenimentul `incetare` există în `src/domain/reges/evenimente.ts:21`.

**`src/lib/unelte/registru.ts`.** (Corectat la verificare, 8 oct 2026: prima versiune ancora importul pe linia lui `fisaEvaluareDinParametri` și cheia după `"condica-de-prezenta"`. Până la K8 dispar amândouă: E12 scoate condica, F12 cererea de concediu, G6 foaia de parcurs, iar I7 fișa de evaluare, cu import cu tot (`I-fisa-evaluare.md`, I7, „șterge linia”). Pe `main` rămâne doar fișa SSM.) Pasul 0: `grep -n '^import\|^  "' src/lib/unelte/registru.ts`. Importul nou se pune după ultimul `import { … } from "@/app/(marketing)/unelte/…/model";` existent:

```ts
import { demisieDinParametri } from "@/app/(marketing)/unelte/cerere-demisie/model";
```

Cheia nouă intră ultima în `UNELTE`:

```ts
  "cerere-demisie": demisieDinParametri,
```

**Formatele (dacă H5 e pe `main`, adică `grep -c FORMATE_RESTRANSE src/lib/unelte/registru.ts` dă cel puțin 1).** Cererea de demisie e o scrisoare, fără tabel. F12 a hotărât același lucru pentru cererea de concediu: Excel nu se servește, se răspunde cu 400. Pagina oferă doar Word și PDF. Fără pasul ăsta, `?format=xlsx` ar da o foaie de calcul goală. Adăugări:

- În `FORMATE_RESTRANSE` din `registru.ts`, după `"fisa-instruire-ssm": ["pdf", "docx"],`:

```ts
  // Scrisoare, fără tabel: o foaie de calcul ar ieși goală (K8).
  "cerere-demisie": ["pdf", "docx"],
```

- În `src/lib/unelte/registru.test.ts` (testul lui H5, „fișa SSM n-are Excel; restul au toate trei formatele”). Vechi:

```ts
    for (const slug of Object.keys(UNELTE).filter((s) => s !== "fisa-instruire-ssm")) {
```

Nou:

```ts
    expect(formatePentru("cerere-demisie")).toEqual(["pdf", "docx"]);
    const restranse: readonly string[] = ["fisa-instruire-ssm", "cerere-demisie"];
    for (const slug of Object.keys(UNELTE).filter((s) => !restranse.includes(s))) {
```

- În `route.test.ts`, testul lui H5 „celelalte unelte din registru își păstrează Excelul” alegea prima cheie diferită de fișa SSM, adică acum cererea de demisie. Vechi:

```ts
    const alta = Object.keys(UNELTE).find((s) => s !== "fisa-instruire-ssm");
```

Nou:

```ts
    const alta = Object.keys(UNELTE).find((s) => formatePentru(s).includes("xlsx"));
```

Importul lui H5, `import { UNELTE } from "@/lib/unelte/registru";`, devine `import { formatePentru, UNELTE } from "@/lib/unelte/registru";`. În blocul `describe("cererea de demisie prin ruta comună")` de la Pasul 1 se adaugă:

```ts
  it("Excel primește 400: scrisoarea n-are formă de foaie de calcul", async () => {
    const r = await cere("/api/unelte/cerere-demisie?format=xlsx", "cerere-demisie");
    expect(r.status).toBe(400);
    expect(await r.text()).toBe("Unealta asta se descarcă doar în PDF sau Word.");
  });
```

Dacă H5 NU e pe `main`, pasul ăsta se sare și se notează în raportul taskului: H5 trebuie să primească aceeași intrare când ajunge.

**Calculatorul de zile lucrătoare** (`calculator-zile-lucratoare/page.tsx`, banda de rezultat). Vechi:

```tsx
          regulamentul intern, nu. Pentru un concediu, zilele le numără direct{" "}
          <Link href="/unelte/cerere-concediu-de-odihna" className="underline underline-offset-4">
            cererea de concediu
          </Link>
          .
```

Nou:

```tsx
          regulamentul intern, nu. Pentru un concediu, zilele le numără direct{" "}
          <Link href="/unelte/cerere-concediu-de-odihna" className="underline underline-offset-4">
            cererea de concediu
          </Link>
          ; pentru o demisie, ultima zi de preaviz o calculează{" "}
          <Link href="/unelte/cerere-demisie" className="underline underline-offset-4">
            cererea de demisie
          </Link>
          .
```

**Înregistrările.**

`unelte.ts`, la final:

```ts

/**
 * Cererea de demisie: cea mai largă familie de căutări din zona HR măsurată
 * pe 8 oct 2026 („model demisie”, „cerere demisie”, „preaviz demisie”).
 * Diferențiatorul: ultima zi de preaviz, calculată pe zile lucrătoare.
 */
export const ANTET_CERERE_DEMISIE: AntetPagina = {
  supratitlu: "Unealtă gratuită",
  titlu: "Cerere de demisie",
  lead: "Cererea de demisie gata de semnat, cu ultima zi de preaviz calculată în zile lucrătoare, fără weekenduri și sărbători. Plus variantele fără preaviz, în perioada de probă și prin acordul părților. Word sau PDF, fără cont.",
};
```

`seo-unelte.ts`, în `META_UNELTE`:

```ts
  "/unelte/cerere-demisie": {
    titlu: "Cerere de demisie: model Word, preaviz calculat",
    descriere:
      "Model de cerere de demisie cu preaviz calculat: ultima zi de lucru, fără weekend și sărbători. Și fără preaviz, în perioada de probă sau cu acordul părților.",
    termen: "cerere demisie",
  },
```

`hub-unelte.ts`: importul primește `ANTET_CERERE_DEMISIE`, iar după grupul `concedii` se adaugă un grup nou:

```ts
  {
    id: "plecare",
    supratitlu: "Plecare și adeverințe",
    titlu: "Când omul pleacă sau cere o hârtie",
    lead: "Demisia cu preavizul calculat și actele pe care le cere un salariat de la firmă.",
    pagini: [
      rand(
        "/unelte/cerere-demisie",
        ANTET_CERERE_DEMISIE,
        "ultima zi de preaviz calculată · fără preaviz, probă, acord · Word, PDF",
      ),
    ],
  },
```

`legaturi.ts`, cheie nouă, înaintea lui `"/unelte/calculator-salariu": [`:

```ts
  "/unelte/cerere-demisie": [
    { eticheta: "Calculator de zile lucrătoare între două date", href: "/unelte/calculator-zile-lucratoare" },
    { eticheta: "Concediul de odihnă neefectuat la plecare", href: "/ghid/concediu-de-odihna#neefectuat" },
    { eticheta: "REGES-ONLINE: termene și amenzi", href: "/reges-online" },
  ],
```

Ancora `#neefectuat` există: fișa `leave` trimite deja spre ea (`fise-module.ts:609`), iar `continut.test.ts` verifică ancorele. În lista `"/unelte/calculator-zile-lucratoare"`, la final:

```ts
    { eticheta: "Cerere de demisie cu preaviz calculat", href: "/unelte/cerere-demisie" },
```

`fise-module.ts`, fișa `reges`. Vechi:

```ts
    ghiduri: [
      { href: "/reges-online", eticheta: "REGES-ONLINE: termene și amenzi" },
      { href: "/ghid/control-itm", eticheta: "Ce se cere la un control ITM" },
    ],
```

Nou:

```ts
    ghiduri: [
      { href: "/reges-online", eticheta: "REGES-ONLINE: termene și amenzi" },
      { href: "/ghid/control-itm", eticheta: "Ce se cere la un control ITM" },
      { href: "/unelte/cerere-demisie", eticheta: "Cerere de demisie: model cu preaviz calculat" },
    ],
```

În aceeași fișă, `actualizat` (azi `:772`) devine data commitului.

`concediu-odihna.ts`, `legaturiConexe`, după intrarea spre `/unelte/calculator-zile-concediu` (K3):

```ts
    {
      eticheta: "Plecarea din firmă: cerere de demisie cu preaviz calculat",
      href: "/unelte/cerere-demisie",
    },
```

`ro.ts`, `unelteGratuite.unelte`, după obiectul cu `href: "/unelte/cerere-concediu-de-odihna"`:

```ts
      {
        titlu: "Cerere de demisie",
        text: "Cu ultima zi de preaviz calculată în zile lucrătoare, plus variantele fără preaviz și prin acordul părților.",
        formate: "PDF · Word",
        href: "/unelte/cerere-demisie",
      },
```

`en.ts`, în același loc:

```ts
      {
        titlu: "Resignation letter",
        text: "With the last day of notice counted in working days, plus the no-notice and mutual-agreement variants. In Romanian.",
        formate: "PDF · Word",
        href: "/unelte/cerere-demisie",
      },
```

`llms.txt/route.ts`, înaintea elementului `[\n    "/unelte/condica-de-prezenta",`:

```ts
  [
    "/unelte/cerere-demisie",
    "Unealtă gratuită: cerere de demisie gata de semnat, cu ultima zi de preaviz calculată în zile lucrătoare — preavizul e cel din contract, dar cel mult 20 de zile lucrătoare pentru funcțiile de execuție și 45 pentru cele de conducere (art. 81 alin. (4) Codul muncii); numărătoarea începe a doua zi după înregistrare (prin analogie cu RIL nr. 8/2024). Exemplu: înregistrată pe 8 octombrie 2026, cu 20 de zile, ultima zi e 5 noiembrie 2026. Plus demisia fără preaviz (art. 81 alin. (8)), încetarea în perioada de probă (art. 31 alin. (3)) și acordul părților (art. 55 lit. b)). Word sau PDF, fără cont.",
  ],
```

`harta.ts`, după blocul `/unelte/calculator-zile-lucratoare`:

```ts
  {
    // 8 oct 2026: „model demisie”, „cerere demisie”, „preaviz demisie” (completarea automată).
    cale: "/unelte/cerere-demisie",
    prioritate: 0.7,
    limba: "ro",
    traducere: null,
    actualizat: "<data commitului, date +%F>",
    sectiune: "Unelte și comparații",
  },
```

Plus `actualizat` la data commitului pe `/unelte/calculator-zile-lucratoare` (pagina ei s-a schimbat), `/unelte`, `/` și `/en`, cu comentariul `// <data>: cererea de demisie.`

`cuvinte-tinta.tsv`, cu garda de linie nouă finală:

```bash
cd /srv/apps/ERP && [ -z "$(tail -c1 docs/comercial/cuvinte-tinta.tsv)" ] || echo >> docs/comercial/cuvinte-tinta.tsv
cd /srv/apps/ERP && printf '%s\t%s\n' \
  "cerere demisie" /unelte/cerere-demisie \
  "model demisie" /unelte/cerere-demisie \
  "cerere demisie fara preaviz" /unelte/cerere-demisie \
  "preaviz demisie zile lucratoare sau calendaristice" /unelte/cerere-demisie \
  "model demisie cu acordul partilor" /unelte/cerere-demisie >> docs/comercial/cuvinte-tinta.tsv
```

**`NOTES.md`**, după paragraful care începe cu „⚠️ **Fluxul de demisie nu există în aplicație.**” (azi `:289-292`):

```markdown

⚠️ **Numărarea preavizului la demisie în unealta publică `/unelte/cerere-demisie`.**
Preavizul curge din ziua următoare înregistrării și se împlinește în a N-a zi
lucrătoare (sâmbetele, duminicile și sărbătorile din art. 139 scăzute). Regula e
cea din RIL nr. 8/2024 (ÎCCJ, MO 573/19.06.2024), dată pentru preavizul la
CONCEDIERE (art. 75 și art. 278 Codul muncii); pentru demisie (art. 81) o aplicăm
prin analogie, iar pagina o spune. De confirmat de jurist: analogia și dacă
„ultima zi de preaviz” coincide cu data încetării înscrisă în REGES-ONLINE.
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte/cerere-demisie/" "src/app/api/unelte/[unealta]/route.test.ts" src/lib/unelte/ src/content/landing/ "src/app/(marketing)/_componente/descrieri.test.ts"
cd /srv/apps/ERP && pnpm typecheck && pnpm check:server && pnpm lint && pnpm test && pnpm exec prettier --check "src/app/(marketing)/unelte/cerere-demisie" "src/app/(marketing)/unelte/calculator-zile-lucratoare/page.tsx" src/lib/unelte/registru.ts src/lib/unelte/registru.test.ts "src/app/api/unelte/[unealta]/route.test.ts" src/content/landing src/content/legal/concediu-odihna.ts src/app/llms.txt/route.ts
```

Dacă `pnpm check:server` semnalează importul lui `todayInBucharest` în `model.ts`, importat și de `registru.ts` (server) și de pagină: `@/lib/format/date` e modul neutru, fără `server-only`, deci nu e o graniță. Poarta nu trebuie să pice.

- [ ] **Pasul 5: Verificare headless la 360 px și a fișierelor**, cu `pnpm dev -H 127.0.0.1 -p 3917` pornit:

```bash
cat > /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/k8.mjs <<'JS'
import { chromium } from "/srv/apps/ERP/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core/index.mjs";
const b = await chromium.launch({ executablePath: "/home/miro/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell" });
const p = await b.newPage({ viewport: { width: 360, height: 800 } });
const baza = "http://127.0.0.1:3917/unelte/cerere-demisie";
for (const [nume, q] of [["implicit", ""], ["conducere", "?categorie=conducere&depunere=2026-12-10&nume=Popescu%20Ana"], ["peste", "?preaviz=30"], ["acord", "?tip=acord&data_acord=2026-10-30"]]) {
  await p.goto(baza + q, { waitUntil: "networkidle" });
  console.log(nume, JSON.stringify(await p.evaluate(() => ({
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    ultima: document.querySelector("#rezultat h2")?.textContent?.trim() ?? null,
    status: document.querySelector('[role="status"]')?.textContent?.trim() ?? null,
    titluDoc: document.querySelector("#documentul figcaption p")?.textContent?.trim() ?? null,
  }))));
  await p.screenshot({ path: `/tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/k8-${nume}.png`, fullPage: true });
}
await b.close();
JS
node /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/k8.mjs
for f in pdf docx; do curl -s -o /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/k8.$f -w "$f %{http_code} %{content_type}\n" "http://127.0.0.1:3917/api/unelte/cerere-demisie?nume=Popescu%20Ana&categorie=conducere&depunere=2026-12-10&format=$f"; done
python3 -I -c "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); x=z.read('word/document.xml').decode(); print('17 februarie 2027' in x, 'Crăciunul' in x)" /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/k8.docx
```

Așteptat: `sw === cw` pe toate patru. `implicit` dă `ultima` = data de azi + 20 de zile lucrătoare. `conducere` dă „miercuri, 17 februarie 2027”. `peste` dă `status` cu „Preavizul nu poate depăși 20 de zile lucrătoare…”. `acord` dă `ultima: null` și `titluDoc` „Cerere de încetare a contractului prin acordul părților”. Fișierele: `pdf 200 application/pdf`, `docx 200 application/vnd.openxmlformats-officedocument.wordprocessingml.document`, iar verificarea Python tipărește `True True`.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
D="src/app/(marketing)/unelte/cerere-demisie"
CAI=("$D/model.ts" "$D/model.test.ts" "$D/intrebari.ts" "$D/page.tsx" "src/app/(marketing)/unelte/calculator-zile-lucratoare/page.tsx" src/lib/unelte/registru.ts src/lib/unelte/registru.test.ts "src/app/api/unelte/[unealta]/route.test.ts" src/content/landing/unelte.ts src/content/landing/seo-unelte.ts src/content/landing/hub-unelte.ts src/content/landing/legaturi.ts src/content/landing/fise-module.ts src/content/legal/concediu-odihna.ts src/content/landing/ro.ts src/content/landing/en.ts src/app/llms.txt/route.ts src/content/landing/harta.ts docs/comercial/cuvinte-tinta.tsv NOTES.md)
git status --short -- "${CAI[@]}"
git fetch origin main
git diff --name-only HEAD origin/main -- "${CAI[@]}"
git add -- "$D/model.ts" "$D/model.test.ts" "$D/intrebari.ts" "$D/page.tsx"
git commit --only -m "feat(unelte): cererea de demisie, cu ultima zi de preaviz calculată" -m "Art. 81 (preaviz de cel mult 20/45 de zile lucrătoare, din ziua următoare înregistrării — RIL 8/2024 prin analogie, ⚠ în NOTES.md), plus fără preaviz (alin. (8)), perioada de probă (art. 31 alin. (3)) și acordul părților (art. 55 lit. b)). Word și PDF prin ruta comună; 400 cu motivul când termenul iese din calendar." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "${CAI[@]}"
node scripts/checks/lastmod.mjs
git merge origin/main
git push origin main
```

---
### Task K9: Programarea concediilor de odihnă (`/unelte/programare-concedii`)

Cererea măsurată azi: „programare concedii” are scorul 338, cu „programare concedii de odihna 2026 excel” pe primul loc (31). „Planificare concedii” are 315, cu „planificare concedii odihna excel” pe primul loc (29). Auditul SEO din 7 oct a cerut unealta explicit („Unealtă nouă: programarea concediilor”, `docs/comercial/audit-seo-2026-10-07.md:164`). GSC are deja afișări pe „planificarea concediului de odihna” (poziția 47). Temeiul e art. 145 alin. (1), art. 147 alin. (1), art. 148 alin. (1)–(5) și art. 149, citite azi pe forma consolidată din 27.04.2026.

Rulează după K6, K8 (grupul `plecare` din hub e deja acolo, iar `concedii` primește rândul), B3 și E7.

**Fișiere:**
- Create: `src/app/(marketing)/unelte/programare-concedii/model.ts`, `intrebari.ts`, `page.tsx`
- Test: `src/app/(marketing)/unelte/programare-concedii/model.test.ts`
- Modify: `src/content/landing/seo-unelte.ts` (`{an-programare}`) și `seo-unelte.test.ts` (un caz nou)
- Modify: `src/lib/unelte/registru.ts`, `src/app/api/unelte/[unealta]/route.test.ts`
- Modify: înregistrările: `unelte.ts`, `hub-unelte.ts` (grupul `concedii`), `legaturi.ts`, `fise-module.ts` (fișa `leave`), `concediu-odihna.ts`, `ro.ts`, `en.ts`, `llms.txt/route.ts`, `harta.ts`, `cuvinte-tinta.tsv`

**Interfețe:**
- Consumă: `calendarulAnului(an): CalendarAn` (`@/content/legal/zile-libere`, citit: `luni[i].zileLucratoare`, `zile[i].data` de forma „1 ianuarie 2027”, `zile[i].inWeekend`, `zile[i].denumiri`); `anulProgramarii`, `AN_MIN_INTERVAL`, `AN_MAX_INTERVAL` (K6); `citesteAngajati(brut: string | undefined): ListaAngajati` (B3, `../foaie-de-pontaj/foaie`: `{ nume, total, omisi, scurtate }`); `DocumentTabelar` (`@/lib/unelte/document-tabelar`); `todayInBucharest`.
- Produce:
  ```ts
  export const ZILE_MINIME = 20; // art. 145 alin. (1)
  export const ZILE_MAXIME = 60;
  export type ParametriProgramare = Readonly<{ an: number; firma: string; compartiment: string; angajati: readonly string[]; zileCuvenite: number }>;
  export function citesteProgramare(q: URLSearchParams, azi: string): Readonly<{ parametri: ParametriProgramare; avertismente: readonly string[] }>;
  export function construiesteProgramare(p: ParametriProgramare): DocumentTabelar;
  export function programareDinParametri(q: URLSearchParams): DocumentTabelar;
  export const INTREBARI_PROGRAMARE: readonly IntrebareUnealta[]; // intrebari.ts
  ```

- [ ] **Pasul 1: Scrie testul care pică**: `src/app/(marketing)/unelte/programare-concedii/model.test.ts`

```ts
// src/app/(marketing)/unelte/programare-concedii/model.test.ts
import { describe, expect, it } from "vitest";

import { constructorPentru } from "@/lib/unelte/registru";

import { INTREBARI_PROGRAMARE } from "./intrebari";
import { citesteProgramare, construiesteProgramare } from "./model";

const citeste = (s: string, azi = "2026-10-08") => citesteProgramare(new URLSearchParams(s), azi);

describe("citesteProgramare", () => {
  it("în octombrie, implicit e anul următor (art. 148 alin. (1)); 20 de zile", () => {
    expect(citeste("")).toEqual({
      parametri: { an: 2027, firma: "", compartiment: "", angajati: [], zileCuvenite: 20 },
      avertismente: [],
    });
    expect(citeste("", "2026-03-01").parametri.an).toBe(2026);
  });

  it("sub minimul legal sau necitibil: 20, cu motivul", () => {
    expect(citeste("zile=15")).toMatchObject({
      parametri: { zileCuvenite: 20 },
      avertismente: ["Zile cuvenite: „15” nu e un număr între 20 și 60 (minimul legal e de 20 de zile lucrătoare, art. 145 alin. (1)); am folosit 20."],
    });
    expect(citeste("zile=25").parametri.zileCuvenite).toBe(25);
  });

  it("un an din afara calendarului e spus, nu înlocuit tăcut", () => {
    expect(citeste("an=2040").avertismente).toEqual([
      "Anul „2040” e în afara intervalului 2024–2035; am folosit 2027.",
    ]);
  });

  it("numele, câte unul pe rând", () => {
    expect(citeste("angajati=Popa%20Ion%0AIlie%20Maria").parametri.angajati).toEqual([
      "Popa Ion",
      "Ilie Maria",
    ]);
  });
});

describe("documentul", () => {
  const d = construiesteProgramare(
    citeste("an=2027&angajati=Popa%20Ion%0AIlie%20Maria&zile=21&firma=Administrativo%20Demo%20SRL").parametri,
  );

  it("antetul are lunile cu zilele lucrătoare ale anului", () => {
    expect(d.coloane).toHaveLength(17);
    expect(d.coloane.map((c) => c.eticheta).slice(3, 15)).toEqual([
      "Ian\n18 z.l.",
      "Feb\n20 z.l.",
      "Mar\n23 z.l.",
      "Apr\n21 z.l.",
      "Mai\n20 z.l.",
      "Iun\n20 z.l.",
      "Iul\n22 z.l.",
      "Aug\n22 z.l.",
      "Sep\n22 z.l.",
      "Oct\n21 z.l.",
      "Noi\n21 z.l.",
      "Dec\n22 z.l.",
    ]);
  });

  it("un rând pe om, cu zilele cuvenite; titlul și firma", () => {
    expect(d.titlu).toBe("Programarea concediilor de odihnă pe anul 2027");
    expect(d.subtitlu).toBe("Administrativo Demo SRL");
    expect(d.randuri).toHaveLength(2);
    expect(d.randuri[0]).toEqual(["1", "Popa Ion", "21", ...Array.from({ length: 14 }, () => "")]);
    expect(d.orientare).toBe("peisaj");
  });

  it("notele: sărbătorile din zile lucrătoare și art. 148 alin. (1) și (5)", () => {
    const note = d.note.join("\n");
    expect(note).toContain("30 aprilie (Vinerea Mare)");
    expect(note).toContain("3 mai (A doua zi de Paște)");
    expect(note).not.toContain("1 mai (Ziua Muncii)"); // sâmbătă în 2027
    expect(note).toContain("art. 148 alin. (1)");
    expect(note).toContain("10 zile lucrătoare");
  });

  it("fără nume: zece rânduri goale, de completat de mână", () => {
    const gol = construiesteProgramare(citeste("an=2027").parametri);
    expect(gol.randuri).toHaveLength(10);
    expect(gol.randuri[0]?.[1]).toBe("");
    expect(gol.randuri[0]?.[2]).toBe("");
  });

  it("e servită de ruta comună", () => {
    expect(constructorPentru("programare-concedii")).toBeTypeOf("function");
  });
});

describe("întrebările paginii", () => {
  it("se termină cu „?”, răspunsurile cu punct, fără ș/ț cu sedilă", () => {
    for (const r of INTREBARI_PROGRAMARE) {
      expect(r.q).toMatch(/\?$/u);
      expect(r.a).toMatch(/\.$/u);
      expect(`${r.q}${r.a}${r.temei ?? ""}`).not.toMatch(/[\u015E\u015F\u0162\u0163]/u);
    }
  });
});
```

În `src/content/landing/seo-unelte.test.ts`, în testul „anul din titlu e anul cererii, nu al build-ului”, se adaugă:

```ts
    expect(metaUnealta("/unelte/programare-concedii", "2026-10-08").titlu).toContain("2027");
    expect(metaUnealta("/unelte/programare-concedii", "2026-03-01").titlu).toContain("2026");
```

Iar la finalul lui `route.test.ts`:

```ts
describe("programarea concediilor prin ruta comună", () => {
  it("dă un Excel", async () => {
    const r = await cere(
      "/api/unelte/programare-concedii?an=2027&angajati=Popa%20Ion&format=xlsx",
      "programare-concedii",
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte/programare-concedii/" src/content/landing/seo-unelte.test.ts "src/app/api/unelte/[unealta]/route.test.ts"
```

Așteptat: `Failed to resolve import "./intrebari"`; în `seo-unelte.test.ts`, `Unealta /unelte/programare-concedii n-are metadate`; în `route.test.ts`, `expected 404 to be 200`.

- [ ] **Pasul 3: Implementarea minimă**

`model.ts`:

```ts
// src/app/(marketing)/unelte/programare-concedii/model.ts
import { calendarulAnului } from "@/content/legal/zile-libere";
import {
  AN_MAX_INTERVAL,
  AN_MIN_INTERVAL,
  anulProgramarii,
} from "@/domain/calendar/interval-lucrator";
import { todayInBucharest } from "@/lib/format/date";
import type { DocumentTabelar } from "@/lib/unelte/document-tabelar";

import { citesteAngajati } from "../foaie-de-pontaj/foaie";

/**
 * Programarea anuală a concediilor de odihnă.
 *
 * ── TEMEIURILE (Codul muncii, consolidat la 27.04.2026) ──────────────────
 * Art. 148 alin. (1): programare colectivă sau individuală, stabilită de
 * angajator cu consultarea sindicatului sau a reprezentanților salariaților
 * (colectivă) ori a salariatului (individuală), „până la sfârșitul anului
 * calendaristic pentru anul următor”. Alin. (5): la fracționare, cel puțin 10
 * zile lucrătoare neîntrerupte pe an. Art. 145 alin. (1): minimum 20 de zile
 * lucrătoare pe an. Codul nu dă un formular; tabelul de aici e forma uzuală,
 * un rând pe om și o coloană pe lună.
 *
 * ── CE ADUCE PESTE UN EXCEL GOL ───────────────────────────────────────────
 * Zilele lucrătoare ale fiecărei luni, în antet, și sărbătorile anului în
 * zile de lucru — din `calendarulAnului`, același calcul ca `/ghid/zile-libere`.
 */

export const ZILE_MINIME = 20;
export const ZILE_MAXIME = 60;
const RANDURI_GOALE = 10;
const LUNI_SCURTE = [
  "Ian",
  "Feb",
  "Mar",
  "Apr",
  "Mai",
  "Iun",
  "Iul",
  "Aug",
  "Sep",
  "Oct",
  "Noi",
  "Dec",
] as const;

export type ParametriProgramare = Readonly<{
  an: number;
  firma: string;
  compartiment: string;
  angajati: readonly string[];
  zileCuvenite: number;
}>;

const text = (v: string | null): string =>
  (v ?? "").replace(/[\r\n\t]+/gu, " ").trim().slice(0, 120);

export function citesteProgramare(
  q: URLSearchParams,
  azi: string,
): Readonly<{ parametri: ParametriProgramare; avertismente: readonly string[] }> {
  const avertismente: string[] = [];
  const implicit = anulProgramarii(azi);

  let an = implicit;
  const brutAn = (q.get("an") ?? "").trim();
  if (brutAn !== "") {
    const n = Number(brutAn);
    if (Number.isInteger(n) && n >= AN_MIN_INTERVAL && n <= AN_MAX_INTERVAL) an = n;
    else
      avertismente.push(
        `Anul „${brutAn.slice(0, 10)}” e în afara intervalului ${String(AN_MIN_INTERVAL)}–${String(AN_MAX_INTERVAL)}; am folosit ${String(implicit)}.`,
      );
  }

  let zileCuvenite = ZILE_MINIME;
  const brutZile = (q.get("zile") ?? "").trim();
  if (brutZile !== "") {
    const n = Number(brutZile);
    if (Number.isInteger(n) && n >= ZILE_MINIME && n <= ZILE_MAXIME) zileCuvenite = n;
    else
      avertismente.push(
        `Zile cuvenite: „${brutZile.slice(0, 10)}” nu e un număr între ${String(ZILE_MINIME)} și ${String(ZILE_MAXIME)} (minimul legal e de 20 de zile lucrătoare, art. 145 alin. (1)); am folosit ${String(ZILE_MINIME)}.`,
      );
  }

  const lista = citesteAngajati(q.get("angajati") ?? undefined);
  if (lista.omisi > 0) {
    avertismente.push(
      `Am păstrat primii ${String(lista.total - lista.omisi)} din ${String(lista.total)} de oameni; pentru restul, un al doilea tabel.`,
    );
  }

  return {
    parametri: {
      an,
      firma: text(q.get("firma")),
      compartiment: text(q.get("compartiment")),
      angajati: lista.nume.filter((n) => n !== ""),
      zileCuvenite,
    },
    avertismente,
  };
}

export function construiesteProgramare(p: ParametriProgramare): DocumentTabelar {
  const calendar = calendarulAnului(p.an);
  const oameni = p.angajati.length > 0 ? p.angajati : Array.from({ length: RANDURI_GOALE }, () => "");
  const sarbatoriLucratoare = calendar.zile
    .filter((z) => !z.inWeekend)
    .map((z) => `${z.data.replace(/ \d{4}$/u, "")} (${z.denumiri.join(", ")})`)
    .join("; ");

  return {
    titlu: `Programarea concediilor de odihnă pe anul ${String(p.an)}`,
    subtitlu: p.firma === "" ? null : p.firma,
    campuri: [{ eticheta: "Compartimentul", valoare: p.compartiment }],
    paragrafe: [],
    coloane: [
      { eticheta: "Nr.", latime: 0.6 },
      { eticheta: "Numele și prenumele", latime: 3.4 },
      { eticheta: "Zile\ncuvenite", latime: 1 },
      ...calendar.luni.map((l, i) => ({
        eticheta: `${LUNI_SCURTE[i] ?? ""}\n${String(l.zileLucratoare)} z.l.`,
        latime: 1,
      })),
      { eticheta: "Total\nzile", latime: 0.9 },
      { eticheta: "Semnătura\nsalariatului", latime: 1.8 },
    ],
    randuri: oameni.map((nume, i) => [
      String(i + 1),
      nume,
      nume === "" ? "" : String(p.zileCuvenite),
      ...Array.from({ length: 14 }, () => ""),
    ]),
    umbrite: [],
    note: [
      "În fiecare lună se trec intervalele programate (de exemplu „10–21”), iar la „Total” zilele lucrătoare de concediu. Sub fiecare lună e numărul ei de zile lucrătoare, fără weekend și sărbători legale.",
      `Sărbătorile legale din ${String(p.an)} care cad în zile lucrătoare: ${sarbatoriLucratoare}.`,
      "Programarea se face până la sfârșitul anului pentru anul următor, cu consultarea sindicatului sau a reprezentanților salariaților — art. 148 alin. (1) din Codul muncii.",
      "Dacă un concediu se împarte, fiecare salariat trebuie să aibă în an cel puțin 10 zile lucrătoare de concediu neîntrerupt — art. 148 alin. (5).",
    ],
    semnaturi: ["Întocmit", "Consultat — reprezentanții salariaților", "Aprobat — angajator"],
    orientare: "peisaj",
    numeFisier: `programare-concedii-${String(p.an)}`,
  };
}

export function programareDinParametri(q: URLSearchParams): DocumentTabelar {
  return construiesteProgramare(citesteProgramare(q, todayInBucharest()).parametri);
}
```

`intrebari.ts`:

```ts
// src/app/(marketing)/unelte/programare-concedii/intrebari.ts
import type { IntrebareUnealta } from "@/content/landing/intrebari-pontaj";

/** Citite pe Codul muncii consolidat la 27.04.2026: art. 145, 147, 148, 149. */
export const INTREBARI_PROGRAMARE: readonly IntrebareUnealta[] = [
  {
    q: "Până când se face programarea concediilor?",
    a: "Până la sfârșitul anului, pentru anul următor. Programarea pe 2027 se face, deci, cel târziu în decembrie 2026.",
    temei: "art. 148 alin. (1) Codul muncii",
  },
  {
    q: "Cine stabilește programarea?",
    a: "Angajatorul. Pentru programarea colectivă consultă sindicatul sau, unde nu există, reprezentanții salariaților; pentru cea individuală, salariatul.",
    temei: "art. 148 alin. (1) Codul muncii",
  },
  {
    q: "Cât de lungă poate fi perioada programată?",
    a: "Programarea colectivă stabilește perioade de cel puțin 3 luni, pe categorii de personal sau locuri de muncă; cea individuală, o dată sau o perioadă de cel mult 3 luni. În perioada stabilită, salariatul poate cere concediul cu cel puțin 60 de zile înainte.",
    temei: "art. 148 alin. (2)–(4) Codul muncii",
  },
  {
    q: "Se poate împărți concediul în mai multe bucăți?",
    a: "Da, dar fiecare salariat trebuie să aibă în an cel puțin 10 zile lucrătoare de concediu neîntrerupt.",
    temei: "art. 148 alin. (5) Codul muncii",
  },
  {
    q: "Câte zile de concediu se trec în tabel?",
    a: "Cel puțin 20 de zile lucrătoare pe an, plus cele din contractul individual sau colectiv. Cine lucrează în condiții grele, periculoase sau vătămătoare, nevăzătorii, alte persoane cu handicap și tinerii sub 18 ani au cel puțin 3 zile suplimentare.",
    temei: "art. 145 alin. (1) și art. 147 alin. (1) Codul muncii",
    legatura: { href: "/unelte/calculator-zile-concediu", eticheta: "Calculatorul de zile de concediu" },
  },
  {
    q: "Salariatul e obligat să ia concediul în perioada programată?",
    a: "Da, cu excepțiile prevăzute de lege sau când, din motive obiective, concediul nu poate fi efectuat.",
    temei: "art. 149 Codul muncii",
  },
];
```

`page.tsx`:

```tsx
// src/app/(marketing)/unelte/programare-concedii/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { LEGATURI_CONEXE } from "@/content/landing/legaturi";
import { RO } from "@/content/landing/ro";
import { metaUnealta } from "@/content/landing/seo-unelte";
import { ANTET_PROGRAMARE_CONCEDII } from "@/content/landing/unelte";
import { AN_MAX_INTERVAL, AN_MIN_INTERVAL } from "@/domain/calendar/interval-lucrator";
import { todayInBucharest } from "@/lib/format/date";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";
import { Descarcari } from "../../_componente/descarcari";
import { IntrebariUnealta } from "../../_componente/intrebari-unealta";
import { JsonLd } from "../../_componente/json-ld";
import { metadatePagina } from "../../_componente/metadate";
import { nodUnealta } from "../../_componente/noduri-json-ld";
import { PeAcelasiSubiect } from "../../_componente/pe-acelasi-subiect";
import { PrevizualizareDocument } from "../../_componente/previzualizare-document";
import { INTREBARI_PROGRAMARE } from "./intrebari";
import { citesteProgramare, construiesteProgramare, ZILE_MAXIME, ZILE_MINIME } from "./model";

/**
 * Programarea concediilor de odihnă, gratuită.
 *
 * Completarea automată Google, 8 oct 2026: „programare concedii de odihna 2026
 * excel” și „planificare concedii odihna excel” sunt primele forme ale celor
 * două familii. Anul din titlu e anul care se programează (din octombrie, cel
 * următor), deci metadatele se calculează la cerere.
 */
const CALE = "/unelte/programare-concedii";

export function generateMetadata(): Metadata {
  return metadatePagina(metaUnealta(CALE));
}

type Proprietati = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const unul = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2.5 text-base";

const ANI = Array.from(
  { length: AN_MAX_INTERVAL - AN_MIN_INTERVAL + 1 },
  (_, i) => AN_MIN_INTERVAL + i,
);

export default async function PaginaProgramareConcedii({ searchParams }: Proprietati) {
  const p = await searchParams;
  const q = new URLSearchParams();
  for (const cheie of ["an", "firma", "compartiment", "zile", "angajati"]) {
    const v = unul(p[cheie]);
    if (v !== undefined && v !== "") q.set(cheie, v);
  }
  const { parametri, avertismente } = citesteProgramare(q, todayInBucharest());
  const document = construiesteProgramare(parametri);

  return (
    <Cadru text={RO}>
      <JsonLd
        date={nodUnealta({
          cale: CALE,
          nume: ANTET_PROGRAMARE_CONCEDII.titlu,
          descriere: ANTET_PROGRAMARE_CONCEDII.lead,
        })}
      />
      <div data-tipar="ascunde">
        <AntetSecundar
          text={ANTET_PROGRAMARE_CONCEDII}
          firimituri={[
            { eticheta: "Acasă", href: "/" },
            { eticheta: "Unelte", href: "/unelte" },
            { eticheta: "Programarea concediilor", href: CALE },
          ]}
        />
      </div>

      <div data-tipar="ascunde">
        <Banda inaltime="scurta" supratitlu="Pe scurt" titlu="Ce cere Codul muncii">
          <div className="mt-4 max-w-[68ch] space-y-3 text-[0.9375rem] leading-[1.7]">
            <p>
              Concediile de odihnă se programează până la sfârșitul anului, pentru anul următor:
              colectiv, cu consultarea sindicatului sau a reprezentanților salariaților, ori
              individual, cu consultarea fiecărui om (art. 148 alin. (1)).
            </p>
            <p>
              Codul nu impune un formular. Tabelul de aici are un rând pe om și o coloană pe lună,
              cu zilele lucrătoare ale fiecărei luni în antet, ca să vezi dintr-o privire cât
              consumă un interval.
            </p>
          </div>
        </Banda>
      </div>

      <Banda inaltime="scurta">
        <form
          action="#documentul"
          method="get"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          data-tipar="ascunde"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Anul programat</span>
            <select name="an" defaultValue={String(parametri.an)} className={CLASA_CAMP}>
              {ANI.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Zile cuvenite pe an</span>
            <input
              type="number"
              name="zile"
              min={ZILE_MINIME}
              max={ZILE_MAXIME}
              inputMode="numeric"
              defaultValue={String(parametri.zileCuvenite)}
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Firma (opțional)</span>
            <input type="text" name="firma" maxLength={120} defaultValue={parametri.firma} className={CLASA_CAMP} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Compartimentul (opțional)</span>
            <input
              type="text"
              name="compartiment"
              maxLength={120}
              defaultValue={parametri.compartiment}
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4">
            <span className="text-[0.875rem] font-medium">Angajații, câte unul pe rând</span>
            <textarea
              name="angajati"
              rows={4}
              maxLength={6000}
              defaultValue={parametri.angajati.join("\n")}
              placeholder={"Popa Ion\nIlie Maria\nRadu Andrei"}
              className={CLASA_CAMP}
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              data-umami-event="programare-genereaza"
              className="bg-mk-cerneala text-mk-text-inv inline-flex h-11 w-full items-center justify-center rounded px-5 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
            >
              Completează tabelul
            </button>
          </div>
          <Descarcari
            actiune="/api/unelte/programare-concedii"
            eveniment="programare"
            formate={["xlsx", "pdf", "docx"]}
          />
        </form>
        {avertismente.length > 0 && (
          <ul role="status" className="border-mk-rigla mt-6 max-w-[68ch] space-y-1 border-l-2 pl-4 text-[0.9375rem]" data-tipar="ascunde">
            {avertismente.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        )}
      </Banda>

      <Banda id="documentul" inaltime="scurta">
        <PrevizualizareDocument document={document} />
      </Banda>

      <div data-tipar="ascunde">
        <IntrebariUnealta titlu="Ce se mai întreabă despre programarea concediilor" intrebari={INTREBARI_PROGRAMARE} />

        <Banda inaltime="scurta" supratitlu="Fără hârtie" titlu="Programarea, devenită calendarul echipei">
          <p className="text-mk-text-slab mt-4 max-w-[68ch] text-[0.9375rem] leading-[1.7]">
            În aplicație, concediile apar pe planificator, un rând pe om și o coloană pe zi, iar
            suprapunerile se văd înainte de aprobare.{" "}
            <Link href="/module/concedii" className="underline underline-offset-4">
              Cum arată modulul de concedii
            </Link>
            .
          </p>
          <PeAcelasiSubiect legaturi={LEGATURI_CONEXE["/unelte/programare-concedii"]} />
        </Banda>
      </div>
    </Cadru>
  );
}
```

Afirmația despre planificator vine din `src/domain/leave/planificator.ts:1-12`: „Un rând per angajat, o coloană per zi” și „se suprapune cu a lui Popa”.

`textarea maxLength={6000}`: 60 de nume × ~80 de caractere încap, iar adresa rămâne sub pragul de ~8 KB peste care Cloudflare răspunde 520 (auditul transversal).

**`seo-unelte.ts`.** Importul nou, sub cel existent:

```ts
import { anulProgramarii } from "@/domain/calendar/interval-lucrator";
```

Intrarea nouă în `META_UNELTE`:

```ts
  "/unelte/programare-concedii": {
    titlu: "Programare concedii de odihnă {an-programare}: Excel",
    descriere:
      "Programarea anuală a concediilor de odihnă în Excel, Word sau PDF, cu zilele lucrătoare ale fiecărei luni și sărbătorile anului. Ce cere Codul muncii.",
    termen: "programare concedii de odihna",
  },
```

Iar în `metaUnealta`, linia veche:

```ts
    titlu: meta.titlu.replaceAll("{an}", azi.slice(0, 4)),
```

devine:

```ts
    // `{an-programare}`: anul care se programează — din octombrie, cel următor
    // (art. 148 alin. (1), `anulProgramarii`).
    titlu: meta.titlu
      .replaceAll("{an-programare}", String(anulProgramarii(azi)))
      .replaceAll("{an}", azi.slice(0, 4)),
```

Comentariul `── \`{an}\` ──` din capul fișierului primește rândul: `` `{an-programare}` e anul programării concediilor: din octombrie, anul următor. ``

**`registru.ts`**: importul `import { programareDinParametri } from "@/app/(marketing)/unelte/programare-concedii/model";` și cheia `"programare-concedii": programareDinParametri,`, după `"cerere-demisie"`.

**Înregistrările.**

`unelte.ts`, la final:

```ts

/**
 * Programarea concediilor de odihnă: „programare concedii de odihna 2026
 * excel” și „planificare concedii odihna excel” (8 oct 2026); cerută și de
 * auditul SEO din 7 oct 2026.
 */
export const ANTET_PROGRAMARE_CONCEDII: AntetPagina = {
  supratitlu: "Unealtă gratuită",
  titlu: "Programarea concediilor de odihnă",
  lead: "Tabelul anual cu oamenii firmei și lunile anului, cu zilele lucrătoare din fiecare lună și sărbătorile legale ale anului. Descarci în Excel, Word sau PDF, fără cont.",
};
```

`hub-unelte.ts`: importul primește `ANTET_PROGRAMARE_CONCEDII`, iar grupul `concedii` primește al treilea rând:

```ts
      rand(
        "/unelte/programare-concedii",
        ANTET_PROGRAMARE_CONCEDII,
        "un rând pe om, zilele lucrătoare pe luni · Excel, Word, PDF",
      ),
```

`legaturi.ts`, cheie nouă, înaintea lui `"/unelte/calculator-salariu": [`:

```ts
  "/unelte/programare-concedii": [
    { eticheta: "Concediul de odihnă: zile, programare, report", href: "/ghid/concediu-de-odihna" },
    { eticheta: "Câte zile de concediu ți se cuvin pe an", href: "/unelte/calculator-zile-concediu" },
    { eticheta: "Zilele libere legale și zilele lucrătoare pe luni", href: "/ghid/zile-libere" },
  ],
```

Și în lista `"/unelte/cerere-concediu-de-odihna"`, la final:

```ts
    { eticheta: "Programarea anuală a concediilor, în Excel", href: "/unelte/programare-concedii" },
```

`fise-module.ts`, fișa `leave`, `ghiduri`, după intrarea spre calculatorul de zile de concediu (K3):

```ts
      {
        href: "/unelte/programare-concedii",
        eticheta: "Programarea concediilor de odihnă: model Excel",
      },
```

Plus `actualizat` la data commitului pe fișa `leave`.

`concediu-odihna.ts`, `legaturiConexe`, după intrarea spre cererea de demisie (K8):

```ts
    {
      eticheta: "Unealtă: programarea anuală a concediilor, în Excel",
      href: "/unelte/programare-concedii",
    },
```

`ro.ts`, după cardul calculatorului de zile de concediu (F13):

```ts
      {
        titlu: "Programarea concediilor de odihnă",
        text: "Un rând pe om, o coloană pe lună, cu zilele lucrătoare ale fiecărei luni și sărbătorile anului.",
        formate: "PDF · Word · Excel",
        href: "/unelte/programare-concedii",
      },
```

`en.ts`, în același loc:

```ts
      {
        titlu: "Annual leave schedule",
        text: "One row per employee and one column per month, with each month's working days and the year's public holidays. In Romanian.",
        formate: "PDF · Word · Excel",
        href: "/unelte/programare-concedii",
      },
```

`llms.txt/route.ts`, înaintea elementului `[\n    "/unelte/condica-de-prezenta",`:

```ts
  [
    "/unelte/programare-concedii",
    "Unealtă gratuită: programarea anuală a concediilor de odihnă — un rând pe salariat, o coloană pe lună, cu zilele lucrătoare ale fiecărei luni în antet (2027: 18 în ianuarie, 23 în martie, 252 pe an) și sărbătorile legale care cad în zile lucrătoare. Programarea se face până la sfârșitul anului pentru anul următor, cu consultarea sindicatului sau a reprezentanților salariaților (art. 148 alin. (1) Codul muncii); la fracționare, cel puțin 10 zile lucrătoare neîntrerupte (alin. (5)). Excel, Word sau PDF, fără cont.",
  ],
```

`harta.ts`, după blocul `/unelte/cerere-concediu-de-odihna`:

```ts
  {
    // 8 oct 2026: „programare concedii de odihna 2026 excel” (completarea automată) și auditul din 7 oct.
    cale: "/unelte/programare-concedii",
    prioritate: 0.7,
    limba: "ro",
    traducere: null,
    actualizat: "<data commitului, date +%F>",
    sectiune: "Unelte și comparații",
  },
```

Plus `actualizat` la data commitului pe `/unelte`, `/` și `/en`, cu comentariul `// <data>: programarea concediilor.`

`cuvinte-tinta.tsv`, cu garda de linie nouă finală:

```bash
cd /srv/apps/ERP && [ -z "$(tail -c1 docs/comercial/cuvinte-tinta.tsv)" ] || echo >> docs/comercial/cuvinte-tinta.tsv
cd /srv/apps/ERP && printf '%s\t%s\n' \
  "programare concedii de odihna" /unelte/programare-concedii \
  "programare concedii de odihna excel" /unelte/programare-concedii \
  "planificare concedii odihna excel" /unelte/programare-concedii \
  "planificarea concediului de odihna" /unelte/programare-concedii >> docs/comercial/cuvinte-tinta.tsv
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte/programare-concedii/" "src/app/api/unelte/[unealta]/route.test.ts" src/lib/unelte/ src/content/landing/ "src/app/(marketing)/_componente/descrieri.test.ts"
cd /srv/apps/ERP && pnpm typecheck && pnpm check:server && pnpm lint && pnpm test && pnpm exec prettier --check "src/app/(marketing)/unelte/programare-concedii" src/lib/unelte/registru.ts "src/app/api/unelte/[unealta]/route.test.ts" src/content/landing src/content/legal/concediu-odihna.ts src/app/llms.txt/route.ts
```

- [ ] **Pasul 5: Verificare headless și a celor trei fișiere**, cu `pnpm dev -H 127.0.0.1 -p 3917` pornit:

```bash
cat > /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/k9.mjs <<'JS'
import { chromium } from "/srv/apps/ERP/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core/index.mjs";
const b = await chromium.launch({ executablePath: "/home/miro/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell" });
for (const latime of [360, 1366]) {
  const p = await b.newPage({ viewport: { width: latime, height: 900 } });
  await p.goto("http://127.0.0.1:3917/unelte/programare-concedii?an=2027&angajati=Popa%20Ion%0AIlie%20Maria", { waitUntil: "networkidle" });
  console.log(latime, JSON.stringify(await p.evaluate(() => ({
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    antet: [...document.querySelectorAll("#documentul th")].map((t) => t.textContent?.replace(/\s+/g, " ").trim()).slice(3, 6),
  }))));
  await p.screenshot({ path: `/tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/k9-${latime}.png`, fullPage: true });
}
await b.close();
JS
node /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/k9.mjs
for f in xlsx pdf docx; do curl -s -o /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/k9.$f -w "$f %{http_code}\n" "http://127.0.0.1:3917/api/unelte/programare-concedii?an=2027&angajati=Popa%20Ion%0AIlie%20Maria&format=$f"; done
```

Așteptat: `sw === cw` la 360 px. Tabelul de previzualizare e fie derulabil în containerul lui, fie încape, dar pagina nu se trage lateral. Memoria `erp-sronly-in-overflow` cere ca orice `sr-only` din tabel să aibă un părinte `relative`. `antet` trebuie să fie `["Ian 18 z.l.","Feb 20 z.l.","Mar 23 z.l."]`. Cele trei fișiere trebuie să dea `200`. Excel-ul se deschide cu `python3 -I -c "import zipfile;print(zipfile.ZipFile('…/k9.xlsx').namelist()[:5])"`, iar PDF-ul se citește cu Read: o pagină A4 culcată, 17 coloane lizibile. Dacă `th` nu e eticheta folosită de `PrevizualizareDocument`, selectorul se schimbă pe ce randează componenta (`previzualizare-document.tsx`, citit înainte de rulare).

- [ ] **Commit**

```bash
cd /srv/apps/ERP
D="src/app/(marketing)/unelte/programare-concedii"
CAI=("$D/model.ts" "$D/model.test.ts" "$D/intrebari.ts" "$D/page.tsx" src/content/landing/seo-unelte.ts src/content/landing/seo-unelte.test.ts src/lib/unelte/registru.ts "src/app/api/unelte/[unealta]/route.test.ts" src/content/landing/unelte.ts src/content/landing/hub-unelte.ts src/content/landing/legaturi.ts src/content/landing/fise-module.ts src/content/legal/concediu-odihna.ts src/content/landing/ro.ts src/content/landing/en.ts src/app/llms.txt/route.ts src/content/landing/harta.ts docs/comercial/cuvinte-tinta.tsv)
git status --short -- "${CAI[@]}"
git fetch origin main
git diff --name-only HEAD origin/main -- "${CAI[@]}"
git add -- "$D/model.ts" "$D/model.test.ts" "$D/intrebari.ts" "$D/page.tsx"
git commit --only -m "feat(unelte): programarea concediilor de odihnă, în Excel, Word și PDF" -m "Un rând pe om, o coloană pe lună, cu zilele lucrătoare ale lunii în antet și sărbătorile anului în note (art. 148 alin. (1) și (5)); din octombrie, implicit anul următor, și în titlu." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "${CAI[@]}"
node scripts/checks/lastmod.mjs
git merge origin/main
git push origin main
```

---

### Task K10: Adeverința de salariat (`/unelte/adeverinta-salariat`)

Cererea măsurată azi: „adeverinta de salariat” are scorul 992 (133 de termeni). Formele de top sunt după destinație: „pentru spital” (22), „model” (19), „pentru concediu medical” (18), „medic familie” (18), „pentru inscrierea la gradinita” (18), „model word” (18). Temeiul e art. 34 alin. (3), (5), (5^1) și (5^2), citite azi pe forma consolidată din 27.04.2026. Câmpul „Pentru” acoperă destinațiile fără să pretindă formularul unei instituții.

Rulează după K8 (grupul `plecare` există) și E7.

**Fișiere:**
- Create: `src/app/(marketing)/unelte/adeverinta-salariat/model.ts`, `intrebari.ts`, `page.tsx`
- Test: `src/app/(marketing)/unelte/adeverinta-salariat/model.test.ts`
- Modify: `src/lib/unelte/registru.ts` (plus `FORMATE_RESTRANSE`, ca la K8), `src/lib/unelte/registru.test.ts`, `src/app/api/unelte/[unealta]/route.test.ts`
- Modify: înregistrările: `unelte.ts`, `seo-unelte.ts`, `hub-unelte.ts` (grupul `plecare`), `legaturi.ts`, `fise-module.ts` (fișa `reges`), `src/content/legal/reges.ts` (`legaturiConexe`), `ro.ts`, `en.ts`, `llms.txt/route.ts`, `harta.ts`, `cuvinte-tinta.tsv`

**Interfețe:**
- Consumă: `DocumentTabelar`, `LINIE_GOALA` (`@/lib/unelte/document-tabelar`); `formatDate(value: DateString): string` (`@/lib/format/date:85`, „2026-03-09” → „09.03.2026”), `todayInBucharest`; `IntrebareUnealta`, `IntrebariUnealta` (E7).
- Produce:
  ```ts
  export type Durata = "nedeterminata" | "determinata";
  export type ParametriAdeverinta = Readonly<{
    firma: string; cui: string; nr: string; nume: string; functie: string;
    angajare: string; // ISO sau "" (de completat de mână)
    durata: Durata; ore: number; salariu: number | null; scop: string; emitere: string;
  }>;
  export function citesteSuma(brut: string): number | null;
  export function citesteAdeverinta(q: URLSearchParams, azi: string): Readonly<{ parametri: ParametriAdeverinta; avertismente: readonly string[] }>;
  export function construiesteAdeverinta(p: ParametriAdeverinta): DocumentTabelar;
  export function adeverintaDinParametri(q: URLSearchParams): DocumentTabelar;
  export const INTREBARI_ADEVERINTA: readonly IntrebareUnealta[];
  ```

- [ ] **Pasul 1: Scrie testul care pică**: `src/app/(marketing)/unelte/adeverinta-salariat/model.test.ts`

```ts
// src/app/(marketing)/unelte/adeverinta-salariat/model.test.ts
import { describe, expect, it } from "vitest";

import { constructorPentru } from "@/lib/unelte/registru";

import { INTREBARI_ADEVERINTA } from "./intrebari";
import { citesteAdeverinta, citesteSuma, construiesteAdeverinta } from "./model";

const AZI = "2026-10-08";
const citeste = (s: string) => citesteAdeverinta(new URLSearchParams(s), AZI);
const corp = (s: string) => construiesteAdeverinta(citeste(s).parametri).paragrafe.join("\n");

describe("citesteSuma: cum scrie un român", () => {
  it.each([
    ["4.325", 4325],
    ["4325", 4325],
    ["4 325", 4325],
    ["4.325,50", 4325.5],
    ["4325,5", 4325.5],
    ["4325.50", 4325.5],
    ["5.000 lei", 5000],
  ])("„%s” → %d", (brut, asteptat) => {
    expect(citesteSuma(brut)).toBe(asteptat);
  });

  it.each(["", "abc", "4,325,00", "-100", "0", "1.000.000"])("„%s” → null", (brut) => {
    expect(citesteSuma(brut)).toBeNull();
  });
});

describe("citesteAdeverinta", () => {
  it("fără nimic: normă întreagă, durată nedeterminată, fără salariu, emisă azi", () => {
    expect(citeste("").parametri).toEqual({
      firma: "",
      cui: "",
      nr: "",
      nume: "",
      functie: "",
      angajare: "",
      durata: "nedeterminata",
      ore: 8,
      salariu: null,
      scop: "",
      emitere: AZI,
    });
  });

  it("data angajării poate fi veche, dar nu în viitor și nu inexistentă", () => {
    expect(citeste("angajare=2011-05-02").parametri.angajare).toBe("2011-05-02");
    expect(citeste("angajare=2027-01-01").avertismente).toEqual([
      "Data angajării: „2027-01-01” nu e o zi reală între 1950 și azi; am lăsat-o de completat de mână.",
    ]);
    expect(citeste("angajare=2025-02-30").parametri.angajare).toBe("");
  });

  it("un salariu necitibil e spus, nu pus zero", () => {
    expect(citeste("salariu=abc")).toMatchObject({
      parametri: { salariu: null },
      avertismente: ["Salariul „abc” nu e o sumă; l-am lăsat afară din adeverință."],
    });
  });
});

describe("documentul", () => {
  it("adeverește funcția, contractul, norma și data angajării; CNP-ul rămâne de scris de mână", () => {
    const t = corp(
      "nume=Popescu%20Ana&functie=contabil&firma=Administrativo%20Demo%20SRL&angajare=2025-02-03&ore=6&durata=determinata",
    );
    expect(t).toContain("Popescu Ana, CNP ______________________________");
    expect(t).toContain("este angajat(ă) la Administrativo Demo SRL");
    expect(t).toContain("în funcția de contabil");
    expect(t).toContain("pe durată determinată");
    expect(t).toContain("normă parțială (6 ore pe zi)");
    expect(t).toContain("din data de 03.02.2025");
  });

  it("salariul apare doar dacă e dat, scris românește", () => {
    expect(corp("salariu=4.325")).toContain("Salariul de bază brut lunar este de 4.325 lei.");
    expect(corp("")).not.toContain("Salariul");
  });

  it("scopul și temeiul", () => {
    expect(corp("scop=medicul%20de%20familie")).toContain(
      "se eliberează la cererea salariatului, pentru a-i servi la medicul de familie, potrivit art. 34 alin. (5) din Codul muncii.",
    );
  });

  it("numărul și data emiterii stau sus; semnăturile jos", () => {
    const d = construiesteAdeverinta(citeste("nr=154&firma=Administrativo%20Demo%20SRL&cui=12345").parametri);
    expect(d.titlu).toBe("Adeverință");
    expect(d.subtitlu).toBe("Administrativo Demo SRL, CUI 12345");
    expect(d.campuri).toEqual([
      { eticheta: "Nr.", valoare: "154" },
      { eticheta: "Data", valoare: "08.10.2026" },
    ]);
    expect(d.semnaturi).toEqual(["Reprezentant legal", "Întocmit"]);
  });

  it("e servită de ruta comună", () => {
    expect(constructorPentru("adeverinta-salariat")).toBeTypeOf("function");
  });
});

describe("întrebările paginii", () => {
  it("se termină cu „?”, răspunsurile cu punct, fără ș/ț cu sedilă", () => {
    for (const r of INTREBARI_ADEVERINTA) {
      expect(r.q).toMatch(/\?$/u);
      expect(r.a).toMatch(/\.$/u);
      expect(`${r.q}${r.a}${r.temei ?? ""}`).not.toMatch(/[\u015E\u015F\u0162\u0163]/u);
    }
  });
});
```

Și la finalul lui `route.test.ts`:

```ts
describe("adeverința de salariat prin ruta comună", () => {
  it("dă un Word valid", async () => {
    const r = await cere(
      "/api/unelte/adeverinta-salariat?nume=Popescu%20Ana&salariu=4.325&format=docx",
      "adeverinta-salariat",
    );
    expect(r.status).toBe(200);
    expect(new Uint8Array(await r.arrayBuffer()).slice(0, 2)).toEqual(new Uint8Array([0x50, 0x4b]));
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte/adeverinta-salariat/" "src/app/api/unelte/[unealta]/route.test.ts"
```

Așteptat: `Failed to resolve import "./intrebari"`; în rută, `expected 404 to be 200`.

- [ ] **Pasul 3: Implementarea minimă**

`model.ts`:

```ts
// src/app/(marketing)/unelte/adeverinta-salariat/model.ts
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { LINIE_GOALA, type DocumentTabelar } from "@/lib/unelte/document-tabelar";

/**
 * Adeverința de salariat.
 *
 * Art. 34 alin. (5) din Codul muncii (consolidat la 27.04.2026): la cererea
 * salariatului sau a unui fost salariat, angajatorul e obligat să elibereze
 * un document care atestă activitatea, durata ei, salariul și vechimea. Codul
 * nu dă un model; ăsta e forma uzuală.
 *
 * ── CNP-UL NU SE CERE ─────────────────────────────────────────────────────
 * Tot ce scrie omul în formular stă în adresa paginii (GET). Numele și salariul
 * sunt tăiate din ce pleacă la statistici (lista albă din A2), dar un CNP n-are
 * ce căuta nici în istoricul browserului. Rămâne o linie de completat de mână.
 */

export type Durata = "nedeterminata" | "determinata";

export type ParametriAdeverinta = Readonly<{
  firma: string;
  cui: string;
  nr: string;
  nume: string;
  functie: string;
  /** ISO, sau "" când rămâne de completat de mână. */
  angajare: string;
  durata: Durata;
  ore: number;
  salariu: number | null;
  scop: string;
  emitere: string;
}>;

const text = (v: string | null, maxim = 120): string =>
  (v ?? "").replace(/[\r\n\t]+/gu, " ").trim().slice(0, maxim);

/**
 * Suma, cum o scrie un român: „4.325”, „4 325”, „4.325,50”, „5.000 lei”.
 * Punctul urmat de exact trei cifre e separator de mii, nu virgulă zecimală.
 */
export function citesteSuma(brut: string): number | null {
  const s = brut.replace(/\s+/gu, "").replace(/lei$/iu, "");
  let normal: string;
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/u.test(s)) normal = s.replace(/\./gu, "").replace(",", ".");
  else if (/^\d+(?:,\d{1,2})?$/u.test(s)) normal = s.replace(",", ".");
  else if (/^\d+(?:\.\d{1,2})?$/u.test(s)) normal = s;
  else return null;
  const n = Number(normal);
  return Number.isFinite(n) && n > 0 && n < 1_000_000 ? n : null;
}

/** O zi reală între 1950 și azi, sau `null`. */
function dataTrecuta(brut: string, azi: string): string | null {
  const potrivire = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(brut);
  if (potrivire === null) return null;
  const [, a, l, z] = potrivire;
  const data = new Date(Date.UTC(Number(a), Number(l) - 1, Number(z)));
  if (
    data.getUTCFullYear() !== Number(a) ||
    data.getUTCMonth() !== Number(l) - 1 ||
    data.getUTCDate() !== Number(z)
  ) {
    return null;
  }
  return brut >= "1950-01-01" && brut <= azi ? brut : null;
}

const lei = (n: number): string =>
  `${new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 }).format(n)} lei`;

export function citesteAdeverinta(
  q: URLSearchParams,
  azi: string,
): Readonly<{ parametri: ParametriAdeverinta; avertismente: readonly string[] }> {
  const avertismente: string[] = [];

  let angajare = "";
  const brutAngajare = (q.get("angajare") ?? "").trim();
  if (brutAngajare !== "") {
    const valida = dataTrecuta(brutAngajare, azi);
    if (valida === null) {
      avertismente.push(
        `Data angajării: „${brutAngajare.slice(0, 20)}” nu e o zi reală între 1950 și azi; am lăsat-o de completat de mână.`,
      );
    } else {
      angajare = valida;
    }
  }

  let salariu: number | null = null;
  const brutSalariu = (q.get("salariu") ?? "").trim();
  if (brutSalariu !== "") {
    salariu = citesteSuma(brutSalariu);
    if (salariu === null) {
      avertismente.push(
        `Salariul „${brutSalariu.slice(0, 20)}” nu e o sumă; l-am lăsat afară din adeverință.`,
      );
    }
  }

  const oreBrut = Number(q.get("ore") ?? "8");
  const ore = Number.isInteger(oreBrut) && oreBrut >= 1 && oreBrut <= 8 ? oreBrut : 8;

  return {
    parametri: {
      firma: text(q.get("firma")),
      cui: text(q.get("cui"), 20),
      nr: text(q.get("nr"), 30),
      nume: text(q.get("nume")),
      functie: text(q.get("functie")),
      angajare,
      durata: q.get("durata") === "determinata" ? "determinata" : "nedeterminata",
      ore,
      salariu,
      scop: text(q.get("scop")),
      emitere: azi,
    },
    avertismente,
  };
}

const sauLinie = (v: string): string => (v === "" ? LINIE_GOALA : v);

export function construiesteAdeverinta(p: ParametriAdeverinta): DocumentTabelar {
  const norma =
    p.ore === 8
      ? "normă întreagă (8 ore pe zi)"
      : `normă parțială (${String(p.ore)} ${p.ore === 1 ? "oră" : "ore"} pe zi)`;
  const durata = p.durata === "determinata" ? "determinată" : "nedeterminată";
  const angajator = p.cui === "" ? sauLinie(p.firma) : `${sauLinie(p.firma)}, CUI ${p.cui}`;

  return {
    titlu: "Adeverință",
    subtitlu: p.firma === "" ? null : p.cui === "" ? p.firma : `${p.firma}, CUI ${p.cui}`,
    campuri: [
      { eticheta: "Nr.", valoare: p.nr },
      { eticheta: "Data", valoare: formatDate(p.emitere) },
    ],
    paragrafe: [
      `Prin prezenta se adeverește că ${sauLinie(p.nume)}, CNP ${LINIE_GOALA}, este angajat(ă) la ${angajator}, în funcția de ${sauLinie(p.functie)}, cu contract individual de muncă pe durată ${durata}, cu ${norma}, din data de ${p.angajare === "" ? LINIE_GOALA : formatDate(p.angajare)}.`,
      ...(p.salariu === null ? [] : [`Salariul de bază brut lunar este de ${lei(p.salariu)}.`]),
      `Prezenta adeverință se eliberează la cererea salariatului${p.scop === "" ? "" : `, pentru a-i servi la ${p.scop}`}, potrivit art. 34 alin. (5) din Codul muncii.`,
    ],
    coloane: [],
    randuri: [],
    umbrite: [],
    note: [],
    semnaturi: ["Reprezentant legal", "Întocmit"],
    orientare: "portret",
    numeFisier: `adeverinta-salariat-${p.nume === "" ? "necompletata" : p.nume}`,
  };
}

export function adeverintaDinParametri(q: URLSearchParams): DocumentTabelar {
  return construiesteAdeverinta(citesteAdeverinta(q, todayInBucharest()).parametri);
}
```

Testul „1.000.000 → null” trece fiindcă suma depășește plafonul de 1.000.000 (exclusiv). „4,325,00” nu se potrivește cu niciun tipar, deci dă `null`.

`intrebari.ts`:

```ts
// src/app/(marketing)/unelte/adeverinta-salariat/intrebari.ts
import type { IntrebareUnealta } from "@/content/landing/intrebari-pontaj";

/** Citite pe Codul muncii consolidat la 27.04.2026: art. 34 alin. (3), (5), (5^1), (5^2). */
export const INTREBARI_ADEVERINTA: readonly IntrebareUnealta[] = [
  {
    q: "Angajatorul e obligat să dea adeverință de salariat?",
    a: "Da. La cererea salariatului sau a unui fost salariat, angajatorul e obligat să elibereze un document care atestă activitatea, durata ei, salariul și vechimea în muncă, în meserie și în specialitate.",
    temei: "art. 34 alin. (5) Codul muncii",
  },
  {
    q: "De ce formularul nu cere CNP-ul?",
    a: "Fiindcă tot ce scrii aici stă în adresa paginii, iar un CNP n-are ce căuta în istoricul browserului. Îl scrii de mână pe foaia tipărită sau în Word, după descărcare.",
  },
  {
    q: "Ce date trebuie să fie în adeverință?",
    a: "Cele din registrul general de evidență a salariaților: funcția, data angajării, tipul contractului, salariul. Salariatul își poate descărca singur un extras din registru, iar vechimea se poate dovedi și cu extrasul.",
    temei: "art. 34 alin. (3), (5^1) și (5^2) Codul muncii",
  },
  {
    q: "E bună pentru medicul de familie, spital, bancă sau grădiniță?",
    a: "Dacă instituția nu cere un formular anume, da: scrii destinația la „Pentru” și o semnezi. Când banca sau casa de asigurări au formularul lor, se completează acela.",
  },
  {
    q: "Cine o semnează?",
    a: "Reprezentantul legal al firmei sau cine e împuternicit de el. Modelul are două rânduri de semnătură: pentru reprezentant și pentru cine a întocmit-o.",
  },
];
```

`page.tsx`:

```tsx
// src/app/(marketing)/unelte/adeverinta-salariat/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { LEGATURI_CONEXE } from "@/content/landing/legaturi";
import { RO } from "@/content/landing/ro";
import { metaUnealta } from "@/content/landing/seo-unelte";
import { ANTET_ADEVERINTA_SALARIAT } from "@/content/landing/unelte";
import { todayInBucharest } from "@/lib/format/date";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";
import { Descarcari } from "../../_componente/descarcari";
import { IntrebariUnealta } from "../../_componente/intrebari-unealta";
import { JsonLd } from "../../_componente/json-ld";
import { metadatePagina } from "../../_componente/metadate";
import { nodUnealta } from "../../_componente/noduri-json-ld";
import { PeAcelasiSubiect } from "../../_componente/pe-acelasi-subiect";
import { PrevizualizareDocument } from "../../_componente/previzualizare-document";
import { INTREBARI_ADEVERINTA } from "./intrebari";
import { citesteAdeverinta, construiesteAdeverinta } from "./model";

/**
 * Adeverința de salariat, gratuită.
 *
 * Completarea automată Google, 8 oct 2026: „adeverinta de salariat” e căutată
 * după destinație („pentru spital”, „medic familie”, „gradinita”), deci câmpul
 * „Pentru” ține locul a zece modele. Fără CNP: vezi `model.ts`.
 */
const CALE = "/unelte/adeverinta-salariat";

export const metadata: Metadata = metadatePagina(metaUnealta(CALE));

type Proprietati = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const unul = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2.5 text-base";

const TEXTE = [
  { nume: "firma", eticheta: "Firma", exemplu: "Administrativo Demo SRL", max: 120 },
  { nume: "cui", eticheta: "CUI (opțional)", exemplu: "", max: 20 },
  { nume: "nr", eticheta: "Nr. de înregistrare (opțional)", exemplu: "154", max: 30 },
  { nume: "nume", eticheta: "Salariatul", exemplu: "Popescu Ana", max: 120 },
  { nume: "functie", eticheta: "Funcția", exemplu: "contabil", max: 120 },
  { nume: "salariu", eticheta: "Salariul brut (opțional)", exemplu: "4.325", max: 20 },
  { nume: "scop", eticheta: "Pentru (opțional)", exemplu: "medicul de familie", max: 120 },
] as const;

const CHEI = [...TEXTE.map((t) => t.nume), "angajare", "durata", "ore"] as const;

export default async function PaginaAdeverintaSalariat({ searchParams }: Proprietati) {
  const p = await searchParams;
  const q = new URLSearchParams();
  for (const cheie of CHEI) {
    const v = unul(p[cheie]);
    if (v !== undefined && v !== "") q.set(cheie, v);
  }
  const { parametri, avertismente } = citesteAdeverinta(q, todayInBucharest());
  const document = construiesteAdeverinta(parametri);

  return (
    <Cadru text={RO}>
      <JsonLd
        date={nodUnealta({
          cale: CALE,
          nume: ANTET_ADEVERINTA_SALARIAT.titlu,
          descriere: ANTET_ADEVERINTA_SALARIAT.lead,
        })}
      />
      <div data-tipar="ascunde">
        <AntetSecundar
          text={ANTET_ADEVERINTA_SALARIAT}
          firimituri={[
            { eticheta: "Acasă", href: "/" },
            { eticheta: "Unelte", href: "/unelte" },
            { eticheta: "Adeverință de salariat", href: CALE },
          ]}
        />
      </div>

      <Banda inaltime="scurta">
        <form
          action="#documentul"
          method="get"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          data-tipar="ascunde"
        >
          {TEXTE.map((c) => (
            <label key={c.nume} className="flex flex-col gap-1.5">
              <span className="text-[0.875rem] font-medium">{c.eticheta}</span>
              <input
                type="text"
                name={c.nume}
                maxLength={c.max}
                defaultValue={unul(p[c.nume]) ?? ""}
                placeholder={c.exemplu}
                inputMode={c.nume === "salariu" ? "decimal" : undefined}
                className={CLASA_CAMP}
              />
            </label>
          ))}
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Data angajării</span>
            <input type="date" name="angajare" defaultValue={parametri.angajare} className={CLASA_CAMP} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Contractul</span>
            <select name="durata" defaultValue={parametri.durata} className={CLASA_CAMP}>
              <option value="nedeterminata">pe durată nedeterminată</option>
              <option value="determinata">pe durată determinată</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Norma</span>
            <select name="ore" defaultValue={String(parametri.ore)} className={CLASA_CAMP}>
              <option value="8">întreagă, 8 ore pe zi</option>
              {[7, 6, 5, 4, 3, 2, 1].map((o) => (
                <option key={o} value={o}>
                  parțială, {o} {o === 1 ? "oră" : "ore"} pe zi
                </option>
              ))}
            </select>
          </label>
          <p className="text-mk-text-slab text-[0.8125rem] leading-[1.5] sm:col-span-2 lg:col-span-3">
            CNP-ul nu se cere aici: tot ce scrii stă în adresa paginii. Îl completezi de mână pe
            foaia tipărită sau în Word.
          </p>
          <div className="flex items-end">
            <button
              type="submit"
              data-umami-event="adeverinta-genereaza"
              className="bg-mk-cerneala text-mk-text-inv inline-flex h-11 w-full items-center justify-center rounded px-5 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
            >
              Completează adeverința
            </button>
          </div>
          <Descarcari actiune="/api/unelte/adeverinta-salariat" eveniment="adeverinta" formate={["docx", "pdf"]} />
        </form>
        {avertismente.length > 0 && (
          <ul role="status" className="border-mk-rigla mt-6 max-w-[68ch] space-y-1 border-l-2 pl-4 text-[0.9375rem]" data-tipar="ascunde">
            {avertismente.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        )}
      </Banda>

      <Banda id="documentul" inaltime="scurta">
        <PrevizualizareDocument document={document} />
      </Banda>

      <div data-tipar="ascunde">
        <IntrebariUnealta titlu="Ce se mai întreabă despre adeverința de salariat" intrebari={INTREBARI_ADEVERINTA} />

        <Banda inaltime="scurta" supratitlu="Fără hârtie" titlu="Datele salariatului, într-un singur loc">
          <p className="text-mk-text-slab mt-4 max-w-[68ch] text-[0.9375rem] leading-[1.7]">
            În aplicație, funcția, contractul și data angajării stau pe fișa fiecărui om și pleacă
            de acolo în REGES-ONLINE: o adeverință se completează din ce e deja scris, nu din
            memorie.{" "}
            <Link href="/module/nucleu" className="underline underline-offset-4">
              Cum arată evidența angajaților
            </Link>
            .
          </p>
          <PeAcelasiSubiect legaturi={LEGATURI_CONEXE["/unelte/adeverinta-salariat"]} />
        </Banda>
      </div>
    </Cadru>
  );
}
```

Afirmația „pleacă de acolo în REGES-ONLINE” e cea din `fise-module.ts:861` („mesajele cu datele salariatului se compun din fișa angajatului”). Fraza NU promite un generator de adeverințe în aplicație: nu există (`grep -rn adeverin "src/app/(app)"` nu întoarce nimic).

`inputMode={… : undefined}`: sub `exactOptionalPropertyTypes`, `undefined` explicit pe un atribut JSX opțional e acceptat de tipurile React (`inputMode?: … | undefined`). Dacă typecheck-ul îl refuză, se scrie ca spread condiționat: `{...(c.nume === "salariu" ? { inputMode: "decimal" as const } : {})}`.

**`registru.ts`**: importul `import { adeverintaDinParametri } from "@/app/(marketing)/unelte/adeverinta-salariat/model";` și cheia `"adeverinta-salariat": adeverintaDinParametri,`, după `"programare-concedii"`. Dacă H5 e pe `main`, adeverința primește formatele restrânse, la fel ca cererea de demisie (K8): în `FORMATE_RESTRANSE` se adaugă `"adeverinta-salariat": ["pdf", "docx"],`. În `registru.test.ts`, lista `restranse` scrisă la K8 devine `["fisa-instruire-ssm", "cerere-demisie", "adeverinta-salariat"]`, cu `expect(formatePentru("adeverinta-salariat")).toEqual(["pdf", "docx"]);` lângă cea a demisiei. În blocul `describe("adeverința de salariat prin ruta comună")` se adaugă testul pentru Excel, cu `/api/unelte/adeverinta-salariat?format=xlsx`, după modelul celui din K8: 400 și „Unealta asta se descarcă doar în PDF sau Word.”.

**Înregistrările.**

`unelte.ts`, la final:

```ts

/**
 * Adeverința de salariat: „adeverinta de salariat model” și formele pe
 * destinație („pentru spital”, „medic familie”), 8 oct 2026. Art. 34 alin. (5).
 */
export const ANTET_ADEVERINTA_SALARIAT: AntetPagina = {
  supratitlu: "Unealtă gratuită",
  titlu: "Adeverință de salariat",
  lead: "Adeverința că omul lucrează la firmă: funcția, contractul, data angajării, norma și, dacă vrei, salariul, cu destinația pentru care se eliberează. Word sau PDF, fără cont și fără CNP în formular.",
};
```

`seo-unelte.ts`, în `META_UNELTE`:

```ts
  "/unelte/adeverinta-salariat": {
    titlu: "Adeverință de salariat: model Word și PDF",
    descriere:
      "Adeverință de salariat completată online: funcția, data angajării, norma și, la nevoie, salariul. Model gratuit Word sau PDF, după art. 34 Codul muncii.",
    termen: "adeverinta de salariat model",
  },
```

`hub-unelte.ts`: importul primește `ANTET_ADEVERINTA_SALARIAT`, iar grupul `plecare` primește al doilea rând:

```ts
      rand(
        "/unelte/adeverinta-salariat",
        ANTET_ADEVERINTA_SALARIAT,
        "funcție, contract, normă, salariu opțional · fără CNP · Word, PDF",
      ),
```

`legaturi.ts`, cheie nouă, înaintea lui `"/unelte/calculator-salariu": [`:

```ts
  "/unelte/adeverinta-salariat": [
    { eticheta: "REGES-ONLINE: termene și amenzi", href: "/reges-online" },
    { eticheta: "Evidența angajaților: fișe, roluri și audit", href: "/module/nucleu" },
    { eticheta: "Cerere de demisie cu preaviz calculat", href: "/unelte/cerere-demisie" },
  ],
```

Iar în lista `"/unelte/cerere-demisie"`, la final:

```ts
    { eticheta: "Adeverință de salariat: model", href: "/unelte/adeverinta-salariat" },
```

`fise-module.ts`, fișa `reges`, `ghiduri`, după intrarea spre cererea de demisie (K8):

```ts
      { href: "/unelte/adeverinta-salariat", eticheta: "Adeverință de salariat: model gratuit" },
```

Plus `actualizat` la data commitului pe fișa `reges`.

`src/content/legal/reges.ts`. Vechi:

```ts
  legaturiConexe: [
    { eticheta: "Cum se transmite din Administrativo", href: "/module/reges" },
    { eticheta: "Evidența orelor de muncă (art. 119)", href: "/evidenta-orelor-de-munca" },
  ],
```

Nou:

```ts
  legaturiConexe: [
    { eticheta: "Cum se transmite din Administrativo", href: "/module/reges" },
    { eticheta: "Evidența orelor de muncă (art. 119)", href: "/evidenta-orelor-de-munca" },
    { eticheta: "Adeverință de salariat (art. 34 alin. (5)): model", href: "/unelte/adeverinta-salariat" },
  ],
```

`actualizatIso` nu se schimbă (Decizia 13).

`ro.ts`, după cardul cererii de demisie (K8):

```ts
      {
        titlu: "Adeverință de salariat",
        text: "Funcția, contractul, data angajării și norma, cu destinația pentru care se eliberează.",
        formate: "PDF · Word",
        href: "/unelte/adeverinta-salariat",
      },
```

`en.ts`, în același loc:

```ts
      {
        titlu: "Employment certificate",
        text: "Proof of employment: job title, contract type, start date and working hours, with what it is issued for. In Romanian.",
        formate: "PDF · Word",
        href: "/unelte/adeverinta-salariat",
      },
```

`llms.txt/route.ts`, înaintea elementului `[\n    "/unelte/condica-de-prezenta",`:

```ts
  [
    "/unelte/adeverinta-salariat",
    "Unealtă gratuită: adeverință de salariat — funcția, tipul și durata contractului, norma, data angajării, opțional salariul de bază și destinația („pentru a-i servi la…”), după art. 34 alin. (5) Codul muncii (angajatorul e obligat s-o elibereze la cerere). Formularul nu cere CNP-ul, care rămâne de completat de mână. Word sau PDF, fără cont.",
  ],
```

`harta.ts`, după blocul `/unelte/cerere-demisie`:

```ts
  {
    // 8 oct 2026: „adeverinta de salariat” și formele pe destinație (completarea automată).
    cale: "/unelte/adeverinta-salariat",
    prioritate: 0.7,
    limba: "ro",
    traducere: null,
    actualizat: "<data commitului, date +%F>",
    sectiune: "Unelte și comparații",
  },
```

Plus `actualizat` la data commitului pe `/unelte`, `/` și `/en`, cu comentariul `// <data>: adeverința de salariat.`

`cuvinte-tinta.tsv`, cu garda de linie nouă finală:

```bash
cd /srv/apps/ERP && [ -z "$(tail -c1 docs/comercial/cuvinte-tinta.tsv)" ] || echo >> docs/comercial/cuvinte-tinta.tsv
cd /srv/apps/ERP && printf '%s\t%s\n' \
  "adeverinta de salariat model" /unelte/adeverinta-salariat \
  "adeverinta de salariat" /unelte/adeverinta-salariat \
  "adeverinta de salariat model word" /unelte/adeverinta-salariat \
  "adeverinta de salariat pentru medicul de familie" /unelte/adeverinta-salariat >> docs/comercial/cuvinte-tinta.tsv
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte/adeverinta-salariat/" "src/app/api/unelte/[unealta]/route.test.ts" src/lib/unelte/ src/content/landing/ "src/app/(marketing)/_componente/descrieri.test.ts"
cd /srv/apps/ERP && pnpm typecheck && pnpm check:server && pnpm lint && pnpm test && pnpm exec prettier --check "src/app/(marketing)/unelte/adeverinta-salariat" src/lib/unelte/registru.ts src/lib/unelte/registru.test.ts "src/app/api/unelte/[unealta]/route.test.ts" src/content/landing src/content/legal/reges.ts src/app/llms.txt/route.ts
```

- [ ] **Pasul 5: Verificare headless la 360 px și a Word-ului**, cu `pnpm dev -H 127.0.0.1 -p 3917` pornit:

```bash
cat > /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/k10.mjs <<'JS'
import { chromium } from "/srv/apps/ERP/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core/index.mjs";
const b = await chromium.launch({ executablePath: "/home/miro/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell" });
const p = await b.newPage({ viewport: { width: 360, height: 800 } });
await p.goto("http://127.0.0.1:3917/unelte/adeverinta-salariat?nume=Popescu%20Ana&functie=contabil&firma=Administrativo%20Demo%20SRL&angajare=2025-02-03&salariu=4.325&scop=medicul%20de%20familie", { waitUntil: "networkidle" });
console.log(JSON.stringify(await p.evaluate(() => ({
  sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  corp: document.querySelector("#documentul")?.textContent?.includes("4.325 lei") ?? false,
  cnpInFormular: document.querySelector('input[name="cnp"]') !== null,
}))));
await p.screenshot({ path: "/tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/k10-360.png", fullPage: true });
await b.close();
JS
node /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/k10.mjs
curl -s -o /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/k10.docx "http://127.0.0.1:3917/api/unelte/adeverinta-salariat?nume=Popescu%20Ana&salariu=4.325&format=docx"
python3 -I -c "import zipfile,sys,xml.dom.minidom as m; x=zipfile.ZipFile(sys.argv[1]).read('word/document.xml'); m.parseString(x); print('xml ok', '4.325 lei' in x.decode())" /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/k10.docx
```

Așteptat: `{"sw":360,"cw":360,"corp":true,"cnpInFormular":false}` și `xml ok True`.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
D="src/app/(marketing)/unelte/adeverinta-salariat"
CAI=("$D/model.ts" "$D/model.test.ts" "$D/intrebari.ts" "$D/page.tsx" src/lib/unelte/registru.ts src/lib/unelte/registru.test.ts "src/app/api/unelte/[unealta]/route.test.ts" src/content/landing/unelte.ts src/content/landing/seo-unelte.ts src/content/landing/hub-unelte.ts src/content/landing/legaturi.ts src/content/landing/fise-module.ts src/content/legal/reges.ts src/content/landing/ro.ts src/content/landing/en.ts src/app/llms.txt/route.ts src/content/landing/harta.ts docs/comercial/cuvinte-tinta.tsv)
git status --short -- "${CAI[@]}"
git fetch origin main
git diff --name-only HEAD origin/main -- "${CAI[@]}"
git add -- "$D/model.ts" "$D/model.test.ts" "$D/intrebari.ts" "$D/page.tsx"
git commit --only -m "feat(unelte): adeverința de salariat, fără CNP în formular" -m "Art. 34 alin. (5): funcția, contractul, norma, data angajării, salariul opțional (citit cum îl scrie un român: „4.325”) și destinația. Word și PDF prin ruta comună." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "${CAI[@]}"
node scripts/checks/lastmod.mjs
git merge origin/main
git push origin main
```

---
### Task K11: „Model completat”: exemple verificate, capturi și imaginea în datele structurate

Cererea: „foaie de parcurs model completat” (17), „fisa ssm completata” (19), „decizie de concediere model completat” (19), „contract de munca model completat” (14). Auditul SEO din 7 oct are `imagini-zero` pe toate cele 7 unelte („rămas · conținut”). Captura unui exemplu adus în unealtă e informație, nu decor: ea e chiar documentul pe care îl dă pagina. Primesc exemplu cele 3 documente noi plus fișa SSM și fișa de evaluare (Decizia 12).

Rulează după K8–K10 și după secțiunile care dețin fișa SSM și fișa de evaluare. Testul de aici construiește exemplele prin registru, deci prinde orice parametru redenumit acolo.

**Fișiere:**
- Create: `src/content/landing/exemple-unelte.ts`, `src/content/landing/exemple-unelte.test.ts`
- Create: `src/app/(marketing)/_componente/exemplu-completat.tsx`, `src/app/(marketing)/_componente/exemplu-completat.test.tsx`
- Create: `scripts/capturi/capturi-unelte.mjs`
- Create: `public/capturi/unelte/{cerere-demisie,programare-concedii,adeverinta-salariat,fisa-instruire-ssm,fisa-evaluare}-exemplu-{600,1200}.webp` (generate de script)
- Modify: `src/app/(marketing)/_componente/noduri-json-ld.ts` (`nodUnealta`, azi `:198-216`) și `noduri-json-ld.test.ts`
- Modify: cele 5 `page.tsx` (`JsonLd` + banda nouă înaintea benzii „Fără hârtie”)
- Modify: `src/content/landing/harta.ts`: `actualizat` pe cele 5 pagini

**Interfețe:**
- Consumă: `constructorPentru(slug)` (`@/lib/unelte/registru`); `ADRESA_SITE` (`@/content/landing/contact`); `Banda`.
- Produce:
  ```ts
  // exemple-unelte.ts
  export const LATURA_CAPTURA = 1200;
  export type ExempluUnealta = Readonly<{
    pagina: string; api: string; parametri: Readonly<Record<string, string>>;
    verificate: readonly string[]; alt: string; captura: string;
  }>;
  export const EXEMPLE_UNELTE: readonly ExempluUnealta[];
  export function exempluPentru(pagina: string): ExempluUnealta | undefined;
  export function adresaExemplu(e: ExempluUnealta): string;
  export function descarcareExemplu(e: ExempluUnealta, format: "pdf" | "docx" | "xlsx"): string;
  export function srcCaptura(e: ExempluUnealta, latura: 600 | 1200): string;
  export function imagineExemplu(e: ExempluUnealta): Readonly<{ url: string; latime: number; inaltime: number; descriere: string }>;
  // exemplu-completat.tsx
  export function ExempluCompletat(p: Readonly<{ exemplu: ExempluUnealta | undefined }>): JSX.Element | null;
  // noduri-json-ld.ts
  export function nodUnealta(u: Readonly<{ cale: string; nume: string; descriere: string; imagine?: Readonly<{ url: string; latime: number; inaltime: number; descriere: string }> }>): object;
  ```

- [ ] **Pasul 1: Scrie testele care pică**

`src/content/landing/exemple-unelte.test.ts`:

```ts
// src/content/landing/exemple-unelte.test.ts
import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { fisaEvaluareDinParametri } from "@/app/(marketing)/unelte/fisa-evaluare/model";
import { constructorPentru, type Constructor } from "@/lib/unelte/registru";

import { EXEMPLE_UNELTE, adresaExemplu, exempluPentru, srcCaptura } from "./exemple-unelte";

/**
 * Uneltele cu rută statică proprie nu mai sunt în `UNELTE`: I7 mută fișa de
 * evaluare pe `/api/unelte/fisa-evaluare`. Constructorul ei rămâne exportat din
 * `model.ts` (I6), deci exemplul se verifică tot pe documentul real.
 */
const RUTE_STATICE: Readonly<Record<string, Constructor>> = {
  "fisa-evaluare": fisaEvaluareDinParametri,
};
const constructorExemplu = (api: string): Constructor | undefined =>
  constructorPentru(api) ?? (Object.hasOwn(RUTE_STATICE, api) ? RUTE_STATICE[api] : undefined);

describe("exemplele completate", () => {
  it("fiecare exemplu e construit de unealta lui și conține datele pe care le arată", () => {
    expect(EXEMPLE_UNELTE.length).toBeGreaterThanOrEqual(5);
    for (const e of EXEMPLE_UNELTE) {
      const construieste = constructorExemplu(e.api);
      expect(construieste, e.api).toBeTypeOf("function");
      if (construieste === undefined) continue;
      const document = JSON.stringify(construieste(new URLSearchParams(e.parametri)));
      for (const v of e.verificate) expect(document, `${e.api}: „${v}”`).toContain(v);
    }
  });

  it("textul alternativ spune „model completat”, forma căutată", () => {
    for (const e of EXEMPLE_UNELTE) expect(e.alt, e.api).toMatch(/model completat/u);
  });

  it("capturile există pe disc, la ambele mărimi", () => {
    for (const e of EXEMPLE_UNELTE) {
      for (const latura of [600, 1200] as const) {
        expect(existsSync(`public${srcCaptura(e, latura)}`), srcCaptura(e, latura)).toBe(true);
      }
    }
  });

  it("pagina fiecărei unelte cu exemplu îl randează și îl pune în datele structurate", () => {
    for (const e of EXEMPLE_UNELTE) {
      const sursa = readFileSync(`src/app/(marketing)${e.pagina}/page.tsx`, "utf8");
      expect(sursa, e.pagina).toContain("<ExempluCompletat");
      expect(sursa, e.pagina).toContain("imagineExemplu(");
    }
  });

  it("adresa exemplului deschide documentul, cu parametrii codați", () => {
    const e = exempluPentru("/unelte/programare-concedii");
    expect(e).toBeDefined();
    if (e === undefined) return;
    expect(adresaExemplu(e)).toMatch(/^\/unelte\/programare-concedii\?an=2027&.*angajati=Popescu\+Ana%0AIonescu\+Mihai/u);
    expect(adresaExemplu(e).endsWith("#documentul")).toBe(true);
  });

  it("datele exemplelor sunt fictive și ale noastre: firma demo, fără CUI", () => {
    for (const e of EXEMPLE_UNELTE) {
      const firma = e.parametri["firma"] ?? e.parametri["angajator"];
      if (firma !== undefined) expect(firma, e.api).toBe("Administrativo Demo SRL");
      expect(e.parametri["cui"], e.api).toBeUndefined();
    }
  });
});
```

`src/app/(marketing)/_componente/exemplu-completat.test.tsx`:

```tsx
// src/app/(marketing)/_componente/exemplu-completat.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { exempluPentru } from "@/content/landing/exemple-unelte";

import { ExempluCompletat } from "./exemplu-completat";

describe("ExempluCompletat", () => {
  it("arată captura cu dimensiuni, alt și cele două legături", () => {
    render(<ExempluCompletat exemplu={exempluPentru("/unelte/cerere-demisie")} />);
    const img = screen.getByRole("img");
    expect(img.getAttribute("alt")).toMatch(/model completat/u);
    expect(img.getAttribute("width")).toBe("1200");
    expect(img.getAttribute("height")).toBe("1200");
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(screen.getByRole("link", { name: /Deschide exemplul/u }).getAttribute("href")).toMatch(
      /^\/unelte\/cerere-demisie\?.*#documentul$/u,
    );
    expect(screen.getByRole("link", { name: /PDF/u }).getAttribute("href")).toMatch(
      /^\/api\/unelte\/cerere-demisie\?.*format=pdf/u,
    );
  });

  it("fără exemplu nu randează nimic", () => {
    const { container } = render(<ExempluCompletat exemplu={undefined} />);
    expect(container.innerHTML).toBe("");
  });
});
```

În `noduri-json-ld.test.ts`, în `describe("nodUnealta")`, după testul existent:

```ts
  it("cu imagine, are `ImageObject` cu adresa absolută; fără, nu are cheia", () => {
    const cu = nodUnealta({
      cale: "/unelte/cerere-demisie",
      nume: "Cerere de demisie",
      descriere: "Descriere.",
      imagine: { url: "/capturi/unelte/x-1200.webp", latime: 1200, inaltime: 1200, descriere: "Alt." },
    });
    expect(cu).toMatchObject({
      image: {
        "@type": "ImageObject",
        url: `${ADRESA_SITE}/capturi/unelte/x-1200.webp`,
        width: 1200,
        height: 1200,
        caption: "Alt.",
      },
    });
    const fara = nodUnealta({ cale: "/unelte/calculator-salariu", nume: "C", descriere: "D." });
    expect("image" in fara).toBe(false);
  });
```

- [ ] **Pasul 2: Rulează-le și vezi-le picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/content/landing/exemple-unelte.test.ts "src/app/(marketing)/_componente/exemplu-completat.test.tsx" "src/app/(marketing)/_componente/noduri-json-ld.test.ts"
```

Așteptat: `Failed to resolve import "./exemple-unelte"` (două fișiere), iar în `noduri-json-ld.test.ts` `expected { … } to match object { image: … }`. Typecheck-ul ar refuza și cheia `imagine`, dar vitest nu face typecheck.

- [ ] **Pasul 3: Implementarea minimă**

`src/content/landing/exemple-unelte.ts`:

```ts
// src/content/landing/exemple-unelte.ts
/**
 * Exemplele „model completat” ale uneltelor.
 *
 * ── DE CE ─────────────────────────────────────────────────────────────────
 * „foaie de parcurs model completat”, „fisa ssm completata”: omul vrea să vadă
 * documentul plin înainte să-l completeze pe al lui. Exemplul e un link spre
 * unealta însăși, cu parametri fictivi, plus o captură a previzualizării —
 * deci arată exact ce descarcă, nu o ilustrație.
 *
 * ── DATELE ────────────────────────────────────────────────────────────────
 * Firma e „Administrativo Demo SRL”, aceeași firmă cu date inventate ca în
 * `scripts/capturi/capturi.mjs`. Fără CUI: un număr inventat poate fi al unei
 * firme reale. Numele de oameni sunt comune și fictive.
 *
 * ── POARTA ────────────────────────────────────────────────────────────────
 * `exemple-unelte.test.ts` construiește fiecare exemplu prin registrul
 * uneltelor și caută în document fiecare valoare din `verificate`: un parametru
 * redenumit într-o unealtă pică aici, nu în fața omului. Capturile se refac cu
 * `node scripts/capturi/capturi-unelte.mjs`, cu `pnpm dev` pornit.
 */

export const LATURA_CAPTURA = 1200;

export type ExempluUnealta = Readonly<{
  /** Calea paginii uneltei. */
  pagina: string;
  /**
   * Segmentul rutei de descărcare (`/api/unelte/<api>`): cheia din `UNELTE` sau
   * o rută statică proprie (fișa de evaluare, după I7).
   */
  api: string;
  parametri: Readonly<Record<string, string>>;
  /** Valori care TREBUIE să apară în documentul construit. */
  verificate: readonly string[];
  alt: string;
  /** Baza numelui de fișier din `public/capturi/unelte/`. */
  captura: string;
}>;

const FIRMA = "Administrativo Demo SRL";

export const EXEMPLE_UNELTE: readonly ExempluUnealta[] = [
  {
    pagina: "/unelte/cerere-demisie",
    api: "cerere-demisie",
    parametri: {
      tip: "preaviz",
      categorie: "executie",
      nume: "Popescu Ana",
      functie: "contabil",
      angajator: FIRMA,
      contract: "nr. 12 din 03.02.2025",
      depunere: "2026-10-08",
      preaviz: "20",
    },
    verificate: ["Popescu Ana", "contabil", FIRMA, "nr. 12 din 03.02.2025", "joi, 5 noiembrie 2026"],
    alt: "Cerere de demisie, model completat: preaviz de 20 de zile lucrătoare, ultima zi joi, 5 noiembrie 2026",
    captura: "cerere-demisie-exemplu",
  },
  {
    pagina: "/unelte/programare-concedii",
    api: "programare-concedii",
    parametri: {
      an: "2027",
      firma: FIRMA,
      compartiment: "Producție",
      zile: "21",
      angajati: "Popescu Ana\nIonescu Mihai\nRadu Elena",
    },
    verificate: [FIRMA, "Producție", "Popescu Ana", "Ionescu Mihai", "Radu Elena", "anul 2027"],
    alt: "Programarea concediilor de odihnă pe 2027, model completat, cu zilele lucrătoare din fiecare lună",
    captura: "programare-concedii-exemplu",
  },
  {
    pagina: "/unelte/adeverinta-salariat",
    api: "adeverinta-salariat",
    parametri: {
      firma: FIRMA,
      nr: "154",
      nume: "Popescu Ana",
      functie: "contabil",
      angajare: "2025-02-03",
      durata: "nedeterminata",
      ore: "8",
      scop: "medicul de familie",
    },
    verificate: [FIRMA, "Popescu Ana", "contabil", "03.02.2025", "medicul de familie"],
    alt: "Adeverință de salariat, model completat pentru medicul de familie",
    captura: "adeverinta-salariat-exemplu",
  },
  {
    pagina: "/unelte/fisa-instruire-ssm",
    api: "fisa-instruire-ssm",
    parametri: {
      nume: "Popescu Ana",
      functie: "operator CNC",
      loc: "Hala de producție",
      firma: FIRMA,
    },
    verificate: ["Popescu Ana", "operator CNC", "Hala de producție", FIRMA],
    alt: "Fișa individuală de instruire SSM, model completat pentru un operator CNC",
    captura: "fisa-instruire-ssm-exemplu",
  },
  {
    pagina: "/unelte/fisa-evaluare",
    api: "fisa-evaluare",
    parametri: {
      nume: "Popescu Ana",
      functie: "contabil",
      perioada: "ianuarie – decembrie 2026",
      evaluator: "Ionescu Mihai, director",
      firma: FIRMA,
    },
    verificate: ["Popescu Ana", "contabil", "ianuarie – decembrie 2026", "Ionescu Mihai, director"],
    alt: "Fișa de evaluare a performanțelor profesionale, model completat",
    captura: "fisa-evaluare-exemplu",
  },
];

export function exempluPentru(pagina: string): ExempluUnealta | undefined {
  return EXEMPLE_UNELTE.find((e) => e.pagina === pagina);
}

export function adresaExemplu(e: ExempluUnealta): string {
  return `${e.pagina}?${new URLSearchParams(e.parametri).toString()}#documentul`;
}

export function descarcareExemplu(e: ExempluUnealta, format: "pdf" | "docx" | "xlsx"): string {
  return `/api/unelte/${e.api}?${new URLSearchParams({ ...e.parametri, format }).toString()}`;
}

export function srcCaptura(e: ExempluUnealta, latura: 600 | 1200): string {
  return `/capturi/unelte/${e.captura}-${String(latura)}.webp`;
}

export function imagineExemplu(
  e: ExempluUnealta,
): Readonly<{ url: string; latime: number; inaltime: number; descriere: string }> {
  return { url: srcCaptura(e, 1200), latime: LATURA_CAPTURA, inaltime: LATURA_CAPTURA, descriere: e.alt };
}
```

`src/app/(marketing)/_componente/exemplu-completat.tsx`:

```tsx
// src/app/(marketing)/_componente/exemplu-completat.tsx
import {
  adresaExemplu,
  descarcareExemplu,
  LATURA_CAPTURA,
  srcCaptura,
  type ExempluUnealta,
} from "@/content/landing/exemple-unelte";

import { Banda } from "./banda";

/**
 * Banda „Model completat”: captura exemplului, legătura care îl deschide în
 * unealtă și descărcarea lui.
 *
 * Atributele `data-exemplu*` sunt citite de `scripts/capturi/capturi-unelte.mjs`:
 * scriptul găsește aici unde să ducă browserul și ce fișiere să scrie, deci
 * lista exemplelor nu se repetă în script.
 */
export function ExempluCompletat({ exemplu }: Readonly<{ exemplu: ExempluUnealta | undefined }>) {
  if (exemplu === undefined) return null;
  return (
    <div data-tipar="ascunde">
      <Banda inaltime="scurta" supratitlu="Model completat" titlu="Cum arată completat">
        <figure className="mt-6 max-w-[36rem]" data-exemplu="" data-exemplu-mic={srcCaptura(exemplu, 600)}>
          {/* eslint-disable-next-line @next/next/no-img-element --
              capturi statice, deja la mărimea finală (600 și 1200 px, WebP),
              ca în `prin-geam.tsx`: optimizatorul n-ar avea ce adăuga. */}
          <img
            src={srcCaptura(exemplu, 1200)}
            srcSet={`${srcCaptura(exemplu, 600)} 600w, ${srcCaptura(exemplu, 1200)} 1200w`}
            sizes="(min-width: 640px) 36rem, 100vw"
            width={LATURA_CAPTURA}
            height={LATURA_CAPTURA}
            alt={exemplu.alt}
            loading="lazy"
            decoding="async"
            className="border-mk-rigla h-auto w-full border"
          />
          <figcaption className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[0.9375rem]">
            <a href={adresaExemplu(exemplu)} data-exemplu-adresa="" className="underline underline-offset-4">
              Deschide exemplul și schimbă datele
            </a>
            <a
              href={descarcareExemplu(exemplu, "pdf")}
              data-umami-event={`${exemplu.api}-exemplu-pdf`}
              className="underline underline-offset-4"
            >
              Descarcă exemplul în PDF
            </a>
          </figcaption>
        </figure>
      </Banda>
    </div>
  );
}
```

`noduri-json-ld.ts`, `nodUnealta`. Vechi (`:198-216`):

```ts
export function nodUnealta(u: Readonly<{ cale: string; nume: string; descriere: string }>) {
  const url = `${ADRESA_SITE}${u.cale}`;
  return {
```

Nou:

```ts
export function nodUnealta(
  u: Readonly<{
    cale: string;
    nume: string;
    descriere: string;
    /** Captura modelului completat (`exemple-unelte.ts`), din 8 oct 2026. */
    imagine?: Readonly<{ url: string; latime: number; inaltime: number; descriere: string }>;
  }>,
) {
  const url = `${ADRESA_SITE}${u.cale}`;
  return {
```

Iar ultima cheie din obiect. Vechi:

```ts
    provider: { "@id": ID_ORGANIZATIE },
    isPartOf: { "@id": ID_SITE },
  };
}
```

Nou (spread condiționat, ca la `nodArticol`):

```ts
    provider: { "@id": ID_ORGANIZATIE },
    isPartOf: { "@id": ID_SITE },
    ...(u.imagine === undefined
      ? {}
      : {
          image: {
            "@type": "ImageObject",
            url: `${ADRESA_SITE}${u.imagine.url}`,
            width: u.imagine.latime,
            height: u.imagine.inaltime,
            caption: u.imagine.descriere,
          },
        }),
  };
}
```

Docblock-ul lui `nodUnealta` primește rândul: ` * \`image\`: doar cu o captură a documentului completat — informație, nu decor (8 oct 2026).`

**Cele 5 pagini.** În fiecare, importurile:

```ts
import { exempluPentru, imagineExemplu } from "@/content/landing/exemple-unelte";
```

```ts
import { ExempluCompletat } from "../../_componente/exemplu-completat";
```

În corpul componentei, după citirea parametrilor:

```ts
  const exemplu = exempluPentru(CALE);
```

La fișa SSM și la fișa de evaluare, care nu au constanta `CALE`, se scrie calea literal: `exempluPentru("/unelte/fisa-instruire-ssm")`, respectiv `exempluPentru("/unelte/fisa-evaluare")`.

Nodul. De exemplu, la cererea de demisie, vechi:

```tsx
        date={nodUnealta({
          cale: CALE,
          nume: ANTET_CERERE_DEMISIE.titlu,
          descriere: ANTET_CERERE_DEMISIE.lead,
        })}
```

Nou:

```tsx
        date={nodUnealta({
          cale: CALE,
          nume: ANTET_CERERE_DEMISIE.titlu,
          descriere: ANTET_CERERE_DEMISIE.lead,
          ...(exemplu === undefined ? {} : { imagine: imagineExemplu(exemplu) }),
        })}
```

La fel la celelalte patru, cu antetul lor: `ANTET_PROGRAMARE_CONCEDII`, `ANTET_ADEVERINTA_SALARIAT`, `ANTET_FISA_SSM` și `ANTET_FISA_EVALUARE`. Ultimele două au azi `cale: "/unelte/fisa-instruire-ssm"` și `cale: "/unelte/fisa-evaluare"` literal (citit: `fisa-instruire-ssm/page.tsx:71`, `fisa-evaluare/page.tsx:72`).

Banda. Înaintea benzii „Fără hârtie” din fiecare pagină se adaugă, în afara oricărui `div data-tipar="ascunde"` (componenta își poartă singură marcajul):

```tsx
      <ExempluCompletat exemplu={exemplu} />
```

La fișa de evaluare (azi `:163-169`) și la fișa SSM (azi `:156`), banda „Fără hârtie” stă în interiorul unui `<div data-tipar="ascunde">`. Acolo `<ExempluCompletat … />` se pune chiar înaintea acelui `<div data-tipar="ascunde">`. La cele trei pagini noi, „Fără hârtie” e după `IntrebariUnealta`, în același `div`: exemplul se pune înaintea acelui `div`, adică între previzualizare și întrebări.

**Descrierile.** Acum că există modelul completat, `seo-unelte.ts` îl spune la fișa SSM, unde forma „completata” are scor 19. Vechi (descrierea lui H7, preluată în K1):

```ts
    descriere:
      "Fișa individuală de instruire SSM completă, după anexa 11 la HG 1425/2006: la angajare, periodică, suplimentară, testări, control medical. Word sau PDF.",
```

Nou (145 de caractere):

```ts
    descriere:
      "Fișa individuală de instruire SSM după anexa 11 la HG 1425/2006, cu model completat: la angajare, periodică, suplimentară, testări. Word sau PDF.",
```

Dacă secțiunea care deține fișa SSM a schimbat textul fișei sau al paginii așa încât „după anexa 11” nu mai e adevărat, propoziția urmează textul ei, nu pe cel de aici.

`scripts/capturi/capturi-unelte.mjs`:

```js
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
const FARA_BARA = '[aria-label="Cookie-uri de analiză"] { display: none !important; }';

const browser = await chromium.launch({ executablePath: EXEC });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
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
  if (adresa === "" || mare === "" || mic === "") throw new Error(`${cale}: banda exemplului e incompletă.`);

  await pagina.goto(`${BAZA}${adresa}`, { waitUntil: "networkidle" });
  const foaie = await pagina.$("#documentul figure.mk-foaie");
  if (foaie === null) throw new Error(`${cale}: exemplul nu are previzualizare (#documentul figure.mk-foaie).`);
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
```

**`harta.ts`**: `actualizat` la data commitului pe `/unelte/cerere-demisie`, `/unelte/programare-concedii`, `/unelte/adeverinta-salariat`, `/unelte/fisa-instruire-ssm` și `/unelte/fisa-evaluare`, cu comentariul `// <data>: modelul completat, cu captură.`

- [ ] **Pasul 4: Generează capturile, apoi rulează testele**

```bash
cd /srv/apps/ERP && (pnpm dev -H 127.0.0.1 -p 3917 > /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/k11-dev.log 2>&1 &) ; sleep 25
cd /srv/apps/ERP && node scripts/capturi/capturi-unelte.mjs && ls -la public/capturi/unelte/
```

Trebuie să iasă 10 fișiere `.webp`, câte două pe exemplu. Fiecare `-1200.webp` se deschide cu Read: documentul trebuie să se vadă întreg, cu datele exemplului, pe fundal alb, fără bara de cookie-uri. (Corectat la verificare: bara e `fixed`, iar o captură de element ia tot ce se vede în dreptunghiul lui, bara inclusă. Scriptul o ascunde de două ori: alegerea salvată în `localStorage` și `style` la `screenshot`.) Serverul se oprește ca la K1. Apoi:

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/content/landing/exemple-unelte.test.ts "src/app/(marketing)/_componente/exemplu-completat.test.tsx" "src/app/(marketing)/_componente/noduri-json-ld.test.ts" src/content/landing/
cd /srv/apps/ERP && pnpm typecheck && pnpm check:server && pnpm lint && pnpm test && node scripts/checks/lastmod.mjs && pnpm exec prettier --check src/content/landing/exemple-unelte.ts src/content/landing/exemple-unelte.test.ts "src/app/(marketing)/_componente/exemplu-completat.tsx" "src/app/(marketing)/_componente/exemplu-completat.test.tsx" "src/app/(marketing)/_componente/noduri-json-ld.ts" "src/app/(marketing)/_componente/noduri-json-ld.test.ts" scripts/capturi/capturi-unelte.mjs "src/app/(marketing)/unelte"
du -ch public/capturi/unelte/*.webp | tail -1
```

Totalul trebuie să fie sub 1,5 MB. Dacă o captură de 1200 trece de 250 KB, se coboară `quality` la 75 și se regenerează.

- [ ] **Pasul 5: Verificare headless**: datele structurate și imaginea, la 360 px. Cu serverul pornit din nou:

```bash
for c in cerere-demisie fisa-evaluare; do curl -s "http://127.0.0.1:3917/unelte/$c" | grep -o '"@type":"ImageObject","url":"[^"]*"' ; done
```

Două rânduri cu `https://administrativo.ro/capturi/unelte/<x>-exemplu-1200.webp`. Apoi scriptul de la K8, Pasul 5, cu `sw === cw` pe `/unelte/fisa-evaluare` la 360 px: imaginea are `w-full`, deci nu are voie să lățească pagina.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
U="src/app/(marketing)/unelte"
CAI=(src/content/landing/exemple-unelte.ts src/content/landing/exemple-unelte.test.ts "src/app/(marketing)/_componente/exemplu-completat.tsx" "src/app/(marketing)/_componente/exemplu-completat.test.tsx" "src/app/(marketing)/_componente/noduri-json-ld.ts" "src/app/(marketing)/_componente/noduri-json-ld.test.ts" scripts/capturi/capturi-unelte.mjs public/capturi/unelte "$U/cerere-demisie/page.tsx" "$U/programare-concedii/page.tsx" "$U/adeverinta-salariat/page.tsx" "$U/fisa-instruire-ssm/page.tsx" "$U/fisa-evaluare/page.tsx" src/content/landing/seo-unelte.ts src/content/landing/harta.ts)
git status --short -- "${CAI[@]}"
git fetch origin main
git diff --name-only HEAD origin/main -- "${CAI[@]}"
git add -- src/content/landing/exemple-unelte.ts src/content/landing/exemple-unelte.test.ts "src/app/(marketing)/_componente/exemplu-completat.tsx" "src/app/(marketing)/_componente/exemplu-completat.test.tsx" scripts/capturi/capturi-unelte.mjs public/capturi/unelte
git commit --only -m "feat(unelte): modelul completat, cu captură, pe cinci unelte" -m "Exemple cu date fictive (firma demo), construite prin registrul uneltelor și verificate de test; capturile WebP de 600/1200 px le scrie scripts/capturi/capturi-unelte.mjs din pagina însăși; nodUnealta primește image." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "${CAI[@]}"
node scripts/checks/lastmod.mjs
git merge origin/main
git push origin main
```

---

### Task K12: Google Analytics pe `/unelte*`: biblioteca abia după „Accept”

Rulează după A3, care pune `PornireGa` în `analitice.tsx`, și după A7 (politica pe care o corectează Pasul 4b). Dacă J3 e deja pe `main`, după J3 (rescrie aceeași politică). B5 trebuie să fie și el pe `main`: K12 atinge `bara-consimtamant.tsx`, unde B5 a pus `data-tipar="ascunde"`, iar blocul vechi al lui K12 se citește pe forma de după B5.

**Fișiere:**
- Create: `src/app/(marketing)/_componente/biblioteca-ga.tsx`
- Test: `src/app/(marketing)/_componente/biblioteca-ga.test.tsx`, `src/app/(marketing)/_componente/bara-consimtamant.test.tsx` (Create, extins în K13)
- Modify: `src/app/(marketing)/_componente/consimtamant.ts` (constantă nouă, după `CHEIE_CONSIMTAMANT`)
- Modify: `src/app/(marketing)/_componente/bara-consimtamant.tsx` (importul `:6` și funcția `raspunde`, `:73-86`)
- Modify: `src/app/(marketing)/_componente/analitice.tsx` (importuri și `<Script src=…gtag…>`, azi `:133-135`)
- Modify: `src/content/legal/confidentialitate.ts`, `src/content/legal/confidentialitate.test.ts`, `src/content/landing/harta.ts` (Pasul 4b, adăugat de criticul de completitudine)

**Interfețe:**
- Consumă: `CHEIE_CONSIMTAMANT`, `type Alegere` (`./consimtamant`); `usePathname(): string` (`next/navigation`, client); `Script` (`next/script`).
- Produce:
  ```ts
  export const EVENIMENT_CONSIMTAMANT = "adm-consimtamant-ales"; // CustomEvent<Alegere>, pe window
  export function peUnealta(cale: string): boolean;
  export function BibliotecaGa(p: Readonly<{ id: string }>): JSX.Element | null;
  ```
  Contractul: pe `/unelte` și `/unelte/*`, `gtag.js` se încarcă doar dacă alegerea salvată e „acceptat” sau dacă omul apasă „Accept” în aceeași vizită. Pe restul paginilor comportamentul rămâne cel de azi: biblioteca se încarcă imediat, iar consimțământul implicit e „denied”.

- [ ] **Pasul 1: Scrie testele care pică**

`biblioteca-ga.test.tsx`:

```tsx
// src/app/(marketing)/_componente/biblioteca-ga.test.tsx
import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const stare = vi.hoisted(() => ({ cale: "/unelte/foaie-de-pontaj" }));

vi.mock("next/navigation", () => ({ usePathname: () => stare.cale }));
// `next/script` adaugă scriptul în `document.body` dintr-un efect; în test ne
// interesează DACĂ se cere, nu încărcarea în sine. Tiparul cu `await import`
// din factory e cel din `src/components/ui/comutator-vizualizare.test.tsx`.
vi.mock("next/script", async () => {
  const { createElement } = await import("react");
  return {
    default: (props: Record<string, unknown>) =>
      createElement("script", { "data-test-src": props["src"] as string }),
  };
});

import { BibliotecaGa, peUnealta } from "./biblioteca-ga";
import { CHEIE_CONSIMTAMANT, EVENIMENT_CONSIMTAMANT } from "./consimtamant";

const ceruta = (c: HTMLElement) => c.querySelectorAll("script[data-test-src]").length;
const unCadru = () => new Promise((rezolva) => requestAnimationFrame(() => rezolva(null)));

beforeEach(() => {
  localStorage.clear();
  stare.cale = "/unelte/foaie-de-pontaj";
});

describe("BibliotecaGa", () => {
  it("pe o unealtă, fără alegere: gtag.js nu se cere", async () => {
    const { container } = render(<BibliotecaGa id="G-TEST" />);
    await act(unCadru);
    expect(ceruta(container)).toBe(0);
  });

  it("pe o unealtă, după „Accept” în aceeași vizită: se cere o dată", async () => {
    const { container } = render(<BibliotecaGa id="G-TEST" />);
    await act(unCadru);
    act(() => {
      window.dispatchEvent(new CustomEvent(EVENIMENT_CONSIMTAMANT, { detail: "acceptat" }));
    });
    expect(ceruta(container)).toBe(1);
    expect(container.querySelector("script")?.getAttribute("data-test-src")).toBe(
      "https://www.googletagmanager.com/gtag/js?id=G-TEST",
    );
  });

  it("pe o unealtă, „Refuz” n-o cere", async () => {
    const { container } = render(<BibliotecaGa id="G-TEST" />);
    act(() => {
      window.dispatchEvent(new CustomEvent(EVENIMENT_CONSIMTAMANT, { detail: "refuzat" }));
    });
    await act(unCadru);
    expect(ceruta(container)).toBe(0);
  });

  it("pe o unealtă, cu acceptul salvat: se cere după primul cadru", async () => {
    localStorage.setItem(CHEIE_CONSIMTAMANT, "acceptat");
    const { container } = render(<BibliotecaGa id="G-TEST" />);
    await waitFor(() => expect(ceruta(container)).toBe(1));
  });

  it("în afara uneltelor: ca până acum, imediat, fără alegere", () => {
    stare.cale = "/preturi";
    const { container } = render(<BibliotecaGa id="G-TEST" />);
    expect(ceruta(container)).toBe(1);
  });

  it("peUnealta: hub-ul și copiii lui, nu și o adresă care doar începe la fel", () => {
    expect(peUnealta("/unelte")).toBe(true);
    expect(peUnealta("/unelte/cerere-demisie")).toBe(true);
    expect(peUnealta("/unelteleX")).toBe(false);
    expect(peUnealta("/")).toBe(false);
  });
});
```

`bara-consimtamant.test.tsx`:

```tsx
// src/app/(marketing)/_componente/bara-consimtamant.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { BaraConsimtamant } from "./bara-consimtamant";
import { EVENIMENT_CONSIMTAMANT } from "./consimtamant";

beforeEach(() => {
  localStorage.clear();
});

describe("BaraConsimtamant", () => {
  it("la „Accept” anunță alegerea pe window, apoi dispare", async () => {
    const auzite: unknown[] = [];
    const asculta = (e: Event) => auzite.push((e as CustomEvent<unknown>).detail);
    window.addEventListener(EVENIMENT_CONSIMTAMANT, asculta);
    try {
      render(<BaraConsimtamant />);
      (await screen.findByRole("button", { name: "Accept" })).click();
      await waitFor(() =>
        expect(screen.queryByRole("region", { name: "Cookie-uri de analiză" })).toBeNull(),
      );
      expect(auzite).toEqual(["acceptat"]);
    } finally {
      window.removeEventListener(EVENIMENT_CONSIMTAMANT, asculta);
    }
  });
});
```

- [ ] **Pasul 2: Rulează-le și vezi-le picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/_componente/biblioteca-ga.test.tsx" "src/app/(marketing)/_componente/bara-consimtamant.test.tsx"
```

Așteptat: `Failed to resolve import "./biblioteca-ga"`. În testul barei, `auzite` e `[]` în loc de `["acceptat"]`, fiindcă `EVENIMENT_CONSIMTAMANT` e `undefined`, așa că `addEventListener` ascultă evenimentul „undefined”.

- [ ] **Pasul 3: Implementarea minimă**

`consimtamant.ts`, după `export const CHEIE_CONSIMTAMANT = "adm-consimtamant";`:

```ts

/**
 * Evenimentul de pe `window` la o alegere în bară, cu alegerea în `detail`.
 *
 * Îl ascultă `BibliotecaGa`: pe paginile uneltelor, `gtag.js` se încarcă abia
 * după „Accept”, și trebuie să se încarce în aceeași vizită, nu la următoarea.
 * Modul ăsta e neutru (fără directivă), deci constanta ajunge identică în
 * ambele grafuri — vezi docblock-ul de sus.
 */
export const EVENIMENT_CONSIMTAMANT = "adm-consimtamant-ales";
```

`bara-consimtamant.tsx`. Importul vechi:

```ts
import { CHEIE_CONSIMTAMANT, type Alegere } from "./consimtamant";
```

Nou:

```ts
import { CHEIE_CONSIMTAMANT, EVENIMENT_CONSIMTAMANT, type Alegere } from "./consimtamant";
```

În `raspunde`, după apelul `gtag?.("consent", "update", { … });`:

```ts
    // `BibliotecaGa` așteaptă alegerea pe paginile uneltelor (8 oct 2026).
    window.dispatchEvent(new CustomEvent<Alegere>(EVENIMENT_CONSIMTAMANT, { detail: raspuns }));
```

`biblioteca-ga.tsx`:

```tsx
// src/app/(marketing)/_componente/biblioteca-ga.tsx
"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useState } from "react";

import { CHEIE_CONSIMTAMANT, EVENIMENT_CONSIMTAMANT, type Alegere } from "./consimtamant";

/**
 * Biblioteca Google Analytics (`gtag.js`, ~180 KB).
 *
 * ── DE CE NU MAI SE ÎNCARCĂ ORICUM PE UNELTE ──────────────────────────────
 * Consent Mode v2 o încarcă și fără consimțământ, ca să trimită semnale fără
 * cookie-uri. Pe paginile uneltelor, auditul din 8 oct 2026 a găsit trei
 * lucruri: semnalele acelea duceau la Google numele scrise în formular (A3 a
 * închis-o, oprind `config` pe adresele cu date); la CPU ×4, gtag.js era cel
 * mai mare script de pe pagină; iar GA nu e sursa cifrelor (Umami e — memoria
 * `erp-analitice-fapte-verificate`). Pe unelte, deci, biblioteca vine abia
 * după „Accept”: alegerea salvată sau evenimentul din bară.
 *
 * Pe restul sitului rămâne cum era — decizia pentru tot situl e a
 * utilizatorului (auditul SEO din 7 oct 2026, „Decizii care îți aparțin”).
 *
 * Coada de comenzi nu se pierde: `gtag()` din scriptul de consimțământ și
 * `PornireGa` scriu în `dataLayer`, pe care biblioteca îl citește la încărcare.
 */
export function peUnealta(cale: string): boolean {
  return cale === "/unelte" || cale.startsWith("/unelte/");
}

function acceptulSalvat(): boolean {
  try {
    return localStorage.getItem(CHEIE_CONSIMTAMANT) === "acceptat";
  } catch {
    // Stocare blocată: nu știm de un accept, deci nu încărcăm.
    return false;
  }
}

export function BibliotecaGa({ id }: Readonly<{ id: string }>) {
  const cale = usePathname();
  const [aAcceptat, setAAcceptat] = useState(false);

  useEffect(() => {
    // Un cadru mai târziu, ca în `bara-consimtamant.tsx`: lint-ul refuză
    // `setState` sincron în efect.
    const cadru = requestAnimationFrame(() => {
      if (acceptulSalvat()) setAAcceptat(true);
    });
    const laAlegere = (e: Event) => {
      if ((e as CustomEvent<Alegere>).detail === "acceptat") setAAcceptat(true);
    };
    window.addEventListener(EVENIMENT_CONSIMTAMANT, laAlegere);
    return () => {
      cancelAnimationFrame(cadru);
      window.removeEventListener(EVENIMENT_CONSIMTAMANT, laAlegere);
    };
  }, []);

  if (peUnealta(cale) && !aAcceptat) return null;
  return (
    <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
  );
}
```

`analitice.tsx`. Importuri: se adaugă `import { BibliotecaGa } from "./biblioteca-ga";`, în ordine alfabetică imediat după `./bara-consimtamant`. Blocul vechi:

```tsx
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${ID_GA}`}
        strategy="afterInteractive"
      />
```

Nou:

```tsx
      {/* Pe `/unelte*`, abia după „Accept” (`biblioteca-ga.tsx`); în rest, ca înainte. */}
      <BibliotecaGa id={ID_GA} />
```

`Script` rămâne importat: îl folosește `ScriptUmami`. În docblock-ul de sus, în secțiunea „DE CE SUB CONSIMȚĂMÂNT”, după fraza „Nu se pierde nimic din ce se poate avea legal.”, se adaugă: ` * Excepția, din 8 oct 2026: pe paginile uneltelor, biblioteca însăși vine abia după „Accept” (`biblioteca-ga.tsx`).`

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/_componente/"
cd /srv/apps/ERP && pnpm typecheck && pnpm check:server && pnpm lint && pnpm test && pnpm exec prettier --check "src/app/(marketing)/_componente/biblioteca-ga.tsx" "src/app/(marketing)/_componente/biblioteca-ga.test.tsx" "src/app/(marketing)/_componente/bara-consimtamant.tsx" "src/app/(marketing)/_componente/bara-consimtamant.test.tsx" "src/app/(marketing)/_componente/consimtamant.ts" "src/app/(marketing)/_componente/analitice.tsx"
```

`pnpm check:server` contează aici. `consimtamant.ts` rămâne fără directivă. Dacă cineva ar muta constanta în `bara-consimtamant.tsx` („use client”), `analitice.tsx` n-o importă, dar `biblioteca-ga.tsx` da: memoria `erp-constanta-client-in-server` spune că un proxy stringificat nu e prins de tsc, de lint sau de build.

- [ ] **Pasul 5: Verificare live, după deploy-ul confirmat de utilizator.** Local nu se poate: `next dev` nu hidratează (memoria `erp-next-dev-nu-hidrateaza`), iar comportamentul e de client. Se declară neverificat până atunci.

```bash
cat > /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/k12-live.mjs <<'JS'
import { chromium } from "/srv/apps/ERP/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core/index.mjs";
const b = await chromium.launch({ executablePath: "/home/miro/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell" });
const masoara = async (cale, accepta) => {
  const ctx = await b.newContext({ viewport: { width: 360, height: 800 } });
  const p = await ctx.newPage();
  let gtag = 0;
  // Colectoarele se anulează: auditul nu are voie să se numere în statistici.
  await p.route(/googletagmanager\.com|google-analytics\.com|analitice\.administrativo\.ro\/api\/send/, (r) => {
    if (r.request().url().includes("googletagmanager.com/gtag/js")) gtag += 1;
    return r.abort();
  });
  await p.goto(`https://administrativo.ro${cale}?m=k12${Date.now()}`, { waitUntil: "networkidle" });
  if (accepta) { await p.getByRole("button", { name: "Accept" }).click(); await p.waitForTimeout(2000); }
  await ctx.close();
  return gtag;
};
console.log(JSON.stringify({
  unelteFaraAlegere: await masoara("/unelte/cerere-concediu-de-odihna", false),
  unelteDupaAccept: await masoara("/unelte/cerere-concediu-de-odihna", true),
  preturiFaraAlegere: await masoara("/preturi", false),
}));
await b.close();
JS
node /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/k12-live.mjs
```

Așteptat: `{"unelteFaraAlegere":0,"unelteDupaAccept":1,"preturiFaraAlegere":1}`. Un 0 pe `unelteDupaAccept` înseamnă că evenimentul nu ajunge la componentă. Un 1 pe `unelteFaraAlegere` înseamnă că poarta nu funcționează. Ambele blochează închiderea taskului.

- [ ] **Pasul 4b: Politica spune ce face codul** (adăugat de criticul de completitudine, 8 oct 2026). Fraza scrisă de A7 în `src/content/legal/confidentialitate.ts` („Până atunci, refuzul e implicit: biblioteca Google se încarcă totuși și trimite semnale fără cookie-uri… Excepție: o pagină de unealtă deschisă cu valori completate nu trimite nimic la Google Analytics, nici după „Accept”.”) devine falsă pe `/unelte*` după K12, unde biblioteca nu se mai încarcă deloc înainte de „Accept”. Înainte de commit, în același șir, după „cum prevede modul de consimțământ al Google.”, se adaugă: „Pe paginile uneltelor (administrativo.ro/unelte) biblioteca nu se încarcă deloc până nu apeși „Accept”.” Excepția lui A7 rămâne neschimbată. În `src/content/legal/confidentialitate.test.ts` în `describe("politica despre uneltele gratuite")` se adaugă `it("pe /unelte, biblioteca GA abia după „Accept” (K12)", () => { expect(politica).toMatch(/nu se încarcă deloc până nu apeși/u); });`, cu variabila `politica` a lui A7 (`JSON.stringify(SECTIUNI_CONFIDENTIALITATE)`). Testul se vede întâi picând, apoi trece după schimbarea textului. În `src/content/landing/harta.ts`, intrarea `cale: "/legal/confidentialitate"` primește `actualizat` = `date +%F`. Cele trei fișiere intră în `CAI`. Dacă J3 (numărarea pe server) a rescris între timp aceeași frază, citește forma de pe `main` și pune propoziția după fraza despre biblioteca Google.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
C="src/app/(marketing)/_componente"
CAI=("$C/biblioteca-ga.tsx" "$C/biblioteca-ga.test.tsx" "$C/bara-consimtamant.tsx" "$C/bara-consimtamant.test.tsx" "$C/consimtamant.ts" "$C/analitice.tsx" src/content/legal/confidentialitate.ts src/content/legal/confidentialitate.test.ts src/content/landing/harta.ts)
git status --short -- "${CAI[@]}"
git fetch origin main
git diff --name-only HEAD origin/main -- "${CAI[@]}"
git add -- "$C/biblioteca-ga.tsx" "$C/biblioteca-ga.test.tsx" "$C/bara-consimtamant.test.tsx"
git commit --only -m "perf(unelte): gtag.js pe paginile uneltelor abia după „Accept”" -m "Pe /unelte* biblioteca (~180 KB) se încarcă doar cu acceptul salvat sau la evenimentul din bară; pe restul sitului rămâne Consent Mode, ca înainte. Coada din dataLayer se păstrează." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "${CAI[@]}"
git merge origin/main
git push origin main
```

---

### Task K13: Bara de consimțământ, din primul cadru (LCP-ul hub-ului)

Auditul a măsurat pe hub, la CPU ×4 și 1,6 Mbps: FCP 0,98 s, dar LCP 3,7 s. Elementul LCP e paragraful barei, care apare abia după hidratare: `useState("necitit")` returnează `null` pe server, iar bara se citește într-un `requestAnimationFrame`. Dacă bara se randează pe server și se arată din CSS, ea se vopsește odată cu restul paginii, iar LCP coboară la nivelul FCP-ului, chiar dacă bara rămâne elementul cel mai mare.

Rulează după K12 și B5 (`data-tipar` pe bară).

**Fișiere:**
- Modify: `src/app/(marketing)/_componente/consimtamant.ts` (constantă nouă)
- Modify: `src/app/(marketing)/_componente/analitice.tsx`: `CONSIMTAMANT_IMPLICIT` (azi `:46-61`) devine exportat, iar blocul `try` din el se rescrie
- Modify: `src/app/(marketing)/_componente/bara-consimtamant.tsx`: condiția de ascundere (azi `:90`) și elementul rădăcină (azi `:92-96`)
- Modify: `src/app/globals.css` (după ultimul bloc, `a[href^="http"]::after`, la final)
- Test: `src/app/(marketing)/_componente/bara-consimtamant.test.tsx` (extins)

**Interfețe:**
- Consumă: `CHEIE_CONSIMTAMANT`; `renderToStaticMarkup` (`react-dom/server`).
- Produce: `export const ATRIBUT_CONSIMTAMANT = "data-consimtamant";` și `export const CONSIMTAMANT_IMPLICIT: string` (din `analitice.tsx`). Contractul: scriptul de la parsare pune `data-consimtamant="cere"` pe `<html>` când nu există o alegere citibilă. CSS-ul arată bara doar sub acel atribut. Serverul randează bara întotdeauna.

- [ ] **Pasul 1: Scrie testele care pică**: se adaugă în `bara-consimtamant.test.tsx`. Importurile devin:

```tsx
import { readFileSync } from "node:fs";

import { render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CONSIMTAMANT_IMPLICIT } from "./analitice";
import { BaraConsimtamant } from "./bara-consimtamant";
import { ATRIBUT_CONSIMTAMANT, CHEIE_CONSIMTAMANT, EVENIMENT_CONSIMTAMANT } from "./consimtamant";
```

`beforeEach` devine:

```tsx
beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute(ATRIBUT_CONSIMTAMANT);
});
```

Și un bloc nou la final:

```tsx
/** Rulează scriptul de consimțământ cum îl rulează browserul la parsare. */
function ruleazaScriptul() {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func -- textul e chiar scriptul emis în pagină; testul îl execută ca browserul.
  new Function(CONSIMTAMANT_IMPLICIT)();
}

describe("bara din primul cadru", () => {
  it("serverul randează bara, ca s-o vopsească odată cu pagina", () => {
    const html = renderToStaticMarkup(<BaraConsimtamant />);
    expect(html).toContain("data-bara-consimtamant");
    expect(html).toContain("Cookie-uri de analiză");
  });

  it("fără alegere salvată, scriptul de la parsare o cere", () => {
    ruleazaScriptul();
    expect(document.documentElement.getAttribute(ATRIBUT_CONSIMTAMANT)).toBe("cere");
  });

  it("cu alegerea salvată, n-o cere", () => {
    localStorage.setItem(CHEIE_CONSIMTAMANT, "refuzat");
    ruleazaScriptul();
    expect(document.documentElement.getAttribute(ATRIBUT_CONSIMTAMANT)).toBeNull();
  });

  it("cu stocarea blocată (fereastră privată), o cere", () => {
    // `vi.spyOn` pe instanță, nu `Storage.prototype.getItem = …`: în happy-dom
    // `localStorage` nu trece prin prototip, iar înlocuirea de pe prototip nu
    // ajunge la script (verificat la 8 oct 2026: atributul rămânea `null`).
    // Alegerea salvată e „refuzat”, ca testul să pice dacă `getItem` n-ar arunca.
    localStorage.setItem(CHEIE_CONSIMTAMANT, "refuzat");
    const spion = vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("Stocare blocată.");
    });
    try {
      ruleazaScriptul();
      expect(document.documentElement.getAttribute(ATRIBUT_CONSIMTAMANT)).toBe("cere");
    } finally {
      spion.mockRestore();
    }
  });

  it("CSS-ul ascunde bara implicit și o arată doar sub atribut", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/\n\[data-bara-consimtamant\] \{\n {2}display: none;\n\}/u);
    expect(css).toContain(':root[data-consimtamant="cere"] [data-bara-consimtamant] {');
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/_componente/bara-consimtamant.test.tsx"
```

Așteptat: `renderToStaticMarkup` dă `""`, fiindcă pe server bara întoarce `null`. Dacă în loc de asta cade cu o eroare de invariant din `next/link` (randare fără router), se adaugă în capul testului mock-ul lui `next/link` din `src/components/ui/comutator-vizualizare.test.tsx:13-26`, copiat ca atare, apoi testul se rulează din nou ca să pice din motivul așteptat. `CONSIMTAMANT_IMPLICIT` e `undefined`, deoarece nu e exportat. Atributul e `null`, iar CSS-ul nu se potrivește.

- [ ] **Pasul 3: Implementarea minimă**

`consimtamant.ts`, la final:

```ts

/**
 * Atributul de pe `<html>` care arată bara de consimțământ.
 *
 * Îl pune scriptul de la parsare (`CONSIMTAMANT_IMPLICIT` din `analitice.tsx`)
 * când nu există o alegere citibilă; `globals.css` arată bara doar sub el.
 * Așa bara se vopsește odată cu pagina, nu după hidratare — pe hub era
 * elementul LCP, la 3,7 s pe telefon (auditul din 8 oct 2026).
 */
export const ATRIBUT_CONSIMTAMANT = "data-consimtamant";
```

`analitice.tsx`. Importul vechi:

```ts
import { CHEIE_CONSIMTAMANT } from "./consimtamant";
```

Nou:

```ts
import { ATRIBUT_CONSIMTAMANT, CHEIE_CONSIMTAMANT } from "./consimtamant";
```

`const CONSIMTAMANT_IMPLICIT = \`` devine `export const CONSIMTAMANT_IMPLICIT = \``. În șablon, blocul vechi:

```js
try{
  if(localStorage.getItem('${CHEIE_CONSIMTAMANT}')==='acceptat'){
    gtag('consent','update',{analytics_storage:'granted'});
  }
}catch(e){}
```

Nou:

```js
var alegere=null;
try{alegere=localStorage.getItem('${CHEIE_CONSIMTAMANT}');}catch(e){}
if(alegere==='acceptat'){
  gtag('consent','update',{analytics_storage:'granted'});
}
if(alegere!=='acceptat'&&alegere!=='refuzat'){
  document.documentElement.setAttribute('${ATRIBUT_CONSIMTAMANT}','cere');
}
```

Docblock-ul lui `CONSIMTAMANT_IMPLICIT` primește paragraful: ` * Din 8 oct 2026 pune și \`data-consimtamant="cere"\` pe \`<html>\` când nu există o alegere: bara se arată din CSS, din primul cadru (\`globals.css\`).`

`bara-consimtamant.tsx`. Condiția veche:

```tsx
  // Trei motive de a nu apărea: alegerea nu s-a citit încă (inclusiv la randarea
  // pe server), e deja salvată, sau tocmai a fost dată în sesiunea asta.
  if (salvat !== "nimic" || raspunsAcum !== null) return null;
```

Nouă:

```tsx
  // Două motive de a nu apărea: alegerea e deja salvată sau tocmai a fost dată.
  // „necitit” (inclusiv pe server) RANDEAZĂ bara: dacă se vede o decide CSS-ul,
  // după atributul pus pe <html> la parsare (`ATRIBUT_CONSIMTAMANT`). Așa bara
  // se vopsește odată cu pagina, nu după hidratare (auditul din 8 oct 2026).
  if (raspunsAcum !== null || salvat === "acceptat" || salvat === "refuzat") return null;
```

Elementul rădăcină. Vechi (după B5):

```tsx
    <div
      role="region"
      aria-label="Cookie-uri de analiză"
      data-tipar="ascunde"
      className=
```

Nou:

```tsx
    <div
      role="region"
      aria-label="Cookie-uri de analiză"
      data-tipar="ascunde"
      data-bara-consimtamant=""
      className=
```

`globals.css`. Vechi, la finalul fișierului:

```css
  a[href^="http"]::after {
    content: " (" attr(href) ")";
    font-size: 0.75em;
    word-break: break-all;
  }
}
```

Nou:

```css
  a[href^="http"]::after {
    content: " (" attr(href) ")";
    font-size: 0.75em;
    word-break: break-all;
  }
}

/*
 * Bara de consimțământ: randată pe server, arătată din primul cadru.
 *
 * Scriptul de consimțământ (`analitice.tsx`) pune `data-consimtamant="cere"` pe
 * `<html>` la parsare, înaintea barei din DOM, când nu există o alegere. Fără
 * atribut — alegere deja făcută, sau JavaScript oprit, caz în care nici GA nu
 * rulează — bara nu se vede. La tipar o ascunde regula `data-tipar` de mai sus.
 */
[data-bara-consimtamant] {
  display: none;
}
:root[data-consimtamant="cere"] [data-bara-consimtamant] {
  display: block;
}
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/_componente/"
cd /srv/apps/ERP && pnpm typecheck && pnpm check:server && pnpm lint && pnpm test && pnpm exec prettier --check "src/app/(marketing)/_componente/consimtamant.ts" "src/app/(marketing)/_componente/analitice.tsx" "src/app/(marketing)/_componente/bara-consimtamant.tsx" "src/app/(marketing)/_componente/bara-consimtamant.test.tsx" src/app/globals.css
```

`tipar.test.tsx` (B5) caută bara cu `findByRole` după render. Acum o găsește imediat, deci rămâne verde.

- [ ] **Pasul 5: Verificare locală a HTML-ului de server și a stilului**, cu `pnpm dev -H 127.0.0.1 -p 3917` pornit:

```bash
curl -s http://127.0.0.1:3917/unelte | grep -c 'data-bara-consimtamant'
curl -s http://127.0.0.1:3917/unelte | grep -o "setAttribute('data-consimtamant','cere')"
```

Primul trebuie să dea `1`, al doilea să tipărească șirul. Apoi, în playwright, cu JavaScript activ, aceeași pagină trebuie să arate bara la 360 px într-o sesiune curată. Asta se vede pe captură: scriptul inline rulează și în `next dev`, deși hidratarea nu.

- [ ] **Pasul 6: Măsurarea LCP, după deploy.** Pe producție, CPU ×4, 360 px, cache oprit. Se folosește scriptul auditului: PerformanceObserver pe `largest-contentful-paint`, iar colectoarele se anulează ca la K12. Pe `/unelte` trebuie să iasă LCP ≤ 1,5 s. Dacă elementul LCP rămâne paragraful barei, timpul lui trebuie să fie la ±150 ms de FCP. Se raportează cifrele, nu concluzia.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
C="src/app/(marketing)/_componente"
CAI=("$C/consimtamant.ts" "$C/analitice.tsx" "$C/bara-consimtamant.tsx" "$C/bara-consimtamant.test.tsx" src/app/globals.css)
git status --short -- "${CAI[@]}"
git fetch origin main
git diff --name-only HEAD origin/main -- "${CAI[@]}"
git commit --only -m "perf(site): bara de consimțământ din primul cadru, nu după hidratare" -m "Serverul o randează mereu; scriptul de la parsare pune data-consimtamant=\"cere\" pe <html> când nu există alegere, iar CSS-ul o arată doar atunci. Pe hub, bara era elementul LCP la 3,7 s pe telefon." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "${CAI[@]}"
git merge origin/main
git push origin main
```

---

### Task K14: Distribuția uneltelor noi: indexare, LinkedIn, legături câștigate

Se face după ce utilizatorul confirmă deploy-ul lui K6–K13 prin `./administrativo.sh`. Nu e cod. Fiecare pas are o verificare.

**Fișiere:**
- Create: `docs/comercial/outreach-unelte.md` (lista și mesajul de mai jos)
- Create/Modify: fișierele pe care le scrie skill-ul `administrativo-postari` în `docs/comercial/linkedin/`

- [ ] **Pasul 1 (agent): indexarea paginilor noi.** Se repetă K5, Pașii 1–6, cu lista: `/unelte/calculator-zile-lucratoare`, `/unelte/cerere-demisie`, `/unelte/programare-concedii`, `/unelte/adeverinta-salariat`, `/unelte`, plus `/ghid/zile-libere`, `/ghid/concediu-de-odihna` și `/reges-online` (legături noi). `/unelte/programare-concedii` intră prima: cererea are vârf în noiembrie–decembrie, înaintea termenului din art. 148 alin. (1).

- [ ] **Pasul 2 (agent): postările de LinkedIn.** Se invocă skill-ul existent, nu se scriu postări de mână:

```
Skill administrativo-postari, args: "Lot nou de 5 postări, câte una pe unealtă, cu linkul direct spre unealtă (nu spre pagina de start) și UTM utm_source=linkedin&utm_medium=social&utm_campaign=t4-<nn>-<unealta>: (1) programarea concediilor de odihnă pe 2027 — termenul din art. 148 alin. (1), până la sfârșitul anului; (2) cererea de demisie cu ultima zi de preaviz calculată — întrebarea „zile lucrătoare sau calendaristice?”; (3) calculatorul de zile lucrătoare între două date; (4) adeverința de salariat fără CNP în formular; (5) cererea de concediu de odihnă cu zilele calculate. Imaginea fiecărei postări: captura modelului completat din public/capturi/unelte/ unde există. Nicio cifră legală care nu e scrisă pe pagina uneltei."
```

Verificare: fișierul de lot e scris în `docs/comercial/linkedin/` și are 5 postări. Fiecare are un link `https://administrativo.ro/unelte/<x>?utm_source=linkedin…` care răspunde 200 (`curl -s -o /dev/null -w "%{http_code}"`). Commit cu căile scrise de skill: `git commit --only -m "docs(linkedin): lotul uneltelor noi" -- docs/comercial/linkedin/<fișierele lui>`, apoi merge și push.

- [ ] **Pasul 3 (agent): lista de legături câștigate.** Se scrie `docs/comercial/outreach-unelte.md` cu conținutul de mai jos. Fiecare adresă a răspuns 200 pe 8 oct 2026 (`curl -L`), în afară de cele notate (rândurile 2 și 3, corectate la verificare). Înainte de scriere, comanda se reia pe toate opt: `for u in <adresele>; do curl -s -L -o /dev/null -m 30 -w "%{http_code} %{url_effective}\n" "$u"; done`, iar o adresă care nu dă 200 sau ajunge altundeva se notează în tabel. Trimiterea o face utilizatorul, pe rând, din adresa firmei.

```markdown
# Legături câștigate pentru uneltele gratuite

Scris pe 8 oct 2026. Nu cumpărăm legături și nu folosim directoare
(`vizibilitate-organica.md`, „Nu cumpărăm linkuri”). Fiecare țintă de mai jos are
deja o pagină la care unealta noastră adaugă ceva concret, așa că mesajul spune
CE adaugă, nu „vă rog un link”.

| # | Sit | Pagina lor | De ce ar trimite spre noi | Unealta |
|---|-----|------------|----------------------------|---------|
| 1 | contzilla.ro | https://www.contzilla.ro/7-calcule-utile-pentru-salariati/ | Listă de calcule pentru salariați, fără zile lucrătoare între date și fără preaviz | calculator zile lucrătoare, cerere de demisie |
| 2 | legislatiamuncii.manager.ro ⚠ | https://legislatiamuncii.manager.ro/ (la verificarea din 8 oct, de pe server: timeout 60 s, fără răspuns; se deschide din browser înainte de trimitere, iar dacă nu răspunde, rândul cade) | Modelul lor de condică „2025”, inspectat în auditul din 8 oct, trece 9:00–17:30 pe 6 și 7 ianuarie, care sunt sărbători legale. Le semnalăm greșeala, iar unealta noastră calculează zilele | condica de prezență |
| 3 | contabilul.manager.ro | https://contabilul.manager.ro/a/27611/foaia-de-parcurs-legislatie-ce-trebuie-sa-stie-firmele.html (adresa veche, `/a/6221/completare-foaie-de-parcurs.html`, redirecționează 301 aici; se recitește articolul înainte de mesaj) | Articol despre foaia de parcurs, fără model descărcabil | foaia de parcurs |
| 4 | hipo.ro | https://www.hipo.ro/locuri-de-munca/vizualizareArticol/3891/Cum-se-scrie-o-cerere-demisie-model-sfaturi-si-exemple | Articol cu „10 întrebări frecvente” despre demisie, fără calculul ultimei zile de preaviz | cerere de demisie |
| 5 | startupcafe.ro | https://www.startupcafe.ro/ | Presă pentru antreprenori: subiectul „unelte gratuite pentru firme mici, fără cont” | toate, prin `/unelte` |
| 6 | cariereonline.ro (Revista Cariere) | https://www.cariereonline.ro/ | Presă HR: programarea concediilor înaintea termenului din decembrie | programarea concediilor |
| 7 | fiscalitatea.ro | https://www.fiscalitatea.ro/ | Presă fiscală: calculatorul aplică suma neimpozabilă de 200 de lei și CAM pe baza diminuată (auditul: folositor.ro dă costul 4.422 în loc de 4.418) | calculatorul de salariu |
| 8 | contabilii din pilot (`vizibilitate-organica.md`, pasul D) | situl fiecărui cabinet | O pagină „Resurse pentru clienți” pe situl cabinetului | `/unelte` |

Cu ce NU ne adresăm: forumurile (avocatnet.ro) doar cu link. Acolo un răspuns
are sens doar dacă se citește complet în text, cu legătura ca supliment și cu
spus deschis că unealta e a noastră.

## Mesajul (se adaptează rândul al doilea pentru fiecare sit)

> Subiect: O unealtă gratuită pentru articolul despre <subiect>
>
> Bună ziua,
>
> Am citit <titlul paginii lor> și am observat că <ce lipsește sau ce e greșit,
> într-o propoziție concretă — de exemplu: „modelul de condică pe 2025 trece ore
> lucrate pe 6 și 7 ianuarie, care sunt sărbători legale din martie 2023”>.
>
> Am făcut o unealtă gratuită, fără cont și fără e-mail, care <ce face, într-o
> propoziție — de exemplu: „calculează ultima zi de preaviz în zile lucrătoare,
> cu sărbătorile legale, și dă cererea de demisie în Word”>:
> <adresa uneltei>
>
> Dacă vi se pare utilă cititorilor, ne-ar bucura o trimitere din articol. Dacă
> nu, măcar corectura de mai sus vă poate folosi.
>
> Cu stimă,
> <numele>, Administrativo (WISELEARNING S.R.L., Timișoara)
```

(Corectat la verificare, 8 oct 2026: prima versiune semna cu o denumire de firmă care nu există nicăieri în repo. Furnizorul e cel din `src/content/landing/contact.ts`, `FIRMA.denumire`, copiat din `public.organizations`, CUI 50321210. Înainte de scriere se recitește `grep -n 'denumire' src/content/landing/contact.ts`.)

Verificare: `grep -c '^| [0-9]' docs/comercial/outreach-unelte.md` dă 8. Commit `docs(comercial): lista de legături câștigate pentru unelte`, cu `--only`, apoi merge și push.

- [ ] **Pasul 4 (agent, la 4 săptămâni după indexare): regula de decizie pe uneltele noi.** Din `docs/comercial/cuvinte-cheie-progres.md`, pe termenii adăugați în K7–K10:
  - termen cu afișări pe poziția > 20, după 4 săptămâni: se adaugă o întrebare nouă pe pagină, pe forma exactă căutată (din completarea automată), plus o legătură internă în plus dintr-un ghid;
  - termen pe poziția ≤ 10 cu ≥ 50 de afișări și CTR 0: se rescrie descrierea în `seo-unelte.ts`, cu taskul K1 ca model;
  - termen fără afișări: nu se face nimic încă. Absența la 4 săptămâni, pe un domeniu fără legături din afară, nu e un semnal.

---

## Review Focus

Cazuri pe care testele de mai sus nu le-ar fi prins fără adăugările indicate. Fiecare mușcă un om real.

1. **Demisia depusă sâmbătă sau duminică.** Firmele mici primesc cereri și în weekend, pe WhatsApp, apoi le înregistrează. Dacă numărătoarea ar porni din ziua depunerii, ultima zi ar ieși cu una mai devreme. → K6: `aNaZiLucratoareDupa("2026-10-11", 1) === "2026-10-12"`. K8: `calculeazaPreaviz("2026-10-11", 1).ultimaZi === "2026-10-12"`.
2. **Titlul cu anul, în decembrie și în ianuarie.** `{an}` și `{an-programare}` sunt evaluate la cerere. O constantă `metadata` le-ar fi înghețat la build, iar „Programare concedii 2026” ar fi rămas în titlu în noiembrie 2026, exact în vârful căutării. → K1: testul pe patru zile (inclusiv `2026-12-31`, `2035-12-31`). K9: cazurile `2026-10-08 → 2027` și `2026-03-01 → 2026`. K6: `anulProgramarii("2026-09-30") === 2026` și `("2026-10-01") === 2027`.
3. **Salariul scris românește în adeverință.** „4.325” citit ca 4,325 lei ar ajunge pe un document semnat. E același defect găsit în calculator, la C1. → K10: `citesteSuma` pe 7 forme bune și 6 rele, plus documentul cu „4.325 lei”.
4. **Fereastra privată, unde `localStorage` aruncă.** Bara trebuie să apară, iar GA nu trebuie să se încarce pe unelte. Altfel omul nu poate refuza, sau GA pornește fără niciun accept. → K13: testul cu `Storage.prototype.getItem` care aruncă. K12: `acceptulSalvat` întoarce `false` la excepție, iar „pe o unealtă, fără alegere” rămâne 0.
5. **Un preaviz care iese din calendar.** O cerere depusă în decembrie 2035, cu 45 de zile, ar fi primit fără gardă o „ultimă zi” calculată fără sărbătorile din 2036 sau un 500. → K6: `aNaZiLucratoareDupa("2035-12-20", 20)` aruncă. K8: ruta dă 400 cu motivul (`route.test.ts`), iar pagina arată mesajul în loc de document.
