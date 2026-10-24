---
tip: modul
titlu: Flotă — service, costuri, anvelope
aliases:
  [
    vehicle_service_plans,
    planuri de service,
    intervenții service,
    cheltuieli vehicul,
    anvelope,
    cost pe km,
  ]
cai:
  - "supabase/migrations/0203_flota_service_costuri.sql"
  - "src/app/(app)/flota/actions-service.ts"
  - "src/app/(app)/flota/etichete-service.ts"
  - "src/app/(app)/flota/[id]/fila-service.tsx"
  - "src/app/(app)/flota/[id]/dialog-plan-service.tsx"
  - "src/app/(app)/flota/[id]/dialog-intrare-service.tsx"
  - "src/app/(app)/flota/[id]/dialog-cheltuiala.tsx"
  - "src/domain/fleet/service.ts"
  - "src/lib/queries/fleet-service.ts"
  - "src/schemas/fleet-service.ts"
  - "tests/rls/proba-flota-service.sql"
  - "tests/rls/proba-oracol-intre-firme.sql"
tabele: [vehicle_service_plans, vehicle_service_entries, vehicle_expenses, expirables, vehicles]
permisiuni: [vehicles:read, vehicles:update]
feature: fleet
capcane: [19, 26]
scris_pe: c1ad3b039681d8b4d5f1f466c0c2a4e7f3ab67f8
scris_la: 2026-10-24
tags: [modul, operations]
---

# Flotă — service, costuri, anvelope

Extrasă din `[[modul/flota]]`. Migrarea: `0203_flota_service_costuri.sql` (planul o numea
0177; numerele intermediare s-au ocupat). Tabelele sunt PROPRII flotei, nu
`equipment.vehicle_id`: flota merge cu mentenanța oprită, iar utilajele n-au kilometri
de bord.

## Paginile secțiunii

Pagina asta ține rutele, filele, citirile și scadențele; costurile și acțiunile s-au
spart după `.claude/docs/meta/conventii.md`.

| Pagină                                     | Ce ține                                                         |
| ------------------------------------------ | --------------------------------------------------------------- |
| [[modul/flota/service-si-costuri/costuri]] | totalul filei Costuri, cine vede foile, valorile ascunse (0225) |
| [[modul/flota/service-si-costuri/actiuni]] | acțiunile de scriere, scrierile refuzate, caseta, erorile       |

## Rute și cine ajunge

Nu există rute noi: fișa `/flota/[id]` primește file prin `?fila=service` și
`?fila=costuri` (plus `?perioada=3|6|12|tot` și `?cursor=` pe Costuri). Fila se oferă
doar cui poate citi service-ul: `vehicles:update = all`, `vehicles:read = all`, sau `team`
pe o mașină care NU e în pool — exact `app.poate_vedea_costurile_vehiculului` (0203 §7),
regula TUTUROR costurilor flotei. Pe un pool, sub `team`, filele lipsesc. Un `?fila=`
scris de mână pe un cont fără drept cade pe fișa obișnuită, nu pe un ecran gol. Scrierea
cere `vehicles:update` all — literal ca politicile. Managerul citește planurile,
intervențiile și cheltuielile mașinii echipei lui, nu și ale mașinii comune, nici când
e alocată unui om din echipă (blocurile „pool cu șofer” din `proba-flota-matrice-roluri.sql`
și `proba-livrare-roluri.sql`); șoferul (`own`) și `hr` nu citesc nimic, fără eroare:
află de scadență din notificare. Fila Costuri a managerului NU arată cifrele derivate
din foi ([[modul/flota/service-si-costuri/costuri]]).

## Citiri

`src/lib/queries/fleet-service.ts`: `planuriService` (plafon, nu paginare),
`intrariService` și `cheltuieliVehicul` (cursor keyset pe dată + id, ca restul flotei) și
`costuriVehicul(…, cuFoi)`, care adună patru surse prin `citesteTot` — `max_rows` ar tăia
tăcut o agregare. Foile aprobate vin cu alimentările într-un singur răspuns (embed), ca lista de
id-uri să nu ajungă într-un `.in()`. Pragul de salt pentru avertizarea din casetă vine
din `pragSaltVehicul` (`[[modul/flota/alerte-si-setari]]`).

## Ce refuză baza tăcut

- **Doar scadența pe DATĂ ajunge în `expirables`** (`entity_type = 'vehicle_service'`,
  `entity_id` = vehiculul, `kind` = planul). Planul doar pe kilometri n-are dată: îl ia
  jobul zilnic. NICIO listă din aplicație nu citește `expirables` pentru flotă: semaforul
  listei (`semaforVehicul`) vine din `vehicle_documents`, deci un plan de service NU îl
  aprinde. Scadența pe dată ajunge în alertele din 0008 și în rezumatul de dimineață; starea
  o arată fila Service, calculată din `vehicle_service_plans` (`stareaPlanului`).
  Textele din ecrane și din marketing spun exact asta. — capcanele #19, #26
- **`app.poate_vedea_expirabil` a fost rescrisă COMPLET** (nu doar completată) și acum
  conține și `vehicle_service`. O migrare viitoare care adaugă un `entity_type` pornește
  de la forma ULTIMĂ (după 0203 au rescris-o 0204, 0206, 0214 și 0218; azi 0218), NU de la
  `0011` și nici de la 0203: funcția e un `case`, iar o copie veche pierde
  tăcut ramurile celorlalte module (cele noi ajung pe `else false`, deci invizibile).
  Proba (13) numără ramurile și o prinde. Garda din 0023 (nicio ramură nu acceptă
  `employees:read` cu scope `own`) trece.
- **Memento-urile fără dată** (alerta pe km, anvelopele din noiembrie) nu au rând în
  `compliance_alerts`, deci dedup-ul stă în `internal.flota_mementouri`. „Aproape de
  scadență” și „depășit” pleacă fiecare O DATĂ per ciclu (cheia conține ținta de km:
  după o intervenție ținta se mută și ciclul se reia). Anvelopele: doar noiembrie, o
  dată pe an, doar pentru `anvelope_montate = 'vara'`. Un element pe care nu-l vede
  niciun destinatar nu se marchează trimis și se reia a doua zi.
- **Tipul de document `revizie` e retras pe platformă** (0203); documentele deja scrise
  pe el rămân și se corectează; o firmă îl reactivează din setările de tipuri (0202).

## Ce se mișcă împreună

Migrarea → `database.ts` → `schemas/fleet-service.ts` (limitele sunt `LIMITE_SERVICE` din
domeniu, lipite de migrare printr-un test) → `queries/fleet-service.ts` → acțiuni →
`fila-*.tsx`. Enumurile (`vehicle_service_type`, `vehicle_expense_category`,
`vehicle_tire_set`) sunt lipite de `etichete-service.ts` prin `etichete-service.test.ts`.
Jobul zilnic (`internal.conformitate_zilnica`) și rezumatul de scadențe:
`[[modul/flota/alerte-si-setari]]`.

## Ce NU e aici

Mentenanța utilajelor și ISCIR: `[[modul/mentenanta]]`. Rapoartele lunare și pachetul
pentru contabil: `[[modul/flota/rapoarte]]`. Costul documentelor se scrie la documente
(`[[modul/flota/documente-si-erori]]`).

## Când NU e suficientă pagina asta

Forma politicilor și a trigger-elor: migrarea 0203. Probele:
`tests/rls/proba-flota-service.sql` și continuarea (l) din `tests/rls/izolare.sql`.
