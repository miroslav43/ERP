-- tests/rls/proba-sablon-personalizat.sql
--
-- VARIANTA FIRMEI A UNUI ȘABLON DE EVALUARE DE PLATFORMĂ, DUPĂ 0168.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- (1) org_admin creează varianta firmei din șablonul de platformă   [POZITIVĂ];
-- (2) a doua variantă vie a aceluiași șablon e refuzată (23505);
-- (3) `derivat_din` spre un șablon al FIRMEI e refuzat (P0001);
-- (4) după ștergerea variantei (0162), se poate personaliza din nou [POZITIVĂ];
-- (5) un șablon de platformă nu poate avea el însuși `derivat_din` (check).
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org      uuid := gen_random_uuid();
  v_u_admin  uuid := gen_random_uuid();
  v_platf    uuid := gen_random_uuid();
  v_propriu  uuid := gen_random_uuid();
  v_varianta uuid;
  v_esecuri  int := 0;
  c_criterii jsonb := '[{"cod":"c1","denumire":"Calitate","tip":"scala","scala_max":5}]';
begin
  raise notice '';
  raise notice '  PROBA „ȘABLON PERSONALIZAT" (0168)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-pers-' || v_sufix, 'Proba Personalizare SRL',
     'RO' || (83000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select v_org, f.feature_key, true, now() from public.features f;
  insert into auth.users (id, email, email_confirmed_at)
  values (v_u_admin, 'pers-admin-' || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role)
  values (v_org, v_u_admin, 'org_admin');

  insert into public.evaluation_templates (id, organization_id, denumire, criterii) values
    (v_platf, null, 'Platformă probă ' || v_sufix, c_criterii),
    (v_propriu, v_org, 'Propriu ' || v_sufix, c_criterii);

  -- (1) varianta, ca org_admin
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.evaluation_templates
      (organization_id, denumire, criterii, derivat_din, created_by, updated_by)
    values (v_org, 'Platformă probă ' || v_sufix, c_criterii, v_platf, v_u_admin, v_u_admin)
    returning id into v_varianta;
    reset role;
    raise notice '  ✓ (1) org_admin creează varianta firmei';
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) varianta nu se poate crea: % (%)', sqlerrm, sqlstate;
  end;

  -- (2) a doua variantă vie
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.evaluation_templates
      (organization_id, denumire, criterii, derivat_din, created_by, updated_by)
    values (v_org, 'A doua ' || v_sufix, c_criterii, v_platf, v_u_admin, v_u_admin);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) a doua variantă vie a trecut';
  exception when unique_violation then
    reset role;
    raise notice '  ✓ (2) a doua variantă vie: 23505';
  end;

  -- (3) derivat dintr-un șablon al firmei
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.evaluation_templates
      (organization_id, denumire, criterii, derivat_din, created_by, updated_by)
    values (v_org, 'Din propriu ' || v_sufix, c_criterii, v_propriu, v_u_admin, v_u_admin);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) derivat_din spre un șablon al firmei a trecut';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (3) derivat_din spre un șablon al firmei: P0001';
  end;

  -- (4) după ștergere, din nou
  if v_varianta is not null then
    perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
    set local role authenticated;
    begin
      perform public.sterge_sablon_evaluare(v_org, v_varianta);
      insert into public.evaluation_templates
        (organization_id, denumire, criterii, derivat_din, created_by, updated_by)
      values (v_org, 'Platformă probă ' || v_sufix, c_criterii, v_platf, v_u_admin, v_u_admin);
      reset role;
      raise notice '  ✓ (4) după ștergerea variantei, se personalizează din nou';
    exception when others then
      reset role;
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (4) re-personalizarea a picat: % (%)', sqlerrm, sqlstate;
    end;
  end if;

  -- (5) platforma nu derivă
  begin
    update public.evaluation_templates set derivat_din = v_platf where id = v_platf;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) un șablon de platformă a primit derivat_din';
  exception when check_violation then
    raise notice '  ✓ (5) șablonul de platformă nu poate deriva: check';
  end;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA ȘABLON PERSONALIZAT: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE cele 5 verificări au trecut.';
  raise notice '';
end;
$$;
