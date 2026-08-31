-- =====================================================================================
-- 0113_luna_fluturasului_propriu.sql
--
-- Angajatul își poate afla LUNA propriului fluturaș. Până acum nu putea, iar
-- asta făcea din fluturaș un document fără dată.
--
-- ── DEFECTUL, SCRIS ÎN COD DE APROAPE UN AN ──────────────────────────────────
-- `src/app/(portal)/portal/salariul-meu/page.tsx` trimite literal
-- `perioada={null}` către componenta `Fluturas`, cu un comentariu care spune pe
-- față că e o limită a bazei și că „se repară cu o migrare, nu din interfață".
-- Comentariul de pe prop-ul `perioada` (`src/components/payroll/fluturas.tsx`)
-- e și mai direct: „un fluturaș fără lună nu e un document — dintr-un teanc de
-- hârtii identice nu se mai poate spune care e a cărei luni."
--
-- Cauza: `payroll_entries` poartă doar `period_id`. Anul și luna stau în
-- `payroll_periods`, iar `payroll_periods_select` (0026:483) cere
--
--     app.can(organization_id, 'payroll', 'read', 'all')
--
-- Angajatul are `own`. Deci rândul cu `an` și `luna` îi e refuzat de RLS — fără
-- nicio eroare, ca de obicei: `maybeSingle()` întoarce `null`, iar un embed
-- PostgREST ar întoarce un obiect gol. Tăcut, adică cel mai rău fel.
--
-- ── DE CE UN HELPER `SECURITY DEFINER` ȘI NU UN `EXISTS` ÎN POLITICĂ ─────────
-- Un `exists (select 1 from public.payroll_entries …)` scris direct în clauza
-- `USING` rulează SUB rolul apelantului, deci trece prin RLS-ul lui
-- `payroll_entries`. Exact clasa de defect reprodusă și închisă de
-- `0027_fix_vizibilitate_fluturas.sql`, care a trebuit să introducă
-- `app.perioada_salariu_vizibila` din fix același motiv. Se repetă tiparul, nu
-- greșeala.
--
-- Recursiune nu apare: `payroll_entries_select` (0027:39) își verifică perioada
-- tot printr-un definer, deci lanțul nu se întoarce niciodată în politica de
-- SELECT a lui `payroll_periods`.
--
-- ── CE NU DESCHIDE ───────────────────────────────────────────────────────────
-- Ramura nouă cere `status in ('aprobat','inchis')` — aceeași condiție pe care
-- `app.perioada_salariu_vizibila` o impune deja pe `payroll_entries`. Fără ea,
-- angajatul ar afla existența unei perioade `draft` (adică faptul că i se
-- calculează ceva) din simplul fapt că are un rând în ea. Lista de perioade a
-- organizației rămâne, ca și până acum, un concept administrativ: angajatul
-- vede EXACT perioadele în care are un fluturaș vizibil, și nimic altceva.
-- =====================================================================================

\set ON_ERROR_STOP on

-- ============================================================
-- 1. Helper: am eu un fluturaș în perioada asta?
-- ============================================================

create or replace function app.are_fluturas_in_perioada(p_period_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.payroll_entries e
    join public.payroll_periods p on p.id = e.period_id
    where e.period_id = p_period_id
      and e.deleted_at is null
      and e.employee_id = app.current_employee_id(p.organization_id)
  );
$$;

comment on function app.are_fluturas_in_perioada(uuid) is
  'Adevărat dacă fișa curentă (app.current_employee_id) are o înregistrare de '
  'salariu neștearsă în perioada dată. SECURITY DEFINER, ca verificarea să nu '
  'treacă prin RLS-ul lui payroll_entries pentru cititorul curent — vezi 0027.';

revoke all on function app.are_fluturas_in_perioada(uuid) from public, anon;
grant execute on function app.are_fluturas_in_perioada(uuid) to authenticated;

-- ============================================================
-- 2. Politica de SELECT pe perioade, cu ramura proprie
-- ============================================================
--
-- Forward-only: 0026 rămâne neatinsă. Se șterge și se rescrie politica, exact
-- ca în 0027. O A DOUA politică permisivă alăturată ar fi mers la fel de bine
-- pentru Postgres (permisivele se adună cu OR), dar ar fi rupt convenția
-- proiectului — un singur trio `_select`/`_insert`/`_update` per tabelă.

drop policy if exists payroll_periods_select on public.payroll_periods;
create policy payroll_periods_select on public.payroll_periods
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      app.can(organization_id, 'payroll', 'read', 'all')
      or (
        status in ('aprobat', 'inchis')
        and app.poate_accesa_salariul(
              organization_id,
              app.current_employee_id(organization_id),
              'read'
            )
        and app.are_fluturas_in_perioada(id)
      )
    )
  );

comment on policy payroll_periods_select on public.payroll_periods is
  'payroll:read = all vede toate perioadele. Restul văd doar perioadele '
  'aprobate sau închise în care au propriul fluturaș — atât cât să poată scrie '
  'luna pe el. Vezi 0113.';
