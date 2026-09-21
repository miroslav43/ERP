-- tests/rls/proba-bani-si-timp.sql
--
-- ORELE ȘI BANII, DUPĂ 0146.
--
-- ── DE CE EXISTĂ FIȘIERUL ───────────────────────────────────────────────────
-- Cele patru porți din 0146 stau pe drumul care duce la plată. Dacă una din ele
-- e prea strâmtă, nu se vede într-un ecran gol, ci într-un stat de plată care nu
-- se mai poate calcula — de-aia jumătate din verificările de aici sunt POZITIVE.
-- Dacă e prea largă, se vede într-un salariu fabricat.
--
-- ── CE VERIFICĂ, PE RÂND ────────────────────────────────────────────────────
-- (1) angajatul NU poate scrie 16 ore pe un interval de o oră;
-- (2) dar poate scrie o zi normală, 8 ore pe 09:00-17:00        [POZITIVĂ];
-- (3) fără interval, orele nu pot trece de norma zilnică;
-- (13) dar ziua declarată de homeoffice, la normă, se scrie    [POZITIVĂ];
-- (4) `hr` (scope `all`) rămâne liber să scrie orice, inclusiv tură de
--     noapte peste miezul nopții                                 [POZITIVĂ];
-- (5) UPDATE direct pe `payroll_entries` e refuzat;
-- (6) `payroll_scrie_rezultate` scrie în continuare               [POZITIVĂ];
-- (7) angajatul nu mai poate insera în `overtime_compensation`;
-- (8) triggerul de compensare a sărbătorii scrie în continuare    [POZITIVĂ];
-- (9) `approved_by` nu se poate falsifica: rămâne cine e logat;
-- (10) deținătorul deplasării nu și-o poate trece pe „aprobată";
-- (11) dar un aprobator poate                                     [POZITIVĂ];
-- (12) o zi dintr-o lună BLOCATĂ nu se mai poate muta în altă lună.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org      uuid := gen_random_uuid();
  v_u_hr     uuid := gen_random_uuid();
  v_u_ang    uuid := gen_random_uuid();
  v_u_mgr    uuid := gen_random_uuid();
  v_u_admin  uuid := gen_random_uuid();
  v_e_ang    uuid := gen_random_uuid();
  v_e_mgr    uuid := gen_random_uuid();
  v_contract uuid;
  v_perioada uuid;
  v_zi       date := date_trunc('month', current_date)::date + 9;
  v_intrare  uuid;
  v_deplasare uuid;
  v_luna     uuid;
  v_tara     uuid;
  v_rand     jsonb;
  v_actor    uuid;
  v_nr       int;
  v_atinse   int;
  v_esecuri  int := 0;
begin
  raise notice '';
  raise notice '  PROBA „BANI ȘI TIMP" (0146)';
  raise notice '  ─────────────────────────────────────────────────────────';

  -- ── fixture ───────────────────────────────────────────────────────────────
  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-bani-' || v_sufix, 'Proba Bani SRL',
     'RO' || (89000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select v_org, f.feature_key, true, now() from public.features f;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_hr,  'bani-hr-'  || v_sufix || '@proba.test', now()),
    (v_u_ang, 'bani-ang-' || v_sufix || '@proba.test', now()),
    (v_u_mgr, 'bani-mgr-' || v_sufix || '@proba.test', now()),
    (v_u_admin, 'bani-adm-' || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_hr,  'hr'),
    (v_org, v_u_ang, 'employee'),
    (v_org, v_u_mgr, 'manager'),
    (v_org, v_u_admin, 'org_admin');

  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_mgr, v_org, 'BANI-M', 'Mihai', 'Manager', app.azi_local() - 500, 'activ', v_u_mgr, null),
    (v_e_ang, v_org, 'BANI-A', 'Ana',   'Angajat', app.azi_local() - 400, 'activ', v_u_ang, v_e_mgr);

  -- Fără setări de pontaj, triggerul de compensare a sărbătorii nu are termen
  -- și iese tăcut — verificarea (8) ar fi raportat un defect inexistent.
  insert into public.attendance_settings
    (organization_id, valabil_de_la, ore_pe_zi, ore_pe_saptamana, ore_maxime_saptamanale,
     perioada_referinta_luni, repaus_zilnic_minim_ore, repaus_saptamanal_minim_ore,
     noapte_start, noapte_sfarsit, termen_compensare_suplimentare_zile,
     termen_compensare_sarbatoare_zile, pauza_masa_minute, pauza_masa_inclusa_in_program,
     pauza_obligatorie_peste_ore)
  values (v_org, app.azi_local() - 500, 8, 40, 48, 4, 12, 48, '22:00', '06:00', 60, 30, 30, false, 6);

  -- ═══ (1) Ore fabricate peste interval ═════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    insert into public.attendance_entries
      (organization_id, employee_id, data, ora_inceput, ora_sfarsit,
       ore_lucrate, ore_suplimentare, ore_noapte)
    values (v_org, v_e_ang, v_zi, '09:00', '10:00', 16, 8, 8);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) angajatul a scris 16 ore pe un interval de o oră';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (1) orele peste intervalul declarat sunt refuzate';
  end;

  -- ═══ (2) Ziua normală trece [POZITIVĂ] ════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    insert into public.attendance_entries
      (organization_id, employee_id, data, ora_inceput, ora_sfarsit, ore_lucrate)
    values (v_org, v_e_ang, v_zi, '09:00', '17:00', 8)
    returning id into v_intrare;
    reset role;
    raise notice '  ✓ (2) ziua normală de 8 ore se scrie';
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) ziua normală a fost refuzată: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (3) Ore fără interval ════════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    insert into public.attendance_entries
      (organization_id, employee_id, data, ore_lucrate)
    values (v_org, v_e_ang, v_zi + 1, 12);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) s-au scris ore fără interval';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (3) orele peste normă, fără interval, sunt refuzate';
  end;

  -- ═══ (13) Ziua declarată, la normă [POZITIVĂ] ═════════════════════════════
  -- Cazul pe care verificarea (l) din `tests/rls/izolare.sql` îl numără printre
  -- scrierile legitime ale unui `employee`: telemunca trecută cu norma
  -- întreagă, fără ceas. Prima formă a gărzii din 0146 o refuza.
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    insert into public.attendance_entries
      (organization_id, employee_id, data, ore_lucrate, tip_zi, tip_prezenta)
    values (v_org, v_e_ang, v_zi + 4, 8, 'lucratoare', 'homeoffice');
    reset role;
    raise notice '  ✓ (13) ziua declarată de homeoffice, la normă, se scrie';
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (13) ziua de homeoffice a fost refuzată: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (4) `hr` rămâne liber [POZITIVĂ] ═════════════════════════════════════
  -- Tura de noapte trece peste miezul nopții: `ora_sfarsit < ora_inceput`, deci
  -- plafonul nici nu se aplică. Exact cazul pe care aplicația îl trimite la
  -- „responsabilul de pontaj".
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  begin
    insert into public.attendance_entries
      (organization_id, employee_id, data, ora_inceput, ora_sfarsit,
       ore_lucrate, ore_noapte)
    values (v_org, v_e_ang, v_zi + 2, '22:00', '06:00', 8, 7);
    reset role;
    raise notice '  ✓ (4) `hr` scrie tura de noapte peste miezul nopții';
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) `hr` nu mai poate scrie tura de noapte: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (5) UPDATE direct pe salarii ═════════════════════════════════════════
  insert into public.employment_contracts
    (organization_id, employee_id, numar, data_contract, valabil_de_la, salariu_baza)
  values (v_org, v_e_ang, 'C-' || v_sufix, app.azi_local() - 400, app.azi_local() - 400, 5000)
  returning id into v_contract;

  -- Perioada de salarizare se leagă de luna de pontaj deschisă la (2) și de
  -- setările firmei (cotele legale).
  select period_id into v_luna from public.attendance_entries where id = v_intrare;
  insert into public.payroll_settings
    (organization_id, valabil_de_la, cota_cas, cota_cass, cota_impozit, cota_cam_angajator)
  values (v_org, app.azi_local() - 400, 0.25, 0.10, 0.10, 0.0225)
  on conflict do nothing;
  insert into public.payroll_periods (organization_id, an, luna, status, attendance_period_id, settings_id)
  values (v_org, extract(year from v_zi)::smallint, extract(month from v_zi)::smallint, 'draft',
          v_luna, (select id from public.payroll_settings where organization_id = v_org limit 1))
  returning id into v_perioada;

  v_rand := jsonb_build_object(
    'employee_id', v_e_ang, 'contract_id', v_contract, 'status', 'calculat',
    'zile_lucratoare_luna', 21, 'zile_lucrate', 21, 'zile_concediu_odihna', 0,
    'zile_concediu_medical', 0, 'zile_absenta_nemotivata', 0, 'zile_fara_plata', 0,
    'ore_lucrate', 168, 'ore_suplimentare', 0, 'ore_noapte', 0,
    'baza_salariu', 5000, 'suma_ore_suplimentare', 0, 'spor_noapte', 0,
    'prime_total', 0, 'brut', 5000, 'nr_tichete', 0, 'valoare_tichete', 0,
    'baza_cas_cass', 5000, 'cas', 1250, 'cass', 500, 'deducere_personala', 0,
    'baza_impozit', 3250, 'impozit', 325, 'cam_angajator', 112, 'net', 2925,
    'retineri_total', 0, 'net_de_plata', 2925, 'cost_total_angajator', 5112,
    'settings_snapshot', '{}'::jsonb, 'calc_breakdown', '{}'::jsonb,
    'calc_warnings', '[]'::jsonb, 'calculat_la', now(),
    'scutire_fiscala', 0, 'zile_repaus_lucrate', 0,
    'zile_sarbatoare_lucrate', 0, 'ore_repaus', 0, 'ore_sarbatoare', 0,
    'spor_repaus', 0, 'spor_sarbatoare', 0
  );

  -- ═══ (6) Motorul scrie [POZITIVĂ] ═════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  begin
    perform public.payroll_scrie_rezultate(v_perioada, jsonb_build_array(v_rand));
    reset role;
    select count(*) into v_nr from public.payroll_entries where period_id = v_perioada;
    if v_nr = 1 then
      raise notice '  ✓ (6) `payroll_scrie_rezultate` scrie rândul de salariu';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (6) motorul n-a scris nimic (% rânduri)', v_nr;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) motorul de salarizare a fost blocat: % (%)', sqlerrm, sqlstate;
  end;

  -- Steagul pus de motor e local pe TRANZACȚIE, iar proba rulează totul într-una
  -- singură. PostgREST dă fiecărei cereri tranzacția ei, deci în producție un
  -- PATCH direct pornește mereu cu steagul stins — aici îl stingem noi, ca să
  -- măsurăm exact acel caz.
  perform set_config('app.payroll_scrie', 'off', true);
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  begin
    update public.payroll_entries set net_de_plata = 99999
     where period_id = v_perioada;
    get diagnostics v_atinse = row_count;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) UPDATE direct pe salariu a trecut (% rânduri)', v_atinse;
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (5) UPDATE direct pe `payroll_entries` e refuzat';
  end;

  -- ═══ (7) Compensarea de ore nu se mai scrie din client ════════════════════
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    insert into public.overtime_compensation
      (organization_id, employee_id, data_generarii, ore, termen_folosire, ore_folosite, ore_expirate)
    values (v_org, v_e_ang, v_zi, 999.99, v_zi + 60, 0, 0);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) angajatul a scris în `overtime_compensation`';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (7) `overtime_compensation` nu mai e scriibilă din client';
  end;

  -- ═══ (8) Triggerul de sărbătoare scrie în continuare [POZITIVĂ] ═══════════
  -- Ziua de sărbătoare legală o pune `hr`; triggerul AFTER generează rândul de
  -- compensare, cu drepturile proprietarului, deci revocarea de mai sus nu-l
  -- atinge.
  select count(*) into v_nr from public.holiday_compensation
   where organization_id = v_org and employee_id = v_e_ang;
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  begin
    insert into public.attendance_entries
      (organization_id, employee_id, data, tip_zi, ora_inceput, ora_sfarsit, ore_lucrate)
    values (v_org, v_e_ang, v_zi + 3, 'sarbatoare', '09:00', '17:00', 8);
    reset role;
    select count(*) into v_atinse from public.holiday_compensation
     where organization_id = v_org and employee_id = v_e_ang;
    if v_atinse > v_nr then
      raise notice '  ✓ (8) triggerul de compensare a sărbătorii scrie în continuare';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (8) compensarea sărbătorii nu s-a mai scris (% → %)', v_nr, v_atinse;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) ziua de sărbătoare a fost refuzată: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (9) `approved_by` nu se falsifică ════════════════════════════════════
  -- Aprobă `org_admin`. Nu e o alegere de comoditate: e SINGURUL rol care poate
  -- aproba printr-un UPDATE direct. Managerul are `attendance:approve = team`
  -- dar nu și `attendance:create`, deci USING-ul politicii îl oprește (el aprobă
  -- prin `decide_zi_pontaj`); `hr` are create dar `approve = none`, deci
  -- WITH CHECK-ul îl oprește. Ce se măsoară aici e falsificarea ACTORULUI.
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  update public.attendance_entries
     set approved_at = now(), approved_by = v_u_ang
   where id = v_intrare;
  reset role;
  select approved_by into v_actor from public.attendance_entries where id = v_intrare;
  if v_actor = v_u_admin then
    raise notice '  ✓ (9) `approved_by` rămâne cine e logat, nu cine scrie cererea';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) `approved_by` a fost falsificat (%)', v_actor;
  end if;

  -- ═══ (10) Deținătorul nu-și aprobă deplasarea ═════════════════════════════
  select c.id into v_tara from public.countries c where c.cod_alpha2 = 'RO' limit 1;
  insert into public.per_diem_policies
    (organization_id, denumire, country_id_intern, moneda_interna, diurna_interna_zi,
     diurna_baza_legala_interna, multiplu_plafon_neimpozabil, multiplu_diurna_externa,
     prag_ore_minim, prag_ore_zi_intreaga, fractiune_zi_partiala, tarif_km_auto_personal,
     moneda_tarif_km, plafon_salarii_baza_luna, valabil_de_la)
  values (v_org, 'Politica de probă', v_tara, 'RON', 50, 50, 2.5, 2.5,
          12, 24, 0.5, 0.5, 'RON', 0.033, app.azi_local() - 400);

  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  insert into public.business_trips
    (organization_id, employee_id, country_id, localitate, plecare_la, sosire_la, status, scop,
     mijloc_transport)
  values (v_org, v_e_ang, v_tara, 'Cluj-Napoca', now(), now() + interval '2 days', 'ciorna',
          'Probă', 'auto_personal')
  returning id into v_deplasare;

  begin
    update public.business_trips set status = 'aprobata' where id = v_deplasare;
    get diagnostics v_atinse = row_count;
    reset role;
    if v_atinse = 0 then
      raise notice '  ✓ (10) deținătorul nu-și poate aproba deplasarea (0 rânduri)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (10) deținătorul și-a aprobat singur deplasarea';
    end if;
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (10) deținătorul nu-și poate aproba deplasarea (refuz explicit)';
  end;

  -- ═══ (11) Aprobatorul poate [POZITIVĂ] ════════════════════════════════════
  -- `hr` NU are `per_diem:approve` în seed (are doar `manager` pe echipă și
  -- `org_admin` peste tot) — aprobatorul de aici e `org_admin`.
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    update public.business_trips set status = 'aprobata' where id = v_deplasare;
    get diagnostics v_atinse = row_count;
    reset role;
    if v_atinse = 1 then
      raise notice '  ✓ (11) aprobatorul trece deplasarea pe „aprobată"';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (11) aprobatorul nu mai poate aproba (% rânduri)', v_atinse;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (11) aprobarea legitimă a eșuat: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (12) Ziua nu iese dintr-o lună blocată ═══════════════════════════════
  select period_id into v_luna from public.attendance_entries where id = v_intrare;
  update public.attendance_periods set status = 'blocata' where id = v_luna;

  -- Mută `org_admin`: e singurul care trece de USING-ul politicii pe o zi deja
  -- aprobată (are `attendance:approve = all`). Cu `hr` verificarea ar fi ieșit
  -- verde din alt motiv — zero rânduri atinse de RLS — fără să spună nimic
  -- despre garda din trigger.
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    update public.attendance_entries
       set data = (date_trunc('month', v_zi) + interval '1 month')::date + 5
     where id = v_intrare;
    reset role;
    select count(*) into v_nr from public.attendance_entries
     where id = v_intrare and data = v_zi;
    if v_nr = 1 then
      raise notice '  ✓ (12) ziua dintr-o lună blocată n-a fost mutată (zero rânduri atinse)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (12) ziua a fost mutată dintr-o lună blocată';
    end if;
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (12) ziua dintr-o lună blocată nu se mai poate muta';
  end;

  -- ── verdict ───────────────────────────────────────────────────────────────
  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA BANI ȘI TIMP: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE cele 13 verificări au trecut.';
  raise notice '';
end;
$$;
