-- supabase/migrations/0196_lantul_de_sefi_al_angajatului.sql
--
-- ANGAJATUL ÎȘI VEDE LANȚUL DE ȘEFI (QA 8 oct 2026, ANG-028).
--
-- ── DEFECTUL ────────────────────────────────────────────────────────────────
-- `/portal/echipa-mea` construiește arborele cu `arboreleManagerial` (scope
-- `own`): citește `manager_path` de pe fișa proprie, apoi rândurile șefilor din
-- `employees`. Politica `employees_select` (0005) cu `own` dă însă DOAR
-- `user_id = auth.uid()`, deci a doua citire întorcea ZERO rânduri, fără eroare:
-- angajatul se vedea singur, fără niciun manager deasupra.
--
-- ── CE FACE ─────────────────────────────────────────────────────────────────
-- O singură funcție `security definer`, fără politică nouă și fără tabele. Ea
-- citește exact șefii din `manager_path`-ul fișei PROPRII (`current_employee_id`),
-- doar în organizația curentă (`current_org_ids`), doar pentru cine are cel puțin
-- `employees:read = own`, și întoarce doar cartea de vizită (nume, marcă, funcție,
-- departament) — CNP-ul, IBAN-ul și salariul nu stau pe `employees` în clar și
-- oricum nu se aleg aici.
--
-- Alternativa respinsă: lărgirea lui `employees_select` cu
-- `id = any(manager_path propriu)` ar deschide rândurile ÎNTREGI ale managerilor
-- pentru toți cititorii `own`.
--
-- Forward-only. Proba pe banc: `tests/rls/proba-lantul-de-sefi.sql`.

begin;

create or replace function public.lantul_meu_de_sefi(p_org uuid)
returns table (
  id uuid,
  full_name text,
  marca text,
  functie text,
  user_id uuid,
  manager_employee_id uuid,
  department_id uuid,
  department_denumire text,
  pozitie integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with eu as (
    select e.id, e.manager_path
    from public.employees e
    where e.organization_id = p_org
      and e.id = app.current_employee_id(p_org)
      and e.deleted_at is null
      and p_org = any ((select app.current_org_ids())::uuid[])
      and app.has_permission(p_org, 'employees', 'read') in ('own', 'team', 'all')
  )
  select e.id, e.full_name, e.marca, e.functie, e.user_id, e.manager_employee_id,
         d.id, d.denumire, p.ord::integer
  from eu
  cross join lateral unnest(eu.manager_path) with ordinality as p(id, ord)
  join public.employees e
    on e.id = p.id
   and e.organization_id = p_org
   and e.deleted_at is null
  left join public.departments d
    on d.id = e.department_id
   and d.organization_id = p_org
   and d.deleted_at is null
  where e.id <> eu.id
  order by p.ord;
$$;

comment on function public.lantul_meu_de_sefi(uuid) is
  'Șefii din manager_path ai fișei proprii, vârf → șef direct. Doar carte de vizită; organizația curentă; cere employees:read cel puțin own.';

revoke all on function public.lantul_meu_de_sefi(uuid) from public, anon;
grant execute on function public.lantul_meu_de_sefi(uuid) to authenticated;

commit;
