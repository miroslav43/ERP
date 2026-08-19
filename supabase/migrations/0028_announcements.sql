-- ─────────────────────────────────────────────────────────────────────────────
-- 0028_announcements.sql — Faza 11, avizierul organizației
--
-- Scop redus deliberat față de inventarul complet din planul aprobat:
-- `announcement_attachments` (atașamente) și `announcement_targets`
-- (direcționare pe departament) rămân neconstruite. Motivul nu e lene, e
-- seed-ul de permisiuni: `role_permissions` acordă `announcements:read = all`
-- TUTUROR rolurilor (`0002_authz.sql`) — un anunț e mereu vizibil întregii
-- organizații, niciodată filtrat pe echipă/departament. O tabelă de
-- direcționare ar fi decorativă cât timp pragul de citire e „all" pentru toată
-- lumea; dacă apare vreodată nevoia, se schimbă întâi seed-ul de permisiuni.
--
-- Fanout-ul spre `notifications` (0001_kernel.sql) exista deja pregătit:
-- `notifications_insert` verifică explicit `announcements:create` pentru cine
-- poate scrie o notificare în numele altui utilizator — semn că integrarea
-- asta a fost intenția inițială, nu o improvizație de-acum.
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on

create table public.announcements (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  titlu            text not null,
  continut         text not null,
  fixat            boolean not null default false,
  publicat_la      timestamptz,
  expira_la        timestamptz,
  created_at       timestamptz not null default now(),
  created_by       uuid references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  deleted_at       timestamptz,
  constraint announcements_titlu_len check (char_length(titlu) between 1 and 200),
  constraint announcements_continut_len check (char_length(continut) between 1 and 10000),
  constraint announcements_expirare_ck
    check (expira_la is null or publicat_la is null or expira_la > publicat_la)
);
create index announcements_org_publicat_idx
  on public.announcements (organization_id, fixat desc, publicat_la desc)
  where deleted_at is null;
create index announcements_created_by_idx on public.announcements (created_by);
create index announcements_updated_by_idx on public.announcements (updated_by);

create table public.announcement_reads (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  announcement_id  uuid not null references public.announcements (id) on delete cascade,
  employee_id      uuid not null references public.employees (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  citit_la         timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
create unique index announcement_reads_uq
  on public.announcement_reads (organization_id, announcement_id, employee_id);
create index announcement_reads_announcement_idx
  on public.announcement_reads (organization_id, announcement_id);

-- updated_at (funcția există din 0004)
create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function internal.seteaza_updated_at();

alter table public.announcements enable row level security;
alter table public.announcements force row level security;
alter table public.announcement_reads enable row level security;
alter table public.announcement_reads force row level security;

-- Un anunț e vizibil întregii organizații odată publicat; administratorii îl
-- văd oricum, ca să-l poată edita înainte de publicare sau după expirare.
create policy announcements_select on public.announcements
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'announcements')
    and (
      app.can(organization_id, 'announcements', 'update', 'all')
      or (
        publicat_la is not null and publicat_la <= now()
        and (expira_la is null or expira_la > now())
      )
    )
  );

create policy announcements_insert on public.announcements
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'announcements')
    and app.can(organization_id, 'announcements', 'create', 'all')
    and deleted_at is null
  );

create policy announcements_update on public.announcements
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'announcements', 'update', 'all')
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'announcements', 'update', 'all')
  );

-- Confirmările de citire: proprii pentru oricine, agregate pentru cine
-- administrează avizierul. Fără UPDATE/DELETE — „am citit la ora X" e o probă,
-- nu o stare editabilă.
create policy announcement_reads_select on public.announcement_reads
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      employee_id = app.current_employee_id(organization_id)
      or app.can(organization_id, 'announcements', 'update', 'all')
    )
  );

create policy announcement_reads_insert on public.announcement_reads
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and employee_id = app.current_employee_id(organization_id)
    and user_id = (select auth.uid())
  );

grant select, insert, update on public.announcements       to authenticated;
grant select, insert         on public.announcement_reads  to authenticated;

grant all on public.announcements, public.announcement_reads to service_role;

-- `announcement_reads` nu intră în audit: e ea însăși un jurnal de citire, nu
-- date de business care se modifică — la fel ca `leave_request_days` sau
-- `leave_balances` din 0009_leave.sql.
select internal.attach_audit('announcements');
