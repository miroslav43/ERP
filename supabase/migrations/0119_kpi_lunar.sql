-- supabase/migrations/0119_kpi_lunar.sql
--
-- Al doilea tip de evaluare: KPI LUNAR. Evaluarea anuală din 0038/0070/0072
-- rămâne neatinsă — cerința e explicit „complet independente", deci nu există
-- discriminant `tip` pe `employee_evaluations` și nicio politică nu se
-- condiționează pe el. Două fluxuri paralele, cu aceeași poartă de permisiuni.
--
-- ── DE CE TABELE PROPRII, ȘI NU jsonb PE TIPARUL LUI `raspunsuri` ───────────
-- Valoarea feature-ului e SERIA: angajatul își vede KPI-ul constant, lună de
-- lună. Un model jsonb ar fi împins „media pe indicator pe ultimele trei luni"
-- și graficul din portal în agregări peste `jsonb_array_elements`, adică exact
-- interogarea care se scrie greu, se citește mai greu și încetinește tăcut la
-- 200 de angajați × 12 luni. `kpi_valori` face din asta un `select` obișnuit.
--
-- ── DE CE VALORILE ÎȘI COPIAZĂ DEFINIȚIA ───────────────────────────────────
-- Lecția lui 0072, secțiunea 2, aplicată din prima: din clipa în care setul
-- devine editabil, o pondere schimbată în iulie ar rescrie retroactiv scorul
-- din ianuarie, iar o țintă mutată de la 40 la 25 ar transforma un „37 din 40"
-- istoric într-o depășire. De aceea `kpi_valori` ține `cod`, `denumire`, `tip`,
-- `unitate`, `sens`, `pondere`, `scala_max` și `tinta` — instantaneul lunii.
--
-- ── DE CE `sens` ───────────────────────────────────────────────────────────
-- „Vizite: țintă 40, realizat 37" = 92%. „Rebut: maxim 2%, realizat 1,4%" =
-- 130%, nu 70%. Fără discriminantul de sens, jumătate din indicatorii reali se
-- calculează exact invers, și nimic nu semnalează asta.
--
-- ── DE CE UN PREDICAT NOU DE MANAGER ───────────────────────────────────────
-- `app.is_manager_of` (0005:40) verifică `manager_path @> [angajatul curent]`,
-- adică TOT SUBARBORELE: șeful șefului trece la fel de bine ca șeful direct.
-- Pentru evaluarea anuală a fost în regulă. Cerința aici e „stabilite de
-- managerul direct", deci scrierea cere `app.este_manager_direct`, pe
-- `manager_employee_id`. Citirea rămâne pe subarbore — a tăia ierarhia din
-- citire ar fi ascuns KPI-ul echipei de directorul care răspunde de ea.
--
-- ── DE CE LUNA FINALIZATĂ NU SE REDESCHIDE, ȘI DE CE NU DIN APLICAȚIE ──────
-- `using (... and status = 'draft')` pe politica de UPDATE: un rând finalizat
-- nu mai trece de clauză, deci niciun UPDATE nu-l atinge, indiferent din ce
-- cale de cod vine. Corolarul obligatoriu, pe care îl respectă `actions.ts`:
-- un UPDATE respins de USING afectează ZERO rânduri FĂRĂ eroare, deci fiecare
-- tranziție face `.select()` după `.update()` și tratează golul drept conflict.
--
-- ── ȘI O REPARAȚIE PE DRUM ─────────────────────────────────────────────────
-- Secțiunea 11: politica de SELECT de pe `employee_evaluations` nu filtrează
-- după status, deci un angajat (scope `own`, dat de 0070:271) își poate citi
-- evaluarea anuală rămasă în DRAFT — concluzia pe jumătate scrisă a
-- managerului. Nimeni nu s-a lovit de asta fiindcă portalul n-are ecran de
-- evaluări. Migrarea asta adaugă unul, deci gaura se închide aici.

\set ON_ERROR_STOP on

begin;

-- =====================================================================================
-- 1. Vocabularul
-- =====================================================================================

-- `masurat`  = are țintă și valoare realizată (vizite, contracte, rebut).
-- `apreciat` = judecata managerului pe o scală (atitudine, respectarea procedurii).
create type public.kpi_indicator_tip as enum ('masurat', 'apreciat');

-- Sensul în care indicatorul e „bun". Vezi antetul.
create type public.kpi_sens as enum ('crestere', 'descrestere');

-- =====================================================================================
-- 2. Setul de indicatori, legat de o FUNCȚIE
-- =====================================================================================
-- Un set activ per funcție. Consecința asumată: doi manageri cu subordonați pe
-- aceeași funcție împart setul. Divergențele se rezolvă prin `kpi_tinte_angajat`,
-- nu prin seturi paralele — altfel configurarea se dublează la fiecare manager
-- nou și nimeni nu mai știe care set e „cel bun" pentru o funcție.

create table public.kpi_seturi (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- TEXT, nu o cheie către `job_positions`. Migrarea 0110 a desființat
  -- nomenclatorul de funcții: funcția e de atunci o coloană `text` pe fișă
  -- (`employees.functie`), iar cheia veche a rămas doar un reziduu de
  -- compatibilitate, pe care nimic nu-l mai populează. Un set legat de ea ar fi
  -- fost legat de o coloană moartă și n-ar fi găsit niciodată vreun angajat.
  functie text not null,
  -- Cheia de potrivire. Fără ea, „Agent vânzări" și „agent vânzări" ar fi două
  -- seturi pentru aceiași oameni, iar potrivirea din aplicație ar fi trebuit să
  -- treacă prin `ilike` — unde un `%` din denumirea funcției devine tăcut
  -- jocher. `lower(btrim(...))` face comparația o egalitate obișnuită.
  functie_norm text not null generated always as (lower(btrim(functie))) stored,
  denumire text not null,
  descriere text,
  activ boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint kpi_seturi_denumire_len check (char_length(denumire) between 2 and 160),
  constraint kpi_seturi_descriere_len check (char_length(descriere) <= 2000),
  -- Aceleași praguri ca `employees_functie_ck` din 0110: o funcție care nu
  -- încape pe fișă n-are cum să fie potrivită de un set.
  constraint kpi_seturi_functie_len check (char_length(btrim(functie)) between 2 and 160)
);

create unique index kpi_seturi_functie_uniq
  on public.kpi_seturi (organization_id, functie_norm)
  where deleted_at is null and activ;

create index kpi_seturi_org_idx
  on public.kpi_seturi (organization_id)
  where deleted_at is null;

-- =====================================================================================
-- 3. Indicatorii setului
-- =====================================================================================

create table public.kpi_indicatori (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  set_id uuid not null references public.kpi_seturi (id) on delete cascade,
  cod text not null,
  denumire text not null,
  descriere text,
  tip public.kpi_indicator_tip not null,
  unitate text,
  sens public.kpi_sens,
  tinta_implicita numeric(14, 2),
  scala_max smallint,
  pondere numeric(5, 2) not null,
  ordine smallint not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint kpi_indicatori_cod_format check (cod ~ '^[a-z0-9_]{2,60}$'),
  constraint kpi_indicatori_denumire_len check (char_length(denumire) between 2 and 160),
  constraint kpi_indicatori_descriere_len check (char_length(descriere) <= 1000),
  constraint kpi_indicatori_unitate_len check (char_length(unitate) <= 24),
  constraint kpi_indicatori_pondere check (pondere >= 0 and pondere <= 100),
  -- Discriminantul + valoarea, tiparul din `leave_entitlement_rules` (0035):
  -- exact coloanele tipului sunt populate, restul obligatoriu NULL.
  constraint kpi_indicatori_forma check (
    (tip = 'masurat'
      and sens is not null
      and tinta_implicita is not null
      and scala_max is null)
    or
    (tip = 'apreciat'
      and sens is null
      and tinta_implicita is null
      and unitate is null
      and scala_max in (3, 4, 5, 10))
  )
);

create unique index kpi_indicatori_cod_uniq
  on public.kpi_indicatori (set_id, cod)
  where deleted_at is null;

create index kpi_indicatori_set_idx
  on public.kpi_indicatori (set_id, ordine)
  where deleted_at is null;

-- =====================================================================================
-- 4. Abaterea de țintă, per angajat
-- =====================================================================================
-- „Juniorul are 25, nu 40." Abaterea e PERMANENTĂ până e schimbată — altfel
-- managerul ar fi rescris aceeași corecție în fiecare lună, iar prima lună
-- uitată ar fi măsurat juniorul cu ținta seniorului.

create table public.kpi_tinte_angajat (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  indicator_id uuid not null references public.kpi_indicatori (id) on delete cascade,
  tinta numeric(14, 2) not null,
  motiv text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint kpi_tinte_angajat_motiv_len check (char_length(motiv) <= 500)
);

create unique index kpi_tinte_angajat_uniq
  on public.kpi_tinte_angajat (employee_id, indicator_id)
  where deleted_at is null;

-- =====================================================================================
-- 5. Evaluarea lunară
-- =====================================================================================

create table public.kpi_evaluari_lunare (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  set_id uuid not null references public.kpi_seturi (id) on delete restrict,
  an smallint not null,
  luna smallint not null,
  -- Ziua întâi a lunii, calculată de bază. Există pentru ORDONARE și pentru
  -- cursorul keyset: acestea au nevoie de O SINGURĂ coloană monotonă, iar
  -- `order by an desc, luna desc` cu un cursor pe două coloane s-ar fi scris
  -- de mână în fiecare interogare, cu predicatul lexicografic dedus manual —
  -- exact locul în care paginarea începe să sară rânduri la granița de an.
  -- `make_date` e immutable, deci coloana poate fi `stored` și indexată.
  perioada date not null generated always as (make_date(an::int, luna::int, 1)) stored,
  status public.evaluation_status not null default 'draft',
  -- Recalculat la fiecare salvare, din `kpi_valori`. Stocat, nu calculat la
  -- citire: seria din portal cere doar coloana asta, fără să atingă liniile.
  scor_procent numeric(6, 2),
  concluzie text,
  evaluator_id uuid references auth.users (id) on delete set null,
  finalizat_la timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint kpi_evaluari_lunare_luna check (luna between 1 and 12),
  constraint kpi_evaluari_lunare_an check (an between 2000 and 2100),
  constraint kpi_evaluari_lunare_concluzie_len check (char_length(concluzie) <= 4000),
  constraint kpi_evaluari_lunare_finalizat check (
    (status = 'finalizat' and finalizat_la is not null)
    or (status = 'draft' and finalizat_la is null)
  )
);

create unique index kpi_evaluari_lunare_uniq
  on public.kpi_evaluari_lunare (employee_id, an, luna)
  where deleted_at is null;

create index kpi_evaluari_lunare_org_idx
  on public.kpi_evaluari_lunare (organization_id, perioada desc, id desc)
  where deleted_at is null;

create index kpi_evaluari_lunare_employee_idx
  on public.kpi_evaluari_lunare (employee_id, perioada desc)
  where deleted_at is null;

-- =====================================================================================
-- 6. Valorile lunii — o linie per indicator, cu definiția înghețată
-- =====================================================================================

create table public.kpi_valori (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  evaluare_id uuid not null references public.kpi_evaluari_lunare (id) on delete cascade,
  -- `set null`, nu `cascade`: un indicator scos din set nu șterge istoricul.
  indicator_id uuid references public.kpi_indicatori (id) on delete set null,
  -- ── instantaneul definiției, la deschiderea lunii ──
  cod text not null,
  denumire text not null,
  tip public.kpi_indicator_tip not null,
  unitate text,
  sens public.kpi_sens,
  pondere numeric(5, 2) not null,
  scala_max smallint,
  tinta numeric(14, 2),
  ordine smallint not null default 0,
  -- ── ce completează managerul ──
  realizat numeric(14, 2),
  nota smallint,
  procent numeric(6, 2),
  comentariu text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint kpi_valori_denumire_len check (char_length(denumire) between 2 and 160),
  constraint kpi_valori_comentariu_len check (char_length(comentariu) <= 1000),
  constraint kpi_valori_pondere check (pondere >= 0 and pondere <= 100),
  constraint kpi_valori_forma check (
    (tip = 'masurat'
      and sens is not null
      and tinta is not null
      and scala_max is null
      and nota is null)
    or
    (tip = 'apreciat'
      and sens is null
      and tinta is null
      and unitate is null
      and realizat is null
      and scala_max in (3, 4, 5, 10))
  ),
  constraint kpi_valori_nota_in_scala check (
    nota is null or (nota >= 0 and scala_max is not null and nota <= scala_max)
  )
);

create unique index kpi_valori_uniq
  on public.kpi_valori (evaluare_id, cod)
  where deleted_at is null;

create index kpi_valori_evaluare_idx
  on public.kpi_valori (evaluare_id, ordine)
  where deleted_at is null;

-- =====================================================================================
-- 7. Predicate
-- =====================================================================================

-- Managerul DIRECT, spre deosebire de `app.is_manager_of` care ia tot subarborele.
create or replace function app.este_manager_direct(p_org uuid, p_employee uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.employees e
    where e.id = p_employee
      and e.organization_id = p_org
      and e.deleted_at is null
      and e.manager_employee_id = app.current_employee_id(p_org)
  )
$$;

comment on function app.este_manager_direct(uuid, uuid) is
  'Adevărat doar dacă utilizatorul curent este managerul DIRECT al angajatului (manager_employee_id), nu oriunde pe lanțul de subordonare.';

-- Funcția (postul) angajatului curent — pentru vizibilitatea setului propriu.
create or replace function app.functia_curenta(p_org uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(btrim(e.functie))
  from public.employees e
  where e.id = app.current_employee_id(p_org)
    and e.organization_id = p_org
    and e.deleted_at is null
$$;

comment on function app.functia_curenta(uuid) is
  'Funcția fișei curente, normalizată (lower+btrim). NULL dacă utilizatorul n-are fișă ori n-are funcție scrisă.';

-- Poarta KPI. Citirea urmează subarborele; SCRIEREA cere managerul direct.
create or replace function app.can_access_kpi(p_org uuid, p_employee uuid, p_action text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case app.has_permission(p_org, 'evaluations', p_action)
    when 'all' then true
    when 'team' then case
      when p_action = 'read' then app.is_manager_of(p_org, p_employee)
      else app.este_manager_direct(p_org, p_employee)
    end
    -- Angajatul CITEȘTE, nu scrie. `own` pe create/update e refuz.
    when 'own' then p_action = 'read' and p_employee = app.current_employee_id(p_org)
    else false
  end
$$;

comment on function app.can_access_kpi(uuid, uuid, text) is
  'Accesul la KPI-ul unui angajat. Citire = subarbore (ca la evaluarea anuală); scriere = doar managerul direct.';

-- Vizibilitatea unui set: `own` vede DOAR setul propriei funcții.
create or replace function app.vede_set_kpi(p_set uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.kpi_seturi s
    where s.id = p_set
      and s.deleted_at is null
      and s.organization_id = any (app.current_org_ids()::uuid[])
      and case app.has_permission(s.organization_id, 'evaluations', 'read')
        when 'none' then false
        when 'own' then s.functie_norm = app.functia_curenta(s.organization_id)
        else true
      end
  )
$$;

comment on function app.vede_set_kpi(uuid) is
  'Vizibilitatea unui set de indicatori. Angajatul (scope own) vede numai setul funcției lui.';

-- Accesul la o linie de valori, prin evaluarea-părinte. SECURITY DEFINER ca să
-- nu depindă de politica de SELECT a părintelui în interiorul altei politici.
-- `read` merge pe orice status; scrierea, numai pe draft — de aici vine
-- „luna finalizată nu se redeschide", inclusiv pentru liniile ei.
create or replace function app.acces_kpi_valoare(p_evaluare uuid, p_action text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.kpi_evaluari_lunare e
    where e.id = p_evaluare
      and e.deleted_at is null
      and app.can_access_kpi(e.organization_id, e.employee_id, p_action)
      and (p_action = 'read' or e.status = 'draft')
  )
$$;

comment on function app.acces_kpi_valoare(uuid, text) is
  'Accesul la o linie de KPI prin evaluarea ei lunară. Scrierea trece doar cât timp luna e draft.';

-- =====================================================================================
-- 8. Politici — seturi și indicatori
-- =====================================================================================

alter table public.kpi_seturi enable row level security;
alter table public.kpi_seturi force row level security;

create policy kpi_seturi_select on public.kpi_seturi
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and case app.has_permission(organization_id, 'evaluations', 'read')
      when 'none' then false
      when 'own' then functie_norm = app.functia_curenta(organization_id)
      else true
    end
  );

create policy kpi_seturi_insert on public.kpi_seturi
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'evaluations', 'update') in ('all', 'team')
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy kpi_seturi_update on public.kpi_seturi
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and app.has_permission(organization_id, 'evaluations', 'update') in ('all', 'team')
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'evaluations', 'update') in ('all', 'team')
    and updated_by = (select auth.uid())
  );

alter table public.kpi_indicatori enable row level security;
alter table public.kpi_indicatori force row level security;

create policy kpi_indicatori_select on public.kpi_indicatori
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and app.vede_set_kpi(set_id)
  );

create policy kpi_indicatori_insert on public.kpi_indicatori
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'evaluations', 'update') in ('all', 'team')
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy kpi_indicatori_update on public.kpi_indicatori
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and app.has_permission(organization_id, 'evaluations', 'update') in ('all', 'team')
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'evaluations', 'update') in ('all', 'team')
    and updated_by = (select auth.uid())
  );

-- =====================================================================================
-- 9. Politici — ținte per angajat, evaluări lunare, valori
-- =====================================================================================

alter table public.kpi_tinte_angajat enable row level security;
alter table public.kpi_tinte_angajat force row level security;

create policy kpi_tinte_angajat_select on public.kpi_tinte_angajat
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and app.can_access_kpi(organization_id, employee_id, 'read')
  );

create policy kpi_tinte_angajat_insert on public.kpi_tinte_angajat
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can_access_kpi(organization_id, employee_id, 'update')
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy kpi_tinte_angajat_update on public.kpi_tinte_angajat
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and app.can_access_kpi(organization_id, employee_id, 'update')
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can_access_kpi(organization_id, employee_id, 'update')
    and updated_by = (select auth.uid())
  );

alter table public.kpi_evaluari_lunare enable row level security;
alter table public.kpi_evaluari_lunare force row level security;

create policy kpi_evaluari_lunare_select on public.kpi_evaluari_lunare
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and app.can_access_kpi(organization_id, employee_id, 'read')
  );

create policy kpi_evaluari_lunare_insert on public.kpi_evaluari_lunare
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can_access_kpi(organization_id, employee_id, 'create')
    and deleted_at is null
    and status = 'draft'
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

-- `status = 'draft'` în USING: luna finalizată nu mai trece de clauză, deci
-- niciun UPDATE nu o atinge. Redeschiderea nu e interzisă în aplicație — e
-- imposibilă în bază.
create policy kpi_evaluari_lunare_update on public.kpi_evaluari_lunare
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and status = 'draft'
    and app.can_access_kpi(organization_id, employee_id, 'update')
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can_access_kpi(organization_id, employee_id, 'update')
    and updated_by = (select auth.uid())
  );

alter table public.kpi_valori enable row level security;
alter table public.kpi_valori force row level security;

create policy kpi_valori_select on public.kpi_valori
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and app.acces_kpi_valoare(evaluare_id, 'read')
  );

create policy kpi_valori_insert on public.kpi_valori
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.acces_kpi_valoare(evaluare_id, 'create')
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy kpi_valori_update on public.kpi_valori
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and app.acces_kpi_valoare(evaluare_id, 'update')
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.acces_kpi_valoare(evaluare_id, 'update')
    and updated_by = (select auth.uid())
  );

-- =====================================================================================
-- 10. Actor, audit, drepturi
-- =====================================================================================

do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array[
    'kpi_seturi', 'kpi_indicatori', 'kpi_tinte_angajat',
    'kpi_evaluari_lunare', 'kpi_valori'
  ]
  loop
    execute format(
      'create trigger trg_%1$s_actor before insert or update on public.%1$I for each row execute function internal.set_actor()',
      v_tabela);
    execute format(
      'create trigger trg_%1$s_updated before update on public.%1$I for each row execute function app.set_updated_at()',
      v_tabela);
    execute format('select internal.attach_audit(%L)', v_tabela);
    execute format('revoke all on table public.%I from public, anon', v_tabela);
    execute format('grant select, insert, update on table public.%I to authenticated', v_tabela);
    execute format('revoke delete on table public.%I from authenticated', v_tabela);
  end loop;
end;
$$;

revoke all on function app.este_manager_direct(uuid, uuid) from public, anon;
revoke all on function app.functia_curenta(uuid) from public, anon;
revoke all on function app.can_access_kpi(uuid, uuid, text) from public, anon;
revoke all on function app.vede_set_kpi(uuid) from public, anon;
revoke all on function app.acces_kpi_valoare(uuid, text) from public, anon;

grant execute on function app.este_manager_direct(uuid, uuid) to authenticated;
grant execute on function app.functia_curenta(uuid) to authenticated;
grant execute on function app.can_access_kpi(uuid, uuid, text) to authenticated;
grant execute on function app.vede_set_kpi(uuid) to authenticated;
grant execute on function app.acces_kpi_valoare(uuid, text) to authenticated;

-- =====================================================================================
-- 11. Reparație: evaluarea anuală în draft nu mai e vizibilă angajatului
-- =====================================================================================
-- 0070:271 i-a dat angajatului `evaluations:read = own`, iar politica din 0072
-- nu se uită la status. Până acum n-a contat: portalul n-avea ecran de
-- evaluări. Migrarea asta adaugă unul, deci angajatul ar fi început să-și
-- citească evaluarea anuală pe măsură ce managerul o scrie.
--
-- Filtrul se aplică DOAR celor cu scope `own`. Managerul și HR-ul continuă
-- să-și vadă propriile drafturi — altfel n-ar mai putea reveni asupra lor.

drop policy employee_evaluations_select on public.employee_evaluations;

create policy employee_evaluations_select on public.employee_evaluations
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and app.can_access_evaluation(organization_id, employee_id, 'read')
    and (
      status = 'finalizat'
      or app.has_permission(organization_id, 'evaluations', 'read') <> 'own'
    )
  );

-- =====================================================================================
-- 12. Note de proiectare
-- =====================================================================================
-- (a) NICIO politică DELETE, pe niciuna dintre cele cinci tabele. Ștergerea e
--     `deleted_at`, iar `revoke delete` din bucla de la §10 o face imposibilă
--     și din greșeală.
--
-- (b) TOATE indexurile unice sunt PARȚIALE (`where deleted_at is null`). Deci
--     `on conflict` peste ele cere predicatul repetat în clauză — altfel
--     Postgres răspunde 42P10 „no unique or exclusion constraint matching".
--     Codul de aplicație NU face upsert pe ele; deschide luna cu un INSERT
--     simplu și tratează 23505 ca „luna există deja".
--
-- (c) `kpi_evaluari_lunare.set_id` e `on delete restrict`: un set folosit de o
--     lună evaluată nu se poate șterge fizic. Dezactivarea (`activ = false`)
--     rămâne calea normală, și nu atinge istoricul.
--
-- (d) Scorul se recalculează în aplicație, nu într-un trigger. Motivul e că
--     regula „ponderile se renormalizează peste liniile completate" e o
--     decizie de produs care se schimbă mai des decât schema, iar în
--     `src/domain/kpi.ts` are teste. Un trigger ar fi mutat-o unde nu se testează.

commit;
