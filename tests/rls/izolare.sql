-- ─────────────────────────────────────────────────────────────────────────────
-- TESTUL DE IZOLARE ÎNTRE TENANȚI
--
-- Cel mai important test din proiect. Un singur rând scurs între două firme
-- client încheie produsul: notificare ANSPDCP în 72 de ore, reziliere
-- contractuală, reputație irecuperabilă.
--
-- DE CE ÎN SQL PUR, ȘI NU DOAR PRIN SDK:
-- PostgREST execută fiecare cerere ca `set local role authenticated` plus
-- claim-urile JWT puse în GUC-uri. Reproducem exact acel context cu
-- `set local role` + `set_config('request.jwt.claim.sub', …)`, pe care
-- `auth.uid()` îl citește. Rezultatul este fidel, dar rulează pe orice Postgres,
-- fără GoTrue, fără Docker și fără proiect în cloud — deci poate rula la FIECARE
-- pull request, nu doar când cineva își amintește să configureze mediul.
--
-- Testele care chiar cer GoTrue (parole, magic link, invitații end-to-end)
-- rămân în `tests/rls/*.test.ts`, pe proiectul Supabase de test.
--
-- Rulare:
--   psql "$URL" -v ON_ERROR_STOP=1 -f tests/rls/izolare.sql
-- Ieșire diferită de zero = izolarea este ruptă.
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on
\timing off

begin;

-- ── Pregătire: două organizații complete, cu membri în fiecare ───────────────
-- Rulează ca proprietar (ocolește RLS), exact ca `service_role` la seed.

create temporary table t_ids (cheie text primary key, val uuid);

do $$
declare
  v_alfa uuid := gen_random_uuid();
  v_beta uuid := gen_random_uuid();
  v_admin_alfa uuid := gen_random_uuid();
  v_emp_alfa   uuid := gen_random_uuid();
  v_admin_beta uuid := gen_random_uuid();
  v_emp_beta   uuid := gen_random_uuid();
begin
  insert into t_ids values
    ('alfa', v_alfa), ('beta', v_beta),
    ('admin_alfa', v_admin_alfa), ('emp_alfa', v_emp_alfa),
    ('admin_beta', v_admin_beta), ('emp_beta', v_emp_beta);

  insert into auth.users (id, email) values
    (v_admin_alfa, 'admin@alfa.test'), (v_emp_alfa, 'angajat@alfa.test'),
    (v_admin_beta, 'admin@beta.test'), (v_emp_beta, 'angajat@beta.test');

  insert into public.profiles (id, email, full_name) values
    (v_admin_alfa, 'admin@alfa.test',   'Administrator Alfa'),
    (v_emp_alfa,   'angajat@alfa.test', 'Angajat Alfa'),
    (v_admin_beta, 'admin@beta.test',   'Administrator Beta'),
    (v_emp_beta,   'angajat@beta.test', 'Angajat Beta')
  on conflict (id) do nothing;

  insert into public.organizations (id, slug, name, legal_name, cui, judet, oras, status)
  values
    (v_alfa, 'alfa', 'Alfa SRL', 'ALFA SRL', 'RO12345678', 'Cluj', 'Cluj-Napoca', 'active'),
    (v_beta, 'beta', 'Beta SRL', 'BETA SRL', 'RO87654321', 'Timiș', 'Timișoara', 'active');

  insert into public.organization_members (organization_id, user_id, role, status, joined_at) values
    (v_alfa, v_admin_alfa, 'org_admin', 'active', now()),
    (v_alfa, v_emp_alfa,   'employee',  'active', now()),
    (v_beta, v_admin_beta, 'org_admin', 'active', now()),
    (v_beta, v_emp_beta,   'employee',  'active', now());

  -- Alfa are „leave" activ, Beta nu: verificăm și feature flag-ul, nu doar tenantul.
  insert into public.organization_features (organization_id, feature_key, enabled)
  values (v_alfa, 'leave', true), (v_beta, 'leave', false);

  insert into public.organization_branding (organization_id, denumire_afisata)
  values (v_alfa, 'Alfa'), (v_beta, 'Beta');

  -- Cel puțin un rând PENTRU FIECARE organizație în fiecare tabelă verificată.
  -- Fără asta, testul ar trece fals-pozitiv pe tabelele goale.
  insert into public.audit_logs (organization_id, actor_id, action, status)
  values (v_alfa, v_admin_alfa, 'create', 'success'),
         (v_beta, v_admin_beta, 'create', 'success');

  insert into public.notifications (organization_id, user_id, kind, title)
  values (v_alfa, v_emp_alfa, 'info', 'Notificare Alfa'),
         (v_beta, v_emp_beta, 'info', 'Notificare Beta');

  insert into public.invitations (organization_id, email, role, token_hash, expires_at, invited_by)
  values (v_alfa, 'nou@alfa.test', 'employee', encode(sha256('alfa'::bytea), 'hex'), now() + interval '7 days', v_admin_alfa),
         (v_beta, 'nou@beta.test', 'employee', encode(sha256('beta'::bytea), 'hex'), now() + interval '7 days', v_admin_beta);
end
$$;

-- ── Utilitare de asertare ────────────────────────────────────────────────────

create or replace function pg_temp.esueaza(p_mesaj text) returns void
language plpgsql as $$
begin
  raise exception 'IZOLARE RUPTĂ: %', p_mesaj using errcode = 'P0001';
end $$;

create or replace function pg_temp.id(p_cheie text) returns uuid
language sql stable as $$ select val from t_ids where cheie = p_cheie $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (a) RLS activat pe fiecare tabelă
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare v text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into v
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'app') and c.relkind = 'r' and not c.relrowsecurity;
  if v is not null then perform pg_temp.esueaza(format('(a) tabele fără RLS: %s', v)); end if;
  raise notice '(a) RLS activat pe toate tabelele ✓';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (b) FORCE RLS, minus lista albă comisă cu motiv
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v text;
  -- Aceste patru tabele sunt citite de helperii SECURITY DEFINER. Cu FORCE,
  -- helperul ar declanșa chiar politica ce îl apelează ⇒ recursiune infinită.
  lista_alba text[] := array['organization_members','platform_admins','role_permissions','features'];
begin
  select string_agg(c.relname, ', ' order by c.relname) into v
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public','app') and c.relkind = 'r'
    and c.relrowsecurity and not c.relforcerowsecurity
    and not (c.relname = any (lista_alba));
  if v is not null then perform pg_temp.esueaza(format('(b) fără FORCE și în afara listei albe: %s', v)); end if;
  raise notice '(b) FORCE RLS aplicat, cu lista albă respectată ✓';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (c) Utilizatorul din Alfa nu poate CITI niciun rând al lui Beta
--
-- Parcurge automat FIECARE tabelă cu `organization_id`. O tabelă adăugată mâine
-- intră singură în test — nimeni nu trebuie să-și amintească să o adauge.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  t record;
  n bigint;
  v_beta uuid := pg_temp.id('beta');
  v_actor uuid := pg_temp.id('admin_alfa');
  probleme text := '';
  verificate int := 0;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace nsp on nsp.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'organization_id'
                       and a.attnum > 0 and not a.attisdropped
    where nsp.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  loop
    -- Sanity: tabela chiar conține rânduri ale lui Beta? Altfel testul ar trece
    -- degeaba, iar asta e mai periculos decât un test roșu.
    execute format('select count(*) from public.%I where organization_id = $1', t.relname)
      into n using v_beta;
    if n = 0 then continue; end if;
    verificate := verificate + 1;

    perform set_config('request.jwt.claim.sub', v_actor::text, true);
    set local role authenticated;
    execute format('select count(*) from public.%I where organization_id = $1', t.relname)
      into n using v_beta;
    reset role;

    if n > 0 then
      probleme := probleme || format(E'\n  %s: %s rânduri ale lui Beta vizibile', t.relname, n);
    end if;
  end loop;

  if probleme <> '' then perform pg_temp.esueaza('(c) SCURGERE LA CITIRE:' || probleme); end if;
  if verificate = 0 then perform pg_temp.esueaza('(c) nicio tabelă verificată — fixture-ul nu populează nimic'); end if;
  raise notice '(c) niciun rând al lui Beta vizibil din Alfa (% tabele verificate) ✓', verificate;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (d) INSERT cu organization_id-ul altei organizații este refuzat
--
-- La fel de grav ca citirea, și mai ușor de uitat: o politică poate avea USING
-- corect și WITH CHECK absent.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_beta uuid := pg_temp.id('beta');
  v_actor uuid := pg_temp.id('admin_alfa');
  reusit boolean := false;
begin
  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  set local role authenticated;
  begin
    insert into public.notifications (organization_id, user_id, kind, title)
    values (v_beta, v_actor, 'info', 'injectat din Alfa');
    reusit := true;
  exception when insufficient_privilege or others then
    reusit := false;
  end;
  reset role;

  if reusit then perform pg_temp.esueaza('(d) INSERT cross-tenant a REUȘIT în notifications'); end if;
  raise notice '(d) INSERT cu organizația altcuiva refuzat ✓';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (e) UPDATE pe un rând al altei organizații nu are efect
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_beta uuid := pg_temp.id('beta');
  v_actor uuid := pg_temp.id('admin_alfa');
  afectate int;
begin
  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  set local role authenticated;
  begin
    update public.organizations set name = 'DETURNAT' where id = v_beta;
    get diagnostics afectate = row_count;
  exception when others then
    afectate := 0;
  end;
  reset role;

  if afectate > 0 then perform pg_temp.esueaza('(e) UPDATE cross-tenant a modificat rânduri în organizations'); end if;
  if (select name from public.organizations where id = v_beta) <> 'Beta SRL' then
    perform pg_temp.esueaza('(e) numele organizației Beta a fost modificat din Alfa');
  end if;
  raise notice '(e) UPDATE pe rândurile altei organizații fără efect ✓';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (f) Fără politici DELETE, și DELETE revocat de la `authenticated`
--
-- Soft delete peste tot ⇒ absența politicii PLUS revocarea este regula corectă,
-- nu o omisiune. Aserțiunea este deci inversată față de celelalte.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare v text;
begin
  select string_agg(format('%s.%s', c.relname, p.polname), ', ')
    into v
  from pg_policy p join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public','app') and p.polcmd = 'd';
  if v is not null then perform pg_temp.esueaza(format('(f) există politici DELETE: %s', v)); end if;

  select string_agg(c.relname, ', ' order by c.relname) into v
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and has_table_privilege('authenticated', c.oid, 'DELETE');
  if v is not null then perform pg_temp.esueaza(format('(f) DELETE nerevocat pentru authenticated: %s', v)); end if;

  raise notice '(f) fără politici DELETE și DELETE revocat ✓';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (g) Fiecare view are `security_invoker`
--
-- O view obișnuită rulează cu drepturile creatorului și ocolește RLS-ul
-- tabelelor sursă — o poartă laterală perfect tăcută.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare v text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into v
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public','app') and c.relkind = 'v'
    and coalesce(array_to_string(c.reloptions, ','), '') not like '%security_invoker=%on%'
    and coalesce(array_to_string(c.reloptions, ','), '') not like '%security_invoker=true%';
  if v is not null then perform pg_temp.esueaza(format('(g) view-uri fără security_invoker: %s', v)); end if;
  raise notice '(g) toate view-urile au security_invoker ✓';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (h) Fiecare funcție SECURITY DEFINER are `search_path = ''`
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare v text;
begin
  select string_agg(format('%s.%s', n.nspname, p.proname), ', ') into v
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public','app','internal') and p.prosecdef
    and coalesce((select split_part(c, '=', 2) from unnest(p.proconfig) c
                  where c like 'search_path=%'), '(nesetat)') <> '""';
  if v is not null then perform pg_temp.esueaza(format('(h) SECURITY DEFINER fără search_path='''': %s', v)); end if;
  raise notice '(h) toate funcțiile SECURITY DEFINER au search_path = '''' ✓';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (i) Un modul dezactivat chiar refuză, nu doar dispare din meniu
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_alfa uuid := pg_temp.id('alfa');
  v_beta uuid := pg_temp.id('beta');
  v_actor uuid := pg_temp.id('admin_alfa');
begin
  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  set local role authenticated;
  if not app.feature_on(v_alfa, 'leave') then
    reset role;
    perform pg_temp.esueaza('(i) modulul „leave" este activ pentru Alfa dar feature_on întoarce fals');
  end if;
  if app.feature_on(v_beta, 'leave') then
    reset role;
    perform pg_temp.esueaza('(i) modulul „leave" este DEZACTIVAT pentru Beta dar feature_on întoarce adevărat');
  end if;
  -- Nucleul este mereu activ, prin `features.is_core`, nu prin comparație cu un literal.
  if not app.feature_on(v_beta, 'nucleu') then
    reset role;
    perform pg_temp.esueaza('(i) modulul de nucleu ar trebui să fie mereu activ');
  end if;
  reset role;
  raise notice '(i) feature flags respectate server-side ✓';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (j) `scope = 'none'` este refuz explicit, iar managerul nu vede salarii
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v public.permission_scope;
  v_alfa uuid := pg_temp.id('alfa');
  v_beta uuid := pg_temp.id('beta');
  v_actor uuid := pg_temp.id('admin_alfa');
begin
  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  set local role authenticated;

  v := app.has_permission(v_alfa, 'employees', 'read');
  if v <> 'all' then reset role; perform pg_temp.esueaza(format('(j) org_admin ar trebui să aibă employees:read=all, are %s', v)); end if;

  v := app.has_permission(v_alfa, 'organizations', 'delete');
  if v <> 'none' then reset role; perform pg_temp.esueaza(format('(j) org_admin nu are voie să șteargă organizații, are %s', v)); end if;

  -- O permisiune cerută pentru o organizație în care nu e membru: refuz.
  v := app.has_permission(v_beta, 'employees', 'read');
  if v <> 'none' then reset role; perform pg_temp.esueaza(format('(j) permisiune acordată într-o organizație străină: %s', v)); end if;

  reset role;
  raise notice '(j) matricea de permisiuni respectată, inclusiv refuzul explicit ✓';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (k) Gărzile chiar blochează coloanele rezervate platformei
--
-- Aici a fost gaura reală: `is_service_context()` întorcea true pentru orice
-- apelant, iar toate gărzile ieșeau pe prima linie.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_alfa uuid := pg_temp.id('alfa');
  v_actor uuid := pg_temp.id('admin_alfa');
  v_plan public.plan_type;
  v_seats integer;
begin
  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  set local role authenticated;
  begin
    update public.organizations
      set plan = 'enterprise', seats_limit = 100000, status = 'active'
      where id = v_alfa;
  exception when others then null;
  end;
  reset role;

  select plan, seats_limit into v_plan, v_seats from public.organizations where id = v_alfa;
  if v_plan = 'enterprise' then
    perform pg_temp.esueaza('(k) un org_admin și-a schimbat singur planul — garda de coloane este moartă');
  end if;
  if v_seats = 100000 then
    perform pg_temp.esueaza('(k) un org_admin și-a ridicat singur plafonul de locuri');
  end if;
  raise notice '(k) coloanele rezervate platformei rămân blocate pentru org_admin ✓';
end $$;

rollback;

\echo ''
\echo '════════════════════════════════════════════════════════'
\echo ' IZOLAREA ÎNTRE TENANȚI: toate verificările au trecut.'
\echo '════════════════════════════════════════════════════════'
