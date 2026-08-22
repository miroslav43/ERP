-- supabase/migrations/0049_salarizare_agregare_pontaj.sql
--
-- Agregarea pontajului pentru salarizare, mutată din TypeScript în SQL.
-- Repară două defecte care produceau salarii greșite, ambele TĂCUT.
--
-- (1) ZILELE DE WEEKEND ȘI DE SĂRBĂTOARE ERAU ARUNCATE.
--     `pontajAgregatPerioada` (src/lib/queries/payroll.ts) trata doar
--     'lucratoare', 'delegatie', 'concediu', 'medical', 'absenta_nemotivata'.
--     Un rând cu tip_zi='weekend' sau 'sarbatoare' cădea prin toate ramurile:
--     nici ziua, nici orele nu ajungeau nicăieri. Cine muncea sâmbăta sau de
--     1 Decembrie nu era plătit deloc pentru ziua aceea, fără nicio eroare.
--     `tip_zi` e dedus de trigger din calendar (0013:275), deci datele erau
--     corecte în bază — se pierdeau la citire.
--
-- (2) TRUNCHIERE LA 1000 DE RÂNDURI.
--     Aceeași funcție selecta `attendance_entries` rând-cu-zi, fără paginare.
--     PostgREST are `max_rows = 1000` (supabase/config.toml:18) și TRUNCHIAZĂ
--     TĂCUT. 33 de angajați × 31 de zile = 1023: de la al 33-lea angajat,
--     ultimii din listă primeau pontaj zero și erau plătiți pe zile inexistente.
--     Agregarea per angajat coboară numărul de rânduri de la (angajați × zile)
--     la (angajați) — 200 de angajați înseamnă 200 de rânduri, nu 6200.
--
-- SECURITY INVOKER, deliberat: RLS-ul lui `attendance_entries` rămâne bariera.
-- Un apelant care trimite `p_period_id` al altei organizații primește zero
-- rânduri, nu date străine. Funcția stă în schema `public` fiindcă `app` NU e
-- expusă prin PostgREST (config.toml:13) — `.rpc()` n-ar ajunge la ea.
--
-- Orele sunt separate pe cele trei axe de spor din `app.sporuri_pontaj`
-- (0013:666): zi lucrătoare, repaus săptămânal, sărbătoare legală — fiecare cu
-- orele normale și cele suplimentare distinct, plus orele de noapte, care se
-- cumulează pe axă separată. `ore_lucrate` include suplimentarele
-- (constrângerea `ore_suplimentare <= ore_lucrate`, 0013:156), deci orele
-- normale sunt diferența.

\set ON_ERROR_STOP on

begin;

create or replace function public.pontaj_agregat_salarizare(p_period_id uuid)
returns table (
  employee_id                 uuid,
  zile_lucrate                numeric,
  zile_concediu_odihna        numeric,
  zile_concediu_medical       numeric,
  zile_absenta_nemotivata     numeric,
  zile_repaus_lucrate         numeric,
  zile_sarbatoare_lucrate     numeric,
  ore_lucrate                 numeric,
  ore_normale_zi              numeric,
  ore_normale_repaus          numeric,
  ore_normale_sarbatoare      numeric,
  ore_suplimentare_zi         numeric,
  ore_suplimentare_repaus     numeric,
  ore_suplimentare_sarbatoare numeric,
  ore_noapte                  numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    e.employee_id,
    count(*) filter (where e.tip_zi in ('lucratoare', 'delegatie'))::numeric,
    count(*) filter (where e.tip_zi = 'concediu')::numeric,
    count(*) filter (where e.tip_zi = 'medical')::numeric,
    count(*) filter (where e.tip_zi = 'absenta_nemotivata')::numeric,
    count(*) filter (where e.tip_zi = 'weekend' and e.ore_lucrate > 0)::numeric,
    count(*) filter (where e.tip_zi = 'sarbatoare' and e.ore_lucrate > 0)::numeric,
    coalesce(sum(e.ore_lucrate), 0),
    coalesce(sum(e.ore_lucrate - e.ore_suplimentare)
             filter (where e.tip_zi in ('lucratoare', 'delegatie')), 0),
    coalesce(sum(e.ore_lucrate - e.ore_suplimentare)
             filter (where e.tip_zi = 'weekend'), 0),
    coalesce(sum(e.ore_lucrate - e.ore_suplimentare)
             filter (where e.tip_zi = 'sarbatoare'), 0),
    coalesce(sum(e.ore_suplimentare)
             filter (where e.tip_zi in ('lucratoare', 'delegatie')), 0),
    coalesce(sum(e.ore_suplimentare) filter (where e.tip_zi = 'weekend'), 0),
    coalesce(sum(e.ore_suplimentare) filter (where e.tip_zi = 'sarbatoare'), 0),
    coalesce(sum(e.ore_noapte), 0)
  from public.attendance_entries e
  where e.period_id = p_period_id
    and e.deleted_at is null
  group by e.employee_id;
$$;

comment on function public.pontaj_agregat_salarizare(uuid) is
  'Pontajul lunii agregat pe angajat, cu orele separate pe cele trei axe de spor. Un rând per angajat, ca să nu se atingă max_rows = 1000. SECURITY INVOKER: RLS-ul attendance_entries rămâne bariera.';

revoke all on function public.pontaj_agregat_salarizare(uuid) from public, anon;
grant execute on function public.pontaj_agregat_salarizare(uuid) to authenticated;

commit;
