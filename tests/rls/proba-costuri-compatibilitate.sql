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
--      stricat (golire fără mutare, ca pe orice id existent).
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
  v_a       text;
  v_b       text;
  v_n       numeric;
  v_m       bigint;
  v_esecuri int := 0;
begin
  raise notice '';
  raise notice '  PROBA „COSTURI: COMPATIBILITATE ÎNTRE FIRME” (Y1: 0225)';
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

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA COSTURI COMPATIBILITATE: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE verificările au trecut.';
  raise notice '';
end;
$$;

rollback;
