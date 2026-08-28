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
    organization_members,
    role_permissions,
  ]
permisiuni:
  [employees:read, employees:create, employees:update, employees:delete, roles:update, users:update]
capcane: [10, 11, 22, 30]
citeste_daca:
  - "CNP/IBAN care nu se văd → [[rol/hr]]"
  - "coloană inexistentă la SELECT → [[date/pontaj]]"
scris_pe: c72c3e8dbdab4bbee1ff6f55e311080155c5c4a2
scris_la: 2026-08-28
tags: [modul, hr, nucleu]
---

# Angajați

Fișa angajatului, contractele, documentele și datele personale sensibile. E modulul cu
cel mai mare rulaj din proiect și cu cea mai mare densitate de fix-uri — orice schimbare
aici atinge alte module.

**Nu are feature flag.** Paginile cer `requireFeature(tenant.organizationId, "nucleu")`,
adică sunt mereu active.

## Rute și cine ajunge

| Rută                                                  | Poartă                                                                                                                                   |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `/angajati`, `/angajati/nou`, `/angajati/import`      | `nucleu`; acțiunile cer `employees:create` all                                                                                           |
| `/angajati/[id]`                                      | citirea fișei; butoanele cer `employees:update` all, `payroll:create` all, `evaluations:*` team, `users:update` all, `roles:update` team |
| `/angajati/[id]/editeaza`, `/angajati/[id]/documente` | `nucleu`                                                                                                                                 |
| `/angajati/[id]/permisiuni`                           | `roles:update` team                                                                                                                      |

## Server Actions

| Funcție                                                                              | Permisiune / minScope      | Fișier            |
| ------------------------------------------------------------------------------------ | -------------------------- | ----------------- |
| `inroleazaAngajat`                                                                   | `employees:create` / all   | `nou/actions.ts`  |
| `actualizeazaAngajat`                                                                | `employees:update` / team  | `[id]/actions.ts` |
| `creeazaContract`                                                                    | `employees:create` / all   | `[id]/actions.ts` |
| `inceteazaContract`, `modificaSalariulContractului`                                  | `employees:update` / all   | `[id]/actions.ts` |
| `dezvaluieDateSensibile`                                                             | `employees:read` / **all** | `[id]/actions.ts` |
| `pregatesteIncarcareDocument`, `salveazaDocument`                                    | `employees:update` / team  | documente         |
| `linkDescarcareDocument`                                                             | `employees:read` / team    | documente         |
| `stergeDocument`                                                                     | `employees:delete` / all   | documente         |
| `suprascriePermisiunea`                                                              | `roles:update` / team      | permisiuni        |
| `pregatesteIncarcareaImportului`, `analizeazaImportAngajati`, `aplicaImportAngajati` | all                        | import            |

## Citiri

`src/lib/queries/employees.ts` — referința canonică pentru stratul de citiri din tot
proiectul: `idFisaProprie`, `listeazaAngajati` (cursor keyset base64url),
`citesteAngajat`, `citesteAngajatPentruEditare`, `lantulDeManageri`,
`arboreleManagerial`, `colegiPentruManager`, `angajatiPentruPontaj`,
`citesteRezumatDateSensibile`, `citesteScutiriFiscale`, `citesteComponenteSalariale`,
`functiiActive`.

## Ce refuză baza tăcut

- **`employees.full_name` e GENERATED ALWAYS.** Clientul nu are voie s-o trimită —
  Postgres dă 428C9 dacă ajunge în `Insert`/`Update`. Și, în sens invers: **coloana se
  numește `full_name`, nu `nume`.** Patru ecrane au căzut cu 42703 pentru că un
  `select("nume")` a trecut de typecheck; reparat în `5ec4282`. — capcanele #22 și #30
- **`employee` are `employees:read = own`**, mutat acolo de
  `supabase/migrations/0023_portal_angajat.sql` de la `none`. **Capcana #10 e învechită
  pe acest punct** — restul ei rămâne valabil: nicio pagină și niciun fișier din
  `src/lib/queries` nu poate importa `createAdminSupabase` (ESLint
  `no-restricted-imports`; excepția acoperă doar `actions.ts`, route handlers, scripts,
  tests).
- **CNP și IBAN rămân închise chiar și pentru `own`.** `dezvaluieDateSensibile` cere
  scope **all** exact, nu „cel puțin all" — un rol cu `team` nu trece.
- **Cursorul keyset pe `full_name` cere `ghilimeleaza()`**, altfel o virgulă sau o
  ghilimea din nume sparge filtrul PostgREST `or=(…)`. Separatorul se scrie ca secvență
  de evadare, niciodată ca octet brut — un octet nul face fișierul invizibil pentru
  `grep`. — capcana #11

## Ce se mișcă împreună

O coloană nouă pe `employees` atinge: migrarea → `src/types/database.ts` (regenerat din
bancul LOCAL, nu din cloud) → `src/schemas/employee.ts` →
`src/lib/queries/employees.ts` → acțiunile → formularele. Poarta care prinde coloanele
inventate în stratul de citiri e `src/lib/queries/coloane.test.ts`.

## Ce NU e aici

Pontajul (`[[modul/pontaj]]`), concediile (`[[modul/concedii]]`), statele de plată
(`[[modul/salarizare]]`). Fișa proprie a angajatului în portal e alt arbore de rute.

## Când NU e suficientă pagina asta

- Criptarea datelor sensibile (AES-256-GCM, chei versionate): `src/domain/hr/` și
  `NOTES.md`.
- Nomenclatorul COR și codurile CAEN: `src/domain/hr/cor-nomenclator.ts`.
