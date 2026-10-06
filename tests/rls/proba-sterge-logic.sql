-- tests/rls/proba-sterge-logic.sql
--
-- ȘTERGEREA LOGICĂ PRIN `public.sterge_logic`, DUPĂ 0164.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- (0) UPDATE-ul direct pe `deleted_at` pică cu 42501 — defectul       [DOVADĂ];
-- (1) org_admin scoate o țintă KPI                                    [POZITIVĂ];
-- (2) org_admin scoate un indicator KPI                               [POZITIVĂ];
-- (3) org_admin retrage o suprascriere de permisiune a unui membru    [POZITIVĂ];
-- (4) org_admin retrage șablonul de document al firmei                [POZITIVĂ];
-- (5) autorul își șterge ciorna de înrolare                           [POZITIVĂ];
-- (6) angajatul NU poate scoate ținta lui — USING-ul politicii UPDATE îl
--     refuză, deci funcția întoarce zero rânduri, ca RLS-ul;
-- (7) adminul altei firme nu atinge nimic din firma asta;
-- (8) alt utilizator nu șterge ciorna altcuiva;
-- (9) o tabelă din afara listei e refuzată cu 42501;
-- (10) șablonul de PLATFORMĂ (organization_id null) nu se șterge.
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
  v_u_ang     uuid := gen_random_uuid();
  v_u_strain  uuid := gen_random_uuid();
  v_m_ang     uuid;
  v_e_ang     uuid := gen_random_uuid();
  v_set       uuid := gen_random_uuid();
  v_ind_1     uuid := gen_random_uuid();
  v_ind_2     uuid := gen_random_uuid();
  v_tinta_1   uuid := gen_random_uuid();
  v_tinta_2   uuid := gen_random_uuid();
  v_rp        uuid := gen_random_uuid();
  v_tpl       uuid := gen_random_uuid();
  v_tpl_plat  uuid;
  v_ciorna    uuid := gen_random_uuid();
  v_rez       uuid[];
  v_esecuri   int := 0;
begin
  raise notice '';
  raise notice '  PROBA „ȘTERGERE LOGICĂ" (0164)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-sterge-' || v_sufix, 'Proba Ștergere SRL',
     'RO' || (85000000 + (random() * 900000)::int)::text),
    (v_org_alta, 'proba-sterge-alta-' || v_sufix, 'Altă Firmă SRL',
     'RO' || (84000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select o, f.feature_key, true, now()
    from public.features f, unnest(array[v_org, v_org_alta]) o;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_admin,  'sl-admin-'  || v_sufix || '@proba.test', now()),
    (v_u_ang,    'sl-ang-'    || v_sufix || '@proba.test', now()),
    (v_u_strain, 'sl-strain-' || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_admin, 'org_admin'),
    (v_org_alta, v_u_strain, 'org_admin');
  insert into public.organization_members (organization_id, user_id, role)
  values (v_org, v_u_ang, 'employee') returning id into v_m_ang;

  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id) values
    (v_e_ang, v_org, 'SL-A', 'Ana', 'Angajat', app.azi_local() - 400, 'activ', v_u_ang);

  insert into public.kpi_seturi (id, organization_id, functie, denumire)
  values (v_set, v_org, 'Funcție probă ' || v_sufix, 'Set probă');
  insert into public.kpi_indicatori (id, organization_id, set_id, cod, denumire, tip, sens,
                                     tinta_implicita, unitate, pondere) values
    (v_ind_1, v_org, v_set, 'vizite', 'Vizite', 'masurat', 'crestere', 40, 'buc', 50),
    (v_ind_2, v_org, v_set, 'oferte', 'Oferte', 'masurat', 'crestere', 10, 'buc', 50);
  insert into public.kpi_tinte_angajat (id, organization_id, employee_id, indicator_id, tinta) values
    (v_tinta_1, v_org, v_e_ang, v_ind_1, 25),
    (v_tinta_2, v_org, v_e_ang, v_ind_2, 5);

  insert into public.role_permissions (id, organization_id, role, resource, action, scope, member_id)
  values (v_rp, v_org, 'employee', 'leave', 'read', 'all', v_m_ang);

  insert into public.hr_document_templates (id, organization_id, cod, denumire, continut_html)
  values (v_tpl, v_org, 'proba_' || v_sufix, 'Șablon probă', '<p>probă</p>');
  select id into v_tpl_plat from public.hr_document_templates
   where organization_id is null and deleted_at is null limit 1;

  insert into public.inrolare_ciorne (id, organization_id, autor_id)
  values (v_ciorna, v_org, v_u_admin);

  -- (0) dovada: UPDATE-ul direct pică
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    update public.kpi_tinte_angajat set deleted_at = now() where id = v_tinta_1;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (0) UPDATE-ul direct a trecut — politica SELECT s-a schimbat, revezi 0164';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (0) UPDATE-ul direct pe deleted_at pică cu 42501';
  end;

  -- (6) angajatul, pe ținta lui: zero rânduri
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  v_rez := public.sterge_logic('kpi_tinte_angajat', array[v_tinta_1]);
  reset role;
  if cardinality(v_rez) = 0 then
    raise notice '  ✓ (6) angajatul nu-și scoate ținta (zero rânduri, ca RLS-ul)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) angajatul și-a scos singur ținta';
  end if;

  -- (7) adminul altei firme, pe toate tabelele firmei
  perform set_config('request.jwt.claim.sub', v_u_strain::text, true);
  set local role authenticated;
  v_rez := public.sterge_logic('kpi_tinte_angajat', array[v_tinta_1])
        || public.sterge_logic('kpi_indicatori', array[v_ind_1])
        || public.sterge_logic('role_permissions', array[v_rp])
        || public.sterge_logic('hr_document_templates', array[v_tpl])
        || public.sterge_logic('inrolare_ciorne', array[v_ciorna]);
  reset role;
  if cardinality(v_rez) = 0 then
    raise notice '  ✓ (7) adminul altei firme nu atinge nimic';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) adminul altei firme a șters % rânduri', cardinality(v_rez);
  end if;

  -- (8) alt utilizator din aceeași firmă, pe ciorna adminului
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  v_rez := public.sterge_logic('inrolare_ciorne', array[v_ciorna]);
  reset role;
  if cardinality(v_rez) = 0 then
    raise notice '  ✓ (8) ciorna altcuiva nu se șterge';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) un utilizator a șters ciorna altuia';
  end if;

  -- (9) tabelă din afara listei
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    perform public.sterge_logic('organizations', array[v_org]);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) organizations a trecut prin sterge_logic';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (9) tabelă din afara listei: 42501';
  end;

  -- (10) șablonul de platformă
  if v_tpl_plat is not null then
    perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
    set local role authenticated;
    v_rez := public.sterge_logic('hr_document_templates', array[v_tpl_plat]);
    reset role;
    if cardinality(v_rez) = 0 then
      raise notice '  ✓ (10) șablonul de platformă nu se șterge';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (10) șablonul de platformă a fost șters';
    end if;
  end if;

  -- (1)–(5) pozitivele, ca org_admin (ciorna e a lui)
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    v_rez := public.sterge_logic('kpi_tinte_angajat', array[v_tinta_1]);
    if cardinality(v_rez) <> 1 then raise exception '(1) ținta: % rânduri', cardinality(v_rez); end if;
    v_rez := public.sterge_logic('kpi_indicatori', array[v_ind_2]);
    if cardinality(v_rez) <> 1 then raise exception '(2) indicatorul: % rânduri', cardinality(v_rez); end if;
    v_rez := public.sterge_logic('role_permissions', array[v_rp]);
    if cardinality(v_rez) <> 1 then raise exception '(3) suprascrierea: % rânduri', cardinality(v_rez); end if;
    v_rez := public.sterge_logic('hr_document_templates', array[v_tpl]);
    if cardinality(v_rez) <> 1 then raise exception '(4) șablonul: % rânduri', cardinality(v_rez); end if;
    v_rez := public.sterge_logic('inrolare_ciorne', array[v_ciorna]);
    if cardinality(v_rez) <> 1 then raise exception '(5) ciorna: % rânduri', cardinality(v_rez); end if;
    reset role;
    if (select count(*) from public.kpi_tinte_angajat where id = v_tinta_1 and deleted_at is not null) = 1
       and (select count(*) from public.kpi_indicatori where id = v_ind_2 and deleted_at is not null) = 1
       and (select count(*) from public.role_permissions where id = v_rp and deleted_at is not null) = 1
       and (select count(*) from public.hr_document_templates where id = v_tpl and deleted_at is not null) = 1
       and (select count(*) from public.inrolare_ciorne where id = v_ciorna and deleted_at is not null) = 1
    then
      raise notice '  ✓ (1)–(5) org_admin șterge țintă, indicator, suprascriere, șablon, ciornă';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (1)–(5) funcția a răspuns, dar rândurile nu sunt marcate șterse';
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1)–(5) %: % (%)', 'pozitive', sqlerrm, sqlstate;
  end;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA ȘTERGERE LOGICĂ: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE verificările au trecut.';
  raise notice '';
end;
$$;
