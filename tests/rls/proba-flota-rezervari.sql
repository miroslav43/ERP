-- tests/rls/proba-flota-rezervari.sql
--
-- FLOTA, DUPĂ 0216 (F12d): REZERVĂRILE MAȘINILOR DE POOL.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- Numerotarea urmează specificația F12d („Probă SQL”), plus (26)–(30) pe roluri.
-- Rânduri NUMĂRATE: un UPDATE respins de USING nu ridică eroare, deci „n-a dat
-- eroare” nu dovedește nimic.
--  (1)  employee A rezervă pool-ul pentru mâine, fără employee_id           [POZITIVĂ]
--  (2)  employee A rezervă o mașină care nu e pool: P0001
--  (3)  employee A rezervă pentru colegul B: 42501
--  (4)  employee B rezervă aceleași zile: 23P01
--  (5)  aprobarea pornită: cererea lui B e `ceruta`; managerul direct
--       primește exact o notificare                                       [POZITIVĂ]
--  (6)  managerul aprobă cererea subordonatului                            [POZITIVĂ]
--  (7)  managerul nu-și aprobă propria cerere: P0001
--  (8)  angajatul nu-și pune singur `confirmata`: P0001
--  (9)  A își anulează rezervarea (1 rând); B n-o poate anula (0 rânduri)   [POZITIVĂ / 0]
--  (10) foaia lui C într-o zi rezervată de B: P0001
--  (11) foaia lui B în ziua rezervată se leagă de rezervare                [POZITIVĂ]
--  (12) anulare cu foaie: P0001; scurtare sub foaie: P0001; scurtare validă [POZITIVĂ]
--  (13) alocare peste rezervarea altuia: P0001
--  (14) ieșirea din pool anulează rezervările viitoare fără foaie, cu
--       notificare; cea cu foaie rămâne                                   [POZITIVĂ]
--  (15) hr: 0 rânduri la citire și la ocupare; 42501 la scriere
--  (16) rezervarea obligatorie: C fără rezervare P0001; org_admin pentru C  [POZITIVĂ]
--  (17) angajatul altei firme: 0 rânduri, inclusiv prin RPC
--  (18) ocuparea pentru C arată intervalul lui B fără identitate           [POZITIVĂ]
--  (19) prelungire, durată peste maxim, început în trecut: P0001 × 3
--  (20) org_admin rezervă pentru A: confirmată direct, A e anunțat         [POZITIVĂ]
--  (21) managerul nu rezervă pentru subordonat: 42501
--  (22) managerul anulează, cu motiv, rezervarea subordonatului            [POZITIVĂ]
--  (23) ștergerea logică directă: P0001; rândul rămâne în EXCLUDE
--  (24) foaia respinsă redeschisă după ce ziua a fost rezervată: P0001
--  (25) responsabil fără approve = all și fără manager direct: plasa
--       notifică fiecare org_admin                                         [POZITIVĂ]
--  (26) super_admin vede rezervările firmei, nu scrie                     [POZITIVĂ / 42501]
--  (27) managerul vede ale lui și ale echipei, nu ale altora              [POZITIVĂ / 0]
--  (28) angajatul vede doar ale lui                                       [POZITIVĂ / 0]
--  (29) org_admin decide cererea oricui; respingerea cere motiv            [POZITIVĂ]
--  (30) imuabilitatea: vehiculul, prima zi și scopul nu se rescriu: P0001
--  (31) foaia NELEGATĂ a omului (făcută cât rezervarea era `ceruta`): scurtarea
--       sub ea și anularea dau P0001, ieșirea din pool păstrează rezervarea
--  (32) ocuparea nu dă starea foilor colegilor și nu răspunde pentru zile
--       trecute; ocuparea de azi încolo rămâne vizibilă                    [POZITIVĂ / 0]
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

begin;

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_azi      date := app.azi_local();
  v_org      uuid := gen_random_uuid();
  v_org2     uuid := gen_random_uuid();
  v_u_admin  uuid := gen_random_uuid();
  v_u_admin2 uuid := gen_random_uuid();
  v_u_a      uuid := gen_random_uuid();
  v_u_b      uuid := gen_random_uuid();
  v_u_c      uuid := gen_random_uuid();
  v_u_d      uuid := gen_random_uuid();
  v_u_m      uuid := gen_random_uuid();
  v_u_m2     uuid := gen_random_uuid();
  v_u_hr     uuid := gen_random_uuid();
  v_u_x      uuid := gen_random_uuid();
  v_u_sa     uuid := gen_random_uuid();
  v_e_admin  uuid := gen_random_uuid();
  v_e_admin2 uuid := gen_random_uuid();
  v_e_a      uuid := gen_random_uuid();
  v_e_b      uuid := gen_random_uuid();
  v_e_c      uuid := gen_random_uuid();
  v_e_d      uuid := gen_random_uuid();
  v_e_m      uuid := gen_random_uuid();
  v_e_m2     uuid := gen_random_uuid();
  v_e_hr     uuid := gen_random_uuid();
  v_e_x      uuid := gen_random_uuid();
  v_p1       uuid := gen_random_uuid();
  v_p2       uuid := gen_random_uuid();
  v_p3       uuid := gen_random_uuid();
  v_p4       uuid := gen_random_uuid();
  v_n_veh    uuid := gen_random_uuid();
  v_px       uuid := gen_random_uuid();
  v_p5       uuid := gen_random_uuid();
  v_p6       uuid := gen_random_uuid();
  v_r_c5     uuid;
  v_foaie_c5 uuid;
  v_x        integer;
  v_r_a1     uuid;
  v_r_b      uuid;
  v_r_m      uuid;
  v_r_b2     uuid;
  v_r_a2     uuid;
  v_r_a_azi  uuid;
  v_r_c3     uuid;
  v_r_a10    uuid;
  v_r_d      uuid;
  v_r_c4     uuid;
  v_foaie_b  uuid;
  v_foaie_b2 uuid;
  v_foaie_b4 uuid;
  v_rand     record;
  v_n        integer;
  v_m        integer;
  v_k        integer;
  v_esecuri  int := 0;
  v_ok       int := 0;
  -- Ora României: 08:00, 09:00, 14:00, 15:00 ale unei zile date.
  c_ora      constant text := 'Europe/Bucharest';
begin
  raise notice '';
  raise notice '  PROBA „FLOTA — REZERVĂRILE MAȘINILOR DE POOL” (0216, F12d)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, legal_name, cui) values
    (v_org, 'proba-rez-' || v_sufix, 'Proba Rezervări', 'Proba Rezervări SRL',
     'RO' || (88000000 + (random() * 900000)::int)::text),
    (v_org2, 'proba-rez-alta-' || v_sufix, 'Altă Firmă Rezervări SRL', null,
     'RO' || (89000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select o, f.feature_key, true, now() from public.features f, unnest(array[v_org, v_org2]) o;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_admin,  'rez-adm-'  || v_sufix || '@proba.test', now()),
    (v_u_admin2, 'rez-adm2-' || v_sufix || '@proba.test', now()),
    (v_u_a,      'rez-a-'    || v_sufix || '@proba.test', now()),
    (v_u_b,      'rez-b-'    || v_sufix || '@proba.test', now()),
    (v_u_c,      'rez-c-'    || v_sufix || '@proba.test', now()),
    (v_u_d,      'rez-d-'    || v_sufix || '@proba.test', now()),
    (v_u_m,      'rez-m-'    || v_sufix || '@proba.test', now()),
    (v_u_m2,     'rez-m2-'   || v_sufix || '@proba.test', now()),
    (v_u_hr,     'rez-hr-'   || v_sufix || '@proba.test', now()),
    (v_u_x,      'rez-x-'    || v_sufix || '@proba.test', now()),
    (v_u_sa,     'rez-sa-'   || v_sufix || '@proba.test', now());
  insert into public.platform_admins (user_id) values (v_u_sa);

  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id) values
    (v_e_admin,  v_org,  'RZ-ADM',  'Adriana', 'Administrator', v_azi - 900, 'activ', v_u_admin),
    (v_e_admin2, v_org,  'RZ-ADM2', 'Aurel',   'Administrator', v_azi - 900, 'activ', v_u_admin2),
    (v_e_m,      v_org,  'RZ-M',    'Marin',   'Șef',           v_azi - 800, 'activ', v_u_m),
    (v_e_m2,     v_org,  'RZ-M2',   'Mihai',   'Alt Șef',       v_azi - 800, 'activ', v_u_m2),
    (v_e_hr,     v_org,  'RZ-HR',   'Hortensia', 'Resurse',     v_azi - 700, 'activ', v_u_hr),
    (v_e_a,      v_org,  'RZ-A',    'Ana',     'Șofer',         v_azi - 400, 'activ', v_u_a),
    (v_e_c,      v_org,  'RZ-C',    'Cristi',  'Șofer',         v_azi - 400, 'activ', v_u_c),
    (v_e_d,      v_org,  'RZ-D',    'Dana',    'Fără Șef',      v_azi - 400, 'activ', v_u_d),
    (v_e_x,      v_org2, 'RZ-X',    'Xenia',   'Străină',       v_azi - 400, 'activ', v_u_x);
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_b, v_org, 'RZ-B', 'Bogdan', 'Subordonat', v_azi - 400, 'activ', v_u_b, v_e_m);
  -- Membrii DUPĂ fișe: 0083 i-ar crea administratorului o fișă proprie, iar a
  -- doua fișă principală ar cădea pe `employees_org_user_primary_uniq`.
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org,  v_u_admin,  'org_admin'),
    (v_org,  v_u_admin2, 'org_admin'),
    (v_org,  v_u_a,      'employee'),
    (v_org,  v_u_b,      'employee'),
    (v_org,  v_u_c,      'employee'),
    (v_org,  v_u_d,      'employee'),
    (v_org,  v_u_m,      'manager'),
    (v_org,  v_u_m2,     'manager'),
    (v_org,  v_u_hr,     'hr'),
    (v_org2, v_u_x,      'employee');

  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent, categorie,
                               pool, created_by, updated_by) values
    (v_p1,    v_org,  'B' || (100 + (random() * 800)::int)::text || 'RZA', 'Dacia',  'Logan',   1000, 'autoturism', true,  v_u_admin, v_u_admin),
    (v_p2,    v_org,  'B' || (100 + (random() * 800)::int)::text || 'RZB', 'Skoda',  'Octavia', 2000, 'autoturism', true,  v_u_admin, v_u_admin),
    (v_p3,    v_org,  'B' || (100 + (random() * 800)::int)::text || 'RZC', 'Dacia',  'Jogger',  3000, 'autoturism', true,  v_u_admin, v_u_admin),
    (v_p4,    v_org,  'B' || (100 + (random() * 800)::int)::text || 'RZD', 'Renault','Clio',    4000, 'autoturism', true,  v_u_admin, v_u_admin),
    (v_n_veh, v_org,  'B' || (100 + (random() * 800)::int)::text || 'RZN', 'Ford',   'Focus',   5000, 'autoturism', false, v_u_admin, v_u_admin),
    (v_px,    v_org2, 'CJ' || (100 + (random() * 800)::int)::text || 'RZX', 'Dacia', 'Logan',   100,  'autoturism', true,  null, null);

  -- ── (1) employee A rezervă P1 pentru mâine, fără employee_id ──────────────
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_reservations (organization_id, vehicle_id, employee_id, de_la, pana_la, scop,
                                             created_by, updated_by)
    values (v_org, v_p1, null, v_azi + 1, v_azi + 1, 'Vizită la client', v_u_a, v_u_a)
    returning id into v_r_a1;
    reset role;
    select * into v_rand from public.vehicle_reservations where id = v_r_a1;
    if v_rand.employee_id = v_e_a and v_rand.status = 'confirmata' and v_rand.decis_la is not null then
      v_ok := v_ok + 1;
      raise notice '  ✓ (1) angajatul își rezervă pool-ul: fișa proprie, confirmată (firma fără aprobare)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (1) rezervarea: employee_id %, status %', v_rand.employee_id, v_rand.status;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) FALS-NEGATIV: angajatul nu-și rezervă pool-ul: % (%)', sqlerrm, sqlstate;
  end;

  -- ── (2) mașina care nu e pool ───────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_reservations (organization_id, vehicle_id, employee_id, de_la, pana_la, scop,
                                             created_by, updated_by)
    values (v_org, v_n_veh, v_e_a, v_azi + 1, v_azi + 1, 'Vizită la client', v_u_a, v_u_a);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) FALS-POZITIV: o mașină fără pool a fost rezervată';
  exception when raise_exception then
    reset role;
    if sqlerrm like '%nu este o mașină de pool%' then
      v_ok := v_ok + 1;
      raise notice '  ✓ (2) mașina fără pool: P0001';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (2) alt mesaj: %', sqlerrm;
    end if;
  end;

  -- ── (3) A pentru colegul B ──────────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_reservations (organization_id, vehicle_id, employee_id, de_la, pana_la, scop,
                                             created_by, updated_by)
    values (v_org, v_p1, v_e_b, v_azi + 5, v_azi + 5, 'Pentru coleg', v_u_a, v_u_a);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) FALS-POZITIV: angajatul a rezervat pentru un coleg';
  exception when insufficient_privilege then
    reset role;
    v_ok := v_ok + 1;
    raise notice '  ✓ (3) rezervarea pentru coleg: 42501 (WITH CHECK)';
  end;

  -- ── (4) B pe aceleași zile ──────────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_b::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_reservations (organization_id, vehicle_id, employee_id, de_la, pana_la, scop,
                                             created_by, updated_by)
    values (v_org, v_p1, v_e_b, v_azi + 1, v_azi + 2, 'Aceeași zi', v_u_b, v_u_b);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) două rezervări suprapuse pe același vehicul';
  exception when exclusion_violation then
    reset role;
    v_ok := v_ok + 1;
    raise notice '  ✓ (4) suprapunerea: 23P01';
  end;

  -- ── (5) aprobarea pornită; cererea lui B; notificarea managerului ───────
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  insert into public.fleet_settings (organization_id, rezervari_cu_aprobare, created_by, updated_by)
  values (v_org, true, v_u_admin, v_u_admin);
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_b::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_reservations (organization_id, vehicle_id, employee_id, de_la, pana_la, scop,
                                             destinatie, created_by, updated_by)
    values (v_org, v_p2, v_e_b, v_azi, v_azi + 2, 'Montaj la Cluj', 'Cluj-Napoca', v_u_b, v_u_b)
    returning id into v_r_b;
    reset role;
    select count(*) into v_n from public.notifications
     where entity_id = v_r_b and user_id = v_u_m and kind = 'approval' and link = '/flota/rezervari?stare=ceruta';
    select count(*) into v_m from public.notifications where entity_id = v_r_b and user_id = v_u_b;
    if (select status from public.vehicle_reservations where id = v_r_b) = 'ceruta' and v_n = 1 and v_m = 0 then
      v_ok := v_ok + 1;
      raise notice '  ✓ (5) cu aprobare: cererea e `ceruta`, managerul direct are 1 notificare, solicitantul 0';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (5) status %, notificări manager %, solicitant %',
        (select status from public.vehicle_reservations where id = v_r_b), v_n, v_m;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) FALS-NEGATIV: cererea lui B a eșuat: % (%)', sqlerrm, sqlstate;
  end;

  -- ── (6) managerul aprobă cererea subordonatului ─────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_m::text, true);
  set local role authenticated;
  begin
    update public.vehicle_reservations set status = 'confirmata', updated_by = v_u_m
     where id = v_r_b and status = 'ceruta';
    get diagnostics v_n = row_count;
    reset role;
    select * into v_rand from public.vehicle_reservations where id = v_r_b;
    select count(*) into v_m from public.notifications
     where entity_id = v_r_b and user_id = v_u_b and kind = 'approval' and title = 'Rezervarea a fost aprobată';
    if v_n = 1 and v_rand.status = 'confirmata' and v_rand.decis_de = v_u_m and v_m = 1 then
      v_ok := v_ok + 1;
      raise notice '  ✓ (6) managerul aprobă: 1 rând, decis_de = managerul, solicitantul e anunțat';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (6) FALS-NEGATIV: % rânduri, status %, decis_de %, notificări %',
        v_n, v_rand.status, v_rand.decis_de, v_m;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) FALS-NEGATIV: aprobarea managerului a eșuat: % (%)', sqlerrm, sqlstate;
  end;

  -- ── (7) managerul nu-și aprobă propria cerere ───────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_m::text, true);
  set local role authenticated;
  insert into public.vehicle_reservations (organization_id, vehicle_id, employee_id, de_la, pana_la, scop,
                                           created_by, updated_by)
  values (v_org, v_p1, v_e_m, v_azi + 3, v_azi + 3, 'Ședință la sediu', v_u_m, v_u_m)
  returning id into v_r_m;
  begin
    update public.vehicle_reservations set status = 'confirmata', updated_by = v_u_m
     where id = v_r_m and status = 'ceruta';
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) FALS-POZITIV: managerul și-a aprobat singur cererea';
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Nu vă puteți aproba%' and (select status from public.vehicle_reservations where id = v_r_m) = 'ceruta' then
      v_ok := v_ok + 1;
      raise notice '  ✓ (7) auto-aprobarea managerului: P0001, cererea rămâne `ceruta`';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (7) alt mesaj: %', sqlerrm;
    end if;
  end;

  -- ── (8) angajatul nu-și pune singur `confirmata` ────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_b::text, true);
  set local role authenticated;
  insert into public.vehicle_reservations (organization_id, vehicle_id, employee_id, de_la, pana_la, scop,
                                           created_by, updated_by)
  values (v_org, v_p1, v_e_b, v_azi + 6, v_azi + 6, 'Livrare piese', v_u_b, v_u_b)
  returning id into v_r_b2;
  begin
    update public.vehicle_reservations set status = 'confirmata', updated_by = v_u_b
     where id = v_r_b2 and status = 'ceruta';
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) FALS-POZITIV: angajatul și-a confirmat singur cererea';
  exception when raise_exception then
    reset role;
    if sqlerrm like '%doar cine are dreptul de aprobare%' then
      v_ok := v_ok + 1;
      raise notice '  ✓ (8) angajatul nu-și confirmă cererea: P0001';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (8) alt mesaj: %', sqlerrm;
    end if;
  end;

  -- ── (9) anularea: B nu, A da ────────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_b::text, true);
  set local role authenticated;
  update public.vehicle_reservations set status = 'anulata', motiv_anulare = 'Încercare', updated_by = v_u_b
   where id = v_r_a1;
  get diagnostics v_n = row_count;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.vehicle_reservations set status = 'anulata', updated_by = v_u_a
     where id = v_r_a1 and status in ('ceruta', 'confirmata');
    get diagnostics v_m = row_count;
    reset role;
    select * into v_rand from public.vehicle_reservations where id = v_r_a1;
    if v_n = 0 and v_m = 1 and v_rand.status = 'anulata' and v_rand.anulat_de = v_u_a then
      v_ok := v_ok + 1;
      raise notice '  ✓ (9) A își anulează rezervarea (1 rând); B n-o atinge (0 rânduri)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (9) B: % rânduri, A: % rânduri, status %, anulat_de %', v_n, v_m, v_rand.status, v_rand.anulat_de;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) FALS-NEGATIV: anularea proprie a eșuat: % (%)', sqlerrm, sqlstate;
  end;

  -- ── (10) foaia lui C într-o zi rezervată de B ───────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_c::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                    status, created_by, updated_by)
    values (v_org, v_p2, v_e_c, (v_azi::timestamp + interval '8 hours') at time zone c_ora, 2000,
            'draft', v_u_c, v_u_c);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10) FALS-POZITIV: foaia lui C pe o zi rezervată de B';
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Vehiculul este rezervat pentru alt angajat%' then
      v_ok := v_ok + 1;
      raise notice '  ✓ (10) foaia altui șofer pe ziua rezervată: P0001';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (10) alt mesaj: %', sqlerrm;
    end if;
  end;

  -- ── (11) foaia lui B se leagă de rezervare ──────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_b::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, sosire_la, km_plecare, km_sosire,
                                    status, created_by, updated_by, vehicle_reservation_id)
    values (v_org, v_p2, v_e_b, (v_azi::timestamp + interval '8 hours') at time zone c_ora,
            (v_azi::timestamp + interval '9 hours') at time zone c_ora, 2000, 2010,
            'draft', v_u_b, v_u_b, v_r_a1)   -- legătura trimisă din client se ignoră
    returning id into v_foaie_b;
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, sosire_la, km_plecare, km_sosire,
                                    status, created_by, updated_by)
    values (v_org, v_p2, v_e_b, ((v_azi + 1)::timestamp + interval '8 hours') at time zone c_ora,
            ((v_azi + 1)::timestamp + interval '9 hours') at time zone c_ora, 2010, 2020,
            'draft', v_u_b, v_u_b)
    returning id into v_foaie_b2;
    -- O mutare directă a legăturii, fără altă schimbare, nu ține.
    update public.trip_sheets set vehicle_reservation_id = v_r_a1, updated_by = v_u_b where id = v_foaie_b;
    reset role;
    if (select vehicle_reservation_id from public.trip_sheets where id = v_foaie_b) = v_r_b
       and (select vehicle_reservation_id from public.trip_sheets where id = v_foaie_b2) = v_r_b then
      v_ok := v_ok + 1;
      raise notice '  ✓ (11) foile lui B pe zilele rezervate se leagă de rezervare; legătura din client se ignoră';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (11) legătura: % / % (așteptat %)',
        (select vehicle_reservation_id from public.trip_sheets where id = v_foaie_b),
        (select vehicle_reservation_id from public.trip_sheets where id = v_foaie_b2), v_r_b;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (11) FALS-NEGATIV: foaia lui B pe ziua rezervată a eșuat: % (%)', sqlerrm, sqlstate;
  end;

  -- ── (12) anularea cu foaie, scurtarea sub foaie, scurtarea validă ───────
  v_k := 0;
  perform set_config('request.jwt.claim.sub', v_u_b::text, true);
  set local role authenticated;
  begin
    update public.vehicle_reservations set status = 'anulata', updated_by = v_u_b where id = v_r_b;
    reset role;
    raise warning '  ✗ (12a) rezervarea cu foi a fost anulată';
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Rezervarea are deja foi de parcurs%' then v_k := v_k + 1;
    else raise warning '  ✗ (12a) alt mesaj: %', sqlerrm; end if;
  end;
  set local role authenticated;
  begin
    update public.vehicle_reservations set pana_la = v_azi, updated_by = v_u_b where id = v_r_b;
    reset role;
    raise warning '  ✗ (12b) rezervarea s-a scurtat sub ziua unei foi';
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Rezervarea are foaie de parcurs pe%' then v_k := v_k + 1;
    else raise warning '  ✗ (12b) alt mesaj: %', sqlerrm; end if;
  end;
  set local role authenticated;
  begin
    update public.vehicle_reservations set pana_la = v_azi + 1, updated_by = v_u_b
     where id = v_r_b and status in ('ceruta', 'confirmata');
    get diagnostics v_n = row_count;
    reset role;
    if v_n = 1 and (select pana_la from public.vehicle_reservations where id = v_r_b) = v_azi + 1 then
      v_k := v_k + 1;
    else
      raise warning '  ✗ (12c) scurtarea validă: % rânduri', v_n;
    end if;
  exception when others then
    reset role;
    raise warning '  ✗ (12c) FALS-NEGATIV: scurtarea validă a eșuat: % (%)', sqlerrm, sqlstate;
  end;
  if v_k = 3 then
    v_ok := v_ok + 1;
    raise notice '  ✓ (12) anularea cu foaie P0001; scurtarea sub foaie P0001; scurtarea validă 1 rând';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (12) doar % din 3', v_k;
  end if;

  -- ── (13) alocarea peste rezervarea altuia ───────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, km_predare,
                                            created_by, updated_by)
    values (v_org, v_p2, v_e_c, now(), 2020, v_u_admin, v_u_admin);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (13) FALS-POZITIV: alocarea a trecut peste rezervarea lui B';
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Vehiculul are rezervări active începând cu%' then
      v_ok := v_ok + 1;
      raise notice '  ✓ (13) alocarea peste rezervarea altuia: P0001 cu instrucțiunea de anulare';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (13) alt mesaj: %', sqlerrm;
    end if;
  end;

  -- ── (20) org_admin rezervă pentru A, cu aprobarea pornită ───────────────
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_reservations (organization_id, vehicle_id, employee_id, de_la, pana_la, scop,
                                             created_by, updated_by)
    values (v_org, v_p3, v_e_a, v_azi + 2, v_azi + 2, 'Instruire la Brașov', v_u_admin, v_u_admin)
    returning id into v_r_a2;
    insert into public.vehicle_reservations (organization_id, vehicle_id, employee_id, de_la, pana_la, scop,
                                             created_by, updated_by)
    values (v_org, v_p3, v_e_a, v_azi, v_azi, 'Drum la bancă', v_u_admin, v_u_admin)
    returning id into v_r_a_azi;
    reset role;
    select count(*) into v_n from public.notifications
     where entity_id = v_r_a2 and user_id = v_u_a and kind = 'info';
    if (select status from public.vehicle_reservations where id = v_r_a2) = 'confirmata' and v_n = 1 then
      v_ok := v_ok + 1;
      raise notice '  ✓ (20) org_admin rezervă pentru A: confirmată direct, A primește 1 notificare `info`';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (20) status %, notificări %', (select status from public.vehicle_reservations where id = v_r_a2), v_n;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (20) FALS-NEGATIV: org_admin nu rezervă pentru A: % (%)', sqlerrm, sqlstate;
  end;

  -- ── (14) ieșirea din pool ───────────────────────────────────────────────
  begin
    perform set_config('request.jwt.claim.sub', v_u_a::text, true);
    set local role authenticated;
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, sosire_la, km_plecare, km_sosire,
                                    status, created_by, updated_by)
    values (v_org, v_p3, v_e_a, (v_azi::timestamp + interval '10 hours') at time zone c_ora,
            (v_azi::timestamp + interval '11 hours') at time zone c_ora, 3000, 3010, 'draft', v_u_a, v_u_a);
    reset role;
    perform set_config('request.jwt.claim.sub', v_u_c::text, true);
    set local role authenticated;
    insert into public.vehicle_reservations (organization_id, vehicle_id, employee_id, de_la, pana_la, scop,
                                             created_by, updated_by)
    values (v_org, v_p3, v_e_c, v_azi + 4, v_azi + 4, 'Inventar la depozit', v_u_c, v_u_c)
    returning id into v_r_c3;
    reset role;
    perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
    set local role authenticated;
    update public.vehicles set pool = false, updated_by = v_u_admin where id = v_p3;
    reset role;
    select count(*) into v_n from public.vehicle_reservations
     where id in (v_r_a2, v_r_c3) and status = 'anulata' and motiv_anulare = 'Vehiculul nu mai este mașină de pool.';
    select count(*) into v_m from public.notifications
     where kind = 'warning' and ((entity_id = v_r_a2 and user_id = v_u_a) or (entity_id = v_r_c3 and user_id = v_u_c));
    if v_n = 2 and v_m = 2 and (select status from public.vehicle_reservations where id = v_r_a_azi) = 'confirmata' then
      v_ok := v_ok + 1;
      raise notice '  ✓ (14) ieșirea din pool anulează 2 rezervări viitoare (2 notificări `warning`); cea cu foaie rămâne';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (14) anulate %, notificări %, cea cu foaie %', v_n, v_m,
        (select status from public.vehicle_reservations where id = v_r_a_azi);
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (14) FALS-NEGATIV: ieșirea din pool a eșuat: % (%)', sqlerrm, sqlstate;
  end;

  -- ── (15) hr ─────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  select count(*) into v_n from public.vehicle_reservations where organization_id = v_org;
  select count(*) into v_m from public.ocuparea_vehiculelor_pool(v_org, v_azi, v_azi + 13);
  begin
    insert into public.vehicle_reservations (organization_id, vehicle_id, employee_id, de_la, pana_la, scop,
                                             created_by, updated_by)
    values (v_org, v_p1, v_e_hr, v_azi + 8, v_azi + 8, 'Recrutare', v_u_hr, v_u_hr);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (15) FALS-POZITIV: hr a rezervat o mașină';
  exception when insufficient_privilege then
    reset role;
    if v_n = 0 and v_m = 0 then
      v_ok := v_ok + 1;
      raise notice '  ✓ (15) hr: 0 rânduri la citire, 0 la ocupare, 42501 la scriere';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (15) FALS-POZITIV: hr vede % rezervări și % ocupări', v_n, v_m;
    end if;
  end;

  -- ── (24) foaia respinsă redeschisă peste rezervarea altuia ──────────────
  -- Fixture ca superuser: foaia lui B pe P4, respinsă (fluxul ei nu e obiectul probei).
  insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, sosire_la, km_plecare, km_sosire,
                                  status, motiv_respingere, created_by, updated_by)
  values (v_org, v_p4, v_e_b, (v_azi::timestamp + interval '14 hours') at time zone c_ora,
          (v_azi::timestamp + interval '15 hours') at time zone c_ora, 4000, 4010,
          'respins', 'Traseu incomplet', v_u_b, v_u_b)
  returning id into v_foaie_b4;
  perform set_config('request.jwt.claim.sub', v_u_c::text, true);
  set local role authenticated;
  insert into public.vehicle_reservations (organization_id, vehicle_id, employee_id, de_la, pana_la, scop,
                                           created_by, updated_by)
  values (v_org, v_p4, v_e_c, v_azi, v_azi, 'Curierat urgent', v_u_c, v_u_c)
  returning id into v_r_c4;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_b::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set status = 'draft', updated_by = v_u_b where id = v_foaie_b4;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (24) FALS-POZITIV: foaia respinsă s-a redeschis peste rezervarea lui C';
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Vehiculul este rezervat pentru alt angajat%' then
      v_ok := v_ok + 1;
      raise notice '  ✓ (24) foaia respinsă redeschisă peste rezervarea altuia: P0001';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (24) alt mesaj: %', sqlerrm;
    end if;
  end;

  -- ── (16) rezervarea obligatorie ─────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  update public.fleet_settings set rezervare_obligatorie = true, updated_by = v_u_admin
   where organization_id = v_org and deleted_at is null;
  reset role;
  v_k := 0;
  perform set_config('request.jwt.claim.sub', v_u_c::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                    status, created_by, updated_by)
    values (v_org, v_p1, v_e_c, (v_azi::timestamp + interval '8 hours') at time zone c_ora, 1000,
            'draft', v_u_c, v_u_c);
    reset role;
    raise warning '  ✗ (16a) FALS-POZITIV: foaia pe pool fără rezervare, cu rezervarea obligatorie';
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Vehiculul se folosește doar cu rezervare confirmată%' then v_k := v_k + 1;
    else raise warning '  ✗ (16a) alt mesaj: %', sqlerrm; end if;
  end;
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                    status, created_by, updated_by)
    values (v_org, v_p1, v_e_c, (v_azi::timestamp + interval '8 hours') at time zone c_ora, 1000,
            'draft', v_u_admin, v_u_admin);
    get diagnostics v_n = row_count;
    reset role;
    if v_n = 1 then v_k := v_k + 1; end if;
  exception when others then
    reset role;
    raise warning '  ✗ (16b) FALS-NEGATIV: org_admin nu face foaia pentru C: % (%)', sqlerrm, sqlstate;
  end;
  if v_k = 2 then
    v_ok := v_ok + 1;
    raise notice '  ✓ (16) rezervarea obligatorie: C fără rezervare P0001; org_admin (create = all) trece';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (16) doar % din 2', v_k;
  end if;

  -- ── (17) angajatul altei firme ──────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_x::text, true);
  set local role authenticated;
  select count(*) into v_n from public.vehicle_reservations where organization_id = v_org;
  select count(*) into v_m from public.ocuparea_vehiculelor_pool(v_org, v_azi, v_azi + 13);
  select count(*) into v_k from public.setarile_rezervarilor(v_org);
  reset role;
  if v_n = 0 and v_m = 0 and v_k = 0 then
    v_ok := v_ok + 1;
    raise notice '  ✓ (17) altă firmă: 0 rezervări, 0 ocupări, 0 setări';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (17) FALS-POZITIV: altă firmă vede % rezervări, % ocupări, % setări', v_n, v_m, v_k;
  end if;

  -- ── (18) ocuparea pentru C, fără identitate ─────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_c::text, true);
  set local role authenticated;
  select count(*) into v_n from public.ocuparea_vehiculelor_pool(v_org, v_azi, v_azi + 13) o
   where o.vehicle_id = v_p2 and o.sursa = 'rezervare' and not o.a_mea and o.rezervare_id is null;
  select count(*) into v_m from public.ocuparea_vehiculelor_pool(v_org, v_azi, v_azi + 13) o
   where not o.a_mea and o.rezervare_id is not null;
  select count(*) into v_k from public.ocuparea_vehiculelor_pool(v_org, v_azi, v_azi + 13) o
   where o.vehicle_id = v_p4 and o.sursa = 'rezervare' and o.a_mea and o.rezervare_id = v_r_c4;
  reset role;
  if v_n = 1 and v_m = 0 and v_k = 1 then
    v_ok := v_ok + 1;
    raise notice '  ✓ (18) ocuparea: intervalul lui B fără id și fără nume; a lui C cu id';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (18) interval B %, id-uri străine %, a lui C %', v_n, v_m, v_k;
  end if;

  -- ── (19) prelungire, durată peste maxim, început în trecut ──────────────
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  insert into public.vehicle_reservations (organization_id, vehicle_id, employee_id, de_la, pana_la, scop,
                                           created_by, updated_by)
  values (v_org, v_p1, v_e_a, v_azi + 10, v_azi + 11, 'Audit la filială', v_u_a, v_u_a)
  returning id into v_r_a10;
  reset role;
  v_k := 0;
  set local role authenticated;
  begin
    update public.vehicle_reservations set pana_la = v_azi + 12, updated_by = v_u_a where id = v_r_a10;
    reset role;
    raise warning '  ✗ (19a) rezervarea s-a prelungit';
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Rezervarea nu se poate prelungi%' then v_k := v_k + 1;
    else raise warning '  ✗ (19a) alt mesaj: %', sqlerrm; end if;
  end;
  set local role authenticated;
  begin
    insert into public.vehicle_reservations (organization_id, vehicle_id, employee_id, de_la, pana_la, scop,
                                             created_by, updated_by)
    values (v_org, v_p4, v_e_a, v_azi + 20, v_azi + 40, 'Prea lungă', v_u_a, v_u_a);
    reset role;
    raise warning '  ✗ (19b) o rezervare de 21 de zile a trecut (maximul e 14)';
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Rezervarea depășește durata maximă de 14 zile%' then v_k := v_k + 1;
    else raise warning '  ✗ (19b) alt mesaj: %', sqlerrm; end if;
  end;
  set local role authenticated;
  begin
    insert into public.vehicle_reservations (organization_id, vehicle_id, employee_id, de_la, pana_la, scop,
                                             created_by, updated_by)
    values (v_org, v_p4, v_e_a, v_azi - 1, v_azi + 1, 'Din trecut', v_u_a, v_u_a);
    reset role;
    raise warning '  ✗ (19c) o rezervare începută ieri a trecut';
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Rezervarea începe cel mai devreme astăzi%' then v_k := v_k + 1;
    else raise warning '  ✗ (19c) alt mesaj: %', sqlerrm; end if;
  end;
  if v_k = 3 then
    v_ok := v_ok + 1;
    raise notice '  ✓ (19) prelungirea, durata peste maxim și începutul în trecut: P0001 × 3';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (19) doar % din 3', v_k;
  end if;

  -- ── (21) managerul nu rezervă pentru subordonat ─────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_m::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_reservations (organization_id, vehicle_id, employee_id, de_la, pana_la, scop,
                                             created_by, updated_by)
    values (v_org, v_p1, v_e_b, v_azi + 15, v_azi + 15, 'Pentru subordonat', v_u_m, v_u_m);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (21) FALS-POZITIV: managerul a rezervat pentru subordonat';
  exception when insufficient_privilege then
    reset role;
    v_ok := v_ok + 1;
    raise notice '  ✓ (21) managerul pentru subordonat: 42501 (create = own)';
  end;

  -- ── (22) managerul anulează, cu motiv, cererea subordonatului ──────────
  perform set_config('request.jwt.claim.sub', v_u_m::text, true);
  set local role authenticated;
  begin
    update public.vehicle_reservations
       set status = 'anulata', motiv_anulare = 'Mașina e necesară la audit.', updated_by = v_u_m
     where id = v_r_b2 and status in ('ceruta', 'confirmata');
    get diagnostics v_n = row_count;
    reset role;
    select count(*) into v_m from public.notifications
     where entity_id = v_r_b2 and user_id = v_u_b and kind = 'warning';
    if v_n = 1 and (select status from public.vehicle_reservations where id = v_r_b2) = 'anulata' and v_m = 1 then
      v_ok := v_ok + 1;
      raise notice '  ✓ (22) managerul anulează cererea subordonatului (approve = team): 1 rând, B e anunțat';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (22) FALS-NEGATIV: % rânduri, notificări %', v_n, v_m;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (22) FALS-NEGATIV: anularea managerului a eșuat: % (%)', sqlerrm, sqlstate;
  end;

  -- ── (23) ștergerea logică directă ───────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.vehicle_reservations set deleted_at = now(), updated_by = v_u_a where id = v_r_a10;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (23) FALS-POZITIV: rezervarea s-a șters logic din aplicație';
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Rezervarea nu se șterge%' then
      perform set_config('request.jwt.claim.sub', v_u_c::text, true);
      set local role authenticated;
      begin
        insert into public.vehicle_reservations (organization_id, vehicle_id, employee_id, de_la, pana_la, scop,
                                                 created_by, updated_by)
        values (v_org, v_p1, v_e_c, v_azi + 10, v_azi + 10, 'Peste rezervarea lui A', v_u_c, v_u_c);
        reset role;
        v_esecuri := v_esecuri + 1;
        raise warning '  ✗ (23) rândul a ieșit din EXCLUDE';
      exception when exclusion_violation then
        reset role;
        v_ok := v_ok + 1;
        raise notice '  ✓ (23) ștergerea logică directă: P0001; rândul rămâne în EXCLUDE (23P01)';
      end;
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (23) alt mesaj: %', sqlerrm;
    end if;
  when others then
    -- Fără garda din trigger, WITH CHECK (`deleted_at is null`) dă 42501: plasa a
    -- doua ține, dar mesajul pentru om ar fi „nu aveți dreptul”.
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (23) ștergerea logică nu e oprită de trigger: % (%)', sqlerrm, sqlstate;
  end;

  -- ── (25) plasa aprobatorilor ────────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  update public.fleet_settings set responsabili = array[v_e_m2], updated_by = v_u_admin
   where organization_id = v_org and deleted_at is null;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_d::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_reservations (organization_id, vehicle_id, employee_id, de_la, pana_la, scop,
                                             created_by, updated_by)
    values (v_org, v_p4, v_e_d, v_azi + 5, v_azi + 5, 'Ridicare colet', v_u_d, v_u_d)
    returning id into v_r_d;
    reset role;
    select count(*) into v_n from public.notifications where entity_id = v_r_d and user_id = v_u_admin;
    select count(*) into v_m from public.notifications where entity_id = v_r_d and user_id = v_u_admin2;
    select count(*) into v_k from public.notifications where entity_id = v_r_d and user_id = v_u_m2;
    if v_n = 1 and v_m = 1 and v_k = 0 then
      v_ok := v_ok + 1;
      raise notice '  ✓ (25) responsabil fără approve = all, fără manager direct: fiecare org_admin primește 1 notificare';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (25) REFUZ TĂCUT: admin %, admin2 %, responsabilul manager %', v_n, v_m, v_k;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (25) cererea lui D a eșuat: % (%)', sqlerrm, sqlstate;
  end;

  -- ── (26) super_admin ────────────────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_sa::text, true);
  set local role authenticated;
  select count(*) into v_n from public.vehicle_reservations where organization_id = v_org;
  begin
    insert into public.vehicle_reservations (organization_id, vehicle_id, employee_id, de_la, pana_la, scop,
                                             created_by, updated_by)
    values (v_org, v_p1, v_e_a, v_azi + 20, v_azi + 20, 'Platforma', v_u_sa, v_u_sa);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (26) FALS-POZITIV: super_admin a rezervat în firma-client';
  exception when insufficient_privilege then
    reset role;
    select count(*) into v_m from public.vehicle_reservations where organization_id = v_org;
    if v_n = v_m and v_n >= 10 then
      v_ok := v_ok + 1;
      raise notice '  ✓ (26) super_admin vede toate cele % rezervări ale firmei, nu scrie (42501)', v_n;
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (26) FALS-NEGATIV: super_admin vede % din %', v_n, v_m;
    end if;
  end;

  -- ── (27) managerul: ale lui și ale echipei ──────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_m::text, true);
  set local role authenticated;
  select count(*) into v_n from public.vehicle_reservations where id in (v_r_b, v_r_b2, v_r_m);
  select count(*) into v_m from public.vehicle_reservations where id in (v_r_a1, v_r_a10, v_r_c3, v_r_d);
  reset role;
  if v_n = 3 and v_m = 0 then
    v_ok := v_ok + 1;
    raise notice '  ✓ (27) managerul vede rezervarea lui și pe ale subordonatului (3), nu pe ale altora (0)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (27) managerul: echipă %, alții %', v_n, v_m;
  end if;

  -- ── (28) angajatul: doar ale lui ────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  select count(*) into v_n from public.vehicle_reservations where id in (v_r_a1, v_r_a2, v_r_a10);
  select count(*) into v_m from public.vehicle_reservations where id in (v_r_b, v_r_m, v_r_c3);
  select count(*) into v_k from public.setarile_rezervarilor(v_org) s where s.cu_aprobare and s.obligatorie and s.max_zile = 14;
  reset role;
  if v_n = 3 and v_m = 0 and v_k = 1 then
    v_ok := v_ok + 1;
    raise notice '  ✓ (28) angajatul vede ale lui (3), nu pe ale colegilor (0); citește setările rezervărilor';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (28) angajatul: ale lui %, ale altora %, setări %', v_n, v_m, v_k;
  end if;

  -- ── (29) org_admin decide; respingerea cere motiv ───────────────────────
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  v_k := 0;
  begin
    update public.vehicle_reservations set status = 'respinsa', updated_by = v_u_admin
     where id = v_r_m and status = 'ceruta';
    reset role;
    raise warning '  ✗ (29a) respingere fără motiv acceptată';
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Scrieți motivul respingerii%' then v_k := v_k + 1;
    else raise warning '  ✗ (29a) alt mesaj: %', sqlerrm; end if;
  end;
  set local role authenticated;
  begin
    update public.vehicle_reservations set status = 'respinsa', motiv_respingere = 'Mașina e la service.', updated_by = v_u_admin
     where id = v_r_m and status = 'ceruta';
    get diagnostics v_n = row_count;
    update public.vehicle_reservations set status = 'confirmata', updated_by = v_u_admin
     where id = v_r_d and status = 'ceruta';
    get diagnostics v_m = row_count;
    reset role;
    if v_n = 1 and v_m = 1
       and (select count(*) from public.notifications
             where entity_id = v_r_m and user_id = v_u_m and title = 'Rezervarea a fost respinsă'
               and body like '%Motiv: Mașina e la service.') = 1 then
      v_k := v_k + 1;
    else
      raise warning '  ✗ (29b) respingere %, aprobare %', v_n, v_m;
    end if;
  exception when others then
    reset role;
    raise warning '  ✗ (29b) FALS-NEGATIV: org_admin nu decide: % (%)', sqlerrm, sqlstate;
  end;
  if v_k = 2 then
    v_ok := v_ok + 1;
    raise notice '  ✓ (29) org_admin respinge (cu motiv, care ajunge în notificare) și aprobă cererile altora';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (29) doar % din 2', v_k;
  end if;

  -- ── (30) imuabilitatea ──────────────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    update public.vehicle_reservations set scop = 'Alt scop', updated_by = v_u_admin where id = v_r_d;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (30) scopul s-a rescris';
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Vehiculul, angajatul, prima zi%' then
      v_ok := v_ok + 1;
      raise notice '  ✓ (30) vehiculul, prima zi și scopul nu se rescriu: P0001';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (30) alt mesaj: %', sqlerrm;
    end if;
  end;

  -- ── (31) foaia NELEGATĂ a omului din zilele rezervării ──────────────────
  -- Doar o rezervare `confirmata` leagă foaia, iar legătura nu se pune
  -- retroactiv la aprobare (specificația, „Ce NU se face”). Foaia făcută cât
  -- cererea aștepta rămâne deci fără `vehicle_reservation_id`. Gărzile de
  -- anulare, de scurtare și de ieșire din pool trebuie s-o vadă totuși: altfel
  -- rezervarea apare anulată deși mașina a ieșit pe foaie în ziua ei.
  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent, categorie,
                               pool, created_by, updated_by) values
    (v_p5, v_org, 'B' || (100 + (random() * 800)::int)::text || 'RZE', 'Dacia', 'Spring', 6000, 'autoturism',
     true, v_u_admin, v_u_admin);
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  update public.fleet_settings set rezervari_cu_aprobare = true, rezervare_obligatorie = false,
                                   updated_by = v_u_admin
   where organization_id = v_org and deleted_at is null;
  reset role;
  v_k := 0;
  begin
    perform set_config('request.jwt.claim.sub', v_u_c::text, true);
    set local role authenticated;
    insert into public.vehicle_reservations (organization_id, vehicle_id, employee_id, de_la, pana_la, scop,
                                             created_by, updated_by)
    values (v_org, v_p5, v_e_c, v_azi, v_azi + 2, 'Teren la Ploiești', v_u_c, v_u_c)
    returning id into v_r_c5;
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, sosire_la, km_plecare, km_sosire,
                                    status, created_by, updated_by)
    values (v_org, v_p5, v_e_c, ((v_azi + 1)::timestamp + interval '8 hours') at time zone c_ora,
            ((v_azi + 1)::timestamp + interval '9 hours') at time zone c_ora, 6000, 6010, 'draft', v_u_c, v_u_c)
    returning id into v_foaie_c5;
    reset role;
    perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
    set local role authenticated;
    update public.vehicle_reservations set status = 'confirmata', updated_by = v_u_admin
     where id = v_r_c5 and status = 'ceruta';
    get diagnostics v_n = row_count;
    reset role;
    if v_n = 1 and (select status from public.vehicle_reservations where id = v_r_c5) = 'confirmata'
       and (select vehicle_reservation_id from public.trip_sheets where id = v_foaie_c5) is null then
      v_k := v_k + 1;
    else
      raise warning '  ✗ (31) precondiția: aprobare % rânduri, legătura %', v_n,
        (select vehicle_reservation_id from public.trip_sheets where id = v_foaie_c5);
    end if;
  exception when others then
    reset role;
    raise warning '  ✗ (31) FALS-NEGATIV la pregătire: % (%)', sqlerrm, sqlstate;
  end;
  perform set_config('request.jwt.claim.sub', v_u_c::text, true);
  set local role authenticated;
  begin
    update public.vehicle_reservations set pana_la = v_azi, updated_by = v_u_c where id = v_r_c5;
    get diagnostics v_n = row_count;
    reset role;
    raise warning '  ✗ (31a) FALS-POZITIV: rezervarea s-a scurtat sub foaia nelegată (% rânduri)', v_n;
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Rezervarea are foaie de parcurs pe%' then v_k := v_k + 1;
    else raise warning '  ✗ (31a) alt mesaj: %', sqlerrm; end if;
  end;
  set local role authenticated;
  begin
    update public.vehicle_reservations set status = 'anulata', updated_by = v_u_c where id = v_r_c5;
    get diagnostics v_n = row_count;
    reset role;
    raise warning '  ✗ (31b) FALS-POZITIV: rezervarea cu foaie nelegată s-a anulat (% rânduri)', v_n;
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Rezervarea are deja foi de parcurs%' then v_k := v_k + 1;
    else raise warning '  ✗ (31b) alt mesaj: %', sqlerrm; end if;
  end;
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    update public.vehicles set pool = false, updated_by = v_u_admin where id = v_p5;
    reset role;
    if (select status from public.vehicle_reservations where id = v_r_c5) = 'confirmata' then
      v_k := v_k + 1;
    else
      raise warning '  ✗ (31c) ieșirea din pool a anulat rezervarea cu foaie nelegată (status %)',
        (select status from public.vehicle_reservations where id = v_r_c5);
    end if;
  exception when others then
    reset role;
    raise warning '  ✗ (31c) FALS-NEGATIV: ieșirea din pool a eșuat: % (%)', sqlerrm, sqlstate;
  end;
  if v_k = 4 then
    v_ok := v_ok + 1;
    raise notice '  ✓ (31) foaia nelegată: scurtarea sub ea P0001, anularea P0001, ieșirea din pool o păstrează';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (31) doar % din 4', v_k;
  end if;

  -- ── (32) ocuparea: fără starea foilor colegilor, fără zile trecute ──────
  -- Sub `trip_sheets:read = own`, C nu vede foile lui A. Ocuparea îi spune că
  -- mașina e luată într-o zi, nu și dacă foaia colegului a fost aprobată, și
  -- nici ce a făcut parcul în trecut (grila începe azi).
  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent, categorie,
                               pool, created_by, updated_by) values
    (v_p6, v_org, 'B' || (100 + (random() * 800)::int)::text || 'RZF', 'Toyota', 'Corolla', 7000, 'autoturism',
     true, v_u_admin, v_u_admin);
  begin
    -- Foaia trecută a lui A, scrisă direct ca proprietar: proba întreabă ce
    -- arată ocuparea, nu cine poate scrie o foaie în trecut.
    perform set_config('request.jwt.claim.sub', v_u_a::text, true);
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, sosire_la, km_plecare, km_sosire,
                                    status, created_by, updated_by)
    values (v_org, v_p6, v_e_a, ((v_azi - 5)::timestamp + interval '8 hours') at time zone c_ora,
            ((v_azi - 5)::timestamp + interval '9 hours') at time zone c_ora, 7000, 7010, 'draft', v_u_a, v_u_a);
    set local role authenticated;
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, sosire_la, km_plecare, km_sosire,
                                    status, created_by, updated_by)
    values (v_org, v_p6, v_e_a, ((v_azi + 3)::timestamp + interval '8 hours') at time zone c_ora,
            ((v_azi + 3)::timestamp + interval '9 hours') at time zone c_ora, 7010, 7020, 'draft', v_u_a, v_u_a);
    reset role;
    perform set_config('request.jwt.claim.sub', v_u_c::text, true);
    set local role authenticated;
    select count(*) into v_n from public.ocuparea_vehiculelor_pool(v_org, v_azi - 10, v_azi - 1);
    select count(*) into v_m from public.ocuparea_vehiculelor_pool(v_org, v_azi, v_azi + 13) o
     where o.sursa = 'foaie' and not o.a_mea and o.status is not null;
    select count(*) into v_k from public.ocuparea_vehiculelor_pool(v_org, v_azi, v_azi + 13) o
     where o.vehicle_id = v_p6 and o.sursa = 'foaie' and not o.a_mea and o.de_la = v_azi + 3;
    select count(*) into v_x from public.ocuparea_vehiculelor_pool(v_org, v_azi - 10, v_azi + 13) o
     where o.de_la < v_azi;
    reset role;
    if v_n = 0 and v_m = 0 and v_k = 1 and v_x = 0 then
      v_ok := v_ok + 1;
      raise notice '  ✓ (32) ocuparea: zilele trecute 0 rânduri, starea foilor colegilor ascunsă, foaia de azi încolo vizibilă';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (32) zile trecute %, stări de foi străine %, foaia lui A vizibilă %, rânduri înainte de azi %',
        v_n, v_m, v_k, v_x;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (32) FALS-NEGATIV: % (%)', sqlerrm, sqlstate;
  end;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA FLOTA REZERVĂRI: % verificări picate (% trecute)', v_esecuri, v_ok;
  end if;
  raise notice '  TOATE cele % verificări au trecut.', v_ok;
  raise notice '';
end;
$$;

rollback;
