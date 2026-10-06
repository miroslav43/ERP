-- tests/rls/proba-sterge-sablon-evaluare.sql
--
-- ȘTERGEREA UNUI ȘABLON DE EVALUARE NEFOLOSIT, DUPĂ 0162.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- (0) UPDATE-ul direct pe `deleted_at` pică cu 42501 — motivul pentru care
--     există funcția. Dacă proba asta începe să treacă, politica SELECT s-a
--     schimbat și funcția trebuie reevaluată                        [DOVADĂ];
-- (1) `org_admin` șterge un șablon nefolosit al firmei              [POZITIVĂ];
-- (2) dar nu unul folosit de o evaluare — îl poate doar arhiva;
-- (3) `manager` (evaluations:update = team) nu șterge nimic;
-- (4) `org_admin` din altă firmă nu atinge șablonul;
-- (5) șablonul de platformă nu se șterge din aplicație.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix      text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org        uuid := gen_random_uuid();
  v_org_alta   uuid := gen_random_uuid();
  v_u_admin    uuid := gen_random_uuid();
  v_u_mgr      uuid := gen_random_uuid();
  v_u_strain   uuid := gen_random_uuid();
  v_e_ang      uuid := gen_random_uuid();
  v_s_liber    uuid := gen_random_uuid();
  v_s_folosit  uuid := gen_random_uuid();
  v_s_platf    uuid := gen_random_uuid();
  v_sters      timestamptz;
  v_esecuri    int := 0;
begin
  raise notice '';
  raise notice '  PROBA „ȘTERGE ȘABLON DE EVALUARE" (0162)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-sterge-sabl-' || v_sufix, 'Proba Șabloane SRL',
     'RO' || (87000000 + (random() * 900000)::int)::text),
    (v_org_alta, 'proba-sterge-alta-' || v_sufix, 'Altă Firmă SRL',
     'RO' || (86000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select o, f.feature_key, true, now()
    from public.features f, unnest(array[v_org, v_org_alta]) o;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_admin,  'sabl-admin-'  || v_sufix || '@proba.test', now()),
    (v_u_mgr,    'sabl-mgr-'    || v_sufix || '@proba.test', now()),
    (v_u_strain, 'sabl-strain-' || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_admin, 'org_admin'),
    (v_org, v_u_mgr, 'manager'),
    (v_org_alta, v_u_strain, 'org_admin');

  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status) values
    (v_e_ang, v_org, 'SABL-A', 'Ana', 'Angajat', app.azi_local() - 400, 'activ');

  insert into public.evaluation_templates (id, organization_id, denumire, criterii) values
    (v_s_liber,   v_org, 'Copie nefolosită ' || v_sufix,
     '[{"cod":"c1","denumire":"Calitate","tip":"scala","scala_max":5}]'),
    (v_s_folosit, v_org, 'Șablon folosit ' || v_sufix,
     '[{"cod":"c1","denumire":"Calitate","tip":"scala","scala_max":5}]'),
    (v_s_platf,   null,  'Platformă de probă ' || v_sufix,
     '[{"cod":"c1","denumire":"Calitate","tip":"scala","scala_max":5}]');
  insert into public.employee_evaluations (organization_id, employee_id, template_id, data_evaluarii)
  values (v_org, v_e_ang, v_s_folosit, app.azi_local());

  -- (0) UPDATE-ul direct, ca org_admin
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    update public.evaluation_templates set deleted_at = now() where id = v_s_liber;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (0) UPDATE-ul direct pe deleted_at a trecut — politica SELECT s-a schimbat, revezi 0162';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (0) UPDATE-ul direct pe deleted_at pică cu 42501, cum descrie 0162';
  end;

  -- (1) org_admin, șablon nefolosit
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    perform public.sterge_sablon_evaluare(v_org, v_s_liber);
    reset role;
    select deleted_at into v_sters from public.evaluation_templates where id = v_s_liber;
    if v_sters is not null then
      raise notice '  ✓ (1) org_admin șterge șablonul nefolosit';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (1) funcția a răspuns, dar șablonul n-a fost marcat șters';
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) org_admin nu poate șterge șablonul nefolosit: % (%)', sqlerrm, sqlstate;
  end;

  -- (2) org_admin, șablon folosit
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    perform public.sterge_sablon_evaluare(v_org, v_s_folosit);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) un șablon folosit de o evaluare a fost șters';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (2) șablonul folosit e refuzat: %', sqlerrm;
  end;

  -- (3) manager
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    perform public.sterge_sablon_evaluare(v_org, v_s_folosit);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) managerul a șters un șablon';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (3) managerul e refuzat cu 42501';
  end;

  -- (4) org_admin din altă firmă
  perform set_config('request.jwt.claim.sub', v_u_strain::text, true);
  set local role authenticated;
  begin
    perform public.sterge_sablon_evaluare(v_org, v_s_folosit);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) un admin din altă firmă a șters un șablon străin';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (4) adminul altei firme e refuzat cu 42501';
  end;
  begin
    perform set_config('request.jwt.claim.sub', v_u_strain::text, true);
    set local role authenticated;
    perform public.sterge_sablon_evaluare(v_org_alta, v_s_folosit);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4b) șablonul altei firme a fost șters prin organizația proprie';
  exception when no_data_found then
    reset role;
    raise notice '  ✓ (4b) prin organizația proprie, șablonul străin „nu există" (P0002)';
  end;

  -- (5) șablon de platformă
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    perform public.sterge_sablon_evaluare(v_org, v_s_platf);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) șablonul de platformă a fost șters';
  exception when no_data_found then
    reset role;
    raise notice '  ✓ (5) șablonul de platformă nu se șterge (P0002)';
  end;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA ȘTERGE ȘABLON: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE cele 7 verificări au trecut.';
  raise notice '';
end;
$$;
