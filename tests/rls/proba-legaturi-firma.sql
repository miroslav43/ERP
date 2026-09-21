-- tests/rls/proba-legaturi-firma.sql
--
-- LEGĂTURILE ȘI CONTRACTELE, DUPĂ 0151.
--
-- ── DE CE EXISTĂ FIȘIERUL ───────────────────────────────────────────────────
-- Legătura unei fișe cu departamentul, funcția și managerul ei nu poate ieși din
-- firmă. Regula a fost scrisă întâi ca CHEIE STRĂINĂ COMPUSĂ (0151) și a rupt
-- imediat aplicația în producție: PostgREST rezolvă embed-urile după numele
-- coloanei, iar cu cheia compusă `department:departments!department_id(...)`
-- nu mai găsește nicio relație (PGRST200). 0152 a pus cheile la loc și a mutat
-- regula într-un trigger — de-aia refuzurile de mai jos sunt P0001, nu 23503.
--
-- Jumătate din verificări sunt POZITIVE: încadrarea normală a unui angajat
-- trebuie să meargă exact ca înainte.
--
-- ── CE VERIFICĂ, PE RÂND ────────────────────────────────────────────────────
-- (1) încadrarea normală, în firma proprie                        [POZITIVĂ];
-- (2) departamentul altei firme e refuzat de bază;
-- (3) funcția altei firme e refuzată;
-- (4) managerul din altă firmă e refuzat;
-- (5) șeful de departament din altă firmă e refuzat;
-- (6) contractul activ își schimbă salariul                       [POZITIVĂ];
-- (7) contractul încetat nu mai poate fi reactivat;
-- (8) și nici rescris;
-- (9) data încetării înaintea începutului e refuzată.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org_a    uuid := gen_random_uuid();
  v_org_b    uuid := gen_random_uuid();
  v_dep_a    uuid := gen_random_uuid();
  v_dep_b    uuid := gen_random_uuid();
  v_poz_a    uuid := gen_random_uuid();
  v_poz_b    uuid := gen_random_uuid();
  v_e_a      uuid := gen_random_uuid();
  v_e_b      uuid := gen_random_uuid();
  v_contract uuid;
  v_u_admin  uuid := gen_random_uuid();
  v_esecuri  int := 0;
begin
  raise notice '';
  raise notice '  PROBA „LEGĂTURI ÎN ACEEAȘI FIRMĂ" (0151)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org_a, 'proba-leg-a-' || v_sufix, 'Proba Legături A SRL',
     'RO' || (89000000 + (random() * 900000)::int)::text),
    (v_org_b, 'proba-leg-b-' || v_sufix, 'Proba Legături B SRL',
     'RO' || (89000000 + (random() * 900000)::int)::text);

  insert into public.departments (id, organization_id, denumire) values
    (v_dep_a, v_org_a, 'Producție'),
    (v_dep_b, v_org_b, 'Producție');
  insert into public.job_positions (id, organization_id, cod, denumire) values
    (v_poz_a, v_org_a, 'OP-A-' || v_sufix, 'Operator'),
    (v_poz_b, v_org_b, 'OP-B-' || v_sufix, 'Operator');
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status) values
    (v_e_b, v_org_b, 'LEG-B', 'Bogdan', 'Beta', app.azi_local() - 300, 'activ');

  -- ═══ (1) Încadrarea normală [POZITIVĂ] ════════════════════════════════════
  begin
    insert into public.employees (id, organization_id, marca, first_name, last_name,
                                  hired_on, status, department_id, job_position_id)
    values (v_e_a, v_org_a, 'LEG-A', 'Ana', 'Alfa', app.azi_local() - 200, 'activ',
            v_dep_a, v_poz_a);
    raise notice '  ✓ (1) încadrarea în firma proprie funcționează';
  exception when others then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) încadrarea normală a fost refuzată: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (2) Departamentul altei firme ════════════════════════════════════════
  begin
    update public.employees set department_id = v_dep_b where id = v_e_a;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) s-a putut lega departamentul altei firme';
  exception when foreign_key_violation or raise_exception then
    raise notice '  ✓ (2) departamentul altei firme e refuzat de bază';
  end;

  -- ═══ (3) Funcția altei firme ══════════════════════════════════════════════
  begin
    update public.employees set job_position_id = v_poz_b where id = v_e_a;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) s-a putut lega funcția altei firme';
  exception when foreign_key_violation or raise_exception then
    raise notice '  ✓ (3) funcția altei firme e refuzată';
  end;

  -- ═══ (4) Managerul din altă firmă ═════════════════════════════════════════
  begin
    update public.employees set manager_employee_id = v_e_b where id = v_e_a;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) s-a putut lega un manager din altă firmă';
  exception
    -- Triggerul de lanț („Managerul indicat aparține altei organizații") îl
    -- prinde de obicei înaintea cheii străine. Ambele sunt refuz.
    when foreign_key_violation or raise_exception then
      raise notice '  ✓ (4) managerul din altă firmă e refuzat';
  end;

  -- ═══ (5) Șeful de departament din altă firmă ══════════════════════════════
  begin
    update public.departments set manager_employee_id = v_e_b where id = v_dep_a;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) s-a putut numi șef un angajat din altă firmă';
  exception when foreign_key_violation or raise_exception then
    raise notice '  ✓ (5) șeful din altă firmă e refuzat';
  end;

  -- ── contractele ───────────────────────────────────────────────────────────
  -- De aici încolo se scrie ca UTILIZATOR, nu ca `postgres`: garda din 0151 iese
  -- pe prima linie în context de serviciu (`app.is_service_context()`), fiindcă
  -- migrările de date și triggerele au voie să facă ce nu are voie clientul.
  insert into auth.users (id, email, email_confirmed_at)
  values (v_u_admin, 'leg-adm-' || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_a, v_u_admin, 'org_admin');
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select v_org_a, f.feature_key, true, now() from public.features f;
  insert into public.employment_contracts
    (organization_id, employee_id, numar, data_contract, valabil_de_la, salariu_baza, status)
  values (v_org_a, v_e_a, 'C-' || v_sufix, app.azi_local() - 200, app.azi_local() - 200, 5000, 'activ')
  returning id into v_contract;

  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;

  -- ═══ (6) Salariul pe contractul activ [POZITIVĂ] ══════════════════════════
  begin
    update public.employment_contracts set salariu_baza = 6000 where id = v_contract;
    raise notice '  ✓ (6) salariul se modifică pe contractul activ';
  exception when others then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) modificarea salariului a fost refuzată: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (9) Data încetării înaintea începutului ══════════════════════════════
  begin
    update public.employment_contracts
       set incetat_la = app.azi_local() - 300 where id = v_contract;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) data încetării dinaintea începutului a fost acceptată';
  exception when raise_exception then
    raise notice '  ✓ (9) data încetării dinaintea începutului e refuzată';
  end;

  update public.employment_contracts
     set status = 'incetat', incetat_la = app.azi_local() - 10 where id = v_contract;

  -- ═══ (7) Reactivarea ══════════════════════════════════════════════════════
  begin
    update public.employment_contracts set status = 'activ' where id = v_contract;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) contractul încetat a fost reactivat';
  exception when raise_exception then
    raise notice '  ✓ (7) contractul încetat nu mai poate fi reactivat';
  end;

  -- ═══ (8) Rescrierea ═══════════════════════════════════════════════════════
  begin
    update public.employment_contracts set salariu_baza = 99999 where id = v_contract;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) salariul de pe contractul încetat a fost schimbat';
  exception when raise_exception then
    raise notice '  ✓ (8) contractul încetat nu se mai rescrie';
  end;

  reset role;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA LEGĂTURILOR: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE cele 9 verificări au trecut.';
  raise notice '';
end;
$$;
