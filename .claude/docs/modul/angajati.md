---
tip: modul
titlu: Angajați
aliases: [employees, fișa angajatului]
cai:
  - "src/app/(app)/angajati/**"
  - "src/lib/queries/employees.ts"
  - "src/schemas/employee.ts"
  - "src/domain/hr/**"
tabele:
  [
    employees,
    employment_contracts,
    employee_sensitive_data,
    employee_documents,
    employee_document_types,
    employee_dependents,
    employee_tax_exemptions,
    work_permits,
    puncte_lucru,
    organizations,
    organization_members,
    role_permissions,
    hr_document_templates,
    hr_issued_documents,
  ]
permisiuni:
  [
    employees:read,
    employees:create,
    employees:update,
    employees:delete,
    employees:invite,
    roles:update,
    users:update,
    departments:update,
    payroll:create,
  ]
capcane: [10, 11, 22, 30]
citeste_daca:
  - "CNP/IBAN care nu se văd → [[rol/hr]]"
  - "coloană inexistentă la SELECT → [[date/pontaj]]"
  - "importul din Excel, `import_uploads`, refuzul identic pentru fișa din altă firmă → [[modul/angajati/import-si-sonde]]"
scris_pe: cd77c37564a0a2474dda087e9d2ec85035b57e46
scris_la: 2026-10-25
tags: [modul, hr, nucleu]
---

# Angajați

Fișa angajatului, contractele, documentele și datele personale sensibile. Orice
schimbare aici atinge alte module.

**Nu are feature flag**: paginile cer `requireFeature(…, "nucleu")`, deci sunt mereu
active.

## Paginile modulului

| Pagină                                | Ce ține                                                            |
| ------------------------------------- | ------------------------------------------------------------------ |
| [[modul/angajati/actiuni]]            | tabelul Server Actions, cu permisiunea și `minScope` ale fiecăreia |
| [[modul/angajati/inrolare]]           | asistentul `/angajati/nou`, schemele și ce refuză ele tăcut        |
| [[modul/angajati/sabloane-documente]] | editorul de șabloane, emiterea, antetul tipărit și sigla           |
| [[modul/angajati/import-si-sonde]]    | importul din Excel și refuzurile care nu deosebesc firmele         |
| [[modul/angajati/navigare]]           | „În alte module", filtrele de intrare, paleta Ctrl+K               |

## Rute și cine ajunge

| Rută                                             | Poartă                                                                                                                                                                                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/angajati`, `/angajati/nou`, `/angajati/import` | `nucleu`; crearea și importul cer `employees:create` **all**                                                                                                                                                                                                        |
| `/angajati/[id]`                                 | citirea fișei, la scope-ul de pe `employees:read`; butoanele cer `employees:update` all, `employees:invite` all, `employees:delete` all, `payroll:create` all, `users:update` all, `roles:update` team, `evaluations:*` team (redeschiderea unei evaluări: **all**) |
| `/angajati/[id]/editeaza`                        | `employees:update` **all** — `team` nu deschide ecranul                                                                                                                                                                                                             |
| `/angajati/[id]/documente`                       | `employees:read`; încărcarea pe `employees:update`, ștergerea pe `employees:delete`, emiterea pe `employees:create` all, anularea unui document emis pe `employees:update` **all**                                                                                  |
| `/angajati/[id]/permisiuni`                      | `roles:update` team **și** `employees:read` diferit de `none`: fișa se citește la scope-ul cititorului, deci managerul ajunge la subordonat, iar un ne-subordonat rămâne 404                                                                                        |
| `/angajati/sabloane-documente`, `…/[cod]`        | `employees:update` **all** — aceeași poartă ca `hr_templates_update`                                                                                                                                                                                                |
| `/angajati/sabloane-documente/nou`               | `employees:create` **all** — ca `hr_templates_insert`                                                                                                                                                                                                               |

## Server Actions

Tabelul întreg, cu fișierele: [[modul/angajati/actiuni]]. Permisiunea de pe acțiune e
poarta de aplicație; refuzul final îl dă RLS.

## Citiri

`src/lib/queries/employees.ts` — referința canonică pentru stratul de citiri din tot
proiectul: `idFisaProprie`, `listeazaAngajati` (cursor keyset base64url),
`citesteAngajat`, `citesteAngajatPentruEditare`, `lantulDeManageri`,
`arboreleManagerial`, `colegiPentruManager`, `angajatiPentruPontaj`,
`citesteRezumatDateSensibile`, `citesteScutiriFiscale`, `citesteComponenteSalariale`,
`functiiFolosite`, `fiseDupaId`.

- **`fiseDupaId` citește și fișele inactive sau încetate**, prin RLS: cine n-are
  `employees:read = all` nu le primește. Organigrama numește așa managerul care a ieșit
  din firmă, în loc de „manager inactiv sau șters".
- **Șefii de deasupra NU se citesc din `employees`.** Sub `employees:read = own`,
  politica `employees_select` dă doar rândul propriu, deci `.in("id", manager_path)`
  întorcea zero rânduri, tăcut: `arboreleManagerial` cere acum lanțul de la
  `lantul_meu_de_sefi` (`supabase/migrations/0196_lantul_de_sefi_al_angajatului.sql`),
  ordonat vârf → șef direct.
- Contractul citit pe fișă poartă și `punct_lucru_id` și `zile_concediu_anual` — al doilea
  e baza din care `app.drept_concediu` (`0193_concediu_proportional_cu_lunile.sql`)
  calculează dreptul de odihnă, nu `leave_types.zile_implicite`.

## Încadrarea (funcție, cod COR, departament, manager)

**0110** a desființat nomenclatorul `job_positions`: funcția e `employees.functie` plus
`employees.cod_cor` (validat contra nomenclatorului COR din `src/domain/hr/`, **nu** în
bază). Contractul are propriile `functie`/`cod_cor`, **înghețate la semnare** — codul
stătea pe nomenclator, deci corectarea lui rescria retroactiv ce se declara la ITM.

- **`manager` NU are `employees:update`, la niciun scope** — doar `read = team`; invocată
  direct, acțiunea e refuzată cu ZERO RÂNDURI. Probat în `izolare.sql` `(l)`.
- **`manager_employee_id` e cel mai periculos câmp al fișei.** Golirea lui declanșează
  `tg_employees_manager_path`, care rescrie `manager_path` la TOȚI subordonații; cum
  `team` se rezolvă pe `manager_path`, o ramură întreagă devine invizibilă managerului
  ei, fără eroare. Dialogul îl pre-completează, iar câmpul e de acum în lista de audit.
- **Criteriul „funcție" al regulilor** (concedii, cursuri, bonusuri, checklist) se
  potrivește pe `cod_cor`, evaluat de funcțiile rescrise în **0111** — pe text, „Sudor"
  și „sudor" ar fi fost două reguli diferite, tăcut. O fișă fără cod nu prinde nicio
  regulă, iar pe baza reală toate îl aveau NULL.

## Ce refuză baza tăcut

- **`employees.full_name` e GENERATED ALWAYS.** Clientul nu are voie s-o trimită —
  Postgres dă 428C9 dacă ajunge în `Insert`/`Update`. Și, în sens invers: **coloana se
  numește `full_name`, nu `nume`.** Patru ecrane au căzut cu 42703 pentru că un
  `select("nume")` a trecut de typecheck; reparat în `5ec4282`. — capcanele #22 și #30
- **`employee` are `employees:read = own`**, mutat acolo de
  `supabase/migrations/0023_portal_angajat.sql` de la `none`. **Capcana #10 e învechită
  pe acest punct** — restul ei rămâne valabil: nicio pagină și niciun fișier din
  `src/lib/queries` nu poate importa `createAdminSupabase` (ESLint
  `no-restricted-imports`; excepția acoperă doar `actions.ts`, `reges/actiuni-api.ts`,
  route handlers, `rate-limit.ts`, scripts, tests).
- **CNP și IBAN rămân închise chiar și pentru `own`.** `dezvaluieDateSensibile` cere
  scope **all** exact, nu „cel puțin all" — un rol cu `team` nu trece. La fel se citesc
  și permisele de muncă (`work_permits`) și rezumatul datelor sensibile de pe fișă: numai
  la `all`, altfel secțiunea nu pleacă deloc spre bază.
- **Acordarea de permisiuni e PLAFONATĂ** de
  `supabase/migrations/0197_plafon_acordare_permisiuni.sql`: pe `team` se dă cel mult ce
  are acordantul pe aceeași cheie, iar RETRAGEREA trece prin același plafon, fiindcă
  membrul cade pe implicitul rolului — altfel un manager fără salarizare redeschidea
  subordonatului toate salariile prin simpla retragere a unei restricții. Pe propria
  apartenență baza refuză orice suprascriere (`app.membrul_meu`, `0063`), cu 42501 fără
  context: de aceea pagina proprie se citește, dar nu are controale active.
- **Punctul de lucru al contractului** (`punct_lucru_id`, din `0097`) **se citește prin
  RLS**: fără drept pe `puncte_lucru`, numele vine `null` și rândul fișei spune doar
  „Setat", fără eroare.
- **Cursorul keyset pe `full_name` cere `ghilimeleaza()`**, altfel o virgulă sau o
  ghilimea din nume sparge filtrul PostgREST `or=(…)`. Separatorul se scrie ca secvență
  de evadare, niciodată ca octet brut — un octet nul face fișierul invizibil pentru
  `grep`. — capcana #11

## Ce se mișcă împreună

O coloană nouă pe `employees` atinge: migrarea → `src/types/database.ts` (regenerat din
bancul LOCAL, nu din cloud) → `src/schemas/employee.ts` →
`src/lib/queries/employees.ts` → acțiunile → formularele. Poarta care prinde coloanele
inventate în stratul de citiri e `src/lib/queries/coloane.test.ts`.

Zilele de concediu implicite ale firmei (`organizations.zile_concediu_anual_implicit`) se
citesc în trei locuri cu aceeași intenție — caseta „Contract nou" de pe fișă,
`/angajati/nou` și `creeazaContract` — fiindcă schema nu mai are implicit codificat;
regula întreagă e în [[modul/angajati/inrolare]].

## Ce NU e aici

Pontajul (`[[modul/pontaj]]`), concediile (`[[modul/concedii]]`), statele de plată
(`[[modul/salarizare]]`). Fișa proprie a angajatului în portal e alt arbore de rute.

## Când NU e suficientă pagina asta

- Criptarea datelor sensibile (AES-256-GCM, chei versionate): `src/domain/hr/` și
  `NOTES.md`.
- Nomenclatorul COR și codurile CAEN: `src/domain/hr/cor-nomenclator.ts`.
- Contractul lui `Camp` (de ce `nume` și nu `useId`, de ce fișierul n-are `"use client"`):
  antetul din `src/components/ui/camp.tsx`.
