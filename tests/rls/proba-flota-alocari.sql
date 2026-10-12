-- tests/rls/proba-flota-alocari.sql
--
-- FLOTA, DUPĂ 0173: ALOCĂRILE VEHICUL ↔ ȘOFER CA PERIOADE.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- (1) org_admin alocă vehiculul; derivatul `vehicles.employee_id` urmează [POZITIVĂ];
-- (2) predarea către alt șofer închide singură alocarea precedentă, cu
--     kilometrajul de predare ca restituire                          [POZITIVĂ];
-- (3) o alocare retroactivă care se suprapune e refuzată (23P01);
-- (4) `vehicles.employee_id` nu se mai scrie direct din aplicație (P0001);
-- (5) un angajat fără `vehicles:update` nu alocă (42501);
-- (6) angajatul altei firme nu se poate aloca (P0001);
-- (7) șoferul își vede propriile alocări, inclusiv cea încheiată     [POZITIVĂ];
-- (8) încheierea alocării lasă vehiculul fără șofer                  [POZITIVĂ];
-- (9) casarea vehiculului închide alocarea deschisă                   [POZITIVĂ];
-- (10) un vehicul casat nu se mai alocă (P0001).
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix     text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org       uuid := gen_random_uuid();
  v_org_alta  uuid := gen_random_uuid();
  v_u_admin   uuid := gen_random_uuid();
  v_u_a       uuid := gen_random_uuid();
  v_e_a       uuid := gen_random_uuid();
  v_e_b       uuid := gen_random_uuid();
  v_e_strain  uuid := gen_random_uuid();
  v_vehicul   uuid := gen_random_uuid();
  v_aloc_a    uuid;
  v_aloc_b    uuid;
  v_sofer     uuid;
  v_pana_la   timestamptz;
  v_km        integer;
  v_n         integer;
  v_esecuri   int := 0;
begin
  raise notice '';
  raise notice '  PROBA „FLOTA — ALOCĂRI" (0173)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-aloc-' || v_sufix, 'Proba Alocări SRL',
     'RO' || (85000000 + (random() * 900000)::int)::text),
    (v_org_alta, 'proba-aloc-alta-' || v_sufix, 'Altă Firmă SRL',
     'RO' || (84000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select v_org, f.feature_key, true, now() from public.features f;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_admin, 'aloc-adm-' || v_sufix || '@proba.test', now()),
    (v_u_a,     'aloc-a-'   || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_admin, 'org_admin'),
    (v_org, v_u_a,     'employee');

  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id) values
    (v_e_a, v_org, 'AL-A', 'Ana',    'Șofer', app.azi_local() - 400, 'activ', v_u_a),
    (v_e_b, v_org, 'AL-B', 'Bogdan', 'Șofer', app.azi_local() - 400, 'activ', null),
    (v_e_strain, v_org_alta, 'AL-X', 'Xenia', 'Străină', app.azi_local() - 400, 'activ', null);

  -- Șoferul își vede vehiculele lui, doar în firma de probă.
  insert into public.role_permissions (role, resource, action, scope, organization_id) values
    ('employee', 'vehicles', 'read', 'own', v_org);

  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent,
                               created_by, updated_by)
  values (v_vehicul, v_org, 'B' || (100 + (random() * 800)::int)::text || 'ALC', 'Dacia', 'Duster', 50000,
          v_u_admin, v_u_admin);

  -- (1) prima alocare
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, km_predare,
                                            created_by, updated_by)
    values (v_org, v_vehicul, v_e_a, now() - interval '10 days', 50000, v_u_admin, v_u_admin)
    returning id into v_aloc_a;
    reset role;
    select employee_id into v_sofer from public.vehicles where id = v_vehicul;
    if v_sofer = v_e_a then
      raise notice '  ✓ (1) alocarea face din Ana șoferul vehiculului';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (1) după alocare, șoferul vehiculului e %', v_sofer;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) org_admin nu poate aloca: % (%)', sqlerrm, sqlstate;
  end;

  -- (2) predarea către Bogdan o închide pe a Anei
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, km_predare,
                                            created_by, updated_by)
    values (v_org, v_vehicul, v_e_b, now() - interval '2 days', 51200, v_u_admin, v_u_admin)
    returning id into v_aloc_b;
    reset role;
    select employee_id into v_sofer from public.vehicles where id = v_vehicul;
    select pana_la, km_restituire into v_pana_la, v_km from public.vehicle_assignments where id = v_aloc_a;
    if v_sofer = v_e_b and v_pana_la is not null and v_km = 51200 then
      raise notice '  ✓ (2) predarea închide alocarea precedentă, cu km de restituire';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (2) după predare: șofer %, pana_la %, km_restituire %', v_sofer, v_pana_la, v_km;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) predarea către alt șofer a eșuat: % (%)', sqlerrm, sqlstate;
  end;

  -- (3) o alocare retroactivă care încalecă perioada Anei
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, pana_la,
                                            created_by, updated_by)
    values (v_org, v_vehicul, v_e_b, now() - interval '8 days', now() - interval '6 days', v_u_admin, v_u_admin);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) o alocare suprapusă a fost acceptată';
  exception when exclusion_violation then
    reset role;
    raise notice '  ✓ (3) alocarea suprapusă e refuzată (23P01)';
  end;

  -- (4) scrierea directă a șoferului pe vehicul
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    update public.vehicles set employee_id = v_e_a, updated_by = v_u_admin where id = v_vehicul;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) vehicles.employee_id s-a scris direct, fără alocare';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (4) șoferul nu se scrie direct pe vehicul';
  end;

  -- (5) un angajat fără vehicles:update
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la,
                                            created_by, updated_by)
    values (v_org, v_vehicul, v_e_a, now(), v_u_a, v_u_a);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) un angajat fără vehicles:update și-a alocat vehiculul';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (5) angajatul fără drept nu alocă';
  end;

  -- (6) angajatul altei firme
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la,
                                            created_by, updated_by)
    values (v_org, v_vehicul, v_e_strain, now(), v_u_admin, v_u_admin);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) angajatul altei firme a fost alocat';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (6) angajatul altei firme e refuzat';
  end;

  -- (7) Ana își vede alocarea, deși e încheiată
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  select count(*) into v_n from public.vehicle_assignments where vehicle_id = v_vehicul;
  reset role;
  if v_n = 1 then
    raise notice '  ✓ (7) șoferul își vede propria alocare, nu și pe a colegului';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) șoferul vede % alocări (așteptat: 1, a lui)', v_n;
  end if;

  -- (8) încheierea alocării lui Bogdan
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    update public.vehicle_assignments
       set pana_la = now() - interval '1 hour', km_restituire = 51900, updated_by = v_u_admin
     where id = v_aloc_b;
    get diagnostics v_n = row_count;
    reset role;
    select employee_id into v_sofer from public.vehicles where id = v_vehicul;
    if v_n = 1 and v_sofer is null then
      raise notice '  ✓ (8) alocarea încheiată lasă vehiculul fără șofer';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (8) încheierea: % rânduri, șofer rămas %', v_n, v_sofer;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) încheierea alocării a eșuat: % (%)', sqlerrm, sqlstate;
  end;

  -- (9) casarea închide alocarea deschisă
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la,
                                          created_by, updated_by)
  values (v_org, v_vehicul, v_e_a, now() - interval '30 minutes', v_u_admin, v_u_admin)
  returning id into v_aloc_a;
  begin
    update public.vehicles
       set status = 'casat', motiv_iesire = 'Probă', updated_by = v_u_admin
     where id = v_vehicul;
    reset role;
    select pana_la into v_pana_la from public.vehicle_assignments where id = v_aloc_a;
    select employee_id into v_sofer from public.vehicles where id = v_vehicul;
    if v_pana_la is not null and v_sofer is null then
      raise notice '  ✓ (9) casarea închide alocarea și scoate șoferul';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (9) după casare: pana_la %, șofer %', v_pana_la, v_sofer;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) casarea a eșuat: % (%)', sqlerrm, sqlstate;
  end;

  -- (10) vehiculul casat nu se mai alocă
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la,
                                            created_by, updated_by)
    values (v_org, v_vehicul, v_e_b, now(), v_u_admin, v_u_admin);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10) un vehicul casat a fost alocat';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (10) vehiculul casat nu se mai alocă';
  end;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA FLOTA ALOCĂRI: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE cele 10 verificări au trecut.';
  raise notice '';
end;
$$;
