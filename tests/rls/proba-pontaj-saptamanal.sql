-- tests/rls/proba-pontaj-saptamanal.sql
--
-- VARIANTA DE PONTAJ SĂPTĂMÂNALĂ, DUPĂ 0165.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- (1) angajatul NU-și mai scrie ziua direct (INSERT)        — refuz P0001;
-- (2) nici nu-și modifică o zi existentă (UPDATE)            — refuz P0001;
-- (3) managerul aprobă totuși ziua subordonatului            [POZITIVĂ];
-- (4) responsabilul `hr` (create = all) corectează ziua      [POZITIVĂ];
-- (5) serviciul (clientul admin) scrie ziua din săptămână    [POZITIVĂ];
-- (6) înapoi pe `zilnic`, angajatul își scrie iar ziua       [POZITIVĂ] —
--     controlul că refuzurile de sus vin din variantă, nu din altceva;
-- (7) un `leave_request_id` pus de angajat NU deschide garda (0166) — portița
--     găsită de revizia adversarială: id-ul se scrie de client;
-- (8) nici orele unei zile de concediu nu se schimbă pe drumul retragerii.
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
  v_u_hr    uuid := gen_random_uuid();
  v_e_mgr   uuid := gen_random_uuid();
  v_e_ang   uuid := gen_random_uuid();
  v_zi      uuid;
  v_cerere  uuid;
  v_concediu uuid;
  v_atinse  int;
  v_esecuri int := 0;
begin
  raise notice '';
  raise notice '  PROBA „PONTAJ SĂPTĂMÂNAL" (0165)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-pontaj-sapt-' || v_sufix, 'Proba Săptămână SRL',
     'RO' || (84000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select v_org, f.feature_key, true, now() from public.features f;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_mgr, 'sapt-mgr-' || v_sufix || '@proba.test', now()),
    (v_u_ang, 'sapt-ang-' || v_sufix || '@proba.test', now()),
    (v_u_hr,  'sapt-hr-'  || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_mgr, 'manager'),
    (v_org, v_u_ang, 'employee'),
    (v_org, v_u_hr,  'hr');

  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_mgr, v_org, 'SAPT-M', 'Mihai', 'Manager', app.azi_local() - 500, 'activ', v_u_mgr, null),
    (v_e_ang, v_org, 'SAPT-A', 'Ana',   'Angajat', app.azi_local() - 400, 'activ', v_u_ang, v_e_mgr);

  insert into public.setari_pontare_rapida (organization_id, mod_pontare_rapida,
                                            verificare_pontare, varianta_pontaj)
  values (v_org, 'ceas', 'fara', 'saptamanal');

  -- Ziua angajatei, scrisă ca proprietar al bazei: ținta probelor (2) și (3).
  insert into public.attendance_entries (organization_id, employee_id, data, ora_inceput,
                                         ora_sfarsit, ore_lucrate, tip_zi, sursa)
  values (v_org, v_e_ang, app.azi_local() - 1, '09:00', '17:00', 8, 'lucratoare', 'saptamana')
  returning id into v_zi;

  -- Cererea de concediu și rândul ei din pontaj, ținta probelor (7) și (8).
  insert into public.leave_requests
    (organization_id, employee_id, leave_type_id, data_inceput, data_sfarsit, status, created_by)
  values (
    v_org, v_e_ang,
    (select lt.id from public.leave_types lt
      where lt.organization_id = v_org and lt.key = 'odihna' and lt.deleted_at is null limit 1),
    app.azi_local() - 10, app.azi_local() - 10, 'aprobata', v_u_ang)
  returning id into v_cerere;
  insert into public.attendance_entries
    (organization_id, employee_id, data, ore_lucrate, tip_zi, leave_request_id, sursa)
  values (v_org, v_e_ang, app.azi_local() - 10, 0, 'concediu', v_cerere, 'sincronizare_concedii')
  returning id into v_concediu;

  -- (1) angajatul își scrie ziua direct
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    insert into public.attendance_entries (organization_id, employee_id, data, ora_inceput,
                                           ore_lucrate, tip_zi, sursa)
    values (v_org, v_e_ang, app.azi_local(), '08:00', 0, 'lucratoare', 'pontare_rapida');
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) angajatul și-a scris ziua în varianta săptămânală';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (1) ziua scrisă direct e refuzată';
  end;

  -- (2) angajatul își modifică ziua existentă
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    update public.attendance_entries set ora_sfarsit = '19:00', ore_lucrate = 10 where id = v_zi;
    get diagnostics v_atinse = row_count;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) angajatul și-a modificat ziua (% rânduri)', v_atinse;
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (2) modificarea zilei e refuzată';
  end;

  -- (3) managerul aprobă ziua subordonatei — UPDATE care atinge doar decizia
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    perform public.decide_zi_pontaj(v_org, v_zi, true, null);
    reset role;
    if exists (select 1 from public.attendance_entries where id = v_zi and approved_at is not null) then
      raise notice '  ✓ (3) managerul aprobă ziua subordonatei';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (3) aprobarea n-a marcat ziua';
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) aprobarea managerului a căzut: % (%)', sqlerrm, sqlstate;
  end;

  -- (4) responsabilul hr corectează o zi a angajatei
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  begin
    insert into public.attendance_entries (organization_id, employee_id, data, ora_inceput,
                                           ora_sfarsit, ore_lucrate, tip_zi)
    values (v_org, v_e_ang, app.azi_local() - 2, '09:00', '17:00', 8, 'lucratoare');
    reset role;
    raise notice '  ✓ (4) hr corectează ziua angajatei';
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) corectura hr a căzut: % (%)', sqlerrm, sqlstate;
  end;

  -- (5) serviciul scrie ziua din săptămână. Ca PROPRIETAR, fără `set role`: pe
  -- bancul din `postgres:17-alpine`, `service_role` n-are granturi pe tabele (le
  -- dă Supabase), iar `app.is_service_context()` citește GUC-ul `role`, care
  -- pentru proprietar e `none` — exact ramura pe care o folosește clientul admin.
  perform set_config('request.jwt.claim.sub', '', true);
  reset role;
  begin
    insert into public.attendance_entries (organization_id, employee_id, data, ora_inceput,
                                           ora_sfarsit, ore_lucrate, tip_zi, sursa)
    values (v_org, v_e_ang, app.azi_local() - 3, '09:00', '17:00', 8, 'lucratoare', 'saptamana');
    reset role;
    raise notice '  ✓ (5) serviciul scrie ziua din săptămână';
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) scrierea serviciului a căzut: % (%)', sqlerrm, sqlstate;
  end;

  -- (7) portița din 0165: `leave_request_id` pus de mână pe o zi cu 12 ore
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    insert into public.attendance_entries (organization_id, employee_id, data, ora_inceput,
                                           ora_sfarsit, ore_lucrate, tip_zi, sursa,
                                           leave_request_id)
    values (v_org, v_e_ang, app.azi_local() - 4, '08:00', '20:00', 12, 'lucratoare',
            'pontare_rapida', v_cerere);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) `leave_request_id` pus de angajat a deschis garda';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (7) `leave_request_id` pus de angajat nu deschide garda';
  end;

  -- (8) orele zilei de concediu nu se schimbă pe drumul retragerii
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    update public.attendance_entries set ore_lucrate = 8, tip_zi = 'lucratoare'
     where id = v_concediu;
    get diagnostics v_atinse = row_count;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) angajatul a schimbat ziua de concediu (% rânduri)', v_atinse;
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (8) ziua de concediu nu se rescrie de mână';
  end;

  -- (6) înapoi pe zilnic: angajatul își scrie iar ziua
  update public.setari_pontare_rapida set varianta_pontaj = 'zilnic' where organization_id = v_org;
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    insert into public.attendance_entries (organization_id, employee_id, data, ora_inceput,
                                           ore_lucrate, tip_zi, sursa)
    values (v_org, v_e_ang, app.azi_local(), '08:00', 0, 'lucratoare', 'pontare_rapida');
    reset role;
    raise notice '  ✓ (6) pe `zilnic`, angajatul își scrie ziua';
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) pe `zilnic` ziua e refuzată: % (%)', sqlerrm, sqlstate;
  end;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA PONTAJ SĂPTĂMÂNAL: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE cele 8 verificări au trecut.';
  raise notice '';
end;
$$;
