-- ─────────────────────────────────────────────────────────────────────────────
-- 0026_payroll.sql — Faza 9, schema
--
-- Motorul de calcul e portat integral în TypeScript (`domain/payroll/calc.ts`),
-- pur, testat, fără nicio cotă hardcodată — schema de-aici e doar depozitul:
-- setări versionate, perioade cu ciclu de viață, rezultate cu fotografia
-- setărilor folosite (`settings_snapshot`), elemente variabile.
--
-- Scop DELIBERAT mai mic decât un motor de salarizare complet — vezi
-- comentariul din `domain/payroll/calc.ts` pentru ce anume s-a tăiat și de ce.
-- Niciuna dintre valorile din `payroll_settings` nu e verificată legal; banner
-- persistent în UI, coloana `verificat_de_contabil` rămâne `false` implicit.
--
-- Modelul de permisiuni e deja seed-uit din 0002_authz.sql:
--   org_admin, hr : payroll = all  pe {read,create,update,delete,approve,export}
--   manager       : payroll = none (REFUZ EXPLICIT — nu se deschide implicit)
--   employee      : payroll = own  pe {read,export}
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on

-- ============================================================
-- 1. ENUM-URI
-- ============================================================

create type public.payroll_period_status as enum ('draft', 'calculat', 'aprobat', 'inchis');
create type public.payroll_entry_status as enum ('draft', 'calculat');
create type public.payroll_bonus_type as enum
  ('prima_performanta', 'prima_proiect', 'prima_vacanta', 'spor_conditii', 'alta');
create type public.payroll_deduction_type as enum
  ('avans', 'poprire', 'imputatie', 'rata_interna', 'retinere_sindicat', 'alta');

-- ============================================================
-- 2. payroll_settings
-- ============================================================

create table public.payroll_settings (
  id                        uuid primary key default gen_random_uuid(),
  organization_id           uuid not null references public.organizations (id) on delete cascade,
  valabil_de_la             date not null,
  cota_cas                  numeric(6, 4) not null,
  cota_cass                 numeric(6, 4) not null,
  cota_impozit              numeric(6, 4) not null,
  cota_cam_angajator        numeric(6, 4) not null,
  norma_zilnica_ore         numeric(4, 2) not null default 8,
  procent_spor_noapte       numeric(6, 4) not null default 0.25,
  procent_spor_weekend      numeric(6, 4) not null default 0,
  procent_ore_suplimentare  numeric(6, 4) not null default 0.75,
  valoare_tichet_masa       numeric(14, 2) not null default 0,
  tichete_impozabile        boolean not null default false,
  rotunjire_lei             boolean not null default false,
  verificat_de_contabil     boolean not null default false,
  verificat_la              timestamptz,
  note                      text,
  created_at                timestamptz not null default now(),
  created_by                uuid references auth.users (id) on delete set null,
  updated_at                timestamptz not null default now(),
  updated_by                uuid references auth.users (id) on delete set null,
  deleted_at                timestamptz,
  constraint payroll_settings_cote_ck check (
    cota_cas between 0 and 1 and cota_cass between 0 and 1
    and cota_impozit between 0 and 1 and cota_cam_angajator between 0 and 1
    and procent_spor_noapte >= 0 and procent_spor_weekend >= 0
    and procent_ore_suplimentare >= 0
  ),
  constraint payroll_settings_norma_ck check (norma_zilnica_ore > 0),
  constraint payroll_settings_tichet_ck check (valoare_tichet_masa >= 0),
  constraint payroll_settings_note_len check (note is null or char_length(note) <= 2000),
  constraint payroll_settings_verificare_ck
    check ((verificat_de_contabil is false) or (verificat_la is not null))
);
create unique index payroll_settings_valabil_uq
  on public.payroll_settings (organization_id, valabil_de_la) where deleted_at is null;
create index payroll_settings_org_idx on public.payroll_settings (organization_id) where deleted_at is null;
create index payroll_settings_created_by_idx on public.payroll_settings (created_by);
create index payroll_settings_updated_by_idx on public.payroll_settings (updated_by);

-- ============================================================
-- 3. payroll_personal_deduction_brackets
-- ============================================================

create table public.payroll_personal_deduction_brackets (
  id                              uuid primary key default gen_random_uuid(),
  organization_id                 uuid not null references public.organizations (id) on delete cascade,
  settings_id                     uuid not null references public.payroll_settings (id) on delete cascade,
  nr_persoane_intretinere_min     smallint not null,
  nr_persoane_intretinere_max     smallint,
  venit_brut_max                  numeric(14, 2) not null,
  valoare                         numeric(14, 2) not null,
  ordine                          smallint not null default 0,
  created_at                      timestamptz not null default now(),
  created_by                      uuid references auth.users (id) on delete set null,
  updated_at                      timestamptz not null default now(),
  updated_by                      uuid references auth.users (id) on delete set null,
  deleted_at                      timestamptz,
  constraint ppdb_persoane_ck check (
    nr_persoane_intretinere_min >= 0
    and (nr_persoane_intretinere_max is null or nr_persoane_intretinere_max >= nr_persoane_intretinere_min)
  ),
  constraint ppdb_venit_ck check (venit_brut_max > 0),
  constraint ppdb_valoare_ck check (valoare >= 0)
);
create index ppdb_settings_idx
  on public.payroll_personal_deduction_brackets (settings_id, nr_persoane_intretinere_min)
  where deleted_at is null;
create index ppdb_created_by_idx on public.payroll_personal_deduction_brackets (created_by);
create index ppdb_updated_by_idx on public.payroll_personal_deduction_brackets (updated_by);

-- ============================================================
-- 4. payroll_periods
-- ============================================================

create table public.payroll_periods (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations (id) on delete cascade,
  an                     smallint not null check (an between 2020 and 2100),
  luna                   smallint not null check (luna between 1 and 12),
  attendance_period_id   uuid not null references public.attendance_periods (id) on delete restrict,
  settings_id            uuid not null references public.payroll_settings (id) on delete restrict,
  status                 public.payroll_period_status not null default 'draft',
  data_plata             date,
  calculat_de            uuid references auth.users (id) on delete set null,
  calculat_la            timestamptz,
  aprobat_de             uuid references auth.users (id) on delete set null,
  aprobat_la             timestamptz,
  inchis_de              uuid references auth.users (id) on delete set null,
  inchis_la              timestamptz,
  total_brut             numeric(14, 2) not null default 0,
  total_net              numeric(14, 2) not null default 0,
  total_cost_angajator   numeric(14, 2) not null default 0,
  observatii             text,
  created_at             timestamptz not null default now(),
  created_by             uuid references auth.users (id) on delete set null,
  updated_at             timestamptz not null default now(),
  updated_by             uuid references auth.users (id) on delete set null,
  deleted_at             timestamptz,
  constraint payroll_periods_aprobare_ck check (status <> 'aprobat' or aprobat_de is not null),
  constraint payroll_periods_inchidere_ck check (status <> 'inchis' or inchis_de is not null),
  constraint payroll_periods_observatii_len check (observatii is null or char_length(observatii) <= 2000)
);
create unique index payroll_periods_luna_uq
  on public.payroll_periods (organization_id, an, luna) where deleted_at is null;
create index payroll_periods_status_idx
  on public.payroll_periods (organization_id, status) where deleted_at is null;
create index payroll_periods_attendance_idx on public.payroll_periods (attendance_period_id);
create index payroll_periods_settings_idx on public.payroll_periods (settings_id);
create index payroll_periods_created_by_idx on public.payroll_periods (created_by);
create index payroll_periods_updated_by_idx on public.payroll_periods (updated_by);
create index payroll_periods_calculat_de_idx on public.payroll_periods (calculat_de);
create index payroll_periods_aprobat_de_idx on public.payroll_periods (aprobat_de);
create index payroll_periods_inchis_de_idx on public.payroll_periods (inchis_de);

-- ============================================================
-- 5. payroll_entries
-- ============================================================

create table public.payroll_entries (
  id                        uuid primary key default gen_random_uuid(),
  organization_id           uuid not null references public.organizations (id) on delete cascade,
  period_id                 uuid not null references public.payroll_periods (id) on delete cascade,
  employee_id               uuid not null references public.employees (id) on delete restrict,
  contract_id               uuid references public.employment_contracts (id) on delete set null,
  status                    public.payroll_entry_status not null default 'draft',
  zile_lucratoare_luna      numeric(5, 2) not null,
  zile_lucrate              numeric(5, 2) not null default 0,
  zile_concediu_odihna      numeric(5, 2) not null default 0,
  zile_concediu_medical     numeric(5, 2) not null default 0,
  zile_absenta_nemotivata   numeric(5, 2) not null default 0,
  ore_lucrate               numeric(7, 2) not null default 0,
  ore_suplimentare          numeric(7, 2) not null default 0,
  ore_noapte                numeric(7, 2) not null default 0,
  baza_salariu              numeric(14, 2) not null default 0,
  suma_ore_suplimentare     numeric(14, 2) not null default 0,
  spor_noapte               numeric(14, 2) not null default 0,
  prime_total               numeric(14, 2) not null default 0,
  brut                      numeric(14, 2) not null default 0,
  nr_tichete                smallint not null default 0,
  valoare_tichete           numeric(14, 2) not null default 0,
  baza_cas_cass             numeric(14, 2) not null default 0,
  cas                       numeric(14, 2) not null default 0,
  cass                      numeric(14, 2) not null default 0,
  deducere_personala        numeric(14, 2) not null default 0,
  baza_impozit              numeric(14, 2) not null default 0,
  impozit                   numeric(14, 2) not null default 0,
  cam_angajator             numeric(14, 2) not null default 0,
  net                       numeric(14, 2) not null default 0,
  retineri_total            numeric(14, 2) not null default 0,
  net_de_plata              numeric(14, 2) not null default 0,
  cost_total_angajator      numeric(14, 2) not null default 0,
  settings_snapshot         jsonb not null,
  calc_breakdown            jsonb not null default '[]'::jsonb,
  calc_warnings             jsonb not null default '[]'::jsonb,
  calculat_la               timestamptz,
  created_at                timestamptz not null default now(),
  created_by                uuid references auth.users (id) on delete set null,
  updated_at                timestamptz not null default now(),
  updated_by                uuid references auth.users (id) on delete set null,
  deleted_at                timestamptz,
  constraint payroll_entries_valori_ck check (
    brut >= 0 and net >= 0 and net_de_plata >= 0 and cost_total_angajator >= brut
  ),
  constraint payroll_entries_snapshot_ck check (jsonb_typeof(settings_snapshot) = 'object')
);
create unique index payroll_entries_uq
  on public.payroll_entries (organization_id, period_id, employee_id) where deleted_at is null;
create index payroll_entries_period_idx
  on public.payroll_entries (organization_id, period_id) where deleted_at is null;
create index payroll_entries_employee_idx
  on public.payroll_entries (organization_id, employee_id, period_id) where deleted_at is null;
create index payroll_entries_contract_idx on public.payroll_entries (contract_id);
create index payroll_entries_created_by_idx on public.payroll_entries (created_by);
create index payroll_entries_updated_by_idx on public.payroll_entries (updated_by);

-- ============================================================
-- 6. payroll_bonuses / payroll_deductions
-- ============================================================

create table public.payroll_bonuses (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  employee_id         uuid not null references public.employees (id) on delete restrict,
  period_id           uuid not null references public.payroll_periods (id) on delete cascade,
  tip                 public.payroll_bonus_type not null,
  suma                numeric(14, 2) not null check (suma > 0),
  motiv               text not null check (char_length(motiv) between 1 and 500),
  impozabil           boolean not null default true,
  supus_contributii   boolean not null default true,
  created_at          timestamptz not null default now(),
  created_by          uuid references auth.users (id) on delete set null,
  updated_at          timestamptz not null default now(),
  updated_by          uuid references auth.users (id) on delete set null,
  deleted_at          timestamptz
);
create index payroll_bonuses_period_idx
  on public.payroll_bonuses (organization_id, period_id, employee_id) where deleted_at is null;
create index payroll_bonuses_created_by_idx on public.payroll_bonuses (created_by);
create index payroll_bonuses_updated_by_idx on public.payroll_bonuses (updated_by);

create table public.payroll_deductions (
  id                        uuid primary key default gen_random_uuid(),
  organization_id           uuid not null references public.organizations (id) on delete cascade,
  employee_id               uuid not null references public.employees (id) on delete restrict,
  period_id                 uuid not null references public.payroll_periods (id) on delete cascade,
  tip                       public.payroll_deduction_type not null,
  suma                      numeric(14, 2) not null check (suma > 0),
  procent_maxim_din_net     numeric(6, 4) check (procent_maxim_din_net is null or procent_maxim_din_net <= 1),
  motiv                     text not null check (char_length(motiv) between 1 and 500),
  created_at                timestamptz not null default now(),
  created_by                uuid references auth.users (id) on delete set null,
  updated_at                timestamptz not null default now(),
  updated_by                uuid references auth.users (id) on delete set null,
  deleted_at                timestamptz
);
create index payroll_deductions_period_idx
  on public.payroll_deductions (organization_id, period_id, employee_id) where deleted_at is null;
create index payroll_deductions_created_by_idx on public.payroll_deductions (created_by);
create index payroll_deductions_updated_by_idx on public.payroll_deductions (updated_by);

-- ============================================================
-- 7. updated_at (funcția există din 0004)
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array[
    'payroll_settings', 'payroll_personal_deduction_brackets', 'payroll_periods',
    'payroll_entries', 'payroll_bonuses', 'payroll_deductions'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function internal.seteaza_updated_at()',
      t || '_set_updated_at', t);
  end loop;
end
$$;

-- ============================================================
-- 8. Tranziția de stare a perioadei — singurul loc care compară OLD vs NEW
-- ============================================================
--
-- RLS vede o singură versiune a rândului (USING pe cea veche, WITH CHECK pe
-- cea nouă), deci nu poate impune „aprobarea cere alt drept decât editarea în
-- ciornă". De-asta tranziția trăiește într-un trigger, ca peste tot unde
-- proiectul a avut nevoie de aceeași comparație (leave_requests, business_trips).

create or replace function internal.payroll_periods_tranzitie()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_att_status public.attendance_period_status;
  v_neaprobate integer;
begin
  if app.is_service_context() then
    return new;
  end if;

  if old.status = 'inchis' then
    raise exception 'Perioada este închisă. O corecție se face printr-o perioadă nouă, nu prin redeschidere.'
      using errcode = 'P0001';
  end if;

  if new.status = old.status then
    -- Editare de totaluri/observații fără schimbare de stare: cere măcar dreptul de scriere.
    if not app.can(new.organization_id, 'payroll', 'update', 'all') then
      raise exception 'Nu aveți dreptul să modificați perioada de salarizare.' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.status = 'calculat' then
    if not app.can(new.organization_id, 'payroll', 'create', 'all') then
      raise exception 'Nu aveți dreptul să calculați salariile.' using errcode = '42501';
    end if;

    select ap.status into v_att_status
    from public.attendance_periods ap
    where ap.id = new.attendance_period_id and ap.deleted_at is null;

    if v_att_status is distinct from 'blocata' then
      raise exception 'Pontajul lunii %/% nu este blocat. Salariile se calculează doar peste un pontaj blocat.',
        new.luna, new.an using errcode = 'P0001';
    end if;

    select count(*) into v_neaprobate
    from public.leave_requests lr
    where lr.organization_id = new.organization_id
      and lr.deleted_at is null
      and lr.status in ('trimisa', 'in_aprobare')
      and daterange(lr.data_inceput, lr.data_sfarsit, '[]')
          && daterange(make_date(new.an, new.luna, 1),
                       (make_date(new.an, new.luna, 1) + interval '1 month')::date, '[)');
    if v_neaprobate > 0 then
      raise exception 'Există % cereri de concediu în așteptare care se suprapun peste %/%.',
        v_neaprobate, new.luna, new.an using errcode = 'P0001';
    end if;

    new.calculat_de := auth.uid();
    new.calculat_la := now();
    return new;
  end if;

  if new.status = 'draft' then
    if old.status <> 'calculat' then
      raise exception 'O perioadă „%” nu se poate întoarce direct la ciornă.', old.status
        using errcode = 'P0001';
    end if;
    if not app.can(new.organization_id, 'payroll', 'update', 'all') then
      raise exception 'Nu aveți dreptul să recalculați perioada.' using errcode = '42501';
    end if;
    new.calculat_de := null;
    new.calculat_la := null;
    return new;
  end if;

  if new.status = 'aprobat' then
    if old.status <> 'calculat' then
      raise exception 'Doar o perioadă calculată poate fi aprobată.' using errcode = 'P0001';
    end if;
    if not app.can(new.organization_id, 'payroll', 'approve', 'all') then
      raise exception 'Nu aveți dreptul să aprobați salariile.' using errcode = '42501';
    end if;
    new.aprobat_de := auth.uid();
    new.aprobat_la := now();
    return new;
  end if;

  if new.status = 'inchis' then
    if old.status <> 'aprobat' then
      raise exception 'Doar o perioadă aprobată poate fi închisă.' using errcode = 'P0001';
    end if;
    if not app.can(new.organization_id, 'payroll', 'approve', 'all') then
      raise exception 'Nu aveți dreptul să închideți perioada de salarizare.' using errcode = '42501';
    end if;
    new.inchis_de := auth.uid();
    new.inchis_la := now();
    return new;
  end if;

  return new;
end;
$$;

create trigger payroll_periods_tranzitie_biu
  before update on public.payroll_periods
  for each row execute function internal.payroll_periods_tranzitie();

-- ============================================================
-- 9. Vizibilitate — un singur loc, folosit în toate politicile
-- ============================================================

create or replace function app.poate_accesa_salariul(p_org uuid, p_employee uuid, p_actiune text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select app.is_platform_admin()
      or (
        app.feature_on(p_org, 'payroll')
        and (
          app.has_permission(p_org, 'payroll', p_actiune) = 'all'
          or (app.has_permission(p_org, 'payroll', p_actiune) = 'own'
              and p_employee is not distinct from app.current_employee_id(p_org))
        )
      );
$$;
revoke all on function app.poate_accesa_salariul(uuid, uuid, text) from public, anon;
grant execute on function app.poate_accesa_salariul(uuid, uuid, text) to authenticated;

-- ============================================================
-- 10. RLS
-- ============================================================

alter table public.payroll_settings enable row level security;
alter table public.payroll_settings force row level security;
alter table public.payroll_personal_deduction_brackets enable row level security;
alter table public.payroll_personal_deduction_brackets force row level security;
alter table public.payroll_periods enable row level security;
alter table public.payroll_periods force row level security;
alter table public.payroll_entries enable row level security;
alter table public.payroll_entries force row level security;
alter table public.payroll_bonuses enable row level security;
alter table public.payroll_bonuses force row level security;
alter table public.payroll_deductions enable row level security;
alter table public.payroll_deductions force row level security;

-- Setări: doar cine administrează salarizarea (org_admin, hr) le vede sau le scrie.
create policy payroll_settings_select on public.payroll_settings
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'payroll', 'read', 'all')
  );
create policy payroll_settings_insert on public.payroll_settings
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'payroll')
    and app.can(organization_id, 'payroll', 'update', 'all')
    and deleted_at is null
  );
create policy payroll_settings_update on public.payroll_settings
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'payroll', 'update', 'all')
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'payroll', 'update', 'all')
  );

create policy ppdb_select on public.payroll_personal_deduction_brackets
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'payroll', 'read', 'all')
  );
create policy ppdb_insert on public.payroll_personal_deduction_brackets
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'payroll', 'update', 'all')
    and deleted_at is null
  );
create policy ppdb_update on public.payroll_personal_deduction_brackets
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'payroll', 'update', 'all')
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'payroll', 'update', 'all')
  );

-- Perioade: rămân un concept administrativ — angajatul își vede plata prin
-- payroll_entries, nu prin lista de perioade a organizației.
create policy payroll_periods_select on public.payroll_periods
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'payroll', 'read', 'all')
  );
create policy payroll_periods_insert on public.payroll_periods
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'payroll')
    and app.can(organization_id, 'payroll', 'create', 'all')
    and deleted_at is null
    and status = 'draft'
  );
create policy payroll_periods_update on public.payroll_periods
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      app.can(organization_id, 'payroll', 'approve', 'all')
      or app.can(organization_id, 'payroll', 'update', 'all')
    )
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      app.can(organization_id, 'payroll', 'approve', 'all')
      or app.can(organization_id, 'payroll', 'update', 'all')
    )
  );

create policy payroll_entries_select on public.payroll_entries
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      app.poate_accesa_salariul(organization_id, employee_id, 'read')
      and (
        app.has_permission(organization_id, 'payroll', 'read') = 'all'
        or exists (
          select 1 from public.payroll_periods p
          where p.id = payroll_entries.period_id and p.status in ('aprobat', 'inchis')
        )
      )
    )
  );
create policy payroll_entries_insert on public.payroll_entries
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'payroll', 'create', 'all')
    and deleted_at is null
    and exists (
      select 1 from public.payroll_periods p
      where p.id = payroll_entries.period_id and p.organization_id = payroll_entries.organization_id
        and p.status = 'draft'
    )
  );
create policy payroll_entries_update on public.payroll_entries
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'payroll', 'update', 'all')
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'payroll', 'update', 'all')
    and exists (
      select 1 from public.payroll_periods p
      where p.id = payroll_entries.period_id and p.organization_id = payroll_entries.organization_id
        and p.status = 'draft'
    )
  );

create policy payroll_bonuses_select on public.payroll_bonuses
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.poate_accesa_salariul(organization_id, employee_id, 'read')
  );
create policy payroll_bonuses_insert on public.payroll_bonuses
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'payroll', 'create', 'all')
    and deleted_at is null
    and exists (
      select 1 from public.payroll_periods p
      where p.id = payroll_bonuses.period_id and p.organization_id = payroll_bonuses.organization_id
        and p.status = 'draft'
    )
  );
create policy payroll_bonuses_update on public.payroll_bonuses
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'payroll', 'update', 'all')
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'payroll', 'update', 'all')
    and exists (
      select 1 from public.payroll_periods p
      where p.id = payroll_bonuses.period_id and p.organization_id = payroll_bonuses.organization_id
        and p.status = 'draft'
    )
  );

create policy payroll_deductions_select on public.payroll_deductions
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.poate_accesa_salariul(organization_id, employee_id, 'read')
  );
create policy payroll_deductions_insert on public.payroll_deductions
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'payroll', 'create', 'all')
    and deleted_at is null
    and exists (
      select 1 from public.payroll_periods p
      where p.id = payroll_deductions.period_id and p.organization_id = payroll_deductions.organization_id
        and p.status = 'draft'
    )
  );
create policy payroll_deductions_update on public.payroll_deductions
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'payroll', 'update', 'all')
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'payroll', 'update', 'all')
    and exists (
      select 1 from public.payroll_periods p
      where p.id = payroll_deductions.period_id and p.organization_id = payroll_deductions.organization_id
        and p.status = 'draft'
    )
  );

-- ============================================================
-- 11. GRANT-uri — fără DELETE, ca peste tot: soft delete + REVOKE e regula.
-- ============================================================

grant select, insert, update on public.payroll_settings                       to authenticated;
grant select, insert, update on public.payroll_personal_deduction_brackets    to authenticated;
grant select, insert, update on public.payroll_periods                        to authenticated;
grant select, insert, update on public.payroll_entries                        to authenticated;
grant select, insert, update on public.payroll_bonuses                        to authenticated;
grant select, insert, update on public.payroll_deductions                     to authenticated;

grant all on public.payroll_settings, public.payroll_personal_deduction_brackets,
             public.payroll_periods, public.payroll_entries,
             public.payroll_bonuses, public.payroll_deductions
  to service_role;

-- ============================================================
-- 12. AUDIT
-- ============================================================

select internal.attach_audit('payroll_settings');
select internal.attach_audit('payroll_personal_deduction_brackets');
select internal.attach_audit('payroll_periods');
select internal.attach_audit('payroll_entries');
select internal.attach_audit('payroll_bonuses');
select internal.attach_audit('payroll_deductions');
