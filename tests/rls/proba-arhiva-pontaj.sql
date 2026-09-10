-- tests/rls/proba-arhiva-pontaj.sql
--
-- POARTA POZITIVĂ a arhivei lunare de pontaj (0134): nu „managerul nu vede
-- arhiva", ci „`hr` CHIAR poate deschide arhiva firmei lui".
--
-- ── DE CE POARTA POZITIVĂ E PRIMA ───────────────────────────────────────────
-- Aceeași capcană ca la registru, cu altă cheie. Arhiva e păzită de
-- `attendance:export` la scope `all`. Alegerea „firească" ar fi fost
-- `compliance:read` — arhiva e un instrument de conformitate — iar rolul `hr`
-- NU are cheia aia în seed. Ecranul s-ar fi deschis pentru exact omul care
-- ține pontajul, și ar fi arătat ZERO RÂNDURI, fără eroare, fără nimic în log.
-- Verificarea (2) e singura care ar cădea atunci.
--
-- ── CE VERIFICĂ, PE RÂND ────────────────────────────────────────────────────
-- (1)  `org_admin` vede arhiva firmei lui               ← poartă pozitivă
-- (2)  `hr` vede arhiva firmei lui                      ← poartă pozitivă
-- (3)  `manager` nu vede nimic (are `attendance` doar `{read,approve}`/team)
-- (4)  `employee` nu vede nimic
-- (5)  `org_admin`-ul firmei A nu vede arhiva firmei B  ← izolarea
-- (6)  o lună fără nicio intrare de pontaj NU produce arhivă
-- (7)  blocarea lunii aprinde triggerul și produce arhiva
-- (8)  arhiva primește număr din registrul de documente
-- (9)  redeschiderea + reblocarea produc v2; v1 rămâne, marcată `inlocuita_de`
-- (10) o singură versiune în vigoare pe lună
-- (11) v2 are număr de registru propriu, diferit de al lui v1
-- (12) nici `org_admin` nu poate insera direct în arhivă (nicio politică INSERT)
-- (13) instantaneul nu conține CNP
-- (14) mătura lunară arhivează o lună încheiată rămasă nearhivată
-- (15) `authenticated` are pe tabelă exact dreptul SELECT
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   psql "$BANC_URL" -f tests/rls/proba-arhiva-pontaj.sql
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org_a    uuid := gen_random_uuid();
  v_org_b    uuid := gen_random_uuid();
  v_u_admin  uuid := gen_random_uuid();
  v_u_hr     uuid := gen_random_uuid();
  v_u_mgr    uuid := gen_random_uuid();
  v_u_ang    uuid := gen_random_uuid();
  v_dep_a    uuid := gen_random_uuid();
  v_poz_a    uuid := gen_random_uuid();
  v_ang_a    uuid := gen_random_uuid();
  v_dep_b    uuid := gen_random_uuid();
  v_poz_b    uuid := gen_random_uuid();
  v_ang_b    uuid := gen_random_uuid();
  v_per_a    uuid := gen_random_uuid();
  v_per_b    uuid := gen_random_uuid();
  v_per_veche uuid := gen_random_uuid();
  -- Luna de lucru: cea trecută. Încheiată, deci și mătura o vede.
  v_luna_de_la date := date_trunc('month', app.azi_local() - interval '1 month')::date;
  v_an       integer := extract(year  from date_trunc('month', app.azi_local() - interval '1 month'))::integer;
  v_luna     integer := extract(month from date_trunc('month', app.azi_local() - interval '1 month'))::integer;
  -- A doua lună, pentru mătură: acum trei luni, neblocată niciodată.
  v_veche_de_la date := date_trunc('month', app.azi_local() - interval '3 months')::date;
  v_an_v     integer := extract(year  from date_trunc('month', app.azi_local() - interval '3 months'))::integer;
  v_luna_v   integer := extract(month from date_trunc('month', app.azi_local() - interval '3 months'))::integer;
  v_vazute   int;
  v_id_v1    uuid;
  v_id_v2    uuid;
  v_nr_v1    text;
  v_nr_v2    text;
  v_continut jsonb;
  v_esecuri  int := 0;
  v_a_mers   boolean;
begin
  raise notice '';
  raise notice '  PROBA ARHIVEI LUNARE DE PONTAJ (0134)';
  raise notice '  ─────────────────────────────────────────────────────────';

  -- ── Două firme, ca izolarea să aibă ce rupe dacă e ruptă. ──
  insert into public.organizations (id, slug, name, cui) values
    (v_org_a, 'proba-arh-a-' || v_sufix, 'Proba Arhivă A SRL',
     'RO' || (87000000 + (random() * 900000)::int)::text),
    (v_org_b, 'proba-arh-b-' || v_sufix, 'Proba Arhivă B SRL',
     'RO' || (87000000 + (random() * 900000)::int)::text);

  insert into public.organization_features (organization_id, feature_key, enabled) values
    (v_org_a, 'nucleu', true), (v_org_b, 'nucleu', true),
    (v_org_a, 'attendance', true), (v_org_b, 'attendance', true)
  on conflict (organization_id, feature_key) where deleted_at is null do nothing;

  insert into auth.users (id, email) values
    (v_u_admin, 'admin-' || v_sufix || '@proba.test'),
    (v_u_hr,    'hr-'    || v_sufix || '@proba.test'),
    (v_u_mgr,   'mgr-'   || v_sufix || '@proba.test'),
    (v_u_ang,   'ang-'   || v_sufix || '@proba.test');

  insert into public.organization_members (organization_id, user_id, role) values
    (v_org_a, v_u_admin, 'org_admin'),
    (v_org_a, v_u_hr,    'hr'),
    (v_org_a, v_u_mgr,   'manager'),
    (v_org_a, v_u_ang,   'employee');

  insert into public.departments (id, organization_id, cod, denumire) values
    (v_dep_a, v_org_a, 'D1', 'Producție'),
    (v_dep_b, v_org_b, 'D1', 'Producție');

  insert into public.job_positions (id, organization_id, cod, denumire) values
    (v_poz_a, v_org_a, 'P1', 'Operator'),
    (v_poz_b, v_org_b, 'P1', 'Operator');

  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                department_id, job_position_id, hired_on, status, user_id) values
    (v_ang_a, v_org_a, '001', 'Ana',    'Popescu', v_dep_a, v_poz_a, app.azi_local() - 400, 'activ', v_u_ang),
    (v_ang_b, v_org_b, '001', 'Bogdan', 'Ionescu', v_dep_b, v_poz_b, app.azi_local() - 400, 'activ', null);

  -- ── Luna de lucru, cu pontaj în ambele firme. ──
  insert into public.attendance_periods (id, organization_id, an, luna) values
    (v_per_a, v_org_a, v_an::smallint, v_luna::smallint),
    (v_per_b, v_org_b, v_an::smallint, v_luna::smallint);

  insert into public.attendance_entries (organization_id, employee_id, data, ore_lucrate, ore_suplimentare, tip_zi) values
    (v_org_a, v_ang_a, v_luna_de_la,     8, 0, 'lucratoare'),
    (v_org_a, v_ang_a, v_luna_de_la + 1, 9, 1, 'lucratoare'),
    (v_org_b, v_ang_b, v_luna_de_la,     8, 0, 'lucratoare');

  -- ── (6) O lună fără nicio intrare NU produce arhivă. ──
  -- Se cere înainte de orice altceva: dacă funcția ar insera un rând gol, toate
  -- numărătorile de mai jos ar fi cu unu mai mari și n-am ști de ce.
  if internal.pontaj_arhiveaza_luna(v_org_a, 2019, 7, 'blocare'::public.pontaj_arhiva_motiv) is not null then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) O LUNĂ FĂRĂ PONTAJ A PRODUS ARHIVĂ. „Zero ore" e o afirmație, nu o absență.';
  else
    raise notice '  (6) luna fără pontaj nu produce arhivă .... refuzat ✓';
  end if;

  -- ── (7) Blocarea aprinde triggerul. ──
  update public.attendance_periods set status = 'blocata' where id = v_per_a;
  update public.attendance_periods set status = 'blocata' where id = v_per_b;

  select id, continut into v_id_v1, v_continut
  from public.pontaj_arhive_lunare
  where organization_id = v_org_a and an = v_an and luna = v_luna and versiune = 1;

  raise notice '  (7) blocarea a produs arhiva ............. %',
    case when v_id_v1 is null then 'NU' else 'da ✓' end;
  if v_id_v1 is null then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) BLOCAREA N-A ARHIVAT. Triggerul zz_attendance_periods_arhiveaza nu s-a aprins.';
  end if;

  -- ── (8) Numărul de registru. ──
  select numar_afisat into v_nr_v1
  from public.registru_documente
  where entitate_tip = 'pontaj_arhive_lunare' and entitate_id = v_id_v1;

  raise notice '  (8) arhiva are număr de registru ......... %', coalesce(v_nr_v1, 'LIPSĂ');
  if v_nr_v1 is null then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) ARHIVA N-A INTRAT ÎN REGISTRU. Un document fără număr nu e un document.';
  end if;

  -- ── (13) Instantaneul nu poartă CNP. ──
  if v_continut::text ilike '%cnp%' then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (13) INSTANTANEUL CONȚINE CNP. Foaia colectivă nu-l cere, iar fișierul pleacă din firmă.';
  else
    raise notice '  (13) instantaneul nu conține CNP ......... ✓';
  end if;

  -- ── (1) POARTA POZITIVĂ: org_admin. ──
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  select count(*) into v_vazute from public.pontaj_arhive_lunare where organization_id = v_org_a;
  reset role;

  raise notice '  (1) `org_admin` vede arhiva .............. % rânduri (aștept 1)', v_vazute;
  if v_vazute <> 1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) ORG_ADMIN NU-ȘI VEDE ARHIVA.';
  end if;

  -- ── (2) POARTA POZITIVĂ: hr. Cea care ar cădea cu cheia greșită. ──
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  select count(*) into v_vazute from public.pontaj_arhive_lunare where organization_id = v_org_a;
  reset role;

  raise notice '  (2) `hr` vede arhiva ..................... % rânduri (aștept 1)', v_vazute;
  if v_vazute <> 1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) HR-UL NU-ȘI VEDE ARHIVA. Exact omul care ține pontajul.';
  end if;

  -- ── (3) manager: are `attendance` doar `{read,approve}` la `team`. ──
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  select count(*) into v_vazute from public.pontaj_arhive_lunare where organization_id = v_org_a;
  reset role;

  raise notice '  (3) `manager` nu vede arhiva ............. % rânduri (aștept 0)', v_vazute;
  if v_vazute <> 0 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) MANAGERUL VEDE ARHIVA ÎNTREGII FIRME, deși are scope `team`.';
  end if;

  -- ── (4) employee. ──
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  select count(*) into v_vazute from public.pontaj_arhive_lunare where organization_id = v_org_a;
  reset role;

  raise notice '  (4) `employee` nu vede arhiva ............ % rânduri (aștept 0)', v_vazute;
  if v_vazute <> 0 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) ANGAJATUL VEDE PONTAJUL ÎNTREGII FIRME, în formă de arhivă.';
  end if;

  -- ── (5) Izolarea. ──
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  select count(*) into v_vazute from public.pontaj_arhive_lunare where organization_id = v_org_b;
  reset role;

  raise notice '  (5) nu vede arhiva celeilalte firme ...... % rânduri (aștept 0)', v_vazute;
  if v_vazute <> 0 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) IZOLARE RUPTĂ: arhiva firmei B se vede din firma A.';
  end if;

  -- ── (12) Nicio politică INSERT: nici org_admin nu poate fabrica o arhivă. ──
  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  begin
    insert into public.pontaj_arhive_lunare
      (organization_id, an, luna, motiv, continut, checksum,
       numar_angajati, total_ore, total_ore_suplimentare, total_ore_noapte)
    values (v_org_a, 2030, 1, 'blocare', '{}'::jsonb, repeat('0', 64), 0, 0, 0, 0);
    v_a_mers := true;
  exception when others then
    v_a_mers := false;
  end;
  reset role;

  raise notice '  (12) inserarea directă e refuzată ........ %',
    case when v_a_mers then 'A MERS' else 'refuzat ✓' end;
  if v_a_mers then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (12) SE POATE FABRICA O ARHIVĂ din interfață. Documentul nu mai dovedește nimic.';
  end if;

  -- ── (9) Redeschidere + reblocare = versiunea 2. ──
  update public.attendance_periods set status = 'deschisa' where id = v_per_a;
  insert into public.attendance_entries (organization_id, employee_id, data, ore_lucrate, tip_zi)
  values (v_org_a, v_ang_a, v_luna_de_la + 2, 8, 'lucratoare');
  update public.attendance_periods set status = 'blocata' where id = v_per_a;

  select id into v_id_v2
  from public.pontaj_arhive_lunare
  where organization_id = v_org_a and an = v_an and luna = v_luna and versiune = 2;

  raise notice '  (9) reblocarea a produs versiunea 2 ...... %',
    case when v_id_v2 is null then 'NU' else 'da ✓' end;
  if v_id_v2 is null then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) REBLOCAREA N-A PRODUS O VERSIUNE NOUĂ. Corecția lunii nu lasă urmă.';
  end if;

  select count(*) into v_vazute
  from public.pontaj_arhive_lunare
  where organization_id = v_org_a and an = v_an and luna = v_luna and inlocuita_de is null;

  raise notice '  (10) o singură versiune în vigoare ....... % (aștept 1)', v_vazute;
  if v_vazute <> 1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10) % versiuni în vigoare pe aceeași lună. Care e documentul?', v_vazute;
  end if;

  -- ── (11) Fiecare versiune, numărul ei. ──
  select numar_afisat into v_nr_v2
  from public.registru_documente
  where entitate_tip = 'pontaj_arhive_lunare' and entitate_id = v_id_v2;

  raise notice '  (11) v2 are număr propriu ................ % (v1: %)',
    coalesce(v_nr_v2, 'LIPSĂ'), coalesce(v_nr_v1, 'LIPSĂ');
  if v_nr_v2 is null or v_nr_v2 = v_nr_v1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (11) V2 NU ARE NUMĂR PROPRIU. Numărul nu mai identifică un conținut unic.';
  end if;

  -- ── (14) Mătura lunară. O lună încheiată, cu pontaj, neblocată niciodată. ──
  insert into public.attendance_periods (id, organization_id, an, luna)
  values (v_per_veche, v_org_a, v_an_v::smallint, v_luna_v::smallint);
  insert into public.attendance_entries (organization_id, employee_id, data, ore_lucrate, tip_zi)
  values (v_org_a, v_ang_a, v_veche_de_la, 8, 'lucratoare');

  perform internal.pontaj_arhiveaza_luni_incheiate();

  select count(*) into v_vazute
  from public.pontaj_arhive_lunare
  where organization_id = v_org_a and an = v_an_v and luna = v_luna_v
    and motiv = 'matura_lunara' and inlocuita_de is null;

  raise notice '  (14) mătura a arhivat luna neblocată ...... % (aștept 1)', v_vazute;
  if v_vazute <> 1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (14) MĂTURA N-A PRINS LUNA. Firmele care nu blochează rămân fără arhivă.';
  end if;

  -- ── (15) Granturile, nu doar politicile. ──
  -- Pe bancul local verificarea trece din oficiu: un Postgres gol n-are
  -- `alter default privileges ... grant all to authenticated`, pe care Supabase
  -- îl are. Exact de aceea `0134` a plecat pe producție cu `authenticated`
  -- purtând DELETE, INSERT, UPDATE pe o tabelă care trebuia să fie doar de
  -- citit — reparat de `0137`. Verificarea rămâne aici ca următoarea tabelă
  -- append-only să nu repete drumul: pe cloud e singura care ar cădea.
  select count(*) into v_vazute
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name   = 'pontaj_arhive_lunare'
    and grantee      = 'authenticated'
    and privilege_type <> 'SELECT';

  raise notice '  (15) `authenticated` are doar SELECT ..... % alte drepturi (aștept 0)', v_vazute;
  if v_vazute <> 0 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (15) `authenticated` are drepturi de SCRIERE pe arhivă. RLS le refuză, dar a doua barieră lipsește.';
  end if;

  raise notice '';
  if v_esecuri > 0 then
    raise exception 'PROBA A EȘUAT: % verificări nepotrivite.', v_esecuri;
  end if;
  raise notice '  PROBA A TRECUT: arhiva se produce singură, se vede de cine trebuie, nu se fabrică.';
end
$$;
