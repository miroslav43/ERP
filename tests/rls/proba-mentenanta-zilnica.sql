-- tests/rls/proba-mentenanta-zilnica.sql
--
-- JOBUL ZILNIC AL MENTENANȚEI ȘI REZUMATUL DE DIMINEAȚĂ (0191).
--
-- ── DE CE EXISTĂ FIȘIERUL ───────────────────────────────────────────────────
-- Jobul rulează noaptea, fără nimeni autentificat, și scrie notificări pentru
-- oameni diferiți din aceleași rânduri. Două lucruri nu se văd din aplicație:
-- că a doua rulare nu dublează nimic și că fiecare primește DOAR ce îi
-- aparține. Ambele se află rulând.
--
-- ── CE VERIFICĂ, PE RÂND ────────────────────────────────────────────────────
--  (1) administratorul (fără responsabili în setări) primește UN rezumat cu
--      tot: scadențe, contor la țintă, contor necitit, sesizare critică
--      neatribuită de peste 24 h, oprire de peste 3 zile          [POZITIVĂ]
--  (2) responsabilul utilajului (employee) primește doar ale lui, cu link spre
--      portal; NU și sesizarea critică (cazul 11: e a gestionarilor) [POZITIVĂ]
--  (3) RSVTI-ul din setări (manager) primește doar autorizația ISCIR, cu link
--      spre /mentenanta (citește parcul)                          [POZITIVĂ]
--  (4) un coleg fără nicio legătură nu primește nimic
--  (5) a doua rulare: zero rezumate noi, aceleași rânduri în compliance_alerts,
--      alert_notifications și maintenance_rezumat_trimis (idempotență)
--  (6) firma cu modulul OPRIT și firma SUSPENDATĂ sunt sărite: nicio alertă,
--      niciun rezumat (cazul 47)
--  (7) „rezolvat” neconfirmat de 10 zile → „închis”, cu istoric „Închisă
--      automat” (cazul 8)
--  (8) vizibilitatea per destinatar, sub `authenticated`: fiecare își vede
--      rezumatul și rândurile lui din registru, nu pe ale altora   [POZITIVĂ]
--  (9) pragurile din setări: administratorul le scrie (prima salvare = INSERT)
--      și ajung în `alert_rules` pe cele trei tipuri ale modulului; managerul
--      e refuzat (zero rânduri); un prag 0 e refuzat (23514)      [POZITIVĂ]
-- (10) jobul nu a eșuat pe nicio firmă din bază
-- (11) responsabilii din setări SCOȘI din firmă (membru `inactive` sau șters
--      logic), cu fișa încă legată de cont, NU primesc rezumatul; cum toți au
--      plecat, rezumatul ajunge la `org_admin`, nu la nimeni        [POZITIVĂ]
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org      uuid := gen_random_uuid();
  v_org_off  uuid := gen_random_uuid();  -- modulul oprit
  v_org_sus  uuid := gen_random_uuid();  -- firma suspendată
  v_u_adm    uuid := gen_random_uuid();
  v_u_mgr    uuid := gen_random_uuid();  -- RSVTI
  v_u_resp   uuid := gen_random_uuid();  -- employee: responsabilul utilajului E1
  v_u_col    uuid := gen_random_uuid();  -- employee: fără legătură
  v_e_adm    uuid := gen_random_uuid();
  v_e_mgr    uuid := gen_random_uuid();
  v_e_resp   uuid := gen_random_uuid();
  v_e_col    uuid := gen_random_uuid();
  v_e1       uuid := gen_random_uuid();
  v_e2       uuid := gen_random_uuid();
  v_e_off    uuid := gen_random_uuid();
  v_e_sus    uuid := gen_random_uuid();
  v_p_data   uuid := gen_random_uuid();
  v_p_aprope uuid := gen_random_uuid();
  v_p_vechi  uuid := gen_random_uuid();
  v_fr_crit  uuid;
  v_fr_rez   uuid;
  v_int      uuid;
  v_azi      date := app.azi_local();
  v_rap      jsonb;
  v_titlu    text;
  v_corp     text;
  v_link     text;
  v_n        integer;
  v_n2       integer;
  v_ca       integer;
  v_an       integer;
  v_rt       integer;
  v_status   text;
  v_motiv    text;
  v_esecuri  int := 0;
begin
  raise notice '';
  raise notice '  PROBA „MENTENANȚA ZILNICĂ" (0191)';
  raise notice '  ─────────────────────────────────────────────────────────';

  -- ── fixture ───────────────────────────────────────────────────────────────
  insert into public.organizations (id, slug, name, cui, status) values
    (v_org,     'proba-mz-'  || v_sufix, 'Proba Zilnic SRL',  'RO' || (88000000 + (random() * 900000)::int)::text, 'active'),
    (v_org_off, 'proba-mzo-' || v_sufix, 'Proba Oprit SRL',   'RO' || (88100000 + (random() * 90000)::int)::text,  'active'),
    (v_org_sus, 'proba-mzs-' || v_sufix, 'Proba Suspendat SRL','RO' || (88200000 + (random() * 90000)::int)::text, 'active');
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select o.id, f.feature_key,
         not (o.id = v_org_off and f.feature_key = 'maintenance'), now()
    from public.features f
    cross join (values (v_org), (v_org_off), (v_org_sus)) o(id);

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_adm,  'mz-adm-'  || v_sufix || '@proba.test', now()),
    (v_u_mgr,  'mz-mgr-'  || v_sufix || '@proba.test', now()),
    (v_u_resp, 'mz-resp-' || v_sufix || '@proba.test', now()),
    (v_u_col,  'mz-col-'  || v_sufix || '@proba.test', now());
  -- Fișele ÎNAINTEA membrilor (0083 creează una pentru orice org_admin fără).
  insert into public.employees (id, organization_id, marca, first_name, last_name, hired_on, status, user_id) values
    (v_e_adm,  v_org, 'MZ-A', 'Ana',    'Admin',       v_azi - 900, 'activ', v_u_adm),
    (v_e_mgr,  v_org, 'MZ-M', 'Mihai',  'Rsvti',       v_azi - 800, 'activ', v_u_mgr),
    (v_e_resp, v_org, 'MZ-R', 'Radu',   'Responsabil', v_azi - 700, 'activ', v_u_resp),
    (v_e_col,  v_org, 'MZ-C', 'Carmen', 'Coleg',       v_azi - 600, 'activ', v_u_col);
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_adm,  'org_admin'),
    (v_org, v_u_mgr,  'manager'),
    (v_org, v_u_resp, 'employee'),
    (v_org, v_u_col,  'employee');

  insert into public.equipment (id, organization_id, cod, denumire, responsabil_employee_id) values
    (v_e1, v_org, 'STV-' || v_sufix, 'Stivuitor', v_e_resp),
    (v_e2, v_org, 'CMP-' || v_sufix, 'Compresor', null);

  -- Plan pe ZILE, scadent peste 5 zile → pragurile 30, 14 și 7 deodată.
  insert into public.maintenance_plans (id, organization_id, equipment_id, denumire, periodicitate_zile, ultima_executie, responsabil_employee_id)
  values (v_p_data, v_org, v_e1, 'Revizie lunară stivuitor', 30, v_azi - 25, v_e_resp);
  -- Autorizație ISCIR care expiră peste 10 zile (pragurile 30 și 14).
  insert into public.iscir_authorizations (organization_id, equipment_id, numar, tip, emitent, valabil_pana)
  values (v_org, v_e1, 'ISC-' || v_sufix, 'stivuitor', 'ISCIR', v_azi + 10);
  -- Plan pe CONTOR, aproape de țintă: pornește de la 100, ținta 600; azi 570.
  insert into public.equipment_meters (organization_id, equipment_id, tip, citire, data_citirii)
  values (v_org, v_e1, 'ore', 100, v_azi - 20);
  insert into public.maintenance_plans (id, organization_id, equipment_id, denumire, periodicitate_contor, tip_contor)
  values (v_p_aprope, v_org, v_e1, 'Schimb ulei la 500 h', 500, 'ore');
  insert into public.equipment_meters (organization_id, equipment_id, tip, citire, data_citirii)
  values (v_org, v_e1, 'ore', 570, v_azi);
  -- Plan pe CONTOR pe E2, citit ultima dată acum 40 de zile (pragul e 30).
  insert into public.equipment_meters (organization_id, equipment_id, tip, citire, data_citirii)
  values (v_org, v_e2, 'ore', 10, v_azi - 40);
  insert into public.maintenance_plans (id, organization_id, equipment_id, denumire, periodicitate_contor, tip_contor)
  values (v_p_vechi, v_org, v_e2, 'Revizie compresor la 1000 h', 1000, 'ore');

  -- Sesizare CRITICĂ, neatribuită, raportată acum 30 de ore.
  insert into public.fault_reports (organization_id, equipment_id, raportat_de_employee_id, descriere, urgenta, raportat_la)
  values (v_org, v_e2, v_e_col, 'Compresorul scoate fum la pornire.', 'critica', now() - interval '30 hours')
  returning id into v_fr_crit;
  -- Oprire deschisă de 4 zile, fără intervenție.
  insert into public.equipment_opriri (organization_id, equipment_id, inceput, tip, motiv)
  values (v_org, v_e2, now() - interval '4 days', 'neplanificata', 'Presostat defect');

  -- Sesizare rezolvată acum 10 zile, neconfirmată (închiderea automată, 5 zile).
  insert into public.fault_reports (organization_id, equipment_id, raportat_de_employee_id, descriere, urgenta, raportat_la)
  values (v_org, v_e1, v_e_col, 'Claxonul nu merge.', 'scazuta', now() - interval '12 days')
  returning id into v_fr_rez;
  update public.fault_reports set atribuit_employee_id = v_e_resp, status = 'in_lucru' where id = v_fr_rez;
  insert into public.maintenance_interventions (organization_id, equipment_id, fault_report_id, data, descriere, rezultat, tip)
  values (v_org, v_e1, v_fr_rez, v_azi - 10, 'Claxon înlocuit.', 'reusita', 'corectiva')
  returning id into v_int;
  update public.fault_reports set status = 'rezolvat', intervention_id = v_int where id = v_fr_rez;
  update public.fault_reports set rezolvat_la = now() - interval '10 days' where id = v_fr_rez;

  -- RSVTI: managerul. Setările se scriu ca serviciu (fixture), cu pragurile implicite.
  insert into public.maintenance_settings (organization_id, rsvti_employee_id)
  values (v_org, v_e_mgr);

  -- Firmele care trebuie SĂRITE au exact aceleași motive de alertă.
  insert into public.equipment (id, organization_id, cod, denumire) values
    (v_e_off, v_org_off, 'OFF-' || v_sufix, 'Utilaj oprit'),
    (v_e_sus, v_org_sus, 'SUS-' || v_sufix, 'Utilaj suspendat');
  insert into public.maintenance_plans (organization_id, equipment_id, denumire, periodicitate_zile, ultima_executie)
  values (v_org_off, v_e_off, 'Revizie', 30, v_azi - 25),
         (v_org_sus, v_e_sus, 'Revizie', 30, v_azi - 25);
  update public.organizations set status = 'suspended' where id = v_org_sus;

  -- ═══ Prima rulare ═══════════════════════════════════════════════════════
  v_rap := internal.mentenanta_zilnica();
  raise notice '  · prima rulare: %', v_rap;

  -- ═══ (1) Administratorul primește tot ═══════════════════════════════════
  select count(*), min(title), min(body), min(link) into v_n, v_titlu, v_corp, v_link
    from public.notifications
   where user_id = v_u_adm and organization_id = v_org and entity_type = 'maintenance_rezumat';
  if v_n = 1
     and v_titlu like 'Mentenanța de azi:%'
     and v_titlu like '%1 sesizare critică fără tehnician%'
     and v_titlu like '%1 oprire de peste 3 zile%'
     and v_titlu like '%1 plan pe contor la țintă%'
     and v_titlu like '%2 scadențe apropiate%'
     and v_titlu like '%1 contor necitit%'
     and v_link = '/mentenanta'
     and v_corp like '%Revizie lunară stivuitor%'
     and v_corp like '%Compresorul scoate fum%' then
    raise notice '  ✓ (1) administratorul: un rezumat cu tot — „%”', v_titlu;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) administratorul: % rezumate, titlu „%”, link %, corp: %', v_n, v_titlu, v_link, v_corp;
  end if;

  -- ═══ (2) Responsabilul utilajului primește doar ale lui ══════════════════
  select count(*), min(title), min(body), min(link) into v_n, v_titlu, v_corp, v_link
    from public.notifications
   where user_id = v_u_resp and organization_id = v_org and entity_type = 'maintenance_rezumat';
  if v_n = 1
     and v_titlu like '%2 scadențe apropiate%'
     and v_titlu like '%1 plan pe contor la țintă%'
     and v_titlu not like '%sesizare%'
     and v_titlu not like '%oprire%'
     and v_titlu not like '%necitit%'
     and v_corp not like '%CMP-%'
     and v_link = '/portal/sesizari' then
    raise notice '  ✓ (2) responsabilul: doar utilajul lui, link spre portal — „%”', v_titlu;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) responsabilul: % rezumate, titlu „%”, link %, corp: %', v_n, v_titlu, v_link, v_corp;
  end if;

  -- ═══ (3) RSVTI-ul primește doar autorizația ═════════════════════════════
  select count(*), min(title), min(body), min(link) into v_n, v_titlu, v_corp, v_link
    from public.notifications
   where user_id = v_u_mgr and organization_id = v_org and entity_type = 'maintenance_rezumat';
  if v_n = 1 and v_titlu = 'Mentenanța de azi: 1 scadență apropiată.'
     and v_corp like '%ISC-%' and v_link = '/mentenanta' then
    raise notice '  ✓ (3) RSVTI-ul: doar autorizația ISCIR, link spre /mentenanta';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) RSVTI-ul: % rezumate, titlu „%”, link %, corp: %', v_n, v_titlu, v_link, v_corp;
  end if;

  -- ═══ (4) Colegul fără legătură: nimic ════════════════════════════════════
  select count(*) into v_n from public.notifications
   where user_id = v_u_col and organization_id = v_org and entity_type = 'maintenance_rezumat';
  if v_n = 0 then
    raise notice '  ✓ (4) colegul fără legătură nu primește rezumat';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) colegul a primit % rezumate', v_n;
  end if;

  -- ═══ (5) A doua rulare nu dublează nimic ═════════════════════════════════
  select count(*) into v_n from public.notifications
   where organization_id = v_org and entity_type = 'maintenance_rezumat';
  select count(*) into v_ca from public.compliance_alerts where organization_id = v_org;
  select count(*) into v_an from public.alert_notifications where organization_id = v_org;
  select count(*) into v_rt from public.maintenance_rezumat_trimis where organization_id = v_org;

  perform internal.mentenanta_zilnica();

  select count(*) into v_n2 from public.notifications
   where organization_id = v_org and entity_type = 'maintenance_rezumat';
  if v_n = 3 and v_n2 = v_n
     and v_ca = (select count(*) from public.compliance_alerts where organization_id = v_org)
     and v_an = (select count(*) from public.alert_notifications where organization_id = v_org)
     and v_rt = (select count(*) from public.maintenance_rezumat_trimis where organization_id = v_org)
     and v_ca > 0 and v_an > 0 and v_rt > 0 then
    raise notice '  ✓ (5) a doua rulare: aceleași rânduri (% alerte, % marcate, % în registru, % rezumate)', v_ca, v_an, v_rt, v_n;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) rezumate % → %, alerte % → %, marcate % → %, registru % → %',
      v_n, v_n2, v_ca, (select count(*) from public.compliance_alerts where organization_id = v_org),
      v_an, (select count(*) from public.alert_notifications where organization_id = v_org),
      v_rt, (select count(*) from public.maintenance_rezumat_trimis where organization_id = v_org);
  end if;

  -- ═══ (6) Modul oprit / firmă suspendată: sărite ══════════════════════════
  select count(*) into v_n from public.compliance_alerts where organization_id in (v_org_off, v_org_sus);
  select count(*) into v_n2 from public.notifications
   where organization_id in (v_org_off, v_org_sus) and entity_type = 'maintenance_rezumat';
  if v_n = 0 and v_n2 = 0 then
    raise notice '  ✓ (6) firma cu modulul oprit și cea suspendată sunt sărite';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) pe firmele sărite: % alerte, % rezumate', v_n, v_n2;
  end if;

  -- ═══ (7) Închiderea automată ═════════════════════════════════════════════
  select status::text into v_status from public.fault_reports where id = v_fr_rez;
  select h.motiv into v_motiv from public.fault_report_history h
   where h.fault_report_id = v_fr_rez and h.camp = 'status' and h.valoare_noua = 'inchis';
  if v_status = 'inchis' and v_motiv like 'Închisă automat%' then
    raise notice '  ✓ (7) „rezolvat” de 10 zile → „închis”, istoric: %', v_motiv;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) starea e %, istoricul „%”', v_status, v_motiv;
  end if;

  -- ═══ (8) Vizibilitatea per destinatar, sub authenticated ═════════════════
  perform set_config('request.jwt.claim.sub', v_u_resp::text, true);
  set local role authenticated;
  select count(*) into v_n from public.notifications where entity_type = 'maintenance_rezumat';
  select count(*), count(*) filter (where user_id <> v_u_resp) into v_rt, v_n2
    from public.maintenance_rezumat_trimis;
  reset role;
  if v_n = 1 and v_rt > 0 and v_n2 = 0 then
    raise notice '  ✓ (8) responsabilul își vede rezumatul și registrul lui (% rânduri), nimic străin', v_rt;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) responsabilul vede % rezumate, % rânduri de registru (% străine)', v_n, v_rt, v_n2;
  end if;

  perform set_config('request.jwt.claim.sub', v_u_col::text, true);
  set local role authenticated;
  select count(*) into v_n from public.notifications where entity_type = 'maintenance_rezumat';
  select count(*) into v_rt from public.maintenance_rezumat_trimis;
  begin
    insert into public.maintenance_rezumat_trimis (organization_id, user_id, tip, entity_id)
    values (v_org, v_u_col, 'contor_necitit', v_e2);
    v_n2 := 1;
  exception when insufficient_privilege then
    v_n2 := 0;
  end;
  reset role;
  if v_n = 0 and v_rt = 0 and v_n2 = 0 then
    raise notice '  ✓ (8) colegul nu vede nimic și nu-și poate scrie singur registrul (42501)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) colegul: % rezumate, % rânduri, inserare reușită: %', v_n, v_rt, v_n2 = 1;
  end if;

  -- ═══ (9) Pragurile din setări ════════════════════════════════════════════
  -- Prima salvare a administratorului: fixture-ul are deja rândul, deci UPDATE
  -- (calea „există” din `salveazaSetariMentenanta`).
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  with m as (
    update public.maintenance_settings set praguri_alerta_zile = array[20, 5]
     where organization_id = v_org and deleted_at is null returning 1)
  select count(*) into v_n from m;
  reset role;
  select count(*) into v_n2 from public.alert_rules
   where organization_id = v_org and deleted_at is null and kind = '*'
     and entity_type in ('maintenance_plan', 'iscir_authorization', 'equipment')
     and valabil_de_la = v_azi and praguri_zile = array[20, 5];
  if v_n = 1 and v_n2 = 3 then
    raise notice '  ✓ (9) administratorul schimbă pragurile; alert_rules le are pe cele trei tipuri';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) UPDATE a atins % rânduri; alert_rules potrivite: % (așteptat 3)', v_n, v_n2;
  end if;

  -- A doua salvare din aceeași zi rescrie versiunea zilei, nu adaugă una.
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  update public.maintenance_settings set praguri_alerta_zile = array[30, 10]
   where organization_id = v_org and deleted_at is null;
  reset role;
  select count(*) into v_n from public.alert_rules
   where organization_id = v_org and deleted_at is null and valabil_de_la = v_azi
     and entity_type in ('maintenance_plan', 'iscir_authorization', 'equipment');
  select count(*) into v_n2 from public.alert_rules
   where organization_id = v_org and deleted_at is null and valabil_de_la = v_azi
     and praguri_zile = array[30, 10];
  if v_n = 3 and v_n2 = 3 then
    raise notice '  ✓ (9) a doua salvare din zi rescrie versiunea, nu o dublează';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) după a doua salvare: % reguli ale zilei, % cu 30/10', v_n, v_n2;
  end if;

  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  with m as (
    update public.maintenance_settings set praguri_alerta_zile = array[1]
     where organization_id = v_org returning 1)
  select count(*) into v_n from m;
  reset role;
  if v_n = 0 then
    raise notice '  ✓ (9) managerul nu schimbă pragurile (zero rânduri)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) managerul a schimbat pragurile';
  end if;

  begin
    update public.maintenance_settings set praguri_alerta_zile = array[0] where organization_id = v_org;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) pragul 0 a trecut';
  exception when check_violation then
    raise notice '  ✓ (9) pragul 0 e refuzat (23514)';
  end;

  -- ═══ (10) Nicio firmă eșuată ═════════════════════════════════════════════
  if coalesce((v_rap ->> 'firme_esuate')::int, -1) = 0 and coalesce((v_rap ->> 'firme')::int, 0) >= 1 then
    raise notice '  ✓ (10) jobul a trecut prin % firme, niciuna eșuată', v_rap ->> 'firme';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10) raportul jobului: %', v_rap;
  end if;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA „MENTENANȚA ZILNICĂ": % verificări picate', v_esecuri;
  end if;
  raise notice '  PROBA „MENTENANȚA ZILNICĂ": toate verificările au trecut.';
end $$;

-- ═══ (11) Responsabilii plecați din firmă ══════════════════════════════════
-- Bloc separat, pe o firmă proprie: `internal.mentenanta_responsabili` lua
-- `employees.user_id` din setări fără să verifice `organization_members`, deci
-- un fost responsabil primea coduri de utilaje și descrierile sesizărilor
-- critice (și prin push). Aceeași funcție alimentează nota internă și
-- atribuirea din 0181.
do $$
declare
  v_sufix   text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org     uuid := gen_random_uuid();
  v_u_adm   uuid := gen_random_uuid();
  v_u_inact uuid := gen_random_uuid();  -- membru `inactive`
  v_u_sters uuid := gen_random_uuid();  -- membru șters logic
  v_e_adm   uuid := gen_random_uuid();
  v_e_inact uuid := gen_random_uuid();
  v_e_sters uuid := gen_random_uuid();
  v_echip   uuid := gen_random_uuid();
  v_azi     date := app.azi_local();
  v_plecati integer;
  v_admin   integer;
  v_resp    integer;
begin
  insert into public.organizations (id, slug, name, cui, status) values
    (v_org, 'proba-mzp-' || v_sufix, 'Proba Plecați SRL', 'RO' || (88300000 + (random() * 90000)::int)::text, 'active');
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select v_org, f.feature_key, true, now() from public.features f;
  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_adm,   'mzp-adm-'   || v_sufix || '@proba.test', now()),
    (v_u_inact, 'mzp-inact-' || v_sufix || '@proba.test', now()),
    (v_u_sters, 'mzp-sters-' || v_sufix || '@proba.test', now());
  insert into public.employees (id, organization_id, marca, first_name, last_name, hired_on, status, user_id) values
    (v_e_adm,   v_org, 'MZP-A', 'Ana',   'Admin',   v_azi - 900, 'activ', v_u_adm),
    (v_e_inact, v_org, 'MZP-I', 'Ion',   'Plecat',  v_azi - 800, 'activ', v_u_inact),
    (v_e_sters, v_org, 'MZP-S', 'Sorin', 'Scos',    v_azi - 700, 'activ', v_u_sters);
  insert into public.organization_members (organization_id, user_id, role, status, deleted_at) values
    (v_org, v_u_adm,   'org_admin', 'active',   null),
    (v_org, v_u_inact, 'manager',   'inactive', null),
    (v_org, v_u_sters, 'employee',  'active',   now());
  insert into public.maintenance_settings (organization_id, responsabili)
  values (v_org, array[v_e_inact, v_e_sters]);

  insert into public.equipment (id, organization_id, cod, denumire) values (v_echip, v_org, 'PLC-' || v_sufix, 'Presă');
  insert into public.fault_reports (organization_id, equipment_id, raportat_de_employee_id, descriere, urgenta, raportat_la)
  values (v_org, v_echip, v_e_adm, 'Presa a luat foc la panou.', 'critica', now() - interval '30 hours');

  select count(*) into v_resp from internal.mentenanta_responsabili(v_org) r where r.user_id in (v_u_inact, v_u_sters);
  perform internal.mentenanta_rezumat(v_org);

  select count(*) into v_plecati from public.notifications
   where organization_id = v_org and entity_type = 'maintenance_rezumat' and user_id in (v_u_inact, v_u_sters);
  select count(*) into v_admin from public.notifications
   where organization_id = v_org and entity_type = 'maintenance_rezumat' and user_id = v_u_adm;

  raise notice '';
  if v_plecati = 0 and v_resp = 0 and v_admin = 1 then
    raise notice '  ✓ (11) responsabilii plecați nu primesc nimic; rezumatul ajunge la org_admin';
  else
    raise exception 'PROBA „MENTENANȚA ZILNICĂ" (11): plecații sunt destinatari % ori, au primit % rezumate; org_admin a primit % (așteptat 0/0/1)',
      v_resp, v_plecati, v_admin;
  end if;
end $$;
