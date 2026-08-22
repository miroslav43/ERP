-- supabase/migrations/0063_permisiuni_per_angajat.sql
--
-- Permisiuni acordate unui MEMBRU anume, peste implicitul rolului lui.
--
-- Cererea din spate: un angajat are nevoie, punctual, de un modul pe care rolul
-- lui nu i-l dă — cineva ține evidența mașinilor, altcineva primește acces la
-- inventar. Astăzi singura cale e schimbarea rolului, care îi dă mult mai mult
-- decât are nevoie.
--
-- ── Cum se așază peste ce există ────────────────────────────────────────────
--
-- `app.has_permission` alegea deja rândul cel mai specific dintre două niveluri:
--   rândul organizației (`organization_id` not null)  bate  implicitul global.
-- Se adaugă un al treilea, cel mai specific dintre toate:
--   rândul membrului  bate  rândul organizației  bate  implicitul global.
--
-- Un rând de membru se potrivește pe `member_id`, NU pe `role` — ăsta e chiar
-- rostul lui: suprascrie indiferent de rolul purtat. Și n-are sens fără
-- organizație, de unde constrângerea de mai jos.
--
-- ── Ce NU face ─────────────────────────────────────────────────────────────
--
-- Nu schimbă nicio politică RLS și niciun prag. `scope = 'none'` rămâne refuz
-- EXPLICIT și la nivel de membru — util în sine: e felul în care i se ia cuiva
-- un drept pe care rolul i-l dă, fără să-l scoți din rol.
--
-- ⚠️ `app.has_permission` e apelată de fiecare politică RLS din proiect. O
-- regresie aici se manifestă ca refuz tăcut în module fără nicio legătură cu
-- ecranul care a produs-o. De aceea migrarea se termină cu o verificare care
-- exercită toate cele trei niveluri de precedență, pe date reale, în tranzacție.

begin;

-- ── 1. Coloana ──────────────────────────────────────────────────────────────
alter table public.role_permissions
  add column if not exists member_id uuid references public.organization_members (id) on delete cascade;

comment on column public.role_permissions.member_id is
  'Suprascriere pentru UN membru. NULL = rândul se aplică rolului. Bate rândul organizației, care bate implicitul global.';

-- `on delete cascade`: dacă apartenența dispare, suprascrierea n-are subiect.
-- Fără el, rândul ar rămâne orfan și ar reveni la viață dacă id-ul s-ar reutiliza.

alter table public.role_permissions
  drop constraint if exists role_permissions_member_org_ck;
alter table public.role_permissions
  add constraint role_permissions_member_org_ck
  check (member_id is null or organization_id is not null);

-- ── 2. Unicitatea ───────────────────────────────────────────────────────────
--
-- Indexul rămâne PARȚIAL și `nulls not distinct`: fără a doua parte, NULL <>
-- NULL ar lăsa să se insereze oricâte rânduri globale pentru aceeași triadă.
drop index if exists public.role_permissions_uq;
create unique index role_permissions_uq
  on public.role_permissions (organization_id, member_id, role, resource, action)
  nulls not distinct
  where deleted_at is null;

-- Căutarea per membru merită indexul ei: `has_permission` o face la fiecare
-- verificare de politică, adică de multe ori pe rând.
create index if not exists role_permissions_member_idx
  on public.role_permissions (member_id, resource, action)
  where deleted_at is null and member_id is not null;

-- ── 3. Precedența, în funcția centrală ──────────────────────────────────────
create or replace function app.has_permission(
  p_organization_id uuid,
  p_resource text,
  p_action text
)
returns public.permission_scope
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select app.is_platform_admin()) then 'all'::public.permission_scope
    else coalesce(
      (
        with m as (
          select o.id, o.role
          from public.organization_members o
          where o.organization_id = p_organization_id
            and o.user_id = (select auth.uid())
            and o.deleted_at is null
            and o.status = 'active'
          limit 1
        )
        select rp.scope
        from public.role_permissions rp, m
        where rp.deleted_at is null
          and rp.resource = p_resource
          and rp.action = p_action
          -- Rândul de membru se potrivește pe apartenență, indiferent de rol.
          -- Rândul de rol se potrivește pe rol, ca înainte.
          and (rp.member_id = m.id or (rp.member_id is null and rp.role = m.role))
          and (rp.organization_id = p_organization_id or rp.organization_id is null)
        -- `false < true`, deci „nu e NULL" sortează primul: membrul bate
        -- organizația, organizația bate globalul. Inclusiv când valoarea lui e
        -- 'none' — refuz EXPLICIT peste un implicit permisiv.
        order by (rp.member_id is null) asc, (rp.organization_id is null) asc
        limit 1
      ),
      'none'::public.permission_scope
    )
  end;
$$;

comment on function app.has_permission(uuid, text, text) is
  'Absența rândului = refuz. scope = none = refuz explicit. Precedență: rândul membrului > rândul organizației > implicitul global.';

-- ── 4. Citirea propriilor suprascrieri ──────────────────────────────────────
--
-- Fără ramura de membru, `getPermissionMap` — care reface aceeași socoteală în
-- TypeScript, pentru ecrane — n-ar VEDEA rândurile de suprascriere. Nu ar da
-- eroare: ar calcula liniștit permisiunile rolului, iar meniul ar rămâne
-- neschimbat după ce administratorul tocmai a deblocat un modul. Refuz tăcut,
-- exact clasa de defect pe care proiectul o urmărește.
drop policy if exists role_permissions_select on public.role_permissions;
create policy role_permissions_select on public.role_permissions for select to authenticated
using (
  deleted_at is null
  and (
    organization_id is null
    or (select app.is_platform_admin())
    or organization_id = any ((select app.current_org_ids())::uuid[])
  )
);

-- ── 5. Cine poate acorda ────────────────────────────────────────────────────
--
-- `org_admin` oriunde în firmă; `manager` doar pentru subordonații lui.
-- Managerul n-avea până acum niciun `roles:*` — capătă exact atât cât să
-- deblocheze un modul cuiva din echipă, nu să umble la matricea rolurilor.
do $$
begin
  update public.role_permissions
     set scope = 'team', updated_at = now()
   where role = 'manager' and resource = 'roles' and action = 'update'
     and organization_id is null and member_id is null and deleted_at is null;

  -- Fără `on conflict`: indexul e PARȚIAL, iar `on conflict` nu poate ținti un
  -- index parțial decât repetându-i predicatul exact. Aceeași capcană a oprit
  -- deja seed-ul de demonstrație (v. 0023).
  if not found then
    insert into public.role_permissions (role, resource, action, scope)
    values ('manager', 'roles', 'update', 'team');
  end if;
end
$$;

-- Scrierea suprascrierilor: `org_admin` peste tot în firma lui, `manager` doar
-- pentru fișele din subarborele lui.
--
-- `app.membru_din_echipa` traduce „membrul ăsta e în echipa mea" — trece prin
-- fișa de angajat, fiindcă subordonarea trăiește în `employees.manager_path`,
-- nu în `organization_members`.
create or replace function app.membru_din_echipa(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.employees e
      on e.organization_id = m.organization_id
     and e.user_id = m.user_id
     and e.is_primary
     and e.deleted_at is null
    where m.id = p_member_id
      and m.deleted_at is null
      and app.is_manager_of(m.organization_id, e.id)
  );
$$;
comment on function app.membru_din_echipa(uuid) is
  'Membrul indicat are o fișă principală aflată în subarborele de subordonare al fișei curente.';
revoke all on function app.membru_din_echipa(uuid) from public;
grant execute on function app.membru_din_echipa(uuid) to authenticated;

-- Apartenența proprie, ca s-o putem EXCLUDE explicit mai jos.
create or replace function app.membrul_meu(p_organization_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id
  from public.organization_members m
  where m.organization_id = p_organization_id
    and m.user_id = (select auth.uid())
    and m.deleted_at is null
    and m.status = 'active'
  limit 1;
$$;
comment on function app.membrul_meu(uuid) is
  'Rândul propriu din organization_members pentru organizația dată.';
revoke all on function app.membrul_meu(uuid) from public;
grant execute on function app.membrul_meu(uuid) to authenticated;

/*
 * Poarta de scriere, cu două restricții care nu sunt evidente.
 *
 * (1) NIMENI nu-și acordă sieși. `app.is_manager_of` include, deliberat, fișa
 *     proprie în subarborele propriu (comentariul din 0005_hr_rls.sql:37) — deci
 *     fără excluderea explicită, un `manager` cu `roles:update = team` s-ar
 *     regăsi în propria echipă și și-ar putea scrie orice permisiune, inclusiv
 *     `roles:update = all`. Escaladare completă, în doi pași, prin ecranul
 *     gândit ca să deblocheze inventarul cuiva.
 *
 * (2) Resursa `roles` nu se poate acorda pe calea asta. Altfel primul pas de mai
 *     sus s-ar putea face prin interpuși: îi dau colegului `roles:update = all`,
 *     el mi-l dă mie. Suprascrierile per angajat deblochează MODULE, niciodată
 *     sistemul de permisiuni însuși.
 *
 * Cele două împreună fac imposibilă creșterea propriilor drepturi prin această
 * tabelă, indiferent de rol.
 */
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
    or (app.can(organization_id, 'roles', 'update', 'team') and app.membru_din_echipa(member_id))
  )
);

drop policy if exists role_permissions_update on public.role_permissions;
create policy role_permissions_update on public.role_permissions for update to authenticated
using (
  deleted_at is null
  and member_id is not null
  and resource <> 'roles'
  and member_id is distinct from app.membrul_meu(organization_id)
  and organization_id = any ((select app.current_org_ids())::uuid[])
  and (
    app.can(organization_id, 'roles', 'update', 'all')
    or (app.can(organization_id, 'roles', 'update', 'team') and app.membru_din_echipa(member_id))
  )
)
with check (
  member_id is not null
  and resource <> 'roles'
  and member_id is distinct from app.membrul_meu(organization_id)
  and organization_id = any ((select app.current_org_ids())::uuid[])
);

-- Fără politică DELETE, ca peste tot: retragerea unei suprascrieri e o ștergere
-- logică (`deleted_at`), prin UPDATE.
do $$
begin
  execute 'grant insert, update on public.role_permissions to authenticated';
end
$$;

-- ── 6. Verificare: cele trei niveluri de precedență ────────────────────────
--
-- `app.has_permission` nu se poate apela aici — cere `auth.uid()`, adică o
-- sesiune. Se verifică în schimb EXPRESIA de ordonare, care e partea riscantă:
-- pe trei rânduri fabricate (global, organizație, membru) pentru o resursă care
-- nu există nicăieri altundeva, ordinea trebuie să aleagă membrul.
--
-- Rândurile se șterg la final: migrarea nu lasă date de test în urmă.
do $$
declare
  v_org      uuid;
  v_membru   uuid;
  v_ales     public.permission_scope;
begin
  select m.organization_id, m.id into v_org, v_membru
  from public.organization_members m
  where m.deleted_at is null and m.status = 'active'
  limit 1;

  if v_membru is null then
    raise notice 'Verificarea de precedență SĂRITĂ: nicio apartenență activă în bază.';
    return;
  end if;

  insert into public.role_permissions (organization_id, member_id, role, resource, action, scope)
  values (null,  null,     'employee', 'proba_0063', 'read', 'none'),
         (v_org, null,     'employee', 'proba_0063', 'read', 'own'),
         (v_org, v_membru, 'employee', 'proba_0063', 'read', 'all');

  select rp.scope into v_ales
  from public.role_permissions rp
  where rp.deleted_at is null
    and rp.resource = 'proba_0063'
    and rp.action = 'read'
    and (rp.member_id = v_membru or (rp.member_id is null and rp.role = 'employee'))
    and (rp.organization_id = v_org or rp.organization_id is null)
  order by (rp.member_id is null) asc, (rp.organization_id is null) asc
  limit 1;

  if v_ales is distinct from 'all' then
    raise exception 'PRECEDENȚĂ GREȘITĂ: rândul de membru ar fi trebuit să câștige, a ieșit %', v_ales;
  end if;

  -- Fără rândul de membru, câștigă organizația.
  delete from public.role_permissions
   where resource = 'proba_0063' and member_id = v_membru;

  select rp.scope into v_ales
  from public.role_permissions rp
  where rp.deleted_at is null
    and rp.resource = 'proba_0063'
    and rp.action = 'read'
    and rp.member_id is null
    and rp.role = 'employee'
    and (rp.organization_id = v_org or rp.organization_id is null)
  order by (rp.organization_id is null) asc
  limit 1;

  if v_ales is distinct from 'own' then
    raise exception 'PRECEDENȚĂ GREȘITĂ: rândul organizației ar fi trebuit să câștige, a ieșit %', v_ales;
  end if;

  delete from public.role_permissions where resource = 'proba_0063';
  raise notice 'Precedența membru > organizație > global: verificată ✓';
end
$$;

commit;
