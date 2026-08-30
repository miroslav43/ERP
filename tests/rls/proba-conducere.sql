-- tests/rls/proba-conducere.sql
--
-- POARTA POZITIVĂ a departamentului „Conducere" (0107): nu „nimeni nu intră unde
-- n-are voie", ci „administratorul CHIAR ajunge înăuntru" — plus refuzul care
-- trebuie să rămână refuz: cine e deja repartizat nu se mișcă.
--
-- ── DE CE NU AJUNGE SĂ VERIFICI CĂ DEPARTAMENTUL EXISTĂ ─────────────────────
-- Partea care se strică tăcut nu e crearea departamentului — aia e un `insert`
-- care ori merge, ori aruncă. Partea fragilă e a doua: repartizarea depinde de
-- ORDINEA ALFABETICĂ a două triggere scrise în migrări diferite
-- (`trg_zorganization_members_fisa_patron` din 0083, apoi
-- `trg_zz_organization_members_conducere` din 0107). Dacă al doilea ar sorta
-- înaintea primului, n-ar exista nicio eroare și niciun rând atins: patronul ar
-- rămâne pur și simplu nerepartizat.
--
-- De aceea fiecare verificare de mai jos RECITEȘTE `employees.department_id`
-- după inserare. Verdictul se pune pe starea din bază, niciodată pe `found`.
--
-- ── CE VERIFICĂ, PE RÂND ────────────────────────────────────────────────────
-- (1) firma nou-creată are „Conducere", fără ca nimeni s-o ceară;
-- (2) patronul, a cărui fișă o creează 0083, aterizează în ea;
-- (3) al doilea administrator — cofondatorul invitat din /setari/membri — la fel;
-- (4) un angajat DEJA repartizat la „Producție", făcut administrator, RĂMÂNE la
--     Producție. Regula hibridă e toată aici: intrăm în golul de la început, nu
--     smulgem pe nimeni din structura lui;
-- (5) promovarea unui membru existent (UPDATE of role), nu doar invitația nouă,
--     îl duce în Conducere — ramura pe care un trigger doar-pe-INSERT ar rata-o.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh --pastreaza
--   PORT=$(docker ps --filter name=administrativo-banc --format '{{.Ports}}' \
--          | grep -oE '0.0.0.0:[0-9]+' | head -1 | cut -d: -f2)
--   psql "postgresql://postgres:banc@localhost:$PORT/postgres" -f tests/rls/proba-conducere.sql
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_org       uuid := gen_random_uuid();
  -- Sufix unic pe rulare: proba trebuie să poată fi repetată pe același banc
  -- fără să se lovească de propriile date de la rulajul anterior.
  v_sufix     text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_conducere uuid;
  v_productie uuid := gen_random_uuid();
  v_patron    uuid := gen_random_uuid();
  v_cofond    uuid := gen_random_uuid();
  v_sefprod   uuid := gen_random_uuid();
  v_promovat  uuid := gen_random_uuid();
  v_citit     uuid;
  v_esecuri   int  := 0;
begin
  raise notice '';
  raise notice '  PROBA „CONDUCERE" (0107)';
  raise notice '  ─────────────────────────────────────────────────────────';

  -- ── Firma. `seats_limit` se lasă pe implicit (20, `not null`): proba are
  -- patru membri, deci plafonul de locuri nu intră în discuție. ──
  insert into public.organizations (id, slug, name, cui)
  values (v_org, 'proba-cond-' || v_sufix, 'Proba Conducere SRL',
          'RO' || (89000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled)
  values (v_org, 'nucleu', true)
  on conflict (organization_id, feature_key) where deleted_at is null do nothing;

  -- ═══ (1) Firma se naște cu departamentul ═══════════════════════════════════
  select d.id into v_conducere
    from public.departments d
   where d.organization_id = v_org
     and lower(d.cod) = 'conducere'
     and d.deleted_at is null;

  if v_conducere is null then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) firma nouă NU are departamentul „Conducere"';
    -- Fără el, verificările următoare n-ar avea ce compara: ies acum.
    raise exception 'PROBA A EȘUAT: departamentul nu se creează la crearea firmei.';
  end if;
  raise notice '  ✓ (1) firma nouă are „Conducere" (depth=%)',
    (select depth from public.departments where id = v_conducere);

  -- Un al doilea departament, ca să existe de unde NU se mută nimeni.
  insert into public.departments (id, organization_id, cod, denumire)
  values (v_productie, v_org, 'PROD', 'Producție');

  -- ═══ (2) Patronul ══════════════════════════════════════════════════════════
  -- Doar rândul de membru se inserează. Fișa o creează 0083, repartizarea o face
  -- 0107 — exact lanțul care rulează în producție la acceptarea invitației.
  insert into auth.users (id, email) values (v_patron, 'patron-' || v_sufix || '@proba.test');
  insert into public.organization_members (organization_id, user_id, role, status)
  values (v_org, v_patron, 'org_admin', 'active');

  select e.department_id into v_citit
    from public.employees e
   where e.organization_id = v_org and e.user_id = v_patron and e.is_primary;

  if v_citit is distinct from v_conducere then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) patronul NU e în Conducere (department_id = %)', coalesce(v_citit::text, 'null');
  else
    raise notice '  ✓ (2) patronul e în Conducere';
  end if;

  -- ═══ (3) Cofondatorul ══════════════════════════════════════════════════════
  insert into auth.users (id, email) values (v_cofond, 'cofondator-' || v_sufix || '@proba.test');
  insert into public.organization_members (organization_id, user_id, role, status)
  values (v_org, v_cofond, 'org_admin', 'active');

  select e.department_id into v_citit
    from public.employees e
   where e.organization_id = v_org and e.user_id = v_cofond and e.is_primary;

  if v_citit is distinct from v_conducere then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) cofondatorul NU e în Conducere (department_id = %)', coalesce(v_citit::text, 'null');
  else
    raise notice '  ✓ (3) cofondatorul intră singur, fără alt pas';
  end if;

  -- ═══ (4) Cine e deja repartizat NU se mișcă ════════════════════════════════
  -- Fișa există ÎNAINTEA rândului de membru, deci 0083 iese pe „are deja fișă",
  -- iar 0107 găsește un `department_id` nenul și nu atinge niciun rând.
  insert into auth.users (id, email) values (v_sefprod, 'sefprod-' || v_sufix || '@proba.test');
  insert into public.employees
    (organization_id, user_id, marca, first_name, last_name, status, is_primary, department_id)
  values (v_org, v_sefprod, 'P' || v_sufix, 'Ion', 'Popescu', 'activ', true, v_productie);

  insert into public.organization_members (organization_id, user_id, role, status)
  values (v_org, v_sefprod, 'org_admin', 'active');

  select e.department_id into v_citit
    from public.employees e
   where e.organization_id = v_org and e.user_id = v_sefprod and e.is_primary;

  if v_citit is distinct from v_productie then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) șeful de producție A FOST MUTAT din Producție (department_id = %)',
      coalesce(v_citit::text, 'null');
  else
    raise notice '  ✓ (4) șeful de producție promovat rămâne la Producție';
  end if;

  -- ═══ (5) Promovarea, nu doar invitația ═════════════════════════════════════
  insert into auth.users (id, email) values (v_promovat, 'promovat-' || v_sufix || '@proba.test');
  insert into public.organization_members (organization_id, user_id, role, status)
  values (v_org, v_promovat, 'employee', 'active');
  insert into public.employees
    (organization_id, user_id, marca, first_name, last_name, status, is_primary)
  values (v_org, v_promovat, 'Q' || v_sufix, 'Maria', 'Ionescu', 'activ', true);

  update public.organization_members
     set role = 'org_admin'
   where organization_id = v_org and user_id = v_promovat;

  select e.department_id into v_citit
    from public.employees e
   where e.organization_id = v_org and e.user_id = v_promovat and e.is_primary;

  if v_citit is distinct from v_conducere then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) membrul promovat NU a ajuns în Conducere (department_id = %)',
      coalesce(v_citit::text, 'null');
  else
    raise notice '  ✓ (5) promovarea unui membru existent îl duce în Conducere';
  end if;

  raise notice '';
  if v_esecuri > 0 then
    raise exception 'PROBA A EȘUAT: % verificări nepotrivite.', v_esecuri;
  end if;
  raise notice '  PROBA A TRECUT: administratorii intră singuri, ceilalți rămân unde sunt.';
end
$$;
