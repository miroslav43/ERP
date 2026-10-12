---
tip: modul
titlu: Flotă — drepturile pe roluri și „Mașina mea”
aliases: [masina-mea, flota-roluri, portal flota]
cai:
  - "supabase/migrations/0196_flota_roluri.sql"
  - "src/app/(portal)/portal/masina-mea/**"
  - "src/app/(app)/flota/foi/dialog-foaie-noua.tsx"
  - "src/app/(app)/flota/foi/date-foaie-noua.ts"
  - "tests/rls/proba-flota-roluri.sql"
tabele: [vehicles, vehicle_assignments, trip_sheets, fuel_entries]
permisiuni:
  [vehicles:read, trip_sheets:read, trip_sheets:create, trip_sheets:update, trip_sheets:approve]
feature: fleet
capcane: [17, 18]
scris_pe: 06086dd260a0cce4cafa725b74bd095393819297
scris_la: 2026-10-12
tags: [modul, operations]
---

# Flotă — drepturile pe roluri și „Mașina mea”

Extrasă din `[[modul/flota]]`. Descrie faza F3 a planului „Flotă completă”: cine scrie
ce, din migrarea `0196_flota_roluri.sql`.

## Matricea din seed

| Rol         | `vehicles:read` | `trip_sheets` read / create / update | `approve` |
| ----------- | --------------- | ------------------------------------ | --------- |
| `org_admin` | all             | all / all / all                      | all       |
| `manager`   | team            | team / own / own                     | team      |
| `employee`  | own             | own / own / own                      | —         |
| `hr`        | —               | —                                    | —         |

Rândurile sunt GLOBALE. O suprascriere pe firmă sau pe membru (0063) bate rândul global
în `app.has_permission`, deci o firmă care a închis flota unui rol din pagina de
permisiuni rămâne așa. Matricea publică (`matrice-roluri.ts`) și fișa de marketing
(`fise-module.ts`) se recompun din migrări și sunt fixate de testele lor.

## Ce refuză baza tăcut sau cu P0001

- **Pool-ul se vede, nu se administrează.** Sub `vehicles:read` own/team, un vehicul cu
  `pool = true` intră în listă, documente și anomalii (`app.poate_vedea_vehicul` cu trei
  argumente și `app.poate_vedea_vehicul_dupa_id`). Forma cu două argumente rămâne pentru
  `alocari_select`.
- **Foaia sub `all` cere mașina potrivită.** `internal.foi_parcurs_inainte` refuză cu
  P0001 („Vehiculul ales nu vă este alocat…”) o foaie pe un vehicul care nu e pool și nu
  are o alocare a șoferului în ziua plecării (ora României). Aceeași regulă la UPDATE,
  când se mută vehiculul, șoferul sau plecarea. Mesajul începe cu „Vehiculul”, deci
  `traduEroare` îl pune pe `vehicle_id`. Scope-ul `none` nu ajunge aici: îl refuză RLS.
- **Aprobatorul doar decide.** `foi_update` are o ramură de aprobare (aprobator pe echipă
  care vede foaia). Când apelantul nu poate scrie foaia pe `trip_sheets:update`, triggerul
  admite doar `trimis` → `aprobat`/`respins`, cu motivul; orice altă coloană schimbată dă
  P0001. Managerul nu trimite, nu redeschide și nu rescrie foaia subordonatului.
- **Foaia în numele altcuiva** sub `own` cade pe `foi_insert` (`app.poate_crea_foaie`) cu 42501. `creeazaFoaie` o refuză înainte, cu CONFLICT și text clar.
- **Storage.** `app.can_path` verifică entitatea la `team` și `own` și pe `trip_sheets`
  (segmentul 3 = fișa șoferului) și pe `vehicles` (segmentul 3 = vehiculul, proprietar =
  șoferul alocat; pool-ul doar la citire). `courses` își păstrează excepția din 0144.

## Șoferul foii în aplicație

`creeazaFoaie`: cu `trip_sheets:create = all` șoferul vine din formular (`null` →
VALIDARE pe `employee_id`). Sub `all`, șoferul e fișa PRINCIPALĂ a contului, citită prin
RLS (`fisaProprieFoaie`): fără ea, CONFLICT; cu alt id trimis, CONFLICT.
`foaieNouaSchema.employee_id` e deci nullable.

Caseta „Foaie nouă” (`DialogFoaieNoua`) primește `angajati: null` când șoferul e cel
conectat: selectorul dispare, iar câmpul lipsă pleacă `null`. Datele vin din
`dateFoaieNoua(org, { fel: "propriu", fisaId })` — mașina alocată plus pool-ul, NU tot ce
vede rolul (managerul vede și mașinile echipei, pe care foaia ar cădea cu P0001).
`bazaFoaie` alege unde duce „Deschide ciorna”. Contractul e fixat de
`dialog-foaie-noua.test.tsx` (happy-dom).

Pe `/flota/foi/[id]`, închiderea și alimentarea apar doar pe foaia proprie când
`trip_sheets:update` nu e `all`. Pe `/flota/[id]`, „Foaie nouă pe acest vehicul” apare sub
`all` doar pe pool sau pe mașina proprie.

## Portalul: `/portal/masina-mea`

| Rută                            | Poartă                                       |
| ------------------------------- | -------------------------------------------- |
| `/portal/masina-mea`            | `trip_sheets:read` own (fleet)               |
| `/portal/masina-mea?foaie=noua` | caseta, cu `trip_sheets:create`              |
| `/portal/masina-mea/foi/[id]`   | `trip_sheets:read` own; foaia altcuiva → 404 |

Intrarea de meniu `portal-masina` (fără slot pe bara de jos). Citirile filtrează EXPLICIT
pe fișa proprie (`vehicululMeu`, `foileMele` cu keyset peste `listeazaFoi`), ca la tot
portalul: un administrator care e și șofer ar vedea altfel tot parcul. Semaforul mașinii
e `semaforVehicul` din `src/domain/fleet/scadente.ts`, aceeași funcție ca în `/flota`.
Acțiunile foii revalidează și `/portal`, `/portal/masina-mea`, `/portal/masina-mea/foi/<id>`.

## Probe

`tests/rls/proba-flota-roluri.sql`, pe seed-ul real (fără rânduri de firmă): employee,
manager, hr, org_admin și `app.can_path`, cu rânduri numărate. `tests/rls/izolare.sql`,
blocul „flota pe roluri (0196)” din `(l)`: scrierile legitime ale angajatului și
managerului. `proba-flota-integritate.sql` folosește un vehicul pool, ca verificările ei
de RLS să nu fie umbrite de garda de vehicul.

## Ce NU e aici

Liniile foii, numerotarea și snapshot-ul vehiculului (F4). Notificările pe fluxul foii și
traducerea legăturii în `notificarile-mele/legaturi.ts` (F5). Permisele șoferilor pentru
`hr` (F9).
