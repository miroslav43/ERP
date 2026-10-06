-- tests/rls/proba-manager-pontaj.sql
--
-- MANAGERUL ÎȘI PONTEAZĂ PROPRIA ZI, DUPĂ 0161.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- (1) managerul își deschide ziua — „Am intrat"                    [POZITIVĂ];
-- (2) și și-o închide — „Am ieșit", UPDATE pe rândul propriu       [POZITIVĂ];
-- (3) dar NU scrie ziua subordonatului — `own` nu e `team`;
-- (4) și nici nu i-o modifică: UPDATE-ul respins de `USING` atinge zero
--     rânduri, fără eroare (capcana 17), deci se numără rândurile.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix   text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org     uuid := gen_random_uuid();
  v_u_mgr   uuid := gen_random_uuid();
  v_u_ang   uuid := gen_random_uuid();
  v_e_mgr   uuid := gen_random_uuid();
  v_e_ang   uuid := gen_random_uuid();
  v_zi      uuid;
  v_atinse  int;
  v_esecuri int := 0;
begin
  raise notice '';
  raise notice '  PROBA „MANAGERUL ÎȘI FACE PONTAJUL" (0161)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-mgr-pontaj-' || v_sufix, 'Proba Pontaj SRL',
     'RO' || (87000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select v_org, f.feature_key, true, now() from public.features f;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_mgr, 'pontaj-mgr-' || v_sufix || '@proba.test', now()),
    (v_u_ang, 'pontaj-ang-' || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_mgr, 'manager'),
    (v_org, v_u_ang, 'employee');

  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_mgr, v_org, 'PONT-M', 'Mihai', 'Manager', app.azi_local() - 500, 'activ', v_u_mgr, null),
    (v_e_ang, v_org, 'PONT-A', 'Ana',   'Angajat', app.azi_local() - 400, 'activ', v_u_ang, v_e_mgr);

  -- Ziua subordonatului, scrisă ca proprietar al bazei: ținta probei (4).
  insert into public.attendance_entries (organization_id, employee_id, data, ora_inceput,
                                         ore_lucrate, tip_zi, sursa)
  values (v_org, v_e_ang, app.azi_local(), '08:00', 0, 'lucratoare', 'pontare_rapida');

  -- (1) „Am intrat", pentru el însuși. Forma e cea a lui `pontezaIntrarea`:
  -- doar ora de intrare, zero ore, `sursa = pontare_rapida`.
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    insert into public.attendance_entries (organization_id, employee_id, data, ora_inceput,
                                           ore_lucrate, tip_zi, sursa)
    values (v_org, v_e_mgr, app.azi_local(), '08:00', 0, 'lucratoare', 'pontare_rapida')
    returning id into v_zi;
    reset role;
    raise notice '  ✓ (1) managerul își deschide ziua';
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) managerul nu-și poate deschide ziua: % (%)', sqlerrm, sqlstate;
  end;

  -- (2) „Am ieșit"
  if v_zi is not null then
    perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
    set local role authenticated;
    begin
      update public.attendance_entries set ora_sfarsit = '16:30', ore_lucrate = 8
       where id = v_zi;
      get diagnostics v_atinse = row_count;
      reset role;
      if v_atinse = 1 then
        raise notice '  ✓ (2) managerul își închide ziua';
      else
        v_esecuri := v_esecuri + 1;
        raise warning '  ✗ (2) închiderea zilei proprii a atins % rânduri', v_atinse;
      end if;
    exception when others then
      reset role;
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (2) managerul nu-și poate închide ziua: % (%)', sqlerrm, sqlstate;
    end;
  end if;

  -- (3) dar nu scrie ziua subordonatului
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    insert into public.attendance_entries (organization_id, employee_id, data, ore_lucrate, tip_zi)
    values (v_org, v_e_ang, app.azi_local() - 1, 8, 'lucratoare');
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) managerul a scris ziua subordonatului';
  exception when insufficient_privilege or raise_exception then
    reset role;
    raise notice '  ✓ (3) ziua subordonatului e refuzată la scriere';
  end;

  -- (4) și nici nu i-o modifică
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    update public.attendance_entries set ora_sfarsit = '18:00', ore_lucrate = 10
     where organization_id = v_org and employee_id = v_e_ang and data = app.azi_local();
    get diagnostics v_atinse = row_count;
    reset role;
    if v_atinse = 0 then
      raise notice '  ✓ (4) ziua subordonatului nu se poate modifica';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (4) managerul a modificat ziua subordonatului (% rânduri)', v_atinse;
    end if;
  exception when insufficient_privilege or raise_exception then
    reset role;
    raise notice '  ✓ (4) ziua subordonatului nu se poate modifica';
  end;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA MANAGER PONTAJ: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE cele 4 verificări au trecut.';
  raise notice '';
end;
$$;
