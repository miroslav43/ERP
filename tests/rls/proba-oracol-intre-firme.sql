-- tests/rls/proba-oracol-intre-firme.sql
--
-- ORACOLUL DE EXISTENȚĂ ÎNTRE FIRME (Y2), cu mesajele comparate pe bancul local.
--
-- Clasa: un trigger BEFORE ROW rulează ÎNAINTEA politicii de scriere (WITH
-- CHECK se judecă pe rândul de DUPĂ triggere). Un trigger SECURITY DEFINER care
-- caută un rând în firma lui `new.organization_id` și răspunde altfel când îl
-- găsește („există, deci treci, apoi 42501 de la politică”) decât când nu-l
-- găsește (P0001 „nu există”) îi spune unui utilizator al firmei A dacă un id
-- există în firma B. A doua formă: perechea de mesaje „nu există” / „aparține
-- altei organizații” pe un rând pus în firma PROPRIE cu id-ul altei firme.
--
-- Fiecare verificare rulează DOUĂ scrieri ca org_admin al firmei A: una cu un id
-- care există în firma B, una cu un id inexistent. Răspunsurile (cod și mesaj)
-- trebuie să fie IDENTICE și să fie refuzul așteptat (42501 neutru pentru rândul
-- pus pe firma B, P0001-ul unic pentru perechi): altfel egalitatea ar putea
-- trece pentru alt motiv decât cel probat. Pe baza de dinainte (vârful ramurii
-- de livrare, 9224f864) toate verificările (g) și (h) PICĂ; trec după reparațiile
-- pe loc din 0200–0216/0225 și după 0233. Verificările adăugate de revizie
-- (g26–g28, n1–n14, h5–h8) PICĂ pe 97135f20 (21 din 21) și trec după
-- `coalesce` în gărzi și după §8–§10 din 0233.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- (g) Rândul pus pe firma B: id existent acolo și id inexistent → același 42501
--  g1  fuel_entries.trip_sheet_id            (alimentari_inainte, 0200)
--  g2  trip_sheet_curse.trip_sheet_id        (curse_inainte, 0200)
--  g3  fleet_settings.responsabili           (fleet_settings_inainte, 0201)
--  g4  vehicle_documents.vehicle_id          (vdoc_inainte, 0202)
--  g5  vehicle_service_plans.vehicle_id      (vsp_inainte, 0203)
--  g6  vehicle_service_entries.vehicle_id    (vse_inainte, 0203)
--  g7  vehicle_expenses.vehicle_id           (vex_inainte, 0203)
--  g8  vehicle_fiscal_regimes.vehicle_id     (flota_fiscal_inainte, 0205; spunea
--      masa și locurile vehiculului firmei B)
--  g9  vehicle_consumption_norms.vehicle_id  (flota_fiscal_inainte, 0205)
--  g10 maintenance_interventions: firma B și o firmă inexistentă
--      (maintenance_interventions_numar, 0210; registrul firmei B se atingea)
--  g11 maintenance_intervention_parts.intervention_id (…_parts_garda, 0210)
--  g12 fault_reports.equipment_id            (fault_reports_garda, 0181 → 0233)
--  g13 fault_reports.atribuit_employee_id    (fault_reports_garda + …_tehnician_cu_drept, 0212)
--  g14 fuel_cards.vehicle_id                 (carduri_inainte, 0214)
--  g15 fuel_card_transactions.import_id      (tranzactii_card_inainte, 0214)
--  g16 vehicle_handovers.alocare_primita_id  (pv_vehicul_inainte, 0215)
--  g17 vehicle_reservations.vehicle_id       (rezervari_inainte, 0216)
--  g18 vehicle_assignments.vehicle_id        (alocari_inainte, 0173 → 0233, și
--      alocari_rezervari, 0216; spunea ziua rezervării firmei B)
--  g19 vehicle_costuri.vehicle_id            (vc_inainte, 0225)
--  g20 vehicle_document_costuri.document_id  (vdc_inainte, 0225)
--  g21 leave_requests.leave_type_id          (leave_requests_pregateste, 0112 → 0233)
--  g22 departments.parent_id                 (tg_departments_path, 0004 → 0233)
--  g23 departments.manager_employee_id       (departament_sef_in_firma, 0152 → 0233)
--  g24 tickets.inventory_item_id             (tickets_valideaza_inventarul, 0134 → 0233)
--  g25 inventory_items.import_batch_id       (inventory_items_lot_propriu, 0016 → 0233)
--  g26 employment_contracts.employee_id      (tg_contracts_validari, 0004 → 0233)
--  g27 inventory_allocations.item_id         (inventory_alloc_valideaza, 0010 → 0233)
--  g28 business_trip_legs.business_trip_id   (valideaza_etapa_deplasare, 0015 → 0233)
-- (n) Rândul FĂRĂ firmă (`organization_id` null): id existent în B și inexistent
--     → același 42501. `null = any(...)` e NULL, iar `not NULL` nu ridică: garda
--     scrisă `not (org = any(...))` lăsa rândul să treacă, căutările fără filtru
--     de firmă găseau id-ul firmei B, iar NOT NULL se judecă abia DUPĂ WITH CHECK.
--  n1  vehicle_documents.vehicle_id   n2  vehicle_assignments.vehicle_id
--  n3  fuel_entries.trip_sheet_id     n4  trip_sheet_curse.trip_sheet_id
--  n5  vehicle_fiscal_regimes (spunea masa și locurile)   n6  vehicle_consumption_norms
--  n7  vehicle_reservations           n8  vehicle_fines (0206, X2)
--  n9  vehicle_incidents (0206, X2)   n10 trip_sheets.vehicle_id (0200, X2)
--  n11 vehicle_handovers.alocare_primita_id               n12 employment_contracts
--  n13 business_trip_legs (spunea intervalul deplasării)  n14 inventory_allocations
--  n15 vehicle_exits (control: garda compusă din 0218 ridica deja)
-- (h) Rândul pus în firma A cu id-ul firmei B și cu un id inexistent → același P0001
--  h1  tipul de concediu        h2  departamentul superior
--  h3  obiectul de inventar     h4  lotul de import
--  h5  angajatul contractului   h6  obiectul predat     h7  angajatul predării
--  h8  deplasarea etapei
-- (c) Controale care treceau și înainte (nu sunt oracol): același răspuns
--  c1  reges_read_credentiale  c2  reges_write_credentiale  c3  șeful din altă firmă
-- (p) Pozitive: garda nu oprește scrierea legitimă a firmei A          [POZITIVĂ]
--  p1  plan de service  p2  departament subordonat  p3  card pe vehicul
--  p4  obiect de inventar din lotul propriu  p5  alimentare pe foaia proprie
--  p6  parte de intervenție  p7  sesizare cu tehnician  p8  rezervare
--  p9  contract (hr)  p10 predarea unui obiect (hr)  p11 angajatul confirmă primirea
--  p12 etapă pe deplasarea proprie (employee)
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

begin;

-- Rulează `p_sql` sub identitatea lui `p_user` și întoarce `ok:<rânduri>` sau
-- `<sqlstate>:<mesaj>`. Eroarea nu iese din funcție: proba o citește.
create function pg_temp.ruleaza(p_user uuid, p_sql text) returns text
language plpgsql as $f$
declare
  v_n bigint;
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  set local role authenticated;
  begin
    execute p_sql;
    get diagnostics v_n = row_count;
    reset role;
    return 'ok:' || v_n::text;
  exception when others then
    reset role;
    return sqlstate || ':' || sqlerrm;
  end;
end
$f$;

create function pg_temp.verifica(p_nr text, p_ok boolean, p_mesaj text, p_detaliu text default '') returns int
language plpgsql as $f$
begin
  if coalesce(p_ok, false) then
    raise notice '  ✓ (%) %', p_nr, p_mesaj;
    return 0;
  end if;
  raise warning '  ✗ (%) % [%]', p_nr, p_mesaj, p_detaliu;
  return 1;
end
$f$;

-- Perechea: aceeași scriere cu id-ul care există și cu cel inexistent, ca
-- `p_user`. Trece doar dacă răspunsurile sunt identice ȘI au codul `p_cod`.
create function pg_temp.pereche(p_nr text, p_user uuid, p_sql text, p_exista uuid, p_inexist uuid,
                                p_cod text, p_mesaj text) returns int
language plpgsql as $f$
declare
  v_a text := pg_temp.ruleaza(p_user, format(p_sql, p_exista));
  v_b text := pg_temp.ruleaza(p_user, format(p_sql, p_inexist));
begin
  return pg_temp.verifica(p_nr, v_a = v_b and v_a like p_cod || ':%', p_mesaj,
                          'există → ' || v_a || ' | inexistent → ' || v_b);
end
$f$;

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_zi       date := app.azi_local();
  v_an       text := extract(year from app.azi_local())::text;
  v_org_a    uuid := gen_random_uuid();
  v_org_b    uuid := gen_random_uuid();
  v_u_a      uuid := gen_random_uuid();
  v_e_a      uuid;
  v_e_b      uuid := gen_random_uuid();
  v_e_b2     uuid := gen_random_uuid();
  v_inexist  uuid := gen_random_uuid();
  v_org_inex uuid := gen_random_uuid();
  v_veh_a    uuid := gen_random_uuid();
  v_veh_b    uuid := gen_random_uuid();
  v_dep_a    uuid;
  v_dep_b    uuid;
  v_lt_b     uuid;
  v_foaie_a  uuid := gen_random_uuid();
  v_foaie_b  uuid := gen_random_uuid();
  v_lot_b    uuid := gen_random_uuid();
  v_al_b     uuid := gen_random_uuid();
  v_eq_a     uuid := gen_random_uuid();
  v_eq_b     uuid := gen_random_uuid();
  v_int_a    uuid := gen_random_uuid();
  v_int_b    uuid := gen_random_uuid();
  v_doc_b    uuid := gen_random_uuid();
  v_inv_b    uuid := gen_random_uuid();
  v_batch_a  uuid := gen_random_uuid();
  v_batch_b  uuid := gen_random_uuid();
  v_rca      uuid;
  v_u_hr     uuid := gen_random_uuid();
  v_u_ang    uuid := gen_random_uuid();
  v_e_ang    uuid;
  v_inv_a    uuid := gen_random_uuid();
  v_inv_a2   uuid := gen_random_uuid();
  v_pred_a   uuid := gen_random_uuid();
  v_tara_ro  uuid;
  v_tara_de  uuid;
  v_depl_a   uuid := gen_random_uuid();
  v_depl_b   uuid := gen_random_uuid();
  v_r        text;
  v_esecuri  int := 0;
begin
  raise notice '';
  raise notice '  PROBA „ORACOL ÎNTRE FIRME” (Y2: 0200–0216, 0225, 0233)';
  raise notice '  ─────────────────────────────────────────────────────────';

  -- ── Datele, scrise ca `postgres` (context de serviciu) ─────────────────────
  insert into public.organizations (id, slug, name, cui) values
    (v_org_a, 'proba-y2-a-' || v_sufix, 'Firma A Y2 SRL',
     'RO' || (85000000 + (random() * 900000)::int)::text),
    (v_org_b, 'proba-y2-b-' || v_sufix, 'Firma B Y2 SRL',
     'RO' || (84000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select o, f.feature_key, true, now() from public.features f, unnest(array[v_org_a, v_org_b]) o;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_a, 'y2-a-' || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org_a, v_u_a, 'org_admin');

  -- Fișa administratorului o creează baza la intrarea lui în firmă (0083).
  select e.id into v_e_a from public.employees e
   where e.organization_id = v_org_a and e.user_id = v_u_a and e.deleted_at is null;
  insert into public.employees (id, organization_id, marca, first_name, last_name, hired_on, status) values
    (v_e_b,  v_org_b, 'Y2-B',  'Bianca', 'Bete', v_zi - 400, 'activ'),
    (v_e_b2, v_org_b, 'Y2-B2', 'Barbu',  'Bors', v_zi - 400, 'activ');

  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent, pool,
                               masa_maxima_kg, numar_locuri) values
    (v_veh_a, v_org_a, 'B' || (100 + (random() * 800)::int)::text || 'YDA', 'Dacia', 'Logan', 5000, true, 1500, 5),
    (v_veh_b, v_org_b, 'B' || (100 + (random() * 800)::int)::text || 'YDB', 'Dacia', 'Duster', 9000, true, 2000, 5);

  select d.id into v_dep_a from public.departments d where d.organization_id = v_org_a and d.deleted_at is null limit 1;
  select d.id into v_dep_b from public.departments d where d.organization_id = v_org_b and d.deleted_at is null limit 1;
  select t.id into v_lt_b from public.leave_types t
   where t.organization_id = v_org_b and t.key = 'fara_plata' and t.deleted_at is null;
  select t.id into v_rca from public.vehicle_document_types t
   where t.cod = 'rca' and t.organization_id is null and t.deleted_at is null;

  insert into public.trip_sheets (id, organization_id, vehicle_id, employee_id, plecare_la, km_plecare) values
    (v_foaie_a, v_org_a, v_veh_a, v_e_a, now() - interval '2 hours', 5000),
    (v_foaie_b, v_org_b, v_veh_b, v_e_b, now() - interval '2 hours', 9000);

  insert into public.fuel_card_imports (id, organization_id, emitent, fisier_nume, fisier_sha256,
                                        perioada_de_la, perioada_pana_la, randuri_fisier)
  values (v_lot_b, v_org_b, 'omv_petrom', 'extras-b.csv', repeat('b', 64), v_zi - 30, v_zi, 1);

  -- Alocarea încheiată a firmei B (pentru PV) și rezervarea altui angajat al ei,
  -- peste zece zile (pentru alocările deschise de mai jos).
  insert into public.vehicle_assignments (id, organization_id, vehicle_id, employee_id, de_la, pana_la, km_predare)
  values (v_al_b, v_org_b, v_veh_b, v_e_b, now() - interval '30 days', now() - interval '20 days', 8000);
  insert into public.vehicle_reservations (organization_id, vehicle_id, employee_id, de_la, pana_la, scop, status)
  values (v_org_b, v_veh_b, v_e_b2, v_zi + 10, v_zi + 11, 'Deplasare la client', 'confirmata');

  insert into public.equipment (id, organization_id, cod, denumire) values
    (v_eq_a, v_org_a, 'EQA-' || v_sufix, 'Compresor A'),
    (v_eq_b, v_org_b, 'EQB-' || v_sufix, 'Compresor B');
  insert into public.maintenance_interventions (id, organization_id, equipment_id, data, descriere) values
    (v_int_a, v_org_a, v_eq_a, v_zi, 'Intervenția firmei A.'),
    (v_int_b, v_org_b, v_eq_b, v_zi, 'Intervenția firmei B.');

  insert into public.vehicle_documents (id, organization_id, vehicle_id, document_type_id, numar, valabil_de_la, expira_la)
  values (v_doc_b, v_org_b, v_veh_b, v_rca, 'RCA-Y2-' || v_sufix, v_zi - 30, v_zi + 300);

  insert into public.inventory_import_batches (id, organization_id, fisier_nume) values
    (v_batch_a, v_org_a, 'inventar-a.xlsx'),
    (v_batch_b, v_org_b, 'inventar-b.xlsx');
  insert into public.inventory_items (id, organization_id, denumire, numar_inventar) values
    (v_inv_b, v_org_b, 'Laptop B', 'INV-B-' || v_sufix);

  -- Contractele, predările de inventar și etapele deplasărilor (0233 §8–§10):
  -- un hr și un angajat ai firmei A, câte un obiect al firmei A (unul predat
  -- deja angajatului, pentru confirmarea primirii) și câte o deplasare în
  -- fiecare firmă, cu politica de diurnă care o face posibilă.
  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_hr,  'y2-hr-'  || v_sufix || '@proba.test', now()),
    (v_u_ang, 'y2-ang-' || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org_a, v_u_hr, 'hr'),
    (v_org_a, v_u_ang, 'employee');
  -- Fișa angajatului: a lui, dacă baza i-a creat-o la intrarea în firmă (0083),
  -- altfel una nouă, legată de cont.
  select e.id into v_e_ang from public.employees e
   where e.organization_id = v_org_a and e.user_id = v_u_ang and e.deleted_at is null;
  if v_e_ang is null then
    insert into public.employees (organization_id, marca, first_name, last_name, hired_on, status, user_id)
    values (v_org_a, 'Y2-ANG', 'Ana', 'Angajat', v_zi - 400, 'activ', v_u_ang)
    returning id into v_e_ang;
  end if;
  insert into public.inventory_items (id, organization_id, denumire, numar_inventar) values
    (v_inv_a,  v_org_a, 'Laptop A',  'INV-A-'  || v_sufix),
    (v_inv_a2, v_org_a, 'Monitor A', 'INV-A2-' || v_sufix);
  insert into public.inventory_allocations (id, organization_id, item_id, employee_id, predat_la, stare_la_predare)
  values (v_pred_a, v_org_a, v_inv_a2, v_e_ang, now() - interval '2 days', 'bun');

  select c.id into v_tara_ro from public.countries c where c.cod_alpha2 = 'RO' limit 1;
  select c.id into v_tara_de from public.countries c where c.cod_alpha2 = 'DE' limit 1;
  insert into public.per_diem_policies
    (organization_id, denumire, country_id_intern, moneda_interna, diurna_interna_zi,
     diurna_baza_legala_interna, multiplu_plafon_neimpozabil, multiplu_diurna_externa,
     prag_ore_minim, prag_ore_zi_intreaga, fractiune_zi_partiala, tarif_km_auto_personal,
     moneda_tarif_km, plafon_salarii_baza_luna, valabil_de_la)
  select o, 'Politica Y2', v_tara_ro, 'RON', 125, 0, 1, 1, 12, 12, 1, 0, 'RON', 1, v_zi - 400
    from unnest(array[v_org_a, v_org_b]) o;
  insert into public.business_trips
    (id, organization_id, employee_id, country_id, localitate, plecare_la, sosire_la, scop, mijloc_transport)
  values
    (v_depl_a, v_org_a, v_e_ang, v_tara_de, 'München', now() + interval '1 day', now() + interval '5 days',
     'Probă', 'auto_personal'),
    (v_depl_b, v_org_b, v_e_b,   v_tara_de, 'Berlin',  now() + interval '1 day', now() + interval '5 days',
     'Probă', 'auto_personal');

  -- ═══ (g) Rândul pus pe firma B ═══════════════════════════════════════════
  v_esecuri := v_esecuri + pg_temp.pereche('g1', v_u_a, format(
    $q$insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la)
       values (%L, %%L, 10, 70, now() - interval '1 hour')$q$, v_org_b), v_foaie_b, v_inexist, '42501',
    'alimentarea pe firma B: foaia care există acolo și cea inexistentă primesc același refuz');

  v_esecuri := v_esecuri + pg_temp.pereche('g2', v_u_a, format(
    $q$insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, km_plecare)
       values (%L, %%L, now() - interval '1 hour', 9000)$q$, v_org_b), v_foaie_b, v_inexist, '42501',
    'cursa pe firma B: foaia care există acolo și cea inexistentă primesc același refuz');

  v_esecuri := v_esecuri + pg_temp.pereche('g3', v_u_a, format(
    $q$insert into public.fleet_settings (organization_id, responsabili) values (%L, array[%%L::uuid])$q$,
    v_org_b), v_e_b, v_inexist, '42501',
    'setările flotei pe firma B: responsabilul care e angajat acolo și cel inexistent, același refuz');

  v_esecuri := v_esecuri + pg_temp.pereche('g4', v_u_a, format(
    $q$insert into public.vehicle_documents (organization_id, vehicle_id, document_type_id, numar, valabil_de_la, expira_la)
       values (%L, %%L, %L, 'RCA-X', %L, %L)$q$, v_org_b, v_rca, v_zi, v_zi + 300), v_veh_b, v_inexist, '42501',
    'documentul pe firma B: vehiculul care există acolo și cel inexistent, același refuz');

  v_esecuri := v_esecuri + pg_temp.pereche('g5', v_u_a, format(
    $q$insert into public.vehicle_service_plans (organization_id, vehicle_id, denumire, baza_data, baza_km)
       values (%L, %%L, 'Revizie', %L, 1000)$q$, v_org_b, v_zi - 10), v_veh_b, v_inexist, '42501',
    'planul de service pe firma B: același refuz pentru vehiculul de acolo și pentru cel inexistent');

  v_esecuri := v_esecuri + pg_temp.pereche('g6', v_u_a, format(
    $q$insert into public.vehicle_service_entries (organization_id, vehicle_id, data_interventiei, km, tip, descriere)
       values (%L, %%L, %L, 9000, 'revizie', 'Revizie anuală')$q$, v_org_b, v_zi - 1), v_veh_b, v_inexist, '42501',
    'intervenția de service pe firma B: același refuz');

  v_esecuri := v_esecuri + pg_temp.pereche('g7', v_u_a, format(
    $q$insert into public.vehicle_expenses (organization_id, vehicle_id, categorie, data_cheltuielii, suma)
       values (%L, %%L, 'parcare', %L, 10)$q$, v_org_b, v_zi - 1), v_veh_b, v_inexist, '42501',
    'cheltuiala pe firma B: același refuz');

  v_esecuri := v_esecuri + pg_temp.pereche('g8', v_u_a, format(
    $q$insert into public.vehicle_fiscal_regimes (organization_id, vehicle_id, valabil_de_la, regim, motiv)
       values (%L, %%L, %L, 'peste_3500_sau_9_locuri', 'Proba')$q$, v_org_b, v_zi), v_veh_b, v_inexist, '42501',
    'regimul fiscal pe firma B: același refuz, fără masa și locurile vehiculului de acolo');

  v_esecuri := v_esecuri + pg_temp.pereche('g9', v_u_a, format(
    $q$insert into public.vehicle_consumption_norms (organization_id, vehicle_id, valabil_de_la, l_100km)
       values (%L, %%L, %L, 7.5)$q$, v_org_b, v_zi), v_veh_b, v_inexist, '42501',
    'norma de consum pe firma B: același refuz');

  -- Aici „id-ul” e firma însăși: registrul ei de PV-uri se atingea înaintea
  -- politicii, iar o firmă inexistentă cădea pe cheia străină a registrului.
  v_esecuri := v_esecuri + pg_temp.pereche('g10', v_u_a, format(
    $q$insert into public.maintenance_interventions (organization_id, equipment_id, data, descriere)
       values (%%L, %L, %L, 'Intervenție străină.')$q$, v_eq_b, v_zi), v_org_b, v_org_inex, '42501',
    'intervenția pe firma B și pe o firmă inexistentă: același refuz, registrul nu se atinge');

  v_esecuri := v_esecuri + pg_temp.pereche('g11', v_u_a, format(
    $q$insert into public.maintenance_intervention_parts (organization_id, intervention_id, denumire, cantitate)
       values (%L, %%L, 'Filtru', 1)$q$, v_org_b), v_int_b, v_inexist, '42501',
    'piesa pe firma B: intervenția care există acolo și cea inexistentă, același refuz');

  v_esecuri := v_esecuri + pg_temp.pereche('g12', v_u_a, format(
    $q$insert into public.fault_reports (organization_id, equipment_id, descriere)
       values (%L, %%L, 'Scurgere de ulei la compresor.')$q$, v_org_b), v_eq_b, v_inexist, '42501',
    'sesizarea pe firma B: echipamentul care există acolo și cel inexistent, același refuz');

  v_esecuri := v_esecuri + pg_temp.pereche('g13', v_u_a, format(
    $q$insert into public.fault_reports (organization_id, equipment_id, descriere, atribuit_employee_id)
       values (%L, %L, 'Scurgere de ulei la compresor.', %%L)$q$, v_org_b, v_eq_b), v_e_b, v_inexist, '42501',
    'sesizarea pe firma B: tehnicianul care e angajat acolo și cel inexistent, același refuz');

  v_esecuri := v_esecuri + pg_temp.pereche('g14', v_u_a, format(
    $q$insert into public.fuel_cards (organization_id, emitent, ultimele_cifre, vehicle_id)
       values (%L, 'omv_petrom', '4321', %%L)$q$, v_org_b), v_veh_b, v_inexist, '42501',
    'cardul pe firma B: același refuz pentru vehiculul de acolo și pentru cel inexistent');

  v_esecuri := v_esecuri + pg_temp.pereche('g15', v_u_a, format(
    $q$insert into public.fuel_card_transactions (organization_id, import_id, emitent, cheie_dedup, rand_fisier,
                                                   efectuat_la, produs, categorie, valoare_bruta, stare_potrivire)
       values (%L, %%L, 'omv_petrom', 'h:y2#1', 1, now(), 'Motorină', 'combustibil', 100, 'fara_alimentare')$q$,
    v_org_b), v_lot_b, v_inexist, '42501',
    'tranzacția pe firma B: importul care există acolo și cel inexistent, același refuz');

  v_esecuri := v_esecuri + pg_temp.pereche('g16', v_u_a, format(
    $q$insert into public.vehicle_handovers (organization_id, vehicle_id, alocare_primita_id)
       values (%L, %L, %%L)$q$, v_org_b, v_inexist), v_al_b, v_inexist, '42501',
    'PV-ul pe firma B: alocarea care există acolo și cea inexistentă, același refuz');

  v_esecuri := v_esecuri + pg_temp.pereche('g17', v_u_a, format(
    $q$insert into public.vehicle_reservations (organization_id, vehicle_id, employee_id, de_la, pana_la, scop)
       values (%L, %%L, %L, %L, %L, 'Deplasare')$q$, v_org_b, v_e_b, v_zi + 1, v_zi + 1), v_veh_b, v_inexist, '42501',
    'rezervarea pe firma B: același refuz, fără starea vehiculului de acolo');

  v_esecuri := v_esecuri + pg_temp.pereche('g18', v_u_a, format(
    $q$insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la)
       values (%L, %%L, %L, now() - interval '1 hour')$q$, v_org_b, v_e_b), v_veh_b, v_inexist, '42501',
    'alocarea pe firma B: același refuz, fără ziua rezervării de acolo');

  v_esecuri := v_esecuri + pg_temp.pereche('g19', v_u_a, format(
    $q$insert into public.vehicle_costuri (organization_id, vehicle_id) values (%L, %%L)$q$, v_org_b),
    v_veh_b, v_inexist, '42501',
    'costul vehiculului pe firma B: același refuz');

  v_esecuri := v_esecuri + pg_temp.pereche('g20', v_u_a, format(
    $q$insert into public.vehicle_document_costuri (organization_id, document_id) values (%L, %%L)$q$, v_org_b),
    v_doc_b, v_inexist, '42501',
    'costul documentului pe firma B: documentul care există acolo și cel inexistent, același refuz');

  v_esecuri := v_esecuri + pg_temp.pereche('g21', v_u_a, format(
    $q$insert into public.leave_requests (organization_id, employee_id, leave_type_id, data_inceput, data_sfarsit)
       values (%L, %L, %%L, %L, %L)$q$, v_org_b, v_e_b, v_zi + 30, v_zi + 31), v_lt_b, v_inexist, '42501',
    'cererea de concediu pe firma B: tipul care există acolo și cel inexistent, același refuz');

  v_esecuri := v_esecuri + pg_temp.pereche('g22', v_u_a, format(
    $q$insert into public.departments (organization_id, denumire, parent_id) values (%L, 'Vânzări Y2', %%L)$q$,
    v_org_b), v_dep_b, v_inexist, '42501',
    'departamentul pe firma B: superiorul care există acolo și cel inexistent, același refuz');

  v_esecuri := v_esecuri + pg_temp.pereche('g23', v_u_a, format(
    $q$insert into public.departments (organization_id, denumire, manager_employee_id) values (%L, 'Achiziții Y2', %%L)$q$,
    v_org_b), v_e_b, v_inexist, '42501',
    'departamentul pe firma B: șeful care e angajat acolo și cel inexistent, același refuz');

  v_esecuri := v_esecuri + pg_temp.pereche('g24', v_u_a, format(
    $q$insert into public.tickets (organization_id, numar_afisat, tip, titlu, descriere, solicitant_employee_id,
                                   inventory_item_id, blocheaza_activitatea)
       values (%L, 'TK-%s-1', 'defectiune', 'Laptopul nu pornește', 'Ecran negru la pornire.', %L, %%L, false)$q$,
    v_org_b, v_an, v_e_b), v_inv_b, v_inexist, '42501',
    'tichetul pe firma B: obiectul de inventar de acolo și cel inexistent, același refuz');

  v_esecuri := v_esecuri + pg_temp.pereche('g25', v_u_a, format(
    $q$insert into public.inventory_items (organization_id, denumire, numar_inventar, import_batch_id)
       values (%L, 'Monitor', 'INV-Y2-X', %%L)$q$, v_org_b), v_batch_b, v_inexist, '42501',
    'obiectul de inventar pe firma B: lotul de acolo și cel inexistent, același refuz');

  v_esecuri := v_esecuri + pg_temp.pereche('g26', v_u_a, format(
    $q$insert into public.employment_contracts (organization_id, employee_id, numar, data_contract, valabil_de_la,
                                                salariu_baza, status)
       values (%L, %%L, 'Y2/1', %L, %L, 5000, 'proiect')$q$, v_org_b, v_zi, v_zi), v_e_b, v_inexist, '42501',
    'contractul pe firma B: angajatul de acolo și cel inexistent, același refuz');

  v_esecuri := v_esecuri + pg_temp.pereche('g27', v_u_a, format(
    $q$insert into public.inventory_allocations (organization_id, item_id, employee_id, predat_la, stare_la_predare)
       values (%L, %%L, %L, now() - interval '1 hour', 'bun')$q$, v_org_b, v_e_b), v_inv_b, v_inexist, '42501',
    'predarea pe firma B: obiectul de acolo și cel inexistent, același refuz');

  v_esecuri := v_esecuri + pg_temp.pereche('g28', v_u_a, format(
    $q$insert into public.business_trip_legs (organization_id, business_trip_id, ordine, from_country_id, to_country_id,
                                              plecare_la, sosire_la)
       values (%L, %%L, 1, %L, %L, now() + interval '2 days', now() + interval '3 days')$q$,
    v_org_b, v_tara_ro, v_tara_de), v_depl_b, v_inexist, '42501',
    'etapa pe firma B: deplasarea de acolo și cea inexistentă, același refuz');

  -- ═══ (n) Rândul FĂRĂ firmă ═══════════════════════════════════════════════
  -- `organization_id` null nu e o firmă a apelantului: garda trebuie să-l
  -- refuze la fel ca pe firma B, altfel căutările după id (fără filtrul de
  -- firmă) găsesc rândul firmei B și răspund altfel decât pentru un id inexistent.
  v_esecuri := v_esecuri + pg_temp.pereche('n1', v_u_a, format(
    $q$insert into public.vehicle_documents (organization_id, vehicle_id, document_type_id, numar, valabil_de_la, expira_la)
       values (null, %%L, %L, 'RCA-N', %L, %L)$q$, v_rca, v_zi, v_zi + 300), v_veh_b, v_inexist, '42501',
    'documentul fără firmă: vehiculul firmei B și cel inexistent, același refuz');

  v_esecuri := v_esecuri + pg_temp.pereche('n2', v_u_a, format(
    $q$insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la)
       values (null, %%L, %L, now() - interval '1 hour')$q$, v_e_b), v_veh_b, v_inexist, '42501',
    'alocarea fără firmă: același refuz');

  v_esecuri := v_esecuri + pg_temp.pereche('n3', v_u_a,
    $q$insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la)
       values (null, %L, 10, 70, now() - interval '1 hour')$q$, v_foaie_b, v_inexist, '42501',
    'alimentarea fără firmă: foaia firmei B și cea inexistentă, același refuz');

  v_esecuri := v_esecuri + pg_temp.pereche('n4', v_u_a,
    $q$insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, km_plecare)
       values (null, %L, now() - interval '1 hour', 9000)$q$, v_foaie_b, v_inexist, '42501',
    'cursa fără firmă: același refuz');

  v_esecuri := v_esecuri + pg_temp.pereche('n5', v_u_a, format(
    $q$insert into public.vehicle_fiscal_regimes (organization_id, vehicle_id, valabil_de_la, regim, motiv)
       values (null, %%L, %L, 'peste_3500_sau_9_locuri', 'Proba')$q$, v_zi), v_veh_b, v_inexist, '42501',
    'regimul fiscal fără firmă: același refuz, fără masa și locurile vehiculului firmei B');

  v_esecuri := v_esecuri + pg_temp.pereche('n6', v_u_a, format(
    $q$insert into public.vehicle_consumption_norms (organization_id, vehicle_id, valabil_de_la, l_100km)
       values (null, %%L, %L, 7.5)$q$, v_zi), v_veh_b, v_inexist, '42501',
    'norma de consum fără firmă: același refuz');

  v_esecuri := v_esecuri + pg_temp.pereche('n7', v_u_a, format(
    $q$insert into public.vehicle_reservations (organization_id, vehicle_id, employee_id, de_la, pana_la, scop)
       values (null, %%L, %L, %L, %L, 'Deplasare')$q$, v_e_b, v_zi + 1, v_zi + 1), v_veh_b, v_inexist, '42501',
    'rezervarea fără firmă: același refuz');

  v_esecuri := v_esecuri + pg_temp.pereche('n8', v_u_a, format(
    $q$insert into public.vehicle_fines (organization_id, vehicle_id, numar_pv, constatata_la, fapta)
       values (null, %%L, 'PV-N', %L, 'Depășirea vitezei')$q$, now() - interval '3 days'), v_veh_b, v_inexist, '42501',
    'amenda fără firmă: același refuz');

  v_esecuri := v_esecuri + pg_temp.pereche('n9', v_u_a, format(
    $q$insert into public.vehicle_incidents (organization_id, vehicle_id, tip, produs_la, descriere)
       values (null, %%L, 'avarie', %L, 'Zgârietură pe ușă')$q$, now() - interval '2 days'), v_veh_b, v_inexist, '42501',
    'incidentul fără firmă: același refuz');

  v_esecuri := v_esecuri + pg_temp.pereche('n10', v_u_a, format(
    $q$insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare)
       values (null, %%L, %L, now(), 1)$q$, v_e_b), v_veh_b, v_inexist, '42501',
    'foaia de parcurs fără firmă: vehiculul firmei B și cel inexistent, același refuz');

  v_esecuri := v_esecuri + pg_temp.pereche('n11', v_u_a, format(
    $q$insert into public.vehicle_handovers (organization_id, vehicle_id, alocare_primita_id)
       values (null, %L, %%L)$q$, v_inexist), v_al_b, v_inexist, '42501',
    'PV-ul fără firmă: alocarea firmei B și cea inexistentă, același refuz');

  v_esecuri := v_esecuri + pg_temp.pereche('n12', v_u_a, format(
    $q$insert into public.employment_contracts (organization_id, employee_id, numar, data_contract, valabil_de_la,
                                                salariu_baza, status)
       values (null, %%L, 'Y2/N', %L, %L, 5000, 'proiect')$q$, v_zi, v_zi), v_e_b, v_inexist, '42501',
    'contractul fără firmă: același refuz');

  v_esecuri := v_esecuri + pg_temp.pereche('n13', v_u_a, format(
    $q$insert into public.business_trip_legs (organization_id, business_trip_id, ordine, from_country_id, to_country_id,
                                              plecare_la, sosire_la)
       values (null, %%L, 1, %L, %L, now() - interval '30 days', now() - interval '29 days')$q$,
    v_tara_ro, v_tara_de), v_depl_b, v_inexist, '42501',
    'etapa fără firmă: același refuz, fără intervalul deplasării firmei B');

  v_esecuri := v_esecuri + pg_temp.pereche('n14', v_u_a, format(
    $q$insert into public.inventory_allocations (organization_id, item_id, employee_id, predat_la, stare_la_predare)
       values (null, %%L, %L, now() - interval '1 hour', 'bun')$q$, v_e_b), v_inv_b, v_inexist, '42501',
    'predarea fără firmă: același refuz');

  -- Control: garda din `iesire_inainte` (0218) e compusă, iar `feature_on(null)`
  -- e `false`, deci `not (NULL and false …)` ridică și fără `coalesce`.
  v_esecuri := v_esecuri + pg_temp.pereche('n15', v_u_a, format(
    $q$insert into public.vehicle_exits (organization_id, vehicle_id, tip, data_iesire, motiv)
       values (null, %%L, 'casare', %L, 'Proba')$q$, v_zi), v_veh_b, v_inexist, '42501',
    'ieșirea din parc fără firmă: același refuz');

  -- ═══ (h) Perechile de mesaje, pe rândul firmei PROPRII ═══════════════════
  v_esecuri := v_esecuri + pg_temp.pereche('h1', v_u_a, format(
    $q$insert into public.leave_requests (organization_id, employee_id, leave_type_id, data_inceput, data_sfarsit)
       values (%L, %L, %%L, %L, %L)$q$, v_org_a, v_e_a, v_zi + 30, v_zi + 31), v_lt_b, v_inexist,
    'P0001', 'tipul de concediu al firmei B și cel inexistent primesc același mesaj');

  v_esecuri := v_esecuri + pg_temp.pereche('h2', v_u_a, format(
    $q$insert into public.departments (organization_id, denumire, parent_id) values (%L, 'Vânzări Y2', %%L)$q$,
    v_org_a), v_dep_b, v_inexist, 'P0001',
    'departamentul superior al firmei B și cel inexistent primesc același mesaj');

  v_esecuri := v_esecuri + pg_temp.pereche('h3', v_u_a, format(
    $q$insert into public.tickets (organization_id, numar_afisat, tip, titlu, descriere, solicitant_employee_id,
                                   inventory_item_id, blocheaza_activitatea)
       values (%L, 'TK-%s-1', 'defectiune', 'Laptopul nu pornește', 'Ecran negru la pornire.', %L, %%L, false)$q$,
    v_org_a, v_an, v_e_a), v_inv_b, v_inexist, 'P0001',
    'obiectul de inventar al firmei B și cel inexistent primesc același mesaj');

  v_esecuri := v_esecuri + pg_temp.pereche('h4', v_u_a, format(
    $q$insert into public.inventory_items (organization_id, denumire, numar_inventar, import_batch_id)
       values (%L, 'Monitor', 'INV-Y2-H', %%L)$q$, v_org_a), v_batch_b, v_inexist, 'P0001',
    'lotul de import al firmei B și cel inexistent primesc același mesaj');

  v_esecuri := v_esecuri + pg_temp.pereche('h5', v_u_a, format(
    $q$insert into public.employment_contracts (organization_id, employee_id, numar, data_contract, valabil_de_la,
                                                salariu_baza, status)
       values (%L, %%L, 'Y2/H', %L, %L, 5000, 'proiect')$q$, v_org_a, v_zi, v_zi), v_e_b, v_inexist, 'P0001',
    'angajatul firmei B și cel inexistent primesc același mesaj pe contractul propriu');

  v_esecuri := v_esecuri + pg_temp.pereche('h6', v_u_a, format(
    $q$insert into public.inventory_allocations (organization_id, item_id, employee_id, predat_la, stare_la_predare)
       values (%L, %%L, %L, now() - interval '1 hour', 'bun')$q$, v_org_a, v_e_ang), v_inv_b, v_inexist, 'P0001',
    'obiectul firmei B și cel inexistent primesc același mesaj pe predarea proprie');

  v_esecuri := v_esecuri + pg_temp.pereche('h7', v_u_a, format(
    $q$insert into public.inventory_allocations (organization_id, item_id, employee_id, predat_la, stare_la_predare)
       values (%L, %L, %%L, now() - interval '1 hour', 'bun')$q$, v_org_a, v_inv_a), v_e_b, v_inexist, 'P0001',
    'angajatul firmei B și cel inexistent primesc același mesaj pe predarea proprie');

  v_esecuri := v_esecuri + pg_temp.pereche('h8', v_u_a, format(
    $q$insert into public.business_trip_legs (organization_id, business_trip_id, ordine, from_country_id, to_country_id,
                                              plecare_la, sosire_la)
       values (%L, %%L, 1, %L, %L, now() - interval '30 days', now() - interval '29 days')$q$,
    v_org_a, v_tara_ro, v_tara_de), v_depl_b, v_inexist, 'P0001',
    'deplasarea firmei B și cea inexistentă primesc același mesaj, fără intervalul ei');

  -- ═══ (c) Controale: nu erau oracol nici înainte ══════════════════════════
  -- REGES judecă apartenența la firmă înaintea oricărei căutări: o firmă care
  -- există și una inventată primesc același P0001.
  v_esecuri := v_esecuri + pg_temp.pereche('c1', v_u_a,
    'select * from public.reges_read_credentiale(%L)', v_org_b, v_org_inex, 'P0001',
    'reges_read_credentiale: firma B și o firmă inexistentă primesc același mesaj');
  v_esecuri := v_esecuri + pg_temp.pereche('c2', v_u_a,
    $q$select public.reges_write_credentiale(%L, 'test', 'RO123', 'client', 'utilizator')$q$,
    v_org_b, v_org_inex, 'P0001',
    'reges_write_credentiale: firma B și o firmă inexistentă primesc același mesaj');
  v_esecuri := v_esecuri + pg_temp.pereche('c3', v_u_a, format(
    $q$insert into public.departments (organization_id, denumire, manager_employee_id) values (%L, 'Achiziții Y2', %%L)$q$,
    v_org_a), v_e_b, v_inexist, 'P0001',
    'șeful din firma B și cel inexistent primesc același mesaj pe departamentul propriu');

  -- ═══ (p) Pozitive: firma A își scrie rândurile ═══════════════════════════
  v_r := pg_temp.ruleaza(v_u_a, format(
    $q$insert into public.vehicle_service_plans (organization_id, vehicle_id, denumire, baza_data, baza_km,
                                                  interval_luni, created_by, updated_by)
       values (%L, %L, 'Revizie', %L, 1000, 12, %L, %L)$q$, v_org_a, v_veh_a, v_zi - 10, v_u_a, v_u_a));
  v_esecuri := v_esecuri + pg_temp.verifica('p1', v_r = 'ok:1', 'org_admin A adaugă planul de service al vehiculului lui', v_r);

  v_r := pg_temp.ruleaza(v_u_a, format(
    $q$insert into public.departments (organization_id, denumire, parent_id, manager_employee_id)
       values (%L, 'Vânzări Y2', %L, %L)$q$, v_org_a, v_dep_a, v_e_a));
  v_esecuri := v_esecuri + pg_temp.verifica('p2', v_r = 'ok:1', 'org_admin A adaugă un departament subordonat, cu șef din firmă', v_r);

  v_r := pg_temp.ruleaza(v_u_a, format(
    $q$insert into public.fuel_cards (organization_id, emitent, ultimele_cifre, vehicle_id, created_by, updated_by)
       values (%L, 'omv_petrom', '1234', %L, %L, %L)$q$, v_org_a, v_veh_a, v_u_a, v_u_a));
  v_esecuri := v_esecuri + pg_temp.verifica('p3', v_r = 'ok:1', 'org_admin A înregistrează cardul vehiculului lui', v_r);

  v_r := pg_temp.ruleaza(v_u_a, format(
    $q$insert into public.inventory_items (organization_id, denumire, numar_inventar, import_batch_id)
       values (%L, 'Monitor', 'INV-Y2-A', %L)$q$, v_org_a, v_batch_a));
  v_esecuri := v_esecuri + pg_temp.verifica('p4', v_r = 'ok:1', 'org_admin A adaugă un obiect din lotul lui', v_r);

  v_r := pg_temp.ruleaza(v_u_a, format(
    $q$insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la, created_by, updated_by)
       values (%L, %L, 10, 70, now() - interval '1 hour', %L, %L)$q$, v_org_a, v_foaie_a, v_u_a, v_u_a));
  v_esecuri := v_esecuri + pg_temp.verifica('p5', v_r = 'ok:1', 'org_admin A adaugă alimentarea pe foaia lui', v_r);

  v_r := pg_temp.ruleaza(v_u_a, format(
    $q$insert into public.maintenance_intervention_parts (organization_id, intervention_id, denumire, cantitate)
       values (%L, %L, 'Filtru', 1)$q$, v_org_a, v_int_a));
  v_esecuri := v_esecuri + pg_temp.verifica('p6', v_r = 'ok:1', 'org_admin A adaugă o piesă pe intervenția lui', v_r);

  v_r := pg_temp.ruleaza(v_u_a, format(
    $q$insert into public.fault_reports (organization_id, equipment_id, descriere, atribuit_employee_id)
       values (%L, %L, 'Compresorul face zgomot.', %L)$q$, v_org_a, v_eq_a, v_e_a));
  v_esecuri := v_esecuri + pg_temp.verifica('p7', v_r = 'ok:1', 'org_admin A deschide o sesizare atribuită lui însuși', v_r);

  v_r := pg_temp.ruleaza(v_u_a, format(
    $q$insert into public.vehicle_reservations (organization_id, vehicle_id, employee_id, de_la, pana_la, scop, created_by, updated_by)
       values (%L, %L, %L, %L, %L, 'Deplasare', %L, %L)$q$, v_org_a, v_veh_a, v_e_a, v_zi + 3, v_zi + 3, v_u_a, v_u_a));
  v_esecuri := v_esecuri + pg_temp.verifica('p8', v_r = 'ok:1', 'org_admin A rezervă mașina de pool a firmei lui', v_r);

  v_r := pg_temp.ruleaza(v_u_hr, format(
    $q$insert into public.employment_contracts (organization_id, employee_id, numar, data_contract, valabil_de_la,
                                                salariu_baza, status, created_by, updated_by)
       values (%L, %L, 'Y2/P', %L, %L, 5000, 'proiect', %L, %L)$q$, v_org_a, v_e_ang, v_zi, v_zi, v_u_hr, v_u_hr));
  v_esecuri := v_esecuri + pg_temp.verifica('p9', v_r = 'ok:1', 'hr A întocmește contractul unui angajat al firmei', v_r);

  v_r := pg_temp.ruleaza(v_u_hr, format(
    $q$insert into public.inventory_allocations (organization_id, item_id, employee_id, predat_la, stare_la_predare,
                                                 created_by, updated_by)
       values (%L, %L, %L, now() - interval '1 hour', 'bun', %L, %L)$q$, v_org_a, v_inv_a, v_e_ang, v_u_hr, v_u_hr));
  v_esecuri := v_esecuri + pg_temp.verifica('p10', v_r = 'ok:1', 'hr A predă un obiect al firmei unui angajat al ei', v_r);

  v_r := pg_temp.ruleaza(v_u_ang, format(
    $q$update public.inventory_allocations set confirmat_de_angajat_la = now(), updated_by = %L where id = %L$q$,
    v_u_ang, v_pred_a));
  v_esecuri := v_esecuri + pg_temp.verifica('p11', v_r = 'ok:1', 'angajatul A confirmă primirea obiectului predat lui', v_r);

  v_r := pg_temp.ruleaza(v_u_ang, format(
    $q$insert into public.business_trip_legs (organization_id, business_trip_id, ordine, from_country_id, to_country_id,
                                              plecare_la, sosire_la)
       values (%L, %L, 1, %L, %L, now() + interval '2 days', now() + interval '3 days')$q$,
    v_org_a, v_depl_a, v_tara_ro, v_tara_de));
  v_esecuri := v_esecuri + pg_temp.verifica('p12', v_r = 'ok:1', 'angajatul A adaugă o etapă pe deplasarea lui', v_r);

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA ORACOL ÎNTRE FIRME: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE verificările au trecut.';
  raise notice '';
end;
$$;

rollback;
