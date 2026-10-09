-- supabase/migrations/0188_tichete_notifica_duplicatul.sql
--
-- „PROBLEMA RAPORTATĂ A FOST REZOLVATĂ” DUCE LA TICHETUL PROPRIU.
--
-- ── DEFECTUL ────────────────────────────────────────────────────────────────
-- Când un bug (`tip = bug_erp`) ajunge `rezolvat`, `internal.tickets_notifica`
-- (0046) anunță pe fiecare om care a raportat un DUPLICAT — dar cu
-- `link = '/ticketing/' || new.id` și `entity_id = new.id`, adică TICHETUL
-- PĂRINTE. Autorul duplicatului apasă și ajunge pe fișa altcuiva, pe care RLS
-- i-o poate ascunde (`tickets_select` pe `own` îi arată doar tichetele lui):
-- un 404 după o veste bună (analiza 2026-10-08, notificari-O3). Traducerea la
-- randare nu poate repara: notificarea nu poartă id-ul duplicatului.
--
-- ── CE FACE ─────────────────────────────────────────────────────────────────
-- Corpul din 0046, neschimbat în rest; blocul duplicatelor scrie linkul și
-- entitatea DUPLICATULUI (`d.id`), iar titlul numește numărul lui — ce vede
-- omul în lista lui — și, în corp, numărul originalului rezolvat.
--
-- Forward-only: nu atinge 0046. Proba pe banc:
-- `tests/rls/proba-aprobatori-membru.sql` (secțiunea tichete).

begin;

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

  -- Bug rezolvat → toți cei care au raportat duplicate. Linkul și entitatea
  -- sunt ale DUPLICATULUI fiecăruia: pe el îl poate deschide omul, și pe el
  -- îl recunoaște din lista lui. Originalul rămâne numit în text.
  if tg_op = 'UPDATE' and new.tip = 'bug_erp' and new.status = 'rezolvat'
     and old.status is distinct from 'rezolvat' then
    insert into public.notifications (user_id, organization_id, kind, title, body, link, entity_type, entity_id)
    select e.user_id, d.organization_id, 'success',
           'Problema raportată a fost rezolvată (' || d.numar_afisat || ')',
           new.titlu || ' — rezolvată prin ' || new.numar_afisat || '.',
           '/ticketing/' || d.id::text, 'ticket', d.id
    from public.tickets d
    join public.employees e on e.id = d.solicitant_employee_id
    where d.parent_ticket_id = new.id and d.deleted_at is null and e.user_id is not null;
  end if;

  return null;
end;
$$;

revoke all on function internal.tickets_notifica() from public, anon, authenticated;

commit;
