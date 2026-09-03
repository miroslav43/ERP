-- supabase/migrations/0122_push_dispozitive.sql
-- Notificări push pentru aplicația mobilă.
--
-- Se agață de `public.notifications` — punctul prin care trec deja toate cele 22
-- de module — și NU de Server Actions: o parte din notificări sunt scrise de
-- joburi pg_cron dinăuntrul bazei (0103_pontaj_mementouri, 0008_expirables,
-- 0095_integrare_notificari), care nu trec niciodată prin aplicație. Un
-- expeditor legat de aplicație ar rata exact memento-urile.
--
-- Livrarea propriu-zisă NU se face din bază: `pg_net` nu e activat pe instanța
-- noastră (vezi comentariul din src/app/api/reges/reconciliere/route.ts). Coada
-- de aici e golită de un timer systemd de pe VM, prin /api/push/livreaza.

---------------------------------------------------------------------------
-- 1. Tipuri
---------------------------------------------------------------------------

create type public.platforma_mobila as enum ('ios', 'android');

-- `in_lucru` NU e decor. Fără ea, ruta ia rândurile, le lasă pe 'in_asteptare'
-- cât timp trimite, iar timerul următor — la un minut — le poate lua din nou:
-- aceeași notificare, de două ori pe telefon. Blocarea din `for update skip
-- locked` ține doar până la commit, adică mult mai puțin decât trimiterea.
--
-- `esuat` NU e scrisă de nicio cale de cod din `golesteCoada`
-- (src/lib/push/coada.ts): un bilet de eroare de la Expo lasă rândul pe
-- `in_asteptare` (reîncercabil, până la MAX_INCERCARI încercări), nu pe
-- `esuat`. Motivul: `RezultatBilet` (src/lib/push/expo.ts) nu distinge o
-- eroare REÎNCERCABILĂ de una PERMANENTĂ — ambele ajung `{ fel: "eroare" }` —
-- deci `golesteCoada` n-are cum să decidă când o scriere merită starea
-- terminală `esuat` în loc de o nouă reîncercare. Rămâne rezervată pentru
-- ziua în care `trimiteLot` face distincția (sau pentru o marcare manuală,
-- din altă unealtă) — nu se șterge din enum doar fiindcă azi n-o scrie nimeni.
create type public.stare_livrare_push as enum (
  'in_asteptare', 'in_lucru', 'trimis', 'esuat', 'abandonat'
);

---------------------------------------------------------------------------
-- 2. dispozitive_push — un rând per instalare a aplicației.
---------------------------------------------------------------------------

create table public.dispozitive_push (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  -- Forma jetonului Expo. Verificată aici ca să nu ajungă în coadă un șir care
  -- va fi refuzat oricum de exp.host, după ce a consumat o încercare.
  jeton           text not null check (jeton ~ '^ExponentPushToken\[[^]]{1,200}\]$'),
  platforma       public.platforma_mobila not null,
  -- Ultima confirmare din aplicație. Un jeton nevăzut de luni de zile e un
  -- telefon schimbat; curățarea lui e o decizie de mai târziu, nu una de acum.
  vazut_la        timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id) on delete set null,
  deleted_at      timestamptz
);

-- Un jeton aparține unei singure instalări. Parțial: un jeton retras poate
-- reapărea pe alt telefon, iar unicitatea totală ar bloca reînregistrarea.
create unique index dispozitive_push_jeton_uq
  on public.dispozitive_push (jeton) where deleted_at is null;
create index dispozitive_push_user_idx
  on public.dispozitive_push (user_id, organization_id) where deleted_at is null;
create index dispozitive_push_org_idx on public.dispozitive_push (organization_id);
create index dispozitive_push_created_by_idx on public.dispozitive_push (created_by);
create index dispozitive_push_updated_by_idx on public.dispozitive_push (updated_by);

---------------------------------------------------------------------------
-- 3. push_livrari — coada. Tabelă de SISTEM: fără politici, deci închisă.
---------------------------------------------------------------------------

create table public.push_livrari (
  id              uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  dispozitiv_id   uuid not null references public.dispozitive_push (id) on delete cascade,
  stare           public.stare_livrare_push not null default 'in_asteptare',
  incercari       int not null default 0 check (incercari >= 0),
  trimis_la       timestamptz,
  eroare          text,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id) on delete set null,
  deleted_at      timestamptz
);

-- Indexul pe care se sprijină `for update skip locked` din rută.
create index push_livrari_de_trimis_idx
  on public.push_livrari (created_at)
  where stare in ('in_asteptare', 'in_lucru') and deleted_at is null;
create index push_livrari_notificare_idx on public.push_livrari (notification_id);
create index push_livrari_dispozitiv_idx on public.push_livrari (dispozitiv_id);
create index push_livrari_created_by_idx on public.push_livrari (created_by);
create index push_livrari_updated_by_idx on public.push_livrari (updated_by);

---------------------------------------------------------------------------
-- 4. Preferința. O coloană, nu o tabelă: `notification_preferences` are deja
--    `in_app` și `email` per fiecare din cele opt valori ale enum-ului.
---------------------------------------------------------------------------

alter table public.notification_preferences
  add column push boolean not null default true;

---------------------------------------------------------------------------
-- 5. Punerea în coadă
--
-- `security definer` NU e opțional: funcția rulează altfel cu identitatea celui
-- care a scris notificarea, iar politica de pe `dispozitive_push` l-ar limita la
-- rândurile proprii. Cum actorul aproape niciodată nu e destinatarul — un
-- manager care aprobă, un job pg_cron fără auth.uid() deloc — selectul ar
-- întoarce zero dispozitive, FĂRĂ NICIO EROARE, iar coada ar rămâne goală la
-- nesfârșit. Precedentul care dovedește că merge peste `force row level
-- security`: internal.audit_trigger() din 0002, care scrie în audit_logs.
--
-- Preferința absentă înseamnă TRIMITE. Baza colapsează „absent" în „fals" doar
-- dacă i se cere; aici `coalesce` o cere explicit.
--
-- Dispozitivul se potrivește DOAR pe `user_id`, nu și pe `organization_id`:
-- un angajat poate fi membru în mai multe firme
-- (`organization_members` e unic pe `(organization_id, user_id)`), dar are UN
-- singur telefon, deci un singur jeton Expo (unicitatea de pe `jeton`, mai
-- sus, nu admite un al doilea rând). Cu potrivirea pe organization_id, o
-- notificare din a doua firmă n-ar găsi niciun dispozitiv — angajatul n-ar
-- primi push de la locul de muncă în care jetonul lui nu era încă legat.
-- `organization_id` rămâne pe rândul din `dispozitive_push` — pentru
-- izolarea rândului însuși (RLS, mai jos) și pentru audit — dar nu mai
-- participă la această potrivire. Preferința rămâne scopată pe organizație:
-- oprirea notificărilor de la o firmă nu trebuie să oprească push-ul de la
-- cealaltă.
---------------------------------------------------------------------------

create or replace function internal.push_pune_in_coada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.push_livrari (notification_id, dispozitiv_id)
  select new.id, d.id
  from public.dispozitive_push d
  where d.user_id = new.user_id
    and d.deleted_at is null
    and coalesce(
          (select p.push
             from public.notification_preferences p
            where p.user_id = new.user_id
              and p.organization_id = new.organization_id
              and p.kind = new.kind
              and p.deleted_at is null),
          true);
  return null;
end;
$$;

create trigger trg_notifications_push
  after insert on public.notifications
  for each row execute function internal.push_pune_in_coada();

---------------------------------------------------------------------------
-- 5b. Preluarea din coadă, pentru ruta /api/push/livreaza.
---------------------------------------------------------------------------

-- `for update of l skip locked` în loc de un simplu select: aplicația rulează
-- cu DOUĂ replici Swarm, iar timerul poate suprapune două rulări. Fără
-- `skip locked`, amândouă ar lua aceleași rânduri și ar trimite fiecare
-- aceeași notificare. Aceeași grijă ca la închirierea REGES, altă unealtă
-- pentru aceeași problemă. `of l`, explicit: blochează DOAR `push_livrari` —
-- fără el, un `for update` peste un join ar bloca și rândurile din
-- `dispozitive_push`/`notifications`, tabele pe care alte tranzacții (de
-- exemplu `/api/dispozitive`, care face UPDATE pe `dispozitive_push`) au
-- nevoie să le scrie fără să aștepte după un timer de golire a cozii.
--
-- FILTRELE PE DISPOZITIV/NOTIFICARE RETRASE STAU ÎN CTE, NU ÎN UPDATE-UL DE
-- MAI JOS — asta e reparația Rundei 2, distinctă de reparația Rundei 1
-- (care adăugase filtrele, dar în locul greșit). `limit p_plafon` stă în CTE:
-- dacă filtrele ar sta doar în `UPDATE ... FROM`, CTE-ul tot ar SELECTA (și
-- bloca via `for update`) rândurile orfane — cele mai VECHI, deci primele la
-- `order by l.created_at` — care apoi ar fi eliminate de join fără să producă
-- niciun rezultat. Cu destui orfani (>= p_plafon), preluarea ar întoarce ZERO
-- rânduri LA NESFÂRȘIT, deși coada are livrări valide în spate — un blocaj de
-- cap de coadă identic la exterior cu un timer mort. Reprodus empiric pe banc
-- înainte de reparație: plafon 3 cu 3 orfani → 0 rânduri; plafon 4 → rândul
-- valid trece. Verificarea (20) din tests/rls/proba-push.sql e garda de
-- regresie. Cu filtrele mutate în join-ul CTE-ului, orfanii nu mai INTRĂ
-- niciodată în candidați — nu mai concurează pe `limit` cu rândurile valide.
--
-- `incercari = l.incercari + 1` la preluare, nu doar la scrierea din
-- `golesteCoada`: o scriere care eșuează DETERMINIST pe partea TypeScript
-- (grant retras pe `push_livrari`, de exemplu) lăsa altfel `incercari`
-- neschimbat la nesfârșit — rândul era recuperat mereu la +10 minute și
-- mesajul pleca din nou spre Expo, la infinit, fiindcă MAX_INCERCARI nu se
-- atingea niciodată. Incrementul de aici rulează cu privilegiile funcției
-- (`security definer`), independent de orice grant/eroare pe partea de
-- service_role — contorul avansează chiar și când scrierea ulterioară din
-- `coada.ts` eșuează constant.
create or replace function app.push_ia_din_coada(p_plafon int default 100)
returns table (
  id            uuid,
  incercari     int,
  jeton         text,
  dispozitiv_id uuid,
  titlu         text,
  corp          text,
  link          text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with luate as (
    select l.id
    from public.push_livrari l
    join public.dispozitive_push d on d.id = l.dispozitiv_id and d.deleted_at is null
    join public.notifications n on n.id = l.notification_id and n.deleted_at is null
    where l.deleted_at is null
      and (
        l.stare = 'in_asteptare'
        -- Recuperare: o rută căzută la jumătate lasă rânduri pe 'in_lucru'.
        -- Fără clauza asta ar rămâne acolo pentru totdeauna, tăcut.
        or (l.stare = 'in_lucru' and l.updated_at < now() - interval '10 minutes')
      )
    order by l.created_at
    limit p_plafon
    for update of l skip locked
  )
  -- Join-ul spre `d`/`n` de mai jos NU repetă `deleted_at is null`: CTE-ul de
  -- mai sus rulează în ACEEAȘI comandă, deci pe ACELAȘI snapshot MVCC —
  -- rândurile din `luate` au trecut deja filtrul o dată, iar repetarea lui
  -- aici n-ar verifica nimic diferit, doar ar duplica sursa de adevăr.
  update public.push_livrari l
     set stare = 'in_lucru', updated_at = now(), incercari = l.incercari + 1
    from luate, public.dispozitive_push d, public.notifications n
   where l.id = luate.id
     and d.id = l.dispozitiv_id
     and n.id = l.notification_id
  returning l.id, l.incercari, d.jeton, d.id, n.title, n.body, n.link;
end;
$$;

revoke all on function app.push_ia_din_coada(int) from public, anon, authenticated;

-- `.rpc()` nu ajunge la schema `app` — PostgREST expune doar `public`. Funcția
-- rămâne în `app` (convenția: logica stă acolo) și primește un înveliș
-- `public` care doar o cheamă.
create or replace function public.push_ia_din_coada(p_plafon int default 100)
returns table (
  id uuid, incercari int, jeton text, dispozitiv_id uuid,
  titlu text, corp text, link text
)
language sql
security definer
set search_path = ''
as $$ select * from app.push_ia_din_coada(p_plafon) $$;

revoke all on function public.push_ia_din_coada(int) from public, anon, authenticated;
grant execute on function public.push_ia_din_coada(int) to service_role;

---------------------------------------------------------------------------
-- 6. RLS
---------------------------------------------------------------------------

alter table public.dispozitive_push enable row level security;
alter table public.dispozitive_push force row level security;
alter table public.push_livrari     enable row level security;
alter table public.push_livrari     force row level security;

-- dispozitive_push — strict rândurile proprii. Fără cheie de permisiune: nu
-- există resursă „dispozitivul meu" în role_permissions, iar una inventată ar
-- întoarce `none`, adică refuz tăcut pentru toată lumea. Aceeași alegere ca la
-- notifications (0002, secțiunea 6.11).
--
-- FĂRĂ `and deleted_at is null` aici, spre deosebire de `notifications_select`:
-- Postgres cere ca rândul NOU al unui UPDATE să treacă politica SELECT (nu doar
-- WITH CHECK — verificat empiric, se reproduce identic pe o tabelă minimală,
-- indiferent de RETURNING). Cu clauza inclusă, retragerea propriului jeton
-- (`deleted_at = now()`, singurul mecanism descris în §8) era respinsă cu
-- „new row violates row-level security policy" — proprietarul rândului nu-l
-- mai putea nici măcar șterge din propria coadă. Rândurile proprii rămân
-- vizibile după soft-delete; izolarea între utilizatori (user_id) și cea între
-- organizații (via politica de UPDATE, mai jos) nu se ating.
create policy dispozitive_push_select on public.dispozitive_push for select to authenticated
using (user_id = (select auth.uid()));

create policy dispozitive_push_insert on public.dispozitive_push for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and user_id = (select auth.uid())
  and deleted_at is null
);

-- `organization_id` verificat și în USING, și în WITH CHECK: fără el, un
-- `authenticated` din organizația A putea muta propriul dispozitiv (rândul
-- rămâne al lui — `user_id` neschimbat) în organizația B, cu un simplu UPDATE.
-- Rândul „aterizează" acolo pentru totdeauna: vizibil în auditul organizației
-- B, deși omul n-a fost niciodată membru acolo — coloana `organization_id`
-- devine o minciună despre apartenență. (Declanșatorul de pe `notifications`,
-- secțiunea 5, potrivește oricum DOAR pe `user_id` — mutarea rândului nu
-- schimbă ce notificări ajung push către el, deci riscul e izolarea rândului
-- și a auditului, nu o abonare nouă.)
-- Verificat empiric: fără clauza asta, UPDATE-ul reușea (1 rând), fără nicio
-- eroare — exact refuzul tăcut pe care proiectul îl tratează drept cea mai
-- costisitoare clasă de defect.
create policy dispozitive_push_update on public.dispozitive_push for update to authenticated
using (
  user_id = (select auth.uid())
  and organization_id = any ((select app.current_org_ids())::uuid[])
)
with check (
  user_id = (select auth.uid())
  and organization_id = any ((select app.current_org_ids())::uuid[])
);

-- push_livrari — NICIO politică. RLS activat și forțat înseamnă că e inaccesibilă
-- oricărui rol de aplicație; o citește doar ruta, prin service_role (bypassrls,
-- 0001_kernel.sql:25). Nu se lasă fără RLS: regula proiectului e RLS peste tot,
-- iar o excepție „pentru că oricum n-o citește nimeni" e felul în care apare a
-- doua excepție.

---------------------------------------------------------------------------
-- 7. Actor, audit, drepturi
---------------------------------------------------------------------------

-- NU se atinge `internal.audit_forbidden_patterns()` (0002, lărgit de
-- `0010b_fix_garda_audit.sql`) — e lista greșită pentru asta, exact avertismentul
-- din `0017_fix_concedii.sql:798-801`. `create or replace` pe ea nu adaugă un
-- tipar, ÎNLOCUIEȘTE tot corpul: un `%jeton%` acolo ar fi redactat corect
-- valoarea jetonului, dar ar face și `attach_audit()` să refuze (garda R9,
-- aceeași listă) orice tabelă viitoare cu o coloană al cărei NUME conține
-- „jeton" — și, mai grav, ar retrograda `%secret%` la forma lui largă din
-- 0002, redeschizând exact falsul-pozitiv pe care 0010b l-a închis
-- (`safety_committee_meetings.secretar_employee_id`, auditată de
-- `0011_ssm.sql`, ar începe din nou să fie respinsă sau — dacă cineva
-- retrage și restrângerea din comentariu fără să observe — redactată tăcut
-- în registrul obligatoriu ITM).
--
-- Mecanismul corect e cel din 0017: o listă albă PER TABELĂ, care exclude
-- complet câmpul din `before`/`after` (înlocuit cu un marcaj
-- `campuri_sensibile_atinse`), fără să atingă garda de atașare. Se adaugă o
-- ramură, ca la `leave_requests`; ramura existentă rămâne neschimbată.
create or replace function internal.audit_campuri_excluse(p_table text)
returns text[] language sql immutable set search_path = '' as $$
  select case p_table
    when 'leave_requests' then
      array['medical_code_id', 'serie_certificat', 'numar_certificat', 'motiv', 'atasament_path']
    -- Jetonul Expo e o capabilitate purtătoare (cine îl are trimite push
    -- arbitrar pe telefonul omului); restul rândului — organization_id,
    -- platforma, deleted_at — chiar merită urmărit în audit.
    when 'dispozitive_push' then
      array['jeton']
    else '{}'::text[]
  end;
$$;

revoke all on function internal.audit_campuri_excluse(text) from public, anon, authenticated;

comment on function internal.audit_campuri_excluse(text) is
  'Listă albă de câmpuri excluse din audit_logs, per tabelă (tg_table_name). Citită din tg_table_name, NU din TG_ARGV — o re-rulare a internal.attach_audit(tabelă) nu o poate șterge tăcut (0017). Extinsă în 0122 cu `dispozitive_push`.';

do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array['dispozitive_push', 'push_livrari']
  loop
    execute format(
      'create trigger trg_%1$s_actor before insert or update on public.%1$I for each row execute function internal.set_actor()',
      v_tabela);
    if v_tabela = 'dispozitive_push' then
      execute format('select internal.attach_audit(%L)', v_tabela);
    else
      -- `push_livrari` NU intră la audit generic: n-are `organization_id` (e
      -- coadă de sistem, nu tabelă de business), deci fiecare tranziție de
      -- stare ar scrie un rând de audit cu `organization_id = null` —
      -- invizibil pentru orice `org_admin` (politica `audit_logs_select` cere
      -- `organization_id = any(current_org_ids())`) și neatins de
      -- `retention_policies` (cheiată tot pe `organization_id`). Ar crește la
      -- nesfârșit, fără ca vreo firmă-client să-l poată vedea sau curăța.
      null;
    end if;
    execute format('revoke all on table public.%I from public, anon', v_tabela);
    execute format('revoke delete on table public.%I from authenticated', v_tabela);
  end loop;
end;
$$;

-- Granturi diferite per tabelă: coada nu se atinge din sesiunea unui utilizator.
grant select, insert, update on table public.dispozitive_push to authenticated;
revoke all on table public.push_livrari from authenticated;

-- `service_role` NU capătă privilegii de tabelă automat. `bypassrls` (0001,
-- atributul rolului) ocolește POLITICILE, dar `GRANT` e un strat separat —
-- fără el, ruta primește „permission denied", nu „0 rânduri". Verificat
-- empiric pe banc: fără liniile astea, `set role service_role` urmat de un
-- SELECT sau UPDATE pe oricare din cele două tabele cade cu 42501.
-- `0001_kernel.sql:649` are un `grant all on all tables` de o singură dată,
-- la bootstrap — nu acoperă tabele create în migrări ulterioare, iar repo-ul
-- n-are niciun `alter default privileges` PE TABELE (cele trei din
-- `0002_authz.sql:1559-1561` sunt `on functions`, nu ajută aici). Fără
-- INSERT/DELETE: ruta
-- (/api/push/livreaza) nu creează dispozitive noi (le înregistrează
-- aplicația) și nu șterge nimic (soft-delete peste tot, ca la orice tabelă
-- din schemă).
grant select, update on table public.dispozitive_push to service_role;
grant select, update on table public.push_livrari     to service_role;

revoke all on function internal.push_pune_in_coada() from public, anon;

---------------------------------------------------------------------------
-- 8. Note de proiectare
--
-- DE CE NU EXISTĂ POLITICĂ DELETE, nici aici
--   Retragerea unui jeton e `deleted_at = now()`, nu DELETE. Jurnalul de audit
--   trebuie să poată răspunde „de ce a încetat omul ăsta să primească
--   notificări", iar un rând șters nu răspunde la nimic.
--
-- DE CE `vazut_la` ȘI NU UN JOB DE CURĂȚENIE
--   Expo întoarce `DeviceNotRegistered` pentru un jeton mort, iar ruta îl
--   marchează atunci. Curățarea pe vechime ar șterge și telefoane care pur și
--   simplu n-au fost deschise o lună.
---------------------------------------------------------------------------
