-- tests/rls/proba-flota-bon-ocr.sql
--
-- FLOTA, DUPĂ 0213 (F12a): CUI-UL STAȚIEI ȘI PROPUNEREA CITITĂ DE PE BON.
-- Pe seed-ul real al rolurilor (0199: employee și manager au
-- `trip_sheets:update = own`, hr nimic pe flotă).
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
--  (1) employee, pe ciorna lui: INSERT cu `cui_statie`, fără propunere  [POZITIVĂ];
--  (2) employee: INSERT cu `ocr_propunere` ⇒ P0001 (doar aplicația o scrie);
--  (3) context de serviciu: propunerea de la null la valoare ⇒ 1 rând  [POZITIVĂ];
--  (4) context de serviciu: a doua scriere a propunerii ⇒ P0001;
--  (5) employee: UPDATE doar pe `cui_statie` ⇒ 1 rând                  [POZITIVĂ];
--  (6) employee: UPDATE care schimbă propunerea sau o golește ⇒ P0001;
-- (6b) employee: UPDATE null → valoare pe un rând FĂRĂ propunere ⇒ P0001
--      (PATCH-ul direct prin PostgREST din D12, prima scriere);
--  (7) `cui_statie = 'RO123'` ⇒ 23514 (`fuel_cui_statie_ck`);
--  (8) serviciu: propunere `[1,2]` sau `{}` (fără `v`) ⇒ 23514;
--  (9) manager: INSERT pe foaia LUI ⇒ 1 rând [POZITIVĂ]; pe foaia subordonatei
--      ⇒ 42501; UPDATE pe alimentarea subordonatei ⇒ 0 rânduri, NUMĂRAT;
-- (10) hr ⇒ INSERT refuzat (42501);
-- (11) super_admin (fără rând în organization_members) ⇒ INSERT refuzat
--      (42501); citirea îi e permisă (ramura `is_platform_admin`)    [POZITIVĂ];
-- (12) org_admin: ștergerea logică a unei alimentări cu propunere ⇒ 1 rând
--      (garda nu blochează ștergerea)                                 [POZITIVĂ];
-- (13) izolare: org_admin din firma B nu vede propunerea din firma A (0 rânduri).
--
-- Rânduri NUMĂRATE peste tot: un UPDATE respins de `USING` nu ridică eroare.
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
  v_u_hr      uuid := gen_random_uuid();
  v_u_sa      uuid := gen_random_uuid();
  v_e_mgr     uuid := gen_random_uuid();
  v_e_a       uuid := gen_random_uuid();
  v_v_a       uuid := gen_random_uuid();
  v_v_m       uuid := gen_random_uuid();
  v_foaie_a   uuid;
  v_foaie_m   uuid;
  v_alim_a    uuid;
  v_alim_m    uuid;
  v_alim_adm  uuid;
  v_alim_6b   uuid;
  v_n         int;
  v_text      text;
  v_esecuri   int := 0;
  v_prop      jsonb := '{"v": 1, "litri": 45.32, "cost": 312.5, "cui_statie": "14399840", "model": "proba"}';
begin
  raise notice '';
  raise notice '  PROBA „FLOTA — BONUL CITIT" (0213)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org,   'proba-ocr-' || v_sufix,   'Proba Bon SRL',
     'RO' || (83000000 + (random() * 900000)::int)::text),
    (v_org_b, 'proba-ocr-b-' || v_sufix, 'Alta Bon SRL',
     'RO' || (84000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select o, f.feature_key, true, now() from public.features f cross join unnest(array[v_org, v_org_b]) o;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_adm,   'ocr-adm-'  || v_sufix || '@proba.test', now()),
    (v_u_adm_b, 'ocr-admb-' || v_sufix || '@proba.test', now()),
    (v_u_mgr,   'ocr-mgr-'  || v_sufix || '@proba.test', now()),
    (v_u_a,     'ocr-a-'    || v_sufix || '@proba.test', now()),
    (v_u_hr,    'ocr-hr-'   || v_sufix || '@proba.test', now()),
    (v_u_sa,    'ocr-sa-'   || v_sufix || '@proba.test', now());
  insert into public.platform_admins (user_id) values (v_u_sa);
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org,   v_u_adm,   'org_admin'),
    (v_org_b, v_u_adm_b, 'org_admin'),
    (v_org,   v_u_mgr,   'manager'),
    (v_org,   v_u_a,     'employee'),
    (v_org,   v_u_hr,    'hr');

  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_mgr, v_org, 'OC-M', 'Mihai', 'Manager', app.azi_local() - 500, 'activ', v_u_mgr, null);
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_a, v_org, 'OC-A', 'Ana', 'Șofer', app.azi_local() - 400, 'activ', v_u_a, v_e_mgr);

  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent,
                               created_by, updated_by) values
    (v_v_a, v_org, 'B' || (100 + (random() * 800)::int)::text || 'OCA', 'Dacia', 'Logan',   10000, v_u_adm, v_u_adm),
    (v_v_m, v_org, 'B' || (100 + (random() * 800)::int)::text || 'OCM', 'Skoda', 'Octavia', 40000, v_u_adm, v_u_adm);
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, created_by, updated_by) values
    (v_org, v_v_a, v_e_a,   now() - interval '20 days', v_u_adm, v_u_adm),
    (v_org, v_v_m, v_e_mgr, now() - interval '20 days', v_u_adm, v_u_adm);

  -- Ciornele: a Anei și a managerului, scrise de ei.
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                  created_by, updated_by)
  values (v_org, v_v_a, v_e_a, now() - interval '3 hours', 10000, v_u_a, v_u_a)
  returning id into v_foaie_a;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                  created_by, updated_by)
  values (v_org, v_v_m, v_e_mgr, now() - interval '3 hours', 40000, v_u_mgr, v_u_mgr)
  returning id into v_foaie_m;
  reset role;

  -- ── (1) employee: INSERT cu CUI, fără propunere ─────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la,
                                     numar_bon, cui_statie, created_by, updated_by)
    values (v_org, v_foaie_a, 45.32, 312.50, now() - interval '2 hours',
            'B-0001', '14399840', v_u_a, v_u_a)
    returning id into v_alim_a;
    get diagnostics v_n = row_count;
    reset role;
    if v_n <> 1 then
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (1) FALS-NEGATIV: șoferul a inserat % rânduri, așteptat 1', v_n;
    else
      raise notice '  ✓ (1) employee adaugă alimentarea cu CUI-ul stației, pe ciorna lui (1 rând)';
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) FALS-NEGATIV: % (%)', sqlerrm, sqlstate;
  end;

  -- ── (2) employee: INSERT cu propunere ⇒ P0001 ───────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la,
                                     numar_bon, ocr_propunere, created_by, updated_by)
    values (v_org, v_foaie_a, 10, 70, now() - interval '2 hours', 'B-0002', v_prop, v_u_a, v_u_a);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) FALS-POZITIV: șoferul și-a scris singur propunerea';
  exception when raise_exception then
    reset role;
    if sqlerrm like '%o scrie doar aplicația%' then
      raise notice '  ✓ (2) employee: INSERT cu propunere refuzat (P0001)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (2) P0001 cu alt mesaj: %', sqlerrm;
    end if;
  end;

  -- ── (3) serviciu: propunerea de la null la valoare ──────────────────────
  set local role service_role;
  begin
    update public.fuel_entries set ocr_propunere = v_prop, updated_by = v_u_a
     where id = v_alim_a and organization_id = v_org and ocr_propunere is null;
    get diagnostics v_n = row_count;
    reset role;
    if v_n <> 1 then
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (3) FALS-NEGATIV: serviciul a scris propunerea pe % rânduri, așteptat 1', v_n;
    else
      raise notice '  ✓ (3) contextul de serviciu scrie propunerea o dată (1 rând)';
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) FALS-NEGATIV la scrierea de serviciu: % (%)', sqlerrm, sqlstate;
  end;

  -- ── (4) serviciu: a doua scriere ⇒ P0001 ────────────────────────────────
  set local role service_role;
  begin
    update public.fuel_entries set ocr_propunere = v_prop || '{"litri": 54.32}'::jsonb
     where id = v_alim_a;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) FALS-POZITIV: propunerea s-a rescris după salvare';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (4) a doua scriere a propunerii, chiar din serviciu: refuzată (P0001)';
  end;

  -- ── (5) employee: UPDATE doar pe cui_statie ─────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.fuel_entries set cui_statie = '5022670', updated_by = v_u_a
     where id = v_alim_a;
    get diagnostics v_n = row_count;
    reset role;
    if v_n <> 1 then
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (5) FALS-NEGATIV: corectura CUI-ului a atins % rânduri', v_n;
    else
      raise notice '  ✓ (5) employee corectează CUI-ul pe alimentarea cu propunere (1 rând)';
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) FALS-NEGATIV: % (%)', sqlerrm, sqlstate;
  end;

  -- ── (6) employee: schimbă sau golește propunerea ⇒ P0001 ────────────────
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.fuel_entries set ocr_propunere = v_prop || '{"litri": 54.32}'::jsonb,
                                   updated_by = v_u_a
     where id = v_alim_a;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) FALS-POZITIV: șoferul a rescris propunerea';
  exception when raise_exception then
    reset role;
  end;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.fuel_entries set ocr_propunere = null, updated_by = v_u_a where id = v_alim_a;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) FALS-POZITIV: șoferul a șters propunerea';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (6) employee nu rescrie și nu golește propunerea (P0001)';
  end;
  select ocr_propunere ->> 'litri' into v_text from public.fuel_entries where id = v_alim_a;
  if v_text is distinct from '45.32' then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) propunerea s-a schimbat totuși: litri = %', v_text;
  end if;

  -- ── (6b) employee: UPDATE null → valoare pe o alimentare FĂRĂ propunere ⇒ P0001 ──
  -- Atacul din F12a D12: grantul de update e pe tot tabelul, deci un PATCH
  -- direct prin PostgREST pe un rând necitit ar pune o propunere inventată.
  -- (6) prinde doar rescrierea unei propuneri existente; aici e prima scriere.
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la,
                                   created_by, updated_by)
  values (v_org, v_foaie_a, 12, 90, now() - interval '1 hour', v_u_a, v_u_a)
  returning id into v_alim_6b;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.fuel_entries set ocr_propunere = v_prop, updated_by = v_u_a
     where id = v_alim_6b;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6b) FALS-POZITIV: șoferul și-a pus singur propunerea pe un rând necitit';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (6b) employee nu pune propunerea pe un rând necitit, prin UPDATE (P0001)';
  end;
  select ocr_propunere::text into v_text from public.fuel_entries where id = v_alim_6b;
  if v_text is not null then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6b) propunerea a ajuns totuși în rând: %', v_text;
  end if;

  -- ── (7) forma CUI-ului ⇒ 23514 ──────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la,
                                     cui_statie, created_by, updated_by)
    values (v_org, v_foaie_a, 10, 70, now() - interval '2 hours', 'RO123', v_u_a, v_u_a);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) CUI-ul „RO123” a trecut de fuel_cui_statie_ck';
  exception when check_violation then
    reset role;
    raise notice '  ✓ (7) CUI-ul cu prefix în bază: refuzat (23514)';
  end;

  -- ── (8) forma propunerii ⇒ 23514 ────────────────────────────────────────
  set local role service_role;
  begin
    insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la,
                                     ocr_propunere, created_by, updated_by)
    values (v_org, v_foaie_a, 10, 70, now() - interval '2 hours', '[1,2]', v_u_a, v_u_a);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) o propunere-listă a trecut de fuel_ocr_propunere_ck';
  exception when check_violation then
    reset role;
  end;
  set local role service_role;
  begin
    insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la,
                                     ocr_propunere, created_by, updated_by)
    values (v_org, v_foaie_a, 10, 70, now() - interval '2 hours', '{}', v_u_a, v_u_a);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) o propunere fără `v` a trecut de fuel_ocr_propunere_ck';
  exception when check_violation then
    reset role;
    raise notice '  ✓ (8) propunerea care nu e obiect cu `v`: refuzată (23514)';
  end;

  -- ── (9) manager: foaia lui da, a subordonatei nu ────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la,
                                     cui_statie, created_by, updated_by)
    values (v_org, v_foaie_m, 40, 290, now() - interval '2 hours', '13548146', v_u_mgr, v_u_mgr)
    returning id into v_alim_m;
    get diagnostics v_n = row_count;
    reset role;
    if v_n <> 1 then
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (9) FALS-NEGATIV: managerul a inserat % rânduri pe foaia lui', v_n;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) FALS-NEGATIV: managerul nu-și adaugă alimentarea: % (%)', sqlerrm, sqlstate;
  end;
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la,
                                     cui_statie, created_by, updated_by)
    values (v_org, v_foaie_a, 5, 35, now() - interval '2 hours', '14399840', v_u_mgr, v_u_mgr);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) FALS-POZITIV: managerul a scris pe foaia subordonatei';
  exception when insufficient_privilege then
    reset role;
  end;
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  update public.fuel_entries set cui_statie = '19', updated_by = v_u_mgr where id = v_alim_a;
  get diagnostics v_n = row_count;
  reset role;
  if v_n <> 0 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) FALS-POZITIV: managerul a modificat % alimentări ale subordonatei', v_n;
  else
    raise notice '  ✓ (9) manager: alimentare pe foaia lui (1 rând); pe a subordonatei 42501 la INSERT, 0 rânduri la UPDATE';
  end if;

  -- ── (10) hr ⇒ 42501 ─────────────────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  begin
    insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la,
                                     cui_statie, created_by, updated_by)
    values (v_org, v_foaie_a, 5, 35, now() - interval '2 hours', '14399840', v_u_hr, v_u_hr);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10) FALS-POZITIV: hr a adăugat o alimentare';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (10) hr nu adaugă alimentări (42501)';
  end;

  -- ── (11) super_admin: scrierea refuzată, citirea permisă ────────────────
  perform set_config('request.jwt.claim.sub', v_u_sa::text, true);
  set local role authenticated;
  begin
    insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la,
                                     cui_statie, created_by, updated_by)
    values (v_org, v_foaie_a, 5, 35, now() - interval '2 hours', '14399840', v_u_sa, v_u_sa);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (11) FALS-POZITIV: super_admin a scris o alimentare în firma-client';
  exception when insufficient_privilege then
    reset role;
  end;
  perform set_config('request.jwt.claim.sub', v_u_sa::text, true);
  set local role authenticated;
  select count(*) into v_n from public.fuel_entries
   where id = v_alim_a and ocr_propunere is not null;
  reset role;
  if v_n <> 1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (11) FALS-NEGATIV: super_admin vede % alimentări cu propunere, așteptat 1', v_n;
  else
    raise notice '  ✓ (11) super_admin: INSERT refuzat (42501), citirea permisă (1 rând)';
  end if;

  -- ── (12) org_admin: ștergerea logică trece de gardă ─────────────────────
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la,
                                   numar_bon, cui_statie, created_by, updated_by)
  values (v_org, v_foaie_a, 20, 140, now() - interval '1 hour', 'B-0003', '14399840', v_u_adm, v_u_adm)
  returning id into v_alim_adm;
  reset role;
  set local role service_role;
  update public.fuel_entries set ocr_propunere = v_prop where id = v_alim_adm and ocr_propunere is null;
  get diagnostics v_n = row_count;
  reset role;
  if v_n <> 1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (12) pregătirea: propunerea de serviciu pe % rânduri', v_n;
  end if;
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  begin
    update public.fuel_entries set deleted_at = now(), updated_by = v_u_adm where id = v_alim_adm;
    get diagnostics v_n = row_count;
    reset role;
    if v_n <> 1 then
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (12) FALS-NEGATIV: ștergerea logică a atins % rânduri', v_n;
    else
      raise notice '  ✓ (12) org_admin șterge logic o alimentare cu propunere (1 rând)';
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (12) FALS-NEGATIV: garda blochează ștergerea: % (%)', sqlerrm, sqlstate;
  end;

  -- ── (13) izolare: firma B nu vede propunerea din A ──────────────────────
  perform set_config('request.jwt.claim.sub', v_u_adm_b::text, true);
  set local role authenticated;
  select count(*) into v_n from public.fuel_entries where organization_id = v_org;
  reset role;
  if v_n <> 0 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (13) IZOLARE: org_admin din B vede % alimentări din A', v_n;
  else
    raise notice '  ✓ (13) org_admin din altă firmă nu vede nimic (0 rânduri)';
  end if;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA FLOTA BON CITIT: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE cele 14 verificări au trecut.';
  raise notice '';
end;
$$;
