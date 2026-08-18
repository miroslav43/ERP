```sql
-- supabase/migrations/0009_leave.sql
-- =====================================================================================
-- FAZA 3a — Calendar și concedii
-- Ordinea e deliberată: pontajul CONSUMĂ concediile aprobate, deci concediile vin primele.
--
-- Conține: sărbători legale (multi-an, generate din algoritmul Paștelui ortodox),
-- zile libere proprii organizației, tipuri de concediu configurabile, reguli de drept
-- suplimentar, cereri + zile de cerere, solduri + istoric de acumulare, coduri de
-- indemnizație pentru concediul medical și infrastructura GENERICĂ de aprobări.
--
-- ATENȚIE JURIDICĂ: toate valorile numerice din seed-uri (zile implicite, procente,
-- zile suportate de angajator, plafoane) sunt MARCATE „DE VERIFICAT DE JURIST”.
-- Ele trăiesc în tabele de configurare cu `valabil_de_la`, niciodată hardcodate în cod (S13).
-- =====================================================================================

set search_path = public, extensions;

create extension if not exists btree_gist with schema extensions;

-- =====================================================================================
-- 1. TIPURI ENUMERATE
-- =====================================================================================

create type public.holiday_type as enum ('fix', 'mobil');
create type public.org_holiday_kind as enum ('liber_suplimentar', 'zi_recuperare');
create type public.leave_day_portion as enum ('zi_intreaga', 'prima_jumatate', 'a_doua_jumatate');
create type public.leave_request_status as enum
  ('ciorna', 'trimisa', 'in_aprobare', 'aprobata', 'respinsa', 'anulata', 'intrerupta');
create type public.leave_rounding_mode as enum
  ('fara_rotunjire', 'jumatate_in_sus', 'jumatate_in_jos', 'zi_in_sus', 'zi_in_jos', 'matematic');
create type public.leave_accrual_event as enum
  ('drept_initial', 'acumulare_lunara', 'reportare', 'expirare_reportate', 'consum',
   'restituire', 'ajustare_manuala', 'corectie_incadrare');
create type public.medical_payer as enum ('angajator', 'fnuass', 'mixt');
create type public.approval_step_kind as enum ('manager_direct', 'rol', 'permisiune', 'utilizator');
create type public.approval_task_status as enum
  ('in_asteptare', 'aprobata', 'respinsa', 'delegata', 'expirata', 'anulata');

-- =====================================================================================
-- 2. PAȘTELE ORTODOX — Meeus pe calendarul iulian + conversie la gregorian
-- =====================================================================================
-- Algoritmul Meeus/Jones/Butcher varianta iuliană dă data în calendarul IULIAN.
-- Conversia la gregorian = + (floor(an/100) - floor(an/400) - 2) zile.
-- Verificat: 2024 -> 5 mai, 2025 -> 20 aprilie, 2026 -> 12 aprilie.
-- Funcția e IMMUTABLE: nu citește tabele, nu depinde de now(). Poate fi folosită în seed.

create or replace function internal.paste_ortodox(p_an integer)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  a int; b int; c int; d int; e int;
  v_luna int; v_zi int; v_decalaj int;
begin
  if p_an is null or p_an < 1900 or p_an > 2199 then
    raise exception using errcode = 'P0001',
      message = 'Anul pentru calculul Paștelui ortodox trebuie să fie între 1900 și 2199.';
  end if;
  a := p_an % 4;
  b := p_an % 7;
  c := p_an % 19;
  d := (19 * c + 15) % 30;
  e := (2 * a + 4 * b - d + 34) % 7;
  v_luna := (d + e + 114) / 31;          -- 3 = martie, 4 = aprilie (calendar iulian)
  v_zi   := ((d + e + 114) % 31) + 1;
  v_decalaj := (p_an / 100) - (p_an / 400) - 2;
  return make_date(p_an, v_luna, v_zi) + v_decalaj;
end;
$$;

comment on function internal.paste_ortodox(integer) is
  'Data Paștelui ortodox (gregorian). Meeus iulian + decalaj de calendar. IMMUTABLE.';

-- =====================================================================================
-- 3. public_holidays — sărbători legale naționale (tabelă globală, nu multi-tenant)
-- =====================================================================================

create table public.public_holidays (
  id            uuid primary key default gen_random_uuid(),
  tara          text not null default 'RO',
  an            integer not null,
  data          date not null,
  denumire      text not null,
  tip           public.holiday_type not null,
  temei_legal   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  constraint public_holidays_tara_ck check (char_length(tara) = 2),
  constraint public_holidays_an_ck check (an between 1900 and 2199)
);

create unique index public_holidays_uk
  on public.public_holidays (tara, data, denumire) where deleted_at is null;
create index public_holidays_cautare_idx
  on public.public_holidays (tara, an) where deleted_at is null;

comment on table public.public_holidays is
  'Sărbători legale. Lista s-a MODIFICAT PRIN LEGE: 6 și 7 ianuarie plus 1 iunie au fost '
  'adăugate prin modificarea Codului Muncii din 2016 (aplicabile din 2017), iar Vinerea Mare '
  'din 2018. Seed-ul acoperă 2024-2040, deci integral sub regimul actual — pentru ani '
  'anteriori lui 2018 lista TREBUIE filtrată după data intrării în vigoare. DE VERIFICAT DE JURIST.';

-- SEED 2024–2040, România. Fixe + mobile derivate din internal.paste_ortodox().
insert into public.public_holidays (tara, an, data, denumire, tip, temei_legal)
select 'RO', s.an, z.data, z.denumire, z.tip, 'Codul Muncii, art. 139 (DE VERIFICAT)'
from generate_series(2024, 2040) as s(an)
cross join lateral (values
  (make_date(s.an, 1, 1),   'Anul Nou',                          'fix'::public.holiday_type),
  (make_date(s.an, 1, 2),   'A doua zi de Anul Nou',             'fix'::public.holiday_type),
  (make_date(s.an, 1, 6),   'Bobotează',                         'fix'::public.holiday_type),
  (make_date(s.an, 1, 7),   'Soborul Sfântului Ioan Botezătorul','fix'::public.holiday_type),
  (make_date(s.an, 1, 24),  'Unirea Principatelor Române',       'fix'::public.holiday_type),
  (make_date(s.an, 5, 1),   'Ziua Muncii',                       'fix'::public.holiday_type),
  (make_date(s.an, 6, 1),   'Ziua Copilului',                    'fix'::public.holiday_type),
  (make_date(s.an, 8, 15),  'Adormirea Maicii Domnului',         'fix'::public.holiday_type),
  (make_date(s.an, 11, 30), 'Sfântul Andrei',                    'fix'::public.holiday_type),
  (make_date(s.an, 12, 1),  'Ziua Națională a României',         'fix'::public.holiday_type),
  (make_date(s.an, 12, 25), 'Crăciunul',                         'fix'::public.holiday_type),
  (make_date(s.an, 12, 26), 'A doua zi de Crăciun',              'fix'::public.holiday_type),
  (internal.paste_ortodox(s.an) - 2,  'Vinerea Mare',            'mobil'::public.holiday_type),
  (internal.paste_ortodox(s.an),      'Paștele',                 'mobil'::public.holiday_type),
  (internal.paste_ortodox(s.an) + 1,  'A doua zi de Paște',      'mobil'::public.holiday_type),
  (internal.paste_ortodox(s.an) + 49, 'Rusaliile',               'mobil'::public.holiday_type),
  (internal.paste_ortodox(s.an) + 50, 'A doua zi de Rusalii',    'mobil'::public.holiday_type)
) as z(data, denumire, tip)
on conflict do nothing;

-- =====================================================================================
-- 4. organization_holidays — zile libere proprii, peste cele legale
-- =====================================================================================

create table public.organization_holidays (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  data            date not null,
  denumire        text not null,
  tip             public.org_holiday_kind not null default 'liber_suplimentar',
  observatii      text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  constraint organization_holidays_denumire_ck check (char_length(btrim(denumire)) between 2 and 160)
);

create unique index organization_holidays_uk
  on public.organization_holidays (organization_id, data, denumire) where deleted_at is null;
create index organization_holidays_org_idx on public.organization_holidays (organization_id, data);

-- =====================================================================================
-- 5. leave_types — configurabile per organizație
-- =====================================================================================

create table public.leave_types (
  id                        uuid primary key default gen_random_uuid(),
  organization_id           uuid not null references public.organizations(id) on delete cascade,
  key                       text not null,
  denumire                  text not null,
  zile_implicite            numeric(6,2) not null default 0,
  scade_din_sold            boolean not null default true,
  necesita_document         boolean not null default false,
  se_reporteaza             boolean not null default false,
  termen_reportare          integer,             -- număr de LUNI de la finalul anului de drept
  intrerupe_alte_concedii   boolean not null default false,
  mod_rotunjire_acumulare   public.leave_rounding_mode not null default 'jumatate_in_sus',
  plafon_reportare_zile     numeric(6,2),
  culoare                   text not null default '#64748B',
  activ                     boolean not null default true,
  valabil_de_la             date not null default current_date,
  temei_legal               text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  deleted_at                timestamptz,
  constraint leave_types_key_ck check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  constraint leave_types_culoare_ck check (culoare ~* '^#[0-9a-f]{6}$'),
  constraint leave_types_zile_ck check (zile_implicite >= 0 and zile_implicite <= 1100),
  constraint leave_types_termen_ck check (termen_reportare is null or termen_reportare between 1 and 60),
  constraint leave_types_plafon_ck check (plafon_reportare_zile is null or plafon_reportare_zile >= 0)
);

create unique index leave_types_uk
  on public.leave_types (organization_id, key, valabil_de_la) where deleted_at is null;
create index leave_types_org_idx on public.leave_types (organization_id) where deleted_at is null;

comment on column public.leave_types.termen_reportare is
  'Luni în care zilele reportate mai pot fi efectuate (RO: 18 luni pentru odihnă — DE VERIFICAT DE JURIST).';

-- =====================================================================================
-- 6. leave_entitlement_rules — CO suplimentar pe categorii
-- =====================================================================================

create table public.leave_entitlement_rules (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations(id) on delete cascade,
  leave_type_id      uuid not null references public.leave_types(id) on delete restrict,
  categorie          text not null,
  denumire           text not null,
  zile_suplimentare  numeric(6,2) not null,
  valabil_de_la      date not null default current_date,
  valabil_pana_la    date,
  temei_legal        text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  constraint ler_categorie_ck check (categorie ~ '^[a-z][a-z0-9_]{1,40}$'),
  constraint ler_zile_ck check (zile_suplimentare between 0 and 60),
  constraint ler_interval_ck check (valabil_pana_la is null or valabil_pana_la >= valabil_de_la)
);

create unique index leave_entitlement_rules_uk
  on public.leave_entitlement_rules (organization_id, leave_type_id, categorie, valabil_de_la)
  where deleted_at is null;
create index leave_entitlement_rules_type_idx on public.leave_entitlement_rules (leave_type_id);

-- =====================================================================================
-- 7. medical_leave_codes — coduri de indemnizație CM (național, cu istoric)
-- NU se stochează diagnosticul — art. 9 GDPR, date privind sănătatea.
-- =====================================================================================

create table public.medical_leave_codes (
  id                     uuid primary key default gen_random_uuid(),
  cod                    text not null,
  denumire               text not null,
  procent                numeric(5,2) not null,
  zile_angajator         integer not null default 0,
  platitor               public.medical_payer not null,
  luni_baza_calcul       integer not null default 6,
  plafon_salarii_minime  numeric(6,2),
  valabil_de_la          date not null,
  valabil_pana_la        date,
  temei_legal            text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz,
  constraint mlc_cod_ck check (cod ~ '^[0-9]{2}$'),
  constraint mlc_procent_ck check (procent between 0 and 100),
  constraint mlc_zile_ck check (zile_angajator between 0 and 30),
  constraint mlc_luni_ck check (luni_baza_calcul between 1 and 12),
  constraint mlc_interval_ck check (valabil_pana_la is null or valabil_pana_la >= valabil_de_la)
);

create unique index medical_leave_codes_uk
  on public.medical_leave_codes (cod, valabil_de_la) where deleted_at is null;

comment on table public.medical_leave_codes is
  'Coduri de indemnizație pentru concediul medical. TOATE valorile sunt DE VERIFICAT DE JURIST '
  '(OUG 158/2005 și normele de aplicare se modifică frecvent). Nu conține și nu va conține diagnostic.';

insert into public.medical_leave_codes
  (cod, denumire, procent, zile_angajator, platitor, luni_baza_calcul, plafon_salarii_minime, valabil_de_la, temei_legal)
values
  ('01', 'Boală obișnuită',                        75.00, 5, 'mixt',      6, 12.00, date '2024-01-01', 'OUG 158/2005 (DE VERIFICAT)'),
  ('02', 'Accident în timpul deplasării la lucru', 80.00, 5, 'mixt',      6, 12.00, date '2024-01-01', 'OUG 158/2005 (DE VERIFICAT)'),
  ('03', 'Accident de muncă',                     100.00, 0, 'fnuass',    6, null,  date '2024-01-01', 'Legea 346/2002 (DE VERIFICAT)'),
  ('05', 'Boală profesională',                    100.00, 0, 'fnuass',    6, null,  date '2024-01-01', 'Legea 346/2002 (DE VERIFICAT)'),
  ('06', 'Boală infectocontagioasă',              100.00, 0, 'fnuass',    6, 12.00, date '2024-01-01', 'OUG 158/2005 (DE VERIFICAT)'),
  ('08', 'Boli cardiovasculare',                   75.00, 5, 'mixt',      6, 12.00, date '2024-01-01', 'OUG 158/2005 (DE VERIFICAT)'),
  ('09', 'Neoplazii, SIDA',                       100.00, 0, 'fnuass',    6, null,  date '2024-01-01', 'OUG 158/2005 (DE VERIFICAT)'),
  ('10', 'Tuberculoză',                           100.00, 0, 'fnuass',    6, null,  date '2024-01-01', 'OUG 158/2005 (DE VERIFICAT)'),
  ('11', 'Sarcină și lăuzie',                     100.00, 0, 'fnuass',    6, 12.00, date '2024-01-01', 'OUG 158/2005 (DE VERIFICAT)'),
  ('12', 'Îngrijire copil bolnav sub 7 ani',       85.00, 0, 'fnuass',    6, 12.00, date '2024-01-01', 'OUG 158/2005 (DE VERIFICAT)'),
  ('15', 'Risc maternal',                          75.00, 0, 'fnuass',    6, 12.00, date '2024-01-01', 'OUG 96/2003 (DE VERIFICAT)')
on conflict do nothing;

-- =====================================================================================
-- 8. Infrastructura GENERICĂ de aprobări (refolosită la pontaj, foi de parcurs, diurne)
-- =====================================================================================

create table public.approval_flows (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type     text not null,
  denumire        text not null,
  activ           boolean not null default true,
  valabil_de_la   date not null default current_date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  constraint approval_flows_entity_ck check (entity_type ~ '^[a-z][a-z0-9_]{2,40}$')
);
create unique index approval_flows_uk
  on public.approval_flows (organization_id, entity_type) where deleted_at is null and activ;

create table public.approval_steps (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  flow_id          uuid not null references public.approval_flows(id) on delete cascade,
  ordine           smallint not null,
  tip              public.approval_step_kind not null,
  rol              public.app_role,
  permission_key   text,
  approver_user_id uuid references auth.users(id),
  optional         boolean not null default false,
  sla_ore          integer,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  constraint approval_steps_ordine_ck check (ordine between 1 and 20),
  constraint approval_steps_sla_ck check (sla_ore is null or sla_ore between 1 and 8760),
  constraint approval_steps_tinta_ck check (
    (tip = 'manager_direct' and rol is null and permission_key is null and approver_user_id is null)
    or (tip = 'rol' and rol is not null)
    or (tip = 'permisiune' and permission_key is not null)
    or (tip = 'utilizator' and approver_user_id is not null)
  )
);
create unique index approval_steps_uk on public.approval_steps (flow_id, ordine) where deleted_at is null;
create index approval_steps_flow_idx on public.approval_steps (flow_id);
create index approval_steps_org_idx on public.approval_steps (organization_id);

create table public.approval_tasks (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  flow_id           uuid not null references public.approval_flows(id) on delete cascade,
  step_id           uuid not null references public.approval_steps(id) on delete cascade,
  entity_type       text not null,
  entity_id         uuid not null,
  ordine            smallint not null,
  approver_user_id  uuid references auth.users(id),     -- ANCORA RLS
  approver_employee_id uuid references public.employees(id),
  status            public.approval_task_status not null default 'in_asteptare',
  comentariu        text,
  decis_la          timestamptz,
  termen_la         timestamptz,
  delegat_catre     uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  constraint approval_tasks_decizie_ck check (
    (status = 'in_asteptare' and decis_la is null)
    or (status <> 'in_asteptare')
  )
);
create index approval_tasks_flow_idx on public.approval_tasks (flow_id);
create index approval_tasks_step_idx on public.approval_tasks (step_id);
create index approval_tasks_entitate_idx on public.approval_tasks (organization_id, entity_type, entity_id, ordine);
create index approval_tasks_aprobator_idx
  on public.approval_tasks (approver_user_id, status) where deleted_at is null;

-- =====================================================================================
-- 9. leave_requests / leave_request_days / leave_balances / leave_accruals
-- =====================================================================================

create table public.leave_requests (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references public.organizations(id) on delete cascade,
  employee_id             uuid not null references public.employees(id) on delete restrict,
  leave_type_id           uuid not null references public.leave_types(id) on delete restrict,
  data_inceput            date not null,
  data_sfarsit            date not null,
  portiune_inceput        public.leave_day_portion not null default 'zi_intreaga',
  portiune_sfarsit        public.leave_day_portion not null default 'zi_intreaga',
  zile_lucratoare         numeric(6,2) not null default 0,
  zile_calendaristice     integer not null default 0,
  motiv                   text,
  atasament_path          text,
  status                  public.leave_request_status not null default 'ciorna',
  intrerupe_alte_concedii boolean not null default false,   -- denormalizat din leave_types (necesar în EXCLUDE)
  -- concediu medical: FĂRĂ diagnostic (art. 9 GDPR)
  medical_code_id         uuid references public.medical_leave_codes(id) on delete restrict,
  serie_certificat        text,
  numar_certificat        text,
  -- lanț de aprobare
  flow_id                 uuid references public.approval_flows(id) on delete set null,
  pas_curent              smallint not null default 0,
  trimisa_la              timestamptz,
  decis_la                timestamptz,
  decis_de                uuid references auth.users(id),
  motiv_respingere        text,
  created_by              uuid references auth.users(id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz,
  constraint leave_requests_interval_ck check (data_sfarsit >= data_inceput),
  constraint leave_requests_zile_ck check (zile_lucratoare >= 0 and zile_calendaristice >= 0),
  constraint leave_requests_motiv_ck check (motiv is null or char_length(motiv) <= 1000),
  constraint leave_requests_respingere_ck check (
    status <> 'respinsa' or char_length(coalesce(btrim(motiv_respingere), '')) >= 5
  ),
  constraint leave_requests_certificat_ck check (
    (medical_code_id is null and serie_certificat is null and numar_certificat is null)
    or (medical_code_id is not null and numar_certificat is not null)
  )
);

create index leave_requests_org_idx on public.leave_requests (organization_id, status) where deleted_at is null;
create index leave_requests_angajat_idx on public.leave_requests (employee_id, data_inceput desc) where deleted_at is null;
create index leave_requests_tip_idx on public.leave_requests (leave_type_id);
create index leave_requests_flow_idx on public.leave_requests (flow_id);
create index leave_requests_perioada_idx on public.leave_requests (organization_id, data_inceput, data_sfarsit);

-- Suprapuneri: un angajat nu poate avea două cereri active pe aceeași perioadă.
-- Tipurile care ÎNTRERUP alte concedii (medical, maternitate, creștere copil) sunt SCOASE
-- din predicat: un CM peste un CO aprobat nu e o eroare de validare, ci întrerupe CO-ul.
alter table public.leave_requests
  add constraint leave_requests_fara_suprapunere
  exclude using gist (
    employee_id with =,
    daterange(data_inceput, data_sfarsit, '[]') with &&
  ) where (
    deleted_at is null
    and not intrerupe_alte_concedii
    and status in ('trimisa', 'in_aprobare', 'aprobata')
  );

create table public.leave_request_days (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  leave_request_id uuid not null references public.leave_requests(id) on delete cascade,
  data             date not null,
  portiune         public.leave_day_portion not null default 'zi_intreaga',
  este_lucratoare  boolean not null default true,
  status           public.leave_request_status not null default 'ciorna',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
-- INDEX PE FK: obligatoriu pentru orice FK cu ON DELETE CASCADE.
create index leave_request_days_cerere_idx on public.leave_request_days (leave_request_id);
create unique index leave_request_days_uk on public.leave_request_days (leave_request_id, data);
create index leave_request_days_calendar_idx
  on public.leave_request_days (organization_id, data) where este_lucratoare;

create table public.leave_balances (
  id                        uuid primary key default gen_random_uuid(),
  organization_id           uuid not null references public.organizations(id) on delete cascade,
  employee_id               uuid not null references public.employees(id) on delete cascade,
  leave_type_id             uuid not null references public.leave_types(id) on delete restrict,
  an                        integer not null,
  drept_anual               numeric(6,2) not null default 0,
  reportate                 numeric(6,2) not null default 0,
  termen_folosire_reportate date,
  folosite                  numeric(6,2) not null default 0,
  in_asteptare              numeric(6,2) not null default 0,
  ramase                    numeric(6,2)
    generated always as (drept_anual + reportate - folosite - in_asteptare) stored,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  deleted_at                timestamptz,
  constraint leave_balances_an_ck check (an between 2000 and 2199),
  constraint leave_balances_pozitiv_ck check (
    drept_anual >= 0 and reportate >= 0 and folosite >= 0 and in_asteptare >= 0
  )
);
create unique index leave_balances_uk
  on public.leave_balances (organization_id, employee_id, leave_type_id, an) where deleted_at is null;
create index leave_balances_angajat_idx on public.leave_balances (employee_id, an);
create index leave_balances_tip_idx on public.leave_balances (leave_type_id);

create table public.leave_accruals (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  employee_id      uuid not null references public.employees(id) on delete cascade,
  leave_type_id    uuid not null references public.leave_types(id) on delete restrict,
  an               integer not null,
  eveniment        public.leave_accrual_event not null,
  delta            numeric(6,2) not null,
  sold_dupa        numeric(6,2),
  motiv            text not null,
  data_eveniment   date not null default current_date,
  leave_request_id uuid references public.leave_requests(id) on delete set null,
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now()
);
create index leave_accruals_angajat_idx on public.leave_accruals (employee_id, an, created_at desc);
create index leave_accruals_org_idx on public.leave_accruals (organization_id, an);
create index leave_accruals_tip_idx on public.leave_accruals (leave_type_id);
create index leave_accruals_cerere_idx on public.leave_accruals (leave_request_id);

comment on table public.leave_accruals is
  'Istoric auditabil al soldului: de ce soldul este X. Nu se șterge și nu se modifică (append-only).';

-- =====================================================================================
-- 10. FUNCȚII DE CALENDAR ȘI SOLD
-- =====================================================================================

create or replace function app.este_zi_lucratoare(p_organization_id uuid, p_data date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.organization_holidays oh
      where oh.organization_id = p_organization_id and oh.data = p_data
        and oh.tip = 'zi_recuperare' and oh.deleted_at is null
    ) then true
    when extract(isodow from p_data) in (6, 7) then false
    when exists (
      select 1 from public.public_holidays ph
      where ph.tara = 'RO' and ph.data = p_data and ph.deleted_at is null
    ) then false
    when exists (
      select 1 from public.organization_holidays oh
      where oh.organization_id = p_organization_id and oh.data = p_data
        and oh.tip = 'liber_suplimentar' and oh.deleted_at is null
    ) then false
    else true
  end;
$$;

create or replace function app.numara_zile_lucratoare(
  p_organization_id uuid, p_inceput date, p_sfarsit date,
  p_portiune_inceput public.leave_day_portion default 'zi_intreaga',
  p_portiune_sfarsit public.leave_day_portion default 'zi_intreaga'
) returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(
    case when app.este_zi_lucratoare(p_organization_id, z::date) then
      case
        when z::date = p_inceput and p_portiune_inceput <> 'zi_intreaga' then 0.5
        when z::date = p_sfarsit and p_portiune_sfarsit <> 'zi_intreaga' then 0.5
        else 1
      end
    else 0 end
  ), 0)::numeric(6,2)
  from generate_series(p_inceput, p_sfarsit, interval '1 day') as z;
$$;

create or replace function internal.asigura_sold(
  p_org uuid, p_employee uuid, p_type uuid, p_an integer
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  select id into v_id from public.leave_balances
   where organization_id = p_org and employee_id = p_employee
     and leave_type_id = p_type and an = p_an and deleted_at is null;
  if v_id is not null then return v_id; end if;

  insert into public.leave_balances (organization_id, employee_id, leave_type_id, an, drept_anual)
  select p_org, p_employee, p_type, p_an, lt.zile_implicite
    from public.leave_types lt where lt.id = p_type
  returning id into v_id;

  insert into public.leave_accruals
    (organization_id, employee_id, leave_type_id, an, eveniment, delta, motiv)
  select p_org, p_employee, p_type, p_an, 'drept_initial', lt.zile_implicite,
         'Drept anual inițial din configurarea tipului de concediu.'
    from public.leave_types lt where lt.id = p_type;
  return v_id;
end;
$$;

create or replace function internal.recalc_sold(
  p_org uuid, p_employee uuid, p_type uuid, p_an integer, p_cerere uuid default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_folosite numeric(6,2); v_asteptare numeric(6,2); v_vechi numeric(6,2); v_id uuid;
begin
  v_id := internal.asigura_sold(p_org, p_employee, p_type, p_an);

  select coalesce(sum(case when d.portiune = 'zi_intreaga' then 1 else 0.5 end), 0)
    into v_folosite
    from public.leave_request_days d
    join public.leave_requests r on r.id = d.leave_request_id
   where r.organization_id = p_org and r.employee_id = p_employee
     and r.leave_type_id = p_type and r.deleted_at is null
     and d.este_lucratoare and d.status = 'aprobata'
     and extract(year from d.data)::int = p_an;

  select coalesce(sum(case when d.portiune = 'zi_intreaga' then 1 else 0.5 end), 0)
    into v_asteptare
    from public.leave_request_days d
    join public.leave_requests r on r.id = d.leave_request_id
   where r.organization_id = p_org and r.employee_id = p_employee
     and r.leave_type_id = p_type and r.deleted_at is null
     and d.este_lucratoare and d.status in ('trimisa', 'in_aprobare')
     and extract(year from d.data)::int = p_an;

  select folosite into v_vechi from public.leave_balances where id = v_id;

  update public.leave_balances
     set folosite = v_folosite, in_asteptare = v_asteptare, updated_at = now()
   where id = v_id;

  if v_folosite <> v_vechi then
    insert into public.leave_accruals
      (organization_id, employee_id, leave_type_id, an, eveniment, delta, sold_dupa, motiv, leave_request_id)
    select p_org, p_employee, p_type, p_an,
           case when v_folosite > v_vechi then 'consum' else 'restituire' end,
           (v_vechi - v_folosite),
           b.ramase,
           case when v_folosite > v_vechi
                then 'Zile consumate prin cerere de concediu aprobată.'
                else 'Zile restituite (cerere anulată sau concediu întrerupt).' end,
           p_cerere
      from public.leave_balances b where b.id = v_id;
  end if;
end;
$$;

-- =====================================================================================
-- 11. TRIGGERE
-- =====================================================================================

create or replace function internal.leave_touch()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end; $$;

create or replace function internal.leave_requests_pregateste()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_tip public.leave_types%rowtype; v_org uuid;
begin
  select * into v_tip from public.leave_types where id = new.leave_type_id and deleted_at is null;
  if not found then
    raise exception using errcode = 'P0001', message = 'Tipul de concediu selectat nu există sau a fost dezactivat.';
  end if;
  if v_tip.organization_id <> new.organization_id then
    raise exception using errcode = 'P0001', message = 'Tipul de concediu aparține altei organizații.';
  end if;
  select organization_id into v_org from public.employees where id = new.employee_id and deleted_at is null;
  if v_org is null or v_org <> new.organization_id then
    raise exception using errcode = 'P0001', message = 'Angajatul selectat nu aparține organizației curente.';
  end if;
  if v_tip.necesita_document and new.status = 'trimisa'
     and coalesce(btrim(new.atasament_path), '') = '' and new.medical_code_id is null then
    raise exception using errcode = 'P0001',
      message = 'Acest tip de concediu necesită un document justificativ atașat înainte de trimitere.';
  end if;
  if new.data_inceput < (current_date - interval '2 years')::date then
    raise exception using errcode = 'P0001',
      message = 'Perioada solicitată este mai veche de doi ani. Corectați datele cererii.';
  end if;

  new.intrerupe_alte_concedii := v_tip.intrerupe_alte_concedii;
  new.zile_calendaristice := (new.data_sfarsit - new.data_inceput) + 1;
  new.zile_lucratoare := app.numara_zile_lucratoare(
    new.organization_id, new.data_inceput, new.data_sfarsit,
    new.portiune_inceput, new.portiune_sfarsit);

  if new.status = 'trimisa' and (tg_op = 'INSERT' or old.status <> 'trimisa') then
    new.trimisa_la := now();
  end if;
  if new.status in ('aprobata', 'respinsa') and (tg_op = 'INSERT' or old.status <> new.status) then
    new.decis_la := now();
  end if;
  new.updated_at := now();
  return new;
end; $$;

create or replace function internal.leave_requests_sincronizeaza()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  -- regenerează liniile de zi când perioada s-a schimbat
  if tg_op = 'INSERT'
     or old.data_inceput <> new.data_inceput or old.data_sfarsit <> new.data_sfarsit
     or old.portiune_inceput <> new.portiune_inceput or old.portiune_sfarsit <> new.portiune_sfarsit then
    delete from public.leave_request_days where leave_request_id = new.id;
    insert into public.leave_request_days
      (organization_id, leave_request_id, data, portiune, este_lucratoare, status)
    select new.organization_id, new.id, z::date,
      case
        when z::date = new.data_inceput and new.portiune_inceput <> 'zi_intreaga' then new.portiune_inceput
        when z::date = new.data_sfarsit and new.portiune_sfarsit <> 'zi_intreaga' then new.portiune_sfarsit
        else 'zi_intreaga'::public.leave_day_portion
      end,
      app.este_zi_lucratoare(new.organization_id, z::date),
      new.status
    from generate_series(new.data_inceput, new.data_sfarsit, interval '1 day') as z;
  elsif old.status is distinct from new.status then
    update public.leave_request_days
       set status = new.status, updated_at = now()
     where leave_request_id = new.id and status <> 'intrerupta';
  end if;

  -- întreruperea concediilor suprapuse (CM peste CO aprobat)
  if new.intrerupe_alte_concedii and new.status = 'aprobata'
     and (tg_op = 'INSERT' or old.status is distinct from 'aprobata') then
    update public.leave_request_days d
       set status = 'intrerupta', updated_at = now()
      from public.leave_requests r
     where d.leave_request_id = r.id
       and r.employee_id = new.employee_id and r.id <> new.id
       and r.organization_id = new.organization_id
       and r.status = 'aprobata' and r.deleted_at is null
       and d.data between new.data_inceput and new.data_sfarsit
       and d.status = 'aprobata';

    for r in
      select distinct rr.id, rr.leave_type_id, rr.employee_id, rr.organization_id
        from public.leave_requests rr
        join public.leave_request_days dd on dd.leave_request_id = rr.id
       where rr.employee_id = new.employee_id and rr.id <> new.id
         and rr.status = 'aprobata' and rr.deleted_at is null
         and dd.status = 'intrerupta'
    loop
      if not exists (select 1 from public.leave_request_days
                      where leave_request_id = r.id and status = 'aprobata') then
        update public.leave_requests set status = 'intrerupta', updated_at = now() where id = r.id;
      end if;
      perform internal.recalc_sold(r.organization_id, r.employee_id, r.leave_type_id,
                                   extract(year from new.data_inceput)::int, r.id);
    end loop;
  end if;

  -- lanțul de aprobare: la trimitere se generează sarcinile din flux (manager -> HR opțional)
  if new.status = 'trimisa' and (tg_op = 'INSERT' or old.status is distinct from 'trimisa') then
    insert into public.approval_tasks
      (organization_id, flow_id, step_id, entity_type, entity_id, ordine, approver_user_id, termen_la)
    select new.organization_id, f.id, s.id, 'leave_request', new.id, s.ordine, s.approver_user_id,
           case when s.sla_ore is null then null else now() + make_interval(hours => s.sla_ore) end
      from public.approval_flows f
      join public.approval_steps s on s.flow_id = f.id and s.deleted_at is null
     where f.organization_id = new.organization_id and f.entity_type = 'leave_request'
       and f.activ and f.deleted_at is null
       and not exists (select 1 from public.approval_tasks t
                        where t.entity_id = new.id and t.step_id = s.id and t.deleted_at is null);
  end if;

  if tg_op = 'INSERT' or old.status is distinct from new.status
     or old.data_inceput <> new.data_inceput or old.data_sfarsit <> new.data_sfarsit then
    perform internal.recalc_sold(new.organization_id, new.employee_id, new.leave_type_id,
                                 extract(year from new.data_inceput)::int, new.id);
    if extract(year from new.data_sfarsit)::int <> extract(year from new.data_inceput)::int then
      perform internal.recalc_sold(new.organization_id, new.employee_id, new.leave_type_id,
                                   extract(year from new.data_sfarsit)::int, new.id);
    end if;
  end if;
  return null;
end; $$;

create trigger trg_leave_requests_pregateste
  before insert or update on public.leave_requests
  for each row execute function internal.leave_requests_pregateste();

create trigger trg_leave_requests_sincronizeaza
  after insert or update on public.leave_requests
  for each row execute function internal.leave_requests_sincronizeaza();

create trigger trg_public_holidays_touch before update on public.public_holidays
  for each row execute function internal.leave_touch();
create trigger trg_organization_holidays_touch before update on public.organization_holidays
  for each row execute function internal.leave_touch();
create trigger trg_leave_types_touch before update on public.leave_types
  for each row execute function internal.leave_touch();
create trigger trg_leave_entitlement_rules_touch before update on public.leave_entitlement_rules
  for each row execute function internal.leave_touch();
create trigger trg_medical_leave_codes_touch before update on public.medical_leave_codes
  for each row execute function internal.leave_touch();
create trigger trg_approval_flows_touch before update on public.approval_flows
  for each row execute function internal.leave_touch();
create trigger trg_approval_steps_touch before update on public.approval_steps
  for each row execute function internal.leave_touch();
create trigger trg_approval_tasks_touch before update on public.approval_tasks
  for each row execute function internal.leave_touch();
create trigger trg_leave_balances_touch before update on public.leave_balances
  for each row execute function internal.leave_touch();

-- =====================================================================================
-- 12. SEED PER ORGANIZAȚIE — tipuri de concediu + flux de aprobare codat
-- TOATE zilele implicite sunt DE VERIFICAT DE JURIST (minim legal vs. CCM vs. regulament intern).
-- =====================================================================================

create or replace function internal.seed_leave_defaults(p_organization_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_flow uuid;
begin
  insert into public.leave_types (organization_id, key, denumire, zile_implicite, scade_din_sold,
    necesita_document, se_reporteaza, termen_reportare, intrerupe_alte_concedii,
    mod_rotunjire_acumulare, plafon_reportare_zile, culoare, temei_legal)
  select p_organization_id, t.key, t.denumire, t.zile, t.scade, t.doc, t.rep, t.termen, t.intrerupe,
         t.rotunjire::public.leave_rounding_mode, t.plafon, t.culoare, t.temei
  from (values
    ('odihna',        'Concediu de odihnă',            20, true,  false, true,  18,   false, 'jumatate_in_sus', 20, '#2563EB', 'Codul Muncii art. 145 (DE VERIFICAT)'),
    ('medical',       'Concediu medical',             183, false, true,  false, null, true,  'fara_rotunjire', null, '#DC2626', 'OUG 158/2005 (DE VERIFICAT)'),
    ('maternitate',   'Concediu de maternitate',      126, false, true,  false, null, true,  'fara_rotunjire', null, '#DB2777', 'OUG 158/2005 (DE VERIFICAT)'),
    ('paternal',      'Concediu paternal',             10, false, true,  false, null, false, 'fara_rotunjire', null, '#0891B2', 'Legea 210/1999 (DE VERIFICAT)'),
    ('crestere_copil','Concediu creștere copil',      730, false, true,  false, null, true,  'fara_rotunjire', null, '#7C3AED', 'OUG 111/2010 (DE VERIFICAT)'),
    ('casatorie',     'Concediu pentru căsătorie',      5, false, true,  false, null, false, 'fara_rotunjire', null, '#F59E0B', 'CCM / regulament intern (DE VERIFICAT)'),
    ('nastere_copil', 'Concediu la nașterea copilului', 5, false, true,  false, null, false, 'fara_rotunjire', null, '#10B981', 'CCM / regulament intern (DE VERIFICAT)'),
    ('deces_ruda',    'Concediu pentru deces în familie', 3, false, true, false, null, false, 'fara_rotunjire', null, '#475569', 'CCM / regulament intern (DE VERIFICAT)'),
    ('donator_sange', 'Zi liberă donator de sânge',     1, false, true,  false, null, false, 'fara_rotunjire', null, '#B91C1C', 'Legea 282/2005 (DE VERIFICAT)'),
    ('ingrijitor',    'Concediu de îngrijitor',         5, false, true,  false, null, false, 'fara_rotunjire', null, '#0D9488', 'Codul Muncii art. 152^1 (DE VERIFICAT)'),
    ('fara_plata',    'Concediu fără plată',           90, false, false, false, null, false, 'fara_rotunjire', null, '#94A3B8', 'Regulament intern (DE VERIFICAT)')
  ) as t(key, denumire, zile, scade, doc, rep, termen, intrerupe, rotunjire, plafon, culoare, temei)
  on conflict do nothing;

  insert into public.approval_flows (organization_id, entity_type, denumire)
  values (p_organization_id, 'leave_request', 'Aprobare cerere de concediu')
  on conflict do nothing;

  select id into v_flow from public.approval_flows
   where organization_id = p_organization_id and entity_type = 'leave_request'
     and activ and deleted_at is null;

  if v_flow is not null then
    insert into public.approval_steps (organization_id, flow_id, ordine, tip, permission_key, optional, sla_ore)
    values (p_organization_id, v_flow, 1, 'manager_direct', null, false, 72)
    on conflict do nothing;
    insert into public.approval_steps (organization_id, flow_id, ordine, tip, permission_key, optional, sla_ore)
    values (p_organization_id, v_flow, 2, 'permisiune', 'leave:approve', true, 72)
    on conflict do nothing;
  end if;
end; $$;

create or replace function internal.organizations_seed_leave()
returns trigger language plpgsql security definer set search_path = '' as $$
begin perform internal.seed_leave_defaults(new.id); return null; end; $$;

create trigger trg_organizations_seed_leave
  after insert on public.organizations
  for each row execute function internal.organizations_seed_leave();

do $$
declare o record;
begin
  for o in select id from public.organizations loop
    perform internal.seed_leave_defaults(o.id);
  end loop;
end $$;

-- =====================================================================================
-- 13. RLS — enable + FORCE, politici SELECT/INSERT/UPDATE. Fără politici DELETE (S4, S12).
-- =====================================================================================

alter table public.public_holidays          enable row level security;
alter table public.public_holidays          force row level security;
alter table public.organization_holidays    enable row level security;
alter table public.organization_holidays    force row level security;
alter table public.leave_types              enable row level security;
alter table public.leave_types              force row level security;
alter table public.leave_entitlement_rules  enable row level security;
alter table public.leave_entitlement_rules  force row level security;
alter table public.medical_leave_codes      enable row level security;
alter table public.medical_leave_codes      force row level security;
alter table public.approval_flows           enable row level security;
alter table public.approval_flows           force row level security;
alter table public.approval_steps           enable row level security;
alter table public.approval_steps           force row level security;
alter table public.approval_tasks           enable row level security;
alter table public.approval_tasks           force row level security;
alter table public.leave_requests           enable row level security;
alter table public.leave_requests           force row level security;
alter table public.leave_request_days       enable row level security;
alter table public.leave_request_days       force row level security;
alter table public.leave_balances           enable row level security;
alter table public.leave_balances           force row level security;
alter table public.leave_accruals           enable row level security;
alter table public.leave_accruals           force row level security;

-- --- Tabele naționale: citire pentru toți autentificații, scriere doar platform admin ---
create policy public_holidays_select on public.public_holidays for select to authenticated
  using (deleted_at is null or app.is_platform_admin());
create policy public_holidays_insert on public.public_holidays for insert to authenticated
  with check (app.is_platform_admin() and deleted_at is null);
create policy public_holidays_update on public.public_holidays for update to authenticated
  using (app.is_platform_admin()) with check (app.is_platform_admin());

create policy medical_leave_codes_select on public.medical_leave_codes for select to authenticated
  using (deleted_at is null or app.is_platform_admin());
create policy medical_leave_codes_insert on public.medical_leave_codes for insert to authenticated
  with check (app.is_platform_admin() and deleted_at is null);
create policy medical_leave_codes_update on public.medical_leave_codes for update to authenticated
  using (app.is_platform_admin()) with check (app.is_platform_admin());

-- --- organization_holidays ---
create policy organization_holidays_select on public.organization_holidays for select to authenticated
  using (
    app.is_platform_admin()
    or (
      organization_id = any ((select app.current_org_ids())::uuid[])
      and app.feature_on(organization_id, 'leave')
    )
  );
create policy organization_holidays_insert on public.organization_holidays for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'leave')
    and app.has_permission(organization_id, 'leave', 'create')
    and deleted_at is null
  );
create policy organization_holidays_update on public.organization_holidays for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'leave', 'update')
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'leave', 'update')
  );

-- --- leave_types / leave_entitlement_rules / approval_flows / approval_steps ---
create policy leave_types_select on public.leave_types for select to authenticated
  using (
    app.is_platform_admin()
    or (organization_id = any ((select app.current_org_ids())::uuid[])
        and app.feature_on(organization_id, 'leave'))
  );
create policy leave_types_insert on public.leave_types for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'leave', 'create') and deleted_at is null
  );
create policy leave_types_update on public.leave_types for update to authenticated
  using (organization_id = any ((select app.current_org_ids())::uuid[])
         and app.has_permission(organization_id, 'leave', 'update'))
  with check (organization_id = any ((select app.current_org_ids())::uuid[])
         and app.has_permission(organization_id, 'leave', 'update'));

create policy ler_select on public.leave_entitlement_rules for select to authenticated
  using (app.is_platform_admin()
         or (organization_id = any ((select app.current_org_ids())::uuid[])
             and app.has_permission(organization_id, 'leave', 'read')));
create policy ler_insert on public.leave_entitlement_rules for insert to authenticated
  with check (organization_id = any ((select app.current_org_ids())::uuid[])
              and app.has_permission(organization_id, 'leave', 'create') and deleted_at is null);
create policy ler_update on public.leave_entitlement_rules for update to authenticated
  using (organization_id = any ((select app.current_org_ids())::uuid[])
         and app.has_permission(organization_id, 'leave', 'update'))
  with check (organization_id = any ((select app.current_org_ids())::uuid[])
         and app.has_permission(organization_id, 'leave', 'update'));

create policy approval_flows_select on public.approval_flows for select to authenticated
  using (app.is_platform_admin()
         or organization_id = any ((select app.current_org_ids())::uuid[]));
create policy approval_flows_insert on public.approval_flows for insert to authenticated
  with check (organization_id = any ((select app.current_org_ids())::uuid[])
              and app.has_role(organization_id, array['owner','admin']::public.app_role[])
              and deleted_at is null);
create policy approval_flows_update on public.approval_flows for update to authenticated
  using (organization_id = any ((select app.current_org_ids())::uuid[])
         and app.has_role(organization_id, array['owner','admin']::public.app_role[]))
  with check (organization_id = any ((select app.current_org_ids())::uuid[])
         and app.has_role(organization_id, array['owner','admin']::public.app_role[]));

create policy approval_steps_select on public.approval_steps for select to authenticated
  using (app.is_platform_admin()
         or organization_id = any ((select app.current_org_ids())::uuid[]));
create policy approval_steps_insert on public.approval_steps for insert to authenticated
  with check (organization_id = any ((select app.current_org_ids())::uuid[])
              and app.has_role(organization_id, array['owner','admin']::public.app_role[])
              and deleted_at is null);
create policy approval_steps_update on public.approval_steps for update to authenticated
  using (organization_id = any ((select app.current_org_ids())::uuid[])
         and app.has_role(organization_id, array['owner','admin']::public.app_role[]))
  with check (organization_id = any ((select app.current_org_ids())::uuid[])
         and app.has_role(organization_id, array['owner','admin']::public.app_role[]));

-- --- approval_tasks: ANCORA RLS pe approver_user_id ---
create policy approval_tasks_select on public.approval_tasks for select to authenticated
  using (
    app.is_platform_admin()
    or (
      organization_id = any ((select app.current_org_ids())::uuid[])
      and (
        approver_user_id = (select auth.uid())
        or delegat_catre = (select auth.uid())
        or app.has_permission(organization_id, 'leave', 'approve')
      )
    )
  );
create policy approval_tasks_insert on public.approval_tasks for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and status = 'in_asteptare' and decis_la is null and comentariu is null
    and deleted_at is null
  );
create policy approval_tasks_update on public.approval_tasks for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      approver_user_id = (select auth.uid())
      or delegat_catre = (select auth.uid())
      or app.has_permission(organization_id, 'leave', 'approve')
    )
  )
  with check (organization_id = any ((select app.current_org_ids())::uuid[]));

-- --- leave_requests: propriile cereri + subordonații + permisiune explicită ---
create policy leave_requests_select on public.leave_requests for select to authenticated
  using (
    app.is_platform_admin()
    or (
      organization_id = any ((select app.current_org_ids())::uuid[])
      and app.feature_on(organization_id, 'leave')
      and (
        employee_id = app.current_employee_id(organization_id)
        or app.is_manager_of(organization_id, employee_id)
        or app.has_permission(organization_id, 'leave', 'read')
        or exists (
          select 1 from public.approval_tasks t
          where t.entity_type = 'leave_request' and t.entity_id = public.leave_requests.id
            and t.approver_user_id = (select auth.uid()) and t.deleted_at is null
        )
      )
    )
  );
-- S8: la INSERT starea inițială e fixată, valorile calculate sunt zerofiate.
create policy leave_requests_insert on public.leave_requests for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'leave')
    and status in ('ciorna', 'trimisa')
    and zile_lucratoare = 0 and zile_calendaristice = 0
    and pas_curent = 0 and decis_la is null and decis_de is null
    and motiv_respingere is null and deleted_at is null
    and created_by = (select auth.uid())
    and (
      employee_id = app.current_employee_id(organization_id)
      or app.has_permission(organization_id, 'leave', 'create')
    )
  );
create policy leave_requests_update on public.leave_requests for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'leave')
    and (
      (employee_id = app.current_employee_id(organization_id) and status in ('ciorna', 'trimisa'))
      or app.is_manager_of(organization_id, employee_id)
      or app.has_permission(organization_id, 'leave', 'update')
      or app.has_permission(organization_id, 'leave', 'approve')
    )
  )
  with check (organization_id = any ((select app.current_org_ids())::uuid[]));

-- --- leave_request_days: derivate; se scriu doar prin triggerele SECURITY DEFINER ---
create policy leave_request_days_select on public.leave_request_days for select to authenticated
  using (
    app.is_platform_admin()
    or (
      organization_id = any ((select app.current_org_ids())::uuid[])
      and exists (
        select 1 from public.leave_requests r
        where r.id = public.leave_request_days.leave_request_id
          and (
            r.employee_id = app.current_employee_id(r.organization_id)
            or app.is_manager_of(r.organization_id, r.employee_id)
            or app.has_permission(r.organization_id, 'leave', 'read')
          )
      )
    )
  );

-- --- leave_balances / leave_accruals: citire; scrierea e a motorului (trigger definer) ---
create policy leave_balances_select on public.leave_balances for select to authenticated
  using (
    app.is_platform_admin()
    or (
      organization_id = any ((select app.current_org_ids())::uuid[])
      and app.feature_on(organization_id, 'leave')
      and (
        employee_id = app.current_employee_id(organization_id)
        or app.is_manager_of(organization_id, employee_id)
        or app.has_permission(organization_id, 'leave', 'read')
      )
    )
  );
create policy leave_balances_insert on public.leave_balances for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'leave', 'update')
    and folosite = 0 and in_asteptare = 0 and deleted_at is null
  );
create policy leave_balances_update on public.leave_balances for update to authenticated
  using (organization_id = any ((select app.current_org_ids())::uuid[])
         and app.has_permission(organization_id, 'leave', 'update'))
  with check (organization_id = any ((select app.current_org_ids())::uuid[]));

create policy leave_accruals_select on public.leave_accruals for select to authenticated
  using (
    app.is_platform_admin()
    or (
      organization_id = any ((select app.current_org_ids())::uuid[])
      and (
        employee_id = app.current_employee_id(organization_id)
        or app.has_permission(organization_id, 'leave', 'read')
      )
    )
  );
create policy leave_accruals_insert on public.leave_accruals for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'leave', 'update')
    and eveniment = 'ajustare_manuala'
    and created_by = (select auth.uid())
  );

-- =====================================================================================
-- 14. GRANTS — soft delete peste tot, DELETE revocat de la authenticated (S4/S12)
-- =====================================================================================

grant select, insert, update on public.public_holidays, public.organization_holidays,
  public.leave_types, public.leave_entitlement_rules, public.medical_leave_codes,
  public.approval_flows, public.approval_steps, public.approval_tasks,
  public.leave_requests, public.leave_balances, public.leave_accruals to authenticated;
grant select on public.leave_request_days to authenticated;

revoke delete on public.public_holidays, public.organization_holidays, public.leave_types,
  public.leave_entitlement_rules, public.medical_leave_codes, public.approval_flows,
  public.approval_steps, public.approval_tasks, public.leave_requests,
  public.leave_request_days, public.leave_balances, public.leave_accruals from authenticated;
revoke update on public.leave_accruals from authenticated;

grant execute on function internal.paste_ortodox(integer) to authenticated;
grant execute on function app.este_zi_lucratoare(uuid, date) to authenticated;
grant execute on function app.numara_zile_lucratoare(uuid, date, date,
  public.leave_day_portion, public.leave_day_portion) to authenticated;

-- =====================================================================================
-- 15. AUDIT — prin internal.attach_audit (gardă R9). Tabelele derivate rămân neauditate:
--     leave_request_days e proiecție, leave_balances e agregat, leave_accruals E jurnalul.
-- =====================================================================================

select internal.attach_audit('organization_holidays');
select internal.attach_audit('leave_types');
select internal.attach_audit('leave_entitlement_rules');
select internal.attach_audit('medical_leave_codes');
select internal.attach_audit('approval_flows');
select internal.attach_audit('approval_steps');
select internal.attach_audit('approval_tasks');
select internal.attach_audit('leave_requests');

-- =====================================================================================
-- 16. NOTE DE PROIECTARE
-- =====================================================================================
--
-- A. CUM SE CALCULEAZĂ ZILELE LUCRĂTOARE
--    Concediul de odihnă se socotește în ZILE LUCRĂTOARE, nu calendaristice. Motorul
--    parcurge intervalul zi cu zi (generate_series) și pentru fiecare zi întreabă
--    app.este_zi_lucratoare(organizație, dată), care aplică, în ordinea asta:
--      1) o „zi de recuperare" declarată de firmă face ziua lucrătoare chiar dacă e sâmbătă;
--      2) sâmbăta și duminica nu sunt lucrătoare (program standard 5/2 — un program
--         diferit, de tură sau 6 zile, va cere o coloană de tipar de lucru pe angajat);
--      3) sărbătorile legale naționale (public_holidays) nu sunt lucrătoare;
--      4) zilele libere proprii firmei (organization_holidays) nu sunt lucrătoare.
--    Prima și ultima zi pot fi jumătăți de zi (0,5). Rezultatul se materializează în
--    leave_request_days — o linie pe zi — astfel încât calendarul, pontajul și statele
--    de plată citească aceleași rânduri, nu recalculeze fiecare după regula lui.
--    Concediul MEDICAL face excepție: se numără în ZILE CALENDARISTICE (zile_calendaristice),
--    pentru că indemnizația se calculează pe zile de incapacitate, nu pe zile lucrate.
--
-- B. ACUMULAREA LUNARĂ PROPORȚIONALĂ
--    Angajatul intrat în cursul anului nu are dreptul integral, ci proporțional cu
--    perioada lucrată: drept_lunar = drept_anual / 12, iar drept_acumulat = drept_lunar
--    * numărul de luni lucrate în anul respectiv. Aceeași regulă se aplică la ieșire
--    (compensarea în bani a zilelor neefectuate) și la contractele cu timp parțial.
--    Fiecare rulare scrie o linie în leave_accruals (eveniment = 'acumulare_lunara'),
--    deci soldul e explicabil: se poate arăta oricând DE CE soldul este X, nu doar CÂT e.
--    Zilele nefolosite se reportează (se_reporteaza) cu termen (termen_reportare, în luni)
--    și eventual plafon (plafon_reportare_zile); la depășirea termenului motorul scrie
--    'expirare_reportate' cu delta negativă, în loc să șteargă valori în tăcere.
--
-- C. DE CE ROTUNJIREA NU ARE REGULĂ LEGALĂ
--    Codul Muncii stabilește DREPTUL MINIM anual, nu modul în care se rotunjesc fracțiile
--    rezultate din calculul proporțional. Un angajat intrat pe 10 martie cu 21 de zile pe
--    an acumulează 17,5 zile: legea nu spune dacă se dau 17, 17,5 sau 18. Regula vine din
--    contractul colectiv de muncă aplicabil sau, în lipsa lui, din regulamentul intern al
--    angajatorului. De aceea mod_rotunjire_acumulare e o coloană configurabilă pe
--    leave_types, cu implicit 'jumatate_in_sus' (varianta favorabilă salariatului, cea mai
--    des întâlnită în CCM-uri), nu o constantă în cod. Orice valoare implicită din acest
--    fișier este marcată „DE VERIFICAT DE JURIST" și trăiește într-un tabel cu
--    `valabil_de_la`, ca să poată fi schimbată fără migrare când se schimbă legea sau CCM-ul.
--
-- D. SUPRAPUNERI ȘI ÎNTRERUPERE
--    Constrângerea EXCLUDE oprește două cereri active pe aceeași perioadă pentru același
--    angajat — DAR scoate din predicat tipurile cu intrerupe_alte_concedii = true.
--    Un concediu medical peste un concediu de odihnă aprobat nu e o eroare de validare:
--    întrerupe odihna, marchează zilele suprapuse ca 'intrerupta' și, pentru că soldul se
--    recalculează din zilele cu status 'aprobata', restituie automat zilele de odihnă.
```

**De semnalat (nu am putut verifica prin citirea fișierelor — instrucțiunea a fost „nu folosi tool-uri"):**

1. `app.is_manager_of(uuid, uuid)` — am presupus ordinea `(organization_id, employee_id)`, prin analogie cu `app.feature_on(uuid, text)`, `app.has_permission(uuid, text, text)`, `app.current_employee_id(uuid)`, care au organizația pe primul loc. **De confirmat în migrarea 0001/0002.**
2. `app.has_permission(uuid, text, text)` — am presupus `(organization_id, resursa, actiune)`, adică `PermissionKey` spart în două. Dacă semnătura reală primește cheia întreagă (`'leave:read'`), toate apelurile din politici trebuie rescrise.
3. `app.has_role(uuid, app_role[])` — am presupus etichetele `'owner'` și `'admin'` în enumerarea `public.app_role`. `APP_ROLES` din `@/lib/tenant/types` există, dar nu i-am putut citi valorile.
4. Tipul enumerat `public.app_role` — am presupus că se află în schema `public`. Dacă e în `app` sau `internal`, castul din `approval_steps.rol` și din `app.has_role(...)` trebuie calificat corespunzător.
5. **Motorul de expirări nu e conectat.** `leave_balances.termen_folosire_reportate` este o scadență reală (zilele reportate expiră) și ar trebui proiectată în `expirables` cu `entity_type = 'leave_balance'`, `kind = 'reportare'`, plus înregistrarea tipului în `app.poate_vedea_expirabil()`. Nu am scris triggerul pentru că nu am putut citi semnătura reală a `internal.sync_expirable(...)` din `0008_expirables.sql`, iar a o inventa ar fi rupt migrarea. **De adăugat într-o migrare imediat următoare.**
6. `internal.attach_audit('leave_requests')` — tabela conține `serie_certificat` și `numar_certificat`. Niciunul nu se potrivește cu tiparele interzise (`%ciphertext%`, `%_iv`, `%auth_tag%`, `%hash%`, `%token%`, `%secret%`, `%parol%`), deci garda R9 ar trebui să le accepte; dacă tiparul real e mai larg, apelul va eșua zgomotos și trebuie scos.
7. Trigger de `updated_at`: am creat `internal.leave_touch()`. Dacă există deja un helper generic în 0001, apelurile ar trebui redirijate către el.
8. `create extension btree_gist with schema extensions` + `set search_path = public, extensions` la începutul fișierului sunt necesare pentru `gist_uuid_ops` din constrângerea EXCLUDE. De verificat că runner-ul de migrări nu suprascrie `search_path`.
9. Program de lucru: am codat 5 zile/săptămână (luni–vineri). Pentru ture sau săptămână de 6 zile va fi nevoie de un tipar de lucru pe angajat sau pe departament — nu există în inventarul de tabele.
10. Permisiunea `leave:approve` există în vocabular, dar `PERMISSION_KEYS` nu a putut fi citit pentru a confirma că `leave` are toate cele patru acțiuni folosite aici (`read`, `create`, `update`, `approve`).