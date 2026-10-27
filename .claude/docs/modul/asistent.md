---
tip: modul
titlu: Asistent AI
aliases: [asistent, chat, bula]
cai:
  - "src/lib/asistent/**"
  - "src/components/asistent/**"
  - "src/app/api/asistent/route.ts"
  - "src/schemas/asistent.ts"
tabele: [features, organization_features]
permisiuni: [leave:read, employees:read, vehicles:read, trip_sheets:read, trip_sheets:create]
feature: asistent
capcane: []
citeste_daca:
  - "bula nu apare nicăieri → verifică ÎNTÂI cele două comutatoare, secțiunea „Ce refuză baza tăcut”"
  - "bula e în DOM dar nu se vede pe ecran → învelișul flotant s-a strâns la 0×0; același loc"
  - "o pastilă duce în 404 → imposibil prin construcție; citește „Lista închisă”"
scris_pe: 773c1627da87c388355631aa7419448022014599
scris_la: 2026-10-27
tags: [modul, nucleu]
---

# Asistent AI

Bulă flotantă în dreapta-jos, în ambele zone. Răspunde la „unde se face X?”, explică
drumul de click și dă butonul care duce acolo dintr-un singur clic. Pentru câteva clase de
întrebări (concediu, ce e de aprobat, fișa unui om, parcul auto) citește și date reale, sub
RLS-ul celui care întreabă.

**Read-only, prin proiectare.** Nu depune cereri, nu aprobă, nu șterge. Explică și
trimite; omul apasă. Asta scoate din discuție toată clasa de defecte „modelul a apăsat
butonul greșit”, și e motivul pentru care modulul n-are nicio Server Action.

## Paginile modulului

| Pagină                          | Ce ține                                                       |
| ------------------------------- | ------------------------------------------------------------- |
| [[modul/asistent/unelte]]       | filtrarea indexului pe permisiuni, uneltele de date, citirile |
| [[modul/asistent/unelte-flota]] | uneltele de parc auto (F12e), poarta dublă, „cine are mașina” |

## Lista închisă — de ce nu poate trimite într-un 404

Modelul **nu are voie să scrie o adresă**. Nu primește niciun href în prompt
(`prompt.test.ts` verifică exact asta). Primește o listă de identificatori și poate doar
să aleagă unul, scriindu-l ca marcaj — forma exactă e în `src/lib/asistent/marcaje.ts`.
Href-ul, eticheta, iconița și drumul de click le desenează aplicația, din `NAV_ITEMS`.

Un identificator inventat nu produce un link greșit: `marcaje.ts` nu-l găsește în index și
**aruncă marcajul tăcut**. Cel mai rău rezultat posibil al unei halucinații e o frază fără
pastilă lângă ea. Regexul de marcaj e permisiv la potrivire tocmai ca un identificator
scris greșit — majuscule, gol — să fie tot înghițit, nu randat ca text brut sub ochii
omului.

`destinatii.ts` ține indexul, scris de mână fiindcă `descriere` — „ce faci pe ecranul
ăsta” — nu se poate genera. Împotriva îmbătrânirii tăcute stă `destinatii.test.ts`:
parcurge arborele de rute de pe disc și cere ca fiecare rută statică să fie ori în index,
ori în `EXCLUSE` cu motiv scris.

Un `href` poate purta și parametru de interogare, fiindcă unele formulare au devenit casete
deschise din URL (`/mentenanta/echipamente?echipament=nou`). „Nu trimite în gol” compară
doar **calea**; „fiecare rută e acoperită” compară `href`-ul **întreg** — deci pagina de
redirect rămasă pe disc pentru autocolantele QR tipărite pe partea de portal intră în
`EXCLUSE`, cu motiv.

Testul citește însă doar arborii `src/app/(app)/` și `src/app/(portal)/`. Adresa de pe
autocolantele utilajelor stă în `src/app/(scanare)/`, deci nu e nici candidată la index,
nici rând în `EXCLUSE` — motivul e un comentariu în `destinatii.ts`, în locul rândului.

## Rute și cine ajunge

Modulul n-are pagini proprii. Are o singură rută de API și două puncte de montare.

| Rută            | Poartă                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------ |
| `/api/asistent` | cheie de mediu → `resolveTenant` → modul `asistent` → limite de rată → Zod → hartă de permisiuni |

Ordinea nu e negociabilă și e comentată în `src/app/api/asistent/route.ts`: cheia lipsă
răspunde **404 înaintea autentificării** (o rută oprită nu-și anunță existența), iar
limitele vin înaintea oricărui apel extern, altfel exact abuzul pe care ar trebui să-l
oprească e cel care costă bani.

Zona nu se ia pe cuvânt de la client: rolul `employee` e forțat pe `portal`, restul pe
`app`. Poarta din layout-uri, repetată — fiindcă layout-ul nu e o barieră de securitate.

## Al doilea client: viziunea

`src/lib/asistent/viziune.ts` — o imagine plus o schemă JSON, un răspuns structurat,
dintr-o bucată. Stă aici fiindcă împarte cu asistentul cheia și modulul, dar **nu e o
unealtă** și nu trece prin bucla de chat: singurul apelant e citirea bonului de
combustibil, `src/app/(app)/flota/bon/actions.ts`. Separat de `openrouter.ts` deliberat —
acela e scris pentru flux, iar lărgirea mesajului lui la conținut multimodal ar fi atins
bucla asistentului; se reutilizează doar adresa, exportată ca `ENDPOINT_OPENROUTER`.

Fără flux, antetele vin abia după generare, deci `fetchCuTermen` — care taie la antete —
ar tăia orice citire: aici termenul e pe tot răspunsul. Ca `deschideFlux`, funcția **nu
aruncă niciodată**: întoarce un motiv și un mesaj pentru om, care completează manual.
Corpul exact trimis e fixat de `viziune.test.ts`, inclusiv ce NU se trimite.

## Ce refuză baza tăcut

- **Două comutatoare independente, ambele tăcute.** Modulul `asistent` stins pentru firmă
  ⇒ ruta răspunde 404 și bula nu se randează în niciun layout. `OPENROUTER_API_KEY` goală
  ⇒ același 404, indiferent ce scrie în `organization_features`. Când bula lipsește,
  ăsta e primul lucru de verificat, nu codul.
- **Confidențialitatea cerută poate rămâne fără niciun furnizor.** Citirea bonului cere
  Zero Data Retention și refuz de colectare, iar endpoint-urile care le oferă nu acceptă
  parametrul de temperatură — cerute împreună, răspunsul nu e o eroare de cerere, ci
  „niciun furnizor nu îndeplinește condițiile”. `viziune.ts` îl deosebește de o pană
  obișnuită, cu mesaj propriu pentru om. În jurnal nu ajung nici imaginea, nici
  răspunsul: doar modelul, costul, tokenii și durata.
- **`Contor = number | null` din `panou.ts` NU se turtește.** `0` înseamnă „coada se arată
  și e goală”; `null` înseamnă „coada nu se arată”, fiindcă modulul e stins sau rolul n-are
  permisiunea. Confundate, asistentul ar răspunde liniștitor „nu ai nimic de aprobat”
  cuiva care de fapt nu poate vedea coada. `de-aprobat.ts` raportează doar cozile cu cifră.
- **Nu orice coadă mai e un `Contor`.** `pontaj` din `CoadaPanou` e un
  `PontajDeAprobat | null` — zile neaprobate și fișe săptămânale, numărate separat fiindcă
  ecranul le aprobă în două blocuri. De-aia fiecare rând din `COZI` își spune singur cum se
  numără, printr-un extractor `numar`: pontajul le adună într-o cifră, `null` rămâne `null`.
- **Cont fără fișă de angajat.** Un `org_admin` pur nu are sold de concediu. Uneltele
  marcate `cereFisaProprie` refuză cu un motiv scris, nu cu zero rânduri.
- **Rol fără nicio unealtă permisă.** Secțiunea „UNELTE” lipsește cu totul din prompt: o
  listă de unelte inaccesibile e tot o hartă a aplicației.
- **Învelișul flotant fără dimensiune explicită.** `zona-asistent.tsx` e un
  `popover="manual"`, iar foaia de stil a browserului dă oricărui popover deschis
  `width/height: fit-content` — care bate un `inset-0` fără dimensiune lângă el: învelișul
  se strânge la 0×0 în colțul din stânga-sus, cu bulă cu tot. `h-full w-full` nu e dublaj.
  În happy-dom foaia aia nu există, deci randarea pare corectă oricum ai scrie clasele;
  de-aia `zona-asistent.test.tsx` verifică **clasele**, nu geometria.

## Ce se mișcă împreună

- **`NAV_ITEMS` și `PORTAL_NAV_ITEMS`** — drumul de click se calculează din ele. O intrare
  mutată dintr-un grup în altul schimbă automat ce spune asistentul; una **ștearsă** lasă
  destinația fără părinte, iar `destinatii.test.ts` pică.
- **Arborele de rute** — o pagină nouă în `src/app/(app)/` sau `src/app/(portal)/` pică
  același test până e adăugată în index sau exclusă cu motiv. Una pusă în alt grup de
  rute nu pică nimic: nu e văzută nici de test, nici de asistent.
- **`CoadaPanou` și `COZI` din `de-aprobat.ts`** — legătura e de mână și niciun test n-o
  ține: o coadă adăugată în `CoadaPanou` fără rândul ei în `COZI` nu există pentru
  asistent, fără nicio eroare. `regesDeTransmis` a stat exact așa. Și `referinta` fiecărei
  cozi e un identificator din `destinatii.ts` — unul greșit cade tăcut, ca orice marcaj.
- **`FEATURE_KEYS`** — cheia `asistent` e și în catalogul din bază. Landing-ul
  (`src/content/landing/ro.ts`) enumeră fiecare cheie, iar
  `src/content/landing/continut.test.ts` o cere.
- **`ZonaToast`** — banda de notificări urcă peste bulă: ambele stau pe `z-plutitor`, în
  același colț, iar fără decalaj un toast apare sub butonul rotund și nu se mai închide.
  Decalajele sunt corelate de mână între `toast.tsx` și `zona-asistent.tsx`, iar cel al
  bulei în portal e fixat în `zona-asistent.test.tsx`: mutat pe o parte, una o acoperă.
- **Iconițele pastilelor** — `referinta-ruta.tsx` indexează `NAV_ITEMS` și
  `PORTAL_NAV_ITEMS` într-un tabel de modul, cu cheia `zonă:părinte`, în loc să caute la
  randare. Nu e optimizare: `react-hooks/static-components` respinge o componentă întoarsă
  de un apel de funcție în timpul randării. Un părinte inexistent cade tăcut pe săgeata
  implicită — dar `destinatii.test.ts` prinde orfanul înainte.

## Ce NU e aici

- Nicio migrare de structură. `0117_modul_asistent.sql` seamănă un rând de catalog, atât.
- Nicio Server Action, nicio scriere, niciun audit propriu.
- Niciun embedding și niciun depozit vectorial: corpusul intră întreg în prompt.
- Niciun SDK de LLM și nicio librărie de markdown — vezi docblock-urile din
  `src/lib/asistent/openrouter.ts`, `src/lib/asistent/viziune.ts` și
  `src/lib/asistent/text.ts` pentru de ce.
- Nicio persistență a conversației: trăiește în memoria filei, iar layout-ul `(app)` nu se
  re-randează la navigare, deci supraviețuiește saltului dintr-o pagină în alta.
- Fluxul citirii bonului (F12a) — schema, promptul, ce se face cu rezultatul și costul pe
  bon. Aici stă doar clientul HTTP; restul e în flotă: `[[modul/flota]]`.

## Când NU e suficientă pagina asta

- Se adaugă o unealtă care atinge date sensibile → citește și `[[modul/angajati]]`.
- Fluxul sosește dintr-o bucată în producție, nu în cadre → antetul `x-accel-buffering`
  nu a trecut de proxy; e o problemă de infrastructură, nu de cod.
