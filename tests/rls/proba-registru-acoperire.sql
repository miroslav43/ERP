-- tests/rls/proba-registru-acoperire.sql
--
-- POARTA POZITIVĂ a acoperirii totale (0135 + 0136): nu „registrul refuză cine
-- n-are voie", ci „un ANGAJAT care depune o cerere de concediu CHIAR produce un
-- număr de înregistrare, deși n-are nicio cheie `registru:*`".
--
-- ── DE CE EXACT ASTA ────────────────────────────────────────────────────────
-- E defectul de la care a pornit livrarea: o cerere de concediu depusă în
-- aplicație nu primea număr. Specificația din 3 septembrie folosea chiar acest
-- exemplu ca să justifice de ce alocarea trebuie făcută din trigger — argumentul
-- fusese scris, triggerul nu.
--
-- Dacă alocatorul ar fi păzit de `registru:*`, angajatul ar depune cererea și
-- registrul ar rămâne gol. FĂRĂ EROARE. Verificarea (1) e singura care cade atunci.
--
-- ── CE VERIFICĂ, PE RÂND ────────────────────────────────────────────────────
-- (1) `employee` depune o cerere → apare rând în registru      ← poarta pozitivă
-- (2) o cerere în CIORNĂ nu produce rând (portița de status)
-- (3) aprobarea ÎNCHIDE același rând, fără număr nou
--     (Ordin 217/1996 art. 9: „documentele expediate ca răspuns … vor primi
--      numărul de înregistrare al documentului la care se răspunde")
-- (4) indicativul dosarului se completează din nomenclator (art. 9 și art. 11)
-- (5) al zecelea document al anului are numărul 10, nu 1  ← capcana `lpad`
-- (6) INSERT direct în registru e refuzat, chiar și pentru `org_admin`
--     (pct. 58 lit. o: numerele nu se fabrică)
-- (7) înregistrarea manuală: refuzată pentru `hr`, merge pentru `org_admin`
-- (8) a doua înregistrare a aceleiași entități nu arde un număr
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   psql "$BANC_URL" -f tests/rls/proba-registru-acoperire.sql
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org      uuid := gen_random_uuid();
  v_u_admin  uuid := gen_random_uuid();
  v_u_hr     uuid := gen_random_uuid();
  v_u_ang    uuid := gen_random_uuid();
  v_e_ang    uuid;
  v_tip      uuid;
  v_cerere   uuid;
  v_ciorna   uuid;
  v_randuri  int;
  v_numar    int;
  v_afisat   text;
  v_indicativ text;
  v_rezolvare text;
  v_esecuri  int := 0;
  v_a_mers   boolean;
  v_i        int;
begin
  raise notice '';
  raise notice '  PROBA ACOPERIRII TOTALE A REGISTRULUI (0135 + 0136)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-acop-' || v_sufix, 'Proba Acoperire SRL',
     'RO' || (88000000 + (random() * 900000)::int)::text);

  insert into public.organization_features (organization_id, feature_key, enabled) values
    (v_org, 'nucleu', true), (v_org, 'leave', true)
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

  select lt.id into v_tip
  from public.leave_types lt
  where lt.organization_id = v_org and lt.key = 'odihna' and lt.deleted_at is null
  limit 1;

  if v_tip is null then
    raise exception 'Bancul n-a semănat tipurile de concediu — proba n-are ce testa.';
  end if;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- (1) POARTA POZITIVĂ: angajatul depune cererea SUB IDENTITATEA LUI.
  --     Dreptul care contează e dreptul de a scrie DOCUMENTUL, verificat de
  --     RLS-ul lui `leave_requests`. Alocatorul e `security definer` și revocat
  --     de la `authenticated`, deci angajatul nu-l poate chema — dar triggerul da.
  -- ═══════════════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  insert into public.leave_requests
    (organization_id, employee_id, leave_type_id, data_inceput, data_sfarsit, status, created_by)
  values
    (v_org, v_e_ang, v_tip, current_date + 10, current_date + 12, 'trimisa', v_u_ang)
  returning id into v_cerere;
  reset role;

  select count(*) into v_randuri
  from public.registru_documente r
  where r.organization_id = v_org and r.entitate_id = v_cerere;

  raise notice '  (1) `employee` depune cerere → registru ... % rânduri (aștept 1)', v_randuri;
  if v_randuri <> 1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) CEREREA DE CONCEDIU NU A PRIMIT NUMĂR. Exact defectul raportat.';
  end if;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- (2) O ciornă nu e un document: n-a fost depusă.
  -- ═══════════════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  insert into public.leave_requests
    (organization_id, employee_id, leave_type_id, data_inceput, data_sfarsit, status, created_by)
  values
    (v_org, v_e_ang, v_tip, current_date + 20, current_date + 21, 'ciorna', v_u_ang)
  returning id into v_ciorna;
  reset role;

  select count(*) into v_randuri
  from public.registru_documente r
  where r.organization_id = v_org and r.entitate_id = v_ciorna;

  raise notice '  (2) ciorna NU arde număr .................. % rânduri (aștept 0)', v_randuri;
  if v_randuri <> 0 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) o ciornă abandonată consumă un număr de registru.';
  end if;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- (4) Indicativul dosarului, din nomenclatorul implicit. Cererile de concediu
  --     se clasează la II.5 — „Cereri de concediu, compensări și zile libere".
  -- ═══════════════════════════════════════════════════════════════════════════
  select r.indicativ_dosar, r.numar, r.numar_afisat
    into v_indicativ, v_numar, v_afisat
  from public.registru_documente r
  where r.organization_id = v_org and r.entitate_id = v_cerere;

  raise notice '  (4) indicativul dosarului ................. % (aștept II.5)',
    coalesce(v_indicativ, 'LIPSĂ');
  if v_indicativ is distinct from 'II.5' then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) indicativul dosarului nu vine din nomenclator — art. 9 și art. 11.';
  end if;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- (3) Aprobarea ÎNCHIDE rândul cererii. Art. 9: răspunsul primește numărul
  --     documentului la care se răspunde, deci NU un rând nou.
  -- ═══════════════════════════════════════════════════════════════════════════
  update public.leave_requests set status = 'aprobata' where id = v_cerere;

  select count(*) into v_randuri
  from public.registru_documente r
  where r.organization_id = v_org and r.entitate_id = v_cerere;

  select r.mod_rezolvare into v_rezolvare
  from public.registru_documente r
  where r.organization_id = v_org and r.entitate_id = v_cerere;

  raise notice '  (3) aprobarea închide ACELAȘI rând ........ % rânduri, rezolvare „%”',
    v_randuri, coalesce(v_rezolvare, 'LIPSĂ');
  if v_randuri <> 1 or v_rezolvare is distinct from 'aprobata' then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) răspunsul nu închide rândul cererii — art. 9.';
  end if;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- (5) CAPCANA `lpad`. Cu `padding = 1`, `lpad('10', 1, '0')` întoarce „1”:
  --     al zecelea document ar coliziona pe indexul unic, iar reîncercările ar
  --     arde numere până la epuizare. Se concatenează direct — se verifică aici.
  -- ═══════════════════════════════════════════════════════════════════════════
  for v_i in 1..12 loop
    perform internal.inregistreaza_document(
      v_org, 'intern'::public.registru_sens, 'nota_interna',
      'Notă internă de probă ' || v_i::text, 'proba_lpad', gen_random_uuid());
  end loop;

  select max(r.numar) into v_numar
  from public.registru_documente r where r.organization_id = v_org;

  select r.numar_afisat into v_afisat
  from public.registru_documente r
  where r.organization_id = v_org and r.numar = 10;

  raise notice '  (5) al zecelea document .................. „%” (aștept „10/…”)',
    coalesce(v_afisat, 'LIPSĂ');
  if v_afisat is null or v_afisat not like '10/%' then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) numerotarea se trunchiază la a doua cifră — capcana lpad.';
  end if;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- (8) Idempotența: a doua înregistrare a aceleiași entități nu arde un număr.
  -- ═══════════════════════════════════════════════════════════════════════════
  perform internal.inregistreaza_document(
    v_org, 'intern'::public.registru_sens, 'nota_interna',
    'Notă internă de probă 1', 'proba_lpad',
    (select r.entitate_id from public.registru_documente r
      where r.organization_id = v_org and r.entitate_tip = 'proba_lpad'
      order by r.numar limit 1));

  select max(r.numar) into v_randuri
  from public.registru_documente r where r.organization_id = v_org;

  raise notice '  (8) reînregistrarea nu arde număr ......... max % (aștept %)', v_randuri, v_numar;
  if v_randuri <> v_numar then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) al doilea apel pe aceeași entitate consumă un număr nou.';
  end if;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- (6) Numerele nu se fabrică din client. Grantul de INSERT s-a revocat în 0135.
  -- ═══════════════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.registru_documente
      (organization_id, an, numar, numar_afisat, data_inregistrare, sens, tip_document,
       continut_rezumat, entitate_tip)
    values
      (v_org, extract(year from current_date)::int, 1, '1/01.01.2026', current_date,
       'iesire', 'adeverinta', 'Număr fabricat', 'fals');
    v_a_mers := true;
  exception when others then
    v_a_mers := false;
  end;
  reset role;

  raise notice '  (6) INSERT direct e refuzat ............... % (aștept refuz)',
    case when v_a_mers then 'A MERS' else 'refuzat' end;
  if v_a_mers then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) un org_admin poate fabrica un număr de înregistrare — pct. 58 lit. o).';
  end if;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- (7) Înregistrarea manuală, necesară pentru documentele INTRATE pe hârtie
  --     (art. 8; Codul muncii art. 81 pentru demisie). Cere `registru:update`,
  --     pe care `hr` NU o are.
  -- ═══════════════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  begin
    perform public.inregistreaza_document_manual(
      v_org, 'intrare', 'document_personal', 'Demisie primită pe hârtie');
    v_a_mers := true;
  exception when others then
    v_a_mers := false;
  end;
  reset role;

  raise notice '  (7a) `hr` NU înregistrează manual ......... % (aștept refuz)',
    case when v_a_mers then 'A MERS' else 'refuzat' end;
  if v_a_mers then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7a) `hr` scrie în registru fără `registru:update`.';
  end if;

  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    select public.inregistreaza_document_manual(
      v_org, 'intrare', 'document_personal', 'Demisie primită pe hârtie')
      into v_afisat;
    v_a_mers := true;
  exception when others then
    v_a_mers := false;
    v_afisat := null;
  end;
  reset role;

  raise notice '  (7b) `org_admin` înregistrează manual ..... % (aștept un număr)',
    coalesce(v_afisat, 'REFUZAT');
  if not v_a_mers or v_afisat is null then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7b) NIMENI nu poate înregistra o demisie primită pe hârtie — art. 8.';
  end if;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri = 0 then
    raise notice '  ✓ acoperirea registrului: 8/8';
  else
    raise exception '% verificări au căzut din proba de acoperire a registrului.', v_esecuri;
  end if;
  raise notice '';
end;
$$;
