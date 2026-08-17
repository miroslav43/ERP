# Stratul de autorizare în Postgres — Administrativo

## 0. Prerechizite (tipuri + tabele-suport)

```sql
create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext   with schema extensions;

-- rolurile (deja decise)
do $$ begin
  create type public.app_role as enum ('super_admin','org_admin','manager','hr','employee');
exception when duplicate_object then null; end $$;

-- scope-ul efectiv al unei permisiuni
create type public.permission_scope as enum ('none','own','team','all');

-- rangul folosit la agregare (mai multe roluri => scope-ul cel mai larg)
create or replace function public.scope_rank(p public.permission_scope)
returns int language sql immutable parallel safe as
$$ select case p when 'all' then 3 when 'team' then 2 when 'own' then 1 else 0 end $$;
```

**Purtătorul scope-ului de platformă.** `super_admin` rămâne în `app_role` (îl folosim în matricea de permisiuni), dar apartenența la platformă NU se ține în `organization_members` — altfel ar trebui `organization_id` NULL acolo, ceea ce strică unicitatea, cheia străină și predicatele RLS. Apartenența de platformă stă separat:

```sql
create table public.platform_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  granted_by  uuid references auth.users(id),
  granted_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
alter table public.platform_admins enable row level security;
-- nicio politică = zero acces din clientul autentificat; se administrează doar prin service_role
```

---

## 1. `role_permissions` — matricea ca DATE

```sql
create table public.role_permissions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade, -- NULL = implicit global platformă
  role            public.app_role not null,
  resource        text not null check (resource ~ '^[a-z_]{2,40}$'),
  action          text not null check (action in
                    ('read','create','update','delete','approve','publish','export')),
  scope           public.permission_scope not null default 'none',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) default auth.uid(),
  deleted_at      timestamptz,
  -- suprascrierea per organizație nu se aplică rolului de platformă
  constraint role_permissions_super_admin_global_only
    check (role <> 'super_admin' or organization_id is null)
);

-- unicitate separată pe cele două planuri (NULL e „distinct" în UNIQUE clasic)
create unique index role_permissions_global_uniq
  on public.role_permissions (role, resource, action)
  where organization_id is null and deleted_at is null;

create unique index role_permissions_org_uniq
  on public.role_permissions (organization_id, role, resource, action)
  where organization_id is not null and deleted_at is null;

-- index de lookup: exact predicatul din has_permission()
create index role_permissions_lookup_idx
  on public.role_permissions (resource, action, role, organization_id)
  where deleted_at is null;

alter table public.role_permissions enable row level security;
```

### Cum se rezolvă suprascrierea

Pentru un triplet `(role, resource, action)` există cel mult două rânduri candidate: cel al organizației (`organization_id = p_org`) și cel global (`organization_id is null`). Rezoluția este un `COALESCE` cu trei nivele:

```sql
coalesce( scope_org, scope_global, 'none' )
```

Formulat literal (varianta didactică, două subselect-uri):

```sql
select coalesce(
  (select rp.scope from public.role_permissions rp
     where rp.organization_id = p_org and rp.role = v_role
       and rp.resource = p_resource and rp.action = p_action and rp.deleted_at is null),
  (select rp.scope from public.role_permissions rp
     where rp.organization_id is null and rp.role = v_role
       and rp.resource = p_resource and rp.action = p_action and rp.deleted_at is null),
  'none'::public.permission_scope);
```

În producție folosim forma echivalentă cu o singură scanare, `DISTINCT ON` + `ORDER BY (organization_id is null)`: `false` (rândul organizației) sortează înaintea lui `true` (rândul global), deci rândul specific câștigă. Un rând de organizație cu `scope='none'` este o **retragere explicită** de drept, nu o absență — de aceea `none` este valoare stocabilă, nu doar implicit.

Absența oricărui rând ⇒ `none`. Nu există „deny" separat: `none` e negarea.

### SEED complet (rândurile globale, `organization_id = NULL`)

```sql
insert into public.role_permissions (organization_id, role, resource, action, scope)
select null, m.role::public.app_role, m.resource, a, m.scope::public.permission_scope
from (values
  -- ============ SUPER_ADMIN (platformă) ============
  ('super_admin','organizations',        array['read','create','update','delete','export'], 'all'),
  ('super_admin','organization_features',array['read','create','update','delete'],          'all'),
  ('super_admin','branding',             array['read','update'],                            'all'),
  ('super_admin','users',                array['read','create','update','delete'],          'all'),
  ('super_admin','role_permissions',     array['read','create','update','delete'],          'all'),
  ('super_admin','audit_logs',           array['read','export'],                            'all'),

  -- ============ ORG_ADMIN ============
  ('org_admin','organizations',        array['read'],                                       'all'),
  ('org_admin','organization_features',array['read'],                                       'all'),
  ('org_admin','branding',             array['read','update'],                              'all'),
  ('org_admin','users',                array['read','create','update','delete'],            'all'),
  ('org_admin','role_permissions',     array['read','create','update','delete'],            'all'),
  ('org_admin','employees',            array['read','create','update','delete','export'],   'all'),
  ('org_admin','departments',          array['read','create','update','delete'],            'all'),
  ('org_admin','attendance',           array['read','create','update','delete','approve','export'], 'all'),
  ('org_admin','leave_requests',       array['read','create','update','delete','approve','export'], 'all'),
  ('org_admin','trip_sheets',          array['read','create','update','delete','approve','export'], 'all'),
  ('org_admin','vehicles',             array['read','create','update','delete','export'],   'all'),
  ('org_admin','ssm',                  array['read','create','update','delete','export'],   'all'),
  ('org_admin','maintenance',          array['read','create','update','delete','approve'],  'all'),
  ('org_admin','inventory',            array['read','create','update','delete','export'],   'all'),
  ('org_admin','checklists',           array['read','create','update','delete','approve'],  'all'),
  ('org_admin','announcements',        array['read','create','update','delete','publish'],  'all'),
  ('org_admin','payroll',              array['read','create','update','delete','export'],   'all'),
  ('org_admin','per_diem',             array['read','create','update','delete','approve','export'], 'all'),
  ('org_admin','audit_logs',           array['read','export'],                              'all'),

  -- ============ MANAGER ============
  ('manager','employees',      array['read'],                                'team'),
  ('manager','departments',    array['read'],                                'team'),
  ('manager','attendance',     array['read','create','update','approve','export'], 'team'),
  ('manager','leave_requests', array['read','create','update','approve'],    'team'),
  ('manager','trip_sheets',    array['read','create','update','approve'],    'team'),
  ('manager','vehicles',       array['read'],                                'all'),
  ('manager','ssm',            array['read'],                                'team'),
  ('manager','maintenance',    array['read','create'],                       'all'),   -- sesizare la nivel de firmă
  ('manager','inventory',      array['read'],                                'team'),
  ('manager','checklists',     array['read','create','update','approve'],    'team'),
  ('manager','announcements',  array['read'],                                'all'),
  ('manager','announcements',  array['create','update','publish'],           'team'),
  ('manager','per_diem',       array['read','create','update','approve'],    'team'),
  -- retragere EXPLICITĂ, ca org_admin să o poată suprascrie vizibil (salarii = configurabil)
  ('manager','payroll',        array['read','create','update','delete','export'], 'none'),
  ('manager','audit_logs',     array['read'],                                'none'),

  -- ============ HR ============
  ('hr','users',           array['read','create'],                                 'team'),
  ('hr','employees',       array['read','create','update','delete','export'],      'all'),
  ('hr','departments',     array['read','create','update','delete'],               'all'),
  ('hr','attendance',      array['read','create','update','delete','approve','export'], 'all'),
  ('hr','leave_requests',  array['read','create','update','delete','approve','export'], 'all'),
  ('hr','ssm',             array['read','create','update','delete','export'],      'all'),
  ('hr','inventory',       array['read','create','update','delete','export'],      'all'),
  ('hr','checklists',      array['read','create','update','delete','approve'],     'all'),
  ('hr','announcements',   array['read','create','update','delete','publish'],     'all'),
  ('hr','payroll',         array['read','create','update','delete','export'],      'all'),
  ('hr','per_diem',        array['read','create','update','delete','approve','export'], 'all'),
  ('hr','trip_sheets',     array['read','create','update','approve'],              'none'),
  ('hr','vehicles',        array['read'],                                          'none'),
  ('hr','maintenance',     array['read','create'],                                 'none'),

  -- ============ EMPLOYEE ============
  ('employee','employees',      array['read','update'],           'own'),
  ('employee','departments',    array['read'],                    'own'),
  ('employee','attendance',     array['read','create','update'],  'own'),
  ('employee','leave_requests', array['read','create','update'],  'own'),
  ('employee','trip_sheets',    array['read','create','update'],  'own'),
  ('employee','ssm',            array['read','update'],           'own'),
  ('employee','maintenance',    array['read','create'],           'own'),
  ('employee','inventory',      array['read'],                    'own'),
  ('employee','checklists',     array['read','create','update'],  'own'),
  ('employee','announcements',  array['read'],                    'all'),
  ('employee','payroll',        array['read'],                    'own'),
  ('employee','per_diem',       array['read','create'],           'own')
) as m(role, resource, actions, scope)
cross join lateral unnest(m.actions) as a
on conflict do nothing;
```

Exemplu de suprascriere per organizație (org_admin activează salariile pentru manageri):

```sql
insert into public.role_permissions (organization_id, role, resource, action, scope)
values (:org, 'manager','payroll','read','team'),
       (:org, 'manager','payroll','export','team')
on conflict (organization_id, role, resource, action) where deleted_at is null
do update set scope = excluded.scope, updated_at = now();
```

**Convenție de scope** (folosită identic în toate politicile modulelor):
- `all` — toate rândurile organizației curente;
- `team` — rândurile subordonaților direcți/indirecți **plus rândurile proprii**;
- `own` — doar rândurile legate de `employee_id` al utilizatorului;
- `none` — nimic.

---

## 2. Funcțiile helper (toate `SECURITY DEFINER`, `SET search_path = ''`)

```sql
-- ---------- is_platform_admin ----------
create or replace function public.is_platform_admin()
returns boolean
language sql
stable                       -- STABLE: rezultat constant în cadrul unui statement
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins pa
     where pa.user_id = (select auth.uid()) and pa.deleted_at is null
  );
$$;

-- ---------- current_org_ids ----------
create or replace function public.current_org_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(m.organization_id), array[]::uuid[])
    from public.organization_members m
   where m.user_id = (select auth.uid())
     and m.is_active
     and m.deleted_at is null;
$$;

-- ---------- is_member_of ----------
create or replace function public.is_member_of(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_org is not null and exists (
    select 1 from public.organization_members m
     where m.organization_id = p_org
       and m.user_id = (select auth.uid())
       and m.is_active and m.deleted_at is null
  );
$$;

-- ---------- has_role ----------
create or replace function public.has_role(p_org uuid, p_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    'super_admin' = any (p_roles) and public.is_platform_admin()
  ) or exists (
    select 1 from public.organization_members m
     where m.organization_id = p_org
       and m.user_id = (select auth.uid())
       and m.role = any (p_roles)
       and m.is_active and m.deleted_at is null
  );
$$;

-- ---------- org_has_feature ----------
create or replace function public.org_has_feature(p_org uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_feature = 'nucleu' or exists (
    select 1 from public.organization_features f
     where f.organization_id = p_org
       and f.feature = p_feature
       and f.is_enabled
       and f.deleted_at is null
  );
$$;

-- ---------- is_manager_of ----------
-- p_user = user_id-ul ținta. TRUE dacă apelantul este el însuși ținta,
-- managerul direct, un manager pe lanțul ierarhic, sau managerul departamentului.
create or replace function public.is_manager_of(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as uid)
  select p_user is not null and (
    p_user = (select uid from me)
    or exists (
      with recursive chain as (
        select m.id, m.organization_id, m.user_id, m.manager_member_id, m.department_id
          from public.organization_members m, me
         where m.user_id = p_user and m.is_active and m.deleted_at is null
        union all
        select p.id, p.organization_id, p.user_id, p.manager_member_id, p.department_id
          from public.organization_members p
          join chain c on p.id = c.manager_member_id
         where p.is_active and p.deleted_at is null
      )
      select 1 from chain c, me
       where c.user_id = me.uid and c.user_id <> p_user
      union all
      select 1
        from public.organization_members tgt
        join public.departments d on d.id = tgt.department_id and d.deleted_at is null
        join public.organization_members mgr on mgr.id = d.manager_member_id
           , me
       where tgt.user_id = p_user and tgt.is_active and tgt.deleted_at is null
         and mgr.user_id = me.uid and mgr.is_active and mgr.deleted_at is null
    )
  );
$$;

-- ---------- has_permission (întoarce SCOPE-ul efectiv) ----------
create or replace function public.has_permission(p_org uuid, p_resource text, p_action text)
returns public.permission_scope
language sql
stable
security definer
set search_path = ''
as $$
  with roles as (
    select 'super_admin'::public.app_role as role
     where public.is_platform_admin()
    union
    select m.role
      from public.organization_members m
     where m.organization_id = p_org
       and m.user_id = (select auth.uid())
       and m.is_active and m.deleted_at is null
  ),
  resolved as (
    select distinct on (rp.role) rp.role, rp.scope
      from public.role_permissions rp
      join roles r on r.role = rp.role
     where rp.resource = p_resource
       and rp.action   = p_action
       and rp.deleted_at is null
       and ( rp.organization_id is null
             or (rp.organization_id = p_org and rp.role <> 'super_admin') )
     order by rp.role, (rp.organization_id is null)   -- false = rândul org => câștigă
  )
  select coalesce(
    (select r.scope from resolved r order by public.scope_rank(r.scope) desc limit 1),
    'none'::public.permission_scope);
$$;

-- helper de confort pentru politici: mulțimea echipei
create or replace function public.team_member_ids(p_org uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  with recursive me as (
    select m.id from public.organization_members m
     where m.organization_id = p_org and m.user_id = (select auth.uid())
       and m.is_active and m.deleted_at is null
  ),
  sub as (
    select id from me
    union all
    select c.id
      from public.organization_members c
      join sub s on c.manager_member_id = s.id
     where c.is_active and c.deleted_at is null
  )
  select coalesce(array_agg(distinct id), array[]::uuid[]) from sub;
$$;

-- privilegii: doar rolul autentificat, niciodată anon
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.is_platform_admin(), public.current_org_ids(), public.is_member_of(uuid),
  public.has_role(uuid, public.app_role[]), public.org_has_feature(uuid, text),
  public.is_manager_of(uuid), public.has_permission(uuid, text, text),
  public.team_member_ids(uuid), public.scope_rank(public.permission_scope)
to authenticated;
```

### De ce `STABLE` și nu altceva

| Volatilitate | Efect în RLS |
|---|---|
| `VOLATILE` (implicit!) | Planificatorul presupune că rezultatul se poate schimba **la fiecare rând**. Funcția e re-executată per rând, nu poate fi extrasă ca InitPlan, nu poate fi folosită în condiții de index scan. Pe o tabelă de 200k rânduri de pontaj înseamnă 200k subinterogări. |
| `STABLE` | Rezultat garantat constant pentru aceleași argumente **în interiorul unui singur statement**. Permite evaluare o singură dată (ca InitPlan, când argumentele sunt constante la nivel de query), permite folosirea rezultatului drept parametru într-un Index Cond, permite ca planificatorul să estimeze corect selectivitatea. |
| `IMMUTABLE` | Interzis aici — funcțiile citesc tabele. Ar produce rezultate cache-uite incorect (ex. în indecși de expresie). Doar `scope_rank()` e `IMMUTABLE`. |

Toate funcțiile care citesc tabele sunt `STABLE`. Toate au `SET search_path = ''` și **nume complet calificate** (`public.`, `auth.`, `extensions.`), altfel un atacator cu drept de `CREATE` pe un schema din `search_path` ar putea deturna un apel de funcție executat cu privilegiile proprietarului.

---

## 3. Recursiunea în politici — problema și soluția exactă

**Simptomul.** O politică pe `organization_members` de forma:

```sql
-- GREȘIT
create policy m_sel on public.organization_members for select to authenticated
using (organization_id in (select organization_id from public.organization_members
                            where user_id = auth.uid()));
```

Subinterogarea citește `organization_members` ⇒ Postgres aplică din nou aceeași politică ⇒ `ERROR: 42P17: infinite recursion detected in policy for relation "organization_members"`. Același lucru se întâmplă dacă politica apelează o funcție `SECURITY INVOKER` care citește tabela.

**Soluția.** Funcție `SECURITY DEFINER` deținută de `postgres` (proprietarul tabelei), invocată din politică.

De ce funcționează, mecanic:

1. **RLS se evaluează în raport cu `current_user`.** Într-o funcție `SECURITY DEFINER`, `current_user` devine proprietarul funcției pe durata execuției. Proprietarul tabelei este exceptat de la propriile politici RLS (și rolul `postgres` din Supabase are `BYPASSRLS`). Deci interogarea din interiorul funcției nu declanșează politica ⇒ lanțul se rupe.
2. **Funcțiile `SECURITY DEFINER` nu sunt niciodată inline-uite.** Inlining-ul de funcții SQL simple (care ar reintroduce sub-interogarea în corpul query-ului și ar reactiva politica) este dezactivat explicit de planificator pentru funcțiile definer. Funcția rămâne o cutie neagră evaluată în alt context de securitate.
3. **Obligatoriu: `NO FORCE ROW LEVEL SECURITY`** pe `organization_members`, `platform_admins`, `role_permissions`. `ALTER TABLE ... FORCE ROW LEVEL SECURITY` aplică politicile **și** proprietarului — asta ar reintroduce recursiunea. Nu îl folosim pe tabelele citite de helperi.

**Regula de disciplină** pe care o impunem: politica de bază pe `organization_members` nu conține **niciun** subselect pe propria tabelă; folosește doar predicatul direct `user_id = (select auth.uid())` plus apeluri la funcții definer.

```sql
-- CORECT
create policy organization_members_select on public.organization_members
for select to authenticated
using (
  user_id = (select auth.uid())                                 -- rândul propriu: predicat direct
  or (select public.is_platform_admin())                        -- definer: fără recursiune
  or (
    (select public.has_permission(organization_id,'users','read')) = 'all'
    and organization_id = any ((select public.current_org_ids())))
  or (
    (select public.has_permission(organization_id,'users','read')) = 'team'
    and public.is_manager_of(user_id))
);
```

Atenție: `has_permission(organization_id, ...)` primește o **coloană**, deci nu poate fi promovat la InitPlan; rămâne per-rând. Pentru tabelele mari de business folosim varianta pre-calculată: `organization_id = any ((select public.current_org_ids()))` (InitPlan) drept prim filtru ieftin, iar apelul cu scope doar ca al doilea termen.

---

## 4. `(select auth.uid())` vs `auth.uid()` — caching de InitPlan

`auth.uid()` este `STABLE`, dar Postgres **nu ridică automat** un apel de funcție stabilă în afara qual-ului: expresia rămâne parte din filtrul evaluat **pentru fiecare rând** scanat. `auth.uid()` face `current_setting('request.jwt.claims')` + parse JSON — pe 500.000 de rânduri sunt 500.000 de parsări JSON.

Scris ca subinterogare scalară fără corelație, `(select auth.uid())` devine un **InitPlan**: planificatorul îl evaluează **o singură dată**, înainte de scan, și îl injectează ca parametru `$0`. Beneficii:

1. o singură evaluare per statement;
2. `$0` este tratat drept constantă la execuție ⇒ predicatul `user_id = $0` devine eligibil pentru **Index Cond** (Index Scan în loc de Seq Scan + Filter);
3. estimările de selectivitate se fac pe o egalitate cu constantă, nu pe un apel opac de funcție.

```sql
-- Fără wrapping
explain (analyze, costs off)
select * from public.attendance_entries;
--  Seq Scan on attendance_entries
--    Filter: (employee_user_id = auth.uid())
--    Rows Removed by Filter: 498742
--  Execution Time: 941.3 ms

-- Cu wrapping
--  Index Scan using attendance_entries_employee_idx on attendance_entries
--    Index Cond: (employee_user_id = $0)
--    InitPlan 1
--      ->  Result   (actual rows=1 loops=1)
--  Execution Time: 3.8 ms
```

Aceeași regulă se aplică **tuturor** helperilor cu argumente constante la nivel de query: `(select public.is_platform_admin())`, `(select public.current_org_ids())`, `(select public.has_permission(:org,'attendance','read'))`. Când argumentul este o coloană (`organization_id`), wrapping-ul nu ajută — atunci fie folosim `current_org_ids()` pe post de pre-filtru, fie pasăm organizația activă ca parametru din Server Action.

---

## 5. Politicile RLS

```sql
alter table public.organizations         enable row level security;
alter table public.organization_members  enable row level security;
alter table public.organization_features enable row level security;
alter table public.audit_logs            enable row level security;
alter table public.invitations           enable row level security;
alter table public.notifications         enable row level security;

-- indecși obligatorii pentru performanța RLS
create index if not exists om_user_idx on public.organization_members (user_id)
  where is_active and deleted_at is null;
create unique index if not exists om_org_user_uniq
  on public.organization_members (organization_id, user_id) where deleted_at is null;
create index if not exists om_manager_idx on public.organization_members (manager_member_id);
create index if not exists audit_org_created_idx on public.audit_logs (organization_id, created_at desc);
create index if not exists notif_user_idx on public.notifications (user_id, created_at desc);
```

### 5.1 `organization_members`

```sql
create policy organization_members_select on public.organization_members
for select to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_platform_admin())
  or (organization_id = any ((select public.current_org_ids()))
      and (
        public.has_permission(organization_id,'users','read') = 'all'
        or (public.has_permission(organization_id,'users','read') = 'team'
            and public.is_manager_of(user_id))
      ))
);

create policy organization_members_insert on public.organization_members
for insert to authenticated
with check (
  organization_id = any ((select public.current_org_ids()))
  and public.has_permission(organization_id,'users','create') in ('all','team')
  -- fără escaladare de privilegii
  and role <> 'super_admin'
  and (role <> 'org_admin' or public.has_role(organization_id, array['org_admin']::public.app_role[]))
  -- respectarea seats_limit
  and (select o.seats_limit from public.organizations o where o.id = organization_id) is null
      or (select count(*) from public.organization_members m2
           where m2.organization_id = organization_members.organization_id
             and m2.is_active and m2.deleted_at is null)
          < (select o.seats_limit from public.organizations o where o.id = organization_id)
);

create policy organization_members_update on public.organization_members
for update to authenticated
using (
  organization_id = any ((select public.current_org_ids()))
  and public.has_permission(organization_id,'users','update') = 'all'
)
with check (
  organization_id = any ((select public.current_org_ids()))
  and public.has_permission(organization_id,'users','update') = 'all'
  and role <> 'super_admin'
  and (role <> 'org_admin' or public.has_role(organization_id, array['org_admin']::public.app_role[]))
  -- interzice auto-retrogradarea ultimului org_admin (validat suplimentar prin trigger)
);

-- soft delete peste tot: DELETE fizic interzis explicit, documentat în catalog
create policy organization_members_no_delete on public.organization_members
for delete to authenticated using (false);
```

### 5.2 `organizations`

```sql
create policy organizations_select on public.organizations
for select to authenticated
using ((select public.is_platform_admin()) or id = any ((select public.current_org_ids())));

-- organizațiile se creează EXCLUSIV din Super-Admin
create policy organizations_insert on public.organizations
for insert to authenticated
with check ((select public.is_platform_admin()));

create policy organizations_update on public.organizations
for update to authenticated
using (
  (select public.is_platform_admin())
  or (id = any ((select public.current_org_ids()))
      and public.has_permission(id,'branding','update') = 'all')
)
with check (
  (select public.is_platform_admin())
  or (id = any ((select public.current_org_ids()))
      and public.has_permission(id,'branding','update') = 'all')
);

create policy organizations_no_delete on public.organizations
for delete to authenticated using (false);
```

Coloanele comerciale nu se protejează cu RLS (RLS e la nivel de rând), ci cu **privilegii de coloană** — un org_admin poate schimba brandingul, nu planul:

```sql
revoke update on public.organizations from authenticated;
grant update (name, legal_name, logo_path, primary_color, secondary_color,
              address, city, county, phone, email, website, updated_at)
  on public.organizations to authenticated;
-- plan, seats_limit, subscription_status, trial_ends_at, cui, slug rămân doar pentru service_role
```

### 5.3 `organization_features`

```sql
create policy organization_features_select on public.organization_features
for select to authenticated
using ((select public.is_platform_admin()) or organization_id = any ((select public.current_org_ids())));

create policy organization_features_insert on public.organization_features
for insert to authenticated with check ((select public.is_platform_admin()));

create policy organization_features_update on public.organization_features
for update to authenticated
using ((select public.is_platform_admin()))
with check ((select public.is_platform_admin()));

create policy organization_features_no_delete on public.organization_features
for delete to authenticated using (false);
```

### 5.4 `audit_logs` — append-only, scris exclusiv de trigger

```sql
create policy audit_logs_select on public.audit_logs
for select to authenticated
using (
  (select public.is_platform_admin())
  or (organization_id = any ((select public.current_org_ids()))
      and public.has_permission(organization_id,'audit_logs','read') = 'all')
);

-- niciun client nu scrie direct; scrie doar public.tg_audit() (SECURITY DEFINER)
create policy audit_logs_no_insert on public.audit_logs for insert to authenticated with check (false);
create policy audit_logs_no_update on public.audit_logs for update to authenticated using (false);
create policy audit_logs_no_delete on public.audit_logs for delete to authenticated using (false);
```

### 5.5 `invitations`

```sql
create policy invitations_select on public.invitations
for select to authenticated
using (
  (select public.is_platform_admin())
  or (organization_id = any ((select public.current_org_ids()))
      and public.has_permission(organization_id,'users','read') <> 'none')
);

create policy invitations_insert on public.invitations
for insert to authenticated
with check (
  organization_id = any ((select public.current_org_ids()))
  and public.has_permission(organization_id,'users','create') <> 'none'
  and role <> 'super_admin'
  and (role <> 'org_admin' or public.has_role(organization_id, array['org_admin']::public.app_role[]))
  and invited_by = (select auth.uid())
  and expires_at > now() and expires_at <= now() + interval '30 days'
);

-- singura actualizare permisă din UI este revocarea
create policy invitations_update on public.invitations
for update to authenticated
using (organization_id = any ((select public.current_org_ids()))
       and public.has_permission(organization_id,'users','update') <> 'none'
       and accepted_at is null)
with check (organization_id = any ((select public.current_org_ids()))
       and public.has_permission(organization_id,'users','update') <> 'none');

create policy invitations_no_delete on public.invitations for delete to authenticated using (false);

revoke select, update on public.invitations from authenticated;
grant select (id, organization_id, email, role, expires_at, accepted_at,
              revoked_at, invited_by, created_at) on public.invitations to authenticated;
grant update (revoked_at, updated_at) on public.invitations to authenticated;
-- token_hash NU este niciodată lizibil din client
```

### 5.6 `notifications`

```sql
create policy notifications_select on public.notifications
for select to authenticated
using (user_id = (select auth.uid())
       and organization_id = any ((select public.current_org_ids())));

-- create doar din funcții SECURITY DEFINER / Edge Functions
create policy notifications_no_insert on public.notifications
for insert to authenticated with check (false);

create policy notifications_update on public.notifications
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy notifications_no_delete on public.notifications
for delete to authenticated using (false);

revoke update on public.notifications from authenticated;
grant update (read_at, dismissed_at, updated_at) on public.notifications to authenticated;
```

---

## 6. Triggere generice: audit + `updated_at`

```sql
create table public.audit_logs (
  id              bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id),
  actor_id        uuid,
  actor_email     text,
  actor_role      public.app_role,
  action          text not null check (action in ('INSERT','UPDATE','DELETE','READ_SENSITIVE')),
  table_schema    text not null,
  table_name      text not null,
  record_id       text,
  changed_columns text[],
  before_data     jsonb,
  after_data      jsonb,
  ip_address      inet,
  user_agent      text,
  created_at      timestamptz not null default now()
) partition by range (created_at);
-- partiții lunare create de pg_cron; index creat pe fiecare partiție
```

```sql
create or replace function public.tg_audit()
returns trigger
language plpgsql
security definer                     -- scrie în audit_logs ocolind politica „no insert"
set search_path = ''
as $$
declare
  v_noise    text[] := array['updated_at','created_at','search_tsv','tsv',
                             'last_seen_at','last_login_at','version','etag'];
  v_exclude  text[];
  v_before   jsonb;
  v_after    jsonb;
  v_changed  text[];
  v_org      uuid;
  v_rec      text;
  v_headers  jsonb;
begin
  v_exclude := v_noise || coalesce(tg_argv[0]::text[], array[]::text[]);

  if tg_op in ('UPDATE','DELETE') then v_before := to_jsonb(old) - v_exclude; end if;
  if tg_op in ('INSERT','UPDATE') then v_after  := to_jsonb(new) - v_exclude; end if;

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(e.key order by e.key), array[]::text[])
      into v_changed
      from jsonb_each(v_after) e
     where v_before -> e.key is distinct from e.value;

    if cardinality(v_changed) = 0 then
      return new;                                   -- update no-op: nu poluăm auditul
    end if;
    -- păstrăm doar delta, nu rândul întreg
    v_before := (select jsonb_object_agg(k, v_before -> k)
                   from unnest(v_changed) k where v_before ? k);
    v_after  := (select jsonb_object_agg(k, v_after  -> k) from unnest(v_changed) k);
  end if;

  v_org := nullif(coalesce(v_after, v_before) ->> 'organization_id','')::uuid;
  v_rec := coalesce(to_jsonb(coalesce(new, old)) ->> 'id',
                    to_jsonb(coalesce(new, old)) ->> 'uuid');
  v_headers := nullif(current_setting('request.headers', true), '')::jsonb;

  insert into public.audit_logs (
    organization_id, actor_id, actor_email, actor_role, action,
    table_schema, table_name, record_id, changed_columns,
    before_data, after_data, ip_address, user_agent)
  values (
    v_org,
    (select auth.uid()),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email',
    (select m.role from public.organization_members m
      where m.organization_id = v_org and m.user_id = (select auth.uid())
        and m.deleted_at is null limit 1),
    tg_op, tg_table_schema, tg_table_name, v_rec, v_changed,
    v_before, v_after,
    nullif(split_part(coalesce(v_headers ->> 'x-forwarded-for',''), ',', 1),'')::inet,
    left(coalesce(v_headers ->> 'user-agent',''), 512));

  return coalesce(new, old);
exception when others then
  -- auditul nu are voie să blocheze tranzacția de business, dar nici să dispară tăcut
  raise warning 'AUDIT_FAILED table=%.% op=% sqlstate=% msg=%',
    tg_table_schema, tg_table_name, tg_op, sqlstate, sqlerrm;
  return coalesce(new, old);
end $$;

-- updated_at
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- atașare (macro de migrare, refolosibil)
create or replace function public.attach_standard_triggers(
  p_table text, p_exclude text[] default array[]::text[])
returns void language plpgsql set search_path = '' as $$
begin
  execute format(
    'drop trigger if exists set_updated_at on public.%I;
     create trigger set_updated_at before update on public.%I
       for each row execute function public.tg_set_updated_at();', p_table, p_table);
  execute format(
    'drop trigger if exists audit_trail on public.%I;
     create trigger audit_trail after insert or update or delete on public.%I
       for each row execute function public.tg_audit(%L);',
    p_table, p_table, p_exclude);
end $$;

select public.attach_standard_triggers(t, coalesce(x, array[]::text[]))
from (values
  ('organizations',        null::text[]),
  ('organization_members', null),
  ('organization_features',null),
  ('invitations',          array['token_hash']),          -- niciodată în audit
  ('role_permissions',     null),
  ('employees',            array['avatar_path']),
  ('employee_sensitive_data', array['cnp_encrypted','iban_encrypted']), -- doar metadata
  ('departments',          null),
  ('attendance_entries',   null),
  ('leave_requests',       null)
) as s(t, x);
```

`tg_audit` este `SECURITY DEFINER` tocmai ca politica `audit_logs_no_insert` să rămână `false` pentru orice client: singurul scriitor este triggerul. `SET search_path = ''` protejează împotriva deturnării `to_jsonb`/`jsonb_each` printr-un schema injectat.

---

## 7. Storage — bucket-uri, convenție de path, politici

**Toate bucket-urile sunt private.** Livrarea către browser se face exclusiv prin signed URLs generate în Server Actions, după verificarea permisiunii.

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('branding',      'branding',      false,  2*1024*1024, array['image/png','image/jpeg','image/svg+xml','image/webp']),
  ('employee-docs', 'employee-docs', false, 25*1024*1024, array['application/pdf','image/png','image/jpeg']),
  ('fleet',         'fleet',         false, 25*1024*1024, array['application/pdf','image/png','image/jpeg']),
  ('ssm',           'ssm',           false, 25*1024*1024, array['application/pdf','image/png','image/jpeg']),
  ('maintenance',   'maintenance',   false, 25*1024*1024, array['application/pdf','image/png','image/jpeg']),
  ('inventory',     'inventory',     false, 25*1024*1024, array['application/pdf','image/png','image/jpeg']),
  ('announcements', 'announcements', false, 25*1024*1024, array['application/pdf','image/png','image/jpeg']),
  ('payroll',       'payroll',       false, 25*1024*1024, array['application/pdf']),
  ('exports',       'exports',       false, 100*1024*1024, array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv','application/pdf'])
on conflict (id) do nothing;
```

**Convenția de path (obligatorie):** `{organization_id}/{entitate}/{entity_id}/{uuid}-{nume_fisier}`
Exemplu: `9f1c…/employees/3ab2…/7de4…-contract-individual-munca.pdf`.
Primul segment este **întotdeauna** `organization_id` — el este ancora izolării. Al treilea segment (`entity_id`) permite scope-ul `own`.

```sql
create or replace function public.try_uuid(p text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin return p::uuid; exception when others then return null; end $$;

create or replace function public.storage_resource(p_bucket text)
returns text language sql immutable set search_path = '' as $$
  select case p_bucket
    when 'branding'      then 'branding'
    when 'employee-docs' then 'employees'
    when 'fleet'         then 'vehicles'
    when 'ssm'           then 'ssm'
    when 'maintenance'   then 'maintenance'
    when 'inventory'     then 'inventory'
    when 'announcements' then 'announcements'
    when 'payroll'       then 'payroll'
    when 'exports'       then 'employees'
  end $$;

-- verificarea unică folosită de toate cele 4 politici
create or replace function public.can_access_object(
  p_bucket text, p_name text, p_action text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_parts    text[] := string_to_array(p_name, '/');
  v_org      uuid   := public.try_uuid(v_parts[1]);
  v_entity_id uuid  := public.try_uuid(v_parts[3]);
  v_resource text   := public.storage_resource(p_bucket);
  v_scope    public.permission_scope;
  v_my_member uuid;
begin
  if v_org is null or v_resource is null or array_length(v_parts,1) < 4 then
    return false;                        -- path neconform => refuz
  end if;
  if not public.is_member_of(v_org) and not public.is_platform_admin() then
    return false;
  end if;

  v_scope := public.has_permission(v_org, v_resource, p_action);
  if v_scope = 'none' then return false; end if;
  if v_scope = 'all'  then return true;  end if;

  select m.id into v_my_member
    from public.organization_members m
   where m.organization_id = v_org and m.user_id = (select auth.uid())
     and m.is_active and m.deleted_at is null;

  if v_scope = 'own' then
    return v_entity_id is not null and exists (
      select 1 from public.employees e
       where e.id = v_entity_id and e.organization_id = v_org
         and e.member_id = v_my_member and e.deleted_at is null);
  end if;

  -- 'team'
  return v_entity_id is not null and exists (
    select 1 from public.employees e
     where e.id = v_entity_id and e.organization_id = v_org
       and e.member_id = any (public.team_member_ids(v_org))
       and e.deleted_at is null);
end $$;

grant execute on function public.can_access_object(text,text,text) to authenticated;
```

```sql
-- storage.objects are deja RLS activat de Supabase
create policy "obj_select_org_isolated" on storage.objects
for select to authenticated
using (public.can_access_object(bucket_id, name, 'read'));

create policy "obj_insert_org_isolated" on storage.objects
for insert to authenticated
with check (
  public.can_access_object(bucket_id, name, 'create')
  and owner_id = (select auth.uid())::text
);

create policy "obj_update_org_isolated" on storage.objects
for update to authenticated
using  (public.can_access_object(bucket_id, name, 'update'))
with check (public.can_access_object(bucket_id, name, 'update'));

create policy "obj_delete_org_isolated" on storage.objects
for delete to authenticated
using (public.can_access_object(bucket_id, name, 'delete'));
```

Note operaționale: migrarea trebuie rulată ca `postgres` (membru al `supabase_storage_admin`); nu se activează `FORCE ROW LEVEL SECURITY` pe `storage.objects`; ștergerea fișierelor de business urmează același principiu de soft delete — rândul de metadata din tabela aplicației primește `deleted_at`, obiectul fizic este mutat în `exports/…/trash/` de un job `pg_cron` doar după perioada de retenție.

---

## 8. Fluxul de acceptare a invitației (clientul NU trimite `organization_id`)

### Pașii

1. **Emitere.** `org_admin`/`hr` completează formularul (email + rol). Server Action derivă `organization_id` din `resolveTenant()` + apartenența verificată în `organization_members`; niciodată din body. Generează în Node `token = base64url(randomBytes(32))`, calculează `token_hash = sha256hex(token)` și inserează în `invitations` doar hash-ul. Politica `invitations_insert` re-validează dreptul și interzice escaladarea de rol.
2. **Email.** Resend trimite `https://app.administrativo.ro/invitatie/{token}`. Tokenul în clar există exclusiv în email. În modul test (`RESEND_MODE=test`) linkul se loghează server-side.
3. **Autentificare.** Pagina `/invitatie/[token]` este publică. Dacă nu există sesiune, utilizatorul primește OTP/magic link **pe adresa din invitație** (email-ul e afișat read-only, luat printr-un RPC public care întoarce doar `email` + `organization_name`, fără id-uri).
4. **Acceptare.** Clientul apelează Server Action `accepta invitatia(token)` — payload-ul conține **doar tokenul**. Server Action folosește clientul Supabase cu JWT-ul utilizatorului (RLS activ), nu `service_role`.
5. **Înrolare atomică.** Server Action execută `select public.accept_invitation($1)`. Funcția `SECURITY DEFINER` re-hashuiește tokenul, blochează rândul `FOR UPDATE`, validează expirare/revocare/reutilizare, **compară emailul invitației cu emailul din `auth.users` al apelantului**, verifică `seats_limit`, inserează în `organization_members`, marchează invitația consumată și scrie în audit. Totul într-o singură tranzacție.
6. **Post-condiții.** Server Action primește `{organization_id, role}`, setează cookie-ul `active_org` (httpOnly, sameSite=lax), apelează `revalidatePath('/')` și redirecționează în dashboard.
7. **Erori.** Codurile ridicate de funcție se mapează la mesaje în română: „Invitația nu mai este validă", „Invitația a expirat", „Adresa de email nu corespunde invitației", „Numărul de licențe al firmei a fost atins".
8. **Igienă.** Un job `pg_cron` zilnic marchează invitațiile expirate și șterge tokenurile consumate mai vechi de 90 de zile.

### Funcția

```sql
create table public.invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email           extensions.citext not null,
  role            public.app_role not null,
  token_hash      text not null unique,
  expires_at      timestamptz not null default now() + interval '7 days',
  accepted_at     timestamptz,
  accepted_by     uuid references auth.users(id),
  revoked_at      timestamptz,
  invited_by      uuid not null references auth.users(id) default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index invitations_pending_uniq
  on public.invitations (organization_id, email)
  where accepted_at is null and revoked_at is null;
```

```sql
create or replace function public.accept_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_email  text;
  v_inv    public.invitations%rowtype;
  v_seats  int;
  v_used   int;
  v_org_name text;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_token is null or length(p_token) < 32 then
    raise exception 'INVITATION_INVALID' using errcode = '22023';
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = v_uid;

  select * into v_inv
    from public.invitations i
   where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
   for update;

  if not found                          then raise exception 'INVITATION_INVALID'        using errcode='22023'; end if;
  if v_inv.revoked_at  is not null      then raise exception 'INVITATION_REVOKED'        using errcode='22023'; end if;
  if v_inv.accepted_at is not null      then raise exception 'INVITATION_ALREADY_USED'   using errcode='22023'; end if;
  if v_inv.expires_at <= now()          then raise exception 'INVITATION_EXPIRED'        using errcode='22023'; end if;
  if lower(v_inv.email::text) <> v_email then raise exception 'INVITATION_EMAIL_MISMATCH' using errcode='22023'; end if;
  if v_inv.role = 'super_admin'         then raise exception 'INVITATION_INVALID'        using errcode='22023'; end if;

  select o.seats_limit, o.name into v_seats, v_org_name
    from public.organizations o
   where o.id = v_inv.organization_id and o.deleted_at is null
   for update;
  if not found then raise exception 'ORGANIZATION_NOT_FOUND' using errcode='22023'; end if;

  select count(*) into v_used
    from public.organization_members m
   where m.organization_id = v_inv.organization_id
     and m.user_id <> v_uid
     and m.is_active and m.deleted_at is null;

  if v_seats is not null and v_used >= v_seats then
    raise exception 'SEATS_LIMIT_REACHED' using errcode='22023';
  end if;

  insert into public.organization_members
    (organization_id, user_id, role, is_active, invited_by, joined_at)
  values
    (v_inv.organization_id, v_uid, v_inv.role, true, v_inv.invited_by, now())
  on conflict (organization_id, user_id) where deleted_at is null
  do update set role       = excluded.role,
                is_active  = true,
                deleted_at = null,
                updated_at = now();

  update public.invitations
     set accepted_at = now(), accepted_by = v_uid, updated_at = now()
   where id = v_inv.id;

  insert into public.audit_logs
    (organization_id, actor_id, actor_email, actor_role, action,
     table_schema, table_name, record_id, changed_columns, after_data)
  values
    (v_inv.organization_id, v_uid, v_email, v_inv.role, 'INSERT',
     'public', 'organization_members', v_inv.id::text, array['role','is_active'],
     jsonb_build_object('source','invitation','role', v_inv.role, 'invitation_id', v_inv.id));

  return jsonb_build_object(
    'organization_id',   v_inv.organization_id,
    'organization_name', v_org_name,
    'role',              v_inv.role);
end $$;

revoke execute on function public.accept_invitation(text) from public, anon;
grant   execute on function public.accept_invitation(text) to authenticated;

-- RPC public minimal pentru ecranul de pre-acceptare (nu expune id-uri)
create or replace function public.peek_invitation(p_token text)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
           'email', i.email::text,
           'organization_name', o.name,
           'expired', i.expires_at <= now() or i.revoked_at is not null or i.accepted_at is not null)
    from public.invitations i
    join public.organizations o on o.id = i.organization_id
   where i.token_hash = encode(extensions.digest(p_token,'sha256'),'hex')
   limit 1;
$$;
grant execute on function public.peek_invitation(text) to anon, authenticated;
```

**Invarianții flux:** clientul nu cunoaște niciodată `organization_id` înainte de înrolare; tokenul în clar nu ajunge niciodată în baza de date; `FOR UPDATE` pe invitație și pe organizație serializează acceptările concurente, deci `seats_limit` nu poate fi depășit prin race; `on conflict … do update` face operația idempotentă la re-trimiterea aceleiași cereri; `super_admin` nu se poate obține niciodată prin invitație.