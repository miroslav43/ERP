---
tip: modul
titlu: Flotă — service, costuri, anvelope
aliases: [vehicle_service_plans, planuri de service, intervenții service, cheltuieli vehicul, anvelope, cost pe km]
cai:
  - "supabase/migrations/0200_flota_service_costuri.sql"
  - "src/app/(app)/flota/actions-service.ts"
  - "src/app/(app)/flota/etichete-service.ts"
  - "src/app/(app)/flota/[id]/fila-service.tsx"
  - "src/app/(app)/flota/[id]/fila-costuri.tsx"
  - "src/app/(app)/flota/[id]/dialog-plan-service.tsx"
  - "src/app/(app)/flota/[id]/dialog-intrare-service.tsx"
  - "src/app/(app)/flota/[id]/dialog-cheltuiala.tsx"
  - "src/domain/fleet/service.ts"
  - "src/domain/fleet/costuri.ts"
  - "src/lib/queries/fleet-service.ts"
  - "src/schemas/fleet-service.ts"
  - "tests/rls/proba-flota-service.sql"
tabele:
  [vehicle_service_plans, vehicle_service_entries, vehicle_expenses, expirables, vehicles]
permisiuni: [vehicles:read, vehicles:update]
feature: fleet
capcane: [19, 22, 26]
scris_pe: 64685e9896bff6384373ccdb8b9b8e7f4accb4cd
scris_la: 2026-10-12
tags: [modul, operations]
---

# Flotă — service, costuri, anvelope

Extrasă din `[[modul/flota]]`. Migrarea: `0200_flota_service_costuri.sql` (planul o numea
0177; numerele intermediare s-au ocupat). Tabelele sunt PROPRII flotei, nu
`equipment.vehicle_id`: flota merge cu mentenanța oprită, iar utilajele n-au kilometri
de bord.

## Rute și cine ajunge

Nu există rute noi: fișa `/flota/[id]` primește file prin `?fila=service` și
`?fila=costuri` (plus `?perioada=3|6|12|tot` și `?cursor=` pe Costuri). Fila se oferă
doar cui poate citi service-ul, adică `vehicles:read` cel puțin `team` ȘI vehiculul
vizibil; un `?fila=` scris de mână pe un cont fără drept cade pe fișa obișnuită, nu pe un
ecran gol. Scrierea cere `vehicles:update` all — literal ca politicile. Managerul
citește planurile, intervențiile și costurile mașinii echipei lui; șoferul (`own`) și
`hr` nu citesc nimic, fără eroare: află de scadență din notificare.

## Server Actions

`src/app/(app)/flota/actions-service.ts`, toate `vehicles:update` / all.

| Funcție                                     | Ce face                                              |
| ------------------------------------------- | ---------------------------------------------------- |
| `creeazaPlanService`                        | plan nou (interval km și/sau luni, bază, avertizare) |
| `actualizeazaPlanService`                   | corectură, inclusiv `activ` (oprit = iese din alerte) |
| `adaugaIntrareService`                      | intervenție făcută, opțional legată de plan          |
| `stergeIntrareService`, `stergeCheltuiala`  | ștergere logică, zero rânduri = CONFLICT             |
| `adaugaCheltuiala`                          | cheltuială fără foaie (parcare, taxe, combustibil)   |

**Nu există „modifică intervenția” și „modifică cheltuiala”**: baza refuză cu P0001 orice
schimbare de dată, km, tip, plan, costuri sau anvelope după inserare. Se șterge și se
reintroduce, ca un plan să nu poată fi mutat de o corectură tăcută. Anvelopele montate
se schimbă și din formularul vehiculului (`actualizeazaVehicul`).

## Citiri

`src/lib/queries/fleet-service.ts`: `planuriService` (plafon, nu paginare),
`intrariService` și `cheltuieliVehicul` (cursor keyset pe dată + id, ca restul flotei) și
`costuriVehicul`, care adună patru surse prin `citesteTot` — `max_rows` ar tăia tăcut o
agregare. Foile aprobate vin cu alimentările într-un singur răspuns (embed), ca lista de
id-uri să nu ajungă într-un `.in()`. Pragul de salt pentru avertizarea din casetă vine
din `pragSaltVehicul` (`[[modul/flota/alerte-si-setari]]`).

## Ce refuză baza tăcut

- **`ultima_*`, `urmatoarea_data`, `urmatorii_km` și `cost_total` nu se trimit.**
  Planul își calculează singur (trigger BEFORE) ultima intervenție — cea mai recentă dintre
  BAZA introdusă de om și intervențiile vii legate — și următoarea scadență; `cost_total`
  e GENERATED. Ce trimite clientul în derivate se ignoră; formularul cere `baza_*`.
  Ștearsă o intervenție legată, planul revine la cea dinainte sau la bază. — capcana #22
- **Intervenția ridică `vehicles.km_curent` și nu-l coboară niciodată.** O intervenție
  veche, introdusă târziu, rămâne istoric. Ștergerea ei NU scade kilometrajul; corectura
  e `corecteazaKilometraj`, cu motiv auditat. Caseta avertizează pe loc (domeniul
  `evaluareKmIntrare`, peste `verificaContinuitate`): „sub kilometraj” = istoric, „salt” =
  probabil cifră greșită — se semnalează, nu se blochează.
- **Doar scadența pe DATĂ ajunge în `expirables`** (`entity_type = 'vehicle_service'`,
  `entity_id` = vehiculul, `kind` = planul). Planul doar pe kilometri n-are dată și
  n-apare în semafor: îl ia jobul zilnic. Semaforul nu se citește din `expirables` pentru
  cine nu are `compliance:read` — fila calculează starea din `vehicle_service_plans`
  (`stareaPlanului`). — capcanele #19, #26
- **`app.poate_vedea_expirabil` a fost rescrisă COMPLET** (nu doar completată) și acum
  conține și `vehicle_service`. O migrare viitoare care adaugă un `entity_type` pornește
  de la forma din 0200, NU de la `0011`: funcția e un `case`, iar o copie veche pierde
  tăcut ramurile celorlalte module (cele noi ajung pe `else false`, deci invizibile).
  Proba (13) numără ramurile și o prinde. Garda din 0023 (nicio ramură nu acceptă
  `employees:read` cu scope `own`) trece.
- **Vehiculul vândut sau casat nu mai primește planuri** (P0001); scadențele planurilor
  existente devin inactive prin triggerul `vehicles_service_sync` (separat de
  `vehicles_dupa`, ca să nu rescriu o funcție care sincronizează documentele).
- **Memento-urile fără dată** (alerta pe km, anvelopele din noiembrie) nu au rând în
  `compliance_alerts`, deci dedup-ul stă în `internal.flota_mementouri`. „Aproape de
  scadență” și „depășit” pleacă fiecare O DATĂ per ciclu (cheia conține ținta de km:
  după o intervenție ținta se mută și ciclul se reia). Anvelopele: doar noiembrie, o
  dată pe an, doar pentru `anvelope_montate = 'vara'`. Un element pe care nu-l vede
  niciun destinatar nu se marchează trimis și se reia a doua zi.
- **Anvelopele montate urmează ultima intervenție de tip „anvelope”** (după dată) care le
  precizează; ștearsă ultima, câștigă cea dinainte, iar fără niciuna vehiculul își
  păstrează valoarea. `anvelope_montate` pe altă intervenție decât „anvelope” dă 23514
  (`vse_anvelope_ck`), spus pe câmp.
- **Tipul de document `revizie` e retras pe platformă** (0200); documentele deja scrise
  pe el rămân și se corectează; o firmă îl reactivează din setările de tipuri (0199).

## Costuri

Totalul adună patru surse, fiecare cu originea ei, ca nimic să nu fie numărat de două
ori: service (`cost_total`), combustibilul de pe foile APROBATE, cheltuielile fără foaie
(inclusiv „combustibil fără foaie”) și costul documentelor cu valabilitatea începută în
perioadă. Costul pe km și consumul real se împart la kilometrii foilor aprobate din
aceeași perioadă; fără foi, cifra lipsește (și ecranul spune de ce), nu devine „0 lei/km”.
Combustibilul fără foaie nu intră în consum: n-are kilometri cu care să fie pereche.
Adunările trec prin bani întregi (`sumaLei`).

## Erori traduse

`traduEroareService` în `erori.ts`: P0001 pe câmp (`baza_data`, `plan_id`,
`data_interventiei`, `data_cheltuielii`), CHECK-urile pe câmpul lor și numele planului
luat pe `denumire`. Vehiculul e câmp ASCUNS în casete, deci „Vehiculul ales nu există…”,
„Intervenția de service nu se modifică…” și restul rămân mesaj general. Mesajele sunt
citate din migrare în `erori-service.test.ts`.

## Ce se mișcă împreună

Migrarea → `database.ts` → `schemas/fleet-service.ts` (limitele sunt `LIMITE_SERVICE` din
domeniu, lipite de migrare printr-un test) → `queries/fleet-service.ts` → acțiuni →
`fila-*.tsx`. Enumurile (`vehicle_service_type`, `vehicle_expense_category`,
`vehicle_tire_set`) sunt lipite de `etichete-service.ts` prin `etichete-service.test.ts`.
Jobul zilnic (`internal.conformitate_zilnica`) și rezumatul de scadențe:
`[[modul/flota/alerte-si-setari]]`.

## Ce NU e aici

Mentenanța utilajelor și ISCIR: `[[modul/mentenanta]]`. Rapoartele și pachetul lunar
pentru contabil (F8) nu există încă. Costul documentelor se scrie la documente
(`[[modul/flota/documente-si-erori]]`).

## Când NU e suficientă pagina asta

Forma politicilor și a trigger-elor: migrarea 0200. Probele:
`tests/rls/proba-flota-service.sql` și continuarea (l) din `tests/rls/izolare.sql`.
