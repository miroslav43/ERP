-- ============================================================================
-- 0006_expirables.sql — Faza 4: motorul de expirări, alerte și notificări
-- ----------------------------------------------------------------------------
-- DECIZIE DE ARHITECTURĂ (deja aprobată în plan): o tabelă materializată
-- `expirables`, alimentată prin triggere din tabelele sursă, NU o view cu UNION.
--   * O VIEW cu UNION nu poate avea politici RLS proprii; moștenește ce apucă din
--     tabelele-sursă și se strică TĂCUT în ziua în care cineva adaugă o sursă
--     nouă fără RLS. Eșecul nu e o eroare, e o scurgere de date între firme.
--   * Duplicarea logicii de „scadență + praguri + alertă" în fiecare modul
--     garantează că al treilea modul o va implementa altfel decât primele două.
--   * O tabelă reală poate fi indexată; o view cu UNION peste 5 tabele nu poate
--     susține un semafor de conformitate la mii de rânduri.
-- Costul asumat: sincronizarea. Se plătește o singură dată, în
-- internal.sync_expirable(), pe care modulele o apelează din triggerele lor.
-- ============================================================================

-- Verificare pg_cron (jobul zilnic din josul fișierului depinde de el).
-- Nu oprim migrarea: pe mediile locale extensia poate lipsi legitim.
do $$
begin
  if not exists (select 1 from pg_catalog.pg_extension where extname = 'pg_cron') then
    raise warning 'pg_cron nu este instalat. Pe Supabase: Database > Extensions > pg_cron (sau "create extension pg_cron with schema cron;"). Fără el, jobul zilnic de conformitate nu rulează.';
  end if;
end
$$;

-- ============================================================================
-- 1. expirables — proiecția comună a tuturor scadențelor
-- ============================================================================

create table public.expirables (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  entity_type              text not null,
  entity_id                uuid not null,
  kind                     text not null,
  label                    text not null,
  expires_at               date not null,
  responsible_employee_id  uuid references public.employees (id) on delete set null,
  is_active                boolean not null default true,
  source_table             text not null,
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  deleted_at               timestamptz,
  constraint expirables_entity_type_ck  check (entity_type ~ '^[a-z][a-z0-9_]{1,48}$'),
  constraint expirables_kind_ck         check (kind ~ '^[a-z][a-z0-9_]{1,48}$'),
  constraint expirables_source_table_ck check (source_table ~ '^[a-z][a-z0-9_]{1,60}$'),
  constraint expirables_label_ck        check (length(btrim(label)) between 1 and 200),
  constraint expirables_notes_ck        check (notes is null or length(notes) <= 2000)
);

-- CHEIA DE IDENTITATE. `kind` face parte din ea în mod obligatoriu:
-- un stingător are verificare anuală ȘI probă de presiune la 5 ani. Fără `kind`
-- în cheie, a doua scadență ar suprascrie-o pe prima la fiecare sincronizare și
-- ar dispărea TĂCUT — firma ar afla la control că nu avea proba de presiune.
create unique index expirables_identitate_uq
  on public.expirables (organization_id, entity_type, entity_id, kind)
  where deleted_at is null;

-- Indexul care susține app.dashboard_conformitate() la mii de rânduri:
-- organization_id pe egalitate (primul), expires_at pe interval (al doilea),
-- iar entity_type în INCLUDE ca agregarea să se rezolve prin index-only scan,
-- fără atingerea heap-ului. Predicatul parțial ține în index doar rândurile care
-- contează pentru semafor (active, neșterse) — flota vândută nu ocupă spațiu.
create index expirables_dashboard_idx
  on public.expirables (organization_id, expires_at)
  include (entity_type)
  where deleted_at is null and is_active;

create index expirables_responsabil_idx
  on public.expirables (organization_id, responsible_employee_id)
  where deleted_at is null and responsible_employee_id is not null;

comment on table public.expirables is
  'Proiecție comună a scadențelor din toate modulele. Se scrie DOAR prin internal.sync_expirable(), apelată din triggerele tabelelor sursă.';
comment on column public.expirables.is_active is
  'Semantică DIFERITĂ de deleted_at. deleted_at = rândul nu mai există logic (scadență ștearsă). is_active=false = entitatea-sursă e inactivă (vehicul casat, angajat plecat), dar istoricul rămâne interogabil. Fără is_active, flota vândută ar polua dashboardul la infinit.';
comment on column public.expirables.source_table is
  'Tabela care deține adevărul. Serveşte la diagnostic şi la re-sincronizarea totală.';

-- ============================================================================
-- 2. alert_rules — praguri configurabile, cu istoric
-- ============================================================================
-- Potrivirea se face de la specific la general folosind sentinela '*'
-- (NU NULL: în indexurile unice NULL-urile se comportă diferit de la o versiune
-- la alta, iar '*' se citeşte identic în SQL şi în interfaţă).

create table public.alert_rules (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations (id) on delete cascade,
  entity_type            text not null default '*',
  kind                   text not null default '*',
  praguri_zile           integer[] not null default array[30, 14, 7],
  alerteaza_la_depasire  boolean not null default true,
  valabil_de_la          date not null default current_date,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz,
  constraint alert_rules_entity_type_ck check (entity_type = '*' or entity_type ~ '^[a-z][a-z0-9_]{1,48}$'),
  constraint alert_rules_kind_ck        check (kind = '*' or kind ~ '^[a-z][a-z0-9_]{1,48}$'),
  constraint alert_rules_praguri_ck     check (
    coalesce(array_length(praguri_zile, 1), 0) between 1 and 8
    and 0 < all (praguri_zile)
    and 3650 >= all (praguri_zile)
  )
);

-- Istoric: o regulă nu se rescrie, se adaugă o versiune nouă cu alt valabil_de_la.
create unique index alert_rules_versiune_uq
  on public.alert_rules (organization_id, entity_type, kind, valabil_de_la)
  where deleted_at is null;

create index alert_rules_cautare_idx
  on public.alert_rules (organization_id, entity_type, kind, valabil_de_la desc)
  where deleted_at is null;

comment on column public.alert_rules.praguri_zile is
  'Zile înainte de expirare la care se ridică alertă. Implicit 30/14/7. Pragul 0 este rezervat depăşirii şi nu se configurează aici.';

-- ============================================================================
-- 3. compliance_alerts — alertele generate, cu deduplicare la nivel de schemă
-- ============================================================================

create table public.compliance_alerts (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  expirable_id     uuid not null references public.expirables (id) on delete cascade,
  prag_zile        integer not null,
  due_date         date not null,
  status           text not null default 'nou',
  acknowledged_by  uuid references public.profiles (id) on delete set null,
  acknowledged_at  timestamptz,
  resolved_at      timestamptz,
  resolved_by      uuid references public.profiles (id) on delete set null,
  nota             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  constraint compliance_alerts_prag_ck   check (prag_zile between 0 and 3650),
  constraint compliance_alerts_status_ck check (status in ('nou', 'confirmat', 'rezolvat', 'expirat')),
  constraint compliance_alerts_nota_ck   check (nota is null or length(nota) <= 1000)
);

-- GARANŢIA DE IDEMPOTENŢĂ, la nivel de constrângere, nu de cod: jobul rulat de
-- două ori în aceeaşi zi nu poate crea a doua alertă.
-- Indexul este INTENŢIONAT total, nu parţial pe deleted_at (excepţie asumată de
-- la regula generală): dacă ar fi parţial, o alertă ştearsă logic ar fi
-- regenerată mâine de job, la nesfârşit. Ştergerea trebuie să fie definitivă
-- pentru motor, chiar dacă rândul rămâne pentru istoric.
create unique index compliance_alerts_dedup_uq
  on public.compliance_alerts (expirable_id, prag_zile, due_date);

create index compliance_alerts_inbox_idx
  on public.compliance_alerts (organization_id, status, due_date)
  where deleted_at is null;

comment on column public.compliance_alerts.prag_zile is
  '0 = alertă de depăşire (scadenţa a trecut). >0 = pragul de avertizare atins.';

-- ============================================================================
-- 4. alert_notifications — ce s-a trimis deja, pe ce canal, cui
-- ============================================================================

create table public.alert_notifications (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  alert_id                 uuid not null references public.compliance_alerts (id) on delete cascade,
  canal                    text not null,
  recipient_user_id        uuid references public.profiles (id) on delete set null,
  recipient_employee_id    uuid references public.employees (id) on delete set null,
  notification_id          uuid references public.notifications (id) on delete set null,
  email_log_id             uuid references public.email_log (id) on delete set null,
  status                   text not null default 'in_asteptare',
  sent_at                  timestamptz,
  eroare                   text,
  destinatar_cheie         text generated always as (
                             coalesce(recipient_user_id::text, recipient_employee_id::text, 'organizatie')
                           ) stored,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  deleted_at               timestamptz,
  constraint alert_notifications_canal_ck  check (canal in ('in_app', 'email')),
  constraint alert_notifications_status_ck check (status in ('in_asteptare', 'trimis', 'esuat'))
);

-- Acelaşi raţionament ca la dedup-ul alertelor: index total, ca o repornire a
-- jobului să nu trimită a doua oară acelaşi e-mail aceluiaşi om.
create unique index alert_notifications_dedup_uq
  on public.alert_notifications (alert_id, canal, destinatar_cheie);

create index alert_notifications_coada_idx
  on public.alert_notifications (organization_id, status)
  where deleted_at is null and status = 'in_asteptare';

-- ============================================================================
-- 5. Helperi
-- ============================================================================

create or replace function app.azi_local()
returns date
language sql
stable
security invoker
set search_path = ''
as $$
  select (now() at time zone 'Europe/Bucharest')::date;
$$;

comment on function app.azi_local() is
  'Ziua calendaristică în fusul operaţional. Când organizations va purta fus propriu, aici se schimbă, într-un singur loc.';

create or replace function internal.praguri_implicite()
returns integer[]
language sql
immutable
set search_path = ''
as $$
  select array[30, 14, 7];
$$;

create or replace function internal.seteaza_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ============================================================================
-- 6. Triggere de integritate (regulile temporale nu pot sta în CHECK: now() şi
--    current_date nu sunt IMMUTABLE). Cod P0001, mesaj pentru administrator.
-- ============================================================================

create or replace function internal.expirables_protejeaza()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.sincronizare_expirari', true), 'off') <> 'on' then
    if new.organization_id is distinct from old.organization_id
       or new.entity_type  is distinct from old.entity_type
       or new.entity_id    is distinct from old.entity_id
       or new.kind         is distinct from old.kind
       or new.source_table is distinct from old.source_table
       or new.expires_at   is distinct from old.expires_at
       or new.is_active    is distinct from old.is_active then
      raise exception using
        errcode = 'P0001',
        message = 'Scadenţa se modifică din modulul care o generează (de exemplu fişa vehiculului), nu direct din lista de conformitate.';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function internal.alert_rules_normalizeaza()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select array_agg(distinct v order by v desc)
    into new.praguri_zile
    from unnest(new.praguri_zile) as t(v)
   where v > 0;

  if new.praguri_zile is null or array_length(new.praguri_zile, 1) is null then
    raise exception using
      errcode = 'P0001',
      message = 'Regula de alertare are nevoie de cel puţin un prag în zile (de exemplu 30, 14 şi 7).';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function internal.compliance_alerts_valideaza()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id
       or new.expirable_id is distinct from old.expirable_id
       or new.prag_zile    is distinct from old.prag_zile
       or new.due_date     is distinct from old.due_date then
      raise exception using
        errcode = 'P0001',
        message = 'Identitatea unei alerte nu se poate schimba. Dacă scadenţa s-a mutat, alerta veche se închide şi se generează una nouă.';
    end if;

    if old.status = 'rezolvat' and new.status in ('nou', 'confirmat') then
      raise exception using
        errcode = 'P0001',
        message = 'Alerta a fost deja rezolvată şi nu mai poate fi redeschisă. Reînnoirea documentului va genera o alertă nouă.';
    end if;
  end if;

  if new.status in ('confirmat', 'rezolvat') and new.acknowledged_at is null then
    new.acknowledged_at := now();
  end if;

  if new.status = 'rezolvat' and new.resolved_at is null then
    new.resolved_at := now();
  end if;

  if new.status in ('nou', 'expirat') then
    new.resolved_at := null;
    new.resolved_by := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger expirables_bu
  before update on public.expirables
  for each row execute function internal.expirables_protejeaza();

create trigger alert_rules_biu
  before insert or update on public.alert_rules
  for each row execute function internal.alert_rules_normalizeaza();

create trigger compliance_alerts_biu
  before insert or update on public.compliance_alerts
  for each row execute function internal.compliance_alerts_valideaza();

create trigger alert_notifications_bu
  before update on public.alert_notifications
  for each row execute function internal.seteaza_updated_at();

-- ============================================================================
-- 7. RLS — enable + force pe toate cele patru tabele
-- ============================================================================

alter table public.expirables           enable row level security;
alter table public.expirables           force  row level security;
alter table public.alert_rules          enable row level security;
alter table public.alert_rules          force  row level security;
alter table public.compliance_alerts    enable row level security;
alter table public.compliance_alerts    force  row level security;
alter table public.alert_notifications  enable row level security;
alter table public.alert_notifications  force  row level security;


-- ── Permisiunea entității sursă ─────────────────────────────────────────────
--
-- O tabelă polimorfă nu poate avea o singură regulă de vizibilitate: rândurile
-- ei descriu lucruri cu regimuri diferite. Maparea trăiește într-un singur loc,
-- ca un modul nou să nu poată apărea în dashboard fără să declare explicit ce
-- drept îl protejează.
--
-- Implicitul este RESTRICTIV: un `entity_type` necunoscut cere `employees:read`
-- la scope `all` — cel mai îngust drept din listă. Un modul adăugat fără a fi
-- înregistrat aici devine invizibil, nu vizibil tuturor.
create or replace function app.poate_vedea_expirabil(
  p_organization_id uuid,
  p_entity_type text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_entity_type
    -- Date de sănătate: cer dreptul asupra fișei de angajat, nu cel de conformitate.
    when 'medical_exam'        then app.has_permission(p_organization_id, 'employees', 'read') = 'all'
    when 'employee_document'   then app.has_permission(p_organization_id, 'employees', 'read') = 'all'
    when 'work_permit'         then app.has_permission(p_organization_id, 'employees', 'read') = 'all'
    when 'employment_contract' then app.has_permission(p_organization_id, 'employees', 'read') = 'all'
    -- Documente de firmă: dreptul de conformitate este suficient.
    when 'vehicle_document'    then app.can(p_organization_id, 'vehicles', 'read', 'own')
    when 'equipment'           then app.can(p_organization_id, 'maintenance', 'read', 'own')
    when 'fire_extinguisher'   then app.can(p_organization_id, 'ssm', 'read', 'own')
    when 'ssm_training'        then app.can(p_organization_id, 'ssm', 'read', 'own')
    when 'environmental_permit' then app.can(p_organization_id, 'compliance', 'read', 'own')
    else app.has_permission(p_organization_id, 'employees', 'read') = 'all'
  end;
$$;

revoke all on function app.poate_vedea_expirabil(uuid, text) from public, anon;
grant execute on function app.poate_vedea_expirabil(uuid, text) to authenticated;

-- --- expirables -------------------------------------------------------------
-- Vizibilitatea urmează scope-ul permisiunii: 'all' = toată firma,
-- 'team' = ce răspunde omul meu, 'own' = doar ce răspund eu.
-- Rândurile fără responsabil sunt vizibile numai la scope 'all' — intenţionat:
-- o scadenţă fără responsabil este o problemă de administrare, nu de echipă.
create policy expirabile_select on public.expirables
  for select to authenticated
  using (
    deleted_at is null
    and (
      (select app.is_platform_admin())
      or (
        organization_id = any ((select app.current_org_ids())::uuid[])
        -- Permisiunea ENTITĂȚII SURSĂ, nu doar cea generică de conformitate.
        --
        -- `expirables` este polimorfă: același rând poate descrie o rovinietă
        -- sau o fișă de aptitudine medicală. `compliance:read` este un drept
        -- administrativ, pe care îl are și un referent — iar `label` copiază
        -- text din sursă („Fișă de aptitudine — Popescu Ana, inapt"), deci
        -- ETICHETA ESTE informația. Fără verificarea de mai jos, o dată de
        -- sănătate ar deveni vizibilă oricui urmărește scadențele, și ar ajunge
        -- și în emailul zilnic, și în `email_log`.
        and app.poate_vedea_expirabil(organization_id, entity_type)
        and (
          app.has_permission(organization_id, 'compliance', 'read') = 'all'
          or (
            app.has_permission(organization_id, 'compliance', 'read') = 'team'
            and (
              responsible_employee_id = app.current_employee_id(organization_id)
              or app.is_manager_of(organization_id, responsible_employee_id)
            )
          )
          or (
            app.has_permission(organization_id, 'compliance', 'read') = 'own'
            and responsible_employee_id = app.current_employee_id(organization_id)
          )
        )
      )
    )
  );

-- Inserarea aparţine motorului (internal.sync_expirable) şi contextului de
-- serviciu. Clientul nu creează scadenţe direct: le creează salvând vehiculul.
create policy expirabile_insert on public.expirables
  for insert to authenticated
  with check (
    (select app.is_service_context())
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and is_active = true
  );

-- Utilizatorul poate schimba doar responsabilul şi notele; restul e blocat de
-- triggerul internal.expirables_protejeaza().
create policy expirabile_update on public.expirables
  for update to authenticated
  using (
    deleted_at is null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      (select app.is_service_context())
      or app.can(organization_id, 'compliance', 'update', 'team')
    )
  )
  with check (
    deleted_at is null
    and organization_id = any ((select app.current_org_ids())::uuid[])
  );

-- --- alert_rules ------------------------------------------------------------
create policy reguli_select on public.alert_rules
  for select to authenticated
  using (
    deleted_at is null
    and (
      (select app.is_platform_admin())
      or (
        organization_id = any ((select app.current_org_ids())::uuid[])
        and app.has_permission(organization_id, 'compliance', 'read') = 'own'
      )
    )
  );

create policy reguli_insert on public.alert_rules
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'compliance', 'create', 'all')
    and deleted_at is null
  );

create policy reguli_update on public.alert_rules
  for update to authenticated
  using (
    deleted_at is null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'compliance', 'update', 'all')
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
  );

-- --- compliance_alerts ------------------------------------------------------
-- Vizibilitatea alertei se moşteneşte din vizibilitatea scadenţei: subinterogarea
-- pe expirables este ea însăşi filtrată de RLS-ul de mai sus, deci regula de
-- scope se scrie o singură dată şi nu poate diverge.
create policy alerte_select on public.compliance_alerts
  for select to authenticated
  using (
    deleted_at is null
    and (
      (select app.is_platform_admin())
      or (
        organization_id = any ((select app.current_org_ids())::uuid[])
        and exists (
          select 1 from public.expirables x where x.id = expirable_id
        )
      )
    )
  );

create policy alerte_insert on public.compliance_alerts
  for insert to authenticated
  with check (
    (select app.is_service_context())
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and status in ('nou', 'expirat')
    and acknowledged_by is null
    and acknowledged_at is null
    and resolved_at is null
    and resolved_by is null
  );

create policy alerte_update on public.compliance_alerts
  for update to authenticated
  using (
    deleted_at is null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      (select app.is_service_context())
      or app.can(organization_id, 'compliance', 'update', 'team')
    )
    and exists (select 1 from public.expirables x where x.id = expirable_id)
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
  );

-- --- alert_notifications ----------------------------------------------------
create policy notificari_select on public.alert_notifications
  for select to authenticated
  using (
    deleted_at is null
    and (
      (select app.is_platform_admin())
      or (
        organization_id = any ((select app.current_org_ids())::uuid[])
        and app.has_permission(organization_id, 'compliance', 'read') = 'all'
      )
    )
  );

create policy notificari_insert on public.alert_notifications
  for insert to authenticated
  with check (
    (select app.is_service_context())
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and status = 'in_asteptare'
    and sent_at is null
    and eroare is null
  );

create policy notificari_update on public.alert_notifications
  for update to authenticated
  using (
    deleted_at is null
    and (select app.is_service_context())
    and organization_id = any ((select app.current_org_ids())::uuid[])
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
  );

-- ============================================================================
-- 8. Drepturi. Soft delete peste tot: DELETE nu este acordat nimănui în afară
--    de service_role, şi nicio politică DELETE nu există.
-- ============================================================================

revoke all on public.expirables, public.alert_rules,
              public.compliance_alerts, public.alert_notifications
  from anon, authenticated;

grant select, insert, update on public.expirables          to authenticated;
grant select, insert, update on public.alert_rules         to authenticated;
grant select, insert, update on public.compliance_alerts   to authenticated;
grant select, insert, update on public.alert_notifications to authenticated;

grant all on public.expirables, public.alert_rules,
             public.compliance_alerts, public.alert_notifications
  to service_role;

-- ============================================================================
-- 9. internal.sync_expirable — punctul unic de scriere.
--    SEMNĂTURĂ STABILĂ: modulele viitoare (flotă, SSM, mentenanţă) o apelează
--    din triggerele lor. Parametrii noi se adaugă doar la coadă, cu default.
-- ============================================================================

create or replace function internal.sync_expirable(
  p_organization_id         uuid,
  p_entity_type             text,
  p_entity_id               uuid,
  p_kind                    text,
  p_label                   text,
  p_expires_at              date,
  p_source_table            text,
  p_responsible_employee_id uuid    default null,
  p_is_active               boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id            uuid;
  v_expires_vechi date;
begin
  if p_organization_id is null or p_entity_type is null
     or p_entity_id is null or p_kind is null or p_source_table is null then
    raise exception using
      errcode = 'P0001',
      message = 'Sincronizarea scadenţei a primit date incomplete. Contactaţi administratorul aplicaţiei.';
  end if;

  -- Apărare în adâncime: funcţia rulează cu drepturi ridicate, deci refuză
  -- explicit scrierea în altă organizaţie decât cea a apelantului.
  if not (
    app.is_service_context()
    or app.is_platform_admin()
    or p_organization_id = any ((select app.current_org_ids())::uuid[])
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Nu aveţi acces la organizaţia pentru care s-a cerut sincronizarea scadenţei.';
  end if;

  perform set_config('app.sincronizare_expirari', 'on', true);

  select e.id, e.expires_at
    into v_id, v_expires_vechi
    from public.expirables e
   where e.organization_id = p_organization_id
     and e.entity_type = p_entity_type
     and e.entity_id = p_entity_id
     and e.kind = p_kind
     and e.deleted_at is null;

  -- Scadenţă golită în sursă (câmp şters) => rândul dispare logic, iar alertele
  -- deschise se închid. Nu ştergem fizic: istoricul de conformitate rămâne.
  if p_expires_at is null then
    if v_id is not null then
      update public.expirables
         set deleted_at = now(), updated_at = now()
       where id = v_id;

      update public.compliance_alerts
         set status = 'rezolvat',
             resolved_at = now(),
             nota = 'Închisă automat: scadenţa a fost eliminată din documentul sursă.',
             updated_at = now()
       where expirable_id = v_id
         and status in ('nou', 'confirmat', 'expirat')
         and deleted_at is null;
    end if;
    perform set_config('app.sincronizare_expirari', 'off', true);
    return null;
  end if;

  insert into public.expirables as e (
    organization_id, entity_type, entity_id, kind, label, expires_at,
    responsible_employee_id, is_active, source_table
  )
  values (
    p_organization_id, p_entity_type, p_entity_id, p_kind,
    coalesce(nullif(btrim(p_label), ''), p_kind), p_expires_at,
    p_responsible_employee_id, coalesce(p_is_active, true), p_source_table
  )
  on conflict (organization_id, entity_type, entity_id, kind) where deleted_at is null
  do update set
    label                   = excluded.label,
    expires_at              = excluded.expires_at,
    responsible_employee_id = coalesce(excluded.responsible_employee_id, e.responsible_employee_id),
    is_active               = excluded.is_active,
    source_table            = excluded.source_table,
    updated_at              = now()
  returning e.id into v_id;

  -- Reînnoire: documentul a primit o dată nouă, alertele pentru data veche nu
  -- mai au obiect. Le închidem aici, ca dashboardul să nu rămână roşu degeaba.
  if v_expires_vechi is not null and v_expires_vechi <> p_expires_at then
    update public.compliance_alerts
       set status = 'rezolvat',
           resolved_at = now(),
           nota = 'Închisă automat: documentul a fost reînnoit.',
           updated_at = now()
     where expirable_id = v_id
       and due_date = v_expires_vechi
       and status in ('nou', 'confirmat', 'expirat')
       and deleted_at is null;
  end if;

  perform set_config('app.sincronizare_expirari', 'off', true);
  return v_id;
end;
$$;

revoke all on function internal.sync_expirable(uuid, text, uuid, text, text, date, text, uuid, boolean) from public;
grant execute on function internal.sync_expirable(uuid, text, uuid, text, text, date, text, uuid, boolean) to service_role;

-- ============================================================================
-- 10. internal.genereaza_alerte — faza 2 a jobului zilnic
-- ============================================================================

create or replace function internal.genereaza_alerte(p_organization_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_azi date := app.azi_local();
  v_noi integer := 0;
begin
  with tinta as (
    select e.id, e.organization_id, e.entity_type, e.kind, e.expires_at
      from public.expirables e
     where e.deleted_at is null
       and e.is_active
       and (p_organization_id is null or e.organization_id = p_organization_id)
  ),
  cu_regula as (
    select t.*,
           coalesce(r.praguri_zile, internal.praguri_implicite()) as praguri,
           coalesce(r.alerteaza_la_depasire, true)                as la_depasire
      from tinta t
      left join lateral (
        select ar.praguri_zile, ar.alerteaza_la_depasire
          from public.alert_rules ar
         where ar.organization_id = t.organization_id
           and ar.deleted_at is null
           and ar.valabil_de_la <= v_azi
           and ar.entity_type in (t.entity_type, '*')
           and ar.kind in (t.kind, '*')
         order by (ar.entity_type = t.entity_type) desc,
                  (ar.kind = t.kind) desc,
                  ar.valabil_de_la desc
         limit 1
      ) r on true
  ),
  praguri as (
    select c.id as expirable_id, c.organization_id, c.expires_at, p.prag
      from cu_regula c
      cross join lateral unnest(c.praguri) as p(prag)
     where c.expires_at >= v_azi
       and c.expires_at <= v_azi + p.prag
  ),
  depasiri as (
    select c.id as expirable_id, c.organization_id, c.expires_at
      from cu_regula c
     where c.la_depasire
       and c.expires_at < v_azi
  )
  insert into public.compliance_alerts (organization_id, expirable_id, prag_zile, due_date, status)
  select organization_id, expirable_id, prag, expires_at, 'nou' from praguri
  union all
  select organization_id, expirable_id, 0,    expires_at, 'expirat' from depasiri
  on conflict (expirable_id, prag_zile, due_date) do nothing;

  get diagnostics v_noi = row_count;
  return v_noi;
end;
$$;

comment on function internal.genereaza_alerte(uuid) is
  'Idempotentă prin ON CONFLICT DO NOTHING pe (expirable_id, prag_zile, due_date). Rularea de zece ori într-o zi produce acelaşi rezultat ca o singură rulare.';

revoke all on function internal.genereaza_alerte(uuid) from public;
grant execute on function internal.genereaza_alerte(uuid) to service_role;

-- ============================================================================
-- 11. internal.curata_alerte — faza 4 a jobului zilnic
-- ============================================================================

create or replace function internal.curata_alerte(p_organization_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_azi  date := app.azi_local();
  v_afectate integer := 0;
  v_partial  integer := 0;
begin
  -- Alertele a căror scadenţă a trecut devin „expirat", indiferent de pragul lor.
  update public.compliance_alerts a
     set status = 'expirat', updated_at = now()
   where a.deleted_at is null
     and a.status in ('nou', 'confirmat')
     and a.due_date < v_azi
     and (p_organization_id is null or a.organization_id = p_organization_id);
  get diagnostics v_afectate = row_count;

  -- Entitatea-sursă a devenit inactivă (vehicul casat): alertele se închid,
  -- istoricul rămâne. Fără asta, flota vândută rămâne roşie la nesfârşit.
  update public.compliance_alerts a
     set status = 'rezolvat',
         resolved_at = now(),
         nota = coalesce(a.nota, 'Închisă automat: entitatea sursă nu mai este activă.'),
         updated_at = now()
    from public.expirables e
   where e.id = a.expirable_id
     and a.deleted_at is null
     and a.status in ('nou', 'confirmat', 'expirat')
     and (e.is_active = false or e.deleted_at is not null)
     and (p_organization_id is null or a.organization_id = p_organization_id);
  get diagnostics v_partial = row_count;

  return v_afectate + v_partial;
end;
$$;

revoke all on function internal.curata_alerte(uuid) from public;
grant execute on function internal.curata_alerte(uuid) to service_role;

-- ============================================================================
-- 12. app.dashboard_conformitate — semaforul
--     SECURITY INVOKER intenţionat: numărătoarea nu are voie să depăşească
--     vizibilitatea. Un şef de echipă cu scope 'team' vede exact cifrele
--     rândurilor pe care le-ar putea deschide, nu totalul firmei.
--     Susţinută de expirables_dashboard_idx: egalitate pe organization_id,
--     interval pe expires_at, entity_type în INCLUDE => index-only scan, fără
--     atingerea heap-ului (cu condiţia ca autovacuum să menţină visibility map).
-- ============================================================================

create or replace function app.dashboard_conformitate(
  p_organization_id uuid,
  p_zile            integer default 30
)
returns table (
  entity_type     text,
  total           bigint,
  expirate        bigint,
  expira_curand   bigint,
  in_regula       bigint,
  cea_mai_apropiata date
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    e.entity_type,
    count(*)::bigint,
    count(*) filter (where e.expires_at <  app.azi_local())::bigint,
    count(*) filter (where e.expires_at >= app.azi_local()
                       and e.expires_at <= app.azi_local() + greatest(coalesce(p_zile, 30), 0))::bigint,
    count(*) filter (where e.expires_at >  app.azi_local() + greatest(coalesce(p_zile, 30), 0))::bigint,
    min(e.expires_at)
  from public.expirables e
  where e.organization_id = p_organization_id
    and e.deleted_at is null
    and e.is_active
  group by e.entity_type
  order by e.entity_type;
$$;

grant execute on function app.azi_local() to authenticated, service_role;
grant execute on function app.dashboard_conformitate(uuid, integer) to authenticated, service_role;

-- ============================================================================
-- 13. Jurnal de audit.
--     Ataşăm doar acolo unde există o decizie umană: regulile (configurare) şi
--     alertele (cine a confirmat, cine a rezolvat). `expirables` şi
--     `alert_notifications` sunt proiecţii generate de maşină — auditul lor ar
--     îneca jurnalul în zgomot, iar sursa adevărului e deja auditată în modul.
--     Niciuna dintre tabele nu are coloane sensibile, deci garda R9 din
--     internal.attach_audit nu se declanşează.
-- ============================================================================

select internal.attach_audit('alert_rules');
select internal.attach_audit('compliance_alerts');

-- ============================================================================
-- 14. JOBUL ZILNIC (pg_cron + Edge Function) — pseudocod în patru faze
-- ----------------------------------------------------------------------------
-- cron.schedule('conformitate-zilnica', '0 4 * * *',
--   $j$ select net.http_post(url := '<edge>/conformitate-zilnica', ...) $j$);
--
-- FAZA 1 — SINCRONIZARE
--   pentru fiecare organizaţie activă:
--     modulele îşi re-proiectează scadenţele prin internal.sync_expirable(...)
--   idempotenţă: upsert pe cheia unică parţială
--   (organization_id, entity_type, entity_id, kind) WHERE deleted_at IS NULL.
--   A doua rulare scrie exact aceleaşi valori peste ele însele.
--
-- FAZA 2 — GENERARE
--   select internal.genereaza_alerte(org_id);
--   idempotenţă: ON CONFLICT DO NOTHING pe indexul total
--   (expirable_id, prag_zile, due_date). Garanţia stă în constrângere, nu în
--   cod: chiar dacă jobul e pornit de trei ori manual, alerta rămâne una.
--
-- FAZA 3 — NOTIFICARE
--   pentru fiecare alertă cu status 'nou'/'expirat' fără rând în
--   alert_notifications: INSERT (alert_id, canal, destinatar) cu status
--   'in_asteptare' ... ON CONFLICT DO NOTHING; abia apoi se trimite efectiv şi
--   se marchează 'trimis' + sent_at (sau 'esuat' + eroare).
--   idempotenţă: indexul unic (alert_id, canal, destinatar_cheie) — inserarea
--   rezervă dreptul de a trimite ÎNAINTE de trimitere, deci o repornire la
--   mijlocul fazei nu poate dubla e-mailul. Retrimiterea unui 'esuat' este o
--   decizie explicită (update), nu un efect al rulării.
--
-- FAZA 4 — CURĂŢARE
--   select internal.curata_alerte(org_id);
--   idempotenţă: update-uri convergente cu predicate pe starea curentă
--   (status in ('nou','confirmat') and due_date < azi). A doua rulare
--   găseşte zero rânduri de modificat.
--
-- VERIFICARE pg_cron pe Supabase:
--   select extname, extversion from pg_extension where extname = 'pg_cron';
--   select * from cron.job;                    -- joburile definite
--   select * from cron.job_run_details order by start_time desc limit 20;
-- ============================================================================
