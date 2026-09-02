---
tip: rol
titlu: Manager
aliases: [manager, sef-direct]
cai:
  - "supabase/migrations/0002_authz.sql"
  - "supabase/migrations/0063_permisiuni_per_angajat.sql"
  - "supabase/migrations/0071_manager_cere_concediu.sql"
  - "supabase/migrations/0088_integrare_defecte.sql"
tabele: [role_permissions, organization_members, employees]
permisiuni: [attendance:approve, leave:approve, per_diem:approve, trip_sheets:approve, roles:update]
capcane: [4, 9, 16, 18, 26, 35]
scris_pe: 0815fbff2c885cd44b5768ee25f084f16a9e95b8
scris_la: 2026-09-03
tags: [rol]
---

# Manager

Rolul care **vede și decide pentru echipa lui**, aproape nimic în plus. Nu e un
administrator cu raza mai mică: îi lipsesc perechile de scriere ale cheilor de aprobare
pe care le are, iar de acolo vin ecranele complete cu butoane care n-au ce face.

Sursa de adevăr e seed-ul din `0002_authz.sql` plus migrările care l-au corectat de
atunci — nu `src/config/permissions.ts`, care e doar vocabularul.

## „Echipa" înseamnă subarborele, cu el cu tot

`app.is_manager_of(org, angajat)` verifică `employees.manager_path @> array[fișa mea]`.
Lanțul conține angajatul însuși, deci **`is_manager_of(org, eu) = true`**: scope-ul
`team` include propria fișă a managerului, nu doar subordonații
(`0005_hr_rls.sql:36-38`). Unde asta ar însemna „își aprobă singur", excluderea se face
explicit, nu prin scope — lanțul de aprobare al concediilor sare peste solicitant
(`0017_fix_concedii.sql`).

Subordonarea trăiește în `employees`, nu în `organization_members`. Un manager fără fișă
principală de angajat are `team` peste o mulțime goală: nicio eroare, liste goale peste
tot.

## Ce are

| Resursă                                 | Acțiuni, cu scope-ul lor                              |
| --------------------------------------- | ----------------------------------------------------- |
| `attendance`, `per_diem`, `trip_sheets` | `read`, `approve` — team                              |
| `leave`                                 | `read`, `approve` team; `create`, `update` own (0071) |
| `checklists`                            | `read`, `approve` team; `update` own (0088)           |
| `tickets`                               | `read`, `update`, `approve` team; `create` own (0046) |
| `evaluations`                           | `read`, `create`, `update` — team (0070)              |
| `courses`                               | `read`, `create`, `update`, `export` — team (0075)    |
| `employees`, `ssm`, `inventory`         | `read` — team                                         |
| `maintenance`                           | `read` team; `create` **all** — sesizarea defecțiunii |
| `announcements`                         | `read` — all                                          |
| `roles`                                 | `update` — team (0063)                                |
| `payroll`, `audit`                      | _none_ — refuz EXPLICIT, nu rând lipsă                |

`roles:update = team` e îngust cu intenție: managerul poate debloca punctual un modul
cuiva din echipa lui, prin `role_permissions.member_id`, dar nu umblă la matricea
rolurilor.

## Ce NU are — și cum arată asta pe ecran

- **`attendance:create`.** Are `approve`, deci vede pontajul echipei și decide pe el, dar
  nu poate scrie o linie. Politica `attendance_entries_update` trece prin
  `app.poate_scrie_pontaj`, care se uită tocmai la `attendance:create`, deci aprobarea în
  bloc nu merge prin clientul utilizatorului. — capcana #4
- **`attendance:approve = all`.** Blocarea și deblocarea perioadei o cer; cu `team`
  managerul primește 42501. Butonul se ascunde cu `can(..., "attendance:approve", "all")`,
  nu se lasă să eșueze. — capcana #9
- **`per_diem:update`.** Are `per_diem:approve = team`, dar `business_trips_update` cere
  `poate_accesa_deplasare(..., 'update')` pe **ambele** ramuri, inclusiv pe cea de
  aprobare — deci aprobarea unui manager e respinsă cu 42501. — capcana #16
- **Orice `vehicles:*`.** Are `trip_sheets:approve = team`, deci ajunge pe `/flota/foi` și
  `/flota/aprobari`, dar embed-ul `vehicles!vehicle_id` îi vine **NULL fără eroare**.
  Câmpul se tipează `| null` și se afișează „—". — capcana #18
- **`compliance:read`.** `public.expirables` îi întoarce zero rânduri, tăcut. Scadențele
  se calculează din tabelele sursă. — capcana #26
- **`reges:*` și `employees:invite`.** Niciun rând, în `0087_reges_online.sql` respectiv
  `0099_invitatia_leaga_fisa.sql` — absența rândului ESTE refuzul, nu o omisiune.
- **`payroll` și `audit`** sunt `none`, adică refuz scris de cineva care s-a gândit la
  caz, nu configurare uitată.

Atenție la sensul invers: `maintenance:create = all` e mai LARG decât pare. Politica de
INSERT a echipamentelor și a planurilor îl lasă să treacă, deci poarta trebuie pusă în
aplicație pe `maintenance:update` / `team`; doar sesizarea rămâne pe `create`.
— capcana #35

## Cum se rezolvă un refuz care nu se explică

Precedența are trei niveluri, calculate identic în bază și în TypeScript: **rândul
membrului** bate **rândul organizației**, care bate **implicitul global**
(`app.has_permission`, extinsă de `0063_permisiuni_per_angajat.sql`; oglinda ei e
`getPermissionMap` din `src/lib/auth/permissions.ts`). Tabelul de mai sus e doar
implicitul: o firmă îi poate da sau lua managerului orice cheie fără deploy.

Când ecranul și baza nu spun același lucru — buton care duce în refuz, modul deblocat
care nu apare în meniu — cauza tipică e `getPermissionMap` chemat **fără** `memberId`:
suprascrierile per membru rămân invizibile ecranului, deși baza le respectă.

## Când NU e suficientă pagina asta

- Ce refuză baza într-un modul anume: `modul/<directorul din src/app/(app)/>`.
- Textul integral al unei capcane: `node .claude/skills/administrativo/scripts/capcana.mjs --nr 16`.
