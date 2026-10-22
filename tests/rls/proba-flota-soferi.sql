-- tests/rls/proba-flota-soferi.sql
--
-- FLOTA, DUPĂ 0204: PERMISELE ȘOFERILOR, AVIZUL MEDICAL, VERIFICĂRILE
-- ÎNCRUCIȘATE ȘI LEGĂTURA FOII CU DEPLASAREA.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- (1)  hr înregistrează permisul unui angajat; categoriile se normalizează [POZITIVĂ];
-- (2)  scadența permisului ajunge în `expirables`, pe șofer             [POZITIVĂ];
-- (3)  hr reînnoiește permisul (UPDATE), iar scadența se mută            [POZITIVĂ];
-- (4)  al doilea permis activ pe același angajat: 23505;
-- (5)  o categorie inexistentă: P0001;
-- (6)  angajatul altei firme: cheia străină compusă refuză (23503);
-- (7)  managerul vede permisul subordonatului [POZITIVĂ], nu și pe al
--      celorlalți, și nu scrie permise (42501);
-- (8)  angajatul își vede permisul [POZITIVĂ], nu pe al colegului, și nu și-l
--      modifică (zero rânduri);
-- (9)  permisul nu se mută pe alt angajat (P0001);
-- (10) `hr` nu vede parcul (decizia 3): zero vehicule;
-- (11) faptele verificărilor, citite de manager pe subordonat: absență
--      aprobată (CM-ul NU se deosebește de concediu), permis expirat, aviz
--      expirat (managerul are `ssm:read = team`, deci poate citi examenul și
--      prin RLS: nu e o ocolire), delegație aprobată                  [POZITIVĂ];
-- (12) avizul `inapt` iese „lipsa”, nu „inapt” (art. 9 GDPR);
-- (13) contractul încetat se vede în fapte                             [POZITIVĂ];
-- (14) angajatul nu află faptele colegului (zero rânduri), iar avizul
--      colegului îi vine `null`;
-- (15) angajatul își leagă foaia de propria deplasare               [POZITIVĂ];
-- (16) foaia nu se leagă de deplasarea altui angajat (P0001); angajatul, care
--      n-o vede, primește mesajul de „inexistentă”, nu „a altui angajat”;
-- (16b) org_admin, care o vede, primește motivul exact;
-- (17) foaia nu se leagă de deplasarea altei firme (P0001);
-- (18) org_admin vede scadența permisului în lista de conformitate   [POZITIVĂ];
-- (19) ștergerea logică a permisului scoate scadența din `expirables` [POZITIVĂ];
-- (20) super_admin (platform_admins, NU membru) citește permisele și faptele
--      firmei [POZITIVĂ] — consola de platformă; nu scrie în numele firmei;
-- ── CONSTATAREA DE SECURITATE (GDPR art. 9), reparată în 0204 ──────────────
-- (21) concediul de odihnă și CM-ul ies IDENTIC, „absent”: tipul concediului
--      nu ajunge la cine vede doar foile;
-- (22) managerul căruia i s-a retras `ssm:read` NU primește NIMIC derivat din avizul
--      medical: `null` și la „lipsă”, și la „expirat” (nici „de_verificat”, care ar
--      spune că avizul NU e valabil); prin RLS nu vede nici examenul (zero rânduri);
-- (23) `hr` (ssm = all) primește avizul exact, iar `inapt` rămâne „lipsa” [POZITIVĂ];
-- (24) `org_admin` primește tot: absent + aviz exact                      [POZITIVĂ];
-- (25) angajatul își vede avizul exact (`ssm:read = own`) [POZITIVĂ], dar al
--      colegului nu (null);
-- (26) avizul VALABIL: „apt” pentru cine are acces SSM (hr, org_admin) [POZITIVĂ],
--      dar managerul fără `ssm:read` primește tot `null` — nici „apt” nu scapă;
-- (27) integrarea cu traseul F7 (service): rescrierea lui `app.poate_vedea_expirabil`
--      din 0204 păstrează ramura `vehicle_service` din 0203, altfel scadențele de
--      service ar fi dispărut tăcut din lista de conformitate: org_admin vede
--      service, permis și document de vehicul; hr vede permisul, nu și parcul
--      [POZITIVĂ + NEGATIVĂ].
-- ── DECIZIA LUI MIRO (12 oct) ȘI A DOUA CONSTATARE DE SECURITATE ────────────
-- Fără acces SSM pe fișa șoferului (și fără `vehicles:update = all`), avizul iese
-- `null` („nu se știe”); câmpurile permisului ies `null` pentru cine n-ar trece
-- politica `driver_licenses_select` pe acel angajat (`verificari_soferi` e
-- SECURITY DEFINER și ocolea RLS-ul). Absența („absent”), contractul încetat și
-- delegația rămân neschimbate.
-- (28) managerul CU `ssm:read = team` (seed-ul, suprascrierea ștearsă) primește avizul
--      EXACT, ca prin RLS: expirat -> „expirat”, examenul îi e vizibil     [POZITIVĂ];
-- (29) managerul cu `driver_licenses:read` retras vede în continuare rândul (foile
--      echipei) și absența/delegația, dar permis_exista, permis_categorii și
--      permis_expira_la ies `null`; prin RLS nu vede permisul (zero rânduri). Cu
--      seed-ul (read = team) primea permisul exact                      [POZITIVĂ];
-- (30) `hr` primește permisul exact (categorii, expirare) și avizul exact [POZITIVĂ];
-- (31) `org_admin` primește tot: permis, aviz, absență                     [POZITIVĂ];
-- (32) angajatul, pe propria fișă: permisul propriu și avizul propriu exacte
--      (`driver_licenses:read = own`, `ssm:read = own`)                    [POZITIVĂ];
-- (33) super_admin (platformă) primește permisul și avizul exacte         [POZITIVĂ];
-- (34) cu SSM deschis, `inapt` iese „lipsa” (niciodată „inapt”), iar avizul valabil
--      iese „apt”, pentru managerul cu seed-ul și pentru hr              [POZITIVĂ];
-- (35) ramura parcului: `vehicles:update = all` fără `ssm:read` primește avizul exact
--      (administrează parcul); fără ea, rămâne `null`                    [POZITIVĂ].
-- ── A TREIA OCOLIRE (delegația), găsită de santinela adversarială ───────────
-- (36) `delegatie` iese exactă doar pentru cine ar trece `business_trips_select`
--      (manager cu per_diem:read = team, org_admin, angajatul pe sine); `hr`
--      (fără per_diem) și super_admin (nu e membru al firmei) primesc `null`,
--      nu `true` și nu `false`; deplasările, numărate prin RLS     [POZITIVĂ + NEGATIVĂ];
-- (37) managerul căruia i s-a retras `per_diem:read` păstrează rândul și absența,
--      dar delegația îi iese `null` (RLS îi dă zero deplasări).
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh --pastreaza
--   psql … -f tests/rls/proba-flota-soferi.sql
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
  v_e_coleg   uuid := gen_random_uuid();
  v_e_plecat  uuid := gen_random_uuid();
  v_e_strain  uuid := gen_random_uuid();
  v_vehicul   uuid := gen_random_uuid();
  v_tara      uuid;
  v_tara_alta uuid;
  v_permis    uuid;
  v_permis_c  uuid;
  v_foaie     uuid;
  v_depl_ang  uuid;
  v_depl_col  uuid;
  v_depl_str  uuid;
  v_cat       text[];
  v_exp       date;
  v_resp      uuid;
  v_n         integer;
  v_m         integer;
  v_n2        integer;
  v_r         record;
  v_r2        record;
  v_text      text;
  v_text2     text;
  v_cm        text;
  v_hr_lipsa  text;
  v_exam      uuid;
  v_esecuri   int := 0;
  v_zi        date := app.azi_local();
begin
  raise notice '';
  raise notice '  PROBA „FLOTA — ȘOFERI" (0204)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-sofer-' || v_sufix, 'Proba Șoferi SRL',
     'RO' || (86000000 + (random() * 900000)::int)::text),
    (v_org_alta, 'proba-sofer-alta-' || v_sufix, 'Altă Firmă SRL',
     'RO' || (87000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select o, f.feature_key, true, now() from public.features f, unnest(array[v_org, v_org_alta]) o;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_admin, 'sof-adm-' || v_sufix || '@proba.test', now()),
    (v_u_hr,    'sof-hr-'  || v_sufix || '@proba.test', now()),
    (v_u_mgr,   'sof-mgr-' || v_sufix || '@proba.test', now()),
    (v_u_ang,   'sof-ang-' || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_admin, 'org_admin'),
    (v_org, v_u_hr,    'hr'),
    (v_org, v_u_mgr,   'manager'),
    (v_org, v_u_ang,   'employee');

  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_mgr,    v_org, 'SF-M', 'Mihai',  'Manager', v_zi - 500, 'activ', v_u_mgr, null);
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_ang,    v_org, 'SF-A', 'Ana',    'Șofer',   v_zi - 400, 'activ', v_u_ang, v_e_mgr),
    (v_e_coleg,  v_org, 'SF-C', 'Cornel', 'Coleg',   v_zi - 400, 'activ', null,    null),
    (v_e_strain, v_org_alta, 'SF-X', 'Xenia', 'Străină', v_zi - 400, 'activ', null, null);

  -- Vehiculul pool: oricine are drept de foaie întocmește pe el (0199).
  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent, pool,
                               created_by, updated_by)
  values (v_vehicul, v_org, 'B' || (100 + (random() * 800)::int)::text || 'SOF', 'Dacia', 'Logan', 10000, true,
          v_u_admin, v_u_admin);

  select c.id into v_tara from public.countries c where c.cod_alpha2 = 'RO' limit 1;
  insert into public.per_diem_policies
    (organization_id, denumire, country_id_intern, moneda_interna, diurna_interna_zi,
     diurna_baza_legala_interna, multiplu_plafon_neimpozabil, multiplu_diurna_externa,
     prag_ore_minim, prag_ore_zi_intreaga, fractiune_zi_partiala, tarif_km_auto_personal,
     moneda_tarif_km, plafon_salarii_baza_luna, valabil_de_la)
  select o, 'Politica de probă', v_tara, 'RON', 125, 0, 1, 1, 12, 12, 1, 0, 'RON', 1, v_zi - 400
    from unnest(array[v_org, v_org_alta]) o;

  -- (1) hr înregistrează permisul Anei
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  begin
    insert into public.driver_licenses (organization_id, employee_id, numar, categorii, eliberat_la, expira_la)
    values (v_org, v_e_ang, ' ab 123 456 ', array['ce', 'b', 'B'], v_zi - 1000, v_zi + 400)
    returning id, categorii into v_permis, v_cat;
    reset role;
    if v_cat = array['B', 'CE'] then
      raise notice '  ✓ (1) hr înregistrează permisul; categoriile devin {B,CE}';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (1) categoriile au ieșit %', v_cat;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) hr nu poate înregistra permisul: % (%)', sqlerrm, sqlstate;
  end;

  -- (2) proiecția în expirables
  select x.expires_at, x.responsible_employee_id into v_exp, v_resp
    from public.expirables x
   where x.entity_type = 'driver_license' and x.entity_id = v_permis and x.deleted_at is null;
  if v_exp = v_zi + 400 and v_resp = v_e_ang then
    raise notice '  ✓ (2) scadența permisului e în expirables, pe șofer';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) expirables: expires_at %, responsabil %', v_exp, v_resp;
  end if;

  -- (3) reînnoirea
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  with schimbate as (
    update public.driver_licenses set expira_la = v_zi + 3000 where id = v_permis returning 1
  ) select count(*) into v_n from schimbate;
  reset role;
  select x.expires_at into v_exp
    from public.expirables x
   where x.entity_type = 'driver_license' and x.entity_id = v_permis and x.deleted_at is null;
  if v_n = 1 and v_exp = v_zi + 3000 then
    raise notice '  ✓ (3) reînnoirea mută scadența';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) reînnoire: % rânduri, scadența %', v_n, v_exp;
  end if;

  -- (4) al doilea permis activ
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  begin
    insert into public.driver_licenses (organization_id, employee_id, numar, categorii, expira_la)
    values (v_org, v_e_ang, 'DUBLU1', array['B'], v_zi + 100);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) al doilea permis activ a fost acceptat';
  exception when unique_violation then
    reset role;
    raise notice '  ✓ (4) un singur permis activ pe angajat (23505)';
  end;

  -- (5) categorie inexistentă
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  begin
    insert into public.driver_licenses (organization_id, employee_id, numar, categorii, expira_la)
    values (v_org, v_e_coleg, 'CAT123', array['B', 'X9'], v_zi + 100);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) categoria X9 a fost acceptată';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (5) categoria inexistentă e refuzată: %', sqlerrm;
  end;

  -- (6) angajatul altei firme, pe firma de probă
  begin
    insert into public.driver_licenses (organization_id, employee_id, numar, categorii, expira_la)
    values (v_org, v_e_strain, 'STR123', array['B'], v_zi + 100);
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) permisul unui angajat din altă firmă a fost acceptat';
  exception when foreign_key_violation then
    raise notice '  ✓ (6) cheia străină compusă refuză angajatul altei firme (23503)';
  end;

  -- Permisul colegului, expirat (pentru (7), (8), (11)).
  insert into public.driver_licenses (organization_id, employee_id, numar, categorii, expira_la, created_by, updated_by)
  values (v_org, v_e_coleg, 'COL123', array['B'], v_zi - 5, v_u_admin, v_u_admin)
  returning id into v_permis_c;

  -- (7) managerul
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  select count(*) filter (where employee_id = v_e_ang), count(*) filter (where employee_id = v_e_coleg)
    into v_n, v_m
    from public.driver_licenses where organization_id = v_org;
  reset role;
  if v_n = 1 and v_m = 0 then
    raise notice '  ✓ (7a) managerul vede permisul subordonatului, nu și pe al colegului din afara echipei';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7a) managerul vede % permise ale Anei și % ale colegului', v_n, v_m;
  end if;
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    insert into public.driver_licenses (organization_id, employee_id, numar, categorii, expira_la)
    values (v_org, v_e_mgr, 'MGR123', array['B'], v_zi + 100);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7b) managerul a înregistrat un permis';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (7b) managerul nu scrie permise (42501)';
  end;

  -- (8) angajatul
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  select count(*) filter (where employee_id = v_e_ang), count(*) filter (where employee_id = v_e_coleg)
    into v_n, v_m
    from public.driver_licenses where organization_id = v_org;
  with schimbate as (
    update public.driver_licenses set expira_la = v_zi + 9000 where id = v_permis returning 1
  ) select v_n * 100 + v_m * 10 + count(*) into v_n from schimbate;
  reset role;
  if v_n = 100 then
    raise notice '  ✓ (8) angajatul își vede permisul, nu pe al colegului, și nu-l modifică';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) angajat: propriu×100 + coleg×10 + modificate = %, așteptat 100', v_n;
  end if;

  -- (9) mutarea permisului
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  begin
    update public.driver_licenses set employee_id = v_e_mgr where id = v_permis;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) permisul a fost mutat pe alt angajat';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (9) permisul nu se mută pe alt angajat';
  end;

  -- (10) hr nu vede parcul
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  select count(*) into v_n from public.vehicles where organization_id = v_org;
  reset role;
  if v_n = 0 then
    raise notice '  ✓ (10) hr nu vede vehiculele (decizia 3)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10) hr vede % vehicule', v_n;
  end if;

  -- (11) faptele, pe subordonat: CM azi, permis expirat, aviz expirat, delegație
  update public.driver_licenses set expira_la = v_zi - 1 where id = v_permis;
  insert into public.leave_requests
    (organization_id, employee_id, leave_type_id, data_inceput, data_sfarsit, status, created_by)
  values (v_org, v_e_ang,
          (select lt.id from public.leave_types lt
            where lt.organization_id = v_org and lt.tip_zi_pontaj = 'medical' and lt.deleted_at is null limit 1),
          v_zi, v_zi, 'aprobata', v_u_admin);
  insert into public.occupational_health_exams (organization_id, employee_id, tip, data_examinarii, rezultat, valabil_pana)
  values (v_org, v_e_ang, 'periodic', v_zi - 400, 'apt', v_zi - 10);
  insert into public.business_trips
    (organization_id, employee_id, country_id, localitate, plecare_la, sosire_la, status, scop, mijloc_transport)
  values (v_org, v_e_ang, v_tara, 'Cluj-Napoca', now() - interval '1 day', now() + interval '1 day',
          'ciorna', 'Probă', 'auto_serviciu')
  returning id into v_depl_ang;
  update public.business_trips set status = 'aprobata' where id = v_depl_ang;

  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  select * into v_r from public.verificari_soferi(v_org, array[v_e_ang], v_zi);
  reset role;
  if v_r.employee_id = v_e_ang and v_r.concediu = 'absent' and v_r.permis_exista
     and v_r.permis_expira_la = v_zi - 1 and v_r.aviz = 'expirat' and v_r.delegatie
     and not v_r.contract_incetat then
    raise notice '  ✓ (11) managerul citește faptele subordonatului: absent (CM-ul nu se deosebește), permis expirat, aviz expirat (ssm:read team), delegație';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (11) fapte: %', row_to_json(v_r);
  end if;

  -- (12) avizul inapt nu iese ca atare
  insert into public.occupational_health_exams (organization_id, employee_id, tip, data_examinarii, rezultat)
  values (v_org, v_e_ang, 'periodic', v_zi - 1, 'inapt_temporar');
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  v_text := app.stare_aviz_sofer(v_org, v_e_ang, v_zi);
  reset role;
  if v_text = 'lipsa' then
    raise notice '  ✓ (12) rezultatul inapt iese „lipsa”';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (12) avizul a ieșit %', v_text;
  end if;

  -- (13) contract încetat
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, terminated_on, status, user_id, manager_employee_id)
  values (v_e_plecat, v_org, 'SF-P', 'Petru', 'Plecat', v_zi - 900, v_zi - 30, 'incetat', null, v_e_mgr);
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  select * into v_r from public.verificari_soferi(v_org, array[v_e_plecat], v_zi);
  reset role;
  if v_r.employee_id = v_e_plecat and v_r.contract_incetat and not v_r.permis_exista then
    raise notice '  ✓ (13) contractul încetat și permisul lipsă se văd în fapte';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (13) fapte pentru omul plecat: %', row_to_json(v_r);
  end if;

  -- (14) angajatul nu află faptele colegului
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  select count(*) into v_n from public.verificari_soferi(v_org, array[v_e_coleg, v_e_ang], v_zi);
  v_text := coalesce(app.stare_aviz_sofer(v_org, v_e_coleg, v_zi), 'NULL');
  reset role;
  if v_n = 1 and v_text = 'NULL' then
    raise notice '  ✓ (14) angajatul își vede doar faptele lui; avizul colegului îi vine null';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (14) angajatul vede % rânduri de fapte, avizul colegului %', v_n, v_text;
  end if;

  -- (15)-(17) foaia legată de deplasare
  insert into public.business_trips
    (organization_id, employee_id, country_id, localitate, plecare_la, sosire_la, status, scop, mijloc_transport)
  values (v_org, v_e_coleg, v_tara, 'Iași', now() - interval '1 day', now() + interval '1 day',
          'ciorna', 'Probă coleg', 'auto_serviciu')
  returning id into v_depl_col;
  select c.id into v_tara_alta from public.countries c where c.cod_alpha2 = 'RO' limit 1;
  insert into public.business_trips
    (organization_id, employee_id, country_id, localitate, plecare_la, sosire_la, status, scop, mijloc_transport)
  values (v_org_alta, v_e_strain, v_tara_alta, 'Arad', now() - interval '1 day', now() + interval '1 day',
          'ciorna', 'Probă străină', 'auto_serviciu')
  returning id into v_depl_str;

  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                    created_by, updated_by)
    values (v_org, v_vehicul, v_e_ang, now() - interval '3 hours', 10000, v_u_ang, v_u_ang)
    returning id into v_foaie;
    with schimbate as (
      update public.trip_sheets set business_trip_id = v_depl_ang, updated_by = v_u_ang
       where id = v_foaie returning 1
    ) select count(*) into v_n from schimbate;
    reset role;
    if v_n = 1 then
      raise notice '  ✓ (15) angajatul își leagă foaia de propria deplasare';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (15) legarea foii: % rânduri', v_n;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (15) angajatul nu-și poate lega foaia: % (%)', sqlerrm, sqlstate;
  end;

  -- (16) Angajatul NU vede deplasarea colegului (`per_diem:read = own`), deci
  -- refuzul nu are voie să-i spună că există, al cui e sau în ce stare: același
  -- mesaj ca pentru o deplasare inexistentă. Garda rulează cu drepturile bazei.
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set business_trip_id = v_depl_col, updated_by = v_u_ang where id = v_foaie;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (16) foaia s-a legat de deplasarea colegului';
  exception when raise_exception then
    reset role;
    if sqlerrm = 'Deplasarea aleasă nu există în organizația dumneavoastră sau nu o puteți consulta.' then
      raise notice '  ✓ (16) deplasarea colegului (nevăzută) e refuzată ca una inexistentă: %', sqlerrm;
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (16) refuzul spune despre o deplasare pe care angajatul n-o vede: %', sqlerrm;
    end if;
  end;

  -- (16b) org_admin VEDE deplasarea colegului: primește motivul exact.
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set business_trip_id = v_depl_col, updated_by = v_u_admin where id = v_foaie;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (16b) org_admin a legat foaia de deplasarea altui angajat';
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Deplasarea aleasă este a altui angajat%' then
      raise notice '  ✓ (16b) cine vede deplasarea primește motivul: %', sqlerrm;
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (16b) org_admin primește alt refuz: %', sqlerrm;
    end if;
  end;

  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set business_trip_id = v_depl_str, updated_by = v_u_ang where id = v_foaie;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (17) foaia s-a legat de deplasarea altei firme';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (17) deplasarea altei firme e refuzată';
  end;

  -- (18) org_admin vede scadența în lista de conformitate
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  select count(*) into v_n from public.expirables
   where organization_id = v_org and entity_type = 'driver_license';
  reset role;
  if v_n = 2 then
    raise notice '  ✓ (18) org_admin vede cele două scadențe de permis';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (18) org_admin vede % scadențe de permis, așteptat 2', v_n;
  end if;

  -- (19) ștergerea logică
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  with sterse as (
    update public.driver_licenses set deleted_at = now() where id = v_permis_c returning 1
  ) select count(*) into v_n from sterse;
  reset role;
  if v_n = 1 and not exists (select 1 from public.expirables x
                              where x.entity_id = v_permis_c and x.deleted_at is null) then
    raise notice '  ✓ (19) ștergerea logică scoate scadența din expirables';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (19) ștergere: % rânduri, scadența rămasă: %', v_n,
      exists (select 1 from public.expirables x where x.entity_id = v_permis_c and x.deleted_at is null);
  end if;

  -- (20) super_admin
  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_sa, 'sof-sa-' || v_sufix || '@proba.test', now());
  insert into public.platform_admins (user_id) values (v_u_sa);
  perform set_config('request.jwt.claim.sub', v_u_sa::text, true);
  set local role authenticated;
  select count(*) into v_n from public.driver_licenses where organization_id = v_org and deleted_at is null;
  select count(*) into v_m from public.verificari_soferi(v_org, array[v_e_ang, v_e_coleg], v_zi);
  reset role;
  if v_n = 1 and v_m = 2 then
    raise notice '  ✓ (20) super_admin citește permisul activ și faptele ambilor șoferi';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (20) super_admin: % permise active, % rânduri de fapte', v_n, v_m;
  end if;

  -- ═══ CONSTATAREA DE SECURITATE: DATE DE SĂNĂTATE (GDPR art. 9) ══════════════
  -- Până la reparație, `verificari_soferi` și `stare_aviz_sofer` (SECURITY
  -- DEFINER) întorceau oricui vede foile șoferului tipul concediului (CM vs
  -- odihnă) și avizul EXACT, ocolind RLS-ul din `leave_requests` și din
  -- `occupational_health_exams`.
  --
  -- Ana mai are un concediu de odihnă peste 20 de zile; CM-ul de azi e din (11).
  insert into public.leave_requests
    (organization_id, employee_id, leave_type_id, data_inceput, data_sfarsit, status, created_by)
  values (v_org, v_e_ang,
          (select lt.id from public.leave_types lt
            where lt.organization_id = v_org and lt.tip_zi_pontaj = 'concediu' and lt.deleted_at is null limit 1),
          v_zi + 20, v_zi + 20, 'aprobata', v_u_admin);

  -- Managerului i se retrage `ssm:read` (rol fără acces la medicina muncii).
  insert into public.role_permissions (organization_id, role, resource, action, scope)
  values (v_org, 'manager', 'ssm', 'read', 'none');

  -- (21) CM-ul și concediul de odihnă ies identic
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  select (select string_agg(distinct c.concediu, ',') from public.verificari_soferi(v_org, array[v_e_ang], v_zi) c),
         (select string_agg(distinct c.concediu, ',') from public.verificari_soferi(v_org, array[v_e_ang], v_zi + 20) c)
    into v_text, v_cm;
  reset role;
  if v_text = 'absent' and v_cm = 'absent' then
    raise notice '  ✓ (21) CM-ul și concediul de odihnă ies la fel, „absent”: tipul nu se vede';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (21) concediu medical: %, concediu de odihnă: %', v_text, v_cm;
  end if;

  -- (22) fără acces SSM: NIMIC derivat din aviz. Nici „de_verificat” (ar fi spus că
  -- avizul NU e valabil), nici „apt”, nici „lipsa”/„expirat”: `null` = „nu se știe”.
  -- Rândul de fapte rămâne (managerul vede foile omului), doar `aviz` e null.
  -- `string_agg` întoarce null și când nu e niciun rând, deci numărăm rândurile.
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  select count(*), string_agg(c.aviz, ',') into v_n, v_text
    from public.verificari_soferi(v_org, array[v_e_ang], v_zi) c;
  select count(*) into v_m
    from public.occupational_health_exams where organization_id = v_org and employee_id = v_e_ang;
  reset role;
  -- `hr` (ssm = all), în aceeași stare: avizul inapt iese „lipsa” (23)
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  select string_agg(c.aviz, ',') into v_hr_lipsa from public.verificari_soferi(v_org, array[v_e_ang], v_zi) c;
  reset role;
  insert into public.occupational_health_exams (organization_id, employee_id, tip, data_examinarii, rezultat, valabil_pana)
  values (v_org, v_e_ang, 'periodic', v_zi, 'apt', v_zi - 5)
  returning id into v_exam;
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  select count(*), string_agg(c.aviz, ',') into v_n2, v_cm
    from public.verificari_soferi(v_org, array[v_e_ang], v_zi) c;
  v_text2 := app.stare_aviz_sofer(v_org, v_e_ang, v_zi);
  reset role;
  if v_n = 1 and v_text is null and v_n2 = 1 and v_cm is null and v_text2 is null and v_m = 0 then
    raise notice '  ✓ (22) managerul fără ssm:read primește aviz null la lipsă ȘI la expirat, direct și prin fapte; examenul nu-i e vizibil prin RLS (0 rânduri)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (22) aviz pentru manager fără ssm: rânduri=% lipsă=%, rânduri=% expirat=%, direct=%, examene prin RLS=% (așteptat null/null/null, 0)',
      v_n, coalesce(v_text, 'NULL'), v_n2, coalesce(v_cm, 'NULL'), coalesce(v_text2, 'NULL'), v_m;
  end if;

  -- (23) hr: exact, în ambele stări
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  select string_agg(c.aviz, ',') into v_cm from public.verificari_soferi(v_org, array[v_e_ang], v_zi) c;
  reset role;
  if v_hr_lipsa = 'lipsa' and v_cm = 'expirat' then
    raise notice '  ✓ (23) hr (ssm = all) primește avizul exact: inapt -> lipsa, valabilitate depășită -> expirat';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (23) hr: stare inapt=%, stare expirat=%', v_hr_lipsa, v_cm;
  end if;

  -- (24) org_admin: tot
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  select * into v_r from public.verificari_soferi(v_org, array[v_e_ang], v_zi);
  reset role;
  if v_r.employee_id = v_e_ang and v_r.concediu = 'absent' and v_r.aviz = 'expirat' and v_r.permis_exista then
    raise notice '  ✓ (24) org_admin primește faptele: absent, aviz exact, permis';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (24) org_admin: %', row_to_json(v_r);
  end if;

  -- (25) angajatul își vede avizul exact (ssm:read own); al colegului, null
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  v_text := app.stare_aviz_sofer(v_org, v_e_ang, v_zi);
  v_text2 := coalesce(app.stare_aviz_sofer(v_org, v_e_coleg, v_zi), 'NULL');
  reset role;
  if v_text = 'expirat' and v_text2 = 'NULL' then
    raise notice '  ✓ (25) angajatul își vede avizul exact; al colegului îi vine null';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (25) angajatul: al lui %, al colegului %', v_text, v_text2;
  end if;

  -- (26) avizul VALABIL: „apt” pentru cine are acces SSM; managerul fără ssm:read nu
  -- primește nici „apt” (absența unui semnal nu poate fi deosebită de „apt” ca să
  -- se scoată, prin eliminare, „nu e valabil”).
  update public.occupational_health_exams set valabil_pana = v_zi + 200 where id = v_exam;
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  select count(*), string_agg(c.aviz, ',') into v_n, v_text
    from public.verificari_soferi(v_org, array[v_e_ang], v_zi) c;
  v_text2 := app.stare_aviz_sofer(v_org, v_e_ang, v_zi);
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  select string_agg(c.aviz, ',') into v_hr_lipsa from public.verificari_soferi(v_org, array[v_e_ang], v_zi) c;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  select string_agg(c.aviz, ',') into v_cm from public.verificari_soferi(v_org, array[v_e_ang], v_zi) c;
  reset role;
  if v_n = 1 and v_text is null and v_text2 is null and v_hr_lipsa = 'apt' and v_cm = 'apt' then
    raise notice '  ✓ (26) avizul valabil: hr și org_admin primesc „apt”, managerul fără ssm:read primește null (nici „apt” nu scapă)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (26) aviz valabil: manager fără ssm=% (direct %), hr=%, org_admin=% (așteptat null, null, apt, apt)',
      coalesce(v_text, 'NULL'), coalesce(v_text2, 'NULL'), v_hr_lipsa, v_cm;
  end if;

  -- (27) ramura `vehicle_service` (F7, 0203) nu se pierde în rescrierea din 0204
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  v_n := app.poate_vedea_expirabil(v_org, 'vehicle_service')::int
       + 10 * app.poate_vedea_expirabil(v_org, 'driver_license')::int
       + 100 * app.poate_vedea_expirabil(v_org, 'vehicle_document')::int;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  v_m := app.poate_vedea_expirabil(v_org, 'vehicle_service')::int
       + 10 * app.poate_vedea_expirabil(v_org, 'driver_license')::int
       + 100 * app.poate_vedea_expirabil(v_org, 'vehicle_document')::int;
  reset role;
  if v_n = 111 and v_m = 10 then
    raise notice '  ✓ (27) lista de conformitate păstrează service-ul (F7): org_admin 111, hr 010 (permisul da, parcul nu)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (27) org_admin %, așteptat 111; hr %, așteptat 10', v_n, v_m;
  end if;

  -- ═══ DECIZIA LUI MIRO (12 oct) + A DOUA CONSTATARE: FĂRĂ ACCES, FĂRĂ SEMNAL ═══
  -- Starea de plecare pentru (28)–(33): suprascrierea `ssm:read = none` a managerului
  -- dispare (are din nou seed-ul: `ssm:read = team`), iar fișa de aptitudine a Anei e
  -- expirată (latest = v_exam: apt, valabil_pana în trecut).
  delete from public.role_permissions
   where organization_id = v_org and role = 'manager' and resource = 'ssm' and action = 'read';
  update public.occupational_health_exams set rezultat = 'apt', valabil_pana = v_zi - 5 where id = v_exam;

  -- (28) managerul CU ssm:read = team (seed-ul) primește avizul EXACT, ca prin RLS
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  select count(*), string_agg(c.aviz, ',') into v_n, v_text
    from public.verificari_soferi(v_org, array[v_e_ang], v_zi) c;
  v_text2 := app.stare_aviz_sofer(v_org, v_e_ang, v_zi);
  select count(*) into v_m
    from public.occupational_health_exams where organization_id = v_org and employee_id = v_e_ang;
  reset role;
  if v_n = 1 and v_text = 'expirat' and v_text2 = 'expirat' and v_m = 3 then
    raise notice '  ✓ (28) managerul cu ssm:read = team (seed) primește avizul exact (expirat), iar RLS îi arată cele 3 examene: nu e o ocolire';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (28) manager cu ssm:read team: rânduri=%, prin fapte=%, direct=%, examene prin RLS=% (așteptat 1, expirat, expirat, 3)',
      v_n, coalesce(v_text, 'NULL'), coalesce(v_text2, 'NULL'), v_m;
  end if;

  -- (29) permisul: câmpurile ies doar pentru cine ar trece `driver_licenses_select`.
  -- Cu seed-ul (driver_licenses:read = team) managerul îl primește; fără el, rândul
  -- (foile echipei) și absența/delegația rămân, permisul iese null, ca prin RLS.
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  select * into v_r from public.verificari_soferi(v_org, array[v_e_ang], v_zi);
  reset role;
  insert into public.role_permissions (organization_id, role, resource, action, scope)
  values (v_org, 'manager', 'driver_licenses', 'read', 'none');
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  select * into v_r2 from public.verificari_soferi(v_org, array[v_e_ang], v_zi);
  select count(*) into v_m
    from public.driver_licenses where organization_id = v_org and employee_id = v_e_ang;
  reset role;
  delete from public.role_permissions
   where organization_id = v_org and role = 'manager' and resource = 'driver_licenses' and action = 'read';
  if v_r.permis_exista and v_r.permis_categorii = array['B', 'CE'] and v_r.permis_expira_la = v_zi - 1
     and v_r2.employee_id = v_e_ang and v_r2.permis_exista is null and v_r2.permis_categorii is null
     and v_r2.permis_expira_la is null and v_r2.concediu = 'absent' and v_r2.delegatie
     and not v_r2.contract_incetat and v_r2.aviz = 'expirat' and v_m = 0 then
    raise notice '  ✓ (29) cu driver_licenses:read = team managerul primește permisul exact; cu citirea retrasă permisul iese null (și RLS îi dă 0 rânduri), absența/delegația/avizul rămân';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (29) permis: cu seed %, fără citire % (permis prin RLS: % rânduri)',
      row_to_json(v_r), row_to_json(v_r2), v_m;
  end if;

  -- (30) hr: permisul exact și avizul exact
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  select * into v_r from public.verificari_soferi(v_org, array[v_e_ang], v_zi);
  reset role;
  if v_r.employee_id = v_e_ang and v_r.permis_exista and v_r.permis_categorii = array['B', 'CE']
     and v_r.permis_expira_la = v_zi - 1 and v_r.aviz = 'expirat' then
    raise notice '  ✓ (30) hr primește permisul exact (B, CE, expirat ieri) și avizul exact';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (30) hr: %', row_to_json(v_r);
  end if;

  -- (31) org_admin: tot
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  select * into v_r from public.verificari_soferi(v_org, array[v_e_ang], v_zi);
  reset role;
  if v_r.employee_id = v_e_ang and v_r.concediu = 'absent' and v_r.permis_exista
     and v_r.permis_categorii = array['B', 'CE'] and v_r.permis_expira_la = v_zi - 1
     and v_r.aviz = 'expirat' and v_r.delegatie then
    raise notice '  ✓ (31) org_admin primește tot: absent, permis exact, aviz exact, delegație';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (31) org_admin: %', row_to_json(v_r);
  end if;

  -- (32) angajatul, pe propria fișă: permisul și avizul proprii, exacte
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  select * into v_r from public.verificari_soferi(v_org, array[v_e_ang, v_e_coleg], v_zi);
  reset role;
  if v_r.employee_id = v_e_ang and v_r.permis_exista and v_r.permis_categorii = array['B', 'CE']
     and v_r.permis_expira_la = v_zi - 1 and v_r.aviz = 'expirat' then
    raise notice '  ✓ (32) angajatul își primește permisul și avizul exacte (own)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (32) angajat, fișa proprie: %', row_to_json(v_r);
  end if;

  -- (33) super_admin (platformă): permis și aviz exacte
  perform set_config('request.jwt.claim.sub', v_u_sa::text, true);
  set local role authenticated;
  select * into v_r from public.verificari_soferi(v_org, array[v_e_ang], v_zi);
  reset role;
  if v_r.employee_id = v_e_ang and v_r.permis_exista and v_r.permis_categorii = array['B', 'CE']
     and v_r.permis_expira_la = v_zi - 1 and v_r.aviz = 'expirat' then
    raise notice '  ✓ (33) super_admin primește permisul și avizul exacte';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (33) super_admin: %', row_to_json(v_r);
  end if;

  -- (34) cu SSM deschis: inapt iese „lipsa”, niciodată „inapt”; valabil iese „apt”
  -- `valabil_pana` se golește odată cu rezultatul: un `inapt` cu sfârșit anterior
  -- datei examinării încalcă `employee_work_restrictions_interval_ck`.
  update public.occupational_health_exams set rezultat = 'inapt', valabil_pana = null where id = v_exam;
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  v_text := app.stare_aviz_sofer(v_org, v_e_ang, v_zi);
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  v_text2 := app.stare_aviz_sofer(v_org, v_e_ang, v_zi);
  reset role;
  update public.occupational_health_exams set rezultat = 'apt', valabil_pana = v_zi + 200 where id = v_exam;
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  v_cm := app.stare_aviz_sofer(v_org, v_e_ang, v_zi);
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  v_hr_lipsa := app.stare_aviz_sofer(v_org, v_e_ang, v_zi);
  reset role;
  if v_text = 'lipsa' and v_text2 = 'lipsa' and v_cm = 'apt' and v_hr_lipsa = 'apt' then
    raise notice '  ✓ (34) manager (seed) și hr: inapt -> lipsa (niciodată inapt), valabil -> apt';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (34) inapt: manager=%, hr=%; valabil: manager=%, hr=% (așteptat lipsa, lipsa, apt, apt)',
      coalesce(v_text, 'NULL'), coalesce(v_text2, 'NULL'), coalesce(v_cm, 'NULL'), coalesce(v_hr_lipsa, 'NULL');
  end if;

  -- (35) ramura parcului: vehicles:update = all (fără ssm:read) primește avizul exact
  update public.occupational_health_exams set valabil_pana = v_zi - 5 where id = v_exam;
  insert into public.role_permissions (organization_id, role, resource, action, scope) values
    (v_org, 'manager', 'ssm', 'read', 'none'),
    (v_org, 'manager', 'vehicles', 'update', 'all');
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  v_text := app.stare_aviz_sofer(v_org, v_e_ang, v_zi);
  select string_agg(c.aviz, ',') into v_text2 from public.verificari_soferi(v_org, array[v_e_ang], v_zi) c;
  reset role;
  delete from public.role_permissions
   where organization_id = v_org and role = 'manager' and resource = 'vehicles' and action = 'update';
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  v_cm := app.stare_aviz_sofer(v_org, v_e_ang, v_zi);
  reset role;
  delete from public.role_permissions
   where organization_id = v_org and role = 'manager' and resource = 'ssm' and action = 'read';
  if v_text = 'expirat' and v_text2 = 'expirat' and v_cm is null then
    raise notice '  ✓ (35) vehicles:update = all (parcul) primește avizul exact și fără ssm:read; retras, aviz null';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (35) parc: direct=%, prin fapte=%, după retragere=% (așteptat expirat, expirat, NULL)',
      coalesce(v_text, 'NULL'), coalesce(v_text2, 'NULL'), coalesce(v_cm, 'NULL');
  end if;

  -- ═══ A TREIA OCOLIRE, DIN ACEEAȘI CLASĂ: DELEGAȚIA ═══════════════════════════
  -- `delegatie` se calcula din `business_trips` cu drepturile bazei, pentru oricine
  -- vede șoferul. `hr` (fără niciun `per_diem:*`) află astfel dacă un om are o
  -- deplasare într-o zi, iar `business_trips_select` îi dă zero rânduri. Acum iese
  -- exact doar pentru cine ar trece `business_trips_select` (membru al firmei și
  -- `app.poate_accesa_deplasare(…, 'read')`); ceilalți primesc `null` („nu se știe”,
  -- adică nici „are”, nici „n-are”). Ana (v_e_ang) are o deplasare aprobată care
  -- acoperă ziua; Cornel (v_e_coleg) n-are niciuna activă (a lui e `ciorna`).
  --
  -- (36) fiecare rol, cu rânduri numărate: «rol:deplasări-prin-RLS/delegația-Anei/
  -- delegația-lui-Cornel» («-» = nu primește rândul deloc).
  v_cm := '';
  for v_r in
    select * from (values ('hr', v_u_hr), ('manager', v_u_mgr), ('org_admin', v_u_admin),
                          ('angajat', v_u_ang), ('super_admin', v_u_sa)) t(rol, utilizator)
  loop
    perform set_config('request.jwt.claim.sub', v_r.utilizator::text, true);
    set local role authenticated;
    select count(*) into v_n from public.business_trips where employee_id = v_e_ang;
    select coalesce(c.delegatie::text, 'NULL') into v_text
      from public.verificari_soferi(v_org, array[v_e_ang], v_zi) c;
    select coalesce(c.delegatie::text, 'NULL') into v_text2
      from public.verificari_soferi(v_org, array[v_e_coleg], v_zi) c;
    reset role;
    v_cm := v_cm || format('%s:%s/%s/%s ', v_r.rol, v_n, coalesce(v_text, '-'), coalesce(v_text2, '-'));
  end loop;
  if v_cm = 'hr:0/NULL/NULL manager:1/true/- org_admin:1/true/false angajat:1/true/- super_admin:0/NULL/NULL ' then
    raise notice '  ✓ (36) delegația iese exactă doar pentru cine vede deplasările prin RLS (manager, org_admin, angajat); hr și super_admin primesc null: %', btrim(v_cm);
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (36) delegația pe roluri (rol:deplasări prin RLS/Ana/Cornel): % (așteptat: hr:0/NULL/NULL manager:1/true/- org_admin:1/true/false angajat:1/true/- super_admin:0/NULL/NULL)', btrim(v_cm);
  end if;

  -- (37) managerului i se retrage `per_diem:read`: vede în continuare rândul (foile
  -- echipei), dar nu și deplasarea prin RLS, deci delegația iese null; cu seed-ul
  -- (`per_diem:read = team`) o primea exactă.
  insert into public.role_permissions (organization_id, role, resource, action, scope)
  values (v_org, 'manager', 'per_diem', 'read', 'none');
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  select count(*) into v_n from public.business_trips where employee_id = v_e_ang;
  select count(*), string_agg(coalesce(c.delegatie::text, 'NULL') || '/' || coalesce(c.concediu, 'NULL'), ',')
    into v_m, v_text
    from public.verificari_soferi(v_org, array[v_e_ang], v_zi) c;
  reset role;
  delete from public.role_permissions
   where organization_id = v_org and role = 'manager' and resource = 'per_diem' and action = 'read';
  if v_n = 0 and v_m = 1 and v_text = 'NULL/absent' then
    raise notice '  ✓ (37) managerul fără per_diem:read: rândul rămâne (absent), delegația iese null, iar RLS îi dă 0 deplasări';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (37) manager fără per_diem:read: deplasări prin RLS=%, rânduri=%, delegatie/concediu=% (așteptat 0, 1, NULL/absent)',
      v_n, v_m, coalesce(v_text, 'NULL');
  end if;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA FLOTA ȘOFERI: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE cele 37 de verificări au trecut.';
  raise notice '';
end;
$$;

rollback;
