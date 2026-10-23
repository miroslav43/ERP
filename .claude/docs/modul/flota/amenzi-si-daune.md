---
tip: modul
titlu: Flotă — amenzi, daune și șoferul la un moment dat
aliases:
  [
    vehicle_fines,
    vehicle_incidents,
    amenda,
    proces-verbal,
    art. 39,
    desemnarea șoferului,
    scrisoare de răspuns,
    daună,
    sofer_la,
    sofer_sugerat,
  ]
cai:
  - "supabase/migrations/0206_flota_amenzi_daune.sql"
  - "src/app/(app)/flota/actions-amenzi.ts"
  - "src/app/(app)/flota/amenzi/**"
  - "src/app/(app)/flota/incidente/**"
  - "src/app/api/export/flota/amenzi/**"
  - "src/domain/fleet/amenzi.ts"
  - "src/lib/pdf/scrisoare-desemnare.ts"
  - "src/lib/queries/flota-amenzi.ts"
  - "src/schemas/flota-amenzi.ts"
  - "tests/rls/proba-flota-amenzi.sql"
tabele: [vehicle_fines, vehicle_incidents, expirables, trip_sheet_curse, vehicle_assignments]
permisiuni:
  [
    vehicle_fines:read,
    vehicle_fines:create,
    vehicle_fines:update,
    vehicle_incidents:read,
    vehicle_incidents:create,
    vehicle_incidents:update,
    employees:read,
  ]
feature: fleet
capcane: [17, 19, 23, 26]
scris_pe: 59875840fcf542f696cecc8982d47c68375f2596
scris_la: 2026-10-22
tags: [modul, operations, legal]
---

# Flotă — amenzi, daune și șoferul la un moment dat

Extrasă din `[[modul/flota]]`. Migrarea: `0206_flota_amenzi_daune.sql` (planul o numea
`0180`; numerele intermediare s-au ocupat). Temeiurile legale verificate și tot ce rămâne
de confirmat cu juristul (marcat ⚠️) sunt în `NOTES.md`, secțiunea „Flotă — amenzi și
daune”. Regula de fond: **aplicația ține evidența și generează scrisoarea; nu recuperează
nimic de la șofer**.

## Rute și cine ajunge

| Rută / ecran                                | Poartă                                                           |
| ------------------------------------------- | ---------------------------------------------------------------- |
| `/flota/amenzi`, `/flota/amenzi/[id]`       | `vehicle_fines:read` all                                         |
| `/flota/incidente`, `/flota/incidente/[id]` | `vehicle_incidents:read` all                                     |
| `/api/export/flota/amenzi/[id]/scrisoare`   | `vehicle_fines:read` all ȘI `employees:read` all (CNP, vezi jos) |

Cheile sunt seedate doar pentru `org_admin` și `super_admin`: decizia 3 a planului (HR doar
permisele șoferilor) rămâne, iar o firmă poate acorda cheile lui HR printr-o suprascriere.
`manager` și `employee` nu văd nimic, nici amenzile din echipa lor. Singura excepție:
`employee` are `vehicle_incidents:create = own` (își declară dauna din portal și își vede
doar declarațiile, `[[modul/flota/declaratia-soferului]]`). Matricea publică de pe
pagina de prezentare (`matrice-roluri.ts`) are două rânduri pentru ele, doar `org_admin` = all. Dacă o firmă acordă cheile
`create` lui HR, HR primește prin sugestie și cine conducea ce vehicul (`app.sofer_la` judecă după cheie). Casetele „Amendă nouă” și
„Incident nou” se deschid prin parametru (`?amenda=noua`, `?incident=nou`), ca la parc.

## Server Actions

`src/app/(app)/flota/actions-amenzi.ts`, toate cu `minScope: "all"`.

| Funcție                                                                         | Permisiune                 |
| ------------------------------------------------------------------------------- | -------------------------- |
| `inregistreazaAmenda`                                                           | `vehicle_fines:create`     |
| `actualizeazaAmenda`, `desemneazaSofer`, `retrageDesemnarea`, `trimiteRaspuns`  | `vehicle_fines:update`     |
| `schimbaStadiulAmenzii` (plătită, contestată, anulată cu motiv), `stergeAmenda` | `vehicle_fines:update`     |
| `raporteazaIncident`                                                            | `vehicle_incidents:create` |
| `actualizeazaIncident`, `schimbaStadiulIncidentului`, `stergeIncident`          | `vehicle_incidents:update` |

Fiecare tranziție adaugă stadiul de plecare ca filtru (`.eq` sau `.in`) și `.select()` după:
zero rânduri e CONFLICT, nu succes. Plecările permise se calculează din matricea
`TRANZITII_AMENDA` din domeniu, aceeași ca a bazei.

**Excepția cu două încercări:** `desemneazaSofer` și `trimiteRaspuns` încearcă întâi calea
obișnuită (care schimbă stadiul), iar la zero rânduri o a doua, pe amenda `contestata` cu
`raspuns_trimis_la` gol, care scrie doar șoferul / data răspunsului și lasă stadiul în pace.
Altfel o amendă marcată „contestată” înainte de răspuns rămânea cu termenul în scadențe și
fără nicio cale de a-l închide.

## Citiri

`src/lib/queries/flota-amenzi.ts` (`import "server-only"`): `listeazaAmenzi` și
`listeazaIncidente` (cursor keyset pe momentul faptei, cu total exact), `citesteAmenda`,
`citesteIncident`, `rezumatAmenzi` (numărători exacte, nu citire de rânduri),
`soferSugerat`, `soferiPentruDesemnare` (și angajații plecați), `vehiculePentruAmenzi`
(și vehiculele vândute), `cercetariSsm`, `datePersonaleSofer` (doar pentru scrisoare).

## Ce refuză baza tăcut

- **Șoferul desemnat / al incidentului e o fișă VIE a firmei** (X2): una ștearsă logic,
  inexistentă sau din altă firmă dă același P0001. Garda de firmă vine prima (42501): un
  rând pus pe altă firmă nu mai află ce vehicule și șoferi există acolo.

- **Stadiul îl judecă baza, nu pagina** (`internal.amenzi_inainte`). Amenda plătită sau
  anulată e închisă: orice UPDATE dă P0001. „Răspuns trimis” nu se mai întoarce, iar după el
  vehiculul, momentul faptei, numărul procesului-verbal și șoferul desemnat sunt înghețate
  (ce s-a comunicat autorității nu se rescrie). Ștergerea logică merge doar pe amenda
  „primită”; una în lucru se anulează, cu motiv. Același tipar la incident: „închis” îngheață
  tot și cere costul final, iar „la asigurător” cere numele asigurătorului.
- **Termenul de răspuns nu are valoare implicită.** Art. 39 alin. (1) din OUG 195/2002 spune
  „termenul indicat în cuprinsul solicitării”: îl scrie omul din document. Fără el, amenda
  nu are scadență și ecranul spune „fără termen în solicitare”. Cu el, scadența intră în
  `expirables` (`vehicle_fine`, `termen_raspuns`) DOAR cât răspunsul n-a plecat; la „răspuns
  trimis” dispare (și nu revine dacă amenda e apoi contestată), la fel la plătită sau anulată,
  iar alertele deschise se închid singure. — capcana #19
- **„Răspuns în așteptare” = stadiul îl cere ȘI `raspuns_trimis_la` e gol**
  (`raspunsInAsteptare` în domeniu). Stadiul singur minte: „răspuns trimis → contestată”
  păstrează data. Din aceeași noțiune vin butoanele fișei, `verdictTermen`, filtrul „De
  răspuns” și numerele de deasupra listei, oglinda lui `internal.amenzi_scadenta`. O amendă
  contestată ÎNAINTE de răspuns păstrează termenul (obligația din art. 39 nu dispare prin
  contestare): șoferul se desemnează și răspunsul se marchează fără ca stadiul „contestată”
  să se piardă (trigger: răspuns fără șofer = P0001; după răspuns, înghețarea obișnuită). De
  la „contestată” nu există tranziție înapoi spre „șofer desemnat” (proba 14c).
- **`app.poate_vedea_expirabil` a fost rescrisă integral** (rândul `vehicle_fine` cere
  `vehicle_fines:read` all). Orice `entity_type` nou pornește de la forma din 0206, care
  poartă și `driver_license` (0204) și `vehicle_service` (ramura F7): fără ele, scadențele
  respective ar dispărea din lista de conformitate fără nicio eroare. Proba (28) o păzește.
  — capcana #26
- **Din 0206 §G termenul intră în rezumatul zilnic**, DOAR la responsabilii (sau
  administratorii) care citesc amenzile la `all`, niciodată la șofer:
  `[[modul/flota/declaratia-soferului]]`.
- **`manager` și `employee` primesc zero rânduri, fără eroare.** Absența cheii e refuz. Un
  `.single()` pe o amendă invizibilă dă NEGASIT, nu INTERZIS. — capcana #17
- **Legătura cu cercetarea SSM o pune doar cine o VEDE.** `incidente_inainte` (DEFINER)
  cere, la schimbarea `work_accident_id`, rândul firmei, neșters ȘI citibil de apelant după
  regulile SSM (modulul `ssm` activ, `app.ssm_acces(…, 'read', angajatul)`), cu un singur
  mesaj pentru „nu există” și „nu o puteți consulta”: refuzul nu e sondă. Acțiunea citește
  întâi cercetarea prin RLS; dacă n-o vede, UPDATE-ul trece doar pe rândul care o are deja
  (legătura pusă de altcineva se păstrează), altfel VALIDARE pe câmp. Dezlegarea rămâne
  permisă. Probele (25c)–(25e) (modulul oprit) și (25f)–(25h) (ramura pe angajat: un manager
  cu cheile incidentelor leagă doar cercetarea echipei lui).
- **`created_by` și `updated_by` se trimit explicit** din acțiuni, deși triggerul `set_actor`
  e atașat: păstrează tiparul flotei. — capcana #23
- **Un UPDATE respins de USING nu ridică eroare.** Probele numără rânduri.
- **Unicitatea e pe hârtie, nu pe amendă:** `vf_numar_uq` (parțial, pe organizație,
  vehicul și numărul NORMALIZAT de trigger) refuză aceeași hârtie introdusă de două ori.

## Cine conducea — `app.sofer_la` și `public.sofer_sugerat`

`app.sofer_la(org, vehicul, moment)` e SECURITY DEFINER și **își judecă singură apelantul**
(`vehicle_fines:create` all sau `vehicle_incidents:create` all, sau platforma); ceilalți
primesc zero rânduri. Ordinea: ÎNTÂI linia de foaie (`trip_sheet_curse`) care acoperă
momentul, pe o foaie care nu e respinsă; o linie fără sosire durează până la sfârșitul zilei
foii. APOI alocarea deschisă atunci (`vehicle_assignments`, interval semideschis). Planul
(F2) o pusese în 0173, dar acolo n-a ajuns; se naște în 0206. Prin `.rpc()` se cheamă
învelișul `public.sofer_sugerat`, fiindcă PostgREST nu expune schema `app`.

**E doar sugestie.** Selectorul din caseta de desemnare e precompletat, dar omul alege:
cineva a putut conduce mașina altuia, sau foaia n-a fost completată. Sugestia spune pe ce
se sprijină (foaia sau alocarea).

## Scrisoarea de răspuns (art. 39) — ruta cu CNP

Ruta cere TREI lucruri, în ordine: `vehicle_fines:read` all, `employees:read` all și o
amendă cu șofer desemnat. A doua poartă există fiindcă scrisoarea poartă CNP-ul întreg și îl
citește prin `hr_read_sensitive`, care cere `employees:read = all` EXACT și scrie un rând de
audit la fiecare apel; fără ea, cine vede amenzile dar nu fișele ar primi o scrisoare cu linie
goală la CNP, fără să știe de ce. Testul rutei (`route.test.ts`) probează că la 403 nu se
cheamă nici `hr_read_sensitive`.

Ce lipsește din fișă (CNP, domiciliu/reședință, serie și număr act) NU se inventează:
documentul lasă linie de completat și o spune sus, răspunsul rămâne 200. Conținutul vine din
`modelScrisoareDesemnare` (domeniu, cu teste), așezarea din `scrisoare-desemnare.ts`.
Ruta nu marchează amenda „răspuns trimis”: asta o face omul, după ce a semnat și a trimis
scrisoarea (`trimiteRaspuns`).

## Recuperarea de la șofer NU e automată

Pagina o spune pe ecran (`NOTA_RECUPERARE`, în domeniu): reținerea din salariu „cu titlu de
daune” cere o datorie scadentă, lichidă și exigibilă, constatată printr-o hotărâre
judecătorească definitivă și irevocabilă (Codul muncii art. 169 alin. (2)); recuperarea prin
acordul părților urmează art. 254 (notă de constatare și evaluare, termen de cel puțin 30 de
zile, plafon de 5 salarii minime brute). Aplicația nu calculează plafonul, nu ține nota și nu
scrie nimic pe statul de plată. Vezi `NOTES.md` pentru articolele verificate.

## Erori traduse

În `flota/erori.ts`, blocul „amenzi și daune”: `traduEroareAmenzi` pune pe câmp restricțiile
(`vf_*`, `vi_*`) și mesajele P0001 ale triggerelor; refuzurile de stadiu rămân mesaj general,
cu textul bazei. `erori-amenzi.test.ts` citește migrarea și cere ca FIECARE mesaj să fie fie
mapat pe un câmp, fie declarat general: un mesaj nou fără traducere pică testul.

## Ce se mișcă împreună

Migrarea → `src/types/database.ts` → `src/schemas/flota-amenzi.ts` →
`src/lib/queries/flota-amenzi.ts` → `actions-amenzi.ts` → paginile. Tranzițiile stau în
`src/domain/fleet/amenzi.ts`, iar `amenzi.test.ts` compară matricea cu textul migrării.
Cheile de permisiune: `src/config/permissions.ts` + seed-ul din 0206. Rutele intră și în
`file-module.ts` (filele), `porti-ruta.ts` (porțile), `destinatii.ts` (asistentul) și
`e2e/module.spec.ts`, în blocuri delimitate.

## Ce NU e aici

Declarația șoferului din „Mașina mea”, termenul în rezumatul zilnic și secțiunea de pe fișa
vehiculului: `[[modul/flota/declaratia-soferului]]`. Plata amenzii și reținerea din salariu
nu există. Costul unui incident NU intră în
service sau costuri de vehicul (traseul F7). Fișa șoferului: `[[modul/angajati]]`; permisele
și verificările încrucișate: `[[modul/flota/soferi]]`.

## Când NU e suficientă pagina asta

- Forma politicilor și a triggerelor: `0206_flota_amenzi_daune.sql`.
- Probele: `tests/rls/proba-flota-amenzi.sql` și blocul (l) „amenzi și daune” din `izolare.sql`.
