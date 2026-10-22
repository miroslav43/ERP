-- tests/rls/proba-flota-plafoane.sql
--
-- FLOTA, DUPĂ 0200 — REVIZIA DE SECURITATE A2: PLAFOANELE, NUMEROTAREA ȘI
-- SUPRAPUNERILE. Pe seed-ul real al rolurilor, ca `employee` (trip_sheets:update
-- = own) și ca `org_admin` (update = all).
--
-- Revizia automată a semnalat două categorii fără text („denial-of-service” și
-- „business-logic-integrity”). Proba a rulat întâi pe 0200 NEREPARAT (bancul
-- local, 22 oct 2026): au picat (1)×3, (2), (3), (4), (5)×2, (9), (11), (12),
-- (13), (14), (15) și (16)×2; au trecut deja (6), (7), (8), (10), (17).
--
-- ── DoS ─────────────────────────────────────────────────────────────────────
--  (1) o foaie primește cel mult 40 de curse, și pe adăugare la coadă, și pe
--      inserare la început; a 41-a: P0001; o cursă ștearsă eliberează locul.
--      Înainte: 300 de curse inserate în ordine inversă = 45.449 de rânduri de
--      audit (cost pătratic: fiecare inserare la început renumerota tot);
--  (2) renumerotarea atinge DOAR rândurile a căror poziție se schimbă: o cursă
--      inserată între a 7-a și a 8-a din 10 scrie 4 rânduri de audit (ea + 3
--      mutate). Înainte: 5 (cursa nouă se scria de două ori);
--  (3) cel mult 20 de alimentări pe foaie (bugetul lui `combustibilPeFoi`);
--  (4) cel mult 100 de șabloane de traseu active pe firmă (cât citește
--      `sabloaneTraseu`; peste, al 101-lea nu apărea nicăieri);
-- ── Integritatea numerotării ────────────────────────────────────────────────
--  (5) scriitorul NU șterge o foaie care are deja număr (P0001); administratorul
--      (update = all) o poate anula, iar rândul din registru se anulează cu motivul,
--      nu rămâne valabil;
--  (6) numărul anulat nu se refolosește (următoarea foaie primește următorul);
--  (7) retrimiterea păstrează numărul și nu dublează rândul din registru;
--  (8) o trimitere eșuată mai târziu în aceeași tranzacție NU consumă număr;
--  (9) stornarea unei foi aprobate anulează și rândul ei din registru;
--  (10) ciorna FĂRĂ număr o șterge în continuare scriitorul               [POZITIVĂ];
-- ── Suprapunerile între foi ─────────────────────────────────────────────────
--  (11) o ciornă rătăcită NU blochează cursa reală a aceleiași zile       [POZITIVĂ];
--  (12) poarta e la trimitere: a doua foaie suprapusă e oprită, cu numărul celei
--       trimise în mesaj;
--  (13) o cursă scrisă peste o foaie TRIMISĂ e refuzată pe loc;
--  (14) ocolirea prin respins → ciornă e închisă: foaia redeschisă nu se mai
--       trimite peste una deja trimisă;
--  (15) interogarea de suprapunere folosește indexul GiST pe (șofer, interval).
--       Înainte: scanare secvențială a tuturor curselor din bază, la fiecare cursă;
-- ── Identitatea foii numerotate ─────────────────────────────────────────────
--  (16) foaia numerotată, retrasă și golită de curse, nu-și mai mută ziua și nu
--       trece pe alt vehicul (P0001). Înainte: FP-2025-00001 retrimisă pe 2 ian.
--       2026, cu registrul spunând 31 dec. 2025;
--  (17) ciorna FĂRĂ număr își mută în continuare ziua                     [POZITIVĂ].
-- ── Revizorul adversarial A2 (0200 §E5; au picat pe 0200 de la acd49bdf: (18),
--    (19)×2 și (20); (21) trecea) ────────────────────────────────────────────
--  (18) `org_admin` dă contorul FP înapoi la 1: foaia nouă NU primește numărul
--       unei foi anulate. Înainte: FP-…-00001 a doua oară, și în registru;
--  (19) colegul `employee` care știe id-ul foii lui A nu află nimic din refuz:
--       cursa peste foaia ei trimisă, cea liberă, cea din altă zi și cea de pe
--       foaia trimisă dau toate 42501, la fel alimentările. Înainte: numărul
--       foii declarate, cu orele, ziua foii și starea ei, în P0001;
--  (20) la fel un utilizator din ALTĂ firmă, care trimite `organization_id`-ul
--       firmei lui A;
--  (21) `org_admin` (update = all) scrie în continuare o cursă și o alimentare
--       pe ciorna șoferului                                             [POZITIVĂ].
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

-- Momentul `ora` din ziua `zi`, în ora României. `ora` poate fi și un interval ('90 minutes').
create function pg_temp.la(zi date, ora text) returns timestamptz
language sql immutable as $$ select (zi::timestamp + ora::interval) at time zone 'Europe/Bucharest' $$;

-- Foaia zilei, ca `p_user`. Întoarce id-ul.
create function pg_temp.foaie(p_org uuid, p_vehicul uuid, p_angajat uuid, p_user uuid,
                              p_plecare timestamptz, p_km integer) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare, created_by, updated_by)
  values (p_org, p_vehicul, p_angajat, p_plecare, p_km, p_user, p_user)
  returning id into v_id;
  return v_id;
end $$;

-- O cursă: 'OK' sau 'SQLSTATE mesaj'.
create function pg_temp.cursa(p_org uuid, p_foaie uuid, p_user uuid, p_de_la timestamptz,
                              p_pana_la timestamptz, p_km integer) returns text
language plpgsql as $$
begin
  insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la,
                                       de_la_loc, pana_la_loc, scop, km_plecare, km_sosire, created_by, updated_by)
  values (p_org, p_foaie, p_de_la, p_pana_la, 'Sediu', 'Client', 'Livrare', p_km, p_km + 1, p_user, p_user);
  return 'OK';
exception when others then
  return sqlstate || ' ' || sqlerrm;
end $$;

-- O alimentare: 'OK' sau 'SQLSTATE mesaj'.
create function pg_temp.alim(p_org uuid, p_foaie uuid, p_user uuid, p_la timestamptz) returns text
language plpgsql as $$
begin
  insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la, created_by, updated_by)
  values (p_org, p_foaie, 10, 70, p_la, p_user, p_user);
  return 'OK';
exception when others then
  return sqlstate || ' ' || sqlerrm;
end $$;

-- Starea foii: 'OK' (un rând) sau 'SQLSTATE mesaj' / 'ZERO'.
create function pg_temp.stare(p_foaie uuid, p_user uuid, p_stare text, p_motiv text default null) returns text
language plpgsql as $$
declare v_n integer;
begin
  update public.trip_sheets
     set status = p_stare::public.trip_sheet_status, motiv_respingere = coalesce(p_motiv, motiv_respingere), updated_by = p_user
   where id = p_foaie;
  get diagnostics v_n = row_count;
  return case when v_n = 1 then 'OK' else 'ZERO' end;
exception when others then
  return sqlstate || ' ' || sqlerrm;
end $$;

-- Ștergerea logică a foii: 'OK' / 'ZERO' / 'SQLSTATE mesaj'.
create function pg_temp.sterge(p_foaie uuid, p_user uuid) returns text
language plpgsql as $$
declare v_n integer;
begin
  update public.trip_sheets set deleted_at = now(), updated_by = p_user where id = p_foaie;
  get diagnostics v_n = row_count;
  return case when v_n = 1 then 'OK' else 'ZERO' end;
exception when others then
  return sqlstate || ' ' || sqlerrm;
end $$;

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  -- Toate foile probei cad în ACELAȘI an (numerotarea e pe an): în primele 40
  -- de zile ale anului, ziua de pornire e 22 decembrie a anului trecut.
  v_zi       date := case when extract(year from app.azi_local() - 40) = extract(year from app.azi_local())
                          then app.azi_local() - 10
                          else date_trunc('year', app.azi_local())::date - 10 end;
  v_org      uuid := gen_random_uuid();
  v_org2     uuid := gen_random_uuid();
  v_u_adm    uuid := gen_random_uuid();
  v_u_a      uuid := gen_random_uuid();
  v_u_b      uuid := gen_random_uuid();
  v_u_x      uuid := gen_random_uuid();
  v_e_a      uuid := gen_random_uuid();
  v_e_b      uuid := gen_random_uuid();
  v_n6       uuid;
  v_numar6   text;
  v_r2       text;
  v_r3       text;
  v_r4       text;
  v_curse0   bigint;
  v_alim0    bigint;
  v_p        uuid[] := array(select gen_random_uuid() from generate_series(1, 12));
  v_s1       uuid;
  v_s1b      uuid;
  v_s2       uuid;
  v_n1       uuid;
  v_n2       uuid;
  v_n3       uuid;
  v_n4       uuid;
  v_n5       uuid;
  v_c4       uuid;
  v_numar4   text;
  v_sa       uuid;
  v_sb       uuid;
  v_sc       uuid;
  v_a        uuid;
  v_c        uuid;
  v_r        text;
  v_n        integer;
  i          integer;
  v_audit0   bigint;
  v_audit1   bigint;
  v_numar1   text;
  v_numar2   text;
  v_numar_b  text;
  v_urm      integer;
  v_urm2     integer;
  v_anulat   timestamptz;
  v_motiv    text;
  v_plan     text;
  v_linie    text;
  v_esecuri  int := 0;
begin
  raise notice '';
  raise notice '  PROBA „FLOTA — PLAFOANE, NUMEROTARE, SUPRAPUNERI” (0200, revizia A2)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-flota-plf-' || v_sufix, 'Proba Plafoane SRL',
     'RO' || (85000000 + (random() * 900000)::int)::text);
  -- A doua firmă: doar pentru (20), un utilizator străin de firma lui A.
  insert into public.organizations (id, slug, name, cui) values
    (v_org2, 'proba-flota-plf2-' || v_sufix, 'Proba Plafoane Bis SRL',
     'RO' || (86000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select o, f.feature_key, true, now() from public.features f, unnest(array[v_org, v_org2]) o;
  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_adm, 'plf-adm-' || v_sufix || '@proba.test', now()),
    (v_u_a,   'plf-a-'   || v_sufix || '@proba.test', now()),
    (v_u_b,   'plf-b-'   || v_sufix || '@proba.test', now()),
    (v_u_x,   'plf-x-'   || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org,  v_u_adm, 'org_admin'),
    (v_org,  v_u_a,   'employee'),
    (v_org,  v_u_b,   'employee'),
    (v_org2, v_u_x,   'employee');
  insert into public.employees (id, organization_id, marca, first_name, last_name, hired_on, status, user_id) values
    (v_e_a, v_org, 'PLF-A', 'Ana', 'Șofer', app.azi_local() - 400, 'activ', v_u_a),
    (v_e_b, v_org, 'PLF-B', 'Bogdan', 'Coleg', app.azi_local() - 400, 'activ', v_u_b);
  for i in 1 .. 12 loop
    insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent, pool,
                                 consum_mediu_declarat, created_by, updated_by)
    values (v_p[i], v_org, 'B' || (100 + (random() * 800)::int)::text || 'P' || lpad(i::text, 2, '0'),
            'Dacia', 'Logan', 1000, true, 6.5, v_u_adm, v_u_adm);
  end loop;

  -- ═══ (1) plafonul curselor ════════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  v_s1 := pg_temp.foaie(v_org, v_p[1], v_e_a, v_u_a, pg_temp.la(v_zi - 10, '10 minutes'), 1000);
  v_n := 0;
  for i in 1 .. 40 loop
    v_r := pg_temp.cursa(v_org, v_s1, v_u_a, pg_temp.la(v_zi - 10, (i * 10)::text || ' minutes'),
                         pg_temp.la(v_zi - 10, (i * 10 + 8)::text || ' minutes'), 1000 + 2 * (i - 1));
    if v_r = 'OK' then v_n := v_n + 1; end if;
  end loop;
  -- a 41-a la coadă și una inserată la început
  v_r := pg_temp.cursa(v_org, v_s1, v_u_a, pg_temp.la(v_zi - 10, '410 minutes'),
                       pg_temp.la(v_zi - 10, '418 minutes'), 1080);
  reset role;
  if v_n = 40 and v_r like 'P0001%cel mult 40 de curse%' then
    raise notice '  ✓ (1) 40 de curse intră, a 41-a la coadă e refuzată (P0001)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) % din 40 curse intrate; a 41-a: %', v_n, v_r;
  end if;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  v_r := pg_temp.cursa(v_org, v_s1, v_u_a, pg_temp.la(v_zi - 10, '1 minutes'),
                       pg_temp.la(v_zi - 10, '5 minutes'), 998);
  reset role;
  select count(*) into v_n from public.trip_sheet_curse where trip_sheet_id = v_s1 and deleted_at is null;
  if v_n = 40 and v_r like 'P0001%cel mult 40 de curse%' then
    raise notice '  ✓ (1) și inserarea la începutul unei foi pline e refuzată (P0001); rămân 40';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) inserarea la început pe foaia plină: % (% curse)', v_r, v_n;
  end if;

  -- o cursă ștearsă eliberează un loc
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  update public.trip_sheet_curse set deleted_at = now(), updated_by = v_u_a
   where trip_sheet_id = v_s1 and ordine = 40;
  v_r := pg_temp.cursa(v_org, v_s1, v_u_a, pg_temp.la(v_zi - 10, '410 minutes'),
                       pg_temp.la(v_zi - 10, '418 minutes'), 1078);
  reset role;
  if v_r = 'OK' then
    raise notice '  ✓ (1) după ștergerea unei curse se poate adăuga alta (plafonul numără doar cele active)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) locul eliberat nu se refolosește: %', v_r;
  end if;

  -- ═══ (2) renumerotarea atinge doar rândurile schimbate ════════════════════
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  v_s1b := pg_temp.foaie(v_org, v_p[2], v_e_a, v_u_a, pg_temp.la(v_zi - 11, '60 minutes'), 1000);
  for i in 1 .. 10 loop
    v_r := pg_temp.cursa(v_org, v_s1b, v_u_a, pg_temp.la(v_zi - 11, (i * 60)::text || ' minutes'),
                         pg_temp.la(v_zi - 11, (i * 60 + 30)::text || ' minutes'), 1000 + 4 * (i - 1));
  end loop;
  reset role;
  select count(*) into v_audit0 from public.audit_logs
   where entity_type = 'trip_sheet_curse'
     and entity_id in (select id from public.trip_sheet_curse where trip_sheet_id = v_s1b);
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  -- între a 7-a (07:00–07:30, km 1024–1025) și a 8-a (08:00): 07:35–07:50, km 1026
  v_r := pg_temp.cursa(v_org, v_s1b, v_u_a, pg_temp.la(v_zi - 11, '455 minutes'),
                       pg_temp.la(v_zi - 11, '470 minutes'), 1026);
  reset role;
  select count(*) into v_audit1 from public.audit_logs
   where entity_type = 'trip_sheet_curse'
     and entity_id in (select id from public.trip_sheet_curse where trip_sheet_id = v_s1b);
  -- noua cursă: 1 rând de creare, cu poziția ei dată la inserare; mutate: a 8-a, a 9-a, a 10-a
  if v_r = 'OK' and v_audit1 - v_audit0 = 4
     and (select string_agg(ordine::text, ',' order by plecare_la) from public.trip_sheet_curse where trip_sheet_id = v_s1b) = '1,2,3,4,5,6,7,8,9,10,11'
     and (select ordine from public.trip_sheet_curse where trip_sheet_id = v_s1b and plecare_la = pg_temp.la(v_zi - 11, '455 minutes')) = 8 then
    raise notice '  ✓ (2) inserare între a 7-a și a 8-a din 10: 4 rânduri de audit (nouă + 3 mutate), nu 11';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) rezultat %, rânduri de audit noi: % (așteptat 4), ordinea %', v_r, v_audit1 - v_audit0,
      (select string_agg(ordine::text, ',' order by plecare_la) from public.trip_sheet_curse where trip_sheet_id = v_s1b);
  end if;

  -- ═══ (3) plafonul alimentărilor ═══════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  v_s2 := pg_temp.foaie(v_org, v_p[3], v_e_a, v_u_a, pg_temp.la(v_zi - 12, '6 hours'), 1000);
  v_r := pg_temp.cursa(v_org, v_s2, v_u_a, pg_temp.la(v_zi - 12, '6 hours'), pg_temp.la(v_zi - 12, '20 hours'), 1000);
  v_n := 0;
  for i in 1 .. 20 loop
    begin
      insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la, created_by, updated_by)
      values (v_org, v_s2, 10, 70, pg_temp.la(v_zi - 12, (7 * 60 + i * 20)::text || ' minutes'), v_u_a, v_u_a);
      v_n := v_n + 1;
    exception when others then null;
    end;
  end loop;
  v_r := 'OK';
  begin
    insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la, created_by, updated_by)
    values (v_org, v_s2, 10, 70, pg_temp.la(v_zi - 12, '19 hours'), v_u_a, v_u_a);
  exception when others then
    v_r := sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  if v_n = 20 and v_r like 'P0001%cel mult 20 de alimentări%' then
    raise notice '  ✓ (3) 20 de alimentări intră, a 21-a e refuzată (P0001)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) % din 20 alimentări intrate; a 21-a: %', v_n, v_r;
  end if;

  -- ═══ (4) plafonul șabloanelor de traseu ═══════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  v_n := 0;
  for i in 1 .. 100 loop
    begin
      insert into public.trip_route_templates (organization_id, denumire, de_la_loc, pana_la_loc, scop, created_by, updated_by)
      values (v_org, 'Traseu ' || i, 'Sediu', 'Client', 'Livrare', v_u_adm, v_u_adm);
      v_n := v_n + 1;
    exception when others then null;
    end;
  end loop;
  v_r := 'OK';
  begin
    insert into public.trip_route_templates (organization_id, denumire, de_la_loc, pana_la_loc, scop, created_by, updated_by)
    values (v_org, 'Traseu 101', 'Sediu', 'Client', 'Livrare', v_u_adm, v_u_adm);
  exception when others then
    v_r := sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  if v_n = 100 and v_r like 'P0001%100 de șabloane de traseu%' then
    raise notice '  ✓ (4) 100 de șabloane intră, al 101-lea e refuzat (P0001)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) % din 100 șabloane intrate; al 101-lea: %', v_n, v_r;
  end if;

  -- ═══ (5)–(7) numărul și registrul ═════════════════════════════════════════
  -- N1: întocmită, trimisă (primește numărul), retrasă în ciornă
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  v_n1 := pg_temp.foaie(v_org, v_p[4], v_e_a, v_u_a, pg_temp.la(v_zi - 13, '8 hours'), 1000);
  v_r := pg_temp.cursa(v_org, v_n1, v_u_a, pg_temp.la(v_zi - 13, '8 hours'), pg_temp.la(v_zi - 13, '9 hours'), 1000);
  v_r := pg_temp.stare(v_n1, v_u_a, 'trimis');
  v_r := pg_temp.stare(v_n1, v_u_a, 'draft');
  reset role;
  select numar into v_numar1 from public.trip_sheets where id = v_n1;

  -- (5) scriitorul n-o șterge
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  v_r := pg_temp.sterge(v_n1, v_u_a);
  reset role;
  if v_numar1 is not null
     and v_r like 'P0001 Foaia are deja numărul ' || v_numar1 || '; o poate anula doar administratorul flotei.'
     and (select deleted_at is null from public.trip_sheets where id = v_n1) then
    raise notice '  ✓ (5) scriitorul nu șterge foaia numerotată % (P0001); rămâne activă', v_numar1;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) numărul %, ștergerea de către scriitor: %', v_numar1, v_r;
  end if;

  -- (5) administratorul o anulează; registrul o arată anulată, cu motivul
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  v_r := pg_temp.sterge(v_n1, v_u_adm);
  reset role;
  select r.anulat_la, r.motiv_anulare into v_anulat, v_motiv
    from public.registru_documente r
   where r.entitate_tip = 'trip_sheets' and r.entitate_id = v_n1;
  if v_r = 'OK' and v_anulat is not null and v_motiv like '%' || v_numar1 || '%'
     and (select count(*) from public.registru_documente where entitate_tip = 'trip_sheets' and entitate_id = v_n1) = 1 then
    raise notice '  ✓ (5) administratorul anulează foaia; registrul păstrează rândul, anulat: „%”', v_motiv;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) anularea de către administrator: %; registru anulat_la=%, motiv=%', v_r, v_anulat, v_motiv;
  end if;

  -- (6) numărul anulat nu se refolosește; (7) retrimiterea îl păstrează, fără rând nou în registru
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  v_n2 := pg_temp.foaie(v_org, v_p[5], v_e_a, v_u_a, pg_temp.la(v_zi - 14, '8 hours'), 1000);
  v_r := pg_temp.cursa(v_org, v_n2, v_u_a, pg_temp.la(v_zi - 14, '8 hours'), pg_temp.la(v_zi - 14, '9 hours'), 1000);
  v_r := pg_temp.stare(v_n2, v_u_a, 'trimis');
  reset role;
  select numar into v_numar2 from public.trip_sheets where id = v_n2;
  if v_numar2 is not null and v_numar2 <> v_numar1
     and substr(v_numar2, 9)::integer = substr(v_numar1, 9)::integer + 1 then
    raise notice '  ✓ (6) numărul anulat % nu se refolosește; următoarea foaie primește %', v_numar1, v_numar2;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) după % foaia următoare are %', v_numar1, v_numar2;
  end if;

  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  v_r := pg_temp.stare(v_n2, v_u_a, 'draft');
  v_r := pg_temp.stare(v_n2, v_u_a, 'trimis');
  reset role;
  select count(*) into v_n from public.registru_documente where entitate_tip = 'trip_sheets' and entitate_id = v_n2;
  if (select numar from public.trip_sheets where id = v_n2) = v_numar2 and v_n = 1 then
    raise notice '  ✓ (7) retragerea și retrimiterea păstrează numărul %; un singur rând în registru', v_numar2;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) după retrimitere numărul e %, rânduri în registru: %',
      (select numar from public.trip_sheets where id = v_n2), v_n;
  end if;

  -- (8) o trimitere eșuată mai târziu în aceeași tranzacție nu consumă număr
  select s.next_number into v_urm from public.document_sequences s
   where s.organization_id = v_org and s.document_type = 'foaie_parcurs'
     and s.year = extract(year from v_zi - 15)::integer;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  v_n3 := pg_temp.foaie(v_org, v_p[6], v_e_a, v_u_a, pg_temp.la(v_zi - 15, '8 hours'), 1000);
  v_r := pg_temp.cursa(v_org, v_n3, v_u_a, pg_temp.la(v_zi - 15, '8 hours'), pg_temp.la(v_zi - 15, '9 hours'), 1000);
  begin
    update public.trip_sheets set status = 'trimis', updated_by = v_u_a where id = v_n3;
    raise exception using errcode = 'P0001', message = 'eșec simulat după alocare';
  exception when others then
    null;
  end;
  reset role;
  select s.next_number into v_urm2 from public.document_sequences s
   where s.organization_id = v_org and s.document_type = 'foaie_parcurs'
     and s.year = extract(year from v_zi - 15)::integer;
  if v_urm2 is not distinct from v_urm
     and (select numar is null and status = 'draft' from public.trip_sheets where id = v_n3) then
    raise notice '  ✓ (8) trimiterea anulată după alocare nu lasă gol: contorul a rămas la %', v_urm2;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) contorul a mers de la % la % după o trimitere anulată', v_urm, v_urm2;
  end if;

  -- (9) administratorul aprobă, apoi stornează N2: rândul din registru se anulează
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  v_r := pg_temp.stare(v_n2, v_u_adm, 'aprobat');
  v_r := v_r || ' / ' || pg_temp.sterge(v_n2, v_u_adm);
  reset role;
  select r.anulat_la, r.motiv_anulare into v_anulat, v_motiv
    from public.registru_documente r where r.entitate_tip = 'trip_sheets' and r.entitate_id = v_n2;
  if v_r = 'OK / OK' and v_anulat is not null and v_motiv like '%' || v_numar2 || '%' then
    raise notice '  ✓ (9) foaia aprobată stornată: registrul o arată anulată („%”)', v_motiv;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) stornarea: %; registru anulat_la=%, motiv=%', v_r, v_anulat, v_motiv;
  end if;

  -- (10) ciorna fără număr o șterge scriitorul
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  v_r := pg_temp.sterge(v_n3, v_u_a);
  reset role;
  if v_r = 'OK' and (select deleted_at is not null from public.trip_sheets where id = v_n3) then
    raise notice '  ✓ (10) ciorna fără număr se șterge de scriitor';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10) ciorna fără număr: %', v_r;
  end if;

  -- ═══ (11)–(14) suprapunerile ══════════════════════════════════════════════
  -- (11) SA: ciornă rătăcită (08:00–17:00) pe p7; SB: ziua reală (09:00–12:00) pe p8
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  v_sa := pg_temp.foaie(v_org, v_p[7], v_e_a, v_u_a, pg_temp.la(v_zi - 16, '8 hours'), 1000);
  v_r  := pg_temp.cursa(v_org, v_sa, v_u_a, pg_temp.la(v_zi - 16, '8 hours'), pg_temp.la(v_zi - 16, '17 hours'), 1000);
  v_sb := pg_temp.foaie(v_org, v_p[8], v_e_a, v_u_a, pg_temp.la(v_zi - 16, '9 hours'), 1000);
  v_r  := pg_temp.cursa(v_org, v_sb, v_u_a, pg_temp.la(v_zi - 16, '9 hours'), pg_temp.la(v_zi - 16, '12 hours'), 1000);
  reset role;
  if v_r = 'OK' then
    raise notice '  ✓ (11) cursa reală 09:00–12:00 intră peste ciorna rătăcită 08:00–17:00 (ciorna nu e declarație)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (11) ciorna rătăcită blochează ziua reală: %', v_r;
  end if;

  -- (12) SB se trimite; SA, suprapusă peste ea, e oprită la trimitere, cu numărul lui SB
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  v_r := pg_temp.stare(v_sb, v_u_a, 'trimis');
  reset role;
  select numar into v_numar_b from public.trip_sheets where id = v_sb;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  v_r := pg_temp.stare(v_sa, v_u_a, 'trimis');
  reset role;
  if v_numar_b is not null and v_r like 'P0001 Foaia nu se poate trimite:%' || v_numar_b || ' (trimisă)%'
     and (select status = 'draft' from public.trip_sheets where id = v_sa) then
    raise notice '  ✓ (12) trimiterea foii suprapuse e oprită, cu numărul % în mesaj', v_numar_b;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (12) numărul foii trimise: %; trimiterea suprapusei: %', v_numar_b, v_r;
  end if;

  -- (13) o cursă nouă peste foaia TRIMISĂ e refuzată pe loc
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  v_sc := pg_temp.foaie(v_org, v_p[9], v_e_a, v_u_a, pg_temp.la(v_zi - 16, '10 hours'), 1000);
  v_r  := pg_temp.cursa(v_org, v_sc, v_u_a, pg_temp.la(v_zi - 16, '10 hours'), pg_temp.la(v_zi - 16, '11 hours'), 1000);
  reset role;
  if v_r like 'P0001 Ora de plecare a cursei se suprapune cu o cursă a aceluiași șofer de pe foaia %' || v_numar_b || ' (trimisă)%' then
    raise notice '  ✓ (13) cursa scrisă peste o foaie trimisă e refuzată pe loc, cu foaia numită';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (13) cursa peste foaia trimisă: %', v_r;
  end if;

  -- (14) ocolirea prin respins → ciornă: A (p10) trimisă și respinsă; C (p11) pe același timp
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  v_a := pg_temp.foaie(v_org, v_p[10], v_e_a, v_u_a, pg_temp.la(v_zi - 17, '8 hours'), 1000);
  v_r := pg_temp.cursa(v_org, v_a, v_u_a, pg_temp.la(v_zi - 17, '8 hours'), pg_temp.la(v_zi - 17, '10 hours'), 1000);
  v_r := pg_temp.stare(v_a, v_u_a, 'trimis');
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  v_r := pg_temp.stare(v_a, v_u_adm, 'respins', 'Test');
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  v_c := pg_temp.foaie(v_org, v_p[11], v_e_a, v_u_a, pg_temp.la(v_zi - 17, '8 hours 30 minutes'), 1000);
  v_r := pg_temp.cursa(v_org, v_c, v_u_a, pg_temp.la(v_zi - 17, '8 hours 30 minutes'), pg_temp.la(v_zi - 17, '9 hours 30 minutes'), 1000);
  v_r := v_r || ' / ' || pg_temp.stare(v_c, v_u_a, 'trimis');
  reset role;
  if v_r = 'OK / OK' then
    perform set_config('request.jwt.claim.sub', v_u_a::text, true);
    set local role authenticated;
    v_r := pg_temp.stare(v_a, v_u_a, 'draft') || ' / ' || pg_temp.stare(v_a, v_u_a, 'trimis');
    reset role;
    if v_r like 'OK / P0001 Foaia nu se poate trimite:%' and (select status = 'draft' from public.trip_sheets where id = v_a) then
      raise notice '  ✓ (14) foaia respinsă, redeschisă, nu se mai trimite peste cea trimisă între timp';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (14) ocolirea prin respins → ciornă: %', v_r;
    end if;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (14) pregătirea (C peste respinsă): %', v_r;
  end if;

  -- ═══ (16)–(17) identitatea foii numerotate ════════════════════════════════
  -- N4 (p12): trimisă (primește număr), retrasă, golită de curse.
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  v_n4 := pg_temp.foaie(v_org, v_p[12], v_e_a, v_u_a, pg_temp.la(v_zi - 18, '8 hours'), 1000);
  insert into public.trip_sheet_curse (organization_id, trip_sheet_id, plecare_la, sosire_la,
                                       de_la_loc, pana_la_loc, scop, km_plecare, km_sosire, created_by, updated_by)
  values (v_org, v_n4, pg_temp.la(v_zi - 18, '8 hours'), pg_temp.la(v_zi - 18, '9 hours'),
          'Sediu', 'Client', 'Livrare', 1000, 1001, v_u_a, v_u_a)
  returning id into v_c4;
  v_r := pg_temp.stare(v_n4, v_u_a, 'trimis') || ' / ' || pg_temp.stare(v_n4, v_u_a, 'draft');
  update public.trip_sheet_curse set deleted_at = now(), updated_by = v_u_a where id = v_c4;
  reset role;
  select numar into v_numar4 from public.trip_sheets where id = v_n4;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets
       set plecare_la = pg_temp.la(v_zi - 19, '8 hours'), sosire_la = null, km_sosire = null, updated_by = v_u_a
     where id = v_n4;
    v_r := v_r || ' / ziua: OK';
  exception when others then
    v_r := v_r || ' / ziua: ' || sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  if v_numar4 is not null
     and v_r like 'OK / OK / ziua: P0001 Foaia are deja numărul ' || v_numar4 || ': vehiculul, șoferul și ziua ei nu se mai schimbă.%'
     and (select data from public.trip_sheets where id = v_n4) = v_zi - 18 then
    raise notice '  ✓ (16) foaia numerotată % nu-și mută ziua (P0001)', v_numar4;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (16) mutarea zilei foii numerotate %: %', v_numar4, v_r;
  end if;

  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set vehicle_id = v_p[6], updated_by = v_u_a where id = v_n4;
    v_r := 'OK';
  exception when others then
    v_r := sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  if v_r like 'P0001 Foaia are deja numărul ' || v_numar4 || ':%'
     and (select vehicle_id from public.trip_sheets where id = v_n4) = v_p[12] then
    raise notice '  ✓ (16) foaia numerotată % nu trece pe alt vehicul (P0001)', v_numar4;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (16) mutarea foii numerotate pe alt vehicul: %', v_r;
  end if;

  -- (17) N5 (p12, altă zi): ciornă fără număr și fără curse, își mută ziua
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  v_n5 := pg_temp.foaie(v_org, v_p[12], v_e_a, v_u_a, pg_temp.la(v_zi - 20, '8 hours'), 1000);
  begin
    update public.trip_sheets set plecare_la = pg_temp.la(v_zi - 21, '8 hours'), updated_by = v_u_a where id = v_n5;
    v_r := 'OK';
  exception when others then
    v_r := sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  if v_r = 'OK' and (select data from public.trip_sheets where id = v_n5) = v_zi - 21 then
    raise notice '  ✓ (17) ciorna fără număr își mută ziua';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (17) ciorna fără număr: %', v_r;
  end if;

  -- ═══ (18) contorul dat înapoi nu redă numărul unei foi anulate ════════════
  -- `document_sequences_update` (0002) îl lasă pe `org_admin` să rescrie
  -- contorul. N1 (anulată la (5)) își păstrează numărul, dar e ștearsă logic.
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  update public.document_sequences set next_number = 1
   where organization_id = v_org and document_type = 'foaie_parcurs';
  get diagnostics v_n = row_count;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  v_n6 := pg_temp.foaie(v_org, v_p[1], v_e_a, v_u_a, pg_temp.la(v_zi - 22, '8 hours'), 1000);
  v_r := pg_temp.cursa(v_org, v_n6, v_u_a, pg_temp.la(v_zi - 22, '8 hours'), pg_temp.la(v_zi - 22, '9 hours'), 1000);
  v_r := v_r || ' / ' || pg_temp.stare(v_n6, v_u_a, 'trimis');
  reset role;
  select numar into v_numar6 from public.trip_sheets where id = v_n6;
  if v_n = 1 and v_r = 'OK / OK' and v_numar6 is not null and v_numar6 <> v_numar1
     and (select count(*) from public.trip_sheets where organization_id = v_org and numar = v_numar6) = 1 then
    raise notice '  ✓ (18) contorul dat înapoi la 1: foaia nouă primește %, nu numărul anulat %', v_numar6, v_numar1;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (18) contor dat înapoi (% rând): %, foaia nouă are % (anulată: %), foi cu numărul ăsta: %',
      v_n, v_r, v_numar6, v_numar1,
      (select count(*) from public.trip_sheets where organization_id = v_org and numar = v_numar6);
  end if;

  -- ═══ (19) colegul care știe id-ul foii nu află nimic din refuz ═══════════
  -- SC: ciorna lui A, fără curse, în ziua în care A are SB TRIMISĂ (09–12).
  select count(*) into v_curse0 from public.trip_sheet_curse
   where trip_sheet_id in (v_sc, v_sb) and deleted_at is null;
  perform set_config('request.jwt.claim.sub', v_u_b::text, true);
  set local role authenticated;
  v_r  := pg_temp.cursa(v_org, v_sc, v_u_b, pg_temp.la(v_zi - 16, '10 hours'), pg_temp.la(v_zi - 16, '11 hours'), 1000);
  v_r2 := pg_temp.cursa(v_org, v_sc, v_u_b, pg_temp.la(v_zi - 16, '15 hours'), pg_temp.la(v_zi - 16, '16 hours'), 1000);
  v_r3 := pg_temp.cursa(v_org, v_sc, v_u_b, pg_temp.la(v_zi - 30, '10 hours'), pg_temp.la(v_zi - 30, '11 hours'), 1000);
  v_r4 := pg_temp.cursa(v_org, v_sb, v_u_b, pg_temp.la(v_zi - 16, '18 hours'), pg_temp.la(v_zi - 16, '19 hours'), 2000);
  reset role;
  if v_r like '42501 %' and v_r2 like '42501 %' and v_r3 like '42501 %' and v_r4 like '42501 %'
     and (select count(*) from public.trip_sheet_curse
           where trip_sheet_id in (v_sc, v_sb) and deleted_at is null) = v_curse0 then
    raise notice '  ✓ (19) colegul: cursa peste foaia trimisă, cea liberă, cea din altă zi și cea de pe foaia trimisă dau toate 42501';
  else
    v_esecuri := v_esecuri + 1;
    raise warning E'  ✗ (19) colegul, pe cursele foii lui A:\n    peste foaia trimisă: %\n    liberă: %\n    altă zi: %\n    pe foaia trimisă: %',
      v_r, v_r2, v_r3, v_r4;
  end if;

  select count(*) into v_alim0 from public.fuel_entries
   where trip_sheet_id in (v_sa, v_sb) and deleted_at is null;
  perform set_config('request.jwt.claim.sub', v_u_b::text, true);
  set local role authenticated;
  v_r  := pg_temp.alim(v_org, v_sa, v_u_b, pg_temp.la(v_zi - 16, '7 hours'));
  v_r2 := pg_temp.alim(v_org, v_sa, v_u_b, pg_temp.la(v_zi - 16, '9 hours'));
  v_r3 := pg_temp.alim(v_org, v_sb, v_u_b, pg_temp.la(v_zi - 16, '10 hours'));
  reset role;
  if v_r like '42501 %' and v_r2 like '42501 %' and v_r3 like '42501 %'
     and (select count(*) from public.fuel_entries
           where trip_sheet_id in (v_sa, v_sb) and deleted_at is null) = v_alim0 then
    raise notice '  ✓ (19) colegul: alimentarea în afara foii, cea din interval și cea de pe foaia trimisă dau toate 42501';
  else
    v_esecuri := v_esecuri + 1;
    raise warning E'  ✗ (19) colegul, pe alimentările foii lui A:\n    în afara foii: %\n    în interval: %\n    pe foaia trimisă: %',
      v_r, v_r2, v_r3;
  end if;

  -- ═══ (20) utilizatorul din ALTĂ firmă, cu `organization_id`-ul lui A ══════
  perform set_config('request.jwt.claim.sub', v_u_x::text, true);
  set local role authenticated;
  v_r  := pg_temp.cursa(v_org, v_sc, v_u_x, pg_temp.la(v_zi - 16, '10 hours'), pg_temp.la(v_zi - 16, '11 hours'), 1000);
  v_r2 := pg_temp.alim(v_org, v_sb, v_u_x, pg_temp.la(v_zi - 16, '10 hours'));
  reset role;
  if v_r like '42501 %' and v_r2 like '42501 %' then
    raise notice '  ✓ (20) străinul de firmă primește 42501 pe cursă și pe alimentare, fără nimic din foaie';
  else
    v_esecuri := v_esecuri + 1;
    raise warning E'  ✗ (20) străinul de firmă:\n    cursa: %\n    alimentarea: %', v_r, v_r2;
  end if;

  -- ═══ (21) cine scrie orice foaie (update = all) scrie în continuare ══════
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  v_r  := pg_temp.cursa(v_org, v_n5, v_u_adm, pg_temp.la(v_zi - 21, '8 hours'), pg_temp.la(v_zi - 21, '9 hours'), 1000);
  v_r2 := pg_temp.alim(v_org, v_n5, v_u_adm, pg_temp.la(v_zi - 21, '8 hours 30 minutes'));
  reset role;
  if v_r = 'OK' and v_r2 = 'OK'
     and (select count(*) from public.trip_sheet_curse where trip_sheet_id = v_n5 and deleted_at is null) = 1
     and (select count(*) from public.fuel_entries where trip_sheet_id = v_n5 and deleted_at is null) = 1 then
    raise notice '  ✓ (21) org_admin scrie o cursă și o alimentare pe ciorna șoferului (1 + 1 rânduri)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (21) org_admin pe ciorna șoferului: cursa %, alimentarea %', v_r, v_r2;
  end if;

  -- ═══ (15) indexul de suprapunere ══════════════════════════════════════════
  -- Pe tabele mici planificatorul alege oricum scanarea secvențială; cu ea oprită
  -- se vede dacă forma interogării SE POATE sprijini pe index. Același predicat pe
  -- foaie ca în `internal.curse_inainte` și `internal.foi_parcurs_inainte`.
  set local enable_seqscan = off;
  v_plan := '';
  for v_linie in execute format(
    'explain select 1 from public.trip_sheets t where t.employee_id = %L and t.organization_id = %L '
    || 'and t.deleted_at is null and t.status in (''trimis'', ''aprobat'') '
    || 'and pg_catalog.tstzrange(t.plecare_la, coalesce(t.sosire_la, ''infinity''::timestamptz), ''[)'') '
    || 'operator(pg_catalog.&&) pg_catalog.tstzrange(%L::timestamptz, %L::timestamptz)',
    v_e_a, v_org, pg_temp.la(v_zi - 16, '9 hours'), pg_temp.la(v_zi - 16, '12 hours'))
  loop
    v_plan := v_plan || v_linie || E'\n';
  end loop;
  reset enable_seqscan;
  if v_plan like '%ts_sofer_interval_gist%' then
    raise notice '  ✓ (15) interogarea de suprapunere se poate sprijini pe ts_sofer_interval_gist';
  else
    v_esecuri := v_esecuri + 1;
    raise warning E'  ✗ (15) planul nu folosește ts_sofer_interval_gist:\n%', v_plan;
  end if;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA FLOTA PLAFOANE: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE cele 26 de verificări au trecut.';
  raise notice '';
end;
$$;
