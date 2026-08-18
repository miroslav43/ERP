-- supabase/migrations/0011_ssm.sql
-- Faza 7 — SSM, PSI, medicina muncii, ISCIR și mentenanță.
-- Convenții: soft delete peste tot, RLS + FORCE pe fiecare tabelă, fără politici DELETE,
-- fără CHECK cu now()/current_date (regulile temporale sunt în triggere, errcode P0001),
-- toate periodicitățile legale sunt în tabele de configurare cu `valabil_de_la` (istoric).

-- ─────────────────────────────  1. TIPURI  ─────────────────────────────
create type public.ssm_domain          as enum ('ssm','psi');
create type public.ssm_accident_type   as enum ('usor','grav','mortal','colectiv');
create type public.ssm_exam_type       as enum ('angajare','periodic','reluare','adaptare');
create type public.ssm_exam_result     as enum ('apt','apt_conditionat','inapt_temporar','inapt');
create type public.ssm_measure_status  as enum ('planificata','in_lucru','realizata','amanata','anulata');
create type public.equipment_status    as enum ('in_functiune','in_reparatie','in_conservare','casat');
create type public.meter_kind          as enum ('ore','km','cicluri');
create type public.maintenance_kind    as enum ('preventiva','predictiva','corectiva');
create type public.maintenance_result  as enum ('reusita','partiala','esuata','amanata');
create type public.fault_urgency       as enum ('scazuta','medie','ridicata','critica');
create type public.fault_status        as enum ('nou','in_analiza','in_lucru','rezolvat','respins');

-- Șablon de coloane comune (nu este expus prin PostgREST; folosit doar prin LIKE).
create table internal.tmpl_ssm (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

-- ──────────────────  2. CONFIGURARE LEGALĂ CU ISTORIC  ──────────────────
create table public.ssm_legal_parameters (
  like internal.tmpl_ssm including defaults including indexes,
  cod text not null,
  denumire text not null,
  valoare numeric(14,2) not null,
  unitate text not null,
  valabil_de_la date not null,
  temei_legal text,
  de_verificat_de_jurist boolean not null default true,
  observatii text
);
comment on table public.ssm_legal_parameters is
  'Praguri și termene legale (comunicare ITM, prag CSSM, periodicități). Valorile implicite sunt orientative și trebuie confirmate de jurist.';

create table public.ssm_training_types (
  like internal.tmpl_ssm including defaults including indexes,
  cod text not null,
  denumire text not null,
  domeniu public.ssm_domain not null,
  obligatoriu boolean not null default true,
  cine_poate_instrui text not null default 'lucrator_desemnat',
  activ boolean not null default true
);

create table public.ssm_training_type_periods (
  like internal.tmpl_ssm including defaults including indexes,
  training_type_id uuid not null references public.ssm_training_types(id),
  periodicitate_luni integer check (periodicitate_luni is null or periodicitate_luni between 1 and 240),
  durata_minima_ore numeric(6,2) not null default 0 check (durata_minima_ore >= 0),
  valabil_de_la date not null,
  temei_legal text,
  de_verificat_de_jurist boolean not null default true
);

-- ─────────────────  3. GRUP A — INSTRUIRI ȘI REGISTRE ITM  ─────────────────
create table public.ssm_trainings (
  like internal.tmpl_ssm including defaults including indexes,
  employee_id uuid not null references public.employees(id),
  training_type_id uuid not null references public.ssm_training_types(id),
  data_instruirii date not null,
  durata_ore numeric(6,2) not null default 0 check (durata_ore >= 0),
  lector_employee_id uuid references public.employees(id),
  lector_extern text,
  tematica text,
  materiale text,
  test_punctaj numeric(5,2) check (test_punctaj is null or test_punctaj between 0 and 100),
  semnatura_confirmata boolean not null default false,
  semnat_la timestamptz,
  urmatoarea_scadenta date,
  observatii text
);

create table public.risk_assessments (
  like internal.tmpl_ssm including defaults including indexes,
  cod text not null,
  denumire text not null,
  job_position_id uuid references public.job_positions(id),
  department_id uuid references public.departments(id),
  locatie text,
  data_evaluarii date not null,
  evaluator text,
  metoda text not null default 'INCDPM',
  valabil_pana date,
  status text not null default 'draft' check (status in ('draft','aprobat','arhivat')),
  aprobat_de uuid,
  aprobat_la timestamptz
);

create table public.risk_assessment_items (
  like internal.tmpl_ssm including defaults including indexes,
  assessment_id uuid not null references public.risk_assessments(id) on delete cascade,
  factor_risc text not null,
  pericol text not null,
  consecinta text,
  probabilitate smallint not null check (probabilitate between 1 and 5),
  gravitate smallint not null check (gravitate between 1 and 5),
  nivel_risc smallint generated always as (probabilitate * gravitate) stored,
  masuri text,
  termen date,
  responsabil_employee_id uuid references public.employees(id)
);

create table public.prevention_plan_measures (
  like internal.tmpl_ssm including defaults including indexes,
  assessment_id uuid references public.risk_assessments(id),
  masura text not null,
  tip text not null default 'tehnica' check (tip in ('tehnica','organizatorica','igienico_sanitara','alta')),
  termen date not null,
  responsabil_employee_id uuid references public.employees(id),
  cost_estimat numeric(14,2) check (cost_estimat is null or cost_estimat >= 0),
  cost_realizat numeric(14,2) check (cost_realizat is null or cost_realizat >= 0),
  status public.ssm_measure_status not null default 'planificata',
  realizat_la date,
  observatii text
);

create table public.work_accidents (
  like internal.tmpl_ssm including defaults including indexes,
  numar_intern text,
  employee_id uuid references public.employees(id),
  data_producerii date not null,
  ora_producerii time,
  locul text not null,
  imprejurari text not null,
  tip public.ssm_accident_type not null,
  zile_incapacitate integer not null default 0 check (zile_incapacitate >= 0),
  comunicat_la_itm_la timestamptz,
  termen_comunicare_ore integer,
  numar_proces_verbal text,
  cercetare_finalizata_la date,
  urmari text
);

create table public.dangerous_incidents (
  like internal.tmpl_ssm including defaults including indexes,
  numar_intern text,
  data_producerii date not null,
  ora_producerii time,
  locul text not null,
  descriere text not null,
  cauze text,
  masuri text,
  employee_id uuid references public.employees(id),
  comunicat_la_itm_la timestamptz
);

create table public.occupational_diseases (
  like internal.tmpl_ssm including defaults including indexes,
  employee_id uuid not null references public.employees(id),
  numar_fisa_bp text,
  data_semnalarii date not null,
  data_confirmarii date,
  noxa_profesionala text not null,
  denumire_boala text,
  unitate_sanitara text,
  zile_incapacitate integer not null default 0 check (zile_incapacitate >= 0),
  masuri text
);
comment on table public.occupational_diseases is
  'Registru legal (BP1/BP2). Conține date de sănătate — art. 9 GDPR. Se citește doar cu domeniu ssm și scope cel puțin team.';

create table public.safety_committee_meetings (
  like internal.tmpl_ssm including defaults including indexes,
  data date not null,
  ora time,
  tip text not null default 'ordinara' check (tip in ('ordinara','extraordinara')),
  participanti text,
  ordine_de_zi text not null,
  hotarari text,
  numar_proces_verbal text,
  presedinte_employee_id uuid references public.employees(id),
  secretar_employee_id uuid references public.employees(id),
  numar_lucratori_la_data integer check (numar_lucratori_la_data is null or numar_lucratori_la_data >= 0),
  prag_obligativitate integer
);

create table public.ppe_issuances (
  like internal.tmpl_ssm including defaults including indexes,
  employee_id uuid not null references public.employees(id),
  articol text not null,
  cod_articol text,
  cantitate numeric(10,2) not null default 1 check (cantitate > 0),
  unitate text not null default 'buc',
  data_predarii date not null,
  durata_utilizare_luni integer check (durata_utilizare_luni is null or durata_utilizare_luni > 0),
  data_inlocuirii date,
  valoare numeric(14,2) check (valoare is null or valoare >= 0),
  semnatura_confirmata boolean not null default false,
  returnat_la date,
  observatii text
);

-- ────────────────────────────  4. GRUP B — PSI  ────────────────────────────
create table public.fire_extinguishers (
  like internal.tmpl_ssm including defaults including indexes,
  cod text not null,
  tip text not null,
  masa_kg numeric(10,2) check (masa_kg is null or masa_kg > 0),
  cladire text,
  locatie text not null,
  producator text,
  serie text,
  data_punerii_in_functiune date,
  ultima_verificare date,
  ultima_reincarcare date,
  ultima_proba_presiune date,
  scadenta_verificare date,
  scadenta_reincarcare date,
  scadenta_proba_presiune date,
  status text not null default 'activ' check (status in ('activ','in_service','casat'))
);

create table public.fire_extinguisher_checks (
  like internal.tmpl_ssm including defaults including indexes,
  extinguisher_id uuid not null references public.fire_extinguishers(id) on delete cascade,
  tip_verificare text not null check (tip_verificare in ('verificare','reincarcare','proba_presiune')),
  data date not null,
  executant text,
  firma_autorizata text,
  rezultat text not null default 'conform' check (rezultat in ('conform','neconform','remediat')),
  cost numeric(14,2) check (cost is null or cost >= 0),
  observatii text
);

create table public.evacuation_drills (
  like internal.tmpl_ssm including defaults including indexes,
  data date not null,
  ora_start time,
  durata_minute integer check (durata_minute is null or durata_minute > 0),
  scenariu text not null,
  numar_participanti integer check (numar_participanti is null or numar_participanti >= 0),
  timp_evacuare_secunde integer check (timp_evacuare_secunde is null or timp_evacuare_secunde >= 0),
  responsabil_employee_id uuid references public.employees(id),
  deficiente text,
  observatii text
);

create table public.hot_work_permits (
  like internal.tmpl_ssm including defaults including indexes,
  numar text not null,
  locul text not null,
  lucrare text not null,
  valabil_de_la timestamptz not null,
  valabil_pana timestamptz not null,
  executant_employee_id uuid references public.employees(id),
  executant_extern text,
  emitent_employee_id uuid references public.employees(id),
  supraveghetor text,
  masuri text not null,
  status text not null default 'emis' check (status in ('emis','in_desfasurare','incheiat','anulat')),
  incheiat_la timestamptz,
  constraint hot_work_permits_interval_ck check (valabil_pana > valabil_de_la)
);

create table public.environmental_permits (
  like internal.tmpl_ssm including defaults including indexes,
  numar text not null,
  tip text not null,
  emitent text not null,
  obiect text,
  emis_la date,
  valabil_pana date not null,
  conditii text,
  responsabil_employee_id uuid references public.employees(id)
);

-- ───────────────────  5. GRUP C — MEDICINA MUNCII  ───────────────────
create table public.occupational_health_exams (
  like internal.tmpl_ssm including defaults including indexes,
  employee_id uuid not null references public.employees(id),
  tip public.ssm_exam_type not null,
  data_examinarii date not null,
  medic text,
  unitate_medicala text,
  rezultat public.ssm_exam_result not null,
  valabil_pana date,
  numar_fisa text,
  cost numeric(14,2) check (cost is null or cost >= 0),
  observatii text
);
comment on table public.occupational_health_exams is
  'Fișa de aptitudine. Se stochează DOAR aptitudinea, niciodată diagnosticul (art. 9 GDPR).';

create table public.employee_work_restrictions (
  like internal.tmpl_ssm including defaults including indexes,
  employee_id uuid not null references public.employees(id),
  exam_id uuid references public.occupational_health_exams(id),
  sursa text not null default 'fisa_medicala' check (sursa in ('fisa_medicala','decizie_interna','recomandare_itm')),
  restrictie text not null,
  valabil_de_la date not null,
  valabil_pana date,
  generata_automat boolean not null default false,
  ridicata_la date,
  observatii text,
  constraint employee_work_restrictions_interval_ck
    check (valabil_pana is null or valabil_pana >= valabil_de_la)
);

-- ─────────────  6. GRUP D — ECHIPAMENTE, MENTENANȚĂ, ISCIR  ─────────────
create table public.equipment (
  like internal.tmpl_ssm including defaults including indexes,
  cod text not null,
  denumire text not null,
  serie text,
  producator text,
  model text,
  an_fabricatie integer check (an_fabricatie is null or an_fabricatie between 1900 and 2200),
  locatie text,
  department_id uuid references public.departments(id),
  responsabil_employee_id uuid references public.employees(id),
  status public.equipment_status not null default 'in_functiune',
  este_iscir boolean not null default false,
  tip_autorizare_necesara text,
  valoare_achizitie numeric(14,2) check (valoare_achizitie is null or valoare_achizitie >= 0),
  data_punerii_in_functiune date,
  derogare_motiv text,
  derogare_acordata_de uuid,
  derogare_acordata_la timestamptz
);

create table public.equipment_meters (
  like internal.tmpl_ssm including defaults including indexes,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  tip public.meter_kind not null,
  citire numeric(14,2) not null check (citire >= 0),
  data_citirii date not null,
  resetare_contor boolean not null default false,
  sursa text not null default 'manual',
  citit_de_employee_id uuid references public.employees(id),
  observatii text
);

create table public.maintenance_plans (
  like internal.tmpl_ssm including defaults including indexes,
  equipment_id uuid not null references public.equipment(id),
  denumire text not null,
  tip public.maintenance_kind not null default 'preventiva',
  periodicitate_zile integer check (periodicitate_zile is null or periodicitate_zile > 0),
  periodicitate_contor numeric(14,2) check (periodicitate_contor is null or periodicitate_contor > 0),
  tip_contor public.meter_kind,
  ultima_executie date,
  ultima_citire_contor numeric(14,2),
  urmatoarea_scadenta date,
  urmatoarea_scadenta_contor numeric(14,2),
  responsabil_employee_id uuid references public.employees(id),
  instructiuni text,
  activ boolean not null default true,
  constraint maintenance_plans_periodicitate_ck
    check (periodicitate_zile is not null or periodicitate_contor is not null),
  constraint maintenance_plans_contor_ck
    check (periodicitate_contor is null or tip_contor is not null)
);

create table public.maintenance_interventions (
  like internal.tmpl_ssm including defaults including indexes,
  plan_id uuid references public.maintenance_plans(id),
  equipment_id uuid not null references public.equipment(id),
  tip public.maintenance_kind not null default 'corectiva',
  data date not null,
  ora_start time,
  durata_ore numeric(8,2) check (durata_ore is null or durata_ore >= 0),
  executant_employee_id uuid references public.employees(id),
  executant_extern text,
  descriere text not null,
  piese text,
  cost_piese numeric(14,2) not null default 0 check (cost_piese >= 0),
  cost_manopera numeric(14,2) not null default 0 check (cost_manopera >= 0),
  cost_total numeric(14,2) generated always as (cost_piese + cost_manopera) stored,
  rezultat public.maintenance_result not null default 'reusita',
  oprire_minute integer check (oprire_minute is null or oprire_minute >= 0),
  citire_contor numeric(14,2),
  observatii text
);

create table public.fault_reports (
  like internal.tmpl_ssm including defaults including indexes,
  equipment_id uuid not null references public.equipment(id),
  raportat_de_employee_id uuid references public.employees(id),
  descriere text not null,
  urgenta public.fault_urgency not null default 'medie',
  status public.fault_status not null default 'nou',
  raportat_la timestamptz not null default now(),
  opreste_functionarea boolean not null default false,
  intervention_id uuid references public.maintenance_interventions(id),
  rezolvat_la timestamptz,
  motiv_respingere text
);

create table public.iscir_authorizations (
  like internal.tmpl_ssm including defaults including indexes,
  equipment_id uuid not null references public.equipment(id),
  numar text not null,
  tip text not null,
  emitent text not null default 'ISCIR',
  emis_la date,
  valabil_pana date not null,
  scadenta_verificare_tehnica date,
  conditii text,
  suspendata_la date
);

create table public.personnel_authorizations (
  like internal.tmpl_ssm including defaults including indexes,
  employee_id uuid not null references public.employees(id),
  tip text not null,
  grupa text,
  numar text not null,
  emitent text not null,
  emis_la date,
  valabil_pana date not null,
  suspendata_la date,
  observatii text
);
comment on table public.personnel_authorizations is
  'Autorizații nominale (stivuitorist, macaragiu, fochist, electrician autorizat). Condiționează desemnarea ca responsabil pe echipamente ISCIR.';

-- ─────────────────────  7. INDECȘI ȘI UNICITĂȚI PARȚIALE  ─────────────────────
create unique index ssm_legal_parameters_uq on public.ssm_legal_parameters (organization_id, cod, valabil_de_la) where deleted_at is null;
create unique index ssm_training_types_uq on public.ssm_training_types (organization_id, cod) where deleted_at is null;
create unique index ssm_training_type_periods_uq on public.ssm_training_type_periods (organization_id, training_type_id, valabil_de_la) where deleted_at is null;
create unique index risk_assessments_uq on public.risk_assessments (organization_id, cod) where deleted_at is null;
create unique index work_accidents_uq on public.work_accidents (organization_id, numar_intern) where deleted_at is null and numar_intern is not null;
create unique index fire_extinguishers_uq on public.fire_extinguishers (organization_id, cod) where deleted_at is null;
create unique index hot_work_permits_uq on public.hot_work_permits (organization_id, numar) where deleted_at is null;
create unique index environmental_permits_uq on public.environmental_permits (organization_id, numar, tip) where deleted_at is null;
create unique index equipment_uq on public.equipment (organization_id, cod) where deleted_at is null;
create unique index iscir_authorizations_uq on public.iscir_authorizations (organization_id, numar) where deleted_at is null;
create unique index personnel_authorizations_uq on public.personnel_authorizations (organization_id, employee_id, tip, numar) where deleted_at is null;
create unique index employee_work_restrictions_auto_uq on public.employee_work_restrictions (organization_id, exam_id) where generata_automat and deleted_at is null;
create index ssm_trainings_ang_idx on public.ssm_trainings (organization_id, employee_id, training_type_id, data_instruirii desc) where deleted_at is null;
create index health_exams_ang_idx on public.occupational_health_exams (organization_id, employee_id, data_examinarii desc) where deleted_at is null;
create index equipment_meters_idx on public.equipment_meters (organization_id, equipment_id, tip, data_citirii desc) where deleted_at is null;
create index maintenance_plans_scad_idx on public.maintenance_plans (organization_id, urmatoarea_scadenta) where deleted_at is null and activ;
create index fault_reports_status_idx on public.fault_reports (organization_id, status, urgenta) where deleted_at is null;
create index ppe_issuances_ang_idx on public.ppe_issuances (organization_id, employee_id, data_predarii desc) where deleted_at is null;

-- ─────────────────  8. FUNCȚII DE CITIRE A CONFIGURĂRII  ─────────────────
create or replace function app.parametru_ssm(p_org uuid, p_cod text, p_la date default null)
returns numeric language sql stable security definer set search_path = '' as $$
  select p.valoare from public.ssm_legal_parameters p
  where p.organization_id = p_org and p.cod = p_cod and p.deleted_at is null
    and p.valabil_de_la <= coalesce(p_la, (now() at time zone 'Europe/Bucharest')::date)
  order by p.valabil_de_la desc limit 1
$$;

create or replace function app.periodicitate_instruire(p_tip uuid, p_la date)
returns integer language sql stable security definer set search_path = '' as $$
  select p.periodicitate_luni from public.ssm_training_type_periods p
  where p.training_type_id = p_tip and p.deleted_at is null and p.valabil_de_la <= p_la
  order by p.valabil_de_la desc limit 1
$$;

-- Acces uniform: 'all' vede tot; 'team' vede echipa (și rândurile de organizație);
-- 'own' vede doar propriile rânduri. p_employee null = rând de organizație.
create or replace function app.ssm_acces(p_org uuid, p_resursa text, p_actiune text, p_employee uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when p_org is null then false
    when app.can(p_org, p_resursa, p_actiune, 'all') then true
    when p_employee is null then app.can(p_org, p_resursa, p_actiune, 'team')
    when app.can(p_org, p_resursa, p_actiune, 'team')
      and (p_employee = app.current_employee_id(p_org) or app.is_manager_of(p_org, p_employee)) then true
    when app.can(p_org, p_resursa, p_actiune, 'own')
      and p_employee = app.current_employee_id(p_org) then true
    else false
  end
$$;

-- Rescriere INTEGRALĂ (toate ramurile existente + cele patru tipuri noi).
create or replace function app.poate_vedea_expirabil(p_organization_id uuid, p_entity_type text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case p_entity_type
    when 'medical_exam'             then app.feature_on(p_organization_id,'ssm')        and app.can(p_organization_id,'ssm','read','team')
    when 'employee_document'        then app.can(p_organization_id,'employees','read','team')
    when 'work_permit'              then app.can(p_organization_id,'employees','read','team')
    when 'employment_contract'      then app.can(p_organization_id,'employees','read','team')
    when 'vehicle_document'         then app.feature_on(p_organization_id,'fleet')       and app.can(p_organization_id,'vehicles','read','team')
    when 'equipment'                then app.feature_on(p_organization_id,'maintenance') and app.can(p_organization_id,'maintenance','read','team')
    when 'fire_extinguisher'        then app.feature_on(p_organization_id,'ssm')         and app.can(p_organization_id,'ssm','read','team')
    when 'ssm_training'             then app.feature_on(p_organization_id,'ssm')         and app.can(p_organization_id,'ssm','read','team')
    when 'environmental_permit'     then app.feature_on(p_organization_id,'ssm')         and app.can(p_organization_id,'compliance','read','team')
    when 'inventory_item'           then app.feature_on(p_organization_id,'inventory')   and app.can(p_organization_id,'inventory','read','team')
    when 'iscir_authorization'      then app.feature_on(p_organization_id,'maintenance') and app.can(p_organization_id,'maintenance','read','team')
    when 'maintenance_plan'         then app.feature_on(p_organization_id,'maintenance') and app.can(p_organization_id,'maintenance','read','team')
    when 'personnel_authorization'  then app.feature_on(p_organization_id,'ssm')         and app.can(p_organization_id,'ssm','read','team')
    when 'ppe_issuance'             then app.feature_on(p_organization_id,'ssm')         and app.can(p_organization_id,'ssm','read','team')
    else false
  end
$$;

-- ───────────────────────  9. TRIGGERE DE BUSINESS  ───────────────────────
create or replace function internal.ssm_data_nu_in_viitor() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_val date;
begin
  v_val := nullif(to_jsonb(new) ->> tg_argv[0], '')::date;
  if v_val is not null and v_val > (now() at time zone 'Europe/Bucharest')::date then
    raise exception using errcode = 'P0001',
      message = format('%s nu poate fi o dată din viitor.', tg_argv[1]);
  end if;
  return new;
end $$;

-- Proiecție generică în expirables (entity_id, kind și data expirării vin din TG_ARGV).
create or replace function internal.ssm_sync_exp() returns trigger
language plpgsql security definer set search_path = '' as $$
declare j jsonb := to_jsonb(new); v_exp date; v_id uuid; v_resp uuid; v_kind text;
begin
  v_exp := nullif(j ->> tg_argv[3], '')::date;
  v_id  := nullif(j ->> tg_argv[4], '')::uuid;
  v_resp := case when tg_argv[5] = '' then null else nullif(j ->> tg_argv[5], '')::uuid end;
  v_kind := case when left(tg_argv[1],1) = '@' then coalesce(nullif(j ->> substr(tg_argv[1],2),''),'implicit')
                 else tg_argv[1] end;
  if v_id is null or v_exp is null then return null; end if;
  perform internal.sync_expirable(new.organization_id, tg_argv[0], v_id, v_kind,
    tg_argv[2] || coalesce(' ' || nullif(j ->> 'numar',''), coalesce(' ' || nullif(j ->> 'cod',''), '')),
    v_exp, tg_table_name, v_resp, new.deleted_at is null);
  return null;
end $$;

create or replace function internal.ssm_training_calc() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_luni integer;
begin
  if new.data_instruirii > (now() at time zone 'Europe/Bucharest')::date then
    raise exception using errcode = 'P0001', message = 'Data instruirii nu poate fi în viitor.';
  end if;
  if new.urmatoarea_scadenta is null then
    v_luni := app.periodicitate_instruire(new.training_type_id, new.data_instruirii);
    if v_luni is not null then
      new.urmatoarea_scadenta := (new.data_instruirii + make_interval(months => v_luni))::date;
    end if;
  end if;
  return new;
end $$;

create or replace function internal.ssm_training_sync() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_cod text; v_den text; v_dom text; v_scad date;
begin
  select t.cod, t.denumire, t.domeniu::text into v_cod, v_den, v_dom
    from public.ssm_training_types t where t.id = new.training_type_id;
  select s.urmatoarea_scadenta into v_scad from public.ssm_trainings s
   where s.organization_id = new.organization_id and s.employee_id = new.employee_id
     and s.training_type_id = new.training_type_id and s.deleted_at is null
   order by s.data_instruirii desc, s.created_at desc limit 1;
  if not found then
    if new.urmatoarea_scadenta is not null then
      perform internal.sync_expirable(new.organization_id,'ssm_training', new.employee_id,
        v_dom || ':' || v_cod, 'Instruire ' || upper(v_dom) || ' — ' || v_den,
        new.urmatoarea_scadenta, 'ssm_trainings', new.employee_id, false);
    end if;
    return null;
  end if;
  if v_scad is null then return null; end if;
  perform internal.sync_expirable(new.organization_id,'ssm_training', new.employee_id,
    v_dom || ':' || v_cod, 'Instruire ' || upper(v_dom) || ' — ' || v_den,
    v_scad, 'ssm_trainings', new.employee_id, true);
  return null;
end $$;

create or replace function internal.ssm_accident_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.data_producerii > (now() at time zone 'Europe/Bucharest')::date then
    raise exception using errcode = 'P0001', message = 'Data producerii accidentului nu poate fi în viitor.';
  end if;
  if new.comunicat_la_itm_la is not null
     and (new.comunicat_la_itm_la at time zone 'Europe/Bucharest')::date < new.data_producerii then
    raise exception using errcode = 'P0001',
      message = 'Comunicarea către ITM nu poate fi anterioară producerii accidentului.';
  end if;
  if new.termen_comunicare_ore is null then
    new.termen_comunicare_ore := coalesce(
      app.parametru_ssm(new.organization_id,'termen_comunicare_itm', new.data_producerii)::integer, 24);
  end if;
  return new;
end $$;

create or replace function internal.ssm_ppe_calc() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_luni integer;
begin
  v_luni := coalesce(new.durata_utilizare_luni,
    app.parametru_ssm(new.organization_id,'durata_eip_implicita', new.data_predarii)::integer);
  if new.data_inlocuirii is null and v_luni is not null then
    new.data_inlocuirii := (new.data_predarii + make_interval(months => v_luni))::date;
  end if;
  return new;
end $$;

create or replace function internal.ssm_extinguisher_calc() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_ver integer; v_rei integer; v_pre integer;
begin
  v_ver := coalesce(app.parametru_ssm(new.organization_id,'periodicitate_verificare_stingator')::integer, 12);
  v_rei := coalesce(app.parametru_ssm(new.organization_id,'periodicitate_reincarcare_stingator')::integer, 36);
  v_pre := coalesce(app.parametru_ssm(new.organization_id,'periodicitate_proba_presiune_stingator')::integer, 60);
  new.scadenta_verificare := case when new.ultima_verificare is null then null
    else (new.ultima_verificare + make_interval(months => v_ver))::date end;
  new.scadenta_reincarcare := case when new.ultima_reincarcare is null then null
    else (new.ultima_reincarcare + make_interval(months => v_rei))::date end;
  new.scadenta_proba_presiune := case when new.ultima_proba_presiune is null then null
    else (new.ultima_proba_presiune + make_interval(months => v_pre))::date end;
  return new;
end $$;

create or replace function internal.ssm_extinguisher_sync() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_activ boolean := new.deleted_at is null and new.status <> 'casat';
begin
  if new.scadenta_verificare is not null then
    perform internal.sync_expirable(new.organization_id,'fire_extinguisher',new.id,'verificare',
      'Stingător ' || new.cod || ' — verificare', new.scadenta_verificare,'fire_extinguishers',null,v_activ);
  end if;
  if new.scadenta_reincarcare is not null then
    perform internal.sync_expirable(new.organization_id,'fire_extinguisher',new.id,'reincarcare',
      'Stingător ' || new.cod || ' — reîncărcare', new.scadenta_reincarcare,'fire_extinguishers',null,v_activ);
  end if;
  if new.scadenta_proba_presiune is not null then
    perform internal.sync_expirable(new.organization_id,'fire_extinguisher',new.id,'proba_presiune',
      'Stingător ' || new.cod || ' — probă de presiune', new.scadenta_proba_presiune,'fire_extinguishers',null,v_activ);
  end if;
  return null;
end $$;

create or replace function internal.ssm_check_apply() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.deleted_at is not null then return null; end if;
  update public.fire_extinguishers f set
    ultima_verificare = case when new.tip_verificare = 'verificare'
      then greatest(coalesce(f.ultima_verificare, new.data), new.data) else f.ultima_verificare end,
    ultima_reincarcare = case when new.tip_verificare = 'reincarcare'
      then greatest(coalesce(f.ultima_reincarcare, new.data), new.data) else f.ultima_reincarcare end,
    ultima_proba_presiune = case when new.tip_verificare = 'proba_presiune'
      then greatest(coalesce(f.ultima_proba_presiune, new.data), new.data) else f.ultima_proba_presiune end,
    updated_at = now()
  where f.id = new.extinguisher_id and f.organization_id = new.organization_id;
  return null;
end $$;

create or replace function internal.ssm_exam_sync() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_restrictie text;
begin
  if new.valabil_pana is not null then
    perform internal.sync_expirable(new.organization_id,'medical_exam', new.employee_id,'aptitudine',
      'Fișă de aptitudine — medicina muncii', new.valabil_pana,'occupational_health_exams',
      new.employee_id, new.deleted_at is null);
  end if;
  if new.deleted_at is null and new.rezultat <> 'apt' then
    v_restrictie := case new.rezultat
      when 'inapt' then 'Inapt pentru postul actual — nu poate desfășura activitatea până la o nouă fișă de aptitudine.'
      when 'inapt_temporar' then 'Inapt temporar — activitatea se suspendă până la reexaminare.'
      else 'Apt condiționat — se respectă restricțiile stabilite de medicul de medicina muncii.' end;
    insert into public.employee_work_restrictions
      (organization_id, employee_id, exam_id, sursa, restrictie, valabil_de_la, valabil_pana, generata_automat)
    values (new.organization_id, new.employee_id, new.id,'fisa_medicala', v_restrictie,
      new.data_examinarii, new.valabil_pana, true)
    on conflict (organization_id, exam_id) where generata_automat and deleted_at is null
    do update set restrictie = excluded.restrictie, valabil_pana = excluded.valabil_pana, updated_at = now();
  end if;
  return null;
end $$;

create or replace function internal.ssm_meter_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_ultima numeric(14,2);
begin
  if new.data_citirii > (now() at time zone 'Europe/Bucharest')::date then
    raise exception using errcode = 'P0001', message = 'Data citirii contorului nu poate fi în viitor.';
  end if;
  select m.citire into v_ultima from public.equipment_meters m
   where m.organization_id = new.organization_id and m.equipment_id = new.equipment_id
     and m.tip = new.tip and m.deleted_at is null and m.id <> new.id
     and (m.data_citirii, m.created_at) <= (new.data_citirii, coalesce(new.created_at, now()))
   order by m.data_citirii desc, m.created_at desc limit 1;
  if found and v_ultima is not null and new.citire < v_ultima and not new.resetare_contor then
    raise exception using errcode = 'P0001',
      message = format('Citirea (%s) este mai mică decât ultima citire înregistrată (%s). Corectați valoarea sau bifați „Resetare contor”.', new.citire, v_ultima);
  end if;
  return new;
end $$;

create or replace function internal.ssm_iscir_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_ok boolean; v_admin boolean;
begin
  if new.deleted_at is not null or not new.este_iscir or new.responsabil_employee_id is null then
    new.derogare_motiv := null; new.derogare_acordata_de := null; new.derogare_acordata_la := null;
    return new;
  end if;
  select exists (
    select 1 from public.personnel_authorizations a
     where a.organization_id = new.organization_id
       and a.employee_id = new.responsabil_employee_id
       and a.deleted_at is null and a.suspendata_la is null
       and a.valabil_pana >= (now() at time zone 'Europe/Bucharest')::date
       and (new.tip_autorizare_necesara is null or a.tip = new.tip_autorizare_necesara)
  ) into v_ok;
  if v_ok then
    new.derogare_motiv := null; new.derogare_acordata_de := null; new.derogare_acordata_la := null;
    return new;
  end if;
  v_admin := app.is_platform_admin()
    or app.has_role(new.organization_id, array['super_admin','org_admin']::public.app_role[]);
  if v_admin and coalesce(length(btrim(new.derogare_motiv)), 0) >= 20 then
    new.derogare_acordata_de := auth.uid();
    new.derogare_acordata_la := now();
    return new;
  end if;
  raise exception using errcode = 'P0001',
    message = 'Echipamentul este sub incidența ISCIR, iar angajatul desemnat responsabil nu are o autorizație nominală valabilă. Alegeți un angajat autorizat sau, dacă sunteți administrator al organizației, completați motivul derogării (minimum 20 de caractere).';
end $$;

create or replace function internal.ssm_plan_calc() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.periodicitate_zile is not null then
    new.urmatoarea_scadenta := (coalesce(new.ultima_executie,
      (now() at time zone 'Europe/Bucharest')::date) + make_interval(days => new.periodicitate_zile))::date;
  end if;
  if new.periodicitate_contor is not null then
    new.urmatoarea_scadenta_contor := coalesce(new.ultima_citire_contor, 0) + new.periodicitate_contor;
  end if;
  return new;
end $$;

create or replace function internal.ssm_intervention_apply() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.deleted_at is not null or new.plan_id is null or new.rezultat <> 'reusita' then return null; end if;
  update public.maintenance_plans p
     set ultima_executie = greatest(coalesce(p.ultima_executie, new.data), new.data),
         ultima_citire_contor = coalesce(new.citire_contor, p.ultima_citire_contor),
         updated_at = now()
   where p.id = new.plan_id and p.organization_id = new.organization_id;
  return null;
end $$;

create or replace function internal.ssm_fault_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'rezolvat' and new.intervention_id is null then
    raise exception using errcode = 'P0001',
      message = 'O sesizare nu poate fi marcată rezolvată fără intervenția de mentenanță care a rezolvat-o.';
  end if;
  if new.status = 'respins' and coalesce(length(btrim(new.motiv_respingere)), 0) < 5 then
    raise exception using errcode = 'P0001', message = 'Respingerea unei sesizări cere un motiv scris.';
  end if;
  if new.status = 'rezolvat' and new.rezolvat_la is null then new.rezolvat_la := now(); end if;
  return new;
end $$;

create trigger ssm_trainings_calc before insert or update on public.ssm_trainings for each row execute function internal.ssm_training_calc();
create trigger ssm_trainings_exp after insert or update on public.ssm_trainings for each row execute function internal.ssm_training_sync();
create trigger work_accidents_guard before insert or update on public.work_accidents for each row execute function internal.ssm_accident_guard();
create trigger dangerous_incidents_data before insert or update on public.dangerous_incidents for each row execute function internal.ssm_data_nu_in_viitor('data_producerii','Data producerii incidentului');
create trigger evacuation_drills_data before insert or update on public.evacuation_drills for each row execute function internal.ssm_data_nu_in_viitor('data','Data exercițiului de evacuare');
create trigger ppe_issuances_calc before insert or update on public.ppe_issuances for each row execute function internal.ssm_ppe_calc();
create trigger ppe_issuances_exp after insert or update on public.ppe_issuances for each row execute function internal.ssm_sync_exp('ppe_issuance','inlocuire','Înlocuire EIP','data_inlocuirii','id','employee_id');
create trigger fire_extinguishers_calc before insert or update on public.fire_extinguishers for each row execute function internal.ssm_extinguisher_calc();
create trigger fire_extinguishers_exp after insert or update on public.fire_extinguishers for each row execute function internal.ssm_extinguisher_sync();
create trigger fire_extinguisher_checks_apply after insert or update on public.fire_extinguisher_checks for each row execute function internal.ssm_check_apply();
create trigger environmental_permits_exp after insert or update on public.environmental_permits for each row execute function internal.ssm_sync_exp('environmental_permit','valabilitate','Autorizație de mediu','valabil_pana','id','responsabil_employee_id');
create trigger health_exams_exp after insert or update on public.occupational_health_exams for each row execute function internal.ssm_exam_sync();
create trigger equipment_meters_guard before insert or update on public.equipment_meters for each row execute function internal.ssm_meter_guard();
create trigger equipment_iscir_guard before insert or update on public.equipment for each row execute function internal.ssm_iscir_guard();
create trigger maintenance_plans_calc before insert or update on public.maintenance_plans for each row execute function internal.ssm_plan_calc();
create trigger maintenance_plans_exp after insert or update on public.maintenance_plans for each row execute function internal.ssm_sync_exp('maintenance_plan','scadenta','Mentenanță planificată','urmatoarea_scadenta','id','responsabil_employee_id');
create trigger maintenance_interventions_apply after insert or update on public.maintenance_interventions for each row execute function internal.ssm_intervention_apply();
create trigger fault_reports_guard before insert or update on public.fault_reports for each row execute function internal.ssm_fault_guard();
create trigger iscir_authorizations_exp after insert or update on public.iscir_authorizations for each row execute function internal.ssm_sync_exp('iscir_authorization','@tip','Autorizație ISCIR','valabil_pana','equipment_id','');
create trigger personnel_authorizations_exp after insert or update on public.personnel_authorizations for each row execute function internal.ssm_sync_exp('personnel_authorization','@tip','Autorizație nominală','valabil_pana','employee_id','employee_id');

-- Fișă medicală expirată → restricție automată (se apelează din acțiune sau din job).
create or replace function app.aplica_restrictii_medicale_expirate(p_org uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_n integer := 0;
begin
  if not app.can(p_org,'ssm','update','team') then
    raise exception using errcode = 'P0001', message = 'Nu aveți dreptul de a actualiza dosarele de medicina muncii.';
  end if;
  with ultimele as (
    select distinct on (e.employee_id) e.* from public.occupational_health_exams e
     where e.organization_id = p_org and e.deleted_at is null
     order by e.employee_id, e.data_examinarii desc, e.created_at desc)
  insert into public.employee_work_restrictions
    (organization_id, employee_id, exam_id, sursa, restrictie, valabil_de_la, generata_automat)
  select p_org, u.employee_id, u.id, 'fisa_medicala',
    'Fișă de aptitudine expirată — angajatul nu poate fi programat până la reexaminare.',
    u.valabil_pana, true
  from ultimele u
  where u.valabil_pana is not null and u.valabil_pana < (now() at time zone 'Europe/Bucharest')::date
  on conflict (organization_id, exam_id) where generata_automat and deleted_at is null
  do update set restrictie = excluded.restrictie, updated_at = now();
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ────────────  10. SEED DE PLATFORMĂ (nomenclatoare + parametri)  ────────────
create or replace function app.seed_ssm_defaults(p_org uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare r record; v_id uuid;
begin
  for r in select * from (values
      ('introductiv_general','Instruire introductiv-generală','ssm', null::integer, 8.0),
      ('la_locul_de_munca','Instruire la locul de muncă','ssm', null, 8.0),
      ('periodic','Instruire periodică','ssm', 6, 2.0),
      ('suplimentar','Instruire suplimentară','ssm', null, 2.0),
      ('psi_introductiv','Instruire PSI introductivă','psi', null, 2.0),
      ('psi_periodic','Instruire PSI periodică','psi', 6, 2.0)
    ) as t(cod, denumire, domeniu, luni, ore)
  loop
    v_id := null;
    insert into public.ssm_training_types (organization_id, cod, denumire, domeniu, obligatoriu)
    values (p_org, r.cod, r.denumire, r.domeniu::public.ssm_domain, true)
    on conflict (organization_id, cod) where deleted_at is null do nothing
    returning id into v_id;
    if v_id is null then continue; end if;
    insert into public.ssm_training_type_periods
      (organization_id, training_type_id, periodicitate_luni, durata_minima_ore, valabil_de_la, temei_legal)
    values (p_org, v_id, r.luni, r.ore, date '2006-10-01',
      'Legea 319/2006 și HG 1425/2006 (SSM) / Legea 307/2006 și OMAI 712/2005 (PSI) — DE VERIFICAT DE JURIST');
  end loop;

  insert into public.ssm_legal_parameters (organization_id, cod, denumire, valoare, unitate, valabil_de_la, temei_legal)
  values
    (p_org,'termen_comunicare_itm','Termen de comunicare a evenimentului la ITM',24,'ore',date '2006-10-01','Legea 319/2006 — DE VERIFICAT DE JURIST'),
    (p_org,'prag_cssm_lucratori','Număr de lucrători de la care CSSM este obligatoriu',50,'lucratori',date '2006-10-01','HG 1425/2006 — DE VERIFICAT DE JURIST'),
    (p_org,'periodicitate_verificare_stingator','Verificare tehnică stingător',12,'luni',date '2006-10-01','SR EN 3 / OMAI — DE VERIFICAT DE JURIST'),
    (p_org,'periodicitate_reincarcare_stingator','Reîncărcare stingător',36,'luni',date '2006-10-01','DE VERIFICAT DE JURIST'),
    (p_org,'periodicitate_proba_presiune_stingator','Probă de presiune stingător',60,'luni',date '2006-10-01','DE VERIFICAT DE JURIST'),
    (p_org,'periodicitate_medicina_muncii','Control medical periodic',12,'luni',date '2006-10-01','HG 355/2007 — DE VERIFICAT DE JURIST'),
    (p_org,'periodicitate_exercitiu_evacuare','Exercițiu de evacuare',6,'luni',date '2006-10-01','Legea 307/2006 — DE VERIFICAT DE JURIST'),
    (p_org,'periodicitate_verificare_iscir','Verificare tehnică periodică ISCIR',12,'luni',date '2010-01-01','Prescripții tehnice ISCIR — DE VERIFICAT DE JURIST'),
    (p_org,'durata_eip_implicita','Durata implicită de utilizare a EIP',12,'luni',date '2006-10-01','HG 1048/2006 — DE VERIFICAT DE JURIST'),
    (p_org,'zile_avertizare_scadenta','Preaviz implicit pentru scadențe SSM',30,'zile',date '2006-10-01','Politică internă')
  on conflict (organization_id, cod, valabil_de_la) where deleted_at is null do nothing;
end $$;

do $$ declare o record; begin
  for o in select id from public.organizations loop perform app.seed_ssm_defaults(o.id); end loop;
end $$;

create or replace function internal.ssm_seed_org() returns trigger
language plpgsql security definer set search_path = '' as $$
begin perform app.seed_ssm_defaults(new.id); return new; end $$;
create trigger organizations_ssm_seed after insert on public.organizations
  for each row execute function internal.ssm_seed_org();

-- ─────────  11. RLS, POLITICI, TRIGGERE DE ACTOR/AUDIT, DREPTURI  ─────────
do $$
declare r record; v_ang text;
begin
  for r in select * from (values
      ('ssm_legal_parameters','compliance','ssm', null::text),
      ('ssm_training_types','ssm','ssm', null),
      ('ssm_training_type_periods','ssm','ssm', null),
      ('ssm_trainings','ssm','ssm','employee_id'),
      ('risk_assessments','ssm','ssm', null),
      ('risk_assessment_items','ssm','ssm', null),
      ('prevention_plan_measures','ssm','ssm', null),
      ('work_accidents','ssm','ssm','employee_id'),
      ('dangerous_incidents','ssm','ssm', null),
      ('occupational_diseases','ssm','ssm', null),
      ('safety_committee_meetings','ssm','ssm', null),
      ('ppe_issuances','ssm','ssm','employee_id'),
      ('fire_extinguishers','ssm','ssm', null),
      ('fire_extinguisher_checks','ssm','ssm', null),
      ('evacuation_drills','ssm','ssm', null),
      ('hot_work_permits','ssm','ssm', null),
      ('environmental_permits','compliance','ssm', null),
      ('occupational_health_exams','ssm','ssm','employee_id'),
      ('employee_work_restrictions','ssm','ssm','employee_id'),
      ('equipment','maintenance','maintenance', null),
      ('equipment_meters','maintenance','maintenance', null),
      ('maintenance_plans','maintenance','maintenance', null),
      ('maintenance_interventions','maintenance','maintenance', null),
      ('fault_reports','maintenance','maintenance','raportat_de_employee_id'),
      ('iscir_authorizations','maintenance','maintenance', null),
      ('personnel_authorizations','ssm','ssm','employee_id')
    ) as t(tabel, resursa, feat, col)
  loop
    v_ang := coalesce(quote_ident(r.col), 'null::uuid');
    execute format('alter table public.%I add constraint %I foreign key (organization_id) references public.organizations(id) on delete restrict', r.tabel, r.tabel || '_org_fkey');
    execute format('create index %I on public.%I (organization_id) where deleted_at is null', r.tabel || '_org_idx', r.tabel);
    execute format('alter table public.%I enable row level security', r.tabel);
    execute format('alter table public.%I force row level security', r.tabel);
    execute format($f$create policy %1$s_select on public.%1$I for select to authenticated using (
      app.is_platform_admin() or (
        organization_id = any ((select app.current_org_ids())::uuid[])
        and app.feature_on(organization_id, %2$L)
        and app.ssm_acces(organization_id, %3$L, 'read', %4$s)))$f$, r.tabel, r.feat, r.resursa, v_ang);
    execute format($f$create policy %1$s_insert on public.%1$I for insert to authenticated with check (
      organization_id = any ((select app.current_org_ids())::uuid[])
      and app.feature_on(organization_id, %2$L)
      and app.ssm_acces(organization_id, %3$L, 'create', %4$s)
      and deleted_at is null)$f$, r.tabel, r.feat, r.resursa, v_ang);
    execute format($f$create policy %1$s_update on public.%1$I for update to authenticated using (
      app.is_platform_admin() or (
        organization_id = any ((select app.current_org_ids())::uuid[])
        and app.feature_on(organization_id, %2$L)
        and app.ssm_acces(organization_id, %3$L, 'update', %4$s)))
      with check (
        organization_id = any ((select app.current_org_ids())::uuid[])
        and app.feature_on(organization_id, %2$L)
        and app.ssm_acces(organization_id, %3$L, 'update', %4$s))$f$, r.tabel, r.feat, r.resursa, v_ang);
    execute format('create trigger %1$s_actor before insert or update on public.%1$I for each row execute function internal.set_actor()', r.tabel);
    perform internal.attach_audit(r.tabel);
    execute format('grant select, insert, update on public.%I to authenticated', r.tabel);
    execute format('revoke delete on public.%I from authenticated', r.tabel);
    execute format('revoke all on public.%I from anon', r.tabel);
  end loop;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'app.parametru_ssm(uuid,text,date)',
    'app.periodicitate_instruire(uuid,date)',
    'app.ssm_acces(uuid,text,text,uuid)',
    'app.poate_vedea_expirabil(uuid,text)',
    'app.aplica_restrictii_medicale_expirate(uuid)',
    'app.seed_ssm_defaults(uuid)']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
revoke all on function app.seed_ssm_defaults(uuid) from authenticated;
revoke all on all tables in schema internal from anon, authenticated;
