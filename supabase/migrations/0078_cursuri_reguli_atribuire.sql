-- supabase/migrations/0078_cursuri_reguli_atribuire.sql
-- Atribuirea automată: „oricine e în departamentul X primește cursul Y".
--
-- ── DE CE ABIA ACUM, ȘI DE CE ATÂT DE PUȚIN ─────────────────────────────
-- La opt angajați, un `Combobox` cu bifare face aproape același lucru, iar
-- ecranul de atribuire manuală rămâne. Regula devine utilă exact într-un caz,
-- dar acela contează: ANGAJATUL NOU. Fără ea, cineva trebuie să-și amintească
-- să-i dea instructajul; cu ea, îl are în prima zi.
--
-- Un singur criteriu pe rând, ales dintr-un enum, nu un motor de reguli cu
-- operatori și paranteze. Cinci ramuri disjuncte, verificabile dintr-o privire.
-- Combinațiile se fac adăugând reguli, nu compunând expresii.
--
-- ── APLICAREA E IDEMPOTENTĂ PRIN CHEIA UNICĂ ────────────────────────────
-- `course_enrollments_ciclu_uk` face a doua rulare inofensivă: `on conflict do
-- nothing`. Nu ținem „ultima rulare" nicăieri — o stare în plus care s-ar putea
-- desincroniza de realitate.

begin;

create type public.curs_criteriu as enum ('toti', 'departament', 'functie', 'rol', 'angajat');

create table public.course_assignment_rules (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  course_id         uuid not null,
  criteriu          public.curs_criteriu not null,
  department_id     uuid,
  job_position_id   uuid,
  rol               public.app_role,
  employee_id       uuid,
  -- Câte zile după angajare se atribuie. 0 = imediat. Eșalonarea unui parcurs
  -- de integrare se obține din asta, nu dintr-un obiect „cale de învățare" cu
  -- ecrane și stare proprie.
  decalaj_zile      smallint not null default 0 check (decalaj_zile between 0 and 365),
  termen_zile       smallint check (termen_zile is null or termen_zile between 1 and 365),
  activ             boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users (id) on delete set null,
  updated_by        uuid references auth.users (id) on delete set null,
  deleted_at        timestamptz,
  unique (id, organization_id),
  foreign key (course_id, organization_id)
    references public.courses (id, organization_id) on delete cascade,
  foreign key (department_id, organization_id)
    references public.departments (id, organization_id) on delete cascade,
  foreign key (employee_id, organization_id)
    references public.employees (id, organization_id) on delete cascade,
  -- EXACT una dintre țintele posibile, potrivită criteriului. Fără CHECK, o
  -- regulă „departament" cu `department_id` gol ar prinde toată firma — tăcut.
  constraint course_assignment_rules_criteriu_ck check (
       (criteriu = 'toti'        and department_id is null and job_position_id is null and rol is null and employee_id is null)
    or (criteriu = 'departament' and department_id is not null and job_position_id is null and rol is null and employee_id is null)
    or (criteriu = 'functie'     and job_position_id is not null and department_id is null and rol is null and employee_id is null)
    or (criteriu = 'rol'         and rol is not null and department_id is null and job_position_id is null and employee_id is null)
    or (criteriu = 'angajat'     and employee_id is not null and department_id is null and job_position_id is null and rol is null)
  )
);

comment on table public.course_assignment_rules is
  'Cine primește automat un curs. Un criteriu pe regulă; combinațiile se fac adăugând reguli, nu compunând expresii.';

-- `job_positions` nu are cheie compusă cu organizația, deci FK-ul rămâne simplu.
-- Ancorarea pe tenant o face politica plus faptul că lista de opțiuni din ecran
-- e citită sub RLS: o funcție a altei firme nu poate ajunge în selector.
create index course_assignment_rules_curs_idx
  on public.course_assignment_rules (organization_id, course_id) where deleted_at is null;
create index course_assignment_rules_activ_idx
  on public.course_assignment_rules (organization_id, activ) where deleted_at is null;
create index course_assignment_rules_created_by_idx on public.course_assignment_rules (created_by);
create index course_assignment_rules_updated_by_idx on public.course_assignment_rules (updated_by);

create trigger trg_course_assignment_rules_10_atinge
  before update on public.course_assignment_rules
  for each row execute function internal.cursuri_atinge();

---------------------------------------------------------------------------
-- Aplicarea
---------------------------------------------------------------------------
-- `security definer`: înrolează oameni pe care cel care a scris regula poate
-- nici nu-i vede (un manager cu scope `team`). Regula e o decizie a firmei, nu
-- a persoanei care o tastează.
--
-- Nu ridică excepție pe curs nepublicat sau fără lecții: sare peste el. O
-- regulă stricată n-are voie să oprească aplicarea celorlalte.

create or replace function internal.cursuri_aplica_regulile(p_org uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_regula record;
  v_facute integer := 0;
begin
  for v_regula in
    select r.*, c.termen_zile as termen_curs
    from public.course_assignment_rules r
    join public.courses c
      on c.id = r.course_id and c.deleted_at is null and c.publicat and c.activ
    where r.deleted_at is null
      and r.activ
      and (p_org is null or r.organization_id = p_org)
      and app.feature_on(r.organization_id, 'courses')
      and exists (
        select 1 from public.course_items ci
        where ci.course_id = r.course_id and ci.deleted_at is null
      )
  loop
    begin
      insert into public.course_enrollments (
        organization_id, course_id, employee_id, motiv, termen
      )
      select
        v_regula.organization_id,
        v_regula.course_id,
        e.id,
        'regula'::public.curs_motiv,
        current_date + coalesce(v_regula.termen_zile, v_regula.termen_curs)::integer
      from public.employees e
      where e.organization_id = v_regula.organization_id
        and e.deleted_at is null
        and e.status in ('activ', 'suspendat', 'preaviz')
        -- Decalajul se numără de la angajare. O fișă fără dată de angajare
        -- intră imediat: altfel n-ar intra niciodată, tăcut.
        and (v_regula.decalaj_zile = 0
             or e.hired_on is null
             or e.hired_on + v_regula.decalaj_zile::integer <= current_date)
        and (
          v_regula.criteriu = 'toti'
          or (v_regula.criteriu = 'departament' and e.department_id = v_regula.department_id)
          or (v_regula.criteriu = 'functie' and e.job_position_id = v_regula.job_position_id)
          or (v_regula.criteriu = 'angajat' and e.id = v_regula.employee_id)
          or (v_regula.criteriu = 'rol' and exists (
                select 1 from public.organization_members m
                where m.organization_id = v_regula.organization_id
                  and m.user_id = e.user_id
                  and m.role = v_regula.rol
                  and m.status = 'active'
                  and m.deleted_at is null))
        )
        -- Cine are deja cursul deschis sau parcurs nu se re-înrolează.
        -- Recertificarea deschide ciclul următor pe alt drum (0075).
        and not exists (
          select 1 from public.course_enrollments ex
          where ex.organization_id = v_regula.organization_id
            and ex.course_id = v_regula.course_id
            and ex.employee_id = e.id
            and ex.deleted_at is null
            and ex.status in ('neinceput', 'in_curs', 'finalizat')
        );

      get diagnostics v_facute = row_count;
    exception
      when others then null;
    end;
  end loop;
  return v_facute;
end;
$$;

revoke all on function internal.cursuri_aplica_regulile(uuid) from public, anon, authenticated;

---------------------------------------------------------------------------
-- RLS
---------------------------------------------------------------------------

alter table public.course_assignment_rules enable row level security;
alter table public.course_assignment_rules force  row level security;

create policy course_assignment_rules_select on public.course_assignment_rules for select to authenticated
using (
  app.is_platform_admin()
  or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'courses')
    and app.can(organization_id, 'courses', 'read', 'team')
  )
);

-- Aici pragul `team` chiar se ÎNGUSTEAZĂ, spre deosebire de tabelele de
-- catalog: o regulă pe o persoană anume trebuie să fie o persoană din echipa
-- managerului. Regulile largi rămân ale celor cu `all`.
create policy course_assignment_rules_insert on public.course_assignment_rules for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'courses')
  and (
    app.has_permission(organization_id, 'courses', 'create') = 'all'
    or (app.can(organization_id, 'courses', 'create', 'team')
        and criteriu = 'angajat'
        and app.is_manager_of(organization_id, employee_id))
  )
  and deleted_at is null
);

create policy course_assignment_rules_update on public.course_assignment_rules for update to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'courses')
  and (
    app.has_permission(organization_id, 'courses', 'update') = 'all'
    or (app.can(organization_id, 'courses', 'update', 'team')
        and criteriu = 'angajat'
        and app.is_manager_of(organization_id, employee_id))
  )
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'courses')
  and (
    app.has_permission(organization_id, 'courses', 'update') = 'all'
    or (app.can(organization_id, 'courses', 'update', 'team')
        and criteriu = 'angajat'
        and app.is_manager_of(organization_id, employee_id))
  )
);

revoke all on public.course_assignment_rules from anon, authenticated;
grant select, insert, update on public.course_assignment_rules to authenticated;

do $$
begin
  execute 'create trigger trg_course_assignment_rules_00_actor before insert or update on public.course_assignment_rules for each row execute function internal.set_actor()';
  perform internal.attach_audit('course_assignment_rules');
end;
$$;

---------------------------------------------------------------------------
-- Jobul zilnic
---------------------------------------------------------------------------
do $do$
begin
  if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema cron;
    perform cron.schedule(
      'cursuri-aplica-reguli',
      '15 4 * * *',
      $job$select internal.cursuri_aplica_regulile();$job$
    );
  else
    raise warning 'pg_cron nu este disponibil (Postgres gol / CI). Jobul „cursuri-aplica-reguli" nu a fost programat.';
  end if;
end
$do$;

commit;
