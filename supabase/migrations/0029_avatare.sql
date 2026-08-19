-- supabase/migrations/0029_avatare.sql
-- Fotografia de profil: coloana `profiles.avatar_path` există deja din
-- 0001_kernel.sql (nefolosită până acum). Lipsesc doar bucket-ul, politicile
-- de Storage și calea prin care un admin poate seta poza ALTCUIVA.
--
-- Cont, nu fișă de personal: avatarul trăiește pe `profiles` (un rând per
-- utilizator, indiferent de organizație), nu pe `employees`. Un angajat fără
-- cont în portal (user_id null) rămâne cu default-ul gol — comportament dorit,
-- nu o gaură de acoperit.

begin;

-- ── 1. Bucket ────────────────────────────────────────────────────────────────
-- PUBLIC, spre deosebire de org-documents/org-branding: pozele de profil apar
-- simultan în tabele, organigramă și carduri de departament — a semna fiecare
-- URL în parte ar însemna zeci de apeluri Storage pe o singură randare de
-- pagină. Sensibilitatea e joasă (o poză, nu un document legal), iar calea
-- conține doar un UUID, deci nu e nici enumerabilă.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

-- ── 2. Politici Storage ──────────────────────────────────────────────────────
-- Contract de cale: {user_id}/{uuid}-{nume_fișier} — NU contractul
-- {org}/{resursă}/{entitate} din 0002_authz.sql (`can_path`), fiindcă profilul
-- nu ține de nicio organizație. Segmentul 1 e fie chiar auth.uid() (propria
-- poză), fie orice user_id pentru care apelantul are `users.update = all`
-- într-o organizație în care ținta e membru activ (admin, din fișa unui coleg).

create policy avatars_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and owner = (select auth.uid())
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (
      (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and exists (
        select 1
        from public.organization_members m
        where m.user_id = ((storage.foldername(name))[1])::uuid
          and m.status = 'active'
          and m.deleted_at is null
          and app.has_permission(m.organization_id, 'users', 'update') = 'all'
      )
    )
  )
);

create policy avatars_update on storage.objects for update to authenticated
using (bucket_id = 'avatars')
with check (
  bucket_id = 'avatars'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (
      (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and exists (
        select 1
        from public.organization_members m
        where m.user_id = ((storage.foldername(name))[1])::uuid
          and m.status = 'active'
          and m.deleted_at is null
          and app.has_permission(m.organization_id, 'users', 'update') = 'all'
      )
    )
  )
);

-- SELECT rămâne permisă oricui autentificat: bucket-ul e public, deci citirea
-- reală trece prin /storage/v1/object/public/... și ocolește oricum RLS-ul de
-- mai jos. Politica există doar pentru căile SDK care tot trec prin RLS
-- (listare, download semnat), nu pentru afișarea propriu-zisă.
create policy avatars_select on storage.objects for select to authenticated
using (bucket_id = 'avatars');

-- Fără politică DELETE, la fel ca org-documents/org-branding: poza veche
-- rămâne orfană în bucket după o reîncărcare. Cost de stocare neglijabil
-- pentru imagini de ordinul sutelor de KB; ștergerea reală ar cere
-- service_role, nu client.

-- ── 3. RPC: admin setează poza ALTUI membru ─────────────────────────────────
-- `profiles_update` (0002_authz.sql) restrânge UPDATE la `id = auth.uid()` —
-- corect pentru autoservire, dar exclude structural un admin care încarcă
-- poza unui coleg din fișa lui. SECURITY DEFINER e singura cale de a ocoli
-- asta fără să slăbim politica pentru toată lumea.
create or replace function public.set_member_avatar(
  p_organization_id uuid,
  p_user_id uuid,
  p_avatar_path text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if app.has_permission(p_organization_id, 'users', 'update') <> 'all' then
    raise exception 'Nu aveți dreptul de a modifica fotografia acestui coleg.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = p_user_id
      and m.status = 'active'
      and m.deleted_at is null
  ) then
    raise exception 'Utilizatorul nu este membru activ al acestei organizații.' using errcode = 'P0001';
  end if;

  update public.profiles
  set avatar_path = p_avatar_path
  where id = p_user_id and deleted_at is null;

  perform app.write_audit(
    'update', p_organization_id, 'profiles', p_user_id,
    null, jsonb_build_object('avatar_path_setat', p_avatar_path is not null)
  );
end;
$$;

revoke execute on function public.set_member_avatar(uuid, uuid, text) from public, anon;
grant execute on function public.set_member_avatar(uuid, uuid, text) to authenticated;

commit;
