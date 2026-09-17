-- tests/rls/proba-sef-departament.sql
--
-- PROBĂ pentru `0143`: cine e scos din departamentul pe care îl conduce nu-l
-- mai conduce — dar cine n-a fost niciodată membru rămâne șef.
--
-- ── DE CE ARE NEVOIE DE PROBĂ TOCMAI ASTA ──────────────────────────────────
-- Defectul reparat de `0143` era TĂCUT în ambele sensuri: nimeni nu scria
-- `departments.manager_employee_id` la mutare, deci departamentul rămânea
-- arătând către cineva plecat, iar ecranul îl desena ca șef mai departe. Nicio
-- eroare, nicio linie în vreun jurnal de aplicație.
--
-- Reparația poate strica la loc, tot tăcut, în două feluri:
--   · funcția e `security definer`, iar motivul NU se vede pe matricea de
--     roluri: toate cele trei roluri cu `employees:update` au și
--     `departments:update = all`, deci și varianta `invoker` trece (verificat).
--     Se rupe la drepturile PER MEMBRU: `role_permissions.member_id` bate rândul
--     de rol, inclusiv cu `'none'`, deci un om poate avea voie să mute angajați
--     și interdicție pe structură. Pentru el, `invoker` cade pe politica
--     `departments_update` cu ZERO rânduri și FĂRĂ eroare (capcana 17). Omul
--     acela e verificarea (6) — singura care distinge cele două variante.
--     Rulată ca `postgres`, nicio verificare de aici n-ar însemna nimic:
--     `postgres` are `bypassrls`.
--   · lărgită la „manager care nu e membru", ar șterge starea legitimă pe care
--     `camp-manager.tsx` o oferă explicit (bifa „Mută-l în …" stinsă). De aceea
--     (4) e o poartă NEGATIVĂ: verifică ce NU trebuie să se întâmple.
--
-- ── CE VERIFICĂ ────────────────────────────────────────────────────────────
-- (1) `hr` scoate șeful din departamentul lui (→ nerepartizat) ⇒ șefia cade;
-- (2) mutarea într-ALT departament ⇒ șefia cade tot;
-- (3) ștergerea logică a șefului ⇒ șefia cade;
-- (4) șeful care N-A FOST niciodată membru NU se pierde când e mutat altundeva;
-- (5) plecarea CUIVA ALTCUIVA din alt departament nu-i ia acestuia șeful;
-- (6) omul cu `employees:update` din rol și `departments:update = 'none'` pus
--     per membru golește totuși șefia — proba lui `security definer`.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh --pastreaza
--   PORT=$(docker ps --filter name=administrativo-banc --format '{{.Ports}}' \
--          | grep -oE '0.0.0.0:[0-9]+' | head -1 | cut -d: -f2)
--   psql "postgresql://postgres:banc@localhost:$PORT/postgres" -f tests/rls/proba-sef-departament.sql
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_org       uuid := gen_random_uuid();
  v_sufix     text := left(replace(gen_random_uuid()::text, '-', ''), 8);

  v_hr_dep    uuid := gen_random_uuid();  -- departamentul din care se pleacă
  v_productie uuid := gen_random_uuid();  -- destinația din (2)
  v_vanzari   uuid := gen_random_uuid();  -- vecinul din (5) și gazda dinainte de (4)
  v_logistica uuid := gen_random_uuid();  -- departamentul condus din (4)
  v_contab    uuid := gen_random_uuid();  -- departamentul din (6)

  v_admin     uuid := gen_random_uuid();
  v_hr        uuid := gen_random_uuid();
  v_hr_legat  uuid := gen_random_uuid();  -- (6) `hr` cu structura interzisă
  v_membru    uuid;                       -- rândul lui din organization_members

  v_sef_hr    uuid := gen_random_uuid();  -- (1) pleacă spre „nerepartizat"
  v_sef_mutat uuid := gen_random_uuid();  -- (2) pleacă spre alt departament
  v_sef_sters uuid := gen_random_uuid();  -- (3) e șters logic
  v_sef_extern uuid := gen_random_uuid(); -- (4) conduce Logistica, e membru în Vânzări
  v_sef_vanzari uuid := gen_random_uuid();-- (5) vecinul care nu trebuie atins
  v_sef_ctb   uuid := gen_random_uuid();  -- (6) șeful mutat de omul cu drepturi croite

  v_citit     uuid;
  v_randuri   int;
  v_esecuri   int := 0;
begin
  raise notice '';
  raise notice '  PROBA „ȘEFUL SCOS DIN DEPARTAMENT NU-L MAI CONDUCE"';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui)
  values (v_org, 'proba-sef-' || v_sufix, 'Proba Șef SRL',
          'RO' || (89000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled)
  values (v_org, 'nucleu', true)
  on conflict (organization_id, feature_key) where deleted_at is null do nothing;

  insert into public.departments (id, organization_id, cod, denumire)
  values (v_hr_dep,    v_org, 'HR-' || v_sufix,   'HR'),
         (v_productie, v_org, 'PROD-' || v_sufix, 'Producție'),
         (v_vanzari,   v_org, 'VNZ-' || v_sufix,  'Vânzări'),
         (v_logistica, v_org, 'LOG-' || v_sufix,  'Logistică'),
         (v_contab,    v_org, 'CTB-' || v_sufix,  'Contabilitate');

  insert into auth.users (id, email) values
    (v_admin,    'admin-' || v_sufix || '@proba.test'),
    (v_hr,       'hr-'    || v_sufix || '@proba.test'),
    (v_hr_legat, 'hrl-'   || v_sufix || '@proba.test');
  insert into public.organization_members (organization_id, user_id, role, status) values
    (v_org, v_admin,    'org_admin', 'active'),
    (v_org, v_hr,       'hr',        'active'),
    (v_org, v_hr_legat, 'hr',        'active');

  -- Drepturile croite de mână pentru (6): rândul de MEMBRU bate rândul de rol,
  -- iar `app.has_permission` îl respectă și când valoarea e 'none'.
  select id into v_membru
    from public.organization_members
   where organization_id = v_org and user_id = v_hr_legat and deleted_at is null;
  insert into public.role_permissions
    (organization_id, member_id, role, resource, action, scope)
  values (v_org, v_membru, 'hr', 'departments', 'update', 'none');

  -- Cei cinci șefi. Fiecare e MEMBRU acolo unde conduce, cu excepția lui
  -- `v_sef_extern` — starea legitimă din (4).
  insert into public.employees
    (id, organization_id, marca, first_name, last_name, status, is_primary, department_id)
  values
    (v_sef_hr,      v_org, 'A' || v_sufix, 'Marius', 'Popescu', 'activ', true, v_hr_dep),
    (v_sef_mutat,   v_org, 'B' || v_sufix, 'Radu',   'Pop',     'activ', true, v_hr_dep),
    (v_sef_sters,   v_org, 'C' || v_sufix, 'Elena',  'Marin',   'activ', true, v_productie),
    (v_sef_extern,  v_org, 'D' || v_sufix, 'Ion',    'Ionescu', 'activ', true, v_vanzari),
    (v_sef_vanzari, v_org, 'E' || v_sufix, 'Ana',    'Georgiu', 'activ', true, v_vanzari),
    (v_sef_ctb,     v_org, 'F' || v_sufix, 'Dan',    'Stoica',  'activ', true, v_contab);

  -- Șefiile se scriu ca `postgres`: proba nu verifică aici cine are dreptul să
  -- desemneze un șef (asta o face `proba-manager-membru.sql`), ci ce se întâmplă
  -- cu șefia DUPĂ ce omul pleacă.
  update public.departments set manager_employee_id = v_sef_hr      where id = v_hr_dep;
  update public.departments set manager_employee_id = v_sef_sters   where id = v_productie;
  update public.departments set manager_employee_id = v_sef_vanzari where id = v_vanzari;
  update public.departments set manager_employee_id = v_sef_extern  where id = v_logistica;
  update public.departments set manager_employee_id = v_sef_ctb     where id = v_contab;

  -- ═══ (1) `hr` scoate șeful din departamentul lui ═══════════════════════════
  -- Rolul conteaza: `hr` are `employees:update` și NU are `departments:update`.
  -- Dacă funcția din 0143 n-ar fi `security definer`, aici ar cădea tăcut.
  perform set_config('request.jwt.claim.sub', v_hr::text, true);
  set local role authenticated;
  update public.employees
     set department_id = null
   where id = v_sef_hr and organization_id = v_org and deleted_at is null;
  get diagnostics v_randuri = row_count;
  reset role;

  if v_randuri <> 1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1a) `hr` NU a putut scoate șeful din departament (% rânduri)', v_randuri;
  end if;

  select manager_employee_id into v_citit from public.departments where id = v_hr_dep;
  if v_citit is not null then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1b) HR are încă un șef desemnat (%) deși omul a plecat', v_citit;
  else
    raise notice '  ✓ (1) `hr` scoate șeful ⇒ departamentul rămâne fără șef';
  end if;

  -- ═══ (2) Mutarea într-alt departament ══════════════════════════════════════
  update public.departments set manager_employee_id = v_sef_mutat where id = v_hr_dep;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  update public.employees
     set department_id = v_productie
   where id = v_sef_mutat and organization_id = v_org and deleted_at is null;
  get diagnostics v_randuri = row_count;
  reset role;

  if v_randuri <> 1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2a) mutarea șefului n-a trecut (% rânduri)', v_randuri;
  end if;

  select manager_employee_id into v_citit from public.departments where id = v_hr_dep;
  if v_citit is not null then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2b) HR îl arată șef (%) deși omul lucrează la Producție', v_citit;
  else
    raise notice '  ✓ (2) mutat în alt departament ⇒ șefia cade tot';
  end if;

  -- ═══ (3) Ștergerea logică a șefului ════════════════════════════════════════
  -- `department_id` nu se schimbă aici: singura coloană atinsă e `deleted_at`.
  -- Fără ramura ei din clauza `when`, un șef șters ar fi rămas pe card — citirea
  -- din `queries/departments.ts` ia managerul prin embed, fără filtru pe
  -- `deleted_at`.
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  update public.employees
     set deleted_at = now()
   where id = v_sef_sters and organization_id = v_org and deleted_at is null;
  get diagnostics v_randuri = row_count;
  reset role;

  if v_randuri <> 1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3a) ștergerea logică n-a trecut (% rânduri)', v_randuri;
  end if;

  select manager_employee_id into v_citit from public.departments where id = v_productie;
  if v_citit is not null then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3b) Producție arată un șef șters (%)', v_citit;
  else
    raise notice '  ✓ (3) șef șters logic ⇒ șefia cade';
  end if;

  -- ═══ (4) POARTĂ NEGATIVĂ: șeful care n-a fost niciodată membru ══════════════
  -- `v_sef_extern` conduce Logistica și e membru în Vânzări — starea pe care
  -- interfața o oferă explicit, cu bifa de mutare stinsă. Îl mutăm din Vânzări
  -- în Producție: pleacă dintr-un departament pe care NU-l conduce, deci șefia
  -- Logisticii nu are de ce să se atingă.
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  update public.employees
     set department_id = v_productie
   where id = v_sef_extern and organization_id = v_org and deleted_at is null;
  reset role;

  select manager_employee_id into v_citit from public.departments where id = v_logistica;
  if v_citit is distinct from v_sef_extern then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) Logistica și-a pierdut șeful (%) — reparația e prea largă',
      coalesce(v_citit::text, 'null');
  else
    raise notice '  ✓ (4) „manager fără să fie membru" rămâne o stare legitimă';
  end if;

  -- ═══ (5) Departamentul din care s-a plecat, dar al altui șef ═══════════════
  -- La (4) `v_sef_extern` a plecat DIN Vânzări, iar Vânzări are propriul șef,
  -- pe `v_sef_vanzari`. Condiția `d.manager_employee_id = old.id` e tot ce
  -- separă cele două cazuri: fără ea, orice plecare ar decapita departamentul.
  select manager_employee_id into v_citit from public.departments where id = v_vanzari;
  if v_citit is distinct from v_sef_vanzari then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) Vânzări și-a pierdut șeful (%) fiindcă a plecat de acolo ALTCINEVA',
      coalesce(v_citit::text, 'null');
  else
    raise notice '  ✓ (5) plecarea altcuiva nu decapitează departamentul';
  end if;

  -- ═══ (6) OMUL CARE DISTINGE `definer` DE `invoker` ═════════════════════════
  -- `v_hr_legat` are `employees:update` din rolul `hr` și `departments:update`
  -- tăiat la 'none' pe rândul lui de membru. Mută șeful Contabilității afară:
  -- prima scriere trebuie să treacă, a doua — cea a triggerului — nu are pe ce
  -- drept să se sprijine, deci se poate face DOAR ca definer.
  --
  -- Întâi se verifică premisa. Dacă `app.can` ar începe să ignore rândul de
  -- membru, verificarea de dedesubt ar trece degeaba și n-ar mai proba nimic.
  perform set_config('request.jwt.claim.sub', v_hr_legat::text, true);
  set local role authenticated;
  if app.can(v_org, 'departments', 'update', 'all') then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6a) premisa e falsă: omul ARE `departments:update` — verificarea nu mai probează definer-ul';
  else
    update public.employees
       set department_id = null
     where id = v_sef_ctb and organization_id = v_org and deleted_at is null;
    get diagnostics v_randuri = row_count;
    reset role;

    if v_randuri <> 1 then
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (6b) omul NU a putut muta angajatul (% rânduri)', v_randuri;
    end if;

    select manager_employee_id into v_citit from public.departments where id = v_contab;
    if v_citit is not null then
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (6c) Contabilitatea îl arată șef (%) — funcția nu mai e `security definer`', v_citit;
    else
      raise notice '  ✓ (6) șefia cade și pentru cine n-are drept pe structură';
    end if;
  end if;

  raise notice '';
  if v_esecuri > 0 then
    raise exception 'PROBA A EȘUAT: % verificări nepotrivite.', v_esecuri;
  end if;
  raise notice '  PROBA A TRECUT: șefia urmează apartenența, dar numai când a existat.';
end
$$;
