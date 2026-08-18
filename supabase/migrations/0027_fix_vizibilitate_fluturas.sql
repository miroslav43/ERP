-- ─────────────────────────────────────────────────────────────────────────────
-- 0027_fix_vizibilitate_fluturas.sql
--
-- Un angajat cu `payroll:read = own` nu-și putea vedea propriul fluturaș, deși
-- perioada era `aprobat`. Reprodus direct în Postgres, ca `authenticated`, cu
-- request.jwt.claims pe angajatul real:
--
--   select id from payroll_entries where employee_id = '<propriul id>';
--   → 0 rânduri (ar fi trebuit să întoarcă exact 1)
--
-- Cauza: `payroll_entries_select` verifică starea perioadei printr-un
--   exists (select 1 from public.payroll_periods p where p.id = ... and p.status in (...))
-- Acel subquery rulează SUB rolul apelantului, deci trece prin RLS-ul lui
-- `payroll_periods` — care cere `payroll:read = all`. Un angajat obișnuit nu-l
-- are, deci EXISTS-ul e mereu fals pentru el, indiferent de starea reală a
-- perioadei. Exact clasa de defect pe care `app.este_zi_lucratoare` (definer)
-- și `app.poate_accesa_salariul` (definer) o evită — aici scăpase un singur loc.
--
-- Soluția: un helper SECURITY DEFINER, ca verificarea stării perioadei să nu
-- mai depindă de RLS-ul `payroll_periods` pentru cititorul curent.
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on

create or replace function app.perioada_salariu_vizibila(p_period_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.payroll_periods p
    where p.id = p_period_id and p.status in ('aprobat', 'inchis')
  );
$$;
revoke all on function app.perioada_salariu_vizibila(uuid) from public, anon;
grant execute on function app.perioada_salariu_vizibila(uuid) to authenticated;

drop policy if exists payroll_entries_select on public.payroll_entries;
create policy payroll_entries_select on public.payroll_entries
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.poate_accesa_salariul(organization_id, employee_id, 'read')
    and (
      app.has_permission(organization_id, 'payroll', 'read') = 'all'
      or app.perioada_salariu_vizibila(period_id)
    )
  );
