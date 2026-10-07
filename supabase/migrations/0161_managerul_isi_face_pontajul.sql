-- supabase/migrations/0161_managerul_isi_face_pontajul.sql
--
-- UN MANAGER ÎȘI POATE PONTA PROPRIA ZI.
--
-- ── DE UNDE VINE MIGRAREA ───────────────────────────────────────────────────
-- Seed-ul din 0002 dădea rolului `manager` pe `attendance` doar `{read,
-- approve}` pe `team`. Un rol are un singur set de drepturi, deci managerul NU
-- moștenește ce are `employee` (`create = own`): putea aproba pontajul
-- echipei, dar nu se putea ponta pe sine. Reclamat pe 6 oct 2026 de un cont
-- `manager` real — portalul (singurul loc cu „Am intrat"/„Pontează-te acum")
-- îl redirecționează, fiindcă e doar al rolului `employee`, iar în `/pontaj`
-- grila săptămânii îi spunea „nu aveți dreptul de a înregistra pontaj".
-- Aceeași gaură pe care 0154 a închis-o la deplasări.
--
-- ── CE SE ADAUGĂ ────────────────────────────────────────────────────────────
-- `attendance:create = own`. Atât îi trebuie lui `app.poate_scrie_pontaj`, prin
-- care trec AMBELE politici de scriere pe `attendance_entries` (INSERT și
-- UPDATE): ramura `own` cere `employee_id = app.current_employee_id(org)`,
-- deci nu atinge ziua niciunui subordonat. `read` și `approve` rămân `team`.
--
-- ── CE NU SE ADAUGĂ, INTENȚIONAT ────────────────────────────────────────────
-- `attendance:update`. Nu-l cere nicio politică de pe `attendance_entries`; e
-- poarta CONFIGURĂRII (`setari_pontare_rapida_update`, `/pontaj/setari`), iar
-- izolare.sql (l) verifică exact că managerul NU poate stinge aprobarea firmei.
--
-- `attendance_periods_insert` cere `create = all`, deci `own` nu-i deschide
-- managerului crearea de perioade. Nici nu-i trebuie: luna se naște prin
-- `internal.pontaj_perioada_lunii` (0132), SECURITY DEFINER.
--
-- Fără `on conflict`: indexul unic e parțial (vezi 0023). Actualizare, apoi
-- inserare dacă n-a găsit nimic.

do $$
begin
  update public.role_permissions
     set scope = 'own', updated_at = now()
   where role = 'manager'
     and resource = 'attendance'
     and action = 'create'
     and organization_id is null
     and member_id is null
     and deleted_at is null;

  if not found then
    insert into public.role_permissions (role, resource, action, scope)
    values ('manager', 'attendance', 'create', 'own');
  end if;
end
$$;
