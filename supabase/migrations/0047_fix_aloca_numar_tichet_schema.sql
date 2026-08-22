-- supabase/migrations/0047_fix_aloca_numar_tichet_schema.sql
-- Aceeași greșeală ca în 0033, reparată de 0034 pentru mărci: `app.*` nu e
-- expus prin PostgREST — doar `public` este, lucru vizibil în generatorul de
-- tipuri, care nu listează decât funcțiile publice. `app.aloca_numar_tichet`
-- din 0045 n-ar fi fost niciodată apelabilă prin `.rpc()` din client.
--
-- Am copiat tiparul de la `app.aloca_numar_inventar`, care e într-adevăr în
-- `app` — dar aceea nu se apelează din TypeScript, ci doar din alte funcții
-- SQL. Diferența nu se vede citind definiția, doar urmărind apelantul.

begin;

drop function if exists app.aloca_numar_tichet(uuid);

create or replace function public.aloca_numar_tichet(p_organization_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_an      integer := extract(year from app.azi_local())::integer;
  v_numar   integer;
  v_prefix  text;
  v_padding smallint;
begin
  if not (
    p_organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(p_organization_id, 'tickets', 'create', 'own')
  ) then
    raise exception using errcode = 'P0001',
      message = 'Nu aveți dreptul de a crea tichete în această organizație.';
  end if;

  insert into public.document_sequences (organization_id, document_type, year, prefix, next_number, padding)
  values (p_organization_id, 'tichet_it', v_an, 'IT', 2, 5)
  on conflict (organization_id, document_type, year) do update
    set next_number = public.document_sequences.next_number + 1,
        updated_at  = now()
  returning next_number - 1, prefix, padding
       into v_numar, v_prefix, v_padding;

  return coalesce(nullif(v_prefix, ''), 'IT') || '-' || v_an::text || '-'
         || lpad(v_numar::text, v_padding, '0');
end;
$$;

comment on function public.aloca_numar_tichet(uuid) is
  'Rezervă următorul număr de tichet („IT-2026-00042”). Numărul se consumă chiar dacă tranzacția eșuează ulterior — o secvență are voie să aibă goluri, dar nu are voie să repete un număr.';

revoke all on function public.aloca_numar_tichet(uuid) from public, anon;
grant execute on function public.aloca_numar_tichet(uuid) to authenticated;

commit;
