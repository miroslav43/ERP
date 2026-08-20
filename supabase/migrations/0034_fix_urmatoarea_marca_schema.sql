-- supabase/migrations/0034_fix_urmatoarea_marca_schema.sql
-- `internal.*` nu e expus prin PostgREST (doar `public`, verificat prin
-- generatorul de tipuri) — funcțiile apelate din client via `.rpc()` trebuie
-- să fie în `public`, exact ca `hr_write_sensitive`/`org_write_sensitive`.
-- `internal.urmatoarea_marca` din 0033 n-ar fi fost niciodată apelabilă.

drop function if exists internal.urmatoarea_marca(uuid);

create or replace function public.urmatoarea_marca(p_organization_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_numar int;
begin
  if not (p_organization_id = any ((select app.current_org_ids())::uuid[])) then
    raise exception 'Organizația nu vă este accesibilă.' using errcode = 'P0001';
  end if;

  insert into public.employee_marca_counters (organization_id, next_marca, created_by, updated_by)
  values (p_organization_id, 2, (select auth.uid()), (select auth.uid()))
  on conflict (organization_id) do update
    set next_marca = public.employee_marca_counters.next_marca + 1,
        updated_by = (select auth.uid())
  returning next_marca - 1 into v_numar;

  return lpad(v_numar::text, 4, '0');
end;
$$;

revoke all on function public.urmatoarea_marca(uuid) from public, anon;
grant execute on function public.urmatoarea_marca(uuid) to authenticated;
