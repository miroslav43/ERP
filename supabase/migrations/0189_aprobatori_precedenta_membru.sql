-- supabase/migrations/0189_aprobatori_precedenta_membru.sql
--
-- APROBATORII RESPECTĂ SUPRASCRIEREA PE MEMBRU (0063).
--
-- ── DEFECTUL ────────────────────────────────────────────────────────────────
-- 0063 a adus rândurile de permisiune PER MEMBRU în `role_permissions`
-- (`member_id`), cu precedență peste rândul rolului: `app.has_permission` le
-- citește pentru cel conectat. Dar rezolvarea APROBATORILOR — cine primește
-- sarcina și notificarea pentru o cerere de concediu sau pentru o săptămână de
-- pontaj — a rămas pe join-ul din 0017/0041: `rp.role = m.role`, fără
-- `member_id`. Un manager căruia i s-a luat `leave:approve` printr-un rând de
-- membru (`scope = none`) primea în continuare sarcina și notificarea; un
-- membru căruia i s-a dat `all` nu le primea (analiza 2026-10-08,
-- notificari-O7). Rândurile per membru au și ele coloana `role`, deci
-- suprascrierea unui singur om se aplica, din greșeală, întregului rol.
--
-- ── CE FACE ─────────────────────────────────────────────────────────────────
-- `internal.scope_membru(org, user, resurse, acțiune)` — aceeași precedență ca
-- `app.has_permission` (membru > organizație > global, inclusiv `none` ca refuz
-- explicit), dar pentru un utilizator DAT, nu pentru cel conectat. Cele patru
-- funcții care rezolvau aprobatorii prin join sunt redefinite cu corpul lor
-- din ultima migrare care le-a scris (0017, 0041, 0112, 0079), schimbând DOAR
-- blocul de scope: `rezolva_aprobatori`, `rezolva_aprobator_pontaj`,
-- `leave_requests_sincronizeaza` (escaladarea la `all`) și
-- `leave_requests_notifica_anularea`.
--
-- Forward-only: nu atinge nicio migrare aplicată. Proba pe banc:
-- `tests/rls/proba-aprobatori-membru.sql`.

begin;

create or replace function internal.scope_membru(
  p_org uuid,
  p_user uuid,
  p_resource text,
  p_action text
)
returns public.permission_scope
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      with m as (
        select o.id, o.role
          from public.organization_members o
         where o.organization_id = p_org
           and o.user_id = p_user
           and o.deleted_at is null
           and o.status = 'active'
         limit 1
      )
      select rp.scope
        from public.role_permissions rp, m
       where rp.deleted_at is null
         and rp.resource = p_resource
         and rp.action = p_action
         and (rp.member_id = m.id or (rp.member_id is null and rp.role = m.role))
         and (rp.organization_id = p_org or rp.organization_id is null)
       -- `false < true`: membrul bate organizația, organizația bate globalul —
       -- inclusiv când valoarea lui e `none`, refuz explicit peste un implicit.
       order by (rp.member_id is null) asc, (rp.organization_id is null) asc
       limit 1
    ),
    'none'::public.permission_scope
  );
$$;

revoke all on function internal.scope_membru(uuid, uuid, text, text) from public, anon, authenticated;

comment on function internal.scope_membru(uuid, uuid, text, text) is
  'Scope-ul efectiv al unui membru DAT pentru resursă:acțiune, cu precedența din 0063 (membru > organizație > global; absența = none). Perechea lui app.has_permission pentru rezolvarea aprobatorilor.';

-- ── 1. internal.rezolva_aprobatori — corpul din 0017, cu scope prin internal.scope_membru ──

create or replace function internal.rezolva_aprobatori(
  p_org uuid,
  p_step uuid,
  p_employee uuid
) returns table (user_id uuid, employee_id uuid, sursa text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_step    public.approval_steps%rowtype;
  v_subiect public.employees%rowtype;
begin
  select * into v_step
    from public.approval_steps s
   where s.id = p_step and s.organization_id = p_org and s.deleted_at is null;
  if not found then
    return;   -- pas inexistent sau șters: mulțime vidă, nu eroare.
  end if;

  select * into v_subiect
    from public.employees e
   where e.id = p_employee and e.organization_id = p_org and e.deleted_at is null;
  if not found then
    return;
  end if;

  return query
  with membri as (
    -- Toți candidații trec de aici. `employees.user_id` e nullable, cu
    -- `on delete set null`, și rămâne setat după simpla dezactivare a
    -- contului (organization_members.status <> 'active') — de aceea testul
    -- de apartenență se face pe organization_members, nu pe employees.
    select m.user_id, m.role
      from public.organization_members m
     where m.organization_id = p_org and m.deleted_at is null and m.status = 'active'
  ),
  fise as (
    -- Fișa PRINCIPALĂ a fiecărui membru activ — singura care poartă un
    -- `manager_path` de încredere pentru testul de subarbore (scope 'team').
    select m.user_id, e.id as employee_id, e.manager_path
      from membri m
      join public.employees e
        on e.organization_id = p_org and e.user_id = m.user_id
       and e.is_primary and e.deleted_at is null
  ),
  scope_leave_approve as (
    -- Scope-ul de leave:approve al fiecărui membru — poarta comună (b),
    -- aplicată identic pentru toate cele patru tipuri de pas mai jos.
    -- Prin `internal.scope_membru`: rândul MEMBRULUI bate rândul rolului
    -- (0063), exact ca `app.has_permission` pentru cel conectat.
    select m.user_id, internal.scope_membru(p_org, m.user_id, 'leave', 'approve') as scope
      from membri m
  ),
  scope_pas as (
    -- Scope-ul pentru resursa:acțiunea CONFIGURATĂ pe pasul de tip 'permisiune'
    -- (în seed, chiar 'leave:approve' — dar funcția rămâne generică).
    select m.user_id,
           internal.scope_membru(p_org, m.user_id,
                                 split_part(v_step.permission_key, ':', 1),
                                 split_part(v_step.permission_key, ':', 2)) as scope
      from membri m
     where v_step.tip = 'permisiune'
  ),
  candidati_bruti as (
    select v_step.approver_user_id as user_id, null::uuid as employee_id, 'utilizator'::text as sursa
     where v_step.tip = 'utilizator' and v_step.approver_user_id is not null

    union all

    -- manager_direct: mulțime vidă dacă angajatul n-are manager, sau dacă
    -- managerul n-are cont — niciuna dintre cele două nu e o eroare aici.
    select m_emp.user_id, m_emp.id, 'manager_direct'::text
      from public.employees m_emp
     where v_step.tip = 'manager_direct'
       and v_subiect.manager_employee_id is not null
       and m_emp.id = v_subiect.manager_employee_id
       and m_emp.deleted_at is null
       and m_emp.user_id is not null

    union all

    select m.user_id, null::uuid, 'rol'::text
      from membri m
     where v_step.tip = 'rol' and m.role = v_step.rol

    union all

    -- permisiune: scope='all' oricând; scope='team' doar dacă aprobatorul e
    -- ANCESTOR al subiectului; scope='own' niciodată (nu figurează mai jos).
    select sp.user_id, f.employee_id, 'permisiune'::text
      from scope_pas sp
      left join fise f on f.user_id = sp.user_id
     where v_step.tip = 'permisiune'
       and (
         sp.scope = 'all'
         or (sp.scope = 'team' and f.employee_id is not null
             and v_subiect.manager_path @> array[f.employee_id])
       )
  )
  select distinct cb.user_id, coalesce(cb.employee_id, f.employee_id) as employee_id, cb.sursa
    from candidati_bruti cb
    join membri m on m.user_id = cb.user_id                    -- (c) membru activ, nu platform admin
    left join fise f on f.user_id = cb.user_id
    left join scope_leave_approve sla on sla.user_id = cb.user_id
   where cb.user_id is distinct from v_subiect.user_id          -- (a) fără auto-aprobare, pe persoană
     and (                                                       -- (b) poarta comună, indiferent de sursă
       sla.scope = 'all'
       or (sla.scope = 'team' and f.employee_id is not null
           and v_subiect.manager_path @> array[f.employee_id])
     );
end;
$$;

revoke all on function internal.rezolva_aprobatori(uuid, uuid, uuid) from public, anon, authenticated;

-- ── 2. internal.rezolva_aprobator_pontaj — corpul din 0041 ──

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
    -- Prin `internal.scope_membru`: rândul membrului bate rândul rolului (0063).
    select m.user_id, internal.scope_membru(p_org, m.user_id, 'attendance', 'approve') as scope
      from membri m
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

-- ── 3. internal.leave_requests_sincronizeaza — corpul din 0112 (escaladarea la `all`) ──

CREATE OR REPLACE FUNCTION internal.leave_requests_sincronizeaza()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_r      record;
  v_step   record;
  v_n_cand integer;
  v_n_escl integer;
begin
  -- regenerează liniile de zi când perioada s-a schimbat
  if tg_op = 'INSERT'
     or old.data_inceput <> new.data_inceput or old.data_sfarsit <> new.data_sfarsit then
    delete from public.leave_request_days where leave_request_id = new.id;
    insert into public.leave_request_days
      (organization_id, leave_request_id, data, portiune, este_lucratoare, status)
    select new.organization_id, new.id, z::date,
      'zi_intreaga'::public.leave_day_portion,
      app.este_zi_lucratoare(new.organization_id, z::date),
      new.status
    from generate_series(new.data_inceput, new.data_sfarsit, interval '1 day') as z;
  elsif old.status is distinct from new.status then
    update public.leave_request_days
       set status = new.status, updated_at = now()
     where leave_request_id = new.id and status <> 'intrerupta';
  end if;

  -- întreruperea concediilor suprapuse (CM peste CO aprobat)
  if new.intrerupe_alte_concedii and new.status = 'aprobata'
     and (tg_op = 'INSERT' or old.status is distinct from 'aprobata') then
    update public.leave_request_days d
       set status = 'intrerupta', updated_at = now()
      from public.leave_requests r
     where d.leave_request_id = r.id
       and r.employee_id = new.employee_id and r.id <> new.id
       and r.organization_id = new.organization_id
       and r.status = 'aprobata' and r.deleted_at is null
       and d.data between new.data_inceput and new.data_sfarsit
       and d.status = 'aprobata';

    for v_r in
      select distinct rr.id, rr.leave_type_id, rr.employee_id, rr.organization_id
        from public.leave_requests rr
        join public.leave_request_days dd on dd.leave_request_id = rr.id
       where rr.employee_id = new.employee_id and rr.id <> new.id
         and rr.status = 'aprobata' and rr.deleted_at is null
         and dd.status = 'intrerupta'
    loop
      if not exists (select 1 from public.leave_request_days
                      where leave_request_id = v_r.id and status = 'aprobata') then
        update public.leave_requests set status = 'intrerupta', updated_at = now() where id = v_r.id;
      end if;
      perform internal.recalc_sold(v_r.organization_id, v_r.employee_id, v_r.leave_type_id,
                                   extract(year from new.data_inceput)::int, v_r.id);
    end loop;
  end if;

  -- lanțul de aprobare: la trimitere se rezolvă și se creează sarcinile, pas cu pas.
  if new.status = 'trimisa' and (tg_op = 'INSERT' or old.status is distinct from 'trimisa') then
    for v_step in
      select s.*
        from public.approval_flows f
        join public.approval_steps s on s.flow_id = f.id and s.deleted_at is null
       where f.organization_id = new.organization_id and f.entity_type = 'leave_request'
         and f.activ and f.deleted_at is null
       order by s.ordine
    loop
      continue when exists (
        select 1 from public.approval_tasks t
         where t.entity_type = 'leave_request' and t.entity_id = new.id
           and t.step_id = v_step.id and t.deleted_at is null
      );

      with inseratii as (
        insert into public.approval_tasks
          (organization_id, flow_id, step_id, entity_type, entity_id, ordine,
           approver_user_id, approver_employee_id, termen_la)
        select new.organization_id, v_step.flow_id, v_step.id, 'leave_request', new.id, v_step.ordine,
               c.user_id, c.employee_id,
               case when v_step.sla_ore is null then null else now() + make_interval(hours => v_step.sla_ore) end
          from internal.rezolva_aprobatori(new.organization_id, v_step.id, new.employee_id) c
        returning 1
      )
      select count(*) into v_n_cand from inseratii;

      if v_n_cand > 25 then
        raise exception using errcode = 'P0001',
          message = 'Pasul de aprobare vizează prea multe persoane; restrângeți-l.';
      end if;

      if v_n_cand = 0 and not v_step.optional then
        -- Mulțime vidă pe un pas obligatoriu: ESCALADARE, nu sărire și nu
        -- blocare. Se reia rezolvarea ca pentru un pas virtual
        -- permission_key='leave:approve', scope 'all'.
        with inseratii_escl as (
          insert into public.approval_tasks
            (organization_id, flow_id, step_id, entity_type, entity_id, ordine,
             approver_user_id, approver_employee_id, termen_la)
          select new.organization_id, v_step.flow_id, v_step.id, 'leave_request', new.id, v_step.ordine,
                 e.user_id, e.employee_id,
                 case when v_step.sla_ore is null then null else now() + make_interval(hours => v_step.sla_ore) end
            from (
              -- Prin `internal.scope_membru`: rândul membrului bate rândul
              -- rolului (0063), ca în `rezolva_aprobatori`.
              select m.user_id,
                     (select em.id from public.employees em
                       where em.organization_id = new.organization_id and em.user_id = m.user_id
                         and em.is_primary and em.deleted_at is null) as employee_id
                from public.organization_members m
               where m.organization_id = new.organization_id and m.deleted_at is null and m.status = 'active'
                 and internal.scope_membru(new.organization_id, m.user_id, 'leave', 'approve') = 'all'
                 and m.user_id is distinct from (
                       select e2.user_id from public.employees e2
                        where e2.id = new.employee_id and e2.deleted_at is null)
            ) e
          returning 1
        )
        select count(*) into v_n_escl from inseratii_escl;

        if v_n_escl > 25 then
          raise exception using errcode = 'P0001',
            message = 'Pasul de aprobare vizează prea multe persoane; restrângeți-l.';
        end if;

        if v_n_escl > 0 then
          perform app.write_audit('update', new.organization_id, 'leave_requests', new.id, null,
            jsonb_build_object('eveniment', 'escaladare_fara_manager', 'step_id', v_step.id,
                                'candidati', v_n_escl));
        else
          -- Firma cu un singur om: nimeni nu poate decide. O singură sarcină
          -- auto-aprobată, cu urmă explicită — nu se blochează, nu se sare tăcut.
          insert into public.approval_tasks
            (organization_id, flow_id, step_id, entity_type, entity_id, ordine,
             approver_user_id, approver_employee_id, status, decis_la, comentariu)
          values
            (new.organization_id, v_step.flow_id, v_step.id, 'leave_request', new.id, v_step.ordine,
             null, null, 'aprobata', now(), 'Pas fără destinatar — aprobat automat');

          perform app.write_audit('update', new.organization_id, 'leave_requests', new.id, null,
            jsonb_build_object('eveniment', 'pas_fara_destinatar', 'step_id', v_step.id));
        end if;
      end if;
    end loop;
  end if;

  if tg_op = 'INSERT' or old.status is distinct from new.status
     or old.data_inceput <> new.data_inceput or old.data_sfarsit <> new.data_sfarsit then
    perform internal.recalc_sold(new.organization_id, new.employee_id, new.leave_type_id,
                                 extract(year from new.data_inceput)::int, new.id);
    if extract(year from new.data_sfarsit)::int <> extract(year from new.data_inceput)::int then
      perform internal.recalc_sold(new.organization_id, new.employee_id, new.leave_type_id,
                                   extract(year from new.data_sfarsit)::int, new.id);
    end if;
  end if;
  return null;
end; $function$
;

revoke all on function internal.leave_requests_sincronizeaza() from public, anon, authenticated;

-- ── 4. internal.leave_requests_notifica_anularea — corpul din 0079 ──

create or replace function internal.leave_requests_notifica_anularea()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subiect public.employees%rowtype;
  v_tip     text;
  v_era_aprobat boolean;
begin
  if new.status <> 'anulata'
     or old.status is not distinct from new.status
     or old.status not in ('aprobata', 'trimisa', 'in_aprobare') then
    return null;
  end if;

  -- Numai anularea făcută DE ANGAJATUL ÎNSUȘI. Textul de mai jos spune „X a
  -- anulat concediul”; dacă HR-ul retrage cererea altcuiva, propoziția ar fi
  -- falsă și aprobatorii ar cere explicații omului nepotrivit. Anularea
  -- administrativă e o conversație pe care o poartă cine a făcut-o.
  --
  -- Sub `service_role` — scripturi, sarcini de întreținere —
  -- `app.current_employee_id` întoarce null (`auth.uid()` e null), deci nu se
  -- notifică nimeni. Voit: o retragere în masă dintr-un script nu trebuie să
  -- umple cutiile aprobatorilor. `anuleazaCerere` scrie prin clientul
  -- utilizatorului, nu prin cel de serviciu — vezi `ctx.supabase` în handler.
  if app.current_employee_id(new.organization_id) is distinct from new.employee_id then
    return null;
  end if;

  v_era_aprobat := old.status = 'aprobata';

  select * into v_subiect
    from public.employees e
   where e.id = new.employee_id;
  if not found then
    return null;
  end if;

  select lt.denumire into v_tip
    from public.leave_types lt where lt.id = new.leave_type_id;

  insert into public.notifications
    (organization_id, user_id, kind, title, body, link, entity_type, entity_id)
  select distinct
         new.organization_id,
         d.user_id,
         case when v_era_aprobat then 'warning'::public.notification_kind
              else 'info'::public.notification_kind end,
         case when v_era_aprobat then 'Concediu aprobat, anulat de angajat'
              else 'Cerere de concediu retrasă' end,
         coalesce(v_subiect.full_name, 'Un angajat')
           || case when v_era_aprobat
                   then ' a anulat concediul'
                   else ' a retras cererea de concediu' end
           || coalesce(' de ' || v_tip, '')
           || ' pentru perioada ' || to_char(new.data_inceput, 'DD.MM.YYYY')
           || ' – ' || to_char(new.data_sfarsit, 'DD.MM.YYYY') || '.'
           || case when v_era_aprobat
                   then ' Zilele s-au întors în sold, iar zilele de pontaj generate au fost retrase.'
                   else ' Nu mai așteaptă decizia dumneavoastră.' end,
         '/concedii/' || new.id::text,
         'leave_request', new.id
    from (
      -- Scope-ul de `leave:approve` al fiecărui membru activ, cu rândul pe
      -- organizație bătând rândul global — exact ordonarea din
      -- `internal.rezolva_aprobatori`, altfel un membru cu ambele rânduri ar fi
      -- evaluat de două ori, cu scope-uri diferite.
      -- Prin `internal.scope_membru`: rândul membrului bate rândul rolului
      -- (0063), exact ca în `rezolva_aprobatori` de la 0189.
      select m.user_id,
             internal.scope_membru(new.organization_id, m.user_id, 'leave', 'approve') as scope,
             f.id as fisa_id
        from public.organization_members m
        left join public.employees f
          on f.organization_id = new.organization_id and f.user_id = m.user_id
         and f.is_primary and f.deleted_at is null
       where m.organization_id = new.organization_id
         and m.deleted_at is null
         and m.status = 'active'
         and m.user_id is not null
         and m.user_id is distinct from v_subiect.user_id
    ) d
   where d.scope = 'all'
      or (d.scope = 'team'
          and d.fisa_id is not null
          and v_subiect.manager_path @> array[d.fisa_id]);

  return null;
end;
$$;

revoke all on function internal.leave_requests_notifica_anularea() from public, anon, authenticated;

commit;
