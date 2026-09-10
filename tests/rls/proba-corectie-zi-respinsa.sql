-- tests/rls/proba-corectie-zi-respinsa.sql
--
-- POARTA POZITIVĂ a corecției: „angajatul CHIAR poate repara ziua care i-a fost
-- respinsă", inclusiv într-o lună trecută în `in_aprobare`.
--
-- ── DE CE EXISTĂ ────────────────────────────────────────────────────────────
-- Reclamat pe 11 sept 2026: o zi respinsă, iar portalul răspundea „luna nu este
-- deschisă pentru pontaj" — deși luna nu era blocată, ci doar `in_aprobare`,
-- stare în care baza acceptă scrierea (0013:293 verifică EXCLUSIV `blocata`).
-- Fundătura era completă: i se cerea o corecție pe care ecranul nu-l lăsa s-o
-- facă.
--
-- Verificarea trebuie făcută pe MOTORUL REAL fiindcă defectul era pur de ecran:
-- baza n-a fost niciodată atinsă, deci nu exista nici eroare, nici log. Singurul
-- fel de a ști cine avea dreptate e să scrii efectiv sub identitatea omului.
--
-- ── CE VERIFICĂ, PE RÂND ────────────────────────────────────────────────────
-- (1) angajatul își scrie ziua într-o lună `deschisa`
-- (2) aprobatorul o respinge; `approved_at` se stinge, motivul rămâne
-- (3) luna trece în `in_aprobare`
-- (4) angajatul CHIAR poate corecta ziua acolo             ← poarta pozitivă
-- (5) corecția stinge marcajul de respingere               ← altfel rămâne „respinsă” pe veci
-- (6) constrângerea cere cele trei coloane stinse ÎMPREUNĂ
-- (7) luna BLOCATĂ chiar refuză corecția
-- (8) respingerea fără motiv e refuzată
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   psql "$BANC_URL" -f tests/rls/proba-corectie-zi-respinsa.sql
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix   text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org     uuid := gen_random_uuid();
  v_u_admin uuid := gen_random_uuid();
  v_u_ang   uuid := gen_random_uuid();
  v_dep     uuid := gen_random_uuid();
  v_poz     uuid := gen_random_uuid();
  v_ang     uuid := gen_random_uuid();
  v_per     uuid := gen_random_uuid();
  v_zi      date := date_trunc('month', app.azi_local())::date + 6;
  v_intrare uuid;
  v_randuri int;
  v_respins timestamptz;
  v_esecuri int := 0;
  v_a_mers  boolean;
begin
  raise notice '';
  raise notice '  PROBA CORECȚIEI UNEI ZILE RESPINSE';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui)
  values (v_org, 'proba-corectie-' || v_sufix, 'Proba Corecție SRL',
          'RO' || (86000000 + (random() * 900000)::int)::text);

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

  -- ── (1) Angajatul își scrie ziua. ──
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  insert into public.attendance_entries
    (organization_id, employee_id, data, ora_inceput, ora_sfarsit, ore_lucrate, tip_zi)
  values (v_org, v_ang, v_zi, '08:00', '20:00', 12, 'lucratoare')
  returning id into v_intrare;
  reset role;

  raise notice '  (1) angajatul și-a scris ziua ............. %',
    case when v_intrare is null then 'NU' else 'da ✓' end;
  if v_intrare is null then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) ANGAJATUL NU-ȘI POATE SCRIE ZIUA.';
  end if;

  -- ── (8) Respingerea fără motiv e refuzată. ──
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    perform public.decide_zi_pontaj(v_org, v_intrare, false, 'ok');
    v_a_mers := true;
  exception when others then
    v_a_mers := false;
  end;
  reset role;

  raise notice '  (8) respingerea fără motiv e refuzată ..... %',
    case when v_a_mers then 'A MERS' else 'refuzat ✓' end;
  if v_a_mers then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) S-A RESPINS cu un motiv de 2 caractere.';
  end if;

  -- ── (2) Respingerea, cu motiv. ──
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  perform public.decide_zi_pontaj(v_org, v_intrare, false, 'Ai trecut 12 ore pe o zi de 8.');
  reset role;

  select respins_la into v_respins from public.attendance_entries where id = v_intrare;
  raise notice '  (2) ziua e marcată respinsă ............... %',
    case when v_respins is null then 'NU' else 'da ✓' end;
  if v_respins is null then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) RESPINGEREA NU S-A SCRIS.';
  end if;

  -- ── (3) Luna trece în `in_aprobare`, exact ce face `aprobaPontajBloc`. ──
  update public.attendance_periods set status = 'in_aprobare' where id = v_per;

  -- ── (4)+(5) Angajatul corectează ziua ȘI stinge marcajul. ──
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  with actualizate as (
    update public.attendance_entries
       set ora_sfarsit = '16:00', ore_lucrate = 8,
           respins_la = null, respins_de = null, motiv_respingere = null
     where id = v_intrare
       and organization_id = v_org
    returning 1
  )
  select count(*) into v_randuri from actualizate;
  reset role;

  raise notice '  (4) corecția într-o lună „în aprobare" .... % rânduri (aștept 1)', v_randuri;
  if v_randuri <> 1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) ANGAJATUL NU POATE CORECTA ziua într-o lună „în aprobare". Exact fundătura reclamată.';
  end if;

  select respins_la into v_respins from public.attendance_entries where id = v_intrare;
  raise notice '  (5) corecția a stins marcajul ............. %',
    case when v_respins is null then 'da ✓' else 'NU' end;
  if v_respins is not null then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) ZIUA CORECTATĂ RĂMÂNE „RESPINSĂ" pe veci.';
  end if;

  -- ── (6) Cele trei coloane se sting ÎMPREUNĂ. ──
  begin
    update public.attendance_entries
       set respins_la = now(), respins_de = null, motiv_respingere = null
     where id = v_intrare;
    v_a_mers := true;
  exception when others then
    v_a_mers := false;
  end;

  raise notice '  (6) marcaj pe jumătate e refuzat .......... %',
    case when v_a_mers then 'A MERS' else 'refuzat ✓' end;
  if v_a_mers then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) S-A SCRIS o respingere fără motiv, prin UPDATE direct.';
  end if;

  -- ── (7) Luna BLOCATĂ chiar refuză. ──
  update public.attendance_periods set status = 'blocata' where id = v_per;

  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    update public.attendance_entries set ore_lucrate = 7 where id = v_intrare;
    v_a_mers := true;
  exception when others then
    v_a_mers := false;
  end;
  reset role;

  raise notice '  (7) luna blocată refuză corecția .......... %',
    case when v_a_mers then 'A MERS' else 'refuzat ✓' end;
  if v_a_mers then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) O LUNĂ BLOCATĂ s-a lăsat modificată.';
  end if;

  raise notice '';
  if v_esecuri > 0 then
    raise exception 'PROBA A EȘUAT: % verificări nepotrivite.', v_esecuri;
  end if;
  raise notice '  PROBA A TRECUT: ziua respinsă se poate repara, iar corecția stinge marcajul.';
end
$$;
