-- tests/rls/proba-flota-carduri.sql
--
-- FLOTA, DUPĂ 0214 (F12b): CARDURILE DE COMBUSTIBIL, LOTURILE DE IMPORT ȘI
-- TRANZACȚIILE DIN EXTRASE, PE TOATE CELE CINCI ROLURI.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- Pozitive
-- (1)  org_admin creează cardurile (pe vehicul și pe șofer); fiecare ajunge în
--      `expirables` cu `entity_type = 'fuel_card'`, iar org_admin le vede acolo;
-- (2)  org_admin inserează un lot și 3 tranzacții, apoi leagă una de alimentare
--      (1 rând atins); foaia și vehiculul le pune triggerul, nu clientul;
-- (3)  anularea cardului scoate scadența din `expirables` (deleted_at);
-- (4)  employee vede cardul pe numele lui și cardul vehiculului alocat lui;
-- (5)  manager (`vehicles:read = team`) vede cardurile subordonatului;
-- (6a) profilul de import: INSERT, apoi UPDATE (1 + 1 rânduri);
-- (6b) ștergerea logică a cardului cu RETURNING întoarce rândul;
-- (6c) anularea importului (tranzacțiile, apoi lotul) eliberează cheia de dedup;
-- (6d) vehiculul cardului trecut pe `casat` scoate scadența cardului;
-- (6e) super_admin (platform_admins, NU membru) vede cardurile, nu scrie (42501);
-- (6f) rezumatul zilnic trimite cardul de rezervă care expiră spre
--      `/flota/carduri?card=<id>`, administratorului;
-- Negative
-- (7)  employee nu vede cardul colegului (0 rânduri, fără eroare);
-- (8)  employee inserează un card: 42501;
-- (9)  hr vede 0 carduri, 0 tranzacții, 0 scadențe de card;
-- (9c) hr care conduce (0215, decizia 3) vede mașina alocată lui, nu și cardul ei;
-- (10) manager modifică un card: 0 rânduri (USING), fără eroare;
-- (11) card pe vehiculul altei firme: P0001;
-- (12) UPDATE pe `valoare_bruta` unei tranzacții: P0001;
-- (13) a doua tranzacție cu aceeași `cheie_dedup`: 23505;
-- (14) a doua tranzacție legată de aceeași alimentare: 23505;
-- (15) org_admin-ul firmei B: 0 carduri, 0 tranzacții, 0 loturi, 0 profiluri
--      ale firmei A, iar UPDATE-ul lui atinge 0 rânduri;
-- (16) `potrivita` fără alimentare: 23514 (`fctx_stare_ck`);
-- (17) `ignorata` fără notă: P0001;
-- (18) Storage: `can_path('{org}/vehicles/{lot}/lot-card.json','read')` e
--      adevărat pentru org_admin, fals pentru manager și employee;
-- (19) manager inserează o tranzacție: 42501;
-- (20) hr inserează un profil de import: 42501;
-- (21) numărul unui card nu se schimbă (P0001); cardul altui emitent decât
--      extrasul: P0001; card nou pe vehiculul casat: P0001;
-- (22) auditul: scrierile pe carduri și tranzacții lasă urmă în `audit_logs`.
--
-- [DECIZIA-3b] (employee vede tranzacția de pe foaia lui) NU e aici: implicita
-- I-b3 ține tranzacțiile doar la `vehicles:read = all`, iar (9)/(19) o fixează.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh --pastreaza
--   psql … -f tests/rls/proba-flota-carduri.sql
\set ON_ERROR_STOP on
\pset pager off

begin;

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

-- Un număr, sub identitatea lui `p_user`; -1 la eroare.
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

-- INSERT-ul unei tranzacții, ca text, pentru `pg_temp.ruleaza`.
create function pg_temp.tx(
  p_org uuid, p_import uuid, p_cheie text, p_stare text,
  p_card uuid default null, p_vehicul uuid default null, p_foaie uuid default null,
  p_alimentare uuid default null, p_categorie text default 'combustibil', p_nota text default null,
  p_id uuid default null, p_emitent text default 'omv_petrom'
) returns text
language sql immutable as $$
  select format(
    'insert into public.fuel_card_transactions (id, organization_id, import_id, emitent, cheie_dedup, '
    || 'rand_fisier, card_id, card_ultimele_cifre, efectuat_la, produs, categorie, tip_combustibil, '
    || 'cantitate, valoare_bruta, moneda, vehicle_id, trip_sheet_id, fuel_entry_id, stare_potrivire, nota) '
    || 'values (%L, %L, %L, %L, %L, 2, %L, ''1234'', now() - interval ''3 days'', ''Motorină'', %L, '
    || '''motorina'', 40.5, 300, ''RON'', %L, %L, %L, %L, %L)',
    coalesce(p_id, gen_random_uuid()), p_org, p_import, p_emitent, p_cheie, p_card, p_categorie,
    p_vehicul, p_foaie, p_alimentare, p_stare, p_nota);
$$;

do $$
declare
  v_sufix      text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_zi         date := app.azi_local();
  v_org        uuid := gen_random_uuid();
  v_org_alta   uuid := gen_random_uuid();
  v_u_admin    uuid := gen_random_uuid();
  v_u_hr       uuid := gen_random_uuid();
  v_u_mgr      uuid := gen_random_uuid();
  v_u_ang      uuid := gen_random_uuid();
  v_u_coleg    uuid := gen_random_uuid();
  v_u_alta     uuid := gen_random_uuid();
  v_u_sa       uuid := gen_random_uuid();
  v_e_mgr      uuid := gen_random_uuid();
  v_e_ang      uuid := gen_random_uuid();
  v_e_coleg    uuid := gen_random_uuid();
  v_e_hr       uuid := gen_random_uuid();
  v_veh_hr     uuid := gen_random_uuid();
  v_c_veh_hr   uuid := gen_random_uuid();
  v_veh_ang    uuid := gen_random_uuid();
  v_veh_coleg  uuid := gen_random_uuid();
  v_veh_alta   uuid := gen_random_uuid();
  v_c_veh_ang  uuid := gen_random_uuid();
  v_c_sof_ang  uuid := gen_random_uuid();
  v_c_veh_col  uuid := gen_random_uuid();
  v_c_sof_col  uuid := gen_random_uuid();
  v_c_rezerva  uuid := gen_random_uuid();
  v_lot        uuid := gen_random_uuid();
  v_lot2       uuid := gen_random_uuid();
  v_tx1        uuid := gen_random_uuid();
  v_tx2        uuid := gen_random_uuid();
  v_tx3        uuid := gen_random_uuid();
  v_profil     uuid := gen_random_uuid();
  v_foaie      uuid;
  v_alim       uuid;
  v_r          text;
  v_n          bigint;
  v_m          bigint;
  v_t          text;
  v_id         uuid;
  v_esecuri    int := 0;
begin
  raise notice '';
  raise notice '  PROBA „FLOTA — CARDURI DE COMBUSTIBIL" (0214)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-carduri-' || v_sufix, 'Proba Carduri SRL',
     'RO' || (86000000 + (random() * 900000)::int)::text),
    (v_org_alta, 'proba-carduri-alta-' || v_sufix, 'Altă Firmă SRL',
     'RO' || (87000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select o, f.feature_key, true, now() from public.features f, unnest(array[v_org, v_org_alta]) o;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_admin, 'fc-adm-'   || v_sufix || '@proba.test', now()),
    (v_u_hr,    'fc-hr-'    || v_sufix || '@proba.test', now()),
    (v_u_mgr,   'fc-mgr-'   || v_sufix || '@proba.test', now()),
    (v_u_ang,   'fc-ang-'   || v_sufix || '@proba.test', now()),
    (v_u_coleg, 'fc-col-'   || v_sufix || '@proba.test', now()),
    (v_u_alta,  'fc-alta-'  || v_sufix || '@proba.test', now()),
    (v_u_sa,    'fc-sa-'    || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_admin, 'org_admin'),
    (v_org, v_u_hr,    'hr'),
    (v_org, v_u_mgr,   'manager'),
    (v_org, v_u_ang,   'employee'),
    (v_org, v_u_coleg, 'employee'),
    (v_org_alta, v_u_alta, 'org_admin');
  insert into public.platform_admins (user_id) values (v_u_sa);

  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_mgr, v_org, 'FC-M', 'Mihai', 'Manager', v_zi - 500, 'activ', v_u_mgr, null);
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_ang,   v_org, 'FC-A', 'Ana',    'Șofer', v_zi - 400, 'activ', v_u_ang,   v_e_mgr),
    (v_e_coleg, v_org, 'FC-C', 'Cornel', 'Coleg', v_zi - 400, 'activ', v_u_coleg, null);

  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent,
                               tip_combustibil, created_by, updated_by) values
    (v_veh_ang, v_org, 'B' || (100 + (random() * 800)::int)::text || 'FCA', 'Dacia', 'Logan', 10000,
     'motorina', v_u_admin, v_u_admin),
    (v_veh_coleg, v_org, 'B' || (100 + (random() * 800)::int)::text || 'FCC', 'Dacia', 'Duster', 20000,
     'motorina', v_u_admin, v_u_admin),
    (v_veh_alta, v_org_alta, 'B' || (100 + (random() * 800)::int)::text || 'FCX', 'Dacia', 'Spring', 5000,
     'electric', v_u_alta, v_u_alta);
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, km_predare,
                                          created_by, updated_by) values
    (v_org, v_veh_ang, v_e_ang, pg_temp.la(v_zi - 20, '08:00'), 10000, v_u_admin, v_u_admin),
    (v_org, v_veh_coleg, v_e_coleg, pg_temp.la(v_zi - 20, '08:00'), 20000, v_u_admin, v_u_admin);

  -- ── (1) org_admin creează cardurile ────────────────────────────────────
  v_r := pg_temp.ruleaza(v_u_admin, format(
    'insert into public.fuel_cards (id, organization_id, emitent, ultimele_cifre, vehicle_id, employee_id, '
    || 'valabil_pana, created_by, updated_by) values '
    || '(%L, %L, ''omv_petrom'', ''1234'', %L, null, %L, %L, %L), '
    || '(%L, %L, ''omv_petrom'', ''5678'', null, %L, %L, %L, %L), '
    || '(%L, %L, ''mol'', ''2222'', %L, null, %L, %L, %L), '
    || '(%L, %L, ''mol'', ''3333'', null, %L, %L, %L, %L), '
    || '(%L, %L, ''shell'', ''9999'', null, null, %L, %L, %L)',
    v_c_veh_ang, v_org, v_veh_ang, v_zi + 400, v_u_admin, v_u_admin,
    v_c_sof_ang, v_org, v_e_ang, v_zi + 400, v_u_admin, v_u_admin,
    v_c_veh_col, v_org, v_veh_coleg, v_zi + 400, v_u_admin, v_u_admin,
    v_c_sof_col, v_org, v_e_coleg, v_zi + 400, v_u_admin, v_u_admin,
    v_c_rezerva, v_org, v_zi + 10, v_u_admin, v_u_admin));
  select count(*) into v_n from public.expirables
   where organization_id = v_org and entity_type = 'fuel_card' and deleted_at is null;
  v_m := pg_temp.numara(v_u_admin, format(
    'select count(*) from public.expirables where organization_id = %L and entity_type = ''fuel_card''', v_org));
  v_esecuri := v_esecuri + pg_temp.verifica('1', v_r = 'ok:5' and v_n = 5 and v_m = 5,
    'org_admin creează 5 carduri (vehicul, șofer, rezervă); 5 scadențe `fuel_card`, vizibile lui',
    format('%s, expirables %s, văzute %s', v_r, v_n, v_m));

  select responsible_employee_id::text into v_t from public.expirables
   where entity_type = 'fuel_card' and entity_id = v_c_veh_ang and deleted_at is null;
  v_esecuri := v_esecuri + pg_temp.verifica('1b', v_t = v_e_ang::text,
    'responsabilul scadenței cardului de vehicul e șoferul alocat', coalesce(v_t, 'null'));

  -- ── (2) lot + 3 tranzacții, apoi legarea de alimentare ─────────────────
  insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                  created_by, updated_by)
  values (v_org, v_veh_ang, v_e_ang, pg_temp.la(v_zi - 3, '07:00'), 10000, v_u_ang, v_u_ang)
  returning id into v_foaie;
  insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la,
                                   created_by, updated_by)
  values (v_org, v_foaie, 40.5, 300, pg_temp.la(v_zi - 3, '07:30'), v_u_ang, v_u_ang)
  returning id into v_alim;

  v_r := pg_temp.ruleaza(v_u_admin, format(
    'insert into public.fuel_card_imports (id, organization_id, emitent, fisier_nume, fisier_sha256, '
    || 'perioada_de_la, perioada_pana_la, randuri_fisier, created_by, updated_by) values '
    || '(%L, %L, ''omv_petrom'', ''extras.csv'', %L, %L, %L, 3, %L, %L)',
    v_lot, v_org, repeat('a', 64), v_zi - 30, v_zi, v_u_admin, v_u_admin));
  v_t := pg_temp.ruleaza(v_u_admin, pg_temp.tx(v_org, v_lot, 'h:unu#1', 'fara_alimentare',
    v_c_veh_ang, v_veh_coleg, v_foaie, null, 'combustibil', null, v_tx1));
  v_r := v_r || ' ' || v_t
      || ' ' || pg_temp.ruleaza(v_u_admin, pg_temp.tx(v_org, v_lot, 'h:doi#1', 'necombustibil',
                  v_c_veh_ang, v_veh_ang, null, null, 'adblue', null, v_tx2))
      || ' ' || pg_temp.ruleaza(v_u_admin, pg_temp.tx(v_org, v_lot, 'h:trei#1', 'card_necunoscut',
                  null, null, null, null, 'combustibil', null, v_tx3));
  select vehicle_id::text into v_t from public.fuel_card_transactions where id = v_tx1;
  v_esecuri := v_esecuri + pg_temp.verifica('2', v_r = 'ok:1 ok:1 ok:1 ok:1' and v_t = v_veh_ang::text,
    'org_admin inserează lotul și 3 tranzacții; vehiculul vine din foaie, nu din client',
    format('%s, vehicul %s', v_r, v_t));

  v_r := pg_temp.ruleaza(v_u_admin, format(
    'update public.fuel_card_transactions set stare_potrivire = ''potrivita'', fuel_entry_id = %L, '
    || 'trip_sheet_id = null, updated_by = %L where id = %L', v_alim, v_u_admin, v_tx1));
  select trip_sheet_id::text into v_t from public.fuel_card_transactions where id = v_tx1;
  v_esecuri := v_esecuri + pg_temp.verifica('2b', v_r = 'ok:1' and v_t = v_foaie::text,
    'org_admin leagă tranzacția de alimentare: 1 rând, foaia o pune triggerul',
    format('%s, foaie %s', v_r, coalesce(v_t, 'null')));

  -- ── (4) employee: cardul pe numele lui și al mașinii lui ──────────────
  v_n := pg_temp.numara(v_u_ang, format(
    'select count(*) from public.fuel_cards where id in (%L, %L)', v_c_sof_ang, v_c_veh_ang));
  v_esecuri := v_esecuri + pg_temp.verifica('4', v_n = 2,
    'employee vede cardul pe numele lui și cardul vehiculului alocat lui', format('%s', v_n));

  -- ── (5) manager: cardurile subordonatului, nu ale colegului ───────────
  v_n := pg_temp.numara(v_u_mgr, format(
    'select count(*) from public.fuel_cards where organization_id = %L', v_org));
  v_m := pg_temp.numara(v_u_mgr, format(
    'select count(*) from public.fuel_cards where id in (%L, %L)', v_c_sof_ang, v_c_veh_ang));
  v_esecuri := v_esecuri + pg_temp.verifica('5', v_n = 2 and v_m = 2,
    'manager (team) vede exact cele 2 carduri ale subordonatului', format('total %s, ale lui %s', v_n, v_m));

  -- ── (6a) profilul de import ────────────────────────────────────────────
  v_r := pg_temp.ruleaza(v_u_admin, format(
    'insert into public.fuel_card_import_profiles (id, organization_id, emitent, mapare, created_by, updated_by) '
    || 'values (%L, %L, ''omv_petrom'', ''{"numar_card":"Card"}'', %L, %L)', v_profil, v_org, v_u_admin, v_u_admin));
  v_t := pg_temp.ruleaza(v_u_admin, format(
    'update public.fuel_card_import_profiles set mapare = ''{"numar_card":"Nr card"}'', separator_zecimal = '','', '
    || 'updated_by = %L where id = %L', v_u_admin, v_profil));
  v_esecuri := v_esecuri + pg_temp.verifica('6a', v_r = 'ok:1' and v_t = 'ok:1',
    'org_admin inserează și modifică profilul de import (1 + 1)', v_r || ' / ' || v_t);

  -- ── (7) employee nu vede cardurile colegului ──────────────────────────
  v_n := pg_temp.numara(v_u_ang, format(
    'select count(*) from public.fuel_cards where id in (%L, %L)', v_c_sof_col, v_c_veh_col));
  v_esecuri := v_esecuri + pg_temp.verifica('7', v_n = 0,
    'employee nu vede cardurile colegului (0 rânduri, fără eroare)', format('%s', v_n));

  -- ── (8) employee nu creează carduri ───────────────────────────────────
  v_r := pg_temp.ruleaza(v_u_ang, format(
    'insert into public.fuel_cards (organization_id, emitent, ultimele_cifre, employee_id, created_by, updated_by) '
    || 'values (%L, ''mol'', ''4444'', %L, %L, %L)', v_org, v_e_ang, v_u_ang, v_u_ang));
  v_esecuri := v_esecuri + pg_temp.verifica('8', v_r like '42501:%', 'employee inserează un card: 42501', v_r);

  -- ── (9) hr: nimic din carduri ──────────────────────────────────────────
  v_n := pg_temp.numara(v_u_hr, format('select count(*) from public.fuel_cards where organization_id = %L', v_org));
  v_m := pg_temp.numara(v_u_hr, format(
    'select count(*) from public.fuel_card_transactions where organization_id = %L', v_org));
  v_t := pg_temp.numara(v_u_hr, format(
    'select count(*) from public.expirables where organization_id = %L and entity_type = ''fuel_card''', v_org))::text;
  v_esecuri := v_esecuri + pg_temp.verifica('9', v_n = 0 and v_m = 0 and v_t = '0',
    'hr vede 0 carduri, 0 tranzacții, 0 scadențe de card', format('%s / %s / %s', v_n, v_m, v_t));

  -- ── (9c) hr care conduce o mașină a firmei (0215, decizia 3) ──────────
  -- `vehicule_select` îi arată mașina alocată LUI, fără `vehicles:read`. Cardul
  -- mașinii nu: ramura de vehicul din `carduri_select` judecă prin
  -- `app.poate_vedea_vehicul_dupa_id` (convenția 0199 pentru tabelele copil),
  -- nu printr-o subinterogare pe `vehicles` filtrată de RLS, care ar moșteni
  -- ramura deciziei 3. Montajul se derulează înapoi (P0099), ca restul probei
  -- să numere aceleași carduri.
  v_n := null; v_m := null;
  begin
    insert into public.employees (id, organization_id, marca, first_name, last_name,
                                  hired_on, status, user_id, manager_employee_id) values
      (v_e_hr, v_org, 'FC-H', 'Horia', 'Resurse', v_zi - 300, 'activ', v_u_hr, null);
    insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent,
                                 tip_combustibil, created_by, updated_by) values
      (v_veh_hr, v_org, 'B' || (100 + (random() * 800)::int)::text || 'FCH', 'Dacia', 'Jogger', 3000,
       'benzina', v_u_admin, v_u_admin);
    insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, km_predare,
                                            created_by, updated_by) values
      (v_org, v_veh_hr, v_e_hr, pg_temp.la(v_zi - 5, '08:00'), 3000, v_u_admin, v_u_admin);
    v_r := pg_temp.ruleaza(v_u_admin, format(
      'insert into public.fuel_cards (id, organization_id, emitent, ultimele_cifre, vehicle_id, employee_id, '
      || 'valabil_pana, created_by, updated_by) values (%L, %L, ''mol'', ''7777'', %L, null, %L, %L, %L)',
      v_c_veh_hr, v_org, v_veh_hr, v_zi + 400, v_u_admin, v_u_admin));
    v_n := pg_temp.numara(v_u_hr, format('select count(*) from public.vehicles where id = %L', v_veh_hr));
    v_m := pg_temp.numara(v_u_hr, format('select count(*) from public.fuel_cards where id = %L', v_c_veh_hr));
    raise exception using errcode = 'P0099', message = 'derulare (9c)';
  exception when sqlstate 'P0099' then
    null;
  end;
  v_esecuri := v_esecuri + pg_temp.verifica('9c', v_r = 'ok:1' and v_n = 1 and v_m = 0,
    'hr care conduce vede mașina alocată lui (0215), nu și cardul ei',
    format('card %s, vehicul %s, card văzut %s', v_r, v_n, v_m));
  -- Implicita I-b3: tranzacțiile doar pe `vehicles:read = all`. Managerul și
  -- șoferul văd cardul, dar nu și ce a facturat (nici pe foaia proprie).
  v_n := pg_temp.numara(v_u_mgr, format(
    'select count(*) from public.fuel_card_transactions where organization_id = %L', v_org));
  v_m := pg_temp.numara(v_u_ang, format(
    'select count(*) from public.fuel_card_transactions where organization_id = %L', v_org));
  v_t := pg_temp.numara(v_u_admin, format(
    'select count(*) from public.fuel_card_transactions where organization_id = %L', v_org))::text;
  v_esecuri := v_esecuri + pg_temp.verifica('9b', v_n = 0 and v_m = 0 and v_t = '3',
    'manager și employee văd 0 tranzacții (I-b3); org_admin le vede pe toate 3',
    format('%s / %s / %s', v_n, v_m, v_t));

  -- ── (10) manager modifică un card: USING îl oprește tăcut ─────────────
  v_r := pg_temp.ruleaza(v_u_mgr, format(
    'update public.fuel_cards set denumire = ''furat'', updated_by = %L where id = %L', v_u_mgr, v_c_sof_ang));
  v_esecuri := v_esecuri + pg_temp.verifica('10', v_r = 'ok:0',
    'manager modifică un card vizibil lui: 0 rânduri, fără eroare', v_r);

  -- ── (11) vehiculul altei firme ─────────────────────────────────────────
  v_r := pg_temp.ruleaza(v_u_admin, format(
    'insert into public.fuel_cards (organization_id, emitent, ultimele_cifre, vehicle_id, created_by, updated_by) '
    || 'values (%L, ''mol'', ''4444'', %L, %L, %L)', v_org, v_veh_alta, v_u_admin, v_u_admin));
  v_esecuri := v_esecuri + pg_temp.verifica('11', v_r like 'P0001:Vehiculul ales pentru card%',
    'card pe vehiculul altei firme: P0001', v_r);

  -- ── (12) extrasul e imuabil ────────────────────────────────────────────
  v_r := pg_temp.ruleaza(v_u_admin, format(
    'update public.fuel_card_transactions set valoare_bruta = 1, updated_by = %L where id = %L', v_u_admin, v_tx2));
  v_esecuri := v_esecuri + pg_temp.verifica('12', v_r like 'P0001:Datele din extras nu se modifică%',
    'UPDATE pe valoare_bruta: P0001', v_r);

  -- ── (13) dedup ─────────────────────────────────────────────────────────
  v_r := pg_temp.ruleaza(v_u_admin, pg_temp.tx(v_org, v_lot, 'h:doi#1', 'necombustibil',
    null, v_veh_ang, null, null, 'adblue'));
  v_esecuri := v_esecuri + pg_temp.verifica('13', v_r like '23505:%fctx_dedup_uq%',
    'a doua tranzacție cu aceeași cheie de dedup: 23505', v_r);

  -- ── (14) o alimentare, o singură tranzacție ───────────────────────────
  v_r := pg_temp.ruleaza(v_u_admin, pg_temp.tx(v_org, v_lot, 'h:patru#1', 'potrivita',
    null, null, null, v_alim));
  v_esecuri := v_esecuri + pg_temp.verifica('14', v_r like '23505:%fctx_alimentare_uq%',
    'a doua tranzacție pe aceeași alimentare: 23505', v_r);

  -- ── (15) firma B nu vede și nu atinge nimic din firma A ───────────────
  v_n := pg_temp.numara(v_u_alta, format(
    'select (select count(*) from public.fuel_cards where organization_id = %1$L)'
    || ' + (select count(*) from public.fuel_card_transactions where organization_id = %1$L)'
    || ' + (select count(*) from public.fuel_card_imports where organization_id = %1$L)'
    || ' + (select count(*) from public.fuel_card_import_profiles where organization_id = %1$L)', v_org));
  v_r := pg_temp.ruleaza(v_u_alta, format(
    'update public.fuel_cards set denumire = ''x'', updated_by = %L where id = %L', v_u_alta, v_c_veh_ang));
  v_esecuri := v_esecuri + pg_temp.verifica('15', v_n = 0 and v_r = 'ok:0',
    'org_admin-ul firmei B: 0 rânduri ale firmei A și UPDATE pe 0 rânduri', format('%s / %s', v_n, v_r));

  -- ── (16) starea și legătura merg împreună ─────────────────────────────
  v_r := pg_temp.ruleaza(v_u_admin, pg_temp.tx(v_org, v_lot, 'h:cinci#1', 'potrivita', v_c_veh_ang, v_veh_ang));
  v_esecuri := v_esecuri + pg_temp.verifica('16', v_r like '23514:%fctx_stare_ck%',
    '`potrivita` fără alimentare: 23514', v_r);

  -- ── (17) ignorarea cere o notă ─────────────────────────────────────────
  v_r := pg_temp.ruleaza(v_u_admin, format(
    'update public.fuel_card_transactions set stare_potrivire = ''ignorata'', updated_by = %L where id = %L',
    v_u_admin, v_tx3));
  v_t := pg_temp.ruleaza(v_u_admin, format(
    'update public.fuel_card_transactions set stare_potrivire = ''ignorata'', nota = ''Card pierdut, raportat.'', '
    || 'updated_by = %L where id = %L', v_u_admin, v_tx3));
  v_esecuri := v_esecuri + pg_temp.verifica('17', v_r like 'P0001:Spuneți de ce ignorați%' and v_t = 'ok:1',
    '`ignorata` fără notă: P0001; cu notă: 1 rând', v_r || ' / ' || v_t);

  -- ── (18) Storage: lotul importului nu se citește pe team / own ───────
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  v_r := app.can_path(v_org::text || '/vehicles/' || v_lot::text || '/lot-card.json', 'read')::text;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  v_r := v_r || '/' || app.can_path(v_org::text || '/vehicles/' || v_lot::text || '/lot-card.json', 'read')::text;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  v_r := v_r || '/' || app.can_path(v_org::text || '/vehicles/' || v_lot::text || '/lot-card.json', 'read')::text;
  reset role;
  v_esecuri := v_esecuri + pg_temp.verifica('18', v_r = 'true/false/false',
    'can_path pe lotul importului: org_admin da, manager și employee nu', v_r);

  -- ── (19) manager nu scrie tranzacții ──────────────────────────────────
  v_r := pg_temp.ruleaza(v_u_mgr, pg_temp.tx(v_org, v_lot, 'h:sase#1', 'card_necunoscut'));
  v_esecuri := v_esecuri + pg_temp.verifica('19', v_r like '42501:%', 'manager inserează o tranzacție: 42501', v_r);

  -- ── (20) hr nu scrie profiluri ────────────────────────────────────────
  v_r := pg_temp.ruleaza(v_u_hr, format(
    'insert into public.fuel_card_import_profiles (organization_id, emitent, mapare, created_by, updated_by) '
    || 'values (%L, ''mol'', ''{}'', %L, %L)', v_org, v_u_hr, v_u_hr));
  v_esecuri := v_esecuri + pg_temp.verifica('20', v_r like '42501:%', 'hr inserează un profil de import: 42501', v_r);

  -- ── (21) integritatea cardului ────────────────────────────────────────
  v_r := pg_temp.ruleaza(v_u_admin, format(
    'update public.fuel_cards set ultimele_cifre = ''1235'', updated_by = %L where id = %L', v_u_admin, v_c_veh_ang));
  v_t := pg_temp.ruleaza(v_u_admin, pg_temp.tx(v_org, v_lot, 'h:sapte#1', 'necombustibil',
    v_c_veh_col, v_veh_coleg, null, null, 'parcare', null, null, 'omv_petrom'));
  v_esecuri := v_esecuri + pg_temp.verifica('21',
    v_r like 'P0001:Numărul unui card nu se schimbă%' and v_t like 'P0001:Cardul ales e al altui emitent%',
    'numărul cardului nu se schimbă; cardul MOL pe un extras OMV: P0001', v_r || ' / ' || v_t);

  -- ── (3) anularea cardului scoate scadența ─────────────────────────────
  v_r := pg_temp.ruleaza(v_u_admin, format(
    'update public.fuel_cards set status = ''anulat'', updated_by = %L where id = %L', v_u_admin, v_c_sof_col));
  select count(*) into v_n from public.expirables
   where entity_type = 'fuel_card' and entity_id = v_c_sof_col and deleted_at is null;
  v_esecuri := v_esecuri + pg_temp.verifica('3', v_r = 'ok:1' and v_n = 0,
    'anularea cardului: 1 rând, scadența iese din expirables', format('%s, rămase %s', v_r, v_n));

  -- ── (6b) ștergerea logică cu RETURNING ────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    v_id := null;
    update public.fuel_cards set deleted_at = now(), updated_by = v_u_admin
     where id = v_c_sof_col returning id into v_id;
    reset role;
  exception when others then
    reset role;
    raise warning '    6b: %', sqlerrm;
  end;
  v_esecuri := v_esecuri + pg_temp.verifica('6b', v_id = v_c_sof_col,
    'ștergerea logică a cardului întoarce rândul prin RETURNING', coalesce(v_id::text, 'null'));

  -- ── (6c) anularea importului eliberează cheia ─────────────────────────
  v_r := pg_temp.ruleaza(v_u_admin, format(
    'insert into public.fuel_card_imports (id, organization_id, emitent, fisier_nume, fisier_sha256, '
    || 'perioada_de_la, perioada_pana_la, randuri_fisier, created_by, updated_by) values '
    || '(%L, %L, ''omv_petrom'', ''extras-2.csv'', %L, %L, %L, 1, %L, %L)',
    v_lot2, v_org, repeat('b', 64), v_zi - 30, v_zi, v_u_admin, v_u_admin))
    || ' ' || pg_temp.ruleaza(v_u_admin, pg_temp.tx(v_org, v_lot2, 'h:opt#1', 'card_necunoscut'));
  v_t := pg_temp.ruleaza(v_u_admin, format(
    'update public.fuel_card_transactions set deleted_at = now(), updated_by = %L where import_id = %L and deleted_at is null',
    v_u_admin, v_lot2))
    || ' ' || pg_temp.ruleaza(v_u_admin, format(
    'update public.fuel_card_imports set deleted_at = now(), updated_by = %L where id = %L', v_u_admin, v_lot2))
    || ' ' || pg_temp.ruleaza(v_u_admin, pg_temp.tx(v_org, v_lot, 'h:opt#1', 'card_necunoscut'));
  v_esecuri := v_esecuri + pg_temp.verifica('6c', v_r = 'ok:1 ok:1' and v_t = 'ok:1 ok:1 ok:1',
    'anularea importului: tranzacțiile (1), apoi lotul (1); cheia se poate importa din nou',
    v_r || ' / ' || v_t);

  -- ── (6e) super_admin vede, nu scrie ───────────────────────────────────
  v_n := pg_temp.numara(v_u_sa, format('select count(*) from public.fuel_cards where organization_id = %L', v_org));
  v_r := pg_temp.ruleaza(v_u_sa, format(
    'insert into public.fuel_cards (organization_id, emitent, ultimele_cifre, created_by, updated_by) '
    || 'values (%L, ''mol'', ''4444'', %L, %L)', v_org, v_u_sa, v_u_sa));
  v_esecuri := v_esecuri + pg_temp.verifica('6e', v_n = 5 and v_r like '42501:%',
    'super_admin (doar platform_admins) vede cele 5 carduri și nu inserează (42501)',
    format('%s / %s', v_n, v_r));

  -- ── (6f) rezumatul zilnic: cardul de rezervă care expiră în 10 zile ──
  perform internal.genereaza_alerte(v_org);
  perform internal.flota_rezumat(v_org);
  select link into v_t from public.notifications
   where organization_id = v_org and user_id = v_u_admin and title like 'Flota:%'
   order by created_at desc limit 1;
  v_esecuri := v_esecuri + pg_temp.verifica('6f', v_t = '/flota/carduri?card=' || v_c_rezerva::text,
    'rezumatul flotei duce cardul de rezervă spre /flota/carduri?card=<id>', coalesce(v_t, 'nicio notificare'));
  select count(*) into v_n from public.notifications
   where organization_id = v_org and user_id in (v_u_ang, v_u_mgr, v_u_hr, v_u_coleg) and title like 'Flota:%';
  v_esecuri := v_esecuri + pg_temp.verifica('6f-b', v_n = 0,
    'cardul de rezervă (fără vehicul, fără șofer) nu ajunge la cei care nu-l văd', format('%s', v_n));

  -- ── (6d) vehiculul casat scoate scadența cardului ─────────────────────
  -- Din 0218 (F12h), casarea e un INSERT în `vehicle_exits`: `status = 'casat'`
  -- scris direct îl refuză `vehicles_iesire_garda` (P0001).
  v_r := pg_temp.ruleaza(v_u_admin, format(
    'insert into public.vehicle_exits (organization_id, vehicle_id, tip, data_iesire, motiv, created_by, updated_by) '
    || 'values (%L, %L, ''casare'', %L, ''Proba carduri'', %L, %L)',
    v_org, v_veh_coleg, v_zi, v_u_admin, v_u_admin));
  select count(*) into v_n from public.expirables
   where entity_type = 'fuel_card' and entity_id = v_c_veh_col and deleted_at is null;
  v_t := pg_temp.ruleaza(v_u_admin, format(
    'insert into public.fuel_cards (organization_id, emitent, ultimele_cifre, vehicle_id, created_by, updated_by) '
    || 'values (%L, ''mol'', ''4444'', %L, %L, %L)', v_org, v_veh_coleg, v_u_admin, v_u_admin));
  v_esecuri := v_esecuri + pg_temp.verifica('6d', v_r = 'ok:1' and v_n = 0 and v_t like 'P0001:Vehiculul ales%',
    'vehiculul casat: scadența cardului iese; un card nou pe el e refuzat (P0001)',
    format('%s, rămase %s, %s', v_r, v_n, v_t));

  -- ── (22) auditul ──────────────────────────────────────────────────────
  select count(*) into v_n from public.audit_logs where entity_type = 'fuel_cards' and organization_id = v_org;
  select count(*) into v_m from public.audit_logs
   where entity_type = 'fuel_card_transactions' and organization_id = v_org;
  v_esecuri := v_esecuri + pg_temp.verifica('22', v_n >= 7 and v_m >= 4,
    'scrierile pe carduri și tranzacții lasă urmă în audit_logs', format('carduri %s, tranzacții %s', v_n, v_m));

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA FLOTA CARDURI: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE verificările au trecut.';
  raise notice '';
end;
$$;

rollback;
