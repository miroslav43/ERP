-- supabase/migrations/0087_reges_online.sql
-- REGES-Online (fost Revisal) — pasul 2: integrarea cu API-ul Inspecției Muncii.
--
-- Până acum modulul producea un CSV de lucru și se oprea acolo: antetul lui
-- `src/domain/revisal/export.ts` explica de ce fișierul oficial `.rvs` nu poate fi
-- scris de un terț. REGES-Online are API, deci fundătura dispare.
--
-- CE ADUCE MIGRAREA
--   · credențiale OIDC per firmă-client, criptate la nivel de aplicație
--   · coada de mesaje către API, cu recipisele și rezultatele asincrone
--   · oglinda nomenclatoarelor naționale (COR, CAEN, județe, temeiuri legale…)
--   · propunerile de detașare și de mutare, în ambele sensuri
--   · perioadele de suspendare a contractului, care nu existau ca entitate
--   · jurnalul apelurilor și închirierea care serializează ciclul de reconciliere
--
-- CE NU ADUCE
-- Nicio valoare legală nouă. Termenele rămân în `reges_termene`, unde erau.

begin;

-- =============================================================================
-- 1. Tipuri
-- =============================================================================

create type public.reges_mediu as enum ('test', 'productie');

create type public.reges_tip_mesaj as enum (
  'salariat', 'contract', 'propunere_detasare', 'propunere_mutare'
);

-- `de_transmis` → (dependența rezolvată) → `asteapta_raspuns` → `reusit` | `esuat`.
-- `in_curs` există ca să nu trimită de două ori același mesaj un ciclu de
-- reconciliere care se suprapune cu apăsarea butonului „Transmite".
create type public.reges_stare_mesaj as enum (
  'de_transmis', 'in_curs', 'asteapta_raspuns', 'reusit', 'esuat', 'anulat'
);

-- Valorile sunt cele din enum-ul `MessageType` al schemei REGES 2025, LITERAL,
-- inclusiv scrierea PascalCase. Sunt vocabular de protocol, nu identificatori de
-- domeniu — ca numele metodelor HTTP. Orice traducere ar cere o tabelă de mapare
-- pe care ar trebui s-o ținem sincronizată cu un sistem pe care nu-l controlăm,
-- iar prima valoare uitată acolo ar produce un mesaj respins fără explicație.
create type public.reges_operatie as enum (
  'InregistrareSalariat', 'ModificareSalariat',
  'AdaugareContract', 'ModificareContract', 'RadiereContract',
  'IncetareContract', 'CorectieIncetareContract', 'AnulareIncetareContract',
  'SuspendareContract', 'CorectieSuspendareContract',
  'ModificareSuspendareContract', 'IncetareSuspendareContract',
  'ReactivareContract', 'CorectieReactivareContract', 'AnulareReactivareContract',
  'PropunereDetasareContract', 'AcceptarePropunereDetasareContract',
  'RespingerePropunereDetasareContract', 'IncetarePropunereDetasareContract',
  'PropunereMutareContract', 'AcceptarePropunereMutareContract',
  'RespingerePropunereMutareContract', 'IncetarePropunereMutareContract'
);

create type public.reges_directie_propunere as enum ('trimisa', 'primita');
create type public.reges_fel_propunere as enum ('detasare', 'mutare');
create type public.reges_stare_propunere as enum (
  'noua', 'acceptata', 'respinsa', 'incetata', 'expirata'
);
create type public.reges_stare_suspendare as enum ('activa', 'incetata', 'anulata');

-- =============================================================================
-- 2. Ancore de tenant pentru chei străine compuse
-- =============================================================================
-- Aceeași unealtă ca în 0074, extinsă la contracte și la registrul de evenimente.
-- Fără ele, un rând din `reges_mesaje` al firmei A ar putea trimite către un
-- contract al firmei B: un FK simplu nu știe nimic despre organizație, iar RLS
-- filtrează rânduri, nu referințe. `2-vanatoare.md:323` semnala exact golul ăsta
-- pe `revisal_events`.

alter table public.employment_contracts
  add constraint employment_contracts_id_org_uk unique (id, organization_id);

alter table public.reges_evenimente
  add constraint reges_evenimente_id_org_uk unique (id, organization_id);

-- =============================================================================
-- 3. reges_credentiale — cheile API ale fiecărei firme-client
-- =============================================================================
-- Autentificarea REGES e OIDC prin Keycloak (realm `API`), grant `password`:
-- client_id + client_secret + utilizator + parolă. NU există o cheie globală a
-- dezvoltatorului — fiecare angajator își generează cheile din portalul propriu,
-- de la „Setări → Acces → Chei API". De aceea tabela e per organizație.
--
-- ⚠ TABELA NU PRIMEȘTE `internal.attach_audit`. Garda R9 (0002_authz.sql:495) ar
-- refuza-o oricum, cu P0001, oprind migrarea: are coloane care se potrivesc cu
-- `%ciphertext%`, `%_iv`, `%token%` și `%parol%`. Refuzul e corect — un rând de
-- audit care conține criptotextul ar fi o a doua copie a secretului. Auditul vine
-- din allow-list-ul acțiunii, ca la `employee_sensitive_data`.
--
-- `utilizator` rămâne în clar, deliberat: numele contului nu e secretul perechii,
-- iar ecranul de setări trebuie să arate CARE cont e configurat. Precedentul e
-- `employee_sensitive_data.banca`, lângă IBAN-ul criptat.

create table public.reges_credentiale (
  organization_id                uuid primary key references public.organizations (id) on delete cascade,
  mediu                          public.reges_mediu not null default 'test',
  cui_angajator                  text not null check (length(btrim(cui_angajator)) between 2 and 20),
  client_id                      text not null default 'reges-api' check (length(btrim(client_id)) between 1 and 120),
  utilizator                     text not null check (length(btrim(utilizator)) between 1 and 200),

  client_secret_ciphertext       bytea,
  client_secret_iv               bytea check (octet_length(client_secret_iv) = 12),
  client_secret_tag              bytea check (octet_length(client_secret_tag) = 16),
  client_secret_key_version      int,

  parola_ciphertext              bytea,
  parola_iv                      bytea check (octet_length(parola_iv) = 12),
  parola_tag                     bytea check (octet_length(parola_tag) = 16),
  parola_key_version             int,

  acces_token_ciphertext         bytea,
  acces_token_iv                 bytea check (octet_length(acces_token_iv) = 12),
  acces_token_tag                bytea check (octet_length(acces_token_tag) = 16),
  acces_token_key_version        int,
  reimprospatare_ciphertext      bytea,
  reimprospatare_iv              bytea check (octet_length(reimprospatare_iv) = 12),
  reimprospatare_tag             bytea check (octet_length(reimprospatare_tag) = 16),
  reimprospatare_key_version     int,
  token_expira_la                timestamptz,

  -- Cursorul nostru în cozile REGES. Stabil per firmă: schimbarea lui reia coada
  -- de la capăt și ar reprocesa rezultate deja împerecheate.
  consumer_id                    uuid not null default gen_random_uuid(),

  verificat_la                   timestamptz,
  verificat_ok                   boolean,
  verificat_mesaj                text,
  activ                          boolean not null default false,

  created_at                     timestamptz not null default now(),
  created_by                     uuid references auth.users (id) on delete set null,
  updated_at                     timestamptz not null default now(),
  updated_by                     uuid references auth.users (id) on delete set null,
  deleted_at                     timestamptz,

  constraint reges_credentiale_secret_complet check (
    (client_secret_ciphertext is null and client_secret_iv is null
     and client_secret_tag is null and client_secret_key_version is null)
    or (client_secret_ciphertext is not null and client_secret_iv is not null
        and client_secret_tag is not null and client_secret_key_version is not null)),
  constraint reges_credentiale_parola_completa check (
    (parola_ciphertext is null and parola_iv is null
     and parola_tag is null and parola_key_version is null)
    or (parola_ciphertext is not null and parola_iv is not null
        and parola_tag is not null and parola_key_version is not null)),
  constraint reges_credentiale_acces_complet check (
    (acces_token_ciphertext is null and acces_token_iv is null
     and acces_token_tag is null and acces_token_key_version is null)
    or (acces_token_ciphertext is not null and acces_token_iv is not null
        and acces_token_tag is not null and acces_token_key_version is not null)),
  constraint reges_credentiale_reimprospatare_completa check (
    (reimprospatare_ciphertext is null and reimprospatare_iv is null
     and reimprospatare_tag is null and reimprospatare_key_version is null)
    or (reimprospatare_ciphertext is not null and reimprospatare_iv is not null
        and reimprospatare_tag is not null and reimprospatare_key_version is not null)),
  -- Nu se poate activa o configurație incompletă: activarea înseamnă „ciclul de
  -- reconciliere are voie să folosească firma asta".
  constraint reges_credentiale_activ_complet check (
    not activ
    or (client_secret_ciphertext is not null and parola_ciphertext is not null))
);

comment on table public.reges_credentiale is
  'Credențialele OIDC ale fiecărei firme-client pentru REGES-Online. Exclusă DELIBERAT din auditul generic (garda R9): accesul trece prin reges_read_credentiale / reges_write_credentiale.';

-- =============================================================================
-- 4. reges_mesaje — coada de mesaje către API
-- =============================================================================
-- Un eveniment legal produce UNUL SAU MAI MULTE mesaje, în ordine. O angajare
-- nouă produce două: `InregistrareSalariat`, apoi `AdaugareContract` — iar al
-- doilea nu poate fi nici măcar construit până nu sosește rezultatul asincron al
-- primului, pentru că îi cere `referintaSalariat.id`. De aici `depinde_de`.
--
-- `cerere_rezumat` NU conține niciodată date personale. Corpul complet se
-- construiește în clipa trimiterii și se uită: un CNP persistat aici ar fi o
-- copie necriptată, în afara `employee_sensitive_data` și a auditului ei.

create table public.reges_mesaje (
  id                        uuid primary key default gen_random_uuid(),
  organization_id           uuid not null references public.organizations (id) on delete cascade,
  eveniment_id              uuid,
  employee_id               uuid,
  contract_id               uuid,

  tip                       public.reges_tip_mesaj not null,
  operatie                  public.reges_operatie not null,
  ordine                    smallint not null default 0 check (ordine >= 0),
  depinde_de                uuid,

  message_id                uuid not null default gen_random_uuid(),
  response_id               uuid,

  stare                     public.reges_stare_mesaj not null default 'de_transmis',
  incercari                 smallint not null default 0 check (incercari >= 0),
  urmatoarea_incercare_la   timestamptz,
  trimis_la                 timestamptz,
  trimis_de                 uuid references auth.users (id) on delete set null,
  raspuns_la                timestamptz,

  rezultat_cod              text check (rezultat_cod in ('SUCCES', 'FAIL')),
  rezultat_tip              text check (rezultat_tip in ('SUCCES', 'WARNING', 'ERROR')),
  rezultat_mesaj            text,
  referinta_id              uuid,
  referinta_sec_id          uuid,
  asteapta_rezultate_conexe boolean not null default false,

  http_status               smallint,
  eroare                    text,
  cerere_rezumat            jsonb not null default '{}'::jsonb
                              check (jsonb_typeof(cerere_rezumat) = 'object'),

  created_at                timestamptz not null default now(),
  created_by                uuid references auth.users (id) on delete set null,
  updated_at                timestamptz not null default now(),
  updated_by                uuid references auth.users (id) on delete set null,
  deleted_at                timestamptz,

  constraint reges_mesaje_id_org_uk unique (id, organization_id),
  constraint reges_mesaje_eveniment_fk foreign key (eveniment_id, organization_id)
    references public.reges_evenimente (id, organization_id) on delete set null,
  constraint reges_mesaje_employee_fk foreign key (employee_id, organization_id)
    references public.employees (id, organization_id) on delete cascade,
  constraint reges_mesaje_contract_fk foreign key (contract_id, organization_id)
    references public.employment_contracts (id, organization_id) on delete cascade,
  constraint reges_mesaje_depinde_fk foreign key (depinde_de, organization_id)
    references public.reges_mesaje (id, organization_id) on delete set null,
  constraint reges_mesaje_fara_autodependenta check (depinde_de is null or depinde_de <> id),
  -- Recipisa există exact când mesajul a plecat.
  constraint reges_mesaje_trimis_coerent check (
    (stare in ('de_transmis', 'in_curs', 'anulat') and trimis_la is null)
    or (stare in ('asteapta_raspuns', 'reusit', 'esuat') and trimis_la is not null)),
  constraint reges_mesaje_esuat_are_motiv check (
    stare <> 'esuat' or coalesce(rezultat_mesaj, eroare) is not null),
  constraint reges_mesaje_reusit_are_referinta check (
    stare <> 'reusit' or referinta_id is not null)
);

create unique index reges_mesaje_message_id_uq on public.reges_mesaje (message_id);
create unique index reges_mesaje_response_id_uq on public.reges_mesaje (response_id)
  where response_id is not null;
create index reges_mesaje_coada_idx on public.reges_mesaje (organization_id, stare, ordine, created_at)
  where deleted_at is null;
create index reges_mesaje_asteptare_idx on public.reges_mesaje (organization_id)
  where stare = 'asteapta_raspuns' and deleted_at is null;
create index reges_mesaje_eveniment_idx on public.reges_mesaje (eveniment_id) where eveniment_id is not null;
create index reges_mesaje_employee_idx on public.reges_mesaje (employee_id) where employee_id is not null;
create index reges_mesaje_contract_idx on public.reges_mesaje (contract_id) where contract_id is not null;
create index reges_mesaje_depinde_idx on public.reges_mesaje (depinde_de) where depinde_de is not null;
create index reges_mesaje_created_by_idx on public.reges_mesaje (created_by);
create index reges_mesaje_updated_by_idx on public.reges_mesaje (updated_by);
create index reges_mesaje_trimis_de_idx on public.reges_mesaje (trimis_de);

comment on column public.reges_mesaje.cerere_rezumat is
  'Rezumat FĂRĂ date personale al cererii trimise. Corpul complet nu se persistă niciodată: se construiește la trimitere și se uită.';
comment on column public.reges_mesaje.referinta_id is
  'Result.Ref din MessageResult — identificatorul REGES al entității. Se copiază pe employees.reges_salariat_id sau employment_contracts.reges_contract_id: toate operațiile ulterioare merg prin referință.';

-- =============================================================================
-- 5. reges_nomenclatoare — oglinda nomenclatoarelor naționale
-- =============================================================================
-- `tip` e `text`, nu enum, DELIBERAT: REGES expune azi ~56 de tipuri și poate
-- adăuga altele fără să ne anunțe. Cu un enum, un tip nou ar face sincronizarea
-- să cadă; cu text, e un rând în plus.
--
-- Indexul unic e COMPLET, fără `where deleted_at is null` — și tabela n-are
-- `deleted_at`. Motivul e mecanic: sincronizarea face `.upsert()`, iar PostgREST
-- nu emite predicatul unui index parțial în `ON CONFLICT` (capcana 7 → 42P10).
-- O valoare dispărută din amonte devine `activ = false`, nu rând șters.

create table public.reges_nomenclatoare (
  id                uuid primary key default gen_random_uuid(),
  -- NULL = nomenclator național. Nenull = specific angajatorului (TipSporAngajator).
  organization_id   uuid references public.organizations (id) on delete cascade,
  tip               text not null check (length(btrim(tip)) between 1 and 80),
  reges_id          uuid not null,
  cod               text,
  nume              text not null check (length(btrim(nume)) between 1 and 500),
  versiune          int,
  parinte_reges_id  uuid,
  activ             boolean not null default true,
  continut          jsonb not null default '{}'::jsonb check (jsonb_typeof(continut) = 'object'),
  sincronizat_la    timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users (id) on delete set null,
  updated_at        timestamptz not null default now(),
  updated_by        uuid references auth.users (id) on delete set null
);

create unique index reges_nomenclatoare_uq
  on public.reges_nomenclatoare (organization_id, tip, reges_id) nulls not distinct;
create index reges_nomenclatoare_cautare_idx on public.reges_nomenclatoare (tip, activ, nume);
create index reges_nomenclatoare_cod_idx on public.reges_nomenclatoare (tip, cod) where cod is not null;
create index reges_nomenclatoare_parinte_idx on public.reges_nomenclatoare (parinte_reges_id)
  where parinte_reges_id is not null;
create index reges_nomenclatoare_created_by_idx on public.reges_nomenclatoare (created_by);
create index reges_nomenclatoare_updated_by_idx on public.reges_nomenclatoare (updated_by);

-- =============================================================================
-- 6. reges_propuneri — detașări și mutări, în ambele sensuri
-- =============================================================================
-- Fluxul diferă de vechiul Revisal: nu se transmite o detașare, ci o PROPUNERE,
-- pe care angajatorul destinație o acceptă sau o respinge separat. Cele două
-- sensuri au cozi diferite în API (`Propuneri` și `PropuneriPrimite`), deci și
-- `directie` aici.
--
-- Salariatul apare doar MASCAT. O propunere primită vine cu datele unui om care
-- nu e (încă) angajatul nostru; stocarea CNP-ului lui ar crea o fișă de date
-- personale în afara `employee_sensitive_data`, fără cheia și fără auditul ei.

create table public.reges_propuneri (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  directie                 public.reges_directie_propunere not null,
  fel                      public.reges_fel_propunere not null,
  contract_id              uuid,
  mesaj_id                 uuid,

  reges_propunere_id       uuid,
  reges_contract_id        uuid,
  angajator_partener_cui   text,
  angajator_partener_nume  text,
  salariat_nume            text,
  salariat_cnp_last4       text check (salariat_cnp_last4 ~ '^[0-9]{4}$'),

  data_inceput             date,
  data_sfarsit             date,
  temei_legal              text,
  stare                    public.reges_stare_propunere not null default 'noua',

  primita_la               timestamptz,
  raspuns_la               timestamptz,
  raspuns_de               uuid references auth.users (id) on delete set null,
  observatii               text,

  created_at               timestamptz not null default now(),
  created_by               uuid references auth.users (id) on delete set null,
  updated_at               timestamptz not null default now(),
  updated_by               uuid references auth.users (id) on delete set null,
  deleted_at               timestamptz,

  constraint reges_propuneri_contract_fk foreign key (contract_id, organization_id)
    references public.employment_contracts (id, organization_id) on delete set null,
  constraint reges_propuneri_mesaj_fk foreign key (mesaj_id, organization_id)
    references public.reges_mesaje (id, organization_id) on delete set null,
  constraint reges_propuneri_interval check (data_sfarsit is null or data_sfarsit >= data_inceput),
  -- O propunere trimisă de noi pleacă de la un contract al nostru; una primită nu.
  constraint reges_propuneri_contract_dupa_directie check (
    directie = 'primita' or contract_id is not null),
  constraint reges_propuneri_raspuns_coerent check (
    stare in ('noua', 'expirata') or raspuns_la is not null)
);

create unique index reges_propuneri_reges_id_uq on public.reges_propuneri (organization_id, reges_propunere_id)
  where reges_propunere_id is not null and deleted_at is null;
create index reges_propuneri_lista_idx on public.reges_propuneri (organization_id, directie, stare)
  where deleted_at is null;
create index reges_propuneri_contract_idx on public.reges_propuneri (contract_id) where contract_id is not null;
create index reges_propuneri_mesaj_idx on public.reges_propuneri (mesaj_id) where mesaj_id is not null;
create index reges_propuneri_created_by_idx on public.reges_propuneri (created_by);
create index reges_propuneri_updated_by_idx on public.reges_propuneri (updated_by);
create index reges_propuneri_raspuns_de_idx on public.reges_propuneri (raspuns_de);

-- =============================================================================
-- 7. contract_suspendari — perioadele de suspendare
-- =============================================================================
-- Nu existau. Contractul avea doar starea curentă (`contract_status = 'suspendat'`),
-- fără dată de început, fără dată de sfârșit, fără temei legal — adică exact cele
-- trei câmpuri pe care `actiuneSuspendare` le cere obligatoriu. Fără tabela asta,
-- o suspendare nu poate fi transmisă deloc.

create table public.contract_suspendari (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  contract_id        uuid not null,
  employee_id        uuid not null,
  data_inceput       date not null,
  data_sfarsit       date,
  temei_legal        text not null check (length(btrim(temei_legal)) between 1 and 120),
  explicatie         text check (explicatie is null or length(btrim(explicatie)) <= 500),
  stare              public.reges_stare_suspendare not null default 'activa',
  reges_actiune_id   uuid,
  created_at         timestamptz not null default now(),
  created_by         uuid references auth.users (id) on delete set null,
  updated_at         timestamptz not null default now(),
  updated_by         uuid references auth.users (id) on delete set null,
  deleted_at         timestamptz,

  constraint contract_suspendari_contract_fk foreign key (contract_id, organization_id)
    references public.employment_contracts (id, organization_id) on delete cascade,
  constraint contract_suspendari_employee_fk foreign key (employee_id, organization_id)
    references public.employees (id, organization_id) on delete cascade,
  constraint contract_suspendari_interval check (data_sfarsit is null or data_sfarsit >= data_inceput)
);

-- Două suspendări active nu se pot suprapune pe același contract. `btree_gist` e
-- deja instalat (0001:48); fără el, `uuid` nu poate intra într-o constrângere de
-- excludere alături de un interval.
alter table public.contract_suspendari
  add constraint contract_suspendari_fara_suprapunere
  exclude using gist (
    contract_id with =,
    daterange(data_inceput, coalesce(data_sfarsit, 'infinity'::date), '[]') with &&
  ) where (stare = 'activa' and deleted_at is null);

create index contract_suspendari_contract_idx on public.contract_suspendari (contract_id, data_inceput desc)
  where deleted_at is null;
create index contract_suspendari_employee_idx on public.contract_suspendari (employee_id)
  where deleted_at is null;
create index contract_suspendari_created_by_idx on public.contract_suspendari (created_by);
create index contract_suspendari_updated_by_idx on public.contract_suspendari (updated_by);

-- =============================================================================
-- 8. reges_apeluri — jurnalul apelurilor, fără corpuri
-- =============================================================================
-- Cerința era „logging cu mascarea datelor sensibile". Mascarea perfectă e să nu
-- stochezi corpurile deloc: o cerere `Salariat` ESTE, în întregime, dată
-- personală. Rămân metoda, calea, statusul, durata și legătura cu mesajul —
-- adică tot ce trebuie ca să diagnostichezi, nimic din ce trebuie protejat.
-- `eroare` trece printr-un curățător în aplicație înainte de scriere.
--
-- Append-only, ca `audit_logs`: fără `updated_at`, fără `deleted_at`.

create table public.reges_apeluri (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  mesaj_id         uuid,
  metoda           text not null check (metoda in ('GET', 'POST')),
  cale             text not null check (length(btrim(cale)) between 1 and 200),
  http_status      smallint,
  durata_ms        integer check (durata_ms is null or durata_ms >= 0),
  consumer_id      uuid,
  eroare           text,
  created_at       timestamptz not null default now(),
  created_by       uuid references auth.users (id) on delete set null,

  constraint reges_apeluri_mesaj_fk foreign key (mesaj_id, organization_id)
    references public.reges_mesaje (id, organization_id) on delete set null
);

create index reges_apeluri_lista_idx on public.reges_apeluri (organization_id, created_at desc);
create index reges_apeluri_mesaj_idx on public.reges_apeluri (mesaj_id) where mesaj_id is not null;
create index reges_apeluri_esec_idx on public.reges_apeluri (organization_id, created_at desc)
  where http_status is null or http_status >= 400;
create index reges_apeluri_created_by_idx on public.reges_apeluri (created_by);

-- =============================================================================
-- 9. reges_inchiriere — serializarea ciclului de reconciliere
-- =============================================================================
-- Stack-ul rulează cu DOUĂ replici (docker-stack.yml:123), iar cozile REGES sunt
-- consumatoare: `PollMessage` avansează cursorul. Două cicluri concurente pe
-- același `consumerId` ar consuma fiecare jumătate din mesaje și ar crede fiecare
-- că le-a văzut pe toate — rezultatele s-ar pierde fără nicio eroare.
--
-- Nu se folosesc lock-uri consultative: sunt legate de sesiune, iar sesiunile
-- vin dintr-un pool. Un rând cu termen de expirare supraviețuiește unei replici
-- ucise la mijlocul ciclului.

create table public.reges_inchiriere (
  cheie          text primary key check (length(btrim(cheie)) between 1 and 100),
  detinut_de     text not null,
  expira_la      timestamptz not null,
  actualizat_la  timestamptz not null default now()
);

comment on table public.reges_inchiriere is
  'Închirierea care serializează ciclul de reconciliere REGES între cele două replici. Fără politici RLS: se atinge exclusiv prin internal.reges_ia_inchirierea / internal.reges_lasa_inchirierea.';

-- =============================================================================
-- 10. Coloane noi pe tabelele existente
-- =============================================================================
-- Identificatorii REGES se păstrează PERMANENT: `AdaugareContract` întoarce un
-- `Result.Ref`, iar orice modificare, încetare sau suspendare ulterioară se
-- transmite prin acea referință, nu prin retrimiterea datelor.
--
-- `cod_revisal` de pe contract NU se atinge: e identificatorul din sistemul vechi,
-- păstrat ca dată istorică. Sunt două lucruri diferite.

alter table public.employees
  add column reges_salariat_id uuid,
  add column reges_tip_act text check (reges_tip_act is null or reges_tip_act in (
    'CarteIdentitate', 'Pasaport', 'BuletinIdentitate', 'Alt', 'CarteDeRezidenta',
    'PermisDeSedere', 'AltActIdentitateRomanesc', 'AltApatridTolerat', 'NIF',
    'CertificatInregistrare', 'PasaportBeneficiarProtectieInternationala',
    'AvizDeAngajare', 'DocumentDeIdentitatetemporara')),
  add column reges_localitate_id uuid;

create unique index employees_reges_salariat_uq on public.employees (organization_id, reges_salariat_id)
  where reges_salariat_id is not null and deleted_at is null;

comment on column public.employees.reges_tip_act is
  'Valoarea din enum-ul TipActIdentitate al schemei REGES. Coloana veche `tip_act_identitate` rămâne text liber, pentru documentele tipărite.';

alter table public.employment_contracts
  add column reges_contract_id uuid,
  add column reges_tip_contract text check (reges_tip_contract is null or reges_tip_contract in (
    'ContractIndividualMunca', 'ContractUcenicie', 'ContractMuncaLaDomiciliu',
    'ContractMuncaTemporara', 'ContractIndividualMuncaTineriDezavantajati',
    'ContractIndividualMuncaClauzaTelemunca', 'ContractMuncaTemporaraClauzaTelemunca',
    'DecizieDetasare', 'ContractIndividualMuncaPlataCuOra', 'RaportDeServiciu',
    'RaportDeServiciuCuStatutSpecial', 'ContractDeManagement',
    'ContractDeMuncaPentruGarzi', 'ContractDeActivitateSportiva',
    'ActAdministrativDemnitar', 'ContractConsilierPersonalDemnitar')),
  add column reges_tip_norma text check (reges_tip_norma is null or reges_tip_norma in (
    'NormaIntreaga', 'TimpPartial', 'NormaOUG132')),
  add column reges_norma_timp text check (reges_norma_timp is null or reges_norma_timp in (
    'NormaIntreaga840', 'NormaIntreaga630', 'NormaIntreagaLegiSpeciale',
    'TimpPartial', 'TimpOUG132')),
  add column reges_repartizare text check (reges_repartizare is null or reges_repartizare in (
    'OreDeZi', 'OreDeNoapte', 'Inegal', 'OreInRepaos', 'OreZiSiRepaos',
    'OreNoapteSiRepaos', 'OreZiNoapteSiRepaos')),
  add column reges_temei_incetare text;

create unique index contracts_reges_contract_uq on public.employment_contracts (organization_id, reges_contract_id)
  where reges_contract_id is not null and deleted_at is null;

comment on column public.employment_contracts.reges_temei_incetare is
  'Codul din nomenclatorul TemeiIncetare. `temei_incetare` rămâne text liber, pentru decizia tipărită.';

-- =============================================================================
-- 11. Credențialele: citire și scriere prin funcții care auditează
-- =============================================================================
-- Aceeași construcție ca `hr_read_sensitive` / `hr_write_sensitive` din 0006, din
-- același motiv: privilegiile directe pe tabelă sunt revocate, deci un SELECT prin
-- PostgREST nu există ca drum. Rândul de audit conține DOAR numele câmpurilor.

create or replace function public.reges_read_credentiale(p_org uuid)
returns table (
  organization_id            uuid,
  mediu                      public.reges_mediu,
  cui_angajator              text,
  client_id                  text,
  utilizator                 text,
  client_secret_ciphertext   bytea,
  client_secret_iv           bytea,
  client_secret_tag          bytea,
  client_secret_key_version  int,
  parola_ciphertext          bytea,
  parola_iv                  bytea,
  parola_tag                 bytea,
  parola_key_version         int,
  consumer_id                uuid,
  token_expira_la            timestamptz,
  verificat_la               timestamptz,
  verificat_ok               boolean,
  verificat_mesaj            text,
  activ                      boolean
)
language plpgsql
volatile                       -- scrie în audit, deci NU stable
security definer
set search_path = ''
as $$
declare
  v_rec record;
begin
  if not (p_org = any ((select app.current_org_ids())::uuid[])) then
    raise exception 'Configurarea REGES aparține altei organizații.' using errcode = 'P0001';
  end if;
  if app.has_permission(p_org, 'reges', 'configure') <> 'all' then
    raise exception 'Nu aveți dreptul de a consulta cheile API REGES. Solicitați administratorului firmei permisiunea „REGES — configurare".'
      using errcode = 'P0001';
  end if;

  select c.* into v_rec
  from public.reges_credentiale c
  where c.organization_id = p_org and c.deleted_at is null;

  if not found then
    return;                    -- „neconfigurat" nu e eroare: e ecranul gol.
  end if;

  insert into public.audit_logs (
    organization_id, actor_id, action, entity_type, entity_id, status, after
  )
  values (
    p_org, (select auth.uid()), 'view', 'reges_credentiale', p_org, 'success',
    jsonb_build_object(
      'campuri_citite', to_jsonb(array['client_secret', 'parola']::text[]),
      'motiv', 'citire chei API REGES din aplicație'
    )
  );

  -- Jetoanele NU se întorc niciodată pe calea asta: sunt ale ciclului de
  -- reconciliere, care le citește cu `service_role`, nu ale ecranului de setări.
  return query
    select v_rec.organization_id, v_rec.mediu, v_rec.cui_angajator, v_rec.client_id,
           v_rec.utilizator,
           v_rec.client_secret_ciphertext, v_rec.client_secret_iv,
           v_rec.client_secret_tag, v_rec.client_secret_key_version,
           v_rec.parola_ciphertext, v_rec.parola_iv,
           v_rec.parola_tag, v_rec.parola_key_version,
           v_rec.consumer_id, v_rec.token_expira_la,
           v_rec.verificat_la, v_rec.verificat_ok, v_rec.verificat_mesaj, v_rec.activ;
end;
$$;

create or replace function public.reges_write_credentiale(
  p_org                       uuid,
  p_mediu                     public.reges_mediu,
  p_cui_angajator             text,
  p_client_id                 text,
  p_utilizator                text,
  -- `default null` nu e comoditate: formularul de setări NU retrimite parola
  -- dacă utilizatorul n-a atins-o, iar `coalesce` de mai jos păstrează atunci
  -- valoarea existentă. Fără valorile implicite, o simplă schimbare de mediu ar
  -- cere retastarea ambelor secrete.
  p_client_secret_ciphertext  bytea default null,
  p_client_secret_iv          bytea default null,
  p_client_secret_tag         bytea default null,
  p_client_secret_key_version int   default null,
  p_parola_ciphertext         bytea default null,
  p_parola_iv                 bytea default null,
  p_parola_tag                bytea default null,
  p_parola_key_version        int   default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_campuri text[] := array['mediu', 'cui_angajator', 'client_id', 'utilizator'];
begin
  if not (p_org = any ((select app.current_org_ids())::uuid[])) then
    raise exception 'Configurarea REGES aparține altei organizații.' using errcode = 'P0001';
  end if;
  if app.has_permission(p_org, 'reges', 'configure') <> 'all' then
    raise exception 'Nu aveți dreptul de a modifica cheile API REGES. Solicitați administratorului firmei permisiunea „REGES — configurare".'
      using errcode = 'P0001';
  end if;

  if p_client_secret_ciphertext is not null then
    v_campuri := v_campuri || 'client_secret'::text;
  end if;
  if p_parola_ciphertext is not null then
    v_campuri := v_campuri || 'parola'::text;
  end if;

  -- `coalesce` pe secrete: formularul de setări nu retrimite parola dacă
  -- utilizatorul n-a atins-o. Fără asta, o simplă schimbare de mediu ar șterge
  -- cheile și ar opri transmiterea, fără niciun mesaj de eroare.
  insert into public.reges_credentiale as c (
    organization_id, mediu, cui_angajator, client_id, utilizator,
    client_secret_ciphertext, client_secret_iv, client_secret_tag, client_secret_key_version,
    parola_ciphertext, parola_iv, parola_tag, parola_key_version,
    created_by, updated_by
  )
  values (
    p_org, p_mediu, btrim(p_cui_angajator), btrim(p_client_id), btrim(p_utilizator),
    p_client_secret_ciphertext, p_client_secret_iv, p_client_secret_tag, p_client_secret_key_version,
    p_parola_ciphertext, p_parola_iv, p_parola_tag, p_parola_key_version,
    (select auth.uid()), (select auth.uid())
  )
  on conflict (organization_id) do update set
    mediu                     = excluded.mediu,
    cui_angajator             = excluded.cui_angajator,
    client_id                 = excluded.client_id,
    utilizator                = excluded.utilizator,
    client_secret_ciphertext  = coalesce(excluded.client_secret_ciphertext, c.client_secret_ciphertext),
    client_secret_iv          = coalesce(excluded.client_secret_iv, c.client_secret_iv),
    client_secret_tag         = coalesce(excluded.client_secret_tag, c.client_secret_tag),
    client_secret_key_version = coalesce(excluded.client_secret_key_version, c.client_secret_key_version),
    parola_ciphertext         = coalesce(excluded.parola_ciphertext, c.parola_ciphertext),
    parola_iv                 = coalesce(excluded.parola_iv, c.parola_iv),
    parola_tag                = coalesce(excluded.parola_tag, c.parola_tag),
    parola_key_version        = coalesce(excluded.parola_key_version, c.parola_key_version),
    -- Schimbarea mediului invalidează jetonul: e alt Keycloak, alt realm.
    acces_token_ciphertext    = case when excluded.mediu <> c.mediu then null else c.acces_token_ciphertext end,
    acces_token_iv            = case when excluded.mediu <> c.mediu then null else c.acces_token_iv end,
    acces_token_tag           = case when excluded.mediu <> c.mediu then null else c.acces_token_tag end,
    acces_token_key_version   = case when excluded.mediu <> c.mediu then null else c.acces_token_key_version end,
    token_expira_la           = case when excluded.mediu <> c.mediu then null else c.token_expira_la end,
    verificat_la              = null,
    verificat_ok              = null,
    verificat_mesaj           = null,
    updated_at                = now(),
    updated_by                = (select auth.uid()),
    deleted_at                = null;

  insert into public.audit_logs (
    organization_id, actor_id, action, entity_type, entity_id, status, after
  )
  values (
    p_org, (select auth.uid()), 'update', 'reges_credentiale', p_org, 'success',
    jsonb_build_object('campuri_modificate', to_jsonb(v_campuri))
  );
end;
$$;

revoke all on function public.reges_read_credentiale(uuid) from public, anon;
revoke all on function public.reges_write_credentiale(
  uuid, public.reges_mediu, text, text, text, bytea, bytea, bytea, int, bytea, bytea, bytea, int
) from public, anon;
grant execute on function public.reges_read_credentiale(uuid) to authenticated;
grant execute on function public.reges_write_credentiale(
  uuid, public.reges_mediu, text, text, text, bytea, bytea, bytea, int, bytea, bytea, bytea, int
) to authenticated;

-- =============================================================================
-- 12. Închirierea ciclului de reconciliere
-- =============================================================================
-- Un singur `insert … on conflict … where` atomic. Dacă închirierea e ținută și
-- încă validă, `do update` nu se aplică, `returning` nu întoarce nimic, iar
-- funcția răspunde `false`. Nu există fereastră între verificare și luare.

create or replace function public.reges_ia_inchirierea(
  p_cheie text,
  p_detinator text,
  p_secunde int default 300
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_luat boolean := false;
begin
  insert into public.reges_inchiriere as i (cheie, detinut_de, expira_la, actualizat_la)
  values (p_cheie, p_detinator, now() + make_interval(secs => p_secunde), now())
  on conflict (cheie) do update
    set detinut_de    = excluded.detinut_de,
        expira_la     = excluded.expira_la,
        actualizat_la = now()
    where i.expira_la < now()
  returning true into v_luat;

  return coalesce(v_luat, false);
end;
$$;

create or replace function public.reges_lasa_inchirierea(p_cheie text, p_detinator text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  -- Numai deținătorul o eliberează. Altfel, un ciclu întârziat care termină după
  -- expirare ar elibera închirierea luată între timp de altcineva.
  update public.reges_inchiriere
     set expira_la = now() - interval '1 second', actualizat_la = now()
   where cheie = p_cheie and detinut_de = p_detinator;
$$;

revoke all on function public.reges_ia_inchirierea(text, text, int) from public, anon, authenticated;
revoke all on function public.reges_lasa_inchirierea(text, text) from public, anon, authenticated;
grant execute on function public.reges_ia_inchirierea(text, text, int) to service_role;
grant execute on function public.reges_lasa_inchirierea(text, text) to service_role;

-- =============================================================================
-- 13. RLS
-- =============================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'reges_credentiale', 'reges_mesaje', 'reges_nomenclatoare', 'reges_propuneri',
    'contract_suspendari', 'reges_apeluri', 'reges_inchiriere'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end
$$;

-- `reges_credentiale` și `reges_inchiriere` rămân DELIBERAT fără politici: RLS
-- activat fără politici înseamnă refuz total pentru `authenticated`, iar accesul
-- trece exclusiv prin funcțiile de mai sus. Ambele sunt trecute, cu motivul
-- scris, în lista albă din `scripts/checks/rls-enabled.sql`.

-- ── reges_mesaje ────────────────────────────────────────────────────────────
create policy reges_mesaje_select on public.reges_mesaje for select to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and deleted_at is null
  and app.feature_on(organization_id, 'reges')
  and app.can(organization_id, 'reges', 'read', 'all')
);

-- S8: un mesaj se naște NETRIMIS. Recipisa, rezultatul și referința REGES vin
-- exclusiv de la Inspecția Muncii, prin ciclul de reconciliere — nu de la client.
create policy reges_mesaje_insert on public.reges_mesaje for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'reges')
  and app.can(organization_id, 'reges', 'create', 'all')
  and deleted_at is null
  and stare = 'de_transmis'
  and trimis_la is null
  and trimis_de is null
  and raspuns_la is null
  and response_id is null
  and referinta_id is null
  and referinta_sec_id is null
  and rezultat_cod is null
  and rezultat_tip is null
  and http_status is null
);

create policy reges_mesaje_update on public.reges_mesaje for update to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and deleted_at is null
  and app.feature_on(organization_id, 'reges')
  and (app.can(organization_id, 'reges', 'update', 'all')
       or app.can(organization_id, 'reges', 'transmit', 'all'))
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and (app.can(organization_id, 'reges', 'update', 'all')
       or app.can(organization_id, 'reges', 'transmit', 'all'))
);

-- ── reges_nomenclatoare ─────────────────────────────────────────────────────
-- Rândurile naționale (organization_id null) sunt date publice: COR, CAEN,
-- județe, temeiuri legale. Le citește oricine e autentificat, pentru că exact
-- ele alimentează listele derulante din formularul de angajat și de contract —
-- iar o poartă pe `reges:read` ar goli acele liste pentru operatorii care n-au
-- treabă cu transmiterea, dar completează dosarul.
create policy reges_nomenclatoare_select on public.reges_nomenclatoare for select to authenticated
using (
  organization_id is null
  or organization_id = any ((select app.current_org_ids())::uuid[])
);

create policy reges_nomenclatoare_insert on public.reges_nomenclatoare for insert to authenticated
with check (
  organization_id is not null
  and organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'reges')
  and app.can(organization_id, 'reges', 'configure', 'all')
);

create policy reges_nomenclatoare_update on public.reges_nomenclatoare for update to authenticated
using (
  organization_id is not null
  and organization_id = any ((select app.current_org_ids())::uuid[])
  and app.can(organization_id, 'reges', 'configure', 'all')
)
with check (
  organization_id is not null
  and organization_id = any ((select app.current_org_ids())::uuid[])
  and app.can(organization_id, 'reges', 'configure', 'all')
);

-- ── reges_propuneri ─────────────────────────────────────────────────────────
create policy reges_propuneri_select on public.reges_propuneri for select to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and deleted_at is null
  and app.feature_on(organization_id, 'reges')
  and app.can(organization_id, 'reges', 'read', 'all')
);

create policy reges_propuneri_insert on public.reges_propuneri for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'reges')
  and app.can(organization_id, 'reges', 'create', 'all')
  and deleted_at is null
  and stare = 'noua'
  and raspuns_la is null
  and raspuns_de is null
);

create policy reges_propuneri_update on public.reges_propuneri for update to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and deleted_at is null
  and app.feature_on(organization_id, 'reges')
  and (app.can(organization_id, 'reges', 'update', 'all')
       or app.can(organization_id, 'reges', 'transmit', 'all'))
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and (app.can(organization_id, 'reges', 'update', 'all')
       or app.can(organization_id, 'reges', 'transmit', 'all'))
);

-- ── contract_suspendari ─────────────────────────────────────────────────────
-- Nu e o tabelă REGES, ci una de personal, care ÎNTÂMPLĂTOR e cerută de REGES.
-- Deci se gatează ca restul dosarului de angajat, prin `app.can_see_employee`,
-- nu prin `reges:*`: un manager cu scope `team` trebuie să vadă suspendarea
-- omului lui chiar dacă n-are nimic de-a face cu transmiterea la ITM.
create policy contract_suspendari_select on public.contract_suspendari for select to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and deleted_at is null
  and app.can_see_employee(organization_id, employee_id)
);

create policy contract_suspendari_insert on public.contract_suspendari for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.can(organization_id, 'employees', 'update', 'all')
  and deleted_at is null
  and reges_actiune_id is null
);

create policy contract_suspendari_update on public.contract_suspendari for update to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and deleted_at is null
  and app.can(organization_id, 'employees', 'update', 'all')
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.can(organization_id, 'employees', 'update', 'all')
);

-- ── reges_apeluri ───────────────────────────────────────────────────────────
-- Append-only: nicio politică de UPDATE. Un jurnal care se poate rescrie nu e
-- jurnal.
create policy reges_apeluri_select on public.reges_apeluri for select to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'reges')
  and app.can(organization_id, 'reges', 'read', 'all')
);

create policy reges_apeluri_insert on public.reges_apeluri for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'reges')
  and app.can(organization_id, 'reges', 'transmit', 'all')
);

-- =============================================================================
-- 14. Politicile moștenite trec de la `compliance` la `reges`
-- =============================================================================
-- `reges_evenimente_select` cerea `compliance:read <> 'none'` — un prag pe
-- „diferit de refuz", nu pe scope real (`2-vanatoare.md:159`). Iar rolul `hr`
-- n-are NICIO permisiune `compliance`, deci specialistul de personal — exact
-- omul care transmite la ITM — nu putea deschide ecranul (`2-vanatoare.md:402`).
-- Cheile `reges:*` din §16 repară ambele.
--
-- `compliance:*` rămâne cheia modulului de scadențe (`expirables`); nu se atinge.

drop policy if exists reges_termene_select on public.reges_termene;
drop policy if exists reges_termene_insert on public.reges_termene;
drop policy if exists reges_termene_update on public.reges_termene;
drop policy if exists reges_evenimente_select on public.reges_evenimente;
drop policy if exists reges_evenimente_insert on public.reges_evenimente;
drop policy if exists reges_evenimente_update on public.reges_evenimente;

-- Termenele de platformă (organization_id null) sunt text de lege, nu date de
-- firmă. Rândurile proprii cer însă permisiune — spre deosebire de politica
-- veche, care lăsa orice angajat să citească toată configurarea.
create policy reges_termene_select on public.reges_termene for select to authenticated
using (
  deleted_at is null
  and (
    organization_id is null
    or (organization_id = any ((select app.current_org_ids())::uuid[])
        and app.can(organization_id, 'reges', 'read', 'all'))
  )
);

create policy reges_termene_insert on public.reges_termene for insert to authenticated
with check (
  organization_id is not null
  and organization_id = any ((select app.current_org_ids())::uuid[])
  and app.can(organization_id, 'reges', 'configure', 'all')
  and deleted_at is null
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy reges_termene_update on public.reges_termene for update to authenticated
using (
  organization_id is not null
  and organization_id = any ((select app.current_org_ids())::uuid[])
  and app.can(organization_id, 'reges', 'configure', 'all')
  and deleted_at is null
)
with check (
  organization_id is not null
  and organization_id = any ((select app.current_org_ids())::uuid[])
  and app.can(organization_id, 'reges', 'configure', 'all')
  and updated_by = (select auth.uid())
);

create policy reges_evenimente_select on public.reges_evenimente for select to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and deleted_at is null
  and (app.can(organization_id, 'reges', 'read', 'all')
       or app.can(organization_id, 'employees', 'read', 'all'))
);

-- `employees:create` rămâne în OR pentru că evenimentul de angajare se generează
-- în aceeași acțiune care creează contractul (`angajati/actions.ts:268`). Fără el,
-- crearea unui contract ar reuși, iar evenimentul REGES ar fi refuzat tăcut.
create policy reges_evenimente_insert on public.reges_evenimente for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and (app.can(organization_id, 'reges', 'create', 'all')
       or app.can(organization_id, 'employees', 'create', 'all'))
  and deleted_at is null
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and status = 'de_pregatit'
  and transmis_la is null
  and transmis_de is null
  and numar_inregistrare is null
  and export_path is null
  and export_checksum is null
  and eroare is null
);

create policy reges_evenimente_update on public.reges_evenimente for update to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and deleted_at is null
  and (app.can(organization_id, 'reges', 'update', 'all')
       or app.can(organization_id, 'reges', 'transmit', 'all')
       or app.can(organization_id, 'employees', 'update', 'all'))
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and (app.can(organization_id, 'reges', 'update', 'all')
       or app.can(organization_id, 'reges', 'transmit', 'all')
       or app.can(organization_id, 'employees', 'update', 'all'))
  and updated_by = (select auth.uid())
);

-- =============================================================================
-- 15. Actor, updated_at, audit, drepturi
-- =============================================================================
-- `reges_credentiale` lipsește din lista de audit INTENȚIONAT: garda R9 ar ridica
-- P0001 și ar opri migrarea, pentru că are coloane `%ciphertext%`, `%_iv`,
-- `%token%` și `%parol%`. Refuzul e corect. `reges_apeluri` lipsește pentru că
-- ESTE un jurnal — auditul lui ar fi o a doua copie a aceluiași rând.

do $$
declare v_tabela text;
begin
  foreach v_tabela in array array[
    'reges_credentiale', 'reges_mesaje', 'reges_nomenclatoare',
    'reges_propuneri', 'contract_suspendari', 'reges_apeluri'
  ]
  loop
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function internal.set_actor()',
      'trg_' || v_tabela || '_00_actor', v_tabela);
  end loop;

  foreach v_tabela in array array[
    'reges_credentiale', 'reges_mesaje', 'reges_nomenclatoare',
    'reges_propuneri', 'contract_suspendari'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.tg_set_updated_at()',
      v_tabela || '_set_updated_at', v_tabela);
  end loop;

  foreach v_tabela in array array[
    'reges_mesaje', 'reges_nomenclatoare', 'reges_propuneri', 'contract_suspendari'
  ]
  loop
    execute format('select internal.attach_audit(%L)', v_tabela);
  end loop;
end;
$$;

do $$
declare v_tabela text;
begin
  foreach v_tabela in array array[
    'reges_credentiale', 'reges_mesaje', 'reges_nomenclatoare', 'reges_propuneri',
    'contract_suspendari', 'reges_apeluri', 'reges_inchiriere'
  ]
  loop
    execute format('revoke all on table public.%I from public, anon', v_tabela);
  end loop;
end;
$$;

-- Privilegiile se acordă pe măsura politicilor, nu în bloc: o tabelă append-only
-- nu primește UPDATE, iar cele două tabele fără politici nu primesc nimic.
grant select, insert, update on public.reges_mesaje         to authenticated;
grant select, insert, update on public.reges_nomenclatoare  to authenticated;
grant select, insert, update on public.reges_propuneri      to authenticated;
grant select, insert, update on public.contract_suspendari  to authenticated;
grant select, insert         on public.reges_apeluri        to authenticated;

-- =============================================================================
-- 16. Seed: modulul și permisiunile
-- =============================================================================

insert into public.features (feature_key, denumire, descriere, icon, grup, is_core, sort_order) values
  ('reges', 'REGES-Online (fost Revisal)',
   'Transmiterea contractelor și a salariaților către Registrul General de Evidență a Salariaților, direct prin API-ul Inspecției Muncii.',
   'scroll-text', 'hr', false, 35)
on conflict (feature_key) do nothing;

-- Modulul se activează pentru firmele existente. REGES nu e opțional prin lege —
-- orice angajator raportează acolo — iar fără rândul ăsta ecranul care exista
-- deja sub `/revisal` ar dispărea din meniu la primul deploy, pentru toată lumea.
insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
select o.id, 'reges', true, now()
from public.organizations o
where o.deleted_at is null
on conflict (organization_id, feature_key) where deleted_at is null do nothing;

-- Șase chei. `transmit` și `configure` NU sunt în produsul cartezian din
-- 0002_authz.sql (read/create/update/delete/approve/export), deci nici
-- `super_admin`, nici `org_admin` nu le-ar primi automat: fiecare rând de mai jos
-- e necesar.
--
-- `hr` primește tot, inclusiv `configure`: specialistul de personal e cel care
-- obține cheile din portalul REGES. Strângerea lui la `org_admin` se face per
-- firmă, prin `role_permissions`, fără deploy.
--
-- `manager` și `employee` nu primesc nimic. Absența rândului e forma corectă a
-- lui „nu"; un rând `none` decorativ ar fi exact `checklists:approve` — seedat,
-- mort, nedeclarat în cod.
--
-- ⚠ Ținta de conflict are CINCI coloane (0063_permisiuni_per_angajat.sql:54);
-- forma veche pe patru cade cu 42P10. Forma `(rol, resursă, scope, '{acțiuni}')`
-- plus `lateral unnest` e cea din 0002 §7 — `src/config/permissions.test.ts`
-- parsează seed-ul din TOATE migrările cu trei expresii regulate, iar o a patra
-- formă i-ar fi invizibilă.
with m(rol, resursa, scop, actiuni) as (values
  ('super_admin','reges','all', '{read,create,update,transmit,configure,export}'),
  ('org_admin','reges','all',   '{read,create,update,transmit,configure,export}'),
  ('hr','reges','all',          '{read,create,update,transmit,configure,export}')
)
insert into public.role_permissions (organization_id, role, resource, action, scope)
select null, m.rol::public.app_role, m.resursa, a, m.scop::public.permission_scope
from m, lateral unnest(m.actiuni::text[]) as a
on conflict (organization_id, member_id, role, resource, action) where deleted_at is null do nothing;

commit;
