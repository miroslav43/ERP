---
tip: modul
titlu: Pontaj
aliases: [attendance, prezenta]
cai:
  - "src/app/(app)/pontaj/**"
  - "src/lib/queries/attendance.ts"
  - "src/schemas/attendance.ts"
  - "src/domain/attendance/**"
tabele:
  [
    attendance_periods,
    attendance_entries,
    attendance_settings,
    attendance_approval_batches,
    attendance_week_submissions,
    attendance_week_submission_days,
  ]
permisiuni: [attendance:read, attendance:create, attendance:update, attendance:approve]
feature: attendance
capcane: [2, 6, 7, 9, 17]
citeste_daca:
  - "buton de aprobare care nu apare → [[rol/manager]]"
  - "tranziție de perioadă respinsă → [[date/pontaj]]"
scris_pe: c72c3e8dbdab4bbee1ff6f55e311080155c5c4a2
scris_la: 2026-08-28
tags: [modul, hr]
---

# Pontaj

Evidența zilnică a prezenței, pe perioade lunare care se deschid, se aprobă în loturi și
se blochează. Are două fluxuri paralele: **ziua** (`attendance_entries`, pontare
intrare/ieșire sau confirmarea zilei standard) și **săptămâna planificată**
(`attendance_week_submissions`, trimisă de angajat și decisă de manager).

## Rute și cine ajunge

| Rută                    | Poartă                                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| `/pontaj`               | `attendance:read` cu scope citit prin `scopeFor`; butoanele cer `create` own/all, `approve` team, `update` all |
| `/pontaj/aprobare`      | `attendance:approve` team; blocarea cere `all`                                                                 |
| `/pontaj/perioade`      | `attendance:approve` team/all, `attendance:create` all                                                         |
| `/pontaj/perioade/[id]` | `attendance:read` team                                                                                         |
| `/pontaj/saptamana`     | `attendance:create` own; decizia cere `approve` team                                                           |
| `/pontaj/setari`        | `attendance:update` all                                                                                        |

Toate trec întâi prin `requireFeature(tenant.organizationId, "attendance")`.

## Server Actions

Toate în `src/app/(app)/pontaj/actions.ts`, cu excepțiile notate.

| Funcție                                           | Permisiune / minScope          | Ce scrie                              |
| ------------------------------------------------- | ------------------------------ | ------------------------------------- |
| `deschidePerioada`                                | `attendance:create` / all      | perioada lunii, status `deschisa`     |
| `salveazaZiPontaj`                                | `attendance:create` / own      | o zi în `attendance_entries`          |
| `pontezaIntrarea`, `pontezaIesirea`               | `attendance:create` / own      | ora de intrare/ieșire pe ziua curentă |
| `confirmaZiuaStandard`                            | `attendance:create` / own      | ziua completă, din setări             |
| `stergeZiPontaj`                                  | `attendance:create` / own      | `deleted_at` pe zi                    |
| `aprobaPontajBloc`                                | `attendance:approve` / team    | lotul + liniile lui                   |
| `decideZiPontaj`                                  | `attendance:approve` / team    | verdictul pe o zi                     |
| `blocheazaPerioada`, `redeschidePerioada`         | `attendance:approve` / **all** | statusul perioadei                    |
| `sincronizeazaConcediile`                         | `attendance:create` / all      | zilele care vin din concedii aprobate |
| `trimiteSaptamanaPontaj` (`saptamana/actions.ts`) | `attendance:create` / own      | submisia săptămânii                   |
| `decideSaptamanaPontaj` (`saptamana/actions.ts`)  | `attendance:approve` / team    | verdictul pe săptămână                |
| `salveazaSetariPontaj` (`setari/actions.ts`)      | `attendance:update` / all      | `attendance_settings`                 |

## Citiri

`src/lib/queries/attendance.ts`, funcții libere cu `organizationId` primul argument:
`citestePerioada`, `citestePerioadaDupaId`, `listeazaPerioade`,
`listeazaAngajatiPontaj` (cursor keyset, `limita + 1`), `intrariLuna`,
`intrariProprii`, `setariPontaj`, `setariPontajComplete`, `istoricSetariPontaj`,
`loturiPerioadei`, `liniiDeAprobat`, `citesteSaptamanaPontaj`, `saptamaniDeAprobat`,
`departamente`.

## Ce refuză baza tăcut

Secțiunea care justifică pagina. Fiecare rând are artefact.

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
- **Foaia colectivă se paginează după ANGAJAT, nu după rânduri de pontaj.** PostgREST
  trunchiază tăcut peste `max_rows`; angajați × zile depășește pragul altfel. — capcana #2

## Erori traduse

`src/app/(app)/pontaj/erori.ts`, funcția `traduEroare` (tip `never`, întrerupe fluxul
ca un `throw`):

- **23505** → mesaj propriu: ziua există deja pentru angajatul acela.
- **P0001** → mesajul triggerului **se propagă**, trunchiat. Deliberat: mesajele din
  `0013_attendance.sql` conțin cifrele („perioada 08.2026 este blocată"), iar traducerea
  generică le-ar înlocui cu un text fără informație. `error.details` și `error.hint` nu
  se propagă niciodată.

## Ce se mișcă împreună

O schimbare de formă a zilei de pontaj atinge, în ordine: migrarea →
`src/types/database.ts` → `src/schemas/attendance.ts` →
`src/lib/queries/attendance.ts` → `src/app/(app)/pontaj/actions.ts` → `page.tsx` +
componenta de celulă. Calculul orelor stă separat, în `src/domain/attendance/`, cu teste.

## Ce NU e aici

Concediile (`[[modul/concedii]]` — pontajul doar le sincronizează prin
`sincronizeazaConcediile`), sporurile și agregarea în state de plată
(`[[modul/salarizare]]`), și fișa angajatului (`[[modul/angajati]]`).

## Când NU e suficientă pagina asta

- Calculul efectiv al orelor și al intervalului de noapte: `src/domain/attendance/` și
  `src/app/(app)/pontaj/interval-noapte.ts`.
- Forma exactă a politicilor: migrarea `0013_attendance.sql`, care e și scheletul canonic
  pentru orice migrare nouă.
