-- supabase/migrations/0058_concedii_anulare_curata_sarcinile.sql
-- Redenumită din 0057, ocupat între timp în amonte. NU a fost încă rulată.
-- O cerere anulată își lăsa sarcinile de aprobare deschise.
--
-- `internal.approval_tasks_anuleaza_surori` acoperă doar cazul în care CINEVA
-- DECIDE: prima decizie anulează surorile de la aceeași treaptă. Când cererea
-- iese din flux fără decizie — angajatul o anulează, sau e întreruptă — nimeni
-- nu atinge sarcinile, iar ele rămân `in_asteptare` la nesfârșit.
--
-- Nu se vede în ecranul de aprobări, pentru că lista filtrează după statusul
-- CERERII, nu al sarcinii. Se vede însă în orice numărătoare făcută pe sarcini:
-- un badge „ai N de aprobat”, un raport de SLA, o notificare de reamintire.
-- La data scrierii, pe baza de dezvoltare, trei astfel de sarcini orfane.

begin;

-- ============================================================
-- 1. TRIGGERUL
-- ============================================================

create or replace function internal.leave_requests_inchide_sarcinile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Doar ieșirile din flux. 'respinsa' și 'aprobata' vin dintr-o decizie pe o
  -- sarcină, iar `anuleaza_surori` a curățat deja restul — dar le includem
  -- oricum: dacă fluxul ajunge vreodată la mai multe trepte, sarcinile de pe
  -- treptele următoare n-ar fi atinse de acel trigger.
  if new.status not in ('anulata', 'respinsa', 'aprobata', 'intrerupta')
     or old.status is not distinct from new.status then
    return null;
  end if;

  -- `status` și `decis_la` sunt în lista albă a lui `approval_tasks_imutabile`,
  -- deci trecerea e permisă și fără context de serviciu.
  update public.approval_tasks
     set status = 'anulata', decis_la = coalesce(decis_la, now()), updated_at = now()
   where entity_type = 'leave_request'
     and entity_id = new.id
     and status = 'in_asteptare'
     and deleted_at is null;

  return null;
end;
$$;

revoke all on function internal.leave_requests_inchide_sarcinile() from public, anon, authenticated;

-- Prefixul `z`, ca la celelalte: trebuie să ruleze DUPĂ
-- `trg_leave_requests_sincronizeaza`, care creează sarcinile. Altfel, la o
-- cerere care ar trece direct într-o stare finală, am anula sarcini inexistente
-- și le-am recrea imediat după.
create trigger trg_zleave_requests_inchide_sarcinile
  after update of status on public.leave_requests
  for each row execute function internal.leave_requests_inchide_sarcinile();

-- ============================================================
-- 2. SARCINILE ORFANE EXISTENTE
-- ============================================================
-- Aceleași sarcini pe care triggerul le-ar fi închis dacă exista atunci.

update public.approval_tasks t
   set status = 'anulata', decis_la = coalesce(t.decis_la, now()), updated_at = now()
  from public.leave_requests r
 where r.id = t.entity_id
   and t.entity_type = 'leave_request'
   and t.status = 'in_asteptare'
   and t.deleted_at is null
   and r.status in ('anulata', 'respinsa', 'aprobata', 'intrerupta');

commit;
