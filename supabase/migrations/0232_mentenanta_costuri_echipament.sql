-- supabase/migrations/0232_mentenanta_costuri_echipament.sql
--
-- MENTENANȚĂ, PACHETUL Y1: VALOAREA DE ACHIZIȚIE NU MAI STĂ PE UN RÂND PE CARE
-- ÎL VEDE TEHNICIANUL.
--
-- ── DE CE ───────────────────────────────────────────────────────────────────
-- `equipment.valoare_achizitie` (0011) e o COLOANĂ a rândului echipamentului,
-- iar `equipment_select` (forma ultimă: 0182 §6) dă rândul întreg și:
--   · RESPONSABILULUI echipamentului (portalul „Echipamentele în grija mea”),
--     de regulă un `employee` cu `maintenance:read = own`;
--   · TEHNICIANULUI atribuit unei sesizări pe utilaj (0181), oricare i-ar fi
--     rolul.
-- RLS-ul taie rânduri, nu coloane, iar privilegiul pe coloană e al rolului
-- Postgres `authenticated`, comun tuturor rolurilor aplicației (raționamentul
-- din 0225). Un `select=*` direct prin PostgREST le aducea valoarea. E aceeași
-- clasă ca `vehicles.valoare_achizitie`, închisă în 0225 pentru flotă.
--
-- ── PRINCIPIUL (cel al flotei, decizia utilizatorului din 21 oct) ───────────
-- Angajatul nu vede costuri. Valoarea o vede cine are deja dreptul de citire pe
-- costurile mentenanței și cine o scrie:
--   · `maintenance:update = all` — o scrie (și o vede);
--   · `maintenance:read >= team` (`app.ssm_acces(…, 'read', null)`) — cheia sub
--     care se citesc AZI costurile intervențiilor (`maintenance_interventions_select`)
--     și raportul pe perioadă, care împarte costul pe 12 luni la valoare
--     („Cost / valoare”, `.claude/docs/modul/mentenanta/rapoarte.md`: costurile
--     sunt ale firmei și pentru manager). Nu există o cheie separată pentru
--     costurile mentenanței (grep în `src/config/permissions.ts` și în seed).
-- Ramurile de rând ale lui `equipment_select` (responsabilul, tehnicianul) NU
-- primesc valoarea: ele există ca omul să-și vadă utilajul, nu costul lui.
--
-- ── FORMA ALEASĂ: tabelă 1:1, ca 0225 ──────────────────────────────────────
-- A. `public.equipment_costuri` (1:1 cu echipamentul): `valoare_achizitie`.
--    Citirea: `app.poate_vedea_valoarea_echipamentelor`. Scrierea:
--    `maintenance:update = all`.
-- B. Backfill din coloana veche, apoi coloana GOLITĂ (nu aruncată) și închisă cu
--    un CHECK `is null`.
-- C. Coloana veche rămâne doar ca INTRARE de compatibilitate: o valoare NENULĂ
--    scrisă în ea ajunge, în aceeași instrucțiune, în tabela de costuri, iar
--    coloana se golește (trigger BEFORE). Valoarea NULĂ se ignoră. Triggerul NU
--    are defectul găsit pe 0225 (constatările e și f ale revizuirii): pe
--    `INSERT … ON CONFLICT DO NOTHING` cu `id`-ul altei firme nu mută nimic.
--
-- ── DE CE NU ARUNC COLOANA AICI ─────────────────────────────────────────────
-- Între aplicarea migrării pe producție și deploy rulează aplicația VECHE, care
-- citește `valoare_achizitie` cu liste explicite de coloane: aruncată, fișa
-- echipamentului și raportul ar cădea cu 42703. Golită, aplicația veche arată
-- „—” câteva minute. Coloana se aruncă într-o migrare ULTERIOARĂ deploy-ului;
-- aplicația nouă n-o mai citește (poarta `coloane.test.ts`) și n-o mai scrie.
--
-- ── DE CE O VALOARE NULĂ NU GOLEȘTE COSTUL (punctul C) ─────────────────────
-- Aplicația veche își precompletează formularul din coloana veche, deci, în
-- fereastră, trimite `null` la orice corectură. Dacă `null` ar goli costul, o
-- corectură de denumire ar șterge tăcut valoarea mutată aici. Golirea se face
-- DOAR în tabela de costuri (aplicația nouă: upsert cu `null`).
--
-- ── DE CE FĂRĂ `deleted_at` ȘI CU UNIC TOTAL ───────────────────────────────
-- Rândul de cost trăiește cât echipamentul (ON DELETE CASCADE, iar echipamentul
-- se șterge logic, nu fizic): un cost „șters” e un cost `null`. Unicitatea pe
-- `equipment_id` e o CONSTRÂNGERE totală, nu un index parțial: upsert-ul
-- PostgREST (`on_conflict`) nu poate numi predicatul unui index parțial și ar
-- cădea cu 42P10 (precedentul 0225).
--
-- ── DE CE `created_by` / `updated_by` FĂRĂ CHEIE STRĂINĂ ────────────────────
-- Ca rândul-părinte (familia `internal.tmpl_ssm`, 0011): `equipment.created_by`
-- n-are cheie spre `auth.users`, deci poate ține id-ul unui cont șters. Cu
-- cheie aici, backfill-ul ar cădea pe primul astfel de rând.

begin;

-- ============================================================
-- 1. Tabela
-- ============================================================
create table public.equipment_costuri (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  equipment_id      uuid not null,
  valoare_achizitie numeric(14, 2),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid,
  updated_by        uuid,
  constraint ec_echipament_uq unique (equipment_id),
  -- DEFERRABLE: §6 o inserează din BEFORE INSERT pe `equipment`, când rândul
  -- echipamentului încă nu există. Verificarea se face la COMMIT.
  constraint ec_echipament_fk foreign key (equipment_id)
    references public.equipment (id) on delete cascade deferrable initially deferred,
  constraint ec_valoare_ck check (valoare_achizitie is null or valoare_achizitie >= 0)
);

comment on table public.equipment_costuri is
  'Valoarea de achiziție a echipamentului (0232), 1:1 cu `equipment`. Separată ca s-o citească doar cine vede costurile mentenanței (`app.poate_vedea_valoarea_echipamentelor`), nu și responsabilul sau tehnicianul care văd rândul echipamentului.';

create index ec_org_idx on public.equipment_costuri (organization_id);

-- ============================================================
-- 2. Cine vede valoarea
-- ============================================================
-- Nu depinde de echipament: `equipment_select` nu are ancoră de angajat
-- (`app.ssm_acces(…, 'read', null)` cere `team`, iar `team` vede tot parcul).
create or replace function app.poate_vedea_valoarea_echipamentelor(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_organization_id is not null
     and (app.has_permission(p_organization_id, 'maintenance', 'update') = 'all'
          or app.ssm_acces(p_organization_id, 'maintenance', 'read', null));
$$;

comment on function app.poate_vedea_valoarea_echipamentelor(uuid) is
  'Cine vede valoarea de achiziție a echipamentelor (0232): maintenance:update = all, sau maintenance:read >= team (cheia costurilor intervențiilor și a raportului). Responsabilul și tehnicianul atribuit, care văd rândul echipamentului, nu.';

revoke all on function app.poate_vedea_valoarea_echipamentelor(uuid) from public, anon;
grant execute on function app.poate_vedea_valoarea_echipamentelor(uuid) to authenticated, service_role;

-- ============================================================
-- 3. Garda tabelei de costuri
-- ============================================================
-- Integritate, nu drepturi: rulează și în contextul de serviciu. Rândul de cost
-- aparține echipamentului din ACEEAȘI firmă și nu se mută. Pe drumul de
-- compatibilitate (§6) echipamentul încă nu există în BEFORE INSERT; acolo
-- steagul `app.mentenanta_cost_mutat` sare DOAR verificarea de existență.
-- Verificarea de firmă rămâne și cu steagul pus, și la UPDATE: un echipament
-- care EXISTĂ trebuie să fie al firmei rândului de cost (lecția constatării (e)
-- din 0225). Mesajul e același ca pentru echipamentul inexistent: fără oracol.
create or replace function internal.ec_inainte()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and (new.organization_id, new.equipment_id) is distinct from (old.organization_id, old.equipment_id) then
    raise exception using errcode = 'P0001',
      message = 'Valoarea de achiziție nu se mută pe alt echipament.';
  end if;
  if exists (select 1 from public.equipment e
              where e.id = new.equipment_id and e.organization_id <> new.organization_id) then
    raise exception using errcode = 'P0001',
      message = 'Echipamentul ales nu există în organizația dumneavoastră.';
  end if;
  if tg_op = 'INSERT'
     and coalesce(pg_catalog.current_setting('app.mentenanta_cost_mutat', true), '') <> 'on'
     and not exists (select 1 from public.equipment e
                      where e.id = new.equipment_id and e.organization_id = new.organization_id
                        and e.deleted_at is null) then
    raise exception using errcode = 'P0001',
      message = 'Echipamentul ales nu există în organizația dumneavoastră.';
  end if;
  return new;
end;
$$;

create trigger ec_inainte
  before insert or update on public.equipment_costuri
  for each row execute function internal.ec_inainte();

-- ============================================================
-- 4. RLS
-- ============================================================
alter table public.equipment_costuri enable row level security;
alter table public.equipment_costuri force row level security;

create policy ec_select on public.equipment_costuri
  for select to authenticated
  using (
    (select app.is_platform_admin())
    or (
      organization_id = any ((select app.current_org_ids())::uuid[])
      and app.feature_on(organization_id, 'maintenance')
      and app.poate_vedea_valoarea_echipamentelor(organization_id)
    )
  );

-- Scrierea: `maintenance:update = all`. Mai strânsă decât rândul-părinte
-- (`equipment_insert/update` cer `update >= team`): un gestionar pe `team`
-- editează echipamentul, nu valoarea (fișa nu-i arată câmpul).
create policy ec_insert on public.equipment_costuri
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'maintenance')
    and app.has_permission(organization_id, 'maintenance', 'update') = 'all'
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy ec_update on public.equipment_costuri
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'maintenance')
    and app.has_permission(organization_id, 'maintenance', 'update') = 'all'
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'maintenance')
    and app.has_permission(organization_id, 'maintenance', 'update') = 'all'
    and updated_by = (select auth.uid())
  );

-- ============================================================
-- 5. Actor, audit, drepturi
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['equipment_costuri'] loop
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
-- 6. Coloana veche: intrare de compatibilitate
-- ============================================================
-- O valoare NENULĂ scrisă în `equipment.valoare_achizitie` (aplicația veche în
-- fereastra dintre migrare și deploy, scripturi, fixture-uri) se mută în tabela
-- de costuri în aceeași instrucțiune, iar coloana rămâne goală. `null` nu atinge
-- costul (vezi antetul).
--
-- Triggerul rulează BEFORE, cu drepturile proprietarului, deci ÎNAINTEA
-- verificării RLS a echipamentului și înaintea conflictului din
-- `INSERT … ON CONFLICT`. Pe `ON CONFLICT DO NOTHING` (upsert-ul PostgREST cu
-- `resolution=ignore-duplicates`) WITH CHECK judecă rândul PROPUS, conflictul îl
-- sare fără eroare, iar o mutare făcută deja ar rămâne. De aceea, aceleași
-- închideri ca în 0225 după reparație, plus dreptul:
--   1. pe INSERT, un `id` care EXISTĂ deja (în orice firmă, și șters logic)
--      înseamnă calea de conflict: coloana se golește, nimic nu se mută;
--   2. în afara contextului de serviciu, mutarea cere dreptul de scriere al
--      tabelei de costuri (`maintenance:update = all`): rândul-părinte se scrie
--      și cu `update = team`, deci coloana veche ar fi ocolit politica (42501);
--   3. `do update` atinge doar rândul de cost al ACELEIAȘI firme; dacă n-a
--      atins nimic, instrucțiunea cade;
--   4. `ec_inainte` verifică firma echipamentului și cu steagul pus.
create or replace function internal.equipment_valoare_in_costuri()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_steag text := coalesce(pg_catalog.current_setting('app.mentenanta_cost_mutat', true), '');
  v_actor uuid := coalesce(new.updated_by, auth.uid());
  v_n     integer;
begin
  if tg_op = 'INSERT' and exists (select 1 from public.equipment e where e.id = new.id) then
    new.valoare_achizitie := null;
    return new;
  end if;
  if not app.is_service_context()
     and app.has_permission(new.organization_id, 'maintenance', 'update') is distinct from 'all' then
    raise exception using errcode = '42501',
      message = 'Nu aveți dreptul de a modifica valoarea de achiziție a echipamentului.';
  end if;
  perform pg_catalog.set_config('app.mentenanta_cost_mutat', 'on', true);
  insert into public.equipment_costuri (organization_id, equipment_id, valoare_achizitie, created_by, updated_by)
  values (new.organization_id, new.id, new.valoare_achizitie, v_actor, v_actor)
  on conflict (equipment_id) do update
    set valoare_achizitie = excluded.valoare_achizitie,
        updated_by = excluded.updated_by
    where public.equipment_costuri.organization_id = excluded.organization_id;
  get diagnostics v_n = row_count;
  perform pg_catalog.set_config('app.mentenanta_cost_mutat', v_steag, true);
  if v_n = 0 then
    raise exception using errcode = 'P0001',
      message = 'Echipamentul ales nu există în organizația dumneavoastră.';
  end if;
  new.valoare_achizitie := null;
  return new;
end;
$$;

create trigger equipment_valoare_in_costuri
  before insert or update of valoare_achizitie on public.equipment
  for each row
  when (new.valoare_achizitie is not null)
  execute function internal.equipment_valoare_in_costuri();

comment on column public.equipment.valoare_achizitie is
  'GOALĂ din 0232: valoarea stă în `equipment_costuri`. O valoare nenulă scrisă aici se mută acolo (trigger) — doar compatibilitate până se aruncă coloana.';

-- ============================================================
-- 7. Backfill și golirea coloanei vechi
-- ============================================================
-- Fără triggere de utilizator (precedentul 0225 §7): nimic din echipamente nu
-- se schimbă în afara coloanei golite (nici `updated_at`, nici auditul), iar
-- `ec_inainte` ar refuza echipamentele șterse logic, care își păstrează valoarea.
do $$
declare
  v_echipamente integer;
  v_mutate      integer;
begin
  select count(*) into v_echipamente from public.equipment where valoare_achizitie is not null;

  -- Cheia străină DEFERRABLE și-ar lăsa verificarea „în așteptare” până la
  -- COMMIT, iar `alter table … enable trigger` refuză o tabelă cu evenimente în
  -- așteptare. Aici echipamentele există deja: verificarea se face pe loc.
  set constraints public.ec_echipament_fk immediate;

  alter table public.equipment_costuri disable trigger user;
  insert into public.equipment_costuri
    (organization_id, equipment_id, valoare_achizitie, created_at, updated_at, created_by, updated_by)
  select e.organization_id, e.id, e.valoare_achizitie, e.created_at, e.updated_at, e.created_by, e.updated_by
    from public.equipment e
   where e.valoare_achizitie is not null;
  get diagnostics v_mutate = row_count;
  if v_mutate <> v_echipamente then
    raise exception '0232: backfill incomplet — % echipamente cu valoare, % mutate.', v_echipamente, v_mutate;
  end if;
  alter table public.equipment_costuri enable trigger user;

  alter table public.equipment disable trigger user;
  update public.equipment set valoare_achizitie = null where valoare_achizitie is not null;
  alter table public.equipment enable trigger user;

  raise notice '0232: mutate % valori de achiziție ale echipamentelor.', v_echipamente;
end
$$;

-- Plasa de siguranță: dacă triggerul din §6 e vreodată oprit, scrierea cade
-- (23514) în loc să redeschidă scurgerea.
alter table public.equipment
  add constraint equipment_valoare_mutata_ck check (valoare_achizitie is null);

-- ============================================================
-- 8. Funcțiile interne: fără EXECUTE pentru nimeni în afara proprietarului
-- ============================================================
revoke all on function internal.ec_inainte() from public, anon, authenticated;
revoke all on function internal.equipment_valoare_in_costuri() from public, anon, authenticated;

-- ============================================================
-- 9. Verificare
-- ============================================================
do $$
declare
  v_lipsa text[] := '{}';
begin
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'equipment_costuri') <> 3 then
    v_lipsa := v_lipsa || 'trio-ul de politici pe equipment_costuri'::text;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'equipment_costuri'
              and cmd in ('DELETE', 'ALL')) then
    v_lipsa := v_lipsa || 'politică DELETE / ALL pe equipment_costuri (interzisă)'::text;
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'equipment_costuri'
                  and cmd = 'UPDATE' and qual is not null and with_check is not null) then
    v_lipsa := v_lipsa || 'USING + WITH CHECK pe equipment_costuri'::text;
  end if;
  if not (select relforcerowsecurity from pg_class where oid = 'public.equipment_costuri'::regclass) then
    v_lipsa := v_lipsa || 'FORCE RLS pe equipment_costuri'::text;
  end if;
  if has_table_privilege('authenticated', 'public.equipment_costuri', 'DELETE') then
    v_lipsa := v_lipsa || 'DELETE acordat pe equipment_costuri'::text;
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'audit_equipment_costuri'
                  and tgrelid = 'public.equipment_costuri'::regclass) then
    v_lipsa := v_lipsa || 'auditul pe equipment_costuri'::text;
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'equipment_valoare_in_costuri'
                  and tgrelid = 'public.equipment'::regclass and tgenabled = 'O') then
    v_lipsa := v_lipsa || 'triggerul de compatibilitate pe equipment'::text;
  end if;
  if exists (select 1 from public.equipment where valoare_achizitie is not null) then
    v_lipsa := v_lipsa || 'equipment.valoare_achizitie golită'::text;
  end if;
  -- Ramurile de rând ale lui `equipment_select` (responsabilul, tehnicianul) nu
  -- au voie să ajungă în funcția valorii.
  if position('fisa_mea' in pg_get_functiondef('app.poate_vedea_valoarea_echipamentelor(uuid)'::regprocedure)) > 0
     or position('responsabil' in pg_get_functiondef('app.poate_vedea_valoarea_echipamentelor(uuid)'::regprocedure)) > 0 then
    v_lipsa := v_lipsa || 'poate_vedea_valoarea_echipamentelor fără ramurile responsabilului și tehnicianului'::text;
  end if;
  if array_length(v_lipsa, 1) > 0 then
    raise exception '0232: lipsesc %', array_to_string(v_lipsa, ', ');
  end if;
end
$$;

commit;
