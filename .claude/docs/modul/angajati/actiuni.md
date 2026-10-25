---
tip: modul
titlu: Angajați — Server Actions
aliases: [actiuni angajati, employees actions]
cai:
  - "src/app/(app)/angajati/actions.ts"
  - "src/app/(app)/angajati/nou/actions.ts"
  - "src/app/(app)/angajati/[id]/documente/actions.ts"
  - "src/app/(app)/angajati/[id]/permisiuni/actions.ts"
  - "src/app/(app)/angajati/[id]/avatar-actions.ts"
  - "src/app/(app)/angajati/[id]/componente-actions.ts"
  - "src/app/(app)/angajati/[id]/dependenti-actions.ts"
  - "src/app/(app)/angajati/[id]/scutiri-actions.ts"
  - "src/app/(app)/angajati/import/actions.ts"
  - "src/app/(app)/angajati/sabloane-documente/actions.ts"
tabele:
  [
    employees,
    employment_contracts,
    employee_sensitive_data,
    employee_documents,
    employee_dependents,
    employee_tax_exemptions,
    hr_document_templates,
    hr_issued_documents,
    organization_members,
    role_permissions,
    organization_branding,
    inrolare_ciorne,
  ]
permisiuni:
  [
    employees:create,
    employees:read,
    employees:update,
    employees:delete,
    employees:invite,
    roles:update,
    users:update,
    payroll:create,
    payroll:update,
    departments:update,
    branding:update,
  ]
capcane: []
scris_pe: cd77c37564a0a2474dda087e9d2ec85035b57e46
scris_la: 2026-10-25
tags: [modul, hr, nucleu]
---

# Angajați — Server Actions

Secțiune extrasă din [[modul/angajati]] (tabelul singur trecea de plafonul paginii-mamă):
cine scrie ce pe fișă, cu permisiunea și `minScope` declarate pe DEFINIȚIA acțiunii.
Permisiunea de pe acțiune e poarta de aplicație; refuzul final vine oricum de la RLS.

## Fișa, contractele, contul

| Funcție                                                  | Permisiune / minScope      | Fișier                  |
| -------------------------------------------------------- | -------------------------- | ----------------------- |
| `actualizeazaAngajat`                                    | `employees:update` / team  | `actions.ts`            |
| `actualizeazaIncadrarea`                                 | `employees:update` / all   | `actions.ts`            |
| `desemneazaSefDepartament`                               | `departments:update` / all | `actions.ts`            |
| `creeazaContract`, `modificaSalariulContractului`        | `employees:create` / all   | `actions.ts`            |
| `inceteazaContract`                                      | `employees:update` / all   | `actions.ts`            |
| `dezvaluieDateSensibile`                                 | `employees:read` / **all** | `actions.ts`            |
| `invitaAngajatul`                                        | `employees:invite` / all   | `actions.ts`            |
| `stergeAngajat`                                          | `employees:delete` / all   | `actions.ts`            |
| `inroleazaAngajat`                                       | `employees:create` / all   | `nou/actions.ts`        |
| `salveazaCiornaInrolare`, `stergeCiornaInrolare`         | `employees:create` / all   | `nou/actions.ts`        |
| `adaugaPersoanaIntretinere`, `stergePersoanaIntretinere` | `employees:update` / all   | `dependenti-actions.ts` |

`invitaAngajatul` are permisiune PROPRIE (`employees:invite`, din `0099`), separată de
`employees:update`: consumă un loc din `seats_limit` și creează un cont, nu editează o
fișă. `employees:delete` și `users:update` sunt tot chei distincte — ștergerea fișei nu
vine la pachet cu editarea ei, iar fotografia atinge contul, nu fișa.

## Documente, șabloane, siglă

| Funcție                                                                     | Permisiune / minScope     | Fișier               |
| --------------------------------------------------------------------------- | ------------------------- | -------------------- |
| `pregatesteIncarcareDocument`, `salveazaDocument`                           | `employees:update` / team | `documente`          |
| `linkDescarcareDocument`                                                    | `employees:read` / team   | `documente`          |
| `stergeDocument`                                                            | `employees:delete` / all  | `documente`          |
| `emiteDocumente`, `regenereazaDocumente`                                    | `employees:create` / all  | `documente`          |
| `anuleazaDocumentEmis`                                                      | `employees:update` / all  | `documente`          |
| `salveazaSablonDocument`, `restabilesteSablonPlatforma`                     | `employees:update` / all  | `sabloane-documente` |
| `creeazaSablonPersonalizat`                                                 | `employees:create` / all  | `sabloane-documente` |
| `salveazaAntetDocumente`, `pregatesteSigla`, `salveazaSigla`, `stergeSigla` | `branding:update` / all   | `sabloane-documente` |

Antetul tipărit și sigla firmei stau pe `branding:update`, nu pe `employees:*`: sunt
identitatea firmei, folosită de orice document emis. De aceea `/angajati/sabloane-documente`
se deschide la `employees:update = all`, dar caseta de antet rămâne read-only fără
`branding:update`. Restul: [[modul/angajati/sabloane-documente]].

## Cont, permisiuni, salarizare, import

| Funcție                                                                              | Permisiune / minScope    | Fișier                  |
| ------------------------------------------------------------------------------------ | ------------------------ | ----------------------- |
| `schimbaRolulAngajatului`                                                            | `users:update` / all     | `permisiuni`            |
| `suprascriePermisiunea`                                                              | `roles:update` / team    | `permisiuni`            |
| `pregatesteIncarcareAvatarAngajat`, `salveazaAvatarAngajat`                          | `users:update` / all     | `avatar-actions.ts`     |
| `adaugaScutireFiscala`                                                               | `payroll:create` / all   | `scutiri-actions.ts`    |
| `asociazaComponenta`                                                                 | `payroll:create` / all   | `componente-actions.ts` |
| `incheieComponentaAngajat`                                                           | `payroll:update` / all   | `componente-actions.ts` |
| `pregatesteIncarcareaImportului`, `analizeazaImportAngajati`, `aplicaImportAngajati` | `employees:create` / all | `import`                |

- **Avatarul țintește contul, nu fișa** (`0029_avatare.sql`): un angajat fără cont în
  portal (`user_id` nul) primește un refuz de regulă de business, oricare ar fi scope-ul
  pe `employees`. Tipul declarat la urcare nu e crezut — se compară cu primii octeți ai
  fișierului, iar obiectul respins rămâne în bucket (nicio politică DELETE pe
  `storage.objects`).
- **`suprascriePermisiunea` e plafonată** (`0197_plafon_acordare_permisiuni.sql`): pe
  `team` se acordă cel mult ce are acordantul pe aceeași cheie, iar RETRAGEREA trece
  prin același plafon, fiindcă membrul cade pe implicitul rolului. Poarta e în bază;
  acțiunea repetă verificarea doar ca să dea mesajul. Pe propria apartenență baza refuză
  oricum — vezi [[modul/angajati]], „Ce refuză baza tăcut".
- Importul (lot, consum, aplicare) își are regulile în [[modul/angajati/import-si-sonde]].
