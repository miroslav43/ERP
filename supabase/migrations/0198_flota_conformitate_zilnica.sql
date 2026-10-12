-- supabase/migrations/0198_flota_conformitate_zilnica.sql
--
-- FLOTA, FAZA F5: SETĂRILE FLOTEI, ALERTELE DE SCADENȚĂ ȘI NOTIFICĂRILE PE
-- FLUXUL FOII DE PARCURS.
--
-- Planul o numea `0175_conformitate_zilnica`; între timp 0174–0197 s-au ocupat
-- (alocări, mentenanță, registru, asistent, salarizare, tichete, aprobatori,
-- KPI, flota F3/F4), deci e 0198.
--
-- ── DE UNDE VINE ────────────────────────────────────────────────────────────
-- `0008_expirables.sql` a construit motorul de scadențe (`expirables`,
-- `alert_rules`, `compliance_alerts`, `alert_notifications`) și a lăsat jobul
-- zilnic COMENTAT (`0008:897`): alertele nu s-au generat niciodată, iar ITP-ul
-- unei mașini expira fără ca cineva să afle altfel decât deschizând lista.
-- `fleet_settings` (responsabilii de flotă, pragul de salt) era în F2 și a fost
-- mutat explicit aici, înaintea jobului care are nevoie de responsabili.
--
-- ── CE ADUCE ────────────────────────────────────────────────────────────────
-- A. `public.fleet_settings`, un rând per firmă: responsabilii de flotă (fișe
--    de angajat; gol = toți `org_admin`), pragul de salt al kilometrajului
--    (înlocuiește `internal.flota_prag_salt_km()`, hardcodat la 1.500 în 0012)
--    și pragurile de alertă (implicit 30/14/7), oglindite de un trigger în
--    `alert_rules` pe `entity_type = 'vehicle_document'`. `alert_rules` cere
--    `compliance:*` prin politică; pragurile flotei le schimbă cine are
--    `vehicles:update = all`, deci triggerul (definer) e punctul unic de scriere.
--    Citire: `vehicles:read` ≠ none. Scriere: `vehicles:update = all`.
-- B. `internal.foi_parcurs_dupa` (forma ultimă: 0012, neatinsă de nicio
--    migrare ulterioară — verificat cu grep) ia pragul de salt în ordinea:
--    vehiculul → setările firmei → implicitul de 1.500 km.
-- C. `internal.conformitate_zilnica()`, programată la 05:00 UTC (08:00 vara,
--    07:00 iarna, ora României) ca `conformitate-zilnica`, pentru fiecare firmă
--    ACTIVĂ cu `fleet` pornit:
--      1. `internal.genereaza_alerte(org)` — din 0008, semnătura NESCHIMBATĂ;
--         o cheamă și jobul mentenanței (05:10), iar `on conflict do nothing`
--         face ca două joburi pe aceeași zi să producă aceleași rânduri;
--      2. `internal.flota_rezumat(org)` — DOAR `entity_type = 'vehicle_document'`
--         (lista albă a flotei; SSM și HR se pot adăuga ulterior). O singură
--         notificare pe destinatar și rulare: la prima rulare, când toate
--         scadențele firmei se aprind deodată, omul primește UN rezumat, nu
--         treizeci. Cu un singur vehicul în cauză, legătura duce la fișa lui.
--    Destinatari: responsabilii (sau toți `org_admin`) + șoferul alocat
--    (`vehicles.employee_id`, derivatul alocării deschise din 0173), toți
--    membri ACTIVI și cu `vehicles:read` ≠ none, prin `internal.scope_membru`
--    (precedența membru > firmă > global din 0189). Fiecare primește DOAR
--    vehiculele pe care le vede (`internal.flota_vede_vehicul`, geamăna lui
--    `app.poate_vedea_vehicul`): un responsabil cu `team`/`own` nu află
--    documentele restului parcului, iar un document pe care nu-l vede niciun
--    responsabil merge la administratori. Dedup: `alert_notifications`
--    (`canal = 'in_app'`, indexul unic din 0008). Push-ul pleacă singur, prin
--    triggerul de pe `notifications` (0122).
-- D. `internal.foi_parcurs_notifica()`, AFTER UPDATE OF status pe `trip_sheets`
--    (tiparul din 0042): la `trimis`, aprobatorii (responsabilii cu
--    `trip_sheets:approve = all` și managerii șoferului cu `team`); la
--    `aprobat`/`respins`, șoferul, cu motivul respingerii.
--
-- ── CE NU FACE ──────────────────────────────────────────────────────────────
--  · Nu schimbă semnătura lui `internal.genereaza_alerte` și nu cheamă
--    `internal.curata_alerte`: aceea e pe toată firma și ar schimba starea
--    alertelor altor module din jobul flotei. Rezumatul se apără singur de
--    alertele rămase `nou` după scadență (filtrul `due_date = expires_at` și
--    starea potrivită zilei), ca jobul mentenanței (traseul paralel M9, încă
--    neajuns pe main la scrierea acestei migrări).
--  · Nu atinge `expirables`, `app.poate_vedea_expirabil`, `app.can_path`.
--  · Nu trimite e-mail (canalul `email` din 0008 rămâne neconectat).
--
-- Aplicare: psql byte-exact, după bancul local; producția cere confirmare.

begin;

-- ============================================================
-- 1. Setările flotei
-- ============================================================
-- Un rând per organizație; lipsa rândului = implicitele din `default`, pe care
-- aplicația le citește cu `setariFlota` (src/lib/queries/fleet.ts). Cheie `id` +
-- unic PARȚIAL pe `organization_id`, ca `maintenance_settings` (0181), nu
-- `organization_id` primar: rândul șters logic nu blochează unul nou.
create table public.fleet_settings (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations (id) on delete cascade,
  -- Fișele de angajat ale responsabililor de flotă. Gol = toți org_admin.
  responsabili         uuid[] not null default '{}',
  prag_salt_km         integer not null default 1500,
  praguri_alerta_zile  integer[] not null default array[30, 14, 7],
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  created_by           uuid references auth.users (id) on delete set null,
  updated_by           uuid references auth.users (id) on delete set null,
  deleted_at           timestamptz,
  constraint fleet_settings_responsabili_ck check (coalesce(array_length(responsabili, 1), 0) <= 20),
  constraint fleet_settings_prag_salt_ck check (prag_salt_km between 50 and 100000),
  constraint fleet_settings_praguri_ck check (
    coalesce(array_length(praguri_alerta_zile, 1), 0) between 1 and 8
    and 0 < all (praguri_alerta_zile)
    and 365 >= all (praguri_alerta_zile)
  )
);

create unique index fleet_settings_org_uq
  on public.fleet_settings (organization_id)
  where deleted_at is null;

comment on table public.fleet_settings is
  'Setările flotei, un rând per firmă (0198): responsabilii (gol = toți org_admin), pragul de salt al kilometrajului, pragurile de alertă oglindite în alert_rules.';
comment on column public.fleet_settings.responsabili is
  'Fișe de angajat (employees.id) din aceeași firmă. Primesc rezumatul zilnic de scadențe și, cu trip_sheets:approve = all, foile trimise.';
comment on column public.fleet_settings.prag_salt_km is
  'Saltul de kilometraj peste care foaia produce o anomalie. vehicles.prag_salt_km îl suprascrie pe vehicul.';

-- Backfill, ÎNAINTEA triggerelor: o firmă care avea deja o regulă '*' (sau pe
-- `vehicle_document`) diferită de 30/14/7 primește rândul de setări cu pragurile
-- pe care motorul le aplica deja; altfel formularul ar afișa 30/14/7 și o
-- primă salvare ar schimba tăcut regula. Un prag peste 365 nu încape în CHECK:
-- firma aceea rămâne pe regula ei, fără rând.
insert into public.fleet_settings (organization_id, praguri_alerta_zile)
select ef.organization_id, ef.praguri
  from (
    select o.id as organization_id,
           (select ar.praguri_zile
              from public.alert_rules ar
             where ar.organization_id = o.id
               and ar.deleted_at is null
               and ar.valabil_de_la <= app.azi_local()
               and ar.entity_type in ('vehicle_document', '*')
               and ar.kind = '*'
             order by (ar.entity_type = 'vehicle_document') desc, ar.valabil_de_la desc
             limit 1) as praguri
      from public.organizations o
     where o.deleted_at is null
  ) ef
 where ef.praguri is not null
   and ef.praguri is distinct from internal.praguri_implicite()
   and 365 >= all (ef.praguri)
   and coalesce(array_length(ef.praguri, 1), 0) between 1 and 8;

-- ============================================================
-- 2. Triggerele setărilor
-- ============================================================
-- Integritate, nu drepturi (drepturile le judecă politica): responsabilii sunt
-- fișe VII ale ACELEIAȘI firme, fără dubluri; pragurile se ordonează
-- descrescător, fără dubluri, ca în `alert_rules_normalizeaza` (0008) — altfel
-- oglinda din `alert_rules` ar arăta altfel decât formularul. DEFINER fiindcă
-- citește `employees`, care e sub RLS.
create or replace function internal.fleet_settings_inainte()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_straini integer;
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception using errcode = 'P0001',
      message = 'Setările flotei nu se mută pe altă organizație.';
  end if;

  select coalesce(array_agg(r.employee_id order by r.ord), '{}')
    into new.responsabili
    from (
      select distinct on (u.employee_id) u.employee_id, u.ord
        from unnest(new.responsabili) with ordinality as u(employee_id, ord)
       where u.employee_id is not null
       order by u.employee_id, u.ord
    ) r;

  select count(*)
    into v_straini
    from unnest(new.responsabili) as r(employee_id)
   where not exists (
     select 1 from public.employees e
      where e.id = r.employee_id
        and e.organization_id = new.organization_id
        and e.deleted_at is null);
  if v_straini > 0 then
    raise exception using errcode = 'P0001',
      message = 'Responsabilul de flotă ales nu este angajat al organizației.';
  end if;

  select array_agg(distinct v order by v desc)
    into new.praguri_alerta_zile
    from unnest(new.praguri_alerta_zile) as t(v)
   where v is not null;

  return new;
end;
$$;

create trigger fleet_settings_inainte
  before insert or update on public.fleet_settings
  for each row execute function internal.fleet_settings_inainte();

-- Oglinda pragurilor în `alert_rules`, pe definer (vezi antetul, A). O versiune
-- pe zi: `alert_rules` ține istoricul pe `valabil_de_la`, iar a doua salvare din
-- aceeași zi rescrie versiunea zilei, nu adaugă una (tiparul jobului de mentenanță, M9).
create or replace function internal.flota_setari_praguri()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is not null then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.praguri_alerta_zile is not distinct from old.praguri_alerta_zile then
    return null;
  end if;

  insert into public.alert_rules as r
    (organization_id, entity_type, kind, praguri_zile, alerteaza_la_depasire, valabil_de_la)
  values
    (new.organization_id, 'vehicle_document', '*', new.praguri_alerta_zile, true, app.azi_local())
  on conflict (organization_id, entity_type, kind, valabil_de_la) where deleted_at is null
  do update set praguri_zile = excluded.praguri_zile;
  return null;
end;
$$;

create trigger fleet_settings_praguri
  after insert or update on public.fleet_settings
  for each row execute function internal.flota_setari_praguri();

-- ============================================================
-- 3. Pragul de salt din setări
-- ============================================================
-- Rescrisă de la forma ULTIMĂ (0012:655; nicio migrare ulterioară n-a redefinit-o).
-- Singura schimbare: `v_prag` = vehiculul → setările firmei → implicitul.
create or replace function internal.foi_parcurs_dupa()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_baza integer;
  v_prag integer;
begin
  select greatest(
           coalesce((select max(t.km_sosire) from public.trip_sheets t
                      where t.vehicle_id = new.vehicle_id and t.deleted_at is null
                        and t.status = 'aprobat' and t.km_sosire is not null and t.id <> new.id), 0),
           coalesce((select v.km_curent from public.vehicles v where v.id = new.vehicle_id), 0)),
         coalesce((select v.prag_salt_km from public.vehicles v where v.id = new.vehicle_id),
                  (select s.prag_salt_km from public.fleet_settings s
                    where s.organization_id = new.organization_id and s.deleted_at is null
                    limit 1),
                  internal.flota_prag_salt_km())
    into v_baza, v_prag;

  -- SALT: nu blocăm. Cauza cea mai frecventă e o foaie de parcurs necompletată,
  -- iar un refuz ar împinge şoferul să scrie o cifră falsă ca să poată salva.
  -- Semnalăm şi lăsăm un om să decidă.
  if v_baza > 0 and new.km_plecare - v_baza > v_prag then
    insert into public.odometer_anomalies
      (organization_id, vehicle_id, trip_sheet_id, km_asteptat, km_declarat, tip, explicatie)
    values
      (new.organization_id, new.vehicle_id, new.id, v_baza, new.km_plecare, 'salt',
       'Diferenţă între kilometrajul de plecare declarat şi ultimul kilometraj cunoscut. Verificaţi dacă lipseşte o foaie de parcurs.')
    on conflict (trip_sheet_id, tip) where trip_sheet_id is not null and deleted_at is null
    do nothing;
  end if;

  if new.status = 'aprobat' and new.km_sosire is not null then
    update public.vehicles v
       set km_curent = new.km_sosire, updated_at = now()
     where v.id = new.vehicle_id and coalesce(v.km_curent, 0) < new.km_sosire;
  end if;
  return null;
end;
$$;

comment on function internal.flota_prag_salt_km() is
  'Pragul implicit de salt al kilometrajului (1.500 km), ultima rezervă după vehicles.prag_salt_km și fleet_settings.prag_salt_km (0198).';

-- ============================================================
-- 4. Helperi
-- ============================================================
-- Un număr cu substantivul lui: „1 document”, „3 documente”, „20 de documente”.
-- Geamăna lui `internal.mentenanta_numarat` (jobul mentenanței, M9, alt traseu), scrisă separat
-- ca fiecare modul să-și poată schimba textele fără să-l atingă pe celălalt.
create or replace function internal.flota_numarat(p_n integer, p_singular text, p_plural text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_n = 1 then '1 ' || p_singular
    when p_n >= 20 and (p_n % 100 = 0 or p_n % 100 >= 20) then p_n::text || ' de ' || p_plural
    else p_n::text || ' ' || p_plural
  end;
$$;

-- Responsabilii de flotă ai unei firme, ca utilizatori: fișele din setări care
-- sunt MEMBRI ACTIVI ai firmei (un responsabil plecat nu mai primește nimic —
-- defectul reparat de M9 la mentenanță) și care VĂD parcul (`vehicles:read` ≠
-- none); fără niciunul, toți `org_admin` activi, ca alertele să ajungă la cineva.
create or replace function internal.flota_responsabili(p_org uuid)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with setari as (
    select s.responsabili
      from public.fleet_settings s
     where s.organization_id = p_org and s.deleted_at is null
     limit 1
  ),
  din_setari as (
    select e.user_id
      from setari s
      cross join lateral unnest(s.responsabili) as r(employee_id)
      join public.employees e on e.id = r.employee_id
      join public.organization_members m
        on m.organization_id = p_org
       and m.user_id = e.user_id
       and m.status = 'active'
       and m.deleted_at is null
     where e.organization_id = p_org and e.deleted_at is null and e.user_id is not null
       -- Un responsabil care nu mai vede parcul (suprascriere pe firmă sau pe
       -- membru) n-ar putea deschide nimic din ce primește; nu mai contează.
       and internal.scope_membru(p_org, e.user_id, 'vehicles', 'read') <> 'none'
  )
  select user_id from din_setari
  union
  select m.user_id
    from public.organization_members m
   where m.organization_id = p_org and m.role = 'org_admin' and m.status = 'active'
     and m.deleted_at is null
     and not exists (select 1 from din_setari);
$$;

-- Geamăna lui `app.poate_vedea_vehicul` (0196) pentru un utilizator DAT, nu
-- pentru `auth.uid()`: jobul rulează fără nimeni autentificat. Aceleași ramuri:
-- `all` = tot; `team` = pool, mașina lui sau a cuiva din echipa lui; `own` =
-- pool sau mașina lui. Fișa e cea principală, ca `app.current_employee_id`.
-- Fără ea, rezumatul unui responsabil cu `own`/`team` ar lista documentele și
-- numerele de înmatriculare ale ÎNTREGULUI parc (revizuirea F5).
create or replace function internal.flota_vede_vehicul(
  p_org uuid,
  p_user uuid,
  p_sofer_id uuid,
  p_pool boolean
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with fisa as (
    select e.id
      from public.employees e
     where e.organization_id = p_org
       and e.user_id = p_user
       and e.is_primary
       and e.deleted_at is null
     limit 1
  )
  select case internal.scope_membru(p_org, p_user, 'vehicles', 'read')
    when 'all'  then true
    when 'team' then coalesce(p_pool, false)
                     or (p_sofer_id is not null and exists (
                           select 1
                             from fisa f
                             join public.employees s
                               on s.id = p_sofer_id
                              and s.organization_id = p_org
                              and s.deleted_at is null
                            where s.id = f.id or s.manager_path @> array[f.id]))
    when 'own'  then coalesce(p_pool, false)
                     or (p_sofer_id is not null and exists (select 1 from fisa f where f.id = p_sofer_id))
    else false
  end;
$$;

comment on function internal.flota_vede_vehicul(uuid, uuid, uuid, boolean) is
  'Ca app.poate_vedea_vehicul (0196), pentru un utilizator dat în locul lui auth.uid(): filtrul rezumatului zilnic de flotă (0198).';

-- Cine aprobă foaia unui șofer: responsabilii și managerii din lanțul lui
-- (`manager_path`), filtrați pe dreptul EFECTIV (`internal.scope_membru`, 0189):
-- `all` oricum, `team` doar dacă fișa lor e în lanțul șoferului — exact ramura
-- pe care `foi_update` i-ar lăsa să decidă. Fără niciunul, oricine are `all`.
-- Șoferul nu se aprobă singur, deci nu e niciodată în listă.
create or replace function internal.flota_aprobatori_foaie(p_org uuid, p_employee uuid)
returns table (user_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sofer public.employees%rowtype;
begin
  select * into v_sofer
    from public.employees e
   where e.id = p_employee and e.organization_id = p_org and e.deleted_at is null;
  if not found then
    return;
  end if;

  return query
  with membri as (
    select m.user_id
      from public.organization_members m
     where m.organization_id = p_org and m.status = 'active' and m.deleted_at is null
  ),
  candidati as (
    select r.user_id from internal.flota_responsabili(p_org) r
    union
    select e.user_id
      from public.employees e
     where e.id = any (coalesce(v_sofer.manager_path, '{}'::uuid[]))
       and e.organization_id = p_org
       and e.deleted_at is null
       and e.user_id is not null
  ),
  cu_scope as (
    select c.user_id,
           internal.scope_membru(p_org, c.user_id, 'trip_sheets', 'approve') as scope,
           (select f.id from public.employees f
             where f.organization_id = p_org and f.user_id = c.user_id and f.deleted_at is null
             order by f.is_primary desc, f.created_at
             limit 1) as fisa
      from candidati c
      join membri m on m.user_id = c.user_id
  )
  select cs.user_id
    from cu_scope cs
   where cs.user_id is distinct from v_sofer.user_id
     and (cs.scope = 'all'
          or (cs.scope = 'team' and cs.fisa is not null
              and coalesce(v_sofer.manager_path, '{}'::uuid[]) @> array[cs.fisa]));

  if not found then
    return query
    select m.user_id
      from public.organization_members m
     where m.organization_id = p_org and m.status = 'active' and m.deleted_at is null
       and m.user_id is distinct from v_sofer.user_id
       and internal.scope_membru(p_org, m.user_id, 'trip_sheets', 'approve') = 'all';
  end if;
end;
$$;

-- ============================================================
-- 5. Rezumatul zilnic al flotei
-- ============================================================
-- O singură instrucțiune, cu CTE-uri care scriu: toate citesc ACELAȘI
-- instantaneu, deci „deja trimis?” vede starea de dinaintea rulării, iar a doua
-- rulare găsește totul marcat și nu scrie nimic. Întoarce câte notificări au
-- plecat.
create or replace function internal.flota_rezumat(p_org uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_azi date := app.azi_local();
  v_n   integer := 0;
begin
  if p_org is null then
    return 0;
  end if;

  with
  gestionari as (
    select r.user_id from internal.flota_responsabili(p_org) r
  ),
  -- Doar alertele scadenței CURENTE, în starea potrivită zilei: fără
  -- `curata_alerte`, un prag `nou` rămâne așa și după scadență, iar alertele
  -- unei scadențe vechi (documentul reînnoit) rămân și ele.
  elemente as (
    select a.id            as alert_id,
           x.id            as expirable_id,
           v.id            as vehicle_id,
           v.employee_id   as sofer_id,
           v.pool          as pool,
           (a.status = 'expirat') as depasita,
           x.expires_at,
           x.label || ': ' ||
             case when a.status = 'expirat'
                  then 'expirat din ' || to_char(x.expires_at, 'DD.MM.YYYY')
                  else 'expiră pe ' || to_char(x.expires_at, 'DD.MM.YYYY') end as eticheta
      from public.compliance_alerts a
      join public.expirables x on x.id = a.expirable_id
      join public.vehicles v
        on v.id = x.entity_id
       and v.organization_id = p_org
       and v.deleted_at is null
     where a.organization_id = p_org
       and a.deleted_at is null
       and a.status in ('nou', 'expirat')
       and x.organization_id = p_org
       and x.deleted_at is null
       and x.is_active
       -- LISTA ALBĂ a flotei. SSM și HR se adaugă aici, cu legătura lor.
       and x.entity_type in ('vehicle_document')
       and a.due_date = x.expires_at
       and case when a.status = 'expirat' then x.expires_at < v_azi
                else x.expires_at >= v_azi end
  ),
  -- Fiecare responsabil primește DOAR vehiculele pe care le vede: unul cu
  -- `team` sau `own` (un manager, un angajat bifat de administrator) nu află
  -- din rezumat documentele și numerele restului parcului (revizuirea F5).
  vizibile as (
    select e.*, g.user_id
      from elemente e
      join gestionari g
        on internal.flota_vede_vehicul(p_org, g.user_id, e.sofer_id, e.pool)
  ),
  -- Documentul pe care nu-l vede NICIUN responsabil nu rămâne nevăzut: merge
  -- la administratorii activi, ca la firma fără responsabili.
  orfane as (
    select e.*, m.user_id
      from elemente e
      join public.organization_members m
        on m.organization_id = p_org
       and m.role = 'org_admin'
       and m.status = 'active'
       and m.deleted_at is null
     where not exists (select 1 from vizibile z where z.expirable_id = e.expirable_id)
       and internal.flota_vede_vehicul(p_org, m.user_id, e.sofer_id, e.pool)
  ),
  destinatari as (
    select * from vizibile
    union
    select * from orfane
    union
    select e.*, emp.user_id
      from elemente e
      join public.employees emp
        on emp.id = e.sofer_id
       and emp.organization_id = p_org
       and emp.deleted_at is null
       and emp.user_id is not null
      join public.organization_members m
        on m.organization_id = p_org
       and m.user_id = emp.user_id
       and m.status = 'active'
       and m.deleted_at is null
  ),
  -- Dreptul efectiv al fiecărui destinatar, o dată pe om: cine nu citește
  -- vehiculele (o suprascriere pe firmă sau pe membru) nu primește o legătură
  -- spre un ecran închis.
  scopuri as (
    select u.user_id, internal.scope_membru(p_org, u.user_id, 'vehicles', 'read') as scope
      from (select distinct d.user_id from destinatari d) u
  ),
  noi as (
    select d.*, s.scope
      from destinatari d
      join scopuri s on s.user_id = d.user_id
     where s.scope <> 'none'
       and not exists (
         select 1 from public.alert_notifications an
          where an.alert_id = d.alert_id
            and an.canal = 'in_app'
            and an.destinatar_cheie = d.user_id::text)
  ),
  -- Un document = un rând per om, chiar dacă scadența are mai multe alerte (la
  -- prima rulare, o scadență peste 5 zile atinge deodată pragurile 30, 14 și 7).
  distincte as (
    select distinct on (n.user_id, n.expirable_id)
           n.user_id, n.expirable_id, n.vehicle_id, n.depasita, n.expires_at, n.eticheta, n.scope
      from noi n
     order by n.user_id, n.expirable_id, n.depasita desc
  ),
  numerotate as (
    select d.*,
           row_number() over (partition by d.user_id
                              order by d.depasita desc, d.expires_at, d.eticheta) as rn
      from distincte d
  ),
  pe_om as (
    select n.user_id,
           min(n.scope::text)                                  as scope,
           count(*)::integer                                   as total,
           count(*) filter (where n.depasita)::integer         as depasite,
           count(*) filter (where not n.depasita)::integer     as apropiate,
           count(distinct n.vehicle_id)::integer               as vehicule,
           max(n.expires_at)                                   as ultima_scadenta,
           (array_agg(n.vehicle_id order by n.rn))[1]          as primul_vehicul,
           string_agg('· ' || n.eticheta, E'\n' order by n.rn) filter (where n.rn <= 8) as linii
      from numerotate n
     group by n.user_id
  ),
  scrise as (
    insert into public.notifications (user_id, organization_id, kind, title, body, link, entity_type, entity_id)
    select o.user_id,
           p_org,
           'reminder'::public.notification_kind,
           left('Flota: ' || array_to_string(array_remove(array[
             case when o.depasite > 0 then internal.flota_numarat(o.depasite, 'document expirat', 'documente expirate') end,
             case when o.apropiate > 0 then internal.flota_numarat(o.apropiate, 'document care expiră curând', 'documente care expiră curând') end
           ], null), ', ') || '.', 200),
           left(o.linii || case when o.total > 8
                                then E'\n… și încă ' || internal.flota_numarat(o.total - 8, 'document', 'documente') || '.'
                                else '' end, 4000),
           case
             when o.scope not in ('team', 'all') then '/portal/masina-mea'
             when o.vehicule = 1 then '/flota/' || o.primul_vehicul::text
             -- Filtrul „expiră” al listei arată 30 de zile
             -- (`PRAG_FLOTA_AVERTIZARE_ZILE`, src/domain/fleet/scadente.ts; îl
             -- fixează setari.test.ts). Cu un prag al firmei mai lung (60),
             -- vehiculele de peste 30 de zile ar lipsi din el: lista întreagă.
             when o.ultima_scadenta <= v_azi + 30 then '/flota?conformitate=expira'
             else '/flota'
           end,
           case when o.vehicule = 1 then 'vehicle' else 'fleet_rezumat' end,
           case when o.vehicule = 1 then o.primul_vehicul end
      from pe_om o
    returning id, user_id
  ),
  marcate as (
    insert into public.alert_notifications
      (organization_id, alert_id, canal, recipient_user_id, notification_id, status, sent_at)
    select p_org, n.alert_id, 'in_app', n.user_id, s.id, 'trimis', now()
      from noi n
      join scrise s on s.user_id = n.user_id
    on conflict (alert_id, canal, destinatar_cheie) do nothing
    returning 1
  )
  -- Instrucțiunile care scriu din WITH rulează o dată și complet, citite sau nu
  -- de interogarea principală; se numără doar notificările.
  select count(*) into v_n from scrise;

  return coalesce(v_n, 0);
end;
$$;

comment on function internal.flota_rezumat(uuid) is
  'Rezumatul zilnic al scadențelor de flotă (vehicle_document) pentru o firmă: o notificare per destinatar, doar cu documentele netrimise lui. Idempotentă: a doua rulare din aceeași zi nu scrie nimic.';

-- ============================================================
-- 6. Jobul zilnic
-- ============================================================
-- Fiecare firmă în subtranzacția ei: o eroare pe datele uneia nu oprește
-- rezumatul celorlalte. Întoarce un raport, util la rularea manuală și în
-- `cron.job_run_details`.
create or replace function internal.conformitate_zilnica()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org      uuid;
  v_firme    integer := 0;
  v_alerte   integer := 0;
  v_rezumate integer := 0;
  v_esuate   integer := 0;
  v_x        integer;
begin
  for v_org in
    select o.id
      from public.organizations o
     where o.deleted_at is null
       -- Aceleași stări ca `app.current_org_ids` (și ca jobul mentenanței, M9): firma suspendată
       -- sau arhivată nu mai e deschisă nimănui, deci nici alertele nu pleacă.
       and o.status in ('pending', 'active')
       and o.subscription_status not in ('canceled', 'expired')
       and app.feature_on(o.id, 'fleet')
     order by o.id
  loop
    begin
      v_x := internal.genereaza_alerte(v_org);
      v_alerte := v_alerte + coalesce(v_x, 0);
      v_x := internal.flota_rezumat(v_org);
      v_rezumate := v_rezumate + coalesce(v_x, 0);
      v_firme := v_firme + 1;
    exception when others then
      v_esuate := v_esuate + 1;
      raise warning 'conformitate_zilnica: firma % a eșuat: % (%)', v_org, sqlerrm, sqlstate;
    end;
  end loop;

  return jsonb_build_object(
    'firme', v_firme, 'alerte_noi', v_alerte, 'rezumate', v_rezumate, 'firme_esuate', v_esuate);
end;
$$;

comment on function internal.conformitate_zilnica() is
  'Jobul de dimineață al conformității (pg_cron „conformitate-zilnica”, 05:00 UTC): alertele din 0008 și rezumatul de flotă per destinatar. Doar firmele active cu modulul fleet pornit.';

-- ============================================================
-- 7. Notificările pe fluxul foii
-- ============================================================
-- AFTER UPDATE OF status, ca în 0042: se scrie doar când starea chiar s-a
-- schimbat, iar o tranzacție derulată înapoi ia notificarea cu ea. Cine a făcut
-- schimbarea nu-și trimite singur notificare.
create or replace function internal.foi_parcurs_notifica()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor    uuid := auth.uid();
  v_eticheta text;
  v_sofer    record;
begin
  if new.deleted_at is not null or new.status is not distinct from old.status then
    return null;
  end if;

  select e.full_name, e.user_id into v_sofer
    from public.employees e
   where e.id = new.employee_id and e.organization_id = new.organization_id;

  v_eticheta := coalesce(new.numar, 'Foaia de parcurs') || ' · '
    || coalesce(new.vehicul_nr,
                (select v.nr_inmatriculare from public.vehicles v where v.id = new.vehicle_id),
                '?')
    || ', ' || to_char(new.plecare_la at time zone 'Europe/Bucharest', 'DD.MM.YYYY');

  if new.status = 'trimis' then
    insert into public.notifications
      (organization_id, user_id, kind, title, body, link, entity_type, entity_id)
    select new.organization_id, a.user_id, 'approval'::public.notification_kind,
           'Foaie de parcurs de aprobat',
           left(v_eticheta || ' — ' || coalesce(v_sofer.full_name, 'șofer necunoscut') || '.', 4000),
           '/flota/foi/' || new.id::text,
           'trip_sheet', new.id
      from internal.flota_aprobatori_foaie(new.organization_id, new.employee_id) a
     where a.user_id is distinct from v_actor;

  elsif old.status = 'trimis' and new.status in ('aprobat', 'respins') then
    if v_sofer.user_id is not null
       and v_sofer.user_id is distinct from v_actor
       and exists (select 1 from public.organization_members m
                    where m.organization_id = new.organization_id and m.user_id = v_sofer.user_id
                      and m.status = 'active' and m.deleted_at is null)
       and internal.scope_membru(new.organization_id, v_sofer.user_id, 'trip_sheets', 'read') <> 'none'
    then
      insert into public.notifications
        (organization_id, user_id, kind, title, body, link, entity_type, entity_id)
      values (
        new.organization_id, v_sofer.user_id, 'approval'::public.notification_kind,
        case when new.status = 'aprobat'
             then 'Foaia de parcurs a fost aprobată'
             else 'Foaia de parcurs a fost respinsă' end,
        left(case when new.status = 'aprobat'
                  then v_eticheta || ' a fost aprobată.'
                  else v_eticheta || ' a fost respinsă.'
                       || coalesce(' Motiv: ' || rtrim(nullif(btrim(new.motiv_respingere), ''), '.') || '.', '')
             end, 4000),
        '/flota/foi/' || new.id::text,
        'trip_sheet', new.id
      );
    end if;
  end if;
  return null;
end;
$$;

create trigger foi_parcurs_notifica
  after update of status on public.trip_sheets
  for each row execute function internal.foi_parcurs_notifica();

-- ============================================================
-- 8. RLS pe setări
-- ============================================================
alter table public.fleet_settings enable row level security;
alter table public.fleet_settings force row level security;

-- Citite de cine vede parcul (și de șoferul cu `own`: pragul de salt explică
-- anomaliile lui); scrise doar de cine administrează vehiculele.
create policy fleet_settings_select on public.fleet_settings
for select to authenticated
using (
  (select app.is_platform_admin()) or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.has_permission(organization_id, 'vehicles', 'read') <> 'none'
  )
);

create policy fleet_settings_insert on public.fleet_settings
for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
  and deleted_at is null
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy fleet_settings_update on public.fleet_settings
for update to authenticated
using (
  deleted_at is null
  and organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
  and updated_by = (select auth.uid())
);

-- ============================================================
-- 9. Actor, audit, drepturi
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['fleet_settings'] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function internal.seteaza_updated_at()',
      t || '_set_updated_at', t);
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function internal.set_actor()',
      'trg_' || t || '_actor', t);
    perform internal.attach_audit(t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end
$$;

-- Funcțiile: fără EXECUTE pentru nimeni în afara proprietarului (triggerele
-- definer și jobul); jobul și rezumatul rămân rulabile manual de service_role.
revoke all on function internal.fleet_settings_inainte() from public, anon, authenticated;
revoke all on function internal.flota_setari_praguri() from public, anon, authenticated;
revoke all on function internal.foi_parcurs_dupa() from public, anon, authenticated;
revoke all on function internal.flota_numarat(integer, text, text) from public, anon, authenticated;
revoke all on function internal.flota_responsabili(uuid) from public, anon, authenticated;
revoke all on function internal.flota_vede_vehicul(uuid, uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function internal.flota_aprobatori_foaie(uuid, uuid) from public, anon, authenticated;
revoke all on function internal.flota_rezumat(uuid) from public, anon, authenticated;
revoke all on function internal.conformitate_zilnica() from public, anon, authenticated;
revoke all on function internal.foi_parcurs_notifica() from public, anon, authenticated;
grant execute on function internal.flota_rezumat(uuid) to service_role;
grant execute on function internal.conformitate_zilnica() to service_role;

commit;

-- ============================================================
-- 10. Programarea
-- ============================================================
-- Garda de disponibilitate (0008/0042): pe Postgres-ul gol din CI și din
-- bancul local `pg_cron` nu există, iar migrarea trebuie să treacă.
-- `unschedule` întâi: numele `conformitate-zilnica` e cel proiectat în 0008, iar
-- o programare manuală anterioară nu trebuie să rămână alături de a noastră.
do $do$
begin
  if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema cron;

    perform cron.unschedule('conformitate-zilnica')
     where exists (select 1 from cron.job where jobname = 'conformitate-zilnica');

    perform cron.schedule(
      'conformitate-zilnica',
      '0 5 * * *',
      $job$select internal.conformitate_zilnica()$job$
    );
  else
    raise notice 'pg_cron indisponibil: jobul zilnic de conformitate nu a fost programat.';
  end if;
end;
$do$;

-- ============================================================
-- 11. Verificare
-- ============================================================
do $$
declare
  v_lipsa text[] := '{}';
  v_job   bigint;
begin
  if to_regclass('public.fleet_settings') is null then
    v_lipsa := v_lipsa || 'fleet_settings';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'fleet_settings_org_uq'
                  and indexdef ilike '%where (deleted_at is null)%') then
    v_lipsa := v_lipsa || 'fleet_settings_org_uq (parțial)';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'fleet_settings') <> 3 then
    v_lipsa := v_lipsa || 'trio-ul de politici pe fleet_settings';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'fleet_settings'
              and cmd = 'DELETE') then
    v_lipsa := v_lipsa || 'politică DELETE pe fleet_settings (interzisă)';
  end if;
  if not (select relforcerowsecurity from pg_class where oid = 'public.fleet_settings'::regclass) then
    v_lipsa := v_lipsa || 'FORCE RLS pe fleet_settings';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'fleet_settings_praguri'
                  and tgrelid = 'public.fleet_settings'::regclass) then
    v_lipsa := v_lipsa || 'triggerul fleet_settings_praguri';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'foi_parcurs_notifica'
                  and tgrelid = 'public.trip_sheets'::regclass) then
    v_lipsa := v_lipsa || 'triggerul foi_parcurs_notifica';
  end if;
  if position('fleet_settings' in pg_get_functiondef('internal.foi_parcurs_dupa()'::regprocedure)) = 0 then
    v_lipsa := v_lipsa || 'internal.foi_parcurs_dupa cu pragul din setări';
  end if;
  if to_regprocedure('internal.conformitate_zilnica()') is null then
    v_lipsa := v_lipsa || 'internal.conformitate_zilnica()';
  end if;
  if to_regprocedure('internal.flota_rezumat(uuid)') is null then
    v_lipsa := v_lipsa || 'internal.flota_rezumat(uuid)';
  end if;
  -- Semnătura pe care o cheamă și jobul mentenanței rămâne cea din 0008.
  if to_regprocedure('internal.genereaza_alerte(uuid)') is null then
    v_lipsa := v_lipsa || 'internal.genereaza_alerte(uuid) (semnătura)';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'internal'
                and p.proname in ('flota_rezumat', 'conformitate_zilnica', 'flota_aprobatori_foaie',
                                  'flota_responsabili', 'foi_parcurs_notifica', 'fleet_settings_inainte',
                                  'flota_setari_praguri', 'flota_vede_vehicul')
                and (p.proconfig is null or not ('search_path=""' = any (p.proconfig)))) then
    v_lipsa := v_lipsa || 'search_path gol pe funcțiile 0198';
  end if;
  -- `cron.job` există doar cu extensia instalată; interogarea trece prin
  -- `execute`, fiindcă plpgsql nu scurtcircuitează planificarea.
  if exists (select 1 from pg_catalog.pg_extension where extname = 'pg_cron') then
    execute $q$select count(*) from cron.job where jobname = 'conformitate-zilnica'$q$ into v_job;
    if v_job <> 1 then
      v_lipsa := v_lipsa || 'jobul pg_cron conformitate-zilnica';
    end if;
  end if;
  if array_length(v_lipsa, 1) > 0 then
    raise exception '0198: lipsesc %', array_to_string(v_lipsa, ', ');
  end if;
end $$;
