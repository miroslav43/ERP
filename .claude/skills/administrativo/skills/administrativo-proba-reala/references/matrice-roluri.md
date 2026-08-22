# Matricea de roluri — derivată din `0002_authz.sql`

⚠️ **Acest tabel e o copie de comoditate. Sursa de adevăr e baza.** Re-derivă-l
înainte de a te baza pe el:

```sql
select role, resource, scope, action
from public.role_permissions
where organization_id is null
order by role, resource, action;
```

sau, fără bază:
`node .claude/skills/administrativo/scripts/verifica-permisiuni.mjs --json`

Rolurile sunt exact cinci (`public.app_role`, `0001_kernel.sql:64`):
`super_admin`, `org_admin`, `manager`, `hr`, `employee`.
`super_admin` **nu se stochează niciodată** în `organization_members` (există un
CHECK care îl interzice) — sursa e `platform_admins`, iar accesul trece prin
`app.is_platform_admin()`, prima ramură `or` a aproape fiecărei politici SELECT.

## `org_admin`

`all` pe majoritatea resurselor. Excepții care contează:

| Resursă         | Scope                             | Notă                                                       |
| --------------- | --------------------------------- | ---------------------------------------------------------- |
| `organizations` | `all` pe `{read, update, export}` | `create`, `delete`, `approve` = **`none` explicit**        |
| `features`      | `all` pe `{read}`                 | restul `none` ⇒ **nu poate activa un modul** din interfață |

## `manager` — cel mai dens grup de capcane

```
attendance   team {read, approve}      leave        team {read, approve}
trip_sheets  team {read, approve}      checklists   team {read, approve}
per_diem     team {read, approve}      employees    team {read}
ssm          team {read}               inventory    team {read}
maintenance  team {read} + all {create}
announcements all {read}
payroll      none  {read,create,update,delete,approve,export}   ← REFUZ EXPLICIT
audit        none  {read, export}                                ← REFUZ EXPLICIT
```

Nu apare deloc: `vehicles`, `compliance`, `organizations`, `features`,
`branding`, `users`, `departments`, `roles`, `reports`. Absența = refuz.

Divergențe cunoscute (restanțe documentate, nu descoperiri):

- **capcana 4** — are `attendance:approve` dar **nu** `attendance:create`, iar
  `attendance_entries_update` cere `app.poate_scrie_pontaj`, care se uită la
  `create`. Managerul nu poate scrie `approved_at` cu clientul utilizatorului.
- **capcana 9** — blocarea perioadei cere `approve` cu scope `all`; managerul are
  `team` ⇒ 42501. Butonul se ascunde cu `can(..., "attendance:approve", "all")`.
- **capcana 16** — `business_trips_update` cere `per_diem:update` pe AMBELE
  ramuri, inclusiv aprobarea. Managerul n-are `per_diem:update` ⇒ 42501.
- **capcana 18** — fără `vehicles:*`, embed-ul `vehicles!vehicle_id` vine `NULL`
  fără eroare.
- **capcana 26** — fără `compliance:read`, `expirables` întoarce zero rânduri.
- **capcana 35** — `maintenance:create = all` face poarta BAZEI mai largă decât
  se intenționa; poarta APLICAȚIEI trebuie să fie `maintenance:update` / `team`.

## `hr`

`all` pe `{read, create, update, delete, approve, export}` pentru: `employees`,
`departments`, `attendance`, `leave`, `ssm`, `inventory`, `checklists`,
`announcements`, `payroll`. `audit` = `none` explicit.

**Nu are nimic** pe: `users`, `organizations`, `branding`, `features`,
`compliance`, `per_diem`, `trip_sheets`, `vehicles`, `maintenance`.

- **capcana 26** — administrează SSM, dar `expirabile_select` cere ȘI
  `compliance:read` ⇒ zero rânduri, fără eroare.
- **capcana 32** — `ssm_legal_parameters` și `environmental_permits` sunt mapate
  pe resursa **`compliance`**, nu `ssm` ⇒ `hr` nu le poate citi. Fereastra de
  avertizare (30 de zile) trebuie să fie constantă în cod, nu citire din tabelă.
- Fără `users:*`, `hr` **nu** poate gestiona membri sau invitații — orice ecran
  care sugerează altceva minte.

## `employee`

```
attendance own {read, create, update}   leave      own {read, create, update, delete}
per_diem   own {read, create, update, delete}
payroll    own {read, export}           inventory  own {read}
checklists own {read, update}           ssm        own {read}
users      own {read}                   maintenance own {read} + all {create}
announcements all {read}
employees  none {read, export}          ← nu-și vede nici propria fișă
audit      none {read, export}
```

- **capcana 10** — `employees:read = none`, iar `employees_select` cade pe
  `ELSE false`. Rezolvarea fișei proprii e legală **doar** în `actions.ts`, cu
  `createAdminSupabase()` filtrat pe `organization_id + user_id + is_primary +
deleted_at is null`.
- **capcana 27** — cu `ssm:read=own` / `maintenance:read=own` nu poate citi
  `ssm_training_types` sau `equipment` (politicile cu `col = null` cer ≥ `team`).
- **capcana 28** — `INSERT … RETURNING` sub o politică SELECT care ascunde
  rândul dă 42501, deși insertul ar fi trecut.
- **capcana 35** — `maintenance:create = all` e mai larg decât pare.
