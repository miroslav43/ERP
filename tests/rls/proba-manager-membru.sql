-- tests/rls/proba-manager-membru.sql
--
-- POARTĂ POZITIVĂ pentru „managerul desemnat devine membru al departamentului".
--
-- ── DE CE ARE NEVOIE DE PROBĂ TOCMAI ASTA ──────────────────────────────────
-- Acțiunea `actualizeazaDepartament` scria până acum într-o singură tabelă. De
-- acum scrie în DOUĂ: `departments` (managerul) și `employees` (apartenența lui).
-- Autorizarea aplicației verifică o singură cheie — `departments:update` — dar
-- baza cere pentru a doua scriere `employees:update`, prin altă politică.
--
-- Dacă cele două n-ar merge împreună, defectul ar fi INVIZIBIL: politica
-- `employees_update` refuză prin `USING` cu ZERO RÂNDURI ȘI FĂRĂ EROARE. Ecranul
-- ar anunța „Departamentul a fost salvat", managerul ar apărea pe card, iar în
-- listă tot n-ar fi nimeni — adică exact defectul pe care fișierul ăsta îl
-- însoțește la reparat, doar că mai greu de găsit a doua oară.
--
-- Matricea de permisiuni spune că `hr` și `org_admin` au amândouă cheile. Proba
-- nu întreabă matricea, ci baza: în acest proiect raționamentul despre ce poate
-- scrie un rol a greșit de patru ori la rând.
--
-- ── CE VERIFICĂ ────────────────────────────────────────────────────────────
-- (1) `org_admin` desemnează un manager NEREPARTIZAT și îl repartizează;
-- (2) `hr` face același lucru, mutând managerul DIN alt departament;
-- (3) `manager` (rolul) NU poate desemna manageri — poarta negativă;
-- (4) `employee` nu poate muta pe nimeni în alt departament;
-- (5) apartenența CHIAR se vede după scriere, recitită din `employees`.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh --pastreaza
--   PORT=$(docker ps --filter name=administrativo-banc --format '{{.Ports}}' \
--          | grep -oE '0.0.0.0:[0-9]+' | head -1 | cut -d: -f2)
--   psql "postgresql://postgres:banc@localhost:$PORT/postgres" -f tests/rls/proba-manager-membru.sql
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_org        uuid := gen_random_uuid();
  v_sufix      text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_productie  uuid := gen_random_uuid();
  v_vanzari    uuid := gen_random_uuid();

  v_admin      uuid := gen_random_uuid();
  v_hr         uuid := gen_random_uuid();
  v_sef        uuid := gen_random_uuid();  -- rolul `manager`
  v_simplu     uuid := gen_random_uuid();  -- rolul `employee`

  -- Fișele-țintă: oamenii desemnați manageri. N-au cont, ca majoritatea
  -- angajaților reali din acest produs.
  v_nerepartizat uuid := gen_random_uuid();
  v_din_vanzari  uuid := gen_random_uuid();

  v_citit      uuid;
  v_randuri    int;
  v_esecuri    int := 0;
begin
  raise notice '';
  raise notice '  PROBA „MANAGERUL E ȘI MEMBRU"';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui)
  values (v_org, 'proba-mgr-' || v_sufix, 'Proba Manager SRL',
          'RO' || (89000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled)
  values (v_org, 'nucleu', true)
  on conflict (organization_id, feature_key) where deleted_at is null do nothing;

  insert into public.departments (id, organization_id, cod, denumire)
  values (v_productie, v_org, 'PROD', 'Producție'),
         (v_vanzari,   v_org, 'VNZ',  'Vânzări');

  -- ── Actorii. Fișele lor le creează triggerele din 0083/0107; aici contează
  -- doar rândul de membru, care le dă rolul. ──
  insert into auth.users (id, email) values
    (v_admin,  'admin-'  || v_sufix || '@proba.test'),
    (v_hr,     'hr-'     || v_sufix || '@proba.test'),
    (v_sef,    'sef-'    || v_sufix || '@proba.test'),
    (v_simplu, 'simplu-' || v_sufix || '@proba.test');
  insert into public.organization_members (organization_id, user_id, role, status) values
    (v_org, v_admin,  'org_admin', 'active'),
    (v_org, v_hr,     'hr',        'active'),
    (v_org, v_sef,    'manager',   'active'),
    (v_org, v_simplu, 'employee',  'active');

  -- ── Țintele. Una nerepartizată, una deja în „Vânzări". ──
  insert into public.employees
    (id, organization_id, marca, first_name, last_name, status, is_primary, department_id)
  values
    (v_nerepartizat, v_org, 'N' || v_sufix, 'Radu',  'Pop',    'activ', true, null),
    (v_din_vanzari,  v_org, 'V' || v_sufix, 'Elena', 'Marin',  'activ', true, v_vanzari);

  -- ═══ (1) `org_admin`: manager nerepartizat ⇒ intră în departament ══════════
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;

  update public.departments
     set manager_employee_id = v_nerepartizat
   where id = v_productie;
  get diagnostics v_randuri = row_count;
  if v_randuri <> 1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1a) org_admin NU a putut desemna managerul (% rânduri)', v_randuri;
  end if;

  -- A doua scriere, cea care se poate refuza tăcut.
  update public.employees
     set department_id = v_productie
   where id = v_nerepartizat and organization_id = v_org and deleted_at is null;
  get diagnostics v_randuri = row_count;
  reset role;

  if v_randuri <> 1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1b) org_admin NU a putut repartiza managerul (% rânduri) — REFUZ TĂCUT', v_randuri;
  end if;

  select department_id into v_citit from public.employees where id = v_nerepartizat;
  if v_citit is distinct from v_productie then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1c) managerul NU e membru după scriere (department_id = %)',
      coalesce(v_citit::text, 'null');
  else
    raise notice '  ✓ (1) org_admin: managerul desemnat e și membru';
  end if;

  -- ═══ (2) `hr`: manager luat DIN alt departament ════════════════════════════
  perform set_config('request.jwt.claim.sub', v_hr::text, true);
  set local role authenticated;

  update public.departments
     set manager_employee_id = v_din_vanzari
   where id = v_vanzari;
  get diagnostics v_randuri = row_count;
  if v_randuri <> 1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2a) hr NU a putut desemna managerul (% rânduri)', v_randuri;
  end if;

  -- Mutarea propriu-zisă: din „Vânzări" în „Producție". E gestul pe care bifa
  -- din formular îl dezleagă, și singurul care SCOATE pe cineva de undeva.
  update public.employees
     set department_id = v_productie
   where id = v_din_vanzari and organization_id = v_org and deleted_at is null;
  get diagnostics v_randuri = row_count;
  reset role;

  if v_randuri <> 1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2b) hr NU a putut muta managerul (% rânduri) — REFUZ TĂCUT', v_randuri;
  end if;

  select department_id into v_citit from public.employees where id = v_din_vanzari;
  if v_citit is distinct from v_productie then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2c) mutarea nu se vede în bază (department_id = %)',
      coalesce(v_citit::text, 'null');
  else
    raise notice '  ✓ (2) hr: managerul mutat din alt departament chiar s-a mutat';
  end if;

  -- ═══ (3) `manager` NU are voie să desemneze manageri ═══════════════════════
  -- Rolul `manager` n-are NICIUN rând `departments:*` în seed. Refuzul e zero
  -- rânduri, fără eroare — deci se numără, nu se prinde cu `exception`.
  perform set_config('request.jwt.claim.sub', v_sef::text, true);
  set local role authenticated;
  begin
    update public.departments
       set manager_employee_id = v_nerepartizat
     where id = v_vanzari;
    get diagnostics v_randuri = row_count;
  exception when insufficient_privilege then
    v_randuri := 0;
  end;
  reset role;

  if v_randuri <> 0 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) rolul `manager` A PUTUT desemna un manager (% rânduri)', v_randuri;
  else
    raise notice '  ✓ (3) rolul `manager` nu poate desemna manageri';
  end if;

  -- ═══ (4) `employee` nu mută pe nimeni ══════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_simplu::text, true);
  set local role authenticated;
  begin
    update public.employees
       set department_id = v_vanzari
     where id = v_nerepartizat;
    get diagnostics v_randuri = row_count;
  exception when insufficient_privilege then
    v_randuri := 0;
  end;
  reset role;

  if v_randuri <> 0 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) rolul `employee` A PUTUT muta pe cineva (% rânduri)', v_randuri;
  else
    raise notice '  ✓ (4) rolul `employee` nu mută pe nimeni';
  end if;

  -- ═══ (5) Starea finală, recitită ═══════════════════════════════════════════
  select count(*) into v_randuri
    from public.employees
   where organization_id = v_org and department_id = v_productie and deleted_at is null
     and id in (v_nerepartizat, v_din_vanzari);
  if v_randuri <> 2 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) „Producție" are % din cei 2 manageri repartizați', v_randuri;
  else
    raise notice '  ✓ (5) ambii ajung membri, citit din bază';
  end if;

  raise notice '';
  if v_esecuri > 0 then
    raise exception 'PROBA A EȘUAT: % verificări nepotrivite.', v_esecuri;
  end if;
  raise notice '  PROBA A TRECUT: cine desemnează un manager îl poate și repartiza.';
end
$$;
