-- supabase/migrations/0216_flota_rezervari.sql
--
-- FLOTA, EXTENSIA F12d: REZERVĂRILE MAȘINILOR DE POOL.
--
-- Specificația o numea `0213_flota_rezervari`; 0210–0212 le-a luat mentenanța
-- la integrare, iar traseele F12 s-au mutat cu +3, deci e 0216.
--
-- ── DE UNDE VINE ────────────────────────────────────────────────────────────
-- Decizia 2 din 7 oct a adus mașinile de pool (`vehicles.pool`, 0173): oricine
-- are drept de foaie le folosește fără alocare. Fără rezervări, doi oameni pleacă
-- după aceeași mașină în aceeași zi, iar al doilea află abia la salvarea foii,
-- din unicitatea `ts_vehicul_zi_uq` (0200: o foaie pe vehicul și zi).
--
-- ── CE ADUCE ────────────────────────────────────────────────────────────────
-- A. `public.vehicle_reservations`: o rezervare pe ZILE ÎNTREGI (`de_la`,
--    `pana_la`, ambele incluse), cu scop obligatoriu. Două rezervări active nu se
--    suprapun pe același vehicul (`vr_fara_suprapunere`, EXCLUDE pe gist, ca
--    `va_fara_suprapunere` din 0173). O cerere `ceruta` blochează zilele ca una
--    confirmată: aprobatorul nu alege între două cereri pe aceeași zi.
-- B. Aprobarea e opțională, per firmă (`fleet_settings.rezervari_cu_aprobare`,
--    oprită implicit). Statusul NU vine din client: triggerul îl pune la INSERT
--    (`confirmata` fără aprobare sau pentru cine are `approve = all`, altfel
--    `ceruta`). Nimeni nu-și decide propria rezervare: `manager_path` conține și
--    fișa omului (0004), deci `app.is_manager_of` e adevărat pe propria fișă, iar
--    garda stă în trigger.
-- C. Conflictele, refuzate în ambele sensuri: rezervare ↔ alocare (0173),
--    rezervare ↔ foaia altui șofer (0200). Un lacăt de tranzacție pe vehicul
--    serializează cele trei verificări încrucișate (EXCLUDE-ul serializează doar
--    rezervare contra rezervare).
-- D. Foaia șoferului dintr-o zi rezervată se LEAGĂ de rezervare
--    (`trip_sheets.vehicle_reservation_id`), pusă doar de bază.
-- E. Opțional, per firmă: „rezervarea e obligatorie pe pool”
--    (`fleet_settings.rezervare_obligatorie`, oprită implicit). Fără
--    `trip_sheets:create = all`, foaia pe o mașină de pool cere atunci o
--    rezervare confirmată pentru ziua ei.
-- F. Ieșirea vehiculului din pool sau din parc anulează rezervările viitoare
--    fără foaie legată, cu notificare (`warning`), ca `alocari_inchide_la_iesire`.
-- G. Ocuparea pentru angajat: `public.ocuparea_vehiculelor_pool`, fără
--    identitatea colegilor (sub `read = own` angajatul nu le vede rezervările).
-- H. Resursa de permisiune proprie, `vehicle_reservations` (read, create,
--    update, approve), ca firma s-o poată suprascrie separat de foi (0063).
--
-- ── ABATERI DE LA SPECIFICAȚIA F12d, DUPĂ FORMA REALĂ DE PE DISC ─────────────
--  · `fleet_settings` vine din 0201, are `id` + `deleted_at` (unic parțial pe
--    firmă), iar `responsabili` ține FIȘE de angajat (`employees.id`), nu
--    `auth.users.id`, cu `'{}'` (nu NULL) pentru „toți org_admin”.
--    Responsabilii se iau deci prin `internal.flota_responsabili` (0201), forma
--    unică a regulii, nu printr-o listă paralelă.
--  · `trip_sheets.data` e GENERATED (0200): într-un trigger BEFORE e încă NULL.
--    Ziua se calculează din `plecare_la`, cu expresia coloanei generate.
--  · Plasa aprobatorilor cade pe membrii activi cu `approve = all` (nu pe rol):
--    un `org_admin` căruia firma i-a închis aprobarea n-ar putea decide.
--  · Imuabile sunt și `id`, `created_at`, `destinatie`, `observatii`, nu doar
--    vehiculul, angajatul, prima zi și scopul (lecția F12c: `id` rescris rupe
--    legătura cu notificarea și auditul).
--
-- ── CE NU FACE ──────────────────────────────────────────────────────────────
--  · Nu rescrie `internal.foi_parcurs_inainte`, `internal.alocari_inainte` și nici
--    politicile din 0173/0199/0200: triggere NOI, cu nume care sortează după ele.
--  · Nu atinge `app.sofer_la` (0206, amenzile): rezervarea confirmată ar fi a
--    treia sursă, după linia de foaie și alocare; se notează acolo, la nevoie.
--  · Fără memento în ziua dinainte și fără anularea automată a cererilor
--    expirate: ar cere jobul `conformitate_zilnica` (0201), pe alt traseu (I-d7).
--  · Fără politică DELETE și fără ștergere logică din aplicație: rezervarea
--    greșită se ANULEAZĂ.
--
-- Aplicare: psql byte-exact (NOTES.md §1), după bancul local. Producția cere
-- confirmare explicită, separat pentru 0216.

\set ON_ERROR_STOP on

begin;

-- ============================================================
-- 0. Precondiții
-- ============================================================
do $$
begin
  if to_regclass('public.fleet_settings') is null then
    raise exception '0216 cere public.fleet_settings (0201, flota F5). Aplicați întâi migrarea care o creează.';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'trip_sheets' and column_name = 'data') then
    raise exception '0216 cere trip_sheets.data (0200, flota F4).';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'vehicles' and column_name = 'pool') then
    raise exception '0216 cere vehicles.pool (0173).';
  end if;
  if to_regprocedure('internal.flota_responsabili(uuid)') is null then
    raise exception '0216 cere internal.flota_responsabili(uuid) (0201).';
  end if;
  if to_regprocedure('internal.scope_membru(uuid,uuid,text,text)') is null then
    raise exception '0216 cere internal.scope_membru(uuid, uuid, text, text) (0189).';
  end if;
end $$;

-- ============================================================
-- 1. Enum
-- ============================================================
-- „Încheiată” NU e o stare: se derivă în domeniu (`confirmata` și `pana_la` <
-- azi). Altfel ar trebui un job care s-o scrie.
create type public.vehicle_reservation_status as enum ('ceruta', 'confirmata', 'respinsa', 'anulata');

-- ============================================================
-- 2. Setările firmei
-- ============================================================
alter table public.fleet_settings
  add column if not exists rezervari_cu_aprobare boolean not null default false,
  add column if not exists rezervare_obligatorie boolean not null default false,
  add column if not exists rezervari_max_zile smallint not null default 14;
alter table public.fleet_settings
  add constraint fs_rezervari_max_zile_ck check (rezervari_max_zile between 1 and 92);

comment on column public.fleet_settings.rezervari_cu_aprobare is
  'Rezervările de pool cer aprobarea managerului direct sau a unui responsabil de flotă (0216). Oprită: rezervarea e confirmată pe loc.';
comment on column public.fleet_settings.rezervare_obligatorie is
  'Foaia pe o mașină de pool cere o rezervare confirmată pentru ziua ei, în afară de cine are trip_sheets:create = all (0216).';
comment on column public.fleet_settings.rezervari_max_zile is
  'Durata maximă a unei rezervări, în zile incluse (0216). Implicit 14, între 1 și 92.';

-- Lipsa rândului înseamnă valorile implicite: nimic nu garantează că fiecare
-- firmă are rând (`setariFlota` face la fel în aplicație).
create or replace function internal.flota_setari_rezervari(
  p_org uuid, out cu_aprobare boolean, out obligatorie boolean, out max_zile integer)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(fs.rezervari_cu_aprobare, false),
         coalesce(fs.rezervare_obligatorie, false),
         coalesce(fs.rezervari_max_zile, 14)::integer
    from (select 1) x
    left join public.fleet_settings fs
      on fs.organization_id = p_org and fs.deleted_at is null;
$$;

comment on function internal.flota_setari_rezervari(uuid) is
  'Setările rezervărilor unei firme (aprobare, obligatorie, durata maximă), cu implicitele coloanelor când firma n-are rând (0216).';

-- ============================================================
-- 3. Tabela `vehicle_reservations`
-- ============================================================
create table public.vehicle_reservations (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  vehicle_id        uuid not null references public.vehicles (id) on delete restrict,
  employee_id       uuid not null references public.employees (id) on delete restrict,
  de_la             date not null,
  pana_la           date not null,
  scop              text not null,
  destinatie        text,
  observatii        text,
  status            public.vehicle_reservation_status not null default 'ceruta',
  decis_de          uuid references auth.users (id) on delete set null,
  decis_la          timestamptz,
  motiv_respingere  text,
  anulat_de         uuid references auth.users (id) on delete set null,
  anulat_la         timestamptz,
  motiv_anulare     text,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users (id) on delete set null,
  updated_at        timestamptz not null default now(),
  updated_by        uuid references auth.users (id) on delete set null,
  deleted_at        timestamptz,
  constraint vr_interval_ck check (pana_la >= de_la),
  constraint vr_scop_len check (char_length(btrim(scop)) between 3 and 300),
  constraint vr_destinatie_len check (destinatie is null or char_length(destinatie) <= 300),
  constraint vr_observatii_len check (observatii is null or char_length(observatii) <= 1000),
  constraint vr_motiv_respingere_len check (motiv_respingere is null or char_length(motiv_respingere) <= 500),
  constraint vr_motiv_anulare_len check (motiv_anulare is null or char_length(motiv_anulare) <= 500),
  constraint vr_respinsa_cu_motiv check (status <> 'respinsa' or motiv_respingere is not null),
  constraint vr_decizie_ck check (
    (status = 'ceruta' and decis_la is null)
    or (status in ('confirmata', 'respinsa') and decis_la is not null)
    or status = 'anulata'),
  constraint vr_anulare_ck check ((status = 'anulata') = (anulat_la is not null))
);

-- Zilele incluse la ambele capete. Forma canonică a lui daterange e [), deci
-- '[]' se stochează ca [de_la, pana_la+1): două rezervări care se ating (una se
-- termină luni, cealaltă începe marți) nu se suprapun.
alter table public.vehicle_reservations
  add constraint vr_fara_suprapunere
  exclude using gist (vehicle_id with =, daterange(de_la, pana_la, '[]') with &&)
  where (deleted_at is null and status in ('ceruta', 'confirmata'));

create index vr_vehicul_idx on public.vehicle_reservations (organization_id, vehicle_id, de_la desc)
  where deleted_at is null;
create index vr_angajat_idx on public.vehicle_reservations (organization_id, employee_id, de_la desc)
  where deleted_at is null;
create index vr_de_decis_idx on public.vehicle_reservations (organization_id, de_la)
  where deleted_at is null and status = 'ceruta';
create index vr_lista_idx on public.vehicle_reservations (organization_id, de_la desc, id desc)
  where deleted_at is null;

comment on table public.vehicle_reservations is
  'Rezervările mașinilor de pool, pe zile întregi (0216). Statusul îl scrie doar triggerul; foile se leagă prin trip_sheets.vehicle_reservation_id.';
comment on column public.vehicle_reservations.scop is
  'Scopul de serviciu al deplasării (obligatoriu). Nu e document justificativ fiscal: documentul rămâne foaia de parcurs (⚠ contabil).';
comment on column public.vehicle_reservations.status is
  'ceruta → confirmata / respinsa; ceruta / confirmata → anulata. Pus de trigger la INSERT; „încheiată” se derivă (confirmata și pana_la < azi).';

-- ============================================================
-- 4. Legătura cu foaia
-- ============================================================
alter table public.trip_sheets
  add column if not exists vehicle_reservation_id uuid
    references public.vehicle_reservations (id) on delete restrict;
create index ts_rezervare_idx on public.trip_sheets (vehicle_reservation_id)
  where vehicle_reservation_id is not null and deleted_at is null;
comment on column public.trip_sheets.vehicle_reservation_id is
  'Rezervarea confirmată din care vine foaia (0216). O pune DOAR triggerul foi_parcurs_rezervare; valoarea din client se ignoră.';

-- Backfill: niciunul. Tabela e nouă, iar foile existente rămân cu NULL.

-- ============================================================
-- 5. Funcții de autorizare
-- ============================================================
-- Geamăna lui `app.poate_crea_foaie` (0171), pe resursa nouă.
create or replace function app.poate_rezervare(p_org uuid, p_sofer uuid, p_actiune text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case app.has_permission(p_org, 'vehicle_reservations', p_actiune)
    when 'all'  then true
    when 'team' then p_sofer is not null
                     and (p_sofer = app.current_employee_id(p_org) or app.is_manager_of(p_org, p_sofer))
    when 'own'  then p_sofer is not null and p_sofer = app.current_employee_id(p_org)
    else false
  end;
$$;

comment on function app.poate_rezervare(uuid, uuid, text) is
  'Dreptul apelantului pe rezervarea unui angajat, pe vehicle_reservations:<acțiune> (all / team pe subarbore / own pe fișa proprie) (0216).';

-- Cine primește cererea de aprobare, pe scope-urile EFECTIVE per membru
-- (`internal.scope_membru`, 0189), nu pe rol:
--   · responsabilii de flotă (0201: fișele din setări care sunt membri activi și
--     văd parcul; fără ei, toți org_admin) care pot decide oricui (`approve = all`);
--   · managerul DIRECT, nu tot lanțul: aprobarea e deschisă pe subarbore (RLS
--     team), dar notificarea nu trebuie să inunde conducerea.
-- Plasa: fără niciunul (responsabili fără `approve = all`, fără manager direct),
-- cererea ar aștepta TĂCUT; atunci notificarea merge la toți membrii activi cu
-- `approve = all`. Omul rezervării nu e niciodată în listă.
create or replace function internal.rezervari_aprobatori(p_org uuid, p_employee uuid)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with subiect as (
    select e.user_id, e.manager_employee_id
      from public.employees e
     where e.id = p_employee and e.organization_id = p_org and e.deleted_at is null
  ),
  membri as (
    select m.user_id
      from public.organization_members m
     where m.organization_id = p_org and m.deleted_at is null and m.status = 'active'
  ),
  candidati as (
    select r.user_id
      from internal.flota_responsabili(p_org) r
     where internal.scope_membru(p_org, r.user_id, 'vehicle_reservations', 'approve') = 'all'
    union
    select mg.user_id
      from subiect s
      join public.employees mg
        on mg.id = s.manager_employee_id and mg.organization_id = p_org and mg.deleted_at is null
      join membri m on m.user_id = mg.user_id
     where internal.scope_membru(p_org, mg.user_id, 'vehicle_reservations', 'approve') in ('team', 'all')
  ),
  finali as (
    select distinct c.user_id
      from candidati c
     where c.user_id is not null
       and c.user_id is distinct from (select s.user_id from subiect s)
  )
  select f.user_id from finali f
  union
  select m.user_id
    from membri m
   where not exists (select 1 from finali)
     and m.user_id is distinct from (select s.user_id from subiect s)
     and internal.scope_membru(p_org, m.user_id, 'vehicle_reservations', 'approve') = 'all';
$$;

comment on function internal.rezervari_aprobatori(uuid, uuid) is
  'Destinatarii cererii de rezervare: responsabilii de flotă cu approve = all și managerul direct cu team/all; plasa: membrii activi cu approve = all (0216).';

-- Intervalul în textele notificărilor: o zi = o dată; același an = „14.10–15.10.2026”.
create or replace function internal.rezervari_interval(p_de_la date, p_pana_la date)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_de_la = p_pana_la then to_char(p_de_la, 'DD.MM.YYYY')
    when extract(year from p_de_la) = extract(year from p_pana_la)
      then to_char(p_de_la, 'DD.MM') || '–' || to_char(p_pana_la, 'DD.MM.YYYY')
    else to_char(p_de_la, 'DD.MM.YYYY') || '–' || to_char(p_pana_la, 'DD.MM.YYYY')
  end;
$$;

-- Ultima zi cu foaie de parcurs a unei rezervări (NULL = niciuna): foile LEGATE
-- de ea, plus foile NELEGATE ale aceluiași om, pe același vehicul, în zilele ei.
-- Doar o rezervare `confirmata` leagă foaia, iar legătura nu se pune retroactiv
-- (specificația, „Ce NU se face”), deci foaia făcută cât cererea aștepta sau
-- înaintea rezervării rămâne fără ea. Gărzile de anulare, de scurtare și de
-- ieșire din pool o privesc totuși: altfel rezervarea ar apărea anulată deși
-- mașina a ieșit pe foaie în ziua ei.
create or replace function internal.rezervari_ultima_foaie(
  p_rezervare uuid, p_vehicul uuid, p_angajat uuid, p_de_la date, p_pana_la date)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select max(t.data)
    from public.trip_sheets t
   where t.deleted_at is null and t.status <> 'respins'
     and (t.vehicle_reservation_id = p_rezervare
          or (t.vehicle_id = p_vehicul and t.employee_id = p_angajat
              and t.data between p_de_la and p_pana_la));
$$;

comment on function internal.rezervari_ultima_foaie(uuid, uuid, uuid, date, date) is
  'Ultima zi cu foaie a rezervării: foile legate plus foile nelegate ale omului pe vehicul în zilele ei (0216). NULL = niciuna.';

-- ============================================================
-- 6. Triggerul BEFORE pe rezervări: `internal.rezervari_inainte()`
-- ============================================================
-- Numele `rezervari_inainte` sortează înaintea lui
-- `vehicle_reservations_set_updated_at` (r < v). Ordinea verificărilor contează.
--
-- Calea de sistem (`app.is_service_context()` sau steagul
-- `app.flota_rezervari_sistem`, pus doar de `rezervari_la_iesirea_vehiculului`)
-- sare peste regulile de calendar și de decizie, nu peste integritate (firmă,
-- pool, alocare, foaie, imuabilitate). Steagul nu e accesibil prin PostgREST:
-- `set_config` stă în `pg_catalog`, care nu e expus.
create or replace function internal.rezervari_inainte()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vehicul public.vehicles%rowtype;
  v_set     record;
  v_sistem  boolean := app.is_service_context()
                       or coalesce(pg_catalog.current_setting('app.flota_rezervari_sistem', true), '') = 'on';
  v_actor   uuid := auth.uid();
  v_eu      uuid;
  v_zi      date;
  v_inceput timestamptz;
  v_sfarsit timestamptz;
begin
  -- Y2: garda de firmă, prima, înaintea lacătului și a căutărilor. Pe un rând
  -- pus pe firma B, vehiculul de acolo trecea de gărzi (apoi 42501), iar
  -- refuzurile spuneau dacă e în pool, ieșit din parc, alocat sau cu foaie.
  -- Ocolirea e doar contextul de serviciu: steagul `app.flota_rezervari_sistem`
  -- îl pun funcțiile bazei pe rânduri ale firmei apelantului.
  if not app.is_service_context()
     and not coalesce(new.organization_id = any ((select app.current_org_ids())::uuid[]), false) then
    raise exception using errcode = '42501',
      message = 'Nu aveți dreptul de a scrie rezervări de vehicule în această organizație.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('flota:vehicul:' || new.vehicle_id::text, 0));
  v_eu := app.current_employee_id(new.organization_id);

  if tg_op = 'INSERT' then
    -- Apărare pentru un INSERT direct prin PostgREST: acțiunea trimite mereu
    -- fișa. Politica de INSERT se evaluează DUPĂ triggerele BEFORE, deci tot
    -- acolo cade rezervarea pe alt angajat.
    new.employee_id := coalesce(new.employee_id, v_eu);
    if new.employee_id is null then
      raise exception using errcode = 'P0001',
        message = 'Contul dumneavoastră nu este legat de o fișă de angajat în această organizație. Contactați administratorul.';
    end if;

    select * into v_vehicul from public.vehicles v where v.id = new.vehicle_id and v.deleted_at is null;
    if not found or v_vehicul.organization_id <> new.organization_id then
      raise exception using errcode = 'P0001', message = 'Vehiculul ales nu aparține organizației dumneavoastră.';
    end if;
    if not v_vehicul.pool then
      raise exception using errcode = 'P0001',
        message = 'Vehiculul nu este o mașină de pool. Se rezervă doar mașinile comune; celelalte au șofer prin alocare.';
    end if;
    if v_vehicul.status in ('vandut', 'casat') then
      raise exception using errcode = 'P0001',
        message = 'Vehiculul este ieșit din parc (vândut sau casat). Nu se mai poate rezerva.';
    end if;
    if not exists (select 1 from public.employees e
                    where e.id = new.employee_id and e.organization_id = new.organization_id
                      and e.deleted_at is null) then
      raise exception using errcode = 'P0001', message = 'Angajatul ales nu aparține organizației dumneavoastră.';
    end if;

    if not v_sistem then
      if new.de_la < app.azi_local() then
        raise exception using errcode = 'P0001', message = 'Rezervarea începe cel mai devreme astăzi.';
      end if;
      -- `select … into`, nu `v_set := f(...)`: funcția are parametri OUT și
      -- întoarce un record; forma SELECT INTO e cea fără ambiguitate.
      select * into v_set from internal.flota_setari_rezervari(new.organization_id);
      if (new.pana_la - new.de_la + 1) > v_set.max_zile then
        raise exception using errcode = 'P0001',
          message = format('Rezervarea depășește durata maximă de %s zile stabilită de firmă.', v_set.max_zile);
      end if;
    end if;

    -- Alocarea: o mașină de pool alocată cuiva în acele zile nu se rezervă. Zilele
    -- rezervării sunt zile ale României, alocarea e pe momente.
    v_inceput := (new.de_la::timestamp at time zone 'Europe/Bucharest');
    v_sfarsit := ((new.pana_la + 1)::timestamp at time zone 'Europe/Bucharest');
    if exists (select 1 from public.vehicle_assignments a
                where a.vehicle_id = new.vehicle_id and a.deleted_at is null
                  and tstzrange(a.de_la, coalesce(a.pana_la, 'infinity'::timestamptz), '[)')
                      && tstzrange(v_inceput, v_sfarsit, '[)')) then
      raise exception using errcode = 'P0001',
        message = 'Vehiculul este alocat unui șofer în acest interval. O mașină alocată nu se rezervă.';
    end if;

    -- Foaia altui șofer într-una dintre zile (0200: o foaie pe vehicul și zi).
    select min(t.data) into v_zi
      from public.trip_sheets t
     where t.vehicle_id = new.vehicle_id and t.deleted_at is null and t.status <> 'respins'
       and t.data between new.de_la and new.pana_la and t.employee_id <> new.employee_id;
    if v_zi is not null then
      raise exception using errcode = 'P0001',
        message = format('Vehiculul are deja foaia de parcurs a altui șofer pe %s.', to_char(v_zi, 'DD.MM.YYYY'));
    end if;

    new.scop := btrim(new.scop);
    new.destinatie := nullif(btrim(coalesce(new.destinatie, '')), '');
    new.observatii := nullif(btrim(coalesce(new.observatii, '')), '');
    if v_sistem then
      -- Seed sau import: statusul și câmpurile de decizie date rămân. Coloana are
      -- `default 'ceruta'`, deci aici „netrimis” nu se deosebește de `ceruta`:
      -- un seed își scrie explicit statusul.
      if new.status <> 'ceruta' then
        new.decis_la := coalesce(new.decis_la, now());
      end if;
      if new.status = 'anulata' then
        new.anulat_la := coalesce(new.anulat_la, now());
      end if;
      return new;
    end if;
    new.anulat_de := null; new.anulat_la := null; new.motiv_anulare := null; new.motiv_respingere := null;
    -- Fără coalesce pe record: un record neatribuit (calea de sistem de mai sus)
    -- dă eroare la citire în plpgsql. Se recitește, e o căutare pe un index.
    select * into v_set from internal.flota_setari_rezervari(new.organization_id);
    if not v_set.cu_aprobare
       or app.has_permission(new.organization_id, 'vehicle_reservations', 'approve') = 'all' then
      new.status := 'confirmata'; new.decis_de := v_actor; new.decis_la := now();
    else
      new.status := 'ceruta'; new.decis_de := null; new.decis_la := null;
    end if;
    return new;
  end if;

  -- ── UPDATE ──
  if (new.id, new.organization_id, new.vehicle_id, new.employee_id, new.de_la, new.scop,
      new.destinatie, new.observatii, new.created_at, new.created_by)
     is distinct from
     (old.id, old.organization_id, old.vehicle_id, old.employee_id, old.de_la, old.scop,
      old.destinatie, old.observatii, old.created_at, old.created_by) then
    raise exception using errcode = 'P0001',
      message = 'Vehiculul, angajatul, prima zi, scopul și detaliile rezervării nu se mai schimbă. Anulați rezervarea și faceți alta.';
  end if;
  if v_sistem then
    if new.status = 'anulata' and old.status <> 'anulata' then
      new.anulat_la := coalesce(new.anulat_la, now());
    end if;
    return new;
  end if;
  -- Fără ștergere logică din aplicație. USING-ul politicii cere `deleted_at is
  -- null` pe rândul VECHI, nu și pe cel nou; fără garda asta, un PATCH direct cu
  -- `deleted_at` ar scoate rezervarea din EXCLUDE și ar lăsa foaia legată fără
  -- rezervare vizibilă.
  if new.deleted_at is distinct from old.deleted_at then
    raise exception using errcode = 'P0001', message = 'Rezervarea nu se șterge. Anulați-o.';
  end if;
  if old.status in ('respinsa', 'anulata') then
    raise exception using errcode = 'P0001',
      message = 'Rezervarea este închisă (respinsă sau anulată). Nu se mai modifică.';
  end if;

  if new.status is distinct from old.status then
    if new.status in ('confirmata', 'respinsa') then
      if old.status <> 'ceruta' then
        raise exception using errcode = 'P0001', message = 'Rezervarea nu mai așteaptă o decizie.';
      end if;
      if not app.poate_rezervare(new.organization_id, new.employee_id, 'approve') then
        raise exception using errcode = 'P0001',
          message = 'Starea aceasta o poate pune doar cine are dreptul de aprobare a rezervărilor.';
      end if;
      if v_eu is not null and v_eu = new.employee_id then
        raise exception using errcode = 'P0001',
          message = 'Nu vă puteți aproba sau respinge propria rezervare. Decizia o ia managerul sau responsabilul de flotă.';
      end if;
      if old.pana_la < app.azi_local() then
        raise exception using errcode = 'P0001',
          message = 'Rezervarea a trecut fără decizie. Nu se mai poate aproba sau respinge.';
      end if;
      if new.status = 'respinsa' and nullif(btrim(coalesce(new.motiv_respingere, '')), '') is null then
        raise exception using errcode = 'P0001',
          message = 'Scrieți motivul respingerii; angajatul îl primește în notificare.';
      end if;
      new.decis_de := v_actor; new.decis_la := now();
      new.motiv_respingere := case when new.status = 'respinsa' then btrim(new.motiv_respingere) end;
      new.anulat_de := old.anulat_de; new.anulat_la := old.anulat_la; new.motiv_anulare := old.motiv_anulare;
    elsif new.status = 'anulata' then
      if not (app.poate_rezervare(new.organization_id, new.employee_id, 'update')
              or app.poate_rezervare(new.organization_id, new.employee_id, 'approve')) then
        raise exception using errcode = 'P0001', message = 'Nu aveți dreptul să anulați rezervarea acestui angajat.';
      end if;
      if v_eu is distinct from new.employee_id and nullif(btrim(coalesce(new.motiv_anulare, '')), '') is null then
        raise exception using errcode = 'P0001',
          message = 'Scrieți motivul anulării: rezervarea nu este a dumneavoastră, iar angajatul îl primește în notificare.';
      end if;
      if old.status = 'confirmata' and old.pana_la < app.azi_local() then
        raise exception using errcode = 'P0001', message = 'Rezervarea s-a încheiat. Nu mai are ce anula.';
      end if;
      -- Și foaia NELEGATĂ a omului din zilele rezervării (`rezervari_ultima_foaie`).
      if internal.rezervari_ultima_foaie(new.id, new.vehicle_id, new.employee_id, new.de_la, old.pana_la)
         is not null then
        raise exception using errcode = 'P0001',
          message = 'Rezervarea are deja foi de parcurs. Scurtați-o până la ultima zi cu foaie, în loc s-o anulați.';
      end if;
      new.anulat_de := v_actor; new.anulat_la := now();
      new.motiv_anulare := nullif(btrim(coalesce(new.motiv_anulare, '')), '');
      new.decis_de := old.decis_de; new.decis_la := old.decis_la; new.motiv_respingere := old.motiv_respingere;
    else
      raise exception using errcode = 'P0001', message = 'Rezervarea nu se poate întoarce la o stare anterioară.';
    end if;
  else
    -- Câmpurile de decizie și de anulare se scriu doar la tranziție.
    new.decis_de := old.decis_de; new.decis_la := old.decis_la;
    new.motiv_respingere := old.motiv_respingere;
    new.anulat_de := old.anulat_de; new.anulat_la := old.anulat_la; new.motiv_anulare := old.motiv_anulare;
  end if;

  if new.pana_la is distinct from old.pana_la then
    if new.status not in ('ceruta', 'confirmata') then
      raise exception using errcode = 'P0001', message = 'Doar o rezervare activă se poate scurta.';
    end if;
    if not (app.poate_rezervare(new.organization_id, new.employee_id, 'update')
            or app.poate_rezervare(new.organization_id, new.employee_id, 'approve')) then
      raise exception using errcode = 'P0001', message = 'Nu aveți dreptul să modificați rezervarea acestui angajat.';
    end if;
    if new.pana_la > old.pana_la then
      raise exception using errcode = 'P0001',
        message = 'Rezervarea nu se poate prelungi. Faceți o rezervare nouă pentru zilele următoare.';
    end if;
    if old.pana_la < app.azi_local() then
      raise exception using errcode = 'P0001', message = 'Rezervarea s-a încheiat. Nu se mai scurtează.';
    end if;
    if new.pana_la < greatest(new.de_la, app.azi_local()) then
      raise exception using errcode = 'P0001',
        message = 'Rezervarea se poate scurta cel mult până astăzi și nu înaintea primei ei zile.';
    end if;
    v_zi := internal.rezervari_ultima_foaie(new.id, new.vehicle_id, new.employee_id, new.de_la, old.pana_la);
    if v_zi is not null and new.pana_la < v_zi then
      raise exception using errcode = 'P0001',
        message = format('Rezervarea are foaie de parcurs pe %s; nu se poate scurta înaintea acestei zile.',
                         to_char(v_zi, 'DD.MM.YYYY'));
    end if;
  end if;
  return new;
end;
$$;

create trigger rezervari_inainte
  before insert or update on public.vehicle_reservations
  for each row execute function internal.rezervari_inainte();

-- ============================================================
-- 7. Triggerul AFTER: `internal.rezervari_notifica()`
-- ============================================================
-- Tiparul din 0042 / 0201: inserare în `notifications`, `entity_type =
-- 'vehicle_reservation'`. Push-ul pleacă singur (0122). O tranzacție derulată
-- înapoi ia notificarea cu ea. Cine face schimbarea nu-și scrie notificare.
-- INSERT-urile de sistem (seed, import) nu notifică; anulările de sistem (ieșirea
-- vehiculului din pool sau din parc) DA: omul pierde o rezervare.
create or replace function internal.rezervari_notifica()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor    uuid := auth.uid();
  v_nr       text;
  v_interval text := internal.rezervari_interval(new.de_la, new.pana_la);
  v_om       record;
  v_om_activ boolean;
begin
  if new.deleted_at is not null then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return null;
  end if;
  if tg_op = 'INSERT' and app.is_service_context() then
    return null;
  end if;

  select coalesce(v.nr_inmatriculare, 'vehicul') into v_nr from public.vehicles v where v.id = new.vehicle_id;
  select e.full_name, e.user_id into v_om
    from public.employees e
   where e.id = new.employee_id and e.organization_id = new.organization_id;
  v_om_activ := v_om.user_id is not null
    and v_om.user_id is distinct from v_actor
    and exists (select 1 from public.organization_members m
                 where m.organization_id = new.organization_id and m.user_id = v_om.user_id
                   and m.status = 'active' and m.deleted_at is null);

  if tg_op = 'INSERT' then
    if new.status = 'ceruta' then
      insert into public.notifications
        (organization_id, user_id, kind, title, body, link, entity_type, entity_id)
      select new.organization_id, a.user_id, 'approval'::public.notification_kind,
             left('Rezervare de aprobat: ' || v_nr, 200),
             left(coalesce(v_om.full_name, 'Angajat') || ', ' || v_interval || '. Scop: '
                  || rtrim(new.scop, '.') || '.', 4000),
             '/flota/rezervari?stare=ceruta',
             'vehicle_reservation', new.id
        from internal.rezervari_aprobatori(new.organization_id, new.employee_id) a
       where a.user_id is distinct from v_actor;
    elsif new.status = 'confirmata' and v_om_activ then
      insert into public.notifications
        (organization_id, user_id, kind, title, body, link, entity_type, entity_id)
      values (new.organization_id, v_om.user_id, 'info'::public.notification_kind,
              left('Vi s-a rezervat ' || v_nr, 200),
              left(v_nr || ', ' || v_interval || '. Scop: ' || rtrim(new.scop, '.') || '.', 4000),
              '/flota/rezervari', 'vehicle_reservation', new.id);
    end if;
    return null;
  end if;

  if old.status = 'ceruta' and new.status in ('confirmata', 'respinsa') then
    if v_om_activ then
      insert into public.notifications
        (organization_id, user_id, kind, title, body, link, entity_type, entity_id)
      values (new.organization_id, v_om.user_id, 'approval'::public.notification_kind,
              case when new.status = 'confirmata' then 'Rezervarea a fost aprobată'
                   else 'Rezervarea a fost respinsă' end,
              left(v_nr || ', ' || v_interval || '.'
                   || case when new.status = 'respinsa'
                           then coalesce(' Motiv: ' || rtrim(nullif(btrim(new.motiv_respingere), ''), '.') || '.', '')
                           else '' end, 4000),
              '/flota/rezervari', 'vehicle_reservation', new.id);
    end if;
  elsif new.status = 'anulata' then
    if v_actor is distinct from v_om.user_id then
      -- Anulată de altcineva (un aprobator, administratorul sau sistemul).
      if v_om_activ then
        insert into public.notifications
          (organization_id, user_id, kind, title, body, link, entity_type, entity_id)
        values (new.organization_id, v_om.user_id, 'warning'::public.notification_kind,
                'Rezervarea a fost anulată',
                left(v_nr || ', ' || v_interval || '.'
                     || coalesce(' Motiv: ' || rtrim(nullif(btrim(new.motiv_anulare), ''), '.') || '.', ''), 4000),
                '/flota/rezervari', 'vehicle_reservation', new.id);
      end if;
    elsif old.status = 'confirmata' and old.decis_de is not null and old.decis_de is distinct from v_actor
          and exists (select 1 from public.organization_members m
                       where m.organization_id = new.organization_id and m.user_id = old.decis_de
                         and m.status = 'active' and m.deleted_at is null) then
      -- Angajatul își anulează rezervarea aprobată de altcineva.
      insert into public.notifications
        (organization_id, user_id, kind, title, body, link, entity_type, entity_id)
      values (new.organization_id, old.decis_de, 'info'::public.notification_kind,
              'Rezervare anulată de angajat',
              left(coalesce(v_om.full_name, 'Angajatul') || ' a anulat rezervarea pentru ' || v_nr
                   || ', ' || v_interval || '.', 4000),
              '/flota/rezervari', 'vehicle_reservation', new.id);
    end if;
  end if;
  return null;
end;
$$;

create trigger rezervari_notifica
  after insert or update of status on public.vehicle_reservations
  for each row execute function internal.rezervari_notifica();

-- ============================================================
-- 8. Triggerul pe foi: `internal.foi_parcurs_rezervare()`
-- ============================================================
-- BEFORE INSERT OR UPDATE pe `trip_sheets`. Sortează după
-- `foi_deplasare_garda` < `foi_parcurs_fara_autoaprobare` < `foi_parcurs_inainte`
-- < `foi_parcurs_numerotare`, deci vede `plecare_la` final (agregatele, 0200) și
-- rândul deja trecut de gărzile de stare. NU atinge `foi_parcurs_inainte`.
--
-- `trip_sheets.data` e GENERATED (0200): într-un BEFORE e încă NULL. Ziua se
-- calculează aici cu expresia coloanei.
create or replace function internal.foi_parcurs_rezervare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pool   boolean;
  v_set    record;
  v_zi     date := (new.plecare_la at time zone 'Europe/Bucharest')::date;
  v_zi_vechi date;
begin
  if tg_op = 'UPDATE' then
    v_zi_vechi := (old.plecare_la at time zone 'Europe/Bucharest')::date;
    if (new.vehicle_id, new.employee_id, v_zi) is not distinct from (old.vehicle_id, old.employee_id, v_zi_vechi)
       and not (old.status = 'respins' and new.status <> 'respins')
       and new.deleted_at is not distinct from old.deleted_at then
      new.vehicle_reservation_id := old.vehicle_reservation_id;   -- clientul n-o poate muta
      return new;
    end if;
  end if;
  if new.deleted_at is not null or new.status = 'respins' or v_zi is null then
    -- Clientul nu poate strecura o legătură nici pe ramura asta (ștergere sau
    -- respingere în același PATCH): se păstrează cea veche, sau nimic la INSERT.
    new.vehicle_reservation_id := case when tg_op = 'UPDATE' then old.vehicle_reservation_id end;
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('flota:vehicul:' || new.vehicle_id::text, 0));
  select v.pool into v_pool from public.vehicles v where v.id = new.vehicle_id;

  -- Legătura o pune doar baza: rezervarea CONFIRMATĂ a aceluiași șofer, pe același
  -- vehicul, care acoperă ziua foii (EXCLUDE-ul garantează cel mult una).
  new.vehicle_reservation_id := (
    select r.id from public.vehicle_reservations r
     where r.vehicle_id = new.vehicle_id and r.employee_id = new.employee_id
       and r.deleted_at is null and r.status = 'confirmata'
       and v_zi between r.de_la and r.pana_la
     limit 1);

  if not coalesce(v_pool, false) then
    return new;
  end if;

  if exists (select 1 from public.vehicle_reservations r
              where r.vehicle_id = new.vehicle_id and r.deleted_at is null
                and r.status in ('ceruta', 'confirmata') and r.employee_id <> new.employee_id
                and v_zi between r.de_la and r.pana_la) then
    raise exception using errcode = 'P0001',
      message = format('Vehiculul este rezervat pentru alt angajat pe %s. Alegeți altă mașină sau altă zi.',
                       to_char(v_zi, 'DD.MM.YYYY'));
  end if;

  if new.vehicle_reservation_id is null and not app.is_service_context() then
    select * into v_set from internal.flota_setari_rezervari(new.organization_id);
    if v_set.obligatorie and app.has_permission(new.organization_id, 'trip_sheets', 'create') <> 'all' then
      raise exception using errcode = 'P0001',
        message = format('Vehiculul se folosește doar cu rezervare confirmată. Rezervați-l pentru %s din „Mașina mea → Rezervări”.',
                         to_char(v_zi, 'DD.MM.YYYY'));
    end if;
  end if;
  return new;
end;
$$;

create trigger foi_parcurs_rezervare
  before insert or update on public.trip_sheets
  for each row execute function internal.foi_parcurs_rezervare();

-- ============================================================
-- 9. Alocări peste rezervări: `internal.alocari_rezervari()`
-- ============================================================
-- BEFORE INSERT pe `vehicle_assignments`; sortează după `alocari_inainte`, deci
-- după validarea de firmă și de vehicul. Refuz, fără anulare automată: altfel
-- angajatul și-ar pierde rezervarea tăcut (decizia I-d6).
create or replace function internal.alocari_rezervari()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prima date;
begin
  -- Y2: garda de firmă, prima. Rezervările se caută pe vehicul, fără firmă:
  -- pe un rând pus pe firma B, mesajul dădea ziua primei rezervări de acolo.
  -- Primul BEFORE pe `vehicle_assignments` e `alocari_inainte`, cu aceeași
  -- gardă din 0233; aici rămâne pentru cazul în care ordinea se schimbă.
  if not app.is_service_context()
     and not coalesce(new.organization_id = any ((select app.current_org_ids())::uuid[]), false) then
    raise exception using errcode = '42501',
      message = 'Nu aveți dreptul de a aloca vehicule în această organizație.';
  end if;

  if new.deleted_at is not null then
    return new;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('flota:vehicul:' || new.vehicle_id::text, 0));

  select min(r.de_la) into v_prima
    from public.vehicle_reservations r
   where r.vehicle_id = new.vehicle_id and r.deleted_at is null
     and r.status in ('ceruta', 'confirmata') and r.employee_id <> new.employee_id
     and tstzrange(r.de_la::timestamp at time zone 'Europe/Bucharest',
                   (r.pana_la + 1)::timestamp at time zone 'Europe/Bucharest', '[)')
         && tstzrange(new.de_la, coalesce(new.pana_la, 'infinity'::timestamptz), '[)');
  if v_prima is not null then
    raise exception using errcode = 'P0001',
      message = format('Vehiculul are rezervări active începând cu %s. Anulați-le întâi (Parc auto → Rezervări), apoi alocați vehiculul.',
                       to_char(v_prima, 'DD.MM.YYYY'));
  end if;
  return new;
end;
$$;

create trigger alocari_rezervari
  before insert on public.vehicle_assignments
  for each row execute function internal.alocari_rezervari();

-- ============================================================
-- 10. Ieșirea vehiculului: `internal.rezervari_la_iesirea_vehiculului()`
-- ============================================================
-- AFTER UPDATE pe `vehicles`: `pool` true → false, intrarea în `vandut`/`casat`,
-- ștergerea logică. Anulează rezervările active care nu s-au încheiat și n-au
-- foaie, legată sau a omului în zilele ei (`rezervari_ultima_foaie`); cele cu
-- foaie rămân: sunt istoria foii. Precedentul:
-- `alocari_inchide_la_iesire` (0173), care scrie tot sub FORCE RLS din definer.
-- `updated_by` nu se scrie: politica de UPDATE nu se aplică proprietarului.
create or replace function internal.rezervari_la_iesirea_vehiculului()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not ((old.pool and not new.pool)
          or (new.status in ('vandut', 'casat') and old.status not in ('vandut', 'casat'))
          or (new.deleted_at is not null and old.deleted_at is null)) then
    return null;
  end if;

  perform pg_catalog.set_config('app.flota_rezervari_sistem', 'on', true);
  update public.vehicle_reservations r
     set status = 'anulata', anulat_la = now(), anulat_de = auth.uid(), updated_at = now(),
         motiv_anulare = case when not new.pool and new.deleted_at is null and new.status not in ('vandut', 'casat')
                              then 'Vehiculul nu mai este mașină de pool.'
                              else 'Vehiculul a ieșit din parc.' end
   where r.vehicle_id = new.id and r.deleted_at is null and r.status in ('ceruta', 'confirmata')
     and r.pana_la >= app.azi_local()
     and internal.rezervari_ultima_foaie(r.id, r.vehicle_id, r.employee_id, r.de_la, r.pana_la) is null;
  perform pg_catalog.set_config('app.flota_rezervari_sistem', '', true);
  return null;
end;
$$;

create trigger vehicles_rezervari_la_iesire
  after update on public.vehicles
  for each row execute function internal.rezervari_la_iesirea_vehiculului();

-- ============================================================
-- 11. Funcții pentru ecran (`public.*`, prin `.rpc()`)
-- ============================================================
-- `public`, nu `app`: PostgREST expune doar `public` (CLAUDE.md). Precedentul:
-- `public.drepturile_mele_concediu` (0108).
create or replace function public.ocuparea_vehiculelor_pool(p_organization_id uuid, p_de_la date, p_pana_la date)
returns table (vehicle_id uuid, de_la date, pana_la date, sursa text, status text, a_mea boolean, rezervare_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_eu    uuid;
  v_de_la date;
begin
  if p_organization_id is null
     or not (p_organization_id = any (app.current_org_ids()))
     or not app.feature_on(p_organization_id, 'fleet')
     or app.has_permission(p_organization_id, 'vehicle_reservations', 'create') = 'none' then
    return;   -- zero rânduri, nu o eroare care ar confirma că firma există (0108)
  end if;
  if p_de_la is null or p_pana_la is null or p_pana_la < p_de_la or p_pana_la - p_de_la > 62 then
    raise exception using errcode = '22023', message = 'Fereastra de ocupare are cel mult 63 de zile.';
  end if;
  -- Doar de AZI încolo: se rezervă cel mai devreme azi, iar grila începe azi.
  -- Trecutul parcului (foile și alocările colegilor) nu iese pe aici: cine are
  -- dreptul îl citește prin RLS, din liste. O fereastră trecută dă zero rânduri.
  v_de_la := greatest(p_de_la, app.azi_local());
  if p_pana_la < v_de_la then
    return;
  end if;
  v_eu := app.current_employee_id(p_organization_id);
  return query
    select r.vehicle_id, greatest(r.de_la, v_de_la), least(r.pana_la, p_pana_la), 'rezervare'::text,
           r.status::text, coalesce(r.employee_id = v_eu, false),
           case when r.employee_id = v_eu then r.id end
      from public.vehicle_reservations r
      join public.vehicles v on v.id = r.vehicle_id
     where r.organization_id = p_organization_id and r.deleted_at is null
       and r.status in ('ceruta', 'confirmata') and r.de_la <= p_pana_la and r.pana_la >= v_de_la
       and v.pool and v.deleted_at is null
    union all
    -- Starea foii NU iese (NULL): sub `trip_sheets:read = own` colegul n-o vede,
    -- iar grilei îi ajunge că ziua e luată.
    select t.vehicle_id, t.data, t.data, 'foaie'::text, null::text, coalesce(t.employee_id = v_eu, false),
           null::uuid
      from public.trip_sheets t
      join public.vehicles v on v.id = t.vehicle_id
     where t.organization_id = p_organization_id and t.deleted_at is null and t.status <> 'respins'
       and t.vehicle_reservation_id is null and t.data between v_de_la and p_pana_la
       and v.pool and v.deleted_at is null
    union all
    select a.vehicle_id,
           greatest((a.de_la at time zone 'Europe/Bucharest')::date, v_de_la),
           least(coalesce((a.pana_la at time zone 'Europe/Bucharest')::date, p_pana_la), p_pana_la),
           'alocare'::text, null::text, coalesce(a.employee_id = v_eu, false), null::uuid
      from public.vehicle_assignments a
      join public.vehicles v on v.id = a.vehicle_id
     where a.organization_id = p_organization_id and a.deleted_at is null
       and v.pool and v.deleted_at is null
       and (a.de_la at time zone 'Europe/Bucharest')::date <= p_pana_la
       and coalesce((a.pana_la at time zone 'Europe/Bucharest')::date, p_pana_la) >= v_de_la;
end;
$$;

comment on function public.ocuparea_vehiculelor_pool(uuid, date, date) is
  'Ocuparea mașinilor de pool pe o fereastră de cel mult 63 de zile, tăiată la azi (0216): intervalele, sursa (rezervare / foaie / alocare), starea rezervării și a_mea. NU întoarce identitatea colegilor, starea foilor lor sau zilele trecute; id-ul rezervării doar pe ale apelantului. În public fiindcă .rpc() nu ajunge la app. Zero rânduri pentru cine nu poate rezerva.';

-- `anon` explicit: 0002 revocă implicit doar de la PUBLIC, iar privilegiile
-- implicite ale platformei pot da EXECUTE direct rolului anon.
revoke all on function public.ocuparea_vehiculelor_pool(uuid, date, date) from public, anon;
grant execute on function public.ocuparea_vehiculelor_pool(uuid, date, date) to authenticated;

create or replace function public.setarile_rezervarilor(p_organization_id uuid)
returns table (cu_aprobare boolean, obligatorie boolean, max_zile integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.cu_aprobare, s.obligatorie, s.max_zile
    from internal.flota_setari_rezervari(p_organization_id) s
   where p_organization_id = any (app.current_org_ids())
     and app.feature_on(p_organization_id, 'fleet');
$$;

comment on function public.setarile_rezervarilor(uuid) is
  'Cele trei setări ale rezervărilor pentru membrii firmei (0216): aprobare, obligatorie, durata maximă. Nu întoarce responsabilii sau pragurile (fleet_settings rămâne a administratorilor). În public fiindcă .rpc() nu ajunge la app.';

revoke all on function public.setarile_rezervarilor(uuid) from public, anon;
grant execute on function public.setarile_rezervarilor(uuid) to authenticated;

-- ============================================================
-- 12. RLS
-- ============================================================
alter table public.vehicle_reservations enable row level security;
alter table public.vehicle_reservations force row level security;

-- `deleted_at is null` NU intră în USING-ul politicii de SELECT (lecția 0016).
create policy rezervari_select on public.vehicle_reservations
for select to authenticated
using (
  (select app.is_platform_admin())
  or (organization_id = any ((select app.current_org_ids())::uuid[])
      and app.feature_on(organization_id, 'fleet')
      and (app.poate_rezervare(organization_id, employee_id, 'read')
           or app.poate_rezervare(organization_id, employee_id, 'approve')))
);

create policy rezervari_insert on public.vehicle_reservations
for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.poate_rezervare(organization_id, employee_id, 'create')
  and deleted_at is null
  and status in ('ceruta', 'confirmata')
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

-- Lecția din 0155: aprobatorul trebuie să treacă ȘI de WITH CHECK, nu doar de
-- USING. Ce poate schimba fiecare rol decide triggerul (§6), nu politica.
create policy rezervari_update on public.vehicle_reservations
for update to authenticated
using (
  deleted_at is null
  and organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and (app.poate_rezervare(organization_id, employee_id, 'update')
       or app.poate_rezervare(organization_id, employee_id, 'approve'))
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and deleted_at is null        -- a doua plasă, peste garda din trigger
  and (app.poate_rezervare(organization_id, employee_id, 'update')
       or app.poate_rezervare(organization_id, employee_id, 'approve'))
  and updated_by = (select auth.uid())
);

-- ============================================================
-- 13. Actor, audit, drepturi
-- ============================================================
-- Flota NU are `internal.set_actor`: `created_by`/`updated_by` se trimit explicit
-- din acțiuni (capcana 23), iar politicile le cer.
do $$
declare t text;
begin
  foreach t in array array['vehicle_reservations'] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function internal.seteaza_updated_at()',
      t || '_set_updated_at', t);
    perform internal.attach_audit(t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end
$$;

revoke all on function internal.flota_setari_rezervari(uuid) from public, anon, authenticated;
revoke all on function internal.rezervari_aprobatori(uuid, uuid) from public, anon, authenticated;
revoke all on function internal.rezervari_interval(date, date) from public, anon, authenticated;
revoke all on function internal.rezervari_ultima_foaie(uuid, uuid, uuid, date, date) from public, anon, authenticated;
revoke all on function internal.rezervari_inainte() from public, anon, authenticated;
revoke all on function internal.rezervari_notifica() from public, anon, authenticated;
revoke all on function internal.foi_parcurs_rezervare() from public, anon, authenticated;
revoke all on function internal.alocari_rezervari() from public, anon, authenticated;
revoke all on function internal.rezervari_la_iesirea_vehiculului() from public, anon, authenticated;
revoke all on function app.poate_rezervare(uuid, uuid, text) from public, anon;
grant execute on function app.poate_rezervare(uuid, uuid, text) to authenticated, service_role;

-- ============================================================
-- 14. Seed-ul de permisiuni
-- ============================================================
-- Forma 2 din `src/config/permissions.test.ts` (`('rol','resursă','scope','{acțiuni}')`),
-- cu cele CINCI coloane ale indexului din 0063. `hr` nu primește niciun rând:
-- absența e forma corectă a lui „nu” (decizia 3: HR nu vede parcul). Fără
-- `delete` sau `export`: n-au consumator (lecția `checklists:approve`).
-- `manager`: își face propria rezervare (`create`/`update` = own, ca 0154 și
-- 0161), le vede și le decide pe ale echipei (`read`/`approve` = team).
with m(rol, resursa, scop, actiuni) as (values
  ('super_admin','vehicle_reservations','all',  '{read,create,update,approve}'),
  ('org_admin','vehicle_reservations','all',    '{read,create,update,approve}'),
  ('manager','vehicle_reservations','team',     '{read,approve}'),
  ('manager','vehicle_reservations','own',      '{create,update}'),
  ('employee','vehicle_reservations','own',     '{read,create,update}')
)
insert into public.role_permissions (organization_id, role, resource, action, scope)
select null, m.rol::public.app_role, m.resursa, a, m.scop::public.permission_scope
  from m, lateral unnest(m.actiuni::text[]) as a
on conflict (organization_id, member_id, role, resource, action) where deleted_at is null do nothing;

-- ============================================================
-- 15. Note de proiectare
-- ============================================================
-- · ZILE, nu ore: foaia e „antet pe vehicul și zi” (0200, `ts_vehicul_zi_uq`).
--   Două rezervări pe ore diferite ale aceleiași zile ar fi fost permise de
--   rezervare și refuzate apoi de foaie, la al doilea șofer (decizia I-d1).
-- · `ceruta` blochează zilele: altfel aprobatorul ar alege între două cereri, iar
--   al doilea solicitant ar afla abia la respingere.
-- · Lacătul pe vehicul (`flota:vehicul:<id>`) e comun rezervării, foii și
--   alocării: o rezervare și o foaie concurente pe aceeași zi ar trece altfel
--   amândouă, fiindcă fiecare citește un instantaneu fără rândul celeilalte.
-- · Fără DELETE: rezervarea greșită se anulează, iar `deleted_at` există doar
--   pentru convenție (indexurile parțiale, contextul de serviciu).
-- · Rezervarea proprie a celui cu `approve = all` se confirmă direct (decizia
--   I-d9): excepție asumată de la 0016, unde foaia nu se auto-aprobă nici sub
--   `all`. Rezervarea nu e document justificativ, iar singurul administrator al
--   unei firme mici n-ar avea cine să-l aprobe.

-- ============================================================
-- 16. Verificarea de la final
-- ============================================================
do $$
declare
  v_lipsa text[] := '{}';
begin
  if to_regclass('public.vehicle_reservations') is null then
    v_lipsa := v_lipsa || 'vehicle_reservations';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'vr_fara_suprapunere' and contype = 'x') then
    v_lipsa := v_lipsa || 'EXCLUDE vr_fara_suprapunere';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'vehicle_reservations') <> 3 then
    v_lipsa := v_lipsa || 'trio-ul de politici pe vehicle_reservations';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vehicle_reservations'
              and cmd = 'DELETE') then
    v_lipsa := v_lipsa || 'politică DELETE pe vehicle_reservations (interzisă)';
  end if;
  if not (select relforcerowsecurity from pg_class where oid = 'public.vehicle_reservations'::regclass) then
    v_lipsa := v_lipsa || 'FORCE RLS pe vehicle_reservations';
  end if;
  if exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'vehicle_reservations'
              and indexname <> 'vehicle_reservations_pkey' and indexname <> 'vr_fara_suprapunere'
              and indexdef not ilike '%where%deleted_at is null%') then
    v_lipsa := v_lipsa || 'index NEPARȚIAL pe vehicle_reservations';
  end if;
  if (select count(*) from pg_trigger t
        where not t.tgisinternal
          and ((t.tgrelid = 'public.vehicle_reservations'::regclass
                and t.tgname in ('rezervari_inainte', 'rezervari_notifica', 'vehicle_reservations_set_updated_at'))
            or (t.tgrelid = 'public.trip_sheets'::regclass and t.tgname = 'foi_parcurs_rezervare')
            or (t.tgrelid = 'public.vehicle_assignments'::regclass and t.tgname = 'alocari_rezervari')
            or (t.tgrelid = 'public.vehicles'::regclass and t.tgname = 'vehicles_rezervari_la_iesire'))) <> 6 then
    v_lipsa := v_lipsa || 'triggerele 0216 (6)';
  end if;
  if (select count(*) from public.role_permissions
       where resource = 'vehicle_reservations' and organization_id is null and member_id is null
         and deleted_at is null) <> 15 then
    v_lipsa := v_lipsa || 'seed-ul vehicle_reservations (15 rânduri)';
  end if;
  if exists (select 1 from public.role_permissions
              where resource = 'vehicle_reservations' and role = 'hr' and deleted_at is null
                and organization_id is null and member_id is null) then
    v_lipsa := v_lipsa || 'seed-ul vehicle_reservations acordat lui hr';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'fleet_settings'
                    and column_name = 'rezervari_max_zile') then
    v_lipsa := v_lipsa || 'fleet_settings.rezervari_max_zile';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where (n.nspname, p.proname) in (
                      ('internal', 'flota_setari_rezervari'), ('internal', 'rezervari_aprobatori'),
                      ('internal', 'rezervari_interval'), ('internal', 'rezervari_ultima_foaie'),
                      ('internal', 'rezervari_inainte'),
                      ('internal', 'rezervari_notifica'), ('internal', 'foi_parcurs_rezervare'),
                      ('internal', 'alocari_rezervari'), ('internal', 'rezervari_la_iesirea_vehiculului'),
                      ('app', 'poate_rezervare'), ('public', 'ocuparea_vehiculelor_pool'),
                      ('public', 'setarile_rezervarilor'))
                and (p.proconfig is null or not ('search_path=""' = any (p.proconfig)))) then
    v_lipsa := v_lipsa || 'search_path gol pe funcțiile 0216';
  end if;
  if has_function_privilege('anon', 'public.ocuparea_vehiculelor_pool(uuid, date, date)', 'execute')
     or has_function_privilege('anon', 'public.setarile_rezervarilor(uuid)', 'execute') then
    v_lipsa := v_lipsa || 'EXECUTE pentru anon pe RPC-urile 0216';
  end if;
  if array_length(v_lipsa, 1) > 0 then
    raise exception '0216: lipsesc %', array_to_string(v_lipsa, ', ');
  end if;
end $$;

commit;
