-- tests/rls/proba-zi-respinsa-neplatita.sql
--
-- „O zi respinsă și necorectată NU e oră a firmei" — verificat acolo unde se
-- plătește: în `public.pontaj_agregat_salarizare`, singura sursă de pontaj a
-- calculului de salarii.
--
-- ── DE CE EXISTĂ ────────────────────────────────────────────────────────────
-- QA oct 2026: foaia colectivă, „Pontajul meu” și „Luna aceasta” scoteau ziua
-- respinsă din totaluri (`src/domain/attendance/totaluri.ts`), dar agregarea din
-- 0064 filtra doar pe `deleted_at`. Ziua respinsă intra în stat ca zi lucrată,
-- iar fluturașul nu se mai potrivea cu foaia de prezență. Defectul nu dă nicio
-- eroare — se vede doar pe bani, deci se verifică pe motorul real.
--
-- ── CE VERIFICĂ, PE RÂND ────────────────────────────────────────────────────
-- (1) angajatul își scrie DOUĂ zile, de câte 8 ore
-- (2) aprobatorul aprobă una și o respinge pe cealaltă
-- (3) agregarea numără DOAR ziua aprobată: 1 zi, 8 ore       ← reparația
-- (4) după corectură (marcajul stins), ziua intră la loc: 2 zile, 16 ore
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   psql "$BANC_URL" -f tests/rls/proba-zi-respinsa-neplatita.sql
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org      uuid := gen_random_uuid();
  v_u_admin  uuid := gen_random_uuid();
  v_u_ang    uuid := gen_random_uuid();
  v_dep      uuid := gen_random_uuid();
  v_poz      uuid := gen_random_uuid();
  v_ang      uuid := gen_random_uuid();
  v_per      uuid := gen_random_uuid();
  v_zi       date := date_trunc('month', app.azi_local())::date + 6;
  v_aprobata uuid;
  v_respinsa uuid;
  v_zile     numeric;
  v_ore      numeric;
  v_esecuri  int := 0;
begin
  raise notice '';
  raise notice '  PROBA ZILEI RESPINSE, NEPLĂTITE';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui)
  values (v_org, 'proba-respinsa-' || v_sufix, 'Proba Respinsă SRL',
          'RO' || (87000000 + (random() * 900000)::int)::text);

  insert into public.organization_features (organization_id, feature_key, enabled) values
    (v_org, 'nucleu', true), (v_org, 'attendance', true)
  on conflict (organization_id, feature_key) where deleted_at is null do nothing;

  insert into auth.users (id, email) values
    (v_u_admin, 'admin-' || v_sufix || '@proba.test'),
    (v_u_ang,   'ang-'   || v_sufix || '@proba.test');

  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_admin, 'org_admin'),
    (v_org, v_u_ang,   'employee');

  insert into public.departments (id, organization_id, cod, denumire)
  values (v_dep, v_org, 'D1', 'Producție');
  insert into public.job_positions (id, organization_id, cod, denumire)
  values (v_poz, v_org, 'P1', 'Operator');

  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                department_id, job_position_id, hired_on, status, user_id)
  values (v_ang, v_org, '001', 'Ana', 'Popescu', v_dep, v_poz,
          app.azi_local() - 400, 'activ', v_u_ang);

  insert into public.attendance_periods (id, organization_id, an, luna)
  values (v_per, v_org,
          extract(year from v_zi)::smallint, extract(month from v_zi)::smallint);

  -- ── (1) Angajatul își scrie cele două zile. ──
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  insert into public.attendance_entries
    (organization_id, employee_id, data, ora_inceput, ora_sfarsit, ore_lucrate, tip_zi)
  values (v_org, v_ang, v_zi, '08:00', '16:00', 8, 'lucratoare')
  returning id into v_aprobata;
  insert into public.attendance_entries
    (organization_id, employee_id, data, ora_inceput, ora_sfarsit, ore_lucrate, tip_zi)
  values (v_org, v_ang, v_zi - 1, '08:00', '16:00', 8, 'lucratoare')
  returning id into v_respinsa;
  reset role;

  raise notice '  (1) angajatul și-a scris cele două zile ... %',
    case when v_aprobata is null or v_respinsa is null then 'NU' else 'da ✓' end;
  if v_aprobata is null or v_respinsa is null then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) ANGAJATUL NU-ȘI POATE SCRIE ZILELE.';
  end if;

  -- ── (2) O zi aprobată, una respinsă. ──
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  perform public.decide_zi_pontaj(v_org, v_aprobata, true, null);
  perform public.decide_zi_pontaj(v_org, v_respinsa, false, 'Ziua nu apare în registrul de acces.');
  reset role;

  -- ── (3) Agregarea, sub identitatea celui care calculează salariile. ──
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  select a.zile_lucrate, a.ore_lucrate into v_zile, v_ore
    from public.pontaj_agregat_salarizare(v_per) a
   where a.employee_id = v_ang;
  reset role;

  raise notice '  (2)+(3) aprobată + respinsă ⇒ zile %, ore % (aștept 1 și 8)', v_zile, v_ore;
  if v_zile is distinct from 1 or v_ore is distinct from 8 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) ZIUA RESPINSĂ SE PLĂTEȘTE: agregarea a numărat % zile și % ore.', v_zile, v_ore;
  end if;

  -- ── (4) Corectura stinge marcajul; ziua redevine oră a firmei. ──
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  update public.attendance_entries
     set ora_sfarsit = '15:00', ore_lucrate = 7,
         respins_la = null, respins_de = null, motiv_respingere = null
   where id = v_respinsa
     and organization_id = v_org;
  reset role;

  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  select a.zile_lucrate, a.ore_lucrate into v_zile, v_ore
    from public.pontaj_agregat_salarizare(v_per) a
   where a.employee_id = v_ang;
  reset role;

  raise notice '  (4) după corectură ⇒ zile %, ore % (aștept 2 și 15)', v_zile, v_ore;
  if v_zile is distinct from 2 or v_ore is distinct from 15 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) ZIUA CORECTATĂ NU A REINTRAT în agregare: % zile, % ore.', v_zile, v_ore;
  end if;

  raise notice '';
  if v_esecuri > 0 then
    raise exception 'PROBA A EȘUAT: % verificări nepotrivite.', v_esecuri;
  end if;
  raise notice '  PROBA A TRECUT: ziua respinsă nu se plătește, iar cea corectată da.';
end
$$;
