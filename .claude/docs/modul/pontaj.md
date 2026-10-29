---
tip: modul
titlu: Pontaj
aliases: [attendance, prezenta]
cai:
  - "src/app/(app)/pontaj/**"
  - "src/app/api/export/pontaj/arhiva/**"
  - "src/lib/queries/attendance.ts"
  - "src/lib/queries/pontaj-arhiva.ts"
  - "src/schemas/attendance.ts"
  - "src/domain/attendance/**"
  - "src/domain/reges/absente.ts"
tabele:
  [
    attendance_periods,
    attendance_entries,
    attendance_settings,
    attendance_approval_batches,
    attendance_week_submissions,
    attendance_week_submission_days,
    setari_pontare_rapida,
    puncte_lucru,
    contract_suspendari,
  ]
permisiuni:
  [
    attendance:read,
    attendance:create,
    attendance:update,
    attendance:approve,
    attendance:export,
    departments:update,
    departments:read,
    employees:update,
    employees:read,
    leave:read,
    payroll:create,
    payroll:update,
  ]
feature: attendance
capcane: [6, 7, 9, 17]
citeste_daca:
  - "buton de aprobare care nu apare → [[rol/manager]]"
  - "tranziție de perioadă respinsă → [[date/pontaj]]"
  - "zi respinsă pentru contract suspendat → [[modul/reges]]"
scris_pe: 6e0792e9aa37ea9f4b874d856489a4f0b9344c20
scris_la: 2026-10-29
tags: [modul, hr]
---

# Pontaj

Evidența zilnică a prezenței, pe perioade lunare care se deschid, se aprobă în loturi și
se blochează. Are trei fluxuri paralele: **ziua** (`attendance_entries`, interval
completat de mână prin `salveazaZiPontaj`), **săptămâna planificată**
(`attendance_week_submissions`, trimisă de angajat și decisă de manager) și
**pontarea rapidă** (`0096_pontaj_rapid.sql` — ceas „Am intrat"/„Am ieșit" sau
confirmarea zilei standard, apăsate din portal, scrise tot în `attendance_entries` cu
`sursa = pontare_rapida`). Care dintre ele îi e deschisă angajatului o decide **varianta
de pontaj** a firmei (`setari_pontare_rapida.varianta_pontaj`, 0165): pe `zilnic` toate
trei, pe `saptamanal` doar fișa săptămânii.

## Paginile modulului

Pagina asta e trunchiul; restul s-a spart pe subarborele de rute
(`.claude/docs/meta/conventii.md`).

| Pagină                     | Ce ține                                                                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [[modul/pontaj/actiuni]]   | Server Actions, citirile din `queries/attendance.ts`, ce se mișcă împreună la o schimbare de formă a zilei de pontaj |
| [[modul/pontaj/foaia]]     | `/pontaj`: butoanele antetului și porțile lor, cele trei vizualizări, sediul zilei, ce refuză baza pe foaie          |
| [[modul/pontaj/navigare]]  | unde duce fiecare nume și cu ce poartă, filtrul `?angajat=`, toastul cu acțiune după o scriere                       |
| [[modul/pontaj/varianta]]  | varianta pe zi sau pe săptămână: ce se stinge, refuzul scris de două ori, fișa care devine pontaj                    |
| [[modul/pontaj/saptamana]] | fișa săptămânii — plan sau pontaj, după variantă: RPC-ul cu `delete` + reinserare, scrierea în pontaj, plan ↔ fapt   |
| [[modul/pontaj/setari]]    | pontarea rapidă (0115), varianta de pontaj (0165), aprobarea ca alegere a firmei (0118), limitele legale             |

## Rute și cine ajunge

| Rută                       | Poartă                                                                                                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/pontaj`                  | `attendance:read` cu scope citit prin `scopeFor`; `approve` team și `update` all pentru butoanele lor; scrierea are DOUĂ porți, [[modul/pontaj/foaia]]                        |
| `/pontaj?vizualizare=…`    | aceeași poartă; vezi „Cele trei vizualizări" în [[modul/pontaj/foaia]]                                                                                                        |
| `/pontaj?angajat=…`        | aceeași poartă; filtru de INTRARE pe un singur om, vezi [[modul/pontaj/navigare]]                                                                                             |
| `/pontaj/aprobare`         | `attendance:approve` team; blocarea cere `all`; ancora `#saptamana-<id>` pentru notificări                                                                                    |
| `/pontaj/arhiva`           | `attendance:export` **all** — aceeași cheie ca `pontaj_arhive_lunare_select` (0134), nu `attendance:read`: un manager cu `read = team` ar deschide o listă goală, fără eroare |
| `/pontaj/perioade`         | `attendance:read` own; blocarea cere `approve` **all**                                                                                                                        |
| `/pontaj/perioade/[id]`    | `attendance:read` team                                                                                                                                                        |
| `/pontaj/saptamana`        | `attendance:create` own; decizia cere `approve` team; titlul, săptămâna implicită (`saptamanaImplicita`) și navigarea înainte (`existaSaptamanaUrmatoare`) depind de variantă |
| `/pontaj/setari`           | `attendance:update` all — fila **Pontarea**: `varianta_pontaj`, `mod_pontare_rapida`, `verificare_pontare`, `program_start`                                                   |
| `/pontaj/setari/reguli`    | `attendance:update` all — fila **Regulile de timp**: parametrii juridici versionați                                                                                           |
| `/pontaj/setari/coduri-qr` | `departments:update` all — fila **Coduri QR**: poarta SECRETULUI, ca afișul din `puncte-lucru`                                                                                |

Toate trec întâi prin `requireFeature(tenant.organizationId, "attendance")`. De ce codurile
QR nu se deschid cu cheia pontajului și ce butoane pune antetul: [[modul/pontaj/foaia]]. Pe
`/pontaj/perioade`, „Deschide luna" cere `attendance:create` **all**, iar blocarea și
redeschiderea trec printr-o casetă cu cifre, [[modul/pontaj/navigare]].

**Luna se naște deschisă** (`0132_pontaj_luni_deschise_implicit.sql`): rândul din
`attendance_periods` îl creează `internal.pontaj_perioada_lunii` la prima scriere, deci nu
mai există „lună nedeschisă" care să refuze pontajul. Rândul lipsă se citește într-un singur
loc, `stareaLunii` (`src/domain/attendance/luna.ts`); singura stare care refuză e `blocata`.

## Ce refuză baza tăcut

- **Coloanele calculate de triggere BEFORE nu se trimit din client**:
  `attendance_periods.data_inceput`/`data_sfarsit`/`blocata_la`/`blocata_de`,
  `attendance_entries.period_id` și `tip_zi` când e null. În plus, politicile INSERT
  **cer** `approved_at`/`approved_by`/`batch_id` = NULL,
  `attendance_approval_batches.linii_aprobate` = 0, `attendance_periods.status` =
  `deschisa`. Un INSERT cu doar (organization_id, an, luna) reușește. — capcana #6
- **`.upsert()` cade cu 42P10.** `attendance_entries_zi_uq` e index unic **parțial**
  (`where deleted_at is null`), iar PostgREST nu emite predicatul în `ON CONFLICT`.
  Salvarea unei zile și sincronizarea cu concediile se fac citire-apoi-INSERT-sau-UPDATE.
  — capcana #7
- **Tranzițiile perioadei sunt exact**: `deschisa`→{`in_aprobare`, `blocata`},
  `in_aprobare`→{`deschisa`, `blocata`}, `blocata`→`deschisa`.
  `blocata`→`in_aprobare` ridică P0001. Blocarea și deblocarea cer scope **all** — un
  manager cu `team` primește 42501, deci butonul se ascunde cu
  `can(permisiuni, "attendance:approve", "all")`. — capcana #9
- **Un UPDATE respins de `USING` afectează zero rânduri, fără eroare.** Orice tranziție
  face `.select()` după `.update()` și tratează rezultatul gol drept conflict. — capcana #17
- **O zi deschisă și neînchisă nu poate fi aprobată**: constrângerea
  `attendance_entries_aprobare_zi_incheiata_ck` (`0096_pontaj_rapid.sql`) cere ca
  `approved_at` să fie null cât timp există `ora_inceput` fără `ora_sfarsit`. 23514 NU e
  tradus de `traduEroare`, iar el ar cădea pe ÎNTREG lotul — de aceea `aprobaPontajBloc`
  filtrează zilele în curs înainte, le numără și întoarce `zileDeschise`. Constrângerea e
  plasa de sub filtru, nu invers; fără ea, „Am ieșit" de după aprobare e respins tăcut de
  `USING`. — capcana #17
- **Ziua din concediu are `approved_at` gol pe veci**: aprobarea pontajului o EXCLUDE
  (`liniiDeAprobat`, iar `aprobaPerioada` filtrează `leave_request_id is null`), fiindcă
  decizia s-a luat deja în Concedii. Citită după `approved_at`, purta în foaie punctul
  „așteaptă decizia" pe care nimeni nu-l mai putea stinge, deci `intrareaClient` o citește
  aprobată când are `leave_request_id`.
- **Sincronizarea concediilor ÎNLOCUIEȘTE ziua pontată**, nu o mai păstrează: un concediu
  de urgență peste o zi deja pontată se plătea și ca muncă, și ca zi scăzută din sold. Se
  rescrie ACELAȘI rând, golit de interval, sediu și decizie (`ZI_LUCRATA_GOLITA`), iar
  dovada rămâne în `audit_logs`. De aici `inlocuite` în rezultat; `pastrate` înseamnă acum
  UPDATE cu zero rânduri — ziua fusese aprobată între timp, iar `attendance_entries_update`
  o refuză celui fără `attendance:approve`. — capcana #17
- **Pontajul numărat de pe alt ecran poate fi 0, fără eroare**: `numarZilePontatePerioada`
  trece prin RLS, deci un rol cu `payroll:create` dar fără `attendance:read` numără zero
  zile — exact ce ar aduna și calculul lui, `pontaj_agregat_salarizare` fiind SECURITY
  INVOKER (`0049_salarizare_agregare_pontaj.sql`). Zilele respinse ies și ele din contor,
  [[modul/pontaj/foaia]].
- **`employee` nu-și poate citi propria fișă cu clientul autentificat**: politica
  `employees_select` (`0005_hr_rls.sql`) nu deschide drumul, deci `fisaProprie` folosește
  `createAdminSupabase()` cu filtru explicit pe `organization_id` și cere
  `is_primary = true`, cerința lui `app.current_employee_id`; `fisaDePontat` face la fel cu
  fișa ALEASĂ pe scope `all`, pentru `hired_on`. Același motiv pentru
  `puncte_lucru`: `puncte_lucru_select` (`0030_onboarding_companie.sql`) cere
  `departments:read`, pe care rolul `employee` nu-l are, deci codul de pe afiș se rezolvă
  tot cu clientul admin, filtrat pe organizație. — `0096_pontaj_rapid.sql`

Ce refuză baza pe foaie și în dialogul zilei — trunchierea peste `max_rows`, sediul declarat
pe o zi care nu e la birou, `intrariProprii` fără filtru pe om, ora brută din Postgres — e
în [[modul/pontaj/foaia]].

## Erori traduse

`src/app/(app)/pontaj/erori.ts`, funcția `traduEroare` (tip `never`, întrerupe fluxul
ca un `throw`):

- **23505** → mesaj propriu: ziua există deja pentru angajatul acela.
- **P0001** → mesajul triggerului **se propagă**, trunchiat. Deliberat: mesajele din
  `0013_attendance.sql` conțin cifrele („perioada 08.2026 este blocată"), iar traducerea
  generică le-ar înlocui cu un text fără informație. `error.details` și `error.hint` nu
  se propagă niciodată.

## Ce NU e aici

Concediile (`[[modul/concedii]]` — pontajul doar le sincronizează prin
`sincronizeazaConcediile`), sporurile și agregarea în state de plată
(`[[modul/salarizare]]`), și fișa angajatului (`[[modul/angajati]]`).

Butoanele pontării rapide nu sunt sub `/pontaj`: ecranele stau în
`src/app/(portal)/portal/`, iar afișul de tipărit și acțiunea care rotește `cod_pontaj`
rămân în `src/app/(app)/puncte-lucru/`. Fila **Coduri QR** doar ARATĂ codul și cheamă
acțiunea aceea, importată (`ButonCodQr`) — rescrisă aici, ar fi fost a doua implementare a
aceleiași reguli, adică locul unde cele două se despart tăcut. Aici sunt doar acțiunile pe
care le apelează și setările care le pornesc.

## Când NU e suficientă pagina asta

- Calculul efectiv al orelor și al intervalului de noapte: `src/domain/attendance/` și
  `src/app/(app)/pontaj/interval-noapte.ts`.
- Forma exactă a politicilor: migrarea `0013_attendance.sql`, care e și scheletul canonic
  pentru orice migrare nouă.
- Coloanele și tipurile pontării rapide, cu motivele lor: `0096_pontaj_rapid.sql`.
