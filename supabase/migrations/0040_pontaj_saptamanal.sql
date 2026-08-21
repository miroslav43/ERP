-- supabase/migrations/0040_pontaj_saptamanal.sql
-- Plan săptămânal de pontaj: angajatul declară, pentru săptămâna următoare,
-- modul de prezență (birou/homeoffice/deplasare/delegație) și orele
-- planificate pe zi; managerul direct SAU cineva cu drept de aprobare pe
-- toată organizația (patronul) aprobă/respinge dintr-o singură decizie, pe
-- toată săptămâna. NU atinge `attendance_entries`/`attendance_periods` —
-- planul e o notificare/înțelegere prealabilă, nu înlocuiește pontajul
-- efectiv (zilele reale, cu ore lucrate/suplimentare, rămân în
-- `attendance_entries`, needatinse de acest fișier).
--
-- Motorul generic de aprobare (`approval_flows`/`approval_steps`/
-- `approval_tasks`, 0009_leave.sql) e reutilizat ca structură, dar
-- `internal.rezolva_aprobatori` (0017_fix_concedii.sql) verifică LITERAL
-- `leave:approve` — nu poate fi refolosită direct pentru pontaj fără cod nou,
-- contrar premisei inițiale. Soluția aleasă: o funcție PARALELĂ, mai simplă
-- (fără escaladarea pe trepte multiple de la concedii — un singur pas,
-- manager direct ∪ oricine cu `attendance:approve = 'all'`), care NU
-- modifică nimic din `internal.rezolva_aprobatori` sau din tabelele pe care
-- o altă sesiune le are în lucru (`0035_reguli_concediu.sql`, neaplicată încă).

---------------------------------------------------------------------------
-- 1. Tipuri
---------------------------------------------------------------------------

create type public.attendance_presence_kind as enum ('birou', 'homeoffice', 'deplasare', 'delegatie');

create type public.attendance_week_status as enum ('ciorna', 'trimisa', 'aprobata', 'respinsa');

---------------------------------------------------------------------------
-- 2. attendance_week_submissions — o săptămână per angajat, aprobată/respinsă
--    dintr-o singură decizie (nu zi cu zi).
---------------------------------------------------------------------------

create table public.attendance_week_submissions (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  employee_id       uuid not null references public.employees (id) on delete restrict,
  saptamana_start   date not null,
  status            public.attendance_week_status not null default 'ciorna',
  trimisa_la        timestamptz,
  decis_de          uuid references auth.users (id),
  decis_la          timestamptz,
  motiv_respingere  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid,
  updated_by        uuid,
  deleted_at        timestamptz,
  constraint attendance_week_submissions_luni_ck check (extract(isodow from saptamana_start) = 1),
  constraint attendance_week_submissions_respingere_ck check (
    status <> 'respinsa' or (motiv_respingere is not null and length(trim(motiv_respingere)) >= 5)
  )
);

create unique index attendance_week_submissions_uq
  on public.attendance_week_submissions (organization_id, employee_id, saptamana_start) where deleted_at is null;
create index attendance_week_submissions_angajat_idx
  on public.attendance_week_submissions (organization_id, employee_id) where deleted_at is null;

comment on table public.attendance_week_submissions is
  'Planul de prezență al unei săptămâni viitoare, trimis de angajat și aprobat/respins ca un singur bloc de managerul direct sau de patron.';

---------------------------------------------------------------------------
-- 3. attendance_week_submission_days — zilele planului, cu prezența și orele.
--    Scrise EXCLUSIV prin `public.trimite_saptamana_pontaj` (security definer,
--    mai jos) — la fel ca `leave_request_days`, nicio politică de scriere
--    pentru `authenticated` pe tabela asta, doar SELECT.
---------------------------------------------------------------------------

create table public.attendance_week_submission_days (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  submission_id     uuid not null references public.attendance_week_submissions (id) on delete cascade,
  data              date not null,
  tip_prezenta      public.attendance_presence_kind not null default 'birou',
  ore_planificate   numeric(5, 2) not null default 8 check (ore_planificate between 0 and 24),
  observatii        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index attendance_week_submission_days_uq
  on public.attendance_week_submission_days (submission_id, data);
create index attendance_week_submission_days_org_idx
  on public.attendance_week_submission_days (organization_id, submission_id);

---------------------------------------------------------------------------
-- 4. internal.rezolva_aprobator_pontaj — candidați pentru aprobarea unei
--    săptămâni: managerul direct ∪ oricine cu `attendance:approve = 'all'`.
--    Structural, aceeași gardă ca `internal.rezolva_aprobatori` (membru activ,
--    fără auto-aprobare pe persoană) — dar UN SINGUR nivel, fără escaladare
--    pe trepte, și verifică `attendance`, nu `leave`.
---------------------------------------------------------------------------

create or replace function internal.rezolva_aprobator_pontaj(
  p_org uuid,
  p_employee uuid
) returns table (user_id uuid, employee_id uuid, sursa text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subiect public.employees%rowtype;
begin
  select * into v_subiect
    from public.employees e
   where e.id = p_employee and e.organization_id = p_org and e.deleted_at is null;
  if not found then
    return;
  end if;

  return query
  with membri as (
    select m.user_id, m.role
      from public.organization_members m
     where m.organization_id = p_org and m.deleted_at is null and m.status = 'active'
  ),
  fise as (
    select m.user_id, e.id as employee_id
      from membri m
      join public.employees e
        on e.organization_id = p_org and e.user_id = m.user_id
       and e.is_primary and e.deleted_at is null
  ),
  scope_pontaj as (
    select distinct on (m.user_id) m.user_id, rp.scope
      from membri m
      join public.role_permissions rp
        on rp.role = m.role and rp.deleted_at is null
       and rp.resource = 'attendance' and rp.action = 'approve'
       and (rp.organization_id = p_org or rp.organization_id is null)
     order by m.user_id, (rp.organization_id is null) asc
  ),
  candidati_bruti as (
    -- managerul direct, dacă are cont legat de organizație
    select m_emp.user_id, m_emp.id as employee_id, 'manager_direct'::text as sursa
      from public.employees m_emp
     where v_subiect.manager_employee_id is not null
       and m_emp.id = v_subiect.manager_employee_id
       and m_emp.deleted_at is null
       and m_emp.user_id is not null

    union all

    -- oricine cu `attendance:approve = 'all'` (patron/HR) — a doua cale, mereu inclusă
    select sp.user_id, f.employee_id, 'toata_organizatia'::text
      from scope_pontaj sp
      left join fise f on f.user_id = sp.user_id
     where sp.scope = 'all'
  )
  select distinct cb.user_id, coalesce(cb.employee_id, f.employee_id) as employee_id, cb.sursa
    from candidati_bruti cb
    join membri m on m.user_id = cb.user_id
    left join fise f on f.user_id = cb.user_id
    left join scope_pontaj sp on sp.user_id = cb.user_id
   where cb.user_id is distinct from v_subiect.user_id
     and (
       sp.scope = 'all'
       or (sp.scope = 'team' and f.employee_id is not null
           and v_subiect.manager_path @> array[f.employee_id])
     );
end;
$$;

revoke all on function internal.rezolva_aprobator_pontaj(uuid, uuid) from public, anon, authenticated;

comment on function internal.rezolva_aprobator_pontaj(uuid, uuid) is
  'Candidații pentru aprobarea unei săptămâni de pontaj: managerul direct + oricine cu attendance:approve=all, filtrați prin scope real (team cu subiectul în subarbore, sau all). Variantă simplificată, cu un singur pas, a internal.rezolva_aprobatori — nu o modifică, nu o apelează.';

---------------------------------------------------------------------------
-- 5. Sarcinile de aprobare — create la trimitere, auto-aprobare dacă nimeni
--    nu poate decide (firmă cu un singur om, ca la concedii §C6/0017).
---------------------------------------------------------------------------

create or replace function internal.attendance_week_submissions_trimite()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_flow_id uuid;
  v_step_id uuid;
  v_n_cand integer;
begin
  if new.status = 'trimisa' and (tg_op = 'INSERT' or old.status is distinct from 'trimisa') then
    select s.id, s.flow_id into v_step_id, v_flow_id
      from public.approval_flows f
      join public.approval_steps s on s.flow_id = f.id and s.deleted_at is null
     where f.organization_id = new.organization_id and f.entity_type = 'attendance_week_submission'
       and f.activ and f.deleted_at is null
     order by s.ordine
     limit 1;

    if v_step_id is null then
      raise exception 'Fluxul de aprobare a pontajului săptămânal nu este configurat pentru această organizație.'
        using errcode = 'P0001';
    end if;

    with inseratii as (
      insert into public.approval_tasks
        (organization_id, flow_id, step_id, entity_type, entity_id, ordine,
         approver_user_id, approver_employee_id)
      select new.organization_id, v_flow_id, v_step_id, 'attendance_week_submission', new.id, 1,
             c.user_id, c.employee_id
        from internal.rezolva_aprobator_pontaj(new.organization_id, new.employee_id) c
      returning 1
    )
    select count(*) into v_n_cand from inseratii;

    if v_n_cand = 0 then
      -- Nimeni nu poate aproba — auto-aprobat, cu urmă explicită în audit,
      -- exact ca la concedii (0017, „pas fără destinatar”).
      update public.attendance_week_submissions
         set status = 'aprobata', decis_la = now()
       where id = new.id;
      perform app.write_audit('update', new.organization_id, 'attendance_week_submissions', new.id, null,
        jsonb_build_object('eveniment', 'pas_fara_destinatar', 'auto_aprobat', true));
    end if;
  end if;
  return null;
end;
$$;

revoke all on function internal.attendance_week_submissions_trimite() from public, anon, authenticated;

create trigger trg_attendance_week_submissions_trimite
  after insert or update on public.attendance_week_submissions
  for each row execute function internal.attendance_week_submissions_trimite();

---------------------------------------------------------------------------
-- 6. public.trimite_saptamana_pontaj — singurul drum de scriere pentru
--    angajat: upsert pe săptămână + regenerarea zilelor (delete + insert,
--    exact tiparul din `internal.leave_requests_sincronizeaza`).
---------------------------------------------------------------------------

create or replace function public.trimite_saptamana_pontaj(
  p_organization_id uuid,
  p_saptamana_start date,
  p_status public.attendance_week_status,
  p_zile jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee_id   uuid;
  v_submission_id uuid;
  v_zi            jsonb;
begin
  if p_status not in ('ciorna', 'trimisa') then
    raise exception 'Statusul trimis nu este permis la salvare.' using errcode = '22023';
  end if;
  if extract(isodow from p_saptamana_start) <> 1 then
    raise exception 'Săptămâna trebuie să înceapă luni.' using errcode = '22023';
  end if;
  if not app.feature_on(p_organization_id, 'attendance') then
    raise exception 'Modulul de pontaj nu este activ pentru această organizație.' using errcode = 'P0001';
  end if;

  v_employee_id := app.current_employee_id(p_organization_id);
  if v_employee_id is null then
    raise exception 'Contul dvs. nu este legat de o fișă de angajat principală în această organizație.'
      using errcode = 'P0001';
  end if;
  if not app.poate_scrie_pontaj(p_organization_id, v_employee_id) then
    raise exception 'Nu aveți dreptul de a completa pontajul.' using errcode = '42501';
  end if;

  insert into public.attendance_week_submissions
    (organization_id, employee_id, saptamana_start, status, trimisa_la)
  values (
    p_organization_id, v_employee_id, p_saptamana_start, p_status,
    case when p_status = 'trimisa' then now() else null end
  )
  on conflict (organization_id, employee_id, saptamana_start) where deleted_at is null
  do update set
    status = excluded.status,
    trimisa_la = excluded.trimisa_la,
    decis_de = null,
    decis_la = null,
    motiv_respingere = null,
    updated_at = now()
  where public.attendance_week_submissions.status in ('ciorna', 'trimisa', 'respinsa')
  returning id into v_submission_id;

  if v_submission_id is null then
    raise exception 'Săptămâna a fost deja aprobată și nu mai poate fi modificată.' using errcode = 'P0001';
  end if;

  delete from public.attendance_week_submission_days where submission_id = v_submission_id;

  for v_zi in select * from jsonb_array_elements(coalesce(p_zile, '[]'::jsonb))
  loop
    insert into public.attendance_week_submission_days
      (organization_id, submission_id, data, tip_prezenta, ore_planificate, observatii)
    values (
      p_organization_id,
      v_submission_id,
      (v_zi ->> 'data')::date,
      (v_zi ->> 'tip_prezenta')::public.attendance_presence_kind,
      coalesce((v_zi ->> 'ore_planificate')::numeric, 8),
      nullif(v_zi ->> 'observatii', '')
    );
  end loop;

  return v_submission_id;
end;
$$;

revoke all on function public.trimite_saptamana_pontaj(uuid, date, public.attendance_week_status, jsonb) from public, anon;
grant execute on function public.trimite_saptamana_pontaj(uuid, date, public.attendance_week_status, jsonb) to authenticated;

comment on function public.trimite_saptamana_pontaj(uuid, date, public.attendance_week_status, jsonb) is
  'Singurul drum de scriere pentru angajat pe planul săptămânal — validează, apoi upsert + regenerare completă a zilelor. p_zile: [{"data":"2026-03-09","tip_prezenta":"birou","ore_planificate":8,"observatii":null}, ...].';

---------------------------------------------------------------------------
-- 7. Seed per organizație — flux de aprobare codat, complet SEPARAT de
--    `internal.seed_leave_defaults` (nu se atinge acea funcție).
---------------------------------------------------------------------------

create or replace function internal.seed_attendance_approval_defaults(p_organization_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_flow uuid;
begin
  insert into public.approval_flows (organization_id, entity_type, denumire)
  values (p_organization_id, 'attendance_week_submission', 'Aprobare plan săptămânal de pontaj')
  on conflict do nothing;

  select id into v_flow from public.approval_flows
   where organization_id = p_organization_id and entity_type = 'attendance_week_submission'
     and activ and deleted_at is null;

  if v_flow is not null then
    insert into public.approval_steps (organization_id, flow_id, ordine, tip, optional, sla_ore)
    values (p_organization_id, v_flow, 1, 'manager_direct', false, 72)
    on conflict do nothing;
  end if;
end; $$;

create or replace function internal.organizations_seed_attendance_approval()
returns trigger language plpgsql security definer set search_path = '' as $$
begin perform internal.seed_attendance_approval_defaults(new.id); return null; end; $$;

create trigger trg_organizations_seed_attendance_approval
  after insert on public.organizations
  for each row execute function internal.organizations_seed_attendance_approval();

do $$
declare o record;
begin
  for o in select id from public.organizations loop
    perform internal.seed_attendance_approval_defaults(o.id);
  end loop;
end $$;

---------------------------------------------------------------------------
-- 8. RLS
---------------------------------------------------------------------------

alter table public.attendance_week_submissions enable row level security;
alter table public.attendance_week_submissions force row level security;
alter table public.attendance_week_submission_days enable row level security;
alter table public.attendance_week_submission_days force row level security;

create policy attendance_week_submissions_select on public.attendance_week_submissions for select to authenticated
using (
  app.is_platform_admin()
  or (organization_id = any ((select app.current_org_ids())::uuid[])
      and app.feature_on(organization_id, 'attendance')
      and (
        employee_id = app.current_employee_id(organization_id)
        or app.is_manager_of(organization_id, employee_id)
        or app.can(organization_id, 'attendance', 'approve', 'all')
        or exists (
          select 1 from public.approval_tasks t
           where t.entity_type = 'attendance_week_submission'
             and t.entity_id = public.attendance_week_submissions.id
             and t.approver_user_id = (select auth.uid()) and t.deleted_at is null
        )
      ))
);

-- Fără politică de INSERT: singurul drum e `trimite_saptamana_pontaj`
-- (security definer, rulează ca proprietarul tabelei).
create policy attendance_week_submissions_update on public.attendance_week_submissions for update to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'attendance')
  and status = 'trimisa'
  and (app.is_manager_of(organization_id, employee_id) or app.can(organization_id, 'attendance', 'approve', 'all'))
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and status in ('aprobata', 'respinsa')
);

create policy attendance_week_submission_days_select on public.attendance_week_submission_days for select to authenticated
using (
  app.is_platform_admin()
  or (organization_id = any ((select app.current_org_ids())::uuid[])
      and exists (
        select 1 from public.attendance_week_submissions s
         where s.id = submission_id
           and (
             s.employee_id = app.current_employee_id(s.organization_id)
             or app.is_manager_of(s.organization_id, s.employee_id)
             or app.can(s.organization_id, 'attendance', 'approve', 'all')
             or exists (
               select 1 from public.approval_tasks t
                where t.entity_type = 'attendance_week_submission' and t.entity_id = s.id
                  and t.approver_user_id = (select auth.uid()) and t.deleted_at is null
             )
           )
      ))
);

---------------------------------------------------------------------------
-- 9. Actor, audit, drepturi
---------------------------------------------------------------------------

create trigger trg_attendance_week_submissions_actor before insert or update on public.attendance_week_submissions
  for each row execute function internal.set_actor();
create trigger trg_attendance_week_submissions_updated before insert or update on public.attendance_week_submissions
  for each row execute function internal.pontaj_marcheaza_actualizarea();
select internal.attach_audit('attendance_week_submissions');

revoke all on table public.attendance_week_submissions from public, anon;
grant select, update on table public.attendance_week_submissions to authenticated;
revoke insert, delete on table public.attendance_week_submissions from authenticated;

revoke all on table public.attendance_week_submission_days from public, anon;
grant select on table public.attendance_week_submission_days to authenticated;
revoke insert, update, delete on table public.attendance_week_submission_days from authenticated;
