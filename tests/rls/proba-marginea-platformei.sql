-- tests/rls/proba-marginea-platformei.sql
--
-- CE POATE FACE `anon` DIRECT PE API, DUPĂ 0145.
--
-- ── DE CE EXISTĂ FIȘIERUL ───────────────────────────────────────────────────
-- Cele trei funcții apelabile fără cont sunt singura suprafață a produsului pe
-- care o atinge cineva care n-are nicio legătură cu el. Două dintre ele scriu
-- (organizație + invitație, cerere de demo), iar una dintre alea accepta până
-- la 0145 `token_hash` de la apelant — adică dovada de proprietate a adresei de
-- e-mail se putea fabrica.
--
-- Verificarea (4) e cea care apără un defect pe care nu l-ar prinde nicio citire
-- de cod: limitatorul de rată din bază scria în ACEEAȘI tranzacție pe care un
-- `raise` de mai jos o derula înapoi, deci numărătoarea dispărea la fiecare
-- încercare greșită. Măsurat pe 21 sept 2026, înainte de reparație:
-- `select count(*) from rate_limits where key like 'invit:%'` = 0 după un
-- `peek_invitation` cu token inexistent.
--
-- ── CE VERIFICĂ, PE RÂND ────────────────────────────────────────────────────
-- (1) `anon` NU mai poate chema `inregistreaza_organizatie`;
-- (2) `anon` NU mai poate chema `submit_demo_request`;
-- (3) `service_role` le poate chema în continuare                 [POZITIVĂ];
-- (4) o încercare greșită de `peek_invitation` RĂMÂNE numărată;
-- (5) `peek_invitation` întoarce în continuare datele unei invitații
--     valide, pentru `anon`                                       [POZITIVĂ];
-- (6) `anon` nu are niciun privilegiu pe tabelele din `public`;
-- (7) `authenticated` nu mai are TRUNCATE nicăieri în `public`.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix   text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org     uuid := gen_random_uuid();
  v_admin   uuid := gen_random_uuid();
  v_token   text := 'proba-margine-' || v_sufix;
  v_raspuns jsonb;
  v_inainte int;
  v_dupa    int;
  v_nr      int;
  v_esecuri int := 0;
begin
  raise notice '';
  raise notice '  PROBA „MARGINEA PLATFORMEI" (0145)';
  raise notice '  ─────────────────────────────────────────────────────────';

  -- ═══ (1) `anon` nu mai înregistrează firme ════════════════════════════════
  set local role anon;
  begin
    perform public.inregistreaza_organizatie(
      'Firma Furată SRL', 'RO12345678', 'Ion', 'Popescu',
      'victima-' || v_sufix || '@exemplu.test',
      internal.sha256_hex('token-ales-de-atacator'), now() + interval '7 days', null);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) `anon` a putut înregistra o firmă cu token ales de el';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (1) `anon` nu mai poate chema `inregistreaza_organizatie`';
  end;

  -- ═══ (2) `anon` nu mai trimite cereri de demo ═════════════════════════════
  set local role anon;
  begin
    perform public.submit_demo_request('Ion', 'Firma SRL',
      'demo-' || v_sufix || '@exemplu.test', null, null, null);
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) `anon` a putut trimite o cerere de demo';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (2) `anon` nu mai poate chema `submit_demo_request`';
  end;

  -- ═══ (3) `service_role` le poate chema [POZITIVĂ] ═════════════════════════
  -- Calea reală: Server Action-ul, cu clientul de serviciu, după limitarea lui
  -- de rată pe IP-ul verificat.
  set local role service_role;
  begin
    perform public.submit_demo_request('Ana', 'Firma Reala SRL',
      'ana-' || v_sufix || '@exemplu.test', null, null, 'mesaj de probă');
    reset role;
    raise notice '  ✓ (3) `service_role` trimite cererea de demo';
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) `service_role` nu mai poate trimite cererea: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (4) Încercarea greșită rămâne numărată ═══════════════════════════════
  select count(*) into v_inainte from public.rate_limits where key like 'invit:%';
  set local role anon;
  v_raspuns := public.peek_invitation('token-inexistent-' || v_sufix);
  reset role;
  select count(*) into v_dupa from public.rate_limits where key like 'invit:%';

  if v_raspuns ? 'gasit' and (v_raspuns ->> 'gasit') = 'false' and v_dupa > v_inainte then
    raise notice '  ✓ (4) încercarea greșită e numărată (rânduri: % → %)', v_inainte, v_dupa;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) încercarea greșită NU e numărată (răspuns=%, rânduri: % → %)',
                  v_raspuns, v_inainte, v_dupa;
  end if;

  -- ═══ (5) Invitația validă se citește în continuare [POZITIVĂ] ═════════════
  insert into public.organizations (id, slug, name, cui)
  values (v_org, 'proba-margine-' || v_sufix, 'Proba Margine SRL',
          'RO' || (89000000 + (random() * 900000)::int)::text);
  insert into auth.users (id, email, email_confirmed_at)
  values (v_admin, 'margine-' || v_sufix || '@proba.test', now());
  insert into public.invitations (organization_id, email, role, token_hash, expires_at, invited_by)
  values (v_org, 'invitat-' || v_sufix || '@proba.test', 'employee',
          internal.sha256_hex(v_token), now() + interval '7 days', v_admin);

  set local role anon;
  v_raspuns := public.peek_invitation(v_token);
  reset role;
  if v_raspuns ->> 'organization_name' = 'Proba Margine SRL'
     and (v_raspuns ->> 'expired') = 'false'
     and v_raspuns ? 'email_mascat' then
    raise notice '  ✓ (5) invitația validă se citește în continuare fără cont';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) pagina de invitație s-a rupt: %', v_raspuns;
  end if;

  -- ═══ (6) `anon` nu are privilegii pe tabelele din `public` ════════════════
  select count(*) into v_nr
  from information_schema.role_table_grants
  where grantee = 'anon' and table_schema = 'public';
  if v_nr = 0 then
    raise notice '  ✓ (6) `anon` nu are niciun privilegiu pe tabelele din `public`';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) `anon` are încă % privilegii pe tabele din `public`', v_nr;
  end if;

  -- ═══ (7) `authenticated` nu mai are TRUNCATE ══════════════════════════════
  -- TRUNCATE e singurul privilegiu care IGNORĂ politicile RLS.
  select count(*) into v_nr
  from information_schema.role_table_grants
  where grantee = 'authenticated' and table_schema = 'public' and privilege_type = 'TRUNCATE';
  if v_nr = 0 then
    raise notice '  ✓ (7) `authenticated` nu are TRUNCATE nicăieri în `public`';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) `authenticated` are TRUNCATE pe % tabele', v_nr;
  end if;

  -- ── verdict ───────────────────────────────────────────────────────────────
  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA MARGINII PLATFORMEI: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE cele 7 verificări au trecut.';
  raise notice '';
end;
$$;
