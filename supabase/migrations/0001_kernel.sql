-- ─────────────────────────────────────────────────────────────────────────────
-- 0001_kernel.sql — nucleul platformei "Administrativo"
--
-- Sursa unică de adevăr pentru schema Fazei 1a. Conține: extensii, scheme,
-- enum-uri, tabele, indexuri, triggerul de `updated_at`, triggerul de profil la
-- signup și seed-urile obligatorii (`features`, `retention_policies`).
--
-- NU conține: helperii `app.*` de autorizare, politicile RLS, seed-ul
-- `role_permissions`, triggerul de audit — acelea sunt în `0002`. Aici se
-- activează totuși `ENABLE`/`FORCE ROW LEVEL SECURITY` pe fiecare tabelă, ca să
-- nu rămână niciuna descoperită între cele două migrări.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 0. Compatibilitate cu Postgres gol (CI) ──────────────────────────────────
-- Migrarea rulează și pe un Postgres 17 efemer, fără GoTrue. Blocul creează
-- doar ce lipsește; pe Supabase fiecare ramură este sărită, deci efect zero.
do $$
begin
  if to_regnamespace('extensions') is null then
    create schema extensions;
  end if;

  if to_regrole('anon') is null then create role anon nologin noinherit; end if;
  if to_regrole('authenticated') is null then create role authenticated nologin noinherit; end if;
  if to_regrole('service_role') is null then create role service_role nologin noinherit bypassrls; end if;

  if to_regclass('auth.users') is null then
    create schema if not exists auth;
    -- Pe Supabase, `authenticated` are USAGE pe schema `auth` și EXECUTE pe
    -- `auth.uid()` (verificat pe proiectul real). Substitutul local trebuie să
    -- reproducă asta, altfel orice trigger care apelează `auth.uid()` cade cu
    -- „permission denied for schema auth" — un eșec care există doar local și
    -- trimite pe piste false.
    grant usage on schema auth to anon, authenticated, service_role;
    create table auth.users (
      id uuid primary key,
      email text,
      phone text,
      raw_user_meta_data jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
  end if;
end
$$;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists btree_gist with schema extensions;

-- ── 1. Scheme ────────────────────────────────────────────────────────────────
create schema if not exists app;        -- helperi de autorizare (populați în 0002)
create schema if not exists internal;   -- funcții de job/trigger, NEexpuse prin PostgREST

comment on schema app is 'Helperi SECURITY DEFINER de autorizare. Neexpusă prin PostgREST.';
comment on schema internal is 'Funcții de întreținere și triggere de sistem. Neexpusă prin PostgREST.';

grant usage on schema extensions to anon, authenticated, service_role;
grant usage on schema app to authenticated, service_role;

-- ── 2. Enum-uri de platformă ─────────────────────────────────────────────────
-- Enum doar pentru mulțimi închise, controlate de noi. Ce va extinde clientul
-- (tipuri de concediu, coduri CM, tipuri de document) stă în nomenclatoare.

create type public.app_role as enum ('super_admin', 'org_admin', 'manager', 'hr', 'employee');
-- ATENȚIE: `super_admin` NU se stochează niciodată în `organization_members`
-- (există CHECK care îl interzice). Sursa de adevăr e `platform_admins`.

create type public.permission_scope as enum ('none', 'own', 'team', 'all');
-- `none` = REFUZ EXPLICIT, nu absența rândului. RANK = none:0, own:1, team:2, all:3.

create type public.organization_status as enum ('pending', 'active', 'suspended', 'archived');
create type public.plan_type as enum ('trial', 'starter', 'professional', 'enterprise');
create type public.subscription_status_type as enum ('trialing', 'active', 'past_due', 'canceled', 'expired');
create type public.member_status as enum ('active', 'suspended', 'inactive');
create type public.invitation_status as enum ('pending', 'accepted', 'expired', 'revoked');
create type public.feature_group as enum ('core', 'hr', 'operations', 'finance', 'communication', 'portal');

create type public.audit_action as enum (
  'create', 'update', 'delete', 'restore', 'view', 'export', 'import',
  'login', 'logout', 'login_failed', 'password_reset',
  'invite_sent', 'invite_accepted', 'invite_revoked',
  'member_added', 'member_removed', 'role_changed', 'permission_changed',
  'feature_toggled', 'org_created', 'org_activated', 'org_suspended',
  'tenant_switch', 'tenant_forged', 'rate_limited', 'email_sent',
  'demo_requested', 'impersonation_start', 'impersonation_end'
);
create type public.audit_status as enum ('success', 'failure', 'denied');

create type public.notification_kind as enum (
  'info', 'success', 'warning', 'error', 'task', 'reminder', 'approval', 'announcement'
);
create type public.locale_code as enum ('ro-RO', 'en-US');
create type public.demo_request_status as enum ('new', 'contacted', 'qualified', 'converted', 'rejected', 'spam');
create type public.employee_band as enum ('1-9', '10-49', '50-249', '250+');
create type public.email_status as enum ('queued', 'sent', 'delivered', 'bounced', 'complained', 'failed');

-- ── 3. Tabele ────────────────────────────────────────────────────────────────

-- 3.1 organizations
create table public.organizations (
  id                  uuid primary key default gen_random_uuid(),
  slug                extensions.citext not null,
  name                text not null check (char_length(btrim(name)) between 2 and 200),
  legal_name          text,
  forma_juridica      text,
  cui                 text not null check (cui ~* '^\s*(RO)?\s*[0-9]{2,10}\s*$'),
  -- Normalizarea păstrează doar cifrele: `RO 12345678` și `12345678` sunt aceeași firmă.
  cui_normalizat      text generated always as (regexp_replace(cui, '[^0-9]', '', 'g')) stored,
  platitor_tva        boolean not null default false,
  reg_com             text,
  adresa              text,
  judet               text,
  oras                text,
  cod_postal          text,
  tara                text not null default 'RO' check (tara ~ '^[A-Z]{2}$'),
  email_contact       extensions.citext check (email_contact ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  telefon_contact     text,
  website             text,
  reprezentant_legal  text,
  status              public.organization_status not null default 'pending',
  plan                public.plan_type not null default 'trial',
  seats_limit         integer not null default 10 check (seats_limit between 1 and 100000),
  subscription_status public.subscription_status_type not null default 'trialing',
  trial_ends_at       timestamptz,
  timezone            text not null default 'Europe/Bucharest',
  locale              public.locale_code not null default 'ro-RO',
  moneda              text not null default 'RON' check (moneda ~ '^[A-Z]{3}$'),
  activated_at        timestamptz,
  suspended_at        timestamptz,
  suspended_reason    text,
  created_at          timestamptz not null default now(),
  created_by          uuid references auth.users (id) on delete set null,
  updated_at          timestamptz not null default now(),
  updated_by          uuid references auth.users (id) on delete set null,
  deleted_at          timestamptz,
  -- Cast la text: `citext ~ text` compară fără diferență de literă, deci nu ar
  -- prinde majusculele. Cast-ul le respinge și impune forma de subdomeniu.
  constraint organizations_slug_format_ck
    check (slug::text ~ '^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])$'),
  constraint organizations_slug_rezervat_ck
    check (slug::text <> all (array[
      'app', 'www', 'api', 'admin', 'auth', 'static', 'cdn', 'mail', 'status', 'docs'
    ])),
  -- NEfiltrată pe deleted_at, deliberat: o firmă ștearsă nu eliberează CUI-ul.
  constraint organizations_cui_normalizat_uq unique (cui_normalizat)
);
comment on column public.organizations.slug is 'Pregătire pentru subdomenii. Faza 1a rulează pe host unic.';

create unique index organizations_slug_uq on public.organizations (slug) where deleted_at is null;
create index organizations_status_idx on public.organizations (status) where deleted_at is null;
create index organizations_created_by_idx on public.organizations (created_by);
create index organizations_updated_by_idx on public.organizations (updated_by);

-- 3.2 organization_branding (1:1). Faza 1a: strict minimul.
create table public.organization_branding (
  organization_id   uuid primary key references public.organizations (id) on delete cascade,
  denumire_afisata  text,
  primary_color     text check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  logo_light_path   text,
  logo_dark_path    text,
  favicon_path      text,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users (id) on delete set null,
  updated_at        timestamptz not null default now(),
  updated_by        uuid references auth.users (id) on delete set null,
  deleted_at        timestamptz
);
create index organization_branding_created_by_idx on public.organization_branding (created_by);
create index organization_branding_updated_by_idx on public.organization_branding (updated_by);

-- 3.3 profiles. FĂRĂ `is_platform_admin`: sursa de adevăr e `platform_admins`.
create table public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  email                extensions.citext not null,
  full_name            text,
  avatar_path          text,
  phone                text,
  locale               public.locale_code not null default 'ro-RO',
  timezone             text not null default 'Europe/Bucharest',
  last_seen_at         timestamptz,
  last_organization_id uuid references public.organizations (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  updated_by           uuid references auth.users (id) on delete set null,
  deleted_at           timestamptz
);
create unique index profiles_email_uq on public.profiles (email) where deleted_at is null;
create index profiles_last_organization_idx on public.profiles (last_organization_id);
create index profiles_updated_by_idx on public.profiles (updated_by);

-- 3.4 platform_admins — singura sursă de adevăr pentru rolul de platformă.
create table public.platform_admins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  motiv      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_admins_revocare_ck
    check ((revoked_at is null and revoked_by is null) or revoked_at is not null)
);
create unique index platform_admins_user_activ_uq on public.platform_admins (user_id) where revoked_at is null;
create index platform_admins_granted_by_idx on public.platform_admins (granted_by);
create index platform_admins_revoked_by_idx on public.platform_admins (revoked_by);

-- 3.5 invitations. Se creează înaintea `organization_members`, care o referă.
create table public.invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email           extensions.citext not null check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  role            public.app_role not null default 'employee',
  -- Tokenul în clar nu atinge niciodată baza: se stochează sha256 hex.
  token_hash      text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at      timestamptz not null,
  status          public.invitation_status not null default 'pending',
  invited_by      uuid references auth.users (id) on delete set null,
  accepted_at     timestamptz,
  accepted_by     uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id) on delete set null,
  deleted_at      timestamptz,
  constraint invitations_rol_ck check (role <> 'super_admin'),
  constraint invitations_acceptare_ck
    check ((status = 'accepted') = (accepted_at is not null))
);
create unique index invitations_token_hash_uq on public.invitations (token_hash);
create unique index invitations_org_email_pending_uq
  on public.invitations (organization_id, email)
  where status = 'pending' and deleted_at is null;
create index invitations_org_status_idx on public.invitations (organization_id, status) where deleted_at is null;
create index invitations_expires_at_idx on public.invitations (expires_at) where status = 'pending';
create index invitations_invited_by_idx on public.invitations (invited_by);
create index invitations_accepted_by_idx on public.invitations (accepted_by);
create index invitations_created_by_idx on public.invitations (created_by);
create index invitations_updated_by_idx on public.invitations (updated_by);

-- 3.6 organization_members — apartenența, verificată direct de fiecare politică RLS.
create table public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            public.app_role not null default 'employee',
  status          public.member_status not null default 'active',
  job_title       text,
  joined_at       timestamptz not null default now(),
  invited_by      uuid references auth.users (id) on delete set null,
  invitation_id   uuid references public.invitations (id) on delete set null,
  deactivated_at  timestamptz,
  deactivated_by  uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id) on delete set null,
  deleted_at      timestamptz,
  constraint organization_members_rol_ck check (role <> 'super_admin')
);
create unique index organization_members_org_user_uq
  on public.organization_members (organization_id, user_id) where deleted_at is null;
create index organization_members_user_activ_idx
  on public.organization_members (user_id) where deleted_at is null and status = 'active';
create index organization_members_org_rol_idx
  on public.organization_members (organization_id, role) where deleted_at is null;
create index organization_members_invitation_idx on public.organization_members (invitation_id);
create index organization_members_invited_by_idx on public.organization_members (invited_by);
create index organization_members_deactivated_by_idx on public.organization_members (deactivated_by);
create index organization_members_created_by_idx on public.organization_members (created_by);
create index organization_members_updated_by_idx on public.organization_members (updated_by);

-- 3.7 features — catalog GLOBAL de module. Fără organization_id, fără deleted_at.
create table public.features (
  feature_key text primary key check (feature_key ~ '^[a-z][a-z0-9_]{1,48}$'),
  denumire    text not null,
  descriere   text,
  icon        text not null default 'circle',
  grup        public.feature_group not null,
  is_core     boolean not null default false,
  sort_order  integer not null default 100,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index features_grup_sort_idx on public.features (grup, sort_order);

-- 3.8 organization_features
create table public.organization_features (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  feature_key     text not null references public.features (feature_key) on delete cascade,
  enabled         boolean not null default false,
  activated_at    timestamptz,
  activated_by    uuid references auth.users (id) on delete set null,
  settings        jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id) on delete set null,
  deleted_at      timestamptz
);
create unique index organization_features_org_key_uq
  on public.organization_features (organization_id, feature_key) where deleted_at is null;
create index organization_features_active_idx
  on public.organization_features (organization_id) where enabled and deleted_at is null;
create index organization_features_key_idx on public.organization_features (feature_key);
create index organization_features_activated_by_idx on public.organization_features (activated_by);
create index organization_features_created_by_idx on public.organization_features (created_by);
create index organization_features_updated_by_idx on public.organization_features (updated_by);

-- 3.9 role_permissions
-- `organization_id IS NULL` = implicitul global al platformei.
-- Rezolvarea suprascrierii, o singură interogare:
--   select distinct on (role, resource, action) scope
--   from public.role_permissions
--   where deleted_at is null
--     and (organization_id = $1 or organization_id is null)
--   order by role, resource, action, (organization_id is null) asc;
-- Rândul organizației sortează primul (`false < true`), deci bate implicitul.
-- Absența oricărui rând = refuz; `scope = 'none'` = refuz EXPLICIT, care
-- suprascrie implicitul global chiar dacă acela ar acorda ceva.
create table public.role_permissions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  role            public.app_role not null,
  resource        text not null check (resource ~ '^[a-z][a-z0-9_.]{1,63}$'),
  action          text not null check (action ~ '^[a-z][a-z0-9_]{1,31}$'),
  scope           public.permission_scope not null default 'none',
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id) on delete set null,
  deleted_at      timestamptz
);
-- `NULLS NOT DISTINCT` (PG15+): fără el, NULL <> NULL și s-ar putea insera
-- oricâte rânduri globale duplicate pentru aceeași triadă rol/resursă/acțiune.
create unique index role_permissions_uq
  on public.role_permissions (organization_id, role, resource, action)
  nulls not distinct
  where deleted_at is null;
create index role_permissions_lookup_idx
  on public.role_permissions (role, resource, action) where deleted_at is null;
create index role_permissions_created_by_idx on public.role_permissions (created_by);
create index role_permissions_updated_by_idx on public.role_permissions (updated_by);

-- 3.10 audit_logs — APPEND-ONLY: fără updated_at, updated_by, deleted_at.
-- FK-urile sunt `on delete set null`: urma de audit supraviețuiește ștergerii
-- organizației sau a contului. Partiționarea e amânată deliberat din Faza 1.
create table public.audit_logs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  actor_id        uuid references auth.users (id) on delete set null,
  action          public.audit_action not null,
  status          public.audit_status not null default 'success',
  entity_type     text,
  entity_id       uuid,
  before          jsonb,
  after           jsonb,
  ip              inet,
  user_agent      text,
  request_id      text,
  error_code      text,
  created_at      timestamptz not null default now()
);
create index audit_logs_org_created_idx on public.audit_logs (organization_id, created_at desc);
create index audit_logs_actor_created_idx on public.audit_logs (actor_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_esec_idx on public.audit_logs (created_at desc) where status <> 'success';

-- 3.11 notifications
create table public.notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind            public.notification_kind not null default 'info',
  title           text not null check (char_length(btrim(title)) between 1 and 200),
  body            text check (char_length(body) <= 4000),
  -- Doar cale internă. `//evil.com` este URL absolut protocol-relativ: respins.
  link            text check (link ~ '^/[^/\\]'),
  entity_type     text,
  entity_id       uuid,
  read_at         timestamptz,
  sent_email_at   timestamptz,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id) on delete set null,
  deleted_at      timestamptz
);
create index notifications_user_idx
  on public.notifications (user_id, created_at desc) where deleted_at is null;
create index notifications_necitite_idx
  on public.notifications (user_id, created_at desc) where read_at is null and deleted_at is null;
create index notifications_org_idx on public.notifications (organization_id);
create index notifications_created_by_idx on public.notifications (created_by);
create index notifications_updated_by_idx on public.notifications (updated_by);

-- 3.12 notification_preferences — minimal: fără ore de liniște, fără digest.
create table public.notification_preferences (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind            public.notification_kind not null,
  in_app          boolean not null default true,
  email           boolean not null default false,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id) on delete set null,
  deleted_at      timestamptz
);
create unique index notification_preferences_uq
  on public.notification_preferences (user_id, organization_id, kind) where deleted_at is null;
create index notification_preferences_org_idx on public.notification_preferences (organization_id);
create index notification_preferences_created_by_idx on public.notification_preferences (created_by);
create index notification_preferences_updated_by_idx on public.notification_preferences (updated_by);

-- 3.13 demo_requests — PRE-TENANT: fără organization_id. Scrise de rolul `anon`
-- printr-o funcție SECURITY DEFINER (0002), niciodată cu service_role.
create table public.demo_requests (
  id           uuid primary key default gen_random_uuid(),
  nume         text not null check (char_length(btrim(nume)) between 2 and 120),
  firma        text not null check (char_length(btrim(firma)) between 2 and 200),
  email        extensions.citext not null check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  telefon      text check (telefon is null or char_length(btrim(telefon)) between 6 and 32),
  nr_angajati  public.employee_band,
  mesaj        text check (char_length(mesaj) <= 2000),
  status       public.demo_request_status not null default 'new',
  ip           inet,
  user_agent   text,
  created_at   timestamptz not null default now(),
  -- `AT TIME ZONE '<zonă fixă>'` este IMMUTABLE, deci se poate genera STORED.
  -- Ziua de București, nu UTC: altfel o cerere de la 01:00 ar cădea în ziua trecută.
  created_day  date generated always as (((created_at at time zone 'Europe/Bucharest')::date)) stored,
  created_by   uuid references auth.users (id) on delete set null,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users (id) on delete set null,
  deleted_at   timestamptz
);
create unique index demo_requests_email_zi_uq
  on public.demo_requests (email, created_day) where deleted_at is null;
create index demo_requests_status_idx
  on public.demo_requests (status, created_at desc) where deleted_at is null;
create index demo_requests_created_by_idx on public.demo_requests (created_by);
create index demo_requests_updated_by_idx on public.demo_requests (updated_by);

-- 3.14 rate_limits — în Postgres, nu în memorie: runtime-ul serverless are N
-- instanțe, iar un contor în proces nu limitează nimic.
create table public.rate_limits (
  key          text not null check (char_length(key) between 1 and 200),
  window_start timestamptz not null,
  count        integer not null default 0 check (count >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (key, window_start)
);
create index rate_limits_window_idx on public.rate_limits (window_start);

-- 3.15 document_sequences — numerotare per organizație / an / tip document.
-- Fără `deleted_at`: un contor nu se șterge logic, altfel numerele s-ar relua.
create table public.document_sequences (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  document_type   text not null check (document_type ~ '^[a-z][a-z0-9_]{1,31}$'),
  year            integer not null check (year between 2000 and 2200),
  prefix          text not null default '' check (char_length(prefix) <= 16),
  next_number     integer not null default 1 check (next_number >= 1),
  padding         smallint not null default 5 check (padding between 1 and 12),
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id) on delete set null,
  constraint document_sequences_uq unique (organization_id, document_type, year)
);
create index document_sequences_created_by_idx on public.document_sequences (created_by);
create index document_sequences_updated_by_idx on public.document_sequences (updated_by);

-- 3.16 retention_policies. `organization_id IS NULL` = implicitul platformei.
create table public.retention_policies (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid references public.organizations (id) on delete cascade,
  entity_type       text not null check (entity_type ~ '^[a-z][a-z0-9_]{1,63}$'),
  retention_months  integer not null check (retention_months between 1 and 1200),
  anonymize_only    boolean not null default false,
  enabled           boolean not null default true,
  legal_basis       text,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users (id) on delete set null,
  updated_at        timestamptz not null default now(),
  updated_by        uuid references auth.users (id) on delete set null,
  deleted_at        timestamptz
);
create unique index retention_policies_uq
  on public.retention_policies (organization_id, entity_type)
  nulls not distinct
  where deleted_at is null;
create index retention_policies_created_by_idx on public.retention_policies (created_by);
create index retention_policies_updated_by_idx on public.retention_policies (updated_by);

-- 3.17 email_log — substitutul simplu al outbox-ului până în Faza 4.
create table public.email_log (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  destinatar      extensions.citext not null,
  subiect         text not null,
  template        text not null check (template ~ '^[a-z][a-z0-9_]{1,63}$'),
  status          public.email_status not null default 'queued',
  provider_id     text,
  error           text,
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index email_log_provider_id_uq on public.email_log (provider_id) where provider_id is not null;
create index email_log_org_created_idx on public.email_log (organization_id, created_at desc);
create index email_log_status_idx on public.email_log (status, created_at desc);
create index email_log_destinatar_idx on public.email_log (destinatar);

-- ── 4. updated_at ────────────────────────────────────────────────────────────
create or replace function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function app.set_updated_at() from public, anon;
grant execute on function app.set_updated_at() to authenticated, service_role;

-- Atașare prin descoperire: orice tabelă cu `updated_at` primește triggerul,
-- deci nu se poate uita una la o migrare viitoare care copiază acest bloc.
do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'updated_at'
                       and a.attnum > 0 and not a.attisdropped
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function app.set_updated_at()',
      'set_updated_at_' || t.relname, t.relname
    );
  end loop;
end
$$;

-- ── 5. Profil la signup ──────────────────────────────────────────────────────
-- Utilizatorii se creează exclusiv prin invitație (onboarding sales-led), dar
-- profilul trebuie să existe din prima secundă: altfel prima citire a
-- `profiles` întoarce zero rânduri și interfața rămâne fără nume.
create or replace function internal.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Cont fără e-mail (autentificare pe telefon) nu e suportat în Faza 1a:
  -- ieșim tăcut, în loc să violăm NOT NULL și să blocăm signup-ul.
  if new.email is null then
    return new;
  end if;

  insert into public.profiles (id, email, full_name, avatar_path)
  values (
    new.id,
    new.email::text::extensions.citext,
    nullif(btrim(coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    )), ''),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set email      = excluded.email,
        full_name  = coalesce(public.profiles.full_name, excluded.full_name),
        updated_at = now();

  return new;
end;
$$;

revoke execute on function internal.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function internal.handle_new_user();

-- ── 6. RLS ───────────────────────────────────────────────────────────────────
-- Politicile vin în 0002. Aici doar activarea, ca să nu existe fereastră în
-- care o tabelă e creată și descoperită.
alter table public.organizations             enable row level security;
alter table public.organization_branding     enable row level security;
alter table public.profiles                  enable row level security;
alter table public.platform_admins           enable row level security;
alter table public.invitations               enable row level security;
alter table public.organization_members      enable row level security;
alter table public.features                  enable row level security;
alter table public.organization_features     enable row level security;
alter table public.role_permissions          enable row level security;
alter table public.audit_logs                enable row level security;
alter table public.notifications             enable row level security;
alter table public.notification_preferences  enable row level security;
alter table public.demo_requests             enable row level security;
alter table public.rate_limits               enable row level security;
alter table public.document_sequences        enable row level security;
alter table public.retention_policies        enable row level security;
alter table public.email_log                 enable row level security;

-- FORCE peste tot MINUS lista albă. Excepțiile — organization_members,
-- platform_admins, role_permissions, features — sunt citite de helperii
-- SECURITY DEFINER; cu FORCE, helperul ar declanșa chiar politica ce îl
-- apelează și Postgres ar cădea în recursiune infinită.
alter table public.organizations             force row level security;
alter table public.organization_branding     force row level security;
alter table public.profiles                  force row level security;
alter table public.invitations               force row level security;
alter table public.organization_features     force row level security;
alter table public.audit_logs                force row level security;
alter table public.notifications             force row level security;
alter table public.notification_preferences  force row level security;
alter table public.demo_requests             force row level security;
alter table public.rate_limits               force row level security;
alter table public.document_sequences        force row level security;
alter table public.retention_policies        force row level security;
alter table public.email_log                 force row level security;

-- ── 7. Privilegii de tabelă ──────────────────────────────────────────────────
-- RLS filtrează rândurile; GRANT-ul decide dacă rolul poate atinge tabela.
-- Ambele sunt necesare — proiectele noi nu mai expun automat tabelele.
grant usage on schema public to anon, authenticated, service_role;

revoke all on all tables in schema public from anon;
grant select, insert, update on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

-- Soft delete peste tot ⇒ nimeni nu șterge fizic prin Data API.
revoke delete on all tables in schema public from public, anon, authenticated;

-- Append-only, scrise exclusiv prin funcții SECURITY DEFINER sau service_role.
revoke insert, update on public.audit_logs from authenticated;
revoke insert, update on public.email_log from authenticated;
revoke all on public.rate_limits from authenticated;
-- Catalog global de module: doar citire pentru utilizatorii finali.
revoke insert, update on public.features from authenticated;
-- Rolul de platformă nu se acordă din client.
revoke insert, update on public.platform_admins from authenticated;
-- Formularul public scrie prin funcția SECURITY DEFINER apelabilă de `anon`.
revoke insert on public.demo_requests from authenticated;

-- ── 8. Seed: catalogul de module ─────────────────────────────────────────────
insert into public.features (feature_key, denumire, descriere, icon, grup, is_core, sort_order) values
  ('nucleu', 'Nucleu',
   'Organizații, utilizatori, roluri, permisiuni și jurnal de audit. Mereu activ.',
   'layout-dashboard', 'core', true, 10),
  ('attendance', 'Pontaj',
   'Prezență zilnică, ore lucrate, ore suplimentare și sporuri.',
   'clock', 'hr', false, 20),
  ('leave', 'Concedii',
   'Cereri de concediu, aprobări, sold de zile și concedii medicale.',
   'calendar-days', 'hr', false, 30),
  ('onboarding', 'Integrare angajați',
   'Parcurs de integrare la angajare și listă de verificare la plecare.',
   'user-plus', 'hr', false, 40),
  ('payroll', 'Salarizare',
   'State de plată, contribuții, rețineri și fluturași de salariu.',
   'wallet', 'finance', false, 50),
  ('per_diem', 'Diurne și deplasări',
   'Ordine de deplasare, deconturi, diurne interne și externe.',
   'plane', 'finance', false, 60),
  ('fleet', 'Parc auto',
   'Vehicule, ITP, RCA, rovinietă, alimentări și foi de parcurs.',
   'car', 'operations', false, 70),
  ('maintenance', 'Mentenanță',
   'Echipamente, revizii planificate și intervenții de reparație.',
   'wrench', 'operations', false, 80),
  ('inventory', 'Inventar',
   'Obiecte de inventar, procese de predare-primire și stocuri.',
   'package', 'operations', false, 90),
  ('ssm', 'SSM și PSI',
   'Instruiri și fișe de instruire, echipament de protecție, accidente de muncă.',
   'shield-check', 'operations', false, 100),
  ('announcements', 'Anunțuri',
   'Comunicări interne către angajați, cu confirmare de citire.',
   'megaphone', 'communication', false, 110),
  ('employee_portal', 'Portal angajat',
   'Acces propriu al angajatului la documente, cereri și fluturași.',
   'smartphone', 'portal', false, 120);

-- ── 9. Seed: politici de retenție implicite ──────────────────────────────────
-- ⚠️ Termenele de mai jos sunt valori de pornire, NU consultanță juridică.
-- Trebuie confirmate de un jurist înainte de primul tenant real (NOTES.md §3).
-- `organization_id IS NULL` = implicitul platformei; o organizație îl poate
-- suprascrie cu un rând propriu pentru același `entity_type`.
insert into public.retention_policies (organization_id, entity_type, retention_months, anonymize_only, legal_basis) values
  (null, 'audit_logs',    60, false, '⚠️ de confirmat — trasabilitate internă și obligații de probă'),
  (null, 'notifications', 12, false, 'minimizare: notificările citite nu au valoare probatorie'),
  (null, 'demo_requests', 24, true,  '⚠️ de confirmat — interes legitim, prospectare comercială; anonimizare IP/user-agent'),
  (null, 'email_log',     12, false, '⚠️ de confirmat — dovada trimiterii comunicărilor contractuale'),
  (null, 'invitations',   12, false, 'invitațiile expirate nu mai au utilitate operațională'),
  (null, 'rate_limits',    1, false, 'contoare tehnice, fără caracter personal după fereastră');
