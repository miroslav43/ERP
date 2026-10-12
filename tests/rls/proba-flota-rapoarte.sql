-- tests/rls/proba-flota-rapoarte.sql
--
-- FLOTA, F8: RAPOARTELE LUNARE ȘI EXPORTUL, PE SEED-UL REAL.
--
-- F8 nu are migrare: `vehicles:export` e seedată din 0002 (produsul cartezian de
-- acțiuni al lui `org_admin` și `super_admin`), iar rapoartele citesc tabele
-- existente prin politicile lor. De aceea proba judecă DOUĂ lucruri pe care
-- codul le presupune despre bază și pe care niciun test cu client fals nu le
-- poate verifica:
--  · cine primește cheia de export și cine trece de poarta paginii
--    (`poateVedeaRapoarte` = vehicles:read ȘI trip_sheets:read, ambele `all`);
--  · că citirile din care se adună cifrele sunt COMPLETE pentru administrator și
--    PARȚIALE, tăcut, pentru oricine altcineva — adică exact motivul pentru care
--    poarta cere `all` și nu `team`.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- Cheile (matricea reală, fără rânduri puse de probă):
--  (1) `vehicles:export`: administratorul `all`; managerul, hr și angajatul `none`;
--  (2) poarta paginii (vehicles:read și trip_sheets:read la `all`) trece DOAR
--      administratorul; managerul are `team` pe amândouă;
-- Citirile din care se adună raportul lunii (luna anterioară, o foaie aprobată per
-- șofer, plus o ciornă):
--  (3) administratorul vede toate cele 3 foi aprobate, kilometrii (600) și litrii
--      (60) lor, service-ul (750), cheltuielile (15) și documentele cu cost (100);
--      ciorna se numără separat, ca „neaprobată"                         [POZITIVĂ];
--  (4) fără filtru de firmă, administratorul tot nu vede nimic din altă firmă
--      (foi, intervenții) — filtrul explicit din citiri e a doua plasă;
--  (5) managerul vede doar foile echipei lui (2 din 3) și doar vehiculele ei:
--      un raport făcut cu drepturile lui ar fi PARȚIAL, fără nicio eroare;
--  (6) angajatul vede doar foaia lui; hr și colegul fără foi, zero rânduri din
--      foi, vehicule, intervenții, cheltuieli și documente — fără eroare;
--  (7) altă firmă: administratorul ei vede doar rândurile ei.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

-- Identitatea: JWT-ul și rolul. Rămân valabile până la `reset role`.
create function pg_temp.ca(p_user uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  execute 'set local role authenticated';
end $f$;

create function pg_temp.cate(p_sql text) returns bigint language plpgsql as $f$
declare n bigint;
begin
  execute 'select count(*) from (' || p_sql || ') q' into n;
  return n;
end $f$;

create function pg_temp.suma(p_sql text) returns numeric language plpgsql as $f$
declare n numeric;
begin
  execute p_sql into n;
  return coalesce(n, 0);
end $f$;

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_azi      date := app.azi_local();
  -- Luna anterioară: ziua 1, ca ferestrele să fie la fel în orice zi a rulării.
  v_luna     date := (date_trunc('month', app.azi_local()) - interval '1 month')::date;
  v_la       date := (date_trunc('month', app.azi_local()) - interval '1 day')::date;
  v_org      uuid := gen_random_uuid();
  v_org2     uuid := gen_random_uuid();
  v_u_adm    uuid := gen_random_uuid();
  v_u_mgr    uuid := gen_random_uuid();
  v_u_a      uuid := gen_random_uuid();   -- Ana, în echipa managerului
  v_u_b      uuid := gen_random_uuid();   -- Bogdan, în echipa managerului
  v_u_c      uuid := gen_random_uuid();   -- Cristi, în afara echipei
  v_u_hr     uuid := gen_random_uuid();
  v_u_adm2   uuid := gen_random_uuid();
  v_e_adm    uuid := gen_random_uuid();
  v_e_mgr    uuid := gen_random_uuid();
  v_e_a      uuid := gen_random_uuid();
  v_e_b      uuid := gen_random_uuid();
  v_e_c      uuid := gen_random_uuid();
  v_e_hr     uuid := gen_random_uuid();
  v_e_adm2   uuid := gen_random_uuid();
  v_va       uuid := gen_random_uuid();
  v_vb       uuid := gen_random_uuid();
  v_vc       uuid := gen_random_uuid();
  v_v2       uuid := gen_random_uuid();
  v_tip      uuid;
  v_foaie    uuid;
  v_n        bigint;
  v_n2       bigint;
  v_s        numeric;
  v_s2       numeric;
  v_k        int;
  v_r        text;
  v_esecuri  int := 0;
  v_ok       boolean;
  v_rol      record;
begin
  raise notice '';
  raise notice '  PROBA „FLOTA — RAPOARTE ȘI EXPORT" (F8, fără migrare)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org,  'proba-frp-' || v_sufix,  'Proba Rapoarte SRL',
     'RO' || (91000000 + (random() * 900000)::int)::text),
    (v_org2, 'proba-frp2-' || v_sufix, 'Proba Rapoarte Doi SRL',
     'RO' || (92000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select o, f.feature_key, true, now()
    from public.features f, unnest(array[v_org, v_org2]) as o;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_adm,  'frp-adm-'  || v_sufix || '@proba.test', now()),
    (v_u_mgr,  'frp-mgr-'  || v_sufix || '@proba.test', now()),
    (v_u_a,    'frp-a-'    || v_sufix || '@proba.test', now()),
    (v_u_b,    'frp-b-'    || v_sufix || '@proba.test', now()),
    (v_u_c,    'frp-c-'    || v_sufix || '@proba.test', now()),
    (v_u_hr,   'frp-hr-'   || v_sufix || '@proba.test', now()),
    (v_u_adm2, 'frp-adm2-' || v_sufix || '@proba.test', now());
  -- Fișele ÎNAINTEA rândurilor de membru (0083 îi creează singur administratorului o fișă).
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_adm,  v_org,  'FRP-ADM', 'Ioana', 'Administrator', v_azi - 900, 'activ', v_u_adm,  null),
    (v_e_mgr,  v_org,  'FRP-M',   'Mihai', 'Manager',       v_azi - 500, 'activ', v_u_mgr,  null),
    (v_e_hr,   v_org,  'FRP-HR',  'Elena', 'Personal',      v_azi - 500, 'activ', v_u_hr,   null),
    (v_e_c,    v_org,  'FRP-C',   'Cristi','Străin',        v_azi - 400, 'activ', v_u_c,    null),
    (v_e_adm2, v_org2, 'FRP-AD2', 'Radu',  'Altă Firmă',    v_azi - 900, 'activ', v_u_adm2, null);
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_a, v_org, 'FRP-A', 'Ana',    'Șofer', v_azi - 400, 'activ', v_u_a, v_e_mgr),
    (v_e_b, v_org, 'FRP-B', 'Bogdan', 'Șofer', v_azi - 400, 'activ', v_u_b, v_e_mgr);
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org,  v_u_adm,  'org_admin'),
    (v_org,  v_u_mgr,  'manager'),
    (v_org,  v_u_a,    'employee'),
    (v_org,  v_u_b,    'employee'),
    (v_org,  v_u_c,    'employee'),
    (v_org,  v_u_hr,   'hr'),
    (v_org2, v_u_adm2, 'org_admin');

  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent,
                               created_by, updated_by) values
    (v_va, v_org,  'B' || (100 + (random() * 800)::int)::text || 'FPA', 'Dacia', 'Logan',  10000, v_u_adm,  v_u_adm),
    (v_vb, v_org,  'B' || (100 + (random() * 800)::int)::text || 'FPB', 'Dacia', 'Duster', 20000, v_u_adm,  v_u_adm),
    (v_vc, v_org,  'B' || (100 + (random() * 800)::int)::text || 'FPC', 'Skoda', 'Octavia',30000, v_u_adm,  v_u_adm),
    (v_v2, v_org2, 'B' || (100 + (random() * 800)::int)::text || 'FP2', 'Dacia', 'Spring',  5000, v_u_adm2, v_u_adm2);
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, created_by, updated_by) values
    (v_org, v_va, v_e_a, now() - interval '120 days', v_u_adm, v_u_adm),
    (v_org, v_vb, v_e_b, now() - interval '120 days', v_u_adm, v_u_adm),
    (v_org, v_vc, v_e_c, now() - interval '120 days', v_u_adm, v_u_adm);

  -- ═══ Foile lunii anterioare, scrise în contextul de serviciu ══════════════
  -- Ana (100 km, 10 l), Bogdan (200 km, 20 l), Cristi (300 km, 30 l): toate trei
  -- trimise și APROBATE de administrator. Ana mai are o ciornă, în ziua 5.
  for v_rol in
    select * from (values
      (v_va, v_e_a, v_u_a, 1, 10000, 100, 10, 70.00),
      (v_vb, v_e_b, v_u_b, 2, 20000, 200, 20, 140.00),
      (v_vc, v_e_c, v_u_c, 3, 30000, 300, 30, 210.00)
    ) as t(veh, ang, usr, zi, km0, km, litri, cost)
  loop
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                    created_by, updated_by)
    values (v_org, v_rol.veh, v_rol.ang,
            ((v_luna + (v_rol.zi - 1))::timestamp + interval '08:00') at time zone 'Europe/Bucharest',
            v_rol.km0, v_rol.usr, v_rol.usr)
    returning id into v_foaie;
    insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la,
                                         de_la_loc, pana_la_loc, scop, km_plecare, km_sosire,
                                         created_by, updated_by)
    values (v_org, v_foaie,
            ((v_luna + (v_rol.zi - 1))::timestamp + interval '08:00') at time zone 'Europe/Bucharest',
            ((v_luna + (v_rol.zi - 1))::timestamp + interval '12:00') at time zone 'Europe/Bucharest',
            'Sediu', 'Client', 'Livrare', v_rol.km0, v_rol.km0 + v_rol.km, v_rol.usr, v_rol.usr);
    insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la,
                                     created_by, updated_by)
    values (v_org, v_foaie, v_rol.litri, v_rol.cost,
            ((v_luna + (v_rol.zi - 1))::timestamp + interval '09:00') at time zone 'Europe/Bucharest',
            v_rol.usr, v_rol.usr);
    update public.trip_sheets set status = 'trimis', updated_by = v_rol.usr where id = v_foaie;
    -- Aprobarea, ca administrator: calea reală, nu o scriere în context de serviciu.
    perform pg_temp.ca(v_u_adm);
    update public.trip_sheets set status = 'aprobat', updated_by = v_u_adm where id = v_foaie;
    get diagnostics v_n = row_count;
    reset role;
    if v_n <> 1 then
      raise exception 'proba: foaia zilei % nu s-a aprobat (% rânduri)', v_rol.zi, v_n;
    end if;
  end loop;

  -- Ciorna Anei, ziua 5: nu intră în cifre, dar raportul o numără ca „neaprobată".
  insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                  created_by, updated_by)
  values (v_org, v_va, v_e_a,
          ((v_luna + 4)::timestamp + interval '08:00') at time zone 'Europe/Bucharest',
          10100, v_u_a, v_u_a);

  -- Service pe VA (750), cheltuială pe VC (15), document cu cost pe VB (100), toate în lună.
  insert into public.vehicle_service_entries
    (organization_id, vehicle_id, data_interventiei, km, tip, descriere, cost_piese, cost_manopera,
     created_by, updated_by)
  values (v_org, v_va, v_luna + 9, 10100, 'revizie', 'Ulei, filtre', 300, 450, v_u_adm, v_u_adm);
  insert into public.vehicle_expenses
    (organization_id, vehicle_id, categorie, data_cheltuielii, suma, created_by, updated_by)
  values (v_org, v_vc, 'parcare', v_luna + 10, 15, v_u_adm, v_u_adm);
  select id into v_tip from public.vehicle_document_types
   where organization_id is null and cod = 'rca' and deleted_at is null;
  insert into public.vehicle_documents
    (organization_id, vehicle_id, document_type_id, valabil_de_la, expira_la, cost, created_by, updated_by)
  values (v_org, v_vb, v_tip, v_luna + 11, v_luna + 11 + 365, 100, v_u_adm, v_u_adm);

  -- Altă firmă: o foaie aprobată (50 km) și o intervenție (999), ca să se vadă că nu se amestecă.
  insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                  created_by, updated_by)
  values (v_org2, v_v2, v_e_adm2,
          ((v_luna + 1)::timestamp + interval '08:00') at time zone 'Europe/Bucharest',
          5000, v_u_adm2, v_u_adm2)
  returning id into v_foaie;
  insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la,
                                       de_la_loc, pana_la_loc, scop, km_plecare, km_sosire,
                                       created_by, updated_by)
  values (v_org2, v_foaie,
          ((v_luna + 1)::timestamp + interval '08:00') at time zone 'Europe/Bucharest',
          ((v_luna + 1)::timestamp + interval '10:00') at time zone 'Europe/Bucharest',
          'Sediu', 'Client', 'Livrare', 5000, 5050, v_u_adm2, v_u_adm2);
  update public.trip_sheets set status = 'trimis', updated_by = v_u_adm2 where id = v_foaie;
  update public.trip_sheets set status = 'aprobat', updated_by = v_u_adm2 where id = v_foaie;
  insert into public.vehicle_service_entries
    (organization_id, vehicle_id, data_interventiei, km, tip, descriere, cost_piese, cost_manopera,
     created_by, updated_by)
  values (v_org2, v_v2, v_luna + 3, 5100, 'reparatie', 'Frâne', 600, 399, v_u_adm2, v_u_adm2);

  -- ═══ Cheile ═══════════════════════════════════════════════════════════════

  -- (1) vehicles:export, pe matricea reală
  v_ok := true;
  for v_rol in
    select * from (values
      (v_u_adm, 'all'), (v_u_mgr, 'none'), (v_u_hr, 'none'), (v_u_a, 'none')
    ) as t(usr, asteptat)
  loop
    perform pg_temp.ca(v_rol.usr);
    select app.has_permission(v_org, 'vehicles', 'export')::text into v_r;
    reset role;
    if v_r is distinct from v_rol.asteptat then
      v_ok := false;
      raise warning '  · (1) vehicles:export pentru % = % (așteptat %)', v_rol.usr, v_r, v_rol.asteptat;
    end if;
  end loop;
  if v_ok then
    raise notice '  ✓ (1) vehicles:export: administratorul all; managerul, hr și angajatul none';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) matricea vehicles:export nu e cea din seed';
  end if;

  -- (2) poarta paginii: vehicles:read și trip_sheets:read, ambele `all`
  v_s := 0;
  v_ok := true;
  for v_rol in
    select * from (values
      (v_u_adm, true), (v_u_mgr, false), (v_u_hr, false), (v_u_a, false)
    ) as t(usr, asteptat)
  loop
    perform pg_temp.ca(v_rol.usr);
    select (app.has_permission(v_org, 'vehicles', 'read') = 'all'
        and app.has_permission(v_org, 'trip_sheets', 'read') = 'all') into v_ok;
    reset role;
    if v_ok is distinct from v_rol.asteptat then
      v_s := v_s + 1;
      raise warning '  · (2) poarta rapoartelor pentru % = % (așteptat %)', v_rol.usr, v_ok, v_rol.asteptat;
    end if;
  end loop;
  perform pg_temp.ca(v_u_mgr);
  select app.has_permission(v_org, 'vehicles', 'read')::text || '/' ||
         app.has_permission(v_org, 'trip_sheets', 'read')::text into v_r;
  reset role;
  if v_s = 0 and v_r = 'team/team' then
    raise notice '  ✓ (2) poarta rapoartelor trece doar administratorul; managerul are % (parțial)', v_r;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) poarta: % porți greșite, manager=% (team/team)', v_s, v_r;
  end if;

  -- ═══ Citirile raportului, ca administrator ════════════════════════════════

  perform pg_temp.ca(v_u_adm);
  v_n := pg_temp.cate(format(
    $q$select 1 from public.trip_sheets where organization_id = %L and status = 'aprobat'
         and deleted_at is null and data between %L and %L$q$, v_org, v_luna, v_la));
  v_s := pg_temp.suma(format(
    $q$select sum(km_parcursi) from public.trip_sheets where organization_id = %L and status = 'aprobat'
         and deleted_at is null and data between %L and %L$q$, v_org, v_luna, v_la));
  v_s2 := pg_temp.suma(format(
    $q$select sum(f.litri) from public.trip_sheets t join public.fuel_entries f on f.trip_sheet_id = t.id
        where t.organization_id = %L and t.status = 'aprobat' and t.deleted_at is null
          and f.deleted_at is null and t.data between %L and %L$q$, v_org, v_luna, v_la));
  v_k := pg_temp.cate(format(
    $q$select 1 from public.trip_sheets where organization_id = %L and status in ('draft','trimis','respins')
         and deleted_at is null and data between %L and %L$q$, v_org, v_luna, v_la));
  reset role;
  if v_n = 3 and v_s = 600 and v_s2 = 60 and v_k = 1 then
    raise notice '  ✓ (3a) administratorul vede 3 foi aprobate (600 km, 60 l) și 1 neaprobată';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3a) foi=% (3), km=% (600), litri=% (60), neaprobate=% (1)', v_n, v_s, v_s2, v_k;
  end if;

  perform pg_temp.ca(v_u_adm);
  v_s  := pg_temp.suma(format(
    $q$select sum(cost_total) from public.vehicle_service_entries where organization_id = %L
         and deleted_at is null and data_interventiei between %L and %L$q$, v_org, v_luna, v_la));
  v_s2 := pg_temp.suma(format(
    $q$select sum(suma) from public.vehicle_expenses where organization_id = %L
         and deleted_at is null and data_cheltuielii between %L and %L$q$, v_org, v_luna, v_la));
  v_n  := pg_temp.suma(format(
    $q$select sum(cost) from public.vehicle_documents where organization_id = %L and deleted_at is null
         and cost is not null and valabil_de_la between %L and %L$q$, v_org, v_luna, v_la));
  reset role;
  if v_s = 750 and v_s2 = 15 and v_n = 100 then
    raise notice '  ✓ (3b) administratorul vede service-ul (750), cheltuielile (15) și documentele cu cost (100)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3b) service=% (750), cheltuieli=% (15), documente=% (100)', v_s, v_s2, v_n;
  end if;

  -- (3c) ce adaugă pachetul lunar peste raport: cursele și alimentările foilor (embed-urile
  -- `curse:trip_sheet_curse` și `alimentari:fuel_entries`) și numele șoferilor. Fără ele,
  -- PDF-urile din arhivă ar ieși goale, fără nicio eroare.
  perform pg_temp.ca(v_u_adm);
  v_n  := pg_temp.cate(format(
    $q$select 1 from public.trip_sheet_curse c join public.trip_sheets t on t.id = c.trip_sheet_id
        where t.organization_id = %L and t.status = 'aprobat' and t.deleted_at is null
          and c.deleted_at is null and t.data between %L and %L$q$, v_org, v_luna, v_la));
  v_n2 := pg_temp.cate(format(
    $q$select 1 from public.fuel_entries f join public.trip_sheets t on t.id = f.trip_sheet_id
        where t.organization_id = %L and t.status = 'aprobat' and t.deleted_at is null
          and f.deleted_at is null and t.data between %L and %L$q$, v_org, v_luna, v_la));
  v_k  := pg_temp.cate(format(
    'select 1 from public.employees where organization_id = %L and id in (%L, %L, %L)',
    v_org, v_e_a, v_e_b, v_e_c));
  reset role;
  if v_n = 3 and v_n2 = 3 and v_k = 3 then
    raise notice '  ✓ (3c) administratorul vede cursele (3), alimentările (3) și fișele celor 3 șoferi: pachetul are cu ce umple PDF-urile';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3c) curse=% (3), alimentări=% (3), șoferi=% (3)', v_n, v_n2, v_k;
  end if;

  -- (4) fără filtru de firmă: administratorul tot nu vede nimic din cealaltă
  perform pg_temp.ca(v_u_adm);
  v_n  := pg_temp.cate(format(
    $q$select 1 from public.trip_sheets where status = 'aprobat' and deleted_at is null
         and data between %L and %L$q$, v_luna, v_la));
  v_n2 := pg_temp.cate(format(
    $q$select 1 from public.vehicle_service_entries where deleted_at is null
         and data_interventiei between %L and %L$q$, v_luna, v_la));
  reset role;
  if v_n = 3 and v_n2 = 1 then
    raise notice '  ✓ (4) fără filtru de firmă, administratorul vede tot 3 foi și 1 intervenție: nimic din cealaltă firmă';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) foi=% (3), intervenții=% (1) fără filtru de firmă', v_n, v_n2;
  end if;

  -- (5) managerul: doar echipa lui — un raport pe drepturile lui ar fi parțial, fără eroare
  perform pg_temp.ca(v_u_mgr);
  v_n  := pg_temp.cate(format(
    $q$select 1 from public.trip_sheets where organization_id = %L and status = 'aprobat'
         and deleted_at is null and data between %L and %L$q$, v_org, v_luna, v_la));
  v_s  := pg_temp.suma(format(
    $q$select sum(km_parcursi) from public.trip_sheets where organization_id = %L and status = 'aprobat'
         and deleted_at is null and data between %L and %L$q$, v_org, v_luna, v_la));
  v_n2 := pg_temp.cate(format('select 1 from public.vehicles where organization_id = %L and deleted_at is null', v_org));
  reset role;
  if v_n = 2 and v_s = 300 and v_n2 = 2 then
    raise notice '  ✓ (5) managerul vede 2 foi din 3 (300 km din 600) și 2 vehicule din 3: raportul lui ar fi parțial, fără nicio eroare';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) manager: foi=% (2), km=% (300), vehicule=% (2)', v_n, v_s, v_n2;
  end if;

  -- (6a) angajatul (Ana): doar foaia ei aprobată
  perform pg_temp.ca(v_u_a);
  v_n := pg_temp.cate(format(
    $q$select 1 from public.trip_sheets where organization_id = %L and status = 'aprobat'
         and deleted_at is null and data between %L and %L$q$, v_org, v_luna, v_la));
  reset role;
  if v_n = 1 then
    raise notice '  ✓ (6a) angajatul vede o singură foaie aprobată, a lui';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6a) angajatul vede % foi aprobate (1)', v_n;
  end if;

  -- (6b) hr: zero rânduri peste tot, fără eroare
  perform pg_temp.ca(v_u_hr);
  v_n := pg_temp.cate(format('select 1 from public.trip_sheets where organization_id = %L', v_org))
       + pg_temp.cate(format('select 1 from public.vehicles where organization_id = %L', v_org))
       + pg_temp.cate(format('select 1 from public.vehicle_service_entries where organization_id = %L', v_org))
       + pg_temp.cate(format('select 1 from public.vehicle_expenses where organization_id = %L', v_org))
       + pg_temp.cate(format('select 1 from public.vehicle_documents where organization_id = %L', v_org));
  reset role;
  if v_n = 0 then
    raise notice '  ✓ (6b) hr nu vede nicio foaie, niciun vehicul, nicio intervenție, cheltuială sau document (zero rânduri, fără eroare)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6b) hr vede % rânduri din flotă (0)', v_n;
  end if;

  -- (6c) angajatul fără foi în lună (Cristi are una; Bogdan o are pe a lui) — angajatul
  -- nu vede service-ul, cheltuielile și documentele nimănui
  perform pg_temp.ca(v_u_b);
  v_n := pg_temp.cate(format('select 1 from public.vehicle_service_entries where organization_id = %L', v_org))
       + pg_temp.cate(format('select 1 from public.vehicle_expenses where organization_id = %L', v_org));
  reset role;
  if v_n = 0 then
    raise notice '  ✓ (6c) angajatul nu vede intervențiile și cheltuielile flotei (zero rânduri)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6c) angajatul vede % rânduri de service/cheltuieli (0)', v_n;
  end if;

  -- (7) administratorul celeilalte firme: doar ale lui
  perform pg_temp.ca(v_u_adm2);
  v_n  := pg_temp.cate(format(
    $q$select 1 from public.trip_sheets where status = 'aprobat' and deleted_at is null
         and data between %L and %L$q$, v_luna, v_la));
  v_s  := pg_temp.suma(format(
    $q$select sum(cost_total) from public.vehicle_service_entries where deleted_at is null
         and data_interventiei between %L and %L$q$, v_luna, v_la));
  reset role;
  if v_n = 1 and v_s = 999 then
    raise notice '  ✓ (7) administratorul celeilalte firme vede 1 foaie și 999 lei service: doar ale lui';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) altă firmă: foi=% (1), service=% (999)', v_n, v_s;
  end if;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA FLOTA RAPOARTE: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE verificările au trecut.';
  raise notice '';
end;
$$;
