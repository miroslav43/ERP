-- tests/rls/proba-flota-roluri.sql
--
-- FLOTA, DUPĂ 0199: DREPTURILE PE ROLURI, PE SEED-UL REAL.
--
-- ── DE CE PE SEED, NU PE RÂNDURI DE FIRMĂ ───────────────────────────────────
-- `proba-flota-integritate.sql` (0171) pune scope-uri pe ORGANIZAȚIE, ca să
-- probeze combinații pe care seed-ul nu le avea. Aici nu se inserează niciun
-- rând în `role_permissions`: proba judecă exact ce primesc cele cinci roluri
-- dintr-o firmă nouă, adică matricea publicată pe pagina modulului.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- employee (Ana, mașina A alocată):
--  (1) întocmește foaia pe mașina alocată                          [POZITIVĂ];
--  (2) alimentează pe foaia proprie                                [POZITIVĂ];
--  (3) își trimite foaia spre aprobare                             [POZITIVĂ];
--  (4) NU alimentează și NU scrie pe foaia colegului;
--  (5) NU întocmește pe mașina nealocată și non-pool, nici pe a colegului (P0001);
--  (6) întocmește pe mașina pool                                   [POZITIVĂ];
--  (7) NU întocmește foaia în numele colegului, nici pe pool (42501);
--  (8) vede mașina ei și pool-ul, nu și mașina colegului           [POZITIVĂ];
--  (9) NU întocmește pe mașina ei într-o zi dinaintea alocării (P0001);
--  (10) NU își mută ciorna de pe pool pe mașina colegului (P0001);
-- manager (Mihai, șef peste Ana și Bogdan, mașina M alocată):
--  (11) își întocmește propria foaie                               [POZITIVĂ];
--  (12) aprobă foaia trimisă a subordonatei                        [POZITIVĂ];
--  (13) NU scrie ciorna subordonatului, NU i-o trimite, NU schimbă km la decizie (P0001);
--  (14) NU întocmește foaia în numele subordonatului (42501);
--  (15) vede mașinile echipei și pool-ul, nu și mașina fără șofer  [POZITIVĂ];
-- hr:
--  (16) nu vede nicio foaie și niciun vehicul și nu întocmește foi;
-- org_admin:
--  (17) întocmește o foaie pentru oricine, pe orice vehicul activ  [POZITIVĂ];
-- Storage (`app.can_path`, rescrisă de 0199):
--  (18) managerul citește calea foilor subordonatului, nu și a unui străin de echipă;
--  (19) angajatul citește calea mașinii lui și a pool-ului, nu a mașinii colegului;
--  (20) managerul citește calea mașinii subordonatului, nu și a mașinii fără șofer.
-- Revizia de securitate (0199, înainte de aplicare):
--  (21) managerul NU își mută foaia trimisă pe subordonat aprobând-o în același UPDATE (P0001);
--  (22) nici în doi pași: mutarea ciornei proprii pe subordonat e refuzată (P0001);
--  (23) managerul NU aprobă o foaie întocmită de el, chiar dacă e pe subordonat (P0001);
--  (24) angajatul vede mașina pool, dar NU anomalia de pe foaia colegului pe ea,
--       și vede anomalia de pe propria foaie                            [POZITIVĂ].
-- Foaia aprobată, după ce șoferul a primit update = own (santinela):
--  (25) șoferul NU își rescrie foaia aprobată (traseu, scop, `aprobat_de`) (P0001);
--  (26) NU șterge alimentarea ei (P0001);  (27) NU o mută pe altă foaie (P0001);
--  (28) NU își șterge logic foaia aprobată (P0001);
--  (29) pe ciornă scrie, dar `aprobat_*`, `trimis_la`, `created_by` rămân ale bazei [POZITIVĂ];
--  (30) nici administratorul nu rescrie foaia aprobată (P0001);
--  (31) administratorul o stornează (ștergere logică, 1 rând)        [POZITIVĂ];
--  (32) șoferul NU reînvie foaia stornată.
-- Foaia trimisă, după ce șoferul a primit update = own (revizia F3, §C5):
--  (33) șoferul NU coboară kilometrajul de plecare pe foaia trimisă (P0001);
--  (34) NU rescrie sosirea refăcând închiderea pe foaia trimisă (P0001);
--  (35) își retrage foaia trimisă în ciornă, fără altă schimbare [POZITIVĂ];
--  (36) regresul pus apoi pe ciornă cade la retrimitere (P0001).
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix     text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org       uuid := gen_random_uuid();
  v_u_admin   uuid := gen_random_uuid();
  v_u_mgr     uuid := gen_random_uuid();
  v_u_a       uuid := gen_random_uuid();
  v_u_b       uuid := gen_random_uuid();
  v_u_hr      uuid := gen_random_uuid();
  v_e_mgr     uuid := gen_random_uuid();
  v_e_a       uuid := gen_random_uuid();
  v_e_b       uuid := gen_random_uuid();
  v_e_c       uuid := gen_random_uuid();
  v_e_hr      uuid := gen_random_uuid();
  v_v_a       uuid := gen_random_uuid();
  v_v_b       uuid := gen_random_uuid();
  v_v_m       uuid := gen_random_uuid();
  v_v_pool    uuid := gen_random_uuid();
  v_v_liber   uuid := gen_random_uuid();
  v_foaie_a   uuid;
  v_foaie_pool uuid;
  v_foaie_b   uuid := gen_random_uuid();
  v_foaie_b2  uuid := gen_random_uuid();
  v_foaie_m1  uuid := gen_random_uuid();
  v_foaie_m2  uuid := gen_random_uuid();
  v_foaie_m3  uuid := gen_random_uuid();
  v_foaie_bp  uuid := gen_random_uuid();
  v_anom_b    uuid := gen_random_uuid();
  v_anom_a    uuid := gen_random_uuid();
  v_alim_a    uuid;
  v_foaie_x   uuid := gen_random_uuid();
  v_n         int;
  v_status    text;
  v_vazute    text;
  v_poate     boolean;
  v_esecuri   int := 0;
begin
  raise notice '';
  raise notice '  PROBA „FLOTA — ROLURI" (0199)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-flota-rol-' || v_sufix, 'Proba Roluri Flotă SRL',
     'RO' || (83000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select v_org, f.feature_key, true, now() from public.features f;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_admin, 'rol-adm-' || v_sufix || '@proba.test', now()),
    (v_u_mgr,   'rol-mgr-' || v_sufix || '@proba.test', now()),
    (v_u_a,     'rol-a-'   || v_sufix || '@proba.test', now()),
    (v_u_b,     'rol-b-'   || v_sufix || '@proba.test', now()),
    (v_u_hr,    'rol-hr-'  || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_admin, 'org_admin'),
    (v_org, v_u_mgr,   'manager'),
    (v_org, v_u_a,     'employee'),
    (v_org, v_u_b,     'employee'),
    (v_org, v_u_hr,    'hr');

  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_mgr, v_org, 'RL-M', 'Mihai',  'Manager', app.azi_local() - 500, 'activ', v_u_mgr, null);
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_a,  v_org, 'RL-A', 'Ana',    'Șofer',   app.azi_local() - 400, 'activ', v_u_a,  v_e_mgr),
    (v_e_b,  v_org, 'RL-B', 'Bogdan', 'Șofer',   app.azi_local() - 400, 'activ', v_u_b,  v_e_mgr),
    (v_e_c,  v_org, 'RL-C', 'Cristi', 'Străin',  app.azi_local() - 400, 'activ', null,   null),
    (v_e_hr, v_org, 'RL-H', 'Horia',  'Personal',app.azi_local() - 400, 'activ', v_u_hr, null);

  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent, pool,
                               created_by, updated_by) values
    (v_v_a,     v_org, 'B' || (100 + (random() * 800)::int)::text || 'RLA', 'Dacia', 'Logan',  10000, false, v_u_admin, v_u_admin),
    (v_v_b,     v_org, 'B' || (100 + (random() * 800)::int)::text || 'RLB', 'Dacia', 'Duster', 20000, false, v_u_admin, v_u_admin),
    (v_v_m,     v_org, 'B' || (100 + (random() * 800)::int)::text || 'RLM', 'Skoda', 'Octavia',30000, false, v_u_admin, v_u_admin),
    (v_v_pool,  v_org, 'B' || (100 + (random() * 800)::int)::text || 'RLP', 'Dacia', 'Jogger', 40000, true,  v_u_admin, v_u_admin),
    (v_v_liber, v_org, 'B' || (100 + (random() * 800)::int)::text || 'RLL', 'Ford',  'Transit',50000, false, v_u_admin, v_u_admin);

  -- Alocările, din contextul de serviciu. Sincronizarea din 0173 pune șoferul
  -- pe vehicul.
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, created_by, updated_by) values
    (v_org, v_v_a, v_e_a,   now() - interval '10 days', v_u_admin, v_u_admin),
    (v_org, v_v_b, v_e_b,   now() - interval '10 days', v_u_admin, v_u_admin),
    (v_org, v_v_m, v_e_mgr, now() - interval '10 days', v_u_admin, v_u_admin);

  -- Din 0200 un vehicul are o singură foaie activă pe zi: foile de pe același
  -- vehicul (mai ales pool-ul) stau pe zile diferite, la distanță de o zi.
  -- Foile lui Bogdan, scrise de el (context de serviciu): o ciornă și una trimisă.
  insert into public.trip_sheets (id, organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                  created_by, updated_by) values
    (v_foaie_b, v_org, v_v_b, v_e_b, now() - interval '6 hours', 20000, v_u_b, v_u_b);
  insert into public.trip_sheets (id, organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                  sosire_la, km_sosire, status, created_by, updated_by) values
    (v_foaie_b2, v_org, v_v_b, v_e_b, now() - interval '30 hours', 20000,
     now() - interval '28 hours', 20050, 'trimis', v_u_b, v_u_b);

  -- ═══ employee ════════════════════════════════════════════════════════════

  -- (1) foaia pe mașina alocată
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                    created_by, updated_by)
    values (v_org, v_v_a, v_e_a, now() - interval '3 hours', 10000, v_u_a, v_u_a)
    returning id into v_foaie_a;
    reset role;
    raise notice '  ✓ (1) angajatul își întocmește foaia pe mașina alocată';
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) angajatul nu-și poate întocmi foaia: % (%)', sqlerrm, sqlstate;
  end;

  -- (2) alimentarea pe foaia proprie
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la,
                                     created_by, updated_by)
    values (v_org, v_foaie_a, 30, 210, now() - interval '2 hours', v_u_a, v_u_a)
    returning id into v_alim_a;
    reset role;
    raise notice '  ✓ (2) angajatul alimentează pe foaia proprie';
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) angajatul nu poate alimenta pe foaia proprie: % (%)', sqlerrm, sqlstate;
  end;

  -- (3) trimiterea spre aprobare, cu rânduri NUMĂRATE
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    -- Revizia F4: foaia se trimite doar cu cursele ei; sosirea o dă cursa.
    insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la,
                                         de_la_loc, pana_la_loc, scop, km_plecare, km_sosire,
                                         created_by, updated_by)
    values (v_org, v_foaie_a, now() - interval '3 hours', now() - interval '1 hour',
            'Sediu', 'Client', 'Livrare', 10000, 10120, v_u_a, v_u_a);
    update public.trip_sheets
       set status = 'trimis', updated_by = v_u_a
     where id = v_foaie_a;
    get diagnostics v_n = row_count;
    reset role;
    select status into v_status from public.trip_sheets where id = v_foaie_a;
    if v_n = 1 and v_status = 'trimis' then
      raise notice '  ✓ (3) angajatul își trimite foaia spre aprobare';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (3) trimiterea: % rânduri, stare %', v_n, v_status;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) angajatul nu-și poate trimite foaia: % (%)', sqlerrm, sqlstate;
  end;

  -- (4a) alimentarea pe foaia colegului
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la,
                                     created_by, updated_by)
    values (v_org, v_foaie_b, 30, 210, now() - interval '5 hours', v_u_a, v_u_a);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4a) angajatul a alimentat pe foaia colegului';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (4a) alimentarea pe foaia colegului e refuzată (42501)';
  end;

  -- (4b) scrierea foii colegului: USING o ascunde, zero rânduri
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  update public.trip_sheets set observatii = 'Scris de Ana.', updated_by = v_u_a where id = v_foaie_b;
  get diagnostics v_n = row_count;
  reset role;
  if v_n = 0 then
    raise notice '  ✓ (4b) foaia colegului nu se scrie (zero rânduri)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4b) angajatul a scris foaia colegului (% rânduri)', v_n;
  end if;

  -- (5a) mașina nealocată și non-pool
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                    created_by, updated_by)
    values (v_org, v_v_liber, v_e_a, now() - interval '3 hours', 50000, v_u_a, v_u_a);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5a) angajatul a întocmit foaie pe o mașină nealocată și non-pool';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (5a) mașina nealocată și non-pool e refuzată (P0001)';
  end;

  -- (5b) mașina colegului
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                    created_by, updated_by)
    values (v_org, v_v_b, v_e_a, now() - interval '3 hours', 20000, v_u_a, v_u_a);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5b) angajatul a întocmit foaie pe mașina colegului';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (5b) mașina colegului e refuzată (P0001)';
  end;

  -- (6) mașina pool
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                    created_by, updated_by)
    values (v_org, v_v_pool, v_e_a, now() - interval '50 minutes', 40000, v_u_a, v_u_a)
    returning id into v_foaie_pool;
    reset role;
    raise notice '  ✓ (6) angajatul întocmește foaia pe mașina pool';
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) angajatul nu poate folosi mașina pool: % (%)', sqlerrm, sqlstate;
  end;

  -- (7) foaia în numele colegului, chiar și pe pool
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                    created_by, updated_by)
    values (v_org, v_v_pool, v_e_b, now() - interval '40 minutes', 40000, v_u_a, v_u_a);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) angajatul a întocmit o foaie în numele colegului';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (7) foaia în numele colegului e refuzată (42501)';
  end;

  -- (8) vizibilitatea vehiculelor
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  select string_agg(right(nr_inmatriculare, 3), ',' order by right(nr_inmatriculare, 3)) into v_vazute
    from public.vehicles where organization_id = v_org and deleted_at is null;
  reset role;
  if v_vazute = 'RLA,RLP' then
    raise notice '  ✓ (8) angajatul vede mașina lui și pool-ul (%)', v_vazute;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) angajatul vede: % (așteptat RLA,RLP)', v_vazute;
  end if;

  -- (9) mașina proprie, dar într-o zi dinaintea alocării
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                    created_by, updated_by)
    values (v_org, v_v_a, v_e_a, now() - interval '20 days', 10200, v_u_a, v_u_a);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) foaia dinaintea alocării a fost acceptată';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (9) foaia dinaintea alocării e refuzată (P0001)';
  end;

  -- (10) ciorna de pe pool, mutată pe mașina colegului
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set vehicle_id = v_v_b, updated_by = v_u_a where id = v_foaie_pool;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10) ciorna a fost mutată pe mașina colegului';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (10) ciorna nu se mută pe mașina colegului (P0001)';
  end;

  -- ═══ manager ═════════════════════════════════════════════════════════════

  -- (11) propria foaie
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                    created_by, updated_by)
    values (v_org, v_v_m, v_e_mgr, now() - interval '3 hours', 30000, v_u_mgr, v_u_mgr);
    reset role;
    raise notice '  ✓ (11) managerul își întocmește propria foaie';
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (11) managerul nu-și poate întocmi foaia: % (%)', sqlerrm, sqlstate;
  end;

  -- (12) aprobarea foii trimise a subordonatei, cu rânduri numărate
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set status = 'aprobat', updated_by = v_u_mgr where id = v_foaie_a;
    get diagnostics v_n = row_count;
    reset role;
    select status into v_status from public.trip_sheets where id = v_foaie_a;
    if v_n = 1 and v_status = 'aprobat' then
      raise notice '  ✓ (12) managerul aprobă foaia subordonatei';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (12) aprobarea: % rânduri, stare %', v_n, v_status;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (12) managerul nu poate aproba: % (%)', sqlerrm, sqlstate;
  end;

  -- (13a) scrierea ciornei subordonatului
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set km_plecare = 20010, updated_by = v_u_mgr where id = v_foaie_b;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (13a) managerul a rescris kilometrajul ciornei subordonatului';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (13a) managerul nu scrie ciorna subordonatului (P0001)';
  end;

  -- (13b) trimiterea ciornei subordonatului (MGR-017, acum în bază)
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets
       set status = 'trimis', sosire_la = now() - interval '5 hours', km_sosire = 20100, updated_by = v_u_mgr
     where id = v_foaie_b;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (13b) managerul a trimis ciorna subordonatului';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (13b) managerul nu trimite ciorna subordonatului (P0001)';
  end;

  -- (13c) decizia care strecoară o cifră
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set status = 'aprobat', km_sosire = 20090, updated_by = v_u_mgr
     where id = v_foaie_b2;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (13c) managerul a schimbat kilometrajul odată cu aprobarea';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (13c) decizia nu schimbă cifrele foii (P0001)';
  end;

  -- (14) foaia în numele subordonatului
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                    created_by, updated_by)
    values (v_org, v_v_pool, v_e_b, now() - interval '30 minutes', 40000, v_u_mgr, v_u_mgr);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (14) managerul a întocmit o foaie în numele subordonatului';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (14) foaia în numele subordonatului e refuzată (42501)';
  end;

  -- (15) vizibilitatea vehiculelor pe echipă
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  select string_agg(right(nr_inmatriculare, 3), ',' order by right(nr_inmatriculare, 3)) into v_vazute
    from public.vehicles where organization_id = v_org and deleted_at is null;
  reset role;
  if v_vazute = 'RLA,RLB,RLM,RLP' then
    raise notice '  ✓ (15) managerul vede mașinile echipei și pool-ul (%)', v_vazute;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (15) managerul vede: % (așteptat RLA,RLB,RLM,RLP)', v_vazute;
  end if;

  -- ═══ hr ══════════════════════════════════════════════════════════════════

  -- (16) nimic pe flotă
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  select (select count(*) from public.trip_sheets where organization_id = v_org)
       + (select count(*) from public.vehicles where organization_id = v_org) into v_n;
  begin
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                    created_by, updated_by)
    values (v_org, v_v_pool, v_e_hr, now() - interval '20 minutes', 40000, v_u_hr, v_u_hr);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (16) hr a întocmit o foaie de parcurs';
  exception when insufficient_privilege then
    reset role;
    if v_n = 0 then
      raise notice '  ✓ (16) hr nu vede nimic pe flotă și nu întocmește foi (42501)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (16) hr vede % rânduri de flotă', v_n;
    end if;
  end;

  -- ═══ org_admin ═══════════════════════════════════════════════════════════

  -- (17) orice șofer, orice vehicul activ, fără alocare
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                    created_by, updated_by)
    values (v_org, v_v_liber, v_e_b, now() - interval '3 hours', 50000, v_u_admin, v_u_admin);
    reset role;
    raise notice '  ✓ (17) org_admin întocmește foaia pentru oricine, fără alocare';
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (17) org_admin nu poate întocmi foaia: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ Storage: app.can_path ═══════════════════════════════════════════════

  -- (18) căile foilor: subordonatul da, străinul de echipă nu
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  select app.can_path(v_org::text || '/trip_sheets/' || v_e_a::text || '/bon.jpg', 'read')
         and not app.can_path(v_org::text || '/trip_sheets/' || v_e_c::text || '/bon.jpg', 'read')
    into v_poate;
  reset role;
  if v_poate then
    raise notice '  ✓ (18) managerul citește foile subordonatei, nu și ale străinului de echipă';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (18) can_path pe trip_sheets la scope team nu se uită la entitate';
  end if;

  -- (19) căile vehiculelor pentru angajat
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  select app.can_path(v_org::text || '/vehicles/' || v_v_a::text || '/itp.pdf', 'read')
         and app.can_path(v_org::text || '/vehicles/' || v_v_pool::text || '/itp.pdf', 'read')
         and not app.can_path(v_org::text || '/vehicles/' || v_v_b::text || '/itp.pdf', 'read')
    into v_poate;
  reset role;
  if v_poate then
    raise notice '  ✓ (19) angajatul citește calea mașinii lui și a pool-ului, nu a colegului';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (19) can_path pe vehicles la scope own';
  end if;

  -- (20) căile vehiculelor pentru manager
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  select app.can_path(v_org::text || '/vehicles/' || v_v_b::text || '/itp.pdf', 'read')
         and not app.can_path(v_org::text || '/vehicles/' || v_v_liber::text || '/itp.pdf', 'read')
    into v_poate;
  reset role;
  if v_poate then
    raise notice '  ✓ (20) managerul citește calea mașinii subordonatului, nu a mașinii fără șofer';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (20) can_path pe vehicles la scope team nu se uită la entitate';
  end if;

  -- ═══ Revizia de securitate ═══════════════════════════════════════════════

  -- Foile managerului (context de serviciu): una trimisă și o ciornă, ambele pe
  -- pool, plus o foaie pe subordonat întocmită DE manager (stare moștenită).
  insert into public.trip_sheets (id, organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                  sosire_la, km_sosire, status, created_by, updated_by) values
    (v_foaie_m1, v_org, v_v_pool, v_e_mgr, now() - interval '10 days', 40000,
     now() - interval '10 days' + interval '1 hour', 40030, 'trimis', v_u_mgr, v_u_mgr),
    (v_foaie_m3, v_org, v_v_pool, v_e_b,   now() - interval '8 days', 40000,
     now() - interval '8 days' + interval '1 hour', 40030, 'trimis', v_u_mgr, v_u_mgr);
  insert into public.trip_sheets (id, organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                  created_by, updated_by) values
    (v_foaie_m2, v_org, v_v_pool, v_e_mgr, now() - interval '9 days', 40000, v_u_mgr, v_u_mgr);

  -- (21) un singur UPDATE: foaia proprie trimisă devine a subordonatului, aprobată
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set employee_id = v_e_b, status = 'aprobat', updated_by = v_u_mgr
     where id = v_foaie_m1;
    get diagnostics v_n = row_count;
    reset role;
    if v_n = 0 then
      raise notice '  ✓ (21) foaia proprie nu devine aprobată pe subordonat (zero rânduri)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (21) managerul și-a aprobat foaia mutând-o pe subordonat';
    end if;
  exception when raise_exception or insufficient_privilege then
    reset role;
    raise notice '  ✓ (21) foaia proprie nu devine aprobată pe subordonat (%)', sqlstate;
  end;

  -- (22) primul din cei doi pași: mutarea ciornei pe subordonat
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set employee_id = v_e_b, updated_by = v_u_mgr where id = v_foaie_m2;
    get diagnostics v_n = row_count;
    reset role;
    if v_n = 0 then
      raise notice '  ✓ (22) ciorna proprie nu se mută pe subordonat (zero rânduri)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (22) managerul și-a mutat ciorna pe subordonat';
    end if;
  exception when raise_exception or insufficient_privilege then
    reset role;
    raise notice '  ✓ (22) ciorna proprie nu se mută pe subordonat (%)', sqlstate;
  end;

  -- (23) aprobarea unei foi întocmite de el, pe subordonat
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set status = 'aprobat', updated_by = v_u_mgr where id = v_foaie_m3;
    get diagnostics v_n = row_count;
    reset role;
    if v_n = 0 then
      raise notice '  ✓ (23) foaia întocmită de manager nu se aprobă de el (zero rânduri)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (23) managerul a aprobat o foaie întocmită de el însuși';
    end if;
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (23) foaia întocmită de manager nu se aprobă de el (P0001)';
  end;

  -- (24) anomaliile pe pool: a colegului nu, a mea da. Inserate din contextul de
  -- serviciu (politica de INSERT le rezervă motorului).
  insert into public.trip_sheets (id, organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                  created_by, updated_by) values
    (v_foaie_bp, v_org, v_v_pool, v_e_b, now() - interval '7 days', 41000, v_u_b, v_u_b);
  insert into public.odometer_anomalies (id, organization_id, vehicle_id, trip_sheet_id,
                                         km_asteptat, km_declarat, tip) values
    (v_anom_b, v_org, v_v_pool, v_foaie_bp,   40000, 45000, 'salt'),
    (v_anom_a, v_org, v_v_pool, v_foaie_pool, 40000, 46000, 'salt');
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  select count(*) into v_n from public.vehicles where id = v_v_pool;
  select string_agg(case id when v_anom_a then 'a mea' when v_anom_b then 'a colegului' end, ',' order by id = v_anom_b)
    into v_vazute
    from public.odometer_anomalies where id in (v_anom_a, v_anom_b);
  reset role;
  if v_n = 1 and v_vazute = 'a mea' then
    raise notice '  ✓ (24) angajatul vede pool-ul și anomalia lui, nu și a colegului';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (24) pool vizibil: %, anomalii văzute: %', v_n, v_vazute;
  end if;

  -- ═══ Foaia APROBATĂ, după ce șoferul a primit update = own (santinela) ═══
  --
  -- Foaia Anei (v_foaie_a) a fost aprobată la (12) și are alimentarea de la (2).
  -- Înainte de 0199, nici angajatul, nici managerul n-aveau `trip_sheets:update`,
  -- deci gărzile foii aprobate le atingea doar administratorul.

  -- (25) șoferul nu-și rescrie foaia aprobată: traseu, scop, semnătura aprobării
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets
       set traseu = 'Cluj-Viena', scop = 'personal', aprobat_de = v_u_admin, updated_by = v_u_a
     where id = v_foaie_a;
    get diagnostics v_n = row_count;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (25) șoferul și-a rescris foaia aprobată (% rânduri)', v_n;
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (25) șoferul nu-și rescrie foaia aprobată (P0001)';
  end;

  -- (26) șoferul nu-și șterge alimentarea de pe foaia aprobată. ÎNAINTEA lui
  -- (28): pe o foaie deja ștearsă, alimentarea ar cădea pe garda de firmă și
  -- verificarea ar trece fără să probeze nimic.
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.fuel_entries set deleted_at = now(), updated_by = v_u_a where id = v_alim_a;
    get diagnostics v_n = row_count;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (26) șoferul a șters alimentarea foii aprobate (% rânduri)', v_n;
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (26) alimentarea foii aprobate nu se șterge (P0001)';
  end;

  -- (27) nici nu o mută pe o ciornă a lui. Ciorna începe ÎNAINTEA alimentării,
  -- ca singurul motiv de refuz să fie foaia aprobată de pe care pleacă.
  insert into public.trip_sheets (id, organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                  created_by, updated_by) values
    (v_foaie_x, v_org, v_v_pool, v_e_a, now() - interval '6 days', 40000, v_u_a, v_u_a);
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.fuel_entries set trip_sheet_id = v_foaie_x, updated_by = v_u_a where id = v_alim_a;
    get diagnostics v_n = row_count;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (27) alimentarea a plecat de pe foaia aprobată (% rânduri)', v_n;
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (27) alimentarea nu pleacă de pe foaia aprobată (P0001)';
  end;

  -- (28) șoferul nu-și stornează singur foaia aprobată
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set deleted_at = now(), updated_by = v_u_a where id = v_foaie_a;
    get diagnostics v_n = row_count;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (28) șoferul și-a șters foaia aprobată (% rânduri)', v_n;
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (28) șoferul nu-și șterge foaia aprobată (P0001)';
  end;

  -- (29) semnătura aprobării nu se scrie fără decizie, pe nicio stare: ciorna
  -- de pe pool rămâne nesemnată, cu un rând scris (observația trece)
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets
       set observatii = 'Cu semnătură strecurată.', aprobat_de = v_u_admin, aprobat_la = now(),
           trimis_la = now(), created_by = v_u_b, updated_by = v_u_a
     where id = v_foaie_pool;
    get diagnostics v_n = row_count;
    reset role;
    select case when aprobat_de is null and aprobat_la is null and trimis_la is null
                     and created_by = v_u_a and observatii = 'Cu semnătură strecurată.'
                then 'curat' else 'forjat' end
      into v_status from public.trip_sheets where id = v_foaie_pool;
    if v_n = 1 and v_status = 'curat' then
      raise notice '  ✓ (29) ciorna se scrie, dar semnătura și autorul rămân ale bazei';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (29) % rânduri, ciorna e %', v_n, v_status;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (29) ciorna nu se mai scrie: % (%)', sqlerrm, sqlstate;
  end;

  -- (30) nici administratorul nu rescrie cifrele sau textul foii aprobate
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set scop = 'Rescris de admin.', updated_by = v_u_admin where id = v_foaie_a;
    get diagnostics v_n = row_count;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (30) administratorul a rescris foaia aprobată (% rânduri)', v_n;
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (30) foaia aprobată nu se rescrie nici de administrator (P0001)';
  end;

  -- (31) administratorul o stornează: ștergere logică, un rând [POZITIVĂ]
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set deleted_at = now(), updated_by = v_u_admin where id = v_foaie_a;
    get diagnostics v_n = row_count;
    reset role;
    if v_n = 1 then
      raise notice '  ✓ (31) administratorul stornează foaia aprobată (1 rând)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (31) stornarea: % rânduri', v_n;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (31) administratorul nu poate storna: % (%)', sqlerrm, sqlstate;
  end;

  -- (32) șoferul nu reînvie foaia stornată (ar anula stornarea administratorului)
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set deleted_at = null, updated_by = v_u_a where id = v_foaie_a;
    get diagnostics v_n = row_count;
    reset role;
    if v_n = 0 then
      raise notice '  ✓ (32) șoferul nu reînvie foaia stornată (zero rânduri)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (32) șoferul a reînviat foaia stornată (% rânduri)', v_n;
    end if;
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (32) șoferul nu reînvie foaia stornată (P0001)';
  end;

  -- ═══ Foaia TRIMISĂ, după ce șoferul a primit update = own (revizia F3) ═══
  --
  -- Regresul de kilometraj se verifică doar la întocmire și la trecerea
  -- draft → trimis. Pe o foaie deja trimisă, șoferul cu `update = own` cobora
  -- kilometrajul de plecare sub ultimul cunoscut (aici 20000) sau umfla sosirea,
  -- iar aprobarea pecetluia cifrele fără nicio verificare. Foaia lui Bogdan
  -- (v_foaie_b2) e trimisă, cu 20000 → 20050.

  -- (33) șoferul NU coboară kilometrajul de plecare pe foaia trimisă
  perform set_config('request.jwt.claim.sub', v_u_b::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set km_plecare = 19000, updated_by = v_u_b where id = v_foaie_b2;
    get diagnostics v_n = row_count;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (33) șoferul a coborât km de plecare pe foaia trimisă (% rânduri)', v_n;
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (33) foaia trimisă nu-și schimbă kilometrajul de plecare (P0001)';
  end;

  -- (34) nici nu umflă sosirea, refăcând închiderea pe o foaie deja trimisă
  perform set_config('request.jwt.claim.sub', v_u_b::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets
       set status = 'trimis', km_sosire = 20900, updated_by = v_u_b
     where id = v_foaie_b2;
    get diagnostics v_n = row_count;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (34) șoferul a rescris sosirea foii trimise (% rânduri)', v_n;
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (34) foaia trimisă nu-și rescrie sosirea (P0001)';
  end;

  -- (35) dar își poate retrage foaia în ciornă, fără altă schimbare [POZITIVĂ]
  perform set_config('request.jwt.claim.sub', v_u_b::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set status = 'draft', updated_by = v_u_b where id = v_foaie_b2;
    get diagnostics v_n = row_count;
    reset role;
    select status into v_status from public.trip_sheets where id = v_foaie_b2;
    if v_n = 1 and v_status = 'draft' then
      raise notice '  ✓ (35) șoferul își retrage foaia trimisă în ciornă (1 rând)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (35) retragerea: % rânduri, stare %', v_n, v_status;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (35) șoferul nu-și poate retrage foaia: % (%)', sqlerrm, sqlstate;
  end;

  -- (36) pe ciornă corectează, dar regresul cade la retrimitere (P0001)
  perform set_config('request.jwt.claim.sub', v_u_b::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set km_plecare = 19000, updated_by = v_u_b where id = v_foaie_b2;
    update public.trip_sheets set status = 'trimis', updated_by = v_u_b where id = v_foaie_b2;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (36) foaia cu regres de kilometraj a fost retrimisă';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (36) regresul pus pe ciornă cade la retrimitere (P0001)';
  end;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA FLOTA ROLURI: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE cele 40 de verificări au trecut.';
  raise notice '';
end;
$$;
