-- supabase/migrations/0194_tichete_notificare_stare_in_romana.sql
--
-- NOTIFICAREA DE STARE A TICHETULUI SPUNE STAREA ÎN ROMÂNĂ, RĂMÂNE ÎN FIRMĂ
-- ȘI AJUNGE LA CEALALTĂ PARTE.
--
-- ── DEFECTELE ───────────────────────────────────────────────────────────────
-- `internal.tickets_notifica` (0046, re-creată în 0188) scrie titlul
-- schimbării de stare cu codul enum brut: „Tichetul IT-2026-000123: in_lucru”,
-- „…: in_asteptare”. Solicitantul citește un identificator de bază de date în
-- clopoțel și în lista de notificări (FLX-006). Corpul pentru `in_asteptare`
-- era la persoana a doua singular („Se așteaptă răspunsul tău.”), contra
-- registrului aplicației (`docs/design/ecrane/glosar.md`). Iar catalogul de
-- module din bază, citit de consola de platformă, numea modulul „Ticketing IT”.
--
-- Revizuirea de integrare (L3) a mai găsit două, în același corp:
-- · granița de firmă: funcția e SECURITY DEFINER, iar cheile străine pe care
--   le urmează (`solicitant_employee_id`, `manager_employee_id`,
--   `parent_ticket_id`) NU sunt compuse cu `organization_id`. Un operator
--   (`tickets_pazeste_campurile` îl lasă să schimbe solicitantul) putea pune
--   fișa unui om din altă firmă pe un tichet și scria apoi, la fiecare
--   schimbare de stare, în clopoțelul (și pe telefonul, prin push) lui. 0192
--   a închis exact clasa asta în §3–§5; corpul din 0188 copiat aici o
--   redeschidea.
-- · cine află: solicitantul care își redeschide sau își închide tichetul din
--   portal (`tranzitiiSolicitantului`) primea notificare despre propriul gest,
--   iar operatorul nu afla nimic — tichetul redeschis stătea nevăzut.
--
-- ── CE FACE ─────────────────────────────────────────────────────────────────
-- 1. Re-creează funcția pe corpul din 0188, cu:
--    · titlul stării printr-un `case` cu etichete românești, iar corpul pentru
--      `in_asteptare` „Se așteaptă răspunsul dumneavoastră.”;
--    · fiecare citire din `employees` (și din `tickets`, pe ramura
--      duplicatelor) filtrată pe firma rândului — tiparul din 0192;
--    · tiparul 0192 §3/§4 pe schimbarea de stare: autorul gestului
--      (`auth.uid()`) nu se anunță pe sine; când autorul e solicitantul și
--      tichetul era deja în coada echipei, anunță asignatul, iar fără asignat
--      membrii cu `tickets:update = all` (`internal.scope_membru`, 0189).
--    Triggerul existent rămâne legat (funcția își păstrează numele și
--    semnătura), deci nu se recreează.
-- 2. Rescrie notificările deja trimise (backfill): titlurile de tichet care se
--    termină în „: <cod>” primesc eticheta, iar corpul vechi la „tu” primește
--    forma formală. Volume mici — cea mai mare firmă are opt angajați.
-- 3. Aliniază catalogul `public.features` la `src/config/features.ts`:
--    „Tichete IT” (tiparul din 0153).
--
-- Forward-only: nu atinge 0046 și nici 0188. Probe pe banc:
-- `tests/rls/proba-aprobatori-membru.sql` (6b) și
-- `tests/rls/proba-notificari-fluxuri.sql` (11)–(14).

begin;

create or replace function internal.tickets_notifica()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu              uuid := auth.uid();
  v_solicitant_user uuid;
  v_manager_user    uuid;
  v_asignat_user    uuid;
  v_eticheta        text;
  v_link            text := '/ticketing/' || new.id::text;
begin
  -- Firma rândului, explicit, la fiecare citire din `employees`: funcția
  -- ocolește RLS, iar cheile străine nu sunt compuse cu `organization_id`.
  select e.user_id into v_solicitant_user
    from public.employees e
   where e.id = new.solicitant_employee_id
     and e.organization_id = new.organization_id
     and e.deleted_at is null;

  -- Cerere nouă care are nevoie de aprobare → managerul direct.
  if tg_op = 'INSERT' and new.status = 'in_aprobare' then
    select sef.user_id into v_manager_user
      from public.employees subaltern
      join public.employees sef on sef.id = subaltern.manager_employee_id
     where subaltern.id = new.solicitant_employee_id
       and subaltern.organization_id = new.organization_id
       and sef.organization_id = new.organization_id
       and sef.deleted_at is null;

    if v_manager_user is not null then
      insert into public.notifications (user_id, organization_id, kind, title, body, link, entity_type, entity_id)
      values (v_manager_user, new.organization_id, 'approval',
              'Cerere IT de aprobat: ' || new.numar_afisat, new.titlu, v_link, 'ticket', new.id);
    end if;
    return null;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    v_eticheta := case new.status
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
    end;

    -- Schimbare de status → solicitantul, care altfel nu are de unde ști.
    -- Nu și când gestul e chiar al lui (confirmă, redeschide, anulează).
    if v_solicitant_user is not null and v_solicitant_user is distinct from v_eu then
      insert into public.notifications (user_id, organization_id, kind, title, body, link, entity_type, entity_id)
      values (
        v_solicitant_user, new.organization_id,
        case new.status when 'respins' then 'warning'::public.notification_kind
                        when 'rezolvat' then 'success'::public.notification_kind
                        when 'in_asteptare' then 'task'::public.notification_kind
                        else 'info'::public.notification_kind end,
        'Tichetul ' || new.numar_afisat || ': ' || v_eticheta,
        case when new.status = 'respins' then coalesce(new.motiv_respingere, new.titlu)
             when new.status = 'in_asteptare' then 'Se așteaptă răspunsul dumneavoastră.'
             else new.titlu end,
        v_link, 'ticket', new.id
      );
    end if;

    -- Gestul solicitantului (redeschide, închide, anulează) → cine se ocupă
    -- de tichet; fără asignat, cine îl poate prelua. Doar dacă tichetul era
    -- deja în coada echipei: o cerere anulată din `in_aprobare` sau din
    -- `respins` n-a ajuns niciodată la ea.
    if v_eu is not null
       and v_solicitant_user = v_eu
       and new.status in ('redeschis', 'inchis', 'anulat')
       and old.status not in ('in_aprobare', 'respins') then
      if new.asignat_employee_id is not null then
        -- Asignat din altă firmă ⇒ nimeni (ca în 0192 §4).
        select e.user_id into v_asignat_user
          from public.employees e
         where e.id = new.asignat_employee_id
           and e.organization_id = new.organization_id
           and e.deleted_at is null;
        if v_asignat_user is not null and v_asignat_user is distinct from v_eu then
          insert into public.notifications (user_id, organization_id, kind, title, body, link, entity_type, entity_id)
          values (v_asignat_user, new.organization_id,
                  case when new.status = 'redeschis' then 'task'::public.notification_kind
                       else 'info'::public.notification_kind end,
                  left('Tichetul ' || new.numar_afisat || ': ' || v_eticheta || ' de solicitant', 200),
                  left(new.titlu, 4000), v_link, 'ticket', new.id);
        end if;
      else
        insert into public.notifications (user_id, organization_id, kind, title, body, link, entity_type, entity_id)
        select m.user_id, new.organization_id,
               case when new.status = 'redeschis' then 'task'::public.notification_kind
                    else 'info'::public.notification_kind end,
               left('Tichetul ' || new.numar_afisat || ': ' || v_eticheta || ' de solicitant', 200),
               left(new.titlu, 4000), v_link, 'ticket', new.id
          from public.organization_members m
         where m.organization_id = new.organization_id
           and m.status = 'active'
           and m.deleted_at is null
           and m.user_id is distinct from v_eu
           and internal.scope_membru(new.organization_id, m.user_id, 'tickets', 'update') = 'all';
      end if;
    end if;
  end if;

  -- Bug rezolvat → toți cei care au raportat duplicate. Linkul și entitatea
  -- sunt ale DUPLICATULUI fiecăruia: pe el îl poate deschide omul, și pe el
  -- îl recunoaște din lista lui. Originalul rămâne numit în text. Doar
  -- duplicatele din firma bug-ului: `parent_ticket_id` nu e compus cu
  -- organizația, iar un duplicat străin ar primi titlul tichetului nostru.
  if tg_op = 'UPDATE' and new.tip = 'bug_erp' and new.status = 'rezolvat'
     and old.status is distinct from 'rezolvat' then
    insert into public.notifications (user_id, organization_id, kind, title, body, link, entity_type, entity_id)
    select e.user_id, d.organization_id, 'success',
           'Problema raportată a fost rezolvată (' || d.numar_afisat || ')',
           new.titlu || ' — rezolvată prin ' || new.numar_afisat || '.',
           '/ticketing/' || d.id::text, 'ticket', d.id
      from public.tickets d
      join public.employees e on e.id = d.solicitant_employee_id
     where d.parent_ticket_id = new.id
       and d.organization_id = new.organization_id
       and d.deleted_at is null
       and e.organization_id = new.organization_id
       and e.deleted_at is null
       and e.user_id is not null;
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
