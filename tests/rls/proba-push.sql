-- tests/rls/proba-push.sql
--
-- Proba reală pentru push (0122). Verifică ÎNTÂI că merge ce trebuie să meargă.
--
-- (1) POZITIVĂ — un `employee` își poate înregistra jetonul
-- (2) NEGATIVĂ — nu vede jetonul altcuiva
-- (3) POZITIVĂ — un `manager` care scrie o notificare pentru `employee` umple coada
-- (4) POZITIVĂ — un actor NUL (ca joburile pg_cron) umple coada la fel
-- (5) NEGATIVĂ — preferința `push = false` oprește punerea în coadă
-- (6) NEGATIVĂ — `push_livrari` e închisă pentru `authenticated`
-- (7) NEGATIVĂ — proprietarul nu-și poate muta dispozitivul în altă organizație
-- (8) POZITIVĂ — proprietarul își poate retrage propriul jeton (soft-delete)
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
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org      uuid := gen_random_uuid();
  v_org2     uuid := gen_random_uuid();
  v_u_mgr    uuid := gen_random_uuid();
  v_u_ang    uuid := gen_random_uuid();
  v_u_alt    uuid := gen_random_uuid();
  v_disp     uuid;
  v_notif    uuid;
  v_vazute   int;
  v_in_coada int;
  v_esecuri  int := 0;
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
    (v_u_alt, 'alt-' || v_sufix || '@exemplu.ro');

  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_mgr, 'manager'),
    (v_org, v_u_ang, 'employee'),
    (v_org, v_u_alt, 'employee');

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

  -- ── (3) POZITIVĂ: managerul scrie o notificare, coada se umple ─────────
  -- Fără `set local role authenticated`: în producție notificarea de aprobare
  -- NU e un INSERT brut al clientului, ci efectul unui declanșator SECURITY
  -- DEFINER de pe tabela de business (vezi
  -- internal.leave_requests_notifica_aprobatorii din 0048), care ocolește RLS
  -- la fel ca internal.push_pune_in_coada mai jos. `notifications_insert`
  -- oricum refuză un INSERT direct pentru altcineva, în afara `announcements`
  -- — indiferent de rol — deci trecerea prin `authenticated` aici ar testa o
  -- politică străină de push, nu declanșatorul. Jetonul JWT rămâne setat, doar
  -- ca actorul de audit să fie managerul, nu un rol anonim.
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  insert into public.notifications (organization_id, user_id, kind, title, link)
  values (v_org, v_u_ang, 'approval', 'Concediu aprobat.', '/portal/concediile-mele')
  returning id into v_notif;

  select count(*) into v_in_coada from public.push_livrari where notification_id = v_notif;
  if v_in_coada = 1 then
    raise notice '  (3) OK      manager → coadă: 1 rând';
  else
    v_esecuri := v_esecuri + 1;
    raise notice '  (3) EȘEC    manager → coadă: % rânduri (așteptat 1) — declanșatorul nu e security definer?', v_in_coada;
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
  -- dispozitivul „aterizează" în firma străină, vizibil în auditul ei și
  -- abonat la notificările ei pentru același user_id.
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    update public.dispozitive_push set organization_id = v_org2 where id = v_disp;
    raise notice '  (7) EȘEC    dispozitivul A FOST mutat în altă organizație';
    v_esecuri := v_esecuri + 1;
  exception when others then
    raise notice '  (7) OK      mutarea în altă organizație e refuzată (%)', sqlstate;
  end;
  reset role;

  -- ── (8) POZITIVĂ: proprietarul își retrage propriul jeton ──────────────
  -- Soft-delete pe rândul propriu, exact mecanismul descris în §8 al
  -- migrării. Dacă politica SELECT ar cere `deleted_at is null`, Postgres ar
  -- respinge update-ul — rândul nou nu mai trece propria politică de citire.
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    update public.dispozitive_push set deleted_at = now() where id = v_disp;
    raise notice '  (8) OK      proprietarul își retrage propriul jeton';
  exception when others then
    v_esecuri := v_esecuri + 1;
    raise notice '  (8) EȘEC    retragerea propriului jeton e refuzată: %', sqlerrm;
  end;
  reset role;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA PUSH: % verificări căzute.', v_esecuri;
  end if;
  raise notice '  PROBA PUSH: 8/8.';
end;
$$;

rollback;
