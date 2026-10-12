-- supabase/migrations/0191_notificari_fluxuri_lipsa.sql
--
-- NOTIFICĂRILE CARE LIPSEAU DIN FLUXURI, ȘI CELE CARE RĂMÂNEAU „DE APROBAT”.
--
-- ── DEFECTELE (campania QA din 8 oct 2026) ──────────────────────────────────
-- FLX-011 / MGR-021: notificarea „de aprobat” a aprobatorului rămânea NECITITĂ
--   după decizie — clopoțelul managerului arăta „22 necitite” pentru cereri
--   deja aprobate, respinse sau retrase. Nimic din bază nu scria `read_at` în
--   afara clicului omului (`notificari/actions.ts`): zero `read_at` în 190 de
--   migrări. Contorul nu urma lista.
-- FLX-005: tichetul repartizat nu anunța nici solicitantul, nici asignatul
--   (`asigneaza` scrie doar `asignat_employee_id`, iar `tickets_notifica`
--   ascultă doar statusul); răspunsurile pe tichet nu anunțau pe nimeni
--   (`ticket_comments` avea doar `set_actor`/`set_updated_at`, 0045:292–294).
-- FLX-011: notificarea de concediu respins nu purta motivul, deși
--   `decideCerere` îl scrie în ACELAȘI UPDATE cu statusul.
--
-- ── CE FACE ─────────────────────────────────────────────────────────────────
-- Doar funcții `internal.*` și triggere; nicio tabelă, coloană, enum sau
-- politică nouă. Regula de plasare, consecventă cu ce există: evenimentul e o
-- tranziție de rând în bază ⇒ trigger (concedii 0048, tichete 0046/0188,
-- pontaj săptămânal 0042/0118). Ce trăiește doar în acțiune — diurna, pontajul
-- lunar, înrolarea — e TS lângă producător, în același commit.
--
--   §1 `approval_tasks`: sarcina care iese din `in_asteptare` (decisă, sau
--      anulată de `trg_approval_tasks_anuleaza_surori` / 0058) marchează
--      citite notificările aprobatorului ei pe aceeași entitate — concedii,
--      pontaj săptămânal, inclusiv mementourile `reminder` din 0042/0166.
--   §2 `tickets.status`: ieșirea din `in_aprobare` închide `approval`-ul
--      managerului direct (tichetele nu folosesc `approval_tasks`).
--   §3 `tickets.asignat_employee_id`: repartizarea anunță solicitantul (info)
--      și asignatul (task), fără cel care a făcut gestul.
--   §4 `ticket_comments`: comentariul public anunță cealaltă parte; nota
--      internă nu produce nimic. Răspunsul solicitantului pe un tichet fără
--      asignat merge la toți membrii cu `tickets:update = all`.
--   §5 `internal.leave_requests_notifica_decizia`: corpul din 0048 §3, cu
--      motivul în corp la respingere.
--
-- `read_at` nu e probatoriu (0001:711, minimizare), deci marcarea automată
-- nu pierde nimic din audit. Forward-only: nu atinge 0046/0048/0188.
-- Proba pe banc: `tests/rls/proba-notificari-fluxuri.sql`.

begin;

-- ============================================================
-- 1. SARCINA DECISĂ SAU ANULATĂ ÎȘI ÎNCHIDE NOTIFICAREA
-- ============================================================
-- Generic pe `entity_type`/`entity_id`: notificările aprobatorilor (0042,
-- 0048, 0118, 0166) poartă exact entitatea sarcinii. Se filtrează pe
-- DESTINATAR, nu pe `kind`: aprobatorul primește și `reminder`, și `approval`
-- pe aceeași cerere, iar după decizie niciuna nu mai e actuală.

create or replace function internal.approval_tasks_inchide_notificarea()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'in_asteptare'
     and new.status <> 'in_asteptare'
     and new.approver_user_id is not null then
    update public.notifications
       set read_at = now(), updated_at = now()
     where user_id = new.approver_user_id
       and entity_type = new.entity_type
       and entity_id = new.entity_id
       and read_at is null
       and deleted_at is null;
  end if;
  return null;
end;
$$;

revoke all on function internal.approval_tasks_inchide_notificarea() from public, anon, authenticated;

-- `zz`: după `trg_approval_tasks_anuleaza_surori` (care anulează surorile și
-- declanșează, la rândul lui, triggerul ăsta pe fiecare soră) și după
-- `trg_zapproval_tasks_notifica_treapta_urmatoare`.
drop trigger if exists trg_zzapproval_tasks_inchide_notificarea on public.approval_tasks;
create trigger trg_zzapproval_tasks_inchide_notificarea
  after update of status on public.approval_tasks
  for each row execute function internal.approval_tasks_inchide_notificarea();

-- ============================================================
-- 2. TICHETUL DECIS ÎNCHIDE „CEREREA IT DE APROBAT”
-- ============================================================
-- Destinatarul e managerul direct, din 0046; orice ieșire din `in_aprobare`
-- (decizie sau anulare de către solicitant) face notificarea inactuală.

create or replace function internal.tickets_inchide_notificarea_de_aprobat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'in_aprobare' and new.status <> 'in_aprobare' then
    update public.notifications
       set read_at = now(), updated_at = now()
     where entity_type = 'ticket'
       and entity_id = new.id
       and kind = 'approval'
       and read_at is null
       and deleted_at is null;
  end if;
  return null;
end;
$$;

revoke all on function internal.tickets_inchide_notificarea_de_aprobat() from public, anon, authenticated;

drop trigger if exists trg_tickets_zinchide_notificarea_de_aprobat on public.tickets;
create trigger trg_tickets_zinchide_notificarea_de_aprobat
  after update of status on public.tickets
  for each row execute function internal.tickets_inchide_notificarea_de_aprobat();

-- ============================================================
-- 3. REPARTIZAREA ANUNȚĂ SOLICITANTUL ȘI ASIGNATUL
-- ============================================================
-- Fără cel care a făcut gestul (tiparul `internal.mentenanta_notifica`, 0181):
-- un operator care își ia singur tichetul nu-și scrie o sarcină sieși.

create or replace function internal.tickets_notifica_repartizarea()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu               uuid := auth.uid();
  v_solicitant_user  uuid;
  v_asignat_user     uuid;
  v_asignat_nume     text;
  v_link             text := '/ticketing/' || new.id::text;
begin
  if new.asignat_employee_id is null
     or new.asignat_employee_id is not distinct from old.asignat_employee_id then
    return null;
  end if;

  select e.user_id, e.full_name into v_asignat_user, v_asignat_nume
    from public.employees e where e.id = new.asignat_employee_id;
  select e.user_id into v_solicitant_user
    from public.employees e where e.id = new.solicitant_employee_id;

  if v_solicitant_user is not null
     and v_solicitant_user is distinct from v_eu
     and v_solicitant_user is distinct from v_asignat_user then
    insert into public.notifications (user_id, organization_id, kind, title, body, link, entity_type, entity_id)
    values (v_solicitant_user, new.organization_id, 'info',
            left('Tichetul ' || new.numar_afisat || ' a fost repartizat', 200),
            left(coalesce(v_asignat_nume, 'Un coleg') || ' se ocupă de „' || new.titlu || '”.', 4000),
            v_link, 'ticket', new.id);
  end if;

  if v_asignat_user is not null and v_asignat_user is distinct from v_eu then
    insert into public.notifications (user_id, organization_id, kind, title, body, link, entity_type, entity_id)
    values (v_asignat_user, new.organization_id, 'task',
            left('Tichet repartizat dumneavoastră: ' || new.numar_afisat, 200),
            left(new.titlu, 4000),
            v_link, 'ticket', new.id);
  end if;

  return null;
end;
$$;

revoke all on function internal.tickets_notifica_repartizarea() from public, anon, authenticated;

drop trigger if exists trg_tickets_znotifica_repartizarea on public.tickets;
create trigger trg_tickets_znotifica_repartizarea
  after update of asignat_employee_id on public.tickets
  for each row execute function internal.tickets_notifica_repartizarea();

-- ============================================================
-- 4. COMENTARIUL PUBLIC ANUNȚĂ CEALALTĂ PARTE
-- ============================================================
-- · nota internă (`intern = true`) nu produce nimic — e invizibilă
--   solicitantului prin RLS, iar echipa o vede pe tichet;
-- · autorul e solicitantul ⇒ asignatul; fără asignat ⇒ membrii activi cu
--   `tickets:update = all` (`internal.scope_membru`, 0189 — rândul de membru
--   bate rolul), adică cine poate prelua tichetul;
-- · altfel ⇒ solicitantul.
-- Autorul nu se anunță pe sine, nici prin fișă (`autor_employee_id`), nici
-- prin sesiune (`auth.uid()`). Corpul e începutul mesajului, nu tot.
--
-- Cunoscut: `aplicaMacro` (ticketing/actions.ts) inserează un comentariu
-- public și apoi schimbă statusul — solicitantul primește două notificări la
-- o apăsare. La volumele reale (cea mai mare firmă are 8 angajați) e
-- acceptabil; o gardă pe sursă n-are unde sta în rând.

create or replace function internal.ticket_comments_notifica()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu          uuid := auth.uid();
  v_autor_user  uuid;
  v_destinatar  uuid;
  v_t           record;
  v_link        text;
  v_corp        text;
begin
  if new.intern then
    return null;
  end if;

  select t.id, t.organization_id, t.numar_afisat, t.titlu,
         t.solicitant_employee_id, t.asignat_employee_id
    into v_t
    from public.tickets t
   where t.id = new.ticket_id;
  if not found then
    return null;
  end if;

  v_link := '/ticketing/' || v_t.id::text;
  v_corp := left(new.continut, 300);

  if new.autor_employee_id is not null then
    select e.user_id into v_autor_user
      from public.employees e where e.id = new.autor_employee_id;
  end if;

  if new.autor_employee_id is not null
     and new.autor_employee_id = v_t.solicitant_employee_id then
    -- Răspunsul solicitantului → cine se ocupă de tichet.
    if v_t.asignat_employee_id is not null then
      select e.user_id into v_destinatar
        from public.employees e where e.id = v_t.asignat_employee_id;
      if v_destinatar is not null
         and v_destinatar is distinct from v_autor_user
         and v_destinatar is distinct from v_eu then
        insert into public.notifications (user_id, organization_id, kind, title, body, link, entity_type, entity_id)
        values (v_destinatar, v_t.organization_id, 'info',
                left('Răspuns nou pe tichetul ' || v_t.numar_afisat, 200),
                v_corp, v_link, 'ticket', v_t.id);
      end if;
    else
      insert into public.notifications (user_id, organization_id, kind, title, body, link, entity_type, entity_id)
      select m.user_id, v_t.organization_id, 'info',
             left('Răspuns nou pe tichetul ' || v_t.numar_afisat, 200),
             v_corp, v_link, 'ticket', v_t.id
        from public.organization_members m
       where m.organization_id = v_t.organization_id
         and m.status = 'active'
         and m.deleted_at is null
         and m.user_id is distinct from v_autor_user
         and m.user_id is distinct from v_eu
         and internal.scope_membru(v_t.organization_id, m.user_id, 'tickets', 'update') = 'all';
    end if;
  else
    -- Răspunsul echipei → solicitantul, care altfel nu are de unde ști.
    select e.user_id into v_destinatar
      from public.employees e where e.id = v_t.solicitant_employee_id;
    if v_destinatar is not null
       and v_destinatar is distinct from v_autor_user
       and v_destinatar is distinct from v_eu then
      insert into public.notifications (user_id, organization_id, kind, title, body, link, entity_type, entity_id)
      values (v_destinatar, v_t.organization_id, 'info',
              left('Răspuns la tichetul ' || v_t.numar_afisat, 200),
              v_corp, v_link, 'ticket', v_t.id);
    end if;
  end if;

  return null;
end;
$$;

revoke all on function internal.ticket_comments_notifica() from public, anon, authenticated;

drop trigger if exists trg_ticket_comments_znotifica on public.ticket_comments;
create trigger trg_ticket_comments_znotifica
  after insert on public.ticket_comments
  for each row execute function internal.ticket_comments_notifica();

-- ============================================================
-- 5. CONCEDIUL RESPINS POARTĂ MOTIVUL
-- ============================================================
-- Corpul din 0048 §3, neschimbat în rest. `decideCerere` scrie
-- `motiv_respingere` în același UPDATE cu statusul (concedii/actions.ts),
-- deci `new.motiv_respingere` e populat când rulează triggerul; constrângerea
-- `leave_requests_respingere_ck` (0009) îl cere oricum de cel puțin 5
-- caractere, iar „nespecificat” rămâne doar plasă.

create or replace function internal.leave_requests_notifica_decizia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_perioada text;
begin
  if new.status not in ('aprobata', 'respinsa') or old.status is not distinct from new.status then
    return null;
  end if;

  select e.user_id into v_user from public.employees e where e.id = new.employee_id;
  if v_user is null then
    return null;
  end if;

  v_perioada := 'Perioada ' || to_char(new.data_inceput, 'DD.MM.YYYY') || ' – '
    || to_char(new.data_sfarsit, 'DD.MM.YYYY') || '.';

  insert into public.notifications
    (organization_id, user_id, kind, title, body, link, entity_type, entity_id)
  values (
    new.organization_id, v_user,
    case new.status when 'aprobata' then 'success'::public.notification_kind
                    else 'warning'::public.notification_kind end,
    case new.status when 'aprobata' then 'Cererea de concediu a fost aprobată'
                    else 'Cererea de concediu a fost respinsă' end,
    case new.status
      when 'aprobata' then v_perioada
      else left(v_perioada || ' Motiv: '
             || rtrim(btrim(coalesce(nullif(btrim(new.motiv_respingere), ''), 'nespecificat')), '.')
             || '.', 4000)
    end,
    '/concedii/' || new.id::text,
    'leave_request', new.id
  );

  return null;
end;
$$;

revoke all on function internal.leave_requests_notifica_decizia() from public, anon, authenticated;

commit;
