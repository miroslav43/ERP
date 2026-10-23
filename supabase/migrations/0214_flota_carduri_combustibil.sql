-- supabase/migrations/0214_flota_carduri_combustibil.sql
--
-- FLOTA, EXTENSIA F12b: CARDURILE DE COMBUSTIBIL ȘI IMPORTUL EXTRASELOR.
--
-- Specificația o numea `0211_flota_carduri_combustibil`; 0210–0212 le-a luat
-- mentenanța la integrare, iar traseele F12 s-au mutat toate cu +3, deci e 0214.
--
-- ── DE UNDE VINE ────────────────────────────────────────────────────────────
-- Cardul de flotă e sursa a două lucruri pe care foaia de parcurs nu le are:
-- litrii FACTURAȚI și momentul REAL al alimentării. Până acum `fuel_entries` se
-- scria doar de mână, pe foaie, iar extrasul lunar ajungea la contabil fără să-l
-- compare nimeni cu foile (alimentare nedeclarată, bon fără tranzacție,
-- alimentare în ziua fără foaie, produs nepotrivit vehiculului).
--
-- ── CE ADUCE ────────────────────────────────────────────────────────────────
-- A. `public.fuel_cards`: emitentul (text cu CHECK, nu enum: rețelele se vând și
--    se redenumesc), DOAR ultimele 4–6 cifre și, opțional, amprenta HMAC a
--    numărului întreg (calculată în aplicație, `amprentaSensibila`); cardul e pe
--    un vehicul SAU pe un șofer SAU pe nimeni (rezervă); valabilitatea (ultima zi
--    a lunii de pe card) se proiectează în `expirables` (`entity_type =
--    'fuel_card'`), cu responsabilul = șoferul titular sau cel al vehiculului.
--    Vehiculul vândut, casat sau șters scoate scadența cardului din semafor
--    (`internal.carduri_proiecteaza`, chemată de AMBELE triggere).
-- B. `public.fuel_card_import_profiles`: maparea coloanelor salvată per firmă
--    și emitent (cheile se validează în Zod, `CAMPURI_EXTRAS`).
-- C. `public.fuel_card_imports`: lotul unui fișier (id = batchId-ul din client,
--    ca reluarea aplicării să fie idempotentă), cu sha256-ul fișierului.
-- D. `public.fuel_card_transactions`: registrul extraselor. NU se scrie în
--    `fuel_entries`: `trip_sheet_id` e acolo `not null`, iar
--    `internal.alimentari_inainte` refuză orice alimentare pe o foaie aprobată —
--    extrasul vine lunar, după aprobare. Registrul separat COMPARĂ, nu rescrie.
--    Dedup pe `(organization_id, emitent, cheie_dedup)`, unic parțial; datele din
--    extras sunt imuabile după import, se schimbă doar potrivirea și nota.
-- E. `app.poate_vedea_expirabil`, rescrisă INTEGRAL de la forma ultimă (0206,
--    verificat cu grep pe toate migrările, inclusiv 0210–0212), cu ramura
--    `fuel_card` (același drept ca documentele vehiculului) și garda pe TOATE
--    ramurile vechi.
-- F. Rezumatul zilnic al flotei (`internal.flota_rezumat`, forma ultimă: 0206
--    §G, cu amenzile) primește `fuel_card` în lista albă: cardul poate fi pe un
--    șofer, fără vehicul, iar legătura duce la `/flota/carduri?card=<id>`. (La
--    integrare: rescrierea pornise de la 0203 și pierdea tăcut ramura
--    `vehicle_fine` din 0206 §G; ramura e reaplicată, iar §13 o verifică.)
--    Pragurile flotei (`internal.flota_setari_praguri`, forma 0203) se
--    oglindesc și pentru carduri.
--
-- ── DREPTURILE ──────────────────────────────────────────────────────────────
-- Fără chei noi (F12b, Decizia 6): citirea cardului urmează vehiculul sau
-- șoferul titular; scrierea cere `vehicles:create/update = all`, ca vehiculele.
-- Tranzacțiile le vede DOAR `vehicles:read = all` (implicita I-b3: clauza „și
-- șoferul / managerul, pe foile vizibile” intră doar după „da”-ul lui Miro).
--
-- ── CE NU FACE ──────────────────────────────────────────────────────────────
--  · Nu scrie în `fuel_entries` (nici „Adaugă pe foaie”, implicita I-b2).
--  · Nu creează `vehicle_expense_id` pe tranzacție (implicita I-b4: tranzacțiile
--    care nu sunt combustibil rămân în raport).
--  · Nu șterge nimic automat (implicita I-T7): ștergerea e logică.
--  · Nu atinge `internal.conformitate_zilnica`, `app.can_path`, triggerele
--    alocărilor sau `internal.vehicles_dupa`.
--
-- Aplicare: psql byte-exact, după bancul local; producția cere confirmare.

begin;

-- ============================================================
-- 1. Tipurile
-- ============================================================
create type public.fuel_card_status as enum ('activ', 'blocat', 'anulat');

create type public.fuel_card_tx_categorie as enum (
  'combustibil', 'adblue', 'taxa_drum', 'spalatorie', 'parcare', 'magazin',
  'corectie', 'altele'
);

create type public.fuel_card_tx_potrivire as enum (
  'potrivita',          -- legată de o alimentare declarată, în toleranță
  'diferenta',          -- legată, dar litrii/valoarea ies din toleranță
  'fara_alimentare',    -- foaia zilei există, alimentarea declarată nu
  'fara_foaie',         -- vehiculul e cunoscut, foaia zilei nu există
  'vehicul_necunoscut', -- nici cardul, nici extrasul nu duc la un vehicul
  'card_necunoscut',    -- cardul din extras nu e înregistrat
  'necombustibil',      -- taxă, spălătorie, AdBlue etc.: nu se potrivește pe foaie
  'ignorata'            -- decisă de om, cu notă (sau storno)
);

-- ============================================================
-- 2. Cardurile
-- ============================================================
create table public.fuel_cards (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  emitent         text not null,
  denumire        text,                       -- eticheta internă, ex. „Card rezervă”
  ultimele_cifre  text not null,
  amprenta_numar  text,                       -- HMAC hex; null dacă numărul întreg nu s-a introdus
  vehicle_id      uuid references public.vehicles (id) on delete restrict,
  employee_id     uuid references public.employees (id) on delete restrict,
  valabil_pana    date,
  status          public.fuel_card_status not null default 'activ',
  observatii      text,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id) on delete set null,
  deleted_at      timestamptz,
  constraint fcard_emitent_ck check (emitent ~ '^[a-z][a-z0-9_]{1,30}$'),
  constraint fcard_cifre_ck check (ultimele_cifre ~ '^[0-9]{4,6}$'),
  constraint fcard_amprenta_ck check (amprenta_numar is null or amprenta_numar ~ '^[0-9a-f]{64}$'),
  constraint fcard_tinta_ck check (num_nonnulls(vehicle_id, employee_id) <= 1),
  constraint fcard_denumire_len check (denumire is null or char_length(denumire) between 1 and 80),
  constraint fcard_observatii_len check (observatii is null or char_length(observatii) <= 1000)
);

create unique index fcard_amprenta_uq on public.fuel_cards (organization_id, emitent, amprenta_numar)
  where amprenta_numar is not null and deleted_at is null;
create index fcard_cifre_idx on public.fuel_cards (organization_id, emitent, ultimele_cifre)
  where deleted_at is null;
create index fcard_vehicul_idx on public.fuel_cards (organization_id, vehicle_id)
  where vehicle_id is not null and deleted_at is null;
create index fcard_sofer_idx on public.fuel_cards (organization_id, employee_id)
  where employee_id is not null and deleted_at is null;
create index fcard_valabil_idx on public.fuel_cards (organization_id, valabil_pana)
  where valabil_pana is not null and deleted_at is null;

comment on table public.fuel_cards is
  'Cardurile de combustibil ale firmei (0214, F12b): emitentul, ultimele 4–6 cifre (numărul întreg NU se păstrează), atribuirea pe vehicul sau pe șofer, valabilitatea proiectată în expirables (fuel_card).';
comment on column public.fuel_cards.amprenta_numar is
  'HMAC-SHA256 al „card:<emitent>:<numărul întreg>”, calculat în aplicație cu HR_HASH_KEY. Rotirea cheii schimbă amprentele: cardurile rămân potrivite pe ultimele cifre.';

-- ============================================================
-- 3. Maparea coloanelor, per firmă și emitent
-- ============================================================
create table public.fuel_card_import_profiles (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  emitent           text not null,
  mapare            jsonb not null,           -- { "<câmp canonic>": "<antet din fișier>" }
  format_data       text not null default 'auto',
  separator_zecimal text not null default 'auto',
  delimitator       text not null default 'auto',
  codificare        text not null default 'auto',
  rand_antet        smallint not null default 1,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users (id) on delete set null,
  updated_at        timestamptz not null default now(),
  updated_by        uuid references auth.users (id) on delete set null,
  deleted_at        timestamptz,
  constraint fcip_emitent_ck check (emitent ~ '^[a-z][a-z0-9_]{1,30}$'),
  constraint fcip_mapare_ck check (jsonb_typeof(mapare) = 'object' and pg_column_size(mapare) <= 8192),
  constraint fcip_format_data_ck check (format_data in ('auto', 'zz.ll.aaaa', 'aaaa-ll-zz', 'zz/ll/aaaa', 'll/zz/aaaa')),
  constraint fcip_zecimal_ck check (separator_zecimal in ('auto', ',', '.')),
  constraint fcip_delim_ck check (delimitator in ('auto', ';', ',', 'tab')),
  constraint fcip_codificare_ck check (codificare in ('auto', 'utf-8', 'windows-1250')),
  constraint fcip_rand_antet_ck check (rand_antet between 1 and 30)
);

create unique index fcip_org_emitent_uq on public.fuel_card_import_profiles (organization_id, emitent)
  where deleted_at is null;

comment on table public.fuel_card_import_profiles is
  'Maparea coloanelor extrasului de card salvată per firmă și emitent (0214). Bate presetarea emitentului și sinonimele comune.';

-- ============================================================
-- 4. Loturile de import
-- ============================================================
create table public.fuel_card_imports (
  id               uuid primary key,          -- = batchId-ul din client: reluarea e idempotentă
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  emitent          text not null,
  fisier_nume      text not null,
  fisier_sha256    text not null,
  perioada_de_la   date not null,
  perioada_pana_la date not null,
  randuri_fisier   integer not null,
  importate        integer not null default 0,
  duplicate        integer not null default 0,
  respinse         integer not null default 0,
  finalizat_la     timestamptz,
  created_at       timestamptz not null default now(),
  created_by       uuid references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  deleted_at       timestamptz,
  constraint fci_emitent_ck check (emitent ~ '^[a-z][a-z0-9_]{1,30}$'),
  constraint fci_sha_ck check (fisier_sha256 ~ '^[0-9a-f]{64}$'),
  constraint fci_perioada_ck check (perioada_pana_la >= perioada_de_la
                                    and perioada_pana_la - perioada_de_la <= 93),
  constraint fci_contoare_ck check (randuri_fisier between 0 and 1000 and importate >= 0
                                    and duplicate >= 0 and respinse >= 0),
  constraint fci_nume_len check (char_length(fisier_nume) between 1 and 255)
);

create index fci_org_idx on public.fuel_card_imports (organization_id, created_at desc)
  where deleted_at is null;
-- NU unic: același fișier reimportat e permis (dedup-ul pe tranzacție îl face
-- inofensiv), dar ecranul avertizează „importat deja la …”.
create index fci_sha_idx on public.fuel_card_imports (organization_id, fisier_sha256)
  where deleted_at is null;

comment on table public.fuel_card_imports is
  'Un fișier de extras importat (0214): perioada, sha256-ul, contoarele. id = batchId-ul din client, ca reluarea aplicării să nu dubleze nimic.';

-- ============================================================
-- 5. Tranzacțiile din extrase
-- ============================================================
create table public.fuel_card_transactions (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references public.organizations (id) on delete cascade,
  import_id               uuid not null references public.fuel_card_imports (id) on delete restrict,
  emitent                 text not null,
  cheie_dedup             text not null,
  id_tranzactie_emitent   text,
  rand_fisier             integer not null,
  card_id                 uuid references public.fuel_cards (id) on delete restrict,
  card_ultimele_cifre     text,               -- ce a venit în extras, chiar dacă cardul e necunoscut
  efectuat_la             timestamptz not null,
  -- Ziua din ora României: `timezone(text, timestamptz)` e IMMUTABLE pe PG 17
  -- (verificat empiric, F12b §4), deci poate fi coloană generată.
  data_ro                 date generated always as ((efectuat_la at time zone 'Europe/Bucharest')::date) stored,
  -- Extrasul a dat și ora. Fără ea, potrivirea nu judecă diferența de ore față
  -- de alimentarea declarată (adăugată la implementare: `ora` nu e câmp obligatoriu).
  are_ora                 boolean not null default true,
  produs                  text not null,
  categorie               public.fuel_card_tx_categorie not null,
  tip_combustibil         public.fuel_type,
  cantitate               numeric(10,2),
  pret_unitar             numeric(12,4),
  valoare_bruta           numeric(14,2) not null,
  valoare_neta            numeric(14,2),
  tva                     numeric(14,2),
  moneda                  char(3) not null default 'RON',
  statie                  text,
  localitate              text,
  tara                    char(2),
  nr_inmatriculare_extras text,
  km_declarat             integer,
  numar_bon               text,
  vehicle_id              uuid references public.vehicles (id) on delete restrict,
  trip_sheet_id           uuid references public.trip_sheets (id) on delete set null,
  fuel_entry_id           uuid references public.fuel_entries (id) on delete set null,
  stare_potrivire         public.fuel_card_tx_potrivire not null,
  motiv                   text,
  nota                    text,
  created_at              timestamptz not null default now(),
  created_by              uuid references auth.users (id) on delete set null,
  updated_at              timestamptz not null default now(),
  updated_by              uuid references auth.users (id) on delete set null,
  deleted_at              timestamptz,
  constraint fctx_emitent_ck check (emitent ~ '^[a-z][a-z0-9_]{1,30}$'),
  constraint fctx_cheie_len check (char_length(cheie_dedup) between 4 and 200),
  constraint fctx_cifre_ck check (card_ultimele_cifre is null or card_ultimele_cifre ~ '^[0-9]{4,6}$'),
  constraint fctx_moneda_ck check (moneda ~ '^[A-Z]{3}$'),
  constraint fctx_tara_ck check (tara is null or tara ~ '^[A-Z]{2}$'),
  constraint fctx_cantitate_ck check (cantitate is null or cantitate between -5000 and 5000),
  constraint fctx_km_ck check (km_declarat is null or km_declarat >= 0),
  constraint fctx_text_len check (char_length(produs) between 1 and 120
    and (statie is null or char_length(statie) <= 200)
    and (localitate is null or char_length(localitate) <= 120)
    and (numar_bon is null or char_length(numar_bon) <= 60)
    and (nr_inmatriculare_extras is null or char_length(nr_inmatriculare_extras) <= 20)
    and (id_tranzactie_emitent is null or char_length(id_tranzactie_emitent) <= 100)
    and (motiv is null or char_length(motiv) <= 500)
    and (nota is null or char_length(nota) <= 1000)),
  constraint fctx_legatura_ck check (fuel_entry_id is null or trip_sheet_id is not null),
  constraint fctx_stare_ck check (
    (stare_potrivire in ('potrivita', 'diferenta')) = (fuel_entry_id is not null)
  )
);

create unique index fctx_dedup_uq on public.fuel_card_transactions (organization_id, emitent, cheie_dedup)
  where deleted_at is null;
create unique index fctx_alimentare_uq on public.fuel_card_transactions (fuel_entry_id)
  where fuel_entry_id is not null and deleted_at is null;
create index fctx_org_data_idx on public.fuel_card_transactions (organization_id, efectuat_la desc, id desc)
  where deleted_at is null;
create index fctx_stare_idx on public.fuel_card_transactions (organization_id, stare_potrivire, efectuat_la desc)
  where deleted_at is null;
create index fctx_card_idx on public.fuel_card_transactions (card_id, efectuat_la desc)
  where card_id is not null and deleted_at is null;
create index fctx_vehicul_zi_idx on public.fuel_card_transactions (vehicle_id, data_ro)
  where vehicle_id is not null and deleted_at is null;
create index fctx_foaie_idx on public.fuel_card_transactions (trip_sheet_id)
  where trip_sheet_id is not null and deleted_at is null;
create index fctx_import_idx on public.fuel_card_transactions (import_id)
  where deleted_at is null;

comment on table public.fuel_card_transactions is
  'Registrul extraselor de card (0214): ce a facturat cardul, potrivit pe vehicul, pe foaia zilei și pe alimentarea declarată. Nu scrie în fuel_entries. Datele din extras sunt imuabile după import.';

-- ============================================================
-- 6. Triggerele cardului
-- ============================================================
-- Integritate, nu drepturi (drepturile le judecă politicile). SECURITY DEFINER,
-- ca verificările pe vehicul și pe angajat să nu depindă de ce vede apelantul.

create or replace function internal.carduri_inainte()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id
       or new.emitent is distinct from old.emitent then
      raise exception using errcode = 'P0001',
        message = 'Emitentul și firma unui card nu se pot schimba. Anulați cardul și înregistrați-l din nou.';
    end if;
    -- Alt număr = alt card fizic; altfel istoricul de tranzacții ar minți.
    if new.ultimele_cifre is distinct from old.ultimele_cifre
       or new.amprenta_numar is distinct from old.amprenta_numar then
      raise exception using errcode = 'P0001',
        message = 'Numărul unui card nu se schimbă. Anulați cardul și înregistrați-l pe cel nou.';
    end if;
    new.updated_at := now();
  end if;

  new.denumire := nullif(btrim(coalesce(new.denumire, '')), '');
  new.observatii := nullif(btrim(coalesce(new.observatii, '')), '');

  if new.vehicle_id is not null
     and (tg_op = 'INSERT' or new.vehicle_id is distinct from old.vehicle_id) then
    if not exists (
      select 1 from public.vehicles v
       where v.id = new.vehicle_id
         and v.organization_id = new.organization_id
         and v.deleted_at is null
         and v.status not in ('vandut', 'casat')
    ) then
      raise exception using errcode = 'P0001',
        message = 'Vehiculul ales pentru card nu aparține organizației dumneavoastră sau nu mai e în parc.';
    end if;
  end if;

  if new.employee_id is not null
     and (tg_op = 'INSERT' or new.employee_id is distinct from old.employee_id) then
    if not exists (
      select 1 from public.employees e
       where e.id = new.employee_id
         and e.organization_id = new.organization_id
         and e.deleted_at is null
    ) then
      raise exception using errcode = 'P0001',
        message = 'Șoferul ales pentru card nu aparține organizației dumneavoastră.';
    end if;
  end if;

  return new;
end;
$$;

-- Eticheta din `expirables` și din rezumatul zilnic: emitentul cu numele lui,
-- ultimele cifre și, pe un card de vehicul, numărul de înmatriculare.
create or replace function internal.card_eticheta(p_emitent text, p_cifre text, p_nr text)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(
    'Card ' || case p_emitent
                 when 'omv_petrom' then 'OMV Petrom'
                 when 'mol'        then 'MOL'
                 when 'lukoil'     then 'Lukoil'
                 when 'rompetrol'  then 'Rompetrol'
                 when 'dkv'        then 'DKV'
                 when 'shell'      then 'Shell'
                 when 'eurowag'    then 'Eurowag'
                 when 'altul'      then 'de combustibil'
                 else p_emitent
               end
    || ' •••• ' || p_cifre
    || case when p_nr is null then '' else ' — ' || p_nr end,
    200);
$$;

-- Proiecția în `expirables`, într-un SINGUR loc: o cheamă și triggerul cardului,
-- și cel de pe `vehicles`. Altfel cele două drumuri ar calcula „activ” diferit.
-- `null` pe `p_expires_at` șterge logic rândul și închide alertele (0008), exact
-- ce trebuie la anulare, la ștergere sau la ieșirea vehiculului din parc.
create or replace function internal.carduri_proiecteaza(p_card_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.fuel_cards%rowtype;
  v public.vehicles%rowtype;
  v_activ boolean;
begin
  select * into c from public.fuel_cards where id = p_card_id;
  if not found then
    return;
  end if;
  if c.vehicle_id is not null then
    select * into v from public.vehicles where id = c.vehicle_id;
  end if;
  v_activ := c.deleted_at is null
             and c.status = 'activ'
             and (c.vehicle_id is null
                  or (v.id is not null and v.deleted_at is null and v.status not in ('vandut', 'casat')));
  perform internal.sync_expirable(
    c.organization_id,
    'fuel_card',
    c.id,
    'valabilitate',
    internal.card_eticheta(c.emitent, c.ultimele_cifre, v.nr_inmatriculare),
    case when v_activ then c.valabil_pana else null end,
    'fuel_cards',
    coalesce(c.employee_id, v.employee_id),
    v_activ
  );
end;
$$;

create or replace function internal.carduri_dupa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform internal.carduri_proiecteaza(new.id);
  return null;
end;
$$;

-- Trigger NOU pe `vehicles`, separat: `internal.vehicles_dupa` nu se rescrie (îl
-- ating F2/F3, iar F12d și F12h își pun și ele triggerele lor pe `vehicles`).
-- Responsabilul urmează șoferul alocat; vehiculul vândut, casat sau șters scoate
-- scadența cardului din semafor; numărul nou intră în etichetă.
create or replace function internal.carduri_resincronizeaza_vehicul()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card uuid;
begin
  if new.employee_id is not distinct from old.employee_id
     and new.deleted_at is not distinct from old.deleted_at
     and new.status is not distinct from old.status
     and new.nr_inmatriculare is not distinct from old.nr_inmatriculare then
    return null;
  end if;
  for v_card in
    select fc.id from public.fuel_cards fc
     where fc.vehicle_id = new.id and fc.organization_id = new.organization_id
  loop
    perform internal.carduri_proiecteaza(v_card);
  end loop;
  return null;
end;
$$;

create trigger carduri_inainte
  before insert or update on public.fuel_cards
  for each row execute function internal.carduri_inainte();

create trigger carduri_dupa
  after insert or update on public.fuel_cards
  for each row execute function internal.carduri_dupa();

create trigger vehicles_carduri_resincronizeaza
  after update of employee_id, deleted_at, status, nr_inmatriculare on public.vehicles
  for each row execute function internal.carduri_resincronizeaza_vehicul();

-- ============================================================
-- 7. Triggerele profilului și ale lotului
-- ============================================================
create or replace function internal.carduri_profil_inainte()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if (new.organization_id, new.emitent) is distinct from (old.organization_id, old.emitent) then
      raise exception using errcode = 'P0001',
        message = 'Maparea unui emitent nu se mută la alt emitent sau în altă organizație.';
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create or replace function internal.carduri_lot_inainte()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    -- Doar contoarele, finalizarea și ștergerea logică se mișcă după creare.
    if (new.organization_id, new.emitent, new.fisier_nume, new.fisier_sha256,
        new.perioada_de_la, new.perioada_pana_la, new.randuri_fisier)
       is distinct from
       (old.organization_id, old.emitent, old.fisier_nume, old.fisier_sha256,
        old.perioada_de_la, old.perioada_pana_la, old.randuri_fisier) then
      raise exception using errcode = 'P0001',
        message = 'Fișierul, perioada și emitentul unui import nu se modifică. Anulați importul și reimportați fișierul.';
    end if;
    new.updated_at := now();
  end if;
  new.fisier_nume := btrim(new.fisier_nume);
  return new;
end;
$$;

create trigger carduri_profil_inainte
  before insert or update on public.fuel_card_import_profiles
  for each row execute function internal.carduri_profil_inainte();

create trigger carduri_lot_inainte
  before insert or update on public.fuel_card_imports
  for each row execute function internal.carduri_lot_inainte();

-- ============================================================
-- 8. Triggerul tranzacției
-- ============================================================
create or replace function internal.tranzactii_card_inainte()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org     uuid := new.organization_id;
  v_emitent text;
  v_foaie   uuid;
  v_vehicul uuid;
  v_strain  constant text := 'Tranzacția face trimitere la o înregistrare din altă organizație.';
begin
  -- 3. Imutabilitatea extrasului: se schimbă doar potrivirea, nota, categoria
  --    și ștergerea logică. Un extras greșit se anulează și se reimportă.
  if tg_op = 'UPDATE' then
    if (new.organization_id, new.import_id, new.emitent, new.cheie_dedup, new.id_tranzactie_emitent,
        new.rand_fisier, new.card_ultimele_cifre, new.efectuat_la, new.are_ora, new.produs,
        new.tip_combustibil, new.cantitate, new.pret_unitar, new.valoare_bruta, new.valoare_neta,
        new.tva, new.moneda, new.statie, new.localitate, new.tara, new.nr_inmatriculare_extras,
        new.km_declarat, new.numar_bon)
       is distinct from
       (old.organization_id, old.import_id, old.emitent, old.cheie_dedup, old.id_tranzactie_emitent,
        old.rand_fisier, old.card_ultimele_cifre, old.efectuat_la, old.are_ora, old.produs,
        old.tip_combustibil, old.cantitate, old.pret_unitar, old.valoare_bruta, old.valoare_neta,
        old.tva, old.moneda, old.statie, old.localitate, old.tara, old.nr_inmatriculare_extras,
        old.km_declarat, old.numar_bon) then
      raise exception using errcode = 'P0001',
        message = 'Datele din extras nu se modifică. Anulați importul și reimportați fișierul corectat.';
    end if;
    new.updated_at := now();
  end if;

  -- 1. Garda de firmă, pe fiecare trimitere nouă sau schimbată.
  if tg_op = 'INSERT' or new.import_id is distinct from old.import_id then
    if not exists (select 1 from public.fuel_card_imports i
                    where i.id = new.import_id and i.organization_id = v_org) then
      raise exception using errcode = 'P0001', message = v_strain;
    end if;
  end if;

  if new.card_id is not null and (tg_op = 'INSERT' or new.card_id is distinct from old.card_id) then
    select c.emitent into v_emitent from public.fuel_cards c
     where c.id = new.card_id and c.organization_id = v_org and c.deleted_at is null;
    if not found then
      raise exception using errcode = 'P0001', message = v_strain;
    end if;
    if v_emitent is distinct from new.emitent then
      raise exception using errcode = 'P0001',
        message = 'Cardul ales e al altui emitent decât extrasul.';
    end if;
  end if;

  -- 2. Coerența: alimentarea dă foaia, foaia dă vehiculul. Nu se crede clientul.
  if new.fuel_entry_id is not null
     and (tg_op = 'INSERT' or new.fuel_entry_id is distinct from old.fuel_entry_id) then
    select f.trip_sheet_id into v_foaie from public.fuel_entries f
     where f.id = new.fuel_entry_id and f.organization_id = v_org and f.deleted_at is null;
    if not found then
      raise exception using errcode = 'P0001',
        message = 'Alimentarea aleasă nu mai există pe foaie sau e din altă organizație.';
    end if;
    new.trip_sheet_id := v_foaie;
  end if;

  if new.trip_sheet_id is not null
     and (tg_op = 'INSERT' or new.trip_sheet_id is distinct from old.trip_sheet_id
          or new.vehicle_id is distinct from old.vehicle_id) then
    select t.vehicle_id into v_vehicul from public.trip_sheets t
     where t.id = new.trip_sheet_id and t.organization_id = v_org;
    if not found then
      raise exception using errcode = 'P0001', message = v_strain;
    end if;
    new.vehicle_id := v_vehicul;
  end if;

  if new.vehicle_id is not null and (tg_op = 'INSERT' or new.vehicle_id is distinct from old.vehicle_id) then
    if not exists (select 1 from public.vehicles v
                    where v.id = new.vehicle_id and v.organization_id = v_org) then
      raise exception using errcode = 'P0001', message = v_strain;
    end if;
  end if;

  new.motiv := nullif(btrim(coalesce(new.motiv, '')), '');
  new.nota := nullif(btrim(coalesce(new.nota, '')), '');

  -- 4. Ignorarea are un motiv: o notă a omului sau stornoul din extras.
  if new.stare_potrivire = 'ignorata' and new.nota is null and new.categorie <> 'corectie' then
    raise exception using errcode = 'P0001',
      message = 'Spuneți de ce ignorați tranzacția.';
  end if;

  return new;
end;
$$;

create trigger tranzactii_card_inainte
  before insert or update on public.fuel_card_transactions
  for each row execute function internal.tranzactii_card_inainte();

-- ============================================================
-- 9. Scadența cardului în lista de conformitate
-- ============================================================
-- Rescrisă INTEGRAL de la forma ultimă (0206), cu o singură ramură nouă:
-- `fuel_card`, același drept ca documentele vehiculului. Implicitul rămâne
-- `else false`: o ramură pierdută ar face invizibile, tăcut, scadențele acelui tip.
create or replace function app.poate_vedea_expirabil(p_organization_id uuid, p_entity_type text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case p_entity_type
    when 'medical_exam'             then app.feature_on(p_organization_id,'ssm')        and app.can(p_organization_id,'ssm','read','team')
    when 'employee_document'        then app.can(p_organization_id,'employees','read','team')
    when 'work_permit'              then app.can(p_organization_id,'employees','read','team')
    when 'employment_contract'      then app.can(p_organization_id,'employees','read','team')
    when 'vehicle_document'         then app.feature_on(p_organization_id,'fleet')       and app.can(p_organization_id,'vehicles','read','team')
    -- Din 0203 (F7): scadențele planurilor de service, același drept ca documentele.
    when 'vehicle_service'          then app.feature_on(p_organization_id,'fleet')       and app.can(p_organization_id,'vehicles','read','team')
    -- 0214 (F12b): valabilitatea cardurilor de combustibil, același drept ca documentele.
    when 'fuel_card'                then app.feature_on(p_organization_id,'fleet')       and app.can(p_organization_id,'vehicles','read','team')
    when 'equipment'              then app.feature_on(p_organization_id,'maintenance') and app.can(p_organization_id,'maintenance','read','team')
    when 'fire_extinguisher'        then app.feature_on(p_organization_id,'ssm')         and app.can(p_organization_id,'ssm','read','team')
    when 'ssm_training'             then app.feature_on(p_organization_id,'ssm')         and app.can(p_organization_id,'ssm','read','team')
    when 'environmental_permit'     then app.feature_on(p_organization_id,'ssm')         and app.can(p_organization_id,'compliance','read','team')
    when 'inventory_item'           then app.feature_on(p_organization_id,'inventory')   and app.can(p_organization_id,'inventory','read','team')
    when 'iscir_authorization'      then app.feature_on(p_organization_id,'maintenance') and app.can(p_organization_id,'maintenance','read','team')
    when 'maintenance_plan'         then app.feature_on(p_organization_id,'maintenance') and app.can(p_organization_id,'maintenance','read','team')
    when 'personnel_authorization'  then app.feature_on(p_organization_id,'ssm')         and app.can(p_organization_id,'ssm','read','team')
    when 'ppe_issuance'             then app.feature_on(p_organization_id,'ssm')         and app.can(p_organization_id,'ssm','read','team')
    -- 0204: permisele șoferilor, cu cheia lor (hr le are, parcul nu).
    when 'driver_license'           then app.feature_on(p_organization_id,'fleet')       and app.can(p_organization_id,'driver_licenses','read','team')
    -- 0206: termenul de răspuns la o amendă. Cheie proprie: amenzile le văd
    -- doar cei care le administrează, nu oricine vede parcul.
    when 'vehicle_fine'             then app.feature_on(p_organization_id,'fleet')       and app.has_permission(p_organization_id,'vehicle_fines','read') = 'all'
    else false
  end
$$;

-- ============================================================
-- 10. Pragurile și rezumatul zilnic al flotei
-- ============================================================
-- Forma 0203, cu o singură schimbare: oglinda în `alert_rules` se scrie și
-- pentru cardurile de combustibil, ca pragurile din `/flota/setari` să valoreze
-- pentru tot ce trimite rezumatul flotei.
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

  -- 0203: aceleași praguri pentru scadențele de service pe dată
  -- (`vehicle_service`); 0214: și pentru valabilitatea cardurilor (`fuel_card`).
  insert into public.alert_rules as r
    (organization_id, entity_type, kind, praguri_zile, alerteaza_la_depasire, valabil_de_la)
  select new.organization_id, t.entity_type, '*', new.praguri_alerta_zile, true, app.azi_local()
    from unnest(array['vehicle_document', 'vehicle_service', 'fuel_card']) as t(entity_type)
  on conflict (organization_id, entity_type, kind, valabil_de_la) where deleted_at is null
  do update set praguri_zile = excluded.praguri_zile;
  return null;
end;
$$;

-- Firmele care și-au schimbat deja pragurile primesc și regula pentru carduri
-- (tiparul din 0203 pentru service). Fără rând de setări, sau cu implicitele,
-- motorul aplică oricum 30/14/7.
insert into public.alert_rules (organization_id, entity_type, kind, praguri_zile, alerteaza_la_depasire, valabil_de_la)
select s.organization_id, 'fuel_card', '*', s.praguri_alerta_zile, true, app.azi_local()
  from public.fleet_settings s
 where s.deleted_at is null
   and s.praguri_alerta_zile is distinct from internal.praguri_implicite()
on conflict (organization_id, entity_type, kind, valabil_de_la) where deleted_at is null
do nothing;

-- Forma 0206 §G (amenzile: `vehicle_fine` doar la cine citește amenzile la
-- `all`, legătura `/flota/amenzi…`), cu: `fuel_card` în lista albă; cardul se leagă de vehicul prin
-- `fuel_cards.vehicle_id` (nu prin `entity_id`, care e cardul) și poate fi pe un
-- șofer fără vehicul, deci vehiculul devine LEFT JOIN, cerut în continuare pentru
-- documente și service; două numărători noi în titlu; legătura spre
-- `/flota/carduri?card=<id>` când toate elementele omului sunt carduri. Fără
-- carduri, textul și legătura sunt EXACT cele de până acum.
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
           -- Cardul pe șofer are titularul lui; altfel, șoferul vehiculului.
           coalesce(c.employee_id, v.employee_id) as sofer_id,
           coalesce(v.pool, false) as pool,
           (a.status = 'expirat') as depasita,
           (x.entity_type = 'vehicle_service') as e_service,
           (x.entity_type = 'fuel_card') as e_card,
           (x.entity_type = 'vehicle_fine')    as e_amenda,
           c.id            as card_id,
           f.id            as amenda_id,
           x.expires_at,
           x.label || ': ' ||
             case when a.status = 'expirat'
                  then case x.entity_type
                         when 'vehicle_service' then 'scadent din '
                         when 'vehicle_fine'    then 'termenul de răspuns a trecut pe '
                         else 'expirat din ' end
                       || to_char(x.expires_at, 'DD.MM.YYYY')
                  else case x.entity_type
                         when 'vehicle_service' then 'scadent pe '
                         when 'vehicle_fine'    then 'termen de răspuns pe '
                         else 'expiră pe ' end
                       || to_char(x.expires_at, 'DD.MM.YYYY') end as eticheta
      from public.compliance_alerts a
      join public.expirables x on x.id = a.expirable_id
      left join public.fuel_cards c
        on x.entity_type = 'fuel_card'
       and c.id = x.entity_id
       and c.organization_id = p_org
       and c.deleted_at is null
      left join public.vehicle_fines f
        on x.entity_type = 'vehicle_fine'
       and f.id = x.entity_id
       and f.organization_id = p_org
       and f.deleted_at is null
      left join public.vehicles v
        on v.id = case x.entity_type
                    when 'fuel_card'    then c.vehicle_id
                    when 'vehicle_fine' then f.vehicle_id
                    else x.entity_id end
       and v.organization_id = p_org
       and v.deleted_at is null
     where a.organization_id = p_org
       and a.deleted_at is null
       and a.status in ('nou', 'expirat')
       and x.organization_id = p_org
       and x.deleted_at is null
       and x.is_active
       -- LISTA ALBĂ a flotei (0203: și scadențele de service pe dată; 0206: și
       -- termenul de răspuns al amenzii; 0214: și valabilitatea cardurilor). SSM
       -- și HR se adaugă aici, cu legătura lor.
       and x.entity_type in ('vehicle_document', 'vehicle_service', 'vehicle_fine', 'fuel_card')
       -- Documentele, service-ul și amenda sunt ale unui vehicul din parc; cardul
       -- poate fi pe un șofer sau de rezervă, dar cardul însuși trebuie să existe.
       and case when x.entity_type = 'fuel_card' then c.id is not null else v.id is not null end
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
     where not e.e_amenda
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
     where not e.e_amenda
       and not exists (select 1 from vizibile z where z.expirable_id = e.expirable_id)
       and internal.flota_vede_vehicul(p_org, m.user_id, e.sofer_id, e.pool)
  ),
  -- 0206: amenda merge DOAR la cine citește amenzile la `all`.
  amenzi as (
    select e.*, d.user_id
      from elemente e
      cross join internal.flota_destinatari_cheie(p_org, 'vehicle_fines') d
     where e.e_amenda
  ),
  destinatari as (
    select * from vizibile
    union
    select * from orfane
    union
    select * from amenzi
    union
    -- Șoferul alocat: documentele și service-ul mașinii lui, NU amenzile.
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
     where not e.e_amenda
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
     -- Destinatarii amenzii au trecut deja de cheia lor (`vehicle_fines` = all).
     where (d.e_amenda or s.scope <> 'none')
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
           n.user_id, n.expirable_id, n.vehicle_id, n.card_id, n.depasita, n.e_service, n.e_card,
           n.e_amenda, n.amenda_id, n.expires_at, n.eticheta, n.scope
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
           count(*) filter (where n.depasita and not n.e_service and not n.e_card and not n.e_amenda)::integer     as depasite,
           count(*) filter (where not n.depasita and not n.e_service and not n.e_card and not n.e_amenda)::integer as apropiate,
           count(*) filter (where n.depasita and n.e_service)::integer         as srv_depasite,
           count(*) filter (where not n.depasita and n.e_service)::integer     as srv_apropiate,
           count(*) filter (where n.e_service)::integer                        as srv_total,
           count(*) filter (where n.depasita and n.e_card)::integer            as card_depasite,
           count(*) filter (where not n.depasita and n.e_card)::integer        as card_apropiate,
           count(*) filter (where n.e_card)::integer                           as card_total,
           count(*) filter (where n.depasita and n.e_amenda)::integer          as am_depasite,
           count(*) filter (where not n.depasita and n.e_amenda)::integer      as am_apropiate,
           count(*) filter (where n.e_amenda)::integer                         as am_total,
           count(distinct n.vehicle_id)::integer               as vehicule,
           count(distinct n.card_id)::integer                  as carduri,
           -- Filtrul „expiră” al listei e despre documente: data lor, fără amenzi.
           max(n.expires_at) filter (where not n.e_amenda)     as ultima_scadenta,
           (array_agg(n.vehicle_id order by n.rn) filter (where n.vehicle_id is not null))[1] as primul_vehicul,
           (array_agg(n.card_id order by n.rn) filter (where n.card_id is not null))[1]       as primul_card,
           (array_agg(n.amenda_id order by n.rn) filter (where n.e_amenda))[1] as prima_amenda,
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
             case when o.srv_apropiate > 0 then internal.flota_numarat(o.srv_apropiate, 'lucrare de service în curând', 'lucrări de service în curând') end,
             case when o.card_depasite > 0 then internal.flota_numarat(o.card_depasite, 'card de combustibil expirat', 'carduri de combustibil expirate') end,
             case when o.card_apropiate > 0 then internal.flota_numarat(o.card_apropiate, 'card de combustibil care expiră curând', 'carduri de combustibil care expiră curând') end,
             case when o.am_depasite > 0 then internal.flota_numarat(o.am_depasite, 'amendă cu termenul de răspuns trecut', 'amenzi cu termenul de răspuns trecut') end,
             case when o.am_apropiate > 0 then internal.flota_numarat(o.am_apropiate, 'amendă de răspuns în curând', 'amenzi de răspuns în curând') end
           ], null), ', ') || '.', 200),
           left(o.linii || case when o.total > 8
                                then E'\n… și încă ' || case when o.am_total = 0
                                                             then internal.flota_numarat(o.total - 8, 'document', 'documente')
                                                             else internal.flota_numarat(o.total - 8, 'termen', 'termene') end || '.'
                                else '' end, 4000),
           case
             -- 0206: doar amenzi — la amendă, sau la lista celor de răspuns.
             when o.am_total = o.total and o.total = 1 then '/flota/amenzi/' || o.prima_amenda::text
             when o.am_total = o.total then '/flota/amenzi?stadiu=de_raspuns'
             when o.scope not in ('team', 'all') then '/portal/masina-mea'
             -- Doar scadențe de service: fișa se deschide pe fila ei.
             when o.card_total = 0 and o.vehicule = 1 and o.srv_total = o.total then '/flota/' || o.primul_vehicul::text || '?fila=service'
             when o.card_total = 0 and o.vehicule = 1 then '/flota/' || o.primul_vehicul::text
             -- 0214: doar carduri. Unul singur se deschide în lista cardurilor, pe rândul lui.
             when o.card_total = o.total and o.carduri = 1 then '/flota/carduri?card=' || o.primul_card::text
             when o.card_total = o.total then '/flota/carduri'
             -- Filtrul „expiră” al listei arată 30 de zile
             -- (`PRAG_FLOTA_AVERTIZARE_ZILE`, src/domain/fleet/scadente.ts; îl
             -- fixează setari.test.ts). Cu un prag al firmei mai lung (60),
             -- vehiculele de peste 30 de zile ar lipsi din el: lista întreagă.
             -- Filtrul „expiră” al listei e despre documente: fără ele, lista întreagă.
             when o.card_total = 0 and o.total - o.srv_total - o.am_total > 0 and o.ultima_scadenta <= v_azi + 30 then '/flota?conformitate=expira'
             else '/flota'
           end,
           case when o.am_total = o.total and o.total = 1 then 'vehicle_fine'
                when o.card_total = 0 and o.vehicule = 1 then 'vehicle'
                when o.card_total = o.total and o.carduri = 1 then 'fuel_card'
                else 'fleet_rezumat' end,
           case when o.am_total = o.total and o.total = 1 then o.prima_amenda
                when o.card_total = 0 and o.vehicule = 1 then o.primul_vehicul
                when o.card_total = o.total and o.carduri = 1 then o.primul_card end
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
  'Rezumatul zilnic al scadențelor de flotă pe dată (vehicle_document, din 0203 vehicle_service, din 0206 vehicle_fine doar pentru vehicle_fines:read = all, din 0214 fuel_card) pentru o firmă: o notificare per destinatar, doar cu elementele netrimise lui. Idempotentă: a doua rulare din aceeași zi nu scrie nimic.';

-- ============================================================
-- 11. RLS
-- ============================================================
-- Fără `deleted_at` în USING-ul de SELECT (0016/0018): ștergerea logică cu
-- RETURNING ar cădea pe propria politică. Nicio politică DELETE.
alter table public.fuel_cards enable row level security;
alter table public.fuel_cards force row level security;
alter table public.fuel_card_import_profiles enable row level security;
alter table public.fuel_card_import_profiles force row level security;
alter table public.fuel_card_imports enable row level security;
alter table public.fuel_card_imports force row level security;
alter table public.fuel_card_transactions enable row level security;
alter table public.fuel_card_transactions force row level security;

-- Cardul: vizibilitatea urmează vehiculul, sau șoferul titular. Subinterogarea
-- pe `vehicles` rulează SUB RLS-ul lui `vehicule_select`, deci preia singură
-- orice rescriere a vizibilității vehiculului (pool, team, own) fără s-o copieze.
-- Cardul vehiculului pool îl vede deci oricine vede pool-ul: ultimele cifre și
-- emitentul (implicita I-b7); tranzacțiile rămân închise.
create policy carduri_select on public.fuel_cards
for select to authenticated
using (
  (select app.is_platform_admin()) or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and (
      app.has_permission(organization_id, 'vehicles', 'read') = 'all'
      or (employee_id is not null and app.poate_vedea_vehicul(organization_id, employee_id, false))
      -- Cardul vehiculului urmează vehiculul prin funcția îngustă din 0199 (ca
      -- documentele), NU printr-o subinterogare pe `vehicles` filtrată de RLS:
      -- aceea ar moșteni ramura „mașina alocată LUI” pe care 0215 (F12c,
      -- decizia 3) o pune în `vehicule_select` pentru omul fără `vehicles:read`,
      -- iar hr-ul care conduce ar vedea cardul mașinii (proba carduri, 9c).
      or (vehicle_id is not null
          and app.poate_vedea_vehicul_dupa_id(organization_id, vehicle_id))
    )
  )
);

create policy carduri_insert on public.fuel_cards
for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.has_permission(organization_id, 'vehicles', 'create') = 'all'
  and deleted_at is null
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy carduri_update on public.fuel_cards
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

create policy carduri_profil_select on public.fuel_card_import_profiles
for select to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
);

create policy carduri_profil_insert on public.fuel_card_import_profiles
for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
  and deleted_at is null
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy carduri_profil_update on public.fuel_card_import_profiles
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

create policy carduri_import_select on public.fuel_card_imports
for select to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
);

create policy carduri_import_insert on public.fuel_card_imports
for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
  and deleted_at is null
  and finalizat_la is null
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy carduri_import_update on public.fuel_card_imports
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

-- Tranzacțiile: DOAR `vehicles:read = all` (implicita I-b3). Leagă un șofer
-- identificat de un loc și o oră: date personale, deci minimizare.
create policy tranzactii_card_select on public.fuel_card_transactions
for select to authenticated
using (
  (select app.is_platform_admin()) or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.has_permission(organization_id, 'vehicles', 'read') = 'all'
  )
);

create policy tranzactii_card_insert on public.fuel_card_transactions
for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
  and deleted_at is null
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy tranzactii_card_update on public.fuel_card_transactions
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
-- 11b. Repotrivirea unei luni, într-o singură tranzacție (X2)
-- ============================================================
-- `repotrivesteTranzactii` calculează potrivirea în aplicație și o scria rând
-- cu rând, câte o cerere HTTP pe UPDATE. O cădere la mijloc (rețea, un rând
-- anulat între timp, un 23505) lăsa luna pe jumătate: unele rânduri în forma
-- nouă, altele în cea veche, iar rândurile „eliberate” rămâneau „fără
-- alimentare” până la repotrivirea următoare — adică raportul spunea, între
-- timp, alimentări nedeclarate care nu existau. Acum lista de scrieri pleacă
-- într-un singur apel și se aplică ATOMIC: un singur rând refuzat oprește tot.
--
-- Ordinea rămâne a aplicației (întâi eliberările, apoi formele finale), fiindcă
-- `fctx_alimentare_uq` e judecat la fiecare UPDATE, nu la sfârșitul tranzacției.
-- INVOKER: `tranzactii_card_update` și `internal.tranzactii_card_inainte`
-- judecă fiecare rând exact ca la scrierea directă (firma, `vehicles:update =
-- all`, imutabilitatea datelor din extras). Se scriu DOAR coloanele potrivirii.
-- În `public`, fiindcă `.rpc()` nu ajunge la `app` (PostgREST expune `public`).
create or replace function public.repotriveste_tranzactii_card(
  p_organization_id uuid,
  p_scrieri jsonb
)
returns integer
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_s     jsonb;
  v_n     integer;
  v_total integer := 0;
begin
  if p_scrieri is null or pg_catalog.jsonb_typeof(p_scrieri) <> 'array' then
    raise exception using errcode = 'P0001',
      message = 'Lista de scrieri a repotrivirii lipsește.';
  end if;
  if pg_catalog.jsonb_array_length(p_scrieri) > 10000 then
    raise exception using errcode = 'P0001',
      message = 'Repotrivirea are prea multe scrieri într-un singur pas. Repotriviți o lună mai scurtă.';
  end if;

  for v_s in select e from pg_catalog.jsonb_array_elements(p_scrieri) e loop
    update public.fuel_card_transactions t
       set card_id         = case when v_s ? 'card_id' then (v_s ->> 'card_id')::uuid else t.card_id end,
           vehicle_id      = case when v_s ? 'vehicle_id' then (v_s ->> 'vehicle_id')::uuid else t.vehicle_id end,
           trip_sheet_id   = case when v_s ? 'trip_sheet_id' then (v_s ->> 'trip_sheet_id')::uuid else t.trip_sheet_id end,
           fuel_entry_id   = case when v_s ? 'fuel_entry_id' then (v_s ->> 'fuel_entry_id')::uuid else t.fuel_entry_id end,
           stare_potrivire = case when v_s ? 'stare_potrivire'
                                  then (v_s ->> 'stare_potrivire')::public.fuel_card_tx_potrivire
                                  else t.stare_potrivire end,
           categorie       = case when v_s ? 'categorie'
                                  then (v_s ->> 'categorie')::public.fuel_card_tx_categorie
                                  else t.categorie end,
           motiv           = case when v_s ? 'motiv' then v_s ->> 'motiv' else t.motiv end,
           updated_by      = (select auth.uid())
     where t.id = (v_s ->> 'id')::uuid
       and t.organization_id = p_organization_id
       and t.deleted_at is null;
    get diagnostics v_n = row_count;
    -- Zero rânduri (anulat cu importul, altă firmă, fără drept: USING) = tot
    -- apelul se derulează înapoi. Același text ca CONFLICT-ul acțiunii.
    if v_n = 0 then
      raise exception using errcode = 'P0001',
        message = 'Tranzacția s-a schimbat între timp sau a fost anulată odată cu importul. Reîncărcați pagina.';
    end if;
    v_total := v_total + v_n;
  end loop;
  return v_total;
end;
$$;

comment on function public.repotriveste_tranzactii_card(uuid, jsonb) is
  'Aplică ATOMIC lista de scrieri a repotrivirii unei luni (X2): ordinea dată, doar coloanele potrivirii, '
  'sub RLS-ul apelantului; un rând refuzat derulează înapoi tot apelul.';

revoke all on function public.repotriveste_tranzactii_card(uuid, jsonb) from public, anon;
grant execute on function public.repotriveste_tranzactii_card(uuid, jsonb) to authenticated;

-- ============================================================
-- 12. Actor, audit, drepturi
-- ============================================================
-- `set_actor` completează `created_by`/`updated_by` din sesiune când lipsesc;
-- politicile le cer oricum NOMINAL (capcana 23), iar acțiunile le trimit.
do $$
declare t text;
begin
  foreach t in array array['fuel_cards', 'fuel_card_import_profiles', 'fuel_card_imports',
                           'fuel_card_transactions'] loop
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

revoke all on function internal.carduri_inainte() from public, anon, authenticated;
revoke all on function internal.carduri_dupa() from public, anon, authenticated;
revoke all on function internal.carduri_proiecteaza(uuid) from public, anon, authenticated;
revoke all on function internal.carduri_resincronizeaza_vehicul() from public, anon, authenticated;
revoke all on function internal.carduri_profil_inainte() from public, anon, authenticated;
revoke all on function internal.carduri_lot_inainte() from public, anon, authenticated;
revoke all on function internal.tranzactii_card_inainte() from public, anon, authenticated;
revoke all on function internal.card_eticheta(text, text, text) from public, anon, authenticated;
revoke all on function internal.flota_setari_praguri() from public, anon, authenticated;
revoke all on function internal.flota_rezumat(uuid) from public, anon, authenticated;
revoke all on function app.poate_vedea_expirabil(uuid, text) from public, anon;
grant execute on function app.poate_vedea_expirabil(uuid, text) to authenticated;

-- ============================================================
-- 13. Verificare
-- ============================================================
do $$
declare
  v_lipsa text[] := '{}';
  v_t text;
  v_def text;
begin
  foreach v_t in array array['fuel_cards', 'fuel_card_import_profiles', 'fuel_card_imports',
                             'fuel_card_transactions'] loop
    if to_regclass('public.' || v_t) is null then
      v_lipsa := v_lipsa || v_t;
      continue;
    end if;
    if (select count(*) from pg_policies where schemaname = 'public' and tablename = v_t) <> 3 then
      v_lipsa := v_lipsa || ('trio-ul de politici pe ' || v_t);
    end if;
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = v_t
                and cmd = 'DELETE') then
      v_lipsa := v_lipsa || ('politică DELETE pe ' || v_t || ' (interzisă)');
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = v_t
                    and cmd = 'UPDATE' and qual is not null and with_check is not null) then
      v_lipsa := v_lipsa || ('USING + WITH CHECK pe update-ul lui ' || v_t);
    end if;
    if not (select relforcerowsecurity from pg_class where oid = ('public.' || v_t)::regclass) then
      v_lipsa := v_lipsa || ('FORCE RLS pe ' || v_t);
    end if;
    if has_table_privilege('authenticated', 'public.' || v_t, 'DELETE') then
      v_lipsa := v_lipsa || ('DELETE acordat pe ' || v_t);
    end if;
    if not exists (select 1 from pg_trigger where tgname = 'audit_' || v_t
                    and tgrelid = ('public.' || v_t)::regclass) then
      v_lipsa := v_lipsa || ('auditul pe ' || v_t);
    end if;
  end loop;

  foreach v_t in array array['fcard_amprenta_uq', 'fcard_cifre_idx', 'fcard_vehicul_idx', 'fcard_sofer_idx',
                             'fcard_valabil_idx', 'fcip_org_emitent_uq', 'fci_org_idx', 'fci_sha_idx',
                             'fctx_dedup_uq', 'fctx_alimentare_uq', 'fctx_org_data_idx', 'fctx_stare_idx',
                             'fctx_card_idx', 'fctx_vehicul_zi_idx', 'fctx_foaie_idx', 'fctx_import_idx'] loop
    if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = v_t
                    and indexdef ilike '%where (%deleted_at is null%') then
      v_lipsa := v_lipsa || (v_t || ' (parțial)');
    end if;
  end loop;

  -- Toate ramurile formei 0206, plus cea nouă, plus implicitul. F12h (0218)
  -- rescrie din nou funcția după această formă și caută ramura `fuel_card`.
  v_def := pg_get_functiondef('app.poate_vedea_expirabil(uuid,text)'::regprocedure);
  foreach v_t in array array['medical_exam', 'employee_document', 'work_permit', 'employment_contract',
                             'vehicle_document', 'vehicle_service', 'fuel_card', 'equipment',
                             'fire_extinguisher', 'ssm_training', 'environmental_permit',
                             'inventory_item', 'iscir_authorization', 'maintenance_plan',
                             'personnel_authorization', 'ppe_issuance', 'driver_license',
                             'vehicle_fine'] loop
    if position('''' || v_t || '''' in v_def) = 0 then
      v_lipsa := v_lipsa || ('ramura ' || v_t || ' din app.poate_vedea_expirabil');
    end if;
  end loop;
  if position('else false' in v_def) = 0 then
    v_lipsa := v_lipsa || 'implicitul `else false` din app.poate_vedea_expirabil';
  end if;
  -- Garda din 0023: fișele de personal nu se deschid pe scope `own`.
  if v_def like '%''employees'', ''read'', ''own''%' or v_def like '%''employees'',''read'',''own''%' then
    v_lipsa := v_lipsa || 'app.poate_vedea_expirabil acceptă `own` pe date de personal';
  end if;

  v_def := pg_get_functiondef('internal.flota_rezumat(uuid)'::regprocedure);
  if position('''vehicle_document'', ''vehicle_service'', ''vehicle_fine'', ''fuel_card''' in v_def) = 0 then
    v_lipsa := v_lipsa || 'lista albă a rezumatului (vehicle_document, vehicle_service, vehicle_fine, fuel_card)';
  end if;
  -- Ramura amenzilor din 0206 §G: destinatarii lor vin din cheia `vehicle_fines`.
  if position('flota_destinatari_cheie' in v_def) = 0 then
    v_lipsa := v_lipsa || 'destinatarii amenzilor din rezumat (0206 §G)';
  end if;
  if position('flota_vede_vehicul' in v_def) = 0 then
    v_lipsa := v_lipsa || 'filtrul de vizibilitate din rezumat';
  end if;
  if position('''fuel_card''' in pg_get_functiondef('internal.flota_setari_praguri()'::regprocedure)) = 0 then
    v_lipsa := v_lipsa || 'pragurile flotei oglindite pentru carduri';
  end if;
  if position('flota_rezumat' in pg_get_functiondef('internal.conformitate_zilnica()'::regprocedure)) = 0 then
    v_lipsa := v_lipsa || 'conformitate_zilnica nu mai cheamă flota_rezumat';
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'vehicles_carduri_resincronizeaza'
                  and tgrelid = 'public.vehicles'::regclass) then
    v_lipsa := v_lipsa || 'triggerul vehicles_carduri_resincronizeaza';
  end if;

  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where (n.nspname, p.proname) in (('internal', 'carduri_inainte'), ('internal', 'carduri_dupa'),
                                               ('internal', 'carduri_proiecteaza'),
                                               ('internal', 'carduri_resincronizeaza_vehicul'),
                                               ('internal', 'carduri_profil_inainte'),
                                               ('internal', 'carduri_lot_inainte'),
                                               ('internal', 'tranzactii_card_inainte'),
                                               ('internal', 'card_eticheta'))
                and (p.proconfig is null or not ('search_path=""' = any (p.proconfig)))) then
    v_lipsa := v_lipsa || 'search_path gol pe funcțiile 0214';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'internal'
                and p.proname in ('carduri_inainte', 'carduri_dupa', 'carduri_proiecteaza',
                                  'carduri_resincronizeaza_vehicul', 'carduri_profil_inainte',
                                  'carduri_lot_inainte', 'tranzactii_card_inainte')
                and has_function_privilege('authenticated', p.oid, 'EXECUTE')) then
    v_lipsa := v_lipsa || 'EXECUTE pe funcțiile interne 0214 acordat lui authenticated';
  end if;

  if array_length(v_lipsa, 1) > 0 then
    raise exception '0214: lipsesc %', array_to_string(v_lipsa, ', ');
  end if;
end $$;

commit;
