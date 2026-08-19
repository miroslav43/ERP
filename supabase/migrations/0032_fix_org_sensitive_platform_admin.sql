-- supabase/migrations/0032_fix_org_sensitive_platform_admin.sql
-- org_write_sensitive/org_read_sensitive verificau apartenența organizației
-- prin app.current_org_ids() — care întoarce STRICT rândurile din
-- organization_members. Un super-admin de platformă care tocmai a creat
-- compania NU e membru al ei încă (membership-ul se dă separat, prin
-- invitație) — exact scenariul de înrolare pentru care există aceste RPC-uri.
-- app.has_permission() are deja un ocol pentru platform admin
-- (`when app.is_platform_admin() then 'all'`); verificarea de apartenență de
-- dinaintea ei trebuie să aibă același ocol, altfel RPC-ul respinge cazul
-- principal de folosire.

create or replace function public.org_write_sensitive(
  p_organization_id uuid,
  p_cnp_ciphertext bytea default null,
  p_cnp_iv bytea default null,
  p_cnp_tag bytea default null,
  p_cnp_key_version int default null,
  p_cnp_last4 text default null,
  p_cnp_hash text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_exista boolean;
begin
  if not (select app.is_platform_admin())
     and not (p_organization_id = any ((select app.current_org_ids())::uuid[])) then
    raise exception 'Organizația nu vă este accesibilă.' using errcode = 'P0001';
  end if;
  if app.has_permission(p_organization_id, 'organizations', 'update') <> 'all' then
    raise exception 'Nu aveți dreptul de a modifica datele personale sensibile ale reprezentantului legal.'
      using errcode = 'P0001';
  end if;

  if p_cnp_ciphertext is not null
     and (p_cnp_iv is null or p_cnp_tag is null or p_cnp_key_version is null) then
    raise exception 'CNP-ul criptat este incomplet: lipsesc vectorul de inițializare, eticheta sau versiunea cheii.'
      using errcode = 'P0001';
  end if;

  select true into v_exista
  from public.organization_sensitive_data s
  where s.organization_id = p_organization_id;

  if v_exista then
    update public.organization_sensitive_data s
    set cnp_ciphertext  = coalesce(p_cnp_ciphertext, s.cnp_ciphertext),
        cnp_iv          = coalesce(p_cnp_iv, s.cnp_iv),
        cnp_tag         = coalesce(p_cnp_tag, s.cnp_tag),
        cnp_key_version = coalesce(p_cnp_key_version, s.cnp_key_version),
        cnp_last4       = coalesce(p_cnp_last4, s.cnp_last4),
        cnp_hash        = coalesce(p_cnp_hash, s.cnp_hash),
        deleted_at      = null,
        updated_by      = v_uid
    where s.organization_id = p_organization_id;
  else
    insert into public.organization_sensitive_data (
      organization_id, cnp_ciphertext, cnp_iv, cnp_tag, cnp_key_version, cnp_last4, cnp_hash,
      created_by, updated_by
    )
    values (
      p_organization_id, p_cnp_ciphertext, p_cnp_iv, p_cnp_tag, p_cnp_key_version, p_cnp_last4, p_cnp_hash,
      v_uid, v_uid
    );
  end if;

  insert into public.audit_logs (
    organization_id, actor_id, action, entity_type, entity_id, status, after
  )
  values (
    p_organization_id, v_uid,
    (case when v_exista then 'update' else 'create' end)::public.audit_action,
    'organization_sensitive_data', p_organization_id, 'success',
    jsonb_build_object('motiv', 'scriere CNP reprezentant legal din aplicație')
  );

  return p_organization_id;
end;
$$;

create or replace function public.org_read_sensitive(p_organization_id uuid)
returns table (
  organization_id uuid,
  cnp_ciphertext bytea,
  cnp_iv bytea,
  cnp_tag bytea,
  cnp_key_version int,
  cnp_last4 text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_rec record;
begin
  if not (select app.is_platform_admin())
     and not (p_organization_id = any ((select app.current_org_ids())::uuid[])) then
    raise exception 'Organizația nu vă este accesibilă.' using errcode = 'P0001';
  end if;
  if app.has_permission(p_organization_id, 'organizations', 'update') <> 'all' then
    raise exception 'Nu aveți dreptul de a consulta datele personale sensibile ale reprezentantului legal.'
      using errcode = 'P0001';
  end if;

  select s.* into v_rec
  from public.organization_sensitive_data s
  where s.organization_id = p_organization_id and s.deleted_at is null;

  if not found or v_rec.cnp_ciphertext is null then
    raise exception 'Reprezentantul legal nu are CNP înregistrat.' using errcode = 'P0001';
  end if;

  insert into public.audit_logs (
    organization_id, actor_id, action, entity_type, entity_id, status, after
  )
  values (
    p_organization_id, v_uid, 'view', 'organization_sensitive_data', p_organization_id, 'success',
    jsonb_build_object('motiv', 'citire CNP reprezentant legal din aplicație')
  );

  return query
    select v_rec.organization_id, v_rec.cnp_ciphertext, v_rec.cnp_iv, v_rec.cnp_tag,
           v_rec.cnp_key_version, v_rec.cnp_last4;
end;
$$;
