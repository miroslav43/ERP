---
tip: modul
titlu: Angajați — fișa ca punct de plecare
aliases: [angajati-navigare, in-alte-module]
cai:
  - "src/app/(app)/angajati/[id]/sectiune-in-alte-module.tsx"
  - "src/app/(app)/angajati/[id]/sectiune-concedii.tsx"
  - "src/app/(app)/angajati/page.tsx"
  - "src/app/(app)/actions.ts"
  - "src/components/layout/command-palette.tsx"
  - "src/config/porti-ruta.ts"
tabele: [employees, employment_contracts, work_permits, vehicle_assignments]
permisiuni: [employees:read, departments:read]
capcane: []
scris_pe: 6b8c5b371c99ccd786400dc3dbe8b901117c36c8
scris_la: 2026-10-09
tags: [modul, hr, nucleu]
---

# Angajați — fișa ca punct de plecare

Secțiune extrasă din [[modul/angajati]]: regulile navigării dintre fișă și restul
modulelor, livrate în lotul 3 al analizei `docs/design/navigare-intre-module.md`.

## „În alte module”

`[id]/sectiune-in-alte-module.tsx` adună ce ține de om în restul aplicației: pontaj,
cereri, integrare, bunuri în primire, cursuri, deplasări, SSM, echipamente în grijă, flotă,
salarizare, KPI, tichete, REGES, registru, audit.

- **Un card apare doar dacă pagina-țintă se deschide** pentru rolul curent:
  `poateDeschide(ruta, {features, permissions})` din `src/config/porti-ruta.ts`, care
  știe și modulul activ, și permisiunea paginii. Nu `can()` ales de mână per card —
  aceeași funcție decide citirea și linkul „vezi tot”, deci nu pot diverge. hr n-are
  `per_diem`/`maintenance`/`vehicles`, managerul n-are `payroll`/`reges`/`registru`:
  cardurile lor lipsesc, nu apar goale.
- Toate citirile pleacă într-un singur `Promise.all`, cu `Promise.resolve(null)` pe
  ramura refuzată. `inPrimireaMea` primește OBLIGATORIU `angajat.id`: cu `null` ar
  întoarce alocările întregii firme.
- Lista-țintă primește filtrul de intrare (`?angajat=<id>`, `?sofer=`,
  `?solicitant_employee_id=`), validat ca UUID în schema listei și aplicat în același
  `filtreaza` ca numărătoarea; pastila „Angajat: Nume” vine din `PastileFiltre` sau din
  `cheiExterne` pe `BaraFiltre`.
- Singura listă goală ambiguă e SSM la `ssm:read = team` pe o fișă din afara echipei
  (privitor cu `employees:read = all`): cardul spune „nu aveți acces”, nu „nimic”.

## Citirile fișei

Pe fișa angajatului, citirile care depind doar de `angajat` pleacă într-un singur
`Promise.all`, iar porțile `can(...)` se evaluează sincron înaintea lui — ele decid dacă
o interogare pleacă deloc. O citire nouă intră în acel bloc, nu ca `await` separat, și
refolosește clientul `dbFisa` creat o dată deasupra.

## Linkurile de pe fișă

Un link care duce în alt modul trece prin poarta ȚINTEI, nu a sursei: „Mesajele REGES ale
acestei fișe” (antetul Contractelor), „Vezi cererile” (Concedii; `/concedii` pe fișa
proprie fiindcă `/concedii/echipa` exclude privitorul), departamentul →
`/departamente?departament=<id>`, managerul direct → fișa lui (a venit prin RLS, ca
pastilele lanțului de deasupra).

## Filtrul `?punct_lucru=` pe listă

`/angajati?punct_lucru=<id>` = angajații cu contract ACTIV pe punct, prin
`employment_contracts`: id-urile se citesc întâi și intră în `.in("id", …)` pe listă și pe
numărătoare, ca cele două să nu divergă. Un `in` gol ar fi respins de PostgREST, deci se
pune un id imposibil. Numele punctului pentru pastilă se citește sub RLS cu
`.maybeSingle()`; un id străin dă „Punct de lucru ales”, ca pastila să existe oricum.

## Paleta Ctrl+K

`cautaAngajatiPaleta` din `src/app/(app)/actions.ts` e o acțiune de CITIRE: organizația
din `resolveTenant()`, `employees:read` la orice scope, clientul sub RLS (restrânge
singur la echipă sau la fișa proprie). Clientul așteaptă 200 ms după ultima tastă și
folosește răspunsul doar dacă termenul lui e cel tastat acum. Testul:
`src/app/(app)/actions.test.ts`.
