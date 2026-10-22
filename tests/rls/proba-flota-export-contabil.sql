-- tests/rls/proba-flota-export-contabil.sql
--
-- FLOTA, F12g: EXPORTUL CONTABIL (SAGA / WINMENTOR), PE SEED-UL REAL.
--
-- F12g nu are migrare și nu scrie nimic în bază: citește alimentările, cheltuielile,
-- intervențiile, regimurile fiscale (F10) și legăturile cu cardul de flotă (F12b)
-- prin RLS-ul utilizatorului. Ruta cere `vehicles:export`, `vehicles:read` și
-- `trip_sheets:read`, toate la `all` (L15). Proba arată de ce, pe rânduri NUMĂRATE:
-- cu orice altceva, exportul ar fi ieșit PARȚIAL, fără nicio eroare.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
--  (1) matricea reală a cheilor: `vehicles:export` = all doar la administrator;
--      poarta rutei (export ȘI vehicles:read ȘI trip_sheets:read la all) trece
--      doar administratorul;
--  (2) administratorul numără 4 alimentări în luna din ORA ROMÂNIEI (470 lei, trei
--      șoferi), inclusiv cea din ultima zi la 23:30; cea din prima zi a lunii
--      următoare la 00:30 rămâne afară — o fereastră în UTC ar fi luat-o (5)  [POZITIVĂ];
--  (3) administratorul vede, pe aceleași alimentări, foaia și vehiculul (embed-ul
--      nu vine NULL), cheltuiala (15), intervenția (750), regimul fiscal (1) și
--      tranzacția de card legată de o alimentare a lunii, deși tranzacția e din
--      luna DINAINTE: legătura se citește după `fuel_entry_id`        [POZITIVĂ];
--  (4) managerul: 2 alimentări din 4, 2 vehicule din 3, nicio tranzacție de card,
--      niciun regim fiscal — un export pe drepturile lui ar fi pierdut tăcut un
--      șofer, ar fi pus în note bonul plătit cu cardul și ar fi dedus TVA-ul cu
--      regimul implicit;
--  (5) angajatul: doar alimentarea lui, nicio tranzacție, niciun regim;
--  (6) hr: zero rânduri peste tot (alimentări, cheltuieli, intervenții, card,
--      regimuri), fără eroare;
--  (7) izolarea: administratorul firmei A nu vede nimic din firma B (nici fără
--      filtru de firmă), iar administratorul lui B își vede doar alimentarea lui;
--  (8) rândul firmei (CIF, plătitor de TVA) se citește doar pentru firma proprie.
--
-- `super_admin` nu intră: nu e în `organization_members` (sursa e
-- `platform_admins`), iar ruta îl oprește la `resolveTenant`. Proba de scriere
-- reală pe roluri nu are obiect: F12g nu scrie nimic.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud), într-o tranzacție derulată înapoi:
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

begin;

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

-- Momentul `zi` + `ora` în ora României.
create function pg_temp.la(p_zi date, p_ora text) returns timestamptz language sql immutable as $f$
  select (p_zi::timestamp + p_ora::interval) at time zone 'Europe/Bucharest';
$f$;

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_azi      date := app.azi_local();
  -- Luna anterioară: ferestrele sunt aceleași în orice zi a rulării.
  v_luna     date := (date_trunc('month', app.azi_local()) - interval '1 month')::date;
  v_ultima   date := (date_trunc('month', app.azi_local()) - interval '1 day')::date;
  v_urm      date := date_trunc('month', app.azi_local())::date;
  v_de_la    timestamptz;
  v_pana     timestamptz;
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
  v_lot      uuid := gen_random_uuid();
  v_foaie    uuid;
  v_alim_b   uuid;
  v_alim     uuid;
  v_n        bigint;
  v_n2       bigint;
  v_n3       bigint;
  v_n4       bigint;
  v_n5       bigint;
  v_s        numeric;
  v_r        text;
  v_esecuri  int := 0;
  v_ok       boolean;
  v_poarta   boolean;
  v_rol      record;
  -- Fereastra lunii și filtrul pe firmă, ca text, pentru `pg_temp.cate`.
  v_luna_sql text;
begin
  raise notice '';
  raise notice '  PROBA „FLOTA — EXPORT CONTABIL" (F12g, fără migrare)';
  raise notice '  ─────────────────────────────────────────────────────────';

  v_de_la := v_luna::timestamp at time zone 'Europe/Bucharest';
  v_pana  := v_urm::timestamp at time zone 'Europe/Bucharest';
  v_luna_sql := format('alimentat_la >= %L and alimentat_la < %L', v_de_la, v_pana);

  insert into public.organizations (id, slug, name, cui) values
    (v_org,  'proba-fec-' || v_sufix,  'Proba Export Contabil SRL',
     'RO' || (93000000 + (random() * 900000)::int)::text),
    (v_org2, 'proba-fec2-' || v_sufix, 'Proba Export Contabil Doi SRL',
     'RO' || (94000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select o, f.feature_key, true, now()
    from public.features f, unnest(array[v_org, v_org2]) as o;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_adm,  'fec-adm-'  || v_sufix || '@proba.test', now()),
    (v_u_mgr,  'fec-mgr-'  || v_sufix || '@proba.test', now()),
    (v_u_a,    'fec-a-'    || v_sufix || '@proba.test', now()),
    (v_u_b,    'fec-b-'    || v_sufix || '@proba.test', now()),
    (v_u_c,    'fec-c-'    || v_sufix || '@proba.test', now()),
    (v_u_hr,   'fec-hr-'   || v_sufix || '@proba.test', now()),
    (v_u_adm2, 'fec-adm2-' || v_sufix || '@proba.test', now());
  -- Fișele ÎNAINTEA rândurilor de membru (0083 îi creează singur administratorului o fișă).
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_adm,  v_org,  'FEC-ADM', 'Ioana', 'Administrator', v_azi - 900, 'activ', v_u_adm,  null),
    (v_e_mgr,  v_org,  'FEC-M',   'Mihai', 'Manager',       v_azi - 500, 'activ', v_u_mgr,  null),
    (v_e_hr,   v_org,  'FEC-HR',  'Elena', 'Personal',      v_azi - 500, 'activ', v_u_hr,   null),
    (v_e_c,    v_org,  'FEC-C',   'Cristi','Străin',        v_azi - 400, 'activ', v_u_c,    null),
    (v_e_adm2, v_org2, 'FEC-AD2', 'Radu',  'Altă Firmă',    v_azi - 900, 'activ', v_u_adm2, null);
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_a, v_org, 'FEC-A', 'Ana',    'Șofer', v_azi - 400, 'activ', v_u_a, v_e_mgr),
    (v_e_b, v_org, 'FEC-B', 'Bogdan', 'Șofer', v_azi - 400, 'activ', v_u_b, v_e_mgr);
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
    (v_va, v_org,  'B' || (100 + (random() * 800)::int)::text || 'FCA', 'Dacia', 'Logan',  10000, v_u_adm,  v_u_adm),
    (v_vb, v_org,  'B' || (100 + (random() * 800)::int)::text || 'FCB', 'Dacia', 'Duster', 20000, v_u_adm,  v_u_adm),
    (v_vc, v_org,  'B' || (100 + (random() * 800)::int)::text || 'FCC', 'Skoda', 'Octavia',30000, v_u_adm,  v_u_adm),
    (v_v2, v_org2, 'B' || (100 + (random() * 800)::int)::text || 'FC2', 'Dacia', 'Spring',  5000, v_u_adm2, v_u_adm2);
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, created_by, updated_by) values
    (v_org,  v_va, v_e_a,    now() - interval '120 days', v_u_adm,  v_u_adm),
    (v_org,  v_vb, v_e_b,    now() - interval '120 days', v_u_adm,  v_u_adm),
    (v_org,  v_vc, v_e_c,    now() - interval '120 days', v_u_adm,  v_u_adm),
    (v_org2, v_v2, v_e_adm2, now() - interval '120 days', v_u_adm2, v_u_adm2);

  -- ═══ Foile lunii anterioare, aprobate de administrator ════════════════════
  -- Ana (70 lei), Bogdan (140), Cristi (210 în ziua 3 și 50 în ultima zi, la 23:30).
  for v_rol in
    select * from (values
      (v_va, v_e_a, v_u_a, v_luna,     '08:00', '12:00', '09:00', 10000, 100, 70.00,  v_org, v_u_adm),
      (v_vb, v_e_b, v_u_b, v_luna + 1, '08:00', '12:00', '09:00', 20000, 200, 140.00, v_org, v_u_adm),
      (v_vc, v_e_c, v_u_c, v_luna + 2, '08:00', '12:00', '09:00', 30000, 300, 210.00, v_org, v_u_adm),
      (v_vc, v_e_c, v_u_c, v_ultima,   '22:00', '23:50', '23:30', 30300, 50,  50.00,  v_org, v_u_adm),
      (v_v2, v_e_adm2, v_u_adm2, v_luna + 1, '08:00', '10:00', '09:00', 5000, 50, 99.00, v_org2, v_u_adm2)
    ) as t(veh, ang, usr, zi, pleaca, ajunge, alim, km0, km, cost, org, aprobator)
  loop
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                    created_by, updated_by)
    values (v_rol.org, v_rol.veh, v_rol.ang, pg_temp.la(v_rol.zi, v_rol.pleaca), v_rol.km0,
            v_rol.usr, v_rol.usr)
    returning id into v_foaie;
    insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la,
                                         de_la_loc, pana_la_loc, scop, km_plecare, km_sosire,
                                         created_by, updated_by)
    values (v_rol.org, v_foaie, pg_temp.la(v_rol.zi, v_rol.pleaca), pg_temp.la(v_rol.zi, v_rol.ajunge),
            'Sediu', 'Client', 'Livrare', v_rol.km0, v_rol.km0 + v_rol.km, v_rol.usr, v_rol.usr);
    insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la,
                                     numar_bon, statie, created_by, updated_by)
    values (v_rol.org, v_foaie, v_rol.km / 10.0, v_rol.cost, pg_temp.la(v_rol.zi, v_rol.alim),
            '10' || v_rol.km::text, 'Stația de probă', v_rol.usr, v_rol.usr)
    returning id into v_alim;
    if v_rol.veh = v_vb then v_alim_b := v_alim; end if;
    update public.trip_sheets set status = 'trimis', updated_by = v_rol.usr where id = v_foaie;
    -- În firma A aprobă administratorul, pe calea reală. În firma B singurul cont e
    -- chiar șoferul, iar o foaie nu se autoaprobă: acolo aprobă contextul probei.
    if v_rol.org = v_org then perform pg_temp.ca(v_rol.aprobator); end if;
    update public.trip_sheets set status = 'aprobat', updated_by = v_rol.aprobator where id = v_foaie;
    get diagnostics v_n = row_count;
    reset role;
    if v_n <> 1 then
      raise exception 'proba: foaia din % (%) nu s-a aprobat (% rânduri)', v_rol.zi, v_rol.pleaca, v_n;
    end if;
  end loop;

  -- Cristi, prima zi a lunii CURENTE la 00:30, ora României: în afara lunii. În UTC
  -- e încă ultima zi a lunii anterioare, deci o fereastră pe UTC ar fi luat-o.
  insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                  created_by, updated_by)
  values (v_org, v_vc, v_e_c, pg_temp.la(v_urm, '00:10'), 30350, v_u_c, v_u_c)
  returning id into v_foaie;
  insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la,
                                       de_la_loc, pana_la_loc, scop, km_plecare, km_sosire,
                                       created_by, updated_by)
  values (v_org, v_foaie, pg_temp.la(v_urm, '00:10'), pg_temp.la(v_urm, '01:00'),
          'Sediu', 'Depozit', 'Livrare', 30350, 30380, v_u_c, v_u_c);
  insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la,
                                   created_by, updated_by)
  values (v_org, v_foaie, 4, 30, pg_temp.la(v_urm, '00:30'), v_u_c, v_u_c);

  -- Service pe VA (750) și cheltuială pe VC (15), în lună; regimul fiscal al lui VA.
  insert into public.vehicle_service_entries
    (organization_id, vehicle_id, data_interventiei, km, tip, descriere, cost_piese, cost_manopera,
     furnizor, numar_factura, created_by, updated_by)
  values (v_org, v_va, v_luna + 9, 10100, 'revizie', 'Ulei, filtre', 300, 450,
          'Service Probă SRL', 'F-1', v_u_adm, v_u_adm);
  insert into public.vehicle_expenses
    (organization_id, vehicle_id, categorie, data_cheltuielii, suma, created_by, updated_by)
  values (v_org, v_vc, 'parcare', v_luna + 10, 15, v_u_adm, v_u_adm);
  insert into public.vehicle_fiscal_regimes (organization_id, vehicle_id, valabil_de_la, regim, motiv,
                                             created_by, updated_by)
  values (v_org, v_va, v_luna - 30, 'limitat_50', 'Folosit și în interes personal', v_u_adm, v_u_adm);

  -- Cardul de flotă (F12b): o tranzacție din luna DINAINTE, legată de alimentarea lui Bogdan.
  insert into public.fuel_card_imports (id, organization_id, emitent, fisier_nume, fisier_sha256,
                                        perioada_de_la, perioada_pana_la, randuri_fisier,
                                        created_by, updated_by)
  values (v_lot, v_org, 'omv_petrom', 'extras.csv', repeat('b', 64), v_luna - 31, v_luna - 1, 1,
          v_u_adm, v_u_adm);
  insert into public.fuel_card_transactions (organization_id, import_id, emitent, cheie_dedup,
                                             rand_fisier, efectuat_la, produs, categorie,
                                             valoare_bruta, fuel_entry_id, stare_potrivire,
                                             created_by, updated_by)
  values (v_org, v_lot, 'omv_petrom', 'h:proba#1', 2, pg_temp.la(v_luna - 1, '23:50'), 'Motorină',
          'combustibil', 140, v_alim_b, 'potrivita', v_u_adm, v_u_adm);

  -- ═══ (1) Cheile, pe matricea reală ═══════════════════════════════════════
  v_ok := true;
  for v_rol in
    select * from (values
      (v_u_adm, 'all', true), (v_u_mgr, 'none', false), (v_u_hr, 'none', false), (v_u_a, 'none', false)
    ) as t(usr, export, poarta)
  loop
    perform pg_temp.ca(v_rol.usr);
    select app.has_permission(v_org, 'vehicles', 'export')::text,
           (app.has_permission(v_org, 'vehicles', 'export') = 'all'
            and app.has_permission(v_org, 'vehicles', 'read') = 'all'
            and app.has_permission(v_org, 'trip_sheets', 'read') = 'all')
      into v_r, v_poarta;
    reset role;
    if v_r is distinct from v_rol.export or v_poarta is distinct from v_rol.poarta then
      v_ok := false;
      raise warning '  · (1) %: export=% (așteptat %), poarta=% (așteptat %)',
        v_rol.usr, v_r, v_rol.export, v_poarta, v_rol.poarta;
    end if;
  end loop;
  if v_ok then
    raise notice '  ✓ (1) vehicles:export = all și poarta rutei: doar administratorul; managerul, hr și angajatul nu';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) matricea cheilor nu e cea așteptată';
  end if;

  -- ═══ (2) Administratorul: luna, în ora României ══════════════════════════
  perform pg_temp.ca(v_u_adm);
  v_n := pg_temp.cate(format('select 1 from public.fuel_entries where organization_id = %L and deleted_at is null and %s',
                             v_org, v_luna_sql));
  v_s := pg_temp.suma(format('select sum(cost) from public.fuel_entries where organization_id = %L and deleted_at is null and %s',
                             v_org, v_luna_sql));
  v_n2 := pg_temp.cate(format(
    $q$select 1 from public.fuel_entries where organization_id = %L and deleted_at is null
         and alimentat_la >= %L and alimentat_la < %L$q$,
    v_org, v_luna::timestamp at time zone 'UTC', v_urm::timestamp at time zone 'UTC'));
  v_n3 := pg_temp.cate(format(
    $q$select distinct t.employee_id from public.fuel_entries f join public.trip_sheets t on t.id = f.trip_sheet_id
        where f.organization_id = %L and f.deleted_at is null and f.%s$q$, v_org, v_luna_sql));
  reset role;
  if v_n = 4 and v_s = 470 and v_n2 = 5 and v_n3 = 3 then
    raise notice '  ✓ (2) administratorul: 4 alimentări (470 lei, 3 șoferi) în luna din ora României; fereastra în UTC ar fi luat 5';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) alimentări=% (4), lei=% (470), în UTC=% (5), șoferi=% (3)', v_n, v_s, v_n2, v_n3;
  end if;

  -- ═══ (3) Administratorul: embed-urile și celelalte surse ═════════════════
  perform pg_temp.ca(v_u_adm);
  v_n := pg_temp.cate(format(
    $q$select 1 from public.fuel_entries f
         join public.trip_sheets t on t.id = f.trip_sheet_id
         join public.vehicles v on v.id = t.vehicle_id
        where f.organization_id = %L and f.deleted_at is null and f.%s$q$, v_org, v_luna_sql));
  v_s := pg_temp.suma(format(
    $q$select sum(suma) from public.vehicle_expenses where organization_id = %L and deleted_at is null
         and data_cheltuielii between %L and %L$q$, v_org, v_luna, v_ultima))
       + pg_temp.suma(format(
    $q$select sum(cost_total) from public.vehicle_service_entries where organization_id = %L and deleted_at is null
         and data_interventiei between %L and %L$q$, v_org, v_luna, v_ultima));
  v_n2 := pg_temp.cate(format(
    $q$select 1 from public.vehicle_fiscal_regimes where organization_id = %L and deleted_at is null
         and vehicle_id = %L and valabil_de_la <= %L$q$, v_org, v_va, v_ultima));
  v_n3 := pg_temp.cate(format(
    $q$select 1 from public.fuel_card_transactions where organization_id = %L and deleted_at is null
         and stare_potrivire in ('potrivita', 'diferenta')
         and fuel_entry_id in (select id from public.fuel_entries where organization_id = %L and %s)$q$,
    v_org, v_org, v_luna_sql));
  v_n4 := pg_temp.cate(format(
    $q$select 1 from public.fuel_card_transactions where organization_id = %L and deleted_at is null
         and efectuat_la >= %L and efectuat_la < %L$q$, v_org, v_de_la, v_pana));
  reset role;
  if v_n = 4 and v_s = 765 and v_n2 = 1 and v_n3 = 1 and v_n4 = 0 then
    raise notice '  ✓ (3) administratorul: foaia și vehiculul pe toate cele 4, cheltuieli + service 765 lei, 1 regim fiscal, 1 tranzacție de card legată (din luna dinainte: după lună ar fi fost 0)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) cu foaie și vehicul=% (4), cheltuieli+service=% (765), regimuri=% (1), card legat=% (1), card după lună=% (0)',
      v_n, v_s, v_n2, v_n3, v_n4;
  end if;

  -- ═══ (4) Managerul: ce ar fi pierdut tăcut exportul fără poarta `all` ════
  perform pg_temp.ca(v_u_mgr);
  v_n := pg_temp.cate(format('select 1 from public.fuel_entries where organization_id = %L and deleted_at is null and %s',
                             v_org, v_luna_sql));
  v_n2 := pg_temp.cate(format('select 1 from public.vehicles where organization_id = %L and deleted_at is null', v_org));
  v_n3 := pg_temp.cate(format('select 1 from public.fuel_card_transactions where organization_id = %L', v_org));
  v_n4 := pg_temp.cate(format('select 1 from public.vehicle_fiscal_regimes where organization_id = %L', v_org));
  reset role;
  if v_n = 2 and v_n2 = 2 and v_n3 = 0 and v_n4 = 0 then
    raise notice '  ✓ (4) managerul: 2 alimentări din 4, 2 vehicule din 3, 0 tranzacții de card, 0 regimuri — exportul lui ar fi fost parțial, fără eroare';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) manager: alimentări=% (2), vehicule=% (2), card=% (0), regimuri=% (0)', v_n, v_n2, v_n3, v_n4;
  end if;

  -- ═══ (5) Angajatul (Ana): doar alimentarea lui ═══════════════════════════
  perform pg_temp.ca(v_u_a);
  v_n := pg_temp.cate(format('select 1 from public.fuel_entries where organization_id = %L and deleted_at is null and %s',
                             v_org, v_luna_sql));
  v_n2 := pg_temp.cate(format('select 1 from public.fuel_card_transactions where organization_id = %L', v_org))
        + pg_temp.cate(format('select 1 from public.vehicle_fiscal_regimes where organization_id = %L', v_org));
  reset role;
  if v_n = 1 and v_n2 = 0 then
    raise notice '  ✓ (5) angajatul: 1 alimentare din 4 (a lui), nicio tranzacție de card, niciun regim';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) angajat: alimentări=% (1), card+regimuri=% (0)', v_n, v_n2;
  end if;

  -- ═══ (6) hr: zero rânduri, fără eroare ═══════════════════════════════════
  perform pg_temp.ca(v_u_hr);
  v_n := pg_temp.cate(format('select 1 from public.fuel_entries where organization_id = %L', v_org))
       + pg_temp.cate(format('select 1 from public.vehicle_expenses where organization_id = %L', v_org))
       + pg_temp.cate(format('select 1 from public.vehicle_service_entries where organization_id = %L', v_org))
       + pg_temp.cate(format('select 1 from public.fuel_card_transactions where organization_id = %L', v_org))
       + pg_temp.cate(format('select 1 from public.vehicle_fiscal_regimes where organization_id = %L', v_org));
  reset role;
  if v_n = 0 then
    raise notice '  ✓ (6) hr: zero alimentări, cheltuieli, intervenții, tranzacții și regimuri (fără eroare)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) hr vede % rânduri (0)', v_n;
  end if;

  -- ═══ (7) Izolarea între firme ════════════════════════════════════════════
  perform pg_temp.ca(v_u_adm);
  v_n := pg_temp.cate(format('select 1 from public.fuel_entries where organization_id = %L', v_org2));
  v_n2 := pg_temp.cate(format('select 1 from public.fuel_entries where deleted_at is null and %s', v_luna_sql));
  reset role;
  perform pg_temp.ca(v_u_adm2);
  v_n3 := pg_temp.cate(format('select 1 from public.fuel_entries where deleted_at is null and %s', v_luna_sql));
  v_s := pg_temp.suma(format('select sum(cost) from public.fuel_entries where deleted_at is null and %s', v_luna_sql));
  reset role;
  if v_n = 0 and v_n2 = 4 and v_n3 = 1 and v_s = 99 then
    raise notice '  ✓ (7) administratorul lui A: 0 alimentări ale lui B și 4 fără filtru de firmă; administratorul lui B: doar a lui (99 lei)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) A vede din B=% (0), A fără filtru=% (4), B=% (1), lei B=% (99)', v_n, v_n2, v_n3, v_s;
  end if;

  -- ═══ (8) Rândul firmei: CIF-ul și TVA-ul, doar pentru firma proprie ══════
  perform pg_temp.ca(v_u_adm);
  v_n := pg_temp.cate(format('select cui_normalizat, platitor_tva from public.organizations where id = %L', v_org));
  v_n2 := pg_temp.cate(format('select cui_normalizat from public.organizations where id = %L', v_org2));
  reset role;
  if v_n = 1 and v_n2 = 0 then
    raise notice '  ✓ (8) administratorul își citește CIF-ul și TVA-ul firmei; pe ale celeilalte firme, nu';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) firma proprie=% (1), cealaltă=% (0)', v_n, v_n2;
  end if;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA FLOTA EXPORT CONTABIL: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE verificările au trecut.';
  raise notice '';
end;
$$;

rollback;
