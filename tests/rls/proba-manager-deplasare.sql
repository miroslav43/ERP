-- tests/rls/proba-manager-deplasare.sql
--
-- MANAGERUL ÎȘI FACE PROPRIA DEPLASARE, DUPĂ 0154.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- (1) managerul își creează o deplasare pentru el                  [POZITIVĂ];
-- (2) și și-o poate modifica cât e ciornă                          [POZITIVĂ];
-- (3) dar NU poate crea o deplasare în numele unui subordonat — `own` nu e
--     `team`: aprobă deplasările echipei, nu le scrie în locul oamenilor.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix     text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org       uuid := gen_random_uuid();
  v_u_mgr     uuid := gen_random_uuid();
  v_u_ang     uuid := gen_random_uuid();
  v_e_mgr     uuid := gen_random_uuid();
  v_e_ang     uuid := gen_random_uuid();
  v_tara      uuid;
  v_deplasare uuid;
  v_atinse    int;
  v_esecuri   int := 0;
begin
  raise notice '';
  raise notice '  PROBA „MANAGERUL ÎȘI FACE DEPLASAREA" (0154)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-mgr-depl-' || v_sufix, 'Proba Deplasare SRL',
     'RO' || (88000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select v_org, f.feature_key, true, now() from public.features f;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_mgr, 'depl-mgr-' || v_sufix || '@proba.test', now()),
    (v_u_ang, 'depl-ang-' || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_mgr, 'manager'),
    (v_org, v_u_ang, 'employee');

  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_mgr, v_org, 'DEPL-M', 'Mihai', 'Manager', app.azi_local() - 500, 'activ', v_u_mgr, null),
    (v_e_ang, v_org, 'DEPL-A', 'Ana',   'Angajat', app.azi_local() - 400, 'activ', v_u_ang, v_e_mgr);

  select c.id into v_tara from public.countries c where c.cod_alpha2 = 'RO' limit 1;
  insert into public.per_diem_policies
    (organization_id, denumire, country_id_intern, moneda_interna, diurna_interna_zi,
     diurna_baza_legala_interna, multiplu_plafon_neimpozabil, multiplu_diurna_externa,
     prag_ore_minim, prag_ore_zi_intreaga, fractiune_zi_partiala, tarif_km_auto_personal,
     moneda_tarif_km, plafon_salarii_baza_luna, valabil_de_la)
  values (v_org, 'Politica de probă', v_tara, 'RON', 125, 0, 1, 1,
          12, 12, 1, 0, 'RON', 1, app.azi_local() - 400);

  -- (1) managerul, pentru el însuși
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    insert into public.business_trips
      (organization_id, employee_id, country_id, localitate, plecare_la, sosire_la, status, scop,
       mijloc_transport)
    values (v_org, v_e_mgr, v_tara, 'Cluj-Napoca', now() + interval '1 day',
            now() + interval '3 days', 'ciorna', 'Probă', 'auto_personal')
    returning id into v_deplasare;
    reset role;
    raise notice '  ✓ (1) managerul își creează deplasarea';
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) managerul nu-și poate crea deplasarea: % (%)', sqlerrm, sqlstate;
  end;

  -- (2) și și-o modifică, cât e ciornă
  if v_deplasare is not null then
    perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
    set local role authenticated;
    begin
      update public.business_trips set localitate = 'Iași' where id = v_deplasare;
      get diagnostics v_atinse = row_count;
      reset role;
      if v_atinse = 1 then
        raise notice '  ✓ (2) managerul își modifică ciorna';
      else
        v_esecuri := v_esecuri + 1;
        raise warning '  ✗ (2) modificarea ciornei proprii a atins % rânduri', v_atinse;
      end if;
    exception when others then
      reset role;
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (2) managerul nu-și poate modifica ciorna: % (%)', sqlerrm, sqlstate;
    end;
  end if;

  -- (3) dar nu în numele subordonatului
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    insert into public.business_trips
      (organization_id, employee_id, country_id, localitate, plecare_la, sosire_la, status, scop,
       mijloc_transport)
    values (v_org, v_e_ang, v_tara, 'Brașov', now() + interval '1 day',
            now() + interval '2 days', 'ciorna', 'Probă', 'auto_personal');
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) managerul a creat o deplasare în numele subordonatului';
  exception when insufficient_privilege or raise_exception then
    reset role;
    raise notice '  ✓ (3) deplasarea în numele subordonatului e refuzată';
  end;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA MANAGER DEPLASARE: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE cele 3 verificări au trecut.';
  raise notice '';
end;
$$;
