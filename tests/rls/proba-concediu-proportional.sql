-- tests/rls/proba-concediu-proportional.sql
--
-- DREPTUL DE CONCEDIU PROPORȚIONAL CU LUNILE LUCRATE, DUPĂ 0193.
--
-- ── DE CE EXISTĂ FIȘIERUL ───────────────────────────────────────────────────
-- Un angajat intrat pe 08.10.2026 primea 20 de zile întregi pe 2026 (QA 8 oct
-- 2026, HR-007), iar zilele scrise pe contract erau doar un override la
-- însămânțare, rescris de „Aplică drepturile" (HR-031). Cifrele de aici sunt
-- ACELEAȘI ca în `src/domain/leave/drepturi.test.ts`: oglinda TypeScript și
-- funcția SQL se verifică reciproc.
--
-- ── CE VERIFICĂ, PE RÂND ────────────────────────────────────────────────────
-- (1) contract de bază din 08.10.2026 cu 20 de zile → 5 (nu 20);
-- (2) 21 de zile → 5,25 → 6 (`zi_in_sus`), 5 (`zi_in_jos`), 5 (`matematic`),
--     5,25 (`fara_rotunjire`) — tipul `odihna` nu e reglementat, se poate regla;
-- (3) intrat în 2025 → anul întreg, 20;
-- (4) încetat pe 30.06.2026 → 6 luni → 10;
-- (5) grilele se adună ÎNAINTE de proporție: vechime +3 → 23 pe angajatul din
--     2020, 5 pe cel din toamnă; grila pe `cod_cor` (criteriul din 0111) → 25;
-- (6) `seed_leave_balances(emp, 2026, 21)` sub `org_admin` lasă 5 și UN SINGUR
--     rând `drept_initial` cu delta 5 — override-ul e ignorat      [POZITIVĂ];
-- (7) sold vechi 20 → `aplica_drepturi_concediu(p_simulare = true)` propune 20 → 5;
-- (8) tipul `medical` (`scade_din_sold = false`) rămâne 183, inclusiv prin
--     `drepturile_mele_concediu`, care arată și odihna la 5;
-- (9) reangajat pe aceeași fișă (contract încetat în 2025, contract nou din
--     01.04.2026, `terminated_on` vechi rămas pe fișă) → 15 în 2026, 20 în
--     2027, 14 în 2025 pe primul contract; soldul semănat la reangajare = 15.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

begin;

-- Compară și raportează; întoarce true la potrivire. În `pg_temp`, ca
-- `pg_temp.esueaza` din izolare.sql: PL/pgSQL n-are funcții imbricate.
create function pg_temp.verifica(p_eticheta text, p_obtinut numeric, p_asteptat numeric)
returns boolean
language plpgsql
as $$
begin
  if p_obtinut = p_asteptat then
    raise notice '  ✓ % → %', p_eticheta, p_obtinut;
    return true;
  end if;
  raise warning '  ✗ % → % (așteptat %)', p_eticheta, p_obtinut, p_asteptat;
  return false;
end;
$$;

do $$
declare
  v_sufix     text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org       uuid := gen_random_uuid();
  v_u_admin   uuid := gen_random_uuid();
  v_e_toamna  uuid := gen_random_uuid();  -- intrat 08.10.2026
  v_e_vechi   uuid := gen_random_uuid();  -- intrat 01.03.2025
  v_e_iesit   uuid := gen_random_uuid();  -- 15.01.2026 – 30.06.2026
  v_e_vechime uuid := gen_random_uuid();  -- intrat 01.01.2020, cod COR 241103
  v_e_sold    uuid := gen_random_uuid();  -- intrat 08.10.2026, cu sold vechi 20
  v_e_reang   uuid := gen_random_uuid();  -- 03.02.2025 – 30.09.2025, reangajat 01.04.2026
  v_poz       uuid := gen_random_uuid();
  v_odihna    uuid;
  v_medical   uuid;
  v_drept     numeric;
  v_vechi     numeric;
  v_nou       numeric;
  v_n         integer;
  v_esecuri   int := 0;
begin
  raise notice '';
  raise notice '  PROBA „CONCEDIU PROPORȚIONAL CU LUNILE LUCRATE" (0193)';
  raise notice '  ─────────────────────────────────────────────────────────';

  -- ── fixture ───────────────────────────────────────────────────────────────
  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-prop-' || v_sufix, 'Proba Proporție SRL',
     'RO' || (89000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select v_org, f.feature_key, true, now() from public.features f;

  -- Tipurile vin din triggerul de pe `organizations` (`internal.seed_leave_defaults`):
  -- odihna 20 (din `zile_concediu_anual_implicit`), `zi_in_sus`; medical 183,
  -- `scade_din_sold = false`.
  select id into v_odihna
    from public.leave_types where organization_id = v_org and key = 'odihna';
  select id into v_medical
    from public.leave_types where organization_id = v_org and key = 'medical';
  if v_odihna is null or v_medical is null then
    raise exception 'fixture: tipurile de concediu nu s-au semănat pentru organizație';
  end if;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_admin, 'prop-admin-' || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role, status, joined_at)
  values (v_org, v_u_admin, 'org_admin', 'active', now());

  -- Funcția din nomenclator: `ler_criteriu_ck` cere `job_position_id` pe o grilă
  -- „funcție", iar potrivirea (0111) se face pe `cod_cor`.
  insert into public.job_positions (id, organization_id, cod, denumire, cod_cor)
  values (v_poz, v_org, 'CONT-' || v_sufix, 'Contabil', '241103');

  -- Fișa din toamnă e legată de contul administratorului, ca (8) să poată
  -- chema `drepturile_mele_concediu` (care caută fișa după `auth.uid()`).
  -- Inserarea în `organization_members` i-a creat deja o fișă proprie (0099),
  -- iar `employees_org_user_primary_uniq` (0004) refuză a doua fișă legată de
  -- același cont: o dezlegăm pe cea automată înainte.
  update public.employees set user_id = null
   where organization_id = v_org and user_id = v_u_admin;

  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, terminated_on, status, user_id, cod_cor) values
    (v_e_toamna,  v_org, 'P-01', 'Toma',   'Toamnă',  date '2026-10-08', null,              'activ', v_u_admin, null),
    (v_e_vechi,   v_org, 'P-02', 'Vasile', 'Vechi',   date '2025-03-01', null,              'activ', null,      null),
    (v_e_iesit,   v_org, 'P-03', 'Ioana',  'Ieșită',  date '2026-01-15', date '2026-06-30', 'activ', null,      null),
    (v_e_vechime, v_org, 'P-04', 'Victor', 'Vechime', date '2020-01-01', null,              'activ', null,      '241103'),
    (v_e_sold,    v_org, 'P-05', 'Sorin',  'Sold',    date '2026-10-08', null,              'activ', null,      null),
    -- Reangajat pe ACEEAȘI fișă: `terminated_on` rămâne de la contractul vechi,
    -- fiindcă `creeazaContract` reactivează fișa fără să-l golească.
    (v_e_reang,   v_org, 'P-06', 'Radu',   'Reangajat', date '2025-02-03', date '2025-09-30', 'activ', null,    null);

  insert into public.employment_contracts
    (organization_id, employee_id, numar, data_contract, valabil_de_la, salariu_baza,
     zile_concediu_anual, status, incetat_la) values
    (v_org, v_e_toamna,  'P-1/2026', date '2026-10-08', date '2026-10-08', 5000, 20, 'activ',   null),
    (v_org, v_e_vechi,   'P-2/2025', date '2025-03-01', date '2025-03-01', 5000, 20, 'activ',   null),
    (v_org, v_e_iesit,   'P-3/2026', date '2026-01-15', date '2026-01-15', 5000, 20, 'incetat', date '2026-06-30'),
    (v_org, v_e_vechime, 'P-4/2020', date '2020-01-01', date '2020-01-01', 5000, 20, 'activ',   null),
    (v_org, v_e_sold,    'P-5/2026', date '2026-10-08', date '2026-10-08', 5000, 20, 'activ',   null),
    (v_org, v_e_reang,   'P-6/2025', date '2025-02-03', date '2025-02-03', 5000, 20, 'incetat', date '2025-09-30'),
    (v_org, v_e_reang,   'P-7/2026', date '2026-04-01', date '2026-04-01', 5000, 20, 'activ',   null);

  -- ═══ (1) Intrat pe 08.10.2026: 3 luni → 20 × 3/12 = 5 ═══════════════════
  v_drept := app.drept_concediu(v_org, v_e_toamna, v_odihna, 2026);
  if not pg_temp.verifica('(1) contract din 08.10.2026, 20 de zile', v_drept, 5) then
    v_esecuri := v_esecuri + 1;
  end if;

  -- ═══ (2) 21 de zile → 5,25, rotunjit după modul tipului ═══════════════════
  update public.employment_contracts set zile_concediu_anual = 21
   where employee_id = v_e_toamna and organization_id = v_org;

  v_drept := app.drept_concediu(v_org, v_e_toamna, v_odihna, 2026);
  if not pg_temp.verifica('(2a) 21 de zile, zi_in_sus', v_drept, 6) then v_esecuri := v_esecuri + 1; end if;

  update public.leave_types set mod_rotunjire_acumulare = 'zi_in_jos' where id = v_odihna;
  v_drept := app.drept_concediu(v_org, v_e_toamna, v_odihna, 2026);
  if not pg_temp.verifica('(2b) 21 de zile, zi_in_jos', v_drept, 5) then v_esecuri := v_esecuri + 1; end if;

  update public.leave_types set mod_rotunjire_acumulare = 'matematic' where id = v_odihna;
  v_drept := app.drept_concediu(v_org, v_e_toamna, v_odihna, 2026);
  if not pg_temp.verifica('(2c) 21 de zile, matematic', v_drept, 5) then v_esecuri := v_esecuri + 1; end if;

  update public.leave_types set mod_rotunjire_acumulare = 'fara_rotunjire' where id = v_odihna;
  v_drept := app.drept_concediu(v_org, v_e_toamna, v_odihna, 2026);
  if not pg_temp.verifica('(2d) 21 de zile, fara_rotunjire', v_drept, 5.25) then v_esecuri := v_esecuri + 1; end if;

  -- Înapoi la implicitul seed-ului.
  update public.leave_types set mod_rotunjire_acumulare = 'zi_in_sus' where id = v_odihna;
  update public.employment_contracts set zile_concediu_anual = 20
   where employee_id = v_e_toamna and organization_id = v_org;

  -- ═══ (3) Intrat în 2025: anul întreg ══════════════════════════════════════
  v_drept := app.drept_concediu(v_org, v_e_vechi, v_odihna, 2026);
  if not pg_temp.verifica('(3) intrat în 2025', v_drept, 20) then v_esecuri := v_esecuri + 1; end if;

  -- ═══ (4) Încetat pe 30.06.2026: 6 luni → 10 ═══════════════════════════════
  v_drept := app.drept_concediu(v_org, v_e_iesit, v_odihna, 2026);
  if not pg_temp.verifica('(4) încetat pe 30.06.2026', v_drept, 10) then v_esecuri := v_esecuri + 1; end if;

  -- ═══ (5) Grilele se adună înainte de proporție ════════════════════════════
  insert into public.leave_entitlement_rules
    (organization_id, leave_type_id, categorie, denumire, tip_criteriu, vechime_ani_min,
     zile_suplimentare, valabil_de_la)
  values (v_org, v_odihna, 'vechime_3', 'Vechime ≥ 3 ani', 'vechime', 3, 3, date '2024-01-01');

  v_drept := app.drept_concediu(v_org, v_e_vechime, v_odihna, 2026);
  if not pg_temp.verifica('(5a) vechime +3 pe angajatul din 2020', v_drept, 23) then
    v_esecuri := v_esecuri + 1;
  end if;
  v_drept := app.drept_concediu(v_org, v_e_toamna, v_odihna, 2026);
  if not pg_temp.verifica('(5b) vechime neîntrunită pe cel din toamnă', v_drept, 5) then
    v_esecuri := v_esecuri + 1;
  end if;

  -- Criteriul „funcție" pe `cod_cor` (0111): copierea corpului din 0035 l-ar fi
  -- regresat pe `job_position_id`, iar fișa nu-l mai poartă.
  insert into public.leave_entitlement_rules
    (organization_id, leave_type_id, categorie, denumire, tip_criteriu, job_position_id,
     cod_cor, zile_suplimentare, valabil_de_la)
  values (v_org, v_odihna, 'functie_contabil', 'Contabil', 'functie', v_poz, '241103', 2,
          date '2024-01-01');

  v_drept := app.drept_concediu(v_org, v_e_vechime, v_odihna, 2026);
  if not pg_temp.verifica('(5c) + funcție pe cod_cor 241103', v_drept, 25) then
    v_esecuri := v_esecuri + 1;
  end if;

  -- ═══ (6) Însămânțarea ignoră override-ul [POZITIVĂ] ═══════════════════════
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    perform public.seed_leave_balances(v_e_toamna, 2026, 21);
    reset role;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) org_admin nu a putut semăna soldul: % (%)', sqlerrm, sqlstate;
  end;

  select b.drept_anual into v_drept
    from public.leave_balances b
   where b.organization_id = v_org and b.employee_id = v_e_toamna
     and b.leave_type_id = v_odihna and b.an = 2026 and b.deleted_at is null;
  if not pg_temp.verifica('(6a) soldul semănat cu override 21', coalesce(v_drept, -1), 5) then
    v_esecuri := v_esecuri + 1;
  end if;

  select count(*) into v_n
    from public.leave_accruals a
   where a.organization_id = v_org and a.employee_id = v_e_toamna
     and a.leave_type_id = v_odihna and a.an = 2026;
  select a.delta into v_drept
    from public.leave_accruals a
   where a.organization_id = v_org and a.employee_id = v_e_toamna
     and a.leave_type_id = v_odihna and a.an = 2026 and a.eveniment = 'drept_initial'
   limit 1;
  if v_n = 1 and v_drept = 5 then
    raise notice '  ✓ (6b) un singur rând de istoric, drept_initial +5';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6b) istoricul are % rânduri, drept_initial = % (așteptat 1 rând, 5)',
      v_n, v_drept;
  end if;

  -- ═══ (7) Soldul vechi se recalculează doar cu previzualizare ══════════════
  insert into public.leave_balances (organization_id, employee_id, leave_type_id, an, drept_anual)
  values (v_org, v_e_sold, v_odihna, 2026, 20);

  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    select p.drept_vechi, p.drept_nou into v_vechi, v_nou
      from public.aplica_drepturi_concediu(v_org, 2026, true) p
     where p.employee_id = v_e_sold and p.leave_type_id = v_odihna;
    reset role;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) previzualizarea a eșuat: % (%)', sqlerrm, sqlstate;
  end;
  if v_vechi = 20 and v_nou = 5 then
    raise notice '  ✓ (7) previzualizarea propune 20 → 5';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) previzualizarea propune % → % (așteptat 20 → 5)', v_vechi, v_nou;
  end if;

  select b.drept_anual into v_drept
    from public.leave_balances b
   where b.organization_id = v_org and b.employee_id = v_e_sold
     and b.leave_type_id = v_odihna and b.an = 2026 and b.deleted_at is null;
  if not pg_temp.verifica('(7b) soldul vechi rămâne nescris de simulare', v_drept, 20) then
    v_esecuri := v_esecuri + 1;
  end if;

  -- ═══ (8) Tipurile cu durată fixă nu se proporționalizează ═════════════════
  v_drept := app.drept_concediu(v_org, v_e_toamna, v_medical, 2026);
  if not pg_temp.verifica('(8a) medical pe cel din toamnă', v_drept, 183) then
    v_esecuri := v_esecuri + 1;
  end if;

  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    select d.zile into v_drept
      from public.drepturile_mele_concediu(v_org, 2026) d
     where d.leave_type_id = v_medical;
    select d.zile into v_nou
      from public.drepturile_mele_concediu(v_org, 2026) d
     where d.leave_type_id = v_odihna;
    reset role;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8b) drepturile_mele_concediu a eșuat: % (%)', sqlerrm, sqlstate;
  end;
  if v_drept = 183 and v_nou = 5 then
    raise notice '  ✓ (8b) portalul arată medical 183 și odihnă 5';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8b) portalul arată medical %, odihnă % (așteptat 183, 5)', v_drept, v_nou;
  end if;

  -- ═══ (9) Reangajat pe aceeași fișă: `terminated_on` vechi nu anulează ═════
  -- contractul nou. Ancora e contractul NOU (01.04.2026); încetarea din
  -- 30.09.2025 e anterioară ei, deci se ignoră. Vechimea de la 03.02.2025 nu
  -- atinge grila de 3 ani nici la 31.12.2027.
  v_drept := app.drept_concediu(v_org, v_e_reang, v_odihna, 2026);
  if not pg_temp.verifica('(9a) reangajat din 01.04.2026, 9 luni', v_drept, 15) then
    v_esecuri := v_esecuri + 1;
  end if;
  v_drept := app.drept_concediu(v_org, v_e_reang, v_odihna, 2027);
  if not pg_temp.verifica('(9b) reangajat, anul următor întreg', v_drept, 20) then
    v_esecuri := v_esecuri + 1;
  end if;
  -- Anul primului contract rămâne pe el: februarie–septembrie = 8 luni →
  -- 13,33 → 14 (`zi_in_sus`); contractul nou nu începuse încă.
  v_drept := app.drept_concediu(v_org, v_e_reang, v_odihna, 2025);
  if not pg_temp.verifica('(9c) primul contract, 2025, 8 luni', v_drept, 14) then
    v_esecuri := v_esecuri + 1;
  end if;

  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    perform public.seed_leave_balances(v_e_reang, 2026);
    reset role;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9d) org_admin nu a putut semăna soldul reangajatului: % (%)', sqlerrm, sqlstate;
  end;
  select b.drept_anual into v_drept
    from public.leave_balances b
   where b.organization_id = v_org and b.employee_id = v_e_reang
     and b.leave_type_id = v_odihna and b.an = 2026 and b.deleted_at is null;
  if not pg_temp.verifica('(9d) soldul semănat la reangajare', coalesce(v_drept, -1), 15) then
    v_esecuri := v_esecuri + 1;
  end if;

  -- ── verdict ───────────────────────────────────────────────────────────────
  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA CONCEDIULUI PROPORȚIONAL: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE cele 9 verificări au trecut.';
  raise notice '';
end;
$$;

rollback;
