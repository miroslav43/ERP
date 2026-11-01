---
tip: modul
titlu: Registrul de documente — ecranul, panoul și legăturile
aliases: [registru-ecran, registru-panou, registru-filtre]
cai:
  - "src/app/(app)/registru/page.tsx"
  - "src/app/(app)/registru/filtre-registru.tsx"
  - "src/app/(app)/registru/panou-document.tsx"
  - "src/app/(app)/registru/detaliu-document.tsx"
  - "src/app/(app)/registru/legaturi.ts"
  - "src/app/(app)/registru/etichete.ts"
  - "src/app/(app)/registru/nomenclator/page.tsx"
  - "src/lib/queries/registru.ts"
  - "src/lib/registru/filtre.ts"
  - "src/config/porti-ruta.ts"
tabele: [registru_documente, nomenclator_dosare, nomenclator_tipuri]
permisiuni: [registru:read, registru:export, employees:read]
capcane: [2, 53]
scris_pe: c78f84c1a25c63c9490dcfe8104b51bf51aff507
scris_la: 2026-11-01
tags: [modul]
---

# Registrul de documente — ecranul, panoul și legăturile

Secțiune extrasă din [[modul/registru]]: ecranul `/registru`, panoul lateral, filtrele și
drumul dintre rândul de registru și documentul-sursă. Numerotarea, cele trei drumuri către
un număr și ce refuză baza rămân pe pagina-mamă.

## Ecranul: tot ce e stare stă în URL

`/registru` citește din `searchParams` filtrele (`an`, `sens`, `tip`, `de_la`, `pana_la`,
`q`, `angajat`, `dosar`, `stare`, `sursa`), sortarea (`sort`, forma `-data`), gruparea
(`grup` = `tip|dosar|luna|angajat`), pagina (`cursor`, `limita`) și **documentul deschis în
panou** (`doc` = uuid). Orice link pornește din parametrii existenți (`adresa()`), deci
niciun clic nu șterge ce era înainte.

- **Rândul e apăsabil** prin `Tabel` cu `href` → `?doc=<id>` și `pastreazaDerularea`
  (`scroll: false`, altfel App Router sare la începutul listei). Panoul
  (`panou-document.tsx`, `PanouLateral`) ține `deschis` local și la închidere face
  `router.replace` fără `doc`; conținutul (`detaliu-document.tsx`) vine randat pe server din
  `citesteDocumentRegistru`. Id nevalid → fără panou; id negăsit sau ascuns de RLS → panou cu
  `Callout`, nu adresă ignorată.
- **„Deschide documentul"** vine din `legaturi.ts` (funcție pură, **nu aruncă**): pagină
  proprie pe id, pagina părintelui pentru `TIPURI_CU_PARINTE` (vehicul, stingător, echipament
  ISCIR, obiect de inventar, perioadă de salarizare, deplasare, curs — părintele e citit în
  `citesteParinte`, cu selecturi literale ca `coloane.test.ts` să le verifice), fișa
  angajatului pentru contracte/documente/evaluări, lista modulului unde nu există pagină,
  `null` pentru `manual` și cele șapte tabele fără ecran. Documentele emise au PDF
  (`/documente/[id]?format=pdf`) montat **la cerere** (`previzualizare-pdf.tsx`): ruta
  randează PDF-ul la fiecare cerere. Două ținte noi: adeverința de curs
  (`course_completion_records`) duce la stadiul cursului pe angajatul ei,
  `/cursuri/[id]/stadiu` cu `?angajat=`, iar procesul-verbal de predare a vehiculului
  (`vehicle_handovers`, 0215) deschide PDF-ul inline, `/api/export/flota/pv/[id]`, în filă
  nouă: pagina lui (`/flota/[id]/pv/[pv]`) ar cere și vehiculul, pe care rândul de registru
  nu-l poartă, iar numărul de registru e tipărit chiar pe PDF.
- **Sortarea** e keyset cu **`numar` ca departajator**, nu `id` (`predicatKeyset(…, "numar")`,
  parametru adăugat în `cursor.ts`): cu anul fixat numărul e unic ȘI e ordinea registrului.
  Chei permise `numar`, `data`, `tip`, `dosar` (nulabil, `predicatKeysetNulabil`); `emitent`
  NU, fiindcă garda din 0148 îl pinuiește și un `''` existent s-ar confunda cu `VALOARE_NULA`.
- **Gruparea nu se paginează**: `listeazaRegistruComplet` ia tot anul filtrat în pagini de
  1000, plafon `MAX_RANDURI_EXPORT` cu `trunchiat`; `Tabel` primește prop-ul `grupare` (rânduri
  de antet în același corp). Antetele nu sortează cât e activă.
- **Banda de cifre** și tipurile/dosarele pentru filtre vin din `citesteSumarAn` — o singură
  citire în buclă de 1000, agregată în TypeScript. `listeazaTipuriDocument` nu mai există.
- Etichetele: `etichete.ts` are TOATE codurile din harta SQL (test de drift care citește 0142
  de pe disc), `eticheteazaRezolvare` (stările brute `aprobata` → „Aprobată", `null` → „În
  lucru"), `eticheteazaSursa`, `TON_SENS`.
- Câmpurile de dată sunt `IntrareData` (bara de filtre, dialogul documentului primit,
  avizul nomenclatorului), nu `<input type="date">` crud.

**Vocabularul filtrelor stă în `src/lib/registru/filtre.ts`, nu în citiri.** Bara de filtre e
Client Component și are nevoie de listele de stări, surse, grupări și sortări;
`src/lib/queries/registru.ts` începe cu `server-only`, iar un import de VALOARE de acolo
într-un `"use client"` pică **numai** la `next build` — capcana #53, poarta e
`scripts/checks/client-imports-server-only.mjs`. Modulul de citiri le re-exportă pentru
apelanții de pe server.

## Un link trece prin poarta ȚINTEI

`DetaliuDocument` primește `context` — modulele firmei și matricea de permisiuni, citite în
`page.tsx` cu `getEnabledFeatures` și `getPermissionMap` — și trece adresa calculată de
`legaturaDocument` prin `poateDeschide` (`src/config/porti-ruta.ts`). Regula e a stratului,
nu a modulului: un link trece prin poarta **paginii-țintă**, nu a sursei ([[strat/navigare]]).

Două texte diferite, fiindcă sunt două lucruri diferite: „nu are ecran propriu în aplicație"
(`legaturaDocument` a întors `null`) și „ecran într-un modul oprit sau pe care nu aveți
dreptul să-l deschideți" (poarta a refuzat). Cazul care l-a cerut: `hr` vede rândul cu
`registru:read`, dar n-are niciun drept pe flotă, diurnă sau mentenanță, iar o firmă care a
oprit un modul păstrează rândurile vechi pentru totdeauna — butonul ducea în refuz sau în 404.

Aceeași poartă ține și legăturile spre fișa angajatului (`poateDeschide("/angajati/[id]", …)`,
calculat o dată în pagină): antetul grupului când `grup=angajat` și banda „Documentele lui …"
care îi dă drumul înapoi celui venit din fișă, fiindcă tabelul n-are coloana „Angajat".

## Celulele sunt filtre

Tipul documentului e link către `?tip=…` pe anul curent (cu `cursor` și `doc` scoase), iar pe
`/registru/nomenclator` fiecare tip clasat într-un dosar duce la `/registru?an&tip`. Pastilele
de stare și-au schimbat numele: **„Înregistrări active" / „Înregistrări anulate"**, nu
„Active" / „Anulate" — rubrica „Rezolvare" a unei cereri de concediu poate spune „Anulată"
(starea cererii) fără ca RÂNDUL de registru să fie anulat; două lucruri diferite, cu același
cuvânt.

În antetul tabelului nomenclatorului, `sr-only` stă pe un `span`, nu pe `th`: un `th` cu
`position: absolute` nu mai e celulă de tabel, iar antetul rămânea cu o coloană mai puțin
decât corpul. Tiparul e cel din `src/components/ui/tabel.tsx`.

## Ce refuză citirea tăcut

- `max_rows = 1000` trunchiază tăcut: `listeazaAni`, `citesteSumarAn` și
  `listeazaRegistruComplet` citesc în buclă cu salt peste ultima valoare — capcana #2.
- Eticheta tipului se citește cu `Object.hasOwn`: `constructor` e cod valid ȘI cheie de
  prototip — la fel în `legaturi.ts`.
- Nomenclatorul NU e paginat (`MAX_DOSARE`); baza îl ordonează alfabetic, ecranul îl
  reordonează cu `comparaIndicative` (`indicativ.ts`), corect și de la „IX" în sus.
- `indicativ_dosar` gol nu e o eroare — ecranul scrie „Neclasat", nu „—".
