-- supabase/migrations/0045_ticketing_it.sql
-- Ticketing IT: patru tipuri de solicitare într-un singur tabel, cu discriminator.
--
-- Fluxuri:
--   software, hardware  → aprobare de la managerul direct SAU de la patron
--                         (prima decizie contează), apoi rezolvare
--   defectiune          → fără aprobare, direct în lucru
--   bug_erp             → nu se rezolvă în organizație: ajunge la furnizor,
--                         adică la administratorul de platformă
--
-- Integritate cu restul aplicației, cerută explicit: o defecțiune se referă la
-- un obiect REAL din inventar, alocat REAL solicitantului. Nu se poate exprima
-- printr-un CHECK (are nevoie de subinterogare), deci e trigger — vezi §6.
--
-- Aprobarea NU refolosește `approval_flows`/`approval_tasks`, deși cadrul acela
-- e polimorfic prin `entity_type`. Motivul: politica `approval_tasks_select` din
-- 0009_leave.sql are resursa hardcodată — `app.has_permission(organization_id,
-- 'leave', 'approve') = 'all'`. Refolosirea ar fi cerut modificarea unei politici
-- care păzește concediile, pentru un flux cu o singură treaptă. Aprobarea stă
-- aici, în coloane explicite, iar cine are voie să decidă rezultă din algebra de
-- scope-uri existentă: patronul are `tickets:approve` = 'all', managerul are
-- 'team' și e limitat suplimentar la subalternii lui DIRECȚI (§7).

begin;

-- ============================================================
-- 1. TIPURI
-- ============================================================

create type public.ticket_type as enum ('software', 'hardware', 'defectiune', 'bug_erp');

create type public.ticket_status as enum (
  'nou',
  'in_aprobare',
  'respins',
  'in_lucru',
  'in_asteptare',   -- se așteaptă răspunsul solicitantului
  'rezolvat',
  'inchis',
  'anulat',
  'redeschis'
);

create type public.ticket_priority as enum ('scazuta', 'normala', 'ridicata', 'critica');

create type public.ticket_delivery as enum ('birou', 'domiciliu');

-- ============================================================
-- 2. TABELA PRINCIPALĂ
-- ============================================================

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  numar_afisat text not null,
  tip public.ticket_type not null,
  titlu text not null,
  descriere text not null,

  -- `on delete restrict`: un tichet nu rămâne fără solicitant. Fișele de angajat
  -- se șterg logic (`deleted_at`), nu fizic, deci restricția nu blochează nimic
  -- din fluxul normal de plecare din firmă.
  solicitant_employee_id uuid not null references public.employees (id) on delete restrict,
  department_id uuid references public.departments (id) on delete set null,

  status public.ticket_status not null default 'nou',
  prioritate public.ticket_priority not null default 'normala',
  prioritate_manuala boolean not null default false,
  prioritate_motiv text,

  asignat_employee_id uuid references public.employees (id) on delete set null,
  inventory_item_id uuid references public.inventory_items (id) on delete restrict,
  parent_ticket_id uuid references public.tickets (id) on delete set null,

  -- Rezervat pentru SLA formal (calendar de lucru, escaladare). NEFOLOSIT acum,
  -- deliberat: coloana există ca să nu fie nevoie de o migrație de structură
  -- când se implementează.
  sla_policy_id uuid,

  -- ── Aprobare (doar software/hardware) ──────────────────────────────────────
  aprobare_ceruta boolean not null default false,
  aprobat_de_employee_id uuid references public.employees (id) on delete set null,
  decizie_la timestamptz,
  motiv_respingere text,

  -- ── Specific: software ─────────────────────────────────────────────────────
  aplicatie text,
  motiv_necesitate text,
  numar_licente integer,

  -- ── Specific: hardware ─────────────────────────────────────────────────────
  denumire_hardware text,
  loc_livrare public.ticket_delivery,
  adresa_livrare text,
  cost_estimat numeric(12, 2),

  -- ── Specific: defecțiune ───────────────────────────────────────────────────
  -- Obiectul stricat se alege DIN inventarul alocat angajatului, fără portiță
  -- de text liber: explicația defecțiunii merge în `descriere`. Dacă un obiect
  -- lipsește din inventar, se înregistrează acolo întâi — altfel tichetele ar
  -- deveni o a doua evidență, paralelă și necontrolată.
  blocheaza_activitatea boolean,
  locatie text,

  -- ── Specific: bug ERP ──────────────────────────────────────────────────────
  modul text,
  pasi_efectuati text,
  rezultat_asteptat text,
  rezultat_obtinut text,
  context jsonb,           -- URL, user agent, versiune — capturat automat

  closed_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,

  constraint tickets_titlu_ck check (char_length(btrim(titlu)) between 3 and 200),
  constraint tickets_descriere_ck check (char_length(btrim(descriere)) between 3 and 8000),
  constraint tickets_numar_ck check (numar_afisat ~ '^[A-Z]{2,16}-[0-9]{4}-[0-9]{1,12}$'),

  -- Coerența câmpurilor cu tipul. Fiecare regulă e scrisă ca implicație
  -- („dacă e tipul X, atunci…”), ca un tichet de alt tip să nu fie constrâns.
  constraint tickets_software_ck check (
    tip <> 'software'
    or (
      aplicatie is not null
      and char_length(btrim(aplicatie)) between 2 and 160
      and numar_licente is not null
      and numar_licente between 1 and 10000
    )
  ),
  constraint tickets_hardware_ck check (
    tip <> 'hardware'
    or (
      denumire_hardware is not null
      and char_length(btrim(denumire_hardware)) between 2 and 200
      and loc_livrare is not null
      and (loc_livrare <> 'domiciliu' or char_length(btrim(coalesce(adresa_livrare, ''))) >= 5)
    )
  ),
  constraint tickets_defectiune_ck check (
    tip <> 'defectiune'
    or (blocheaza_activitatea is not null and inventory_item_id is not null)
  ),
  constraint tickets_bug_ck check (
    tip <> 'bug_erp'
    or (
      modul is not null
      and pasi_efectuati is not null
      and rezultat_asteptat is not null
      and rezultat_obtinut is not null
    )
  ),

  -- Obiectul de inventar are sens DOAR la defecțiune. Cererea de hardware e o
  -- cerere către manager pentru ceva ce angajatul nu are încă („am nevoie de un
  -- monitor”), deci nu poate referi un obiect existent.
  constraint tickets_inventar_ck check (inventory_item_id is null or tip = 'defectiune'),

  -- Aprobarea e o proprietate a tipului, nu o alegere: nu se poate crea un
  -- software fără aprobare, nici o defecțiune cu aprobare.
  constraint tickets_aprobare_ck check (aprobare_ceruta = (tip in ('software', 'hardware'))),
  constraint tickets_decizie_ck check (
    (decizie_la is null and aprobat_de_employee_id is null)
    or (decizie_la is not null and aprobare_ceruta)
  ),
  constraint tickets_respingere_ck check (status <> 'respins' or motiv_respingere is not null),
  constraint tickets_status_aprobare_ck check (
    status not in ('in_aprobare', 'respins') or aprobare_ceruta
  ),

  constraint tickets_prioritate_motiv_ck check (
    prioritate_manuala = false or char_length(btrim(coalesce(prioritate_motiv, ''))) >= 3
  ),
  constraint tickets_parent_ck check (parent_ticket_id is null or parent_ticket_id <> id),
  constraint tickets_closed_ck check (
    closed_at is null or status in ('inchis', 'anulat', 'respins')
  ),
  constraint tickets_cost_ck check (cost_estimat is null or cost_estimat >= 0)
);

comment on table public.tickets is
  'Solicitări IT: software, hardware, defecțiune pe un obiect de inventar, bug în ERP. Un singur tabel cu discriminator `tip`; coloanele specifice sunt validate prin CHECK-uri scrise ca implicații pe tip.';
comment on column public.tickets.sla_policy_id is
  'Rezervat pentru SLA formal (calendar de lucru, escaladare). Nefolosit deocamdată — există ca să nu ceară migrație de structură ulterior.';
comment on column public.tickets.context is
  'Capturat automat la bug_erp: URL, user agent, versiune aplicație. Invizibil pentru solicitant.';

create unique index tickets_numar_uq
  on public.tickets (organization_id, numar_afisat) where deleted_at is null;
create index tickets_org_status_idx
  on public.tickets (organization_id, status) where deleted_at is null;
create index tickets_solicitant_idx
  on public.tickets (solicitant_employee_id) where deleted_at is null;
create index tickets_asignat_idx
  on public.tickets (asignat_employee_id) where deleted_at is null;
create index tickets_inventar_idx
  on public.tickets (inventory_item_id) where deleted_at is null and inventory_item_id is not null;
create index tickets_parent_idx
  on public.tickets (parent_ticket_id) where deleted_at is null and parent_ticket_id is not null;
-- Coada furnizorului: toate bug-urile, peste organizații.
create index tickets_bug_idx
  on public.tickets (created_at desc) where deleted_at is null and tip = 'bug_erp';
-- Căutare pe titlu, consecvent cu restul aplicației (`ilike`, nu tsvector).
create index tickets_titlu_trgm_idx
  on public.tickets using gin (titlu extensions.gin_trgm_ops) where deleted_at is null;

grant select, insert, update on public.tickets to authenticated;

create trigger set_actor_tickets before insert or update on public.tickets
  for each row execute function internal.set_actor();
create trigger set_updated_at_tickets before update on public.tickets
  for each row execute function app.set_updated_at();

-- ============================================================
-- 3. TABELE ASOCIATE
-- ============================================================

create table public.ticket_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  autor_employee_id uuid references public.employees (id) on delete set null,
  continut text not null,
  -- `true` = notă internă, invizibilă solicitantului. Separarea e la nivel de
  -- rând și e aplicată în RLS, nu doar în interfață.
  intern boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint ticket_comments_continut_ck check (char_length(btrim(continut)) between 1 and 8000)
);
create index ticket_comments_ticket_idx
  on public.ticket_comments (ticket_id, created_at) where deleted_at is null;

create table public.ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  -- Fișierul stă în bucket-ul privat `org-documents`, ca restul documentelor.
  -- În tabel se ține doar calea, niciodată conținutul.
  storage_path text not null,
  denumire text not null,
  mime text,
  marime_bytes bigint,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint ticket_attachments_path_ck check (char_length(storage_path) between 3 and 400),
  constraint ticket_attachments_denumire_ck check (char_length(btrim(denumire)) between 1 and 200),
  constraint ticket_attachments_marime_ck check (marime_bytes is null or marime_bytes > 0)
);
create index ticket_attachments_ticket_idx
  on public.ticket_attachments (ticket_id) where deleted_at is null;

-- Istoric imutabil: fără UPDATE, fără DELETE, fără `deleted_at`. Auditul
-- generic din `audit_logs` rămâne valabil, dar acesta e cel afișat pe tichet.
create table public.ticket_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  camp text not null,
  valoare_veche text,
  valoare_noua text,
  motiv text,
  created_at timestamptz not null default now(),
  constraint ticket_history_camp_ck check (camp ~ '^[a-z][a-z0-9_]{1,40}$')
);
create index ticket_history_ticket_idx on public.ticket_history (ticket_id, created_at);

create table public.ticket_watchers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
create unique index ticket_watchers_uq on public.ticket_watchers (ticket_id, employee_id);

grant select, insert, update on public.ticket_comments to authenticated;
grant select, insert, update on public.ticket_attachments to authenticated;
grant select on public.ticket_history to authenticated;
grant select, insert, delete on public.ticket_watchers to authenticated;

create trigger set_actor_ticket_comments before insert or update on public.ticket_comments
  for each row execute function internal.set_actor();
create trigger set_updated_at_ticket_comments before update on public.ticket_comments
  for each row execute function app.set_updated_at();

-- ============================================================
-- 4. NUMEROTARE — IT-2026-00042
-- ============================================================
-- Aceeași mecanică atomică folosită la inventar (`app.aloca_numar_inventar`):
-- INSERT ... ON CONFLICT DO UPDATE, cu numărul consumat chiar dacă tranzacția
-- eșuează ulterior. O secvență de tichete are voie să aibă goluri; nu are voie
-- să repete un număr.

create or replace function app.aloca_numar_tichet(p_organization_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_an      integer := extract(year from app.azi_local())::integer;
  v_numar   integer;
  v_prefix  text;
  v_padding smallint;
begin
  if not (
    p_organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(p_organization_id, 'tickets', 'create', 'own')
  ) then
    raise exception using errcode = 'P0001',
      message = 'Nu aveți dreptul de a crea tichete în această organizație.';
  end if;

  insert into public.document_sequences (organization_id, document_type, year, prefix, next_number, padding)
  values (p_organization_id, 'tichet_it', v_an, 'IT', 2, 5)
  on conflict (organization_id, document_type, year) do update
    set next_number = public.document_sequences.next_number + 1,
        updated_at  = now()
  returning next_number - 1, prefix, padding
       into v_numar, v_prefix, v_padding;

  return coalesce(nullif(v_prefix, ''), 'IT') || '-' || v_an::text || '-'
         || lpad(v_numar::text, v_padding, '0');
end;
$$;

revoke all on function app.aloca_numar_tichet(uuid) from public, anon;
grant execute on function app.aloca_numar_tichet(uuid) to authenticated;

-- ============================================================
-- 5. INTEGRITATE CU INVENTARUL
-- ============================================================
-- Cerință explicită: dacă se strică ceva, acel ceva trebuie să fie un obiect
-- real din inventar, alocat real solicitantului. Nu se poate exprima printr-un
-- CHECK — are nevoie de subinterogare — deci e trigger.

create or replace function internal.tickets_valideaza_inventarul()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alocat boolean;
  v_org_obiect uuid;
begin
  if new.inventory_item_id is null then
    return new;
  end if;

  select i.organization_id into v_org_obiect
  from public.inventory_items i
  where i.id = new.inventory_item_id and i.deleted_at is null;

  if v_org_obiect is null then
    raise exception using errcode = 'P0001',
      message = 'Obiectul de inventar selectat nu există.';
  end if;
  if v_org_obiect <> new.organization_id then
    raise exception using errcode = 'P0001',
      message = 'Obiectul de inventar aparține altei organizații.';
  end if;

  -- Alocare curentă = predată și nereturnată.
  select exists (
    select 1
    from public.inventory_allocations a
    where a.item_id = new.inventory_item_id
      and a.employee_id = new.solicitant_employee_id
      and a.returnat_la is null
      and a.deleted_at is null
  ) into v_alocat;

  if not v_alocat then
    raise exception using errcode = 'P0001',
      message = 'Obiectul de inventar nu este alocat solicitantului. Alegeți unul dintre obiectele primite.';
  end if;

  return new;
end;
$$;

revoke all on function internal.tickets_valideaza_inventarul() from public, anon, authenticated;

create trigger trg_tickets_valideaza_inventarul
  before insert or update of inventory_item_id, solicitant_employee_id on public.tickets
  for each row execute function internal.tickets_valideaza_inventarul();

-- ============================================================
-- 6. MAȘINA DE STĂRI
-- ============================================================
-- Tranzițiile permise sunt enumerate explicit. Aceeași listă există și în
-- `src/domain/ticketing/stari.ts`, ca funcție pură testabilă — dar integritatea
-- nu poate depinde de client, deci se aplică și aici.

create or replace function internal.tickets_valideaza_tranzitia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_permis boolean;
  v_eu uuid;
  v_sunt_solicitant boolean;
  v_pot_aproba boolean;
  v_pot_opera boolean;
begin
  if new.status = old.status then
    return new;
  end if;

  v_eu := app.fisa_mea(new.organization_id);
  v_sunt_solicitant := v_eu is not null and v_eu = new.solicitant_employee_id;

  -- Cine decide o cerere: managerul DIRECT al solicitantului sau patronul
  -- (`tickets:approve` = 'all'). Niciodată solicitantul însuși, oricâte
  -- drepturi ar avea — un patron care își cere un laptop are nevoie tot de
  -- decizia altcuiva.
  v_pot_aproba := not v_sunt_solicitant
                  and (
                    app.sunt_manager_direct(new.solicitant_employee_id)
                    or app.can(new.organization_id, 'tickets', 'approve', 'all')
                  );

  -- Cine operează tichetul (IT/patron) și, pentru bug_erp, furnizorul.
  v_pot_opera := app.can(new.organization_id, 'tickets', 'update', 'all')
                 or (select app.is_platform_admin());

  -- Autorizarea tranziției, ÎNAINTE de a verifica dacă e permisă structural.
  -- Fără asta, `tickets_update` — care îl lasă pe solicitant să-și editeze
  -- tichetul, ca să poată comenta sau anula — ar fi permis auto-aprobarea:
  -- creezi cererea în `in_aprobare` și o muți singur în `in_lucru`.
  if old.status = 'in_aprobare' and new.status in ('in_lucru', 'respins') then
    if not v_pot_aproba then
      raise exception using errcode = 'P0001',
        message = 'Doar managerul direct al solicitantului sau administratorul organizației poate decide asupra acestei cereri.';
    end if;
    new.aprobat_de_employee_id := v_eu;
    new.decizie_la := now();
  elsif new.status in ('rezolvat', 'in_asteptare')
        or (new.status = 'in_lucru' and old.status <> 'in_aprobare') then
    if not v_pot_opera then
      raise exception using errcode = 'P0001',
        message = 'Nu aveți dreptul de a prelucra acest tichet.';
    end if;
  elsif new.status in ('anulat', 'inchis', 'redeschis') then
    if not (v_sunt_solicitant or v_pot_opera) then
      raise exception using errcode = 'P0001',
        message = 'Doar solicitantul sau echipa care prelucrează tichetul poate face această schimbare.';
    end if;
  end if;

  v_permis := case old.status
    -- Fără 'in_aprobare': tipurile care cer aprobare se nasc direct acolo
    -- (vezi `tickets_insert`), iar defecțiunea și bug-ul nu trec niciodată
    -- prin aprobare. Tranziția ar fi fost moartă și neautorizată.
    when 'nou'          then new.status in ('in_lucru', 'anulat')
    when 'in_aprobare'  then new.status in ('respins', 'in_lucru', 'anulat')
    when 'respins'      then new.status in ('anulat', 'redeschis')
    when 'in_lucru'     then new.status in ('in_asteptare', 'rezolvat', 'anulat')
    when 'in_asteptare' then new.status in ('in_lucru', 'rezolvat', 'anulat')
    when 'rezolvat'     then new.status in ('inchis', 'redeschis')
    when 'inchis'       then new.status in ('redeschis')
    when 'anulat'       then false
    when 'redeschis'    then new.status in ('in_lucru', 'anulat')
    else false
  end;

  if not v_permis then
    raise exception using errcode = 'P0001',
      message = format('Tranziție nepermisă: %s → %s.', old.status, new.status);
  end if;

  if new.status in ('inchis', 'anulat', 'respins') and new.closed_at is null then
    new.closed_at := now();
  end if;
  if new.status not in ('inchis', 'anulat', 'respins') then
    new.closed_at := null;
  end if;

  insert into public.ticket_history (organization_id, ticket_id, actor_user_id, camp, valoare_veche, valoare_noua)
  values (new.organization_id, new.id, auth.uid(), 'status', old.status::text, new.status::text);

  return new;
end;
$$;

revoke all on function internal.tickets_valideaza_tranzitia() from public, anon, authenticated;

create trigger trg_tickets_valideaza_tranzitia
  before update of status on public.tickets
  for each row execute function internal.tickets_valideaza_tranzitia();

-- Câmpurile pe care solicitantul NU are voie să le atingă. `tickets_update` îl
-- lasă să-și editeze tichetul, ca să poată completa descrierea sau să-l anuleze;
-- fără paza asta ar putea să-și scrie singur costul estimat („completat de IT,
-- nu de angajat”), să-și ridice prioritatea sau să-și trimită cererea altcuiva
-- ca aprobator. Verificarea e pe coloană, nu pe rând, tocmai ca dreptul de
-- editare să rămână util fără să devină periculos.
create or replace function internal.tickets_pazeste_campurile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := app.fisa_mea(new.organization_id);
  v_pot_opera boolean := app.can(new.organization_id, 'tickets', 'update', 'all')
                         or (select app.is_platform_admin());
begin
  if v_pot_opera then
    return new;
  end if;

  if new.cost_estimat is distinct from old.cost_estimat
     or new.prioritate is distinct from old.prioritate
     or new.prioritate_manuala is distinct from old.prioritate_manuala
     or new.prioritate_motiv is distinct from old.prioritate_motiv
     or new.asignat_employee_id is distinct from old.asignat_employee_id
     or new.parent_ticket_id is distinct from old.parent_ticket_id
     or new.sla_policy_id is distinct from old.sla_policy_id
     or new.numar_afisat is distinct from old.numar_afisat
     or new.tip is distinct from old.tip
     or new.solicitant_employee_id is distinct from old.solicitant_employee_id
     or new.aprobare_ceruta is distinct from old.aprobare_ceruta then
    raise exception using errcode = 'P0001',
      message = 'Nu aveți dreptul de a modifica aceste câmpuri ale tichetului.';
  end if;

  -- Decizia de aprobare se scrie exclusiv din `tickets_valideaza_tranzitia`,
  -- care rulează pe schimbarea de status și pune singur aprobatorul și data.
  if (new.aprobat_de_employee_id is distinct from old.aprobat_de_employee_id
      or new.decizie_la is distinct from old.decizie_la)
     and new.status is not distinct from old.status then
    raise exception using errcode = 'P0001',
      message = 'Decizia de aprobare nu poate fi scrisă direct.';
  end if;

  return new;
end;
$$;

revoke all on function internal.tickets_pazeste_campurile() from public, anon, authenticated;

-- Rulează după validarea tranziției (ordine alfabetică a numelor de trigger),
-- ca aprobatorul pus acolo să nu fie respins aici.
create trigger trg_tickets_zpazeste_campurile
  before update on public.tickets
  for each row execute function internal.tickets_pazeste_campurile();

-- ============================================================
-- 7. RLS
-- ============================================================

alter table public.tickets enable row level security;
alter table public.tickets force row level security;
alter table public.ticket_comments enable row level security;
alter table public.ticket_comments force row level security;
alter table public.ticket_attachments enable row level security;
alter table public.ticket_attachments force row level security;
alter table public.ticket_history enable row level security;
alter table public.ticket_history force row level security;
alter table public.ticket_watchers enable row level security;
alter table public.ticket_watchers force row level security;

-- Fișa de angajat principală a utilizatorului curent, într-o organizație.
create or replace function app.fisa_mea(p_organization_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id
  from public.employees e
  where e.organization_id = p_organization_id
    and e.user_id = (select auth.uid())
    and e.is_primary
    and e.deleted_at is null
  limit 1;
$$;

grant execute on function app.fisa_mea(uuid) to authenticated;

-- Managerul DIRECT al unui angajat, ca fișă. Deliberat direct, nu tot lanțul:
-- `manager_path` ar da întregul subarbore, iar cerința e „managerul direct”.
create or replace function app.sunt_manager_direct(p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.employees subaltern
    join public.employees sef on sef.id = subaltern.manager_employee_id
    where subaltern.id = p_employee_id
      and subaltern.deleted_at is null
      and sef.deleted_at is null
      and sef.user_id = (select auth.uid())
  );
$$;

grant execute on function app.sunt_manager_direct(uuid) to authenticated;

-- Vizibilitate:
--   • administratorul de platformă vede bug-urile ERP din toate organizațiile
--     (sunt raportate către furnizor) și, ca peste tot, are acces complet;
--   • solicitantul își vede tichetele proprii;
--   • urmăritorii (watchers) văd tichetul urmărit;
--   • managerul direct vede tichetele subalternilor lui;
--   • cine are `tickets:read` = 'all' (patron, IT) vede tot din organizație.
create policy tickets_select on public.tickets for select to authenticated
  using (
    (select app.is_platform_admin())
    or (
      deleted_at is null
      and organization_id = any ((select app.current_org_ids())::uuid[])
      and (
        app.has_permission(organization_id, 'tickets', 'read') = 'all'
        or solicitant_employee_id = app.fisa_mea(organization_id)
        or asignat_employee_id = app.fisa_mea(organization_id)
        or app.sunt_manager_direct(solicitant_employee_id)
        or exists (
          select 1 from public.ticket_watchers w
          where w.ticket_id = tickets.id
            and w.employee_id = app.fisa_mea(organization_id)
        )
      )
    )
  );

-- Creare: doar în numele propriu. Un angajat nu deschide tichete pentru altul.
create policy tickets_insert on public.tickets for insert to authenticated
  with check (
    deleted_at is null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'tickets', 'create', 'own')
    and solicitant_employee_id = app.fisa_mea(organization_id)
    and status = case when tip in ('software', 'hardware') then 'in_aprobare'::public.ticket_status
                      else 'nou'::public.ticket_status end
  );

create policy tickets_update on public.tickets for update to authenticated
  using (
    (select app.is_platform_admin())
    or (
      deleted_at is null
      and organization_id = any ((select app.current_org_ids())::uuid[])
      and (
        app.has_permission(organization_id, 'tickets', 'update') = 'all'
        or solicitant_employee_id = app.fisa_mea(organization_id)
        or asignat_employee_id = app.fisa_mea(organization_id)
        or app.sunt_manager_direct(solicitant_employee_id)
      )
    )
  )
  with check (
    (select app.is_platform_admin())
    or organization_id = any ((select app.current_org_ids())::uuid[])
  );

-- Comentariile urmează vizibilitatea tichetului; notele interne se ascund de
-- solicitant, dacă acesta nu are drept de citire completă.
create policy ticket_comments_select on public.ticket_comments for select to authenticated
  using (
    deleted_at is null
    and exists (select 1 from public.tickets t where t.id = ticket_id)
    and (
      intern = false
      or (select app.is_platform_admin())
      or app.has_permission(organization_id, 'tickets', 'read') = 'all'
      or autor_employee_id = app.fisa_mea(organization_id)
    )
  );

create policy ticket_comments_insert on public.ticket_comments for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and exists (select 1 from public.tickets t where t.id = ticket_id)
    and (intern = false or app.can(organization_id, 'tickets', 'update', 'team'))
  );

create policy ticket_comments_update on public.ticket_comments for update to authenticated
  using (deleted_at is null and autor_employee_id = app.fisa_mea(organization_id))
  with check (organization_id = any ((select app.current_org_ids())::uuid[]));

create policy ticket_attachments_select on public.ticket_attachments for select to authenticated
  using (deleted_at is null and exists (select 1 from public.tickets t where t.id = ticket_id));
create policy ticket_attachments_insert on public.ticket_attachments for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and exists (select 1 from public.tickets t where t.id = ticket_id)
  );
create policy ticket_attachments_update on public.ticket_attachments for update to authenticated
  using (deleted_at is null and organization_id = any ((select app.current_org_ids())::uuid[]))
  with check (organization_id = any ((select app.current_org_ids())::uuid[]));

-- Istoricul e doar de citit: nicio politică de insert/update/delete pentru
-- `authenticated`. Scrierea se face exclusiv din triggere `security definer`.
create policy ticket_history_select on public.ticket_history for select to authenticated
  using (exists (select 1 from public.tickets t where t.id = ticket_id));

create policy ticket_watchers_select on public.ticket_watchers for select to authenticated
  using (exists (select 1 from public.tickets t where t.id = ticket_id));
create policy ticket_watchers_insert on public.ticket_watchers for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and exists (select 1 from public.tickets t where t.id = ticket_id)
  );
create policy ticket_watchers_delete on public.ticket_watchers for delete to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (employee_id = app.fisa_mea(organization_id)
         or app.can(organization_id, 'tickets', 'update', 'team'))
  );

commit;
