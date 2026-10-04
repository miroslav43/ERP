-- tests/rls/proba-act-aditional.sql
--
-- POARTA POZITIVĂ pentru „Modifică salariul" = act adițional
-- (`modificaSalariulContractului`, 0160): cine administrează personalul POATE
-- să încheie actul, să-l activeze și să-i emită documentul.
--
-- ── DE CE E OBLIGATORIE, ȘI NU DEDUSĂ ───────────────────────────────────────
-- Acțiunea face trei scrieri, păzite de DOUĂ chei diferite:
--   • INSERT în `employment_contracts`  → `contracts_insert` cere `employees:create = all`
--   • UPDATE status → activ             → `contracts_update` cere `employees:update = all`
--   • INSERT în `hr_issued_documents`   → `hr_issued_insert` cere `employees:create = all`
-- Un rol cu `create` dar fără `update` ar încheia actul și n-ar putea să-l
-- activeze: UPDATE-ul atinge ZERO rânduri, fără eroare, iar actul rămâne
-- „proiect" — adică salariul NU se schimbă în salarizare. Coloana „activează"
-- citește deci `found`, nu absența unei excepții.
--
-- ── CE MAI VERIFICĂ ─────────────────────────────────────────────────────────
-- (4) Registrul general primește actul ca „act_aditional" (triggerul 0120).
-- (5) Seedul `act_aditional_salariu` există — fără el documentul nu se emite.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud): vezi antetul lui
-- `proba-sabloane-documente.sql`; `banc-migrare.sh` o rulează automat.
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_org      uuid := gen_random_uuid();
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_ang      uuid := gen_random_uuid();
  v_baza     uuid := gen_random_uuid();
  v_sablon   uuid;
  v_act      uuid;
  v_rol      text;
  v_uid      uuid;
  v_esecuri  int := 0;
  v_i        int := 0;
  v_n        int;
  -- rol → poate încheia, activa și documenta un act adițional
  v_matrice  text[][] := array[
    array['org_admin','da'],
    array['hr',       'da'],
    array['manager',  'nu'],
    array['employee', 'nu']
  ];
  v_rand     text[];
begin
  select id into v_sablon from public.hr_document_templates
   where cod = 'act_aditional_salariu' and organization_id is null and deleted_at is null;
  if v_sablon is null then
    raise exception 'Seedul de platformă „act_aditional_salariu" lipsește — 0160 n-a rulat.';
  end if;

  insert into public.organizations (id, slug, name, cui)
  values (v_org, 'proba-aa-' || v_sufix, 'Proba Act Aditional SRL',
          'RO' || (89000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled)
  values (v_org, 'nucleu', true)
  on conflict (organization_id, feature_key) where deleted_at is null do nothing;

  create temporary table if not exists t_uid_aa (rol text primary key, uid uuid);
  foreach v_rand slice 1 in array v_matrice loop
    v_rol := v_rand[1];
    v_uid := gen_random_uuid();
    insert into auth.users (id, email) values (v_uid, v_rol || '-' || v_sufix || '@proba.test');
    insert into public.organization_members (organization_id, user_id, role)
      values (v_org, v_uid, v_rol::public.app_role);
    insert into t_uid_aa values (v_rol, v_uid) on conflict (rol) do update set uid = excluded.uid;
  end loop;

  delete from public.employees where organization_id = v_org;
  insert into public.employees (id, organization_id, marca, first_name, last_name, status, hired_on)
    values (v_ang, v_org, '0001', 'Ion', 'Popescu', 'activ', current_date - 300);
  insert into public.employment_contracts
    (id, organization_id, employee_id, numar, data_contract, valabil_de_la, salariu_baza, status)
  values (v_baza, v_org, v_ang, '42/2026', current_date - 310, current_date - 300, 5000, 'activ');

  raise notice '';
  raise notice '  rol         | încheie | activează | emite document';
  raise notice '  ------------+---------+-----------+---------------';

  foreach v_rand slice 1 in array v_matrice loop
    v_rol := v_rand[1];
    v_i := v_i + 1;
    select uid into v_uid from t_uid_aa where rol = v_rol;

    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    set local role authenticated;

    declare
      v_a text := '?'; v_b text := '-'; v_c text := '?';
    begin
      v_act := null;
      -- (1) încheie actul: rând nou, `proiect`, legat de contract
      begin
        insert into public.employment_contracts
          (organization_id, employee_id, parent_contract_id, este_act_aditional, numar,
           data_contract, valabil_de_la, salariu_baza, status, created_by, updated_by)
        values (v_org, v_ang, v_baza, true, '42/2026-AA' || v_i::text,
                current_date, current_date + 10, 6000, 'proiect', v_uid, v_uid)
        returning id into v_act;
        v_a := 'DA';
      exception when others then v_a := 'nu'; end;

      -- (2) îl activează — `found`, nu absența excepției
      if v_act is not null then
        begin
          update public.employment_contracts
             set status = 'activ', updated_by = v_uid
           where id = v_act;
          v_b := case when found then 'DA' else 'TĂCUT' end;
        exception when others then v_b := 'nu'; end;
      end if;

      -- (3) emite documentul actului, pe seria AAS
      begin
        insert into public.hr_issued_documents
          (organization_id, template_id, employee_id, contract_id, serie, numar, numar_afisat,
           titlu, continut_checksum, continut_html, emis_de)
        values (v_org, v_sablon, v_ang, v_act, 'AAS', v_i, 'AAS 2026/00000' || v_i::text,
                'Act adițional — modificarea salariului', repeat('a', 64), '<p>act</p>', v_uid);
        v_c := 'DA';
      exception when others then v_c := 'nu'; end;

      reset role;

      raise notice '  %| %| %| %', rpad(v_rol, 12), rpad(v_a, 8), rpad(v_b, 10), v_c;

      if v_rand[2] = 'da' and (v_a <> 'DA' or v_b <> 'DA' or v_c <> 'DA') then
        raise warning '    ✗ % trebuie să poată încheia (%), activa (%) și documenta (%) actul.',
          v_rol, v_a, v_b, v_c;
        v_esecuri := v_esecuri + 1;
      end if;
      if v_rand[2] = 'nu' and (v_a = 'DA' or v_c = 'DA') then
        raise warning '    ✗ % a încheiat sau a documentat un act adițional, deși n-ar trebui.', v_rol;
        v_esecuri := v_esecuri + 1;
      end if;
    end;
  end loop;

  -- (4) actele încheiate au intrat în registrul general ca acte adiționale
  select count(*) into v_n from public.registru_documente
   where organization_id = v_org and tip_document = 'act_aditional'
     and entitate_tip = 'employment_contracts';
  if v_n <> 2 then
    raise warning '    ✗ Registrul general are % acte adiționale, așteptate 2 (org_admin, hr).', v_n;
    v_esecuri := v_esecuri + 1;
  end if;

  -- Contractul de bază rămâne cum a fost semnat.
  if (select salariu_baza from public.employment_contracts where id = v_baza) <> 5000 then
    raise warning '    ✗ Contractul de bază a fost rescris.';
    v_esecuri := v_esecuri + 1;
  end if;

  raise notice '';
  if v_esecuri = 0 then
    raise notice '  ✓ Toate probele au trecut.';
  else
    raise exception '% probe au eșuat.', v_esecuri;
  end if;

  raise exception 'DERULARE_INAPOI' using errcode = 'P0001';
exception
  when others then
    if sqlerrm = 'DERULARE_INAPOI' then
      raise notice '  (tranzacție derulată înapoi — banca rămâne curată)';
    else
      raise;
    end if;
end;
$$;
