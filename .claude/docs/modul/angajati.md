---
tip: modul
titlu: Angajați
aliases: [employees, fișa angajatului]
cai:
  - "src/app/(app)/angajati/**"
  - "src/lib/queries/employees.ts"
  - "src/schemas/employee.ts"
  - "src/schemas/comun.ts"
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
    hr_document_templates,
    hr_issued_documents,
  ]
permisiuni:
  [employees:read, employees:create, employees:update, employees:delete, roles:update, users:update]
capcane: [10, 11, 22, 30]
citeste_daca:
  - "CNP/IBAN care nu se văd → [[rol/hr]]"
  - "coloană inexistentă la SELECT → [[date/pontaj]]"
scris_pe: 3c9747a4f30ad317e7ea4e01fe0a4e778381411e
scris_la: 2026-08-30
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
| `/angajati/sabloane-documente`, `…/[cod]`             | `employees:update` **all** — aceeași poartă ca `hr_templates_insert/_update`                                                             |

## Server Actions

| Funcție                                                                              | Permisiune / minScope      | Fișier             |
| ------------------------------------------------------------------------------------ | -------------------------- | ------------------ |
| `inroleazaAngajat`                                                                   | `employees:create` / all   | `nou/actions.ts`   |
| `actualizeazaAngajat`                                                                | `employees:update` / team  | `[id]/actions.ts`  |
| `creeazaContract`                                                                    | `employees:create` / all   | `[id]/actions.ts`  |
| `inceteazaContract`, `modificaSalariulContractului`                                  | `employees:update` / all   | `[id]/actions.ts`  |
| `dezvaluieDateSensibile`                                                             | `employees:read` / **all** | `[id]/actions.ts`  |
| `pregatesteIncarcareDocument`, `salveazaDocument`                                    | `employees:update` / team  | documente          |
| `linkDescarcareDocument`                                                             | `employees:read` / team    | documente          |
| `stergeDocument`                                                                     | `employees:delete` / all   | documente          |
| `suprascriePermisiunea`                                                              | `roles:update` / team      | permisiuni         |
| `pregatesteIncarcareaImportului`, `analizeazaImportAngajati`, `aplicaImportAngajati` | all                        | import             |
| `emiteDocumenteLipsa`, `regenereazaDocumente`                                        | `employees:create` / all   | documente          |
| `salveazaSablonDocument`, `restabilesteSablonPlatforma`                              | `employees:update` / all   | sabloane-documente |

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

## Ce refuză schema tăcut

Baza nu e singurul loc care refuză fără să spună. Ajutoarele comune stau în
`src/schemas/comun.ts`; `src/schemas/comun.test.ts` interzice redeclararea lor local
oriunde în `src/schemas/`.

- **Un `<select>` cu opțiune goală trimite ȘIRUL GOL, nu `null`**, iar
  `z.enum(X).nullable()` îl respinge. Se vedea ca un buton „Continuă" mort în asistentul
  de înrolare: validarea pica pe `special_regime` și pe `stare_civila`, iar niciunul nu
  randa vreun mesaj. `enumOptional` normalizează `""`/`null`/`undefined` la `null` și dă
  mesajul de două ori — `zodResolver` citește mesajul RAMURII, iar `z.flattenError` din
  `create-action.ts` pe cel al UNIUNII. —
  `src/app/(app)/angajati/nou/_components/poarta-pasilor.test.ts`
- **`z.coerce.number()` dă `0` și pe `""`, și pe `null`.** Un câmp numeric golit nu
  spunea „lipsește", ci plafonul câmpului calculat pe zero: `salariu_baza` se scria 0 RON
  fără niciun mesaj, iar `norma_ore_saptamana` ieșea cu textul englezesc al lui zod.
  `numarObligatoriu`, `numarOptional` și `numarCuImplicit` scot golul ÎNAINTE de
  coerciție. Pe o coloană întreagă din bază, `intreg: true` e obligatoriu — altfel
  Postgres rotunjește tăcut la inserare. — `src/schemas/comun.test.ts`
- **`z.flattenError` colapsează calea unui câmp-listă la rădăcină**: serverul raportează
  `autorizatii`, clientul `autorizatii.2.numar`. Rezumatul emite amândouă formele, altfel
  una dintre căi dispare de pe ecran. —
  `src/app/(app)/angajati/nou/_components/erori-formular.test.ts`

## Documentele emise și șabloanele lor

- **Șabloanele sunt DATE, nu cod**: `hr_document_templates.continut_html`, HTML cu
  `{{variabila}}`. Rândul cu `organization_id is null` e seedul de platformă și e
  **intangibil** — `with check` cere `organization_id is not null`, deci editarea lui dă
  zero rânduri, nu eroare. Editarea din `/angajati/sabloane-documente` clonează seedul în
  rândul firmei la prima salvare; generatorul preferă automat varianta firmei
  (`generator.ts:76-77`). Nu `.upsert()`: indexurile sunt PARȚIALE, deci 42P10.
- **O variabilă inventată într-un șablon nu strică o emitere, ci TOATE emiterile**
  viitoare ale acelui document — `genereazaDocument` aruncă la prima variabilă fără
  valoare. Mulțimea validă e `VARIABILE_PER_COD` din `src/lib/documents/variabile.ts`,
  verificată la salvare. Cele trei copii ale listei (SQL-ul migrărilor, hărțile din
  `valori-inrolare.ts`, constanta) sunt legate între ele de `valori-inrolare.test.ts`.
- **HTML-ul de șablon NU e evadat** la randare: `randeaza` evadează doar valorile
  interpolate, iar `paginaTiparibila` îl inserează brut într-o pagină servită de
  `/documente/[id]`. De când firmele îl pot edita, singura apărare e `curataHtml`, care
  RECONSTRUIEȘTE marcajul din șapte etichete și zero atribute
  (`src/lib/documents/curata-html.ts`). Aceeași mulțime de șapte e și contractul cu
  `src/lib/pdf/din-html.ts` și cu bara editorului; cele trei se schimbă împreună.
- **Regenerarea nu suprascrie**: emite un document nou și îl marchează pe cel vechi
  `anulat_la`. Întâi emite, apoi anulează — invers, un eșec de emitere ar lăsa angajatul
  fără document valid. Acțiunea declară `employees:create` (cerut de `hr_issued_insert`),
  dar anularea trece prin `hr_issued_update`, care cere `employees:update`. Probat
  empiric în `tests/rls/proba-sabloane-documente.sql`, nu dedus.

## Ce se mișcă împreună

O coloană nouă pe `employees` atinge: migrarea → `src/types/database.ts` (regenerat din
bancul LOCAL, nu din cloud) → `src/schemas/employee.ts` →
`src/lib/queries/employees.ts` → acțiunile → formularele. Poarta care prinde coloanele
inventate în stratul de citiri e `src/lib/queries/coloane.test.ts`.

Pașii asistentului de înrolare nu mai au clase de câmp proprii: `campuri-comune.tsx` a
dispărut, controalele trec prin `Camp` din `src/components/ui/camp.tsx`, iar mesajele
prin `mesajCamp` din `nou/_components/erori-formular.ts`. Un câmp nou în
`inroleazaAngajatSchema` cere **și** o intrare în `ETICHETE_CAMPURI`
(`nou/_components/etichete-campuri.ts`): tipul e `Record<keyof …, string>`, deci
omisiunea nu compilează — rezumatul de erori numește câmpuri care, de regulă, sunt pe un
pas nemontat, așa că eticheta nu poate fi citită din arbore. Enumerările afișate se
traduc din `src/app/(app)/angajati/etichete.ts` (`ETICHETE_REGIM_SPECIAL`,
`ETICHETE_DURATA_CONTRACT`), nu din valoarea brută a bazei.

Pe fișa angajatului, citirile care depind doar de `angajat` pleacă într-un singur
`Promise.all`, iar porțile `can(...)` se evaluează sincron înaintea lui — ele decid dacă
o interogare pleacă deloc. O citire nouă intră în acel bloc, nu ca `await` separat, și
refolosește clientul `dbFisa` creat o dată deasupra.

## Ce NU e aici

Pontajul (`[[modul/pontaj]]`), concediile (`[[modul/concedii]]`), statele de plată
(`[[modul/salarizare]]`). Fișa proprie a angajatului în portal e alt arbore de rute.

## Când NU e suficientă pagina asta

- Criptarea datelor sensibile (AES-256-GCM, chei versionate): `src/domain/hr/` și
  `NOTES.md`.
- Nomenclatorul COR și codurile CAEN: `src/domain/hr/cor-nomenclator.ts`.
- Contractul lui `Camp` (de ce `nume` și nu `useId`, de ce fișierul n-are `"use client"`):
  antetul din `src/components/ui/camp.tsx`.
