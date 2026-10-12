-- tests/rls/proba-plafon-acordare.sql
--
-- PLAFONUL ACORDĂRII, DUPĂ 0197.
--
-- ── DE CE EXISTĂ FIȘIERUL ───────────────────────────────────────────────────
-- `role_permissions_insert` / `_update` verificau CUI i se acordă
-- (`app.membru_din_echipa`), nu și CÂT. Un manager cu `roles:update = team`,
-- fără `payroll:read` și cu `employees:read = team`, îi putea da subordonatului
-- `payroll:read = all` sau `employees:read = all` (CNP-ul și IBAN-ul întregii
-- firme). Creștere de drepturi prin interpus — exact ce 0063 exclude pentru
-- `roles`. Din W3-03 ecranul e deschis managerilor, deci calea era un clic.
--
-- ── CE VERIFICĂ, PE RÂND ────────────────────────────────────────────────────
-- (1) managerul nu dă `payroll:read = all` (n-are deloc cheia);
-- (2) managerul nu dă `employees:read = all` (are doar `team`);
-- (3) dar dă `leave:read = team`, cât are el                       [POZITIVĂ];
-- (4) și un refuz explicit pe o cheie pe care n-o are             [POZITIVĂ];
-- (5) nu poate ridica (3) la `all` prin UPDATE;
-- (6) administratorul dă `payroll:read = all` fără plafon         [POZITIVĂ];
-- (7) managerul nu poate muta rândul administratorului pe `own`;
-- (8) dar îl poate restrânge la `none`                            [POZITIVĂ];
-- (9) dar nu-l retrage, fiindcă angajatul ar cădea pe `payroll:read = own`
--     al rolului, o cheie pe care managerul n-o are;
-- (10) retrage prin `sterge_logic` o suprascriere peste plafon când rolul nu
--      dă nimic pe cheie (`vehicles:read`)                         [POZITIVĂ];
-- (11) NU retrage refuzul explicit pus de administrator pe un `hr`
--      (`payroll:read = none`): ștergerea l-ar întoarce la `all`-ul rolului;
-- (12) retrage o restricție care lasă membrul sub plafon          [POZITIVĂ];
-- (13) rândul organizației bate implicitul global și la retragere: cu
--      `payroll:read = none` pe rolul `hr` al firmei, (11) trece      [POZITIVĂ].
--
-- (9)–(13) acoperă retragerea: ea NU e neutră — dreptul cade pe implicitul
-- rolului membrului, deci plafonul se pune pe ACEL implicit, nu pe rândul șters.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org      uuid := gen_random_uuid();
  v_u_admin  uuid := gen_random_uuid();
  v_u_mgr    uuid := gen_random_uuid();
  v_u_ang    uuid := gen_random_uuid();
  v_u_hr     uuid := gen_random_uuid();
  v_e_mgr    uuid := gen_random_uuid();
  v_e_ang    uuid := gen_random_uuid();
  v_e_hr     uuid := gen_random_uuid();
  v_m_ang    uuid;
  v_m_hr     uuid;
  v_r_leave  uuid;
  v_r_admin  uuid;
  v_r_hr     uuid;
  v_r_ang    uuid;
  v_sterse   uuid[];
  v_atinse   int;
  v_esecuri  int := 0;
begin
  raise notice '';
  raise notice '  PROBA „PLAFONUL ACORDĂRII" (0197)';
  raise notice '  ─────────────────────────────────────────────────────────';

  -- ── fixture ───────────────────────────────────────────────────────────────
  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-plafon-' || v_sufix, 'Proba Plafon SRL',
     'RO' || (87000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select v_org, f.feature_key, true, now() from public.features f;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_admin, 'pl-adm-' || v_sufix || '@proba.test', now()),
    (v_u_mgr,   'pl-mgr-' || v_sufix || '@proba.test', now()),
    (v_u_ang,   'pl-ang-' || v_sufix || '@proba.test', now()),
    (v_u_hr,    'pl-hr-'  || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_admin, 'org_admin'), (v_org, v_u_mgr, 'manager'), (v_org, v_u_ang, 'employee'),
    (v_org, v_u_hr, 'hr');
  select id into v_m_ang from public.organization_members where user_id = v_u_ang;
  select id into v_m_hr  from public.organization_members where user_id = v_u_hr;

  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_mgr, v_org, 'PL-M', 'Mihai', 'Manager', app.azi_local() - 500, 'activ', v_u_mgr, null),
    (v_e_ang, v_org, 'PL-A', 'Ana',   'Angajat', app.azi_local() - 400, 'activ', v_u_ang, v_e_mgr),
    -- Subordonat cu rolul `hr`: implicitul global îi dă `payroll:read = all`.
    (v_e_hr,  v_org, 'PL-H', 'Horia', 'Resurse', app.azi_local() - 300, 'activ', v_u_hr,  v_e_mgr);

  -- Ca în seed: `roles:update = team` (0063). Restul matricei managerului vine
  -- din implicitul global: `employees:read = team`, `leave:read = team`,
  -- `payroll:* = none`, niciun `vehicles:*`.
  insert into public.role_permissions (organization_id, role, resource, action, scope)
  values (v_org, 'manager', 'roles', 'update', 'team');

  -- ═══ (1) `payroll:read = all` fără să aibă cheia ══════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    insert into public.role_permissions (organization_id, member_id, role, resource, action, scope)
    values (v_org, v_m_ang, 'employee', 'payroll', 'read', 'all');
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) managerul fără salarizare i-a deschis subordonatului toate salariile';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (1) `payroll:read = all` peste plafon e refuzat (42501)';
  end;

  -- ═══ (2) `employees:read = all` peste propriul `team` ═════════════════════
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    insert into public.role_permissions (organization_id, member_id, role, resource, action, scope)
    values (v_org, v_m_ang, 'employee', 'employees', 'read', 'all');
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) managerul i-a deschis subordonatului fișele întregii firme';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (2) `employees:read = all` peste `team` e refuzat (42501)';
  end;

  -- ═══ (3) până la plafon [POZITIVĂ] ════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    insert into public.role_permissions (organization_id, member_id, role, resource, action, scope)
    values (v_org, v_m_ang, 'employee', 'leave', 'read', 'team')
    returning id into v_r_leave;
    reset role;
    raise notice '  ✓ (3) managerul dă `leave:read = team`, cât are el';
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) managerul nu mai poate acorda cât are: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (4) refuz explicit pe o cheie pe care n-o are [POZITIVĂ] ═════════════
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    insert into public.role_permissions (organization_id, member_id, role, resource, action, scope)
    values (v_org, v_m_ang, 'employee', 'payroll', 'export', 'none');
    reset role;
    raise notice '  ✓ (4) refuzul explicit trece și fără cheie';
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) refuzul explicit a fost respins: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (5) ridicarea lui (3) la `all` ═══════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    update public.role_permissions set scope = 'all' where id = v_r_leave;
    get diagnostics v_atinse = row_count;
    reset role;
    if v_atinse = 0 then
      raise notice '  ✓ (5) ridicarea peste plafon e refuzată (zero rânduri)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (5) managerul a ridicat suprascrierea la `all`';
    end if;
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (5) ridicarea peste plafon e refuzată (42501)';
  end;

  -- ═══ (6) administratorul, fără plafon [POZITIVĂ] ══════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.role_permissions (organization_id, member_id, role, resource, action, scope)
    values (v_org, v_m_ang, 'employee', 'payroll', 'read', 'all')
    returning id into v_r_admin;
    reset role;
    raise notice '  ✓ (6) administratorul dă `payroll:read = all`';
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) administratorul nu mai poate acorda: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (7) managerul nu mută rândul administratorului pe `own` ══════════════
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    update public.role_permissions set scope = 'own' where id = v_r_admin;
    get diagnostics v_atinse = row_count;
    reset role;
    if v_atinse = 0 then
      raise notice '  ✓ (7) `own` pe o cheie pe care managerul n-o are e refuzat (zero rânduri)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (7) managerul a scris `payroll:read = own` fără să aibă cheia';
    end if;
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (7) `own` pe o cheie pe care managerul n-o are e refuzat (42501)';
  end;

  -- ═══ (8) dar îl restrânge la `none` [POZITIVĂ] ════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    update public.role_permissions set scope = 'none' where id = v_r_admin;
    get diagnostics v_atinse = row_count;
    reset role;
    if v_atinse = 1 then
      raise notice '  ✓ (8) managerul restrânge la refuz explicit';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (8) restrângerea a afectat % rânduri', v_atinse;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) restrângerea a fost respinsă: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (9) retragerea care cade pe un implicit peste plafon ═════════════════
  -- Rândul trece înapoi pe `all` (ca administrator). Retras, angajatul ar cădea
  -- pe `payroll:read = own` al rolului `employee` — o cheie pe care managerul
  -- n-o are deloc. Refuzat; restrângerea la `none` (8) rămâne calea lui.
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  update public.role_permissions set scope = 'all' where id = v_r_admin;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    v_sterse := public.sterge_logic('role_permissions', array[v_r_admin]);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) managerul a retras rândul, iar angajatul a căzut pe `payroll:read = own`';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (9) retragerea spre `own`-ul rolului, peste plafon, e refuzată (42501)';
  end;

  -- ═══ (10) retragerea prin `sterge_logic` [POZITIVĂ] ═══════════════════════
  -- Administratorul îi dă angajatului parcul auto (`vehicles:read = all`);
  -- managerul n-are niciun `vehicles:*`, iar rolul `employee` nu dă nimic pe
  -- cheie. Retragerea îl lasă pe `none`, deci trece, deși rândul e peste plafon.
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  insert into public.role_permissions (organization_id, member_id, role, resource, action, scope)
  values (v_org, v_m_ang, 'employee', 'vehicles', 'read', 'all')
  returning id into v_r_admin;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    v_sterse := public.sterge_logic('role_permissions', array[v_r_admin]);
    reset role;
    if v_sterse = array[v_r_admin] then
      raise notice '  ✓ (10) managerul retrage o suprascriere peste plafon când rolul nu dă nimic';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (10) retragerea n-a șters nimic';
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10) retragerea a fost respinsă: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (11) refuzul explicit al administratorului pe un `hr` ═════════════════
  -- Administratorul îi ia subordonatului `hr` salariile (`payroll:read = none`,
  -- peste `all`-ul rolului). Managerul, fără `payroll:read`, nu poate retrage
  -- refuzul: rândul șters n-ar mai da nimic, dar ștergerea lui ar DA `all`.
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  insert into public.role_permissions (organization_id, member_id, role, resource, action, scope)
  values (v_org, v_m_hr, 'hr', 'payroll', 'read', 'none')
  returning id into v_r_hr;
  reset role;

  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    v_sterse := public.sterge_logic('role_permissions', array[v_r_hr]);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (11) managerul a retras refuzul și i-a redeschis subordonatului `hr` toate salariile (%)',
      v_sterse;
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (11) retragerea care ar întoarce `hr`-ul la `payroll:read = all` e refuzată (42501)';
  end;
  if exists (select 1 from public.role_permissions where id = v_r_hr and deleted_at is not null) then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (11) refuzul administratorului a rămas șters';
  end if;

  -- ═══ (12) retragerea până la plafon [POZITIVĂ] ════════════════════════════
  -- Administratorul îi ia angajatului `employees:read` (implicitul `employee`
  -- e `own`, sub `team`-ul managerului). Managerul îl poate da înapoi.
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  insert into public.role_permissions (organization_id, member_id, role, resource, action, scope)
  values (v_org, v_m_ang, 'employee', 'employees', 'read', 'none')
  returning id into v_r_ang;
  reset role;

  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    v_sterse := public.sterge_logic('role_permissions', array[v_r_ang]);
    reset role;
    if v_sterse = array[v_r_ang] then
      raise notice '  ✓ (12) managerul retrage o restricție care îl lasă pe angajat sub plafon';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (12) retragerea n-a șters nimic';
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (12) retragerea a fost respinsă: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (13) rândul organizației bate globalul și la retragere [POZITIVĂ] ════
  -- Firma îi ia rolului `hr` salariile (rând de organizație, fără membru). Acum
  -- ștergerea refuzului din (11) lasă `hr`-ul pe `none`, deci trece.
  insert into public.role_permissions (organization_id, role, resource, action, scope)
  values (v_org, 'hr', 'payroll', 'read', 'none');

  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    v_sterse := public.sterge_logic('role_permissions', array[v_r_hr]);
    reset role;
    if v_sterse = array[v_r_hr] then
      raise notice '  ✓ (13) cu rândul firmei pe `none`, retragerea refuzului trece';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (13) retragerea n-a șters nimic';
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (13) retragerea a fost respinsă: % (%)', sqlerrm, sqlstate;
  end;

  -- ── verdict ───────────────────────────────────────────────────────────────
  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA PLAFONULUI ACORDĂRII: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE cele 13 verificări au trecut.';
  raise notice '';
end;
$$;
