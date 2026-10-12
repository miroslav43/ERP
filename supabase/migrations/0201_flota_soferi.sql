-- supabase/migrations/0201_flota_soferi.sql
--
-- FLOTA, FAZA F9: ȘOFERII — PERMISE DE CONDUCERE (HR), AVIZUL MEDICAL ȘI
-- LEGĂTURILE CU CONCEDIILE, CONTRACTUL ȘI DIURNA.
--
-- Planul o numea `0178_soferi`; între timp 0174–0200 s-au ocupat (alocări,
-- mentenanță, registru, asistent, salarizare, tichete, aprobatori, KPI, flota
-- F3–F8), deci e 0201.
--
-- ── DE UNDE VINE ────────────────────────────────────────────────────────────
-- Flota știa ce mașină are omul, nu și dacă omul are voie s-o conducă. Decizia
-- 3 a utilizatorului (7 oct): HR primește permisele și avizele șoferilor, NU
-- parcul și nici foile. Permisul expirat sau avizul lipsă AVERTIZEAZĂ, nu
-- blochează (implicitele planului) — la fel concediul, contractul încetat și
-- deplasarea fără delegație.
--
-- ── CE ADUCE ────────────────────────────────────────────────────────────────
-- A. Permisiunile `driver_licenses:read/create/update` (seed global, forma din
--    0120): `super_admin`, `org_admin` și `hr` = all; `manager` read = team;
--    `employee` read = own. Nicio cheie `delete`: ștergerea e logică, prin
--    `update` (ca peste tot), iar o cheie pe care n-o citește nicio politică ar
--    fi un rând decorativ.
-- B. `public.driver_licenses`: un permis ACTIV pe angajat (unic parțial), cu
--    număr, categorii (lista închisă din OUG 195/2002 art. 20, normalizată de
--    trigger), data eliberării, `expira_la` și `fisier_path` nullable (copia
--    scanată; încărcarea vine cu infrastructura de fișiere din F6). Reînnoirea
--    e un UPDATE pe același rând: istoricul îl ține auditul. Cheie străină
--    COMPUSĂ spre `employees (id, organization_id)` (0074): fișa altei firme
--    nu se poate referi nici cu un id fabricat.
-- C. Proiecția în `expirables` (`entity_type = 'driver_license'`, `kind =
--    'permis_conducere'`, responsabil = șoferul) prin `internal.sync_expirable`
--    (semnătura din 0008, neschimbată), și ramura nouă în
--    `app.poate_vedea_expirabil` (rescrisă INTEGRAL de la forma ultimă, 0011
--    §8 — verificat cu grep: 0008, 0010, 0011, nimic după). Rezumatul zilnic
--    al flotei (0198) rămâne pe `vehicle_document`: lista lui albă nu se
--    atinge aici.
-- D. `app.stare_aviz_sofer(org, angajat, zi)`, SECURITY DEFINER: `apt` /
--    `expirat` / `lipsa` din `occupational_health_exams` (0011) — EXACT doar
--    pentru cine ar fi putut citi rândul prin RLS (`app.ssm_acces(…, 'ssm',
--    'read', angajat)`, aceeași poartă ca politica examenelor) sau administrează
--    parcul (`vehicles:update = all`). Ceilalți, care văd doar foile șoferului,
--    primesc `de_verificat` când avizul nu e valabil: află că e o problemă, nu
--    dacă fișa lipsește sau a expirat. Rezultatul `inapt*` NU iese ca atare
--    nici pentru primii — e dată de sănătate (art. 9 GDPR), deci se spune
--    „lipsă”. Cu SSM oprit, `null` (firma nu ține fișele în aplicație, iar
--    „lipsă” ar fi zgomot).
--    [Reparat înainte de aplicare, după revizuirea de securitate: forma
--    inițială întorcea avizul exact oricui vedea foile, adică ocolea RLS-ul din
--    `occupational_health_exams`.]
-- E. `public.verificari_soferi(org, angajați[], zi)`, apelabilă prin `.rpc()`:
--    faptele pentru verificările încrucișate (absență aprobată în zi, contract
--    încetat, permis, aviz, delegație). Faptele, nu verdictul: cine decide ce
--    avertisment se arată e domeniul pur din `src/domain/fleet/soferi.ts`,
--    testat în vitest. Absența spune doar `absent` — nici tipul concediului,
--    nici certificatul: CM-ul e dată de sănătate (art. 9 GDPR) și nu poate fi
--    deosebit de un concediu de odihnă de cine vede doar foile. [Reparat
--    înainte de aplicare, din același motiv ca la D: forma inițială spunea
--    `medical` / `concediu` și ocolea RLS-ul din `leave_requests`.]
-- F. `trip_sheets.business_trip_id`: foaia de parcurs legată de deplasarea
--    (delegația) șoferului, cu gardă proprie (`internal.foi_deplasare_garda`):
--    aceeași firmă, același angajat, deplasare neanulată. Trigger SEPARAT, nu
--    o ramură în `internal.foi_parcurs_inainte`: corpul acela îl rescriu și
--    fazele paralele, iar comparațiile lui pe `to_jsonb(new) - …` acoperă
--    oricum coloana nouă (foaia trimisă sau aprobată nu-și schimbă legătura).
--    `business_trips.vehicle_id` exista din 0015, cu garda de firmă din 0159;
--    aplicația îl trimite de acum (`deplasareNouaSchema`).
--
-- ── CE NU FACE ──────────────────────────────────────────────────────────────
--  · Nu blochează nimic pe baza permisului, a avizului sau a concediului.
--  · Nu atinge `internal.foi_parcurs_inainte`, `internal.valideaza_deplasare`,
--    `internal.flota_rezumat`, `app.can_path`.
--  · Nu dă `hr` niciun drept pe vehicule sau pe foi.
--
-- Aplicare: psql byte-exact, după bancul local; producția cere confirmare.

begin;

-- ============================================================
-- 1. Permisiunile
-- ============================================================
-- Forma 3 din `permissions.test.ts` (`(null, 'rol', 'resursă', 'acțiune',
-- 'scope')`), cu cele CINCI coloane ale indexului din 0063.
insert into public.role_permissions (organization_id, role, resource, action, scope) values
  (null, 'super_admin', 'driver_licenses', 'read',   'all'),
  (null, 'super_admin', 'driver_licenses', 'create', 'all'),
  (null, 'super_admin', 'driver_licenses', 'update', 'all'),
  (null, 'org_admin',   'driver_licenses', 'read',   'all'),
  (null, 'org_admin',   'driver_licenses', 'create', 'all'),
  (null, 'org_admin',   'driver_licenses', 'update', 'all'),
  (null, 'hr',          'driver_licenses', 'read',   'all'),
  (null, 'hr',          'driver_licenses', 'create', 'all'),
  (null, 'hr',          'driver_licenses', 'update', 'all'),
  (null, 'manager',     'driver_licenses', 'read',   'team'),
  (null, 'employee',    'driver_licenses', 'read',   'own')
on conflict (organization_id, member_id, role, resource, action)
  where deleted_at is null do nothing;

-- ============================================================
-- 2. Categoriile de permis
-- ============================================================
-- OUG 195/2002 art. 20 alin. (1). Ordinea e cea din lege și e ordinea în care
-- se afișează. `Tr`, `Tb`, `Tv` se scriu cu literă mică a doua.
create or replace function internal.categorii_permis()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['AM','A1','A2','A','B1','B','BE','C1','C1E','C','CE','D1','D1E','D','DE','Tr','Tb','Tv']::text[];
$$;

-- ============================================================
-- 3. Tabela
-- ============================================================
create table public.driver_licenses (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_id     uuid not null,
  numar           text not null,
  categorii       text[] not null,
  eliberat_la     date,
  expira_la       date not null,
  -- Copia scanată, în bucket-ul de documente; încărcarea vine cu F6.
  fisier_path     text,
  observatii      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null,
  updated_by      uuid references auth.users (id) on delete set null,
  deleted_at      timestamptz,
  constraint driver_licenses_angajat_fk foreign key (employee_id, organization_id)
    references public.employees (id, organization_id) on delete restrict,
  constraint driver_licenses_numar_ck check (length(numar) between 3 and 30),
  -- Lista scrisă aici, nu `internal.categorii_permis()`: un CHECK cheamă
  -- funcția cu drepturile celui care scrie, iar `authenticated` n-are EXECUTE
  -- pe `internal`. Blocul de verificare de la final o compară cu funcția.
  constraint driver_licenses_categorii_ck check (
    cardinality(categorii) between 1 and 18
    and categorii <@ array['AM','A1','A2','A','B1','B','BE','C1','C1E','C','CE','D1','D1E','D','DE','Tr','Tb','Tv']::text[]
  ),
  constraint driver_licenses_interval_ck check (eliberat_la is null or expira_la >= eliberat_la),
  constraint driver_licenses_fisier_ck check (
    fisier_path is null or (length(fisier_path) between 1 and 500 and position('..' in fisier_path) = 0)
  ),
  constraint driver_licenses_observatii_ck check (observatii is null or length(observatii) <= 1000)
);

-- Un singur permis ACTIV pe angajat: reînnoirea rescrie rândul, ștergerea logică
-- eliberează locul pentru unul nou.
create unique index driver_licenses_angajat_uq
  on public.driver_licenses (organization_id, employee_id)
  where deleted_at is null;

create index driver_licenses_expira_idx
  on public.driver_licenses (organization_id, expira_la)
  where deleted_at is null;

comment on table public.driver_licenses is
  'Permisele de conducere ale angajaților (0201). Unul activ pe angajat; reînnoirea e UPDATE, istoricul e în audit. Scadența se proiectează în expirables (driver_license).';
comment on column public.driver_licenses.categorii is
  'Categoriile din OUG 195/2002 art. 20, normalizate și ordonate de trigger (internal.categorii_permis).';

-- ============================================================
-- 4. Triggerele permisului
-- ============================================================
-- Integritate, nu drepturi (drepturile le judecă politica). Contextul de
-- serviciu (importuri, seed) poate muta un permis; utilizatorul, nu.
create or replace function internal.permise_inainte()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lista text[] := internal.categorii_permis();
  v_cat   text;
  v_gasit text;
  v_norm  text[] := '{}';
begin
  if tg_op = 'UPDATE' and not app.is_service_context() then
    if old.deleted_at is not null then
      raise exception using errcode = 'P0001',
        message = 'Permisul a fost șters și nu se mai modifică. Înregistrați unul nou pe fișa angajatului.';
    end if;
    if new.organization_id is distinct from old.organization_id
       or new.employee_id is distinct from old.employee_id then
      raise exception using errcode = 'P0001',
        message = 'Permisul nu se mută pe alt angajat. Ștergeți-l și înregistrați-l pe fișa corectă.';
    end if;
  end if;

  new.numar := upper(regexp_replace(coalesce(new.numar, ''), '\s+', '', 'g'));
  if length(new.numar) < 3 then
    raise exception using errcode = 'P0001',
      message = 'Numărul permisului are cel puțin 3 caractere.';
  end if;

  if new.categorii is null or cardinality(new.categorii) = 0 then
    raise exception using errcode = 'P0001',
      message = 'Alegeți cel puțin o categorie de permis.';
  end if;
  foreach v_cat in array new.categorii loop
    v_gasit := null;
    select c into v_gasit from unnest(v_lista) c where upper(c) = upper(btrim(v_cat)) limit 1;
    if v_gasit is null then
      raise exception using errcode = 'P0001',
        message = format('Categoria „%s” nu există pe permisul de conducere românesc.', btrim(v_cat));
    end if;
    v_norm := v_norm || v_gasit;
  end loop;
  -- Fără dubluri, în ordinea din lege.
  select array_agg(c order by array_position(v_lista, c))
    into new.categorii
    from (select distinct c from unnest(v_norm) c) d;

  if new.eliberat_la is not null and new.eliberat_la > app.azi_local() then
    raise exception using errcode = 'P0001',
      message = 'Data eliberării permisului nu poate fi în viitor.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- Proiecția în expirables. AFTER, ca să vadă rândul final (normalizat).
create or replace function internal.permise_scadenta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nume  text;
  v_activ boolean;
begin
  select coalesce(e.full_name, e.marca), e.status not in ('incetat', 'arhivat')
    into v_nume, v_activ
    from public.employees e
   where e.id = new.employee_id and e.organization_id = new.organization_id;

  perform internal.sync_expirable(
    new.organization_id,
    'driver_license',
    new.id,
    'permis_conducere',
    left('Permis de conducere — ' || coalesce(v_nume, 'angajat'), 200),
    case when new.deleted_at is null then new.expira_la end,
    'driver_licenses',
    new.employee_id,
    coalesce(v_activ, true)
  );
  return null;
end;
$$;

create trigger permise_inainte
  before insert or update on public.driver_licenses
  for each row execute function internal.permise_inainte();

create trigger permise_scadenta
  after insert or update on public.driver_licenses
  for each row execute function internal.permise_scadenta();

-- ============================================================
-- 5. Scadența permisului în lista de conformitate
-- ============================================================
-- Rescriere INTEGRALĂ de la forma ultimă (0011 §8), plus `driver_license`.
-- Fără ramura nouă, rândul ar fi căzut pe `else false`: invizibil oricui.
create or replace function app.poate_vedea_expirabil(p_organization_id uuid, p_entity_type text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case p_entity_type
    when 'medical_exam'             then app.feature_on(p_organization_id,'ssm')        and app.can(p_organization_id,'ssm','read','team')
    when 'employee_document'        then app.can(p_organization_id,'employees','read','team')
    when 'work_permit'              then app.can(p_organization_id,'employees','read','team')
    when 'employment_contract'      then app.can(p_organization_id,'employees','read','team')
    when 'vehicle_document'         then app.feature_on(p_organization_id,'fleet')       and app.can(p_organization_id,'vehicles','read','team')
    when 'equipment'                then app.feature_on(p_organization_id,'maintenance') and app.can(p_organization_id,'maintenance','read','team')
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
    else false
  end
$$;

-- ============================================================
-- 6. Cine poate afla starea unui șofer
-- ============================================================
-- Cel în cauză; cine îi vede foile (aprobatorul, managerul); cine îi vede
-- permisul (hr); cine administrează parcul (alocarea). Restul primește nimic.
create or replace function internal.poate_vedea_sofer(p_org uuid, p_employee uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_org is not null and p_employee is not null and (
    p_employee = app.current_employee_id(p_org)
    or app.poate_vedea_foaie(p_org, p_employee)
    or app.ssm_acces(p_org, 'driver_licenses', 'read', p_employee)
    or app.can(p_org, 'vehicles', 'update', 'all')
  );
$$;

-- ============================================================
-- 7. Avizul medical al șoferului
-- ============================================================
create or replace function app.stare_aviz_sofer(p_org uuid, p_employee uuid, p_zi date default null)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_zi    date := coalesce(p_zi, app.azi_local());
  v_rez   public.ssm_exam_result;
  v_val   date;
  v_stare text;
begin
  if p_org is null or p_employee is null then
    return null;
  end if;
  if not ((select app.is_platform_admin())
          or (p_org = any ((select app.current_org_ids())::uuid[])
              and internal.poate_vedea_sofer(p_org, p_employee))) then
    return null;
  end if;
  if not app.feature_on(p_org, 'ssm') then
    return null;
  end if;

  select x.rezultat, x.valabil_pana
    into v_rez, v_val
    from public.occupational_health_exams x
   where x.organization_id = p_org
     and x.employee_id = p_employee
     and x.deleted_at is null
     and x.data_examinarii <= v_zi
   order by x.data_examinarii desc, x.created_at desc
   limit 1;

  if not found then
    v_stare := 'lipsa';
  elsif v_rez not in ('apt', 'apt_conditionat') then
    -- `inapt` și `inapt_temporar` nu ies ca atare nici pentru cine are acces
    -- SSM (art. 9 GDPR): pentru flotă contează doar că NU există o aptitudine
    -- valabilă.
    v_stare := 'lipsa';
  elsif v_val is not null and v_val < v_zi then
    v_stare := 'expirat';
  else
    v_stare := 'apt';
  end if;

  if v_stare = 'apt' then
    return 'apt';
  end if;

  -- Funcția e SECURITY DEFINER, deci judecă SINGURĂ cine are voie să afle de ce
  -- avizul nu e valabil. Exact (lipsa / expirat) primește doar cine ar fi putut
  -- citi rândul din `occupational_health_exams` prin RLS (aceeași poartă:
  -- `app.ssm_acces(…, 'ssm', 'read', angajat)`, cu modulul SSM pornit, verificat
  -- mai sus), sau cine administrează parcul (`vehicles:update = all`). Restul
  -- — de pildă un rol care vede foile șoferului, dar nu și medicina muncii —
  -- află DOAR că avizul trebuie verificat, fără să deosebească „lipsă” de
  -- „expirat”. Fără ramura asta, funcția ar fi ocolit RLS-ul examenelor.
  if (select app.is_platform_admin())
     or app.ssm_acces(p_org, 'ssm', 'read', p_employee)
     or app.can(p_org, 'vehicles', 'update', 'all') then
    return v_stare;
  end if;
  return 'de_verificat';
end;
$$;

comment on function app.stare_aviz_sofer(uuid, uuid, date) is
  'Avizul medical al șoferului în ziua dată. apt: valabil. lipsa / expirat: DOAR pentru cine are acces SSM pe fișa lui (app.ssm_acces, ca RLS-ul din occupational_health_exams) sau vehicles:update = all; inapt* iese „lipsa”. de_verificat: semnal generic pentru ceilalți (nu deosebește lipsa de expirat). null = apelantul nu poate afla, sau SSM e oprit.';

-- ============================================================
-- 8. Faptele verificărilor încrucișate
-- ============================================================
-- Un rând per angajat VIZIBIL (ceilalți lipsesc, fără eroare). Plafon de 500
-- de id-uri: selectorul de predare citește toți angajații activi deodată.
create or replace function public.verificari_soferi(
  p_organization_id uuid,
  p_employee_ids uuid[],
  p_zi date
)
returns table (
  employee_id      uuid,
  concediu         text,
  contract_incetat boolean,
  permis_exista    boolean,
  permis_expira_la date,
  permis_categorii text[],
  aviz             text,
  delegatie        boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.id,
    -- GDPR art. 9: tipul concediului (în special CM-ul) NU iese. Funcția e
    -- SECURITY DEFINER și o văd toți cei care văd foile șoferului, deci orice
    -- deosebire „medical” / „concediu” ar fi ocolit RLS-ul din `leave_requests`.
    -- Foaia are nevoie doar de „nu e disponibil în ziua asta”.
    (select 'absent'::text
       from public.leave_requests lr
      where lr.organization_id = p_organization_id
        and lr.employee_id = e.id
        and lr.deleted_at is null
        and lr.status = 'aprobata'
        and p_zi between lr.data_inceput and lr.data_sfarsit
      limit 1),
    case when e.terminated_on is not null then e.terminated_on < p_zi
         else e.status in ('incetat', 'arhivat') end,
    dl.id is not null,
    dl.expira_la,
    coalesce(dl.categorii, '{}'::text[]),
    app.stare_aviz_sofer(p_organization_id, e.id, p_zi),
    case when app.feature_on(p_organization_id, 'per_diem') then exists (
      select 1 from public.business_trips d
       where d.organization_id = p_organization_id
         and d.employee_id = e.id
         and d.deleted_at is null
         and d.status in ('in_aprobare', 'aprobata', 'incheiata', 'decontata')
         and p_zi between
               (least(d.plecare_la, coalesce(d.plecare_efectiva_la, d.plecare_la)) at time zone 'Europe/Bucharest')::date
           and (greatest(d.sosire_la, coalesce(d.sosire_efectiva_la, d.sosire_la)) at time zone 'Europe/Bucharest')::date
    ) end
  from public.employees e
  left join public.driver_licenses dl
    on dl.organization_id = e.organization_id
   and dl.employee_id = e.id
   and dl.deleted_at is null
  where p_organization_id is not null
    and p_zi is not null
    and coalesce(cardinality(p_employee_ids), 0) between 1 and 500
    and ((select app.is_platform_admin())
         or p_organization_id = any ((select app.current_org_ids())::uuid[]))
    and app.feature_on(p_organization_id, 'fleet')
    and e.organization_id = p_organization_id
    and e.deleted_at is null
    and e.id = any (p_employee_ids)
    and ((select app.is_platform_admin()) or internal.poate_vedea_sofer(p_organization_id, e.id));
$$;

comment on function public.verificari_soferi(uuid, uuid[], date) is
  'Faptele pentru avertismentele de șofer (0201): absență aprobată în zi (doar „absent”, fără tipul concediului: art. 9 GDPR), contract încetat, permis, aviz (app.stare_aviz_sofer: exact doar cu acces SSM, altfel „de_verificat”), delegație. Avertizează, nu blochează; verdictul îl dă src/domain/fleet/soferi.ts.';

-- ============================================================
-- 9. Foaia de parcurs legată de deplasare
-- ============================================================
alter table public.trip_sheets
  add column business_trip_id uuid references public.business_trips (id) on delete set null;

create index trip_sheets_deplasare_idx
  on public.trip_sheets (organization_id, business_trip_id)
  where business_trip_id is not null and deleted_at is null;

comment on column public.trip_sheets.business_trip_id is
  'Deplasarea (delegația) șoferului pe care o justifică foaia (0201). Aceeași firmă și același angajat, garda foi_deplasare_garda.';

create or replace function internal.foi_deplasare_garda()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d public.business_trips%rowtype;
begin
  if new.business_trip_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.business_trip_id is not distinct from old.business_trip_id
     and new.employee_id is not distinct from old.employee_id
     and new.organization_id is not distinct from old.organization_id then
    return new;
  end if;

  select * into v_d from public.business_trips d where d.id = new.business_trip_id;
  if not found or v_d.organization_id <> new.organization_id or v_d.deleted_at is not null then
    raise exception using errcode = 'P0001',
      message = 'Deplasarea aleasă nu aparține organizației dumneavoastră.';
  end if;
  if v_d.employee_id <> new.employee_id then
    raise exception using errcode = 'P0001',
      message = 'Deplasarea aleasă este a altui angajat. Foaia se leagă doar de o deplasare a șoferului ei.';
  end if;
  if v_d.status = 'anulata' then
    raise exception using errcode = 'P0001',
      message = 'Deplasarea aleasă a fost anulată și nu mai justifică foaia.';
  end if;
  return new;
end;
$$;

-- Numele sortează înaintea lui `foi_parcurs_inainte`; ordinea nu contează
-- (garda nu citește nimic din ce scrie celălalt), dar e stabilă.
create trigger foi_deplasare_garda
  before insert or update of business_trip_id, employee_id, organization_id on public.trip_sheets
  for each row execute function internal.foi_deplasare_garda();

-- ============================================================
-- 10. RLS pe permise
-- ============================================================
-- `app.ssm_acces` (0011) e accesul uniform pe angajat: all = firma, team =
-- echipa (și propria fișă), own = propria fișă. Fără `deleted_at` în USING-ul
-- de SELECT (0016): ștergerea logică cu RETURNING ar cădea pe propria politică.
alter table public.driver_licenses enable row level security;
alter table public.driver_licenses force row level security;

create policy driver_licenses_select on public.driver_licenses
for select to authenticated
using (
  (select app.is_platform_admin()) or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.ssm_acces(organization_id, 'driver_licenses', 'read', employee_id)
  )
);

create policy driver_licenses_insert on public.driver_licenses
for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.ssm_acces(organization_id, 'driver_licenses', 'create', employee_id)
  and deleted_at is null
);

create policy driver_licenses_update on public.driver_licenses
for update to authenticated
using (
  deleted_at is null
  and organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.ssm_acces(organization_id, 'driver_licenses', 'update', employee_id)
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.ssm_acces(organization_id, 'driver_licenses', 'update', employee_id)
);

-- ============================================================
-- 11. Actor, audit, drepturi
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['driver_licenses'] loop
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

revoke all on function internal.categorii_permis() from public, anon, authenticated;
revoke all on function internal.permise_inainte() from public, anon, authenticated;
revoke all on function internal.permise_scadenta() from public, anon, authenticated;
revoke all on function internal.foi_deplasare_garda() from public, anon, authenticated;
revoke all on function internal.poate_vedea_sofer(uuid, uuid) from public, anon, authenticated;
revoke all on function app.poate_vedea_expirabil(uuid, text) from public, anon;
grant execute on function app.poate_vedea_expirabil(uuid, text) to authenticated;
revoke all on function app.stare_aviz_sofer(uuid, uuid, date) from public, anon;
grant execute on function app.stare_aviz_sofer(uuid, uuid, date) to authenticated, service_role;
revoke all on function public.verificari_soferi(uuid, uuid[], date) from public, anon;
grant execute on function public.verificari_soferi(uuid, uuid[], date) to authenticated, service_role;

-- ============================================================
-- 12. Verificare
-- ============================================================
do $$
declare
  v_lipsa text[] := '{}';
begin
  if to_regclass('public.driver_licenses') is null then
    v_lipsa := v_lipsa || 'driver_licenses';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'driver_licenses_angajat_uq'
                  and indexdef ilike '%where (deleted_at is null)%') then
    v_lipsa := v_lipsa || 'driver_licenses_angajat_uq (parțial)';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'driver_licenses_expira_idx'
                  and indexdef ilike '%where (deleted_at is null)%') then
    v_lipsa := v_lipsa || 'driver_licenses_expira_idx (parțial)';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'driver_licenses') <> 3 then
    v_lipsa := v_lipsa || 'trio-ul de politici pe driver_licenses';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'driver_licenses'
              and cmd = 'DELETE') then
    v_lipsa := v_lipsa || 'politică DELETE pe driver_licenses (interzisă)';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'driver_licenses'
                  and cmd = 'UPDATE' and qual is not null and with_check is not null) then
    v_lipsa := v_lipsa || 'USING + WITH CHECK pe driver_licenses_update';
  end if;
  if not (select relforcerowsecurity from pg_class where oid = 'public.driver_licenses'::regclass) then
    v_lipsa := v_lipsa || 'FORCE RLS pe driver_licenses';
  end if;
  if has_table_privilege('authenticated', 'public.driver_licenses', 'DELETE') then
    v_lipsa := v_lipsa || 'DELETE acordat pe driver_licenses';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'audit_driver_licenses'
                  and tgrelid = 'public.driver_licenses'::regclass) then
    v_lipsa := v_lipsa || 'auditul pe driver_licenses';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'foi_deplasare_garda'
                  and tgrelid = 'public.trip_sheets'::regclass) then
    v_lipsa := v_lipsa || 'triggerul foi_deplasare_garda';
  end if;
  if position('driver_license' in pg_get_functiondef('app.poate_vedea_expirabil(uuid,text)'::regprocedure)) = 0
     or position('ppe_issuance' in pg_get_functiondef('app.poate_vedea_expirabil(uuid,text)'::regprocedure)) = 0 then
    v_lipsa := v_lipsa || 'app.poate_vedea_expirabil cu toate ramurile';
  end if;
  -- GDPR art. 9: avizul exact doar cu acces SSM, tipul concediului deloc.
  if position('ssm_acces' in pg_get_functiondef('app.stare_aviz_sofer(uuid,uuid,date)'::regprocedure)) = 0
     or position('de_verificat' in pg_get_functiondef('app.stare_aviz_sofer(uuid,uuid,date)'::regprocedure)) = 0 then
    v_lipsa := v_lipsa || 'app.stare_aviz_sofer: avizul exact doar cu acces SSM, restul de_verificat';
  end if;
  if position('leave_types' in pg_get_functiondef('public.verificari_soferi(uuid,uuid[],date)'::regprocedure)) > 0
     or position('tip_zi_pontaj' in pg_get_functiondef('public.verificari_soferi(uuid,uuid[],date)'::regprocedure)) > 0 then
    v_lipsa := v_lipsa || 'public.verificari_soferi nu are voie să deosebească CM-ul de concediu';
  end if;
  if (select count(*) from public.role_permissions
       where resource = 'driver_licenses' and organization_id is null and member_id is null
         and deleted_at is null) <> 11 then
    v_lipsa := v_lipsa || 'seed-ul driver_licenses (11 rânduri)';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where (n.nspname, p.proname) in (('internal', 'permise_inainte'), ('internal', 'permise_scadenta'),
                                               ('internal', 'foi_deplasare_garda'), ('internal', 'poate_vedea_sofer'),
                                               ('app', 'stare_aviz_sofer'), ('public', 'verificari_soferi'),
                                               ('internal', 'categorii_permis'))
                and (p.proconfig is null or not ('search_path=""' = any (p.proconfig)))) then
    v_lipsa := v_lipsa || 'search_path gol pe funcțiile 0201';
  end if;
  if exists (
    select 1
      from unnest(internal.categorii_permis()) k,
           lateral (select pg_get_constraintdef(c.oid) as def
                      from pg_constraint c
                     where c.conname = 'driver_licenses_categorii_ck'
                       and c.conrelid = 'public.driver_licenses'::regclass) d
     where position(quote_literal(k) || '::text' in d.def) = 0
  ) or cardinality(internal.categorii_permis()) <> 18 then
    v_lipsa := v_lipsa || 'lista din driver_licenses_categorii_ck = internal.categorii_permis()';
  end if;
  if array_length(v_lipsa, 1) > 0 then
    raise exception '0201: lipsesc %', array_to_string(v_lipsa, ', ');
  end if;
end $$;

commit;
