-- supabase/migrations/0197_plafon_acordare_permisiuni.sql
--
-- PE ECHIPĂ SE ACORDĂ CEL MULT CÂT ARE ACORDANTUL.
--
-- ── DEFECTUL ────────────────────────────────────────────────────────────────
-- `role_permissions_insert` (0063) și `role_permissions_update` (0149) verifică
-- CUI i se acordă (`app.membru_din_echipa`), nu și CÂT. Un manager cu
-- `roles:update = team` — fără `payroll:read`, cu `employees:read = team` —
-- îi putea scrie subordonatului `payroll:read = all` (toate salariile) sau
-- `employees:read = all` (CNP-ul și IBAN-ul întregii firme: `hr_read_sensitive`
-- cere `= all`, iar suprascrierile per membru intră în `has_permission`).
-- Managerul însuși nu le vede; le vede interpusul. Exact creșterea de drepturi
-- prin interpuși pe care 0063 o exclude pentru `roles`, deschisă pe celelalte
-- resurse. Probat pe banc: `tests/rls/proba-plafon-acordare.sql`, (1) (2) (5).
--
-- Golul exista din 0063, dar se atingea doar printr-un apel construit de mână:
-- pagina dădea 404 managerului. Din W3-03 pagina i se deschide, deci calea
-- devenea un dropdown (QA PRM-004, MGR-003; revizuirea adversarială a W3-03).
--
-- ── CE FACE ─────────────────────────────────────────────────────────────────
-- Ramura `team` din ambele politici cere în plus ca rândul să încapă în
-- plafon: `scope = 'none'` (refuzul explicit restrânge, nu crește) sau
-- `app.can(org, resource, action, scope)` — adică acordantul are el însuși cel
-- puțin acel scope pe aceeași cheie. În WITH CHECK-ul de UPDATE trece și rândul
-- ȘTERS (`deleted_at is not null`): retragerea prin `sterge_logic` (0164)
-- evaluează WITH CHECK pe rândul rezultat, iar un rând șters nu mai dă nimic
-- nimănui — managerul poate retrage sau restrânge și o suprascriere pe care a
-- scris-o administratorul peste plafonul lui.
--
-- Ramura `all` (administratorul firmei) rămâne fără plafon: el poate oricum
-- schimba rolul oricui.
--
-- Aceeași regulă stă în acțiune (`suprascriePermisiunea`, pentru mesaj) și pe
-- ecran (`plafonulAcordarii`, opțiunile de peste plafon inactive).
--
-- Forward-only: nu atinge 0063 sau 0149; restul condițiilor sunt copiate
-- neschimbate din ultimele lor definiții.

begin;

-- ── 1. INSERT: ultima definiție e în 0063, plus plafonul ────────────────────
drop policy if exists role_permissions_insert on public.role_permissions;
create policy role_permissions_insert on public.role_permissions for insert to authenticated
with check (
  -- Numai suprascrieri de MEMBRU. Matricea de rol rămâne a platformei.
  member_id is not null
  and resource <> 'roles'
  and member_id is distinct from app.membrul_meu(organization_id)
  and organization_id = any ((select app.current_org_ids())::uuid[])
  and (
    app.can(organization_id, 'roles', 'update', 'all')
    or (
      app.can(organization_id, 'roles', 'update', 'team')
      and app.membru_din_echipa(member_id)
      -- Plafonul. `app.can` cu 'none' ar fi mereu fals (cere rang > 0), de-aia
      -- refuzul explicit e ramură separată.
      and (scope = 'none' or app.can(organization_id, resource, action, scope))
    )
  )
);

-- ── 2. UPDATE: ultima definiție e în 0149, plus plafonul în WITH CHECK ──────
-- USING-ul rămâne cel din 0149: managerul ATINGE orice suprascriere a unui
-- subordonat (ca s-o poată restrânge sau retrage); plafonul se pune pe rândul
-- REZULTAT, adică pe ce rămâne acordat.
drop policy if exists role_permissions_update on public.role_permissions;
create policy role_permissions_update on public.role_permissions
for update to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and (
    app.can(organization_id, 'roles', 'update', 'all')
    or (
      app.has_permission(organization_id, 'roles', 'update') = 'team'
      and app.membru_din_echipa(member_id)
    )
  )
)
with check (
  member_id is not null
  and resource <> 'roles'
  and member_id is distinct from app.membrul_meu(organization_id)
  and organization_id = any ((select app.current_org_ids())::uuid[])
  and (
    app.can(organization_id, 'roles', 'update', 'all')
    or (
      app.has_permission(organization_id, 'roles', 'update') = 'team'
      and app.membru_din_echipa(member_id)
      and (
        deleted_at is not null
        or scope = 'none'
        or app.can(organization_id, resource, action, scope)
      )
    )
  )
);

commit;
