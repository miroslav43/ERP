-- ─────────────────────────────────────────────────────────────────────────────
-- 0017_fix_concedii.sql — modulul de CONCEDII (0009) chiar funcționează
--
-- 0009 trecea typecheck, lint și cele trei bariere, dar niciuna dintre ele
-- execută un flux real de cerere → aprobare → sold. Fiecare defect de mai jos a
-- fost reprodus pe o bază 0001–0016 curată, ca `authenticated`, înainte de
-- reparație, și re-reprodus după.
--
-- C1. `internal.leave_requests_sincronizeaza`: `declare r record` UMBREȘTE
--     aliasul de tabelă `r` din `update ... from public.leave_requests r`.
--     PL/pgSQL rezolvă orice `r.ceva` din funcție la variabila (ne)atribuită,
--     chiar înainte ca bucla `for r in ...` să o atribuie — variabila e
--     declarată pentru toată funcția, nu doar pentru buclă.
--     REPRO (înainte): `update leave_requests set status='aprobata'` pe o
--     cerere de tip medical/maternitate/creștere copil (orice tip cu
--     `intrerupe_alte_concedii`), FĂRĂ suprapunere → 42804... de fapt
--     `ERROR: record "r" is not assigned yet`.
--     REMEDIU: variabila buclei redenumită `v_r`; aliasul SQL `r` rămâne `r`,
--     acum neambiguu.
--
-- C2. `internal.recalc_sold`: `case when ... then 'consum' else 'restituire'
--     end` se rezolvă la `text`; coloana `eveniment` e enum
--     `leave_accrual_event`. Nu apare la prima cerere (v_folosite=v_vechi=0,
--     ramura nu se atinge) — apare la a doua, adică la fiecare aprobare reală.
--     Același defect ca `audit_action` din 0006. Cast explicit.
--
-- C3. Politica `leave_requests_insert` cerea `zile_lucratoare = 0 and
--     zile_calendaristice = 0`, dar triggerul BEFORE le calculează ÎNAINTE ca
--     WITH CHECK să fie evaluat — exact clasa de defect din
--     `0007_fix_hr_rls.sql` §1. Nicio cerere nu putea fi creată. Coloanele ies
--     din WITH CHECK; aparțin triggerului.
--
-- C6. Fluxul de aprobare era o singură sarcină, pentru primul pas găsit, fără
--     nicio verificare că țintitul chiar poate aproba concedii — vezi
--     specificația arhitectului (funcția nouă `internal.rezolva_aprobatori`,
--     mai jos) și capcana #3: o sarcină e un drept de citire, fiindcă
--     `leave_requests_select` (neatinsă de 0016) deschide cererea oricui apare
--     ca `approver_user_id` într-un `approval_tasks`.
--
-- I1. Soldul devenea oricât de negativ; `internal.asigura_sold` avea o cursă
--     clasică check-then-insert (READ COMMITTED: rândul concurent invizibil,
--     neconflictual, `v_id` rămânea NULL). Plafon + `on conflict ... do
--     update ... returning (xmax=0)` — vezi specificația.
--
-- I2. `scade_din_sold` era ignorat: un concediu medical (plafon CALENDARISTIC,
--     183 zile) producea un rând `leave_balances` din care se scădeau zile
--     LUCRĂTOARE, ca și cum ar fi concediu de odihnă. Ieșire imediată, ÎN
--     AMBELE funcții, când tipul nu scade din sold.
--
-- I3. `leave_balances` se putea rescrie direct (`update leave_balances set
--     folosite=0`), fără nicio urmă — tabela n-avea trigger. Gardă BEFORE
--     UPDATE pe coloanele calculate (`folosite`, `in_asteptare`) + trigger
--     AFTER UPDATE care face vizibilă corecția legitimă de încadrare
--     (`drept_anual`/`reportate`) în `leave_accruals`.
--
-- I5. Auditul lui `leave_requests` copia `medical_code_id`, seria și numărul
--     certificatului și `motiv` — date de sănătate, art. 9 GDPR — direct în
--     `audit_logs`, lizibil de oricine are `audit:read`. Listă albă de câmpuri
--     excluse, citită din `tg_table_name` (nu din `TG_ARGV`, ca să
--     supraviețuiască unei re-rulări a `attach_audit`), aplicată în
--     `internal.audit_trigger()` — același trigger `audit_leave_requests`,
--     fără re-atașare.
--
-- NEATINSE, deliberat (deja reparate în 0016, redeclararea lor ar fi o
-- regresie tăcută): politica `leave_requests_update` (auto-aprobarea),
-- absența privilegiului INSERT pe `approval_tasks` (forjarea de sarcini),
-- garda de apartenență din `app.este_zi_lucratoare` / `app.numara_zile_lucratoare`.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- 1. internal.rezolva_aprobatori — cine poate decide un pas de aprobare
--
-- FĂRĂ grant către `authenticated`: schema `internal` nu are USAGE pentru
-- `authenticated` (verificat), deci funcția e inaccesibilă direct oricum, dar
-- REVOKE explicit rămâne apărare în adâncime, ca restul funcțiilor `internal.*`.
--
-- Rezolvă candidații pentru UN pas, respectând literal specificația:
--   1) candidații bruți trec OBLIGATORIU prin `organization_members` activ
--      (angajatul poate avea `user_id` nenul dar cont dezactivat/dezasociat);
--   2) poarta comună celor patru tipuri: (a) candidatul nu e chiar angajatul
--      cererii — comparat pe PERSOANĂ (user_id), nu pe fișă, fiindcă un cumul
--      de funcții nu trebuie să-i permită omului să-și aprobe propria cerere
--      dintr-o a doua fișă; (b) candidatul deține `leave:approve` la 'all',
--      sau la 'team' cu angajatul cererii în subarborele lui — INDIFERENT de
--      tipul pasului, altfel un pas tip='rol', rol='employee' deschide
--      exact escaladarea închisă parțial de 0016 (capcana #3); (c) rezolvarea
--      pleacă din `organization_members`, deci un platform admin nu devine
--      aprobator pe această cale.
--
-- NU folosește `app.has_permission`/`app.can`: prima citește `auth.uid()`
-- (nu are sens pentru un candidat arbitrar), a doua e prag, nu filtru de rând.
-- ═════════════════════════════════════════════════════════════════════════════

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
    select distinct on (m.user_id) m.user_id, rp.scope
      from membri m
      join public.role_permissions rp
        on rp.role = m.role and rp.deleted_at is null
       and rp.resource = 'leave' and rp.action = 'approve'
       and (rp.organization_id = p_org or rp.organization_id is null)
     order by m.user_id, (rp.organization_id is null) asc   -- rândul org bate globalul
  ),
  scope_pas as (
    -- Scope-ul pentru resursa:acțiunea CONFIGURATĂ pe pasul de tip 'permisiune'
    -- (în seed, chiar 'leave:approve' — dar funcția rămâne generică).
    select distinct on (m.user_id) m.user_id, rp.scope
      from membri m
      join public.role_permissions rp
        on rp.role = m.role and rp.deleted_at is null
       and rp.resource = split_part(v_step.permission_key, ':', 1)
       and rp.action   = split_part(v_step.permission_key, ':', 2)
       and (rp.organization_id = p_org or rp.organization_id is null)
     where v_step.tip = 'permisiune'
     order by m.user_id, (rp.organization_id is null) asc
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

comment on function internal.rezolva_aprobatori(uuid, uuid, uuid) is
  'Candidații pentru UN pas de aprobare a unei cereri de concediu. Filtrează prin leave:approve (all, sau team cu angajatul în subarbore) INDIFERENT de tipul pasului — altfel un pas tip=rol,rol=employee deschide citirea cererii colegului prin approval_tasks (0016, capcana #3). Fără GRANT: schema internal nu are USAGE pentru authenticated.';


-- ═════════════════════════════════════════════════════════════════════════════
-- 2. internal.leave_requests_sincronizeaza — C1 + C6
--
-- Corpul e copia EXACTĂ a celui din 0009, cu DOUĂ clase de schimbare:
--   • C1: `r` → `v_r` (variabila buclei; aliasul SQL `r` rămâne `r`);
--   • C6: blocul „lanțul de aprobare" (un singur INSERT, fără gardă) e
--     înlocuit cu rezolvarea pas-cu-pas descrisă mai sus.
--
-- Pentru fiecare pas configurat, în ordine:
--   - dacă pasul are deja sarcini pentru cererea asta (re-trimitere), se sare
--     (idempotență — identic cu `not exists (...)` din 0009);
--   - se inserează câte un rând PER CANDIDAT din `rezolva_aprobatori`, cu
--     `returning` numărat prin CTE, ca peste 25 de rânduri să anuleze
--     tranzacția (deci și rândurile deja inserate) în loc să lase un pas
--     jumătate populat;
--   - MULȚIME VIDĂ pe un pas OBLIGATORIU (nu doar manager_direct — regula se
--     generalizează: „a sări un pas optional=false înseamnă aprobare fără
--     decident" e valabil pentru orice tip, nu doar pentru cel din seed):
--     se ESCALADEAZĂ la leave:approve='all', cu audit; dacă și escaladarea e
--     vidă, o SINGURĂ sarcină auto-aprobată, cu urmă explicită.
--     Un pas OPȚIONAL fără candidați se sare fără urmă — exact asta înseamnă
--     „opțional”.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function internal.leave_requests_sincronizeaza()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_r      record;
  v_step   record;
  v_n_cand integer;
  v_n_escl integer;
begin
  -- regenerează liniile de zi când perioada s-a schimbat
  if tg_op = 'INSERT'
     or old.data_inceput <> new.data_inceput or old.data_sfarsit <> new.data_sfarsit
     or old.portiune_inceput <> new.portiune_inceput or old.portiune_sfarsit <> new.portiune_sfarsit then
    delete from public.leave_request_days where leave_request_id = new.id;
    insert into public.leave_request_days
      (organization_id, leave_request_id, data, portiune, este_lucratoare, status)
    select new.organization_id, new.id, z::date,
      case
        when z::date = new.data_inceput and new.portiune_inceput <> 'zi_intreaga' then new.portiune_inceput
        when z::date = new.data_sfarsit and new.portiune_sfarsit <> 'zi_intreaga' then new.portiune_sfarsit
        else 'zi_intreaga'::public.leave_day_portion
      end,
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
              select distinct on (m.user_id) m.user_id,
                     (select em.id from public.employees em
                       where em.organization_id = new.organization_id and em.user_id = m.user_id
                         and em.is_primary and em.deleted_at is null) as employee_id
                from public.organization_members m
                join public.role_permissions rp
                  on rp.role = m.role and rp.deleted_at is null
                 and rp.resource = 'leave' and rp.action = 'approve'
                 and (rp.organization_id = new.organization_id or rp.organization_id is null)
               where m.organization_id = new.organization_id and m.deleted_at is null and m.status = 'active'
                 and rp.scope = 'all'
                 and m.user_id is distinct from (
                       select e2.user_id from public.employees e2
                        where e2.id = new.employee_id and e2.deleted_at is null)
               order by m.user_id, (rp.organization_id is null) asc
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
end; $$;


-- ═════════════════════════════════════════════════════════════════════════════
-- 3. Re-țintirea supravegheată — item 5 din specificație
--
-- Sarcinile se îngheață la creare (sunt dovada „X a decis la ora Y"), dar o
-- reorganizare (schimbarea managerului) nu trebuie să lase o sarcină
-- 'in_asteptare' agățată de un manager care nu mai e managerul nimănui pentru
-- cererea asta. Se re-rezolvă DOAR sarcinile 'in_asteptare' de tip
-- manager_direct ale angajatului reorganizat; sarcinile deja decise nu se
-- ating niciodată (filtrul `t.status = 'in_asteptare'` le exclude structural).
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function internal.approval_tasks_retinteste_manager()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t      record;
  v_cand   record;
  v_gasit  boolean;
  v_before jsonb;
  v_after  jsonb;
begin
  if new.manager_employee_id is not distinct from old.manager_employee_id then
    return new;
  end if;

  for v_t in
    select t.*
      from public.approval_tasks t
      join public.approval_steps s on s.id = t.step_id and s.tip = 'manager_direct'
      join public.leave_requests lr on lr.id = t.entity_id
     where t.entity_type = 'leave_request'
       and t.status = 'in_asteptare'
       and t.deleted_at is null
       and lr.employee_id = new.id
       and lr.deleted_at is null
  loop
    v_before := jsonb_build_object('approver_user_id', v_t.approver_user_id,
                                    'approver_employee_id', v_t.approver_employee_id);
    v_gasit := false;

    for v_cand in
      select * from internal.rezolva_aprobatori(new.organization_id, v_t.step_id, new.id)
    loop
      if not v_gasit then
        -- Cazul obișnuit: exact un manager nou. Mutăm rândul existent.
        update public.approval_tasks
           set approver_user_id = v_cand.user_id,
               approver_employee_id = v_cand.employee_id,
               updated_at = now()
         where id = v_t.id;
        v_after := jsonb_build_object('approver_user_id', v_cand.user_id,
                                       'approver_employee_id', v_cand.employee_id);
        v_gasit := true;
      else
        -- Teoretic imposibil pentru manager_direct (un singur manager direct),
        -- dar dacă rezolvarea întoarce mai mult de un candidat, se adaugă
        -- rânduri noi în loc să se piardă un aprobator legitim.
        insert into public.approval_tasks
          (organization_id, flow_id, step_id, entity_type, entity_id, ordine,
           approver_user_id, approver_employee_id, termen_la)
        values
          (v_t.organization_id, v_t.flow_id, v_t.step_id, v_t.entity_type, v_t.entity_id, v_t.ordine,
           v_cand.user_id, v_cand.employee_id, v_t.termen_la);
      end if;
    end loop;

    -- Zero candidați noi (noul manager n-are cont, sau n-are leave:approve):
    -- sarcina rămâne pe vechiul aprobator. Nu se orfanizează — spec limitează
    -- explicit acest trigger la re-țintire, nu la escaladare.
    if v_gasit then
      perform app.write_audit('update', new.organization_id, 'approval_tasks', v_t.id, v_before, v_after);
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function internal.approval_tasks_retinteste_manager() from public, anon, authenticated;

drop trigger if exists trg_employees_retinteste_aprobare on public.employees;
create trigger trg_employees_retinteste_aprobare
  after update of manager_employee_id on public.employees
  for each row execute function internal.approval_tasks_retinteste_manager();


-- ═════════════════════════════════════════════════════════════════════════════
-- 4. O sarcină pe persoană → surorile se anulează la prima decizie (item 4)
--
-- Un pas 'rol'/'permisiune' poate produce mai multe sarcini pentru ACELAȘI
-- (entity_id, ordine). Când una e decisă (aprobată/respinsă/delegată/expirată),
-- restul, încă 'in_asteptare', nu mai au obiect: se anulează. Sarcinile deja
-- decise nu sunt atinse (condiția `old.status = 'in_asteptare'` le exclude).
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function internal.approval_tasks_anuleaza_surori()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'in_asteptare' and new.status <> 'in_asteptare' then
    update public.approval_tasks
       set status = 'anulata', decis_la = coalesce(decis_la, now()), updated_at = now()
     where entity_type = new.entity_type and entity_id = new.entity_id
       and ordine = new.ordine and id <> new.id
       and status = 'in_asteptare' and deleted_at is null;
  end if;
  return new;
end;
$$;

revoke all on function internal.approval_tasks_anuleaza_surori() from public, anon, authenticated;

drop trigger if exists trg_approval_tasks_anuleaza_surori on public.approval_tasks;
create trigger trg_approval_tasks_anuleaza_surori
  after update on public.approval_tasks
  for each row execute function internal.approval_tasks_anuleaza_surori();


-- ═════════════════════════════════════════════════════════════════════════════
-- 5. C3 — leave_requests_insert: coloanele calculate ies din WITH CHECK
--
-- Aceeași clasă de defect ca `0007_fix_hr_rls.sql` §1: triggerul BEFORE
-- calculează `zile_lucratoare`/`zile_calendaristice` înainte ca WITH CHECK să
-- fie evaluat, deci politica vedea mereu valorile deja scrise de trigger, nu
-- zero. Restul politicii (stare inițială, câmpuri de decizie nule) rămâne.
-- ═════════════════════════════════════════════════════════════════════════════

drop policy if exists leave_requests_insert on public.leave_requests;
create policy leave_requests_insert on public.leave_requests for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'leave')
    and status in ('ciorna', 'trimisa')
    and pas_curent = 0 and decis_la is null and decis_de is null
    and motiv_respingere is null and deleted_at is null
    and created_by = (select auth.uid())
    and (
      employee_id = app.current_employee_id(organization_id)
      or app.has_permission(organization_id, 'leave', 'create') = 'all'
    )
  );


-- ═════════════════════════════════════════════════════════════════════════════
-- 6. I1 + I2 — internal.asigura_sold: gardă de tip + cursă rezolvată
--
-- SEMNĂTURA NU SE SCHIMBĂ (returns uuid, aceiași 4 parametri): funcția e
-- apelată din internal.recalc_sold, care are propriul apelant fixat mai jos.
--
-- I2: tipurile cu scade_din_sold=false (medical, maternitate, fără plată...)
-- nu au ce „sold” să creeze — ieșire imediată, ÎNAINTE de orice INSERT.
-- I1: `select ... where id = v_id` urmat de `insert` avea o cursă clasică
-- check-then-act; sub READ COMMITTED, două cereri simultane pe primul sold al
-- anului puteau amândouă găsi „nimic” și insera. `insert ... on conflict
-- (...) where deleted_at is null do update ... returning id, (xmax=0)` ia
-- lockul rândului concurent și așteaptă commit-ul lui — `do nothing` NU e
-- suficient (rândul concurent, neîncă-committed, e invizibil sub READ
-- COMMITTED, nu blochează, iar re-SELECT-ul întoarce gol). Inserarea în
-- `leave_accruals` se mută SUB `if v_nou`, altfel două apeluri concurente
-- scriau două rânduri de 'drept_initial' pentru același sold.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function internal.asigura_sold(
  p_org uuid, p_employee uuid, p_type uuid, p_an integer
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id  uuid;
  v_nou boolean;
begin
  if not coalesce(
    (select lt.scade_din_sold from public.leave_types lt where lt.id = p_type), true
  ) then
    return null;
  end if;

  insert into public.leave_balances (organization_id, employee_id, leave_type_id, an, drept_anual)
  select p_org, p_employee, p_type, p_an, lt.zile_implicite
    from public.leave_types lt where lt.id = p_type
  on conflict (organization_id, employee_id, leave_type_id, an) where deleted_at is null
  do update set updated_at = now()
  returning id, (xmax = 0) into v_id, v_nou;

  if v_nou then
    insert into public.leave_accruals
      (organization_id, employee_id, leave_type_id, an, eveniment, delta, motiv)
    select p_org, p_employee, p_type, p_an, 'drept_initial', lt.zile_implicite,
           'Drept anual inițial din configurarea tipului de concediu.'
      from public.leave_types lt where lt.id = p_type;
  end if;

  return v_id;
end;
$$;


-- ═════════════════════════════════════════════════════════════════════════════
-- 7. C2 + I1 + I2 — internal.recalc_sold: cast de enum, plafon, gardă de tip
--
-- SEMNĂTURA NU SE SCHIMBĂ (aceiași 5 parametri, `p_cerere` cu DEFAULT null):
-- `internal.leave_requests_sincronizeaza()` o apelă de două ori (cererile care
-- traversează anul); un `create or replace` cu altă aritate ar crea o
-- supraîncărcare și AMBELE apeluri s-ar lega în continuare de funcția veche.
--
-- C2: `case ... end` peste literale, atribuit unei coloane enum, se rezolvă la
-- `text` → 42804 la FIECARE aprobare/restituire reală (nu la prima cerere,
-- unde `v_folosite = v_vechi` și ramura nu se atinge). Cast explicit.
--
-- I2: gardă geamănă cu cea din asigura_sold — dacă tipul nu scade din sold,
-- funcția iese ÎNAINTE de a apela asigura_sold, deci nici rândul de sold nu
-- se mai creează pentru concediul medical.
--
-- I1 (plafonul): NU într-un CHECK (coloană generată, n-are cum să citească
-- `leave_types.scade_din_sold`, ar bloca și corecția retroactivă legitimă a
-- HR-ului) și NU într-un trigger BEFORE pe leave_requests (rulează înainte ca
-- leave_request_days să existe). `recalc_sold` e singurul loc care vede
-- simultan valoarea veche și cea nouă — singurul care distinge CONSUMUL de
-- RESTITUIRE. `for update` serializează două recalculări concurente pe
-- același sold. Condiția `(v_folosite+v_asteptare) > (v_vechi+v_vechi_ast)`
-- oprește DOAR direcția de consum: anularea, întreruperea prin CM și
-- restituirea pe un sold deja negativ nu sunt blocate, iar corecția
-- retroactivă a HR-ului (care nu trece prin funcția asta) rămâne posibilă.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function internal.recalc_sold(
  p_org uuid, p_employee uuid, p_type uuid, p_an integer, p_cerere uuid default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_folosite numeric(6,2); v_asteptare numeric(6,2); v_vechi numeric(6,2); v_vechi_ast numeric(6,2);
  v_id uuid;
  v_scade boolean; v_denumire text;
  v_ramase numeric(6,2);
begin
  select lt.scade_din_sold, lt.denumire into v_scade, v_denumire
    from public.leave_types lt where lt.id = p_type;

  if not coalesce(v_scade, true) then
    return;
  end if;

  v_id := internal.asigura_sold(p_org, p_employee, p_type, p_an);

  select coalesce(sum(case when d.portiune = 'zi_intreaga' then 1 else 0.5 end), 0)
    into v_folosite
    from public.leave_request_days d
    join public.leave_requests r on r.id = d.leave_request_id
   where r.organization_id = p_org and r.employee_id = p_employee
     and r.leave_type_id = p_type and r.deleted_at is null
     and d.este_lucratoare and d.status = 'aprobata'
     and extract(year from d.data)::int = p_an;

  select coalesce(sum(case when d.portiune = 'zi_intreaga' then 1 else 0.5 end), 0)
    into v_asteptare
    from public.leave_request_days d
    join public.leave_requests r on r.id = d.leave_request_id
   where r.organization_id = p_org and r.employee_id = p_employee
     and r.leave_type_id = p_type and r.deleted_at is null
     and d.este_lucratoare and d.status in ('trimisa', 'in_aprobare')
     and extract(year from d.data)::int = p_an;

  select folosite, in_asteptare into v_vechi, v_vechi_ast
    from public.leave_balances where id = v_id for update;

  update public.leave_balances
     set folosite = v_folosite, in_asteptare = v_asteptare, updated_at = now()
   where id = v_id
  returning ramase into v_ramase;

  if v_scade and v_ramase < 0
     and (v_folosite + v_asteptare) > (v_vechi + v_vechi_ast) then
    raise exception using errcode = 'P0001', message = format(
      'Soldul de „%s" pe anul %s nu acoperă zilele solicitate: lipsesc %s zile. '
      'Reduceți perioada sau cereți ajustarea dreptului anual.',
      v_denumire, p_an, trim(to_char(-v_ramase, 'FM9990D00')));
  end if;

  if v_folosite <> v_vechi then
    insert into public.leave_accruals
      (organization_id, employee_id, leave_type_id, an, eveniment, delta, sold_dupa, motiv, leave_request_id)
    select p_org, p_employee, p_type, p_an,
           (case when v_folosite > v_vechi then 'consum' else 'restituire' end)::public.leave_accrual_event,
           (v_vechi - v_folosite),
           b.ramase,
           case when v_folosite > v_vechi
                then 'Zile consumate prin cerere de concediu aprobată.'
                else 'Zile restituite (cerere anulată sau concediu întrerupt).' end,
           p_cerere
      from public.leave_balances b where b.id = v_id;
  end if;
end;
$$;


-- ═════════════════════════════════════════════════════════════════════════════
-- 8. I3 — leave_balances nu se mai poate rescrie direct, fără urmă
--
-- `app.is_service_context()` NU distinge aici: motorul (internal.recalc_sold)
-- rulează SECURITY DEFINER, dar GUC-ul `role` rămâne 'authenticated' și în
-- interiorul unei funcții DEFINER (0002, comentariul lui `is_service_context`)
-- — exact ca la o scriere directă a clientului. `is_service_context()` ar
-- bloca și scrierea motorului.
--
-- Discriminatorul corect e ADÂNCIMEA DE TRIGGER. Scrierea motorului ajunge la
-- acest UPDATE dintr-un lanț de triggere deja pornit (leave_requests AFTER →
-- internal.recalc_sold → acest UPDATE): `pg_trigger_depth()` e cel puțin 2.
-- O scriere directă a clientului pe `leave_balances` nu are niciun trigger
-- deasupra ei: `pg_trigger_depth()` e 1 — chiar și în interiorul acestui
-- trigger, unde SECURITY DEFINER a schimbat `current_user`, dar nu adâncimea.
-- Corecțiile legitime (`drept_anual`/`reportate`) nu ating `folosite`/
-- `in_asteptare`, deci trec neatinse de gardă.
--
-- Vizibilitatea corecțiilor legitime: trigger AFTER UPDATE separat, care
-- scrie în `leave_accruals` (eveniment = 'corectie_incadrare', valoare deja
-- existentă în enum) când `drept_anual`/`reportate` se schimbă. NU ridică
-- niciodată excepție — HR poate duce soldul în negativ retroactiv,
-- angajatul nu (secțiunea PLAFON din specificație).
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function internal.leave_balances_protejeaza_calculate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_catalog.pg_trigger_depth() <= 1
     and (new.folosite is distinct from old.folosite
          or new.in_asteptare is distinct from old.in_asteptare) then
    raise exception using errcode = 'P0001',
      message = 'Coloanele „folosite” și „în așteptare” sunt calculate de motorul de concedii din cererile aprobate/în așteptare și nu pot fi scrise direct. Pentru o corecție de încadrare, modificați „drept_anual” / „reportate”.';
  end if;
  return new;
end;
$$;

revoke all on function internal.leave_balances_protejeaza_calculate() from public, anon, authenticated;

drop trigger if exists trg_leave_balances_protejeaza on public.leave_balances;
create trigger trg_leave_balances_protejeaza
  before update on public.leave_balances
  for each row execute function internal.leave_balances_protejeaza_calculate();

create or replace function internal.leave_balances_corectie_incadrare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.drept_anual is distinct from old.drept_anual
     or new.reportate is distinct from old.reportate then
    insert into public.leave_accruals
      (organization_id, employee_id, leave_type_id, an, eveniment, delta, sold_dupa, motiv, created_by)
    values
      (new.organization_id, new.employee_id, new.leave_type_id, new.an, 'corectie_incadrare',
       (new.drept_anual + new.reportate) - (old.drept_anual + old.reportate),
       new.ramase,
       'Corecție de încadrare: drept_anual ' || old.drept_anual::text || ' → ' || new.drept_anual::text ||
         ', reportate ' || old.reportate::text || ' → ' || new.reportate::text || '.',
       auth.uid());
  end if;
  return new;
end;
$$;

revoke all on function internal.leave_balances_corectie_incadrare() from public, anon, authenticated;

drop trigger if exists trg_leave_balances_corectie_incadrare on public.leave_balances;
create trigger trg_leave_balances_corectie_incadrare
  after update on public.leave_balances
  for each row execute function internal.leave_balances_corectie_incadrare();


-- ═════════════════════════════════════════════════════════════════════════════
-- 9. I5 — listă albă de audit pe leave_requests (art. 9 GDPR)
--
-- NU se atinge `internal.audit_forbidden_patterns()`: e lista greșită — un
-- '%certificat%' acolo ar face `attach_audit('leave_requests')` să eșueze
-- definitiv (garda R9), iar 'motiv' ar redacta și `motiv_respingere`, singurul
-- câmp pe care un control ITM chiar îl cere. Mecanismul e o funcție de căutare
-- + o modificare minimă în `internal.audit_trigger()`, păstrând UN SINGUR
-- trigger cu numele existent `audit_leave_requests` — nicio re-atașare, deci
-- o rulare viitoare a `attach_audit('leave_requests')` nu poate regresa lista.
--
-- `coalesce(..., 'null'::jsonb)` la comparația „s-a atins?” nu e cosmetic:
-- fără el, un câmp rămas NULL la INSERT (absent semantic, dar prezent ca
-- cheie JSON cu valoare `null`) apărea fals ca „atins” — verificat,
-- `atasament_path` apărea în listă la fiecare creare, chiar și fără atașament.
--
-- `atasament_path` se exclude deși nu apare explicit în lista scurtă din
-- sarcină: e o referință directă la scanul certificatului, aceeași dată
-- printr-o indirecție. `motiv_respingere` se PĂSTREAZĂ: e justificarea
-- deciziei administrative, nu diagnosticul.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function internal.audit_campuri_excluse(p_table text)
returns text[] language sql immutable set search_path = '' as $$
  select case p_table
    when 'leave_requests' then
      array['medical_code_id', 'serie_certificat', 'numar_certificat', 'motiv', 'atasament_path']
    else '{}'::text[]
  end;
$$;

revoke all on function internal.audit_campuri_excluse(text) from public, anon, authenticated;

comment on function internal.audit_campuri_excluse(text) is
  'Listă albă de câmpuri excluse din audit_logs, per tabelă (tg_table_name). Citită din tg_table_name, NU din TG_ARGV — o re-rulare a internal.attach_audit(tabelă) nu o poate șterge tăcut (0017).';

create or replace function internal.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after  jsonb;
  v_org    uuid;
  v_entity uuid;
  v_action public.audit_action;
  v_excluse text[];
  v_atinse  jsonb;
begin
  if tg_op = 'INSERT' then
    v_after  := internal.scrub_jsonb(to_jsonb(new));
    v_action := 'create';
  elsif tg_op = 'UPDATE' then
    if new is not distinct from old then
      return new;                      -- update no-op: nu poluăm jurnalul.
    end if;
    v_before := internal.scrub_jsonb(to_jsonb(old));
    v_after  := internal.scrub_jsonb(to_jsonb(new));
    v_action := case
      when v_before ? 'deleted_at'
       and v_before ->> 'deleted_at' is null
       and v_after  ->> 'deleted_at' is not null then 'delete'
      when v_before ? 'deleted_at'
       and v_before ->> 'deleted_at' is not null
       and v_after  ->> 'deleted_at' is null then 'restore'
      else 'update'
    end;
  else
    v_before := internal.scrub_jsonb(to_jsonb(old));
    v_action := 'delete';
  end if;

  v_org := nullif(coalesce(v_after ->> 'organization_id', v_before ->> 'organization_id', ''), '')::uuid;
  if v_org is null and tg_table_name = 'organizations' then
    v_org := nullif(coalesce(v_after ->> 'id', v_before ->> 'id', ''), '')::uuid;
  end if;
  v_entity := nullif(coalesce(v_after ->> 'id', v_before ->> 'id', ''), '')::uuid;

  -- 0017: listă albă de câmpuri excluse din jurnal (art. 9 GDPR, leave_requests).
  -- Pentru orice altă tabelă, internal.audit_campuri_excluse întoarce '{}' și
  -- blocul de mai jos nu face nimic — comportamentul celorlalte 22 de tabele
  -- audiate rămâne identic.
  v_excluse := internal.audit_campuri_excluse(tg_table_name);
  if array_length(v_excluse, 1) is not null then
    select coalesce(jsonb_agg(k order by k), '[]'::jsonb) into v_atinse
      from unnest(v_excluse) k
     where coalesce(v_after -> k, 'null'::jsonb) is distinct from coalesce(v_before -> k, 'null'::jsonb);
    v_before := (select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
                   from jsonb_each(v_before) e where not (e.key = any (v_excluse)));
    v_after  := (select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
                   from jsonb_each(v_after)  e where not (e.key = any (v_excluse)));
    if v_before = '{}'::jsonb then v_before := null; end if;
    if v_after  = '{}'::jsonb then v_after  := null; end if;
    if v_atinse <> '[]'::jsonb then
      v_after := coalesce(v_after, '{}'::jsonb) || jsonb_build_object('campuri_sensibile_atinse', v_atinse);
    end if;
  end if;

  insert into public.audit_logs
    (organization_id, actor_id, action, status, entity_type, entity_id,
     before, after, ip, user_agent, request_id)
  values
    (v_org, auth.uid(), v_action, 'success', tg_table_name, v_entity,
     v_before, v_after, internal.request_ip(),
     left(coalesce(internal.request_header('user-agent'), ''), 500),
     internal.request_header('x-request-id'));

  return coalesce(new, old);
end;
$$;


-- ── Verificare finală: nu s-a redeschis nimic din 0016 ────────────────────────
do $$
begin
  if exists (
    select 1 from information_schema.role_table_grants
     where grantee = 'authenticated' and table_schema = 'public'
       and table_name = 'approval_tasks' and privilege_type = 'INSERT'
  ) then
    raise exception '0017 a redeschis INSERT pe approval_tasks pentru authenticated — regresie pe 0016.';
  end if;

  if exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'leave_requests' and policyname = 'leave_requests_insert'
       and (with_check ilike '%zile_lucratoare = 0%' or with_check ilike '%zile_calendaristice = 0%')
  ) then
    raise exception '0017 nu a scos condițiile imposibile din leave_requests_insert.';
  end if;
end
$$;
