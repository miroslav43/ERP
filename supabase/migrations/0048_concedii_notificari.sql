-- supabase/migrations/0048_concedii_notificari.sql
-- Concediile nu emiteau nicio notificare. Nu era o defecțiune: pur și simplu
-- nu s-a construit niciodată. `insert into public.notifications` exista în
-- toată baza doar în 0042 (pontaj) și 0046 (ticketing).
--
-- Efectul: un angajat trimitea cererea, sarcina de aprobare se crea corect
-- pentru managerul direct — verificat pe date reale — dar managerul nu afla
-- decât dacă intra din proprie inițiativă în ecranul de aprobări. Iar
-- angajatul nu afla niciodată că cererea i-a fost aprobată sau respinsă.
--
-- Tiparul e copiat din 0042, care rezolvă aceeași problemă pentru pontaj:
-- triggere `after` pe tabelele existente, care scriu în `public.notifications`.
-- NU se atinge `internal.leave_requests_sincronizeaza` — aceea creează
-- sarcinile de aprobare și e logică de business; notificarea e un efect
-- secundar și stă separat, ca să nu se rupă una când se schimbă cealaltă.

begin;

-- ============================================================
-- 1. CERERE TRIMISĂ → APROBATORII
-- ============================================================
-- Se notifică destinatarii sarcinilor deschise, nu „managerul”: aprobatorul
-- poate fi altcineva decât managerul direct (pas pe rol sau pe permisiune),
-- iar sarcinile sunt deja rezolvate de `internal.rezolva_aprobatori`. Cine are
-- sarcină, primește notificare — fără a doua interpretare a fluxului.

create or replace function internal.leave_requests_notifica_aprobatorii()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nume text;
  v_tip  text;
begin
  if new.status <> 'trimisa' or (tg_op = 'UPDATE' and old.status is not distinct from 'trimisa') then
    return null;
  end if;

  select e.full_name into v_nume from public.employees e where e.id = new.employee_id;
  select lt.denumire into v_tip from public.leave_types lt where lt.id = new.leave_type_id;

  -- Doar sarcinile de la treapta curentă minimă: la un flux cu mai multe
  -- trepte, al doilea aprobator nu are ce face până nu decide primul, iar o
  -- notificare acum ar fi zgomot.
  insert into public.notifications
    (organization_id, user_id, kind, title, body, link, entity_type, entity_id)
  select distinct new.organization_id, t.approver_user_id, 'approval'::public.notification_kind,
         'Cerere de concediu de aprobat',
         coalesce(v_nume, 'Un angajat') || ' a trimis o cerere'
           || coalesce(' de ' || v_tip, '') || ' pentru perioada '
           || to_char(new.data_inceput, 'DD.MM.YYYY') || ' – '
           || to_char(new.data_sfarsit, 'DD.MM.YYYY') || '.',
         '/concedii/aprobari',
         'leave_request', new.id
    from public.approval_tasks t
   where t.entity_type = 'leave_request'
     and t.entity_id = new.id
     and t.status = 'in_asteptare'
     and t.deleted_at is null
     and t.approver_user_id is not null
     -- Nu ne notificăm pe noi înșine: un manager care își trimite propria
     -- cerere e adesea și aprobator pe treapta lui.
     and t.approver_user_id is distinct from (
       select e.user_id from public.employees e where e.id = new.employee_id
     )
     and t.ordine = (
       select min(t2.ordine) from public.approval_tasks t2
        where t2.entity_type = 'leave_request' and t2.entity_id = new.id
          and t2.status = 'in_asteptare' and t2.deleted_at is null
     );

  return null;
end;
$$;

revoke all on function internal.leave_requests_notifica_aprobatorii() from public, anon, authenticated;

-- `after`, și DUPĂ trigger-ul care creează sarcinile: numele contează, pentru
-- că Postgres execută triggerele în ordine alfabetică. `trg_leave_requests_*`
-- de sincronizare există deja; „z” garantează că sarcinile sunt scrise când
-- ajungem aici, altfel interogarea de mai sus n-ar găsi nimic.
create trigger trg_zleave_requests_notifica_aprobatorii
  after insert or update of status on public.leave_requests
  for each row execute function internal.leave_requests_notifica_aprobatorii();

-- ============================================================
-- 2. TREAPTA URMĂTOARE → APROBATORII EI
-- ============================================================
-- La un flux cu mai multe trepte, statusul cererii NU se schimbă când decide
-- primul aprobator: rămâne „trimisă” până se aprobă tot (vezi comentariul din
-- `concedii/actions.ts`, pasul 5 — angajatul păstrează dreptul de anulare).
-- Prin urmare trigger-ul de mai sus, care ascultă `leave_requests.status`, nu
-- s-ar declanșa niciodată pentru treapta a doua. Ascultăm sarcinile.
--
-- Se filtrează pe `entity_type = 'leave_request'`: tabelul e comun cu pontajul,
-- care își are propriile notificări în 0042 și n-are nevoie de încă un rând.

create or replace function internal.approval_tasks_notifica_treapta_urmatoare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ordine_urmatoare smallint;
  v_cerere record;
  v_nume text;
begin
  if new.entity_type <> 'leave_request'
     or old.status is not distinct from new.status
     or new.status <> 'aprobata' then
    return null;
  end if;

  select min(t.ordine) into v_ordine_urmatoare
    from public.approval_tasks t
   where t.entity_type = 'leave_request' and t.entity_id = new.entity_id
     and t.status = 'in_asteptare' and t.deleted_at is null;

  -- Nicio sarcină deschisă = cererea tocmai s-a aprobat complet; solicitantul e
  -- notificat de trigger-ul de pe `leave_requests`, nu de aici.
  if v_ordine_urmatoare is null then
    return null;
  end if;

  select r.id, r.organization_id, r.employee_id, r.data_inceput, r.data_sfarsit
    into v_cerere
    from public.leave_requests r
   where r.id = new.entity_id;
  if not found then
    return null;
  end if;

  select e.full_name into v_nume
    from public.employees e where e.id = v_cerere.employee_id;

  insert into public.notifications
    (organization_id, user_id, kind, title, body, link, entity_type, entity_id)
  select distinct v_cerere.organization_id, t.approver_user_id,
         'approval'::public.notification_kind,
         'Cerere de concediu de aprobat',
         coalesce(v_nume, 'Un angajat') || ' — cererea a trecut de treapta anterioară și așteaptă '
           || 'decizia ta pentru perioada ' || to_char(v_cerere.data_inceput, 'DD.MM.YYYY')
           || ' – ' || to_char(v_cerere.data_sfarsit, 'DD.MM.YYYY') || '.',
         '/concedii/aprobari',
         'leave_request', v_cerere.id
    from public.approval_tasks t
   where t.entity_type = 'leave_request' and t.entity_id = new.entity_id
     and t.status = 'in_asteptare' and t.deleted_at is null
     and t.ordine = v_ordine_urmatoare
     and t.approver_user_id is not null
     and t.approver_user_id is distinct from (
       select e.user_id from public.employees e where e.id = v_cerere.employee_id
     );

  return null;
end;
$$;

revoke all on function internal.approval_tasks_notifica_treapta_urmatoare()
  from public, anon, authenticated;

create trigger trg_zapproval_tasks_notifica_treapta_urmatoare
  after update of status on public.approval_tasks
  for each row execute function internal.approval_tasks_notifica_treapta_urmatoare();

-- ============================================================
-- 3. DECIZIE → SOLICITANTUL
-- ============================================================

create or replace function internal.leave_requests_notifica_decizia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if new.status not in ('aprobata', 'respinsa') or old.status is not distinct from new.status then
    return null;
  end if;

  select e.user_id into v_user from public.employees e where e.id = new.employee_id;
  if v_user is null then
    return null;
  end if;

  insert into public.notifications
    (organization_id, user_id, kind, title, body, link, entity_type, entity_id)
  values (
    new.organization_id, v_user,
    case new.status when 'aprobata' then 'success'::public.notification_kind
                    else 'warning'::public.notification_kind end,
    case new.status when 'aprobata' then 'Cererea de concediu a fost aprobată'
                    else 'Cererea de concediu a fost respinsă' end,
    'Perioada ' || to_char(new.data_inceput, 'DD.MM.YYYY') || ' – '
      || to_char(new.data_sfarsit, 'DD.MM.YYYY') || '.',
    '/concedii/' || new.id::text,
    'leave_request', new.id
  );

  return null;
end;
$$;

revoke all on function internal.leave_requests_notifica_decizia() from public, anon, authenticated;

create trigger trg_zleave_requests_notifica_decizia
  after update of status on public.leave_requests
  for each row execute function internal.leave_requests_notifica_decizia();

commit;
