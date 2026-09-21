-- tests/rls/proba-izolare-intre-firme.sql
--
-- CELE PATRU IEȘIRI DIN FIRMĂ ÎNCHISE DE 0144, PROBATE PE SCHEMA REALĂ.
--
-- ── DE CE EXISTĂ FIȘIERUL ───────────────────────────────────────────────────
-- Migrarea 0144 strânge patru politici. Trei dintre ele (avatare, apartenență,
-- notificări) erau largi tocmai fiindcă nimeni nu le probase din perspectiva
-- unui cont STRĂIN, iar a patra (`app.can_path`) trata `team` ca `all` de la
-- prima ei zi. `tests/rls/izolare.sql` nu le-ar fi prins pe niciuna: bucla lui
-- parcurge tabelele din schema `public` care au coloana `organization_id`, iar
-- `storage.objects` n-are nici schema, nici coloana.
--
-- Proba are două jumătăți, iar a doua e cea care lipsea din proiect: pe lângă
-- „străinul nu poate", verifică și „cine are voie tot poate" — exact defectul
-- din Faza 2, când izolarea era 11/11 în timp ce un `org_admin` nu putea insera
-- un angajat.
--
-- ── CE VERIFICĂ, PE RÂND ────────────────────────────────────────────────────
-- (1) un angajat al firmei A NU vede obiectul-avatar al unui cont din firma B;
-- (2) dar își vede pe al lui                                      [POZITIVĂ];
-- (3) `org_admin` vede avatarul unui membru al firmei lui         [POZITIVĂ];
-- (4) angajatul A NU poate muta avatarul contului din firma B sub el;
-- (5) dar își poate rescrie propriul obiect                       [POZITIVĂ];
-- (6) `org_admin` NU mai poate insera direct în `organization_members`;
-- (7) `accept_invitation` adaugă în continuare membrul                [POZITIVĂ];
-- (8) managerul citește calea din Storage a SUBORDONATULUI        [POZITIVĂ];
-- (9) managerul NU citește calea unui angajat din afara echipei lui;
-- (10) managerul NU citește calea lotului de import (CNP/IBAN în clar);
-- (11) `hr` (scope `all`) citește calea lotului de import         [POZITIVĂ];
-- (12) angajatul își citește propriul dosar (scope `own`)         [POZITIVĂ];
-- (13) notificarea către un membru al firmei trece                [POZITIVĂ];
-- (14) notificarea către un cont din ALTĂ firmă e refuzată;
-- (15) managerul ÎNCARCĂ material de curs (`courses:* = team`)    [POZITIVĂ];
-- (16) managerul CITEȘTE materialul de curs al firmei lui        [POZITIVĂ];
-- (17) un manager din ALTĂ firmă nu vede materialul;
-- (18) un `manager` fără fișă de personal nu mai trece pe `team`;
-- (19) un obiect cu `owner is null` nu e modificabil de nimeni.
--
-- Verificările (15)-(17) sunt cele care ar fi prins regresia găsită la revizie:
-- căile de curs poartă în segmentul 3 un `course_materials.id`, nu o fișă de
-- personal, deci verificarea pe entitate le-ar fi refuzat pe toate — modulul
-- Cursuri ar fi murit pentru manager, cu 14/14 verde pe restul probei.
-- Ramura „angajatul înrolat citește materialul atribuit"
-- (`app.curs_obiect_atribuit`) NU e acoperită aici: 0144 n-o atinge deloc.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org_a    uuid := gen_random_uuid();
  v_org_b    uuid := gen_random_uuid();
  v_u_admin  uuid := gen_random_uuid();
  v_u_mgr    uuid := gen_random_uuid();
  v_u_hr     uuid := gen_random_uuid();
  v_u_ang    uuid := gen_random_uuid();
  v_u_strain uuid := gen_random_uuid();
  v_u_invit  uuid := gen_random_uuid();
  v_e_mgr    uuid := gen_random_uuid();
  v_e_ang    uuid := gen_random_uuid();
  v_e_altul  uuid := gen_random_uuid();
  v_lot      uuid := gen_random_uuid();
  v_material uuid := gen_random_uuid();
  v_u_mgr_b  uuid := gen_random_uuid();
  v_u_mgr_fara uuid := gen_random_uuid();
  v_token    text := 'proba-' || v_sufix;
  v_cale_a   text;
  v_cale_b   text;
  v_vazute   int;
  v_atinse   int;
  v_poate    boolean;
  v_esecuri  int := 0;
begin
  raise notice '';
  raise notice '  PROBA „IZOLAREA ÎNTRE FIRME" (0144)';
  raise notice '  ─────────────────────────────────────────────────────────';

  -- ── fixture ───────────────────────────────────────────────────────────────
  insert into public.organizations (id, slug, name, cui) values
    (v_org_a, 'proba-izo-a-' || v_sufix, 'Proba Izolare A SRL',
     'RO' || (89000000 + (random() * 900000)::int)::text),
    (v_org_b, 'proba-izo-b-' || v_sufix, 'Proba Izolare B SRL',
     'RO' || (89000000 + (random() * 900000)::int)::text);

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_admin,  'izo-admin-'  || v_sufix || '@proba.test', now()),
    (v_u_mgr,    'izo-mgr-'    || v_sufix || '@proba.test', now()),
    (v_u_hr,     'izo-hr-'     || v_sufix || '@proba.test', now()),
    (v_u_ang,    'izo-ang-'    || v_sufix || '@proba.test', now()),
    (v_u_strain, 'izo-strain-' || v_sufix || '@proba.test', now()),
    (v_u_invit,  'izo-invit-'  || v_sufix || '@proba.test', now()),
    (v_u_mgr_b,  'izo-mgrb-'   || v_sufix || '@proba.test', now()),
    (v_u_mgr_fara, 'izo-mgrf-' || v_sufix || '@proba.test', now());

  insert into public.organization_members (organization_id, user_id, role) values
    (v_org_a, v_u_admin,  'org_admin'),
    (v_org_a, v_u_mgr,    'manager'),
    (v_org_a, v_u_hr,     'hr'),
    (v_org_a, v_u_ang,    'employee'),
    (v_org_b, v_u_strain, 'employee');

  -- Fișele: angajatul e subordonatul managerului, „altul" nu e al nimănui.
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_mgr,   v_org_a, 'IZO-M', 'Mihai', 'Manager', app.azi_local() - 500, 'activ', v_u_mgr,  null),
    (v_e_ang,   v_org_a, 'IZO-A', 'Ana',   'Angajat', app.azi_local() - 400, 'activ', v_u_ang,  v_e_mgr),
    (v_e_altul, v_org_a, 'IZO-X', 'Radu',  'Strain',  app.azi_local() - 300, 'activ', null,     null);

  -- Obiectele din Storage: un avatar în fiecare firmă, plus dosarele.
  v_cale_a := v_u_ang::text    || '/' || gen_random_uuid()::text || '-poza.png';
  v_cale_b := v_u_strain::text || '/' || gen_random_uuid()::text || '-poza.png';
  insert into storage.objects (bucket_id, name, owner) values
    ('avatars', v_cale_a, v_u_ang),
    ('avatars', v_cale_b, v_u_strain),
    ('org-documents', v_org_a::text || '/employees/' || v_e_ang::text   || '/contract.pdf', v_u_hr),
    ('org-documents', v_org_a::text || '/employees/' || v_e_altul::text || '/contract.pdf', v_u_hr),
    ('org-documents', v_org_a::text || '/employees/' || v_lot::text     || '/import.xlsx', v_u_hr);

  -- ═══ (1) Avatarul altei firme nu se vede ══════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  select count(*) into v_vazute from storage.objects where name = v_cale_b;
  reset role;
  if v_vazute = 0 then
    raise notice '  ✓ (1) avatarul firmei B e invizibil pentru firma A';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) avatarul firmei B e VIZIBIL (% rânduri) — enumerarea între firme e deschisă', v_vazute;
  end if;

  -- ═══ (2) Propriul avatar rămâne vizibil [POZITIVĂ] ════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  select count(*) into v_vazute from storage.objects where name = v_cale_a;
  reset role;
  if v_vazute = 1 then
    raise notice '  ✓ (2) propriul avatar rămâne vizibil';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) propriul avatar a dispărut (% rânduri) — politica e prea strâmtă', v_vazute;
  end if;

  -- ═══ (3) Administratorul vede avatarul membrului său [POZITIVĂ] ═══════════
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  select count(*) into v_vazute from storage.objects where name = v_cale_a;
  reset role;
  if v_vazute = 1 then
    raise notice '  ✓ (3) `org_admin` vede avatarul membrului său';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) `org_admin` nu mai vede avatarul membrului (% rânduri)', v_vazute;
  end if;

  -- ═══ (4) Avatarul altei firme nu se poate MUTA ════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  update storage.objects
     set name = v_u_ang::text || '/furat.png', owner = v_u_ang
   where name = v_cale_b;
  get diagnostics v_atinse = row_count;
  reset role;
  if v_atinse = 0 then
    raise notice '  ✓ (4) avatarul firmei B nu se poate muta';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) avatarul firmei B a fost MUTAT (% rânduri)', v_atinse;
  end if;

  -- ═══ (5) Propriul obiect rămâne rescriibil [POZITIVĂ] ═════════════════════
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  update storage.objects set updated_at = now() where name = v_cale_a;
  get diagnostics v_atinse = row_count;
  reset role;
  if v_atinse = 1 then
    raise notice '  ✓ (5) propriul obiect rămâne rescriibil';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) propriul obiect nu mai poate fi rescris (% rânduri)', v_atinse;
  end if;

  -- ═══ (6) Apartenența nu se mai scrie direct ═══════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.organization_members (organization_id, user_id, role, status)
    values (v_org_a, v_u_strain, 'employee', 'active');
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) `org_admin` a atașat un cont STRĂIN fără invitație';
  exception when insufficient_privilege then
    raise notice '  ✓ (6) inserarea directă în `organization_members` e refuzată';
  end;
  reset role;

  -- ═══ (7) `accept_invitation` merge mai departe [POZITIVĂ] ═════════════════
  insert into public.invitations (organization_id, email, role, token_hash, expires_at, invited_by)
  values (v_org_a, 'izo-invit-' || v_sufix || '@proba.test', 'employee',
          internal.sha256_hex(v_token), now() + interval '7 days', v_u_admin);

  perform set_config('request.jwt.claim.sub', v_u_invit::text, true);
  set local role authenticated;
  begin
    perform public.accept_invitation(v_token);
    reset role;
    select count(*) into v_vazute
      from public.organization_members
     where organization_id = v_org_a and user_id = v_u_invit and status = 'active';
    if v_vazute = 1 then
      raise notice '  ✓ (7) invitația acceptată creează în continuare membrul';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (7) invitația acceptată NU a creat membrul (% rânduri)', v_vazute;
    end if;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) `accept_invitation` a eșuat: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (8) Managerul citește dosarul subordonatului [POZITIVĂ] ══════════════
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  select app.can_path(v_org_a::text || '/employees/' || v_e_ang::text || '/contract.pdf', 'read')
    into v_poate;
  select count(*) into v_vazute from storage.objects
   where name = v_org_a::text || '/employees/' || v_e_ang::text || '/contract.pdf';
  reset role;
  if v_poate and v_vazute = 1 then
    raise notice '  ✓ (8) managerul citește dosarul subordonatului';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) managerul NU mai citește dosarul subordonatului (can_path=%, rânduri=%)',
                  v_poate, v_vazute;
  end if;

  -- ═══ (9) Dar nu și al unui angajat din afara echipei ══════════════════════
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  select app.can_path(v_org_a::text || '/employees/' || v_e_altul::text || '/contract.pdf', 'read')
    into v_poate;
  select count(*) into v_vazute from storage.objects
   where name = v_org_a::text || '/employees/' || v_e_altul::text || '/contract.pdf';
  reset role;
  if not v_poate and v_vazute = 0 then
    raise notice '  ✓ (9) managerul nu citește dosarul din afara echipei';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) `team` se comportă tot ca `all` (can_path=%, rânduri=%)', v_poate, v_vazute;
  end if;

  -- ═══ (10) Nici lotul de import (CNP/IBAN în clar) ═════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  select count(*) into v_vazute from storage.objects
   where name = v_org_a::text || '/employees/' || v_lot::text || '/import.xlsx';
  reset role;
  if v_vazute = 0 then
    raise notice '  ✓ (10) managerul nu citește lotul de import';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10) managerul citește lotul de import (% rânduri)', v_vazute;
  end if;

  -- ═══ (11) `hr` citește lotul de import [POZITIVĂ] ═════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  select count(*) into v_vazute from storage.objects
   where name = v_org_a::text || '/employees/' || v_lot::text || '/import.xlsx';
  reset role;
  if v_vazute = 1 then
    raise notice '  ✓ (11) `hr` citește lotul de import (importul funcționează)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (11) `hr` nu mai citește lotul de import — importul e rupt (% rânduri)', v_vazute;
  end if;

  -- ═══ (12) Angajatul își citește propriul dosar [POZITIVĂ] ═════════════════
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  select app.can_path(v_org_a::text || '/employees/' || v_e_ang::text || '/contract.pdf', 'read')
    into v_poate;
  reset role;
  if v_poate then
    raise notice '  ✓ (12) angajatul își citește propriul dosar (scope `own`)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (12) angajatul nu-și mai citește dosarul — defectul (b) din 0073 a revenit';
  end if;

  -- ═══ (13) Notificarea către un membru trece [POZITIVĂ] ════════════════════
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.notifications (organization_id, user_id, kind, title, body)
    values (v_org_a, v_u_ang, 'info', 'Probă', 'Mesaj de probă');
    raise notice '  ✓ (13) notificarea către un membru al firmei trece';
  exception when others then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (13) notificarea legitimă a fost refuzată: % (%)', sqlerrm, sqlstate;
  end;
  reset role;

  -- ═══ (14) Notificarea către un cont din altă firmă e refuzată ═════════════
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.notifications (organization_id, user_id, kind, title, body)
    values (v_org_a, v_u_strain, 'info', 'Phishing', 'Mesaj în afara firmei');
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (14) notificarea a plecat către un cont din ALTĂ firmă';
  exception when insufficient_privilege then
    raise notice '  ✓ (14) notificarea către un nemembru e refuzată';
  end;
  reset role;

  -- ═══ (15) Managerul încarcă material de curs [POZITIVĂ] ═══════════════════
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('org-courses',
            v_org_a::text || '/courses/' || v_material::text || '/v1-' || v_sufix || '-film.mp4',
            v_u_mgr);
    raise notice '  ✓ (15) managerul încarcă material de curs';
  exception when others then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (15) managerul NU mai poate încărca material de curs: % (%)', sqlerrm, sqlstate;
  end;
  reset role;

  -- ═══ (16) Și îl citește [POZITIVĂ] ════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  select count(*) into v_vazute from storage.objects
   where name like v_org_a::text || '/courses/' || v_material::text || '/%';
  reset role;
  if v_vazute = 1 then
    raise notice '  ✓ (16) managerul citește materialul de curs al firmei lui';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (16) managerul nu mai vede materialul de curs (% rânduri)', v_vazute;
  end if;

  -- ═══ (17) Dar nu și un manager din altă firmă ═════════════════════════════
  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_b, v_u_mgr_b, 'manager');
  perform set_config('request.jwt.claim.sub', v_u_mgr_b::text, true);
  set local role authenticated;
  select count(*) into v_vazute from storage.objects
   where name like v_org_a::text || '/courses/' || v_material::text || '/%';
  reset role;
  if v_vazute = 0 then
    raise notice '  ✓ (17) managerul firmei B nu vede materialul firmei A';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (17) materialul firmei A e vizibil din firma B (% rânduri)', v_vazute;
  end if;

  -- ═══ (18) Manager FĂRĂ fișă de personal ═══════════════════════════════════
  -- Rolul stă pe apartenență, fișa e separată: se poate să ai unul fără altul.
  -- Fără fișă nu există echipă, deci `team` nu mai deschide nimic. Intenționat.
  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_a, v_u_mgr_fara, 'manager');
  perform set_config('request.jwt.claim.sub', v_u_mgr_fara::text, true);
  set local role authenticated;
  select app.can_path(v_org_a::text || '/employees/' || v_e_ang::text || '/contract.pdf', 'read')
    into v_poate;
  reset role;
  if not v_poate then
    raise notice '  ✓ (18) managerul fără fișă nu trece pe `team`';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (18) managerul fără fișă de personal citește dosarele firmei';
  end if;

  -- ═══ (19) Obiect cu `owner is null` ═══════════════════════════════════════
  -- Urcat cândva cu `service_role`. Nu mai e modificabil prin clientul
  -- utilizatorului — nici de cel din folderul căruia face parte. Verificarea
  -- fixează comportamentul, ca să nu fie redescoperit ca defect.
  insert into storage.objects (bucket_id, name, owner)
  values ('avatars', v_u_ang::text || '/fara-owner-' || v_sufix || '.png', null);
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  update storage.objects set updated_at = now()
   where name = v_u_ang::text || '/fara-owner-' || v_sufix || '.png';
  get diagnostics v_atinse = row_count;
  reset role;
  if v_atinse = 0 then
    raise notice '  ✓ (19) obiectul fără `owner` nu e modificabil din client';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (19) obiectul fără `owner` a fost modificat (% rânduri)', v_atinse;
  end if;

  -- ── verdict ───────────────────────────────────────────────────────────────
  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA IZOLĂRII ÎNTRE FIRME: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE cele 19 verificări au trecut.';
  raise notice '';
end;
$$;
