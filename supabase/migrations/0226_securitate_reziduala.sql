-- supabase/migrations/0226_securitate_reziduala.sql
--
-- RESTURILE DE SECURITATE ALE LIVRĂRII FLOTĂ / MENTENANȚĂ / SALARIZARE (X2).
--
-- Tot ce atinge tabele și funcții care sunt DEJA pe producție (0001–0198) stă
-- aici, forward-only. Ce ține de migrările încă neaplicate (0200, 0206, 0214,
-- 0215) s-a reparat pe loc, în ele.
--
-- ── 1. ORACOLUL DE EXISTENȚĂ ÎNTRE FIRME ────────────────────────────────────
-- `hr_read_sensitive` (0006) răspundea DIFERIT pentru un id care nu există
-- („Fișa de angajat nu există sau a fost ștearsă.”) și pentru fișa unei ALTE
-- firme („Fișa de angajat aparține altei organizații.”). Orice utilizator
-- autentificat putea deci afla, id cu id, ce angajați există în firmele
-- celelalte. Aceeași construcție, în trei locuri gemene: `hr_write_sensitive`
-- (0006), `seed_leave_balances` (forma ultimă 0193) și triggerul lanțului de
-- manageri `tg_employees_manager_path` (0004; managerul din altă firmă vs
-- managerul inexistent). Toate primesc UN singur răspuns, cu același cod
-- (P0001), pentru „nu există”, „e șters” și „e al altei firme”. Funcțiile sunt
-- rescrise de la forma ultimă (grep pe toate migrările, inclusiv 0199–0218):
-- 0006 pentru cele două `hr_*_sensitive`, 0193 pentru `seed_leave_balances`,
-- 0004 pentru `tg_employees_manager_path`. Restul corpului e neschimbat.
-- Garda din 0023 (`'employees', 'read') <> 'all'` în corpul lui
-- `hr_read_sensitive`) se păstrează și se verifică din nou în §4.
--
-- ── 2. super_admin VEDEA ZERO FOI DE PARCURS ────────────────────────────────
-- `foi_select` (forma ultimă 0016) nu avea ramura `app.is_platform_admin()`,
-- spre deosebire de toate celelalte tabele ale flotei (vehicule, documente,
-- alimentări, anomalii, curse). Se aliniază, NUMAI pentru citire: nicio
-- politică de scriere nu primește ramura.
--
-- ── 3. REGISTRUL ÎNCĂRCĂRILOR DE IMPORT ─────────────────────────────────────
-- Importul de angajați și importul extraselor de card urcă fișierul în
-- `{org}/{employees|vehicles}/{batchId}/…`, apoi pasul de analiză îl ȘTERGE cu
-- clientul de serviciu (`storage.objects` n-are politică DELETE). `batchId` și
-- calea veneau din client, verificate doar ca prefix al firmei. Cum segmentul
-- 3 al unei căi `employees`/`vehicles` e de obicei id-ul unei FIȘE sau al unui
-- VEHICUL, un `batchId` egal cu id-ul unui angajat ștergea, ocolind orice
-- politică, contractul sau buletinul scanat al acelui angajat (la carduri:
-- orice .csv/.xlsx din folderul vehiculului). Registrul ține lotul emis de
-- server: id-ul îl generează serverul, calea o construiește serverul și o
-- scrie aici, iar analiza CONSUMĂ rândul (o singură dată, doar cine l-a
-- creat) înainte de ștergere. Nicio cale nu se mai șterge pe cuvântul
-- clientului.
--
-- Aplicare: psql byte-exact, după bancul local; producția cere confirmare.

begin;

-- ============================================================
-- 1. Un singur răspuns pentru „nu există” și „e al altei firme”
-- ============================================================

create or replace function public.hr_read_sensitive(p_employee uuid)
returns table (
  employee_id uuid,
  organization_id uuid,
  cnp_ciphertext bytea,
  cnp_iv bytea,
  cnp_tag bytea,
  cnp_key_version int,
  cnp_last4 text,
  iban_ciphertext bytea,
  iban_iv bytea,
  iban_tag bytea,
  iban_key_version int,
  iban_last4 text,
  banca text
)
language plpgsql
volatile                       -- scrie în audit, deci NU stable
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_campuri text[] := '{}';
  v_rec record;
begin
  -- 0226: fișa se caută DOAR în firmele apelantului. Una ștearsă, una
  -- inexistentă și una a altei firme primesc același răspuns, cu același cod:
  -- altfel funcția ar fi o sondă de existență între firme.
  select e.organization_id into v_org
  from public.employees e
  where e.id = p_employee
    and e.deleted_at is null
    and e.organization_id = any ((select app.current_org_ids())::uuid[]);

  if v_org is null then
    raise exception 'Fișa de angajat nu există în organizația dumneavoastră sau a fost ștearsă.' using errcode = 'P0001';
  end if;
  if app.has_permission(v_org, 'employees', 'read') <> 'all' then
    raise exception 'Nu aveți dreptul de a consulta datele personale sensibile (CNP, IBAN). Solicitați acest drept administratorului organizației.'
      using errcode = 'P0001';
  end if;

  select s.* into v_rec
  from public.employee_sensitive_data s
  where s.employee_id = p_employee and s.deleted_at is null;

  if not found then
    raise exception 'Angajatul nu are date sensibile înregistrate.' using errcode = 'P0001';
  end if;

  -- Castul explicit alege `anyarray || anyelement`. Fără el, Postgres încearcă
  -- `anyarray || anyarray` și cade pe „malformed array literal".
  if v_rec.cnp_ciphertext is not null then
    v_campuri := v_campuri || 'cnp'::text;
  end if;
  if v_rec.iban_ciphertext is not null then
    v_campuri := v_campuri || 'iban'::text;
  end if;

  -- Se înregistrează DOAR numele câmpurilor atinse, niciodată valorile: un rând
  -- de audit care ar conține criptotextul ar fi o a doua copie a datelor
  -- sensibile, într-o tabelă cu alte reguli de acces.
  insert into public.audit_logs (
    organization_id, actor_id, action, entity_type, entity_id, status, after
  )
  values (
    v_org, (select auth.uid()), 'view', 'employee_sensitive_data', p_employee, 'success',
    jsonb_build_object(
      'campuri_citite', to_jsonb(v_campuri),
      'motiv', 'citire date sensibile din aplicație'
    )
  );

  return query
    select v_rec.employee_id, v_rec.organization_id,
           v_rec.cnp_ciphertext, v_rec.cnp_iv, v_rec.cnp_tag, v_rec.cnp_key_version, v_rec.cnp_last4,
           v_rec.iban_ciphertext, v_rec.iban_iv, v_rec.iban_tag, v_rec.iban_key_version, v_rec.iban_last4,
           v_rec.banca;
end;
$$;

revoke all on function public.hr_read_sensitive(uuid) from public, anon;
grant execute on function public.hr_read_sensitive(uuid) to authenticated;

create or replace function public.hr_write_sensitive(
  p_employee uuid,
  p_cnp_ciphertext bytea default null,
  p_cnp_iv bytea default null,
  p_cnp_tag bytea default null,
  p_cnp_key_version int default null,
  p_cnp_last4 text default null,
  p_cnp_hash text default null,
  p_iban_ciphertext bytea default null,
  p_iban_iv bytea default null,
  p_iban_tag bytea default null,
  p_iban_key_version int default null,
  p_iban_last4 text default null,
  p_iban_hash text default null,
  p_banca text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_uid uuid := (select auth.uid());
  v_campuri text[] := '{}';
  v_exista boolean;
begin
  -- 0226: același răspuns pentru „nu există” și „e al altei firme” (vezi
  -- `hr_read_sensitive`).
  select e.organization_id into v_org
  from public.employees e
  where e.id = p_employee
    and e.deleted_at is null
    and e.organization_id = any ((select app.current_org_ids())::uuid[]);

  if v_org is null then
    raise exception 'Fișa de angajat nu există în organizația dumneavoastră sau a fost ștearsă.' using errcode = 'P0001';
  end if;
  if app.has_permission(v_org, 'employees', 'update') <> 'all' then
    raise exception 'Nu aveți dreptul de a modifica datele personale sensibile (CNP, IBAN).'
      using errcode = 'P0001';
  end if;

  if p_cnp_ciphertext is not null then
    if p_cnp_iv is null or p_cnp_tag is null or p_cnp_key_version is null then
      raise exception 'CNP-ul criptat este incomplet: lipsesc vectorul de inițializare, eticheta sau versiunea cheii.'
        using errcode = 'P0001';
    end if;
    v_campuri := v_campuri || 'cnp'::text;
  end if;
  if p_iban_ciphertext is not null then
    if p_iban_iv is null or p_iban_tag is null or p_iban_key_version is null then
      raise exception 'IBAN-ul criptat este incomplet: lipsesc vectorul de inițializare, eticheta sau versiunea cheii.'
        using errcode = 'P0001';
    end if;
    v_campuri := v_campuri || 'iban'::text;
  end if;
  if p_banca is not null then
    v_campuri := v_campuri || 'banca'::text;
  end if;

  if array_length(v_campuri, 1) is null then
    raise exception 'Nu ați indicat niciun câmp de actualizat.' using errcode = 'P0001';
  end if;

  select true into v_exista
  from public.employee_sensitive_data s
  where s.employee_id = p_employee;

  if v_exista then
    update public.employee_sensitive_data s
    set cnp_ciphertext  = coalesce(p_cnp_ciphertext, s.cnp_ciphertext),
        cnp_iv          = coalesce(p_cnp_iv, s.cnp_iv),
        cnp_tag         = coalesce(p_cnp_tag, s.cnp_tag),
        cnp_key_version = coalesce(p_cnp_key_version, s.cnp_key_version),
        cnp_last4       = coalesce(p_cnp_last4, s.cnp_last4),
        cnp_hash        = coalesce(p_cnp_hash, s.cnp_hash),
        iban_ciphertext  = coalesce(p_iban_ciphertext, s.iban_ciphertext),
        iban_iv          = coalesce(p_iban_iv, s.iban_iv),
        iban_tag         = coalesce(p_iban_tag, s.iban_tag),
        iban_key_version = coalesce(p_iban_key_version, s.iban_key_version),
        iban_last4       = coalesce(p_iban_last4, s.iban_last4),
        iban_hash        = coalesce(p_iban_hash, s.iban_hash),
        banca            = coalesce(p_banca, s.banca),
        deleted_at       = null,
        updated_by       = v_uid
    where s.employee_id = p_employee;
  else
    insert into public.employee_sensitive_data (
      employee_id, organization_id,
      cnp_ciphertext, cnp_iv, cnp_tag, cnp_key_version, cnp_last4, cnp_hash,
      iban_ciphertext, iban_iv, iban_tag, iban_key_version, iban_last4, iban_hash,
      banca, created_by, updated_by
    )
    values (
      p_employee, v_org,
      p_cnp_ciphertext, p_cnp_iv, p_cnp_tag, p_cnp_key_version, p_cnp_last4, p_cnp_hash,
      p_iban_ciphertext, p_iban_iv, p_iban_tag, p_iban_key_version, p_iban_last4, p_iban_hash,
      p_banca, v_uid, v_uid
    );
  end if;

  insert into public.audit_logs (
    organization_id, actor_id, action, entity_type, entity_id, status, after
  )
  values (
    v_org, v_uid,
    -- CASE peste literale produce `text`; coloana e enum `audit_action`.
    (case when v_exista then 'update' else 'create' end)::public.audit_action,
    'employee_sensitive_data', p_employee, 'success',
    jsonb_build_object(
      'campuri_modificate', to_jsonb(v_campuri),
      'motiv', 'scriere date sensibile din aplicație'
    )
  );

  return p_employee;
end;
$$;

revoke all on function public.hr_write_sensitive(uuid, bytea, bytea, bytea, int, text, text, bytea, bytea, bytea, int, text, text, text) from public, anon;
grant execute on function public.hr_write_sensitive(uuid, bytea, bytea, bytea, int, text, text, bytea, bytea, bytea, int, text, text, text) to authenticated;

create or replace function public.seed_leave_balances(
  p_employee uuid,
  p_an integer,
  p_zile_odihna_override numeric default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_tip record;
begin
  -- 0226: același răspuns pentru „nu există” și „e al altei firme” (vezi
  -- `hr_read_sensitive`).
  select e.organization_id into v_org
  from public.employees e
  where e.id = p_employee
    and e.deleted_at is null
    and e.organization_id = any ((select app.current_org_ids())::uuid[]);

  if v_org is null then
    raise exception 'Fișa de angajat nu există în organizația dumneavoastră sau a fost ștearsă.' using errcode = 'P0001';
  end if;
  -- Însămânțarea soldului e o consecință directă a înrolării, nu o acțiune
  -- separată de gestiune a concediilor — pragul e cel al înrolării.
  if app.has_permission(v_org, 'employees', 'create') <> 'all' then
    raise exception 'Nu aveți dreptul de a înrola angajați.' using errcode = 'P0001';
  end if;

  -- Dreptul vine integral din `app.drept_concediu`, prin `asigura_sold`:
  -- zilele de pe contractul activ, grilele și proporția cu lunile lucrate.
  for v_tip in
    select id
    from public.leave_types
    where organization_id = v_org and activ and deleted_at is null
  loop
    perform internal.asigura_sold(v_org, p_employee, v_tip.id, p_an);
  end loop;
end;
$$;

comment on function public.seed_leave_balances(uuid, integer, numeric) is
  'Însămânțează soldurile anului pentru toate tipurile active ale firmei angajatului, prin '
  'internal.asigura_sold. p_zile_odihna_override e IGNORAT din 0193: dreptul se calculează '
  'din contractul de bază în app.drept_concediu, proporțional cu lunile lucrate. '
  'Din 0226, „nu există” și „e al altei firme” primesc același răspuns.';

revoke all on function public.seed_leave_balances(uuid, integer, numeric) from public, anon;
grant execute on function public.seed_leave_balances(uuid, integer, numeric) to authenticated;

-- Lanțul de manageri. Triggerul BEFORE rulează ÎNAINTEA politicii de scriere,
-- deci un rând pus pe orice firmă ajungea aici: „nu există” vs „aparține altei
-- organizații” spunea dacă un id de manager e al unei firme anume.
create or replace function public.tg_employees_manager_path()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mgr_path uuid[];
begin
  if new.manager_employee_id is null then
    new.manager_path := array[new.id];
  else
    -- 0226: managerul se caută doar în firma rândului; un id inexistent, unul
    -- șters și unul din altă firmă primesc același răspuns.
    select e.manager_path into v_mgr_path
    from public.employees e
    where e.id = new.manager_employee_id
      and e.deleted_at is null
      and e.organization_id = new.organization_id;

    if v_mgr_path is null then
      raise exception 'Managerul indicat nu există în organizația dumneavoastră sau fișa lui a fost ștearsă.' using errcode = 'P0001';
    end if;
    if new.id = any (v_mgr_path) then
      raise exception 'Relația de subordonare ar deveni circulară pentru „% %".', new.last_name, new.first_name using errcode = 'P0001';
    end if;
    new.manager_path := v_mgr_path || new.id;
  end if;

  if array_length(new.manager_path, 1) > 12 then
    raise exception 'Lanțul de subordonare depășește 12 niveluri.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.tg_employees_manager_path() from public, anon, authenticated;

-- ============================================================
-- 2. foi_select: administratorul de platformă citește foile
-- ============================================================
-- Forma ultimă e 0016 (grep: 0171 rescrie doar `foi_insert`, 0199/0200 nu
-- ating `foi_select`). Filtrul de rând rămâne cel din 0016; se adaugă doar
-- ramura de platformă, ca la `alimentari_select` (0018) și `curse_select` (0200).
drop policy if exists foi_select on public.trip_sheets;
create policy foi_select on public.trip_sheets
  for select to authenticated
  using (
    (select app.is_platform_admin())
    or (
      organization_id = any ((select app.current_org_ids())::uuid[])
      and app.feature_on(organization_id, 'fleet')
      and app.poate_vedea_foaie(organization_id, employee_id)
    )
  );

-- ============================================================
-- 3. Registrul încărcărilor de import
-- ============================================================
create table public.import_uploads (
  id              uuid primary key,          -- = batchId, generat pe SERVER
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Segmentul 2 al căii: resursa de permisiune care păzește importul.
  resursa         text not null,
  -- Calea completă a fișierului urcat, construită pe server.
  cale            text not null,
  -- Momentul în care analiza a citit (și a șters) fișierul. O dată.
  consumat_la     timestamptz,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id) on delete set null,
  deleted_at      timestamptz,
  constraint iup_resursa_ck check (resursa in ('employees', 'vehicles')),
  -- `{org}/{resursă}/{id}/{fișier}`: exact patru segmente, sub lotul ACESTUI
  -- rând. `left(...) =`, nu `like`: `_` e joker în LIKE.
  constraint iup_cale_ck check (
    left(cale, char_length(organization_id::text || '/' || resursa || '/' || id::text || '/'))
      = organization_id::text || '/' || resursa || '/' || id::text || '/'
    and array_length(string_to_array(cale, '/'), 1) = 4
    and split_part(cale, '/', 4) not in ('', '.', '..')
    and cale !~ '[\\[:cntrl:]]'
    and char_length(cale) <= 400
  )
);

create index iup_neconsumate_idx on public.import_uploads (organization_id, created_at)
  where consumat_la is null and deleted_at is null;

comment on table public.import_uploads is
  'Loturile de import emise de server (0226): id-ul și calea le scrie serverul la pregătirea încărcării; '
  'analiza consumă rândul o singură dată, doar cel care l-a creat, înainte să șteargă fișierul cu clientul de serviciu.';

-- Integritate, nu drepturi: rândul e o chitanță emisă de server, deci nimic
-- din ce l-a definit nu se mai schimbă, iar consumul e ireversibil.
create or replace function internal.import_uploads_inainte()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not app.is_service_context() then
      new.consumat_la := null;
      new.created_at := now();
    end if;
  else
    if (new.id, new.organization_id, new.resursa, new.cale, new.created_at, new.created_by)
       is distinct from (old.id, old.organization_id, old.resursa, old.cale, old.created_at, old.created_by) then
      raise exception using errcode = 'P0001',
        message = 'Încărcarea emisă de server nu se modifică. Reluați încărcarea fișierului.';
    end if;
    if old.consumat_la is not null and new.consumat_la is distinct from old.consumat_la then
      raise exception using errcode = 'P0001',
        message = 'Fișierul acestei încărcări a fost deja analizat. Reluați încărcarea fișierului.';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger import_uploads_inainte
  before insert or update on public.import_uploads
  for each row execute function internal.import_uploads_inainte();

alter table public.import_uploads enable row level security;
alter table public.import_uploads force row level security;

-- Doar cine a creat lotul îl vede și îl consumă: lotul altui coleg nu se
-- poate nici citi, nici „folosi” ca să-i fie șters fișierul.
create policy incarcari_import_select on public.import_uploads
for select to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and created_by = (select auth.uid())
);

create policy incarcari_import_insert on public.import_uploads
for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and (resursa <> 'vehicles' or app.feature_on(organization_id, 'fleet'))
  and app.has_permission(organization_id, resursa, 'create') = 'all'
  and created_by = (select auth.uid())
  and consumat_la is null
  and deleted_at is null
);

create policy incarcari_import_update on public.import_uploads
for update to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and created_by = (select auth.uid())
  and app.has_permission(organization_id, resursa, 'create') = 'all'
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and created_by = (select auth.uid())
  and app.has_permission(organization_id, resursa, 'create') = 'all'
  and updated_by = (select auth.uid())
);

do $$
declare t text;
begin
  foreach t in array array['import_uploads'] loop
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

revoke all on function internal.import_uploads_inainte() from public, anon, authenticated;

-- ============================================================
-- 4. Verificare
-- ============================================================
do $$
declare
  v_lipsa text[] := '{}';
  v_f text;
begin
  -- Garda din 0023: CNP-ul cere `employees:read = all` exact.
  if pg_catalog.pg_get_functiondef('public.hr_read_sensitive(uuid)'::regprocedure)
     not like '%''employees'', ''read'') <> ''all''%' then
    v_lipsa := v_lipsa || 'garda employees:read = all din hr_read_sensitive'::text;
  end if;
  -- Niciuna dintre cele patru nu mai deosebește „altă firmă” de „nu există”.
  foreach v_f in array array['public.hr_read_sensitive(uuid)',
                             'public.hr_write_sensitive(uuid, bytea, bytea, bytea, integer, text, text, bytea, bytea, bytea, integer, text, text, text)',
                             'public.seed_leave_balances(uuid, integer, numeric)',
                             'public.tg_employees_manager_path()'] loop
    if pg_catalog.pg_get_functiondef(v_f::regprocedure) like '%aparține altei organizații%' then
      v_lipsa := v_lipsa || ('oracolul încă deschis în ' || v_f);
    end if;
  end loop;

  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'trip_sheets' and policyname = 'foi_select'
                    and qual like '%is_platform_admin%') then
    v_lipsa := v_lipsa || 'foi_select fără ramura de platformă'::text;
  end if;
  if exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'trip_sheets' and cmd <> 'SELECT'
                and (coalesce(qual, '') || coalesce(with_check, '')) like '%is_platform_admin%') then
    v_lipsa := v_lipsa || 'o politică de SCRIERE pe trip_sheets a primit ramura de platformă'::text;
  end if;

  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'import_uploads') <> 3 then
    v_lipsa := v_lipsa || 'trio-ul de politici pe import_uploads'::text;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'import_uploads'
              and cmd in ('DELETE', 'ALL')) then
    v_lipsa := v_lipsa || 'politică DELETE/ALL pe import_uploads'::text;
  end if;
  if not (select relforcerowsecurity from pg_class where oid = 'public.import_uploads'::regclass) then
    v_lipsa := v_lipsa || 'FORCE RLS pe import_uploads'::text;
  end if;

  if array_length(v_lipsa, 1) is not null then
    raise exception '0226: lipsesc %', array_to_string(v_lipsa, ', ');
  end if;
end $$;

commit;
