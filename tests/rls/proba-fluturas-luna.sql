-- tests/rls/proba-fluturas-luna.sql
--
-- POARTA POZITIVĂ a lunii de pe fluturaș (0113): nu „angajatul nu vede
-- perioadele firmei", ci „angajatul CHIAR poate citi luna propriului fluturaș".
--
-- ── DEFECTUL PE CARE ÎL ȚINE ÎNCHIS ─────────────────────────────────────────
-- `payroll_entries` poartă doar `period_id`. Anul și luna stau în
-- `payroll_periods`, iar `payroll_periods_select` (0026:483) cerea
-- `payroll:read = 'all'`. Angajatul are `own`, deci primea ZERO RÂNDURI FĂRĂ
-- NICIO EROARE, iar portalul își scria fluturașul fără lună — `perioada={null}`
-- stătea literal în cod, cu un comentariu care cerea migrarea asta.
--
-- ── DE CE NU AJUNGE SĂ VERIFICI CĂ ANGAJATUL NU VEDE PREA MULT ──────────────
-- Partea ușoară e refuzul; el funcționa și înainte, prin faptul că refuza tot.
-- Verificarea (1) e singura care ar fi căzut înainte de 0113 și singura care va
-- cădea dacă cineva restrânge la loc politica. Restul o încadrează, ca lărgirea
-- să nu fi devenit o scurgere.
--
-- ── CE VERIFICĂ, PE RÂND ────────────────────────────────────────────────────
-- (1) angajatul vede perioada APROBATĂ în care are propriul fluturaș;
-- (2) NU vede perioada `draft` în care are fluturaș — starea perioadei rămâne
--     condiție, altfel ar afla că i se calculează ceva înainte de aprobare;
-- (3) NU vede o perioadă aprobată în care fluturașul e al ALTUI angajat;
-- (4) `org_admin` (scope `all`) vede în continuare toate perioadele firmei —
--     ramura veche n-a fost înlocuită, ci lărgită;
-- (5) `manager` (payroll:read = `none`) nu vede nimic;
-- (6) `org_admin`-ul firmei A nu vede perioadele firmei B — izolarea între
--     firme-client, care nu trebuie să se fi mișcat.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh --pastreaza
--   PORT=$(docker ps --filter name=administrativo-banc --format '{{.Ports}}' \
--          | grep -oE '0.0.0.0:[0-9]+' | head -1 | cut -d: -f2)
--   psql "postgresql://postgres:banc@localhost:$PORT/postgres" -f tests/rls/proba-fluturas-luna.sql
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  -- Sufix unic pe rulare: proba trebuie să poată fi repetată pe același banc.
  v_sufix     text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org_a     uuid := gen_random_uuid();
  v_org_b     uuid := gen_random_uuid();
  v_u_ang     uuid := gen_random_uuid();  -- angajatul care are fluturașul
  v_u_alt     uuid := gen_random_uuid();  -- alt angajat din aceeași firmă
  v_u_admin   uuid := gen_random_uuid();
  v_u_mgr     uuid := gen_random_uuid();
  v_e_ang     uuid;
  v_e_alt     uuid;
  v_ap_a      uuid;   -- perioada de pontaj (FK obligatoriu)
  v_set_a     uuid;   -- setările de salarizare (FK obligatoriu)
  v_ap_b      uuid;
  v_set_b     uuid;
  v_p_aprob   uuid := gen_random_uuid();  -- aprobată, fluturașul MEU
  v_p_draft   uuid := gen_random_uuid();  -- draft,    fluturașul MEU
  v_p_altul   uuid := gen_random_uuid();  -- aprobată, fluturașul ALTUIA
  v_p_b       uuid := gen_random_uuid();  -- aprobată, firma vecină
  v_vazute    int;
  v_esecuri   int := 0;
begin
  raise notice '';
  raise notice '  PROBA „LUNA PROPRIULUI FLUTURAȘ" (0113)';
  raise notice '  ─────────────────────────────────────────────────────────';

  -- ── Două firme, ca izolarea să aibă ce rupe dacă e ruptă. ──
  insert into public.organizations (id, slug, name, cui) values
    (v_org_a, 'proba-flut-a-' || v_sufix, 'Proba Fluturaș A SRL',
     'RO' || (89000000 + (random() * 900000)::int)::text),
    (v_org_b, 'proba-flut-b-' || v_sufix, 'Proba Fluturaș B SRL',
     'RO' || (89000000 + (random() * 900000)::int)::text);

  insert into public.organization_features (organization_id, feature_key, enabled) values
    (v_org_a, 'nucleu', true), (v_org_a, 'payroll', true), (v_org_a, 'attendance', true),
    (v_org_b, 'nucleu', true), (v_org_b, 'payroll', true), (v_org_b, 'attendance', true)
  on conflict (organization_id, feature_key) where deleted_at is null do nothing;

  insert into auth.users (id, email) values
    (v_u_ang,   'angajat-' || v_sufix || '@proba.test'),
    (v_u_alt,   'altul-'   || v_sufix || '@proba.test'),
    (v_u_admin, 'admin-'   || v_sufix || '@proba.test'),
    (v_u_mgr,   'mgr-'     || v_sufix || '@proba.test');

  insert into public.organization_members (organization_id, user_id, role) values
    (v_org_a, v_u_ang,   'employee'),
    (v_org_a, v_u_alt,   'employee'),
    (v_org_a, v_u_admin, 'org_admin'),
    (v_org_a, v_u_mgr,   'manager');

  -- `is_primary` explicit: `app.current_employee_id` chiar îl cere, iar o fișă
  -- secundară ar face toate verificările să treacă din motivul greșit.
  insert into public.employees (organization_id, marca, first_name, last_name, user_id, is_primary)
    values (v_org_a, 'A-' || v_sufix, 'Ana', 'Angajat', v_u_ang, true)
    returning id into v_e_ang;
  insert into public.employees (organization_id, marca, first_name, last_name, user_id, is_primary)
    values (v_org_a, 'B-' || v_sufix, 'Barbu', 'Altul', v_u_alt, true)
    returning id into v_e_alt;

  -- ── FK-urile obligatorii ale perioadei de salarizare. `data_inceput` și
  -- `data_sfarsit` le pune triggerul BEFORE din 0013, nu clientul. ──
  insert into public.attendance_periods (organization_id, an, luna)
    values (v_org_a, 2026, 1) returning id into v_ap_a;
  insert into public.attendance_periods (organization_id, an, luna)
    values (v_org_b, 2026, 1) returning id into v_ap_b;

  insert into public.payroll_settings
    (organization_id, valabil_de_la, cota_cas, cota_cass, cota_impozit, cota_cam_angajator)
    -- Cotele sunt FRACȚII, nu procente: `payroll_settings_cote_ck` cere
    -- `between 0 and 1`. Cifrele n-au nicio importanță pentru proba asta —
    -- contează doar că rândul există, fiindcă `payroll_periods.settings_id`
    -- e un FK obligatoriu.
    values (v_org_a, '2026-01-01', 0.25, 0.10, 0.10, 0.0225) returning id into v_set_a;
  insert into public.payroll_settings
    (organization_id, valabil_de_la, cota_cas, cota_cass, cota_impozit, cota_cam_angajator)
    values (v_org_b, '2026-01-01', 0.25, 0.10, 0.10, 0.0225) returning id into v_set_b;

  -- ── Patru perioade. Unicitatea e pe (firmă, an, lună), deci luni diferite. ──
  insert into public.payroll_periods
    (id, organization_id, an, luna, attendance_period_id, settings_id, status, aprobat_de) values
    (v_p_aprob, v_org_a, 2026, 1, v_ap_a, v_set_a, 'aprobat', v_u_admin),
    (v_p_altul, v_org_a, 2026, 3, v_ap_a, v_set_a, 'aprobat', v_u_admin),
    (v_p_b,     v_org_b, 2026, 1, v_ap_b, v_set_b, 'aprobat', v_u_admin);
  insert into public.payroll_periods
    (id, organization_id, an, luna, attendance_period_id, settings_id, status) values
    (v_p_draft, v_org_a, 2026, 2, v_ap_a, v_set_a, 'draft');

  insert into public.payroll_entries
    (organization_id, period_id, employee_id, zile_lucratoare_luna, settings_snapshot) values
    (v_org_a, v_p_aprob, v_e_ang, 21, '{}'::jsonb),
    (v_org_a, v_p_draft, v_e_ang, 21, '{}'::jsonb),
    (v_org_a, v_p_altul, v_e_alt, 21, '{}'::jsonb);

  -- ── (1) POARTA POZITIVĂ. Singura care cădea înainte de 0113. ──
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  select count(*) into v_vazute from public.payroll_periods where id = v_p_aprob;
  reset role;

  raise notice '  (1) angajatul vede luna fluturașului său ... % rânduri (aștept 1)', v_vazute;
  if v_vazute <> 1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) angajatul NU-și poate citi luna — fluturașul rămâne fără dată pe el.';
  end if;

  -- ── (2) Perioada `draft` rămâne închisă, deși are fluturașul lui. ──
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  select count(*) into v_vazute from public.payroll_periods where id = v_p_draft;
  reset role;

  raise notice '  (2) NU vede perioada `draft` a lui ......... % rânduri (aștept 0)', v_vazute;
  if v_vazute <> 0 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) angajatul vede o perioadă neaprobată — află că i se calculează ceva.';
  end if;

  -- ── (3) Perioada altui angajat, deși aprobată. ──
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  select count(*) into v_vazute from public.payroll_periods where id = v_p_altul;
  reset role;

  raise notice '  (3) NU vede perioada altui angajat ........ % rânduri (aștept 0)', v_vazute;
  if v_vazute <> 0 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) SCURGERE: ramura `own` s-a comportat ca `all`.';
  end if;

  -- ── (4) Ramura veche, neatinsă. ──
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  select count(*) into v_vazute from public.payroll_periods where organization_id = v_org_a;
  reset role;

  raise notice '  (4) org_admin vede toate perioadele ....... % rânduri (aștept 3)', v_vazute;
  if v_vazute <> 3 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) org_admin vede % perioade în loc de 3 — rescrierea a stricat ramura `all`.', v_vazute;
  end if;

  -- ── (5) `manager` are payroll:read = none. Absența unei permisiuni = refuz. ──
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  select count(*) into v_vazute from public.payroll_periods where organization_id = v_org_a;
  reset role;

  raise notice '  (5) managerul nu vede nicio perioadă ...... % rânduri (aștept 0)', v_vazute;
  if v_vazute <> 0 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) managerul vede % perioade, deși are payroll:read = none.', v_vazute;
  end if;

  -- ── (6) Izolarea între firme-client. ──
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  select count(*) into v_vazute from public.payroll_periods where organization_id = v_org_b;
  reset role;

  raise notice '  (6) org_admin NU vede firma vecină ........ % rânduri (aștept 0)', v_vazute;
  if v_vazute <> 0 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) SCURGERE ÎNTRE FIRME: se văd % perioade din firma B.', v_vazute;
  end if;

  raise notice '';
  if v_esecuri > 0 then
    raise exception 'PROBA A EȘUAT: % verificări nepotrivite.', v_esecuri;
  end if;
  raise notice '  PROBA A TRECUT: fluturașul își are luna, și numai a lui.';
end
$$;
