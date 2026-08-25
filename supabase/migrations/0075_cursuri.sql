-- supabase/migrations/0075_cursuri.sql
-- Modulul de instruire: bibliotecă de materiale (PDF și video), cursuri ca
-- listă ordonată de materiale, înrolări per angajat cu ciclu, dovadă imutabilă.
--
-- DE CE MODUL NOU, și nu o extensie a lui `checklists`:
-- seed-ul din 0002 îi dă managerului exact `('manager','checklists','team',
-- '{read,approve}')`. Nu are `create`, nu are `update`. Prin urmare fiecare
-- ramură `scope >= team AND is_manager_of` scrisă în cele 14 politici din 0014
-- e cod mort. Cerința acestui modul e explicit ca managerul să poată construi
-- și atribui instruiri, deci are nevoie de resursă proprie, seedată corect din
-- prima. Modulul SSM rămâne neatins: `ssm_trainings` are 2 rânduri și zero
-- valori în `materiale` (sondat 2026-08-25), deci nu există date de migrat.
--
-- DOUĂ NIVELURI DE IERARHIE, nu patru. „Lecția ca grup de materiale" ar fi un
-- container cu un singur element în majoritatea cazurilor, dar ar costa un
-- nivel de navigare pe fiecare ecran și un al treilea loc în care aritmetica
-- progresului poate diverge. Materialul e unitatea refolosibilă, cursul e
-- unitatea de atribuire ȘI de valabilitate.
--
-- VERSIUNILE SUNT IMUTABILE fiindcă dovada le ancorează: peste un an trebuie
-- să poți spune CE a semnat omul. Textul contractului pedagogic se COPIAZĂ în
-- rândul de înrolare (un material redenumit n-are voie să rescrie certificatul
-- de anul trecut); octeții se referențiază, nu se dublează.
--
-- TRIGGERELE CARE CALCULEAZĂ DATE DERIVATE SUNT `security definer`.
-- Rolul `postgres` are `rolbypassrls = true` pe acest proiect (verificat), deci
-- o funcție definer ocolește RLS chiar și peste `force row level security`.
-- Consecința e că angajatul NU primește niciun drept de scriere pe
-- `course_enrollments` și pe `course_completion_records`: statusul înrolării și
-- dovada sunt calculate de bază din itemi, niciodată trimise de client. Fără
-- asta ar fi trebuit deschise ramuri `own` de UPDATE/INSERT pe amândouă, iar un
-- `PATCH` direct prin PostgREST ar fi putut scrie „finalizat".
--
-- A DOUA BARIERĂ, pe privilegii: pe `course_enrollment_items` angajatul are
-- `grant update` doar pe COLOANELE de progres. Fără asta, ramura `own` de
-- UPDATE ar deschide rândul întreg, iar cineva și-ar putea rescrie
-- `treapta_dovada` din `parcurgere` în `bifa` și s-ar declara singur „parcurs" —
-- nu ocolești măsurătoarea, schimbi unitatea de măsură. Triggerul restaurează
-- în plus fiecare coloană de contract din OLD, ca cele două bariere să nu
-- depindă una de alta.

begin;

-- =============================================================================
-- 1. Tipuri
-- =============================================================================

create type public.curs_material_fel   as enum ('pdf', 'video');
create type public.curs_material_sursa as enum ('fisier', 'link');
create type public.curs_link_furnizor  as enum ('youtube', 'vimeo', 'loom');
create type public.curs_treapta_dovada as enum ('bifa', 'parcurgere', 'test', 'declaratie');
create type public.curs_motiv          as enum ('manual', 'regula', 'recertificare');
create type public.curs_status         as enum ('neinceput', 'in_curs', 'finalizat', 'expirat', 'anulat');
create type public.curs_item_status    as enum ('neinceput', 'in_curs', 'finalizat');

comment on type public.curs_treapta_dovada is
  'Cât de serios se dovedește parcurgerea, ales PER MATERIAL. `bifa` = declarație simplă; `parcurgere` = procent minim măsurat (numai video-fișier, vezi course_materials_parcurgere_ck); `test` = grilă cu prag; `declaratie` = text asumat, semnat, cu amprenta versiunii. Valoarea `test` există în tip din prima ca să nu fie nevoie de `alter type` ulterior (care cere tranzacție separată); schema Zod o refuză până când ecranele de test există.';

-- =============================================================================
-- 2. Catalog: cursuri, materiale, versiuni, lecții
-- =============================================================================

create table public.courses (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  cod                   text not null check (cod ~ '^[a-z][a-z0-9_]{1,40}$'),
  denumire              text not null check (char_length(btrim(denumire)) between 2 and 160),
  descriere             text check (char_length(descriere) <= 2000),
  obligatoriu           boolean not null default true,
  valabilitate_luni     smallint check (valabilitate_luni is null or valabilitate_luni between 1 and 120),
  termen_zile           smallint not null default 30 check (termen_zile between 1 and 365),
  prag_avertizare_zile  smallint not null default 30 check (prag_avertizare_zile between 1 and 180),
  publicat              boolean not null default false,
  publicat_la           timestamptz,
  activ                 boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references auth.users (id) on delete set null,
  updated_by            uuid references auth.users (id) on delete set null,
  deleted_at            timestamptz,
  unique (id, organization_id)
);

comment on column public.courses.cod is
  'Cod scurt, stabil, folosit în export și în adeverință. Plafonul de 40 de caractere lasă loc unui prefix în chei externe.';
comment on column public.courses.valabilitate_luni is
  'NULL = cursul se face o dată și nu expiră. O valoare = recertificare: la finalizare se calculează `expira_la`, iar jobul zilnic deschide ciclul următor.';

create unique index courses_cod_uk
  on public.courses (organization_id, lower(btrim(cod))) where deleted_at is null;
create unique index courses_denumire_uk
  on public.courses (organization_id, lower(btrim(denumire))) where deleted_at is null;
create index courses_activ_idx
  on public.courses (organization_id, activ, publicat) where deleted_at is null;
create index courses_created_by_idx on public.courses (created_by);
create index courses_updated_by_idx on public.courses (updated_by);

create table public.course_materials (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  cod                   text not null check (cod ~ '^[a-z][a-z0-9_]{1,40}$'),
  titlu                 text not null check (char_length(btrim(titlu)) between 2 and 200),
  descriere             text check (char_length(descriere) <= 2000),
  fel                   public.curs_material_fel not null,
  sursa                 public.curs_material_sursa not null,
  treapta_dovada        public.curs_treapta_dovada not null default 'bifa',
  procent_minim         smallint check (procent_minim is null or procent_minim between 1 and 100),
  prag_test             numeric(5,2) check (prag_test is null or prag_test between 0 and 100),
  declaratie_text       text check (declaratie_text is null or char_length(btrim(declaratie_text)) between 10 and 4000),
  transcriere           text check (char_length(transcriere) <= 50000),
  versiune_curenta_id   uuid,
  activ                 boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references auth.users (id) on delete set null,
  updated_by            uuid references auth.users (id) on delete set null,
  deleted_at            timestamptz,
  unique (id, organization_id),
  -- Cele patru trepte sunt EXCLUSIVE, nu cumulative: fiecare cere exact câmpul
  -- ei și le interzice pe celelalte. Un material cu `procent_minim` și
  -- `prag_test` deodată ar fi ambiguu pentru triggerul de finalizare.
  constraint course_materials_treapta_ck check (
       (treapta_dovada = 'bifa'       and procent_minim is null     and prag_test is null and declaratie_text is null)
    or (treapta_dovada = 'parcurgere' and procent_minim is not null and prag_test is null and declaratie_text is null)
    or (treapta_dovada = 'test'       and procent_minim is null     and prag_test is not null and declaratie_text is null)
    or (treapta_dovada = 'declaratie' and procent_minim is null     and prag_test is null and declaratie_text is not null)
  ),
  -- Nu poți măsura ce nu deții: pentru un link extern nu primim niciun eveniment
  -- de redare pe care să-l putem crede.
  constraint course_materials_link_ck check (sursa <> 'link' or treapta_dovada <> 'parcurgere'),
  -- Parcurgerea măsurată e implementată doar pentru video. Un PDF cu treapta
  -- asta ar fi un material imposibil de închis — exact tiparul `acces_revocat`
  -- din 0014, unde o valoare de enum fără implementare blochează instanța.
  constraint course_materials_parcurgere_ck check (treapta_dovada <> 'parcurgere' or fel = 'video'),
  constraint course_materials_pdf_ck check (fel <> 'pdf' or sursa = 'fisier')
);

comment on table public.course_materials is
  'Unitatea atomică refolosibilă a bibliotecii. Un regulament apare și în cursul de integrare, și în reluarea anuală — un singur rând, un singur adevăr. Binarul stă în versiuni, nu aici.';

create unique index course_materials_cod_uk
  on public.course_materials (organization_id, lower(btrim(cod))) where deleted_at is null;
create index course_materials_activ_idx
  on public.course_materials (organization_id, activ, fel) where deleted_at is null;
create index course_materials_created_by_idx on public.course_materials (created_by);
create index course_materials_updated_by_idx on public.course_materials (updated_by);

create table public.course_material_versions (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  material_id           uuid not null,
  versiune              smallint not null check (versiune between 1 and 500),
  fisier_path           text check (char_length(fisier_path) <= 1024),
  fisier_nume           text check (char_length(fisier_nume) between 1 and 255),
  fisier_marime_bytes   bigint check (fisier_marime_bytes is null or fisier_marime_bytes between 1 and 524288000),
  fisier_mime           text check (char_length(fisier_mime) <= 120),
  -- SHA-256 în hexazecimal. Coloana NU se poate numi `*_hash`:
  -- `internal.audit_forbidden_patterns()` conține '%hash%' și
  -- `internal.attach_audit` ridică P0001, deci migrarea nu s-ar aplica deloc.
  -- `checksum` trece — nu conține „hash".
  fisier_checksum       text check (fisier_checksum is null or fisier_checksum ~ '^[a-f0-9]{64}$'),
  subtitrare_path       text check (char_length(subtitrare_path) <= 1024),
  link_furnizor         public.curs_link_furnizor,
  link_id               text check (link_id is null or char_length(link_id) between 4 and 64),
  link_cod_privat       text check (link_cod_privat is null or link_cod_privat ~ '^[a-zA-Z0-9_-]{4,32}$'),
  durata_secunde        integer check (durata_secunde is null or durata_secunde between 1 and 86400),
  numar_pagini          smallint check (numar_pagini is null or numar_pagini between 1 and 5000),
  nota_versiune         text check (char_length(nota_versiune) <= 500),
  publicata_la          timestamptz,
  retrasa_la            timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references auth.users (id) on delete set null,
  updated_by            uuid references auth.users (id) on delete set null,
  deleted_at            timestamptz,
  unique (id, organization_id),
  foreign key (material_id, organization_id)
    references public.course_materials (id, organization_id) on delete cascade,
  -- Ori fișier, ori link. Niciodată amândouă (care ar fi adevărul?), niciodată
  -- niciunul (o versiune fără conținut nu e o versiune).
  constraint cmv_sursa_ck check (
       (fisier_path is not null and fisier_nume is not null and link_id is null and link_furnizor is null)
    or (link_id is not null and link_furnizor is not null and fisier_path is null)
  )
);

comment on column public.course_material_versions.link_cod_privat is
  'Codul care însoțește un film nelistat (Vimeo îl numește „unlisted hash"). Numele coloanei îl evită deliberat pe „hash": garda din internal.attach_audit respinge tabela întreagă.';
comment on column public.course_material_versions.durata_secunde is
  'Introdusă de administrator în formular, NU citită de la client la redare. Altfel numitorul dovezii măsurate ar fi ales chiar de cel măsurat.';

create unique index cmv_versiune_uk
  on public.course_material_versions (material_id, versiune) where deleted_at is null;
-- Fără el, fiecare cerere către ruta de livrare face seq scan pe cale.
create index cmv_path_idx
  on public.course_material_versions (fisier_path) where fisier_path is not null;
create index cmv_material_idx
  on public.course_material_versions (organization_id, material_id) where deleted_at is null;
create index cmv_created_by_idx on public.course_material_versions (created_by);
create index cmv_updated_by_idx on public.course_material_versions (updated_by);

alter table public.course_materials
  add constraint course_materials_versiune_curenta_fk
  foreign key (versiune_curenta_id, organization_id)
  references public.course_material_versions (id, organization_id) on delete set null;

create table public.course_items (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  course_id         uuid not null,
  material_id       uuid not null,
  ordine            smallint not null check (ordine between 1 and 500),
  obligatoriu       boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users (id) on delete set null,
  updated_by        uuid references auth.users (id) on delete set null,
  deleted_at        timestamptz,
  unique (id, organization_id),
  foreign key (course_id, organization_id)
    references public.courses (id, organization_id) on delete cascade,
  foreign key (material_id, organization_id)
    references public.course_materials (id, organization_id) on delete restrict
);

comment on table public.course_items is
  '„Lecția": ordinea și obligativitatea unui material într-un curs. Nu e un nivel de ierarhie în plus — e muchia dintre curs și material.';

-- Indexul NU e deferabil, deci reordonarea se face în trei pași cu parcare la
-- max+1, exact ca `mutaPas` din modulul de integrare.
create unique index course_items_ordine_uk
  on public.course_items (course_id, ordine) where deleted_at is null;
create unique index course_items_material_uk
  on public.course_items (course_id, material_id) where deleted_at is null;
create index course_items_created_by_idx on public.course_items (created_by);
create index course_items_updated_by_idx on public.course_items (updated_by);

-- =============================================================================
-- 3. Execuție: înrolări, itemi, dovadă
-- =============================================================================

create table public.course_enrollments (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  course_id             uuid not null,
  employee_id           uuid not null,
  ciclu                 smallint not null default 1 check (ciclu between 1 and 100),
  motiv                 public.curs_motiv not null default 'manual',
  status                public.curs_status not null default 'neinceput',
  atribuit_la           date not null default current_date,
  termen                date,
  inceput_la            timestamptz,
  finalizat_la          timestamptz,
  expira_la             date,
  materiale_total       smallint not null default 0 check (materiale_total >= 0),
  materiale_finalizate  smallint not null default 0 check (materiale_finalizate >= 0),
  anulat_la             timestamptz,
  motiv_anulare         text check (motiv_anulare is null or char_length(btrim(motiv_anulare)) between 5 and 500),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references auth.users (id) on delete set null,
  updated_by            uuid references auth.users (id) on delete set null,
  deleted_at            timestamptz,
  unique (id, organization_id),
  foreign key (course_id, organization_id)
    references public.courses (id, organization_id) on delete restrict,
  foreign key (employee_id, organization_id)
    references public.employees (id, organization_id) on delete restrict,
  constraint course_enrollments_finalizate_ck check (materiale_finalizate <= materiale_total)
);

comment on column public.course_enrollments.ciclu is
  'Al câtelea parcurs al aceluiași curs de către aceeași persoană. E în cheia unică tocmai ca recertificarea să poată reporni cursul fără să șteargă istoricul — același tipar ca `checklist_instances.ciclu`.';

create unique index course_enrollments_ciclu_uk
  on public.course_enrollments (organization_id, employee_id, course_id, ciclu) where deleted_at is null;
create index course_enrollments_angajat_idx
  on public.course_enrollments (organization_id, employee_id, status) where deleted_at is null;
create index course_enrollments_termen_idx
  on public.course_enrollments (organization_id, termen)
  where deleted_at is null and status in ('neinceput', 'in_curs');
-- Indexul recertificării: jobul zilnic caută exact această felie.
create index course_enrollments_expira_idx
  on public.course_enrollments (organization_id, expira_la)
  where deleted_at is null and status = 'finalizat' and expira_la is not null;
create index course_enrollments_created_by_idx on public.course_enrollments (created_by);
create index course_enrollments_updated_by_idx on public.course_enrollments (updated_by);

create table public.course_enrollment_items (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  enrollment_id       uuid not null,
  employee_id         uuid not null,
  course_item_id      uuid,
  material_id         uuid not null,
  version_id          uuid,
  ordine              smallint not null check (ordine between 1 and 500),
  -- Contractul pedagogic, COPIAT la materializare. Un material redenumit sau
  -- cu treapta schimbată n-are voie să rescrie ce a parcurs omul anul trecut.
  titlu               text not null check (char_length(btrim(titlu)) between 2 and 200),
  fel                 public.curs_material_fel not null,
  obligatoriu         boolean not null default true,
  treapta_dovada      public.curs_treapta_dovada not null,
  procent_minim       smallint check (procent_minim is null or procent_minim between 1 and 100),
  prag_test           numeric(5,2) check (prag_test is null or prag_test between 0 and 100),
  declaratie_text     text check (char_length(declaratie_text) <= 4000),
  durata_secunde      integer check (durata_secunde is null or durata_secunde between 1 and 86400),
  -- Stare și progres. Singurele coloane pe care angajatul are `grant update`.
  status              public.curs_item_status not null default 'neinceput',
  secunde_vizionate   integer not null default 0 check (secunde_vizionate >= 0),
  pozitie_secunde     integer not null default 0 check (pozitie_secunde >= 0),
  heartbeat_la        timestamptz,
  deschis_la          timestamptz,
  -- Dovada.
  finalizat_la        timestamptz,
  semnatura_nume      text check (semnatura_nume is null or char_length(btrim(semnatura_nume)) between 3 and 160),
  semnat_la           timestamptz,
  semnatura_ip        inet,
  observatii          text check (char_length(observatii) <= 1000),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references auth.users (id) on delete set null,
  updated_by          uuid references auth.users (id) on delete set null,
  deleted_at          timestamptz,
  unique (id, organization_id),
  foreign key (enrollment_id, organization_id)
    references public.course_enrollments (id, organization_id) on delete cascade,
  foreign key (employee_id, organization_id)
    references public.employees (id, organization_id) on delete restrict,
  foreign key (course_item_id, organization_id)
    references public.course_items (id, organization_id) on delete set null,
  foreign key (material_id, organization_id)
    references public.course_materials (id, organization_id) on delete restrict,
  foreign key (version_id, organization_id)
    references public.course_material_versions (id, organization_id) on delete restrict
);

comment on column public.course_enrollment_items.version_id is
  'Versiunea PINUITĂ la materializare. Dacă administratorul publică o versiune nouă a materialului, omul continuă pe cea pe care a început-o, iar semnătura rămâne ancorată de ea. `on delete restrict` protejează dovada.';
comment on column public.course_enrollment_items.secunde_vizionate is
  'Secunde acumulate, clampate pe ceasul serverului la fiecare heartbeat. Măsură de bună-credință, NU dovadă rezistentă la falsificare: evenimentul vine din client. Greutatea probatorie stă în treptele `test` și `declaratie`.';

create unique index course_enrollment_items_ordine_uk
  on public.course_enrollment_items (enrollment_id, ordine) where deleted_at is null;
create index course_enrollment_items_angajat_idx
  on public.course_enrollment_items (organization_id, employee_id, status) where deleted_at is null;
create index course_enrollment_items_versiune_idx
  on public.course_enrollment_items (organization_id, version_id) where deleted_at is null;
create index course_enrollment_items_material_idx
  on public.course_enrollment_items (organization_id, material_id) where deleted_at is null;
create index course_enrollment_items_created_by_idx on public.course_enrollment_items (created_by);
create index course_enrollment_items_updated_by_idx on public.course_enrollment_items (updated_by);

-- Dovada. Fără `deleted_at`, fără UPDATE, fără DELETE — nici prin politică,
-- nici prin privilegiu. Un `.is("deleted_at", null)` pe ea dă 42703; e
-- deliberat, ca tiparul `checklist_completion_records`.
create table public.course_completion_records (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  enrollment_id         uuid not null unique,
  employee_id           uuid not null,
  course_id             uuid not null,
  ciclu                 smallint not null,
  finalizat_la          timestamptz not null,
  expira_la             date,
  total_materiale       smallint not null,
  materiale_finalizate  smallint not null,
  continut              jsonb not null,
  continut_checksum     text not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references auth.users (id) on delete set null,
  updated_by            uuid references auth.users (id) on delete set null,
  unique (id, organization_id),
  foreign key (enrollment_id, organization_id)
    references public.course_enrollments (id, organization_id) on delete restrict
);

comment on table public.course_completion_records is
  'Dovada de parcurgere, imutabilă. `continut` păstrează instantaneul lecțiilor cu versiunea și treapta la momentul finalizării, iar `continut_checksum` (md5 peste jsonb-ul canonic) face vizibilă orice atingere ulterioară.';

create index course_completion_records_angajat_idx
  on public.course_completion_records (organization_id, employee_id, finalizat_la desc);
create index course_completion_records_curs_idx
  on public.course_completion_records (organization_id, course_id);
create index course_completion_records_created_by_idx on public.course_completion_records (created_by);
create index course_completion_records_updated_by_idx on public.course_completion_records (updated_by);

-- =============================================================================
-- 4. Ajutoare de autorizare (app.*)
-- =============================================================================
-- Toate `stable security definer set search_path = ''`: răspund la întrebarea
-- „materialul ăsta îi este atribuit celui care întreabă?" fără să depindă de
-- drepturile lui de citire pe catalog, care sunt tocmai ce încearcă să decidă.

create or replace function app.curs_material_atribuit(p_org uuid, p_material_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.course_enrollment_items i
    join public.course_enrollments e
      on e.id = i.enrollment_id and e.deleted_at is null
    where i.organization_id = p_org
      and i.material_id = p_material_id
      and i.deleted_at is null
      and i.employee_id = app.current_employee_id(p_org)
      and e.status <> 'anulat'
  );
$$;

create or replace function app.curs_versiune_atribuita(p_org uuid, p_version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.course_enrollment_items i
    join public.course_enrollments e
      on e.id = i.enrollment_id and e.deleted_at is null
    where i.organization_id = p_org
      and i.version_id = p_version_id
      and i.deleted_at is null
      and i.employee_id = app.current_employee_id(p_org)
      and e.status <> 'anulat'
  );
$$;

create or replace function app.curs_este_inrolat(p_org uuid, p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.course_enrollments e
    where e.organization_id = p_org
      and e.course_id = p_course_id
      and e.deleted_at is null
      and e.employee_id = app.current_employee_id(p_org)
      and e.status <> 'anulat'
  );
$$;

-- Poarta de citire din Storage. `app.can_path` singură nu ajunge: la scope
-- `own` ea cere ca segmentul 3 să fie contul sau fișa persoanei, dar segmentul
-- 3 al unei căi de curs e `material_id` — fișierul aparține bibliotecii, nu
-- unei persoane. Deci a doua ramură, ancorată pe înrolare.
create or replace function app.curs_obiect_atribuit(p_org uuid, p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.course_material_versions v
    join public.course_enrollment_items i
      on i.version_id = v.id and i.deleted_at is null
    join public.course_enrollments e
      on e.id = i.enrollment_id and e.deleted_at is null
    where v.organization_id = p_org
      and v.deleted_at is null
      and (v.fisier_path = p_name or v.subtitrare_path = p_name)
      and i.employee_id = app.current_employee_id(p_org)
      and e.status <> 'anulat'
  );
$$;

revoke all on function app.curs_material_atribuit(uuid, uuid)  from public, anon;
revoke all on function app.curs_versiune_atribuita(uuid, uuid) from public, anon;
revoke all on function app.curs_este_inrolat(uuid, uuid)       from public, anon;
revoke all on function app.curs_obiect_atribuit(uuid, text)    from public, anon;
grant execute on function app.curs_material_atribuit(uuid, uuid)  to authenticated, service_role;
grant execute on function app.curs_versiune_atribuita(uuid, uuid) to authenticated, service_role;
grant execute on function app.curs_este_inrolat(uuid, uuid)       to authenticated, service_role;
grant execute on function app.curs_obiect_atribuit(uuid, text)    to authenticated, service_role;

-- =============================================================================
-- 5. Triggere
-- =============================================================================

create or replace function internal.cursuri_atinge()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Pregătirea înrolării: baza decide ciclul, termenul și starea inițială, nu
-- clientul. Refuză un curs nepublicat sau fără nicio lecție — altfel s-ar naște
-- o înrolare cu `materiale_total = 0`, care nu se poate închide niciodată și
-- ar face recalculul să împartă la zero.
create or replace function internal.cursuri_pregateste_inrolarea()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_curs   public.courses%rowtype;
  v_lectii integer;
begin
  select * into v_curs
  from public.courses
  where id = new.course_id and organization_id = new.organization_id and deleted_at is null;

  if not found then
    raise exception 'Cursul nu există în această organizație.' using errcode = 'P0001';
  end if;
  if not v_curs.activ then
    raise exception 'Cursul „%" este dezactivat și nu poate fi atribuit.', v_curs.denumire using errcode = 'P0001';
  end if;
  if not v_curs.publicat then
    raise exception 'Cursul „%" nu este publicat. Publicați-l înainte de a-l atribui.', v_curs.denumire using errcode = 'P0001';
  end if;

  select count(*) into v_lectii
  from public.course_items
  where course_id = new.course_id and deleted_at is null;

  if v_lectii = 0 then
    raise exception 'Cursul „%" nu are nicio lecție și nu poate fi atribuit.', v_curs.denumire using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.employees
    where id = new.employee_id and organization_id = new.organization_id and deleted_at is null
  ) then
    raise exception 'Angajatul nu există în această organizație.' using errcode = 'P0001';
  end if;

  select coalesce(max(ciclu), 0) + 1 into new.ciclu
  from public.course_enrollments
  where organization_id = new.organization_id
    and employee_id = new.employee_id
    and course_id = new.course_id
    and deleted_at is null;

  new.status               := 'neinceput';
  new.materiale_total      := v_lectii;
  new.materiale_finalizate := 0;
  new.inceput_la           := null;
  new.finalizat_la         := null;
  new.expira_la            := null;
  new.anulat_la            := null;
  new.motiv_anulare        := null;
  new.termen               := coalesce(new.termen, new.atribuit_la + v_curs.termen_zile);
  return new;
end;
$$;

-- Materializarea lecțiilor + notificarea, în aceeași tranzacție cu înrolarea.
-- `security definer` fiindcă scrie rânduri derivate: dacă ar rula sub RLS-ul
-- celui care atribuie, un manager cu `team` n-ar putea insera itemii altcuiva.
create or replace function internal.cursuri_materializeaza()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_denumire text;
  v_user     uuid;
begin
  insert into public.course_enrollment_items (
    organization_id, enrollment_id, employee_id, course_item_id, material_id, version_id,
    ordine, titlu, fel, obligatoriu, treapta_dovada, procent_minim, prag_test,
    declaratie_text, durata_secunde, created_by, updated_by
  )
  select
    new.organization_id, new.id, new.employee_id, ci.id, m.id, m.versiune_curenta_id,
    ci.ordine, m.titlu, m.fel, ci.obligatoriu, m.treapta_dovada, m.procent_minim, m.prag_test,
    m.declaratie_text, v.durata_secunde, new.created_by, new.created_by
  from public.course_items ci
  join public.course_materials m
    on m.id = ci.material_id and m.deleted_at is null
  left join public.course_material_versions v
    on v.id = m.versiune_curenta_id and v.deleted_at is null
  where ci.course_id = new.course_id
    and ci.deleted_at is null
  order by ci.ordine;

  select c.denumire into v_denumire from public.courses c where c.id = new.course_id;

  select e.user_id into v_user
  from public.employees e
  where e.id = new.employee_id and e.deleted_at is null;

  -- Fără cont de utilizator nu există cui să-i trimiți: fișa există, omul nu
  -- s-a autentificat niciodată. Nu e o eroare, e o firmă în curs de populare.
  if v_user is not null then
    insert into public.notifications (user_id, organization_id, kind, title, body, link, entity_type, entity_id)
    values (
      v_user, new.organization_id, 'task',
      'Aveți un curs de parcurs: ' || coalesce(v_denumire, 'curs'),
      case when new.termen is null then null
           else 'Termen: ' || to_char(new.termen, 'DD.MM.YYYY') || '.' end,
      '/portal/cursurile-mele/' || new.id::text,
      'course_enrollments', new.id
    );
  end if;

  return null;
end;
$$;

-- Progresul unei lecții. Rulează SECURITY INVOKER deliberat: are nevoie să
-- vadă cine e apelantul real, iar `app.can` într-o funcție definer ar citi
-- proprietarul funcției, nu omul.
--
-- Trei ramuri, în ordinea încrederii:
--   1. context de serviciu — acțiunea noastră de semnătură, care scrie IP-ul
--      din antetul cererii (clientul nu-l poate falsifica fiindcă nu ajunge la
--      coloană: nu e în `grant update`);
--   2. `courses:update >= team` — administrator sau manager care bifează în
--      locul cuiva;
--   3. restul, adică angajatul pe propria lecție: contractul pedagogic se
--      RESTAUREAZĂ din OLD, secundele se clampează pe ceasul serverului, iar
--      finalizarea se acordă numai dacă dovada o susține.
create or replace function internal.cursuri_progres()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_privilegiat boolean;
  v_scurs       integer;
  v_necesar     integer;
begin
  v_privilegiat := app.is_service_context()
                or app.can(new.organization_id, 'courses', 'update', 'team');

  if not v_privilegiat then
    -- Prima barieră e `grant update` pe coloane, în secțiunea de drepturi.
    -- Asta e a doua: chiar dacă privilegiile ar fi lărgite din greșeală într-o
    -- migrare viitoare, contractul rămâne cel materializat la înrolare.
    new.enrollment_id   := old.enrollment_id;
    new.employee_id     := old.employee_id;
    new.course_item_id  := old.course_item_id;
    new.material_id     := old.material_id;
    new.version_id      := old.version_id;
    new.ordine          := old.ordine;
    new.titlu           := old.titlu;
    new.fel             := old.fel;
    new.obligatoriu     := old.obligatoriu;
    new.treapta_dovada  := old.treapta_dovada;
    new.procent_minim   := old.procent_minim;
    new.prag_test       := old.prag_test;
    new.declaratie_text := old.declaratie_text;
    new.durata_secunde  := old.durata_secunde;
    new.finalizat_la    := old.finalizat_la;
    new.semnat_la       := old.semnat_la;
    new.semnatura_ip    := old.semnatura_ip;
    new.deleted_at      := old.deleted_at;

    -- Parcurs o dată, parcurs pentru totdeauna: retragerea unei finalizări e
    -- gestul unui administrator, nu al celui evaluat.
    if old.status = 'finalizat' and new.status <> 'finalizat' then
      new.status := old.status;
    end if;

    -- Secundele acumulate nu pot crește mai repede decât trece timpul. Un
    -- client care trimite +3600 la fiecare heartbeat rămâne cu diferența reală.
    if new.secunde_vizionate > old.secunde_vizionate then
      v_scurs := greatest(
        1,
        ceil(extract(epoch from (now() - coalesce(old.heartbeat_la, old.deschis_la, now() - interval '1 minute'))))::integer
      );
      new.secunde_vizionate := least(new.secunde_vizionate, old.secunde_vizionate + v_scurs + 5);
    end if;
    if new.durata_secunde is not null then
      new.secunde_vizionate := least(new.secunde_vizionate, new.durata_secunde);
      new.pozitie_secunde   := least(new.pozitie_secunde, new.durata_secunde);
    end if;

    if new.status = 'finalizat' and old.status <> 'finalizat' then
      if new.treapta_dovada = 'parcurgere' then
        if new.durata_secunde is null then
          raise exception 'Lecția „%" nu are durata configurată, deci parcurgerea nu poate fi măsurată. Anunțați administratorul.', new.titlu using errcode = 'P0001';
        end if;
        v_necesar := ceil(new.durata_secunde * new.procent_minim / 100.0)::integer;
        if new.secunde_vizionate < v_necesar then
          raise exception 'Mai aveți de parcurs din „%": % din % secunde.', new.titlu, new.secunde_vizionate, v_necesar using errcode = 'P0001';
        end if;
      elsif new.treapta_dovada = 'declaratie' then
        if coalesce(btrim(new.semnatura_nume), '') = '' then
          raise exception 'Lecția „%" cere o declarație asumată înainte de finalizare.', new.titlu using errcode = 'P0001';
        end if;
      elsif new.treapta_dovada = 'test' then
        raise exception 'Lecția „%" cere un test care nu este încă disponibil. Anunțați administratorul.', new.titlu using errcode = 'P0001';
      end if;
    end if;
  end if;

  if new.semnatura_nume is not null and old.semnatura_nume is null then
    new.semnat_la := coalesce(new.semnat_la, now());
  end if;
  if new.status = 'finalizat' and old.status <> 'finalizat' then
    new.finalizat_la := coalesce(new.finalizat_la, now());
  end if;
  if new.status <> 'neinceput' and old.status = 'neinceput' then
    new.deschis_la := coalesce(new.deschis_la, now());
  end if;
  new.heartbeat_la := now();
  new.updated_at   := now();
  return new;
end;
$$;

-- Recalcularea înrolării din itemi. `security definer` fiindcă rulează în
-- numele angajatului, care NU are niciun drept de scriere pe `course_enrollments`
-- — și nici nu trebuie să aibă: starea cursului e derivată, nu declarată.
-- Sub INVOKER, UPDATE-ul ar fi afectat ZERO RÂNDURI, FĂRĂ EROARE, iar cursul ar
-- fi rămas „în curs" pe veci. E capcana 17 din `capcane.md`, aplicată invers.
create or replace function internal.cursuri_recalculeaza()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total       integer;
  v_gata        integer;
  v_obligatorii integer;
  v_stare       public.curs_status;
  v_valabil     smallint;
begin
  select count(*),
         count(*) filter (where status = 'finalizat'),
         count(*) filter (where obligatoriu and status <> 'finalizat')
    into v_total, v_gata, v_obligatorii
  from public.course_enrollment_items
  where enrollment_id = new.enrollment_id and deleted_at is null;

  if v_obligatorii = 0 and v_total > 0 then
    v_stare := 'finalizat';
  elsif v_gata > 0 then
    v_stare := 'in_curs';
  else
    v_stare := 'neinceput';
  end if;

  select c.valabilitate_luni into v_valabil
  from public.course_enrollments e
  join public.courses c on c.id = e.course_id
  where e.id = new.enrollment_id;

  perform set_config('app.cursuri_recalculare', 'on', true);
  update public.course_enrollments e
     set materiale_total      = v_total,
         materiale_finalizate = v_gata,
         status               = v_stare,
         inceput_la           = coalesce(e.inceput_la, case when v_stare <> 'neinceput' then now() end),
         finalizat_la         = case when v_stare = 'finalizat' then coalesce(e.finalizat_la, now()) else null end,
         expira_la            = case
                                  when v_stare = 'finalizat' and v_valabil is not null
                                  then (coalesce(e.finalizat_la, now()) + make_interval(months => v_valabil))::date
                                  else null
                                end,
         updated_at           = now()
   where e.id = new.enrollment_id
     and e.status not in ('anulat', 'expirat');
  perform set_config('app.cursuri_recalculare', 'off', true);

  return null;
end;
$$;

-- Poarta de scriere pe înrolare. Recalcularea de mai sus ridică un steag
-- tranzacțional înainte să scrie — același mecanism ca `app.sincronizare_expirari`
-- din 0008 — pentru că altfel triggerul definer, rulând în sesiunea angajatului,
-- ar fi fost respins de propria gardă.
create or replace function internal.cursuri_protejeaza_inrolarea()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.cursuri_recalculare', true), 'off') = 'on' then
    new.updated_at := now();
    return new;
  end if;

  if not (app.is_service_context() or app.can(new.organization_id, 'courses', 'update', 'team')) then
    -- Angajatul nu are `grant update` pe această tabelă, deci ajungem aici doar
    -- dacă privilegiile au fost lărgite din greșeală. Mesajul e explicit tocmai
    -- ca defectul să nu fie tăcut.
    raise exception 'Nu aveți dreptul de a modifica o înrolare la curs.' using errcode = 'P0001';
  end if;

  if old.status in ('finalizat', 'anulat') and new.status = 'in_curs' then
    raise exception 'O înrolare finalizată sau anulată nu se poate redeschide. Atribuiți cursul din nou.' using errcode = 'P0001';
  end if;
  if new.status = 'anulat' and coalesce(btrim(new.motiv_anulare), '') = '' then
    raise exception 'Anularea unei înrolări cere un motiv.' using errcode = 'P0001';
  end if;
  if new.course_id <> old.course_id or new.employee_id <> old.employee_id or new.ciclu <> old.ciclu then
    raise exception 'Cursul, angajatul și ciclul unei înrolări nu se pot schimba.' using errcode = 'P0001';
  end if;

  if new.status = 'anulat' and old.status <> 'anulat' then
    new.anulat_la := coalesce(new.anulat_la, now());
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Dovada imutabilă, scrisă de bază în clipa finalizării. `security definer`:
-- angajatul nu are — și nu trebuie să aibă — drept de INSERT pe tabela de
-- dovezi. Altfel ar fi putut scrie el rândul, cu ce cifre voia.
create or replace function internal.cursuri_dovada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_continut jsonb;
begin
  select jsonb_build_object(
           'curs', jsonb_build_object('cod', c.cod, 'denumire', c.denumire, 'obligatoriu', c.obligatoriu),
           'angajat', jsonb_build_object('id', new.employee_id::text, 'nume', app.checklist_nume_angajat(new.organization_id, new.employee_id)),
           'ciclu', new.ciclu,
           'finalizat_la', to_char(coalesce(new.finalizat_la, now()) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
           'lectii', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'ordine', i.ordine,
                      'titlu', i.titlu,
                      'fel', i.fel::text,
                      'treapta', i.treapta_dovada::text,
                      'versiune_id', i.version_id::text,
                      'amprenta', v.fisier_checksum,
                      'finalizat_la', to_char(i.finalizat_la at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                      'semnatura', i.semnatura_nume
                    ) order by i.ordine)
             from public.course_enrollment_items i
             left join public.course_material_versions v on v.id = i.version_id
             where i.enrollment_id = new.id and i.deleted_at is null
           ), '[]'::jsonb)
         )
    into v_continut
  from public.courses c
  where c.id = new.course_id;

  insert into public.course_completion_records (
    organization_id, enrollment_id, employee_id, course_id, ciclu,
    finalizat_la, expira_la, total_materiale, materiale_finalizate,
    continut, continut_checksum, created_by, updated_by
  ) values (
    new.organization_id, new.id, new.employee_id, new.course_id, new.ciclu,
    coalesce(new.finalizat_la, now()), new.expira_la, new.materiale_total, new.materiale_finalizate,
    v_continut, md5(v_continut::text), new.updated_by, new.updated_by
  )
  on conflict (enrollment_id) do nothing;

  return null;
end;
$$;

create or replace function internal.cursuri_blocheaza_dovada()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Dovada de parcurgere este imutabilă: nu se modifică și nu se șterge.' using errcode = 'P0001';
end;
$$;

-- O versiune publicată nu-și mai schimbă binarul: dovada o ancorează prin
-- `version_id`, iar un fișier schimbat sub aceeași versiune ar face semnătura
-- să nu mai însemne nimic. Versiune nouă = rând nou.
create or replace function internal.cursuri_versiune_imutabila()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.publicata_la is not null and (
       new.fisier_path is distinct from old.fisier_path
    or new.fisier_checksum is distinct from old.fisier_checksum
    or new.link_id is distinct from old.link_id
    or new.link_furnizor is distinct from old.link_furnizor
    or new.versiune is distinct from old.versiune
  ) then
    raise exception 'Versiunea % este publicată: conținutul ei nu se mai poate schimba. Publicați o versiune nouă.', old.versiune using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Un material folosit de cineva care încă are cursul de parcurs nu se retrage:
-- omul ar rămâne cu o lecție fără conținut și fără explicație.
create or replace function internal.cursuri_protejeaza_catalogul()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_cati integer;
begin
  if new.deleted_at is not null and old.deleted_at is null then
    select count(distinct i.employee_id) into v_cati
    from public.course_enrollment_items i
    join public.course_enrollments e on e.id = i.enrollment_id and e.deleted_at is null
    where i.material_id = new.id
      and i.deleted_at is null
      and e.status in ('neinceput', 'in_curs');

    if v_cati > 0 then
      raise exception 'Materialul „%" este în curs de parcurgere de % persoane. Dezactivați-l în loc să-l ștergeți.', old.titlu, v_cati using errcode = 'P0001';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Angajat plecat: înrolările nefinalizate se anulează, ca listele de restanțe
-- și matricea de conformitate să nu numere oameni care nu mai sunt în firmă.
create or replace function internal.cursuri_angajat_inactiv()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = old.status then
    return null;
  end if;
  if new.status in ('activ', 'suspendat', 'preaviz') then
    return null;
  end if;

  perform set_config('app.cursuri_recalculare', 'on', true);
  update public.course_enrollments
     set status = 'anulat',
         anulat_la = now(),
         motiv_anulare = 'Angajatul nu mai este activ în organizație.',
         updated_at = now()
   where employee_id = new.id
     and organization_id = new.organization_id
     and deleted_at is null
     and status in ('neinceput', 'in_curs');
  perform set_config('app.cursuri_recalculare', 'off', true);
  return null;
end;
$$;

-- Reamintirile și recertificarea. Fără scheduler propriu: `pg_cron` e deja
-- activat în acest proiect (0042_pontaj_saptamanal_notificari.sql), iar
-- notificările au deja tabelă, ecran în portal și trimitere pe email.
create or replace function internal.cursuri_reaminteste()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scrise integer := 0;
begin
  with tinta as (
    select e.id, e.organization_id, e.termen, c.denumire, emp.user_id,
           (e.termen - current_date) as zile
    from public.course_enrollments e
    join public.courses c   on c.id = e.course_id
    join public.employees emp on emp.id = e.employee_id and emp.deleted_at is null
    where e.deleted_at is null
      and e.status in ('neinceput', 'in_curs')
      and e.termen is not null
      and emp.user_id is not null
      and emp.status in ('activ', 'suspendat', 'preaviz')
      and (e.termen - current_date) in (7, 1, 0, -1, -7)
      and app.feature_on(e.organization_id, 'courses')
  ),
  noi as (
    select t.* from tinta t
    -- Deduplicare pe 20 de ore: jobul rulează zilnic, dar o repornire manuală
    -- n-are voie să dubleze notificarea. Același tipar ca la pontajul săptămânal.
    where not exists (
      select 1 from public.notifications n
      where n.user_id = t.user_id
        and n.entity_type = 'course_enrollments'
        and n.entity_id = t.id
        and n.kind = 'reminder'
        and n.created_at > now() - interval '20 hours'
    )
  )
  insert into public.notifications (user_id, organization_id, kind, title, body, link, entity_type, entity_id)
  select n.user_id, n.organization_id, 'reminder',
         case when n.zile < 0 then 'Curs restant: ' || n.denumire
              when n.zile = 0 then 'Ultima zi pentru cursul: ' || n.denumire
              else 'Termen apropiat pentru cursul: ' || n.denumire end,
         case when n.zile < 0 then 'Termenul a trecut pe ' || to_char(n.termen, 'DD.MM.YYYY') || '.'
              when n.zile = 0 then 'Termenul este astăzi.'
              else 'Mai aveți ' || n.zile || ' zile.' end,
         '/portal/cursurile-mele/' || n.id::text,
         'course_enrollments', n.id
  from noi n;

  get diagnostics v_scrise = row_count;
  return v_scrise;
end;
$$;

-- Recertificarea: o înrolare finalizată care și-a depășit valabilitatea trece
-- în `expirat`, iar ciclul următor se deschide. Idempotentă prin cheia unică
-- pe (organizație, angajat, curs, ciclu): o a doua rulare în aceeași zi nu
-- poate crea un duplicat.
create or replace function internal.cursuri_recertifica()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rand   record;
  v_facute integer := 0;
begin
  for v_rand in
    select e.id, e.organization_id, e.course_id, e.employee_id
    from public.course_enrollments e
    join public.employees emp on emp.id = e.employee_id and emp.deleted_at is null
    where e.deleted_at is null
      and e.status = 'finalizat'
      and e.expira_la is not null
      and e.expira_la <= current_date
      and emp.status in ('activ', 'suspendat', 'preaviz')
      and app.feature_on(e.organization_id, 'courses')
  loop
    perform set_config('app.cursuri_recalculare', 'on', true);
    update public.course_enrollments set status = 'expirat', updated_at = now() where id = v_rand.id;
    perform set_config('app.cursuri_recalculare', 'off', true);

    begin
      insert into public.course_enrollments (organization_id, course_id, employee_id, motiv)
      values (v_rand.organization_id, v_rand.course_id, v_rand.employee_id, 'recertificare');
      v_facute := v_facute + 1;
    exception
      -- Cursul a fost între timp depublicat, dezactivat sau golit de lecții.
      -- Expirarea rămâne consemnată; redeschiderea o face administratorul.
      when others then null;
    end;
  end loop;
  return v_facute;
end;
$$;

revoke all on function internal.cursuri_reaminteste()  from public, anon, authenticated;
revoke all on function internal.cursuri_recertifica()  from public, anon, authenticated;

-- =============================================================================
-- 6. Legarea triggerelor
-- =============================================================================

create trigger trg_courses_10_atinge
  before update on public.courses
  for each row execute function internal.cursuri_atinge();

create trigger trg_course_items_10_atinge
  before update on public.course_items
  for each row execute function internal.cursuri_atinge();

create trigger trg_course_materials_10_protejeaza
  before update on public.course_materials
  for each row execute function internal.cursuri_protejeaza_catalogul();

create trigger trg_course_material_versions_10_imutabil
  before update on public.course_material_versions
  for each row execute function internal.cursuri_versiune_imutabila();

create trigger trg_course_enrollments_10_pregatire
  before insert on public.course_enrollments
  for each row execute function internal.cursuri_pregateste_inrolarea();

create trigger trg_course_enrollments_20_protejeaza
  before update on public.course_enrollments
  for each row execute function internal.cursuri_protejeaza_inrolarea();

create trigger trg_course_enrollments_30_materializeaza
  after insert on public.course_enrollments
  for each row execute function internal.cursuri_materializeaza();

-- Clauza `when` e cea care exprimă „s-a schimbat"; `of status` doar restrânge
-- declanșarea. Fără ea, triggerul ar rula la fiecare heartbeat de vizionare.
create trigger trg_course_enrollments_40_dovada
  after update of status on public.course_enrollments
  for each row
  when (new.status = 'finalizat' and old.status is distinct from 'finalizat')
  execute function internal.cursuri_dovada();

create trigger trg_course_enrollment_items_10_progres
  before update on public.course_enrollment_items
  for each row execute function internal.cursuri_progres();

create trigger trg_course_enrollment_items_20_recalc
  after update of status on public.course_enrollment_items
  for each row
  when (new.status is distinct from old.status)
  execute function internal.cursuri_recalculeaza();

create trigger trg_course_completion_records_90_imutabil
  before update or delete on public.course_completion_records
  for each row execute function internal.cursuri_blocheaza_dovada();

create trigger trg_employees_70_cursuri
  after update of status on public.employees
  for each row execute function internal.cursuri_angajat_inactiv();

-- =============================================================================
-- 7. RLS
-- =============================================================================
-- Prefixul comun apare în USING **și** în WITH CHECK peste tot.
-- `checklist_templates_update` (0014:729) îl omite din WITH CHECK — capcană
-- verificată în acest repo, nu se repetă aici.
--
-- Pe tabelele de catalog pragul e `team`, nu `all`: o tabelă fără `employee_id`
-- n-are ce îngusta un scope `team`, deci a cere `all` ar fi un prag arbitrar
-- care exclude managerul din propriul modul — exact defectul `checklists`.

alter table public.courses                   enable row level security;
alter table public.courses                   force  row level security;
alter table public.course_materials          enable row level security;
alter table public.course_materials          force  row level security;
alter table public.course_material_versions  enable row level security;
alter table public.course_material_versions  force  row level security;
alter table public.course_items              enable row level security;
alter table public.course_items              force  row level security;
alter table public.course_enrollments        enable row level security;
alter table public.course_enrollments        force  row level security;
alter table public.course_enrollment_items   enable row level security;
alter table public.course_enrollment_items   force  row level security;
alter table public.course_completion_records enable row level security;
alter table public.course_completion_records force  row level security;

-- ── Catalog ─────────────────────────────────────────────────────────────────
-- Ramura `own` a angajatului nu e comoditate: fără ea primește înrolarea dar nu
-- poate citi materialul, deci vede un ecran gol FĂRĂ NICIO EROARE.

create policy courses_select on public.courses for select to authenticated
using (
  app.is_platform_admin()
  or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'courses')
    and (
      app.can(organization_id, 'courses', 'read', 'team')
      or (app.can(organization_id, 'courses', 'read', 'own') and app.curs_este_inrolat(organization_id, id))
    )
  )
);

create policy courses_insert on public.courses for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'courses')
  and app.can(organization_id, 'courses', 'create', 'team')
  and deleted_at is null
);

create policy courses_update on public.courses for update to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'courses')
  and app.can(organization_id, 'courses', 'update', 'team')
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'courses')
  and app.can(organization_id, 'courses', 'update', 'team')
);

create policy course_materials_select on public.course_materials for select to authenticated
using (
  app.is_platform_admin()
  or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'courses')
    and (
      app.can(organization_id, 'courses', 'read', 'team')
      or (app.can(organization_id, 'courses', 'read', 'own') and app.curs_material_atribuit(organization_id, id))
    )
  )
);

create policy course_materials_insert on public.course_materials for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'courses')
  and app.can(organization_id, 'courses', 'create', 'team')
  and deleted_at is null
);

create policy course_materials_update on public.course_materials for update to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'courses')
  and app.can(organization_id, 'courses', 'update', 'team')
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'courses')
  and app.can(organization_id, 'courses', 'update', 'team')
);

create policy course_material_versions_select on public.course_material_versions for select to authenticated
using (
  app.is_platform_admin()
  or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'courses')
    and (
      app.can(organization_id, 'courses', 'read', 'team')
      or (app.can(organization_id, 'courses', 'read', 'own') and app.curs_versiune_atribuita(organization_id, id))
    )
  )
);

create policy course_material_versions_insert on public.course_material_versions for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'courses')
  and app.can(organization_id, 'courses', 'create', 'team')
  and deleted_at is null
);

create policy course_material_versions_update on public.course_material_versions for update to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'courses')
  and app.can(organization_id, 'courses', 'update', 'team')
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'courses')
  and app.can(organization_id, 'courses', 'update', 'team')
);

create policy course_items_select on public.course_items for select to authenticated
using (
  app.is_platform_admin()
  or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'courses')
    and (
      app.can(organization_id, 'courses', 'read', 'team')
      or (app.can(organization_id, 'courses', 'read', 'own') and app.curs_este_inrolat(organization_id, course_id))
    )
  )
);

create policy course_items_insert on public.course_items for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'courses')
  and app.can(organization_id, 'courses', 'create', 'team')
  and deleted_at is null
);

create policy course_items_update on public.course_items for update to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'courses')
  and app.can(organization_id, 'courses', 'update', 'team')
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'courses')
  and app.can(organization_id, 'courses', 'update', 'team')
);

-- ── Execuție ────────────────────────────────────────────────────────────────

create policy course_enrollments_select on public.course_enrollments for select to authenticated
using (
  app.is_platform_admin()
  or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'courses')
    and (
      app.has_permission(organization_id, 'courses', 'read') = 'all'
      or (app.can(organization_id, 'courses', 'read', 'team') and app.is_manager_of(organization_id, employee_id))
      or (app.can(organization_id, 'courses', 'read', 'own') and employee_id = app.current_employee_id(organization_id))
    )
  )
);

create policy course_enrollments_insert on public.course_enrollments for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'courses')
  and (
    app.has_permission(organization_id, 'courses', 'create') = 'all'
    or (app.can(organization_id, 'courses', 'create', 'team') and app.is_manager_of(organization_id, employee_id))
  )
  and deleted_at is null
);

-- Fără ramură `own`: starea înrolării e derivată din itemi și o scrie triggerul
-- `internal.cursuri_recalculeaza`, care e `security definer` și ocolește RLS.
-- Angajatul n-are nici politică, nici `grant update` pe această tabelă.
create policy course_enrollments_update on public.course_enrollments for update to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'courses')
  and (
    app.has_permission(organization_id, 'courses', 'update') = 'all'
    or (app.can(organization_id, 'courses', 'update', 'team') and app.is_manager_of(organization_id, employee_id))
  )
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'courses')
  and (
    app.has_permission(organization_id, 'courses', 'update') = 'all'
    or (app.can(organization_id, 'courses', 'update', 'team') and app.is_manager_of(organization_id, employee_id))
  )
);

create policy course_enrollment_items_select on public.course_enrollment_items for select to authenticated
using (
  app.is_platform_admin()
  or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'courses')
    and (
      app.has_permission(organization_id, 'courses', 'read') = 'all'
      or (app.can(organization_id, 'courses', 'read', 'team') and app.is_manager_of(organization_id, employee_id))
      or (app.can(organization_id, 'courses', 'read', 'own') and employee_id = app.current_employee_id(organization_id))
    )
  )
);

create policy course_enrollment_items_update on public.course_enrollment_items for update to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'courses')
  and (
    app.has_permission(organization_id, 'courses', 'update') = 'all'
    or (app.can(organization_id, 'courses', 'update', 'team') and app.is_manager_of(organization_id, employee_id))
    or (app.can(organization_id, 'courses', 'update', 'own') and employee_id = app.current_employee_id(organization_id))
  )
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'courses')
  and (
    app.has_permission(organization_id, 'courses', 'update') = 'all'
    or (app.can(organization_id, 'courses', 'update', 'team') and app.is_manager_of(organization_id, employee_id))
    or (app.can(organization_id, 'courses', 'update', 'own') and employee_id = app.current_employee_id(organization_id))
  )
);

create policy course_completion_records_select on public.course_completion_records for select to authenticated
using (
  app.is_platform_admin()
  or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      app.has_permission(organization_id, 'courses', 'read') = 'all'
      or (app.can(organization_id, 'courses', 'read', 'team') and app.is_manager_of(organization_id, employee_id))
      or (app.can(organization_id, 'courses', 'read', 'own') and employee_id = app.current_employee_id(organization_id))
    )
  )
);

comment on policy course_completion_records_select on public.course_completion_records is
  'Singura politică din modul FĂRĂ `app.feature_on`. Abatere deliberată: dovada de instruire e un artefact cu valoare în afara aplicației, iar o firmă care își stinge modulul nu are voie să-și piardă accesul la adeverințele deja emise.';

-- =============================================================================
-- 8. Drepturi de tabelă — fără DELETE nicăieri
-- =============================================================================

revoke all on public.courses                   from anon, authenticated;
revoke all on public.course_materials          from anon, authenticated;
revoke all on public.course_material_versions  from anon, authenticated;
revoke all on public.course_items              from anon, authenticated;
revoke all on public.course_enrollments        from anon, authenticated;
revoke all on public.course_enrollment_items   from anon, authenticated;
revoke all on public.course_completion_records from anon, authenticated;

grant select, insert, update on public.courses                  to authenticated;
grant select, insert, update on public.course_materials         to authenticated;
grant select, insert, update on public.course_material_versions to authenticated;
grant select, insert, update on public.course_items             to authenticated;
grant select, insert, update on public.course_enrollments       to authenticated;

-- PRIMA BARIERĂ, pe privilegii. `course_enrollment_items` poartă `employee_id`,
-- deci ramura `own` din politica de UPDATE deschide RÂNDUL ÎNTREG. Fără grantul
-- pe coloane, un `PATCH` direct prin PostgREST cu
-- {"treapta_dovada":"bifa","status":"finalizat"} ar rescrie contractul pedagogic
-- ÎNAINTE ca triggerul să decidă — nu ocolești măsurătoarea, schimbi unitatea de
-- măsură. Aici încercarea eșuează cu 42501, zgomotos, nu tăcut.
-- `semnatura_nume`, `semnat_la` și `semnatura_ip` lipsesc deliberat: semnătura
-- se scrie din acțiunea de server, în context de serviciu, ca IP-ul să vină din
-- antetul cererii și să nu poată fi dictat de client.
grant select on public.course_enrollment_items to authenticated;
grant update (status, secunde_vizionate, pozitie_secunde, heartbeat_la, deschis_la, observatii)
  on public.course_enrollment_items to authenticated;

-- Dovada: doar citire. Rândul îl scrie `internal.cursuri_dovada`, care e
-- `security definer`. Nici INSERT, nici UPDATE, nici DELETE pentru nimeni.
grant select on public.course_completion_records to authenticated;

-- =============================================================================
-- 9. Actor + jurnal de audit
-- =============================================================================
-- `attach_audit` refuză tabela dacă vreo coloană se potrivește cu
-- `internal.audit_forbidden_patterns()` — '%hash%', '%token%', '%secret%',
-- '%parol%', '%ciphertext%', '%_iv', '%auth_tag%'. De aceea coloana de cod
-- privat al filmului se numește `link_cod_privat`, nu `link_hash`.
do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array[
    'courses',
    'course_materials',
    'course_material_versions',
    'course_items',
    'course_enrollments',
    'course_enrollment_items',
    'course_completion_records'
  ]
  loop
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function internal.set_actor()',
      'trg_' || v_tabela || '_00_actor', v_tabela
    );
    execute format('select internal.attach_audit(%L)', v_tabela);
  end loop;
end;
$$;

-- =============================================================================
-- 10. Stocare
-- =============================================================================
-- Bucket PRIVAT. `avatars` e public fiindcă e o poză într-un card; un material
-- de instruire e conținut pentru care există dovadă de parcurgere, iar un URL
-- public l-ar face partajabil în afara firmei și ar goli semnătura de sens.
--
-- Fără `image/svg+xml` (vector de XSS). Fără `video/quicktime`: un `.mov` de
-- iPhone e adesea HEVC, se încarcă fără eroare și nu se redă în Chrome — un
-- fișier care trece încărcarea și pică la redare e mai rău decât unul respins.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('org-courses', 'org-courses', false, 209715200,
   array['application/pdf', 'video/mp4', 'video/webm', 'text/vtt',
         'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- ⚠ Un bucket nou NU are nicio politică, deci accesul e refuzat total până
-- apar cele de mai jos. Politicile din 0002:1489 sunt limitate literal la
-- ('org-documents','org-branding') și nu se ating.
--
-- `app.path_resource(name) = 'courses'` e fixat și la scriere: politicile sunt
-- PERMISSIVE, deci fără el cineva ar putea încărca în acest bucket sub
-- {org}/employees/… și ar moșteni permisiunile de personal.
create policy courses_objects_select on storage.objects for select to authenticated
using (
  bucket_id = 'org-courses'
  and app.path_org(name) = any ((select app.current_org_ids())::uuid[])
  and app.path_resource(name) = 'courses'
  and (
    app.can_path(name, 'read')
    -- A doua ramură: la scope `own`, `can_path` cere ca segmentul 3 să fie
    -- persoana, dar segmentul 3 al unei căi de curs e `material_id` — fișierul
    -- aparține bibliotecii, nu cuiva anume.
    or app.curs_obiect_atribuit(app.path_org(name), name)
  )
);

create policy courses_objects_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'org-courses'
  and app.path_org(name) = any ((select app.current_org_ids())::uuid[])
  and app.path_resource(name) = 'courses'
  and app.can_path(name, 'create')
  and owner = (select auth.uid())
);

create policy courses_objects_update on storage.objects for update to authenticated
using (
  bucket_id = 'org-courses'
  and app.path_org(name) = any ((select app.current_org_ids())::uuid[])
  and app.path_resource(name) = 'courses'
  and app.can_path(name, 'update')
)
with check (
  bucket_id = 'org-courses'
  and app.path_org(name) = any ((select app.current_org_ids())::uuid[])
  and app.path_resource(name) = 'courses'
  and app.can_path(name, 'update')
);

-- =============================================================================
-- 11. Seed: modulul și permisiunile
-- =============================================================================

insert into public.features (feature_key, denumire, descriere, icon, grup, is_core, sort_order) values
  ('courses', 'Cursuri',
   'Bibliotecă de materiale PDF și video, cursuri atribuite angajaților și dovadă de parcurgere.',
   'graduation-cap', 'hr', false, 45)
on conflict (feature_key) do nothing;

-- Matricea: super_admin/org_admin/hr = all, manager = team, employee = own.
--
-- `manager` primește `create` și `update`, nu doar `read` — fără ele, fiecare
-- ramură `team` scrisă mai sus ar fi cod mort, adică exact defectul `checklists`,
-- unde politicile cer `scope >= team AND is_manager_of` iar seed-ul nu dă `team`.
--
-- `delete` și `approve` NU se seedează deloc: nu există politică DELETE
-- (ștergerea e `deleted_at`, deci `update`) și nu există flux de aprobare.
-- Absența rândului e forma corectă a lui „nu"; un rând decorativ ar produce
-- exact `checklists:approve` — seedat, mort, nedeclarat în cod.
--
-- ⚠ Ținta de conflict are CINCI coloane. `0063_permisiuni_per_angajat.sql:54-56`
-- a înlocuit indexul pe patru cu unul care include `member_id`; formularea
-- veche ar cădea cu 42P10.
--
-- Forma e cea din 0002 §7 — `(rol, resursă, scope, '{acțiuni}')` plus
-- `lateral unnest` — nu una inventată aici. Motivul e concret:
-- `src/config/permissions.test.ts` parsează seed-ul din TOATE migrările cu trei
-- expresii regulate, iar o a patra formă i-ar fi invizibilă. Testul ar fi
-- raportat cele patru chei `courses:*` drept „declarate în cod, absente din
-- seed" — exact driftul pe care e pus să-l prindă, semnalat fals.
with m(rol, resursa, scop, actiuni) as (values
  ('super_admin','courses','all',  '{read,create,update,export}'),
  ('org_admin','courses','all',    '{read,create,update,export}'),
  ('hr','courses','all',           '{read,create,update,export}'),
  ('manager','courses','team',     '{read,create,update,export}'),
  -- Angajatul nu compune cursuri. Progresul și semnătura trec prin `update`.
  ('employee','courses','own',     '{read,update,export}')
)
insert into public.role_permissions (organization_id, role, resource, action, scope)
select null, m.rol::public.app_role, m.resursa, a, m.scop::public.permission_scope
from m, lateral unnest(m.actiuni::text[]) as a
on conflict (organization_id, member_id, role, resource, action) where deleted_at is null do nothing;

-- =============================================================================
-- 12. Joburi zilnice
-- =============================================================================
-- Garda de disponibilitate, aceeași convenție ca în 0008 și 0042: migrarea
-- rulează și pe un Postgres 17 gol, în CI, unde pg_cron nu există. Fără gardă,
-- `create extension` oprește AICI tot lanțul de migrări.
do $do$
begin
  if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema cron;
    perform cron.schedule(
      'cursuri-reamintire',
      '0 6 * * *',
      $job$select internal.cursuri_reaminteste();$job$
    );
    perform cron.schedule(
      'cursuri-recertificare',
      '30 3 * * *',
      $job$select internal.cursuri_recertifica();$job$
    );
  else
    raise warning 'pg_cron nu este disponibil (Postgres gol / CI). Joburile „cursuri-reamintire" și „cursuri-recertificare" nu au fost programate. Pe Supabase se programează normal.';
  end if;
end
$do$;

commit;
