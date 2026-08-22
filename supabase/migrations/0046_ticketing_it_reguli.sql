-- supabase/migrations/0046_ticketing_it_reguli.sql
-- Prioritatea derivată, notificările, permisiunile și înregistrarea modulului.
-- Separat de 0045 ca migrația de structură să rămână citibilă.

begin;

-- ============================================================
-- 1. PRIORITATE DERIVATĂ
-- ============================================================
-- Angajatul NU alege prioritatea. Se calculează din ce a declarat, cu o
-- singură excepție: IT-ul o poate suprascrie manual, dar atunci
-- `prioritate_manuala` devine `true` și CHECK-ul din 0045 cere justificare.

create or replace function internal.tickets_calculeaza_prioritatea()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duplicate integer := 0;
begin
  -- Suprascrierea manuală are ultimul cuvânt; nu o recalculăm niciodată peste.
  if new.prioritate_manuala then
    return new;
  end if;

  if new.tip = 'defectiune' and coalesce(new.blocheaza_activitatea, false) then
    new.prioritate := 'ridicata';
    return new;
  end if;

  if new.tip = 'bug_erp' then
    select count(*) into v_duplicate
    from public.tickets d
    where d.parent_ticket_id = new.id and d.deleted_at is null;

    -- Câți oameni au lovit aceeași problemă e cel mai bun semnal de impact
    -- pe care îl avem fără triaj uman.
    new.prioritate := case
      when v_duplicate >= 5 then 'critica'::public.ticket_priority
      when v_duplicate >= 2 then 'ridicata'::public.ticket_priority
      else 'normala'::public.ticket_priority
    end;
    return new;
  end if;

  new.prioritate := 'normala';
  return new;
end;
$$;

revoke all on function internal.tickets_calculeaza_prioritatea() from public, anon, authenticated;

create trigger trg_tickets_calculeaza_prioritatea
  before insert or update of tip, blocheaza_activitatea, prioritate_manuala on public.tickets
  for each row execute function internal.tickets_calculeaza_prioritatea();

-- Marcarea unui tichet ca duplicat schimbă prioritatea PĂRINTELUI, nu a lui.
create or replace function internal.tickets_reactualizeaza_parintele()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_ticket_id is not null then
    update public.tickets set updated_at = now() where id = new.parent_ticket_id;
  end if;
  if tg_op = 'UPDATE' and old.parent_ticket_id is not null
     and old.parent_ticket_id is distinct from new.parent_ticket_id then
    update public.tickets set updated_at = now() where id = old.parent_ticket_id;
  end if;
  return null;
end;
$$;

revoke all on function internal.tickets_reactualizeaza_parintele() from public, anon, authenticated;

create trigger trg_tickets_reactualizeaza_parintele
  after insert or update of parent_ticket_id on public.tickets
  for each row execute function internal.tickets_reactualizeaza_parintele();

-- ============================================================
-- 2. NOTIFICĂRI
-- ============================================================
-- In-app, prin `public.notifications`, ca la pontaj (0042). Fără e-mail:
-- `EMAIL_MODE="test"` până la Faza 11, decizie din NOTES.md §1.

create or replace function internal.tickets_notifica()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_solicitant_user uuid;
  v_manager_user uuid;
  v_link text;
begin
  v_link := '/ticketing/' || new.id::text;

  select e.user_id into v_solicitant_user
  from public.employees e where e.id = new.solicitant_employee_id;

  -- Cerere nouă care are nevoie de aprobare → managerul direct.
  if tg_op = 'INSERT' and new.status = 'in_aprobare' then
    select sef.user_id into v_manager_user
    from public.employees subaltern
    join public.employees sef on sef.id = subaltern.manager_employee_id
    where subaltern.id = new.solicitant_employee_id and sef.deleted_at is null;

    if v_manager_user is not null then
      insert into public.notifications (user_id, organization_id, kind, title, body, link, entity_type, entity_id)
      values (v_manager_user, new.organization_id, 'approval',
              'Cerere IT de aprobat: ' || new.numar_afisat, new.titlu, v_link, 'ticket', new.id);
    end if;
    return null;
  end if;

  -- Schimbare de status → solicitantul, care altfel nu are de unde ști.
  if tg_op = 'UPDATE' and new.status is distinct from old.status and v_solicitant_user is not null then
    insert into public.notifications (user_id, organization_id, kind, title, body, link, entity_type, entity_id)
    values (
      v_solicitant_user, new.organization_id,
      case new.status when 'respins' then 'warning'::public.notification_kind
                      when 'rezolvat' then 'success'::public.notification_kind
                      when 'in_asteptare' then 'task'::public.notification_kind
                      else 'info'::public.notification_kind end,
      'Tichetul ' || new.numar_afisat || ': ' || new.status::text,
      case when new.status = 'respins' then coalesce(new.motiv_respingere, new.titlu)
           when new.status = 'in_asteptare' then 'Se așteaptă răspunsul tău.'
           else new.titlu end,
      v_link, 'ticket', new.id
    );
  end if;

  -- Bug rezolvat → toți cei care au raportat duplicate.
  if tg_op = 'UPDATE' and new.tip = 'bug_erp' and new.status = 'rezolvat'
     and old.status is distinct from 'rezolvat' then
    insert into public.notifications (user_id, organization_id, kind, title, body, link, entity_type, entity_id)
    select e.user_id, d.organization_id, 'success',
           'Problema raportată a fost rezolvată (' || new.numar_afisat || ')',
           new.titlu, v_link, 'ticket', new.id
    from public.tickets d
    join public.employees e on e.id = d.solicitant_employee_id
    where d.parent_ticket_id = new.id and d.deleted_at is null and e.user_id is not null;
  end if;

  return null;
end;
$$;

revoke all on function internal.tickets_notifica() from public, anon, authenticated;

create trigger trg_tickets_notifica
  after insert or update on public.tickets
  for each row execute function internal.tickets_notifica();

-- ============================================================
-- 3. ÎNCHIDERE AUTOMATĂ DUPĂ 5 ZILE ÎN „REZOLVAT"
-- ============================================================

create or replace function app.inchide_tichetele_rezolvate()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_numar integer;
begin
  with inchise as (
    update public.tickets
       set status = 'inchis'
     where status = 'rezolvat'
       and deleted_at is null
       and updated_at < now() - interval '5 days'
    returning 1
  )
  select count(*) into v_numar from inchise;
  return v_numar;
end;
$$;

revoke all on function app.inchide_tichetele_rezolvate() from public, anon, authenticated;

comment on function app.inchide_tichetele_rezolvate() is
  'Închide tichetele lăsate în „rezolvat” mai mult de 5 zile. Programarea în pg_cron e mai jos, comentată — se activează manual, ca la 0042.';

-- Programarea rămâne comentată deliberat, ca în 0042: se activează conștient,
-- după ce modulul e verificat pe date reale.
-- select cron.schedule(
--   'inchide-tichete-rezolvate', '0 3 * * *',
--   $cron$ select app.inchide_tichetele_rezolvate(); $cron$
-- );

-- ============================================================
-- 4. PERMISIUNI
-- ============================================================
-- Resursă nouă `tickets`, cu acțiunile deja folosite în aplicație. NU se adaugă
-- roluri noi în `app_role`: modelul cerut are aprobare de la managerul direct
-- sau de la patron, amândoi existenți. Algebra de scope-uri face restul —
-- angajatul „own”, managerul „team”, patronul „all”.

insert into public.role_permissions (organization_id, role, resource, action, scope) values
  (null, 'employee',  'tickets', 'read',    'own'),
  (null, 'employee',  'tickets', 'create',  'own'),
  (null, 'employee',  'tickets', 'update',  'own'),
  (null, 'manager',   'tickets', 'read',    'team'),
  (null, 'manager',   'tickets', 'create',  'own'),
  (null, 'manager',   'tickets', 'update',  'team'),
  (null, 'manager',   'tickets', 'approve', 'team'),
  (null, 'hr',        'tickets', 'read',    'own'),
  (null, 'hr',        'tickets', 'create',  'own'),
  (null, 'hr',        'tickets', 'update',  'own'),
  (null, 'org_admin', 'tickets', 'read',    'all'),
  (null, 'org_admin', 'tickets', 'create',  'own'),
  (null, 'org_admin', 'tickets', 'update',  'all'),
  (null, 'org_admin', 'tickets', 'approve', 'all'),
  (null, 'org_admin', 'tickets', 'delete',  'all')
-- `where deleted_at is null` e obligatoriu: indexul unic din 0001 e parțial,
-- iar ON CONFLICT nu poate deduce un index parțial fără predicatul lui.
on conflict (organization_id, role, resource, action) where deleted_at is null do nothing;

-- ============================================================
-- 5. MODULUL
-- ============================================================

insert into public.features (feature_key, denumire, descriere, icon, grup, is_core, sort_order)
values (
  'ticketing', 'Ticketing IT',
  'Solicitări către IT: software, hardware, defecțiuni pe obiectele din inventar și raportarea bug-urilor din aplicație.',
  'life-buoy', 'operations', false, 140
)
on conflict (feature_key) do nothing;

commit;
