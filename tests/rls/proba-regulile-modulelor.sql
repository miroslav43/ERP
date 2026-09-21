-- tests/rls/proba-regulile-modulelor.sql
--
-- REGULILE DE MODUL, DUPĂ 0150.
--
-- ── DE CE EXISTĂ FIȘIERUL ───────────────────────────────────────────────────
-- Patru reguli care se citeau în Server Action și nu se verificau nicăieri
-- altundeva: poarta de modul (licențierea), poarta catalogului de mentenanță,
-- cine decide asupra unei cereri de concediu și ce mai poate schimba
-- solicitantul după ce a trimis-o.
--
-- Verificările POZITIVE sunt jumătate din fișier, fiindcă fiecare dintre cele
-- patru porți poate fi ușor prea strâmtă: o firmă care nu-și mai poate depune
-- sesizările, un manager care nu-și mai poate aproba echipa sau un modul plătit
-- care nu se mai poate folosi arată, din afară, exact ca o pană.
--
-- ── CE VERIFICĂ, PE RÂND ────────────────────────────────────────────────────
-- (1) firma fără modulul KPI nu mai poate scrie în el;
-- (2) firma cu modulul poate                                      [POZITIVĂ];
-- (3) angajatul nu mai poate insera o intervenție de mentenanță;
-- (4) dar poate depune o sesizare                                 [POZITIVĂ];
-- (5) nu poate depune o sesizare în numele altcuiva;
-- (6) `hr` nu mai poate aproba o cerere de concediu;
-- (7) managerul echipei poate                                     [POZITIVĂ];
-- (8) solicitantul nu mai poate schimba perioada după trimitere;
-- (9) dar o poate anula                                           [POZITIVĂ];
-- (10) documentul din dosarul altui angajat e refuzat;
-- (11) documentul din dosarul propriu trece                       [POZITIVĂ].
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix   text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org     uuid := gen_random_uuid();
  v_org_f   uuid := gen_random_uuid();
  v_u_hr    uuid := gen_random_uuid();
  v_u_mgr   uuid := gen_random_uuid();
  v_u_ang   uuid := gen_random_uuid();
  v_u_admf  uuid := gen_random_uuid();
  v_e_mgr   uuid := gen_random_uuid();
  v_e_ang   uuid := gen_random_uuid();
  v_e_alt   uuid := gen_random_uuid();
  v_echip   uuid := gen_random_uuid();
  v_tip     uuid;
  v_cerere  uuid;
  v_stare   text;
  v_data    date;
  v_esecuri int := 0;
begin
  raise notice '';
  raise notice '  PROBA „REGULILE MODULELOR" (0150)';
  raise notice '  ─────────────────────────────────────────────────────────';

  -- ── fixture ───────────────────────────────────────────────────────────────
  insert into public.organizations (id, slug, name, cui) values
    (v_org,   'proba-mod-'  || v_sufix, 'Proba Module SRL',
     'RO' || (89000000 + (random() * 900000)::int)::text),
    (v_org_f, 'proba-modf-' || v_sufix, 'Proba Fără Module SRL',
     'RO' || (89000000 + (random() * 900000)::int)::text);
  -- Firma ÎNTÂI: toate modulele. Firma a doua: doar nucleul — ea e cea care
  -- probează poarta de licențiere.
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select v_org, f.feature_key, true, now() from public.features f;
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  values (v_org_f, 'nucleu', true, now());

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_hr,   'mod-hr-'  || v_sufix || '@proba.test', now()),
    (v_u_mgr,  'mod-mgr-' || v_sufix || '@proba.test', now()),
    (v_u_ang,  'mod-ang-' || v_sufix || '@proba.test', now()),
    (v_u_admf, 'mod-adf-' || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org,   v_u_hr,   'hr'),
    (v_org,   v_u_mgr,  'manager'),
    (v_org,   v_u_ang,  'employee'),
    (v_org_f, v_u_admf, 'org_admin');

  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_mgr, v_org, 'MOD-M', 'Mihai', 'Manager', app.azi_local() - 500, 'activ', v_u_mgr, null),
    (v_e_ang, v_org, 'MOD-A', 'Ana',   'Angajat', app.azi_local() - 400, 'activ', v_u_ang, v_e_mgr),
    (v_e_alt, v_org, 'MOD-X', 'Radu',  'Altul',   app.azi_local() - 300, 'activ', null,    null);

  insert into public.equipment (id, organization_id, cod, denumire)
  values (v_echip, v_org, 'ECH-' || v_sufix, 'Compresor');

  -- ═══ (1) Firma fără modul ═════════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_admf::text, true);
  set local role authenticated;
  begin
    insert into public.kpi_seturi (organization_id, functie, denumire)
    values (v_org_f, 'Operator', 'Set fără modul');
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) firma fără modulul KPI a putut scrie în el';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (1) modulul neactivat nu se mai poate folosi';
  end;

  -- ═══ (2) Firma cu modul [POZITIVĂ] ════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    insert into public.kpi_seturi (organization_id, functie, denumire)
    values (v_org, 'Operator', 'Set cu modul');
    reset role;
    raise notice '  ✓ (2) firma cu modulul activat scrie în continuare';
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) modulul activat a fost refuzat: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (3) Intervenția de mentenanță ════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    insert into public.maintenance_interventions
      (organization_id, equipment_id, data, descriere, rezultat)
    values (v_org, v_echip, app.azi_local(), 'Revizie completă', 'reusita');
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) angajatul a inserat o intervenție de mentenanță';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (3) catalogul de mentenanță cere acum `maintenance:update`';
  end;

  -- ═══ (4) Sesizarea [POZITIVĂ] ═════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    insert into public.fault_reports
      (organization_id, equipment_id, descriere, raportat_de_employee_id)
    values (v_org, v_echip, 'Face zgomot', v_e_ang);
    reset role;
    raise notice '  ✓ (4) sesizarea proprie se depune în continuare';
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) sesizarea legitimă a fost refuzată: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (5) Sesizarea în numele altcuiva ═════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    insert into public.fault_reports
      (organization_id, equipment_id, descriere, raportat_de_employee_id)
    values (v_org, v_echip, 'Sesizare semnată de altcineva', v_e_alt);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) s-a depus o sesizare în numele altui angajat';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (5) sesizarea în numele altcuiva e refuzată';
  end;

  -- ── cererea de concediu ───────────────────────────────────────────────────
  -- Tipurile de concediu se seamănă PER FIRMĂ la crearea organizației, nu
  -- global: le căutăm în firma probei.
  select id into v_tip from public.leave_types
   where organization_id = v_org and key = 'odihna' and activ limit 1;

  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  --  e cerut explicit de politica de INSERT (pinuiește autorul).
  insert into public.leave_requests
    (organization_id, employee_id, leave_type_id, data_inceput, data_sfarsit, status, created_by)
  values (v_org, v_e_ang, v_tip, app.azi_local() + 10, app.azi_local() + 12, 'trimisa', v_u_ang)
  returning id into v_cerere;
  reset role;

  -- ═══ (6) `hr` nu decide ═══════════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  begin
    update public.leave_requests set status = 'aprobata' where id = v_cerere;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) `hr` a aprobat o cerere de concediu';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (6) `hr` nu mai poate aproba cereri de concediu';
  end;

  -- ═══ (8) Perioada, după trimitere ═════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    update public.leave_requests set data_sfarsit = app.azi_local() + 20 where id = v_cerere;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) solicitantul a schimbat perioada după trimitere';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (8) perioada nu se mai schimbă după trimitere';
  end;

  -- ═══ (10) Documentul altui angajat ════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    update public.leave_requests
       set atasament_path = v_org::text || '/leave/' || v_e_alt::text || '/certificat.pdf'
     where id = v_cerere;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10) s-a atașat documentul din dosarul altui angajat';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (10) documentul din dosarul altcuiva e refuzat';
  end;

  -- ═══ (11) Documentul propriu [POZITIVĂ] ═══════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    update public.leave_requests
       set atasament_path = v_org::text || '/leave/' || v_e_ang::text || '/certificat.pdf'
     where id = v_cerere;
    reset role;
    raise notice '  ✓ (11) documentul din dosarul propriu se atașează';
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (11) documentul propriu a fost refuzat: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (7) Managerul echipei decide [POZITIVĂ] ══════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    update public.leave_requests set status = 'aprobata' where id = v_cerere;
    reset role;
    select status into v_stare from public.leave_requests where id = v_cerere;
    if v_stare = 'aprobata' then
      raise notice '  ✓ (7) managerul echipei aprobă în continuare';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (7) aprobarea managerului n-a avut efect (status=%)', v_stare;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) managerul nu mai poate aproba: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (9) Anularea [POZITIVĂ] ══════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    update public.leave_requests set status = 'anulata' where id = v_cerere;
    reset role;
    select status into v_stare from public.leave_requests where id = v_cerere;
    if v_stare = 'anulata' then
      raise notice '  ✓ (9) solicitantul își poate anula cererea';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (9) anularea n-a avut efect (status=%)', v_stare;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) anularea a fost refuzată: % (%)', sqlerrm, sqlstate;
  end;

  -- ── verdict ───────────────────────────────────────────────────────────────
  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA REGULILOR DE MODUL: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE cele 11 verificări au trecut.';
  raise notice '';
end;
$$;
