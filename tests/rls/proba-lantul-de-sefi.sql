-- tests/rls/proba-lantul-de-sefi.sql
--
-- PROBA pentru `public.lantul_meu_de_sefi` (0196, ANG-028).
--
-- ── DE CE ──────────────────────────────────────────────────────────────────
-- Funcția e `security definer`, adică o fereastră nouă prin RLS. Ea trebuie să
-- arate angajatului EXACT șefii din propriul `manager_path` — nu pe sine, nu pe
-- colegi, nu firma altcuiva — iar politica `employees_select` trebuie să rămână
-- neatinsă: `select count(*) from employees` sub `own` dă tot 1.
--
-- ── CE VERIFICĂ ────────────────────────────────────────────────────────────
-- (1) `employee` cu lanțul director → șef → el: 2 rânduri, ordinea director, șef;
-- (2) fișa proprie NU apare în rezultat;
-- (3) sub aceeași identitate, `employees` dă tot un singur rând (politica `own`);
-- (4) apelată cu organizația ALTEI firme: 0 rânduri;
-- (5) un coleg (alt subordonat al șefului) nu apare.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh --pastreaza
--   PORT=$(docker ps --filter name=administrativo-banc --format '{{.Ports}}' \
--          | grep -oE '0.0.0.0:[0-9]+' | head -1 | cut -d: -f2)
--   psql "postgresql://postgres:banc@localhost:$PORT/postgres" -f tests/rls/proba-lantul-de-sefi.sql
\set ON_ERROR_STOP on
\pset pager off

begin;

do $$
declare
  v_org       uuid := gen_random_uuid();
  v_alta      uuid := gen_random_uuid();
  v_sufix     text := left(replace(gen_random_uuid()::text, '-', ''), 8);

  v_angajat   uuid := gen_random_uuid();  -- contul cu rolul `employee`
  v_strain    uuid := gen_random_uuid();  -- membru al celeilalte firme

  v_director  uuid := gen_random_uuid();
  v_sef       uuid := gen_random_uuid();
  v_eu        uuid := gen_random_uuid();
  v_coleg     uuid := gen_random_uuid();
  v_dir_alta  uuid := gen_random_uuid();

  v_ids       uuid[];
  v_randuri   int;
  v_esecuri   int := 0;
begin
  raise notice '';
  raise notice '  PROBA „LANȚUL DE ȘEFI AL ANGAJATULUI"';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org,  'proba-lant-' || v_sufix, 'Proba Lanț SRL',
     'RO' || (88000000 + (random() * 900000)::int)::text),
    (v_alta, 'proba-lant-alta-' || v_sufix, 'Proba Lanț Alta SRL',
     'RO' || (87000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled) values
    (v_org, 'nucleu', true), (v_alta, 'nucleu', true)
  on conflict (organization_id, feature_key) where deleted_at is null do nothing;

  insert into auth.users (id, email) values
    (v_angajat, 'angajat-' || v_sufix || '@proba.test'),
    (v_strain,  'strain-'  || v_sufix || '@proba.test');
  insert into public.organization_members (organization_id, user_id, role, status) values
    (v_org,  v_angajat, 'employee', 'active'),
    (v_alta, v_strain,  'employee', 'active');

  -- Lanțul: director → șef → eu; colegul e tot sub șef. `manager_path` îl
  -- calculează triggerul din 0004, deci inserarea merge de sus în jos.
  insert into public.employees
    (id, organization_id, marca, first_name, last_name, status, is_primary, manager_employee_id, user_id)
  values
    (v_director, v_org, 'D' || v_sufix, 'Ion',   'Director', 'activ', true, null,       null);
  insert into public.employees
    (id, organization_id, marca, first_name, last_name, status, is_primary, manager_employee_id, user_id)
  values
    (v_sef,      v_org, 'S' || v_sufix, 'Maria', 'Sef',      'activ', true, v_director, null);
  insert into public.employees
    (id, organization_id, marca, first_name, last_name, status, is_primary, manager_employee_id, user_id)
  values
    (v_eu,       v_org, 'E' || v_sufix, 'Ana',   'Angajat',  'activ', true, v_sef,      v_angajat),
    (v_coleg,    v_org, 'C' || v_sufix, 'Dan',   'Coleg',    'activ', true, v_sef,      null);
  insert into public.employees
    (id, organization_id, marca, first_name, last_name, status, is_primary, manager_employee_id, user_id)
  values
    (v_dir_alta, v_alta, 'A' || v_sufix, 'Vlad', 'Strain',   'activ', true, null,       null);

  perform set_config('request.jwt.claim.sub', v_angajat::text, true);
  set local role authenticated;

  -- ═══ (1)+(2)+(5) Lanțul propriu, ordonat, fără sine și fără coleg ═════════
  select array_agg(l.id order by l.pozitie) into v_ids
    from public.lantul_meu_de_sefi(v_org) l;
  if v_ids is distinct from array[v_director, v_sef] then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) lanțul întors e % (așteptat director, șef)', v_ids;
  else
    raise notice '  ✓ (1) două rânduri, director → șef';
  end if;
  if v_eu = any (coalesce(v_ids, '{}')) or v_coleg = any (coalesce(v_ids, '{}')) then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2/5) rezultatul conține fișa proprie sau un coleg';
  else
    raise notice '  ✓ (2/5) fără fișa proprie, fără colegi';
  end if;

  -- ═══ (3) Politica `own` rămâne neatinsă ═══════════════════════════════════
  select count(*) into v_randuri from public.employees where organization_id = v_org;
  if v_randuri <> 1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) sub `own`, employees dă % rânduri (așteptat 1)', v_randuri;
  else
    raise notice '  ✓ (3) employees dă tot doar rândul propriu';
  end if;

  -- ═══ (4) Altă firmă: nimic ════════════════════════════════════════════════
  select count(*) into v_randuri from public.lantul_meu_de_sefi(v_alta);
  if v_randuri <> 0 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) cu organizația altei firme întoarce % rânduri', v_randuri;
  else
    raise notice '  ✓ (4) organizația altei firme: zero rânduri';
  end if;

  reset role;

  raise notice '';
  if v_esecuri > 0 then
    raise exception 'PROBA A EȘUAT: % verificări nepotrivite.', v_esecuri;
  end if;
  raise notice '  PROBA A TRECUT: angajatul își vede șefii, și doar pe ei.';
end
$$;

rollback;
