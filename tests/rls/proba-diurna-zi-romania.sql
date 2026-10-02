-- tests/rls/proba-diurna-zi-romania.sql
--
-- DIURNA PE ZIUA ROMÂNIEI, DUPĂ 0159.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- Sesiunea bazei e în UTC: o plecare la 01.10.2026 00:30 ora României e
-- 30.09.2026 21:30Z, iar `plecare_la::date` dădea 30 septembrie.
-- (1) cu politica schimbată pe 1 octombrie, recalcularea alege politica de
--     1 octombrie (ziua României), nu pe cea de 30 septembrie      [POZITIVĂ];
-- (2) o firmă care are DOAR politica de la 1 octombrie își poate salva
--     deplasarea care pleacă la 00:30 pe 1 octombrie — triggerul de validare
--     alege politica pe aceeași zi ca recalcularea                  [POZITIVĂ].
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix     text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org       uuid := gen_random_uuid();
  v_org2      uuid := gen_random_uuid();
  v_u_admin   uuid := gen_random_uuid();
  v_e         uuid := gen_random_uuid();
  v_e2        uuid := gen_random_uuid();
  v_tara      uuid;
  v_pol_sept  uuid;
  v_pol_oct   uuid;
  v_deplasare uuid;
  v_aleasa    uuid;
  -- 01.10.2026 00:30 la București (EEST, +03:00) = 30.09.2026 21:30Z.
  v_plecare   timestamptz := '2026-10-01 00:30:00+03';
  v_sosire    timestamptz := '2026-10-02 18:00:00+03';
  v_esecuri   int := 0;
begin
  raise notice '';
  raise notice '  PROBA „DIURNA PE ZIUA ROMÂNIEI" (0159)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-diurna-ro-' || v_sufix, 'Proba Diurna SRL',
     'RO' || (87000000 + (random() * 900000)::int)::text),
    (v_org2, 'proba-diurna-ro2-' || v_sufix, 'Proba Diurna Doi SRL',
     'RO' || (86000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select o, f.feature_key, true, now() from public.features f, unnest(array[v_org, v_org2]) o;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_admin, 'diurna-ro-' || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_admin, 'org_admin');

  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id) values
    (v_e,  v_org,  'DRO-1', 'Ana', 'Drum', date '2024-01-01', 'activ', null),
    (v_e2, v_org2, 'DRO-2', 'Ion', 'Drum', date '2024-01-01', 'activ', null);

  select c.id into v_tara from public.countries c where c.cod_alpha2 = 'RO' limit 1;

  -- Firma 1: 50 lei/zi până pe 30.09, 60 lei/zi de la 01.10.
  insert into public.per_diem_policies
    (organization_id, denumire, country_id_intern, moneda_interna, diurna_interna_zi,
     diurna_baza_legala_interna, multiplu_plafon_neimpozabil, multiplu_diurna_externa,
     prag_ore_minim, prag_ore_zi_intreaga, fractiune_zi_partiala, tarif_km_auto_personal,
     moneda_tarif_km, plafon_salarii_baza_luna, valabil_de_la, valabil_pana)
  values (v_org, 'Politica din septembrie', v_tara, 'RON', 50, 50, 2.5, 1,
          8, 12, 0.5, 0, 'RON', 3, date '2025-01-01', date '2026-09-30')
  returning id into v_pol_sept;
  insert into public.per_diem_policies
    (organization_id, denumire, country_id_intern, moneda_interna, diurna_interna_zi,
     diurna_baza_legala_interna, multiplu_plafon_neimpozabil, multiplu_diurna_externa,
     prag_ore_minim, prag_ore_zi_intreaga, fractiune_zi_partiala, tarif_km_auto_personal,
     moneda_tarif_km, plafon_salarii_baza_luna, valabil_de_la)
  values (v_org, 'Politica din octombrie', v_tara, 'RON', 60, 60, 2.5, 1,
          8, 12, 0.5, 0, 'RON', 3, date '2026-10-01')
  returning id into v_pol_oct;

  -- Firma 2: DOAR politica de la 01.10.
  insert into public.per_diem_policies
    (organization_id, denumire, country_id_intern, moneda_interna, diurna_interna_zi,
     diurna_baza_legala_interna, multiplu_plafon_neimpozabil, multiplu_diurna_externa,
     prag_ore_minim, prag_ore_zi_intreaga, fractiune_zi_partiala, tarif_km_auto_personal,
     moneda_tarif_km, plafon_salarii_baza_luna, valabil_de_la)
  values (v_org2, 'Politica din octombrie', v_tara, 'RON', 60, 60, 2.5, 1,
          8, 12, 0.5, 0, 'RON', 3, date '2026-10-01');

  -- (1) recalcularea alege politica zilei din România
  insert into public.business_trips
    (organization_id, employee_id, country_id, localitate, plecare_la, sosire_la, scop,
     mijloc_transport)
  values (v_org, v_e, v_tara, 'Cluj-Napoca', v_plecare, v_sosire, 'Probă', 'auto_personal')
  returning id into v_deplasare;

  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    perform app.recalculeaza_diurna(v_deplasare);
    reset role;
    select c.policy_id into v_aleasa from public.per_diem_calculations c
     where c.business_trip_id = v_deplasare;
    if v_aleasa = v_pol_oct then
      raise notice '  ✓ (1) plecarea de la 00:30 pe 1 octombrie folosește politica din octombrie';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (1) recalcularea a ales politica %, nu pe cea din octombrie (ziua UTC?)',
        case when v_aleasa = v_pol_sept then 'din septembrie' else coalesce(v_aleasa::text, 'nicio') end;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) recalcularea a eșuat: % (%)', sqlerrm, sqlstate;
  end;

  -- (2) validarea alege aceeași zi ca recalcularea
  begin
    insert into public.business_trips
      (organization_id, employee_id, country_id, localitate, plecare_la, sosire_la, scop,
       mijloc_transport)
    values (v_org2, v_e2, v_tara, 'Iași', v_plecare, v_sosire, 'Probă', 'auto_personal');
    raise notice '  ✓ (2) deplasarea de la 00:30 pe 1 octombrie trece de validare cu politica din octombrie';
  exception when others then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) validarea a refuzat deplasarea: % (%)', sqlerrm, sqlstate;
  end;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA DIURNA PE ZIUA ROMÂNIEI: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE cele 2 verificări au trecut.';
end $$;
