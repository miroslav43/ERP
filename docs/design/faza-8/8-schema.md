```sql
-- ============================================================================
-- 0012_fleet.sql — Faza 8: parcul auto (vehicule, documente, foi de parcurs)
-- ----------------------------------------------------------------------------
-- DECIZII care nu se citesc din cod:
--
-- 1. Documentele de vehicul NU se proiectează în `expirables` cu entity_id =
--    id-ul documentului, ci cu entity_id = ID-UL VEHICULULUI şi kind = codul
--    tipului de document. Motivul e reînnoirea: un RCA nou este un RÂND NOU în
--    `vehicle_documents`. Dacă fiecare rând ar fi un expirabil separat, poliţa
--    veche ar rămâne pe vecie în dashboard, roşie, lângă cea nouă. Cu
--    (vehicul, tip) drept identitate, reînnoirea REÎMPROSPĂTEAZĂ aceeaşi
--    scadenţă, iar `internal.sync_expirable()` închide singură alertele vechi.
--    UNIQUE(organization_id, entity_type, entity_id, kind) din 0008 rămâne
--    respectat, iar un vehicul are simultan itp, rca, rovinietă etc.
--
-- 2. `entity_type = 'vehicle_document'` este DEJA înregistrat în
--    app.poate_vedea_expirabil() (0008, ramura `when 'vehicle_document'`), deci
--    funcţia NU se rescrie aici — o rescriere ar risca să piardă ramurile
--    adăugate între timp. La finalul fişierului există o verificare care
--    avertizează dacă înregistrarea a dispărut.
--
-- 3. Regresul de kilometraj BLOCHEAZĂ, saltul doar AVERTIZEAZĂ. Nu e o
--    inconsecvenţă: un odometru nu poate da înapoi, deci un km de plecare mai
--    mic decât ultimul cunoscut este cu certitudine o eroare de introducere —
--    salvarea ei ar corupe toate rapoartele de consum. Un salt mare, în schimb,
--    are o explicaţie legitimă frecventă: o foaie de parcurs necompletată. A o
--    bloca ar împinge şoferul să falsifice cifra ca să poată salva.
-- ============================================================================

-- ============================================================
-- 1. TIPURI
-- ============================================================

create type public.vehicle_category as enum (
  'autoturism', 'autoutilitara', 'camion', 'autobuz', 'microbuz',
  'remorca', 'semiremorca', 'utilaj', 'motocicleta', 'altele'
);

create type public.fuel_type as enum (
  'benzina', 'motorina', 'gpl', 'gnc', 'electric', 'hibrid', 'hibrid_plugin', 'altul'
);

create type public.vehicle_status as enum ('activ', 'in_service', 'vandut', 'casat');

create type public.trip_sheet_status as enum ('draft', 'trimis', 'aprobat', 'respins');

create type public.odometer_anomaly_type as enum ('regres', 'salt');

-- ============================================================
-- 2. VEHICULE
-- ============================================================

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  nr_inmatriculare text not null,
  marca text not null,
  model text not null,
  vin text,
  categorie public.vehicle_category not null default 'autoturism',
  tip_combustibil public.fuel_type not null default 'motorina',
  an_fabricatie smallint,
  culoare text,
  capacitate_cilindrica integer,
  masa_maxima_kg integer,
  numar_locuri smallint,
  -- Litri/100 km declaraţi de producător sau normaţi intern. Baza de comparaţie
  -- pentru consumul real calculat din `fuel_entries`.
  consum_mediu_declarat numeric(6,2),
  km_curent integer not null default 0,
  -- Alocarea: unui om SAU unui departament. Ambele opţionale — o maşină de pool
  -- nu are şofer nominal, iar vizibilitatea la scope 'own'/'team' se face pe şofer.
  employee_id uuid references public.employees (id) on delete set null,
  department_id uuid references public.departments (id) on delete set null,
  status public.vehicle_status not null default 'activ',
  data_achizitie date,
  valoare_achizitie numeric(14,2),
  data_iesire date,
  motiv_iesire text,
  -- Prag peste care un salt de kilometraj devine anomalie. NULL = implicitul
  -- operaţional din internal.flota_prag_salt_km(). Pe cap tractor 1.500 km e
  -- normal între două foi, pe o maşină de oraş e un semnal.
  prag_salt_km integer,
  observatii text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint vehicles_nr_len check (char_length(nr_inmatriculare) between 3 and 16),
  constraint vehicles_marca_len check (char_length(marca) between 1 and 60),
  constraint vehicles_model_len check (char_length(model) between 1 and 60),
  constraint vehicles_vin_format check (vin is null or vin ~ '^[A-HJ-NPR-Z0-9]{11,17}$'),
  constraint vehicles_an_ck check (an_fabricatie is null or an_fabricatie between 1900 and 2200),
  constraint vehicles_km_ck check (km_curent >= 0),
  constraint vehicles_consum_ck check (consum_mediu_declarat is null or consum_mediu_declarat between 0 and 300),
  constraint vehicles_valoare_ck check (valoare_achizitie is null or valoare_achizitie >= 0),
  constraint vehicles_prag_ck check (prag_salt_km is null or prag_salt_km between 10 and 100000),
  constraint vehicles_motiv_len check (motiv_iesire is null or char_length(motiv_iesire) <= 500)
);

create unique index vehicles_org_nr_uq
  on public.vehicles (organization_id, nr_inmatriculare)
  where deleted_at is null;
create unique index vehicles_org_vin_uq
  on public.vehicles (organization_id, vin)
  where vin is not null and deleted_at is null;
create index vehicles_org_status_idx on public.vehicles (organization_id, status) where deleted_at is null;
create index vehicles_sofer_idx on public.vehicles (organization_id, employee_id) where deleted_at is null and employee_id is not null;
create index vehicles_departament_idx on public.vehicles (organization_id, department_id) where deleted_at is null and department_id is not null;

comment on column public.vehicles.km_curent is
  'Kilometrajul de referinţă al vehiculului. Se ridică automat la aprobarea unei foi de parcurs; nu scade niciodată.';

-- ============================================================
-- 3. NOMENCLATOR DE TIPURI DE DOCUMENTE (nu enum)
-- ============================================================
-- Un enum ar însemna o migrare de PLATFORMĂ la primul client de transport care
-- cere „licenţă de transport" şi „copie conformă". Nomenclatorul are rânduri de
-- platformă (organization_id NULL) plus rânduri proprii fiecărei firme.
-- `cod` respectă tiparul cerut de expirables.kind: devine direct `kind`.

create table public.vehicle_document_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  cod text not null,
  denumire text not null,
  descriere text,
  cere_expirare boolean not null default true,
  obligatoriu boolean not null default false,
  ordine smallint not null default 100,
  activ boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  -- Tiparul e identic cu expirables_kind_ck din 0008: dacă un cod trece de aici,
  -- sincronizarea scadenţei nu poate eşua pe validarea lui `kind`.
  constraint vdt_cod_ck check (cod ~ '^[a-z][a-z0-9_]{1,48}$'),
  constraint vdt_denumire_len check (char_length(denumire) between 2 and 120)
);

create unique index vdt_platforma_cod_uq
  on public.vehicle_document_types (cod)
  where organization_id is null and deleted_at is null;
create unique index vdt_org_cod_uq
  on public.vehicle_document_types (organization_id, cod)
  where organization_id is not null and deleted_at is null;

-- ============================================================
-- 4. DOCUMENTE DE VEHICUL
-- ============================================================

create table public.vehicle_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  document_type_id uuid not null references public.vehicle_document_types (id) on delete restrict,
  numar text,
  emitent text,
  valabil_de_la date,
  expira_la date,
  cost numeric(14,2),
  fisier_path text,
  fisier_nume text,
  fisier_checksum text,
  este_curent boolean not null default false,
  observatii text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint vdoc_perioada_ck check (expira_la is null or valabil_de_la is null or expira_la >= valabil_de_la),
  constraint vdoc_cost_ck check (cost is null or cost >= 0),
  constraint vdoc_numar_len check (numar is null or char_length(numar) <= 80)
);

-- REÎNNOIREA TREBUIE SĂ FIE POSIBILĂ. Un EXCLUDE pe suprapunerea perioadelor ar
-- refuza exact practica normală: RCA-ul nou se cumpără cu 2-3 săptămâni înainte
-- să expire cel vechi, deci perioadele se suprapun întotdeauna. Unicitatea se
-- aplică doar documentului CURENT, iar „curent" îl decide triggerul de mai jos.
create unique index vdoc_curent_uq
  on public.vehicle_documents (organization_id, vehicle_id, document_type_id)
  where este_curent and deleted_at is null;

create index vdoc_vehicul_idx on public.vehicle_documents (vehicle_id, document_type_id, expira_la desc) where deleted_at is null;
create index vdoc_org_expira_idx on public.vehicle_documents (organization_id, expira_la) where deleted_at is null and expira_la is not null;

comment on column public.vehicle_documents.este_curent is
  'Câmp CALCULAT, întreţinut de internal.flota_sincronizeaza_grup(). Curent = documentul cu expira_la MAXIM, nu ultimul introdus: o poliţă înregistrată retroactiv nu trebuie să dea afară poliţa validă.';

-- ============================================================
-- 5. FOI DE PARCURS
-- ============================================================

create table public.trip_sheets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete restrict,
  employee_id uuid not null references public.employees (id) on delete restrict,
  numar text,
  plecare_la timestamptz not null,
  sosire_la timestamptz,
  km_plecare integer not null,
  km_sosire integer,
  km_parcursi integer generated always as (km_sosire - km_plecare) stored,
  traseu text,
  scop text,
  status public.trip_sheet_status not null default 'draft',
  trimis_la timestamptz,
  aprobat_de uuid references auth.users (id) on delete set null,
  aprobat_la timestamptz,
  motiv_respingere text,
  observatii text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint ts_km_plecare_ck check (km_plecare >= 0),
  constraint ts_km_sosire_ck check (km_sosire is null or km_sosire >= 0),
  constraint ts_traseu_len check (traseu is null or char_length(traseu) <= 1000),
  constraint ts_motiv_len check (motiv_respingere is null or char_length(motiv_respingere) <= 500)
);

create unique index ts_org_numar_uq
  on public.trip_sheets (organization_id, numar)
  where numar is not null and deleted_at is null;
create index ts_vehicul_idx on public.trip_sheets (vehicle_id, plecare_la desc) where deleted_at is null;
create index ts_sofer_idx on public.trip_sheets (organization_id, employee_id, plecare_la desc) where deleted_at is null;
create index ts_status_idx on public.trip_sheets (organization_id, status, plecare_la desc) where deleted_at is null;
-- Susţine căutarea ultimului kilometraj aprobat, apelată la fiecare salvare.
create index ts_ultim_km_idx on public.trip_sheets (vehicle_id, km_sosire desc) where deleted_at is null and status = 'aprobat' and km_sosire is not null;

-- ============================================================
-- 6. ALIMENTĂRI
-- ============================================================

create table public.fuel_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  trip_sheet_id uuid not null references public.trip_sheets (id) on delete cascade,
  litri numeric(10,2) not null,
  cost numeric(14,2) not null,
  -- Preţul unitar se DEDUCE, nu se introduce: două câmpuri independente ar
  -- diverge la prima corecţie de bon. `litri > 0` face împărţirea sigură.
  pret_litru numeric(12,4) generated always as (round(cost / litri, 4)) stored,
  statie text,
  numar_bon text,
  fisier_bon_path text,
  alimentat_la timestamptz not null,
  plin boolean not null default false,
  observatii text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint fuel_litri_ck check (litri > 0 and litri <= 5000),
  constraint fuel_cost_ck check (cost >= 0),
  constraint fuel_bon_len check (numar_bon is null or char_length(numar_bon) <= 60)
);

-- Acelaşi bon nu se decontează de două ori pe aceeaşi foaie. Numerele de bon se
-- repetă legitim între staţii, deci unicitatea NU e la nivel de organizaţie.
create unique index fuel_bon_uq
  on public.fuel_entries (trip_sheet_id, lower(numar_bon))
  where numar_bon is not null and deleted_at is null;
create index fuel_foaie_idx on public.fuel_entries (trip_sheet_id, alimentat_la desc) where deleted_at is null;
create index fuel_org_data_idx on public.fuel_entries (organization_id, alimentat_la desc) where deleted_at is null;

-- ============================================================
-- 7. ANOMALII DE KILOMETRAJ
-- ============================================================

create table public.odometer_anomalies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  trip_sheet_id uuid references public.trip_sheets (id) on delete set null,
  km_asteptat integer not null,
  km_declarat integer not null,
  diferenta integer generated always as (km_declarat - km_asteptat) stored,
  tip public.odometer_anomaly_type not null,
  explicatie text,
  confirmat_de uuid references auth.users (id) on delete set null,
  confirmat_la timestamptz,
  nota text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint anom_km_ck check (km_asteptat >= 0 and km_declarat >= 0),
  constraint anom_nota_len check (nota is null or char_length(nota) <= 1000)
);

-- O foaie generează cel mult o anomalie de fiecare tip: garanţia pe care se
-- sprijină `on conflict do nothing` din trigger, ca o re-salvare să nu umple
-- lista cu duplicate.
create unique index anom_foaie_uq
  on public.odometer_anomalies (trip_sheet_id, tip)
  where trip_sheet_id is not null and deleted_at is null;
create index anom_vehicul_idx on public.odometer_anomalies (organization_id, vehicle_id, created_at desc) where deleted_at is null;
create index anom_neconfirmate_idx on public.odometer_anomalies (organization_id, created_at desc) where deleted_at is null and confirmat_la is null;

-- ============================================================
-- 8. updated_at (funcţia există din 0008)
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array[
    'vehicles', 'vehicle_document_types', 'vehicle_documents',
    'trip_sheets', 'fuel_entries', 'odometer_anomalies'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function internal.seteaza_updated_at()',
      t || '_set_updated_at', t);
  end loop;
end
$$;

-- ============================================================
-- 9. LOGICA DE FLOTĂ
-- ============================================================

create or replace function internal.flota_prag_salt_km()
returns integer language sql immutable set search_path = '' as $$
  select 1500;
$$;

comment on function internal.flota_prag_salt_km() is
  'Prag operaţional implicit pentru saltul de kilometraj, într-un singur loc. Se suprascrie per vehicul din vehicles.prag_salt_km.';

-- ── Normalizarea numărului de înmatriculare ─────────────────────────────────
-- „B 100 XYZ", „b-100-xyz" şi „B100XYZ" sunt acelaşi vehicul. Fără normalizare,
-- indexul unic le acceptă pe toate trei şi flota are trei maşini în loc de una.
create or replace function internal.vehicles_normalizeaza()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.nr_inmatriculare := upper(pg_catalog.regexp_replace(coalesce(new.nr_inmatriculare, ''), '[^A-Za-z0-9]', '', 'g'));
  if char_length(new.nr_inmatriculare) < 3 then
    raise exception using errcode = 'P0001',
      message = 'Numărul de înmatriculare este prea scurt. Introduceţi-l în forma B100XYZ.';
  end if;
  if new.vin is not null then
    new.vin := upper(pg_catalog.regexp_replace(new.vin, '[^A-Za-z0-9]', '', 'g'));
  end if;
  if new.status in ('vandut', 'casat') and new.data_iesire is null then
    new.data_iesire := app.azi_local();
  end if;
  if new.status not in ('vandut', 'casat') then
    new.data_iesire := null;
    new.motiv_iesire := null;
  end if;
  if new.employee_id is not null and not exists (
    select 1 from public.employees e
     where e.id = new.employee_id and e.organization_id = new.organization_id and e.deleted_at is null
  ) then
    raise exception using errcode = 'P0001',
      message = 'Angajatul ales pentru vehicul nu aparţine organizaţiei dumneavoastră.';
  end if;
  return new;
end;
$$;

create trigger vehicles_normalizeaza
  before insert or update on public.vehicles
  for each row execute function internal.vehicles_normalizeaza();

-- ── Normalizarea codului din nomenclator ────────────────────────────────────
create or replace function internal.vdt_normalizeaza()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.cod := pg_catalog.regexp_replace(
               pg_catalog.regexp_replace(lower(btrim(coalesce(new.cod, ''))), '[^a-z0-9]+', '_', 'g'),
               '^_+|_+$', '', 'g');
  return new;
end;
$$;

create trigger vdt_normalizeaza
  before insert or update on public.vehicle_document_types
  for each row execute function internal.vdt_normalizeaza();

-- ── Recalcularea documentului curent + proiecţia scadenţei ──────────────────
create or replace function internal.flota_sincronizeaza_grup(
  p_organization_id uuid,
  p_vehicle_id uuid,
  p_document_type_id uuid
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_curent  public.vehicle_documents%rowtype;
  v_vehicul public.vehicles%rowtype;
  v_cod     text;
  v_denumire text;
begin
  select * into v_vehicul from public.vehicles v where v.id = p_vehicle_id;
  if not found then return; end if;

  select t.cod, t.denumire into v_cod, v_denumire
    from public.vehicle_document_types t where t.id = p_document_type_id;
  if v_cod is null then return; end if;

  -- Curent = expira_la MAXIM. Reînnoirea făcută cu trei săptămâni înainte devine
  -- imediat documentul curent, fără ca cineva să bifeze ceva manual.
  select * into v_curent
    from public.vehicle_documents d
   where d.organization_id = p_organization_id
     and d.vehicle_id = p_vehicle_id
     and d.document_type_id = p_document_type_id
     and d.deleted_at is null
   order by d.expira_la desc nulls last, d.valabil_de_la desc nulls last, d.created_at desc
   limit 1;

  -- Steagul opreşte recursia: UPDATE-urile de mai jos trec prin acelaşi trigger.
  perform pg_catalog.set_config('app.flota_recalcul', 'on', true);

  -- Două instrucţiuni, nu una: indexul unic parţial nu e amânabil, iar o singură
  -- instrucţiune care mută adevărul de pe un rând pe altul poate ciocni tranzitoriu.
  update public.vehicle_documents d
     set este_curent = false, updated_at = now()
   where d.organization_id = p_organization_id
     and d.vehicle_id = p_vehicle_id
     and d.document_type_id = p_document_type_id
     and d.deleted_at is null
     and d.este_curent
     and (v_curent.id is null or d.id <> v_curent.id);

  if v_curent.id is not null and not v_curent.este_curent then
    update public.vehicle_documents set este_curent = true, updated_at = now()
     where id = v_curent.id;
  end if;

  perform pg_catalog.set_config('app.flota_recalcul', 'off', true);

  -- Motorul din 0008. p_expires_at NULL (niciun document activ) => scadenţa
  -- dispare logic şi alertele deschise se închid — nu ştergem istoricul.
  -- La vânzare/casare rămâne, dar cu is_active = false.
  perform internal.sync_expirable(
    p_organization_id,
    'vehicle_document',
    p_vehicle_id,
    v_cod,
    coalesce(v_denumire, v_cod) || ' — ' || coalesce(v_vehicul.nr_inmatriculare, '?'),
    case when v_curent.id is null then null else v_curent.expira_la end,
    'vehicle_documents',
    v_vehicul.employee_id,
    (v_vehicul.deleted_at is null and v_vehicul.status in ('activ', 'in_service'))
  );
end;
$$;

create or replace function internal.vdoc_inainte()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  select v.organization_id into v_org from public.vehicles v
   where v.id = new.vehicle_id and v.deleted_at is null;
  if v_org is null or v_org <> new.organization_id then
    raise exception using errcode = 'P0001',
      message = 'Vehiculul selectat nu aparţine organizaţiei dumneavoastră.';
  end if;

  if not exists (
    select 1 from public.vehicle_document_types t
     where t.id = new.document_type_id and t.deleted_at is null and t.activ
       and (t.organization_id is null or t.organization_id = new.organization_id)
  ) then
    raise exception using errcode = 'P0001',
      message = 'Tipul de document ales nu este disponibil sau a fost dezactivat.';
  end if;

  -- `este_curent` este calculat. În afara recalculării, valoarea trimisă de
  -- client se ignoră tăcut: nu e o tentativă de fraudă, e un câmp pe care
  -- interfaţa nu ar trebui să îl trimită.
  if coalesce(pg_catalog.current_setting('app.flota_recalcul', true), 'off') <> 'on' then
    if tg_op = 'INSERT' then
      new.este_curent := false;
    else
      new.este_curent := old.este_curent;
    end if;
  end if;
  return new;
end;
$$;

create or replace function internal.vdoc_dupa()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(pg_catalog.current_setting('app.flota_recalcul', true), 'off') = 'on' then
    return null;
  end if;
  perform internal.flota_sincronizeaza_grup(new.organization_id, new.vehicle_id, new.document_type_id);
  if tg_op = 'UPDATE'
     and (old.vehicle_id, old.document_type_id) is distinct from (new.vehicle_id, new.document_type_id) then
    perform internal.flota_sincronizeaza_grup(old.organization_id, old.vehicle_id, old.document_type_id);
  end if;
  return null;
end;
$$;

create trigger vdoc_inainte before insert or update on public.vehicle_documents
  for each row execute function internal.vdoc_inainte();
create trigger vdoc_dupa after insert or update on public.vehicle_documents
  for each row execute function internal.vdoc_dupa();

-- ── Vehicul vândut/casat => scadenţele lui ies din semafor, nu din istorie ──
create or replace function internal.flota_resincronizeaza_vehicul(p_vehicle_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare r record; v_n integer := 0;
begin
  for r in
    select distinct d.organization_id, d.vehicle_id, d.document_type_id
      from public.vehicle_documents d
     where d.vehicle_id = p_vehicle_id and d.deleted_at is null
  loop
    perform internal.flota_sincronizeaza_grup(r.organization_id, r.vehicle_id, r.document_type_id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

create or replace function internal.vehicles_dupa()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (old.status, old.deleted_at, old.employee_id, old.nr_inmatriculare)
     is distinct from (new.status, new.deleted_at, new.employee_id, new.nr_inmatriculare) then
    perform internal.flota_resincronizeaza_vehicul(new.id);
  end if;
  return null;
end;
$$;

create trigger vehicles_dupa after update on public.vehicles
  for each row execute function internal.vehicles_dupa();

-- ── Foi de parcurs: validări care depind de ALTE rânduri ────────────────────
create or replace function internal.foi_parcurs_inainte()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_vehicul public.vehicles%rowtype;
  v_ultim   integer;
begin
  select * into v_vehicul from public.vehicles v
   where v.id = new.vehicle_id and v.deleted_at is null;
  if not found or v_vehicul.organization_id <> new.organization_id then
    raise exception using errcode = 'P0001',
      message = 'Vehiculul selectat nu aparţine organizaţiei dumneavoastră.';
  end if;
  if not exists (
    select 1 from public.employees e
     where e.id = new.employee_id and e.organization_id = new.organization_id and e.deleted_at is null
  ) then
    raise exception using errcode = 'P0001',
      message = 'Şoferul selectat nu aparţine organizaţiei dumneavoastră.';
  end if;
  if tg_op = 'INSERT' and v_vehicul.status in ('vandut', 'casat') then
    raise exception using errcode = 'P0001',
      message = 'Vehiculul este ieşit din parc (vândut sau casat). Nu se mai pot întocmi foi de parcurs pentru el.';
  end if;

  -- O foaie aprobată este un document justificativ: cifrele ei nu se mai ating.
  if tg_op = 'UPDATE' and old.status = 'aprobat' and new.deleted_at is null
     and (old.vehicle_id, old.employee_id, old.plecare_la, old.sosire_la, old.km_plecare, old.km_sosire)
         is distinct from (new.vehicle_id, new.employee_id, new.plecare_la, new.sosire_la, new.km_plecare, new.km_sosire) then
    raise exception using errcode = 'P0001',
      message = 'Foaia de parcurs este aprobată. Pentru corecţii, stornaţi-o şi întocmiţi una nouă.';
  end if;

  select max(t.km_sosire) into v_ultim
    from public.trip_sheets t
   where t.vehicle_id = new.vehicle_id
     and t.deleted_at is null
     and t.status = 'aprobat'
     and t.km_sosire is not null
     and (tg_op = 'INSERT' or t.id <> new.id);
  v_ultim := greatest(coalesce(v_ultim, 0), coalesce(v_vehicul.km_curent, 0));

  -- Prepopulare: şoferul nu trebuie să caute cifra de pe foaia precedentă.
  if new.km_plecare is null then
    new.km_plecare := v_ultim;
  end if;

  -- REGRES = imposibil fizic => refuz. (Saltul se tratează în triggerul AFTER.)
  if new.km_plecare < v_ultim then
    raise exception using errcode = 'P0001',
      message = format('Kilometrajul de plecare (%s km) este mai mic decât ultimul kilometraj cunoscut al vehiculului (%s km). Un odometru nu poate da înapoi: verificaţi cifra introdusă sau corectaţi foaia de parcurs anterioară.',
                       new.km_plecare, v_ultim);
  end if;

  if new.km_sosire is not null and new.km_sosire <= new.km_plecare then
    raise exception using errcode = 'P0001',
      message = 'Kilometrajul de sosire trebuie să fie mai mare decât cel de plecare.';
  end if;
  if new.sosire_la is not null and new.sosire_la <= new.plecare_la then
    raise exception using errcode = 'P0001',
      message = 'Ora de sosire trebuie să fie după ora de plecare.';
  end if;

  if tg_op = 'UPDATE' and new.status <> old.status then
    if not (
      (old.status = 'draft'   and new.status = 'trimis')
      or (old.status = 'trimis'  and new.status in ('aprobat', 'respins', 'draft'))
      or (old.status = 'respins' and new.status = 'draft')
    ) then
      raise exception using errcode = 'P0001',
        message = format('Nu se poate trece foaia de parcurs din starea „%s" în starea „%s".', old.status, new.status);
    end if;

    if new.status in ('trimis', 'aprobat') and (new.km_sosire is null or new.sosire_la is null) then
      raise exception using errcode = 'P0001',
        message = 'Completaţi ora şi kilometrajul de sosire înainte de a trimite foaia spre aprobare.';
    end if;

    if new.status = 'trimis' then new.trimis_la := now(); end if;

    if new.status = 'aprobat' then
      -- Aprobarea nu se poate forja din payload: dreptul se verifică aici, iar
      -- semnătura se pune din sesiune.
      if not app.is_service_context() then
        if not app.can(new.organization_id, 'trip_sheets', 'approve', 'team') then
          raise exception using errcode = 'P0001',
            message = 'Nu aveţi dreptul de a aproba foi de parcurs.';
        end if;
        if new.employee_id = app.current_employee_id(new.organization_id)
           and app.has_permission(new.organization_id, 'trip_sheets', 'approve') <> 'all' then
          raise exception using errcode = 'P0001',
            message = 'Nu vă puteţi aproba singur propria foaie de parcurs.';
        end if;
        new.aprobat_de := (select auth.uid());
      end if;
      new.aprobat_la := now();
    else
      new.aprobat_de := null;
      new.aprobat_la := null;
    end if;

    if new.status = 'respins' and coalesce(btrim(new.motiv_respingere), '') = '' then
      raise exception using errcode = 'P0001',
        message = 'Precizaţi motivul respingerii, ca şoferul să ştie ce are de corectat.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function internal.foi_parcurs_dupa()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_baza integer;
  v_prag integer;
begin
  select greatest(
           coalesce((select max(t.km_sosire) from public.trip_sheets t
                      where t.vehicle_id = new.vehicle_id and t.deleted_at is null
                        and t.status = 'aprobat' and t.km_sosire is not null and t.id <> new.id), 0),
           coalesce((select v.km_curent from public.vehicles v where v.id = new.vehicle_id), 0)),
         coalesce((select v.prag_salt_km from public.vehicles v where v.id = new.vehicle_id),
                  internal.flota_prag_salt_km())
    into v_baza, v_prag;

  -- SALT: nu blocăm. Cauza cea mai frecventă e o foaie de parcurs necompletată,
  -- iar un refuz ar împinge şoferul să scrie o cifră falsă ca să poată salva.
  -- Semnalăm şi lăsăm un om să decidă.
  if v_baza > 0 and new.km_plecare - v_baza > v_prag then
    insert into public.odometer_anomalies
      (organization_id, vehicle_id, trip_sheet_id, km_asteptat, km_declarat, tip, explicatie)
    values
      (new.organization_id, new.vehicle_id, new.id, v_baza, new.km_plecare, 'salt',
       'Diferenţă între kilometrajul de plecare declarat şi ultimul kilometraj cunoscut. Verificaţi dacă lipseşte o foaie de parcurs.')
    on conflict (trip_sheet_id, tip) where trip_sheet_id is not null and deleted_at is null
    do nothing;
  end if;

  if new.status = 'aprobat' and new.km_sosire is not null then
    update public.vehicles v
       set km_curent = new.km_sosire, updated_at = now()
     where v.id = new.vehicle_id and coalesce(v.km_curent, 0) < new.km_sosire;
  end if;
  return null;
end;
$$;

create trigger foi_parcurs_inainte before insert or update on public.trip_sheets
  for each row execute function internal.foi_parcurs_inainte();
create trigger foi_parcurs_dupa after insert or update on public.trip_sheets
  for each row execute function internal.foi_parcurs_dupa();

-- ── Alimentări ─────────────────────────────────────────────────────────────
create or replace function internal.alimentari_inainte()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_foaie public.trip_sheets%rowtype;
begin
  select * into v_foaie from public.trip_sheets t
   where t.id = new.trip_sheet_id and t.deleted_at is null;
  if not found or v_foaie.organization_id <> new.organization_id then
    raise exception using errcode = 'P0001',
      message = 'Foaia de parcurs selectată nu aparţine organizaţiei dumneavoastră.';
  end if;
  if v_foaie.status in ('aprobat', 'respins') and new.deleted_at is null then
    raise exception using errcode = 'P0001',
      message = 'Foaia de parcurs nu mai este în lucru. Alimentările nu se mai pot modifica după aprobare sau respingere.';
  end if;
  if new.alimentat_la < v_foaie.plecare_la
     or (v_foaie.sosire_la is not null and new.alimentat_la > v_foaie.sosire_la) then
    raise exception using errcode = 'P0001',
      message = 'Data alimentării este în afara intervalului foii de parcurs.';
  end if;
  return new;
end;
$$;

create trigger alimentari_inainte before insert or update on public.fuel_entries
  for each row execute function internal.alimentari_inainte();

-- ── Anomalii: doar confirmarea se editează ─────────────────────────────────
create or replace function internal.anomalii_protejeaza()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (old.organization_id, old.vehicle_id, old.trip_sheet_id, old.km_asteptat, old.km_declarat, old.tip)
     is distinct from
     (new.organization_id, new.vehicle_id, new.trip_sheet_id, new.km_asteptat, new.km_declarat, new.tip) then
    raise exception using errcode = 'P0001',
      message = 'Datele constatate ale anomaliei nu se pot modifica. Puteţi doar să o confirmaţi şi să adăugaţi o notă.';
  end if;
  if new.confirmat_la is not null and old.confirmat_la is null then
    new.confirmat_de := coalesce((select auth.uid()), new.confirmat_de);
  end if;
  return new;
end;
$$;

create trigger anomalii_protejeaza before update on public.odometer_anomalies
  for each row execute function internal.anomalii_protejeaza();

-- ============================================================
-- 10. RLS
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array[
    'vehicles', 'vehicle_document_types', 'vehicle_documents',
    'trip_sheets', 'fuel_entries', 'odometer_anomalies'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end
$$;

-- Regula de scope trăieşte într-un singur loc şi se aplică identic vehiculului,
-- documentelor lui şi anomaliilor lui.
create or replace function app.poate_vedea_vehicul(p_organization_id uuid, p_sofer_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case app.has_permission(p_organization_id, 'vehicles', 'read')
    when 'all'  then true
    when 'team' then p_sofer_id is not null
                     and (p_sofer_id = app.current_employee_id(p_organization_id)
                          or app.is_manager_of(p_organization_id, p_sofer_id))
    when 'own'  then p_sofer_id is not null
                     and p_sofer_id = app.current_employee_id(p_organization_id)
    else false
  end;
$$;

create or replace function app.vehicul_sofer(p_vehicle_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select v.employee_id from public.vehicles v where v.id = p_vehicle_id;
$$;

create or replace function app.poate_vedea_foaie(p_organization_id uuid, p_sofer_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case app.has_permission(p_organization_id, 'trip_sheets', 'read')
    when 'all'  then true
    when 'team' then p_sofer_id is not null
                     and (p_sofer_id = app.current_employee_id(p_organization_id)
                          or app.is_manager_of(p_organization_id, p_sofer_id))
    when 'own'  then p_sofer_id is not null
                     and p_sofer_id = app.current_employee_id(p_organization_id)
    else false
  end;
$$;

create or replace function app.foaie_sofer(p_trip_sheet_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select t.employee_id from public.trip_sheets t where t.id = p_trip_sheet_id;
$$;

revoke all on function app.poate_vedea_vehicul(uuid, uuid) from public, anon;
revoke all on function app.vehicul_sofer(uuid) from public, anon;
revoke all on function app.poate_vedea_foaie(uuid, uuid) from public, anon;
revoke all on function app.foaie_sofer(uuid) from public, anon;
grant execute on function app.poate_vedea_vehicul(uuid, uuid) to authenticated;
grant execute on function app.vehicul_sofer(uuid) to authenticated;
grant execute on function app.poate_vedea_foaie(uuid, uuid) to authenticated;
grant execute on function app.foaie_sofer(uuid) to authenticated;

-- --- vehicles ---------------------------------------------------------------
create policy vehicule_select on public.vehicles
  for select to authenticated
  using (
    deleted_at is null
    and (
      (select app.is_platform_admin())
      or (
        organization_id = any ((select app.current_org_ids())::uuid[])
        and app.feature_on(organization_id, 'fleet')
        and app.poate_vedea_vehicul(organization_id, employee_id)
      )
    )
  );

create policy vehicule_insert on public.vehicles
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.has_permission(organization_id, 'vehicles', 'create') = 'all'
    and deleted_at is null
    and status = 'activ'          -- starea iniţială e fixată, nu aleasă
    and data_iesire is null
    and motiv_iesire is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy vehicule_update on public.vehicles
  for update to authenticated
  using (
    deleted_at is null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
    and updated_by = (select auth.uid())
  );

-- --- vehicle_document_types -------------------------------------------------
-- Rândurile de platformă (organization_id NULL) sunt un nomenclator public: nu
-- conţin date de firmă, deci nu au ce să scurgă.
create policy vdt_select on public.vehicle_document_types
  for select to authenticated
  using (
    deleted_at is null
    and (
      organization_id is null
      or (
        organization_id = any ((select app.current_org_ids())::uuid[])
        and app.feature_on(organization_id, 'fleet')
        and app.can(organization_id, 'vehicles', 'read', 'own')
      )
    )
  );

create policy vdt_insert on public.vehicle_document_types
  for insert to authenticated
  with check (
    organization_id is not null           -- tipurile de platformă nu se creează din aplicaţie
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.has_permission(organization_id, 'vehicles', 'create') = 'all'
    and deleted_at is null
    and activ = true
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy vdt_update on public.vehicle_document_types
  for update to authenticated
  using (
    organization_id is not null
    and deleted_at is null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
  )
  with check (
    organization_id is not null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
    and updated_by = (select auth.uid())
  );

-- --- vehicle_documents ------------------------------------------------------
create policy vdoc_select on public.vehicle_documents
  for select to authenticated
  using (
    deleted_at is null
    and (
      (select app.is_platform_admin())
      or (
        organization_id = any ((select app.current_org_ids())::uuid[])
        and app.feature_on(organization_id, 'fleet')
        and app.poate_vedea_vehicul(organization_id, app.vehicul_sofer(vehicle_id))
      )
    )
  );

create policy vdoc_insert on public.vehicle_documents
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.has_permission(organization_id, 'vehicles', 'create') = 'all'
    and deleted_at is null
    and este_curent = false       -- câmp calculat: se zerofică la inserare
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy vdoc_update on public.vehicle_documents
  for update to authenticated
  using (
    deleted_at is null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
    and updated_by = (select auth.uid())
  );

-- --- trip_sheets ------------------------------------------------------------
create policy foi_select on public.trip_sheets
  for select to authenticated
  using (
    deleted_at is null
    and (
      (select app.is_platform_admin())
      or (
        organization_id = any ((select app.current_org_ids())::uuid[])
        and app.feature_on(organization_id, 'fleet')
        and app.poate_vedea_foaie(organization_id, employee_id)
      )
    )
  );

create policy foi_insert on public.trip_sheets
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.can(organization_id, 'trip_sheets', 'create', 'own')
    and app.poate_vedea_foaie(organization_id, employee_id)
    and deleted_at is null
    and status = 'draft'          -- nicio foaie nu se naşte aprobată
    and aprobat_de is null
    and aprobat_la is null
    and trimis_la is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy foi_update on public.trip_sheets
  for update to authenticated
  using (
    deleted_at is null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and (
      (app.can(organization_id, 'trip_sheets', 'update', 'own')
       and app.poate_vedea_foaie(organization_id, employee_id))
      or app.can(organization_id, 'trip_sheets', 'approve', 'team')
    )
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      (app.can(organization_id, 'trip_sheets', 'update', 'own')
       and app.poate_vedea_foaie(organization_id, employee_id))
      or app.can(organization_id, 'trip_sheets', 'approve', 'team')
    )
    and updated_by = (select auth.uid())
  );

-- --- fuel_entries -----------------------------------------------------------
create policy alimentari_select on public.fuel_entries
  for select to authenticated
  using (
    deleted_at is null
    and (
      (select app.is_platform_admin())
      or (
        organization_id = any ((select app.current_org_ids())::uuid[])
        and app.feature_on(organization_id, 'fleet')
        and app.poate_vedea_foaie(organization_id, app.foaie_sofer(trip_sheet_id))
      )
    )
  );

create policy alimentari_insert on public.fuel_entries
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.can(organization_id, 'trip_sheets', 'update', 'own')
    and app.poate_vedea_foaie(organization_id, app.foaie_sofer(trip_sheet_id))
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy alimentari_update on public.fuel_entries
  for update to authenticated
  using (
    deleted_at is null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.can(organization_id, 'trip_sheets', 'update', 'own')
    and app.poate_vedea_foaie(organization_id, app.foaie_sofer(trip_sheet_id))
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'trip_sheets', 'update', 'own')
    and updated_by = (select auth.uid())
  );

-- --- odometer_anomalies -----------------------------------------------------
create policy anomalii_select on public.odometer_anomalies
  for select to authenticated
  using (
    deleted_at is null
    and (
      (select app.is_platform_admin())
      or (
        organization_id = any ((select app.current_org_ids())::uuid[])
        and app.feature_on(organization_id, 'fleet')
        and app.poate_vedea_vehicul(organization_id, app.vehicul_sofer(vehicle_id))
      )
    )
  );

-- Anomaliile sunt CONSTATATE de motor, nu declarate de utilizator.
create policy anomalii_insert on public.odometer_anomalies
  for insert to authenticated
  with check (
    (select app.is_service_context())
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and confirmat_de is null
    and confirmat_la is null
  );

create policy anomalii_update on public.odometer_anomalies
  for update to authenticated
  using (
    deleted_at is null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.can(organization_id, 'vehicles', 'update', 'team')
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'vehicles', 'update', 'team')
  );

-- ============================================================
-- 11. DREPTURI. Soft delete peste tot: nicio politică DELETE, niciun grant.
-- ============================================================

revoke all on public.vehicles, public.vehicle_document_types, public.vehicle_documents,
              public.trip_sheets, public.fuel_entries, public.odometer_anomalies
  from anon, authenticated;

grant select, insert, update on public.vehicles               to authenticated;
grant select, insert, update on public.vehicle_document_types to authenticated;
grant select, insert, update on public.vehicle_documents      to authenticated;
grant select, insert, update on public.trip_sheets            to authenticated;
grant select, insert, update on public.fuel_entries           to authenticated;
grant select, insert, update on public.odometer_anomalies     to authenticated;

grant all on public.vehicles, public.vehicle_document_types, public.vehicle_documents,
             public.trip_sheets, public.fuel_entries, public.odometer_anomalies
  to service_role;

revoke all on function internal.flota_sincronizeaza_grup(uuid, uuid, uuid) from public;
revoke all on function internal.flota_resincronizeaza_vehicul(uuid) from public;
grant execute on function internal.flota_sincronizeaza_grup(uuid, uuid, uuid) to service_role;
grant execute on function internal.flota_resincronizeaza_vehicul(uuid) to service_role;

-- ============================================================
-- 12. AUDIT (garda R9 refuză singură orice coloană sensibilă)
-- ============================================================

select internal.attach_audit(t)
from unnest(array[
  'vehicles', 'vehicle_document_types', 'vehicle_documents',
  'trip_sheets', 'fuel_entries', 'odometer_anomalies'
]) t;

-- ============================================================
-- 13. SEED DE PLATFORMĂ PENTRU NOMENCLATOR
-- ============================================================

insert into public.vehicle_document_types (organization_id, cod, denumire, cere_expirare, obligatoriu, ordine)
values
  (null, 'itp',               'Inspecţie tehnică periodică (ITP)', true,  true,  10),
  (null, 'rca',               'Asigurare RCA',                     true,  true,  20),
  (null, 'casco',             'Asigurare CASCO',                   true,  false, 30),
  (null, 'rovinieta',         'Rovinietă',                         true,  true,  40),
  (null, 'revizie',           'Revizie tehnică',                   true,  false, 50),
  (null, 'extinctor',         'Stingător auto',                    true,  true,  60),
  (null, 'trusa_medicala',    'Trusă medicală',                    true,  true,  70),
  (null, 'licenta_transport', 'Licenţă de transport',              true,  false, 80),
  (null, 'copie_conforma',    'Copie conformă',                    true,  false, 90),
  (null, 'tahograf',          'Verificare tahograf',               true,  false, 100),
  (null, 'adr',               'Certificat ADR',                    true,  false, 110)
on conflict (cod) where organization_id is null and deleted_at is null do nothing;

-- ============================================================
-- 14. POPULARE INIŢIALĂ + UNEALTĂ DE REPARAŢIE
-- ============================================================
-- Nu doar triggerul pentru viitor: funcţia reproiectează TOATE documentele
-- existente. Rulează acum (la instalare, pe zero rânduri) şi rămâne disponibilă
-- pentru repornirea sincronizării după un import în masă.

create or replace function internal.flota_resincronizeaza_expirari(p_organization_id uuid default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare r record; v_n integer := 0;
begin
  for r in
    select distinct d.organization_id, d.vehicle_id, d.document_type_id
      from public.vehicle_documents d
     where d.deleted_at is null
       and (p_organization_id is null or d.organization_id = p_organization_id)
  loop
    perform internal.flota_sincronizeaza_grup(r.organization_id, r.vehicle_id, r.document_type_id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

revoke all on function internal.flota_resincronizeaza_expirari(uuid) from public;
grant execute on function internal.flota_resincronizeaza_expirari(uuid) to service_role;

select internal.flota_resincronizeaza_expirari();

-- Verificare, nu rescriere: app.poate_vedea_expirabil() înregistrează deja
-- 'vehicle_document' (0008). Dacă ramura dispare la o migrare viitoare,
-- scadenţele flotei devin INVIZIBILE (implicitul funcţiei e restrictiv) —
-- eşecul ar fi tăcut, aşa că îl facem zgomotos aici.
do $$
begin
  if not exists (
    select 1
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'app' and p.proname = 'poate_vedea_expirabil'
       and pg_catalog.pg_get_functiondef(p.oid) like '%vehicle_document%'
  ) then
    raise warning 'app.poate_vedea_expirabil() nu mai recunoaşte entity_type = ''vehicle_document''. Scadenţele de flotă vor fi invizibile în dashboardul de conformitate până la reînregistrare.';
  end if;
end
$$;

-- ============================================================================
-- SEMNALĂRI (lucruri care NU există încă şi trebuie livrate separat)
-- ----------------------------------------------------------------------------
-- 1. Bucket de stocare pentru `vehicle_documents.fisier_path` şi
--    `fuel_entries.fisier_bon_path`: în inventar nu apare niciun bucket şi
--    nicio politică `storage.objects`. Căile rămân simple `text`; politica de
--    acces la fişiere trebuie scrisă la fel ca vizibilitatea rândului.
-- 2. Numerotarea foilor de parcurs: `trip_sheets.numar` este liber şi unic per
--    organizaţie. Alocarea din `document_sequences` aparţine stratului de
--    acţiuni (nu există în inventar o funcţie SQL de alocare a următorului
--    număr, iar una nouă ar dubla logica existentă).
-- 3. Regulile de alertă implicite pentru `entity_type = 'vehicle_document'` nu
--    se seedează aici: `alert_rules` are deja sentinela '*' din 0008, iar
--    praguri specifice (de ex. RCA la 30/14/7) sunt o decizie de client, nu de
--    platformă.
-- ============================================================================
```