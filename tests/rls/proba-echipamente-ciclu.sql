-- tests/rls/proba-echipamente-ciclu.sql
--
-- CICLUL DE VIAȚĂ AL ECHIPAMENTULUI (0182): CASARE, ȘTERGERE, COMPONENTE,
-- GARANȚIE, CONSERVARE, RESETAREA CONTORULUI, RESPONSABILUL.
--
-- Ce verifică, pe rând:
--  (1) casarea fără motiv → P0001; cu motiv, dar cu sesizare deschisă → P0001
--  (2) după respingerea sesizării, casarea trece; planurile devin inactive și
--      ies din `expirables`; `casat_la` se completează singur            [POZITIVĂ]
--  (3) echipamentul casat nu mai e în scadențe nici cu autorizația ISCIR
--  (4) componenta: părintele din altă firmă → P0001; ciclul → P0001;
--      legarea corectă trece                                              [POZITIVĂ]
--  (5) ștergerea logică cu sesizare deschisă → P0001; fără, șterge logic
--      planurile și contoarele și dezleagă componenta                     [POZITIVĂ]
--  (6) garanția: rând în `expirables` (kind `garantie`); golită, rândul dispare
--  (7) conservarea scoate planul din scadențe; repunerea îl readuce
--  (8) resetarea contorului păstrează restul până la țintă
--  (9) responsabilul-angajat vede utilajul lui și îi înregistrează citirea;
--      pe utilajul altuia: zero rânduri și 42501
-- (10) angajatul fără rol pe mentenanță NU poate scrie citiri (politica cere
--      `update`, din 0150, sau responsabilul, din 0182)
-- (11) responsabilul NU poate înregistra o RESETARE de contor (ar muta țintele
--      planurilor, pe care politica lor nu-l lasă să le atingă)
-- (12) schimbarea stării utilajului NU mută o scadență restantă a unui plan
--      niciodată executat (`ssm_plan_calc` recalculează doar la intrări noi)
-- (13) anularea citirii de resetare desface mutarea planurilor             [POZITIVĂ]
-- (14) un echipament șters nu se restaurează din aplicație (P0001)
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org      uuid := gen_random_uuid();
  v_org2     uuid := gen_random_uuid();
  v_u_adm    uuid := gen_random_uuid();
  v_u_resp   uuid := gen_random_uuid();  -- employee: responsabilul presei
  v_u_col    uuid := gen_random_uuid();  -- employee: un coleg oarecare
  v_e_adm    uuid := gen_random_uuid();
  v_e_resp   uuid := gen_random_uuid();
  v_e_col    uuid := gen_random_uuid();
  v_presa    uuid := gen_random_uuid();
  v_motor    uuid := gen_random_uuid();  -- componentă a presei
  v_pompa    uuid := gen_random_uuid();  -- componentă a motorului
  v_strain   uuid := gen_random_uuid();  -- echipament al altei firme
  v_plan     uuid := gen_random_uuid();
  v_plan_c   uuid := gen_random_uuid();  -- plan pe contor
  v_s        uuid;
  v_n        integer;
  v_num      numeric;
  v_bool     boolean;
  v_data     date;
  v_esecuri  int := 0;
begin
  raise notice '';
  raise notice '  PROBA „CICLUL ECHIPAMENTULUI" (0182)';
  raise notice '  ─────────────────────────────────────────────────────────';

  -- ── fixture ───────────────────────────────────────────────────────────────
  insert into public.organizations (id, slug, name, cui) values
    (v_org,  'proba-ech-' || v_sufix, 'Proba Echipamente SRL', 'RO' || (88000000 + (random() * 900000)::int)::text),
    (v_org2, 'proba-ech2-' || v_sufix, 'Alta Firma SRL', 'RO' || (89000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select o, f.feature_key, true, now() from public.features f, unnest(array[v_org, v_org2]) o;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_adm,  'ech-adm-'  || v_sufix || '@proba.test', now()),
    (v_u_resp, 'ech-resp-' || v_sufix || '@proba.test', now()),
    (v_u_col,  'ech-col-'  || v_sufix || '@proba.test', now());
  insert into public.employees (id, organization_id, marca, first_name, last_name, hired_on, status, user_id) values
    (v_e_adm,  v_org, 'EC-A', 'Adrian', 'Admin',       app.azi_local() - 900, 'activ', v_u_adm),
    (v_e_resp, v_org, 'EC-R', 'Rareș',  'Responsabil', app.azi_local() - 700, 'activ', v_u_resp),
    (v_e_col,  v_org, 'EC-C', 'Carmen', 'Coleg',       app.azi_local() - 500, 'activ', v_u_col);
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_adm,  'org_admin'),
    (v_org, v_u_resp, 'employee'),
    (v_org, v_u_col,  'employee');

  insert into public.equipment (id, organization_id, cod, denumire, responsabil_employee_id) values
    (v_presa, v_org,  'PRS-' || v_sufix, 'Presă hidraulică', v_e_resp),
    (v_motor, v_org,  'MOT-' || v_sufix, 'Motor presă', null),
    (v_pompa, v_org,  'PMP-' || v_sufix, 'Pompă motor', null),
    (v_strain, v_org2, 'STR-' || v_sufix, 'Strung străin', null);
  insert into public.equipment_meters (organization_id, equipment_id, tip, citire, data_citirii)
  values (v_org, v_presa, 'ore', 1000, app.azi_local() - 10);
  insert into public.maintenance_plans (id, organization_id, equipment_id, denumire, periodicitate_zile, responsabil_employee_id)
  values (v_plan, v_org, v_presa, 'Gresare lunară', 30, v_e_adm);
  insert into public.maintenance_plans (id, organization_id, equipment_id, denumire, periodicitate_contor, tip_contor, responsabil_employee_id)
  values (v_plan_c, v_org, v_presa, 'Schimb ulei la 500 h', 500, 'ore', v_e_adm);
  insert into public.iscir_authorizations (organization_id, equipment_id, numar, tip, valabil_pana)
  values (v_org, v_presa, 'ISCIR-' || v_sufix, 'PT R1', app.azi_local() + 200);
  insert into public.fault_reports (organization_id, equipment_id, raportat_de_employee_id, descriere)
  values (v_org, v_presa, v_e_col, 'Presa face zgomot la pornire.') returning id into v_s;

  -- ═══ (1) Casarea fără motiv / cu sesizare deschisă ═══════════════════════
  begin
    update public.equipment set status = 'casat' where id = v_presa;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) casarea fără motiv a trecut';
  exception when raise_exception then
    raise notice '  ✓ (1) casarea fără motiv e refuzată (P0001)';
  end;
  begin
    update public.equipment set status = 'casat', motiv_casare = 'Uzură avansată, reparație neeconomică.' where id = v_presa;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) casarea cu sesizare deschisă a trecut';
  exception when raise_exception then
    raise notice '  ✓ (1) casarea cu sesizare deschisă e refuzată (P0001): %', left(sqlerrm, 60);
  end;

  -- ═══ (2) Casarea trece după respingere; planurile ies din scadențe ══════
  update public.fault_reports set status = 'respins', motiv_respingere = 'Zgomot normal la pornire la rece.' where id = v_s;
  select count(*) into v_n from public.expirables where entity_type = 'maintenance_plan' and entity_id = v_plan and is_active and deleted_at is null;
  if v_n <> 1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) planul nu era în scadențe înainte de casare (% rânduri)', v_n;
  end if;
  update public.equipment set status = 'casat', motiv_casare = 'Uzură avansată, reparație neeconomică.' where id = v_presa;
  select casat_la into v_data from public.equipment where id = v_presa;
  select count(*) into v_n from public.maintenance_plans where equipment_id = v_presa and activ;
  select exists (select 1 from public.expirables where entity_type = 'maintenance_plan' and entity_id = v_plan and is_active and deleted_at is null) into v_bool;
  if v_data = app.azi_local() and v_n = 0 and not v_bool then
    raise notice '  ✓ (2) casarea trece; `casat_la` = azi; planurile inactive și ieșite din scadențe';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) casat_la=%, planuri active=%, plan în scadențe=%', v_data, v_n, v_bool;
  end if;

  -- ═══ (3) Autorizația ISCIR a utilajului casat iese din scadențe ═══════════
  select exists (select 1 from public.expirables where entity_type = 'iscir_authorization' and organization_id = v_org and is_active and deleted_at is null) into v_bool;
  if not v_bool then
    raise notice '  ✓ (3) autorizația ISCIR a utilajului casat nu mai alertează';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) autorizația ISCIR a utilajului casat e încă activă în scadențe';
  end if;
  -- Repunerea în evidență curăță casarea (planurile rămân inactive, explicit).
  update public.equipment set status = 'in_functiune' where id = v_presa;
  select casat_la is null and motiv_casare is null into v_bool from public.equipment where id = v_presa;
  if not v_bool then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) repunerea nu a curățat casat_la/motiv_casare';
  end if;
  update public.maintenance_plans set activ = true where id in (v_plan, v_plan_c);

  -- ═══ (4) Componente: altă firmă, ciclu, legare corectă ═══════════════════
  begin
    update public.equipment set parent_equipment_id = v_strain where id = v_motor;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) părintele din altă firmă a trecut';
  exception when raise_exception then
    raise notice '  ✓ (4) părintele din altă firmă e refuzat (P0001)';
  end;
  update public.equipment set parent_equipment_id = v_presa where id = v_motor;
  update public.equipment set parent_equipment_id = v_motor where id = v_pompa;
  begin
    update public.equipment set parent_equipment_id = v_pompa where id = v_presa;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) ciclul presă → motor → pompă → presă a trecut';
  exception when raise_exception then
    raise notice '  ✓ (4) ciclul de componente e refuzat (P0001); legarea corectă a trecut';
  end;

  -- ═══ (5) Ștergerea logică ════════════════════════════════════════════════
  insert into public.fault_reports (organization_id, equipment_id, raportat_de_employee_id, descriere)
  values (v_org, v_presa, v_e_col, 'Scurgere la pompă.') returning id into v_s;
  begin
    update public.equipment set deleted_at = now() where id = v_presa;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) ștergerea cu sesizare deschisă a trecut';
  exception when raise_exception then
    raise notice '  ✓ (5) ștergerea cu sesizare deschisă e refuzată (P0001)';
  end;
  update public.fault_reports set status = 'retrasa' where id = v_s;
  update public.equipment set deleted_at = now() where id = v_motor;
  select count(*) into v_n from public.equipment where id = v_pompa and parent_equipment_id is null;
  if v_n = 1 then
    raise notice '  ✓ (5) ștergerea logică a părintelui dezleagă componenta';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) componenta a rămas legată de părintele șters';
  end if;

  -- ═══ (6) Garanția în scadențe ════════════════════════════════════════════
  update public.equipment set garantie_expira = app.azi_local() + 90 where id = v_presa;
  select count(*) into v_n from public.expirables where entity_type = 'equipment' and entity_id = v_presa and kind = 'garantie' and is_active and deleted_at is null;
  update public.equipment set garantie_expira = null where id = v_presa;
  select count(*) into v_num from public.expirables where entity_type = 'equipment' and entity_id = v_presa and kind = 'garantie' and deleted_at is null;
  if v_n = 1 and v_num = 0 then
    raise notice '  ✓ (6) garanția intră în scadențe și iese când e golită';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) garanție: cu dată % rânduri, fără dată % rânduri', v_n, v_num;
  end if;

  -- ═══ (7) Conservarea scoate planul din scadențe; repunerea îl readuce ════
  update public.equipment set status = 'in_conservare' where id = v_presa;
  select exists (select 1 from public.expirables where entity_type = 'maintenance_plan' and entity_id = v_plan and is_active and deleted_at is null) into v_bool;
  if v_bool then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) planul utilajului în conservare e încă în scadențe';
  end if;
  update public.equipment set status = 'in_functiune' where id = v_presa;
  select exists (select 1 from public.expirables where entity_type = 'maintenance_plan' and entity_id = v_plan and is_active and deleted_at is null) into v_bool;
  if v_bool then
    raise notice '  ✓ (7) conservarea scoate planul din scadențe; repunerea îl readuce';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) planul nu a revenit în scadențe după repunere';
  end if;

  -- ═══ (8) Resetarea contorului păstrează restul până la țintă ═════════════
  -- Planul pe contor: ultima citire 1000, țintă 1500. Contor nou, repornit de la 20:
  -- ținta devine 20 + 500 = 520, adică același rest de 500 h.
  select urmatoarea_scadenta_contor into v_num from public.maintenance_plans where id = v_plan_c;
  if v_num <> 1500 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) ținta inițială e %, așteptat 1500', v_num;
  end if;
  -- `created_at = clock_timestamp()`: în proba asta totul e o singură tranzacție,
  -- iar `now()` ar da același moment tuturor citirilor din aceeași zi — ordinea
  -- (data, created_at) pe care se bazează garda ar deveni egalitate.
  insert into public.equipment_meters (organization_id, equipment_id, tip, citire, data_citirii, resetare_contor, created_at)
  values (v_org, v_presa, 'ore', 20, app.azi_local(), true, clock_timestamp());
  select urmatoarea_scadenta_contor into v_num from public.maintenance_plans where id = v_plan_c;
  if v_num = 520 then
    raise notice '  ✓ (8) resetarea contorului mută ținta la 520 (restul de 500 h păstrat)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) ținta după resetare e %, așteptat 520', v_num;
  end if;

  -- ═══ (9) Responsabilul-angajat ═══════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_resp::text, true);
  set local role authenticated;
  select count(*) into v_n from public.equipment where id = v_presa;
  select count(*) into v_num from public.equipment where organization_id = v_org;
  begin
    insert into public.equipment_meters (organization_id, equipment_id, tip, citire, data_citirii, citit_de_employee_id, created_at)
    values (v_org, v_presa, 'ore', 25, app.azi_local(), v_e_resp, clock_timestamp());
    reset role;
    if v_n = 1 and v_num = 1 then
      raise notice '  ✓ (9) responsabilul vede DOAR utilajul lui și îi înregistrează citirea';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (9) responsabilul vede % utilaje din %, așteptat 1 din 1', v_n, v_num;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) responsabilul nu poate înregistra citirea: % (%)', sqlerrm, sqlstate;
  end;
  set local role authenticated;
  begin
    insert into public.equipment_meters (organization_id, equipment_id, tip, citire, data_citirii)
    values (v_org, v_pompa, 'ore', 5, app.azi_local());
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) responsabilul a scris o citire pe utilajul altuia';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (9) pe utilajul altuia: 42501';
  end;

  -- ═══ (10) Angajatul oarecare nu scrie citiri prin `create = all` ═════════
  perform set_config('request.jwt.claim.sub', v_u_col::text, true);
  set local role authenticated;
  begin
    insert into public.equipment_meters (organization_id, equipment_id, tip, citire, data_citirii, created_at)
    values (v_org, v_presa, 'ore', 30, app.azi_local(), clock_timestamp());
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10) un angajat oarecare a scris o citire pe presă';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (10) angajatul fără rol pe mentenanță e refuzat la citiri (42501)';
  end;

  -- ═══ (11) Responsabilul nu resetează contorul ════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_resp::text, true);
  set local role authenticated;
  begin
    insert into public.equipment_meters (organization_id, equipment_id, tip, citire, data_citirii, resetare_contor)
    values (v_org, v_presa, 'ore', 900000, app.azi_local(), true);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (11) responsabilul a înregistrat o resetare de contor';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (11) responsabilul nu poate înregistra o resetare (42501)';
  end;
  -- (11b) …și nici o citire semnată cu fișa unui coleg (0183: semnătura e în
  -- politică, nu doar în `inregistreazaContor`).
  set local role authenticated;
  begin
    insert into public.equipment_meters (organization_id, equipment_id, tip, citire, data_citirii, citit_de_employee_id, created_at)
    values (v_org, v_presa, 'ore', 26, app.azi_local(), v_e_col, clock_timestamp());
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (11b) responsabilul a semnat o citire cu fișa unui coleg';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (11b) responsabilul nu poate semna citirea cu fișa altcuiva (42501)';
  end;

  -- ═══ (12) Starea utilajului nu mută o scadență restantă ═════════════════
  -- Sub superuser: planul pe zile e trecut, prin registru, în restanță (nicio
  -- intrare a calculului nu se schimbă, deci garda îl lasă). Apoi utilajul
  -- intră în reparație: scadența TREBUIE să rămână în trecut.
  update public.maintenance_plans set urmatoarea_scadenta = app.azi_local() - 10 where id = v_plan;
  select urmatoarea_scadenta into v_data from public.maintenance_plans where id = v_plan;
  if v_data <> app.azi_local() - 10 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (12) scadența restantă nu s-a putut fixa (%)', v_data;
  end if;
  update public.equipment set status = 'in_reparatie' where id = v_presa;
  select urmatoarea_scadenta into v_data from public.maintenance_plans where id = v_plan;
  if v_data = app.azi_local() - 10 then
    raise notice '  ✓ (12) schimbarea stării nu mută scadența restantă (rămâne %)', v_data;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (12) schimbarea stării a mutat scadența la %', v_data;
  end if;
  update public.equipment set status = 'in_functiune' where id = v_presa;

  -- ═══ (13) Anularea resetării desface mutarea planurilor ═════════════════
  -- După (8): ultima citire 20 (resetare), țintă 520. Anulată logic, planul
  -- revine la referința dinainte (1000) și ținta la 1500.
  update public.equipment_meters set deleted_at = now()
   where equipment_id = v_presa and tip = 'ore' and resetare_contor and deleted_at is null;
  select urmatoarea_scadenta_contor into v_num from public.maintenance_plans where id = v_plan_c;
  if v_num = 1500 then
    raise notice '  ✓ (13) anularea resetării readuce ținta la 1500';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (13) după anularea resetării ținta e %, așteptat 1500', v_num;
  end if;

  -- ═══ (14) Restaurarea unui echipament șters e refuzată ═══════════════════
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  begin
    update public.equipment set deleted_at = null where id = v_motor;
    get diagnostics v_n = row_count;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (14) echipamentul șters a fost restaurat (% rânduri)', v_n;
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (14) restaurarea unui echipament șters e refuzată (P0001)';
  end;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'Proba ciclului echipamentului: % verificări picate.', v_esecuri;
  end if;
  raise notice '  Toate verificările au trecut.';
end $$;
