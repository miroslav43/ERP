-- tests/rls/proba-notificari-fluxuri.sql
--
-- NOTIFICĂRILE FLUXURILOR, DUPĂ 0192 (W2-03: FLX-005, FLX-011, MGR-021).
--
-- ── CE VERIFICĂ, PE RÂND ────────────────────────────────────────────────────
-- (1) cererea de concediu trimisă ⇒ `approval` la manager; decizia pe
--     sarcină o marchează citită                                     [POZITIVĂ];
-- (2) două sarcini surori ⇒ decizia uneia închide și notificarea celeilalte
--     (anulată de `trg_approval_tasks_anuleaza_surori`);
-- (3) tichetul `in_aprobare` decis de manager ⇒ `approval`-ul lui e citit;
-- (4) repartizarea ⇒ solicitantul (info) + asignatul (task); autorul nu;
-- (5) comentariul public al operatorului ⇒ solicitantul, cu corpul mesajului;
-- (6) comentariul solicitantului pe un tichet FĂRĂ asignat ⇒ patronul
--     (`tickets:update = all`), nu autorul;
-- (7) nota internă ⇒ zero rânduri noi;
-- (8) concediul respins cu motiv ⇒ corpul notificării conține motivul;
-- (9) asignat din ALTĂ firmă (cheia străină nu e compusă cu organizația) ⇒
--     nicio notificare la utilizatorul străin, nici numele lui la solicitant
--                                                                [NEGATIVĂ];
-- (10) răspunsul solicitantului pe tichetul cu asignat străin ⇒ nimic nu
--     iese din firmă                                              [NEGATIVĂ];
-- (11) solicitantul își REDESCHIDE tichetul rezolvat ⇒ asignatul primește
--     „redeschis de solicitant”; solicitantul nu se anunță pe sine (0194);
-- (12) solicitantul își ÎNCHIDE tichetul fără asignat ⇒ cei cu
--     `tickets:update = all`; solicitantul nu se anunță pe sine (0194);
-- (13) solicitant din ALTĂ firmă pus de operator pe tichet ⇒ schimbarea de
--     stare nu scrie în clopoțelul străin                          [NEGATIVĂ];
-- (14) duplicat din ALTĂ firmă legat de un bug rezolvat ⇒ autorul străin nu
--     primește titlul tichetului nostru                            [NEGATIVĂ].
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix     text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org       uuid := gen_random_uuid();
  v_u_patron  uuid := gen_random_uuid();
  v_u_mgr     uuid := gen_random_uuid();
  v_u_ang     uuid := gen_random_uuid();
  v_u_it      uuid := gen_random_uuid();
  v_e_patron  uuid;
  v_e_mgr     uuid := gen_random_uuid();
  v_e_ang     uuid := gen_random_uuid();
  v_e_it      uuid := gen_random_uuid();
  v_tip       uuid;
  v_cerere    uuid;
  v_cerere2   uuid;
  v_sarcina   uuid;
  v_sarcina2  uuid;
  v_sora      uuid := gen_random_uuid();
  v_t1        uuid := gen_random_uuid();
  v_t2        uuid := gen_random_uuid();
  v_org_strain uuid := gen_random_uuid();
  v_u_strain  uuid := gen_random_uuid();
  v_e_strain  uuid := gen_random_uuid();
  v_t3        uuid := gen_random_uuid();
  v_t4        uuid := gen_random_uuid();
  v_t_strain  uuid := gen_random_uuid();
  v_n         int;
  v_m         int;
  v_inainte   int;
  v_body      text;
  v_esecuri   int := 0;
begin
  raise notice '';
  raise notice '  PROBA „NOTIFICĂRILE FLUXURILOR" (0192)';
  raise notice '  ─────────────────────────────────────';

  -- ── fixture ───────────────────────────────────────────────────────────────
  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-notif-' || v_sufix, 'Proba Notificări SRL',
     'RO' || (86000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select v_org, f.feature_key, true, now() from public.features f;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_patron, 'nf-pat-' || v_sufix || '@proba.test', now()),
    (v_u_mgr,    'nf-mgr-' || v_sufix || '@proba.test', now()),
    (v_u_ang,    'nf-ang-' || v_sufix || '@proba.test', now()),
    (v_u_it,     'nf-it-'  || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_patron, 'org_admin'), (v_org, v_u_mgr, 'manager'),
    (v_org, v_u_ang, 'employee'), (v_org, v_u_it, 'employee');

  -- Patron → manager → angajat; tehnicianul IT e sub patron și primește
  -- tichetul la repartizare. Patronul își primește fișa automat (0083).
  select e.id into v_e_patron
    from public.employees e
   where e.organization_id = v_org and e.user_id = v_u_patron and e.deleted_at is null
   limit 1;
  update public.employees set status = 'activ', functie = 'Director' where id = v_e_patron;
  insert into public.employees (id, organization_id, marca, first_name, last_name, functie,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_mgr, v_org, 'NF-M', 'Mihai', 'Manager',  'Șef echipă',   app.azi_local() - 500, 'activ', v_u_mgr, v_e_patron),
    (v_e_ang, v_org, 'NF-A', 'Ana',   'Angajat',  'Operator',     app.azi_local() - 400, 'activ', v_u_ang, v_e_mgr),
    (v_e_it,  v_org, 'NF-I', 'Ionuț', 'Tehnic',   'Tehnician IT', app.azi_local() - 300, 'activ', v_u_it,  v_e_patron);

  select lt.id into v_tip
    from public.leave_types lt
   where lt.organization_id = v_org and lt.key = 'odihna' and lt.deleted_at is null
   limit 1;

  -- ═══ (1) cerere trimisă → approval la manager; decizia o închide ═══════════
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  insert into public.leave_requests
    (organization_id, employee_id, leave_type_id, data_inceput, data_sfarsit, status, created_by)
  values (v_org, v_e_ang, v_tip, app.azi_local() + 10, app.azi_local() + 12, 'trimisa', v_u_ang)
  returning id into v_cerere;
  reset role;

  select t.id into v_sarcina
    from public.approval_tasks t
   where t.entity_type = 'leave_request' and t.entity_id = v_cerere
     and t.approver_user_id = v_u_mgr and t.status = 'in_asteptare' and t.deleted_at is null
   limit 1;
  select count(*) into v_n
    from public.notifications n
   where n.user_id = v_u_mgr and n.entity_type = 'leave_request' and n.entity_id = v_cerere
     and n.kind = 'approval' and n.read_at is null;
  if v_sarcina is null or v_n <> 1 then
    raise exception 'proba-notificari-fluxuri: CAZ VID — cererea n-a produs sarcina managerului (%) sau notificarea lui (%); fluxul seedat s-a schimbat.',
      v_sarcina, v_n;
  end if;

  -- Sora: a doua sarcină pe aceeași treaptă, pentru patron, cu notificarea ei
  -- (0048 §1 a rulat la inserarea cererii, înainte să existe sora).
  insert into public.approval_tasks
    (id, organization_id, flow_id, step_id, entity_type, entity_id, ordine,
     approver_user_id, approver_employee_id, status)
  select v_sora, t.organization_id, t.flow_id, t.step_id, t.entity_type, t.entity_id, t.ordine,
         v_u_patron, v_e_patron, 'in_asteptare'
    from public.approval_tasks t where t.id = v_sarcina;
  insert into public.notifications
    (organization_id, user_id, kind, title, body, link, entity_type, entity_id)
  values (v_org, v_u_patron, 'approval', 'Cerere de concediu de aprobat', 'Soră de probă.',
          '/concedii/aprobari', 'leave_request', v_cerere);

  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  update public.approval_tasks
     set status = 'aprobata', decis_la = now(), comentariu = 'Aprobat în probă'
   where id = v_sarcina;
  reset role;

  select count(*) into v_n
    from public.notifications n
   where n.user_id = v_u_mgr and n.entity_type = 'leave_request' and n.entity_id = v_cerere
     and n.read_at is null;
  if v_n = 0 then
    raise notice '  ✓ (1) decizia pe sarcină marchează citită notificarea „de aprobat" a managerului';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) managerul mai are % notificări necitite pe cererea decisă', v_n;
  end if;

  -- ═══ (2) sora anulată își închide notificarea ══════════════════════════════
  select count(*) into v_n
    from public.notifications n
   where n.user_id = v_u_patron and n.entity_type = 'leave_request' and n.entity_id = v_cerere
     and n.read_at is null;
  select count(*) into v_m from public.approval_tasks t where t.id = v_sora and t.status = 'anulata';
  if v_n = 0 and v_m = 1 then
    raise notice '  ✓ (2) sarcina-soră anulată de decizia managerului își închide și ea notificarea';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) sora: % necitite rămase, anulată=%', v_n, v_m;
  end if;

  -- ═══ (3) tichetul in_aprobare decis ⇒ approval-ul managerului citit ════════
  insert into public.tickets (id, organization_id, numar_afisat, tip, titlu, descriere,
                              solicitant_employee_id, status, aprobare_ceruta,
                              aplicatie, numar_licente, created_by, updated_by) values
    (v_t1, v_org, 'IT-2026-920001', 'software', 'Licență de proiectare', 'Am nevoie de o licență.',
     v_e_ang, 'in_aprobare', true, 'AutoCAD', 1, v_u_ang, v_u_ang);
  select count(*) into v_n
    from public.notifications n
   where n.user_id = v_u_mgr and n.entity_type = 'ticket' and n.entity_id = v_t1
     and n.kind = 'approval' and n.read_at is null;
  if v_n <> 1 then
    raise exception 'proba-notificari-fluxuri: CAZ VID — tichetul in_aprobare n-a produs approval-ul managerului (%).', v_n;
  end if;

  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  update public.tickets set status = 'in_lucru' where id = v_t1;
  reset role;

  select count(*) into v_n
    from public.notifications n
   where n.user_id = v_u_mgr and n.entity_type = 'ticket' and n.entity_id = v_t1
     and n.kind = 'approval' and n.read_at is null;
  if v_n = 0 then
    raise notice '  ✓ (3) tichetul decis închide „Cererea IT de aprobat" a managerului';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) approval-ul managerului rămâne necitit după decizie (%)', v_n;
  end if;

  -- ═══ (4) repartizarea ⇒ solicitant + asignat; autorul nu ═══════════════════
  perform set_config('request.jwt.claim.sub', v_u_patron::text, true);
  set local role authenticated;
  update public.tickets set asignat_employee_id = v_e_it where id = v_t1;
  reset role;

  select count(*) into v_n
    from public.notifications n
   where n.user_id = v_u_ang and n.entity_id = v_t1 and n.kind = 'info'
     and n.title = 'Tichetul IT-2026-920001 a fost repartizat';
  select count(*) into v_m
    from public.notifications n
   where n.user_id = v_u_it and n.entity_id = v_t1 and n.kind = 'task'
     and n.title = 'Tichet repartizat dumneavoastră: IT-2026-920001';
  select count(*) into v_inainte
    from public.notifications n
   where n.user_id = v_u_patron and n.entity_id = v_t1;
  if v_n = 1 and v_m = 1 and v_inainte = 0 then
    raise notice '  ✓ (4) repartizarea anunță solicitantul și asignatul, nu pe cel care a repartizat';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) repartizare: solicitant=%, asignat=%, autor=% (aștept 1, 1, 0)', v_n, v_m, v_inainte;
  end if;

  -- ═══ (5) comentariul public al operatorului ⇒ solicitantul ═════════════════
  perform set_config('request.jwt.claim.sub', v_u_it::text, true);
  set local role authenticated;
  insert into public.ticket_comments (organization_id, ticket_id, autor_employee_id, continut, intern)
  values (v_org, v_t1, v_e_it, 'Am instalat licența, verificați.', false);
  reset role;

  select n.body into v_body
    from public.notifications n
   where n.user_id = v_u_ang and n.entity_id = v_t1
     and n.title = 'Răspuns la tichetul IT-2026-920001'
   order by n.created_at desc limit 1;
  select count(*) into v_m
    from public.notifications n
   where n.user_id = v_u_it and n.entity_id = v_t1 and n.title like 'Răspuns%';
  if v_body = 'Am instalat licența, verificați.' and v_m = 0 then
    raise notice '  ✓ (5) răspunsul operatorului ajunge la solicitant, cu textul lui; nu la autor';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) răspunsul operatorului: corp=%, la autor=%', v_body, v_m;
  end if;

  -- ═══ (6) comentariul solicitantului, fără asignat ⇒ tickets:update = all ═══
  insert into public.tickets (id, organization_id, numar_afisat, tip, titlu, descriere,
                              modul, pasi_efectuati, rezultat_asteptat, rezultat_obtinut,
                              solicitant_employee_id, created_by, updated_by) values
    (v_t2, v_org, 'IT-2026-920002', 'bug_erp', 'Butonul nu salvează', 'Descriere.',
     'Pontaj', 'Am apăsat.', 'Se salvează.', 'Nu se salvează.', v_e_ang, v_u_ang, v_u_ang);

  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  insert into public.ticket_comments (organization_id, ticket_id, autor_employee_id, continut, intern)
  values (v_org, v_t2, v_e_ang, 'Se întâmplă și azi.', false);
  reset role;

  select count(*) into v_n
    from public.notifications n
   where n.user_id = v_u_patron and n.entity_id = v_t2
     and n.title = 'Răspuns nou pe tichetul IT-2026-920002';
  select count(*) into v_m
    from public.notifications n
   where n.user_id in (v_u_ang, v_u_mgr, v_u_it) and n.entity_id = v_t2
     and n.title like 'Răspuns%';
  if v_n = 1 and v_m = 0 then
    raise notice '  ✓ (6) răspunsul solicitantului fără asignat ajunge la cei cu tickets:update = all';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) răspunsul solicitantului: patron=%, alții=% (aștept 1, 0)', v_n, v_m;
  end if;

  -- ═══ (7) nota internă ⇒ nimic ══════════════════════════════════════════════
  select count(*) into v_inainte from public.notifications n where n.organization_id = v_org;
  perform set_config('request.jwt.claim.sub', v_u_patron::text, true);
  set local role authenticated;
  insert into public.ticket_comments (organization_id, ticket_id, autor_employee_id, continut, intern)
  values (v_org, v_t1, v_e_patron, 'Notă internă: de verificat licența.', true);
  reset role;
  select count(*) into v_n from public.notifications n where n.organization_id = v_org;
  if v_n = v_inainte then
    raise notice '  ✓ (7) nota internă nu produce nicio notificare';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) nota internă a produs % notificări', v_n - v_inainte;
  end if;

  -- ═══ (8) concediul respins poartă motivul ══════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  insert into public.leave_requests
    (organization_id, employee_id, leave_type_id, data_inceput, data_sfarsit, status, created_by)
  values (v_org, v_e_ang, v_tip, app.azi_local() + 20, app.azi_local() + 21, 'trimisa', v_u_ang)
  returning id into v_cerere2;
  reset role;

  select t.id into v_sarcina2
    from public.approval_tasks t
   where t.entity_type = 'leave_request' and t.entity_id = v_cerere2
     and t.approver_user_id = v_u_mgr and t.status = 'in_asteptare' and t.deleted_at is null
   limit 1;

  -- Exact pașii din `decideCerere`: sarcina, apoi cererea, cu motivul în
  -- același UPDATE cu statusul.
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  update public.approval_tasks
     set status = 'respinsa', decis_la = now(), comentariu = 'Respins în probă'
   where id = v_sarcina2;
  update public.leave_requests
     set status = 'respinsa',
         motiv_respingere = 'Lipsă de personal în perioada cerută',
         decis_de = v_u_mgr
   where id = v_cerere2;
  reset role;

  select n.body into v_body
    from public.notifications n
   where n.user_id = v_u_ang and n.entity_type = 'leave_request' and n.entity_id = v_cerere2
     and n.kind = 'warning'
   order by n.created_at desc limit 1;
  if v_body like '%Motiv: Lipsă de personal în perioada cerută.%' then
    raise notice '  ✓ (8) concediul respins duce motivul în corpul notificării';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) corpul notificării de respingere e „%"', v_body;
  end if;

  -- ═══ (9) asignat din ALTĂ firmă ⇒ nicio notificare peste graniță ═════════
  -- Cheia străină `tickets.asignat_employee_id` nu e compusă cu
  -- `organization_id`, iar triggerele 0192 sunt SECURITY DEFINER: fără filtrul
  -- pe firmă, ID-ul fișei străine ar scrie în clopoțelul utilizatorului străin
  -- (și numele lui în notificarea solicitantului).
  insert into public.organizations (id, slug, name, cui) values
    (v_org_strain, 'proba-notif-strain-' || v_sufix, 'Proba Străină SRL',
     'RO' || (87000000 + (random() * 900000)::int)::text);
  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_strain, 'nf-str-' || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org_strain, v_u_strain, 'employee');
  insert into public.employees (id, organization_id, marca, first_name, last_name, functie,
                                hired_on, status, user_id) values
    (v_e_strain, v_org_strain, 'NF-S', 'Sorin', 'Străinu', 'Tehnician', app.azi_local() - 200,
     'activ', v_u_strain);

  perform set_config('request.jwt.claim.sub', v_u_patron::text, true);
  set local role authenticated;
  update public.tickets set asignat_employee_id = v_e_strain where id = v_t2;
  reset role;

  if not exists (select 1 from public.tickets t where t.id = v_t2 and t.asignat_employee_id = v_e_strain) then
    raise exception 'proba-notificari-fluxuri: CAZ VID — UPDATE-ul cu asignat străin n-a ajuns în rând; cazul (9) nu mai probează triggerul.';
  end if;

  select count(*) into v_n
    from public.notifications n
   where n.user_id = v_u_strain or n.organization_id = v_org_strain;
  select count(*) into v_m
    from public.notifications n
   where n.entity_id = v_t2 and n.title = 'Tichetul IT-2026-920002 a fost repartizat';
  if v_n = 0 and v_m = 0 then
    raise notice '  ✓ (9) asignatul din altă firmă nu primește nimic, iar numele lui nu ajunge la solicitant';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) asignat străin: la utilizatorul străin=%, la solicitant=% (aștept 0, 0)', v_n, v_m;
  end if;

  -- ═══ (10) răspunsul solicitantului pe tichetul cu asignat străin ⇒ nimic afară ═
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  insert into public.ticket_comments (organization_id, ticket_id, autor_employee_id, continut, intern)
  values (v_org, v_t2, v_e_ang, 'Mai e cineva pe tichet?', false);
  reset role;

  select count(*) into v_n
    from public.notifications n
   where n.user_id = v_u_strain or n.organization_id = v_org_strain;
  if v_n = 0 then
    raise notice '  ✓ (10) comentariul pe tichetul cu asignat străin nu iese din firmă';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10) comentariul a ajuns la utilizatorul străin (% notificări)', v_n;
  end if;

  -- ═══ (11) solicitantul redeschide ⇒ asignatul află; el nu se anunță pe sine ═
  -- Tichetele pornesc direct din `rezolvat` (inserate ca proprietar): ce se
  -- probează e gestul solicitantului, nu drumul până acolo.
  insert into public.tickets (id, organization_id, numar_afisat, tip, titlu, descriere,
                              modul, pasi_efectuati, rezultat_asteptat, rezultat_obtinut,
                              solicitant_employee_id, asignat_employee_id, status,
                              created_by, updated_by) values
    (v_t3, v_org, 'IT-2026-920003', 'bug_erp', 'Raportul nu se descarcă', 'Descriere.',
     'Rapoarte', 'Am apăsat.', 'Se descarcă.', 'Nu se descarcă.', v_e_ang, v_e_it, 'rezolvat',
     v_u_ang, v_u_ang),
    (v_t4, v_org, 'IT-2026-920004', 'bug_erp', 'Filtrul nu se aplică', 'Descriere.',
     'Rapoarte', 'Am apăsat.', 'Se aplică.', 'Nu se aplică.', v_e_ang, null, 'rezolvat',
     v_u_ang, v_u_ang);

  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  update public.tickets set status = 'redeschis' where id = v_t3;
  reset role;

  if not exists (select 1 from public.tickets t where t.id = v_t3 and t.status = 'redeschis') then
    raise exception 'proba-notificari-fluxuri: CAZ VID — solicitantul n-a putut redeschide tichetul; cazul (11) nu mai probează triggerul.';
  end if;

  select count(*) into v_n
    from public.notifications n
   where n.user_id = v_u_it and n.entity_id = v_t3 and n.kind = 'task'
     and n.title = 'Tichetul IT-2026-920003: redeschis de solicitant';
  select count(*) into v_m
    from public.notifications n
   where n.user_id = v_u_ang and n.entity_id = v_t3;
  select count(*) into v_inainte
    from public.notifications n
   where n.user_id in (v_u_patron, v_u_mgr) and n.entity_id = v_t3;
  if v_n = 1 and v_m = 0 and v_inainte = 0 then
    raise notice '  ✓ (11) redeschiderea solicitantului ajunge la asignat, nu la el însuși';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (11) redeschidere: asignat=%, solicitant=%, alții=% (aștept 1, 0, 0)', v_n, v_m, v_inainte;
  end if;

  -- ═══ (12) solicitantul închide fără asignat ⇒ tickets:update = all ═════════
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  update public.tickets set status = 'inchis' where id = v_t4;
  reset role;

  if not exists (select 1 from public.tickets t where t.id = v_t4 and t.status = 'inchis') then
    raise exception 'proba-notificari-fluxuri: CAZ VID — solicitantul n-a putut închide tichetul; cazul (12) nu mai probează triggerul.';
  end if;

  select count(*) into v_n
    from public.notifications n
   where n.user_id = v_u_patron and n.entity_id = v_t4 and n.kind = 'info'
     and n.title = 'Tichetul IT-2026-920004: închis de solicitant';
  select count(*) into v_m
    from public.notifications n
   where n.user_id = v_u_ang and n.entity_id = v_t4;
  select count(*) into v_inainte
    from public.notifications n
   where n.user_id in (v_u_mgr, v_u_it) and n.entity_id = v_t4;
  if v_n = 1 and v_m = 0 and v_inainte = 0 then
    raise notice '  ✓ (12) închiderea solicitantului fără asignat ajunge la cei cu tickets:update = all';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (12) închidere: patron=%, solicitant=%, alții=% (aștept 1, 0, 0)', v_n, v_m, v_inainte;
  end if;

  -- ═══ (13) solicitant străin pe tichet ⇒ starea nu iese din firmă ═══════════
  -- `tickets_pazeste_campurile` îl lasă pe operator să schimbe solicitantul,
  -- iar cheia străină nu e compusă cu organizația.
  perform set_config('request.jwt.claim.sub', v_u_patron::text, true);
  set local role authenticated;
  update public.tickets set solicitant_employee_id = v_e_strain where id = v_t1;
  update public.tickets set status = 'in_asteptare' where id = v_t1;
  reset role;

  if not exists (select 1 from public.tickets t
                  where t.id = v_t1 and t.solicitant_employee_id = v_e_strain
                    and t.status = 'in_asteptare') then
    raise exception 'proba-notificari-fluxuri: CAZ VID — solicitantul străin sau starea nu au ajuns în rând; cazul (13) nu mai probează triggerul.';
  end if;

  select count(*) into v_n
    from public.notifications n
   where n.user_id = v_u_strain or n.organization_id = v_org_strain;
  if v_n = 0 then
    raise notice '  ✓ (13) schimbarea de stare pe tichetul cu solicitant străin nu iese din firmă';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (13) schimbarea de stare a ajuns la utilizatorul străin (% notificări)', v_n;
  end if;

  -- ═══ (14) duplicat din altă firmă ⇒ rezolvarea nu-i trimite titlul nostru ══
  insert into public.tickets (id, organization_id, numar_afisat, tip, titlu, descriere,
                              modul, pasi_efectuati, rezultat_asteptat, rezultat_obtinut,
                              solicitant_employee_id, parent_ticket_id, created_by, updated_by) values
    (v_t_strain, v_org_strain, 'IT-2026-920099', 'bug_erp', 'Nu salvează nici la noi', 'Descriere.',
     'Pontaj', 'Am apăsat.', 'Se salvează.', 'Nu se salvează.', v_e_strain, v_t2,
     v_u_strain, v_u_strain);

  perform set_config('request.jwt.claim.sub', v_u_patron::text, true);
  set local role authenticated;
  update public.tickets set status = 'in_lucru' where id = v_t2;
  update public.tickets set status = 'rezolvat' where id = v_t2;
  reset role;

  if not exists (select 1 from public.tickets t where t.id = v_t2 and t.status = 'rezolvat') then
    raise exception 'proba-notificari-fluxuri: CAZ VID — bug-ul părinte n-a ajuns în `rezolvat`; cazul (14) nu mai probează triggerul.';
  end if;

  select count(*) into v_n
    from public.notifications n
   where n.user_id = v_u_strain or n.organization_id = v_org_strain;
  if v_n = 0 then
    raise notice '  ✓ (14) duplicatul din altă firmă nu primește rezolvarea bug-ului nostru';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (14) rezolvarea a ajuns la autorul duplicatului străin (% notificări)', v_n;
  end if;

  if v_esecuri > 0 then
    raise exception 'proba-notificari-fluxuri: % verificări picate', v_esecuri;
  end if;
  raise notice '  toate verificările au trecut';
end $$;
