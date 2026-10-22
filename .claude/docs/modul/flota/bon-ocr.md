---
tip: modul
titlu: Flotă — bonul de combustibil citit de pe poză (F12a)
aliases: [bon ocr, citeste bonul, ocr_propunere, cui_statie, viziune]
cai:
  - "supabase/migrations/0213_flota_bon_ocr.sql"
  - "src/app/(app)/flota/bon/**"
  - "src/domain/fleet/bon-ocr.ts"
  - "src/lib/asistent/viziune.ts"
  - "src/lib/fleet/**"
  - "src/lib/documents/foto-bon-pregatire.ts"
  - "src/components/flota/**"
  - "src/app/(app)/flota/foi/[id]/poza-bon-alimentare.tsx"
  - "src/app/(app)/flota/foi/[id]/pastile-bon.tsx"
  - "tests/rls/proba-flota-bon-ocr.sql"
tabele: [fuel_entries]
permisiuni: [trip_sheets:update]
feature: fleet
capcane: []
scris_pe: 8d3a56f02699c0f2f8f40c79e269a87df68cd056
scris_la: 2026-10-22
tags: [modul, operations]
---

# Flotă — bonul de combustibil citit de pe poză

Din poza bonului, un model de viziune (OpenRouter) citește data și ora, litrii,
valoarea carburantului, stația, numărul bonului și CUI-ul stației, iar formularul
„Adaugă o alimentare” se **pre-completează**. Omul vede, corectează și salvează el.
**Nimic nu se salvează automat:** `citesteBonul` nu scrie niciun rând (doar auditul).

## Comutatorul

Butonul „Citește bonul” apare doar cu toate trei: cheia `OPENROUTER_API_KEY`, modulul
`asistent` activ pentru firmă (îl pune platforma, nu firma) și `trip_sheets:update` own.
Calculul e pe server (`src/lib/fleet/citire-bon.ts`), iar acțiunea le reverifică. Modelul:
`OPENROUTER_MODEL_VIZIUNE`, listată și în `docker-stack.yml` (altfel nu ajunge în container).

## Fluxul

1. Poza se alege în formularul de adăugare (`foi/[id]/poza-bon-alimentare.tsx`):
   browserul o aduce la JPEG ≤ 2048 px (`foto-bon-pregatire.ts`, canvas: fără EXIF, deci
   fără GPS), `pregatesteBonNou` semnează calea `{org}/trip_sheets/{foaie}/…` sub sesiunea
   omului, browserul urcă. Poza încă nu e legată de niciun rând.
2. `citesteBonul` (`flota/bon/actions.ts`) trimite poza la model și întoarce propunerea
   plus un **jeton** HMAC (`src/lib/fleet/jeton-bon.ts`, cheie HKDF din
   `TENANT_COOKIE_SECRET`, 2 ore), legat de firmă, om, foaie și cale.
3. Propunerea completează DOAR câmpurile goale, cu „(din bon)” în etichetă; ce a tastat
   omul nu se suprascrie (`aplicaPropunerea` în `actiuni-foaie.tsx`).
4. `adaugaAlimentare` verifică jetonul (`invalid` ⇒ INTERZIS, fără insert; `expirat` ⇒
   salvează fără propunere), măsoară poza în Storage, face INSERT-ul sub sesiunea omului
   (cu `fisier_bon_path`, FĂRĂ propunere), apoi scrie `ocr_propunere` cu clientul admin,
   filtrat pe `id` + firmă + `ocr_propunere is null`. Dacă al doilea pas pică, alimentarea
   rămâne salvată, cu `[ocr-bon]` în jurnal: cele două scrieri nu sunt atomice, asumat.

Pe alimentările existente (agrafa din tabel) nu se citește: propunerea se scrie o singură
dată, la adăugare. Agrafa re-encodează și ea poza în JPEG, dar dacă browserul n-o poate
decoda (HEIC pe Chrome) urcă originalul, ca înainte.

## Ordinea din `citesteBonul`

Cheia → modulul `asistent` → limitele (`ocr-bon:utilizator:*` 20/oră, `ocr-bon:organizatie:*`
300/zi, `ocr-bon:global` 30/min, ÎNAINTEA apelului extern, **în serie, cu oprire la primul
refuz**: `rate_limit_hit` numără și refuzurile, deci în paralel un singur om în buclă ar fi
blocat contorul global pentru toate firmele) → foaia sub RLS, doar ciornă →
**garda de proprietar** (scope ≠ `all` ⇒ foaia trebuie să fie fișa proprie: managerul vede
foile echipei și poarta bucketului îi dă poza, deci fără gardă ar trimite la terț bonurile
subordonaților) → calea în folderul foii → obiectul (≤ 4 MiB, măsurat din nou pe octeții
descărcați: proprietarul îl poate rescrie între timp) → doar JPEG (`FF D8 FF`),
apoi `faraMetadateJpeg` (taie APP1, APP13, COM) → modelul → CUI-ul firmei din
`organizations.cui_normalizat` → avertismentul de bon dublat (aceeași foaie: „salvarea va
fi refuzată”, prin `fuel_bon_uq`; altă foaie, aceeași stație și zi: dublură posibilă).

## Apelul extern

`src/lib/asistent/viziune.ts`, fără SDK, nu aruncă niciodată: `stream: false`,
`reasoning.effort: "low"`, `json_schema` strict, `provider: {require_parameters,
data_collection: "deny", zdr: true}` și **fără `temperature`** — endpoint-urile Vertex,
singurele ZDR ale modelului, nu o acceptă, iar cu ea n-ar rămâne niciun endpoint. Termen de
30 s pe tot răspunsul (nu `fetchCuTermen`, care taie la antete). 429 ⇒ `limita`; 404 sau 503
„No available model provider” ⇒ `fara_endpoint`; restul ⇒ `indisponibil`. În jurnal: modelul,
costul, tokenii, durata; niciodată imaginea sau răspunsul.

## Ce refuză baza tăcut

- **`ocr_propunere` o scrie doar contextul de serviciu, o dată** (0213,
  `alimentari_ocr_garda`): din sesiunea omului, un INSERT sau UPDATE care o atinge dă
  P0001; după prima scriere e imuabilă, și pentru serviciu. Grantul de insert/update e pe
  tot tabelul, deci garda nu poate sta în aplicație. Ștergerea logică trece.
- `cui_statie` ține doar forma (`fuel_cui_statie_ck`: 2–10 cifre, fără „RO”); cifra de
  control o verifică schema (`alimentareSchema`), cu eroare pe câmp.
- `actualizeazaAlimentare` trimite `cui_statie` mereu (altfel corectura l-ar goli) și
  niciodată propunerea sau jetonul.

## Ce se mișcă împreună

`raspunsBonSchema` ↔ `SCHEMA_JSON_BON` ↔ `PROMPT_BON` ↔ `interpreteazaBon`, toate în
`src/domain/fleet/bon-ocr.ts`. Modelul TRANSCRIE (șiruri, exact cum sunt tipărite), codul
INTERPRETEAZĂ: virgula zecimală, ora României, cifra de control, plauzibilitatea. Forma
salvată se parsează la citire (`propunereSalvataSchema`, în `alimentarileFoii`); o formă
necunoscută devine `null`, nu cade pagina. Pastilele „Citit de pe bon”, „Diferă de bon” (cu
diferențele scrise) și „Poza a fost schimbată după citire” stau în `foi/[id]/pastile-bon.tsx`,
pe ambele foi.

## Avertismente, nu refuzuri

CUI cu cifra de control greșită (câmpul se golește), preț pe litru în afara [4; 12] lei
(⚠ ales de noi, prinde virgula citită greșit), data în afara foii sau altă zi, alte produse
pe bon, AdBlue, mai multe linii de carburant, CIF de cumpărător diferit de al firmei.
**Pe CIF-ul lipsă nu se avertizează** (⚠ contabil: efectul asupra deducerii e neverificat).

## Probe

`tests/rls/proba-flota-bon-ocr.sql`: garda pe toate rolurile (employee și manager pe foile
lor, serviciul o dată, hr și super_admin refuzați la scriere, izolarea), inclusiv PATCH-ul
direct pe un rând necitit (`null` → valoare din sesiune ⇒ P0001). Verificarea `(l)`
din `tests/rls/izolare.sql`, blocul F12a: org_admin + serviciul. Testele de acțiune rulează
pe clientul fals, cu viziunea dublată: niciun apel real.

## Ce NU e aici

Salvarea automată, citirea la urcare fără clic, HEIC decodat în browser pe Chrome/Firefox
(omul primește pașii), unicitatea (CUI, număr, zi) în bază, pastila „Necitit”, OCR pe alte
documente. ⚠ Înainte de livrare: avizul juristului (fotografiile pleacă la OpenRouter →
Google, pe Vertex `global`, în afara listei UE) și un apel real pe staging, cu cheia, care
confirmă ruta ZDR.
