-- tests/rls/proba-flota-conformitate-zilnica.sql
--
-- FLOTA, DUPĂ 0201: JOBUL ZILNIC DE CONFORMITATE, SETĂRILE FLOTEI ȘI
-- NOTIFICĂRILE PE FLUXUL FOII. Pe seed-ul real al rolurilor.
--
-- ── DE CE EXISTĂ FIȘIERUL ───────────────────────────────────────────────────
-- Jobul rulează noaptea, fără nimeni autentificat, și scrie notificări pentru
-- oameni diferiți din aceleași rânduri. Două lucruri nu se văd din aplicație:
-- că a doua rulare nu dublează nimic și că fiecare primește DOAR ce îi
-- aparține. Ambele se află rulând (memoria „Sonda empirică pentru RLS”).
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- Jobul (firmă fără setări = responsabili impliciți, toți org_admin):
--  (1) administratorul primește UN rezumat cu toate cele 3 documente de pe 2
--      vehicule, cu legătura spre lista filtrată                   [POZITIVĂ];
--  (2) șoferul alocat primește UN rezumat cu cele 2 documente ale mașinii lui,
--      cu legătura spre portal                                      [POZITIVĂ];
--  (3) managerul, colegul fără mașină și `hr` nu primesc nimic;
--  (4) a doua rulare: zero notificări noi, aceleași rânduri în
--      compliance_alerts și alert_notifications (idempotență);
--  (5) firma cu `fleet` OPRIT: nicio alertă, nicio notificare;
--  (6) fiecare își vede, sub `authenticated`, doar notificarea lui  [POZITIVĂ];
--  (7) jobul nu a eșuat pe nicio firmă din bază.
-- Setările (0201 §A):
--  (8) administratorul le scrie (prima salvare = INSERT), pragurile ajung
--      ordonate în alert_rules pe `vehicle_document`              [POZITIVĂ];
--  (9) managerul NU le scrie (42501 la INSERT pe firmă fără rând? nu: rândul
--      există, deci zero rânduri la UPDATE), angajatul nici atât;
-- (10) responsabil din altă firmă: P0001;
-- (11) responsabil `hr` (nu vede parcul): nu contează, alerta nouă ajunge tot la
--      administrator (cu pragurile noi trecute pe celelalte documente);
-- (12) responsabil manager (`vehicles:read = team`): primește DOAR documentele
--      vehiculelor pe care le vede (mașina șoferiței din echipa lui), cu
--      legătura spre fișa ei; documentul de pe un vehicul pe care nu-l vede
--      (VC) ajunge la administrator, nu la el                       [NEGATIVĂ];
-- (13) pragul de salt din setări (100 km) produce anomalia pe care implicitul
--      (1.500 km) n-ar fi produs-o                                 [POZITIVĂ].
-- Fluxul foii (0201 §D):
-- (14) foaia trimisă de șoferiță ajunge la managerul ei (approve = team),
--      nu și la ea                                                  [POZITIVĂ];
-- (15) respingerea ajunge la șoferiță, cu motivul                   [POZITIVĂ];
-- (16) retrimiterea ajunge iar la manager; aprobarea administratorului ajunge
--      la șoferiță, iar administratorul nu-și scrie singur notificare [POZITIVĂ].
-- Responsabilul cu `own` (după revizuirea F5):
-- (17) un angajat ales responsabil, fără mașină, nu primește documentele parcului
--      pe care nu-l vede; documentul nou ajunge la administrator   [NEGATIVĂ].
-- (18) același responsabil primește documentele unei mașini POOL (o vede), cu
--      legătura spre portal; administratorul nu le mai primește     [POZITIVĂ].
-- (19) cu pragul de 60 de zile, un rezumat pe două vehicule cu documente peste
--      30 de zile duce la lista întreagă, nu la filtrul „expiră” (care arată
--      doar 30 de zile, PRAG_FLOTA_AVERTIZARE_ZILE) — altfel vehiculele lipsesc.
-- Constatarea revizuirii pe 0201 (citirea setărilor):
-- (20) `manager` (team) și `employee` (own) citesc ZERO rânduri din
--      `fleet_settings`; administratorul citește unul                  [NEGATIVĂ];
-- (21) pragul de salt al unui vehicul vizibil se află prin
--      `public.flota_prag_salt_km`: managerul pe mașina echipei lui, șoferița
--      pe a ei și pe pool; pe un vehicul pe care nu-l vede, NULL      [POZITIVĂ].
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_azi      date := app.azi_local();
  v_zi       date := app.azi_local() - 3;
  v_org      uuid := gen_random_uuid();
  v_org2     uuid := gen_random_uuid();   -- altă firmă, pentru responsabilul străin
  v_org_off  uuid := gen_random_uuid();   -- modulul fleet oprit
  v_u_adm    uuid := gen_random_uuid();
  v_u_mgr    uuid := gen_random_uuid();
  v_u_a      uuid := gen_random_uuid();   -- șoferița, cu mașina VA
  v_u_b      uuid := gen_random_uuid();   -- coleg fără mașină
  v_u_hr     uuid := gen_random_uuid();
  v_u_off    uuid := gen_random_uuid();
  v_e_adm    uuid := gen_random_uuid();
  v_e_mgr    uuid := gen_random_uuid();
  v_e_a      uuid := gen_random_uuid();
  v_e_b      uuid := gen_random_uuid();
  v_e_hr     uuid := gen_random_uuid();
  v_e_strain uuid := gen_random_uuid();
  v_v_a      uuid := gen_random_uuid();
  v_v_b      uuid := gen_random_uuid();
  v_v_c      uuid := gen_random_uuid();
  v_v_off    uuid := gen_random_uuid();
  v_t_rca    uuid;
  v_t_itp    uuid;
  v_t_rov    uuid;
  v_t_casco  uuid;
  v_foaie    uuid;
  v_rap      jsonb;
  v_n        int;
  v_n2       int;
  v_ca       int;
  v_an       int;
  v_titlu    text;
  v_corp     text;
  v_link     text;
  v_tip      text;
  v_praguri  int[];
  v_nul_mgr  boolean;
  v_nul_a    boolean;
  v_esecuri  int := 0;
begin
  raise notice '';
  raise notice '  PROBA „FLOTA — CONFORMITATEA ZILNICĂ" (0201)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org,     'proba-fcz-' || v_sufix,     'Proba Conformitate SRL',
     'RO' || (86000000 + (random() * 900000)::int)::text),
    (v_org2,    'proba-fcz2-' || v_sufix,    'Proba Conformitate Doi SRL',
     'RO' || (87000000 + (random() * 900000)::int)::text),
    (v_org_off, 'proba-fcz-off-' || v_sufix, 'Proba Fără Flotă SRL',
     'RO' || (88000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select o, f.feature_key, true, now()
    from public.features f, unnest(array[v_org, v_org2]) as o;
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select v_org_off, f.feature_key, f.feature_key <> 'fleet', now() from public.features f;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_adm, 'fcz-adm-' || v_sufix || '@proba.test', now()),
    (v_u_mgr, 'fcz-mgr-' || v_sufix || '@proba.test', now()),
    (v_u_a,   'fcz-a-'   || v_sufix || '@proba.test', now()),
    (v_u_b,   'fcz-b-'   || v_sufix || '@proba.test', now()),
    (v_u_hr,  'fcz-hr-'  || v_sufix || '@proba.test', now()),
    (v_u_off, 'fcz-off-' || v_sufix || '@proba.test', now());
  -- Fișele ÎNAINTEA rândurilor de membru: altfel 0083 îi creează singur
  -- administratorului o fișă (`trg_zorganization_members_fisa_patron`), iar a
  -- noastră ar lovi `employees_org_user_primary_uniq`.
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_adm, v_org, 'FCZ-ADM', 'Ioana',  'Administrator', v_azi - 900, 'activ', v_u_adm, null),
    (v_e_mgr, v_org, 'FCZ-M',   'Mihai',  'Manager',       v_azi - 500, 'activ', v_u_mgr, null),
    (v_e_hr,  v_org, 'FCZ-HR',  'Elena',  'Personal',      v_azi - 500, 'activ', v_u_hr,  null),
    (v_e_strain, v_org2, 'FCZ-S', 'Străin', 'Altă Firmă',  v_azi - 500, 'activ', null,    null);
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_a, v_org, 'FCZ-A', 'Ana',    'Șofer', v_azi - 400, 'activ', v_u_a, v_e_mgr),
    (v_e_b, v_org, 'FCZ-B', 'Bogdan', 'Coleg', v_azi - 400, 'activ', v_u_b, v_e_mgr);

  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_adm, 'org_admin'),
    (v_org, v_u_mgr, 'manager'),
    (v_org, v_u_a,   'employee'),
    (v_org, v_u_b,   'employee'),
    (v_org, v_u_hr,  'hr'),
    (v_org_off, v_u_off, 'org_admin');

  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent,
                               created_by, updated_by) values
    (v_v_a,   v_org,     'B' || (100 + (random() * 800)::int)::text || 'FCA', 'Dacia', 'Logan',  10000, v_u_adm, v_u_adm),
    (v_v_b,   v_org,     'B' || (100 + (random() * 800)::int)::text || 'FCB', 'Dacia', 'Duster', 20000, v_u_adm, v_u_adm),
    (v_v_c,   v_org,     'B' || (100 + (random() * 800)::int)::text || 'FCC', 'Dacia', 'Jogger', 30000, v_u_adm, v_u_adm),
    (v_v_off, v_org_off, 'B' || (100 + (random() * 800)::int)::text || 'FCO', 'Dacia', 'Spring', 5000,  v_u_off, v_u_off);
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, created_by, updated_by) values
    (v_org, v_v_a, v_e_a, now() - interval '30 days', v_u_adm, v_u_adm);

  select id into v_t_rca from public.vehicle_document_types where cod = 'rca' and organization_id is null;
  select id into v_t_itp from public.vehicle_document_types where cod = 'itp' and organization_id is null;
  select id into v_t_rov from public.vehicle_document_types where cod = 'rovinieta' and organization_id is null;
  select id into v_t_casco from public.vehicle_document_types where cod = 'casco' and organization_id is null;
  if v_t_rca is null or v_t_itp is null or v_t_rov is null or v_t_casco is null then
    raise exception 'PROBA: lipsesc tipurile de document rca/itp/rovinieta din seed';
  end if;

  -- VA: RCA peste 5 zile (pragurile 30, 14 și 7 deodată), ITP expirat de 3 zile.
  -- VB (fără șofer): rovinieta peste 10 zile. VOFF: RCA peste 5 zile, firmă fără flotă.
  insert into public.vehicle_documents (organization_id, vehicle_id, document_type_id, valabil_de_la, expira_la,
                                        created_by, updated_by) values
    (v_org,     v_v_a,   v_t_rca, v_azi - 360, v_azi + 5,  v_u_adm, v_u_adm),
    (v_org,     v_v_a,   v_t_itp, v_azi - 700, v_azi - 3,  v_u_adm, v_u_adm),
    (v_org,     v_v_b,   v_t_rov, v_azi - 355, v_azi + 10, v_u_adm, v_u_adm),
    (v_org_off, v_v_off, v_t_rca, v_azi - 360, v_azi + 5,  v_u_off, v_u_off);

  -- ═══ Jobul ════════════════════════════════════════════════════════════════
  v_rap := internal.conformitate_zilnica();

  -- (1)
  select count(*), min(title), min(body), min(link), min(entity_type)
    into v_n, v_titlu, v_corp, v_link, v_tip
    from public.notifications where organization_id = v_org and user_id = v_u_adm;
  if v_n = 1 and v_link = '/flota?conformitate=expira' and v_tip = 'fleet_rezumat'
     and v_titlu = 'Flota: 1 document expirat, 2 documente care expiră curând.'
     and (length(v_corp) - length(replace(v_corp, E'\n', ''))) = 2
     -- Eticheta e `expirables.label`, cu denumirea întreagă a tipului.
     and v_corp like '· Inspecție tehnică periodică (ITP)%expirat din%' then
    raise notice '  ✓ (1) administratorul primește un singur rezumat, cu 3 documente pe 2 vehicule';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) administratorul: % notificări, „%”, link %, tip %, corp: %', v_n, v_titlu, v_link, v_tip, v_corp;
  end if;

  -- (2)
  select count(*), min(title), min(link), min(entity_type), min(entity_id::text)
    into v_n, v_titlu, v_link, v_tip, v_corp
    from public.notifications where organization_id = v_org and user_id = v_u_a;
  if v_n = 1 and v_link = '/portal/masina-mea' and v_tip = 'vehicle' and v_corp = v_v_a::text
     and v_titlu = 'Flota: 1 document expirat, 1 document care expiră curând.' then
    raise notice '  ✓ (2) șoferița primește un rezumat cu documentele mașinii ei, spre portal';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) șoferița: % notificări, „%”, link %, tip %, entitate %', v_n, v_titlu, v_link, v_tip, v_corp;
  end if;

  -- (3)
  select count(*) into v_n from public.notifications
   where organization_id = v_org and user_id in (v_u_mgr, v_u_b, v_u_hr);
  if v_n = 0 then
    raise notice '  ✓ (3) managerul, colegul fără mașină și hr nu primesc nimic';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) % notificări au ajuns la cine nu avea legătură', v_n;
  end if;

  -- (4)
  select count(*) into v_n from public.notifications where organization_id = v_org;
  select count(*) into v_ca from public.compliance_alerts where organization_id = v_org;
  select count(*) into v_an from public.alert_notifications where organization_id = v_org;
  perform internal.conformitate_zilnica();
  select count(*) into v_n2 from public.notifications where organization_id = v_org;
  if v_n2 = v_n and v_n = 2
     and v_ca = (select count(*) from public.compliance_alerts where organization_id = v_org)
     and v_an = (select count(*) from public.alert_notifications where organization_id = v_org)
     and v_an > 0 then
    raise notice '  ✓ (4) a doua rulare nu dublează nimic (% alerte, % marcaje)', v_ca, v_an;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) a doua rulare: notificări % → %, alerte % → %, marcaje % → %',
      v_n, v_n2, v_ca, (select count(*) from public.compliance_alerts where organization_id = v_org),
      v_an, (select count(*) from public.alert_notifications where organization_id = v_org);
  end if;

  -- (5)
  select count(*) into v_n from public.compliance_alerts where organization_id = v_org_off;
  select count(*) into v_n2 from public.notifications where organization_id = v_org_off;
  if v_n = 0 and v_n2 = 0 then
    raise notice '  ✓ (5) firma cu flota oprită e sărită';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) firma fără flotă: % alerte, % notificări', v_n, v_n2;
  end if;

  -- (6)
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  select count(*), count(*) filter (where user_id = v_u_a) into v_n, v_n2
    from public.notifications where organization_id = v_org;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  select v_n * 100 + v_n2 * 10 + count(*) into v_n
    from public.notifications where organization_id = v_org and user_id <> v_u_adm;
  reset role;
  if v_n = 110 then
    raise notice '  ✓ (6) fiecare își vede doar notificarea lui';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) vizibilitatea notificărilor: cod % (așteptat 110)', v_n;
  end if;

  -- (7)
  if (v_rap ->> 'firme_esuate')::int = 0 and (v_rap ->> 'firme')::int >= 2 then
    raise notice '  ✓ (7) jobul a trecut pe toate firmele (%)', v_rap;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) raportul jobului: %', v_rap;
  end if;

  -- ═══ Setările ═════════════════════════════════════════════════════════════

  -- (8)
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  begin
    insert into public.fleet_settings (organization_id, responsabili, prag_salt_km, praguri_alerta_zile,
                                       created_by, updated_by)
    values (v_org, array[v_e_hr, v_e_hr], 100, array[7, 60, 20, 7], v_u_adm, v_u_adm);
    reset role;
    select ar.praguri_zile into v_praguri from public.alert_rules ar
     where ar.organization_id = v_org and ar.entity_type = 'vehicle_document' and ar.kind = '*'
       and ar.deleted_at is null and ar.valabil_de_la = v_azi;
    select array_length(responsabili, 1) into v_n from public.fleet_settings
     where organization_id = v_org and deleted_at is null;
    if v_praguri = array[60, 20, 7] and v_n = 1 then
      raise notice '  ✓ (8) administratorul scrie setările; pragurile ajung ordonate în alert_rules';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (8) praguri în alert_rules: %, responsabili: %', v_praguri, v_n;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) administratorul nu poate scrie setările: % (%)', sqlerrm, sqlstate;
  end;

  -- (9)
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  with s as (update public.fleet_settings set prag_salt_km = 9000, updated_by = v_u_mgr
              where organization_id = v_org returning 1)
  select count(*) into v_n from s;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  with s as (update public.fleet_settings set prag_salt_km = 9000, updated_by = v_u_a
              where organization_id = v_org returning 1)
  select v_n + count(*) into v_n from s;
  reset role;
  if v_n = 0 and (select prag_salt_km from public.fleet_settings where organization_id = v_org and deleted_at is null) = 100 then
    raise notice '  ✓ (9) managerul și angajata nu schimbă setările (zero rânduri)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) % rânduri schimbate de manager/angajată', v_n;
  end if;

  -- (10)
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  begin
    update public.fleet_settings set responsabili = array[v_e_strain], updated_by = v_u_adm
     where organization_id = v_org;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10) un responsabil din altă firmă a fost acceptat';
  exception when raise_exception then
    reset role;
    if sqlerrm = 'Responsabilul de flotă ales nu este angajat al organizației.' then
      raise notice '  ✓ (10) responsabilul din altă firmă e refuzat (P0001)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (10) refuzat din alt motiv: %', sqlerrm;
    end if;
  end;

  -- (11) Responsabilul e `hr` (n-are vehicles:read): alerta nouă merge la admin.
  insert into public.vehicle_documents (organization_id, vehicle_id, document_type_id, valabil_de_la, expira_la,
                                        created_by, updated_by) values
    (v_org, v_v_c, v_t_rca, v_azi - 360, v_azi + 6, v_u_adm, v_u_adm);
  select count(*) into v_n from public.notifications where organization_id = v_org and user_id = v_u_adm;
  perform internal.conformitate_zilnica();
  select count(*) into v_n2 from public.notifications where organization_id = v_org and user_id = v_u_adm;
  select count(*) into v_ca from public.notifications where organization_id = v_org and user_id = v_u_hr;
  -- Rezumatul nou nu e doar despre VC: pragurile schimbate la (8) în 60/20/7
  -- aprind praguri noi și pe documentele VA și VB, iar un prag nou trecut e o
  -- alertă nouă (ritmul memento-urilor). Se caută deci VC în CORPUL lui. Toate
  -- notificările probei au același `created_at` (o singură tranzacție), deci
  -- „cea mai nouă” nu se poate alege după oră.
  select count(*) into v_an from public.notifications n
   where n.organization_id = v_org and n.user_id = v_u_adm
     and n.body like '%' || (select v.nr_inmatriculare from public.vehicles v where v.id = v_v_c) || '%';
  v_link := format('%s cu VC în corp', v_an);
  if v_n2 = v_n + 1 and v_ca = 0 and v_an = 1 then
    raise notice '  ✓ (11) responsabilul fără acces la parc nu contează; alerta ajunge la administrator';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (11) admin % → %, hr %, link %', v_n, v_n2, v_ca, v_link;
  end if;

  -- (12) Responsabilul devine managerul.
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  update public.fleet_settings set responsabili = array[v_e_mgr], updated_by = v_u_adm
   where organization_id = v_org;
  reset role;
  insert into public.vehicle_documents (organization_id, vehicle_id, document_type_id, valabil_de_la, expira_la,
                                        created_by, updated_by) values
    (v_org, v_v_c, v_t_itp, v_azi - 700, v_azi + 4, v_u_adm, v_u_adm);
  select count(*) into v_n from public.notifications where organization_id = v_org and user_id = v_u_adm;
  perform internal.conformitate_zilnica();
  select count(*) into v_n2 from public.notifications where organization_id = v_org and user_id = v_u_adm;
  select count(*), min(link), min(body) into v_ca, v_link, v_corp
    from public.notifications where organization_id = v_org and user_id = v_u_mgr;
  -- Managerul are `vehicles:read = team`: vede VA (șoferița e în echipa lui),
  -- nu și VB/VC (fără șofer, nu sunt pool). Corpul lui nu are voie să conțină
  -- numerele lor; ITP-ul nou de pe VC, pe care nu-l vede niciun responsabil,
  -- ajunge la administrator.
  select count(*) into v_an from public.notifications n
   where n.organization_id = v_org and n.user_id = v_u_adm
     and n.body like '%(ITP) — ' || (select v.nr_inmatriculare from public.vehicles v where v.id = v_v_c) || '%';
  if v_ca = 1 and v_link = '/flota/' || v_v_a::text
     and v_corp like '%' || (select v.nr_inmatriculare from public.vehicles v where v.id = v_v_a) || '%'
     and v_corp not like '%' || (select v.nr_inmatriculare from public.vehicles v where v.id = v_v_b) || '%'
     and v_corp not like '%' || (select v.nr_inmatriculare from public.vehicles v where v.id = v_v_c) || '%'
     and v_n2 = v_n + 1 and v_an = 1 then
    raise notice '  ✓ (12) responsabilul manager primește doar vehiculele echipei; restul ajunge la administrator';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (12) admin % → % (ITP VC: %), manager % notificări, link %, corp %',
      v_n, v_n2, v_an, v_ca, v_link, v_corp;
  end if;

  -- (13) Pragul de salt din setări: 100 km. VB are 20.000 km, foaia pleacă de la 20.200.
  insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                  created_by, updated_by)
  values (v_org, v_v_b, v_e_adm, (v_zi::timestamp + interval '07:00') at time zone 'Europe/Bucharest', 20200,
          v_u_adm, v_u_adm)
  returning id into v_foaie;
  select count(*) into v_n from public.odometer_anomalies where trip_sheet_id = v_foaie and tip = 'salt';
  if v_n = 1 then
    raise notice '  ✓ (13) saltul de 200 km peste pragul firmei (100) produce anomalia';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (13) % anomalii de salt pe foaia cu 200 km peste pragul de 100', v_n;
  end if;

  -- ═══ Fluxul foii ══════════════════════════════════════════════════════════

  -- (14) Ana își face foaia, o cursă, o trimite.
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                  created_by, updated_by)
  values (v_org, v_v_a, v_e_a, (v_zi::timestamp + interval '08:00') at time zone 'Europe/Bucharest', 10000, v_u_a, v_u_a)
  returning id into v_foaie;
  insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la, de_la_loc,
                                       pana_la_loc, scop, km_plecare, km_sosire, created_by, updated_by)
  values (v_org, v_foaie, (v_zi::timestamp + interval '08:00') at time zone 'Europe/Bucharest',
          (v_zi::timestamp + interval '09:00') at time zone 'Europe/Bucharest',
          'Sediu', 'Client', 'Livrare', 10000, 10040, v_u_a, v_u_a);
  update public.trip_sheets set status = 'trimis', updated_by = v_u_a where id = v_foaie;
  reset role;
  select count(*) filter (where user_id = v_u_mgr),
         count(*) filter (where user_id = v_u_a),
         min(link) filter (where user_id = v_u_mgr)
    into v_n, v_n2, v_link
    from public.notifications where entity_type = 'trip_sheet' and entity_id = v_foaie;
  if v_n = 1 and v_n2 = 0 and v_link = '/flota/foi/' || v_foaie::text then
    raise notice '  ✓ (14) foaia trimisă ajunge la managerul șoferiței, nu și la ea';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (14) manager %, șoferiță %, link %', v_n, v_n2, v_link;
  end if;

  -- (15) Managerul o respinge.
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  update public.trip_sheets set status = 'respins', motiv_respingere = 'Lipsește bonul de la Petrom.',
                                updated_by = v_u_mgr
   where id = v_foaie;
  reset role;
  select count(*), min(title), min(body) into v_n, v_titlu, v_corp
    from public.notifications where entity_type = 'trip_sheet' and entity_id = v_foaie and user_id = v_u_a;
  if v_n = 1 and v_titlu = 'Foaia de parcurs a fost respinsă'
     and v_corp like '%a fost respinsă. Motiv: Lipsește bonul de la Petrom.' then
    raise notice '  ✓ (15) respingerea ajunge la șoferiță, cu motivul';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (15) șoferița: % notificări, „%”, corp: %', v_n, v_titlu, v_corp;
  end if;

  -- (16) Redeschide, retrimite; administratorul aprobă.
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  update public.trip_sheets set status = 'draft', updated_by = v_u_a where id = v_foaie;
  update public.trip_sheets set status = 'trimis', updated_by = v_u_a where id = v_foaie;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  update public.trip_sheets set status = 'aprobat', updated_by = v_u_adm where id = v_foaie;
  reset role;
  select count(*) filter (where user_id = v_u_mgr),
         count(*) filter (where user_id = v_u_a and title = 'Foaia de parcurs a fost aprobată'),
         count(*) filter (where user_id = v_u_adm)
    into v_n, v_n2, v_ca
    from public.notifications where entity_type = 'trip_sheet' and entity_id = v_foaie;
  if v_n = 2 and v_n2 = 1 and v_ca = 0
     and (select status from public.trip_sheets where id = v_foaie) = 'aprobat' then
    raise notice '  ✓ (16) retrimiterea ajunge iar la manager, aprobarea la șoferiță; aprobatorul nu-și scrie singur';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (16) manager %, aprobare la șoferiță %, la administrator %', v_n, v_n2, v_ca;
  end if;

  -- (17) Responsabilul devine colegul fără mașină (`employee`, vehicles:read = own).
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  update public.fleet_settings set responsabili = array[v_e_b], updated_by = v_u_adm
   where organization_id = v_org;
  reset role;
  insert into public.vehicle_documents (organization_id, vehicle_id, document_type_id, valabil_de_la, expira_la,
                                        created_by, updated_by) values
    (v_org, v_v_b, v_t_itp, v_azi - 700, v_azi + 8, v_u_adm, v_u_adm);
  select count(*) into v_n from public.notifications where organization_id = v_org and user_id = v_u_adm;
  perform internal.conformitate_zilnica();
  select count(*) into v_n2 from public.notifications where organization_id = v_org and user_id = v_u_adm;
  select count(*) into v_ca from public.notifications
   where organization_id = v_org and user_id = v_u_b and kind = 'reminder';
  select count(*) into v_an from public.notifications n
   where n.organization_id = v_org and n.user_id = v_u_adm
     and n.body like '%(ITP) — ' || (select v.nr_inmatriculare from public.vehicles v where v.id = v_v_b) || '%';
  if v_ca = 0 and v_n2 = v_n + 1 and v_an = 1 then
    raise notice '  ✓ (17) responsabilul cu own nu primește parcul pe care nu-l vede; documentul ajunge la administrator';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (17) colegul % rezumate, admin % → % (ITP VB: %)', v_ca, v_n, v_n2, v_an;
  end if;

  -- (18) VB devine mașină comună (pool): colegul cu `own` o vede.
  update public.vehicles set pool = true where id = v_v_b;
  insert into public.vehicle_documents (organization_id, vehicle_id, document_type_id, valabil_de_la, expira_la,
                                        created_by, updated_by) values
    (v_org, v_v_b, v_t_rca, v_azi - 360, v_azi + 9, v_u_adm, v_u_adm);
  select count(*) into v_n from public.notifications where organization_id = v_org and user_id = v_u_adm;
  perform internal.conformitate_zilnica();
  select count(*) into v_n2 from public.notifications where organization_id = v_org and user_id = v_u_adm;
  select count(*), min(link), min(body) into v_ca, v_link, v_corp
    from public.notifications where organization_id = v_org and user_id = v_u_b and kind = 'reminder';
  if v_ca = 1 and v_link = '/portal/masina-mea' and v_n2 = v_n
     and v_corp like '%' || (select v.nr_inmatriculare from public.vehicles v where v.id = v_v_b) || '%'
     and v_corp not like '%' || (select v.nr_inmatriculare from public.vehicles v where v.id = v_v_a) || '%'
     and v_corp not like '%' || (select v.nr_inmatriculare from public.vehicles v where v.id = v_v_c) || '%' then
    raise notice '  ✓ (18) responsabilul cu own primește mașina pool, spre portal; administratorul nu';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (18) colegul % rezumate, link %, admin % → %, corp %', v_ca, v_link, v_n, v_n2, v_corp;
  end if;

  -- (19) Responsabilii înapoi pe implicit (administratorii); CASCO pe VA (+45) și
  -- VC (+50), prinse doar de pragul de 60 de zile din (8).
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  update public.fleet_settings set responsabili = '{}', updated_by = v_u_adm
   where organization_id = v_org;
  reset role;
  insert into public.vehicle_documents (organization_id, vehicle_id, document_type_id, valabil_de_la, expira_la,
                                        created_by, updated_by) values
    (v_org, v_v_a, v_t_casco, v_azi - 300, v_azi + 45, v_u_adm, v_u_adm),
    (v_org, v_v_c, v_t_casco, v_azi - 300, v_azi + 50, v_u_adm, v_u_adm);
  select count(*) into v_n from public.notifications where organization_id = v_org and user_id = v_u_adm;
  perform internal.conformitate_zilnica();
  select count(*) into v_n2 from public.notifications where organization_id = v_org and user_id = v_u_adm;
  select n.link into v_link from public.notifications n
   where n.organization_id = v_org and n.user_id = v_u_adm and n.body like '%CASCO%'
   limit 1;
  if v_n2 = v_n + 1 and v_link = '/flota' then
    raise notice '  ✓ (19) rezumatul cu documente peste 30 de zile duce la lista întreagă';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (19) admin % → %, link %', v_n, v_n2, v_link;
  end if;

  -- (20) Setările nu mai sunt citibile de cine doar vede parcul.
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  select count(*) into v_n from public.fleet_settings where organization_id = v_org;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  select v_n + count(*) into v_n from public.fleet_settings where organization_id = v_org;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  select count(*) into v_n2 from public.fleet_settings where organization_id = v_org;
  reset role;
  if v_n = 0 and v_n2 = 1 then
    raise notice '  ✓ (20) managerul și angajata nu citesc setările flotei; administratorul da';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (20) manager+angajată citesc % rânduri (așteptat 0), administratorul % (așteptat 1)', v_n, v_n2;
  end if;

  -- (21) Calea îngustă: doar numărul, doar pentru vehiculul pe care îl vezi.
  --      Pragul firmei e 100 (8); VA/VB/VC nu au prag propriu.
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  select public.flota_prag_salt_km(v_v_a) into v_n;                        -- mașina echipei lui
  select public.flota_prag_salt_km(v_v_c) is null into v_nul_mgr;          -- nu e în echipa lui
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  select public.flota_prag_salt_km(v_v_a) into v_n2;                       -- a ei
  select public.flota_prag_salt_km(v_v_b) into v_ca;                       -- pool
  select public.flota_prag_salt_km(v_v_c) is null into v_nul_a;            -- a altcuiva
  reset role;
  if v_n = 100 and v_nul_mgr and v_n2 = 100 and v_ca = 100 and v_nul_a then
    raise notice '  ✓ (21) pragul se află prin funcția îngustă doar pentru vehiculele vizibile';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (21) manager VA=% (așteptat 100), VC null=%; șoferiță VA=% VB=% (100), VC null=%',
                  v_n, v_nul_mgr, v_n2, v_ca, v_nul_a;
  end if;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA FLOTA CONFORMITATE ZILNICĂ: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE cele 21 de verificări au trecut.';
  raise notice '';
end;
$$;
