-- tests/rls/proba-flota-pv.sql
--
-- FLOTA, DUPĂ 0215 (F12c): PROCESUL-VERBAL DE PREDARE-PRIMIRE A VEHICULULUI.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- Numerotarea urmează specificația F12c §9.2. Rânduri NUMĂRATE: un UPDATE
-- respins de USING nu ridică eroare, deci „n-a dat eroare” nu dovedește nimic.
--  (1)  org_admin întocmește ciorna de predare; triggerul derivă părțile  [POZITIVĂ]
--  (2)  org_admin finalizează: PVA, registru, instantaneu, notificare     [POZITIVĂ]
--  (3)  a doua finalizare a aceluiași PV: 0 rânduri
--  (4)  km pe un PV finalizat: P0001
--  (5)  transfer A → B, din predarea care închide alocarea lui A          [POZITIVĂ]
--  (6)  alocarea altei firme: P0001
--  (7)  al doilea PV viu pe aceeași alocare: 23505; după anulare          [POZITIVĂ]
--  (8)  anularea ajunge în registru; numărul rămâne                       [POZITIVĂ]
--  (9)  angajatul își vede PV-urile după restituire                       [POZITIVĂ]
--  (10) angajatul confirmă; ora și autorul le scrie baza                  [POZITIVĂ]
--  (11) angajatul nu schimbă constatările sau anularea: P0001
--  (12) alt angajat nu confirmă PV-ul altuia: 0 rânduri
--  (13) a doua confirmare: P0001
--  (14) angajatul nu întocmește PV: 42501
--  (15) hr nu vede PV-urile la care nu e parte: 0 rânduri
--  (16) managerul lui A vede PV-ul lui A; alt manager nu                  [POZITIVĂ / 0]
--  (17) km diferit de alocare: P0001 cu cifrele
--  (18) alocarea fără km îl primește din PV                               [POZITIVĂ]
--  (19) „fără daune” cu o daună în listă: 23514
--  (20) zonă de daună necunoscută: P0001
--  (21) ștergerea PV-ului finalizat: P0001; a ciornei: 1 rând, fără 42501 [POZITIVĂ]
--  (21b) ștergerea ciornei după ștergerea alocării                       [POZITIVĂ]
--  (22) anul de registru închis: P0001, ciorna rămâne, numărul nu se arde
--  (23) transfer A → A: P0001
--  (24) restituire sub km de predare: P0001, nu 23514 `va_km_ck`
--  (25) super_admin: INSERT 42501, SELECT vede
--  (26) managerul parte la PV confirmă                                    [POZITIVĂ]
--  (27) finalizare pe vehicul șters: P0001
--  (28) DECIZIA 3: hr parte la PV îl vede, îl confirmă și își vede mașina [POZITIVĂ]
--  (29) DECIZIA 3: hr NU vede restul parcului, documentele, alocările,
--       PV-urile altora și nu scrie PV                                    [NEGATIVĂ]
--  (30) managerul nu întocmește PV și nu anulează PV-ul subordonatei
--  (31) scanul semnat: doar pe finalizat, în folderul vehiculului, de administrator
--  (32) `id` și `created_at` nu se rescriu, nici de partea la PV, nici pe ciornă
--  (33) ștergerea ciornei nu poartă număr, părți sau finalizare: P0001
--  (34) scanul semnat îl citește cine vede PV-ul (fostul șofer, managerul lui),
--       nu și restul folderului vehiculului                               [POZITIVĂ / 0]
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
  v_u_a       uuid := gen_random_uuid();
  v_u_b       uuid := gen_random_uuid();
  v_u_mgr     uuid := gen_random_uuid();
  v_u_mgr2    uuid := gen_random_uuid();
  v_u_hr      uuid := gen_random_uuid();
  v_u_sa      uuid := gen_random_uuid();
  v_e_admin   uuid := gen_random_uuid();
  v_e_a       uuid := gen_random_uuid();
  v_e_b       uuid := gen_random_uuid();
  v_e_mgr     uuid := gen_random_uuid();
  v_e_mgr2    uuid := gen_random_uuid();
  v_e_hr      uuid := gen_random_uuid();
  v_e_strain  uuid := gen_random_uuid();
  v_v1        uuid := gen_random_uuid();
  v_v2        uuid := gen_random_uuid();
  v_v3        uuid := gen_random_uuid();
  v_v4        uuid := gen_random_uuid();
  v_v5        uuid := gen_random_uuid();
  v_v6        uuid := gen_random_uuid();
  v_v7        uuid := gen_random_uuid();
  v_v8        uuid := gen_random_uuid();
  v_v_strain  uuid := gen_random_uuid();
  v_al_a      uuid;
  v_al_b      uuid;
  v_al_mgr    uuid;
  v_al_hr     uuid;
  v_al_c      uuid;
  v_al_e      uuid;
  v_al_f      uuid;
  v_al_g      uuid;
  v_al_h      uuid;
  v_al_i      uuid;
  v_al_strain uuid;
  v_pv1       uuid;
  v_pv2       uuid;
  v_pv3       uuid;
  v_pv4       uuid;
  v_pv        uuid;
  v_rand      record;
  v_n         integer;
  v_m         integer;
  v_k         integer;
  v_text      text;
  v_mesaj     text;
  v_la        timestamptz;
  v_de        uuid;
  v_esecuri   int := 0;
  v_an        integer := extract(year from app.azi_local())::integer;
begin
  raise notice '';
  raise notice '  PROBA „FLOTA — PROCES-VERBAL DE PREDARE-PRIMIRE” (0215, F12c)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, legal_name, cui) values
    (v_org, 'proba-pv-' || v_sufix, 'Proba PV', 'Proba PV SRL',
     'RO' || (86000000 + (random() * 900000)::int)::text),
    (v_org_alta, 'proba-pv-alta-' || v_sufix, 'Altă Firmă PV SRL', null,
     'RO' || (87000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select o, f.feature_key, true, now() from public.features f, unnest(array[v_org, v_org_alta]) o;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_admin, 'pv-adm-'  || v_sufix || '@proba.test', now()),
    (v_u_a,     'pv-a-'    || v_sufix || '@proba.test', now()),
    (v_u_b,     'pv-b-'    || v_sufix || '@proba.test', now()),
    (v_u_mgr,   'pv-mgr-'  || v_sufix || '@proba.test', now()),
    (v_u_mgr2,  'pv-mgr2-' || v_sufix || '@proba.test', now()),
    (v_u_hr,    'pv-hr-'   || v_sufix || '@proba.test', now()),
    (v_u_sa,    'pv-sa-'   || v_sufix || '@proba.test', now());
  insert into public.platform_admins (user_id) values (v_u_sa);

  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id) values
    (v_e_admin, v_org, 'PV-ADM', 'Adriana', 'Administrator', app.azi_local() - 900, 'activ', v_u_admin),
    (v_e_mgr,   v_org, 'PV-MGR', 'Marin',   'Șef',           app.azi_local() - 800, 'activ', v_u_mgr),
    (v_e_mgr2,  v_org, 'PV-MG2', 'Mihai',   'Alt Șef',       app.azi_local() - 800, 'activ', v_u_mgr2),
    (v_e_hr,    v_org, 'PV-HR',  'Hortensia', 'Resurse',     app.azi_local() - 700, 'activ', v_u_hr),
    (v_e_b,     v_org, 'PV-B',   'Bogdan',  'Șofer',         app.azi_local() - 400, 'activ', v_u_b),
    (v_e_strain, v_org_alta, 'PV-X', 'Xenia', 'Străină',     app.azi_local() - 400, 'activ', null);
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_a, v_org, 'PV-A', 'Ana', 'Șofer', app.azi_local() - 400, 'activ', v_u_a, v_e_mgr);
  -- Membrii DUPĂ fișe: `trg_zorganization_members_fisa_patron` (0083) i-ar crea
  -- administratorului o fișă proprie, iar a doua fișă principală ar cădea pe
  -- `employees_org_user_primary_uniq`.
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_admin, 'org_admin'),
    (v_org, v_u_a,     'employee'),
    (v_org, v_u_b,     'employee'),
    (v_org, v_u_mgr,   'manager'),
    (v_org, v_u_mgr2,  'manager'),
    (v_org, v_u_hr,    'hr');

  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent, categorie,
                               created_by, updated_by) values
    (v_v1, v_org, 'B' || (100 + (random() * 800)::int)::text || 'PVU', 'Dacia', 'Duster', 50000, 'autoturism', v_u_admin, v_u_admin),
    (v_v2, v_org, 'B' || (100 + (random() * 800)::int)::text || 'PVD', 'Skoda', 'Octavia', 30000, 'autoturism', v_u_admin, v_u_admin),
    (v_v3, v_org, 'B' || (100 + (random() * 800)::int)::text || 'PVT', 'Dacia', 'Logan', 20000, 'autoturism', v_u_admin, v_u_admin),
    (v_v4, v_org, 'B' || (100 + (random() * 800)::int)::text || 'PVP', 'Ford', 'Transit', 7000, 'autoutilitara', v_u_admin, v_u_admin),
    (v_v5, v_org, 'B' || (100 + (random() * 800)::int)::text || 'PVC', 'Dacia', 'Jogger', 3000, 'autoturism', v_u_admin, v_u_admin),
    (v_v6, v_org, 'B' || (100 + (random() * 800)::int)::text || 'PVS', 'Dacia', 'Spring', 1000, 'autoturism', v_u_admin, v_u_admin),
    (v_v7, v_org, 'B' || (100 + (random() * 800)::int)::text || 'PVE', 'Renault', 'Clio', 2000, 'autoturism', v_u_admin, v_u_admin),
    (v_v8, v_org, 'B' || (100 + (random() * 800)::int)::text || 'PVO', 'Opel', 'Astra', 4000, 'autoturism', v_u_admin, v_u_admin),
    (v_v_strain, v_org_alta, 'CJ' || (100 + (random() * 800)::int)::text || 'PVX', 'Dacia', 'Logan', 100, 'autoturism', null, null);

  -- RCA curent pe V1 (intră în instantaneu) și pe V3 (mașina HR-ului: NU trebuie să-l vadă).
  insert into public.vehicle_documents (organization_id, vehicle_id, document_type_id, numar, valabil_de_la, expira_la,
                                        created_by, updated_by)
  select v_org, v.id, t.id, 'RCA-' || v_sufix, app.azi_local() - 30, app.azi_local() + 300, v_u_admin, v_u_admin
    from public.vehicle_document_types t, unnest(array[v_v1, v_v3]) v(id)
   where t.cod = 'rca' and t.organization_id is null and t.deleted_at is null;

  -- Alocările, ca superuser (contextul de serviciu): ele nu sunt obiectul probei.
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, km_predare, created_by, updated_by)
  values (v_org, v_v1, v_e_a, now() - interval '20 days', 50000, v_u_admin, v_u_admin)
  returning id into v_al_a;
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, km_predare, created_by, updated_by)
  values (v_org, v_v2, v_e_mgr, now() - interval '20 days', 30000, v_u_admin, v_u_admin)
  returning id into v_al_mgr;
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, km_predare, created_by, updated_by)
  values (v_org, v_v3, v_e_hr, now() - interval '20 days', 20000, v_u_admin, v_u_admin)
  returning id into v_al_hr;
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, km_predare, created_by, updated_by)
  values (v_org_alta, v_v_strain, v_e_strain, now() - interval '20 days', 100, null, null)
  returning id into v_al_strain;

  -- ── (1) ciorna de predare ───────────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_handovers (organization_id, alocare_primita_id, numar_chei, dotari,
                                          documente_bord, created_by, updated_by)
    values (v_org, v_al_a, 2, array['trusa_medicala', 'triunghiuri', 'extinctor'],
            array['certificat_inmatriculare', 'polita_rca'], v_u_admin, v_u_admin)
    returning id into v_pv1;
    reset role;
    select * into v_rand from public.vehicle_handovers where id = v_pv1;
    if v_rand.tip = 'predare' and v_rand.predator_employee_id is null and v_rand.primitor_employee_id = v_e_a
       and v_rand.km_bord = 50000 and v_rand.vehicle_id = v_v1 and v_rand.numar = ''
       and v_rand.sofer_employee_id = v_e_a and v_rand.stare = 'ciorna' then
      raise notice '  ✓ (1) ciorna de predare: tip, părți, vehicul și km derivate din alocare';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (1) ciorna derivată greșit: tip %, predator %, primitor %, km %, numar „%”',
        v_rand.tip, v_rand.predator_employee_id, v_rand.primitor_employee_id, v_rand.km_bord, v_rand.numar;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) org_admin nu poate întocmi ciorna: % (%)', sqlerrm, sqlstate;
  end;

  -- ── (2) finalizarea ─────────────────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    update public.vehicle_handovers
       set nivel_rezervor = 'plin', stare_generala = 'buna', daune_constatate = false, updated_by = v_u_admin
     where id = v_pv1 and stare = 'ciorna' and deleted_at is null;
    update public.vehicle_handovers
       set stare = 'finalizat', updated_by = v_u_admin
     where id = v_pv1 and stare = 'ciorna' and deleted_at is null;
    get diagnostics v_n = row_count;
    reset role;
    select * into v_rand from public.vehicle_handovers where id = v_pv1;
    select count(*) into v_m from public.registru_documente r
     where r.organization_id = v_org and r.entitate_tip = 'vehicle_handovers' and r.entitate_id = v_pv1
       and r.tip_document = 'pv_predare_primire' and r.angajat_id = v_e_a
       and r.numar_document_emitent = v_rand.numar and r.numar_afisat = v_rand.numar_registru;
    select count(*) into v_text from public.notifications
     where user_id = v_u_a and entity_type = 'vehicle_handover' and entity_id = v_pv1 and kind = 'task'
       and link = '/portal/masina-mea?pv=' || v_pv1::text;
    if v_n = 1 and v_rand.numar ~ ('^PVA-' || v_an::text || '-[0-9]{4}$') and v_rand.numar_registru is not null
       and v_m = 1 and v_rand.finalizat_de = v_u_admin and v_rand.finalizat_la is not null
       and v_rand.snapshot #>> '{vehicul,nr_inmatriculare}' = (select nr_inmatriculare from public.vehicles where id = v_v1)
       and v_rand.snapshot #>> '{primitor,nume}' = 'Șofer Ana'
       and v_rand.snapshot #>> '{predator,tip}' = 'firma'
       and v_rand.snapshot #>> '{predator,nume}' = 'Proba PV SRL'
       and v_rand.snapshot #>> '{reprezentant,nume}' = 'Administrator Adriana'
       and jsonb_array_length(v_rand.snapshot -> 'documente') = 1
       and (v_rand.snapshot #>> '{documente,0,valabil}')::boolean
       and v_text = '1' then
      raise notice '  ✓ (2) finalizarea: % · registru % · instantaneu · notificarea șoferului', v_rand.numar, v_rand.numar_registru;
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (2) finalizarea: % rânduri, numar „%”, registru % (% rânduri), notificări %, instantaneu %',
        v_n, v_rand.numar, v_rand.numar_registru, v_m, v_text, v_rand.snapshot;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) finalizarea a eșuat: % (%)', sqlerrm, sqlstate;
  end;
  -- Cine finalizează nu-și trimite singur notificarea.
  select count(*) into v_n from public.notifications
   where user_id = v_u_admin and entity_type = 'vehicle_handover' and entity_id = v_pv1;
  if v_n = 0 then
    raise notice '  ✓ (2b) cine finalizează nu primește notificarea propriului gest';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2b) administratorul și-a trimis % notificări', v_n;
  end if;

  -- ── (3) a doua finalizare ───────────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  update public.vehicle_handovers set stare = 'finalizat', updated_by = v_u_admin
   where id = v_pv1 and stare = 'ciorna' and deleted_at is null;
  get diagnostics v_n = row_count;
  reset role;
  if v_n = 0 then
    raise notice '  ✓ (3) a doua finalizare: 0 rânduri (acțiunea o traduce în CONFLICT)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) a doua finalizare a atins % rânduri', v_n;
  end if;

  -- ── (4) km pe un PV finalizat ───────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    update public.vehicle_handovers set km_bord = 50001, updated_by = v_u_admin where id = v_pv1;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) kilometrajul unui PV finalizat s-a schimbat';
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Procesul-verbal este finalizat%' then
      raise notice '  ✓ (4) PV-ul finalizat e imuabil (P0001)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (4) alt mesaj: %', sqlerrm;
    end if;
  end;

  -- ── (5) transferul A → B ────────────────────────────────────────────────
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, km_predare, created_by, updated_by)
  values (v_org, v_v1, v_e_b, now() - interval '5 days', 51000, v_u_admin, v_u_admin)
  returning id into v_al_b;
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_handovers (organization_id, alocare_predata_id, alocare_primita_id,
                                          nivel_rezervor, stare_generala, daune_constatate, daune,
                                          created_by, updated_by)
    values (v_org, v_al_a, v_al_b, 'jumatate', 'uzura_normala', true,
            '[{"zona": "lateral_dreapta", "descriere": "Zgârietură ușă spate"}]'::jsonb, v_u_admin, v_u_admin)
    returning id into v_pv2;
    update public.vehicle_handovers set stare = 'finalizat', updated_by = v_u_admin
     where id = v_pv2 and stare = 'ciorna';
    get diagnostics v_n = row_count;
    reset role;
    select * into v_rand from public.vehicle_handovers where id = v_pv2;
    if v_n = 1 and v_rand.tip = 'transfer' and v_rand.predator_employee_id = v_e_a
       and v_rand.primitor_employee_id = v_e_b and v_rand.km_bord = 51000 and v_rand.stare = 'finalizat'
       and v_rand.snapshot #>> '{predator,nume}' = 'Șofer Ana' then
      raise notice '  ✓ (5) transfer A → B: predătorul Ana, primitorul Bogdan, %', v_rand.numar;
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (5) transfer: tip %, predator %, primitor %, km %', v_rand.tip,
        v_rand.predator_employee_id, v_rand.primitor_employee_id, v_rand.km_bord;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) transferul a eșuat: % (%)', sqlerrm, sqlstate;
  end;

  -- ── (6) alocarea altei firme ────────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_handovers (organization_id, alocare_primita_id, created_by, updated_by)
    values (v_org, v_al_strain, v_u_admin, v_u_admin);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) PV pe alocarea altei firme acceptat';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (6) alocarea altei firme: P0001';
  end;

  -- ── (9) angajatul își vede PV-urile după restituire ─────────────────────
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  select count(*) into v_n from public.vehicle_handovers where id in (v_pv1, v_pv2) and deleted_at is null;
  select count(*) into v_m from public.vehicles where id = v_v1;
  reset role;
  if v_n = 2 and v_m = 0 then
    raise notice '  ✓ (9) Ana își vede cele 2 PV-uri, deși vehiculul nu mai e al ei';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) Ana vede % PV-uri și % vehicule', v_n, v_m;
  end if;

  -- ── (10) angajatul confirmă primirea ────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.vehicle_handovers
       set confirmat_primitor_la = '2000-01-01T00:00:00Z', updated_by = v_u_a
     where id = v_pv1 and confirmat_primitor_la is null;
    get diagnostics v_n = row_count;
    reset role;
    select confirmat_primitor_la, confirmat_primitor_de into v_la, v_de from public.vehicle_handovers where id = v_pv1;
    if v_n = 1 and v_de = v_u_a and v_la > now() - interval '1 minute' then
      raise notice '  ✓ (10) Ana confirmă primirea; ora și autorul sunt ale bazei';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (10) confirmarea: % rânduri, la %, de %', v_n, v_la, v_de;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10) Ana nu poate confirma: % (%)', sqlerrm, sqlstate;
  end;

  -- ── (11) angajatul nu schimbă constatările sau anularea ─────────────────
  v_n := 0;
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.vehicle_handovers set observatii = 'Rescris de șofer', updated_by = v_u_a where id = v_pv2;
  exception when raise_exception then
    v_n := v_n + 1;
  end;
  begin
    update public.vehicle_handovers set anulat_la = now(), motiv_anulare = 'Anulat de șoferul însuși', updated_by = v_u_a
     where id = v_pv2;
  exception when raise_exception then
    v_n := v_n + 1;
  end;
  reset role;
  if v_n = 2 then
    raise notice '  ✓ (11) Ana nu schimbă constatările și nu anulează (P0001 × 2)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (11) doar % din 2 scrieri refuzate', v_n;
  end if;

  -- ── (12) alt angajat nu confirmă PV-ul altuia ───────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_b::text, true);
  set local role authenticated;
  begin
    update public.vehicle_handovers set confirmat_primitor_la = now(), updated_by = v_u_b
     where id = v_pv1;
    get diagnostics v_n = row_count;
  exception when others then
    v_n := -1;
  end;
  reset role;
  if v_n = 0 then
    raise notice '  ✓ (12) Bogdan nu confirmă PV-ul Anei (0 rânduri, USING)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (12) Bogdan pe PV-ul Anei: % rânduri', v_n;
  end if;

  -- ── (13) a doua confirmare ──────────────────────────────────────────────
  -- `clock_timestamp()`, nu `now()`: proba e O SINGURĂ tranzacție, iar `now()`
  -- e ora ei de început, exact valoarea pe care triggerul a scris-o la (10).
  -- Aceeași valoare înseamnă „nicio schimbare”, deci nimic de refuzat.
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    update public.vehicle_handovers set confirmat_primitor_la = clock_timestamp(), updated_by = v_u_a where id = v_pv1;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (13) a doua confirmare acceptată';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (13) a doua confirmare: P0001';
  end;

  -- ── (10b) transferul se confirmă de ambele părți, fiecare pe coloana lui ─
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  update public.vehicle_handovers set confirmat_predator_la = now(), updated_by = v_u_a
   where id = v_pv2 and confirmat_predator_la is null;
  get diagnostics v_n = row_count;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_b::text, true);
  set local role authenticated;
  update public.vehicle_handovers set confirmat_primitor_la = now(), updated_by = v_u_b
   where id = v_pv2 and confirmat_primitor_la is null;
  get diagnostics v_m = row_count;
  reset role;
  select count(*) into v_text from public.vehicle_handovers
   where id = v_pv2 and confirmat_predator_de = v_u_a and confirmat_primitor_de = v_u_b;
  if v_n = 1 and v_m = 1 and v_text = '1' then
    raise notice '  ✓ (10b) transferul: Ana confirmă predarea, Bogdan primirea';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10b) transferul: % / % rânduri, potrivire %', v_n, v_m, v_text;
  end if;

  -- ── (14) angajatul nu întocmește PV ─────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_handovers (organization_id, alocare_predata_id, created_by, updated_by)
    values (v_org, v_al_a, v_u_a, v_u_a);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (14) un angajat a întocmit un PV';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (14) angajatul nu întocmește PV (42501)';
  end;

  -- ── (15) hr nu vede PV-urile la care nu e parte ─────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  select count(*) into v_n from public.vehicle_handovers where id in (v_pv1, v_pv2);
  reset role;
  if v_n = 0 then
    raise notice '  ✓ (15) hr nu vede PV-urile altora (0 rânduri, fără eroare)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (15) hr vede % PV-uri ale altora', v_n;
  end if;

  -- ── (16) managerul lui A îl vede; alt manager nu ────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  select count(*) into v_n from public.vehicle_handovers where id = v_pv1;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_mgr2::text, true);
  set local role authenticated;
  select count(*) into v_m from public.vehicle_handovers where id = v_pv1;
  reset role;
  if v_n = 1 and v_m = 0 then
    raise notice '  ✓ (16) managerul Anei vede PV-ul ei; alt manager nu';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (16) managerul Anei: %, alt manager: %', v_n, v_m;
  end if;

  -- ── (26) managerul parte la PV îl confirmă ──────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  insert into public.vehicle_handovers (organization_id, alocare_primita_id, nivel_rezervor, stare_generala,
                                        daune_constatate, created_by, updated_by)
  values (v_org, v_al_mgr, 'plin', 'buna', false, v_u_admin, v_u_admin)
  returning id into v_pv3;
  update public.vehicle_handovers set stare = 'finalizat', updated_by = v_u_admin where id = v_pv3;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    update public.vehicle_handovers set confirmat_primitor_la = now(), updated_by = v_u_mgr
     where id = v_pv3 and confirmat_primitor_la is null;
    get diagnostics v_n = row_count;
  exception when others then
    v_n := -1;
    v_mesaj := sqlerrm;
  end;
  reset role;
  select confirmat_primitor_de into v_de from public.vehicle_handovers where id = v_pv3;
  if v_n = 1 and v_de = v_u_mgr then
    raise notice '  ✓ (26) managerul își confirmă propriul PV';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (26) managerul: % rânduri, de %, %', v_n, v_de, v_mesaj;
  end if;

  -- ── (28) DECIZIA 3: hr parte la PV ──────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  insert into public.vehicle_handovers (organization_id, alocare_primita_id, nivel_rezervor, stare_generala,
                                        daune_constatate, created_by, updated_by)
  values (v_org, v_al_hr, 'sfert', 'buna', false, v_u_admin, v_u_admin)
  returning id into v_pv4;
  update public.vehicle_handovers set stare = 'finalizat', updated_by = v_u_admin where id = v_pv4;
  reset role;
  select count(*) into v_m from public.notifications
   where user_id = v_u_hr and entity_type = 'vehicle_handover' and entity_id = v_pv4;
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  begin
    select count(*) into v_n from public.vehicle_handovers where id = v_pv4 and deleted_at is null;
    select v_n * 10 + count(*) into v_n from public.vehicles where id = v_v3;
    update public.vehicle_handovers set confirmat_primitor_la = now(), updated_by = v_u_hr
     where id = v_pv4 and confirmat_primitor_la is null;
    get diagnostics v_k = row_count;
  exception when others then
    v_n := -1;
    v_mesaj := sqlerrm;
  end;
  reset role;
  if v_n = 11 and v_k = 1 and v_m = 1 then
    raise notice '  ✓ (28) hr parte la PV: îl vede, își vede mașina, îl confirmă, a primit notificarea';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (28) hr parte: vizibil %, confirmare %, notificări %, %', v_n, v_k, v_m, v_mesaj;
  end if;

  -- ── (29) DECIZIA 3: hr NU vede restul parcului ──────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  select count(*) into v_n from public.vehicles where organization_id = v_org and id <> v_v3;
  select v_n * 10 + count(*) into v_n from public.vehicle_documents where organization_id = v_org;
  select v_n * 10 + count(*) into v_n from public.vehicle_assignments where organization_id = v_org;
  select v_n * 10 + count(*) into v_n from public.vehicle_handovers where organization_id = v_org and id <> v_pv4;
  update public.vehicle_handovers set confirmat_primitor_la = now(), updated_by = v_u_hr where id = v_pv3;
  get diagnostics v_m = row_count;
  begin
    insert into public.vehicle_handovers (organization_id, alocare_primita_id, created_by, updated_by)
    values (v_org, v_al_hr, v_u_hr, v_u_hr);
    v_text := 'inserat';
  exception when insufficient_privilege then
    v_text := '42501';
  end;
  reset role;
  if v_n = 0 and v_m = 0 and v_text = '42501' then
    raise notice '  ✓ (29) hr nu vede alt vehicul, documente, alocări, PV-uri străine; nu confirmă și nu scrie';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (29) hr: vizibile (veh·doc·aloc·pv) %, confirmare străină %, inserare %', v_n, v_m, v_text;
  end if;

  -- ── (30) managerul nu întocmește și nu scrie PV-ul altuia ───────────────
  -- `manager` are `vehicles:read = team`, nu `vehicles:update = all`: vede
  -- PV-urile echipei (16), își confirmă propriul PV (26), dar nu scrie altceva.
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_handovers (organization_id, alocare_predata_id, created_by, updated_by)
    values (v_org, v_al_a, v_u_mgr, v_u_mgr);
    v_text := 'inserat';
  exception when insufficient_privilege then
    v_text := '42501';
  end;
  update public.vehicle_handovers set anulat_la = now(), motiv_anulare = 'Anulat de managerul echipei.', updated_by = v_u_mgr
   where id = v_pv1;
  get diagnostics v_n = row_count;
  reset role;
  if v_text = '42501' and v_n = 0 then
    raise notice '  ✓ (30) managerul nu întocmește PV (42501) și nu anulează PV-ul subordonatei (0 rânduri)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (30) managerul: inserare %, anulare % rânduri', v_text, v_n;
  end if;

  -- ── (7a) al doilea PV viu pe aceeași alocare ────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_handovers (organization_id, alocare_primita_id, created_by, updated_by)
    values (v_org, v_al_a, v_u_admin, v_u_admin);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) al doilea PV viu pe aceeași predare acceptat';
  exception when unique_violation then
    reset role;
    if sqlerrm like '%pvv_primita_uq%' then
      raise notice '  ✓ (7) al doilea PV viu pe aceeași predare: 23505 pvv_primita_uq';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (7) alt index: %', sqlerrm;
    end if;
  end;

  -- ── (8) anularea ────────────────────────────────────────────────────────
  select numar into v_text from public.vehicle_handovers where id = v_pv1;
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    update public.vehicle_handovers
       set anulat_la = now(), motiv_anulare = 'Kilometrajul a fost citit greșit.', updated_by = v_u_admin
     where id = v_pv1 and stare = 'finalizat' and anulat_la is null;
    get diagnostics v_n = row_count;
    reset role;
    select count(*) into v_m from public.registru_documente r
     where r.entitate_tip = 'vehicle_handovers' and r.entitate_id = v_pv1 and r.anulat_la is not null
       and r.motiv_anulare like 'Procesul-verbal ' || v_text || ' a fost anulat: Kilometrajul%';
    if v_n = 1 and v_m = 1 and (select numar from public.vehicle_handovers where id = v_pv1) = v_text then
      raise notice '  ✓ (8) anularea ajunge în registru; numărul % rămâne', v_text;
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (8) anularea: % rânduri, registru %', v_n, v_m;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) anularea a eșuat: % (%)', sqlerrm, sqlstate;
  end;

  -- ── (7b) după anulare, PV-ul nou pe aceeași predare ─────────────────────
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_handovers (organization_id, alocare_primita_id, created_by, updated_by)
    values (v_org, v_al_a, v_u_admin, v_u_admin)
    returning id into v_pv;
    reset role;
    raise notice '  ✓ (7b) după anularea primului, PV-ul nou pe aceeași predare intră';
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7b) PV-ul nou după anulare: % (%)', sqlerrm, sqlstate;
  end;

  -- ── (31) scanul hârtiei semnate ─────────────────────────────────────────
  -- Doar pe finalizat, doar în folderul vehiculului (0202), doar cine
  -- administrează parcul. Rânduri numărate pe calea bună.
  v_n := 0;
  v_m := 0;
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  update public.vehicle_handovers
     set scan_path = v_org::text || '/vehicles/' || v_v1::text || '/' || gen_random_uuid()::text || '-pv-semnat.pdf',
         updated_by = v_u_admin
   where id = v_pv2;
  get diagnostics v_k = row_count;
  begin
    update public.vehicle_handovers
       set scan_path = v_org::text || '/vehicles/' || v_v2::text || '/' || gen_random_uuid()::text || '-alt-vehicul.pdf',
           updated_by = v_u_admin
     where id = v_pv2;
  exception when raise_exception then
    v_n := v_n + 1;
  end;
  begin
    update public.vehicle_handovers set scan_path = v_org::text || '/vehicles/' || v_v1::text || '/x.pdf', updated_by = v_u_admin
     where id = v_pv;
  exception when raise_exception then
    v_m := v_m + 1;
  end;
  reset role;
  -- `v_pv` e aici ciorna de la (7b), încă vie: scanul nu se pune pe ciornă.
  perform set_config('request.jwt.claim.sub', v_u_b::text, true);
  set local role authenticated;
  begin
    update public.vehicle_handovers set scan_path = null, updated_by = v_u_b where id = v_pv2;
  exception when raise_exception then
    v_n := v_n + 1;
  end;
  reset role;
  if v_k = 1 and v_n = 2 and v_m = 1
     and (select scan_path from public.vehicle_handovers where id = v_pv2) like v_org::text || '/vehicles/' || v_v1::text || '/%' then
    raise notice '  ✓ (31) scanul: pe finalizat, în folderul vehiculului (1 rând); alt vehicul, ciorna și șoferul: P0001';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (31) scanul: % rânduri, refuzuri cale/șofer %, ciornă %', v_k, v_n, v_m;
  end if;

  -- ── (32) cheia și data creării nu se rescriu ─────────────────────────
  -- Partea la PV are UPDATE pe rând (ramura „parte la PV”), deci garda ține
  -- TOT rândul, nu o listă de coloane: un `id` rescris ar rupe legătura cu
  -- registrul (anularea nu l-ar mai găsi), cu notificarea și cu auditul.
  -- Fiecare încercare e derulată (PVR01) dacă trece, ca restul probei să
  -- lucreze tot pe rândurile ei.
  v_n := 0;
  v_text := '';
  perform set_config('request.jwt.claim.sub', v_u_b::text, true);
  set local role authenticated;
  begin
    update public.vehicle_handovers set id = gen_random_uuid(), updated_by = v_u_b where id = v_pv2;
    get diagnostics v_k = row_count;
    raise exception using errcode = 'PVR01', message = 'id rescris de primitor: ' || v_k || ' rânduri';
  exception when others then
    if sqlstate = 'P0001' and sqlerrm like 'Identificatorul și data creării%' then v_n := v_n + 1;
    else v_text := v_text || sqlerrm || '; '; end if;
  end;
  begin
    update public.vehicle_handovers set created_at = '2001-01-01', updated_by = v_u_b where id = v_pv2;
    get diagnostics v_k = row_count;
    raise exception using errcode = 'PVR01', message = 'created_at rescris de primitor: ' || v_k || ' rânduri';
  exception when others then
    if sqlstate = 'P0001' and sqlerrm like 'Identificatorul și data creării%' then v_n := v_n + 1;
    else v_text := v_text || sqlerrm || '; '; end if;
  end;
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    -- `v_pv` e ciorna de la (7b): nici administratorul nu-i schimbă cheia.
    update public.vehicle_handovers set id = gen_random_uuid(), updated_by = v_u_admin where id = v_pv;
    get diagnostics v_k = row_count;
    raise exception using errcode = 'PVR01', message = 'id-ul ciornei rescris: ' || v_k || ' rânduri';
  exception when others then
    if sqlstate = 'P0001' and sqlerrm like 'Identificatorul și data creării%' then v_n := v_n + 1;
    else v_text := v_text || sqlerrm || '; '; end if;
  end;
  reset role;
  if v_n = 3 then
    raise notice '  ✓ (32) cheia și data creării nu se rescriu: finalizat de primitor, ciornă de administrator (P0001 × 3)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (32) doar % din 3 rescrieri refuzate: %', v_n, v_text;
  end if;

  -- ── (34) scanul îl citește cine vede PV-ul, nu doar cine vede vehiculul ─
  -- Ana a predat V1 lui Bogdan (transferul de la (5)): nu mai vede vehiculul
  -- (9), dar își vede PV-ul, deci și hârtia semnată. Managerul ei, la fel.
  -- Restul folderului vehiculului rămâne închis; alt manager și hr nu văd nimic.
  select scan_path into v_text from public.vehicle_handovers where id = v_pv2;
  insert into storage.objects (bucket_id, name, owner) values
    ('org-flota', v_text, v_u_admin),
    ('org-flota', v_org::text || '/vehicles/' || v_v1::text || '/' || gen_random_uuid()::text || '-rca.pdf', v_u_admin);
  perform set_config('request.jwt.claim.sub', v_u_a::text, true);
  set local role authenticated;
  select count(*) filter (where name = v_text), count(*) filter (where name <> v_text) into v_n, v_m
    from storage.objects where bucket_id = 'org-flota' and name like v_org::text || '/vehicles/' || v_v1::text || '/%';
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  select v_n * 10 + count(*) filter (where name = v_text), v_m * 10 + count(*) filter (where name <> v_text)
    into v_n, v_m
    from storage.objects where bucket_id = 'org-flota' and name like v_org::text || '/vehicles/' || v_v1::text || '/%';
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_mgr2::text, true);
  set local role authenticated;
  select count(*) into v_k from storage.objects
   where bucket_id = 'org-flota' and name like v_org::text || '/vehicles/' || v_v1::text || '/%';
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  select v_k * 10 + count(*) into v_k from storage.objects
   where bucket_id = 'org-flota' and name like v_org::text || '/vehicles/' || v_v1::text || '/%';
  reset role;
  -- Controlul: Bogdan, șoferul de acum, vede tot folderul (ramura vehiculului).
  perform set_config('request.jwt.claim.sub', v_u_b::text, true);
  set local role authenticated;
  select count(*) into v_text from storage.objects
   where bucket_id = 'org-flota' and name like v_org::text || '/vehicles/' || v_v1::text || '/%';
  reset role;
  if v_n = 11 and v_m = 0 and v_k = 0 and v_text = '2' then
    raise notice '  ✓ (34) scanul semnat: Ana (fost șofer) și managerul ei îl văd, restul folderului nu; alt manager și hr: 0';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (34) scanul: Ana·manager % (așteptat 11), alt fișier % (0), alt manager·hr % (0), șoferul de acum % (2)',
      v_n, v_m, v_k, v_text;
  end if;

  -- ── (17) km diferit de alocare ──────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    update public.vehicle_handovers
       set km_bord = 50500, nivel_rezervor = 'plin', stare_generala = 'buna', daune_constatate = false,
           updated_by = v_u_admin
     where id = v_pv;
    update public.vehicle_handovers set stare = 'finalizat', updated_by = v_u_admin where id = v_pv;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (17) finalizat cu km diferit de alocare';
  exception when raise_exception then
    reset role;
    if sqlerrm like '%(50500 km) diferă de cel al alocării (50000 km)%' then
      raise notice '  ✓ (17) km diferit de alocare: P0001 cu cifrele';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (17) alt mesaj: %', sqlerrm;
    end if;
  end;

  -- ── (33) ștergerea ciornei nu poartă alte schimbări ─────────────────────
  -- Ramura de ștergere sare peste derivare; fără gardă, ar scrie pe rândul
  -- șters coloanele pe care le scrie doar baza: un număr pus acolo ar ocupa
  -- `pvv_numar_uq` pentru totdeauna (fiecare finalizare de după ar cădea pe
  -- 23505), iar o parte schimbată ar deschide ciorna ștearsă altui angajat.
  -- Finalizarea și ștergerea în aceeași scriere ar lăsa în registru un PV
  -- pe care nu-l mai vede nimeni. Fiecare încercare e derulată dacă trece.
  v_n := 0;
  v_text := '';
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    update public.vehicle_handovers
       set deleted_at = now(), numar = 'PVA-' || v_an::text || '-9999', updated_by = v_u_admin
     where id = v_pv and deleted_at is null;
    get diagnostics v_k = row_count;
    raise exception using errcode = 'PVR01', message = 'număr pus la ștergere: ' || v_k || ' rânduri';
  exception when others then
    if sqlstate = 'P0001' and sqlerrm like 'Ștergerea ciornei nu poate modifica%' then v_n := v_n + 1;
    else v_text := v_text || sqlerrm || '; '; end if;
  end;
  begin
    update public.vehicle_handovers
       set deleted_at = now(), primitor_employee_id = v_e_hr, updated_by = v_u_admin
     where id = v_pv and deleted_at is null;
    get diagnostics v_k = row_count;
    raise exception using errcode = 'PVR01', message = 'parte schimbată la ștergere: ' || v_k || ' rânduri';
  exception when others then
    if sqlstate = 'P0001' and sqlerrm like 'Ștergerea ciornei nu poate modifica%' then v_n := v_n + 1;
    else v_text := v_text || sqlerrm || '; '; end if;
  end;
  begin
    update public.vehicle_handovers
       set nivel_rezervor = 'plin', stare_generala = 'buna', daune_constatate = false,
           stare = 'finalizat', deleted_at = now(), updated_by = v_u_admin
     where id = v_pv and deleted_at is null;
    get diagnostics v_k = row_count;
    raise exception using errcode = 'PVR01', message = 'finalizat și șters deodată: ' || v_k || ' rânduri';
  exception when others then
    if sqlstate = 'P0001' and sqlerrm like 'Ștergerea ciornei nu poate modifica%' then v_n := v_n + 1;
    else v_text := v_text || sqlerrm || '; '; end if;
  end;
  reset role;
  if v_n = 3 then
    raise notice '  ✓ (33) ștergerea ciornei nu scrie număr, părți sau finalizare (P0001 × 3)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (33) doar % din 3 ștergeri cu încărcătură refuzate: %', v_n, v_text;
  end if;

  -- ── (21) ștergerea: finalizatul refuză, ciorna trece ────────────────────
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    update public.vehicle_handovers set deleted_at = now(), updated_by = v_u_admin where id = v_pv2;
    v_text := 'sters';
  exception when raise_exception then
    v_text := 'P0001';
  end;
  begin
    update public.vehicle_handovers set deleted_at = now(), updated_by = v_u_admin
     where id = v_pv and deleted_at is null and stare = 'ciorna';
    get diagnostics v_n = row_count;
  exception when others then
    v_n := -1;
    v_mesaj := sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  if v_text = 'P0001' and v_n = 1 then
    raise notice '  ✓ (21) PV-ul finalizat nu se șterge (P0001); ciorna da, 1 rând, fără 42501';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (21) finalizat: %, ciornă: % rânduri %', v_text, v_n, v_mesaj;
  end if;

  -- ── (18) alocarea fără km îl primește din PV ────────────────────────────
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, created_by, updated_by)
  values (v_org, v_v4, v_e_b, now() - interval '3 days', v_u_admin, v_u_admin)
  returning id into v_al_c;
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_handovers (organization_id, alocare_primita_id, km_bord, nivel_rezervor,
                                          stare_generala, daune_constatate, created_by, updated_by)
    values (v_org, v_al_c, 7000, 'plin', 'buna', false, v_u_admin, v_u_admin)
    returning id into v_pv;
    update public.vehicle_handovers set stare = 'finalizat', updated_by = v_u_admin where id = v_pv;
    reset role;
    select km_predare into v_n from public.vehicle_assignments where id = v_al_c;
    if v_n = 7000 then
      raise notice '  ✓ (18) alocarea fără km primește km_predare = 7000 din PV';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (18) km_predare după PV: %', v_n;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (18) finalizarea pe alocare fără km: % (%)', sqlerrm, sqlstate;
  end;

  -- ── (21b) ciorna rămasă fără alocare se poate șterge ────────────────────
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, pana_la, created_by, updated_by)
  values (v_org, v_v5, v_e_b, now() - interval '40 days', now() - interval '35 days', v_u_admin, v_u_admin)
  returning id into v_al_e;
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  insert into public.vehicle_handovers (organization_id, alocare_predata_id, created_by, updated_by)
  values (v_org, v_al_e, v_u_admin, v_u_admin)
  returning id into v_pv;
  update public.vehicle_assignments set deleted_at = now(), updated_by = v_u_admin where id = v_al_e;
  begin
    update public.vehicle_handovers set deleted_at = now(), updated_by = v_u_admin
     where id = v_pv and deleted_at is null;
    get diagnostics v_n = row_count;
  exception when others then
    v_n := -1;
    v_mesaj := sqlerrm;
  end;
  reset role;
  if v_n = 1 then
    raise notice '  ✓ (21b) ciorna rămasă fără alocare se șterge';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (21b) ciorna orfană: % rânduri, %', v_n, v_mesaj;
  end if;

  -- ── (19) „fără daune” cu o daună ────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_handovers (organization_id, alocare_primita_id, daune_constatate, daune,
                                          created_by, updated_by)
    values (v_org, v_al_b, false, '[{"zona": "fata", "descriere": "Bară zgâriată"}]'::jsonb, v_u_admin, v_u_admin);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (19) „fără daune” cu o daună acceptat';
  exception when check_violation then
    reset role;
    if sqlerrm like '%pvv_daune_coerente_ck%' then
      raise notice '  ✓ (19) „fără daune” cu o daună: 23514 pvv_daune_coerente_ck';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (19) alt CHECK: %', sqlerrm;
    end if;
  end;

  -- ── (20) zonă necunoscută ───────────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_handovers (organization_id, alocare_primita_id, daune_constatate, daune,
                                          created_by, updated_by)
    values (v_org, v_al_b, true, '[{"zona": "portbagaj_secret", "descriere": "Lovitură"}]'::jsonb, v_u_admin, v_u_admin);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (20) zonă necunoscută acceptată';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (20) zonă de daună necunoscută: P0001';
  end;

  -- ── (23) transfer A → A ─────────────────────────────────────────────────
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, km_predare, created_by, updated_by)
  values (v_org, v_v6, v_e_a, now() - interval '10 days', 1000, v_u_admin, v_u_admin)
  returning id into v_al_f;
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, km_predare, folosinta_personala,
                                          created_by, updated_by)
  values (v_org, v_v6, v_e_a, now() - interval '2 days', 1200, true, v_u_admin, v_u_admin)
  returning id into v_al_g;
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_handovers (organization_id, alocare_predata_id, alocare_primita_id, created_by, updated_by)
    values (v_org, v_al_f, v_al_g, v_u_admin, v_u_admin);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (23) transfer A → A acceptat';
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Vehiculul rămâne la același șofer%' then
      raise notice '  ✓ (23) transfer A → A: P0001';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (23) alt mesaj: %', sqlerrm;
    end if;
  end;

  -- ── (24) restituire sub km de predare ───────────────────────────────────
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, km_predare, created_by, updated_by)
  values (v_org, v_v7, v_e_b, now() - interval '10 days', 2000, v_u_admin, v_u_admin)
  returning id into v_al_h;
  update public.vehicle_assignments set pana_la = now() - interval '1 day', updated_by = v_u_admin where id = v_al_h;
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.vehicle_handovers (organization_id, alocare_predata_id, km_bord, nivel_rezervor, stare_generala,
                                          daune_constatate, created_by, updated_by)
    values (v_org, v_al_h, 1500, 'plin', 'buna', false, v_u_admin, v_u_admin)
    returning id into v_pv;
    update public.vehicle_handovers set stare = 'finalizat', updated_by = v_u_admin where id = v_pv;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (24) restituire sub km de predare acceptată';
  exception
    when raise_exception then
      reset role;
      if sqlerrm like '%(1500 km) este mai mic decât cel de la predarea%(2000 km)%' then
        raise notice '  ✓ (24) restituire sub km de predare: P0001 pe km, nu 23514';
      else
        v_esecuri := v_esecuri + 1;
        raise warning '  ✗ (24) alt mesaj: %', sqlerrm;
      end if;
    when check_violation then
      reset role;
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (24) a ajuns la CHECK-ul brut: %', sqlerrm;
  end;

  -- ── (25) super_admin ────────────────────────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_sa::text, true);
  set local role authenticated;
  select count(*) into v_n from public.vehicle_handovers where organization_id = v_org and deleted_at is null;
  begin
    insert into public.vehicle_handovers (organization_id, alocare_primita_id, created_by, updated_by)
    values (v_org, v_al_c, v_u_sa, v_u_sa);
    v_text := 'inserat';
  exception when insufficient_privilege then
    v_text := '42501';
  end;
  reset role;
  if v_n >= 5 and v_text = '42501' then
    raise notice '  ✓ (25) super_admin vede % PV-uri și nu întocmește (42501)', v_n;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (25) super_admin: vede %, inserare %', v_n, v_text;
  end if;

  -- ── (27) finalizare pe vehicul șters ────────────────────────────────────
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, km_predare, created_by, updated_by)
  values (v_org, v_v8, v_e_b, now() - interval '10 days', 4000, v_u_admin, v_u_admin)
  returning id into v_al_i;
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  insert into public.vehicle_handovers (organization_id, alocare_primita_id, nivel_rezervor, stare_generala,
                                        daune_constatate, created_by, updated_by)
  values (v_org, v_al_i, 'plin', 'buna', false, v_u_admin, v_u_admin)
  returning id into v_pv;
  update public.vehicles set deleted_at = now(), updated_by = v_u_admin where id = v_v8;
  begin
    update public.vehicle_handovers set stare = 'finalizat', updated_by = v_u_admin where id = v_pv;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (27) PV finalizat pe un vehicul șters';
  exception when raise_exception then
    reset role;
    if sqlerrm like 'Vehiculul a fost șters%' then
      raise notice '  ✓ (27) vehicul șters: finalizarea refuză (P0001)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (27) alt mesaj: %', sqlerrm;
    end if;
  end;

  -- ── (22) anul de registru închis ────────────────────────────────────────
  -- La final: închiderea anului ar opri orice finalizare de după ea.
  select next_number into v_m from public.document_sequences
   where organization_id = v_org and document_type = 'pv_vehicul' and year = v_an;
  insert into public.registru_exercitii (organization_id, an, stare) values (v_org, v_an, 'inchis')
  on conflict do nothing;
  update public.registru_exercitii set stare = 'inchis' where organization_id = v_org and an = v_an;
  -- Alocarea lui Bogdan pe V1 e deschisă: o închidem ca să existe restituirea.
  update public.vehicle_assignments set pana_la = now() - interval '1 hour', km_restituire = 51500,
         updated_by = v_u_admin where id = v_al_b;
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  insert into public.vehicle_handovers (organization_id, alocare_predata_id, nivel_rezervor, stare_generala,
                                        daune_constatate, created_by, updated_by)
  values (v_org, v_al_b, 'plin', 'buna', false, v_u_admin, v_u_admin)
  returning id into v_pv;
  begin
    update public.vehicle_handovers set stare = 'finalizat', updated_by = v_u_admin where id = v_pv;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (22) finalizat într-un an de registru închis';
  exception when raise_exception then
    reset role;
    select count(*) into v_n from public.vehicle_handovers where id = v_pv and stare = 'ciorna' and numar = '';
    if sqlerrm like 'Registrul pe anul%este închis%' and v_n = 1
       and (select next_number from public.document_sequences
             where organization_id = v_org and document_type = 'pv_vehicul' and year = v_an) = v_m then
      raise notice '  ✓ (22) an de registru închis: P0001, ciorna rămâne, numărul PVA nu se arde (next_number = %)', v_m;
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (22) mesaj „%”, ciornă %, next_number % (înainte %)', sqlerrm, v_n,
        (select next_number from public.document_sequences
          where organization_id = v_org and document_type = 'pv_vehicul' and year = v_an), v_m;
    end if;
  end;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA FLOTA PV: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE cele 38 de verificări au trecut.';
  raise notice '';
end;
$$;
