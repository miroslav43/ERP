-- supabase/migrations/0190_kpi_luna_proprie_manager.sql
--
-- MANAGERUL ÎȘI VEDE PROPRIA LUNĂ KPI.
--
-- ── DEFECTUL ────────────────────────────────────────────────────────────────
-- `app.can_access_kpi` (0119) decide pe scope-ul lui `evaluations:<acțiune>`:
-- `all` → tot; `team` → subarborele (`is_manager_of`); `own` → doar propria
-- fișă, la citire. Un manager are `team`, iar `is_manager_of` NU conține
-- propria fișă — deci luna LUI, evaluată de șeful lui, îi era invizibilă:
-- portalul e doar al rolului `employee`, iar în aplicație RLS îi întorcea zero
-- rânduri (analiza 2026-10-08, evaluari-L17). Aceeași asimetrie pe care 0170 a
-- reparat-o la evaluarea anuală.
--
-- ── CE FACE ─────────────────────────────────────────────────────────────────
-- Ramura `team` la CITIRE acceptă și propria fișă. Scrierea rămâne ca înainte:
-- `team` pe create/update cere managerul DIRECT al subiectului, deci nimeni nu-și
-- deschide, nu-și notează și nu-și închide propria lună.
--
-- Forward-only: nu atinge 0119. Proba pe banc:
-- `tests/rls/proba-aprobatori-membru.sql` (secțiunea KPI).

begin;

create or replace function app.can_access_kpi(p_org uuid, p_employee uuid, p_action text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case app.has_permission(p_org, 'evaluations', p_action)
    when 'all' then true
    when 'team' then case
      -- Citirea: subarborele ȘI propria fișă — managerul e și el evaluat de cineva.
      when p_action = 'read'
        then app.is_manager_of(p_org, p_employee) or p_employee = app.current_employee_id(p_org)
      else app.este_manager_direct(p_org, p_employee)
    end
    -- Angajatul CITEȘTE, nu scrie. `own` pe create/update e refuz.
    when 'own' then p_action = 'read' and p_employee = app.current_employee_id(p_org)
    else false
  end
$$;

revoke all on function app.can_access_kpi(uuid, uuid, text) from public, anon;
grant execute on function app.can_access_kpi(uuid, uuid, text) to authenticated;

comment on function app.can_access_kpi(uuid, uuid, text) is
  'Poarta KPI-ului lunar: all = tot; team = subarborele la scriere (managerul direct), subarborele plus propria fișă la citire; own = doar citirea propriei fișe.';

commit;
