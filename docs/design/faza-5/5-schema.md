```sql
-- supabase/migrations/0010_inventory.sql
-- Faza 5 — obiecte de inventar, predare-primire, import în loturi.
--
-- Reguli aplicate: S1 (organization_id vine din context, nu din client),
-- S4 (enable + force RLS, politici pe SELECT/INSERT/UPDATE, fără DELETE),
-- S5 (SECURITY DEFINER cu search_path = '' și nume complet calificate),
-- S6 (cast explicit la uuid[]), S7 (OR de nivel superior parantezat),
-- S8 (WITH CHECK complet la INSERT), S9 (reguli temporale în triggere, P0001),
-- S10 (audit prin internal.attach_audit), S11 (numeric(14,2) / timestamptz / date),
-- S12 (soft delete — cu O EXCEPȚIE documentată la inventory_items), S13 (nomenclatoare).
--
-- ── DECIZIA CENTRALĂ: inventory_items NU are deleted_at ──────────────────────
-- Numărul de inventar este UNIC pe organizație. Dacă l-am fi combinat cu soft
-- delete, indexul unic ar fi devenit parțial (`where deleted_at is null`) și
-- ar fi apărut una din două situații, ambele rele:
--   a) index parțial → codul șters logic redevine liber, iar două rânduri diferite
--      poartă același număr în istoric; raportul de casare devine ambiguu;
--   b) index total → un obiect șters din greșeală BLOCHEAZĂ pentru totdeauna
--      reintroducerea codului, iar magazionerul nu mai poate corecta o greșeală
--      de tastare fără intervenția administratorului platformei.
-- Alegerea din plan: obiectul de inventar este un bun fizic, nu un document.
-- Un bun greșit introdus se ȘTERGE fizic, dar numai în bloc, pe import_batch_id,
-- ÎNAINTE de orice alocare (după prima predare-primire există istoric juridic,
-- deci ștergerea e refuzată — vezi app.revoca_import_inventar). Ciclul de viață
-- real al obiectului nu se exprimă prin deleted_at, ci prin status = 'casat',
-- care păstrează rândul, istoricul alocărilor și raportul de casare.
-- Consecință: indexul unic pe (organization_id, numar_inventar) este SIMPLU și
-- NEFILTRAT — cea mai tare formă posibilă a constrângerii.
-- ============================================================================

begin;

-- ============================================================================
-- 1. TIPURI ENUMERATE
-- ============================================================================

create type public.inventory_item_stare as enum ('nou', 'bun', 'uzat', 'defect');
create type public.inventory_item_status as enum ('in_stoc', 'alocat', 'in_reparatie', 'casat');
create type public.inventory_import_status as enum ('in_lucru', 'finalizat', 'esuat', 'revocat');

comment on type public.inventory_item_stare is
  'Starea FIZICĂ a obiectului (uzura). Diferită de status, care descrie unde se află obiectul.';
comment on type public.inventory_item_status is
  'Poziția obiectului în circuitul firmei. Se întreține automat din alocări; nu se scrie liber.';

-- ============================================================================
-- 2. inventory_import_batches — loturile de import
--    Se creează ÎNAINTEA obiectelor: inventory_items o referă.
-- ============================================================================

create table public.inventory_import_batches (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  fisier_nume       text not null,
  fisier_path       text,
  randuri_total     integer not null default 0 check (randuri_total >= 0),
  randuri_importate integer not null default 0 check (randuri_importate >= 0),
  randuri_esuate    integer not null default 0 check (randuri_esuate >= 0),
  status            public.inventory_import_status not null default 'in_lucru',
  erori             jsonb not null default '[]'::jsonb,
  importat_de       uuid references auth.users (id) on delete set null,
  importat_la       timestamptz not null default now(),
  revocat_la        timestamptz,
  revocat_de        uuid references auth.users (id) on delete set null,
  motiv_revocare    text,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users (id) on delete set null,
  updated_at        timestamptz not null default now(),
  updated_by        uuid references auth.users (id) on delete set null,
  deleted_at        timestamptz,
  constraint inventory_batches_fisier_len check (char_length(fisier_nume) between 1 and 260),
  constraint inventory_batches_erori_arr  check (jsonb_typeof(erori) = 'array'),
  constraint inventory_batches_motiv_len  check (motiv_revocare is null or char_length(motiv_revocare) <= 1000)
);

create index inventory_batches_org_idx
  on public.inventory_import_batches (organization_id, importat_la desc)
  where deleted_at is null;

comment on table public.inventory_import_batches is
  'Un import de inventar este o tranzacție de business, nu un simplu upload: lotul este unitatea de revocare (app.revoca_import_inventar).';

-- ============================================================================
-- 3. inventory_categories — nomenclator, cu rânduri de platformă
--    organization_id IS NULL = implicitul platformei, vizibil tuturor și
--    needitabil din aplicație (S13: nomenclator, nu constante în cod).
-- ============================================================================

create table public.inventory_categories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  cod             text not null,
  denumire        text not null,
  descriere       text,
  ordine          smallint not null default 100,
  activ           boolean not null default true,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id) on delete set null,
  deleted_at      timestamptz,
  constraint inventory_categories_cod_ck      check (cod ~ '^[a-z][a-z0-9_]{1,31}$'),
  constraint inventory_categories_denumire_ck check (char_length(btrim(denumire)) between 2 and 120),
  constraint inventory_categories_descr_ck    check (descriere is null or char_length(descriere) <= 500)
);

create unique index inventory_categories_platforma_uq
  on public.inventory_categories (cod)
  where organization_id is null and deleted_at is null;

create unique index inventory_categories_org_uq
  on public.inventory_categories (organization_id, cod)
  where organization_id is not null and deleted_at is null;

create index inventory_categories_lista_idx
  on public.inventory_categories (organization_id, ordine, denumire)
  where deleted_at is null and activ;

-- ============================================================================
-- 4. inventory_items — obiectele propriu-zise
-- ============================================================================

create table public.inventory_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  category_id     uuid references public.inventory_categories (id) on delete restrict,
  denumire        text not null,
  numar_inventar  text not null,
  serie           text,                                   -- serie de fabricație sau IMEI
  model           text,
  producator      text,
  data_achizitie  date,
  valoare         numeric(14, 2) check (valoare is null or valoare >= 0),
  garantie_expira date,
  stare           public.inventory_item_stare  not null default 'bun',
  status          public.inventory_item_status not null default 'in_stoc',
  locatie         text,
  observatii      text,
  import_batch_id uuid references public.inventory_import_batches (id) on delete set null,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id) on delete set null,
  constraint inventory_items_denumire_ck check (char_length(btrim(denumire)) between 2 and 200),
  constraint inventory_items_numar_ck    check (numar_inventar ~ '^[A-Za-z0-9][A-Za-z0-9 ._/\-]{0,39}$'),
  constraint inventory_items_serie_ck    check (serie is null or char_length(btrim(serie)) between 1 and 100),
  constraint inventory_items_model_ck    check (model is null or char_length(model) <= 120),
  constraint inventory_items_prod_ck     check (producator is null or char_length(producator) <= 120),
  constraint inventory_items_locatie_ck  check (locatie is null or char_length(locatie) <= 200),
  constraint inventory_items_obs_ck      check (observatii is null or char_length(observatii) <= 2000),
  -- Garanția nu poate începe înainte de achiziție. Ambele sunt `date`, deci
  -- comparația este IMMUTABLE și are voie să stea în CHECK (S9 se referă la
  -- now()/current_date, care lipsesc aici).
  constraint inventory_items_garantie_ck check (
    garantie_expira is null or data_achizitie is null or garantie_expira >= data_achizitie
  )
);

-- CHEIA DE IDENTITATE a obiectului fizic. Index unic SIMPLU, fără predicat:
-- vezi antetul fișierului. `upper(btrim(...))` face codul insensibil la
-- majuscule și la spații accidentale — „inv 12" și „INV 12" sunt același obiect.
create unique index inventory_items_numar_uq
  on public.inventory_items (organization_id, upper(btrim(numar_inventar)));

create index inventory_items_status_idx   on public.inventory_items (organization_id, status, denumire);
create index inventory_items_categorie_idx on public.inventory_items (organization_id, category_id);
create index inventory_items_batch_idx    on public.inventory_items (import_batch_id) where import_batch_id is not null;
create index inventory_items_garantie_idx on public.inventory_items (organization_id, garantie_expira) where garantie_expira is not null;
create index inventory_items_serie_idx    on public.inventory_items (organization_id, upper(btrim(serie))) where serie is not null;

comment on table public.inventory_items is
  'Obiecte de inventar. FĂRĂ deleted_at, intenționat: unicitatea numărului de inventar trebuie să fie totală. Retragerea din uz se face prin status = ''casat''; corectarea unui import greșit, prin app.revoca_import_inventar (numai înainte de prima alocare).';
comment on column public.inventory_items.status is
  'Întreținut automat de triggerul de alocare. Nu se poate seta ''alocat'' fără o predare deschisă și nu se poate elibera obiectul cât timp o predare este deschisă.';
comment on column public.inventory_items.valoare is
  'numeric(14,2), niciodată float: valoarea de inventar intră în note contabile și în procesele-verbale.';

-- ============================================================================
-- 5. inventory_allocations — predarea-primirea
-- ============================================================================

create table public.inventory_allocations (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references public.organizations (id) on delete cascade,
  item_id                 uuid not null references public.inventory_items (id) on delete restrict,
  employee_id             uuid not null references public.employees (id) on delete restrict,
  predat_la               timestamptz not null default now(),
  returnat_la             timestamptz,
  stare_la_predare        public.inventory_item_stare not null default 'bun',
  stare_la_returnare      public.inventory_item_stare,
  observatii              text,
  pv_document_path        text,
  confirmat_de_angajat_la timestamptz,
  created_at              timestamptz not null default now(),
  created_by              uuid references auth.users (id) on delete set null,
  updated_at              timestamptz not null default now(),
  updated_by              uuid references auth.users (id) on delete set null,
  deleted_at              timestamptz,
  constraint inventory_alloc_interval_ck check (returnat_la is null or returnat_la > predat_la),
  constraint inventory_alloc_returnare_ck check (
    (returnat_la is null and stare_la_returnare is null) or returnat_la is not null
  ),
  constraint inventory_alloc_confirmare_ck check (
    confirmat_de_angajat_la is null or confirmat_de_angajat_la >= predat_la
  ),
  constraint inventory_alloc_obs_ck check (observatii is null or char_length(observatii) <= 2000),
  constraint inventory_alloc_pv_ck  check (pv_document_path is null or char_length(pv_document_path) <= 500),

  -- ADEVĂRUL DESPRE DUBLA ALOCARE, ÎN BAZA DE DATE, NU ÎN APLICAȚIE.
  -- Un obiect nu poate fi predat simultan la doi angajați. tstzrange(a, b) este
  -- implicit „[)" — semideschis — deci returnarea la ora 14:00 și predarea către
  -- alt coleg tot la 14:00 NU se suprapun; o secundă de suprapunere reală, da.
  -- `returnat_la IS NULL` ridică limita superioară la infinit: alocarea deschisă
  -- blochează orice altă predare a aceluiași obiect, la orice moment viitor.
  -- Predicatul `where (deleted_at is null)` scoate din constrângere rândurile
  -- șterse logic, ca o predare anulată să nu blocheze obiectul la nesfârșit.
  -- Necesită btree_gist (instalat în 0001, schema `extensions`) pentru clasa de
  -- operatori pe uuid; o numim explicit, fiindcă search_path nu e garantat.
  constraint inventory_alloc_fara_suprapunere
    exclude using gist (
      item_id extensions.gist_uuid_ops with =,
      tstzrange(predat_la, returnat_la) with &&
    ) where (deleted_at is null)
);

create index inventory_alloc_item_idx
  on public.inventory_allocations (item_id, predat_la desc) where deleted_at is null;
create index inventory_alloc_angajat_idx
  on public.inventory_allocations (organization_id, employee_id, predat_la desc) where deleted_at is null;
create index inventory_alloc_deschise_idx
  on public.inventory_allocations (organization_id, item_id)
  where deleted_at is null and returnat_la is null;
create index inventory_alloc_neconfirmate_idx
  on public.inventory_allocations (organization_id, predat_la desc)
  where deleted_at is null and returnat_la is null and confirmat_de_angajat_la is null;

comment on constraint inventory_alloc_fara_suprapunere on public.inventory_allocations is
  'Un obiect, un deținător, la un moment dat. Constrângere de excludere, nu verificare în cod: vezi explicația din josul migrării.';

-- ============================================================================
-- 6. TRIGGERE — integritate, statusuri derivate, proiecția scadențelor
--    Toate SECURITY DEFINER cu search_path = '' (S5): trebuie să citească
--    `employees` și să scrie `inventory_items` chiar și pentru un angajat care,
--    prin RLS, nu are drept de scriere pe fișa obiectului (confirmarea primirii).
-- ============================================================================

create or replace function internal.inventory_items_valideaza()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alocare_deschisa boolean;
begin
  new.denumire       := btrim(new.denumire);
  new.numar_inventar := btrim(new.numar_inventar);
  new.serie          := nullif(btrim(coalesce(new.serie, '')), '');
  new.updated_at     := now();

  if tg_op = 'UPDATE' then
    new.organization_id := old.organization_id;   -- S1: nu se mută între firme
    new.created_at      := old.created_at;
  end if;

  if new.data_achizitie is not null and new.data_achizitie > app.azi_local() then
    raise exception using errcode = 'P0001',
      message = 'Data achiziției nu poate fi în viitor. Verificați data trecută pe factură.';
  end if;

  select exists (
    select 1 from public.inventory_allocations a
     where a.item_id = new.id and a.returnat_la is null and a.deleted_at is null
  ) into v_alocare_deschisa;

  if new.status = 'alocat' and not v_alocare_deschisa then
    raise exception using errcode = 'P0001',
      message = 'Obiectul nu poate fi marcat „alocat" fără o predare-primire înregistrată. Înregistrați mai întâi predarea către angajat.';
  end if;

  if new.status <> 'alocat' and v_alocare_deschisa then
    raise exception using errcode = 'P0001',
      message = 'Obiectul este predat unui angajat. Înregistrați mai întâi returnarea, apoi schimbați starea obiectului.';
  end if;

  return new;
end;
$$;

create trigger inventory_items_biu
  before insert or update on public.inventory_items
  for each row execute function internal.inventory_items_valideaza();

-- Proiecția garanției în motorul de expirări (0008). NU rescriem praguri, NU
-- creăm tabele de alerte: doar apelăm punctul unic de scriere.
create or replace function internal.inventory_sync_garantie(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_obiect      public.inventory_items%rowtype;
  v_responsabil uuid;
begin
  select * into v_obiect from public.inventory_items where id = p_item_id;
  if not found then
    return;
  end if;

  -- Responsabilul scadenței este deținătorul curent, dacă există. Așa, garanția
  -- unui laptop apare la scope 'own'/'team' exact la omul care îl are în mână.
  select a.employee_id into v_responsabil
    from public.inventory_allocations a
   where a.item_id = v_obiect.id
     and a.returnat_la is null
     and a.deleted_at is null
   order by a.predat_la desc
   limit 1;

  perform internal.sync_expirable(
    v_obiect.organization_id,
    'inventory_item',
    v_obiect.id,
    'garantie',
    left('Garanție — ' || v_obiect.denumire || ' (' || v_obiect.numar_inventar || ')', 200),
    v_obiect.garantie_expira,
    'inventory_items',
    v_responsabil,
    v_obiect.status <> 'casat'     -- obiectul casat iese din semafor, istoricul rămâne
  );
end;
$$;

create or replace function internal.inventory_items_expirari()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform internal.inventory_sync_garantie(new.id);
  return null;
end;
$$;

create trigger inventory_items_expirari_aiu
  after insert or update of denumire, numar_inventar, garantie_expira, status
  on public.inventory_items
  for each row execute function internal.inventory_items_expirari();

create or replace function internal.inventory_alloc_valideaza()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_obiect_org  uuid;
  v_obiect_stat public.inventory_item_status;
  v_angajat_org uuid;
  v_privilegiat boolean;
begin
  new.updated_at := now();

  if tg_op = 'UPDATE' then
    new.organization_id := old.organization_id;
    new.item_id         := old.item_id;
    new.created_at      := old.created_at;
  end if;

  select i.organization_id, i.status into v_obiect_org, v_obiect_stat
    from public.inventory_items i where i.id = new.item_id;
  if v_obiect_org is null then
    raise exception using errcode = 'P0001',
      message = 'Obiectul de inventar indicat nu mai există.';
  end if;

  select e.organization_id into v_angajat_org
    from public.employees e where e.id = new.employee_id and e.deleted_at is null;
  if v_angajat_org is null then
    raise exception using errcode = 'P0001',
      message = 'Angajatul indicat nu are o fișă activă.';
  end if;

  if v_obiect_org <> new.organization_id or v_angajat_org <> new.organization_id then
    raise exception using errcode = 'P0001',
      message = 'Obiectul și angajatul trebuie să aparțină aceleiași organizații.';
  end if;

  if tg_op = 'INSERT' and v_obiect_stat = 'casat' then
    raise exception using errcode = 'P0001',
      message = 'Obiectul este casat și nu mai poate fi predat unui angajat.';
  end if;

  if new.predat_la > now() then
    raise exception using errcode = 'P0001',
      message = 'Data predării nu poate fi în viitor.';
  end if;

  if new.returnat_la is not null and new.returnat_la > now() then
    raise exception using errcode = 'P0001',
      message = 'Data returnării nu poate fi în viitor.';
  end if;

  if new.returnat_la is not null and new.stare_la_returnare is null then
    raise exception using errcode = 'P0001',
      message = 'La returnare trebuie consemnată starea în care a fost primit obiectul.';
  end if;

  -- Angajatul care confirmă primirea are voie NUMAI la acest câmp. RLS decide
  -- CINE atinge rândul; ce anume are voie să schimbe se decide aici, fiindcă o
  -- politică RLS nu poate limita coloanele.
  if tg_op = 'UPDATE' then
    v_privilegiat := app.is_service_context()
                     or (select app.is_platform_admin())
                     or app.can(new.organization_id, 'inventory', 'update', 'all');

    if not v_privilegiat then
      if new.employee_id             is distinct from old.employee_id
         or new.predat_la            is distinct from old.predat_la
         or new.returnat_la          is distinct from old.returnat_la
         or new.stare_la_predare     is distinct from old.stare_la_predare
         or new.stare_la_returnare   is distinct from old.stare_la_returnare
         or new.observatii           is distinct from old.observatii
         or new.pv_document_path     is distinct from old.pv_document_path
         or new.deleted_at           is distinct from old.deleted_at then
        raise exception using errcode = 'P0001',
          message = 'Puteți doar confirma primirea obiectului. Restul datelor se modifică de persoana care administrează inventarul.';
      end if;

      if old.confirmat_de_angajat_la is not null
         and new.confirmat_de_angajat_la is distinct from old.confirmat_de_angajat_la then
        raise exception using errcode = 'P0001',
          message = 'Primirea a fost deja confirmată și nu mai poate fi modificată.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger inventory_alloc_biu
  before insert or update on public.inventory_allocations
  for each row execute function internal.inventory_alloc_valideaza();

-- Statusul obiectului este DERIVAT din alocări, nu întreținut de mână.
create or replace function internal.inventory_alloc_propaga()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item uuid := coalesce(new.item_id, old.item_id);
begin
  update public.inventory_items i
     set status = case
           when i.status in ('casat', 'in_reparatie')
             and not exists (
               select 1 from public.inventory_allocations a
                where a.item_id = i.id and a.returnat_la is null and a.deleted_at is null
             ) then i.status
           when exists (
             select 1 from public.inventory_allocations a
              where a.item_id = i.id and a.returnat_la is null and a.deleted_at is null
           ) then 'alocat'::public.inventory_item_status
           else 'in_stoc'::public.inventory_item_status
         end,
         stare = coalesce(new.stare_la_returnare, i.stare),
         updated_at = now()
   where i.id = v_item;

  perform internal.inventory_sync_garantie(v_item);
  return null;
end;
$$;

create trigger inventory_alloc_aiu
  after insert or update on public.inventory_allocations
  for each row execute function internal.inventory_alloc_propaga();

-- updated_at + actor pe nomenclator și pe loturi (obiectele și alocările își
-- setează updated_at în triggerele proprii, care rulează oricum).
create trigger inventory_categories_bu
  before update on public.inventory_categories
  for each row execute function internal.seteaza_updated_at();

create trigger inventory_batches_bu
  before update on public.inventory_import_batches
  for each row execute function internal.seteaza_updated_at();

do $do$
declare t text;
begin
  foreach t in array array[
    'inventory_categories', 'inventory_import_batches',
    'inventory_items', 'inventory_allocations'
  ]
  loop
    execute format(
      'create trigger %I before insert or update on public.%I
         for each row execute function internal.set_actor()',
      'set_actor_' || t, t);
  end loop;
end
$do$;

-- ============================================================================
-- 7. ÎNREGISTRAREA TIPULUI ÎN MOTORUL DE EXPIRĂRI
--    Implicitul din app.poate_vedea_expirabil este RESTRICTIV: un entity_type
--    neînregistrat cere employees:read la scope 'all', deci ar fi INVIZIBIL
--    pentru magazioner. Îl declarăm explicit sub dreptul de inventar.
--
--    ATENȚIE la migrările paralele: funcția se rescrie ÎNTREAGĂ. Lista de mai
--    jos trebuie să conțină TOATE tipurile înregistrate până acum; dacă o
--    migrare ulterioară adaugă un tip, îl adaugă tot aici, prin copierea listei.
-- ============================================================================

create or replace function app.poate_vedea_expirabil(
  p_organization_id uuid,
  p_entity_type text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_entity_type
    when 'medical_exam'         then app.has_permission(p_organization_id, 'employees', 'read') = 'all'
    when 'employee_document'    then app.has_permission(p_organization_id, 'employees', 'read') = 'all'
    when 'work_permit'          then app.has_permission(p_organization_id, 'employees', 'read') = 'all'
    when 'employment_contract'  then app.has_permission(p_organization_id, 'employees', 'read') = 'all'
    when 'vehicle_document'     then app.can(p_organization_id, 'vehicles', 'read', 'own')
    when 'equipment'            then app.can(p_organization_id, 'maintenance', 'read', 'own')
    when 'fire_extinguisher'    then app.can(p_organization_id, 'ssm', 'read', 'own')
    when 'ssm_training'         then app.can(p_organization_id, 'ssm', 'read', 'own')
    when 'environmental_permit' then app.can(p_organization_id, 'compliance', 'read', 'own')
    -- Faza 5: garanția unui obiect de inventar. Eticheta conține denumirea și
    -- numărul de inventar — date de patrimoniu, nu date personale — deci
    -- dreptul de inventar la orice scope este suficient. Filtrarea pe deținător
    -- rămâne în politica din 0008, prin responsible_employee_id.
    when 'inventory_item'       then app.can(p_organization_id, 'inventory', 'read', 'own')
    else app.has_permission(p_organization_id, 'employees', 'read') = 'all'
  end;
$$;

-- ============================================================================
-- 8. RLS — enable + force pe fiecare tabelă nouă (S4)
-- ============================================================================

do $do$
declare t text;
begin
  foreach t in array array[
    'inventory_categories', 'inventory_import_batches',
    'inventory_items', 'inventory_allocations'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end
$do$;

-- ── VOCABULARUL DE PERMISIUNI ───────────────────────────────────────────────
-- Aplicația expune pentru acest modul DOAR `inventory:read` și `inventory:update`
-- (src/config/permissions.ts). Prin urmare politicile de INSERT verifică tot
-- 'update', nu 'create': altfel o organizație care își rescrie matricea de
-- roluri ar putea acorda din interfață un drept care nu deblochează nimic.
-- Modulul dezactivat: app.feature_on() în politici, ca apărare în adâncime.
-- În aplicație, requireFeature dă 404 (nu confirmăm ce a contractat clientul).

-- ── inventory_categories ────────────────────────────────────────────────────
create policy inventory_categories_select on public.inventory_categories
  for select to authenticated
  using (
    deleted_at is null
    and (
      organization_id is null                       -- nomenclatorul de platformă
      or (
        organization_id = any ((select app.current_org_ids())::uuid[])
        and app.feature_on(organization_id, 'inventory')
        and app.can(organization_id, 'inventory', 'read', 'own')
      )
    )
  );

create policy inventory_categories_insert on public.inventory_categories
  for insert to authenticated
  with check (
    organization_id is not null                     -- rândurile de platformă nu se creează din aplicație
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'inventory')
    and app.can(organization_id, 'inventory', 'update', 'all')
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy inventory_categories_update on public.inventory_categories
  for update to authenticated
  using (
    organization_id is not null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'inventory')
    and app.can(organization_id, 'inventory', 'update', 'all')
  )
  with check (
    organization_id is not null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'inventory', 'update', 'all')
    and updated_by = (select auth.uid())
  );

-- ── inventory_items ─────────────────────────────────────────────────────────
-- Vizibilitatea urmează scope-ul: 'all' = tot inventarul firmei; 'team' = ce
-- au în primire oamenii din subordine; 'own' = ce am eu în primire (portalul
-- angajatului). Un obiect nealocat este vizibil numai la scope 'all' —
-- inventarul din magazie nu este treaba fiecărui angajat.
create policy inventory_items_select on public.inventory_items
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'inventory')
    and (
      app.has_permission(organization_id, 'inventory', 'read') = 'all'
      or (
        app.has_permission(organization_id, 'inventory', 'read') = 'team'
        and exists (
          select 1 from public.inventory_allocations a
           where a.item_id = public.inventory_items.id
             and a.deleted_at is null
             and app.is_manager_of(organization_id, a.employee_id)
        )
      )
      or (
        app.has_permission(organization_id, 'inventory', 'read') = 'own'
        and exists (
          select 1 from public.inventory_allocations a
           where a.item_id = public.inventory_items.id
             and a.deleted_at is null
             and a.employee_id = app.current_employee_id(organization_id)
        )
      )
    )
  );

create policy inventory_items_insert on public.inventory_items
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'inventory')
    and app.can(organization_id, 'inventory', 'update', 'all')
    -- S8: starea inițială este fixată. Un obiect se naște în stoc; „alocat"
    -- este rezultatul unei predări-primiri, nu o valoare trimisă de client.
    and status = 'in_stoc'
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy inventory_items_update on public.inventory_items
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'inventory')
    and app.can(organization_id, 'inventory', 'update', 'all')
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'inventory', 'update', 'all')
    and updated_by = (select auth.uid())
  );

-- ── inventory_allocations ───────────────────────────────────────────────────
create policy inventory_allocations_select on public.inventory_allocations
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'inventory')
    and deleted_at is null
    and (
      app.has_permission(organization_id, 'inventory', 'read') = 'all'
      or (
        app.has_permission(organization_id, 'inventory', 'read') = 'team'
        and app.is_manager_of(organization_id, employee_id)
      )
      or (
        app.has_permission(organization_id, 'inventory', 'read') = 'own'
        and employee_id = app.current_employee_id(organization_id)
      )
    )
  );

create policy inventory_allocations_insert on public.inventory_allocations
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'inventory')
    and app.can(organization_id, 'inventory', 'update', 'all')
    -- S8: o predare se naște deschisă și neconfirmată. Returnarea și
    -- confirmarea sunt acte ulterioare, fiecare cu urmă proprie în audit.
    and returnat_la is null
    and stare_la_returnare is null
    and confirmat_de_angajat_la is null
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

-- Două categorii de oameni ating rândul: administratorul de inventar (orice
-- câmp) și angajatul care confirmă primirea (numai confirmat_de_angajat_la —
-- limitarea pe coloane o face triggerul, RLS nu poate).
create policy inventory_allocations_update on public.inventory_allocations
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'inventory')
    and (
      app.can(organization_id, 'inventory', 'update', 'all')
      or (
        employee_id = app.current_employee_id(organization_id)
        and app.can(organization_id, 'inventory', 'read', 'own')
      )
    )
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      app.can(organization_id, 'inventory', 'update', 'all')
      or (
        employee_id = app.current_employee_id(organization_id)
        and app.can(organization_id, 'inventory', 'read', 'own')
      )
    )
    and updated_by = (select auth.uid())
  );

-- ── inventory_import_batches ────────────────────────────────────────────────
create policy inventory_batches_select on public.inventory_import_batches
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'inventory')
    and deleted_at is null
    and app.has_permission(organization_id, 'inventory', 'read') = 'all'
  );

create policy inventory_batches_insert on public.inventory_import_batches
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'inventory')
    and app.can(organization_id, 'inventory', 'update', 'all')
    and status = 'in_lucru'
    and randuri_importate = 0
    and randuri_esuate = 0
    and revocat_la is null
    and revocat_de is null
    and deleted_at is null
    and importat_de = (select auth.uid())
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy inventory_batches_update on public.inventory_import_batches
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'inventory')
    and app.can(organization_id, 'inventory', 'update', 'all')
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'inventory', 'update', 'all')
    and updated_by = (select auth.uid())
  );

-- ============================================================================
-- 9. FUNCȚII DE FLUX (RPC)
-- ============================================================================

-- 9.1 Numărul de inventar — o secvență pe organizație și an, din
--     public.document_sequences. Atomic: INSERT ... ON CONFLICT DO UPDATE
--     rezervă numărul într-o singură comandă, sub blocajul de rând al
--     Postgresului. Două importuri simultane primesc numere diferite fără
--     ca aplicația să citească înainte să scrie.
create or replace function app.aloca_numar_inventar(
  p_organization_id uuid,
  p_prefix text default 'INV'
)
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
    and app.can(p_organization_id, 'inventory', 'update', 'all')
  ) then
    raise exception using errcode = 'PT403',
      message = 'Nu aveți dreptul de a genera numere de inventar în această organizație.';
  end if;

  insert into public.document_sequences (organization_id, document_type, year, prefix, next_number, padding)
  values (p_organization_id, 'inventar', v_an,
          upper(left(coalesce(nullif(btrim(p_prefix), ''), 'INV'), 16)), 2, 5)
  on conflict (organization_id, document_type, year) do update
    set next_number = public.document_sequences.next_number + 1,
        updated_at  = now()
  returning next_number - 1, prefix, padding
       into v_numar, v_prefix, v_padding;

  return coalesce(nullif(v_prefix, ''), 'INV') || '-' || v_an::text || '-'
         || lpad(v_numar::text, v_padding, '0');
end;
$$;

comment on function app.aloca_numar_inventar(uuid, text) is
  'Rezervă următorul număr de inventar (ex. „INV-2026-00042"). Numărul se consumă chiar dacă tranzacția eșuează ulterior — deliberat: o secvență de inventar are voie să aibă goluri, dar nu are voie să repete un număr.';

-- 9.2 Revocarea unui import — singura ștergere fizică din modul.
--     Refuzată din momentul în care un obiect din lot a fost predat cuiva.
create or replace function app.revoca_import_inventar(
  p_batch_id uuid,
  p_motiv text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org      uuid;
  v_status   public.inventory_import_status;
  v_alocate  integer;
  v_sterse   integer;
begin
  select b.organization_id, b.status into v_org, v_status
    from public.inventory_import_batches b
   where b.id = p_batch_id and b.deleted_at is null;

  if v_org is null then
    raise exception using errcode = 'PT404',
      message = 'Lotul de import nu a fost găsit.';
  end if;

  if not (
    v_org = any ((select app.current_org_ids())::uuid[])
    and app.can(v_org, 'inventory', 'update', 'all')
  ) then
    raise exception using errcode = 'PT403',
      message = 'Nu aveți dreptul de a revoca importuri de inventar în această organizație.';
  end if;

  if v_status = 'revocat' then
    raise exception using errcode = 'P0001',
      message = 'Lotul a fost deja revocat.';
  end if;

  select count(*)::integer into v_alocate
    from public.inventory_items i
   where i.import_batch_id = p_batch_id
     and exists (
       select 1 from public.inventory_allocations a
        where a.item_id = i.id and a.deleted_at is null
     );

  if v_alocate > 0 then
    raise exception using errcode = 'P0001',
      message = 'Importul nu mai poate fi revocat: ' || v_alocate::text ||
                ' obiect(e) din lot au fost deja predate unor angajați. Corectați obiectele individual sau casați-le.';
  end if;

  -- Proiecțiile de scadență ale obiectelor dispar odată cu ele.
  perform internal.sync_expirable(
            v_org, 'inventory_item', i.id, 'garantie',
            i.denumire, null::date, 'inventory_items', null, false)
     from public.inventory_items i
    where i.import_batch_id = p_batch_id;

  delete from public.inventory_items where import_batch_id = p_batch_id;
  get diagnostics v_sterse = row_count;

  update public.inventory_import_batches
     set status = 'revocat',
         revocat_la = now(),
         revocat_de = (select auth.uid()),
         motiv_revocare = left(p_motiv, 1000),
         updated_at = now()
   where id = p_batch_id;

  -- Ștergerea fizică nu trece prin triggerul generic de audit (acesta ascultă
  -- doar INSERT/UPDATE), deci o consemnăm explicit.
  perform app.write_audit(
    'delete', v_org, 'inventory_items', p_batch_id, null,
    jsonb_build_object('import_batch_id', p_batch_id, 'obiecte_sterse', v_sterse,
                       'motiv', left(p_motiv, 1000)));

  return v_sterse;
end;
$$;

revoke all on function app.aloca_numar_inventar(uuid, text) from public, anon;
revoke all on function app.revoca_import_inventar(uuid, text) from public, anon;
revoke all on function internal.inventory_sync_garantie(uuid) from public, anon, authenticated;
grant execute on function app.aloca_numar_inventar(uuid, text) to authenticated, service_role;
grant execute on function app.revoca_import_inventar(uuid, text) to authenticated, service_role;

-- ============================================================================
-- 10. AUDIT — niciuna dintre tabele nu are coloane sensibile, deci garda R9
--     din internal.attach_audit nu se declanșează.
-- ============================================================================

select internal.attach_audit(t)
from unnest(array[
  'inventory_categories', 'inventory_import_batches',
  'inventory_items', 'inventory_allocations'
]) t;

-- ============================================================================
-- 11. SEED DE PLATFORMĂ (organization_id IS NULL)
-- ============================================================================

insert into public.inventory_categories (organization_id, cod, denumire, descriere, ordine)
values
  (null, 'laptop',                'Laptopuri și calculatoare', 'Echipamente de calcul portabile și fixe',        10),
  (null, 'telefon',               'Telefoane mobile',          'Terminale mobile, identificate prin IMEI',       20),
  (null, 'monitor',               'Monitoare',                 'Ecrane și periferice de afișare',                30),
  (null, 'scule',                 'Scule și unelte',           'Scule electrice și manuale',                     40),
  (null, 'echipament_protectie',  'Echipament de protecție',   'EIP predat pe bază de proces-verbal',            50),
  (null, 'mobilier',              'Mobilier',                  'Birouri, scaune, dulapuri',                      60),
  (null, 'altele',                'Alte obiecte de inventar',  'Categorie implicită pentru import',             900)
on conflict do nothing;

commit;

-- ── Privilegii de tabelă pentru tabelele noi ────────────────────────────────
-- Fără acest bloc, politicile de mai sus sunt irelevante: accesul e refuzat mai
-- devreme, cu „permission denied for table inventory_items".
revoke all on all tables in schema public from anon;
grant select, insert, update on all tables in schema public to authenticated;

-- Soft delete: DELETE rămâne revocat pentru toată lumea. Ștergerea fizică a
-- unui lot de import trece exclusiv prin app.revoca_import_inventar, care
-- rulează SECURITY DEFINER și își verifică singură dreptul și precondițiile.
revoke delete on all tables in schema public from public, anon, authenticated;

-- `grant ... on all tables` de mai sus re-deschide și tabelele închise anume în
-- migrările anterioare. Le reînchidem în aceeași migrare — altfel modulul de
-- inventar ar redeschide, tăcut, datele sensibile de personal.
revoke all on public.rate_limits from authenticated;
revoke all on public.employee_sensitive_data from authenticated;

-- ============================================================================
-- EXPLICAȚII
-- ============================================================================
--
-- 1. CUM SE GENEREAZĂ NUMĂRUL DE INVENTAR
--    Numărul NU vine de la client și nu se calculează cu „max(numar) + 1" —
--    acela este un antipattern clasic: două importuri concurente citesc același
--    maxim și încearcă același număr; unul pică pe indexul unic, iar operatorul
--    vede o eroare fără sens.
--    Sursa este public.document_sequences, cu cheia (organization_id,
--    document_type, year) și document_type = 'inventar'. app.aloca_numar_inventar
--    face o singură comandă:
--      insert ... values (..., next_number = 2)
--      on conflict (organization_id, document_type, year)
--      do update set next_number = next_number + 1
--      returning next_number - 1
--    Rândul de secvență se blochează pe durata comenzii, deci al doilea apelant
--    așteaptă și primește numărul următor. Formatul final este
--    prefix || '-' || an || '-' || lpad(numar, padding, '0') → „INV-2026-00042",
--    unde prefixul și padding-ul sunt configurabile PE ORGANIZAȚIE, în rândul de
--    secvență — nu constante în cod (S13).
--    Secvența are voie să aibă goluri: dacă tranzacția de import eșuează după
--    rezervare, numărul rămâne consumat. Este alegerea corectă — un număr de
--    inventar repetat produce două obiecte fizice cu aceeași identitate, ceea ce
--    la un control de gestiune nu se mai poate desface.
--
-- 2. DE CE `EXCLUDE USING gist` ȘI NU O VERIFICARE ÎN COD
--    Verificarea în aplicație arată așa: „citește dacă obiectul are o alocare
--    deschisă; dacă nu are, inserează". Între citire și scriere există o
--    fereastră. Două cereri simultane (doi magazioneri, sau un dublu-clic pe
--    același buton) citesc AMÂNDOUĂ „nu are alocare deschisă" și inserează
--    AMÂNDOUĂ. Rezultatul: același laptop apare predat la doi oameni, fiecare
--    cu proces-verbal semnat. Nici măcar o tranzacție READ COMMITTED nu apără:
--    rândul concurent pur și simplu nu e vizibil la momentul citirii, iar un
--    `SELECT ... FOR UPDATE` pe obiect ar apăra doar dacă fiecare cale de
--    scriere din aplicație și-ar aminti să-l pună — inclusiv importurile,
--    scripturile de corecție și viitoarele endpointuri.
--    Constrângerea de excludere mută regula acolo unde nu se poate ocoli. La
--    fiecare INSERT/UPDATE, Postgres verifică, sub blocajul indexului GiST, dacă
--    există un alt rând cu ACELAȘI item_id al cărui interval
--    tstzrange(predat_la, returnat_la) se suprapune cu cel nou. A doua tranzacție
--    fie așteaptă, fie primește 23P01 (exclusion_violation). Nu există fereastră,
--    fiindcă nu există „citire înainte de scriere": verdictul se dă în același
--    pas cu inserarea.
--    În plus, constrângerea acoperă și cazul pe care codul îl uită aproape
--    întotdeauna: predările RETROACTIVE. Cineva înregistrează astăzi o predare
--    din 3 martie, pentru un obiect care în martie era deja la altcineva.
--    O verificare „există alocare deschisă?" nu vede nimic greșit; intervalele
--    se suprapun și constrângerea refuză.
--    Costul: în UI trebuie tradus SQLSTATE 23P01 într-un mesaj omenesc —
--    „Obiectul este deja predat altui angajat în perioada indicată."
--
-- 3. LEGĂTURA CU MOTORUL DE EXPIRĂRI
--    Nu există tabelă de alerte proprie și niciun prag configurat aici. Garanția
--    se proiectează în public.expirables prin internal.sync_expirable(), cu
--    entity_type = 'inventory_item' și kind = 'garantie'. `kind` lasă loc, fără
--    nicio schimbare de schemă, unei a doua scadențe pe același obiect (de
--    exemplu 'verificare_metrologica' pentru scule) — cheia unică o permite.
--    Responsabilul scadenței este deținătorul curent, recalculat la fiecare
--    predare și returnare, deci garanția apare la omul care are obiectul în
--    mână. Un obiect casat trece pe is_active = false: iese din semafor, dar
--    rămâne în istoric.
-- ============================================================================
```

SEMNALĂRI (lucruri absente din inventar, pe care nu le-am inventat):

1. `PermissionKey` conține doar `inventory:read` și `inventory:update`, deși seed-ul din `0002_authz.sql` acordă și `inventory create/delete/approve/export`. Politicile de INSERT verifică de aceea `'inventory','update'`. Dacă vocabularul TS se extinde cu `inventory:create`, politicile `*_insert` din această migrare trebuie schimbate în același commit.
2. Nu există `0009_*.sql` în repo. Dacă migrarea 0009 (flotă) rescrie `app.poate_vedea_expirabil`, blocul din secțiunea 7 o va suprascrie: lista trebuie ținută completă manual, fiindcă funcția nu are registru de tipuri.
3. `app.revoca_import_inventar` face `DELETE` pe o tabelă cu `FORCE ROW LEVEL SECURITY` și fără politică `DELETE` (S4). Funcționează pentru că funcția e `SECURITY DEFINER`, iar proprietarul (`postgres` pe Supabase) are `BYPASSRLS`. De verificat empiric pe instanța țintă: `select rolbypassrls from pg_roles where rolname = 'postgres';` — dacă e `false`, revocarea trebuie mutată în context de serviciu (`service_role`).
4. `pv_document_path` este doar text: nu există în inventar un modul de storage/bucket declarat (`@/lib/storage/*` lipsește), deci nu am presupus niciun nume de bucket și nicio politică de Storage.
5. `internal.seteaza_updated_at()` și `internal.set_actor()` sunt refolosite din 0008/0002; `public.tg_set_updated_at()` din 0004 a fost ignorată intenționat (dublură).
6. Fișierele afectate: `/Users/maleticimiroslav/ERP Adminio/supabase/migrations/0010_inventory.sql` (de creat), plus regenerarea `/Users/maleticimiroslav/ERP Adminio/src/types/database.ts` după aplicare.