-- tests/rls/proba-aprobatori-membru.sql
--
-- APROBATORII, DUPLICATELE ȘI LUNA KPI PROPRIE, DUPĂ 0188–0190.
--
-- ── CE VERIFICĂ, PE RÂND ────────────────────────────────────────────────────
-- (1) managerul direct e candidat la aprobarea pontajului           [POZITIVĂ];
-- (2) un rând de MEMBRU cu `attendance:approve = none` îl scoate (0189);
-- (3) un rând de membru cu `all` pe un simplu angajat îl adaugă     [POZITIVĂ];
-- (4) patronul e candidat pe pasul `permisiune` al concediilor      [POZITIVĂ];
-- (5) rândul de membru `none` pe patron îl scoate și de acolo;
-- (6) la rezolvarea bug-ului, autorul duplicatului primește linkul spre
--     DUPLICATUL lui, nu spre părinte (0188)                        [POZITIVĂ];
-- (7) managerul își vede propria lună KPI (0190)                    [POZITIVĂ];
-- (8) dar nu și-o poate modifica (UPDATE cu zero rânduri);
-- (9) luna subordonatului o vede în continuare                      [POZITIVĂ].
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org      uuid := gen_random_uuid();
  v_u_patron uuid := gen_random_uuid();
  v_u_mgr    uuid := gen_random_uuid();
  v_u_ang    uuid := gen_random_uuid();
  v_u_strain uuid := gen_random_uuid();
  v_e_patron uuid;
  v_e_mgr    uuid := gen_random_uuid();
  v_e_ang    uuid := gen_random_uuid();
  v_e_strain uuid := gen_random_uuid();
  v_m_patron uuid;
  v_m_mgr    uuid;
  v_m_strain uuid;
  v_flux     uuid;
  v_pas      uuid := gen_random_uuid();
  v_parinte  uuid := gen_random_uuid();
  v_duplicat uuid := gen_random_uuid();
  v_set      uuid := gen_random_uuid();
  v_luna_mgr uuid := gen_random_uuid();
  v_luna_ang uuid := gen_random_uuid();
  v_link     text;
  v_entitate uuid;
  v_n        int;
  v_atinse   int;
  v_esecuri  int := 0;
begin
  raise notice '';
  raise notice '  PROBA „APROBATORI PE MEMBRU, DUPLICATE, LUNA KPI PROPRIE" (0188–0190)';
  raise notice '  ─────────────────────────────────────────────────────────';

  -- ── fixture ───────────────────────────────────────────────────────────────
  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-aprob-' || v_sufix, 'Proba Aprobatori SRL',
     'RO' || (87000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select v_org, f.feature_key, true, now() from public.features f;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_patron, 'ap-pat-' || v_sufix || '@proba.test', now()),
    (v_u_mgr,    'ap-mgr-' || v_sufix || '@proba.test', now()),
    (v_u_ang,    'ap-ang-' || v_sufix || '@proba.test', now()),
    (v_u_strain, 'ap-str-' || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_patron, 'org_admin'), (v_org, v_u_mgr, 'manager'),
    (v_org, v_u_ang, 'employee'), (v_org, v_u_strain, 'employee');
  select id into v_m_patron from public.organization_members where user_id = v_u_patron;
  select id into v_m_mgr    from public.organization_members where user_id = v_u_mgr;
  select id into v_m_strain from public.organization_members where user_id = v_u_strain;

  -- Patron → manager → angajat; străinul e în afara lanțului. Managerul are
  -- funcția „Operator", ca setul KPI de mai jos să i se aplice. Patronul își
  -- primește fișa AUTOMAT la înrolarea ca org_admin (0083), deci se refolosește.
  select e.id into v_e_patron
    from public.employees e
   where e.organization_id = v_org and e.user_id = v_u_patron and e.deleted_at is null
   limit 1;
  update public.employees set status = 'activ', functie = 'Director' where id = v_e_patron;
  insert into public.employees (id, organization_id, marca, first_name, last_name, functie,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_mgr,    v_org, 'AP-M', 'Mihai', 'Manager',  'Operator', app.azi_local() - 500, 'activ', v_u_mgr,    v_e_patron),
    (v_e_ang,    v_org, 'AP-A', 'Ana',   'Angajat',  'Operator', app.azi_local() - 400, 'activ', v_u_ang,    v_e_mgr),
    (v_e_strain, v_org, 'AP-S', 'Sorin', 'Strain',   'Operator', app.azi_local() - 200, 'activ', v_u_strain, null);

  -- ═══ (1) managerul direct e candidat la pontaj [POZITIVĂ] ══════════════════
  select count(*) into v_n
    from internal.rezolva_aprobator_pontaj(v_org, v_e_ang) c
   where c.user_id = v_u_mgr;
  if v_n = 1 then
    raise notice '  ✓ (1) managerul direct e candidat la aprobarea pontajului';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) managerul direct lipsește dintre candidați (%)', v_n;
  end if;

  -- ═══ (2) rândul de membru `none` îl scoate ═════════════════════════════════
  insert into public.role_permissions (organization_id, member_id, role, resource, action, scope)
  values (v_org, v_m_mgr, 'manager', 'attendance', 'approve', 'none');
  select count(*) into v_n
    from internal.rezolva_aprobator_pontaj(v_org, v_e_ang) c
   where c.user_id = v_u_mgr;
  if v_n = 0 then
    raise notice '  ✓ (2) rândul de membru `attendance:approve = none` îl scoate pe manager';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) managerul rămâne candidat deși rândul lui de membru spune `none`';
  end if;

  -- ═══ (3) rândul de membru `all` pe un angajat îl adaugă [POZITIVĂ] ═════════
  insert into public.role_permissions (organization_id, member_id, role, resource, action, scope)
  values (v_org, v_m_strain, 'employee', 'attendance', 'approve', 'all');
  select count(*) into v_n
    from internal.rezolva_aprobator_pontaj(v_org, v_e_ang) c
   where c.user_id = v_u_strain;
  if v_n = 1 then
    raise notice '  ✓ (3) rândul de membru `all` face dintr-un angajat un aprobator';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) angajatul cu rând de membru `all` nu e candidat (%)', v_n;
  end if;

  -- ═══ (4) patronul pe pasul `permisiune` al concediilor [POZITIVĂ] ══════════
  -- Fluxul de concedii există deja: îl creează `seed_leave_defaults` la
  -- înrolarea firmei (unic pe organizație). Pasul de probă intră în el.
  select f.id into v_flux
    from public.approval_flows f
   where f.organization_id = v_org and f.entity_type = 'leave_request'
     and f.activ and f.deleted_at is null
   limit 1;
  insert into public.approval_steps (id, organization_id, flow_id, ordine, tip, permission_key)
  values (v_pas, v_org, v_flux, 19, 'permisiune', 'leave:approve');
  select count(*) into v_n
    from internal.rezolva_aprobatori(v_org, v_pas, v_e_ang) c
   where c.user_id = v_u_patron;
  if v_n = 1 then
    raise notice '  ✓ (4) patronul (leave:approve = all) e candidat pe pasul de permisiune';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) patronul lipsește de pe pasul de permisiune (%)', v_n;
  end if;

  -- ═══ (5) rândul de membru `none` pe patron îl scoate și de aici ════════════
  insert into public.role_permissions (organization_id, member_id, role, resource, action, scope)
  values (v_org, v_m_patron, 'org_admin', 'leave', 'approve', 'none');
  select count(*) into v_n
    from internal.rezolva_aprobatori(v_org, v_pas, v_e_ang) c
   where c.user_id = v_u_patron;
  if v_n = 0 then
    raise notice '  ✓ (5) rândul de membru `leave:approve = none` îl scoate pe patron';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) patronul rămâne candidat deși rândul lui de membru spune `none`';
  end if;
  delete from public.role_permissions where member_id = v_m_patron;

  -- ═══ (6) bug rezolvat → autorul duplicatului primește DUPLICATUL [POZITIVĂ] ═
  insert into public.tickets (id, organization_id, numar_afisat, tip, titlu, descriere,
                              modul, pasi_efectuati, rezultat_asteptat, rezultat_obtinut,
                              solicitant_employee_id, created_by, updated_by) values
    (v_parinte,  v_org, 'IT-2026-910001', 'bug_erp', 'Butonul nu salvează', 'Descriere.',
     'Pontaj', 'Am apăsat.', 'Se salvează.', 'Nu se salvează.', v_e_ang, v_u_ang, v_u_ang),
    (v_duplicat, v_org, 'IT-2026-910002', 'bug_erp', 'Nu merge salvarea', 'Descriere.',
     'Pontaj', 'Am apăsat.', 'Se salvează.', 'Nu se salvează.', v_e_strain, v_u_strain, v_u_strain);

  -- Marcarea ca duplicat și tranzițiile se fac ca patronul (`tickets:update =
  -- all`): `tickets_pazeste_campurile` refuză `parent_ticket_id` oricui altcuiva.
  perform set_config('request.jwt.claim.sub', v_u_patron::text, true);
  set local role authenticated;
  update public.tickets set parent_ticket_id = v_parinte where id = v_duplicat;
  update public.tickets set status = 'in_lucru' where id = v_parinte;
  update public.tickets set status = 'rezolvat' where id = v_parinte;
  reset role;

  select n.link, n.entity_id into v_link, v_entitate
    from public.notifications n
   where n.user_id = v_u_strain and n.organization_id = v_org
     and n.title like 'Problema raportată a fost rezolvată%'
   order by n.created_at desc limit 1;
  if v_link = '/ticketing/' || v_duplicat::text and v_entitate = v_duplicat then
    raise notice '  ✓ (6) autorul duplicatului e trimis la DUPLICATUL lui, nu la părinte';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) linkul duplicatului e % (entitate %), așteptat /ticketing/%',
      v_link, v_entitate, v_duplicat;
  end if;

  -- ═══ (7)–(9) luna KPI proprie a managerului ════════════════════════════════
  insert into public.kpi_seturi (id, organization_id, functie, denumire)
  values (v_set, v_org, 'Operator', 'Set operator');
  insert into public.kpi_evaluari_lunare (id, organization_id, employee_id, set_id, an, luna, status)
  values (v_luna_mgr, v_org, v_e_mgr, v_set, 2026, 9, 'draft'),
         (v_luna_ang, v_org, v_e_ang, v_set, 2026, 9, 'draft');

  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  select count(*) into v_n from public.kpi_evaluari_lunare where id = v_luna_mgr;
  if v_n = 1 then
    raise notice '  ✓ (7) managerul își vede propria lună KPI';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) managerul nu-și vede propria lună KPI';
  end if;

  update public.kpi_evaluari_lunare set concluzie = 'scris de mine' where id = v_luna_mgr;
  get diagnostics v_atinse = row_count;
  if v_atinse = 0 then
    raise notice '  ✓ (8) managerul nu-și poate modifica propria lună (zero rânduri)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) managerul și-a modificat propria lună KPI';
  end if;

  select count(*) into v_n from public.kpi_evaluari_lunare where id = v_luna_ang;
  if v_n = 1 then
    raise notice '  ✓ (9) luna subordonatului se vede în continuare';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) luna subordonatului nu se mai vede';
  end if;
  reset role;

  if v_esecuri > 0 then
    raise exception 'proba-aprobatori-membru: % verificări picate', v_esecuri;
  end if;
  raise notice '  toate verificările au trecut';
end $$;
