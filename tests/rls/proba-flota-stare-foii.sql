-- tests/rls/proba-flota-stare-foii.sql
--
-- FLOTA, 0197 §D: PARITATEA STĂRII ÎNTRE FOAIE ȘI COPIII EI, ȘI ȘTERGEREA
-- IREVERSIBILĂ. Cele două defecte rămase din 0196, semnalate de revizia
-- automată de securitate pe 20776502 (§C4).
--
-- ── CE ERA DESCHIS ──────────────────────────────────────────────────────────
-- (D1) TOCTOU: pe o foaie TRIMISĂ, scriitorul își schimba alimentările direct
--      prin PostgREST (litri, cost, ștergere), iar `org_admin` (update = all)
--      și kilometrii antetului. Aprobatorul aproba alte cifre decât cele
--      văzute. Pe o foaie RESPINSĂ, șoferul o rescria fără s-o readucă în
--      ciornă.
-- (D2) Stornarea mergea în ambele sensuri: `org_admin` readucea `deleted_at`
--      la null pe foaia aprobată stornată, fără niciun validator.
--
-- Proba NU folosește tabelele noi din 0197 (`trip_sheet_curse`), ca să poată
-- rula și peste 0196: acolo trebuie să pice (2)–(7) și (9). Cursele au proba
-- lor, `proba-flota-foaia-zilnica.sql`.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- Refuzuri (P0001):
--  (1) șoferul NU coboară km pe foaia proprie trimisă;
--  (2) NU adaugă o alimentare pe foaia trimisă;
--  (3) NU modifică litrii alimentării de pe foaia trimisă;
--  (4) NU șterge logic alimentarea de pe foaia trimisă;
--  (5) nici `org_admin` NU schimbă kilometrajul foii trimise;
--  (6) nici `org_admin` NU șterge logic o foaie trimisă (se retrage întâi);
--  (7) șoferul NU rescrie foaia respinsă fără s-o redeschidă;
--  (8) NU adaugă o alimentare pe foaia respinsă;
--  (9) `org_admin` NU reînvie foaia aprobată stornată;
--  (10) retragerea trimis → draft NU strecoară altă coloană.
-- Scrieri legitime (rânduri NUMĂRATE):
--  (11) șoferul își retrage foaia trimisă în ciornă;
--  (12) pe ciornă adaugă alimentarea și corectează km;
--  (13) regresul pus pe ciornă cade la retrimitere, apoi foaia corectată trece;
--  (14) managerul aprobă foaia subordonatei;
--  (15) `org_admin` o stornează (update = all);
--  (16) managerul respinge, șoferul redeschide respins → draft.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org      uuid := gen_random_uuid();
  v_u_admin  uuid := gen_random_uuid();
  v_u_mgr    uuid := gen_random_uuid();
  v_u_a      uuid := gen_random_uuid();
  v_e_mgr    uuid := gen_random_uuid();
  v_e_a      uuid := gen_random_uuid();
  v_v_a      uuid := gen_random_uuid();
  v_trimisa  uuid := gen_random_uuid();
  v_respinsa uuid := gen_random_uuid();
  v_aprobata uuid := gen_random_uuid();
  v_alim     uuid := gen_random_uuid();
  v_n        int;
  v_status   text;
  v_litri    numeric;
  v_km       int;
  v_esecuri  int := 0;
begin
  raise notice '';
  raise notice '  PROBA „FLOTA — STAREA FOII ȘI A COPIILOR" (0197 §D)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-flota-stare-' || v_sufix, 'Proba Stare Foaie SRL',
     'RO' || (84000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select v_org, f.feature_key, true, now() from public.features f;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_admin, 'st-adm-' || v_sufix || '@proba.test', now()),
    (v_u_mgr,   'st-mgr-' || v_sufix || '@proba.test', now()),
    (v_u_a,     'st-a-'   || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_admin, 'org_admin'),
    (v_org, v_u_mgr,   'manager'),
    (v_org, v_u_a,     'employee');
  -- Administratorul primește fișa lui la aderare (`membru_creeaza_fisa_de_angajat`).
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_mgr, v_org, 'ST-M', 'Mihai', 'Manager', app.azi_local() - 500, 'activ', v_u_mgr, null);
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_a,   v_org, 'ST-A', 'Ana',   'Șofer',   app.azi_local() - 400, 'activ', v_u_a,   v_e_mgr);

  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent,
                               created_by, updated_by) values
    (v_v_a, v_org, 'B' || (100 + (random() * 800)::int)::text || 'STA', 'Dacia', 'Logan', 10000, v_u_admin, v_u_admin);
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, created_by, updated_by)
  values (v_org, v_v_a, v_e_a, now() - interval '30 days', v_u_admin, v_u_admin);

  -- Foile Anei, scrise din contextul de serviciu, pe zile diferite (din 0197:
  -- o foaie activă pe vehicul și zi). Toate fără curse, în forma antetului.
  insert into public.trip_sheets (id, organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                  sosire_la, km_sosire, status, motiv_respingere, created_by, updated_by) values
    (v_aprobata, v_org, v_v_a, v_e_a, now() - interval '10 days', 10000,
     now() - interval '10 days' + interval '2 hours', 10100, 'aprobat', null, v_u_a, v_u_a),
    (v_trimisa,  v_org, v_v_a, v_e_a, now() - interval '6 days',  10100,
     now() - interval '6 days' + interval '2 hours',  10180, 'trimis', null, v_u_a, v_u_a),
    (v_respinsa, v_org, v_v_a, v_e_a, now() - interval '4 days',  10180,
     now() - interval '4 days' + interval '2 hours',  10250, 'respins', 'Lipsește scopul.', v_u_a, v_u_a);
  -- Aprobarea scrisă din serviciu nu ridică `km_curent`: îl pun aici, ca
  -- verificarea de regres să aibă un prag real.
  update public.vehicles set km_curent = 10100 where id = v_v_a;
  insert into public.fuel_entries (id, organization_id, trip_sheet_id, litri, cost, alimentat_la,
                                   created_by, updated_by)
  values (v_alim, v_org, v_trimisa, 30, 210, now() - interval '6 days' + interval '1 hour', v_u_a, v_u_a);

  -- ═══ D1: foaia TRIMISĂ și copiii ei ═══════════════════════════════════════

  -- (1)
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set km_plecare = 9000, updated_by = v_u_a where id = v_trimisa;
    get diagnostics v_n = row_count;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) șoferul a coborât km pe foaia trimisă (% rânduri)', v_n;
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Foaia de parcurs este trimisă%' then
      raise notice '  ✓ (1) foaia trimisă nu-și schimbă kilometrajul sub șofer (P0001)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (1) refuzat din alt motiv: %', sqlerrm;
    end if;
  end;

  -- (2)
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la,
                                     created_by, updated_by)
    values (v_org, v_trimisa, 80, 560, now() - interval '6 days' + interval '90 minutes', v_u_a, v_u_a);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) șoferul a adăugat o alimentare pe foaia trimisă';
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Alimentările se modifică doar%' then
      raise notice '  ✓ (2) pe foaia trimisă nu se adaugă alimentări (P0001)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (2) refuzat din alt motiv: %', sqlerrm;
    end if;
  end;

  -- (3)
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.fuel_entries set litri = 3, updated_by = v_u_a where id = v_alim;
    get diagnostics v_n = row_count;
    reset role;
    select litri into v_litri from public.fuel_entries where id = v_alim;
    if v_n = 0 and v_litri = 30 then
      raise notice '  ✓ (3) litrii alimentării de pe foaia trimisă rămân (zero rânduri)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (3) litrii alimentării de pe foaia trimisă au devenit % (% rânduri)', v_litri, v_n;
    end if;
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Alimentările se modifică doar%' then
      raise notice '  ✓ (3) alimentarea foii trimise nu se modifică (P0001)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (3) refuzat din alt motiv: %', sqlerrm;
    end if;
  end;

  -- (4)
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.fuel_entries set deleted_at = now(), updated_by = v_u_a where id = v_alim;
    get diagnostics v_n = row_count;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) șoferul a șters alimentarea foii trimise (% rânduri)', v_n;
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Alimentările se modifică doar%' then
      raise notice '  ✓ (4) alimentarea foii trimise nu se șterge (P0001)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (4) refuzat din alt motiv: %', sqlerrm;
    end if;
  end;

  -- (5)
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set km_sosire = 10900, updated_by = v_u_admin where id = v_trimisa;
    get diagnostics v_n = row_count;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) administratorul a umflat sosirea foii trimise (% rânduri)', v_n;
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Foaia de parcurs este trimisă%' then
      raise notice '  ✓ (5) nici administratorul nu rescrie foaia trimisă (P0001)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (5) refuzat din alt motiv: %', sqlerrm;
    end if;
  end;

  -- (6)
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set deleted_at = now(), updated_by = v_u_admin where id = v_trimisa;
    get diagnostics v_n = row_count;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) administratorul a șters logic o foaie aflată în aprobare (% rânduri)', v_n;
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Foaia de parcurs este trimisă%' then
      raise notice '  ✓ (6) foaia trimisă nu se șterge, se retrage întâi (P0001)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (6) refuzat din alt motiv: %', sqlerrm;
    end if;
  end;

  -- (10)
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set status = 'draft', km_sosire = 10950, updated_by = v_u_a where id = v_trimisa;
    get diagnostics v_n = row_count;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10) retragerea a strecurat un kilometraj nou (% rânduri)', v_n;
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Foaia de parcurs este trimisă%' then
      raise notice '  ✓ (10) retragerea în ciornă nu schimbă altă coloană (P0001)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (10) refuzat din alt motiv: %', sqlerrm;
    end if;
  end;

  -- ═══ D1: foaia RESPINSĂ ═══════════════════════════════════════════════════

  -- (7)
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set km_sosire = 10260, observatii = 'Corectat pe respinsă.', updated_by = v_u_a
     where id = v_respinsa;
    get diagnostics v_n = row_count;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) șoferul a rescris foaia respinsă fără s-o redeschidă (% rânduri)', v_n;
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Foaia de parcurs este respinsă%' then
      raise notice '  ✓ (7) foaia respinsă se corectează abia în ciornă (P0001)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (7) refuzat din alt motiv: %', sqlerrm;
    end if;
  end;

  -- (8)
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la,
                                     created_by, updated_by)
    values (v_org, v_respinsa, 20, 140, now() - interval '4 days' + interval '1 hour', v_u_a, v_u_a);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) șoferul a alimentat pe foaia respinsă';
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Alimentările se modifică doar%' then
      raise notice '  ✓ (8) pe foaia respinsă nu se adaugă alimentări (P0001)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (8) refuzat din alt motiv: %', sqlerrm;
    end if;
  end;

  -- ═══ Scrieri legitime ═════════════════════════════════════════════════════

  -- (11)
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set status = 'draft', updated_by = v_u_a where id = v_trimisa;
    get diagnostics v_n = row_count;
    reset role;
    select status into v_status from public.trip_sheets where id = v_trimisa;
    if v_n = 1 and v_status = 'draft' then
      raise notice '  ✓ (11) șoferul își retrage foaia trimisă în ciornă (1 rând)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (11) retragerea: % rânduri, stare %', v_n, v_status;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (11) șoferul nu-și poate retrage foaia: % (%)', sqlerrm, sqlstate;
  end;

  -- (12)
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    with inserate as (
      insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la,
                                       created_by, updated_by)
      values (v_org, v_trimisa, 12, 84, now() - interval '6 days' + interval '30 minutes', v_u_a, v_u_a)
      returning 1
    ) select count(*) into v_n from inserate;
    update public.fuel_entries set litri = 31, updated_by = v_u_a where id = v_alim;
    get diagnostics v_km = row_count;
    reset role;
    if v_n = 1 and v_km = 1 then
      raise notice '  ✓ (12) pe ciornă alimentarea se adaugă și se corectează (1 + 1 rânduri)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (12) pe ciornă: % alimentări adăugate, % corectate', v_n, v_km;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (12) alimentarea pe ciornă: % (%)', sqlerrm, sqlstate;
  end;

  -- (13) regresul pus pe ciornă cade la retrimitere; corectat, trece.
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set km_plecare = 10050, updated_by = v_u_a where id = v_trimisa;
    update public.trip_sheets set status = 'trimis', updated_by = v_u_a where id = v_trimisa;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (13) foaia cu regres de kilometraj a fost retrimisă';
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Kilometrajul de plecare (%' then
      raise notice '  ✓ (13a) regresul pus pe ciornă cade la retrimitere (P0001)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (13a) refuzat din alt motiv: %', sqlerrm;
    end if;
  end;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set km_plecare = 10100, updated_by = v_u_a where id = v_trimisa;
    -- Revizia F4: foaia se trimite doar cu cursele ei. Cursa repetă antetul,
    -- deci agregatele nu schimbă nimic din ce verifică proba.
    insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la,
                                         de_la_loc, pana_la_loc, scop, km_plecare, km_sosire,
                                         created_by, updated_by)
    values (v_org, v_trimisa, now() - interval '6 days', now() - interval '6 days' + interval '2 hours',
            'Sediu', 'Client', 'Livrare', 10100, 10180, v_u_a, v_u_a);
    update public.trip_sheets set status = 'trimis', updated_by = v_u_a where id = v_trimisa;
    get diagnostics v_n = row_count;
    reset role;
    select status into v_status from public.trip_sheets where id = v_trimisa;
    if v_n = 1 and v_status = 'trimis' then
      raise notice '  ✓ (13b) foaia corectată se retrimite (1 rând)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (13b) retrimiterea: % rânduri, stare %', v_n, v_status;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (13b) retrimiterea foii corectate: % (%)', sqlerrm, sqlstate;
  end;

  -- (14)
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set status = 'aprobat', updated_by = v_u_mgr where id = v_trimisa;
    get diagnostics v_n = row_count;
    reset role;
    select status into v_status from public.trip_sheets where id = v_trimisa;
    if v_n = 1 and v_status = 'aprobat' then
      raise notice '  ✓ (14) managerul aprobă foaia subordonatei (1 rând)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (14) aprobarea: % rânduri, stare %', v_n, v_status;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (14) managerul nu aprobă: % (%)', sqlerrm, sqlstate;
  end;

  -- (15)
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set deleted_at = now(), updated_by = v_u_admin where id = v_aprobata;
    get diagnostics v_n = row_count;
    reset role;
    if v_n = 1 then
      raise notice '  ✓ (15) administratorul stornează foaia aprobată (1 rând)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (15) stornarea: % rânduri', v_n;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (15) administratorul nu poate storna: % (%)', sqlerrm, sqlstate;
  end;

  -- (9) D2: stornarea e ireversibilă.
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set deleted_at = null, updated_by = v_u_admin where id = v_aprobata;
    get diagnostics v_n = row_count;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) administratorul a reînviat foaia stornată (% rânduri)', v_n;
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Foaia de parcurs a fost ștearsă%' then
      raise notice '  ✓ (9) foaia stornată nu se reînvie, nici de administrator (P0001)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (9) refuzat din alt motiv: %', sqlerrm;
    end if;
  end;

  -- (16)
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set status = 'draft', updated_by = v_u_a where id = v_respinsa;
    get diagnostics v_n = row_count;
    reset role;
    select status into v_status from public.trip_sheets where id = v_respinsa;
    if v_n = 1 and v_status = 'draft' then
      raise notice '  ✓ (16) șoferul redeschide foaia respinsă în ciornă (1 rând)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (16) redeschiderea: % rânduri, stare %', v_n, v_status;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (16) șoferul nu-și poate redeschide foaia: % (%)', sqlerrm, sqlstate;
  end;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA FLOTA STARE: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE cele 17 verificări au trecut.';
  raise notice '';
end;
$$;
