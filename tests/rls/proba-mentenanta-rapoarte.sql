-- tests/rls/proba-mentenanta-rapoarte.sql
--
-- RAPORTUL DE MENTENANȚĂ (M8), PE ROLURI: CE AJUNGE ÎN CALCUL.
--
-- ── DE CE EXISTĂ FIȘIERUL ───────────────────────────────────────────────────
-- M8 nu are migrare: raportul citește tabelele modulului cu politicile lor de
-- azi (0011, 0181–0193). Dar un raport e o AGREGARE, iar o agregare peste
-- rânduri lipsă arată corect — „Cost suportat: 0 lei” e o cifră, nu o eroare.
-- Testele aplicației rulează pe un client fals și nu văd politicile; ce rânduri
-- primește fiecare rol se AFLĂ rulând, cu EXACT coloanele cerute de
-- `src/lib/queries/maintenance-rapoarte.ts` și `setariMentenanta`.
--
-- ── CE VERIFICĂ, PE RÂND ────────────────────────────────────────────────────
--  (1) org_admin primește tot: parc, intervenții, execuții, planuri,
--      sesizări, opriri, setări                                        [POZITIVĂ]
--  (2) manager (`maintenance:read` team): parcul, intervențiile, planurile,
--      opririle și setările întregi; DOAR sesizările echipei lui        [POZITIVĂ]
--  (3) hr: nimic — modulul nu-i aparține
--  (4) employee raportor: doar sesizarea lui; niciun cost, niciun parc
--  (5) firma B nu vede nimic din firma A, nici ca org_admin
--  (6) suprapunerea opririlor pe perioadă (predicatul din `opririInPerioada`)
--      prinde oprirea începută înainte și pe cea încă deschisă, nu și pe cea
--      încheiată înainte de început                                     [POZITIVĂ]
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org      uuid := gen_random_uuid();
  v_org_b    uuid := gen_random_uuid();
  v_u_adm    uuid := gen_random_uuid();
  v_u_mgr    uuid := gen_random_uuid();
  v_u_hr     uuid := gen_random_uuid();
  v_u_sub    uuid := gen_random_uuid();  -- employee din echipa managerului
  v_u_str    uuid := gen_random_uuid();  -- employee din afara echipei
  v_u_adm_b  uuid := gen_random_uuid();
  v_e_adm    uuid := gen_random_uuid();
  v_e_mgr    uuid := gen_random_uuid();
  v_e_sub    uuid := gen_random_uuid();
  v_e_str    uuid := gen_random_uuid();
  v_echip    uuid := gen_random_uuid();
  v_plan     uuid := gen_random_uuid();
  v_azi      date := app.azi_local();
  v_inceput  timestamptz;
  v_sfarsit  timestamptz;
  v_rol      record;
  v_ech      int;
  v_int      int;
  v_exe      int;
  v_pla      int;
  v_ses      int;
  v_opr      int;
  v_set      int;
  v_n        int;
  v_esecuri  int := 0;
begin
  raise notice '';
  raise notice '  PROBA „RAPORTUL DE MENTENANȚĂ PE ROLURI" (M8)';
  raise notice '  ─────────────────────────────────────────────────────────';

  -- ── fixture ───────────────────────────────────────────────────────────────
  insert into public.organizations (id, slug, name, cui) values
    (v_org,   'proba-rap-'  || v_sufix, 'Proba Rapoarte SRL',
     'RO' || (86000000 + (random() * 900000)::int)::text),
    (v_org_b, 'proba-rapb-' || v_sufix, 'Proba Rapoarte B SRL',
     'RO' || (85000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select o, f.feature_key, true, now() from public.features f, unnest(array[v_org, v_org_b]) o;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_adm,   'rap-adm-'  || v_sufix || '@proba.test', now()),
    (v_u_mgr,   'rap-mgr-'  || v_sufix || '@proba.test', now()),
    (v_u_hr,    'rap-hr-'   || v_sufix || '@proba.test', now()),
    (v_u_sub,   'rap-sub-'  || v_sufix || '@proba.test', now()),
    (v_u_str,   'rap-str-'  || v_sufix || '@proba.test', now()),
    (v_u_adm_b, 'rap-admb-' || v_sufix || '@proba.test', now());
  -- Fișele ÎNAINTEA membrilor (0083 creează una pentru orice org_admin fără).
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_adm, v_org, 'RP-A', 'Ana',    'Admin',   v_azi - 900, 'activ', v_u_adm, null),
    (v_e_mgr, v_org, 'RP-M', 'Mihai',  'Manager', v_azi - 800, 'activ', v_u_mgr, null),
    (v_e_sub, v_org, 'RP-S', 'Sorin',  'Subaltern', v_azi - 700, 'activ', v_u_sub, v_e_mgr),
    (v_e_str, v_org, 'RP-X', 'Xenia',  'Străină', v_azi - 600, 'activ', v_u_str, null);
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org,   v_u_adm,   'org_admin'),
    (v_org,   v_u_mgr,   'manager'),
    (v_org,   v_u_hr,    'hr'),
    (v_org,   v_u_sub,   'employee'),
    (v_org,   v_u_str,   'employee'),
    (v_org_b, v_u_adm_b, 'org_admin');

  insert into public.equipment (id, organization_id, cod, denumire, valoare_achizitie)
  values (v_echip, v_org, 'RAP-' || v_sufix, 'Compresor de raport', 20000);
  insert into public.maintenance_settings (organization_id, cost_ora_oprire)
  values (v_org, 150);
  insert into public.maintenance_plans (id, organization_id, equipment_id, denumire, periodicitate_zile)
  values (v_plan, v_org, v_echip, 'Revizie lunară', 30);
  insert into public.maintenance_interventions
    (organization_id, plan_id, equipment_id, data, descriere, executant_employee_id, rezultat, cost_manopera)
  values (v_org, v_plan, v_echip, v_azi - 40, 'Revizie.', v_e_adm, 'reusita', 300),
         (v_org, v_plan, v_echip, v_azi - 10, 'Revizie.', v_e_adm, 'reusita', 300);
  insert into public.fault_reports (organization_id, equipment_id, raportat_de_employee_id, descriere)
  values (v_org, v_echip, v_e_sub, 'Compresorul face zgomot la pornire.'),
         (v_org, v_echip, v_e_str, 'Manometrul arată greșit.');
  -- Trei opriri: una începută înainte de perioadă și încheiată în ea, una încă
  -- deschisă și una încheiată înainte de perioadă (care NU trebuie să intre).
  insert into public.equipment_opriri (organization_id, equipment_id, inceput, sfarsit, tip) values
    (v_org, v_echip, now() - interval '35 days', now() - interval '28 days', 'neplanificata'),
    (v_org, v_echip, now() - interval '40 days', now() - interval '35 days', 'planificata');
  -- Oprirea încă deschisă: fără sfârșit.
  insert into public.equipment_opriri (organization_id, equipment_id, inceput, tip)
  values (v_org, v_echip, now() - interval '2 days', 'neplanificata');

  -- Perioada raportului: ultimele 30 de zile, ca momente (`momentInceputZi`).
  v_inceput := (v_azi - 30)::timestamp at time zone 'Europe/Bucharest';
  v_sfarsit := (v_azi + 1)::timestamp at time zone 'Europe/Bucharest';

  -- ═══ (1)–(5) Ce citește fiecare rol ══════════════════════════════════════
  for v_rol in
    select * from (values
      ('(1) org_admin',      v_u_adm,   1, 2, 2, 1, 2, 2, 1),
      ('(2) manager',        v_u_mgr,   1, 2, 2, 1, 1, 2, 1),
      ('(3) hr',             v_u_hr,    0, 0, 0, 0, 0, 0, 0),
      ('(4) employee',       v_u_sub,   0, 0, 0, 0, 1, 0, 0),
      ('(5) org_admin B',    v_u_adm_b, 0, 0, 0, 0, 0, 0, 0)
    ) as r(eticheta, utilizator, ech, int_, exe, pla, ses, opr, set_)
  loop
    perform set_config('request.jwt.claim.sub', v_rol.utilizator::text, true);
    set local role authenticated;
    begin
      select count(*) into v_ech from (
        select id, cod, denumire, valoare_achizitie, casat_la, data_punerii_in_functiune
          from public.equipment where organization_id = v_org and deleted_at is null) x;
      select count(*) into v_int from (
        select id, equipment_id, data, tip, rezultat, cost_total, acoperit_de_garantie, executant_extern, plan_id
          from public.maintenance_interventions
         where organization_id = v_org and deleted_at is null
           and data between v_azi - 395 and v_azi) x;
      select count(*) into v_exe from (
        select id, plan_id, data, citire_contor
          from public.maintenance_interventions
         where organization_id = v_org and deleted_at is null
           and plan_id is not null and rezultat = 'reusita' and data <= v_azi) x;
      select count(*) into v_pla from (
        select id, equipment_id, denumire, tip, activ, periodicitate_zile, periodicitate_contor,
               numar_amanari, urmatoarea_scadenta, tip_contor, urmatoarea_scadenta_contor,
               mod_calcul, data_ancora, amanat_pana
          from public.maintenance_plans where organization_id = v_org and deleted_at is null) x;
      select count(*) into v_ses from (
        select id, equipment_id, raportat_la, atribuit_la, rezolvat_la, status
          from public.fault_reports
         where organization_id = v_org and deleted_at is null
           and raportat_la >= v_inceput - interval '365 days' and raportat_la < v_sfarsit) x;
      select count(*) into v_opr from (
        select id, equipment_id, inceput, sfarsit, tip
          from public.equipment_opriri
         where organization_id = v_org and deleted_at is null
           and inceput < v_sfarsit and (sfarsit is null or sfarsit >= v_inceput)) x;
      select count(*) into v_set from (
        select id, ore_functionare_pe_zi, zile_pe_saptamana, cost_ora_oprire, prag_contor_necitit_zile
          from public.maintenance_settings where organization_id = v_org and deleted_at is null) x;
      reset role;
      if (v_ech, v_int, v_exe, v_pla, v_ses, v_opr, v_set)
         = (v_rol.ech, v_rol.int_, v_rol.exe, v_rol.pla, v_rol.ses, v_rol.opr, v_rol.set_) then
        raise notice '  ✓ % citește: parc %, intervenții %, execuții %, planuri %, sesizări %, opriri %, setări %',
          v_rol.eticheta, v_ech, v_int, v_exe, v_pla, v_ses, v_opr, v_set;
      else
        v_esecuri := v_esecuri + 1;
        raise warning '  ✗ % citește (%, %, %, %, %, %, %), așteptat (%, %, %, %, %, %, %)',
          v_rol.eticheta, v_ech, v_int, v_exe, v_pla, v_ses, v_opr, v_set,
          v_rol.ech, v_rol.int_, v_rol.exe, v_rol.pla, v_rol.ses, v_rol.opr, v_rol.set_;
      end if;
    exception when others then
      reset role;
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ % nu a putut citi raportul: % (%)', v_rol.eticheta, sqlerrm, sqlstate;
    end;
  end loop;

  -- ═══ (6) Suprapunerea opririlor [POZITIVĂ] ═══════════════════════════════
  select count(*) into v_n from public.equipment_opriri
   where organization_id = v_org and deleted_at is null
     and inceput < v_sfarsit and (sfarsit is null or sfarsit >= v_inceput)
     and (sfarsit is null or inceput < v_inceput);
  if v_n = 2 then
    raise notice '  ✓ (6) suprapunerea prinde oprirea începută înainte și pe cea deschisă, nu și pe cea încheiată înainte';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) suprapunerea a prins % opriri din cele două așteptate', v_n;
  end if;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'Proba raportului de mentenanță: % verificări picate.', v_esecuri;
  end if;
  raise notice '  Toate verificările au trecut.';
end $$;
