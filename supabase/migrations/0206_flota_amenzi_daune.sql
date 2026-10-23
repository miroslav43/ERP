-- supabase/migrations/0206_flota_amenzi_daune.sql
--
-- FLOTA, FAZA F11: AMENZILE PRIMITE PE VEHICUL ȘI INCIDENTELE / DAUNELE.
--
-- Planul o numea `0180_amenzi_daune`; între timp 0174–0205 s-au ocupat
-- (alocări, mentenanță, registru, asistent, salarizare, tichete, aprobatori,
-- KPI, flota F3–F10), deci e 0206.
--
-- ── DE UNDE VINE ────────────────────────────────────────────────────────────
-- Când un vehicul al firmei ia o amendă, firma (proprietar sau deținător
-- mandatat) trebuie să spună autorității CINE conducea (OUG 195/2002 art. 39
-- alin. (1)–(2), forma consolidată la 01.07.2026: datele se comunică „în
-- termenul indicat în cuprinsul solicitării” și cuprind numele, prenumele,
-- CNP-ul, domiciliul sau reședința și seria și numărul actului de identitate).
-- Până acum aplicația știa mașina și foaia, nu și amenda. Un termen de
-- răspuns ratat e o contravenție (art. 105 pct. 10 pentru persoanele juridice,
-- art. 102 alin. (1) pct. 14 pentru cele fizice), deci termenul intră în
-- `expirables`.
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
--    (0204 §5: verificat cu grep că nicio migrare ulterioară nu o mai rescrie),
--    cu TOATE ramurile ei (inclusiv `driver_license` și `vehicle_service`).
-- D. `public.vehicle_incidents`: incidentul / dauna cu stadii (raportat →
--    constatat → la asigurător → în reparație → închis), costul estimat și
--    final, despăgubirea, asigurătorul, numărul dosarului de daună și legătura
--    OPȚIONALĂ spre cercetarea SSM (`work_accidents`), pe care o pune doar cine
--    VEDE cercetarea prin regulile SSM (triggerul o judecă). Un incident închis e
--    înghețat; la închidere se cere costul final (0 dacă n-a fost nimic de
--    plătit).
-- E. `app.sofer_la(org, vehicul, moment)`, SECURITY DEFINER: cine conducea
--    vehiculul la un moment dat. ÎNTÂI linia de foaie care acoperă momentul
--    (foaia ciornă, trimisă sau aprobată; cea respinsă nu face dovadă), APOI
--    alocarea deschisă în acel moment. Doar SUGESTIE: omul alege. Planul (F2) o
--    pusese în 0173, dar migrarea aceea n-a creat-o (verificat cu grep), deci
--    se naște aici. `public.sofer_sugerat` e învelișul apelabil prin `.rpc()`,
--    fiindcă PostgREST nu expune schema `app`.
-- F. (decizia din 21 oct 2026) ȘOFERUL își declară dauna din portal („Mașina
--    mea”): cheia `vehicle_incidents:create = own` pentru `employee`, coloana
--    `declarat_de_employee_id`, ramura `own` a politicilor (inserează DOAR pe
--    vehiculul alocat lui în ziua incidentului sau pe pool, și vede DOAR ce a
--    declarat el) și notificarea responsabilului de flotă (§6b). Amenzile îi
--    rămân închise: nicio cheie `vehicle_fines` în afara administratorilor.
-- G. (decizia din 21 oct 2026) Termenul de răspuns al amenzii intră în
--    rezumatul zilnic al flotei: `internal.flota_rezumat` rescrisă de la forma
--    ultimă (0203 §11) cu `vehicle_fine` în lista albă (§12). Destinatarii
--    amenzii sunt DOAR responsabilii de flotă (sau administratorii) care citesc
--    amenzile la `all`, niciodată șoferul.
--
-- ── CE NU FACE ──────────────────────────────────────────────────────────────
--  · NU recuperează nimic de la șofer. Reținerea din salariu cere o datorie
--    scadentă, lichidă și exigibilă, constatată prin hotărâre judecătorească
--    definitivă și irevocabilă (Codul muncii art. 169 alin. (2), forma
--    consolidată la 18.12.2025), iar răspunderea patrimonială urmează art.
--    254 (recuperare prin acordul părților, cu notă de constatare și
--    evaluare, cel mult 5 salarii minime brute, alin. (3)–(4)): nu e
--    automată, iar pagina o spune.
--  · NU atinge `internal.foi_parcurs_inainte`, `app.can_path`, triggerele
--    alocărilor.
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
  (null, 'org_admin',   'vehicle_incidents', 'update', 'all'),
  -- §F: șoferul își declară dauna pe mașina LUI. Fără `read`: își vede
  -- declarațiile prin ramura `own` a politicii de SELECT, nu lista firmei.
  (null, 'employee',    'vehicle_incidents', 'create', 'own')
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
  'Amenzile primite pe vehicul (0206). Stadiile: primită → șofer desemnat → răspuns trimis (art. 39 OUG 195/2002); plătită / contestată / anulată. Termenul de răspuns se proiectează în expirables (vehicle_fine). Recuperarea de la șofer NU e automată (Codul muncii art. 169 și 254).';
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
  -- §F: fișa șoferului care a DECLARAT incidentul din portal; nul pentru cele
  -- înregistrate de administrator. O pune triggerul (`app.fisa_mea`), nu clientul,
  -- și nu se mai schimbă. După ea șoferul își vede declarațiile.
  declarat_de_employee_id uuid,
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
  constraint vi_declarant_fk foreign key (declarat_de_employee_id, organization_id)
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

-- §F: „declarațiile mele” din portal, și ramura `own` a politicii de SELECT.
create index vi_declarant_idx
  on public.vehicle_incidents (organization_id, declarat_de_employee_id, produs_la desc)
  where declarat_de_employee_id is not null and deleted_at is null;

comment on table public.vehicle_incidents is
  'Incidentele și daunele vehiculelor (0206), cu stadii și legătură opțională spre cercetarea SSM (work_accidents). Un incident închis e înghețat. Recuperarea de la șofer NU e automată (Codul muncii art. 169 și 254).';

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
  -- X2 (revizie): triggerul BEFORE rulează ÎNAINTEA WITH CHECK. Fără garda de
  -- firmă întâi, un rând pus de altă firmă pe firma victimei deosebea vehiculul
  -- și șoferul care există acolo (trec, apoi 42501 de la politică) de cele
  -- inexistente (P0001 mai jos) — o sondă între firme. Refuzul e neutru și
  -- nu depinde de nimic din rând în afară de firmă.
  if not v_serviciu
     and not (new.organization_id = any ((select app.current_org_ids())::uuid[])) then
    raise exception using errcode = '42501',
      message = 'Nu aveți dreptul de a înregistra amenzi în această organizație.';
  end if;

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

  -- X2: șoferul comunicat autorității e o fișă VIE a firmei. Cheia străină
  -- compusă `vf_sofer_fk` prinde doar firma, nu și ștergerea logică: o fișă
  -- ștearsă (introdusă din greșeală) trecea. Judecat la desemnare și la
  -- schimbare; o desemnare veche rămâne valabilă dacă fișa e ștearsă ulterior.
  -- Un singur mesaj pentru „nu există”, „e ștearsă” și „e în altă firmă”, ca
  -- refuzul să nu fie o sondă între firme.
  if new.sofer_desemnat_id is not null
     and (tg_op = 'INSERT' or new.sofer_desemnat_id is distinct from old.sofer_desemnat_id)
     and not exists (
       select 1 from public.employees e
        where e.id = new.sofer_desemnat_id
          and e.organization_id = new.organization_id
          and e.deleted_at is null
     ) then
    raise exception using errcode = 'P0001',
      message = 'Șoferul desemnat nu există în organizația dumneavoastră sau fișa lui a fost ștearsă.';
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
  elsif new.stadiu = 'contestata' then
    -- Contestată ÎNAINTE de răspuns: obligația de a comunica șoferul autorității
    -- (art. 39 alin. (1)) rămâne, iar termenul rămâne în `expirables`. Omul
    -- desemnează șoferul și marchează răspunsul FĂRĂ să schimbe stadiul (de aici
    -- nu există tranziție înapoi spre „șofer desemnat”). Un răspuns fără șofer
    -- nu are ce comunica.
    if new.raspuns_trimis_la is not null and new.sofer_desemnat_id is null then
      raise exception using errcode = 'P0001',
        message = 'Alegeți șoferul pe care îl comunicați autorității.';
    end if;
    if new.sofer_desemnat_id is null then
      new.desemnat_la := null;
    elsif tg_op = 'INSERT' or old.sofer_desemnat_id is distinct from new.sofer_desemnat_id then
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
-- final. Cât răspunsul n-a plecat (primită, șofer desemnat, contestată fără
-- răspuns trimis), cu scadența; după aceea scadența dispare (alertele
-- deschise se închid singure).
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
              -- „Contestată” după ce răspunsul a plecat NU readuce un termen trecut.
              and new.raspuns_trimis_la is null
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
-- §F: vehiculul e „al meu” în ziua `p_moment` (ora României) dacă e din pool
-- sau dacă fișa principală a apelantului avea o alocare care atinge ziua —
-- aceeași regulă ca foaia de parcurs (0199 §C1, 0200). Folosită de triggerul
-- incidentului (pentru mesaj) și de politica de INSERT (pentru refuz).
-- SECURITY DEFINER: alocările și vehiculul se judecă fără RLS-ul apelantului.
create or replace function app.vehicul_al_meu_la(
  p_organization_id uuid,
  p_vehicle_id uuid,
  p_moment timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with zi as (
    select (p_moment at time zone 'Europe/Bucharest')::date as d
  )
  select p_organization_id is not null and p_vehicle_id is not null and p_moment is not null
     and exists (
       select 1 from public.vehicles v
        where v.id = p_vehicle_id
          and v.organization_id = p_organization_id
          and v.deleted_at is null
          and (
            v.pool
            or exists (
              select 1
                from public.vehicle_assignments a, zi
               where a.vehicle_id = v.id
                 and a.organization_id = p_organization_id
                 and a.employee_id = app.fisa_mea(p_organization_id)
                 and a.deleted_at is null
                 and a.de_la < ((zi.d + 1)::timestamp at time zone 'Europe/Bucharest')
                 and coalesce(a.pana_la, 'infinity'::timestamptz) > (zi.d::timestamp at time zone 'Europe/Bucharest')
            )
          )
     );
$$;

comment on function app.vehicul_al_meu_la(uuid, uuid, timestamptz) is
  'Vehiculul e din pool sau era alocat fișei principale a apelantului în ziua momentului dat, ora României (0206 §F). Garda declarației de incident din portal.';

create or replace function internal.incidente_inainte()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_veh_org uuid;
  v_veh_del timestamptz;
  v_scope   public.permission_scope;
  v_fisa    uuid;
  v_serviciu boolean := app.is_service_context();
begin
  -- X2 (revizie): garda de firmă înaintea oricărei căutări (vezi amenzile).
  if not v_serviciu
     and not (new.organization_id = any ((select app.current_org_ids())::uuid[])) then
    raise exception using errcode = '42501',
      message = 'Nu aveți dreptul de a înregistra incidente în această organizație.';
  end if;

  if tg_op = 'UPDATE' and not v_serviciu then
    -- §F: declarantul e un fapt, nu un câmp de corectat.
    new.declarat_de_employee_id := old.declarat_de_employee_id;
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

    -- §F: declarația șoferului. Cine nu înregistrează incidente pe orice
    -- vehicul (`create` ≠ all) declară doar în numele lui, ca șofer, pe mașina
    -- alocată lui în ziua incidentului (ora României) sau pe una din pool —
    -- aceeași regulă ca foaia de parcurs (0199 §C1). Declarantul și șoferul îi
    -- pune baza; politica de INSERT verifică apoi aceleași coloane.
    if not v_serviciu then
      v_scope := app.has_permission(new.organization_id, 'vehicle_incidents', 'create');
      v_fisa := app.fisa_mea(new.organization_id);
      if v_scope = 'all' then
        if new.declarat_de_employee_id is not null
           and new.declarat_de_employee_id is distinct from v_fisa then
          raise exception using errcode = 'P0001',
            message = 'Declarantul unui incident e întotdeauna cel care îl declară.';
        end if;
      elsif v_scope in ('own', 'team') then
        if v_fisa is null then
          raise exception using errcode = 'P0001',
            message = 'Contul dumneavoastră nu e legat de o fișă de angajat, deci nu puteți declara un incident.';
        end if;
        new.declarat_de_employee_id := v_fisa;
        new.sofer_id := v_fisa;
        if not app.vehicul_al_meu_la(new.organization_id, new.vehicle_id, new.produs_la) then
          raise exception using errcode = 'P0001',
            message = 'Vehiculul ales nu vă era alocat în ziua incidentului și nu este o mașină comună (pool). Declarați incidentul pe mașina primită în folosință.';
        end if;
      end if;
    end if;
  end if;

  -- X2: șoferul incidentului, la fel ca șoferul amenzii: o fișă vie a firmei,
  -- judecată la schimbare, cu un singur mesaj pentru toate cazurile.
  if new.sofer_id is not null
     and (tg_op = 'INSERT' or new.sofer_id is distinct from old.sofer_id)
     and not exists (
       select 1 from public.employees e
        where e.id = new.sofer_id
          and e.organization_id = new.organization_id
          and e.deleted_at is null
     ) then
    raise exception using errcode = 'P0001',
      message = 'Șoferul incidentului nu există în organizația dumneavoastră sau fișa lui a fost ștearsă.';
  end if;

  if (tg_op = 'INSERT' or new.produs_la is distinct from old.produs_la)
     and new.produs_la > now() + interval '1 day' then
    raise exception using errcode = 'P0001',
      message = 'Momentul incidentului nu poate fi în viitor.';
  end if;

  -- Legătura cu cercetarea SSM. Funcția rulează cu drepturile bazei, deci
  -- vede toate cercetările: pe lângă „a firmei, neștearsă”, cere ca APELANTUL
  -- s-o poată citi (aceeași judecată ca `work_accidents_select`: modulul `ssm`
  -- activ și `app.ssm_acces(..., 'read', angajatul accidentat)`). Altfel cine
  -- scrie incidente fără acces SSM putea lega orice cercetare a firmei și,
  -- din refuz, afla ce id-uri există. Un singur mesaj pentru „nu există” și
  -- „nu o puteți consulta”, ca refuzul să nu fie o sondă. Se judecă doar la
  -- SCHIMBARE: o legătură pusă de altcineva se păstrează la o corectură.
  -- Contextul de serviciu (seed, importuri) judecă doar firma.
  if new.work_accident_id is not null
     and (tg_op = 'INSERT' or new.work_accident_id is distinct from old.work_accident_id) then
    if not exists (
      select 1 from public.work_accidents w
       where w.id = new.work_accident_id
         and w.organization_id = new.organization_id
         and w.deleted_at is null
         and (v_serviciu
              or (app.feature_on(new.organization_id, 'ssm')
                  and app.ssm_acces(new.organization_id, 'ssm', 'read', w.employee_id)))
    ) then
      raise exception using errcode = 'P0001',
        message = 'Cercetarea SSM aleasă nu există în organizația dumneavoastră sau nu o puteți consulta.';
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
-- 6b. Destinatarii unei chei a flotei și declarația șoferului (§F, §G)
-- ============================================================
-- Cine primește ce ține de o cheie care se citește doar la `all` (amenzile,
-- incidentele): responsabilii de flotă (`internal.flota_responsabili`, 0201)
-- care o citesc efectiv, cu precedența membru > organizație > global
-- (`internal.scope_membru`, 0189); dacă niciunul, administratorii activi care o
-- citesc. Șoferul NU e destinatar: ar primi o legătură spre un ecran închis.
create or replace function internal.flota_destinatari_cheie(p_org uuid, p_resursa text)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with responsabili as (
    select r.user_id
      from internal.flota_responsabili(p_org) r
     where internal.scope_membru(p_org, r.user_id, p_resursa, 'read') = 'all'
  )
  select x.user_id from responsabili x
  union
  select m.user_id
    from public.organization_members m
   where m.organization_id = p_org
     and m.role = 'org_admin'
     and m.status = 'active'
     and m.deleted_at is null
     and internal.scope_membru(p_org, m.user_id, p_resursa, 'read') = 'all'
     and not exists (select 1 from responsabili);
$$;

comment on function internal.flota_destinatari_cheie(uuid, text) is
  'Destinatarii unei chei de flotă citite la all (vehicle_fines, vehicle_incidents): responsabilii de flotă care o citesc efectiv, altfel administratorii activi care o citesc (0206). Niciodată șoferul.';

-- Declarația din portal ajunge la responsabil: o notificare per destinatar,
-- cu legătura spre fișa incidentului. Cine declară nu-și scrie notificare.
-- Incidentul înregistrat de administrator (fără declarant) nu notifică nimic.
create or replace function internal.incidente_notifica()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nr   text;
  v_nume text;
begin
  if new.declarat_de_employee_id is null or new.deleted_at is not null then
    return null;
  end if;
  select v.nr_inmatriculare into v_nr from public.vehicles v where v.id = new.vehicle_id;
  select coalesce(nullif(btrim(e.full_name), ''), e.marca) into v_nume
    from public.employees e where e.id = new.declarat_de_employee_id;

  insert into public.notifications (user_id, organization_id, kind, title, body, link, entity_type, entity_id)
  select d.user_id,
         new.organization_id,
         'warning'::public.notification_kind,
         left('Flota: incident declarat pe ' || coalesce(v_nr, 'un vehicul')
              || ' de ' || coalesce(v_nume, 'un șofer') || '.', 200),
         left(to_char(new.produs_la at time zone 'Europe/Bucharest', 'DD.MM.YYYY HH24:MI')
              || coalesce(' · ' || new.locul, '') || E'\n' || new.descriere, 4000),
         '/flota/incidente/' || new.id::text,
         'vehicle_incident',
         new.id
    from internal.flota_destinatari_cheie(new.organization_id, 'vehicle_incidents') d
   where d.user_id is distinct from auth.uid();
  return null;
end;
$$;

create trigger incidente_notifica
  after insert on public.vehicle_incidents
  for each row execute function internal.incidente_notifica();

-- ============================================================
-- 7. Termenul amenzii în lista de conformitate
-- ============================================================
-- Rescriere INTEGRALĂ de la forma ultimă (0204 §5), plus `vehicle_fine`. Fără
-- ramura nouă rândul ar fi căzut pe `else false`: invizibil oricui. Toate
-- ramurile existente se păstrează NESCHIMBATE, inclusiv `driver_license` (0204)
-- și `vehicle_service` (0203, ramura paralelă F7). O migrare viitoare care
-- adaugă un `entity_type` pornește de la ACEASTA.
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
  'Cine conducea vehiculul la un moment dat (0206): întâi linia de foaie (sursa „foaie”, foaia nerespinsă), apoi alocarea (sursa „alocare”). Doar sugestie. Zero rânduri pentru cine nu administrează amenzile / incidentele sau când nu se știe.';

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
  'Învelișul apelabil prin .rpc() al lui app.sofer_la (0206).';

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

-- §F: ramura `own` a citirii — șoferul își vede DOAR declarațiile lui (cât are
-- încă cheia de declarare), nu incidentele colegilor și nici pe cele
-- înregistrate de administrator pe mașina lui.
create policy vehicle_incidents_select on public.vehicle_incidents
for select to authenticated
using (
  (select app.is_platform_admin()) or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and (
      app.has_permission(organization_id, 'vehicle_incidents', 'read') = 'all'
      or (
        declarat_de_employee_id is not null
        and declarat_de_employee_id = app.fisa_mea(organization_id)
        and app.has_permission(organization_id, 'vehicle_incidents', 'create') <> 'none'
      )
    )
  )
);

-- §F: ramura `own` a scrierii. `declarat_de_employee_id` și `sofer_id` le pune
-- triggerul (WITH CHECK vede rândul de DUPĂ el); garda de vehicul (alocat în
-- ziua incidentului sau pool) e tot în trigger, cu mesaj. Declarantul nu scrie
-- costuri, asigurător, dosar sau cercetare: le completează responsabilul.
create policy vehicle_incidents_insert on public.vehicle_incidents
for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and stadiu = 'raportat'
  and inchis_la is null
  and deleted_at is null
  and (
    app.has_permission(organization_id, 'vehicle_incidents', 'create') = 'all'
    or (
      app.has_permission(organization_id, 'vehicle_incidents', 'create') in ('own', 'team')
      and declarat_de_employee_id is not null
      and declarat_de_employee_id = app.fisa_mea(organization_id)
      and sofer_id = declarat_de_employee_id
      and app.vehicul_al_meu_la(organization_id, vehicle_id, produs_la)
      and cost_estimat is null
      and cost_final is null
      and despagubire is null
      and asigurator is null
      and dosar_numar is null
      and work_accident_id is null
    )
  )
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
-- 9b. Termenul amenzii în rezumatul zilnic al flotei (§G)
-- ============================================================
-- Rescriere de la FORMA ULTIMĂ (0203 §11; grep: nicio altă migrare n-o mai
-- rescrie). Ce se schimbă, și doar atât:
--  · lista albă primește `vehicle_fine`; rândul din `expirables` poartă id-ul
--    AMENZII (`internal.amenzi_scadenta`), deci vehiculul vine prin amendă;
--  · destinatarii unei amenzi sunt `internal.flota_destinatari_cheie(org,
--    'vehicle_fines')`: responsabilii care citesc amenzile la `all`, altfel
--    administratorii. Șoferul alocat NU primește amenda (n-are cheia), iar
--    `flota_vede_vehicul` nu se aplică: cine citește amenzile le vede pe toate;
--  · titlul numără și termenele de răspuns; legătura duce la amendă (una) sau
--    la lista „De răspuns” (mai multe), când rezumatul are doar amenzi.
-- Fără amenzi, textul, legătura și destinatarii sunt cei din 0203. Dedup-ul
-- rămâne `alert_notifications` pe `canal = 'in_app'`: a doua rulare din aceeași
-- zi nu scrie nimic.
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
           v.employee_id   as sofer_id,
           v.pool          as pool,
           (a.status = 'expirat') as depasita,
           (x.entity_type = 'vehicle_service') as e_service,
           (x.entity_type = 'vehicle_fine')    as e_amenda,
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
      left join public.vehicle_fines f
        on x.entity_type = 'vehicle_fine'
       and f.id = x.entity_id
       and f.organization_id = p_org
       and f.deleted_at is null
      join public.vehicles v
        on v.id = case when x.entity_type = 'vehicle_fine' then f.vehicle_id else x.entity_id end
       and v.organization_id = p_org
       and v.deleted_at is null
     where a.organization_id = p_org
       and a.deleted_at is null
       and a.status in ('nou', 'expirat')
       and x.organization_id = p_org
       and x.deleted_at is null
       and x.is_active
       -- LISTA ALBĂ a flotei (0203: și scadențele de service pe dată; 0206: și
       -- termenul de răspuns al amenzii). SSM și HR se adaugă aici, cu legătura lor.
       and x.entity_type in ('vehicle_document', 'vehicle_service', 'vehicle_fine')
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
           n.user_id, n.expirable_id, n.vehicle_id, n.depasita, n.e_service, n.e_amenda,
           n.amenda_id, n.expires_at, n.eticheta, n.scope
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
           count(*) filter (where n.depasita and not n.e_service and not n.e_amenda)::integer     as depasite,
           count(*) filter (where not n.depasita and not n.e_service and not n.e_amenda)::integer as apropiate,
           count(*) filter (where n.depasita and n.e_service)::integer         as srv_depasite,
           count(*) filter (where not n.depasita and n.e_service)::integer     as srv_apropiate,
           count(*) filter (where n.e_service)::integer                        as srv_total,
           count(*) filter (where n.depasita and n.e_amenda)::integer          as am_depasite,
           count(*) filter (where not n.depasita and n.e_amenda)::integer      as am_apropiate,
           count(*) filter (where n.e_amenda)::integer                         as am_total,
           count(distinct n.vehicle_id)::integer               as vehicule,
           -- Filtrul „expiră” al listei e despre documente: data lor, fără amenzi.
           max(n.expires_at) filter (where not n.e_amenda)     as ultima_scadenta,
           (array_agg(n.vehicle_id order by n.rn))[1]          as primul_vehicul,
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
             when o.vehicule = 1 and o.srv_total = o.total then '/flota/' || o.primul_vehicul::text || '?fila=service'
             when o.vehicule = 1 then '/flota/' || o.primul_vehicul::text
             -- Filtrul „expiră” al listei arată 30 de zile
             -- (`PRAG_FLOTA_AVERTIZARE_ZILE`, src/domain/fleet/scadente.ts; îl
             -- fixează setari.test.ts). Cu un prag al firmei mai lung (60),
             -- vehiculele de peste 30 de zile ar lipsi din el: lista întreagă.
             -- Filtrul „expiră” al listei e despre documente: fără ele, lista întreagă.
             when o.total - o.srv_total - o.am_total > 0 and o.ultima_scadenta <= v_azi + 30 then '/flota?conformitate=expira'
             else '/flota'
           end,
           case when o.am_total = o.total and o.total = 1 then 'vehicle_fine'
                when o.vehicule = 1 then 'vehicle' else 'fleet_rezumat' end,
           case when o.am_total = o.total and o.total = 1 then o.prima_amenda
                when o.vehicule = 1 then o.primul_vehicul end
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
  'Rezumatul zilnic al scadențelor de flotă pe dată (vehicle_document, din 0203 vehicle_service, din 0206 termenul de răspuns al amenzii, vehicle_fine) pentru o firmă: o notificare per destinatar, doar cu elementele netrimise lui. Amenzile merg doar la cine le citește la all (responsabil sau org_admin), niciodată la șofer. Idempotentă: a doua rulare din aceeași zi nu scrie nimic.';

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
revoke all on function internal.incidente_notifica() from public, anon, authenticated;
revoke all on function internal.flota_destinatari_cheie(uuid, text) from public, anon, authenticated;
revoke all on function internal.flota_rezumat(uuid) from public, anon, authenticated;
-- Politica de INSERT pe incidente o cheamă sub rolul apelantului.
revoke all on function app.vehicul_al_meu_la(uuid, uuid, timestamptz) from public, anon;
grant execute on function app.vehicul_al_meu_la(uuid, uuid, timestamptz) to authenticated, service_role;
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
                             'vi_stadiu_idx', 'vi_vehicul_idx', 'vi_sofer_idx', 'vi_cercetare_idx',
                             'vi_declarant_idx'] loop
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
         and organization_id is null and member_id is null and deleted_at is null) <> 13 then
    v_lipsa := v_lipsa || 'seed-ul vehicle_fines / vehicle_incidents (13 rânduri)';
  end if;
  -- Singura excepție de la „doar administratorii”: declarația șoferului (§F).
  if exists (select 1 from public.role_permissions
              where resource in ('vehicle_fines', 'vehicle_incidents')
                and organization_id is null and member_id is null and deleted_at is null
                and role not in ('super_admin', 'org_admin')
                and not (role = 'employee' and resource = 'vehicle_incidents'
                         and action = 'create' and scope = 'own')) then
    v_lipsa := v_lipsa || 'seed-ul amenzilor acordat altui rol decât super_admin / org_admin (în afara declarației șoferului)';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'incidente_notifica'
                  and tgrelid = 'public.vehicle_incidents'::regclass) then
    v_lipsa := v_lipsa || 'notificarea declarației (incidente_notifica)';
  end if;
  if position('vehicle_fine' in pg_get_functiondef('internal.flota_rezumat(uuid)'::regprocedure)) = 0
     or position('vehicle_service' in pg_get_functiondef('internal.flota_rezumat(uuid)'::regprocedure)) = 0 then
    v_lipsa := v_lipsa || 'internal.flota_rezumat cu vehicle_document, vehicle_service și vehicle_fine';
  end if;

  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where (n.nspname, p.proname) in (('internal', 'amenzi_inainte'), ('internal', 'amenzi_scadenta'),
                                               ('internal', 'incidente_inainte'), ('internal', 'amenda_eticheta'),
                                               ('internal', 'incident_eticheta'), ('app', 'sofer_la'),
                                               ('public', 'sofer_sugerat'), ('internal', 'incidente_notifica'),
                                               ('internal', 'flota_destinatari_cheie'), ('internal', 'flota_rezumat'),
                                               ('app', 'vehicul_al_meu_la'))
                and (p.proconfig is null or not ('search_path=""' = any (p.proconfig)))) then
    v_lipsa := v_lipsa || 'search_path gol pe funcțiile 0206';
  end if;
  if position('is_platform_admin' in pg_get_functiondef('app.sofer_la(uuid,uuid,timestamptz)'::regprocedure)) = 0
     or position('vehicle_fines' in pg_get_functiondef('app.sofer_la(uuid,uuid,timestamptz)'::regprocedure)) = 0 then
    v_lipsa := v_lipsa || 'app.sofer_la își judecă singură apelantul';
  end if;
  if array_length(v_lipsa, 1) > 0 then
    raise exception '0206: lipsesc %', array_to_string(v_lipsa, ', ');
  end if;
end $$;

commit;
