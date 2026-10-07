-- tests/rls/proba-plasa-saptamani.sql
--
-- PLASA ZILNICĂ PENTRU SĂPTĂMÂNILE APROBATE FĂRĂ PONTAJ, DUPĂ 0169.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- (1) ziua lucrătoare aprobată ajunge în pontaj, cu orele lui `oreleZilei`
--     (08:30–17:00, pauză 30 min peste 6 h → 8,00) și aprobată  [POZITIVĂ];
-- (2) sâmbăta NU se scrie — tipul zilei schimbă sporul, cere un om;
-- (3) administratorul firmei e anunțat despre sâmbăta rămasă   [POZITIVĂ];
-- (4) la o firmă pe zi FĂRĂ aprobare, săptămâna e plan — nu se atinge;
-- (5) a doua rulare nu mai scrie nimic și nu dublează anunțul.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix   text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org     uuid := gen_random_uuid();
  v_plan    uuid := gen_random_uuid();
  v_u_adm   uuid := gen_random_uuid();
  v_u_ang   uuid := gen_random_uuid();
  v_u_ang2  uuid := gen_random_uuid();
  v_e_ang   uuid := gen_random_uuid();
  v_e_ang2  uuid := gen_random_uuid();
  v_luni    date := date_trunc('week', app.azi_local() - 14)::date;
  v_sub     uuid;
  v_sub2    uuid;
  v_scrise  int;
  v_numar   int;
  v_esecuri int := 0;
begin
  raise notice '';
  raise notice '  PROBA „PLASA SĂPTĂMÂNILOR APROBATE" (0169)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org,  'proba-plasa-' || v_sufix,   'Proba Plasă SRL',
     'RO' || (83000000 + (random() * 900000)::int)::text),
    (v_plan, 'proba-plasa-p-' || v_sufix, 'Proba Plan SRL',
     'RO' || (82000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select o, f.feature_key, true, now() from public.features f, unnest(array[v_org, v_plan]) o;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_adm,  'plasa-adm-'  || v_sufix || '@proba.test', now()),
    (v_u_ang,  'plasa-ang-'  || v_sufix || '@proba.test', now()),
    (v_u_ang2, 'plasa-ang2-' || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org,  v_u_adm,  'org_admin'),
    (v_org,  v_u_ang,  'employee'),
    (v_plan, v_u_ang2, 'employee');

  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id) values
    (v_e_ang,  v_org,  'PLASA-1', 'Ana',  'Plasă', app.azi_local() - 400, 'activ', v_u_ang),
    (v_e_ang2, v_plan, 'PLASA-2', 'Paul', 'Plan',  app.azi_local() - 400, 'activ', v_u_ang2);

  insert into public.attendance_settings (organization_id, valabil_de_la, ore_pe_zi, ore_pe_saptamana,
    ore_maxime_saptamanale, perioada_referinta_luni, repaus_zilnic_minim_ore, repaus_saptamanal_minim_ore,
    spor_suplimentare_procent, spor_noapte_procent, spor_weekend_procent, spor_sarbatoare_procent,
    noapte_start, noapte_sfarsit, termen_compensare_suplimentare_zile, termen_compensare_sarbatoare_zile,
    pauza_masa_minute, pauza_masa_inclusa_in_program, pauza_obligatorie_peste_ore)
  select o, app.azi_local() - 400, 8, 40, 48, 3, 12, 24, 75, 25, 100, 100, '22:00', '06:00',
         60, 30, 30, false, 6
    from unnest(array[v_org, v_plan]) o;

  -- Firma „plan": pe zi, FĂRĂ aprobare.
  insert into public.setari_pontare_rapida (organization_id, mod_pontare_rapida,
                                            verificare_pontare, necesita_aprobare)
  values (v_plan, 'ceas', 'fara', false);

  -- Câte o săptămână aprobată acum două ore, cu luni și sâmbătă completate.
  insert into public.attendance_week_submissions
    (organization_id, employee_id, saptamana_start, status, trimisa_la, decis_la, decis_de)
  values (v_org, v_e_ang, v_luni, 'aprobata', now() - interval '3 hours',
          now() - interval '2 hours', v_u_adm)
  returning id into v_sub;
  insert into public.attendance_week_submissions
    (organization_id, employee_id, saptamana_start, status, trimisa_la, decis_la, decis_de)
  values (v_plan, v_e_ang2, v_luni, 'aprobata', now() - interval '3 hours',
          now() - interval '2 hours', v_u_ang2)
  returning id into v_sub2;
  -- `decis_la` din nou, după triggerul actorului: insert-ul l-ar fi pus pe `now()`.
  update public.attendance_week_submissions set decis_la = now() - interval '2 hours'
   where id in (v_sub, v_sub2);

  insert into public.attendance_week_submission_days
    (organization_id, submission_id, data, tip_prezenta, ora_inceput, ora_sfarsit, ore_planificate)
  values
    (v_org,  v_sub,  v_luni,     'birou', '08:30', '17:00', 8),
    (v_org,  v_sub,  v_luni + 5, 'birou', '09:00', '13:00', 4),
    (v_plan, v_sub2, v_luni,     'birou', '08:30', '17:00', 8);

  v_scrise := internal.recupereaza_saptamani_fara_pontaj();

  -- (1)
  if exists (
    select 1 from public.attendance_entries
     where employee_id = v_e_ang and data = v_luni and deleted_at is null
       and ore_lucrate = 8 and sursa = 'saptamana' and approved_at is not null
       and approved_by = v_u_adm
  ) then
    raise notice '  ✓ (1) ziua lucrătoare a ajuns în pontaj, 8,00 h, aprobată';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) ziua lucrătoare lipsește sau are alte ore (scrise: %)', v_scrise;
  end if;

  -- (2)
  if not exists (
    select 1 from public.attendance_entries
     where employee_id = v_e_ang and data = v_luni + 5 and deleted_at is null
  ) then
    raise notice '  ✓ (2) sâmbăta nu se scrie automat';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) sâmbăta a fost scrisă fără om';
  end if;

  -- (3)
  select count(*) into v_numar from public.notifications
   where user_id = v_u_adm and entity_type = 'attendance_week_submission_fara_pontaj'
     and entity_id = v_sub;
  if v_numar = 1 then
    raise notice '  ✓ (3) administratorul e anunțat despre ziua rămasă';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) administratorul are % anunțuri, nu 1', v_numar;
  end if;

  -- (4)
  if not exists (
    select 1 from public.attendance_entries where employee_id = v_e_ang2 and deleted_at is null
  ) then
    raise notice '  ✓ (4) planul unei firme fără aprobare rămâne plan';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) planul firmei fără aprobare a fost scris în pontaj';
  end if;

  -- (5)
  v_scrise := internal.recupereaza_saptamani_fara_pontaj();
  select count(*) into v_numar from public.notifications
   where user_id = v_u_adm and entity_type = 'attendance_week_submission_fara_pontaj'
     and entity_id = v_sub;
  if v_scrise = 0 and v_numar = 1 then
    raise notice '  ✓ (5) a doua rulare nu scrie nimic și nu dublează anunțul';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) a doua rulare: % zile scrise, % anunțuri', v_scrise, v_numar;
  end if;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA PLASA SĂPTĂMÂNI: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE cele 5 verificări au trecut.';
  raise notice '';
end;
$$;
