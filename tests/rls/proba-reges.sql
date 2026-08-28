-- tests/rls/proba-reges.sql
--
-- POARTA POZITIVĂ a modulului REGES-Online: nu „nimeni nu vede ce n-are voie",
-- ci „cine are voie POATE lucra".
--
-- Există fiindcă verificarea negativă singură nu prinde nimic. În Faza 2,
-- proiectul a fost comis ca livrat în timp ce un `org_admin` nu putea insera un
-- angajat: treceau typecheck, lint, 175 de teste, cele trei bariere SQL și
-- izolarea 11/11. Iar modulul de dinaintea lui 0087 avea exact defectul ăsta —
-- rolul `hr`, adică omul care transmite la ITM, n-avea NICIO permisiune
-- `compliance` și nu putea deschide ecranul.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh --pastreaza
--   PORT=$(docker ps --filter name=administrativo-banc --format '{{.Ports}}' \
--          | grep -oE '0.0.0.0:[0-9]+' | head -1 | cut -d: -f2)
--   psql "postgresql://postgres:banc@localhost:$PORT/postgres" -f tests/rls/proba-reges.sql
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_org      uuid := gen_random_uuid();
  -- Sufix unic pe rulare: proba trebuie să poată fi repetată pe același banc
  -- fără să se lovească de propriile date de la rulajul anterior.
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_ang      uuid := gen_random_uuid();
  v_cim      uuid := gen_random_uuid();
  v_ev       uuid := gen_random_uuid();
  v_rol      text;
  v_uid      uuid;
  v_mesaj    uuid;
  v_reusit   boolean;
  v_detaliu  text;
  v_esecuri  int := 0;
  -- rol → (poate pune în coadă, poate transmite, poate configura, poate citi)
  v_matrice  text[][] := array[
    array['org_admin','da','da','da','da'],
    array['hr',       'da','da','da','da'],
    array['manager',  'nu','nu','nu','nu'],
    array['employee', 'nu','nu','nu','nu']
  ];
  v_rand     text[];
begin
  insert into public.organizations (id, slug, name, cui) values (v_org, 'proba-reges-' || v_sufix, 'Proba REGES SRL', 'RO' || (89000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled)
  values (v_org, 'reges', true), (v_org, 'nucleu', true)
  on conflict (organization_id, feature_key) where deleted_at is null do nothing;

  -- Un utilizator per rol.
  foreach v_rand slice 1 in array v_matrice loop
    v_rol := v_rand[1];
    v_uid := gen_random_uuid();
    insert into auth.users (id, email) values (v_uid, v_rol || '-' || v_sufix || '@proba.test');
    insert into public.organization_members (organization_id, user_id, role)
      values (v_org, v_uid, v_rol::public.app_role);
    execute format('create temporary table if not exists t_uid (rol text primary key, uid uuid)');
    insert into t_uid values (v_rol, v_uid) on conflict (rol) do update set uid = excluded.uid;
  end loop;

  -- Fișa patronului o creează triggerul din 0083; o scoatem, ca proba să
  -- controleze singură graful.
  delete from public.employees where organization_id = v_org;
  insert into public.departments (organization_id, cod, denumire) values (v_org, 'ADM', 'Administrativ');
  insert into public.job_positions (organization_id, cod, denumire, cod_cor)
    values (v_org, 'REF', 'Referent', '251401');
  insert into public.employees (id, organization_id, marca, first_name, last_name, status, hired_on)
    values (v_ang, v_org, '0001', 'Ion', 'Popescu', 'activ', current_date - 100);
  insert into public.employment_contracts (id, organization_id, employee_id, numar, data_contract, valabil_de_la, salariu_baza)
    values (v_cim, v_org, v_ang, 'CIM-1', current_date - 100, current_date - 100, 5000);
  insert into public.reges_evenimente (organization_id, employee_id, contract_id, event_type, data_evenimentului, termen_transmitere)
    values (v_org, v_ang, v_cim, 'angajare', current_date - 100, current_date - 101)
    returning id into v_ev;

  raise notice '';
  raise notice '  rol         | pune în coadă | transmite | configurează | citește';
  raise notice '  ------------+---------------+-----------+--------------+--------';

  foreach v_rand slice 1 in array v_matrice loop
    v_rol := v_rand[1];
    select uid into v_uid from t_uid where rol = v_rol;
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    set local role authenticated;

    declare
      v_coada text := '?'; v_trans text := '?'; v_conf text := '?'; v_cit text := '?';
    begin
      -- (1) pune în coadă
      begin
        insert into public.reges_mesaje (organization_id, employee_id, contract_id, tip, operatie)
        values (v_org, v_ang, v_cim, 'salariat', 'InregistrareSalariat')
        returning id into v_mesaj;
        v_coada := 'DA';
      exception when others then v_coada := 'nu'; end;

      -- (2) transmite (marchează plecat)
      if v_mesaj is not null then
        begin
          update public.reges_mesaje set stare = 'asteapta_raspuns', trimis_la = now()
          where id = v_mesaj and organization_id = v_org;
          v_trans := case when found then 'DA' else 'nu' end;
        exception when others then v_trans := 'nu'; end;
      else
        begin
          update public.reges_mesaje set eroare = 'sondă'
          where organization_id = v_org;
          v_trans := case when found then 'DA' else 'nu' end;
        exception when others then v_trans := 'nu'; end;
      end if;

      -- (3) configurează
      begin
        perform public.reges_write_credentiale(
          v_org, 'test'::public.reges_mediu, 'RO123', 'reges-api', 'u@test',
          '\x01'::bytea, repeat('a',12)::bytea, repeat('b',16)::bytea, 1,
          '\x02'::bytea, repeat('c',12)::bytea, repeat('d',16)::bytea, 1);
        v_conf := 'DA';
      exception when others then v_conf := 'nu'; end;

      -- (4) citește registrul
      begin
        perform 1 from public.reges_evenimente where organization_id = v_org limit 1;
        v_cit := case when found then 'DA' else 'nu' end;
      exception when others then v_cit := 'nu'; end;

      reset role;
      raise notice '  %| %| %| %| %',
        rpad(v_rol, 12), rpad(v_coada, 14), rpad(v_trans, 10), rpad(v_conf, 13), v_cit;

      if (v_rand[2] = 'da') <> (v_coada = 'DA') then v_esecuri := v_esecuri + 1;
        raise warning '  ✗ %: coadă așteptat %, obținut %', v_rol, v_rand[2], v_coada; end if;
      if (v_rand[4] = 'da') <> (v_conf = 'DA') then v_esecuri := v_esecuri + 1;
        raise warning '  ✗ %: configurare așteptat %, obținut %', v_rol, v_rand[4], v_conf; end if;
      if (v_rand[5] = 'da') <> (v_cit = 'DA') then v_esecuri := v_esecuri + 1;
        raise warning '  ✗ %: citire așteptat %, obținut %', v_rol, v_rand[5], v_cit; end if;
    end;
    v_mesaj := null;
    delete from public.reges_mesaje where organization_id = v_org;
    delete from public.reges_credentiale where organization_id = v_org;
  end loop;

  raise notice '';
  if v_esecuri > 0 then
    raise exception 'PROBA A EȘUAT: % nepotriviri față de matricea de roluri.', v_esecuri;
  end if;
  raise notice '  PROBA A TRECUT: fiecare rol poate exact ce trebuie.';
end
$$;
