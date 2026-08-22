-- ─────────────────────────────────────────────────────────────────────────────
-- BARIERA 3 — RLS activat pe fiecare tabelă
--
-- O tabelă fără RLS într-un sistem multi-tenant este o breșă de date între
-- firme-client. Verificarea rulează pe schema aplicată, nu pe intenția din cod:
-- o tabelă adăugată într-o migrare și uitată fără `ENABLE ROW LEVEL SECURITY`
-- oprește build-ul aici.
--
-- Se verifică trei lucruri distincte:
--   1. RLS este activat pe fiecare tabelă din `public` și `app`.
--   2. `FORCE RLS` este activat peste tot MINUS o listă albă explicită.
--   3. Fiecare tabelă cu RLS are cel puțin o politică (RLS activat fără nicio
--      politică blochează totul — de obicei semnul unei migrări incomplete).
--
-- LISTA ALBĂ pentru `FORCE RLS`, cu motivul scris:
--   Tabelele citite de funcțiile helper `SECURITY DEFINER` (deținute de
--   proprietarul bazei) trebuie să rămână `NO FORCE`. Altfel helperul care
--   verifică apartenența declanșează chiar politica ce îl apelează, iar
--   Postgres cade în recursiune infinită. Excepția este deliberată și limitată
--   la tabelele de autorizare, care oricum nu conțin date de business.
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on

do $$
declare
  fara_rls text;
  fara_force text;
  fara_politici text;
  fara_grant text;
  n integer;

  -- Motivul fiecărei intrări: sunt citite de helperii SECURITY DEFINER.
  lista_alba_force text[] := array[
    'organization_members',  -- citită de app.is_member / app.has_role
    'platform_admins',       -- citită de app.is_platform_admin
    'role_permissions',      -- citită de app.has_permission
    'features'               -- citită de app.feature_on
  ];

  -- Tabele pentru care ZERO politici este starea CORECTĂ, nu o migrare uitată.
  -- RLS activat fără nicio politică înseamnă refuz total pentru `authenticated`;
  -- accesul se face exclusiv prin funcții SECURITY DEFINER.
  lista_alba_fara_politici text[] := array[
    'rate_limits',             -- contorul de limitare; un client nu are ce citi sau scrie aici
    'employee_sensitive_data'  -- CNP/IBAN: accesul trece exclusiv prin
                               -- hr_read_sensitive / hr_write_sensitive, care
                               -- auditează fiecare apel. O politică de SELECT ar
                               -- deschide o cale directă care ocolește auditul.
    ,
    'organization_sensitive_data', -- datele fiscale/bancare ale firmei-client:
                                   -- exclusiv prin org_read_sensitive /
                                   -- org_write_sensitive (SECURITY DEFINER).
                                   -- Închis deliberat în 0031 și 0032.
    'employee_marca_counters'      -- contorul de mărci per organizație: se
                                   -- incrementează atomic doar prin
                                   -- urmatoarea_marca (SECURITY DEFINER).
                                   -- O politică de UPDATE ar permite unui client
                                   -- să sară peste numerotare. Închis în 0033.
  ];

  -- Tabele pentru care ABSENȚA privilegiilor este intenționată: accesul trece
  -- obligatoriu printr-o funcție care auditează, iar un SELECT direct l-ar ocoli.
  lista_alba_fara_grant text[] := array[
    'employee_sensitive_data'  -- doar prin hr_read_sensitive / hr_write_sensitive
  ];
begin
  -- 1. RLS activat
  select count(*), string_agg(format('  %I.%I', schemaname, tablename), e'\n' order by tablename)
    into n, fara_rls
  from pg_tables t
  join pg_class c on c.relname = t.tablename
  join pg_namespace ns on ns.oid = c.relnamespace and ns.nspname = t.schemaname
  where t.schemaname in ('public', 'app')
    and not c.relrowsecurity;

  if n > 0 then
    raise exception e'BARIERA 3 A EȘUAT: % tabele fără RLS activat:\n%\n\nCorecție: alter table ... enable row level security;',
      n, fara_rls;
  end if;

  -- 2. FORCE RLS, cu excepțiile din lista albă
  select count(*), string_agg(format('  %I.%I', ns.nspname, c.relname), e'\n' order by c.relname)
    into n, fara_force
  from pg_class c
  join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname in ('public', 'app')
    and c.relkind = 'r'
    and c.relrowsecurity
    and not c.relforcerowsecurity
    and not (c.relname = any (lista_alba_force));

  if n > 0 then
    raise exception e'BARIERA 3 A EȘUAT: % tabele fără FORCE RLS și neaflate în lista albă:\n%\n\nCorecție: alter table ... force row level security; sau adaugă tabela în lista albă din acest fișier, CU MOTIVUL SCRIS.',
      n, fara_force;
  end if;

  -- 3. Fiecare tabelă cu RLS are cel puțin o politică
  select count(*), string_agg(format('  %I.%I', ns.nspname, c.relname), e'\n' order by c.relname)
    into n, fara_politici
  from pg_class c
  join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname in ('public', 'app')
    and c.relkind = 'r'
    and c.relrowsecurity
    and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
    and not (c.relname = any (lista_alba_fara_politici));

  if n > 0 then
    raise exception e'BARIERA 3 A EȘUAT: % tabele cu RLS activat dar FĂRĂ nicio politică (blochează complet accesul):\n%\n\nCorecție: adaugă politicile lipsă, sau — dacă refuzul total este intenționat — trece tabela în lista_alba_fara_politici din acest fișier, CU MOTIVUL SCRIS.',
      n, fara_politici;
  end if;

  -- 4. Tabelele cu politici trebuie să aibă și privilegii: RLS filtrează RÂNDURI,
  --    dar `GRANT` decide dacă rolul poate atinge tabela. Fără grant, politicile
  --    sunt cod mort și aplicația primește „permission denied”.
  --    `grant ... on all tables` dintr-o migrare veche NU acoperă tabelele create
  --    ulterior — exact așa au rămas descoperite cele din 0004.
  select count(*), string_agg(format('  %I.%I', ns.nspname, c.relname), e'\n' order by c.relname)
    into n, fara_grant
  from pg_class c
  join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname = 'public'
    and c.relkind = 'r'
    and c.relrowsecurity
    and exists (select 1 from pg_policy p where p.polrelid = c.oid)
    and not has_table_privilege('authenticated', c.oid, 'SELECT')
    and not (c.relname = any (lista_alba_fara_grant));

  if n > 0 then
    raise exception e'BARIERA 3 A EȘUAT: % tabele au politici RLS dar NICIUN privilegiu pentru `authenticated`:\n%\n\nPoliticile sunt cod mort — accesul e refuzat înainte de ele. Adaugă `grant select, insert, update` în migrarea care creează tabelele, sau treci tabela în lista albă cu motivul scris.',
      n, fara_grant;
  end if;

  raise notice 'Bariera 3 trecută: RLS activat, FORCE aplicat, politici prezente, privilegii acordate.';
end
$$;
