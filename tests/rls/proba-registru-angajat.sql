-- tests/rls/proba-registru-angajat.sql
--
-- POARTA POZITIVĂ a legăturii registru → angajat (0184): nu „cine n-are voie
-- nu poate”, ci „rândul CHIAR primește angajatul pe fiecare drum care îl știe”.
--
-- ── CE VERIFICĂ, PE RÂND ────────────────────────────────────────────────────
-- (1) `employee` depune o cerere de concediu → rândul din registru are
--     `angajat_id` = el (drumul 1: trigger pe sursă, prin `col_ang` din hartă)
-- (2) `org_admin` înregistrează manual o demisie cu `p_angajat_id` → coloana
--     e scrisă (drumul 3: RPC-ul manual)
-- (3) `org_admin` NU poate lega un document de un angajat din ALTĂ firmă —
--     funcția e `security definer`, FK-ul singur l-ar accepta
-- (4) `hr` (fără `registru:update`) nu poate schimba `angajat_id`:
--     ZERO rânduri, FĂRĂ eroare — capcana tăcută a lui `USING`
-- (5) `org_admin` POATE corecta `angajat_id` — coloana nu e pinuită de gardă
-- (6) `hr` vede `angajat_id` în SELECT (coloana nouă nu cere grant separat)
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   psql "$BANC_URL" -f tests/rls/proba-registru-angajat.sql
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org      uuid := gen_random_uuid();
  v_org_b    uuid := gen_random_uuid();
  v_u_admin  uuid := gen_random_uuid();
  v_u_hr     uuid := gen_random_uuid();
  v_u_ang    uuid := gen_random_uuid();
  v_e_ang    uuid;
  v_e_strain uuid;
  v_tip      uuid;
  v_cerere   uuid;
  v_doc      uuid;
  v_legat    uuid;
  v_afisat   text;
  v_randuri  int;
  v_esecuri  int := 0;
  v_a_mers   boolean;
begin
  raise notice '';
  raise notice '  PROBA LEGĂTURII REGISTRU → ANGAJAT (0184)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org,   'proba-rang-a-' || v_sufix, 'Proba Registru Angajat SRL',
     'RO' || (87000000 + (random() * 900000)::int)::text),
    (v_org_b, 'proba-rang-b-' || v_sufix, 'Proba Registru Străin SRL',
     'RO' || (87000000 + (random() * 900000)::int)::text);

  insert into public.organization_features (organization_id, feature_key, enabled) values
    (v_org, 'nucleu', true), (v_org, 'leave', true), (v_org_b, 'nucleu', true)
  on conflict (organization_id, feature_key) where deleted_at is null do nothing;

  insert into auth.users (id, email) values
    (v_u_admin, 'admin-' || v_sufix || '@proba.test'),
    (v_u_hr,    'hr-'    || v_sufix || '@proba.test'),
    (v_u_ang,   'ang-'   || v_sufix || '@proba.test');

  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_admin, 'org_admin'),
    (v_org, v_u_hr,    'hr'),
    (v_org, v_u_ang,   'employee');

  insert into public.employees (organization_id, marca, first_name, last_name, user_id, is_primary)
    values (v_org, 'A-' || v_sufix, 'Ana', 'Angajat', v_u_ang, true)
    returning id into v_e_ang;

  -- Un angajat al ALTEI firme, pentru (3).
  insert into public.employees (organization_id, marca, first_name, last_name)
    values (v_org_b, 'S-' || v_sufix, 'Sorin', 'Străin')
    returning id into v_e_strain;

  select lt.id into v_tip
  from public.leave_types lt
  where lt.organization_id = v_org and lt.key = 'odihna' and lt.deleted_at is null
  limit 1;

  if v_tip is null then
    raise exception 'Bancul n-a semănat tipurile de concediu — proba n-are ce testa.';
  end if;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- (1) Drumul 1: angajatul depune cererea sub identitatea lui; triggerul
  --     sursei cheamă scriitorul generic, care ia `employee_id` din `col_ang`.
  -- ═══════════════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  insert into public.leave_requests
    (organization_id, employee_id, leave_type_id, data_inceput, data_sfarsit, status,
     trimisa_la, created_by)
  values
    (v_org, v_e_ang, v_tip, current_date + 10, current_date + 12, 'trimisa',
     now(), v_u_ang)
  returning id into v_cerere;
  reset role;

  select r.angajat_id into v_legat
  from public.registru_documente r
  where r.organization_id = v_org and r.entitate_id = v_cerere;

  raise notice '  (1) cererea de concediu leagă angajatul ... % (aștept potrivire)',
    case when v_legat = v_e_ang then 'potrivit' else coalesce(v_legat::text, 'NULL') end;
  if v_legat is distinct from v_e_ang then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) RÂNDUL DIN REGISTRU N-ARE ANGAJATUL. Scriitorul generic nu transmite `col_ang`.';
  end if;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- (2) Drumul 3: înregistrarea manuală, cu angajat.
  -- ═══════════════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  select public.inregistreaza_document_manual(
    p_organization_id  => v_org,
    p_sens             => 'intrare',
    p_tip_document     => 'document_personal',
    p_continut_rezumat => 'Demisie depusă la ghișeu — proba',
    p_angajat_id       => v_e_ang
  ) into v_afisat;
  reset role;

  select r.id, r.angajat_id into v_doc, v_legat
  from public.registru_documente r
  where r.organization_id = v_org and r.entitate_tip = 'manual' and r.numar_afisat = v_afisat;

  raise notice '  (2) manualul scrie angajatul ............... % (aștept potrivire)',
    case when v_legat = v_e_ang then 'potrivit' else coalesce(v_legat::text, 'NULL') end;
  if v_legat is distinct from v_e_ang then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) RPC-ul manual nu transmite `p_angajat_id` alocatorului.';
  end if;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- (3) Angajatul altei firme e refuzat cu P0001, nu acceptat de FK.
  -- ═══════════════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    perform public.inregistreaza_document_manual(
      p_organization_id  => v_org,
      p_sens             => 'intrare',
      p_tip_document     => 'document_personal',
      p_continut_rezumat => 'Nu trebuie să intre — angajat străin',
      p_angajat_id       => v_e_strain
    );
    v_a_mers := true;
  exception when others then
    v_a_mers := false;
  end;
  reset role;

  raise notice '  (3) angajatul altei firme e refuzat ....... % (aștept refuz)',
    case when v_a_mers then 'A MERS' else 'refuzat' end;
  if v_a_mers then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) UN DOCUMENT S-A LEGAT DE UN ANGAJAT DIN ALTĂ FIRMĂ.';
  end if;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- (4) `hr` n-are `registru:update`: UPDATE-ul trece fără eroare și atinge
  --     ZERO rânduri. Exact capcana pe care codul trebuie s-o trateze ca CONFLICT.
  -- ═══════════════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  update public.registru_documente set angajat_id = null where id = v_doc;
  get diagnostics v_randuri = row_count;
  reset role;

  raise notice '  (4) `hr` nu poate schimba legătura ........ % rânduri (aștept 0)', v_randuri;
  if v_randuri <> 0 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) hr a modificat registrul fără `registru:update`.';
  end if;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- (5) `org_admin` POATE corecta — coloana nu e pinuită de gardă (0148).
  -- ═══════════════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  update public.registru_documente set angajat_id = null where id = v_doc;
  get diagnostics v_randuri = row_count;
  reset role;

  select r.angajat_id into v_legat from public.registru_documente r where r.id = v_doc;

  raise notice '  (5) `org_admin` corectează legătura ....... % rânduri, acum % (aștept 1, NULL)',
    v_randuri, coalesce(v_legat::text, 'NULL');
  if v_randuri <> 1 or v_legat is not null then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) `angajat_id` nu se poate corecta — garda îl pinuiește sau politica refuză.';
  end if;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- (6) `hr` vede coloana nouă (granturile sunt pe tabelă, nu pe coloană).
  -- ═══════════════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  select count(*) into v_randuri
  from public.registru_documente r
  where r.organization_id = v_org and r.angajat_id = v_e_ang;
  reset role;

  raise notice '  (6) `hr` filtrează după angajat ........... % rânduri (aștept 1)', v_randuri;
  if v_randuri <> 1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) hr nu vede `angajat_id` — filtrul pe angajat ar da gol.';
  end if;

  raise notice '';
  if v_esecuri > 0 then
    raise exception 'PROBA A EȘUAT: % verificări nepotrivite.', v_esecuri;
  end if;
  raise notice '  PROBA A TRECUT: fiecare drum leagă angajatul, iar legătura se corectează doar cu cheia.';
end
$$;
