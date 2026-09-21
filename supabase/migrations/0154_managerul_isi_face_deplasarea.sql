-- supabase/migrations/0154_managerul_isi_face_deplasarea.sql
--
-- UN MANAGER ÎȘI POATE FACE PROPRIA DEPLASARE.
--
-- ── DE UNDE VINE MIGRAREA ───────────────────────────────────────────────────
-- Seed-ul din 0002 dădea rolului `manager` pe `per_diem` doar `{read, approve}`
-- pe `team`. Un rol are un singur set de drepturi, deci managerul NU moștenește
-- ce are `employee` (`create/update/delete = own`): putea aproba deplasările
-- echipei, dar nu-și putea cere una lui. Reclamat pe 21 sept 2026 de un cont
-- `manager` real — butonul „Deplasare nouă" nu apărea, iar `business_trips_insert`
-- (0015) ar fi refuzat oricum: `poate_accesa_deplasare(..., 'create')` întorcea
-- `none`.
--
-- ── CE SE ADAUGĂ ────────────────────────────────────────────────────────────
-- Exact ce are `employee`, cu `own`: create, update, delete. `own` înseamnă
-- `employee_id = app.current_employee_id(org)` — nu atinge deplasările echipei.
-- `read` și `approve` rămân pe `team`.
--
-- ── CE NU REZOLVĂ ───────────────────────────────────────────────────────────
-- Capcana #16 (aprobarea managerului respinsă de WITH CHECK, care cere
-- `update` pe deplasarea subordonatului) cere `update = team`; `own` nu o
-- atinge. E o decizie separată.
--
-- Fără `on conflict`: indexul unic e parțial (vezi 0023). Actualizare, apoi
-- inserare dacă n-a găsit nimic.

do $$
declare
  v_actiune text;
begin
  foreach v_actiune in array array['create', 'update', 'delete'] loop
    update public.role_permissions
       set scope = 'own', updated_at = now()
     where role = 'manager'
       and resource = 'per_diem'
       and action = v_actiune
       and organization_id is null
       and member_id is null
       and deleted_at is null;

    if not found then
      insert into public.role_permissions (role, resource, action, scope)
      values ('manager', 'per_diem', v_actiune, 'own');
    end if;
  end loop;
end
$$;
