---
tip: modul
titlu: Flotă — service, costuri, anvelope — acțiuni, scrieri refuzate, erori
aliases:
  [creeazaPlanService, adaugaIntrareService, adaugaCheltuiala, traduEroareService, caseta planului]
cai:
  - "supabase/migrations/0203_flota_service_costuri.sql"
  - "src/app/(app)/flota/actions-service.ts"
  - "src/app/(app)/flota/etichete-service.ts"
  - "src/app/(app)/flota/[id]/dialog-plan-service.tsx"
  - "src/app/(app)/flota/[id]/dialog-intrare-service.tsx"
  - "src/app/(app)/flota/[id]/dialog-cheltuiala.tsx"
  - "src/domain/fleet/service.ts"
  - "src/schemas/fleet-service.ts"
  - "tests/rls/proba-flota-service.sql"
tabele: [vehicle_service_plans, vehicle_service_entries, vehicle_expenses, vehicles]
permisiuni: [vehicles:update]
feature: fleet
capcane: [22]
scris_pe: c1ad3b039681d8b4d5f1f466c0c2a4e7f3ab67f8
scris_la: 2026-10-24
tags: [modul, operations]
---

# Flotă — acțiuni de service, scrieri refuzate, erori

Secțiune extrasă din [[modul/flota/service-si-costuri]], care trecuse plafonul de corp al
convenției vault-ului (`.claude/docs/meta/conventii.md`): acțiunile de scriere, ce refuză
baza tăcut la scriere, caseta planului și erorile traduse. Rutele, filele, citirile și
scadențele rămân acolo; costurile sunt pe
[[modul/flota/service-si-costuri/costuri]]; pagina de modul e [[modul/flota]].

## Server Actions

`src/app/(app)/flota/actions-service.ts`, toate `vehicles:update` / all.

| Funcție                                    | Ce face                                               |
| ------------------------------------------ | ----------------------------------------------------- |
| `creeazaPlanService`                       | plan nou (interval km și/sau luni, bază, avertizare)  |
| `actualizeazaPlanService`                  | corectură, inclusiv `activ` (oprit = iese din alerte) |
| `adaugaIntrareService`                     | intervenție făcută, opțional legată de plan           |
| `stergeIntrareService`, `stergeCheltuiala` | ștergere logică, zero rânduri = CONFLICT              |
| `adaugaCheltuiala`                         | cheltuială fără foaie (parcare, taxe, combustibil)    |

**Nu există „modifică intervenția” și „modifică cheltuiala”**: baza refuză cu P0001 orice
schimbare de dată, km, tip, plan, costuri sau anvelope după inserare. Se șterge și se
reintroduce, ca un plan să nu poată fi mutat de o corectură tăcută. Anvelopele montate
se schimbă și din formularul vehiculului (`actualizeazaVehicul`).

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
- **Vehiculul vândut sau casat nu mai primește planuri** (P0001); scadențele planurilor
  existente devin inactive prin triggerul `vehicles_service_sync` (separat de
  `vehicles_dupa`, ca să nu rescriu o funcție care sincronizează documentele).
- **Anvelopele montate urmează ultima intervenție de tip „anvelope”** (după dată) care le
  precizează; ștearsă ultima, câștigă cea dinainte, iar fără niciuna vehiculul își
  păstrează valoarea. `anvelope_montate` pe altă intervenție decât „anvelope” dă 23514
  (`vse_anvelope_ck`), spus pe câmp.

## Caseta planului

La corectură, previzualizarea „Următoarea scadență” pornește de la `ultimaEfectiva`
(domeniu): ultima intervenție legată de plan rămâne în joc cât timp baza introdusă e mai
veche decât ea, exact ca în `vsp_inainte`. Intervenția legată se deduce din `ultima_*` a
planului, strict peste baza lui veche.

## Erori traduse

`traduEroareService` în `erori.ts`: P0001 pe câmp (`baza_data`, `plan_id`,
`data_interventiei`, `data_cheltuielii`), CHECK-urile pe câmpul lor și numele planului
luat pe `denumire`. Vehiculul e câmp ASCUNS în casete, deci „Vehiculul ales nu există…”,
„Intervenția de service nu se modifică…” și restul rămân mesaj general. Mesajele sunt
citate din migrare în `erori-service.test.ts`.

## Când NU e suficientă pagina asta

Forma politicilor și a trigger-elor: migrarea `0203_flota_service_costuri.sql`. Probele:
`tests/rls/proba-flota-service.sql` și continuarea (l) din `tests/rls/izolare.sql`.
