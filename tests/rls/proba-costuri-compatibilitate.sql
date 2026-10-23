-- tests/rls/proba-costuri-compatibilitate.sql
--
-- COLOANELE VECHI DE COST CA INTRARE DE COMPATIBILITATE, ÎNTRE FIRME (Y1).
-- Triggerele care mută o valoare scrisă în coloana veche în tabela de costuri
-- rulează BEFORE, cu drepturile proprietarului, deci ÎNAINTEA conflictului din
-- `INSERT … ON CONFLICT DO NOTHING` (upsert-ul PostgREST cu
-- `resolution=ignore-duplicates`). Cu `id`-ul unui rând al ALTEI firme și cu
-- firma proprie pe rând, WITH CHECK trecea, mutarea suprascria costul străin,
-- apoi conflictul sărea rândul fără eroare: efectul rămânea.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- Flota (0225 §3 și §6)
-- (1a) upsert ignore-duplicates pe vehicle_documents cu id-ul documentului
--      firmei B: costul lui B rămâne neschimbat;
-- (1b) la fel, cu `on conflict (id) do nothing`;
-- (1c) același lucru pe vehicles: valoarea de achiziție a lui B rămâne;
-- (1d) pe un vehicul al lui B FĂRĂ rând de cost: niciun rând nu apare;
-- (1e) pe un document al lui B fără rând de cost: niciun rând nu apare;
-- (1f) un rând de cost al altei firme pe un vehicul propriu (stare forjată):
--      corectura prin coloana veche e refuzată, rândul străin rămâne;
-- (1g) cu steagul `app.flota_cost_mutat` pus, inserarea DIRECTĂ a unui rând de
--      cost pe vehiculul / documentul lui B e refuzată (vc_inainte / vdc_inainte);
-- (1h) compatibilitatea legitimă merge: vehicul și document noi cu valoare în
--      coloana veche → rândul de cost al firmei, coloana goală       [POZITIVĂ];
-- (1i) corectura legitimă prin coloana veche pe vehiculul propriu    [POZITIVĂ];
-- (1j) upsert ignore-duplicates pe documentul PROPRIU: nimic mutat, nimic
--      stricat (golire fără mutare, ca pe orice id existent);
-- (1k) fără oracol între firme: un rând de cost pus pe firma B cu id-ul REAL al
--      vehiculului / documentului lui B primește același răspuns ca unul cu un
--      id inventat (garda de firmă e prima în vc_inainte / vdc_inainte);
-- (1l) constatarea (k): un membru cu `vehicles:create = all` și `update = none`
--      nu scrie valoarea unui vehicul / cost al unui document EXISTENT creat de
--      altcineva (42501); pe vehiculul și documentul abia create de el, da
--      [POZITIVĂ]; corectura lor (upsert `do update`) îi rămâne refuzată.
-- Mentenanța (0232): valoarea de achiziție a echipamentului
-- (2a) responsabilul echipamentului (employee) își vede utilajul, dar nu
--      valoarea: nici în rând, nici în `equipment_costuri`;
-- (2b) tehnicianul atribuit unei sesizări: la fel;
-- (2c) managerul (`maintenance:read = team`) vede valoarea — e cheia sub care
--      citește deja costurile intervențiilor și raportul            [POZITIVĂ];
-- (2d) org_admin o vede [POZITIVĂ]; hr și administratorul altei firme, nu;
-- (2e) managerul nu scrie valoarea (`maintenance:update = all`): 42501;
-- (2f) gestionarul pe `team` (suprascriere pe membru) editează echipamentul
--      [POZITIVĂ], dar nu valoarea, nici prin coloana veche (42501);
-- (2g) upsert ignore-duplicates pe `equipment` cu id-ul echipamentului firmei
--      B: valoarea lui B rămâne;
-- (2h) pe un echipament al lui B fără valoare: niciun rând nu apare;
-- (2i) cu steagul `app.mentenanta_cost_mutat` pus, inserarea directă pe
--      echipamentul lui B e refuzată (P0001);
-- (2j) compatibilitatea legitimă: echipament nou și corectură prin coloana
--      veche → rândul de cost al firmei, coloana goală               [POZITIVĂ];
-- (2k) calea nouă: upsert pe `equipment_costuri`, și cu `null`      [POZITIVĂ];
-- (2l) fără oracol între firme: rândul pus pe firma B cu id-ul real al
--      echipamentului lui B și cu unul inventat primesc același răspuns.
-- Excepția intenționată (0225 §8, neschimbată)
-- (3)  `avantaj_natura_flota` (`payroll:read = all`: org_admin, hr) dă valoarea
--      de intrare DOAR pe vehiculul alocat cu folosință personală; vehiculul
--      alocat fără folosință personală nu apare; managerul și angajatul: nimic.
-- Referințele la `equipment_costuri` sunt SQL dinamic: proba rulează și pe o
-- bază fără 0232, unde (2a) și (2b) pică — scurgerea pe care o închide 0232.
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

-- Câte rânduri vede `p_user` prin `p_sql`; -1 la eroare (de pildă tabela lipsă).
create function pg_temp.numara(p_user uuid, p_sql text) returns bigint
language plpgsql as $f$
declare
  v_n bigint;
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  set local role authenticated;
  execute 'select count(*) from (' || p_sql || ') z' into v_n;
  reset role;
  return v_n;
exception when others then
  reset role;
  return -1;
end
$f$;

-- O valoare citită fără RLS (ca proprietar), prin SQL dinamic; `null` la eroare.
create function pg_temp.valoare(p_sql text) returns numeric
language plpgsql as $f$
declare
  v numeric;
begin
  execute p_sql into v;
  return v;
exception when others then
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
  v_sufix   text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_zi      date := app.azi_local();
  v_org     uuid := gen_random_uuid();
  v_org_b   uuid := gen_random_uuid();
  v_u_a     uuid := gen_random_uuid();
  v_u_b     uuid := gen_random_uuid();
  v_itp     uuid;
  v_rca     uuid;
  v_va      uuid := gen_random_uuid();
  v_va2     uuid := gen_random_uuid();
  v_vb      uuid := gen_random_uuid();
  v_vb2     uuid := gen_random_uuid();
  v_vb3     uuid := gen_random_uuid();
  v_va_nou  uuid := gen_random_uuid();
  v_da      uuid := gen_random_uuid();
  v_db      uuid := gen_random_uuid();
  v_db2     uuid := gen_random_uuid();
  v_db3     uuid := gen_random_uuid();
  v_da_nou  uuid := gen_random_uuid();
  -- (1l): membrul cu `vehicles:create = all` fără `update`
  v_u_c     uuid := gen_random_uuid();
  v_m_c     uuid;
  v_vc_nou  uuid := gen_random_uuid();
  v_dc_nou  uuid := gen_random_uuid();
  v_da2     uuid := gen_random_uuid();
  -- mentenanța
  v_u_mgr   uuid := gen_random_uuid();
  v_u_hr    uuid := gen_random_uuid();
  v_u_resp  uuid := gen_random_uuid();
  v_u_teh   uuid := gen_random_uuid();
  v_u_gest  uuid := gen_random_uuid();
  v_e_mgr   uuid := gen_random_uuid();
  v_e_resp  uuid := gen_random_uuid();
  v_e_teh   uuid := gen_random_uuid();
  v_m_gest  uuid;
  v_eq1     uuid := gen_random_uuid();
  v_eq2     uuid := gen_random_uuid();
  v_eqb     uuid := gen_random_uuid();
  v_eqb2    uuid := gen_random_uuid();
  v_eqb3    uuid := gen_random_uuid();
  v_eq_nou  uuid := gen_random_uuid();
  v_c       text;
  v_d       text;
  v_a       text;
  v_b       text;
  v_n       numeric;
  v_m       bigint;
  v_esecuri int := 0;
begin
  raise notice '';
  raise notice '  PROBA „COSTURI: COMPATIBILITATE ÎNTRE FIRME” (Y1: 0225, 0232)';
  raise notice '  ─────────────────────────────────────────────────────────';

  select id into v_itp from public.vehicle_document_types where organization_id is null and cod = 'itp';
  select id into v_rca from public.vehicle_document_types where organization_id is null and cod = 'rca';

  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-y1-' || v_sufix, 'Proba Y1 SRL',
     'RO' || (85000000 + (random() * 900000)::int)::text),
    (v_org_b, 'proba-y1-b-' || v_sufix, 'Altă Firmă Y1 SRL',
     'RO' || (84000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select o, f.feature_key, true, now() from public.features f, unnest(array[v_org, v_org_b]) o;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_a, 'y1-a-' || v_sufix || '@proba.test', now()),
    (v_u_b, 'y1-b-' || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_a, 'org_admin'),
    (v_org_b, v_u_b, 'org_admin');

  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent, created_by, updated_by)
  values (v_va,  v_org,   'B' || (100 + (random() * 800)::int)::text || 'YAA', 'Dacia', 'Logan', 1000, v_u_a, v_u_a),
         (v_va2, v_org,   'B' || (100 + (random() * 800)::int)::text || 'YAB', 'Dacia', 'Duster', 1000, v_u_a, v_u_a),
         (v_vb,  v_org_b, 'CJ' || (10 + (random() * 80)::int)::text || 'YBA', 'Skoda', 'Octavia', 2000, v_u_b, v_u_b),
         (v_vb2, v_org_b, 'CJ' || (10 + (random() * 80)::int)::text || 'YBB', 'Skoda', 'Fabia', 2000, v_u_b, v_u_b),
         (v_vb3, v_org_b, 'CJ' || (10 + (random() * 80)::int)::text || 'YBC', 'Skoda', 'Kamiq', 2000, v_u_b, v_u_b);
  insert into public.vehicle_documents (id, organization_id, vehicle_id, document_type_id, numar, expira_la,
                                        created_by, updated_by)
  values (v_da,  v_org,   v_va,  v_itp, 'ITP-YA', v_zi + 200, v_u_a, v_u_a),
         (v_db,  v_org_b, v_vb,  v_itp, 'ITP-YB', v_zi + 200, v_u_b, v_u_b),
         (v_db2, v_org_b, v_vb,  v_rca, 'RCA-YB', v_zi + 200, v_u_b, v_u_b),
         (v_db3, v_org_b, v_vb3, v_rca, 'RCA-YC', v_zi + 200, v_u_b, v_u_b);
  insert into public.vehicle_costuri (organization_id, vehicle_id, valoare_achizitie, created_by, updated_by)
  values (v_org, v_va, 40000, v_u_a, v_u_a),
         (v_org_b, v_vb, 50000, v_u_b, v_u_b);
  insert into public.vehicle_document_costuri (organization_id, document_id, cost, created_by, updated_by)
  values (v_org, v_da, 300, v_u_a, v_u_a),
         (v_org_b, v_db, 1200, v_u_b, v_u_b);

  -- ═══ (1) Flota ═══════════════════════════════════════════════════════════
  v_a := pg_temp.ruleaza(v_u_a, format(
    $q$insert into public.vehicle_documents (id, organization_id, vehicle_id, document_type_id, numar,
                                            expira_la, cost, created_by, updated_by)
       values (%L, %L, %L, %L, 'ITP-FALS', %L, 1, %L, %L) on conflict do nothing$q$,
    v_db, v_org, v_va, v_itp, v_zi + 300, v_u_a, v_u_a));
  select cost into v_n from public.vehicle_document_costuri where document_id = v_db;
  v_esecuri := v_esecuri + pg_temp.verifica('1a', v_n = 1200,
    'upsert ignore-duplicates cu id-ul documentului firmei B: costul lui B rămâne 1200',
    'cost B = ' || coalesce(v_n::text, 'null') || ' · ' || v_a);

  v_a := pg_temp.ruleaza(v_u_a, format(
    $q$insert into public.vehicle_documents (id, organization_id, vehicle_id, document_type_id, numar,
                                            expira_la, cost, created_by, updated_by)
       values (%L, %L, %L, %L, 'ITP-FALS', %L, 2, %L, %L) on conflict (id) do nothing$q$,
    v_db, v_org, v_va, v_itp, v_zi + 300, v_u_a, v_u_a));
  select cost into v_n from public.vehicle_document_costuri where document_id = v_db;
  v_esecuri := v_esecuri + pg_temp.verifica('1b', v_n = 1200,
    'la fel cu `on conflict (id) do nothing`',
    'cost B = ' || coalesce(v_n::text, 'null') || ' · ' || v_a);

  v_a := pg_temp.ruleaza(v_u_a, format(
    $q$insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent,
                                   valoare_achizitie, created_by, updated_by)
       values (%L, %L, 'B999YFF', 'Dacia', 'Spring', 0, 1, %L, %L) on conflict do nothing$q$,
    v_vb, v_org, v_u_a, v_u_a));
  select valoare_achizitie into v_n from public.vehicle_costuri where vehicle_id = v_vb;
  v_esecuri := v_esecuri + pg_temp.verifica('1c', v_n = 50000,
    'upsert ignore-duplicates cu id-ul vehiculului firmei B: valoarea lui B rămâne 50000',
    'valoare B = ' || coalesce(v_n::text, 'null') || ' · ' || v_a);

  v_a := pg_temp.ruleaza(v_u_a, format(
    $q$insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent,
                                   valoare_achizitie, created_by, updated_by)
       values (%L, %L, 'B998YFF', 'Dacia', 'Spring', 0, 3, %L, %L) on conflict do nothing$q$,
    v_vb2, v_org, v_u_a, v_u_a));
  select count(*) into v_m from public.vehicle_costuri where vehicle_id = v_vb2;
  v_esecuri := v_esecuri + pg_temp.verifica('1d', v_m = 0,
    'pe vehiculul lui B fără rând de cost nu apare niciun rând (nici al firmei A)',
    v_m::text || ' rânduri · ' || v_a);

  v_a := pg_temp.ruleaza(v_u_a, format(
    $q$insert into public.vehicle_documents (id, organization_id, vehicle_id, document_type_id, numar,
                                            expira_la, cost, created_by, updated_by)
       values (%L, %L, %L, %L, 'RCA-FALS', %L, 4, %L, %L) on conflict do nothing$q$,
    v_db2, v_org, v_va, v_rca, v_zi + 300, v_u_a, v_u_a));
  select count(*) into v_m from public.vehicle_document_costuri where document_id = v_db2;
  v_esecuri := v_esecuri + pg_temp.verifica('1e', v_m = 0,
    'pe documentul lui B fără rând de cost nu apare niciun rând',
    v_m::text || ' rânduri · ' || v_a);

  -- Stare forjată (fără triggere): un rând de cost al firmei B lipit de
  -- vehiculul A2. Corectura prin coloana veche nu are voie să-l rescrie.
  set local session_replication_role = replica;
  insert into public.vehicle_costuri (organization_id, vehicle_id, valoare_achizitie, created_by, updated_by)
  values (v_org_b, v_va2, 7000, v_u_b, v_u_b);
  set local session_replication_role = origin;
  v_a := pg_temp.ruleaza(v_u_a, format(
    'update public.vehicles set valoare_achizitie = 5, updated_by = %L where id = %L', v_u_a, v_va2));
  select valoare_achizitie into v_n from public.vehicle_costuri where vehicle_id = v_va2;
  v_esecuri := v_esecuri + pg_temp.verifica('1f', v_a not like 'ok:%' and v_n = 7000,
    'rândul de cost al altei firme pe vehiculul propriu: corectura prin coloana veche e refuzată',
    'valoare = ' || coalesce(v_n::text, 'null') || ' · ' || v_a);
  set local session_replication_role = replica;
  delete from public.vehicle_costuri where vehicle_id = v_va2;
  set local session_replication_role = origin;

  -- Steagul pus de altcineva decât triggerul (defensiv: PostgREST nu-l poate
  -- seta, dar garda nu are voie să depindă de asta).
  perform set_config('app.flota_cost_mutat', 'on', true);
  v_a := pg_temp.ruleaza(v_u_a, format(
    $q$insert into public.vehicle_costuri (organization_id, vehicle_id, valoare_achizitie, created_by, updated_by)
       values (%L, %L, 9, %L, %L)$q$, v_org, v_vb3, v_u_a, v_u_a));
  v_b := pg_temp.ruleaza(v_u_a, format(
    $q$insert into public.vehicle_document_costuri (organization_id, document_id, cost, created_by, updated_by)
       values (%L, %L, 9, %L, %L)$q$, v_org, v_db3, v_u_a, v_u_a));
  perform set_config('app.flota_cost_mutat', '', true);
  v_esecuri := v_esecuri + pg_temp.verifica('1g',
    v_a like 'P0001:%' and v_b like 'P0001:%'
    and not exists (select 1 from public.vehicle_costuri where vehicle_id = v_vb3)
    and not exists (select 1 from public.vehicle_document_costuri where document_id = v_db3),
    'cu steagul pus, rândul de cost pe vehiculul / documentul firmei B e refuzat',
    v_a || ' · ' || v_b);

  -- Compatibilitatea legitimă.
  v_a := pg_temp.ruleaza(v_u_a, format(
    $q$insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent,
                                   valoare_achizitie, created_by, updated_by)
       values (%L, %L, 'B997YAC', 'Dacia', 'Jogger', 0, 70000, %L, %L)$q$, v_va_nou, v_org, v_u_a, v_u_a));
  v_b := pg_temp.ruleaza(v_u_a, format(
    $q$insert into public.vehicle_documents (id, organization_id, vehicle_id, document_type_id, numar,
                                            expira_la, cost, created_by, updated_by)
       values (%L, %L, %L, %L, 'RCA-YA', %L, 1500, %L, %L)$q$,
    v_da_nou, v_org, v_va_nou, v_rca, v_zi + 300, v_u_a, v_u_a));
  v_esecuri := v_esecuri + pg_temp.verifica('1h',
    v_a = 'ok:1' and v_b = 'ok:1'
    and (select valoare_achizitie from public.vehicle_costuri
          where vehicle_id = v_va_nou and organization_id = v_org) = 70000
    and (select cost from public.vehicle_document_costuri
          where document_id = v_da_nou and organization_id = v_org) = 1500
    and (select valoare_achizitie from public.vehicles where id = v_va_nou) is null
    and (select cost from public.vehicle_documents where id = v_da_nou) is null,
    'vehicul și document noi cu valoare în coloana veche: rândul de cost al firmei, coloana goală',
    v_a || ' · ' || v_b);

  v_a := pg_temp.ruleaza(v_u_a, format(
    'update public.vehicles set valoare_achizitie = 45000, updated_by = %L where id = %L', v_u_a, v_va));
  v_b := pg_temp.ruleaza(v_u_a, format(
    'update public.vehicle_documents set cost = 350, updated_by = %L where id = %L', v_u_a, v_da));
  v_esecuri := v_esecuri + pg_temp.verifica('1i',
    v_a = 'ok:1' and v_b = 'ok:1'
    and (select valoare_achizitie from public.vehicle_costuri where vehicle_id = v_va) = 45000
    and (select cost from public.vehicle_document_costuri where document_id = v_da) = 350,
    'corectura prin coloana veche pe vehiculul și documentul propriu ajunge în costuri',
    v_a || ' · ' || v_b);

  v_a := pg_temp.ruleaza(v_u_a, format(
    $q$insert into public.vehicle_documents (id, organization_id, vehicle_id, document_type_id, numar,
                                            expira_la, cost, created_by, updated_by)
       values (%L, %L, %L, %L, 'ITP-YA', %L, 999, %L, %L) on conflict do nothing$q$,
    v_da, v_org, v_va, v_itp, v_zi + 200, v_u_a, v_u_a));
  v_esecuri := v_esecuri + pg_temp.verifica('1j',
    v_a = 'ok:0' and (select cost from public.vehicle_document_costuri where document_id = v_da) = 350,
    'upsert ignore-duplicates pe documentul propriu: nimic mutat, costul rămâne',
    v_a);

  -- (1k) Oracolul: triggerul BEFORE rulează înaintea lui WITH CHECK. Fără garda
  -- de firmă întâi, id-ul real al lui B trecea de căutare și cădea pe politică
  -- (42501), iar cel inventat primea P0001 din trigger.
  v_a := pg_temp.ruleaza(v_u_a, format(
    $q$insert into public.vehicle_costuri (organization_id, vehicle_id, valoare_achizitie, created_by, updated_by)
       values (%L, %L, 1, %L, %L)$q$, v_org_b, v_vb2, v_u_a, v_u_a));
  v_b := pg_temp.ruleaza(v_u_a, format(
    $q$insert into public.vehicle_costuri (organization_id, vehicle_id, valoare_achizitie, created_by, updated_by)
       values (%L, %L, 1, %L, %L)$q$, v_org_b, gen_random_uuid(), v_u_a, v_u_a));
  v_c := pg_temp.ruleaza(v_u_a, format(
    $q$insert into public.vehicle_document_costuri (organization_id, document_id, cost, created_by, updated_by)
       values (%L, %L, 1, %L, %L)$q$, v_org_b, v_db2, v_u_a, v_u_a));
  v_d := pg_temp.ruleaza(v_u_a, format(
    $q$insert into public.vehicle_document_costuri (organization_id, document_id, cost, created_by, updated_by)
       values (%L, %L, 1, %L, %L)$q$, v_org_b, gen_random_uuid(), v_u_a, v_u_a));
  v_esecuri := v_esecuri + pg_temp.verifica('1k',
    v_a like '42501:%' and v_a = v_b and v_c like '42501:%' and v_c = v_d,
    'rândul de cost pe firma B: id-ul real și cel inventat primesc același 42501 (fără oracol)',
    'vc ' || v_a || ' / ' || v_b || ' · vdc ' || v_c || ' / ' || v_d);

  -- (1l) Constatarea (k). Membrul C: manager cu `vehicles:create = all`,
  -- `update = none` și `read = all` (suprascriere pe membru, 0063).
  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_c, 'y1-c-' || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values (v_org, v_u_c, 'manager');
  select id into v_m_c from public.organization_members where organization_id = v_org and user_id = v_u_c;
  insert into public.role_permissions (organization_id, member_id, role, resource, action, scope) values
    (v_org, v_m_c, 'manager', 'vehicles', 'create', 'all'),
    (v_org, v_m_c, 'manager', 'vehicles', 'update', 'none'),
    (v_org, v_m_c, 'manager', 'vehicles', 'read', 'all');
  -- VA2 (creat de A) n-are rând de cost. Un document al lui A, tot fără cost.
  insert into public.vehicle_documents (id, organization_id, vehicle_id, document_type_id, numar, expira_la,
                                        created_by, updated_by)
  values (v_da2, v_org, v_va2, v_itp, 'ITP-YA2', v_zi + 200, v_u_a, v_u_a);
  v_a := pg_temp.ruleaza(v_u_c, format(
    $q$insert into public.vehicle_costuri (organization_id, vehicle_id, valoare_achizitie, created_by, updated_by)
       values (%L, %L, 777, %L, %L)$q$, v_org, v_va2, v_u_c, v_u_c));
  v_b := pg_temp.ruleaza(v_u_c, format(
    $q$insert into public.vehicle_document_costuri (organization_id, document_id, cost, created_by, updated_by)
       values (%L, %L, 777, %L, %L)$q$, v_org, v_da2, v_u_c, v_u_c));
  v_esecuri := v_esecuri + pg_temp.verifica('1l-refuz',
    v_a like '42501:%' and v_b like '42501:%'
    and not exists (select 1 from public.vehicle_costuri where vehicle_id = v_va2)
    and not exists (select 1 from public.vehicle_document_costuri where document_id = v_da2),
    'create fără update: valoarea vehiculului / costul documentului EXISTENT al altcuiva, refuzate',
    v_a || ' · ' || v_b);
  -- Vehiculul și documentul lui: două cereri, ca în aplicație (creeazaVehicul,
  -- adaugaDocument), apoi costul.
  v_a := pg_temp.ruleaza(v_u_c, format(
    $q$insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent, created_by, updated_by)
       values (%L, %L, 'B996YAC', 'Dacia', 'Sandero', 0, %L, %L)$q$, v_vc_nou, v_org, v_u_c, v_u_c));
  v_b := pg_temp.ruleaza(v_u_c, format(
    $q$insert into public.vehicle_documents (id, organization_id, vehicle_id, document_type_id, numar, expira_la,
                                            created_by, updated_by)
       values (%L, %L, %L, %L, 'ITP-YC', %L, %L, %L)$q$, v_dc_nou, v_org, v_vc_nou, v_itp, v_zi + 300, v_u_c, v_u_c));
  v_c := pg_temp.ruleaza(v_u_c, format(
    $q$insert into public.vehicle_costuri (organization_id, vehicle_id, valoare_achizitie, created_by, updated_by)
       values (%L, %L, 33000, %L, %L)$q$, v_org, v_vc_nou, v_u_c, v_u_c));
  v_d := pg_temp.ruleaza(v_u_c, format(
    $q$insert into public.vehicle_document_costuri (organization_id, document_id, cost, created_by, updated_by)
       values (%L, %L, 210, %L, %L)$q$, v_org, v_dc_nou, v_u_c, v_u_c));
  v_esecuri := v_esecuri + pg_temp.verifica('1l-propriu',
    v_a = 'ok:1' and v_b = 'ok:1' and v_c = 'ok:1' and v_d = 'ok:1'
    and (select valoare_achizitie from public.vehicle_costuri where vehicle_id = v_vc_nou) = 33000
    and (select cost from public.vehicle_document_costuri where document_id = v_dc_nou) = 210,
    'create fără update: valoarea inițială pe vehiculul și documentul abia create de el',
    v_a || ' · ' || v_b || ' · ' || v_c || ' · ' || v_d);
  v_a := pg_temp.ruleaza(v_u_c, format(
    $q$insert into public.vehicle_costuri (organization_id, vehicle_id, valoare_achizitie, created_by, updated_by)
       values (%L, %L, 1, %L, %L)
       on conflict (vehicle_id) do update set valoare_achizitie = excluded.valoare_achizitie,
                                             updated_by = excluded.updated_by$q$, v_org, v_vc_nou, v_u_c, v_u_c));
  v_esecuri := v_esecuri + pg_temp.verifica('1l-corectura',
    v_a like '42501:%' and (select valoare_achizitie from public.vehicle_costuri where vehicle_id = v_vc_nou) = 33000,
    'create fără update: corectura valorii (upsert do update) rămâne refuzată', v_a);

  -- ═══ (2) Mentenanța: valoarea de achiziție a echipamentului ═════════════════
  -- Fișele ÎNAINTEA membrilor (0083 creează una doar pentru org_admin fără fișă).
  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_mgr,  'y1-mgr-'  || v_sufix || '@proba.test', now()),
    (v_u_hr,   'y1-hr-'   || v_sufix || '@proba.test', now()),
    (v_u_resp, 'y1-resp-' || v_sufix || '@proba.test', now()),
    (v_u_teh,  'y1-teh-'  || v_sufix || '@proba.test', now()),
    (v_u_gest, 'y1-gest-' || v_sufix || '@proba.test', now());
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_mgr,  v_org, 'Y1-M', 'Mihai', 'Manager',     v_zi - 800, 'activ', v_u_mgr,  null),
    (v_e_resp, v_org, 'Y1-R', 'Radu',  'Responsabil', v_zi - 600, 'activ', v_u_resp, v_e_mgr),
    (v_e_teh,  v_org, 'Y1-T', 'Tudor', 'Tehnician',   v_zi - 500, 'activ', v_u_teh,  v_e_mgr);
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_mgr,  'manager'),
    (v_org, v_u_hr,   'hr'),
    (v_org, v_u_resp, 'employee'),
    (v_org, v_u_teh,  'employee'),
    (v_org, v_u_gest, 'manager');
  -- Gestionarul pe `team`: un manager căruia firma i-a dat `maintenance:update =
  -- team` (suprascriere pe membru, 0063): scrie echipamentul, nu valoarea.
  select id into v_m_gest from public.organization_members where organization_id = v_org and user_id = v_u_gest;
  insert into public.role_permissions (organization_id, member_id, role, resource, action, scope)
  values (v_org, v_m_gest, 'manager', 'maintenance', 'update', 'team');

  -- Valorile intră prin coloana veche, în contextul de serviciu: pe o bază fără
  -- 0232 rămân în rând (scurgerea), pe una cu 0232 se mută în `equipment_costuri`.
  insert into public.equipment (id, organization_id, cod, denumire, responsabil_employee_id, valoare_achizitie) values
    (v_eq1,  v_org,   'Y1-PRS-' || v_sufix, 'Presă hidraulică', v_e_resp, 45000),
    (v_eq2,  v_org,   'Y1-CMP-' || v_sufix, 'Compresor',        null,     null),
    (v_eqb,  v_org_b, 'Y1-B1-'  || v_sufix, 'Strung',           null,     30000),
    (v_eqb2, v_org_b, 'Y1-B2-'  || v_sufix, 'Freză',            null,     null),
    (v_eqb3, v_org_b, 'Y1-B3-'  || v_sufix, 'Polizor',          null,     null);
  insert into public.fault_reports (organization_id, equipment_id, raportat_de_employee_id, descriere, atribuit_employee_id)
  values (v_org, v_eq1, v_e_resp, 'Presa pierde ulei pe la cilindru.', v_e_teh);

  v_n := pg_temp.numara(v_u_resp, format('select 1 from public.equipment where id = %L', v_eq1));
  v_m := pg_temp.numara(v_u_resp, format('select 1 from public.equipment where id = %L and valoare_achizitie is not null', v_eq1));
  v_a := pg_temp.numara(v_u_resp, format('select 1 from public.equipment_costuri where equipment_id = %L', v_eq1))::text;
  v_esecuri := v_esecuri + pg_temp.verifica('2a', v_n = 1 and v_m = 0 and v_a = '0',
    'responsabilul își vede utilajul, dar nu valoarea (nici în rând, nici în equipment_costuri)',
    'rând ' || v_n::text || ' · valoare în rând ' || v_m::text || ' · costuri ' || v_a);

  v_n := pg_temp.numara(v_u_teh, format('select 1 from public.equipment where id = %L', v_eq1));
  v_m := pg_temp.numara(v_u_teh, format('select 1 from public.equipment where id = %L and valoare_achizitie is not null', v_eq1));
  v_a := pg_temp.numara(v_u_teh, format('select 1 from public.equipment_costuri where equipment_id = %L', v_eq1))::text;
  v_esecuri := v_esecuri + pg_temp.verifica('2b', v_n = 1 and v_m = 0 and v_a = '0',
    'tehnicianul atribuit își vede utilajul, dar nu valoarea',
    'rând ' || v_n::text || ' · valoare în rând ' || v_m::text || ' · costuri ' || v_a);

  v_n := pg_temp.numara(v_u_mgr, format(
    'select 1 from public.equipment_costuri where equipment_id = %L and valoare_achizitie = 45000', v_eq1));
  v_esecuri := v_esecuri + pg_temp.verifica('2c', v_n = 1,
    'managerul (maintenance:read = team) vede valoarea, ca pe costurile intervențiilor', v_n::text);

  v_n := pg_temp.numara(v_u_a, format(
    'select 1 from public.equipment_costuri where equipment_id = %L and valoare_achizitie = 45000', v_eq1));
  v_m := pg_temp.numara(v_u_hr, format('select 1 from public.equipment_costuri where organization_id = %L', v_org));
  v_a := pg_temp.numara(v_u_b, format('select 1 from public.equipment_costuri where organization_id = %L', v_org))::text;
  v_esecuri := v_esecuri + pg_temp.verifica('2d', v_n = 1 and v_m = 0 and v_a = '0',
    'org_admin vede valoarea; hr și administratorul firmei B nu',
    'adm ' || v_n::text || ' · hr ' || v_m::text || ' · B ' || v_a);

  v_a := pg_temp.ruleaza(v_u_mgr, format(
    $q$insert into public.equipment_costuri (organization_id, equipment_id, valoare_achizitie, created_by, updated_by)
       values (%L, %L, 10, %L, %L)$q$, v_org, v_eq2, v_u_mgr, v_u_mgr));
  v_b := pg_temp.ruleaza(v_u_mgr, format(
    'update public.equipment_costuri set valoare_achizitie = 1, updated_by = %L where equipment_id = %L', v_u_mgr, v_eq1));
  v_esecuri := v_esecuri + pg_temp.verifica('2e', v_a like '42501:%' and v_b = 'ok:0',
    'managerul nu scrie valoarea: INSERT 42501, UPDATE zero rânduri', v_a || ' · ' || v_b);

  v_a := pg_temp.ruleaza(v_u_gest, format(
    'update public.equipment set denumire = %L where id = %L', 'Compresor cu șurub', v_eq2));
  v_b := pg_temp.ruleaza(v_u_gest, format(
    'update public.equipment set valoare_achizitie = 5 where id = %L', v_eq2));
  v_c := pg_temp.ruleaza(v_u_gest, format(
    $q$insert into public.equipment_costuri (organization_id, equipment_id, valoare_achizitie, created_by, updated_by)
       values (%L, %L, 5, %L, %L)$q$, v_org, v_eq2, v_u_gest, v_u_gest));
  v_esecuri := v_esecuri + pg_temp.verifica('2f',
    v_a = 'ok:1' and v_b like '42501:%' and v_c like '42501:%'
    and pg_temp.valoare(format('select count(*) from public.equipment_costuri where equipment_id = %L', v_eq2)) = 0,
    'gestionarul pe team editează echipamentul, dar nu valoarea (coloana veche și tabela nouă: 42501)',
    v_a || ' · ' || v_b || ' · ' || v_c);

  v_a := pg_temp.ruleaza(v_u_a, format(
    $q$insert into public.equipment (id, organization_id, cod, denumire, valoare_achizitie)
       values (%L, %L, 'Y1-FALS-1', 'Fals', 1) on conflict do nothing$q$, v_eqb, v_org));
  v_n := coalesce(
    pg_temp.valoare(format('select valoare_achizitie from public.equipment_costuri where equipment_id = %L', v_eqb)),
    pg_temp.valoare(format('select valoare_achizitie from public.equipment where id = %L', v_eqb)));
  v_esecuri := v_esecuri + pg_temp.verifica('2g', v_n = 30000,
    'upsert ignore-duplicates cu id-ul echipamentului firmei B: valoarea lui B rămâne 30000',
    'valoare B = ' || coalesce(v_n::text, 'null') || ' · ' || v_a);

  v_a := pg_temp.ruleaza(v_u_a, format(
    $q$insert into public.equipment (id, organization_id, cod, denumire, valoare_achizitie)
       values (%L, %L, 'Y1-FALS-2', 'Fals', 3) on conflict (id) do nothing$q$, v_eqb2, v_org));
  v_n := pg_temp.valoare(format('select count(*) from public.equipment_costuri where equipment_id = %L', v_eqb2));
  v_esecuri := v_esecuri + pg_temp.verifica('2h',
    coalesce(v_n, 0) = 0
    and pg_temp.valoare(format('select valoare_achizitie from public.equipment where id = %L', v_eqb2)) is null,
    'pe echipamentul lui B fără valoare nu apare niciun rând de cost',
    coalesce(v_n::text, 'null') || ' rânduri · ' || v_a);

  perform set_config('app.mentenanta_cost_mutat', 'on', true);
  v_a := pg_temp.ruleaza(v_u_a, format(
    $q$insert into public.equipment_costuri (organization_id, equipment_id, valoare_achizitie, created_by, updated_by)
       values (%L, %L, 9, %L, %L)$q$, v_org, v_eqb3, v_u_a, v_u_a));
  perform set_config('app.mentenanta_cost_mutat', '', true);
  v_esecuri := v_esecuri + pg_temp.verifica('2i',
    v_a like 'P0001:%'
    and pg_temp.valoare(format('select count(*) from public.equipment_costuri where equipment_id = %L', v_eqb3)) = 0,
    'cu steagul pus, rândul de cost pe echipamentul firmei B e refuzat', v_a);

  v_a := pg_temp.ruleaza(v_u_a, format(
    $q$insert into public.equipment (id, organization_id, cod, denumire, valoare_achizitie)
       values (%L, %L, 'Y1-NOU-' || %L, 'Generator', 70000)$q$, v_eq_nou, v_org, v_sufix));
  v_b := pg_temp.ruleaza(v_u_a, format(
    'update public.equipment set valoare_achizitie = 46000 where id = %L', v_eq1));
  v_esecuri := v_esecuri + pg_temp.verifica('2j',
    v_a = 'ok:1' and v_b = 'ok:1'
    and pg_temp.valoare(format('select valoare_achizitie from public.equipment_costuri where equipment_id = %L and organization_id = %L', v_eq_nou, v_org)) = 70000
    and pg_temp.valoare(format('select valoare_achizitie from public.equipment_costuri where equipment_id = %L', v_eq1)) = 46000
    and (select count(*) from public.equipment where id in (v_eq_nou, v_eq1) and valoare_achizitie is not null) = 0,
    'echipament nou și corectură prin coloana veche: rândul de cost al firmei, coloana goală',
    v_a || ' · ' || v_b);

  v_a := pg_temp.ruleaza(v_u_a, format(
    $q$insert into public.equipment_costuri (organization_id, equipment_id, valoare_achizitie, created_by, updated_by)
       values (%L, %L, 12000, %L, %L)
       on conflict (equipment_id) do update set valoare_achizitie = excluded.valoare_achizitie,
                                               updated_by = excluded.updated_by$q$, v_org, v_eq2, v_u_a, v_u_a));
  v_b := pg_temp.ruleaza(v_u_a, format(
    $q$insert into public.equipment_costuri (organization_id, equipment_id, valoare_achizitie, created_by, updated_by)
       values (%L, %L, null, %L, %L)
       on conflict (equipment_id) do update set valoare_achizitie = excluded.valoare_achizitie,
                                               updated_by = excluded.updated_by$q$, v_org, v_eq1, v_u_a, v_u_a));
  v_c := pg_temp.valoare(format('select valoare_achizitie from public.equipment_costuri where equipment_id = %L', v_eq2))::text;
  v_d := coalesce(pg_temp.valoare(format('select valoare_achizitie from public.equipment_costuri where equipment_id = %L', v_eq1))::text, 'null');
  v_esecuri := v_esecuri + pg_temp.verifica('2k',
    v_a = 'ok:1' and v_b = 'ok:1' and v_c = '12000.00' and v_d = 'null',
    'upsert pe equipment_costuri: valoare nouă, apoi golire cu null',
    v_a || ' · ' || v_b || ' · ' || coalesce(v_c, 'null') || ' · ' || v_d);

  -- (2l) Oracolul, ca la (1k): garda de firmă e prima în ec_inainte.
  v_a := pg_temp.ruleaza(v_u_a, format(
    $q$insert into public.equipment_costuri (organization_id, equipment_id, valoare_achizitie, created_by, updated_by)
       values (%L, %L, 1, %L, %L)$q$, v_org_b, v_eqb2, v_u_a, v_u_a));
  v_b := pg_temp.ruleaza(v_u_a, format(
    $q$insert into public.equipment_costuri (organization_id, equipment_id, valoare_achizitie, created_by, updated_by)
       values (%L, %L, 1, %L, %L)$q$, v_org_b, gen_random_uuid(), v_u_a, v_u_a));
  v_esecuri := v_esecuri + pg_temp.verifica('2l',
    v_a like '42501:%' and v_a = v_b,
    'rândul de cost pe firma B: id-ul real al echipamentului și cel inventat primesc același 42501',
    v_a || ' / ' || v_b);

  -- ═══ (3) Excepția intenționată: avantajul în natură (0225 §8) ═══════════════
  -- `avantaj_natura_flota` e a salarizării (`payroll:read = all`: org_admin și
  -- hr) și întoarce valoarea de intrare DOAR pentru vehiculele alocate angajatului
  -- cu folosință personală în luna cerută: e baza legală a avantajului (Codul
  -- fiscal art. 76 alin. (3) lit. j), nu o fereastră spre costurile parcului.
  -- Radu primește VA cu folosință personală și VA2 fără; VA2 are și ea valoare.
  -- `on conflict`: pe o formă defectă (1l-refuz) membrul C a lăsat deja un rând aici.
  insert into public.vehicle_costuri (organization_id, vehicle_id, valoare_achizitie, created_by, updated_by)
  values (v_org, v_va2, 90000, v_u_a, v_u_a)
  on conflict (vehicle_id) do update set valoare_achizitie = excluded.valoare_achizitie;
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, folosinta_personala,
                                          created_by, updated_by)
  values (v_org, v_va2, v_e_resp, now() - interval '2 hours', false, v_u_a, v_u_a),
         (v_org, v_va,  v_e_resp, now() - interval '1 hour',  true,  v_u_a, v_u_a);
  v_a := '';
  for v_b in select unnest(array['adm', 'hr', 'mgr', 'resp']) loop
    v_n := pg_temp.numara(case v_b when 'adm' then v_u_a when 'hr' then v_u_hr
                                   when 'mgr' then v_u_mgr else v_u_resp end,
      format('select 1 from public.avantaj_natura_flota(%L, %L, %L::date) where vehicle_id = %L and valoare_intrare = 45000',
             v_org, v_e_resp, v_zi, v_va));
    v_m := pg_temp.numara(case v_b when 'adm' then v_u_a when 'hr' then v_u_hr
                                   when 'mgr' then v_u_mgr else v_u_resp end,
      format('select 1 from public.avantaj_natura_flota(%L, %L, %L::date) where vehicle_id = %L', v_org, v_e_resp, v_zi, v_va2));
    v_a := v_a || v_b || '=' || v_n::text || '/' || v_m::text || ' ';
  end loop;
  v_esecuri := v_esecuri + pg_temp.verifica('3',
    v_a = 'adm=1/0 hr=1/0 mgr=0/0 resp=0/0 ',
    'avantaj_natura_flota: valoarea de intrare doar pe mașina cu folosință personală, doar pentru payroll:read = all',
    'personală/fără folosință personală: ' || v_a);

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA COSTURI COMPATIBILITATE: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE verificările au trecut.';
  raise notice '';
end;
$$;

rollback;
