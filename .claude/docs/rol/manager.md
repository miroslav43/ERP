---
tip: rol
titlu: Manager
aliases: [manager, sef-direct]
cai:
  - "supabase/migrations/0002_authz.sql"
  - "supabase/migrations/0063_permisiuni_per_angajat.sql"
  - "supabase/migrations/0071_manager_cere_concediu.sql"
  - "supabase/migrations/0088_integrare_defecte.sql"
  - "supabase/migrations/0199_flota_roluri.sql"
  - "supabase/migrations/0204_flota_soferi.sql"
  - "supabase/migrations/0216_flota_rezervari.sql"
tabele: [role_permissions, organization_members, employees]
permisiuni:
  - attendance:approve
  - leave:approve
  - per_diem:approve
  - trip_sheets:approve
  - vehicle_reservations:approve
  - roles:update
capcane: [4, 9, 16, 18, 26, 35]
scris_pe: c1ad3b039681d8b4d5f1f466c0c2a4e7f3ab67f8
scris_la: 2026-10-24
tags: [rol]
---

# Manager

Rolul care **vede și decide pentru echipa lui**, aproape nimic în plus. Nu e un
administrator cu raza mai mică: îi lipsesc perechile de scriere ale cheilor de aprobare
pe care le are, iar de acolo vin ecranele complete cu butoane care n-au ce face.

Sursa de adevăr e seed-ul din `0002_authz.sql` plus migrările care l-au corectat de
atunci — nu `src/config/permissions.ts`, care e doar vocabularul.

## Paginile rolului

| Pagină                   | Ce ține                                           |
| ------------------------ | ------------------------------------------------- |
| [[rol/manager/matricea]] | cheile din seed și precedența celor trei niveluri |

## „Echipa" înseamnă subarborele, cu el cu tot

`app.is_manager_of(org, angajat)` verifică `employees.manager_path @> array[fișa mea]`.
Lanțul conține angajatul însuși, deci **`is_manager_of(org, eu) = true`**: scope-ul
`team` include propria fișă a managerului, nu doar subordonații
(`0005_hr_rls.sql:36-38`). Unde asta ar însemna „își aprobă singur", excluderea se face
explicit, nu prin scope — lanțul de aprobare al concediilor sare peste solicitant
(`0017_fix_concedii.sql`). Flota a repetat excluderea de două ori: cu
`trip_sheets:approve = team` nu-și aprobă nici propria foaie, nici una întocmită de el
pentru altcineva, iar cu `vehicle_reservations:approve = team` nu-și decide propria
rezervare (`0199_flota_roluri.sql` §C3, `0216_flota_rezervari.sql`).

Subordonarea trăiește în `employees`, nu în `organization_members`. Un manager fără fișă
principală de angajat are `team` peste o mulțime goală: nicio eroare, liste goale peste
tot.

## Ce NU are — și cum arată asta pe ecran

- **`attendance:create = team`.** Din `0161` are `create = own` — se pontează pe sine,
  din cardul „Astăzi" de pe `/pontaj` și din grila săptămânii (portalul îl
  redirecționează). Are `approve`, deci vede pontajul echipei și decide pe el, dar nu
  scrie nicio linie a ei; foaia colectivă îi rămâne read-only. Politica `attendance_entries_update` trece prin
  `app.poate_scrie_pontaj`, care se uită tocmai la `attendance:create`, deci aprobarea în
  bloc nu merge prin clientul utilizatorului. — capcana #4
- **`attendance:approve = all`.** Blocarea și deblocarea perioadei o cer; cu `team`
  managerul primește 42501. Butonul se ascunde cu `can(..., "attendance:approve", "all")`,
  nu se lasă să eșueze. — capcana #9
- **`per_diem:update = team`.** Din `0154` are `create/update/delete = own` — își face și își
  modifică propria deplasare — dar nu `team`. Aprobarea echipei merge totuși din `0155`:
  `WITH CHECK` din `business_trips_update` și `trip_expenses_update` are și ramura `approve`.
  — capcana #16 (rezolvată)
- **`vehicles:*` în afară de `read = team`, și `trip_sheets:update = team`.** Din `0199`
  vede mașinile echipei și pool-ul (costurile, din 0225, doar pe ale echipei) și își face
  propriile foi, dar foaia unui subordonat o
  poate doar aproba sau respinge (P0001 la orice altă coloană). O foaie aprobată nu se mai
  atinge. Embed-ul `vehicles!vehicle_id` pe o mașină din afara echipei îi vine tot **NULL
  fără eroare**; câmpul se tipează `| null` și se afișează „—". — capcana #18,
  `[[modul/flota/roluri-si-portal]]`
- **`compliance:read`.** `public.expirables` îi întoarce zero rânduri, tăcut. Scadențele
  se calculează din tabelele sursă. — capcana #26
- **`trip_sheets` liber pe foile proprii.** Cu `create`/`update = own` întocmește, dar
  vehiculul trebuie să fie `pool` sau alocat șoferului foii în ziua plecării
  (`0199_flota_roluri.sql` §C1), iar cu `rezervare_obligatorie` pornită pe firmă pool-ul
  cere și o rezervare confirmată pe ziua foii (`0216_flota_rezervari.sql`); o foaie
  TRIMISĂ nu se mai corectează, se retrage întâi în ciornă (§C5, lărgit la orice scope
  de `0200_flota_foaia_zilnica.sql` §D1). Toate, P0001.
- **Permisul și avizul șoferului, când firma i-a retras cheia.** `verificari_soferi` îi
  dă atunci `null` pe câmpurile permisului și pe aviz — „nu se știe", nu „fără permis";
  un avertisment care citește `null` ca `false` acuză pe nedrept
  (`0204_flota_soferi.sql`).
- **`reges:*` și `employees:invite`.** Niciun rând, în `0087_reges_online.sql` respectiv
  `0099_invitatia_leaga_fisa.sql` — absența rândului ESTE refuzul, nu o omisiune.

Atenție la sensul invers: `maintenance:create = all` e mai LARG decât pare. Politica de
INSERT a echipamentelor și a planurilor îl lasă să treacă, deci poarta trebuie pusă în
aplicație pe `maintenance:update` / `team`; doar sesizarea rămâne pe `create`.
— capcana #35

## Când NU e suficientă pagina asta

- Ce refuză baza într-un modul anume: `modul/<directorul din src/app/(app)/>`.
- Textul integral al unei capcane: `node .claude/skills/administrativo/scripts/capcana.mjs --nr 16`.
