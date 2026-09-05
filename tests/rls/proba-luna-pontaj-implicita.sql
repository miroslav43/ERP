-- tests/rls/proba-luna-pontaj-implicita.sql
--
-- POARTA POZITIVĂ a lunii de pontaj (0132): nu „nimeni nu scrie într-o lună
-- blocată", ci „angajatul CHIAR poate ponta într-o lună pe care n-a deschis-o
-- nimeni".
--
-- ── DEFECTUL PE CARE ÎL ȚINE ÎNCHIS ─────────────────────────────────────────
-- `internal.pontaj_intrare_pregateste` (0013:288) ridica P0001 pentru orice
-- scriere într-o lună fără rând în `attendance_periods`. Pe drumul manual asta
-- se vedea, ca eroare pe ecran. Pe drumul concediului NU se vedea deloc:
-- aprobarea sincronizează zilele într-un `try` best-effort
-- (`concedii/actions.ts:250`), tocmai ca pontajul să nu dea aprobarea înapoi.
-- Concediul cerut pentru o lună viitoare se aproba, zilele nu intrau în foaia
-- de prezență, iar `0` întors însemna deopotrivă „nicio zi păstrată" și
-- „sincronizarea n-a rulat".
--
-- ── DE CE NU AJUNGE SĂ VERIFICI CĂ LUNA BLOCATĂ REFUZĂ ──────────────────────
-- Refuzul funcționa și înainte, prin faptul că refuza tot. Verificările (1) și
-- (5) sunt singurele care ar fi căzut înainte de 0132. Restul le încadrează, ca
-- deschiderea implicită să nu fi devenit o portiță: (4) păzește politica de
-- INSERT pe perioade, (3) păzește sigilarea trecutului.
--
-- ── CE VERIFICĂ, PE RÂND ────────────────────────────────────────────────────
-- (1) un `employee` pontează într-o lună viitoare inexistentă, iar perioada se
--     naște singură, cu status `deschisa`;
-- (2) a doua zi pontată în aceeași lună NU creează o a doua perioadă;
-- (3) luna închisă de `org_admin` refuză în continuare scrierea (P0001) —
--     nimic închis nu se redeschide de la sine;
-- (4) `employee` tot NU poate insera direct un rând în `attendance_periods`
--     (42501): nașterea automată trece prin trigger, nu prin politică lărgită;
-- (5) `app.sincronizeaza_pontaj_concedii` pe o lună inexistentă o creează în
--     loc să ridice P0001 — drumul pe care se pierdea concediul;
-- (6) perioada născută automat aparține firmei A; firma B nu vede nimic.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh --pastreaza
--   PORT=$(docker ps --filter name=administrativo-banc --format '{{.Ports}}' \
--          | grep -oE '0.0.0.0:[0-9]+' | head -1 | cut -d: -f2)
--   psql "postgresql://postgres:banc@localhost:$PORT/postgres" -f tests/rls/proba-luna-pontaj-implicita.sql
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  -- Sufix unic pe rulare: proba trebuie să poată fi repetată pe același banc.
  v_sufix     text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org_a     uuid := gen_random_uuid();
  v_org_b     uuid := gen_random_uuid();
  v_u_ang     uuid := gen_random_uuid();
  v_u_admin   uuid := gen_random_uuid();
  v_e_ang     uuid;
  -- Luni alese departe în viitor, ca proba să nu depindă de data rulării și să
  -- nu se ciocnească de perioade lăsate de alte probe pe același banc.
  v_an        smallint := 2087;
  v_luna_noua smallint := 3;   -- (1) și (2): se naște singură
  v_luna_inch smallint := 5;   -- (3): închisă explicit
  v_luna_conc smallint := 7;   -- (5): creată de RPC-ul de concedii
  v_perioade  int;
  v_status    public.attendance_period_status;
  v_esecuri   int := 0;
  v_cod       text;
begin
  raise notice '';
  raise notice '  PROBA „LUNA DE PONTAJ SE NAȘTE DESCHISĂ" (0132)';
  raise notice '  ─────────────────────────────────────────────────────────';

  -- ── Două firme, ca izolarea să aibă ce rupe dacă e ruptă. ──
  insert into public.organizations (id, slug, name, cui) values
    (v_org_a, 'proba-luna-a-' || v_sufix, 'Proba Luna A SRL',
     'RO' || (89000000 + (random() * 900000)::int)::text),
    (v_org_b, 'proba-luna-b-' || v_sufix, 'Proba Luna B SRL',
     'RO' || (89000000 + (random() * 900000)::int)::text);

  insert into public.organization_features (organization_id, feature_key, enabled) values
    (v_org_a, 'nucleu', true), (v_org_a, 'attendance', true), (v_org_a, 'leave', true),
    (v_org_b, 'nucleu', true), (v_org_b, 'attendance', true)
  on conflict (organization_id, feature_key) where deleted_at is null do nothing;

  insert into auth.users (id, email) values
    (v_u_ang,   'angajat-' || v_sufix || '@proba.test'),
    (v_u_admin, 'admin-'   || v_sufix || '@proba.test');

  insert into public.organization_members (organization_id, user_id, role) values
    (v_org_a, v_u_ang,   'employee'),
    (v_org_a, v_u_admin, 'org_admin');

  -- `is_primary` explicit: `app.current_employee_id` chiar îl cere, iar o fișă
  -- secundară ar face `app.poate_scrie_pontaj` să refuze din alt motiv decât
  -- cel probat.
  insert into public.employees (organization_id, marca, first_name, last_name, user_id, is_primary)
    values (v_org_a, 'A-' || v_sufix, 'Ana', 'Angajat', v_u_ang, true)
    returning id into v_e_ang;

  -- ── (1) POARTA POZITIVĂ. Singura care cădea înainte de 0132. ──
  -- `period_id` și `tip_zi` NU se trimit: le pune triggerul BEFORE (capcana 6).
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  insert into public.attendance_entries (organization_id, employee_id, data, ore_lucrate)
    values (v_org_a, v_e_ang, make_date(v_an::int, v_luna_noua::int, 10), 8);
  reset role;

  select count(*), max(p.status) into v_perioade, v_status
    from public.attendance_periods p
   where p.organization_id = v_org_a and p.an = v_an and p.luna = v_luna_noua
     and p.deleted_at is null;

  raise notice '  (1) angajatul pontează în luna nedeschisă .. % perioade, status % (aștept 1 / deschisa)',
    v_perioade, coalesce(v_status::text, '—');
  if v_perioade <> 1 or v_status is distinct from 'deschisa' then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) luna nu s-a născut deschisă — concediul viitor rămâne în afara pontajului.';
  end if;

  -- ── (2) A doua zi din aceeași lună NU dublează perioada. ──
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  insert into public.attendance_entries (organization_id, employee_id, data, ore_lucrate)
    values (v_org_a, v_e_ang, make_date(v_an::int, v_luna_noua::int, 11), 8);
  reset role;

  select count(*) into v_perioade
    from public.attendance_periods p
   where p.organization_id = v_org_a and p.an = v_an and p.luna = v_luna_noua
     and p.deleted_at is null;

  raise notice '  (2) a doua zi din aceeași lună ............ % perioade (aștept 1)', v_perioade;
  if v_perioade <> 1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) perioada s-a dublat — indexul parțial nu a fost respectat de ON CONFLICT.';
  end if;

  -- ── (3) Luna închisă rămâne închisă. ──
  -- Blocarea o face `org_admin`: `internal.pontaj_perioada_tranzitie` cere
  -- `attendance:approve = all` pentru orice trecere spre `blocata`.
  insert into public.attendance_periods (organization_id, an, luna)
    values (v_org_a, v_an, v_luna_inch);

  perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
  set local role authenticated;
  update public.attendance_periods set status = 'blocata'
   where organization_id = v_org_a and an = v_an and luna = v_luna_inch;
  reset role;

  v_cod := null;
  begin
    perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
    set local role authenticated;
    insert into public.attendance_entries (organization_id, employee_id, data, ore_lucrate)
      values (v_org_a, v_e_ang, make_date(v_an::int, v_luna_inch::int, 10), 8);
    reset role;
  exception when others then
    v_cod := sqlstate;
    reset role;
  end;

  raise notice '  (3) luna închisă refuză scrierea ......... % (aștept P0001)', coalesce(v_cod, 'NICIO EROARE');
  if v_cod is distinct from 'P0001' then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) luna închisă a acceptat pontaj — sigilarea trecutului nu mai ține.';
  end if;

  -- ── (4) Politica de INSERT pe perioade NU s-a lărgit. ──
  v_cod := null;
  begin
    perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
    set local role authenticated;
    insert into public.attendance_periods (organization_id, an, luna)
      values (v_org_a, v_an, 11);
    reset role;
  exception when others then
    v_cod := sqlstate;
    reset role;
  end;

  raise notice '  (4) employee NU poate deschide o lună ..... % (aștept 42501)', coalesce(v_cod, 'NICIO EROARE');
  if v_cod is distinct from '42501' then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) nașterea automată a devenit o portiță în attendance_periods_insert.';
  end if;

  -- ── (5) Sincronizarea concediilor pe o lună inexistentă. ──
  -- Fără zile de concediu: se probează GARDA, nu upsert-ul. Înainte de 0132,
  -- apelul cădea aici cu P0001, iar aprobarea înghițea eroarea în tăcere.
  v_cod := null;
  begin
    perform set_config('request.jwt.claim.sub', v_u_admin::text, true);
    set local role authenticated;
    perform * from app.sincronizeaza_pontaj_concedii(v_org_a, v_an, v_luna_conc);
    reset role;
  exception when others then
    v_cod := sqlstate;
    reset role;
  end;

  select count(*) into v_perioade
    from public.attendance_periods p
   where p.organization_id = v_org_a and p.an = v_an and p.luna = v_luna_conc
     and p.deleted_at is null;

  raise notice '  (5) sincronizarea creează luna ............ % perioade, eroare % (aștept 1 / niciuna)',
    v_perioade, coalesce(v_cod, '—');
  if v_perioade <> 1 or v_cod is not null then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) concediul aprobat pe o lună nedeschisă se pierde în continuare.';
  end if;

  -- ── (6) Izolarea între firme-client nu s-a mișcat. ──
  select count(*) into v_perioade
    from public.attendance_periods p
   where p.organization_id = v_org_b and p.an = v_an and p.deleted_at is null;

  raise notice '  (6) firma vecină rămâne fără perioade ..... % (aștept 0)', v_perioade;
  if v_perioade <> 0 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) perioada s-a născut în firma greșită.';
  end if;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri = 0 then
    raise notice '  ✓ 6/6 — luna se naște deschisă, trecutul închis rămâne închis.';
  else
    raise exception '  ✗ % verificări picate din 6.', v_esecuri;
  end if;
end
$$;
