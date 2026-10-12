-- tests/rls/proba-planuri.sql
--
-- PLANURILE ȘI SCADENȚELE LOR (0183): MODUL DE CALCUL, AMÂNAREA, EXECUȚIA.
--
-- Ce verifică, pe rând:
--  (1) flotant: scadența = ultima execuție + periodicitate                [POZITIVĂ]
--  (2) fix: grila de la ancoră, avansată peste ultima execuție și ≥ azi,
--      fără instanțe restante; ancora în viitor rămâne ancora              [POZITIVĂ]
--  (3) amânarea bate calculul și se numără; fără motiv e refuzată (23514)
--  (4) execuția reușită șterge amânarea; contorul de amânări rămâne        [POZITIVĂ]
--  (5) amânarea pe un plan doar pe contor → P0001
--  (6) o amânare mai veche decât calculul e inertă
--  (7) flotant FĂRĂ execuție, creat demult și depășit, amânat cu 7 zile →
--      scadența e exact azi + 7 (nu azi + periodicitate)                   [POZITIVĂ]
--  (8) planul amânat trecut DOAR pe contor: amânarea se curăță, fără P0001  [POZITIVĂ]
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org      uuid := gen_random_uuid();
  v_echip    uuid := gen_random_uuid();
  v_flotant  uuid := gen_random_uuid();
  v_fix      uuid := gen_random_uuid();
  v_contor   uuid := gen_random_uuid();
  v_vechi    uuid := gen_random_uuid();
  v_azi      date := app.azi_local();
  v_data     date;
  v_n        integer;
  v_esecuri  int := 0;
begin
  raise notice '';
  raise notice '  PROBA „PLANURI ȘI SCADENȚE" (0183)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-pln-' || v_sufix, 'Proba Planuri SRL', 'RO' || (86000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select v_org, f.feature_key, true, now() from public.features f;
  insert into public.equipment (id, organization_id, cod, denumire) values (v_echip, v_org, 'GEN-' || v_sufix, 'Generator');
  insert into public.equipment_meters (organization_id, equipment_id, tip, citire, data_citirii)
  values (v_org, v_echip, 'ore', 100, v_azi - 1);

  -- ═══ (1) Flotant ═════════════════════════════════════════════════════════
  insert into public.maintenance_plans (id, organization_id, equipment_id, denumire, periodicitate_zile, ultima_executie)
  values (v_flotant, v_org, v_echip, 'Schimb filtre', 30, v_azi - 10);
  select urmatoarea_scadenta into v_data from public.maintenance_plans where id = v_flotant;
  if v_data = v_azi + 20 then
    raise notice '  ✓ (1) flotant: ultima execuție + 30 zile';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) scadența flotantă e %, așteptat %', v_data, v_azi + 20;
  end if;

  -- ═══ (2) Fix: grilă de la ancoră ════════════════════════════════════════
  -- Ancora acum 100 de zile, pas 30, ultima execuție acum 5 zile (întârziată):
  -- grila: -100, -70, -40, -10, +20 → prima ≥ azi și > ultima execuție e +20.
  insert into public.maintenance_plans (id, organization_id, equipment_id, denumire, periodicitate_zile, mod_calcul, data_ancora, ultima_executie)
  values (v_fix, v_org, v_echip, 'Verificare lunară pe grilă', 30, 'fix', v_azi - 100, v_azi - 5);
  select urmatoarea_scadenta into v_data from public.maintenance_plans where id = v_fix;
  if v_data = v_azi + 20 then
    raise notice '  ✓ (2) fix: grila sare peste instanțele restante, la prima dată ≥ azi';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) scadența fixă e %, așteptat %', v_data, v_azi + 20;
  end if;
  -- Ancora în viitor rămâne ancora.
  update public.maintenance_plans set data_ancora = v_azi + 45, ultima_executie = null where id = v_fix;
  select urmatoarea_scadenta into v_data from public.maintenance_plans where id = v_fix;
  if v_data = v_azi + 45 then
    raise notice '  ✓ (2) ancora în viitor e prima scadență';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) cu ancora în viitor scadența e %, așteptat %', v_data, v_azi + 45;
  end if;

  -- ═══ (3) Amânarea ════════════════════════════════════════════════════════
  begin
    update public.maintenance_plans set amanat_pana = v_azi + 60 where id = v_flotant;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) amânarea fără motiv a trecut';
  exception when check_violation then
    raise notice '  ✓ (3) amânarea fără motiv e refuzată (23514)';
  end;
  update public.maintenance_plans set amanat_pana = v_azi + 60, motiv_amanare = 'Piesele vin abia luna viitoare.' where id = v_flotant;
  select urmatoarea_scadenta, numar_amanari into v_data, v_n from public.maintenance_plans where id = v_flotant;
  if v_data = v_azi + 60 and v_n = 1 then
    raise notice '  ✓ (3) amânarea bate calculul (%) și se numără (1)', v_data;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) după amânare: scadența %, amânări %', v_data, v_n;
  end if;

  -- ═══ (4) Execuția reușită șterge amânarea ════════════════════════════════
  insert into public.maintenance_interventions (organization_id, plan_id, equipment_id, data, descriere, rezultat)
  values (v_org, v_flotant, v_echip, v_azi, 'Filtre schimbate.', 'reusita');
  select urmatoarea_scadenta, numar_amanari into v_data, v_n from public.maintenance_plans where id = v_flotant;
  if v_data = v_azi + 30 and v_n = 1
     and (select amanat_pana is null and motiv_amanare is null from public.maintenance_plans where id = v_flotant) then
    raise notice '  ✓ (4) execuția șterge amânarea; scadența revine la azi + 30; contorul de amânări rămâne';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) după execuție: scadența %, amânări %', v_data, v_n;
  end if;

  -- ═══ (5) Amânarea unui plan doar pe contor ═══════════════════════════════
  insert into public.maintenance_plans (id, organization_id, equipment_id, denumire, periodicitate_contor, tip_contor)
  values (v_contor, v_org, v_echip, 'Schimb ulei la 500 h', 500, 'ore');
  begin
    update public.maintenance_plans set amanat_pana = v_azi + 10, motiv_amanare = 'Nu se poate.' where id = v_contor;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) amânarea unui plan doar pe contor a trecut';
  exception when raise_exception then
    raise notice '  ✓ (5) un plan doar pe contor nu se amână (P0001)';
  end;

  -- ═══ (6) Amânare mai veche decât calculul: inertă ════════════════════════
  update public.maintenance_plans set amanat_pana = v_azi + 5, motiv_amanare = 'Amânare scurtă.' where id = v_flotant;
  select urmatoarea_scadenta into v_data from public.maintenance_plans where id = v_flotant;
  if v_data = v_azi + 30 then
    raise notice '  ✓ (6) o amânare înaintea scadenței calculate nu o mută';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) scadența a devenit %, așteptat %', v_data, v_azi + 30;
  end if;

  -- ═══ (7) Flotant neexecutat, creat demult: amânarea e cea cerută ═════════
  -- Plan anual creat acum 400 de zile, fără nicio execuție: scadența calculată
  -- e creare + 365 = azi − 35 (depășit). Amânat cu 7 zile → azi + 7. Înainte de
  -- reparație calculul pornea din ziua amânării și dădea azi + 365.
  insert into public.maintenance_plans (id, organization_id, equipment_id, denumire, periodicitate_zile, created_at)
  values (v_vechi, v_org, v_echip, 'Verificare anuală neexecutată', 365, now() - interval '400 days');
  select urmatoarea_scadenta into v_data from public.maintenance_plans where id = v_vechi;
  if v_data <> v_azi - 35 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) scadența planului neexecutat e %, așteptat % (creare + 365)', v_data, v_azi - 35;
  end if;
  update public.maintenance_plans set amanat_pana = v_azi + 7, motiv_amanare = 'Piesa vine săptămâna viitoare.' where id = v_vechi;
  select urmatoarea_scadenta, numar_amanari into v_data, v_n from public.maintenance_plans where id = v_vechi;
  if v_data = v_azi + 7 and v_n = 1 then
    raise notice '  ✓ (7) planul neexecutat amânat cu 7 zile e scadent peste 7 zile, nu peste un an';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) după amânare scadența e % (amânări %), așteptat % și 1', v_data, v_n, v_azi + 7;
  end if;

  -- ═══ (8) Amânat → doar pe contor: amânarea se curăță, editarea nu e refuzată
  update public.maintenance_plans
     set periodicitate_zile = null, periodicitate_contor = 500, tip_contor = 'ore'
   where id = v_vechi;
  select urmatoarea_scadenta into v_data from public.maintenance_plans where id = v_vechi;
  if v_data is null
     and (select amanat_pana from public.maintenance_plans where id = v_vechi) is null
     and (select numar_amanari from public.maintenance_plans where id = v_vechi) = 1 then
    raise notice '  ✓ (8) trecut doar pe contor: amânarea s-a curățat, contorul de amânări rămâne';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) planul doar pe contor a păstrat scadența % sau amânarea', v_data;
  end if;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'Proba planurilor: % verificări picate.', v_esecuri;
  end if;
  raise notice '  Toate verificările au trecut.';
end $$;
