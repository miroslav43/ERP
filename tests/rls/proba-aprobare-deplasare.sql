-- tests/rls/proba-aprobare-deplasare.sql
--
-- DRUMUL UNEI DEPLASĂRI: TRIMISĂ DE ANGAJAT, DECISĂ DE MANAGER.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- Exact UPDATE-urile din `diurna/actions.ts`, sub identitatea rolului care le
-- face în produs — nu cu superuser, care ar trece prin orice politică:
--
-- (1) angajatul își trimite deplasarea: ciorna → in_aprobare      [POZITIVĂ];
-- (2) managerul o aprobă: in_aprobare → aprobata                  [POZITIVĂ];
-- (3) managerul respinge alta: in_aprobare → respinsa             [POZITIVĂ];
-- (4) managerul aprobă o cheltuială a subordonatului              [POZITIVĂ];
-- (5) angajatul NU își aprobă singur deplasarea;
-- (6) managerul NU aprobă deplasarea cuiva din afara echipei.
--
-- „Pozitivă" = trebuie să atingă exact un rând. Un UPDATE respins de `USING`
-- atinge ZERO rânduri fără eroare; unul respins de `WITH CHECK` dă 42501.
-- Ambele sunt picări aici.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

create or replace function pg_temp.deplasare(
  p_org uuid, p_ang uuid, p_tara uuid, p_status public.business_trip_status
) returns uuid language sql as $$
  insert into public.business_trips
    (organization_id, employee_id, country_id, localitate, plecare_la, sosire_la, status, scop,
     mijloc_transport)
  values (p_org, p_ang, p_tara, 'Cluj-Napoca', now() + interval '1 day',
          now() + interval '3 days', p_status, 'Probă', 'auto_personal')
  returning id;
$$;

do $$
declare
  v_sufix   text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org     uuid := gen_random_uuid();
  v_u_mgr   uuid := gen_random_uuid();
  v_u_ang   uuid := gen_random_uuid();
  v_u_str   uuid := gen_random_uuid();
  v_e_mgr   uuid := gen_random_uuid();
  v_e_ang   uuid := gen_random_uuid();
  v_e_str   uuid := gen_random_uuid();
  v_tara    uuid;
  v_d1      uuid;
  v_d2      uuid;
  v_d3      uuid;
  v_d4      uuid;
  v_chelt   uuid;
  v_atinse  int;
  v_esecuri int := 0;
begin
  raise notice '';
  raise notice '  PROBA „APROBAREA DEPLASĂRII"';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-aprob-depl-' || v_sufix, 'Proba Aprobare SRL',
     'RO' || (87000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select v_org, f.feature_key, true, now() from public.features f;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_mgr, 'aprob-mgr-' || v_sufix || '@proba.test', now()),
    (v_u_ang, 'aprob-ang-' || v_sufix || '@proba.test', now()),
    (v_u_str, 'aprob-str-' || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_mgr, 'manager'),
    (v_org, v_u_ang, 'employee'),
    (v_org, v_u_str, 'employee');

  -- `v_e_str` nu e în echipa managerului: n-are `manager_employee_id`.
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_mgr, v_org, 'APR-M', 'Mihai', 'Manager', app.azi_local() - 500, 'activ', v_u_mgr, null),
    (v_e_ang, v_org, 'APR-A', 'Ana',   'Angajat', app.azi_local() - 400, 'activ', v_u_ang, v_e_mgr),
    (v_e_str, v_org, 'APR-S', 'Sorin', 'Strain',  app.azi_local() - 400, 'activ', v_u_str, null);

  select c.id into v_tara from public.countries c where c.cod_alpha2 = 'RO' limit 1;
  insert into public.per_diem_policies
    (organization_id, denumire, country_id_intern, moneda_interna, diurna_interna_zi,
     diurna_baza_legala_interna, multiplu_plafon_neimpozabil, multiplu_diurna_externa,
     prag_ore_minim, prag_ore_zi_intreaga, fractiune_zi_partiala, tarif_km_auto_personal,
     moneda_tarif_km, plafon_salarii_baza_luna, valabil_de_la)
  values (v_org, 'Politica de probă', v_tara, 'RON', 125, 0, 1, 1,
          12, 12, 1, 0, 'RON', 1, app.azi_local() - 400);

  -- Pregătirea stărilor de pornire se face ca superuser: nu ea e sub probă.
  v_d1 := pg_temp.deplasare(v_org, v_e_ang, v_tara, 'ciorna');
  v_d2 := pg_temp.deplasare(v_org, v_e_ang, v_tara, 'ciorna');
  v_d3 := pg_temp.deplasare(v_org, v_e_ang, v_tara, 'ciorna');
  v_d4 := pg_temp.deplasare(v_org, v_e_str, v_tara, 'ciorna');
  update public.business_trips set status = 'in_aprobare' where id in (v_d2, v_d3, v_d4);
  insert into public.trip_expenses
    (organization_id, business_trip_id, tip, data_cheltuielii, suma, moneda, curs_valutar)
  values (v_org, v_d3, 'cazare', app.azi_local(), 250, 'RON', 1)
  returning id into v_chelt;

  -- (1) angajatul își trimite deplasarea — `trimiteDeplasare`
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    update public.business_trips set status = 'in_aprobare'
     where id = v_d1 and status in ('ciorna', 'respinsa');
    get diagnostics v_atinse = row_count;
    reset role;
    if v_atinse = 1 then
      raise notice '  ✓ (1) angajatul își trimite deplasarea spre aprobare';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (1) trimiterea a atins % rânduri', v_atinse;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) angajatul nu-și poate trimite deplasarea: % (%)', sqlerrm, sqlstate;
  end;

  -- (2) managerul aprobă — `decideDeplasare`
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    update public.business_trips set status = 'aprobata'
     where id = v_d2 and status = 'in_aprobare';
    get diagnostics v_atinse = row_count;
    reset role;
    if v_atinse = 1 then
      raise notice '  ✓ (2) managerul aprobă deplasarea subordonatului';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (2) aprobarea a atins % rânduri', v_atinse;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) managerul nu poate aproba: % (%)', sqlerrm, sqlstate;
  end;

  -- (3) managerul respinge — tot `decideDeplasare`
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    update public.business_trips set status = 'respinsa'
     where id = v_d3 and status = 'in_aprobare';
    get diagnostics v_atinse = row_count;
    reset role;
    if v_atinse = 1 then
      raise notice '  ✓ (3) managerul respinge deplasarea subordonatului';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (3) respingerea a atins % rânduri', v_atinse;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) managerul nu poate respinge: % (%)', sqlerrm, sqlstate;
  end;

  -- (4) managerul aprobă o cheltuială — `decideCheltuiala`
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    update public.trip_expenses
       set aprobata = true, aprobata_de = v_u_mgr, aprobata_la = now()
     where id = v_chelt;
    get diagnostics v_atinse = row_count;
    reset role;
    if v_atinse = 1 then
      raise notice '  ✓ (4) managerul aprobă cheltuiala subordonatului';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (4) aprobarea cheltuielii a atins % rânduri', v_atinse;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) managerul nu poate aproba cheltuiala: % (%)', sqlerrm, sqlstate;
  end;

  -- (5) angajatul nu-și aprobă singur deplasarea trimisă la (1)
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    update public.business_trips set status = 'aprobata' where id = v_d1;
    get diagnostics v_atinse = row_count;
    reset role;
    if v_atinse = 0 then
      raise notice '  ✓ (5) angajatul nu-și poate aproba deplasarea (0 rânduri)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (5) angajatul și-a aprobat singur deplasarea';
    end if;
  exception when insufficient_privilege or raise_exception then
    reset role;
    raise notice '  ✓ (5) angajatul nu-și poate aproba deplasarea';
  end;

  -- (6) managerul nu aprobă în afara echipei
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    update public.business_trips set status = 'aprobata'
     where id = v_d4 and status = 'in_aprobare';
    get diagnostics v_atinse = row_count;
    reset role;
    if v_atinse = 0 then
      raise notice '  ✓ (6) managerul nu aprobă în afara echipei (0 rânduri)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (6) managerul a aprobat deplasarea cuiva din afara echipei';
    end if;
  exception when insufficient_privilege or raise_exception then
    reset role;
    raise notice '  ✓ (6) managerul nu aprobă în afara echipei';
  end;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA APROBARE DEPLASARE: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE cele 6 verificări au trecut.';
  raise notice '';
end;
$$;
