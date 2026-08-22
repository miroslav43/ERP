-- supabase/migrations/0059_salarizare_popriri.sql
--
-- Dosarele de poprire, cu soldul lor.
--
-- `payroll_deductions` avea din 0026 tipul `poprire` și o coloană
-- `procent_maxim_din_net`, dar nimic care să țină SOLDUL datoriei. Consecințele
-- erau două, ambele grave:
--
--   - reținerea nu se oprea niciodată singură. Datoria se stingea, iar suma
--     continua să fie reținută lună de lună, până observa cineva;
--   - plafonul se aplica pe fiecare reținere separat, deci două popriri de câte
--     o treime din net treceau amândouă, deși legea limitează cumulul la
--     jumătate.
--
-- Legea (Codul de procedură civilă): o singură poprire ia cel mult o treime din
-- salariul net lunar; popririle concurente cel mult jumătate, CUMULAT.
-- Creanțele de întreținere se satisfac primele. ⚠️ Fracțiunile intră ca setări,
-- nu ca literale în cod — vezi NOTES.md §3.

\set ON_ERROR_STOP on

begin;

create type public.garnishment_claim_type as enum ('intretinere', 'alta');

create table public.payroll_garnishments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  employee_id      uuid not null references public.employees (id) on delete restrict,
  dosar            text not null,
  executor         text,
  creditor         text not null,
  tip_creanta      public.garnishment_claim_type not null default 'alta',
  suma_totala      numeric(14, 2) not null,
  suma_recuperata  numeric(14, 2) not null default 0,
  suma_lunara      numeric(14, 2) not null,
  prioritate       smallint not null default 100,
  data_inceput     date not null,
  data_sfarsit     date,
  activa           boolean not null default true,
  observatii       text,
  created_at       timestamptz not null default now(),
  created_by       uuid references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  deleted_at       timestamptz,
  constraint pg_sume_ck check (
    suma_totala > 0 and suma_lunara > 0 and suma_recuperata >= 0
    and suma_recuperata <= suma_totala
  ),
  constraint pg_dosar_len check (char_length(dosar) between 1 and 100),
  constraint pg_creditor_len check (char_length(creditor) between 1 and 200),
  constraint pg_interval_ck check (data_sfarsit is null or data_sfarsit >= data_inceput)
);

-- Soldul e o coloană GENERATĂ: dacă ar fi scrisă de aplicație, s-ar putea
-- despărți de suma recuperată la orice scriere ratată, iar o poprire ar
-- continua să rețină dintr-o datorie deja stinsă.
alter table public.payroll_garnishments
  add column sold_ramas numeric(14, 2)
  generated always as (suma_totala - suma_recuperata) stored;

create unique index payroll_garnishments_dosar_uq
  on public.payroll_garnishments (organization_id, employee_id, dosar)
  where deleted_at is null;
create index payroll_garnishments_activa_idx
  on public.payroll_garnishments (organization_id, employee_id, prioritate)
  where deleted_at is null and activa;
create index payroll_garnishments_created_by_idx on public.payroll_garnishments (created_by);
create index payroll_garnishments_updated_by_idx on public.payroll_garnishments (updated_by);

comment on table public.payroll_garnishments is
  'Dosare de executare silită. Soldul e generat din suma totală minus cea recuperată, ca reținerea să se oprească singură când datoria se stinge.';
comment on column public.payroll_garnishments.tip_creanta is
  'Creanțele de întreținere se satisfac ÎNAINTEA celorlalte, când plafonul nu ajunge pentru toate.';

alter table public.payroll_deductions
  add column if not exists garnishment_id uuid references public.payroll_garnishments (id) on delete set null;
create index payroll_deductions_garnishment_idx
  on public.payroll_deductions (garnishment_id) where deleted_at is null;

alter table public.payroll_settings
  add column if not exists plafon_poprire_unica       numeric(6, 4) not null default 0.3333,
  add column if not exists plafon_popriri_concurente  numeric(6, 4) not null default 0.5;

alter table public.payroll_settings
  add constraint payroll_settings_plafoane_poprire_ck
  check (
    plafon_poprire_unica between 0 and 1
    and plafon_popriri_concurente between 0 and 1
    and plafon_popriri_concurente >= plafon_poprire_unica
  );

comment on column public.payroll_settings.plafon_poprire_unica is
  '⚠️ DE CONFIRMAT de jurist. Fracțiunea maximă din net pentru o singură poprire.';
comment on column public.payroll_settings.plafon_popriri_concurente is
  '⚠️ DE CONFIRMAT de jurist. Fracțiunea maximă CUMULATĂ când sunt mai multe popriri.';

create trigger payroll_garnishments_set_updated_at
  before update on public.payroll_garnishments
  for each row execute function internal.seteaza_updated_at();

alter table public.payroll_garnishments enable row level security;
alter table public.payroll_garnishments force row level security;

create policy payroll_garnishments_select on public.payroll_garnishments
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.poate_accesa_salariul(organization_id, employee_id, 'read')
  );
create policy payroll_garnishments_insert on public.payroll_garnishments
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'payroll', 'create', 'all')
    and deleted_at is null
    and suma_recuperata = 0
  );
create policy payroll_garnishments_update on public.payroll_garnishments
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'payroll', 'update', 'all')
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'payroll', 'update', 'all')
  );

grant select, insert, update on public.payroll_garnishments to authenticated;
revoke delete on public.payroll_garnishments from authenticated;
grant all on public.payroll_garnishments to service_role;

select internal.attach_audit('payroll_garnishments');

commit;
