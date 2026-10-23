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

## Paginile secțiunii

Pagina asta ține rutele și ce refuză baza; restul s-a spart după
`.claude/docs/meta/conventii.md`.

| Pagină                               | Ce ține                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------- |
| [[modul/flota/amenzi-actiuni]]       | Server Actions și tranzițiile lor, citirile, erorile traduse, ce se mișcă împreună          |
| [[modul/flota/amenzi-scrisoarea]]    | `app.sofer_la` (cine conducea), scrisoarea de la art. 39 cu CNP, recuperarea de la șofer    |
| [[modul/flota/declaratia-soferului]] | declarația din „Mașina mea”, termenul în rezumatul zilnic, secțiunea de pe fișa vehiculului |

## Rute și cine ajunge

| Rută / ecran                                | Poartă                                                                                    |
| ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `/flota/amenzi`, `/flota/amenzi/[id]`       | `vehicle_fines:read` all                                                                  |
| `/flota/incidente`, `/flota/incidente/[id]` | `vehicle_incidents:read` all                                                              |
| `/api/export/flota/amenzi/[id]/scrisoare`   | `vehicle_fines:read` all ȘI `employees:read` all (CNP: [[modul/flota/amenzi-scrisoarea]]) |

Cheile sunt seedate doar pentru `org_admin` și `super_admin`: decizia 3 a planului (HR doar
permisele șoferilor) rămâne, iar o firmă poate acorda cheile lui HR printr-o suprascriere.
`manager` și `employee` nu văd nimic, nici amenzile din echipa lor. Singura excepție:
`employee` are `vehicle_incidents:create = own` (își declară dauna din portal și își vede
doar declarațiile, `[[modul/flota/declaratia-soferului]]`). Matricea publică de pe
pagina de prezentare (`matrice-roluri.ts`) are două rânduri pentru ele, doar `org_admin` = all. Dacă o firmă acordă cheile
`create` lui HR, HR primește prin sugestie și cine conducea ce vehicul (`app.sofer_la` judecă după cheie). Casetele „Amendă nouă” și
„Incident nou” se deschid prin parametru (`?amenda=noua`, `?incident=nou`), ca la parc.

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
  `vehicle_fines:read` all). Forma din 0206 poartă și `driver_license` (0204) și
  `vehicle_service` (ramura F7): fără ele, scadențele respective ar dispărea din lista de
  conformitate fără nicio eroare. Proba (28) o păzește. După 0206 au rescris-o 0214
  (`fuel_card`) și 0218 (`vehicle_exit`), deci un `entity_type` nou pornește de la forma
  ULTIMĂ (azi 0218; grep pe toate migrările). — capcana #26
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

## Ce NU e aici

Declarația șoferului din „Mașina mea”, termenul în rezumatul zilnic și secțiunea de pe fișa
vehiculului: `[[modul/flota/declaratia-soferului]]`. Plata amenzii și reținerea din salariu
nu există. Costul unui incident NU intră în
service sau costuri de vehicul (traseul F7). Fișa șoferului: `[[modul/angajati]]`; permisele
și verificările încrucișate: `[[modul/flota/soferi]]`.

## Când NU e suficientă pagina asta

- Forma politicilor și a triggerelor: `0206_flota_amenzi_daune.sql`.
- Probele: `tests/rls/proba-flota-amenzi.sql` și blocul (l) „amenzi și daune” din `izolare.sql`.
