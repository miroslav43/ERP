-- supabase/migrations/0217_flota_uit_etransport.sql
--
-- FLOTA, F12f: CODUL UIT (RO e-TRANSPORT) PE CURSELE FOII DE PARCURS.
--
-- Specificația o numea `0214_flota_uit_etransport`; 0210–0212 le-a luat
-- mentenanța la integrare, iar toate migrările F12 s-au mutat cu +3, deci e 0217.
--
-- ── CE ADUCE ────────────────────────────────────────────────────────────────
--  · public.e_transport_incadrare — „neaplicabil” / „risc_fiscal_national” /
--    „international” (OUG 41/2022 art. 1 alin. (2), forma consolidată din
--    24.04.2025). E AFIRMAȚIA omului, nu se deduce din bunuri: lista bunurilor
--    cu risc fiscal ridicat se schimbă prin ordin ANAF (OPANAF 802/2022).
--  · trip_sheet_curse.e_transport — încadrarea cursei, implicit „neaplicabil”.
--  · app.uit_valid(text) — formatul (XSD schema_ETR_v2_20230126, `UitType`) și
--    cifrele de control (regula BR-019 din Schematron-ul ANAF v2.0.2,
--    12.08.2024): ultimele două cifre = ultimele două cifre ale sumei codurilor
--    ASCII ale primelor 14 caractere.
--  · public.trip_sheet_uit — zero sau mai multe coduri pe cursă (grupaj: câte
--    un UIT pe partidă), cu data declarată pentru începerea transportului și
--    valabilitatea în zile; `expira_la` = PRIMA zi expirată, ca `data_exp_uit`
--    de la ANAF (GENERATED).
--
-- ── CE REFUZĂ BAZA ȘI CE DOAR AVERTIZEAZĂ APLICAȚIA ─────────────────────────
-- Baza refuză doar ce e imposibil: formatul și cifrele de control (CHECK prin
-- funcția IMMUTABLE), mutarea codului pe altă cursă sau rescrierea lui, codul
-- dublat pe aceeași cursă și orice scriere pe o foaie care nu e ciornă. UIT-ul
-- expirat, neînceput sau lipsă pe o cursă marcată NU se refuză (decizia I-T2):
-- foaia consemnează ce s-a întâmplat, iar avertismentele sunt ale aplicației
-- (`src/domain/fleet/uit.ts`).
--
-- ── STAREA FOII ─────────────────────────────────────────────────────────────
-- Codurile urmează EXACT cursele (0200 §D1, `internal.curse_inainte`): se scriu
-- doar pe ciornă, pe orice scope. Specificația presupunea „draft sau respins”;
-- F4 a ales doar `draft` (o foaie respinsă se redeschide în ciornă), deci se
-- urmează F4.
--
-- ── CE NU ATINGE ────────────────────────────────────────────────────────────
--  · internal.curse_inainte (forma ultimă: 0200 §8): e_transport intră în
--    comparația pe toată linia (`to_jsonb(new) - …`), deci se scrie doar pe
--    ciornă, fără nicio rescriere a funcției.
--  · nicio cheie de permisiune nouă: drepturile vin din `trip_sheets:*`, ca la
--    curse și alimentări (politicile sunt copia literală a `curse_*`, 0200 §9).
--
-- Proba: tests/rls/proba-flota-uit.sql. Fără backfill (§10). Forward-only.

begin;

-- ============================================================
-- 1. Premisele
-- ============================================================
do $$
begin
  if to_regclass('public.trip_sheet_curse') is null then
    raise exception '0217: lipsește public.trip_sheet_curse (0200, F4)';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'trip_sheet_curse'
                    and column_name = 'deleted_at') then
    raise exception '0217: trip_sheet_curse nu are deleted_at; cascada de la §7 n-ar avea pe ce porni';
  end if;
end $$;

-- ============================================================
-- 2. Enum
-- ============================================================
create type public.e_transport_incadrare as enum (
  'neaplicabil',            -- implicit: cursă fără bunuri monitorizate
  'risc_fiscal_national',   -- OUG 41/2022 art. 1 alin. (2), prima teză; OPANAF 802/2022
  'international'           -- OUG 41/2022 art. 1 alin. (2), a doua teză; art. 8^1
);

comment on type public.e_transport_incadrare is
  'Încadrarea unei curse în RO e-Transport, așa cum o declară omul (0217). Nu se deduce din bunuri.';

-- ============================================================
-- 3. Coloana pe cursă (tabela F4)
-- ============================================================
-- Default constant: pe PG 17 nu rescrie tabela.
alter table public.trip_sheet_curse
  add column if not exists e_transport public.e_transport_incadrare not null default 'neaplicabil';

comment on column public.trip_sheet_curse.e_transport is
  'Afirmația șoferului că pe cursă circulă bunuri monitorizate RO e-Transport (0217). NU se deduce din bunuri: lista se schimbă prin ordin ANAF.';

-- ============================================================
-- 4. Formatul și cifrele de control
-- ============================================================
-- Suma minimă e 14 × 48 = 672, deci are mereu cel puțin trei cifre, iar
-- `right(…, 2)` păstrează zeroul inițial (1203 → „03”). Subinterogarea stă în
-- funcție, fiindcă un CHECK nu acceptă subinterogări.
create or replace function app.uit_valid(p_uit text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_uit is not null
     and p_uit ~ '^[0-9ACDEFHJKLMNPQRTUVWXY]{14}[0-9]{2}$'
     and right(
           (select sum(ascii(substr(p_uit, g.i, 1)))
              from generate_series(1, 14) as g(i))::text,
           2) = substr(p_uit, 15, 2);
$$;

comment on function app.uit_valid(text) is
  'Formatul și cifrele de control ale codului UIT, după XSD-ul schema_ETR_v2_20230126 (UitType) și regula BR-019 din Schematron-ul ANAF v2.0.2, 12.08.2024 (0217).';

revoke all on function app.uit_valid(text) from public, anon;
grant execute on function app.uit_valid(text) to authenticated, service_role;

-- ============================================================
-- 5. public.trip_sheet_uit
-- ============================================================
create table public.trip_sheet_uit (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  -- `on delete cascade`, ca `fuel_entries.trip_sheet_id` (0012): un `restrict`
  -- ar rupe ștergerea fizică în cascadă a unei organizații. Aplicația nu face
  -- DELETE fizic (grant doar select/insert/update).
  -- Denormalizat ca RLS-ul să fie copia literală a curselor
  -- (`app.foaie_sofer(trip_sheet_id)`): îl trimite clientul, îl VERIFICĂ
  -- triggerul, nu-l suprascrie.
  trip_sheet_id     uuid not null references public.trip_sheets (id) on delete cascade,
  cursa_id          uuid not null references public.trip_sheet_curse (id) on delete cascade,
  uit               text not null,
  -- „Data declarată pentru începerea transportului” (OUG 41/2022 art. 2
  -- pct. 10; `dataTransport` în XSD). Termenul curge de la ea, inclusiv.
  data_inceput      date not null,
  -- În ZILE, nu enum 5/15: termenul din art. 11 alin. (2) a fost deja rescris
  -- o dată (OUG 132/2022). Formularul oferă 5 și 15.
  valabilitate_zile smallint not null default 5,
  -- PRIMA zi în care codul NU mai e valabil, ca `data_exp_uit` de la ANAF.
  expira_la         date generated always as (data_inceput + valabilitate_zile) stored,
  observatii        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users (id) on delete set null,
  updated_by        uuid references auth.users (id) on delete set null,
  deleted_at        timestamptz,
  constraint tsu_uit_format check (app.uit_valid(uit)),
  constraint tsu_valabilitate_ck check (valabilitate_zile between 1 and 31),
  constraint tsu_observatii_len check (observatii is null or char_length(observatii) <= 200)
);

comment on table public.trip_sheet_uit is
  'Codurile UIT (RO e-Transport) ale unei curse (0217). Aplicația le ține minte și le verifică; nu declară nimic la ANAF. Se scriu doar cât foaia e ciornă.';
comment on column public.trip_sheet_uit.expira_la is
  'Prima zi în care codul nu mai e valabil (data_inceput + valabilitate_zile), ca data_exp_uit de la ANAF. GENERATED: nu se trimite.';

-- Fără unicitate pe UIT în firmă: același cod apare legal pe mai multe curse și
-- foi (vânzarea ambulantă, transportul de mai multe zile, schimbarea vehiculului
-- pe drum, OUG 41/2022 art. 8 alin. (1^1)). Doar pe aceeași cursă, o dată.
create unique index tsu_cursa_uit_uq
  on public.trip_sheet_uit (cursa_id, uit)
  where deleted_at is null;
create index tsu_foaie_idx
  on public.trip_sheet_uit (trip_sheet_id)
  where deleted_at is null;
create index tsu_org_uit_idx
  on public.trip_sheet_uit (organization_id, uit)
  where deleted_at is null;

-- ============================================================
-- 6. internal.uit_inainte — normalizarea, identitatea și starea foii
-- ============================================================
-- BEFORE: rulează înaintea CHECK-urilor și a `WITH CHECK`-ului RLS, deci
-- CHECK-ul vede codul normalizat. SECURITY DEFINER ca să citească foaia
-- indiferent de RLS-ul apelantului; accesul real îl filtrează politicile.
--
-- Contextul de serviciu sare DOAR peste poarta de stare, ca la
-- `internal.curse_inainte`. Normalizarea și identitatea rândului sunt
-- integritate, nu drept: un import de serviciu care pune codul pe o cursă din
-- altă foaie e la fel de greșit.
--
-- Poarta de apartenență (pasul 3): fără ea, un utilizator din firma B care
-- trimite `organization_id` al firmei A și o cursă a ei ar afla, din mesajul de
-- stare, dacă foaia firmei A e ciornă. Cu ea, cursa altei firme și cursa
-- inexistentă dau același mesaj. Între colegi din aceeași firmă, ordinea
-- trigger → `WITH CHECK` scurge doar STAREA foii, ca la curse și alimentări.
create or replace function internal.uit_inainte()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_serviciu boolean := app.is_service_context();
  v_foaie    uuid;
  v_org      uuid;
  v_status   public.trip_sheet_status;
  v_stearsa  boolean;
begin
  -- 1. Normalizarea minimă: majuscule, fără spații, puncte și cratime.
  --    Maparea O→0, I→1, Z→2, S→5, G→6, B→8 o face DOAR formularul: aici un
  --    import care trimite „O” primește refuzul CHECK-ului, nu o corectură tăcută.
  new.uit := upper(regexp_replace(coalesce(new.uit, ''), '[\s.\-]', '', 'g'));

  if tg_op = 'UPDATE' then
    -- 2. Identitatea rândului nu se mută.
    if new.cursa_id is distinct from old.cursa_id
       or new.trip_sheet_id is distinct from old.trip_sheet_id
       or new.organization_id is distinct from old.organization_id then
      raise exception using errcode = 'P0001',
        message = 'Codul UIT nu se mută pe altă cursă. Ștergeți-l și adăugați-l pe cursa corectă.';
    end if;
    -- 2b. Codul însuși nu se rescrie: un cod greșit se șterge logic și se
    --     adaugă din nou, ca auditul să le arate pe amândouă.
    if new.uit is distinct from old.uit then
      raise exception using errcode = 'P0001',
        message = 'Codul UIT nu se corectează pe loc. Ștergeți-l și adăugați codul corect.';
    end if;
  end if;

  -- 3. Firma apelantului.
  if not v_serviciu and not app.is_member(new.organization_id) then
    raise exception using errcode = 'P0001', message = 'Cursa nu există în această organizație.';
  end if;

  -- 4. Cursa, foaia și firma trebuie să fie aceleași.
  select c.trip_sheet_id, t.organization_id, t.status,
         (c.deleted_at is not null or t.deleted_at is not null)
    into v_foaie, v_org, v_status, v_stearsa
    from public.trip_sheet_curse c
    join public.trip_sheets t on t.id = c.trip_sheet_id
   where c.id = new.cursa_id;
  if v_foaie is null or v_org is distinct from new.organization_id then
    raise exception using errcode = 'P0001', message = 'Cursa nu există în această organizație.';
  end if;
  if v_foaie is distinct from new.trip_sheet_id then
    raise exception using errcode = 'P0001',
      message = 'Cursa aleasă nu aparține acestei foi de parcurs.';
  end if;
  if v_stearsa and tg_op = 'INSERT' then
    raise exception using errcode = 'P0001', message = 'Cursa a fost ștearsă. Reîncărcați foaia.';
  end if;

  -- 5. Doar pe ciornă, ca liniile (0200 §D1). Excepția e ștergerea logică în
  --    cascadă (§7), marcată prin `app.flota_cascada_uit`: foaia aprobată se
  --    stornează (deleted_at, sub `trip_sheets:update = all`), iar codurile ei
  --    trebuie să o urmeze. PostgREST nu expune `set_config`, deci GUC-ul nu
  --    vine din cerere.
  if not v_serviciu
     and v_status <> 'draft'
     and coalesce(current_setting('app.flota_cascada_uit', true), '') <> 'on' then
    raise exception using errcode = 'P0001',
      message = 'Codurile UIT se modifică doar cât foaia de parcurs este ciornă. Retrageți-o sau redeschideți-o în ciornă, apoi corectați-o.';
  end if;

  return new;
end;
$$;

-- `uit_inainte` sortează după `trg_trip_sheet_uit_actor` și
-- `trip_sheet_uit_set_updated_at` (BEFORE, ordine alfabetică): actorul e deja
-- pus când garda rulează.
create trigger uit_inainte before insert or update on public.trip_sheet_uit
  for each row execute function internal.uit_inainte();

-- ============================================================
-- 7. Cascada: cursa ștearsă și foaia ștearsă își iau codurile cu ele
-- ============================================================
-- Altfel codurile ar rămâne orfane, ar umfla avertismentele „UIT expirat” și ar
-- apărea pe PDF. Foaia se șterge logic FĂRĂ curse (`stergeFoaie` pe ciornă,
-- stornarea foii aprobate), deci al doilea trigger e pe `trip_sheets`.
--
-- SECURITY DEFINER, proprietar `postgres`: pe bancul local e superuser, pe
-- proiect are `rolbypassrls` (0075, 0132), deci FORCE RLS nu taie UPDATE-ul.
-- Gărzile din `uit_inainte` rulează totuși sub identitatea apelantului
-- (`auth.uid()` și GUC-ul `role` nu se schimbă prin SECURITY DEFINER), iar
-- `updated_by` vine din rândul șters, deci rămâne actorul real.
create or replace function internal.curse_sterge_uit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    perform set_config('app.flota_cascada_uit', 'on', true);
    update public.trip_sheet_uit u
       set deleted_at = new.deleted_at, updated_by = new.updated_by
     where u.cursa_id = new.id and u.deleted_at is null;
    perform set_config('app.flota_cascada_uit', '', true);
  end if;
  return null;
end;
$$;

create or replace function internal.foi_sterge_uit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    perform set_config('app.flota_cascada_uit', 'on', true);
    update public.trip_sheet_uit u
       set deleted_at = new.deleted_at, updated_by = new.updated_by
     where u.trip_sheet_id = new.id and u.deleted_at is null;
    perform set_config('app.flota_cascada_uit', '', true);
  end if;
  return null;
end;
$$;

create trigger curse_sterge_uit after update of deleted_at on public.trip_sheet_curse
  for each row execute function internal.curse_sterge_uit();
create trigger foi_sterge_uit after update of deleted_at on public.trip_sheets
  for each row execute function internal.foi_sterge_uit();

revoke all on function internal.uit_inainte() from public, anon, authenticated;
revoke all on function internal.curse_sterge_uit() from public, anon, authenticated;
revoke all on function internal.foi_sterge_uit() from public, anon, authenticated;

-- ============================================================
-- 8. RLS: copia literală a `curse_*` (0200 §9)
-- ============================================================
-- Citirea după foaie, scrierea pe `trip_sheets:update` (`app.poate_scrie_foaie`),
-- autorul fixat. Fără `deleted_at` în USING-ul de SELECT (0016: politica de
-- SELECT se aplică și rândului nou al unei ștergeri logice).
alter table public.trip_sheet_uit enable row level security;
alter table public.trip_sheet_uit force row level security;

create policy uit_select on public.trip_sheet_uit
  for select to authenticated
  using (
    (select app.is_platform_admin())
    or (
      organization_id = any ((select app.current_org_ids())::uuid[])
      and app.feature_on(organization_id, 'fleet')
      and app.poate_vedea_foaie(organization_id, app.foaie_sofer(trip_sheet_id))
    )
  );

create policy uit_insert on public.trip_sheet_uit
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.poate_scrie_foaie(organization_id, app.foaie_sofer(trip_sheet_id))
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy uit_update on public.trip_sheet_uit
  for update to authenticated
  using (
    deleted_at is null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.poate_scrie_foaie(organization_id, app.foaie_sofer(trip_sheet_id))
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.poate_scrie_foaie(organization_id, app.foaie_sofer(trip_sheet_id))
    and updated_by = (select auth.uid())
  );
-- NICIO politică DELETE. Ștergerea e logică, prin deleted_at.

-- ============================================================
-- 9. Actor, audit, drepturi
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['trip_sheet_uit'] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function internal.seteaza_updated_at()',
      t || '_set_updated_at', t);
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function internal.set_actor()',
      'trg_' || t || '_actor', t);
    perform internal.attach_audit(t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end
$$;

-- ============================================================
-- 10. Garda finală
-- ============================================================
do $$
declare
  v_lipsa text[] := array[]::text[];
  v_exemplu text;
begin
  -- Cele 11 exemple din comentariul Schematron-ului ANAF v2.0.2 trec; o cifră
  -- de control schimbată și o literă scoasă din alfabet (B) nu.
  foreach v_exemplu in array array[
    '3V0P0L0P0T3JUW46', '4C0U0C0J0W3DDQ92', '5Y0Q0L0A0Y3AJA00', '6N0U0A0A0K3PUM07',
    '7M0L0P0H0K3RAP05', '8H0Q0V0L0Q3WQN41', '9E0P0C0J0J3DQV99', '0C1E0K0N0M3EHP79',
    '1C1E0Y0Y0N3YLK25', '2D1R0D0L0N3CYH94', '3H1M0A0E0J3FKN75'] loop
    if not app.uit_valid(v_exemplu) then
      v_lipsa := v_lipsa || ('exemplul ANAF ' || v_exemplu);
    end if;
  end loop;
  if app.uit_valid('3V0P0L0P0T3JUW47') or app.uit_valid('3V0P0L0P0T3JUB46')
     or app.uit_valid('3V0P0L0P0T3JUW4') or app.uit_valid(null) then
    v_lipsa := v_lipsa || 'refuzul codurilor greșite în app.uit_valid'::text;
  end if;

  if (select count(*) from pg_trigger
       where tgrelid = 'public.trip_sheet_uit'::regclass and not tgisinternal and tgenabled <> 'D'
         and tgname in ('uit_inainte', 'trg_trip_sheet_uit_actor', 'trip_sheet_uit_set_updated_at')) <> 3 then
    v_lipsa := v_lipsa || 'triggerele de pe trip_sheet_uit'::text;
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'curse_sterge_uit'
                  and tgrelid = 'public.trip_sheet_curse'::regclass and not tgisinternal) then
    v_lipsa := v_lipsa || 'triggerul curse_sterge_uit'::text;
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'foi_sterge_uit'
                  and tgrelid = 'public.trip_sheets'::regclass and not tgisinternal) then
    v_lipsa := v_lipsa || 'triggerul foi_sterge_uit'::text;
  end if;
  if (select count(*) from pg_policy where polrelid = 'public.trip_sheet_uit'::regclass) <> 3
     or exists (select 1 from pg_policy where polrelid = 'public.trip_sheet_uit'::regclass
                 and polcmd in ('d', '*')) then
    v_lipsa := v_lipsa || 'exact trei politici, niciuna DELETE sau ALL'::text;
  end if;
  if not (select relforcerowsecurity from pg_class where oid = 'public.trip_sheet_uit'::regclass) then
    v_lipsa := v_lipsa || 'FORCE RLS pe trip_sheet_uit'::text;
  end if;
  if has_table_privilege('authenticated', 'public.trip_sheet_uit', 'DELETE')
     or has_table_privilege('anon', 'public.trip_sheet_uit', 'SELECT') then
    v_lipsa := v_lipsa || 'granturile (fără DELETE pentru authenticated, nimic pentru anon)'::text;
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'internal'
                and p.proname in ('uit_inainte', 'curse_sterge_uit', 'foi_sterge_uit')
                and (p.proconfig is null or not ('search_path=""' = any (p.proconfig)))) then
    v_lipsa := v_lipsa || 'search_path gol pe funcțiile internal.*_uit'::text;
  end if;
  if has_function_privilege('authenticated', 'internal.uit_inainte()', 'execute')
     or has_function_privilege('authenticated', 'internal.curse_sterge_uit()', 'execute')
     or has_function_privilege('authenticated', 'internal.foi_sterge_uit()', 'execute') then
    v_lipsa := v_lipsa || 'authenticated poate executa un trigger internal.*_uit'::text;
  end if;
  if array_length(v_lipsa, 1) > 0 then
    raise exception '0217: lipsesc %', array_to_string(v_lipsa, ', ');
  end if;
end $$;

commit;

-- ============================================================
-- 11. Note de proiectare
-- ============================================================
-- · Fără backfill: coloana nouă primește „neaplicabil” din default, iar tabela
--   pornește goală. Controlul la aplicare: `select count(*) from
--   public.trip_sheet_curse where e_transport <> 'neaplicabil'` dă 0.
-- · Pragul de vehicul (2,5 t, Ordinul 1.337/1.268/2024 art. 1 alin. (4)) e doar
--   o notă a aplicației: `masa_maxima_kg` poate fi masa autorizată, nu cea
--   tehnic admisibilă din ordin.
-- · Dacă ANAF schimbă algoritmul cifrelor de control (o versiune nouă de XSD),
--   CHECK-ul refuză coduri reale până la o migrare care rescrie `app.uit_valid`
--   (riscul asumat în decizia I-f4).
-- · Cine scrie codul pe foaia altcuiva: doar `org_admin` (`trip_sheets:update =
--   all`), decizia I-f6. Managerul citește codurile echipei, nu le scrie.
