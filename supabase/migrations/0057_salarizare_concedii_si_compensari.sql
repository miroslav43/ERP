-- supabase/migrations/0057_salarizare_concedii_si_compensari.sql
--
-- Locul în care aterizează Fazele 2 și 3: indemnizațiile de concediu (odihnă și
-- medical), orele suplimentare compensate cu timp liber și istoricul de venit
-- anterior punerii în funcțiune a aplicației.
--
-- O SINGURĂ migrare pentru ambele faze, deliberat: toate adaugă coloane pe
-- `payroll_entries`, iar două migrări concurente pe aceeași tabelă ar fi doar
-- un prilej de coliziune.
--
-- 1. PRAGUL ORELOR DE NOAPTE
--
-- Sporul de noapte se acordă doar dacă ziua conține cel puțin un prag de ore
-- lucrate în intervalul nocturn. `attendance_settings` avea `noapte_start` și
-- `noapte_sfarsit`, dar nu și pragul. Intră cu 0 — adică fără prag, deci fără
-- schimbare de comportament — și e ⚠️ DE CONFIRMAT.
--
-- NOTĂ DE STARE: `attendance_settings` are ZERO rânduri în toate organizațiile.
-- Toți parametrii de dreptul muncii de acolo — sporuri, interval nocturn,
-- termene de compensare, repaus minim — sunt neconfigurați, iar salarizarea
-- cade pe cei din `payroll_settings`. Coloana de aici pregătește regula;
-- popularea tabelei rămâne o decizie cu valori confirmate de jurist.
--
-- 2. INDEMNIZAȚIILE, PE COLOANE PROPRII
--
-- Nu se îndeasă în `baza_salariu`: pe stat și pe fluturaș sunt linii distincte,
-- cu temei diferit. Concediul medical se împarte pe plătitori — primele zile
-- calendaristice le suportă firma, restul fondul de sănătate — iar declarația
-- 112 raportează separat cele două părți. O coloană unică le-ar face
-- nedeclarabile.
--
-- 3. ISTORICUL DE VENIT ANTERIOR
--
-- Baza de calcul a concediului medical cere media pe 6 luni, iar indemnizația
-- de odihnă media pe 3. O organizație care intră în aplicație în iunie nu are
-- acele luni nicăieri. Fără tabela asta, primele șase luni de folosire produc
-- indemnizații mai mici decât cele legale — tăcut. `payroll_prior_income` e
-- locul unde se introduc, o singură dată, la punerea în funcțiune.

\set ON_ERROR_STOP on

begin;

-- ============================================================
-- 1. Pragul orelor de noapte
-- ============================================================

alter table public.attendance_settings
  add column if not exists prag_ore_noapte numeric(4, 2) not null default 0;

alter table public.attendance_settings
  add constraint attendance_settings_prag_noapte_ck
  check (prag_ore_noapte >= 0 and prag_ore_noapte <= 12);

comment on column public.attendance_settings.prag_ore_noapte is
  '⚠️ DE VERIFICAT DE JURIST. Minimul de ore lucrate în intervalul nocturn pentru ca ziua să dea drept la spor de noapte. Zero = fără prag.';

-- ============================================================
-- 2. Setări de salarizare pentru indemnizații și compensări
-- ============================================================

alter table public.payroll_settings
  add column if not exists mod_calcul_indemnizatie_co text not null default 'baza',
  add column if not exists luni_medie_indemnizatie_co smallint not null default 3,
  add column if not exists zile_avertizare_termen_compensare smallint not null default 30;

alter table public.payroll_settings
  add constraint payroll_settings_mod_co_ck
  check (mod_calcul_indemnizatie_co in ('baza', 'media_3_luni', 'cea_mai_avantajoasa'));

alter table public.payroll_settings
  add constraint payroll_settings_luni_co_ck
  check (luni_medie_indemnizatie_co between 1 and 12);

alter table public.payroll_settings
  add constraint payroll_settings_avertizare_ck
  check (zile_avertizare_termen_compensare between 0 and 365);

comment on column public.payroll_settings.mod_calcul_indemnizatie_co is
  'Cum se plătește indemnizația de concediu de odihnă. Implicit „baza" — comportamentul de dinainte, ca activarea mediei să fie o decizie explicită. Legea cere varianta mai avantajoasă pentru angajat.';
comment on column public.payroll_settings.zile_avertizare_termen_compensare is
  'Cu câte zile înainte de expirarea termenului de compensare se avertizează. Avertismentul e util ÎNAINTE, nu după.';

-- ============================================================
-- 3. Coloane de rezultat pe payroll_entries
-- ============================================================

alter table public.payroll_entries
  add column if not exists indemnizatie_co           numeric(14, 2) not null default 0,
  add column if not exists indemnizatie_cm_angajator numeric(14, 2) not null default 0,
  add column if not exists indemnizatie_cm_fnuass    numeric(14, 2) not null default 0,
  add column if not exists zile_cm_angajator         numeric(5, 2)  not null default 0,
  add column if not exists zile_cm_fnuass            numeric(5, 2)  not null default 0,
  add column if not exists ore_supl_compensate       numeric(7, 2)  not null default 0,
  add column if not exists baza_zilnica_cm           numeric(14, 2) not null default 0;

comment on column public.payroll_entries.indemnizatie_co is
  'Indemnizația de concediu de odihnă. Linie distinctă pe stat și pe fluturaș, cu temei propriu.';
comment on column public.payroll_entries.indemnizatie_cm_angajator is
  'Partea din indemnizația de concediu medical suportată de firmă (primele zile calendaristice ale codului).';
comment on column public.payroll_entries.indemnizatie_cm_fnuass is
  'Partea recuperabilă de la fondul de sănătate. Se declară separat în D112, deci nu se poate cumula cu partea angajatorului.';
comment on column public.payroll_entries.ore_supl_compensate is
  'Ore suplimentare compensate cu timp liber, deci NEplătite. Ținute ca să se vadă de ce plata e mai mică decât orele pontate.';
comment on column public.payroll_entries.baza_zilnica_cm is
  'Baza zilnică folosită la indemnizația de concediu medical, după plafonare. Se păstrează ca recalculul să poată fi explicat.';

-- ============================================================
-- 4. payroll_prior_income — venitul dinaintea aplicației
-- ============================================================

create table public.payroll_prior_income (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  employee_id      uuid not null references public.employees (id) on delete restrict,
  an               smallint not null check (an between 2000 and 2100),
  luna             smallint not null check (luna between 1 and 12),
  venit_brut       numeric(14, 2) not null default 0,
  drepturi_salariale numeric(14, 2) not null default 0,
  zile_lucrate     numeric(5, 2) not null default 0,
  sursa            text,
  created_at       timestamptz not null default now(),
  created_by       uuid references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  deleted_at       timestamptz,
  constraint ppi_valori_ck check (
    venit_brut >= 0 and drepturi_salariale >= 0 and zile_lucrate >= 0 and zile_lucrate <= 31
  ),
  constraint ppi_sursa_len check (sursa is null or char_length(sursa) <= 200)
);

create unique index payroll_prior_income_uq
  on public.payroll_prior_income (organization_id, employee_id, an, luna)
  where deleted_at is null;
create index payroll_prior_income_angajat_idx
  on public.payroll_prior_income (organization_id, employee_id, an desc, luna desc)
  where deleted_at is null;
create index payroll_prior_income_created_by_idx on public.payroll_prior_income (created_by);
create index payroll_prior_income_updated_by_idx on public.payroll_prior_income (updated_by);

comment on table public.payroll_prior_income is
  'Venitul realizat ÎNAINTE ca organizația să folosească aplicația. Fără el, primele luni produc indemnizații de concediu medical și de odihnă mai mici decât cele legale, fără nicio eroare.';

create trigger payroll_prior_income_set_updated_at
  before update on public.payroll_prior_income
  for each row execute function internal.seteaza_updated_at();

alter table public.payroll_prior_income enable row level security;
alter table public.payroll_prior_income force row level security;

create policy payroll_prior_income_select on public.payroll_prior_income
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.poate_accesa_salariul(organization_id, employee_id, 'read')
  );
create policy payroll_prior_income_insert on public.payroll_prior_income
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'payroll', 'create', 'all')
    and deleted_at is null
  );
create policy payroll_prior_income_update on public.payroll_prior_income
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'payroll', 'update', 'all')
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'payroll', 'update', 'all')
  );

grant select, insert, update on public.payroll_prior_income to authenticated;
revoke delete on public.payroll_prior_income from authenticated;
grant all on public.payroll_prior_income to service_role;

select internal.attach_audit('payroll_prior_income');

commit;
