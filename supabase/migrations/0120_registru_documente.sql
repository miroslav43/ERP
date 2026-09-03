-- supabase/migrations/0120_registru_documente.sql
--
-- REGISTRUL DE ÎNREGISTRARE A DOCUMENTELOR.
--
-- Orice document produs de aplicație primește un număr de înregistrare în
-- formatul „437/02.09.2026”, dintr-un registru UNIC pe firmă, cu contorul
-- resetat la 1 ianuarie. Specificația completă, cu textul actelor citat:
-- `docs/superpowers/specs/2026-09-03-registru-inregistrare-documente-design.md`.
--
-- ── TEMEIUL, PE SCURT ────────────────────────────────────────────────────────
-- · Legea 16/1996 art. 7 — obligația de a înregistra TOATE documentele intrate,
--   cele întocmite pentru uz intern și cele ieșite. De aici enum-ul `sens`.
-- · Ordin 217/1996 art. 9 — sursa listei de coloane, cuvânt cu cuvânt; și
--   „înregistrarea începe de la 1 ianuarie și se încheie la 31 decembrie”.
-- · OMFP 2634/2015 pct. 24 — regimul intern de numerotare: număr secvențial,
--   ținând cont de puncte de lucru, cu numărul de pornire declarat PENTRU
--   FIECARE EXERCIȚIU FINANCIAR (de aici `registru_exercitii.numar_de_pornire`).
-- · OMFP 2634/2015 pct. 58 — patru constrângeri directe asupra PROGRAMULUI,
--   nu asupra contabilului. Fiecare are corespondent mecanic mai jos.
--
-- ── DE CE REGISTRUL NU ARE `deleted_at` ─────────────────────────────────────
-- Abatere deliberată de la tiparul proiectului, unde orice tabelă are ștergere
-- logică și indexuri PARȚIALE `where deleted_at is null`.
--
-- Pct. 58 lit. d) cere liste „numerotate în ordine cronologică, interzicându-se
-- inserări, intercalări, precum și orice eliminări sau adăugări ulterioare”.
-- Un rând de registru nu se șterge — se ANULEAZĂ (`anulat_la` + `motiv_anulare`,
-- exact ca `hr_issued_documents`). Consecință directă: indexurile de aici NU
-- sunt parțiale. Cine copiază tiparul din 0013 în altă tabelă trebuie să pună
-- `where deleted_at is null` la loc; aici lipsa lui e intenționată.
--
-- ── DE CE ÎNREGISTRAREA E ÎN TRIGGER, NU ÎNTR-UN APEL DIN INTERFAȚĂ ─────────
-- Un `employee` care depune o cerere de concediu produce o INTRARE în registru.
-- Deci alocatorul nu poate fi păzit de `registru:*` — angajatul n-are cheia aia
-- și nici n-ar trebui s-o aibă.
--
-- Soluția: înregistrarea se face din trigger `after insert` pe tabela sursă.
-- Dreptul care contează e dreptul de a scrie DOCUMENTUL, verificat deja de
-- RLS-ul acelei tabele. `internal.inregistreaza_document` e `security definer`
-- și revocată complet de la `authenticated` — nu se poate chema din TypeScript.
--
-- Câștigul: niciun ecran nu poate „uita” să înregistreze. Cerința „orice
-- document are număr” devine structurală, nu o disciplină de programator.
--
-- ── ⚠️ DE CE NU SE CHEAMĂ `lpad` ────────────────────────────────────────────
-- Capcana e deja documentată în 0098 și se repetă identic aici. În PostgreSQL
-- `lpad` TAIE când șirul e mai lung decât lungimea cerută:
--
--     lpad('9',  1, '0') → '9'
--     lpad('10', 1, '0') → '1'      ← verificat pe baza proiectului
--
-- Registrul folosește `padding = 1`. Cu `lpad`, de la al ZECELEA document al
-- anului numărul s-ar trunchia la „1”, ar coliziona pe indexul unic, iar
-- reîncercările ar arde numere la fiecare apăsare până la epuizare — adică
-- „numerotarea e ocupată”, permanent, pentru tot restul anului. Se concatenează
-- direct.
--
-- ── GOLURILE SUNT PERMISE, REPETĂRILE NU ────────────────────────────────────
-- Aceeași regulă ca la marcă (0033), tichete (0047) și contracte (0098).
--
-- ── CE NU FACE MIGRAREA ASTA (vine în tura a doua) ──────────────────────────
-- · Backfill-ul documentelor deja emise în anul curent.
-- · Celelalte 14 puncte de conectare (inventar, diurnă, salarizare, SSM,
--   concedii, cursuri, puncte de lucru).
-- · Funcțiile de închidere/redeschidere a exercițiului și notificările lor.
--   Tabela `registru_exercitii` și garda pe an închis se creează AICI, fiindcă
--   alocatorul citește `numar_de_pornire` din ea.
--
-- Forward-only: 0001, 0002, 0004 și 0005 NU se editează.

\set ON_ERROR_STOP on

begin;

-- =====================================================================================
-- 1. Enum-uri
-- =====================================================================================

-- Cele trei sensuri din Legea 16/1996 art. 7: „documentelor intrate, a celor
-- întocmite pentru uz intern, precum și a celor ieșite”.
create type public.registru_sens as enum ('intrare', 'iesire', 'intern');

create type public.registru_stare_exercitiu as enum ('deschis', 'inchis');

-- =====================================================================================
-- 2. Exercițiile — un rând per (firmă, an)
-- =====================================================================================

create table public.registru_exercitii (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations (id) on delete cascade,
  an                     integer not null check (an between 2000 and 2200),
  stare                  public.registru_stare_exercitiu not null default 'deschis',
  -- OMFP pct. 24: procedura proprie trebuie să spună, „pentru fiecare exercițiu
  -- financiar, care este numărul sau seria de la care se emite primul document”.
  -- Implicit 1; o firmă migrată din alt sistem pornește de la valoarea ei.
  numar_de_pornire       integer not null default 1 check (numar_de_pornire >= 1),
  inchis_la              timestamptz,
  inchis_de              uuid references auth.users (id) on delete set null,
  total_inregistrari     integer,
  -- SHA-256 peste registrul anului la închidere. Pct. 58 lit. d) INTERZICE
  -- adăugările ulterioare; amprenta le face DETECTABILE. Mecanica nu e nouă:
  -- `hr_issued_documents.continut_checksum` face asta pentru un document.
  amprenta               text,
  redeschis_la           timestamptz,
  redeschis_de           uuid references auth.users (id) on delete set null,
  motiv_redeschidere     text check (motiv_redeschidere is null
                                     or char_length(btrim(motiv_redeschidere)) between 3 and 500),
  created_at             timestamptz not null default now(),
  created_by             uuid references auth.users (id) on delete set null,
  updated_at             timestamptz not null default now(),
  updated_by             uuid references auth.users (id) on delete set null,
  constraint registru_exercitii_uq unique (organization_id, an)
);

create index registru_exercitii_created_by_idx on public.registru_exercitii (created_by);
create index registru_exercitii_updated_by_idx on public.registru_exercitii (updated_by);

comment on table public.registru_exercitii is
  'Exercițiul financiar al registrului, per firmă. `numar_de_pornire` e cerut de OMFP '
  '2634/2015 pct. 24; `stare = inchis` blochează anul, conform pct. 58 lit. h).';

-- =====================================================================================
-- 3. Registrul propriu-zis
-- =====================================================================================
--
-- Coloanele marcate „art. 9” există fiindcă le enumeră Ordinul 217/1996, nu
-- fiindcă ne trebuie nouă. Lista lui, literal: „numărul de înregistrare, data
-- înregistrării, numărul și data documentului date de emitent, numărul filelor
-- documentului, numărul anexelor, emitentul, conținutul documentului în rezumat,
-- compartimentul căruia i s-a repartizat, data expedierii, modul rezolvării,
-- destinatarul, numărul de înregistrare al documentului la care se conexează”.

create table public.registru_documente (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations (id) on delete cascade,
  an                     integer not null check (an between 2000 and 2200),
  numar                  integer not null check (numar >= 1),
  numar_afisat           text not null,                    -- „437/02.09.2026”
  data_inregistrare      date not null,                    -- art. 9
  sens                   public.registru_sens not null,
  tip_document           text not null check (tip_document ~ '^[a-z][a-z0-9_]{1,63}$'),
  continut_rezumat       text not null                     -- art. 9
                           check (char_length(btrim(continut_rezumat)) between 2 and 500),
  numar_document_emitent text,                             -- art. 9
  data_document_emitent  date,                             -- art. 9
  emitent                text,                             -- art. 9
  destinatar             text,                             -- art. 9
  numar_file             integer check (numar_file is null or numar_file >= 0),   -- art. 9
  numar_anexe            integer check (numar_anexe is null or numar_anexe >= 0), -- art. 9
  compartiment           text,                             -- art. 9
  data_expedierii        date,                             -- art. 9
  mod_rezolvare          text,                             -- art. 9
  -- art. 9: „Documentele care se referă la aceeași problemă se conexează la
  -- primul document înregistrat”. Se completează manual din arhivă; deducerea
  -- automată ar cere o regulă per tip de document și n-are o citire evidentă.
  conexat_la             uuid references public.registru_documente (id) on delete set null,
  entitate_tip           text not null,
  entitate_id            uuid,
  -- OMFP pct. 24: „în alocarea numerelor se va ține cont de structura
  -- organizatorică, respectiv gestiuni, puncte de lucru, sucursale”. Se
  -- completează unde sursa îl are; `null` unde documentul nu aparține unui punct.
  punct_lucru_id         uuid references public.puncte_lucru (id) on delete set null,
  inregistrat_retroactiv boolean not null default false,
  anulat_la              timestamptz,
  motiv_anulare          text,
  created_at             timestamptz not null default now(),
  created_by             uuid references auth.users (id) on delete set null,
  updated_at             timestamptz not null default now(),
  updated_by             uuid references auth.users (id) on delete set null
  -- FĂRĂ `deleted_at`: pct. 58 lit. d). Vezi antetul.
);

comment on table public.registru_documente is
  'Registrul de intrare-ieșire, Legea 16/1996 art. 7 + Ordin 217/1996 art. 9. Append-only: '
  'un rând se anulează, nu se șterge (OMFP 2634/2015 pct. 58 lit. d). Numărul, anul și data '
  'sunt înghețate de `internal.guard_registru_documente`.';

-- =====================================================================================
-- 4. Indexuri
-- =====================================================================================
--
-- ATENȚIE: NICIUNUL nu e parțial. Tabela n-are `deleted_at` — vezi antetul.

-- Pct. 58 lit. o): programul nu are voie să permită „editarea a două sau a mai
-- multor documente de același tip, cu același număr și conținut diferit de
-- informații în cadrul aceluiași exercițiu financiar”. Registrul fiind UNIC pe
-- firmă, indexul ăsta îl satisface integral: un număr, un singur document.
create unique index registru_org_an_numar_uniq
  on public.registru_documente (organization_id, an, numar);

-- Apărarea contra dublei înregistrări. `emiteDocumenteLipsa` e PROIECTAT să fie
-- rulat de două ori (a doua oară nu face nimic), iar un stat de plată se descarcă
-- de câte ori vrea contabilul. Fără indexul ăsta, fiecare repetare ar arde un
-- număr din registru.
--
-- `tip_document` E ÎN CHEIE, și trebuie să fie: din ACELAȘI `payroll_periods.id`
-- ies patru documente diferite — statul de plată, D112, nota contabilă și ordinul
-- bancar. Fără el, al doilea ar fi respins tăcut ca duplicat al primului și n-ar
-- primi niciodată număr.
create unique index registru_entitate_uniq
  on public.registru_documente (organization_id, tip_document, entitate_tip, entitate_id)
  where entitate_id is not null;

create index registru_org_an_data_idx
  on public.registru_documente (organization_id, an, data_inregistrare desc, numar desc);
create index registru_org_tip_idx
  on public.registru_documente (organization_id, an, tip_document);
create index registru_org_sens_idx
  on public.registru_documente (organization_id, an, sens);
create index registru_conexat_idx
  on public.registru_documente (conexat_la) where conexat_la is not null;
create index registru_created_by_idx on public.registru_documente (created_by);
create index registru_updated_by_idx on public.registru_documente (updated_by);

-- =====================================================================================
-- 5. Permisiuni — resursa `registru`
-- =====================================================================================
--
-- Seed-ul din `role_permissions` e SURSA DE ADEVĂR pentru RLS; uniunea din
-- `src/config/permissions.ts` e doar tipul. O cheie declarată numai în TypeScript
-- întoarce `none`, adică REFUZ TĂCUT.
--
-- `hr` primește `read` și `export`, dar NU `update`: închiderea exercițiului e a
-- administratorului. Și primește `read` explicit — dacă pagina ar fi fost păzită
-- cu `compliance:read`, pe care rolul `hr` NU îl are în seed, exact omul care
-- emite documentele ar fi văzut un registru gol, fără nicio eroare.

-- ⚠️ FORMA CONTEAZĂ, nu doar conținutul. `src/config/permissions.test.ts` citește
-- seed-ul din SQL ca TEXT (ca să ruleze în CI fără Postgres) și recunoaște exact
-- trei tipare. Produsul cartezian `from unnest(array[roluri]) cross join
-- unnest(array[acțiuni])` NU e unul dintre ele: regexul formei 1 se așteaptă la
-- resurse × acțiuni, deci ar fi extras „super_admin:read” în loc de
-- „registru:read”, iar testul ar fi raportat cele trei chei ca lipsă din seed.
-- Se scriu rând cu rând, în forma 3 — `(null, 'rol', 'resursă', 'acțiune', 'scope')`.
insert into public.role_permissions (organization_id, role, resource, action, scope)
values
  (null, 'super_admin', 'registru', 'read',   'all'),
  (null, 'super_admin', 'registru', 'export', 'all'),
  (null, 'super_admin', 'registru', 'update', 'all'),
  (null, 'org_admin',   'registru', 'read',   'all'),
  (null, 'org_admin',   'registru', 'export', 'all'),
  (null, 'org_admin',   'registru', 'update', 'all'),
  (null, 'hr',          'registru', 'read',   'all'),
  (null, 'hr',          'registru', 'export', 'all')
on conflict (organization_id, role, resource, action) where deleted_at is null do nothing;

-- `manager` și `employee` nu primesc niciun rând: absența permisiunii = refuz.

-- =====================================================================================
-- 6. RLS
-- =====================================================================================

alter table public.registru_exercitii  enable row level security;
alter table public.registru_exercitii  force  row level security;
alter table public.registru_documente  enable row level security;
alter table public.registru_documente  force  row level security;

create policy registru_exercitii_select on public.registru_exercitii
  for select to authenticated
  using (
    app.is_platform_admin()
    or (organization_id = any ((select app.current_org_ids())::uuid[])
        and app.can(organization_id, 'registru', 'read', 'all'))
  );

create policy registru_exercitii_insert on public.registru_exercitii
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'registru', 'update', 'all')
  );

create policy registru_exercitii_update on public.registru_exercitii
  for update to authenticated
  using (organization_id = any ((select app.current_org_ids())::uuid[])
         and app.can(organization_id, 'registru', 'update', 'all'))
  with check (organization_id = any ((select app.current_org_ids())::uuid[])
         and app.can(organization_id, 'registru', 'update', 'all'));

create policy registru_documente_select on public.registru_documente
  for select to authenticated
  using (
    app.is_platform_admin()
    or (organization_id = any ((select app.current_org_ids())::uuid[])
        and app.can(organization_id, 'registru', 'read', 'all'))
  );

-- Inserarea din interfață NU e prevăzută: registrul se scrie din triggerele de pe
-- tabelele sursă, prin `internal.inregistreaza_document` (`security definer`).
-- Politica există totuși, cu poarta cea mai strictă, ca o inserare manuală făcută
-- deliberat de un `org_admin` să fie posibilă și auditată — nu ca o portiță.
create policy registru_documente_insert on public.registru_documente
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'registru', 'update', 'all')
    and anulat_la is null
    and motiv_anulare is null
  );

-- Modificabile rămân doar coloanele „de rezolvare” și anularea. Numărul, anul,
-- data și legătura cu entitatea sunt înghețate de trigger — vezi §7.
create policy registru_documente_update on public.registru_documente
  for update to authenticated
  using (organization_id = any ((select app.current_org_ids())::uuid[])
         and app.can(organization_id, 'registru', 'update', 'all'))
  with check (organization_id = any ((select app.current_org_ids())::uuid[])
         and app.can(organization_id, 'registru', 'update', 'all'));

-- NICIO politică DELETE, pe niciuna dintre cele două tabele. Aici nu e doar
-- convenția proiectului, ci pct. 58 lit. d): „interzicându-se … orice eliminări”.

-- =====================================================================================
-- 7. Garda care îngheață numerotarea — pct. 58 lit. d)
-- =====================================================================================
--
-- Tiparul e cel din `internal.guard_notifications` (0002:778): coloanele care
-- n-au voie să se schimbe se rescriu din `old`, tăcut, în loc să ridice eroare.
-- Un UPDATE care încearcă să le atingă reușește, dar nu le modifică.

create or replace function internal.guard_registru_documente()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.organization_id        := old.organization_id;
  new.an                     := old.an;
  new.numar                  := old.numar;
  new.numar_afisat           := old.numar_afisat;
  new.data_inregistrare      := old.data_inregistrare;
  new.sens                   := old.sens;
  new.tip_document           := old.tip_document;
  new.entitate_tip           := old.entitate_tip;
  new.entitate_id            := old.entitate_id;
  new.inregistrat_retroactiv := old.inregistrat_retroactiv;
  new.created_at             := old.created_at;
  return new;
end;
$$;

create trigger guard_registru_documente
  before update on public.registru_documente
  for each row execute function internal.guard_registru_documente();

-- =====================================================================================
-- 8. Garda pe exercițiul închis — pct. 58 lit. h)
-- =====================================================================================
--
-- „să nu permită inserări, modificări sau eliminări de date pentru o perioadă
-- închisă”. Blochează și ANULAREA unui rând dintr-un an închis: un document
-- anulat după închidere ar schimba un registru deja listat la control.

create or replace function internal.registru_verifica_exercitiu()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.registru_exercitii e
    where e.organization_id = new.organization_id
      and e.an = new.an
      and e.stare = 'inchis'
  ) then
    raise exception using errcode = 'P0001',
      message = 'Registrul pe anul ' || new.an::text || ' este închis. '
             || 'Redeschide exercițiul înainte de a mai înregistra sau modifica documente.';
  end if;
  return new;
end;
$$;

create trigger registru_verifica_exercitiu
  before insert or update on public.registru_documente
  for each row execute function internal.registru_verifica_exercitiu();

-- =====================================================================================
-- 9. Alocatorul
-- =====================================================================================
--
-- Refolosește `public.document_sequences` cu `document_type = 'registru_general'` —
-- al patrulea consumator, după inventar (0010), tichete (0047) și contracte
-- (0098). Un contor nou ar fi a cincea mecanică pentru aceeași nevoie.
--
-- ANUL E ÎN CHEIA UNICĂ `(organization_id, document_type, year)`, deci resetarea
-- pe 1 ianuarie — Ordin 217/1996 art. 9 — vine din construcție, nu dintr-un job.

create or replace function internal.aloca_numar_registru(p_organization_id uuid, p_data date)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_an       integer := extract(year from p_data)::integer;
  v_pornire  integer;
  v_numar    integer;
begin
  -- Numărul de pornire declarat de firmă pentru exercițiul ăsta (OMFP pct. 24).
  select e.numar_de_pornire into v_pornire
  from public.registru_exercitii e
  where e.organization_id = p_organization_id and e.an = v_an;

  v_pornire := coalesce(v_pornire, 1);

  -- Un singur INSERT … ON CONFLICT DO UPDATE … RETURNING: fără fereastră între
  -- citire și scriere, deci fără două emiteri simultane cu același număr.
  insert into public.document_sequences
    (organization_id, document_type, year, prefix, next_number, padding)
  values
    (p_organization_id, 'registru_general', v_an, '', v_pornire + 1, 1)
  on conflict (organization_id, document_type, year) do update
    set next_number = public.document_sequences.next_number + 1,
        updated_at  = now()
  returning next_number - 1 into v_numar;

  return v_numar;
end;
$$;

comment on function internal.aloca_numar_registru(uuid, date) is
  'Rezervă următorul număr din registrul anului. Contorul se resetează anual, fiindcă '
  '`document_sequences` are anul în cheie. Pornește de la `registru_exercitii.numar_de_pornire`. '
  'Numărul se consumă chiar dacă operațiunea eșuează ulterior — o secvență are voie să aibă '
  'goluri, dar nu are voie să repete.';

-- =====================================================================================
-- 10. Înregistrarea — punctul unic de intrare
-- =====================================================================================
--
-- `security definer` fiindcă e chemată din triggere care rulează sub identitatea
-- oricui scrie documentul, inclusiv a unui `employee` care depune o cerere.
-- REVOCATĂ de la `authenticated`: nu se poate chema din TypeScript. Poarta e
-- dreptul de a scrie DOCUMENTUL, verificat de RLS-ul tabelei sursă.

create or replace function internal.inregistreaza_document(
  p_organization_id        uuid,
  p_sens                   public.registru_sens,
  p_tip_document           text,
  p_continut_rezumat       text,
  p_entitate_tip           text,
  p_entitate_id            uuid,
  p_numar_document_emitent text default null,
  p_data_document_emitent  date default null,
  p_emitent                text default null,
  p_destinatar             text default null,
  p_punct_lucru_id         uuid default null,
  p_data_inregistrare      date default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_data   date := coalesce(p_data_inregistrare, app.azi_local());
  v_an     integer := extract(year from v_data)::integer;
  v_numar  integer;
  v_id     uuid;
begin
  -- Idempotență: al doilea apel pe aceeași entitate și același tip întoarce
  -- rândul existent, FĂRĂ să ardă un număr. `emiteDocumenteLipsa` e proiectat
  -- să fie rulat de două ori; un stat de plată se descarcă de câte ori vrea
  -- contabilul.
  if p_entitate_id is not null then
    select r.id into v_id
    from public.registru_documente r
    where r.organization_id = p_organization_id
      and r.tip_document    = p_tip_document
      and r.entitate_tip    = p_entitate_tip
      and r.entitate_id     = p_entitate_id;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  v_numar := internal.aloca_numar_registru(p_organization_id, v_data);

  insert into public.registru_documente (
    organization_id, an, numar, numar_afisat, data_inregistrare, sens, tip_document,
    continut_rezumat, numar_document_emitent, data_document_emitent, emitent, destinatar,
    entitate_tip, entitate_id, punct_lucru_id
  ) values (
    p_organization_id,
    v_an,
    v_numar,
    -- FĂRĂ `lpad` — vezi antetul. Cu `padding = 1` ar trunchia orice număr de
    -- două cifre la prima, iar registrul s-ar bloca de la al zecelea document.
    v_numar::text || '/' || to_char(v_data, 'DD.MM.YYYY'),
    v_data,
    p_sens,
    p_tip_document,
    p_continut_rezumat,
    p_numar_document_emitent,
    p_data_document_emitent,
    p_emitent,
    p_destinatar,
    p_entitate_tip,
    p_entitate_id,
    p_punct_lucru_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function internal.inregistreaza_document is
  'Punctul unic de intrare în registru. Chemată din triggerele tabelelor sursă, NU din '
  'aplicație — dreptul de a scrie documentul e poarta. Idempotentă pe '
  '(firmă, tip_document, entitate_tip, entitate_id).';

-- =====================================================================================
-- 11. Ajutor: denumirea firmei, pentru coloana `emitent` din art. 9
-- =====================================================================================

create or replace function internal.registru_denumire_org(p_organization_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name from public.organizations o where o.id = p_organization_id;
$$;

-- =====================================================================================
-- 12. Punctul de conectare 1 — documentele de personal emise
-- =====================================================================================
--
-- `hr_issued_documents` poartă deja numărul propriu al actului („ADEV 2026/000123”),
-- care în art. 9 e „numărul documentului dat de emitent” — o coloană DISTINCTĂ de
-- numărul de înregistrare. Registrul le consemnează pe amândouă; nu îl înlocuiește.

create or replace function internal.hr_issued_documents_inregistreaza()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cod       text;
  v_angajat   text;
begin
  select t.cod into v_cod
  from public.hr_document_templates t
  where t.id = new.template_id;

  select e.full_name into v_angajat
  from public.employees e
  where e.id = new.employee_id;

  perform internal.inregistreaza_document(
    p_organization_id        => new.organization_id,
    p_sens                   => 'iesire'::public.registru_sens,
    p_tip_document           => coalesce(v_cod, 'document_personal'),
    p_continut_rezumat       => new.titlu || coalesce(' — ' || v_angajat, ''),
    p_entitate_tip           => 'hr_issued_documents',
    p_entitate_id            => new.id,
    p_numar_document_emitent => new.numar_afisat,
    p_data_document_emitent  => new.emis_la,
    p_emitent                => internal.registru_denumire_org(new.organization_id),
    p_destinatar             => v_angajat
  );

  return null;
end;
$$;

create trigger zz_hr_issued_documents_inregistreaza
  after insert on public.hr_issued_documents
  for each row execute function internal.hr_issued_documents_inregistreaza();

-- =====================================================================================
-- 13. Punctul de conectare 2 — contractele de muncă
-- =====================================================================================
--
-- Contractul are numărul lui din `public.aloca_numar_contract` (0098), în formatul
-- „42/2026”. Ăla rămâne numărul actului; ăsta e numărul din registru.

create or replace function internal.employment_contracts_inregistreaza()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_angajat text;
begin
  select e.full_name into v_angajat
  from public.employees e
  where e.id = new.employee_id;

  perform internal.inregistreaza_document(
    p_organization_id        => new.organization_id,
    p_sens                   => 'iesire'::public.registru_sens,
    p_tip_document           => case when new.este_act_aditional
                                     then 'act_aditional'
                                     else 'contract_munca' end,
    p_continut_rezumat       => case when new.este_act_aditional
                                     then 'Act adițional la contractul de muncă'
                                     else 'Contract individual de muncă' end
                                || coalesce(' — ' || v_angajat, ''),
    p_entitate_tip           => 'employment_contracts',
    p_entitate_id            => new.id,
    p_numar_document_emitent => new.numar,
    p_data_document_emitent  => new.data_contract,
    p_emitent                => internal.registru_denumire_org(new.organization_id),
    p_destinatar             => v_angajat
  );

  return null;
end;
$$;

create trigger zz_employment_contracts_inregistreaza
  after insert on public.employment_contracts
  for each row execute function internal.employment_contracts_inregistreaza();

-- =====================================================================================
-- 14. Actor, audit, granturi
-- =====================================================================================

do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array['registru_documente', 'registru_exercitii']
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

-- =====================================================================================
-- 15. Coada REVOKE/GRANT pe funcții
-- =====================================================================================
--
-- Niciuna nu e chemată din TypeScript în tura asta: registrul se scrie din
-- triggere. `authenticated` nu primește `execute` pe nimic de aici.

revoke all on function internal.aloca_numar_registru(uuid, date) from public, anon, authenticated;
revoke all on function internal.inregistreaza_document(
  uuid, public.registru_sens, text, text, text, uuid, text, date, text, text, uuid, date
) from public, anon, authenticated;
revoke all on function internal.registru_denumire_org(uuid) from public, anon, authenticated;
revoke all on function internal.guard_registru_documente() from public, anon, authenticated;
revoke all on function internal.registru_verifica_exercitiu() from public, anon, authenticated;
revoke all on function internal.hr_issued_documents_inregistreaza() from public, anon, authenticated;
revoke all on function internal.employment_contracts_inregistreaza() from public, anon, authenticated;

commit;
