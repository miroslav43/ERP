-- supabase/migrations/0013_attendance.sql
-- Faza 3b — Pontaj. Se construiește peste 0008 (expirări) și 0009 (concedii, calendar, aprobări).
-- Pontajul CONSUMĂ concediile aprobate din 0009; nu-și face propriul calendar.
-- Fără geofencing, fără cartele: pontajul se completează și se aprobă.

---------------------------------------------------------------------------
-- 1. Tipuri
---------------------------------------------------------------------------

create type public.attendance_period_status as enum ('deschisa', 'in_aprobare', 'blocata');

create type public.attendance_day_type as enum (
  'lucratoare', 'weekend', 'sarbatoare', 'concediu', 'medical', 'absenta_nemotivata', 'delegatie'
);

create type public.attendance_entry_source as enum ('manuala', 'import', 'sincronizare_concedii');

create type public.holiday_compensation_type as enum ('zi_libera', 'spor');

---------------------------------------------------------------------------
-- 2. attendance_settings — parametri legali, cu istoric prin valabil_de_la.
--    Fără DEFAULT în DDL: nicio valoare legală nu trăiește în cod (S13).
---------------------------------------------------------------------------

create table public.attendance_settings (
  id                                  uuid primary key default gen_random_uuid(),
  organization_id                     uuid not null references public.organizations (id) on delete cascade,
  valabil_de_la                       date not null,
  ore_pe_zi                           numeric(5, 2) not null check (ore_pe_zi > 0 and ore_pe_zi <= 24),
  ore_pe_saptamana                    numeric(5, 2) not null check (ore_pe_saptamana > 0 and ore_pe_saptamana <= 168),
  ore_maxime_saptamanale              numeric(5, 2) not null check (ore_maxime_saptamanale > 0 and ore_maxime_saptamanale <= 168),
  perioada_referinta_luni             smallint not null check (perioada_referinta_luni between 1 and 12),
  repaus_zilnic_minim_ore             numeric(5, 2) not null check (repaus_zilnic_minim_ore between 0 and 24),
  repaus_saptamanal_minim_ore         numeric(5, 2) not null check (repaus_saptamanal_minim_ore between 0 and 168),
  spor_suplimentare_procent           numeric(6, 2) not null check (spor_suplimentare_procent >= 0),
  spor_noapte_procent                 numeric(6, 2) not null check (spor_noapte_procent >= 0),
  spor_weekend_procent                numeric(6, 2) not null check (spor_weekend_procent >= 0),
  spor_sarbatoare_procent             numeric(6, 2) not null check (spor_sarbatoare_procent >= 0),
  noapte_start                        time not null,
  noapte_sfarsit                      time not null,
  termen_compensare_suplimentare_zile smallint not null check (termen_compensare_suplimentare_zile > 0),
  termen_compensare_sarbatoare_zile   smallint not null check (termen_compensare_sarbatoare_zile > 0),
  pauza_masa_minute                   smallint not null check (pauza_masa_minute >= 0),
  pauza_masa_inclusa_in_program       boolean not null,
  pauza_obligatorie_peste_ore         numeric(5, 2) not null check (pauza_obligatorie_peste_ore >= 0),
  observatii_juridice                 text,
  created_at                          timestamptz not null default now(),
  updated_at                          timestamptz not null default now(),
  created_by                          uuid,
  updated_by                          uuid,
  deleted_at                          timestamptz
);

create unique index attendance_settings_valabilitate_uq
  on public.attendance_settings (organization_id, valabil_de_la) where deleted_at is null;

comment on table public.attendance_settings is
  'Parametri de pontaj, cu istoric. TOATE valorile de mai jos sunt DE VERIFICAT DE JURIST înainte de punerea în funcțiune.';
comment on column public.attendance_settings.ore_pe_zi is 'DE VERIFICAT DE JURIST — durata normală a zilei de muncă.';
comment on column public.attendance_settings.ore_pe_saptamana is 'DE VERIFICAT DE JURIST — durata normală săptămânală.';
comment on column public.attendance_settings.ore_maxime_saptamanale is 'DE VERIFICAT DE JURIST — plafonul săptămânal, suplimentare incluse.';
comment on column public.attendance_settings.perioada_referinta_luni is 'DE VERIFICAT DE JURIST — perioada de referință pe care se face media.';
comment on column public.attendance_settings.repaus_zilnic_minim_ore is 'DE VERIFICAT DE JURIST — repaus minim între două zile de muncă.';
comment on column public.attendance_settings.repaus_saptamanal_minim_ore is 'DE VERIFICAT DE JURIST — repaus săptămânal minim.';
comment on column public.attendance_settings.spor_suplimentare_procent is 'DE VERIFICAT DE JURIST — spor pentru ore suplimentare necompensate cu timp liber.';
comment on column public.attendance_settings.spor_noapte_procent is 'DE VERIFICAT DE JURIST — spor pentru muncă de noapte.';
comment on column public.attendance_settings.spor_weekend_procent is 'DE VERIFICAT DE JURIST — spor pentru muncă în zi de repaus săptămânal.';
comment on column public.attendance_settings.spor_sarbatoare_procent is 'DE VERIFICAT DE JURIST — spor pentru muncă în zi de sărbătoare legală.';
comment on column public.attendance_settings.noapte_start is 'DE VERIFICAT DE JURIST — începutul intervalului considerat noapte.';
comment on column public.attendance_settings.noapte_sfarsit is 'DE VERIFICAT DE JURIST — sfârșitul intervalului considerat noapte.';
comment on column public.attendance_settings.termen_compensare_suplimentare_zile is 'DE VERIFICAT DE JURIST — termenul de acordare a timpului liber compensator.';
comment on column public.attendance_settings.termen_compensare_sarbatoare_zile is 'DE VERIFICAT DE JURIST — termenul de acordare a zilei libere pentru sărbătoare legală.';
comment on column public.attendance_settings.pauza_masa_minute is 'DE VERIFICAT DE JURIST — durata pauzei de masă.';
comment on column public.attendance_settings.pauza_obligatorie_peste_ore is 'DE VERIFICAT DE JURIST — pragul de ore de la care pauza devine obligatorie.';

---------------------------------------------------------------------------
-- 3. attendance_periods — luna de pontaj. Blocarea perioadei ESTE aprobarea ei.
---------------------------------------------------------------------------

create table public.attendance_periods (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  an              smallint not null check (an between 2000 and 2100),
  luna            smallint not null check (luna between 1 and 12),
  data_inceput    date not null,
  data_sfarsit    date not null,
  status          public.attendance_period_status not null default 'deschisa',
  blocata_la      timestamptz,
  blocata_de      uuid,
  observatii      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid,
  updated_by      uuid,
  deleted_at      timestamptz,
  constraint attendance_periods_interval_ck check (data_sfarsit >= data_inceput)
);

create unique index attendance_periods_luna_uq
  on public.attendance_periods (organization_id, an, luna) where deleted_at is null;

---------------------------------------------------------------------------
-- 4. attendance_approval_batches — aprobarea în bloc (creată înaintea liniilor,
--    pentru că attendance_entries trimite către ea).
---------------------------------------------------------------------------

create table public.attendance_approval_batches (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations (id) on delete cascade,
  period_id            uuid not null references public.attendance_periods (id) on delete cascade,
  department_id        uuid references public.departments (id),
  manager_employee_id  uuid references public.employees (id),
  aprobat_de           uuid,
  aprobat_la           timestamptz not null default now(),
  linii_aprobate       integer not null default 0 check (linii_aprobate >= 0),
  observatii           text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  created_by           uuid,
  updated_by           uuid,
  deleted_at           timestamptz
);

create index attendance_approval_batches_perioada_idx
  on public.attendance_approval_batches (organization_id, period_id) where deleted_at is null;

---------------------------------------------------------------------------
-- 5. attendance_entries — o linie per angajat și per zi.
--    ore_lucrate = total prestat (suplimentarele incluse); ore_suplimentare =
--    partea peste normă; ore_noapte = partea din ore_lucrate în intervalul de noapte.
---------------------------------------------------------------------------

create table public.attendance_entries (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  period_id         uuid not null references public.attendance_periods (id) on delete restrict,
  employee_id       uuid not null references public.employees (id) on delete restrict,
  data              date not null,
  ora_inceput       time,
  ora_sfarsit       time,
  ore_lucrate       numeric(5, 2) not null default 0 check (ore_lucrate >= 0 and ore_lucrate <= 24),
  ore_suplimentare  numeric(5, 2) not null default 0 check (ore_suplimentare >= 0),
  ore_noapte        numeric(5, 2) not null default 0 check (ore_noapte >= 0),
  tip_zi            public.attendance_day_type not null,
  sursa             public.attendance_entry_source not null default 'manuala',
  leave_request_id  uuid references public.leave_requests (id) on delete set null,
  observatii        text,
  approved_at       timestamptz,
  approved_by       uuid,
  batch_id          uuid references public.attendance_approval_batches (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid,
  updated_by        uuid,
  deleted_at        timestamptz,
  constraint attendance_entries_suplimentare_ck check (ore_suplimentare <= ore_lucrate),
  constraint attendance_entries_noapte_ck check (ore_noapte <= ore_lucrate),
  constraint attendance_entries_sursa_concediu_ck
    check (sursa <> 'sincronizare_concedii' or leave_request_id is not null)
);

-- Cheia care asigură idempotența sincronizării cu concediile:
create unique index attendance_entries_zi_uq
  on public.attendance_entries (organization_id, employee_id, data) where deleted_at is null;

create index attendance_entries_perioada_idx
  on public.attendance_entries (organization_id, period_id) where deleted_at is null;
create index attendance_entries_concediu_idx
  on public.attendance_entries (organization_id, leave_request_id) where leave_request_id is not null;

---------------------------------------------------------------------------
-- 6. overtime_compensation — ore suplimentare compensate cu timp liber.
---------------------------------------------------------------------------

create table public.overtime_compensation (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  employee_id      uuid not null references public.employees (id) on delete restrict,
  entry_id         uuid references public.attendance_entries (id) on delete set null,
  data_generarii   date not null,
  ore              numeric(5, 2) not null check (ore > 0),
  termen_folosire  date not null,
  ore_folosite     numeric(5, 2) not null default 0 check (ore_folosite >= 0),
  ore_expirate     numeric(5, 2) not null default 0 check (ore_expirate >= 0),
  leave_request_id uuid references public.leave_requests (id) on delete set null,
  observatii       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid,
  updated_by       uuid,
  deleted_at       timestamptz,
  constraint overtime_compensation_sold_ck check (ore_folosite + ore_expirate <= ore),
  constraint overtime_compensation_termen_ck check (termen_folosire >= data_generarii)
);

create index overtime_compensation_angajat_idx
  on public.overtime_compensation (organization_id, employee_id, termen_folosire) where deleted_at is null;

---------------------------------------------------------------------------
-- 7. holiday_compensation — muncă în sărbătoare legală: zi liberă SAU spor.
---------------------------------------------------------------------------

create table public.holiday_compensation (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  employee_id      uuid not null references public.employees (id) on delete restrict,
  entry_id         uuid references public.attendance_entries (id) on delete set null,
  data_sarbatorii  date not null,
  ore_lucrate      numeric(5, 2) not null check (ore_lucrate > 0),
  tip              public.holiday_compensation_type not null default 'zi_libera',
  termen_acordare  date not null,
  data_zilei_libere date,
  spor_procent     numeric(6, 2) check (spor_procent >= 0),
  spor_valoare     numeric(14, 2) check (spor_valoare >= 0),
  acordata         boolean not null default false,
  acordata_la      timestamptz,
  observatii       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid,
  updated_by       uuid,
  deleted_at       timestamptz,
  constraint holiday_compensation_termen_ck check (termen_acordare >= data_sarbatorii),
  constraint holiday_compensation_forma_ck check (
    (tip = 'zi_libera' and spor_procent is null and spor_valoare is null)
    or (tip = 'spor' and data_zilei_libere is null)
  ),
  constraint holiday_compensation_zi_ck check (data_zilei_libere is null or data_zilei_libere >= data_sarbatorii)
);

create unique index holiday_compensation_zi_uq
  on public.holiday_compensation (organization_id, employee_id, data_sarbatorii) where deleted_at is null;

---------------------------------------------------------------------------
-- 8. Ajutoare de vizibilitate (păstrează forma cerută de S6 în politici)
---------------------------------------------------------------------------

create or replace function app.poate_vedea_pontaj(p_org uuid, p_employee uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app.feature_on(p_org, 'attendance')
     and (
       app.has_permission(p_org, 'attendance', 'read') = 'all'
       or (app.has_permission(p_org, 'attendance', 'read') = 'team'
           and (p_employee = app.current_employee_id(p_org) or app.is_manager_of(p_org, p_employee)))
       or (app.has_permission(p_org, 'attendance', 'read') = 'own'
           and p_employee = app.current_employee_id(p_org))
     );
$$;

create or replace function app.poate_scrie_pontaj(p_org uuid, p_employee uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app.feature_on(p_org, 'attendance')
     and (
       app.has_permission(p_org, 'attendance', 'create') = 'all'
       or (app.has_permission(p_org, 'attendance', 'create') = 'team'
           and (p_employee = app.current_employee_id(p_org) or app.is_manager_of(p_org, p_employee)))
       or (app.has_permission(p_org, 'attendance', 'create') = 'own'
           and p_employee = app.current_employee_id(p_org))
     );
$$;

---------------------------------------------------------------------------
-- 9. Triggere de integritate
---------------------------------------------------------------------------

create or replace function internal.pontaj_marcheaza_actualizarea()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Pregătește linia de pontaj: leagă perioada, deduce tipul zilei, refuză luna blocată.
create or replace function internal.pontaj_intrare_pregateste()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_perioada public.attendance_periods%rowtype;
  v_eticheta text := to_char(new.data, 'MM.YYYY');
begin
  select p.* into v_perioada
    from public.attendance_periods p
   where p.organization_id = new.organization_id
     and p.an = extract(year from new.data)::smallint
     and p.luna = extract(month from new.data)::smallint
     and p.deleted_at is null;

  if not found then
    raise exception 'Luna de pontaj % nu a fost deschisă. Deschide perioada înainte de a înregistra pontaj.',
      v_eticheta using errcode = 'P0001';
  end if;

  if v_perioada.status = 'blocata' and not app.is_service_context() then
    raise exception 'Perioada de pontaj % este blocată și nu mai poate fi modificată. Deblocheaz-o dacă ai nevoie de corecții.',
      v_eticheta using errcode = 'P0001';
  end if;

  new.period_id := v_perioada.id;

  if new.tip_zi is null then
    new.tip_zi := case
      when app.este_zi_lucratoare(new.organization_id, new.data) then 'lucratoare'::public.attendance_day_type
      when extract(isodow from new.data) >= 6 then 'weekend'::public.attendance_day_type
      else 'sarbatoare'::public.attendance_day_type
    end;
  end if;

  return new;
end;
$$;

-- Aceleași reguli pentru tabelele derivate; coloana cu data se primește prin TG_ARGV.
create or replace function internal.pontaj_luna_nu_e_blocata()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := (to_jsonb(new) ->> 'organization_id')::uuid;
  v_data date := (to_jsonb(new) ->> tg_argv[0])::date;
  v_status public.attendance_period_status;
begin
  select p.status into v_status
    from public.attendance_periods p
   where p.organization_id = v_org
     and p.an = extract(year from v_data)::smallint
     and p.luna = extract(month from v_data)::smallint
     and p.deleted_at is null;

  if v_status = 'blocata' and not app.is_service_context() then
    raise exception 'Perioada de pontaj % este blocată. Deblocheaz-o înainte de a modifica compensările.',
      to_char(v_data, 'MM.YYYY') using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- Tranzițiile perioadei. Blocarea o poate face doar cine aprobă pontajul la nivel de organizație.
create or replace function internal.pontaj_perioada_tranzitie()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.data_inceput := make_date(new.an, new.luna, 1);
    new.data_sfarsit := (make_date(new.an, new.luna, 1) + interval '1 month' - interval '1 day')::date;
    return new;
  end if;

  new.an := old.an;
  new.luna := old.luna;
  new.data_inceput := old.data_inceput;
  new.data_sfarsit := old.data_sfarsit;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'deschisa' and new.status in ('in_aprobare', 'blocata'))
      or (old.status = 'in_aprobare' and new.status in ('deschisa', 'blocata'))
      or (old.status = 'blocata' and new.status = 'deschisa')
    ) then
      raise exception 'Trecerea perioadei de pontaj de la „%” la „%” nu este permisă.', old.status, new.status
        using errcode = 'P0001';
    end if;

    if new.status = 'blocata' or old.status = 'blocata' then
      if not (app.can(new.organization_id, 'attendance', 'approve', 'all') or app.is_service_context()) then
        raise exception 'Doar o persoană cu drept de aprobare a pontajului pe toată organizația poate bloca sau debloca luna.'
          using errcode = '42501';
      end if;
    end if;

    if new.status = 'blocata' then
      new.blocata_la := now();
      new.blocata_de := auth.uid();
    elsif old.status = 'blocata' then
      new.blocata_la := null;
      new.blocata_de := null;
    end if;
  else
    new.blocata_la := old.blocata_la;
    new.blocata_de := old.blocata_de;
  end if;

  return new;
end;
$$;

-- Munca în sărbătoare legală lasă urmă automat: legea cere evidența compensării.
create or replace function internal.pontaj_genereaza_compensare_sarbatoare()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_termen smallint;
begin
  if new.deleted_at is not null or new.tip_zi <> 'sarbatoare' or new.ore_lucrate <= 0 then
    return null;
  end if;

  select s.termen_compensare_sarbatoare_zile into v_termen
    from public.attendance_settings s
   where s.organization_id = new.organization_id
     and s.deleted_at is null
     and s.valabil_de_la <= new.data
   order by s.valabil_de_la desc
   limit 1;

  if v_termen is null then
    return null; -- fără parametri configurați nu inventăm termene; verifica_pontaj semnalează lipsa.
  end if;

  insert into public.holiday_compensation as h (
    organization_id, employee_id, entry_id, data_sarbatorii, ore_lucrate, tip, termen_acordare
  )
  values (
    new.organization_id, new.employee_id, new.id, new.data, new.ore_lucrate, 'zi_libera',
    new.data + make_interval(days => v_termen)
  )
  on conflict (organization_id, employee_id, data_sarbatorii) where deleted_at is null
  do update set ore_lucrate = excluded.ore_lucrate, entry_id = excluded.entry_id, updated_at = now()
  where h.acordata = false;

  return null;
end;
$$;

create trigger trg_attendance_periods_tranzitie
  before insert or update on public.attendance_periods
  for each row execute function internal.pontaj_perioada_tranzitie();

create trigger trg_attendance_entries_pregatire
  before insert or update on public.attendance_entries
  for each row execute function internal.pontaj_intrare_pregateste();

create trigger trg_attendance_entries_sarbatoare
  after insert or update on public.attendance_entries
  for each row execute function internal.pontaj_genereaza_compensare_sarbatoare();

create trigger trg_overtime_compensation_luna
  before insert or update on public.overtime_compensation
  for each row execute function internal.pontaj_luna_nu_e_blocata('data_generarii');

create trigger trg_holiday_compensation_luna
  before insert or update on public.holiday_compensation
  for each row execute function internal.pontaj_luna_nu_e_blocata('data_sarbatorii');

---------------------------------------------------------------------------
-- 10. Sincronizarea cu concediile aprobate — IDEMPOTENTĂ
---------------------------------------------------------------------------

create or replace function app.sincronizeaza_pontaj_concedii(
  p_organization_id uuid, p_an smallint, p_luna smallint
)
returns table (linii_create integer, linii_actualizate integer, linii_pastrate integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_perioada public.attendance_periods%rowtype;
  v_start date := make_date(p_an, p_luna, 1);
  v_end date := (make_date(p_an, p_luna, 1) + interval '1 month' - interval '1 day')::date;
  v_total integer := 0;
  v_noi integer := 0;
  v_actualizate integer := 0;
begin
  if not app.can(p_organization_id, 'attendance', 'create', 'all') then
    raise exception 'Nu ai dreptul să sincronizezi pontajul cu concediile aprobate.' using errcode = '42501';
  end if;
  if not app.feature_on(p_organization_id, 'attendance') then
    raise exception 'Modulul de pontaj nu este activ pentru această organizație.' using errcode = 'P0001';
  end if;

  select p.* into v_perioada
    from public.attendance_periods p
   where p.organization_id = p_organization_id and p.an = p_an and p.luna = p_luna and p.deleted_at is null;
  if not found then
    raise exception 'Luna de pontaj % nu a fost deschisă.', to_char(v_start, 'MM.YYYY') using errcode = 'P0001';
  end if;
  if v_perioada.status = 'blocata' then
    raise exception 'Perioada de pontaj % este blocată și nu mai poate fi sincronizată.',
      to_char(v_start, 'MM.YYYY') using errcode = 'P0001';
  end if;

  with sursa as (
    select distinct lr.employee_id, d.data, lr.id as leave_request_id
      from public.leave_request_days d
      join public.leave_requests lr on lr.id = d.leave_request_id
     where lr.organization_id = p_organization_id
       and lr.deleted_at is null
       and d.data between v_start and v_end
       -- DE ALINIAT cu valoarea reală a enum-ului de status din 0009:
       and lr.status::text in ('aprobata', 'aprobat', 'approved')
       and app.este_zi_lucratoare(p_organization_id, d.data)
  ),
  scrise as (
    insert into public.attendance_entries as e (
      organization_id, employee_id, data, ore_lucrate, ore_suplimentare, ore_noapte,
      tip_zi, sursa, leave_request_id
    )
    select p_organization_id, s.employee_id, s.data, 0, 0, 0, 'concediu', 'sincronizare_concedii', s.leave_request_id
      from sursa s
    on conflict (organization_id, employee_id, data) where deleted_at is null
    do update set
      tip_zi = 'concediu',
      ore_lucrate = 0,
      ore_suplimentare = 0,
      ore_noapte = 0,
      leave_request_id = excluded.leave_request_id,
      updated_at = now()
    where e.sursa = 'sincronizare_concedii'   -- liniile manuale rămân neatinse
    returning (xmax = 0) as inserata
  )
  select (select count(*) from sursa),
         count(*) filter (where inserata),
         count(*) filter (where not inserata)
    into v_total, v_noi, v_actualizate
    from scrise;

  return query select v_noi, v_actualizate, v_total - v_noi - v_actualizate;
end;
$$;

---------------------------------------------------------------------------
-- 11. Aprobarea în bloc
---------------------------------------------------------------------------

create or replace function app.aproba_pontaj_bloc(
  p_organization_id uuid,
  p_period_id uuid,
  p_department_id uuid default null,
  p_manager_employee_id uuid default null,
  p_observatii text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_perioada public.attendance_periods%rowtype;
  v_batch uuid;
  v_linii integer;
begin
  if not app.can(p_organization_id, 'attendance', 'approve', 'team') then
    raise exception 'Nu ai dreptul să aprobi pontajul.' using errcode = '42501';
  end if;

  select p.* into v_perioada
    from public.attendance_periods p
   where p.id = p_period_id and p.organization_id = p_organization_id and p.deleted_at is null;
  if not found then
    raise exception 'Perioada de pontaj nu a fost găsită.' using errcode = 'P0001';
  end if;
  if v_perioada.status = 'blocata' then
    raise exception 'Perioada de pontaj % este deja blocată.', to_char(v_perioada.data_inceput, 'MM.YYYY')
      using errcode = 'P0001';
  end if;

  insert into public.attendance_approval_batches (
    organization_id, period_id, department_id, manager_employee_id, aprobat_de, observatii, linii_aprobate
  )
  values (p_organization_id, p_period_id, p_department_id, p_manager_employee_id, auth.uid(), p_observatii, 0)
  returning id into v_batch;

  update public.attendance_entries e
     set approved_at = now(), approved_by = auth.uid(), batch_id = v_batch
   where e.organization_id = p_organization_id
     and e.period_id = p_period_id
     and e.deleted_at is null
     and e.approved_at is null
     and (p_department_id is null or exists (
           select 1 from public.employees emp
            where emp.id = e.employee_id and emp.department_id = p_department_id))
     and (p_manager_employee_id is null or app.is_manager_of(p_organization_id, e.employee_id))
     and (app.has_permission(p_organization_id, 'attendance', 'approve') = 'all'
          or e.employee_id = app.current_employee_id(p_organization_id)
          or app.is_manager_of(p_organization_id, e.employee_id));
  get diagnostics v_linii = row_count;

  update public.attendance_approval_batches set linii_aprobate = v_linii, updated_at = now() where id = v_batch;

  if v_perioada.status = 'deschisa' then
    update public.attendance_periods set status = 'in_aprobare', updated_at = now() where id = p_period_id;
  end if;

  return v_batch;
end;
$$;

---------------------------------------------------------------------------
-- 12. Verificări care AVERTIZEAZĂ, nu blochează
---------------------------------------------------------------------------

create or replace function app.verifica_pontaj(p_organization_id uuid, p_an smallint, p_luna smallint)
returns table (employee_id uuid, data date, cod text, severitate text, mesaj text)
language plpgsql stable set search_path = '' as $$
declare
  v_set public.attendance_settings%rowtype;
  v_start date := make_date(p_an, p_luna, 1);
  v_end date := (make_date(p_an, p_luna, 1) + interval '1 month' - interval '1 day')::date;
begin
  if not app.can(p_organization_id, 'attendance', 'read', 'own') then
    raise exception 'Nu ai dreptul să consulți pontajul.' using errcode = '42501';
  end if;

  select s.* into v_set
    from public.attendance_settings s
   where s.organization_id = p_organization_id and s.deleted_at is null and s.valabil_de_la <= v_start
   order by s.valabil_de_la desc limit 1;

  if not found then
    return query select null::uuid, null::date, 'setari_lipsa', 'avertisment',
      'Nu există parametri de pontaj valabili pentru această lună. Completează-i în Setări → Pontaj.';
    return;
  end if;

  return query
  with zile as (
    select e.employee_id, e.data, e.ore_lucrate, e.ora_inceput,
           lag(e.data) over w as data_ant,
           lag(e.ore_lucrate) over w as ore_ant,
           lag(e.ora_sfarsit) over w as sfarsit_ant
      from public.attendance_entries e
     where e.organization_id = p_organization_id and e.deleted_at is null
       and e.data between v_start and v_end and e.ore_lucrate > 0
    window w as (partition by e.employee_id order by e.data)
  )
  select z.employee_id, z.data, 'repaus_zilnic', 'avertisment',
         format('Repausul estimat între %s și %s este de %s ore, sub minimul configurat de %s ore.',
                to_char(z.data_ant, 'DD.MM'), to_char(z.data, 'DD.MM'),
                to_char(z.repaus, 'FM990.0'), to_char(v_set.repaus_zilnic_minim_ore, 'FM990.0'))
    from (
      select zz.*,
             case when zz.sfarsit_ant is not null and zz.ora_inceput is not null
                  then extract(epoch from ((zz.data + zz.ora_inceput) - (zz.data_ant + zz.sfarsit_ant))) / 3600.0
                  else 24 - coalesce(zz.ore_ant, 0) end as repaus
        from zile zz
    ) z
   where z.data_ant = z.data - 1 and z.repaus < v_set.repaus_zilnic_minim_ore;

  return query
  with saptamani as (
    select e.employee_id, date_trunc('week', e.data)::date as saptamana, sum(e.ore_lucrate) as ore
      from public.attendance_entries e
     where e.organization_id = p_organization_id and e.deleted_at is null and e.data between v_start and v_end
     group by 1, 2
  )
  select s.employee_id, s.saptamana, 'saptamana_peste_maxim', 'avertisment',
         format('Săptămâna care începe la %s însumează %s ore, peste plafonul de %s ore.',
                to_char(s.saptamana, 'DD.MM.YYYY'), to_char(s.ore, 'FM990.0'),
                to_char(v_set.ore_maxime_saptamanale, 'FM990.0'))
    from saptamani s
   where s.ore > v_set.ore_maxime_saptamanale;

  return query
  with referinta as (
    select e.employee_id, sum(e.ore_lucrate) as ore,
           count(distinct date_trunc('week', e.data)) as saptamani
      from public.attendance_entries e
     where e.organization_id = p_organization_id and e.deleted_at is null
       and e.data >= (v_start - make_interval(months => v_set.perioada_referinta_luni - 1))::date
       and e.data <= v_end
     group by 1
  )
  select r.employee_id, v_end, 'medie_perioada_referinta', 'avertisment',
         format('Media pe perioada de referință de %s luni este de %s ore/săptămână, peste plafonul de %s ore.',
                v_set.perioada_referinta_luni, to_char(r.ore / r.saptamani, 'FM990.0'),
                to_char(v_set.ore_maxime_saptamanale, 'FM990.0'))
    from referinta r
   where r.saptamani > 0 and r.ore / r.saptamani > v_set.ore_maxime_saptamanale;
end;
$$;

---------------------------------------------------------------------------
-- 13. Sporuri: o singură compensare pe axa „zi de repaus”, cumul pe axe diferite
---------------------------------------------------------------------------

create or replace function app.sporuri_pontaj(
  p_organization_id uuid,
  p_data date,
  p_tip_zi public.attendance_day_type,
  p_ore_lucrate numeric,
  p_ore_suplimentare numeric,
  p_ore_noapte numeric
)
returns table (
  procent_ore_normale numeric,
  procent_ore_suplimentare numeric,
  procent_noapte numeric,
  ore_ponderate numeric
)
language plpgsql stable set search_path = '' as $$
declare
  v public.attendance_settings%rowtype;
  v_zi numeric;
begin
  select s.* into v
    from public.attendance_settings s
   where s.organization_id = p_organization_id and s.deleted_at is null and s.valabil_de_la <= p_data
   order by s.valabil_de_la desc limit 1;
  if not found then
    raise exception 'Nu există parametri de pontaj valabili la data de %.', to_char(p_data, 'DD.MM.YYYY')
      using errcode = 'P0001';
  end if;

  -- Sărbătoarea și weekendul compensează același lucru — munca într-o zi de repaus.
  -- Se aplică sporul cel mai favorabil, NU suma lor.
  v_zi := case
    when p_tip_zi = 'sarbatoare' then greatest(v.spor_sarbatoare_procent,
      case when extract(isodow from p_data) >= 6 then v.spor_weekend_procent else 0 end)
    when p_tip_zi = 'weekend' then v.spor_weekend_procent
    else 0
  end;

  procent_ore_normale := v_zi;
  procent_ore_suplimentare := greatest(v_zi, v.spor_suplimentare_procent);
  procent_noapte := v.spor_noapte_procent;
  ore_ponderate := round(
      (p_ore_lucrate - p_ore_suplimentare) * (1 + procent_ore_normale / 100)
    + p_ore_suplimentare * (1 + procent_ore_suplimentare / 100)
    + p_ore_noapte * (procent_noapte / 100), 2);
  return next;
end;
$$;

---------------------------------------------------------------------------
-- 14. RLS
---------------------------------------------------------------------------

alter table public.attendance_settings enable row level security;
alter table public.attendance_settings force row level security;
alter table public.attendance_periods enable row level security;
alter table public.attendance_periods force row level security;
alter table public.attendance_approval_batches enable row level security;
alter table public.attendance_approval_batches force row level security;
alter table public.attendance_entries enable row level security;
alter table public.attendance_entries force row level security;
alter table public.overtime_compensation enable row level security;
alter table public.overtime_compensation force row level security;
alter table public.holiday_compensation enable row level security;
alter table public.holiday_compensation force row level security;

-- attendance_settings
create policy attendance_settings_select on public.attendance_settings for select to authenticated
using (
  app.is_platform_admin()
  or (organization_id = any ((select app.current_org_ids())::uuid[])
      and app.feature_on(organization_id, 'attendance')
      and app.can(organization_id, 'attendance', 'read', 'own'))
);
create policy attendance_settings_insert on public.attendance_settings for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'attendance')
  and app.can(organization_id, 'attendance', 'create', 'all')
  and deleted_at is null
);
create policy attendance_settings_update on public.attendance_settings for update to authenticated
using (organization_id = any ((select app.current_org_ids())::uuid[])
       and app.feature_on(organization_id, 'attendance')
       and app.can(organization_id, 'attendance', 'create', 'all'))
with check (organization_id = any ((select app.current_org_ids())::uuid[])
       and app.can(organization_id, 'attendance', 'create', 'all'));

-- attendance_periods
create policy attendance_periods_select on public.attendance_periods for select to authenticated
using (
  app.is_platform_admin()
  or (organization_id = any ((select app.current_org_ids())::uuid[])
      and app.feature_on(organization_id, 'attendance')
      and (app.can(organization_id, 'attendance', 'read', 'own')
           or app.can(organization_id, 'attendance', 'create', 'own')))
);
create policy attendance_periods_insert on public.attendance_periods for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'attendance')
  and app.can(organization_id, 'attendance', 'create', 'all')
  and status = 'deschisa' and blocata_la is null and blocata_de is null and deleted_at is null
);
create policy attendance_periods_update on public.attendance_periods for update to authenticated
using (organization_id = any ((select app.current_org_ids())::uuid[])
       and app.feature_on(organization_id, 'attendance')
       and (app.can(organization_id, 'attendance', 'create', 'all')
            or app.can(organization_id, 'attendance', 'approve', 'team')))
with check (organization_id = any ((select app.current_org_ids())::uuid[])
       and (app.can(organization_id, 'attendance', 'create', 'all')
            or app.can(organization_id, 'attendance', 'approve', 'team')));

-- attendance_entries
create policy attendance_entries_select on public.attendance_entries for select to authenticated
using (
  app.is_platform_admin()
  or (organization_id = any ((select app.current_org_ids())::uuid[])
      and app.poate_vedea_pontaj(organization_id, employee_id))
);
create policy attendance_entries_insert on public.attendance_entries for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.poate_scrie_pontaj(organization_id, employee_id)
  and approved_at is null and approved_by is null and batch_id is null and deleted_at is null
  and (sursa <> 'sincronizare_concedii' or app.can(organization_id, 'attendance', 'create', 'all'))
);
create policy attendance_entries_update on public.attendance_entries for update to authenticated
using (organization_id = any ((select app.current_org_ids())::uuid[])
       and app.poate_scrie_pontaj(organization_id, employee_id)
       and (approved_at is null or app.can(organization_id, 'attendance', 'approve', 'team')))
with check (organization_id = any ((select app.current_org_ids())::uuid[])
       and app.poate_scrie_pontaj(organization_id, employee_id)
       and (approved_at is null or app.can(organization_id, 'attendance', 'approve', 'team')));

-- attendance_approval_batches
create policy attendance_batches_select on public.attendance_approval_batches for select to authenticated
using (
  app.is_platform_admin()
  or (organization_id = any ((select app.current_org_ids())::uuid[])
      and app.feature_on(organization_id, 'attendance')
      and app.can(organization_id, 'attendance', 'read', 'team'))
);
create policy attendance_batches_insert on public.attendance_approval_batches for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'attendance')
  and app.can(organization_id, 'attendance', 'approve', 'team')
  and linii_aprobate = 0 and deleted_at is null
);
create policy attendance_batches_update on public.attendance_approval_batches for update to authenticated
using (organization_id = any ((select app.current_org_ids())::uuid[])
       and app.can(organization_id, 'attendance', 'approve', 'team'))
with check (organization_id = any ((select app.current_org_ids())::uuid[])
       and app.can(organization_id, 'attendance', 'approve', 'team'));

-- overtime_compensation
create policy overtime_compensation_select on public.overtime_compensation for select to authenticated
using (
  app.is_platform_admin()
  or (organization_id = any ((select app.current_org_ids())::uuid[])
      and app.poate_vedea_pontaj(organization_id, employee_id))
);
create policy overtime_compensation_insert on public.overtime_compensation for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.poate_scrie_pontaj(organization_id, employee_id)
  and ore_folosite = 0 and ore_expirate = 0 and deleted_at is null
);
create policy overtime_compensation_update on public.overtime_compensation for update to authenticated
using (organization_id = any ((select app.current_org_ids())::uuid[])
       and app.poate_scrie_pontaj(organization_id, employee_id))
with check (organization_id = any ((select app.current_org_ids())::uuid[])
       and app.poate_scrie_pontaj(organization_id, employee_id));

-- holiday_compensation
create policy holiday_compensation_select on public.holiday_compensation for select to authenticated
using (
  app.is_platform_admin()
  or (organization_id = any ((select app.current_org_ids())::uuid[])
      and app.poate_vedea_pontaj(organization_id, employee_id))
);
create policy holiday_compensation_insert on public.holiday_compensation for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.poate_scrie_pontaj(organization_id, employee_id)
  and acordata = false and acordata_la is null and deleted_at is null
);
create policy holiday_compensation_update on public.holiday_compensation for update to authenticated
using (organization_id = any ((select app.current_org_ids())::uuid[])
       and app.poate_scrie_pontaj(organization_id, employee_id))
with check (organization_id = any ((select app.current_org_ids())::uuid[])
       and app.poate_scrie_pontaj(organization_id, employee_id));

---------------------------------------------------------------------------
-- 15. Actor, audit, drepturi
---------------------------------------------------------------------------

do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array[
    'attendance_settings', 'attendance_periods', 'attendance_approval_batches',
    'attendance_entries', 'overtime_compensation', 'holiday_compensation'
  ]
  loop
    execute format(
      'create trigger trg_%1$s_actor before insert or update on public.%1$I for each row execute function internal.set_actor()',
      v_tabela);
    execute format(
      'create trigger trg_%1$s_updated before insert or update on public.%1$I for each row execute function internal.pontaj_marcheaza_actualizarea()',
      v_tabela);
    execute format('select internal.attach_audit(%L)', v_tabela);
    execute format('revoke all on table public.%I from public, anon', v_tabela);
    execute format('grant select, insert, update on table public.%I to authenticated', v_tabela);
    execute format('revoke delete on table public.%I from authenticated', v_tabela);
  end loop;
end;
$$;

revoke all on function app.poate_vedea_pontaj(uuid, uuid) from public, anon;
revoke all on function app.poate_scrie_pontaj(uuid, uuid) from public, anon;
revoke all on function app.sincronizeaza_pontaj_concedii(uuid, smallint, smallint) from public, anon;
revoke all on function app.aproba_pontaj_bloc(uuid, uuid, uuid, uuid, text) from public, anon;
revoke all on function app.verifica_pontaj(uuid, smallint, smallint) from public, anon;
revoke all on function app.sporuri_pontaj(uuid, date, public.attendance_day_type, numeric, numeric, numeric) from public, anon;
revoke all on function internal.pontaj_intrare_pregateste() from public, anon;
revoke all on function internal.pontaj_luna_nu_e_blocata() from public, anon;
revoke all on function internal.pontaj_perioada_tranzitie() from public, anon;
revoke all on function internal.pontaj_genereaza_compensare_sarbatoare() from public, anon;
revoke all on function internal.pontaj_marcheaza_actualizarea() from public, anon;

grant execute on function app.poate_vedea_pontaj(uuid, uuid) to authenticated;
grant execute on function app.poate_scrie_pontaj(uuid, uuid) to authenticated;
grant execute on function app.sincronizeaza_pontaj_concedii(uuid, smallint, smallint) to authenticated;
grant execute on function app.aproba_pontaj_bloc(uuid, uuid, uuid, uuid, text) to authenticated;
grant execute on function app.verifica_pontaj(uuid, smallint, smallint) to authenticated;
grant execute on function app.sporuri_pontaj(uuid, date, public.attendance_day_type, numeric, numeric, numeric) to authenticated;

---------------------------------------------------------------------------
-- 16. Note de proiectare
--
-- (a) IDEMPOTENȚA SINCRONIZĂRII. Garanția stă într-o singură cheie:
--     attendance_entries_zi_uq — UNIQUE (organization_id, employee_id, data)
--     WHERE deleted_at is null. Ea este ținta lui ON CONFLICT, deci a doua rulare
--     pe aceeași lună nu poate insera duplicate: fiecare zi de concediu se
--     ciocnește de linia deja existentă. Ramura DO UPDATE poartă condiția
--     `where e.sursa = 'sincronizare_concedii'`, așa că o linie introdusă manual
--     (sursa 'manuala' sau 'import') nu este atinsă — conflictul se consumă tăcut,
--     fără eroare și fără suprascriere. Rezultatul întoarce explicit câte linii au
--     fost create, câte actualizate și câte păstrate, ca operatorul să vadă că
--     pontajul lui manual a fost respectat.
--
-- (b) SUPLIMENTARE ÎN ZI CARE E ȘI SĂRBĂTOARE ȘI WEEKEND. Procentele NU se
--     cumulează la infinit. Regula aleasă: sporurile se grupează pe „axe”, iar
--     pe aceeași axă se aplică unul singur, cel mai favorabil.
--       axa „zi de repaus”  → max(spor_sarbatoare, spor_weekend). Sărbătoarea și
--         repausul săptămânal compensează același prejudiciu: pierderea zilei de
--         odihnă. A le aduna ar plăti de două ori aceeași cauză.
--       axa „ore peste normă” → pentru orele suplimentare se aplică
--         max(spor_zi, spor_suplimentare), nu suma. Într-o zi de repaus toate
--         orele sunt deja plătite ca muncă în zi liberă; sporul de suplimentare
--         are aceeași rațiune (efort peste program într-un timp datorat odihnei),
--         deci se ia cel mai mare, nu ambele.
--       axa „noapte” → spor_noapte se CUMULEAZĂ cu orice altceva, pentru că
--         remunerează un risc diferit: munca nocturnă. Se aplică doar orelor
--         efectiv prestate în intervalul noapte_start–noapte_sfarsit.
--     Formula este în app.sporuri_pontaj(); procentele vin exclusiv din
--     attendance_settings, valabile la data zilei pontate.
--
-- (c) DE CE BLOCAREA PERIOADEI ESTE APROBAREA EI. Aprobarea în bloc
--     (attendance_approval_batches) este un act parțial și reversibil: acoperă un
--     departament sau angajații unui manager, iar liniile rămân corectabile.
--     Ce are nevoie salarizarea nu este „cineva a semnat”, ci „luna nu se mai
--     mișcă”: un stat de plată calculat pe date care se pot schimba în urmă este
--     un stat fals. status = 'blocata' este exact acea garanție — triggerul
--     internal.pontaj_intrare_pregateste() refuză orice INSERT sau UPDATE în luna
--     blocată, inclusiv ștergerea logică, iar deblocarea cere drept de aprobare pe
--     toată organizația și lasă urmă în jurnalul de audit. O stare separată
--     „aprobată” care nu ar îngheța datele nu ar însemna nimic, iar una care le-ar
--     îngheța ar fi blocarea sub alt nume. Faza 9 va cere deci status = 'blocata'.
--
-- (d) VERIFICĂRILE NU BLOCHEAZĂ. app.verifica_pontaj() întoarce avertismente
--     (repaus zilnic, plafon săptămânal, media pe perioada de referință). Un
--     pontaj corect care descrie o realitate nelegală trebuie să poată fi
--     înregistrat — altfel firma îl falsifică, iar sistemul devine complice.
--     Blocante rămân doar imposibilitățile logice (ore negative, ore de noapte mai
--     multe decât orele lucrate, scrisul într-o lună blocată).
---------------------------------------------------------------------------
