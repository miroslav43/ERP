-- ─────────────────────────────────────────────────────────────────────────────
-- 0007_fix_hr_rls.sql — nucleul HR chiar funcționează
--
-- Faza 2 trecea typecheck, lint, teste, cele trei bariere ȘI testul de izolare,
-- dar un `org_admin` nu putea insera un angajat. Niciuna dintre verificările
-- automate nu execută un INSERT real ca utilizator obișnuit, așa că defectul a
-- fost invizibil pentru toate.
--
-- Verificat direct, înainte de corecție:
--   insert into public.employees (...) as authenticated
--   → new row violates row-level security policy for table "employees" (42501)
--
-- PATRU DEFECTE, toate în 0005:
--
-- 1. `WITH CHECK` cerea coloane care fuseseră DEJA scrise de trigger.
--    `employees_insert` cerea `manager_path = '{}'::uuid[]`, cu comentariul
--    „calculat de trigger". În Postgres, triggerele BEFORE rulează ÎNAINTE ca
--    `WITH CHECK` să fie evaluat, deci politica vedea `array[new.id]`, nu `{}`.
--    Ordinea era exact inversă față de ce presupunea comentariul.
--    Identic pentru `departments_insert` (`path` și `depth`).
--
--    Corecție: condițiile dispar. Coloanele aparțin triggerului; nu are sens ca
--    politica să le verifice, iar clientul oricum nu le poate impune.
--
-- 2. `created_by` / `updated_by` erau cerute de politici, dar nimic nu le
--    completa. `internal.set_actor()` există din 0002, însă bucla care îl
--    atașează a rulat atunci — înainte ca tabelele HR să existe. Aceeași clasă
--    de defect ca la granturi: „aplică pe toate tabelele" înseamnă „pe cele de
--    acum".
--
-- 3. `sensitive_select` permitea SELECT DIRECT pe `employee_sensitive_data`,
--    ocolind `hr_read_sensitive` — adică ocolind exact auditul pentru care
--    funcția există. Privilegiile au fost deja revocate în 0005, dar o politică
--    rămasă acolo e o invitație la reacordarea lor „ca să meargă ceva".
--
-- 4. Politicile pe `salary_components` și `employee_tax_exemptions` foloseau
--    `has_permission(...) <> 'none'`, tratând `own` și `team` la fel ca `all`.
--    Un angajat cu `payroll:read = own` vedea sporurile TUTUROR colegilor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Coloanele calculate de trigger ies din WITH CHECK ────────────────────

drop policy if exists employees_insert on public.employees;
create policy employees_insert on public.employees
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'employees', 'create') = 'all'
    and deleted_at is null
    and terminated_on is null
    and status in ('candidat', 'activ')
  );

drop policy if exists departments_insert on public.departments;
create policy departments_insert on public.departments
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'departments', 'create') = 'all'
    and deleted_at is null
  );

-- ── 2. `set_actor` pe tabelele HR ───────────────────────────────────────────

do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'updated_by'
                       and a.attnum > 0 and not a.attisdropped
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not exists (
        select 1 from pg_trigger tg
        where tg.tgrelid = c.oid and tg.tgname = 'set_actor_' || c.relname
      )
    order by c.relname
  loop
    execute format(
      'create trigger %I before insert or update on public.%I
         for each row execute function internal.set_actor()',
      'set_actor_' || t.relname, t.relname);
    raise notice 'set_actor atașat pe %', t.relname;
  end loop;
end
$$;

-- ── 3. Datele sensibile se ating exclusiv prin funcțiile care auditează ─────

drop policy if exists sensitive_select on public.employee_sensitive_data;
drop policy if exists sensitive_insert on public.employee_sensitive_data;
drop policy if exists sensitive_update on public.employee_sensitive_data;

comment on table public.employee_sensitive_data is
  'CNP și IBAN criptate. Fără politici RLS și fără privilegii pentru `authenticated`, deliberat: accesul trece exclusiv prin hr_read_sensitive / hr_write_sensitive, care scriu în audit la fiecare apel. O politică de SELECT ar ocoli tocmai auditul.';

-- ── 4. Scope-ul pe date salariale ───────────────────────────────────────────
--
-- `own` = doar propriile date; `team` = subarborele managerului; `all` = tot.
-- Predicatul `<> 'none'` colapsa toate trei într-unul singur.

drop policy if exists salary_components_select on public.salary_components;
create policy salary_components_select on public.salary_components
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and (
      case app.has_permission(organization_id, 'payroll', 'read')
        when 'all'  then true
        when 'team' then app.is_manager_of(organization_id, employee_id)
        when 'own'  then employee_id = app.current_employee_id(organization_id)
        else false
      end
    )
  );

drop policy if exists exemptions_select on public.employee_tax_exemptions;
create policy exemptions_select on public.employee_tax_exemptions
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and (
      case app.has_permission(organization_id, 'payroll', 'read')
        when 'all'  then true
        when 'team' then app.is_manager_of(organization_id, employee_id)
        when 'own'  then employee_id = app.current_employee_id(organization_id)
        else false
      end
    )
  );
