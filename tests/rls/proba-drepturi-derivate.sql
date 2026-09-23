-- tests/rls/proba-drepturi-derivate.sql
--
-- DREPTURILE ȘI CÂMPURILE DERIVATE, DUPĂ 0149.
--
-- ── DE CE EXISTĂ FIȘIERUL ───────────────────────────────────────────────────
-- Două familii de defecte care arată la fel din afară: un rând care decide ce
-- poate ALTCINEVA (suprascrierea de permisiuni, jurnalul de audit) și o coloană
-- pe care o calculează un trigger (`manager_path`, autorul, câmpurile de
-- decizie). Ambele se puteau scrie de mână printr-un PATCH direct.
--
-- Verificarea (4) e cea care apără reparația de ea însăși: lanțul de subordonare
-- TREBUIE să se recalculeze în continuare, inclusiv în cascadă pe subordonații
-- subordonatului. O gardă care oprește și recalculul ar rupe tot scope-ul
-- `team` din produs, tăcut.
--
-- ── CE VERIFICĂ, PE RÂND ────────────────────────────────────────────────────
-- (1) managerul nu mai poate RETINTI o suprascriere pe cineva din afara echipei;
-- (2) dar o poate crea și modifica pe subordonatul lui            [POZITIVĂ];
-- (3) `manager_path` nu se mai scrie direct;
-- (4) schimbarea managerului recalculează lanțul, în cascadă      [POZITIVĂ];
-- (5) comentariul de tichet cu autor falsificat e refuzat;
-- (6) comentariul propriu trece                                   [POZITIVĂ];
-- (7) tichetul cu aprobare prefabricată e refuzat;
-- (8) tichetul normal trece                                       [POZITIVĂ];
-- (9) `log_audit_event` fără organizație e refuzat;
-- (10) `log_audit_event` redactează cheile de secrete și ignoră IP-ul din cerere;
-- (11) `avatar_path` cu URL extern e refuzat;
-- (12) marca se alocă doar cui creează angajați.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org      uuid := gen_random_uuid();
  v_u_hr     uuid := gen_random_uuid();
  v_u_mgr    uuid := gen_random_uuid();
  v_u_ang    uuid := gen_random_uuid();
  v_u_strain uuid := gen_random_uuid();
  v_e_mgr    uuid := gen_random_uuid();
  v_e_ang    uuid := gen_random_uuid();
  v_e_nepot  uuid := gen_random_uuid();
  v_e_strain uuid := gen_random_uuid();
  v_m_mgr    uuid;
  v_m_strain uuid;
  v_supra    uuid;
  v_tichet   uuid;
  v_audit    uuid;
  v_cale     uuid[];
  v_jsonb    jsonb;
  v_ip       inet;
  v_text     text;
  v_atinse   int;
  v_esecuri  int := 0;
begin
  raise notice '';
  raise notice '  PROBA „DREPTURI ȘI CÂMPURI DERIVATE" (0149)';
  raise notice '  ─────────────────────────────────────────────────────────';

  -- ── fixture ───────────────────────────────────────────────────────────────
  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-drept-' || v_sufix, 'Proba Drepturi SRL',
     'RO' || (89000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select v_org, f.feature_key, true, now() from public.features f;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_hr,     'dr-hr-'  || v_sufix || '@proba.test', now()),
    (v_u_mgr,    'dr-mgr-' || v_sufix || '@proba.test', now()),
    (v_u_ang,    'dr-ang-' || v_sufix || '@proba.test', now()),
    (v_u_strain, 'dr-str-' || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_hr, 'hr'), (v_org, v_u_mgr, 'manager'),
    (v_org, v_u_ang, 'employee'), (v_org, v_u_strain, 'employee');
  select id into v_m_mgr    from public.organization_members where user_id = v_u_mgr;
  select id into v_m_strain from public.organization_members where user_id = v_u_strain;

  -- Ierarhie pe trei niveluri: manager → angajat → nepot. Nepotul există ca să
  -- se vadă cascada de la (4).
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_mgr,    v_org, 'DR-M', 'Mihai', 'Manager', app.azi_local() - 500, 'activ', v_u_mgr,    null),
    (v_e_ang,    v_org, 'DR-A', 'Ana',   'Angajat', app.azi_local() - 400, 'activ', v_u_ang,    v_e_mgr),
    (v_e_nepot,  v_org, 'DR-N', 'Nicu',  'Nepot',   app.azi_local() - 300, 'activ', null,       v_e_ang),
    (v_e_strain, v_org, 'DR-S', 'Sorin', 'Strain',  app.azi_local() - 200, 'activ', v_u_strain, null);

  -- Managerul primește `roles:update = team`, ca în seed.
  insert into public.role_permissions (organization_id, role, resource, action, scope)
  values (v_org, 'manager', 'roles', 'update', 'team');

  -- ═══ (2) Suprascrierea pe subordonat [POZITIVĂ] ═══════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    -- `role` e NOT NULL și se completează cu rolul membrului, ca în acțiune
    -- (`permisiuni/actions.ts`): suprascrierea nu înlocuiește rolul, îl rafinează.
    insert into public.role_permissions (organization_id, member_id, role, resource, action, scope)
    select v_org, m.id, m.role, 'attendance', 'read', 'team'
      from public.organization_members m where m.user_id = v_u_ang
    returning id into v_supra;
    reset role;
    raise notice '  ✓ (2) managerul creează suprascrierea pe subordonat';
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) managerul nu mai poate crea suprascrierea: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (1) Retintirea pe cineva din afara echipei ═══════════════════════════
  -- Un WITH CHECK încălcat ARUNCĂ (42501); un USING care nu se potrivește tace
  -- și afectează zero rânduri. Poarta nouă stă în WITH CHECK, deci se așteaptă
  -- excepția — dar verificarea acceptă și varianta tăcută, ca să nu depindă de
  -- unde anume a fost pusă condiția.
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    update public.role_permissions
       set member_id = v_m_strain, resource = 'employees', action = 'read', scope = 'all'
     where id = v_supra;
    get diagnostics v_atinse = row_count;
    reset role;
    if v_atinse = 0 then
      raise notice '  ✓ (1) retintirea pe cineva din afara echipei e refuzată (zero rânduri)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (1) suprascrierea a fost mutată pe un membru din afara echipei';
    end if;
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (1) retintirea pe cineva din afara echipei e refuzată (42501)';
  end;

  -- ═══ (3) `manager_path` scris direct ══════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  update public.employees set manager_path = array[v_e_strain, v_e_ang] where id = v_e_ang;
  reset role;
  select manager_path into v_cale from public.employees where id = v_e_ang;
  if v_cale = array[v_e_mgr, v_e_ang] then
    raise notice '  ✓ (3) `manager_path` rămâne cel calculat';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) `manager_path` a fost scris de la client: %', v_cale;
  end if;

  -- ═══ (4) Recalculul și cascada [POZITIVĂ] ═════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  update public.employees set manager_employee_id = v_e_strain where id = v_e_ang;
  reset role;
  select manager_path into v_cale from public.employees where id = v_e_ang;
  if v_cale = array[v_e_strain, v_e_ang] then
    select manager_path into v_cale from public.employees where id = v_e_nepot;
    if v_cale = array[v_e_strain, v_e_ang, v_e_nepot] then
      raise notice '  ✓ (4) schimbarea managerului recalculează lanțul, în cascadă';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (4) cascada pe subordonatul subordonatului s-a rupt: %', v_cale;
    end if;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) lanțul nu s-a recalculat la schimbarea managerului: %', v_cale;
  end if;

  -- ═══ (7) Tichet cu aprobare prefabricată ══════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    insert into public.tickets
      (organization_id, tip, titlu, descriere, solicitant_employee_id, status,
       prioritate, prioritate_manuala, asignat_employee_id, aprobat_de_employee_id, decizie_la,
       numar_afisat, aprobare_ceruta, denumire_hardware, loc_livrare, motiv_necesitate)
    values (v_org, 'hardware', 'Laptop nou', 'Am nevoie', v_e_ang, 'in_aprobare',
            'critica', true, v_e_mgr, v_e_mgr, now(), public.aloca_numar_tichet(v_org), true,
            'Laptop 14 inch', 'birou', 'Cel vechi s-a stricat');
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) tichetul cu aprobare prefabricată a fost acceptat';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (7) tichetul cu aprobare prefabricată e refuzat';
  end;

  -- ═══ (8) Tichetul normal [POZITIVĂ] ═══════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    insert into public.tickets
      (organization_id, tip, titlu, descriere, solicitant_employee_id, status, numar_afisat,
       aprobare_ceruta, denumire_hardware, loc_livrare, motiv_necesitate)
    values (v_org, 'hardware', 'Laptop nou', 'Am nevoie', v_e_ang, 'in_aprobare',
            public.aloca_numar_tichet(v_org), true, 'Laptop 14 inch', 'birou', 'Cel vechi s-a stricat')
    returning id into v_tichet;
    reset role;
    raise notice '  ✓ (8) tichetul normal se creează';
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) tichetul normal a fost refuzat: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (6) Comentariul propriu [POZITIVĂ] ═══════════════════════════════════
  if v_tichet is not null then
    perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
    set local role authenticated;
    begin
      insert into public.ticket_comments (organization_id, ticket_id, autor_employee_id, continut)
      values (v_org, v_tichet, v_e_ang, 'Mulțumesc.');
      reset role;
      raise notice '  ✓ (6) comentariul propriu se postează';
    exception when others then
      reset role;
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (6) comentariul propriu a fost refuzat: % (%)', sqlerrm, sqlstate;
    end;

    -- ═══ (5) Comentariul cu autor falsificat ════════════════════════════════
    perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
    set local role authenticated;
    begin
      insert into public.ticket_comments (organization_id, ticket_id, autor_employee_id, continut)
      values (v_org, v_tichet, v_e_mgr, 'Aprobat, cumpărați.');
      reset role;
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (5) comentariul semnat de altcineva a fost acceptat';
    exception when insufficient_privilege then
      reset role;
      raise notice '  ✓ (5) comentariul cu autor falsificat e refuzat';
    end;
  end if;

  -- ═══ (9) Audit fără organizație ═══════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    perform public.log_audit_event('delete', 'failure', null, 'platforma');
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) s-a scris un rând de audit fără organizație';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (9) rândul de audit fără organizație e refuzat';
  end;

  -- ═══ (10) Scrubarea și IP-ul ══════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  v_audit := public.log_audit_event(
    'update', 'success', v_org, 'employees', v_e_ang,
    -- `token` e una dintre cheile pe care `internal.scrub_jsonb` le redactează
    -- (vezi `internal.audit_forbidden_patterns`). CNP-ul NU e printre ele, și e
    -- corect așa: ce ajunge în jurnal decide lista din `createAction`.
    null, jsonb_build_object('token', 'secret-de-sesiune', 'nota', 'ceva'),
    '203.0.113.7', 'UA-fabricat');
  reset role;
  select after, ip into v_jsonb, v_ip from public.audit_logs where id = v_audit;
  if (v_jsonb ->> 'token') = '[redactat]' and v_ip is null then
    raise notice '  ✓ (10) `before`/`after` sunt scrubate, iar IP-ul din cerere e ignorat';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10) audit nescrubat sau IP din cerere: after=%, ip=%', v_jsonb, v_ip;
  end if;

  -- ═══ (11) Avatar cu URL extern ════════════════════════════════════════════
  begin
    update public.profiles set avatar_path = 'https://pixel.exemplu.test/p.png' where id = v_u_ang;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (11) `avatar_path` a acceptat un URL extern';
  exception when check_violation then
    raise notice '  ✓ (11) `avatar_path` acceptă doar o cale din bucket';
  end;

  -- ═══ (12) Alocarea mărcii ═════════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    perform public.urmatoarea_marca(v_org);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (12) un angajat a consumat un număr de marcă';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (12a) angajatul nu mai consumă mărci';
  end;

  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  begin
    v_text := public.urmatoarea_marca(v_org);
    reset role;
    if v_text is not null then
      raise notice '  ✓ (12b) `hr` alocă marca în continuare (%)', v_text;
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (12b) `hr` n-a primit marcă';
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (12b) `hr` nu mai poate aloca marca: % (%)', sqlerrm, sqlstate;
  end;

  -- ── verdict ───────────────────────────────────────────────────────────────
  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA DREPTURILOR ȘI DERIVATELOR: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE cele 12 verificări au trecut.';
  raise notice '';
end;
$$;
