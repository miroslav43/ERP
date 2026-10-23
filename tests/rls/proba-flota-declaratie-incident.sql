-- tests/rls/proba-flota-declaratie-incident.sql
--
-- FLOTA, 0206 §F: ȘOFERUL ÎȘI DECLARĂ DAUNA DIN PORTAL („Mașina mea”).
--
-- Decizia din 21 oct 2026: `employee` primește `vehicle_incidents:create = own`.
-- Inserează DOAR pe vehiculul alocat lui în ziua incidentului sau pe pool, își
-- vede DOAR declarațiile lui, nu vede amenzile și nu atinge costurile.
-- Responsabilul de flotă (sau administratorul) primește notificare.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- (1)  șoferul declară pe mașina LUI; declarantul și șoferul îi pune baza, chiar
--      dacă trimite alt șofer sau alt declarant                         [POZITIVĂ];
-- (2)  șoferul declară pe o mașină din pool                             [POZITIVĂ];
-- (3)  vehiculul colegului: P0001;
-- (4)  mașina lui, dar într-o zi în care nu-i era alocată: P0001;
-- (5)  vehiculul altei firme: P0001 în firma lui, 42501 în firma străină;
-- (6)  declarantul nu scrie costuri, asigurător, dosar sau cercetare: 42501;
-- (7)  șoferul își vede DOAR declarațiile lui, prin `incidente_declarate_de_mine`:
--      nu pe ale colegului, nu pe cel înregistrat de administrator pe mașina lui;
-- (7b) (X1) RÂNDUL incidentului nu i se arată deloc (costuri, asigurător, dosar,
--      observații, cercetarea SSM): zero rânduri din tabelă, iar funcția nu
--      întoarce niciuna dintre aceste coloane;
-- (8)  amenzile îi rămân închise: zero rânduri, INSERT 42501;
-- (9)  declarația nu se modifică de șofer (update = none): zero rânduri;
-- (10) notificarea: responsabilul care citește incidentele o primește, cu
--      legătura spre fișă; șoferul, colegul și managerul responsabil FĂRĂ cheie
--      nu; fără niciun responsabil cu cheie, merge la administratori  [POZITIVĂ];
-- (11) incidentul înregistrat de administrator nu notifică; administratorul nu
--      declară în numele altuia (P0001); declarantul nu se rescrie la UPDATE;
-- (12) hr și manager nu declară (42501) și nu văd nimic; org_admin-ul altei
--      firme nu vede declarația;
-- (13) suprascrierea PE MEMBRU `vehicle_incidents:create = none` îi ia șoferului
--      și declararea, și vederea declarațiilor;
-- (14) administratorul (read = all) vede declarația șoferului          [POZITIVĂ].
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh --pastreaza
--   psql … -f tests/rls/proba-flota-declaratie-incident.sql
\set ON_ERROR_STOP on
\pset pager off

begin;

create function pg_temp.la(zi date, ora text) returns timestamptz
language sql immutable as $$ select (zi::timestamp + ora::interval) at time zone 'Europe/Bucharest' $$;

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

-- INSERT sub identitatea lui `p_user`, cu id-ul dat de probă (ca aplicația:
-- fără ramura `own` a citirii, șoferul nu poate cere `RETURNING`); null la
-- eroare (mesajul în NOTICE).
create function pg_temp.declara(p_user uuid, p_sql text) returns uuid
language plpgsql as $f$
declare
  v_id uuid := gen_random_uuid();
begin
  perform set_config('proba.id_declaratie', v_id::text, true);
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  set local role authenticated;
  execute p_sql;
  reset role;
  perform set_config('proba.id_declaratie', '', true);
  return v_id;
exception when others then
  reset role;
  raise notice '    declarația a căzut: % (%)', sqlerrm, sqlstate;
  return null;
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

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_zi       date := app.azi_local();
  v_org      uuid := gen_random_uuid();
  v_org_alta uuid := gen_random_uuid();
  v_u_adm    uuid := gen_random_uuid();
  v_u_adm2   uuid := gen_random_uuid();
  v_u_hr     uuid := gen_random_uuid();
  v_u_mgr    uuid := gen_random_uuid();
  v_u_ana    uuid := gen_random_uuid();  -- șoferul
  v_u_col    uuid := gen_random_uuid();  -- colegul, cu mașina lui
  v_u_alta   uuid := gen_random_uuid();
  v_e_adm    uuid := gen_random_uuid();
  v_e_adm2   uuid := gen_random_uuid();
  v_e_hr     uuid := gen_random_uuid();
  v_e_mgr    uuid := gen_random_uuid();
  v_e_ana    uuid := gen_random_uuid();
  v_e_col    uuid := gen_random_uuid();
  v_v_ana    uuid := gen_random_uuid();
  v_v_col    uuid := gen_random_uuid();
  v_v_pool   uuid := gen_random_uuid();
  v_v_alta   uuid := gen_random_uuid();
  v_i1       uuid;
  v_i2       uuid;
  v_i_col    uuid;
  v_i_adm    uuid;
  v_text     text;
  v_text2    text;
  v_n        bigint;
  v_m        bigint;
  v_k        bigint;
  v_decl     uuid;
  v_sofer    uuid;
  v_stadiu   text;
  v_link     text;
  v_esecuri  int := 0;
  -- Un INSERT de declarație, pe vehiculul și momentul date.
  c_insert   constant text :=
    $q$insert into public.vehicle_incidents (id, organization_id, vehicle_id, tip, produs_la, locul, descriere%s)
       values (coalesce(nullif(current_setting('proba.id_declaratie', true), ''), gen_random_uuid()::text)::uuid,
               %L, %L, 'coliziune', %L, 'Parcarea firmei', %L%s)$q$;
begin
  raise notice '';
  raise notice '  PROBA „FLOTA — DECLARAȚIA ȘOFERULUI” (0206 §F)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-decl-' || v_sufix, 'Proba Declarații SRL',
     'RO' || (84000000 + (random() * 900000)::int)::text),
    (v_org_alta, 'proba-decl-alta-' || v_sufix, 'Altă Firmă SRL',
     'RO' || (83000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select o, f.feature_key, true, now() from public.features f, unnest(array[v_org, v_org_alta]) o;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_adm,  'dc-adm-'  || v_sufix || '@proba.test', now()),
    (v_u_adm2, 'dc-adm2-' || v_sufix || '@proba.test', now()),
    (v_u_hr,   'dc-hr-'   || v_sufix || '@proba.test', now()),
    (v_u_mgr,  'dc-mgr-'  || v_sufix || '@proba.test', now()),
    (v_u_ana,  'dc-ana-'  || v_sufix || '@proba.test', now()),
    (v_u_col,  'dc-col-'  || v_sufix || '@proba.test', now()),
    (v_u_alta, 'dc-alt-'  || v_sufix || '@proba.test', now());
  -- Fișele ÎNAINTEA membrilor (0083 face singur o fișă oricărui org_admin fără una).
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_adm,  v_org, 'DC-A',  'Adrian', 'Admin',   v_zi - 900, 'activ', v_u_adm,  null),
    (v_e_adm2, v_org, 'DC-A2', 'Alina',  'Admin',   v_zi - 900, 'activ', v_u_adm2, null),
    (v_e_hr,   v_org, 'DC-H',  'Hora',   'Resurse', v_zi - 800, 'activ', v_u_hr,   null),
    (v_e_mgr,  v_org, 'DC-M',  'Mihai',  'Manager', v_zi - 800, 'activ', v_u_mgr,  null);
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_ana,  v_org, 'DC-S',  'Ana',    'Șofer',   v_zi - 400, 'activ', v_u_ana,  v_e_mgr),
    (v_e_col,  v_org, 'DC-C',  'Cornel', 'Coleg',   v_zi - 400, 'activ', v_u_col,  v_e_mgr);
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_adm,  'org_admin'),
    (v_org, v_u_adm2, 'org_admin'),
    (v_org, v_u_hr,   'hr'),
    (v_org, v_u_mgr,  'manager'),
    (v_org, v_u_ana,  'employee'),
    (v_org, v_u_col,  'employee'),
    (v_org_alta, v_u_alta, 'org_admin');

  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent, pool,
                               created_by, updated_by) values
    (v_v_ana,  v_org, 'B' || (100 + (random() * 800)::int)::text || 'ANA', 'Dacia', 'Logan', 10000, false, v_u_adm, v_u_adm),
    (v_v_col,  v_org, 'B' || (100 + (random() * 800)::int)::text || 'COL', 'Dacia', 'Duster', 20000, false, v_u_adm, v_u_adm),
    (v_v_pool, v_org, 'B' || (100 + (random() * 800)::int)::text || 'POO', 'Skoda', 'Octavia', 30000, true, v_u_adm, v_u_adm),
    (v_v_alta, v_org_alta, 'B' || (100 + (random() * 800)::int)::text || 'ALT', 'Ford', 'Focus', 5000, false, v_u_alta, v_u_alta);
  -- Ana are mașina de acum 5 zile; colegul, pe a lui de acum 20.
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, km_predare,
                                          created_by, updated_by) values
    (v_org, v_v_ana, v_e_ana, pg_temp.la(v_zi - 5, '08:00'), 10000, v_u_adm, v_u_adm),
    (v_org, v_v_col, v_e_col, pg_temp.la(v_zi - 20, '08:00'), 20000, v_u_adm, v_u_adm);
  -- Responsabil de flotă: managerul (vede parcul echipei, dar N-ARE cheia
  -- incidentelor) și a doua administratoare. Notificarea merge doar la ea.
  insert into public.fleet_settings (organization_id, responsabili, created_by, updated_by)
  values (v_org, array[v_e_mgr, v_e_adm2], v_u_adm, v_u_adm);

  -- (1) pe mașina lui, cu alt șofer și alt declarant trimiși din client
  v_i1 := pg_temp.declara(v_u_ana, format(c_insert, ', sofer_id, declarat_de_employee_id',
    v_org, v_v_ana, pg_temp.la(v_zi - 1, '17:30'), 'Zgârietură pe portiera din dreapta.',
    format(', %L, %L', v_e_col, v_e_col)));
  select declarat_de_employee_id, sofer_id, stadiu::text into v_decl, v_sofer, v_stadiu
    from public.vehicle_incidents where id = v_i1;
  v_esecuri := v_esecuri + pg_temp.verifica('1',
    v_i1 is not null and v_decl = v_e_ana and v_sofer = v_e_ana and v_stadiu = 'raportat',
    'șoferul declară pe mașina lui; declarantul și șoferul sunt el (baza îi pune), stadiul „raportat”',
    format('id %s, declarant %s, șofer %s, %s', v_i1, v_decl, v_sofer, v_stadiu));

  -- (2) pool
  v_i2 := pg_temp.declara(v_u_ana, format(c_insert, '', v_org, v_v_pool, pg_temp.la(v_zi - 10, '09:00'),
    'Oglinda stângă spartă în parcare.', ''));
  v_esecuri := v_esecuri + pg_temp.verifica('2', v_i2 is not null,
    'șoferul declară pe o mașină din pool, și într-o zi fără alocare proprie', coalesce(v_i2::text, 'refuzat'));

  -- (3) vehiculul colegului
  v_text := pg_temp.ruleaza(v_u_ana, format(c_insert, '', v_org, v_v_col, pg_temp.la(v_zi - 1, '10:00'),
    'Încercare pe mașina colegului.', ''));
  v_esecuri := v_esecuri + pg_temp.verifica('3', v_text like 'P0001:Vehiculul ales nu vă era alocat%',
    'vehiculul colegului: P0001', v_text);

  -- (4) mașina lui, într-o zi dinaintea alocării
  v_text := pg_temp.ruleaza(v_u_ana, format(c_insert, '', v_org, v_v_ana, pg_temp.la(v_zi - 10, '10:00'),
    'Încercare înainte de predare.', ''));
  v_esecuri := v_esecuri + pg_temp.verifica('4', v_text like 'P0001:Vehiculul ales nu vă era alocat%',
    'mașina lui, dar într-o zi în care nu-i era alocată: P0001', v_text);

  -- (5) vehiculul altei firme
  v_text := pg_temp.ruleaza(v_u_ana, format(c_insert, '', v_org, v_v_alta, pg_temp.la(v_zi - 1, '10:00'),
    'Încercare pe mașina altei firme.', ''));
  v_text2 := pg_temp.ruleaza(v_u_ana, format(c_insert, '', v_org_alta, v_v_alta, pg_temp.la(v_zi - 1, '10:00'),
    'Încercare în firma străină.', ''));
  v_esecuri := v_esecuri + pg_temp.verifica('5',
    v_text like 'P0001:Vehiculul ales nu aparține%' and v_text2 like '42501:%',
    'vehiculul altei firme: P0001 în firma lui, 42501 în firma străină', v_text || ' / ' || v_text2);

  -- (6) costuri, asigurător, dosar
  v_text := pg_temp.ruleaza(v_u_ana, format(c_insert, ', cost_estimat', v_org, v_v_ana,
    pg_temp.la(v_zi - 1, '11:00'), 'Încercare cu cost.', ', 1500'));
  v_text2 := pg_temp.ruleaza(v_u_ana, format(c_insert, ', asigurator, dosar_numar', v_org, v_v_ana,
    pg_temp.la(v_zi - 1, '11:00'), 'Încercare cu asigurător.', ', ''Asig SA'', ''D-1'''));
  v_esecuri := v_esecuri + pg_temp.verifica('6', v_text like '42501:%' and v_text2 like '42501:%',
    'declarantul nu scrie costul estimat, asigurătorul sau dosarul (42501)', v_text || ' / ' || v_text2);

  -- Colegul declară pe mașina LUI; administratorul înregistrează unul pe a Anei.
  v_i_col := pg_temp.declara(v_u_col, format(c_insert, '', v_org, v_v_col, pg_temp.la(v_zi - 2, '08:30'),
    'Parbriz fisurat de o pietricică.', ''));
  v_i_adm := pg_temp.declara(v_u_adm, format(c_insert, ', sofer_id', v_org, v_v_ana,
    pg_temp.la(v_zi - 3, '12:00'), 'Lovitură constatată la predare.', format(', %L', v_e_ana)));

  -- (7) ce vede șoferul
  v_n := pg_temp.numara(v_u_ana, format('select count(*) from public.incidente_declarate_de_mine(%L, 100, null, null)', v_org));
  v_m := pg_temp.numara(v_u_ana, format(
    'select count(*) from public.incidente_declarate_de_mine(%L, 100, null, null) where id in (%L, %L)', v_org, v_i_col, v_i_adm));
  v_k := pg_temp.numara(v_u_ana, format(
    'select max(total) from public.incidente_declarate_de_mine(%L, 1, null, null)', v_org));
  v_esecuri := v_esecuri + pg_temp.verifica('7', v_i_col is not null and v_i_adm is not null and v_n = 2 and v_m = 0 and v_k = 2,
    'șoferul își vede doar cele 2 declarații; nu pe a colegului, nu pe cea a administratorului pe mașina lui; totalul nu ține cont de limită',
    format('vede %s, străine %s, total %s', v_n, v_m, v_k));

  -- (7b) rândul complet
  v_n := pg_temp.numara(v_u_ana, format('select count(*) from public.vehicle_incidents where organization_id = %L', v_org));
  select count(*) into v_m
    from unnest(array['cost_estimat', 'cost_final', 'despagubire', 'asigurator', 'dosar_numar',
                      'observatii', 'work_accident_id', 'sofer_id', 'declarat_de_employee_id']) c
   where position(c in pg_get_function_result(
           'public.incidente_declarate_de_mine(uuid, integer, timestamptz, uuid)'::regprocedure)) > 0;
  v_esecuri := v_esecuri + pg_temp.verifica('7b', v_n = 0 and v_m = 0,
    'rândul incidentului nu i se arată șoferului (zero rânduri); funcția nu întoarce costuri, asigurător, dosar, observații sau cercetarea',
    format('rânduri %s, coloane interne %s', v_n, v_m));

  -- (8) amenzile
  v_n := pg_temp.numara(v_u_ana, format('select count(*) from public.vehicle_fines where organization_id = %L', v_org));
  v_text := pg_temp.ruleaza(v_u_ana, format(
    $q$insert into public.vehicle_fines (organization_id, vehicle_id, numar_pv, constatata_la, fapta)
       values (%L, %L, 'PV-SOFER', %L, 'Încercare')$q$, v_org, v_v_ana, pg_temp.la(v_zi - 1, '10:00')));
  v_esecuri := v_esecuri + pg_temp.verifica('8', v_n = 0 and v_text like '42501:%',
    'amenzile îi rămân închise șoferului: zero rânduri, INSERT 42501', format('%s / %s', v_n, v_text));

  -- (9) șoferul nu-și modifică declarația
  v_text := pg_temp.ruleaza(v_u_ana, format(
    $q$update public.vehicle_incidents set descriere = 'Rescrisă de șofer.' where id = %L$q$, v_i1));
  v_esecuri := v_esecuri + pg_temp.verifica('9', v_text = 'ok:0',
    'șoferul nu-și modifică declarația (update = none): zero rânduri', v_text);

  -- (10) notificarea
  select count(*), max(n.link) into v_n, v_link from public.notifications n
   where n.entity_type = 'vehicle_incident' and n.entity_id = v_i1 and n.user_id = v_u_adm2;
  select count(*) into v_m from public.notifications n
   where n.entity_type = 'vehicle_incident' and n.entity_id = v_i1
     and n.user_id in (v_u_ana, v_u_col, v_u_mgr, v_u_adm, v_u_hr);
  v_esecuri := v_esecuri + pg_temp.verifica('10', v_n = 1 and v_m = 0 and v_link = '/flota/incidente/' || v_i1::text,
    'responsabila cu cheie primește notificarea, cu legătura spre fișă; șoferul, colegul, managerul responsabil fără cheie și celălalt administrator nu',
    format('responsabila %s (%s), alții %s', v_n, v_link, v_m));
  -- Fără niciun responsabil care citește incidentele: administratorii.
  update public.fleet_settings set responsabili = array[v_e_mgr] where organization_id = v_org;
  v_i2 := pg_temp.declara(v_u_ana, format(c_insert, '', v_org, v_v_ana, pg_temp.la(v_zi, '07:15'),
    'Bară spate lovită la manevră.', ''));
  select count(*) into v_n from public.notifications n
   where n.entity_type = 'vehicle_incident' and n.entity_id = v_i2 and n.user_id in (v_u_adm, v_u_adm2);
  select count(*) into v_m from public.notifications n
   where n.entity_type = 'vehicle_incident' and n.entity_id = v_i2 and n.user_id not in (v_u_adm, v_u_adm2);
  v_esecuri := v_esecuri + pg_temp.verifica('10b', v_i2 is not null and v_n = 2 and v_m = 0,
    'fără responsabil cu cheie, declarația ajunge la ambii administratori și la nimeni altcineva',
    format('administratori %s, alții %s', v_n, v_m));

  -- (11) administratorul
  select count(*) into v_n from public.notifications n
   where n.entity_type = 'vehicle_incident' and n.entity_id = v_i_adm;
  v_text := pg_temp.ruleaza(v_u_adm, format(c_insert, ', declarat_de_employee_id', v_org, v_v_ana,
    pg_temp.la(v_zi - 1, '13:00'), 'Declarat în numele altuia.', format(', %L', v_e_ana)));
  v_text2 := pg_temp.ruleaza(v_u_adm, format(
    $q$update public.vehicle_incidents set declarat_de_employee_id = null, stadiu = 'constatat' where id = %L$q$, v_i1));
  select declarat_de_employee_id into v_decl from public.vehicle_incidents where id = v_i1;
  v_esecuri := v_esecuri + pg_temp.verifica('11',
    v_n = 0 and v_text like 'P0001:Declarantul unui incident%' and v_text2 = 'ok:1' and v_decl = v_e_ana,
    'incidentul administratorului nu notifică; el nu declară în numele altuia (P0001); declarantul nu se rescrie la UPDATE',
    format('notificări %s, %s, %s, declarant %s', v_n, v_text, v_text2, v_decl));

  -- (12) hr, manager, firma străină
  v_text := pg_temp.ruleaza(v_u_hr, format(c_insert, '', v_org, v_v_pool, pg_temp.la(v_zi - 1, '10:00'), 'Încercare hr.', ''));
  v_text2 := pg_temp.ruleaza(v_u_mgr, format(c_insert, '', v_org, v_v_pool, pg_temp.la(v_zi - 1, '10:00'), 'Încercare manager.', ''));
  v_n := pg_temp.numara(v_u_hr, format('select count(*) from public.vehicle_incidents where organization_id = %L', v_org))
       + pg_temp.numara(v_u_mgr, format('select count(*) from public.vehicle_incidents where organization_id = %L', v_org))
       + pg_temp.numara(v_u_alta, format('select count(*) from public.vehicle_incidents where organization_id = %L', v_org));
  v_esecuri := v_esecuri + pg_temp.verifica('12', v_text like '42501:%' and v_text2 like '42501:%' and v_n = 0,
    'hr și managerul nu declară (42501) și nu văd nimic; org_admin-ul altei firme nu vede declarațiile',
    format('%s / %s / vizibile %s', v_text, v_text2, v_n));

  -- (13) suprascrierea pe membru îi ia șoferului cheia
  insert into public.role_permissions (organization_id, member_id, role, resource, action, scope)
  select v_org, m.id, 'employee', 'vehicle_incidents', 'create', 'none'
    from public.organization_members m where m.organization_id = v_org and m.user_id = v_u_ana;
  v_text := pg_temp.ruleaza(v_u_ana, format(c_insert, '', v_org, v_v_ana, pg_temp.la(v_zi, '08:00'), 'După retragerea cheii.', ''));
  v_n := pg_temp.numara(v_u_ana, format('select count(*) from public.incidente_declarate_de_mine(%L, 100, null, null)', v_org));
  v_esecuri := v_esecuri + pg_temp.verifica('13', v_text like '42501:%' and v_n = 0,
    'suprascrierea pe membru `create = none`: șoferul nu mai declară și nu-și mai vede declarațiile',
    format('%s / vizibile %s', v_text, v_n));

  -- (14) administratorul vede declarațiile
  v_k := pg_temp.numara(v_u_adm, format(
    'select count(*) from public.vehicle_incidents where declarat_de_employee_id is not null and organization_id = %L', v_org));
  v_esecuri := v_esecuri + pg_temp.verifica('14', v_k = 4,
    'administratorul (read = all) vede toate cele 4 declarații ale șoferilor', format('%s', v_k));

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA DECLARAȚIA ȘOFERULUI: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE verificările au trecut.';
  raise notice '';
end;
$$;

rollback;
