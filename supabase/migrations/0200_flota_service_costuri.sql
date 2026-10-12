-- supabase/migrations/0200_flota_service_costuri.sql
--
-- FLOTA, FAZA F7: SERVICE, COSTURI, ANVELOPE.
--
-- Planul o numea `0177_flota_service_costuri`; între timp 0174–0199 s-au ocupat
-- (mentenanță, registru, asistent, salarizare, tichete, aprobatori, KPI și
-- fazele F3–F6 ale flotei), deci e 0200.
--
-- ── DE UNDE VINE ────────────────────────────────────────────────────────────
-- Flota ținea documentele și foile, dar nu și viața mecanică a mașinii: când
-- trebuie schimbat uleiul, cât a costat reparația de luna trecută, ce anvelope
-- are montate. Tipul de document `revizie` era singurul loc unde „revizia” putea
-- fi scrisă, și acolo e o dată de expirare, nu o intervenție cu kilometri și
-- cost. Tabelele sunt PROPRII flotei, nu `equipment.vehicle_id`: flota trebuie
-- să meargă cu `maintenance` oprit, iar utilajele nu au kilometri de bord.
--
-- ── CE ADUCE ────────────────────────────────────────────────────────────────
-- A. `vehicle_service_plans`: planuri de revizie pe interval de kilometri
--    și/sau de luni. `ultima_*` (cea mai recentă dintre baza introdusă de om și
--    intervențiile legate) și `urmatoarea_data`/`urmatorii_km` le calculează un
--    trigger BEFORE. Scadența pe DATĂ se proiectează în `expirables` cu
--    `entity_type = 'vehicle_service'` (entity_id = vehiculul, `kind` = planul),
--    deci intră în semafor și în alertele din 0008 cu aceleași praguri ca
--    documentele. Scadența pe KILOMETRI nu are dată și nu intră în `expirables`:
--    o ia jobul zilnic (F).
-- B. `vehicle_service_entries`: intervenția făcută (dată, km, tip, furnizor,
--    factură, cost piese + manoperă, `cost_total` GENERATED). Triggerul AFTER
--    ridică `vehicles.km_curent` (kilometrajul de bord din service e de
--    încredere), pune planul legat să-și recalculeze scadența și, la o
--    intervenție de tip `anvelope`, trece pe vehicul anvelopele montate.
--    Intervențiile NU se modifică după inserare (cifrele, legătura de plan,
--    kilometrii): se șterg logic și se reintroduc, ca planul să nu poată fi
--    mutat de o corectură tăcută.
-- C. `vehicle_expenses`: cheltuieli care nu sunt service și nu sunt pe foaie
--    (combustibil fără foaie, parcare, spălătorie, taxă de drum, pod, TollRo).
-- D. `vehicles.anvelope_montate` (vară / iarnă / all-season).
-- E. `app.poate_vedea_expirabil` primește ramura `vehicle_service` — rescrisă
--    COMPLET, de la forma ultimă (0011:481; nicio migrare ulterioară n-a mai
--    redefinit-o, verificat cu grep), nu doar adăugată: funcția e un `case`, iar
--    un ecou parțial ar pierde tăcut ramurile celorlalte module. Garda din
--    0023:89 (nicio ramură nu acceptă `employees:read` cu scope `own`) trece.
-- F. Jobul zilnic din F5 (`internal.conformitate_zilnica`, forma 0198):
--    · rezumatul datelor primește și `vehicle_service`;
--    · `internal.flota_memento_service`: alerta pe kilometri (`km_curent >=
--      urmatorii_km - prag`, o dată la „aproape” și o dată la „depășit”, per
--      ciclu) și memento-ul sezonier din noiembrie pentru vehiculele cu
--      anvelope de vară; dedup prin `internal.flota_mementouri`;
--    · pragurile de alertă din `/flota/setari` se oglindesc acum și pentru
--      `vehicle_service` (trigger rescris de la forma 0198, plus backfill).
-- G. Tipul de document `revizie` se dezactivează pe platformă (UPDATE, ca în
--    0116). Documentele deja existente pe el rămân și rămân corectabile; o firmă
--    care vrea tipul îl reactivează din setările de tipuri (0199).
--
-- ── CE NU FACE ──────────────────────────────────────────────────────────────
--  · Nu atinge `app.can_path`, `internal.vehicles_normalizeaza`, `vehicles_dupa`,
--    `foi_parcurs_*`. Sincronizarea scadențelor de service pe schimbările
--    vehiculului (vândut, șters, alt șofer) stă într-un trigger propriu
--    (`vehicles_service_sync`), nu în `vehicles_dupa`.
--  · Nu adaugă permisiuni: scrierea cere `vehicles:update = all`, citirea
--    `vehicles:read >= team` ȘI vizibilitatea vehiculului. Șoferul (`own`) nu
--    vede costurile mașinii; află de scadență din notificare.
--  · Nu adaugă politici DELETE (ștergerea e logică).
--
-- Aplicare: psql byte-exact, după bancul local; producția cere confirmare.

begin;

-- ============================================================
-- 1. Tipuri și coloana de anvelope
-- ============================================================
create type public.vehicle_service_type as enum (
  'revizie', 'reparatie', 'anvelope', 'dauna', 'altele'
);

create type public.vehicle_expense_category as enum (
  'combustibil_fara_foaie', 'parcare', 'spalatorie', 'taxa_drum', 'taxa_pod', 'tollro', 'altele'
);

create type public.vehicle_tire_set as enum ('vara', 'iarna', 'all_season');

alter table public.vehicles add column anvelope_montate public.vehicle_tire_set;

comment on column public.vehicles.anvelope_montate is
  'Anvelopele montate acum (0200). NULL = necunoscut. Se schimbă din formularul vehiculului sau printr-o intervenție de service de tip „anvelope”. „vara” declanșează memento-ul din noiembrie.';

-- ============================================================
-- 2. Planurile de service
-- ============================================================
create table public.vehicle_service_plans (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  vehicle_id         uuid not null references public.vehicles (id) on delete cascade,
  denumire           text not null,
  tip                public.vehicle_service_type not null default 'revizie',
  interval_km        integer,
  interval_luni      smallint,
  -- BAZA: de unde numără planul (ultima intervenție cunoscută la crearea lui).
  -- O introduce omul; formularul o precompletează cu azi și kilometrajul curent.
  baza_data          date not null,
  baza_km            integer not null,
  -- DERIVATE (trigger BEFORE `vsp_inainte`; ce trimite clientul se ignoră):
  -- ultima = cea mai recentă dintre bază și intervențiile legate, apoi
  -- următoarea = ultima + intervalul.
  ultima_data        date not null default ((now() at time zone 'Europe/Bucharest')::date),
  ultimii_km         integer not null default 0,
  urmatoarea_data    date,
  urmatorii_km       integer,
  -- Cu câți km înainte de scadență pleacă prima alertă.
  prag_avertizare_km integer not null default 1000,
  activ              boolean not null default true,
  observatii         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references auth.users (id) on delete set null,
  updated_by         uuid references auth.users (id) on delete set null,
  deleted_at         timestamptz,
  constraint vsp_denumire_len check (char_length(btrim(denumire)) between 2 and 120),
  constraint vsp_interval_ck check (interval_km is not null or interval_luni is not null),
  constraint vsp_interval_km_ck check (interval_km is null or interval_km between 100 and 1000000),
  constraint vsp_interval_luni_ck check (interval_luni is null or interval_luni between 1 and 240),
  constraint vsp_baza_km_ck check (baza_km between 0 and 10000000),
  constraint vsp_ultimii_km_ck check (ultimii_km between 0 and 10000000),
  constraint vsp_prag_km_ck check (prag_avertizare_km between 0 and 100000),
  constraint vsp_obs_len check (observatii is null or char_length(observatii) <= 1000)
);

comment on table public.vehicle_service_plans is
  'Planurile de service ale unui vehicul (0200): interval în km și/sau luni. Scadența pe dată intră în expirables (entity_type = vehicle_service), cea pe kilometri o ia jobul zilnic.';

create index vsp_vehicul_idx
  on public.vehicle_service_plans (vehicle_id)
  where deleted_at is null;
create index vsp_org_scadenta_idx
  on public.vehicle_service_plans (organization_id, urmatoarea_data)
  where deleted_at is null and activ;
-- Un vehicul nu are două planuri cu același nume (altfel lista și alertele s-ar dubla).
create unique index vsp_vehicul_denumire_uq
  on public.vehicle_service_plans (vehicle_id, lower(denumire))
  where deleted_at is null;

-- ============================================================
-- 3. Intervențiile de service
-- ============================================================
create table public.vehicle_service_entries (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  vehicle_id       uuid not null references public.vehicles (id) on delete cascade,
  plan_id          uuid references public.vehicle_service_plans (id) on delete set null,
  data_interventiei date not null,
  km               integer not null,
  tip              public.vehicle_service_type not null,
  descriere        text not null,
  furnizor         text,
  numar_factura    text,
  cost_piese       numeric(12, 2) not null default 0,
  cost_manopera    numeric(12, 2) not null default 0,
  cost_total       numeric(12, 2) generated always as (cost_piese + cost_manopera) stored,
  -- Doar la tipul „anvelope”: ce anvelope au rămas montate după intervenție.
  anvelope_montate public.vehicle_tire_set,
  observatii       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references auth.users (id) on delete set null,
  updated_by       uuid references auth.users (id) on delete set null,
  deleted_at       timestamptz,
  constraint vse_km_ck check (km between 0 and 10000000),
  constraint vse_costuri_ck check (cost_piese >= 0 and cost_manopera >= 0),
  constraint vse_descriere_len check (char_length(btrim(descriere)) between 2 and 500),
  constraint vse_furnizor_len check (furnizor is null or char_length(furnizor) <= 120),
  constraint vse_factura_len check (numar_factura is null or char_length(numar_factura) <= 60),
  constraint vse_obs_len check (observatii is null or char_length(observatii) <= 1000),
  constraint vse_anvelope_ck check (anvelope_montate is null or tip = 'anvelope')
);

comment on table public.vehicle_service_entries is
  'Intervențiile de service făcute (0200): dată, km, tip, furnizor, factură, cost piese + manoperă. Nu se modifică după inserare, doar se șterg logic.';

create index vse_vehicul_idx
  on public.vehicle_service_entries (vehicle_id, data_interventiei desc, id desc)
  where deleted_at is null;
create index vse_plan_idx
  on public.vehicle_service_entries (plan_id)
  where deleted_at is null and plan_id is not null;
create index vse_org_data_idx
  on public.vehicle_service_entries (organization_id, data_interventiei)
  where deleted_at is null;

-- ============================================================
-- 4. Cheltuielile pe vehicul
-- ============================================================
create table public.vehicle_expenses (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  vehicle_id        uuid not null references public.vehicles (id) on delete cascade,
  categorie         public.vehicle_expense_category not null,
  data_cheltuielii  date not null,
  suma              numeric(12, 2) not null,
  -- Doar la „combustibil fără foaie”: litrii cumpărați.
  litri             numeric(8, 2),
  km_bord           integer,
  numar_document    text,
  observatii        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users (id) on delete set null,
  updated_by        uuid references auth.users (id) on delete set null,
  deleted_at        timestamptz,
  constraint vex_suma_ck check (suma > 0),
  constraint vex_litri_ck check (litri is null or (litri > 0 and categorie = 'combustibil_fara_foaie')),
  constraint vex_km_ck check (km_bord is null or km_bord between 0 and 10000000),
  constraint vex_document_len check (numar_document is null or char_length(numar_document) <= 60),
  constraint vex_obs_len check (observatii is null or char_length(observatii) <= 1000)
);

comment on table public.vehicle_expenses is
  'Cheltuieli pe vehicul care nu sunt service și nu sunt pe foaia de parcurs (0200): combustibil fără foaie, parcare, spălătorie, taxe. Suma în lei, cu TVA.';

create index vex_vehicul_idx
  on public.vehicle_expenses (vehicle_id, data_cheltuielii desc, id desc)
  where deleted_at is null;
create index vex_org_data_idx
  on public.vehicle_expenses (organization_id, data_cheltuielii)
  where deleted_at is null;

-- ============================================================
-- 5. Memento-uri trimise (dedup pentru alertele care nu au dată)
-- ============================================================
-- Alerta pe kilometri și memento-ul de anvelope nu au un rând în
-- `compliance_alerts` (nu există dată de expirare), deci nu pot folosi
-- `alert_notifications`. Cheia spune CE s-a trimis: planul + ținta de km, ori
-- anul. Tabela e în schema `internal`: PostgREST n-o expune, iar jobul (definer)
-- e singurul ei utilizator.
create table internal.flota_mementouri (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vehicle_id      uuid not null references public.vehicles (id) on delete cascade,
  tip             text not null,
  cheie           text not null,
  trimis_la       timestamptz not null default now(),
  primary key (vehicle_id, tip, cheie),
  constraint flota_mementouri_tip_ck
    check (tip in ('service_km_aproape', 'service_km_depasit', 'anvelope_iarna'))
);

revoke all on internal.flota_mementouri from public, anon, authenticated;
grant select, insert on internal.flota_mementouri to service_role;

comment on table internal.flota_mementouri is
  'Memento-urile de flotă fără dată de expirare deja trimise (0200): alerta pe km a unui plan, memento-ul de anvelope din noiembrie. Cheia = ce s-a trimis; fără rând, jobul zilnic îl trimite.';

-- ============================================================
-- 6. Gărzile și derivatele
-- ============================================================
-- Triggerele de aici verifică INTEGRITATE (aceeași firmă, vehicul viu, date
-- coerente), nu drepturi: drepturile le judecă politicile de la §8. Rulează ca
-- definer ca să vadă `vehicles`/`employees` indiferent de RLS-ul apelantului.

-- Vehiculul trebuie să existe, să fie viu și al firmei rândului. Un `vehicle_id`
-- din altă firmă nu trece de FK (FK-ul nu știe de firmă), deci garda e aici.
create or replace function internal.flota_vehicul_al_firmei(p_org uuid, p_vehicle uuid)
returns public.vehicles
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_veh public.vehicles%rowtype;
begin
  select * into v_veh
    from public.vehicles v
   where v.id = p_vehicle and v.organization_id = p_org and v.deleted_at is null;
  if not found then
    raise exception using errcode = 'P0001',
      message = 'Vehiculul ales nu există în organizația dumneavoastră.';
  end if;
  return v_veh;
end;
$$;

-- ── Planul: gărzi + ultima/următoarea ───────────────────────────────────────
create or replace function internal.vsp_inainte()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_veh public.vehicles%rowtype;
  v_d   date;
  v_k   integer;
begin
  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id
       or new.vehicle_id is distinct from old.vehicle_id then
      raise exception using errcode = 'P0001',
        message = 'Planul de service nu se mută pe alt vehicul.';
    end if;
  else
    v_veh := internal.flota_vehicul_al_firmei(new.organization_id, new.vehicle_id);
    if v_veh.status in ('vandut', 'casat') then
      raise exception using errcode = 'P0001',
        message = 'Vehiculul a ieșit din parc: nu i se mai adaugă planuri de service.';
    end if;
  end if;

  if new.baza_data > app.azi_local()
     and (tg_op = 'INSERT' or new.baza_data is distinct from old.baza_data) then
    raise exception using errcode = 'P0001',
      message = 'Data ultimei intervenții nu poate fi în viitor.';
  end if;

  -- Ultima = cea mai recentă dintre bază și intervențiile vii legate de plan.
  -- (data, km) se compară ca pereche: două intervenții în aceeași zi, câștigă
  -- cea cu kilometri mai mulți.
  new.ultima_data := new.baza_data;
  new.ultimii_km := new.baza_km;
  if tg_op = 'UPDATE' then
    select e.data_interventiei, e.km into v_d, v_k
      from public.vehicle_service_entries e
     where e.plan_id = new.id and e.deleted_at is null
     order by e.data_interventiei desc, e.km desc, e.created_at desc
     limit 1;
    if v_d is not null and (v_d, v_k) > (new.baza_data, new.baza_km) then
      new.ultima_data := v_d;
      new.ultimii_km := v_k;
    end if;
  end if;

  new.urmatoarea_data := case
    when new.interval_luni is null then null
    else (new.ultima_data + make_interval(months => new.interval_luni::integer))::date
  end;
  new.urmatorii_km := case
    when new.interval_km is null then null
    else new.ultimii_km + new.interval_km
  end;
  return new;
end;
$$;

create trigger vsp_inainte
  before insert or update on public.vehicle_service_plans
  for each row execute function internal.vsp_inainte();

-- Proiecția scadenței pe dată în `expirables`. Planul șters sau oprit, ori fără
-- interval în luni, înseamnă dată nulă: `sync_expirable` închide rândul și
-- alertele lui deschise. Vehiculul vândut/casat/șters rămâne în tabel, dar
-- inactiv (ca documentele). `entity_id` e VEHICULUL (ca la `vehicle_document`),
-- iar `kind` identifică planul: unicitatea (org, tip, entitate, kind) lasă un
-- vehicul să aibă oricâte planuri.
create or replace function internal.vsp_sincronizeaza(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.vehicle_service_plans%rowtype;
  v public.vehicles%rowtype;
begin
  select * into p from public.vehicle_service_plans where id = p_plan_id;
  if not found then
    return;
  end if;
  select * into v from public.vehicles where id = p.vehicle_id;
  if not found then
    return;
  end if;

  perform internal.sync_expirable(
    p.organization_id,
    'vehicle_service',
    p.vehicle_id,
    'plan_' || replace(p.id::text, '-', ''),
    p.denumire || ' — ' || coalesce(v.nr_inmatriculare, '?'),
    case when p.deleted_at is null and p.activ then p.urmatoarea_data else null end,
    'vehicle_service_plans',
    v.employee_id,
    (v.deleted_at is null and v.status in ('activ', 'in_service'))
  );
end;
$$;

create or replace function internal.vsp_dupa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform internal.vsp_sincronizeaza(new.id);
  return null;
end;
$$;

create trigger vsp_dupa
  after insert or update on public.vehicle_service_plans
  for each row execute function internal.vsp_dupa();

-- Vehiculul își schimbă starea, șoferul sau numărul: scadențele planurilor lui
-- îl urmează. Trigger separat de `vehicles_dupa` (0012), ca să nu rescriu o
-- funcție care sincronizează documentele.
create or replace function internal.vsp_resincronizeaza_vehicul()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (old.status, old.deleted_at, old.employee_id, old.nr_inmatriculare)
     is distinct from (new.status, new.deleted_at, new.employee_id, new.nr_inmatriculare) then
    perform internal.vsp_sincronizeaza(p.id)
       from public.vehicle_service_plans p
      where p.vehicle_id = new.id and p.deleted_at is null;
  end if;
  return null;
end;
$$;

create trigger vehicles_service_sync
  after update on public.vehicles
  for each row execute function internal.vsp_resincronizeaza_vehicul();

-- ── Intervenția: gărzi, apoi efectele asupra vehiculului și planului ────────
create or replace function internal.vse_inainte()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.vehicle_service_plans%rowtype;
begin
  if tg_op = 'UPDATE' then
    -- Doar ștergerea logică și textele libere se schimbă după inserare.
    if (new.organization_id, new.vehicle_id, new.plan_id, new.data_interventiei, new.km, new.tip,
        new.cost_piese, new.cost_manopera, new.anvelope_montate)
       is distinct from
       (old.organization_id, old.vehicle_id, old.plan_id, old.data_interventiei, old.km, old.tip,
        old.cost_piese, old.cost_manopera, old.anvelope_montate) then
      raise exception using errcode = 'P0001',
        message = 'Intervenția de service nu se modifică: ștergeți-o și adăugați-o din nou.';
    end if;
    return new;
  end if;

  perform internal.flota_vehicul_al_firmei(new.organization_id, new.vehicle_id);

  if new.data_interventiei > app.azi_local() then
    raise exception using errcode = 'P0001',
      message = 'Data intervenției nu poate fi în viitor.';
  end if;

  if new.plan_id is not null then
    select * into v_plan
      from public.vehicle_service_plans p
     where p.id = new.plan_id and p.deleted_at is null;
    if not found
       or v_plan.organization_id is distinct from new.organization_id
       or v_plan.vehicle_id is distinct from new.vehicle_id then
      raise exception using errcode = 'P0001',
        message = 'Planul ales nu aparține acestui vehicul.';
    end if;
  end if;
  return new;
end;
$$;

create trigger vse_inainte
  before insert or update on public.vehicle_service_entries
  for each row execute function internal.vse_inainte();

create or replace function internal.vse_dupa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anvelope public.vehicle_tire_set;
  v_schimbat boolean := tg_op = 'INSERT' or new.deleted_at is distinct from old.deleted_at;
begin
  -- Kilometrajul de bord din service ridică kilometrajul vehiculului (nu îl
  -- coboară niciodată: o intervenție veche, introdusă târziu, rămâne istoric).
  if tg_op = 'INSERT' and new.deleted_at is null then
    update public.vehicles v
       set km_curent = new.km, updated_at = now()
     where v.id = new.vehicle_id and v.km_curent < new.km;
  end if;

  -- Planul legat își recalculează ultima/următoarea (trigger-ul lui BEFORE) la
  -- inserarea sau ștergerea unei intervenții; ștearsă, planul revine la
  -- intervenția anterioară sau la bază.
  if new.plan_id is not null and v_schimbat then
    update public.vehicle_service_plans p
       set updated_at = now()
     where p.id = new.plan_id and p.deleted_at is null;
  end if;

  -- Anvelopele montate: ultima intervenție vie de tip „anvelope” care le
  -- precizează. Ștearsă ultima, câștigă cea dinainte; fără niciuna, vehiculul
  -- își păstrează valoarea.
  if new.tip = 'anvelope' and new.anvelope_montate is not null and v_schimbat then
    select e.anvelope_montate into v_anvelope
      from public.vehicle_service_entries e
     where e.vehicle_id = new.vehicle_id and e.deleted_at is null and e.anvelope_montate is not null
     order by e.data_interventiei desc, e.created_at desc
     limit 1;
    if v_anvelope is not null then
      update public.vehicles v
         set anvelope_montate = v_anvelope, updated_at = now()
       where v.id = new.vehicle_id and v.anvelope_montate is distinct from v_anvelope;
    end if;
  end if;
  return null;
end;
$$;

create trigger vse_dupa
  after insert or update on public.vehicle_service_entries
  for each row execute function internal.vse_dupa();

-- ── Cheltuiala: gărzi ───────────────────────────────────────────────────────
create or replace function internal.vex_inainte()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if (new.organization_id, new.vehicle_id) is distinct from (old.organization_id, old.vehicle_id) then
      raise exception using errcode = 'P0001',
        message = 'Cheltuiala nu se mută pe alt vehicul.';
    end if;
  else
    perform internal.flota_vehicul_al_firmei(new.organization_id, new.vehicle_id);
  end if;
  if new.data_cheltuielii > app.azi_local()
     and (tg_op = 'INSERT' or new.data_cheltuielii is distinct from old.data_cheltuielii) then
    raise exception using errcode = 'P0001',
      message = 'Data cheltuielii nu poate fi în viitor.';
  end if;
  return new;
end;
$$;

create trigger vex_inainte
  before insert or update on public.vehicle_expenses
  for each row execute function internal.vex_inainte();

-- ============================================================
-- 7. RLS
-- ============================================================
alter table public.vehicle_service_plans enable row level security;
alter table public.vehicle_service_plans force row level security;
alter table public.vehicle_service_entries enable row level security;
alter table public.vehicle_service_entries force row level security;
alter table public.vehicle_expenses enable row level security;
alter table public.vehicle_expenses force row level security;

-- Citire: costurile și planurile de service sunt date de administrare, nu de
-- exploatare. Cine vede parcul cu `team` sau `all` (managerul pe mașinile
-- echipei lui, administratorul pe toate) le vede; șoferul (`own`) nu — află de
-- scadență din notificare, nu din cifrele de pe factură.
create policy vsp_select on public.vehicle_service_plans
  for select to authenticated
  using (
    (select app.is_platform_admin())
    or (
      organization_id = any ((select app.current_org_ids())::uuid[])
      and app.feature_on(organization_id, 'fleet')
      and app.can(organization_id, 'vehicles', 'read', 'team')
      and app.poate_vedea_vehicul_dupa_id(organization_id, vehicle_id)
    )
  );

create policy vse_select on public.vehicle_service_entries
  for select to authenticated
  using (
    (select app.is_platform_admin())
    or (
      organization_id = any ((select app.current_org_ids())::uuid[])
      and app.feature_on(organization_id, 'fleet')
      and app.can(organization_id, 'vehicles', 'read', 'team')
      and app.poate_vedea_vehicul_dupa_id(organization_id, vehicle_id)
    )
  );

create policy vex_select on public.vehicle_expenses
  for select to authenticated
  using (
    (select app.is_platform_admin())
    or (
      organization_id = any ((select app.current_org_ids())::uuid[])
      and app.feature_on(organization_id, 'fleet')
      and app.can(organization_id, 'vehicles', 'read', 'team')
      and app.poate_vedea_vehicul_dupa_id(organization_id, vehicle_id)
    )
  );

-- Scriere: `vehicles:update = all`, ca alocările și documentele.
create policy vsp_insert on public.vehicle_service_plans
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );
create policy vse_insert on public.vehicle_service_entries
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );
create policy vex_insert on public.vehicle_expenses
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy vsp_update on public.vehicle_service_plans
  for update to authenticated
  using (
    deleted_at is null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
    and updated_by = (select auth.uid())
  );
create policy vse_update on public.vehicle_service_entries
  for update to authenticated
  using (
    deleted_at is null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
    and updated_by = (select auth.uid())
  );
create policy vex_update on public.vehicle_expenses
  for update to authenticated
  using (
    deleted_at is null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
    and updated_by = (select auth.uid())
  );

-- ============================================================
-- 8. Actor, audit, drepturi
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['vehicle_service_plans', 'vehicle_service_entries', 'vehicle_expenses'] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function internal.seteaza_updated_at()',
      t || '_set_updated_at', t);
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function internal.set_actor()',
      'trg_' || t || '_actor', t);
    perform internal.attach_audit(t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end
$$;

-- ============================================================
-- 9. app.poate_vedea_expirabil — rescriere COMPLETĂ, cu `vehicle_service`
-- ============================================================
-- Forma ultimă e cea din 0011:481 (verificat cu grep în TOATE migrările: 0008 și
-- 0010 sunt anterioare, 0012b/0015/0023/0182 o citesc sau o pomenesc, niciuna n-o
-- redefinește). Toate ramurile existente sunt copiate NESCHIMBATE; singura nouă
-- e `vehicle_service`, cu același drept ca `vehicle_document` (modulul pornit +
-- `vehicles:read` cel puțin `team`). NU acceptă niciodată `employees:read` cu
-- scope `own` (garda din 0023:89). O migrare viitoare care adaugă un
-- `entity_type` trebuie să pornească de la ACEASTA, nu de la 0011.
create or replace function app.poate_vedea_expirabil(p_organization_id uuid, p_entity_type text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case p_entity_type
    when 'medical_exam'             then app.feature_on(p_organization_id,'ssm')        and app.can(p_organization_id,'ssm','read','team')
    when 'employee_document'        then app.can(p_organization_id,'employees','read','team')
    when 'work_permit'              then app.can(p_organization_id,'employees','read','team')
    when 'employment_contract'      then app.can(p_organization_id,'employees','read','team')
    when 'vehicle_document'         then app.feature_on(p_organization_id,'fleet')       and app.can(p_organization_id,'vehicles','read','team')
    when 'vehicle_service'          then app.feature_on(p_organization_id,'fleet')       and app.can(p_organization_id,'vehicles','read','team')
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

-- ============================================================
-- 10. Pragurile de alertă ale flotei, și pentru service
-- ============================================================
-- Forma 0198, cu o singură schimbare: oglinda în `alert_rules` se scrie pentru
-- ambele tipuri de scadență a flotei.

create or replace function internal.flota_setari_praguri()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is not null then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.praguri_alerta_zile is not distinct from old.praguri_alerta_zile then
    return null;
  end if;

  -- 0200: aceleași praguri pentru scadențele de service pe dată
  -- (`vehicle_service`), nu doar pentru documente.
  insert into public.alert_rules as r
    (organization_id, entity_type, kind, praguri_zile, alerteaza_la_depasire, valabil_de_la)
  select new.organization_id, t.entity_type, '*', new.praguri_alerta_zile, true, app.azi_local()
    from unnest(array['vehicle_document', 'vehicle_service']) as t(entity_type)
  on conflict (organization_id, entity_type, kind, valabil_de_la) where deleted_at is null
  do update set praguri_zile = excluded.praguri_zile;
  return null;
end;
$$;

-- Firmele care și-au schimbat deja pragurile (rând în fleet_settings, altele
-- decât 30/14/7) primesc și regula pentru service, ca ecranul de setări să nu
-- mintă. Fără rând de setări, sau cu implicitele, motorul aplică oricum 30/14/7.
insert into public.alert_rules (organization_id, entity_type, kind, praguri_zile, alerteaza_la_depasire, valabil_de_la)
select s.organization_id, 'vehicle_service', '*', s.praguri_alerta_zile, true, app.azi_local()
  from public.fleet_settings s
 where s.deleted_at is null
   and s.praguri_alerta_zile is distinct from internal.praguri_implicite()
on conflict (organization_id, entity_type, kind, valabil_de_la) where deleted_at is null
do nothing;

-- ============================================================
-- 11. Rezumatul zilnic: și scadențele de service pe dată
-- ============================================================
-- Forma 0198, cu: lista albă extinsă la `vehicle_service`, formularea „scadent”
-- pentru service, titlul cu patru numărători (documente / lucrări de service) și
-- legătura spre fila „service” când toate elementele sunt de service. Fără
-- elemente de service, textul și legătura sunt cele de până acum.

create or replace function internal.flota_rezumat(p_org uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_azi date := app.azi_local();
  v_n   integer := 0;
begin
  if p_org is null then
    return 0;
  end if;

  with
  gestionari as (
    select r.user_id from internal.flota_responsabili(p_org) r
  ),
  -- Doar alertele scadenței CURENTE, în starea potrivită zilei: fără
  -- `curata_alerte`, un prag `nou` rămâne așa și după scadență, iar alertele
  -- unei scadențe vechi (documentul reînnoit) rămân și ele.
  elemente as (
    select a.id            as alert_id,
           x.id            as expirable_id,
           v.id            as vehicle_id,
           v.employee_id   as sofer_id,
           v.pool          as pool,
           (a.status = 'expirat') as depasita,
           (x.entity_type = 'vehicle_service') as e_service,
           x.expires_at,
           x.label || ': ' ||
             case when a.status = 'expirat'
                  then case when x.entity_type = 'vehicle_service' then 'scadent din ' else 'expirat din ' end
                       || to_char(x.expires_at, 'DD.MM.YYYY')
                  else case when x.entity_type = 'vehicle_service' then 'scadent pe ' else 'expiră pe ' end
                       || to_char(x.expires_at, 'DD.MM.YYYY') end as eticheta
      from public.compliance_alerts a
      join public.expirables x on x.id = a.expirable_id
      join public.vehicles v
        on v.id = x.entity_id
       and v.organization_id = p_org
       and v.deleted_at is null
     where a.organization_id = p_org
       and a.deleted_at is null
       and a.status in ('nou', 'expirat')
       and x.organization_id = p_org
       and x.deleted_at is null
       and x.is_active
       -- LISTA ALBĂ a flotei (0200: și scadențele de service pe dată). SSM și
       -- HR se adaugă aici, cu legătura lor.
       and x.entity_type in ('vehicle_document', 'vehicle_service')
       and a.due_date = x.expires_at
       and case when a.status = 'expirat' then x.expires_at < v_azi
                else x.expires_at >= v_azi end
  ),
  -- Fiecare responsabil primește DOAR vehiculele pe care le vede: unul cu
  -- `team` sau `own` (un manager, un angajat bifat de administrator) nu află
  -- din rezumat documentele și numerele restului parcului (revizuirea F5).
  vizibile as (
    select e.*, g.user_id
      from elemente e
      join gestionari g
        on internal.flota_vede_vehicul(p_org, g.user_id, e.sofer_id, e.pool)
  ),
  -- Documentul pe care nu-l vede NICIUN responsabil nu rămâne nevăzut: merge
  -- la administratorii activi, ca la firma fără responsabili.
  orfane as (
    select e.*, m.user_id
      from elemente e
      join public.organization_members m
        on m.organization_id = p_org
       and m.role = 'org_admin'
       and m.status = 'active'
       and m.deleted_at is null
     where not exists (select 1 from vizibile z where z.expirable_id = e.expirable_id)
       and internal.flota_vede_vehicul(p_org, m.user_id, e.sofer_id, e.pool)
  ),
  destinatari as (
    select * from vizibile
    union
    select * from orfane
    union
    select e.*, emp.user_id
      from elemente e
      join public.employees emp
        on emp.id = e.sofer_id
       and emp.organization_id = p_org
       and emp.deleted_at is null
       and emp.user_id is not null
      join public.organization_members m
        on m.organization_id = p_org
       and m.user_id = emp.user_id
       and m.status = 'active'
       and m.deleted_at is null
  ),
  -- Dreptul efectiv al fiecărui destinatar, o dată pe om: cine nu citește
  -- vehiculele (o suprascriere pe firmă sau pe membru) nu primește o legătură
  -- spre un ecran închis.
  scopuri as (
    select u.user_id, internal.scope_membru(p_org, u.user_id, 'vehicles', 'read') as scope
      from (select distinct d.user_id from destinatari d) u
  ),
  noi as (
    select d.*, s.scope
      from destinatari d
      join scopuri s on s.user_id = d.user_id
     where s.scope <> 'none'
       and not exists (
         select 1 from public.alert_notifications an
          where an.alert_id = d.alert_id
            and an.canal = 'in_app'
            and an.destinatar_cheie = d.user_id::text)
  ),
  -- Un document = un rând per om, chiar dacă scadența are mai multe alerte (la
  -- prima rulare, o scadență peste 5 zile atinge deodată pragurile 30, 14 și 7).
  distincte as (
    select distinct on (n.user_id, n.expirable_id)
           n.user_id, n.expirable_id, n.vehicle_id, n.depasita, n.e_service, n.expires_at, n.eticheta, n.scope
      from noi n
     order by n.user_id, n.expirable_id, n.depasita desc
  ),
  numerotate as (
    select d.*,
           row_number() over (partition by d.user_id
                              order by d.depasita desc, d.expires_at, d.eticheta) as rn
      from distincte d
  ),
  pe_om as (
    select n.user_id,
           min(n.scope::text)                                  as scope,
           count(*)::integer                                   as total,
           count(*) filter (where n.depasita and not n.e_service)::integer     as depasite,
           count(*) filter (where not n.depasita and not n.e_service)::integer as apropiate,
           count(*) filter (where n.depasita and n.e_service)::integer         as srv_depasite,
           count(*) filter (where not n.depasita and n.e_service)::integer     as srv_apropiate,
           count(*) filter (where n.e_service)::integer                        as srv_total,
           count(distinct n.vehicle_id)::integer               as vehicule,
           max(n.expires_at)                                   as ultima_scadenta,
           (array_agg(n.vehicle_id order by n.rn))[1]          as primul_vehicul,
           string_agg('· ' || n.eticheta, E'\n' order by n.rn) filter (where n.rn <= 8) as linii
      from numerotate n
     group by n.user_id
  ),
  scrise as (
    insert into public.notifications (user_id, organization_id, kind, title, body, link, entity_type, entity_id)
    select o.user_id,
           p_org,
           'reminder'::public.notification_kind,
           left('Flota: ' || array_to_string(array_remove(array[
             case when o.depasite > 0 then internal.flota_numarat(o.depasite, 'document expirat', 'documente expirate') end,
             case when o.apropiate > 0 then internal.flota_numarat(o.apropiate, 'document care expiră curând', 'documente care expiră curând') end,
             case when o.srv_depasite > 0 then internal.flota_numarat(o.srv_depasite, 'lucrare de service întârziată', 'lucrări de service întârziate') end,
             case when o.srv_apropiate > 0 then internal.flota_numarat(o.srv_apropiate, 'lucrare de service în curând', 'lucrări de service în curând') end
           ], null), ', ') || '.', 200),
           left(o.linii || case when o.total > 8
                                then E'\n… și încă ' || internal.flota_numarat(o.total - 8, 'document', 'documente') || '.'
                                else '' end, 4000),
           case
             when o.scope not in ('team', 'all') then '/portal/masina-mea'
             -- Doar scadențe de service: fișa se deschide pe fila ei.
             when o.vehicule = 1 and o.srv_total = o.total then '/flota/' || o.primul_vehicul::text || '?fila=service'
             when o.vehicule = 1 then '/flota/' || o.primul_vehicul::text
             -- Filtrul „expiră” al listei arată 30 de zile
             -- (`PRAG_FLOTA_AVERTIZARE_ZILE`, src/domain/fleet/scadente.ts; îl
             -- fixează setari.test.ts). Cu un prag al firmei mai lung (60),
             -- vehiculele de peste 30 de zile ar lipsi din el: lista întreagă.
             -- Filtrul „expiră” al listei e despre documente: fără ele, lista întreagă.
             when o.srv_total < o.total and o.ultima_scadenta <= v_azi + 30 then '/flota?conformitate=expira'
             else '/flota'
           end,
           case when o.vehicule = 1 then 'vehicle' else 'fleet_rezumat' end,
           case when o.vehicule = 1 then o.primul_vehicul end
      from pe_om o
    returning id, user_id
  ),
  marcate as (
    insert into public.alert_notifications
      (organization_id, alert_id, canal, recipient_user_id, notification_id, status, sent_at)
    select p_org, n.alert_id, 'in_app', n.user_id, s.id, 'trimis', now()
      from noi n
      join scrise s on s.user_id = n.user_id
    on conflict (alert_id, canal, destinatar_cheie) do nothing
    returning 1
  )
  -- Instrucțiunile care scriu din WITH rulează o dată și complet, citite sau nu
  -- de interogarea principală; se numără doar notificările.
  select count(*) into v_n from scrise;

  return coalesce(v_n, 0);
end;
$$;

comment on function internal.flota_rezumat(uuid) is
  'Rezumatul zilnic al scadențelor de flotă pe dată (vehicle_document și, din 0200, vehicle_service) pentru o firmă: o notificare per destinatar, doar cu elementele netrimise lui. Idempotentă: a doua rulare din aceeași zi nu scrie nimic.';

-- ============================================================
-- 12. Destinatarii unui vehicul și memento-urile fără dată
-- ============================================================
-- Aceeași regulă ca rezumatul: responsabilii care VĂD vehiculul; dacă niciunul,
-- administratorii care îl văd; plus șoferul alocat. Toți membri activi, cu
-- `vehicles:read` ≠ none. Un singur loc pentru regulă, ca memento-urile noi să
-- nu o rescrie încă o dată.
create or replace function internal.flota_destinatari(p_org uuid, p_sofer uuid, p_pool boolean)
returns table (user_id uuid, scope text)
language sql
stable
security definer
set search_path = ''
as $$
  with gestionari as (
    select r.user_id from internal.flota_responsabili(p_org) r
  ),
  vizibili as (
    select g.user_id
      from gestionari g
     where internal.flota_vede_vehicul(p_org, g.user_id, p_sofer, p_pool)
  ),
  orfani as (
    select m.user_id
      from public.organization_members m
     where m.organization_id = p_org
       and m.role = 'org_admin'
       and m.status = 'active'
       and m.deleted_at is null
       and not exists (select 1 from vizibili)
       and internal.flota_vede_vehicul(p_org, m.user_id, p_sofer, p_pool)
  ),
  sofer as (
    select e.user_id
      from public.employees e
      join public.organization_members m
        on m.organization_id = p_org
       and m.user_id = e.user_id
       and m.status = 'active'
       and m.deleted_at is null
     where e.id = p_sofer
       and e.organization_id = p_org
       and e.deleted_at is null
       and e.user_id is not null
  ),
  toti as (
    select v.user_id from vizibili v
    union
    select o.user_id from orfani o
    union
    select s.user_id from sofer s
  )
  select t.user_id, internal.scope_membru(p_org, t.user_id, 'vehicles', 'read')::text
    from toti t
   where internal.scope_membru(p_org, t.user_id, 'vehicles', 'read') <> 'none';
$$;

-- Memento-urile care nu au dată de expirare:
--  · planul de service pe KILOMETRI: o alertă când `km_curent >= urmatorii_km -
--    prag_avertizare_km` („aproape”) și una când `km_curent >= urmatorii_km`
--    („depășit”), fiecare O DATĂ per ciclu (cheia conține ținta de km: după
--    intervenție ținta se mută și ciclul se reia);
--  · în noiembrie, vehiculele cu anvelope de vară montate, o dată pe an.
-- O notificare per destinatar și rulare, cu tot ce nu i s-a trimis încă (la prima
-- rulare, un rezumat, nu treizeci). Idempotentă prin `internal.flota_mementouri`:
-- aceeași instrucțiune citește starea de dinainte și o scrie, deci a doua rulare
-- din aceeași zi găsește totul marcat. Întoarce câte notificări au plecat.
create or replace function internal.flota_memento_service(p_org uuid, p_azi date default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- `p_azi` există ca proba să poată rula memento-ul din noiembrie în orice lună;
  -- jobul îl cheamă fără, adică cu ziua României.
  v_azi date := coalesce(p_azi, app.azi_local());
  v_n   integer := 0;
begin
  if p_org is null then
    return 0;
  end if;

  with
  km as (
    select v.id                                   as vehicle_id,
           v.employee_id                          as sofer_id,
           v.pool                                 as pool,
           case when v.km_curent >= p.urmatorii_km
                then 'service_km_depasit' else 'service_km_aproape' end as tip,
           p.id::text || ':' || p.urmatorii_km::text                    as cheie,
           (v.km_curent >= p.urmatorii_km)        as depasit,
           true                                   as e_service,
           p.denumire || ' — ' || v.nr_inmatriculare || ': ' ||
             case when v.km_curent >= p.urmatorii_km
                  then 'scadent la ' || pg_catalog.regexp_replace(p.urmatorii_km::text, '(\d)(?=(\d{3})+$)', '\1.', 'g')
                       || ' km, acum ' || pg_catalog.regexp_replace(v.km_curent::text, '(\d)(?=(\d{3})+$)', '\1.', 'g') || ' km'
                  else 'la ' || pg_catalog.regexp_replace(p.urmatorii_km::text, '(\d)(?=(\d{3})+$)', '\1.', 'g')
                       || ' km (acum ' || pg_catalog.regexp_replace(v.km_curent::text, '(\d)(?=(\d{3})+$)', '\1.', 'g') || ' km)'
             end                                  as eticheta
      from public.vehicle_service_plans p
      join public.vehicles v on v.id = p.vehicle_id and v.organization_id = p_org and v.deleted_at is null
     where p.organization_id = p_org
       and p.deleted_at is null
       and p.activ
       and p.urmatorii_km is not null
       and v.status in ('activ', 'in_service')
       and v.km_curent >= p.urmatorii_km - p.prag_avertizare_km
  ),
  iarna as (
    select v.id            as vehicle_id,
           v.employee_id   as sofer_id,
           v.pool          as pool,
           'anvelope_iarna' as tip,
           extract(year from v_azi)::integer::text as cheie,
           false           as depasit,
           false           as e_service,
           'Anvelope de vară montate pe ' || v.nr_inmatriculare || ': treceți pe iarnă' as eticheta
      from public.vehicles v
     where v.organization_id = p_org
       and v.deleted_at is null
       and v.status in ('activ', 'in_service')
       and v.anvelope_montate = 'vara'
       and extract(month from v_azi) = 11
  ),
  elemente as (
    select * from km
    union all
    select * from iarna
  ),
  noi_elem as (
    select e.*
      from elemente e
     where not exists (
       select 1 from internal.flota_mementouri m
        where m.vehicle_id = e.vehicle_id and m.tip = e.tip and m.cheie = e.cheie)
  ),
  destinatari as (
    select e.*, d.user_id, d.scope
      from noi_elem e
      cross join lateral internal.flota_destinatari(p_org, e.sofer_id, e.pool) d
  ),
  numerotate as (
    select d.*,
           row_number() over (partition by d.user_id
                              order by d.depasit desc, d.e_service desc, d.eticheta) as rn
      from destinatari d
  ),
  pe_om as (
    select n.user_id,
           min(n.scope)                                                 as scope,
           count(*)::integer                                            as total,
           count(*) filter (where n.tip = 'service_km_depasit')::integer as depasite,
           count(*) filter (where n.tip = 'service_km_aproape')::integer as aproape,
           count(*) filter (where n.tip = 'anvelope_iarna')::integer     as anvelope,
           count(distinct n.vehicle_id)::integer                        as vehicule,
           (array_agg(n.vehicle_id order by n.rn))[1]                   as primul_vehicul,
           bool_and(n.e_service)                                        as doar_service,
           string_agg('· ' || n.eticheta, E'\n' order by n.rn) filter (where n.rn <= 8) as linii
      from numerotate n
     group by n.user_id
  ),
  scrise as (
    insert into public.notifications (user_id, organization_id, kind, title, body, link, entity_type, entity_id)
    select o.user_id,
           p_org,
           'reminder'::public.notification_kind,
           left('Flota: ' || array_to_string(array_remove(array[
             case when o.depasite > 0 then internal.flota_numarat(o.depasite, 'lucrare de service depășită la km', 'lucrări de service depășite la km') end,
             case when o.aproape > 0 then internal.flota_numarat(o.aproape, 'lucrare de service aproape de scadență', 'lucrări de service aproape de scadență') end,
             case when o.anvelope > 0 then internal.flota_numarat(o.anvelope, 'vehicul cu anvelope de vară', 'vehicule cu anvelope de vară') end
           ], null), ', ') || '.', 200),
           left(o.linii || case when o.total > 8
                                then E'\n… și încă ' || internal.flota_numarat(o.total - 8, 'element', 'elemente') || '.'
                                else '' end, 4000),
           case
             when o.scope not in ('team', 'all') then '/portal/masina-mea'
             when o.vehicule = 1 and o.doar_service then '/flota/' || o.primul_vehicul::text || '?fila=service'
             when o.vehicule = 1 then '/flota/' || o.primul_vehicul::text
             else '/flota'
           end,
           case when o.vehicule = 1 then 'vehicle' else 'fleet_rezumat' end,
           case when o.vehicule = 1 then o.primul_vehicul end
      from pe_om o
    returning id
  ),
  -- Se marchează doar elementele care au avut măcar un destinatar: un element
  -- pe care nu l-a primit nimeni (nu există membru care să-l vadă) se reia a doua zi.
  marcate as (
    insert into internal.flota_mementouri (organization_id, vehicle_id, tip, cheie)
    select p_org, x.vehicle_id, x.tip, x.cheie
      from (select distinct d.vehicle_id, d.tip, d.cheie from destinatari d) x
    on conflict (vehicle_id, tip, cheie) do nothing
    returning 1
  )
  select count(*) into v_n from scrise;

  return coalesce(v_n, 0);
end;
$$;

comment on function internal.flota_memento_service(uuid, date) is
  'Memento-urile de flotă fără dată (0200): planul de service pe kilometri („aproape” și „depășit”, o dată per ciclu) și anvelopele de vară din noiembrie. O notificare per destinatar și rulare; dedup prin internal.flota_mementouri.';

-- ============================================================
-- 13. Conformitatea zilnică: și memento-urile fără dată
-- ============================================================
-- Forma 0198 (jobul `conformitate-zilnica`, 05:00 UTC), cu apelul către
-- `flota_memento_service` și un contor nou în raport.

create or replace function internal.conformitate_zilnica()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org      uuid;
  v_firme    integer := 0;
  v_alerte   integer := 0;
  v_rezumate integer := 0;
  v_mementouri integer := 0;
  v_esuate   integer := 0;
  v_x        integer;
begin
  for v_org in
    select o.id
      from public.organizations o
     where o.deleted_at is null
       -- Aceleași stări ca `app.current_org_ids` (și ca jobul mentenanței, M9): firma suspendată
       -- sau arhivată nu mai e deschisă nimănui, deci nici alertele nu pleacă.
       and o.status in ('pending', 'active')
       and o.subscription_status not in ('canceled', 'expired')
       and app.feature_on(o.id, 'fleet')
     order by o.id
  loop
    begin
      v_x := internal.genereaza_alerte(v_org);
      v_alerte := v_alerte + coalesce(v_x, 0);
      v_x := internal.flota_rezumat(v_org);
      v_rezumate := v_rezumate + coalesce(v_x, 0);
      -- 0200: alerta pe kilometri și memento-ul sezonier de anvelope.
      v_x := internal.flota_memento_service(v_org);
      v_mementouri := v_mementouri + coalesce(v_x, 0);
      v_firme := v_firme + 1;
    exception when others then
      v_esuate := v_esuate + 1;
      raise warning 'conformitate_zilnica: firma % a eșuat: % (%)', v_org, sqlerrm, sqlstate;
    end;
  end loop;

  return jsonb_build_object(
    'firme', v_firme, 'alerte_noi', v_alerte, 'rezumate', v_rezumate, 'mementouri', v_mementouri,
    'firme_esuate', v_esuate);
end;
$$;

comment on function internal.conformitate_zilnica() is
  'Jobul de dimineață al conformității (pg_cron „conformitate-zilnica”, 05:00 UTC): alertele din 0008, rezumatul de flotă pe dată și, din 0200, memento-urile pe kilometri și de anvelope. Doar firmele active cu modulul fleet pornit.';

-- ============================================================
-- 14. Tipul de document `revizie` se retrage de pe platformă
-- ============================================================
-- Revizia are acum loc în planurile de service (cu kilometri și cost). Documentele
-- deja înregistrate pe tipul `revizie` NU se ating: tipul retras nu îngheață
-- rândurile existente (`vdoc_inainte` revalidează tipul doar la INSERT sau la
-- schimbarea tipului), iar fișa le arată în continuare. O firmă care vrea tipul
-- îl reactivează din setările de tipuri (0199).
update public.vehicle_document_types
   set activ = false,
       updated_at = now()
 where organization_id is null
   and deleted_at is null
   and activ
   and cod = 'revizie';

-- ============================================================
-- 15. Funcțiile: fără EXECUTE pentru nimeni în afara proprietarului
-- ============================================================
revoke all on function internal.flota_vehicul_al_firmei(uuid, uuid) from public, anon, authenticated;
revoke all on function internal.vsp_inainte() from public, anon, authenticated;
revoke all on function internal.vsp_sincronizeaza(uuid) from public, anon, authenticated;
revoke all on function internal.vsp_dupa() from public, anon, authenticated;
revoke all on function internal.vsp_resincronizeaza_vehicul() from public, anon, authenticated;
revoke all on function internal.vse_inainte() from public, anon, authenticated;
revoke all on function internal.vse_dupa() from public, anon, authenticated;
revoke all on function internal.vex_inainte() from public, anon, authenticated;
revoke all on function internal.flota_destinatari(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function internal.flota_memento_service(uuid, date) from public, anon, authenticated;
grant execute on function internal.flota_memento_service(uuid, date) to service_role;

commit;

-- ============================================================
-- 16. Verificare
-- ============================================================
do $$
declare
  v_lipsa text[] := '{}';
  t       text;
  v_def   text;
  r       text;
begin
  foreach t in array array['vehicle_service_plans', 'vehicle_service_entries', 'vehicle_expenses'] loop
    if to_regclass('public.' || t) is null then
      v_lipsa := v_lipsa || t;
      continue;
    end if;
    if (select count(*) from pg_policies where schemaname = 'public' and tablename = t) <> 3 then
      v_lipsa := v_lipsa || (t || ': trio-ul _select/_insert/_update (exact 3 politici)');
    end if;
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and cmd = 'DELETE') then
      v_lipsa := v_lipsa || (t || ': politică DELETE (interzisă)');
    end if;
    if not (select relforcerowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      v_lipsa := v_lipsa || ('FORCE RLS pe ' || t);
    end if;
  end loop;
  if exists (select 1 from pg_policies where schemaname = 'public'
              and tablename in ('vehicle_service_plans', 'vehicle_service_entries', 'vehicle_expenses')
              and cmd = 'ALL') then
    v_lipsa := v_lipsa || 'politică FOR ALL pe tabelele F7';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public'
       and tablename in ('vehicle_service_plans', 'vehicle_service_entries', 'vehicle_expenses')) <> 9 then
    v_lipsa := v_lipsa || 'trio-ul de politici (9 în total) pe tabelele F7';
  end if;

  for r in select unnest(array['vsp_vehicul_idx', 'vsp_org_scadenta_idx', 'vsp_vehicul_denumire_uq',
                               'vse_vehicul_idx', 'vse_plan_idx', 'vse_org_data_idx',
                               'vex_vehicul_idx', 'vex_org_data_idx']) loop
    if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = r
                    and indexdef ilike '%where%deleted_at is null%') then
      v_lipsa := v_lipsa || ('indexul parțial ' || r);
    end if;
  end loop;

  for r in select unnest(array[
    'vehicle_service_plans:vsp_inainte', 'vehicle_service_plans:vsp_dupa',
    'vehicle_service_entries:vse_inainte', 'vehicle_service_entries:vse_dupa',
    'vehicle_expenses:vex_inainte', 'vehicles:vehicles_service_sync']) loop
    if not exists (select 1 from pg_trigger tg
                    where tg.tgname = split_part(r, ':', 2)
                      and tg.tgrelid = ('public.' || split_part(r, ':', 1))::regclass
                      and not tg.tgisinternal) then
      v_lipsa := v_lipsa || ('triggerul ' || r);
    end if;
  end loop;

  -- cost_total GENERATED
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'vehicle_service_entries'
                    and column_name = 'cost_total' and is_generated = 'ALWAYS') then
    v_lipsa := v_lipsa || 'cost_total GENERATED pe vehicle_service_entries';
  end if;

  -- poate_vedea_expirabil: toate ramurile din 0011 + cea nouă, fără `own` pe personal.
  v_def := pg_get_functiondef('app.poate_vedea_expirabil(uuid, text)'::regprocedure);
  for r in select unnest(array[
    'medical_exam', 'employee_document', 'work_permit', 'employment_contract', 'vehicle_document',
    'vehicle_service', 'equipment', 'fire_extinguisher', 'ssm_training', 'environmental_permit',
    'inventory_item', 'iscir_authorization', 'maintenance_plan', 'personnel_authorization',
    'ppe_issuance']) loop
    if position('''' || r || '''' in v_def) = 0 then
      v_lipsa := v_lipsa || ('poate_vedea_expirabil a pierdut ramura ' || r);
    end if;
  end loop;
  if v_def like '%''employees'', ''read'', ''own''%' then
    v_lipsa := v_lipsa || 'poate_vedea_expirabil acceptă employees:read own (garda din 0023:89)';
  end if;

  -- Funcțiile noi: search_path gol.
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'internal'
                and p.proname in ('flota_vehicul_al_firmei', 'vsp_inainte', 'vsp_sincronizeaza', 'vsp_dupa',
                                  'vsp_resincronizeaza_vehicul', 'vse_inainte', 'vse_dupa', 'vex_inainte',
                                  'flota_destinatari', 'flota_memento_service')
                and (p.proconfig is null or not ('search_path=""' = any (p.proconfig)))) then
    v_lipsa := v_lipsa || 'search_path gol pe funcțiile 0200';
  end if;

  -- Jobul din 0198 chemă memento-urile; semnătura lui genereaza_alerte rămâne a 0008.
  if position('flota_memento_service' in pg_get_functiondef('internal.conformitate_zilnica()'::regprocedure)) = 0 then
    v_lipsa := v_lipsa || 'conformitate_zilnica nu cheamă flota_memento_service';
  end if;
  if position('vehicle_service' in pg_get_functiondef('internal.flota_rezumat(uuid)'::regprocedure)) = 0 then
    v_lipsa := v_lipsa || 'flota_rezumat nu include vehicle_service';
  end if;
  if position('vehicle_service' in pg_get_functiondef('internal.flota_setari_praguri()'::regprocedure)) = 0 then
    v_lipsa := v_lipsa || 'flota_setari_praguri nu oglindește vehicle_service';
  end if;
  if to_regprocedure('internal.genereaza_alerte(uuid)') is null then
    v_lipsa := v_lipsa || 'internal.genereaza_alerte(uuid) (semnătura)';
  end if;

  -- Tipul `revizie` retras pe platformă.
  if exists (select 1 from public.vehicle_document_types
              where organization_id is null and cod = 'revizie' and deleted_at is null and activ) then
    v_lipsa := v_lipsa || 'tipul de document revizie e încă activ pe platformă';
  end if;

  if to_regclass('internal.flota_mementouri') is null then
    v_lipsa := v_lipsa || 'internal.flota_mementouri';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'vehicles' and column_name = 'anvelope_montate') then
    v_lipsa := v_lipsa || 'vehicles.anvelope_montate';
  end if;

  if array_length(v_lipsa, 1) > 0 then
    raise exception '0200: lipsesc %', array_to_string(v_lipsa, ', ');
  end if;
end $$;
