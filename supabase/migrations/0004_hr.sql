-- supabase/migrations/0004_hr.sql
-- Faza 2 — nucleul HR: departamente, funcții, angajați, contracte, documente,
-- scutiri fiscale, permise de muncă, sporuri, adeverințe, REVISAL.
-- Politicile RLS detaliate vin în 0005; aici doar enable + force.

begin;

-- Căutarea după nume folosește un index trigram; extensia trebuie creată
-- explicit. Merge în schema `extensions`, ca pe Supabase, nu în `public` —
-- altfel cele ~15 funcții ale ei ajung în tipurile generate și în suprafața
-- expusă prin PostgREST. Operatorul se referă calificat, fiindcă `search_path`
-- al migrării nu conține `extensions`.
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- ============================================================
-- 1. ENUM-URI
-- ============================================================

create type public.employee_status as enum (
  'candidat',      -- fișă creată înainte de semnarea contractului
  'activ',
  'suspendat',     -- CIM suspendat (art. 51-54 Codul muncii)
  'preaviz',
  'incetat',
  'arhivat'
);

create type public.contract_duration as enum ('nedeterminat', 'determinat');

create type public.work_mode as enum ('sediu', 'telemunca', 'domiciliu', 'mixt');

create type public.special_regime as enum ('ucenicie', 'internship', 'zilier');

create type public.conditii_munca as enum ('normale', 'deosebite', 'speciale');

create type public.gen as enum ('masculin', 'feminin', 'nedeclarat');

create type public.contract_status as enum (
  'proiect',       -- neînregistrat încă în REVISAL
  'activ',
  'suspendat',
  'incetat',
  'anulat'
);

create type public.exemption_type as enum (
  'it',                 -- creare programe pentru calculator
  'constructii',
  'agricultura',
  'industrie_alimentara',
  'persoana_handicap',
  'cercetare_dezvoltare'
);

create type public.salary_component_kind as enum (
  'spor_procent',       -- procent din salariul de bază
  'spor_suma',          -- sumă fixă lunară
  'indemnizatie',
  'prima_recurenta',
  'beneficiu_natura'
);

create type public.revisal_event_type as enum (
  'angajare',
  'modificare_salariu',
  'modificare_functie',
  'modificare_norma',
  'modificare_durata',
  'suspendare',
  'reluare_activitate',
  'detasare',
  'incetare',
  'corectie'
);

create type public.revisal_status as enum (
  'de_pregatit',
  'pregatit',
  'transmis',
  'confirmat',
  'respins',
  'anulat'
);

-- ============================================================
-- 2. DEPARTAMENTE (ierarhie materializată)
-- ============================================================

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  parent_id uuid references public.departments (id) on delete restrict,
  -- path = lanțul de la rădăcină până la nod INCLUSIV; menținut de trigger.
  -- Evită CTE recursiv la fiecare interogare de subarbore.
  path uuid[] not null default '{}',
  depth int not null default 0,
  cod text not null,
  denumire text not null,
  descriere text,
  manager_employee_id uuid,  -- FK adăugat după crearea employees (dependență circulară)
  cost_center text,
  activ boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint departments_cod_len check (char_length(cod) between 1 and 32),
  constraint departments_denumire_len check (char_length(denumire) between 2 and 160),
  constraint departments_depth_max check (depth <= 12),
  constraint departments_parent_diferit check (parent_id is null or parent_id <> id)
);

create unique index departments_org_cod_uniq
  on public.departments (organization_id, lower(cod))
  where deleted_at is null;
create index departments_org_parent_idx on public.departments (organization_id, parent_id);
create index departments_path_gin on public.departments using gin (path);

-- ============================================================
-- 3. FUNCȚII (nomenclator)
-- ============================================================

create table public.job_positions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  cod text not null,
  denumire text not null,
  cod_cor text,                       -- 6 cifre; opțional la creare, obligatoriu pentru REVISAL
  nivel_studii text,
  descriere text,
  activ boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint job_positions_denumire_len check (char_length(denumire) between 2 and 160),
  constraint job_positions_cod_cor_format check (cod_cor is null or cod_cor ~ '^[0-9]{6}$')
);

create unique index job_positions_org_cod_uniq
  on public.job_positions (organization_id, lower(cod))
  where deleted_at is null;
create index job_positions_org_activ_idx on public.job_positions (organization_id, activ);

-- ============================================================
-- 4. ANGAJAȚI
-- ============================================================

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  marca text not null,
  first_name text not null,
  last_name text not null,
  full_name text generated always as (last_name || ' ' || first_name) stored,
  email_personal text,
  telefon text,
  adresa_strada text,
  adresa_oras text,
  adresa_judet text,
  adresa_cod_postal text,
  adresa_tara text not null default 'RO',
  data_nasterii date,
  gen public.gen not null default 'nedeclarat',
  cetatenie text not null default 'RO',
  tip_act_identitate text,            -- CI, CIP, pașaport, permis ședere
  serie_act text,
  numar_act text,
  act_eliberat_de text,
  act_valabil_pana date,
  department_id uuid references public.departments (id) on delete set null,
  job_position_id uuid references public.job_positions (id) on delete set null,
  manager_employee_id uuid references public.employees (id) on delete set null,
  -- manager_path = lanțul de manageri de la vârf până la angajat INCLUSIV.
  -- Susține scope = 'team' fără recursie: manager_path @> array[<id manager>].
  manager_path uuid[] not null default '{}',
  hired_on date,
  terminated_on date,
  conditii_munca public.conditii_munca not null default 'normale',
  grad_handicap text,                 -- null = fără; 'accentuat' / 'grav' → deducere majorată
  nr_persoane_intretinere smallint not null default 0,
  optiune_pilon_ii boolean not null default true,
  status public.employee_status not null default 'candidat',
  user_id uuid references auth.users (id) on delete set null,
  -- CUMUL DE FUNCȚII: aceeași persoană poate avea două fișe active la aceeași firmă
  -- (ex. normă întreagă + contract part-time pe altă funcție). De aceea NU punem
  -- UNIQUE(organization_id, user_id): ar bloca a doua fișă. Marcăm o singură fișă ca
  -- `is_primary` — cea la care se leagă contul din portal, notificările și profilul.
  is_primary boolean not null default true,
  contact_urgenta_nume text,
  contact_urgenta_telefon text,
  contact_urgenta_relatie text,
  observatii text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint employees_marca_len check (char_length(marca) between 1 and 32),
  constraint employees_nume_len check (
    char_length(first_name) between 1 and 80 and char_length(last_name) between 1 and 80
  ),
  constraint employees_email_format check (email_personal is null or email_personal ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint employees_cetatenie_format check (cetatenie ~ '^[A-Z]{2}$'),
  constraint employees_intretinere check (nr_persoane_intretinere between 0 and 20),
  constraint employees_manager_diferit check (manager_employee_id is null or manager_employee_id <> id),
  constraint employees_terminare check (terminated_on is null or hired_on is null or terminated_on >= hired_on)
);

-- Marca e unică per organizație (fișa de personal), nu per contract.
create unique index employees_org_marca_uniq
  on public.employees (organization_id, lower(marca))
  where deleted_at is null;

-- O singură fișă principală per cont de utilizator; a doua fișă (cumul) are is_primary = false.
create unique index employees_org_user_primary_uniq
  on public.employees (organization_id, user_id)
  where is_primary and user_id is not null and deleted_at is null;

create index employees_org_status_idx on public.employees (organization_id, status) where deleted_at is null;
create index employees_org_department_idx on public.employees (organization_id, department_id);
create index employees_org_manager_idx on public.employees (organization_id, manager_employee_id);
create index employees_manager_path_gin on public.employees using gin (manager_path);
create index employees_org_user_idx on public.employees (organization_id, user_id) where user_id is not null;
create index employees_full_name_trgm on public.employees using gin (full_name extensions.gin_trgm_ops);

alter table public.departments
  add constraint departments_manager_fk
  foreign key (manager_employee_id) references public.employees (id) on delete set null;

-- ============================================================
-- 5. DATE SENSIBILE (CNP / IBAN criptate AES-256-GCM)
-- ============================================================

create table public.employee_sensitive_data (
  employee_id uuid primary key references public.employees (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  cnp_ciphertext bytea,
  cnp_iv bytea,
  cnp_tag bytea,
  cnp_key_version int,
  cnp_last4 text,
  cnp_hash text,                      -- HMAC-SHA256 cu cheie separată; doar pentru deduplicare
  iban_ciphertext bytea,
  iban_iv bytea,
  iban_tag bytea,
  iban_key_version int,
  iban_last4 text,
  iban_hash text,
  banca text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  -- Cele patru câmpuri criptografice merg împreună sau deloc: fără ele decriptarea e imposibilă.
  constraint sensitive_cnp_complet check (
    (cnp_ciphertext is null and cnp_iv is null and cnp_tag is null and cnp_key_version is null)
    or (cnp_ciphertext is not null and cnp_iv is not null and cnp_tag is not null and cnp_key_version is not null)
  ),
  constraint sensitive_iban_complet check (
    (iban_ciphertext is null and iban_iv is null and iban_tag is null and iban_key_version is null)
    or (iban_ciphertext is not null and iban_iv is not null and iban_tag is not null and iban_key_version is not null)
  ),
  constraint sensitive_cnp_iv_len check (cnp_iv is null or octet_length(cnp_iv) = 12),
  constraint sensitive_cnp_tag_len check (cnp_tag is null or octet_length(cnp_tag) = 16),
  constraint sensitive_iban_iv_len check (iban_iv is null or octet_length(iban_iv) = 12),
  constraint sensitive_iban_tag_len check (iban_tag is null or octet_length(iban_tag) = 16),
  constraint sensitive_cnp_last4 check (cnp_last4 is null or cnp_last4 ~ '^[0-9]{4}$')
);

create unique index employee_sensitive_cnp_hash_uniq
  on public.employee_sensitive_data (organization_id, cnp_hash)
  where cnp_hash is not null and deleted_at is null;
create index employee_sensitive_org_idx on public.employee_sensitive_data (organization_id);

-- ============================================================
-- 6. CONTRACTE DE MUNCĂ
-- ============================================================

create table public.employment_contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  parent_contract_id uuid references public.employment_contracts (id) on delete restrict,
  este_act_aditional boolean not null default false,
  numar text not null,
  data_contract date not null,
  valabil_de_la date not null,
  valabil_pana date,
  contract_duration public.contract_duration not null default 'nedeterminat',
  motiv_determinat text,
  norma_ore_saptamana numeric(5,2) not null default 40,
  norma_ore_zi numeric(4,2) not null default 8,
  work_mode public.work_mode not null default 'sediu',
  special_regime public.special_regime,
  loc_telemunca text,
  loc_munca text,
  department_id uuid references public.departments (id) on delete set null,
  job_position_id uuid references public.job_positions (id) on delete set null,
  conditii_munca public.conditii_munca not null default 'normale',
  salariu_baza numeric(14,2) not null,
  moneda text not null default 'RON',
  zile_concediu_anual smallint not null default 21,
  perioada_proba_zile smallint,
  preaviz_zile smallint,
  status public.contract_status not null default 'proiect',
  cod_revisal text,                   -- identificatorul contractului în REVISAL
  fisier_path text,
  motiv_incetare text,
  temei_incetare text,                -- articol din Codul muncii
  incetat_la date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint contracts_numar_len check (char_length(numar) between 1 and 40),
  constraint contracts_valabilitate check (valabil_pana is null or valabil_pana >= valabil_de_la),
  constraint contracts_determinat_are_termen check (
    contract_duration <> 'determinat' or valabil_pana is not null
  ),
  constraint contracts_norma check (norma_ore_saptamana > 0 and norma_ore_saptamana <= 48),
  constraint contracts_norma_zi check (norma_ore_zi > 0 and norma_ore_zi <= 12),
  constraint contracts_salariu check (salariu_baza >= 0),
  constraint contracts_moneda check (moneda ~ '^[A-Z]{3}$'),
  constraint contracts_telemunca_are_loc check (
    work_mode not in ('telemunca', 'domiciliu') or loc_telemunca is not null
  ),
  constraint contracts_act_aditional_are_parinte check (
    este_act_aditional = false or parent_contract_id is not null
  ),
  constraint contracts_parinte_diferit check (parent_contract_id is null or parent_contract_id <> id),
  constraint contracts_concediu check (zile_concediu_anual between 0 and 60)
);

-- Numărul de contract e unic per organizație (nu per angajat): la cumul de funcții
-- aceeași persoană are două contracte cu numere diferite.
create unique index contracts_org_numar_uniq
  on public.employment_contracts (organization_id, lower(numar))
  where deleted_at is null;

-- Un singur contract de bază activ per angajat; actele adiționale nu intră la socoteală.
create unique index contracts_employee_activ_uniq
  on public.employment_contracts (employee_id)
  where status = 'activ' and este_act_aditional = false and deleted_at is null;

create index contracts_org_status_idx on public.employment_contracts (organization_id, status) where deleted_at is null;
create index contracts_employee_idx on public.employment_contracts (employee_id, valabil_de_la desc);
create index contracts_parent_idx on public.employment_contracts (parent_contract_id) where parent_contract_id is not null;

-- ============================================================
-- 7. DOCUMENTE DE ANGAJAT
-- ============================================================

create table public.employee_document_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  -- organization_id NULL = tip de platformă (seed), vizibil tuturor organizațiilor.
  cod text not null,
  denumire text not null,
  cere_valabilitate boolean not null default false,
  confidential_implicit boolean not null default false,
  vizibil_angajatului_implicit boolean not null default true,
  ordine smallint not null default 100,
  activ boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint doc_types_cod_len check (char_length(cod) between 1 and 40)
);

create unique index doc_types_platform_cod_uniq
  on public.employee_document_types (lower(cod))
  where organization_id is null and deleted_at is null;
create unique index doc_types_org_cod_uniq
  on public.employee_document_types (organization_id, lower(cod))
  where organization_id is not null and deleted_at is null;

create table public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  document_type_id uuid not null references public.employee_document_types (id) on delete restrict,
  contract_id uuid references public.employment_contracts (id) on delete set null,
  titlu text not null,
  numar_document text,
  data_document date,
  valabil_de_la date,
  valabil_pana date,
  fisier_path text not null,
  fisier_nume text not null,
  fisier_marime_bytes bigint,
  fisier_mime text,
  fisier_checksum text,
  confidential boolean not null default false,
  vizibil_angajatului boolean not null default true,
  observatii text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint employee_documents_titlu_len check (char_length(titlu) between 2 and 200),
  constraint employee_documents_valabilitate check (valabil_pana is null or valabil_de_la is null or valabil_pana >= valabil_de_la),
  constraint employee_documents_marime check (fisier_marime_bytes is null or fisier_marime_bytes between 0 and 52428800)
);

create index employee_documents_employee_idx on public.employee_documents (employee_id, data_document desc) where deleted_at is null;
create index employee_documents_org_expira_idx on public.employee_documents (organization_id, valabil_pana) where valabil_pana is not null and deleted_at is null;
create index employee_documents_type_idx on public.employee_documents (document_type_id);

-- ============================================================
-- 8. FIȘE DE POST
-- ============================================================

create table public.job_descriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid references public.employees (id) on delete cascade,
  job_position_id uuid references public.job_positions (id) on delete set null,
  contract_id uuid references public.employment_contracts (id) on delete set null,
  versiune smallint not null default 1,
  titlu text not null,
  continut text,
  atributii jsonb not null default '[]'::jsonb,
  competente jsonb not null default '[]'::jsonb,
  subordonare text,
  valabil_de_la date not null,
  valabil_pana date,
  fisier_path text,
  semnat_la timestamptz,
  semnat_de_angajat boolean not null default false,
  semnatura_ip text,
  activ boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint job_descriptions_tinta check (employee_id is not null or job_position_id is not null),
  constraint job_descriptions_versiune check (versiune >= 1),
  constraint job_descriptions_valabilitate check (valabil_pana is null or valabil_pana >= valabil_de_la)
);

create unique index job_descriptions_employee_versiune_uniq
  on public.job_descriptions (employee_id, versiune)
  where employee_id is not null and deleted_at is null;
create index job_descriptions_org_idx on public.job_descriptions (organization_id, activ) where deleted_at is null;

-- ============================================================
-- 9. SCUTIRI FISCALE (temporale)
-- ============================================================

create table public.employee_tax_exemptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  contract_id uuid references public.employment_contracts (id) on delete set null,
  exemption_type public.exemption_type not null,
  valabil_de_la date not null,
  valabil_pana date,
  procent_scutire numeric(5,2),
  plafon_lunar numeric(14,2),
  temei_legal text,
  document_id uuid references public.employee_documents (id) on delete set null,
  observatii text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint exemptions_valabilitate check (valabil_pana is null or valabil_pana >= valabil_de_la),
  constraint exemptions_procent check (procent_scutire is null or (procent_scutire >= 0 and procent_scutire <= 100))
);

-- Fără suprapunere pe același tip de scutire: daterange half-open, 'infinity' pentru „încă activă".
create index exemptions_employee_idx on public.employee_tax_exemptions (employee_id, valabil_de_la desc) where deleted_at is null;
create index exemptions_org_tip_idx on public.employee_tax_exemptions (organization_id, exemption_type) where deleted_at is null;

alter table public.employee_tax_exemptions
  add constraint exemptions_fara_suprapunere
  exclude using gist (
    employee_id with =,
    exemption_type with =,
    daterange(valabil_de_la, coalesce(valabil_pana + 1, 'infinity'::date)) with &&
  ) where (deleted_at is null);

-- ============================================================
-- 10. PERMISE DE MUNCĂ (non-UE)
-- ============================================================

create table public.work_permits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  tip_permis text not null,           -- aviz de angajare, permis unic, detașare
  numar text not null,
  emis_de text,
  emis_la date,
  valabil_de_la date not null,
  valabil_pana date not null,
  numar_pasaport text,
  cetatenie text not null,
  document_id uuid references public.employee_documents (id) on delete set null,
  notificat_la timestamptz,           -- ultima alertă de expirare trimisă
  observatii text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint work_permits_valabilitate check (valabil_pana >= valabil_de_la),
  constraint work_permits_cetatenie_format check (cetatenie ~ '^[A-Z]{2}$')
);

create unique index work_permits_org_numar_uniq
  on public.work_permits (organization_id, lower(numar))
  where deleted_at is null;
create index work_permits_expira_idx on public.work_permits (organization_id, valabil_pana) where deleted_at is null;

-- ============================================================
-- 11. SPORURI PERMANENTE
-- ============================================================

create table public.salary_component_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,  -- NULL = seed platformă
  cod text not null,
  denumire text not null,
  kind public.salary_component_kind not null,
  impozabil boolean not null default true,
  intra_in_baza_cas boolean not null default true,
  intra_in_baza_cass boolean not null default true,
  cod_revisal text,
  ordine smallint not null default 100,
  activ boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint salary_component_types_cod_len check (char_length(cod) between 1 and 40)
);

create unique index salary_component_types_platform_uniq
  on public.salary_component_types (lower(cod))
  where organization_id is null and deleted_at is null;
create unique index salary_component_types_org_uniq
  on public.salary_component_types (organization_id, lower(cod))
  where organization_id is not null and deleted_at is null;

create table public.salary_components (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  contract_id uuid references public.employment_contracts (id) on delete cascade,
  component_type_id uuid not null references public.salary_component_types (id) on delete restrict,
  kind public.salary_component_kind not null,
  procent numeric(6,2),
  suma numeric(14,2),
  moneda text not null default 'RON',
  valabil_de_la date not null,
  valabil_pana date,
  observatii text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint salary_components_valoare check (
    (kind = 'spor_procent' and procent is not null and suma is null)
    or (kind <> 'spor_procent' and suma is not null and procent is null)
  ),
  constraint salary_components_procent check (procent is null or (procent >= 0 and procent <= 300)),
  constraint salary_components_suma check (suma is null or suma >= 0),
  constraint salary_components_valabilitate check (valabil_pana is null or valabil_pana >= valabil_de_la),
  constraint salary_components_moneda check (moneda ~ '^[A-Z]{3}$')
);

create index salary_components_employee_idx on public.salary_components (employee_id, valabil_de_la desc) where deleted_at is null;
create index salary_components_contract_idx on public.salary_components (contract_id) where deleted_at is null;

-- ============================================================
-- 12. ADEVERINȚE (șabloane + documente emise)
-- ============================================================

create table public.hr_document_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,  -- NULL = seed platformă
  cod text not null,
  denumire text not null,
  descriere text,
  continut_html text not null,
  variabile jsonb not null default '[]'::jsonb,
  serie text not null default 'ADEV',
  necesita_aprobare boolean not null default false,
  activ boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint hr_templates_cod_len check (char_length(cod) between 1 and 40)
);

create unique index hr_templates_platform_uniq
  on public.hr_document_templates (lower(cod))
  where organization_id is null and deleted_at is null;
create unique index hr_templates_org_uniq
  on public.hr_document_templates (organization_id, lower(cod))
  where organization_id is not null and deleted_at is null;

create table public.hr_issued_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  template_id uuid references public.hr_document_templates (id) on delete set null,
  employee_id uuid not null references public.employees (id) on delete cascade,
  contract_id uuid references public.employment_contracts (id) on delete set null,
  serie text not null,
  numar bigint not null,               -- alocat prin public.document_sequences
  numar_afisat text not null,          -- ex. „ADEV 2026/000123"
  titlu text not null,
  scop text,                           -- „pentru bancă", „pentru medic de familie"
  emis_la date not null default (now() at time zone 'Europe/Bucharest')::date,
  valabil_pana date,
  date_document jsonb not null default '{}'::jsonb,
  continut_html text,
  fisier_path text,
  continut_checksum text not null,         -- SHA-256 peste conținutul final; dovedește neaterarea
  cod_verificare text,                 -- token public pentru verificarea adeverinței
  emis_de uuid references auth.users (id) on delete set null,
  anulat_la timestamptz,
  motiv_anulare text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint hr_issued_numar check (numar > 0),
  constraint hr_issued_titlu_len check (char_length(titlu) between 2 and 200)
);

create unique index hr_issued_org_serie_numar_uniq
  on public.hr_issued_documents (organization_id, serie, numar);
create unique index hr_issued_cod_verificare_uniq
  on public.hr_issued_documents (cod_verificare)
  where cod_verificare is not null;
create index hr_issued_employee_idx on public.hr_issued_documents (employee_id, emis_la desc) where deleted_at is null;

-- ============================================================
-- 13. REVISAL
-- ============================================================

create table public.revisal_config (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,  -- NULL = valori implicite de platformă
  event_type public.revisal_event_type not null,
  -- Termen legal în zile lucrătoare, raportat la reper. Angajarea: cel târziu în ziua
  -- lucrătoare anterioară începerii activității → termen_zile = -1, reper = 'valabil_de_la'.
  termen_zile smallint not null,
  reper text not null default 'data_eveniment',   -- 'data_eveniment' | 'valabil_de_la' | 'data_contract'
  zile_lucratoare boolean not null default true,
  cod_revisal text,
  descriere text,
  valabil_de_la date not null,
  valabil_pana date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint revisal_config_reper check (reper in ('data_eveniment', 'valabil_de_la', 'data_contract')),
  constraint revisal_config_valabilitate check (valabil_pana is null or valabil_pana >= valabil_de_la),
  constraint revisal_config_termen check (termen_zile between -10 and 90)
);

create unique index revisal_config_platform_uniq
  on public.revisal_config (event_type, valabil_de_la)
  where organization_id is null and deleted_at is null;
create unique index revisal_config_org_uniq
  on public.revisal_config (organization_id, event_type, valabil_de_la)
  where organization_id is not null and deleted_at is null;

create table public.revisal_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  contract_id uuid references public.employment_contracts (id) on delete set null,
  event_type public.revisal_event_type not null,
  data_evenimentului date not null,
  termen_transmitere date not null,       -- calculat de aplicație din revisal_config
  transmis_la timestamptz,
  transmis_de uuid references auth.users (id) on delete set null,
  status public.revisal_status not null default 'de_pregatit',
  payload jsonb not null default '{}'::jsonb,
  export_path text,
  export_checksum text,
  numar_inregistrare text,                -- confirmarea ITM
  eroare text,
  observatii text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint revisal_events_transmis_coerent check (
    (status in ('transmis', 'confirmat') and transmis_la is not null)
    or (status not in ('transmis', 'confirmat') and transmis_la is null)
  ),
  constraint revisal_events_respins_are_motiv check (status <> 'respins' or eroare is not null)
);

create index revisal_events_org_status_idx on public.revisal_events (organization_id, status) where deleted_at is null;
create index revisal_events_termen_idx on public.revisal_events (organization_id, termen_transmitere)
  where status in ('de_pregatit', 'pregatit') and deleted_at is null;
create index revisal_events_employee_idx on public.revisal_events (employee_id, data_evenimentului desc);
create index revisal_events_contract_idx on public.revisal_events (contract_id) where contract_id is not null;

-- ============================================================
-- 14. TRIGGERE
-- ============================================================

-- Ierarhia departamentelor: menține path + depth, blochează ciclurile.
-- SET search_path = '' obligatoriu: pg_temp e căutat înaintea lui public,
-- deci `search_path = public` poate fi deturnat printr-o funcție temporară.
create or replace function public.tg_departments_path()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_path uuid[];
  v_parent_org uuid;
begin
  if new.parent_id is null then
    new.path := array[new.id];
    new.depth := 0;
  else
    select d.path, d.organization_id into v_parent_path, v_parent_org
    from public.departments d
    where d.id = new.parent_id and d.deleted_at is null;

    if v_parent_path is null then
      raise exception 'Departamentul superior nu există sau a fost șters.' using errcode = 'P0001';
    end if;
    if v_parent_org <> new.organization_id then
      raise exception 'Departamentul superior aparține altei organizații.' using errcode = 'P0001';
    end if;
    if new.id = any (v_parent_path) then
      raise exception 'Structura ar deveni circulară: departamentul „%" nu poate fi subordonat propriului subarbore.', new.denumire using errcode = 'P0001';
    end if;
    new.path := v_parent_path || new.id;
    new.depth := array_length(v_parent_path, 1);
  end if;

  if array_length(new.path, 1) > 12 then
    raise exception 'Structura organizatorică depășește 12 niveluri.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger departments_path_biu
  before insert or update of parent_id, organization_id on public.departments
  for each row execute function public.tg_departments_path();

-- Reface path-ul subarborelui după mutarea unui nod.
create or replace function public.tg_departments_path_cascade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.path is distinct from old.path then
    update public.departments d
    set path = new.path || d.path[array_length(old.path, 1) + 1 : array_length(d.path, 1)],
        depth = array_length(new.path, 1) - 1
                + (d.depth - (array_length(old.path, 1) - 1))
    where d.path @> array[old.id] and d.id <> new.id;
  end if;
  return null;
end;
$$;

create trigger departments_path_cascade_aiu
  after update of parent_id on public.departments
  for each row execute function public.tg_departments_path_cascade();

-- Lanțul de manageri: aceeași idee, pentru scope = 'team'.
create or replace function public.tg_employees_manager_path()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mgr_path uuid[];
  v_mgr_org uuid;
begin
  if new.manager_employee_id is null then
    new.manager_path := array[new.id];
  else
    select e.manager_path, e.organization_id into v_mgr_path, v_mgr_org
    from public.employees e
    where e.id = new.manager_employee_id and e.deleted_at is null;

    if v_mgr_path is null then
      raise exception 'Managerul indicat nu există sau fișa lui a fost ștearsă.' using errcode = 'P0001';
    end if;
    if v_mgr_org <> new.organization_id then
      raise exception 'Managerul indicat aparține altei organizații.' using errcode = 'P0001';
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

create trigger employees_manager_path_biu
  before insert or update of manager_employee_id, organization_id on public.employees
  for each row execute function public.tg_employees_manager_path();

create or replace function public.tg_employees_manager_path_cascade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.manager_path is distinct from old.manager_path then
    update public.employees e
    set manager_path = new.manager_path
                       || e.manager_path[array_length(old.manager_path, 1) + 1 : array_length(e.manager_path, 1)]
    where e.manager_path @> array[old.id] and e.id <> new.id;
  end if;
  return null;
end;
$$;

create trigger employees_manager_path_cascade_aiu
  after update of manager_employee_id on public.employees
  for each row execute function public.tg_employees_manager_path_cascade();

-- Validări temporale: CHECK nu poate folosi now() (nu e IMMUTABLE) → trec în trigger.
create or replace function public.tg_employees_validari()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_azi date := (now() at time zone 'Europe/Bucharest')::date;
begin
  if new.data_nasterii is not null then
    if new.data_nasterii > v_azi - interval '15 years' then
      raise exception 'Data nașterii indică o vârstă sub 15 ani — vârsta minimă legală de încadrare.' using errcode = 'P0001';
    end if;
    if new.data_nasterii < v_azi - interval '100 years' then
      raise exception 'Data nașterii nu este plauzibilă.' using errcode = 'P0001';
    end if;
  end if;
  if new.hired_on is not null and new.hired_on > v_azi + interval '1 year' then
    raise exception 'Data angajării nu poate fi la mai mult de un an în viitor.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger employees_validari_biu
  before insert or update of data_nasterii, hired_on on public.employees
  for each row execute function public.tg_employees_validari();

create or replace function public.tg_contracts_validari()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_emp_org uuid;
begin
  select e.organization_id into v_emp_org
  from public.employees e where e.id = new.employee_id and e.deleted_at is null;

  if v_emp_org is null then
    raise exception 'Angajatul indicat nu există.' using errcode = 'P0001';
  end if;
  if v_emp_org <> new.organization_id then
    raise exception 'Contractul și angajatul aparțin unor organizații diferite.' using errcode = 'P0001';
  end if;
  if new.status = 'incetat' and new.incetat_la is null then
    raise exception 'Un contract încetat are nevoie de data încetării.' using errcode = 'P0001';
  end if;
  if new.incetat_la is not null and new.incetat_la < new.valabil_de_la then
    raise exception 'Data încetării nu poate fi anterioară datei de început a contractului.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger contracts_validari_biu
  before insert or update on public.employment_contracts
  for each row execute function public.tg_contracts_validari();

-- updated_at pe toate tabelele noi.
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'departments','job_positions','employees','employee_sensitive_data','employment_contracts',
    'employee_document_types','employee_documents','job_descriptions','employee_tax_exemptions',
    'work_permits','salary_component_types','salary_components','hr_document_templates',
    'hr_issued_documents','revisal_config','revisal_events'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.tg_set_updated_at()',
      t || '_set_updated_at', t
    );
  end loop;
end
$$;

-- ============================================================
-- 15. RLS (politicile detaliate vin în 0005)
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array[
    'departments','job_positions','employees','employee_sensitive_data','employment_contracts',
    'employee_document_types','employee_documents','job_descriptions','employee_tax_exemptions',
    'work_permits','salary_component_types','salary_components','hr_document_templates',
    'hr_issued_documents','revisal_config','revisal_events'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end
$$;

-- ============================================================
-- 16. AUDIT — ALLOW-LIST, fără tabelele cu criptotext
-- ============================================================

-- employee_sensitive_data lipsește INTENȚIONAT: trigger-ul generic ar copia
-- ciphertext/IV/tag în audit_logs, adică ar reface o a doua copie a datelor sensibile.
-- Accesul la CNP/IBAN se auditează explicit, din acțiune, prin writeAuditLog.
-- Mecanismul real din 0002: `internal.attach_audit(nume_tabela)`. Nu există
-- nicio tabelă `audit.allow`.
--
-- Funcția are garda R9 încorporată: refuză cu P0001 orice tabelă care conține
-- coloane potrivindu-se cu tiparele sensibile (%ciphertext%, %_iv, %auth_tag%,
-- %hash%, %token%, %secret%). Deci `employee_sensitive_data` ar fi respinsă
-- automat chiar dacă cineva ar adăuga-o din greșeală în lista de mai jos —
-- protecția e mecanică, nu depinde de ce își amintește autorul migrării.
select internal.attach_audit(t)
from unnest(array[
  'departments', 'job_positions', 'employees', 'employment_contracts',
  'employee_document_types', 'employee_documents', 'job_descriptions',
  'employee_tax_exemptions', 'work_permits', 'salary_component_types',
  'salary_components', 'hr_document_templates', 'hr_issued_documents',
  'revisal_config', 'revisal_events'
]) t;

-- ============================================================
-- 17. SEED DE PLATFORMĂ (organization_id = null)
-- ============================================================

insert into public.employee_document_types (organization_id, cod, denumire, cere_valabilitate, confidential_implicit, vizibil_angajatului_implicit, ordine)
values
  (null, 'ci', 'Carte de identitate', true, true, true, 10),
  (null, 'cim', 'Contract individual de muncă', false, true, true, 20),
  (null, 'act_aditional', 'Act adițional', false, true, true, 30),
  (null, 'fisa_post', 'Fișa postului', false, false, true, 40),
  (null, 'diploma', 'Diplomă de studii', false, false, true, 50),
  (null, 'certificat_medical', 'Fișă de aptitudine medicina muncii', true, true, true, 60),
  (null, 'cazier', 'Cazier judiciar', true, true, false, 70),
  (null, 'permis_munca', 'Permis / aviz de muncă', true, true, true, 80),
  (null, 'decizie', 'Decizie internă', false, false, true, 90),
  (null, 'adeverinta', 'Adeverință', false, false, true, 100),
  (null, 'ssm', 'Fișă instructaj SSM', true, false, true, 110),
  (null, 'altele', 'Alt document', false, false, true, 900)
on conflict do nothing;

insert into public.salary_component_types (organization_id, cod, denumire, kind, impozabil, intra_in_baza_cas, intra_in_baza_cass, ordine)
values
  (null, 'spor_vechime', 'Spor de vechime', 'spor_procent', true, true, true, 10),
  (null, 'spor_conditii', 'Spor condiții deosebite/speciale', 'spor_procent', true, true, true, 20),
  (null, 'spor_noapte', 'Spor de noapte', 'spor_procent', true, true, true, 30),
  (null, 'spor_weekend', 'Spor pentru repaus săptămânal', 'spor_procent', true, true, true, 40),
  (null, 'indemn_conducere', 'Indemnizație de conducere', 'indemnizatie', true, true, true, 50),
  (null, 'prima_lunara', 'Primă lunară', 'prima_recurenta', true, true, true, 60),
  (null, 'abonament_medical', 'Abonament medical', 'beneficiu_natura', false, false, false, 70)
on conflict do nothing;

-- Termene REVISAL (H.G. 905/2017). Angajarea: cel târziu în ziua lucrătoare
-- ANTERIOARĂ începerii activității → termen negativ față de valabil_de_la.
insert into public.revisal_config (organization_id, event_type, termen_zile, reper, zile_lucratoare, cod_revisal, descriere, valabil_de_la)
values
  (null, 'angajare', -1, 'valabil_de_la', true, 'A', 'Cel târziu în ziua lucrătoare anterioară începerii activității', date '2018-01-01'),
  (null, 'modificare_salariu', 20, 'data_eveniment', true, 'MS', 'În termen de 20 de zile lucrătoare de la data producerii modificării', date '2018-01-01'),
  (null, 'modificare_functie', 20, 'data_eveniment', true, 'MF', 'În termen de 20 de zile lucrătoare', date '2018-01-01'),
  (null, 'modificare_norma', 20, 'data_eveniment', true, 'MN', 'În termen de 20 de zile lucrătoare', date '2018-01-01'),
  (null, 'modificare_durata', 20, 'data_eveniment', true, 'MD', 'În termen de 20 de zile lucrătoare', date '2018-01-01'),
  (null, 'suspendare', 20, 'data_eveniment', true, 'S', 'În termen de 20 de zile lucrătoare de la data suspendării', date '2018-01-01'),
  (null, 'reluare_activitate', 20, 'data_eveniment', true, 'RA', 'În termen de 20 de zile lucrătoare de la reluare', date '2018-01-01'),
  (null, 'detasare', 20, 'data_eveniment', true, 'DT', 'În termen de 20 de zile lucrătoare', date '2018-01-01'),
  (null, 'incetare', 0, 'data_eveniment', true, 'I', 'Cel târziu la data încetării contractului', date '2018-01-01'),
  (null, 'corectie', 0, 'data_eveniment', true, 'C', 'Fără termen distinct; se transmite la constatarea erorii', date '2018-01-01')
on conflict do nothing;

insert into public.hr_document_templates (organization_id, cod, denumire, descriere, continut_html, variabile, serie)
values
  (null, 'adeverinta_venit', 'Adeverință de venit',
   'Confirmă calitatea de salariat și venitul brut/net pe ultimele luni.',
   '<h1>ADEVERINȚĂ</h1><p>Prin prezenta se atestă că {{angajat_nume}}, CNP {{cnp_mascat}}, este angajat al {{organizatie_denumire}} din data de {{data_angajarii}}, în funcția de {{functie}}, cu un salariu de bază brut de {{salariu_brut}} lei.</p><p>Prezenta se eliberează pentru {{scop}}.</p>',
   '["angajat_nume","cnp_mascat","organizatie_denumire","data_angajarii","functie","salariu_brut","scop"]'::jsonb,
   'ADEV'),
  (null, 'adeverinta_salariat', 'Adeverință de salariat',
   'Confirmă doar calitatea de salariat, fără venit.',
   '<h1>ADEVERINȚĂ</h1><p>Se adeverește că {{angajat_nume}} are calitatea de salariat al {{organizatie_denumire}}, în funcția de {{functie}}, începând cu {{data_angajarii}}.</p>',
   '["angajat_nume","organizatie_denumire","functie","data_angajarii"]'::jsonb,
   'ADEV'),
  (null, 'adeverinta_vechime', 'Adeverință de vechime în muncă',
   'Atestă perioada lucrată și funcțiile ocupate.',
   '<h1>ADEVERINȚĂ DE VECHIME</h1><p>Se adeverește că {{angajat_nume}} a fost/este salariat al {{organizatie_denumire}} în perioada {{perioada}}, cumulând o vechime de {{vechime}}.</p>',
   '["angajat_nume","organizatie_denumire","perioada","vechime"]'::jsonb,
   'ADEV')
on conflict do nothing;

commit;
