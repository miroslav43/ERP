-- supabase/migrations/0194_tichete_notificare_stare_in_romana.sql
--
-- NOTIFICAREA DE STARE A TICHETULUI SPUNE STAREA ÎN ROMÂNĂ.
--
-- ── DEFECTUL ────────────────────────────────────────────────────────────────
-- `internal.tickets_notifica` (0046, re-creată în 0188) scrie titlul
-- schimbării de stare cu codul enum brut: „Tichetul IT-2026-000123: in_lucru”,
-- „…: in_asteptare”. Solicitantul citește un identificator de bază de date în
-- clopoțel și în lista de notificări (FLX-006). Corpul pentru `in_asteptare`
-- era la persoana a doua singular („Se așteaptă răspunsul tău.”), contra
-- registrului aplicației (`docs/design/ecrane/glosar.md`). Iar catalogul de
-- module din bază, citit de consola de platformă, numea modulul „Ticketing IT”.
--
-- ── CE FACE ─────────────────────────────────────────────────────────────────
-- 1. Re-creează funcția cu corpul din 0188, neschimbat în rest, și DOUĂ
--    diferențe: titlul trece starea printr-un `case` cu etichete românești,
--    iar corpul pentru `in_asteptare` devine „Se așteaptă răspunsul
--    dumneavoastră.”. Triggerul existent rămâne legat (funcția își păstrează
--    numele și semnătura), deci nu se recreează.
-- 2. Rescrie notificările deja trimise (backfill): titlurile de tichet care se
--    termină în „: <cod>” primesc eticheta, iar corpul vechi la „tu” primește
--    forma formală. Volume mici — cea mai mare firmă are opt angajați.
-- 3. Aliniază catalogul `public.features` la `src/config/features.ts`:
--    „Tichete IT” (tiparul din 0153).
--
-- Forward-only: nu atinge 0046 și nici 0188. Proba pe banc:
-- `tests/rls/proba-aprobatori-membru.sql`, verificarea (6b).

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
      'Tichetul ' || new.numar_afisat || ': ' ||
        case new.status
          when 'nou' then 'nou'
          when 'in_aprobare' then 'în aprobare'
          when 'respins' then 'respins'
          when 'in_lucru' then 'în lucru'
          when 'in_asteptare' then 'așteaptă răspunsul dumneavoastră'
          when 'rezolvat' then 'rezolvat'
          when 'inchis' then 'închis'
          when 'anulat' then 'anulat'
          when 'redeschis' then 'redeschis'
          else new.status::text
        end,
      case when new.status = 'respins' then coalesce(new.motiv_respingere, new.titlu)
           when new.status = 'in_asteptare' then 'Se așteaptă răspunsul dumneavoastră.'
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

-- ── Backfill: notificările deja trimise ─────────────────────────────────────
-- Doar codurile care diferă de eticheta lor („nou”, „respins”, „rezolvat”,
-- „anulat”, „redeschis” se scriu la fel). `internal.guard_notifications`
-- (0002) îngheață `title`/`body` doar pentru `authenticated`/`anon`; migrarea
-- rulează ca proprietar, deci UPDATE-ul trece.
update public.notifications
   set title = regexp_replace(title, ': [a-z_]+$', '') || ': ' ||
         case substring(title from ': ([a-z_]+)$')
           when 'in_aprobare' then 'în aprobare'
           when 'in_lucru' then 'în lucru'
           when 'in_asteptare' then 'așteaptă răspunsul dumneavoastră'
           when 'inchis' then 'închis'
         end
 where entity_type = 'ticket'
   and title like 'Tichetul %'
   and title ~ ': (in_aprobare|in_lucru|in_asteptare|inchis)$';

update public.notifications
   set body = 'Se așteaptă răspunsul dumneavoastră.'
 where entity_type = 'ticket'
   and body = 'Se așteaptă răspunsul tău.';

-- ── Catalogul de module ─────────────────────────────────────────────────────
-- Numele din `src/config/features.ts` și din navigație s-a schimbat în același
-- commit; aici se aliniază catalogul din bază, citit de paginile super-admin.
update public.features
   set denumire = 'Tichete IT'
 where feature_key = 'ticketing';

commit;
