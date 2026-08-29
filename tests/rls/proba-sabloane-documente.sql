-- tests/rls/proba-sabloane-documente.sql
--
-- POARTA POZITIVĂ pentru editorul de șabloane și pentru regenerarea
-- documentelor: nu „nimeni nu scrie ce n-are voie", ci „cine administrează
-- personalul POATE să-și scrie șablonul și POATE să anuleze un document emis".
--
-- ── DE CE E OBLIGATORIE, ȘI NU DEDUSĂ ───────────────────────────────────────
-- Acțiunea `angajati.documente.regenereaza` declară `employees:create`, fiindcă
-- EMITE un document (`hr_issued_insert` cere `create`). Dar tot ea face un
-- UPDATE de anulare, iar `hr_issued_update` cere `employees:update` — altă
-- cheie. Dacă vreun rol le are dezlipite, anularea eșuează TĂCUT: clauza `USING`
-- respinge rândul, `update` atinge ZERO rânduri și NU întoarce nicio eroare.
-- Angajatul rămâne cu două documente active, iar dosarul lui arată două
-- contracte valabile fără ca nimeni să afle.
--
-- Coloana „anulează" de mai jos citește deci `found`, nu absența unei excepții.
--
-- ── CE MAI VERIFICĂ ─────────────────────────────────────────────────────────
-- (2) Seedul de platformă (`organization_id is null`) rămâne INTANGIBIL. Clauza
--     `with check` din `hr_templates_insert`/`_update` cere `organization_id is
--     not null`, deci o încercare de a-l edita nu dă eroare, ci zero rânduri —
--     iar dacă poarta ar ceda, un `org_admin` ar rescrie contractul TUTUROR
--     firmelor de pe platformă dintr-un singur UPDATE.
-- (3) Izolarea între firme: `hr` din firma A nu atinge șablonul firmei B.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh --pastreaza
--   PORT=$(docker ps --filter name=administrativo-banc --format '{{.Ports}}' \
--          | grep -oE '0.0.0.0:[0-9]+' | head -1 | cut -d: -f2)
--   psql "postgresql://postgres:banc@localhost:$PORT/postgres" -f tests/rls/proba-sabloane-documente.sql
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_org      uuid := gen_random_uuid();
  v_org_b    uuid := gen_random_uuid();
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_ang      uuid := gen_random_uuid();
  v_sablon_b uuid := gen_random_uuid();
  v_platf    uuid;
  v_doc      uuid;
  v_rol      text;
  v_uid      uuid;
  v_esecuri  int := 0;
  v_html     text;
  -- rol → (scrie șablonul firmei, anulează un document emis)
  v_matrice  text[][] := array[
    array['org_admin','da','da'],
    array['hr',       'da','da'],
    array['manager',  'nu','nu'],
    array['employee', 'nu','nu']
  ];
  v_rand     text[];
begin
  insert into public.organizations (id, slug, name, cui)
  values (v_org, 'proba-sabl-' || v_sufix, 'Proba Sabloane SRL',
          'RO' || (89000000 + (random() * 900000)::int)::text);
  insert into public.organizations (id, slug, name, cui)
  values (v_org_b, 'proba-sabl-b-' || v_sufix, 'Proba Sabloane B SRL',
          'RO' || (89000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled)
  values (v_org, 'nucleu', true), (v_org_b, 'nucleu', true)
  on conflict (organization_id, feature_key) where deleted_at is null do nothing;

  foreach v_rand slice 1 in array v_matrice loop
    v_rol := v_rand[1];
    v_uid := gen_random_uuid();
    insert into auth.users (id, email) values (v_uid, v_rol || '-' || v_sufix || '@proba.test');
    insert into public.organization_members (organization_id, user_id, role)
      values (v_org, v_uid, v_rol::public.app_role);
    create temporary table if not exists t_uid_sabl (rol text primary key, uid uuid);
    insert into t_uid_sabl values (v_rol, v_uid) on conflict (rol) do update set uid = excluded.uid;
  end loop;

  -- Fișa patronului o creează triggerul din 0083; o scoatem, ca proba să
  -- controleze singură graful.
  delete from public.employees where organization_id = v_org;
  insert into public.employees (id, organization_id, marca, first_name, last_name, status, hired_on)
    values (v_ang, v_org, '0001', 'Ion', 'Popescu', 'activ', current_date - 100);

  select id into v_platf from public.hr_document_templates
   where cod = 'contract_munca' and organization_id is null and deleted_at is null;
  if v_platf is null then
    raise exception 'Seedul de platformă „contract_munca" lipsește — migrările 0033/0101 n-au rulat.';
  end if;

  -- Șablon al firmei B, pe care nimeni din firma A n-are voie să-l atingă.
  insert into public.hr_document_templates
    (id, organization_id, cod, denumire, continut_html, serie)
  values (v_sablon_b, v_org_b, 'contract_munca', 'Contract B', '<p>al firmei B</p>', 'CIM');

  raise notice '';
  raise notice '  rol         | scrie șablon | anulează doc | atinge platforma | atinge firma B';
  raise notice '  ------------+--------------+--------------+------------------+---------------';

  foreach v_rand slice 1 in array v_matrice loop
    v_rol := v_rand[1];
    select uid into v_uid from t_uid_sabl where rol = v_rol;

    -- Un document emis proaspăt la fiecare rol, ca anularea precedentă să nu
    -- facă următorul rol să pară refuzat.
    delete from public.hr_issued_documents where organization_id = v_org;
    delete from public.hr_document_templates where organization_id = v_org;
    insert into public.hr_issued_documents
      (organization_id, template_id, employee_id, serie, numar, numar_afisat,
       titlu, continut_checksum, continut_html, emis_de)
    values (v_org, v_platf, v_ang, 'CIM', 1, 'CIM 2026/000001',
            'Contract individual de muncă', repeat('a', 64), '<p>vechi</p>', v_uid)
    returning id into v_doc;

    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    set local role authenticated;

    declare
      v_a text := '?'; v_b text := '?'; v_c text := '?'; v_d text := '?';
    begin
      -- (1) își scrie șablonul firmei
      begin
        insert into public.hr_document_templates
          (organization_id, cod, denumire, continut_html, serie)
        values (v_org, 'contract_munca', 'Contractul nostru', '<p>{{angajat_nume}}</p>', 'CIM');
        v_a := 'DA';
      exception when others then v_a := 'nu'; end;

      -- (2) anulează documentul emis — `found`, nu absența excepției
      begin
        update public.hr_issued_documents
           set anulat_la = now(), motiv_anulare = 'proba'
         where id = v_doc and anulat_la is null;
        v_b := case when found then 'DA' else 'TĂCUT' end;
      exception when others then v_b := 'nu'; end;

      -- (3) rescrie seedul de platformă — trebuie să fie ZERO rânduri
      begin
        update public.hr_document_templates
           set continut_html = '<p>deturnat</p>'
         where id = v_platf;
        v_c := case when found then 'DA' else 'nu' end;
      exception when others then v_c := 'nu'; end;

      -- (4) rescrie șablonul firmei B
      begin
        update public.hr_document_templates
           set continut_html = '<p>deturnat</p>'
         where id = v_sablon_b;
        v_d := case when found then 'DA' else 'nu' end;
      exception when others then v_d := 'nu'; end;

      reset role;

      raise notice '  %| %| %| %| %',
        rpad(v_rol, 12), rpad(v_a, 13), rpad(v_b, 13), rpad(v_c, 17), v_d;

      -- (1) și (2) sunt porți POZITIVE: „nu" e la fel de grav ca un „DA" în
      -- coloanele de refuz.
      if v_a <> upper(v_rand[2]) and not (v_a = 'nu' and v_rand[2] = 'nu') then
        raise warning '    ✗ % ar trebui să scrie șablonul: % (așteptat %)', v_rol, v_a, v_rand[2];
        v_esecuri := v_esecuri + 1;
      end if;
      if v_rand[3] = 'da' and v_b <> 'DA' then
        raise warning '    ✗ % NU poate anula documentul emis (%). Acțiunea declară `employees:create`, dar politica cere `employees:update`.', v_rol, v_b;
        v_esecuri := v_esecuri + 1;
      end if;
      if v_rand[3] = 'nu' and v_b = 'DA' then
        raise warning '    ✗ % a anulat un document emis, deși n-ar trebui.', v_rol;
        v_esecuri := v_esecuri + 1;
      end if;
      if v_c = 'DA' then
        raise warning '    ✗ % a rescris SEEDUL DE PLATFORMĂ — afectează toate firmele.', v_rol;
        v_esecuri := v_esecuri + 1;
      end if;
      if v_d = 'DA' then
        raise warning '    ✗ % a rescris șablonul ALTEI FIRME.', v_rol;
        v_esecuri := v_esecuri + 1;
      end if;
    end;
  end loop;

  -- Seedul de platformă trebuie să fie neatins după toate încercările.
  select continut_html into v_html from public.hr_document_templates where id = v_platf;
  if v_html = '<p>deturnat</p>' then
    raise warning '    ✗ Seedul de platformă A FOST modificat.';
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
end $$;
