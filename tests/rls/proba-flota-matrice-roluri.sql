-- tests/rls/proba-flota-matrice-roluri.sql
--
-- FLOTA: MATRICEA ROL × TABELĂ, CU RÂNDURI NUMĂRATE (A4, după 0199–0206).
--
-- ── DE CE EXISTĂ ────────────────────────────────────────────────────────────
-- 0199 (F3) a dat `employee` `vehicles:read = own` și `trip_sheets`
-- read/create/update = own, iar `manager` `vehicles:read = team` și
-- `trip_sheets` create/update = own. Orice politică sau funcție SECURITY
-- DEFINER scrisă când doar `org_admin` ajungea la flotă putea deveni, tăcut,
-- prea largă: o ramură `poate_vedea_vehicul` care la `all` era „tot” e, la
-- `own`, „mașina mea + pool”, iar la `team` „echipa + pool”. Proba nu deduce
-- nimic din politici: rulează SELECT-ul sub fiecare identitate și numără.
--
-- ── FIRMA ───────────────────────────────────────────────────────────────────
-- Două firme identice, A și B (`pg_temp.firma`). În fiecare:
--   org_admin; hr (Horia); manager M (Mihai); E1 (Elena, fără șef); E2 (Emil,
--   subordonatul lui M).
--   V1 — a fost a lui E2 (alocare închisă acum 15 zile), acum a lui E1;
--   V2 — a lui E2;  VP — pool;  VL — fără șofer, non-pool.
--   Foi: f1 (E1 pe V1, ieri), f2 (E2 pe V2, ieri), f2v (E2 pe V1, acum 20 de
--   zile, când mașina era a lui), fp (E2 pe pool, alaltăieri); câte o cursă.
--   Alimentări pe f1, f2, fp. Anomalii pe fiecare foaie + una fără foaie pe V1.
--   Documente RCA pe toate patru, plan de service / intervenție / cheltuială pe
--   V1, V2, VP, permis pentru E1, E2, M, regim fiscal pe V1 și V2, normă pe V2,
--   amendă și incident pe V2, setări, un șablon de traseu, o setare de tip de
--   document, fișiere în `org-flota` pentru cele patru vehicule și trei foi.
--
-- ── MATRICEA INTENȚIONATĂ ───────────────────────────────────────────────────
-- Deciziile din planul „Flotă completă” (7 oct) și a lui Miro din 21 oct:
--   hr       — doar permisele (decizia 3): nimic din parc, foi sau costuri;
--   manager  — echipa (el + E2) și pool-ul pentru parc și documente; costurile
--              și service-ul DOAR pe mașinile echipei, nu și pe pool (doar
--              citire); anomaliile de pe foile echipei;
--   employee — mașina lui + pool, foile lui, anomaliile de pe foile lui (nu
--              anomalia colegului de pe mașina primită de la el), fără costuri.
-- Nomenclatoarele firmei (șabloanele de traseu, setarea tipurilor de document)
-- le vede oricine întocmește foi sau vede parcul: sunt aceleași pentru toți.
-- `avantaj_natura_flota` e a salarizării (`payroll:read = all`), deci hr o
-- primește: e calculul de la art. 76 din Codul fiscal, pe fișa salarială.
--
-- Fiecare celulă se compară cu valoarea intenționată; orice abatere pică
-- proba. Pentru firma B, toate rolurile firmei A trebuie să numere ZERO.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

begin;

create function pg_temp.la(zi date, ora text) returns timestamptz
language sql immutable as $$ select (zi::timestamp + ora::interval) at time zone 'Europe/Bucharest' $$;

-- Înlocuiește `{cheie}` cu valoarea din obiect, citată.
create function pg_temp.sub(p_sql text, p_ids jsonb) returns text
language plpgsql immutable as $f$
declare
  v_sql text := p_sql;
  v_k   record;
begin
  for v_k in select key, value from jsonb_each_text(p_ids) loop
    v_sql := replace(v_sql, '{' || v_k.key || '}', quote_literal(v_k.value));
  end loop;
  return v_sql;
end
$f$;

-- Rândurile unei interogări, sub identitatea dată. -1 = eroare (afișată).
create function pg_temp.numara(p_user uuid, p_sql text) returns bigint
language plpgsql as $f$
declare
  v_n bigint;
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  set local role authenticated;
  begin
    execute 'select count(*) from (' || p_sql || ') q' into v_n;
    reset role;
    return v_n;
  exception when others then
    reset role;
    raise warning '  ! % → %: %', left(p_sql, 90), sqlstate, sqlerrm;
    return -1;
  end;
end
$f$;

-- O scriere sub identitatea dată, derulată ÎNAPOI și când reușește (excepția
-- PX001 anulează sub-tranzacția): proba nu lasă rânduri care să schimbe
-- numărătorile. Întoarce `ok:<rânduri>` sau SQLSTATE-ul.
create function pg_temp.incearca(p_user uuid, p_sql text) returns text
language plpgsql as $f$
declare
  v_n bigint;
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  set local role authenticated;
  begin
    execute p_sql;
    get diagnostics v_n = row_count;
    raise exception using errcode = 'PX001', message = 'ok:' || v_n::text;
  exception when others then
    reset role;
    if sqlstate = 'PX001' then
      return sqlerrm;
    end if;
    return sqlstate || ' ' || left(sqlerrm, 70);
  end;
end
$f$;

-- O firmă cu flotă, în contextul de serviciu. Întoarce identificatorii.
create function pg_temp.firma(p_eticheta text) returns jsonb
language plpgsql as $f$
declare
  s       text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_zi    date := app.azi_local();
  v_org   uuid := gen_random_uuid();
  u_adm   uuid := gen_random_uuid();
  u_hr    uuid := gen_random_uuid();
  u_mgr   uuid := gen_random_uuid();
  u_e1    uuid := gen_random_uuid();
  u_e2    uuid := gen_random_uuid();
  e_hr    uuid := gen_random_uuid();
  e_mgr   uuid := gen_random_uuid();
  e_e1    uuid := gen_random_uuid();
  e_e2    uuid := gen_random_uuid();
  v1      uuid := gen_random_uuid();
  v2      uuid := gen_random_uuid();
  vp      uuid := gen_random_uuid();
  vl      uuid := gen_random_uuid();
  f1      uuid := gen_random_uuid();
  f2      uuid := gen_random_uuid();
  f2v     uuid := gen_random_uuid();
  fp      uuid := gen_random_uuid();
  v_rca   uuid;
  v_casco uuid;
  d2      uuid;
  v_nr    text := (100 + (random() * 800)::int)::text;
begin
  select id into v_rca from public.vehicle_document_types where organization_id is null and cod = 'rca';
  select id into v_casco from public.vehicle_document_types where organization_id is null and cod = 'casco';

  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-matrice-' || lower(p_eticheta) || '-' || s, 'Proba Matrice Flotă ' || p_eticheta || ' SRL',
     'RO' || (84000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select v_org, f.feature_key, true, now() from public.features f;

  insert into auth.users (id, email, email_confirmed_at) values
    (u_adm, 'mat-adm-' || s || '@proba.test', now()),
    (u_hr,  'mat-hr-'  || s || '@proba.test', now()),
    (u_mgr, 'mat-mgr-' || s || '@proba.test', now()),
    (u_e1,  'mat-e1-'  || s || '@proba.test', now()),
    (u_e2,  'mat-e2-'  || s || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, u_adm, 'org_admin'),
    (v_org, u_hr,  'hr'),
    (v_org, u_mgr, 'manager'),
    (v_org, u_e1,  'employee'),
    (v_org, u_e2,  'employee');

  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (e_mgr, v_org, 'MT-M', 'Mihai', 'Manager',  v_zi - 500, 'activ', u_mgr, null),
    (e_hr,  v_org, 'MT-H', 'Horia', 'Personal', v_zi - 500, 'activ', u_hr,  null),
    (e_e1,  v_org, 'MT-1', 'Elena', 'Șofer',    v_zi - 400, 'activ', u_e1,  null);
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (e_e2,  v_org, 'MT-2', 'Emil',  'Șofer',    v_zi - 400, 'activ', u_e2,  e_mgr);

  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent, pool,
                               valoare_achizitie, created_by, updated_by) values
    (v1, v_org, 'B' || v_nr || 'MTA', 'Dacia', 'Logan',   10000, false, 60000, u_adm, u_adm),
    (v2, v_org, 'B' || v_nr || 'MTB', 'Dacia', 'Duster',  20000, false, 90000, u_adm, u_adm),
    (vp, v_org, 'B' || v_nr || 'MTP', 'Dacia', 'Jogger',  30000, true,  80000, u_adm, u_adm),
    (vl, v_org, 'B' || v_nr || 'MTL', 'Ford',  'Transit', 40000, false, 120000, u_adm, u_adm);

  -- V1 a fost a lui E2; alocarea lui E1 o închide pe a lui (trigger, 0173).
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, created_by, updated_by)
  values (v_org, v1, e_e2, now() - interval '30 days', u_adm, u_adm);
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, folosinta_personala,
                                          created_by, updated_by)
  values (v_org, v1, e_e1, now() - interval '15 days', true, u_adm, u_adm);
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, created_by, updated_by)
  values (v_org, v2, e_e2, now() - interval '10 days', u_adm, u_adm);

  -- Foile, câte una pe vehicul și zi, cu cursa lor.
  insert into public.trip_sheets (id, organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                  created_by, updated_by) values
    (f2v, v_org, v1, e_e2, pg_temp.la(v_zi - 20, '08:00'), 10000, u_e2, u_e2),
    (f1,  v_org, v1, e_e1, pg_temp.la(v_zi - 1,  '08:00'), 10100, u_e1, u_e1),
    (f2,  v_org, v2, e_e2, pg_temp.la(v_zi - 1,  '08:00'), 20000, u_e2, u_e2),
    (fp,  v_org, vp, e_e2, pg_temp.la(v_zi - 2,  '08:00'), 30000, u_e2, u_e2);
  insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la,
                                       de_la_loc, pana_la_loc, scop, km_plecare, km_sosire,
                                       created_by, updated_by) values
    (v_org, f2v, pg_temp.la(v_zi - 20, '08:00'), pg_temp.la(v_zi - 20, '10:00'), 'Sediu', 'Client', 'Livrare', 10000, 10050, u_e2, u_e2),
    (v_org, f1,  pg_temp.la(v_zi - 1,  '08:00'), pg_temp.la(v_zi - 1,  '10:00'), 'Sediu', 'Client', 'Livrare', 10100, 10150, u_e1, u_e1),
    (v_org, f2,  pg_temp.la(v_zi - 1,  '08:00'), pg_temp.la(v_zi - 1,  '10:00'), 'Sediu', 'Client', 'Livrare', 20000, 20050, u_e2, u_e2),
    (v_org, fp,  pg_temp.la(v_zi - 2,  '08:00'), pg_temp.la(v_zi - 2,  '10:00'), 'Sediu', 'Client', 'Livrare', 30000, 30050, u_e2, u_e2);
  insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la,
                                   created_by, updated_by) values
    (v_org, f1, 30, 210, pg_temp.la(v_zi - 1, '09:00'), u_e1, u_e1),
    (v_org, f2, 30, 210, pg_temp.la(v_zi - 1, '09:00'), u_e2, u_e2),
    (v_org, fp, 20, 140, pg_temp.la(v_zi - 2, '09:00'), u_e2, u_e2);

  insert into public.odometer_anomalies (organization_id, vehicle_id, trip_sheet_id, km_asteptat, km_declarat, tip, explicatie) values
    (v_org, v1, f1,   8000, 10100, 'salt', 'Proba: foaia lui E1.'),
    (v_org, v1, f2v,  7000, 10000, 'salt', 'Proba: foaia veche a lui E2, pe mașina de azi a lui E1.'),
    (v_org, v2, f2,  17000, 20000, 'salt', 'Proba: foaia lui E2.'),
    (v_org, vp, fp,  27000, 30000, 'salt', 'Proba: foaia lui E2 pe pool.'),
    (v_org, v1, null, 6000,  9000, 'salt', 'Proba: anomalie fără foaie, pe V1.');

  insert into public.vehicle_documents (organization_id, vehicle_id, document_type_id, numar,
                                        valabil_de_la, expira_la, cost, created_by, updated_by)
  select v_org, x.v, v_rca, 'RCA-' || s || '-' || x.n, v_zi - 355, v_zi + 10, 1200, u_adm, u_adm
    from (values (v1, 1), (v2, 2), (vp, 3), (vl, 4)) as x(v, n);
  select id into d2 from public.vehicle_documents where organization_id = v_org and vehicle_id = v2;

  insert into public.vehicle_document_type_setari (organization_id, document_type_id, activ, obligatoriu,
                                                   created_by, updated_by)
  values (v_org, v_casco, true, true, u_adm, u_adm);
  insert into public.fleet_settings (organization_id, created_by, updated_by) values (v_org, u_adm, u_adm);
  insert into public.trip_route_templates (organization_id, denumire, de_la_loc, pana_la_loc, scop, km_estimat,
                                           created_by, updated_by)
  values (v_org, 'Sediu – Client', 'Sediu', 'Client', 'Livrare', 50, u_adm, u_adm);

  insert into public.vehicle_service_plans (organization_id, vehicle_id, denumire, interval_luni, baza_data, baza_km,
                                            created_by, updated_by)
  select v_org, x, 'Revizie anuală', 12, v_zi - 360, 0, u_adm, u_adm from unnest(array[v1, v2, vp]) as x;
  insert into public.vehicle_service_entries (organization_id, vehicle_id, data_interventiei, km, tip, descriere,
                                              cost_piese, cost_manopera, created_by, updated_by) values
    (v_org, v1, v_zi - 5, 10160, 'reparatie', 'Plăcuțe frână', 300, 200, u_adm, u_adm),
    (v_org, v2, v_zi - 5, 20060, 'reparatie', 'Plăcuțe frână', 300, 200, u_adm, u_adm),
    (v_org, vp, v_zi - 5, 30060, 'reparatie', 'Plăcuțe frână', 300, 200, u_adm, u_adm);
  insert into public.vehicle_expenses (organization_id, vehicle_id, categorie, data_cheltuielii, suma,
                                       created_by, updated_by)
  select v_org, x, 'parcare', v_zi - 3, 25, u_adm, u_adm from unnest(array[v1, v2, vp]) as x;

  insert into public.driver_licenses (organization_id, employee_id, numar, categorii, expira_la)
  select v_org, x.e, 'P-' || s || '-' || x.n, array['B'], v_zi + 400
    from (values (e_e1, 1), (e_e2, 2), (e_mgr, 3)) as x(e, n);

  insert into public.vehicle_fiscal_regimes (organization_id, vehicle_id, valabil_de_la, regim, motiv,
                                             created_by, updated_by) values
    (v_org, v1, v_zi - 60, 'limitat_50', 'Folosință mixtă', u_adm, u_adm),
    (v_org, v2, v_zi - 60, 'limitat_50', 'Folosință mixtă', u_adm, u_adm);
  insert into public.vehicle_consumption_norms (organization_id, vehicle_id, valabil_de_la, l_100km)
  values (v_org, v2, v_zi - 60, 7.5);

  insert into public.vehicle_fines (organization_id, vehicle_id, numar_pv, constatata_la, fapta, primita_la,
                                    termen_raspuns, created_by, updated_by)
  values (v_org, v2, 'PV-' || s, pg_temp.la(v_zi - 3, '09:30'), 'Parcare interzisă', v_zi - 1, v_zi + 7, u_adm, u_adm);
  insert into public.vehicle_incidents (organization_id, vehicle_id, tip, produs_la, descriere, created_by, updated_by)
  values (v_org, v2, 'coliziune', pg_temp.la(v_zi - 4, '16:00'), 'Zgârietură în parcarea sediului.', u_adm, u_adm);

  insert into storage.objects (bucket_id, name, owner) values
    ('org-flota', v_org::text || '/vehicles/'    || v1::text || '/rca.pdf', u_adm),
    ('org-flota', v_org::text || '/vehicles/'    || v2::text || '/rca.pdf', u_adm),
    ('org-flota', v_org::text || '/vehicles/'    || vp::text || '/rca.pdf', u_adm),
    ('org-flota', v_org::text || '/vehicles/'    || vl::text || '/rca.pdf', u_adm),
    ('org-flota', v_org::text || '/trip_sheets/' || f1::text || '/bon.jpg', u_e1),
    ('org-flota', v_org::text || '/trip_sheets/' || f2::text || '/bon.jpg', u_e2),
    ('org-flota', v_org::text || '/trip_sheets/' || fp::text || '/bon.jpg', u_e2);

  -- Alertele de conformitate pe scadențele proiectate de triggere.
  perform internal.genereaza_alerte(v_org);

  return jsonb_build_object(
    'org', v_org, 'u_adm', u_adm, 'u_hr', u_hr, 'u_mgr', u_mgr, 'u_e1', u_e1, 'u_e2', u_e2,
    'e_hr', e_hr, 'e_mgr', e_mgr, 'e_e1', e_e1, 'e_e2', e_e2,
    'v1', v1, 'v2', v2, 'vp', vp, 'vl', vl, 'f1', f1, 'f2', f2, 'f2v', f2v, 'fp', fp,
    'd2', d2, 'luna', date_trunc('month', v_zi)::date);
end
$f$;

do $$
declare
  a         jsonb := pg_temp.firma('A');
  b         jsonb := pg_temp.firma('B');
  v_roluri  text[] := array['org_admin', 'hr', 'manager', 'E1', 'E2'];
  v_useri   uuid[];
  r         record;
  i         int;
  v_n       bigint;
  v_brut    bigint;
  v_asteptat int;
  v_linie   text;
  v_rezultat text;
  v_obtinut text;
  v_celule  int := 0;
  v_esecuri int := 0;
begin
  v_useri := array[a->>'u_adm', a->>'u_hr', a->>'u_mgr', a->>'u_e1', a->>'u_e2']::uuid[];

  raise notice '';
  raise notice '  PROBA „FLOTA — MATRICEA ROL × TABELĂ” (A4, 0199–0206)';
  raise notice '  ─────────────────────────────────────────────────────────────────────────────────';
  raise notice '  %  %  %  %  %  %', rpad('tabelă / funcție (firma A)', 40), lpad('adm', 6), lpad('hr', 6),
    lpad('mgr', 6), lpad('E1', 6), lpad('E2', 6);

  -- adm = -1: „tot ce există”, numărat în contextul de serviciu (scadențele și
  -- alertele le generează triggerele, nu proba).
  for r in
    select * from (values
      ('vehicles',                     'select 1 from public.vehicles where organization_id = {org}',                      4, 0, 2, 2, 2),
      ('vehicle_assignments',          'select 1 from public.vehicle_assignments where organization_id = {org}',           3, 0, 2, 1, 2),
      ('vehicle_documents',            'select 1 from public.vehicle_documents where organization_id = {org}',             4, 0, 2, 2, 2),
      ('trip_sheets',                  'select 1 from public.trip_sheets where organization_id = {org}',                   4, 0, 3, 1, 3),
      ('trip_sheet_curse',             'select 1 from public.trip_sheet_curse where organization_id = {org}',              4, 0, 3, 1, 3),
      ('fuel_entries',                 'select 1 from public.fuel_entries where organization_id = {org}',                  3, 0, 2, 1, 2),
      ('odometer_anomalies',           'select 1 from public.odometer_anomalies where organization_id = {org}',            5, 0, 3, 2, 3),
      ('  anomalia lui E2 pe V1 (f2v)', 'select 1 from public.odometer_anomalies where organization_id = {org} and trip_sheet_id = {f2v}', 1, 0, 1, 0, 1),
      ('trip_route_templates',         'select 1 from public.trip_route_templates where organization_id = {org}',          1, 0, 1, 1, 1),
      ('fleet_settings',               'select 1 from public.fleet_settings where organization_id = {org}',                1, 0, 0, 0, 0),
      ('vehicle_document_type_setari', 'select 1 from public.vehicle_document_type_setari where organization_id = {org}',  1, 0, 1, 1, 1),
      ('vehicle_service_plans',        'select 1 from public.vehicle_service_plans where organization_id = {org}',         3, 0, 1, 0, 0),
      ('vehicle_service_entries',      'select 1 from public.vehicle_service_entries where organization_id = {org}',       3, 0, 1, 0, 0),
      ('vehicle_expenses',             'select 1 from public.vehicle_expenses where organization_id = {org}',              3, 0, 1, 0, 0),
      -- 0225 (X1): costurile din coloane s-au mutat în tabele 1:1 cu citirea lui
      -- `vehicle_expenses` (plus `vehicles:update = all`). Coloanele vechi sunt goale.
      ('vehicle_costuri',              'select 1 from public.vehicle_costuri where organization_id = {org}',               4, 0, 1, 0, 0),
      ('vehicle_document_costuri',     'select 1 from public.vehicle_document_costuri where organization_id = {org}',      4, 0, 1, 0, 0),
      ('  vehicles.valoare_achizitie',  'select 1 from public.vehicles where organization_id = {org} and valoare_achizitie is not null', 0, 0, 0, 0, 0),
      ('  vehicle_documents.cost',      'select 1 from public.vehicle_documents where organization_id = {org} and cost is not null', 0, 0, 0, 0, 0),
      ('driver_licenses',              'select 1 from public.driver_licenses where organization_id = {org}',               3, 3, 2, 1, 1),
      ('vehicle_fiscal_regimes',       'select 1 from public.vehicle_fiscal_regimes where organization_id = {org}',        2, 0, 0, 0, 0),
      ('vehicle_consumption_norms',    'select 1 from public.vehicle_consumption_norms where organization_id = {org}',     1, 0, 0, 0, 0),
      ('vehicle_fines',                'select 1 from public.vehicle_fines where organization_id = {org}',                 1, 0, 0, 0, 0),
      ('vehicle_incidents',            'select 1 from public.vehicle_incidents where organization_id = {org}',             1, 0, 0, 0, 0),
      ('expirables (flotă)',           'select 1 from public.expirables where organization_id = {org} and entity_type in (''vehicle_document'', ''vehicle_service'', ''driver_license'', ''vehicle_fine'')', -1, 0, 0, 0, 0),
      ('compliance_alerts (flotă)',    'select 1 from public.compliance_alerts where organization_id = {org}',             -1, 0, 0, 0, 0),
      ('storage org-flota',            'select 1 from storage.objects where bucket_id = ''org-flota'' and name like ({org} || ''/%'')', 7, 0, 4, 3, 4),
      ('verificari_soferi (rânduri)',  'select 1 from public.verificari_soferi({org}, array[{e_e1}, {e_e2}, {e_mgr}, {e_hr}]::uuid[], app.azi_local())', 4, 4, 2, 1, 1),
      ('verificari_soferi (permis)',   'select 1 from public.verificari_soferi({org}, array[{e_e1}, {e_e2}, {e_mgr}, {e_hr}]::uuid[], app.azi_local()) where permis_exista is not null', 4, 4, 2, 1, 1),
      ('flota_prag_salt_km(V1)',       'select 1 where public.flota_prag_salt_km({v1}) is not null',                       1, 0, 0, 1, 0),
      ('flota_prag_salt_km(VP)',       'select 1 where public.flota_prag_salt_km({vp}) is not null',                       1, 0, 1, 1, 1),
      ('flota_fiscal_luna (rânduri)',  'select 1 from public.flota_fiscal_luna({org}, {luna}::date)',                      4, 0, 2, 2, 2),
      ('flota_fiscal_luna (cu regim)', 'select 1 from public.flota_fiscal_luna({org}, {luna}::date) where regim is not null', 2, 0, 0, 0, 0),
      ('avantaj_natura_flota(E1)',     'select 1 from public.avantaj_natura_flota({org}, {e_e1}, {luna}::date)',          1, 1, 0, 0, 0),
      ('avantaj_natura_flota(E1) cu valoare', 'select 1 from public.avantaj_natura_flota({org}, {e_e1}, {luna}::date) where valoare_intrare = 60000', 1, 1, 0, 0, 0),
      ('sofer_sugerat(V2)',            'select 1 from public.sofer_sugerat({org}, {v2}, now())',                          1, 0, 0, 0, 0)
    ) as t(eticheta, sql, adm, hr, mgr, e1, e2)
  loop
    -- Celulele firmei A.
    v_linie := '';
    for i in 1 .. 5 loop
      v_asteptat := case i when 1 then r.adm when 2 then r.hr when 3 then r.mgr when 4 then r.e1 else r.e2 end;
      if v_asteptat = -1 then
        execute 'select count(*) from (' || pg_temp.sub(r.sql, a) || ') q' into v_brut;
        if v_brut = 0 then
          v_esecuri := v_esecuri + 1;
          raise warning '  ✗ % — firma A nu are niciun rând: proba nu judecă nimic', r.eticheta;
        end if;
        v_asteptat := v_brut;
      end if;
      v_n := pg_temp.numara(v_useri[i], pg_temp.sub(r.sql, a));
      v_celule := v_celule + 1;
      if v_n = v_asteptat then
        v_linie := v_linie || lpad(v_n::text, 6) || '  ';
      else
        v_esecuri := v_esecuri + 1;
        v_linie := v_linie || lpad(v_n::text || '≠' || v_asteptat::text, 6) || '  ';
        raise warning '  ✗ % sub %: % rânduri, intenționat %', r.eticheta, v_roluri[i], v_n, v_asteptat;
      end if;
    end loop;
    raise notice '  %  %', rpad(r.eticheta, 40), v_linie;

    -- Aceeași interogare pe firma B: zero pentru toate rolurile firmei A. Fără
    -- rânduri în B (în contextul de serviciu), verificarea ar fi goală.
    if r.adm <> 0 and r.eticheta not like 'flota_prag_salt_km%' then
      execute 'select count(*) from (' || pg_temp.sub(r.sql, b) || ') q' into v_brut;
      if v_brut = 0 and r.eticheta not like 'verificari%' and r.eticheta not like 'avantaj%'
         and r.eticheta not like 'flota_fiscal%' and r.eticheta not like 'sofer_sugerat%' then
        v_esecuri := v_esecuri + 1;
        raise warning '  ✗ % — firma B nu are niciun rând', r.eticheta;
      end if;
    end if;
    for i in 1 .. 5 loop
      v_n := pg_temp.numara(v_useri[i], pg_temp.sub(r.sql, b));
      v_celule := v_celule + 1;
      if v_n <> 0 then
        v_esecuri := v_esecuri + 1;
        raise warning '  ✗ % — % din firma A vede % rânduri ale firmei B', r.eticheta, v_roluri[i], v_n;
      end if;
    end loop;
  end loop;

  -- ── Scrierile pe tabelele de administrare și de costuri ──────────────────
  -- Aceeași clasă, pe drumul de scriere: politicile de aici cer literal `all`,
  -- deci rolurile lărgite de 0199 trebuie să primească 42501 la INSERT și zero
  -- rânduri la UPDATE. INSERT-ul administratorului reușește: fără el, un 42501
  -- al celorlalți ar putea veni dintr-un șablon greșit, nu din politică. UPDATE-ul
  -- lui atinge TOATE rândurile firmei (proba pozitivă: un UPDATE de tranziție
  -- care ar cădea pe vizibilitatea strânsă de A4 ar ieși cu mai puține, fără
  -- eroare). `null` = celula nu se judecă.
  raise notice '  ─────────────────────────────────────────────────────────────────────────────────';
  raise notice '  %  %  %  %  %  %', rpad('scriere (firma A)', 40), lpad('adm', 6), lpad('hr', 6),
    lpad('mgr', 6), lpad('E1', 6), lpad('E2', 6);
  for r in
    select * from (values
      ('INSERT vehicles',
       'insert into public.vehicles (organization_id, nr_inmatriculare, marca, model, km_curent, created_by, updated_by) values ({org}, ''B999ZZP'', ''Dacia'', ''Spring'', 100, auth.uid(), auth.uid())',
       'ok:1', '42501', '42501', '42501', '42501'),
      ('INSERT vehicle_documents',
       'insert into public.vehicle_documents (organization_id, vehicle_id, document_type_id, numar, expira_la, created_by, updated_by) select {org}, {v1}, t.id, ''ITP-P'', app.azi_local() + 100, auth.uid(), auth.uid() from public.vehicle_document_types t where t.organization_id is null and t.cod = ''itp''',
       'ok:1', '42501', '42501', '42501', '42501'),
      ('INSERT vehicle_assignments',
       'insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, created_by, updated_by) values ({org}, {vl}, {e_hr}, now(), auth.uid(), auth.uid())',
       'ok:1', '42501', '42501', '42501', '42501'),
      ('INSERT vehicle_document_type_setari',
       'insert into public.vehicle_document_type_setari (organization_id, document_type_id, activ, obligatoriu, created_by, updated_by) select {org}, t.id, true, false, auth.uid(), auth.uid() from public.vehicle_document_types t where t.organization_id is null and t.cod = ''itp''',
       'ok:1', '42501', '42501', '42501', '42501'),
      ('INSERT trip_route_templates',
       'insert into public.trip_route_templates (organization_id, denumire, de_la_loc, pana_la_loc, scop, created_by, updated_by) values ({org}, ''Probă'', ''A'', ''B'', ''Test'', auth.uid(), auth.uid())',
       'ok:1', '42501', '42501', '42501', '42501'),
      ('INSERT vehicle_service_plans',
       'insert into public.vehicle_service_plans (organization_id, vehicle_id, denumire, interval_luni, baza_data, baza_km, created_by, updated_by) values ({org}, {v2}, ''Plan probă'', 12, app.azi_local() - 10, 0, auth.uid(), auth.uid())',
       'ok:1', '42501', '42501', '42501', '42501'),
      ('INSERT vehicle_service_entries',
       'insert into public.vehicle_service_entries (organization_id, vehicle_id, data_interventiei, km, tip, descriere, created_by, updated_by) values ({org}, {v2}, app.azi_local() - 1, 20100, ''reparatie'', ''Probă'', auth.uid(), auth.uid())',
       'ok:1', '42501', '42501', '42501', '42501'),
      ('INSERT vehicle_expenses',
       'insert into public.vehicle_expenses (organization_id, vehicle_id, categorie, data_cheltuielii, suma, created_by, updated_by) values ({org}, {v2}, ''parcare'', app.azi_local() - 1, 10, auth.uid(), auth.uid())',
       'ok:1', '42501', '42501', '42501', '42501'),
      ('INSERT driver_licenses (pt. hr)',
       'insert into public.driver_licenses (organization_id, employee_id, numar, categorii, expira_la) values ({org}, {e_hr}, ''P-HR-PROBA'', array[''B''], app.azi_local() + 300)',
       'ok:1', 'ok:1', '42501', '42501', '42501'),
      ('INSERT vehicle_fiscal_regimes',
       'insert into public.vehicle_fiscal_regimes (organization_id, vehicle_id, valabil_de_la, regim, motiv, created_by, updated_by) values ({org}, {vl}, app.azi_local() - 5, ''limitat_50'', ''Probă'', auth.uid(), auth.uid())',
       'ok:1', '42501', '42501', '42501', '42501'),
      ('INSERT vehicle_consumption_norms',
       'insert into public.vehicle_consumption_norms (organization_id, vehicle_id, valabil_de_la, l_100km) values ({org}, {v1}, app.azi_local() - 5, 6.5)',
       'ok:1', '42501', '42501', '42501', '42501'),
      ('INSERT vehicle_fines',
       'insert into public.vehicle_fines (organization_id, vehicle_id, numar_pv, constatata_la, fapta) values ({org}, {v1}, ''PV-PROBA'', now() - interval ''1 day'', ''Probă'')',
       'ok:1', '42501', '42501', '42501', '42501'),
      -- 0206 §F (A5, declarația șoferului): `employee` are `vehicle_incidents:create
      -- = own` și își declară dauna pe mașina avută în ziua incidentului (E1, pe V1);
      -- pe mașina altuia, garda din `incidente_inainte` refuză cu P0001 (E2).
      ('INSERT vehicle_incidents',
       'insert into public.vehicle_incidents (organization_id, vehicle_id, tip, produs_la, descriere, created_by, updated_by) values ({org}, {v1}, ''avarie'', now() - interval ''1 day'', ''Probă.'', auth.uid(), auth.uid())',
       'ok:1', '42501', '42501', 'ok:1', 'P0001'),
      -- 0225: upsert-ul aplicației (`on_conflict`) pe rândul de cost existent.
      ('UPSERT vehicle_costuri',
       'insert into public.vehicle_costuri (organization_id, vehicle_id, valoare_achizitie, created_by, updated_by) values ({org}, {v1}, 61000, auth.uid(), auth.uid()) on conflict (vehicle_id) do update set valoare_achizitie = excluded.valoare_achizitie, updated_by = excluded.updated_by',
       'ok:1', '42501', '42501', '42501', '42501'),
      ('UPSERT vehicle_document_costuri',
       'insert into public.vehicle_document_costuri (organization_id, document_id, cost, created_by, updated_by) values ({org}, {d2}, 1300, auth.uid(), auth.uid()) on conflict (document_id) do update set cost = excluded.cost, updated_by = excluded.updated_by',
       'ok:1', '42501', '42501', '42501', '42501'),
      ('INSERT odometer_anomalies',
       'insert into public.odometer_anomalies (organization_id, vehicle_id, km_asteptat, km_declarat, tip) values ({org}, {v1}, 1, 2, ''salt'')',
       '42501', '42501', '42501', '42501', '42501'),
      ('UPDATE vehicles',                     'update public.vehicles set updated_by = auth.uid() where organization_id = {org}',                     'ok:4', 'ok:0', 'ok:0', 'ok:0', 'ok:0'),
      ('UPDATE vehicle_documents',            'update public.vehicle_documents set updated_by = auth.uid() where organization_id = {org}',            'ok:4', 'ok:0', 'ok:0', 'ok:0', 'ok:0'),
      ('UPDATE vehicle_assignments',          'update public.vehicle_assignments set updated_by = auth.uid() where organization_id = {org}',          'ok:3', 'ok:0', 'ok:0', 'ok:0', 'ok:0'),
      ('UPDATE fleet_settings',               'update public.fleet_settings set updated_by = auth.uid() where organization_id = {org}',               'ok:1', 'ok:0', 'ok:0', 'ok:0', 'ok:0'),
      ('UPDATE vehicle_document_type_setari', 'update public.vehicle_document_type_setari set updated_by = auth.uid() where organization_id = {org}', 'ok:1', 'ok:0', 'ok:0', 'ok:0', 'ok:0'),
      ('UPDATE trip_route_templates',         'update public.trip_route_templates set updated_by = auth.uid() where organization_id = {org}',         'ok:1', 'ok:0', 'ok:0', 'ok:0', 'ok:0'),
      ('UPDATE vehicle_service_plans',        'update public.vehicle_service_plans set updated_by = auth.uid() where organization_id = {org}',        'ok:3', 'ok:0', 'ok:0', 'ok:0', 'ok:0'),
      ('UPDATE vehicle_service_entries',      'update public.vehicle_service_entries set updated_by = auth.uid() where organization_id = {org}',      'ok:3', 'ok:0', 'ok:0', 'ok:0', 'ok:0'),
      ('UPDATE vehicle_expenses',             'update public.vehicle_expenses set updated_by = auth.uid() where organization_id = {org}',             'ok:3', 'ok:0', 'ok:0', 'ok:0', 'ok:0'),
      ('UPDATE vehicle_costuri',              'update public.vehicle_costuri set updated_by = auth.uid() where organization_id = {org}',              'ok:4', 'ok:0', 'ok:0', 'ok:0', 'ok:0'),
      ('UPDATE vehicle_document_costuri',     'update public.vehicle_document_costuri set updated_by = auth.uid() where organization_id = {org}',     'ok:4', 'ok:0', 'ok:0', 'ok:0', 'ok:0'),
      ('UPDATE driver_licenses',              'update public.driver_licenses set updated_by = auth.uid() where organization_id = {org}',              'ok:3', 'ok:3', 'ok:0', 'ok:0', 'ok:0'),
      ('UPDATE vehicle_fiscal_regimes',       'update public.vehicle_fiscal_regimes set updated_by = auth.uid() where organization_id = {org}',       'ok:2', 'ok:0', 'ok:0', 'ok:0', 'ok:0'),
      ('UPDATE vehicle_consumption_norms',    'update public.vehicle_consumption_norms set updated_by = auth.uid() where organization_id = {org}',    'ok:1', 'ok:0', 'ok:0', 'ok:0', 'ok:0'),
      ('UPDATE vehicle_fines',                'update public.vehicle_fines set updated_by = auth.uid() where organization_id = {org}',                'ok:1', 'ok:0', 'ok:0', 'ok:0', 'ok:0'),
      ('UPDATE vehicle_incidents',            'update public.vehicle_incidents set updated_by = auth.uid() where organization_id = {org}',            'ok:1', 'ok:0', 'ok:0', 'ok:0', 'ok:0'),
      ('UPDATE odometer_anomalies',           'update public.odometer_anomalies set updated_by = auth.uid() where organization_id = {org}',           'ok:5', 'ok:0', 'ok:0', 'ok:0', 'ok:0')
    ) as t(eticheta, sql, adm, hr, mgr, e1, e2)
  loop
    v_linie := '';
    for i in 1 .. 5 loop
      v_rezultat := case i when 1 then r.adm when 2 then r.hr when 3 then r.mgr when 4 then r.e1 else r.e2 end;
      if v_rezultat is null then
        v_linie := v_linie || lpad('—', 6) || '  ';
        continue;
      end if;
      v_obtinut := pg_temp.incearca(v_useri[i], pg_temp.sub(r.sql, a));
      v_celule := v_celule + 1;
      if v_obtinut = v_rezultat or v_obtinut like v_rezultat || ' %' then
        v_linie := v_linie || lpad(split_part(v_obtinut, ' ', 1), 6) || '  ';
      else
        v_esecuri := v_esecuri + 1;
        v_linie := v_linie || lpad('✗', 6) || '  ';
        raise warning '  ✗ % sub %: „%”, intenționat „%”', r.eticheta, v_roluri[i], v_obtinut, v_rezultat;
      end if;
    end loop;
    raise notice '  %  %', rpad(r.eticheta, 40), v_linie;
  end loop;

  -- ── Coloanele vechi ca intrare de compatibilitate (0225 §6) ──────────────
  -- Până la 0225 aici stăteau DOUĂ DEFECTE: `vehicle_documents.cost` (azi
  -- 4/0/2/2/2) și `vehicles.valoare_achizitie` (azi 4/0/2/2/2), coloane pe
  -- rânduri pe care angajatul și managerul (pool) le văd. Mutate în tabelele de
  -- costuri, le judecă matricea de sus. Aici: aplicația veche (fereastra dintre
  -- migrare și deploy) scrie încă în coloana veche. Valoarea nenulă ajunge în
  -- tabela de costuri și coloana rămâne goală; `null` nu golește costul.
  raise notice '  ─────────────────────────────────────────────────────────────────────────────────';
  v_brut := v_esecuri;
  v_obtinut := pg_temp.incearca(v_useri[1], pg_temp.sub(
    'update public.vehicles set valoare_achizitie = 65000, updated_by = auth.uid() where id = {v1}', a));
  v_rezultat := 'ok:1';
  v_celule := v_celule + 1;
  if v_obtinut <> v_rezultat then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ coloana veche, scrisă de administrator: „%”', v_obtinut;
  end if;
  -- `incearca` derulează înapoi; aici scrierea trebuie să rămână, ca să se citească.
  perform set_config('request.jwt.claim.sub', a->>'u_adm', true);
  set local role authenticated;
  update public.vehicles set valoare_achizitie = 65000, updated_by = auth.uid() where id = (a->>'v1')::uuid;
  update public.vehicles set valoare_achizitie = null, updated_by = auth.uid() where id = (a->>'v2')::uuid;
  update public.vehicle_documents set cost = 1500, updated_by = auth.uid()
   where organization_id = (a->>'org')::uuid and vehicle_id = (a->>'vp')::uuid;
  reset role;
  v_celule := v_celule + 1;
  if (select valoare_achizitie from public.vehicle_costuri where vehicle_id = (a->>'v1')::uuid) is distinct from 65000
     or (select valoare_achizitie from public.vehicle_costuri where vehicle_id = (a->>'v2')::uuid) is distinct from 90000
     or (select c.cost from public.vehicle_document_costuri c join public.vehicle_documents d on d.id = c.document_id
          where d.vehicle_id = (a->>'vp')::uuid) is distinct from 1500
     or exists (select 1 from public.vehicles where organization_id = (a->>'org')::uuid and valoare_achizitie is not null)
     or exists (select 1 from public.vehicle_documents where organization_id = (a->>'org')::uuid and cost is not null) then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ coloana veche: valoarea nenulă nu a ajuns în tabela de costuri, null a golit costul sau coloana nu e goală';
  end if;
  -- Angajatul nu scrie costuri nici prin coloana veche: `vehicule_update` îl
  -- filtrează (zero rânduri), deci triggerul nu rulează.
  v_obtinut := pg_temp.incearca(v_useri[4], pg_temp.sub(
    'update public.vehicles set valoare_achizitie = 1, updated_by = auth.uid() where id = {v1}', a));
  v_celule := v_celule + 1;
  if v_obtinut <> 'ok:0' then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ coloana veche, scrisă de E1: „%”, intenționat „ok:0”', v_obtinut;
  end if;
  -- Plasa de siguranță: fără trigger, coloana veche refuză orice valoare (23514).
  begin
    alter table public.vehicles disable trigger vehicles_valoare_in_costuri;
    update public.vehicles set valoare_achizitie = 1 where id = (a->>'v1')::uuid;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ coloana veche a primit o valoare cu triggerul oprit (CHECK lipsă)';
  exception when check_violation then
    null;
  end;
  alter table public.vehicles enable trigger vehicles_valoare_in_costuri;
  v_celule := v_celule + 1;
  raise notice '  %  %', rpad('coloanele vechi: intrare, null, E1, CHECK', 40), case when v_esecuri = v_brut then 'OK' else '✗' end;

  raise notice '  ─────────────────────────────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA FLOTA MATRICE: % celule abat de la matricea intenționată (din %)', v_esecuri, v_celule;
  end if;
  raise notice '  TOATE cele % de celule (firma A pe roluri, firma B la zero) se potrivesc;', v_celule;
  raise notice '  costurile stau în tabele proprii (0225): niciun defect cunoscut rămas aici.';
  raise notice '';
end;
$$;

rollback;
