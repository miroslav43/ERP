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
  avertismente integer := 0;
begin
  select exists (select 1 from pg_available_extensions where name = 'plpgsql_check')
    into are_extensia;

  if not are_extensia then
    raise notice 'plpgsql_check indisponibil — verificarea corpului funcțiilor se sare. Vezi NOTES.md.';
    return;
  end if;

  -- În schema `extensions`, nu în `public`: altfel cele ~20 de funcții ale
  -- extensiei ajung în tipurile generate și în suprafața expusă prin PostgREST.
  create schema if not exists extensions;
  create extension if not exists plpgsql_check with schema extensions;
  perform set_config('search_path', 'extensions, public', true);

  -- O funcție de trigger nu poate fi verificată în gol: corpul ei referă `new`
  -- și `old`, al căror tip depinde de tabela pe care este atașată. `plpgsql_check`
  -- cere de aceea parametrul `relid`. Fără el eșuează cu „missing trigger
  -- relation" — ceea ce arată ca o problemă de schemă, dar este doar un apel
  -- incomplet.
  --
  -- Fiecare funcție se verifică deci o dată PENTRU FIECARE tabelă pe care este
  -- atașată; funcțiile de trigger neatașate nicăieri se sar, fiindcă nu există
  -- context în care să le validăm.
  for r in
    select p.oid::regprocedure as fn,
           t.tgrelid::regclass  as rel
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    join pg_type rt on rt.oid = p.prorettype
    left join pg_trigger t on t.tgfoid = p.oid and not t.tgisinternal
    where n.nspname in ('public', 'app', 'internal')
      and l.lanname = 'plpgsql'
      -- funcțiile normale trec o dată (rel este NULL);
      -- cele de trigger trec o dată per tabelă atașată, și se sar dacă niciuna
      and (rt.typname <> 'trigger' or t.tgrelid is not null)
  loop
    -- Varianta `_tb` întoarce coloane structurate (level, message, detail), spre
    -- deosebire de cea textuală care livrează fiecare linie de context ca rând
    -- separat. Fără ea nu se poate distinge o eroare de un avertisment, iar
    -- bariera ar cădea la primul cast implicit — adică mereu.
    for problema in
      execute case
        when r.rel is null then
          format('select level, message, detail, context from plpgsql_check_function_tb(%L, performance_warnings := false)', r.fn)
        else
          format('select level, message, detail, context from plpgsql_check_function_tb(%L, relid := %L::regclass, performance_warnings := false)',
                 r.fn, r.rel)
      end
    loop
      if problema.level = 'error' then
        raise warning 'EROARE % (pe %): % — %',
          r.fn, coalesce(r.rel::text, '—'), problema.message, coalesce(problema.detail, '');
        gasite := gasite + 1;
      else
        avertismente := avertismente + 1;
      end if;
    end loop;
  end loop;

  if gasite > 0 then
    raise exception 'BARIERA 2 A EȘUAT: % erori găsite de plpgsql_check în corpul funcțiilor.', gasite;
  end if;

  if avertismente > 0 then
    raise notice 'Bariera 2: plpgsql_check — 0 erori, % avertismente (nu blochează).', avertismente;
  else
    raise notice 'Bariera 2: plpgsql_check nu a găsit nimic.';
  end if;
end
$$;
