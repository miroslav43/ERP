-- tests/rls/proba-push.sql
--
-- Proba reală pentru push (0122). Verifică ÎNTÂI că merge ce trebuie să meargă.
--
-- (1) POZITIVĂ — un `employee` își poate înregistra jetonul
-- (2) NEGATIVĂ — nu vede jetonul altcuiva
-- (3) POZITIVĂ — un `hr` care scrie o notificare pentru `employee`, sub
--     `authenticated` (nu superuser), umple coada — dovedește `security
--     definer` cu RLS-ul real de pe `notifications`, nu ocolit
-- (4) POZITIVĂ — un actor NUL (ca joburile pg_cron) umple coada la fel
-- (5) NEGATIVĂ — preferința `push = false` oprește punerea în coadă
-- (6) NEGATIVĂ — `push_livrari` e închisă pentru `authenticated`
-- (7) NEGATIVĂ — proprietarul nu-și poate muta dispozitivul în altă organizație
-- (8) POZITIVĂ — proprietarul își poate retrage propriul jeton (soft-delete)
-- (9) POZITIVĂ — angajat membru în DOUĂ firme, UN dispozitiv, primește coadă
--     din ambele
-- (10) NEGATIVĂ — nu poate înregistra un dispozitiv pentru alt `user_id`
-- (11) NEGATIVĂ — nu poate înregistra un dispozitiv într-o organizație în
--      care nu e membru
-- (12) REGRESIE — `internal.audit_forbidden_patterns()` NU prinde
--      `secretar_employee_id` (garda R9 nu s-a lărgit la loc — 0010b/0017)
-- (13) POZITIVĂ — jetonul nu ajunge în clar în `audit_logs` (exclus, nu
--      redactat — `internal.audit_campuri_excluse`)
-- (14) POZITIVĂ — `service_role` poate citi și scrie în ambele tabele (ruta
--      /api/push/livreaza chiar are ce privilegii presupune că are)
-- (15) NEGATIVĂ — `app.push_ia_din_coada` NU preia livrarea unui dispozitiv
--      retras (Runda 1, defectul C1: join fără `d.deleted_at is null`)
-- (16) POZITIVĂ — un rând `in_asteptare` normal e preluat și lăsat pe `in_lucru`
-- (17) POZITIVĂ — un `in_lucru` vechi de peste 10 minute e recuperat
-- (18) NEGATIVĂ — un `in_lucru` proaspăt NU e recuperat
-- (19) NEGATIVĂ — o notificare ștearsă nu e preluată
-- (20) POZITIVĂ — orfani vechi (dispozitiv/notificare retrase) NU blochează
--      capul cozii; un rând valid mai nou tot e preluat, chiar cu plafon mic
--      (Runda 2, defectul „blocaj de cap de coadă")
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   psql "$BANC_URL" -f tests/rls/proba-push.sql
\set ON_ERROR_STOP on
\pset pager off

-- `begin;` explicit: fără el, DO-ul rulează în propria tranzacție implicită,
-- care se închide (commit) înainte ca `rollback;` de la final să mai aibă ce
-- anula — exact tiparul din tests/rls/izolare.sql.
begin;

do $$
declare
  v_sufix     text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org       uuid := gen_random_uuid();
  v_org2      uuid := gen_random_uuid();
  v_u_mgr     uuid := gen_random_uuid();
  v_u_ang     uuid := gen_random_uuid();
  v_u_alt     uuid := gen_random_uuid();
  v_u_hr      uuid := gen_random_uuid();
  v_u_multi   uuid := gen_random_uuid();
  v_disp      uuid;
  v_disp_multi uuid;
  v_notif     uuid;
  v_notif2    uuid;
  v_vazute    int;
  v_in_coada  int;
  v_randuri   int;
  v_esecuri   int := 0;
  -- Steag pentru (3): evită numărarea DUBLĂ a aceluiași eșec — o dată în
  -- handler-ul de excepție al INSERT-ului, a doua oară la verificarea
  -- ulterioară a cozii (unde `v_notif` rămâne oricum null, ca simptom al
  -- ACELUIAȘI eșec, nu ca un al doilea defect distinct).
  v_ins_3_ok  boolean := true;
begin
  raise notice '';
  raise notice '  PROBA PUSH (0122)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-push-' || v_sufix, 'Proba Push SRL',
     'RO' || (89000000 + (random() * 900000)::int)::text),
    (v_org2, 'proba-push2-' || v_sufix, 'Proba Push Doi SRL',
     'RO' || (79000000 + (random() * 900000)::int)::text);

  insert into auth.users (id, email) values
    (v_u_mgr, 'mgr-' || v_sufix || '@exemplu.ro'),
    (v_u_ang, 'ang-' || v_sufix || '@exemplu.ro'),
    (v_u_alt, 'alt-' || v_sufix || '@exemplu.ro'),
    (v_u_hr, 'hr-' || v_sufix || '@exemplu.ro'),
    (v_u_multi, 'multi-' || v_sufix || '@exemplu.ro');

  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_mgr, 'manager'),
    (v_org, v_u_ang, 'employee'),
    (v_org, v_u_alt, 'employee'),
    (v_org, v_u_hr, 'hr'),
    -- (9): angajat cu contract în ambele firme, un singur telefon.
    (v_org, v_u_multi, 'employee'),
    (v_org2, v_u_multi, 'employee');

  -- ── (1) POZITIVĂ: angajatul își înregistrează jetonul ──────────────────
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    insert into public.dispozitive_push (organization_id, user_id, jeton, platforma)
    values (v_org, v_u_ang, 'ExponentPushToken[proba-ang-' || v_sufix || ']', 'android')
    returning id into v_disp;
    raise notice '  (1) OK      employee își înregistrează jetonul';
  exception when others then
    v_esecuri := v_esecuri + 1;
    raise notice '  (1) EȘEC    employee NU-și poate înregistra jetonul: %', sqlerrm;
  end;
  reset role;

  -- ── (2) NEGATIVĂ: alt angajat nu-l vede ────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_alt::text, true);
  set local role authenticated;
  select count(*) into v_vazute from public.dispozitive_push where user_id = v_u_ang;
  reset role;
  if v_vazute = 0 then
    raise notice '  (2) OK      alt employee nu vede jetonul (0 rânduri)';
  else
    v_esecuri := v_esecuri + 1;
    raise notice '  (2) EȘEC    alt employee VEDE % jetoane străine', v_vazute;
  end if;

  -- ── (3) POZITIVĂ: hr scrie o notificare pentru employee, coada se umple ──
  -- SUB `authenticated`, nu superuser: `postgres` (rolul de conectare al
  -- bancului) e superuser și ocolește RLS indiferent de FORCE, ceea ce ar
  -- face verificarea asta oarbă la exact ce testează — dacă declanșatorul de
  -- pe `dispozitive_push` chiar are nevoie de `security definer`. `hr` are
  -- `announcements:create=all` (0002_authz.sql:1202), singurul drept care
  -- lasă `notifications_insert` să admită un INSERT pentru altcineva
  -- (0002_authz.sql:1036-1044) — `kind`-ul notificării nu contează pentru
  -- acea politică, doar dreptul de „announcements”. `manager` NU are acest
  -- drept (doar `announcements:read`), de-aia nu poate juca rolul de aici.
  --
  -- FĂRĂ `returning id`: `notifications_select` cere `user_id = auth.uid()`,
  -- iar destinatarul e employee, nu hr — un RETURNING pe INSERT cere ca
  -- rândul nou să treacă și politica SELECT (aceeași mecanică descoperită la
  -- UPDATE, secțiunea 6), deci hr nu-și poate „vedea" propriul INSERT făcut
  -- pentru altcineva. E comportament real al `notifications`, neschimbat de
  -- 0122 — de aceea căutăm id-ul separat, ca proprietarul bazei (fără RLS),
  -- nu ca hr.
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  begin
    insert into public.notifications (organization_id, user_id, kind, title, link)
    values (v_org, v_u_ang, 'approval', 'Concediu aprobat.', '/portal/concediile-mele');
  exception when others then
    -- Incrementat explicit: fără el, verificarea depinde de coincidența că
    -- `v_notif` rămâne null mai jos și declanșează eșecul ACOLO, nu aici — o
    -- invariantă falsă, nu una garantată. `v_ins_3_ok` oprește verificarea de
    -- mai jos să numere A DOUA OARĂ același eșec.
    v_ins_3_ok := false;
    v_esecuri := v_esecuri + 1;
    raise notice '  (3) EȘEC    hr nu a putut insera notificarea pentru employee: %', sqlerrm;
  end;
  reset role;

  select id into v_notif from public.notifications
   where organization_id = v_org and user_id = v_u_ang and kind = 'approval'
   order by created_at desc limit 1;

  if v_notif is not null then
    select count(*) into v_in_coada from public.push_livrari where notification_id = v_notif;
    if v_in_coada = 1 then
      raise notice '  (3) OK      hr (sub authenticated) → coadă: 1 rând';
    else
      v_esecuri := v_esecuri + 1;
      raise notice '  (3) EȘEC    hr → coadă: % rânduri (așteptat 1) — declanșatorul nu e security definer?', v_in_coada;
    end if;
  elsif v_ins_3_ok then
    -- INSERT-ul a reușit (v_ins_3_ok încă `true`), dar `v_notif` nu s-a găsit
    -- — un eșec DISTINCT de cel din handler-ul de mai sus, deci se numără.
    v_esecuri := v_esecuri + 1;
    raise notice '  (3) EȘEC    notificarea inserată de hr nu a fost găsită la recitire';
  end if;

  -- ── (4) POZITIVĂ: actor nul, ca joburile pg_cron ───────────────────────
  perform set_config('request.jwt.claim.sub', '', true);
  insert into public.notifications (organization_id, user_id, kind, title)
  values (v_org, v_u_ang, 'reminder', 'Nu ai pontat ziua de ieri.')
  returning id into v_notif;
  select count(*) into v_in_coada from public.push_livrari where notification_id = v_notif;
  if v_in_coada = 1 then
    raise notice '  (4) OK      actor nul → coadă: 1 rând';
  else
    v_esecuri := v_esecuri + 1;
    raise notice '  (4) EȘEC    actor nul → coadă: % rânduri (așteptat 1)', v_in_coada;
  end if;

  -- ── (5) NEGATIVĂ: preferința oprită taie punerea în coadă ──────────────
  insert into public.notification_preferences (organization_id, user_id, kind, push)
  values (v_org, v_u_ang, 'announcement', false);
  insert into public.notifications (organization_id, user_id, kind, title)
  values (v_org, v_u_ang, 'announcement', 'Anunț de probă.')
  returning id into v_notif;
  select count(*) into v_in_coada from public.push_livrari where notification_id = v_notif;
  if v_in_coada = 0 then
    raise notice '  (5) OK      preferință oprită → coadă goală';
  else
    v_esecuri := v_esecuri + 1;
    raise notice '  (5) EȘEC    preferință oprită, dar % rânduri în coadă', v_in_coada;
  end if;

  -- ── (6) NEGATIVĂ: coada e închisă pentru utilizatori ───────────────────
  -- `authenticated` nu are niciun GRANT pe `push_livrari` (secțiunea 7 a
  -- migrării) — o interdicție mai tare decât o politică RLS. Selectul nu
  -- întoarce 0 rânduri filtrate, ARUNCĂ `permission denied`; tratăm excepția ca
  -- proba cea mai tare de izolare, la fel cum face verificarea (c) din
  -- tests/rls/izolare.sql pentru tabelele fără niciun privilegiu.
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    select count(*) into v_vazute from public.push_livrari;
  exception when insufficient_privilege then
    v_vazute := 0;
  end;
  reset role;
  if v_vazute = 0 then
    raise notice '  (6) OK      push_livrari închisă pentru authenticated';
  else
    v_esecuri := v_esecuri + 1;
    raise notice '  (6) EȘEC    authenticated vede % rânduri din coadă', v_vazute;
  end if;

  -- ── (7) NEGATIVĂ: nu-și poate muta dispozitivul în altă organizație ────
  -- `employee` nu e membru al `v_org2`. Fără `organization_id` în politica de
  -- UPDATE, rândul rămâne al lui (user_id neschimbat) și update-ul reușește —
  -- dispozitivul „aterizează" în firma străină, vizibil în auditul ei.
  -- (Declanșatorul de pe `notifications` potrivește oricum doar pe `user_id`
  -- — secțiunea 5 a migrării — deci mutarea rândului nu schimbă ce
  -- notificări ajung push; riscul e izolarea rândului și a auditului.)
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    update public.dispozitive_push set organization_id = v_org2 where id = v_disp;
    raise notice '  (7) EȘEC    dispozitivul A FOST mutat în altă organizație';
    v_esecuri := v_esecuri + 1;
  exception
    when insufficient_privilege then
      raise notice '  (7) OK      mutarea în altă organizație e refuzată (42501)';
    when others then
      v_esecuri := v_esecuri + 1;
      raise notice '  (7) EȘEC    refuzat, dar cu alt cod decât 42501 (%): %', sqlstate, sqlerrm;
  end;
  reset role;

  -- ── (8) POZITIVĂ: proprietarul își retrage propriul jeton ──────────────
  -- Soft-delete pe rândul propriu, exact mecanismul descris în §8 al
  -- migrării. Dacă politica SELECT ar cere `deleted_at is null`, Postgres ar
  -- respinge update-ul — rândul nou nu mai trece propria politică de citire.
  -- `get diagnostics` obligatoriu: un UPDATE respins de clauza USING
  -- afectează ZERO rânduri, FĂRĂ nicio eroare — un `exception when others`
  -- singur ar raporta OK și pentru un refuz tăcut (de exemplu dacă cineva
  -- readuce `deleted_at is null` în USING-ul politicii de UPDATE).
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    update public.dispozitive_push set deleted_at = now() where id = v_disp;
    get diagnostics v_randuri = row_count;
    if v_randuri = 1 then
      raise notice '  (8) OK      proprietarul își retrage propriul jeton (1 rând)';
    else
      v_esecuri := v_esecuri + 1;
      raise notice '  (8) EȘEC    retragerea a afectat % rânduri (așteptat 1) — refuz tăcut', v_randuri;
    end if;
  exception when others then
    v_esecuri := v_esecuri + 1;
    raise notice '  (8) EȘEC    retragerea propriului jeton e refuzată: %', sqlerrm;
  end;
  reset role;

  -- ── (9) POZITIVĂ: angajat în DOUĂ firme, UN dispozitiv, coadă din ambele ──
  -- Declanșatorul potrivește doar pe user_id (secțiunea 5 a migrării); dacă
  -- ar potrivi și pe organization_id, notificarea din a doua firmă n-ar găsi
  -- niciun dispozitiv, fiindcă acesta e înregistrat cu organization_id-ul
  -- primei. Un singur INSERT în dispozitive_push, două notificări din firme
  -- diferite, două rânduri de coadă.
  perform set_config('request.jwt.claim.sub', v_u_multi::text, true);
  set local role authenticated;
  begin
    insert into public.dispozitive_push (organization_id, user_id, jeton, platforma)
    values (v_org, v_u_multi, 'ExponentPushToken[proba-multi-' || v_sufix || ']', 'ios')
    returning id into v_disp_multi;
  exception when others then
    v_disp_multi := null;
    raise notice '  (9) EȘEC    angajatul multi-firmă nu-și poate înregistra dispozitivul: %', sqlerrm;
  end;
  reset role;

  if v_disp_multi is not null then
    perform set_config('request.jwt.claim.sub', '', true);
    insert into public.notifications (organization_id, user_id, kind, title)
    values (v_org, v_u_multi, 'reminder', 'Memento din firma 1.')
    returning id into v_notif;
    insert into public.notifications (organization_id, user_id, kind, title)
    values (v_org2, v_u_multi, 'reminder', 'Memento din firma 2.')
    returning id into v_notif2;

    select count(*) into v_in_coada
      from public.push_livrari where dispozitiv_id = v_disp_multi and notification_id = v_notif;
    select count(*) into v_randuri
      from public.push_livrari where dispozitiv_id = v_disp_multi and notification_id = v_notif2;
    if v_in_coada = 1 and v_randuri = 1 then
      raise notice '  (9) OK      un dispozitiv, coadă din ambele firme (1 + 1)';
    else
      v_esecuri := v_esecuri + 1;
      raise notice '  (9) EȘEC    firma 1: % rânduri, firma 2: % rânduri (așteptat 1 și 1)', v_in_coada, v_randuri;
    end if;
  else
    v_esecuri := v_esecuri + 1;
  end if;

  -- ── (10) NEGATIVĂ: nu poate înregistra un dispozitiv pentru alt user_id ──
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    insert into public.dispozitive_push (organization_id, user_id, jeton, platforma)
    values (v_org, v_u_alt, 'ExponentPushToken[proba-fals-' || v_sufix || ']', 'android');
    raise notice '  (10) EȘEC   a înregistrat un dispozitiv pentru alt user_id';
    v_esecuri := v_esecuri + 1;
  exception
    when insufficient_privilege then
      raise notice '  (10) OK     refuzat (42501) — nu poate înregistra pentru alt user_id';
    when others then
      v_esecuri := v_esecuri + 1;
      raise notice '  (10) EȘEC   refuzat, dar cu alt cod decât 42501 (%): %', sqlstate, sqlerrm;
  end;
  reset role;

  -- ── (11) NEGATIVĂ: nu poate înregistra într-o organizație unde nu e membru ─
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    insert into public.dispozitive_push (organization_id, user_id, jeton, platforma)
    values (v_org2, v_u_ang, 'ExponentPushToken[proba-strain-' || v_sufix || ']', 'android');
    raise notice '  (11) EȘEC   a înregistrat un dispozitiv într-o organizație străină';
    v_esecuri := v_esecuri + 1;
  exception
    when insufficient_privilege then
      raise notice '  (11) OK     refuzat (42501) — nu poate înregistra într-o organizație străină';
    when others then
      v_esecuri := v_esecuri + 1;
      raise notice '  (11) EȘEC   refuzat, dar cu alt cod decât 42501 (%): %', sqlstate, sqlerrm;
  end;
  reset role;

  -- ── (12) REGRESIE: garda R9 nu s-a lărgit la loc ────────────────────────
  -- Dacă vreo sesiune viitoare rescrie internal.audit_forbidden_patterns() ca
  -- să adauge un tipar pentru push, redeschide exact falsul-pozitiv pe care
  -- 0010b_fix_garda_audit.sql l-a închis pentru
  -- safety_committee_meetings.secretar_employee_id (registrul SSM obligatoriu
  -- ITM). Verificarea asta trebuie să rămână în probă, nu doar în 0010b.
  if 'secretar_employee_id' ilike any (internal.audit_forbidden_patterns()) then
    v_esecuri := v_esecuri + 1;
    raise notice '  (12) EȘEC   garda R9 prinde din nou „secretar_employee_id” — 0010b a fost anulată';
  else
    raise notice '  (12) OK     garda R9 tot nu prinde „secretar_employee_id”';
  end if;

  -- ── (13) POZITIVĂ: jetonul nu ajunge în clar în audit_logs ──────────────
  -- Mecanismul e internal.audit_campuri_excluse('dispozitive_push') =
  -- array['jeton'] (secțiunea 7), NU internal.audit_forbidden_patterns() —
  -- vezi nota din migrare. Efectul e diferit de un „[redactat]” pe valoare:
  -- cheia `jeton` dispare complet din `before`/`after`, iar
  -- `campuri_sensibile_atinse` listează că s-a atins (0017, tiparul de la
  -- leave_requests). Verificăm ambele fețe: jetonul brut nu apare NICĂIERI
  -- în `after`, și marcajul chiar spune că jetonul s-a schimbat.
  declare
    v_after jsonb;
  begin
    select after into v_after from public.audit_logs
     where entity_type = 'dispozitive_push' and entity_id = v_disp_multi
     order by created_at desc limit 1;

    if v_after is null then
      v_esecuri := v_esecuri + 1;
      raise notice '  (13) EȘEC   nu există rând de audit pentru dispozitivul multi-firmă';
    elsif v_after ? 'jeton' then
      v_esecuri := v_esecuri + 1;
      raise notice '  (13) EȘEC   cheia "jeton" e încă în audit_logs.after: %', v_after ->> 'jeton';
    elsif v_after::text like '%proba-multi-' || v_sufix || '%' then
      v_esecuri := v_esecuri + 1;
      raise notice '  (13) EȘEC   jetonul brut apare undeva în after: %', v_after::text;
    elsif not (v_after -> 'campuri_sensibile_atinse' ? 'jeton') then
      v_esecuri := v_esecuri + 1;
      raise notice '  (13) EȘEC   campuri_sensibile_atinse nu conține "jeton": %', v_after -> 'campuri_sensibile_atinse';
    else
      raise notice '  (13) OK     jetonul e exclus din audit (nu doar redactat), marcat în campuri_sensibile_atinse';
    end if;
  end;

  -- ── (14) POZITIVĂ: service_role poate citi și scrie ambele tabele ───────
  -- `bypassrls` (atributul rolului, 0001) ocolește POLITICILE, dar GRANT e
  -- un strat separat: fără el, ruta primește „permission denied", nu „0
  -- rânduri" — verificat empiric, ÎNAINTE de a adăuga granturile din
  -- secțiunea 7, fiecare SELECT și UPDATE de mai jos cădea cu 42501.
  -- `where false` la UPDATE: testăm PRIVILEGIUL, nu mutăm date — un rol fără
  -- GRANT primește 42501 chiar și pentru un UPDATE care n-ar atinge niciun
  -- rând.
  set local role service_role;
  begin
    perform count(*) from public.dispozitive_push;
    perform count(*) from public.push_livrari;
    update public.dispozitive_push set vazut_la = now() where false;
    update public.push_livrari set stare = 'in_lucru' where false;
    raise notice '  (14) OK     service_role citește și scrie ambele tabele';
  exception when others then
    v_esecuri := v_esecuri + 1;
    raise notice '  (14) EȘEC   service_role nu are privilegiile așteptate: % (%)', sqlerrm, sqlstate;
  end;
  reset role;

  -- ── (15)-(19): exercită DIRECT app.push_ia_din_coada / public.push_ia_din_coada ──
  -- Verificările (1)-(14) ating tabelele; niciuna cheamă funcția de preluare.
  -- Golul ăsta a lăsat nevăzută reparația C1 (join fără `d.deleted_at is
  -- null`, secțiunea 5b a migrării) — funcția n-a rulat NICIODATĂ înainte de
  -- acest bloc, nici `skip locked`, nici recuperarea la 10 minute, nici
  -- filtrul de dispozitiv/notificare retrase.
  declare
    v_disp_ret2     uuid;
    v_disp_activ    uuid;
    v_notif_a       uuid;
    v_notif_b       uuid;
    v_notif_c       uuid;
    v_notif_d       uuid;
    v_notif_stearsa uuid;
    v_livr_retras   uuid;
    v_livr_normal   uuid;
    v_livr_vechi    uuid;
    v_livr_proaspat uuid;
    v_livr_stearsa  uuid;
    v_ids           uuid[];
    v_stare         public.stare_livrare_push;
  begin
    -- Fixturi: un dispozitiv retras CU o livrare încă `in_asteptare` (C1) și
    -- un dispozitiv activ cu patru livrări, câte una pentru fiecare stare care
    -- contează la preluare.
    insert into public.dispozitive_push (organization_id, user_id, jeton, platforma)
    values (v_org, v_u_ang, 'ExponentPushToken[proba-preluare-ret-' || v_sufix || ']', 'android')
    returning id into v_disp_ret2;
    insert into public.dispozitive_push (organization_id, user_id, jeton, platforma)
    values (v_org, v_u_ang, 'ExponentPushToken[proba-preluare-act-' || v_sufix || ']', 'ios')
    returning id into v_disp_activ;

    insert into public.notifications (organization_id, user_id, kind, title)
    values (v_org, v_u_ang, 'reminder', 'Către dispozitiv retras.') returning id into v_notif_a;
    insert into public.notifications (organization_id, user_id, kind, title)
    values (v_org, v_u_ang, 'reminder', 'Livrare normală.') returning id into v_notif_b;
    insert into public.notifications (organization_id, user_id, kind, title)
    values (v_org, v_u_ang, 'reminder', 'in_lucru vechi, de recuperat.') returning id into v_notif_c;
    insert into public.notifications (organization_id, user_id, kind, title)
    values (v_org, v_u_ang, 'reminder', 'in_lucru proaspăt, NU se recuperează.') returning id into v_notif_d;
    insert into public.notifications (organization_id, user_id, kind, title)
    values (v_org, v_u_ang, 'reminder', 'Notificare ștearsă înainte de livrare.') returning id into v_notif_stearsa;

    select id into v_livr_retras   from public.push_livrari where dispozitiv_id = v_disp_ret2  and notification_id = v_notif_a;
    select id into v_livr_normal   from public.push_livrari where dispozitiv_id = v_disp_activ and notification_id = v_notif_b;
    select id into v_livr_vechi    from public.push_livrari where dispozitiv_id = v_disp_activ and notification_id = v_notif_c;
    select id into v_livr_proaspat from public.push_livrari where dispozitiv_id = v_disp_activ and notification_id = v_notif_d;
    select id into v_livr_stearsa  from public.push_livrari where dispozitiv_id = v_disp_activ and notification_id = v_notif_stearsa;

    -- Dispozitivul lui (15) e retras DUPĂ punerea în coadă — exact secvența
    -- scenariului C1: telefon predat mai departe, cu livrări deja în așteptare.
    update public.dispozitive_push set deleted_at = now() where id = v_disp_ret2;
    -- (17): un `in_lucru` vechi de 11 minute — peste pragul de 10 din funcție.
    update public.push_livrari set stare = 'in_lucru', updated_at = now() - interval '11 minutes'
     where id = v_livr_vechi;
    -- (18): un `in_lucru` proaspăt — NU trebuie recuperat.
    update public.push_livrari set stare = 'in_lucru', updated_at = now()
     where id = v_livr_proaspat;
    -- (19): notificarea e ștearsă după ce a umplut coada.
    update public.notifications set deleted_at = now() where id = v_notif_stearsa;

    set local role service_role;
    select coalesce(array_agg(id), '{}') into v_ids from public.push_ia_din_coada(1000);
    reset role;

    -- `v_livr_retras is null` verificat EXPLICIT: `null = any(v_ids)` dă
    -- `null`, care intră pe ramura ELSE (succes) — dacă fixtura n-ar fi
    -- existat, verificarea ar fi raportat „OK" fără să fi verificat nimic.
    -- (15) e chiar garda de regresie a C1, deci trebuie să nu poată trece în
    -- gol.
    if v_livr_retras is null then
      v_esecuri := v_esecuri + 1;
      raise notice '  (15) EȘEC   fixtura livrării pentru dispozitivul retras nu s-a creat';
    elsif v_livr_retras = any(v_ids) then
      v_esecuri := v_esecuri + 1;
      raise notice '  (15) EȘEC   preluarea a întors livrarea unui dispozitiv retras';
    else
      raise notice '  (15) OK     dispozitiv retras — livrarea lui nu e preluată';
    end if;

    if v_livr_normal = any(v_ids) then
      select stare into v_stare from public.push_livrari where id = v_livr_normal;
      if v_stare = 'in_lucru' then
        raise notice '  (16) OK     rând in_asteptare — preluat și lăsat pe in_lucru';
      else
        v_esecuri := v_esecuri + 1;
        raise notice '  (16) EȘEC   rândul a fost preluat dar starea e % (așteptat in_lucru)', v_stare;
      end if;
    else
      v_esecuri := v_esecuri + 1;
      raise notice '  (16) EȘEC   un rând in_asteptare normal NU a fost preluat';
    end if;

    if v_livr_vechi = any(v_ids) then
      raise notice '  (17) OK     in_lucru vechi de peste 10 minute — recuperat';
    else
      v_esecuri := v_esecuri + 1;
      raise notice '  (17) EȘEC   in_lucru vechi de peste 10 minute NU a fost recuperat';
    end if;

    -- Verificarea principală e suficientă (id-ul absent din `v_ids`): o a
    -- doua ramură care re-verifica `updated_at` a fost scoasă — `now()` e
    -- constant pe toată tranzacția, iar fixtura de mai sus scrie tot
    -- `updated_at = now()`, deci comparația cu `now() - interval '1 minute'`
    -- ar fi ieșit adevărată indiferent dacă funcția ar fi atins rândul sau
    -- nu — o ramură care nu poate cădea NICIODATĂ nu verifică nimic.
    if v_livr_proaspat = any(v_ids) then
      v_esecuri := v_esecuri + 1;
      raise notice '  (18) EȘEC   in_lucru proaspăt a fost recuperat (nu trebuia)';
    else
      raise notice '  (18) OK     in_lucru proaspăt nu e recuperat, rămâne neatins';
    end if;

    -- Aceeași gardă ca la (15): `null = any(v_ids)` ar trece tăcut pe OK.
    if v_livr_stearsa is null then
      v_esecuri := v_esecuri + 1;
      raise notice '  (19) EȘEC   fixtura livrării pentru notificarea ștearsă nu s-a creat';
    elsif v_livr_stearsa = any(v_ids) then
      v_esecuri := v_esecuri + 1;
      raise notice '  (19) EȘEC   preluarea a întors o livrare a unei notificări șterse';
    else
      raise notice '  (19) OK     notificare ștearsă — livrarea ei nu e preluată';
    end if;
  end;

  -- ── (20) POZITIVĂ: orfani vechi NU blochează capul cozii ────────────────
  -- Regresie pentru defectul găsit în Runda 2: `limit p_plafon` stătea în
  -- CTE, ÎNAINTE de filtrele pe dispozitiv/notificare retrase — orfanii,
  -- fiind cei mai vechi (`order by created_at`), umpleau plafonul la fiecare
  -- rulare și blocau COMPLET rândurile valide din spatele lor, fără nicio
  -- eroare. Trei orfani mai vechi + un rând valid mai nou, plafon mic (2) —
  -- dacă bug-ul ar reveni (filtrele mutate înapoi din CTE), rândul valid n-ar
  -- mai fi preluat.
  declare
    v_u_blocaj   uuid := gen_random_uuid();
    v_disp_o1    uuid;
    v_disp_o2    uuid;
    v_disp_o3    uuid;
    v_disp_valid uuid;
    v_notif_o1   uuid;
    v_notif_o2   uuid;
    v_notif_o3   uuid;
    v_notif_v    uuid;
    v_livr_valid uuid;
    v_ids20      uuid[];
  begin
    -- Utilizator DEDICAT, nu `v_u_ang`: până la acest punct, `v_u_ang` mai
    -- are cel puțin un dispozitiv ACTIV rămas din verificarea (16)
    -- (`v_disp_activ`) — orice notificare nouă pentru `v_u_ang` ar pune în
    -- coadă și pentru ACELA, contaminând numărătoarea candidaților valizi
    -- cu rânduri neintenționate. Cu un user nou, fără niciun dispozitiv la
    -- pornire, fiecare notificare de mai jos umple coada DOAR pentru
    -- dispozitivul creat chiar înainte de ea.
    insert into auth.users (id, email) values (v_u_blocaj, 'blocaj-' || v_sufix || '@exemplu.ro');
    insert into public.organization_members (organization_id, user_id, role)
    values (v_org, v_u_blocaj, 'employee');

    -- Fiecare orfan e un ciclu STRICT SERIALIZAT: dispozitiv → notificare
    -- (trigger-ul pune în coadă DOAR pentru dispozitivele active ale
    -- utilizatorului, iar la acest pas e singurul) → retragere. Trei
    -- dispozitive create dintr-o dată, ÎNAINTE de notificări, ar face ca
    -- fiecare notificare să umple coada pentru TOATE cele trei deodată —
    -- exact contaminarea de evitat mai sus, doar mutată în interiorul
    -- blocului.
    insert into public.dispozitive_push (organization_id, user_id, jeton, platforma) values
      (v_org, v_u_blocaj, 'ExponentPushToken[proba-blocaj-o1-' || v_sufix || ']', 'android')
      returning id into v_disp_o1;
    insert into public.notifications (organization_id, user_id, kind, title)
    values (v_org, v_u_blocaj, 'reminder', 'Orfan 1.') returning id into v_notif_o1;
    update public.dispozitive_push set deleted_at = now() where id = v_disp_o1;

    insert into public.dispozitive_push (organization_id, user_id, jeton, platforma) values
      (v_org, v_u_blocaj, 'ExponentPushToken[proba-blocaj-o2-' || v_sufix || ']', 'android')
      returning id into v_disp_o2;
    insert into public.notifications (organization_id, user_id, kind, title)
    values (v_org, v_u_blocaj, 'reminder', 'Orfan 2.') returning id into v_notif_o2;
    update public.dispozitive_push set deleted_at = now() where id = v_disp_o2;

    insert into public.dispozitive_push (organization_id, user_id, jeton, platforma) values
      (v_org, v_u_blocaj, 'ExponentPushToken[proba-blocaj-o3-' || v_sufix || ']', 'android')
      returning id into v_disp_o3;
    insert into public.notifications (organization_id, user_id, kind, title)
    values (v_org, v_u_blocaj, 'reminder', 'Orfan 3.') returning id into v_notif_o3;
    update public.dispozitive_push set deleted_at = now() where id = v_disp_o3;

    -- Backdatate explicit, nu doar create înaintea rândului valid: `now()`
    -- e ÎNGHEȚAT pe toată tranzacția (`current_timestamp`, nu
    -- `clock_timestamp()`), deci toate rândurile din acest fișier ar avea
    -- altfel EXACT același `created_at` — ordinea „cine-i mai vechi" nu s-ar
    -- putea baza pe simpla ordine de inserare fără o garanție explicită.
    update public.push_livrari set created_at = now() - interval '1 hour'
     where dispozitiv_id in (v_disp_o1, v_disp_o2, v_disp_o3);

    -- Rândul valid: singurul dispozitiv activ al lui `v_u_blocaj` în acest
    -- moment (cele trei orfane sunt deja retrase) — notificarea umple coada
    -- STRICT pentru el.
    insert into public.dispozitive_push (organization_id, user_id, jeton, platforma) values
      (v_org, v_u_blocaj, 'ExponentPushToken[proba-blocaj-valid-' || v_sufix || ']', 'android')
      returning id into v_disp_valid;
    insert into public.notifications (organization_id, user_id, kind, title)
    values (v_org, v_u_blocaj, 'reminder', 'Rândul valid, mai nou.') returning id into v_notif_v;

    select id into v_livr_valid from public.push_livrari
     where dispozitiv_id = v_disp_valid and notification_id = v_notif_v;

    set local role service_role;
    -- Plafon 2, cu 3 orfani mai vechi: sub bug-ul vechi, CTE-ul ar lua cei
    -- doi orfani cei mai vechi (limita), i-ar bloca, iar UPDATE-ul de mai jos
    -- i-ar elimina — rezultat gol, rândul valid neatins niciodată.
    select coalesce(array_agg(id), '{}') into v_ids20 from public.push_ia_din_coada(2);
    reset role;

    if v_livr_valid is null then
      v_esecuri := v_esecuri + 1;
      raise notice '  (20) EȘEC   fixtura rândului valid nu s-a creat';
    elsif v_livr_valid = any(v_ids20) then
      raise notice '  (20) OK     3 orfani vechi + plafon 2 — rândul valid tot e preluat (fără blocaj de cap de coadă)';
    else
      v_esecuri := v_esecuri + 1;
      raise notice '  (20) EȘEC   BLOCAJ DE CAP DE COADĂ — rândul valid NU a fost preluat cu plafon mic și orfani vechi';
    end if;
  end;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA PUSH: % verificări căzute.', v_esecuri;
  end if;
  raise notice '  PROBA PUSH: 20/20.';
end;
$$;

rollback;
