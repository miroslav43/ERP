-- tests/rls/proba-flota-iesire.sql
--
-- FLOTA, DUPĂ 0218 (F12h): IEȘIREA DIN PARC, PE TOATE CELE CINCI ROLURI.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- Pozitive
-- (1)  org_admin vinde un vehicul cu alocare deschisă și RCA curent, cumpărat
--      în anul anterior: status `vandut`, data ieșirii, alocarea închisă la
--      sfârșitul zilei ieșirii cu `km_restituire = km_iesire`, documentele ies
--      din semafor, termenele EXACT {impozit_local_instrainare (+30),
--      rca_notificare (+5), verificare_transcriere (+90)}, 3 rânduri active în
--      `expirables`;
-- (2)  cumpărat în același an: apare și `impozit_plata_an_dobandire`;
-- (3)  casarea: radierea și plăcuțele la D+30, impozitul de radiere fără termen
--      și fără rând în `expirables`; bifarea radierii îi dă termenul R+30;
-- (4)  bifarea unui termen: rândul din `expirables` e șters logic, alerta
--      deschisă trece `rezolvat`;
-- (6)  radiere pentru furt: fără plăcuțe și fără CASCO (număr exact);
-- (13) anularea: vehiculul revine `activ`, fără dată și motiv de ieșire,
--      documentele revin în semafor, zero termene de ieșire vii;
-- (14) numărul vehiculului vândut se poate pune pe un vehicul nou (I-h2);
-- (15) backfill-ul: ieșire `preluata_din_istoric`, zero termene;
-- (16) org_admin vede termenele în `expirables`; garda din 0218 §13 a trecut;
-- (17) ștergerea logică a vehiculului ieșit scoate termenele din `expirables`;
-- (18) planul de service iese din semafor, amenda rămâne activă;
-- (19f) un UPDATE de serviciu pe termenul unei ieșiri anulate NU șterge rândul
--      ieșirii vii cu același cod;
-- (20) rezumatul zilnic trimite termenele de ieșire administratorului, nu
--      responsabilului cu `vehicles:read = team` (I-h6);
-- (21) restituirea la locator: declarația de leasing; `anulat_de` din payload
--      e ignorat la INSERT și la UPDATE;
-- (22) super_admin vede ieșirile (platformă) și nu le scrie (42501).
-- Negative
-- (5)  redeschiderea radierii după ce impozitul de radiere e făcut: P0001;
-- (7)  `status` scris direct pe vânzare sau pe revenire: P0001;
-- (8)  a doua ieșire pe un vehicul ieșit: P0001;
-- (9)  data în viitor, înaintea achiziției, înaintea unei foi; km sub ultimul: P0001;
-- (10) vehiculul altei firme: P0001; firma altcuiva în rând: 42501;
-- (11) manager, hr, employee: INSERT 42501; SELECT 0 rânduri pe ambele tabele;
--      UPDATE pe un termen 0 rânduri; org_admin-ul altei firme la fel;
-- (12) INSERT direct în termene: 42501; UPDATE pe `termen`/`cod`: P0001; data
--      bifării în viitor sau înaintea ieșirii: P0001;
-- (19) km sub predarea șoferului actual; ștergerea logică a unei ieșiri vii;
--      orice UPDATE pe o ieșire anulată; anularea pe vehicul șters; „Nu se
--      aplică” pe radiere cu dependenți deschiși: toate P0001.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   CLAUDE_PROJECT_DIR=<worktree> bash .claude/skills/administrativo/scripts/banc-migrare.sh --pastreaza
--   psql … -f tests/rls/proba-flota-iesire.sql
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

-- INSERT-ul unei ieșiri, ca text, pentru `pg_temp.ruleaza`.
create function pg_temp.iesire(
  p_org uuid, p_veh uuid, p_user uuid, p_tip text, p_data date,
  p_km integer default null, p_epava text default null, p_radiere text default null,
  p_pastreaza boolean default false, p_cumparator text default null
) returns text
language sql immutable as $$
  select format(
    'insert into public.vehicle_exits (organization_id, vehicle_id, tip, destinatie_epava, motiv_radiere, '
    || 'data_iesire, km_iesire, motiv, cumparator, pastreaza_numarul, created_by, updated_by) '
    || 'values (%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L)',
    p_org, p_veh, p_tip, p_epava, p_radiere, p_data, p_km, 'Ieșire de probă', p_cumparator,
    p_pastreaza, p_user, p_user);
$$;

-- Termenele unei ieșiri, ca text: `cod=termen` în ordinea codului.
create function pg_temp.termene(p_veh uuid) returns text
language sql stable as $$
  select coalesce(string_agg(o.cod || '=' || coalesce(o.termen::text, 'null'), ' '
                             order by o.cod collate "C"), '')
    from public.vehicle_exit_obligations o
    join public.vehicle_exits e on e.id = o.exit_id
   where o.vehicle_id = p_veh and e.anulat_la is null and o.deleted_at is null;
$$;

create function pg_temp.iesirea(p_veh uuid) returns uuid
language sql stable as $$
  select e.id from public.vehicle_exits e
   where e.vehicle_id = p_veh and e.anulat_la is null and e.deleted_at is null;
$$;

create function pg_temp.termenul(p_veh uuid, p_cod text) returns uuid
language sql stable as $$
  select o.id from public.vehicle_exit_obligations o
    join public.vehicle_exits e on e.id = o.exit_id
   where o.vehicle_id = p_veh and o.cod = p_cod and e.anulat_la is null and o.deleted_at is null;
$$;

do $$
declare
  v_sufix    text := upper(left(replace(gen_random_uuid()::text, '-', ''), 8));
  v_zi       date := app.azi_local();
  v_org      uuid := gen_random_uuid();
  v_org_alta uuid := gen_random_uuid();
  v_u_admin  uuid := gen_random_uuid();
  v_u_hr     uuid := gen_random_uuid();
  v_u_mgr    uuid := gen_random_uuid();
  v_u_ang    uuid := gen_random_uuid();
  v_u_alta   uuid := gen_random_uuid();
  v_u_sa     uuid := gen_random_uuid();
  v_e_mgr    uuid := gen_random_uuid();
  v_e_ang    uuid := gen_random_uuid();
  v_v1       uuid := gen_random_uuid();
  v_v2       uuid := gen_random_uuid();
  v_v3       uuid := gen_random_uuid();
  v_v4       uuid := gen_random_uuid();
  v_v5       uuid := gen_random_uuid();
  v_v6       uuid := gen_random_uuid();
  v_v7       uuid := gen_random_uuid();
  v_v8       uuid := gen_random_uuid();
  v_v9       uuid := gen_random_uuid();
  v_v10      uuid := gen_random_uuid();
  v_v11      uuid := gen_random_uuid();
  v_v12      uuid := gen_random_uuid();
  v_v13      uuid := gen_random_uuid();
  v_vb       uuid := gen_random_uuid();
  v_t_rca    uuid;
  v_t_casco  uuid;
  v_aloc1    uuid;
  v_amenda   uuid;
  v_iesire   uuid;
  v_iesire_a uuid;
  v_termen   uuid;
  v_r        text;
  v_r2       text;
  v_t        text;
  v_n        bigint;
  v_m        bigint;
  v_k        bigint;
  v_rand     record;
  v_esecuri  int := 0;
begin
  raise notice '';
  raise notice '  PROBA „FLOTA — IEȘIREA DIN PARC" (0218)';
  raise notice '  ─────────────────────────────────────────────────────────';

  -- ═══ Fixture, ca superuser ════════════════════════════════════════════════
  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-iesire-' || lower(v_sufix), 'Proba Ieșire SRL',
     'RO' || (88000000 + (random() * 900000)::int)::text),
    (v_org_alta, 'proba-iesire-alta-' || lower(v_sufix), 'Altă Firmă SRL',
     'RO' || (89000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select o, f.feature_key, true, now() from public.features f, unnest(array[v_org, v_org_alta]) o;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_admin, 'ie-adm-'  || lower(v_sufix) || '@proba.test', now()),
    (v_u_hr,    'ie-hr-'   || lower(v_sufix) || '@proba.test', now()),
    (v_u_mgr,   'ie-mgr-'  || lower(v_sufix) || '@proba.test', now()),
    (v_u_ang,   'ie-ang-'  || lower(v_sufix) || '@proba.test', now()),
    (v_u_alta,  'ie-alta-' || lower(v_sufix) || '@proba.test', now()),
    (v_u_sa,    'ie-sa-'   || lower(v_sufix) || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_admin, 'org_admin'),
    (v_org, v_u_hr,    'hr'),
    (v_org, v_u_mgr,   'manager'),
    (v_org, v_u_ang,   'employee'),
    (v_org_alta, v_u_alta, 'org_admin');
  insert into public.platform_admins (user_id) values (v_u_sa);

  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_mgr, v_org, 'IE-M', 'Mihai', 'Manager', v_zi - 900, 'activ', v_u_mgr, null);
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_ang, v_org, 'IE-A', 'Ana', 'Șofer', v_zi - 800, 'activ', v_u_ang, v_e_mgr);

  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent,
                               data_achizitie, pool, created_by, updated_by) values
    -- (1): cumpărat în anul ANTERIOR anului ieșirii (altfel apare și plata pe anul dobândirii).
    (v_v1,  v_org, 'IE1' || v_sufix, 'Dacia', 'Logan', 10000,
     make_date(extract(year from v_zi - 3)::int - 1, 6, 1), false, v_u_admin, v_u_admin),
    (v_v2,  v_org, 'IE2' || v_sufix, 'Dacia', 'Logan', 5000,
     make_date(extract(year from v_zi - 3)::int, 1, 1), false, v_u_admin, v_u_admin),
    (v_v3,  v_org, 'IE3' || v_sufix, 'Ford', 'Focus', 150000, v_zi - 3000, false, v_u_admin, v_u_admin),
    (v_v4,  v_org, 'IE4' || v_sufix, 'Skoda', 'Octavia', 80000, v_zi - 1000, false, v_u_admin, v_u_admin),
    (v_v5,  v_org, 'IE5' || v_sufix, 'Dacia', 'Duster', 10000, v_zi - 100, false, v_u_admin, v_u_admin),
    (v_v6,  v_org, 'IE6' || v_sufix, 'Dacia', 'Sandero', 20000, null, false, v_u_admin, v_u_admin),
    (v_v8,  v_org, 'IE8' || v_sufix, 'Renault', 'Clio', 30000, null, false, v_u_admin, v_u_admin),
    (v_v9,  v_org, 'IE9' || v_sufix, 'Renault', 'Megane', 40000, null, false, v_u_admin, v_u_admin),
    (v_v10, v_org, 'IEP' || v_sufix, 'Dacia', 'Jogger', 1000, null, true, v_u_admin, v_u_admin),
    (v_v11, v_org, 'IED' || v_sufix, 'VW', 'Golf', 60000, null, false, v_u_admin, v_u_admin),
    (v_v12, v_org, 'IEK' || v_sufix, 'VW', 'Polo', 1000, null, false, v_u_admin, v_u_admin),
    (v_v13, v_org, 'IEL' || v_sufix, 'BMW', 'X1', 7000, null, false, v_u_admin, v_u_admin),
    (v_vb,  v_org_alta, 'IEB' || v_sufix, 'Dacia', 'Logan', 100, null, false, v_u_alta, v_u_alta);

  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, km_predare,
                                          created_by, updated_by)
  values (v_org, v_v1, v_e_ang, now() - interval '10 days', 9500, v_u_admin, v_u_admin)
  returning id into v_aloc1;
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, km_predare,
                                          created_by, updated_by) values
    (v_org, v_v5, v_e_ang, now() - interval '10 days', 10000, v_u_admin, v_u_admin),
    -- (19a): km_predare peste km_curent (0173 nu le leagă).
    (v_org, v_v12, v_e_ang, now() - interval '10 days', 5000, v_u_admin, v_u_admin);

  select id into v_t_rca from public.vehicle_document_types
   where cod = 'rca' and organization_id is null and deleted_at is null;
  select id into v_t_casco from public.vehicle_document_types
   where cod = 'casco' and organization_id is null and deleted_at is null;
  insert into public.vehicle_documents (organization_id, vehicle_id, document_type_id, valabil_de_la, expira_la,
                                        created_by, updated_by) values
    (v_org, v_v1, v_t_rca,   v_zi - 165, v_zi + 200, v_u_admin, v_u_admin),
    (v_org, v_v3, v_t_rca,   v_zi - 165, v_zi + 200, v_u_admin, v_u_admin),
    (v_org, v_v3, v_t_casco, v_zi - 165, v_zi + 200, v_u_admin, v_u_admin),
    (v_org, v_v4, v_t_rca,   v_zi - 165, v_zi + 200, v_u_admin, v_u_admin),
    (v_org, v_v4, v_t_casco, v_zi - 165, v_zi + 200, v_u_admin, v_u_admin),
    (v_org, v_v6, v_t_rca,   v_zi - 165, v_zi + 200, v_u_admin, v_u_admin);

  -- (18): planul de service și amenda vehiculului vândut în (1).
  insert into public.vehicle_service_plans (organization_id, vehicle_id, denumire, interval_luni, baza_data,
                                            baza_km, created_by, updated_by)
  values (v_org, v_v1, 'Revizie anuală', 12, v_zi - 30, 9000, v_u_admin, v_u_admin);
  insert into public.vehicle_fines (organization_id, vehicle_id, numar_pv, constatata_la, fapta, termen_raspuns,
                                    created_by, updated_by)
  values (v_org, v_v1, 'PV-IE-' || v_sufix, now() - interval '20 days', 'Depășirea vitezei legale',
          v_zi + 10, v_u_admin, v_u_admin)
  returning id into v_amenda;

  -- (9c): o foaie de ieri pe vehiculul gărzilor.
  insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, km_plecare,
                                  created_by, updated_by)
  values (v_org, v_v5, v_e_ang, ((v_zi - 1)::timestamp + interval '08:00') at time zone 'Europe/Bucharest',
          10000, v_u_ang, v_u_ang);

  -- ═══ (1) vânzarea, pe drumul complet ══════════════════════════════════════
  select count(*) into v_n from public.expirables
   where entity_type = 'vehicle_service' and entity_id = v_v1 and is_active and deleted_at is null;
  v_r := pg_temp.ruleaza(v_u_admin, pg_temp.iesire(v_org, v_v1, v_u_admin, 'vanzare', v_zi - 3, 10500,
                                                   p_cumparator => 'Ion Popescu'));
  select * into v_rand from public.vehicles where id = v_v1;
  v_esecuri := v_esecuri + pg_temp.verifica('1a',
    v_r = 'ok:1' and v_rand.status = 'vandut' and v_rand.data_iesire = v_zi - 3
      and v_rand.motiv_iesire = 'Ieșire de probă' and v_rand.employee_id is null,
    'vânzarea trece vehiculul în vândut, cu data și motivul ieșirii, fără șofer',
    format('%s / %s / %s / %s', v_r, v_rand.status, v_rand.data_iesire, v_rand.employee_id));
  select * into v_rand from public.vehicle_assignments where id = v_aloc1;
  v_esecuri := v_esecuri + pg_temp.verifica('1b',
    v_rand.pana_la is not null
      and v_rand.pana_la <= ((v_zi - 3 + 1)::timestamp at time zone 'Europe/Bucharest')
      and v_rand.km_restituire = 10500,
    'alocarea se închide la sfârșitul zilei ieșirii, cu km_restituire = km_iesire',
    format('pana_la %s, km %s', v_rand.pana_la, v_rand.km_restituire));
  select count(*) filter (where is_active), count(*) into v_m, v_k from public.expirables
   where entity_type = 'vehicle_document' and entity_id = v_v1 and deleted_at is null;
  v_esecuri := v_esecuri + pg_temp.verifica('1c', v_m = 0 and v_k >= 1,
    'documentele vehiculului vândut ies din semafor (is_active = false)', format('%s active / %s', v_m, v_k));
  v_t := pg_temp.termene(v_v1);
  v_esecuri := v_esecuri + pg_temp.verifica('1d',
    v_t = format('impozit_local_instrainare=%s rca_notificare=%s verificare_transcriere=%s',
                 v_zi + 27, v_zi + 2, v_zi + 87),
    'termenele vânzării: EXACT impozitul local (+30), RCA (+5), transcrierea (+90)', v_t);
  select count(*) filter (where is_active), count(*) into v_m, v_k from public.expirables
   where entity_type = 'vehicle_exit' and entity_id = v_v1 and deleted_at is null;
  v_esecuri := v_esecuri + pg_temp.verifica('1e', v_m = 3 and v_k = 3,
    'trei rânduri `vehicle_exit` în expirables, toate active', format('%s / %s', v_m, v_k));

  -- ═══ (18) F7 și F11 ═══════════════════════════════════════════════════════
  select count(*) into v_m from public.expirables
   where entity_type = 'vehicle_service' and entity_id = v_v1 and is_active and deleted_at is null;
  select count(*) into v_k from public.expirables
   where entity_type = 'vehicle_fine' and entity_id = v_amenda and is_active and deleted_at is null;
  v_esecuri := v_esecuri + pg_temp.verifica('18', v_n >= 1 and v_m = 0 and v_k = 1,
    'ieșirea scoate planul de service din semafor; amenda faptei de dinainte rămâne activă',
    format('service înainte %s, după %s; amendă %s', v_n, v_m, v_k));

  -- ═══ (2) cumpărat și vândut în același an ═════════════════════════════════
  v_r := pg_temp.ruleaza(v_u_admin, pg_temp.iesire(v_org, v_v2, v_u_admin, 'vanzare', v_zi - 3));
  v_t := pg_temp.termene(v_v2);
  v_esecuri := v_esecuri + pg_temp.verifica('2',
    v_r = 'ok:1' and v_t = format('impozit_local_instrainare=%s impozit_plata_an_dobandire=%s verificare_transcriere=%s',
                                   v_zi + 27, v_zi - 3, v_zi + 87),
    'cumpărat în același an: apare plata impozitului pe anul dobândirii (fără RCA, fără notificare)',
    v_r || ' / ' || v_t);

  -- ═══ (3) casarea ══════════════════════════════════════════════════════════
  v_r := pg_temp.ruleaza(v_u_admin, pg_temp.iesire(v_org, v_v3, v_u_admin, 'casare', v_zi - 10));
  v_t := pg_temp.termene(v_v3);
  select count(*) into v_n from public.expirables
   where entity_type = 'vehicle_exit' and entity_id = v_v3 and kind = 'impozit_local_radiere'
     and deleted_at is null;
  v_esecuri := v_esecuri + pg_temp.verifica('3a',
    v_r = 'ok:1' and (select status from public.vehicles where id = v_v3) = 'casat'
      and v_t = format('casco_denuntare=%s impozit_local_radiere=null predare_placute=%s radiere_drpciv=%s rca_restituire=null',
                       v_zi - 5, v_zi + 20, v_zi + 20)
      and v_n = 0,
    'casarea: radierea și plăcuțele la D+30, CASCO la D+5; impozitul de radiere și RCA așteaptă radierea, fără rând în expirables',
    format('%s / %s / %s', v_r, v_t, v_n));

  -- (19e) „Nu se aplică” pe radiere cu dependenți deschiși.
  v_r := pg_temp.ruleaza(v_u_admin, format(
    'update public.vehicle_exit_obligations set nu_se_aplica = true, updated_by = %L where id = %L',
    v_u_admin, pg_temp.termenul(v_v3, 'radiere_drpciv')));
  v_esecuri := v_esecuri + pg_temp.verifica('19e', v_r like 'P0001:De pasul ăsta depind alte termene%',
    '„Nu se aplică” pe radiere, cu impozitul de radiere deschis: P0001', v_r);

  -- (12) gărzile bifării.
  v_r := pg_temp.ruleaza(v_u_admin, format(
    'update public.vehicle_exit_obligations set finalizat_la = %L, updated_by = %L where id = %L',
    v_zi + 1, v_u_admin, pg_temp.termenul(v_v3, 'casco_denuntare')));
  v_r2 := pg_temp.ruleaza(v_u_admin, format(
    'update public.vehicle_exit_obligations set finalizat_la = %L, updated_by = %L where id = %L',
    v_zi - 11, v_u_admin, pg_temp.termenul(v_v3, 'casco_denuntare')));
  v_esecuri := v_esecuri + pg_temp.verifica('12c',
    v_r like 'P0001:Data la care s-a făcut pasul nu poate fi în viitor%'
      and v_r2 like 'P0001:Data la care s-a făcut pasul este înaintea datei ieșirii%',
    'data bifării în viitor sau înaintea ieșirii: P0001', v_r || ' / ' || v_r2);

  -- ═══ (4) bifarea scoate termenul din alerte ═══════════════════════════════
  perform internal.genereaza_alerte(v_org);
  v_termen := pg_temp.termenul(v_v3, 'predare_placute');
  select count(*) into v_n from public.compliance_alerts a
    join public.expirables x on x.id = a.expirable_id
   where x.entity_type = 'vehicle_exit' and x.entity_id = v_v3 and x.kind = 'predare_placute'
     and a.status in ('nou', 'expirat') and a.deleted_at is null;
  v_r := pg_temp.ruleaza(v_u_admin, format(
    'update public.vehicle_exit_obligations set finalizat_la = %L, updated_by = %L where id = %L',
    v_zi - 1, v_u_admin, v_termen));
  select count(*) into v_m from public.expirables
   where entity_type = 'vehicle_exit' and entity_id = v_v3 and kind = 'predare_placute' and deleted_at is null;
  select count(*) filter (where a.status = 'rezolvat'), count(*) filter (where a.status in ('nou', 'expirat'))
    into v_k, v_m
    from public.compliance_alerts a
    join public.expirables x on x.id = a.expirable_id
   where x.entity_type = 'vehicle_exit' and x.entity_id = v_v3 and x.kind = 'predare_placute';
  v_esecuri := v_esecuri + pg_temp.verifica('4',
    v_r = 'ok:1' and v_n >= 1 and v_k >= 1 and v_m = 0
      and (select finalizat_de from public.vehicle_exit_obligations where id = v_termen) = v_u_admin
      and not exists (select 1 from public.expirables where entity_type = 'vehicle_exit'
                         and entity_id = v_v3 and kind = 'predare_placute' and deleted_at is null),
    'bifarea: rândul din expirables e șters logic, alerta deschisă trece `rezolvat`, autorul din sesiune',
    format('%s, alerte deschise înainte %s, rezolvate %s, deschise după %s', v_r, v_n, v_k, v_m));

  -- ═══ (3b) bifarea radierii dă termen dependenților ════════════════════════
  v_r := pg_temp.ruleaza(v_u_admin, format(
    'update public.vehicle_exit_obligations set finalizat_la = %L, updated_by = %L where id = %L',
    v_zi - 2, v_u_admin, pg_temp.termenul(v_v3, 'radiere_drpciv')));
  select count(*) into v_n from public.expirables
   where entity_type = 'vehicle_exit' and entity_id = v_v3 and kind = 'impozit_local_radiere'
     and deleted_at is null and is_active and expires_at = v_zi + 28;
  v_t := pg_temp.termene(v_v3);
  v_esecuri := v_esecuri + pg_temp.verifica('3b',
    v_r = 'ok:1' and v_n = 1
      and v_t like format('%%impozit_local_radiere=%s%%', v_zi + 28)
      and v_t like format('%%rca_restituire=%s%%', v_zi + 3),
    'bifarea radierii la R: impozitul de radiere primește R+30 (și rând în expirables), RCA R+5',
    format('%s / %s / %s', v_r, v_n, v_t));

  -- ═══ (5) redeschiderea pasului de care depinde un termen făcut ════════════
  v_r := pg_temp.ruleaza(v_u_admin, format(
    'update public.vehicle_exit_obligations set finalizat_la = %L, updated_by = %L where id = %L',
    v_zi - 1, v_u_admin, pg_temp.termenul(v_v3, 'impozit_local_radiere')));
  v_r2 := pg_temp.ruleaza(v_u_admin, format(
    'update public.vehicle_exit_obligations set finalizat_la = null, updated_by = %L where id = %L',
    v_u_admin, pg_temp.termenul(v_v3, 'radiere_drpciv')));
  v_esecuri := v_esecuri + pg_temp.verifica('5',
    v_r = 'ok:1' and v_r2 like 'P0001:Un termen care depinde de acesta este deja făcut%',
    'radierea nu se redeschide după ce impozitul de radiere e făcut (P0001)', v_r || ' / ' || v_r2);

  -- ═══ (6) radierea pentru furt ═════════════════════════════════════════════
  v_r := pg_temp.ruleaza(v_u_admin, pg_temp.iesire(v_org, v_v4, v_u_admin, 'radiere', v_zi - 5,
                                                   p_radiere => 'furt'));
  v_t := pg_temp.termene(v_v4);
  v_esecuri := v_esecuri + pg_temp.verifica('6',
    v_r = 'ok:1' and v_t = format('impozit_local_radiere=null radiere_drpciv=%s rca_restituire=null', v_zi + 25),
    'furt: radierea la D+30, fără plăcuțe și fără denunțarea CASCO (trei termene)', v_r || ' / ' || v_t);

  -- ═══ (7) statusul scris direct ════════════════════════════════════════════
  v_r := pg_temp.ruleaza(v_u_admin, format(
    'update public.vehicles set status = ''vandut'', motiv_iesire = ''Direct'', updated_by = %L where id = %L',
    v_u_admin, v_v5));
  v_r2 := pg_temp.ruleaza(v_u_admin, format(
    'update public.vehicles set status = ''activ'', updated_by = %L where id = %L', v_u_admin, v_v1));
  v_esecuri := v_esecuri + pg_temp.verifica('7',
    v_r like 'P0001:Ieșirea din parc se înregistrează din fișa vehiculului%'
      and v_r2 like 'P0001:Revenirea în parc se face prin anularea ieșirii%',
    '`status` scris direct (vânzare, revenire): P0001 cu drumul corect', v_r || ' / ' || v_r2);

  -- ═══ (8) a doua ieșire ════════════════════════════════════════════════════
  v_r := pg_temp.ruleaza(v_u_admin, pg_temp.iesire(v_org, v_v1, v_u_admin, 'casare', v_zi));
  v_esecuri := v_esecuri + pg_temp.verifica('8', v_r like 'P0001:Vehiculul este deja ieșit din parc%',
    'a doua ieșire pe un vehicul ieșit: P0001', v_r);

  -- ═══ (9) gărzile datei și ale kilometrajului ══════════════════════════════
  v_r := pg_temp.ruleaza(v_u_admin, pg_temp.iesire(v_org, v_v5, v_u_admin, 'vanzare', v_zi + 1));
  v_esecuri := v_esecuri + pg_temp.verifica('9a', v_r like 'P0001:Data ieșirii nu poate fi în viitor%',
    'data ieșirii mâine: P0001', v_r);
  v_r := pg_temp.ruleaza(v_u_admin, pg_temp.iesire(v_org, v_v5, v_u_admin, 'vanzare', v_zi - 200));
  v_esecuri := v_esecuri + pg_temp.verifica('9b', v_r like 'P0001:Data ieșirii este înaintea datei achiziției%',
    'data ieșirii înaintea achiziției: P0001', v_r);
  v_r := pg_temp.ruleaza(v_u_admin, pg_temp.iesire(v_org, v_v5, v_u_admin, 'vanzare', v_zi - 5));
  v_esecuri := v_esecuri + pg_temp.verifica('9c', v_r like 'P0001:Data ieșirii este înaintea unor foi de parcurs%',
    'data ieșirii înaintea unei foi a vehiculului: P0001', v_r);
  v_r := pg_temp.ruleaza(v_u_admin, pg_temp.iesire(v_org, v_v5, v_u_admin, 'vanzare', v_zi, 9000));
  v_esecuri := v_esecuri + pg_temp.verifica('9d',
    v_r like 'P0001:Kilometrajul la ieșire (9000 km) este mai mic decât ultimul cunoscut%',
    'km la ieșire sub ultimul kilometraj: P0001, cu cifrele', v_r);
  -- (19a) sub km de predare al alocării deschise, deși peste km_curent.
  v_r := pg_temp.ruleaza(v_u_admin, pg_temp.iesire(v_org, v_v12, v_u_admin, 'vanzare', v_zi, 2000));
  v_esecuri := v_esecuri + pg_temp.verifica('19a',
    v_r like 'P0001:Kilometrajul la ieșire este mai mic decât cel de la predarea%',
    'km la ieșire sub predarea către șoferul actual: P0001, nu 23514', v_r);

  -- ═══ (10) alte firme ══════════════════════════════════════════════════════
  v_r := pg_temp.ruleaza(v_u_admin, pg_temp.iesire(v_org, v_vb, v_u_admin, 'vanzare', v_zi));
  v_r2 := pg_temp.ruleaza(v_u_admin, pg_temp.iesire(v_org_alta, v_vb, v_u_admin, 'vanzare', v_zi));
  v_esecuri := v_esecuri + pg_temp.verifica('10',
    v_r like 'P0001:Vehiculul ales nu aparține organizației%' and v_r2 like '42501:%',
    'vehiculul altei firme: P0001; firma altcuiva în rând: 42501', v_r || ' / ' || v_r2);

  -- ═══ (11) rolurile fără `vehicles:update` și fără `vehicles:read = all` ═══
  v_termen := pg_temp.termenul(v_v1, 'rca_notificare');
  foreach v_t in array array['manager', 'hr', 'employee', 'org_admin_alta'] loop
    declare
      v_u uuid := case v_t when 'manager' then v_u_mgr when 'hr' then v_u_hr
                           when 'employee' then v_u_ang else v_u_alta end;
    begin
      v_r := pg_temp.ruleaza(v_u, pg_temp.iesire(v_org, v_v13, v_u, 'vanzare', v_zi));
      v_n := pg_temp.numara(v_u, format('select count(*) from public.vehicle_exits where organization_id = %L', v_org));
      v_m := pg_temp.numara(v_u, format('select count(*) from public.vehicle_exit_obligations where organization_id = %L', v_org));
      v_k := pg_temp.numara(v_u, format(
        'select count(*) from public.expirables where organization_id = %L and entity_type = ''vehicle_exit''', v_org));
      v_r2 := pg_temp.ruleaza(v_u, format(
        'update public.vehicle_exit_obligations set nota = ''Încercare'', updated_by = %L where id = %L', v_u, v_termen));
      v_esecuri := v_esecuri + pg_temp.verifica('11-' || v_t,
        v_r like '42501:%' and v_n = 0 and v_m = 0 and v_k = 0 and v_r2 = 'ok:0',
        v_t || ': INSERT 42501; zero ieșiri, zero termene, zero scadențe; UPDATE pe termen 0 rânduri',
        format('%s / %s / %s / %s / %s', v_r, v_n, v_m, v_k, v_r2));
    end;
  end loop;

  -- ═══ (22) super_admin ═════════════════════════════════════════════════════
  v_n := pg_temp.numara(v_u_sa, format('select count(*) from public.vehicle_exits where organization_id = %L', v_org));
  v_m := pg_temp.numara(v_u_sa, format('select count(*) from public.vehicle_exit_obligations where organization_id = %L', v_org));
  v_r := pg_temp.ruleaza(v_u_sa, pg_temp.iesire(v_org, v_v13, v_u_sa, 'vanzare', v_zi));
  v_esecuri := v_esecuri + pg_temp.verifica('22', v_n >= 4 and v_m >= 10 and v_r like '42501:%',
    'super_admin (platform_admins, NU membru) vede ieșirile și termenele, nu scrie (42501)',
    format('%s / %s / %s', v_n, v_m, v_r));

  -- ═══ (12) termenele le scrie doar asistentul ══════════════════════════════
  v_r := pg_temp.ruleaza(v_u_admin, format(
    'insert into public.vehicle_exit_obligations (organization_id, exit_id, vehicle_id, cod, denumire, natura, '
    || 'ordine, termen, created_by, updated_by) values (%L, %L, %L, ''pastrare_numar'', ''Fals'', ''legal'', 1, %L, %L, %L)',
    v_org, pg_temp.iesirea(v_v1), v_v1, v_zi, v_u_admin, v_u_admin));
  v_esecuri := v_esecuri + pg_temp.verifica('12a', v_r like '42501:%',
    'INSERT direct în vehicle_exit_obligations ca org_admin: 42501', v_r);
  v_r := pg_temp.ruleaza(v_u_admin, format(
    'update public.vehicle_exit_obligations set termen = %L, updated_by = %L where id = %L',
    v_zi + 100, v_u_admin, v_termen));
  v_r2 := pg_temp.ruleaza(v_u_admin, format(
    'update public.vehicle_exit_obligations set cod = ''casco_denuntare'', updated_by = %L where id = %L',
    v_u_admin, v_termen));
  v_esecuri := v_esecuri + pg_temp.verifica('12b',
    v_r like 'P0001:Termenul și natura obligației le stabilește asistentul%'
      and v_r2 like 'P0001:Termenul și natura obligației le stabilește asistentul%',
    'UPDATE pe `termen` sau pe `cod`: P0001', v_r || ' / ' || v_r2);

  -- ═══ (13) anularea ════════════════════════════════════════════════════════
  v_r := pg_temp.ruleaza(v_u_admin, pg_temp.iesire(v_org, v_v6, v_u_admin, 'vanzare', v_zi - 2));
  select count(*) filter (where is_active) into v_n from public.expirables
   where entity_type = 'vehicle_document' and entity_id = v_v6 and deleted_at is null;
  v_iesire := pg_temp.iesirea(v_v6);
  v_r2 := pg_temp.ruleaza(v_u_admin, format(
    'update public.vehicle_exits set anulat_la = now(), motiv_anulare = ''Înregistrată din greșeală'', '
    || 'updated_by = %L where id = %L and anulat_la is null and deleted_at is null', v_u_admin, v_iesire));
  select * into v_rand from public.vehicles where id = v_v6;
  select count(*) filter (where is_active) into v_m from public.expirables
   where entity_type = 'vehicle_document' and entity_id = v_v6 and deleted_at is null;
  select count(*) into v_k from public.expirables
   where entity_type = 'vehicle_exit' and entity_id = v_v6 and deleted_at is null;
  v_esecuri := v_esecuri + pg_temp.verifica('13a',
    v_r = 'ok:1' and v_n = 0 and v_r2 = 'ok:1' and v_rand.status = 'activ'
      and v_rand.data_iesire is null and v_rand.motiv_iesire is null and v_m = 1 and v_k = 0
      and (select anulat_de from public.vehicle_exits where id = v_iesire) = v_u_admin
      and (select count(*) from public.vehicle_exit_obligations where exit_id = v_iesire) = 3,
    'anularea: vehiculul revine activ, fără dată și motiv; RCA revine în semafor; zero termene vii (rândurile rămân ca istoric)',
    format('%s / RCA activ înainte %s / %s / %s / RCA după %s / termene vii %s', v_r, v_n, v_r2, v_rand.status, v_m, v_k));
  v_r := pg_temp.ruleaza(v_u_admin, format(
    'update public.vehicle_exits set anulat_la = now(), motiv_anulare = ''A doua oară'', '
    || 'updated_by = %L where id = %L and anulat_la is null and deleted_at is null', v_u_admin, v_iesire));
  v_r2 := pg_temp.ruleaza(v_u_admin, format(
    'update public.vehicle_exits set observatii = ''Notă târzie'', updated_by = %L where id = %L', v_u_admin, v_iesire));
  v_esecuri := v_esecuri + pg_temp.verifica('13b',
    v_r = 'ok:0' and v_r2 like 'P0001:Ieșirea este deja anulată%',
    'a doua anulare: 0 rânduri (filtrul acțiunii); orice UPDATE pe ieșirea anulată, din SQL: P0001 (19c)',
    v_r || ' / ' || v_r2);

  -- ═══ (19b) ștergerea logică a unei ieșiri vii ═════════════════════════════
  v_r := pg_temp.ruleaza(v_u_admin, format(
    'update public.vehicle_exits set deleted_at = now(), updated_by = %L where id = %L',
    v_u_admin, pg_temp.iesirea(v_v2)));
  v_esecuri := v_esecuri + pg_temp.verifica('19b', v_r like 'P0001:Tipul, data și kilometrajul ieșirii nu se mai pot schimba%',
    'ștergerea logică a unei ieșiri vii prin API: P0001', v_r);

  -- ═══ (14) numărul vehiculului vândut se eliberează (I-h2) ═════════════════
  v_r := pg_temp.ruleaza(v_u_admin, pg_temp.iesire(v_org, v_v11, v_u_admin, 'vanzare', v_zi - 2,
                                                   p_pastreaza => true));
  v_t := pg_temp.termene(v_v11);
  -- Păstrarea numărului se cere de regulă ÎNAINTE de vânzare: limita de jos e
  -- achiziția (aici necunoscută), nu ieșirea.
  v_r2 := pg_temp.ruleaza(v_u_admin, format(
    'update public.vehicle_exit_obligations set finalizat_la = %L, updated_by = %L where id = %L',
    v_zi - 20, v_u_admin, pg_temp.termenul(v_v11, 'pastrare_numar')));
  v_esecuri := v_esecuri + pg_temp.verifica('14a',
    v_r = 'ok:1' and v_t like format('%%pastrare_numar=%s%%', v_zi - 2) and v_r2 = 'ok:1',
    'păstrarea numărului: termen în ziua vânzării, bifată cu o dată de dinaintea ei',
    format('%s / %s / %s', v_r, v_t, v_r2));
  v_r := pg_temp.ruleaza(v_u_admin, format(
    'insert into public.vehicles (organization_id, nr_inmatriculare, marca, model, created_by, updated_by) '
    || 'values (%L, %L, ''Dacia'', ''Spring'', %L, %L)', v_org, 'IED' || v_sufix, v_u_admin, v_u_admin));
  v_r2 := pg_temp.ruleaza(v_u_admin, format(
    'update public.vehicle_exits set anulat_la = now(), motiv_anulare = ''Ciocnire de număr'', '
    || 'updated_by = %L where id = %L and anulat_la is null', v_u_admin, pg_temp.iesirea(v_v11)));
  v_esecuri := v_esecuri + pg_temp.verifica('14b',
    v_r = 'ok:1' and v_r2 like '23505:%vehicles_org_nr_uq%'
      and (select status from public.vehicles where id = v_v11) = 'vandut',
    'vehicul nou cu numărul celui vândut: reușește; anularea ieșirii vechi: 23505, vehiculul rămâne ieșit',
    v_r || ' / ' || v_r2);

  -- ═══ (15) backfill ════════════════════════════════════════════════════════
  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent, status,
                               motiv_iesire, created_by, updated_by)
  values (v_v7, v_org, 'IE7' || v_sufix, 'Opel', 'Astra', 200000, 'casat', 'Vechi', v_u_admin, v_u_admin);
  perform set_config('app.flota_iesire_backfill', 'on', true);
  insert into public.vehicle_exits (organization_id, vehicle_id, tip, data_iesire, motiv,
                                    preluata_din_istoric, created_by, updated_by)
  values (v_org, v_v7, 'casare', v_zi - 400, 'Uz', true, v_u_admin, v_u_admin);
  perform set_config('app.flota_iesire_backfill', '', true);
  select count(*) into v_n from public.vehicle_exit_obligations where vehicle_id = v_v7;
  v_esecuri := v_esecuri + pg_temp.verifica('15',
    (select preluata_din_istoric from public.vehicle_exits where vehicle_id = v_v7) and v_n = 0,
    'backfill: ieșire `preluata_din_istoric` (motiv vechi sub 5 caractere acceptat), zero termene', format('%s', v_n));

  -- ═══ (16) vizibilitatea în expirables ═════════════════════════════════════
  select count(*) into v_n from public.expirables
   where organization_id = v_org and entity_type = 'vehicle_exit' and deleted_at is null;
  v_m := pg_temp.numara(v_u_admin, format(
    'select count(*) from public.expirables where organization_id = %L and entity_type = ''vehicle_exit'' and deleted_at is null',
    v_org));
  v_esecuri := v_esecuri + pg_temp.verifica('16', v_n >= 10 and v_m = v_n,
    'org_admin vede toate termenele de ieșire din expirables', format('%s din %s', v_m, v_n));

  -- ═══ (17) + (19d) ștergerea logică a vehiculului ieșit ════════════════════
  v_r := pg_temp.ruleaza(v_u_admin, pg_temp.iesire(v_org, v_v8, v_u_admin, 'vanzare', v_zi - 1));
  select count(*) into v_n from public.expirables
   where entity_type = 'vehicle_exit' and entity_id = v_v8 and deleted_at is null;
  v_r2 := pg_temp.ruleaza(v_u_admin, format(
    'update public.vehicles set deleted_at = now(), updated_by = %L where id = %L', v_u_admin, v_v8));
  select count(*) into v_m from public.expirables
   where entity_type = 'vehicle_exit' and entity_id = v_v8 and deleted_at is null;
  v_esecuri := v_esecuri + pg_temp.verifica('17', v_r = 'ok:1' and v_n = 2 and v_r2 = 'ok:1' and v_m = 0,
    'vehiculul ieșit, șters logic: termenele lui ies din expirables', format('%s / %s / %s / %s', v_r, v_n, v_r2, v_m));
  v_r := pg_temp.ruleaza(v_u_admin, format(
    'update public.vehicle_exits set anulat_la = now(), motiv_anulare = ''După ștergere'', updated_by = %L '
    || 'where id = %L and anulat_la is null', v_u_admin, pg_temp.iesirea(v_v8)));
  v_esecuri := v_esecuri + pg_temp.verifica('19d', v_r like 'P0001:Ieșirea unui vehicul șters nu se mai poate anula%',
    'anularea ieșirii unui vehicul șters: P0001', v_r);

  -- ═══ (19f) cheia comună din expirables ════════════════════════════════════
  v_r := pg_temp.ruleaza(v_u_admin, pg_temp.iesire(v_org, v_v9, v_u_admin, 'vanzare', v_zi - 4));
  v_iesire_a := pg_temp.iesirea(v_v9);
  v_r := v_r || '/' || pg_temp.ruleaza(v_u_admin, format(
    'update public.vehicle_exits set anulat_la = now(), motiv_anulare = ''Data greșită'', updated_by = %L '
    || 'where id = %L and anulat_la is null', v_u_admin, v_iesire_a));
  v_r := v_r || '/' || pg_temp.ruleaza(v_u_admin, pg_temp.iesire(v_org, v_v9, v_u_admin, 'vanzare', v_zi - 1));
  -- UPDATE de serviciu (superuser) pe termenul ieșirii ANULATE cu același cod.
  update public.vehicle_exit_obligations set nota = 'Atinsă de serviciu'
   where exit_id = v_iesire_a and cod = 'impozit_local_instrainare';
  select count(*) into v_n from public.expirables
   where organization_id = v_org and entity_type = 'vehicle_exit' and entity_id = v_v9
     and kind = 'impozit_local_instrainare' and deleted_at is null and is_active and expires_at = v_zi + 29;
  v_esecuri := v_esecuri + pg_temp.verifica('19f', v_r = 'ok:1/ok:1/ok:1' and v_n = 1,
    'un UPDATE de serviciu pe termenul ieșirii anulate nu șterge rândul ieșirii vii cu același cod',
    format('%s / %s', v_r, v_n));

  -- ═══ (21) restituirea la locator + `anulat_de` din payload ════════════════
  v_r := pg_temp.ruleaza(v_u_admin, format(
    'insert into public.vehicle_exits (organization_id, vehicle_id, tip, data_iesire, motiv, anulat_de, '
    || 'created_by, updated_by) values (%L, %L, ''restituire_leasing'', %L, ''PV către locator'', %L, %L, %L)',
    v_org, v_v13, v_zi - 1, v_u_hr, v_u_admin, v_u_admin));
  v_iesire := pg_temp.iesirea(v_v13);
  v_r2 := pg_temp.ruleaza(v_u_admin, format(
    'update public.vehicle_exits set observatii = ''Predată cu procesul-verbal'', anulat_de = %L, updated_by = %L where id = %L',
    v_u_hr, v_u_admin, v_iesire));
  v_t := pg_temp.termene(v_v13);
  v_esecuri := v_esecuri + pg_temp.verifica('21',
    v_r = 'ok:1' and v_r2 = 'ok:1' and v_t = format('leasing_declaratie_impozit=%s', v_zi + 29)
      and (select status from public.vehicles where id = v_v13) = 'vandut'
      and (select anulat_de from public.vehicle_exits where id = v_iesire) is null,
    'restituirea la locator: declarația de leasing la D+30; `anulat_de` din payload ignorat la INSERT și la UPDATE',
    format('%s / %s / %s', v_r, v_r2, v_t));

  -- ═══ (20) rezumatul zilnic ════════════════════════════════════════════════
  -- Responsabilul de flotă e managerul (`vehicles:read = team`): vede pool-ul,
  -- dar termenele de ieșire nu-i ajung; ele merg la administrator.
  v_r := pg_temp.ruleaza(v_u_admin, pg_temp.iesire(v_org, v_v10, v_u_admin, 'vanzare', v_zi - 1));
  insert into public.fleet_settings (organization_id, responsabili, created_by, updated_by)
  values (v_org, array[v_e_mgr], v_u_admin, v_u_admin);
  perform internal.genereaza_alerte(v_org);
  perform internal.flota_rezumat(v_org);
  -- Corpul notificării are cel mult 8 rânduri: legătura alertei cu omul se
  -- citește din `alert_notifications`, nu din text.
  select count(*) into v_n from public.alert_notifications an
    join public.compliance_alerts a on a.id = an.alert_id
    join public.expirables x on x.id = a.expirable_id
   where x.entity_type = 'vehicle_exit' and x.entity_id = v_v10 and an.recipient_user_id = v_u_admin;
  select count(*) into v_m from public.alert_notifications an
    join public.compliance_alerts a on a.id = an.alert_id
    join public.expirables x on x.id = a.expirable_id
   where x.entity_type = 'vehicle_exit' and x.organization_id = v_org
     and an.recipient_user_id in (v_u_mgr, v_u_hr, v_u_ang);
  select count(*) into v_k from public.notifications
   where organization_id = v_org and user_id = v_u_admin and title like 'Flota:%termen%de ieșire din parc%';
  v_esecuri := v_esecuri + pg_temp.verifica('20',
    v_r = 'ok:1' and v_n = 1 and v_m = 0 and v_k = 1
      and not exists (select 1 from public.notifications
                       where organization_id = v_org and user_id in (v_u_mgr, v_u_hr, v_u_ang)
                         and (title like '%ieșire%' or body like '%IEP' || v_sufix || '%')),
    'rezumatul: termenele de ieșire (și ale pool-ului) ajung la administrator, nu la responsabilul cu `team`',
    format('%s / pool la admin %s / la ceilalți %s / titluri admin %s', v_r, v_n, v_m, v_k));

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA FLOTA IEȘIRE: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE verificările au trecut.';
  raise notice '';
end $$;

rollback;
