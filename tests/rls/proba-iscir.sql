-- tests/rls/proba-iscir.sql
--
-- AUTORIZAȚIILE ISCIR (0193): REGIM, SUSPENDARE, REÎNNOIRE, ȘTERGERE, IZOLARE.
--
-- ── DE CE EXISTĂ FIȘIERUL ───────────────────────────────────────────────────
-- Cine poate scrie ce se AFLĂ rulând, nu deducând. Jumătate din verificări sunt
-- POZITIVE: o reînnoire refuzată pe numărul păstrat (indexul parțial) arată, din
-- afară, exact ca o regulă — dar e o pană.
--
-- ── CE VERIFICĂ, PE RÂND ────────────────────────────────────────────────────
--  (1) administratorul înregistrează o autorizație cu număr; managerul,
--      angajatul și hr sunt refuzați (42501)                          [POZITIVĂ]
--  (2) regimul `neinregistrat_rsvti` fără număr trece; `inregistrat` fără
--      număr cade pe CHECK (23514)                                    [POZITIVĂ]
--  (3) registrul primește doar autorizația înregistrată, nu evidența RSVTI
--  (4) suspendarea cere motiv și nu are dată în viitor; scoate rândul din
--      `expirables`; ridicarea pune `reactivata_la = azi`             [POZITIVĂ]
--  (5) reînnoirea prin `reinnoieste_autorizatie_iscir`, cu ACELAȘI număr:
--      rândul vechi arată spre cel nou și iese din scadențe; cel nou intră  [POZITIVĂ]
--  (6) rândul înlocuit nu se mai modifică; legătura nu se pune de mână; a doua
--      reînnoire a aceluiași rând e refuzată; managerul nu reînnoiește
--  (7) ștergerea logică a reînnoirii readuce rândul vechi în scadențe  [POZITIVĂ]
--  (8) echipamentul nu se schimbă; un rând șters nu se reactivează
--  (9) izolarea: administratorul firmei A nu vede, nu modifică și nu reînnoiește
--      autorizația firmei B
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
  v_u_ang    uuid := gen_random_uuid();
  v_u_hr     uuid := gen_random_uuid();
  v_u_adm2   uuid := gen_random_uuid();
  v_e_adm    uuid := gen_random_uuid();
  v_e_mgr    uuid := gen_random_uuid();
  v_e_ang    uuid := gen_random_uuid();
  v_e_hr     uuid := gen_random_uuid();
  v_echip    uuid := gen_random_uuid();
  v_echip2   uuid := gen_random_uuid();
  v_echip_b  uuid := gen_random_uuid();
  v_a1       uuid;
  v_a_rsvti  uuid;
  v_a_nou    uuid;
  v_a_b      uuid;
  v_azi      date := app.azi_local();
  v_n        integer;
  v_text     text;
  v_bool     boolean;
  v_data     date;
  v_esecuri  int := 0;
begin
  raise notice '';
  raise notice '  PROBA „AUTORIZAȚII ISCIR" (0193)';
  raise notice '  ─────────────────────────────────────────────────────────';

  -- ── fixture ───────────────────────────────────────────────────────────────
  insert into public.organizations (id, slug, name, cui) values
    (v_org,  'proba-iscir-'  || v_sufix, 'Proba ISCIR SRL',   'RO' || (86000000 + (random() * 900000)::int)::text),
    (v_org2, 'proba-iscirb-' || v_sufix, 'Proba ISCIR B SRL', 'RO' || (87000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select o, f.feature_key, true, now() from public.features f, unnest(array[v_org, v_org2]) o;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_adm,  'iscir-adm-'  || v_sufix || '@proba.test', now()),
    (v_u_mgr,  'iscir-mgr-'  || v_sufix || '@proba.test', now()),
    (v_u_ang,  'iscir-ang-'  || v_sufix || '@proba.test', now()),
    (v_u_hr,   'iscir-hr-'   || v_sufix || '@proba.test', now()),
    (v_u_adm2, 'iscir-adm2-' || v_sufix || '@proba.test', now());
  insert into public.employees (id, organization_id, marca, first_name, last_name, hired_on, status, user_id) values
    (v_e_adm, v_org, 'IS-A', 'Ana',   'Admin',    v_azi - 900, 'activ', v_u_adm),
    (v_e_mgr, v_org, 'IS-M', 'Marin', 'Manager',  v_azi - 800, 'activ', v_u_mgr),
    (v_e_ang, v_org, 'IS-E', 'Elena', 'Angajat',  v_azi - 700, 'activ', v_u_ang),
    (v_e_hr,  v_org, 'IS-H', 'Horia', 'Resurse',  v_azi - 600, 'activ', v_u_hr);
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org,  v_u_adm,  'org_admin'),
    (v_org,  v_u_mgr,  'manager'),
    (v_org,  v_u_ang,  'employee'),
    (v_org,  v_u_hr,   'hr'),
    (v_org2, v_u_adm2, 'org_admin');

  insert into public.equipment (id, organization_id, cod, denumire, este_iscir) values
    (v_echip,   v_org,  'MAC-' || v_sufix, 'Macara capră', true),
    (v_echip2,  v_org,  'STV-' || v_sufix, 'Stivuitor',    true),
    (v_echip_b, v_org2, 'MCB-' || v_sufix, 'Macara B',     true);

  -- ═══ (1) Înregistrarea [POZITIVĂ] ════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  insert into public.iscir_authorizations (organization_id, equipment_id, numar, tip, valabil_pana, scadenta_verificare_tehnica, emis_la)
  values (v_org, v_echip, 'ISCIR-' || v_sufix, 'macara', v_azi + 400, v_azi + 300, v_azi - 300) returning id into v_a1;
  reset role;
  if v_a1 is not null then
    raise notice '  ✓ (1) org_admin înregistrează autorizația cu număr';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) org_admin nu a putut înregistra';
  end if;

  perform set_config('request.jwt.claim.sub', v_u_adm2::text, true);
  set local role authenticated;
  insert into public.iscir_authorizations (organization_id, equipment_id, numar, tip, valabil_pana)
  values (v_org2, v_echip_b, 'ISCIR-B-' || v_sufix, 'macara', v_azi + 200) returning id into v_a_b;
  reset role;

  declare
    v_u uuid; v_rol text;
  begin
    foreach v_rol in array array['manager', 'employee', 'hr'] loop
      v_u := case v_rol when 'manager' then v_u_mgr when 'employee' then v_u_ang else v_u_hr end;
      begin
        perform set_config('request.jwt.claim.sub', v_u::text, true);
        set local role authenticated;
        insert into public.iscir_authorizations (organization_id, equipment_id, numar, tip, valabil_pana)
        values (v_org, v_echip2, 'X-' || v_rol || v_sufix, 'stivuitor', v_azi + 100);
        reset role;
        v_esecuri := v_esecuri + 1;
        raise warning '  ✗ (1) % a putut înregistra o autorizație', v_rol;
      exception when insufficient_privilege then
        reset role;
        raise notice '  ✓ (1) % refuzat la înregistrare (42501)', v_rol;
      end;
    end loop;
  end;

  -- ═══ (2) Regimul RSVTI [POZITIVĂ] ═════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  insert into public.iscir_authorizations (organization_id, equipment_id, regim, numar, tip, valabil_pana)
  values (v_org, v_echip2, 'neinregistrat_rsvti', null, 'stivuitor', v_azi + 365) returning id into v_a_rsvti;
  reset role;
  if v_a_rsvti is not null then
    raise notice '  ✓ (2) evidența RSVTI fără număr trece';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) evidența RSVTI fără număr a fost refuzată';
  end if;
  begin
    perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
    set local role authenticated;
    insert into public.iscir_authorizations (organization_id, equipment_id, regim, numar, tip, valabil_pana)
    values (v_org, v_echip2, 'inregistrat', null, 'stivuitor', v_azi + 365);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) autorizația înregistrată fără număr a trecut';
  exception when check_violation then
    reset role;
    raise notice '  ✓ (2) „inregistrat” fără număr cade pe CHECK (23514)';
  end;

  -- ═══ (3) Registrul ═══════════════════════════════════════════════════════
  select count(*) into v_n from public.registru_documente where entitate_id = v_a1;
  if v_n = 1 and not exists (select 1 from public.registru_documente where entitate_id = v_a_rsvti) then
    raise notice '  ✓ (3) registrul are autorizația ISCIR, nu și evidența RSVTI';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) registrul: % rânduri pe autorizație, RSVTI înregistrată = %', v_n,
      exists (select 1 from public.registru_documente where entitate_id = v_a_rsvti);
  end if;

  -- ═══ (4) Suspendarea [POZITIVĂ] ══════════════════════════════════════════
  begin
    perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
    set local role authenticated;
    update public.iscir_authorizations set suspendata_la = v_azi where id = v_a1;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) suspendarea fără motiv a trecut';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (4) suspendarea fără motiv: %', sqlerrm;
  end;
  begin
    perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
    set local role authenticated;
    update public.iscir_authorizations set suspendata_la = v_azi + 3, motiv_suspendare = 'Cablu de ridicare uzat.' where id = v_a1;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) suspendarea cu dată în viitor a trecut';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (4) suspendarea în viitor: %', sqlerrm;
  end;
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  with m as (
    update public.iscir_authorizations set suspendata_la = v_azi, motiv_suspendare = 'Cablu de ridicare uzat.'
     where id = v_a1 returning 1)
  select count(*) into v_n from m;
  reset role;
  if v_n = 1 and not exists (select 1 from public.expirables
                              where entity_id = v_a1 and is_active and deleted_at is null) then
    raise notice '  ✓ (4) suspendarea cu motiv trece și scoate rândul din scadențe';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) suspendare: % rânduri, scadențe active rămase', v_n;
  end if;
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  update public.iscir_authorizations set suspendata_la = null, reactivata_la = date '2000-01-01' where id = v_a1;
  reset role;
  select reactivata_la into v_data from public.iscir_authorizations where id = v_a1;
  select count(*) into v_n from public.expirables where entity_id = v_a1 and is_active and deleted_at is null;
  if v_data = v_azi and v_n = 2 then
    raise notice '  ✓ (4) ridicarea suspendării: reactivata_la = azi (nu valoarea clientului), 2 scadențe active';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) ridicare: reactivata_la = %, % scadențe active', v_data, v_n;
  end if;

  -- ═══ (5) Reînnoirea cu același număr [POZITIVĂ] ══════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  v_a_nou := public.reinnoieste_autorizatie_iscir(
    p_autorizatie => v_a1, p_valabil_pana => v_azi + 700, p_numar => 'ISCIR-' || v_sufix,
    p_emitent => 'ISCIR', p_emis_la => v_azi, p_scadenta_verificare_tehnica => v_azi + 600);
  reset role;
  if (select inlocuita_de_id from public.iscir_authorizations where id = v_a1) = v_a_nou
     and not exists (select 1 from public.expirables where entity_id = v_a1 and is_active and deleted_at is null)
     and (select count(*) from public.expirables where entity_id = v_a_nou and is_active and deleted_at is null) = 2
     and (select equipment_id from public.iscir_authorizations where id = v_a_nou) = v_echip then
    raise notice '  ✓ (5) reînnoirea cu același număr: vechiul → nou, scadențele trec pe rândul nou';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) reînnoirea nu a legat rândurile sau scadențele';
  end if;

  -- ═══ (6) Rândul înlocuit e istoric ═══════════════════════════════════════
  begin
    perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
    set local role authenticated;
    update public.iscir_authorizations set conditii = 'Editare pe rândul vechi' where id = v_a1;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) rândul înlocuit s-a putut edita';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (6) rândul înlocuit: %', sqlerrm;
  end;
  begin
    perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
    set local role authenticated;
    update public.iscir_authorizations set inlocuita_de_id = v_a1 where id = v_a_rsvti;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) legătura de înlocuire s-a pus de mână';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (6) legătura de mână: %', sqlerrm;
  end;
  begin
    perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
    set local role authenticated;
    perform public.reinnoieste_autorizatie_iscir(p_autorizatie => v_a1, p_valabil_pana => v_azi + 500, p_numar => 'ALT-' || v_sufix);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) a doua reînnoire a aceluiași rând a trecut';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (6) a doua reînnoire: %', sqlerrm;
  end;
  begin
    perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
    set local role authenticated;
    perform public.reinnoieste_autorizatie_iscir(p_autorizatie => v_a_nou, p_valabil_pana => v_azi + 500, p_numar => 'MGR-' || v_sufix);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) managerul a reînnoit';
  exception when insufficient_privilege or raise_exception then
    reset role;
    raise notice '  ✓ (6) managerul nu reînnoiește (%)', sqlstate;
  end;

  -- ═══ (7) Ștergerea reînnoirii readuce vechiul [POZITIVĂ] ═════════════════
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  with m as (
    update public.iscir_authorizations set deleted_at = now() where id = v_a_nou returning 1)
  select count(*) into v_n from m;
  reset role;
  if v_n = 1
     and (select inlocuita_de_id from public.iscir_authorizations where id = v_a1) is null
     and (select count(*) from public.expirables where entity_id = v_a1 and is_active and deleted_at is null) = 2
     and not exists (select 1 from public.expirables where entity_id = v_a_nou and is_active and deleted_at is null) then
    raise notice '  ✓ (7) ștergerea reînnoirii readuce autorizația veche în scadențe';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) după ștergerea reînnoirii, vechiul nu a revenit';
  end if;

  -- ═══ (8) Echipamentul și reactivarea ═════════════════════════════════════
  begin
    perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
    set local role authenticated;
    update public.iscir_authorizations set equipment_id = v_echip2 where id = v_a1;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) echipamentul s-a schimbat';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (8) echipamentul: %', sqlerrm;
  end;
  begin
    perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
    set local role authenticated;
    update public.iscir_authorizations set deleted_at = null where id = v_a_nou;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) rândul șters s-a reactivat';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (8) rândul șters: %', sqlerrm;
  end;

  -- ═══ (9) Izolarea între firme ════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  select count(*) into v_n from public.iscir_authorizations where id = v_a_b;
  with m as (
    update public.iscir_authorizations set conditii = 'Străin' where id = v_a_b returning 1)
  select v_n + count(*) into v_n from m;
  reset role;
  if v_n = 0 then
    raise notice '  ✓ (9) A nu vede și nu modifică autorizația lui B (0 rânduri)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) A a atins % rânduri ale lui B', v_n;
  end if;
  begin
    perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
    set local role authenticated;
    perform public.reinnoieste_autorizatie_iscir(p_autorizatie => v_a_b, p_valabil_pana => v_azi + 500, p_numar => 'FUR-' || v_sufix);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) A a reînnoit autorizația lui B';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (9) A nu reînnoiește autorizația lui B: %', sqlerrm;
  end;
  if (select inlocuita_de_id from public.iscir_authorizations where id = v_a_b) is null then
    raise notice '  ✓ (9) autorizația lui B a rămas neatinsă';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) autorizația lui B a fost marcată înlocuită';
  end if;

  -- hr n-are `maintenance:*`: zero rânduri, fără eroare.
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  select count(*) into v_n from public.iscir_authorizations where organization_id = v_org;
  reset role;
  if v_n = 0 then
    raise notice '  ✓ (9) hr nu citește autorizațiile (0 rânduri)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) hr citește % autorizații', v_n;
  end if;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'Proba ISCIR: % verificări picate.', v_esecuri;
  end if;
  raise notice '  Toate verificările au trecut.';
end $$;
