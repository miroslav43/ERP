---
tip: modul
titlu: Mentenanță
aliases: [mentenanta, echipamente, sesizari, defecte]
cai:
  - "src/app/(app)/mentenanta/**"
  - "src/lib/queries/maintenance.ts"
  - "src/schemas/maintenance.ts"
  - "src/domain/maintenance/**"
  - "supabase/migrations/0011_ssm.sql"
tabele:
  [
    equipment,
    equipment_meters,
    maintenance_plans,
    maintenance_interventions,
    fault_reports,
    iscir_authorizations,
  ]
permisiuni: [maintenance:read, maintenance:create, maintenance:update]
feature: maintenance
capcane: [35]
citeste_daca:
  - "poartă de acțiune care pare prea largă → secțiunea „create nu e poarta”"
scris_pe: 0815fbff2c885cd44b5768ee25f084f16a9e95b8
scris_la: 2026-09-03
tags: [modul]
---

# Mentenanță

Echipamente cu contoare, planuri de mentenanță cu scadențe, intervenții, sesizări de
defecțiune și autorizații ISCIR. Tabelele sunt create de `0011_ssm.sql`, în aceeași buclă
de politici ca SSM-ul, dar sub resursa de permisiune `maintenance` și feature-ul
`maintenance` — **aceeași migrare, alt modul**. Vezi [[modul/ssm]] pentru cealaltă
jumătate.

## Rute și cine ajunge

| Rută                                                                                     | Poartă                  |
| ---------------------------------------------------------------------------------------- | ----------------------- |
| `/mentenanta`                                                                            | `maintenance:read` own  |
| `/mentenanta/sesizari`, `/mentenanta/sesizari/noua`, `/mentenanta/sesizari/[id]`         | `maintenance:read` own  |
| `/mentenanta/echipamente`, `/mentenanta/echipamente/nou`, `/mentenanta/echipamente/[id]` | `maintenance:read` team |
| `/mentenanta/planuri`                                                                    | `maintenance:read` team |
| `/mentenanta/interventii`                                                                | `maintenance:read` team |

Pragul `own` pe panou și pe sesizări e intenționat: **oricine poate sesiza o defecțiune**.
Restul modulului — parcul de echipamente, planurile, intervențiile — cere `team`.

## `create` NU e poarta pentru echipamente

Politica de INSERT generată în bucla din `0011` cere
`app.ssm_acces(org, 'maintenance', 'create', null)`. Cu `p_employee` NULL, funcția
răspunde din prima ramură: `can(..., 'all')`. Iar `manager` **și** `employee` au
`maintenance:create = all` în seed — acordat pentru sesizări.

Consecința: baza îi lasă să insereze în `equipment`, `equipment_meters`,
`maintenance_plans` și `maintenance_interventions`. **Poarta reală trebuie pusă în
aplicație**, pe `maintenance:update` cu `minScope: "team"`, și așa e scrisă azi. Doar
sesizarea rămâne pe `maintenance:create` / `own`. — capcana #35

E singurul loc din proiect unde politica e mai largă decât acțiunea, și e deliberat: o
politică îngustă ar fi tăiat și sesizarea.

## Server Actions

`src/app/(app)/mentenanta/actions.ts`.

| Funcție                                                              | Permisiune / minScope       |
| -------------------------------------------------------------------- | --------------------------- |
| `creeazaSesizare`, `cautaEchipament`                                 | `maintenance:create` / own  |
| `numeleEchipamentelorMele`                                           | `maintenance:read` / own    |
| `creeazaEchipament`, `actualizeazaEchipament`, `inregistreazaContor` | `maintenance:update` / team |
| `creeazaPlan`, `actualizeazaPlan`, `inregistreazaInterventie`        | `maintenance:update` / team |
| `trieazaSesizare`, `rezolvaSesizare`                                 | `maintenance:update` / team |
| `adaugaAutorizatieIscir`                                             | `maintenance:update` / team |

`cautaEchipament` e pe `create` / own fiindcă servește formularul de sesizare: cine poate
raporta trebuie să poată găsi echipamentul, fără să vadă parcul.

## Citiri

`src/lib/queries/maintenance.ts`: `listeazaEchipamente`, `citesteEchipament`,
`echipamenteDupaId`, `contoareEchipament`, `planuriEchipament`, `planuriScadente`,
`ultimeleCitiriContor`, `interventii`, `citesteInterventie`, `sesizari`,
`sesizariDeschise`, `citesteSesizare`, `autorizatiiIscir`, `angajatiAutorizati`,
`angajatiDupaId`, `numarScadenteMentenanta`.

Ca la SSM, niciun filtru manual de scope: politicile din bucla lui `0011` restrâng
rândurile în Postgres.

## Ce refuză baza tăcut

- **Sesizările se ancorează pe `raportat_de_employee_id`, restul tabelelor pe nimic.**
  În bucla de politici, `fault_reports` primește coloana de angajat, iar `equipment`,
  `equipment_meters`, `maintenance_plans`, `maintenance_interventions` și
  `iscir_authorizations` primesc `null`. Deci un `employee` își vede propriile sesizări,
  dar parcul îi e invizibil — ecran gol, fără eroare, fiindcă `ssm_acces` cu angajat NULL
  cere cel puțin `team`.
- **Scadențele NU se citesc din `public.expirables`.** Politica ei cere în plus
  `compliance:read`, pe care administratorul de mentenanță nu-l are; tabela ar întoarce
  zero rânduri fără eroare. `planuriScadente` și `numarScadenteMentenanta` calculează din
  tabelele sursă. — v. [[modul/ssm]], capcana #26 acolo
- **Ștergerea e logică.** Tabelele modulului primesc grant pe `select`, `insert` și
  `update`, cu `revoke delete` explicit în aceeași buclă.

## Ce NU e aici

Vehiculele și foile de parcurs sunt la [[modul/flota]] — un vehicul nu e un `equipment`,
are politici și scadențe proprii. Instruirile, EIP-ul și accidentele sunt la
[[modul/ssm]], deși vin din aceeași migrare.

## Când NU e suficientă pagina asta

- Calculul scadenței unui plan: `src/domain/maintenance/`.
- De ce un manager poate sesiza dar nu poate administra: [[rol/manager]].
