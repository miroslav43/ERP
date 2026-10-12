-- tests/rls/proba-flota-foaia-zilnica.sql
--
-- FLOTA, DUPĂ 0197: FOAIA ZILNICĂ CU CURSE, NUMEROTAREA, UNICITATEA PE ZI,
-- SUPRAPUNERILE ȘI ȘABLOANELE DE TRASEU. Pe seed-ul real al rolurilor.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- Cursele (șoferul Ana, pe mașina ei, ziua D):
--  (1) întocmește foaia zilei                                       [POZITIVĂ];
--  (2) adaugă două curse; antetul ia prima plecare și ultima sosire [POZITIVĂ];
--  (3) o cursă inserată la mijloc renumerotează ordinea (1, 2, 3)  [POZITIVĂ];
--  (4) km de plecare sub sosirea cursei precedente: P0001;
--  (5) cursă suprapusă peste alta de pe aceeași foaie: P0001;
--  (6) cursă care pleacă în altă zi decât a foii: P0001;
--  (7) kilometrajul antetului scris direct, pe o foaie cu curse: P0001;
--  (8) trimiterea cu o cursă neîncheiată: P0001;
--  (9) trimiterea primește numărul FP-AAAA-NNNNN și instantaneul vehiculului [POZITIVĂ];
-- Paritatea stării (0197 §D1) pe curse:
--  (10) pe foaia trimisă: cursa NU se adaugă, NU se modifică, NU se șterge (P0001);
--  (11) retragerea în ciornă păstrează numărul                     [POZITIVĂ];
--  (12) ștergerea logică a ultimei curse recalculează antetul      [POZITIVĂ];
--  (13) regresul pus pe prima cursă cade la retrimitere (P0001), corectat trece,
--       iar numărul rămâne același                                  [POZITIVĂ];
--  (14) managerul aprobă; pe foaia aprobată cursa nu se mai atinge (P0001);
--  (15) cursa ștearsă nu se reînvie (zero rânduri, rămâne ștearsă);
-- Unicitatea și suprapunerile:
--  (16) a doua foaie activă pe același vehicul și zi: 23505;
--  (17) aceeași șoferiță, pe pool, în aceeași oră: P0001 (nu conduce două mașini);
--  (18) foaia altui șofer primește numărul următor                 [POZITIVĂ];
-- Drepturile:
--  (19) managerul NU adaugă o cursă pe ciorna subordonatului (42501);
--  (20) administratorul creează un șablon, șoferul îl citește, dar nu scrie unul;
--  (21) `hr` nu vede nicio cursă și niciun șablon; `super_admin` vede cursele.
-- Revizia F4 (santinela):
--  (22) foaia rămasă fără curse (ultima ștearsă) nu se trimite: P0001;
--  (23) alimentarea rămasă în afara curselor, după mutarea cursei, oprește trimiterea: P0001.
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
  v_u_admin  uuid := gen_random_uuid();
  v_u_mgr    uuid := gen_random_uuid();
  v_u_a      uuid := gen_random_uuid();
  v_u_b      uuid := gen_random_uuid();
  v_u_hr     uuid := gen_random_uuid();
  v_u_sa     uuid := gen_random_uuid();
  v_e_mgr    uuid := gen_random_uuid();
  v_e_a      uuid := gen_random_uuid();
  v_e_b      uuid := gen_random_uuid();
  v_v_a      uuid := gen_random_uuid();
  v_v_b      uuid := gen_random_uuid();
  v_v_pool   uuid := gen_random_uuid();
  v_foaie    uuid;
  v_foaie_b  uuid;
  v_foaie_p  uuid;
  v_c1       uuid;
  v_c2       uuid;
  v_c3       uuid;
  v_cm       uuid;
  v_numar    text;
  v_numar_b  text;
  v_text     text;
  v_n        int;
  v_km       int;
  v_status   text;
  v_esecuri  int := 0;
begin
  raise notice '';
  raise notice '  PROBA „FLOTA — FOAIA ZILNICĂ" (0197)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-flota-zi-' || v_sufix, 'Proba Foaia Zilnică SRL',
     'RO' || (85000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select v_org, f.feature_key, true, now() from public.features f;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_admin, 'zi-adm-' || v_sufix || '@proba.test', now()),
    (v_u_mgr,   'zi-mgr-' || v_sufix || '@proba.test', now()),
    (v_u_a,     'zi-a-'   || v_sufix || '@proba.test', now()),
    (v_u_b,     'zi-b-'   || v_sufix || '@proba.test', now()),
    (v_u_hr,    'zi-hr-'  || v_sufix || '@proba.test', now()),
    (v_u_sa,    'zi-sa-'  || v_sufix || '@proba.test', now());
  insert into public.platform_admins (user_id) values (v_u_sa);
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_admin, 'org_admin'),
    (v_org, v_u_mgr,   'manager'),
    (v_org, v_u_a,     'employee'),
    (v_org, v_u_b,     'employee'),
    (v_org, v_u_hr,    'hr');
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_mgr, v_org, 'ZI-M', 'Mihai', 'Manager', app.azi_local() - 500, 'activ', v_u_mgr, null);
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_a, v_org, 'ZI-A', 'Ana',    'Șofer', app.azi_local() - 400, 'activ', v_u_a, v_e_mgr),
    (v_e_b, v_org, 'ZI-B', 'Bogdan', 'Șofer', app.azi_local() - 400, 'activ', v_u_b, v_e_mgr);

  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent, pool,
                               consum_mediu_declarat, created_by, updated_by) values
    (v_v_a,    v_org, 'B' || (100 + (random() * 800)::int)::text || 'ZIA', 'Dacia', 'Logan',   10000, false, 6.5, v_u_admin, v_u_admin),
    (v_v_b,    v_org, 'B' || (100 + (random() * 800)::int)::text || 'ZIB', 'Dacia', 'Duster',  20000, false, 7.2, v_u_admin, v_u_admin),
    (v_v_pool, v_org, 'B' || (100 + (random() * 800)::int)::text || 'ZIP', 'Dacia', 'Jogger',  30000, true,  6.8, v_u_admin, v_u_admin);
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, created_by, updated_by) values
    (v_org, v_v_a, v_e_a, now() - interval '30 days', v_u_admin, v_u_admin),
    (v_org, v_v_b, v_e_b, now() - interval '30 days', v_u_admin, v_u_admin);

  -- ═══ Cursele ══════════════════════════════════════════════════════════════

  -- (1)
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                    numar, created_by, updated_by)
    values (v_org, v_v_a, v_e_a, pg_temp.la(v_zi, '07:30'), 10000, 'FP-FORJAT-1', v_u_a, v_u_a)
    returning id, numar into v_foaie, v_numar;
    reset role;
    if v_foaie is not null and v_numar is null then
      raise notice '  ✓ (1) șoferița întocmește foaia zilei, fără număr ales de ea';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (1) foaia are numărul „%” din payload', v_numar;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) șoferița nu-și poate întocmi foaia: % (%)', sqlerrm, sqlstate;
  end;

  -- (2)
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la,
                                         de_la_loc, pana_la_loc, scop, km_plecare, km_sosire,
                                         created_by, updated_by)
    values (v_org, v_foaie, pg_temp.la(v_zi, '08:00'), pg_temp.la(v_zi, '09:00'),
            'Sediu', 'Client Ploiești', 'Livrare marfă', 10000, 10040, v_u_a, v_u_a)
    returning id into v_c1;
    insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la,
                                         de_la_loc, pana_la_loc, scop, km_plecare, km_sosire,
                                         created_by, updated_by)
    values (v_org, v_foaie, pg_temp.la(v_zi, '10:00'), pg_temp.la(v_zi, '11:30'),
            'Depozit', 'Client Câmpina', 'Livrare marfă', 10060, 10100, v_u_a, v_u_a)
    returning id into v_c2;
    reset role;
    select count(*) filter (where t.plecare_la = pg_temp.la(v_zi, '08:00')
                              and t.sosire_la = pg_temp.la(v_zi, '11:30')
                              and t.km_plecare = 10000 and t.km_sosire = 10100)
      into v_n from public.trip_sheets t where t.id = v_foaie;
    if v_n = 1 then
      raise notice '  ✓ (2) două curse; antetul: 08:00–11:30, 10000–10100 km';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (2) antetul nu urmează cursele';
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) cursele nu se adaugă: % (%)', sqlerrm, sqlstate;
  end;

  -- (3) cursa de la mijloc, în golul de 20 km dintre ele
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la,
                                         de_la_loc, pana_la_loc, scop, km_plecare, km_sosire,
                                         created_by, updated_by)
    values (v_org, v_foaie, pg_temp.la(v_zi, '09:15'), pg_temp.la(v_zi, '09:45'),
            'Client Ploiești', 'Depozit', 'Încărcare', 10040, 10060, v_u_a, v_u_a)
    returning id into v_cm;
    reset role;
    select string_agg(c.ordine::text, ',' order by c.plecare_la) into v_text
      from public.trip_sheet_curse c where c.trip_sheet_id = v_foaie and c.deleted_at is null;
    if v_text = '1,2,3' and (select ordine from public.trip_sheet_curse where id = v_cm) = 2 then
      raise notice '  ✓ (3) cursa de la mijloc devine a doua (ordinea %)', v_text;
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (3) ordinea după inserare: %', v_text;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) cursa de la mijloc: % (%)', sqlerrm, sqlstate;
  end;

  -- (4)
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la,
                                         de_la_loc, pana_la_loc, scop, km_plecare, km_sosire,
                                         created_by, updated_by)
    values (v_org, v_foaie, pg_temp.la(v_zi, '12:00'), pg_temp.la(v_zi, '12:30'),
            'Câmpina', 'Sediu', 'Întoarcere', 10090, 10130, v_u_a, v_u_a);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) cursa cu kilometrajul înapoi a trecut';
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Kilometrajul de plecare al cursei%' then
      raise notice '  ✓ (4) kilometrajul nu dă înapoi între curse (P0001)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (4) refuzat din alt motiv: %', sqlerrm;
    end if;
  end;

  -- (5)
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la,
                                         de_la_loc, pana_la_loc, scop, km_plecare, km_sosire,
                                         created_by, updated_by)
    values (v_org, v_foaie, pg_temp.la(v_zi, '11:00'), pg_temp.la(v_zi, '11:50'),
            'Câmpina', 'Sediu', 'Întoarcere', 10100, 10130, v_u_a, v_u_a);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) cursa suprapusă a trecut';
  exception when raise_exception then
    reset role;
    if sqlerrm like '%Cursele nu se suprapun.%' then
      raise notice '  ✓ (5) cursele aceleiași foi nu se suprapun (P0001)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (5) refuzat din alt motiv: %', sqlerrm;
    end if;
  end;

  -- (6)
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la,
                                         de_la_loc, pana_la_loc, scop, km_plecare, km_sosire,
                                         created_by, updated_by)
    values (v_org, v_foaie, pg_temp.la(v_zi + 1, '08:00'), pg_temp.la(v_zi + 1, '09:00'),
            'Sediu', 'Client', 'Livrare', 10100, 10140, v_u_a, v_u_a);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) cursa din altă zi a intrat pe foaie';
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Ora de plecare a cursei trebuie să fie în ziua foii%' then
      raise notice '  ✓ (6) cursa pleacă în ziua foii (P0001)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (6) refuzat din alt motiv: %', sqlerrm;
    end if;
  end;

  -- (7)
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set km_sosire = 10500, updated_by = v_u_a where id = v_foaie;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) antetul a primit kilometraj scris direct';
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Orele și kilometrajul foii se scriu pe curse.%' then
      raise notice '  ✓ (7) kilometrajul antetului vine din curse (P0001)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (7) refuzat din alt motiv: %', sqlerrm;
    end if;
  end;

  -- (8) o cursă deschisă la capăt, apoi trimiterea
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la,
                                         de_la_loc, pana_la_loc, scop, km_plecare,
                                         created_by, updated_by)
    values (v_org, v_foaie, pg_temp.la(v_zi, '13:00'), 'Sediu', 'Service', 'Revizie', 10100, v_u_a, v_u_a)
    returning id into v_c3;
    reset role;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) ultima cursă nu poate rămâne deschisă: % (%)', sqlerrm, sqlstate;
  end;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set status = 'trimis', updated_by = v_u_a where id = v_foaie;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) foaia cu o cursă neîncheiată s-a trimis';
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Încheiați toate cursele%' then
      raise notice '  ✓ (8) foaia nu se trimite cu o cursă neîncheiată (P0001)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (8) refuzat din alt motiv: %', sqlerrm;
    end if;
  end;

  -- (9)
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheet_curse set sosire_la = pg_temp.la(v_zi, '14:00'), km_sosire = 10150, updated_by = v_u_a
     where id = v_c3;
    update public.trip_sheets set status = 'trimis', updated_by = v_u_a where id = v_foaie;
    get diagnostics v_n = row_count;
    reset role;
    select t.numar, t.km_sosire into v_numar, v_km from public.trip_sheets t where t.id = v_foaie;
    if v_n = 1 and v_numar ~ ('^FP-' || extract(year from v_zi)::text || '-[0-9]{5}$') and v_km = 10150
       and exists (select 1 from public.trip_sheets t
                    where t.id = v_foaie and t.vehicul_nr is not null
                      and t.vehicul_categorie = 'autoturism' and t.norma_l_100km = 6.5) then
      raise notice '  ✓ (9) trimisă: numărul %, instantaneul vehiculului, 10150 km', v_numar;
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (9) trimiterea: % rânduri, numărul %, km %', v_n, v_numar, v_km;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) trimiterea foii complete: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ Paritatea stării pe curse ════════════════════════════════════════════

  -- (10)
  v_n := 0;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la,
                                         de_la_loc, pana_la_loc, scop, km_plecare, km_sosire,
                                         created_by, updated_by)
    values (v_org, v_foaie, pg_temp.la(v_zi, '15:00'), pg_temp.la(v_zi, '16:00'),
            'Service', 'Sediu', 'Întoarcere', 10150, 10900, v_u_a, v_u_a);
    reset role;
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Cursele se modifică doar%' then v_n := v_n + 1; end if;
  end;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheet_curse set km_sosire = 10900, updated_by = v_u_a where id = v_c3;
    reset role;
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Cursele se modifică doar%' then v_n := v_n + 1; end if;
  end;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheet_curse set deleted_at = now(), updated_by = v_u_a where id = v_c3;
    reset role;
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Cursele se modifică doar%' then v_n := v_n + 1; end if;
  end;
  if v_n = 3 then
    raise notice '  ✓ (10) pe foaia trimisă cursa nu se adaugă, nu se modifică, nu se șterge (3 × P0001)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10) pe foaia trimisă doar % din 3 scrieri pe curse au fost refuzate', v_n;
  end if;

  -- (11)
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set status = 'draft', updated_by = v_u_a where id = v_foaie;
    get diagnostics v_n = row_count;
    reset role;
    select numar into v_text from public.trip_sheets where id = v_foaie;
    if v_n = 1 and v_text = v_numar then
      raise notice '  ✓ (11) retrasă în ciornă, numărul % rămâne', v_text;
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (11) retragerea: % rânduri, numărul %', v_n, v_text;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (11) retragerea: % (%)', sqlerrm, sqlstate;
  end;

  -- (12)
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheet_curse set deleted_at = now(), updated_by = v_u_a where id = v_c3;
    get diagnostics v_n = row_count;
    reset role;
    select km_sosire into v_km from public.trip_sheets where id = v_foaie;
    if v_n = 1 and v_km = 10100 then
      raise notice '  ✓ (12) cursa ștearsă pe ciornă; antetul revine la 10100 km';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (12) ștergerea: % rânduri, antetul la % km', v_n, v_km;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (12) ștergerea cursei pe ciornă: % (%)', sqlerrm, sqlstate;
  end;

  -- (13) regresul pe prima cursă (vehiculul are 10000 km la bord)
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheet_curse set km_plecare = 9950, updated_by = v_u_a where id = v_c1;
    update public.trip_sheets set status = 'trimis', updated_by = v_u_a where id = v_foaie;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (13) foaia cu regres pe prima cursă s-a retrimis';
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Kilometrajul de plecare (%' then
      raise notice '  ✓ (13a) regresul pus pe prima cursă cade la retrimitere (P0001)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (13a) refuzat din alt motiv: %', sqlerrm;
    end if;
  end;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set status = 'trimis', updated_by = v_u_a where id = v_foaie;
    get diagnostics v_n = row_count;
    reset role;
    select numar into v_text from public.trip_sheets where id = v_foaie;
    if v_n = 1 and v_text = v_numar then
      raise notice '  ✓ (13b) retrimisă cu același număr %', v_text;
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (13b) retrimiterea: % rânduri, numărul % (era %)', v_n, v_text, v_numar;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (13b) retrimiterea: % (%)', sqlerrm, sqlstate;
  end;

  -- (14)
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set status = 'aprobat', updated_by = v_u_mgr where id = v_foaie;
    get diagnostics v_n = row_count;
    reset role;
    if v_n <> 1 then
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (14) aprobarea: % rânduri', v_n;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (14) managerul nu aprobă: % (%)', sqlerrm, sqlstate;
  end;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheet_curse set scop = 'Rescris după aprobare', updated_by = v_u_a where id = v_c1;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (14) cursa foii aprobate s-a rescris';
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Cursele se modifică doar%' then
      raise notice '  ✓ (14) aprobată de manager; cursa ei nu se mai atinge (P0001)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (14) refuzat din alt motiv: %', sqlerrm;
    end if;
  end;

  -- (15)
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    update public.trip_sheet_curse set deleted_at = null, updated_by = v_u_admin where id = v_c3;
    get diagnostics v_n = row_count;
    reset role;
    if v_n = 0 and (select deleted_at is not null from public.trip_sheet_curse where id = v_c3) then
      raise notice '  ✓ (15) cursa ștearsă nu se reînvie (zero rânduri)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (15) cursa ștearsă a fost reînviată (% rânduri)', v_n;
    end if;
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (15) cursa ștearsă nu se reînvie (P0001)';
  end;

  -- ═══ Unicitatea și suprapunerile ══════════════════════════════════════════

  -- (16)
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                    created_by, updated_by)
    values (v_org, v_v_a, v_e_a, pg_temp.la(v_zi, '18:00'), 10150, v_u_a, v_u_a);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (16) a doua foaie activă pe vehicul și zi a trecut';
  exception when unique_violation then
    reset role;
    raise notice '  ✓ (16) o singură foaie activă pe vehicul și zi (23505)';
  end;

  -- (17)
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                    created_by, updated_by)
    values (v_org, v_v_pool, v_e_a, pg_temp.la(v_zi, '08:00'), 30000, v_u_a, v_u_a)
    returning id into v_foaie_p;
    reset role;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (17) foaia pe pool nu se întocmește: % (%)', sqlerrm, sqlstate;
  end;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la,
                                         de_la_loc, pana_la_loc, scop, km_plecare, km_sosire,
                                         created_by, updated_by)
    values (v_org, v_foaie_p, pg_temp.la(v_zi, '08:30'), pg_temp.la(v_zi, '09:30'),
            'Sediu', 'Bancă', 'Depunere', 30000, 30010, v_u_a, v_u_a);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (17) aceeași șoferiță a condus două mașini deodată';
  exception when raise_exception then
    reset role;
    if sqlerrm like '%se suprapune cu o cursă a aceluiași șofer%' then
      raise notice '  ✓ (17) un șofer nu are curse suprapuse pe vehicule diferite (P0001)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (17) refuzat din alt motiv: %', sqlerrm;
    end if;
  end;

  -- (18) foaia lui Bogdan, aceeași zi, mașina lui
  perform set_config('request.jwt.claim.sub', v_u_b::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                    created_by, updated_by)
    values (v_org, v_v_b, v_e_b, pg_temp.la(v_zi, '08:00'), 20000, v_u_b, v_u_b)
    returning id into v_foaie_b;
    insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la,
                                         de_la_loc, pana_la_loc, scop, km_plecare, km_sosire,
                                         created_by, updated_by)
    values (v_org, v_foaie_b, pg_temp.la(v_zi, '08:00'), pg_temp.la(v_zi, '10:00'),
            'Sediu', 'Pitești', 'Întâlnire client', 20000, 20110, v_u_b, v_u_b);
    update public.trip_sheets set status = 'trimis', updated_by = v_u_b where id = v_foaie_b;
    reset role;
    select numar into v_numar_b from public.trip_sheets where id = v_foaie_b;
    if split_part(v_numar_b, '-', 3)::int = split_part(v_numar, '-', 3)::int + 1 then
      raise notice '  ✓ (18) numerotarea e consecutivă: % → %', v_numar, v_numar_b;
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (18) numerotarea: % după %', v_numar_b, v_numar;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (18) foaia celui de-al doilea șofer: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ Drepturile ═══════════════════════════════════════════════════════════

  -- (19) ciorna lui Bogdan pe pool, apoi managerul încearcă o cursă pe ea
  insert into public.trip_sheets (id, organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                  created_by, updated_by)
  values (gen_random_uuid(), v_org, v_v_pool, v_e_b, pg_temp.la(v_zi - 1, '08:00'), 30000, v_u_b, v_u_b)
  returning id into v_foaie_p;
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la,
                                         de_la_loc, pana_la_loc, scop, km_plecare, km_sosire,
                                         created_by, updated_by)
    values (v_org, v_foaie_p, pg_temp.la(v_zi - 1, '09:00'), pg_temp.la(v_zi - 1, '10:00'),
            'Sediu', 'Client', 'Scris de manager', 30000, 30020, v_u_mgr, v_u_mgr);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (19) managerul a scris o cursă pe ciorna subordonatului';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (19) managerul nu scrie cursele subordonatului (42501)';
  end;

  -- (20)
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.trip_route_templates (organization_id, denumire, de_la_loc, pana_la_loc, scop,
                                             km_estimat, created_by, updated_by)
    values (v_org, 'Sediu — Depozit', 'Sediu', 'Depozit', 'Aprovizionare', 18, v_u_admin, v_u_admin);
    reset role;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (20) administratorul nu creează șablonul: % (%)', sqlerrm, sqlstate;
  end;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  select count(*) into v_n from public.trip_route_templates where organization_id = v_org;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.trip_route_templates (organization_id, denumire, de_la_loc, pana_la_loc, scop,
                                             created_by, updated_by)
    values (v_org, 'Șablonul șoferiței', 'A', 'B', 'C', v_u_a, v_u_a);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (20) șoferița a scris un șablon al firmei';
  exception when insufficient_privilege then
    reset role;
    if v_n = 1 then
      raise notice '  ✓ (20) șablonul: administratorul îl scrie, șoferița îl citește (1), nu scrie (42501)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (20) șoferița vede % șabloane', v_n;
    end if;
  end;

  -- (21)
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  select (select count(*) from public.trip_sheet_curse where trip_sheet_id = v_foaie)
       + (select count(*) from public.trip_route_templates where organization_id = v_org)
    into v_n;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_sa::text, true);
  set local role authenticated;
  select count(*) into v_km from public.trip_sheet_curse where trip_sheet_id = v_foaie;
  reset role;
  if v_n = 0 and v_km > 0 then
    raise notice '  ✓ (21) hr nu vede curse sau șabloane (0); super_admin vede cursele (%)', v_km;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (21) hr vede % rânduri, super_admin % curse', v_n, v_km;
  end if;

  -- ═══ Revizia F4: trimiterea cere cursele zilei ════════════════════════════

  -- (22) Bogdan adaugă o cursă și o șterge: antetul păstrează orele și km ei,
  -- dar foaia nu mai are nicio linie. Trimiterea trebuie refuzată — altfel se
  -- aprobă un document justificativ fără loc și fără scop.
  perform set_config('request.jwt.claim.sub', v_u_b::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                    created_by, updated_by)
    values (v_org, v_v_b, v_e_b, pg_temp.la(v_zi - 3, '08:00'), 20200, v_u_b, v_u_b)
    returning id into v_foaie_p;
    insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la,
                                         de_la_loc, pana_la_loc, scop, km_plecare, km_sosire,
                                         created_by, updated_by)
    values (v_org, v_foaie_p, pg_temp.la(v_zi - 3, '08:00'), pg_temp.la(v_zi - 3, '09:00'),
            'Sediu', 'Client', 'Livrare', 20200, 20230, v_u_b, v_u_b)
    returning id into v_cm;
    update public.trip_sheet_curse set deleted_at = now(), updated_by = v_u_b where id = v_cm;
    reset role;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (22) pregătirea: % (%)', sqlerrm, sqlstate;
  end;
  perform set_config('request.jwt.claim.sub', v_u_b::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set status = 'trimis', updated_by = v_u_b where id = v_foaie_p;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (22) foaia fără nicio cursă a fost trimisă spre aprobare';
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Adăugați cursele zilei%' then
      raise notice '  ✓ (22) foaia rămasă fără curse nu se trimite (P0001)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (22) refuzat din alt motiv: %', sqlerrm;
    end if;
  end;

  -- (23) o alimentare scrisă în intervalul curselor, apoi cursa mutată mai
  -- târziu: alimentarea rămâne în afara foii. Trimiterea o prinde.
  perform set_config('request.jwt.claim.sub', v_u_b::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                    created_by, updated_by)
    values (v_org, v_v_b, v_e_b, pg_temp.la(v_zi - 4, '08:00'), 20200, v_u_b, v_u_b)
    returning id into v_foaie_p;
    insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la,
                                         de_la_loc, pana_la_loc, scop, km_plecare, km_sosire,
                                         created_by, updated_by)
    values (v_org, v_foaie_p, pg_temp.la(v_zi - 4, '08:00'), pg_temp.la(v_zi - 4, '09:00'),
            'Sediu', 'Client', 'Livrare', 20200, 20230, v_u_b, v_u_b)
    returning id into v_cm;
    insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la,
                                     created_by, updated_by)
    values (v_org, v_foaie_p, 20, 140, pg_temp.la(v_zi - 4, '08:30'), v_u_b, v_u_b);
    update public.trip_sheet_curse
       set plecare_la = pg_temp.la(v_zi - 4, '10:00'), sosire_la = pg_temp.la(v_zi - 4, '11:00'),
           updated_by = v_u_b
     where id = v_cm;
    reset role;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (23) pregătirea: % (%)', sqlerrm, sqlstate;
  end;
  perform set_config('request.jwt.claim.sub', v_u_b::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set status = 'trimis', updated_by = v_u_b where id = v_foaie_p;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (23) foaia cu o alimentare în afara curselor a fost trimisă';
  exception when raise_exception then
    reset role;
    if sqlerrm like 'O alimentare de pe foaie este în afara intervalului curselor%' then
      raise notice '  ✓ (23) alimentarea rămasă în afara curselor oprește trimiterea (P0001)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (23) refuzat din alt motiv: %', sqlerrm;
    end if;
  end;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA FLOTA FOAIA ZILNICĂ: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE cele 26 de verificări au trecut.';
  raise notice '';
end;
$$;
