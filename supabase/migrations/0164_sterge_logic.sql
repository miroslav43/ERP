-- supabase/migrations/0164_sterge_logic.sql
--
-- ȘTERGEREA LOGICĂ PE TABELELE A CĂROR POLITICĂ SELECT ASCUNDE RÂNDUL ȘTERS.
--
-- ── DEFECTUL ────────────────────────────────────────────────────────────────
-- `update … set deleted_at = now() where id = …`, dat ca `authenticated`, pică
-- ÎNTOTDEAUNA cu 42501 „new row violates row-level security policy” dacă toate
-- politicile SELECT ale tabelei cer `deleted_at is null`: clauza WHERE citește
-- coloane, deci Postgres verifică și rândul NOU contra politicii SELECT, iar
-- rândul nou e tocmai cel ascuns. Cu sau fără RETURNING — verificat pe
-- Postgres 17 la 0162, unde s-a găsit prima dată (șabloanele de evaluare).
--
-- Inventarul din 6 oct 2026, pe baza din cloud: 50 de tabele au forma asta;
-- șapte dintre ele sunt șterse logic din aplicație prin clientul utilizatorului,
-- deci șapte acțiuni care nu funcționau deloc:
--
--   inrolare_ciorne        angajati/nou/actions.ts         renunțarea la ciornă
--   role_permissions       angajati/[id]/permisiuni        retragerea unei suprascrieri
--   hr_document_templates  angajati/sabloane-documente     „Revino la varianta de platformă”
--   kpi_indicatori         evaluari/kpi                    indicator scos din set
--   kpi_tinte_angajat      evaluari/kpi                    ținta scoasă
--   kpi_seturi             evaluari/kpi                    compensarea la creare eșuată
--   kpi_evaluari_lunare    evaluari/kpi                    compensarea la deschidere eșuată
--
-- Ultimele două înghițeau eroarea (`await` fără citirea rezultatului), deci
-- compensarea nu avea loc și rămânea exact cochilia pe care trebuia s-o curețe.
--
-- ── DE CE O SINGURĂ FUNCȚIE, CARE CITEȘTE POLITICILE ────────────────────────
-- Șapte funcții scrise de mână ar fi repetat șapte politici UPDATE, fiecare
-- liberă să diveargă de originalul ei la următoarea migrare de politici.
-- `public.sterge_logic` evaluează CHIAR politicile tabelei, citite din
-- `pg_policies` în momentul apelului:
--   · rândul trebuie să treacă SELECT (cel vechi) și UPDATE `USING` — exact ce
--     ar fi cerut RLS-ul pentru UPDATE;
--   · după modificare, rândul trebuie să treacă UPDATE `WITH CHECK`;
--   · singurul lucru ocolit e verificarea SELECT pe rândul NOU — adică exact
--     defectul, nimic altceva.
-- Predicatele se evaluează pentru apelant fiindcă depind de `auth.uid()` (din
-- `request.jwt.claims`), nu de `current_user`, iar asta rămâne la fel într-o
-- funcție SECURITY DEFINER.
--
-- Lista de tabele e FIXĂ. Funcția nu e o ușă generală de scriere: pentru o
-- tabelă nouă, lista se extinde printr-o migrare, după ce se verifică.
-- `evaluation_templates` rămâne pe funcția ei din 0162, care adaugă regula
-- „nefolosit de nicio evaluare”.

begin;

-- ============================================================
-- 1. FUNCȚIA
-- ============================================================

create or replace function public.sterge_logic(p_tabela text, p_ids uuid[])
returns uuid[] language plpgsql security definer set search_path = '' as $$
declare
  v_select    text;
  v_using     text;
  v_check     text;
  v_restrict  text;
  v_sterse    uuid[];
  v_respinse  integer;
begin
  if p_tabela is null or p_tabela not in (
    'inrolare_ciorne', 'role_permissions', 'hr_document_templates',
    'kpi_seturi', 'kpi_indicatori', 'kpi_tinte_angajat', 'kpi_evaluari_lunare'
  ) then
    raise exception 'Tabela „%” nu se șterge prin această funcție.', p_tabela using errcode = '42501';
  end if;
  if (select auth.uid()) is null then
    raise exception 'Sesiunea a expirat. Autentificați-vă din nou.' using errcode = '42501';
  end if;
  if p_ids is null or cardinality(p_ids) = 0 then
    return '{}'::uuid[];
  end if;

  -- `search_path = ''` face ca `pg_policies` să tipărească expresiile cu nume
  -- complet calificate (`app.…`, `public.permission_scope`), deci se pot
  -- executa aici fără ambiguitate. Politicile permisive se leagă prin OR,
  -- cele restrictive prin AND — regula Postgres.
  select string_agg('(' || p.qual || ')', ' or ')
    into v_select
    from pg_catalog.pg_policies p
   where p.schemaname = 'public' and p.tablename = p_tabela
     and p.cmd in ('SELECT', 'ALL') and p.permissive = 'PERMISSIVE'
     and p.roles && array['authenticated', 'public']::name[];

  select string_agg('(' || p.qual || ')', ' or '),
         string_agg('(' || coalesce(p.with_check, p.qual) || ')', ' or ')
    into v_using, v_check
    from pg_catalog.pg_policies p
   where p.schemaname = 'public' and p.tablename = p_tabela
     and p.cmd in ('UPDATE', 'ALL') and p.permissive = 'PERMISSIVE'
     and p.roles && array['authenticated', 'public']::name[];

  select string_agg('(' || coalesce(p.qual, 'true') || ')', ' and ')
    into v_restrict
    from pg_catalog.pg_policies p
   where p.schemaname = 'public' and p.tablename = p_tabela
     and p.cmd in ('SELECT', 'UPDATE', 'ALL') and p.permissive = 'RESTRICTIVE'
     and p.roles && array['authenticated', 'public']::name[];

  -- Fără politică SELECT sau UPDATE, RLS-ul ar fi refuzat tot; la fel și aici.
  if v_select is null or v_using is null then
    raise exception 'Nu aveți dreptul să ștergeți din „%”.', p_tabela using errcode = '42501';
  end if;

  execute format(
    'with u as (
       update public.%I
          set deleted_at = now(), updated_by = (select auth.uid())
        where id = any($1) and deleted_at is null
          and (%s) and (%s) and (%s)
       returning id)
     select array_agg(id) from u',
    p_tabela, v_select, v_using, coalesce(v_restrict, 'true'))
  into v_sterse using p_ids;

  if v_sterse is null then
    return '{}'::uuid[];
  end if;

  -- WITH CHECK pe rândul nou. Un refuz aici anulează tot apelul: excepția
  -- derulează înapoi UPDATE-ul de mai sus, ca la RLS.
  execute format(
    'select count(*) from public.%I where id = any($1) and not coalesce((%s), false)',
    p_tabela, v_check)
  into v_respinse using v_sterse;
  if v_respinse > 0 then
    raise exception 'Nu aveți dreptul să ștergeți din „%”.', p_tabela using errcode = '42501';
  end if;

  return v_sterse;
end;
$$;

comment on function public.sterge_logic(text, uuid[]) is
  'Ștergere logică pe tabelele a căror politică SELECT ascunde rândul șters (vezi 0164). '
  'Evaluează politicile SELECT/UPDATE ale tabelei pentru apelant; ocolește doar verificarea SELECT pe rândul nou. '
  'Întoarce id-urile efectiv șterse — gol = nimic de șters sau refuzat de USING.';

-- ============================================================
-- 2. DREPTURI
-- ============================================================

revoke all on function public.sterge_logic(text, uuid[]) from public, anon;
grant execute on function public.sterge_logic(text, uuid[]) to authenticated;

commit;
