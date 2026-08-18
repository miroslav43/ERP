-- =====================================================================================
-- 0015_per_diem.sql — Faza 10: diurne și deplasări în interes de serviciu
--
-- Se sprijină pe infrastructura existentă:
--   • aprobări  → approval_flows / approval_steps / approval_tasks (0009), entity_type = 'business_trip'
--   • calendar  → app.este_zi_lucratoare(org, data), public_holidays (0009)
--   • flotă     → public.vehicles (0012) — legătură OPȚIONALĂ, modulul poate fi dezactivat
--   • audit     → internal.set_actor(), internal.attach_audit()
--
-- Nu se creează niciun mecanism propriu de aprobare și nicio constantă legală în cod:
-- baremul pe țări și politica firmei sunt DATE, cu istoric prin valabil_de_la.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- 1. Tipuri
-- -------------------------------------------------------------------------------------
create type public.business_trip_status as enum (
  'ciorna', 'in_aprobare', 'aprobata', 'respinsa', 'anulata', 'incheiata', 'decontata'
);

create type public.business_trip_transport as enum (
  'auto_serviciu', 'auto_personal', 'tren', 'avion', 'autocar', 'naval', 'mixt', 'altul'
);

create type public.trip_expense_type as enum (
  'cazare', 'transport', 'combustibil', 'taxa_drum', 'parcare', 'alta'
);

-- Cui i se atribuie ziua în care se trece frontiera. Niciuna nu este implicită „prin lege”:
-- se alege în politica firmei și se poate schimba, cu istoric.
create type public.per_diem_border_rule as enum (
  'tara_plecare',              -- țara din care se pleacă în intervalul respectiv
  'tara_sosire',               -- țara în care se intră (uzuala în practică)
  'tara_cu_valoare_mai_mare',  -- baremul cel mai mare dintre țările atinse
  'durata_maxima'             -- țara în care s-au petrecut cele mai multe ore
);

-- -------------------------------------------------------------------------------------
-- 2. countries — nomenclator global (NU este multi-tenant)
-- -------------------------------------------------------------------------------------
create table public.countries (
  id uuid primary key default gen_random_uuid(),
  cod_alpha2 char(2) not null,
  cod_alpha3 char(3) not null,
  denumire text not null,
  denumire_oficiala text,
  moneda char(3) not null,
  este_ue boolean not null default false,
  este_see boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  constraint countries_alpha2_ck check (cod_alpha2 ~ '^[A-Z]{2}$'),
  constraint countries_alpha3_ck check (cod_alpha3 ~ '^[A-Z]{3}$'),
  constraint countries_moneda_ck check (moneda ~ '^[A-Z]{3}$'),
  constraint countries_denumire_ck check (length(btrim(denumire)) between 2 and 120)
);

create unique index countries_alpha2_uk on public.countries (cod_alpha2) where deleted_at is null;
create unique index countries_alpha3_uk on public.countries (cod_alpha3) where deleted_at is null;
create index countries_denumire_idx on public.countries (denumire) where deleted_at is null;

-- -------------------------------------------------------------------------------------
-- 3. per_diem_country_rates — baremul pe țări (HG 518/1995 și actualizările ulterioare)
--
--    ⚠ DE VERIFICAT DE JURIST. Valorile de mai jos sunt ORIENTATIVE, puse doar ca să
--    existe date de probă. Baremul real se încarcă din fișier (scripts/import-barem.ts),
--    nu se scrie în migrare și nu se scrie în cod TypeScript.
--    categorie: 'I' = personal cu funcții de conducere / demnitari, 'II' = restul.
-- -------------------------------------------------------------------------------------
create table public.per_diem_country_rates (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete restrict,
  categorie text not null default 'II',
  valoare numeric(14,2) not null,
  moneda char(3) not null,
  valabil_de_la date not null,
  valabil_pana date,
  sursa text not null default 'HG 518/1995',
  de_verificat_de_jurist boolean not null default true,
  observatii text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  constraint per_diem_country_rates_categorie_ck check (categorie in ('I', 'II')),
  constraint per_diem_country_rates_valoare_ck check (valoare > 0),
  constraint per_diem_country_rates_moneda_ck check (moneda ~ '^[A-Z]{3}$'),
  constraint per_diem_country_rates_valabilitate_ck check (valabil_pana is null or valabil_pana >= valabil_de_la)
);

create unique index per_diem_country_rates_uk
  on public.per_diem_country_rates (country_id, categorie, valabil_de_la)
  where deleted_at is null;

create index per_diem_country_rates_cautare_idx
  on public.per_diem_country_rates (country_id, categorie, valabil_de_la desc)
  where deleted_at is null;

comment on table public.per_diem_country_rates is
  'Barem diurnă externă. DE VERIFICAT DE JURIST: valorile inițiale sunt orientative; '
  'baremul oficial se importă din fișier, cu valabil_de_la, fără a modifica istoricul.';

-- -------------------------------------------------------------------------------------
-- 4. per_diem_policies — politica firmei, cu istoric prin valabil_de_la
--    Niciun prag nu are valoare implicită „legală”: toate se configurează explicit.
-- -------------------------------------------------------------------------------------
create table public.per_diem_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  denumire text not null,
  country_id_intern uuid not null references public.countries(id) on delete restrict,
  moneda_interna char(3) not null,
  diurna_interna_zi numeric(14,2) not null,
  diurna_baza_legala_interna numeric(14,2) not null,
  multiplu_plafon_neimpozabil numeric(6,2) not null,
  multiplu_diurna_externa numeric(6,2) not null,
  categorie_barem text not null default 'II',
  prag_ore_minim numeric(5,2) not null,
  prag_ore_zi_intreaga numeric(5,2) not null,
  fractiune_zi_partiala numeric(4,2) not null,
  acorda_diurna_ziua_trecerii boolean not null default true,
  regula_tara_trecere public.per_diem_border_rule not null default 'tara_sosire',
  tarif_km_auto_personal numeric(14,2) not null,
  moneda_tarif_km char(3) not null,
  plafon_salarii_baza_luna numeric(6,2) not null,
  valabil_de_la date not null,
  valabil_pana date,
  observatii text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  constraint per_diem_policies_categorie_ck check (categorie_barem in ('I', 'II')),
  constraint per_diem_policies_praguri_ck check (
    prag_ore_minim > 0
    and prag_ore_minim <= prag_ore_zi_intreaga
    and prag_ore_zi_intreaga <= 24
  ),
  constraint per_diem_policies_fractiune_ck check (fractiune_zi_partiala >= 0 and fractiune_zi_partiala <= 1),
  constraint per_diem_policies_sume_ck check (
    diurna_interna_zi >= 0
    and diurna_baza_legala_interna >= 0
    and multiplu_plafon_neimpozabil >= 1
    and multiplu_diurna_externa >= 0
    and tarif_km_auto_personal >= 0
    and plafon_salarii_baza_luna > 0
  ),
  constraint per_diem_policies_moneda_ck check (moneda_interna ~ '^[A-Z]{3}$' and moneda_tarif_km ~ '^[A-Z]{3}$'),
  constraint per_diem_policies_valabilitate_ck check (valabil_pana is null or valabil_pana >= valabil_de_la)
);

create unique index per_diem_policies_uk
  on public.per_diem_policies (organization_id, valabil_de_la)
  where deleted_at is null;

create index per_diem_policies_org_idx
  on public.per_diem_policies (organization_id, valabil_de_la desc)
  where deleted_at is null;

-- -------------------------------------------------------------------------------------
-- 5. business_trips — deplasarea
-- -------------------------------------------------------------------------------------
create table public.business_trips (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  numar_document text,
  scop text not null,
  country_id uuid references public.countries(id) on delete restrict,
  localitate text,
  plecare_la timestamptz not null,
  sosire_la timestamptz not null,
  plecare_efectiva_la timestamptz,
  sosire_efectiva_la timestamptz,
  mijloc_transport public.business_trip_transport not null,
  vehicle_id uuid,                              -- FK către public.vehicles, atașat condiționat (Faza 12)
  km_parcursi numeric(12,2),
  avans_acordat numeric(14,2) not null default 0,
  moneda_avans char(3),
  curs_diurna numeric(14,6),                    -- curs BNR la data plecării; null = conversia în lei rămâne nedeterminată
  status public.business_trip_status not null default 'ciorna',
  approval_task_id uuid,                        -- FK către public.approval_tasks (0009), atașat condiționat
  -- Detașare transnațională (Directiva 96/71/CE, Legea 16/2017) — câmpurile intră ACUM,
  -- validările de fond și raportarea rămân pentru o fază ulterioară.
  detasare_transnationala boolean not null default false,
  stat_gazda_country_id uuid references public.countries(id) on delete restrict,
  salariu_minim_stat_gazda numeric(14,2),
  moneda_salariu_minim char(3),
  formular_a1_solicitat boolean not null default false,
  formular_a1_numar text,
  formular_a1_valabil_de_la date,
  formular_a1_valabil_pana date,
  declaratie_detasare_numar text,
  observatii text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  constraint business_trips_interval_ck check (sosire_la > plecare_la),
  constraint business_trips_interval_efectiv_ck check (
    sosire_efectiva_la is null or plecare_efectiva_la is null or sosire_efectiva_la > plecare_efectiva_la
  ),
  constraint business_trips_scop_ck check (length(btrim(scop)) between 3 and 500),
  constraint business_trips_sume_ck check (avans_acordat >= 0 and (km_parcursi is null or km_parcursi >= 0)),
  constraint business_trips_curs_ck check (curs_diurna is null or curs_diurna > 0),
  constraint business_trips_avans_moneda_ck check (avans_acordat = 0 or moneda_avans is not null),
  constraint business_trips_vehicul_ck check (vehicle_id is null or mijloc_transport in ('auto_serviciu', 'mixt')),
  constraint business_trips_detasare_ck check (
    detasare_transnationala = false
    or (stat_gazda_country_id is not null and salariu_minim_stat_gazda is not null and moneda_salariu_minim is not null)
  ),
  constraint business_trips_a1_ck check (
    formular_a1_valabil_pana is null
    or formular_a1_valabil_de_la is null
    or formular_a1_valabil_pana >= formular_a1_valabil_de_la
  )
);

create index business_trips_org_angajat_idx on public.business_trips (organization_id, employee_id, plecare_la desc);
create index business_trips_org_status_idx on public.business_trips (organization_id, status) where deleted_at is null;
create index business_trips_org_perioada_idx on public.business_trips (organization_id, plecare_la desc) where deleted_at is null;
create index business_trips_task_idx on public.business_trips (approval_task_id) where approval_task_id is not null;
create unique index business_trips_numar_uk on public.business_trips (organization_id, numar_document)
  where deleted_at is null and numar_document is not null;

-- -------------------------------------------------------------------------------------
-- 6. business_trip_legs — etapele deplasării (multi-țară)
-- -------------------------------------------------------------------------------------
create table public.business_trip_legs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_trip_id uuid not null references public.business_trips(id) on delete cascade,
  ordine integer not null,
  from_country_id uuid not null references public.countries(id) on delete restrict,
  to_country_id uuid not null references public.countries(id) on delete restrict,
  plecare_la timestamptz not null,
  sosire_la timestamptz not null,
  mijloc_transport public.business_trip_transport,
  localitate_sosire text,
  observatii text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  constraint business_trip_legs_interval_ck check (sosire_la >= plecare_la),
  constraint business_trip_legs_ordine_ck check (ordine > 0)
);

create unique index business_trip_legs_ordine_uk
  on public.business_trip_legs (business_trip_id, ordine) where deleted_at is null;
create index business_trip_legs_trip_idx
  on public.business_trip_legs (business_trip_id, sosire_la) where deleted_at is null;

-- -------------------------------------------------------------------------------------
-- 7. trip_expenses — cheltuieli decontabile
-- -------------------------------------------------------------------------------------
create table public.trip_expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_trip_id uuid not null references public.business_trips(id) on delete cascade,
  tip public.trip_expense_type not null,
  descriere text,
  data_cheltuielii date not null,
  suma numeric(14,2) not null,
  moneda char(3) not null,
  curs_valutar numeric(14,6) not null,
  suma_lei numeric(14,2) generated always as (round(suma * curs_valutar, 2)) stored,
  document_tip text,
  document_numar text,
  document_cale text,
  aprobata boolean not null default false,
  aprobata_de uuid,
  aprobata_la timestamptz,
  motiv_respingere text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  constraint trip_expenses_suma_ck check (suma > 0),
  constraint trip_expenses_curs_ck check (curs_valutar > 0),
  constraint trip_expenses_moneda_ck check (moneda ~ '^[A-Z]{3}$'),
  constraint trip_expenses_aprobare_ck check (
    (aprobata = false and aprobata_de is null and aprobata_la is null)
    or (aprobata = true and aprobata_de is not null and aprobata_la is not null)
  )
);

create index trip_expenses_trip_idx on public.trip_expenses (business_trip_id, data_cheltuielii) where deleted_at is null;
create index trip_expenses_org_idx on public.trip_expenses (organization_id, data_cheltuielii desc) where deleted_at is null;

-- -------------------------------------------------------------------------------------
-- 8. per_diem_calculations — rezultatul motorului de calcul (tabelă derivată)
--    Se scrie EXCLUSIV prin app.recalculeaza_diurna(); utilizatorii doar citesc.
-- -------------------------------------------------------------------------------------
create table public.per_diem_calculations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_trip_id uuid not null unique references public.business_trips(id) on delete cascade,
  policy_id uuid not null references public.per_diem_policies(id) on delete restrict,
  calculat_la timestamptz not null default now(),
  zile_total numeric(6,2) not null,
  valoare_lei numeric(14,2),
  plafon_neimpozabil_lei numeric(14,2),
  parte_neimpozabila_lei numeric(14,2),
  parte_impozabila_lei numeric(14,2),
  curs_incomplet boolean not null default false,
  detalii jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index per_diem_calculations_org_idx on public.per_diem_calculations (organization_id, calculat_la desc);

-- -------------------------------------------------------------------------------------
-- 9. Legături condiționate către module care pot lipsi la momentul migrării
-- -------------------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.vehicles') is not null then
    alter table public.business_trips
      add constraint business_trips_vehicle_fk foreign key (vehicle_id)
      references public.vehicles(id) on delete set null;
  else
    raise notice 'public.vehicles nu există încă: FK-ul business_trips.vehicle_id rămâne nedeclarat.';
  end if;

  if to_regclass('public.approval_tasks') is not null then
    alter table public.business_trips
      add constraint business_trips_approval_task_fk foreign key (approval_task_id)
      references public.approval_tasks(id) on delete set null;
  else
    raise notice 'public.approval_tasks nu există: FK-ul business_trips.approval_task_id rămâne nedeclarat.';
  end if;
end $$;

-- =====================================================================================
-- 10. MOTORUL DE CALCUL
-- =====================================================================================

-- Baremul valabil la o dată, pentru o țară și o categorie.
create or replace function app.per_diem_barem(p_country_id uuid, p_categorie text, p_data date)
returns table (valoare numeric, moneda char(3))
language sql
stable
set search_path = ''
as $$
  select r.valoare, r.moneda
  from public.per_diem_country_rates r
  where r.country_id = p_country_id
    and r.categorie = coalesce(p_categorie, 'II')
    and r.deleted_at is null
    and r.valabil_de_la <= p_data
    and (r.valabil_pana is null or r.valabil_pana >= p_data)
  order by r.valabil_de_la desc
  limit 1;
$$;

-- Politica firmei valabilă la o dată.
create or replace function app.per_diem_politica(p_org uuid, p_data date)
returns setof public.per_diem_policies
language sql
stable
set search_path = ''
as $$
  select p.*
  from public.per_diem_policies p
  where p.organization_id = p_org
    and p.deleted_at is null
    and p.valabil_de_la <= p_data
    and (p.valabil_pana is null or p.valabil_pana >= p_data)
  order by p.valabil_de_la desc
  limit 1;
$$;

-- Cronologia „în ce țară se află angajatul” se dă ca listă de repere:
--   [{"de_la": "2026-03-01T06:00:00Z", "country_id": "..."}, ...]
-- Funcția întoarce, pentru un interval dat, orele petrecute în fiecare țară.
create or replace function app.per_diem_ore_pe_tara(
  p_etape jsonb,
  p_plecare timestamptz,
  p_sosire timestamptz,
  p_de_la timestamptz,
  p_pana_la timestamptz,
  p_tara_implicita uuid
)
returns table (country_id uuid, ore numeric, primul_moment timestamptz, ultimul_moment timestamptz)
language sql
immutable
set search_path = ''
as $$
  with puncte as (
    select (e.value ->> 'country_id')::uuid as country_id,
           (e.value ->> 'de_la')::timestamptz as de_la
    from jsonb_array_elements(coalesce(p_etape, '[]'::jsonb)) as e
    where e.value ->> 'country_id' is not null
  ),
  ordonate as (
    select country_id,
           greatest(de_la, p_plecare) as de_la,
           coalesce(lead(de_la) over (order by de_la), p_sosire) as pana_la
    from puncte
  ),
  intervale as (
    select country_id, de_la, pana_la from ordonate where pana_la > de_la
    union all
    select p_tara_implicita, p_plecare, p_sosire where not exists (select 1 from puncte)
  )
  select i.country_id,
         sum(extract(epoch from (least(i.pana_la, p_pana_la) - greatest(i.de_la, p_de_la))) / 3600.0)::numeric,
         min(greatest(i.de_la, p_de_la)),
         max(least(i.pana_la, p_pana_la))
  from intervale i
  where i.country_id is not null
    and least(i.pana_la, p_pana_la) > greatest(i.de_la, p_de_la)
  group by i.country_id;
$$;

-- calculeazaZileDiurna: împarte deplasarea în ferestre de 24 de ore și atribuie
-- fiecărei ferestre o fracțiune de zi (0 / parțial / 1) și O SINGURĂ țară.
-- Toate pragurile sunt parametri; nicio constantă în cod.
create or replace function app.calculeaza_zile_diurna(
  p_plecare timestamptz,
  p_sosire timestamptz,
  p_prag_ore_minim numeric,
  p_prag_ore_zi_intreaga numeric,
  p_fractiune_partiala numeric,
  p_acorda_ziua_trecerii boolean,
  p_regula_trecere public.per_diem_border_rule,
  p_categorie_barem text,
  p_tara_implicita uuid,
  p_etape jsonb default '[]'::jsonb
)
returns table (
  numar_fereastra integer,
  de_la timestamptz,
  pana_la timestamptz,
  tara_id uuid,
  fractiune numeric,
  ore_fereastra numeric,
  motiv text
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_durata numeric;
  v_ferestre_intregi integer;
  v_rest numeric;
  v_total integer;
  v_i integer;
  v_de_la timestamptz;
  v_pana_la timestamptz;
  v_fr numeric;
  v_motiv text;
  v_tara uuid;
  v_nr_tari integer;
begin
  if p_plecare is null or p_sosire is null or p_sosire <= p_plecare then
    return;
  end if;

  v_durata := extract(epoch from (p_sosire - p_plecare)) / 3600.0;

  -- Sub pragul minim nu se acordă nimic: 22:00 → 06:00 (8 ore) înseamnă ZERO zile.
  if v_durata < p_prag_ore_minim then
    return;
  end if;

  v_ferestre_intregi := floor(v_durata / 24.0)::integer;
  v_rest := v_durata - (v_ferestre_intregi * 24.0);
  v_total := v_ferestre_intregi + case when v_rest > 0 then 1 else 0 end;

  for v_i in 1 .. v_total loop
    v_de_la := p_plecare + ((v_i - 1) * interval '24 hours');
    v_pana_la := least(p_plecare + (v_i * interval '24 hours'), p_sosire);

    if v_i <= v_ferestre_intregi then
      v_fr := 1;
      v_motiv := 'fereastră completă de 24 de ore';
    elsif v_rest >= p_prag_ore_zi_intreaga then
      v_fr := 1;
      v_motiv := 'restul depășește pragul pentru zi întreagă';
    elsif v_rest >= p_prag_ore_minim then
      v_fr := coalesce(p_fractiune_partiala, 0);
      v_motiv := 'restul se încadrează între pragul minim și pragul pentru zi întreagă';
    else
      v_fr := 0;
      v_motiv := 'restul este sub pragul minim';
    end if;

    select count(*) into v_nr_tari
    from app.per_diem_ore_pe_tara(p_etape, p_plecare, p_sosire, v_de_la, v_pana_la, p_tara_implicita);

    select o.country_id into v_tara
    from app.per_diem_ore_pe_tara(p_etape, p_plecare, p_sosire, v_de_la, v_pana_la, p_tara_implicita) o
    left join lateral app.per_diem_barem(o.country_id, p_categorie_barem, v_de_la::date) b on true
    order by
      case p_regula_trecere when 'tara_plecare' then o.primul_moment end asc nulls last,
      case p_regula_trecere when 'tara_sosire' then o.ultimul_moment end desc nulls last,
      case p_regula_trecere when 'durata_maxima' then o.ore end desc nulls last,
      case p_regula_trecere when 'tara_cu_valoare_mai_mare' then b.valoare end desc nulls last,
      o.ore desc
    limit 1;

    v_tara := coalesce(v_tara, p_tara_implicita);

    -- Ziua trecerii frontierei se plătește O SINGURĂ dată, unei singure țări.
    if v_nr_tari > 1 then
      if coalesce(p_acorda_ziua_trecerii, true) then
        v_motiv := v_motiv || '; trecere de frontieră — ziua atribuită unei singure țări (' || p_regula_trecere::text || ')';
      else
        v_fr := 0;
        v_motiv := 'trecere de frontieră — politica firmei nu acordă diurnă în această zi';
      end if;
    end if;

    numar_fereastra := v_i;
    de_la := v_de_la;
    pana_la := v_pana_la;
    tara_id := v_tara;
    fractiune := v_fr;
    ore_fereastra := extract(epoch from (v_pana_la - v_de_la)) / 3600.0;
    motiv := v_motiv;
    return next;
  end loop;
end;
$$;

-- Recalculează și persistă rezultatul pentru o deplasare.
create or replace function app.recalculeaza_diurna(p_trip_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip public.business_trips;
  v_pol public.per_diem_policies;
  v_etape jsonb;
  v_rand record;
  v_barem record;
  v_val_zi numeric;
  v_plafon_zi numeric;
  v_moneda char(3);
  v_curs numeric;
  v_zile numeric := 0;
  v_lei numeric := 0;
  v_plafon_lei numeric := 0;
  v_lipsa_curs boolean := false;
  v_detalii jsonb := '[]'::jsonb;
  v_calc_id uuid;
begin
  select * into v_trip from public.business_trips where id = p_trip_id and deleted_at is null;
  if not found then
    raise exception 'Deplasarea nu a fost găsită sau a fost ștearsă.' using errcode = 'P0001';
  end if;

  if not app.poate_accesa_deplasare(v_trip.organization_id, v_trip.employee_id, 'read') then
    raise exception 'Nu aveți dreptul să vedeți sau să recalculați această deplasare.' using errcode = 'P0001';
  end if;

  select * into v_pol from app.per_diem_politica(v_trip.organization_id, v_trip.plecare_la::date);
  if v_pol.id is null then
    raise exception 'Nu există o politică de diurnă valabilă la data plecării. Configurați politica firmei înainte de calcul.'
      using errcode = 'P0001';
  end if;

  with l as (
    select ordine, from_country_id, to_country_id, sosire_la
    from public.business_trip_legs
    where business_trip_id = p_trip_id and deleted_at is null
  ),
  puncte as (
    select v_trip.plecare_la as de_la,
           coalesce((select from_country_id from l order by ordine limit 1),
                    v_trip.country_id,
                    v_pol.country_id_intern) as country_id
    union all
    select sosire_la, to_country_id from l
  )
  select coalesce(jsonb_agg(jsonb_build_object('de_la', de_la, 'country_id', country_id) order by de_la), '[]'::jsonb)
  into v_etape
  from puncte
  where country_id is not null;

  for v_rand in
    select *
    from app.calculeaza_zile_diurna(
      coalesce(v_trip.plecare_efectiva_la, v_trip.plecare_la),
      coalesce(v_trip.sosire_efectiva_la, v_trip.sosire_la),
      v_pol.prag_ore_minim,
      v_pol.prag_ore_zi_intreaga,
      v_pol.fractiune_zi_partiala,
      v_pol.acorda_diurna_ziua_trecerii,
      v_pol.regula_tara_trecere,
      v_pol.categorie_barem,
      coalesce(v_trip.country_id, v_pol.country_id_intern),
      v_etape
    )
  loop
    if v_rand.tara_id is not distinct from v_pol.country_id_intern then
      v_val_zi := v_pol.diurna_interna_zi;
      v_plafon_zi := v_pol.multiplu_plafon_neimpozabil * v_pol.diurna_baza_legala_interna;
      v_moneda := v_pol.moneda_interna;
    else
      select valoare, moneda into v_barem
      from app.per_diem_barem(v_rand.tara_id, v_pol.categorie_barem, v_rand.de_la::date);
      if v_barem.valoare is null then
        raise exception 'Lipsește baremul de diurnă pentru țara aleasă la data de %. Încărcați baremul oficial înainte de calcul.',
          to_char(v_rand.de_la, 'DD.MM.YYYY') using errcode = 'P0001';
      end if;
      v_val_zi := v_barem.valoare * v_pol.multiplu_diurna_externa;
      v_plafon_zi := v_barem.valoare * v_pol.multiplu_plafon_neimpozabil;
      v_moneda := v_barem.moneda;
    end if;

    v_curs := case when v_moneda = v_pol.moneda_interna then 1 else v_trip.curs_diurna end;
    v_zile := v_zile + v_rand.fractiune;

    if v_curs is null then
      v_lipsa_curs := true;
    else
      v_lei := v_lei + round(v_rand.fractiune * v_val_zi * v_curs, 2);
      v_plafon_lei := v_plafon_lei + round(v_rand.fractiune * v_plafon_zi * v_curs, 2);
    end if;

    v_detalii := v_detalii || jsonb_build_object(
      'fereastra', v_rand.numar_fereastra,
      'de_la', v_rand.de_la,
      'pana_la', v_rand.pana_la,
      'country_id', v_rand.tara_id,
      'fractiune', v_rand.fractiune,
      'valoare_zi', v_val_zi,
      'plafon_zi', v_plafon_zi,
      'moneda', v_moneda,
      'curs', v_curs,
      'motiv', v_rand.motiv
    );
  end loop;

  insert into public.per_diem_calculations as c (
    organization_id, business_trip_id, policy_id, calculat_la, zile_total,
    valoare_lei, plafon_neimpozabil_lei, parte_neimpozabila_lei, parte_impozabila_lei,
    curs_incomplet, detalii
  )
  values (
    v_trip.organization_id, v_trip.id, v_pol.id, now(), v_zile,
    case when v_lipsa_curs then null else v_lei end,
    case when v_lipsa_curs then null else v_plafon_lei end,
    case when v_lipsa_curs then null else least(v_lei, v_plafon_lei) end,
    case when v_lipsa_curs then null else greatest(v_lei - v_plafon_lei, 0) end,
    v_lipsa_curs, v_detalii
  )
  on conflict (business_trip_id) do update set
    policy_id = excluded.policy_id,
    calculat_la = excluded.calculat_la,
    zile_total = excluded.zile_total,
    valoare_lei = excluded.valoare_lei,
    plafon_neimpozabil_lei = excluded.plafon_neimpozabil_lei,
    parte_neimpozabila_lei = excluded.parte_neimpozabila_lei,
    parte_impozabila_lei = excluded.parte_impozabila_lei,
    curs_incomplet = excluded.curs_incomplet,
    detalii = excluded.detalii,
    updated_at = now()
  returning c.id into v_calc_id;

  return v_calc_id;
end;
$$;

-- =====================================================================================
-- 11. Vizibilitate — un singur loc, folosit și în politici, și în funcții
-- =====================================================================================
create or replace function app.poate_accesa_deplasare(p_org uuid, p_employee uuid, p_actiune text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select app.is_platform_admin()
      or (
        app.feature_on(p_org, 'per_diem')
        and (
          app.has_permission(p_org, 'per_diem', p_actiune) = 'all'
          or (app.has_permission(p_org, 'per_diem', p_actiune) = 'team'
              and app.is_manager_of(p_org, p_employee))
          or (app.has_permission(p_org, 'per_diem', p_actiune) = 'own'
              and p_employee is not distinct from app.current_employee_id(p_org))
        )
      );
$$;

create or replace function app.deplasare_angajat(p_trip_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.employee_id from public.business_trips t where t.id = p_trip_id;
$$;

create or replace function app.deplasare_editabila(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select t.status in ('ciorna', 'respinsa') from public.business_trips t where t.id = p_trip_id;
$$;

do $$
declare v_f text;
begin
  foreach v_f in array array[
    'app.per_diem_barem(uuid, text, date)',
    'app.per_diem_politica(uuid, date)',
    'app.per_diem_ore_pe_tara(jsonb, timestamptz, timestamptz, timestamptz, timestamptz, uuid)',
    'app.calculeaza_zile_diurna(timestamptz, timestamptz, numeric, numeric, numeric, boolean, public.per_diem_border_rule, text, uuid, jsonb)',
    'app.recalculeaza_diurna(uuid)',
    'app.poate_accesa_deplasare(uuid, uuid, text)',
    'app.deplasare_angajat(uuid)',
    'app.deplasare_editabila(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', v_f);
    execute format('grant execute on function %s to authenticated, service_role', v_f);
  end loop;
end $$;

-- =====================================================================================
-- 12. Triggere de validare (regulile care depind de now() nu pot fi CHECK — S9)
-- =====================================================================================
create or replace function internal.valideaza_deplasare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  select true into v_ok
  from public.employees e
  where e.id = new.employee_id and e.organization_id = new.organization_id and e.deleted_at is null;
  if v_ok is not true then
    raise exception 'Angajatul selectat nu aparține organizației curente.' using errcode = 'P0001';
  end if;

  if new.vehicle_id is not null and to_regclass('public.vehicles') is not null then
    execute 'select true from public.vehicles v where v.id = $1 and v.organization_id = $2'
      into v_ok using new.vehicle_id, new.organization_id;
    if v_ok is not true then
      raise exception 'Vehiculul selectat nu aparține organizației curente.' using errcode = 'P0001';
    end if;
  end if;

  if not exists (select 1 from app.per_diem_politica(new.organization_id, new.plecare_la::date)) then
    raise exception 'Nu există o politică de diurnă valabilă la data plecării. Configurați politica firmei mai întâi.'
      using errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE' then
    if new.organization_id <> old.organization_id then
      raise exception 'Deplasarea nu poate fi mutată în altă organizație.' using errcode = 'P0001';
    end if;
    if new.status <> old.status
       and old.status in ('decontata', 'anulata')
       and new.status <> old.status then
      raise exception 'O deplasare decontată sau anulată nu mai poate schimba starea.' using errcode = 'P0001';
    end if;
    if old.status not in ('ciorna', 'respinsa')
       and new.status = old.status
       and (new.plecare_la, new.sosire_la, new.employee_id) is distinct from (old.plecare_la, old.sosire_la, old.employee_id)
       and not app.poate_accesa_deplasare(new.organization_id, new.employee_id, 'approve') then
      raise exception 'Deplasarea este deja în aprobare; datele de bază pot fi modificate doar de un aprobator.'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_valideaza_deplasare
  before insert or update on public.business_trips
  for each row execute function internal.valideaza_deplasare();

create or replace function internal.valideaza_etapa_deplasare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip public.business_trips;
begin
  select * into v_trip from public.business_trips t where t.id = new.business_trip_id;
  if not found then
    raise exception 'Deplasarea asociată etapei nu există.' using errcode = 'P0001';
  end if;
  if new.organization_id <> v_trip.organization_id then
    raise exception 'Etapa trebuie să aparțină aceleiași organizații ca deplasarea.' using errcode = 'P0001';
  end if;
  if new.plecare_la < v_trip.plecare_la or new.sosire_la > v_trip.sosire_la then
    raise exception 'Etapa trebuie să se încadreze între plecarea și sosirea deplasării.' using errcode = 'P0001';
  end if;
  if new.from_country_id = new.to_country_id then
    raise exception 'O etapă trebuie să lege două țări diferite.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger trg_valideaza_etapa_deplasare
  before insert or update on public.business_trip_legs
  for each row execute function internal.valideaza_etapa_deplasare();

create or replace function internal.valideaza_cheltuiala_deplasare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip public.business_trips;
begin
  select * into v_trip from public.business_trips t where t.id = new.business_trip_id;
  if not found or new.organization_id <> v_trip.organization_id then
    raise exception 'Cheltuiala trebuie să aparțină unei deplasări din organizația curentă.' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE'
     and (new.aprobata, new.aprobata_de, new.aprobata_la) is distinct from (old.aprobata, old.aprobata_de, old.aprobata_la)
     and not app.poate_accesa_deplasare(new.organization_id, v_trip.employee_id, 'approve') then
    raise exception 'Doar un aprobator poate schimba starea de aprobare a cheltuielii.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger trg_valideaza_cheltuiala_deplasare
  before insert or update on public.trip_expenses
  for each row execute function internal.valideaza_cheltuiala_deplasare();

-- =====================================================================================
-- 13. RLS + FORCE + drepturi
-- =====================================================================================
do $$
declare v_t text;
begin
  foreach v_t in array array[
    'countries', 'per_diem_country_rates', 'per_diem_policies',
    'business_trips', 'business_trip_legs', 'trip_expenses'
  ] loop
    execute format('alter table public.%I enable row level security', v_t);
    execute format('alter table public.%I force row level security', v_t);
    execute format('revoke all on public.%I from public, anon', v_t);
    execute format('grant select, insert, update on public.%I to authenticated, service_role', v_t);
    execute format('revoke delete on public.%I from authenticated', v_t);
    execute format(
      'create trigger trg_set_actor before insert or update on public.%I for each row execute function internal.set_actor()',
      v_t);
    perform internal.attach_audit(v_t);
  end loop;
end $$;

alter table public.per_diem_calculations enable row level security;
alter table public.per_diem_calculations force row level security;
revoke all on public.per_diem_calculations from public, anon;
grant select on public.per_diem_calculations to authenticated;
grant select, insert, update on public.per_diem_calculations to service_role;

-- countries + barem: nomenclatoare globale, citite de oricine autentificat,
-- scrise doar de administratorul de platformă.
create policy countries_select on public.countries
  for select to authenticated using (true);
create policy countries_insert on public.countries
  for insert to authenticated with check (app.is_platform_admin() and deleted_at is null);
create policy countries_update on public.countries
  for update to authenticated using (app.is_platform_admin()) with check (app.is_platform_admin());

create policy per_diem_country_rates_select on public.per_diem_country_rates
  for select to authenticated using (true);
create policy per_diem_country_rates_insert on public.per_diem_country_rates
  for insert to authenticated with check (app.is_platform_admin() and deleted_at is null);
create policy per_diem_country_rates_update on public.per_diem_country_rates
  for update to authenticated using (app.is_platform_admin()) with check (app.is_platform_admin());

-- Politica firmei: o citește oricine are dreptul de citire pe modul; o scrie doar cine
-- are drept de modificare la nivel de organizație.
create policy per_diem_policies_select on public.per_diem_policies
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (app.is_platform_admin() or (app.feature_on(organization_id, 'per_diem')
         and app.can(organization_id, 'per_diem', 'read', 'own')))
  );

create policy per_diem_policies_insert on public.per_diem_policies
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'per_diem')
    and app.can(organization_id, 'per_diem', 'update', 'all')
    and deleted_at is null
  );

create policy per_diem_policies_update on public.per_diem_policies
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'per_diem', 'update', 'all')
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'per_diem', 'update', 'all')
  );

-- Deplasări
create policy business_trips_select on public.business_trips
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.poate_accesa_deplasare(organization_id, employee_id, 'read')
  );

create policy business_trips_insert on public.business_trips
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.poate_accesa_deplasare(organization_id, employee_id, 'create')
    and deleted_at is null
    and status = 'ciorna'
    and approval_task_id is null
    and numar_document is null
  );

create policy business_trips_update on public.business_trips
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      app.poate_accesa_deplasare(organization_id, employee_id, 'approve')
      or (app.poate_accesa_deplasare(organization_id, employee_id, 'update') and status in ('ciorna', 'respinsa'))
    )
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.poate_accesa_deplasare(organization_id, employee_id, 'update')
  );

-- Etape
create policy business_trip_legs_select on public.business_trip_legs
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.poate_accesa_deplasare(organization_id, app.deplasare_angajat(business_trip_id), 'read')
  );

create policy business_trip_legs_insert on public.business_trip_legs
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.poate_accesa_deplasare(organization_id, app.deplasare_angajat(business_trip_id), 'update')
    and app.deplasare_editabila(business_trip_id)
    and deleted_at is null
  );

create policy business_trip_legs_update on public.business_trip_legs
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.poate_accesa_deplasare(organization_id, app.deplasare_angajat(business_trip_id), 'update')
    and (app.deplasare_editabila(business_trip_id)
         or app.poate_accesa_deplasare(organization_id, app.deplasare_angajat(business_trip_id), 'approve'))
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.poate_accesa_deplasare(organization_id, app.deplasare_angajat(business_trip_id), 'update')
  );

-- Cheltuieli
create policy trip_expenses_select on public.trip_expenses
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.poate_accesa_deplasare(organization_id, app.deplasare_angajat(business_trip_id), 'read')
  );

create policy trip_expenses_insert on public.trip_expenses
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.poate_accesa_deplasare(organization_id, app.deplasare_angajat(business_trip_id), 'update')
    and deleted_at is null
    and aprobata = false
    and aprobata_de is null
    and aprobata_la is null
    and motiv_respingere is null
  );

create policy trip_expenses_update on public.trip_expenses
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      app.poate_accesa_deplasare(organization_id, app.deplasare_angajat(business_trip_id), 'approve')
      or (app.poate_accesa_deplasare(organization_id, app.deplasare_angajat(business_trip_id), 'update')
          and aprobata = false)
    )
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.poate_accesa_deplasare(organization_id, app.deplasare_angajat(business_trip_id), 'update')
  );

-- Rezultatul calculului: doar citire. Scrierea se face exclusiv prin
-- app.recalculeaza_diurna() (SECURITY DEFINER, cu verificare de drepturi înăuntru),
-- de aceea NU există politici INSERT/UPDATE pentru rolul authenticated.
create policy per_diem_calculations_select on public.per_diem_calculations
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.poate_accesa_deplasare(organization_id, app.deplasare_angajat(business_trip_id), 'read')
  );

-- =====================================================================================
-- 14. Date de pornire — ORIENTATIVE, DE VERIFICAT DE JURIST
-- =====================================================================================
insert into public.countries (cod_alpha2, cod_alpha3, denumire, moneda, este_ue, este_see) values
  ('RO', 'ROU', 'România', 'RON', true, true),
  ('AT', 'AUT', 'Austria', 'EUR', true, true),
  ('BG', 'BGR', 'Bulgaria', 'BGN', true, true),
  ('DE', 'DEU', 'Germania', 'EUR', true, true),
  ('ES', 'ESP', 'Spania', 'EUR', true, true),
  ('FR', 'FRA', 'Franța', 'EUR', true, true),
  ('GB', 'GBR', 'Regatul Unit', 'GBP', false, false),
  ('GR', 'GRC', 'Grecia', 'EUR', true, true),
  ('HU', 'HUN', 'Ungaria', 'HUF', true, true),
  ('IT', 'ITA', 'Italia', 'EUR', true, true),
  ('NL', 'NLD', 'Țările de Jos', 'EUR', true, true),
  ('PL', 'POL', 'Polonia', 'PLN', true, true),
  ('TR', 'TUR', 'Turcia', 'TRY', false, false),
  ('US', 'USA', 'Statele Unite ale Americii', 'USD', false, false)
on conflict do nothing;

-- ⚠ VALORI ORIENTATIVE, NU BAREM OFICIAL. Se înlocuiesc integral la importul din fișier:
--   npm run import:barem-diurna -- --fisier ./date/hg-518-1995.csv --valabil-de-la 2026-01-01
-- Importul adaugă rânduri noi cu valabil_de_la și închide rândurile vechi prin valabil_pana;
-- nu se face UPDATE peste istoric.
insert into public.per_diem_country_rates (country_id, categorie, valoare, moneda, valabil_de_la, observatii)
select c.id, 'II', v.valoare, 'EUR', date '2026-01-01',
       'VALOARE ORIENTATIVĂ — A SE ÎNLOCUI CU BAREMUL OFICIAL ÎNAINTE DE UTILIZARE ÎN PRODUCȚIE'
from public.countries c
join (values ('AT', 35.00), ('DE', 35.00), ('FR', 35.00), ('IT', 35.00), ('ES', 35.00),
             ('NL', 35.00), ('GR', 32.00), ('HU', 32.00), ('BG', 32.00), ('PL', 32.00)
     ) as v(cod, valoare) on v.cod = c.cod_alpha2
on conflict do nothing;

-- =====================================================================================
-- NOTE DE IMPLEMENTARE
--
-- 1. ZIUA TRECERII FRONTIEREI. Deplasarea se taie în ferestre consecutive de 24 de ore
--    începând de la momentul plecării (nu în zile calendaristice — altfel o plecare la
--    18:00 cu întoarcere a doua zi la 10:00, adică 16 ore, s-ar fi împărțit în 6 + 10 ore
--    și ar fi ieșit zero zile, deși durata totală depășește pragul). Fiecare fereastră
--    primește o fracțiune (0, fracțiunea parțială din politică, sau 1) ȘI exact o țară.
--    Când într-o fereastră apar două sau mai multe țări, câștigătoarea se alege după
--    regula din politică — țara de plecare, țara de sosire, țara cu baremul mai mare sau
--    țara cu cele mai multe ore. Fereastra rămâne una singură, deci ziua nu se plătește
--    de două ori. Dacă politica firmei este mai strictă și nu acordă diurnă în ziua
--    trecerii, fereastra primește fracțiunea 0, dar rămâne în detalii cu motivul scris,
--    ca să se vadă de ce lipsește.
--
-- 2. DE CE PLAFONUL ÎMPARTE ÎN LOC SĂ BLOCHEZE. Plafonul neimpozabil (multiplul din
--    politică aplicat baremului) nu este o limită legală de plată: firma are voie să
--    plătească mai mult, doar că partea de peste plafon devine venit asimilat salariului.
--    Dacă motorul ar refuza calculul, ar împinge utilizatorul să falsifice datele
--    deplasării ca să „încapă”. Așa că se calculează integral, se scrie
--    parte_neimpozabila_lei = min(valoare, plafon) și parte_impozabila_lei = restul, iar
--    Faza 9 (salarizare) preia partea impozabilă ca element de venit. Când lipsește cursul
--    valutar, curs_incomplet devine true și sumele în lei rămân null — nu se inventează curs.
--
-- 3. CE ESTE DOAR SCHIȚAT LA DETAȘAREA TRANSNAȚIONALĂ. Intră acum doar câmpurile și
--    constrângerea care cere statul gazdă, salariul minim aplicabil acolo și moneda lui
--    atunci când detasare_transnationala = true, plus datele formularului A1 și numărul
--    declarației de detașare. NU sunt implementate: comparația efectivă între salariul
--    plătit și salariul minim din statul gazdă, regula „diurna nu poate înlocui salariul”,
--    notificarea prealabilă către autoritatea statului gazdă, termenele de 12/18 luni și
--    proiecția valabilității formularului A1 în motorul de expirări.
--
-- SEMNALĂRI (lipsesc din inventar — nu au fost inventate aici):
--   • Nu cunosc semnătura reală a internal.sync_expirable(...) și lista din
--     app.poate_vedea_expirabil(), deci valabilitatea formularului A1 NU este încă
--     proiectată în expirables. Trebuie adăugat un entity_type nou (propunere:
--     'business_trip_a1', kind = 'formular_a1') și înregistrat în app.poate_vedea_expirabil().
--   • Nu cunosc coloanele reale ale approval_flows / approval_steps din 0009, deci nu am
--     inserat fluxul implicit pentru entity_type = 'business_trip'. Trebuie adăugat
--     separat, împreună cu sincronizarea business_trips.status ← approval_tasks.
--   • Nu am atins role_permissions: dacă perechile per_diem × {read, create, update,
--     delete, approve, export} nu sunt deja în seed, trebuie completate acolo.
--   • Am presupus că internal.set_actor() populează created_by / updated_by / updated_at
--     pe coloanele cu aceste nume; dacă folosește alte nume, coloanele trebuie redenumite.
--   • Politicile nu filtrează deleted_at, ca să rămână posibilă acțiunea de restaurare;
--     filtrarea rândurilor șterse se face în interogări.
-- =====================================================================================
