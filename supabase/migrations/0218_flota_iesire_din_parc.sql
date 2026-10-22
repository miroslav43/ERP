-- supabase/migrations/0218_flota_iesire_din_parc.sql
--
-- FLOTA, EXTENSIA F12h: IEȘIREA DIN PARC (VÂNZARE, CASARE, DAUNĂ TOTALĂ,
-- RADIERE, RESTITUIRE LA LOCATOR).
--
-- Specificația o numea `0215_flota_iesire_din_parc`; 0210–0212 le-a luat
-- mentenanța la integrare, iar traseele F12 s-au mutat toate cu +3, deci e 0218.
-- Tot din integrare, F3–F11 sunt pe disc 0199–0206 (specificația scria 0196–0204).
--
-- ── DE CE ───────────────────────────────────────────────────────────────────
-- Până acum ieșirea era un `<select>` în caseta „Modifică” plus un motiv text,
-- iar data o punea `internal.vehicles_normalizeaza` (azi, nu ziua vânzării).
-- Nimic nu se năștea din ea, deși după vânzare sau radiere firma are termene de
-- 30 de zile la primărie și la serviciul de înmatriculări. Riscul e tăcut: o
-- mașină vândută și netranscrisă rămâne pe firmă (amenzi, impozit, RCA).
--
-- ── CE ADUCE ────────────────────────────────────────────────────────────────
-- A. `public.vehicle_exits`: faptul ieșirii, IMUABIL (tip, dată, km, motiv). O
--    greșeală se ANULEAZĂ și se reface; nu se editează (Decizia 2).
-- B. `public.vehicle_exit_obligations`: termenele legale și recomandate, rânduri
--    proprii cu denumirea și temeiul copiate la creare (snapshot, Decizia 7),
--    proiectate în `expirables` cu `entity_type = 'vehicle_exit'`,
--    `entity_id = vehicle_id` (Decizia 5), deci intră în jobul zilnic din F5.
--    Termenele care curg de la radiere au `termen = null` până se bifează
--    radierea (Decizia 8): un rând `null` nu se proiectează.
-- C. Un SINGUR INSERT în `vehicle_exits` face atomic tot restul (Decizia 1):
--    închide alocarea deschisă LA DATA IEȘIRII (Decizia 15, nu acum), trece
--    vehiculul în `vandut`/`casat` (Decizia 3: fără statusuri noi), creează
--    termenele. Anularea readuce vehiculul `activ` și scoate termenele din alerte.
-- D. `vehicles_iesire_garda` (trigger NOU, nu o rescriere a normalizării,
--    Decizia 4): trecerea în/din `vandut`/`casat` vine doar din asistent sau din
--    contextul de serviciu.
-- E. Numărul și VIN-ul unui vehicul ieșit nu mai blochează un vehicul nou
--    (implicita I-h2): indexurile unice exclud vehiculele ieșite.
-- F. Backfill: fiecare vehicul deja ieșit primește o ieșire `preluata_din_istoric`
--    cu ZERO termene (Decizia 14: ar fi termene trecute, adică alerte false).
--
-- ── CE AM GĂSIT PE DISC (§8.0, grep pe numele reale, înaintea codului) ───────
--  · F4 (0200): `trip_sheets.data` există (generată, ziua României) → garda
--    „nicio foaie după data ieșirii” o folosește direct.
--  · F5 (0201): lista albă e un LITERAL în `internal.flota_rezumat` (forma
--    ultimă: 0214), nu în `conformitate_zilnica` → se rescrie `flota_rezumat`
--    de la 0214, cu `vehicle_exit`; pragurile (`flota_setari_praguri`, forma
--    0214) se oglindesc și pentru termenele de ieșire.
--  · F7 (0203): `internal.vsp_resincronizeaza_vehicul` (triggerul
--    `vehicles_service_sync`) se uită la `vehicles.status` → planurile de
--    service ies singure din semafor la ieșire și revin la anulare; nimic de
--    chemat în plus. Verificat în §13 (structural) și în probă (18).
--  · F9 (0204): ramura `driver_license` (numele efectiv). F11 (0206):
--    `vehicle_fine`; amenda NU se dezactivează la ieșire. `vehicle_incidents` NU
--    are `unique (id, organization_id)` → `incident_id` e FK simplu, iar
--    triggerul verifică firma și vehiculul (P0001).
--  · F12b (0214): ultima rescriere a `app.poate_vedea_expirabil` (ramura
--    `fuel_card`); cardurile reacționează singure la status
--    (`vehicles_carduri_resincronizeaza`). F12d (0216):
--    `vehicles_rezervari_la_iesire` anulează rezervările viitoare; la anularea
--    ieșirii ele NU revin. F12c (0215): PV-ul de restituire rămâne opțional
--    (implicita I-T5), semnalul e pe ecran.
--  · Auditul generic (`internal.audit_trigger`, 0017) ar fi scris în
--    `audit_logs` numele cumpărătorului (dată personală la persoana fizică, D6).
--    `internal.audit_campuri_excluse` (forma 0122) se rescrie cu
--    `vehicle_exits → {cumparator, pret}`.
--
-- ── DREPTURILE ──────────────────────────────────────────────────────────────
-- Nicio cheie nouă (Decizia 13). Citirea cere `vehicles:read = all` (implicita
-- I-h6: șoferul și managerul nu văd ieșirea), scrierea `vehicles:update = all`,
-- ca restul scrierilor pe vehicul. Termenele n-au politică de INSERT: le creează
-- doar generatorul (security definer).
--
-- Aplicare: psql byte-exact, după bancul local; producția cere confirmarea lui
-- Miro, separat pentru 0218.

begin;

-- ============================================================
-- 0. Verificări înainte (rulate pe bancul local, 22.10.2026)
-- ============================================================
-- Bancul pornește de pe o bază goală, deci toate patru întorc zero rânduri:
--   select status, count(*) from public.vehicles where deleted_at is null group by 1;
--   select count(*) from public.vehicles
--    where deleted_at is null and status in ('vandut','casat') and nullif(btrim(motiv_iesire),'') is null;
--   select entity_type, count(*) from public.expirables where deleted_at is null group by 1;
--   select organization_id, nr_inmatriculare, count(*) from public.vehicles
--    where deleted_at is null group by 1,2 having count(*) > 1;
-- Pe producție le rulează doar Miro (sau cineva cu acordul lui) înainte de
-- aplicare: agentul n-are acces la baza din cloud. Primele două dau mărimea
-- backfill-ului din §8; a treia, lista pe care garda din §6 o verifică oricum.

-- ============================================================
-- 1. Tipuri
-- ============================================================
create type public.vehicle_exit_type as enum
  ('vanzare', 'casare', 'dauna_totala', 'radiere', 'restituire_leasing');
-- Doar la `dauna_totala`: epava s-a vândut (mașina iese `vandut`) sau s-a casat.
create type public.vehicle_exit_wreck as enum ('instrainata', 'casata');
-- Doar la `radiere`: scoaterea din țară, furtul, retragerea la cerere.
create type public.vehicle_exit_dereg_reason as enum ('export', 'furt', 'retragere_depozitare');

-- ============================================================
-- 2. public.vehicle_exits
-- ============================================================
create table public.vehicle_exits (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations (id) on delete cascade,
  vehicle_id           uuid not null references public.vehicles (id) on delete cascade,
  tip                  public.vehicle_exit_type not null,
  destinatie_epava     public.vehicle_exit_wreck,
  motiv_radiere        public.vehicle_exit_dereg_reason,
  -- Ziua vânzării / a predării la dezmembrare / a scoaterii din țară / a
  -- declarării furtului / a PV-ului către locator. La daună totală: ziua
  -- înstrăinării sau a predării epavei.
  data_iesire          date not null,
  km_iesire            integer,
  -- Se copiază în `vehicles.motiv_iesire`.
  motiv                text not null,
  -- Text liber, fără CNP (D6). În afara auditului (§11).
  cumparator           text,
  pret                 numeric(14,2),
  nr_document          text,
  pastreaza_numarul    boolean not null default false,
  -- F11 (0206): incidentul care a dus la dauna totală. FK simplu: tabela nu are
  -- `unique (id, organization_id)`; firma și vehiculul le verifică triggerul.
  incident_id          uuid references public.vehicle_incidents (id) on delete set null,
  preluata_din_istoric boolean not null default false,
  observatii           text,
  anulat_la            timestamptz,
  anulat_de            uuid references auth.users (id) on delete set null,
  motiv_anulare        text,
  created_at           timestamptz not null default now(),
  created_by           uuid references auth.users (id) on delete set null,
  updated_at           timestamptz not null default now(),
  updated_by           uuid references auth.users (id) on delete set null,
  deleted_at           timestamptz,
  constraint vexit_epava_ck check ((tip = 'dauna_totala') = (destinatie_epava is not null)),
  constraint vexit_radiere_ck check ((tip = 'radiere') = (motiv_radiere is not null)),
  constraint vexit_km_ck check (km_iesire is null or km_iesire >= 0),
  -- Motivul vechi (backfill) poate avea sub 5 caractere: baza nu-l verifica.
  constraint vexit_motiv_ck check (
    char_length(motiv) <= 500
    and (preluata_din_istoric or char_length(btrim(motiv)) >= 5)
  ),
  constraint vexit_cumparator_ck check (
    cumparator is null
    or (char_length(cumparator) <= 200
        and (tip = 'vanzare' or (tip = 'dauna_totala' and destinatie_epava = 'instrainata')))
  ),
  constraint vexit_pret_ck check (
    pret is null
    or (pret >= 0 and pret <= 100000000
        and (tip = 'vanzare' or (tip = 'dauna_totala' and destinatie_epava = 'instrainata')))
  ),
  constraint vexit_nr_document_ck check (nr_document is null or char_length(nr_document) <= 60),
  constraint vexit_observatii_ck check (observatii is null or char_length(observatii) <= 1000),
  -- Păstrarea numărului are sens doar unde numărul rămâne al firmei: vânzare,
  -- casare, daună totală, export. La furt plăcuțele sunt furate, la depozitare
  -- și la leasing nu se cere.
  constraint vexit_pastreaza_ck check (
    not pastreaza_numarul
    or tip in ('vanzare', 'casare', 'dauna_totala')
    or (tip = 'radiere' and motiv_radiere = 'export')
  ),
  constraint vexit_incident_ck check (incident_id is null or tip = 'dauna_totala'),
  constraint vexit_anulare_ck check (
    (anulat_la is null and motiv_anulare is null)
    or (anulat_la is not null and motiv_anulare is not null
        and char_length(btrim(motiv_anulare)) between 5 and 500)
  )
);

-- O singură ieșire VIE (neanulată) pe vehicul.
create unique index vexit_vie_uq on public.vehicle_exits (vehicle_id)
  where anulat_la is null and deleted_at is null;
create index vexit_org_data_idx on public.vehicle_exits (organization_id, data_iesire desc)
  where deleted_at is null;
create index vexit_vehicul_idx on public.vehicle_exits (organization_id, vehicle_id)
  where deleted_at is null;

comment on table public.vehicle_exits is
  'Ieșirea din parc a unui vehicul (0218, F12h): vânzare, casare, daună totală, radiere, restituire la locator. Imuabilă; o greșeală se anulează (anulat_la) și se reface.';

-- ============================================================
-- 3. public.vehicle_exit_obligations
-- ============================================================
create table public.vehicle_exit_obligations (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations (id) on delete cascade,
  exit_id              uuid not null references public.vehicle_exits (id) on delete cascade,
  -- Denormalizat: e `entity_id` în `expirables` (Decizia 5).
  vehicle_id           uuid not null references public.vehicles (id) on delete cascade,
  -- E `kind` în `expirables`.
  cod                  text not null,
  denumire             text not null,
  natura               text not null,
  temei                text,
  nota                 text,
  ordine               smallint not null,
  depinde_de           text,
  zile_dupa_dependenta smallint,
  -- null = așteaptă pasul din `depinde_de`.
  termen               date,
  finalizat_la         date,
  finalizat_de         uuid references auth.users (id) on delete set null,
  nu_se_aplica         boolean not null default false,
  created_at           timestamptz not null default now(),
  created_by           uuid references auth.users (id) on delete set null,
  updated_at           timestamptz not null default now(),
  updated_by           uuid references auth.users (id) on delete set null,
  deleted_at           timestamptz,
  constraint vexob_cod_ck check (cod in (
    'impozit_local_instrainare', 'impozit_plata_an_dobandire', 'rca_notificare', 'rca_restituire',
    'casco_denuntare', 'verificare_transcriere', 'radiere_drpciv', 'predare_placute',
    'impozit_local_radiere', 'leasing_declaratie_impozit', 'pastrare_numar')),
  constraint vexob_natura_ck check (natura in ('legal', 'recomandat')),
  constraint vexob_denumire_ck check (char_length(denumire) between 1 and 200),
  constraint vexob_temei_ck check (temei is null or char_length(temei) <= 300),
  constraint vexob_nota_ck check (nota is null or char_length(nota) <= 1000),
  constraint vexob_dependenta_ck check (
    (depinde_de is null) = (zile_dupa_dependenta is null)
    and (zile_dupa_dependenta is null or zile_dupa_dependenta between 0 and 366)
  ),
  constraint vexob_inchis_ck check (not (finalizat_la is not null and nu_se_aplica))
);

create unique index vexob_iesire_cod_uq on public.vehicle_exit_obligations (exit_id, cod)
  where deleted_at is null;
create index vexob_org_deschise_idx on public.vehicle_exit_obligations (organization_id, termen)
  where deleted_at is null and finalizat_la is null and not nu_se_aplica;
create index vexob_vehicul_idx on public.vehicle_exit_obligations (organization_id, vehicle_id)
  where deleted_at is null;

comment on table public.vehicle_exit_obligations is
  'Termenele unei ieșiri din parc (0218, F12h), create de asistent; proiectate în expirables cu entity_type = vehicle_exit, entity_id = vehicle_id, kind = cod. termen null = așteaptă pasul din depinde_de.';

-- ============================================================
-- 4. Catalogul și generatorul
-- ============================================================
-- Catalogul există O SINGURĂ DATĂ, aici (Decizia 9): ecranul nu are o a doua
-- listă de denumiri, iar rândul păstrează textul din ziua creării (Decizia 7).
-- Naturile `recomandat` pe interpretări: implicita I-T3 (D4, D8), ⚠ contabil.
create or replace function internal.iesire_catalog()
returns table (cod text, denumire text, natura text, temei text, nota text, ordine smallint)
language sql
immutable
set search_path = ''
as $$
  select c.cod, c.denumire, c.natura, c.temei, c.nota, c.ordine::smallint
    from (values
      ('impozit_local_instrainare',
       'Declarația de scoatere din evidență la impozitul local',
       'recomandat',
       'Codul fiscal art. 471 alin. (5)',
       '⚠ Termenul de 30 de zile vine din art. 471 alin. (5), aplicat vânzării prin interpretare. Impozitul pe anul curent rămâne datorat de firmă (alin. 1) și se achită la înstrăinare (Codul de procedură fiscală art. 159 alin. 5). Confirmați cu contabilul.',
       10),
      ('impozit_plata_an_dobandire',
       'Plata impozitului: vehicul cumpărat și vândut în același an',
       'recomandat',
       'Codul fiscal art. 471 alin. (1^1)',
       '⚠ Regulă introdusă de OUG 7/2026: un singur termen de plată, data înstrăinării. Confirmați calculul cu contabilul.',
       20),
      ('leasing_declaratie_impozit',
       'Declarația fiscală la încetarea leasingului',
       'legal',
       'Codul fiscal art. 471 alin. (6) lit. c)',
       'Termenul de 30 de zile curge de la procesul-verbal de predare către locator.',
       30),
      ('radiere_drpciv',
       'Cererea de radiere la serviciul de înmatriculări',
       'legal',
       'OMAI 181/2024 art. 24 alin. (2)',
       'La casarea cu certificat de distrugere, radierea se poate face și din oficiu (art. 24 alin. 5 lit. a). Verificați; dacă s-a făcut, marcați pasul „Făcut” cu data radierii.',
       40),
      ('predare_placute',
       'Predarea certificatului de înmatriculare și a plăcuțelor',
       'legal',
       'OMAI 181/2024 art. 24 alin. (2) și art. 25 alin. (1) lit. a)',
       'Se depun odată cu cererea de radiere; termenul de 30 de zile e al radierii.',
       50),
      ('impozit_local_radiere',
       'Declarația de radiere la impozitul local',
       'legal',
       'Codul fiscal art. 471 alin. (4)',
       'Termenul de 30 de zile curge de la data radierii. La radierea la cerere, obligațiile la bugetul local se achită până la data radierii.',
       60),
      ('rca_notificare',
       'Notificarea asigurătorului RCA despre transmiterea vehiculului',
       'recomandat',
       'Legea 132/2017 art. 7 lit. a), art. 8 alin. (2)',
       'Polița încetează la data notificării, iar prima rămasă se recuperează proporțional. Legea nu dă un termen: cele 5 zile sunt interne, ca prima să nu se piardă.',
       70),
      ('rca_restituire',
       'Cererea de restituire a primei RCA după radiere',
       'recomandat',
       'Legea 132/2017 art. 7 lit. b), art. 8 alin. (2)',
       'Polița încetează la data radierii; prima rămasă se recuperează proporțional, dacă nu s-au plătit și nu se datorează despăgubiri.',
       80),
      ('casco_denuntare',
       'Denunțarea poliței CASCO',
       'recomandat',
       'Contractul CASCO',
       'Condițiile și termenul le dă contractul; cele 5 zile sunt interne.',
       90),
      ('verificare_transcriere',
       'Verificarea transcrierii pe numele cumpărătorului',
       'recomandat',
       'OUG 195/2002 art. 11 alin. (4), (4^3)',
       'Cumpărătorul are 90 de zile să ceară transcrierea; altfel înmatricularea se suspendă, iar amenzile pot veni pe firmă.',
       100),
      ('pastrare_numar',
       'Cererea de păstrare a numărului de înmatriculare',
       'recomandat',
       'OMAI 181/2024 art. 27 alin. (1), (3)',
       'Se poate cere doar până la radiere sau transcriere. Păstrarea ține un an și se prelungește, în total cel mult trei ani.',
       110)
    ) as c(cod, denumire, natura, temei, nota, ordine);
$$;

comment on function internal.iesire_catalog() is
  'Catalogul termenelor de ieșire din parc (0218, F12h): denumirea, natura, temeiul și nota fiecărui cod. Copiat pe rând la creare.';

-- Proiecția unui termen în `expirables`. Cheia de acolo e
-- (org, 'vehicle_exit', vehicle_id, cod), deci e COMUNĂ tuturor ieșirilor unui
-- vehicul: pe o ieșire anulată, funcția iese fără efect dacă vehiculul are o
-- ieșire vie (altfel `sync_expirable(…, null)` ar șterge rândul ieșirii VII cu
-- același cod). Rândul ieșirii anulate a fost șters deja, la anulare.
-- Responsabilul e null intenționat: vehiculul ieșit n-are șofer, iar rezumatul
-- flotei trimite la responsabili sau la administratori.
create or replace function internal.iesire_sincronizeaza_obligatia(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_o      public.vehicle_exit_obligations%rowtype;
  v_iesire public.vehicle_exits%rowtype;
  v_nr     text;
  v_vdel   timestamptz;
  v_activ  boolean;
begin
  select * into v_o from public.vehicle_exit_obligations o where o.id = p_id;
  if not found then
    return;
  end if;
  select * into v_iesire from public.vehicle_exits e where e.id = v_o.exit_id;
  select v.nr_inmatriculare, v.deleted_at into v_nr, v_vdel
    from public.vehicles v where v.id = v_o.vehicle_id;

  if (v_iesire.anulat_la is not null or v_iesire.deleted_at is not null)
     and exists (select 1 from public.vehicle_exits e
                  where e.vehicle_id = v_o.vehicle_id and e.id <> v_o.exit_id
                    and e.anulat_la is null and e.deleted_at is null) then
    return;
  end if;

  v_activ := v_iesire.anulat_la is null and v_iesire.deleted_at is null
             and v_vdel is null and v_o.deleted_at is null
             and v_o.termen is not null and v_o.finalizat_la is null and not v_o.nu_se_aplica;

  perform internal.sync_expirable(
    v_o.organization_id,
    'vehicle_exit',
    v_o.vehicle_id,
    v_o.cod,
    left(v_o.denumire || ' — ' || coalesce(v_nr, ''), 200),
    case when v_activ then v_o.termen else null end,
    'vehicle_exit_obligations',
    null,
    true
  );
end;
$$;

-- Termenele unei ieșiri, după regulile din specificație (§4). `D` = data
-- ieșirii. „RCA curent” = document neșters, curent, de tipul cu `cod = 'rca'`,
-- valabil în ziua ieșirii; la fel CASCO. Termenele „pe zile” sunt D + N zile
-- calendaristice (E19): mai devreme sau egal cu termenul legal, niciodată mai
-- târziu. Constanta de 5 zile pentru asigurători e internă (implicita I-h3).
create or replace function internal.iesire_genereaza_obligatii(p_exit public.vehicle_exits)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d              date := p_exit.data_iesire;
  v_achizitie    date;
  v_instrainare  boolean;
  v_casare       boolean;
  v_furt         boolean;
  v_depozitare   boolean;
  v_leasing      boolean;
  v_rca          boolean;
  v_casco        boolean;
  v_acelasi_an   boolean;
begin
  select v.data_achizitie into v_achizitie from public.vehicles v where v.id = p_exit.vehicle_id;

  v_instrainare := p_exit.tip = 'vanzare'
                   or (p_exit.tip = 'dauna_totala' and p_exit.destinatie_epava = 'instrainata');
  -- Exportul are aceleași termene ca o casare (E8 lit. b).
  v_casare      := p_exit.tip = 'casare'
                   or (p_exit.tip = 'dauna_totala' and p_exit.destinatie_epava = 'casata')
                   or (p_exit.tip = 'radiere' and p_exit.motiv_radiere = 'export');
  v_furt        := p_exit.tip = 'radiere' and p_exit.motiv_radiere = 'furt';
  v_depozitare  := p_exit.tip = 'radiere' and p_exit.motiv_radiere = 'retragere_depozitare';
  v_leasing     := p_exit.tip = 'restituire_leasing';
  v_acelasi_an  := v_achizitie is not null
                   and extract(year from v_achizitie) = extract(year from d);

  select exists (
           select 1 from public.vehicle_documents x
             join public.vehicle_document_types t on t.id = x.document_type_id
            where x.vehicle_id = p_exit.vehicle_id and x.organization_id = p_exit.organization_id
              and x.deleted_at is null and x.este_curent and t.cod = 'rca' and x.expira_la >= d),
         exists (
           select 1 from public.vehicle_documents x
             join public.vehicle_document_types t on t.id = x.document_type_id
            where x.vehicle_id = p_exit.vehicle_id and x.organization_id = p_exit.organization_id
              and x.deleted_at is null and x.este_curent and t.cod = 'casco' and x.expira_la >= d)
    into v_rca, v_casco;

  insert into public.vehicle_exit_obligations
    (organization_id, exit_id, vehicle_id, cod, denumire, natura, temei, nota, ordine,
     depinde_de, zile_dupa_dependenta, termen, created_by, updated_by)
  select p_exit.organization_id, p_exit.id, p_exit.vehicle_id, c.cod, c.denumire,
         coalesce(p.natura, c.natura), c.temei,
         left(nullif(concat_ws(' ', c.nota, p.nota_extra), ''), 1000),
         c.ordine, p.depinde_de, p.zile, p.termen, p_exit.created_by, p_exit.created_by
    from (values
      ('impozit_local_instrainare', d + 30, null::text, null::smallint, null::text, null::text,
       v_instrainare),
      ('impozit_plata_an_dobandire', d, null, null, null, null,
       v_instrainare and v_acelasi_an),
      ('leasing_declaratie_impozit', d + 30, null, null, null, null,
       v_leasing),
      -- La retragerea la cerere radierea e o alegere, nu o obligație (E9).
      ('radiere_drpciv', d + 30, null, null,
       case when v_depozitare then 'recomandat' end, null,
       v_casare or v_furt or v_depozitare),
      -- La furt, în locul plăcuțelor se depune dovada furtului (E11).
      ('predare_placute', d + 30, null, null, null, null,
       v_casare or v_depozitare),
      ('impozit_local_radiere', null::date, 'radiere_drpciv', 30::smallint, null,
       case when v_depozitare
            then 'Reînmatricularea în anul următor face impozitul datorat pe tot anul reînmatriculării (art. 471 alin. 4^1).' end,
       v_casare or v_furt or v_depozitare),
      ('rca_notificare', d + 5, null, null, null,
       case when v_leasing
            then '⚠ La leasing, polița e de regulă pe numele utilizatorului: verificați cu asigurătorul cine notifică.' end,
       (v_instrainare or v_leasing) and v_rca),
      ('rca_restituire', null::date, 'radiere_drpciv', 5::smallint, null, null,
       (v_casare or v_furt or v_depozitare) and v_rca),
      -- La furt, CASCO-ul acoperă tocmai paguba: polița nu se denunță.
      ('casco_denuntare', d + 5, null, null, null, null,
       (v_instrainare or v_casare) and v_casco),
      ('verificare_transcriere', d + 90, null, null, null, null,
       v_instrainare),
      ('pastrare_numar', d, null, null, null, null,
       (v_instrainare or v_casare) and p_exit.pastreaza_numarul)
    ) as p(cod, termen, depinde_de, zile, natura, nota_extra, se_aplica)
    join internal.iesire_catalog() c on c.cod = p.cod
   where p.se_aplica;

  perform internal.iesire_sincronizeaza_obligatia(o.id)
     from public.vehicle_exit_obligations o
    where o.exit_id = p_exit.id and o.deleted_at is null;
end;
$$;

-- ============================================================
-- 5. Triggere
-- ============================================================
-- Steagul tranzacțional `app.flota_iesire = 'on'`: scrierile pe `vehicles` și
-- pe termene vin din asistent. Fiecare scriere îl pune și apoi îl readuce la
-- valoarea dinainte (steagurile se pot imbrica: anularea → vehicul → ...).

-- (a) BEFORE INSERT OR UPDATE pe vehicle_exits: gărzile.
create or replace function internal.iesire_inainte()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.vehicles%rowtype;
begin
  if tg_op = 'UPDATE' then
    -- `motiv` (copiat în vehicles.motiv_iesire) și `deleted_at` sunt în tuplu:
    -- fără `deleted_at`, o ieșire vie s-ar fi „șters” prin API, vexit_vie_uq
    -- s-ar fi eliberat, iar vehiculul ar fi rămas vândut, fără cale de anulare.
    if (new.organization_id, new.vehicle_id, new.tip, new.destinatie_epava, new.motiv_radiere,
        new.data_iesire, new.km_iesire, new.preluata_din_istoric, new.pastreaza_numarul,
        new.motiv, new.incident_id, new.deleted_at, new.created_at, new.created_by)
       is distinct from
       (old.organization_id, old.vehicle_id, old.tip, old.destinatie_epava, old.motiv_radiere,
        old.data_iesire, old.km_iesire, old.preluata_din_istoric, old.pastreaza_numarul,
        old.motiv, old.incident_id, old.deleted_at, old.created_at, old.created_by)
       and not app.is_service_context() then
      raise exception using errcode = 'P0001',
        message = 'Tipul, data și kilometrajul ieșirii nu se mai pot schimba. Anulați ieșirea și înregistrați-o din nou.';
    end if;
    -- O ieșire anulată e istoric: nimic de pe ea nu se mai schimbă (nici observațiile).
    if old.anulat_la is not null and not app.is_service_context() then
      raise exception using errcode = 'P0001', message = 'Ieșirea este deja anulată.';
    end if;
    if new.anulat_la is not null and old.anulat_la is null then
      new.anulat_de := auth.uid();
      -- Vehiculul șters logic nu mai revine în parc: anularea ar reactiva
      -- scadențele unui rând care n-ar fi trebuit să existe.
      if exists (select 1 from public.vehicles x
                  where x.id = new.vehicle_id and x.deleted_at is not null) then
        raise exception using errcode = 'P0001',
          message = 'Ieșirea unui vehicul șters nu se mai poate anula.';
      end if;
    elsif not app.is_service_context() then
      new.anulat_de := old.anulat_de;   -- nu vine din payload
    end if;
    return new;
  end if;

  -- §8: backfill-ul, doar din migrare (context de serviciu), fără gărzi și fără efecte.
  if coalesce(current_setting('app.flota_iesire_backfill', true), '') = 'on'
     and app.is_service_context() then
    return new;
  end if;
  new.preluata_din_istoric := false;   -- dublat de politica de INSERT
  new.anulat_de := null;               -- anulat_la și motiv_anulare le păzesc politica și check-ul

  select * into v from public.vehicles x where x.id = new.vehicle_id and x.deleted_at is null;
  if not found or v.organization_id <> new.organization_id then
    raise exception using errcode = 'P0001',
      message = 'Vehiculul ales nu aparține organizației dumneavoastră.';
  end if;
  if v.status in ('vandut', 'casat') then
    raise exception using errcode = 'P0001', message = 'Vehiculul este deja ieșit din parc.';
  end if;
  if new.data_iesire > app.azi_local() then
    raise exception using errcode = 'P0001',
      message = 'Data ieșirii nu poate fi în viitor. Înregistrați ieșirea în ziua în care are loc.';
  end if;
  if v.data_achizitie is not null and new.data_iesire < v.data_achizitie then
    raise exception using errcode = 'P0001',
      message = 'Data ieșirii este înaintea datei achiziției.';
  end if;
  if new.km_iesire is not null and new.km_iesire < v.km_curent then
    raise exception using errcode = 'P0001', message = format(
      'Kilometrajul la ieșire (%s km) este mai mic decât ultimul cunoscut al vehiculului (%s km).',
      new.km_iesire, v.km_curent);
  end if;
  -- `iesire_dupa_insert` scrie km_restituire = km_iesire pe alocarea deschisă,
  -- iar `va_km_ck` (0173) cere km_restituire >= km_predare. km_predare NU e legat
  -- de km_curent (0173), deci poate fi mai mare: fără garda asta, omul primea un
  -- 23514 brut, cu numele check-ului.
  if new.km_iesire is not null and exists (
       select 1 from public.vehicle_assignments a
        where a.vehicle_id = new.vehicle_id and a.pana_la is null and a.deleted_at is null
          and a.km_restituire is null and a.km_predare > new.km_iesire) then
    raise exception using errcode = 'P0001',
      message = 'Kilometrajul la ieșire este mai mic decât cel de la predarea mașinii către șoferul actual.';
  end if;
  -- F4 (0200): `trip_sheets.data` e ziua foii, ora României.
  if exists (select 1 from public.trip_sheets t
              where t.vehicle_id = new.vehicle_id and t.deleted_at is null
                and t.status <> 'respins' and t.data > new.data_iesire) then
    raise exception using errcode = 'P0001',
      message = 'Data ieșirii este înaintea unor foi de parcurs ale vehiculului. Alegeți data reală a ieșirii sau ștergeți foile greșite.';
  end if;
  if new.incident_id is not null and not exists (
       select 1 from public.vehicle_incidents i
        where i.id = new.incident_id and i.organization_id = new.organization_id
          and i.vehicle_id = new.vehicle_id and i.deleted_at is null) then
    raise exception using errcode = 'P0001',
      message = 'Incidentul ales nu aparține acestui vehicul.';
  end if;
  return new;
end;
$$;

-- (b) AFTER INSERT pe vehicle_exits: alocare → vehicul → termene.
create or replace function internal.iesire_dupa_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Decizia 15: sfârșitul zilei de ieșire, ora României, sau acum, dacă e mai devreme.
  v_moment timestamptz := least(now(),
    ((new.data_iesire + 1)::timestamp at time zone 'Europe/Bucharest') - interval '1 second');
  v_status public.vehicle_status := case
    when new.tip in ('vanzare', 'restituire_leasing') then 'vandut'
    when new.tip = 'dauna_totala' and new.destinatie_epava = 'instrainata' then 'vandut'
    else 'casat' end;
  v_steag text := coalesce(current_setting('app.flota_iesire', true), '');
begin
  if new.preluata_din_istoric then
    return null;
  end if;

  -- Alocarea se închide la data ieșirii, ÎNAINTEA schimbării de status: când
  -- rulează `vehicles_inchide_alocarea` (0173, cu now()), nu mai găsește nimic.
  update public.vehicle_assignments a
     set pana_la = greatest(v_moment, a.de_la + interval '1 second'),
         km_restituire = coalesce(a.km_restituire, new.km_iesire),
         updated_at = now(),
         updated_by = new.created_by
   where a.vehicle_id = new.vehicle_id and a.pana_la is null and a.deleted_at is null;

  perform set_config('app.flota_iesire', 'on', true);
  update public.vehicles v
     set status = v_status,
         data_iesire = new.data_iesire,
         motiv_iesire = new.motiv,
         updated_at = now(),
         updated_by = new.created_by
   where v.id = new.vehicle_id;
  perform set_config('app.flota_iesire', v_steag, true);

  perform internal.iesire_genereaza_obligatii(new);
  return null;
end;
$$;

-- (c) AFTER UPDATE pe vehicle_exits: anularea. Vehiculul revine `activ` (cu
-- steagul; normalizarea golește data_iesire/motiv_iesire, `vehicles_dupa`
-- reactivează scadențele documentelor, F7 și F12b pe ale lor). Termenele
-- rămân în tabelă (istoric), dar ies din alerte. Alocarea și rezervările NU
-- revin: o predare e un fapt fizic, cu km, și se înregistrează din nou.
create or replace function internal.iesire_dupa_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_steag text := coalesce(current_setting('app.flota_iesire', true), '');
begin
  if not (old.anulat_la is null and new.anulat_la is not null) then
    return null;
  end if;

  perform set_config('app.flota_iesire', 'on', true);
  update public.vehicles v
     set status = 'activ',
         updated_at = now(),
         updated_by = new.updated_by
   where v.id = new.vehicle_id and v.deleted_at is null and v.status in ('vandut', 'casat');
  perform set_config('app.flota_iesire', v_steag, true);

  perform internal.iesire_sincronizeaza_obligatia(o.id)
     from public.vehicle_exit_obligations o
    where o.exit_id = new.id;
  return null;
end;
$$;

create trigger iesiri_inainte
  before insert or update on public.vehicle_exits
  for each row execute function internal.iesire_inainte();
create trigger iesiri_dupa_insert
  after insert on public.vehicle_exits
  for each row execute function internal.iesire_dupa_insert();
create trigger iesiri_dupa_update
  after update on public.vehicle_exits
  for each row execute function internal.iesire_dupa_update();

-- (d) BEFORE UPDATE pe vehicle_exit_obligations: omul bifează, asistentul decide.
create or replace function internal.iesire_termen_inainte()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iesire    public.vehicle_exits%rowtype;
  v_achizitie date;
begin
  -- Recalculul dependenților (`iesire_termen_dupa`) și generatorul.
  if coalesce(current_setting('app.flota_iesire', true), '') = 'on' then
    return new;
  end if;

  -- Cine a închis termenul: din sesiune, niciodată din payload. Și la „Nu se
  -- aplică”: decizia are și ea un autor.
  if (new.finalizat_la, new.nu_se_aplica) is distinct from (old.finalizat_la, old.nu_se_aplica) then
    new.finalizat_de := case when new.finalizat_la is not null or new.nu_se_aplica
                             then auth.uid() end;
  else
    new.finalizat_de := old.finalizat_de;
  end if;

  if app.is_service_context() then
    return new;
  end if;

  if (new.organization_id, new.exit_id, new.vehicle_id, new.cod, new.denumire, new.natura,
      new.temei, new.ordine, new.depinde_de, new.zile_dupa_dependenta, new.termen,
      new.created_at, new.created_by, new.deleted_at)
     is distinct from
     (old.organization_id, old.exit_id, old.vehicle_id, old.cod, old.denumire, old.natura,
      old.temei, old.ordine, old.depinde_de, old.zile_dupa_dependenta, old.termen,
      old.created_at, old.created_by, old.deleted_at) then
    raise exception using errcode = 'P0001',
      message = 'Termenul și natura obligației le stabilește asistentul de ieșire.';
  end if;

  select * into v_iesire from public.vehicle_exits e where e.id = new.exit_id;
  if v_iesire.anulat_la is not null or v_iesire.deleted_at is not null then
    raise exception using errcode = 'P0001',
      message = 'Ieșirea din parc a fost anulată. Termenele ei nu se mai modifică.';
  end if;

  if new.finalizat_la is not null and new.finalizat_la is distinct from old.finalizat_la then
    if new.finalizat_la > app.azi_local() then
      raise exception using errcode = 'P0001',
        message = 'Data la care s-a făcut pasul nu poate fi în viitor.';
    end if;
    -- Păstrarea numărului se cere de regulă ÎNAINTE de vânzare (art. 27 alin. 1):
    -- limita de jos e achiziția, nu ieșirea.
    if new.cod = 'pastrare_numar' then
      select v.data_achizitie into v_achizitie from public.vehicles v where v.id = new.vehicle_id;
      if v_achizitie is not null and new.finalizat_la < v_achizitie then
        raise exception using errcode = 'P0001',
          message = 'Data la care s-a făcut pasul este înaintea datei achiziției vehiculului.';
      end if;
    elsif new.finalizat_la < v_iesire.data_iesire then
      raise exception using errcode = 'P0001',
        message = 'Data la care s-a făcut pasul este înaintea datei ieșirii din parc.';
    end if;
  end if;

  -- Redeschiderea unui pas de care depinde un termen deja făcut.
  if ((old.finalizat_la is not null and new.finalizat_la is null)
      or (old.nu_se_aplica and not new.nu_se_aplica))
     and exists (select 1 from public.vehicle_exit_obligations d
                  where d.exit_id = new.exit_id and d.depinde_de = new.cod
                    and d.deleted_at is null and d.finalizat_la is not null) then
    raise exception using errcode = 'P0001',
      message = 'Un termen care depinde de acesta este deja făcut. Redeschideți-l întâi pe acela.';
  end if;

  -- „Nu se aplică” pe un pas cu dependenți deschiși i-ar lăsa fără termen pentru
  -- totdeauna (nu apar în alerte, nu primesc dată). Cazul real: casarea cu
  -- certificat de distrugere, unde radierea vine din oficiu (E10).
  if new.nu_se_aplica and not old.nu_se_aplica
     and exists (select 1 from public.vehicle_exit_obligations d
                  where d.exit_id = new.exit_id and d.depinde_de = new.cod
                    and d.deleted_at is null and d.finalizat_la is null and not d.nu_se_aplica) then
    raise exception using errcode = 'P0001',
      message = 'De pasul ăsta depind alte termene. Dacă radierea s-a făcut din oficiu, marcați-o „Făcut” cu data radierii; altfel închideți întâi termenele care depind de ea.';
  end if;

  return new;
end;
$$;

-- (e) AFTER UPDATE pe vehicle_exit_obligations: proiecția, apoi dependenții.
create or replace function internal.iesire_termen_dupa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_steag text := coalesce(current_setting('app.flota_iesire', true), '');
begin
  perform internal.iesire_sincronizeaza_obligatia(new.id);

  if new.finalizat_la is distinct from old.finalizat_la then
    perform set_config('app.flota_iesire', 'on', true);
    update public.vehicle_exit_obligations d
       set termen = case when new.finalizat_la is null then null
                         else new.finalizat_la + d.zile_dupa_dependenta end,
           updated_at = now(),
           updated_by = new.updated_by
     where d.exit_id = new.exit_id and d.depinde_de = new.cod and d.deleted_at is null;
    perform set_config('app.flota_iesire', v_steag, true);
  end if;
  return null;
end;
$$;

create trigger termene_iesire_inainte
  before update on public.vehicle_exit_obligations
  for each row execute function internal.iesire_termen_inainte();
create trigger termene_iesire_dupa
  after update on public.vehicle_exit_obligations
  for each row execute function internal.iesire_termen_dupa();

-- (f) BEFORE UPDATE pe vehicles — trigger NOU (Decizia 4). Sortează înaintea lui
-- `vehicles_normalizeaza`, deci răspunde primul; citește doar statusul.
create or replace function internal.vehicles_iesire_garda()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if ((new.status in ('vandut', 'casat')) is distinct from (old.status in ('vandut', 'casat')))
     and coalesce(current_setting('app.flota_iesire', true), '') <> 'on'
     and not app.is_service_context() then
    raise exception using errcode = 'P0001', message = case
      when new.status in ('vandut', 'casat')
        then 'Ieșirea din parc se înregistrează din fișa vehiculului, butonul „Scoate din parc”.'
      -- Nu începe cu „Vehiculul”: `traduEroare` (/^Vehiculul/u) l-ar pune pe
      -- câmpul `vehicle_id`, pe care caseta „Modifică” nu-l are.
      else 'Revenirea în parc se face prin anularea ieșirii, din secțiunea „Ieșirea din parc”.'
    end;
  end if;
  return new;
end;
$$;

create trigger vehicles_iesire_garda
  before update on public.vehicles
  for each row execute function internal.vehicles_iesire_garda();

-- (g) AFTER UPDATE pe vehicles: ștergerea logică scoate termenele din alerte
-- (rândul n-ar fi trebuit să existe), iar numărul nou ajunge în eticheta lor.
create or replace function internal.vehicles_iesire_dupa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (old.deleted_at, old.nr_inmatriculare) is distinct from (new.deleted_at, new.nr_inmatriculare) then
    perform internal.iesire_sincronizeaza_obligatia(o.id)
       from public.vehicle_exit_obligations o
       join public.vehicle_exits e on e.id = o.exit_id
      where o.vehicle_id = new.id and e.anulat_la is null and e.deleted_at is null;
  end if;
  return null;
end;
$$;

create trigger vehicles_iesire_dupa
  after update on public.vehicles
  for each row execute function internal.vehicles_iesire_dupa();

-- ============================================================
-- 6. app.poate_vedea_expirabil — rescrisă INTEGRAL de la forma ultimă (0214)
-- ============================================================
-- O singură ramură nouă: `vehicle_exit`, doar cu `vehicles:read = all`
-- (implicita I-h6). Implicitul rămâne `else false`: o ramură pierdută ar face
-- invizibile, tăcut, scadențele acelui tip. Garda e în §13.
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
    -- 0218 (F12h): termenele ieșirii din parc. Doar `all`: vehiculul ieșit n-are
    -- șofer, iar ieșirea o vede doar cine administrează parcul (I-h6).
    when 'vehicle_exit'             then app.feature_on(p_organization_id,'fleet')       and app.can(p_organization_id,'vehicles','read','all')
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
-- 7. Pragurile și rezumatul zilnic al flotei (lista albă din F5)
-- ============================================================
-- Forma 0214, cu o singură schimbare: oglinda în `alert_rules` se scrie și
-- pentru termenele ieșirii din parc, ca pragurile din `/flota/setari` să
-- valoreze pentru tot ce trimite rezumatul flotei.
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
  -- (`vehicle_service`); 0214: și pentru valabilitatea cardurilor (`fuel_card`);
  -- 0218: și pentru termenele ieșirii din parc (`vehicle_exit`).
  insert into public.alert_rules as r
    (organization_id, entity_type, kind, praguri_zile, alerteaza_la_depasire, valabil_de_la)
  select new.organization_id, t.entity_type, '*', new.praguri_alerta_zile, true, app.azi_local()
    from unnest(array['vehicle_document', 'vehicle_service', 'fuel_card', 'vehicle_exit']) as t(entity_type)
  on conflict (organization_id, entity_type, kind, valabil_de_la) where deleted_at is null
  do update set praguri_zile = excluded.praguri_zile;
  return null;
end;
$$;

-- Firmele care și-au schimbat deja pragurile primesc și regula pentru termenele
-- de ieșire (tiparul din 0203 și 0214). Fără rând de setări, sau cu implicitele,
-- motorul aplică oricum 30/14/7.
insert into public.alert_rules (organization_id, entity_type, kind, praguri_zile, alerteaza_la_depasire, valabil_de_la)
select s.organization_id, 'vehicle_exit', '*', s.praguri_alerta_zile, true, app.azi_local()
  from public.fleet_settings s
 where s.deleted_at is null
   and s.praguri_alerta_zile is distinct from internal.praguri_implicite()
on conflict (organization_id, entity_type, kind, valabil_de_la) where deleted_at is null
do nothing;

-- Forma 0214, cu: `vehicle_exit` în lista albă (entity_id = vehiculul, deci
-- legătura generică `/flota/<id>` duce la fișa lui, Decizia 5); termenele de
-- ieșire ajung DOAR la destinatarii cu `vehicles:read = all` (implicita I-h6: un
-- responsabil cu `team` care vede pool-ul n-ar avea voie să afle ieșirea); două
-- numărători noi în titlu; eticheta spune „termen”, nu „expiră”. Fără termene
-- de ieșire, textul și legătura sunt EXACT cele de până acum.
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
           (x.entity_type = 'vehicle_exit') as e_iesire,
           c.id            as card_id,
           x.expires_at,
           x.label || ': ' ||
             case when a.status = 'expirat'
                  then case when x.entity_type = 'vehicle_service' then 'scadent din '
                            when x.entity_type = 'vehicle_exit' then 'termen depășit din '
                            else 'expirat din ' end
                       || to_char(x.expires_at, 'DD.MM.YYYY')
                  else case when x.entity_type = 'vehicle_service' then 'scadent pe '
                            when x.entity_type = 'vehicle_exit' then 'termen pe '
                            else 'expiră pe ' end
                       || to_char(x.expires_at, 'DD.MM.YYYY') end as eticheta
      from public.compliance_alerts a
      join public.expirables x on x.id = a.expirable_id
      left join public.fuel_cards c
        on x.entity_type = 'fuel_card'
       and c.id = x.entity_id
       and c.organization_id = p_org
       and c.deleted_at is null
      left join public.vehicles v
        on v.id = case when x.entity_type = 'fuel_card' then c.vehicle_id else x.entity_id end
       and v.organization_id = p_org
       and v.deleted_at is null
     where a.organization_id = p_org
       and a.deleted_at is null
       and a.status in ('nou', 'expirat')
       and x.organization_id = p_org
       and x.deleted_at is null
       and x.is_active
       -- LISTA ALBĂ a flotei (0203: și scadențele de service pe dată; 0214: și
       -- valabilitatea cardurilor; 0218: și termenele ieșirii din parc). SSM și
       -- HR se adaugă aici, cu legătura lor.
       and x.entity_type in ('vehicle_document', 'vehicle_service', 'fuel_card', 'vehicle_exit')
       -- Documentele și service-ul sunt ale unui vehicul din parc; cardul poate
       -- fi pe un șofer sau de rezervă, dar cardul însuși trebuie să existe.
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
     where not exists (select 1 from vizibile z
                        where z.expirable_id = e.expirable_id
                          -- 0218: un responsabil cu `team` „vede” pool-ul ieșit,
                          -- dar termenul de ieșire nu i se trimite (filtrul din
                          -- `noi`): fără clauza asta, termenul n-ar mai ajunge nici
                          -- la administratori.
                          and (not z.e_iesire
                               or internal.scope_membru(p_org, z.user_id, 'vehicles', 'read') = 'all'))
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
       -- 0218: termenele ieșirii din parc doar cu `vehicles:read = all` (I-h6).
       and (not d.e_iesire or s.scope = 'all')
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
           n.e_iesire, n.expires_at, n.eticheta, n.scope
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
           count(*) filter (where n.depasita and not n.e_service and not n.e_card and not n.e_iesire)::integer     as depasite,
           count(*) filter (where not n.depasita and not n.e_service and not n.e_card and not n.e_iesire)::integer as apropiate,
           count(*) filter (where n.depasita and n.e_service)::integer         as srv_depasite,
           count(*) filter (where not n.depasita and n.e_service)::integer     as srv_apropiate,
           count(*) filter (where n.e_service)::integer                        as srv_total,
           count(*) filter (where n.depasita and n.e_card)::integer            as card_depasite,
           count(*) filter (where not n.depasita and n.e_card)::integer        as card_apropiate,
           count(*) filter (where n.e_card)::integer                           as card_total,
           count(*) filter (where n.depasita and n.e_iesire)::integer          as iesire_depasite,
           count(*) filter (where not n.depasita and n.e_iesire)::integer      as iesire_apropiate,
           count(*) filter (where n.e_iesire)::integer                         as iesire_total,
           count(distinct n.vehicle_id)::integer               as vehicule,
           count(distinct n.card_id)::integer                  as carduri,
           max(n.expires_at)                                   as ultima_scadenta,
           (array_agg(n.vehicle_id order by n.rn) filter (where n.vehicle_id is not null))[1] as primul_vehicul,
           (array_agg(n.card_id order by n.rn) filter (where n.card_id is not null))[1]       as primul_card,
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
             case when o.iesire_depasite > 0 then internal.flota_numarat(o.iesire_depasite, 'termen de ieșire din parc depășit', 'termene de ieșire din parc depășite') end,
             case when o.iesire_apropiate > 0 then internal.flota_numarat(o.iesire_apropiate, 'termen de ieșire din parc în curând', 'termene de ieșire din parc în curând') end
           ], null), ', ') || '.', 200),
           left(o.linii || case when o.total > 8
                                then E'\n… și încă ' || internal.flota_numarat(o.total - 8, 'document', 'documente') || '.'
                                else '' end, 4000),
           case
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
             -- 0218: termenele de ieșire nu sunt documente, deci nu-l deschid.
             when o.card_total = 0 and o.srv_total + o.iesire_total < o.total and o.ultima_scadenta <= v_azi + 30 then '/flota?conformitate=expira'
             else '/flota'
           end,
           case when o.card_total = 0 and o.vehicule = 1 then 'vehicle'
                when o.card_total = o.total and o.carduri = 1 then 'fuel_card'
                else 'fleet_rezumat' end,
           case when o.card_total = 0 and o.vehicule = 1 then o.primul_vehicul
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
  'Rezumatul zilnic al scadențelor de flotă pe dată (vehicle_document, din 0203 vehicle_service, din 0214 fuel_card, din 0218 vehicle_exit doar pentru vehicles:read = all) pentru o firmă: o notificare per destinatar, doar cu elementele netrimise lui. Idempotentă: a doua rulare din aceeași zi nu scrie nimic.';

-- ============================================================
-- 8. Backfill: vehiculele deja ieșite
-- ============================================================
-- Zero termene (Decizia 14): ar fi termene trecute, adică alerte false la prima
-- rulare a jobului. Triggerul (a) lasă rândul așa cum e doar sub steag ȘI în
-- context de serviciu (migrarea rulează ca `postgres`).
select set_config('app.flota_iesire_backfill', 'on', true);
insert into public.vehicle_exits (organization_id, vehicle_id, tip, data_iesire, motiv,
                                  preluata_din_istoric, created_by, updated_by)
select v.organization_id, v.id,
       case v.status when 'vandut' then 'vanzare'::public.vehicle_exit_type
                     else 'casare'::public.vehicle_exit_type end,
       coalesce(v.data_iesire, (v.updated_at at time zone 'Europe/Bucharest')::date),
       left(coalesce(nullif(btrim(v.motiv_iesire), ''), 'Ieșire înregistrată înainte de asistent (0218).'), 500),
       true, coalesce(v.updated_by, v.created_by), coalesce(v.updated_by, v.created_by)
  from public.vehicles v
 where v.deleted_at is null and v.status in ('vandut', 'casat');
select set_config('app.flota_iesire_backfill', '', true);

-- Baza n-a cerut niciodată motivul, deci un vehicul ieșit poate avea
-- `motiv_iesire` null. Caseta „Modifică” îl retrimite neschimbat, iar
-- `actualizeazaVehiculSchema` (src/schemas/fleet.ts) cere motiv la vândut/casat:
-- fără completarea asta, NICIUN câmp al vehiculului ieșit nu mai putea fi
-- salvat. Statusul nu se schimbă, deci garda §5 (f) nu intervine.
update public.vehicles v
   set motiv_iesire = 'Ieșire înregistrată înainte de asistent (0218).', updated_at = now()
 where v.deleted_at is null and v.status in ('vandut', 'casat')
   and nullif(btrim(v.motiv_iesire), '') is null;

-- ============================================================
-- 9. Unicitatea numărului și a VIN-ului (implicita I-h2)
-- ============================================================
-- Numărul păstrat (E14) se pune pe mașina nouă, iar o mașină vândută și
-- cumpărată înapoi are același VIN: vehiculul ieșit nu le mai blochează. O
-- anulare care s-ar ciocni de un vehicul activ cu același număr dă 23505, tradus.
drop index public.vehicles_org_nr_uq;
create unique index vehicles_org_nr_uq on public.vehicles (organization_id, nr_inmatriculare)
  where deleted_at is null and status not in ('vandut', 'casat');
drop index public.vehicles_org_vin_uq;
create unique index vehicles_org_vin_uq on public.vehicles (organization_id, vin)
  where vin is not null and deleted_at is null and status not in ('vandut', 'casat');

-- ============================================================
-- 10. RLS (FORCE pe ambele)
-- ============================================================
-- Fără `deleted_at` în USING-ul de SELECT (0016/0018): ștergerea logică cu
-- RETURNING ar cădea pe propria politică. Nicio politică DELETE.
alter table public.vehicle_exits enable row level security;
alter table public.vehicle_exits force row level security;
alter table public.vehicle_exit_obligations enable row level security;
alter table public.vehicle_exit_obligations force row level security;

create policy iesiri_select on public.vehicle_exits
for select to authenticated
using (
  (select app.is_platform_admin())
  or (organization_id = any ((select app.current_org_ids())::uuid[])
      and app.feature_on(organization_id, 'fleet')
      and app.has_permission(organization_id, 'vehicles', 'read') = 'all')
);

create policy iesiri_insert on public.vehicle_exits
for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
  and deleted_at is null
  and anulat_la is null
  and not preluata_din_istoric
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy iesiri_update on public.vehicle_exits
for update to authenticated
using (
  deleted_at is null
  and organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
)
with check (
  deleted_at is null
  and organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
  and updated_by = (select auth.uid())
);

create policy termene_iesire_select on public.vehicle_exit_obligations
for select to authenticated
using (
  (select app.is_platform_admin())
  or (organization_id = any ((select app.current_org_ids())::uuid[])
      and app.feature_on(organization_id, 'fleet')
      and app.has_permission(organization_id, 'vehicles', 'read') = 'all')
);

-- Fără politică de INSERT: termenele le creează doar generatorul (security
-- definer). Lipsa politicii (și a grantului) = refuz 42501 pentru
-- `authenticated`, iar asta e intenția.
create policy termene_iesire_update on public.vehicle_exit_obligations
for update to authenticated
using (
  deleted_at is null
  and organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
)
with check (
  deleted_at is null
  and organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
  and updated_by = (select auth.uid())
);

-- ============================================================
-- 11. Actor, audit, drepturi
-- ============================================================
-- Flota NU are `internal.set_actor`: `created_by`/`updated_by` se trimit explicit
-- din acțiuni (capcana 23), iar politicile le cer. Abatere deliberată de la
-- buclă: termenele primesc DOAR `select, update` (fără insert, vezi §10).
do $$
declare t text;
begin
  foreach t in array array['vehicle_exits', 'vehicle_exit_obligations'] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function internal.seteaza_updated_at()',
      t || '_set_updated_at', t);
    perform internal.attach_audit(t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant %s on public.%I to authenticated',
                   case when t = 'vehicle_exit_obligations' then 'select, update'
                        else 'select, insert, update' end, t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end
$$;

-- Cumpărătorul e o dată personală când e persoană fizică (D6), iar prețul ține
-- de contract: niciunul nu intră în `audit_logs`. Forma 0122, cu o ramură nouă.
create or replace function internal.audit_campuri_excluse(p_table text)
returns text[] language sql immutable set search_path = '' as $$
  select case p_table
    when 'leave_requests' then
      array['medical_code_id', 'serie_certificat', 'numar_certificat', 'motiv', 'atasament_path']
    -- Jetonul Expo e o capabilitate purtătoare (cine îl are trimite push
    -- arbitrar pe telefonul omului); restul rândului — organization_id,
    -- platforma, deleted_at — chiar merită urmărit în audit.
    when 'dispozitive_push' then
      array['jeton']
    -- 0218 (F12h): numele cumpărătorului (persoană fizică = dată personală) și prețul.
    when 'vehicle_exits' then
      array['cumparator', 'pret']
    else '{}'::text[]
  end;
$$;

revoke all on function internal.audit_campuri_excluse(text) from public, anon, authenticated;

comment on function internal.audit_campuri_excluse(text) is
  'Listă albă de câmpuri excluse din audit_logs, per tabelă (tg_table_name). Citită din tg_table_name, NU din TG_ARGV — o re-rulare a internal.attach_audit(tabelă) nu o poate șterge tăcut (0017). Extinsă în 0122 cu `dispozitive_push` și în 0218 cu `vehicle_exits`.';

revoke all on function internal.iesire_catalog() from public, anon, authenticated;
revoke all on function internal.iesire_genereaza_obligatii(public.vehicle_exits) from public, anon, authenticated;
revoke all on function internal.iesire_sincronizeaza_obligatia(uuid) from public, anon, authenticated;
revoke all on function internal.iesire_inainte() from public, anon, authenticated;
revoke all on function internal.iesire_dupa_insert() from public, anon, authenticated;
revoke all on function internal.iesire_dupa_update() from public, anon, authenticated;
revoke all on function internal.iesire_termen_inainte() from public, anon, authenticated;
revoke all on function internal.iesire_termen_dupa() from public, anon, authenticated;
revoke all on function internal.vehicles_iesire_garda() from public, anon, authenticated;
revoke all on function internal.vehicles_iesire_dupa() from public, anon, authenticated;
revoke all on function internal.flota_setari_praguri() from public, anon, authenticated;
revoke all on function internal.flota_rezumat(uuid) from public, anon, authenticated;
grant execute on function internal.iesire_sincronizeaza_obligatia(uuid) to service_role;
grant execute on function internal.flota_rezumat(uuid) to service_role;
revoke all on function app.poate_vedea_expirabil(uuid, text) from public, anon;
grant execute on function app.poate_vedea_expirabil(uuid, text) to authenticated;

-- ============================================================
-- 12. Note de proiectare
-- ============================================================
-- · Statusul rămâne `vandut`/`casat` (D1, I-h1): o valoare nouă de enum ar fi
--   rupt tăcut fiecare `in ('vandut','casat')` din 0012, 0018, 0171, 0173, 0203,
--   0214, 0216. Detaliul stă în `vehicle_exits.tip`; pastila de pe fișă arată
--   tipul ieșirii.
-- · `expirables.entity_id = vehicle_id` (Decizia 5): linkul generic al
--   rezumatului duce la fișă. Unicitatea `(org, tip, entitate, kind)` ține
--   fiindcă un vehicul are cel mult o ieșire vie (vexit_vie_uq).
-- · Ieșirea retroactivă e cazul obișnuit (vândută vineri, introdusă luni):
--   alocarea se închide la sfârșitul zilei ieșirii; dacă alocarea a început
--   DUPĂ ea (o greșeală), `pana_la = de_la + 1 s`.
-- · Contextul de serviciu (seed, importuri) poate scrie `status = 'casat'`
--   direct: rezultatul e un vehicul ieșit fără rând `vehicle_exits`. Acceptat.
-- · Radierea din oficiu (casare cu certificat de distrugere, E10) se marchează
--   „Făcut” cu data ei, nu „Nu se aplică”: altfel `impozit_local_radiere` și
--   `rca_restituire` n-ar primi niciodată termen (garda din (d)).
-- · Amenda unei fapte de dinainte de vânzare (F11) rămâne activă după ieșire.

-- ============================================================
-- 13. Verificare
-- ============================================================
do $$
declare
  v_lipsa text[] := '{}';
  v_t     text;
  v_def   text;
  v_n     integer;
  v_m     integer;
begin
  foreach v_t in array array['vehicle_exits', 'vehicle_exit_obligations'] loop
    if to_regclass('public.' || v_t) is null then
      v_lipsa := v_lipsa || v_t;
      continue;
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
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'vehicle_exits') <> 3 then
    v_lipsa := v_lipsa || 'trio-ul de politici pe vehicle_exits';
  end if;
  -- Termenele: select + update, fără insert (§10).
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'vehicle_exit_obligations') <> 2
     or exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vehicle_exit_obligations'
                 and cmd = 'INSERT') then
    v_lipsa := v_lipsa || 'politicile lui vehicle_exit_obligations (select + update, fără insert)';
  end if;
  if has_table_privilege('authenticated', 'public.vehicle_exit_obligations', 'INSERT') then
    v_lipsa := v_lipsa || 'INSERT acordat pe vehicle_exit_obligations';
  end if;

  foreach v_t in array array['vexit_vie_uq', 'vexit_org_data_idx', 'vexit_vehicul_idx',
                             'vexob_iesire_cod_uq', 'vexob_org_deschise_idx', 'vexob_vehicul_idx'] loop
    if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = v_t
                    and indexdef ilike '%where (%deleted_at is null%') then
      v_lipsa := v_lipsa || (v_t || ' (parțial)');
    end if;
  end loop;
  foreach v_t in array array['vehicles_org_nr_uq', 'vehicles_org_vin_uq'] loop
    if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = v_t
                    and indexdef ilike '%deleted_at is null%' and indexdef ilike '%vandut%casat%') then
      v_lipsa := v_lipsa || (v_t || ' (exclude vehiculele ieșite)');
    end if;
  end loop;

  -- Catalogul și CHECK-ul codurilor spun același lucru.
  select count(*) into v_n from internal.iesire_catalog();
  select count(*) into v_m from internal.iesire_catalog() c
   where position(quote_literal(c.cod) in
                  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'vexob_cod_ck')) > 0;
  if v_n <> 11 or v_m <> v_n then
    v_lipsa := v_lipsa || format('catalogul (%s coduri) și vexob_cod_ck (%s) diferă', v_n, v_m);
  end if;

  -- Toate ramurile formei 0214, plus cea nouă, plus implicitul. Bucla pe
  -- `expirables` nu dovedește nimic pe bancul gol din CI, deci și lista fixă.
  v_def := pg_get_functiondef('app.poate_vedea_expirabil(uuid,text)'::regprocedure);
  for v_t in
    select unnest(array['medical_exam', 'employee_document', 'work_permit', 'employment_contract',
                        'vehicle_document', 'vehicle_service', 'fuel_card', 'vehicle_exit', 'equipment',
                        'fire_extinguisher', 'ssm_training', 'environmental_permit',
                        'inventory_item', 'iscir_authorization', 'maintenance_plan',
                        'personnel_authorization', 'ppe_issuance', 'driver_license',
                        'vehicle_fine'])
    union
    select distinct x.entity_type from public.expirables x where x.deleted_at is null
  loop
    if position(quote_literal(v_t) in v_def) = 0 then
      v_lipsa := v_lipsa || ('ramura ' || v_t || ' din app.poate_vedea_expirabil');
    end if;
  end loop;
  if position('else false' in v_def) = 0 then
    v_lipsa := v_lipsa || 'implicitul `else false` din app.poate_vedea_expirabil';
  end if;
  -- Garda din 0023 caută forma CU spații; corpul e scris FĂRĂ. Expresia
  -- regulată le prinde pe amândouă: fișele de personal nu se deschid pe `own`.
  if v_def ~ '''employees''\s*,\s*''read''\s*,\s*''own''' then
    v_lipsa := v_lipsa || 'app.poate_vedea_expirabil acceptă `own` pe date de personal';
  end if;

  v_def := pg_get_functiondef('internal.flota_rezumat(uuid)'::regprocedure);
  if position('''vehicle_document'', ''vehicle_service'', ''fuel_card'', ''vehicle_exit''' in v_def) = 0 then
    v_lipsa := v_lipsa || 'lista albă a rezumatului (vehicle_document, vehicle_service, fuel_card, vehicle_exit)';
  end if;
  if position('flota_vede_vehicul' in v_def) = 0 then
    v_lipsa := v_lipsa || 'filtrul de vizibilitate din rezumat';
  end if;
  if position('''vehicle_exit''' in pg_get_functiondef('internal.flota_setari_praguri()'::regprocedure)) = 0
     or position('''fuel_card''' in pg_get_functiondef('internal.flota_setari_praguri()'::regprocedure)) = 0 then
    v_lipsa := v_lipsa || 'pragurile flotei oglindite pentru carduri și ieșiri';
  end if;
  if position('flota_rezumat' in pg_get_functiondef('internal.conformitate_zilnica()'::regprocedure)) = 0 then
    v_lipsa := v_lipsa || 'conformitate_zilnica nu mai cheamă flota_rezumat';
  end if;
  v_def := pg_get_functiondef('internal.audit_campuri_excluse(text)'::regprocedure);
  if position('''dispozitive_push''' in v_def) = 0 or position('''leave_requests''' in v_def) = 0
     or position('''vehicle_exits''' in v_def) = 0 then
    v_lipsa := v_lipsa || 'ramurile din internal.audit_campuri_excluse';
  end if;

  -- F7, F12b, F12d: reacționează singure la statusul pus de asistent.
  if position('status' in pg_get_functiondef('internal.vsp_resincronizeaza_vehicul()'::regprocedure)) = 0 then
    v_lipsa := v_lipsa || 'F7: vsp_resincronizeaza_vehicul nu se mai uită la status';
  end if;
  if (select count(*) from pg_trigger t
       where not t.tgisinternal and t.tgrelid = 'public.vehicles'::regclass
         and t.tgname in ('vehicles_iesire_garda', 'vehicles_iesire_dupa', 'vehicles_dupa',
                          'vehicles_inchide_alocarea', 'vehicles_service_sync',
                          'vehicles_carduri_resincronizeaza', 'vehicles_rezervari_la_iesire')) <> 7 then
    v_lipsa := v_lipsa || 'triggerele pe vehicles (7)';
  end if;
  if (select count(*) from pg_trigger t
       where not t.tgisinternal
         and ((t.tgrelid = 'public.vehicle_exits'::regclass
               and t.tgname in ('iesiri_inainte', 'iesiri_dupa_insert', 'iesiri_dupa_update',
                                'vehicle_exits_set_updated_at'))
           or (t.tgrelid = 'public.vehicle_exit_obligations'::regclass
               and t.tgname in ('termene_iesire_inainte', 'termene_iesire_dupa',
                                'vehicle_exit_obligations_set_updated_at')))) <> 7 then
    v_lipsa := v_lipsa || 'triggerele 0218 (7)';
  end if;

  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'internal'
                and p.proname in ('iesire_catalog', 'iesire_genereaza_obligatii',
                                  'iesire_sincronizeaza_obligatia', 'iesire_inainte',
                                  'iesire_dupa_insert', 'iesire_dupa_update',
                                  'iesire_termen_inainte', 'iesire_termen_dupa',
                                  'vehicles_iesire_garda', 'vehicles_iesire_dupa')
                and (p.proconfig is null or not ('search_path=""' = any (p.proconfig))
                     or has_function_privilege('authenticated', p.oid, 'EXECUTE'))) then
    v_lipsa := v_lipsa || 'search_path gol sau EXECUTE ascuns pe funcțiile 0218';
  end if;

  -- Backfill-ul: câte vehicule ieșite, atâtea ieșiri vii; zero termene.
  select count(*) into v_n from public.vehicles v
   where v.deleted_at is null and v.status in ('vandut', 'casat');
  select count(*) into v_m from public.vehicle_exits e
   where e.anulat_la is null and e.deleted_at is null;
  if v_n <> v_m then
    v_lipsa := v_lipsa || format('backfill: %s vehicule ieșite, %s ieșiri vii', v_n, v_m);
  end if;
  if exists (select 1 from public.vehicle_exit_obligations) then
    v_lipsa := v_lipsa || 'backfill-ul a creat termene';
  end if;

  if array_length(v_lipsa, 1) > 0 then
    raise exception '0218: lipsesc %', array_to_string(v_lipsa, ', ');
  end if;
end $$;

commit;
