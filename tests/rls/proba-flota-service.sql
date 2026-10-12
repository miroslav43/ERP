-- tests/rls/proba-flota-service.sql
--
-- FLOTA, DUPĂ 0200: SERVICE, COSTURI, ANVELOPE. Pe seed-ul real al rolurilor.
--
-- ── DE CE EXISTĂ FIȘIERUL ───────────────────────────────────────────────────
-- Trei lucruri nu se văd din aplicație și se află doar rulând (memoria „Sonda
-- empirică pentru RLS”): că planul se mută singur când se înregistrează o
-- intervenție (și revine când ea se șterge), că scadența service-ului intră în
-- `expirables` fără să strice vizibilitatea celorlalte tipuri — `app.poate_vedea_
-- expirabil` a fost rescrisă COMPLET — și că jobul zilnic trimite fiecărui om doar
-- ce vede. Un rol care „nu poate scrie” sau „nu poate citi” nu dă eroare: dă
-- zero rânduri. De aceea rândurile se NUMĂRĂ.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- Planul și derivatele (trigger `vsp_inainte`):
--  (1) administratorul creează un plan; ultima = baza, următoarea = baza + luni,
--      ținta de km = km de bază + interval; derivatele trimise de client se
--      ignoră                                                         [POZITIVĂ];
--  (2) scadența pe dată ajunge în `expirables` (`vehicle_service`: vehiculul ca
--      entitate, planul ca `kind`, șoferul responsabil); planul doar pe km nu
--      produce rând                                                   [POZITIVĂ];
--  (3) o intervenție legată mută planul și ridică `vehicles.km_curent`; ștearsă,
--      planul revine la bază;
--  (4) o intervenție veche NU coboară kilometrajul;
--  (5) refuzurile triggerelor (P0001): plan al altui vehicul, dată în viitor,
--      vehicul din altă firmă, modificare de cifre după inserare, plan pe vehicul
--      vândut, plan cu baza în viitor;
--  (6) CHECK-urile (23514): anvelopele doar la tipul „anvelope”, litri doar la
--      combustibil, suma pozitivă, planul fără niciun interval;
--  (7) intervenția de tip „anvelope” trece anvelopele montate pe vehicul;
-- Drepturile (rânduri numărate):
--  (8) managerul (team) citește planurile, intervențiile și cheltuielile mașinii
--      echipei lui, NU pe cele ale unui vehicul pe care nu-l vede;
--  (9) șoferul (own), colegul fără mașină și `hr` citesc ZERO rânduri  [NEGATIVĂ];
-- (10) managerul, șoferul și `hr` NU scriu (42501 la INSERT, zero la UPDATE);
-- (11) altă firmă nu vede nimic și nu scrie pe vehiculul acesta          [NEGATIVĂ];
-- (12) administratorul scrie și citește cheltuieli                      [POZITIVĂ];
-- (11b) `super_admin` (din `platform_admins`, fără apartenență la firmă) citește
--      planurile, intervențiile și cheltuielile; NU scrie (politicile de scriere
--      cer membru)                                                       [POZITIVĂ/NEGATIVĂ];
-- Vizibilitatea în `expirables` (rescrierea lui `poate_vedea_expirabil`):
-- (13) toate cele 15 ramuri (14 vechi + `vehicle_service`) răspund adevărat
--      administratorului, un tip necunoscut fals; managerul vede `vehicle_service`
--      (team), șoferul și `hr` nu; garda din 0023:89 ține;
-- (14) rândul din `expirables` îl vede administratorul, nu șoferul, nu `hr`, nu
--      altă firmă;
-- Ciclul de viață:
-- (15) planul oprit scoate scadența din expirables, repornit o aduce înapoi;
--      vehiculul vândut o face inactivă, iar pe el nu se mai adaugă planuri;
-- Jobul zilnic:
-- (16) scadența de service pe dată: rezumat „lucrare de service în curând”, cu
--      legătura spre fila service pentru administrator, spre portal pentru șofer;
-- (17) alerta pe kilometri: „aproape” o dată, „depășit” o dată, idempotent; după o
--      intervenție ținta se mută și ciclul se reia;
-- (18) memento-ul de anvelope: doar în noiembrie, o dată pe an, doar pentru
--      anvelope de vară;
-- (19) `conformitate_zilnica` raportează `mementouri` și nu eșuează pe nicio firmă;
-- (20) tipul de document `revizie` e retras pe platformă.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

-- Identitatea: JWT-ul și rolul. Rămân valabile până la `reset role`.
create function pg_temp.ca(p_user uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  execute 'set local role authenticated';
end $f$;

-- Rulează o instrucțiune sub identitatea curentă și întoarce 'ok:<rânduri>' sau
-- '<SQLSTATE>: <mesaj>'. Un UPDATE respins de USING dă 'ok:0', nu eroare.
create function pg_temp.rul(p_sql text) returns text language plpgsql as $f$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return 'ok:' || n::text;
exception when others then
  return sqlstate || ': ' || sqlerrm;
end $f$;

create function pg_temp.cate(p_sql text) returns bigint language plpgsql as $f$
declare n bigint;
begin
  execute 'select count(*) from (' || p_sql || ') q' into n;
  return n;
end $f$;

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_azi      date := app.azi_local();
  v_org      uuid := gen_random_uuid();
  v_org2     uuid := gen_random_uuid();
  v_u_adm    uuid := gen_random_uuid();
  v_u_mgr    uuid := gen_random_uuid();
  v_u_a      uuid := gen_random_uuid();   -- șoferița, cu mașina VA
  v_u_b      uuid := gen_random_uuid();   -- coleg fără mașină
  v_u_hr     uuid := gen_random_uuid();
  v_u_adm2   uuid := gen_random_uuid();
  v_u_sa     uuid := gen_random_uuid();   -- super_admin de platformă
  v_e_adm    uuid := gen_random_uuid();
  v_e_mgr    uuid := gen_random_uuid();
  v_e_a      uuid := gen_random_uuid();
  v_e_b      uuid := gen_random_uuid();
  v_e_hr     uuid := gen_random_uuid();
  v_e_adm2   uuid := gen_random_uuid();
  v_va       uuid := gen_random_uuid();   -- a șoferiței, în echipa managerului
  v_vb       uuid := gen_random_uuid();   -- fără șofer, invizibilă managerului
  v_vs       uuid := gen_random_uuid();   -- va fi vândut
  v_v2       uuid := gen_random_uuid();   -- altă firmă
  v_nr_va    text;
  v_p1       uuid;                        -- revizie: 10.000 km / 12 luni
  v_p2       uuid;                        -- doar pe km, ținta departe
  v_p3       uuid;                        -- doar pe dată, scadent peste ~26 de zile
  v_pb       uuid;                        -- plan pe VB
  v_ps       uuid;                        -- plan pe VS
  v_e1       uuid;
  v_e2       uuid;
  v_ex1      uuid;
  v_baza     date := v_azi - 100;
  v_n        bigint;
  v_n2       bigint;
  v_n3       bigint;
  v_k        int;
  v_d        date;
  v_t        text;
  v_titlu    text;
  v_corp     text;
  v_link     text;
  v_rap      jsonb;
  v_r        text;
  v_ok       boolean;
  v_esecuri  int := 0;
  v_tip      text;
begin
  raise notice '';
  raise notice '  PROBA „FLOTA — SERVICE, COSTURI, ANVELOPE" (0200)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org,  'proba-fsv-' || v_sufix,  'Proba Service SRL',
     'RO' || (89000000 + (random() * 900000)::int)::text),
    (v_org2, 'proba-fsv2-' || v_sufix, 'Proba Service Doi SRL',
     'RO' || (90000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select o, f.feature_key, true, now()
    from public.features f, unnest(array[v_org, v_org2]) as o;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_adm,  'fsv-adm-'  || v_sufix || '@proba.test', now()),
    (v_u_mgr,  'fsv-mgr-'  || v_sufix || '@proba.test', now()),
    (v_u_a,    'fsv-a-'    || v_sufix || '@proba.test', now()),
    (v_u_b,    'fsv-b-'    || v_sufix || '@proba.test', now()),
    (v_u_hr,   'fsv-hr-'   || v_sufix || '@proba.test', now()),
    (v_u_adm2, 'fsv-adm2-' || v_sufix || '@proba.test', now()),
    (v_u_sa,   'fsv-sa-'   || v_sufix || '@proba.test', now());
  insert into public.platform_admins (user_id) values (v_u_sa);
  -- Fișele ÎNAINTEA rândurilor de membru (0083 îi creează singur administratorului o fișă).
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_adm,  v_org,  'FSV-ADM', 'Ioana', 'Administrator', v_azi - 900, 'activ', v_u_adm,  null),
    (v_e_mgr,  v_org,  'FSV-M',   'Mihai', 'Manager',       v_azi - 500, 'activ', v_u_mgr,  null),
    (v_e_hr,   v_org,  'FSV-HR',  'Elena', 'Personal',      v_azi - 500, 'activ', v_u_hr,   null),
    (v_e_adm2, v_org2, 'FSV-AD2', 'Radu',  'Altă Firmă',    v_azi - 900, 'activ', v_u_adm2, null);
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_a, v_org, 'FSV-A', 'Ana',    'Șofer', v_azi - 400, 'activ', v_u_a, v_e_mgr),
    (v_e_b, v_org, 'FSV-B', 'Bogdan', 'Coleg', v_azi - 400, 'activ', v_u_b, v_e_mgr);
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org,  v_u_adm,  'org_admin'),
    (v_org,  v_u_mgr,  'manager'),
    (v_org,  v_u_a,    'employee'),
    (v_org,  v_u_b,    'employee'),
    (v_org,  v_u_hr,   'hr'),
    (v_org2, v_u_adm2, 'org_admin');

  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent,
                               created_by, updated_by) values
    (v_va, v_org,  'B' || (100 + (random() * 800)::int)::text || 'FSA', 'Dacia', 'Logan',  45000, v_u_adm,  v_u_adm),
    (v_vb, v_org,  'B' || (100 + (random() * 800)::int)::text || 'FSB', 'Dacia', 'Duster', 20000, v_u_adm,  v_u_adm),
    (v_vs, v_org,  'B' || (100 + (random() * 800)::int)::text || 'FSS', 'Dacia', 'Sandero', 9000, v_u_adm,  v_u_adm),
    (v_v2, v_org2, 'B' || (100 + (random() * 800)::int)::text || 'FS2', 'Dacia', 'Spring',  5000, v_u_adm2, v_u_adm2);
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, created_by, updated_by) values
    (v_org, v_va, v_e_a, now() - interval '30 days', v_u_adm, v_u_adm);
  select nr_inmatriculare into v_nr_va from public.vehicles where id = v_va;

  -- ═══ Planul și derivatele ═════════════════════════════════════════════════

  -- (1) Derivatele; clientul încearcă să le seteze și e ignorat.
  perform pg_temp.ca(v_u_adm);
  begin
    insert into public.vehicle_service_plans
      (organization_id, vehicle_id, denumire, tip, interval_km, interval_luni, baza_data, baza_km,
       ultima_data, ultimii_km, urmatoarea_data, urmatorii_km, created_by, updated_by)
    values (v_org, v_va, 'Revizie periodică', 'revizie', 10000, 12, v_baza, 40000,
            v_azi + 999, 999999, v_azi + 999, 999999, v_u_adm, v_u_adm)
    returning id into v_p1;
    reset role;
    select count(*) into v_n from public.vehicle_service_plans p
     where p.id = v_p1
       and p.ultima_data = v_baza and p.ultimii_km = 40000
       and p.urmatoarea_data = (v_baza + interval '12 months')::date
       and p.urmatorii_km = 50000;
    if v_n = 1 then
      raise notice '  ✓ (1) planul calculează ultima/următoarea din bază; derivatele trimise de client sunt ignorate';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (1) derivatele planului nu sunt cele așteptate';
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) administratorul nu poate crea planul: % (%)', sqlerrm, sqlstate;
  end;

  -- (2) Proiecția în expirables; planul doar pe km (ținta departe) nu produce rând.
  insert into public.vehicle_service_plans
    (organization_id, vehicle_id, denumire, interval_km, baza_data, baza_km, created_by, updated_by)
  values (v_org, v_va, 'Schimb distribuție', 500000, v_baza, 0, v_u_adm, v_u_adm)
  returning id into v_p2;
  select count(*), min(x.entity_id::text), min(x.kind), min(x.expires_at::text),
         min(x.responsible_employee_id::text), min(x.label)
    into v_n, v_t, v_titlu, v_corp, v_link, v_r
    from public.expirables x
   where x.organization_id = v_org and x.entity_type = 'vehicle_service' and x.deleted_at is null;
  if v_n = 1 and v_t = v_va::text and v_titlu = 'plan_' || replace(v_p1::text, '-', '')
     and v_corp = (v_baza + interval '12 months')::date::text
     and v_link = v_e_a::text
     and v_r = 'Revizie periodică — ' || v_nr_va then
    raise notice '  ✓ (2) scadența pe dată intră în expirables (vehiculul, planul, șoferul); planul doar pe km nu';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) expirables: % rânduri, entitate %, kind %, dată %, responsabil %, etichetă %',
      v_n, v_t, v_titlu, v_corp, v_link, v_r;
  end if;

  -- (3a) O intervenție legată mută planul și ridică kilometrajul.
  perform pg_temp.ca(v_u_adm);
  insert into public.vehicle_service_entries
    (organization_id, vehicle_id, plan_id, data_interventiei, km, tip, descriere, furnizor, numar_factura,
     cost_piese, cost_manopera, created_by, updated_by)
  values (v_org, v_va, v_p1, v_azi - 1, 46500, 'revizie', 'Ulei, filtre', 'Service Auto SRL', 'F-100',
          300, 450, v_u_adm, v_u_adm)
  returning id into v_e1;
  reset role;
  select count(*) into v_n from public.vehicle_service_entries e where e.id = v_e1 and e.cost_total = 750;
  select v.km_curent into v_k from public.vehicles v where v.id = v_va;
  select count(*) into v_n2 from public.vehicle_service_plans p
   where p.id = v_p1 and p.ultima_data = v_azi - 1 and p.ultimii_km = 46500
     and p.urmatoarea_data = ((v_azi - 1) + interval '12 months')::date and p.urmatorii_km = 56500;
  select count(*) into v_n3 from public.expirables x
   where x.organization_id = v_org and x.kind = 'plan_' || replace(v_p1::text, '-', '')
     and x.deleted_at is null and x.expires_at = ((v_azi - 1) + interval '12 months')::date;
  if v_n = 1 and v_k = 46500 and v_n2 = 1 and v_n3 = 1 then
    raise notice '  ✓ (3a) intervenția: cost_total 750, km_curent 46.500, planul și scadența din expirables se mută';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3a) cost_total ok=%, km_curent=%, plan mutat=%, expirable mutat=%', v_n, v_k, v_n2, v_n3;
  end if;

  -- (4) Intervenție veche, de la 30.000 km: istoric, nu coboară kilometrajul.
  perform pg_temp.ca(v_u_adm);
  insert into public.vehicle_service_entries
    (organization_id, vehicle_id, data_interventiei, km, tip, descriere, cost_piese, cost_manopera, created_by, updated_by)
  values (v_org, v_va, v_azi - 200, 30000, 'reparatie', 'Plăcuțe frână', 200, 100, v_u_adm, v_u_adm)
  returning id into v_e2;
  reset role;
  select v.km_curent into v_k from public.vehicles v where v.id = v_va;
  select p.ultimii_km into v_n from public.vehicle_service_plans p where p.id = v_p1;
  if v_k = 46500 and v_n = 46500 then
    raise notice '  ✓ (4) o intervenție veche și nelegată nu coboară kilometrajul și nu mută planul';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) km_curent=% (așteptat 46500), ultimii_km plan=% (46500)', v_k, v_n;
  end if;

  -- (3b) Ștearsă intervenția legată, planul revine la bază.
  perform pg_temp.ca(v_u_adm);
  v_r := pg_temp.rul(format('update public.vehicle_service_entries set deleted_at = now(), updated_by = %L where id = %L',
                            v_u_adm, v_e1));
  reset role;
  select count(*) into v_n2 from public.vehicle_service_plans p
   where p.id = v_p1 and p.ultima_data = v_baza and p.ultimii_km = 40000
     and p.urmatoarea_data = (v_baza + interval '12 months')::date and p.urmatorii_km = 50000;
  select count(*) into v_n3 from public.expirables x
   where x.organization_id = v_org and x.kind = 'plan_' || replace(v_p1::text, '-', '')
     and x.deleted_at is null and x.expires_at = (v_baza + interval '12 months')::date;
  if v_r = 'ok:1' and v_n2 = 1 and v_n3 = 1 then
    raise notice '  ✓ (3b) ștearsă intervenția, planul și scadența revin la bază';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3b) ștergere=%, plan revenit=%, expirable revenit=%', v_r, v_n2, v_n3;
  end if;

  -- (5) Refuzurile triggerelor (P0001), sub identitatea administratorului.
  insert into public.vehicle_service_plans
    (organization_id, vehicle_id, denumire, interval_luni, baza_data, baza_km, created_by, updated_by)
  values (v_org, v_vb, 'Revizie Duster', 12, v_azi - 30, 19000, v_u_adm, v_u_adm)
  returning id into v_pb;
  perform pg_temp.ca(v_u_adm);
  v_ok := true;
  v_r := pg_temp.rul(format($q$insert into public.vehicle_service_entries
      (organization_id, vehicle_id, plan_id, data_interventiei, km, tip, descriere, created_by, updated_by)
      values (%L, %L, %L, %L, 46600, 'revizie', 'Plan străin', %L, %L)$q$, v_org, v_va, v_pb, v_azi, v_u_adm, v_u_adm));
  v_ok := v_ok and v_r like 'P0001: Planul ales nu aparține acestui vehicul%';
  if not (v_r like 'P0001: Planul ales%') then raise warning '  · (5) plan străin: %', v_r; end if;
  v_r := pg_temp.rul(format($q$insert into public.vehicle_service_entries
      (organization_id, vehicle_id, data_interventiei, km, tip, descriere, created_by, updated_by)
      values (%L, %L, %L, 46600, 'revizie', 'În viitor', %L, %L)$q$, v_org, v_va, v_azi + 3, v_u_adm, v_u_adm));
  v_ok := v_ok and v_r like 'P0001: Data intervenției nu poate fi în viitor%';
  if not (v_r like 'P0001: Data intervenției%') then raise warning '  · (5) dată viitoare: %', v_r; end if;
  v_r := pg_temp.rul(format($q$insert into public.vehicle_service_entries
      (organization_id, vehicle_id, data_interventiei, km, tip, descriere, created_by, updated_by)
      values (%L, %L, %L, 100, 'revizie', 'Vehicul străin', %L, %L)$q$, v_org, v_v2, v_azi, v_u_adm, v_u_adm));
  v_ok := v_ok and v_r like 'P0001: Vehiculul ales nu există în organizația dumneavoastră%';
  if not (v_r like 'P0001: Vehiculul ales%') then raise warning '  · (5) vehicul străin: %', v_r; end if;
  v_r := pg_temp.rul(format('update public.vehicle_service_entries set cost_piese = 1, updated_by = %L where id = %L',
                            v_u_adm, v_e2));
  v_ok := v_ok and v_r like 'P0001: Intervenția de service nu se modifică%';
  if not (v_r like 'P0001: Intervenția de service nu se modifică%') then raise warning '  · (5) modificare: %', v_r; end if;
  v_r := pg_temp.rul(format($q$insert into public.vehicle_service_plans
      (organization_id, vehicle_id, denumire, interval_luni, baza_data, baza_km, created_by, updated_by)
      values (%L, %L, 'Plan din viitor', 6, %L, 1, %L, %L)$q$, v_org, v_va, v_azi + 5, v_u_adm, v_u_adm));
  v_ok := v_ok and v_r like 'P0001: Data ultimei intervenții nu poate fi în viitor%';
  if not (v_r like 'P0001: Data ultimei%') then raise warning '  · (5) baza în viitor: %', v_r; end if;
  v_r := pg_temp.rul(format($q$insert into public.vehicle_expenses
      (organization_id, vehicle_id, categorie, data_cheltuielii, suma, created_by, updated_by)
      values (%L, %L, 'parcare', %L, 10, %L, %L)$q$, v_org, v_va, v_azi + 1, v_u_adm, v_u_adm));
  v_ok := v_ok and v_r like 'P0001: Data cheltuielii nu poate fi în viitor%';
  if not (v_r like 'P0001: Data cheltuielii%') then raise warning '  · (5) cheltuială viitoare: %', v_r; end if;
  reset role;
  -- Pe vehicul vândut (fixture, ca postgres): marcăm VS vândut după ce primește un plan (15).
  if v_ok then
    raise notice '  ✓ (5) P0001: plan străin, dată în viitor, vehicul din altă firmă, modificare, bază în viitor';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) un refuz P0001 nu s-a produs sau are alt mesaj';
  end if;

  -- (6) CHECK-urile (23514).
  perform pg_temp.ca(v_u_adm);
  v_ok := true;
  v_r := pg_temp.rul(format($q$insert into public.vehicle_service_entries
      (organization_id, vehicle_id, data_interventiei, km, tip, descriere, anvelope_montate, created_by, updated_by)
      values (%L, %L, %L, 46600, 'revizie', 'Anvelope la revizie', 'iarna', %L, %L)$q$, v_org, v_va, v_azi, v_u_adm, v_u_adm));
  v_ok := v_ok and v_r like '23514%vse_anvelope_ck%';
  if not (v_r like '23514%') then raise warning '  · (6) anvelope la revizie: %', v_r; end if;
  v_r := pg_temp.rul(format($q$insert into public.vehicle_expenses
      (organization_id, vehicle_id, categorie, data_cheltuielii, suma, litri, created_by, updated_by)
      values (%L, %L, 'parcare', %L, 10, 5, %L, %L)$q$, v_org, v_va, v_azi, v_u_adm, v_u_adm));
  v_ok := v_ok and v_r like '23514%vex_litri_ck%';
  if not (v_r like '23514%') then raise warning '  · (6) litri la parcare: %', v_r; end if;
  v_r := pg_temp.rul(format($q$insert into public.vehicle_expenses
      (organization_id, vehicle_id, categorie, data_cheltuielii, suma, created_by, updated_by)
      values (%L, %L, 'parcare', %L, 0, %L, %L)$q$, v_org, v_va, v_azi, v_u_adm, v_u_adm));
  v_ok := v_ok and v_r like '23514%vex_suma_ck%';
  if not (v_r like '23514%') then raise warning '  · (6) suma zero: %', v_r; end if;
  v_r := pg_temp.rul(format($q$insert into public.vehicle_service_plans
      (organization_id, vehicle_id, denumire, baza_data, baza_km, created_by, updated_by)
      values (%L, %L, 'Fără interval', %L, 1, %L, %L)$q$, v_org, v_va, v_azi, v_u_adm, v_u_adm));
  v_ok := v_ok and v_r like '23514%vsp_interval_ck%';
  if not (v_r like '23514%') then raise warning '  · (6) plan fără interval: %', v_r; end if;
  v_r := pg_temp.rul(format($q$insert into public.vehicle_service_plans
      (organization_id, vehicle_id, denumire, interval_luni, baza_data, baza_km, created_by, updated_by)
      values (%L, %L, 'revizie periodică', 6, %L, 1, %L, %L)$q$, v_org, v_va, v_azi, v_u_adm, v_u_adm));
  v_ok := v_ok and v_r like '23505%vsp_vehicul_denumire_uq%';
  if not (v_r like '23505%') then raise warning '  · (6) nume dublat (altă literă): %', v_r; end if;
  reset role;
  if v_ok then
    raise notice '  ✓ (6) CHECK-uri: anvelope doar la „anvelope”, litri doar la combustibil, suma > 0, interval obligatoriu; numele planului unic';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) un CHECK nu a refuzat';
  end if;

  -- (7) Intervenția de tip „anvelope” trece anvelopele pe vehicul (câștigă cea mai recentă).
  perform pg_temp.ca(v_u_adm);
  v_r := pg_temp.rul(format($q$insert into public.vehicle_service_entries
      (organization_id, vehicle_id, data_interventiei, km, tip, descriere, anvelope_montate, cost_piese, created_by, updated_by)
      values (%L, %L, %L, 46600, 'anvelope', 'Montat iarnă', 'iarna', 800, %L, %L)$q$, v_org, v_va, v_azi - 2, v_u_adm, v_u_adm));
  v_r := v_r || '/' || pg_temp.rul(format($q$insert into public.vehicle_service_entries
      (organization_id, vehicle_id, data_interventiei, km, tip, descriere, anvelope_montate, created_by, updated_by)
      values (%L, %L, %L, 44000, 'anvelope', 'Montat vară, mai demult', 'vara', %L, %L)$q$, v_org, v_va, v_azi - 180, v_u_adm, v_u_adm));
  reset role;
  select v.anvelope_montate::text, v.km_curent into v_t, v_k from public.vehicles v where v.id = v_va;
  if v_r = 'ok:1/ok:1' and v_t = 'iarna' and v_k = 46600 then
    raise notice '  ✓ (7) anvelopele montate urmează intervenția cea mai recentă; km_curent urcă la 46.600';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) %, anvelope %, km %', v_r, v_t, v_k;
  end if;

  -- (12) Cheltuielile: administratorul scrie și citește.
  perform pg_temp.ca(v_u_adm);
  v_r := pg_temp.rul(format($q$insert into public.vehicle_expenses
      (organization_id, vehicle_id, categorie, data_cheltuielii, suma, litri, km_bord, numar_document, created_by, updated_by)
      values (%L, %L, 'combustibil_fara_foaie', %L, 300.50, 40, 46550, 'B-77', %L, %L),
             (%L, %L, 'parcare', %L, 15, null, null, null, %L, %L),
             (%L, %L, 'taxa_drum', %L, 28.50, null, null, null, %L, %L)$q$,
      v_org, v_va, v_azi - 3, v_u_adm, v_u_adm,
      v_org, v_va, v_azi - 2, v_u_adm, v_u_adm,
      v_org, v_va, v_azi - 1, v_u_adm, v_u_adm));
  v_n := pg_temp.cate(format('select 1 from public.vehicle_expenses where vehicle_id = %L and deleted_at is null', v_va));
  select sum(suma) into v_n2 from public.vehicle_expenses where vehicle_id = v_va and deleted_at is null;
  select e.id into v_ex1 from public.vehicle_expenses e where e.vehicle_id = v_va and e.categorie = 'parcare';
  reset role;
  if v_r = 'ok:3' and v_n = 3 and v_n2 = 344 then
    raise notice '  ✓ (12) administratorul adaugă și citește 3 cheltuieli (suma 344,00)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (12) insert=%, citite=%, suma=%', v_r, v_n, v_n2;
  end if;

  -- ═══ Drepturile ═══════════════════════════════════════════════════════════

  -- (8) Managerul: VA (a echipei lui) da, VB nu.
  perform pg_temp.ca(v_u_mgr);
  v_n  := pg_temp.cate(format('select 1 from public.vehicle_service_plans where vehicle_id = %L', v_va));
  v_n2 := pg_temp.cate(format('select 1 from public.vehicle_service_plans where vehicle_id = %L', v_vb));
  v_n3 := pg_temp.cate(format('select 1 from public.vehicle_service_entries where vehicle_id = %L', v_va))
        * 100
        + pg_temp.cate(format('select 1 from public.vehicle_service_entries where vehicle_id = %L', v_vb))
        * 10
        + pg_temp.cate(format('select 1 from public.vehicle_expenses where vehicle_id = %L', v_va));
  reset role;
  if v_n = 2 and v_n2 = 0 and v_n3 = 403 then
    raise notice '  ✓ (8) managerul citește planurile (2), intervențiile (4) și cheltuielile (3) mașinii echipei; nimic de pe VB';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) planuri VA=% (2), VB=% (0); intervenții×100+VB×10+cheltuieli = % (403)', v_n, v_n2, v_n3;
  end if;

  -- (9) Șoferul (own), colegul fără mașină, hr: zero rânduri din toate trei.
  v_n := 0;
  foreach v_t in array array[v_u_a::text, v_u_b::text, v_u_hr::text] loop
    perform pg_temp.ca(v_t::uuid);
    v_n := v_n + pg_temp.cate('select 1 from public.vehicle_service_plans')
               + pg_temp.cate('select 1 from public.vehicle_service_entries')
               + pg_temp.cate('select 1 from public.vehicle_expenses');
    reset role;
  end loop;
  if v_n = 0 then
    raise notice '  ✓ (9) șoferul, colegul fără mașină și hr nu citesc niciun plan, nicio intervenție, nicio cheltuială';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) DEZVĂLUIRE: %  rânduri citite de șofer/coleg/hr', v_n;
  end if;

  -- (10) Managerul, șoferul, hr: INSERT refuzat (42501), UPDATE pe zero rânduri.
  v_ok := true;
  foreach v_t in array array[v_u_mgr::text, v_u_a::text, v_u_hr::text] loop
    perform pg_temp.ca(v_t::uuid);
    v_r := pg_temp.rul(format($q$insert into public.vehicle_service_plans
        (organization_id, vehicle_id, denumire, interval_luni, baza_data, baza_km, created_by, updated_by)
        values (%L, %L, 'Plan neavenit', 6, %L, 1, %L, %L)$q$, v_org, v_va, v_azi, v_t::uuid, v_t::uuid));
    v_ok := v_ok and v_r like '42501%';
    v_r := pg_temp.rul(format($q$insert into public.vehicle_expenses
        (organization_id, vehicle_id, categorie, data_cheltuielii, suma, created_by, updated_by)
        values (%L, %L, 'parcare', %L, 5, %L, %L)$q$, v_org, v_va, v_azi, v_t::uuid, v_t::uuid));
    v_ok := v_ok and v_r like '42501%';
    v_r := pg_temp.rul(format($q$insert into public.vehicle_service_entries
        (organization_id, vehicle_id, data_interventiei, km, tip, descriere, created_by, updated_by)
        values (%L, %L, %L, 46700, 'revizie', 'Neavenit', %L, %L)$q$, v_org, v_va, v_azi, v_t::uuid, v_t::uuid));
    v_ok := v_ok and v_r like '42501%';
    v_r := pg_temp.rul(format('update public.vehicle_service_plans set observatii = %L, updated_by = %L where id = %L',
                              'rescris', v_t::uuid, v_p1));
    v_ok := v_ok and v_r = 'ok:0';
    v_r := pg_temp.rul(format('update public.vehicle_expenses set suma = 9999, updated_by = %L where id = %L',
                              v_t::uuid, v_ex1));
    v_ok := v_ok and v_r = 'ok:0';
    reset role;
  end loop;
  select count(*) into v_n from public.vehicle_service_plans where id = v_p1 and observatii is null;
  select suma into v_n2 from public.vehicle_expenses where id = v_ex1;
  if v_ok and v_n = 1 and v_n2 = 15 then
    raise notice '  ✓ (10) managerul, șoferul și hr nu scriu (42501 la INSERT, zero rânduri la UPDATE)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10) FALS-POZITIV: o scriere a trecut (ok=%, plan neatins=%, suma=%)', v_ok, v_n, v_n2;
  end if;

  -- (11) Altă firmă: nu vede, nu scrie.
  perform pg_temp.ca(v_u_adm2);
  v_n := pg_temp.cate('select 1 from public.vehicle_service_plans')
       + pg_temp.cate('select 1 from public.vehicle_service_entries')
       + pg_temp.cate('select 1 from public.vehicle_expenses');
  v_r := pg_temp.rul(format($q$insert into public.vehicle_service_plans
      (organization_id, vehicle_id, denumire, interval_luni, baza_data, baza_km, created_by, updated_by)
      values (%L, %L, 'Plan pe mașina altuia', 6, %L, 1, %L, %L)$q$, v_org, v_va, v_azi, v_u_adm2, v_u_adm2));
  v_ok := v_r like '42501%';
  v_r := pg_temp.rul(format($q$insert into public.vehicle_service_plans
      (organization_id, vehicle_id, denumire, interval_luni, baza_data, baza_km, created_by, updated_by)
      values (%L, %L, 'Plan cu vehicul străin', 6, %L, 1, %L, %L)$q$, v_org2, v_va, v_azi, v_u_adm2, v_u_adm2));
  v_ok := v_ok and v_r like 'P0001: Vehiculul ales nu există%';
  reset role;
  if v_n = 0 and v_ok then
    raise notice '  ✓ (11) altă firmă nu vede nimic; nu scrie nici cu firma ei, nici cu a noastră';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (11) altă firmă: citește % rânduri, refuzuri ok=%', v_n, v_ok;
  end if;

  -- (11b) super_admin: citește, nu scrie.
  perform pg_temp.ca(v_u_sa);
  v_n := pg_temp.cate(format('select 1 from public.vehicle_service_plans where organization_id = %L', v_org))
       + pg_temp.cate(format('select 1 from public.vehicle_service_entries where organization_id = %L', v_org))
       + pg_temp.cate(format('select 1 from public.vehicle_expenses where organization_id = %L', v_org));
  v_r := pg_temp.rul(format($q$insert into public.vehicle_expenses
      (organization_id, vehicle_id, categorie, data_cheltuielii, suma, created_by, updated_by)
      values (%L, %L, 'parcare', %L, 5, %L, %L)$q$, v_org, v_va, v_azi, v_u_sa, v_u_sa));
  v_ok := v_r like '42501%';
  v_r := pg_temp.rul(format('update public.vehicle_service_plans set observatii = %L, updated_by = %L where id = %L',
                            'rescris', v_u_sa, v_p1));
  v_ok := v_ok and v_r = 'ok:0';
  reset role;
  select count(*) into v_n2 from public.vehicle_service_plans where id = v_p1 and observatii is null;
  if v_n > 0 and v_ok and v_n2 = 1 then
    raise notice '  ✓ (11b) super_admin citește (% rânduri) și nu scrie (42501 la INSERT, zero la UPDATE)', v_n;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (11b) super_admin: citește % rânduri, refuzuri ok=%, plan neatins=%', v_n, v_ok, v_n2;
  end if;

  -- ═══ Vizibilitatea în expirables ══════════════════════════════════════════

  -- (13) `poate_vedea_expirabil` rescrisă complet.
  perform pg_temp.ca(v_u_adm);
  select count(*) filter (where app.poate_vedea_expirabil(v_org, t.tip)),
         count(*)
    into v_n, v_n2
    from unnest(array['medical_exam', 'employee_document', 'work_permit', 'employment_contract',
                      'vehicle_document', 'vehicle_service', 'equipment', 'fire_extinguisher', 'ssm_training',
                      'environmental_permit', 'inventory_item', 'iscir_authorization', 'maintenance_plan',
                      'personnel_authorization', 'ppe_issuance']) as t(tip);
  v_ok := app.poate_vedea_expirabil(v_org, 'tip_necunoscut') = false;
  reset role;
  perform pg_temp.ca(v_u_mgr);
  v_ok := v_ok and app.poate_vedea_expirabil(v_org, 'vehicle_service')
               and app.poate_vedea_expirabil(v_org, 'vehicle_document');
  reset role;
  perform pg_temp.ca(v_u_a);
  v_ok := v_ok and not app.poate_vedea_expirabil(v_org, 'vehicle_service');
  reset role;
  perform pg_temp.ca(v_u_hr);
  v_ok := v_ok and not app.poate_vedea_expirabil(v_org, 'vehicle_service');
  reset role;
  v_ok := v_ok and pg_get_functiondef('app.poate_vedea_expirabil(uuid, text)'::regprocedure)
                   not like '%''employees'', ''read'', ''own''%';
  if v_n = 15 and v_n2 = 15 and v_ok then
    raise notice '  ✓ (13) poate_vedea_expirabil: toate cele 15 ramuri pentru administrator, vehicle_service pentru manager, nu pentru șofer/hr';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (13) ramuri adevărate pentru admin: %/% (15), restul ok=%', v_n, v_n2, v_ok;
  end if;

  -- (14) Rândurile din expirables: doar administratorul (compliance:read = all).
  select count(*) into v_n3 from public.expirables where organization_id = v_org and entity_type = 'vehicle_service' and deleted_at is null;
  v_n := 0;
  perform pg_temp.ca(v_u_adm);
  v_n2 := pg_temp.cate(format($q$select 1 from public.expirables where organization_id = %L and entity_type = 'vehicle_service'$q$, v_org));
  reset role;
  foreach v_t in array array[v_u_a::text, v_u_b::text, v_u_hr::text, v_u_adm2::text] loop
    perform pg_temp.ca(v_t::uuid);
    v_n := v_n + pg_temp.cate(format($q$select 1 from public.expirables where organization_id = %L and entity_type = 'vehicle_service'$q$, v_org));
    reset role;
  end loop;
  if v_n2 = v_n3 and v_n3 >= 1 and v_n = 0 then
    raise notice '  ✓ (14) scadențele de service din expirables le vede administratorul (%), nu șoferul, hr sau altă firmă', v_n2;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (14) administrator %/% rânduri, ceilalți % (așteptat 0)', v_n2, v_n3, v_n;
  end if;

  -- ═══ Ciclul de viață ══════════════════════════════════════════════════════

  -- (15) Plan oprit / repornit; vehicul vândut.
  perform pg_temp.ca(v_u_adm);
  insert into public.vehicle_service_plans
    (organization_id, vehicle_id, denumire, interval_luni, baza_data, baza_km, created_by, updated_by)
  values (v_org, v_va, 'Revizie aer condiționat', 12, v_azi - 340, 46500, v_u_adm, v_u_adm)
  returning id into v_p3;
  insert into public.vehicle_service_plans
    (organization_id, vehicle_id, denumire, interval_luni, baza_data, baza_km, created_by, updated_by)
  values (v_org, v_vs, 'Revizie Sandero', 12, v_azi - 340, 9000, v_u_adm, v_u_adm)
  returning id into v_ps;
  reset role;
  select count(*) into v_n from public.expirables x
   where x.organization_id = v_org and x.kind = 'plan_' || replace(v_p3::text, '-', '') and x.deleted_at is null;
  perform pg_temp.ca(v_u_adm);
  v_r := pg_temp.rul(format('update public.vehicle_service_plans set activ = false, updated_by = %L where id = %L', v_u_adm, v_p3));
  reset role;
  select count(*) into v_n2 from public.expirables x
   where x.organization_id = v_org and x.kind = 'plan_' || replace(v_p3::text, '-', '') and x.deleted_at is null;
  perform pg_temp.ca(v_u_adm);
  v_r := v_r || '/' || pg_temp.rul(format('update public.vehicle_service_plans set activ = true, updated_by = %L where id = %L', v_u_adm, v_p3));
  reset role;
  select count(*) into v_n3 from public.expirables x
   where x.organization_id = v_org and x.kind = 'plan_' || replace(v_p3::text, '-', '') and x.deleted_at is null;
  update public.vehicles set status = 'vandut', motiv_iesire = 'proba' where id = v_vs;
  select count(*) into v_k from public.expirables x
   where x.organization_id = v_org and x.kind = 'plan_' || replace(v_ps::text, '-', '')
     and x.deleted_at is null and not x.is_active;
  perform pg_temp.ca(v_u_adm);
  v_t := pg_temp.rul(format($q$insert into public.vehicle_service_plans
      (organization_id, vehicle_id, denumire, interval_luni, baza_data, baza_km, created_by, updated_by)
      values (%L, %L, 'Plan pe vehicul vândut', 6, %L, 1, %L, %L)$q$, v_org, v_vs, v_azi, v_u_adm, v_u_adm));
  reset role;
  if v_n = 1 and v_n2 = 0 and v_n3 = 1 and v_r = 'ok:1/ok:1' and v_k = 1
     and v_t like 'P0001: Vehiculul a ieșit din parc%' then
    raise notice '  ✓ (15) planul oprit scoate scadența, repornit o readuce; vehiculul vândut o face inactivă și nu mai primește planuri';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (15) deschis=% oprit=% repornit=% (1/0/1), update=%, inactiv pe vândut=%, plan pe vândut: %',
      v_n, v_n2, v_n3, v_r, v_k, v_t;
  end if;

  -- ═══ Jobul zilnic ═════════════════════════════════════════════════════════

  -- (16) Scadența pe dată: P3 e scadent peste ~26 de zile (prag 30).
  perform internal.genereaza_alerte(v_org);
  v_n := internal.flota_rezumat(v_org);
  select count(*), min(title), min(body), min(link) into v_n2, v_titlu, v_corp, v_link
    from public.notifications where organization_id = v_org and user_id = v_u_adm;
  select count(*), min(link) into v_n3, v_t from public.notifications where organization_id = v_org and user_id = v_u_a;
  if v_n2 = 1 and v_titlu = 'Flota: 1 lucrare de service în curând.'
     and v_corp like '· Revizie aer condiționat — ' || v_nr_va || ': scadent pe %'
     and v_link = '/flota/' || v_va::text || '?fila=service'
     and v_n3 = 1 and v_t = '/portal/masina-mea'
     and internal.flota_rezumat(v_org) = 0 then
    raise notice '  ✓ (16) rezumat de service pe dată: administratorul spre fila service, șoferul spre portal; a doua rulare nu scrie nimic';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (16) admin % notificări, „%”, corp „%”, link %; șofer % spre %', v_n2, v_titlu, v_corp, v_link, v_n3, v_t;
  end if;

  -- (17) Alerta pe kilometri. P1: ținta 50.000 km, avertizare la 49.000.
  select count(*) into v_n2 from public.notifications where organization_id = v_org;
  update public.vehicles set km_curent = 48000 where id = v_va;
  v_n := internal.flota_memento_service(v_org);                      -- prea devreme
  update public.vehicles set km_curent = 49500 where id = v_va;
  v_k := internal.flota_memento_service(v_org);                      -- „aproape”: admin + șofer
  select min(title), min(body), min(link) into v_titlu, v_corp, v_link
    from public.notifications
   where organization_id = v_org and user_id = v_u_adm and created_at > now() - interval '1 minute'
     and title like '%aproape de scadență%';
  v_n3 := internal.flota_memento_service(v_org);                     -- a doua rulare
  if v_n = 0 and v_k = 2 and v_n3 = 0
     and v_titlu = 'Flota: 1 lucrare de service aproape de scadență.'
     and v_corp = '· Revizie periodică — ' || v_nr_va || ': la 50.000 km (acum 49.500 km)'
     and v_link = '/flota/' || v_va::text || '?fila=service' then
    raise notice '  ✓ (17a) alerta „aproape” pleacă o dată (admin + șofer), nu înainte de prag, nu a doua oară';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (17a) devreme=%, aproape=% (2), repetat=% (0), titlu „%”, corp „%”, link %', v_n, v_k, v_n3, v_titlu, v_corp, v_link;
  end if;

  update public.vehicles set km_curent = 50100 where id = v_va;
  v_k := internal.flota_memento_service(v_org);                      -- „depășit”
  select min(body) into v_corp from public.notifications
   where organization_id = v_org and user_id = v_u_adm and title like '%depășită la km%';
  v_n3 := internal.flota_memento_service(v_org);
  select count(*) into v_n from internal.flota_mementouri
   where vehicle_id = v_va and tip in ('service_km_aproape', 'service_km_depasit');
  if v_k = 2 and v_n3 = 0 and v_n = 2
     and v_corp = '· Revizie periodică — ' || v_nr_va || ': scadent la 50.000 km, acum 50.100 km' then
    raise notice '  ✓ (17b) „depășit” pleacă o dată; dedup-ul ține două rânduri pe ciclu';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (17b) depășit=% (2), repetat=% (0), rânduri dedup=% (2), corp „%”', v_k, v_n3, v_n, v_corp;
  end if;

  -- După intervenția de la 50.100 km ținta se mută la 60.100 și ciclul se reia.
  perform pg_temp.ca(v_u_adm);
  insert into public.vehicle_service_entries
    (organization_id, vehicle_id, plan_id, data_interventiei, km, tip, descriere, created_by, updated_by)
  values (v_org, v_va, v_p1, v_azi, 50100, 'revizie', 'Revizia la 50.000', v_u_adm, v_u_adm);
  reset role;
  select p.urmatorii_km into v_k from public.vehicle_service_plans p where p.id = v_p1;
  v_n := internal.flota_memento_service(v_org);                      -- 50.100 < 59.100
  update public.vehicles set km_curent = 59500 where id = v_va;
  v_n2 := internal.flota_memento_service(v_org);                     -- ciclu nou: „aproape”
  v_n3 := internal.flota_memento_service(v_org);
  if v_k = 60100 and v_n = 0 and v_n2 = 2 and v_n3 = 0 then
    raise notice '  ✓ (17c) după intervenție ținta devine 60.100 și ciclul se reia (alertă nouă la 59.500)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (17c) ținta=% (60100), după intervenție=% (0), la 59.500=% (2), repetat=% (0)', v_k, v_n, v_n2, v_n3;
  end if;

  -- (18) Memento-ul de anvelope: doar noiembrie, o dată pe an, doar anvelope de vară.
  update public.vehicles set anvelope_montate = 'vara' where id = v_va;
  v_n := internal.flota_memento_service(v_org, date '2026-10-20');
  v_n2 := internal.flota_memento_service(v_org, date '2026-11-10');
  select min(title), min(body), min(link) into v_titlu, v_corp, v_link
    from public.notifications
   where organization_id = v_org and user_id = v_u_adm and title like '%anvelope de vară%';
  v_n3 := internal.flota_memento_service(v_org, date '2026-11-20');
  v_k := internal.flota_memento_service(v_org, date '2027-11-05');
  update public.vehicles set anvelope_montate = 'iarna' where id = v_va;
  select internal.flota_memento_service(v_org, date '2028-11-05') into v_tip;
  if v_n = 0 and v_n2 = 2 and v_n3 = 0 and v_k = 2 and v_tip = '0'
     and v_titlu = 'Flota: 1 vehicul cu anvelope de vară.'
     and v_corp = '· Anvelope de vară montate pe ' || v_nr_va || ': treceți pe iarnă'
     and v_link = '/flota/' || v_va::text then
    raise notice '  ✓ (18) anvelopele de vară: nimic în octombrie, o dată în noiembrie, din nou anul următor; cu anvelope de iarnă nimic';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (18) octombrie=% (0), noiembrie=% (2), repetat=% (0), anul următor=% (2), iarnă=% (0), titlu „%”, corp „%”, link %',
      v_n, v_n2, v_n3, v_k, v_tip, v_titlu, v_corp, v_link;
  end if;

  -- (19) Jobul întreg raportează memento-urile și nu eșuează pe nicio firmă.
  v_rap := internal.conformitate_zilnica();
  if v_rap ? 'mementouri' and (v_rap ->> 'firme_esuate')::int = 0 then
    raise notice '  ✓ (19) conformitate_zilnica raportează mementouri și nu eșuează pe nicio firmă (%)', v_rap;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (19) raportul jobului: %', v_rap;
  end if;

  -- (20) Tipul `revizie` e retras pe platformă.
  select count(*) into v_n from public.vehicle_document_types
   where organization_id is null and cod = 'revizie' and deleted_at is null and not activ;
  select count(*) into v_n2 from public.vehicle_document_types
   where organization_id is null and cod = 'revizie' and deleted_at is null and activ;
  if v_n = 1 and v_n2 = 0 then
    raise notice '  ✓ (20) tipul de document revizie e retras pe platformă';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (20) revizie: % retras, % activ', v_n, v_n2;
  end if;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA FLOTA SERVICE: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE verificările au trecut.';
  raise notice '';
end;
$$;
