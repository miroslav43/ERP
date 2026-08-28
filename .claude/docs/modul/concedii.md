---
tip: modul
titlu: Concedii
aliases: [leave, CO, CM]
cai:
  - "src/app/(app)/concedii/**"
  - "src/lib/queries/leave.ts"
  - "src/schemas/leave.ts"
  - "src/domain/leave/**"
tabele:
  [
    leave_requests,
    leave_request_days,
    leave_types,
    leave_type_variants,
    leave_balances,
    leave_entitlement_rules,
    approval_tasks,
  ]
permisiuni: [leave:read, leave:create, leave:update, leave:approve]
feature: leave
capcane: [11, 17, 33]
citeste_daca:
  - "cerere care rămâne în aceeași stare → [[date/pontaj]]"
  - "buton de aprobare absent → [[rol/manager]]"
scris_pe: c72c3e8dbdab4bbee1ff6f55e311080155c5c4a2
scris_la: 2026-08-28
tags: [modul, hr]
---

# Concedii

Cereri de concediu cu lanț de aprobare, solduri anuale calculate din reguli de drept, și
un calendar de echipă. E **motorul generic de aprobare** al proiectului: `approval_tasks`
apare și în alte module, iar tiparul de tranziție de aici se copiază.

## Rute și cine ajunge

| Rută                                     | Poartă                                                          |
| ---------------------------------------- | --------------------------------------------------------------- |
| `/concedii`                              | `leave:read` own/team/all după scope; creare own; aprobare team |
| `/concedii/noua`                         | `leave:create` own (all pentru altcineva)                       |
| `/concedii/[id]`                         | `leave:read` own/team; `leave:update` own                       |
| `/concedii/aprobari`                     | `leave:approve` team                                            |
| `/concedii/echipa`, `/concedii/calendar` | `leave:read` team                                               |
| `/concedii/sold`                         | `leave:read` own/team/all                                       |
| `/concedii/setari`                       | `leave:update` all                                              |

Toate trec prin `requireFeature(tenant.organizationId, "leave")`.

## Server Actions

`src/app/(app)/concedii/actions.ts` (cererea) și `setari/actions.ts` (configurarea).

| Funcție                                                                                 | Permisiune / minScope  |
| --------------------------------------------------------------------------------------- | ---------------------- |
| `creeazaCerereConcediu`                                                                 | `leave:create` / own   |
| `trimiteCerere`, `anuleazaCerere`                                                       | `leave:update` / own   |
| `decideCerere`                                                                          | `leave:approve` / team |
| `actualizeazaTipConcediu`, `comutaActivTipConcediu`                                     | `leave:update` / all   |
| `creeazaRegulaConcediu`                                                                 | `leave:create` / all   |
| `dezactiveazaRegulaConcediu`, `seteazaZileConcediuImplicit`, `aplicaDrepturileConcediu` | `leave:update` / all   |

## Citiri

`src/lib/queries/leave.ts`: `listeazaCereri`, `citesteCerere`, `zileleCererii`,
`lantulAprobarii`, `soldAnual`, `istoricSold`, `numarDeAprobat`, `deAprobat`,
`calendarLunii`, `zileNelucratoare`, `configurareConcedii`, `previzualizeazaDrepturi`,
`coduriIndemnizatieMedicala`, `varianteConcediu`.

## Ce refuză baza tăcut

- **Un UPDATE respins de `USING` afectează zero rânduri, fără eroare.** Cazul canonic e
  chiar aici: un angajat care încearcă `in_aprobare`→`aprobata` pe propria cerere.
  `decideCerere` și `trimiteCerere` fac `.select()` după `.update()` și tratează
  rezultatul gol drept conflict — altfel omul vede „succes" fără ca nimic să se fi
  schimbat. — capcana #17
- **`leave_requests` e excepția de la regula `set_actor`:** aici politica de INSERT cere
  `created_by = auth.uid()` și acțiunea îl trimite **explicit**. În modulele acoperite de
  `internal.set_actor`, `created_by` nu se trimite niciodată din client. Nu copia
  tiparul în ambele direcții fără să verifici. — capcana #33
- **Cursorul keyset pe text** (`full_name`, `denumire`) cere funcția `ghilimeleaza()` din
  `src/lib/queries/employees.ts` — o virgulă sau o ghilimea dintr-un nume sparge altfel
  filtrul PostgREST `or=(…)`. Separatorul se scrie ca secvență de evadare, niciodată ca
  octet brut. — capcana #11
- **Contorul de aprobat urmează lista, nu starea cererii.** `numarDeAprobat` și
  `deAprobat` se citesc din aceeași sursă; un `count()` naiv pe `approval_tasks` rămâne
  blocat pe un număr care nu scade.

## Ce se mișcă împreună

Migrarea → `src/types/database.ts` → `src/schemas/leave.ts` →
`src/lib/queries/leave.ts` → `src/app/(app)/concedii/actions.ts` → paginile. Calculul
zilelor lucrătoare și al drepturilor stă în `src/domain/leave/`, cu teste.

## Ce NU e aici

Sincronizarea zilelor aprobate în foaia de prezență o face pontajul, nu concediile —
`[[modul/pontaj]]`, acțiunea `sincronizeazaConcediile`. Indemnizațiile intră în state
de plată prin `[[modul/salarizare]]`.

## Când NU e suficientă pagina asta

- Regulile de drept și calculul soldului: `src/domain/leave/`.
- Forma lanțului de aprobare: migrarea care creează `approval_tasks`, plus
  `lantulAprobarii` din queries.
