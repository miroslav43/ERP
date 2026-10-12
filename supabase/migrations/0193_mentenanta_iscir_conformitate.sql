-- supabase/migrations/0193_mentenanta_iscir_conformitate.sql
--
-- MENTENANȚĂ, FAZA M7: ISCIR ȘI VERIFICĂRILE LEGALE.
--
-- ── CE ADUCE ────────────────────────────────────────────────────────────────
-- Până aici o autorizație ISCIR se putea doar adăuga. Nu se putea corecta,
-- reînnoi, suspenda cu motiv sau șterge din interfață, iar un echipament aflat
-- doar în evidența RSVTI (sub pragul de înregistrare la ISCIR) n-avea unde sta:
-- `numar` era obligatoriu.
--
-- 1. `regim` (`inregistrat | neinregistrat_rsvti`, cazul 42): un echipament
--    neînregistrat la ISCIR, ținut în evidența RSVTI, n-are număr de
--    autorizație. CHECK-ul cere numărul doar în regimul `inregistrat`.
-- 2. Suspendarea cu motiv (`motiv_suspendare`, minimum 5 caractere, cerut de
--    gardă la TRANZIȚIE — rândurile vechi, suspendate fără motiv, rămân
--    valide) și `reactivata_la`, pus de gardă la ridicarea suspendării, nu de
--    client. Suspendarea scoate deja autorizația din scadențe (0180/0182).
-- 3. Reînnoirea ca RÂND NOU (cazul 40): `inlocuita_de_id` pe rândul vechi
--    arată spre cel nou. Rândul înlocuit iese din scadențe și rămâne doar ca
--    istoric (garda refuză orice modificare pe el); ștergerea logică a
--    rândului nou îl readuce pe cel vechi. Unicitatea numărului ignoră
--    rândurile înlocuite, fiindcă o reînnoire poate păstra numărul de
--    înregistrare. Reînnoirea trece prin `public.reinnoieste_autorizatie_iscir`
--    (SECURITY INVOKER — politicile apelantului se aplică întocmai), singura
--    cale atomică: rândul vechi trebuie marcat ÎNAINTE de inserarea celui nou
--    (indexul parțial), iar cheia străină e DEFERRABLE ca să accepte id-ul
--    rândului care încă nu există.
-- 4. `internal.iscir_exp_sync` rescris de la forma din 0182: și rândul
--    înlocuit iese din `expirables`; eticheta nu mai depinde de un număr care
--    poate lipsi.
-- 5. Registrul (`zz_iscir_authorizations_registru`, harta din 0142) înregistrează
--    doar autorizațiile `inregistrat` cu număr: evidența internă a RSVTI nu e un
--    document primit de la ISCIR. Argumentele triggerului sunt cele de azi,
--    neschimbate (citite din catalog, nu deduse).
--
-- ── CE NU FACE ──────────────────────────────────────────────────────────────
--  · Nu blochează nimic pe autorizația expirată (decizia din plan: avertizare,
--    nu blocare, cazul 38). Semaforul e în `src/domain/maintenance/iscir.ts`.
--  · Nu impune periodicitățile legale în bază: scadența din document are
--    prioritate față de calcul (cazul 40), iar maximele sunt ⚠ de confirmat
--    (NOTES.md §3). Aplicația avertizează când documentul trece de maximul legal.
--  · Nu atinge `app.poate_vedea_expirabil`, `app.can_path`, politicile tabelei
--    (bucla din 0011, INSERT-ul mutat pe `update` în 0150) și nu adaugă DELETE.
--  · Nu rescrie `internal.registru_config_surse` (0142): o regenerare din hartă
--    ar pierde condiția `when` de mai jos — se refolosește condiția, nu harta.
--
-- Aplicare: psql byte-exact, după bancul local; pe producție doar cu
-- confirmarea explicită a utilizatorului.

begin;

-- ============================================================
-- 1. Regimul și coloanele noi
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_catalog.pg_type t join pg_catalog.pg_namespace n on n.oid = t.typnamespace
                  where n.nspname = 'public' and t.typname = 'iscir_regim') then
    create type public.iscir_regim as enum ('inregistrat', 'neinregistrat_rsvti');
  end if;
end $$;

comment on type public.iscir_regim is
  'inregistrat = echipament înregistrat la ISCIR, cu număr de autorizație; neinregistrat_rsvti = sub pragul de înregistrare, ținut în evidența RSVTI (0193).';

alter table public.iscir_authorizations
  add column if not exists regim            public.iscir_regim not null default 'inregistrat',
  add column if not exists motiv_suspendare text,
  add column if not exists reactivata_la    date,
  add column if not exists inlocuita_de_id  uuid;

alter table public.iscir_authorizations alter column numar drop not null;

alter table public.iscir_authorizations
  drop constraint if exists iscir_authorizations_inlocuita_de_fkey,
  add constraint iscir_authorizations_inlocuita_de_fkey
    foreign key (inlocuita_de_id) references public.iscir_authorizations (id)
    deferrable initially deferred;

-- Fără plafon de lungime în bază: rândurile existente (fără CHECK până aici)
-- n-au fost măsurate pe producție, iar un plafon nou ar putea pica migrarea pe
-- un rând vechi. Cele 80 de caractere rămân regula formularului (Zod).
alter table public.iscir_authorizations
  drop constraint if exists iscir_authorizations_numar_ck,
  add constraint iscir_authorizations_numar_ck
    check (regim = 'neinregistrat_rsvti' or (numar is not null and char_length(btrim(numar)) >= 1)),
  drop constraint if exists iscir_authorizations_numar_gol_ck,
  add constraint iscir_authorizations_numar_gol_ck
    check (numar is null or char_length(btrim(numar)) >= 1),
  drop constraint if exists iscir_authorizations_motiv_ck,
  add constraint iscir_authorizations_motiv_ck
    check (motiv_suspendare is null or char_length(motiv_suspendare) <= 1000),
  drop constraint if exists iscir_authorizations_inlocuire_ck,
  add constraint iscir_authorizations_inlocuire_ck
    check (inlocuita_de_id is null or inlocuita_de_id <> id);

comment on column public.iscir_authorizations.inlocuita_de_id is
  'Rândul care a înlocuit-o prin reînnoire (0193). Rândul înlocuit iese din scadențe și rămâne istoric; se pune doar prin public.reinnoieste_autorizatie_iscir.';
comment on column public.iscir_authorizations.reactivata_la is
  'Ziua ultimei ridicări a suspendării. O pune garda (internal.iscir_garda), nu clientul.';

-- ============================================================
-- 2. Indexuri parțiale
-- ============================================================
-- Unicitatea numărului ignoră rândurile înlocuite: reînnoirea poate păstra
-- numărul de înregistrare al echipamentului.
drop index if exists public.iscir_authorizations_uq;
create unique index iscir_authorizations_uq
  on public.iscir_authorizations (organization_id, numar)
  where deleted_at is null and inlocuita_de_id is null and numar is not null;

-- Un rând se înlocuiește o singură dată.
create unique index if not exists iscir_authorizations_inlocuire_uq
  on public.iscir_authorizations (inlocuita_de_id)
  where deleted_at is null and inlocuita_de_id is not null;

create index if not exists iscir_authorizations_echip_idx
  on public.iscir_authorizations (organization_id, equipment_id, valabil_pana)
  where deleted_at is null;

-- ============================================================
-- 3. Garda autorizației
-- ============================================================
-- `app.iscir_inlocuire` = id-ul rândului pe care reînnoirea (sau anularea ei)
-- are voie să-i schimbe `inlocuita_de_id`. Îl pun doar funcțiile de mai jos;
-- PostgREST nu poate seta un GUC arbitrar.
create or replace function internal.iscir_garda() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_permis text := coalesce(current_setting('app.iscir_inlocuire', true), '');
begin
  if app.is_service_context() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.inlocuita_de_id is not null then
      raise exception using errcode = 'P0001',
        message = 'O autorizație nouă nu se înregistrează ca înlocuită. Folosiți „Reînnoiește” pe autorizația veche.';
    end if;
    new.reactivata_la := null;
    if new.suspendata_la is not null
       and (new.motiv_suspendare is null or char_length(btrim(new.motiv_suspendare)) < 5) then
      raise exception using errcode = 'P0001',
        message = 'Spuneți de ce e suspendată autorizația, în cel puțin 5 caractere.';
    end if;
    return new;
  end if;

  -- Legătura de înlocuire: doar prin reînnoire sau prin anularea ei.
  if new.inlocuita_de_id is distinct from old.inlocuita_de_id then
    if v_permis <> old.id::text then
      raise exception using errcode = 'P0001',
        message = 'Legătura cu autorizația care o înlocuiește se pune doar prin „Reînnoiește”.';
    end if;
    return new;
  end if;

  if old.inlocuita_de_id is not null then
    raise exception using errcode = 'P0001',
      message = 'Autorizația a fost înlocuită prin reînnoire și rămâne doar ca istoric. Modificați autorizația care o înlocuiește.';
  end if;

  if old.deleted_at is not null then
    raise exception using errcode = 'P0001',
      message = 'Autorizația a fost ștearsă și nu se mai modifică. Adăugați una nouă.';
  end if;

  if new.equipment_id is distinct from old.equipment_id then
    raise exception using errcode = 'P0001',
      message = 'O autorizație nu se mută pe alt echipament. Ștergeți-o și adăugați-o pe echipamentul corect.';
  end if;

  if old.suspendata_la is null and new.suspendata_la is not null then
    if new.motiv_suspendare is null or char_length(btrim(new.motiv_suspendare)) < 5 then
      raise exception using errcode = 'P0001',
        message = 'Spuneți de ce e suspendată autorizația, în cel puțin 5 caractere.';
    end if;
    if new.suspendata_la > app.azi_local() then
      raise exception using errcode = 'P0001',
        message = 'Data suspendării nu poate fi în viitor.';
    end if;
    new.reactivata_la := old.reactivata_la;
  elsif old.suspendata_la is not null and new.suspendata_la is null then
    new.reactivata_la := app.azi_local();
  else
    -- `reactivata_la` nu se scrie din client.
    new.reactivata_la := old.reactivata_la;
    if new.suspendata_la is not null
       and new.motiv_suspendare is distinct from old.motiv_suspendare
       and (new.motiv_suspendare is null or char_length(btrim(new.motiv_suspendare)) < 5) then
      raise exception using errcode = 'P0001',
        message = 'Spuneți de ce e suspendată autorizația, în cel puțin 5 caractere.';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists iscir_authorizations_garda on public.iscir_authorizations;
create trigger iscir_authorizations_garda
  before insert or update on public.iscir_authorizations
  for each row execute function internal.iscir_garda();

-- Ștergerea logică a rândului NOU readuce rândul pe care l-a înlocuit:
-- „am reînnoit din greșeală" se repară ștergând reînnoirea.
create or replace function internal.iscir_dupa_stergere() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_predecesor uuid;
begin
  if new.deleted_at is not null and old.deleted_at is null then
    select a.id into v_predecesor
      from public.iscir_authorizations a
     where a.inlocuita_de_id = new.id and a.deleted_at is null;
    if v_predecesor is not null then
      perform set_config('app.iscir_inlocuire', v_predecesor::text, true);
      update public.iscir_authorizations set inlocuita_de_id = null where id = v_predecesor;
      perform set_config('app.iscir_inlocuire', '', true);
    end if;
  end if;
  return null;
end $$;

drop trigger if exists iscir_authorizations_dupa_stergere on public.iscir_authorizations;
create trigger iscir_authorizations_dupa_stergere
  after update on public.iscir_authorizations
  for each row execute function internal.iscir_dupa_stergere();

-- ============================================================
-- 4. Scadențele: și rândul înlocuit iese din `expirables`
-- ============================================================
-- Forma ultimă era 0182 §3. Se adaugă `inlocuita_de_id is null` la condiția de
-- activitate și o etichetă care nu depinde de un număr (regimul RSVTI n-are).
create or replace function internal.iscir_exp_sync(a public.iscir_authorizations) returns void
language plpgsql security definer set search_path = '' as $$
declare v_activ boolean; v_echip_ok boolean; v_ce text;
begin
  select e.deleted_at is null and e.status <> 'casat'
    into v_echip_ok
    from public.equipment e where e.id = a.equipment_id;
  v_activ := a.deleted_at is null and a.suspendata_la is null and a.inlocuita_de_id is null
             and coalesce(v_echip_ok, false);
  v_ce := coalesce(a.numar, a.tip || ' (evidența RSVTI)');
  perform internal.sync_expirable(
    a.organization_id, 'iscir_authorization', a.id, 'autorizatie',
    'Autorizație ISCIR ' || v_ce, a.valabil_pana, 'iscir_authorizations', null, v_activ);
  perform internal.sync_expirable(
    a.organization_id, 'iscir_authorization', a.id, 'verificare_tehnica',
    'Verificare tehnică ISCIR ' || v_ce, a.scadenta_verificare_tehnica, 'iscir_authorizations', null, v_activ);
end $$;

-- ============================================================
-- 5. Registrul: doar autorizațiile înregistrate la ISCIR
-- ============================================================
-- Argumentele sunt EXACT cele din catalog (`pg_get_triggerdef` pe bancul cu
-- 0192): harta 0142, rândul `iscir_authorizations`. Se adaugă doar `when`.
drop trigger if exists zz_iscir_authorizations_registru on public.iscir_authorizations;
create trigger zz_iscir_authorizations_registru
  after insert on public.iscir_authorizations
  for each row
  when (new.regim = 'inregistrat' and new.numar is not null)
  execute function internal.registru_inreg_generic(
    'intrare', 'autorizatie_iscir', 'Autorizație ISCIR', '', 'numar', 'emis_la', '', 'tip', '', '', 'emitent');

-- ============================================================
-- 6. Reînnoirea, atomic
-- ============================================================
create or replace function public.reinnoieste_autorizatie_iscir(
  p_autorizatie                 uuid,
  p_valabil_pana                date,
  p_numar                       text default null,
  p_emitent                     text default null,
  p_emis_la                     date default null,
  p_scadenta_verificare_tehnica date default null,
  p_conditii                    text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_vechi public.iscir_authorizations;
  v_nou   uuid := gen_random_uuid();
  v_numar text := nullif(btrim(coalesce(p_numar, '')), '');
  v_n     integer;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Sesiunea a expirat. Autentificați-vă din nou.';
  end if;

  -- Citirea trece prin politica SELECT a apelantului (SECURITY INVOKER).
  select * into v_vechi
    from public.iscir_authorizations a
   where a.id = p_autorizatie and a.deleted_at is null;
  if not found then
    raise exception using errcode = 'P0001',
      message = 'Autorizația nu a fost găsită, a fost ștearsă sau nu vă este accesibilă.';
  end if;
  if v_vechi.inlocuita_de_id is not null then
    raise exception using errcode = 'P0001',
      message = 'Autorizația a fost deja reînnoită. Reînnoiți autorizația care o înlocuiește.';
  end if;
  if not app.can(v_vechi.organization_id, 'maintenance', 'update', 'team') then
    raise exception using errcode = '42501',
      message = 'Nu aveți dreptul de a reînnoi autorizații ISCIR.';
  end if;
  if v_vechi.regim = 'inregistrat' and v_numar is null then
    raise exception using errcode = 'P0001',
      message = 'O autorizație înregistrată la ISCIR are număr. Completați numărul de pe documentul nou.';
  end if;
  if p_valabil_pana is null then
    raise exception using errcode = 'P0001',
      message = 'Completați data până la care e valabilă autorizația nouă.';
  end if;

  -- Întâi rândul vechi (indexul parțial de unicitate îl scoate din calcul),
  -- apoi cel nou; cheia străină se verifică la commit.
  perform set_config('app.iscir_inlocuire', v_vechi.id::text, true);
  update public.iscir_authorizations
     set inlocuita_de_id = v_nou
   where id = v_vechi.id and deleted_at is null and inlocuita_de_id is null;
  get diagnostics v_n = row_count;
  perform set_config('app.iscir_inlocuire', '', true);
  if v_n = 0 then
    raise exception using errcode = 'P0001',
      message = 'Autorizația s-a schimbat între timp sau nu aveți dreptul s-o modificați. Reîncărcați pagina.';
  end if;

  insert into public.iscir_authorizations (
    id, organization_id, equipment_id, regim, numar, tip, emitent,
    emis_la, valabil_pana, scadenta_verificare_tehnica, conditii
  ) values (
    v_nou, v_vechi.organization_id, v_vechi.equipment_id, v_vechi.regim, v_numar, v_vechi.tip,
    coalesce(nullif(btrim(coalesce(p_emitent, '')), ''), v_vechi.emitent),
    p_emis_la, p_valabil_pana, p_scadenta_verificare_tehnica,
    nullif(btrim(coalesce(p_conditii, '')), '')
  );

  return v_nou;
end $$;

comment on function public.reinnoieste_autorizatie_iscir(uuid, date, text, text, date, date, text) is
  'Reînnoirea unei autorizații ISCIR (0193): marchează rândul vechi înlocuit și inserează rândul nou, în aceeași tranzacție. SECURITY INVOKER — politicile apelantului se aplică întocmai.';

-- ============================================================
-- 7. Drepturi pe funcții
-- ============================================================
do $$
declare f text;
begin
  foreach f in array array[
    'internal.iscir_garda()',
    'internal.iscir_dupa_stergere()',
    'internal.iscir_exp_sync(public.iscir_authorizations)']
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

revoke all on function public.reinnoieste_autorizatie_iscir(uuid, date, text, text, date, date, text) from public, anon;
grant execute on function public.reinnoieste_autorizatie_iscir(uuid, date, text, text, date, date, text) to authenticated;

-- ============================================================
-- 8. Verificarea migrării
-- ============================================================
do $$
declare
  c       text;
  v_lipsa text[] := '{}';
begin
  foreach c in array array['regim', 'motiv_suspendare', 'reactivata_la', 'inlocuita_de_id'] loop
    if not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'iscir_authorizations' and column_name = c) then
      v_lipsa := v_lipsa || ('iscir_authorizations.' || c);
    end if;
  end loop;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'iscir_authorizations'
                and column_name = 'numar' and is_nullable = 'NO') then
    v_lipsa := v_lipsa || 'numar încă obligatoriu';
  end if;
  foreach c in array array['iscir_authorizations_garda', 'iscir_authorizations_dupa_stergere',
                           'iscir_authorizations_exp', 'zz_iscir_authorizations_registru',
                           'set_updated_at_iscir_authorizations', 'iscir_authorizations_actor',
                           'audit_iscir_authorizations'] loop
    if not exists (select 1 from pg_catalog.pg_trigger
                    where tgname = c and tgrelid = 'public.iscir_authorizations'::regclass) then
      v_lipsa := v_lipsa || c;
    end if;
  end loop;
  if not exists (select 1 from pg_catalog.pg_constraint
                  where conname = 'iscir_authorizations_inlocuita_de_fkey' and condeferrable and condeferred) then
    v_lipsa := v_lipsa || 'cheia de înlocuire nu e DEFERRABLE INITIALLY DEFERRED';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public'
              and tablename = 'iscir_authorizations' and cmd = 'DELETE') then
    v_lipsa := v_lipsa || 'politică DELETE pe iscir_authorizations';
  end if;
  if exists (select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'reinnoieste_autorizatie_iscir' and p.prosecdef) then
    v_lipsa := v_lipsa || 'reinnoieste_autorizatie_iscir e SECURITY DEFINER';
  end if;
  if has_function_privilege('anon', 'public.reinnoieste_autorizatie_iscir(uuid, date, text, text, date, date, text)', 'execute') then
    v_lipsa := v_lipsa || 'anon poate reînnoi';
  end if;
  if array_length(v_lipsa, 1) > 0 then
    raise exception 'Migrarea 0193 e incompletă: %', array_to_string(v_lipsa, '; ');
  end if;
end $$;

commit;
