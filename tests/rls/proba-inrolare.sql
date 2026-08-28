-- tests/rls/proba-inrolare.sql
--
-- POARTA POZITIVĂ a înrolării: numerotarea contractelor, permisiunea îngustă de
-- invitare și legarea contului de fișă.
--
-- Verifică trei lucruri pe care niciun test din `pnpm test` nu le poate atinge,
-- fiindcă trăiesc în Postgres, nu în TypeScript:
--
--   (A) ARITMETICA FORMATULUI. `lpad` TAIE când șirul e mai lung decât lungimea
--       cerută — `lpad('10', 1, '0')` = `'1'`. Formatul „42/2026" are padding 1,
--       deci de la al zecelea contract al anului numărul s-ar fi trunchiat la
--       „1/2026" și ar fi coliziat cu contractul 1. O probă pe 1 și 2 n-ar fi
--       văzut nimic; de aceea se verifică 1, 9, 10, 99 și 100.
--
--   (B) PERMISIUNEA. `employees:invite` e nouă și îngustă: `hr` poate invita un
--       angajat, dar NU un administrator. Fără verificarea asta, o politică RLS
--       scrisă greșit ar da rolului `hr` exact privilegiul pe care permisiunea
--       îngustă exista ca să-l evite.
--
--   (C) LEGAREA. `employees.user_id` n-a fost scris niciodată de aplicație. Dacă
--       triggerul din 0099 nu funcționează, angajatul invitat primește cont și
--       tot n-are fișă — adică defectul rămâne, tăcut, exact ca înainte.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh --pastreaza
--   PORT=$(docker ps --filter name=administrativo-banc --format '{{.Ports}}' \
--          | grep -oE '0.0.0.0:[0-9]+' | head -1 | cut -d: -f2)
--   psql "postgresql://postgres:banc@localhost:$PORT/postgres" -f tests/rls/proba-inrolare.sql
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_org       uuid := gen_random_uuid();
  -- Sufix unic pe rulare: proba trebuie să poată fi repetată pe același banc.
  v_sufix     text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_an        integer := extract(year from current_date)::integer;
  v_admin     uuid := gen_random_uuid();
  v_hr        uuid := gen_random_uuid();
  v_manager   uuid := gen_random_uuid();
  v_nou       uuid := gen_random_uuid();
  v_ang       uuid := gen_random_uuid();
  v_invit     uuid := gen_random_uuid();
  v_numar     text;
  v_asteptat  text;
  v_legat     uuid;
  v_esecuri   int := 0;
  i           int;
begin
  -- ═══════════════════════════════════════════════════════════════════════
  -- Pregătire
  -- ═══════════════════════════════════════════════════════════════════════
  insert into public.organizations (id, slug, name, cui)
    values (v_org, 'proba-inrolare-' || v_sufix, 'Proba Înrolare SRL',
            'RO' || (88000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled)
    values (v_org, 'nucleu', true)
  on conflict (organization_id, feature_key) where deleted_at is null do nothing;

  insert into auth.users (id, email) values
    (v_admin,   'admin-'   || v_sufix || '@proba.test'),
    (v_hr,      'hr-'      || v_sufix || '@proba.test'),
    (v_manager, 'manager-' || v_sufix || '@proba.test'),
    (v_nou,     'nou-'     || v_sufix || '@proba.test');
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_admin,   'org_admin'),
    (v_org, v_hr,      'hr'),
    (v_org, v_manager, 'manager');

  -- Fișa patronului o creează triggerul din 0083; o scoatem, ca proba să
  -- controleze singură graful.
  delete from public.employees where organization_id = v_org;

  raise notice '';
  raise notice '── (A) numărul de contract: formatul, la limitele care contează ──';

  -- ═══════════════════════════════════════════════════════════════════════
  -- (A) Aritmetica formatului
  -- ═══════════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;

  for i in 1..100 loop
    v_numar := public.aloca_numar_contract(v_org);
    if i in (1, 9, 10, 99, 100) then
      v_asteptat := i::text || '/' || v_an::text;
      if v_numar = v_asteptat then
        raise notice '  al %-lea contract → %  ✓', rpad(i::text, 4), rpad(v_numar, 12);
      else
        v_esecuri := v_esecuri + 1;
        raise warning '  ✗ al % contract: așteptat „%", obținut „%"', i, v_asteptat, v_numar;
      end if;
    end if;
  end loop;

  -- Două apeluri succesive nu pot da același număr.
  if public.aloca_numar_contract(v_org) = public.aloca_numar_contract(v_org) then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ două alocări succesive au dat același număr';
  else
    raise notice '  două alocări succesive dau numere diferite      ✓';
  end if;

  reset role;

  -- ═══════════════════════════════════════════════════════════════════════
  -- (A2) Resetarea anuală
  -- ═══════════════════════════════════════════════════════════════════════
  -- Contorul anului trecut, dus la 57. Cel al anului curent trebuie să
  -- pornească oricum de la 1 — anul e în cheia tabelei, deci separarea vine din
  -- construcție, nu dintr-un job de la 1 ianuarie.
  declare
    v_org2 uuid := gen_random_uuid();
  begin
    insert into public.organizations (id, slug, name, cui)
      values (v_org2, 'proba-an-' || v_sufix, 'Proba An SRL',
              'RO' || (87000000 + (random() * 900000)::int)::text);
    insert into public.organization_members (organization_id, user_id, role)
      values (v_org2, v_admin, 'org_admin');
    delete from public.employees where organization_id = v_org2;
    insert into public.document_sequences
      (organization_id, document_type, year, prefix, next_number, padding)
      values (v_org2, 'contract_munca', v_an - 1, '', 57, 1);

    perform set_config('request.jwt.claim.sub', v_admin::text, true);
    set local role authenticated;
    v_numar := public.aloca_numar_contract(v_org2);
    reset role;

    if v_numar = '1/' || v_an::text then
      raise notice '  anul nou repornește de la 1 (nu de la 57)      ✓';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ resetare anuală: așteptat „1/%", obținut „%"', v_an, v_numar;
    end if;
  end;

  raise notice '';
  raise notice '── (B) cine poate aloca numere și cine poate invita ──';

  -- ═══════════════════════════════════════════════════════════════════════
  -- (B) Permisiunile
  -- ═══════════════════════════════════════════════════════════════════════
  -- `hr` are `employees:create`, deci poate aloca numere.
  perform set_config('request.jwt.claim.sub', v_hr::text, true);
  set local role authenticated;
  begin
    perform public.aloca_numar_contract(v_org);
    raise notice '  hr alocă numere de contract                     ✓';
  exception when others then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ hr NU poate aloca numere: %', sqlerrm;
  end;
  reset role;

  -- `manager` nu are `employees:create`. Absența permisiunii ESTE refuzul.
  perform set_config('request.jwt.claim.sub', v_manager::text, true);
  set local role authenticated;
  begin
    perform public.aloca_numar_contract(v_org);
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ manager A PUTUT aloca un număr de contract';
  exception when others then
    raise notice '  manager e refuzat la alocare                    ✓';
  end;
  reset role;

  -- Fișa de invitat, creată de administrator.
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  insert into public.employees (id, organization_id, marca, first_name, last_name, status)
    values (v_ang, v_org, '0001', 'Ion', 'Popescu', 'activ');
  reset role;

  -- `hr` poate invita un ANGAJAT…
  perform set_config('request.jwt.claim.sub', v_hr::text, true);
  set local role authenticated;
  begin
    insert into public.invitations
      (id, organization_id, email, role, token_hash, expires_at, employee_id)
    values
      (v_invit, v_org, 'nou-' || v_sufix || '@proba.test', 'employee',
       repeat('a', 64), now() + interval '7 days', v_ang);
    raise notice '  hr invită un angajat (rol „employee")           ✓';
  exception when others then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ hr NU poate invita un angajat: %', sqlerrm;
  end;

  -- …dar NU un administrator. Aici stă tot rostul permisiunii înguste: dacă
  -- linia asta trece, `employees:invite` a devenit `users:create`.
  begin
    insert into public.invitations
      (organization_id, email, role, token_hash, expires_at)
    values
      (v_org, 'sef-' || v_sufix || '@proba.test', 'org_admin',
       repeat('b', 64), now() + interval '7 days');
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ hr A PUTUT invita un org_admin — escaladare de privilegiu';
  exception when others then
    raise notice '  hr e refuzat la invitarea unui org_admin        ✓';
  end;
  reset role;

  raise notice '';
  raise notice '── (C) contul se leagă de fișă la acceptare ──';

  -- ═══════════════════════════════════════════════════════════════════════
  -- (C) Legarea
  -- ═══════════════════════════════════════════════════════════════════════
  -- Se simulează ce face `accept_invitation`: inserează rândul de membru cu
  -- `invitation_id`. Triggerul din 0099 face restul.
  insert into public.organization_members (organization_id, user_id, role, invitation_id)
    values (v_org, v_nou, 'employee', v_invit);

  select user_id into v_legat from public.employees where id = v_ang;
  if v_legat = v_nou then
    raise notice '  employees.user_id completat de trigger          ✓';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ fișa a rămas nelegată (user_id = %)', coalesce(v_legat::text, 'NULL');
  end if;

  -- O invitație FĂRĂ fișă nu trebuie să atingă nimic, dar nici să cadă.
  declare
    v_invit2 uuid := gen_random_uuid();
    v_pur    uuid := gen_random_uuid();
    v_cate   int;
  begin
    insert into auth.users (id, email) values (v_pur, 'pur-' || v_sufix || '@proba.test');
    insert into public.invitations
      (id, organization_id, email, role, token_hash, expires_at)
    values
      (v_invit2, v_org, 'pur-' || v_sufix || '@proba.test', 'employee',
       repeat('c', 64), now() + interval '7 days');
    insert into public.organization_members (organization_id, user_id, role, invitation_id)
      values (v_org, v_pur, 'employee', v_invit2);
    select count(*) into v_cate from public.employees
      where organization_id = v_org and user_id = v_pur;
    if v_cate = 0 then
      raise notice '  invitație fără fișă: nimic atins, fără eroare   ✓';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ invitația fără fișă a creat/legat % fișe', v_cate;
    end if;
  end;

  -- ═══════════════════════════════════════════════════════════════════════
  raise notice '';
  if v_esecuri = 0 then
    raise notice '▶ TOT VERDE: numerotare · permisiuni · legare';
  else
    raise exception '% verificări au picat', v_esecuri;
  end if;
end;
$$;
