-- supabase/migrations/0203_flota_amenzi_daune.sql
--
-- FLOTA, FAZA F11: AMENZILE PRIMITE PE VEHICUL ȘI INCIDENTELE / DAUNELE.
--
-- Planul o numea `0180_amenzi_daune`; între timp 0174–0202 s-au ocupat
-- (alocări, mentenanță, registru, asistent, salarizare, tichete, aprobatori,
-- KPI, flota F3–F10), deci e 0203.
--
-- ── DE UNDE VINE ────────────────────────────────────────────────────────────
-- Când un vehicul al firmei ia o amendă, firma (proprietar sau deținător
-- mandatat) trebuie să spună autorității CINE conducea (OUG 195/2002 art. 39
-- alin. (1)–(2), forma consolidată la 01.07.2026: datele se comunică „în
-- termenul indicat în cuprinsul solicitării” și cuprind numele, prenumele,
-- CNP-ul, domiciliul sau reședința și seria și numărul actului de identitate).
-- Până acum aplicația știa mașina și foaia, nu și amenda. Un termen de
-- răspuns ratat e o contravenție a firmei, deci termenul intră în `expirables`.
--
-- ── CE ADUCE ────────────────────────────────────────────────────────────────
-- A. Permisiunile `vehicle_fines:*` și `vehicle_incidents:*` (read/create/
--    update), seed global: DOAR `super_admin` și `org_admin` = all. Decizia 3
--    a planului (HR doar permisele și avizele) rămâne: o firmă care vrea ca HR
--    să ducă amenzile îi acordă cheia printr-o suprascriere pe organizație.
-- B. `public.vehicle_fines`: momentul faptei, procesul-verbal (sau solicitarea
--    de identificare), termenul de răspuns, stadiul (primită → șofer desemnat →
--    răspuns trimis; plătită / contestată / anulată) și șoferul desemnat, cu
--    cheie străină COMPUSĂ spre `employees (id, organization_id)`. Tranzițiile
--    le păzește `internal.amenzi_inainte`: o amendă închisă (plătită sau
--    anulată) nu se mai atinge, răspunsul trimis nu se mai schimbă pe alt
--    șofer, iar ștergerea logică e doar pentru amenda încă neatinsă.
-- C. Proiecția termenului în `expirables` (`entity_type = 'vehicle_fine'`,
--    `kind = 'termen_raspuns'`), DOAR cât răspunsul nu a plecat, și ramura nouă
--    în `app.poate_vedea_expirabil`, rescrisă INTEGRAL de la forma ultimă
--    (0201 §5: verificat cu grep că nicio migrare ulterioară nu o mai rescrie),
--    cu TOATE ramurile ei (inclusiv `driver_license` și `vehicle_service`).
-- D. `public.vehicle_incidents`: incidentul / dauna cu stadii (raportat →
--    constatat → la asigurător → în reparație → închis), costul estimat și
--    final, despăgubirea, asigurătorul, numărul dosarului de daună și legătura
--    OPȚIONALĂ spre cercetarea SSM (`work_accidents`). Un incident închis e
--    înghețat; la închidere se cere costul final (0 dacă n-a fost nimic de
--    plătit).
-- E. `app.sofer_la(org, vehicul, moment)`, SECURITY DEFINER: cine conducea
--    vehiculul la un moment dat. ÎNTÂI linia de foaie care acoperă momentul
--    (foaia ciornă, trimisă sau aprobată; cea respinsă nu face dovadă), APOI
--    alocarea deschisă în acel moment. Doar SUGESTIE: omul alege. Planul (F2) o
--    pusese în 0173, dar migrarea aceea n-a creat-o (verificat cu grep), deci
--    se naște aici. `public.sofer_sugerat` e învelișul apelabil prin `.rpc()`,
--    fiindcă PostgREST nu expune schema `app`.
--
-- ── CE NU FACE ──────────────────────────────────────────────────────────────
--  · NU recuperează nimic de la șofer. Reținerea din salariu cere o datorie
--    scadentă, lichidă și exigibilă, constatată prin hotărâre judecătorească
--    definitivă (Codul muncii art. 169 alin. (1)), iar răspunderea
--    patrimonială urmează art. 254: nu e automată, iar pagina o spune.
--  · NU trimite notificări push pentru termen. Rezumatul zilnic al flotei
--    (0198) rămâne pe `vehicle_document`; termenul se vede în lista amenzilor
--    și în `expirables`.
--  · NU atinge `internal.foi_parcurs_inainte`, `internal.flota_rezumat`,
--    `app.can_path`, triggerele alocărilor.
--
-- Aplicare: psql byte-exact, după bancul local; producția cere confirmare.

begin;

-- ============================================================
-- 1. Permisiunile
-- ============================================================
-- Forma 3 din `permissions.test.ts` (`(null, 'rol', 'resursă', 'acțiune',
-- 'scope')`), cu cele CINCI coloane ale indexului din 0063. Nicio cheie
-- `delete`: ștergerea e logică, prin `update`.
insert into public.role_permissions (organization_id, role, resource, action, scope) values
  (null, 'super_admin', 'vehicle_fines',     'read',   'all'),
  (null, 'super_admin', 'vehicle_fines',     'create', 'all'),
  (null, 'super_admin', 'vehicle_fines',     'update', 'all'),
  (null, 'org_admin',   'vehicle_fines',     'read',   'all'),
  (null, 'org_admin',   'vehicle_fines',     'create', 'all'),
  (null, 'org_admin',   'vehicle_fines',     'update', 'all'),
  (null, 'super_admin', 'vehicle_incidents', 'read',   'all'),
  (null, 'super_admin', 'vehicle_incidents', 'create', 'all'),
  (null, 'super_admin', 'vehicle_incidents', 'update', 'all'),
  (null, 'org_admin',   'vehicle_incidents', 'read',   'all'),
  (null, 'org_admin',   'vehicle_incidents', 'create', 'all'),
  (null, 'org_admin',   'vehicle_incidents', 'update', 'all')
on conflict (organization_id, member_id, role, resource, action)
  where deleted_at is null do nothing;

-- ============================================================
-- 2. Tipurile
-- ============================================================
create type public.amenda_stadiu as enum (
  'primita', 'sofer_desemnat', 'raspuns_trimis', 'platita', 'contestata', 'anulata'
);
create type public.incident_stadiu as enum (
  'raportat', 'constatat', 'la_asigurator', 'in_reparatie', 'inchis'
);
create type public.incident_tip as enum (
  'coliziune', 'avarie', 'furt_vandalism', 'fenomen_natural', 'altul'
);

-- Etichetele din mesajele triggerelor. Funcții IMMUTABLE, fără acces la date.
create or replace function internal.amenda_eticheta(p_stadiu public.amenda_stadiu)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_stadiu
    when 'primita'        then 'primită'
    when 'sofer_desemnat' then 'șofer desemnat'
    when 'raspuns_trimis' then 'răspuns trimis'
    when 'platita'        then 'plătită'
    when 'contestata'     then 'contestată'
    when 'anulata'        then 'anulată'
  end;
$$;

create or replace function internal.incident_eticheta(p_stadiu public.incident_stadiu)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_stadiu
    when 'raportat'      then 'raportat'
    when 'constatat'     then 'constatat'
    when 'la_asigurator' then 'la asigurător'
    when 'in_reparatie'  then 'în reparație'
    when 'inchis'        then 'închis'
  end;
$$;

-- ============================================================
-- 3. Amenzile
-- ============================================================
create table public.vehicle_fines (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  vehicle_id          uuid not null references public.vehicles (id) on delete restrict,
  -- Procesul-verbal, sau solicitarea de identificare a conducătorului (art. 39).
  numar_pv            text not null,
  data_pv             date,
  -- Momentul faptei: de el depinde cine conducea (app.sofer_la).
  constatata_la       timestamptz not null,
  locul               text,
  fapta               text not null,
  autoritate          text,
  suma                numeric(12,2),
  -- Data la care firma a primit documentul; de la ea curge termenul.
  primita_la          date not null default app.azi_local(),
  -- „Termenul indicat în cuprinsul solicitării” (art. 39 alin. (1)): îl scrie
  -- omul din document, baza nu-l presupune.
  termen_raspuns      date,
  stadiu              public.amenda_stadiu not null default 'primita',
  sofer_desemnat_id   uuid,
  desemnat_la         timestamptz,
  raspuns_trimis_la   date,
  raspuns_numar       text,
  motiv               text,
  observatii          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references auth.users (id) on delete set null,
  updated_by          uuid references auth.users (id) on delete set null,
  deleted_at          timestamptz,
  constraint vf_sofer_fk foreign key (sofer_desemnat_id, organization_id)
    references public.employees (id, organization_id) on delete restrict,
  constraint vf_numar_ck check (length(numar_pv) between 1 and 60),
  constraint vf_fapta_ck check (length(fapta) between 3 and 500),
  constraint vf_locul_ck check (locul is null or length(locul) <= 200),
  constraint vf_autoritate_ck check (autoritate is null or length(autoritate) <= 200),
  constraint vf_suma_ck check (suma is null or (suma >= 0 and suma <= 1000000)),
  constraint vf_raspuns_numar_ck check (raspuns_numar is null or length(raspuns_numar) <= 60),
  constraint vf_motiv_ck check (motiv is null or length(motiv) <= 500),
  constraint vf_observatii_ck check (observatii is null or length(observatii) <= 1000),
  -- Șoferul desemnat există exact cât timp amenda a trecut prin desemnare.
  constraint vf_desemnare_ck check (
    (stadiu in ('sofer_desemnat', 'raspuns_trimis') and sofer_desemnat_id is not null)
    or (stadiu = 'primita' and sofer_desemnat_id is null)
    or stadiu in ('platita', 'contestata', 'anulata')
  ),
  constraint vf_raspuns_ck check (
    (stadiu <> 'raspuns_trimis' or raspuns_trimis_la is not null)
    and (stadiu not in ('primita', 'sofer_desemnat') or raspuns_trimis_la is null)
  ),
  constraint vf_anulata_ck check (stadiu <> 'anulata' or motiv is not null)
);

-- Aceeași hârtie introdusă de două ori pe același vehicul: refuz. Numărul e
-- normalizat de trigger (majuscule, spații comprimate), deci „pv 12” = „PV 12”.
create unique index vf_numar_uq
  on public.vehicle_fines (organization_id, vehicle_id, numar_pv)
  where deleted_at is null;

create index vf_stadiu_idx
  on public.vehicle_fines (organization_id, stadiu, constatata_la desc)
  where deleted_at is null;

create index vf_vehicul_idx
  on public.vehicle_fines (organization_id, vehicle_id, constatata_la desc)
  where deleted_at is null;

create index vf_sofer_idx
  on public.vehicle_fines (organization_id, sofer_desemnat_id)
  where sofer_desemnat_id is not null and deleted_at is null;

comment on table public.vehicle_fines is
  'Amenzile primite pe vehicul (0203). Stadiile: primită → șofer desemnat → răspuns trimis (art. 39 OUG 195/2002); plătită / contestată / anulată. Termenul de răspuns se proiectează în expirables (vehicle_fine). Recuperarea de la șofer NU e automată (Codul muncii art. 169 și 254).';
comment on column public.vehicle_fines.termen_raspuns is
  'Termenul indicat în cuprinsul solicitării autorității (art. 39 alin. (1) OUG 195/2002). Îl scrie omul din document; nu are o valoare implicită legală.';
comment on column public.vehicle_fines.sofer_desemnat_id is
  'Șoferul comunicat autorității. Sugerat de app.sofer_la (linia de foaie, apoi alocarea), ales de om. Se golește doar prin întoarcerea la stadiul „primită”.';

-- ============================================================
-- 4. Incidentele / dauna
-- ============================================================
create table public.vehicle_incidents (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  vehicle_id          uuid not null references public.vehicles (id) on delete restrict,
  tip                 public.incident_tip not null,
  produs_la           timestamptz not null,
  locul               text,
  descriere           text not null,
  -- Șoferul de la momentul incidentului (sugerat de app.sofer_la). Nu înseamnă
  -- vinovăție: vinovăția și recuperarea sunt decizii omenești, în afara bazei.
  sofer_id            uuid,
  stadiu              public.incident_stadiu not null default 'raportat',
  cost_estimat        numeric(12,2),
  cost_final          numeric(12,2),
  despagubire         numeric(12,2),
  asigurator          text,
  dosar_numar         text,
  -- Cercetarea SSM, dacă incidentul a produs o vătămare (work_accidents).
  work_accident_id    uuid references public.work_accidents (id) on delete set null,
  inchis_la           timestamptz,
  observatii          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references auth.users (id) on delete set null,
  updated_by          uuid references auth.users (id) on delete set null,
  deleted_at          timestamptz,
  constraint vi_sofer_fk foreign key (sofer_id, organization_id)
    references public.employees (id, organization_id) on delete restrict,
  constraint vi_descriere_ck check (length(descriere) between 3 and 2000),
  constraint vi_locul_ck check (locul is null or length(locul) <= 200),
  constraint vi_costuri_ck check (
    (cost_estimat is null or (cost_estimat >= 0 and cost_estimat <= 100000000))
    and (cost_final is null or (cost_final >= 0 and cost_final <= 100000000))
    and (despagubire is null or (despagubire >= 0 and despagubire <= 100000000))
  ),
  constraint vi_asigurator_ck check (asigurator is null or length(asigurator) <= 200),
  constraint vi_dosar_ck check (dosar_numar is null or length(dosar_numar) <= 60),
  constraint vi_observatii_ck check (observatii is null or length(observatii) <= 1000),
  constraint vi_asigurator_stadiu_ck check (stadiu <> 'la_asigurator' or asigurator is not null),
  constraint vi_inchis_ck check (
    (stadiu = 'inchis' and inchis_la is not null and cost_final is not null)
    or (stadiu <> 'inchis' and inchis_la is null)
  )
);

create index vi_stadiu_idx
  on public.vehicle_incidents (organization_id, stadiu, produs_la desc)
  where deleted_at is null;

create index vi_vehicul_idx
  on public.vehicle_incidents (organization_id, vehicle_id, produs_la desc)
  where deleted_at is null;

create index vi_sofer_idx
  on public.vehicle_incidents (organization_id, sofer_id)
  where sofer_id is not null and deleted_at is null;

create index vi_cercetare_idx
  on public.vehicle_incidents (work_accident_id)
  where work_accident_id is not null and deleted_at is null;

comment on table public.vehicle_incidents is
  'Incidentele și daunele vehiculelor (0203), cu stadii și legătură opțională spre cercetarea SSM (work_accidents). Un incident închis e înghețat. Recuperarea de la șofer NU e automată (Codul muncii art. 169 și 254).';

-- ============================================================
-- 5. Triggerele amenzii
-- ============================================================
-- Integritate, nu drepturi (drepturile le judecă politicile). SECURITY DEFINER,
-- ca verificările pe vehicul și pe angajat să nu depindă de ce vede apelantul
-- prin RLS. Contextul de serviciu (seed, importuri) poate muta o amendă între
-- stadii fără tranziții; utilizatorul, nu.
create or replace function internal.amenzi_inainte()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_veh_org uuid;
  v_veh_del timestamptz;
  v_zi_fapta date;
  v_serviciu boolean := app.is_service_context();
begin
  if tg_op = 'UPDATE' and not v_serviciu then
    if old.deleted_at is not null then
      raise exception using errcode = 'P0001',
        message = 'Amenda a fost ștearsă și nu se mai modifică.';
    end if;
    if new.organization_id is distinct from old.organization_id then
      raise exception using errcode = 'P0001',
        message = 'Amenda nu se mută în altă organizație.';
    end if;
    if old.stadiu in ('platita', 'anulata') then
      raise exception using errcode = 'P0001',
        message = format('Amenda este %s și nu se mai modifică.', internal.amenda_eticheta(old.stadiu));
    end if;
  end if;

  new.numar_pv := upper(regexp_replace(btrim(coalesce(new.numar_pv, '')), '\s+', ' ', 'g'));
  new.fapta := btrim(coalesce(new.fapta, ''));
  new.locul := nullif(btrim(coalesce(new.locul, '')), '');
  new.autoritate := nullif(btrim(coalesce(new.autoritate, '')), '');
  new.raspuns_numar := nullif(btrim(coalesce(new.raspuns_numar, '')), '');
  new.motiv := nullif(btrim(coalesce(new.motiv, '')), '');
  new.observatii := nullif(btrim(coalesce(new.observatii, '')), '');

  if new.numar_pv = '' then
    raise exception using errcode = 'P0001',
      message = 'Scrieți numărul procesului-verbal sau al solicitării.';
  end if;
  if length(new.fapta) < 3 then
    raise exception using errcode = 'P0001',
      message = 'Scrieți fapta constatată, în cel puțin 3 caractere.';
  end if;

  -- Vehiculul: același tenant și neșters. Verificat la insert și la schimbare.
  if tg_op = 'INSERT' or new.vehicle_id is distinct from old.vehicle_id then
    select v.organization_id, v.deleted_at into v_veh_org, v_veh_del
      from public.vehicles v where v.id = new.vehicle_id;
    if v_veh_org is null or v_veh_org <> new.organization_id or v_veh_del is not null then
      raise exception using errcode = 'P0001',
        message = 'Vehiculul ales nu aparține organizației dumneavoastră.';
    end if;
  end if;

  if tg_op = 'INSERT' or new.constatata_la is distinct from old.constatata_la then
    if new.constatata_la > now() + interval '1 day' then
      raise exception using errcode = 'P0001',
        message = 'Momentul faptei nu poate fi în viitor.';
    end if;
  end if;
  v_zi_fapta := (new.constatata_la at time zone 'Europe/Bucharest')::date;
  if new.data_pv is not null and new.data_pv < v_zi_fapta then
    raise exception using errcode = 'P0001',
      message = 'Procesul-verbal nu poate fi încheiat înaintea faptei constatate.';
  end if;
  if new.primita_la > app.azi_local() then
    raise exception using errcode = 'P0001',
      message = 'Data primirii nu poate fi în viitor.';
  end if;
  if new.data_pv is not null and new.primita_la < new.data_pv then
    raise exception using errcode = 'P0001',
      message = 'Data primirii nu poate fi înaintea datei procesului-verbal.';
  end if;
  if new.termen_raspuns is not null and new.termen_raspuns < new.primita_la then
    raise exception using errcode = 'P0001',
      message = 'Termenul de răspuns nu poate fi înaintea datei primirii.';
  end if;

  if tg_op = 'UPDATE' and not v_serviciu then
    -- Tranzițiile. „Plătită” și „anulată” sunt capete; „răspuns trimis” nu se
    -- mai întoarce (scrisoarea a plecat).
    if new.stadiu is distinct from old.stadiu and not (
         (old.stadiu = 'primita'        and new.stadiu in ('sofer_desemnat', 'platita', 'contestata', 'anulata'))
      or (old.stadiu = 'sofer_desemnat' and new.stadiu in ('primita', 'raspuns_trimis', 'platita', 'contestata', 'anulata'))
      or (old.stadiu = 'raspuns_trimis' and new.stadiu in ('platita', 'contestata', 'anulata'))
      or (old.stadiu = 'contestata'     and new.stadiu in ('platita', 'anulata'))
    ) then
      raise exception using errcode = 'P0001',
        message = format('Amenda nu poate trece din stadiul „%s” în „%s”.',
                         internal.amenda_eticheta(old.stadiu), internal.amenda_eticheta(new.stadiu));
    end if;

    -- Ștergerea logică: doar amenda încă neatinsă (introdusă din greșeală).
    if new.deleted_at is not null and old.deleted_at is null and old.stadiu <> 'primita' then
      raise exception using errcode = 'P0001',
        message = 'O amendă aflată în lucru nu se șterge. Marcați-o anulată, cu motivul.';
    end if;

    -- După răspuns, ce s-a comunicat autorității nu se mai schimbă.
    if old.raspuns_trimis_la is not null and (
         new.sofer_desemnat_id is distinct from old.sofer_desemnat_id
      or new.vehicle_id is distinct from old.vehicle_id
      or new.constatata_la is distinct from old.constatata_la
      or new.numar_pv is distinct from old.numar_pv
    ) then
      raise exception using errcode = 'P0001',
        message = 'După trimiterea răspunsului, vehiculul, momentul faptei, numărul procesului-verbal și șoferul desemnat nu se mai schimbă.';
    end if;
  end if;

  -- Desemnarea.
  if new.stadiu = 'primita' then
    new.sofer_desemnat_id := null;
    new.desemnat_la := null;
    new.raspuns_trimis_la := null;
    new.raspuns_numar := null;
  elsif new.stadiu in ('sofer_desemnat', 'raspuns_trimis') then
    if new.sofer_desemnat_id is null then
      raise exception using errcode = 'P0001',
        message = 'Alegeți șoferul pe care îl comunicați autorității.';
    end if;
    if tg_op = 'INSERT'
       or old.sofer_desemnat_id is distinct from new.sofer_desemnat_id
       or old.stadiu = 'primita' then
      new.desemnat_la := now();
    end if;
  end if;
  if new.stadiu = 'raspuns_trimis' and new.raspuns_trimis_la is null then
    raise exception using errcode = 'P0001',
      message = 'Scrieți data la care a plecat răspunsul către autoritate.';
  end if;
  if new.raspuns_trimis_la is not null and new.raspuns_trimis_la > app.azi_local() then
    raise exception using errcode = 'P0001',
      message = 'Data trimiterii răspunsului nu poate fi în viitor.';
  end if;
  if new.stadiu = 'anulata' and new.motiv is null then
    raise exception using errcode = 'P0001',
      message = 'Scrieți motivul anulării.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- Termenul de răspuns în lista de conformitate. AFTER, ca să vadă rândul
-- final. Cât răspunsul n-a plecat (primită, șofer desemnat, contestată), cu
-- scadența; după aceea scadența dispare (alertele deschise se închid singure).
create or replace function internal.amenzi_scadenta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nr text;
begin
  select v.nr_inmatriculare into v_nr
    from public.vehicles v where v.id = new.vehicle_id;

  perform internal.sync_expirable(
    new.organization_id,
    'vehicle_fine',
    new.id,
    'termen_raspuns',
    left('Răspuns la amenda ' || new.numar_pv || ' — ' || coalesce(v_nr, 'vehicul'), 200),
    case when new.deleted_at is null
              and new.stadiu in ('primita', 'sofer_desemnat', 'contestata')
         then new.termen_raspuns end,
    'vehicle_fines',
    null,
    true
  );
  return null;
end;
$$;

create trigger amenzi_inainte
  before insert or update on public.vehicle_fines
  for each row execute function internal.amenzi_inainte();

create trigger amenzi_scadenta
  after insert or update on public.vehicle_fines
  for each row execute function internal.amenzi_scadenta();

-- ============================================================
-- 6. Triggerul incidentului
-- ============================================================
create or replace function internal.incidente_inainte()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_veh_org uuid;
  v_veh_del timestamptz;
  v_serviciu boolean := app.is_service_context();
begin
  if tg_op = 'UPDATE' and not v_serviciu then
    if old.deleted_at is not null then
      raise exception using errcode = 'P0001',
        message = 'Incidentul a fost șters și nu se mai modifică.';
    end if;
    if new.organization_id is distinct from old.organization_id then
      raise exception using errcode = 'P0001',
        message = 'Incidentul nu se mută în altă organizație.';
    end if;
    if old.stadiu = 'inchis' then
      raise exception using errcode = 'P0001',
        message = 'Incidentul este închis și nu se mai modifică.';
    end if;
    if new.vehicle_id is distinct from old.vehicle_id then
      raise exception using errcode = 'P0001',
        message = 'Incidentul nu se mută pe alt vehicul. Ștergeți-l și raportați-l pe vehiculul corect.';
    end if;
    if new.deleted_at is not null and old.deleted_at is null and old.stadiu <> 'raportat' then
      raise exception using errcode = 'P0001',
        message = 'Un incident aflat în lucru nu se șterge. Închideți-l, cu costul final.';
    end if;
  end if;

  new.locul := nullif(btrim(coalesce(new.locul, '')), '');
  new.descriere := btrim(coalesce(new.descriere, ''));
  new.asigurator := nullif(btrim(coalesce(new.asigurator, '')), '');
  new.dosar_numar := nullif(btrim(coalesce(new.dosar_numar, '')), '');
  new.observatii := nullif(btrim(coalesce(new.observatii, '')), '');

  if length(new.descriere) < 3 then
    raise exception using errcode = 'P0001',
      message = 'Descrieți incidentul, în cel puțin 3 caractere.';
  end if;

  if tg_op = 'INSERT' then
    select v.organization_id, v.deleted_at into v_veh_org, v_veh_del
      from public.vehicles v where v.id = new.vehicle_id;
    if v_veh_org is null or v_veh_org <> new.organization_id or v_veh_del is not null then
      raise exception using errcode = 'P0001',
        message = 'Vehiculul ales nu aparține organizației dumneavoastră.';
    end if;
  end if;

  if (tg_op = 'INSERT' or new.produs_la is distinct from old.produs_la)
     and new.produs_la > now() + interval '1 day' then
    raise exception using errcode = 'P0001',
      message = 'Momentul incidentului nu poate fi în viitor.';
  end if;

  if new.work_accident_id is not null
     and (tg_op = 'INSERT' or new.work_accident_id is distinct from old.work_accident_id) then
    if not exists (
      select 1 from public.work_accidents w
       where w.id = new.work_accident_id
         and w.organization_id = new.organization_id
         and w.deleted_at is null
    ) then
      raise exception using errcode = 'P0001',
        message = 'Cercetarea SSM aleasă nu aparține organizației dumneavoastră.';
    end if;
  end if;

  if new.stadiu = 'la_asigurator' and new.asigurator is null then
    raise exception using errcode = 'P0001',
      message = 'Scrieți numele asigurătorului la care ați înregistrat dauna.';
  end if;
  if new.stadiu = 'inchis' then
    if new.cost_final is null then
      raise exception using errcode = 'P0001',
        message = 'Scrieți costul final al daunei (0 dacă n-a fost nimic de plătit) înainte de închidere.';
    end if;
    if new.inchis_la is null then
      new.inchis_la := now();
    end if;
  else
    new.inchis_la := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger incidente_inainte
  before insert or update on public.vehicle_incidents
  for each row execute function internal.incidente_inainte();

-- ============================================================
-- 7. Termenul amenzii în lista de conformitate
-- ============================================================
-- Rescriere INTEGRALĂ de la forma ultimă (0201 §5), plus `vehicle_fine`. Fără
-- ramura nouă rândul ar fi căzut pe `else false`: invizibil oricui. Toate
-- ramurile existente se păstrează NESCHIMBATE, inclusiv `driver_license` (0201)
-- și `vehicle_service` (0200, ramura paralelă F7). O migrare viitoare care
-- adaugă un `entity_type` pornește de la ACEASTA.
create or replace function app.poate_vedea_expirabil(p_organization_id uuid, p_entity_type text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case p_entity_type
    when 'medical_exam'             then app.feature_on(p_organization_id,'ssm')        and app.can(p_organization_id,'ssm','read','team')
    when 'employee_document'        then app.can(p_organization_id,'employees','read','team')
    when 'work_permit'              then app.can(p_organization_id,'employees','read','team')
    when 'employment_contract'      then app.can(p_organization_id,'employees','read','team')
    when 'vehicle_document'         then app.feature_on(p_organization_id,'fleet')       and app.can(p_organization_id,'vehicles','read','team')
    -- Din 0200 (F7): scadențele planurilor de service, același drept ca documentele.
    when 'vehicle_service'          then app.feature_on(p_organization_id,'fleet')       and app.can(p_organization_id,'vehicles','read','team')
    when 'equipment'              then app.feature_on(p_organization_id,'maintenance') and app.can(p_organization_id,'maintenance','read','team')
    when 'fire_extinguisher'        then app.feature_on(p_organization_id,'ssm')         and app.can(p_organization_id,'ssm','read','team')
    when 'ssm_training'             then app.feature_on(p_organization_id,'ssm')         and app.can(p_organization_id,'ssm','read','team')
    when 'environmental_permit'     then app.feature_on(p_organization_id,'ssm')         and app.can(p_organization_id,'compliance','read','team')
    when 'inventory_item'           then app.feature_on(p_organization_id,'inventory')   and app.can(p_organization_id,'inventory','read','team')
    when 'iscir_authorization'      then app.feature_on(p_organization_id,'maintenance') and app.can(p_organization_id,'maintenance','read','team')
    when 'maintenance_plan'         then app.feature_on(p_organization_id,'maintenance') and app.can(p_organization_id,'maintenance','read','team')
    when 'personnel_authorization'  then app.feature_on(p_organization_id,'ssm')         and app.can(p_organization_id,'ssm','read','team')
    when 'ppe_issuance'             then app.feature_on(p_organization_id,'ssm')         and app.can(p_organization_id,'ssm','read','team')
    -- 0201: permisele șoferilor, cu cheia lor (hr le are, parcul nu).
    when 'driver_license'           then app.feature_on(p_organization_id,'fleet')       and app.can(p_organization_id,'driver_licenses','read','team')
    -- 0203: termenul de răspuns la o amendă. Cheie proprie: amenzile le văd
    -- doar cei care le administrează, nu oricine vede parcul.
    when 'vehicle_fine'             then app.feature_on(p_organization_id,'fleet')       and app.has_permission(p_organization_id,'vehicle_fines','read') = 'all'
    else false
  end
$$;

-- ============================================================
-- 8. Cine conducea la un moment dat
-- ============================================================
-- ÎNTÂI linia de foaie care acoperă momentul (o linie fără sosire durează
-- până la sfârșitul zilei foii), APOI alocarea deschisă atunci. Foaia respinsă
-- nu face dovadă. Funcția rulează cu drepturile bazei, deci își judecă singură
-- apelantul: cine administrează amenzile sau incidentele (`create = all`) sau
-- platforma. Ceilalți primesc zero rânduri, fără eroare.
create or replace function app.sofer_la(
  p_organization_id uuid,
  p_vehicle_id uuid,
  p_moment timestamptz
)
returns table (employee_id uuid, sursa text, referinta_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_organization_id is null or p_vehicle_id is null or p_moment is null then
    return;
  end if;
  if not ((select app.is_platform_admin())
          or (p_organization_id = any ((select app.current_org_ids())::uuid[])
              and app.feature_on(p_organization_id, 'fleet')
              and (app.has_permission(p_organization_id, 'vehicle_fines', 'create') = 'all'
                   or app.has_permission(p_organization_id, 'vehicle_incidents', 'create') = 'all'))) then
    return;
  end if;
  if not exists (
    select 1 from public.vehicles v
     where v.id = p_vehicle_id and v.organization_id = p_organization_id
  ) then
    return;
  end if;

  return query
    select ts.employee_id, 'foaie'::text, ts.id
      from public.trip_sheet_curse c
      join public.trip_sheets ts on ts.id = c.trip_sheet_id
     where ts.organization_id = p_organization_id
       and ts.vehicle_id = p_vehicle_id
       and ts.deleted_at is null
       and c.deleted_at is null
       and ts.status <> 'respins'
       and ts.employee_id is not null
       and c.plecare_la <= p_moment
       and p_moment <= coalesce(c.sosire_la, ((ts.data + 1)::timestamp at time zone 'Europe/Bucharest'))
     order by c.plecare_la desc, c.created_at desc
     limit 1;
  if found then
    return;
  end if;

  return query
    select va.employee_id, 'alocare'::text, va.id
      from public.vehicle_assignments va
     where va.organization_id = p_organization_id
       and va.vehicle_id = p_vehicle_id
       and va.deleted_at is null
       and va.de_la <= p_moment
       and (va.pana_la is null or p_moment < va.pana_la)
     order by va.de_la desc
     limit 1;
end;
$$;

comment on function app.sofer_la(uuid, uuid, timestamptz) is
  'Cine conducea vehiculul la un moment dat (0203): întâi linia de foaie (sursa „foaie”, foaia nerespinsă), apoi alocarea (sursa „alocare”). Doar sugestie. Zero rânduri pentru cine nu administrează amenzile / incidentele sau când nu se știe.';

-- Învelișul pentru `.rpc()`: PostgREST expune doar schema `public`.
create or replace function public.sofer_sugerat(
  p_organization_id uuid,
  p_vehicle_id uuid,
  p_moment timestamptz
)
returns table (employee_id uuid, sursa text, referinta_id uuid)
language sql
stable
set search_path = ''
as $$
  select s.employee_id, s.sursa, s.referinta_id
    from app.sofer_la(p_organization_id, p_vehicle_id, p_moment) s;
$$;

comment on function public.sofer_sugerat(uuid, uuid, timestamptz) is
  'Învelișul apelabil prin .rpc() al lui app.sofer_la (0203).';

-- ============================================================
-- 9. RLS
-- ============================================================
-- Fără `deleted_at` în USING-ul de SELECT (0016): ștergerea logică cu RETURNING
-- ar cădea pe propria politică. INSERT pinuiește starea inițială.
alter table public.vehicle_fines enable row level security;
alter table public.vehicle_fines force row level security;

create policy vehicle_fines_select on public.vehicle_fines
for select to authenticated
using (
  (select app.is_platform_admin()) or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.has_permission(organization_id, 'vehicle_fines', 'read') = 'all'
  )
);

create policy vehicle_fines_insert on public.vehicle_fines
for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.has_permission(organization_id, 'vehicle_fines', 'create') = 'all'
  and stadiu = 'primita'
  and sofer_desemnat_id is null
  and raspuns_trimis_la is null
  and deleted_at is null
);

create policy vehicle_fines_update on public.vehicle_fines
for update to authenticated
using (
  deleted_at is null
  and organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.has_permission(organization_id, 'vehicle_fines', 'update') = 'all'
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.has_permission(organization_id, 'vehicle_fines', 'update') = 'all'
);

alter table public.vehicle_incidents enable row level security;
alter table public.vehicle_incidents force row level security;

create policy vehicle_incidents_select on public.vehicle_incidents
for select to authenticated
using (
  (select app.is_platform_admin()) or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.has_permission(organization_id, 'vehicle_incidents', 'read') = 'all'
  )
);

create policy vehicle_incidents_insert on public.vehicle_incidents
for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.has_permission(organization_id, 'vehicle_incidents', 'create') = 'all'
  and stadiu = 'raportat'
  and inchis_la is null
  and deleted_at is null
);

create policy vehicle_incidents_update on public.vehicle_incidents
for update to authenticated
using (
  deleted_at is null
  and organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.has_permission(organization_id, 'vehicle_incidents', 'update') = 'all'
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.has_permission(organization_id, 'vehicle_incidents', 'update') = 'all'
);

-- ============================================================
-- 10. Actor, audit, drepturi
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['vehicle_fines', 'vehicle_incidents'] loop
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

revoke all on function internal.amenda_eticheta(public.amenda_stadiu) from public, anon, authenticated;
revoke all on function internal.incident_eticheta(public.incident_stadiu) from public, anon, authenticated;
revoke all on function internal.amenzi_inainte() from public, anon, authenticated;
revoke all on function internal.amenzi_scadenta() from public, anon, authenticated;
revoke all on function internal.incidente_inainte() from public, anon, authenticated;
revoke all on function app.poate_vedea_expirabil(uuid, text) from public, anon;
grant execute on function app.poate_vedea_expirabil(uuid, text) to authenticated;
revoke all on function app.sofer_la(uuid, uuid, timestamptz) from public, anon;
grant execute on function app.sofer_la(uuid, uuid, timestamptz) to authenticated, service_role;
revoke all on function public.sofer_sugerat(uuid, uuid, timestamptz) from public, anon;
grant execute on function public.sofer_sugerat(uuid, uuid, timestamptz) to authenticated, service_role;

-- ============================================================
-- 11. Verificare
-- ============================================================
do $$
declare
  v_lipsa text[] := '{}';
  v_t text;
  v_def text;
begin
  foreach v_t in array array['vehicle_fines', 'vehicle_incidents'] loop
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
      v_lipsa := v_lipsa || ('USING + WITH CHECK pe ' || v_t || '_update');
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

  foreach v_t in array array['vf_numar_uq', 'vf_stadiu_idx', 'vf_vehicul_idx', 'vf_sofer_idx',
                             'vi_stadiu_idx', 'vi_vehicul_idx', 'vi_sofer_idx', 'vi_cercetare_idx'] loop
    if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = v_t
                    and indexdef ilike '%where (%deleted_at is null%') then
      v_lipsa := v_lipsa || (v_t || ' (parțial)');
    end if;
  end loop;

  v_def := pg_get_functiondef('app.poate_vedea_expirabil(uuid,text)'::regprocedure);
  if position('vehicle_fine' in v_def) = 0
     or position('driver_license' in v_def) = 0
     or position('vehicle_service' in v_def) = 0
     or position('ppe_issuance' in v_def) = 0
     or position('vehicle_document' in v_def) = 0
     or position('medical_exam' in v_def) = 0 then
    v_lipsa := v_lipsa || 'app.poate_vedea_expirabil cu toate ramurile';
  end if;

  if (select count(*) from public.role_permissions
       where resource in ('vehicle_fines', 'vehicle_incidents')
         and organization_id is null and member_id is null and deleted_at is null) <> 12 then
    v_lipsa := v_lipsa || 'seed-ul vehicle_fines / vehicle_incidents (12 rânduri)';
  end if;
  if exists (select 1 from public.role_permissions
              where resource in ('vehicle_fines', 'vehicle_incidents')
                and organization_id is null and member_id is null and deleted_at is null
                and role not in ('super_admin', 'org_admin')) then
    v_lipsa := v_lipsa || 'seed-ul amenzilor acordat altui rol decât super_admin / org_admin';
  end if;

  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where (n.nspname, p.proname) in (('internal', 'amenzi_inainte'), ('internal', 'amenzi_scadenta'),
                                               ('internal', 'incidente_inainte'), ('internal', 'amenda_eticheta'),
                                               ('internal', 'incident_eticheta'), ('app', 'sofer_la'),
                                               ('public', 'sofer_sugerat'))
                and (p.proconfig is null or not ('search_path=""' = any (p.proconfig)))) then
    v_lipsa := v_lipsa || 'search_path gol pe funcțiile 0203';
  end if;
  if position('is_platform_admin' in pg_get_functiondef('app.sofer_la(uuid,uuid,timestamptz)'::regprocedure)) = 0
     or position('vehicle_fines' in pg_get_functiondef('app.sofer_la(uuid,uuid,timestamptz)'::regprocedure)) = 0 then
    v_lipsa := v_lipsa || 'app.sofer_la își judecă singură apelantul';
  end if;
  if array_length(v_lipsa, 1) > 0 then
    raise exception '0203: lipsesc %', array_to_string(v_lipsa, ', ');
  end if;
end $$;

commit;
