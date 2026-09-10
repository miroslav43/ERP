-- supabase/migrations/0135_registru_nomenclator_si_rezolvare.sql
--
-- REGISTRUL DE DOCUMENTE — FUNDAȚIA PENTRU ACOPERIRE TOTALĂ.
--
-- Specificația: `docs/superpowers/specs/2026-09-10-registru-acoperire-totala-design.md`.
-- Continuă `0120_registru_documente.sql`, care a construit registrul și l-a legat
-- de două surse. Migrarea asta repară trei abateri de la textul actelor și pune
-- mecanica de care are nevoie conectarea tuturor surselor (0136).
--
-- ── CE A RATAT 0120 ─────────────────────────────────────────────────────────
--
-- 1. INDICATIVUL DOSARULUI. Ordinul de zi 217/1996 art. 9 enumeră elementele
--    înregistrării, iar lista NU se termină cu „numărul de înregistrare al
--    documentului la care se conexează”, cum s-a citat în 0120. Textul autentic,
--    verificat pe PDF-ul de pe site-ul Arhivelor Naționale, continuă:
--
--      „… şi indicativul dosarului după nomenclator, care se va stabili şi
--       completa în registru după rezolvarea documentului.”
--
--    Art. 11 îl definește: cifră romană (compartiment) + literă majusculă
--    (subdiviziune) + cifră arabă (dosar). Tot art. 11 cere ca indicativul să
--    figureze „în registrul de intrare-ieşire, la rubrica rezervată acestuia,
--    CA ŞI PE FIECARE DOCUMENT ÎN PARTE”.
--
-- 2. RĂSPUNSURILE. Art. 9, textual: „În cazul documentelor expediate ca răspuns,
--    acestea vor primi numărul de înregistrare al documentului la care se
--    răspunde.” 0120 aloca un număr proaspăt la fiecare INSERT. Decizia care
--    aprobă o cerere de concediu ar fi luat număr nou, contra art. 9.
--
--    Același articol cere pe rând coloanele „data expedierii”, „modul rezolvării”
--    și „destinatarul” — adică modelul de registratură clasic: UN RÂND PER CAZ,
--    iar răspunsul se consemnează pe rândul cererii. De aici
--    `internal.rezolva_document`, care NU alocă număr și NU inserează rând.
--
-- 3. ÎNCHIDEREA EXERCIȚIULUI. 0120 a creat garda care blochează un an închis, dar
--    nicio funcție care să pună `stare = 'inchis'`. Pe codul de până acum o firmă
--    nu putea ajunge niciodată în starea aia, deci OMFP 2634/2015 pct. 58 lit. h)
--    rămânea neacoperit în fapt.
--
-- ── DE CE INSERAREA DIRECTĂ SE ÎNCHIDE ──────────────────────────────────────
-- 0120 a lăsat o politică INSERT pentru `registru:update`, gândită ca portiță
-- deliberată. Problema: clientul ar trimite el `numar` și `numar_afisat`, adică
-- ar putea fabrica un număr sau repeta unul — exact ce interzice pct. 58 lit. o).
-- Politica se retrage, grantul se revocă, iar înregistrarea manuală (necesară
-- pentru documentele INTRATE pe hârtie, art. 8) trece prin
-- `public.inregistreaza_document_manual`, care alocă numărul ea însăși.
--
-- ── ⚠️ TERMENELE DE PĂSTRARE DIN NOMENCLATORUL IMPLICIT ─────────────────────
-- Valorile din §6 sunt un punct de plecare, NU un aviz. Sursele: OMFP 2634/2015
-- pct. 38-40 (state de salarii 50 de ani; celelalte documente financiar-contabile
-- 10 ani) și HG 1425/2006 (fișa de instruire se păstrează de la angajare până la
-- încetarea raportului de muncă). Nomenclatorul se confirmă de Arhivele Naționale
-- — art. 11 — și fiecare firmă îl poate modifica. Vezi `NOTES.md`.
--
-- Forward-only: 0120 și 0124 NU se editează.

\set ON_ERROR_STOP on

begin;

-- =====================================================================================
-- 1. Coloane noi pe registru_documente
-- =====================================================================================

alter table public.registru_documente
  -- art. 9: „indicativul dosarului după nomenclator”. Se completează automat din
  -- `nomenclator_tipuri` la înregistrare; art. 9 spune că se stabilește „după
  -- rezolvarea documentului”, deci lipsa lui NU blochează nimic.
  add column if not exists indicativ_dosar text
    check (indicativ_dosar is null or char_length(btrim(indicativ_dosar)) between 1 and 32),
  -- Momentul rezolvării. `data_expedierii`, `mod_rezolvare` și `destinatar`
  -- existau din 0120; le lipsea marcajul că un caz s-a închis.
  add column if not exists rezolvat_la timestamptz,
  add column if not exists rezolvat_de uuid references auth.users (id) on delete set null;

comment on column public.registru_documente.indicativ_dosar is
  'Ordin 217/1996 art. 9 și art. 11 — indicativul dosarului după nomenclator, în forma '
  '„II.A.3”, „II.3” sau „3”. Se tipărește și pe document, nu doar în registru.';

comment on column public.registru_documente.rezolvat_la is
  'Ordin 217/1996 art. 9 — un rând per caz. Răspunsul NU ia număr nou: închide rândul '
  'cererii, completând data expedierii, modul rezolvării și destinatarul.';

-- =====================================================================================
-- 2. Nomenclatorul dosarelor — Ordin 217/1996 art. 10-11
-- =====================================================================================
--
-- Un rând per dosar, cu compartimentul și subdiviziunea DENORMALIZATE: exact forma
-- tabelului din anexa nr. 1 a instrucțiunilor. Trei tabele normalizate ar fi mai
-- „curate” și ar semăna mai puțin cu formularul pe care îl vede inspectorul.

create table public.nomenclator_dosare (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations (id) on delete cascade,
  -- Rubrica 1 din anexa 1: compartimentele de muncă, „în ordinea în care figurează
  -- în schema de organizare a creatorului”, numerotate cu cifre romane.
  compartiment_cifra     text not null check (compartiment_cifra ~ '^[IVXL]{1,6}$'),
  compartiment_denumire  text not null check (char_length(btrim(compartiment_denumire)) between 2 and 120),
  -- Rubrica 2: subdiviziunile, cu litere majuscule. Art. 11 spune că indicativul
  -- „poate fi format numai din litera majusculă şi cifra arabă sau numai din cifra
  -- arabă” — deci ambele niveluri de sus sunt opționale.
  subdiviziune_litera    text check (subdiviziune_litera ~ '^[A-Z]$'),
  subdiviziune_denumire  text check (subdiviziune_denumire is null
                                     or char_length(btrim(subdiviziune_denumire)) between 2 and 120),
  -- Rubrica 3: dosarele, cu cifre arabe, „începând cu nr. 1 la fiecare compartiment”.
  dosar_cifra            integer not null check (dosar_cifra between 1 and 999),
  continut               text not null check (char_length(btrim(continut)) between 3 and 500),
  -- Rubrica 4: termenul de păstrare. Text liber, fiindcă nomenclatoarele reale
  -- folosesc și „permanent”, și „CS” (când se schimbă), și numere de ani.
  termen_pastrare        text not null check (char_length(btrim(termen_pastrare)) between 1 and 20),
  -- Art. 11: cifra romană, litera majusculă și cifra arabă FORMEAZĂ indicativul.
  indicativ              text generated always as (
                           compartiment_cifra
                           || coalesce('.' || subdiviziune_litera, '')
                           || '.' || dosar_cifra::text
                         ) stored,
  observatii             text check (observatii is null or char_length(btrim(observatii)) <= 500),
  created_at             timestamptz not null default now(),
  created_by             uuid references auth.users (id) on delete set null,
  updated_at             timestamptz not null default now(),
  updated_by             uuid references auth.users (id) on delete set null,
  deleted_at             timestamptz,
  constraint nomenclator_dosare_subdiviziune_ck
    check ((subdiviziune_litera is null) = (subdiviziune_denumire is null))
);

comment on table public.nomenclator_dosare is
  'Nomenclatorul dosarelor — Ordin 217/1996 art. 10-11, după modelul din anexa nr. 1. '
  'Se întocmește de fiecare firmă și se CONFIRMĂ de Arhivele Naționale (art. 5 lit. a). '
  'Aplicația livrează un nomenclator implicit; firma îl adaptează.';

-- Leagă un tip de document de dosarul în care se clasează. Un tip se clasează
-- într-un singur dosar — de aici cheia unică pe (firmă, tip).
create table public.nomenclator_tipuri (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  tip_document    text not null check (tip_document ~ '^[a-z][a-z0-9_]{1,63}$'),
  dosar_id        uuid not null references public.nomenclator_dosare (id) on delete cascade,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id) on delete set null,
  deleted_at      timestamptz
);

-- Un rând per firmă: avizul Arhivelor Naționale pe nomenclator. Aplicația nu-l
-- poate obține, dar poate arăta că lipsește.
create table public.nomenclator_config (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  avizat_la             date,
  numar_aviz            text check (numar_aviz is null or char_length(btrim(numar_aviz)) between 1 and 60),
  directia_judeteana    text check (directia_judeteana is null
                                    or char_length(btrim(directia_judeteana)) between 2 and 120),
  observatii            text check (observatii is null or char_length(btrim(observatii)) <= 1000),
  created_at            timestamptz not null default now(),
  created_by            uuid references auth.users (id) on delete set null,
  updated_at            timestamptz not null default now(),
  updated_by            uuid references auth.users (id) on delete set null,
  deleted_at            timestamptz,
  constraint nomenclator_config_uq unique (organization_id)
);

-- =====================================================================================
-- 3. Indexuri — PARȚIALE, `where deleted_at is null`
-- =====================================================================================
--
-- Spre deosebire de `registru_documente`, care n-are ștergere logică (pct. 58 lit. d),
-- nomenclatorul e un document de lucru al firmei: un dosar scos din uz se șterge logic.

create unique index nomenclator_dosare_uq
  on public.nomenclator_dosare
     (organization_id, compartiment_cifra, coalesce(subdiviziune_litera, ''), dosar_cifra)
  where deleted_at is null;

create index nomenclator_dosare_org_idx
  on public.nomenclator_dosare (organization_id, compartiment_cifra, dosar_cifra)
  where deleted_at is null;

create unique index nomenclator_tipuri_uq
  on public.nomenclator_tipuri (organization_id, tip_document)
  where deleted_at is null;

create index nomenclator_tipuri_dosar_idx
  on public.nomenclator_tipuri (dosar_id)
  where deleted_at is null;

create index registru_documente_nerezolvate_idx
  on public.registru_documente (organization_id, an, numar)
  where rezolvat_la is null and anulat_la is null;

-- =====================================================================================
-- 4. RLS
-- =====================================================================================

alter table public.nomenclator_dosare  enable row level security;
alter table public.nomenclator_dosare  force  row level security;
alter table public.nomenclator_tipuri  enable row level security;
alter table public.nomenclator_tipuri  force  row level security;
alter table public.nomenclator_config  enable row level security;
alter table public.nomenclator_config  force  row level security;

-- =====================================================================================
-- 5. Politici — trio _select/_insert/_update, nicio politică DELETE
-- =====================================================================================
--
-- Citirea cere `registru:read`: indicativul e o coloană de registru, iar cine vede
-- registrul trebuie să poată vedea și clasificarea. Scrierea cere `registru:update`.

create policy nomenclator_dosare_select on public.nomenclator_dosare
  for select to authenticated
  using (
    app.is_platform_admin()
    or (organization_id = any ((select app.current_org_ids())::uuid[])
        and app.can(organization_id, 'registru', 'read', 'all'))
  );

create policy nomenclator_dosare_insert on public.nomenclator_dosare
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'registru', 'update', 'all')
  );

create policy nomenclator_dosare_update on public.nomenclator_dosare
  for update to authenticated
  using (organization_id = any ((select app.current_org_ids())::uuid[])
         and app.can(organization_id, 'registru', 'update', 'all'))
  with check (organization_id = any ((select app.current_org_ids())::uuid[])
         and app.can(organization_id, 'registru', 'update', 'all'));

create policy nomenclator_tipuri_select on public.nomenclator_tipuri
  for select to authenticated
  using (
    app.is_platform_admin()
    or (organization_id = any ((select app.current_org_ids())::uuid[])
        and app.can(organization_id, 'registru', 'read', 'all'))
  );

create policy nomenclator_tipuri_insert on public.nomenclator_tipuri
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'registru', 'update', 'all')
  );

create policy nomenclator_tipuri_update on public.nomenclator_tipuri
  for update to authenticated
  using (organization_id = any ((select app.current_org_ids())::uuid[])
         and app.can(organization_id, 'registru', 'update', 'all'))
  with check (organization_id = any ((select app.current_org_ids())::uuid[])
         and app.can(organization_id, 'registru', 'update', 'all'));

create policy nomenclator_config_select on public.nomenclator_config
  for select to authenticated
  using (
    app.is_platform_admin()
    or (organization_id = any ((select app.current_org_ids())::uuid[])
        and app.can(organization_id, 'registru', 'read', 'all'))
  );

create policy nomenclator_config_insert on public.nomenclator_config
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'registru', 'update', 'all')
  );

create policy nomenclator_config_update on public.nomenclator_config
  for update to authenticated
  using (organization_id = any ((select app.current_org_ids())::uuid[])
         and app.can(organization_id, 'registru', 'update', 'all'))
  with check (organization_id = any ((select app.current_org_ids())::uuid[])
         and app.can(organization_id, 'registru', 'update', 'all'));

-- =====================================================================================
-- 6. Nomenclatorul implicit
-- =====================================================================================
--
-- Șapte compartimente, generate din modulele aplicației. Fără subdiviziuni: art. 11
-- le lasă opționale, iar un nomenclator implicit cu trei niveluri ar fi mai greu de
-- adaptat decât de reconstruit.
--
-- ⚠️ Termenele sunt un punct de plecare, nu un aviz. Vezi antetul.

create or replace function internal.seed_nomenclator(p_organization_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_rand   record;
  v_dosar  uuid;
begin
  -- Firma are deja nomenclator? Nu se suprascrie: poate l-a adaptat.
  if exists (
    select 1 from public.nomenclator_dosare d
    where d.organization_id = p_organization_id and d.deleted_at is null
  ) then
    return;
  end if;

  for v_rand in
    select *
    from (values
      -- compartiment            denumire                                  dosar  conținut                                                        termen   tipuri
      ('I',   'Conducere și organizare',              1, 'Decizii și note interne ale conducerii',                        'permanent', array['decizie','decizie_interna']),
      ('I',   'Conducere și organizare',              2, 'Anunțuri și comunicări către salariați',                        '3',         array['nota_interna']),
      ('I',   'Conducere și organizare',              3, 'Puncte de lucru și afișaj obligatoriu',                         '5',         array['afis_punct_lucru']),
      ('I',   'Conducere și organizare',              4, 'Listări puse la dispoziția organelor de control',               '10',        array['listare_audit']),

      ('II',  'Resurse umane',                        1, 'Contracte individuale de muncă și acte adiționale',             '75',        array['contract_munca','act_aditional','act_aditional_telemunca']),
      ('II',  'Resurse umane',                        2, 'Fișe ale postului',                                             '75',        array['fisa_postului']),
      ('II',  'Resurse umane',                        3, 'Decizii de personal — suspendare, reluare, încetare',           '75',        array['decizie_suspendare','decizie_incetare']),
      ('II',  'Resurse umane',                        4, 'Adeverințe și documente eliberate salariaților',                '10',        array['adeverinta','adeverinta_salariat','adeverinta_vechime','adeverinta_venit','nda','anexa_proprietate_intelectuala','invitatie_inrolare']),
      ('II',  'Resurse umane',                        5, 'Cereri de concediu, compensări și zile libere',                 '5',         array['cerere_concediu','decizie_compensare_sarbatoare','decizie_compensare_ore']),
      ('II',  'Resurse umane',                        6, 'Evaluări profesionale',                                         '10',        array['fisa_evaluare']),
      ('II',  'Resurse umane',                        7, 'Dosare de personal — acte depuse de salariat',                  '75',        array['document_personal','certificat_medical','certificat_handicap']),
      ('II',  'Resurse umane',                        8, 'Autorizații și permise de muncă',                               '10',        array['autorizatie_personal','permis_munca']),
      ('II',  'Resurse umane',                        9, 'Transmiteri către registrul de evidență a salariaților',        '10',        array['transmitere_reges']),
      ('II',  'Resurse umane',                       10, 'Integrarea și ieșirea din firmă',                               '5',         array['dovada_integrare']),

      ('III', 'Financiar-contabil',                   1, 'State de plată',                                                '50',        array['stat_plata']),
      ('III', 'Financiar-contabil',                   2, 'Fluturași de salariu',                                          '50',        array['fluturas']),
      ('III', 'Financiar-contabil',                   3, 'Declarații fiscale',                                            '10',        array['d112']),
      ('III', 'Financiar-contabil',                   4, 'Note contabile și ordine bancare',                              '10',        array['nota_contabila','ordin_bancar']),
      ('III', 'Financiar-contabil',                   5, 'Ordine de deplasare și deconturi',                              '10',        array['ordin_deplasare','decont_deplasare']),
      ('III', 'Financiar-contabil',                   6, 'Foi colective de prezență',                                     '10',        array['foaie_colectiva_prezenta']),
      ('III', 'Financiar-contabil',                   7, 'Popriri și rețineri din salariu',                               '10',        array['adresa_poprire']),

      ('IV',  'Securitate și sănătate în muncă',       1, 'Fișe de instruire',                                             'CS',        array['fisa_instruire']),
      ('IV',  'Securitate și sănătate în muncă',       2, 'Evaluări de riscuri și planuri de prevenire',                   'permanent', array['evaluare_riscuri','plan_prevenire']),
      ('IV',  'Securitate și sănătate în muncă',       3, 'Permise de lucru',                                              '5',         array['permis_lucru_foc']),
      ('IV',  'Securitate și sănătate în muncă',       4, 'Procese-verbale de verificare și exerciții',                    '5',         array['pv_verificare_stingator','pv_exercitiu_evacuare']),
      ('IV',  'Securitate și sănătate în muncă',       5, 'Accidente de muncă și incidente periculoase',                   'permanent', array['comunicare_itm','pv_incident_periculos']),
      ('IV',  'Securitate și sănătate în muncă',       6, 'Boli profesionale',                                             'permanent', array['fisa_semnalare_bp']),
      ('IV',  'Securitate și sănătate în muncă',       7, 'Medicina muncii',                                               '10',        array['fisa_aptitudine']),
      ('IV',  'Securitate și sănătate în muncă',       8, 'Echipament individual de protecție',                            '5',         array['fisa_eip']),
      ('IV',  'Securitate și sănătate în muncă',       9, 'Comitetul de securitate și sănătate în muncă',                  '10',        array['pv_sedinta_cssm']),

      ('V',   'Administrativ și patrimoniu',           1, 'Procese-verbale de predare-primire',                            '10',        array['pv_predare_primire']),
      ('V',   'Administrativ și patrimoniu',           2, 'Mentenanță și intervenții la echipamente',                      '5',         array['pv_interventie']),
      ('V',   'Administrativ și patrimoniu',           3, 'Sesizări de defecțiune',                                        '3',         array['sesizare_defectiune']),
      ('V',   'Administrativ și patrimoniu',           4, 'Autorizații de funcționare',                                    'permanent', array['autorizatie_iscir','autorizatie_mediu']),

      ('VI',  'Parc auto',                             1, 'Foi de parcurs',                                                '5',         array['foaie_parcurs']),
      ('VI',  'Parc auto',                             2, 'Documente ale vehiculelor',                                     'CS',        array['document_vehicul']),

      ('VII', 'Formare profesională',                  1, 'Adeverințe de absolvire',                                       '10',        array['adeverinta_curs']),
      ('VII', 'Formare profesională',                  2, 'Dosare și materiale de curs',                                   '5',         array['dosar_curs'])
    ) as t(compartiment, denumire, dosar, continut, termen, tipuri)
  loop
    insert into public.nomenclator_dosare
      (organization_id, compartiment_cifra, compartiment_denumire, dosar_cifra, continut, termen_pastrare)
    values
      (p_organization_id, v_rand.compartiment, v_rand.denumire, v_rand.dosar, v_rand.continut, v_rand.termen)
    returning id into v_dosar;

    insert into public.nomenclator_tipuri (organization_id, tip_document, dosar_id)
    select p_organization_id, tip, v_dosar
    from unnest(v_rand.tipuri) as tip
    on conflict do nothing;
  end loop;

  insert into public.nomenclator_config (organization_id)
  values (p_organization_id)
  on conflict (organization_id) do nothing;
end;
$$;

comment on function internal.seed_nomenclator(uuid) is
  'Nomenclatorul implicit, generat din modulele aplicației — Ordin 217/1996 anexa nr. 1. '
  'Nu suprascrie un nomenclator existent. ⚠️ Termenele de păstrare se confirmă de '
  'contabil sau jurist și se avizează de Arhivele Naționale.';

-- =====================================================================================
-- 7. Firmele noi îl primesc singure; cele existente, acum
-- =====================================================================================

create or replace function internal.organizations_seed_nomenclator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform internal.seed_nomenclator(new.id);
  return null;
end;
$$;

create trigger zz_organizations_seed_nomenclator
  after insert on public.organizations
  for each row execute function internal.organizations_seed_nomenclator();

do $$
declare
  v_org uuid;
begin
  for v_org in select o.id from public.organizations o where o.deleted_at is null
  loop
    perform internal.seed_nomenclator(v_org);
  end loop;
end;
$$;

-- =====================================================================================
-- 8. Alocatorul completează indicativul
-- =====================================================================================
--
-- Aceeași semnătură ca în 0120, ca triggerele existente să nu se rupă. Singura
-- schimbare: caută dosarul după `tip_document` și scrie `indicativ_dosar`.
-- Un tip fără dosar în nomenclator lasă coloana goală — art. 9 spune că indicativul
-- „se va stabili şi completa în registru DUPĂ REZOLVAREA documentului”, deci lipsa
-- lui la înregistrare e conformă, nu o scăpare.

-- ⚠️ `create or replace` NU înlocuiește o funcție căreia îi adaugi un parametru,
-- nici măcar unul cu valoare implicită: semnătura diferă, deci PostgreSQL creează o
-- SUPRAÎNCĂRCARE. Cele două ar coexista, iar apelurile cu argumente numite din
-- triggerele lui 0120 ar deveni ambigue — „could not choose a best candidate
-- function”, la prima inserare de contract, nu la migrare. Versiunea veche se
-- retrage explicit. Triggerele lui 0120 rezolvă funcția la execuție, deci nu se rup.
drop function if exists internal.inregistreaza_document(
  uuid, public.registru_sens, text, text, text, uuid, text, date, text, text, uuid, date
);

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
  p_data_inregistrare      date default null,
  -- Backfill-ul din 0136 îl pune pe `true`. NU se poate corecta printr-un UPDATE
  -- ulterior: garda din 0120 rescrie coloana din `old`, tăcut.
  p_inregistrat_retroactiv boolean default false
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_data       date := coalesce(p_data_inregistrare, app.azi_local());
  v_an         integer := extract(year from v_data)::integer;
  v_numar      integer;
  v_id         uuid;
  v_indicativ  text;
begin
  -- Idempotență: al doilea apel pe aceeași entitate și același tip întoarce
  -- rândul existent, FĂRĂ să ardă un număr. Un stat de plată se descarcă de câte
  -- ori vrea contabilul; registrul îl are o singură dată.
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

  -- art. 9 și art. 11: indicativul dosarului după nomenclator.
  select d.indicativ into v_indicativ
  from public.nomenclator_tipuri t
  join public.nomenclator_dosare d on d.id = t.dosar_id and d.deleted_at is null
  where t.organization_id = p_organization_id
    and t.tip_document    = p_tip_document
    and t.deleted_at is null;

  v_numar := internal.aloca_numar_registru(p_organization_id, v_data);

  insert into public.registru_documente (
    organization_id, an, numar, numar_afisat, data_inregistrare, sens, tip_document,
    continut_rezumat, numar_document_emitent, data_document_emitent, emitent, destinatar,
    entitate_tip, entitate_id, punct_lucru_id, indicativ_dosar, inregistrat_retroactiv
  ) values (
    p_organization_id,
    v_an,
    v_numar,
    -- FĂRĂ `lpad` — vezi antetul lui 0120. Cu `padding = 1` ar trunchia orice număr
    -- de două cifre la prima, iar registrul s-ar bloca de la al zecelea document.
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
    p_punct_lucru_id,
    v_indicativ,
    p_inregistrat_retroactiv
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- =====================================================================================
-- 9. Rezolvarea — art. 9, documentele expediate ca răspuns
-- =====================================================================================
--
-- „În cazul documentelor expediate ca răspuns, acestea vor primi numărul de
-- înregistrare al documentului la care se răspunde.” Deci NU se alocă număr și NU
-- se inserează rând: se închide rândul cazului.
--
-- Zero rânduri afectate NU e eroare: un document poate să nu fie în registru dacă
-- sursa s-a conectat după ce el a fost creat. Capcana „UPDATE tăcut” din CLAUDE.md
-- se aplică scrierilor din aplicație; aici absența rândului e o stare legitimă.

create or replace function internal.rezolva_document(
  p_organization_id uuid,
  p_entitate_tip    text,
  p_entitate_id     uuid,
  p_mod_rezolvare   text,
  p_destinatar      text default null,
  p_data_expedierii date default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  update public.registru_documente r
     set mod_rezolvare   = p_mod_rezolvare,
         destinatar      = coalesce(p_destinatar, r.destinatar),
         data_expedierii = coalesce(p_data_expedierii, app.azi_local()),
         rezolvat_la     = now()
   where r.organization_id = p_organization_id
     and r.entitate_tip    = p_entitate_tip
     and r.entitate_id     = p_entitate_id
     and r.anulat_la is null
  returning r.id into v_id;

  return v_id;
end;
$$;

comment on function internal.rezolva_document is
  'Ordin 217/1996 art. 9 — un rând per caz. Răspunsul închide rândul cererii în loc să '
  'ardă un număr nou. Întoarce null dacă documentul nu e în registru, ceea ce e o stare '
  'legitimă pentru documentele create înainte de conectarea sursei.';

-- =====================================================================================
-- 10. Triggerul generic de înregistrare
-- =====================================================================================
--
-- 0136 conectează peste patruzeci de surse. Patruzeci de funcții aproape identice ar
-- fi patruzeci de locuri de greșit — și, în acest proiect, exact felul de fan-out
-- care a produs istoric erorile. Una singură, configurată din `TG_ARGV`:
--
--   [0] sens                     'intrare' | 'iesire' | 'intern'
--   [1] tip_document
--   [2] eticheta pentru rezumat
--   [3] coloana cu employee_id           (sau '')
--   [4] coloana cu numărul emitentului   (sau '')
--   [5] coloana cu data documentului     (sau '')
--   [6] coloana cu punct_lucru_id        (sau '')
--   [7] coloana de text adăugată la rezumat, unde nu există angajat (sau '')
--   [8] coloana de status care decide CÂND devine document  (sau '')
--   [9] statusurile care declanșează, separate prin virgulă  (sau '')
--  [10] coloana cu emitentul, pentru documentele INTRATE      (sau '')
--
-- ── DE CE PORTIȚA DE STATUS ─────────────────────────────────────────────────
-- O cerere de concediu în CIORNĂ nu e un document: n-a fost depusă. O foaie de
-- parcurs în draft, o evaluare de riscuri neaprobată, la fel. Dacă s-ar înregistra
-- la INSERT, fiecare ciornă abandonată ar arde un număr — golurile sunt permise,
-- dar un registru în care jumătate din numere sunt ciorne șterse nu spune nimic.
--
-- Cu portița, triggerul stă pe `insert or update`: înregistrează la inserare doar
-- dacă rândul se naște deja în starea potrivită, altfel la tranziția către ea.
-- Idempotența din `inregistreaza_document` face ca o a doua tranziție să nu ardă
-- un număr nou.
--
-- Triggerele se numesc `zz_*` ca să ruleze după celelalte pe aceeași tabelă.

-- Miezul, separat de trigger fiindcă îl folosește și backfill-ul din 0136. Primește
-- rândul ca `jsonb`, nu ca `record`: aceeași funcție trebuie să meargă și pe `new`
-- dintr-un trigger, și pe un rând citit cu SQL dinamic dintr-o tabelă oarecare.

create or replace function internal.registru_inreg_din_rand(
  p_tabela            text,
  p_rand              jsonb,
  p_sens              text,
  p_tip               text,
  p_eticheta          text,
  p_col_ang           text default null,
  p_col_numar         text default null,
  p_col_data          text default null,
  p_col_punct         text default null,
  p_col_extra         text default null,
  p_col_emit          text default null,
  p_data_inregistrare date default null,
  p_retroactiv        boolean default false
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sens    public.registru_sens := p_sens::public.registru_sens;
  v_org     uuid := (p_rand ->> 'organization_id')::uuid;
  v_angajat text;
  v_extra   text;
begin
  if v_org is null then
    return null;
  end if;

  if p_col_ang is not null and (p_rand ->> p_col_ang) is not null then
    select e.full_name into v_angajat
    from public.employees e
    where e.id = (p_rand ->> p_col_ang)::uuid;
  end if;

  -- Unde nu există angajat, rezumatul ia un text din rândul sursă — titlul unui
  -- anunț, codul unei evaluări de riscuri — ca registrul să nu aibă patruzeci de
  -- rânduri cu aceeași descriere.
  if v_angajat is null and p_col_extra is not null then
    v_extra := nullif(btrim(coalesce(p_rand ->> p_col_extra, '')), '');
  end if;

  return internal.inregistreaza_document(
    p_organization_id        => v_org,
    p_sens                   => v_sens,
    p_tip_document           => p_tip,
    p_continut_rezumat       => left(p_eticheta
                                     || coalesce(' — ' || v_angajat, '')
                                     || coalesce(' — ' || v_extra, ''), 500),
    p_entitate_tip           => p_tabela,
    p_entitate_id            => (p_rand ->> 'id')::uuid,
    p_numar_document_emitent => case when p_col_numar is not null
                                     then p_rand ->> p_col_numar end,
    p_data_document_emitent  => case when p_col_data is not null
                                     then (p_rand ->> p_col_data)::date end,
    -- La documentele INTRATE emitentul e altcineva — medicul, inspectoratul,
    -- asigurătorul — și se ia din sursă acolo unde există. La ce emitem noi,
    -- emitentul e firma.
    p_emitent                => case when v_sens = 'intrare'::public.registru_sens
                                     then case when p_col_emit is not null
                                               then p_rand ->> p_col_emit end
                                     else internal.registru_denumire_org(v_org) end,
    p_destinatar             => case when v_sens = 'iesire'::public.registru_sens
                                     then v_angajat end,
    p_punct_lucru_id         => case when p_col_punct is not null
                                     then (p_rand ->> p_col_punct)::uuid end,
    p_data_inregistrare      => p_data_inregistrare,
    p_inregistrat_retroactiv => p_retroactiv
  );
end;
$$;

-- Învelișul de trigger: portița de status, apoi miezul.

create or replace function internal.registru_inreg_generic()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rand      jsonb := to_jsonb(new);
  v_col_stare text := nullif(tg_argv[8], '');
  v_declans   text[] := string_to_array(nullif(tg_argv[9], ''), ',');
begin
  -- Portița de status: documentul se naște când sursa ajunge în starea potrivită.
  if v_col_stare is not null then
    if not ((v_rand ->> v_col_stare) = any (v_declans)) then
      return null;
    end if;
    -- La UPDATE, doar TRANZIȚIA contează. `old` se citește într-un `if` separat,
    -- nu într-un `and`: pe INSERT `old` nu e alocat, iar PL/pgSQL nu garantează
    -- evaluarea scurtcircuitată a operanzilor.
    if tg_op = 'UPDATE' then
      if (v_rand ->> v_col_stare) is not distinct from (to_jsonb(old) ->> v_col_stare) then
        return null;
      end if;
    end if;
  end if;

  perform internal.registru_inreg_din_rand(
    p_tabela    => tg_table_name,
    p_rand      => v_rand,
    p_sens      => tg_argv[0],
    p_tip       => tg_argv[1],
    p_eticheta  => tg_argv[2],
    p_col_ang   => nullif(tg_argv[3], ''),
    p_col_numar => nullif(tg_argv[4], ''),
    p_col_data  => nullif(tg_argv[5], ''),
    p_col_punct => nullif(tg_argv[6], ''),
    p_col_extra => nullif(tg_argv[7], ''),
    p_col_emit  => nullif(tg_argv[10], '')
  );

  return null;
end;
$$;

-- Perechea ei: închide rândul când sursa ajunge într-un status final.
--
--   [0] coloana de status
--   [1] statusurile finale, separate prin virgulă
--   [2] coloana cu employee_id pentru destinatar (sau '')

create or replace function internal.registru_rezolva_generic()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nou       jsonb := to_jsonb(new);
  v_vechi     jsonb := to_jsonb(old);
  v_col       text := tg_argv[0];
  v_finale    text[] := string_to_array(tg_argv[1], ',');
  v_col_ang   text := nullif(tg_argv[2], '');
  v_status    text := v_nou ->> v_col;
  v_angajat   text;
begin
  -- Nimic de făcut dacă statusul n-a mișcat sau nu e final.
  if v_status is null
     or v_status is not distinct from (v_vechi ->> v_col)
     or not (v_status = any (v_finale)) then
    return null;
  end if;

  if v_col_ang is not null and (v_nou ->> v_col_ang) is not null then
    select e.full_name into v_angajat
    from public.employees e
    where e.id = (v_nou ->> v_col_ang)::uuid;
  end if;

  perform internal.rezolva_document(
    p_organization_id => (v_nou ->> 'organization_id')::uuid,
    p_entitate_tip    => tg_table_name,
    p_entitate_id     => (v_nou ->> 'id')::uuid,
    p_mod_rezolvare   => v_status,
    p_destinatar      => v_angajat
  );

  return null;
end;
$$;

-- =====================================================================================
-- 11. Al doilea drum — documentele generate, fără rând în bază
-- =====================================================================================
--
-- Fluturașul, statul de plată, D112, nota contabilă, ordinul bancar, foaia colectivă
-- de prezență, afișul de punct de lucru și listarea de audit se produc la cerere; nu
-- există INSERT pe care să punem trigger.
--
-- Schema `public`, fiindcă `.rpc()` NU ajunge la schema `app` — PostgREST expune doar
-- `public`. Capcana e documentată în 0047, care există exact ca să repare greșeala
-- asta din 0045.
--
-- Poarta NU e `registru:*`: cine exportă un stat de plată n-are de ce să aibă cheia
-- registrului. E permisiunea modulului, dedusă din tipul documentului.

create or replace function public.inregistreaza_document_generat(
  p_organization_id  uuid,
  p_tip_document     text,
  p_continut_rezumat text,
  p_entitate_tip     text,
  p_entitate_id      uuid default null,
  p_punct_lucru_id   uuid default null
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_resursa text;
  v_actiune text;
  v_id      uuid;
  v_afisat  text;
begin
  -- `case` EXPLICIT: un tip necunoscut ridică P0001, nu alocă tăcut.
  case p_tip_document
    when 'fluturas', 'stat_plata', 'd112', 'nota_contabila', 'ordin_bancar'
      then v_resursa := 'payroll';     v_actiune := 'export';
    when 'foaie_colectiva_prezenta'
      then v_resursa := 'attendance';  v_actiune := 'read';
    when 'afis_punct_lucru'
      then v_resursa := 'departments'; v_actiune := 'update';
    when 'listare_audit'
      then v_resursa := 'audit';       v_actiune := 'read';
    else
      raise exception using errcode = 'P0001',
        message = 'Tipul de document „' || p_tip_document
               || '” nu are o poartă declarată pentru înregistrarea în registru.';
  end case;

  if not (
    p_organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(p_organization_id, v_resursa, v_actiune, 'all')
  ) then
    raise exception using errcode = 'P0001',
      message = 'Nu aveți dreptul de a genera acest document în această organizație.';
  end if;

  v_id := internal.inregistreaza_document(
    p_organization_id  => p_organization_id,
    p_sens             => 'intern'::public.registru_sens,
    p_tip_document     => p_tip_document,
    p_continut_rezumat => p_continut_rezumat,
    p_entitate_tip     => p_entitate_tip,
    p_entitate_id      => p_entitate_id,
    p_emitent          => internal.registru_denumire_org(p_organization_id),
    p_punct_lucru_id   => p_punct_lucru_id
  );

  select r.numar_afisat into v_afisat
  from public.registru_documente r where r.id = v_id;

  return v_afisat;
end;
$$;

comment on function public.inregistreaza_document_generat is
  'Înregistrează un document produs la cerere, fără rând în baza de date. Poarta e '
  'permisiunea MODULULUI, dedusă din tipul documentului — nu `registru:*`. Idempotentă: '
  'regenerarea aceluiași document nu arde un număr nou.';

-- =====================================================================================
-- 12. Înregistrarea manuală — art. 8, documentele INTRATE pe hârtie
-- =====================================================================================
--
-- Fără ea registrul e structural incomplet. O demisie pe hârtie, o adresă de la
-- inspectorat, o citație nu au rând în nicio tabelă, iar art. 8 cere înregistrarea
-- TUTUROR documentelor intrate. Codul muncii art. 81 obligă expres la înregistrarea
-- demisiei, iar refuzul dă salariatului dreptul s-o dovedească prin orice mijloc.
--
-- Fluxul de demisie NU există în aplicație — căutat în toate migrările și în tot
-- codul sursă, zero rezultate. Până se construiește, se înregistrează pe aici.
--
-- `sens = 'iesire'` e REFUZAT: ce emitem noi are o sursă în bază și un trigger.
-- O ieșire înregistrată manual ar fi un document pe care aplicația nu-l are.

create or replace function public.inregistreaza_document_manual(
  p_organization_id        uuid,
  p_sens                   text,
  p_tip_document           text,
  p_continut_rezumat       text,
  p_numar_document_emitent text default null,
  p_data_document_emitent  date default null,
  p_emitent                text default null,
  p_numar_file             integer default null,
  p_numar_anexe            integer default null,
  p_punct_lucru_id         uuid default null
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id     uuid;
  v_afisat text;
begin
  if not (
    p_organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(p_organization_id, 'registru', 'update', 'all')
  ) then
    raise exception using errcode = 'P0001',
      message = 'Nu aveți dreptul de a înregistra documente în această organizație.';
  end if;

  if p_sens not in ('intrare', 'intern') then
    raise exception using errcode = 'P0001',
      message = 'Manual se pot înregistra doar documente intrate sau de uz intern. '
             || 'Documentele pe care le emite aplicația se înregistrează singure.';
  end if;

  if char_length(btrim(coalesce(p_continut_rezumat, ''))) < 3 then
    raise exception using errcode = 'P0001',
      message = 'Conținutul documentului în rezumat este obligatoriu — Ordin 217/1996 art. 9.';
  end if;

  -- `p_entitate_id => null` ocolește idempotența deliberat: două adrese diferite
  -- primite în aceeași zi sunt două documente, fiecare cu numărul lui.
  v_id := internal.inregistreaza_document(
    p_organization_id        => p_organization_id,
    p_sens                   => p_sens::public.registru_sens,
    p_tip_document           => p_tip_document,
    p_continut_rezumat       => btrim(p_continut_rezumat),
    p_entitate_tip           => 'manual',
    p_entitate_id            => null,
    p_numar_document_emitent => p_numar_document_emitent,
    p_data_document_emitent  => p_data_document_emitent,
    p_emitent                => coalesce(p_emitent,
                                  case when p_sens = 'intern'
                                       then internal.registru_denumire_org(p_organization_id) end),
    p_punct_lucru_id         => p_punct_lucru_id
  );

  update public.registru_documente
     set numar_file  = p_numar_file,
         numar_anexe = p_numar_anexe
   where id = v_id;

  select r.numar_afisat into v_afisat
  from public.registru_documente r where r.id = v_id;

  return v_afisat;
end;
$$;

-- =====================================================================================
-- 13. Închiderea și redeschiderea exercițiului — pct. 58 lit. h)
-- =====================================================================================
--
-- Tabela `registru_exercitii` avea din 0120 toate coloanele; îi lipseau funcțiile.
--
-- Amprenta e un SHA-256 peste registrul anului, în ordinea numărului. Pct. 58 lit. d)
-- INTERZICE adăugările ulterioare; amprenta le face DETECTABILE. Mecanica e cea de la
-- `hr_issued_documents.continut_checksum`.

create or replace function public.inchide_exercitiu_registru(
  p_organization_id uuid,
  p_an              integer
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_total    integer;
  v_amprenta text;
begin
  if not (
    p_organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(p_organization_id, 'registru', 'update', 'all')
  ) then
    raise exception using errcode = 'P0001',
      message = 'Nu aveți dreptul de a închide registrul acestei organizații.';
  end if;

  if exists (
    select 1 from public.registru_exercitii e
    where e.organization_id = p_organization_id and e.an = p_an and e.stare = 'inchis'
  ) then
    raise exception using errcode = 'P0001',
      message = 'Registrul pe anul ' || p_an::text || ' este deja închis.';
  end if;

  if p_an >= extract(year from app.azi_local())::integer then
    raise exception using errcode = 'P0001',
      message = 'Un exercițiu se închide după 31 decembrie — Ordin 217/1996 art. 9.';
  end if;

  select count(*)::integer,
         encode(
           extensions.digest(
             coalesce(string_agg(
               r.numar::text || '|' || r.numar_afisat || '|' || r.tip_document || '|'
                 || r.continut_rezumat || '|' || coalesce(r.anulat_la::text, ''),
               E'\n' order by r.numar), ''),
             'sha256'),
           'hex')
    into v_total, v_amprenta
  from public.registru_documente r
  where r.organization_id = p_organization_id and r.an = p_an;

  insert into public.registru_exercitii
    (organization_id, an, stare, inchis_la, inchis_de, total_inregistrari, amprenta)
  values
    (p_organization_id, p_an, 'inchis', now(), auth.uid(), v_total, v_amprenta)
  on conflict (organization_id, an) do update
    set stare              = 'inchis',
        inchis_la          = now(),
        inchis_de          = auth.uid(),
        total_inregistrari = v_total,
        amprenta           = v_amprenta,
        updated_at         = now();

  return v_amprenta;
end;
$$;

comment on function public.inchide_exercitiu_registru(uuid, integer) is
  'OMFP 2634/2015 pct. 58 lit. h) — un exercițiu închis nu mai primește inserări sau '
  'modificări. Amprenta SHA-256 peste registrul anului face adăugările ulterioare '
  'DETECTABILE, conform lit. d).';

create or replace function public.redeschide_exercitiu_registru(
  p_organization_id uuid,
  p_an              integer,
  p_motiv           text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  -- Prag mai sus decât închiderea: redeschiderea rupe o listare deja dată la control.
  if not (
    p_organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(p_organization_id, 'organizations', 'update', 'all')
  ) then
    raise exception using errcode = 'P0001',
      message = 'Doar administratorul firmei poate redeschide un exercițiu închis.';
  end if;

  if char_length(btrim(coalesce(p_motiv, ''))) not between 3 and 500 then
    raise exception using errcode = 'P0001',
      message = 'Redeschiderea unui exercițiu cere un motiv, între 3 și 500 de caractere.';
  end if;

  -- `amprenta` NU se șterge: diferența față de registrul listat la control trebuie
  -- să rămână demonstrabilă. Cicatricea e permanentă.
  update public.registru_exercitii
     set stare              = 'deschis',
         redeschis_la       = now(),
         redeschis_de       = auth.uid(),
         motiv_redeschidere = btrim(p_motiv),
         updated_at         = now()
   where organization_id = p_organization_id
     and an = p_an
     and stare = 'inchis';

  if not found then
    raise exception using errcode = 'P0001',
      message = 'Registrul pe anul ' || p_an::text || ' nu este închis.';
  end if;
end;
$$;

-- =====================================================================================
-- 14. Inserarea directă în registru se închide
-- =====================================================================================
--
-- 0120 lăsase o politică INSERT pentru `registru:update`. Clientul ar fi trimis el
-- `numar` și `numar_afisat` — adică ar fi putut fabrica un număr sau repeta unul,
-- exact ce interzice pct. 58 lit. o). Numerele se alocă doar prin funcții.

drop policy if exists registru_documente_insert on public.registru_documente;
revoke insert on table public.registru_documente from authenticated;

-- =====================================================================================
-- 15. Actor, audit, granturi
-- =====================================================================================

do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array['nomenclator_dosare', 'nomenclator_tipuri', 'nomenclator_config']
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
-- 16. Coada REVOKE/GRANT pe funcții
-- =====================================================================================
--
-- Cele din `internal` nu se cheamă niciodată din TypeScript: poarta lor e dreptul de
-- a scrie DOCUMENTUL, verificat de RLS-ul tabelei sursă. Cele din `public` își
-- verifică singure permisiunea, în corp, fiindcă `security definer` ocolește RLS.

revoke all on function internal.seed_nomenclator(uuid) from public, anon, authenticated;
revoke all on function internal.organizations_seed_nomenclator() from public, anon, authenticated;
revoke all on function internal.registru_inreg_generic() from public, anon, authenticated;
revoke all on function internal.registru_inreg_din_rand(
  text, jsonb, text, text, text, text, text, text, text, text, text, date, boolean
) from public, anon, authenticated;
revoke all on function internal.registru_rezolva_generic() from public, anon, authenticated;
revoke all on function internal.rezolva_document(uuid, text, uuid, text, text, date)
  from public, anon, authenticated;
revoke all on function internal.inregistreaza_document(
  uuid, public.registru_sens, text, text, text, uuid, text, date, text, text, uuid, date, boolean
) from public, anon, authenticated;

revoke all on function public.inregistreaza_document_generat(uuid, text, text, text, uuid, uuid)
  from public, anon;
grant execute on function public.inregistreaza_document_generat(uuid, text, text, text, uuid, uuid)
  to authenticated;

revoke all on function public.inregistreaza_document_manual(
  uuid, text, text, text, text, date, text, integer, integer, uuid
) from public, anon;
grant execute on function public.inregistreaza_document_manual(
  uuid, text, text, text, text, date, text, integer, integer, uuid
) to authenticated;

revoke all on function public.inchide_exercitiu_registru(uuid, integer) from public, anon;
grant execute on function public.inchide_exercitiu_registru(uuid, integer) to authenticated;

revoke all on function public.redeschide_exercitiu_registru(uuid, integer, text) from public, anon;
grant execute on function public.redeschide_exercitiu_registru(uuid, integer, text) to authenticated;

commit;
