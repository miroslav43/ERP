-- tests/rls/proba-saptamana-concediu.sql
--
-- POARTA POZITIVĂ a planului săptămânal (0133): nu „ziua de concediu nu se
-- planifică", ci „restul săptămânii CHIAR se salvează, iar zilele sărite se
-- SPUN".
--
-- ── DE CE EXISTĂ PROBA ──────────────────────────────────────────────────────
-- Pontajul se scrie pe DOUĂ drumuri, iar până la 0133 doar unul se uita la
-- concedii: `salveazaZiPontaj` refuza ziua cu concediu aprobat de la 0013
-- încoace, iar `trimite_saptamana_pontaj` nu verifica nimic. Un angajat cu
-- concediu aprobat pe 12–13 octombrie își putea planifica muncă exact atunci,
-- fără niciun semn — iar comentariul din acțiunea de zi promitea de mult
-- refuzul „zi din concediu" ca pe o regulă a MODULULUI, când era a unei
-- singure funcții.
--
-- Clasa de defect e mai largă decât cazul: o gardă pusă pe un drum și uitată pe
-- celălalt nu se vede nici la typecheck, nici la lint, nici în teste — se vede
-- doar când cineva încearcă exact combinația.
--
-- ── CE VERIFICĂ, PE RÂND ────────────────────────────────────────────────────
-- (1) zilele FĂRĂ concediu chiar se salvează            ← poarta pozitivă
-- (2) ziua cu concediu aprobat NU intră în plan
-- (3) funcția RAPORTEAZĂ ziua sărită, nu tace
-- (4) ziua de concediu din `attendance_entries` rămâne NEATINSĂ
-- (5) o săptămână fără niciun concediu nu raportează nimic
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   psql "$BANC_URL" -f tests/rls/proba-saptamana-concediu.sql
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org      uuid := gen_random_uuid();
  v_u_ang    uuid := gen_random_uuid();
  v_e_ang    uuid;
  v_cerere   uuid;
  v_luni     date;
  v_marti    date;
  v_miercuri date;
  v_rezultat jsonb;
  v_zile     int;
  v_ore      numeric;
  v_esecuri  int := 0;
begin
  raise notice '';
  raise notice '  PROBA „SĂPTĂMÂNA SARE PESTE CONCEDIU" (0133)';
  raise notice '  ─────────────────────────────────────────────────────────';

  -- Luni din săptămâna viitoare: planul e, prin natura lui, în viitor.
  v_luni     := date_trunc('week', current_date + interval '7 days')::date;
  v_marti    := v_luni + 1;
  v_miercuri := v_luni + 2;

  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-sapt-' || v_sufix, 'Proba Săptămână SRL',
     'RO' || (89000000 + (random() * 900000)::int)::text);

  insert into public.organization_features (organization_id, feature_key, enabled) values
    (v_org, 'nucleu', true), (v_org, 'attendance', true), (v_org, 'leave', true)
  on conflict (organization_id, feature_key) where deleted_at is null do nothing;

  insert into auth.users (id, email) values (v_u_ang, 'ang-' || v_sufix || '@proba.test');
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_ang, 'employee');

  -- `is_primary` explicit: `app.current_employee_id` chiar îl cere.
  insert into public.employees (organization_id, marca, first_name, last_name, user_id, is_primary)
    values (v_org, 'S-' || v_sufix, 'Ana', 'Angajat', v_u_ang, true)
    returning id into v_e_ang;

  -- ── Concediu APROBAT marți, cu urma lui în pontaj ──
  -- Sursa pe care o citește garda e `attendance_entries.leave_request_id`, nu
  -- `leave_requests`: acolo ajunge concediul prin sincronizare, și e aceeași
  -- coloană pe care o citește garda din `salveazaZiPontaj`.
  insert into public.leave_requests
    (organization_id, employee_id, leave_type_id, data_inceput, data_sfarsit, status, created_by)
  values (
    v_org, v_e_ang,
    (select lt.id from public.leave_types lt
      where lt.organization_id = v_org and lt.key = 'odihna' and lt.deleted_at is null limit 1),
    v_marti, v_marti, 'aprobata', v_u_ang)
  returning id into v_cerere;

  insert into public.attendance_entries
    (organization_id, employee_id, data, ore_lucrate, tip_zi, leave_request_id, sursa)
  values (v_org, v_e_ang, v_marti, 0, 'concediu', v_cerere, 'sincronizare_concedii');

  -- ── Planul săptămânal: luni, marți (concediu) și miercuri ──
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  v_rezultat := public.trimite_saptamana_pontaj(
    v_org, v_luni, 'ciorna',
    jsonb_build_array(
      jsonb_build_object('data', v_luni::text,     'tip_prezenta', 'birou',
                         'ora_inceput', '09:00', 'ora_sfarsit', '17:00', 'ore_planificate', 8),
      jsonb_build_object('data', v_marti::text,    'tip_prezenta', 'birou',
                         'ora_inceput', '09:00', 'ora_sfarsit', '17:00', 'ore_planificate', 8),
      jsonb_build_object('data', v_miercuri::text, 'tip_prezenta', 'birou',
                         'ora_inceput', '09:00', 'ora_sfarsit', '17:00', 'ore_planificate', 8)
    ));
  reset role;

  -- ── (1) POARTA POZITIVĂ ──
  select count(*) into v_zile
    from public.attendance_week_submission_days d
   where d.submission_id = (v_rezultat ->> 'submission_id')::uuid;
  if v_zile = 2 then
    raise notice '  ✓ (1) cele două zile fără concediu s-au salvat';
  else
    raise warning '  ✗ (1) s-au salvat % zile, se așteptau 2 — restul săptămânii NU se mai salvează.', v_zile;
    v_esecuri := v_esecuri + 1;
  end if;

  -- ── (2) ziua cu concediu nu intră ──
  if not exists (
    select 1 from public.attendance_week_submission_days d
     where d.submission_id = (v_rezultat ->> 'submission_id')::uuid and d.data = v_marti
  ) then
    raise notice '  ✓ (2) ziua cu concediu aprobat nu a intrat în plan';
  else
    raise warning '  ✗ (2) ziua de concediu A INTRAT în plan — se plătește și ca muncă, și ca zi de concediu.';
    v_esecuri := v_esecuri + 1;
  end if;

  -- ── (3) și se SPUNE, nu se sare tăcut ──
  if v_rezultat -> 'zile_sarite' @> to_jsonb(v_marti)
     and jsonb_array_length(v_rezultat -> 'zile_sarite') = 1 then
    raise notice '  ✓ (3) ziua sărită e raportată apelantului';
  else
    raise warning '  ✗ (3) zilele sărite nu se raportează (%) — omul crede că a planificat 3 zile.',
      coalesce((v_rezultat -> 'zile_sarite')::text, 'lipsă');
    v_esecuri := v_esecuri + 1;
  end if;

  -- ── (4) ziua de concediu rămâne neatinsă ──
  select ae.ore_lucrate into v_ore
    from public.attendance_entries ae
   where ae.organization_id = v_org and ae.employee_id = v_e_ang and ae.data = v_marti;
  if v_ore = 0 then
    raise notice '  ✓ (4) ziua de concediu din pontaj a rămas la 0 ore';
  else
    raise warning '  ✗ (4) ziua de concediu are acum % ore lucrate.', v_ore;
    v_esecuri := v_esecuri + 1;
  end if;

  -- ── (5) fără concediu, nimic de raportat ──
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  v_rezultat := public.trimite_saptamana_pontaj(
    v_org, v_luni, 'ciorna',
    jsonb_build_array(
      jsonb_build_object('data', v_miercuri::text, 'tip_prezenta', 'birou',
                         'ora_inceput', '09:00', 'ora_sfarsit', '17:00', 'ore_planificate', 8)
    ));
  reset role;

  if jsonb_array_length(v_rezultat -> 'zile_sarite') = 0 then
    raise notice '  ✓ (5) o săptămână fără concediu nu raportează nimic';
  else
    raise warning '  ✗ (5) s-au raportat zile sărite fără să existe concediu: %',
      (v_rezultat -> 'zile_sarite')::text;
    v_esecuri := v_esecuri + 1;
  end if;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri = 0 then
    raise notice '  TOT VERDE — planul sare peste concediu și o spune.';
  else
    raise exception 'PROBA SĂPTĂMÂNĂ/CONCEDIU: % verificări picate.', v_esecuri;
  end if;
  raise notice '';
end $$;
