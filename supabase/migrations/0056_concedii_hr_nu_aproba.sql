-- supabase/migrations/0056_concedii_hr_nu_aproba.sql
-- Redenumită din 0054: între timp amonte a ocupat 0054 și 0055 cu migrări de
-- salarizare. Convenția din CLAUDE.md la coliziune: îți redenumești PROPRIA
-- migrare. Conținutul e neschimbat și a fost deja rulat sub numele vechi.
-- Aprobă doar managerul direct și patronul. HR-ul primește cererea DUPĂ ce a
-- fost aprobată, ca s-o înregistreze — nu decide asupra ei.
--
-- Până acum `hr` avea `leave:approve = all` din seed-ul global (0002), deci
-- apărea ca aprobator alături de manager și de patroni. Pe organizația de
-- demonstrație asta însemna patru aprobatori pentru o singură cerere: managerul
-- direct, DOI org_admin și HR-ul.
--
-- HR-ul păstrează `leave:read/create/update/delete/export = all`. Pierde exact
-- un lucru: dreptul de a decide. Poate în continuare să vadă, să înregistreze
-- și să corecteze concediile — care e chiar rolul lui după aprobare.

begin;

-- ============================================================
-- 1. HR NU MAI APROBĂ
-- ============================================================
-- `none` = REFUZ EXPLICIT, nu absența rândului. Ștergerea rândului ar da
-- același efect azi, dar `none` spune intenția: cineva s-a gândit la HR și a
-- decis că nu aprobă, spre deosebire de „nu s-a configurat niciodată”.

update public.role_permissions
  set scope = 'none', updated_at = now()
where organization_id is null
  and role = 'hr'
  and resource = 'leave'
  and action = 'approve'
  and deleted_at is null;

-- ============================================================
-- 2. SARCINILE DESCHISE ALE HR-ULUI
-- ============================================================
-- Cererile aflate în curs au deja o sarcină pentru HR, creată sub regula veche.
-- Fără curățare, HR-ul ar rămâne aprobator pe ele — și ar putea decide, fiindcă
-- sarcina există deja, chiar dacă permisiunea nu-l mai îndreptățește.
--
-- Un membru are UN singur rol pe organizație, deci cine e `hr` a ajuns
-- aprobator exclusiv prin `leave:approve = all` al rolului. Nu există risc să
-- ștergem sarcina cuiva care era și manager direct.
--
-- Se ȘTERG LOGIC, nu se anulează prin status: `internal.approval_tasks_anuleaza_surori`
-- pornește la orice ieșire din 'in_asteptare' și ar anula toate surorile de la
-- aceeași ordine — adică exact aprobatorii pe care vrem să-i păstrăm.

update public.approval_tasks t
  set deleted_at = now(), updated_at = now()
  from public.organization_members m
where m.user_id = t.approver_user_id
  and m.organization_id = t.organization_id
  and m.role = 'hr'
  and m.deleted_at is null
  and t.entity_type = 'leave_request'
  and t.status = 'in_asteptare'
  and t.deleted_at is null;

-- ============================================================
-- 3. CEREREA APROBATĂ AJUNGE LA HR
-- ============================================================
-- Notificare, nu treaptă de aprobare: HR-ul e informat că are ceva de
-- înregistrat, nu întrebat dacă e de acord. O treaptă suplimentară ar fi
-- readus exact problema pe care 0053 a rezolvat-o.
--
-- Se notifică pe ROL, nu pe permisiune: `leave:update = all` îl are și
-- `org_admin`, iar patronul care tocmai a aprobat n-are nevoie să fie anunțat
-- de propria decizie.

create or replace function internal.leave_requests_notifica_hr()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nume text;
  v_tip  text;
begin
  if new.status <> 'aprobata' or old.status is not distinct from new.status then
    return null;
  end if;

  select e.full_name into v_nume from public.employees e where e.id = new.employee_id;
  select lt.denumire into v_tip from public.leave_types lt where lt.id = new.leave_type_id;

  insert into public.notifications
    (organization_id, user_id, kind, title, body, link, entity_type, entity_id)
  select new.organization_id, m.user_id, 'task'::public.notification_kind,
        'Concediu aprobat, de înregistrat',
        coalesce(v_nume, 'Un angajat') || coalesce(' — ' || v_tip, '') || ', perioada '
          || to_char(new.data_inceput, 'DD.MM.YYYY') || ' – '
          || to_char(new.data_sfarsit, 'DD.MM.YYYY') || '.',
        '/concedii/' || new.id::text,
        'leave_request', new.id
    from public.organization_members m
  where m.organization_id = new.organization_id
    and m.role = 'hr'
    and m.status = 'active'
    and m.deleted_at is null
    and m.user_id is not null
    -- Dacă HR-ul e chiar solicitantul, a aflat deja din notificarea de decizie.
    and m.user_id is distinct from (
      select e.user_id from public.employees e where e.id = new.employee_id
    );

  return null;
end;
$$;

revoke all on function internal.leave_requests_notifica_hr() from public, anon, authenticated;

-- Prefixul `z`: Postgres execută triggerele în ordine alfabetică, iar acesta
-- trebuie să ruleze după cele din 0048, care tratează decizia către solicitant.
create trigger trg_zleave_requests_notifica_hr
  after update of status on public.leave_requests
  for each row execute function internal.leave_requests_notifica_hr();

commit;
