---
tip: modul
titlu: Flotă — rapoarte lunare, export Excel și pachet pentru contabil
aliases:
  [
    rapoarte flota,
    pachet contabil,
    export flota,
    cost pe vehicul,
    consum fata de norma,
    km pe sofer,
    vehicles:export,
  ]
cai:
  - "src/app/(app)/flota/rapoarte/**"
  - "src/app/api/export/flota/**"
  - "src/domain/fleet/rapoarte.ts"
  - "src/lib/queries/fleet-rapoarte.ts"
  - "src/schemas/fleet-rapoarte.ts"
  - "src/lib/excel/raport-flota.ts"
  - "src/lib/unelte/xlsx.ts"
  - "src/lib/pdf/foaie-din-date.ts"
  - "src/lib/pdf/pachet-flota.ts"
  - "tests/rls/proba-flota-rapoarte.sql"
  - "supabase/migrations/0225_flota_costuri_ascunse.sql"
tabele:
  [
    trip_sheets,
    trip_sheet_curse,
    fuel_entries,
    vehicle_service_entries,
    vehicle_expenses,
    vehicle_documents,
  ]
permisiuni: [vehicles:read, vehicles:export, trip_sheets:read]
feature: fleet
capcane: [2, 18]
scris_pe: 720d889bc73823b4982d9a06ff3943418b96d9a7
scris_la: 2026-10-12
tags: [modul, operations]
---

# Flotă — rapoarte lunare, export Excel și pachet pentru contabil

Extrasă din `[[modul/flota]]`. **Fără migrare**: cheia `vehicles:export` există în seed
din `0002_authz.sql` (produsul cartezian de acțiuni al lui `org_admin` și `super_admin`)
și n-o are niciun alt rol; `src/config/permissions.ts` doar o declară.

## Rute și cine ajunge

| Rută                       | Poartă                                                                        |
| -------------------------- | ----------------------------------------------------------------------------- |
| `/flota/rapoarte`          | `vehicles:read` ȘI `trip_sheets:read`, ambele la `all` (`poateVedeaRapoarte`) |
| `/api/export/flota`        | `vehicles:export` la `all` + aceleași două drepturi (`poateExportaFlota`)     |
| `/api/export/flota/pachet` | la fel; ZIP cu Excelul și PDF-urile foilor aprobate                           |

Parametri: `?luna=AAAA-LL` (la export, obligatoriu și validat: 400 altfel; pe pagină, o
lună lipsă sau stricată cade pe luna curentă din România) și `?vehicul=<uuid>` (opțional).
Fila „Rapoarte" stă în `FILE_FLOTA`; registrul de porți (`porti-ruta.ts`) are un singur
prag, deci al doilea drept se verifică în preambulul paginii.

## Ce arată

Trei tabele pe lună, toate din foile **APROBATE** (funcțiile pure sunt în
`src/domain/fleet/rapoarte.ts`):

- **Cost pe vehicul**: service, cheltuieli fără foaie, documente cu valabilitatea începută
  în lună (costul din `vehicle_document_costuri`, 0225) și combustibilul foilor; lei/km din
  kilometrii foilor. Aceleași patru surse și
  aceleași formule ca fila Costuri (`[[modul/flota/service-si-costuri]]`).
- **Consum față de normă**: litri la 100 km din foile lunii, comparați cu norma de pe
  INSTANTANEUL fiecărei foi (nu cu cea de azi a vehiculului), media ponderată cu km.
- **Kilometri pe șofer**: foi, zile, vehicule, km. Foaia fără șofer și șoferul care nu se
  mai vede au rânduri proprii.

Foile ciornă, trimise și respinse ale lunii se numără separat și se spun pe față
(`Callout`), cu legătură spre „De aprobat" doar pentru cine are poarta acelei rute.
„Vehicul 100% fără foi în luna X" nu e în raport: verdictul lunii îl dă luna fiscală (F10,
`/flota/fiscal`, `[[modul/flota/fiscal]]`).

## Ce refuză baza tăcut

- **La `team`, cifrele ies PARȚIALE, fără nicio eroare.** Managerul vede doar foile
  șoferilor echipei și doar vehiculele ei (probat în `proba-flota-rapoarte.sql`, (5)).
  Un cost pe km sau un consum împărțit la jumătate din kilometri arată ca unul întreg.
  De aceea poarta cere `all` pe AMBELE drepturi și ecranul nu se deschide altfel, în loc
  să ascundă coloane. Fila Costuri a fișei face invers (ascunde cifrele derivate din foi)
  fiindcă acolo service-ul rămâne complet. — capcana #18
- **`max_rows = 1000` taie o agregare fără să spună.** Toate citirile de calcul trec prin
  `citesteTot` (keyset pe `id`), care aruncă în loc să trunchieze; lista de etichete se cere
  în felii de câte 100 de id-uri, ca adresa să rămână scurtă. — capcana #2
- **Selecturile din `fleet-rapoarte.ts` stau în constante, iar `coloane.test.ts` nu le
  rezolvă** (citește doar `.select("literal")`). Coloanele lor sunt lipite de
  `database.ts` în `fleet-rapoarte.test.ts`; o coloană inventată n-ar da eroare de
  compilare, ci 42703 în producție.
- **Un vehicul șters logic rămâne în cifre, fără numărul de azi.** RLS-ul nu filtrează
  `deleted_at` pe vehicule (forma din 0018 §F2, păstrată de 0199 și 0215), deci service-ul,
  cheltuielile, documentele și foile lui intră în total: au existat. Eticheta o filtrează
  aplicația (`vehiculeDupaId` cere `deleted_at is null`), așa că rândul ia numărul din
  instantaneul foii sau se numește „Vehicul șters", nu dispare.

## Excelul

`documentRaportFlota` (`src/lib/excel/raport-flota.ts`) construiește un `DocumentXlsx`, iar
`xlsxRaportFlota` îl randează exact cum îl descarcă ambele rute: `curataDocumentXlsx` +
`randeazaXlsx(d, { subsol: "aplicatie" })`. **Celulele de sume sunt NUMERE** (din 22 oct
2026): lei, km, litri, consumuri și abateri sunt `CelulaNumerica` (valoarea, rotunjită la
precizia afișată, + un cod Excel ca `#,##0.00`, pe care Excelul în română îl arată
`1.002,50`); unitatea stă în format (`#,##0.00" l"`), abaterea e fracția cu format de
procent. „—” rămâne text, sărit de SUM. Câmpurile de antet rămân text. `DocumentXlsx`
lărgește DOAR celulele tabelelor, deci uneltele publice (`DocumentTabelar`, text) trec
neschimbate. **Fără subsolul „Generat gratuit cu administrativo.ro”**: opțiunea `subsol` a
lui `randeazaXlsx` e obligatorie; `raspunsDocument` (uneltele) trimite `"unealta"`, exporturile
aplicației `"aplicatie"`. Testele: `src/lib/unelte/xlsx.test.ts` (ambele căi). Răspunsul
trece prin `raspunsBinar`: `private, no-store`. PDF-ul și Word-ul comune (`randeazaPdf*`,
`randeazaDocx*`) au aceeași opțiune, cu implicitul `"aplicatie"` (fără rând și fără
legătură); `raspuns.ts` cere `"unealta"` pe toate formatele
(`src/lib/unelte/subsol-aplicatie.test.ts`, ambele căi).

## Pachetul lunar

ZIP cu `raport-flota-AAAA-LL.xlsx` la rădăcină și `foi/<nume>.pdf` pe fiecare foaie
aprobată. Folosește `jszip`, în `dependencies` din `b6ed2c66` (aceeași versiune, același
lock); niciun alt fișier de producție din `src/` nu importă o devDependency (verificat cu grep
pe 22 oct 2026). Pașii:

1. `numarFoiAprobateLuna` numără FĂRĂ să aducă rânduri; zero → 404, peste
   `PLAFON_FOI_PACHET` → 413 cu îndemnul de a alege un vehicul. Plafonul e calibrat pe
   timpul de generare (PDF-urile se fac în cererea HTTP, unul câte unul) și pe termenele
   proxy-ului (nginx, pe rutele de export, și Cloudflare, mai strict).
2. `incarcaPachetLunar` citește foile ÎNTREGI (curse și alimentări prin embed) și
   calculează raportul pe EXACT aceleași foi: Excelul listează ce conțin PDF-urile.
3. `pachetLunarFlota` generează PDF-urile serial; numele se fac unice fără majuscule
   (`numeUnic`), ca două foi omonime să nu se suprascrie în arhivă.

Modelul PDF al unei foi stă într-un singur loc, `modelFoaieDinDate`, folosit și de ruta
foii singure (`[[modul/flota/foaia-zilnica]]`): instantaneul bate vehiculul de azi, iar
alimentările și cursele se ordonează în model, nu în citire (embed-ul din pachet n-are `ORDER BY`).

## Ce se mișcă împreună

`rapoarte.ts` (domeniu) → `fleet-rapoarte.ts` (citiri) → `raport-flota.ts` (document) →
rutele de export; pagina folosește `PrezentareRaport` (pură, testată într-un DOM) peste
`ContinutRaport` (încărcarea). Plafonul pachetului stă în domeniu fiindcă ecranul îl arată
omului înainte de clic.

## Ce NU e aici

Verdictul fiscal al lunii (F10: `[[modul/flota/fiscal]]`), formatul Saga/WinMentor (F12g:
`[[modul/flota/export-contabil]]`) și pachet pentru intervale mai lungi de o lună. Pagina nu a rulat într-un
browser pe date reale: baza din cloud n-are încă migrările fazelor F4–F7.

## Când NU e suficientă pagina asta

Probele: `tests/rls/proba-flota-rapoarte.sql` (matricea cheilor și vizibilitatea citirilor
pe cinci roluri și două firme). Testele: `rapoarte.test.ts`, `fleet-rapoarte.test.ts`,
`raport-flota.test.ts`, `pachet-flota.test.ts`, cele două `route.test.ts` din
`src/app/api/export/flota/`.
