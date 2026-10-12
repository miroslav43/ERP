-- tests/rls/proba-flota-fiscal.sql
--
-- FLOTA, DUPĂ 0202: REGIMUL FISCAL AL VEHICULULUI, NORMA PROPRIE DE CONSUM,
-- REGIMUL DE IMPOZITARE ȘI FAPTELE AVANTAJULUI ÎN NATURĂ.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- (1)  org_admin înregistrează regimul `limitat_50` al vehiculului   [POZITIVĂ];
-- (2)  „peste 3.500 kg sau 9 locuri” pe un vehicul ușor (fișa o spune): P0001;
-- (3)  `exceptat_categorie` fără excepție: 23514;
-- (4)  comodat fără proprietar: 23514; cu proprietar din altă firmă: 23503;
-- (5)  vehiculul altei firme: P0001;
-- (6)  a doua perioadă care începe în aceeași zi: 23505;
-- (7)  trimiterea foii ia norma în vigoare în ZIUA foii, nu pe cea mai nouă
--      [POZITIVĂ];
-- (8)  o normă adăugată după trimitere nu schimbă foaia trimisă;
-- (9)  vehiculul fără normă: instantaneul cade pe consumul declarat [POZITIVĂ];
-- (10) rândul șters nu se mai modifică, iar rândul nu se mută pe alt vehicul (P0001);
-- (11) luna fiscală: zilele cu deducere integrală se numără pe zile, norma e
--      cea de la sfârșitul lunii, foaia trimisă e „neaprobată” [POZITIVĂ];
-- (12) org_admin își scrie regimul de impozitare                     [POZITIVĂ];
-- (13) hr află faptele avantajului (alocarea cu folosință personală,
--      valoarea de intrare, regimul) [POZITIVĂ], dar nu vede regimul în tabelă;
-- (14) managerul și angajatul: zero rânduri pe regim, normă și avantaj, iar
--      scrierea managerului e refuzată (42501);
-- (15) cu Salarizarea oprită, faptele avantajului nu ies (zero rânduri);
-- (16) super_admin (platform_admins, NU membru) citește regimurile și faptele [POZITIVĂ];
-- (17) matricea scrierilor reale pe cele cinci roluri (skill-ul `administrativo-proba-reala`):
--      DOAR org_admin scrie regimul și norma (verificate în (1) și (7)); hr, manager,
--      employee și super_admin (nu e membru) sunt refuzați (42501) la INSERT pe
--      ambele tabele, iar `organizations.regim_impozitare` se schimbă doar cu
--      `organizations:update`: hr, manager, employee = ZERO rânduri (refuz tăcut
--      cerut de USING), nu eroare;
-- (18) corectura: regimul „peste 3.500 kg” pus pe o fișă incompletă se poate
--      șterge după ce fișa a fost completată (vehicul ușor), iar perioada de
--      înlocuire intră în aceeași zi [POZITIVĂ];
-- (19) șoferul (employee) își trimite singur foaia, iar norma proprie, dintr-o tabelă
--      pe care el nu o vede, ajunge în instantaneu: trigger-ul DEFINER nu cere
--      drepturi pe tabela de norme rolului care trimite [POZITIVĂ];
-- (20) firma străină: administratorul unei firme nu citește și nu șterge fiscalul
--      altei firme, nici prin tabele, nici prin cele două funcții (zero rânduri).
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh --pastreaza
--   psql … -f tests/rls/proba-flota-fiscal.sql
\set ON_ERROR_STOP on
\pset pager off

begin;

do $$
declare
  v_sufix     text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org       uuid := gen_random_uuid();
  v_org_alta  uuid := gen_random_uuid();
  v_u_admin   uuid := gen_random_uuid();
  v_u_hr      uuid := gen_random_uuid();
  v_u_mgr     uuid := gen_random_uuid();
  v_u_ang     uuid := gen_random_uuid();
  v_u_sa      uuid := gen_random_uuid();
  v_e_mgr     uuid := gen_random_uuid();
  v_e_ang     uuid := gen_random_uuid();
  v_e_strain  uuid := gen_random_uuid();
  v_veh       uuid := gen_random_uuid();
  v_veh_fara  uuid := gen_random_uuid();
  v_veh_strain uuid := gen_random_uuid();
  v_regim     uuid;
  v_foaie     uuid;
  v_foaie2    uuid;
  v_foaie3    uuid;
  v_zi        date := app.azi_local();
  -- O lună încheiată: nimic din probă nu cere o dată din viitor.
  v_luna      date := (date_trunc('month', app.azi_local()) - interval '2 months')::date;
  v_zi_foaie  date;
  v_zile_luna int;
  v_norma     numeric;
  v_n         integer;
  v_m         integer;
  v_r         record;
  v_rol       text;
  v_k         integer;
  v_esecuri   int := 0;
begin
  raise notice '';
  raise notice '  PROBA „FLOTA — FISCAL" (0202)';
  raise notice '  ─────────────────────────────────────────────────────────';

  v_zi_foaie  := v_luna + 14;
  v_zile_luna := ((v_luna + interval '1 month')::date - v_luna);

  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-fiscal-' || v_sufix, 'Proba Fiscal SRL',
     'RO' || (88000000 + (random() * 900000)::int)::text),
    (v_org_alta, 'proba-fiscal-alta-' || v_sufix, 'Altă Firmă SRL',
     'RO' || (89000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select o, f.feature_key, true, now() from public.features f, unnest(array[v_org, v_org_alta]) o;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_admin, 'fis-adm-' || v_sufix || '@proba.test', now()),
    (v_u_hr,    'fis-hr-'  || v_sufix || '@proba.test', now()),
    (v_u_mgr,   'fis-mgr-' || v_sufix || '@proba.test', now()),
    (v_u_ang,   'fis-ang-' || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_admin, 'org_admin'),
    (v_org, v_u_hr,    'hr'),
    (v_org, v_u_mgr,   'manager'),
    (v_org, v_u_ang,   'employee');

  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_mgr, v_org, 'FI-M', 'Mihai', 'Manager', v_zi - 500, 'activ', v_u_mgr, null);
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_ang,    v_org,      'FI-A', 'Ana',   'Șofer',   v_zi - 400, 'activ', v_u_ang, v_e_mgr),
    (v_e_strain, v_org_alta, 'FI-X', 'Xenia', 'Străină', v_zi - 400, 'activ', null,    null);

  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent, masa_maxima_kg,
                               numar_locuri, consum_mediu_declarat, valoare_achizitie, created_by, updated_by)
  values
    (v_veh, v_org, 'B' || (100 + (random() * 800)::int)::text || 'FIS', 'Dacia', 'Duster', 10000, 1800, 5, 7.5,
     90000, v_u_admin, v_u_admin),
    (v_veh_fara, v_org, 'B' || (100 + (random() * 800)::int)::text || 'FFN', 'Dacia', 'Logan', 20000, null, null, 5.8,
     50000, v_u_admin, v_u_admin),
    (v_veh_strain, v_org_alta, 'TM' || (10 + (random() * 80)::int)::text || 'FIX', 'Dacia', 'Logan', 1000, null, null,
     null, null, v_u_admin, v_u_admin);

  -- Ana are mașina din luna probei, cu folosință personală (F2).
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, folosinta_personala,
                                          km_predare, created_by, updated_by)
  values (v_org, v_veh, v_e_ang, (v_luna - 20)::timestamp at time zone 'Europe/Bucharest', true, 10000,
          v_u_admin, v_u_admin);

  -- (1) org_admin: regimul limitat, de dinaintea lunii probei
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_fiscal_regimes (organization_id, vehicle_id, valabil_de_la, regim, motiv,
                                               created_by, updated_by)
    values (v_org, v_veh, v_luna - 30, 'limitat_50', '  Folosit și în interes personal  ', v_u_admin, v_u_admin)
    returning id into v_regim;
    reset role;
    if (select motiv from public.vehicle_fiscal_regimes where id = v_regim) = 'Folosit și în interes personal' then
      raise notice '  ✓ (1) org_admin înregistrează regimul limitat la 50%%; motivul se curăță de spații';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (1) motivul n-a fost curățat';
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) org_admin nu poate înregistra regimul: % (%)', sqlerrm, sqlstate;
  end;

  -- (2) peste 3.500 kg pe un vehicul de 1.800 kg și 5 locuri
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_fiscal_regimes (organization_id, vehicle_id, valabil_de_la, regim, motiv)
    values (v_org, v_veh, v_luna - 5, 'peste_3500_sau_9_locuri', 'Încercare');
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) regimul „peste 3.500 kg” a trecut pe un vehicul ușor';
  exception when sqlstate 'P0001' then
    reset role;
    raise notice '  ✓ (2) „peste 3.500 kg sau 9 locuri” pe un vehicul ușor: P0001 (%)', left(sqlerrm, 60);
  when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) alt refuz: % (%)', sqlerrm, sqlstate;
  end;

  -- (3) exceptat fără excepție
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_fiscal_regimes (organization_id, vehicle_id, valabil_de_la, regim, motiv)
    values (v_org, v_veh, v_luna - 4, 'exceptat_categorie', 'Fără excepție');
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) exceptat fără excepție a trecut';
  exception when check_violation then
    reset role;
    raise notice '  ✓ (3) `exceptat_categorie` fără excepție: 23514';
  when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) alt refuz: % (%)', sqlerrm, sqlstate;
  end;

  -- (4) comodat fără proprietar, apoi cu proprietar din altă firmă
  v_n := 0;
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_fiscal_regimes (organization_id, vehicle_id, valabil_de_la, regim, motiv, titlu_folosinta)
    values (v_org, v_veh, v_luna - 3, 'limitat_50', 'Mașina directorului', 'comodat');
  exception when check_violation then
    v_n := v_n + 1;
  end;
  begin
    insert into public.vehicle_fiscal_regimes (organization_id, vehicle_id, valabil_de_la, regim, motiv,
                                               titlu_folosinta, proprietar_employee_id)
    values (v_org, v_veh, v_luna - 3, 'limitat_50', 'Mașina directorului', 'comodat', v_e_strain);
  exception when foreign_key_violation then
    v_n := v_n + 10;
  end;
  reset role;
  if v_n = 11 then
    raise notice '  ✓ (4) comodat fără proprietar: 23514; proprietar din altă firmă: 23503';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) cod %, așteptat 11', v_n;
  end if;

  -- (5) vehiculul altei firme
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_consumption_norms (organization_id, vehicle_id, valabil_de_la, l_100km)
    values (v_org, v_veh_strain, v_luna - 3, 6);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) norma pe vehiculul altei firme a trecut';
  exception when sqlstate 'P0001' then
    reset role;
    raise notice '  ✓ (5) vehiculul altei firme: P0001';
  when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) alt refuz: % (%)', sqlerrm, sqlstate;
  end;

  -- (6) două perioade din aceeași zi
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_fiscal_regimes (organization_id, vehicle_id, valabil_de_la, regim, motiv)
    values (v_org, v_veh, v_luna - 30, 'integral_exclusiv_economic', 'Dublură');
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) a doua perioadă din aceeași zi a trecut';
  exception when unique_violation then
    reset role;
    raise notice '  ✓ (6) a doua perioadă din aceeași zi: 23505';
  when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) alt refuz: % (%)', sqlerrm, sqlstate;
  end;

  -- (7) două norme: 6,40 de dinainte, 8,10 de după ziua foii
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_consumption_norms (organization_id, vehicle_id, valabil_de_la, l_100km,
                                                  decizie_numar, decizie_data)
    values (v_org, v_veh, v_luna - 30, 6.40, ' D-12 ', v_luna - 31),
           (v_org, v_veh, v_zi_foaie + 1, 8.10, 'D-13', v_zi_foaie);
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                    created_by, updated_by)
    values (v_org, v_veh, v_e_ang, (v_zi_foaie + time '07:30') at time zone 'Europe/Bucharest', 10000,
            v_u_admin, v_u_admin)
    returning id into v_foaie;
    insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la, de_la_loc,
                                         pana_la_loc, scop, km_plecare, km_sosire, created_by, updated_by)
    values (v_org, v_foaie, (v_zi_foaie + time '08:00') at time zone 'Europe/Bucharest',
            (v_zi_foaie + time '09:00') at time zone 'Europe/Bucharest',
            'Sediu', 'Client', 'Livrare', 10000, 10060, v_u_admin, v_u_admin);
    update public.trip_sheets set status = 'trimis', updated_by = v_u_admin where id = v_foaie;
    reset role;
    select norma_l_100km into v_norma from public.trip_sheets where id = v_foaie;
    if v_norma = 6.40 and (select decizie_numar from public.vehicle_consumption_norms
                            where vehicle_id = v_veh and l_100km = 6.40) = 'D-12' then
      raise notice '  ✓ (7) foaia trimisă ia norma din ziua ei (6,40), nu pe cea de după (8,10)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (7) norma instantaneului: %', v_norma;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) foaia nu s-a putut trimite: % (%)', sqlerrm, sqlstate;
  end;

  -- (8) o normă nouă, din ziua foii, după trimitere
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  insert into public.vehicle_consumption_norms (organization_id, vehicle_id, valabil_de_la, l_100km)
  values (v_org, v_veh, v_zi_foaie, 9.99);
  reset role;
  if (select norma_l_100km from public.trip_sheets where id = v_foaie) = 6.40 then
    raise notice '  ✓ (8) norma adăugată după trimitere nu schimbă foaia trimisă';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) foaia trimisă și-a schimbat norma';
  end if;

  -- (9) vehiculul fără normă: consumul declarat
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                    created_by, updated_by)
    values (v_org, v_veh_fara, v_e_mgr, (v_zi_foaie + time '07:30') at time zone 'Europe/Bucharest', 20000,
            v_u_admin, v_u_admin)
    returning id into v_foaie2;
    insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la, de_la_loc,
                                         pana_la_loc, scop, km_plecare, km_sosire, created_by, updated_by)
    values (v_org, v_foaie2, (v_zi_foaie + time '08:00') at time zone 'Europe/Bucharest',
            (v_zi_foaie + time '09:00') at time zone 'Europe/Bucharest',
            'Sediu', 'Furnizor', 'Aprovizionare', 20000, 20030, v_u_admin, v_u_admin);
    update public.trip_sheets set status = 'trimis', updated_by = v_u_admin where id = v_foaie2;
    reset role;
    if (select norma_l_100km from public.trip_sheets where id = v_foaie2) = 5.8 then
      raise notice '  ✓ (9) fără normă proprie, instantaneul ia consumul declarat (5,80)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (9) norma instantaneului: %', (select norma_l_100km from public.trip_sheets where id = v_foaie2);
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) a doua foaie nu s-a putut trimite: % (%)', sqlerrm, sqlstate;
  end;

  -- (10) ștergerea e definitivă; rândul nu se mută
  v_n := 0;
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    update public.vehicle_consumption_norms set vehicle_id = v_veh_fara
     where vehicle_id = v_veh and l_100km = 9.99;
  exception when sqlstate 'P0001' then
    v_n := v_n + 1;
  end;
  update public.vehicle_consumption_norms set deleted_at = now()
   where vehicle_id = v_veh and l_100km = 9.99 and deleted_at is null;
  -- Readucerea: USING (`deleted_at is null`) ascunde rândul, deci ZERO rânduri,
  -- fără eroare (triggerul ar da P0001 dacă politica l-ar lăsa să ajungă acolo).
  with readuse as (
    update public.vehicle_consumption_norms set deleted_at = null
     where vehicle_id = v_veh and l_100km = 9.99 returning 1
  ) select v_n + 10 * (1 - count(*))::int into v_n from readuse;
  reset role;
  if v_n = 11 then
    raise notice '  ✓ (10) rândul nu se mută pe alt vehicul (P0001), iar cel șters nu mai revine (zero rânduri)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10) cod %, așteptat 11', v_n;
  end if;

  -- (11) luna fiscală: integral din a 11-a zi a lunii
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  insert into public.vehicle_fiscal_regimes (organization_id, vehicle_id, valabil_de_la, regim, motiv)
  values (v_org, v_veh, v_luna + 10, 'integral_exclusiv_economic', 'Devine mașină de serviciu');
  select * into v_r from public.flota_fiscal_luna(v_org, v_luna + 3) f where f.vehicle_id = v_veh;
  select count(*) into v_m from public.flota_fiscal_luna(v_org, v_luna) f
   where f.vehicle_id = v_veh_fara and f.regim is null and f.zile_fara_regim = v_zile_luna;
  reset role;
  if v_r.regim = 'integral_exclusiv_economic' and v_r.zile_integral = v_zile_luna - 10
     and v_r.zile_luna = v_zile_luna and v_r.zile_fara_regim = 0
     and v_r.foi_aprobate = 0 and v_r.foi_neaprobate = 1 and v_r.norma_l_100km = 8.10 and v_m = 1 then
    raise notice '  ✓ (11) luna fiscală: % zile integrale din %, foaia trimisă e neaprobată, vehiculul fără regim are toate zilele „fără regim”',
      v_r.zile_integral, v_r.zile_luna;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (11) luna fiscală: % (fără regim: %)', row_to_json(v_r), v_m;
  end if;

  -- (12) regimul de impozitare
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  with schimbate as (
    update public.organizations set regim_impozitare = 'profit' where id = v_org returning 1
  ) select count(*) into v_n from schimbate;
  reset role;
  if v_n = 1 then
    raise notice '  ✓ (12) org_admin își scrie regimul de impozitare';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (12) org_admin: % rânduri', v_n;
  end if;

  -- (13) hr: faptele avantajului, fără tabela regimurilor
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  select count(*) into v_n from public.vehicle_fiscal_regimes where organization_id = v_org;
  select * into v_r from public.avantaj_natura_flota(v_org, v_e_ang, v_luna) a;
  select count(*) into v_m from public.avantaj_natura_flota(v_org, v_e_ang, v_luna);
  reset role;
  if v_n = 0 and v_m = 1 and v_r.regim = 'integral_exclusiv_economic' and v_r.valoare_intrare = 90000
     and v_r.titlu_folosinta = 'proprietate' and v_r.regim_impozitare = 'profit' then
    raise notice '  ✓ (13) hr află alocarea cu folosință personală, valoarea de intrare și regimul, nu și tabela';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (13) hr: % regimuri, % fapte, %', v_n, v_m, row_to_json(v_r);
  end if;

  -- (14) managerul și angajatul
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  select count(*) into v_n from public.vehicle_fiscal_regimes where organization_id = v_org;
  select v_n + count(*) into v_n from public.vehicle_consumption_norms where organization_id = v_org;
  select v_n + count(*) into v_n from public.avantaj_natura_flota(v_org, v_e_ang, v_luna);
  begin
    insert into public.vehicle_consumption_norms (organization_id, vehicle_id, valabil_de_la, l_100km)
    values (v_org, v_veh, v_luna - 1, 7);
    v_n := v_n + 100;
  exception when insufficient_privilege then
    null;
  end;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  select v_n + count(*) into v_n from public.vehicle_fiscal_regimes where organization_id = v_org;
  select v_n + count(*) into v_n from public.avantaj_natura_flota(v_org, v_e_ang, v_luna);
  select v_n + count(*) into v_n from public.flota_fiscal_luna(v_org, v_luna) f where f.regim is not null;
  reset role;
  if v_n = 0 then
    raise notice '  ✓ (14) managerul și angajatul: zero rânduri fiscale, iar scrierea managerului e refuzată (42501)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (14) % rânduri sau scrieri, așteptat 0', v_n;
  end if;

  -- (15) Salarizarea oprită
  update public.organization_features set enabled = false where organization_id = v_org and feature_key = 'payroll';
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  select count(*) into v_n from public.avantaj_natura_flota(v_org, v_e_ang, v_luna);
  reset role;
  update public.organization_features set enabled = true where organization_id = v_org and feature_key = 'payroll';
  if v_n = 0 then
    raise notice '  ✓ (15) cu Salarizarea oprită, faptele avantajului nu ies';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (15) % rânduri cu Salarizarea oprită', v_n;
  end if;

  -- (16) super_admin
  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_sa, 'fis-sa-' || v_sufix || '@proba.test', now());
  insert into public.platform_admins (user_id) values (v_u_sa);
  perform set_config('request.jwt.claim.sub', v_u_sa::text, true);
  set local role authenticated;
  select count(*) into v_n from public.vehicle_fiscal_regimes where organization_id = v_org and deleted_at is null;
  select count(*) into v_m from public.avantaj_natura_flota(v_org, v_e_ang, v_luna);
  reset role;
  if v_n = 2 and v_m = 1 then
    raise notice '  ✓ (16) super_admin citește cele două perioade și faptele avantajului';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (16) super_admin: % perioade, % fapte', v_n, v_m;
  end if;

  -- (17) matricea scrierilor reale: refuzurile celorlalte roluri, NUMĂRATE
  v_n := 0;
  v_m := 0;
  foreach v_rol in array array['hr', 'manager', 'employee', 'super_admin'] loop
    perform set_config('request.jwt.claim.sub',
      (case v_rol when 'hr' then v_u_hr when 'manager' then v_u_mgr
                  when 'employee' then v_u_ang else v_u_sa end)::text, true);
    set local role authenticated;
    begin
      insert into public.vehicle_fiscal_regimes (organization_id, vehicle_id, valabil_de_la, regim, motiv)
      values (v_org, v_veh, v_luna - 100, 'limitat_50', 'Încercare ' || v_rol);
      v_m := v_m + 1;
    exception when insufficient_privilege then
      v_n := v_n + 1;
    end;
    begin
      insert into public.vehicle_consumption_norms (organization_id, vehicle_id, valabil_de_la, l_100km)
      values (v_org, v_veh, v_luna - 100, 7);
      v_m := v_m + 1;
    exception when insufficient_privilege then
      v_n := v_n + 1;
    end;
    reset role;
  end loop;
  -- `organizations`: hr, manager, employee = zero rânduri; reușita lui org_admin e în (12).
  v_k := 0;
  foreach v_rol in array array['hr', 'manager', 'employee'] loop
    perform set_config('request.jwt.claim.sub',
      (case v_rol when 'hr' then v_u_hr when 'manager' then v_u_mgr else v_u_ang end)::text, true);
    set local role authenticated;
    with schimbate as (
      update public.organizations set regim_impozitare = 'micro' where id = v_org returning 1
    ) select v_k + count(*) into v_k from schimbate;
    reset role;
  end loop;
  if v_n = 8 and v_m = 0 and v_k = 0
     and (select regim_impozitare from public.organizations where id = v_org) = 'profit' then
    raise notice '  ✓ (17) hr, manager, employee și super_admin: 8 INSERT-uri refuzate (42501), 0 reușite; regimul de impozitare rămâne „profit”';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (17) refuzate %, reușite %, UPDATE organizations reușite %', v_n, v_m, v_k;
  end if;

  -- (18) corectura prevăzută: regimul greșit se șterge și se înlocuiește în aceeași
  --      zi, chiar dacă fișa vehiculului a fost completată între timp. Triggerul
  --      refuza ștergerea logică (UPDATE) pe motivul „peste 3.500 kg pe un
  --      vehicul ușor”, deși regimul rămâne neschimbat pe rândul șters: exact
  --      rândul greșit nu mai putea fi corectat (revizia F10).
  v_n := 0;
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    -- Fișa e incompletă (masa și locurile necunoscute): încadrarea trece.
    insert into public.vehicle_fiscal_regimes (organization_id, vehicle_id, valabil_de_la, regim, motiv,
                                               created_by, updated_by)
    values (v_org, v_veh_fara, v_luna + 20, 'peste_3500_sau_9_locuri', 'Fișă incompletă', v_u_admin, v_u_admin)
    returning id into v_regim;
    v_n := v_n + 1;
    -- Se completează fișa: 1.800 kg, 5 locuri (vehicul ușor).
    update public.vehicles set masa_maxima_kg = 1800, numar_locuri = 5, updated_by = v_u_admin
     where id = v_veh_fara;
    get diagnostics v_k = row_count;
    v_n := v_n + 10 * v_k;
    -- Ștergerea logică a încadrării greșite.
    with sterse as (
      update public.vehicle_fiscal_regimes set deleted_at = now(), updated_by = v_u_admin
       where id = v_regim and deleted_at is null returning 1
    ) select v_n + 100 * count(*)::int into v_n from sterse;
    -- Perioada de înlocuire, în aceeași zi.
    insert into public.vehicle_fiscal_regimes (organization_id, vehicle_id, valabil_de_la, regim, motiv,
                                               created_by, updated_by)
    values (v_org, v_veh_fara, v_luna + 20, 'limitat_50', 'Corectură', v_u_admin, v_u_admin);
    v_n := v_n + 1000;
    reset role;
    if v_n = 1111 then
      raise notice '  ✓ (18) regimul greșit se șterge chiar după completarea fișei, iar perioada de înlocuire intră în aceeași zi';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (18) cod %, așteptat 1111', v_n;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (18) corectura nu merge (cod parțial %): % (%)', v_n, sqlerrm, sqlstate;
  end;

  -- (19) rolul care chiar trimite foi: șoferul, cu norma lui proprie în instantaneu
  v_k := 0;
  v_m := -1;
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                    created_by, updated_by)
    values (v_org, v_veh, v_e_ang, (v_zi_foaie + 2 + time '07:30') at time zone 'Europe/Bucharest', 10060,
            v_u_ang, v_u_ang)
    returning id into v_foaie3;
    insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la, de_la_loc,
                                         pana_la_loc, scop, km_plecare, km_sosire, created_by, updated_by)
    values (v_org, v_foaie3, (v_zi_foaie + 2 + time '08:00') at time zone 'Europe/Bucharest',
            (v_zi_foaie + 2 + time '09:00') at time zone 'Europe/Bucharest',
            'Sediu', 'Client', 'Livrare', 10060, 10120, v_u_ang, v_u_ang);
    with trimise as (
      update public.trip_sheets set status = 'trimis', updated_by = v_u_ang where id = v_foaie3 returning 1
    ) select count(*) into v_k from trimise;
    select count(*) into v_m from public.vehicle_consumption_norms where organization_id = v_org;
    reset role;
    select norma_l_100km into v_norma from public.trip_sheets where id = v_foaie3;
    if v_k = 1 and v_m = 0 and v_norma = 8.10 then
      raise notice '  ✓ (19) șoferul își trimite foaia; norma lui proprie (8,10) intră în instantaneu, deși tabela de norme îi e invizibilă';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (19) trimise %, norme vizibile șoferului %, norma instantaneului %', v_k, v_m, v_norma;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (19) șoferul nu și-a putut trimite foaia: % (%)', sqlerrm, sqlstate;
  end;

  -- (20) firma străină: fiscalul altei firme rămâne invizibil și neatins
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, folosinta_personala,
                                          km_predare, created_by, updated_by)
  values (v_org_alta, v_veh_strain, v_e_strain, (v_luna - 20)::timestamp at time zone 'Europe/Bucharest', true,
          1000, v_u_admin, v_u_admin);
  insert into public.vehicle_fiscal_regimes (organization_id, vehicle_id, valabil_de_la, regim, motiv,
                                             created_by, updated_by)
  values (v_org_alta, v_veh_strain, v_luna - 30, 'integral_exclusiv_economic', 'Altă firmă', v_u_admin, v_u_admin)
  returning id into v_regim;
  insert into public.vehicle_consumption_norms (organization_id, vehicle_id, valabil_de_la, l_100km,
                                                created_by, updated_by)
  values (v_org_alta, v_veh_strain, v_luna - 30, 5.5, v_u_admin, v_u_admin);
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  select count(*) into v_n from public.vehicle_fiscal_regimes where organization_id = v_org_alta;
  select v_n + count(*) into v_n from public.vehicle_consumption_norms where organization_id = v_org_alta;
  select v_n + count(*) into v_n from public.flota_fiscal_luna(v_org_alta, v_luna);
  select v_n + count(*) into v_n from public.avantaj_natura_flota(v_org_alta, v_e_strain, v_luna);
  with sterse as (
    update public.vehicle_fiscal_regimes set deleted_at = now() where id = v_regim returning 1
  ) select v_n + count(*) into v_n from sterse;
  with sterse as (
    update public.vehicle_consumption_norms set deleted_at = now() where organization_id = v_org_alta returning 1
  ) select v_n + count(*) into v_n from sterse;
  reset role;
  -- Rândul străin există și e încă activ: dovada că UPDATE-ul n-a atins nimic
  -- (altfel un zero „fals” ar fi putut veni din fixture-ul lipsă).
  select count(*) into v_m from public.vehicle_fiscal_regimes
   where id = v_regim and deleted_at is null;
  if v_n = 0 and v_m = 1 then
    raise notice '  ✓ (20) firma străină: zero rânduri prin tabele și funcții, iar UPDATE-ul de ștergere afectează zero rânduri';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (20) rânduri străine vizibile sau șterse: %, regimul străin încă activ: %', v_n, v_m;
  end if;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA FLOTA FISCAL: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE cele 20 de verificări au trecut.';
  raise notice '';
end;
$$;

rollback;
