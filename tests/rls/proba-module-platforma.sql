-- tests/rls/proba-module-platforma.sql
--
-- POARTA POZITIVĂ a comutării de module (0109): nu „nimeni nu vede modulele
-- altei firme", ci „consola de platformă CHIAR vede ce tocmai a scris".
--
-- ── DEFECTUL PE CARE ÎL ȚINE ÎNCHIS ─────────────────────────────────────────
-- Pagina `/super-admin/organizatii/<id>/module` SCRIE prin `service_role` și
-- CITEȘTE prin clientul de sesiune, deci prin RLS. Politica din 0002 cerea
-- apartenență la firmă (`app.current_org_ids()`), iar un administrator de
-- platformă nu e NICIODATĂ în `organization_members` — sursa lui e
-- `platform_admins`. Rezultatul: scrierea reușea, recitirea întorcea ZERO
-- RÂNDURI FĂRĂ NICIO EROARE, iar toate comutatoarele apăreau stinse pe o firmă
-- cu unsprezece module active. INSERT și UPDATE aveau deja ramura de platformă;
-- doar SELECT n-o avea. 0109 o aliniază.
--
-- ── DE CE NU AJUNGE SĂ VERIFICI CĂ SCRIEREA MERGE ───────────────────────────
-- Scrierea mergea și înainte de reparație — trecea prin `service_role`, care
-- ocolește RLS prin definiție. Partea care se strica tăcut era CITIREA DE
-- ÎNTOARCERE. De aceea fiecare verificare de mai jos numără rânduri citite
-- SUB IDENTITATEA unui om, nu confirmarea unui `insert`.
--
-- ── CE VERIFICĂ, PE RÂND ────────────────────────────────────────────────────
-- (1) administratorul de platformă, NEmembru, vede activările firmei;
-- (2) el le vede și după ce le comută — scrie-apoi-citește, simetric;
-- (3) `org_admin`-ul firmei își vede în continuare propriile module (regula
--     veche n-a fost înlocuită, ci lărgită);
-- (4) `org_admin`-ul firmei A NU vede modulele firmei B — izolarea între
--     firme-client rămâne intactă, adică lărgirea a atins doar platforma;
-- (5) un administrator de platformă cu dreptul RETRAS (`revoked_at`) recade la
--     regula de apartenență: zero rânduri. Fără verificarea asta, „e platformă"
--     ar putea fi citit greșit ca „a fost cândva platformă".
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh --pastreaza
--   PORT=$(docker ps --filter name=administrativo-banc --format '{{.Ports}}' \
--          | grep -oE '0.0.0.0:[0-9]+' | head -1 | cut -d: -f2)
--   psql "postgresql://postgres:banc@localhost:$PORT/postgres" -f tests/rls/proba-module-platforma.sql
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  -- Sufix unic pe rulare: proba trebuie să poată fi repetată pe același banc
  -- fără să se lovească de propriile date de la rulajul anterior.
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org_a    uuid := gen_random_uuid();
  v_org_b    uuid := gen_random_uuid();
  v_platf    uuid := gen_random_uuid();
  v_retras   uuid := gen_random_uuid();
  v_admin_a  uuid := gen_random_uuid();
  v_vazute   int;
  v_esecuri  int  := 0;
begin
  raise notice '';
  raise notice '  PROBA „MODULELE VĂZUTE DE PLATFORMĂ" (0109)';
  raise notice '  ─────────────────────────────────────────────────────────';

  -- ── Două firme, ca izolarea să aibă ce rupe dacă e ruptă. ──
  insert into public.organizations (id, slug, name, cui) values
    (v_org_a, 'proba-mod-a-' || v_sufix, 'Proba Module A SRL',
     'RO' || (89000000 + (random() * 900000)::int)::text),
    (v_org_b, 'proba-mod-b-' || v_sufix, 'Proba Module B SRL',
     'RO' || (89000000 + (random() * 900000)::int)::text);

  insert into public.organization_features (organization_id, feature_key, enabled) values
    (v_org_a, 'nucleu', true), (v_org_a, 'attendance', true), (v_org_a, 'leave', true),
    (v_org_b, 'nucleu', true), (v_org_b, 'attendance', true)
  on conflict (organization_id, feature_key) where deleted_at is null do nothing;

  -- ── Oamenii. Administratorii de platformă NU primesc rând în
  -- `organization_members`: exact asta e configurația în care defectul apărea. ──
  insert into auth.users (id, email) values
    (v_platf,   'platforma-'  || v_sufix || '@proba.test'),
    (v_retras,  'retras-'     || v_sufix || '@proba.test'),
    (v_admin_a, 'orgadmin-a-' || v_sufix || '@proba.test');

  insert into public.platform_admins (user_id) values (v_platf);
  insert into public.platform_admins (user_id, revoked_at) values (v_retras, now() - interval '1 day');

  insert into public.organization_members (organization_id, user_id, role)
    values (v_org_a, v_admin_a, 'org_admin');

  -- ── (1) Platforma vede activările unei firme din care nu face parte. ──
  perform set_config('request.jwt.claim.sub', v_platf::text, true);
  set local role authenticated;
  select count(*) into v_vazute from public.organization_features where organization_id = v_org_a;
  reset role;

  raise notice '  (1) platformă, nemembră, vede firma A ....... % rânduri (aștept 3)', v_vazute;
  if v_vazute <> 3 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) administratorul de platformă vede % rânduri în loc de 3 — comutatoarele apar stinse.', v_vazute;
  end if;

  -- ── (2) Scrie-apoi-citește: comutarea făcută prin `service_role` trebuie să
  -- se vadă la recitirea prin RLS. Asta e exact secvența din pagină. ──
  update public.organization_features set enabled = false
   where organization_id = v_org_a and feature_key = 'attendance';

  perform set_config('request.jwt.claim.sub', v_platf::text, true);
  set local role authenticated;
  select count(*) into v_vazute
    from public.organization_features
   where organization_id = v_org_a and feature_key = 'attendance' and not enabled;
  reset role;

  raise notice '  (2) vede comutarea pe care a făcut-o ........ % rânduri (aștept 1)', v_vazute;
  if v_vazute <> 1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) comutarea s-a scris dar nu se recitește — defectul din 0109 e înapoi.';
  end if;

  -- ── (3) Regula veche, neatinsă: membrul firmei își vede modulele. ──
  perform set_config('request.jwt.claim.sub', v_admin_a::text, true);
  set local role authenticated;
  select count(*) into v_vazute from public.organization_features where organization_id = v_org_a;
  reset role;

  raise notice '  (3) org_admin își vede propria firmă ....... % rânduri (aștept 3)', v_vazute;
  if v_vazute <> 3 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) membrul firmei vede % rânduri în loc de 3 — lărgirea a stricat ramura veche.', v_vazute;
  end if;

  -- ── (4) Izolarea între firme-client, care NU trebuie să se fi mișcat. ──
  perform set_config('request.jwt.claim.sub', v_admin_a::text, true);
  set local role authenticated;
  select count(*) into v_vazute from public.organization_features where organization_id = v_org_b;
  reset role;

  raise notice '  (4) org_admin NU vede firma vecină ......... % rânduri (aștept 0)', v_vazute;
  if v_vazute <> 0 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) SCURGERE ÎNTRE FIRME: org_admin-ul firmei A vede % rânduri din firma B.', v_vazute;
  end if;

  -- ── (5) Dreptul retras nu mai e drept. ──
  perform set_config('request.jwt.claim.sub', v_retras::text, true);
  set local role authenticated;
  select count(*) into v_vazute from public.organization_features where organization_id = v_org_a;
  reset role;

  raise notice '  (5) platformă cu drept retras .............. % rânduri (aștept 0)', v_vazute;
  if v_vazute <> 0 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) un administrator de platformă revocat vede în continuare % rânduri.', v_vazute;
  end if;

  raise notice '';
  if v_esecuri > 0 then
    raise exception 'PROBA A EȘUAT: % verificări nepotrivite.', v_esecuri;
  end if;
  raise notice '  PROBA A TRECUT: platforma vede ce scrie, firmele rămân separate.';
end
$$;
