-- tests/rls/proba-registru.sql
--
-- POARTA POZITIVĂ a registrului de documente (0120): nu „managerul nu vede
-- registrul", ci „`hr` CHIAR poate deschide registrul firmei lui".
--
-- ── DE CE POARTA POZITIVĂ E PRIMA, ȘI NU O FORMALITATE ──────────────────────
-- În Faza 2 proiectul a fost comis ca livrat în timp ce un `org_admin` nu putea
-- insera un angajat: treceau typecheck, lint, testele, cele trei bariere SQL și
-- izolarea 11/11. Se verifica doar că nimeni nu vede ce n-are voie, niciodată
-- că cine are voie poate lucra.
--
-- Aici capcana e concretă și era la un pas: rolul `hr` NU are `compliance:read`
-- în seed. Dacă pagina ar fi fost păzită cu cheia aia — alegerea „firească",
-- fiindcă registrul e un instrument de conformitate — exact omul care emite
-- documentele ar fi deschis ecranul și ar fi văzut ZERO RÂNDURI, fără nicio
-- eroare, fără nimic în log. Verificarea (1) e singura care ar fi căzut atunci.
--
-- ── CE VERIFICĂ, PE RÂND ────────────────────────────────────────────────────
-- (1) `hr` vede registrul firmei lui                      ← poarta pozitivă
-- (2) `org_admin` vede registrul firmei lui
-- (3) `manager` nu vede nimic (n-are `registru:read`)
-- (4) `employee` nu vede nimic
-- (5) `hr` NU poate deschide/închide un exercițiu (n-are `registru:update`)
-- (6) `org_admin` POATE — a doua poartă pozitivă, pe cealaltă cheie
-- (7) `org_admin`-ul firmei A nu vede registrul firmei B  ← izolarea
-- (8) numărul de înregistrare NU se poate modifica, nici de `org_admin`
--     (OMFP 2634/2015 pct. 58 lit. d: „interzicându-se … eliminări sau
--     adăugări ulterioare")
-- (9) un an închis refuză înregistrarea (pct. 58 lit. h)
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   psql "$BANC_URL" -f tests/rls/proba-registru.sql
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix   text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org_a   uuid := gen_random_uuid();
  v_org_b   uuid := gen_random_uuid();
  v_u_hr    uuid := gen_random_uuid();
  v_u_admin uuid := gen_random_uuid();
  v_u_mgr   uuid := gen_random_uuid();
  v_u_ang   uuid := gen_random_uuid();
  v_vazute  int;
  v_numar   int;
  v_esecuri int := 0;
  v_a_mers  boolean;
begin
  raise notice '';
  raise notice '  PROBA REGISTRULUI DE DOCUMENTE (0120)';
  raise notice '  ─────────────────────────────────────────────────────────';

  -- ── Două firme, ca izolarea să aibă ce rupe dacă e ruptă. ──
  insert into public.organizations (id, slug, name, cui) values
    (v_org_a, 'proba-reg-a-' || v_sufix, 'Proba Registru A SRL',
     'RO' || (89000000 + (random() * 900000)::int)::text),
    (v_org_b, 'proba-reg-b-' || v_sufix, 'Proba Registru B SRL',
     'RO' || (89000000 + (random() * 900000)::int)::text);

  insert into public.organization_features (organization_id, feature_key, enabled) values
    (v_org_a, 'nucleu', true), (v_org_b, 'nucleu', true)
  on conflict (organization_id, feature_key) where deleted_at is null do nothing;

  insert into auth.users (id, email) values
    (v_u_hr,    'hr-'    || v_sufix || '@proba.test'),
    (v_u_admin, 'admin-' || v_sufix || '@proba.test'),
    (v_u_mgr,   'mgr-'   || v_sufix || '@proba.test'),
    (v_u_ang,   'ang-'   || v_sufix || '@proba.test');

  insert into public.organization_members (organization_id, user_id, role) values
    (v_org_a, v_u_hr,    'hr'),
    (v_org_a, v_u_admin, 'org_admin'),
    (v_org_a, v_u_mgr,   'manager'),
    (v_org_a, v_u_ang,   'employee');

  -- ── Câte o înregistrare în fiecare firmă. Se scriu ca `postgres`, adică pe
  -- drumul pe care le scrie triggerul în viața reală. ──
  perform internal.inregistreaza_document(
    v_org_a, 'iesire'::public.registru_sens, 'adeverinta',
    'Adeverință de vechime — proba A', 'proba', gen_random_uuid());
  perform internal.inregistreaza_document(
    v_org_b, 'iesire'::public.registru_sens, 'adeverinta',
    'Adeverință de vechime — proba B', 'proba', gen_random_uuid());

  -- ── (1) POARTA POZITIVĂ. Singura care ar fi căzut cu `compliance:read`. ──
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  select count(*) into v_vazute from public.registru_documente where organization_id = v_org_a;
  reset role;

  raise notice '  (1) `hr` vede registrul firmei lui ........ % rânduri (aștept 1)', v_vazute;
  if v_vazute <> 1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) HR-UL NU-ȘI VEDE REGISTRUL. Exact omul care emite documentele.';
  end if;

  -- ── (2) `org_admin`, aceeași cheie. ──
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  select count(*) into v_vazute from public.registru_documente where organization_id = v_org_a;
  reset role;

  raise notice '  (2) `org_admin` vede registrul ............ % rânduri (aștept 1)', v_vazute;
  if v_vazute <> 1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) org_admin nu vede registrul propriei firme.';
  end if;

  -- ── (3) `manager` — niciun rând `registru:*` în seed. ──
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  select count(*) into v_vazute from public.registru_documente where organization_id = v_org_a;
  reset role;

  raise notice '  (3) `manager` nu vede nimic ............... % rânduri (aștept 0)', v_vazute;
  if v_vazute <> 0 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) managerul vede % rânduri, deși n-are registru:read.', v_vazute;
  end if;

  -- ── (4) `employee`. ──
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  select count(*) into v_vazute from public.registru_documente where organization_id = v_org_a;
  reset role;

  raise notice '  (4) `employee` nu vede nimic .............. % rânduri (aștept 0)', v_vazute;
  if v_vazute <> 0 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) angajatul vede registrul firmei.';
  end if;

  -- ── (5) `hr` NU are `registru:update`: nu poate deschide un exercițiu. ──
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  begin
    insert into public.registru_exercitii (organization_id, an) values (v_org_a, 2025);
    v_a_mers := true;
  exception when insufficient_privilege or others then
    v_a_mers := false;
  end;
  reset role;

  raise notice '  (5) `hr` NU poate deschide exercițiul ..... % (aștept refuz)',
    case when v_a_mers then 'A MERS' else 'refuzat' end;
  if v_a_mers then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) HR-ul poate umbla la exercițiu, deși n-are registru:update.';
  end if;

  -- ── (6) A DOUA POARTĂ POZITIVĂ: `org_admin` chiar poate. ──
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.registru_exercitii (organization_id, an) values (v_org_a, 2025);
    v_a_mers := true;
  exception when others then
    v_a_mers := false;
  end;
  reset role;

  raise notice '  (6) `org_admin` POATE deschide exercițiul .. % (aștept reușită)',
    case when v_a_mers then 'a mers' else 'REFUZAT' end;
  if not v_a_mers then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) org_admin nu poate administra exercițiul — închiderea e imposibilă.';
  end if;

  -- ── (7) Izolarea între firme-client. ──
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  select count(*) into v_vazute from public.registru_documente where organization_id = v_org_b;
  reset role;

  raise notice '  (7) NU vede registrul firmei vecine ....... % rânduri (aștept 0)', v_vazute;
  if v_vazute <> 0 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) SCURGERE ÎNTRE FIRME: se văd % rânduri din firma B.', v_vazute;
  end if;

  -- ── (8) Numărul e înghețat, chiar și pentru cine are `registru:update`.
  --     Triggerul rescrie din `old`, deci UPDATE-ul reușește dar nu schimbă
  --     nimic — se verifică VALOAREA de după, nu absența erorii. ──
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  update public.registru_documente set numar = 9999, numar_afisat = 'FALSIFICAT'
    where organization_id = v_org_a;
  reset role;

  select numar into v_numar from public.registru_documente where organization_id = v_org_a;

  raise notice '  (8) numărul rămâne neschimbat ............. % (aștept 1)', v_numar;
  if v_numar <> 1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) NUMĂRUL S-A PUTUT REDENUMI — registrul nu mai e append-only.';
  end if;

  -- ── (9) Un exercițiu închis refuză înregistrarea (pct. 58 lit. h). ──
  update public.registru_exercitii set stare = 'inchis'
    where organization_id = v_org_a and an = extract(year from app.azi_local())::integer;
  insert into public.registru_exercitii (organization_id, an, stare)
    values (v_org_a, extract(year from app.azi_local())::integer, 'inchis')
  on conflict (organization_id, an) do update set stare = 'inchis';

  begin
    perform internal.inregistreaza_document(
      v_org_a, 'iesire'::public.registru_sens, 'adeverinta',
      'Nu trebuie să intre', 'proba', gen_random_uuid());
    v_a_mers := true;
  exception when others then
    v_a_mers := false;
  end;

  raise notice '  (9) anul închis refuză înregistrarea ...... % (aștept refuz)',
    case when v_a_mers then 'A MERS' else 'refuzat' end;
  if v_a_mers then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) s-a înregistrat într-un exercițiu ÎNCHIS.';
  end if;

  raise notice '';
  if v_esecuri > 0 then
    raise exception 'PROBA A EȘUAT: % verificări nepotrivite.', v_esecuri;
  end if;
  raise notice '  PROBA A TRECUT: registrul se vede de cine trebuie și nu se poate rescrie.';
end
$$;
