-- supabase/migrations/0044_fix_role_permissions_select_platform_admin.sql
-- Aceeași omisiune ca în 0043, pe alt tabel. `role_permissions_select` lasă
-- vizibile rândurile globale (`organization_id is null`), dar pe cele
-- suprascrise per organizație le condiționează de apartenență.
--
-- Ecranul /super-admin/organizatii/<id>/permisiuni face exact două interogări:
-- una pe implicitele globale, una pe suprascrierile organizației. Prima trece,
-- a doua întoarce zero rânduri pentru un administrator de platformă care nu e
-- membru al organizației — adică pentru oricare organizație de client. Nu apare
-- nicio eroare: ecranul afișează liniștit „fără suprascrieri", ceea ce e fals
-- de îndată ce există măcar una. Pe un ecran de permisiuni, asta e mai rău
-- decât o eroare vizibilă.
--
-- LATENT la data scrierii: în baza de date nu există încă nicio suprascriere
-- (344 de rânduri globale, 0 pe organizație), deci ecranul spune adevărul din
-- întâmplare. Migrația previne, nu repară ceva deja stricat vizibil.

begin;

drop policy if exists role_permissions_select on public.role_permissions;

create policy role_permissions_select on public.role_permissions for select to authenticated
using (
  deleted_at is null
  and (
    organization_id is null
    or (select app.is_platform_admin())
    or organization_id = any ((select app.current_org_ids())::uuid[])
  )
);

commit;
