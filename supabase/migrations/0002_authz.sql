-- ─────────────────────────────────────────────────────────────────────────────
-- 0002_authz.sql — autorizarea platformei "Administrativo"
--
-- Conține: helperii `app.*` (SECURITY DEFINER), triggerele de gardă care impun
-- invarianții pe care un CHECK nu îi poate exprima, triggerul generic de audit,
-- politicile RLS pentru fiecare tabelă din 0001, seed-ul global
-- `role_permissions`, funcțiile de flux expuse prin RPC și politicile de
-- storage.
--
-- Reguli respectate literal (fiecare a fost o observație într-un audit):
--   R1 RLS peste tot, FORCE minus lista albă (setat deja în 0001).
--   R2 SECURITY DEFINER ⇒ `SET search_path = ''` (ȘIR GOL) + nume calificate.
--   R3 REVOKE EXECUTE FROM public, anon ⇒ GRANT explicit către authenticated.
--   R4 `(select app.current_org_ids())` cu SUBQUERY ⇒ InitPlan, o evaluare.
--   R5 Orice OR de nivel superior este parantezat.
--   R6 WITH CHECK complet la INSERT + valori calculate zerofiate.
--   R7 Fără now()/current_date în CHECK; regulile temporale stau în triggere.
--   R9 Triggerul generic de audit refuză tabelele cu criptotext.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 0. Compatibilitate cu Postgres gol (CI) ──────────────────────────────────
-- Aceleași motive ca în 0001: migrarea rulează și pe un Postgres 17 efemer,
-- fără GoTrue și fără Storage. Pe Supabase fiecare ramură este sărită.
do $do$
begin
  if to_regprocedure('auth.uid()') is null then
    execute $fn$
      create function auth.uid() returns uuid language sql stable as $b$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $b$;
      -- Ca pe Supabase, unde `authenticated` poate executa `auth.uid()`.
      grant execute on function auth.uid() to anon, authenticated, service_role;
    $fn$;
  end if;

  if to_regrole('supabase_auth_admin') is null then
    -- Shim-ul din 0001 nu are coloanele pe care GoTrue le-ar fi creat.
    alter table auth.users add column if not exists email_confirmed_at timestamptz;
  end if;

  if to_regnamespace('storage') is null then
    create schema storage;
    create table storage.buckets (
      id text primary key,
      name text not null,
      public boolean not null default false,
      file_size_limit bigint,
      allowed_mime_types text[],
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets (id),
      name text not null,
      owner uuid,
      metadata jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated, service_role;
    grant select, insert, update on storage.objects to authenticated;
    grant select on storage.buckets to authenticated;

    -- `storage.foldername(text)` întoarce segmentele de cale ALE DIRECTORULUI,
    -- adică fără numele fișierului: 'uid/avatar.png' -> {uid}. Politicile din
    -- 0029_avatare.sql o folosesc ca să lege obiectul de utilizatorul din
    -- primul segment. Pe Supabase funcția vine cu Storage; pe Postgres gol nu
    -- există, iar fără shim-ul ăsta 0029 oprește TOATE migrările din CI — deci
    -- și cele trei bariere din scripts/checks/ și testul de izolare între
    -- tenanți, care rulează după ele.
    execute $fn$
      create function storage.foldername(name text) returns text[]
      language sql immutable as $b$
        select (string_to_array($1, '/'))[
          1 : greatest(array_length(string_to_array($1, '/'), 1) - 1, 0)
        ]
      $b$;
      grant execute on function storage.foldername(text) to anon, authenticated, service_role;
    $fn$;
  end if;
end
$do$;

-- ── 1. Helperi de autorizare ─────────────────────────────────────────────────
--
-- DE CE `STABLE` ȘI NU IMPLICITUL `VOLATILE`:
-- o funcție VOLATILE nu poate fi ridicată de planificator într-un InitPlan; ea
-- se re-execută pentru FIECARE rând scanat. `app.current_org_ids()` este o
-- interogare pe `organization_members`; într-un SELECT peste 50.000 de rânduri
-- asta înseamnă 50.000 de interogări imbricate. Declarată STABLE și apelată ca
-- `(select app.current_org_ids())` (R4), Postgres o evaluează O SINGURĂ DATĂ pe
-- instrucțiune și refolosește rezultatul ca pe o constantă. Corectitudinea nu
-- suferă: rezultatul nu se schimbă în interiorul aceleiași instrucțiuni.
--
-- CUM SE EVITĂ RECURSIUNEA PE `organization_members` — concret:
-- politica de SELECT pe `organization_members` trebuie să spună „văd rândurile
-- organizațiilor în care sunt membru”. Scrisă direct, condiția ar fi un
-- `exists (select 1 from public.organization_members …)` — adică o citire a
-- ACELEIAȘI tabele din interiorul propriei politici: Postgres reaplică politica
-- la citirea internă și cade în `stack depth limit exceeded` (54001).
-- Soluția are două jumătăți, ambele obligatorii:
--   (a) condiția se mută într-o funcție SECURITY DEFINER (`app.current_org_ids`),
--       deci citirea internă se execută cu identitatea proprietarului funcției,
--       nu a apelantului;
--   (b) `organization_members` este în lista albă NO FORCE din 0001. Fără FORCE,
--       politicile NU se aplică proprietarului tabelei — deci citirea din
--       interiorul helperului trece nefiltrată și recursiunea se oprește la
--       primul nivel. Dacă am adăuga `FORCE ROW LEVEL SECURITY` pe această
--       tabelă, politica s-ar reaplica proprietarului, helperul s-ar autoapela
--       prin propria politică și fiecare SELECT ar muri în recursiune.
-- Identic pentru `platform_admins`, `role_permissions` și `features`: sunt
-- exact tabelele citite de helperi, deci exact tabelele care nu suportă FORCE.
-- BYPASSRLS al rolului `postgres` ne-ar salva oricum pe Supabase, dar nu ne
-- bazăm pe un atribut de rol: lista albă este garanția explicită și portabilă.

create or replace function app.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = (select auth.uid())
      and pa.revoked_at is null
  );
$$;
comment on function app.is_platform_admin() is
  'Sursa de adevăr pentru rolul de platformă: tabela platform_admins, nu un claim din JWT.';

create or replace function app.current_org_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct m.organization_id), '{}'::uuid[])
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = (select auth.uid())
    and m.deleted_at is null
    and m.status = 'active'
    and o.deleted_at is null
    and o.status in ('pending', 'active');
$$;
comment on function app.current_org_ids() is
  'Apartenența reală, recalculată la fiecare cerere. Cookie-ul de organizație nu intră niciodată aici. O organizație suspendată dispare din listă, deci accesul se stinge imediat.';

create or replace function app.is_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p_organization_id = any (app.current_org_ids()), false);
$$;

create or replace function app.has_role(p_organization_id uuid, p_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.deleted_at is null
      and m.status = 'active'
      and m.role = any (p_roles)
      and o.deleted_at is null
      and o.status in ('pending', 'active')
  );
$$;

create or replace function app.feature_on(p_organization_id uuid, p_feature_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- `is_core` decide, NU o comparație cu literalul 'nucleu': dacă mâine apar
  -- două module de bază, regula rămâne corectă fără să se atingă codul.
  select exists (
    select 1
    from public.features f
    left join public.organization_features ofe
      on ofe.feature_key = f.feature_key
     and ofe.organization_id = p_organization_id
     and ofe.deleted_at is null
    where f.feature_key = p_feature_key
      and (f.is_core or coalesce(ofe.enabled, false))
  );
$$;

create or replace function app.has_permission(
  p_organization_id uuid,
  p_resource text,
  p_action text
)
returns public.permission_scope
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select app.is_platform_admin()) then 'all'::public.permission_scope
    else coalesce(
      (
        select rp.scope
        from public.role_permissions rp
        where rp.deleted_at is null
          and rp.resource = p_resource
          and rp.action = p_action
          and rp.role = (
            select m.role
            from public.organization_members m
            where m.organization_id = p_organization_id
              and m.user_id = (select auth.uid())
              and m.deleted_at is null
              and m.status = 'active'
            limit 1
          )
          and (rp.organization_id = p_organization_id or rp.organization_id is null)
        -- `false < true`: rândul organizației sortează primul și bate
        -- implicitul global, inclusiv când valoarea lui este 'none' (refuz
        -- EXPLICIT peste un implicit permisiv).
        order by (rp.organization_id is null) asc
        limit 1
      ),
      'none'::public.permission_scope
    )
  end;
$$;
comment on function app.has_permission(uuid, text, text) is
  'Absența rândului = refuz. scope = none = refuz explicit. Rândul organizației suprascrie rândul global (organization_id is null).';

create or replace function app.scope_rank(p_scope public.permission_scope)
returns integer
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case p_scope when 'all' then 3 when 'team' then 2 when 'own' then 1 else 0 end;
$$;

create or replace function app.can(
  p_organization_id uuid,
  p_resource text,
  p_action text,
  p_min public.permission_scope default 'own'::public.permission_scope
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- p_min = 'none' ar face predicatul mereu adevărat (0 >= 0); apelanții trebuie
  -- să ceară cel puțin 'own'.
  select app.scope_rank(p_min) > 0
     and app.scope_rank(app.has_permission(p_organization_id, p_resource, p_action))
         >= app.scope_rank(p_min);
$$;

create or replace function app.shares_org(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = any (app.current_org_ids())
      and m.user_id = p_user_id
      and m.deleted_at is null
  );
$$;

create or replace function app.is_service_context()
returns boolean
language sql
stable
set search_path = ''
as $$
  -- Rolul efectiv se citește din GUC-ul `role`, NU din `current_user`.
  --
  -- Motivul, verificat empiric pe Postgres 17: funcțiile apelate din interiorul
  -- unui trigger `SECURITY DEFINER` văd `current_user` = PROPRIETARUL funcției,
  -- nu apelantul. Cum proprietarul este membru al lui `service_role` (și în CI
  -- este chiar superuser), `pg_has_role(current_user, 'service_role', 'MEMBER')`
  -- întorcea `true` pentru ORICE apelant, inclusiv un `authenticated` obișnuit.
  -- Fiecare gardă ieșea atunci pe prima linie, iar coloanele rezervate
  -- platformei (plan, seats_limit, status, slug, cui) rămâneau nescutite.
  --
  -- GUC-ul `role`, pe care PostgREST îl fixează prin `set local role`, NU este
  -- modificat de `SECURITY DEFINER`, deci rămâne `authenticated` chiar și
  -- înăuntru. Măsurătoare:
  --   prin funcție DEFINER  → current_user = proprietar,      role = authenticated
  --   prin funcție normală  → current_user = authenticated,   role = authenticated
  --
  -- Gărzile nu mai sunt oricum `SECURITY DEFINER` (vezi §5), dar helperul rămâne
  -- corect și dacă cineva îl apelează din alt context.
  select coalesce(pg_catalog.current_setting('role', true), 'none')
           not in ('authenticated', 'anon');
$$;

-- ── 2. Utilitare de cerere ───────────────────────────────────────────────────
create or replace function internal.request_header(p_name text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v text;
begin
  begin
    v := nullif(btrim(coalesce(
      current_setting('request.headers', true)::jsonb ->> p_name, '')), '');
  exception when others then
    return null;   -- header-ele lipsesc sau nu sunt JSON valid (job, psql).
  end;
  return v;
end;
$$;

create or replace function internal.request_ip()
returns inet
language plpgsql
stable
set search_path = ''
as $$
declare
  v text := nullif(btrim(split_part(coalesce(internal.request_header('x-forwarded-for'), ''), ',', 1)), '');
begin
  if v is null then
    return null;
  end if;
  begin
    return v::inet;
  exception when others then
    return null;
  end;
end;
$$;

create or replace function internal.sha256_hex(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(coalesce(p_text, ''), 'sha256'), 'hex');
$$;

-- ── 3. Limitare de rată (în Postgres, nu în memoria unei instanțe serverless) ─
create or replace function internal.rate_limit_hit(
  p_key text,
  p_limit integer,
  p_window interval
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secunde double precision := extract(epoch from p_window);
  v_start   timestamptz;
  v_count   integer;
begin
  if p_key is null or p_limit is null or p_limit < 1 or coalesce(v_secunde, 0) < 1 then
    raise exception 'Parametri invalizi pentru limitarea de rată.' using errcode = 'P0001';
  end if;

  v_start := to_timestamp(floor(extract(epoch from clock_timestamp()) / v_secunde) * v_secunde);

  insert into public.rate_limits (key, window_start, count)
  values (left(p_key, 200), v_start, 1)
  on conflict (key, window_start)
    do update set count = public.rate_limits.count + 1, updated_at = now()
  returning public.rate_limits.count into v_count;

  if v_count = 1 then
    delete from public.rate_limits where window_start < now() - interval '2 days';
  end if;

  return v_count <= p_limit;
end;
$$;

-- ── 4. Audit ─────────────────────────────────────────────────────────────────
-- R9: lista de coloane interzise, aplicată la RUNTIME pe cheile jsonb. Chiar
-- dacă cineva atașează triggerul pe o tabelă cu criptotext, valorile nu ajung
-- niciodată în jurnal.
create or replace function internal.audit_forbidden_patterns()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['%ciphertext%', '%\_iv', '%auth\_tag%', '%hash%', '%token%', '%secret%', '%parol%'];
$$;

create or replace function internal.scrub_jsonb(p_doc jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when p_doc is null then null
    else coalesce((
      select jsonb_object_agg(
        e.key,
        case when e.key ilike any (internal.audit_forbidden_patterns())
             then '"[redactat]"'::jsonb
             else e.value end
      )
      from jsonb_each(p_doc) as e(key, value)
    ), '{}'::jsonb)
  end;
$$;

create or replace function internal.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after  jsonb;
  v_org    uuid;
  v_entity uuid;
  v_action public.audit_action;
begin
  if tg_op = 'INSERT' then
    v_after  := internal.scrub_jsonb(to_jsonb(new));
    v_action := 'create';
  elsif tg_op = 'UPDATE' then
    if new is not distinct from old then
      return new;                      -- update no-op: nu poluăm jurnalul.
    end if;
    v_before := internal.scrub_jsonb(to_jsonb(old));
    v_after  := internal.scrub_jsonb(to_jsonb(new));
    v_action := case
      when v_before ? 'deleted_at'
       and v_before ->> 'deleted_at' is null
       and v_after  ->> 'deleted_at' is not null then 'delete'
      when v_before ? 'deleted_at'
       and v_before ->> 'deleted_at' is not null
       and v_after  ->> 'deleted_at' is null then 'restore'
      else 'update'
    end;
  else
    v_before := internal.scrub_jsonb(to_jsonb(old));
    v_action := 'delete';
  end if;

  v_org := nullif(coalesce(v_after ->> 'organization_id', v_before ->> 'organization_id', ''), '')::uuid;
  if v_org is null and tg_table_name = 'organizations' then
    v_org := nullif(coalesce(v_after ->> 'id', v_before ->> 'id', ''), '')::uuid;
  end if;
  v_entity := nullif(coalesce(v_after ->> 'id', v_before ->> 'id', ''), '')::uuid;

  insert into public.audit_logs
    (organization_id, actor_id, action, status, entity_type, entity_id,
     before, after, ip, user_agent, request_id)
  values
    (v_org, auth.uid(), v_action, 'success', tg_table_name, v_entity,
     v_before, v_after, internal.request_ip(),
     left(coalesce(internal.request_header('user-agent'), ''), 500),
     internal.request_header('x-request-id'));

  return coalesce(new, old);
end;
$$;

create or replace function internal.attach_audit(p_table text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_rele text;
begin
  select string_agg(a.attname, ', ' order by a.attname)
    into v_rele
  from pg_catalog.pg_attribute a
  where a.attrelid = ('public.' || quote_ident(p_table))::regclass
    and a.attnum > 0
    and not a.attisdropped
    and a.attname ilike any (internal.audit_forbidden_patterns());

  if v_rele is not null then
    raise exception
      'R9: tabela public.% conține coloane sensibile (%); triggerul generic de audit NU se atașează.',
      p_table, v_rele using errcode = 'P0001';
  end if;

  execute format('drop trigger if exists audit_%1$s on public.%1$I', p_table);
  execute format(
    'create trigger audit_%1$s after insert or update on public.%1$I
       for each row execute function internal.audit_trigger()', p_table);
end;
$$;

-- `invitations` (token_hash) și orice tabelă viitoare cu criptotext sunt
-- respinse automat de garda de mai sus — de aceea nu apar în listă.
select internal.attach_audit(t)
from unnest(array[
  'organizations', 'organization_branding', 'organization_members',
  'organization_features', 'role_permissions', 'platform_admins',
  'retention_policies'
]) t;

create or replace function app.write_audit(
  p_action public.audit_action,
  p_organization_id uuid default null,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_status public.audit_status default 'success',
  p_error_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id  uuid;
  v_org uuid;
begin
  -- Deliberat NU verificăm apartenența la p_organization_id: exact acțiunile
  -- 'tenant_forged' / 'rate_limited' se înregistrează pentru organizații în
  -- care apelantul NU este membru. Verificăm doar existența, pentru FK.
  select o.id into v_org from public.organizations o where o.id = p_organization_id;

  insert into public.audit_logs
    (organization_id, actor_id, action, status, entity_type, entity_id,
     before, after, ip, user_agent, request_id, error_code)
  values
    (v_org, auth.uid(), p_action, p_status, left(p_entity_type, 100), p_entity_id,
     internal.scrub_jsonb(p_before), internal.scrub_jsonb(p_after),
     internal.request_ip(),
     left(coalesce(internal.request_header('user-agent'), ''), 500),
     internal.request_header('x-request-id'), left(p_error_code, 50))
  returning id into v_id;

  return v_id;
end;
$$;
comment on function app.write_audit(public.audit_action, uuid, text, uuid, jsonb, jsonb, public.audit_status, text) is
  'Punctul unic de scriere în audit din Server Actions. audit_logs rămâne fără GRANT INSERT pentru `authenticated`.';

-- ── 5. Triggere de gardă ─────────────────────────────────────────────────────
-- Ordinea de declanșare este alfabetică: guard_* → set_actor_* → set_updated_at_*.

create or replace function internal.set_actor()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid   uuid  := auth.uid();
  v_new   jsonb := to_jsonb(new);
  v_patch jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    if v_new ? 'created_by' and v_new ->> 'created_by' is null and v_uid is not null then
      v_patch := v_patch || jsonb_build_object('created_by', v_uid);
    end if;
    if v_new ? 'updated_by' and v_new ->> 'updated_by' is null and v_uid is not null then
      v_patch := v_patch || jsonb_build_object('updated_by', v_uid);
    end if;
  else
    if v_new ? 'created_by' then
      v_patch := v_patch || jsonb_build_object('created_by', to_jsonb(old) -> 'created_by');
    end if;
    if v_new ? 'updated_by' and v_uid is not null then
      v_patch := v_patch || jsonb_build_object('updated_by', v_uid);
    end if;
  end if;

  if v_patch = '{}'::jsonb then
    return new;
  end if;
  return jsonb_populate_record(new, v_patch);
end;
$$;

do $do$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'updated_by'
                       and a.attnum > 0 and not a.attisdropped
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  loop
    execute format(
      'create trigger %I before insert or update on public.%I
         for each row execute function internal.set_actor()',
      'set_actor_' || t.relname, t.relname);
  end loop;
end
$do$;

create or replace function internal.guard_organizations()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if app.is_service_context() or (select app.is_platform_admin()) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'Organizațiile se creează exclusiv din Super-Admin.'
      using errcode = 'PT403';
  end if;

  -- Coloanele rezervate platformei se readuc la valoarea veche în loc să se
  -- refuze update-ul: un org_admin poate trimite `select('*')` înapoi, iar un
  -- GRANT pe coloane ar sparge PostgREST. Rezultatul e identic ca securitate.
  new.id                  := old.id;
  new.slug                := old.slug;
  new.cui                 := old.cui;
  new.plan                := old.plan;
  new.seats_limit         := old.seats_limit;
  new.subscription_status := old.subscription_status;
  new.trial_ends_at       := old.trial_ends_at;
  new.status              := old.status;
  new.activated_at        := old.activated_at;
  new.suspended_at        := old.suspended_at;
  new.suspended_reason    := old.suspended_reason;
  new.deleted_at          := old.deleted_at;
  new.created_at          := old.created_at;
  return new;
end;
$$;
create trigger guard_organizations before insert or update on public.organizations
  for each row execute function internal.guard_organizations();

create or replace function internal.guard_profiles()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if app.is_service_context() then
    return new;
  end if;
  new.id         := old.id;
  new.email      := old.email;   -- e-mailul se schimbă doar prin GoTrue.
  new.deleted_at := old.deleted_at;
  new.created_at := old.created_at;
  return new;
end;
$$;
create trigger guard_profiles before update on public.profiles
  for each row execute function internal.guard_profiles();

create or replace function internal.guard_invitations()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if app.is_service_context() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- R7: fereastra de valabilitate depinde de now(), deci trăiește aici, nu
    -- într-un CHECK.
    if new.expires_at is null
       or new.expires_at <= now() + interval '1 hour'
       or new.expires_at > now() + interval '30 days' then
      raise exception 'Valabilitatea invitației trebuie să fie între 1 oră și 30 de zile.'
        using errcode = 'PT400';
    end if;
    new.status      := 'pending';
    new.accepted_at := null;
    new.accepted_by := null;
    new.deleted_at  := null;
    new.invited_by  := coalesce(new.invited_by, auth.uid());
    return new;
  end if;

  -- Din client, o invitație se poate doar revoca sau șterge logic.
  if new.status is distinct from old.status and new.status <> 'revoked' then
    raise exception 'O invitație se poate doar revoca din interfață.' using errcode = 'PT403';
  end if;
  new.organization_id := old.organization_id;
  new.email           := old.email;
  new.role            := old.role;
  new.token_hash      := old.token_hash;
  new.expires_at      := old.expires_at;
  new.accepted_at     := old.accepted_at;
  new.accepted_by     := old.accepted_by;
  new.created_at      := old.created_at;
  return new;
end;
$$;
create trigger guard_invitations before insert or update on public.invitations
  for each row execute function internal.guard_invitations();

create or replace function internal.guard_organization_members()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_limita integer;
  v_activi integer;
begin
  if tg_op = 'UPDATE' then
    new.organization_id := old.organization_id;
    new.user_id         := old.user_id;
    new.created_at      := old.created_at;
    if not app.is_service_context()
       and new.user_id = auth.uid()
       and new.role is distinct from old.role then
      raise exception 'Nu îți poți schimba propriul rol.' using errcode = 'PT403';
    end if;
  end if;

  -- Plafonul de locuri: numai la tranziția către „membru activ”.
  if new.deleted_at is null and new.status = 'active'
     and (tg_op = 'INSERT' or old.status <> 'active' or old.deleted_at is not null) then
    select o.seats_limit into v_limita
    from public.organizations o where o.id = new.organization_id;

    -- Numărătoarea nu e serializabilă sub concurență; la nevoie se adaugă un
    -- pg_advisory_xact_lock pe organization_id în Faza 2.
    select count(*) into v_activi
    from public.organization_members m
    where m.organization_id = new.organization_id
      and m.deleted_at is null
      and m.status = 'active'
      and (tg_op = 'INSERT' or m.id <> new.id);

    if v_limita is not null and v_activi >= v_limita then
      raise exception 'Limita de % utilizatori activi a organizației a fost atinsă.', v_limita
        using errcode = 'PT409';
    end if;
  end if;
  return new;
end;
$$;
create trigger guard_organization_members before insert or update on public.organization_members
  for each row execute function internal.guard_organization_members();

create or replace function internal.guard_notifications()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if app.is_service_context() then
    return new;
  end if;
  -- Destinatarul poate doar marca citit / șterge logic.
  new.user_id         := old.user_id;
  new.organization_id := old.organization_id;
  new.kind            := old.kind;
  new.title           := old.title;
  new.body            := old.body;
  new.link            := old.link;
  new.entity_type     := old.entity_type;
  new.entity_id       := old.entity_id;
  new.sent_email_at   := old.sent_email_at;
  new.created_at      := old.created_at;
  return new;
end;
$$;
create trigger guard_notifications before update on public.notifications
  for each row execute function internal.guard_notifications();

-- audit_logs: append-only impus și pentru service_role (un REVOKE nu-l atinge).
-- Singura modificare tolerată este anonimizarea făcută de FK-urile
-- `on delete set null` — altfel ștergerea unui cont ar deveni imposibilă.
create or replace function internal.guard_audit_logs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Jurnalul de audit nu poate fi șters.' using errcode = 'PT403';
  end if;
  if (new.organization_id is null or new.organization_id = old.organization_id)
     and (new.actor_id is null or new.actor_id = old.actor_id)
     and new.id = old.id and new.action = old.action and new.status = old.status
     and new.entity_type is not distinct from old.entity_type
     and new.entity_id  is not distinct from old.entity_id
     and new.before     is not distinct from old.before
     and new.after      is not distinct from old.after
     and new.ip         is not distinct from old.ip
     and new.user_agent is not distinct from old.user_agent
     and new.request_id is not distinct from old.request_id
     and new.error_code is not distinct from old.error_code
     and new.created_at = old.created_at then
    return new;
  end if;
  raise exception 'Jurnalul de audit este append-only.' using errcode = 'PT403';
end;
$$;
create trigger guard_audit_logs before update or delete on public.audit_logs
  for each row execute function internal.guard_audit_logs();

-- ── 6. Politici RLS ──────────────────────────────────────────────────────────
-- Fără politici DELETE nicăieri: DELETE este deja revocat în 0001 (soft delete).

-- 6.1 organizations
create policy organizations_select on public.organizations for select to authenticated
using ((
  (select app.is_platform_admin())
  or (id = any ((select app.current_org_ids())::uuid[]) and deleted_at is null)
));

create policy organizations_insert on public.organizations for insert to authenticated
with check (
  (select app.is_platform_admin())
  and status = 'pending' and activated_at is null
  and suspended_at is null and suspended_reason is null and deleted_at is null
);

create policy organizations_update on public.organizations for update to authenticated
using ((
  (select app.is_platform_admin())
  or (
    id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and app.has_role(id, array['org_admin']::public.app_role[])
  )
))
with check ((
  (select app.is_platform_admin())
  or (
    id = any ((select app.current_org_ids())::uuid[])
    and app.has_role(id, array['org_admin']::public.app_role[])
  )
));

-- 6.2 organization_branding
create policy organization_branding_select on public.organization_branding for select to authenticated
using (organization_id = any ((select app.current_org_ids())::uuid[]) and deleted_at is null);

create policy organization_branding_insert on public.organization_branding for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.can(organization_id, 'branding', 'create', 'all')
  and deleted_at is null
);

create policy organization_branding_update on public.organization_branding for update to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and deleted_at is null
  and app.can(organization_id, 'branding', 'update', 'all')
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.can(organization_id, 'branding', 'update', 'all')
);

-- 6.3 profiles (INSERT: niciodată din client — profilul se creează de
--     internal.handle_new_user() la signup).
create policy profiles_select on public.profiles for select to authenticated
using (
  deleted_at is null
  and (
    id = (select auth.uid())
    or (select app.is_platform_admin())
    or app.shares_org(id)
  )
);

create policy profiles_update on public.profiles for update to authenticated
using (id = (select auth.uid()) and deleted_at is null)
with check (id = (select auth.uid()) and deleted_at is null);

-- 6.4 platform_admins (INSERT/UPDATE revocate în 0001 — se acordă doar cu service_role)
create policy platform_admins_select on public.platform_admins for select to authenticated
using ((
  user_id = (select auth.uid())
  or (select app.is_platform_admin())
));

-- 6.5 invitations
create policy invitations_select on public.invitations for select to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and deleted_at is null
  and app.can(organization_id, 'users', 'read', 'all')
);

create policy invitations_insert on public.invitations for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.can(organization_id, 'users', 'create', 'all')
  and role <> 'super_admin'
  and status = 'pending'
  and accepted_at is null and accepted_by is null and deleted_at is null
);

create policy invitations_update on public.invitations for update to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and deleted_at is null
  and app.can(organization_id, 'users', 'update', 'all')
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.can(organization_id, 'users', 'update', 'all')
);

-- 6.6 organization_members
create policy organization_members_select on public.organization_members for select to authenticated
using ((
  (select app.is_platform_admin())
  or (organization_id = any ((select app.current_org_ids())::uuid[]) and deleted_at is null)
));

create policy organization_members_insert on public.organization_members for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.has_role(organization_id, array['org_admin']::public.app_role[])
  and role <> 'super_admin'
  and status = 'active'
  and deactivated_at is null and deactivated_by is null and deleted_at is null
);

create policy organization_members_update on public.organization_members for update to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.has_role(organization_id, array['org_admin']::public.app_role[])
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and role <> 'super_admin'
);

-- 6.7 features — catalog global, doar citire.
create policy features_select on public.features for select to authenticated using (true);

-- 6.8 organization_features — comutarea modulelor e prerogativă de platformă.
create policy organization_features_select on public.organization_features for select to authenticated
using (organization_id = any ((select app.current_org_ids())::uuid[]) and deleted_at is null);

create policy organization_features_insert on public.organization_features for insert to authenticated
with check ((select app.is_platform_admin()) and activated_by is null and deleted_at is null);

create policy organization_features_update on public.organization_features for update to authenticated
using ((select app.is_platform_admin()))
with check ((select app.is_platform_admin()));

-- 6.9 role_permissions
create policy role_permissions_select on public.role_permissions for select to authenticated
using (
  deleted_at is null
  and (
    organization_id is null
    or organization_id = any ((select app.current_org_ids())::uuid[])
  )
);

create policy role_permissions_insert on public.role_permissions for insert to authenticated
with check (
  organization_id is not null
  and organization_id = any ((select app.current_org_ids())::uuid[])
  and app.has_role(organization_id, array['org_admin']::public.app_role[])
  and role <> 'super_admin'
  and deleted_at is null
);

create policy role_permissions_update on public.role_permissions for update to authenticated
using (
  organization_id is not null
  and organization_id = any ((select app.current_org_ids())::uuid[])
  and app.has_role(organization_id, array['org_admin']::public.app_role[])
)
with check (
  organization_id is not null
  and organization_id = any ((select app.current_org_ids())::uuid[])
  and role <> 'super_admin'
);

-- 6.10 audit_logs — INSERT-ul are politică strictă, dar GRANT-ul rămâne revocat
-- din 0001: scrierea trece prin app.write_audit(). Politica există ca plasă de
-- siguranță dacă cineva reacordă GRANT-ul.
create policy audit_logs_select on public.audit_logs for select to authenticated
using ((
  (select app.is_platform_admin())
  or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'audit', 'read', 'all')
  )
));

create policy audit_logs_insert on public.audit_logs for insert to authenticated
with check (
  actor_id = (select auth.uid())
  and (organization_id is null or organization_id = any ((select app.current_org_ids())::uuid[]))
);

-- 6.11 notifications
create policy notifications_select on public.notifications for select to authenticated
using (user_id = (select auth.uid()) and deleted_at is null);

create policy notifications_insert on public.notifications for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and (
    user_id = (select auth.uid())
    or app.can(organization_id, 'announcements', 'create', 'all')
  )
  and read_at is null and sent_email_at is null and deleted_at is null
);

create policy notifications_update on public.notifications for update to authenticated
using (user_id = (select auth.uid()) and deleted_at is null)
with check (user_id = (select auth.uid()));

-- 6.12 notification_preferences
create policy notification_preferences_select on public.notification_preferences for select to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and user_id = (select auth.uid())
  and deleted_at is null
);

create policy notification_preferences_insert on public.notification_preferences for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and user_id = (select auth.uid())
  and deleted_at is null
);

create policy notification_preferences_update on public.notification_preferences for update to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and user_id = (select auth.uid())
  and deleted_at is null
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and user_id = (select auth.uid())
);

-- 6.13 demo_requests — PRE-TENANT. `anon` NU primește nicio politică: scrierea
-- se face exclusiv prin public.submit_demo_request().
create policy demo_requests_select on public.demo_requests for select to authenticated
using ((select app.is_platform_admin()) and deleted_at is null);

create policy demo_requests_update on public.demo_requests for update to authenticated
using ((select app.is_platform_admin()))
with check ((select app.is_platform_admin()));

-- 6.14 rate_limits — fără politici: toate privilegiile sunt revocate în 0001,
-- tabela e atinsă doar de internal.rate_limit_hit() (SECURITY DEFINER).

-- 6.15 document_sequences
create policy document_sequences_select on public.document_sequences for select to authenticated
using (organization_id = any ((select app.current_org_ids())::uuid[]));

create policy document_sequences_insert on public.document_sequences for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.has_role(organization_id, array['org_admin']::public.app_role[])
  and next_number = 1
);

create policy document_sequences_update on public.document_sequences for update to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.has_role(organization_id, array['org_admin']::public.app_role[])
)
with check (organization_id = any ((select app.current_org_ids())::uuid[]));

-- 6.16 retention_policies
create policy retention_policies_select on public.retention_policies for select to authenticated
using (
  deleted_at is null
  and (
    organization_id is null
    or organization_id = any ((select app.current_org_ids())::uuid[])
  )
);

create policy retention_policies_insert on public.retention_policies for insert to authenticated
with check (
  organization_id is not null
  and organization_id = any ((select app.current_org_ids())::uuid[])
  and app.can(organization_id, 'compliance', 'create', 'all')
  and deleted_at is null
);

create policy retention_policies_update on public.retention_policies for update to authenticated
using (
  organization_id is not null
  and organization_id = any ((select app.current_org_ids())::uuid[])
  and app.can(organization_id, 'compliance', 'update', 'all')
)
with check (
  organization_id is not null
  and organization_id = any ((select app.current_org_ids())::uuid[])
);

-- 6.17 email_log — INSERT/UPDATE revocate în 0001.
create policy email_log_select on public.email_log for select to authenticated
using ((
  (select app.is_platform_admin())
  or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'audit', 'read', 'all')
  )
));

-- ── 7. Seed: matricea globală de permisiuni (organization_id IS NULL) ────────
-- T=all, E=team, P=own, -=none (rând EXPLICIT acolo unde refuzul trebuie să
-- suprascrie un eventual implicit sau să fie vizibil în interfață).

insert into public.role_permissions (organization_id, role, resource, action, scope)
select null, 'super_admin'::public.app_role, r, a, 'all'::public.permission_scope
from unnest(array[
  'organizations','features','branding','users','employees','departments',
  'attendance','leave','trip_sheets','vehicles','ssm','maintenance','inventory',
  'checklists','announcements','payroll','per_diem','audit','compliance']) r
cross join unnest(array['read','create','update','delete','approve','export']) a
on conflict (organization_id, role, resource, action) where deleted_at is null do nothing;

-- org_admin: „all” pe tot ce ține de organizația lui.
insert into public.role_permissions (organization_id, role, resource, action, scope)
select null, 'org_admin'::public.app_role, r, a, 'all'::public.permission_scope
from unnest(array[
  'branding','users','employees','departments','attendance','leave',
  'trip_sheets','vehicles','ssm','maintenance','inventory','checklists',
  'announcements','payroll','per_diem','audit','compliance']) r
cross join unnest(array['read','create','update','delete','approve','export']) a
on conflict (organization_id, role, resource, action) where deleted_at is null do nothing;

with m(rol, resursa, scop, actiuni) as (values
  -- org_admin: profilul firmei se poate citi și edita (coloanele de abonament
  -- sunt blocate de internal.guard_organizations), dar ciclul de viață al
  -- organizației și comutarea modulelor rămân la super_admin.
  ('org_admin','organizations','all',  '{read,update,export}'),
  ('org_admin','organizations','none', '{create,delete,approve}'),
  ('org_admin','features','all',       '{read}'),
  ('org_admin','features','none',      '{create,update,delete,approve,export}'),

  -- manager: vede și aprobă pentru echipa lui.
  ('manager','attendance','team',   '{read,approve}'),
  ('manager','leave','team',        '{read,approve}'),
  ('manager','trip_sheets','team',  '{read,approve}'),
  ('manager','checklists','team',   '{read,approve}'),
  ('manager','per_diem','team',     '{read,approve}'),
  ('manager','employees','team',    '{read}'),
  ('manager','ssm','team',          '{read}'),
  ('manager','inventory','team',    '{read}'),
  ('manager','maintenance','team',  '{read}'),
  ('manager','maintenance','all',   '{create}'),   -- poate sesiza orice echipament
  ('manager','announcements','all', '{read}'),
  -- REFUZ EXPLICIT: salarizarea nu se deschide implicit managerilor. Un
  -- org_admin poate insera un rând propriu pe organizație care să suprascrie.
  ('manager','payroll','none',      '{read,create,update,delete,approve,export}'),
  ('manager','audit','none',        '{read,export}'),

  -- hr: administrează complet domeniul de personal.
  ('hr','employees','all',      '{read,create,update,delete,approve,export}'),
  ('hr','departments','all',    '{read,create,update,delete,approve,export}'),
  ('hr','attendance','all',     '{read,create,update,delete,approve,export}'),
  ('hr','leave','all',          '{read,create,update,delete,approve,export}'),
  ('hr','ssm','all',            '{read,create,update,delete,approve,export}'),
  ('hr','inventory','all',      '{read,create,update,delete,approve,export}'),
  ('hr','checklists','all',     '{read,create,update,delete,approve,export}'),
  ('hr','announcements','all',  '{read,create,update,delete,approve,export}'),
  ('hr','payroll','all',        '{read,create,update,delete,approve,export}'),
  ('hr','audit','none',         '{read,export}'),

  -- employee: strict ce îl privește.
  ('employee','attendance','own',    '{read,create,update}'),
  ('employee','leave','own',         '{read,create,update,delete}'),
  ('employee','per_diem','own',      '{read,create,update,delete}'),
  ('employee','payroll','own',       '{read,export}'),
  ('employee','inventory','own',     '{read}'),
  ('employee','checklists','own',    '{read,update}'),
  ('employee','ssm','own',           '{read}'),
  ('employee','announcements','all', '{read}'),
  ('employee','maintenance','all',   '{create}'),  -- sesizare de defecțiune
  ('employee','maintenance','own',   '{read}'),
  ('employee','users','own',         '{read}'),    -- propriul profil
  ('employee','employees','none',    '{read,export}'),
  ('employee','audit','none',        '{read,export}')
)
insert into public.role_permissions (organization_id, role, resource, action, scope)
select null, m.rol::public.app_role, m.resursa, a, m.scop::public.permission_scope
from m, lateral unnest(m.actiuni::text[]) as a
on conflict (organization_id, role, resource, action) where deleted_at is null do nothing;

-- ── 8. Funcții de flux (RPC) ────────────────────────────────────────────────
-- SQLSTATE-urile `PTxxx` sunt traduse de PostgREST în codul HTTP corespunzător.

create or replace function public.submit_demo_request(
  p_nume text,
  p_firma text,
  p_email text,
  p_telefon text default null,
  p_nr_angajati public.employee_band default null,
  p_mesaj text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ip    inet := internal.request_ip();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_id    uuid;
begin
  -- Rata se numără pe IP; fără IP (curl direct, job) cădem pe o cheie comună,
  -- deliberat mai strictă decât permisivă.
  if not internal.rate_limit_hit('demo:' || coalesce(host(v_ip), 'fara-ip'), 3, interval '1 hour') then
    perform app.write_audit('rate_limited', null, 'demo_requests', null, null, null, 'denied', 'PT429');
    raise exception 'Prea multe cereri de la aceeași adresă. Încearcă din nou peste o oră.'
      using errcode = 'PT429';
  end if;

  if char_length(btrim(coalesce(p_nume, ''))) not between 2 and 120
     or char_length(btrim(coalesce(p_firma, ''))) not between 2 and 200
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or char_length(coalesce(p_mesaj, '')) > 2000
     or (p_telefon is not null and char_length(btrim(p_telefon)) not between 6 and 32) then
    raise exception 'Datele trimise nu sunt valide. Verifică numele, firma și adresa de e-mail.'
      using errcode = 'PT400';
  end if;

  begin
    insert into public.demo_requests (nume, firma, email, telefon, nr_angajati, mesaj, ip, user_agent)
    values (
      btrim(p_nume), btrim(p_firma), v_email::extensions.citext,
      nullif(btrim(coalesce(p_telefon, '')), ''), p_nr_angajati,
      nullif(btrim(coalesce(p_mesaj, '')), ''), v_ip,
      left(coalesce(internal.request_header('user-agent'), ''), 500)
    )
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Ai trimis deja o cerere astăzi. Te contactăm în cel mai scurt timp.'
      using errcode = 'PT409';
  end;

  perform app.write_audit('demo_requested', null, 'demo_requests', v_id);
  return v_id;
end;
$$;

create or replace function public.peek_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ip   inet := internal.request_ip();
  v_rec  record;
begin
  if not internal.rate_limit_hit('invit:' || coalesce(host(v_ip), 'fara-ip'), 20, interval '1 hour') then
    raise exception 'Prea multe încercări. Încearcă din nou mai târziu.' using errcode = 'PT429';
  end if;

  if coalesce(btrim(p_token), '') = '' then
    raise exception 'Invitație inexistentă sau deja folosită.' using errcode = 'PT404';
  end if;

  select o.name as org_name, i.expires_at, i.status
    into v_rec
  from public.invitations i
  join public.organizations o on o.id = i.organization_id
  where i.token_hash = internal.sha256_hex(btrim(p_token))
    and i.deleted_at is null
    and i.status in ('pending', 'expired')
    and o.deleted_at is null;

  if not found then
    raise exception 'Invitație inexistentă sau deja folosită.' using errcode = 'PT404';
  end if;

  -- NICIODATĂ e-mailul invitatului și niciodată rolul: pagina publică are
  -- nevoie doar de numele firmei și de starea de expirare.
  return jsonb_build_object(
    'organization_name', v_rec.org_name,
    'expired', (v_rec.status = 'expired' or v_rec.expires_at <= now())
  );
end;
$$;

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_user   record;
  v_inv    record;
  v_membru record;
  v_id     uuid;
begin
  if v_uid is null then
    raise exception 'Trebuie să fii autentificat pentru a accepta invitația.' using errcode = 'PT401';
  end if;

  select u.email, u.email_confirmed_at into v_user from auth.users u where u.id = v_uid;
  if v_user.email_confirmed_at is null then
    raise exception 'Confirmă mai întâi adresa de e-mail, apoi acceptă invitația.'
      using errcode = 'PT403';
  end if;

  -- Clientul NU trimite organization_id: organizația se deduce din invitație.
  select * into v_inv
  from public.invitations i
  where i.token_hash = internal.sha256_hex(btrim(coalesce(p_token, '')))
    and i.deleted_at is null
  for update;

  if not found then
    raise exception 'Invitație inexistentă sau deja folosită.' using errcode = 'PT404';
  end if;

  if v_inv.status <> 'pending' then
    raise exception 'Invitația a fost deja folosită sau revocată.' using errcode = 'PT409';
  end if;

  if v_inv.expires_at <= now() then
    update public.invitations set status = 'expired' where id = v_inv.id;
    perform app.write_audit('invite_accepted', v_inv.organization_id, 'invitations', v_inv.id,
                            null, null, 'denied', 'PT410');
    raise exception 'Invitația a expirat. Cere una nouă administratorului.' using errcode = 'PT410';
  end if;

  if lower(v_user.email::text) <> lower(v_inv.email::text) then
    perform app.write_audit('invite_accepted', v_inv.organization_id, 'invitations', v_inv.id,
                            null, null, 'denied', 'PT403');
    raise exception 'Invitația este emisă pentru altă adresă de e-mail.' using errcode = 'PT403';
  end if;

  select * into v_membru
  from public.organization_members m
  where m.organization_id = v_inv.organization_id and m.user_id = v_uid;

  if found then
    -- Fără resurecție automată: un membru șters logic sau dezactivat se
    -- reînrolează manual de un org_admin, ca să nu se piardă motivul plecării.
    if v_membru.deleted_at is not null or v_membru.status in ('inactive', 'suspended') then
      perform app.write_audit('invite_accepted', v_inv.organization_id, 'organization_members',
                              v_membru.id, null, null, 'denied', 'PT409');
      raise exception 'Ai avut anterior acces la această organizație. Este necesară reînrolarea manuală de către un administrator.'
        using errcode = 'PT409';
    end if;
    raise exception 'Ești deja membru al acestei organizații.' using errcode = 'PT409';
  end if;

  insert into public.organization_members
    (organization_id, user_id, role, status, invited_by, invitation_id, created_by, updated_by)
  values
    (v_inv.organization_id, v_uid, v_inv.role, 'active', v_inv.invited_by, v_inv.id, v_uid, v_uid)
  returning id into v_id;

  update public.invitations
     set status = 'accepted', accepted_at = now(), accepted_by = v_uid, updated_by = v_uid
   where id = v_inv.id;

  update public.profiles set last_organization_id = v_inv.organization_id where id = v_uid;

  perform app.write_audit('invite_accepted', v_inv.organization_id, 'invitations', v_inv.id);
  perform app.write_audit('member_added', v_inv.organization_id, 'organization_members', v_id);
  return v_id;
end;
$$;

-- ── 9. Storage ───────────────────────────────────────────────────────────────
-- CONTRACT UNIC DE CALE:
--   {organization_id}/{resursă}/{entity_id}/{uuid}-{nume_fișier}
-- Segmentul 1 trebuie să fie o organizație a utilizatorului; segmentul 2 este
-- EXACT numele resursei din role_permissions; pentru scope = 'own', segmentul 3
-- trebuie să fie chiar auth.uid().

create or replace function app.path_segment(p_name text, p_index integer)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select nullif(split_part(coalesce(p_name, ''), '/', p_index), '');
$$;

create or replace function app.path_org(p_name text)
returns uuid
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when app.path_segment(p_name, 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then app.path_segment(p_name, 1)::uuid
  end;
$$;

create or replace function app.path_resource(p_name text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when app.path_segment(p_name, 2) ~ '^[a-z][a-z0-9_]{1,63}$'
     and app.path_segment(p_name, 3) is not null
     and app.path_segment(p_name, 4) is not null
    then app.path_segment(p_name, 2)
  end;
$$;

create or replace function app.can_path(p_name text, p_action text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with p as (
    select app.path_org(p_name) as org,
           app.path_resource(p_name) as res,
           app.path_segment(p_name, 3) as ent
  )
  select coalesce((
    select case
      when p.org is null or p.res is null then false
      when not (p.org = any (app.current_org_ids())) then false
      else case app.has_permission(p.org, p.res, p_action)
             when 'all'  then true
             when 'team' then true
             when 'own'  then p.ent = (select auth.uid())::text
             else false
           end
    end
    from p
  ), false);
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('org-documents', 'org-documents', false, 26214400,
   array['application/pdf','image/png','image/jpeg','image/webp',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/csv']),
  ('org-branding', 'org-branding', false, 2097152,
   array['image/png','image/jpeg','image/webp','image/svg+xml','image/x-icon'])
on conflict (id) do nothing;

create policy storage_objects_select on storage.objects for select to authenticated
using (
  bucket_id in ('org-documents', 'org-branding')
  and app.path_org(name) = any ((select app.current_org_ids())::uuid[])
  and app.can_path(name, 'read')
);

create policy storage_objects_insert on storage.objects for insert to authenticated
with check (
  bucket_id in ('org-documents', 'org-branding')
  and app.path_org(name) = any ((select app.current_org_ids())::uuid[])
  and app.can_path(name, 'create')
  and owner = (select auth.uid())
);

create policy storage_objects_update on storage.objects for update to authenticated
using (
  bucket_id in ('org-documents', 'org-branding')
  and app.path_org(name) = any ((select app.current_org_ids())::uuid[])
  and app.can_path(name, 'update')
)
with check (
  bucket_id in ('org-documents', 'org-branding')
  and app.path_org(name) = any ((select app.current_org_ids())::uuid[])
  and app.can_path(name, 'update')
);
-- Fără politică DELETE: ștergerea fișierelor trece prin service_role, după
-- înregistrarea în audit.

-- ── 10. Privilegii pe funcții (R3) ──────────────────────────────────────────
-- Bucla acoperă fiecare funcție din `app`, ca să nu poată fi uitată una la o
-- migrare viitoare — același mecanism de descoperire ca în 0001.
do $do$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure::text as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app'
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;

  for f in
    select p.oid::regprocedure::text as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'internal'
  loop
    -- Funcțiile de trigger nu au nevoie de EXECUTE pentru apelant: privilegiul
    -- se verifică la CREATE TRIGGER, nu la declanșare.
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end
$do$;

revoke execute on function public.submit_demo_request(text, text, text, text, public.employee_band, text) from public;
revoke execute on function public.peek_invitation(text) from public;
revoke execute on function public.accept_invitation(text) from public, anon;

-- Singurele două puncte de intrare pentru `anon`. Calea publică nu atinge
-- niciodată service_role.
grant execute on function public.submit_demo_request(text, text, text, text, public.employee_band, text)
  to anon, authenticated;
grant execute on function public.peek_invitation(text) to anon, authenticated;
grant execute on function public.accept_invitation(text) to authenticated;

-- Implicitul „orice rol poate executa orice funcție nouă” este dezarmat pentru
-- viitoarele migrări. Funcțiile deja create au fost tratate explicit mai sus.
alter default privileges in schema public   revoke execute on functions from public;
alter default privileges in schema app      revoke execute on functions from public;
alter default privileges in schema internal revoke execute on functions from public;

-- ── 11. Punte pentru limitarea de rată și pentru audit ───────────────────────
--
-- `internal.rate_limit_hit` și `app.write_audit` trăiesc în scheme pe care
-- PostgREST nu le expune, deci `supabase.rpc(...)` nu le poate atinge. Ambele
-- primesc aici câte un înveliș în schema `public`, vizibil pentru PostgREST.
--
-- Privilegiul este acordat EXCLUSIV lui `service_role`, deliberat.
-- Dacă `anon` ar putea apela direct limitarea de rată, oricine ar epuiza cota
-- altcuiva trimițând de cinci ori `login:cont:victima@exemplu.ro` și ar bloca
-- acel cont din exterior — un instrument de blocare, nu de apărare. Cheia se
-- compune server-side, din IP-ul real și din datele trimise, iar apelul pleacă
-- din Server Action prin clientul admin, care nu poate fi importat în cod de
-- client (regula ESLint `no-restricted-imports`).

create or replace function public.consume_rate_limit(
  p_key            text,
  p_limit          integer,
  p_window_seconds integer
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select internal.rate_limit_hit(p_key, p_limit, make_interval(secs => p_window_seconds));
$$;

comment on function public.consume_rate_limit(text, integer, integer) is
  'Înveliș pentru PostgREST. Doar service_role: expus lui anon, ar deveni un instrument de blocare a conturilor.';

revoke execute on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant  execute on function public.consume_rate_limit(text, integer, integer) to service_role;

-- Auditul, apelabil din Server Actions. Toți parametrii în afară de acțiune au
-- valori implicite: PostgREST rezolvă supraîncărcarea după numele argumentelor
-- trimise, deci un singur antet cu DEFAULT-uri acceptă orice submulțime.
create or replace function public.log_audit_event(
  p_action          public.audit_action,
  p_status          public.audit_status default 'success',
  p_organization_id uuid    default null,
  p_entity_type     text    default null,
  p_entity_id       uuid    default null,
  p_before          jsonb   default null,
  p_after           jsonb   default null,
  p_ip              text    default null,
  p_user_agent      text    default null,
  p_request_id      text    default null,
  p_error_code      text    default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  -- Un utilizator nu poate scrie audit pe seama altei organizații decât a lui.
  -- Fără verificarea asta, oricine ar putea polua jurnalul altui client.
  if p_organization_id is not null
     and not app.is_member(p_organization_id)
     and not app.is_platform_admin()
     and not app.is_service_context() then
    raise exception 'Acces interzis la jurnalul acestei organizații.' using errcode = '42501';
  end if;

  insert into public.audit_logs (
    organization_id, actor_id, action, status, entity_type, entity_id,
    before, after, ip, user_agent, request_id, error_code
  )
  values (
    p_organization_id, (select auth.uid()), p_action, p_status, p_entity_type, p_entity_id,
    p_before, p_after,
    case when p_ip is null or p_ip = 'necunoscut' then null else p_ip::inet end,
    p_user_agent, p_request_id, p_error_code
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.log_audit_event(
  public.audit_action, public.audit_status, uuid, text, uuid, jsonb, jsonb, text, text, text, text
) from public, anon;
grant execute on function public.log_audit_event(
  public.audit_action, public.audit_status, uuid, text, uuid, jsonb, jsonb, text, text, text, text
) to authenticated, service_role;

-- ── 12. Resurse adăugate după alinierea vocabularului ───────────────────────
--
-- `roles` (editarea matricei de permisiuni a organizației) și `reports` lipseau
-- din seed, deși codul le cerea. O cheie fără corespondent nu produce eroare:
-- `app.has_permission` întoarce `none`, adică refuz tăcut — iar efectul vizibil
-- era că intrările respective dispăreau din meniu pentru toată lumea, inclusiv
-- pentru `org_admin`.
insert into public.role_permissions (organization_id, role, resource, action, scope)
values
  -- roles: doar org_admin își ajustează matricea de permisiuni.
  (null, 'org_admin', 'roles', 'read',   'all'),
  (null, 'org_admin', 'roles', 'update', 'all'),
  (null, 'manager',   'roles', 'read',   'none'),
  (null, 'hr',        'roles', 'read',   'none'),
  (null, 'employee',  'roles', 'read',   'none'),

  -- reports: rapoartele agregă date pe care rolul le vede oricum; scope-ul de
  -- aici decide doar ce arie acoperă raportul, nu ce rânduri sunt vizibile —
  -- acelea rămân filtrate de RLS-ul tabelelor sursă.
  (null, 'org_admin', 'reports', 'read',   'all'),
  (null, 'org_admin', 'reports', 'export', 'all'),
  (null, 'hr',        'reports', 'read',   'all'),
  (null, 'hr',        'reports', 'export', 'all'),
  (null, 'manager',   'reports', 'read',   'team'),
  (null, 'employee',  'reports', 'read',   'none')
on conflict do nothing;
