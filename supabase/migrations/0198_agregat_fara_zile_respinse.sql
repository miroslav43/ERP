-- supabase/migrations/0198_agregat_fara_zile_respinse.sql
--
-- ZIUA RESPINSĂ ȘI NECORECTATĂ NU SE PLĂTEȘTE.
--
-- ── DEFECTUL ────────────────────────────────────────────────────────────────
-- Din 1fc3ee70, foaia colectivă, „Pontajul meu” și „Luna aceasta” scot ziua
-- respinsă din totaluri (`src/domain/attendance/totaluri.ts`): până la corectură,
-- orele ei NU sunt ore ale firmei. Agregarea pentru salarizare (0064) filtra
-- însă doar pe `deleted_at`, deci ziua respinsă intra în stat ca zi lucrată, cu
-- orele și sporurile ei. Fluturașul nu se mai potrivea cu foaia de prezență, iar
-- caseta de blocare nu spunea nimic, fiindcă `numaraLiniiNeaprobate` exclude
-- deliberat respinsele (QA oct 2026, lotul L1-pontaj-salarizare).
-- Probat pe banc: `tests/rls/proba-zi-respinsa-neplatita.sql`, (3).
--
-- ── CE FACE ─────────────────────────────────────────────────────────────────
-- Redefinește `public.pontaj_agregat_salarizare` cu un singur filtru în plus:
-- `respins_la is null`. Restul e copia exactă din 0064 — aceeași semnătură,
-- același tip de retur, deci `create or replace` ajunge (fără drop) și
-- `.rpc("pontaj_agregat_salarizare", ...)` din `src/lib/queries/payroll.ts` nu
-- se schimbă.
--
-- Ziua NEDECISĂ (`approved_at is null`, `respins_la is null`) rămâne în agregare,
-- exact ca până acum: aprobarea pe zi nu e obligatorie în toate firmele (0118),
-- iar a cere-o aici ar goli statul firmelor care nu aprobă zilnic. Corectura
-- stinge marcajul de respingere (0067, `attendance_entries_respingere_ck`), deci
-- ziua corectată reintră singură.
--
-- ── CE NU FACE ──────────────────────────────────────────────────────────────
-- Nu refuză blocarea unei luni cu zile respinse: decizia de produs e că o zi
-- respinsă și necorectată pur și simplu nu se plătește. Caseta „Blocați luna?”
-- avertizează despre ele (`numaraZileRespinse`), fără să blocheze.

begin;

create or replace function public.pontaj_agregat_salarizare(p_period_id uuid)
returns table (
  employee_id                 uuid,
  zile_lucrate                numeric,
  zile_concediu_odihna        numeric,
  zile_concediu_medical       numeric,
  zile_absenta_nemotivata     numeric,
  zile_fara_plata             numeric,
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
    count(*) filter (where e.tip_zi = 'fara_plata')::numeric,
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
    -- Ziua respinsă și necorectată nu e oră a firmei (0198). Aceeași regulă ca
    -- totalurile din `src/domain/attendance/totaluri.ts`.
    and e.respins_la is null
  group by e.employee_id;
$$;

comment on function public.pontaj_agregat_salarizare(uuid) is
  'Pontajul lunii agregat pe angajat, cu orele separate pe cele trei axe de spor. '
  'Un rând per angajat, ca să nu se atingă max_rows = 1000. SECURITY INVOKER: '
  'RLS-ul attendance_entries rămâne bariera. Din 0064 zilele fără plată se '
  'numără separat — până atunci intrau în zile_concediu_odihna și SE PLĂTEAU. '
  'Din 0198 zilele respinse și necorectate (respins_la nenul) nu se mai numără '
  'deloc — până atunci se plăteau ca zile lucrate.';

revoke all on function public.pontaj_agregat_salarizare(uuid) from public, anon;
grant execute on function public.pontaj_agregat_salarizare(uuid) to authenticated;

commit;
