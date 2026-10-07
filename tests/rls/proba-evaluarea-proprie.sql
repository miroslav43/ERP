-- tests/rls/proba-evaluarea-proprie.sql
--
-- EVALUAREA PROPRIE A UNUI MANAGER, DUPĂ 0170.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- (1) managerul își vede propria evaluare FINALIZATĂ               [POZITIVĂ];
-- (2) dar nu propria CIORNĂ — concluzia pe jumătate scrisă rămâne a șefului;
-- (3) nici evaluarea unui coleg din afara echipei lui;
-- (4) iar evaluarea propriului subordonat o vede în continuare     [POZITIVĂ];
-- (5) nu-și poate modifica propria ciornă (UPDATE cu zero rânduri);
-- (6) nu-și poate crea o evaluare (42501);
-- (7) dar ciorna subordonatului o modifică în continuare           [POZITIVĂ].
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org      uuid := gen_random_uuid();
  v_u_sef    uuid := gen_random_uuid();
  v_u_mgr    uuid := gen_random_uuid();
  v_e_sef    uuid := gen_random_uuid();
  v_e_mgr    uuid := gen_random_uuid();
  v_e_sub    uuid := gen_random_uuid();
  v_e_coleg  uuid := gen_random_uuid();
  v_sablon   uuid := gen_random_uuid();
  v_fin      uuid := gen_random_uuid();
  v_ciorna   uuid := gen_random_uuid();
  v_ev_coleg uuid := gen_random_uuid();
  v_ev_sub   uuid := gen_random_uuid();
  v_vazute   uuid[];
  v_ciorna_sub uuid := gen_random_uuid();
  v_atinse   int;
  v_esecuri  int := 0;
  c_criterii jsonb := '[{"cod":"c1","denumire":"Calitate","tip":"scala","scala_max":5}]';
begin
  raise notice '';
  raise notice '  PROBA „EVALUAREA PROPRIE" (0170)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-ev-proprie-' || v_sufix, 'Proba Evaluare SRL',
     'RO' || (82000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select v_org, f.feature_key, true, now() from public.features f;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_sef, 'ev-sef-' || v_sufix || '@proba.test', now()),
    (v_u_mgr, 'ev-mgr-' || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_sef, 'manager'),
    (v_org, v_u_mgr, 'manager');

  -- Șeful → managerul → subordonatul; colegul e sub șef, nu sub manager.
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_sef,   v_org, 'EP-S', 'Sorin', 'Sef',      app.azi_local() - 900, 'activ', v_u_sef, null);
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_mgr,   v_org, 'EP-M', 'Mihai', 'Manager',  app.azi_local() - 800, 'activ', v_u_mgr, v_e_sef),
    (v_e_coleg, v_org, 'EP-C', 'Carmen', 'Coleg',   app.azi_local() - 700, 'activ', null,    v_e_sef);
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_sub,   v_org, 'EP-B', 'Bogdan', 'Subordonat', app.azi_local() - 600, 'activ', null, v_e_mgr);

  insert into public.evaluation_templates (id, organization_id, denumire, criterii)
  values (v_sablon, v_org, 'Anual ' || v_sufix, c_criterii);

  insert into public.employee_evaluations
    (id, organization_id, employee_id, template_id, data_evaluarii, status, criterii_sablon, raspunsuri)
  values
    (v_fin,      v_org, v_e_mgr,   v_sablon, app.azi_local() - 30, 'finalizat', c_criterii,
     '[{"criteriu_cod":"c1","scor":4}]'),
    (v_ciorna,   v_org, v_e_mgr,   v_sablon, app.azi_local(),      'draft',     c_criterii, '[]'),
    (v_ev_coleg, v_org, v_e_coleg, v_sablon, app.azi_local() - 30, 'finalizat', c_criterii,
     '[{"criteriu_cod":"c1","scor":3}]'),
    (v_ev_sub,   v_org, v_e_sub,   v_sablon, app.azi_local() - 30, 'finalizat', c_criterii,
     '[{"criteriu_cod":"c1","scor":5}]'),
    (v_ciorna_sub, v_org, v_e_sub, v_sablon, app.azi_local(),      'draft',     c_criterii, '[]');

  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  select array_agg(id) into v_vazute from public.employee_evaluations;
  reset role;
  v_vazute := coalesce(v_vazute, '{}');

  if v_fin = any (v_vazute) then
    raise notice '  ✓ (1) managerul își vede evaluarea finalizată';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) managerul NU își vede evaluarea finalizată';
  end if;

  if v_ciorna = any (v_vazute) then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) managerul își vede propria ciornă';
  else
    raise notice '  ✓ (2) propria ciornă rămâne ascunsă';
  end if;

  if v_ev_coleg = any (v_vazute) then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) managerul vede evaluarea unui coleg din afara echipei';
  else
    raise notice '  ✓ (3) evaluarea colegului din afara echipei nu se vede';
  end if;

  if v_ev_sub = any (v_vazute) then
    raise notice '  ✓ (4) evaluarea subordonatului se vede în continuare';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) managerul nu mai vede evaluarea subordonatului';
  end if;

  -- (5) UPDATE pe propria ciornă
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  update public.employee_evaluations
     set status = 'finalizat', raspunsuri = '[{"criteriu_cod":"c1","scor":5}]', updated_by = v_u_mgr
   where id = v_ciorna;
  get diagnostics v_atinse = row_count;
  reset role;
  if v_atinse = 0 then
    raise notice '  ✓ (5) managerul nu-și poate modifica/finaliza propria ciornă';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) managerul și-a finalizat singur evaluarea';
  end if;

  -- (6) INSERT pe propria fișă
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    insert into public.employee_evaluations
      (organization_id, employee_id, template_id, data_evaluarii, criterii_sablon, raspunsuri,
       created_by, updated_by)
    values (v_org, v_e_mgr, v_sablon, app.azi_local(), c_criterii, '[]', v_u_mgr, v_u_mgr);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) managerul și-a creat singur o evaluare';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (6) managerul nu-și poate crea o evaluare: 42501';
  end;

  -- (7) UPDATE pe ciorna subordonatului
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    update public.employee_evaluations
       set raspunsuri = '[{"criteriu_cod":"c1","scor":4}]', updated_by = v_u_mgr
     where id = v_ciorna_sub;
    get diagnostics v_atinse = row_count;
    reset role;
    if v_atinse = 1 then
      raise notice '  ✓ (7) managerul își evaluează în continuare subordonatul';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (7) ciorna subordonatului: % rânduri', v_atinse;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) ciorna subordonatului: % (%)', sqlerrm, sqlstate;
  end;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA EVALUAREA PROPRIE: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE cele 7 verificări au trecut.';
  raise notice '';
end;
$$;
