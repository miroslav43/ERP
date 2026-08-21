-- supabase/migrations/0043_fix_invitations_select_platform_admin.sql
-- Omisiune rămasă din 0002_authz.sql: `invitations_select` cere apartenența la
-- organizație, fără ramura de administrator de platformă pe care o au vecinele
-- ei directe din același fișier — `organizations_select` și
-- `organization_members_select` încep amândouă cu `app.is_platform_admin() or …`.
--
-- Efectul vizibil: pe /super-admin/organizatii/<id>/membri, un super-admin de
-- platformă vedea organizația și membrii, dar lista „Invitații în așteptare"
-- ieșea goală — pagina citește cu clientul legat de RLS. În același timp,
-- butonul de invitare refuza cu „Există deja o invitație în așteptare",
-- pentru că verificarea din Server Action folosește clientul service_role,
-- care ocolește RLS. Două surse de adevăr diferite pe același ecran.
--
-- Aceeași familie cu 0031/0032, care au reparat exact acest tipar pentru
-- `organization_sensitive_data`.
--
-- `deleted_at is null` rămâne DOAR pe ramura de tenant, ca la celelalte două
-- politici: administratorul de platformă are voie să vadă și rândurile șterse
-- logic, pentru diagnostic.

begin;

drop policy if exists invitations_select on public.invitations;

create policy invitations_select on public.invitations for select to authenticated
using ((
  (select app.is_platform_admin())
  or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and app.can(organization_id, 'users', 'read', 'all')
  )
));

commit;
