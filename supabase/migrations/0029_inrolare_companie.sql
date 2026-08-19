-- supabase/migrations/0029_inrolare_companie.sql
-- Faza — Înrolarea companiei (pasul zero): profil fiscal extins, reprezentant
-- legal criptat, flag de parolă obligatorie la primul login al owner-ului.

\set ON_ERROR_STOP on

-- ============================================================
-- 1. organizations — profil fiscal extins
-- ============================================================

alter table public.organizations
  add column cod_caen             text,
  add column capital_social       numeric(14, 2),
  add column strada               text,
  add column numar                text,
  add column sector               text,
  add column reprezentant_functie text;

alter table public.organizations
  add constraint organizations_cod_caen_format_ck
    check (cod_caen is null or cod_caen ~ '^[0-9]{4}$'),
  add constraint organizations_capital_social_ck
    check (capital_social is null or capital_social >= 0);

comment on column public.organizations.cod_caen is
  'Cod CAEN principal, 4 cifre. Poate lipsi (frecvent la PFA/II) — motorul de salarizare tratează absența ca "fără facilitate fiscală".';
comment on column public.organizations.capital_social is
  'Mereu completare manuală: API-ul ANAF nu oferă capitalul social (vine din Registrul Comerțului).';

-- ============================================================
-- 2. organization_legal_representative — 1:1, date sensibile separate
-- ============================================================
-- Pe modelul employee_sensitive_data: separată de organizations (citită des),
-- EXCLUSĂ din internal.attach_audit (conține criptotext — vezi garda R9 din
-- 0002_authz.sql) și din grant-urile pentru `authenticated`: singurul drum de
-- scriere/citire e prin Server Actions cu clientul service_role, ca la CNP-ul
-- angajaților.

create table public.organization_legal_representative (
  organization_id  uuid primary key references public.organizations (id) on delete cascade,
  nume             text,
  functie          text,
  cnp_ciphertext   bytea,
  cnp_iv           bytea,
  cnp_tag          bytea,
  cnp_key_version  int,
  cnp_last4        text,
  created_at       timestamptz not null default now(),
  created_by       uuid references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  deleted_at       timestamptz,
  constraint org_legal_rep_cnp_complet check (
    (cnp_ciphertext is null and cnp_iv is null and cnp_tag is null and cnp_key_version is null)
    or (cnp_ciphertext is not null and cnp_iv is not null and cnp_tag is not null and cnp_key_version is not null)
  ),
  constraint org_legal_rep_cnp_iv_len check (cnp_iv is null or octet_length(cnp_iv) = 12),
  constraint org_legal_rep_cnp_tag_len check (cnp_tag is null or octet_length(cnp_tag) = 16),
  constraint org_legal_rep_cnp_last4_ck check (cnp_last4 is null or cnp_last4 ~ '^[0-9]{4}$')
);
comment on table public.organization_legal_representative is
  'Reprezentantul legal (administrator/director general) al companiei. CNP opțional, criptat AES-GCM ca la employee_sensitive_data. Fără RLS pentru `authenticated`: acces exclusiv prin Server Actions, client service_role.';

alter table public.organization_legal_representative enable row level security;
alter table public.organization_legal_representative force row level security;
revoke all on public.organization_legal_representative from authenticated, anon;

create trigger set_actor_organization_legal_representative
  before insert or update on public.organization_legal_representative
  for each row execute function internal.set_actor();

create trigger set_updated_at_organization_legal_representative
  before update on public.organization_legal_representative
  for each row execute function internal.seteaza_updated_at();

-- ============================================================
-- 3. profiles — parolă temporară obligatorie la primul login
-- ============================================================

alter table public.profiles
  add column must_change_password boolean not null default false;

comment on column public.profiles.must_change_password is
  'true când contul a fost creat de un administrator de platformă cu parolă temporară (înrolare companie); (app)/layout.tsx redirecționează la /parola-noua până se schimbă.';
