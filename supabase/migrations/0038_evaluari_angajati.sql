-- supabase/migrations/0038_evaluari_angajati.sql
-- Etapa 5 din foaia de parcurs „Momentul înrolării unui angajat": evaluări
-- de angajați — scop complet nou, nicio tabelă/RLS existentă de reutilizat.
-- Reutilizează totuși predicatele deja construite pentru „cine vede/scrie un
-- angajat" (app.can_see_employee / app.can_write_employee, 0005_hr_rls.sql) —
-- un manager direct vede și scrie evaluările subordonaților lui exact cum
-- vede și scrie fișa lor, fără o resursă de permisiuni nouă.

begin;

create type public.evaluation_status as enum ('draft', 'finalizat');

-- ============================================================
-- ȘABLOANE DE EVALUARE
-- ============================================================

create table public.evaluation_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,  -- NULL = șablon platformă
  denumire text not null,
  descriere text,
  -- [{ "cod": "calitate_munca", "denumire": "Calitatea muncii", "scala_max": 5 }, ...]
  criterii jsonb not null default '[]'::jsonb,
  activ boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint evaluation_templates_denumire_len check (char_length(denumire) between 2 and 160)
);

create unique index evaluation_templates_platform_uniq
  on public.evaluation_templates (lower(denumire))
  where organization_id is null and deleted_at is null;
create index evaluation_templates_org_idx
  on public.evaluation_templates (organization_id) where deleted_at is null;

grant select, insert, update on public.evaluation_templates to authenticated;

create trigger set_actor_evaluation_templates before insert or update on public.evaluation_templates
  for each row execute function internal.set_actor();
create trigger set_updated_at_evaluation_templates before update on public.evaluation_templates
  for each row execute function app.set_updated_at();

alter table public.evaluation_templates enable row level security;
alter table public.evaluation_templates force row level security;

create policy evaluation_templates_select on public.evaluation_templates
  for select to authenticated
  using (
    deleted_at is null
    and (
      organization_id is null
      or (
        organization_id = any ((select app.current_org_ids())::uuid[])
        and app.has_permission(organization_id, 'employees', 'read') <> 'none'
      )
    )
  );

-- Un manager (scope „team" pe employees:update) poate crea propriile
-- șabloane, nu doar super-user-ul — cerință explicită a utilizatorului.
create policy evaluation_templates_insert on public.evaluation_templates
  for insert to authenticated
  with check (
    organization_id is not null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'employees', 'update') in ('all', 'team')
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy evaluation_templates_update on public.evaluation_templates
  for update to authenticated
  using (
    organization_id is not null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'employees', 'update') in ('all', 'team')
    and deleted_at is null
  )
  with check (
    organization_id is not null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'employees', 'update') in ('all', 'team')
    and updated_by = (select auth.uid())
  );

-- ============================================================
-- EVALUĂRI
-- ============================================================

create table public.employee_evaluations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  template_id uuid not null references public.evaluation_templates (id) on delete restrict,
  evaluator_id uuid references auth.users (id) on delete set null,
  data_evaluarii date not null,
  -- [{ "criteriu_cod": "calitate_munca", "scor": 4, "comentariu": "..." }, ...]
  raspunsuri jsonb not null default '[]'::jsonb,
  concluzie text,
  status public.evaluation_status not null default 'draft',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint employee_evaluations_concluzie_len check (char_length(concluzie) <= 4000)
);

create index employee_evaluations_employee_idx
  on public.employee_evaluations (employee_id, data_evaluarii desc)
  where deleted_at is null;

grant select, insert, update on public.employee_evaluations to authenticated;

create trigger set_actor_employee_evaluations before insert or update on public.employee_evaluations
  for each row execute function internal.set_actor();
create trigger set_updated_at_employee_evaluations before update on public.employee_evaluations
  for each row execute function app.set_updated_at();

alter table public.employee_evaluations enable row level security;
alter table public.employee_evaluations force row level security;

create policy employee_evaluations_select on public.employee_evaluations
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and app.can_see_employee(organization_id, employee_id)
  );

create policy employee_evaluations_insert on public.employee_evaluations
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can_write_employee(organization_id, employee_id, 'update')
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy employee_evaluations_update on public.employee_evaluations
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and app.can_write_employee(organization_id, employee_id, 'update')
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can_write_employee(organization_id, employee_id, 'update')
    and updated_by = (select auth.uid())
  );

-- ── Șablon platformă implicit ────────────────────────────────────────────────

insert into public.evaluation_templates (organization_id, denumire, descriere, criterii)
values (
  null,
  'Evaluare anuală standard',
  'Șablon generic — calitatea muncii, punctualitate, lucru în echipă, inițiativă.',
  '[
    {"cod": "calitate_munca", "denumire": "Calitatea muncii", "scala_max": 5},
    {"cod": "punctualitate", "denumire": "Punctualitate și disciplină", "scala_max": 5},
    {"cod": "lucru_echipa", "denumire": "Lucru în echipă", "scala_max": 5},
    {"cod": "initiativa", "denumire": "Inițiativă și implicare", "scala_max": 5}
  ]'::jsonb
)
on conflict do nothing;

commit;
