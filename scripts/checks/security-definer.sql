-- ─────────────────────────────────────────────────────────────────────────────
-- BARIERA 1 — funcții SECURITY DEFINER fără search_path controlat
--
-- O funcție `SECURITY DEFINER` rulează cu drepturile proprietarului. Dacă
-- `search_path` nu este fixat, un utilizator autentificat își poate crea în
-- `pg_temp` o funcție sau un tabel cu numele celui folosit înăuntru, iar funcția
-- privilegiată îl va apela pe al lui. Rezultatul este escaladare de privilegii
-- cu drepturi de proprietar al bazei.
--
-- `search_path = public` NU este suficient: `pg_temp` este căutat implicit
-- înaintea schemelor listate. Singura formă corectă este `SET search_path = ''`
-- împreună cu nume complet calificate (`public.employees`, nu `employees`).
--
-- Acest fișier eșuează build-ul dacă găsește măcar o funcție neconformă.
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on

do $$
declare
  vinovate text;
  numar integer;
begin
  -- Singura formă acceptată este `SET search_path = ''`, pe care Postgres o
  -- stochează în `proconfig` drept `search_path=""`.
  --
  -- `search_path=public` NU trece, deliberat: `pg_temp` rămâne căutat implicit
  -- ÎNAINTEA schemelor listate, deci un utilizator autentificat își poate crea
  -- acolo un obiect cu numele celui folosit în funcție, iar funcția privilegiată
  -- îl va folosi pe al lui. Este exact vectorul pe care bariera trebuie să-l
  -- oprească, așa că verificarea cere valoarea goală, nu simpla prezență a
  -- cuvântului `search_path`.
  select count(*),
         string_agg(format('  %I.%I(%s)  →  search_path=%s',
                           n.nspname, p.proname,
                           pg_get_function_identity_arguments(p.oid),
                           coalesce(
                             (select split_part(c, '=', 2)
                              from unnest(p.proconfig) c
                              where c like 'search_path=%'),
                             '(nesetat)')),
                    e'\n' order by n.nspname, p.proname)
    into numar, vinovate
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'app', 'internal')
    and p.prosecdef
    and coalesce(
          (select split_part(c, '=', 2) from unnest(p.proconfig) c where c like 'search_path=%'),
          '(nesetat)'
        ) <> '""';

  if numar > 0 then
    raise exception e'BARIERA 1 A EȘUAT: % funcții SECURITY DEFINER fără `search_path = ''''`:\n%\n\nCorecție: adaugă `SET search_path = ''''` la definiția funcției și califică toate numele (public.employees, nu employees).\nAtenție: `search_path = public` NU este sigur — pg_temp este căutat înaintea lui.',
      numar, vinovate;
  end if;

  raise notice 'Bariera 1 trecută: toate funcțiile SECURITY DEFINER au search_path = ''''.';
end
$$;
