-- supabase/migrations/0197_flota_foaia_zilnica.sql
--
-- FLOTA, FAZA F4: FOAIA ZILNICĂ CU LINII, CA DOCUMENT JUSTIFICATIV.
--
-- ── DE CE ───────────────────────────────────────────────────────────────────
-- Până aici o foaie de parcurs era O deplasare: plecare, sosire, un traseu
-- liber. Decizia utilizatorului din 7 oct: foaia e ZIUA unui vehicul, cu
-- LINII — cursele (ora, de la → la, scopul, kilometrii). Normele Codului
-- fiscal (HG 1/2016, titlul II pct. 16 alin. (2) și titlul VII pct. 68
-- alin. (2)) cer pe foaie categoria vehiculului, scopul și LOCUL deplasării,
-- kilometrii parcurși și norma proprie de consum; OMFP 2634/2015, anexa 1
-- pct. 2–3 cere numărul și data documentului. Liniile poartă locul și scopul,
-- antetul poartă numărul, data și instantaneul vehiculului.
--
-- Planul o numea `0174_foaia_zilnica`; numărul s-a ocupat între timp
-- (mentenanța 0180–0183, apoi 0184–0190 și 0196 pe alte trasee).
--
-- ── CE SE SCHIMBĂ ───────────────────────────────────────────────────────────
-- A. `trip_sheets` devine ANTETUL ZILEI:
--    - `data` = ziua plecării în ora României, coloană GENERATĂ din
--      `plecare_la` (abatere de la plan, care o voia scrisă și umplută: o
--      coloană generată nu poate diverge de plecare, iar plecarea antetului e
--      oricum prima cursă). Umplerea rândurilor vechi o face Postgres la
--      adăugarea coloanei;
--    - o singură foaie activă pe (vehicul, zi): `ts_vehicul_zi_uq`, parțial
--      (fără cele respinse și cele șterse). Un SELECT de verificare oprește
--      migrarea, cu lista, dacă datele existente o încalcă;
--    - `plecare_la`, `sosire_la`, `km_plecare`, `km_sosire` devin AGREGATE
--      ale curselor, rescrise de `internal.foi_parcurs_inainte` la orice
--      UPDATE pe o foaie cu curse. `km_parcursi` rămâne GENERATED, deci
--      anomaliile de kilometraj (`foi_parcurs_dupa`), intervalul alimentărilor
--      (0018) și registrul (0142, `col_data = plecare_la`) merg neschimbate;
--    - instantaneul vehiculului la trimitere (`vehicul_nr`,
--      `vehicul_categorie`, `vehicul_combustibil`, `norma_l_100km`) și
--      numărul `FP-AAAA-NNNNN` din `document_sequences`, în triggerul separat
--      `foi_parcurs_numerotare`. Numărul se alocă o singură dată (doar dacă e
--      null) și se păstrează la retragere și la respins → retrimis; îl pune
--      DOAR baza, ca la sesizări (0181).
-- B. `trip_sheet_curse`: liniile. Triggerul impune ziua foii, ordinea
--    cronologică și kilometrajul monoton între curse vecine, „doar ultima
--    cursă poate rămâne deschisă”, și că același șofer nu are în același
--    interval o cursă pe altă foaie. Backfill: fiecare foaie existentă
--    primește o linie (număr de rânduri verificat egal mai jos).
-- C. `trip_route_templates`: șabloanele de traseu ale firmei.
-- D. DOUĂ DEFECTE DE SECURITATE RĂMASE DIN 0196 (revizia automată de
--    securitate pe 20776502, §C4), închise aici fiindcă ambele funcții se
--    rescriu oricum:
--    D1. TOCTOU pe starea foii. §C4 îngheța foaia doar pe `aprobat`, §C5 doar
--        sub `update` ≠ `all` și doar antetul. Pe o foaie TRIMISĂ, scriitorul
--        își schimba încă alimentările direct prin PostgREST, iar `org_admin`
--        și antetul; aprobatorul aproba alte cifre decât cele văzute. Acum,
--        în afara contextului de serviciu, pe orice scope:
--          trimis  → doar retragerea `trimis` → `draft` (nicio altă coloană)
--                    sau decizia aprobatorului (`aprobat`/`respins` + motivul);
--          respins → doar `respins` → `draft`;
--          aprobat → doar stornarea, sub `update = all`.
--        Copiii urmează EXACT regula părintelui: alimentările și cursele se
--        adaugă, se modifică și se șterg logic DOAR cât foaia e `draft`.
--        (Planul spunea „draft sau respins” pentru curse; o foaie respinsă se
--        corectează abia după respins → draft.)
--    D2. Ocolirea validatorului de regres al kilometrajului (`v_ultim`), care
--        rulează doar la întocmire și la draft → trimis. Prin D1 nu mai există
--        nicio cale de a schimba kilometrii unei foi ne-ciornă: nici pe antet,
--        nici prin curse (agregatele urmează cursele, iar cursele stau doar pe
--        ciornă). În plus, stornarea mergea și înapoi: `c_stornare` lăsa
--        `deleted_at` să revină la null pe foaia aprobată stornată — o
--        „reînviere” fără niciun validator. Ștergerea logică e acum
--        IREVERSIBILĂ în afara contextului de serviciu, pe foi, alimentări
--        și curse.
--
-- ── CE NU E AICI ────────────────────────────────────────────────────────────
-- * Notificările pe fluxul foii: F5.
-- * Norma din `vehicle_consumption_norms`: F10. Până atunci instantaneul ia
--   `vehicles.consum_mediu_declarat` („declarat de producător sau normat
--   intern”, 0012).
-- * Numere pentru foile vechi deja trimise sau aprobate fără număr: nu se dau
--   retroactiv (ar schimba identitatea unui document emis).

begin;

-- ============================================================
-- 1. Verificarea datelor existente, ÎNAINTEA oricărei schimbări
-- ============================================================
--
-- Unicitatea pe (vehicul, zi) nu se poate crea peste două foi active ale
-- aceluiași vehicul în aceeași zi. Migrarea nu alege ea pe care s-o
-- păstreze: se oprește și spune care sunt. Suprapunerile de șofer sunt doar
-- raportate — garda lor privește scrierile noi, nu istoricul.

do $$
declare
  v_dubluri     text;
  v_suprapuse   integer;
begin
  select string_agg(format('vehicul %s, ziua %s: %s foi', d.vehicle_id, d.zi, d.n), '; ')
    into v_dubluri
    from (
      select t.vehicle_id, (t.plecare_la at time zone 'Europe/Bucharest')::date as zi, count(*) as n
        from public.trip_sheets t
       where t.deleted_at is null and t.status <> 'respins'
       group by 1, 2
      having count(*) > 1
    ) d;
  if v_dubluri is not null then
    raise exception '0197: există vehicule cu mai multe foi de parcurs active în aceeași zi, deci unicitatea pe (vehicul, zi) nu se poate crea. Respingeți sau ștergeți logic foile în plus, apoi reaplicați: %', v_dubluri;
  end if;

  select count(*) into v_suprapuse
    from public.trip_sheets a
    join public.trip_sheets b
      on b.organization_id = a.organization_id
     and b.employee_id = a.employee_id
     and b.id > a.id
     and b.vehicle_id <> a.vehicle_id
   where a.deleted_at is null and b.deleted_at is null
     and a.status <> 'respins' and b.status <> 'respins'
     and pg_catalog.tstzrange(a.plecare_la, coalesce(a.sosire_la, a.plecare_la + interval '1 minute'))
         operator(pg_catalog.&&)
         pg_catalog.tstzrange(b.plecare_la, coalesce(b.sosire_la, b.plecare_la + interval '1 minute'));
  raise notice '0197: % perechi de foi existente ale aceluiași șofer se suprapun pe vehicule diferite (rămân; garda privește scrierile noi).', v_suprapuse;
end
$$;

-- ============================================================
-- 2. trip_sheets — antetul zilei
-- ============================================================

-- `timezone(text, timestamptz)` e IMMUTABLE, deci expresia e admisă într-o
-- coloană generată. Adăugarea rescrie tabela și umple rândurile existente.
alter table public.trip_sheets
  add column data date generated always as ((plecare_la at time zone 'Europe/Bucharest')::date) stored;

alter table public.trip_sheets
  add column vehicul_nr          text,
  add column vehicul_categorie   public.vehicle_category,
  add column vehicul_combustibil public.fuel_type,
  add column norma_l_100km       numeric(6,2),
  add constraint ts_vehicul_nr_len check (vehicul_nr is null or char_length(vehicul_nr) <= 16),
  add constraint ts_norma_ck check (norma_l_100km is null or norma_l_100km between 0 and 300);

comment on column public.trip_sheets.data is
  'Ziua foii, în ora României, generată din plecare_la (0197). Foaia e ziua unui vehicul.';
comment on column public.trip_sheets.vehicul_nr is
  'Instantaneul vehiculului la trimitere (0197): foaia aprobată nu se schimbă retroactiv, iar aprobatorul o citește fără RLS pe vehicul.';
comment on column public.trip_sheets.norma_l_100km is
  'Norma proprie de consum la trimitere (HG 1/2016 pct. 16 alin. (2)), din vehicles.consum_mediu_declarat până la F10.';

create unique index ts_vehicul_zi_uq
  on public.trip_sheets (vehicle_id, data)
  where status <> 'respins' and deleted_at is null;
create index ts_org_data_idx
  on public.trip_sheets (organization_id, data desc)
  where deleted_at is null;

-- ============================================================
-- 3. trip_sheet_curse — liniile foii
-- ============================================================

create table public.trip_sheet_curse (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  trip_sheet_id   uuid not null references public.trip_sheets (id) on delete cascade,
  -- Poziția cronologică în zi, 1..n. O renumerotează `internal.curse_dupa`
  -- după fiecare scriere; clientul n-o alege.
  ordine          smallint not null default 0,
  plecare_la      timestamptz not null,
  sosire_la       timestamptz,
  de_la_loc       text,
  pana_la_loc     text,
  scop            text,
  km_plecare      integer not null,
  km_sosire       integer,
  km_parcursi     integer generated always as (km_sosire - km_plecare) stored,
  observatii      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null,
  updated_by      uuid references auth.users (id) on delete set null,
  deleted_at      timestamptz,
  constraint tsc_ordine_ck check (ordine >= 0),
  constraint tsc_km_plecare_ck check (km_plecare >= 0),
  constraint tsc_km_ck check (km_sosire is null or km_sosire > km_plecare),
  constraint tsc_ora_ck check (sosire_la is null or sosire_la > plecare_la),
  constraint tsc_de_la_len check (de_la_loc is null or char_length(de_la_loc) <= 200),
  constraint tsc_pana_la_len check (pana_la_loc is null or char_length(pana_la_loc) <= 200),
  constraint tsc_scop_len check (scop is null or char_length(scop) <= 500),
  constraint tsc_obs_len check (observatii is null or char_length(observatii) <= 1000)
);

comment on table public.trip_sheet_curse is
  'Cursele unei foi de parcurs zilnice (0197): ora, de la → la, scopul, kilometrii. Se scriu doar cât foaia e ciornă.';

create index tsc_foaie_idx
  on public.trip_sheet_curse (trip_sheet_id, plecare_la)
  where deleted_at is null;
create index tsc_org_plecare_idx
  on public.trip_sheet_curse (organization_id, plecare_la)
  where deleted_at is null;

-- ============================================================
-- 4. trip_route_templates — șabloanele de traseu
-- ============================================================

create table public.trip_route_templates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  denumire        text not null,
  de_la_loc       text not null,
  pana_la_loc     text not null,
  scop            text not null,
  km_estimat      integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null,
  updated_by      uuid references auth.users (id) on delete set null,
  deleted_at      timestamptz,
  constraint trt_denumire_len check (char_length(btrim(denumire)) between 1 and 120),
  constraint trt_de_la_len check (char_length(btrim(de_la_loc)) between 1 and 200),
  constraint trt_pana_la_len check (char_length(btrim(pana_la_loc)) between 1 and 200),
  constraint trt_scop_len check (char_length(btrim(scop)) between 1 and 500),
  constraint trt_km_ck check (km_estimat is null or km_estimat between 1 and 5000)
);

comment on table public.trip_route_templates is
  'Rutele recurente ale firmei (0197), din care șoferul adaugă o cursă dintr-un clic.';

create unique index trt_org_denumire_uq
  on public.trip_route_templates (organization_id, lower(denumire))
  where deleted_at is null;

-- ============================================================
-- 5. Numerotarea `FP-AAAA-NNNNN` și instantaneul vehiculului
-- ============================================================

create or replace function internal.aloca_numar_foaie(p_org uuid, p_an integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_numar   integer;
  v_prefix  text;
  v_padding smallint;
  v_text    text;
  v_incercari integer := 0;
begin
  -- `trip_sheets.numar` a fost text liber până la 0197; un număr scris de
  -- mână în forma noastră ar lovi `ts_org_numar_uq`. Se sare peste el.
  loop
    insert into public.document_sequences (organization_id, document_type, year, prefix, next_number, padding)
    values (p_org, 'foaie_parcurs', p_an, 'FP', 2, 5)
    on conflict (organization_id, document_type, year) do update
      set next_number = public.document_sequences.next_number + 1,
          updated_at  = now()
    returning next_number - 1, prefix, padding
         into v_numar, v_prefix, v_padding;
    v_text := coalesce(nullif(v_prefix, ''), 'FP') || '-' || p_an::text || '-'
              || pg_catalog.lpad(v_numar::text, v_padding, '0');
    exit when not exists (
      select 1 from public.trip_sheets t
       where t.organization_id = p_org and t.numar = v_text and t.deleted_at is null
    );
    v_incercari := v_incercari + 1;
    if v_incercari > 100 then
      raise exception using errcode = 'P0001',
        message = 'Numerotarea foilor de parcurs nu a găsit un număr liber. Contactați administratorul.';
    end if;
  end loop;
  return v_text;
end;
$$;

comment on function internal.aloca_numar_foaie(uuid, integer) is
  'Următorul număr de foaie de parcurs („FP-2026-00042”), pe an. Secvența poate avea goluri, nu repetiții.';

create or replace function internal.foi_parcurs_numerotare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vehicul public.vehicles%rowtype;
begin
  -- Numărul și instantaneul sunt ale BAZEI. Un client nu-și alege numărul (ar
  -- putea „rezerva” FP-2026-00001) și nu-și scrie singur norma de consum.
  if not app.is_service_context() then
    if tg_op = 'INSERT' then
      new.numar               := null;
      new.vehicul_nr          := null;
      new.vehicul_categorie   := null;
      new.vehicul_combustibil := null;
      new.norma_l_100km       := null;
    else
      new.numar               := old.numar;
      new.vehicul_nr          := old.vehicul_nr;
      new.vehicul_categorie   := old.vehicul_categorie;
      new.vehicul_combustibil := old.vehicul_combustibil;
      new.norma_l_100km       := old.norma_l_100km;
    end if;
  end if;

  -- Trimiterea fixează vehiculul așa cum era în ziua aceea. Rulează DUPĂ
  -- `foi_parcurs_inainte` (ordine alfabetică), deci după gărzile de stare și
  -- după rescrierea agregatelor: `plecare_la` e cel final.
  if tg_op = 'UPDATE' and old.status = 'draft' and new.status = 'trimis' then
    select * into v_vehicul from public.vehicles v where v.id = new.vehicle_id;
    new.vehicul_nr          := v_vehicul.nr_inmatriculare;
    new.vehicul_categorie   := v_vehicul.categorie;
    new.vehicul_combustibil := v_vehicul.tip_combustibil;
    new.norma_l_100km       := v_vehicul.consum_mediu_declarat;
    if new.numar is null then
      new.numar := internal.aloca_numar_foaie(
        new.organization_id,
        extract(year from (new.plecare_la at time zone 'Europe/Bucharest'))::integer);
    end if;
  end if;
  return new;
end;
$$;

create trigger foi_parcurs_numerotare
  before insert or update on public.trip_sheets
  for each row execute function internal.foi_parcurs_numerotare();

-- ============================================================
-- 6. internal.foi_parcurs_inainte — corpul din 0196 + agregatele + D1/D2
-- ============================================================
--
-- Forma ultimă e 0196 (grep pe toate migrările). Gărzile C1–C5 rămân; C5 se
-- lărgește la orice scope și la `respins` (D1), iar ștergerea logică devine
-- ireversibilă (D2). Mesajele vechi rămân cuvânt cu cuvânt (cu sedilă unde
-- erau): `flota/erori.ts` le potrivește pe forma lor.

create or replace function internal.foi_parcurs_inainte()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_vehicul public.vehicles%rowtype;
  v_ultim   integer;
  v_zi      date;
  v_scope   public.permission_scope;
  v_curse   integer := 0;
  v_deschise integer := 0;
  v_prima   record;
  v_ultima  record;
  -- Coloanele pe care le poate schimba decizia unui aprobator. Restul rândului
  -- e al șoferului. `km_parcursi` și `data` sunt GENERATED: valoarea lor din
  -- NEW, într-un trigger BEFORE, nu e cea finală, deci nu intră în comparație.
  c_decizie constant text[] := array['status', 'motiv_respingere', 'aprobat_de', 'aprobat_la',
                                     'updated_at', 'updated_by', 'km_parcursi', 'data'];
  -- 0197 §D1: retragerea trimis → draft și redeschiderea respins → draft
  -- schimbă starea, atât. Motivul respingerii rămâne pe foaie.
  c_retragere constant text[] := array['status', 'aprobat_de', 'aprobat_la',
                                       'updated_at', 'updated_by', 'km_parcursi', 'data'];
  -- 0196 §C4: singurele coloane care se mișcă pe o foaie aprobată, la stornare.
  c_stornare constant text[] := array['deleted_at', 'updated_at', 'updated_by', 'km_parcursi', 'data'];
begin
  -- 0196 §C4: semnăturile foii sunt ale BAZEI, nu ale payload-ului.
  if tg_op = 'UPDATE' and not app.is_service_context() then
    new.created_by := old.created_by;
    new.trimis_la  := old.trimis_la;
    new.aprobat_de := old.aprobat_de;
    new.aprobat_la := old.aprobat_la;
  end if;

  -- 0197 §D2: o foaie ștearsă logic (stornată) nu se mai atinge: nici
  -- reînvierea, nici altă coloană. Înainte, `c_stornare` lăsa `deleted_at` să
  -- revină la null pe foaia aprobată stornată, fără niciun validator.
  if tg_op = 'UPDATE' and old.deleted_at is not null and not app.is_service_context() then
    raise exception using errcode = 'P0001',
      message = 'Foaia de parcurs a fost ștearsă sau stornată și nu se mai modifică. Întocmiți una nouă.';
  end if;

  -- 0197 §A: pe o foaie CU curse, orele și kilometrajul antetului sunt
  -- agregatele curselor (prima plecare, ultima sosire), rescrise la orice
  -- UPDATE — inclusiv la „atingerea” din `internal.curse_dupa`. Scrise direct
  -- de client, cu altă valoare, sunt refuzate: altfel antetul ar spune alte
  -- cifre decât liniile pe care le semnează aprobatorul.
  if tg_op = 'UPDATE' then
    select count(*), count(*) filter (where c.sosire_la is null or c.km_sosire is null)
      into v_curse, v_deschise
      from public.trip_sheet_curse c
     where c.trip_sheet_id = new.id and c.deleted_at is null;
    if v_curse > 0 then
      if not app.is_service_context()
         and (new.plecare_la, new.sosire_la, new.km_plecare, new.km_sosire)
             is distinct from (old.plecare_la, old.sosire_la, old.km_plecare, old.km_sosire) then
        raise exception using errcode = 'P0001',
          message = 'Orele și kilometrajul foii se scriu pe curse. Modificați cursa, iar foaia se recalculează singură.';
      end if;
      select c.plecare_la, c.km_plecare into v_prima
        from public.trip_sheet_curse c
       where c.trip_sheet_id = new.id and c.deleted_at is null
       order by c.plecare_la, c.created_at, c.id
       limit 1;
      select c.sosire_la, c.km_sosire into v_ultima
        from public.trip_sheet_curse c
       where c.trip_sheet_id = new.id and c.deleted_at is null
       order by c.plecare_la desc, c.created_at desc, c.id desc
       limit 1;
      new.plecare_la := v_prima.plecare_la;
      new.km_plecare := v_prima.km_plecare;
      new.sosire_la  := v_ultima.sosire_la;
      new.km_sosire  := v_ultima.km_sosire;
    end if;
  end if;

  -- 0196 §C2: aprobatorul care NU poate scrie foaia pe dreptul de scriere a
  -- ajuns aici doar prin ramura de aprobare a lui `foi_update`. Atunci poate
  -- decide, atât.
  if tg_op = 'UPDATE'
     and not app.is_service_context()
     and not app.poate_scrie_foaie(old.organization_id, old.employee_id) then
    if not (old.status = 'trimis' and new.status in ('aprobat', 'respins'))
       or (pg_catalog.to_jsonb(new) - c_decizie) is distinct from (pg_catalog.to_jsonb(old) - c_decizie) then
      raise exception using errcode = 'P0001',
        message = 'Foaia de parcurs a unui coleg se poate doar aproba sau respinge, după ce a fost trimisă. O completează și o trimite șoferul ei.';
    end if;
  end if;

  -- 0196 §C3: mutarea foii pe alt șofer cere dreptul de scriere și pe
  -- șoferul NOU.
  if tg_op = 'UPDATE'
     and not app.is_service_context()
     and new.employee_id is distinct from old.employee_id
     and not app.poate_scrie_foaie(new.organization_id, new.employee_id) then
    raise exception using errcode = 'P0001',
      message = 'Foaia se poate muta doar pe un șofer pentru care aveți drept de întocmire.';
  end if;

  select * into v_vehicul from public.vehicles v
   where v.id = new.vehicle_id and v.deleted_at is null;
  if not found or v_vehicul.organization_id <> new.organization_id then
    raise exception using errcode = 'P0001',
      message = 'Vehiculul selectat nu aparţine organizaţiei dumneavoastră.';
  end if;
  if not exists (
    select 1 from public.employees e
     where e.id = new.employee_id and e.organization_id = new.organization_id and e.deleted_at is null
  ) then
    raise exception using errcode = 'P0001',
      message = 'Şoferul selectat nu aparţine organizaţiei dumneavoastră.';
  end if;
  if tg_op = 'INSERT' and v_vehicul.status in ('vandut', 'casat') then
    raise exception using errcode = 'P0001',
      message = 'Vehiculul este ieşit din parc (vândut sau casat). Nu se mai pot întocmi foi de parcurs pentru el.';
  end if;

  -- 0197 §A: cursele există, deci ziua foii nu se mută pe sub ele.
  if tg_op = 'UPDATE' and v_curse > 0 and not app.is_service_context()
     and new.vehicle_id is distinct from old.vehicle_id then
    raise exception using errcode = 'P0001',
      message = 'Vehiculul nu se schimbă pe o foaie care are deja curse. Ștergeți cursele sau întocmiți foaia pe vehiculul corect.';
  end if;

  -- 0196 §C1: cine nu întocmește pe orice vehicul întocmește pe pool sau pe
  -- mașina alocată șoferului foii în ziua plecării.
  if not app.is_service_context()
     and (tg_op = 'INSERT'
          or (new.vehicle_id, new.employee_id, new.plecare_la)
             is distinct from (old.vehicle_id, old.employee_id, old.plecare_la)) then
    v_scope := app.has_permission(new.organization_id, 'trip_sheets',
                                  case when tg_op = 'INSERT' then 'create' else 'update' end);
    if v_scope in ('own', 'team') and not v_vehicul.pool then
      v_zi := (new.plecare_la at time zone 'Europe/Bucharest')::date;
      if not exists (
        select 1 from public.vehicle_assignments a
         where a.vehicle_id = new.vehicle_id
           and a.employee_id = new.employee_id
           and a.organization_id = new.organization_id
           and a.deleted_at is null
           and a.de_la < ((v_zi + 1)::timestamp at time zone 'Europe/Bucharest')
           and coalesce(a.pana_la, 'infinity'::timestamptz) > (v_zi::timestamp at time zone 'Europe/Bucharest')
      ) then
        raise exception using errcode = 'P0001',
          message = 'Vehiculul ales nu vă este alocat în ziua plecării și nu este o mașină comună (pool). Foaia se întocmește pe vehiculul primit în folosință sau pe unul din pool.';
      end if;
    end if;
  end if;

  -- 0196 §C4: cine nu are `update = all` nu mai atinge nimic pe o foaie
  -- aprobată.
  if tg_op = 'UPDATE' and old.status = 'aprobat' and not app.is_service_context()
     and app.has_permission(new.organization_id, 'trip_sheets', 'update') is distinct from 'all' then
    raise exception using errcode = 'P0001',
      message = 'Foaia de parcurs este aprobată și nu se mai modifică. Dacă are o greșeală, cereți administratorului flotei să o storneze, apoi întocmiți una nouă.';
  end if;

  -- O foaie aprobată este un document justificativ: cifrele ei nu se mai ating.
  if tg_op = 'UPDATE' and old.status = 'aprobat' and new.deleted_at is null
     and (old.vehicle_id, old.employee_id, old.plecare_la, old.sosire_la, old.km_plecare, old.km_sosire)
         is distinct from (new.vehicle_id, new.employee_id, new.plecare_la, new.sosire_la, new.km_plecare, new.km_sosire) then
    raise exception using errcode = 'P0001',
      message = 'Foaia de parcurs este aprobată. Pentru corecţii, stornaţi-o şi întocmiţi una nouă.';
  end if;

  -- 0196 §C4, și pentru `update = all`: pe foaia aprobată se mișcă doar
  -- ștergerea logică. Din 0197, doar ÎNTR-UN SENS (garda D2 de mai sus).
  if tg_op = 'UPDATE' and old.status = 'aprobat' and not app.is_service_context()
     and (pg_catalog.to_jsonb(new) - c_stornare) is distinct from (pg_catalog.to_jsonb(old) - c_stornare) then
    raise exception using errcode = 'P0001',
      message = 'Foaia de parcurs aprobată se poate doar storna. Pentru corecții, stornați-o și întocmiți una nouă.';
  end if;

  -- 0196 §C5, lărgit de 0197 §D1 la ORICE scope: foaia TRIMISĂ așteaptă
  -- decizia pe cifrele cu care a plecat. Se mișcă doar starea — retragerea în
  -- ciornă (de unde retrimiterea reface verificarea de regres) sau decizia
  -- aprobatorului, cu motivul ei. Nici ștergerea logică: o foaie în aprobare
  -- se retrage întâi.
  if tg_op = 'UPDATE' and old.status = 'trimis' and not app.is_service_context()
     and (case when new.status in ('aprobat', 'respins')
               then (pg_catalog.to_jsonb(new) - c_decizie) is distinct from (pg_catalog.to_jsonb(old) - c_decizie)
               else (pg_catalog.to_jsonb(new) - c_retragere) is distinct from (pg_catalog.to_jsonb(old) - c_retragere)
          end) then
    raise exception using errcode = 'P0001',
      message = 'Foaia de parcurs este trimisă spre aprobare și nu se mai modifică. Retrageți-o în ciornă, corectați-o și trimiteți-o din nou.';
  end if;

  -- 0197 §D1: foaia RESPINSĂ se corectează abia după ce revine în ciornă.
  if tg_op = 'UPDATE' and old.status = 'respins' and not app.is_service_context()
     and (pg_catalog.to_jsonb(new) - c_retragere) is distinct from (pg_catalog.to_jsonb(old) - c_retragere) then
    raise exception using errcode = 'P0001',
      message = 'Foaia de parcurs este respinsă și nu se mai modifică așa. Redeschideți-o în ciornă, corectați-o și trimiteți-o din nou.';
  end if;

  -- 0018 §F1: doar la INSERT sau la tranziţia draft→trimis.
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and old.status = 'draft' and new.status = 'trimis') then
    select max(t.km_sosire) into v_ultim
      from public.trip_sheets t
     where t.vehicle_id = new.vehicle_id
       and t.deleted_at is null
       and t.status = 'aprobat'
       and t.km_sosire is not null
       and (tg_op = 'INSERT' or t.id <> new.id);
    v_ultim := greatest(coalesce(v_ultim, 0), coalesce(v_vehicul.km_curent, 0));

    -- Prepopulare: şoferul nu trebuie să caute cifra de pe foaia precedentă.
    if new.km_plecare is null then
      new.km_plecare := v_ultim;
    end if;

    -- REGRES = imposibil fizic => refuz. (Saltul se tratează în triggerul AFTER.)
    if new.km_plecare < v_ultim then
      raise exception using errcode = 'P0001',
        message = format('Kilometrajul de plecare (%s km) este mai mic decât ultimul kilometraj cunoscut al vehiculului (%s km). Un odometru nu poate da înapoi: verificaţi cifra introdusă sau corectaţi foaia de parcurs anterioară.',
                         new.km_plecare, v_ultim);
    end if;
  end if;

  if new.km_sosire is not null and new.km_sosire <= new.km_plecare then
    raise exception using errcode = 'P0001',
      message = 'Kilometrajul de sosire trebuie să fie mai mare decât cel de plecare.';
  end if;
  if new.sosire_la is not null and new.sosire_la <= new.plecare_la then
    raise exception using errcode = 'P0001',
      message = 'Ora de sosire trebuie să fie după ora de plecare.';
  end if;

  if tg_op = 'UPDATE' and new.status <> old.status then
    if not (
      (old.status = 'draft'   and new.status = 'trimis')
      or (old.status = 'trimis'  and new.status in ('aprobat', 'respins', 'draft'))
      or (old.status = 'respins' and new.status = 'draft')
    ) then
      raise exception using errcode = 'P0001',
        message = format('Nu se poate trece foaia de parcurs din starea „%s" în starea „%s".', old.status, new.status);
    end if;

    -- 0197 §A: foaia zilnică se trimite cu cursele ei încheiate. O foaie fără
    -- curse (cele de dinainte de 0197 au primit una la backfill) se trimite
    -- doar cu sosirea completată în antet, ca înainte.
    if new.status = 'trimis' and v_curse > 0 and v_deschise > 0 then
      raise exception using errcode = 'P0001',
        message = 'Încheiați toate cursele (ora și kilometrajul la sosire) înainte de a trimite foaia spre aprobare.';
    end if;
    if new.status = 'trimis' and v_curse = 0 and not app.is_service_context()
       and (new.km_sosire is null or new.sosire_la is null) then
      raise exception using errcode = 'P0001',
        message = 'Adăugați cursele zilei (de unde, până unde, scopul și kilometrii) înainte de a trimite foaia spre aprobare.';
    end if;

    if new.status in ('trimis', 'aprobat') and (new.km_sosire is null or new.sosire_la is null) then
      raise exception using errcode = 'P0001',
        message = 'Completaţi ora şi kilometrajul de sosire înainte de a trimite foaia spre aprobare.';
    end if;

    if new.status = 'trimis' then new.trimis_la := now(); end if;

    if new.status = 'aprobat' then
      if not app.is_service_context() then
        if not app.can(new.organization_id, 'trip_sheets', 'approve', 'team') then
          raise exception using errcode = 'P0001',
            message = 'Nu aveţi dreptul de a aproba foi de parcurs.';
        end if;
        if app.has_permission(new.organization_id, 'trip_sheets', 'approve') = 'team'
           and not app.is_manager_of(new.organization_id, new.employee_id) then
          raise exception using errcode = 'P0001',
            message = 'Puteţi aproba doar foile de parcurs ale angajaţilor din subordinea dumneavoastră.';
        end if;
        if new.employee_id = app.current_employee_id(new.organization_id)
           and app.has_permission(new.organization_id, 'trip_sheets', 'approve') <> 'all' then
          raise exception using errcode = 'P0001',
            message = 'Nu vă puteţi aproba singur propria foaie de parcurs.';
        end if;
        if old.created_by = (select auth.uid())
           and app.has_permission(new.organization_id, 'trip_sheets', 'approve') <> 'all' then
          raise exception using errcode = 'P0001',
            message = 'Nu puteți aproba o foaie întocmită de dumneavoastră.';
        end if;
        new.aprobat_de := (select auth.uid());
      end if;
      new.aprobat_la := now();
    else
      new.aprobat_de := null;
      new.aprobat_la := null;
    end if;

    if new.status = 'respins' and coalesce(btrim(new.motiv_respingere), '') = '' then
      raise exception using errcode = 'P0001',
        message = 'Precizaţi motivul respingerii, ca şoferul să ştie ce are de corectat.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function internal.foi_parcurs_inainte() from public, anon, authenticated;

-- ============================================================
-- 7. internal.alimentari_inainte — corpul din 0196 + D1/D2
-- ============================================================

create or replace function internal.alimentari_inainte()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_foaie public.trip_sheets%rowtype;
  v_stare_veche public.trip_sheet_status;
begin
  -- F8: validare explicită, ÎNAINTEA oricărei alte verificări.
  if new.litri is null or new.litri <= 0 then
    raise exception using errcode = 'P0001',
      message = 'Cantitatea de combustibil alimentată trebuie să fie mai mare decât zero.';
  end if;

  if tg_op = 'UPDATE' and not app.is_service_context() then
    new.created_by := old.created_by;
    -- 0197 §D2: ștergerea logică e ireversibilă.
    if old.deleted_at is not null then
      raise exception using errcode = 'P0001',
        message = 'Alimentarea a fost ștearsă și nu se mai modifică. Adăugați-o din nou dacă e cazul.';
    end if;
    select t.status into v_stare_veche from public.trip_sheets t where t.id = old.trip_sheet_id;
    if v_stare_veche = 'aprobat' then
      raise exception using errcode = 'P0001',
        message = 'Alimentarea face parte dintr-o foaie de parcurs aprobată și nu se mai modifică. Pentru corecții, foaia se stornează și se întocmește una nouă.';
    end if;
    if new.trip_sheet_id is distinct from old.trip_sheet_id then
      raise exception using errcode = 'P0001',
        message = 'Alimentarea nu se mută pe altă foaie de parcurs. Ștergeți-o și adăugați-o pe foaia corectă.';
    end if;
  end if;

  select * into v_foaie from public.trip_sheets t
   where t.id = new.trip_sheet_id and t.deleted_at is null;
  if not found or v_foaie.organization_id <> new.organization_id then
    raise exception using errcode = 'P0001',
      message = 'Foaia de parcurs selectată nu aparţine organizaţiei dumneavoastră.';
  end if;

  -- 0197 §D1: alimentările urmează EXACT starea foii: se adaugă, se modifică
  -- și se șterg doar cât foaia e ciornă. Înainte, pe o foaie trimisă șoferul
  -- își schimba litrii și costul în timp ce aprobatorul se uita la ei.
  if not app.is_service_context() and v_foaie.status <> 'draft' then
    raise exception using errcode = 'P0001',
      message = 'Alimentările se modifică doar cât foaia de parcurs este ciornă. Retrageți-o sau redeschideți-o în ciornă, apoi corectați-o.';
  end if;

  if v_foaie.status in ('aprobat', 'respins') and new.deleted_at is null then
    raise exception using errcode = 'P0001',
      message = 'Foaia de parcurs nu mai este în lucru. Alimentările nu se mai pot modifica după aprobare sau respingere.';
  end if;
  -- Ștergerea logică nu se judecă pe interval: cursele pot să se fi mutat
  -- între timp, iar alimentarea greșită trebuie să se poată scoate.
  if new.deleted_at is null
     and (new.alimentat_la < v_foaie.plecare_la
          or (v_foaie.sosire_la is not null and new.alimentat_la > v_foaie.sosire_la)) then
    raise exception using errcode = 'P0001',
      message = 'Data alimentării este în afara intervalului foii de parcurs.';
  end if;
  return new;
end;
$$;

revoke all on function internal.alimentari_inainte() from public, anon, authenticated;

-- ============================================================
-- 8. Cursele: integritatea liniei și agregatele antetului
-- ============================================================

create or replace function internal.curse_inainte()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_foaie public.trip_sheets%rowtype;
  v_prec  record;
  v_urm   record;
  v_serviciu boolean := app.is_service_context();
begin
  if tg_op = 'UPDATE' and not v_serviciu then
    new.created_by := old.created_by;
    if old.deleted_at is not null then
      raise exception using errcode = 'P0001',
        message = 'Cursa a fost ștearsă și nu se mai modifică. Adăugați-o din nou dacă e cazul.';
    end if;
    if new.trip_sheet_id is distinct from old.trip_sheet_id then
      raise exception using errcode = 'P0001',
        message = 'Cursa nu se mută pe altă foaie de parcurs. Ștergeți-o și adăugați-o pe foaia corectă.';
    end if;
  end if;

  select * into v_foaie from public.trip_sheets t where t.id = new.trip_sheet_id;
  if not found or v_foaie.organization_id <> new.organization_id or v_foaie.deleted_at is not null then
    raise exception using errcode = 'P0001',
      message = 'Foaia de parcurs selectată nu aparține organizației dumneavoastră.';
  end if;

  -- 0197 §D1: cursele urmează EXACT starea foii — doar pe ciornă.
  if not v_serviciu and v_foaie.status <> 'draft' then
    raise exception using errcode = 'P0001',
      message = 'Cursele se modifică doar cât foaia de parcurs este ciornă. Retrageți-o sau redeschideți-o în ciornă, apoi corectați-o.';
  end if;

  -- Ștergerea logică și renumerotarea (doar `ordine`) nu se mai judecă pe
  -- conținut: o cursă veche, de la backfill, fără loc completat, trebuie să se
  -- poată renumerota când i se adaugă o soră.
  if tg_op = 'UPDATE'
     and (new.deleted_at is not null
          or (pg_catalog.to_jsonb(new) - array['ordine', 'updated_at', 'updated_by', 'km_parcursi'])
             = (pg_catalog.to_jsonb(old) - array['ordine', 'updated_at', 'updated_by', 'km_parcursi'])) then
    return new;
  end if;

  if not v_serviciu then
    new.de_la_loc   := nullif(btrim(new.de_la_loc), '');
    new.pana_la_loc := nullif(btrim(new.pana_la_loc), '');
    new.scop        := nullif(btrim(new.scop), '');
    if new.de_la_loc is null then
      raise exception using errcode = 'P0001', message = 'Scrieți locul de plecare al cursei.';
    end if;
    if new.pana_la_loc is null then
      raise exception using errcode = 'P0001', message = 'Scrieți locul de sosire al cursei.';
    end if;
    if new.scop is null then
      raise exception using errcode = 'P0001', message = 'Scrieți scopul cursei.';
    end if;
    if (new.sosire_la is null) <> (new.km_sosire is null) then
      raise exception using errcode = 'P0001',
        message = 'Sosirea cursei se completează întreagă: ora și kilometrajul la sosire.';
    end if;
  end if;

  if new.sosire_la is not null and new.sosire_la <= new.plecare_la then
    raise exception using errcode = 'P0001',
      message = 'Ora de sosire a cursei trebuie să fie după ora de plecare.';
  end if;
  if new.km_sosire is not null and new.km_sosire <= new.km_plecare then
    raise exception using errcode = 'P0001',
      message = 'Kilometrajul la sosirea cursei trebuie să fie mai mare decât cel de la plecare.';
  end if;

  -- Ziua foii: cursa pleacă în ziua ei și se încheie cel târziu a doua zi
  -- (o cursă de noapte trece de miezul nopții).
  if (new.plecare_la at time zone 'Europe/Bucharest')::date <> v_foaie.data then
    raise exception using errcode = 'P0001',
      message = format('Ora de plecare a cursei trebuie să fie în ziua foii de parcurs (%s).',
                       pg_catalog.to_char(v_foaie.data, 'DD.MM.YYYY'));
  end if;
  if new.sosire_la is not null
     and (new.sosire_la at time zone 'Europe/Bucharest')::date > v_foaie.data + 1 then
    raise exception using errcode = 'P0001',
      message = 'Ora de sosire a cursei poate fi cel târziu a doua zi după ziua foii. O deplasare mai lungă se scrie pe foile zilelor următoare.';
  end if;

  -- Vecinii cronologici pe aceeași foaie, fără rândul însuși.
  select c.plecare_la, c.sosire_la, c.km_plecare, c.km_sosire into v_prec
    from public.trip_sheet_curse c
   where c.trip_sheet_id = new.trip_sheet_id and c.deleted_at is null and c.id <> new.id
     and c.plecare_la <= new.plecare_la
   order by c.plecare_la desc
   limit 1;
  if found then
    if v_prec.plecare_la = new.plecare_la then
      raise exception using errcode = 'P0001',
        message = 'Ora de plecare a cursei coincide cu a altei curse de pe foaie. Verificați orele.';
    end if;
    if v_prec.sosire_la is null then
      raise exception using errcode = 'P0001',
        message = 'Ora de plecare a cursei este după o cursă neîncheiată. Completați întâi sosirea cursei precedente.';
    end if;
    if new.plecare_la < v_prec.sosire_la then
      raise exception using errcode = 'P0001',
        message = format('Ora de plecare a cursei este înainte de sosirea cursei precedente (%s). Cursele nu se suprapun.',
                         pg_catalog.to_char(v_prec.sosire_la at time zone 'Europe/Bucharest', 'HH24:MI'));
    end if;
    if new.km_plecare < v_prec.km_sosire then
      raise exception using errcode = 'P0001',
        message = format('Kilometrajul de plecare al cursei (%s km) este mai mic decât cel de la sosirea cursei precedente (%s km). Un odometru nu poate da înapoi.',
                         new.km_plecare, v_prec.km_sosire);
    end if;
  end if;

  select c.plecare_la, c.km_plecare into v_urm
    from public.trip_sheet_curse c
   where c.trip_sheet_id = new.trip_sheet_id and c.deleted_at is null and c.id <> new.id
     and c.plecare_la > new.plecare_la
   order by c.plecare_la
   limit 1;
  if found then
    if new.sosire_la is null then
      raise exception using errcode = 'P0001',
        message = 'Sosirea cursei lipsește, dar după ea mai urmează o cursă. Doar ultima cursă a zilei poate rămâne neîncheiată.';
    end if;
    if new.sosire_la > v_urm.plecare_la then
      raise exception using errcode = 'P0001',
        message = format('Ora de sosire a cursei este după plecarea cursei următoare (%s). Cursele nu se suprapun.',
                         pg_catalog.to_char(v_urm.plecare_la at time zone 'Europe/Bucharest', 'HH24:MI'));
    end if;
    if new.km_sosire > v_urm.km_plecare then
      raise exception using errcode = 'P0001',
        message = format('Kilometrajul la sosirea cursei (%s km) este mai mare decât cel de la plecarea cursei următoare (%s km).',
                         new.km_sosire, v_urm.km_plecare);
    end if;
  end if;

  -- Același om nu conduce două mașini deodată: nicio cursă a lui, pe altă
  -- foaie activă, nu se suprapune cu asta.
  if not v_serviciu and exists (
    select 1
      from public.trip_sheet_curse c
      join public.trip_sheets t on t.id = c.trip_sheet_id
     where t.organization_id = new.organization_id
       and t.employee_id = v_foaie.employee_id
       and t.id <> new.trip_sheet_id
       and t.deleted_at is null
       and t.status <> 'respins'
       and c.deleted_at is null
       and pg_catalog.tstzrange(c.plecare_la, coalesce(c.sosire_la, c.plecare_la + interval '1 minute'))
           operator(pg_catalog.&&)
           pg_catalog.tstzrange(new.plecare_la, coalesce(new.sosire_la, new.plecare_la + interval '1 minute'))
  ) then
    raise exception using errcode = 'P0001',
      message = 'Ora de plecare a cursei se suprapune cu o cursă a aceluiași șofer de pe altă foaie de parcurs. Un om nu conduce două vehicule în același timp.';
  end if;

  if tg_op = 'INSERT' then
    new.ordine := coalesce((
      select max(c.ordine) from public.trip_sheet_curse c
       where c.trip_sheet_id = new.trip_sheet_id and c.deleted_at is null), 0) + 1;
  end if;
  return new;
end;
$$;

-- După fiecare scriere pe o cursă: renumerotarea cronologică a surorilor și
-- „atingerea” antetului, care își rescrie singur agregatele în
-- `foi_parcurs_inainte`. Gărzile antetului rulează sub identitatea apelantului
-- (`auth.uid()` și rolul nu se schimbă prin SECURITY DEFINER); RLS-ul nu se
-- reaplică, la fel ca la `foi_parcurs_dupa` → `vehicles`.
-- `pg_trigger_depth() > 1`: renumerotarea surorilor declanșează acest trigger
-- pe fiecare dintre ele; doar apelul de la vârf lucrează.
create or replace function internal.curse_dupa()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if pg_catalog.pg_trigger_depth() > 1 then
    return null;
  end if;

  update public.trip_sheet_curse c
     set ordine = r.rn
    from (
      select x.id, (row_number() over (order by x.plecare_la, x.created_at, x.id))::smallint as rn
        from public.trip_sheet_curse x
       where x.trip_sheet_id = new.trip_sheet_id and x.deleted_at is null
    ) r
   where c.id = r.id and c.ordine is distinct from r.rn;

  update public.trip_sheets t
     set updated_at = now()
   where t.id = new.trip_sheet_id;
  return null;
end;
$$;

create trigger curse_inainte before insert or update on public.trip_sheet_curse
  for each row execute function internal.curse_inainte();
create trigger curse_dupa after insert or update on public.trip_sheet_curse
  for each row execute function internal.curse_dupa();

revoke all on function internal.curse_inainte() from public, anon, authenticated;
revoke all on function internal.curse_dupa() from public, anon, authenticated;
revoke all on function internal.foi_parcurs_numerotare() from public, anon, authenticated;
revoke all on function internal.aloca_numar_foaie(uuid, integer) from public, anon, authenticated;

-- ============================================================
-- 9. RLS
-- ============================================================
--
-- Cursele copiază forma reparată în 0171 a lui `fuel_entries`: citirea după
-- foaie, scrierea pe `trip_sheets:update` (`app.poate_scrie_foaie`), autorul
-- fixat. Fără `deleted_at` în USING-ul de SELECT (0016: politica de SELECT se
-- aplică și rândului nou al unei ștergeri logice).

alter table public.trip_sheet_curse enable row level security;
alter table public.trip_sheet_curse force row level security;
alter table public.trip_route_templates enable row level security;
alter table public.trip_route_templates force row level security;

create policy curse_select on public.trip_sheet_curse
  for select to authenticated
  using (
    (select app.is_platform_admin())
    or (
      organization_id = any ((select app.current_org_ids())::uuid[])
      and app.feature_on(organization_id, 'fleet')
      and app.poate_vedea_foaie(organization_id, app.foaie_sofer(trip_sheet_id))
    )
  );

create policy curse_insert on public.trip_sheet_curse
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.poate_scrie_foaie(organization_id, app.foaie_sofer(trip_sheet_id))
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy curse_update on public.trip_sheet_curse
  for update to authenticated
  using (
    deleted_at is null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.poate_scrie_foaie(organization_id, app.foaie_sofer(trip_sheet_id))
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.poate_scrie_foaie(organization_id, app.foaie_sofer(trip_sheet_id))
    and updated_by = (select auth.uid())
  );

-- Șabloanele: le citește oricine întocmește foi; le administrează cine
-- scrie orice foaie (`trip_sheets:update = all`, responsabilul de flotă).
create policy sabloane_traseu_select on public.trip_route_templates
  for select to authenticated
  using (
    (select app.is_platform_admin())
    or (
      organization_id = any ((select app.current_org_ids())::uuid[])
      and app.feature_on(organization_id, 'fleet')
      and app.can(organization_id, 'trip_sheets', 'create', 'own')
    )
  );

create policy sabloane_traseu_insert on public.trip_route_templates
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.has_permission(organization_id, 'trip_sheets', 'update') = 'all'
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy sabloane_traseu_update on public.trip_route_templates
  for update to authenticated
  using (
    deleted_at is null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.has_permission(organization_id, 'trip_sheets', 'update') = 'all'
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.has_permission(organization_id, 'trip_sheets', 'update') = 'all'
    and updated_by = (select auth.uid())
  );

-- ============================================================
-- 10. Actor, audit, drepturi
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array['trip_sheet_curse', 'trip_route_templates'] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function internal.seteaza_updated_at()',
      t || '_set_updated_at', t);
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

-- ============================================================
-- 11. Backfill: fiecare foaie existentă devine o foaie cu o cursă
-- ============================================================
--
-- Toate foile, inclusiv cele șterse logic (cursa moștenește ștergerea), ca
-- numărătoarea să fie exactă: N foi înainte, N curse după. Triggerele de
-- utilizator se opresc pe durata umplerii: altfel fiecare cursă ar „atinge”
-- antetul și ar scrie un rând de audit fără ca cineva să fi schimbat ceva.
-- Locul de plecare rămâne gol (antetul vechi avea un singur `traseu` liber),
-- traseul merge în locul de sosire, scopul se copiază.

do $$
declare
  v_foi    integer;
  v_curse  integer;
  v_strambe integer;
begin
  select count(*) into v_foi from public.trip_sheets;

  alter table public.trip_sheet_curse disable trigger user;
  insert into public.trip_sheet_curse
    (organization_id, trip_sheet_id, ordine, plecare_la, sosire_la, de_la_loc, pana_la_loc, scop,
     km_plecare, km_sosire, created_at, updated_at, created_by, updated_by, deleted_at)
  select t.organization_id, t.id, 1, t.plecare_la, t.sosire_la, null, left(t.traseu, 200), left(t.scop, 500),
         t.km_plecare, t.km_sosire, t.created_at, t.updated_at, t.created_by, t.updated_by, t.deleted_at
    from public.trip_sheets t
   where not exists (select 1 from public.trip_sheet_curse c where c.trip_sheet_id = t.id);
  get diagnostics v_curse = row_count;
  alter table public.trip_sheet_curse enable trigger user;

  if v_curse <> v_foi then
    raise exception '0197: backfill incomplet — % foi, % curse create.', v_foi, v_curse;
  end if;

  select count(*) into v_strambe
    from public.trip_sheets t
   where (select count(*) from public.trip_sheet_curse c where c.trip_sheet_id = t.id) <> 1;
  if v_strambe <> 0 then
    raise exception '0197: % foi nu au exact o cursă după backfill.', v_strambe;
  end if;

  raise notice '0197: backfill — % foi înainte, % curse după.', v_foi, v_curse;
end
$$;

-- Instantaneul vehiculului pentru foile deja trimise sau aprobate: cel mai
-- bun lucru disponibil e vehiculul de azi. Fără triggere (registrul și
-- auditul nu au ce consemna: documentul nu s-a schimbat).
do $$
begin
  alter table public.trip_sheets disable trigger user;
  update public.trip_sheets t
     set vehicul_nr          = v.nr_inmatriculare,
         vehicul_categorie   = v.categorie,
         vehicul_combustibil = v.tip_combustibil,
         norma_l_100km       = v.consum_mediu_declarat
    from public.vehicles v
   where v.id = t.vehicle_id
     and t.status in ('trimis', 'aprobat')
     and t.vehicul_nr is null;
  alter table public.trip_sheets enable trigger user;
end
$$;

-- ============================================================
-- 12. Verificare
-- ============================================================

do $$
declare
  v_lipsa text;
begin
  select string_agg(n, ', ') into v_lipsa
    from unnest(array['foi_parcurs_inainte', 'foi_parcurs_numerotare', 'foi_parcurs_dupa',
                      'foi_parcurs_fara_autoaprobare']) n
   where not exists (
     select 1 from pg_catalog.pg_trigger g
      where g.tgrelid = 'public.trip_sheets'::regclass and g.tgname = n and g.tgenabled <> 'D');
  if v_lipsa is not null then
    raise exception '0197: triggere lipsă sau oprite pe trip_sheets: %', v_lipsa;
  end if;

  select string_agg(n, ', ') into v_lipsa
    from unnest(array['curse_inainte', 'curse_dupa', 'trg_trip_sheet_curse_actor',
                      'trip_sheet_curse_set_updated_at']) n
   where not exists (
     select 1 from pg_catalog.pg_trigger g
      where g.tgrelid = 'public.trip_sheet_curse'::regclass and g.tgname = n and g.tgenabled <> 'D');
  if v_lipsa is not null then
    raise exception '0197: triggere lipsă sau oprite pe trip_sheet_curse: %', v_lipsa;
  end if;

  if exists (
    select 1 from pg_catalog.pg_policy p
     where p.polrelid in ('public.trip_sheet_curse'::regclass, 'public.trip_route_templates'::regclass)
       and p.polcmd = 'd'
  ) then
    raise exception '0197: există o politică DELETE pe curse sau șabloane; ștergerea e logică.';
  end if;

  if exists (
    select 1 from pg_catalog.pg_policy p
     where p.polrelid in ('public.trip_sheet_curse'::regclass, 'public.trip_route_templates'::regclass)
       and p.polcmd = 'r'
       and pg_catalog.pg_get_expr(p.polqual, p.polrelid) like '%deleted_at IS NULL%'
  ) then
    raise exception '0197: politica de SELECT are deleted_at în USING (0016/0018 F2).';
  end if;

  if has_table_privilege('authenticated', 'public.trip_sheet_curse', 'DELETE')
     or has_table_privilege('authenticated', 'public.trip_route_templates', 'DELETE')
     or has_table_privilege('anon', 'public.trip_sheet_curse', 'SELECT') then
    raise exception '0197: drepturi greșite pe tabelele noi.';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_indexes
     where schemaname = 'public' and tablename = 'trip_sheets' and indexname = 'ts_vehicul_zi_uq'
  ) then
    raise exception '0197: lipsește unicitatea pe (vehicul, zi).';
  end if;

  select string_agg(p.proname, ', ') into v_lipsa
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'internal'
     and p.proname in ('foi_parcurs_inainte', 'foi_parcurs_numerotare', 'alimentari_inainte',
                       'curse_inainte', 'curse_dupa', 'aloca_numar_foaie')
     and not (coalesce(p.proconfig, '{}') @> array['search_path=""']);
  if v_lipsa is not null then
    raise exception '0197: funcții fără search_path gol: %', v_lipsa;
  end if;
end
$$;

commit;

-- ============================================================
-- Note de proiectare
-- ============================================================
--
-- * Agregatele antetului se rescriu în BEFORE, din curse, nu se scriu de un
--   trigger AFTER cu o variabilă de sesiune care să ocolească gărzile: o
--   asemenea variabilă s-ar putea seta și din afară. Aici „atingerea” din
--   `curse_dupa` nu aduce nicio valoare — antetul își calculează singur
--   cifrele, iar o atingere falsificată ar produce exact aceleași cifre.
-- * Cursele stau doar pe ciornă, deci agregatele se mișcă doar pe ciornă.
--   Pe o foaie trimisă, respinsă sau aprobată, antetul și liniile sunt
--   înghețate împreună (§D1), iar verificarea de regres de la draft → trimis
--   rămâne poarta unică a kilometrilor.
-- * Kilometrii antetului sunt ai bordului (ultima sosire − prima plecare), nu
--   suma curselor. Diferența dintre ele sunt kilometri fără cursă scrisă;
--   ecranul și PDF-ul o arată, baza n-o refuză (planul cere „monoton”, nu
--   „continuu”).
-- * O foaie pe (vehicul, zi) înseamnă un singur șofer pe zi pe o mașină:
--   decizia 1 din plan („antetul e pe vehicul și zi”). Doi șoferi pe aceeași
--   mașină de pool în aceeași zi nu încap în modelul ăsta.
-- * `ordine` NU are index unic: renumerotarea se face într-un singur UPDATE,
--   iar o unicitate imediată ar cădea la mijlocul lui.
-- * `to_jsonb(new) - c_*` compară TOT rândul, inclusiv numărul și
--   instantaneul. Numerotarea e trigger separat (`foi_parcurs_numerotare`),
--   care rulează DUPĂ gărzi (ordine alfabetică), deci nu se lovește de ele.
