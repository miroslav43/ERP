-- tests/rls/proba-flota-integritate.sql
--
-- FLOTA, DUPĂ 0171: SCRIEREA SE JUDECĂ PE DREPTUL DE SCRIERE.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- Rolurile de probă primesc, PE ORGANIZAȚIE, scope-uri diferite pe read și pe
-- write. Exact combinația în care 0012 filtra scrierea pe dreptul de citire:
--   employee: trip_sheets read = all, create = own, update = own
--   manager:  trip_sheets read = team, create = own (approve = team din seed)
--
-- (1) șoferul își adaugă alimentare pe foaia proprie              [POZITIVĂ];
-- (2) dar NU pe foaia colegului, deși o vede (read = all);
-- (3) managerul își întocmește propria foaie                      [POZITIVĂ];
-- (4) dar NU una în numele subordonatului (read = team ≠ create = team);
-- (5) org_admin adaugă alimentare pe foaia unui șofer             [POZITIVĂ];
-- (6) un vehicul nu poate primi departamentul altei firme (P0001);
-- (7) confirmarea anomaliei pune semnatarul din sesiune și momentul din
--     ceasul bazei, oricât ar încerca payload-ul altceva          [POZITIVĂ];
-- (8) o anomalie confirmată nu se mai poate reconfirma (P0001), nici
--     „dezsemna” cu `confirmat_de = NULL` (8b);
-- (9) dar contul care a confirmat-o se poate șterge (FK set null)  [POZITIVĂ].
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix     text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org       uuid := gen_random_uuid();
  v_org_alta  uuid := gen_random_uuid();
  v_u_admin   uuid := gen_random_uuid();
  v_u_mgr     uuid := gen_random_uuid();
  v_u_a       uuid := gen_random_uuid();
  v_u_b       uuid := gen_random_uuid();
  v_e_mgr     uuid := gen_random_uuid();
  v_e_a       uuid := gen_random_uuid();
  v_e_b       uuid := gen_random_uuid();
  v_vehicul   uuid := gen_random_uuid();
  v_foaie_a   uuid := gen_random_uuid();
  v_foaie_b   uuid := gen_random_uuid();
  v_dep_alt   uuid := gen_random_uuid();
  v_anomalie  uuid := gen_random_uuid();
  v_semnatar  uuid;
  v_atinse    int;
  v_esecuri   int := 0;
begin
  raise notice '';
  raise notice '  PROBA „FLOTA — INTEGRITATE" (0171)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-flota-int-' || v_sufix, 'Proba Flotă SRL',
     'RO' || (87000000 + (random() * 900000)::int)::text),
    (v_org_alta, 'proba-flota-alta-' || v_sufix, 'Altă Firmă SRL',
     'RO' || (86000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select v_org, f.feature_key, true, now() from public.features f;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_admin, 'flota-adm-' || v_sufix || '@proba.test', now()),
    (v_u_mgr,   'flota-mgr-' || v_sufix || '@proba.test', now()),
    (v_u_a,     'flota-a-'   || v_sufix || '@proba.test', now()),
    (v_u_b,     'flota-b-'   || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_admin, 'org_admin'),
    (v_org, v_u_mgr,   'manager'),
    (v_org, v_u_a,     'employee'),
    (v_org, v_u_b,     'employee');

  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_mgr, v_org, 'FL-M', 'Mihai', 'Manager', app.azi_local() - 500, 'activ', v_u_mgr, null),
    (v_e_a,   v_org, 'FL-A', 'Ana',   'Șofer',   app.azi_local() - 400, 'activ', v_u_a,   v_e_mgr),
    (v_e_b,   v_org, 'FL-B', 'Bogdan','Șofer',   app.azi_local() - 400, 'activ', v_u_b,   v_e_mgr);

  -- Scope-uri DIFERITE pe read și write, doar în firma de probă.
  insert into public.role_permissions (role, resource, action, scope, organization_id) values
    ('employee', 'trip_sheets', 'read',   'all',  v_org),
    ('employee', 'trip_sheets', 'create', 'own',  v_org),
    ('employee', 'trip_sheets', 'update', 'own',  v_org),
    ('manager',  'trip_sheets', 'read',   'team', v_org),
    ('manager',  'trip_sheets', 'create', 'own',  v_org);

  insert into public.departments (id, organization_id, cod, denumire)
  values (v_dep_alt, v_org_alta, 'ALT-' || v_sufix, 'Departament străin');

  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent,
                               created_by, updated_by)
  values (v_vehicul, v_org, 'B' || (100 + (random() * 800)::int)::text || 'FLT', 'Dacia', 'Logan', 10000,
          v_u_admin, v_u_admin);

  insert into public.trip_sheets (id, organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                  created_by, updated_by) values
    (v_foaie_a, v_org, v_vehicul, v_e_a, now() - interval '5 hours', 10000, v_u_a, v_u_a),
    (v_foaie_b, v_org, v_vehicul, v_e_b, now() - interval '4 hours', 10000, v_u_b, v_u_b);

  -- (1) alimentare pe foaia proprie
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la,
                                     created_by, updated_by)
    values (v_org, v_foaie_a, 30, 210, now() - interval '3 hours', v_u_a, v_u_a);
    reset role;
    raise notice '  ✓ (1) șoferul alimentează pe foaia proprie';
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) șoferul nu poate alimenta pe foaia proprie: % (%)', sqlerrm, sqlstate;
  end;

  -- (2) dar nu pe foaia colegului, deși o vede
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la,
                                     created_by, updated_by)
    values (v_org, v_foaie_b, 30, 210, now() - interval '3 hours', v_u_a, v_u_a);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) șoferul a scris o alimentare pe foaia colegului (read = all, update = own)';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (2) alimentarea pe foaia colegului e refuzată';
  end;

  -- (3) managerul, foaia proprie
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                    created_by, updated_by)
    values (v_org, v_vehicul, v_e_mgr, now() - interval '2 hours', 10000, v_u_mgr, v_u_mgr);
    reset role;
    raise notice '  ✓ (3) managerul își întocmește propria foaie';
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) managerul nu-și poate întocmi foaia: % (%)', sqlerrm, sqlstate;
  end;

  -- (4) dar nu în numele subordonatului
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                    created_by, updated_by)
    values (v_org, v_vehicul, v_e_a, now() - interval '1 hour', 10000, v_u_mgr, v_u_mgr);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) managerul a întocmit o foaie în numele subordonatului (read = team, create = own)';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (4) foaia în numele subordonatului e refuzată';
  end;

  -- (5) org_admin pe foaia unui șofer
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la,
                                     created_by, updated_by)
    values (v_org, v_foaie_b, 25, 180, now() - interval '3 hours', v_u_admin, v_u_admin);
    reset role;
    raise notice '  ✓ (5) org_admin alimentează pe foaia unui șofer';
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) org_admin nu poate alimenta pe foaia unui șofer: % (%)', sqlerrm, sqlstate;
  end;

  -- (6) departamentul altei firme
  begin
    update public.vehicles set department_id = v_dep_alt where id = v_vehicul;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) vehiculul a primit departamentul altei firme';
  exception when raise_exception then
    raise notice '  ✓ (6) departamentul altei firme e refuzat';
  end;

  -- (7) confirmarea pune semnatarul din sesiune, nu din payload
  insert into public.odometer_anomalies (id, organization_id, vehicle_id, trip_sheet_id,
                                         km_asteptat, km_declarat, tip)
  values (v_anomalie, v_org, v_vehicul, v_foaie_a, 10000, 14000, 'salt');

  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    -- Payload-ul încearcă și să antedateze, și să semneze în numele altuia.
    update public.odometer_anomalies
       set confirmat_la = now() - interval '30 days', confirmat_de = v_u_a,
           nota = 'Foaie lipsă, completată ulterior.'
     where id = v_anomalie;
    get diagnostics v_atinse = row_count;
    reset role;
    select confirmat_de into v_semnatar from public.odometer_anomalies where id = v_anomalie;
    if v_atinse = 1 and v_semnatar = v_u_admin
       and (select confirmat_la from public.odometer_anomalies where id = v_anomalie)
           > now() - interval '1 minute' then
      raise notice '  ✓ (7) confirmarea e semnată de cine confirmă, cu ceasul bazei';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (7) confirmarea: % rânduri, semnatar %', v_atinse, v_semnatar;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) org_admin nu poate confirma anomalia: % (%)', sqlerrm, sqlstate;
  end;

  -- (8) reconfirmarea e refuzată de bază, nu doar de acțiune
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    update public.odometer_anomalies set nota = 'Altă explicație.' where id = v_anomalie;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) nota unei anomalii confirmate a fost rescrisă';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (8) anomalia confirmată nu se mai rescrie';
  end;

  -- (8b) semnătura nu se poate șterge cu un UPDATE: golirea e rezervată FK-ului
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    update public.odometer_anomalies set confirmat_de = null where id = v_anomalie;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8b) semnătura unei anomalii confirmate a fost ștearsă cu un UPDATE';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (8b) semnătura nu se șterge cu un UPDATE';
  end;

  -- (9) dar contul care a confirmat se poate șterge: FK-ul `on delete set null`
  -- golește `confirmat_de` printr-un UPDATE care trece prin aceeași gardă.
  -- Ștergerea reală vine din service role, fără `sub`. Cu `sub`-ul adminului
  -- încă setat, auditul ar scrie un actor tocmai șters și ar cădea pe FK-ul lui
  -- `audit_logs`, adică pe altă cauză decât cea probată aici.
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    delete from public.organization_members where user_id = v_u_admin;
    delete from auth.users where id = v_u_admin;
    select confirmat_de into v_semnatar from public.odometer_anomalies where id = v_anomalie;
    if v_semnatar is null then
      raise notice '  ✓ (9) contul care a confirmat se poate șterge';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (9) semnatarul a rămas % după ștergerea contului', v_semnatar;
    end if;
  exception when others then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) ștergerea contului care a confirmat e blocată: % (%)', sqlerrm, sqlstate;
  end;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA FLOTA INTEGRITATE: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE cele 10 verificări au trecut.';
  raise notice '';
end;
$$;
