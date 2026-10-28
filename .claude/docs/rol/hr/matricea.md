---
tip: rol
titlu: HR — matricea implicită și precedența
cai:
  - "supabase/migrations/0002_authz.sql"
  - "supabase/migrations/0056_concedii_hr_nu_aproba.sql"
  - "supabase/migrations/0067_pontaj_aprobare_pe_zi.sql"
  - "supabase/migrations/0099_invitatia_leaga_fisa.sql"
  - "supabase/migrations/0204_flota_soferi.sql"
tabele: [role_permissions]
permisiuni: [employees:invite, driver_licenses:create]
capcane: []
scris_pe: f437506578f23173e26c942102cdd3ddd2d109c8
scris_la: 2026-10-28
tags: [rol]
---

# HR — matricea implicită și precedența

Secțiune extrasă din [[rol/hr]]: cheile pe care rolul le are în seed, cu scope-ul lor,
și cele trei niveluri care decid ce vede de fapt HR-ul unei firme anume. Aprobările care
îi lipsesc și refuzurile tăcute rămân pe pagina-mamă.

## Ce are

| Resursă                                                                                  | Acțiuni                                           |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `employees`, `departments`, `ssm`, `inventory`, `checklists`, `payroll`, `announcements` | toate, scope `all`                                |
| `attendance`, `leave`                                                                    | toate **fără `approve`**, scope `all`             |
| `employees:invite`                                                                       | `all` (0099)                                      |
| `courses`                                                                                | `read`, `create`, `update`, `export` — all (0075) |
| `evaluations`                                                                            | `read`, `create`, `update` — all (0070)           |
| `reges`                                                                                  | tot, inclusiv `configure` — all (0087)            |
| `tickets`                                                                                | `read`, `create`, `update` — **own** (0046)       |
| `driver_licenses`                                                                        | `read`, `create`, `update` — all (0204)           |
| `audit`                                                                                  | _none_ — refuz EXPLICIT                           |

`reges:configure` merge la HR fiindcă specialistul de personal e cel care obține cheile
din portalul REGES; strângerea lui la `org_admin` se face per firmă, dintr-un rând în
`role_permissions`, fără deploy.

`tickets` la scope `own` nu e o omisiune: HR e solicitant în ticketing, nu operator IT.

## Precedența, când o firmă vrea altfel

Tabelul e implicitul global. **Rândul membrului** bate **rândul organizației**, care bate
implicitul (`app.has_permission`, extinsă de `0063_permisiuni_per_angajat.sql`; oglinda ei
în TypeScript e `getPermissionMap` din `src/lib/auth/permissions.ts`). O firmă care chiar
vrea ca HR-ul ei să aprobe concediile inserează un rând pe organizație — fără deploy și
fără să atingă seed-ul.
