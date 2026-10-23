-- tests/rls/proba-migrari-pe-date.sql
--
-- MIGRĂRILE FLOTEI ȘI ALE MENTENANȚEI (0191, 0199–0206, 0210–0218, 0225, 0226, 0232)
-- PE DATE
-- EXISTENTE.
--
-- ── DE CE ───────────────────────────────────────────────────────────────────
-- Bancul aplică toate migrările pe o bază GOALĂ: umplerile retroactive
-- (backfill), indexurile unice noi și UPDATE-urile pe rânduri vechi nu ating
-- acolo niciun rând. Pe producție vor rula peste date reale. Proba de față
-- pornește de la baza din starea lui origin/main (0001–0198), o populează cu un
-- set mai mare decât producția, pe trei firme, aplică migrările ramurii în
-- ordine lexicală și verifică fiecare invariant.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
--  (1) 0200: fiecare foaie primește exact o cursă, identică cu antetul (ore, km,
--      ștergerea logică, traseul tăiat la 200, scopul);
--  (2) 0200: `data` e ziua României pe toate foile, inclusiv peste miezul nopții
--      și la trecerea pe ora de vară (29.03.2026) și de iarnă (26.10.2025);
--  (3) 0200: `ts_vehicul_zi_uq` se creează peste o zi cu o foaie respinsă + una
--      aprobată și peste o zi cu una ștearsă + una trimisă;
--  (4) 0200: instantaneul vehiculului doar pe foile trimise/aprobate; niciun
--      număr dat retroactiv;
--  (5) 0210: numerotarea PV retroactivă: fără găuri, fără dubluri, în ordinea
--      datei, pe anul datei, iar contorul din document_sequences e la zi;
--  (6) 0218: vehiculele active rămân neatinse; cele ieșite primesc o ieșire
--      `preluata_din_istoric` cu zero termene;
--  (7) 0199: drepturile se lărgesc exact pe cheile intenționate, iar
--      suprascrierile pe firmă și pe membru rămân neatinse;
--  (8) 0191/0201: pragurile pe care motorul le aplică fiecărui tip rămân cele
--      de dinainte (DEFECT REPARAT în 0191: regula planurilor se copia și pe
--      ISCIR și pe echipamente), iar setările arată pragurile aplicate;
--  (9) prima rulare a joburilor zilnice: cel mult un rezumat pe om și modul,
--      sesizările „rezolvat” vechi se închid după pragul firmei, a doua rulare
--      din aceeași zi nu trimite nimic;
--  (10) căi de scriere pe rândurile vechi, sub rolul real: ciorna veche se
--      trimite și se aprobă [POZITIVĂ], foaia trimisă înainte se aprobă
--      [POZITIVĂ], cursa deschisă se închide [POZITIVĂ], respinsă → ciornă în
--      ziua unei foi aprobate dă 23505 pe `ts_vehicul_zi_uq` (tradus în
--      flota/erori.ts), intervenția nouă continuă numerotarea [POZITIVĂ],
--      intervenția veche se editează [POZITIVĂ], foaia aprobată veche se
--      stornează [POZITIVĂ], predarea peste o alocare veche [POZITIVĂ],
--      ieșirea din parc a unui vehicul cu istoric [POZITIVĂ], sesizarea veche
--      se închide [POZITIVĂ], managerul unei fișe vechi se schimbă în firmă
--      [POZITIVĂ] și se refuză din altă firmă cu răspunsul unic (0226), valoarea
--      de achiziție mutată se corectează în `vehicle_costuri` [POZITIVĂ];
--  (11) 0225: valoarea de achiziție și costul documentelor se mută EXACT în
--      tabelele 1:1 (aceleași rânduri, aceleași sume, aceeași firmă), coloanele
--      vechi rămân goale și păzite de CHECK; vehiculele nu se ating (amprenta
--      din (6) include `updated_at`);
--  (12) 0232: valoarea de achiziție a echipamentelor se mută EXACT în
--      `equipment_costuri` (aceleași rânduri, aceleași sume, aceeași firmă),
--      coloana veche rămâne goală și păzită de CHECK; (10m) administratorul o
--      corectează acolo [POZITIVĂ]; (10n) responsabilul și tehnicianul
--      utilajului (e3) își văd utilajul, dar nu valoarea.
--
-- ── CUM SE RULEAZĂ ──────────────────────────────────────────────────────────
-- Cere o bază în starea lui origin/main: migrările ramurii le aplică EA, prin
-- `\ir`. Pe o bază deja migrată (bancul obișnuit, care o rulează prin globul
-- `proba-*.sql`) se oprește cu un anunț și iese cu 0: acolo nu are ce verifica.
-- Pasul manual, înainte de aplicarea pe producție, e în NOTES.md §1: bancul
-- pornit pe `git archive origin/main` cu --pastreaza dă doar containerul; proba
-- rulează pe o bază NOUĂ din el (`create database pe_date` + migrările lui
-- origin/main), nu pe `postgres`, unde datele probelor de pe main au trei ciorne
-- pe același vehicul și zi și opresc 0200 (din worktree-ul ramurii; NICIODATĂ
-- pe cloud). Lista migrărilor de mai jos e
-- cea a livrării flotă–mentenanță; o migrare nouă a ramurii se adaugă în listă.
\set ON_ERROR_STOP on
\pset pager off

select (to_regclass('public.trip_sheet_curse') is null
        and to_regclass('public.maintenance_rezumat_trimis') is null
        and to_regclass('public.vehicle_exits') is null
        and to_regclass('public.fleet_settings') is null) as x5_pre,
       (to_regclass('public.trip_sheet_curse') is not null
        and to_regclass('public.maintenance_rezumat_trimis') is not null
        and to_regclass('public.vehicle_exits') is not null
        and to_regclass('public.fleet_settings') is not null) as x5_post
\gset

\if :x5_post
\echo '  PROBA „MIGRĂRI PE DATE EXISTENTE": SĂRITĂ — baza e deja migrată (bancul obișnuit).'
\echo '  Se rulează pe baza din starea origin/main: vezi antetul și NOTES.md §1.'
\quit
\endif
\if :x5_pre
\else
do $$ begin raise exception 'PROBA MIGRĂRI PE DATE: baza e parțial migrată (unele dintre 0191/0200/0201/0218 aplicate, altele nu).'; end $$;
\endif

\echo ''
\echo '  PROBA „MIGRĂRI PE DATE EXISTENTE" (0191, 0199–0206, 0210–0218, 0225, 0226, 0232)'
\echo '  ─────────────────────────────────────────────────────────'
\echo '  ▶ populez trei firme peste starea origin/main'

-- ═══ Setul: 3 firme, peste starea 0198 ══════════════════════════════════════
create or replace function pg_temp.u(p text) returns uuid language sql immutable
as $$ select md5('x5:' || p)::uuid $$;
-- „A-E-e1” → fișa angajatului e1 din firma A (creată de triggerul membrilor).
create or replace function pg_temp.e(p text) returns uuid language sql stable
as $$ select e.id from public.employees e
       where e.organization_id = md5('x5:' || split_part(p, '-', 1) || '-org')::uuid
         and e.user_id = md5('x5:' || split_part(p, '-', 1) || '-' || split_part(p, '-', 3))::uuid
         and e.deleted_at is null limit 1 $$;

do $$
declare
  f        text;
  fi       int := 0;
  v_org    uuid;
  r        record;
  v_veh    uuid;
  v_km     int;
  v_zi     date;
  v_pl     timestamptz;
  v_st     text;
  v_ts     uuid;
  k        int;
  v_sofer  uuid;
begin
  foreach f in array array['A', 'B', 'C'] loop
    fi := fi + 1;
    v_org := pg_temp.u(f || '-org');
    insert into public.organizations (id, slug, name, cui, status)
    values (v_org, 'x5-firma-' || lower(f), 'Firma ' || f || ' SRL', 'RO' || (70000000 + fi)::text, 'active');
    insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
    select v_org, fe.feature_key, true, now() - interval '400 days' from public.features fe;

    -- membri: admin, manager, hr, trei angajați (al treilea plecat în B)
    insert into auth.users (id, email, email_confirmed_at)
    select pg_temp.u(f || '-' || x), 'x5-' || lower(f) || '-' || x || '@proba.test', now()
      from unnest(array['admin', 'mgr', 'hr', 'e1', 'e2', 'e3']) x;
    insert into public.organization_members (organization_id, user_id, role, status)
    values (v_org, pg_temp.u(f || '-admin'), 'org_admin', 'active'),
           (v_org, pg_temp.u(f || '-mgr'),   'manager',   'active'),
           (v_org, pg_temp.u(f || '-hr'),    'hr',        'active'),
           (v_org, pg_temp.u(f || '-e1'),    'employee',  'active'),
           (v_org, pg_temp.u(f || '-e2'),    'employee',  'active'),
           (v_org, pg_temp.u(f || '-e3'),    'employee',  case when f = 'B' then 'inactive' else 'active' end::public.member_status);

    -- Fișa lui org_admin o creează triggerul membrilor; celelalte le inserăm.
    insert into public.employees (organization_id, marca, first_name, last_name, hired_on, status, user_id)
    select v_org, 'T' || x, 'Tmp', 'Tmp', date '2024-01-10', 'activ', pg_temp.u(f || '-' || x)
      from unnest(array['mgr', 'hr', 'e1', 'e2', 'e3']) x;
    update public.employees e
       set marca = f || '-' || x.marca, first_name = x.prenume, last_name = x.nume || f,
           hired_on = date '2024-01-10', status = 'activ'
      from (values ('admin', '001', 'Ana', 'Admin'), ('mgr', '002', 'Mihai', 'Manager'),
                   ('hr', '003', 'Horia', 'Resurse'), ('e1', '011', 'Ion', 'Șofer'),
                   ('e2', '012', 'Elena', 'Șoferiță'), ('e3', '013', 'Dan', 'Tehnician')) x(cine, marca, prenume, nume)
     where e.organization_id = v_org and e.user_id = pg_temp.u(f || '-' || x.cine);
    update public.employees e set manager_employee_id = pg_temp.e(f || '-E-mgr')
     where e.organization_id = v_org and e.user_id in (pg_temp.u(f || '-e1'), pg_temp.u(f || '-e2'), pg_temp.u(f || '-e3'));
  end loop;

  -- ── Suprascrieri pe role_permissions ────────────────────────────────────
  -- pe firmă (A): managerul NU vede vehiculele; angajatul n-are foi.
  insert into public.role_permissions (organization_id, role, resource, action, scope) values
    (pg_temp.u('A-org'), 'manager',  'vehicles',    'read', 'none'),
    (pg_temp.u('A-org'), 'employee', 'trip_sheets', 'create', 'none');
  -- pe membru: e2 din A citește toate foile; managerul din B vede tot parcul;
  -- e1 din C n-are voie la vehicule.
  insert into public.role_permissions (organization_id, member_id, role, resource, action, scope)
  select m.organization_id, m.id, m.role, x.res, x.act, x.sc::public.permission_scope
    from (values ('A', 'e2', 'trip_sheets', 'read', 'all'),
                 ('B', 'mgr', 'vehicles', 'read', 'all'),
                 ('C', 'e1', 'vehicles', 'read', 'none'),
                 ('C', 'e1', 'trip_sheets', 'update', 'none')) x(firma, cine, res, act, sc)
    join public.organization_members m
      on m.organization_id = pg_temp.u(x.firma || '-org') and m.user_id = pg_temp.u(x.firma || '-' || x.cine);

  -- ── Vehicule ───────────────────────────────────────────────────────────
  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, vin, categorie,
                               tip_combustibil, consum_mediu_declarat, km_curent, masa_maxima_kg, status, pool,
                               created_by, updated_by, created_at, updated_at)
  select pg_temp.u(x.k), pg_temp.u(x.firma || '-org'), x.nr, x.marca, x.model, x.vin, x.cat::public.vehicle_category,
         x.comb::public.fuel_type, x.consum, x.km, x.masa, 'activ', x.pool,
         pg_temp.u(x.firma || '-admin'), pg_temp.u(x.firma || '-admin'), timestamptz '2025-06-01', timestamptz '2025-06-01'
    from (values
      ('A-v1', 'A', 'B101AAA', 'Dacia', 'Logan',   'UU1ABC12345678901', 'autoturism',    'motorina', 5.8, 10000, 1500, false),
      ('A-v2', 'A', 'B102AAA', 'Dacia', 'Duster',  'UU1ABC12345678902', 'autoturism',    'benzina',  7.2, 20000, 1800, false),
      ('A-v3', 'A', 'B103AAA', 'Ford',  'Transit', null,                'autoutilitara', 'motorina', 9.5, 30000, 3500, true),
      ('A-v4', 'A', 'B104AAA', 'Iveco', 'Daily',   'ZCFC12345678901AA', 'camion',        'motorina', 14.0, 40000, 7200, false),
      ('A-v5', 'A', 'B105AAA', 'Skoda', 'Octavia', null,                'autoturism',    'hibrid',   4.9, 5000, 1600, false),
      ('A-v6', 'A', 'B106AAA', 'VW',    'Caddy',   null,                'autoutilitara', 'motorina', 6.5, 60000, 2200, false),
      ('B-v1', 'B', 'CJ01BBB', 'Dacia', 'Logan',   'UU1ABC12345678901', 'autoturism',    'motorina', 5.8, 15000, 1500, false),
      ('B-v2', 'B', 'CJ02BBB', 'Renault','Clio',   null,                'autoturism',    'benzina',  6.0, 25000, 1400, true),
      ('B-v3', 'B', 'CJ03BBB', 'Mercedes','Sprinter', null,             'microbuz',      'motorina', 11.0, 80000, 3500, false),
      ('B-v4', 'B', 'CJ04BBB', 'Tesla', 'Model 3', null,                'autoturism',    'electric', 0, 12000, 1900, false),
      ('C-v1', 'C', 'IS01CCC', 'Opel',  'Astra',   null,                'autoturism',    'benzina',  6.8, 90000, 1500, false),
      ('C-v2', 'C', 'IS02CCC', 'Opel',  'Vivaro',  null,                'autoutilitara', 'motorina', 8.8, 120000, 2900, false),
      ('C-v3', 'C', 'IS03CCC', 'Fiat',  'Doblo',   null,                'autoutilitara', 'motorina', 7.0, 150000, 2000, false)
    ) x(k, firma, nr, marca, model, vin, cat, comb, consum, km, masa, pool);

  -- ── Alocări: deschise și închise ───────────────────────────────────────
  for r in select * from (values
      ('A-v1', 'A-E-e1', timestamptz '2025-07-01 08:00+03', timestamptz '2026-03-01 08:00+02'),
      ('A-v1', 'A-E-e2', timestamptz '2026-03-01 08:00+02', null),
      ('A-v2', 'A-E-e1', timestamptz '2026-03-01 09:00+02', null),
      ('A-v4', 'A-E-mgr', timestamptz '2025-07-01 08:00+03', null),
      ('A-v6', 'A-E-e2', timestamptz '2025-07-01 08:00+03', timestamptz '2025-12-31 18:00+02'),
      ('B-v1', 'B-E-e1', timestamptz '2025-07-01 08:00+03', null),
      ('B-v3', 'B-E-e2', timestamptz '2025-08-01 08:00+03', null),
      ('C-v1', 'C-E-e1', timestamptz '2025-07-01 08:00+03', null),
      ('C-v2', 'C-E-e2', timestamptz '2025-07-01 08:00+03', null),
      ('C-v3', 'C-E-e1', timestamptz '2025-06-15 08:00+03', null)
    ) x(veh, emp, de_la, pana_la)
  loop
    insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, pana_la, km_predare)
    values (pg_temp.u(left(r.veh, 1) || '-org'), pg_temp.u(r.veh), pg_temp.e(r.emp), r.de_la, r.pana_la,
            (select km_curent from public.vehicles where id = pg_temp.u(r.veh)));
  end loop;

  -- ── Foi de parcurs: istoric aprobat + stări mixte ──────────────────────
  -- Câte o foaie la ~9 zile pe fiecare vehicul activ cu șofer, din nov. 2025.
  for r in
    select v.id as vid, v.organization_id as org, v.nr_inmatriculare as p,
           coalesce(v.employee_id, (select e.id from public.employees e
                                     where e.organization_id = v.organization_id and e.marca like '%-011')) as sofer,
           v.km_curent as km0, row_number() over (order by v.nr_inmatriculare) as rn
      from public.vehicles v
     where v.id in (pg_temp.u('A-v1'), pg_temp.u('A-v2'), pg_temp.u('A-v3'), pg_temp.u('A-v4'),
                    pg_temp.u('B-v1'), pg_temp.u('B-v2'), pg_temp.u('B-v3'),
                    pg_temp.u('C-v1'), pg_temp.u('C-v2'), pg_temp.u('C-v3'))
  loop
    v_km := r.km0;
    k := 0;
    v_zi := date '2025-11-03' + (r.rn::int % 5);
    while v_zi < app.azi_local() - 1 loop
      k := k + 1;
      v_pl := (v_zi + time '07:30') at time zone 'Europe/Bucharest';
      v_st := case
                when v_zi < app.azi_local() - 30 then 'aprobat'
                when k % 4 = 0 then 'trimis'
                else 'draft' end;
      -- Ca în aplicație: ciorna, alimentările, apoi trimiterea și aprobarea.
      insert into public.trip_sheets (organization_id, vehicle_id, employee_id, numar, plecare_la, sosire_la,
                                      km_plecare, km_sosire, traseu, scop, status,
                                      created_by, updated_by, created_at, updated_at)
      values (r.org, r.vid, r.sofer,
              case when k % 3 = 0 then 'FP-' || r.p || '-' || k::text when k % 7 = 0 and r.rn = 1 then 'FP-2026-' || lpad(k::text, 5, '0') else null end,
              v_pl, v_pl + interval '9 hours', v_km, v_km + 120 + (k % 7) * 10,
              repeat('Sediu → Client ' || k::text || ' → Sediu; ', case when k % 11 = 0 then 25 else 1 end),
              case when k % 5 = 0 then null else 'Livrare marfă client ' || k::text end,
              'draft',
              (select user_id from public.employees where id = r.sofer),
              (select user_id from public.employees where id = r.sofer),
              v_pl, v_pl + interval '30 hours')
      returning id into v_ts;
      v_km := v_km + 120 + (k % 7) * 10;
      -- alimentări pe o foaie din trei
      if k % 3 = 1 then
        insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, statie, numar_bon, alimentat_la, plin)
        values (r.org, v_ts, 35.5, 255.6, 'OMV Pipera', 'BON-' || k, v_pl + interval '2 hours', true);
      end if;
      if v_st in ('trimis', 'aprobat') then
        update public.trip_sheets set status = 'trimis' where id = v_ts;
      end if;
      if v_st = 'aprobat' then
        update public.trip_sheets
           set status = 'aprobat',
               aprobat_de = (select user_id from public.employees where organization_id = r.org and marca like '%-002')
         where id = v_ts;
      end if;
      -- o foaie din 13 respinsă
      if v_st = 'aprobat' and k % 13 = 0 then
        null;
      end if;
      v_zi := v_zi + 9;
    end loop;
  end loop;

  -- foi pe marginile orei: peste miezul nopții, la trecerea pe ora de vară
  -- (29.03.2026) și pe ora de iarnă (26.10.2025), plus „aceeași zi UTC, zile
  -- românești diferite”. Vehiculul A-v5 n-are alte foi.
  v_veh := pg_temp.u('A-v5'); v_sofer := pg_temp.e('A-E-e2'); v_km := 5000;
  for r in select * from (values
      ('2025-10-25 21:30+00'::timestamptz, '2025-10-26 03:30+00'::timestamptz, 'aprobat', 'iarna-00:30'),     -- 26.10 00:30 local (UTC+3)
      ('2025-10-26 22:30+00'::timestamptz, '2025-10-27 01:00+00'::timestamptz, 'aprobat', 'iarna-zi-urm'),    -- 27.10 00:30 local (UTC+2)
      ('2026-03-28 22:30+00'::timestamptz, '2026-03-29 02:00+00'::timestamptz, 'aprobat', 'vara-00:30'),      -- 29.03 00:30 local (UTC+2), trece prin 03→04
      ('2026-03-29 21:30+00'::timestamptz, '2026-03-29 23:00+00'::timestamptz, 'aprobat', 'vara-zi-urm'),     -- 30.03 00:30 local (UTC+3)
      ('2026-07-01 20:00+00'::timestamptz, '2026-07-01 23:30+00'::timestamptz, 'aprobat', 'peste-miezul'),    -- 01.07 23:00 → 02.07 02:30 local
      ('2026-08-09 08:00+00'::timestamptz, '2026-08-09 12:00+00'::timestamptz, 'aprobat', 'utc-09-ziua'),     -- 09.08 11:00 local
      ('2026-08-09 21:15+00'::timestamptz, '2026-08-10 04:00+00'::timestamptz, 'aprobat', 'utc-09-noaptea')   -- 10.08 00:15 local, aceeași zi UTC
    ) x(pl, so, st, eticheta)
  loop
    insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, sosire_la, km_plecare, km_sosire,
                                    traseu, scop, status, trimis_la, aprobat_de, aprobat_la, created_by, updated_by)
    values (pg_temp.u('A-org'), v_veh, v_sofer, r.pl, r.so, v_km, v_km + 50, 'Margine ' || r.eticheta, 'Probă oră',
            r.st::public.trip_sheet_status, r.so, pg_temp.u('A-mgr'), r.so + interval '1 hour',
            pg_temp.u('A-e2'), pg_temp.u('A-e2'));
    v_km := v_km + 50;
  end loop;

  -- două foi pe același vehicul în aceeași zi: una respinsă, una aprobată
  v_veh := pg_temp.u('B-v4'); v_sofer := pg_temp.e('B-E-e1');
  insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, sosire_la, km_plecare, km_sosire,
                                  traseu, scop, status, trimis_la, motiv_respingere, created_by, updated_by)
  values (pg_temp.u('B-org'), v_veh, v_sofer, '2026-09-15 06:00+00', '2026-09-15 10:00+00', 12000, 12100,
          'Cluj → Turda', 'Ședință', 'respins', '2026-09-15 11:00+00', 'Kilometraj greșit.', pg_temp.u('B-e1'), pg_temp.u('B-e1'));
  insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, sosire_la, km_plecare, km_sosire,
                                  traseu, scop, status, trimis_la, aprobat_de, aprobat_la, created_by, updated_by)
  values (pg_temp.u('B-org'), v_veh, v_sofer, '2026-09-15 06:05+00', '2026-09-15 10:00+00', 12000, 12090,
          'Cluj → Turda', 'Ședință', 'aprobat', '2026-09-15 12:00+00', pg_temp.u('B-mgr'), '2026-09-15 13:00+00',
          pg_temp.u('B-e1'), pg_temp.u('B-e1'));
  -- două foi în aceeași zi, una ștearsă logic
  insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, sosire_la, km_plecare, km_sosire,
                                  traseu, scop, status, deleted_at, created_by, updated_by)
  values (pg_temp.u('B-org'), v_veh, v_sofer, '2026-09-20 06:00+00', '2026-09-20 08:00+00', 12090, 12150,
          'Ștearsă', 'Duplicat', 'draft', '2026-09-20 09:00+00', pg_temp.u('B-e1'), pg_temp.u('B-e1'));
  insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, sosire_la, km_plecare, km_sosire,
                                  traseu, scop, status, trimis_la, created_by, updated_by)
  values (pg_temp.u('B-org'), v_veh, v_sofer, '2026-09-20 06:00+00', '2026-09-20 08:00+00', 12090, 12150,
          'Cluj → Dej', 'Livrare', 'trimis', '2026-09-20 09:00+00', pg_temp.u('B-e1'), pg_temp.u('B-e1'));
  -- o ciornă fără sosire (șoferul n-a terminat)
  insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare, traseu, scop, status,
                                  created_by, updated_by)
  values (pg_temp.u('B-org'), v_veh, v_sofer, now() - interval '3 hours', 12150, null, null, 'draft',
          pg_temp.u('B-e1'), pg_temp.u('B-e1'));
  -- o foaie aprobată apoi stornată (ștearsă logic, cu număr)
  insert into public.trip_sheets (organization_id, vehicle_id, employee_id, numar, plecare_la, sosire_la, km_plecare, km_sosire,
                                  traseu, scop, status, trimis_la, aprobat_de, aprobat_la, deleted_at, created_by, updated_by)
  values (pg_temp.u('A-org'), pg_temp.u('A-v6'), pg_temp.e('A-E-e2'), 'FP-2026-00003', '2025-09-01 05:00+00', '2025-09-01 14:00+00',
          60000, 60200, 'Stornată', 'Greșeală', 'aprobat', '2025-09-01 15:00+00', pg_temp.u('A-mgr'), '2025-09-02 08:00+00',
          '2025-09-03 08:00+00', pg_temp.u('A-e2'), pg_temp.u('A-e2'));

  -- ── Ieșiri din parc (C) ────────────────────────────────────────────────
  -- C-v3 vândut cu motiv; C-v2 casat fără motiv; C-v1 rămâne activ, dar cu un
  -- motiv_iesire rămas de la o ieșire anulată manual.
  update public.vehicles set status = 'vandut', motiv_iesire = 'Vândut către SC Alfa SRL.', updated_by = pg_temp.u('C-admin')
   where id = pg_temp.u('C-v3');
  update public.vehicles set status = 'casat', updated_by = pg_temp.u('C-admin')
   where id = pg_temp.u('C-v2');
  update public.vehicles set motiv_iesire = 'Fost vândut, cumpărat înapoi.', updated_by = pg_temp.u('C-admin')
   where id = pg_temp.u('C-v1');
  -- un vehicul nou în C cu numărul celui vândut (posibil abia după 0218), deci aici nu.
  update public.vehicles set status = 'in_service' where id = pg_temp.u('B-v3');
  -- un vehicul șters logic în B
  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent, status, deleted_at)
  values (pg_temp.u('B-v5'), pg_temp.u('B-org'), 'CJ05BBB', 'Dacia', 'Spring', 100, 'activ', now() - interval '20 days');

  -- Valoarea de achiziție pe o parte din vehicule (0225 o mută în
  -- `vehicle_costuri`): una cu bani mărunți, una pe un vehicul de pool, una pe
  -- vehiculul șters logic. Restul rămân fără valoare, ca pe producție.
  alter table public.vehicles disable trigger user;
  update public.vehicles v set valoare_achizitie = x.val
    from (values ('A-v1', 65000.00), ('A-v3', 120000.50), ('B-v2', 48000.00), ('B-v5', 91000.00)) x(k, val)
   where v.id = pg_temp.u(x.k);
  alter table public.vehicles enable trigger user;

  -- Datele istorice ale trimiterii și aprobării (triggerul pune now()).
  alter table public.trip_sheets disable trigger user;
  update public.trip_sheets t
     set trimis_la  = coalesce(t.sosire_la, t.plecare_la) + interval '1 hour',
         aprobat_la = case when t.status = 'aprobat' then coalesce(t.sosire_la, t.plecare_la) + interval '20 hours' end
   where t.organization_id in (pg_temp.u('A-org'), pg_temp.u('B-org'), pg_temp.u('C-org'))
     and t.status in ('trimis', 'aprobat')
     and t.trimis_la > t.plecare_la + interval '3 days';
  alter table public.trip_sheets enable trigger user;
end
$$;

-- ═══ Partea a doua: documente, mentenanță, reguli, setări ═══════════════
do $$
declare
  f      text;
  v_org  uuid;
  v_azi  date := app.azi_local();
  r      record;
  v_eq   uuid;
  v_fr   uuid;
  i      int;
begin
  -- Documente de vehicul: expirate, aproape de scadență (7/14/30), departe;
  -- cu și fără cost; o versiune veche înlocuită; una pe tipul `revizie`.
  for r in select * from (values
      ('A-v1', 'rca',       v_azi - 400, v_azi - 35,  540.00),
      ('A-v1', 'rca',       v_azi - 35,  v_azi + 330, 610.00),
      ('A-v1', 'itp',       v_azi - 360, v_azi + 5,   null),
      ('A-v1', 'rovinieta', v_azi - 300, v_azi + 65,  140.00),
      ('A-v2', 'rca',       v_azi - 350, v_azi + 13,  700.00),
      ('A-v2', 'itp',       v_azi - 700, v_azi - 10,  180.00),
      ('A-v2', 'casco',     v_azi - 200, v_azi + 165, 2400.00),
      ('A-v3', 'rca',       v_azi - 300, v_azi + 29,  900.00),
      ('A-v3', 'revizie',   v_azi - 300, v_azi + 60,  null),
      ('A-v4', 'rca',       v_azi - 300, v_azi + 65,  3100.00),
      ('A-v4', 'itp',       v_azi - 150, v_azi + 30,  250.00),
      ('A-v4', 'rovinieta', v_azi - 100, v_azi + 265, 1200.00),
      ('A-v4', 'extinctor', v_azi - 700, v_azi + 3,   null),
      ('A-v5', 'rca',       v_azi - 300, v_azi + 1,   450.00),
      ('A-v6', 'rca',       v_azi - 800, v_azi - 300, 450.00),
      ('B-v1', 'rca',       v_azi - 300, v_azi + 14,  520.00),
      ('B-v1', 'itp',       v_azi - 300, v_azi + 7,   null),
      ('B-v2', 'rca',       v_azi - 300, v_azi + 45,  480.00),
      ('B-v3', 'rca',       v_azi - 300, v_azi - 2,   1500.00),
      ('B-v3', 'itp',       v_azi - 180, v_azi + 180, 200.00),
      ('B-v4', 'rca',       v_azi - 100, v_azi + 265, 800.00),
      ('C-v1', 'rca',       v_azi - 300, v_azi + 20,  400.00),
      ('C-v2', 'rca',       v_azi - 500, v_azi - 120, 400.00),
      ('C-v3', 'rca',       v_azi - 300, v_azi + 40,  400.00),
      ('C-v3', 'itp',       v_azi - 300, v_azi + 8,   150.00)
    ) x(veh, cod, de_la, expira, cost)
  loop
    insert into public.vehicle_documents (organization_id, vehicle_id, document_type_id, numar, emitent,
                                          valabil_de_la, expira_la, cost)
    values (pg_temp.u(left(r.veh, 1) || '-org'), pg_temp.u(r.veh),
            (select id from public.vehicle_document_types where organization_id is null and cod = r.cod and deleted_at is null),
            upper(r.cod) || '-' || r.veh || '-' || r.de_la::text, 'Emitent ' || r.cod,
            r.de_la, r.expira, r.cost);
  end loop;

  -- ── Mentenanță ─────────────────────────────────────────────────────────
  foreach f in array array['A', 'B', 'C'] loop
    v_org := pg_temp.u(f || '-org');
    insert into public.equipment (id, organization_id, cod, denumire, este_iscir, responsabil_employee_id, garantie_expira,
                                  derogare_motiv)
    values (pg_temp.u(f || '-eq1'), v_org, f || '-PRS-01', 'Presă hidraulică', false, pg_temp.e(f || '-E-e3'), v_azi + 10, null),
           (pg_temp.u(f || '-eq2'), v_org, f || '-CMP-01', 'Compresor', true, null, null, null),
           (pg_temp.u(f || '-eq3'), v_org, f || '-STV-01', 'Stivuitor', true, null, v_azi - 100, null);

    -- planuri pe zile: scadent depășit, aproape, departe; unul pe contor
    insert into public.maintenance_plans (organization_id, equipment_id, denumire, periodicitate_zile, ultima_executie,
                                          responsabil_employee_id)
    values (v_org, pg_temp.u(f || '-eq1'), 'Revizie lunară',     30,  v_azi - 40, pg_temp.e(f || '-E-e3')),
           (v_org, pg_temp.u(f || '-eq2'), 'Verificare PRAM',    365, v_azi - 355, null),
           (v_org, pg_temp.u(f || '-eq3'), 'Revizie anuală',     365, v_azi - 100, pg_temp.e(f || '-E-e3'));

    insert into public.iscir_authorizations (organization_id, equipment_id, numar, tip, valabil_pana, scadenta_verificare_tehnica)
    values (v_org, pg_temp.u(f || '-eq2'), f || '-ISCIR-001', 'PT C4', v_azi + 12, v_azi + 6),
           (v_org, pg_temp.u(f || '-eq3'), f || '-ISCIR-002', 'PT R1', v_azi - 5, null);

    -- intervenții în toate stările, pe doi ani, cu una ștearsă
    i := 0;
    for r in select * from (values
        (date '2025-03-10', 'preventiva',       'reusita',  false),
        (date '2025-11-20', 'corectiva',        'partiala', false),
        (date '2025-12-31', 'verificare_legala','reusita',  false),
        (date '2026-01-01', 'corectiva',        'esuata',   false),
        (date '2026-02-14', 'preventiva',       'amanata',  false),
        (date '2026-05-05', 'predictiva',       'reusita',  true),
        (date '2026-09-30', 'corectiva',        'reusita',  false)
      ) x(d, tip, rez, sters)
    loop
      i := i + 1;
      insert into public.maintenance_interventions (organization_id, equipment_id, tip, data, descriere, rezultat,
                                                    cost_piese, cost_manopera, executant_extern, created_at, deleted_at)
      values (v_org, case when i % 2 = 0 then pg_temp.u(f || '-eq1') else pg_temp.u(f || '-eq3') end,
              r.tip::public.maintenance_kind, r.d, 'Intervenția ' || i || ' din ' || r.d::text,
              r.rez::public.maintenance_result, 100 * i, 50 * i, 'Service Extern SRL',
              r.d + time '10:00', case when r.sters then r.d + 1 end);
    end loop;

    -- sesizări: nou, în lucru, rezolvat vechi (40 și 10 zile), rezolvat de 6 zile
    -- (între implicitul de 5 al lui C și pragul de 7 al lui A), rezolvat de ieri,
    -- închis, respins; una critică neatribuită veche
    for r in select * from (values
        ('nou',       'medie',   0,  false),
        ('nou',       'critica', 3,  false),
        ('in_lucru',  'ridicata',5,  false),
        ('rezolvat',  'medie',   40, false),
        ('rezolvat',  'scazuta', 10, false),
        ('rezolvat',  'ridicata', 6, false),
        ('rezolvat',  'medie',   1,  false),
        ('inchis',    'medie',   60, false),
        ('respins',   'scazuta', 20, false)
      ) x(st, urg, zile, sters)
    loop
      insert into public.fault_reports (organization_id, equipment_id, raportat_de_employee_id, raportat_de_user_id,
                                        descriere, urgenta, raportat_la)
      values (v_org, pg_temp.u(f || '-eq1'), pg_temp.e(f || '-E-e1'), pg_temp.u(f || '-e1'),
              'Defect ' || r.st || ' de acum ' || r.zile || ' zile', r.urg::public.fault_urgency,
              now() - make_interval(days => r.zile + 2))
      returning id into v_fr;
      if r.st <> 'nou' then
        perform set_config('x5.fr', v_fr::text, true);
        update public.fault_reports
           set status = case when r.st = 'respins' then 'respins' else 'in_lucru' end::public.fault_status,
               atribuit_employee_id = case when r.st = 'respins' then null else pg_temp.e(f || '-E-e3') end,
               motiv_respingere = case when r.st = 'respins' then 'Nu e defect.' end,
               motiv_respingere_tip = case when r.st = 'respins' then 'nu_tine_de_mentenanta' end
         where id = v_fr;
      end if;
      if r.st in ('rezolvat', 'inchis') then
        insert into public.maintenance_interventions (organization_id, equipment_id, tip, data, descriere, rezultat,
                                                      fault_report_id, executant_employee_id, created_at)
        values (v_org, pg_temp.u(f || '-eq1'), 'corectiva', v_azi - r.zile, 'Reparația sesizării', 'reusita',
                v_fr, pg_temp.e(f || '-E-e3'), now() - make_interval(days => r.zile))
        returning id into v_eq;
        update public.fault_reports set status = 'rezolvat', nota_rezolvare = 'Reparat.', intervention_id = v_eq
         where id = v_fr and status <> 'rezolvat';
      end if;
      if r.st = 'inchis' then
        update public.fault_reports set status = 'inchis' where id = v_fr;
      end if;
      -- data rezolvării, istorică
      if r.st in ('rezolvat', 'inchis') then
        alter table public.fault_reports disable trigger user;
        update public.fault_reports
           set rezolvat_la = now() - make_interval(days => r.zile),
               inchis_la = case when r.st = 'inchis' then now() - make_interval(days => r.zile - 5) end
         where id = v_fr;
        alter table public.fault_reports enable trigger user;
      end if;
    end loop;
  end loop;

  -- Valoarea de achiziție pe o parte din echipamente (0232 o mută în
  -- `equipment_costuri`): A-eq1 (cu responsabil și tehnician e3), una cu bani
  -- mărunți în B, una în C. Restul rămân fără valoare, ca pe producție.
  alter table public.equipment disable trigger user;
  update public.equipment e set valoare_achizitie = x.val
    from (values ('A-eq1', 45000.00), ('B-eq2', 12000.50), ('C-eq3', 8000.00)) x(k, val)
   where e.id = pg_temp.u(x.k);
  alter table public.equipment enable trigger user;

  -- ── Setările mentenanței ───────────────────────────────────────────────
  -- A: responsabil activ, închidere la 7 zile. B: responsabil plecat (e3 inactiv).
  -- C: fără rând de setări.
  insert into public.maintenance_settings (organization_id, responsabili, rsvti_employee_id, inchidere_automata_zile)
  values (pg_temp.u('A-org'), array[pg_temp.e('A-E-e3')], pg_temp.e('A-E-e3'), 7),
         (pg_temp.u('B-org'), array[pg_temp.e('B-E-e3')], null, 14);

  -- ── Reguli de alertă proprii ───────────────────────────────────────────
  -- A: '*' 60/30/7 și maintenance_plan 90/30. B: vehicle_document 45/15 și
  -- '*' 400/30 (peste plafonul de 365 al setărilor). C: nimic (implicit).
  -- Plus o versiune VIITOARE (A, vehicle_document) care nu trebuie aplicată azi.
  insert into public.alert_rules (organization_id, entity_type, kind, praguri_zile, alerteaza_la_depasire, valabil_de_la)
  values (pg_temp.u('A-org'), '*',                '*', array[60, 30, 7], true, date '2025-01-01'),
         (pg_temp.u('A-org'), 'maintenance_plan', '*', array[90, 30],    true, date '2025-06-01'),
         (pg_temp.u('A-org'), 'vehicle_document', '*', array[20, 10],    true, app.azi_local() + 10),
         (pg_temp.u('B-org'), 'vehicle_document', '*', array[45, 15],    true, date '2025-01-01'),
         (pg_temp.u('B-org'), '*',                '*', array[400, 30],   true, date '2025-01-01');
end
$$;

-- ═══ Instantaneul de dinainte, în tabele temporare (sesiunea psql le ține
--     peste tranzacțiile migrărilor) ════════════════════════════════════════
create temp table x5_firme as
  select id, slug from public.organizations where slug like 'x5-firma-%';

create temp table x5_vehicule as
  select v.id, v.status::text as status,
         md5(row(v.id, v.organization_id, v.nr_inmatriculare, v.marca, v.model, v.vin, v.categorie,
                  v.tip_combustibil, v.consum_mediu_declarat, v.km_curent, v.employee_id, v.status,
                  v.data_iesire, v.motiv_iesire, v.pool, v.updated_at, v.updated_by, v.deleted_at)::text) as amprenta
    from public.vehicles v where v.organization_id in (select id from x5_firme);

create temp table x5_chei (res text, act text);
insert into x5_chei values ('vehicles','read'), ('vehicles','update'), ('trip_sheets','read'),
  ('trip_sheets','create'), ('trip_sheets','update'), ('trip_sheets','approve'),
  ('fuel_entries','read'), ('fuel_entries','create');

create temp table x5_scop as
  select m.organization_id, m.user_id, m.id as member_id, m.role::text as rol, m.status::text as stare, k.res, k.act,
         internal.scope_membru(m.organization_id, m.user_id, k.res, k.act)::text as scop,
         exists (select 1 from public.role_permissions rp
                  where rp.deleted_at is null and rp.resource = k.res and rp.action = k.act
                    and ((rp.member_id = m.id)
                         or (rp.member_id is null and rp.organization_id = m.organization_id and rp.role = m.role))) as suprascris
    from public.organization_members m cross join x5_chei k
   where m.organization_id in (select id from x5_firme);

-- Pragurile pe care le aplică motorul (`genereaza_alerte`, 0008) fiecărui tip.
create or replace function pg_temp.prag_efectiv(p_org uuid, p_tip text) returns text language sql stable
as $$ select coalesce((select ar.praguri_zile::text from public.alert_rules ar
          where ar.organization_id = p_org and ar.deleted_at is null and ar.valabil_de_la <= app.azi_local()
            and ar.entity_type in (p_tip, '*') and ar.kind = '*'
          order by (ar.entity_type = p_tip) desc, ar.valabil_de_la desc limit 1), 'implicit') $$;
create temp table x5_praguri as
  select f.id as organization_id, t.tip, pg_temp.prag_efectiv(f.id, t.tip) as efectiv
    from x5_firme f
    cross join (values ('maintenance_plan'), ('iscir_authorization'), ('equipment'), ('vehicle_document')) t(tip);

create temp table x5_numarate as
  select (select count(*) from public.trip_sheets where organization_id in (select id from x5_firme)) as foi,
         (select count(*) from public.trip_sheets where organization_id in (select id from x5_firme) and numar is not null) as foi_cu_numar,
         (select count(*) from public.maintenance_interventions where organization_id in (select id from x5_firme)) as interventii;

-- Banii care trebuie să ajungă în tabelele 1:1 ale lui 0225.
create temp table x5_costuri as
  select 'vehicul'::text as fel, v.id, v.organization_id, v.valoare_achizitie as suma
    from public.vehicles v
   where v.organization_id in (select id from x5_firme) and v.valoare_achizitie is not null
  union all
  select 'document', d.id, d.organization_id, d.cost
    from public.vehicle_documents d
   where d.organization_id in (select id from x5_firme) and d.cost is not null;

-- Valorile echipamentelor care trebuie să ajungă în `equipment_costuri` (0232).
create temp table x5_costuri_echipamente as
  select e.id, e.organization_id, e.valoare_achizitie as suma
    from public.equipment e
   where e.organization_id in (select id from x5_firme) and e.valoare_achizitie is not null;

\echo '  ▶ aplic migrările ramurii, în ordine lexicală'
\ir ../../supabase/migrations/0191_mentenanta_zilnica.sql
\ir ../../supabase/migrations/0199_flota_roluri.sql
\ir ../../supabase/migrations/0200_flota_foaia_zilnica.sql
\ir ../../supabase/migrations/0201_flota_conformitate_zilnica.sql
\ir ../../supabase/migrations/0202_flota_tipuri_si_fisiere.sql
\ir ../../supabase/migrations/0203_flota_service_costuri.sql
\ir ../../supabase/migrations/0204_flota_soferi.sql
\ir ../../supabase/migrations/0205_flota_fiscal.sql
\ir ../../supabase/migrations/0206_flota_amenzi_daune.sql
\ir ../../supabase/migrations/0210_mentenanta_interventii_complete.sql
\ir ../../supabase/migrations/0211_mentenanta_iscir_conformitate.sql
\ir ../../supabase/migrations/0212_mentenanta_fisiere_scriu_doar_membrii.sql
\ir ../../supabase/migrations/0213_flota_bon_ocr.sql
\ir ../../supabase/migrations/0214_flota_carduri_combustibil.sql
\ir ../../supabase/migrations/0215_flota_proces_verbal.sql
\ir ../../supabase/migrations/0216_flota_rezervari.sql
\ir ../../supabase/migrations/0217_flota_uit_etransport.sql
\ir ../../supabase/migrations/0218_flota_iesire_din_parc.sql
\ir ../../supabase/migrations/0225_flota_costuri_ascunse.sql
\ir ../../supabase/migrations/0226_securitate_reziduala.sql
\ir ../../supabase/migrations/0232_mentenanta_costuri_echipament.sql
\echo '  ▶ verific'

do $$
declare
  v_esecuri int := 0;
  v_n       int;
  v_m       int;
  v_txt     text;
begin
  -- ═══ (1) o cursă pe fiecare foaie, identică cu antetul ════════════════════
  select count(*) filter (where n <> 1), count(*) into v_n, v_m
    from (select t.id, (select count(*) from public.trip_sheet_curse c where c.trip_sheet_id = t.id) n
            from public.trip_sheets t where t.organization_id in (select id from x5_firme)) z;
  if v_n = 0 and v_m = (select foi from x5_numarate) and (select count(*) from public.trip_sheet_curse c
       where c.organization_id in (select id from x5_firme)) = v_m then
    raise notice '  ✓ (1) % foi, % curse: fiecare foaie are exact o cursă', v_m, v_m;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) % foi fără exact o cursă, din % (înainte: %)', v_n, v_m, (select foi from x5_numarate);
  end if;
  select count(*) into v_n
    from public.trip_sheets t join public.trip_sheet_curse c on c.trip_sheet_id = t.id
   where t.organization_id in (select id from x5_firme)
     and ((c.plecare_la, c.sosire_la, c.km_plecare, c.km_sosire, c.deleted_at, c.organization_id)
            is distinct from (t.plecare_la, t.sosire_la, t.km_plecare, t.km_sosire, t.deleted_at, t.organization_id)
          or c.pana_la_loc is distinct from left(t.traseu, 200) or c.scop is distinct from left(t.scop, 500)
          or c.de_la_loc is not null or c.ordine <> 1);
  if v_n = 0 then
    raise notice '  ✓ (1) cursa copiază antetul: ore, km, ștergerea, traseul (tăiat la 200), scopul';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) % curse diferă de antetul foii lor', v_n;
  end if;

  -- ═══ (2) ziua României ═══════════════════════════════════════════════════
  select count(*) into v_n from public.trip_sheets t
   where t.organization_id in (select id from x5_firme)
     and t.data is distinct from (t.plecare_la at time zone 'Europe/Bucharest')::date;
  select string_agg(format('%s: %s ≠ %s', t.traseu, t.data, x.zi), '; ') into v_txt
    from (values ('Margine iarna-00:30', date '2025-10-26'), ('Margine iarna-zi-urm', date '2025-10-27'),
                 ('Margine vara-00:30', date '2026-03-29'), ('Margine vara-zi-urm', date '2026-03-30'),
                 ('Margine peste-miezul', date '2026-07-01'), ('Margine utc-09-ziua', date '2026-08-09'),
                 ('Margine utc-09-noaptea', date '2026-08-10')) x(traseu, zi)
    left join public.trip_sheets t on t.traseu = x.traseu and t.organization_id in (select id from x5_firme)
   where t.data is distinct from x.zi;
  if v_n = 0 and v_txt is null then
    raise notice '  ✓ (2) `data` e ziua României: miezul nopții, ora de vară 29.03.2026, ora de iarnă 26.10.2025';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) % foi cu ziua greșită; margini: %', v_n, v_txt;
  end if;

  -- ═══ (3) unicitatea pe (vehicul, zi) ═════════════════════════════════════
  select count(*) into v_n from public.trip_sheets t
   where t.organization_id in (select id from x5_firme) and t.data = date '2026-09-15'
     and t.vehicle_id = md5('x5:B-v4')::uuid;
  select count(*) into v_m from public.trip_sheets t
   where t.organization_id in (select id from x5_firme) and t.data = date '2026-09-20'
     and t.vehicle_id = md5('x5:B-v4')::uuid;
  if to_regclass('public.ts_vehicul_zi_uq') is not null and v_n = 2 and v_m = 2 then
    raise notice '  ✓ (3) ts_vehicul_zi_uq creat peste „respinsă + aprobată” și „ștearsă + trimisă” în aceeași zi';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) indexul % / foile zilelor de probă: % și %', to_regclass('public.ts_vehicul_zi_uq'), v_n, v_m;
  end if;

  -- ═══ (4) instantaneul și numerele ════════════════════════════════════════
  select count(*) filter (where status in ('trimis', 'aprobat') and (vehicul_nr is null or vehicul_categorie is null)),
         count(*) filter (where status not in ('trimis', 'aprobat') and vehicul_nr is not null)
    into v_n, v_m
    from public.trip_sheets where organization_id in (select id from x5_firme);
  if v_n = 0 and v_m = 0
     and (select count(*) from public.trip_sheets where organization_id in (select id from x5_firme) and numar is not null)
         = (select foi_cu_numar from x5_numarate) then
    raise notice '  ✓ (4) instantaneul doar pe trimise/aprobate; niciun număr FP dat retroactiv';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) fără instantaneu: %, instantaneu pe ciorne: %', v_n, v_m;
  end if;

  -- ═══ (5) numerotarea PV retroactivă ══════════════════════════════════════
  with n as (
    select organization_id, split_part(numar, '-', 2)::int an, split_part(numar, '-', 3)::int nr, data, created_at, id
      from public.maintenance_interventions where organization_id in (select id from x5_firme))
  select format('dubluri %s, găuri %s, ordine %s, contor %s, an %s, total %s',
           (select count(*) from (select organization_id, an, nr from n group by 1,2,3 having count(*) > 1) d),
           (select count(*) from (select organization_id, an, max(nr) mx, count(*) c from n group by 1,2) g where mx <> c),
           (select count(*) from (select nr, row_number() over (partition by organization_id, an order by data, created_at, id) rn from n) z where rn <> nr),
           (select count(*) from (select organization_id, an, count(*) c from n group by 1,2) g
              left join public.document_sequences s on s.organization_id = g.organization_id
                    and s.document_type = 'pv_interventie' and s.year = g.an
             where s.next_number is distinct from g.c + 1),
           (select count(*) from n where an <> extract(year from data)),
           (select count(*) from n))
    into v_txt;
  if v_txt = format('dubluri 0, găuri 0, ordine 0, contor 0, an 0, total %s', (select interventii from x5_numarate)) then
    raise notice '  ✓ (5) PV-AAAA-NNNN retroactiv: %', v_txt;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) numerotarea retroactivă: %', v_txt;
  end if;

  -- ═══ (6) ieșirile din parc ═══════════════════════════════════════════════
  select count(*) into v_n
    from x5_vehicule x join public.vehicles v on v.id = x.id
   where x.status not in ('vandut', 'casat')
     and x.amprenta <> md5(row(v.id, v.organization_id, v.nr_inmatriculare, v.marca, v.model, v.vin, v.categorie,
                  v.tip_combustibil, v.consum_mediu_declarat, v.km_curent, v.employee_id, v.status,
                  v.data_iesire, v.motiv_iesire, v.pool, v.updated_at, v.updated_by, v.deleted_at)::text);
  select count(*) into v_m
    from public.vehicles v
   where v.organization_id in (select id from x5_firme) and v.deleted_at is null and v.status in ('vandut', 'casat')
     and (select count(*) from public.vehicle_exits e where e.vehicle_id = v.id and e.preluata_din_istoric
            and not exists (select 1 from public.vehicle_exit_obligations o where o.exit_id = e.id)) = 1
     and nullif(btrim(v.motiv_iesire), '') is not null;
  if v_n = 0 and v_m = (select count(*) from x5_vehicule x join public.vehicles v on v.id = x.id
                         where x.status in ('vandut', 'casat') and v.deleted_at is null) and v_m > 0 then
    raise notice '  ✓ (6) vehiculele active neatinse; % ieșite au ieșirea din istoric, zero termene și motiv', v_m;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) vehicule active schimbate: %, ieșite complete: %', v_n, v_m;
  end if;

  -- ═══ (7) drepturile ══════════════════════════════════════════════════════
  select string_agg(format('%s %s %s:%s %s→%s', f.slug, s.rol, s.res, s.act, s.scop, z.dupa), '; ') into v_txt
    from x5_scop s
    join x5_firme f on f.id = s.organization_id
    cross join lateral (select internal.scope_membru(s.organization_id, s.user_id, s.res, s.act)::text as dupa) z
    left join (values ('employee', 'trip_sheets', 'read', 'own'), ('employee', 'trip_sheets', 'create', 'own'),
                      ('employee', 'trip_sheets', 'update', 'own'), ('employee', 'vehicles', 'read', 'own'),
                      ('manager', 'vehicles', 'read', 'team'), ('manager', 'trip_sheets', 'create', 'own'),
                      ('manager', 'trip_sheets', 'update', 'own')) i(rol, res, act, scop)
      on i.rol = s.rol and i.res = s.res and i.act = s.act
   where z.dupa is distinct from
         case when i.scop is not null and not s.suprascris and s.stare = 'active' then i.scop else s.scop end;
  select count(*) into v_n from x5_scop where suprascris;
  if v_txt is null and v_n >= 6 then
    raise notice '  ✓ (7) 0199 lărgește exact cele 7 chei pe rol; % chei suprascrise (firmă/membru) rămân cum erau', v_n;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) drepturi neașteptate după 0199 (suprascrise: %): %', v_n, v_txt;
  end if;

  -- ═══ (8) pragurile ═══════════════════════════════════════════════════════
  select string_agg(format('%s %s: %s → %s', f.slug, p.tip, p.efectiv, pg_temp.prag_efectiv(p.organization_id, p.tip)), '; ')
    into v_txt
    from x5_praguri p join x5_firme f on f.id = p.organization_id
   where pg_temp.prag_efectiv(p.organization_id, p.tip) <> p.efectiv;
  if v_txt is null then
    raise notice '  ✓ (8) motorul aplică fiecărui tip aceleași praguri ca înainte (plan, ISCIR, echipament, document)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) migrarea a mutat tăcut pragurile: %', v_txt;
  end if;
  select string_agg(format('%s mentenanță %s / flotă %s', f.slug,
           coalesce((select s.praguri_alerta_zile::text from public.maintenance_settings s
                      where s.organization_id = f.id and s.deleted_at is null), '-'),
           coalesce((select s.praguri_alerta_zile::text from public.fleet_settings s
                      where s.organization_id = f.id and s.deleted_at is null), '-')), '; ' order by f.slug)
    into v_txt from x5_firme f;
  if v_txt = 'x5-firma-a mentenanță {90,30} / flotă {60,30,7}; x5-firma-b mentenanță {30,14,7} / flotă {45,15}; x5-firma-c mentenanță - / flotă -' then
    raise notice '  ✓ (8) setările arată pragurile aplicate: %', v_txt;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) setările după migrare: %', v_txt;
  end if;

  -- ═══ (11) 0225: banii se mută exact, coloanele vechi rămân goale ══════════
  if to_regclass('public.vehicle_costuri') is null or to_regclass('public.vehicle_document_costuri') is null then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (11) lipsesc tabelele costurilor (vehicle_costuri / vehicle_document_costuri)';
  else
    execute $q$
      select count(*) from x5_costuri x
       where x.fel = 'vehicul' and not exists (
         select 1 from public.vehicle_costuri c
          where c.vehicle_id = x.id and c.organization_id = x.organization_id
            and c.valoare_achizitie = x.suma)
    $q$ into v_n;
    execute $q$
      select count(*) from x5_costuri x
       where x.fel = 'document' and not exists (
         select 1 from public.vehicle_document_costuri c
          where c.document_id = x.id and c.organization_id = x.organization_id and c.cost = x.suma)
    $q$ into v_m;
    execute $q$
      select (select count(*) from public.vehicle_costuri c where c.organization_id in (select id from x5_firme))
           + (select count(*) from public.vehicle_document_costuri c where c.organization_id in (select id from x5_firme))
           - (select count(*) from x5_costuri)
    $q$ into v_txt;
    if v_n = 0 and v_m = 0 and v_txt = '0'
       and (select count(*) from x5_costuri where fel = 'vehicul') = 4
       and (select count(*) from x5_costuri where fel = 'document') > 0 then
      raise notice '  ✓ (11) 0225 mută exact % valori de achiziție și % costuri de document, fără rânduri în plus',
        (select count(*) from x5_costuri where fel = 'vehicul'), (select count(*) from x5_costuri where fel = 'document');
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (11) vehicule nemutate: %, documente nemutate: %, rânduri în plus: %', v_n, v_m, v_txt;
    end if;
  end if;
  select count(*) into v_n from public.vehicles
   where organization_id in (select id from x5_firme) and valoare_achizitie is not null;
  select count(*) into v_m from public.vehicle_documents
   where organization_id in (select id from x5_firme) and cost is not null;
  if v_n = 0 and v_m = 0
     and exists (select 1 from pg_constraint where conrelid = 'public.vehicles'::regclass and contype = 'c'
                    and pg_get_constraintdef(oid) like '%valoare_achizitie IS NULL%'
                    and pg_get_constraintdef(oid) not like '%>=%')
     and exists (select 1 from pg_constraint where conrelid = 'public.vehicle_documents'::regclass and contype = 'c'
                    and pg_get_constraintdef(oid) like '%cost IS NULL%'
                    and pg_get_constraintdef(oid) not like '%>=%') then
    raise notice '  ✓ (11) coloanele vechi (vehicles.valoare_achizitie, vehicle_documents.cost) sunt goale și păzite de CHECK';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (11) coloane vechi încă pline: vehicule %, documente % (sau CHECK-ul lipsește)', v_n, v_m;
  end if;

  -- ═══ (12) 0232: valoarea echipamentelor se mută exact ════════════════════
  if to_regclass('public.equipment_costuri') is null then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (12) lipsește tabela equipment_costuri';
  else
    execute $q$
      select count(*) from x5_costuri_echipamente x
       where not exists (
         select 1 from public.equipment_costuri c
          where c.equipment_id = x.id and c.organization_id = x.organization_id
            and c.valoare_achizitie = x.suma)
    $q$ into v_n;
    execute $q$
      select (select count(*) from public.equipment_costuri c where c.organization_id in (select id from x5_firme))
           - (select count(*) from x5_costuri_echipamente)
    $q$ into v_txt;
    select count(*) into v_m from public.equipment
     where organization_id in (select id from x5_firme) and valoare_achizitie is not null;
    if v_n = 0 and v_txt = '0' and v_m = 0
       and (select count(*) from x5_costuri_echipamente) = 3
       and exists (select 1 from pg_constraint where conrelid = 'public.equipment'::regclass and contype = 'c'
                      and pg_get_constraintdef(oid) like '%valoare_achizitie IS NULL%'
                      and pg_get_constraintdef(oid) not like '%>=%') then
      raise notice '  ✓ (12) 0232 mută exact % valori de achiziție ale echipamentelor; coloana veche e goală și păzită de CHECK',
        (select count(*) from x5_costuri_echipamente);
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (12) echipamente nemutate: %, rânduri în plus: %, coloană veche plină: % (sau CHECK-ul lipsește)',
        v_n, v_txt, v_m;
    end if;
  end if;

  if v_esecuri > 0 then
    raise exception 'PROBA MIGRĂRI PE DATE (invariante): % verificări picate', v_esecuri;
  end if;
end $$;

-- ═══ (9) prima rulare a joburilor zilnice ═════════════════════════════════
create temp table x5_n0 as select id from public.notifications;
create temp table x5_f0 as select id, status::text as status, rezolvat_la from public.fault_reports
  where organization_id in (select id from x5_firme);
select internal.conformitate_zilnica() as x5_flota \gset
select internal.mentenanta_zilnica() as x5_mentenanta \gset
\echo '    flotă:' :'x5_flota'
\echo '    mentenanță:' :'x5_mentenanta'
create temp table x5_n1 as select id from public.notifications;
select internal.conformitate_zilnica() as x5_flota2 \gset
select internal.mentenanta_zilnica() as x5_mentenanta2 \gset

do $$
declare
  v_esecuri int := 0;
  v_n       int;
  v_m       int;
  v_txt     text;
begin
  select count(*) into v_n from public.notifications n
   where n.id not in (select id from x5_n0) and n.organization_id in (select id from x5_firme);
  select string_agg(format('%s/%s: %s', z.slug, z.modul, z.n), ', ') into v_txt
    from (select f.slug, case when n.entity_type = 'maintenance_rezumat' then 'mentenanță' else 'flotă' end as modul,
                 n.user_id, count(*) n
            from public.notifications n join x5_firme f on f.id = n.organization_id
           where n.id not in (select id from x5_n0) and n.entity_type is distinct from 'fault_report'
           group by 1, 2, 3 having count(*) > 1) z;
  select count(*) into v_m from public.notifications n
   where n.id not in (select id from x5_n1) and n.organization_id in (select id from x5_firme);
  if v_txt is null and v_m = 0 then
    raise notice '  ✓ (9) prima rulare: % notificări pe 3 firme, cel mult un rezumat pe om și modul; a doua rulare: 0', v_n;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) rezumate multiple pe om: %; la a doua rulare: %', v_txt, v_m;
  end if;

  -- Închiderea automată: A la 7 zile, B la 14, C fără setări (5 zile, implicitul
  -- din `internal.sesizari_inchide_rezolvate`, 0181:1045, același cu al coloanei).
  -- Sesizarea de 6 zile se închide doar la C.
  select string_agg(format('%s %s', f.slug, (
           select count(*) from public.fault_reports r join x5_f0 o on o.id = r.id
            where r.organization_id = f.id and o.status = 'rezolvat' and r.status = 'inchis')), ', ' order by f.slug)
    into v_txt from x5_firme f;
  select count(*) into v_n from public.fault_reports r join x5_f0 o on o.id = r.id
   where o.status = 'rezolvat' and r.status = 'inchis'
     and o.rezolvat_la > now() - make_interval(days => coalesce(
           (select s.inchidere_automata_zile from public.maintenance_settings s
             where s.organization_id = r.organization_id and s.deleted_at is null), 5));
  if v_txt = 'x5-firma-a 2, x5-firma-b 1, x5-firma-c 3' and v_n = 0 then
    raise notice '  ✓ (9) sesizări „rezolvat” închise automat după pragul firmei: %', v_txt;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) închideri automate: % (% înainte de prag)', v_txt, v_n;
  end if;

  if v_esecuri > 0 then
    raise exception 'PROBA MIGRĂRI PE DATE (joburi): % verificări picate', v_esecuri;
  end if;
end $$;

-- ═══ (10) căi de scriere pe rândurile vechi, sub rolul real ═══════════════
do $$
declare
  v_esecuri int := 0;
  v_ts  uuid;
  v_c   uuid;
  v_st  text;
  v_nr  text;
  v_n   int;
  v_m   int;
  v_txt text;
  v_ok  boolean;
  v_asteptat text;
begin
  -- (10a) șoferul B-e1 își trimite o ciornă de dinainte (cursa din backfill)
  select t.id into v_ts from public.trip_sheets t
   where t.vehicle_id = pg_temp.u('B-v1') and t.status = 'draft' and t.deleted_at is null and t.sosire_la is not null
   order by t.plecare_la limit 1;
  perform set_config('request.jwt.claim.sub', pg_temp.u('B-e1')::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set status = 'trimis' where id = v_ts returning status::text, numar into v_st, v_nr;
    reset role;
    if v_st = 'trimis' and v_nr like 'FP-%' then
      raise notice '  ✓ (10a) ciorna de dinainte se trimite și primește %', v_nr;
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (10a) ciorna de dinainte: stare %, număr %', v_st, v_nr;
    end if;
  exception when others then
    reset role; v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10a) ciorna de dinainte nu se trimite: % (%)', sqlerrm, sqlstate;
  end;

  -- (10b) managerul B o aprobă, apoi aprobă o foaie trimisă ÎNAINTE de migrare
  perform set_config('request.jwt.claim.sub', pg_temp.u('B-mgr')::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set status = 'aprobat' where id = v_ts returning status::text into v_st;
    select t.id into v_c from public.trip_sheets t
     where t.vehicle_id = pg_temp.u('B-v4') and t.status = 'trimis' and t.deleted_at is null limit 1;
    update public.trip_sheets set status = 'aprobat' where id = v_c returning numar into v_nr;
    get diagnostics v_n = row_count;
    reset role;
    if v_st = 'aprobat' and v_n = 1 then
      raise notice '  ✓ (10b) managerul aprobă ciorna trimisă și foaia trimisă înainte de migrare (număr: %)', coalesce(v_nr, 'niciunul, ca înainte');
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (10b) aprobarea: %, foaia veche: % rânduri', v_st, v_n;
    end if;
  exception when others then
    reset role; v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10b) aprobarea pe foi de dinainte: % (%)', sqlerrm, sqlstate;
  end;

  -- (10c) ciorna fără sosire (cursa deschisă din backfill): șoferul o închide
  select t.id into v_ts from public.trip_sheets t
   where t.vehicle_id = pg_temp.u('B-v4') and t.status = 'draft' and t.deleted_at is null and t.sosire_la is null;
  select c.id into v_c from public.trip_sheet_curse c where c.trip_sheet_id = v_ts;
  perform set_config('request.jwt.claim.sub', pg_temp.u('B-e1')::text, true);
  set local role authenticated;
  begin
    update public.trip_sheet_curse
       set sosire_la = plecare_la + interval '2 hours', km_sosire = km_plecare + 40,
           de_la_loc = 'Sediu', pana_la_loc = 'Client', scop = 'Livrare'
     where id = v_c;
    update public.trip_sheets set status = 'trimis' where id = v_ts returning status::text, km_sosire into v_st, v_n;
    reset role;
    if v_st = 'trimis' and v_n is not null then
      raise notice '  ✓ (10c) cursa deschisă se închide, antetul o urmează (km sosire %), foaia se trimite', v_n;
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (10c) cursa deschisă: stare %, km sosire %', v_st, v_n;
    end if;
  exception when others then
    reset role; v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10c) cursa deschisă nu se închide: % (%)', sqlerrm, sqlstate;
  end;

  -- (10d) respinsă → ciornă, în ziua unei foi aprobate a aceluiași vehicul
  select t.id into v_ts from public.trip_sheets t where t.vehicle_id = pg_temp.u('B-v4') and t.status = 'respins';
  perform set_config('request.jwt.claim.sub', pg_temp.u('B-e1')::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set status = 'draft' where id = v_ts;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10d) foaia respinsă a redevenit ciornă peste foaia aprobată a zilei';
  exception
    when unique_violation then
      reset role;
      if sqlerrm like '%ts_vehicul_zi_uq%' then
        raise notice '  ✓ (10d) respinsă → ciornă peste foaia aprobată a zilei: 23505 pe ts_vehicul_zi_uq (tradus în flota/erori.ts)';
      else
        v_esecuri := v_esecuri + 1;
        raise warning '  ✗ (10d) altă unicitate: %', sqlerrm;
      end if;
    when others then
      reset role; v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (10d) refuz neașteptat: % (%)', sqlerrm, sqlstate;
  end;

  -- (10e) org_admin A: intervenție nouă, apoi editarea uneia vechi
  perform set_config('request.jwt.claim.sub', pg_temp.u('A-admin')::text, true);
  v_asteptat := 'PV-' || extract(year from app.azi_local())::text || '-' || lpad((
    select count(*) + 1 from public.maintenance_interventions i
     where i.organization_id = pg_temp.u('A-org') and i.numar like 'PV-' || extract(year from app.azi_local())::text || '-%')::text, 4, '0');
  set local role authenticated;
  begin
    insert into public.maintenance_interventions (organization_id, equipment_id, tip, data, descriere, rezultat, executant_extern)
    values (pg_temp.u('A-org'), pg_temp.u('A-eq1'), 'preventiva', app.azi_local(), 'După migrare', 'reusita', 'Service SRL')
    returning numar into v_nr;
    update public.maintenance_interventions set descriere = descriere || ' (corectat)'
     where id = (select id from public.maintenance_interventions
                  where organization_id = pg_temp.u('A-org') and numar like 'PV-2025-%' and deleted_at is null
                  order by numar limit 1)
    returning numar into v_st;
    reset role;
    if v_nr = v_asteptat and v_st like 'PV-2025-%' then
      raise notice '  ✓ (10e) intervenția nouă continuă numerotarea (%), cea veche se editează și își păstrează %', v_nr, v_st;
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (10e) intervenția nouă: % (așteptat %), cea veche: %', v_nr, v_asteptat, v_st;
    end if;
  exception when others then
    reset role; v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10e) intervențiile: % (%)', sqlerrm, sqlstate;
  end;

  -- (10f) org_admin A stornează o foaie aprobată veche, cu număr scris de mână
  select t.id into v_ts from public.trip_sheets t
   where t.organization_id = pg_temp.u('A-org') and t.status = 'aprobat' and t.numar is not null and t.deleted_at is null
   order by t.plecare_la limit 1;
  set local role authenticated;
  begin
    update public.trip_sheets set deleted_at = now() where id = v_ts;
    get diagnostics v_n = row_count;
    reset role;
    if v_n = 1 then
      raise notice '  ✓ (10f) foaia aprobată de dinainte se stornează';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (10f) stornarea a atins % rânduri', v_n;
    end if;
  exception when others then
    reset role; v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10f) stornarea foii vechi: % (%)', sqlerrm, sqlstate;
  end;

  -- (10g) predarea peste o alocare deschisă de dinainte (cu proces-verbal, 0215)
  set local role authenticated;
  begin
    insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, km_predare, created_by, updated_by)
    select pg_temp.u('A-org'), pg_temp.u('A-v2'), pg_temp.e('A-E-e2'), now(),
           (select km_curent from public.vehicles where id = pg_temp.u('A-v2')), pg_temp.u('A-admin'), pg_temp.u('A-admin');
    reset role;
    select count(*) into v_n from public.vehicle_assignments
     where vehicle_id = pg_temp.u('A-v2') and pana_la is null and deleted_at is null;
    if v_n = 1 then
      raise notice '  ✓ (10g) predarea închide alocarea de dinainte; rămâne una deschisă';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (10g) după predare: % alocări deschise', v_n;
    end if;
  exception when others then
    reset role; v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10g) predarea peste alocarea veche: % (%)', sqlerrm, sqlstate;
  end;

  -- (10h) ieșirea din parc a unui vehicul cu foi și documente de dinainte
  set local role authenticated;
  begin
    insert into public.vehicle_exits (organization_id, vehicle_id, tip, data_iesire, motiv, created_by, updated_by)
    values (pg_temp.u('A-org'), pg_temp.u('A-v6'), 'vanzare', app.azi_local(), 'Vândut după migrare.',
            pg_temp.u('A-admin'), pg_temp.u('A-admin'));
    reset role;
    select status::text into v_st from public.vehicles where id = pg_temp.u('A-v6');
    if v_st = 'vandut' then
      raise notice '  ✓ (10h) ieșirea din parc pe un vehicul cu istoric';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (10h) după ieșire, vehiculul e %', v_st;
    end if;
  exception when others then
    reset role; v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10h) ieșirea din parc: % (%)', sqlerrm, sqlstate;
  end;

  -- (10i) org_admin B adaugă o alimentare pe o ciornă de dinainte
  perform set_config('request.jwt.claim.sub', pg_temp.u('B-admin')::text, true);
  select t.id into v_ts from public.trip_sheets t
   where t.vehicle_id = pg_temp.u('B-v1') and t.status = 'draft' and t.deleted_at is null and t.sosire_la is not null
   order by t.plecare_la desc limit 1;
  set local role authenticated;
  begin
    insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la, numar_bon, created_by, updated_by)
    select t.organization_id, t.id, 20, 150, t.plecare_la + interval '1 hour', 'X5-NOU', pg_temp.u('B-admin'), pg_temp.u('B-admin')
      from public.trip_sheets t where t.id = v_ts;
    get diagnostics v_n = row_count;
    reset role;
    if v_n = 1 then
      raise notice '  ✓ (10i) alimentarea pe o ciornă de dinainte';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (10i) alimentarea: % rânduri', v_n;
    end if;
  exception when others then
    reset role; v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10i) alimentarea pe ciorna veche: % (%)', sqlerrm, sqlstate;
  end;

  -- (10j) reclamantul închide o sesizare rezolvată de dinainte
  perform set_config('request.jwt.claim.sub', pg_temp.u('A-e1')::text, true);
  set local role authenticated;
  begin
    update public.fault_reports set status = 'inchis'
     where id = (select id from public.fault_reports
                  where organization_id = pg_temp.u('A-org') and status = 'rezolvat' and deleted_at is null limit 1)
    returning status::text into v_st;
    reset role;
    if v_st = 'inchis' then
      raise notice '  ✓ (10j) reclamantul închide sesizarea rezolvată de dinainte';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (10j) sesizarea: %', v_st;
    end if;
  exception when others then
    reset role; v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10j) închiderea sesizării vechi: % (%)', sqlerrm, sqlstate;
  end;

  -- (10k) 0226: managerul unei fișe de dinainte se schimbă în firmă; unul din
  -- altă firmă primește răspunsul unic, fără să afle că fișa există. Id-urile
  -- se iau ÎNAINTE de schimbarea rolului: sub RLS-ul lui A, fișa lui B nu se
  -- vede, iar `pg_temp.e` ar da NULL (un „manager acceptat” fals).
  v_c  := pg_temp.e('B-E-mgr');
  v_ts := pg_temp.e('A-E-e2');
  v_asteptat := pg_temp.e('A-E-mgr')::text;
  perform set_config('request.jwt.claim.sub', pg_temp.u('A-admin')::text, true);
  set local role authenticated;
  begin
    update public.employees set manager_employee_id = v_asteptat::uuid
     where id = v_ts returning manager_employee_id::text into v_st;
    get diagnostics v_n = row_count;
    reset role;
    if v_n = 1 and v_st = v_asteptat then
      raise notice '  ✓ (10k) managerul fișei de dinainte se schimbă în firmă';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (10k) schimbarea managerului: % rânduri, manager %', v_n, v_st;
    end if;
  exception when others then
    reset role; v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10k) schimbarea managerului pe fișa veche: % (%)', sqlerrm, sqlstate;
  end;
  set local role authenticated;
  begin
    update public.employees set manager_employee_id = v_c where id = v_ts;
    get diagnostics v_n = row_count;
    reset role; v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10k) managerul din altă firmă (%) a fost acceptat: % rânduri', v_c, v_n;
  exception when others then
    reset role;
    if sqlstate = 'P0001' and sqlerrm = 'Managerul indicat nu există în organizația dumneavoastră sau fișa lui a fost ștearsă.' then
      raise notice '  ✓ (10k) managerul din altă firmă: același răspuns ca unul inexistent';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (10k) managerul din altă firmă: % (%)', sqlerrm, sqlstate;
    end if;
  end;

  -- (10l) 0225: administratorul corectează valoarea mutată din coloana veche
  perform set_config('request.jwt.claim.sub', pg_temp.u('A-admin')::text, true);
  set local role authenticated;
  begin
    execute 'update public.vehicle_costuri set valoare_achizitie = 66000 where vehicle_id = $1'
      using pg_temp.u('A-v1');
    get diagnostics v_n = row_count;
    reset role;
    if v_n = 1 then
      raise notice '  ✓ (10l) valoarea de achiziție mutată se corectează în vehicle_costuri';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (10l) corectarea valorii mutate: % rânduri', v_n;
    end if;
  exception when others then
    reset role; v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10l) corectarea valorii mutate: % (%)', sqlerrm, sqlstate;
  end;

  -- (10m) 0232: administratorul corectează valoarea echipamentului mutată
  perform set_config('request.jwt.claim.sub', pg_temp.u('A-admin')::text, true);
  set local role authenticated;
  begin
    execute 'update public.equipment_costuri set valoare_achizitie = 46000, updated_by = auth.uid() where equipment_id = $1'
      using pg_temp.u('A-eq1');
    get diagnostics v_n = row_count;
    reset role;
    if v_n = 1 then
      raise notice '  ✓ (10m) valoarea de achiziție mutată a echipamentului se corectează în equipment_costuri';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (10m) corectarea valorii echipamentului: % rânduri', v_n;
    end if;
  exception when others then
    reset role; v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10m) corectarea valorii echipamentului: % (%)', sqlerrm, sqlstate;
  end;

  -- (10n) 0232: e3, responsabilul lui A-eq1 și tehnicianul sesizărilor lui, își
  -- vede utilajul, dar nu valoarea (nici în rând, nici în equipment_costuri).
  perform set_config('request.jwt.claim.sub', pg_temp.u('A-e3')::text, true);
  set local role authenticated;
  begin
    execute 'select count(*) from public.equipment where id = $1' into v_n using pg_temp.u('A-eq1');
    execute 'select count(*) from public.equipment where id = $1 and valoare_achizitie is not null'
      into v_m using pg_temp.u('A-eq1');
    execute 'select count(*)::text from public.equipment_costuri where equipment_id = $1'
      into v_txt using pg_temp.u('A-eq1');
    reset role;
    if v_n = 1 and v_m = 0 and v_txt = '0' then
      raise notice '  ✓ (10n) responsabilul și tehnicianul își văd utilajul, fără valoarea de achiziție';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (10n) e3 pe A-eq1: rând %, valoare în rând %, rânduri de cost %', v_n, v_m, v_txt;
    end if;
  exception when others then
    reset role; v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10n) citirea lui e3: % (%)', sqlerrm, sqlstate;
  end;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA MIGRĂRI PE DATE (scrieri): % verificări picate', v_esecuri;
  end if;
  raise notice '  PROBA MIGRĂRI PE DATE: toate verificările au trecut';
end $$;
