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
  - "src/components/layout/topbar.tsx"
  - "src/config/porti-ruta.ts"
tabele: [employees, employment_contracts, work_permits, vehicle_assignments, leave_balances]
permisiuni: [employees:read, departments:read, leave:read, ssm:read, vehicles:read]
capcane: [18]
scris_pe: d88200b8dc3f13fccad2ce8777662950d9c00eb8
scris_la: 2026-10-09
tags: [modul, hr, nucleu]
---

# Angajați — fișa ca punct de plecare

Secțiune extrasă din [[modul/angajati]]: regulile navigării dintre fișă și restul
modulelor, livrate în lotul 3 al analizei `docs/design/navigare-intre-module.md`.

## „În alte module”

`[id]/sectiune-in-alte-module.tsx` adună ce ține de om în restul aplicației: pontaj,
cereri, integrare, bunuri în primire, cursuri, deplasări, SSM, echipamente în grijă, flotă,
salarizare, KPI, tichete, REGES, registru, organigramă, audit.

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
- Flota e singura citire scrisă pe loc în secțiune — `vehicle_assignments` cu embed
  `vehicles!vehicle_id`, doar atribuirile deschise (`pana_la` nul). Sub
  `vehicles:read = own/team` embed-ul vine NULL **fără eroare** (capcana #18): rândul
  spune „Vehicul (ascuns)” și nu mai leagă `/flota/[id]`, iar „vezi tot” duce la
  `/flota/foi` numai dacă și pagina aia se deschide.

## Citirile fișei

Pe fișa angajatului, citirile care depind doar de `angajat` pleacă într-un singur
`Promise.all`, iar porțile `can(...)` se evaluează sincron înaintea lui — ele decid dacă
o interogare pleacă deloc. O citire nouă intră în acel bloc, nu ca `await` separat, și
refolosește clientul `dbFisa` creat o dată deasupra.

## Linkurile de pe fișă

Un link care duce în alt modul trece prin poarta ȚINTEI, nu a sursei: „Mesajele REGES ale
acestei fișe” (antetul Contractelor), „Vezi cererile” (Concedii; `/concedii` pe fișa
proprie fiindcă `/concedii/echipa` exclude privitorul), „Soldul și istoricul lui”
(`/concedii/sold`), departamentul → `/departamente?departament=<id>`, managerul direct →
fișa lui (a venit prin RLS, ca pastilele lanțului de deasupra).

## Secțiunea Concedii a fișei

`[id]/sectiune-concedii.tsx` primește de pe pagină, deja decise, `hrefCereri` și
`hrefSold` — `null` când pagina-țintă nu se deschide, deci linkul lipsește în loc să
ducă în `AccesRestrictionat`. Ancora `#angajat-<id>` se pune pe `hrefSold` numai peste
scope „own”: pe fișa proprie, și pentru cine are `leave:read` doar pe sine,
`/concedii/sold` arată un singur tabel, fără secțiuni adresabile.

Lângă dreptul anual, rândul arată și folosite / în așteptare / rămase, din
`leave_balances` prin `soldAnual` (`src/lib/queries/leave.ts`) — nu dintr-o citire nouă.
Fără rând de sold pe anul curent, `ramase` e `null` și fișa arată **doar dreptul**, fără
nicio explicație: anul nu are drepturi aplicate. Aceeași formă o ia și o firmă cu mai
multe rânduri de sold pe an decât plafonul `max_rows` al PostgREST — `soldAnual` cere
soldurile întregii firme pe an, fără limită, iar trunchierea e tăcută.

## Celulele-link din listă

În `page.tsx`, două coloane duc mai departe, iar linkul imbricat în rândul apăsabil
rămâne apăsabil prin `relative` (`[&_a]:relative` din `Tabel`):

- **Departament** → `/departamente?departament=<id>`, dar numai dacă poarta
  `/departamente` se deschide (`hrefDepartamente`, calculat o dată pe pagină cu
  `poateDeschide`, nu per rând). Altfel rămâne text — `hr` n-are `departments:read`.
- **Funcție** → `/angajati?functie=<denumire>&status=activ` („cine mai are funcția
  asta”), necondiționat: ținta e lista pe care omul o are deja deschisă. Filtrul se
  aplică pe potrivire EXACTĂ a denumirii, deci o funcție scrisă altfel pe altă fișă nu
  intră în rezultat.

## Filtrele de intrare pe listă

`/angajati?punct_lucru=<id>` = angajații cu contract ACTIV pe punct, prin
`employment_contracts`: id-urile se citesc întâi și intră în `.in("id", …)` pe listă și pe
numărătoare, ca cele două să nu divergă. Un `in` gol ar fi respins de PostgREST, deci se
pune un id imposibil. Numele punctului pentru pastilă se citește sub RLS cu
`.maybeSingle()`; un id străin dă „Punct de lucru ales”, ca pastila să existe oricum.

`/angajati?contract=expira` e cartela de pe `/panou`, cu același prag și aceeași
dată-limită (`src/domain/hr/contracte-expira.ts`, o singură sursă). Se restrânge tot prin
`.in("id", …)`, pe ANGAJAȚI distincți: cartela numără contracte, lista numără oameni,
deci două contracte care expiră ale aceluiași om dau un rând. Cele două filtre de intrare
se INTERSECTEAZĂ când vin împreună, nu se suprascriu, și amândouă contează la „Șterge
filtrele” din starea goală.

`?contract=` are valori fixe (`enumOptional`), ca `?status=`. O valoare străină pe
oricare din ele face `safeParse` să cadă pe TOT obiectul, iar `filtreDinUrl` întoarce
implicitele: lista nefiltrată, fără eroare și fără pastilă — deci și filtrele valide din
aceeași adresă se pierd tăcut. Alegerea e deliberată (un link vechi nu trebuie să dea un
ecran de eroare); efectul e că o adresă greșită întoarce lista întreagă pe care rolul o
vede oricum, nu zero rânduri.

## Paleta Ctrl+K

`cautaAngajatiPaleta` din `src/app/(app)/actions.ts` e o acțiune de CITIRE: organizația
din `resolveTenant()`, `employees:read` la orice scope, clientul sub RLS (restrânge
singur la echipă sau la fișa proprie). Caută pe nume SAU marcă, cu `%`, `_` și `\` scoase
din termen (sunt metacaractere de `ilike`, nu text căutat), și întoarce lista goală sub
două caractere — niciodată o eroare. Testul: `src/app/(app)/actions.test.ts`.

Paleta întreabă serverul doar dacă `/angajati/[id]` se deschide pentru rolul curent:
`cautaAngajati` vine din `poateDeschide` în `src/components/layout/topbar.tsx`, deci e
aceeași poartă ca ținta linkului. Clientul așteaptă 200 ms după ultima tastă și folosește
răspunsul doar dacă termenul lui e cel tastat acum. Oamenii găsiți se adaugă DUPĂ
potrivirile din meniu, sub plafonul comun de rezultate: pe un termen care prinde multe
pagini, ei pot cădea sub tăietură.

- Lotul 7e: antetul fișei leagă funcția (filtrul `?functie=`) și departamentul; firimituri cu numele; Concedii arată folosite/în așteptare/rămase; cardul de contract leagă documentul emis (`hr_issued_documents.contract_id`); fișa de cumul leagă fișa principală; „Istoricul modificărilor” (`IstoricModificari`, doar cu `audit:read`): [[strat/navigare]].
