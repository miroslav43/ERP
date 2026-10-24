---
tip: rol
titlu: Manager — matricea implicită și precedența
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
capcane: []
scris_pe: c1ad3b039681d8b4d5f1f466c0c2a4e7f3ab67f8
scris_la: 2026-10-24
tags: [rol]
---

# Manager — matricea implicită și precedența

Secțiune extrasă din [[rol/manager]]: cheile pe care rolul le are în seed, cu
scope-ul lor, și cele trei niveluri care decid ce vede de fapt un manager al unei
firme anume. Refuzurile și cum arată ele pe ecran rămân pe pagina-mamă.

## Ce are

| Resursă                         | Acțiuni, cu scope-ul lor                              |
| ------------------------------- | ----------------------------------------------------- |
| `attendance`, `per_diem`        | `read`, `approve` — team                              |
| `trip_sheets`                   | `read`, `approve` team; `create`, `update` own (0199) |
| `vehicles`                      | `read` — team, plus mașinile pool (0199)              |
| `driver_licenses`               | `read` — team (0204)                                  |
| `vehicle_reservations`          | `read`, `approve` team; `create`, `update` own (0216) |
| `leave`                         | `read`, `approve` team; `create`, `update` own (0071) |
| `checklists`                    | `read`, `approve` team; `update` own (0088)           |
| `tickets`                       | `read`, `update`, `approve` team; `create` own (0046) |
| `evaluations`                   | `read`, `create`, `update` — team (0070)              |
| `courses`                       | `read`, `create`, `update`, `export` — team (0075)    |
| `employees`, `ssm`, `inventory` | `read` — team                                         |
| `maintenance`                   | `read` team; `create` **all** — sesizarea defecțiunii |
| `announcements`                 | `read` — all                                          |
| `roles`                         | `update` — team (0063)                                |
| `payroll`, `audit`              | _none_ — refuz EXPLICIT, nu rând lipsă                |

`roles:update = team` e îngust cu intenție: managerul poate debloca punctual un modul
cuiva din echipa lui, prin `role_permissions.member_id`, dar nu umblă la matricea
rolurilor.

## Cum se rezolvă un refuz care nu se explică

Precedența are trei niveluri, calculate identic în bază și în TypeScript: **rândul
membrului** bate **rândul organizației**, care bate **implicitul global**
(`app.has_permission`, extinsă de `0063_permisiuni_per_angajat.sql`; oglinda ei e
`getPermissionMap` din `src/lib/auth/permissions.ts`). Tabelul de mai sus e doar
implicitul: o firmă îi poate da sau lua managerului orice cheie fără deploy.

Când ecranul și baza nu spun același lucru — buton care duce în refuz, modul deblocat
care nu apare în meniu — cauza tipică e `getPermissionMap` chemat **fără** `memberId`:
suprascrierile per membru rămân invizibile ecranului, deși baza le respectă.
