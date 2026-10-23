-- tests/rls/proba-securitate-reziduala.sql
--
-- RESTURILE DE SECURITATE ALE LIVRĂRII (X2), cu rânduri numărate și mesaje
-- comparate, pe bancul local. Fiecare verificare a picat pe baza de dinainte
-- (ba781f3a) și trece după 0226 + reparațiile pe loc din 0200/0206/0214/0215.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- Oracolul de existență între firme (0226 §1)
-- (1a) hr_read_sensitive: id inexistent și fișa altei firme → ACELAȘI răspuns;
-- (1b) hr_write_sensitive: la fel;
-- (1c) seed_leave_balances: la fel;
-- (1d) managerul din altă firmă și managerul inexistent → același răspuns;
-- (1e) fișa proprie fără date sensibile ajunge la mesajul ei       [POZITIVĂ];
-- Șoferul șters logic (0206)
-- (2a) desemnarea unei fișe șterse logic: P0001; a uneia vii: 1 rând [POZITIVĂ];
-- (2b) incidentul pe o fișă ștearsă logic: P0001;
-- Registrul încărcărilor (0226 §3) și repotrivirea atomică (0214 §11b)
-- (3a) org_admin înregistrează lotul                                [POZITIVĂ];
-- (3b) o cale în afara lotului (folderul unui vehicul): 23514;
-- (3c) hr (fără vehicles:create) nu înregistrează un lot de vehicule: 42501;
-- (3d) org_admin-ul altei firme și un coleg nu consumă lotul: 0 rânduri;
-- (3e) creatorul îl consumă o dată (1 rând), a doua oară 0 rânduri, iar
--      consumul nu se poate rescrie (P0001);
-- (3f) repotrivirea cu un rând imposibil: P0001 și NIMIC scris; cea bună: 2 rânduri;
-- super_admin pe foi (0226 §2)
-- (5)  super_admin (platform_admins, NU membru) vede foaia; nu o modifică;
-- Kilometrajul în mesajul de regres (0200)
-- (6a) org_admin-ul altei firme, cu rândul pus pe firma noastră: refuz neutru,
--      fără kilometrajul vehiculului;
-- (6b) hr (fără drept pe vehicule): refuzul de regres fără cifră;
-- (6c) org_admin-ul firmei vede cifra în mesaj                     [POZITIVĂ];
-- Cheile străine compuse (evaluare)
-- (8)  `driver_licenses_angajat_fk`: id inexistent și fișa altei firme → același
--      cod și același mesaj (nicio sondă).
--
-- Plafonul șabloanelor sub concurență (7) NU e aici: o probă într-o singură
-- tranzacție nu poate rula două scrieri simultane. Testul de concurență e
-- separat, cu două sesiuni psql (raportul X2).
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

begin;

-- Rulează `p_sql` sub identitatea lui `p_user` și întoarce `ok:<rânduri>` sau
-- `<sqlstate>:<mesaj>`. Eroarea nu iese din funcție: proba o citește.
create function pg_temp.ruleaza(p_user uuid, p_sql text) returns text
language plpgsql as $f$
declare
  v_n bigint;
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  set local role authenticated;
  begin
    execute p_sql;
    get diagnostics v_n = row_count;
    reset role;
    return 'ok:' || v_n::text;
  exception when others then
    reset role;
    return sqlstate || ':' || sqlerrm;
  end;
end
$f$;

-- Un număr sub identitatea lui `p_user`; -1 la eroare.
create function pg_temp.numara(p_user uuid, p_sql text) returns bigint
language plpgsql as $f$
declare
  v_n bigint;
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  set local role authenticated;
  execute p_sql into v_n;
  reset role;
  return v_n;
exception when others then
  reset role;
  return -1;
end
$f$;

create function pg_temp.verifica(p_nr text, p_ok boolean, p_mesaj text, p_detaliu text default '') returns int
language plpgsql as $f$
begin
  if coalesce(p_ok, false) then
    raise notice '  ✓ (%) %', p_nr, p_mesaj;
    return 0;
  end if;
  raise warning '  ✗ (%) % [%]', p_nr, p_mesaj, p_detaliu;
  return 1;
end
$f$;

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_zi       date := app.azi_local();
  v_org      uuid := gen_random_uuid();
  v_org_b    uuid := gen_random_uuid();
  v_u_admin  uuid := gen_random_uuid();
  v_u_admin2 uuid := gen_random_uuid();
  v_u_hr     uuid := gen_random_uuid();
  v_u_b      uuid := gen_random_uuid();
  v_u_sa     uuid := gen_random_uuid();
  v_e_viu    uuid := gen_random_uuid();
  v_e_sters  uuid := gen_random_uuid();
  v_e_b      uuid := gen_random_uuid();
  v_inexist  uuid := gen_random_uuid();
  v_veh      uuid := gen_random_uuid();
  v_amenda   uuid := gen_random_uuid();
  v_foaie    uuid := gen_random_uuid();
  v_lot      uuid := gen_random_uuid();
  v_import   uuid := gen_random_uuid();
  v_tx1      uuid := gen_random_uuid();
  v_tx2      uuid := gen_random_uuid();
  v_a        text;
  v_b        text;
  v_c        text;
  v_n        bigint;
  v_m        bigint;
  v_esecuri  int := 0;
begin
  raise notice '';
  raise notice '  PROBA „SECURITATE REZIDUALĂ” (X2: 0200, 0206, 0214, 0215, 0226)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-x2-' || v_sufix, 'Proba X2 SRL',
     'RO' || (87000000 + (random() * 900000)::int)::text),
    (v_org_b, 'proba-x2-b-' || v_sufix, 'Altă Firmă X2 SRL',
     'RO' || (86000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select o, f.feature_key, true, now() from public.features f, unnest(array[v_org, v_org_b]) o;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_admin,  'x2-adm-'  || v_sufix || '@proba.test', now()),
    (v_u_admin2, 'x2-adm2-' || v_sufix || '@proba.test', now()),
    (v_u_hr,     'x2-hr-'   || v_sufix || '@proba.test', now()),
    (v_u_b,      'x2-b-'    || v_sufix || '@proba.test', now()),
    (v_u_sa,     'x2-sa-'   || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_admin, 'org_admin'),
    (v_org, v_u_admin2, 'org_admin'),
    (v_org, v_u_hr, 'hr'),
    (v_org_b, v_u_b, 'org_admin');
  insert into public.platform_admins (user_id) values (v_u_sa);

  insert into public.employees (id, organization_id, marca, first_name, last_name, hired_on, status) values
    (v_e_viu,   v_org,   'X2-V', 'Vasile', 'Viu',     v_zi - 400, 'activ'),
    (v_e_sters, v_org,   'X2-S', 'Sorin',  'Șters',   v_zi - 400, 'activ'),
    (v_e_b,     v_org_b, 'X2-B', 'Bianca', 'Străină', v_zi - 400, 'activ');
  update public.employees set deleted_at = now() where id = v_e_sters;

  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent,
                               created_by, updated_by)
  values (v_veh, v_org, 'B' || (100 + (random() * 800)::int)::text || 'XDO', 'Dacia', 'Logan', 10000,
          v_u_admin, v_u_admin);

  -- ═══ (1) Oracolul de existență ═══════════════════════════════════════════
  v_a := pg_temp.ruleaza(v_u_admin, format('select * from public.hr_read_sensitive(%L)', v_inexist));
  v_b := pg_temp.ruleaza(v_u_admin, format('select * from public.hr_read_sensitive(%L)', v_e_b));
  v_esecuri := v_esecuri + pg_temp.verifica('1a', v_a like 'P0001:%' and v_a = v_b,
    'hr_read_sensitive: id inexistent și fișa altei firme primesc același răspuns',
    v_a || ' ≠ ' || v_b);

  v_a := pg_temp.ruleaza(v_u_admin, format(
    'select public.hr_write_sensitive(p_employee := %L, p_banca := %L)', v_inexist, 'Banca X'));
  v_b := pg_temp.ruleaza(v_u_admin, format(
    'select public.hr_write_sensitive(p_employee := %L, p_banca := %L)', v_e_b, 'Banca X'));
  v_esecuri := v_esecuri + pg_temp.verifica('1b', v_a like 'P0001:%' and v_a = v_b,
    'hr_write_sensitive: același răspuns pentru inexistent și pentru altă firmă',
    v_a || ' ≠ ' || v_b);

  v_a := pg_temp.ruleaza(v_u_admin, format('select public.seed_leave_balances(%L, 2026)', v_inexist));
  v_b := pg_temp.ruleaza(v_u_admin, format('select public.seed_leave_balances(%L, 2026)', v_e_b));
  v_esecuri := v_esecuri + pg_temp.verifica('1c', v_a like 'P0001:%' and v_a = v_b,
    'seed_leave_balances: același răspuns pentru inexistent și pentru altă firmă',
    v_a || ' ≠ ' || v_b);

  v_a := pg_temp.ruleaza(v_u_admin, format(
    'update public.employees set manager_employee_id = %L where id = %L', v_inexist, v_e_viu));
  v_b := pg_temp.ruleaza(v_u_admin, format(
    'update public.employees set manager_employee_id = %L where id = %L', v_e_b, v_e_viu));
  v_esecuri := v_esecuri + pg_temp.verifica('1d', v_a like 'P0001:%' and v_a = v_b,
    'managerul inexistent și managerul din altă firmă primesc același răspuns',
    v_a || ' ≠ ' || v_b);

  v_a := pg_temp.ruleaza(v_u_admin, format('select * from public.hr_read_sensitive(%L)', v_e_viu));
  v_esecuri := v_esecuri + pg_temp.verifica('1e', v_a = 'P0001:Angajatul nu are date sensibile înregistrate.',
    'fișa proprie, fără date sensibile, trece de gărzi și primește mesajul ei', v_a);

  -- ═══ (2) Șoferul șters logic ═════════════════════════════════════════════
  insert into public.vehicle_fines (id, organization_id, vehicle_id, numar_pv, constatata_la, fapta,
                                    created_by, updated_by)
  values (v_amenda, v_org, v_veh, 'PV-X2-' || v_sufix, now() - interval '3 days', 'Depășirea vitezei',
          v_u_admin, v_u_admin);
  v_a := pg_temp.ruleaza(v_u_admin, format(
    $q$update public.vehicle_fines set stadiu = 'sofer_desemnat', sofer_desemnat_id = %L, updated_by = %L
       where id = %L$q$, v_e_sters, v_u_admin, v_amenda));
  v_b := pg_temp.ruleaza(v_u_admin, format(
    $q$update public.vehicle_fines set stadiu = 'sofer_desemnat', sofer_desemnat_id = %L, updated_by = %L
       where id = %L$q$, v_e_viu, v_u_admin, v_amenda));
  v_esecuri := v_esecuri + pg_temp.verifica('2a', v_a like 'P0001:Șoferul desemnat nu există%' and v_b = 'ok:1',
    'desemnarea unei fișe șterse logic: P0001; a uneia vii: 1 rând', v_a || ' / ' || v_b);

  v_a := pg_temp.ruleaza(v_u_admin, format(
    $q$insert into public.vehicle_incidents (organization_id, vehicle_id, tip, produs_la, descriere, sofer_id,
                                             created_by, updated_by)
       values (%L, %L, 'avarie', now() - interval '2 days', 'Zgârietură pe ușă', %L, %L, %L)$q$,
    v_org, v_veh, v_e_sters, v_u_admin, v_u_admin));
  v_esecuri := v_esecuri + pg_temp.verifica('2b', v_a like 'P0001:Șoferul incidentului nu există%',
    'incidentul pe o fișă ștearsă logic: P0001', v_a);

  -- ═══ (3) Registrul încărcărilor ══════════════════════════════════════════
  v_a := pg_temp.ruleaza(v_u_admin, format(
    $q$insert into public.import_uploads (id, organization_id, resursa, cale, created_by, updated_by)
       values (%L, %L, 'vehicles', %L, %L, %L)$q$,
    v_lot, v_org, v_org::text || '/vehicles/' || v_lot::text || '/' || gen_random_uuid()::text || '-extras.csv',
    v_u_admin, v_u_admin));
  v_esecuri := v_esecuri + pg_temp.verifica('3a', v_a = 'ok:1',
    'org_admin înregistrează lotul emis de server (1 rând)', v_a);

  v_b := gen_random_uuid()::text;
  v_a := pg_temp.ruleaza(v_u_admin, format(
    $q$insert into public.import_uploads (id, organization_id, resursa, cale, created_by, updated_by)
       values (%L, %L, 'vehicles', %L, %L, %L)$q$,
    v_b, v_org, v_org::text || '/vehicles/' || v_veh::text || '/' || gen_random_uuid()::text || '-rca.xlsx',
    v_u_admin, v_u_admin));
  v_esecuri := v_esecuri + pg_temp.verifica('3b', v_a like '23514:%iup_cale_ck%',
    'o cale în afara lotului (folderul unui vehicul) e refuzată: 23514', v_a);

  v_b := gen_random_uuid()::text;
  v_a := pg_temp.ruleaza(v_u_hr, format(
    $q$insert into public.import_uploads (id, organization_id, resursa, cale, created_by, updated_by)
       values (%L, %L, 'vehicles', %L, %L, %L)$q$,
    v_b, v_org, v_org::text || '/vehicles/' || v_b || '/x.csv', v_u_hr, v_u_hr));
  v_esecuri := v_esecuri + pg_temp.verifica('3c', v_a like '42501:%',
    'hr (fără vehicles:create) nu înregistrează un lot de vehicule: 42501', v_a);

  v_a := pg_temp.ruleaza(v_u_b, format(
    'update public.import_uploads set consumat_la = now(), updated_by = %L where id = %L and consumat_la is null',
    v_u_b, v_lot));
  v_b := pg_temp.ruleaza(v_u_admin2, format(
    'update public.import_uploads set consumat_la = now(), updated_by = %L where id = %L and consumat_la is null',
    v_u_admin2, v_lot));
  v_esecuri := v_esecuri + pg_temp.verifica('3d', v_a = 'ok:0' and v_b = 'ok:0',
    'org_admin-ul altei firme și un coleg org_admin nu consumă lotul (0 rânduri)', v_a || ' / ' || v_b);

  v_a := pg_temp.ruleaza(v_u_admin, format(
    'update public.import_uploads set consumat_la = now(), updated_by = %L where id = %L and consumat_la is null',
    v_u_admin, v_lot));
  v_b := pg_temp.ruleaza(v_u_admin, format(
    'update public.import_uploads set consumat_la = now(), updated_by = %L where id = %L and consumat_la is null',
    v_u_admin, v_lot));
  v_c := pg_temp.ruleaza(v_u_admin, format(
    $q$update public.import_uploads set consumat_la = now() + interval '1 hour', updated_by = %L where id = %L$q$,
    v_u_admin, v_lot));
  v_esecuri := v_esecuri + pg_temp.verifica('3e', v_a = 'ok:1' and v_b = 'ok:0' and v_c like 'P0001:%',
    'creatorul consumă lotul o dată (1 rând), a doua oară 0 rânduri, iar consumul nu se rescrie (P0001)',
    v_a || ' / ' || v_b || ' / ' || v_c);

  -- Repotrivirea: două tranzacții ale unui import, scrise ca superuser.
  insert into public.fuel_card_imports (id, organization_id, emitent, fisier_nume, fisier_sha256,
                                        perioada_de_la, perioada_pana_la, randuri_fisier, created_by, updated_by)
  values (v_import, v_org, 'omv', 'extras.csv', repeat('a', 64), v_zi - 5, v_zi - 1, 2, v_u_admin, v_u_admin);
  insert into public.fuel_card_transactions (id, organization_id, import_id, emitent, cheie_dedup, rand_fisier,
                                             efectuat_la, produs, categorie, valoare_bruta, stare_potrivire,
                                             motiv, created_by, updated_by)
  values
    (v_tx1, v_org, v_import, 'omv', 'x2-cheie-1-' || v_sufix, 1, now() - interval '3 days', 'Motorina',
     'combustibil', 250, 'card_necunoscut', 'vechi', v_u_admin, v_u_admin),
    (v_tx2, v_org, v_import, 'omv', 'x2-cheie-2-' || v_sufix, 2, now() - interval '2 days', 'Motorina',
     'combustibil', 300, 'card_necunoscut', 'vechi', v_u_admin, v_u_admin);

  v_a := pg_temp.ruleaza(v_u_admin, format(
    'select public.repotriveste_tranzactii_card(%L, %L::jsonb)', v_org,
    jsonb_build_array(jsonb_build_object('id', v_tx1, 'motiv', 'nou'),
                      jsonb_build_object('id', v_inexist, 'motiv', 'nou'))));
  select count(*) into v_n from public.fuel_card_transactions where id in (v_tx1, v_tx2) and motiv = 'vechi';
  v_b := pg_temp.ruleaza(v_u_admin, format(
    'select public.repotriveste_tranzactii_card(%L, %L::jsonb)', v_org,
    jsonb_build_array(jsonb_build_object('id', v_tx1, 'motiv', 'nou', 'stare_potrivire', 'vehicul_necunoscut'),
                      jsonb_build_object('id', v_tx2, 'motiv', 'nou'))));
  select count(*) into v_m from public.fuel_card_transactions
   where id in (v_tx1, v_tx2) and motiv = 'nou' and updated_by = v_u_admin;
  v_esecuri := v_esecuri + pg_temp.verifica('3f', v_a like 'P0001:Tranzacția s-a schimbat%' and v_n = 2
                                                   and v_b = 'ok:1' and v_m = 2,
    'repotrivirea cu un rând imposibil: P0001 și nimic scris (2 rânduri neatinse); cea bună: 2 rânduri',
    format('%s, neatinse %s; %s, scrise %s', v_a, v_n, v_b, v_m));

  -- ═══ (5) super_admin pe foi ══════════════════════════════════════════════
  insert into public.trip_sheets (id, organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                  created_by, updated_by)
  values (v_foaie, v_org, v_veh, v_e_viu, now() - interval '1 day', 10000, v_u_admin, v_u_admin);
  v_n := pg_temp.numara(v_u_sa, format('select count(*) from public.trip_sheets where id = %L', v_foaie));
  v_a := pg_temp.ruleaza(v_u_sa, format(
    $q$update public.trip_sheets set scop = 'x' where id = %L$q$, v_foaie));
  v_esecuri := v_esecuri + pg_temp.verifica('5', v_n = 1 and (v_a = 'ok:0' or v_a like '42501:%'),
    'super_admin (platform_admins, NU membru) vede foaia (1 rând) și n-o modifică',
    format('vede %s, scrierea %s', v_n, v_a));

  -- ═══ (6) Kilometrajul în mesajul de regres ═══════════════════════════════
  v_a := pg_temp.ruleaza(v_u_b, format(
    $q$insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                      created_by, updated_by)
       values (%L, %L, %L, now(), 1, %L, %L)$q$, v_org, v_veh, v_e_viu, v_u_b, v_u_b));
  v_esecuri := v_esecuri + pg_temp.verifica('6a', v_a not like 'ok:%' and v_a not like '%10000%',
    'org_admin-ul altei firme, cu rândul pus pe firma noastră: refuz fără kilometrajul vehiculului', v_a);

  v_a := pg_temp.ruleaza(v_u_hr, format(
    $q$insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                      created_by, updated_by)
       values (%L, %L, %L, now(), 1, %L, %L)$q$, v_org, v_veh, v_e_viu, v_u_hr, v_u_hr));
  v_esecuri := v_esecuri + pg_temp.verifica('6b', v_a not like 'ok:%' and v_a not like '%10000%',
    'hr (fără drept pe vehicule): refuzul nu spune kilometrajul vehiculului', v_a);

  v_a := pg_temp.ruleaza(v_u_admin, format(
    $q$insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                      created_by, updated_by)
       values (%L, %L, %L, now() - interval '2 days', 1, %L, %L)$q$, v_org, v_veh, v_e_viu, v_u_admin, v_u_admin));
  v_esecuri := v_esecuri + pg_temp.verifica('6c', v_a like 'P0001:Kilometrajul de plecare (1 km)%(10000 km)%',
    'org_admin-ul firmei, care vede vehiculul, primește cifra în mesaj', v_a);

  -- ═══ (8) Cheile străine compuse (evaluare) ═══════════════════════════════
  v_a := pg_temp.ruleaza(v_u_hr, format(
    $q$insert into public.driver_licenses (organization_id, employee_id, numar, categorii, expira_la,
                                          created_by, updated_by)
       values (%L, %L, 'AB123451', array['B'], %L, %L, %L)$q$, v_org, v_inexist, v_zi + 300, v_u_hr, v_u_hr));
  v_b := pg_temp.ruleaza(v_u_hr, format(
    $q$insert into public.driver_licenses (organization_id, employee_id, numar, categorii, expira_la,
                                          created_by, updated_by)
       values (%L, %L, 'AB123452', array['B'], %L, %L, %L)$q$, v_org, v_e_b, v_zi + 300, v_u_hr, v_u_hr));
  -- Ambele trebuie să ajungă la CHEIA STRĂINĂ (nu la o regulă de formă de
  -- dinainte): altfel egalitatea ar trece pentru alt motiv decât cel probat.
  v_esecuri := v_esecuri + pg_temp.verifica('8', v_a like '23503:%driver_licenses_angajat_fk%' and v_a = v_b,
    'cheia compusă spre employees: inexistent și altă firmă dau același cod și același mesaj',
    v_a || ' ≠ ' || v_b);

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA SECURITATE REZIDUALĂ: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE verificările au trecut.';
  raise notice '';
end;
$$;

rollback;
