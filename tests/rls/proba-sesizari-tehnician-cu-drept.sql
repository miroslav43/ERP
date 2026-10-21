-- tests/rls/proba-sesizari-tehnician-cu-drept.sql
--
-- MENTENANȚĂ M3, DUPĂ 0212 §3b: TEHNICIANUL ATRIBUIT TREBUIE SĂ POATĂ DESCHIDE
-- SESIZAREA.
--
-- Defectul: selectorul de tehnician oferea orice fișă a firmei, iar baza primea
-- atribuirea unui angajat al cărui rol n-are `maintenance:read` (de ex. `hr`).
-- Sesizarea atribuită lui nu i se deschidea. Acum baza refuză (P0001), iar
-- `public.tehnicieni_mentenanta` dă selectorului exact fișele care trec.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- (1)  org_admin atribuie un `employee` (read = own în seed)            [POZITIVĂ];
-- (2)  org_admin atribuie fișa unui `hr` (niciun rând `maintenance`): P0001;
-- (3)  suprascrierea PE MEMBRU `maintenance:read = none` scoate un employee: P0001;
-- (4)  suprascrierea PE ORGANIZAȚIE `hr` → `maintenance:read = own` îl face
--      eligibil pe hr                                                   [POZITIVĂ];
-- (5)  fișa fără cont: P0001; contul suspendat în firmă: P0001;
-- (6)  fișa altei firme: tot mesajul gărzii din 0181 („nu aparține organizației”);
-- (7)  INSERT cu tehnician fără drept (gestionarul sesizează și atribuie): P0001;
-- (8)  o sesizare deja atribuită cuiva care și-a pierdut dreptul se mai mișcă
--      (urgența): regula se aplică doar când tehnicianul se SCHIMBĂ      [POZITIVĂ];
-- (9)  `public.tehnicieni_mentenanta`: gestionarul primește exact fișele
--      eligibile; hr, employee și org_admin-ul altei firme primesc zero rânduri;
-- (10) managerul (update = none) nu atribuie: zero rânduri, ca înainte.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh --pastreaza
--   psql … -f tests/rls/proba-sesizari-tehnician-cu-drept.sql
\set ON_ERROR_STOP on
\pset pager off

begin;

-- Rulează `p_sql` sub identitatea lui `p_user`; `ok:<rânduri>` sau `<sqlstate>:<mesaj>`.
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

-- Fișele pe care le dă selectorul de tehnician, cerute sub identitatea lui `p_user`.
create function pg_temp.tehnicieni_ca(p_user uuid, p_org uuid) returns table (id uuid)
language plpgsql as $f$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  set local role authenticated;
  return query select t.id from public.tehnicieni_mentenanta(p_org) t;
  reset role;
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
  v_org_alta uuid := gen_random_uuid();
  v_u_adm    uuid := gen_random_uuid();
  v_u_mgr    uuid := gen_random_uuid();
  v_u_hr     uuid := gen_random_uuid();
  v_u_teh    uuid := gen_random_uuid();
  v_u_blocat uuid := gen_random_uuid();  -- employee cu suprascriere pe membru `none`
  v_u_susp   uuid := gen_random_uuid();  -- employee cu contul suspendat în firmă
  v_u_alta   uuid := gen_random_uuid();
  v_e_adm    uuid := gen_random_uuid();
  v_e_mgr    uuid := gen_random_uuid();
  v_e_hr     uuid := gen_random_uuid();
  v_e_teh    uuid := gen_random_uuid();
  v_e_blocat uuid := gen_random_uuid();
  v_e_susp   uuid := gen_random_uuid();
  v_e_fara   uuid := gen_random_uuid();  -- fișă fără cont
  v_e_strain uuid := gen_random_uuid();
  v_m_blocat uuid;
  v_echip    uuid := gen_random_uuid();
  v_s1       uuid;
  v_s2       uuid;
  v_text     text;
  v_n        bigint;
  v_m        bigint;
  v_lista    text;
  v_ids      uuid[];
  v_esecuri  int := 0;
begin
  raise notice '';
  raise notice '  PROBA „TEHNICIANUL ATRIBUIT ARE DREPT” (0212 §3b, M3)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-teh-' || v_sufix, 'Proba Tehnician SRL',
     'RO' || (86000000 + (random() * 900000)::int)::text),
    (v_org_alta, 'proba-teh-alta-' || v_sufix, 'Altă Firmă SRL',
     'RO' || (85000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select o, f.feature_key, true, now() from public.features f, unnest(array[v_org, v_org_alta]) o;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_adm,    'teh-adm-'  || v_sufix || '@proba.test', now()),
    (v_u_mgr,    'teh-mgr-'  || v_sufix || '@proba.test', now()),
    (v_u_hr,     'teh-hr-'   || v_sufix || '@proba.test', now()),
    (v_u_teh,    'teh-teh-'  || v_sufix || '@proba.test', now()),
    (v_u_blocat, 'teh-blc-'  || v_sufix || '@proba.test', now()),
    (v_u_susp,   'teh-sus-'  || v_sufix || '@proba.test', now()),
    (v_u_alta,   'teh-alt-'  || v_sufix || '@proba.test', now());
  -- Fișele ÎNAINTEA membrilor (0083 face singur o fișă oricărui org_admin fără una).
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_adm,    v_org, 'TH-A', 'Adrian', 'Admin',      v_zi - 900, 'activ', v_u_adm,    null),
    (v_e_mgr,    v_org, 'TH-M', 'Mihai',  'Manager',    v_zi - 800, 'activ', v_u_mgr,    null),
    (v_e_hr,     v_org, 'TH-H', 'Hora',   'Resurse',    v_zi - 700, 'activ', v_u_hr,     null),
    (v_e_teh,    v_org, 'TH-T', 'Tudor',  'Tehnician',  v_zi - 600, 'activ', v_u_teh,    v_e_mgr),
    (v_e_blocat, v_org, 'TH-B', 'Bogdan', 'Blocat',     v_zi - 500, 'activ', v_u_blocat, null),
    (v_e_susp,   v_org, 'TH-S', 'Sorin',  'Suspendat',  v_zi - 500, 'activ', v_u_susp,   null),
    (v_e_fara,   v_org, 'TH-F', 'Florin', 'FaraCont',   v_zi - 400, 'activ', null,       null),
    (v_e_strain, v_org_alta, 'TH-X', 'Xenia', 'Străină', v_zi - 400, 'activ', null,      null);
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_adm,    'org_admin'),
    (v_org, v_u_mgr,    'manager'),
    (v_org, v_u_hr,     'hr'),
    (v_org, v_u_teh,    'employee'),
    (v_org, v_u_blocat, 'employee'),
    (v_org, v_u_susp,   'employee'),
    (v_org_alta, v_u_alta, 'org_admin');
  update public.organization_members set status = 'suspended'
   where organization_id = v_org and user_id = v_u_susp;
  select m.id into v_m_blocat from public.organization_members m
   where m.organization_id = v_org and m.user_id = v_u_blocat;
  insert into public.role_permissions (organization_id, member_id, role, resource, action, scope)
  values (v_org, v_m_blocat, 'employee', 'maintenance', 'read', 'none');

  insert into public.equipment (id, organization_id, cod, denumire)
  values (v_echip, v_org, 'TH-' || v_sufix, 'Strung');

  -- Sesizarea de lucru, depusă de tehnician (raportor) și încă neatribuită.
  perform set_config('request.jwt.claim.sub', v_u_teh::text, true);
  set local role authenticated;
  insert into public.fault_reports (organization_id, equipment_id, raportat_de_employee_id, descriere, urgenta)
  values (v_org, v_echip, v_e_teh, 'Strungul vibrează la turație mare.', 'medie')
  returning id into v_s1;
  reset role;

  -- (1) employee cu `maintenance:read = own`
  v_text := pg_temp.ruleaza(v_u_adm, format(
    $q$update public.fault_reports set atribuit_employee_id = %L where id = %L$q$, v_e_teh, v_s1));
  v_esecuri := v_esecuri + pg_temp.verifica('1', v_text = 'ok:1',
    'org_admin atribuie sesizarea unui employee (maintenance:read = own)', v_text);

  -- (2) hr, fără niciun rând `maintenance`
  v_text := pg_temp.ruleaza(v_u_adm, format(
    $q$update public.fault_reports set atribuit_employee_id = %L where id = %L$q$, v_e_hr, v_s1));
  v_esecuri := v_esecuri + pg_temp.verifica('2', v_text like 'P0001:Tehnicianul ales nu poate deschide sesizările%',
    'fișa unui hr (fără maintenance:read) e refuzată cu P0001', v_text);

  -- (3) suprascrierea pe membru
  v_text := pg_temp.ruleaza(v_u_adm, format(
    $q$update public.fault_reports set atribuit_employee_id = %L where id = %L$q$, v_e_blocat, v_s1));
  v_esecuri := v_esecuri + pg_temp.verifica('3', v_text like 'P0001:Tehnicianul ales nu poate deschide sesizările%',
    'suprascrierea pe membru `maintenance:read = none` bate seed-ul: P0001', v_text);

  -- (5) fără cont; cont suspendat
  v_text := pg_temp.ruleaza(v_u_adm, format(
    $q$update public.fault_reports set atribuit_employee_id = %L where id = %L$q$, v_e_fara, v_s1));
  v_lista := pg_temp.ruleaza(v_u_adm, format(
    $q$update public.fault_reports set atribuit_employee_id = %L where id = %L$q$, v_e_susp, v_s1));
  v_esecuri := v_esecuri + pg_temp.verifica('5',
    v_text like 'P0001:Tehnicianul ales nu poate deschide sesizările%'
      and v_lista like 'P0001:Tehnicianul ales nu poate deschide sesizările%',
    'fișa fără cont și contul suspendat în firmă: P0001', v_text || ' / ' || v_lista);

  -- (6) fișa altei firme: mesajul gărzii din 0181 vine primul
  v_text := pg_temp.ruleaza(v_u_adm, format(
    $q$update public.fault_reports set atribuit_employee_id = %L where id = %L$q$, v_e_strain, v_s1));
  v_esecuri := v_esecuri + pg_temp.verifica('6', v_text like 'P0001:Tehnicianul ales nu aparține organizației%',
    'fișa altei firme: tot garda din 0181 („nu aparține organizației”)', v_text);

  -- (7) INSERT cu tehnician fără drept
  v_text := pg_temp.ruleaza(v_u_adm, format(
    $q$insert into public.fault_reports (organization_id, equipment_id, raportat_de_employee_id, descriere, atribuit_employee_id)
       values (%L, %L, %L, 'Strungul nu pornește dimineața.', %L)$q$, v_org, v_echip, v_e_adm, v_e_hr));
  v_esecuri := v_esecuri + pg_temp.verifica('7', v_text like 'P0001:Tehnicianul ales nu poate deschide sesizările%',
    'INSERT cu tehnician fără drept (gestionarul sesizează și atribuie): P0001', v_text);

  -- (8) tehnicianul își pierde dreptul DUPĂ atribuire: sesizarea se mai mișcă
  insert into public.role_permissions (organization_id, member_id, role, resource, action, scope)
  select v_org, m.id, 'employee', 'maintenance', 'read', 'none'
    from public.organization_members m where m.organization_id = v_org and m.user_id = v_u_teh;
  v_text := pg_temp.ruleaza(v_u_adm, format(
    $q$update public.fault_reports set urgenta = 'ridicata' where id = %L$q$, v_s1));
  v_esecuri := v_esecuri + pg_temp.verifica('8', v_text = 'ok:1',
    'regula se aplică doar când tehnicianul se schimbă: urgența se mai modifică', v_text);
  delete from public.role_permissions
   where organization_id = v_org and resource = 'maintenance' and member_id = (
     select m.id from public.organization_members m where m.organization_id = v_org and m.user_id = v_u_teh);

  -- (9) selectorul
  v_ids := array(select x.id from pg_temp.tehnicieni_ca(v_u_adm, v_org) x);
  v_lista := (select string_agg(e.marca, ',' order by e.marca)
                from public.employees e where e.id = any (v_ids));
  v_n := pg_temp.numara(v_u_hr, format('select count(*) from public.tehnicieni_mentenanta(%L)', v_org))
       + pg_temp.numara(v_u_teh, format('select count(*) from public.tehnicieni_mentenanta(%L)', v_org))
       + pg_temp.numara(v_u_alta, format('select count(*) from public.tehnicieni_mentenanta(%L)', v_org))
       + pg_temp.numara(v_u_mgr, format('select count(*) from public.tehnicieni_mentenanta(%L)', v_org));
  -- Eligibili: admin (all), manager (team), tehnicianul (own). Nu: hr, blocatul,
  -- suspendatul, fișa fără cont, fișa străină.
  v_esecuri := v_esecuri + pg_temp.verifica('9', v_lista = 'TH-A,TH-M,TH-T' and v_n = 0,
    'tehnicieni_mentenanta: gestionarul primește exact fișele eligibile; hr, employee, managerul și firma străină: zero',
    format('listă %s, ceilalți %s', coalesce(v_lista, '∅'), v_n));

  -- (4) suprascrierea pe ORGANIZAȚIE îl face pe hr eligibil
  insert into public.role_permissions (organization_id, member_id, role, resource, action, scope)
  values (v_org, null, 'hr', 'maintenance', 'read', 'own');
  v_text := pg_temp.ruleaza(v_u_adm, format(
    $q$update public.fault_reports set atribuit_employee_id = %L where id = %L$q$, v_e_hr, v_s1));
  v_ids := array(select x.id from pg_temp.tehnicieni_ca(v_u_adm, v_org) x);
  v_m := case when v_e_hr = any (v_ids) then 1 else 0 end;
  v_n := pg_temp.numara(v_u_hr, format('select count(*) from public.fault_reports where id = %L', v_s1));
  v_esecuri := v_esecuri + pg_temp.verifica('4', v_text = 'ok:1' and v_m = 1 and v_n = 1,
    'suprascrierea pe organizație (hr → maintenance:read = own): hr apare în listă, primește sesizarea și o deschide',
    format('%s, în listă %s, vede %s', v_text, v_m, v_n));

  -- (10) managerul nu atribuie (update = none în seed): zero rânduri, ca înainte
  v_text := pg_temp.ruleaza(v_u_mgr, format(
    $q$update public.fault_reports set atribuit_employee_id = %L where id = %L$q$, v_e_teh, v_s1));
  v_esecuri := v_esecuri + pg_temp.verifica('10', v_text = 'ok:0' or v_text like 'P0001:%',
    'managerul (fără maintenance:update) nu atribuie', v_text);

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA TEHNICIAN CU DREPT: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE verificările au trecut.';
  raise notice '';
end;
$$;

rollback;
