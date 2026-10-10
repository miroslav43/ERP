---
tip: modul
titlu: Puncte de lucru
aliases: [puncte-lucru, sedii, locatii]
cai:
  - "src/app/(app)/puncte-lucru/**"
  - "src/schemas/punct-lucru.ts"
  - "supabase/migrations/0030_onboarding_companie.sql"
  - "supabase/migrations/0096_pontaj_rapid.sql"
tabele: [puncte_lucru, attendance_entries]
permisiuni:
  [
    departments:read,
    departments:create,
    departments:update,
    maintenance:read,
    employees:read,
    audit:read,
  ]
capcane: [17]
citeste_daca:
  - "cod de pontaj care nu mai merge după tipărire, sau eticheta butonului → secțiunea „Rotește” în cod"
  - "poartă de citire scrisă doar pe „none” → secțiunea „Rute”"
  - "legătură sau cifră care nu apare pe fișa unui punct → secțiunea „Rute”"
scris_pe: ed4ad654d64120bfad37e146a32c8fbe4f6159f0
scris_la: 2026-10-10
tags: [modul]
---

# Puncte de lucru

Sediile și locațiile firmei, plus **codul de pontaj** afișat la fiecare — hârtia pe care
angajatul o scanează ca să-și marcheze prezența.

**Nu are resursă proprie de permisiune.** Totul trece prin `departments:*`: e structura
firmei, doar pe altă axă decât [[modul/departamente]]. Cine poate schimba departamentele
poate schimba și punctele de lucru; nu există rând `puncte_lucru` în `role_permissions`, iar
o cheie inventată ar întoarce `none` — refuz tăcut.

## Rute

| Rută                      | Poartă                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `/puncte-lucru`           | `requireFeature(..., "nucleu")` + `departments:read`; scrierea cere `departments:create` / `departments:update` la `all` |
| `/puncte-lucru/[id]`      | fișa punctului — aceeași poartă ca lista: `departments:read` nenul, nu `all`                                             |
| `/puncte-lucru/[id]/afis` | afișul tipăribil, cu codul — cere `departments:update` la `all`, nu `:read`                                              |

Poarta de citire a listei se scrie cu `scopeFor`, respinsă pe `null` **și** pe `"none"`:
`getPermissionMap` scoate scope-ul `none` din hartă după rezolvare (`permissions.ts:127`),
iar `scopeFor` întoarce `null` pentru o cheie absentă (`permissions.ts:142-144`) — o
comparație scrisă doar pe `=== "none"` nu se închide niciodată. Ăsta a fost un defect
real aici: `manager` n-are niciun rând `departments:*` în seed, trecea de poartă și primea
un ecran gol în loc de `AccesRestrictionat`. Aceeași formă completă e în
[[modul/departamente]].

Afișul cere `departments:update`, nu `:read`, fiindcă poartă codul în clar, iar cine îl
vede poate ponta de oriunde — e un secret operațional, nu o listă.

Fișa `/puncte-lucru/[id]` nu adaugă poartă proprie: aceeași `departments:read` ca lista,
la fel înregistrată în `src/config/porti-ruta.ts`. Rândul vine prin politica de SELECT,
deci pentru cine nu-l vede punctul **nu există**: `maybeSingle()` + `notFound()`, adică
404, nu „interzis". Segmentul trece prin `idDinRuta` (`src/lib/rute/parametri.ts`), deci
un `[id]` care nu e UUID dă tot 404, nu un 22P02 ieșit la suprafață ca eroare de server.
Restul ecranului se ramifică pe permisiuni, nu pe poartă: acțiunile și rândul „Cod de
pontare" — care spune doar `generat`, niciodată codul — cer `departments:update` la
`all`; legătura spre echipamente cere feature-ul `maintenance` plus `maintenance:read` la
`team`, cea spre angajați `employees:read = all`, cea spre codurile QR feature-ul
`attendance` plus `departments:update`. Cifrele se numără cu `count` exact, pe același
predicat ca lista-țintă, și DOAR unde linkul se afișează. „Istoricul modificărilor" își
citește singur poarta — `audit:read` la `all` — și nu randează nimic sub ea; filtrul e
`entity_id`, iar toate acțiunile modulului scriu acolo id-ul punctului.

Preambulul celor trei pagini pornește `requireFeature` și `getPermissionMap` prin
`Promise.all` — citiri independente, pe tabele diferite (pe listă și pe fișă, în același
val pleacă și `getEnabledFeatures`). În `/puncte-lucru`, selectul de
puncte pleacă în același val (înlănțuit doar de `createServerSupabase()`), iar `error` se
verifică după poartă, ca înainte: `Promise.all` schimbă doar ordinea în timp a cererilor,
nu ordinea deciziilor — respingerea lui `requireFeature` se propagă la fel ca înlănțuită.

## Server Actions

`src/app/(app)/puncte-lucru/actions.ts` — toate pe `minScope: "all"`, deci un scope `team`
e refuzat cu `INTERZIS` înainte de orice interogare. Contractul lor (poartă, payload,
filtre, coduri de eroare) e fixat de `src/app/(app)/puncte-lucru/actions.test.ts`, pe
clientul Supabase fals — care prinde un filtru de organizație lipsă, nu o politică greșită.
`ActiuniPunctLucru` e același component pe listă și pe fișă, cu același `areCodPontaj` în
loc de cod: o schimbare în el atinge ambele ecrane.

| Funcție                                                                     | Permisiune           |
| --------------------------------------------------------------------------- | -------------------- |
| `creeazaPunctLucru`                                                         | `departments:create` |
| `actualizeazaPunctLucru`, `dezactiveazaPunctLucru`, `reactiveazaPunctLucru` | `departments:update` |
| `rotesteCodPontaj`                                                          | `departments:update` |

## „Rotește" în cod, „cod QR nou" pe buton

`rotesteCodPontaj` scrie un secret nou de 24 de octeți (`base64url`, 32 de caractere).
**Codul vechi se anulează**, deci toate afișele deja lipite la punctul de lucru devin
inutile în clipa apăsării. Cine apasă trebuie să știe asta înainte, nu după.

**Vocabularul e însă rupt în două, intenționat.** Acțiunea rămâne `rotesteCodPontaj` —
„rotirea unui secret" e limbaj de inginer. Butonul din `actiuni-punct-lucru.tsx` **nu**
mai spune asta: afișează `Generează un cod QR nou` când codul există deja și
`Generează codul QR` când nu, fiindcă „rotește" nu era un avertisment pentru omul de la
personal, era un cuvânt fără înțeles. Propoziția întreagă („afișele tipărite nu vor mai
funcționa") călătorește în atributul `title`, pus **doar** când `areCodPontaj`. Nu
redenumi butonul înapoi; motivul e scris lângă el. Nu există dialog de confirmare —
`title` e singura frână, iar un dialog rămâne pasul următor firesc.

„Cod QR", nu „cod de pontare", fiindcă afișul randează chiar un QR: SVG din pachetul
`qrcode`, cu corecție `H`, peste un URL absolut construit din `NEXT_PUBLIC_APP_URL` —
care se coace la **build**, deci un afiș tipărit după o mutare de domeniu fără rebuild
trimite oamenii la vechea adresă.

Două decizii în jurul lui:

- **Codul NU intră în audit.** `allow: []` — jurnalul de audit e citibil de oricine are
  `audit:read`, iar codul e un secret. Faptul că a fost rotit e tot ce se consemnează;
  `actions.test.ts` verifică asta serializând tot auditul și căutând codul în el.
- **`.select()` după `.update()`.** Politica de UPDATE cere `departments:update = all` în
  `USING`, iar un refuz atinge zero rânduri **fără eroare**. Fără verificare, ecranul ar
  afișa un cod nou care nu s-a scris nicăieri — iar afișul tipărit după el n-ar funcționa
  la nimeni. — capcana #17

## Ce refuză baza tăcut

- **Denumirea e unică pe firmă, case-insensitive**, prin index unic parțial pe
  `lower(denumire)` cu `where deleted_at is null`. Un al doilea „Depozit" scris cu altă
  literă mare e respins cu 23505; un punct de lucru șters logic **nu** blochează refolosirea
  numelui.
- **Indexul e parțial**, deci un `.upsert()` pe el cade cu 42P10 — PostgREST nu emite
  predicatul în `ON CONFLICT`. Se face citire-apoi-INSERT-sau-UPDATE.
- **Zero rânduri la UPDATE nu înseamnă niciodată „era deja așa".** `activ` nu apare în
  `USING`-ul politicii, deci a doua apăsare atinge din nou același rând: golul e rând
  șters logic sau lipsa lui `departments:update = all`. Codurile diferă și sunt fixate în
  `actions.test.ts`: `actualizeazaPunctLucru` (singura care filtrează `deleted_at is null`)
  dă `NEGASIT`, iar `dezactiveazaPunctLucru`, `reactiveazaPunctLucru` și `rotesteCodPontaj`
  dau `CONFLICT`, cu mesaj care cere reîncărcarea paginii. — capcana #17
- **Codul bazei nu se înghite.** Fiecare scriere trece eroarea prin `mapPostgrestError`,
  deci 23505 iese `CONFLICT` și 42501 iese `INTERZIS`, nu `EROARE_INTERNA` — regresia e
  prinsă de `actions.test.ts`.

## Ce se mișcă împreună

Codul și legătura cu pontajul vin din `0096_pontaj_rapid.sql`, nu din `0030`: acolo s-a
adăugat coloana `cod_pontaj` (token opac, între 16 și 64 de caractere) și
`attendance_entries.punct_lucru_id`, care reține UNDE s-a pontat. Setările operaționale ale
pontării — modul, verificarea, ora de start — sunt la [[modul/pontaj/setari]], nu aici.

Punctul are două adrese, cu rosturi diferite. `/puncte-lucru/[id]` e fișa lui: o deschide
numele din listă și, când codul lipsește, callout-ul afișului. Forma
`/puncte-lucru?punct=<id>#punct-<id>` (evidențiere pe server + ancoră) rămâne „punctul ÎN
listă" — o folosesc firimitura fișei, întoarcerile din afiș, fișa angajatului (punctul
contractului principal, prin RLS: fără `departments:read` rândul spune „Setat"), fișa
echipamentului, lista de coduri QR și sediul scanat din celula de pontaj
(`SediuPontaj.href`, pus de pagină doar pentru cine poate deschide `/puncte-lucru`; în
celulă e `target="_blank"`, fiindcă celula e un dialog modal).

## Când NU e suficientă pagina asta

- Ce se întâmplă cu codul după scanare: [[modul/pontaj]].
- Cealaltă axă a structurii: [[modul/departamente]].
- De ce fiecare entitate capătă fișă proprie și cum se leagă firimiturile: [[strat/navigare]].
