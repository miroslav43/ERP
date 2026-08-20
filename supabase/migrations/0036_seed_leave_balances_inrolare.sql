-- supabase/migrations/0036_seed_leave_balances_inrolare.sql
-- Numerotat 0036 (nu 0035): o altă sesiune a scris concurrent
-- 0035_reguli_concediu.sql pe același director — coliziune de numerotare
-- descoperită la typecheck (RPC `aplica_drepturi_concediu` lipsă din tipurile
-- regenerate). Fișierul de față s-a aplicat deja pe bază sub numele
-- `seed_leave_balances_inrolare` (vezi apply_migration) — doar fișierul local
-- s-a redenumit, ca ordinea pe disc să rămână neambiguă.
-- Etapa 1, punctul 5 din foaia de parcurs: soldul de concediu al unui angajat
-- nou nu se însămânța la înrolare — `internal.asigura_sold()` îl crea LENEȘ,
-- abia la prima cerere/aprobare (comentariu explicit în
-- src/lib/queries/leave.ts). `internal.*` nu e expus prin PostgREST (vezi
-- 0034), deci fluxul de înrolare are nevoie de un wrapper `public.*` care
-- însămânțează toate tipurile active dintr-o singură lovitură — inclusiv
-- suprascrierea „odihna" cu valoarea aleasă în contract, dacă diferă de
-- implicitul organizației.

create or replace function public.seed_leave_balances(
  p_employee uuid,
  p_an integer,
  p_zile_odihna_override numeric default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_tip record;
  v_sold_id uuid;
begin
  select e.organization_id into v_org
  from public.employees e
  where e.id = p_employee and e.deleted_at is null;

  if v_org is null then
    raise exception 'Fișa de angajat nu există sau a fost ștearsă.' using errcode = 'P0001';
  end if;
  if not (v_org = any ((select app.current_org_ids())::uuid[])) then
    raise exception 'Fișa de angajat aparține altei organizații.' using errcode = 'P0001';
  end if;
  -- Însămânțarea soldului e o consecință directă a înrolării, nu o acțiune
  -- separată de gestiune a concediilor — pragul e cel al înrolării.
  if app.has_permission(v_org, 'employees', 'create') <> 'all' then
    raise exception 'Nu aveți dreptul de a înrola angajați.' using errcode = 'P0001';
  end if;

  for v_tip in
    select id, key, zile_implicite
    from public.leave_types
    where organization_id = v_org and activ and deleted_at is null
  loop
    v_sold_id := internal.asigura_sold(v_org, p_employee, v_tip.id, p_an);

    if v_tip.key = 'odihna'
       and p_zile_odihna_override is not null
       and p_zile_odihna_override <> v_tip.zile_implicite then
      update public.leave_balances
      set drept_anual = p_zile_odihna_override
      where id = v_sold_id;
    end if;
  end loop;
end;
$$;

revoke all on function public.seed_leave_balances(uuid, integer, numeric) from public, anon;
grant execute on function public.seed_leave_balances(uuid, integer, numeric) to authenticated;
