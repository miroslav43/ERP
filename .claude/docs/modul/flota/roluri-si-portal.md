---
tip: modul
titlu: Flotă — drepturile pe roluri și „Mașina mea”
aliases: [flota-roluri, portal flota]
cai:
  - "supabase/migrations/0199_flota_roluri.sql"
  - "supabase/migrations/0226_securitate_reziduala.sql"
  - "tests/rls/proba-flota-roluri.sql"
  - "tests/rls/proba-flota-matrice-roluri.sql"
  - "tests/rls/proba-livrare-roluri.sql"
tabele:
  [
    vehicles,
    vehicle_assignments,
    trip_sheets,
    fuel_entries,
    vehicle_costuri,
    vehicle_document_costuri,
  ]
permisiuni:
  [vehicles:read, trip_sheets:read, trip_sheets:create, trip_sheets:update, trip_sheets:approve]
feature: fleet
capcane: [17, 18]
scris_pe: 3760e43cc77bfb934a236ef82ab1475d647c0a11
scris_la: 2026-10-30
tags: [modul, operations]
---

# Flotă — drepturile pe roluri și „Mașina mea”

Extrasă din `[[modul/flota]]`. Descrie faza F3 a planului „Flotă completă”: cine scrie
ce, din migrarea `0199_flota_roluri.sql`.

## Paginile modulului

Trunchiul ține matricea rolurilor, **ce refuză baza tăcut** și probele. Rutele
portalului și caseta foii noi s-au spart pe subpagini (`.claude/docs/meta/conventii.md`).

| Pagină                                      | Ce ține                                                         |
| ------------------------------------------- | --------------------------------------------------------------- |
| [[modul/flota/roluri-si-portal/masina-mea]] | rutele „Mașina mea”, poarta fiecăreia, citirile pe fișa proprie |
| [[modul/flota/roluri-si-portal/foaie-noua]] | de unde vine șoferul foii, caseta „Foaie nouă”, unde apare      |

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
  pool-ul: managerul le citește doar pe mașinile echipei, iar pool-ul alocat unui om din
  echipă rămâne al firmei (`app.poate_vedea_costurile_vehiculului`). Forma cu două
  argumente rămâne pentru `alocari_select`.
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
  iar ștergerea logică e ireversibilă — `[[modul/flota/foaia-zilnica-garzi]]`.
- **Foaia în numele altcuiva** sub `own` cade pe `foi_insert` (`app.poate_crea_foaie`) cu 42501. `creeazaFoaie` o refuză înainte, cu CONFLICT și text clar.
- **Administratorul de platformă citește foile, nu le scrie.** `foi_select` a primit
  ramura `app.is_platform_admin()` în `supabase/migrations/0226_securitate_reziduala.sql`,
  ca `alimentari_select` și `curse_select`; până atunci `super_admin` număra zero foi de
  parcurs. Filtrul de rând al firmei rămâne cel din 0016, iar scrierea foii nu primește
  ramura.
- **Storage.** `app.can_path` verifică entitatea la `team` și `own` și pe `trip_sheets`
  (segmentul 3 = fișa șoferului) și pe `vehicles` (segmentul 3 = vehiculul, proprietar =
  șoferul alocat; pool-ul doar la citire). `courses` își păstrează excepția din 0144.

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
echipei; angajatul: mașina lui + pool, fără costuri); firma B numără zero. Blocul
pool-ului alocat unui om din echipă are și poarta POZITIVĂ de lângă refuz: pe mașina
echipei care nu e în pool, managerul vede în continuare service-ul și cheltuielile.
`avantaj_natura_flota` e a salarizării (`payroll:read = all`): hr o primește.

**Scrierea reală pe toate tabelele livrării**: `tests/rls/proba-livrare-roluri.sql`. Pe
un singur fixture, fiecare tabelă și funcție `public.*` nouă din 0191, 0199–0206,
0210–0218, 0225 și 0226, sub super_admin, org_admin, hr, manager, doi angajați și
administratorul altei firme: SELECT numărat, INSERT și UPDATE efective (derulate înapoi),
plus legarea din firma străină de obiectele firmei A. Acoperă costul documentelor
(`vehicle_document_costuri`, cu coloana veche `vehicle_documents.cost` goală), ramura de
platformă a foilor, repotrivirea tranzacțiilor de card și loturile de import
(`import_uploads`: le vede și le consumă doar cine le-a creat). Rândurile pool-ului alocat
unui om din echipă trec acum prin aceeași matrice, sub toate cele șapte identități;
alocarea cere pool-ul fără rezervări active, deci administratorul le anulează întâi sub
identitatea lui, ca în aplicație. `flota_fiscal_luna` (SECURITY INVOKER peste `vehicles`)
filtrează pe `app.poate_vedea_vehicul`, deci hr-ul cu mașină nu moștenește ramura
„decizia 3” în raportul fiscal (reparat în 0205).

**Costurile nu urmează rândul vizibil** (0225, pachetul X1): valoarea de achiziție și
costul documentelor stau în `vehicle_costuri` / `vehicle_document_costuri`, cu citirea
costurilor (`vehicles:update = all`, sau `read >= team` pe mașina echipei care nu e în
pool, nici alocată cuiva din echipă) — aceeași regulă ca planurile, intervențiile și
cheltuielile: angajatul și hr-ul (și cu mașină) — nimic, managerul — echipa. Coloanele
vechi sunt goale; detaliile: `[[modul/flota/service-si-costuri]]`. Singura excepție
intenționată, a salarizării: `[[modul/flota/fiscal]]`. La incidente, șoferul nu mai
citește rândul: `[[modul/flota/declaratia-soferului]]`. Probele numără celulele, fără
rânduri „DEFECT”.

## Ce NU e aici

Liniile foii, numerotarea și instantaneul vehiculului: `[[modul/flota/foaia-zilnica]]`
(F4, 0200). Notificările pe fluxul foii și
traducerea legăturii în `notificarile-mele/legaturi.ts` (F5). Permisele șoferilor pentru
`hr` (F9).
