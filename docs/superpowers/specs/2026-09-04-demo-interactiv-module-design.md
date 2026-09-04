# Demo interactiv per modul — „prin geam"

**Data:** 2026-09-04 · **Abordare aprobată:** vitrină pe rută proprie, încadrată, cu
ecrane extrase oportunist · **Status:** spec, neimplementat

---

## 1. Problema, în cuvintele utilizatorului

> „La fiecare pagină din asta de prezentare să punem o mică randare într-un box așa
> undeva într-un chenar a paginii reale (ca atunci când dau modificări să se modifice și
> chenarul ăla) și poate dacă dau click acolo să mi se deschidă un pop-up cu pagina pe
> ecran și să pot interacționa cu ea, dar datele de acolo să fie valabile doar în sesiunea
> aia în browser, să nu se salveze nicăieri. […] asta cu /leave mi se pare că arată așa
> slab, cheap, nu-mi atrage ochii cu nimic."

Trei cerințe și una meta:

- **(a)** chenar cu randare reală în pagina de prezentare;
- **(b)** popup pe tot ecranul, interactiv;
- **(c)** date valabile doar în sesiunea de browser, nesalvate nicăieri;
- **(meta)** „când modific aplicația, se modifică și chenarul".

Plus o a doua lucrare, independentă: **refacerea vizuală a paginilor de modul**.

## 2. Ce s-a măsurat

Totul de mai jos e verificat în sesiune, cu fișier:linie. Ce n-a fost verificat e marcat
explicit în §11.

### 2.1 Cât de subțire e pagina de azi

`curl` pe `https://administrativo.ro/module/leave` → 200, **63 471 de octeți**. Din ei,
conținutul unic al paginii e **sub 60 de cuvinte**: supratitlu, `<h1>`, o frază, trei
puncte, un paragraf de preț. Restul e antet, subsol și registrul modulelor vecine —
identic pe toate cele nouăsprezece pagini.

Măsurat independent: **227 de cuvinte în `<main>`, din care 47 (20,7 %) despre concedii.**
Celelalte 150 sunt textele **altor** module, copiate din catalogul `/module`. Șase din
cele opt titluri ale paginii sunt numele altor module — centrul de greutate al paginii e
ușa de ieșire, nu subiectul.

Cauza e structurală, nu cosmetică: **`/module/[modul]` e singura pagină de pe sit fără
conținut propriu.** Celelalte compun benzi (23 de componente `Banda*` în
`_componente/benzi/`) alimentate dintr-un obiect de conținut tipat. Pagina de modul
citește _intrarea din catalog_ (`RO.module.grupuri`) — un text scris ca să fie scanat
într-o listă de nouăsprezece, nu citit ca pagină.

Pagina știe despre ea că e provizorie. `module/[modul]/page.tsx:31-36`:

> „Paginile astea sunt încă subțiri: două-trei propoziții și trei puncte […] Intră în
> sitemap când fiecare primește text propriu."

Lipsesc și mijloacele proprii ale sitului: banda principală n-are nici supratitlu, nici
titlu, nici lead (`page.tsx:92`); punctele nu folosesc `RandRegistru`, deși vecinii de
dedesubt îl folosesc; nu există **nicio bandă de cerneală**, deci zero contra-ritm — exact
mecanismul pe care `banda.tsx:6-9` îl declară purtătorul ritmului paginii.

### 2.2 Ce blochează încadrarea aplicației

| Fapt                                                                                      | Dovadă                                       |
| ----------------------------------------------------------------------------------------- | -------------------------------------------- |
| Nu există nicio directivă CSP în tot repo-ul; `next.config.ts` nu declară cheia `headers` | grep gol pe `Content-Security-Policy`        |
| Singurul antet de încadrare e `X-Frame-Options: SAMEORIGIN`                               | `deploy/nginx/30-administrativo.ro.conf:113` |
| Deci un `<iframe>` de pe **același origin** e permis                                      | ↑                                            |
| `estePublica()` acceptă „/" plus 22 de prefixe scrise de mână; orice altceva ia 307       | `src/proxy.ts:41-83`                         |
| Layout-ul `(app)` face `resolveTenant()` și, fără sesiune, `redirect("/autentificare")`   | `src/app/(app)/layout.tsx:28-38`             |
| `resolveTenant` e `import "server-only"` — nu poate intra într-un bundle de client        | ↑                                            |

**Concluzie:** `<iframe src="/concedii">` de pe pagina publică afișează formularul de
login. Nu antetul e vinovat — proxy-ul și redirectul din layout sunt.

### 2.3 Ce se poate refolosi (mai mult decât părea)

| Fapt                                                                                               | Dovadă                                     |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **Niciun** fișier din `src/components/` nu importă `server-only` — tot kitul UI rulează în browser | grep gol                                   |
| **`src/domain/` e curat 100 %** — regulile reale rulează în browser                                | grep gol pe `server-only` în `src/domain/` |
| `GrilaCalendar` și `PlanificatorConcedii` sunt **pure**, cu props serializabile                    | `calendar/grila-calendar.tsx:134`          |
| Există deja un test care le randează din fixture-uri                                               | `calendar/planificator-concedii.test.tsx`  |
| **`calendar/page.tsx` e DEJA adaptorul** cerut de abordarea aleasă                                 | `calendar/page.tsx:101-188`                |
| **O singură** componentă ne-pagină din tot `(app)` își aduce singură datele                        | `concedii/tabel-cereri.tsx:13,51,63-69`    |
| `Formular` primește deja acțiunea ca prop — punctul de injecție există                             | `src/components/ui/formular.tsx:61`        |
| Marketingul importă azi **o singură** componentă din aplicație (`Inel`)                            | `_componente/viniete.tsx:3`                |

### 2.4 Ce costă (cifre numărate personal, după ce doi agenți au dat trei valori diferite)

| Măsură                                                                  | Valoare |
| ----------------------------------------------------------------------- | ------- |
| Componente client în `(app)` (`^"use client"` strict)                   | **234** |
| Fișiere care importă `./actions` sau `../actions`                       | **128** |
| …dintre care componente client                                          | **124** |
| Apeluri `router.refresh()` în `(app)`                                   | **124** |
| Chei de modul în `ro.ts` = chei în `FEATURE_KEYS` (fără nicio deviație) | **19**  |

Ultima cifră contează: nu există azi „modul vândut, neconstruit" și nici invers.

### 2.5 Coliziunile de mediu

| Ce se sparge                                                                          | Dovadă                                                                                               |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Fontul de cifre al aplicației (`monoCifre`) **nu e montat** în layout-ul de marketing | montat în `(app)/layout.tsx:127`, `(portal)/layout.tsx:70` și `(platform)`; absent din `(marketing)` |
| `.mk :focus-visible` repictează inelul de focus al oricărui descendent                | `globals.css:690`                                                                                    |
| `.mk input:-webkit-autofill` pictează câmpurile cu hârtia rece                        | `globals.css:674-682`                                                                                |
| Regula de 16px pe atingere e **opt-in prin `[data-zona]`** (deci se poate activa)     | `globals.css:985-989`                                                                                |
| Cele 19 pagini sunt prerandate static și n-au azi nicio linie de JS propriu           | `module/[modul]/page.tsx:50`                                                                         |

Toate cinci dispar dacă demo-ul trăiește într-un **document propriu** (iframe), cu layout
propriu. Asta e argumentul decisiv pentru rută separată, nu pentru montare în pagină.

### 2.6 Defect descoperit pe drum — situl minte, în două limbi

`ro.ts:245` și `en.ts:225` promit, pe pagina modulului `leave`:

> „iar **jumătățile de zi** de la capete se numără corect"
> „and **half days** at either end are counted correctly"

`0112_concediu_doar_zi_intreaga.sql:51-56` adaugă două constrângeri `check` care
**interzic** orice altceva decât `zi_intreaga`, pe `leave_requests` și pe
`leave_request_days`, plus o a treia (`:415`) care scoate rotunjirea pe jumătăți din
`leave_types`. `app.numara_zile_lucratoare` și-a pierdut cei doi parametri, iar
`numaraZileCerere` întoarce de acum întotdeauna un întreg.

**Funcția a fost scoasă din produs; textul de vânzare a rămas.** Fraza e chiar acum în
HTML-ul servit de producție. Reparația intră obligatoriu în pasul 0.

Descoperirea vine din citirea paginii de vault (`.claude/docs/modul/concedii.md`), nu din
sweep-ul prin cod — exact ce prescrie `CLAUDE.md`.

## 3. Ce s-a decis cu utilizatorul

| Întrebare                  | Decizie                                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Limba vizuală a chenarului | **„Prin geam"** — aplicația reală, la scară mică, în passe-partout cu rigla sitului; popup la culoare plină |
| Atingem codul din `(app)`? | **Da** — ecranele se sparg în „pagină = authz + citiri" și „ecran = props"                                  |
| Adâncimea demo-ului        | **Răsfoire + scriere în memorie**, pentru **toate** modulele, pas cu pas                                    |
| Ordinea                    | **Felia verticală pe `leave` întâi**, apoi conținutul celorlalte 18                                         |
| Ecranul lui `leave`        | **Calendarul în chenar**, modulul întreg (calendar + cereri + echipă + formular) în popup                   |
| Comutator de rol           | **Da, de la primul modul**                                                                                  |

### 3.1 Nuanța care schimbă costul

Verdictul de recunoaștere estima abordarea „ecran extras" la 1–2 săptămâni pentru primul
modul. **Pentru ecranul ales, extragerea e ca și făcută:** `calendar/page.tsx:101-188`
aduce datele și le transformă în `zileHarta`, `celule`, `zile`, apoi le predă lui
`PlanificatorConcedii`, care e pur și are test de randare.

De aici, regula de proiectare adoptată: **nu spargem toate cele 19 module în avans.**
Spargem ecranul **când îi vine rândul la demo**. Mașinăria se construiește o dată;
extragerea e o taxă per ecran demonstrat, nu un proiect separat de refactorizare.

## 4. Arhitectura — mașinăria (o singură dată)

```
src/app/(vitrina)/vitrina/[modul]/…     rute publice, noindex, în afara sitemap-ului
src/demo/lume/                          firma fictivă, comună tuturor modulelor
src/demo/depozit.ts                     stare în sessionStorage
src/demo/actiune.ts                     fabrică de acțiuni false, forma ActionResult<T>
src/demo/roluri.ts                      comutatorul, peste harta reală de permisiuni
src/app/(marketing)/_componente/prin-geam.tsx    banda: iframe leneș + passe-partout + popup
```

**De ce rută proprie și iframe, nu montare în pagină.** Un document propriu rezolvă
dintr-o lovitură toate cele cinci coliziuni din §2.5: montează `monoCifre`, scapă de
`.mk`, își pune `data-zona`, ține bundle-ul complet în afara celor 19 pagini prerandate —
și păstrează **starea-din-URL funcțională înăuntru**. Filele, luna, sortarea și paginarea
sunt `<Link>` și `<form method="get">`; într-un demo montat direct în pagina de marketing,
fiecare clic ar naviga _în afara_ demo-ului, spre o rută protejată.

Bonus: `/vitrina/leave` e o pagină de sine stătătoare, care se poate trimite pe e-mail
unui prospect. Un chenar îngropat într-o pagină nu e.

**Costul de intrare:** o linie în `RUTE_PUBLICE` (`proxy.ts:41`). Poarta din
`continut.test.ts:336-374` citește lista aia **ca text** și cade dacă un link intern din
conținut duce spre o rută neînregistrată — deci uitarea e prinsă, nu tăcută.

### 4.1 Chenarul și popup-ul

Chenarul mic: `<iframe loading="lazy" tabindex="-1">` într-o `<figure>` cu
`aspect-ratio` **fix** (fără el, CLS garantat), scalat cu `transform`, `pointer-events:
none`, în passe-partout desenat cu rigla sitului — nu cu chenar complet și nici cu umbră.
Vocabularul sitului interzice explicit cardurile și umbrele (`registru.tsx:5-14`); un
chenar cu umbră ar fi vizibil străin.

Popup-ul: al doilea iframe, creat la deschidere, în `<dialog>`.

**Capcane cunoscute, de tratat explicit** (memoria proiectului, `erp-popover-inset-ua`):
`<dialog>` modal își pierde `margin:auto` prin preflight-ul Tailwind, iar `popover`
primește `inset:0` + `fit-content` din foaia browserului. În plus, `dialog.tsx:12-23`
folosește `showModal()` și **top layer** — un `<dialog>` de marketing peste unul al
aplicației stivuiește două elemente în top layer. `Esc` apăsat înăuntrul iframe-ului nu
ajunge la părinte fără `postMessage`; iframe-ul cere `title` și o cale de ieșire cu
tastatura.

### 4.2 Datele — o singură firmă fictivă, nouăsprezece ferestre

`scripts/demo/seed-demo.mjs` conține deja lumea: patru departamente, cinci posturi cu
salarii, colegi cu nume românești, cinci conturi pe roluri. O **ridicăm din script într-un
modul de date pur** (`src/demo/lume/`), iar fixture-ul fiecărui modul devine o _proiecție_
a ei.

Câștigul nu e doar de efort, e de credibilitate: **același Popescu Ion apare în pontaj, în
concedii și pe fluturaș.** Nouăsprezece seturi independente ar fi arătat ca nouăsprezece
capturi de pe site-uri diferite.

Tipurile fixture-urilor sunt **interfețele reale** din `src/lib/queries/` (`RandCerere`,
`RandAngajat`), nu copii. Un prop nou obligatoriu cade la `tsc`.

**Ancorarea la „azi" e obligatorie.** `calendar/page.tsx:74` folosește `todayInBucharest()`
și marchează coloana zilei curente. Un fixture cu date literale („12 mai") arată o lună
moartă peste trei luni — demo-ul îmbătrânește tăcut pe pagina publică, fără nicio eroare.
Lumea se generează **relativ**: „cererea lui Popescu începe peste 4 zile".

### 4.3 Scrierile — în memorie, prin regulile reale

Acțiunile false se injectează prin `Formular`, care primește deja
`actiune: (date: FormData) => Promise<ActionResult<T>>` (`formular.tsx:61`). Pentru
`leave`, propul se urcă prin `FormularCerereNoua` → `DialogCerereNoua` → apelant.

Calculul **nu se rescrie**: zilele lucrătoare, soldul, lanțul de aprobare vin din
`src/domain/`, care rulează în browser. Demo-ul calculează cu regulile reale, deci nu poate
minți despre ele.

**Problema celor 124 de `router.refresh()`:** într-un demo fără server, refresh-ul e no-op
— omul apasă „Trimite", acțiunea falsă reușește, ecranul nu se schimbă. Asta e exact clasa
de defect tăcut pe care proiectul o vânează. Soluția: starea trăiește în depozit, iar
scrierea falsă mută depozitul → React re-randează. `router.refresh()` rămâne no-op
inofensiv.

Persistență: `sessionStorage`, deci reîncărcarea păstrează, iar închiderea filei uită.
Nimic nu pleacă spre server. Cerința (c) e satisfăcută prin construcție, nu prin disciplină.

### 4.4 Comutatorul de rol

Trei butoane în popup: **Administrator / Manager / Angajat**. Același ecran, alte drepturi.
Pentru un produs în care izolarea _e_ produsul, vizitatorul o **vede**, nu o citește.

Comutatorul **nu-și inventează matricea**. Trece prin harta reală de permisiuni din
`src/config/permissions.ts`, iar adevărul rămâne seed-ul din `0002_authz.sql`. Precedentul
e în casă: `matrice-roluri.test.ts` parsează migrarea și cade dacă o celulă nu mai
corespunde. Comutatorul primește aceeași poartă.

Ce trebuie să spună corect, din `.claude/docs/modul/concedii.md`:

- `employee` are `leave:read = own` — își vede doar cererile lui;
- `manager` are `leave:approve = team`, deci vede butonul de decizie;
- `/concedii` **redirectează** cine vede echipa spre `/concedii/calendar` (`page.tsx:98`)
  — deci „ecranul modulului" diferă după rol, iar demo-ul trebuie să arate asta, nu s-o
  ascundă.

## 5. Arhitectura — per modul (× 19, pas cu pas)

1. **Extrage `Ecran<Modul>`** din `page.tsx` — `page.tsx` păstrează `requireTenant` +
   citirile și deleagă. La `leave/calendar`, e deja făcut.
2. **Fixture** — o proiecție a lumii comune, tipată pe interfețele reale.
3. **Injectează acțiunea** unde modulul scrie.
4. **Un test de randare** — poarta anti-minciună (§6).
5. **Conținut propriu de pagină** — §7.

## 6. Poarta anti-minciună

Situl are o cultură: tot ce e bogat e păzit de un test care compară cu sursa reală —
`foaia-date.test.ts` contra `sarbatoriAnului()`, `matrice-roluri.test.ts` contra
`0002_authz.sql`. Un demo cu date fabricate **nu are, din oficiu, o astfel de poartă.**

Precedentul care arată ce se întâmplă fără ea e chiar în viniete: `culoareVar:
"--color-primary"` a trimis un **nume** de proprietate în loc de valoare, CSSOM a aruncat
declarația și inelul s-a desenat **invizibil în producție**, fără nicio eroare.

Poarta, în trei straturi:

1. **Typecheck** — aplicația și vitrina randează aceeași componentă; un prop nou
   obligatoriu face vitrina să nu compileze. Structural, nu prin disciplină.
2. **Test de randare per ecran demonstrat**, pe tiparul `planificator-concedii.test.tsx`:
   ecranul se montează din fixture și afirmă că randează conținut, nu gol.
3. **Test de adevăr al comutatorului** — celulele de rol din demo se compară cu
   `permissions.ts`, pe tiparul `matrice-roluri.test.ts`.

## 7. Refacerea paginii de modul (lucrare independentă, toate cele 19)

> **⚠ COLIZIUNE DE SESIUNI, 2026-09-04 18:25.** Secțiunea asta e **deja în construcție de
> altcineva.** `src/content/landing/fise-module.ts` (484 de linii, scris la 18:24) și
> `src/app/(marketing)/module/[modul]/page.tsx` (18:25) sunt necomise în arbore, iar
> structura lor converge independent cu cea propusă mai jos:
>
> | Ce propuneam aici     | Ce există deja în `fise-module.ts`                      |
> | --------------------- | ------------------------------------------------------- |
> | ③ „Ce face, concret"  | `intro: readonly string[]` — proză proprie              |
> | ④ „Cine ce poate"     | `actiuni: readonly ActiuneModul[]` — matricea per modul |
> | ⑤ „Ce NU face"        | `nuFace: readonly string[]`                             |
> | titlu/meta proprii    | `titluPagina`, `metaDescriere`                          |
> | legături între module | `legaturi`                                              |
>
> Acoperă azi **5 module** din 19 (`attendance`, `ssm`, `payroll`, `fleet`, `per_diem`) și
> citește domeniile din `public.role_permissions`, nu din `permissions.ts` — decizia
> corectă, mai strictă decât ce propusesem eu.
>
> **Consecință pentru specificația asta:** §7 NU se implementează separat. Banda
> `PrinGeam` (②) se montează **peste** structura lui `fise-module.ts`, iar `FisaModul`
> primește un câmp opțional pentru ecranul demonstrat. Tabelul de mai jos rămâne ca
> descriere a formei finale a paginii, nu ca plan de lucru propriu.

Structura propusă, în vocabularul existent:

| #   | Bandă                  | Sursă                                                              |
| --- | ---------------------- | ------------------------------------------------------------------ |
| ①   | `AntetSecundar`        | există                                                             |
| ②   | **`PrinGeam`**         | NOU — chenarul; **opțională**, lipsește curat unde nu există demo  |
| ③   | **„Ce face, concret"** | NOU — conținut propriu, `Registru`, 4–6 rânduri cu mecanismul real |
| ④   | **„Cine ce poate"**    | NOU — felie per modul din matricea de roluri, legată de migrare    |
| ⑤   | **„Ce NU face"**       | NOU — banda de onestitate, pe **cerneală** (contra-ritmul lipsă)   |
| ⑥   | Cât costă              | există                                                             |
| ⑦   | Din același grup       | există, se scurtează                                               |

Conținutul nou intră în `ContinutLanding` ca structură tipată, ca tot restul sitului —
deci o cheie lipsă e eroare de compilare, nu text lipsă pe ecran.

**Paginile intră în sitemap după refacere.** Condiția scrisă în `page.tsx:31-36` — „când
fiecare primește text propriu" — devine îndeplinită. `harta.ts` listează azi doar
`/module`.

Paginile de modul sunt **doar în română**: `/en` are doar `page.tsx` și `preturi/`.
Conținutul nu se dublează. Fraza despre jumătățile de zi trebuie totuși reparată **și în
`en.ts:225`**, fiindcă apare în catalogul de pe `/en`.

## 8. Ordinea de livrare

> **⚠ Ordinea aprobată de utilizator („felia pe `leave` întâi, apoi conținutul") a fost
> depășită de evenimente:** pasul 1 e deja început de altă sesiune (§7). Cele două lucrări
> ating același fișier — `module/[modul]/page.tsx` — deci nu pot merge orb în paralel.
> Decizia revine utilizatorului; varianta cu cel mai mic risc de călcare e ca pasul 0 să
> **aștepte** ca sesiunea cealaltă să-și comită fișele, apoi să monteze banda `PrinGeam`
> peste ele.

| Pas    | Ce                                                                                                                              | De ce aici                                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **0**  | Mașinăria + lumea fictivă + `leave` cap-coadă (conținut nou, demo, comutator de rol) + reparația frazei despre jumătățile de zi | Un modul dus până la capăt scoate la iveală ce n-am prevăzut, cât e ieftin de schimbat. Ecranul ales e deja spart.                                     |
| **1**  | Conținut propriu pentru toate cele 19 pagini, fără demo; intrarea în sitemap                                                    | Scoate situl din „uniform-sărac". Se face **după** ce forma paginii e validată pe `leave`, ca să nu rescriem 19 pagini într-un șablon care se schimbă. |
| **2**  | Demo pentru `attendance`                                                                                                        | Argumentul comercial nr. 1, iar situl are deja `Foaia` ca semnătură                                                                                    |
| **3+** | Restul, în valuri de 3–4                                                                                                        | După ce măsurăm ce a costat efectiv pasul 0                                                                                                            |

## 9. Cele două module care nu intră în tipar

- **`asistent` nu are pagină de randat** — e un overlay montat din `(app)/layout.tsx:188`,
  nu o rută. Va cere alt tratament sau rămâne fără chenar.
- **`nucleu` nu e un ecran, sunt șapte directoare** (`angajati/`, `departamente/`,
  `organigrama/`, `puncte-lucru/`, `registru/`, `setari/`, `documente/`; ~19 900 de linii,
  inclusiv cel mai mare director din tot ERP-ul). „Ecranul reprezentativ" al nucleului e o
  decizie de produs, amânată până la pasul 3.
- **`employee_portal`** trăiește în alt route group (`(portal)`), cu alt layout și alt
  flux de autentificare. Va cere fie un al doilea mecanism de randare, fie o unificare.
- **`kpi`** nu are director propriu: e subdirector al lui `evaluari/`, cu
  `requireFeature("kpi")` propriu.

## 10. Ce se rupe și cum îl prindem

| Risc                                                      | Cum îl prindem                                                                   |
| --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Demo-ul divergează tăcut de aplicație                     | aceeași componentă în ambele → `tsc`; plus test de randare (§6)                  |
| Fixture cu dată literală îmbătrânește pe pagina publică   | generare relativă la `todayInBucharest()`; test care afirmă „luna e cea curentă" |
| `router.refresh()` no-op face demo-ul mut la scriere      | starea în depozit, nu în server; test care afirmă că lista crește după scriere   |
| Bundle-ul intră în cele 19 pagini prerandate              | demo-ul e în alt document; chenarul e iframe leneș, nu import                    |
| CLS pe pagina publică                                     | `<figure>` cu `aspect-ratio` fix                                                 |
| Rută de demo uitată din `RUTE_PUBLICE` → 307 pentru robot | poarta din `continut.test.ts:336-374`                                            |
| Demo-ul citit drept captură reală de la un client         | marcaj explicit, pe tiparul „exemplu" din `viniete.tsx:16-18`                    |
| Comutatorul de rol minte despre permisiuni                | test contra `permissions.ts` / `0002_authz.sql`                                  |
| `<dialog>` peste `<dialog>`, top layer, `Esc` în iframe   | tratate explicit la implementare; capcane deja cunoscute                         |

## 11. Ce NU s-a verificat

- **Nu s-a rulat nimic**: nici `pnpm build`, nici `pnpm test`, nici un browser. Toate
  afirmațiile despre bundle, LCP, CLS și hidratare sunt deduceri din citirea codului.
- Nu s-a confirmat cu `curl` pe producție că nginx chiar servește `X-Frame-Options:
SAMEORIGIN`, și nu se știe dacă în fața lui stă un strat (Cloudflare) care ar adăuga un
  CSP cu `frame-ancestors`. Confirmat e doar că **în repo** nu există nicio directivă CSP.
- Nu se știe cât cântărește azi o pagină `/module/[modul]` — nu s-a măsurat niciodată în
  proiect.
- Nu s-a probat că `Tabel` funcționează într-un arbore pur client: importă `RandTabel`
  (`"use client"`, `useRouter`) și `SenzorLink` (`useLinkStatus`, care cere descendent de
  `<Link>`).
- Nu se știe dacă `reactCompiler: true` schimbă ceva la montarea componentelor din `(app)`
  în graful de marketing.
- **Comportamentul de client nu se poate proba local**: memoria proiectului spune că
  `next dev` nu hidratează în acest mediu. HTML și CSS se verifică; interacțiunea se
  declară **neverificată** până la o probă pe producție.
- S-a inspectat **doar** modulul `leave`. Pentru celelalte 18 nu se știe dacă au frunze
  pure ca `PlanificatorConcedii` sau piese care își aduc singure datele. Verificat global e
  doar că `TabelCereri` e singura componentă ne-pagină din tot `(app)` care cheamă
  `createServerSupabase`.

## 12. Abordarea respinsă, și de ce

**Organizație-demo reală în Supabase + sesiune efemeră.** Ar fi singura variantă în care
chenarul _e_ literalmente aplicația, cu cost aproape zero per modul — toate cele 19
deodată, inclusiv `employee_portal` și `asistent`.

Respinsă pentru că fiecare scriere ar trece prin `createAction` și ar ajunge în Postgres,
cu audit append-only, **într-o bază care e aceeași pentru dezvoltare și producție**
(memoria proiectului: `.env.local` și `.env.production` arată către același proiect
Supabase). Ar contrazice frontal cerința (c), și ar pune un cont autentificat pe o pagină
publică indexabilă.

Cerința (c) nu e o preferință a utilizatorului. E exact ce face demo-ul sigur.
