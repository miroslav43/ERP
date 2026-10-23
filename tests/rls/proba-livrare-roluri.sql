-- tests/rls/proba-livrare-roluri.sql
--
-- PROBA DE SCRIERE REALĂ PE ROLURI, PE RAMURA UNITĂ A LIVRĂRII
-- (flotă F3–F12, mentenanță M6–M10, salarizare).
--
-- ── DE CE EXISTĂ ────────────────────────────────────────────────────────────
-- Ramura aduce 26 de tabele `public.*` noi și 11 funcții `public.*` noi (0191,
-- 0199–0206, 0210–0218, 0225, 0226), plus `foi_select` rescrisă în 0226 (ramura
-- de platformă). Probele fiecărui pachet le judecă pe bucăți, fiecare cu
-- fixture-ul lui. Aici, pe UN SINGUR fixture, fiecare tabelă și funcție nouă e
-- atinsă sub identitatea fiecăruia dintre cele cinci roluri (`super_admin` din
-- `platform_admins`, `org_admin`, `hr`, `manager`, doi `employee`) plus
-- administratorul unei firme STRĂINE: SELECT numărat, INSERT și UPDATE efective,
-- fiecare derulat înapoi (excepția PX001), cu rândurile numărate.
-- Salarizarea nu are tabele sau funcții noi pe ramură; partea ei de bază e
-- `avantaj_natura_flota` (`payroll:read = all`).
--
-- ── VERDICTELE ──────────────────────────────────────────────────────────────
--   OK            rezultatul coincide cu matricea intenționată
--   FALS-NEGATIV  rolul are voie, baza refuză (eroare) sau ascunde rânduri
--   FALS-POZITIV  rolul n-are voie, baza acceptă sau arată rânduri în plus
--   REFUZ TĂCUT   UPDATE fără eroare, dar cu mai puține rânduri decât se aștepta
-- Celula „refuz” acceptă orice refuz (42501, P0001, cheie străină, 0 rânduri):
-- același șablon trece la rolul care are voie, deci refuzul nu vine din șablon.
--
-- ── MATRICEA INTENȚIONATĂ ───────────────────────────────────────────────────
-- `role_permissions` (seed global) + deciziile planului „Flotă completă”:
--   super_admin — vede (ramura `app.is_platform_admin()`), nu scrie: nu e membru;
--   hr          — doar permisele șoferilor (decizia 3) și PV-ul la care e parte;
--                 fără parc, foi, costuri, amenzi, carduri, rezervări, ieșiri;
--   manager     — echipa (el + subordonații) și pool-ul; costurile și service-ul
--                 DOAR pe mașinile echipei, doar citire; își scrie foaia,
--                 cursele, UIT-ul și rezervarea PROPRII (create/update = own);
--                 nu tranzacțiile cardurilor (I-b3), nu ieșirile (I-h6);
--   employee    — mașina lui + pool, foile lui, își declară dauna din „Mașina
--                 mea” (doar pe mașina lui sau pe pool, fără costuri, 0206 §F),
--                 confirmă PV-ul la care e parte; fără costuri, amenzi, ieșiri;
--   străin      — administratorul altei firme: zero rânduri, zero scrieri, iar în
--                 firma LUI nu poate lega rânduri de obiectele firmei A (FK compus).
--   Costurile ascunse (0225): valoarea de achiziție și costul documentelor le
--   citesc `vehicles:update = all` și managerul pe mașinile echipei, NU pe pool
--   (nici pe pool-ul alocat unui om din echipă); scrie doar org_admin.
--   Loturile de import (0226): le vede și le consumă doar cine le-a creat, cu
--   `<resursă>:create = all` (angajați: adm, hr; extrase de card: adm).
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

begin;

create function pg_temp.la(zi date, ora text) returns timestamptz
language sql immutable as $$ select (zi::timestamp + ora::interval) at time zone 'Europe/Bucharest' $$;

-- Înlocuiește `{cheie}` cu valoarea din obiect, citată.
create function pg_temp.sub(p_sql text, p_ids jsonb) returns text
language plpgsql immutable as $f$
declare
  v_sql text := p_sql;
  v_k   record;
begin
  for v_k in select key, value from jsonb_each_text(p_ids) order by length(key) desc loop
    v_sql := replace(v_sql, '{' || v_k.key || '}', quote_literal(v_k.value));
  end loop;
  return v_sql;
end
$f$;

-- Rândurile unei interogări, sub identitatea dată. -1 = eroare (afișată).
create function pg_temp.numara(p_user uuid, p_sql text) returns bigint
language plpgsql as $f$
declare
  v_n bigint;
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  set local role authenticated;
  begin
    execute 'select count(*) from (' || p_sql || ') q' into v_n;
    reset role;
    return v_n;
  exception when others then
    reset role;
    raise warning '  ! % → %: %', left(p_sql, 90), sqlstate, sqlerrm;
    return -1;
  end;
end
$f$;

-- O scriere sub identitatea dată, derulată ÎNAPOI și când reușește (excepția
-- PX001 anulează sub-tranzacția). Întoarce `ok:<rânduri>` sau SQLSTATE-ul.
create function pg_temp.incearca(p_user uuid, p_sql text) returns text
language plpgsql as $f$
declare
  v_n bigint;
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  set local role authenticated;
  begin
    execute p_sql;
    get diagnostics v_n = row_count;
    raise exception using errcode = 'PX001', message = 'ok:' || v_n::text;
  exception when others then
    reset role;
    if sqlstate = 'PX001' then
      return sqlerrm;
    end if;
    return sqlstate || ' ' || left(sqlerrm, 90);
  end;
end
$f$;

-- Verdictul unei celule. `null` = celula nu se judecă.
create function pg_temp.verdict(p_op text, p_ast text, p_obt text) returns text
language plpgsql immutable as $f$
declare
  a int;
  o int;
begin
  if p_ast is null then
    return null;
  end if;
  -- `D:<azi>/<intenționat>`: defect cunoscut, nereparat (ca `it.fails("DEFECT: …")`).
  -- Valoarea de azi trece ca DEFECT; cea intenționată pică proba (a fost reparat:
  -- mută celula în matrice), la fel orice altă valoare.
  if p_ast like 'D:%' then
    if p_obt = split_part(substr(p_ast, 3), '/', 1) then return 'DEFECT'; end if;
    if p_obt = split_part(substr(p_ast, 3), '/', 2) then return 'REPARAT (mută în matrice)'; end if;
    return 'ABATERE DE LA DEFECT';
  end if;
  if p_op = 'SELECT' then
    a := p_ast::int;
    o := p_obt::int;
    if o = a then return 'OK'; end if;
    if o = -1 then return case when a > 0 then 'FALS-NEGATIV' else 'OK' end; end if;
    if o < a then return 'FALS-NEGATIV'; end if;
    return 'FALS-POZITIV';
  end if;
  if p_ast = 'refuz' then
    if p_obt = 'ok:0' or p_obt not like 'ok:%' then return 'OK'; end if;
    return 'FALS-POZITIV';
  end if;
  if p_obt = p_ast then return 'OK'; end if;
  if p_obt not like 'ok:%' then return 'FALS-NEGATIV'; end if;
  o := split_part(p_obt, ':', 2)::int;
  a := split_part(p_ast, ':', 2)::int;
  if o < a then return 'REFUZ TĂCUT'; end if;
  return 'FALS-POZITIV';
end
$f$;

create temp table rezultate (
  nr        serial primary key,
  eticheta  text not null,
  op        text not null,
  rol       text not null,
  asteptat  text not null,
  obtinut   text not null,
  verdict   text not null
) on commit drop;

-- Un rând al matricei: fiecare celulă sub identitatea ei, verdictul în
-- `rezultate`, linia tabelului în NOTICE. Întoarce numărul de celule judecate.
-- Ordinea celulelor: super_admin, org_admin, hr, manager, E1, E2, străin.
create function pg_temp.judeca(p_eticheta text, p_op text, p_sql text, p_ast text[],
                               p_useri uuid[], p_ctx jsonb[], p_baza jsonb, p_roluri text[])
returns int
language plpgsql as $f$
declare
  v_linie  text := '';
  v_obt    text;
  v_ver    text;
  v_celule int := 0;
begin
  for i in 1 .. 7 loop
    if p_ast[i] is null then
      v_linie := v_linie || lpad('—', 7) || ' ';
      continue;
    end if;
    if p_op = 'SELECT' then
      v_obt := pg_temp.numara(p_useri[i], pg_temp.sub(p_sql, p_baza || p_ctx[i]))::text;
    else
      v_obt := pg_temp.incearca(p_useri[i], pg_temp.sub(p_sql, p_baza || p_ctx[i]));
    end if;
    v_ver := pg_temp.verdict(p_op, p_ast[i], v_obt);
    v_celule := v_celule + 1;
    insert into pg_temp.rezultate (eticheta, op, rol, asteptat, obtinut, verdict)
    values (p_eticheta, p_op, p_roluri[i], p_ast[i], v_obt, v_ver);
    v_linie := v_linie || lpad(case v_ver when 'OK' then split_part(v_obt, ' ', 1)
                                          when 'DEFECT' then 'D' || split_part(v_obt, ' ', 1)
                                          else '✗' || split_part(v_obt, ' ', 1) end, 7) || ' ';
    if v_ver not in ('OK', 'DEFECT') then
      raise warning '  ✗ % sub %: obținut „%”, intenționat „%” → %', p_eticheta, p_roluri[i], v_obt, p_ast[i], v_ver;
    end if;
  end loop;
  raise notice '  %  %', rpad(p_eticheta, 52), v_linie;
  return v_celule;
end
$f$;

-- ── FIRMA A ─────────────────────────────────────────────────────────────────
--   org_admin (cu fișă: e_adm, tehnicianul de mentenanță); hr (Horia, cu mașina
--   VH); manager M (Mihai, fără mașină, conduce pool-ul); E1 (Elena, fără șef);
--   E2 (Emil, subordonatul lui M); super_admin în `platform_admins`.
--   V1 — a fost a lui E2 (alocare închisă), acum a lui E1;  V2 — a lui E2;
--   VP — pool;  VL — fără șofer;  VH — a lui hr;  VX — ieșită din parc (vândută).
--   Foi (ciornă, câte o cursă): f2v (E2 pe V1, acum 20 de zile), f1 (E1 pe V1,
--   ieri), f2 (E2 pe V2, ieri), fp (E2 pe pool, alaltăieri), fm (M pe pool, acum
--   3 zile). UIT pe cursele lui f1 și f2.
--   Câte un rând în fiecare tabelă nouă; vezi numărătorile din matrice.
create function pg_temp.firma_a() returns jsonb
language plpgsql as $f$
declare
  s        text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_zi     date := app.azi_local();
  v_nr     text := (100 + (random() * 800)::int)::text;
  v_org    uuid := gen_random_uuid();
  u_sa     uuid := gen_random_uuid();
  u_adm    uuid := gen_random_uuid();
  u_hr     uuid := gen_random_uuid();
  u_mgr    uuid := gen_random_uuid();
  u_e1     uuid := gen_random_uuid();
  u_e2     uuid := gen_random_uuid();
  e_adm    uuid;
  e_hr     uuid := gen_random_uuid();
  e_mgr    uuid := gen_random_uuid();
  e_e1     uuid := gen_random_uuid();
  e_e2     uuid := gen_random_uuid();
  v1       uuid := gen_random_uuid();
  v2       uuid := gen_random_uuid();
  vp       uuid := gen_random_uuid();
  vl       uuid := gen_random_uuid();
  vh       uuid := gen_random_uuid();
  vx       uuid := gen_random_uuid();
  al_e2_v1 uuid;
  al_e1_v1 uuid;
  al_e2_v2 uuid;
  al_hr_vh uuid;
  f1       uuid := gen_random_uuid();
  f2       uuid := gen_random_uuid();
  f2v      uuid := gen_random_uuid();
  fp       uuid := gen_random_uuid();
  fm       uuid := gen_random_uuid();
  c_f1     uuid := gen_random_uuid();
  c_f2     uuid := gen_random_uuid();
  c_fm     uuid := gen_random_uuid();
  eq1      uuid := gen_random_uuid();
  eq_isc   uuid := gen_random_uuid();
  i1       uuid;
  a1       uuid;
  c_e1     uuid := gen_random_uuid();
  c_v2     uuid := gen_random_uuid();
  c_vp     uuid := gen_random_uuid();
  c_vl     uuid := gen_random_uuid();
  c_vh     uuid := gen_random_uuid();
  lot      uuid := gen_random_uuid();
  tx1      uuid := gen_random_uuid();
  pv_e1    uuid;
  pv_hr    uuid;
  pv_c     uuid;
  iesire   uuid;
  v_casco  uuid;
  v_rca    uuid;
  d1       uuid;
  d_vp     uuid;
  t_f1     timestamptz := pg_temp.la(v_zi - 1, '08:00');
  t_f2v    timestamptz := pg_temp.la(v_zi - 20, '08:00');
  t_fp     timestamptz := pg_temp.la(v_zi - 2, '08:00');
  t_fm     timestamptz := pg_temp.la(v_zi - 3, '08:00');
  t_inc_a  timestamptz := pg_temp.la(v_zi - 4, '16:00');
  t_inc_e  timestamptz := pg_temp.la(v_zi - 1, '15:00');
  t_amenda timestamptz := pg_temp.la(v_zi - 3, '09:30');
begin
  select id into v_casco from public.vehicle_document_types where organization_id is null and cod = 'casco';
  select id into strict v_rca from public.vehicle_document_types where organization_id is null and cod = 'rca';

  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-livrare-a-' || s, 'Proba Livrare A SRL', 'RO' || (85000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select v_org, f.feature_key, true, now() from public.features f;

  insert into auth.users (id, email, email_confirmed_at) values
    (u_sa,  'liv-sa-'  || s || '@proba.test', now()),
    (u_adm, 'liv-adm-' || s || '@proba.test', now()),
    (u_hr,  'liv-hr-'  || s || '@proba.test', now()),
    (u_mgr, 'liv-mgr-' || s || '@proba.test', now()),
    (u_e1,  'liv-e1-'  || s || '@proba.test', now()),
    (u_e2,  'liv-e2-'  || s || '@proba.test', now());
  insert into public.platform_admins (user_id) values (u_sa);
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, u_adm, 'org_admin'),
    (v_org, u_hr,  'hr'),
    (v_org, u_mgr, 'manager'),
    (v_org, u_e1,  'employee'),
    (v_org, u_e2,  'employee');

  -- Fișa administratorului o creează triggerul de membru (`membru_creeaza_fisa_de_angajat`).
  select id into strict e_adm from public.employees where organization_id = v_org and user_id = u_adm;
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (e_mgr, v_org, 'LV-M', 'Mihai', 'Manager',  v_zi - 500, 'activ', u_mgr, null),
    (e_hr,  v_org, 'LV-H', 'Horia', 'Personal', v_zi - 500, 'activ', u_hr,  null),
    (e_e1,  v_org, 'LV-1', 'Elena', 'Șofer',    v_zi - 400, 'activ', u_e1,  null);
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (e_e2,  v_org, 'LV-2', 'Emil',  'Șofer',    v_zi - 400, 'activ', u_e2,  e_mgr);

  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent, pool,
                               valoare_achizitie, created_by, updated_by) values
    (v1, v_org, 'B' || v_nr || 'LVA', 'Dacia', 'Logan',   10000, false, 60000,  u_adm, u_adm),
    (v2, v_org, 'B' || v_nr || 'LVB', 'Dacia', 'Duster',  20000, false, 90000,  u_adm, u_adm),
    (vp, v_org, 'B' || v_nr || 'LVP', 'Dacia', 'Jogger',  29000, true,  80000,  u_adm, u_adm),
    (vl, v_org, 'B' || v_nr || 'LVL', 'Ford',  'Transit', 40000, false, 120000, u_adm, u_adm),
    (vh, v_org, 'B' || v_nr || 'LVH', 'Skoda', 'Fabia',   15000, false, 50000,  u_adm, u_adm),
    (vx, v_org, 'B' || v_nr || 'LVX', 'Opel',  'Astra',   90000, false, 30000,  u_adm, u_adm);

  -- V1 a fost a lui E2; alocarea lui E1 o închide pe a lui (trigger, 0173).
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, km_predare, created_by, updated_by)
  values (v_org, v1, e_e2, now() - interval '30 days', 10000, u_adm, u_adm) returning id into al_e2_v1;
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, km_predare,
                                          folosinta_personala, created_by, updated_by)
  values (v_org, v1, e_e1, now() - interval '15 days', 10050, true, u_adm, u_adm) returning id into al_e1_v1;
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, km_predare, created_by, updated_by)
  values (v_org, v2, e_e2, now() - interval '10 days', 20000, u_adm, u_adm) returning id into al_e2_v2;
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, km_predare, created_by, updated_by)
  values (v_org, vh, e_hr, now() - interval '10 days', 15000, u_adm, u_adm) returning id into al_hr_vh;

  insert into public.trip_sheets (id, organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                  created_by, updated_by) values
    (f2v, v_org, v1, e_e2,  t_f2v, 10000, u_e2,  u_e2),
    (fm,  v_org, vp, e_mgr, t_fm,  29000, u_mgr, u_mgr),
    (f1,  v_org, v1, e_e1,  t_f1,  10100, u_e1,  u_e1),
    (f2,  v_org, v2, e_e2,  t_f1,  20000, u_e2,  u_e2),
    (fp,  v_org, vp, e_e2,  t_fp,  30000, u_e2,  u_e2);
  insert into public.trip_sheet_curse (id, organization_id, trip_sheet_id, plecare_la, sosire_la,
                                       de_la_loc, pana_la_loc, scop, km_plecare, km_sosire,
                                       created_by, updated_by) values
    (gen_random_uuid(), v_org, f2v, t_f2v, t_f2v + interval '2 hours', 'Sediu', 'Client', 'Livrare', 10000, 10050, u_e2,  u_e2),
    (c_fm,              v_org, fm,  t_fm,  t_fm  + interval '2 hours', 'Sediu', 'Client', 'Livrare', 29000, 29050, u_mgr, u_mgr),
    (c_f1,              v_org, f1,  t_f1,  t_f1  + interval '2 hours', 'Sediu', 'Client', 'Livrare', 10100, 10150, u_e1,  u_e1),
    (c_f2,              v_org, f2,  t_f1,  t_f1  + interval '2 hours', 'Sediu', 'Client', 'Livrare', 20000, 20050, u_e2,  u_e2),
    (gen_random_uuid(), v_org, fp,  t_fp,  t_fp  + interval '2 hours', 'Sediu', 'Client', 'Livrare', 30000, 30050, u_e2,  u_e2);

  -- RCA cu cost pe V1, V2, VP și VH: costul scris în coloana veche se mută în
  -- `vehicle_document_costuri` (0225 §6), câte un rând de cost pe document.
  insert into public.vehicle_documents (organization_id, vehicle_id, document_type_id, numar,
                                        valabil_de_la, expira_la, cost, created_by, updated_by)
  select v_org, x.v, v_rca, 'RCA-' || s || '-' || x.n, v_zi - 355, v_zi + 10, 1200, u_adm, u_adm
    from (values (v1, 1), (v2, 2), (vp, 3), (vh, 4)) as x(v, n);
  select id into strict d1   from public.vehicle_documents where organization_id = v_org and vehicle_id = v1;
  select id into strict d_vp from public.vehicle_documents where organization_id = v_org and vehicle_id = vp;

  insert into public.vehicle_document_type_setari (organization_id, document_type_id, activ, obligatoriu,
                                                   created_by, updated_by)
  values (v_org, v_casco, true, true, u_adm, u_adm);
  -- Rezervările cu aprobare: cererea angajatului rămâne `ceruta`, iar managerul
  -- direct are ce decide (`vehicle_reservations:approve = team`).
  insert into public.fleet_settings (organization_id, rezervari_cu_aprobare, created_by, updated_by)
  values (v_org, true, u_adm, u_adm);
  insert into public.trip_route_templates (organization_id, denumire, de_la_loc, pana_la_loc, scop, km_estimat,
                                           created_by, updated_by)
  values (v_org, 'Sediu – Client', 'Sediu', 'Client', 'Livrare', 50, u_adm, u_adm);

  insert into public.vehicle_service_plans (organization_id, vehicle_id, denumire, interval_luni, baza_data, baza_km,
                                            created_by, updated_by)
  select v_org, x, 'Revizie anuală', 12, v_zi - 360, 0, u_adm, u_adm from unnest(array[v1, v2, vp]) as x;
  insert into public.vehicle_service_entries (organization_id, vehicle_id, data_interventiei, km, tip, descriere,
                                              cost_piese, cost_manopera, created_by, updated_by) values
    (v_org, v1, v_zi - 5, 10160, 'reparatie', 'Plăcuțe frână', 300, 200, u_adm, u_adm),
    (v_org, v2, v_zi - 5, 20060, 'reparatie', 'Plăcuțe frână', 300, 200, u_adm, u_adm),
    (v_org, vp, v_zi - 5, 30060, 'reparatie', 'Plăcuțe frână', 300, 200, u_adm, u_adm);
  insert into public.vehicle_expenses (organization_id, vehicle_id, categorie, data_cheltuielii, suma,
                                       created_by, updated_by)
  select v_org, x, 'parcare', v_zi - 3, 25, u_adm, u_adm from unnest(array[v1, v2, vp, vh]) as x;

  insert into public.driver_licenses (organization_id, employee_id, numar, categorii, expira_la)
  select v_org, x.e, 'P-' || s || '-' || x.n, array['B'], v_zi + 400
    from (values (e_e1, 1), (e_e2, 2), (e_mgr, 3)) as x(e, n);

  insert into public.vehicle_fiscal_regimes (organization_id, vehicle_id, valabil_de_la, regim, motiv,
                                             created_by, updated_by) values
    (v_org, v1, v_zi - 60, 'limitat_50', 'Folosință mixtă', u_adm, u_adm),
    (v_org, v2, v_zi - 60, 'limitat_50', 'Folosință mixtă', u_adm, u_adm);
  insert into public.vehicle_consumption_norms (organization_id, vehicle_id, valabil_de_la, l_100km)
  values (v_org, v2, v_zi - 60, 7.5);

  insert into public.vehicle_fines (organization_id, vehicle_id, numar_pv, constatata_la, fapta, primita_la,
                                    termen_raspuns, created_by, updated_by)
  values (v_org, v2, 'PV-' || s, t_amenda, 'Parcare interzisă', v_zi - 1, v_zi + 7, u_adm, u_adm);
  insert into public.vehicle_incidents (organization_id, vehicle_id, tip, produs_la, descriere, created_by, updated_by)
  values (v_org, v2, 'coliziune', t_inc_a, 'Zgârietură în parcarea sediului.', u_adm, u_adm);
  -- Dauna declarată de E1 din „Mașina mea” (0206 §F).
  insert into public.vehicle_incidents (organization_id, vehicle_id, tip, produs_la, descriere,
                                        sofer_id, declarat_de_employee_id, created_by, updated_by)
  values (v_org, v1, 'avarie', t_inc_e, 'Oglindă spartă în parcare.', e_e1, e_e1, u_e1, u_e1);

  -- Mentenanța: echipament, intervenție (executant E1) cu o linie de piese,
  -- echipament ISCIR cu autorizația lui, două rânduri de rezumat trimis.
  insert into public.equipment (id, organization_id, cod, denumire, este_iscir) values
    (eq1,    v_org, 'CMP-' || s, 'Compresor', false),
    (eq_isc, v_org, 'MAC-' || s, 'Macara capră', true);

  -- Ce întocmește administratorul, sub identitatea lui (triggerele de
  -- numerotare și de derivare rulează ca în aplicație).
  perform set_config('request.jwt.claim.sub', u_adm::text, true);
  set local role authenticated;
  insert into public.maintenance_interventions (organization_id, equipment_id, data, descriere, executant_employee_id)
  values (v_org, eq1, v_zi - 2, 'Schimb filtru.', e_e1) returning id into i1;
  insert into public.maintenance_intervention_parts (organization_id, intervention_id, denumire, cantitate, unitate, pret_unitar)
  values (v_org, i1, 'Filtru aer', 2, 'buc', 37.50);
  insert into public.iscir_authorizations (organization_id, equipment_id, numar, tip, valabil_pana,
                                           scadenta_verificare_tehnica, emis_la)
  values (v_org, eq_isc, 'ISCIR-' || s, 'macara', v_zi + 400, v_zi + 300, v_zi - 300) returning id into a1;

  insert into public.fuel_cards (id, organization_id, emitent, ultimele_cifre, vehicle_id, employee_id,
                                 valabil_pana, created_by, updated_by) values
    (c_e1, v_org, 'omv_petrom', '1111', null, e_e1, v_zi + 400, u_adm, u_adm),
    (c_v2, v_org, 'omv_petrom', '2222', v2,   null, v_zi + 400, u_adm, u_adm),
    (c_vp, v_org, 'omv_petrom', '3333', vp,   null, v_zi + 400, u_adm, u_adm),
    (c_vl, v_org, 'mol',        '4444', vl,   null, v_zi + 400, u_adm, u_adm),
    (c_vh, v_org, 'mol',        '5555', vh,   null, v_zi + 400, u_adm, u_adm);
  insert into public.fuel_card_import_profiles (organization_id, emitent, mapare, created_by, updated_by)
  values (v_org, 'omv_petrom', '{"numar_card":"Card"}', u_adm, u_adm);
  insert into public.fuel_card_imports (id, organization_id, emitent, fisier_nume, fisier_sha256,
                                        perioada_de_la, perioada_pana_la, randuri_fisier, created_by, updated_by)
  values (lot, v_org, 'omv_petrom', 'extras.csv', repeat('a', 64), v_zi - 30, v_zi, 1, u_adm, u_adm);
  insert into public.fuel_card_transactions (id, organization_id, import_id, emitent, cheie_dedup, rand_fisier,
                                             card_id, card_ultimele_cifre, efectuat_la, produs, categorie,
                                             tip_combustibil, cantitate, valoare_bruta, moneda, vehicle_id,
                                             stare_potrivire, created_by, updated_by)
  values (tx1, v_org, lot, 'omv_petrom', 'h:proba#1', 2, c_v2, '2222', now() - interval '3 days', 'Motorină',
          'combustibil', 'motorina', 40.5, 300, 'RON', v2, 'fara_alimentare', u_adm, u_adm);

  -- PV-urile: predarea către E1 și către hr (finalizate), predarea către E2 (ciornă).
  insert into public.vehicle_handovers (organization_id, alocare_primita_id, nivel_rezervor, stare_generala,
                                        daune_constatate, created_by, updated_by)
  values (v_org, al_e1_v1, 'plin', 'buna', false, u_adm, u_adm) returning id into pv_e1;
  insert into public.vehicle_handovers (organization_id, alocare_primita_id, nivel_rezervor, stare_generala,
                                        daune_constatate, created_by, updated_by)
  values (v_org, al_hr_vh, 'plin', 'buna', false, u_adm, u_adm) returning id into pv_hr;
  insert into public.vehicle_handovers (organization_id, alocare_primita_id, nivel_rezervor, stare_generala,
                                        daune_constatate, created_by, updated_by)
  values (v_org, al_e2_v2, 'plin', 'buna', false, u_adm, u_adm) returning id into pv_c;
  update public.vehicle_handovers set stare = 'finalizat', updated_by = u_adm where id in (pv_e1, pv_hr);

  -- Ieșirea din parc a lui VX (vândută ieri): termenele le generează triggerul.
  insert into public.vehicle_exits (organization_id, vehicle_id, tip, data_iesire, km_iesire, motiv, cumparator,
                                    created_by, updated_by)
  values (v_org, vx, 'vanzare', v_zi - 1, 90000, 'Vândută la licitație.', 'Cumpărător SRL', u_adm, u_adm)
  returning id into iesire;
  -- Lotul de import al extrasului de card, emis de bază (0226 §3), neconsumat.
  insert into public.import_uploads (organization_id, resursa, cale, created_by, updated_by)
  values (v_org, 'vehicles', 'x/vehicles/x/extras.csv', u_adm, u_adm);
  reset role;

  -- Lotul de import de angajați al lui hr, neconsumat.
  perform set_config('request.jwt.claim.sub', u_hr::text, true);
  set local role authenticated;
  insert into public.import_uploads (organization_id, resursa, cale, created_by, updated_by)
  values (v_org, 'employees', 'x/employees/x/angajati.xlsx', u_hr, u_hr);
  reset role;

  -- Rezervările pe pool, fiecare de omul ei: E2 mâine, E1 poimâine, M peste 3 zile.
  perform set_config('request.jwt.claim.sub', u_e2::text, true);
  set local role authenticated;
  insert into public.vehicle_reservations (organization_id, vehicle_id, employee_id, de_la, pana_la, scop,
                                           created_by, updated_by)
  values (v_org, vp, e_e2, v_zi + 1, v_zi + 1, 'Vizită la client', u_e2, u_e2);
  insert into public.trip_sheet_uit (organization_id, trip_sheet_id, cursa_id, uit, data_inceput, created_by, updated_by)
  values (v_org, f2, c_f2, '4C0U0C0J0W3DDQ92', v_zi - 1, u_e2, u_e2);
  reset role;
  perform set_config('request.jwt.claim.sub', u_e1::text, true);
  set local role authenticated;
  insert into public.vehicle_reservations (organization_id, vehicle_id, employee_id, de_la, pana_la, scop,
                                           created_by, updated_by)
  values (v_org, vp, e_e1, v_zi + 2, v_zi + 2, 'Vizită la client', u_e1, u_e1);
  insert into public.trip_sheet_uit (organization_id, trip_sheet_id, cursa_id, uit, data_inceput, created_by, updated_by)
  values (v_org, f1, c_f1, '4C0U0C0J0W3DDQ92', v_zi - 1, u_e1, u_e1);
  reset role;
  perform set_config('request.jwt.claim.sub', u_mgr::text, true);
  set local role authenticated;
  insert into public.vehicle_reservations (organization_id, vehicle_id, employee_id, de_la, pana_la, scop,
                                           created_by, updated_by)
  values (v_org, vp, e_mgr, v_zi + 3, v_zi + 3, 'Vizită la client', u_mgr, u_mgr);
  reset role;

  -- Rezumatul zilnic trimis (îl scrie doar jobul, în contextul de serviciu).
  insert into public.maintenance_rezumat_trimis (organization_id, user_id, tip, entity_id) values
    (v_org, u_adm, 'contor_necitit', eq1),
    (v_org, u_mgr, 'contor_necitit', eq1);

  return jsonb_build_object(
    'org', v_org, 'zi', v_zi, 'luna', date_trunc('month', v_zi)::date,
    'u_sa', u_sa, 'u_adm', u_adm, 'u_hr', u_hr, 'u_mgr', u_mgr, 'u_e1', u_e1, 'u_e2', u_e2,
    'e_adm', e_adm, 'e_hr', e_hr, 'e_mgr', e_mgr, 'e_e1', e_e1, 'e_e2', e_e2,
    'v1', v1, 'v2', v2, 'vp', vp, 'vl', vl, 'vh', vh, 'vx', vx,
    'al_e2_v1', al_e2_v1, 'al_e1_v1', al_e1_v1, 'al_e2_v2', al_e2_v2, 'al_hr_vh', al_hr_vh,
    'f1', f1, 'f2', f2, 'f2v', f2v, 'fp', fp, 'fm', fm, 'c_f1', c_f1, 'c_f2', c_f2, 'c_fm', c_fm,
    'eq1', eq1, 'i1', i1, 'a1', a1, 'lot', lot, 'tx1', tx1, 'c_e1', c_e1,
    'pv_e1', pv_e1, 'pv_hr', pv_hr, 'pv_c', pv_c, 'iesire', iesire, 'd1', d1, 'd_vp', d_vp)
  || jsonb_build_object(
    -- Cursa nouă de după cea existentă: 11:00–12:00, de la km-ul de sosire.
    'f1_de', pg_temp.la(v_zi - 1, '11:00'), 'f1_la', pg_temp.la(v_zi - 1, '12:00'), 'f1_zi', v_zi - 1, 'f1_km', 10150,
    'f2_de', pg_temp.la(v_zi - 1, '11:00'), 'f2_la', pg_temp.la(v_zi - 1, '12:00'), 'f2_zi', v_zi - 1, 'f2_km', 20050,
    'fm_de', pg_temp.la(v_zi - 3, '11:00'), 'fm_la', pg_temp.la(v_zi - 3, '12:00'), 'fm_zi', v_zi - 3, 'fm_km', 29050,
    'ieri', pg_temp.la(v_zi - 1, '17:00'));
end
$f$;

-- ── FIRMA B (străină) ───────────────────────────────────────────────────────
-- Administratorul ei, o fișă și un vehicul pool: martorul pozitiv al scrierilor
-- în firma LUI, ca refuzul pe obiectele firmei A să nu vină din șablon.
create function pg_temp.firma_b() returns jsonb
language plpgsql as $f$
declare
  s      text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org  uuid := gen_random_uuid();
  u_str  uuid := gen_random_uuid();
  e_str  uuid;
  vb     uuid := gen_random_uuid();
begin
  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-livrare-b-' || s, 'Proba Livrare B SRL', 'RO' || (86000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select v_org, f.feature_key, true, now() from public.features f;
  insert into auth.users (id, email, email_confirmed_at) values (u_str, 'liv-str-' || s || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values (v_org, u_str, 'org_admin');
  select id into strict e_str from public.employees where organization_id = v_org and user_id = u_str;
  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent, pool,
                               created_by, updated_by)
  values (vb, v_org, 'CJ' || (100 + (random() * 800)::int)::text || 'LVB', 'Dacia', 'Logan', 500, true, u_str, u_str);
  return jsonb_build_object('org_b', v_org, 'u_str', u_str, 'e_str', e_str, 'vb', vb);
end
$f$;

do $$
declare
  a          jsonb := pg_temp.firma_a();
  b          jsonb := pg_temp.firma_b();
  baza       jsonb;
  v_roluri   text[] := array['super_admin', 'org_admin', 'hr', 'manager', 'employee E1', 'employee E2',
                             'străin (org_admin B)'];
  v_scurt    text[] := array['sa', 'adm', 'hr', 'mgr', 'E1', 'E2', 'str'];
  v_useri    uuid[];
  v_ctx      jsonb[];
  v_n_oblig  bigint;
  r          record;
  v_celule   int := 0;
begin
  baza := a || b;
  v_useri := array[a->>'u_sa', a->>'u_adm', a->>'u_hr', a->>'u_mgr', a->>'u_e1', a->>'u_e2', b->>'u_str']::uuid[];

  -- Ce înseamnă „al meu” pentru fiecare identitate. Cine n-are foaie, mașină
  -- sau fișă în firma A primește obiectele lui E1: celula lui e un refuz.
  v_ctx := array[
    -- super_admin
    jsonb_build_object('fisa_mea', a->>'e_e1', 'masina_mea', a->>'v1', 'masina_alta', a->>'v2',
      'foaia_mea', a->>'f1', 'cursa_mea', a->>'c_f1', 'de_mea', a->>'f1_de', 'la_mea', a->>'f1_la',
      'zi_mea', a->>'f1_zi', 'km_mea', a->>'f1_km',
      'foaia_alta', a->>'f2', 'cursa_alta', a->>'c_f2', 'de_alta', a->>'f2_de', 'la_alta', a->>'f2_la',
      'zi_alta', a->>'f2_zi', 'km_alta', a->>'f2_km'),
    -- org_admin
    jsonb_build_object('fisa_mea', a->>'e_adm', 'masina_mea', a->>'v1', 'masina_alta', a->>'v2',
      'foaia_mea', a->>'f1', 'cursa_mea', a->>'c_f1', 'de_mea', a->>'f1_de', 'la_mea', a->>'f1_la',
      'zi_mea', a->>'f1_zi', 'km_mea', a->>'f1_km',
      'foaia_alta', a->>'f2', 'cursa_alta', a->>'c_f2', 'de_alta', a->>'f2_de', 'la_alta', a->>'f2_la',
      'zi_alta', a->>'f2_zi', 'km_alta', a->>'f2_km'),
    -- hr (mașina lui e VH; n-are foi)
    jsonb_build_object('fisa_mea', a->>'e_hr', 'masina_mea', a->>'vh', 'masina_alta', a->>'v2',
      'foaia_mea', a->>'f1', 'cursa_mea', a->>'c_f1', 'de_mea', a->>'f1_de', 'la_mea', a->>'f1_la',
      'zi_mea', a->>'f1_zi', 'km_mea', a->>'f1_km',
      'foaia_alta', a->>'f2', 'cursa_alta', a->>'c_f2', 'de_alta', a->>'f2_de', 'la_alta', a->>'f2_la',
      'zi_alta', a->>'f2_zi', 'km_alta', a->>'f2_km'),
    -- manager (foaia lui e fm, pe pool; „altuia” = foaia subordonatului E2)
    jsonb_build_object('fisa_mea', a->>'e_mgr', 'masina_mea', a->>'vp', 'masina_alta', a->>'v2',
      'foaia_mea', a->>'fm', 'cursa_mea', a->>'c_fm', 'de_mea', a->>'fm_de', 'la_mea', a->>'fm_la',
      'zi_mea', a->>'fm_zi', 'km_mea', a->>'fm_km',
      'foaia_alta', a->>'f2', 'cursa_alta', a->>'c_f2', 'de_alta', a->>'f2_de', 'la_alta', a->>'f2_la',
      'zi_alta', a->>'f2_zi', 'km_alta', a->>'f2_km'),
    -- E1
    jsonb_build_object('fisa_mea', a->>'e_e1', 'masina_mea', a->>'v1', 'masina_alta', a->>'v2',
      'foaia_mea', a->>'f1', 'cursa_mea', a->>'c_f1', 'de_mea', a->>'f1_de', 'la_mea', a->>'f1_la',
      'zi_mea', a->>'f1_zi', 'km_mea', a->>'f1_km',
      'foaia_alta', a->>'f2', 'cursa_alta', a->>'c_f2', 'de_alta', a->>'f2_de', 'la_alta', a->>'f2_la',
      'zi_alta', a->>'f2_zi', 'km_alta', a->>'f2_km'),
    -- E2
    jsonb_build_object('fisa_mea', a->>'e_e2', 'masina_mea', a->>'v2', 'masina_alta', a->>'v1',
      'foaia_mea', a->>'f2', 'cursa_mea', a->>'c_f2', 'de_mea', a->>'f2_de', 'la_mea', a->>'f2_la',
      'zi_mea', a->>'f2_zi', 'km_mea', a->>'f2_km',
      'foaia_alta', a->>'f1', 'cursa_alta', a->>'c_f1', 'de_alta', a->>'f1_de', 'la_alta', a->>'f1_la',
      'zi_alta', a->>'f1_zi', 'km_alta', a->>'f1_km'),
    -- străin: țintește obiectele firmei A
    jsonb_build_object('fisa_mea', a->>'e_e1', 'masina_mea', a->>'v1', 'masina_alta', a->>'v2',
      'foaia_mea', a->>'f1', 'cursa_mea', a->>'c_f1', 'de_mea', a->>'f1_de', 'la_mea', a->>'f1_la',
      'zi_mea', a->>'f1_zi', 'km_mea', a->>'f1_km',
      'foaia_alta', a->>'f2', 'cursa_alta', a->>'c_f2', 'de_alta', a->>'f2_de', 'la_alta', a->>'f2_la',
      'zi_alta', a->>'f2_zi', 'km_alta', a->>'f2_km')
  ];

  -- Termenele ieșirii le generează triggerul; numărul lor e „tot ce există”.
  select count(*) into v_n_oblig from public.vehicle_exit_obligations
   where organization_id = (a->>'org')::uuid and deleted_at is null;
  if v_n_oblig = 0 then
    raise exception 'PROBA LIVRARE: ieșirea lui VX nu a generat niciun termen — proba nu judecă nimic';
  end if;

  raise notice '';
  raise notice '  PROBA „LIVRARE — SCRIERE REALĂ PE ROLURI” (0191, 0199–0206, 0210–0218, 0225, 0226)';
  raise notice '  ──────────────────────────────────────────────────────────────────────────────────────────────';
  raise notice '  %  % % % % % % %', rpad('operație (firma A)', 52), lpad('sa', 7), lpad('adm', 7), lpad('hr', 7),
    lpad('mgr', 7), lpad('E1', 7), lpad('E2', 7), lpad('str', 7);

  -- Ordinea celulelor: super_admin, org_admin, hr, manager, E1, E2, străin.
  for r in
    select * from (values
      -- ═══ SELECT: rânduri văzute din firma A ═══════════════════════════════
      -- `vehicles` e veche, dar 0215 îi rescrie politica: hr-ul își vede mașina
      -- (VH) prin ramura „decizia 3”, nimic altceva din parc.
      ('vehicles', 'SELECT',
       $q$select 1 from public.vehicles where organization_id = {org}$q$,
       array['6', '6', '1', '2', '2', '2', '0']),
      -- 0225 (X1): valoarea de achiziție stă în `vehicle_costuri`, cu citirea
      -- costurilor (`vehicles:update = all`, sau `read >= team` pe echipă, fără
      -- pool). Până la 0225 era o COLOANĂ a rândului vizibil — rândul „DEFECT”
      -- `vehicles.valoare_achizitie` (azi 6/6/1/2/2/2/0): hr-ul o vedea pe VH prin
      -- „decizia 3”, managerul pe pool, angajații pe mașina lor și pe pool.
      ('vehicle_costuri', 'SELECT',
       $q$select 1 from public.vehicle_costuri where organization_id = {org}$q$,
       array['6', '6', '0', '1', '0', '0', '0']),
      ('vehicles.valoare_achizitie (coloana veche)', 'SELECT',
       $q$select 1 from public.vehicles where organization_id = {org} and valoare_achizitie is not null$q$,
       array['0', '0', '0', '0', '0', '0', '0']),
      -- 0225: costul documentelor (RCA pe V1, V2, VP, VH), aceeași regulă:
      -- managerul doar V2 (echipa, fără pool), hr nici pe VH-ul lui.
      ('vehicle_document_costuri', 'SELECT',
       $q$select 1 from public.vehicle_document_costuri where organization_id = {org}$q$,
       array['4', '4', '0', '1', '0', '0', '0']),
      ('vehicle_documents.cost (coloana veche)', 'SELECT',
       $q$select 1 from public.vehicle_documents where organization_id = {org} and cost is not null$q$,
       array['0', '0', '0', '0', '0', '0', '0']),
      -- 0226 §2: `foi_select` primește ramura de platformă (doar citire).
      ('trip_sheets', 'SELECT',
       $q$select 1 from public.trip_sheets where organization_id = {org}$q$,
       array['5', '5', '0', '4', '1', '3', '0']),
      -- 0226 §3: lotul îl vede doar cine l-a creat (adm: extrasul, hr: angajații).
      ('import_uploads', 'SELECT',
       $q$select 1 from public.import_uploads where organization_id = {org}$q$,
       array['0', '1', '1', '0', '0', '0', '0']),
      ('maintenance_rezumat_trimis', 'SELECT',
       $q$select 1 from public.maintenance_rezumat_trimis where organization_id = {org}$q$,
       array['2', '1', '0', '1', '0', '0', '0']),
      ('trip_route_templates', 'SELECT',
       $q$select 1 from public.trip_route_templates where organization_id = {org}$q$,
       array['1', '1', '0', '1', '1', '1', '0']),
      ('trip_sheet_curse', 'SELECT',
       $q$select 1 from public.trip_sheet_curse where organization_id = {org}$q$,
       array['5', '5', '0', '4', '1', '3', '0']),
      ('fleet_settings', 'SELECT',
       $q$select 1 from public.fleet_settings where organization_id = {org}$q$,
       array['1', '1', '0', '0', '0', '0', '0']),
      ('vehicle_document_type_setari', 'SELECT',
       $q$select 1 from public.vehicle_document_type_setari where organization_id = {org}$q$,
       array['1', '1', '0', '1', '1', '1', '0']),
      ('vehicle_service_plans', 'SELECT',
       $q$select 1 from public.vehicle_service_plans where organization_id = {org}$q$,
       array['3', '3', '0', '1', '0', '0', '0']),
      ('vehicle_service_entries', 'SELECT',
       $q$select 1 from public.vehicle_service_entries where organization_id = {org}$q$,
       array['3', '3', '0', '1', '0', '0', '0']),
      ('vehicle_expenses', 'SELECT',
       $q$select 1 from public.vehicle_expenses where organization_id = {org}$q$,
       array['4', '4', '0', '1', '0', '0', '0']),
      ('driver_licenses', 'SELECT',
       $q$select 1 from public.driver_licenses where organization_id = {org}$q$,
       array['3', '3', '3', '2', '1', '1', '0']),
      ('vehicle_fiscal_regimes', 'SELECT',
       $q$select 1 from public.vehicle_fiscal_regimes where organization_id = {org}$q$,
       array['2', '2', '0', '0', '0', '0', '0']),
      ('vehicle_consumption_norms', 'SELECT',
       $q$select 1 from public.vehicle_consumption_norms where organization_id = {org}$q$,
       array['1', '1', '0', '0', '0', '0', '0']),
      ('vehicle_fines', 'SELECT',
       $q$select 1 from public.vehicle_fines where organization_id = {org}$q$,
       array['1', '1', '0', '0', '0', '0', '0']),
      -- 0206 §F (X1): șoferul nu mai citește RÂNDUL incidentului (costuri,
      -- asigurător, observații, cercetarea SSM), ci doar câmpurile declarației,
      -- prin `incidente_declarate_de_mine`.
      ('vehicle_incidents', 'SELECT',
       $q$select 1 from public.vehicle_incidents where organization_id = {org}$q$,
       array['2', '2', '0', '0', '0', '0', '0']),
      ('incidente_declarate_de_mine', 'SELECT',
       $q$select 1 from public.incidente_declarate_de_mine({org}, 50, null, null)$q$,
       array['0', '0', '0', '0', '1', '0', '0']),
      ('maintenance_intervention_parts', 'SELECT',
       $q$select 1 from public.maintenance_intervention_parts where organization_id = {org}$q$,
       array['1', '1', '0', '1', '1', '0', '0']),
      ('fuel_cards', 'SELECT',
       $q$select 1 from public.fuel_cards where organization_id = {org}$q$,
       array['5', '5', '0', '2', '2', '2', '0']),
      ('fuel_card_imports', 'SELECT',
       $q$select 1 from public.fuel_card_imports where organization_id = {org}$q$,
       array[null, '1', '0', '0', '0', '0', '0']),
      ('fuel_card_import_profiles', 'SELECT',
       $q$select 1 from public.fuel_card_import_profiles where organization_id = {org}$q$,
       array[null, '1', '0', '0', '0', '0', '0']),
      ('fuel_card_transactions', 'SELECT',
       $q$select 1 from public.fuel_card_transactions where organization_id = {org}$q$,
       array['1', '1', '0', '0', '0', '0', '0']),
      ('vehicle_handovers', 'SELECT',
       $q$select 1 from public.vehicle_handovers where organization_id = {org}$q$,
       array['3', '3', '1', '1', '1', '1', '0']),
      ('vehicle_reservations', 'SELECT',
       $q$select 1 from public.vehicle_reservations where organization_id = {org}$q$,
       array['3', '3', '0', '2', '1', '1', '0']),
      ('trip_sheet_uit', 'SELECT',
       $q$select 1 from public.trip_sheet_uit where organization_id = {org}$q$,
       array['2', '2', '0', '1', '1', '1', '0']),
      ('vehicle_exits', 'SELECT',
       $q$select 1 from public.vehicle_exits where organization_id = {org}$q$,
       array['1', '1', '0', '0', '0', '0', '0']),
      ('vehicle_exit_obligations', 'SELECT',
       $q$select 1 from public.vehicle_exit_obligations where organization_id = {org}$q$,
       array[v_n_oblig::text, v_n_oblig::text, '0', '0', '0', '0', '0']),

      -- ═══ Funcțiile public.* noi ═══════════════════════════════════════════
      ('flota_prag_salt_km(V1)', 'SELECT',
       $q$select 1 where public.flota_prag_salt_km({v1}) is not null$q$,
       array['1', '1', '0', '0', '1', '0', '0']),
      ('flota_prag_salt_km(VP)', 'SELECT',
       $q$select 1 where public.flota_prag_salt_km({vp}) is not null$q$,
       array['1', '1', '0', '1', '1', '1', '0']),
      ('verificari_soferi (4 fișe)', 'SELECT',
       $q$select 1 from public.verificari_soferi({org}, array[{e_e1}, {e_e2}, {e_mgr}, {e_hr}]::uuid[], app.azi_local())$q$,
       array['4', '4', '4', '2', '1', '1', '0']),
      -- hr = 0, deși își vede mașina (VH) în `vehicles`: funcția e SECURITY
      -- INVOKER și ar moșteni ramura „decizia 3” din `vehicule_select` (0215),
      -- cu un rând fals („fără regim” toată luna, când VH are regim). 0205 §7 o
      -- taie explicit, pe `app.poate_vedea_vehicul` (reparat 22.10.2026).
      ('flota_fiscal_luna (rânduri)', 'SELECT',
       $q$select 1 from public.flota_fiscal_luna({org}, {luna}::date)$q$,
       array['6', '6', '0', '2', '2', '2', '0']),
      ('flota_fiscal_luna (cu regim)', 'SELECT',
       $q$select 1 from public.flota_fiscal_luna({org}, {luna}::date) where regim is not null$q$,
       array['2', '2', '0', '0', '0', '0', '0']),
      -- hr = 1 prin `payroll:read = all`, cu `valoare_intrare`: excepția salarizării
      -- (0225 §8), baza legală a avantajului (Codul fiscal art. 76 alin. (3)
      -- lit. j), doar pe alocările cu folosință personală — nu „costurile” parcului.
      ('avantaj_natura_flota(E1)', 'SELECT',
       $q$select 1 from public.avantaj_natura_flota({org}, {e_e1}, {luna}::date)$q$,
       array['1', '1', '1', '0', '0', '0', '0']),
      ('sofer_sugerat(V2)', 'SELECT',
       $q$select 1 from public.sofer_sugerat({org}, {v2}, now())$q$,
       array['1', '1', '0', '0', '0', '0', '0']),
      -- Lista o primește doar cine atribuie (`maintenance:update` ≥ team); tehnician
      -- e orice membru cu `maintenance:read` ≠ none: adm, M, E1, E2 — nu și hr.
      ('tehnicieni_mentenanta', 'SELECT',
       $q$select 1 from public.tehnicieni_mentenanta({org})$q$,
       array['0', '4', '0', '0', '0', '0', '0']),
      ('ocuparea_vehiculelor_pool (10 zile)', 'SELECT',
       $q$select 1 from public.ocuparea_vehiculelor_pool({org}, app.azi_local(), app.azi_local() + 10)$q$,
       array['0', '3', '0', '3', '3', '3', '0']),
      ('setarile_rezervarilor', 'SELECT',
       $q$select 1 from public.setarile_rezervarilor({org})$q$,
       array['0', '1', '1', '1', '1', '1', '0']),
      ('reinnoieste_autorizatie_iscir', 'RPC',
       $q$select public.reinnoieste_autorizatie_iscir({a1}, app.azi_local() + 500, 'ISCIR-NOU', null, app.azi_local(), null, null)$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      -- 0214 §11b (X2): repotrivirea atomică, INVOKER, sub RLS-ul apelantului;
      -- un rând neatins (USING) derulează tot apelul (P0001).
      ('repotriveste_tranzactii_card', 'RPC',
       $q$select public.repotriveste_tranzactii_card({org}, jsonb_build_array(jsonb_build_object('id', {tx1}::text, 'stare_potrivire', 'fara_alimentare')))$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),

      -- ═══ INSERT ═══════════════════════════════════════════════════════════
      ('INSERT maintenance_rezumat_trimis', 'INSERT',
       $q$insert into public.maintenance_rezumat_trimis (organization_id, user_id, tip, entity_id) values ({org}, auth.uid(), 'contor_aproape', {eq1})$q$,
       array['refuz', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('INSERT trip_route_templates', 'INSERT',
       $q$insert into public.trip_route_templates (organization_id, denumire, de_la_loc, pana_la_loc, scop, created_by, updated_by) values ({org}, 'Probă', 'A', 'B', 'Test', auth.uid(), auth.uid())$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('INSERT trip_sheet_curse pe foaia proprie', 'INSERT',
       $q$insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la, de_la_loc, pana_la_loc, scop, km_plecare, km_sosire, created_by, updated_by) values ({org}, {foaia_mea}, {de_mea}::timestamptz, {la_mea}::timestamptz, 'Client', 'Sediu', 'Întoarcere', {km_mea}::int, {km_mea}::int + 30, auth.uid(), auth.uid())$q$,
       array['refuz', 'ok:1', 'refuz', 'ok:1', 'ok:1', 'ok:1', 'refuz']),
      ('INSERT trip_sheet_curse pe foaia altuia', 'INSERT',
       $q$insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la, de_la_loc, pana_la_loc, scop, km_plecare, km_sosire, created_by, updated_by) values ({org}, {foaia_alta}, {de_alta}::timestamptz, {la_alta}::timestamptz, 'Client', 'Sediu', 'Întoarcere', {km_alta}::int, {km_alta}::int + 30, auth.uid(), auth.uid())$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('INSERT vehicle_document_type_setari', 'INSERT',
       $q$insert into public.vehicle_document_type_setari (organization_id, document_type_id, activ, obligatoriu, created_by, updated_by) select {org}, t.id, true, false, auth.uid(), auth.uid() from public.vehicle_document_types t where t.organization_id is null and t.cod = 'itp'$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('INSERT vehicle_service_plans', 'INSERT',
       $q$insert into public.vehicle_service_plans (organization_id, vehicle_id, denumire, interval_luni, baza_data, baza_km, created_by, updated_by) values ({org}, {v2}, 'Plan probă', 12, app.azi_local() - 10, 0, auth.uid(), auth.uid())$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('INSERT vehicle_service_entries', 'INSERT',
       $q$insert into public.vehicle_service_entries (organization_id, vehicle_id, data_interventiei, km, tip, descriere, created_by, updated_by) values ({org}, {v2}, app.azi_local() - 1, 20100, 'reparatie', 'Probă', auth.uid(), auth.uid())$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('INSERT vehicle_expenses', 'INSERT',
       $q$insert into public.vehicle_expenses (organization_id, vehicle_id, categorie, data_cheltuielii, suma, created_by, updated_by) values ({org}, {v2}, 'parcare', app.azi_local() - 1, 10, auth.uid(), auth.uid())$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      -- 0225: upsert-ul aplicației pe rândul de cost existent.
      ('UPSERT vehicle_costuri', 'INSERT',
       $q$insert into public.vehicle_costuri (organization_id, vehicle_id, valoare_achizitie, created_by, updated_by) values ({org}, {v1}, 61000, auth.uid(), auth.uid()) on conflict (vehicle_id) do update set valoare_achizitie = excluded.valoare_achizitie, updated_by = excluded.updated_by$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('UPSERT vehicle_document_costuri', 'INSERT',
       $q$insert into public.vehicle_document_costuri (organization_id, document_id, cost, created_by, updated_by) values ({org}, {d1}, 1300, auth.uid(), auth.uid()) on conflict (document_id) do update set cost = excluded.cost, updated_by = excluded.updated_by$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      -- 0226 §3: `<resursă>:create = all` (angajați: adm, hr; extrase: adm).
      ('INSERT import_uploads (angajați)', 'INSERT',
       $q$insert into public.import_uploads (organization_id, resursa, cale, created_by, updated_by) values ({org}, 'employees', 'x/employees/x/angajati.xlsx', auth.uid(), auth.uid())$q$,
       array['refuz', 'ok:1', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('INSERT import_uploads (extras de card)', 'INSERT',
       $q$insert into public.import_uploads (organization_id, resursa, cale, created_by, updated_by) values ({org}, 'vehicles', 'x/vehicles/x/extras.csv', auth.uid(), auth.uid())$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('INSERT driver_licenses (permisul lui hr)', 'INSERT',
       $q$insert into public.driver_licenses (organization_id, employee_id, numar, categorii, expira_la) values ({org}, {e_hr}, 'P-HR-PROBA', array['B'], app.azi_local() + 300)$q$,
       array['refuz', 'ok:1', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('INSERT vehicle_fiscal_regimes', 'INSERT',
       $q$insert into public.vehicle_fiscal_regimes (organization_id, vehicle_id, valabil_de_la, regim, motiv, created_by, updated_by) values ({org}, {vl}, app.azi_local() - 5, 'limitat_50', 'Probă', auth.uid(), auth.uid())$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('INSERT vehicle_consumption_norms', 'INSERT',
       $q$insert into public.vehicle_consumption_norms (organization_id, vehicle_id, valabil_de_la, l_100km) values ({org}, {v1}, app.azi_local() - 5, 6.5)$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('INSERT vehicle_fines', 'INSERT',
       $q$insert into public.vehicle_fines (organization_id, vehicle_id, numar_pv, constatata_la, fapta) values ({org}, {v1}, 'PV-PROBA', now() - interval '1 day', 'Probă')$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('INSERT vehicle_incidents: dauna pe mașina mea', 'INSERT',
       $q$insert into public.vehicle_incidents (organization_id, vehicle_id, tip, produs_la, descriere, sofer_id, declarat_de_employee_id, created_by, updated_by) values ({org}, {masina_mea}, 'avarie', {ieri}::timestamptz, 'Probă: zgârietură.', {fisa_mea}, {fisa_mea}, auth.uid(), auth.uid())$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'ok:1', 'ok:1', 'refuz']),
      ('INSERT vehicle_incidents: dauna pe pool', 'INSERT',
       $q$insert into public.vehicle_incidents (organization_id, vehicle_id, tip, produs_la, descriere, sofer_id, declarat_de_employee_id, created_by, updated_by) values ({org}, {vp}, 'avarie', {ieri}::timestamptz, 'Probă: zgârietură.', {fisa_mea}, {fisa_mea}, auth.uid(), auth.uid())$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'ok:1', 'ok:1', 'refuz']),
      ('INSERT vehicle_incidents: pe mașina colegului', 'INSERT',
       $q$insert into public.vehicle_incidents (organization_id, vehicle_id, tip, produs_la, descriere, sofer_id, declarat_de_employee_id, created_by, updated_by) values ({org}, {masina_alta}, 'avarie', {ieri}::timestamptz, 'Probă: zgârietură.', {fisa_mea}, {fisa_mea}, auth.uid(), auth.uid())$q$,
       array[null, null, null, null, 'refuz', 'refuz', null]),
      ('INSERT vehicle_incidents: angajatul cu cost', 'INSERT',
       $q$insert into public.vehicle_incidents (organization_id, vehicle_id, tip, produs_la, descriere, sofer_id, declarat_de_employee_id, cost_estimat, created_by, updated_by) values ({org}, {masina_mea}, 'avarie', {ieri}::timestamptz, 'Probă: zgârietură.', {fisa_mea}, {fisa_mea}, 500, auth.uid(), auth.uid())$q$,
       array[null, null, null, null, 'refuz', 'refuz', null]),
      ('INSERT maintenance_intervention_parts', 'INSERT',
       $q$insert into public.maintenance_intervention_parts (organization_id, intervention_id, denumire, cantitate, unitate, pret_unitar) values ({org}, {i1}, 'Garnitură', 1, 'buc', 12)$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('INSERT fuel_cards', 'INSERT',
       $q$insert into public.fuel_cards (organization_id, emitent, ultimele_cifre, vehicle_id, valabil_pana, created_by, updated_by) values ({org}, 'shell', '9999', {v1}, app.azi_local() + 100, auth.uid(), auth.uid())$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('INSERT fuel_card_imports', 'INSERT',
       $q$insert into public.fuel_card_imports (id, organization_id, emitent, fisier_nume, fisier_sha256, perioada_de_la, perioada_pana_la, randuri_fisier, created_by, updated_by) values (gen_random_uuid(), {org}, 'mol', 'mol.csv', repeat('b', 64), app.azi_local() - 30, app.azi_local(), 1, auth.uid(), auth.uid())$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('INSERT fuel_card_import_profiles', 'INSERT',
       $q$insert into public.fuel_card_import_profiles (organization_id, emitent, mapare, created_by, updated_by) values ({org}, 'mol', '{"numar_card":"Card"}', auth.uid(), auth.uid())$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('INSERT fuel_card_transactions', 'INSERT',
       $q$insert into public.fuel_card_transactions (organization_id, import_id, emitent, cheie_dedup, rand_fisier, card_ultimele_cifre, efectuat_la, produs, categorie, valoare_bruta, moneda, stare_potrivire, created_by, updated_by) values ({org}, {lot}, 'omv_petrom', 'h:proba#2', 3, '9999', now() - interval '2 days', 'Motorină', 'combustibil', 100, 'RON', 'card_necunoscut', auth.uid(), auth.uid())$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('INSERT vehicle_handovers (restituirea lui E2)', 'INSERT',
       $q$insert into public.vehicle_handovers (organization_id, alocare_predata_id, nivel_rezervor, stare_generala, daune_constatate, created_by, updated_by) values ({org}, {al_e2_v1}, 'plin', 'buna', false, auth.uid(), auth.uid())$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('INSERT vehicle_reservations proprie (pool)', 'INSERT',
       $q$insert into public.vehicle_reservations (organization_id, vehicle_id, employee_id, de_la, pana_la, scop, created_by, updated_by) values ({org}, {vp}, {fisa_mea}, app.azi_local() + 5, app.azi_local() + 5, 'Probă', auth.uid(), auth.uid())$q$,
       array['refuz', 'ok:1', 'refuz', 'ok:1', 'ok:1', 'ok:1', 'refuz']),
      ('INSERT vehicle_reservations pentru E2', 'INSERT',
       $q$insert into public.vehicle_reservations (organization_id, vehicle_id, employee_id, de_la, pana_la, scop, created_by, updated_by) values ({org}, {vp}, {e_e2}, app.azi_local() + 6, app.azi_local() + 6, 'Probă', auth.uid(), auth.uid())$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', null, 'refuz']),
      ('INSERT trip_sheet_uit pe cursa proprie', 'INSERT',
       $q$insert into public.trip_sheet_uit (organization_id, trip_sheet_id, cursa_id, uit, data_inceput, created_by, updated_by) values ({org}, {foaia_mea}, {cursa_mea}, '3V0P0L0P0T3JUW46', {zi_mea}::date, auth.uid(), auth.uid())$q$,
       array['refuz', 'ok:1', 'refuz', 'ok:1', 'ok:1', 'ok:1', 'refuz']),
      ('INSERT trip_sheet_uit pe cursa altuia', 'INSERT',
       $q$insert into public.trip_sheet_uit (organization_id, trip_sheet_id, cursa_id, uit, data_inceput, created_by, updated_by) values ({org}, {foaia_alta}, {cursa_alta}, '3V0P0L0P0T3JUW46', {zi_alta}::date, auth.uid(), auth.uid())$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('INSERT vehicle_exits', 'INSERT',
       $q$insert into public.vehicle_exits (organization_id, vehicle_id, tip, data_iesire, km_iesire, motiv, cumparator, created_by, updated_by) values ({org}, {vl}, 'vanzare', app.azi_local() - 1, 40000, 'Vândut prin probă.', 'Cumpărător SRL', auth.uid(), auth.uid())$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('INSERT vehicle_exit_obligations (direct)', 'INSERT',
       $q$insert into public.vehicle_exit_obligations (organization_id, exit_id, vehicle_id, cod, denumire, natura, ordine, created_by, updated_by) values ({org}, {iesire}, {vx}, 'proba', 'Probă', 'altele', 99, auth.uid(), auth.uid())$q$,
       array['refuz', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),

      -- ═══ UPDATE (rânduri efectiv modificate) ══════════════════════════════
      ('UPDATE maintenance_rezumat_trimis', 'UPDATE',
       $q$update public.maintenance_rezumat_trimis set notification_id = null where organization_id = {org}$q$,
       array['refuz', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('UPDATE trip_route_templates', 'UPDATE',
       $q$update public.trip_route_templates set km_estimat = 55, updated_by = auth.uid() where organization_id = {org}$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('UPDATE trip_sheet_curse (toate ale firmei)', 'UPDATE',
       $q$update public.trip_sheet_curse set scop = 'Livrare (probă)', updated_by = auth.uid() where organization_id = {org}$q$,
       array['refuz', 'ok:5', 'refuz', 'ok:1', 'ok:1', 'ok:3', 'refuz']),
      ('UPDATE fleet_settings', 'UPDATE',
       $q$update public.fleet_settings set prag_salt_km = 900, updated_by = auth.uid() where organization_id = {org}$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('UPDATE vehicle_document_type_setari', 'UPDATE',
       $q$update public.vehicle_document_type_setari set obligatoriu = false, updated_by = auth.uid() where organization_id = {org}$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('UPDATE vehicle_service_plans', 'UPDATE',
       $q$update public.vehicle_service_plans set updated_by = auth.uid() where organization_id = {org}$q$,
       array['refuz', 'ok:3', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('UPDATE vehicle_service_entries', 'UPDATE',
       $q$update public.vehicle_service_entries set updated_by = auth.uid() where organization_id = {org}$q$,
       array['refuz', 'ok:3', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('UPDATE vehicle_expenses', 'UPDATE',
       $q$update public.vehicle_expenses set suma = 30, updated_by = auth.uid() where organization_id = {org}$q$,
       array['refuz', 'ok:4', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('UPDATE vehicle_costuri', 'UPDATE',
       $q$update public.vehicle_costuri set valoare_achizitie = 1000, updated_by = auth.uid() where organization_id = {org}$q$,
       array['refuz', 'ok:6', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('UPDATE vehicle_document_costuri', 'UPDATE',
       $q$update public.vehicle_document_costuri set cost = 900, updated_by = auth.uid() where organization_id = {org}$q$,
       array['refuz', 'ok:4', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      -- Consumul: fiecare își consumă DOAR lotul lui (adm nu-l atinge pe al lui hr).
      ('UPDATE import_uploads: consum lotul meu', 'UPDATE',
       $q$update public.import_uploads set consumat_la = now(), updated_by = auth.uid() where organization_id = {org} and consumat_la is null$q$,
       array['refuz', 'ok:1', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz']),
      -- Calea emisă nu se mută pe documentul unui angajat (P0001), pentru nimeni.
      ('UPDATE import_uploads: mut calea pe o fișă', 'UPDATE',
       $q$update public.import_uploads set cale = {org} || '/employees/' || {e_e1} || '/contract.pdf', updated_by = auth.uid() where organization_id = {org}$q$,
       array['refuz', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('UPDATE driver_licenses', 'UPDATE',
       $q$update public.driver_licenses set updated_by = auth.uid() where organization_id = {org}$q$,
       array['refuz', 'ok:3', 'ok:3', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('UPDATE vehicle_fiscal_regimes', 'UPDATE',
       $q$update public.vehicle_fiscal_regimes set updated_by = auth.uid() where organization_id = {org}$q$,
       array['refuz', 'ok:2', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('UPDATE vehicle_consumption_norms', 'UPDATE',
       $q$update public.vehicle_consumption_norms set l_100km = 7.8 where organization_id = {org}$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('UPDATE vehicle_fines', 'UPDATE',
       $q$update public.vehicle_fines set observatii = 'Probă', updated_by = auth.uid() where organization_id = {org}$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('UPDATE vehicle_incidents', 'UPDATE',
       $q$update public.vehicle_incidents set observatii = 'Probă', updated_by = auth.uid() where organization_id = {org}$q$,
       array['refuz', 'ok:2', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('UPDATE maintenance_intervention_parts', 'UPDATE',
       $q$update public.maintenance_intervention_parts set pret_unitar = 40 where organization_id = {org}$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('UPDATE fuel_cards', 'UPDATE',
       $q$update public.fuel_cards set observatii = 'Probă', updated_by = auth.uid() where organization_id = {org}$q$,
       array['refuz', 'ok:5', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('UPDATE fuel_card_imports', 'UPDATE',
       $q$update public.fuel_card_imports set updated_by = auth.uid() where organization_id = {org}$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('UPDATE fuel_card_import_profiles', 'UPDATE',
       $q$update public.fuel_card_import_profiles set separator_zecimal = ',', updated_by = auth.uid() where organization_id = {org}$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('UPDATE fuel_card_transactions (nota)', 'UPDATE',
       $q$update public.fuel_card_transactions set nota = 'Probă', updated_by = auth.uid() where organization_id = {org}$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('UPDATE vehicle_handovers: confirm PV-ul meu', 'UPDATE',
       $q$update public.vehicle_handovers set confirmat_primitor_la = now(), updated_by = auth.uid() where organization_id = {org} and primitor_employee_id = {fisa_mea} and stare = 'finalizat'$q$,
       array[null, null, 'ok:1', null, 'ok:1', null, null]),
      ('UPDATE vehicle_handovers: confirm PV-ul lui E1', 'UPDATE',
       $q$update public.vehicle_handovers set confirmat_primitor_la = now(), updated_by = auth.uid() where id = {pv_e1}$q$,
       array['refuz', null, 'refuz', 'refuz', null, 'refuz', 'refuz']),
      ('UPDATE vehicle_handovers: ciorna (constatări)', 'UPDATE',
       $q$update public.vehicle_handovers set observatii = 'Probă', updated_by = auth.uid() where id = {pv_c}$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      -- Detaliile rezervării nu se mai schimbă după cerere (P0001, `rezervari_inainte`),
      -- pentru nimeni: scrierile legitime sunt decizia și anularea.
      ('UPDATE vehicle_reservations: detaliile mele', 'UPDATE',
       $q$update public.vehicle_reservations set destinatie = 'Probă', updated_by = auth.uid() where organization_id = {org} and employee_id = {fisa_mea}$q$,
       array[null, null, null, 'refuz', 'refuz', 'refuz', null]),
      ('UPDATE vehicle_reservations: aprob cererea lui E2', 'UPDATE',
       $q$update public.vehicle_reservations set status = 'confirmata', updated_by = auth.uid() where organization_id = {org} and employee_id = {e_e2} and status = 'ceruta'$q$,
       array['refuz', 'ok:1', 'refuz', 'ok:1', 'refuz', 'refuz', 'refuz']),
      ('UPDATE vehicle_reservations: anulez rezervarea mea', 'UPDATE',
       $q$update public.vehicle_reservations set status = 'anulata', motiv_anulare = 'Nu mai e nevoie de mașină.', updated_by = auth.uid() where organization_id = {org} and employee_id = {fisa_mea}$q$,
       array[null, null, null, 'ok:1', 'ok:1', 'ok:1', null]),
      ('UPDATE vehicle_reservations: anulez pe a lui E1', 'UPDATE',
       $q$update public.vehicle_reservations set status = 'anulata', motiv_anulare = 'Nu mai e nevoie de mașină.', updated_by = auth.uid() where organization_id = {org} and employee_id = {e_e1}$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', null, 'refuz', 'refuz']),
      -- Aprobatorul (managerul direct) anulează rezervarea subordonatului, cu motiv:
      -- ramura explicită din `rezervari_inainte` (update SAU approve), cu notificare.
      ('UPDATE vehicle_reservations: anulez pe a lui E2', 'UPDATE',
       $q$update public.vehicle_reservations set status = 'anulata', motiv_anulare = 'Nu mai e nevoie de mașină.', updated_by = auth.uid() where organization_id = {org} and employee_id = {e_e2}$q$,
       array[null, 'ok:1', null, 'ok:1', 'refuz', null, null]),
      ('UPDATE trip_sheet_uit', 'UPDATE',
       $q$update public.trip_sheet_uit set observatii = 'Probă', updated_by = auth.uid() where organization_id = {org}$q$,
       array['refuz', 'ok:2', 'refuz', 'refuz', 'ok:1', 'ok:1', 'refuz']),
      ('UPDATE vehicle_exits (anulare)', 'UPDATE',
       $q$update public.vehicle_exits set anulat_la = now(), motiv_anulare = 'Înregistrată din greșeală.', updated_by = auth.uid() where organization_id = {org}$q$,
       array['refuz', 'ok:1', 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),
      ('UPDATE vehicle_exit_obligations', 'UPDATE',
       $q$update public.vehicle_exit_obligations set nota = 'Probă', updated_by = auth.uid() where organization_id = {org}$q$,
       array['refuz', 'ok:' || v_n_oblig, 'refuz', 'refuz', 'refuz', 'refuz', 'refuz']),

      -- ═══ Firma străină, în firma EI, pe obiectele firmei A ════════════════
      -- Martorul pozitiv întâi: același administrator scrie în firma lui.
      ('B: martor — cheltuială pe vehiculul B', 'INSERT',
       $q$insert into public.vehicle_expenses (organization_id, vehicle_id, categorie, data_cheltuielii, suma, created_by, updated_by) values ({org_b}, {vb}, 'parcare', app.azi_local() - 1, 10, auth.uid(), auth.uid())$q$,
       array[null, null, null, null, null, null, 'ok:1']),
      ('B: cheltuială pe vehiculul A', 'INSERT',
       $q$insert into public.vehicle_expenses (organization_id, vehicle_id, categorie, data_cheltuielii, suma, created_by, updated_by) values ({org_b}, {v1}, 'parcare', app.azi_local() - 1, 10, auth.uid(), auth.uid())$q$,
       array[null, null, null, null, null, null, 'refuz']),
      ('B: service pe vehiculul A', 'INSERT',
       $q$insert into public.vehicle_service_entries (organization_id, vehicle_id, data_interventiei, km, tip, descriere, created_by, updated_by) values ({org_b}, {v1}, app.azi_local() - 1, 10200, 'reparatie', 'Probă', auth.uid(), auth.uid())$q$,
       array[null, null, null, null, null, null, 'refuz']),
      ('B: card pe vehiculul A', 'INSERT',
       $q$insert into public.fuel_cards (organization_id, emitent, ultimele_cifre, vehicle_id, created_by, updated_by) values ({org_b}, 'shell', '8888', {v1}, auth.uid(), auth.uid())$q$,
       array[null, null, null, null, null, null, 'refuz']),
      ('B: tranzacție în lotul A', 'INSERT',
       $q$insert into public.fuel_card_transactions (organization_id, import_id, emitent, cheie_dedup, rand_fisier, efectuat_la, produs, categorie, valoare_bruta, moneda, stare_potrivire, created_by, updated_by) values ({org_b}, {lot}, 'omv_petrom', 'h:proba#3', 4, now() - interval '2 days', 'Motorină', 'combustibil', 100, 'RON', 'card_necunoscut', auth.uid(), auth.uid())$q$,
       array[null, null, null, null, null, null, 'refuz']),
      ('B: rezervare pe pool-ul A', 'INSERT',
       $q$insert into public.vehicle_reservations (organization_id, vehicle_id, employee_id, de_la, pana_la, scop, created_by, updated_by) values ({org_b}, {vp}, {e_str}, app.azi_local() + 7, app.azi_local() + 7, 'Probă', auth.uid(), auth.uid())$q$,
       array[null, null, null, null, null, null, 'refuz']),
      ('B: cursă pe foaia A', 'INSERT',
       $q$insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la, de_la_loc, pana_la_loc, scop, km_plecare, km_sosire, created_by, updated_by) values ({org_b}, {f1}, {f1_de}::timestamptz, {f1_la}::timestamptz, 'Client', 'Sediu', 'Întoarcere', 10150, 10180, auth.uid(), auth.uid())$q$,
       array[null, null, null, null, null, null, 'refuz']),
      ('B: UIT pe cursa A', 'INSERT',
       $q$insert into public.trip_sheet_uit (organization_id, trip_sheet_id, cursa_id, uit, data_inceput, created_by, updated_by) values ({org_b}, {f1}, {c_f1}, '3V0P0L0P0T3JUW46', {f1_zi}::date, auth.uid(), auth.uid())$q$,
       array[null, null, null, null, null, null, 'refuz']),
      ('B: piesă pe intervenția A', 'INSERT',
       $q$insert into public.maintenance_intervention_parts (organization_id, intervention_id, denumire, cantitate, unitate, pret_unitar) values ({org_b}, {i1}, 'Garnitură', 1, 'buc', 12)$q$,
       array[null, null, null, null, null, null, 'refuz']),
      ('B: PV pe alocarea A', 'INSERT',
       $q$insert into public.vehicle_handovers (organization_id, alocare_predata_id, nivel_rezervor, stare_generala, daune_constatate, created_by, updated_by) values ({org_b}, {al_e2_v1}, 'plin', 'buna', false, auth.uid(), auth.uid())$q$,
       array[null, null, null, null, null, null, 'refuz']),
      ('B: ieșire pe vehiculul A', 'INSERT',
       $q$insert into public.vehicle_exits (organization_id, vehicle_id, tip, data_iesire, km_iesire, motiv, cumparator, created_by, updated_by) values ({org_b}, {vl}, 'vanzare', app.azi_local() - 1, 40000, 'Vândut prin probă.', 'Cumpărător SRL', auth.uid(), auth.uid())$q$,
       array[null, null, null, null, null, null, 'refuz']),
      ('B: permis pentru angajatul A', 'INSERT',
       $q$insert into public.driver_licenses (organization_id, employee_id, numar, categorii, expira_la) values ({org_b}, {e_hr}, 'P-STR-PROBA', array['B'], app.azi_local() + 300)$q$,
       array[null, null, null, null, null, null, 'refuz']),
      ('B: daună pe vehiculul A', 'INSERT',
       $q$insert into public.vehicle_incidents (organization_id, vehicle_id, tip, produs_la, descriere, created_by, updated_by) values ({org_b}, {v1}, 'avarie', {ieri}::timestamptz, 'Probă: zgârietură.', auth.uid(), auth.uid())$q$,
       array[null, null, null, null, null, null, 'refuz']),
      ('B: amendă pe vehiculul A', 'INSERT',
       $q$insert into public.vehicle_fines (organization_id, vehicle_id, numar_pv, constatata_la, fapta) values ({org_b}, {v1}, 'PV-STR', now() - interval '1 day', 'Probă')$q$,
       array[null, null, null, null, null, null, 'refuz']),
      ('B: regim fiscal pe vehiculul A', 'INSERT',
       $q$insert into public.vehicle_fiscal_regimes (organization_id, vehicle_id, valabil_de_la, regim, motiv, created_by, updated_by) values ({org_b}, {vl}, app.azi_local() - 5, 'limitat_50', 'Probă', auth.uid(), auth.uid())$q$,
       array[null, null, null, null, null, null, 'refuz']),
      ('B: plan de service pe vehiculul A', 'INSERT',
       $q$insert into public.vehicle_service_plans (organization_id, vehicle_id, denumire, interval_luni, baza_data, baza_km, created_by, updated_by) values ({org_b}, {v2}, 'Plan probă', 12, app.azi_local() - 10, 0, auth.uid(), auth.uid())$q$,
       array[null, null, null, null, null, null, 'refuz'])
    ) as t(eticheta, op, sql, ast)
  loop
    v_celule := v_celule + pg_temp.judeca(r.eticheta, r.op, r.sql, r.ast, v_useri, v_ctx, baza, v_roluri);
  end loop;

  -- ═══ Pool-ul alocat unui om din echipă (0225, revizia X1) ═══════════════
  -- Baza lasă o mașină din pool să fie alocată (`vehicles.employee_id` se
  -- umple). Decizia din 21 oct dă managerului costurile echipei, „nu și ale
  -- pool-ului”, iar fișa (`poateVedeaService`) ascunde costurile oricărui pool.
  -- 0225 a strâns `vehicle_costuri` / `vehicle_document_costuri`; service-ul și
  -- cheltuielile (`vse_select` / `vex_select`, 0203) judecă doar după șofer și
  -- arată managerului pool-ul alocat subordonatului: DEFECT cunoscut, lăsat
  -- deschis de commitul 0225 („aceeași margine; rămân neatinse aici”).
  -- Alocarea cere pool-ul fără rezervări active (P0001): le anulează întâi
  -- administratorul, sub identitatea lui, ca în aplicație.
  perform set_config('request.jwt.claim.sub', a->>'u_adm', true);
  set local role authenticated;
  update public.vehicle_reservations
     set status = 'anulata', motiv_anulare = 'Mașina trece la un singur șofer.', updated_by = auth.uid()
   where vehicle_id = (a->>'vp')::uuid and status in ('ceruta', 'confirmata');
  reset role;
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, created_by, updated_by)
  values ((a->>'org')::uuid, (a->>'vp')::uuid, (a->>'e_e2')::uuid, now() - interval '2 days',
          (a->>'u_adm')::uuid, (a->>'u_adm')::uuid);
  if (select employee_id from public.vehicles where id = (a->>'vp')::uuid) is distinct from (a->>'e_e2')::uuid
     or not (select pool from public.vehicles where id = (a->>'vp')::uuid) then
    raise exception 'PROBA LIVRARE: alocarea pool-ului VP către E2 nu a ajuns pe vehicul (fixture greșit)';
  end if;
  raise notice '  %', rpad('— pool-ul VP alocat lui E2 (subordonatul lui M) —', 52);
  for r in
    select * from (values
      ('pool cu șofer: vehicles (VP)', 'SELECT',
       $q$select 1 from public.vehicles where id = {vp}$q$,
       array['1', '1', '0', '1', '1', '1', '0']),
      ('pool cu șofer: vehicle_costuri (VP)', 'SELECT',
       $q$select 1 from public.vehicle_costuri where vehicle_id = {vp}$q$,
       array['1', '1', '0', '0', '0', '0', '0']),
      ('pool cu șofer: vehicle_document_costuri (VP)', 'SELECT',
       $q$select 1 from public.vehicle_document_costuri where document_id = {d_vp}$q$,
       array['1', '1', '0', '0', '0', '0', '0']),
      ('pool cu șofer: vehicle_service_entries (VP)', 'SELECT',
       $q$select 1 from public.vehicle_service_entries where vehicle_id = {vp}$q$,
       array['1', '1', '0', 'D:1/0', '0', '0', '0']),
      ('pool cu șofer: vehicle_expenses (VP)', 'SELECT',
       $q$select 1 from public.vehicle_expenses where vehicle_id = {vp}$q$,
       array['1', '1', '0', 'D:1/0', '0', '0', '0'])
    ) as t(eticheta, op, sql, ast)
  loop
    v_celule := v_celule + pg_temp.judeca(r.eticheta, r.op, r.sql, r.ast, v_useri, v_ctx, baza, v_roluri);
  end loop;
  raise notice '  ──────────────────────────────────────────────────────────────────────────────────────────────';
  for r in select verdict, count(*) as n from pg_temp.rezultate group by verdict order by verdict loop
    raise notice '  %  %', rpad(r.verdict, 28), r.n;
  end loop;
  if exists (select 1 from pg_temp.rezultate where verdict not in ('OK', 'DEFECT')) then
    raise exception 'PROBA LIVRARE: % din % celule abat de la matricea intenționată',
      (select count(*) from pg_temp.rezultate where verdict not in ('OK', 'DEFECT')), v_celule;
  end if;
  raise notice '  TOATE cele % celule se potrivesc (D = defect cunoscut, nereparat: %).', v_celule,
    (select count(*) from pg_temp.rezultate where verdict = 'DEFECT');
  raise notice '';
end;
$$;

rollback;
