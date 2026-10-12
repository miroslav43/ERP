-- tests/rls/proba-flota-amenzi.sql
--
-- FLOTA, DUPĂ 0203: AMENZILE PRIMITE PE VEHICUL, INCIDENTELE / DAUNA ȘI
-- ȘOFERUL LA UN MOMENT DAT.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- Amenzi
-- (1)  org_admin înregistrează o amendă; numărul se normalizează        [POZITIVĂ];
-- (2)  termenul de răspuns ajunge în `expirables`, vizibil pentru org_admin
--      [POZITIVĂ], nu și pentru hr;
-- (3)  aceeași hârtie introdusă a doua oară (cu spații și litere mici): 23505;
-- (4)  vehiculul altei firme: P0001;
-- (5)  șoferul altei firme: cheia străină compusă refuză (23503);
-- (6)  desemnarea fără șofer: P0001;
-- (7)  salt peste desemnare (primită → răspuns trimis): P0001;
-- (8)  retragerea desemnării golește șoferul                             [POZITIVĂ];
-- (9)  desemnare → răspuns trimis; scadența dispare din `expirables`, iar o
--      contestare ulterioară nu o readuce                              [POZITIVĂ];
-- (10) după răspuns, șoferul desemnat nu se mai schimbă: P0001;
-- (11) data răspunsului în viitor: P0001;
-- (12) amenda plătită e închisă: orice UPDATE dă P0001                  [POZITIVĂ + NEGATIVĂ];
-- (13) anularea cere motiv: P0001 fără, o rând cu                       [POZITIVĂ];
-- (14) ștergerea logică: doar amenda încă neatinsă                      [POZITIVĂ + NEGATIVĂ];
-- Cine conducea (`app.sofer_la` / `public.sofer_sugerat`)
-- (15) fără foaie, sugestia vine din alocarea deschisă la acel moment  [POZITIVĂ];
-- (16) linia de foaie care acoperă momentul bate alocarea              [POZITIVĂ];
-- (17) în afara liniei, tot alocarea; foaia respinsă nu face dovadă; cursa fără
--      sosire acoperă restul zilei foii, nu și ziua următoare;
-- (18) hr, manager, employee și org_admin-ul altei firme primesc zero rânduri;
-- Drepturi
-- (19) hr, manager, employee: nu văd, nu scriu (42501 / zero rânduri);
-- (20) org_admin din altă firmă: nu vede, nu modifică (zero rânduri);
-- (21) super_admin (platform_admins, NU membru) citește; nu scrie       [POZITIVĂ];
-- Incidente
-- (22) fluxul raportat → constatat → la asigurător → închis             [POZITIVĂ];
-- (23) la asigurător fără asigurător: P0001; închiderea fără cost final: P0001;
-- (24) incidentul închis e înghețat: P0001;
-- (25) cercetarea SSM din altă firmă: P0001; din aceeași firmă          [POZITIVĂ];
-- (26) incidentul în lucru nu se șterge (P0001), cel doar raportat da    [POZITIVĂ];
-- (27) incidentul nu se mută pe alt vehicul: P0001;
-- Lista de conformitate
-- (28) rescrierea lui `app.poate_vedea_expirabil` păstrează TOATE ramurile
--      (vehicle_document, vehicle_service, driver_license) și o adaugă pe
--      `vehicle_fine`: org_admin le vede pe toate, hr doar permisul;
-- (29) auditul: fiecare scriere lasă urmă în `audit_logs`.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh --pastreaza
--   psql … -f tests/rls/proba-flota-amenzi.sql
\set ON_ERROR_STOP on
\pset pager off

begin;

-- Momentul `ora` din ziua `zi`, în ora României.
create function pg_temp.la(zi date, ora text) returns timestamptz
language sql immutable as $$ select (zi::timestamp + ora::interval) at time zone 'Europe/Bucharest' $$;

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

-- Un număr (de rânduri, de obicei), sub identitatea lui `p_user`.
create function pg_temp.numara(p_user uuid, p_sql text) returns bigint
language plpgsql as $f$
declare
  v_n bigint;
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  set local role authenticated;
  execute p_sql into v_n;
  reset role;
  return v_n;
exception when others then
  reset role;
  return -1;
end
$f$;

-- Un rând de raport: 0 la reușită, 1 la eșec.
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

do $$
declare
  v_sufix     text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_zi        date := app.azi_local();
  v_org       uuid := gen_random_uuid();
  v_org_alta  uuid := gen_random_uuid();
  v_u_admin   uuid := gen_random_uuid();
  v_u_hr      uuid := gen_random_uuid();
  v_u_mgr     uuid := gen_random_uuid();
  v_u_ang     uuid := gen_random_uuid();
  v_u_alta    uuid := gen_random_uuid();
  v_u_sa      uuid := gen_random_uuid();
  v_e_mgr     uuid := gen_random_uuid();
  v_e_ang     uuid := gen_random_uuid();
  v_e_coleg   uuid := gen_random_uuid();
  v_e_strain  uuid := gen_random_uuid();
  v_veh       uuid := gen_random_uuid();
  v_veh_alta  uuid := gen_random_uuid();
  v_f1        uuid;
  v_f2        uuid;
  v_f3        uuid;
  v_f4        uuid;
  v_inc       uuid;
  v_inc2      uuid;
  v_acc       uuid;
  v_acc_alta  uuid;
  v_foaie     uuid;
  v_foaie_r   uuid;
  v_foaie_o   uuid;
  v_numar     text;
  v_text      text;
  v_n         bigint;
  v_m         bigint;
  v_stadiu    text;
  v_sofer     uuid;
  v_sursa     text;
  v_desemnat  timestamptz;
  v_esecuri   int := 0;
begin
  raise notice '';
  raise notice '  PROBA „FLOTA — AMENZI ȘI DAUNE" (0203)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-amenzi-' || v_sufix, 'Proba Amenzi SRL',
     'RO' || (88000000 + (random() * 900000)::int)::text),
    (v_org_alta, 'proba-amenzi-alta-' || v_sufix, 'Altă Firmă SRL',
     'RO' || (89000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select o, f.feature_key, true, now() from public.features f, unnest(array[v_org, v_org_alta]) o;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_admin, 'am-adm-'  || v_sufix || '@proba.test', now()),
    (v_u_hr,    'am-hr-'   || v_sufix || '@proba.test', now()),
    (v_u_mgr,   'am-mgr-'  || v_sufix || '@proba.test', now()),
    (v_u_ang,   'am-ang-'  || v_sufix || '@proba.test', now()),
    (v_u_alta,  'am-alta-' || v_sufix || '@proba.test', now()),
    (v_u_sa,    'am-sa-'   || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_admin, 'org_admin'),
    (v_org, v_u_hr,    'hr'),
    (v_org, v_u_mgr,   'manager'),
    (v_org, v_u_ang,   'employee'),
    (v_org_alta, v_u_alta, 'org_admin');
  insert into public.platform_admins (user_id) values (v_u_sa);

  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_mgr,   v_org, 'AM-M', 'Mihai',  'Manager', v_zi - 500, 'activ', v_u_mgr, null);
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_ang,   v_org, 'AM-A', 'Ana',    'Șofer',   v_zi - 400, 'activ', v_u_ang, v_e_mgr),
    (v_e_coleg, v_org, 'AM-C', 'Cornel', 'Coleg',   v_zi - 400, 'activ', null,    null),
    (v_e_strain, v_org_alta, 'AM-X', 'Xenia', 'Străină', v_zi - 400, 'activ', null, null);

  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent,
                               created_by, updated_by) values
    (v_veh, v_org, 'B' || (100 + (random() * 800)::int)::text || 'AMZ', 'Dacia', 'Logan', 10000, v_u_admin, v_u_admin),
    (v_veh_alta, v_org_alta, 'B' || (100 + (random() * 800)::int)::text || 'ALT', 'Dacia', 'Duster', 5000,
     v_u_alta, v_u_alta);
  -- Colegul are mașina alocată de acum 20 de zile.
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, km_predare,
                                          created_by, updated_by)
  values (v_org, v_veh, v_e_coleg, pg_temp.la(v_zi - 20, '08:00'), 10000, v_u_admin, v_u_admin);

  -- (1) org_admin înregistrează amenda
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_fines (organization_id, vehicle_id, numar_pv, data_pv, constatata_la, locul,
                                      fapta, autoritate, suma, primita_la, termen_raspuns, created_by, updated_by)
    values (v_org, v_veh, ' pv  12/a ', v_zi - 3, pg_temp.la(v_zi - 3, '09:30'), 'DN1, Ploiești',
            'Depășirea vitezei legale', 'Poliția Rutieră', 580, v_zi - 1, v_zi + 7, v_u_admin, v_u_admin)
    returning id, numar_pv, stadiu::text into v_f1, v_numar, v_stadiu;
    reset role;
    v_esecuri := v_esecuri + pg_temp.verifica('1', v_numar = 'PV 12/A' and v_stadiu = 'primita',
      'org_admin înregistrează amenda; numărul devine „PV 12/A”, stadiul „primita”',
      v_numar || ' / ' || v_stadiu);
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) org_admin nu poate înregistra amenda: % (%)', sqlerrm, sqlstate;
  end;

  -- (2) termenul în expirables
  v_n := pg_temp.numara(v_u_admin, format(
    $q$select count(*) from public.expirables where entity_type = 'vehicle_fine' and entity_id = %L
       and deleted_at is null and expires_at = %L$q$, v_f1, v_zi + 7));
  v_m := pg_temp.numara(v_u_hr, format(
    $q$select count(*) from public.expirables where entity_type = 'vehicle_fine' and entity_id = %L$q$, v_f1));
  v_esecuri := v_esecuri + pg_temp.verifica('2', v_n = 1 and v_m = 0,
    'termenul de răspuns e în expirables pentru org_admin; hr nu-l vede',
    format('org_admin %s, hr %s', v_n, v_m));

  -- (3) aceeași hârtie, a doua oară
  v_text := pg_temp.ruleaza(v_u_admin, format(
    $q$insert into public.vehicle_fines (organization_id, vehicle_id, numar_pv, constatata_la, fapta)
       values (%L, %L, 'PV 12/A', %L, 'Altă descriere')$q$, v_org, v_veh, pg_temp.la(v_zi - 3, '09:30')));
  v_esecuri := v_esecuri + pg_temp.verifica('3', v_text like '23505:%vf_numar_uq%',
    'aceeași hârtie introdusă a doua oară pe același vehicul: 23505', v_text);

  -- (4) vehiculul altei firme
  v_text := pg_temp.ruleaza(v_u_admin, format(
    $q$insert into public.vehicle_fines (organization_id, vehicle_id, numar_pv, constatata_la, fapta)
       values (%L, %L, 'PV-ALTA-1', %L, 'Parcare')$q$, v_org, v_veh_alta, pg_temp.la(v_zi - 3, '09:30')));
  v_esecuri := v_esecuri + pg_temp.verifica('4', v_text like 'P0001:Vehiculul ales%',
    'vehiculul altei firme e refuzat (P0001)', v_text);

  -- (5) șoferul altei firme
  v_text := pg_temp.ruleaza(v_u_admin, format(
    $q$update public.vehicle_fines set stadiu = 'sofer_desemnat', sofer_desemnat_id = %L where id = %L$q$,
    v_e_strain, v_f1));
  v_esecuri := v_esecuri + pg_temp.verifica('5', v_text like '23503:%vf_sofer_fk%',
    'șoferul altei firme: cheia străină compusă refuză (23503)', v_text);

  -- (6) desemnare fără șofer
  v_text := pg_temp.ruleaza(v_u_admin, format(
    $q$update public.vehicle_fines set stadiu = 'sofer_desemnat' where id = %L$q$, v_f1));
  v_esecuri := v_esecuri + pg_temp.verifica('6', v_text like 'P0001:Alegeți șoferul%',
    'desemnarea fără șofer e refuzată (P0001)', v_text);

  -- (7) salt peste desemnare
  v_text := pg_temp.ruleaza(v_u_admin, format(
    $q$update public.vehicle_fines set stadiu = 'raspuns_trimis', sofer_desemnat_id = %L, raspuns_trimis_la = %L
       where id = %L$q$, v_e_ang, v_zi, v_f1));
  v_esecuri := v_esecuri + pg_temp.verifica('7', v_text like 'P0001:Amenda nu poate trece din stadiul „primită” în „răspuns trimis”%',
    'primită → răspuns trimis, peste desemnare, e refuzat (P0001)', v_text);

  -- (15) fără foaie: sugestia vine din alocare
  v_m := pg_temp.numara(v_u_admin, format(
    $q$select count(*) from public.sofer_sugerat(%L, %L, %L) s
       where s.employee_id = %L and s.sursa = 'alocare'$q$, v_org, v_veh, pg_temp.la(v_zi - 3, '09:30'), v_e_coleg));
  v_esecuri := v_esecuri + pg_temp.verifica('15', v_m = 1,
    'fără foaie, sugestia e șoferul alocării deschise la acel moment', v_m::text);

  -- (16) linia de foaie bate alocarea. Foaia respinsă a Anei, ziua a patra (nu face
  -- dovadă), apoi foaia ciornă din ziua a treia, cursă 08:00–10:00.
  insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                  sosire_la, km_sosire, status, motiv_respingere, created_by, updated_by)
  values (v_org, v_veh, v_e_ang, pg_temp.la(v_zi - 4, '08:00'), 10000,
          pg_temp.la(v_zi - 4, '10:00'), 10040, 'respins', 'Lipsește scopul.', v_u_admin, v_u_admin)
  returning id into v_foaie_r;
  insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la,
                                       de_la_loc, pana_la_loc, scop, km_plecare, km_sosire,
                                       created_by, updated_by)
  values (v_org, v_foaie_r, pg_temp.la(v_zi - 4, '08:00'), pg_temp.la(v_zi - 4, '10:00'),
          'Sediu', 'Client', 'Livrare', 10000, 10040, v_u_admin, v_u_admin);
  insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                  created_by, updated_by)
  values (v_org, v_veh, v_e_ang, pg_temp.la(v_zi - 3, '08:00'), 10040, v_u_admin, v_u_admin)
  returning id into v_foaie;
  insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la,
                                       de_la_loc, pana_la_loc, scop, km_plecare, km_sosire,
                                       created_by, updated_by)
  values (v_org, v_foaie, pg_temp.la(v_zi - 3, '08:00'), pg_temp.la(v_zi - 3, '10:00'),
          'Sediu', 'Client', 'Livrare', 10040, 10080, v_u_admin, v_u_admin);
  v_m := pg_temp.numara(v_u_admin, format(
    $q$select count(*) from public.sofer_sugerat(%L, %L, %L) s
       where s.employee_id = %L and s.sursa = 'foaie' and s.referinta_id = %L$q$,
    v_org, v_veh, pg_temp.la(v_zi - 3, '09:30'), v_e_ang, v_foaie));
  v_esecuri := v_esecuri + pg_temp.verifica('16', v_m = 1,
    'linia de foaie care acoperă momentul bate alocarea: șoferul foii, sursa „foaie”', v_m::text);

  -- (17) în afara liniei: alocarea. Foaia respinsă nu face dovadă.
  v_m := pg_temp.numara(v_u_admin, format(
    $q$select count(*) from public.sofer_sugerat(%L, %L, %L) s
       where s.employee_id = %L and s.sursa = 'alocare'$q$,
    v_org, v_veh, pg_temp.la(v_zi - 3, '12:00'), v_e_coleg));
  v_n := pg_temp.numara(v_u_admin, format(
    $q$select count(*) from public.sofer_sugerat(%L, %L, %L) s
       where s.employee_id = %L and s.sursa = 'alocare'$q$,
    v_org, v_veh, pg_temp.la(v_zi - 4, '09:00'), v_e_coleg));
  v_esecuri := v_esecuri + pg_temp.verifica('17', v_m = 1 and v_n = 1,
    'în afara liniei și pe o foaie respinsă, sugestia revine la alocare',
    format('afară din linie %s, foaie respinsă %s', v_m, v_n));

  -- (17b) o cursă fără sosire (încă pe drum) acoperă restul zilei foii, nu și ziua următoare
  insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                  created_by, updated_by)
  values (v_org, v_veh, v_e_ang, pg_temp.la(v_zi - 2, '08:00'), 10080, v_u_admin, v_u_admin)
  returning id into v_foaie_o;
  insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la,
                                       de_la_loc, pana_la_loc, scop, km_plecare, created_by, updated_by)
  values (v_org, v_foaie_o, pg_temp.la(v_zi - 2, '08:00'), 'Sediu', 'Client', 'Livrare', 10080,
          v_u_admin, v_u_admin);
  v_m := pg_temp.numara(v_u_admin, format(
    $q$select count(*) from public.sofer_sugerat(%L, %L, %L) s
       where s.employee_id = %L and s.sursa = 'foaie' and s.referinta_id = %L$q$,
    v_org, v_veh, pg_temp.la(v_zi - 2, '15:00'), v_e_ang, v_foaie_o));
  v_n := pg_temp.numara(v_u_admin, format(
    $q$select count(*) from public.sofer_sugerat(%L, %L, %L) s
       where s.employee_id = %L and s.sursa = 'alocare'$q$,
    v_org, v_veh, pg_temp.la(v_zi - 1, '03:00'), v_e_coleg));
  v_esecuri := v_esecuri + pg_temp.verifica('17b', v_m = 1 and v_n = 1,
    'cursa fără sosire acoperă restul zilei foii (foaie), iar a doua zi sugestia revine la alocare',
    format('în ziua foii %s, a doua zi %s', v_m, v_n));

  -- (18) ceilalți primesc zero rânduri
  v_n := pg_temp.numara(v_u_hr, format('select count(*) from public.sofer_sugerat(%L, %L, %L)',
                                       v_org, v_veh, pg_temp.la(v_zi - 3, '09:30')));
  v_m := pg_temp.numara(v_u_mgr, format('select count(*) from public.sofer_sugerat(%L, %L, %L)',
                                        v_org, v_veh, pg_temp.la(v_zi - 3, '09:30')));
  v_esecuri := v_esecuri + pg_temp.verifica('18',
    v_n = 0 and v_m = 0
      and pg_temp.numara(v_u_ang, format('select count(*) from public.sofer_sugerat(%L, %L, %L)',
                                         v_org, v_veh, pg_temp.la(v_zi - 3, '09:30'))) = 0
      and pg_temp.numara(v_u_alta, format('select count(*) from public.sofer_sugerat(%L, %L, %L)',
                                          v_org, v_veh, pg_temp.la(v_zi - 3, '09:30'))) = 0
      and pg_temp.numara(v_u_alta, format('select count(*) from public.sofer_sugerat(%L, %L, %L)',
                                          v_org_alta, v_veh, pg_temp.la(v_zi - 3, '09:30'))) = 0,
    'hr, manager, employee și org_admin-ul altei firme primesc zero rânduri (și cu vehiculul străin)',
    format('hr %s, manager %s', v_n, v_m));

  -- (8) desemnare, apoi retragere
  v_text := pg_temp.ruleaza(v_u_admin, format(
    $q$update public.vehicle_fines set stadiu = 'sofer_desemnat', sofer_desemnat_id = %L where id = %L$q$,
    v_e_coleg, v_f1));
  select desemnat_la into v_desemnat from public.vehicle_fines where id = v_f1;
  v_esecuri := v_esecuri + pg_temp.verifica('8a', v_text = 'ok:1' and v_desemnat is not null,
    'org_admin desemnează șoferul; momentul desemnării îl pune baza', v_text);
  v_text := pg_temp.ruleaza(v_u_admin, format(
    $q$update public.vehicle_fines set stadiu = 'primita', sofer_desemnat_id = %L where id = %L$q$,
    v_e_coleg, v_f1));
  select sofer_desemnat_id, desemnat_la into v_sofer, v_desemnat from public.vehicle_fines where id = v_f1;
  v_esecuri := v_esecuri + pg_temp.verifica('8b', v_text = 'ok:1' and v_sofer is null and v_desemnat is null,
    'retragerea desemnării golește șoferul și momentul', v_text);

  -- (9) desemnare → răspuns trimis; scadența dispare
  v_text := pg_temp.ruleaza(v_u_admin, format(
    $q$update public.vehicle_fines set stadiu = 'sofer_desemnat', sofer_desemnat_id = %L where id = %L$q$,
    v_e_ang, v_f1));
  v_n := pg_temp.numara(v_u_admin, format(
    $q$select count(*) from public.expirables where entity_type = 'vehicle_fine' and entity_id = %L
       and deleted_at is null$q$, v_f1));
  v_esecuri := v_esecuri + pg_temp.verifica('9a', v_text = 'ok:1' and v_n = 1,
    'cu șoferul desemnat, termenul rămâne în expirables (răspunsul n-a plecat)', v_text || ' / ' || v_n);
  v_text := pg_temp.ruleaza(v_u_admin, format(
    $q$update public.vehicle_fines set stadiu = 'raspuns_trimis', raspuns_trimis_la = %L, raspuns_numar = ' IES-9 '
       where id = %L$q$, v_zi, v_f1));
  v_n := pg_temp.numara(v_u_admin, format(
    $q$select count(*) from public.expirables where entity_type = 'vehicle_fine' and entity_id = %L
       and deleted_at is null$q$, v_f1));
  v_esecuri := v_esecuri + pg_temp.verifica('9b', v_text = 'ok:1' and v_n = 0
      and (select raspuns_numar from public.vehicle_fines where id = v_f1) = 'IES-9',
    'răspunsul trimis scoate termenul din expirables; numărul de ieșire se curăță', v_text || ' / ' || v_n);

  -- (10) șoferul nu se mai schimbă după răspuns
  v_text := pg_temp.ruleaza(v_u_admin, format(
    $q$update public.vehicle_fines set sofer_desemnat_id = %L where id = %L$q$, v_e_coleg, v_f1));
  v_esecuri := v_esecuri + pg_temp.verifica('10', v_text like 'P0001:După trimiterea răspunsului%',
    'după răspuns, șoferul desemnat nu se mai schimbă (P0001)', v_text);

  -- (11) data răspunsului în viitor
  insert into public.vehicle_fines (organization_id, vehicle_id, numar_pv, constatata_la, fapta, primita_la,
                                    stadiu, sofer_desemnat_id, created_by, updated_by)
  values (v_org, v_veh, 'PV-F2', pg_temp.la(v_zi - 2, '10:00'), 'Parcare interzisă', v_zi - 1,
          'sofer_desemnat', v_e_ang, v_u_admin, v_u_admin)
  returning id into v_f2;
  v_text := pg_temp.ruleaza(v_u_admin, format(
    $q$update public.vehicle_fines set stadiu = 'raspuns_trimis', raspuns_trimis_la = %L where id = %L$q$,
    v_zi + 1, v_f2));
  v_esecuri := v_esecuri + pg_temp.verifica('11', v_text like 'P0001:Data trimiterii răspunsului%',
    'data răspunsului în viitor e refuzată (P0001)', v_text);

  -- (9c) contestată DUPĂ răspuns nu readuce termenul trecut în expirables
  v_text := pg_temp.ruleaza(v_u_admin, format(
    $q$update public.vehicle_fines set stadiu = 'contestata' where id = %L$q$, v_f1));
  v_n := pg_temp.numara(v_u_admin, format(
    $q$select count(*) from public.expirables where entity_type = 'vehicle_fine' and entity_id = %L
       and deleted_at is null$q$, v_f1));
  v_esecuri := v_esecuri + pg_temp.verifica('9c', v_text = 'ok:1' and v_n = 0,
    'răspuns trimis → contestată: termenul trecut NU revine în expirables', v_text || ' / ' || v_n);

  -- (12) amenda plătită e închisă
  v_text := pg_temp.ruleaza(v_u_admin, format(
    $q$update public.vehicle_fines set stadiu = 'platita' where id = %L$q$, v_f1));
  v_m := pg_temp.numara(v_u_admin, format(
    $q$select count(*) from public.vehicle_fines where id = %L and stadiu = 'platita'$q$, v_f1));
  v_esecuri := v_esecuri + pg_temp.verifica('12a', v_text = 'ok:1' and v_m = 1,
    'contestată → plătită', v_text);
  v_text := pg_temp.ruleaza(v_u_admin, format(
    $q$update public.vehicle_fines set observatii = 'Rescriere' where id = %L$q$, v_f1));
  v_esecuri := v_esecuri + pg_temp.verifica('12b', v_text like 'P0001:Amenda este plătită%',
    'amenda plătită nu se mai modifică (P0001)', v_text);

  -- (13) anularea cere motiv
  v_text := pg_temp.ruleaza(v_u_admin, format(
    $q$update public.vehicle_fines set stadiu = 'anulata' where id = %L$q$, v_f2));
  v_esecuri := v_esecuri + pg_temp.verifica('13a', v_text like 'P0001:Scrieți motivul anulării%',
    'anularea fără motiv e refuzată (P0001)', v_text);
  v_text := pg_temp.ruleaza(v_u_admin, format(
    $q$update public.vehicle_fines set stadiu = 'anulata', motiv = 'Desființată de autoritate' where id = %L$q$,
    v_f2));
  v_esecuri := v_esecuri + pg_temp.verifica('13b', v_text = 'ok:1', 'anularea cu motiv trece', v_text);

  -- (14) ștergerea logică
  insert into public.vehicle_fines (organization_id, vehicle_id, numar_pv, constatata_la, fapta,
                                    created_by, updated_by)
  values (v_org, v_veh, 'PV-GRESIT', pg_temp.la(v_zi - 2, '11:00'), 'Introdusă din greșeală', v_u_admin, v_u_admin)
  returning id into v_f3;
  insert into public.vehicle_fines (organization_id, vehicle_id, numar_pv, constatata_la, fapta, primita_la,
                                    stadiu, sofer_desemnat_id, created_by, updated_by)
  values (v_org, v_veh, 'PV-F4', pg_temp.la(v_zi - 2, '12:00'), 'Semafor roșu', v_zi - 1,
          'sofer_desemnat', v_e_ang, v_u_admin, v_u_admin)
  returning id into v_f4;
  v_text := pg_temp.ruleaza(v_u_admin, format(
    $q$update public.vehicle_fines set deleted_at = now() where id = %L$q$, v_f3));
  v_esecuri := v_esecuri + pg_temp.verifica('14a', v_text = 'ok:1',
    'amenda încă neatinsă se șterge logic', v_text);
  v_text := pg_temp.ruleaza(v_u_admin, format(
    $q$update public.vehicle_fines set deleted_at = now() where id = %L$q$, v_f4));
  v_esecuri := v_esecuri + pg_temp.verifica('14b', v_text like 'P0001:O amendă aflată în lucru%',
    'amenda cu șofer desemnat nu se șterge, se anulează (P0001)', v_text);

  -- (19) ceilalți din firmă
  v_n := pg_temp.numara(v_u_hr, format('select count(*) from public.vehicle_fines where organization_id = %L', v_org))
       + pg_temp.numara(v_u_mgr, format('select count(*) from public.vehicle_fines where organization_id = %L', v_org))
       + pg_temp.numara(v_u_ang, format('select count(*) from public.vehicle_fines where organization_id = %L', v_org));
  v_text := pg_temp.ruleaza(v_u_hr, format(
    $q$insert into public.vehicle_fines (organization_id, vehicle_id, numar_pv, constatata_la, fapta)
       values (%L, %L, 'PV-HR', %L, 'Încercare')$q$, v_org, v_veh, pg_temp.la(v_zi - 1, '10:00')));
  v_m := case when v_text like '42501:%' then 1 else 0 end;
  v_text := pg_temp.ruleaza(v_u_mgr, format(
    $q$insert into public.vehicle_fines (organization_id, vehicle_id, numar_pv, constatata_la, fapta)
       values (%L, %L, 'PV-MGR', %L, 'Încercare')$q$, v_org, v_veh, pg_temp.la(v_zi - 1, '10:00')));
  v_m := v_m * 10 + case when v_text like '42501:%' then 1 else 0 end;
  v_text := pg_temp.ruleaza(v_u_ang, format(
    $q$update public.vehicle_fines set observatii = 'Încercare angajat' where organization_id = %L$q$, v_org));
  v_m := v_m * 10 + case when v_text = 'ok:0' then 1 else 0 end;
  v_esecuri := v_esecuri + pg_temp.verifica('19', v_n = 0 and v_m = 111,
    'hr, manager și employee nu văd nicio amendă; hr și managerul nu scriu (42501), angajatul nu modifică nimic',
    format('rânduri vizibile %s, scrieri refuzate %s', v_n, v_m));

  -- (20) org_admin din altă firmă
  v_n := pg_temp.numara(v_u_alta, format('select count(*) from public.vehicle_fines where organization_id = %L', v_org));
  v_text := pg_temp.ruleaza(v_u_alta, format(
    $q$update public.vehicle_fines set observatii = 'Intrus' where organization_id = %L$q$, v_org));
  v_esecuri := v_esecuri + pg_temp.verifica('20', v_n = 0 and v_text = 'ok:0',
    'org_admin-ul altei firme nu vede și nu modifică amenzile', format('vizibile %s, %s', v_n, v_text));

  -- (21) super_admin
  v_n := pg_temp.numara(v_u_sa, format('select count(*) from public.vehicle_fines where organization_id = %L', v_org));
  v_text := pg_temp.ruleaza(v_u_sa, format(
    $q$insert into public.vehicle_fines (organization_id, vehicle_id, numar_pv, constatata_la, fapta)
       values (%L, %L, 'PV-SA', %L, 'Încercare')$q$, v_org, v_veh, pg_temp.la(v_zi - 1, '10:00')));
  v_esecuri := v_esecuri + pg_temp.verifica('21', v_n >= 3 and v_text like '42501:%',
    'super_admin (platform_admins) citește amenzile firmei, dar nu scrie în numele ei',
    format('citite %s, scriere %s', v_n, v_text));

  -- (22) incidentul: fluxul întreg
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_incidents (organization_id, vehicle_id, tip, produs_la, locul, descriere,
                                          sofer_id, created_by, updated_by)
    values (v_org, v_veh, 'coliziune', pg_temp.la(v_zi - 1, '16:00'), 'Parcarea sediului',
            'Zgâriere aripă dreapta', v_e_ang, v_u_admin, v_u_admin)
    returning id into v_inc;
    reset role;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (22) org_admin nu poate raporta incidentul: % (%)', sqlerrm, sqlstate;
  end;
  v_text := pg_temp.ruleaza(v_u_admin, format(
    $q$update public.vehicle_incidents set stadiu = 'constatat', cost_estimat = 1200 where id = %L$q$, v_inc));
  v_esecuri := v_esecuri + pg_temp.verifica('22a', v_text = 'ok:1', 'raportat → constatat', v_text);

  -- (23) la asigurător fără asigurător; închidere fără cost final
  v_text := pg_temp.ruleaza(v_u_admin, format(
    $q$update public.vehicle_incidents set stadiu = 'la_asigurator' where id = %L$q$, v_inc));
  v_esecuri := v_esecuri + pg_temp.verifica('23a', v_text like 'P0001:Scrieți numele asigurătorului%',
    'la asigurător fără numele asigurătorului e refuzat (P0001)', v_text);
  v_text := pg_temp.ruleaza(v_u_admin, format(
    $q$update public.vehicle_incidents set stadiu = 'la_asigurator', asigurator = 'Asigurator Test', dosar_numar = 'D-77'
       where id = %L$q$, v_inc));
  v_esecuri := v_esecuri + pg_temp.verifica('22b', v_text = 'ok:1', 'constatat → la asigurător', v_text);
  v_text := pg_temp.ruleaza(v_u_admin, format(
    $q$update public.vehicle_incidents set stadiu = 'inchis' where id = %L$q$, v_inc));
  v_esecuri := v_esecuri + pg_temp.verifica('23b', v_text like 'P0001:Scrieți costul final%',
    'închiderea fără cost final e refuzată (P0001)', v_text);
  v_text := pg_temp.ruleaza(v_u_admin, format(
    $q$update public.vehicle_incidents set stadiu = 'inchis', cost_final = 1100, despagubire = 900 where id = %L$q$,
    v_inc));
  v_m := pg_temp.numara(v_u_admin, format(
    $q$select count(*) from public.vehicle_incidents where id = %L and stadiu = 'inchis' and inchis_la is not null$q$,
    v_inc));
  v_esecuri := v_esecuri + pg_temp.verifica('22c', v_text = 'ok:1' and v_m = 1,
    'la asigurător → închis; momentul închiderii îl pune baza', v_text);

  -- (24) incidentul închis e înghețat
  v_text := pg_temp.ruleaza(v_u_admin, format(
    $q$update public.vehicle_incidents set descriere = 'Rescriere după închidere' where id = %L$q$, v_inc));
  v_esecuri := v_esecuri + pg_temp.verifica('24', v_text like 'P0001:Incidentul este închis%',
    'incidentul închis nu se mai modifică (P0001)', v_text);

  -- (25) legătura cu cercetarea SSM
  insert into public.work_accidents (id, organization_id, data_producerii, locul, imprejurari, tip, created_by, updated_by)
  values (gen_random_uuid(), v_org, v_zi - 1, 'Parcare', 'Lovit la manevră', 'usor', v_u_admin, v_u_admin)
  returning id into v_acc;
  insert into public.work_accidents (id, organization_id, data_producerii, locul, imprejurari, tip, created_by, updated_by)
  values (gen_random_uuid(), v_org_alta, v_zi - 1, 'Parcare', 'Altă firmă', 'usor', v_u_alta, v_u_alta)
  returning id into v_acc_alta;
  insert into public.vehicle_incidents (organization_id, vehicle_id, tip, produs_la, descriere,
                                        created_by, updated_by)
  values (v_org, v_veh, 'coliziune', pg_temp.la(v_zi - 1, '17:00'), 'Lovire cu vătămare ușoară', v_u_admin, v_u_admin)
  returning id into v_inc2;
  v_text := pg_temp.ruleaza(v_u_admin, format(
    $q$update public.vehicle_incidents set work_accident_id = %L where id = %L$q$, v_acc_alta, v_inc2));
  v_esecuri := v_esecuri + pg_temp.verifica('25a', v_text like 'P0001:Cercetarea SSM aleasă%',
    'cercetarea SSM din altă firmă e refuzată (P0001)', v_text);
  v_text := pg_temp.ruleaza(v_u_admin, format(
    $q$update public.vehicle_incidents set work_accident_id = %L where id = %L$q$, v_acc, v_inc2));
  v_esecuri := v_esecuri + pg_temp.verifica('25b', v_text = 'ok:1',
    'cercetarea SSM din aceeași firmă se leagă', v_text);

  -- (26) ștergerea incidentului
  v_text := pg_temp.ruleaza(v_u_admin, format(
    $q$update public.vehicle_incidents set stadiu = 'constatat' where id = %L$q$, v_inc2));
  v_text := pg_temp.ruleaza(v_u_admin, format(
    $q$update public.vehicle_incidents set deleted_at = now() where id = %L$q$, v_inc2));
  v_esecuri := v_esecuri + pg_temp.verifica('26a', v_text like 'P0001:Un incident aflat în lucru%',
    'incidentul constatat nu se șterge (P0001)', v_text);
  insert into public.vehicle_incidents (organization_id, vehicle_id, tip, produs_la, descriere,
                                        created_by, updated_by)
  values (v_org, v_veh, 'avarie', pg_temp.la(v_zi - 1, '18:00'), 'Introdus din greșeală', v_u_admin, v_u_admin)
  returning id into v_inc2;
  v_text := pg_temp.ruleaza(v_u_admin, format(
    $q$update public.vehicle_incidents set deleted_at = now() where id = %L$q$, v_inc2));
  v_esecuri := v_esecuri + pg_temp.verifica('26b', v_text = 'ok:1',
    'incidentul doar raportat se șterge logic', v_text);

  -- (27) mutarea pe alt vehicul
  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent,
                              created_by, updated_by)
  values (gen_random_uuid(), v_org, 'B' || (100 + (random() * 800)::int)::text || 'AM2', 'Dacia', 'Sandero', 100,
          v_u_admin, v_u_admin);
  insert into public.vehicle_incidents (organization_id, vehicle_id, tip, produs_la, descriere,
                                        created_by, updated_by)
  values (v_org, v_veh, 'avarie', pg_temp.la(v_zi - 1, '19:00'), 'Pe vehiculul greșit', v_u_admin, v_u_admin)
  returning id into v_inc2;
  v_text := pg_temp.ruleaza(v_u_admin, format(
    $q$update public.vehicle_incidents set vehicle_id = (select id from public.vehicles
       where organization_id = %L and id <> %L limit 1) where id = %L$q$, v_org, v_veh, v_inc2));
  v_esecuri := v_esecuri + pg_temp.verifica('27', v_text like 'P0001:Incidentul nu se mută pe alt vehicul%',
    'incidentul nu se mută pe alt vehicul (P0001)', v_text);

  -- (28) lista de conformitate păstrează toate ramurile
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  v_n := app.poate_vedea_expirabil(v_org, 'vehicle_fine')::int
       + 10 * app.poate_vedea_expirabil(v_org, 'vehicle_document')::int
       + 100 * app.poate_vedea_expirabil(v_org, 'driver_license')::int
       + 1000 * app.poate_vedea_expirabil(v_org, 'vehicle_service')::int;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  v_m := app.poate_vedea_expirabil(v_org, 'vehicle_fine')::int
       + 10 * app.poate_vedea_expirabil(v_org, 'vehicle_document')::int
       + 100 * app.poate_vedea_expirabil(v_org, 'driver_license')::int
       + 1000 * app.poate_vedea_expirabil(v_org, 'vehicle_service')::int;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  v_sursa := (app.poate_vedea_expirabil(v_org, 'vehicle_fine'))::text;
  reset role;
  v_esecuri := v_esecuri + pg_temp.verifica('28', v_n = 1111 and v_m = 100 and v_sursa = 'false',
    'lista de conformitate: org_admin vede amenda, documentul, permisul și service-ul; hr doar permisul; managerul nu vede amenda',
    format('org_admin %s, hr %s, manager %s', v_n, v_m, v_sursa));

  -- (29) auditul
  select count(*) into v_n from public.audit_logs
   where entity_type = 'vehicle_fines' and entity_id = v_f1;
  select count(*) into v_m from public.audit_logs
   where entity_type = 'vehicle_incidents' and entity_id = v_inc;
  v_esecuri := v_esecuri + pg_temp.verifica('29', v_n >= 4 and v_m >= 4,
    'fiecare scriere pe amenzi și incidente lasă urmă în audit_logs',
    format('amenda %s rânduri, incidentul %s', v_n, v_m));

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA FLOTA AMENZI: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE verificările au trecut.';
  raise notice '';
end;
$$;

rollback;
