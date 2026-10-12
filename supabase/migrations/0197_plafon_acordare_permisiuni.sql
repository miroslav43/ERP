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
-- puțin acel scope pe aceeași cheie. Managerul poate restrânge (la `none`) și o
-- suprascriere pe care a scris-o administratorul peste plafonul lui.
--
-- ── RETRAGEREA NU E NEUTRĂ ──────────────────────────────────────────────────
-- Retragerea prin `sterge_logic` (0164) evaluează WITH CHECK pe rândul ȘTERS.
-- Un rând șters nu mai dă nimic el însuși, dar ștergerea lui DĂ: `has_permission`
-- (0063) cade atunci pe implicitul rolului membrului. Un `payroll:read = none`
-- pus de administrator pe un `hr` (rolul dă `all`), retras de un manager fără
-- salarizare, îi redeschidea subordonatului toate salariile — exact acordarea
-- prin interpus de mai sus, pe calea retragerii (prima formă a acestei migrări
-- lăsa trecut orice rând șters). De aceea, pe rândul șters, plafonul se pune pe
-- dreptul REZULTAT: `app.implicitul_rolului_membrului` (aceeași precedență ca
-- `has_permission`, fără rândul membrului) trebuie să fie `none` sau să încapă
-- în `app.can` al acordantului. Probat: proba-plafon-acordare.sql (10)–(12).
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

-- ── 0. Ce ar avea membrul FĂRĂ suprascrierea lui ────────────────────────────
-- Aceeași precedență ca `app.has_permission` (0063), minus rândul de membru:
-- rândul organizației bate implicitul global; niciun rând = 'none'. NULL dacă
-- membrul nu e (activ) în organizație — `app.can(…, NULL)` e fals, iar
-- WITH CHECK-ul cu NULL refuză, deci retragerea pe o apartenență necunoscută
-- nu trece pe ramura de echipă.
--
-- `security definer`: citește rolul altui membru. Garda pe `current_org_ids`
-- nu lasă funcția să răspundă despre o organizație străină apelantului.
create or replace function app.implicitul_rolului_membrului(
  p_organization_id uuid,
  p_member_id uuid,
  p_resource text,
  p_action text
)
returns public.permission_scope
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select rp.scope
      from public.role_permissions rp
      where rp.deleted_at is null
        and rp.member_id is null
        and rp.role = m.role
        and rp.resource = p_resource
        and rp.action = p_action
        and (rp.organization_id = p_organization_id or rp.organization_id is null)
      -- `false < true`: rândul organizației înaintea implicitului global.
      order by (rp.organization_id is null) asc
      limit 1
    ),
    'none'::public.permission_scope
  )
  from public.organization_members m
  where m.id = p_member_id
    and m.organization_id = p_organization_id
    and m.deleted_at is null
    and p_organization_id = any ((select app.current_org_ids())::uuid[]);
$$;

comment on function app.implicitul_rolului_membrului(uuid, uuid, text, text) is
  'Scope-ul pe care membrul l-ar avea fără suprascrierea lui (organizație > global; absent = none). NULL dacă membrul nu e în organizația apelantului. Plafonul retragerii (0197).';

revoke all on function app.implicitul_rolului_membrului(uuid, uuid, text, text) from public, anon;
grant execute on function app.implicitul_rolului_membrului(uuid, uuid, text, text) to authenticated;

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
-- subordonat (ca s-o poată restrânge sau retrage); plafonul se pune pe dreptul
-- REZULTAT: pe rândul viu, scope-ul lui; pe rândul șters, implicitul rolului
-- pe care cade membrul.
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
        case
          when deleted_at is null then
            scope = 'none' or app.can(organization_id, resource, action, scope)
          else
            app.implicitul_rolului_membrului(organization_id, member_id, resource, action) = 'none'
            or app.can(
              organization_id, resource, action,
              app.implicitul_rolului_membrului(organization_id, member_id, resource, action)
            )
        end
      )
    )
  )
);

commit;
