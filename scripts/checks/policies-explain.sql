-- ─────────────────────────────────────────────────────────────────────────────
-- BARIERA 2 — fiecare politică RLS și fiecare funcție referă doar obiecte reale
--
-- Postgres nu validează corpul unei funcții PL/pgSQL la creare. O funcție care
-- referă o coloană inexistentă se creează fără nicio plângere și cade abia la
-- primul apel — adică în producție, la primul utilizator.
--
-- Politicile RLS sunt validate la creare, dar o coloană poate fi ștearsă sau
-- redenumită ulterior. Reevaluarea expresiilor prin `pg_get_expr` forțează
-- Postgres să le re-parseze și eșuează dacă vreo referință s-a rupt.
--
-- Verificarea suplimentară cu `plpgsql_check` rulează doar dacă extensia este
-- disponibilă; nu o facem obligatorie, pentru că nu e garantată pe Supabase.
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on

-- 1. Re-parsează expresiile fiecărei politici (USING și WITH CHECK).
do $$
declare
  r record;
  expresie text;
begin
  for r in
    select p.oid, p.polname, c.relname, n.nspname
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'app')
  loop
    begin
      expresie := pg_get_expr(
        (select polqual from pg_policy where oid = r.oid), r.oid::regclass
      );
      expresie := pg_get_expr(
        (select polwithcheck from pg_policy where oid = r.oid), r.oid::regclass
      );
    exception when others then
      raise exception 'BARIERA 2 A EȘUAT: politica %.%.% nu se poate reevalua: %',
        r.nspname, r.relname, r.polname, sqlerrm;
    end;
  end loop;

  raise notice 'Bariera 2: toate politicile RLS se reevaluează corect.';
end
$$;

-- 2. Verifică corpul funcțiilor PL/pgSQL, dacă `plpgsql_check` există.
do $$
declare
  are_extensia boolean;
  r record;
  problema record;
  gasite integer := 0;
begin
  select exists (select 1 from pg_available_extensions where name = 'plpgsql_check')
    into are_extensia;

  if not are_extensia then
    raise notice 'plpgsql_check indisponibil — verificarea corpului funcțiilor se sare. Vezi NOTES.md.';
    return;
  end if;

  create extension if not exists plpgsql_check;

  for r in
    select p.oid::regprocedure as fn
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where n.nspname in ('public', 'app', 'internal')
      and l.lanname = 'plpgsql'
  loop
    for problema in
      execute format('select * from plpgsql_check_function(%L, performance_warnings := false)', r.fn)
    loop
      raise warning 'plpgsql_check %: %', r.fn, problema;
      gasite := gasite + 1;
    end loop;
  end loop;

  if gasite > 0 then
    raise exception 'BARIERA 2 A EȘUAT: % probleme găsite de plpgsql_check în corpul funcțiilor.', gasite;
  end if;

  raise notice 'Bariera 2: plpgsql_check nu a găsit probleme.';
end
$$;
