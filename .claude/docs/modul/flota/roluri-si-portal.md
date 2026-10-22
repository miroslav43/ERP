---
tip: modul
titlu: Flotă — drepturile pe roluri și „Mașina mea”
aliases: [masina-mea, flota-roluri, portal flota]
cai:
  - "supabase/migrations/0199_flota_roluri.sql"
  - "src/app/(portal)/portal/masina-mea/**"
  - "src/app/(app)/flota/foi/dialog-foaie-noua.tsx"
  - "src/app/(app)/flota/foi/date-foaie-noua.ts"
  - "tests/rls/proba-flota-roluri.sql"
tabele: [vehicles, vehicle_assignments, trip_sheets, fuel_entries]
permisiuni:
  [vehicles:read, trip_sheets:read, trip_sheets:create, trip_sheets:update, trip_sheets:approve]
feature: fleet
capcane: [17, 18]
scris_pe: 376052e0c8cbbb56c35b210dfda28d12158be879
scris_la: 2026-10-12
tags: [modul, operations]
---

# Flotă — drepturile pe roluri și „Mașina mea”

Extrasă din `[[modul/flota]]`. Descrie faza F3 a planului „Flotă completă”: cine scrie
ce, din migrarea `0199_flota_roluri.sql`.

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
  `pool = true` intră în listă și în documente (`app.poate_vedea_vehicul` cu trei
  argumente și `app.poate_vedea_vehicul_dupa_id`). Anomaliile NU urmează pool-ul: cea de
  pe o foaie se vede după FOAIE (`poate_vedea_foaie`), cea fără foaie după vehicul, fără
  pool, iar `vehicles:read = all` le vede pe toate. Mașina primită de la un coleg nu
  aduce anomaliile de pe foile lui. Nici service-ul și costurile (0203) nu urmează
  pool-ul: managerul le citește doar pe mașinile echipei. Forma cu două argumente rămâne
  pentru `alocari_select`.
- **Foaia sub `all` cere mașina potrivită.** `internal.foi_parcurs_inainte` refuză cu
  P0001 („Vehiculul ales nu vă este alocat…”) o foaie pe un vehicul care nu e pool și nu
  are o alocare a șoferului în ziua plecării (ora României). Aceeași regulă la UPDATE,
  când se mută vehiculul, șoferul sau plecarea. Mesajul începe cu „Vehiculul”, deci
  `traduEroare` îl pune pe `vehicle_id`. Scope-ul `none` nu ajunge aici: îl refuză RLS.
- **Aprobatorul doar decide.** `foi_update` are o ramură de aprobare (aprobator pe echipă
  care vede foaia). Când apelantul nu poate scrie foaia pe `trip_sheets:update`, triggerul
  admite doar `trimis` → `aprobat`/`respins`, cu motivul; orice altă coloană schimbată dă
  P0001. Managerul nu trimite, nu redeschide și nu rescrie foaia subordonatului.
- **Foaia nu se mută pe alt șofer decât cu drept de scriere pe șoferul NOU** (§C3, din
  revizia de securitate): altfel o foaie proprie trimisă devenea, într-un singur UPDATE,
  foaia aprobată a unui subordonat. Tot de acolo: sub `approve` ≠ `all`, nimeni nu aprobă
  o foaie întocmită (`created_by`) de el însuși.
- **Foaia aprobată e înghețată** (§C4, din santinela de izolare). Cu `update = own`,
  șoferul își rescria traseul foii aprobate, își muta `aprobat_de` pe alt om și își
  ștergea foaia și alimentările, direct prin PostgREST. Acum `created_by`, `trimis_la`,
  `aprobat_de`, `aprobat_la` le pune doar baza, pe orice UPDATE. Pe o foaie aprobată, sub
  `update` ≠ `all` nu se schimbă nimic (P0001, nici ștergerea, nici reînvierea), iar
  `org_admin` poate doar s-o storneze (`deleted_at`). `internal.alimentari_inainte`
  refuză orice schimbare pe alimentarea unei foi aprobate și mutarea unei alimentări pe
  altă foaie. Probat de (25)–(32).
- **Foaia trimisă nu se rescrie** (§C5, din revizia F3). Regresul de kilometraj se
  verifică doar la întocmire și la `draft` → `trimis`; pe foaia deja trimisă, șoferul
  cobora `km_plecare` sau umfla sosirea, iar aprobarea pecetluia cifrele. Pe o foaie
  trimisă se schimbă doar starea: retragerea în ciornă sau decizia. Orice altă coloană dă
  P0001 („…este trimisă spre aprobare…”). Probat de (33)–(36). **Din 0200 regula e pe
  orice scope și urmează și copiii**: alimentările și cursele se scriu doar pe ciornă,
  iar ștergerea logică e ireversibilă — `[[modul/flota/foaia-zilnica]]`.
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

| Rută                              | Poartă                                                              |
| --------------------------------- | ------------------------------------------------------------------- |
| `/portal/masina-mea`              | doar modulul fleet (0215: și omul fără drept pe foi)                |
| `/portal/masina-mea?foaie=noua`   | caseta, cu `trip_sheets:create`                                     |
| `/portal/masina-mea/foi/[id]`     | `trip_sheets:read` own; foaia altcuiva → 404                        |
| `/portal/masina-mea?incident=nou` | declarația de incident, cu `vehicle_incidents:create` own (0206 §F) |
| `/portal/masina-mea/rezervari`    | `vehicle_reservations:read` (0216): `[[modul/flota/rezervari]]`     |

Din 0215 (F12c, decizia 3), pagina nu mai cere `trip_sheets:read`: omul FĂRĂ drept pe foi
sau pe vehicule (de regulă `hr`) care conduce o mașină a firmei vede aici vehiculul alocat
LUI și PV-urile la care e parte, fără semafor, fără mașini comune și fără foi (secțiunea
foilor lipsește). Ramura e în `vehicule_select`; cardul mașinii nu o moștenește (0214
judecă prin `app.poate_vedea_vehicul_dupa_id`). Meniul ține încă intrarea pe
`trip_sheets:read`: hr-ul ajunge la pagină din notificare. PV-urile:
`[[modul/flota/proces-verbal]]`.

Declarația șoferului (mașina lui sau pool, doar declarațiile proprii, notificarea
responsabilului): `[[modul/flota/declaratia-soferului]]`.

Intrarea de meniu `portal-masina` (fără slot pe bara de jos). Citirile filtrează EXPLICIT
pe fișa proprie (`vehicululMeu`, `foileMele` cu keyset peste `listeazaFoi`), ca la tot
portalul: un administrator care e și șofer ar vedea altfel tot parcul. Semaforul mașinii
e `semaforVehicul` din `src/domain/fleet/scadente.ts`, aceeași funcție ca în `/flota`.
Acțiunile foii revalidează și `/portal`, `/portal/masina-mea`, `/portal/masina-mea/foi/<id>`.

## Probe

`tests/rls/proba-flota-roluri.sql`, pe seed-ul real (fără rânduri de firmă): employee,
manager, hr, org_admin și `app.can_path`, cu rânduri numărate. `tests/rls/izolare.sql`,
blocul „flota pe roluri (0199)” din `(l)`: scrierile legitime ale angajatului și
managerului. `proba-flota-integritate.sql` folosește un vehicul pool, ca verificările ei
de RLS să nu fie umbrite de garda de vehicul.

**Matricea rol × tabelă**: `tests/rls/proba-flota-matrice-roluri.sql`. Pe două
firme, sub org_admin, hr, manager și doi angajați, numără rândurile văzute pe fiecare
tabelă a flotei (plus `expirables`, `compliance_alerts`, `org-flota`), funcțiile
`public.*` ale flotei și INSERT/UPDATE pe tabelele de administrare și costuri, față de
matricea intenționată (hr: doar permisele; manager: echipa + pool, costurile doar ale
echipei; angajatul: mașina lui + pool, fără costuri); firma B numără zero.
`avantaj_natura_flota` e a salarizării (`payroll:read = all`): hr o primește.

**Defecte cunoscute** (rândurile „DEFECT” ale probei): `vehicle_documents.cost` și
`vehicles.valoare_achizitie` sunt COLOANE pe rânduri pe care angajatul și managerul
(pool) le văd. RLS-ul nu taie coloane, iar privilegiul pe coloană e al rolului
`authenticated`, comun tuturor: repararea cere o decizie de model.

## Ce NU e aici

Liniile foii, numerotarea și instantaneul vehiculului: `[[modul/flota/foaia-zilnica]]`
(F4, 0200). Notificările pe fluxul foii și
traducerea legăturii în `notificarile-mele/legaturi.ts` (F5). Permisele șoferilor pentru
`hr` (F9).
