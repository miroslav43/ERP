-- supabase/migrations/0073_cale_storage_resurse.sql
-- Încărcarea și descărcarea documentelor de personal erau MOARTE. Nu parțial:
-- complet, pentru oricine nu era platform admin. Sondat empiric pe baza reală
-- din 2026-08-25, nu dedus — memoria proiectului spune că raționamentul despre
-- RLS a greșit deja de patru ori aici.
--
-- ┌ Sonda 1 — catalogul de resurse ────────────────────────────────────────────
-- │ select distinct resource from public.role_permissions where deleted_at is null;
-- │   → 23 de nume, toate în engleză. Niciun „angajati", „import", „contracte",
-- │     „adeverinte".
-- │
-- │ Sonda 2 — efectul, ca `org_admin` PUR (nu platform admin):
-- │   perm(employees,create) = all
-- │   perm(angajati, create) = none          ← absența rândului = refuz
-- │   can_path('{org}/angajati/{emp}/x.pdf','create')  = false
-- │   can_path('{org}/employees/{emp}/x.pdf','create') = true
-- │   Identic pentru `hr`.
-- │
-- │ Sonda 3 — citirea, ca `employee`:
-- │   perm(employees,read) = own
-- │   can_path('{org}/employees/{employees.id}/x.pdf','read') = false   ← al doilea defect
-- │   can_path('{org}/employees/{auth.uid()}/x.pdf','read')   = true
-- └────────────────────────────────────────────────────────────────────────────
--
-- DOUĂ defecte distincte, care se maschează unul pe celălalt:
--
-- (a) `app.can_path` (0002_authz.sql:1453) ia segmentul 2 al căii ca NUME DE
--     RESURSĂ și îl dă lui `app.has_permission`. `src/lib/documents/cale.ts`
--     construia însă căi cu cuvinte românești, care nu există în catalog.
--     `has_permission` întoarce `coalesce(..., 'none')`, deci `can_path` e fals,
--     deci `storage_objects_insert` respinge, deci `createSignedUploadUrl`
--     eșuează. Se repară în cod, nu aici: `angajati` → `employees`.
--     `app.is_platform_admin()` scurtcircuitează `has_permission` la 'all',
--     ceea ce explică de ce defectul a supraviețuit unei faze întregi: cine
--     testa era platform admin.
--
-- (b) Pentru scope `own`, `can_path` cerea `segmentul 3 = auth.uid()`. Dar
--     segmentul 3 e `employees.id`, nu `user_id` — două chei diferite pentru
--     aceeași persoană. Un angajat cu `employees:read = own` (mutat acolo de
--     0023_portal_angajat.sql:51) nu-și putea citi propriul document. ASTA se
--     repară aici, în `can_path`, pentru că e o regresie a funcției, nu a
--     apelantului: orice modul viitor care pune o fișă de angajat în segmentul
--     3 ar fi căzut la fel. Modulul de cursuri care urmează e exact acel modul.
--
-- Reparația e gratuită: `select count(*) from storage.objects` = 2, ambele
-- avatare; `employee_documents` = 0 rânduri. Funcția n-a mers niciodată, deci
-- nu există niciun fișier de mutat și nicio cale veche de păstrat.
--
-- Forward-only, idempotentă: `create or replace` păstrează privilegiile
-- existente, iar coada REVOKE/GRANT le rescrie oricum explicit.

begin;

---------------------------------------------------------------------------
-- 1. app.can_path — ramura `own` acceptă și fișa de angajat a utilizatorului
---------------------------------------------------------------------------

create or replace function app.can_path(p_name text, p_action text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with p as (
    select app.path_org(p_name) as org,
           app.path_resource(p_name) as res,
           app.path_segment(p_name, 3) as ent
  )
  select coalesce((
    select case
      when p.org is null or p.res is null then false
      when not (p.org = any (app.current_org_ids())) then false
      else case app.has_permission(p.org, p.res, p_action)
             when 'all'  then true
             when 'team' then true
             -- Două chei pentru aceeași persoană: `auth.uid()` când entitatea
             -- din cale ESTE contul (avatare, preferințe), `employees.id` când
             -- entitatea e fișa de personal. A cere doar prima însemna că un
             -- angajat nu-și poate citi propriul document — defect (b) din antet.
             when 'own'  then p.ent = (select auth.uid())::text
                           or exists (
                                select 1
                                from public.employees e
                                where e.id::text = p.ent
                                  and e.organization_id = p.org
                                  and e.user_id = (select auth.uid())
                                  and e.deleted_at is null
                              )
             else false
           end
    end
    from p
  ), false);
$$;

comment on function app.can_path(text, text) is
  'Autorizarea unei căi din Storage: {org}/{RESURSĂ DE PERMISIUNE}/{entitate}/{fișier}. Segmentul 2 trebuie să fie un nume din catalogul `role_permissions.resource` — un cuvânt inventat înseamnă refuz tăcut. La scope `own`, entitatea poate fi contul (auth.uid()) SAU fișa de angajat a contului.';

revoke all on function app.can_path(text, text) from public, anon;
grant execute on function app.can_path(text, text) to authenticated, service_role;

commit;
