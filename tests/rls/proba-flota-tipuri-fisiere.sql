-- tests/rls/proba-flota-tipuri-fisiere.sql
--
-- FLOTA, DUPĂ 0199: TIPURILE DE DOCUMENT ACTIVATE PER FIRMĂ, APLICABILITATEA
-- PE CATEGORIE ȘI FIȘIERELE (SCANAREA DOCUMENTULUI, POZA BONULUI).
-- Pe seed-ul real al rolurilor.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- Tipurile per firmă:
--  (1) un tip de platformă retras (ADR, 0116) e refuzat firmei fără setare (P0001);
--  (2) org_admin îl activează pentru firma lui, iar documentul trece  [POZITIVĂ];
--  (3) cealaltă firmă rămâne pe valoarea platformei: ADR refuzat;
--  (4) org_admin retrage CASCO doar pentru firma lui: document nou refuzat,
--      dar documentul CASCO existent se corectează în continuare     [POZITIVĂ];
--  (5) setarea pe un tip PROPRIU firmei e refuzată (P0001);
--  (6) un tip dezactivat nu rămâne „obligatoriu” (triggerul îl stinge);
--  (7) manager, hr și employee nu scriu setări (42501); employee le citește,
--      hr nu (n-are vehicles:*), administratorul altei firme nu le vede;
--  (8) seed-ul: rovinieta până la 3.500 kg, trusa și stingătorul fără remorci.
-- Căile pe rând:
--  (9) scanarea în folderul vehiculului trece [POZITIVĂ]; în al altui vehicul
--      sau cu `..` e refuzată (P0001);
-- (10) poza bonului în folderul foii trece, pentru șofer pe ciorna lui
--      [POZITIVĂ]; în folderul altei foi e refuzată (P0001).
-- Bucketul `org-flota`:
-- (11) org_admin urcă scanarea unui vehicul [POZITIVĂ]; angajatul nu;
-- (12) șoferul urcă bonul pe ciorna lui [POZITIVĂ]; nu pe foaia colegului și
--      nu pe o foaie trimisă; administratorul altei firme nu urcă nimic aici;
-- (13) citirea: șoferul vede scanarea mașinii lui [POZITIVĂ], colegul fără
--      mașină și hr nu; managerul vede bonul foii subordonatei   [POZITIVĂ].
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix     text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org       uuid := gen_random_uuid();
  v_org_b     uuid := gen_random_uuid();
  v_u_adm     uuid := gen_random_uuid();
  v_u_adm_b   uuid := gen_random_uuid();
  v_u_mgr     uuid := gen_random_uuid();
  v_u_a       uuid := gen_random_uuid();
  v_u_b       uuid := gen_random_uuid();
  v_u_hr      uuid := gen_random_uuid();
  v_e_mgr     uuid := gen_random_uuid();
  v_e_a       uuid := gen_random_uuid();
  v_e_b       uuid := gen_random_uuid();
  v_v_a       uuid := gen_random_uuid();
  v_v_b       uuid := gen_random_uuid();
  v_v_b2      uuid := gen_random_uuid();   -- vehiculul firmei B
  v_foaie_a   uuid;
  v_foaie_b   uuid;
  v_alim_a    uuid;
  v_t_adr     uuid;
  v_t_casco   uuid;
  v_t_propriu uuid := gen_random_uuid();
  v_doc_casco uuid;
  v_setare    uuid;
  v_n         int;
  v_bool      boolean;
  v_esecuri   int := 0;
begin
  raise notice '';
  raise notice '  PROBA „FLOTA — TIPURI ȘI FIȘIERE" (0199)';
  raise notice '  ─────────────────────────────────────────────────────────';

  select id into v_t_adr from public.vehicle_document_types
   where organization_id is null and deleted_at is null and cod = 'adr';
  select id into v_t_casco from public.vehicle_document_types
   where organization_id is null and deleted_at is null and cod = 'casco';

  insert into public.organizations (id, slug, name, cui) values
    (v_org,   'proba-tip-' || v_sufix,   'Proba Tipuri SRL',
     'RO' || (82000000 + (random() * 900000)::int)::text),
    (v_org_b, 'proba-tip-b-' || v_sufix, 'Alta Tipuri SRL',
     'RO' || (81000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select o, f.feature_key, true, now() from public.features f cross join unnest(array[v_org, v_org_b]) o;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_adm,   'tip-adm-'  || v_sufix || '@proba.test', now()),
    (v_u_adm_b, 'tip-admb-' || v_sufix || '@proba.test', now()),
    (v_u_mgr,   'tip-mgr-'  || v_sufix || '@proba.test', now()),
    (v_u_a,     'tip-a-'    || v_sufix || '@proba.test', now()),
    (v_u_b,     'tip-b-'    || v_sufix || '@proba.test', now()),
    (v_u_hr,    'tip-hr-'   || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org,   v_u_adm,   'org_admin'),
    (v_org_b, v_u_adm_b, 'org_admin'),
    (v_org,   v_u_mgr,   'manager'),
    (v_org,   v_u_a,     'employee'),
    (v_org,   v_u_b,     'employee'),
    (v_org,   v_u_hr,    'hr');

  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_mgr, v_org, 'TP-M', 'Mihai', 'Manager', app.azi_local() - 500, 'activ', v_u_mgr, null);
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_a, v_org, 'TP-A', 'Ana',    'Șofer', app.azi_local() - 400, 'activ', v_u_a, v_e_mgr),
    (v_e_b, v_org, 'TP-B', 'Bogdan', 'Șofer', app.azi_local() - 400, 'activ', v_u_b, v_e_mgr);

  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent,
                               created_by, updated_by) values
    (v_v_a,  v_org,   'B' || (100 + (random() * 800)::int)::text || 'TPA', 'Dacia', 'Logan',  10000, v_u_adm, v_u_adm),
    (v_v_b,  v_org,   'B' || (100 + (random() * 800)::int)::text || 'TPB', 'Dacia', 'Duster', 20000, v_u_adm, v_u_adm),
    (v_v_b2, v_org_b, 'B' || (100 + (random() * 800)::int)::text || 'TPX', 'Ford',  'Focus',  30000, v_u_adm_b, v_u_adm_b);
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, created_by, updated_by) values
    (v_org, v_v_a, v_e_a, now() - interval '20 days', v_u_adm, v_u_adm),
    (v_org, v_v_b, v_e_b, now() - interval '20 days', v_u_adm, v_u_adm);

  insert into public.vehicle_document_types (id, organization_id, cod, denumire, created_by, updated_by)
  values (v_t_propriu, v_org, 'autorizatie_locala', 'Autorizație locală', v_u_adm, v_u_adm);

  -- Documentul CASCO existent, ÎNAINTEA retragerii tipului pentru firmă.
  insert into public.vehicle_documents (organization_id, vehicle_id, document_type_id, emitent,
                                        valabil_de_la, expira_la, created_by, updated_by)
  values (v_org, v_v_a, v_t_casco, 'Asigurător', current_date - 10, current_date + 300, v_u_adm, v_u_adm)
  returning id into v_doc_casco;

  -- Foile: ciorna Anei (pe mașina ei) și o foaie a lui Bogdan, scrise de șoferi.
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                  created_by, updated_by)
  values (v_org, v_v_a, v_e_a, now() - interval '3 hours', 10000, v_u_a, v_u_a)
  returning id into v_foaie_a;
  insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la,
                                   created_by, updated_by)
  values (v_org, v_foaie_a, 30, 210, now() - interval '2 hours', v_u_a, v_u_a)
  returning id into v_alim_a;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_b::text, true);
  set local role authenticated;
  insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                  created_by, updated_by)
  values (v_org, v_v_b, v_e_b, now() - interval '3 hours', 20000, v_u_b, v_u_b)
  returning id into v_foaie_b;
  reset role;

  -- ── (1) ADR, retras din 0116, fără setare ───────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_documents (organization_id, vehicle_id, document_type_id, expira_la,
                                          created_by, updated_by)
    values (v_org, v_v_a, v_t_adr, current_date + 100, v_u_adm, v_u_adm);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) un document ADR a trecut fără ca firma să fi activat tipul';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (1) ADR fără setare: refuzat (P0001)';
  end;

  -- ── (2) firma activează ADR, apoi documentul trece ──────────────────────
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_document_type_setari (organization_id, document_type_id, activ, obligatoriu)
    values (v_org, v_t_adr, true, true);
    insert into public.vehicle_documents (organization_id, vehicle_id, document_type_id, expira_la,
                                          created_by, updated_by)
    values (v_org, v_v_a, v_t_adr, current_date + 100, v_u_adm, v_u_adm);
    reset role;
    raise notice '  ✓ (2) org_admin activează ADR pentru firmă, iar documentul ADR trece';
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) FALS-NEGATIV la activarea ADR: % (%)', sqlerrm, sqlstate;
  end;

  -- ── (3) cealaltă firmă rămâne fără ADR ──────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_adm_b::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_documents (organization_id, vehicle_id, document_type_id, expira_la,
                                          created_by, updated_by)
    values (v_org_b, v_v_b2, v_t_adr, current_date + 100, v_u_adm_b, v_u_adm_b);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) activarea firmei A a deschis ADR și firmei B';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (3) firma B rămâne fără ADR';
  end;

  -- ── (4) CASCO retras doar pentru firmă ──────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  insert into public.vehicle_document_type_setari (organization_id, document_type_id, activ, obligatoriu)
  values (v_org, v_t_casco, false, false);
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_documents (organization_id, vehicle_id, document_type_id, expira_la,
                                          created_by, updated_by)
    values (v_org, v_v_b, v_t_casco, current_date + 100, v_u_adm, v_u_adm);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) un CASCO nou a trecut după retragerea tipului pentru firmă';
  exception when raise_exception then
    reset role;
  end;
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  with corectate as (
    update public.vehicle_documents set emitent = 'Asigurător corectat', updated_by = v_u_adm
     where id = v_doc_casco returning 1
  ) select count(*) into v_n from corectate;
  reset role;
  if v_n = 1 then
    raise notice '  ✓ (4) CASCO retras pentru firmă: nou refuzat, cel existent se corectează';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) documentul CASCO existent nu s-a mai putut corecta (% rânduri)', v_n;
  end if;
  -- Setarea celeilalte firme rămâne neatinsă: B poate înregistra CASCO.
  perform set_config('request.jwt.claim.sub', v_u_adm_b::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_documents (organization_id, vehicle_id, document_type_id, expira_la,
                                          created_by, updated_by)
    values (v_org_b, v_v_b2, v_t_casco, current_date + 100, v_u_adm_b, v_u_adm_b);
    reset role;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) retragerea CASCO la firma A a blocat-o și la B: % (%)', sqlerrm, sqlstate;
  end;

  -- ── (5) setare pe un tip propriu ────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_document_type_setari (organization_id, document_type_id, activ, obligatoriu)
    values (v_org, v_t_propriu, true, true);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) o setare pe un tip propriu a fost acceptată';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (5) setarea pe tipul propriu e refuzată (P0001)';
  end;

  -- ── (6) dezactivat ⇒ neobligatoriu ──────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  with schimbate as (
    update public.vehicle_document_type_setari set activ = false, obligatoriu = true
     where organization_id = v_org and document_type_id = v_t_adr
    returning obligatoriu
  ) select count(*), bool_or(obligatoriu) into v_n, v_bool from schimbate;
  reset role;
  if v_n = 1 and not v_bool then
    raise notice '  ✓ (6) tipul dezactivat nu rămâne obligatoriu';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) dezactivarea: % rânduri, obligatoriu = %', v_n, v_bool;
  end if;

  -- ── (7) cine scrie și cine citește setările ─────────────────────────────
  -- manager
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_document_type_setari (organization_id, document_type_id, activ, obligatoriu)
    values (v_org, (select id from public.vehicle_document_types where cod = 'tahograf' and organization_id is null), true, false);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) FALS-POZITIV: managerul a scris o setare de tip';
  exception when insufficient_privilege then
    reset role;
  end;
  -- hr
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_document_type_setari (organization_id, document_type_id, activ, obligatoriu)
    values (v_org, (select id from public.vehicle_document_types where cod = 'tahograf' and organization_id is null), true, false);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) FALS-POZITIV: hr a scris o setare de tip';
  exception when insufficient_privilege then
    reset role;
  end;
  -- employee: nu scrie (UPDATE pe rând existent → zero rânduri), dar citește.
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  with schimbate as (
    update public.vehicle_document_type_setari set activ = true where organization_id = v_org returning 1
  ) select count(*) into v_n from schimbate;
  select v_n * 10 + count(*) into v_n from public.vehicle_document_type_setari where organization_id = v_org;
  reset role;
  if v_n <> 2 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) employee: scrise×10+citite = %, așteptat 2', v_n;
  end if;
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  select count(*) into v_n from public.vehicle_document_type_setari where organization_id = v_org;
  reset role;
  if v_n <> 0 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) hr vede % setări de tip, deși n-are vehicles:*', v_n;
  end if;
  perform set_config('request.jwt.claim.sub', v_u_adm_b::text, true);
  set local role authenticated;
  select count(*) into v_n from public.vehicle_document_type_setari where organization_id = v_org;
  reset role;
  if v_n <> 0 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) administratorul firmei B vede % setări ale firmei A', v_n;
  else
    raise notice '  ✓ (7) setările: doar org_admin le scrie; employee le citește; hr și firma B nu le văd';
  end if;

  -- ── (8) seed-ul de aplicabilitate ───────────────────────────────────────
  if exists (select 1 from public.vehicle_document_types
              where organization_id is null and cod = 'rovinieta' and masa_max_kg = 3500)
     and not exists (select 1 from public.vehicle_document_types
                      where organization_id is null and cod in ('trusa_medicala', 'extinctor')
                        and ('remorca' = any (coalesce(categorii_aplicabile, enum_range(null::public.vehicle_category)))
                             or 'semiremorca' = any (coalesce(categorii_aplicabile, enum_range(null::public.vehicle_category))))) then
    raise notice '  ✓ (8) rovinieta până la 3.500 kg; trusa și stingătorul fără remorci';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) seed-ul de aplicabilitate lipsește';
  end if;

  -- ── (9) calea scanării pe rând ──────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  with schimbate as (
    update public.vehicle_documents
       set fisier_path = v_org::text || '/vehicles/' || v_v_a::text || '/' || gen_random_uuid()::text || '-polita.pdf',
           fisier_nume = 'polita.pdf', updated_by = v_u_adm
     where id = v_doc_casco returning 1
  ) select count(*) into v_n from schimbate;
  reset role;
  if v_n <> 1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) FALS-NEGATIV: scanarea în folderul vehiculului n-a trecut (% rânduri)', v_n;
  end if;
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  begin
    update public.vehicle_documents
       set fisier_path = v_org::text || '/vehicles/' || v_v_b::text || '/x-polita.pdf', updated_by = v_u_adm
     where id = v_doc_casco;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) scanarea a fost legată de folderul altui vehicul';
  exception when raise_exception then
    reset role;
  end;
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  begin
    update public.vehicle_documents
       set fisier_path = v_org::text || '/vehicles/' || v_v_a::text || '/../' || v_v_b::text || '/x.pdf', updated_by = v_u_adm
     where id = v_doc_casco;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) o cale cu „..” a fost acceptată';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (9) scanarea stă doar în folderul vehiculului ei';
  end;

  -- ── (10) calea bonului pe alimentare ────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  with schimbate as (
    update public.fuel_entries
       set fisier_bon_path = v_org::text || '/trip_sheets/' || v_foaie_a::text || '/' || gen_random_uuid()::text || '-bon.jpg',
           updated_by = v_u_a
     where id = v_alim_a returning 1
  ) select count(*) into v_n from schimbate;
  reset role;
  if v_n <> 1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10) FALS-NEGATIV: șoferița nu-și poate atașa bonul (% rânduri)', v_n;
  end if;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.fuel_entries
       set fisier_bon_path = v_org::text || '/trip_sheets/' || v_foaie_b::text || '/x-bon.jpg', updated_by = v_u_a
     where id = v_alim_a;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10) bonul a fost legat de folderul altei foi';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (10) poza bonului stă doar în folderul foii ei';
  end;

  -- ── (11) bucketul: scanarea vehiculului ─────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('org-flota', v_org::text || '/vehicles/' || v_v_a::text || '/s1-itp.pdf', v_u_adm);
    reset role;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (11) FALS-NEGATIV: org_admin nu urcă scanarea: % (%)', sqlerrm, sqlstate;
  end;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('org-flota', v_org::text || '/vehicles/' || v_v_a::text || '/s2-itp.pdf', v_u_a);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (11) FALS-POZITIV: angajata a urcat o scanare de document de vehicul';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (11) scanarea o urcă org_admin, nu angajatul';
  end;

  -- ── (12) bucketul: poza bonului ─────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('org-flota', v_org::text || '/trip_sheets/' || v_foaie_a::text || '/b1-bon.jpg', v_u_a);
    reset role;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (12) FALS-NEGATIV: șoferița nu urcă bonul pe ciorna ei: % (%)', sqlerrm, sqlstate;
  end;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('org-flota', v_org::text || '/trip_sheets/' || v_foaie_b::text || '/b2-bon.jpg', v_u_a);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (12) FALS-POZITIV: șoferița a urcat un bon pe foaia colegului';
  exception when insufficient_privilege then
    reset role;
  end;
  perform set_config('request.jwt.claim.sub', v_u_adm_b::text, true);
  set local role authenticated;
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('org-flota', v_org::text || '/vehicles/' || v_v_a::text || '/x-itp.pdf', v_u_adm_b);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (12) IZOLARE: administratorul firmei B a urcat în folderul firmei A';
  exception when insufficient_privilege then
    reset role;
  end;
  -- Foaia trimisă: bonul nu se mai atașează.
  -- Bogdan își trimite foaia, cu cursa zilei (0197 cere sosirea).
  perform set_config('request.jwt.claim.sub', v_u_b::text, true);
  set local role authenticated;
  insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la,
                                       de_la_loc, pana_la_loc, scop, km_plecare, km_sosire,
                                       created_by, updated_by)
  values (v_org, v_foaie_b, now() - interval '3 hours', now() - interval '2 hours',
          'Sediu', 'Client', 'Livrare', 20000, 20040, v_u_b, v_u_b);
  update public.trip_sheets set status = 'trimis', updated_by = v_u_b where id = v_foaie_b;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_b::text, true);
  set local role authenticated;
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('org-flota', v_org::text || '/trip_sheets/' || v_foaie_b::text || '/b3-bon.jpg', v_u_b);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (12) bonul s-a urcat pe o foaie trimisă';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (12) bonul: șoferul pe ciorna lui, nu pe foaia altuia, nu pe una trimisă, nu din altă firmă';
  end;

  -- ── (13) citirea din bucket ─────────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  select count(*) into v_n from storage.objects
   where bucket_id = 'org-flota' and name like v_org::text || '/vehicles/' || v_v_a::text || '/%';
  reset role;
  if v_n <> 1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (13) FALS-NEGATIV: șoferița vede % scanări ale mașinii ei, așteptat 1', v_n;
  end if;
  perform set_config('request.jwt.claim.sub', v_u_b::text, true);
  set local role authenticated;
  select count(*) into v_n from storage.objects
   where bucket_id = 'org-flota' and name like v_org::text || '/vehicles/' || v_v_a::text || '/%';
  reset role;
  if v_n <> 0 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (13) colegul vede % scanări ale mașinii altcuiva', v_n;
  end if;
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  select count(*) into v_n from storage.objects where bucket_id = 'org-flota';
  reset role;
  if v_n <> 0 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (13) hr vede % fișiere de flotă', v_n;
  end if;
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  select count(*) into v_n from storage.objects
   where bucket_id = 'org-flota' and name like v_org::text || '/trip_sheets/' || v_foaie_a::text || '/%';
  reset role;
  if v_n <> 1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (13) FALS-NEGATIV: managerul vede % bonuri pe foaia subordonatei, așteptat 1', v_n;
  else
    raise notice '  ✓ (13) citirea: șoferul și managerul văd ce le aparține; colegul și hr nu';
  end if;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA FLOTA TIPURI ȘI FIȘIERE: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE cele 13 verificări au trecut.';
  raise notice '';
end;
$$;
