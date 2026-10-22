-- tests/rls/proba-flota-uit.sql
--
-- FLOTA, DUPĂ 0217 (F12f): CODUL UIT (RO e-TRANSPORT) PE CURSELE FOII.
-- Pe seed-ul real al rolurilor (0199: employee și manager au
-- `trip_sheets:update = own`, managerul `read/approve = team`, hr nimic pe
-- flotă, org_admin `all`; super_admin doar în `platform_admins`).
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- Pozitive (rânduri NUMĂRATE):
--  (P1) employee: UIT valid pe cursa foii proprii, pe ciornă ⇒ 1 rând;
--  (P6) `expira_la` = `data_inceput + 5` (prima zi expirată);
--  (P5) normalizarea: „ 3v0p-0l0p0t3juw46” se salvează „3V0P0L0P0T3JUW46”
--       (și e al doilea cod pe aceeași cursă: grupaj);
--  (P7) același UIT pe DOUĂ curse ale aceleiași foi ⇒ ambele acceptate;
--  (P9) employee: UPDATE pe `data_inceput` și `valabilitate_zile` ⇒ 1 rând,
--       `expira_la` recalculat;
--  (P4) org_admin: UIT pe foaia altui angajat ⇒ 1 rând;
-- (P10) manager: CITEȘTE UIT-ul de pe foaia subordonatului ⇒ 1 rând;
--  (P3) manager: UIT pe cursa foii LUI ⇒ 1 rând;
-- (P11) org_admin: modifică și șterge logic UIT-ul unui angajat ⇒ 2 × 1 rând;
--  (P2) employee: șterge logic propriul UIT ⇒ 1 rând;
--  (P8) employee: șterge logic cursa ⇒ codul ei primește `deleted_at` (cascada);
-- (P15) employee: marchează cursa `risc_fiscal_national` pe ciornă ⇒ 1 rând;
-- (P12) foaia respinsă: UIT P0001 (ca liniile, F4 = doar ciornă); redeschisă
--       în ciornă ⇒ UIT acceptat;
-- (P13) ciorna numerotată: șoferul n-o șterge (P0001, 0200 §E4); anulată
--       logic de org_admin ⇒ codurile ei primesc `deleted_at` (foi_sterge_uit);
-- (P14) foaia aprobată, stornată de org_admin ⇒ codurile ei primesc `deleted_at`.
-- Negative:
--  (N1) employee pe cursa unui coleg ⇒ refuz (codul se notează empiric);
--  (N2) manager pe cursa subordonatului ⇒ 42501; UPDATE ⇒ 0 rânduri;
--  (N3) hr ⇒ 42501 la INSERT, SELECT 0 rânduri;
--  (N4) cifre de control greșite ⇒ 23514 `tsu_uit_format`;
--  (N5) litera B în primele 14 ⇒ 23514 (baza NU mapează);
--  (N6) `trip_sheet_id` al altei foi decât a cursei ⇒ P0001;
--  (N7) cursa altei firme ⇒ P0001, același mesaj ca o cursă inexistentă;
--  (N8) foaia trimisă: INSERT ⇒ P0001, UPDATE ⇒ P0001, `e_transport` ⇒ P0001;
--  (N9) UPDATE care schimbă `cursa_id` ⇒ P0001;
-- (N10) duplicat (cursa_id, uit) ⇒ 23505;
-- (N11) `expira_la` trimis ⇒ 428C9;
-- (N12) super_admin: SELECT vede rândul, INSERT refuzat (codul se notează);
-- (N13) UPDATE care schimbă `uit` ⇒ P0001;
-- (N14) employee: UPDATE pe UIT-ul colegului ⇒ 0 rânduri, fără eroare;
-- (N15) izolare: org_admin din firma B vede 0 rânduri și modifică 0.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

-- Momentul `ora` din ziua `zi`, în ora României.
create function pg_temp.la(zi date, ora text) returns timestamptz
language sql immutable as $$ select (zi::timestamp + ora::interval) at time zone 'Europe/Bucharest' $$;

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_zi       date := app.azi_local() - 2;
  v_org      uuid := gen_random_uuid();
  v_org_b    uuid := gen_random_uuid();
  v_u_adm    uuid := gen_random_uuid();
  v_u_adm_b  uuid := gen_random_uuid();
  v_u_mgr    uuid := gen_random_uuid();
  v_u_a      uuid := gen_random_uuid();
  v_u_b      uuid := gen_random_uuid();
  v_u_hr     uuid := gen_random_uuid();
  v_u_sa     uuid := gen_random_uuid();
  v_u_x      uuid := gen_random_uuid();
  v_e_mgr    uuid := gen_random_uuid();
  v_e_a      uuid := gen_random_uuid();
  v_e_b      uuid := gen_random_uuid();
  v_e_x      uuid := gen_random_uuid();
  v_v_a      uuid := gen_random_uuid();
  v_v_b      uuid := gen_random_uuid();
  v_v_m      uuid := gen_random_uuid();
  v_v_x      uuid := gen_random_uuid();
  v_foaie_a  uuid;
  v_foaie_b  uuid;
  v_foaie_m  uuid;
  v_foaie_x  uuid;
  v_c_a1     uuid;
  v_c_a2     uuid;
  v_c_b1     uuid;
  v_c_m1     uuid;
  v_c_x1     uuid;
  v_u1       uuid;
  v_u2       uuid;
  v_u3       uuid;
  v_ub       uuid;
  v_ub2      uuid;
  v_um       uuid;
  v_n        int;
  v_text     text;
  v_data     date;
  v_esecuri  int := 0;
  v_total    int := 0;
begin
  raise notice '';
  raise notice '  PROBA „FLOTA — CODUL UIT" (0217)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org,   'proba-uit-' || v_sufix,   'Proba UIT SRL',
     'RO' || (86000000 + (random() * 900000)::int)::text),
    (v_org_b, 'proba-uit-b-' || v_sufix, 'Alta UIT SRL',
     'RO' || (87000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select o, f.feature_key, true, now() from public.features f cross join unnest(array[v_org, v_org_b]) o;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_adm,   'uit-adm-'  || v_sufix || '@proba.test', now()),
    (v_u_adm_b, 'uit-admb-' || v_sufix || '@proba.test', now()),
    (v_u_mgr,   'uit-mgr-'  || v_sufix || '@proba.test', now()),
    (v_u_a,     'uit-a-'    || v_sufix || '@proba.test', now()),
    (v_u_b,     'uit-b-'    || v_sufix || '@proba.test', now()),
    (v_u_hr,    'uit-hr-'   || v_sufix || '@proba.test', now()),
    (v_u_sa,    'uit-sa-'   || v_sufix || '@proba.test', now()),
    (v_u_x,     'uit-x-'    || v_sufix || '@proba.test', now());
  insert into public.platform_admins (user_id) values (v_u_sa);
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org,   v_u_adm,   'org_admin'),
    (v_org_b, v_u_adm_b, 'org_admin'),
    (v_org,   v_u_mgr,   'manager'),
    (v_org,   v_u_a,     'employee'),
    (v_org,   v_u_b,     'employee'),
    (v_org,   v_u_hr,    'hr'),
    (v_org_b, v_u_x,     'employee');

  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_mgr, v_org,   'UI-M', 'Mihai',  'Manager', app.azi_local() - 500, 'activ', v_u_mgr,   null),
    (v_e_x,   v_org_b, 'UI-X', 'Xenia',  'Alta',    app.azi_local() - 500, 'activ', v_u_x,     null);
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_a, v_org, 'UI-A', 'Ana',    'Șofer', app.azi_local() - 400, 'activ', v_u_a, v_e_mgr),
    (v_e_b, v_org, 'UI-B', 'Bogdan', 'Șofer', app.azi_local() - 400, 'activ', v_u_b, v_e_mgr);

  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent,
                               masa_maxima_kg, created_by, updated_by) values
    (v_v_a, v_org,   'B' || (100 + (random() * 800)::int)::text || 'UIA', 'Ford',  'Transit', 10000, 3500, v_u_adm,   v_u_adm),
    (v_v_b, v_org,   'B' || (100 + (random() * 800)::int)::text || 'UIB', 'Iveco', 'Daily',   20000, 3500, v_u_adm,   v_u_adm),
    (v_v_m, v_org,   'B' || (100 + (random() * 800)::int)::text || 'UIM', 'Dacia', 'Logan',   30000, 1600, v_u_adm,   v_u_adm),
    (v_v_x, v_org_b, 'B' || (100 + (random() * 800)::int)::text || 'UIX', 'MAN',   'TGL',     40000, 7500, v_u_adm_b, v_u_adm_b);
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, created_by, updated_by) values
    (v_org,   v_v_a, v_e_a,   now() - interval '20 days', v_u_adm,   v_u_adm),
    (v_org,   v_v_b, v_e_b,   now() - interval '20 days', v_u_adm,   v_u_adm),
    (v_org,   v_v_m, v_e_mgr, now() - interval '20 days', v_u_adm,   v_u_adm),
    (v_org_b, v_v_x, v_e_x,   now() - interval '20 days', v_u_adm_b, v_u_adm_b);

  -- Ciornele și cursele, scrise de șoferii lor (Ana are două curse).
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                  created_by, updated_by)
  values (v_org, v_v_a, v_e_a, pg_temp.la(v_zi, '07:30'), 10000, v_u_a, v_u_a)
  returning id into v_foaie_a;
  insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la,
                                       de_la_loc, pana_la_loc, scop, km_plecare, km_sosire,
                                       created_by, updated_by)
  values (v_org, v_foaie_a, pg_temp.la(v_zi, '08:00'), pg_temp.la(v_zi, '09:00'),
          'Depozit Ploiești', 'Client Brașov', 'Livrare legume', 10000, 10040, v_u_a, v_u_a)
  returning id into v_c_a1;
  insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la,
                                       de_la_loc, pana_la_loc, scop, km_plecare, km_sosire,
                                       created_by, updated_by)
  values (v_org, v_foaie_a, pg_temp.la(v_zi, '10:00'), pg_temp.la(v_zi, '11:00'),
          'Client Brașov', 'Client Sibiu', 'Livrare legume', 10050, 10090, v_u_a, v_u_a)
  returning id into v_c_a2;
  reset role;

  perform set_config('request.jwt.claim.sub', v_u_b::text, true);
  set local role authenticated;
  insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                  created_by, updated_by)
  values (v_org, v_v_b, v_e_b, pg_temp.la(v_zi, '07:30'), 20000, v_u_b, v_u_b)
  returning id into v_foaie_b;
  insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la,
                                       de_la_loc, pana_la_loc, scop, km_plecare, km_sosire,
                                       created_by, updated_by)
  values (v_org, v_foaie_b, pg_temp.la(v_zi, '08:00'), pg_temp.la(v_zi, '09:30'),
          'Sediu', 'Vama Nădlac', 'Transport internațional', 20000, 20090, v_u_b, v_u_b)
  returning id into v_c_b1;
  reset role;

  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                  created_by, updated_by)
  values (v_org, v_v_m, v_e_mgr, pg_temp.la(v_zi, '07:30'), 30000, v_u_mgr, v_u_mgr)
  returning id into v_foaie_m;
  insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la,
                                       de_la_loc, pana_la_loc, scop, km_plecare, km_sosire,
                                       created_by, updated_by)
  values (v_org, v_foaie_m, pg_temp.la(v_zi, '08:00'), pg_temp.la(v_zi, '09:00'),
          'Sediu', 'Furnizor', 'Ridicare marfă', 30000, 30030, v_u_mgr, v_u_mgr)
  returning id into v_c_m1;
  reset role;

  perform set_config('request.jwt.claim.sub', v_u_adm_b::text, true);
  set local role authenticated;
  insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                  created_by, updated_by)
  values (v_org_b, v_v_x, v_e_x, pg_temp.la(v_zi, '07:30'), 40000, v_u_adm_b, v_u_adm_b)
  returning id into v_foaie_x;
  insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la,
                                       de_la_loc, pana_la_loc, scop, km_plecare, km_sosire,
                                       created_by, updated_by)
  values (v_org_b, v_foaie_x, pg_temp.la(v_zi, '08:00'), pg_temp.la(v_zi, '09:00'),
          'Hală', 'Port', 'Export', 40000, 40050, v_u_adm_b, v_u_adm_b)
  returning id into v_c_x1;
  reset role;

  -- ═══ Pozitive pe ciorna Anei ══════════════════════════════════════════════

  -- (P1) + (P6)
  v_total := v_total + 2;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheet_uit (organization_id, trip_sheet_id, cursa_id, uit, data_inceput,
                                       created_by, updated_by)
    values (v_org, v_foaie_a, v_c_a1, '4C0U0C0J0W3DDQ92', v_zi - 1, v_u_a, v_u_a)
    returning id into v_u1;
    get diagnostics v_n = row_count;
    reset role;
    if v_n = 1 then
      raise notice '  ✓ (P1) employee trece un UIT valid pe cursa foii proprii (1 rând)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (P1) FALS-NEGATIV: % rânduri, așteptat 1', v_n;
    end if;
    select u.expira_la into v_data from public.trip_sheet_uit u where u.id = v_u1;
    if v_data = v_zi - 1 + 5 then
      raise notice '  ✓ (P6) expira_la = data_inceput + 5 (prima zi expirată: %)', v_data;
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (P6) expira_la = %, așteptat %', v_data, v_zi - 1 + 5;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 2;
    raise warning '  ✗ (P1) employee nu poate trece UIT-ul: % (%)', sqlerrm, sqlstate;
  end;

  -- (P5) normalizarea; al doilea cod pe aceeași cursă (grupaj)
  v_total := v_total + 1;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheet_uit (organization_id, trip_sheet_id, cursa_id, uit, data_inceput,
                                       created_by, updated_by)
    values (v_org, v_foaie_a, v_c_a1, ' 3v0p-0l0p0t3juw46', v_zi, v_u_a, v_u_a)
    returning id into v_u2;
    reset role;
    select u.uit into v_text from public.trip_sheet_uit u where u.id = v_u2;
    if v_text = '3V0P0L0P0T3JUW46' then
      raise notice '  ✓ (P5) „ 3v0p-0l0p0t3juw46” se salvează „%” (al doilea cod pe cursă)', v_text;
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (P5) codul salvat: „%”', v_text;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (P5) normalizarea: % (%)', sqlerrm, sqlstate;
  end;

  -- (P7) același cod pe a doua cursă a foii
  v_total := v_total + 1;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheet_uit (organization_id, trip_sheet_id, cursa_id, uit, data_inceput,
                                       created_by, updated_by)
    values (v_org, v_foaie_a, v_c_a2, '3V0P0L0P0T3JUW46', v_zi, v_u_a, v_u_a)
    returning id into v_u3;
    get diagnostics v_n = row_count;
    reset role;
    select count(*) into v_n from public.trip_sheet_uit u
     where u.trip_sheet_id = v_foaie_a and u.uit = '3V0P0L0P0T3JUW46' and u.deleted_at is null;
    if v_n = 2 then
      raise notice '  ✓ (P7) același UIT pe două curse ale foii: % rânduri (fără unicitate în firmă)', v_n;
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (P7) % rânduri cu același cod, așteptat 2', v_n;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (P7) același cod pe a doua cursă: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ Negative pe formă și identitate ══════════════════════════════════════

  -- (N10) duplicat pe aceeași cursă
  v_total := v_total + 1;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheet_uit (organization_id, trip_sheet_id, cursa_id, uit, data_inceput,
                                       created_by, updated_by)
    values (v_org, v_foaie_a, v_c_a1, '4C0U 0C0J 0W3D DQ92', v_zi, v_u_a, v_u_a);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (N10) FALS-POZITIV: același cod de două ori pe cursă';
  exception when others then
    reset role;
    if sqlstate = '23505' and sqlerrm like '%tsu_cursa_uit_uq%' then
      raise notice '  ✓ (N10) codul dublat pe aceeași cursă: 23505 tsu_cursa_uit_uq';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (N10) refuzat din alt motiv: % (%)', sqlerrm, sqlstate;
    end if;
  end;

  -- (N4) cifre de control greșite
  v_total := v_total + 1;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheet_uit (organization_id, trip_sheet_id, cursa_id, uit, data_inceput,
                                       created_by, updated_by)
    values (v_org, v_foaie_a, v_c_a2, '3V0P0L0P0T3JUW47', v_zi, v_u_a, v_u_a);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (N4) FALS-POZITIV: cod cu cifre de control greșite acceptat';
  exception when others then
    reset role;
    if sqlstate = '23514' and sqlerrm like '%tsu_uit_format%' then
      raise notice '  ✓ (N4) cifre de control greșite: 23514 tsu_uit_format';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (N4) refuzat din alt motiv: % (%)', sqlerrm, sqlstate;
    end if;
  end;

  -- (N5) litera B (scoasă din alfabet) — baza NU o mapează pe 8
  v_total := v_total + 1;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheet_uit (organization_id, trip_sheet_id, cursa_id, uit, data_inceput,
                                       created_by, updated_by)
    values (v_org, v_foaie_a, v_c_a2, '3V0P0L0P0T3JUB46', v_zi, v_u_a, v_u_a);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (N5) FALS-POZITIV: litera B acceptată';
  exception when others then
    reset role;
    if sqlstate = '23514' and sqlerrm like '%tsu_uit_format%' then
      raise notice '  ✓ (N5) litera B în cod: 23514 (fără mapare tăcută în bază)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (N5) refuzat din alt motiv: % (%)', sqlerrm, sqlstate;
    end if;
  end;

  -- (N11) `expira_la` trimis
  v_total := v_total + 1;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheet_uit (organization_id, trip_sheet_id, cursa_id, uit, data_inceput,
                                       expira_la, created_by, updated_by)
    values (v_org, v_foaie_a, v_c_a2, '5Y0Q0L0A0Y3AJA00', v_zi, v_zi + 30, v_u_a, v_u_a);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (N11) FALS-POZITIV: expira_la scris din payload';
  exception when others then
    reset role;
    if sqlstate = '428C9' then
      raise notice '  ✓ (N11) expira_la trimis: 428C9 (GENERATED)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (N11) refuzat din alt motiv: % (%)', sqlerrm, sqlstate;
    end if;
  end;

  -- (N6) foaia altcuiva decât a cursei
  v_total := v_total + 1;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheet_uit (organization_id, trip_sheet_id, cursa_id, uit, data_inceput,
                                       created_by, updated_by)
    values (v_org, v_foaie_b, v_c_a1, '5Y0Q0L0A0Y3AJA00', v_zi, v_u_a, v_u_a);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (N6) FALS-POZITIV: cursa pusă sub altă foaie';
  exception when others then
    reset role;
    if sqlstate = 'P0001' and sqlerrm like 'Cursa aleasă nu aparține acestei foi de parcurs.%' then
      raise notice '  ✓ (N6) trip_sheet_id al altei foi decât a cursei: P0001';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (N6) refuzat din alt motiv: % (%)', sqlerrm, sqlstate;
    end if;
  end;

  -- (N7) cursa altei firme: cu firma proprie și cu firma ei, același mesaj
  v_total := v_total + 1;
  v_text := '';
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheet_uit (organization_id, trip_sheet_id, cursa_id, uit, data_inceput,
                                       created_by, updated_by)
    values (v_org, v_foaie_x, v_c_x1, '5Y0Q0L0A0Y3AJA00', v_zi, v_u_a, v_u_a);
    reset role;
    v_text := 'acceptat';
  exception when others then
    reset role;
    v_text := sqlstate || ' ' || sqlerrm;
  end;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheet_uit (organization_id, trip_sheet_id, cursa_id, uit, data_inceput,
                                       created_by, updated_by)
    values (v_org_b, v_foaie_x, v_c_x1, '5Y0Q0L0A0Y3AJA00', v_zi, v_u_a, v_u_a);
    reset role;
    v_text := v_text || ' | acceptat';
  exception when others then
    reset role;
    v_text := v_text || ' | ' || sqlstate || ' ' || sqlerrm;
  end;
  if v_text = 'P0001 Cursa nu există în această organizație. | P0001 Cursa nu există în această organizație.' then
    raise notice '  ✓ (N7) cursa altei firme: P0001 „Cursa nu există…” cu ambele organization_id (nicio stare scursă)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (N7) cursa altei firme: %', v_text;
  end if;

  -- (P9) employee modifică data și valabilitatea
  v_total := v_total + 1;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheet_uit
       set data_inceput = v_zi, valabilitate_zile = 15, updated_by = v_u_a
     where id = v_u1;
    get diagnostics v_n = row_count;
    reset role;
    select u.expira_la into v_data from public.trip_sheet_uit u where u.id = v_u1;
    if v_n = 1 and v_data = v_zi + 15 then
      raise notice '  ✓ (P9) employee modifică data și valabilitatea (1 rând, expira_la = %)', v_data;
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (P9) % rânduri, expira_la = %', v_n, v_data;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (P9) modificarea: % (%)', sqlerrm, sqlstate;
  end;

  -- (N9) cursa_id mutat
  v_total := v_total + 1;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheet_uit set cursa_id = v_c_a2, updated_by = v_u_a where id = v_u1;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (N9) FALS-POZITIV: codul s-a mutat pe altă cursă';
  exception when others then
    reset role;
    if sqlstate = 'P0001' and sqlerrm like 'Codul UIT nu se mută pe altă cursă.%' then
      raise notice '  ✓ (N9) UPDATE care schimbă cursa_id: P0001';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (N9) refuzat din alt motiv: % (%)', sqlerrm, sqlstate;
    end if;
  end;

  -- (N13) codul rescris pe loc
  v_total := v_total + 1;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheet_uit set uit = '5Y0Q0L0A0Y3AJA00', updated_by = v_u_a where id = v_u1;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (N13) FALS-POZITIV: codul s-a rescris pe loc';
  exception when others then
    reset role;
    if sqlstate = 'P0001' and sqlerrm like 'Codul UIT nu se corectează pe loc.%' then
      raise notice '  ✓ (N13) UPDATE care schimbă uit: P0001 (se șterge și se adaugă din nou)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (N13) refuzat din alt motiv: % (%)', sqlerrm, sqlstate;
    end if;
  end;

  -- ═══ Drepturile ═══════════════════════════════════════════════════════════

  -- (N1) employee pe cursa colegului (ciornă)
  v_total := v_total + 1;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheet_uit (organization_id, trip_sheet_id, cursa_id, uit, data_inceput,
                                       created_by, updated_by)
    values (v_org, v_foaie_b, v_c_b1, '6N0U0A0A0K3PUM07', v_zi, v_u_a, v_u_a);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (N1) FALS-POZITIV: employee a scris pe foaia colegului';
  exception when others then
    reset role;
    if sqlstate = '42501' then
      raise notice '  ✓ (N1) employee pe cursa colegului (ciornă): 42501 (empiric)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (N1) refuzat din alt motiv: % (%)', sqlerrm, sqlstate;
    end if;
  end;

  -- (P4) org_admin pe foaia lui Bogdan
  v_total := v_total + 1;
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheet_uit (organization_id, trip_sheet_id, cursa_id, uit, data_inceput,
                                       valabilitate_zile, observatii, created_by, updated_by)
    values (v_org, v_foaie_b, v_c_b1, '6N0U0A0A0K3PUM07', v_zi, 15, 'Primit de la furnizor.',
            v_u_adm, v_u_adm)
    returning id into v_ub;
    get diagnostics v_n = row_count;
    reset role;
    if v_n = 1 then
      raise notice '  ✓ (P4) org_admin trece UIT-ul pe foaia unui angajat (1 rând)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (P4) FALS-NEGATIV: % rânduri', v_n;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (P4) org_admin: % (%)', sqlerrm, sqlstate;
  end;

  -- (N14) employee UPDATE pe UIT-ul colegului: zero rânduri, tăcut
  v_total := v_total + 1;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheet_uit set observatii = 'Rescris de colegă.', updated_by = v_u_a
     where id = v_ub;
    get diagnostics v_n = row_count;
    reset role;
    if v_n = 0 then
      raise notice '  ✓ (N14) employee pe UIT-ul colegului: 0 rânduri, fără eroare (USING)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (N14) FALS-POZITIV: % rânduri', v_n;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (N14) a ridicat eroare în loc de 0 rânduri: % (%)', sqlerrm, sqlstate;
  end;

  -- (N2) managerul pe cursa subordonatului: INSERT 42501, UPDATE 0 rânduri
  v_total := v_total + 2;
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheet_uit (organization_id, trip_sheet_id, cursa_id, uit, data_inceput,
                                       created_by, updated_by)
    values (v_org, v_foaie_b, v_c_b1, '7M0L0P0H0K3RAP05', v_zi, v_u_mgr, v_u_mgr);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (N2) FALS-POZITIV: managerul a scris pe foaia subordonatului';
  exception when others then
    reset role;
    if sqlstate = '42501' then
      raise notice '  ✓ (N2) manager pe cursa subordonatului: 42501 (update = own)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (N2) refuzat din alt motiv: % (%)', sqlerrm, sqlstate;
    end if;
  end;
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    update public.trip_sheet_uit set observatii = 'Managerul.', updated_by = v_u_mgr where id = v_ub;
    get diagnostics v_n = row_count;
    reset role;
    if v_n = 0 then
      raise notice '  ✓ (N2b) manager UPDATE pe UIT-ul subordonatului: 0 rânduri';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (N2b) FALS-POZITIV: % rânduri', v_n;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (N2b) % (%)', sqlerrm, sqlstate;
  end;

  -- (P10) managerul citește UIT-ul subordonatului
  v_total := v_total + 1;
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  select count(*) into v_n from public.trip_sheet_uit u where u.id = v_ub;
  reset role;
  if v_n = 1 then
    raise notice '  ✓ (P10) managerul citește UIT-ul de pe foaia subordonatului (1 rând)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (P10) FALS-NEGATIV: managerul vede % rânduri', v_n;
  end if;

  -- (P3) managerul pe foaia LUI
  v_total := v_total + 1;
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheet_uit (organization_id, trip_sheet_id, cursa_id, uit, data_inceput,
                                       created_by, updated_by)
    values (v_org, v_foaie_m, v_c_m1, '8H0Q0V0L0Q3WQN41', v_zi, v_u_mgr, v_u_mgr)
    returning id into v_um;
    get diagnostics v_n = row_count;
    reset role;
    if v_n = 1 then
      raise notice '  ✓ (P3) managerul trece UIT-ul pe cursa foii lui (1 rând)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (P3) FALS-NEGATIV: % rânduri', v_n;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (P3) managerul: % (%)', sqlerrm, sqlstate;
  end;

  -- (N3) hr: nimic
  v_total := v_total + 2;
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheet_uit (organization_id, trip_sheet_id, cursa_id, uit, data_inceput,
                                       created_by, updated_by)
    values (v_org, v_foaie_a, v_c_a2, '9E0P0C0J0J3DQV99', v_zi, v_u_hr, v_u_hr);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (N3) FALS-POZITIV: hr a scris un UIT';
  exception when others then
    reset role;
    if sqlstate = '42501' then
      raise notice '  ✓ (N3) hr INSERT: 42501';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (N3) refuzat din alt motiv: % (%)', sqlerrm, sqlstate;
    end if;
  end;
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  select count(*) into v_n from public.trip_sheet_uit u where u.organization_id = v_org;
  reset role;
  if v_n = 0 then
    raise notice '  ✓ (N3b) hr SELECT: 0 rânduri';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (N3b) hr vede % rânduri', v_n;
  end if;

  -- (N12) super_admin: citește, nu scrie
  v_total := v_total + 2;
  perform set_config('request.jwt.claim.sub', v_u_sa::text, true);
  set local role authenticated;
  select count(*) into v_n from public.trip_sheet_uit u where u.id = v_u1;
  reset role;
  if v_n = 1 then
    raise notice '  ✓ (N12a) super_admin vede UIT-ul (is_platform_admin, 1 rând)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (N12a) super_admin vede % rânduri', v_n;
  end if;
  perform set_config('request.jwt.claim.sub', v_u_sa::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheet_uit (organization_id, trip_sheet_id, cursa_id, uit, data_inceput,
                                       created_by, updated_by)
    values (v_org, v_foaie_a, v_c_a2, '0C1E0K0N0M3EHP79', v_zi, v_u_sa, v_u_sa);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (N12b) FALS-POZITIV: super_admin a scris un UIT';
  exception when others then
    reset role;
    if sqlstate in ('42501', 'P0001') then
      raise notice '  ✓ (N12b) super_admin INSERT refuzat: % „%” (empiric)', sqlstate, sqlerrm;
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (N12b) refuzat din alt motiv: % (%)', sqlerrm, sqlstate;
    end if;
  end;

  -- (N15) izolarea: org_admin din firma B
  v_total := v_total + 2;
  perform set_config('request.jwt.claim.sub', v_u_adm_b::text, true);
  set local role authenticated;
  select count(*) into v_n from public.trip_sheet_uit u where u.organization_id = v_org;
  reset role;
  if v_n = 0 then
    raise notice '  ✓ (N15a) org_admin din firma B vede 0 UIT-uri din firma A';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (N15a) org_admin B vede % rânduri din A', v_n;
  end if;
  perform set_config('request.jwt.claim.sub', v_u_adm_b::text, true);
  set local role authenticated;
  begin
    update public.trip_sheet_uit set observatii = 'Altă firmă.', updated_by = v_u_adm_b where id = v_u1;
    get diagnostics v_n = row_count;
    reset role;
    if v_n = 0 then
      raise notice '  ✓ (N15b) org_admin din firma B modifică 0 UIT-uri din firma A';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (N15b) org_admin B a modificat % rânduri', v_n;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (N15b) % (%)', sqlerrm, sqlstate;
  end;

  -- (P11) org_admin modifică și șterge logic UIT-ul lui Bogdan
  v_total := v_total + 2;
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  begin
    update public.trip_sheet_uit set observatii = 'Confirmat telefonic.', updated_by = v_u_adm
     where id = v_ub;
    get diagnostics v_n = row_count;
    if v_n = 1 then
      raise notice '  ✓ (P11a) org_admin modifică UIT-ul angajatului (1 rând)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (P11a) % rânduri', v_n;
    end if;
    update public.trip_sheet_uit set deleted_at = now(), updated_by = v_u_adm where id = v_ub;
    get diagnostics v_n = row_count;
    reset role;
    if v_n = 1 then
      raise notice '  ✓ (P11b) org_admin șterge logic UIT-ul angajatului (1 rând)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (P11b) % rânduri', v_n;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (P11) org_admin: % (%)', sqlerrm, sqlstate;
  end;

  -- (P2) employee șterge logic propriul UIT
  v_total := v_total + 1;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheet_uit set deleted_at = now(), updated_by = v_u_a where id = v_u2;
    get diagnostics v_n = row_count;
    reset role;
    if v_n = 1 then
      raise notice '  ✓ (P2) employee șterge logic propriul UIT (1 rând)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (P2) % rânduri', v_n;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (P2) ștergerea: % (%)', sqlerrm, sqlstate;
  end;

  -- (P8) cursa ștearsă își ia codul cu ea
  v_total := v_total + 1;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheet_curse set deleted_at = now(), updated_by = v_u_a where id = v_c_a2;
    get diagnostics v_n = row_count;
    reset role;
    select count(*) into v_n from public.trip_sheet_uit u
     where u.id = v_u3 and u.deleted_at is not null and u.updated_by = v_u_a;
    if v_n = 1 then
      raise notice '  ✓ (P8) cursa ștearsă logic: UIT-ul ei are deleted_at (cascada, actorul real)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (P8) UIT-ul cursei șterse a rămas viu';
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (P8) ștergerea cursei: % (%)', sqlerrm, sqlstate;
  end;

  -- (P15) încadrarea cursei
  v_total := v_total + 1;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheet_curse set e_transport = 'risc_fiscal_national', updated_by = v_u_a
     where id = v_c_a1;
    get diagnostics v_n = row_count;
    reset role;
    if v_n = 1 and (select e_transport from public.trip_sheet_curse where id = v_c_a1) = 'risc_fiscal_national' then
      raise notice '  ✓ (P15) employee marchează cursa „risc_fiscal_national” pe ciornă (1 rând)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (P15) % rânduri', v_n;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (P15) încadrarea: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ Starea foii ══════════════════════════════════════════════════════════

  -- (N8) foaia Anei trimisă: INSERT, UPDATE și încadrarea cad pe P0001
  v_total := v_total + 3;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  update public.trip_sheets set status = 'trimis', updated_by = v_u_a where id = v_foaie_a;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheet_uit (organization_id, trip_sheet_id, cursa_id, uit, data_inceput,
                                       created_by, updated_by)
    values (v_org, v_foaie_a, v_c_a1, '1C1E0Y0Y0N3YLK25', v_zi, v_u_a, v_u_a);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (N8a) FALS-POZITIV: UIT adăugat pe foaia trimisă';
  exception when others then
    reset role;
    if sqlstate = 'P0001' and sqlerrm like 'Codurile UIT se modifică doar cât foaia de parcurs este ciornă.%' then
      raise notice '  ✓ (N8a) foaia trimisă: INSERT P0001';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (N8a) refuzat din alt motiv: % (%)', sqlerrm, sqlstate;
    end if;
  end;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheet_uit set valabilitate_zile = 5, updated_by = v_u_a where id = v_u1;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (N8b) FALS-POZITIV: UIT modificat pe foaia trimisă';
  exception when others then
    reset role;
    if sqlstate = 'P0001' and sqlerrm like 'Codurile UIT se modifică doar%' then
      raise notice '  ✓ (N8b) foaia trimisă: UPDATE P0001';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (N8b) refuzat din alt motiv: % (%)', sqlerrm, sqlstate;
    end if;
  end;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheet_curse set e_transport = 'neaplicabil', updated_by = v_u_a where id = v_c_a1;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (N8c) FALS-POZITIV: încadrarea cursei schimbată pe foaia trimisă';
  exception when others then
    reset role;
    if sqlstate = 'P0001' and sqlerrm like 'Cursele se modifică doar cât foaia de parcurs este ciornă.%' then
      raise notice '  ✓ (N8c) foaia trimisă: e_transport pe cursă P0001 (curse_inainte)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (N8c) refuzat din alt motiv: % (%)', sqlerrm, sqlstate;
    end if;
  end;

  -- (P12) foaia lui Bogdan: trimisă, respinsă ⇒ P0001; redeschisă ⇒ acceptat
  v_total := v_total + 2;
  perform set_config('request.jwt.claim.sub', v_u_b::text, true);
  set local role authenticated;
  update public.trip_sheets set status = 'trimis', updated_by = v_u_b where id = v_foaie_b;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  update public.trip_sheets set status = 'respins', motiv_respingere = 'Lipsește CMR-ul.',
         updated_by = v_u_mgr where id = v_foaie_b;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheet_uit (organization_id, trip_sheet_id, cursa_id, uit, data_inceput,
                                       created_by, updated_by)
    values (v_org, v_foaie_b, v_c_b1, '2D1R0D0L0N3CYH94', v_zi, v_u_adm, v_u_adm);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (P12a) UIT adăugat pe foaia respinsă (F4 scrie liniile doar pe ciornă)';
  exception when others then
    reset role;
    if sqlstate = 'P0001' and sqlerrm like 'Codurile UIT se modifică doar%' then
      raise notice '  ✓ (P12a) foaia respinsă: UIT P0001, la fel ca liniile';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (P12a) refuzat din alt motiv: % (%)', sqlerrm, sqlstate;
    end if;
  end;
  perform set_config('request.jwt.claim.sub', v_u_b::text, true);
  set local role authenticated;
  update public.trip_sheets set status = 'draft', updated_by = v_u_b where id = v_foaie_b;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_b::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheet_uit (organization_id, trip_sheet_id, cursa_id, uit, data_inceput,
                                       created_by, updated_by)
    values (v_org, v_foaie_b, v_c_b1, '2D1R0D0L0N3CYH94', v_zi, v_u_b, v_u_b)
    returning id into v_ub2;
    get diagnostics v_n = row_count;
    reset role;
    if v_n = 1 then
      raise notice '  ✓ (P12b) redeschisă în ciornă: UIT acceptat (1 rând)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (P12b) % rânduri', v_n;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (P12b) după redeschidere: % (%)', sqlerrm, sqlstate;
  end;

  -- (P13) ciorna ștearsă logic: codurile ei o urmează. Foaia lui Bogdan a fost
  -- trimisă o dată (P12), deci are număr FP: din 0200 §E4 șoferul n-o mai poate
  -- șterge (P0001), iar ștergerea logică o face cine scrie orice foaie
  -- (`trip_sheets:update = all`, org_admin), ca anulare. Cascada e aceeași.
  v_total := v_total + 2;
  perform set_config('request.jwt.claim.sub', v_u_b::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set deleted_at = now(), updated_by = v_u_b where id = v_foaie_b;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (P13a) șoferul a șters o ciornă numerotată (0200 §E4 cere anularea)';
  exception when others then
    reset role;
    if sqlstate = 'P0001' and sqlerrm like 'Foaia are deja numărul%' then
      raise notice '  ✓ (P13a) ciorna numerotată: șoferul primește P0001 (0200 §E4)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (P13a) refuzat din alt motiv: % (%)', sqlerrm, sqlstate;
    end if;
  end;
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set deleted_at = now(), updated_by = v_u_adm where id = v_foaie_b;
    reset role;
    select count(*) into v_n from public.trip_sheet_uit u
     where u.id = v_ub2 and u.deleted_at is not null;
    if v_n = 1 then
      raise notice '  ✓ (P13) ciorna ștearsă logic: UIT-ul ei are deleted_at (foi_sterge_uit)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (P13) UIT-ul foii șterse a rămas viu';
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (P13) ștergerea ciornei: % (%)', sqlerrm, sqlstate;
  end;

  -- (P14) foaia managerului: trimisă, aprobată de org_admin, stornată
  v_total := v_total + 1;
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  update public.trip_sheets set status = 'trimis', updated_by = v_u_mgr where id = v_foaie_m;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set status = 'aprobat', updated_by = v_u_adm where id = v_foaie_m;
    update public.trip_sheets set deleted_at = now(), updated_by = v_u_adm where id = v_foaie_m;
    get diagnostics v_n = row_count;
    reset role;
    select count(*) into v_text from public.trip_sheet_uit u
     where u.id = v_um and u.deleted_at is not null and u.updated_by = v_u_adm;
    if v_n = 1 and v_text = '1' then
      raise notice '  ✓ (P14) foaia aprobată, stornată: UIT-ul ei are deleted_at (cascada trece de garda de stare)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (P14) stornarea: % rânduri pe foaie, % UIT șterse', v_n, v_text;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (P14) stornarea foii aprobate: % (%)', sqlerrm, sqlstate;
  end;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA FLOTA UIT: % din % verificări picate', v_esecuri, v_total;
  end if;
  raise notice '  TOATE cele % de verificări au trecut.', v_total;
  raise notice '';
end;
$$;
