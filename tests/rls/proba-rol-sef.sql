-- tests/rls/proba-rol-sef.sql
--
-- PROBĂ pentru regula „șef de departament ⇒ rol de manager".
--
-- ── DE CE ARE NEVOIE DE PROBĂ ──────────────────────────────────────────────
-- Regula scrie în DOUĂ tabele cu politici complet diferite:
--
--   `organization_members.role`  — cere `app.has_role(org, ['org_admin'])`,
--                                  adică ROLUL, nu o permisiune;
--   `employees.manager_employee_id` — cere `employees:update`, pe care `hr` îl
--                                  are la `all`.
--
-- Din asimetria asta vine tot designul: `hr` POATE desemna un șef (are
-- `departments:update = all`) și POATE lega oamenii de el, dar NU-i poate da
-- rolul. Aplicația nici nu încearcă, tocmai fiindcă refuzul ar fi ZERO RÂNDURI
-- ȘI FĂRĂ EROARE — un „s-a salvat" mincinos.
--
-- Proba nu întreabă matricea de permisiuni, ci baza: în acest proiect
-- raționamentul despre ce poate scrie un rol a greșit de patru ori la rând.
--
-- ── CE VERIFICĂ ────────────────────────────────────────────────────────────
-- (1) `org_admin` POATE promova un membru `employee` la `manager`;
-- (2) `hr` NU poate schimba niciun rol — refuz TĂCUT, zero rânduri;
-- (3) `hr` POATE lega angajații de șef (`manager_employee_id`);
-- (4) `org_admin` POATE retrograda înapoi la `employee`;
-- (5) ciclul de subordonare CHIAR aruncă P0001 — dovada empirică pentru care
--     `planificaSubordonarea` ridică șeful din lanț ÎNAINTE de a lega pe cineva.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh --pastreaza
--   PORT=$(docker ps --filter name=administrativo-banc --format '{{.Ports}}' \
--          | grep -oE '0.0.0.0:[0-9]+' | head -1 | cut -d: -f2)
--   psql "postgresql://postgres:banc@localhost:$PORT/postgres" -f tests/rls/proba-rol-sef.sql
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_org       uuid := gen_random_uuid();
  v_sufix     text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_dept      uuid := gen_random_uuid();

  v_admin     uuid := gen_random_uuid();
  v_hr        uuid := gen_random_uuid();
  v_viitor    uuid := gen_random_uuid();  -- contul celui promovat/retrogradat

  v_membru_viitor uuid;

  -- Fișele: șeful și un om din departament, plus lanțul care produce ciclul.
  v_fisa_sef  uuid := gen_random_uuid();
  v_fisa_om   uuid := gen_random_uuid();

  v_rol       public.app_role;
  v_citit     uuid;
  v_randuri   int;
  v_esecuri   int := 0;
begin
  raise notice '';
  raise notice '  PROBA „ȘEF DE DEPARTAMENT ⇒ ROL DE MANAGER"';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui)
  values (v_org, 'proba-rol-' || v_sufix, 'Proba Rol Șef SRL',
          'RO' || (89000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled)
  values (v_org, 'nucleu', true)
  on conflict (organization_id, feature_key) where deleted_at is null do nothing;

  insert into public.departments (id, organization_id, cod, denumire)
  values (v_dept, v_org, 'PROD', 'Producție');

  insert into auth.users (id, email) values
    (v_admin,  'admin-'  || v_sufix || '@proba.test'),
    (v_hr,     'hr-'     || v_sufix || '@proba.test'),
    (v_viitor, 'viitor-' || v_sufix || '@proba.test');
  insert into public.organization_members (organization_id, user_id, role, status) values
    (v_org, v_admin,  'org_admin', 'active'),
    (v_org, v_hr,     'hr',        'active'),
    (v_org, v_viitor, 'employee',  'active');

  -- Apartenența se recitește, NU se prinde cu `returning ... into`: pe un INSERT
  -- cu mai multe rânduri, `into` ridică „query returned more than one row".
  select id into v_membru_viitor
    from public.organization_members
   where organization_id = v_org and user_id = v_viitor;

  -- Fișa șefului e legată de contul lui: rolul se acordă unei APARTENENȚE, iar
  -- puntea dintre fișă și apartenență e `user_id`.
  insert into public.employees
    (id, organization_id, marca, first_name, last_name, status, is_primary, department_id, user_id)
  values
    (v_fisa_sef, v_org, 'S' || v_sufix, 'Radu',  'Pop',   'activ', true, v_dept, v_viitor),
    (v_fisa_om,  v_org, 'O' || v_sufix, 'Elena', 'Marin', 'activ', true, v_dept, null);

  update public.departments set manager_employee_id = v_fisa_sef where id = v_dept;

  -- ═══ (1) `org_admin` promovează ═══════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  update public.organization_members
     set role = 'manager'
   where id = v_membru_viitor;
  get diagnostics v_randuri = row_count;
  reset role;

  if v_randuri <> 1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) org_admin NU a putut promova (% rânduri) — REFUZ TĂCUT', v_randuri;
  else
    raise notice '  ✓ (1) org_admin promovează `employee` → `manager`';
  end if;

  -- ═══ (2) `hr` NU schimbă roluri ═══════════════════════════════════════════
  -- Poarta NEGATIVĂ care justifică ramura `autor_fara_drept` din decizie. `hr`
  -- are `departments:update = all`, deci ajunge până aici cu drepturi depline
  -- asupra structurii — și niciunul asupra rolurilor.
  perform set_config('request.jwt.claim.sub', v_hr::text, true);
  set local role authenticated;
  begin
    update public.organization_members
       set role = 'employee'
     where id = v_membru_viitor;
    get diagnostics v_randuri = row_count;
  exception when insufficient_privilege then
    v_randuri := 0;
  end;
  reset role;

  select role into v_rol from public.organization_members where id = v_membru_viitor;
  if v_randuri <> 0 or v_rol <> 'manager' then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) hr A PUTUT schimba rolul (% rânduri, rol = %)', v_randuri, v_rol;
  else
    raise notice '  ✓ (2) hr nu schimbă roluri — zero rânduri, fără eroare';
  end if;

  -- ═══ (3) `hr` POATE lega oamenii de șef ═══════════════════════════════════
  -- Cealaltă jumătate a asimetriei: structura o construiește HR-ul, chiar dacă
  -- drepturile le dă administratorul.
  perform set_config('request.jwt.claim.sub', v_hr::text, true);
  set local role authenticated;
  update public.employees
     set manager_employee_id = v_fisa_sef
   where id = v_fisa_om and organization_id = v_org and deleted_at is null;
  get diagnostics v_randuri = row_count;
  reset role;

  select manager_employee_id into v_citit from public.employees where id = v_fisa_om;
  if v_randuri <> 1 or v_citit is distinct from v_fisa_sef then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) hr NU a putut lega angajatul de șef (% rânduri)', v_randuri;
  else
    raise notice '  ✓ (3) hr leagă angajații de șef';
  end if;

  -- ═══ (4) `org_admin` retrogradează ════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  update public.organization_members
     set role = 'employee'
   where id = v_membru_viitor;
  get diagnostics v_randuri = row_count;
  reset role;

  if v_randuri <> 1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) org_admin NU a putut retrograda (% rânduri)', v_randuri;
  else
    raise notice '  ✓ (4) org_admin retrogradează `manager` → `employee`';
  end if;

  -- ═══ (5) Ciclul CHIAR aruncă ══════════════════════════════════════════════
  -- Șeful ajunge subordonatul omului din departamentul lui; legarea inversă ar
  -- închide lanțul. Dacă asta n-ar arunca, ordinea din `planificaSubordonarea`
  -- ar fi grijă degeaba — și invers: aruncând, confirmă că un UPDATE în masă
  -- fără ridicarea prealabilă a șefului ar pica ÎNTREG.
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;

  -- Se montează starea din teren: șeful ATÂRNĂ de un om din propriul lui
  -- departament. Legătura pusă la (3) se rupe întâi — altfel ciclul ar apărea
  -- deja aici, la pregătire, și n-am mai măsura ce voiam.
  update public.employees set manager_employee_id = null       where id = v_fisa_om;
  update public.employees set manager_employee_id = v_fisa_om  where id = v_fisa_sef;

  begin
    -- Exact scrierea pe care regula ar face-o în masă: omul intră în subordinea
    -- șefului. Lanțul se închide, fiindcă șeful atârnă deja de el.
    update public.employees set manager_employee_id = v_fisa_sef where id = v_fisa_om;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) ciclul de subordonare NU a fost respins';
  exception when raise_exception then
    raise notice '  ✓ (5) ciclul aruncă P0001 — de aceea șeful se ridică ÎNTÂI din lanț';
  end;
  reset role;

  raise notice '';
  if v_esecuri > 0 then
    raise exception 'PROBA A EȘUAT: % verificări nepotrivite.', v_esecuri;
  end if;
  raise notice '  PROBA A TRECUT: rolul îl scrie doar administratorul, structura o scrie și HR-ul.';
end
$$;
