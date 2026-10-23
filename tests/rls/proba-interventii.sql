-- tests/rls/proba-interventii.sql
--
-- INTERVENȚIILE COMPLETE (0210): NUMĂR, PIESE, GARDA, PLANUL, OPRIREA, FIȘIERUL.
--
-- ── DE CE EXISTĂ FIȘIERUL ───────────────────────────────────────────────────
-- Cine poate scrie ce se AFLĂ rulând, nu deducând. Jumătate din verificări sunt
-- POZITIVE: un administrator care nu-și poate corecta intervenția arată, din
-- afară, ca o pană, nu ca o regulă.
--
-- ── CE VERIFICĂ, PE RÂND ────────────────────────────────────────────────────
--  (1) numărul `PV-AAAA-0001`, apoi `-0002`; numărul trimis de client e
--      ignorat la INSERT și la UPDATE                                  [POZITIVĂ]
--  (2) o dată cu an absurd nu oprește inserarea: numărul ia anul de azi  [POZITIVĂ]
--  (3) liniile de piese câștigă peste suma tastată; ultima linie ștearsă
--      lasă 0; managerul nu poate adăuga piese (42501)                 [POZITIVĂ]
--  (4) garda: echipamentul nu se schimbă, intervenția anulată nu se
--      reactivează (P0001)
--  (5) anularea: refuzată cu numărul sesizării când a rezolvat-o; permisă
--      după redeschidere; refuzată definitiv când sesizarea e închisă   [POZITIVĂ]
--  (6) editarea datei recalculează planul FĂRĂ să-i șteargă amânarea; o
--      editare a descrierii nu atinge planul                           [POZITIVĂ]
--  (7) oprirea intervenției planificate urmează editarea; 0 o anulează  [POZITIVĂ]
--  (8) poarta bucketului: un id de intervenție nefolosit e rezervare pentru
--      administrator, nu pentru manager; id-ul altei firme nu e rezervare
--  (9) registrul înregistrează procesul-verbal la INSERT (`pv_interventie`)
-- (11) `INSERT … ON CONFLICT` pe id-ul unei intervenții existente (a altei
--      firme, proprie, upsert): 23505, nimic inserat sau modificat, contorul
--      PV neatins; următoarea intervenție reală ia numărul următor [POZITIVĂ]
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org      uuid := gen_random_uuid();
  v_org2     uuid := gen_random_uuid();
  v_u_adm    uuid := gen_random_uuid();
  v_u_mgr    uuid := gen_random_uuid();
  v_e_adm    uuid := gen_random_uuid();
  v_e_mgr    uuid := gen_random_uuid();
  v_echip    uuid := gen_random_uuid();
  v_echip2   uuid := gen_random_uuid();
  v_echip_b  uuid := gen_random_uuid();
  v_echip11  uuid := gen_random_uuid();
  v_seq      integer;
  v_plan     uuid := gen_random_uuid();
  v_i1       uuid;
  v_i2       uuid;
  v_i3       uuid;
  v_i_b      uuid;
  v_piesa    uuid;
  v_sz       uuid := gen_random_uuid();
  v_azi      date := app.azi_local();
  v_an       text := extract(year from app.azi_local())::text;
  v_numar    text;
  v_cost     numeric;
  v_data     date;
  v_ts       timestamptz;
  v_n        integer;
  v_bool     boolean;
  v_text     text;
  v_esecuri  int := 0;
begin
  raise notice '';
  raise notice '  PROBA „INTERVENȚII COMPLETE" (0210)';
  raise notice '  ─────────────────────────────────────────────────────────';

  -- ── fixture ───────────────────────────────────────────────────────────────
  insert into public.organizations (id, slug, name, cui) values
    (v_org,  'proba-int-'  || v_sufix, 'Proba Intervenții SRL', 'RO' || (88000000 + (random() * 900000)::int)::text),
    (v_org2, 'proba-intb-' || v_sufix, 'Proba Intervenții B SRL', 'RO' || (89000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select o, f.feature_key, true, now() from public.features f, unnest(array[v_org, v_org2]) o;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_adm, 'int-adm-' || v_sufix || '@proba.test', now()),
    (v_u_mgr, 'int-mgr-' || v_sufix || '@proba.test', now());
  insert into public.employees (id, organization_id, marca, first_name, last_name, hired_on, status, user_id) values
    (v_e_adm, v_org, 'IN-A', 'Ana',   'Admin',   v_azi - 900, 'activ', v_u_adm),
    (v_e_mgr, v_org, 'IN-M', 'Marin', 'Manager', v_azi - 800, 'activ', v_u_mgr);
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_adm, 'org_admin'),
    (v_org, v_u_mgr, 'manager');

  insert into public.equipment (id, organization_id, cod, denumire) values
    (v_echip,   v_org,  'CMP-' || v_sufix, 'Compresor'),
    (v_echip2,  v_org,  'PMP-' || v_sufix, 'Pompă'),
    (v_echip_b, v_org2, 'CMB-' || v_sufix, 'Compresor B');
  insert into public.maintenance_plans (id, organization_id, equipment_id, denumire, periodicitate_zile)
  values (v_plan, v_org, v_echip, 'Revizie lunară', 30);

  -- ═══ (1) Numărul [POZITIVĂ] ══════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  insert into public.maintenance_interventions (organization_id, equipment_id, data, descriere, executant_employee_id, numar)
  values (v_org, v_echip, v_azi - 2, 'Prima intervenție.', v_e_adm, 'PV-1999-0042') returning id, numar into v_i1, v_numar;
  insert into public.maintenance_interventions (organization_id, equipment_id, data, descriere, executant_extern)
  values (v_org, v_echip, v_azi - 1, 'A doua intervenție.', 'Service Extern SRL') returning id into v_i2;
  reset role;
  if v_numar = 'PV-' || v_an || '-0001'
     and (select numar from public.maintenance_interventions where id = v_i2) = 'PV-' || v_an || '-0002' then
    raise notice '  ✓ (1) PV-%-0001, apoi -0002; numărul trimis de client e ignorat', v_an;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) numerele sunt % și %', v_numar, (select numar from public.maintenance_interventions where id = v_i2);
  end if;
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  update public.maintenance_interventions set numar = 'PV-2000-0001' where id = v_i1;
  reset role;
  if (select numar from public.maintenance_interventions where id = v_i1) = v_numar then
    raise notice '  ✓ (1) numărul nu se schimbă prin editare';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) numărul a devenit %', (select numar from public.maintenance_interventions where id = v_i1);
  end if;

  -- ═══ (2) An absurd [POZITIVĂ] ════════════════════════════════════════════
  begin
    insert into public.maintenance_interventions (organization_id, equipment_id, data, descriere)
    values (v_org, v_echip2, date '0006-03-01', 'Dată tastată greșit.') returning numar into v_text;
    if v_text like 'PV-' || v_an || '-%' then
      raise notice '  ✓ (2) anul „6" nu oprește inserarea: numărul e %', v_text;
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (2) numărul pe anul absurd e %', v_text;
    end if;
  exception when others then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) data cu an absurd a oprit inserarea: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (3) Liniile de piese [POZITIVĂ] ═════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  update public.maintenance_interventions set cost_piese = 999 where id = v_i1;
  insert into public.maintenance_intervention_parts (organization_id, intervention_id, denumire, cod, cantitate, unitate, pret_unitar)
  values (v_org, v_i1, 'Filtru aer', 'FA-1', 2, 'buc', 37.50) returning id into v_piesa;
  insert into public.maintenance_intervention_parts (organization_id, intervention_id, denumire, cantitate, unitate, pret_unitar)
  values (v_org, v_i1, 'Ulei compresor', 1.5, 'l', 40);
  update public.maintenance_interventions set cost_piese = 5 where id = v_i1;
  reset role;
  select cost_piese into v_cost from public.maintenance_interventions where id = v_i1;
  if v_cost = 135 then
    raise notice '  ✓ (3) liniile (2 × 37,50 + 1,5 × 40 = 135) câștigă peste suma tastată';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) cost_piese = %, așteptat 135', v_cost;
  end if;
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  update public.maintenance_intervention_parts set deleted_at = now()
   where intervention_id = v_i1 and deleted_at is null;
  reset role;
  select cost_piese into v_cost from public.maintenance_interventions where id = v_i1;
  if v_cost = 0 then
    raise notice '  ✓ (3) fără nicio linie vie, cost_piese = 0';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) după ștergerea liniilor cost_piese = %', v_cost;
  end if;
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    insert into public.maintenance_intervention_parts (organization_id, intervention_id, denumire, cantitate)
    values (v_org, v_i1, 'Piesa managerului', 1);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) managerul a adăugat o linie de piese';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (3) managerul nu poate adăuga piese (42501)';
  end;

  -- ═══ (4) Garda ═══════════════════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  begin
    update public.maintenance_interventions set equipment_id = v_echip2 where id = v_i2;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) echipamentul intervenției s-a schimbat';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (4) echipamentul nu se schimbă prin editare (P0001)';
  end;

  -- ═══ (5) Anularea și sesizarea ═══════════════════════════════════════════
  -- Fixture-ul sesizării se scrie ca serviciu: drumul raportor → tehnician e
  -- verificat de `proba-sesizari-roluri.sql`; aici contează doar legătura.
  insert into public.fault_reports (id, organization_id, equipment_id, raportat_de_employee_id, descriere)
  values (v_sz, v_org, v_echip, v_e_mgr, 'Compresorul nu pornește dimineața.');
  update public.fault_reports set atribuit_employee_id = v_e_adm, status = 'in_lucru' where id = v_sz;
  insert into public.maintenance_interventions (organization_id, equipment_id, fault_report_id, data, descriere, executant_employee_id)
  values (v_org, v_echip, v_sz, v_azi, 'Releu înlocuit.', v_e_adm) returning id into v_i3;
  update public.fault_reports set status = 'rezolvat', intervention_id = v_i3 where id = v_sz;
  select numar into v_numar from public.fault_reports where id = v_sz;

  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  begin
    update public.maintenance_interventions set deleted_at = now() where id = v_i3;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) intervenția care a rezolvat sesizarea s-a anulat';
  exception when raise_exception then
    reset role;
    if sqlerrm like '%Redeschideți întâi sesizarea ' || v_numar || '%' then
      raise notice '  ✓ (5) anularea e refuzată cu numărul sesizării (%)', v_numar;
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (5) mesajul refuzului nu numește sesizarea: %', sqlerrm;
    end if;
  end;

  -- Redeschiderea dezleagă intervenția → anularea trece.
  update public.fault_reports set status = 'in_lucru', motiv_redeschidere = 'Nu pornește nici azi.' where id = v_sz;
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  with m as (update public.maintenance_interventions set deleted_at = now()
              where id = v_i3 and deleted_at is null returning 1)
  select count(*) into v_n from m;
  reset role;
  if v_n = 1 then
    raise notice '  ✓ (5) după redeschiderea sesizării, intervenția se anulează';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) după redeschidere anularea a atins % rânduri', v_n;
  end if;
  -- …dar nu se mai reactivează.
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  begin
    update public.maintenance_interventions set deleted_at = null where id = v_i3;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) intervenția anulată s-a reactivat';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (4) intervenția anulată nu se reactivează (P0001)';
  end;

  -- Rezolvată din nou și închisă: anularea e refuzată definitiv.
  insert into public.maintenance_interventions (organization_id, equipment_id, fault_report_id, data, descriere, executant_employee_id)
  values (v_org, v_echip, v_sz, v_azi, 'Presostat înlocuit.', v_e_adm) returning id into v_i3;
  update public.fault_reports set status = 'rezolvat', intervention_id = v_i3 where id = v_sz;
  update public.fault_reports set status = 'inchis' where id = v_sz;
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  begin
    update public.maintenance_interventions set deleted_at = now() where id = v_i3;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) intervenția unei sesizări închise s-a anulat';
  exception when raise_exception then
    reset role;
    if sqlerrm like '%deja închisă%' then
      raise notice '  ✓ (5) sesizarea închisă își păstrează intervenția (P0001)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (5) mesaj neașteptat: %', sqlerrm;
    end if;
  end;

  -- ═══ (6) Planul urmează editarea, fără să-și piardă amânarea [POZITIVĂ] ═══
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  insert into public.maintenance_interventions (organization_id, plan_id, equipment_id, data, descriere, executant_employee_id, rezultat)
  values (v_org, v_plan, v_echip, v_azi - 5, 'Revizie făcută.', v_e_adm, 'reusita') returning id into v_i1;
  update public.maintenance_plans set amanat_pana = v_azi + 60, motiv_amanare = 'Așteptăm piesele de schimb.' where id = v_plan;
  update public.maintenance_interventions set descriere = 'Revizie făcută, cu filtre noi.' where id = v_i1;
  reset role;
  select amanat_pana into v_data from public.maintenance_plans where id = v_plan;
  if v_data = v_azi + 60 then
    raise notice '  ✓ (6) o editare a descrierii nu șterge amânarea planului';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) după editarea descrierii, amânarea e %', v_data;
  end if;
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  update public.maintenance_interventions set data = v_azi - 20 where id = v_i1;
  reset role;
  select ultima_executie, amanat_pana into v_data, v_ts from public.maintenance_plans where id = v_plan;
  if v_data = v_azi - 20 and v_ts is not null then
    raise notice '  ✓ (6) data corectată mută ultima execuție (%), amânarea rămâne', v_data;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) după corectarea datei: ultima execuție %, amânare %', v_data, v_ts;
  end if;

  -- ═══ (7) Oprirea intervenției planificate [POZITIVĂ] ═════════════════════
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  insert into public.maintenance_interventions (organization_id, equipment_id, tip, data, ora_start, descriere, executant_employee_id, oprire_minute)
  values (v_org, v_echip2, 'preventiva', v_azi - 1, time '09:00', 'Revizie pompă.', v_e_adm, 60) returning id into v_i2;
  update public.maintenance_interventions set oprire_minute = 90 where id = v_i2;
  reset role;
  select extract(epoch from (sfarsit - inceput))::integer / 60 into v_n
    from public.equipment_opriri where intervention_id = v_i2 and deleted_at is null;
  if v_n = 90 then
    raise notice '  ✓ (7) oprirea editată la 90 de minute mută sfârșitul din jurnal';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) oprirea din jurnal are % minute', v_n;
  end if;
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  update public.maintenance_interventions set oprire_minute = 0 where id = v_i2;
  reset role;
  select count(*) into v_n from public.equipment_opriri where intervention_id = v_i2 and deleted_at is null;
  if v_n = 0 then
    raise notice '  ✓ (7) oprirea pusă pe 0 iese din jurnal';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) rămân % opriri vii', v_n;
  end if;

  -- ═══ (8) Poarta bucketului ═══════════════════════════════════════════════
  insert into public.maintenance_interventions (organization_id, equipment_id, data, descriere)
  values (v_org2, v_echip_b, v_azi, 'Intervenția firmei B.') returning id into v_i_b;
  v_text := gen_random_uuid()::text;
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  v_bool := app.mentenanta_poate_fisier(v_org::text || '/intervention/' || v_text || '/pv.pdf', 'update');
  reset role;
  if v_bool then
    raise notice '  ✓ (8) administratorul urcă PV-ul pe un id de intervenție încă nefolosit';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) rezervarea e refuzată administratorului';
  end if;
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  v_bool := app.mentenanta_poate_fisier(v_org::text || '/intervention/' || v_text || '/pv.pdf', 'update');
  reset role;
  if not v_bool then
    raise notice '  ✓ (8) managerul nu poate rezerva';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) managerul a primit rezervarea';
  end if;
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  v_bool := app.mentenanta_poate_fisier(v_org::text || '/intervention/' || v_i_b::text || '/pv.pdf', 'update');
  reset role;
  if not v_bool then
    raise notice '  ✓ (8) id-ul unei intervenții din altă firmă nu e rezervare';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) calea cu intervenția altei firme a trecut';
  end if;

  -- ═══ (9) Registrul ═══════════════════════════════════════════════════════
  select count(*) into v_n from public.registru_documente r
   where r.organization_id = v_org and r.tip_document = 'pv_interventie' and r.entitate_id = v_i1;
  if v_n = 1 then
    raise notice '  ✓ (9) registrul înregistrează procesul-verbal la INSERT';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) % rânduri de registru pentru intervenție', v_n;
  end if;

  -- ═══ (10) Firma străină [NEGATIVĂ] ═══════════════════════════════════════
  -- Administratorul firmei A, pe intervenția firmei B: nu vede, nu adaugă și nu
  -- șterge linii de piese, nu rezervă un PV sub prefixul lui B. Rânduri
  -- numărate, nu erori ascultate.
  insert into public.maintenance_intervention_parts (organization_id, intervention_id, denumire, cantitate, pret_unitar)
  values (v_org2, v_i_b, 'Piesa firmei B', 1, 10) returning id into v_piesa;
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  select count(*) into v_n from public.maintenance_intervention_parts where intervention_id = v_i_b;
  reset role;
  if v_n = 0 then
    raise notice '  ✓ (10) administratorul lui A nu vede piesele lui B (0 rânduri)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10) administratorul lui A vede % linii ale lui B', v_n;
  end if;

  v_n := 0;
  foreach v_text in array array[v_org2::text, v_org::text] loop
    perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
    set local role authenticated;
    begin
      insert into public.maintenance_intervention_parts (organization_id, intervention_id, denumire, cantitate)
      values (v_text::uuid, v_i_b, 'Piesă străină', 1);
      v_n := v_n + 1;
    exception when insufficient_privilege or raise_exception then
      null;
    end;
    reset role;
  end loop;
  if v_n = 0 then
    raise notice '  ✓ (10) nicio linie de piese pe intervenția lui B (nici cu org B, nici cu org A)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10) % linii de piese au intrat pe intervenția lui B', v_n;
  end if;

  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  with m as (
    update public.maintenance_intervention_parts set deleted_at = now()
     where id = v_piesa returning 1)
  select count(*) into v_n from m;
  with m as (
    update public.maintenance_interventions set observatii = 'Străin'
     where id = v_i_b returning 1)
  select v_n + count(*) into v_n from m;
  reset role;
  if v_n = 0 then
    raise notice '  ✓ (10) linia și intervenția lui B: 0 rânduri actualizate de A';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10) A a actualizat % rânduri ale lui B', v_n;
  end if;

  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  v_bool := app.mentenanta_poate_fisier(v_org2::text || '/intervention/' || gen_random_uuid()::text || '/pv.pdf', 'update');
  reset role;
  if not v_bool then
    raise notice '  ✓ (10) A nu rezervă un PV sub prefixul lui B';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10) A a primit rezervarea sub prefixul lui B';
  end if;

  -- ═══ (11) Rândul care nu intră nu consumă numărul ═══════════════════════
  -- `maintenance_interventions_numar` (BEFORE) rulează înaintea conflictului din
  -- `INSERT … ON CONFLICT`. Cu id-ul unei intervenții existente, `do nothing`
  -- sărea rândul fără eroare și `do update` modifica rândul existent, iar
  -- numărul rămânea consumat, fără audit și fără registru: o gaură în PV-uri.
  insert into public.equipment (id, organization_id, cod, denumire)
  values (v_echip11, v_org, 'GEN-' || v_sufix, 'Generator');
  select next_number into v_seq from public.document_sequences
   where organization_id = v_org and document_type = 'pv_interventie'
     and year = extract(year from v_azi)::integer;
  v_text := '';
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  begin
    insert into public.maintenance_interventions (id, organization_id, equipment_id, data, descriere)
    values (v_i_b, v_org, v_echip11, v_azi, 'Sărită: id-ul lui B.') on conflict (id) do nothing;
    v_text := v_text || 'B=ok ';
  exception when others then
    v_text := v_text || 'B=' || sqlstate || ' ';
  end;
  begin
    insert into public.maintenance_interventions (id, organization_id, equipment_id, data, descriere)
    values (v_i2, v_org, v_echip11, v_azi, 'Sărită: id propriu.') on conflict (id) do nothing;
    v_text := v_text || 'propriu=ok ';
  exception when others then
    v_text := v_text || 'propriu=' || sqlstate || ' ';
  end;
  begin
    insert into public.maintenance_interventions (id, organization_id, equipment_id, data, descriere)
    values (v_i2, v_org, v_echip, v_azi, 'Suprascrisă prin upsert.')
    on conflict (id) do update set descriere = excluded.descriere;
    v_text := v_text || 'upsert=ok';
  exception when others then
    v_text := v_text || 'upsert=' || sqlstate;
  end;
  reset role;
  select count(*) into v_n from public.maintenance_interventions where equipment_id = v_echip11;
  if v_text = 'B=23505 propriu=23505 upsert=23505'
     and v_n = 0
     and (select descriere from public.maintenance_interventions where id = v_i2) <> 'Suprascrisă prin upsert.'
     and (select next_number from public.document_sequences
           where organization_id = v_org and document_type = 'pv_interventie'
             and year = extract(year from v_azi)::integer) = v_seq then
    raise notice '  ✓ (11) ON CONFLICT pe un id existent (al lui B, propriu, upsert): 23505, 0 rânduri, contorul neatins';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (11) % · rânduri noi %, contorul % → %', v_text, v_n, v_seq,
      (select next_number from public.document_sequences
        where organization_id = v_org and document_type = 'pv_interventie'
          and year = extract(year from v_azi)::integer);
  end if;

  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  insert into public.maintenance_interventions (organization_id, equipment_id, data, descriere)
  values (v_org, v_echip11, v_azi, 'Următoarea intervenție reală.') returning numar into v_numar;
  reset role;
  if v_numar = 'PV-' || extract(year from v_azi)::text || '-' || lpad(v_seq::text, 4, '0') then
    raise notice '  ✓ (11) următoarea intervenție reală ia numărul imediat următor (%), fără gaură', v_numar;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (11) următoarea intervenție a primit %, așteptat PV-%-%', v_numar,
      extract(year from v_azi)::text, lpad(v_seq::text, 4, '0');
  end if;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'Proba intervențiilor: % verificări picate.', v_esecuri;
  end if;
  raise notice '  Toate verificările au trecut.';
end $$;
