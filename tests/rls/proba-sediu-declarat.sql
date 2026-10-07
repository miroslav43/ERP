-- tests/rls/proba-sediu-declarat.sql
--
-- SEDIUL DECLARAT AL ZILEI, DUPĂ 0163.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- (1) angajatul vede lista sediilor, deși n-are `departments:read`  [POZITIVĂ];
-- (2) iar sediul din contractul lui e marcat `din_contract`          [POZITIVĂ];
-- (3) își declară sediul pe ziua proprie, „la birou"                 [POZITIVĂ];
-- (4) dar nu un sediu al ALTEI firme — FK-ul compus;
-- (5) și nici un sediu pe o zi de homeoffice — CHECK-ul;
-- (6) cine nu e membru al firmei primește lista GOALĂ.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org      uuid := gen_random_uuid();
  v_alta     uuid := gen_random_uuid();
  v_u_ang    uuid := gen_random_uuid();
  v_u_strain uuid := gen_random_uuid();
  v_e_ang    uuid := gen_random_uuid();
  v_e_strain uuid := gen_random_uuid();
  v_sediu_a  uuid := gen_random_uuid();
  v_sediu_b  uuid := gen_random_uuid();
  v_sediu_x  uuid := gen_random_uuid();
  v_numar    int;
  v_contract uuid;
  v_esecuri  int := 0;
begin
  raise notice '';
  raise notice '  PROBA „SEDIUL DECLARAT AL ZILEI" (0163)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org,  'proba-sediu-' || v_sufix,  'Proba Sediu SRL',
     'RO' || (86000000 + (random() * 900000)::int)::text),
    (v_alta, 'proba-sediu-x-' || v_sufix, 'Alta Firma SRL',
     'RO' || (85000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select o, f.feature_key, true, now() from public.features f, unnest(array[v_org, v_alta]) o;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_ang,    'sediu-ang-' || v_sufix || '@proba.test', now()),
    (v_u_strain, 'sediu-x-'   || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org,  v_u_ang,    'employee'),
    (v_alta, v_u_strain, 'employee');

  insert into public.puncte_lucru (id, organization_id, denumire, sediu_principal, activ) values
    (v_sediu_a, v_org,  'Sediul A', true,  true),
    (v_sediu_b, v_org,  'Sediul B', false, true),
    (v_sediu_x, v_alta, 'Sediul X', true,  true);

  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id) values
    (v_e_ang,    v_org,  'SED-A', 'Ana',    'Angajat', app.azi_local() - 400, 'activ', v_u_ang),
    (v_e_strain, v_alta, 'SED-X', 'Xenia',  'Straina', app.azi_local() - 400, 'activ', v_u_strain);

  insert into public.employment_contracts (organization_id, employee_id, numar, data_contract,
                                           valabil_de_la, salariu_baza, status, punct_lucru_id)
  values (v_org, v_e_ang, 'CIM-SED', app.azi_local() - 400, app.azi_local() - 400, 5000, 'activ',
          v_sediu_b)
  returning id into v_contract;

  -- (1) + (2) lista, văzută de angajat
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    select count(*) into v_numar from public.sedii_pentru_pontaj(v_org);
    if v_numar = 2 then
      raise notice '  ✓ (1) angajatul vede cele 2 sedii ale firmei';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (1) angajatul vede % sedii, nu 2', v_numar;
    end if;

    select count(*) into v_numar from public.sedii_pentru_pontaj(v_org) s
     where s.din_contract and s.id = v_sediu_b;
    if v_numar = 1 then
      raise notice '  ✓ (2) sediul din contract e marcat';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (2) sediul din contract nu e marcat';
    end if;
    reset role;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1-2) lista sediilor a căzut: % (%)', sqlerrm, sqlstate;
  end;

  -- (3) declară sediul A pe ziua proprie
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    insert into public.attendance_entries (organization_id, employee_id, data, ora_inceput,
                                           ora_sfarsit, ore_lucrate, tip_zi, tip_prezenta,
                                           punct_lucru_declarat_id)
    values (v_org, v_e_ang, app.azi_local(), '09:00', '17:00', 8, 'lucratoare', 'birou', v_sediu_a);
    reset role;
    raise notice '  ✓ (3) angajatul își declară sediul pe ziua proprie';
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) declararea sediului a fost refuzată: % (%)', sqlerrm, sqlstate;
  end;

  -- (4) sediul altei firme
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    insert into public.attendance_entries (organization_id, employee_id, data, ore_lucrate,
                                           tip_zi, tip_prezenta, punct_lucru_declarat_id)
    values (v_org, v_e_ang, app.azi_local() - 1, 8, 'lucratoare', 'birou', v_sediu_x);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) a trecut un sediu al altei firme';
  exception when foreign_key_violation then
    reset role;
    raise notice '  ✓ (4) sediul altei firme e refuzat';
  end;

  -- (5) homeoffice cu sediu
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    insert into public.attendance_entries (organization_id, employee_id, data, ore_lucrate,
                                           tip_zi, tip_prezenta, punct_lucru_declarat_id)
    values (v_org, v_e_ang, app.azi_local() - 2, 8, 'lucratoare', 'homeoffice', v_sediu_a);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) a trecut homeoffice cu sediu declarat';
  exception when check_violation then
    reset role;
    raise notice '  ✓ (5) homeoffice cu sediu e refuzat';
  end;

  -- (6) străinul nu vede sediile firmei
  perform set_config('request.jwt.claim.sub', v_u_strain::text, true);
  set local role authenticated;
  begin
    select count(*) into v_numar from public.sedii_pentru_pontaj(v_org);
    reset role;
    if v_numar = 0 then
      raise notice '  ✓ (6) cine nu e membru primește lista goală';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (6) un străin vede % sedii ale firmei', v_numar;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) a căzut: % (%)', sqlerrm, sqlstate;
  end;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA SEDIU DECLARAT: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE cele 6 verificări au trecut.';
  raise notice '';
end;
$$;
