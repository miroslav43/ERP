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
    and d.organization_id = new.organization_id
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
create policy dispozitive_push_select on public.dispozitive_push for select to authenticated
using (user_id = (select auth.uid()) and deleted_at is null);

create policy dispozitive_push_insert on public.dispozitive_push for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and user_id = (select auth.uid())
  and deleted_at is null
);

create policy dispozitive_push_update on public.dispozitive_push for update to authenticated
using (user_id = (select auth.uid()) and deleted_at is null)
with check (user_id = (select auth.uid()));

-- push_livrari — NICIO politică. RLS activat și forțat înseamnă că e inaccesibilă
-- oricărui rol de aplicație; o citește doar ruta, prin service_role (bypassrls,
-- 0001_kernel.sql:25). Nu se lasă fără RLS: regula proiectului e RLS peste tot,
-- iar o excepție „pentru că oricum n-o citește nimeni" e felul în care apare a
-- doua excepție.

---------------------------------------------------------------------------
-- 7. Actor, audit, drepturi
---------------------------------------------------------------------------

do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array['dispozitive_push', 'push_livrari']
  loop
    execute format(
      'create trigger trg_%1$s_actor before insert or update on public.%1$I for each row execute function internal.set_actor()',
      v_tabela);
    execute format('select internal.attach_audit(%L)', v_tabela);
    execute format('revoke all on table public.%I from public, anon', v_tabela);
    execute format('revoke delete on table public.%I from authenticated', v_tabela);
  end loop;
end;
$$;

-- Granturi diferite per tabelă: coada nu se atinge din sesiunea unui utilizator.
grant select, insert, update on table public.dispozitive_push to authenticated;
revoke all on table public.push_livrari from authenticated;

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
