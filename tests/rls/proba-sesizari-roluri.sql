-- tests/rls/proba-sesizari-roluri.sql
--
-- SESIZAREA CA FLUX, PE ROLURI (0181): RAPORTOR, TEHNICIAN, GESTIONAR, STRĂIN.
--
-- ── DE CE EXISTĂ FIȘIERUL ───────────────────────────────────────────────────
-- Drepturile nominale nu stau într-un `can()`: stau în politica de UPDATE a
-- lui `fault_reports`, care deschide ușa raportorului și tehnicianului, și în
-- garda `internal.fault_reports_garda`, care le dă fiecăruia exact câmpurile
-- lui. Ce poate scrie un rol se AFLĂ rulând, nu deducând — raționamentul a
-- greșit de patru ori în acest proiect. Jumătate din verificări sunt POZITIVE:
-- un tehnician care nu-și poate rezolva sesizarea arată, din afară, ca o pană.
--
-- ── CE VERIFICĂ, PE RÂND ────────────────────────────────────────────────────
--  (1) raportorul depune sesizarea; primește număr `SZ-AAAA-0001`     [POZITIVĂ]
--  (2) raportorul NU poate atribui (câmp străin → P0001)
--  (3) raportorul își editează descrierea cât e „nouă”                 [POZITIVĂ]
--  (4) tehnicianul NU vede sesizarea înainte de atribuire
--  (5) gestionarul atribuie; `atribuit_la`, istoric, notificare        [POZITIVĂ]
--  (6) tehnicianul o vede și o trece în lucru                          [POZITIVĂ]
--  (7) tehnicianul NU poate schimba urgența (P0001)
--  (8) tehnicianul înregistrează intervenția pe sesizarea LUI și o
--      marchează rezolvată                                             [POZITIVĂ]
--  (9) raportorul confirmă („închis”); terminală: nimic mai departe    [POZITIVĂ]
-- (10) sesizarea cu „oprește funcționarea” deschide o oprire; colegul
--      străin n-o vede; respingerea o închide și scrie istoricul
-- (11) comentarii: raportorul comentează; nota internă a gestionarului
--      nu i se arată și nu o poate scrie
-- (12) atașamente: raportorul își pune rândul; colegul străin, nu
-- (13) managerul (team, fără update) vede, dar nu triază (zero rânduri)
-- (14) hr nu vede nimic
-- (15) administratorul FĂRĂ fișă de angajat poate sesiza (raportor null)
-- (16) închiderea automată mută „rezolvat” vechi în „închis”
-- (17) setările: administratorul scrie, managerul e refuzat
-- (18) raportorul NU poate șterge logic sesizarea lui (o retrage, nu o șterge)
-- (19) tehnicianul NU poate înregistra intervenția pe ALT echipament decât al
--      sesizării lui; „rezolvat” cu intervenția altui echipament → P0001
-- (20) comentariul, odată scris, nu se mută pe altă sesizare și nu devine
--      „intern” (gardă + WITH CHECK)
-- (21) tehnicianul nu poate falsifica coloanele scrise de triggere
--      (`atribuit_la`) — garda le fixează la valoarea veche
-- (22) la INSERT, numărul, `raportat_la` și contorul de redeschideri trimise
--      de client sunt ignorate: le pune baza
-- (23) tehnicianul poate doar să ÎNCHIDĂ oprirea sesizării lui, nu să-i mute
--      începutul ori tipul                                             [POZITIVĂ]
-- (24) raportorul REDESCHIDE o sesizare rezolvată; intervenția se dezleagă;
--      același motiv a doua oară e refuzat                             [POZITIVĂ]
-- (25) tehnicianul nu poate înregistra intervenția cât sesizarea nu e „în lucru”
-- (26) raportorul NU vede rândul echipamentului și nici intervențiile cu
--      costuri; tehnicianul le vede pe ale sesizării lui
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org      uuid := gen_random_uuid();
  v_u_adm    uuid := gen_random_uuid();  -- org_admin cu fișă
  v_u_adm2   uuid := gen_random_uuid();  -- org_admin FĂRĂ fișă (patronul)
  v_u_mgr    uuid := gen_random_uuid();  -- manager (șeful raportorului)
  v_u_hr     uuid := gen_random_uuid();
  v_u_teh    uuid := gen_random_uuid();  -- employee: tehnicianul
  v_u_rap    uuid := gen_random_uuid();  -- employee: raportorul
  v_u_col    uuid := gen_random_uuid();  -- employee: un coleg străin de sesizare
  v_e_adm    uuid := gen_random_uuid();
  v_e_mgr    uuid := gen_random_uuid();
  v_e_teh    uuid := gen_random_uuid();
  v_e_rap    uuid := gen_random_uuid();
  v_e_col    uuid := gen_random_uuid();
  v_echip    uuid := gen_random_uuid();
  v_echip2   uuid := gen_random_uuid();  -- alt echipament, pentru (19)
  v_s1       uuid;
  v_s2       uuid;
  v_s3       uuid;
  v_int      uuid;
  v_com      uuid;
  v_numar    text;
  v_text     text;
  v_n        integer;
  v_bool     boolean;
  v_ts       timestamptz;
  v_esecuri  int := 0;
begin
  raise notice '';
  raise notice '  PROBA „SESIZAREA PE ROLURI" (0181)';
  raise notice '  ─────────────────────────────────────────────────────────';

  -- ── fixture ───────────────────────────────────────────────────────────────
  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-sez-' || v_sufix, 'Proba Sesizări SRL',
     'RO' || (87000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select v_org, f.feature_key, true, now() from public.features f;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_adm,  'sez-adm-'  || v_sufix || '@proba.test', now()),
    (v_u_adm2, 'sez-adm2-' || v_sufix || '@proba.test', now()),
    (v_u_mgr,  'sez-mgr-'  || v_sufix || '@proba.test', now()),
    (v_u_hr,   'sez-hr-'   || v_sufix || '@proba.test', now()),
    (v_u_teh,  'sez-teh-'  || v_sufix || '@proba.test', now()),
    (v_u_rap,  'sez-rap-'  || v_sufix || '@proba.test', now()),
    (v_u_col,  'sez-col-'  || v_sufix || '@proba.test', now());
  -- Fișele ÎNAINTEA membrilor: `trg_zorganization_members_fisa_patron` (0083)
  -- creează singur o fișă pentru orice `org_admin` fără una, iar a doua
  -- inserare ar fi căzut pe `employees_org_user_primary_uniq`.
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_adm, v_org, 'SZ-A', 'Adrian', 'Admin',     app.azi_local() - 900, 'activ', v_u_adm, null),
    (v_e_mgr, v_org, 'SZ-M', 'Mihai',  'Manager',   app.azi_local() - 800, 'activ', v_u_mgr, null),
    (v_e_teh, v_org, 'SZ-T', 'Tudor',  'Tehnician', app.azi_local() - 700, 'activ', v_u_teh, v_e_mgr),
    (v_e_rap, v_org, 'SZ-R', 'Radu',   'Raportor',  app.azi_local() - 600, 'activ', v_u_rap, v_e_mgr),
    (v_e_col, v_org, 'SZ-C', 'Carmen', 'Coleg',     app.azi_local() - 500, 'activ', v_u_col, null);

  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_adm,  'org_admin'),
    (v_org, v_u_adm2, 'org_admin'),
    (v_org, v_u_mgr,  'manager'),
    (v_org, v_u_hr,   'hr'),
    (v_org, v_u_teh,  'employee'),
    (v_org, v_u_rap,  'employee'),
    (v_org, v_u_col,  'employee');

  -- „Patronul fără fișă": 0083 i-a făcut una automat; o scoatem logic, ca să
  -- rămână exact cazul pe care îl verificăm la (15) — `app.fisa_mea` = null.
  update public.employees set deleted_at = now()
   where organization_id = v_org and user_id = v_u_adm2;

  insert into public.equipment (id, organization_id, cod, denumire)
  values (v_echip,  v_org, 'PRS-' || v_sufix, 'Presă hidraulică'),
         (v_echip2, v_org, 'CMP-' || v_sufix, 'Compresor');

  -- ═══ (1) Raportorul depune sesizarea [POZITIVĂ] ══════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_rap::text, true);
  set local role authenticated;
  begin
    insert into public.fault_reports (organization_id, equipment_id, raportat_de_employee_id, descriere, urgenta)
    values (v_org, v_echip, v_e_rap, 'Presa pierde ulei pe la cilindru.', 'ridicata')
    returning id, numar into v_s1, v_numar;
    reset role;
    if v_numar ~ ('^SZ-' || extract(year from app.azi_local())::text || '-0001$') then
      raise notice '  ✓ (1) raportorul depune sesizarea; numărul e %', v_numar;
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (1) numărul sesizării e „%”, nu SZ-AAAA-0001', v_numar;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) raportorul nu a putut depune sesizarea: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (2) Raportorul NU poate atribui ═════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_rap::text, true);
  set local role authenticated;
  begin
    update public.fault_reports set atribuit_employee_id = v_e_rap where id = v_s1;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) raportorul și-a atribuit singur sesizarea';
  exception when raise_exception then
    reset role;
    if sqlerrm like '%Nu aveți dreptul de a modifica acest câmp%' then
      raise notice '  ✓ (2) raportorul nu poate atribui (câmp străin, P0001)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (2) refuz cu alt mesaj: %', sqlerrm;
    end if;
  end;

  -- ═══ (3) Raportorul își editează descrierea cât e „nouă” [POZITIVĂ] ══════
  perform set_config('request.jwt.claim.sub', v_u_rap::text, true);
  set local role authenticated;
  begin
    update public.fault_reports set descriere = 'Presa pierde ulei pe la cilindrul din stânga.' where id = v_s1;
    get diagnostics v_n = row_count;
    reset role;
    if v_n = 1 then
      raise notice '  ✓ (3) raportorul își editează descrierea cât sesizarea e nouă';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (3) editarea raportorului a atins % rânduri', v_n;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) editarea raportorului a fost refuzată: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (4) Tehnicianul NU vede sesizarea înainte de atribuire ══════════════
  perform set_config('request.jwt.claim.sub', v_u_teh::text, true);
  set local role authenticated;
  select count(*) into v_n from public.fault_reports where id = v_s1;
  reset role;
  if v_n = 0 then
    raise notice '  ✓ (4) tehnicianul nu vede o sesizare care nu i-a fost atribuită';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) tehnicianul vede sesizarea altcuiva înainte de atribuire';
  end if;

  -- ═══ (5) Gestionarul atribuie [POZITIVĂ] ═════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  begin
    update public.fault_reports set atribuit_employee_id = v_e_teh, status = 'in_analiza' where id = v_s1;
    get diagnostics v_n = row_count;
    reset role;
    select atribuit_la into v_ts from public.fault_reports where id = v_s1;
    if v_n = 1 and v_ts is not null
       and exists (select 1 from public.fault_report_history h where h.fault_report_id = v_s1 and h.camp = 'atribuit_employee_id')
       and exists (select 1 from public.notifications n where n.user_id = v_u_teh and n.entity_id = v_s1) then
      raise notice '  ✓ (5) gestionarul atribuie: atribuit_la, rând de istoric și notificare către tehnician';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (5) atribuirea nu a lăsat urmele așteptate (rânduri=%, atribuit_la=%)', v_n, v_ts;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) atribuirea a fost refuzată: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (6) Tehnicianul o vede și o trece în lucru [POZITIVĂ] ═══════════════
  perform set_config('request.jwt.claim.sub', v_u_teh::text, true);
  set local role authenticated;
  begin
    select count(*) into v_n from public.fault_reports where id = v_s1;
    if v_n <> 1 then raise exception 'tehnicianul nu vede sesizarea atribuită'; end if;
    -- Vede și echipamentul (ramura din equipment_select).
    select count(*) into v_n from public.equipment where id = v_echip;
    if v_n <> 1 then raise exception 'tehnicianul nu vede echipamentul sesizării lui'; end if;
    update public.fault_reports set status = 'in_lucru' where id = v_s1;
    get diagnostics v_n = row_count;
    reset role;
    if v_n = 1 then
      raise notice '  ✓ (6) tehnicianul vede sesizarea și echipamentul ei și o trece în lucru';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (6) trecerea în lucru a atins % rânduri', v_n;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) tehnicianul a fost refuzat: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (7) Tehnicianul NU poate schimba urgența ════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_teh::text, true);
  set local role authenticated;
  begin
    update public.fault_reports set urgenta = 'critica' where id = v_s1;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) tehnicianul a schimbat urgența';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (7) tehnicianul nu poate schimba urgența (P0001)';
  end;

  -- ═══ (8) Tehnicianul înregistrează intervenția și rezolvă [POZITIVĂ] ═════
  perform set_config('request.jwt.claim.sub', v_u_teh::text, true);
  set local role authenticated;
  begin
    insert into public.maintenance_interventions
      (organization_id, equipment_id, fault_report_id, data, descriere, executant_employee_id, cost_piese)
    values (v_org, v_echip, v_s1, app.azi_local(), 'Înlocuit garnitura cilindrului.', v_e_teh, 120)
    returning id into v_int;
    update public.fault_reports set status = 'rezolvat', intervention_id = v_int where id = v_s1;
    get diagnostics v_n = row_count;
    reset role;
    select rezolvat_la into v_ts from public.fault_reports where id = v_s1;
    if v_n = 1 and v_ts is not null then
      raise notice '  ✓ (8) tehnicianul înregistrează intervenția pe sesizarea lui și o marchează rezolvată';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (8) rezolvarea n-a prins (rânduri=%, rezolvat_la=%)', v_n, v_ts;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) tehnicianul a fost refuzat: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (9) Raportorul confirmă; terminală ═══════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_rap::text, true);
  set local role authenticated;
  begin
    update public.fault_reports set status = 'inchis' where id = v_s1;
    get diagnostics v_n = row_count;
    if v_n <> 1 then raise exception 'confirmarea a atins % rânduri', v_n; end if;
    begin
      update public.fault_reports set status = 'in_lucru', motiv_redeschidere = 'Totuși curge.' where id = v_s1;
      reset role;
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (9) sesizarea închisă s-a redeschis';
    exception when raise_exception then
      reset role;
      raise notice '  ✓ (9) raportorul confirmă („închis”); din închis nu se mai iese';
    end;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) confirmarea raportorului a fost refuzată: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (10) Oprirea din jurnal și respingerea ══════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_rap::text, true);
  set local role authenticated;
  insert into public.fault_reports (organization_id, equipment_id, raportat_de_employee_id, descriere, opreste_functionarea)
  values (v_org, v_echip, v_e_rap, 'Presa nu mai pornește deloc.', true)
  returning id into v_s2;
  reset role;
  select count(*) into v_n from public.equipment_opriri where fault_report_id = v_s2 and sfarsit is null and deleted_at is null;
  if v_n <> 1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10) sesizarea cu oprire n-a deschis o oprire în jurnal (% rânduri)', v_n;
  else
    perform set_config('request.jwt.claim.sub', v_u_col::text, true);
    set local role authenticated;
    select count(*) into v_n from public.fault_reports where id = v_s2;
    reset role;
    if v_n <> 0 then
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (10) colegul străin vede sesizarea altcuiva';
    else
      perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
      set local role authenticated;
      update public.fault_reports
         set status = 'respins', motiv_respingere = 'Nu e defecțiune: lipsea curentul în hală.',
             motiv_respingere_tip = 'nu_tine_de_mentenanta'
       where id = v_s2;
      reset role;
      select count(*) into v_n from public.equipment_opriri where fault_report_id = v_s2 and sfarsit is null and deleted_at is null;
      select h.motiv into v_text from public.fault_report_history h where h.fault_report_id = v_s2 and h.valoare_noua = 'respins';
      if v_n = 0 and v_text like '%lipsea curentul%' then
        raise notice '  ✓ (10) oprirea se deschide la raportare și se închide la respingere; motivul e în istoric';
      else
        v_esecuri := v_esecuri + 1;
        raise warning '  ✗ (10) după respingere: opriri deschise=%, motiv în istoric=%', v_n, v_text;
      end if;
    end if;
  end if;

  -- ═══ (11) Comentarii și note interne ═════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_rap::text, true);
  set local role authenticated;
  begin
    insert into public.fault_report_comments (organization_id, fault_report_id, autor_employee_id, continut)
    values (v_org, v_s1, v_e_rap, 'Mulțumesc, merge iar.');
    reset role;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (11) raportorul nu poate comenta pe sesizarea lui: % (%)', sqlerrm, sqlstate;
  end;
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  insert into public.fault_report_comments (organization_id, fault_report_id, autor_employee_id, continut, intern)
  values (v_org, v_s1, v_e_adm, 'Garnitura era de la lotul defect; verificăm și presa 2.', true);
  reset role;
  perform set_config('request.jwt.claim.sub', v_u_rap::text, true);
  set local role authenticated;
  select count(*) into v_n from public.fault_report_comments where fault_report_id = v_s1 and intern;
  begin
    insert into public.fault_report_comments (organization_id, fault_report_id, autor_employee_id, continut, intern)
    values (v_org, v_s1, v_e_rap, 'Încerc o notă internă.', true);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (11) raportorul a putut scrie o notă internă';
  exception when insufficient_privilege then
    reset role;
    if v_n = 0 then
      raise notice '  ✓ (11) raportorul comentează; nota internă nu i se arată și nu o poate scrie';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (11) raportorul vede % note interne', v_n;
    end if;
  end;

  -- ═══ (12) Atașamente ═════════════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_rap::text, true);
  set local role authenticated;
  begin
    insert into public.maintenance_attachments (organization_id, entity_type, entity_id, storage_path, denumire, tip, mime, marime_bytes, created_by)
    values (v_org, 'fault_report', v_s1, v_org::text || '/fault_report/' || v_s1::text || '/' || v_sufix || '.jpg', 'poza.jpg', 'foto', 'image/jpeg', 4096, v_u_rap);
    reset role;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (12) raportorul nu-și poate atașa poza: % (%)', sqlerrm, sqlstate;
  end;
  perform set_config('request.jwt.claim.sub', v_u_col::text, true);
  set local role authenticated;
  begin
    insert into public.maintenance_attachments (organization_id, entity_type, entity_id, storage_path, denumire, tip, mime, marime_bytes, created_by)
    values (v_org, 'fault_report', v_s1, v_org::text || '/fault_report/' || v_s1::text || '/' || v_sufix || '-x.jpg', 'x.jpg', 'foto', 'image/jpeg', 4096, v_u_col);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (12) colegul străin a atașat un fișier pe sesizarea altcuiva';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (12) raportorul își atașează poza; colegul străin e refuzat';
  end;

  -- ═══ (13) Managerul vede echipa, dar nu triază ═══════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  select count(*) into v_n from public.fault_reports where id in (v_s1, v_s2);
  update public.fault_reports set status = 'in_analiza' where id = v_s2;
  get diagnostics v_bool = row_count;  -- 0 rânduri → false
  reset role;
  if v_n = 2 and not v_bool then
    raise notice '  ✓ (13) managerul vede sesizările echipei, dar UPDATE-ul lui atinge zero rânduri';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (13) managerul: vede % sesizări, a modificat=%', v_n, v_bool;
  end if;

  -- ═══ (14) hr nu vede nimic ═══════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  select count(*) into v_n from public.fault_reports where organization_id = v_org;
  reset role;
  if v_n = 0 then
    raise notice '  ✓ (14) hr nu vede nicio sesizare';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (14) hr vede % sesizări', v_n;
  end if;

  -- ═══ (15) Administratorul fără fișă sesizează [POZITIVĂ] ═════════════════
  perform set_config('request.jwt.claim.sub', v_u_adm2::text, true);
  set local role authenticated;
  begin
    insert into public.fault_reports (organization_id, equipment_id, raportat_de_employee_id, descriere)
    values (v_org, v_echip, null, 'Zgomot la pornire, observat de patron.')
    returning id into v_s3;
    reset role;
    select raportat_de_user_id into v_text from public.fault_reports where id = v_s3;
    if v_text = v_u_adm2::text then
      raise notice '  ✓ (15) administratorul fără fișă sesizează; raportorul e păstrat ca utilizator';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (15) raportat_de_user_id = %, așteptat %', v_text, v_u_adm2;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (15) administratorul fără fișă a fost refuzat: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (16) Închiderea automată ════════════════════════════════════════════
  -- Sub superuser (context de serviciu): atribuire + intervenție + rezolvat,
  -- apoi `rezolvat_la` împins în trecut, exact ce ar găsi jobul.
  update public.fault_reports set atribuit_employee_id = v_e_teh, status = 'in_lucru' where id = v_s3;
  insert into public.maintenance_interventions (organization_id, equipment_id, fault_report_id, data, descriere)
  values (v_org, v_echip, v_s3, app.azi_local(), 'Strâns șuruburile.') returning id into v_int;
  update public.fault_reports set status = 'rezolvat', intervention_id = v_int where id = v_s3;
  update public.fault_reports set rezolvat_la = now() - interval '10 days' where id = v_s3;
  select internal.sesizari_inchide_rezolvate(v_org) into v_n;
  select status::text into v_text from public.fault_reports where id = v_s3;
  if v_n >= 1 and v_text = 'inchis' then
    raise notice '  ✓ (16) închiderea automată mută „rezolvat” vechi în „închis”';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (16) închiderea automată: % rânduri, status=%', v_n, v_text;
  end if;

  -- ═══ (17) Setările ═══════════════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  begin
    insert into public.maintenance_settings (organization_id, responsabili, inchidere_automata_zile)
    values (v_org, array[v_e_adm], 7);
    reset role;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (17) administratorul nu poate scrie setările: % (%)', sqlerrm, sqlstate;
  end;
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    update public.maintenance_settings set inchidere_automata_zile = 30 where organization_id = v_org;
    get diagnostics v_n = row_count;
    reset role;
    if v_n = 0 then
      raise notice '  ✓ (17) administratorul scrie setările; managerul atinge zero rânduri';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (17) managerul a modificat setările';
    end if;
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (17) administratorul scrie setările; managerul e refuzat';
  end;

  -- ═══ (18) Raportorul nu șterge logic ═════════════════════════════════════
  -- Politica de UPDATE îl lasă pe rând; garda refuză ramura de ștergere
  -- oricui n-are `update` ≥ team. Fără asta, ramura era „fail-open".
  perform set_config('request.jwt.claim.sub', v_u_rap::text, true);
  set local role authenticated;
  begin
    update public.fault_reports set deleted_at = now() where id = v_s2;
    get diagnostics v_n = row_count;
    reset role;
    if v_n = 0 then
      raise notice '  ✓ (18) raportorul nu poate șterge logic sesizarea (zero rânduri)';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (18) raportorul a șters logic sesizarea lui';
    end if;
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (18) raportorul nu poate șterge logic sesizarea (P0001)';
  end;

  -- ═══ (19) Intervenția tehnicianului stă pe echipamentul sesizării ════════
  perform set_config('request.jwt.claim.sub', v_u_teh::text, true);
  set local role authenticated;
  begin
    insert into public.maintenance_interventions (organization_id, equipment_id, fault_report_id, data, descriere)
    values (v_org, v_echip2, v_s1, app.azi_local(), 'Pe alt utilaj.');
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (19) tehnicianul a înregistrat intervenția pe alt echipament';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (19) tehnicianul nu poate înregistra intervenția pe alt echipament (42501)';
  end;
  -- Sub superuser: o intervenție a compresorului nu poate „rezolva" o sesizare a presei.
  insert into public.fault_reports (organization_id, equipment_id, raportat_de_employee_id, descriere, atribuit_employee_id)
  values (v_org, v_echip, v_e_rap, 'Scurgere la furtunul principal.', v_e_teh)
  returning id into v_s3;
  update public.fault_reports set status = 'in_lucru' where id = v_s3;
  insert into public.maintenance_interventions (organization_id, equipment_id, data, descriere)
  values (v_org, v_echip2, app.azi_local(), 'Schimbat filtrul compresorului.') returning id into v_int;
  begin
    update public.fault_reports set status = 'rezolvat', intervention_id = v_int where id = v_s3;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (19) sesizarea s-a rezolvat cu intervenția altui echipament';
  exception when raise_exception then
    raise notice '  ✓ (19) „rezolvat” cu intervenția altui echipament e refuzat (P0001)';
  end;

  -- ═══ (20) Comentariul nu se mută și nu devine intern ═════════════════════
  perform set_config('request.jwt.claim.sub', v_u_rap::text, true);
  set local role authenticated;
  insert into public.fault_report_comments (organization_id, fault_report_id, autor_employee_id, continut)
  values (v_org, v_s3, v_e_rap, 'Furtunul picură și acum.') returning id into v_com;
  begin
    update public.fault_report_comments set intern = true where id = v_com;
    get diagnostics v_n = row_count;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (20) raportorul și-a făcut comentariul intern (% rânduri)', v_n;
  exception when raise_exception or insufficient_privilege then
    reset role;
    raise notice '  ✓ (20) comentariul nu devine „intern” după scriere (%)', sqlstate;
  end;
  set local role authenticated;
  begin
    update public.fault_report_comments set fault_report_id = v_s1 where id = v_com;
    get diagnostics v_n = row_count;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (20) raportorul și-a mutat comentariul pe altă sesizare (% rânduri)', v_n;
  exception when raise_exception or insufficient_privilege then
    reset role;
    raise notice '  ✓ (20) comentariul nu se mută pe altă sesizare (%)', sqlstate;
  end;
  set local role authenticated;
  begin
    update public.fault_report_comments set continut = 'Furtunul picură și acum, mai tare.' where id = v_com;
    get diagnostics v_n = row_count;
    reset role;
    if v_n = 1 then
      raise notice '  ✓ (20) autorul își corectează textul comentariului';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (20) autorul nu-și poate corecta textul (% rânduri)', v_n;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (20) corectarea textului a fost refuzată: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (21) Coloanele scrise de triggere nu se falsifică ═══════════════════
  perform set_config('request.jwt.claim.sub', v_u_teh::text, true);
  set local role authenticated;
  begin
    update public.fault_reports
       set status = 'in_asteptare', atribuit_la = '2019-01-01 00:00+00', redeschisa_de_ori = 7
     where id = v_s3;
    get diagnostics v_n = row_count;
    reset role;
    select atribuit_la into v_ts from public.fault_reports where id = v_s3;
    if v_n = 1 and v_ts > '2020-01-01'::timestamptz then
      raise notice '  ✓ (21) tehnicianul schimbă starea, dar `atribuit_la` rămâne cel real';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (21) atribuit_la = %, rânduri = %', v_ts, v_n;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (21) tehnicianul a fost refuzat: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (22) Coloanele de sistem la INSERT ══════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_col::text, true);
  set local role authenticated;
  begin
    insert into public.fault_reports
      (organization_id, equipment_id, raportat_de_employee_id, descriere, numar, raportat_la, redeschisa_de_ori)
    values (v_org, v_echip2, v_e_col, 'Compresorul pierde presiune.', 'SZ-2026-0001', '2019-01-01 00:00+00', 9)
    returning id into v_s3;
    reset role;
    select numar, raportat_la, redeschisa_de_ori into v_numar, v_ts, v_n from public.fault_reports where id = v_s3;
    if v_numar <> 'SZ-2026-0001' and v_numar ~ '^SZ-[0-9]{4}-[0-9]{4,}$'
       and v_ts > now() - interval '1 minute' and v_n = 0 then
      raise notice '  ✓ (22) numărul, raportat_la și contorul trimise de client sunt ignorate (numar=%)', v_numar;
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (22) numar=%, raportat_la=%, redeschisa_de_ori=%', v_numar, v_ts, v_n;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (22) inserarea colegului a fost refuzată: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (23) Tehnicianul închide oprirea, nu o rescrie ══════════════════════
  -- Sub superuser: o sesizare blocantă atribuită tehnicianului, deci cu oprire deschisă.
  insert into public.fault_reports (organization_id, equipment_id, raportat_de_employee_id, descriere, opreste_functionarea, atribuit_employee_id)
  values (v_org, v_echip, v_e_rap, 'Presa s-a oprit de tot.', true, v_e_teh)
  returning id into v_s3;
  perform set_config('request.jwt.claim.sub', v_u_teh::text, true);
  set local role authenticated;
  begin
    update public.equipment_opriri set inceput = now() - interval '30 days'
     where fault_report_id = v_s3 and deleted_at is null;
    get diagnostics v_n = row_count;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (23) tehnicianul a mutat începutul opririi (% rânduri)', v_n;
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (23) tehnicianul nu poate rescrie oprirea (P0001)';
  end;
  set local role authenticated;
  begin
    update public.equipment_opriri set sfarsit = now()
     where fault_report_id = v_s3 and deleted_at is null and sfarsit is null;
    get diagnostics v_n = row_count;
    reset role;
    if v_n = 1 then
      raise notice '  ✓ (23) tehnicianul închide oprirea sesizării lui';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (23) închiderea opririi a atins % rânduri', v_n;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (23) închiderea opririi a fost refuzată: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (24) Raportorul redeschide [POZITIVĂ] ══════════════════════════════
  -- Sub superuser: v_s3 (rap, atribuită teh, oprire închisă la 23) → în lucru → rezolvată.
  update public.fault_reports set status = 'in_lucru' where id = v_s3;
  insert into public.maintenance_interventions (organization_id, equipment_id, fault_report_id, data, descriere)
  values (v_org, v_echip, v_s3, app.azi_local(), 'Resetat releul termic.') returning id into v_int;
  update public.fault_reports set status = 'rezolvat', intervention_id = v_int where id = v_s3;
  perform set_config('request.jwt.claim.sub', v_u_rap::text, true);
  set local role authenticated;
  begin
    update public.fault_reports set status = 'in_lucru', motiv_redeschidere = 'S-a oprit iar după o oră.' where id = v_s3;
    get diagnostics v_n = row_count;
    reset role;
    select intervention_id into v_int from public.fault_reports where id = v_s3;
    if v_n = 1 and v_int is null then
      raise notice '  ✓ (24) raportorul redeschide; intervenția se dezleagă de sesizare';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (24) redeschiderea: rânduri=%, intervention_id=%', v_n, v_int;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (24) raportorul a fost refuzat la redeschidere: % (%)', sqlerrm, sqlstate;
  end;
  -- A doua redeschidere cu ACELAȘI motiv rămas pe rând e refuzată.
  insert into public.maintenance_interventions (organization_id, equipment_id, fault_report_id, data, descriere)
  values (v_org, v_echip, v_s3, app.azi_local(), 'Schimbat releul.') returning id into v_int;
  update public.fault_reports set status = 'rezolvat', intervention_id = v_int where id = v_s3;
  set local role authenticated;
  begin
    update public.fault_reports set status = 'in_lucru' where id = v_s3;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (24) redeschiderea fără motiv nou a trecut';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (24) a doua redeschidere cere motiv NOU (P0001)';
  end;

  -- ═══ (25) Intervenția tehnicianului doar „în lucru” ══════════════════════
  -- v_s3 e „rezolvat” acum; tehnicianul nu mai poate adăuga intervenții pe ea.
  perform set_config('request.jwt.claim.sub', v_u_teh::text, true);
  set local role authenticated;
  begin
    insert into public.maintenance_interventions (organization_id, equipment_id, fault_report_id, data, descriere)
    values (v_org, v_echip, v_s3, app.azi_local(), 'Încă una, după rezolvare.');
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (25) tehnicianul a înregistrat intervenție pe o sesizare care nu e în lucru';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (25) intervenția tehnicianului cere sesizarea „în lucru” (42501)';
  end;

  -- ═══ (26) Raportorul nu vede rândul echipamentului, nici costurile ═══════
  perform set_config('request.jwt.claim.sub', v_u_rap::text, true);
  set local role authenticated;
  select count(*) into v_n from public.equipment where id = v_echip;
  select exists (select 1 from public.maintenance_interventions where fault_report_id = v_s3) into v_bool;
  reset role;
  if v_n = 0 and not v_bool then
    perform set_config('request.jwt.claim.sub', v_u_teh::text, true);
    set local role authenticated;
    select count(*) into v_n from public.equipment where id = v_echip;
    reset role;
    if v_n = 1 then
      raise notice '  ✓ (26) raportorul nu vede echipamentul și intervențiile; tehnicianul vede echipamentul sesizării lui';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (26) tehnicianul nu vede echipamentul sesizării lui (% rânduri)', v_n;
    end if;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (26) raportorul vede % rânduri de echipament, intervenții: %', v_n, v_bool;
  end if;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'Proba sesizărilor pe roluri: % verificări picate.', v_esecuri;
  end if;
  raise notice '  Toate verificările au trecut.';
end $$;
