-- supabase/migrations/0225_flota_costuri_ascunse.sql
--
-- FLOTA, PACHETUL X1: COSTURILE NU MAI STAU PE RÂNDURI PE CARE LE VEDE ȘOFERUL.
--
-- ── DE CE ───────────────────────────────────────────────────────────────────
-- Două costuri stăteau în COLOANE ale unor rânduri pe care rolul are voie să le
-- vadă, deci PostgREST le dădea oricui citea rândul:
--   · `vehicles.valoare_achizitie` (0012) — angajatului pe mașina lui și pe
--     pool, managerului pe pool, lui hr pe mașina lui (ramura „decizia 3”, 0215);
--   · `vehicle_documents.cost` (0012) — angajatului și managerului pe pool.
-- RLS-ul taie rânduri, nu coloane, iar privilegiul pe coloană e al rolului
-- Postgres `authenticated`, COMUN tuturor rolurilor aplicației: un REVOKE pe
-- coloană i-ar fi luat valoarea și administratorului, iar un `select=*` din
-- aplicația veche ar fi căzut cu 42501 pentru toată lumea. Erau rândurile
-- „DEFECT” din `proba-flota-matrice-roluri.sql` și `proba-livrare-roluri.sql`.
--
-- ── DECIZIA (utilizatorul, 21 oct) ─────────────────────────────────────────
-- Angajatul NU vede costuri. Managerul vede costurile mașinilor ECHIPEI lui,
-- doar citire, nu și ale pool-ului. HR nu vede nimic din flotă în afară de PV și
-- „Mașina mea”, deci nici costuri. Cine are `vehicles:update = all` vede tot.
-- Exact citirea lui `vehicle_expenses` din 0203 (fără ramura de pool), plus
-- ramura `update = all`.
--
-- ── FORMA ALEASĂ: tabele 1:1 cu RLS-ul costurilor ──────────────────────────
-- A. `public.vehicle_costuri` (1:1 cu vehiculul): `valoare_achizitie`.
-- B. `public.vehicle_document_costuri` (1:1 cu documentul): `cost`.
--    Citirea: `app.poate_vedea_costurile_vehiculului`. Scrierea: cheile
--    vehiculului la `all`, ca rândul-părinte.
-- C. Backfill din coloanele vechi, apoi coloanele vechi GOLITE (nu aruncate) și
--    închise cu un CHECK `is null`.
-- D. Coloanele vechi rămân doar ca INTRARE de compatibilitate: o valoare NENULĂ
--    scrisă în ele ajunge, în aceeași instrucțiune, în tabela de costuri, iar
--    coloana se golește (trigger BEFORE). Valoarea NULĂ se ignoră.
-- E. `public.avantaj_natura_flota`, rescrisă din forma ultimă (0205), citește
--    valoarea de intrare din `vehicle_costuri`.
--
-- ── DE CE NU ARUNC COLOANELE AICI ───────────────────────────────────────────
-- Între aplicarea migrării pe producție și deploy rulează aplicația VECHE, care
-- citește `valoare_achizitie` și `cost` cu liste explicite de coloane: aruncate,
-- fișa vehiculului și costurile ar cădea cu 42703. Golite, aplicația veche
-- arată „—” câteva minute (8 vehicule, 38 de documente cu scadență), atât.
-- Coloanele se aruncă într-o migrare ULTERIOARĂ deploy-ului; aplicația nouă nu
-- le mai citește și nu le mai scrie.
--
-- ── DE CE O VALOARE NULĂ NU GOLEȘTE COSTUL (punctul D) ─────────────────────
-- Aplicația veche își precompletează formularul din coloana veche, deci, în
-- fereastră, trimite `null` la orice corectură. Dacă `null` ar goli costul, o
-- corectură de dată pe un document ar șterge tăcut costul mutat aici. Golirea
-- se face DOAR în tabela de costuri (aplicația nouă: upsert cu `null`).
-- O valoare nenulă tastată în aplicația veche nu se pierde și nici nu redeschide
-- scurgerea: ajunge în tabela de costuri. La INSERT, rândul-părinte nu există
-- încă în BEFORE, de aceea cheile străine spre părinte sunt DEFERRABLE.
--
-- ── DE CE FĂRĂ `deleted_at` ȘI CU UNIC TOTAL ───────────────────────────────
-- Rândul de cost trăiește cât părintele (ON DELETE CASCADE, iar părintele se
-- șterge logic, nu fizic): un cost „șters” e un cost `null`. Unicitatea pe
-- `vehicle_id` / `document_id` e o CONSTRÂNGERE totală, nu un index parțial:
-- upsert-ul PostgREST (`on_conflict`) nu poate numi predicatul unui index
-- parțial și ar cădea cu 42P10.

begin;

-- ============================================================
-- 1. Tabelele
-- ============================================================
create table public.vehicle_costuri (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  vehicle_id        uuid not null,
  valoare_achizitie numeric(14, 2),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users (id) on delete set null,
  updated_by        uuid references auth.users (id) on delete set null,
  constraint vc_vehicul_uq unique (vehicle_id),
  -- DEFERRABLE: §6 o inserează din BEFORE INSERT pe `vehicles`, când rândul
  -- vehiculului încă nu există. Verificarea se face la COMMIT.
  constraint vc_vehicul_fk foreign key (vehicle_id)
    references public.vehicles (id) on delete cascade deferrable initially deferred,
  constraint vc_valoare_ck check (valoare_achizitie is null or valoare_achizitie >= 0)
);

comment on table public.vehicle_costuri is
  'Valoarea de achiziție a vehiculului (0225), 1:1 cu `vehicles`. Separată ca s-o citească doar cine vede costurile (`app.poate_vedea_costurile_vehiculului`), nu oricine vede rândul vehiculului.';

create index vc_org_idx on public.vehicle_costuri (organization_id);

create table public.vehicle_document_costuri (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  document_id     uuid not null,
  cost            numeric(14, 2),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null,
  updated_by      uuid references auth.users (id) on delete set null,
  constraint vdc_document_uq unique (document_id),
  constraint vdc_document_fk foreign key (document_id)
    references public.vehicle_documents (id) on delete cascade deferrable initially deferred,
  constraint vdc_cost_ck check (cost is null or cost >= 0)
);

comment on table public.vehicle_document_costuri is
  'Costul unui document de vehicul (RCA, ITP, rovinietă…) (0225), 1:1 cu `vehicle_documents`. Vehiculul se citește din document, nu se copiază: un document mutat nu lasă costul pe mașina veche.';

create index vdc_org_idx on public.vehicle_document_costuri (organization_id);

-- ============================================================
-- 2. Cine vede costurile
-- ============================================================
-- Pornește de la forma lui `vex_select` (0203): `vehicles:read` cel puțin
-- `team` și vehiculul judecat FĂRĂ ramura de pool, plus `vehicles:update = all`
-- (cine scrie costurile le vede, și upsert-ul cere rândul existent vizibil).
-- În plus față de `vex_select`: la `read = team`, o mașină din pool e exclusă și
-- când are șofer din echipă. Baza lasă pool-ul să fie alocat
-- (`vehicles.employee_id` se umple), iar „fără ramura de pool” ar fi lăsat
-- atunci managerului șoferului costurile mașinii comune. Aceeași regulă ca
-- `poateVedeaService` din fișă (`read = all`, sau `team` și nu pool).
-- Rezultă: org_admin / responsabilul cu `update = all` — tot; managerul —
-- mașinile echipei, nu pool-ul; angajatul (`own`) și hr (fără `vehicles:read`)
-- — nimic.
create or replace function app.poate_vedea_costurile_vehiculului(p_organization_id uuid, p_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_vehicle_id is not null
     and (app.has_permission(p_organization_id, 'vehicles', 'update') = 'all'
          or (app.can(p_organization_id, 'vehicles', 'read', 'team')
              and exists (
                select 1
                  from public.vehicles v
                 where v.id = p_vehicle_id
                   and v.organization_id = p_organization_id
                   and (app.has_permission(p_organization_id, 'vehicles', 'read') = 'all'
                        or not v.pool)
                   and app.poate_vedea_vehicul(p_organization_id, v.employee_id, false))));
$$;

comment on function app.poate_vedea_costurile_vehiculului(uuid, uuid) is
  'Cine vede costurile unui vehicul (0225): vehicles:update = all, sau vehicles:read = all, sau vehicles:read = team pe vehiculul echipei care NU e în pool (nici când pool-ul are șofer din echipă). Angajatul și hr nu.';

-- Vehiculul unui document, citit fără RLS: politica de cost se judecă pe
-- vehiculul de AZI al documentului.
create or replace function app.vehicul_documentului(p_document_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select d.vehicle_id from public.vehicle_documents d where d.id = p_document_id;
$$;

revoke all on function app.poate_vedea_costurile_vehiculului(uuid, uuid) from public, anon;
revoke all on function app.vehicul_documentului(uuid) from public, anon;
grant execute on function app.poate_vedea_costurile_vehiculului(uuid, uuid) to authenticated, service_role;
grant execute on function app.vehicul_documentului(uuid) to authenticated, service_role;

-- ============================================================
-- 3. Gărzile tabelelor de costuri
-- ============================================================
-- Rândul de cost aparține părintelui din ACEEAȘI firmă și nu se mută. Pe
-- drumul de compatibilitate (§6) părintele încă nu există în BEFORE INSERT;
-- acolo steagul `app.flota_cost_mutat` sare verificarea (valorile le pune
-- triggerul din rândul-părinte, nu clientul).
create or replace function internal.vc_inainte()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if (new.organization_id, new.vehicle_id) is distinct from (old.organization_id, old.vehicle_id) then
      raise exception using errcode = 'P0001',
        message = 'Valoarea de achiziție nu se mută pe alt vehicul.';
    end if;
  elsif coalesce(pg_catalog.current_setting('app.flota_cost_mutat', true), '') <> 'on' then
    perform internal.flota_vehicul_al_firmei(new.organization_id, new.vehicle_id);
  end if;
  return new;
end;
$$;

create trigger vc_inainte
  before insert or update on public.vehicle_costuri
  for each row execute function internal.vc_inainte();

create or replace function internal.vdc_inainte()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if (new.organization_id, new.document_id) is distinct from (old.organization_id, old.document_id) then
      raise exception using errcode = 'P0001',
        message = 'Costul nu se mută pe alt document.';
    end if;
  elsif coalesce(pg_catalog.current_setting('app.flota_cost_mutat', true), '') <> 'on'
        and not exists (select 1 from public.vehicle_documents d
                         where d.id = new.document_id and d.organization_id = new.organization_id
                           and d.deleted_at is null) then
    raise exception using errcode = 'P0001',
      message = 'Documentul nu există în organizația dumneavoastră.';
  end if;
  return new;
end;
$$;

create trigger vdc_inainte
  before insert or update on public.vehicle_document_costuri
  for each row execute function internal.vdc_inainte();

-- ============================================================
-- 4. RLS
-- ============================================================
alter table public.vehicle_costuri enable row level security;
alter table public.vehicle_costuri force row level security;
alter table public.vehicle_document_costuri enable row level security;
alter table public.vehicle_document_costuri force row level security;

create policy vc_select on public.vehicle_costuri
  for select to authenticated
  using (
    (select app.is_platform_admin())
    or (
      organization_id = any ((select app.current_org_ids())::uuid[])
      and app.feature_on(organization_id, 'fleet')
      and app.poate_vedea_costurile_vehiculului(organization_id, vehicle_id)
    )
  );

create policy vdc_select on public.vehicle_document_costuri
  for select to authenticated
  using (
    (select app.is_platform_admin())
    or (
      organization_id = any ((select app.current_org_ids())::uuid[])
      and app.feature_on(organization_id, 'fleet')
      and app.poate_vedea_costurile_vehiculului(organization_id, app.vehicul_documentului(document_id))
    )
  );

-- Scrierea: cheile rândului-părinte. Inserarea o face și cine CREEAZĂ vehiculul
-- sau documentul (`vehicule_insert` / `vdoc_insert` cer `vehicles:create =
-- all`), corectura cere `vehicles:update = all` (`vehicule_update` /
-- `vdoc_update`).
create policy vc_insert on public.vehicle_costuri
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and (app.has_permission(organization_id, 'vehicles', 'create') = 'all'
         or app.has_permission(organization_id, 'vehicles', 'update') = 'all')
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy vdc_insert on public.vehicle_document_costuri
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and (app.has_permission(organization_id, 'vehicles', 'create') = 'all'
         or app.has_permission(organization_id, 'vehicles', 'update') = 'all')
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy vc_update on public.vehicle_costuri
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
    and updated_by = (select auth.uid())
  );

create policy vdc_update on public.vehicle_document_costuri
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
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
-- 5. Actor, audit, drepturi
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['vehicle_costuri', 'vehicle_document_costuri'] loop
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

-- ============================================================
-- 6. Coloanele vechi: intrare de compatibilitate
-- ============================================================
-- O valoare NENULĂ scrisă în coloana veche (aplicația veche în fereastra
-- dintre migrare și deploy, scripturi, fixture-uri) se mută în tabela de costuri
-- în aceeași instrucțiune, iar coloana rămâne goală. Rularea are loc ÎNAINTEA
-- verificării RLS a rândului-părinte: dacă `vehicule_insert/update` sau
-- `vdoc_insert/update` refuză rândul, toată instrucțiunea cade și mutarea se
-- anulează odată cu ea. `null` nu atinge costul (vezi antetul).
create or replace function internal.vehicles_valoare_in_costuri()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_steag text := coalesce(pg_catalog.current_setting('app.flota_cost_mutat', true), '');
  v_actor uuid := coalesce(new.updated_by, auth.uid());
begin
  perform pg_catalog.set_config('app.flota_cost_mutat', 'on', true);
  insert into public.vehicle_costuri (organization_id, vehicle_id, valoare_achizitie, created_by, updated_by)
  values (new.organization_id, new.id, new.valoare_achizitie, v_actor, v_actor)
  on conflict (vehicle_id) do update
    set valoare_achizitie = excluded.valoare_achizitie,
        updated_by = excluded.updated_by;
  perform pg_catalog.set_config('app.flota_cost_mutat', v_steag, true);
  new.valoare_achizitie := null;
  return new;
end;
$$;

create trigger vehicles_valoare_in_costuri
  before insert or update of valoare_achizitie on public.vehicles
  for each row
  when (new.valoare_achizitie is not null)
  execute function internal.vehicles_valoare_in_costuri();

create or replace function internal.vdoc_cost_in_costuri()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_steag text := coalesce(pg_catalog.current_setting('app.flota_cost_mutat', true), '');
  v_actor uuid := coalesce(new.updated_by, auth.uid());
begin
  perform pg_catalog.set_config('app.flota_cost_mutat', 'on', true);
  insert into public.vehicle_document_costuri (organization_id, document_id, cost, created_by, updated_by)
  values (new.organization_id, new.id, new.cost, v_actor, v_actor)
  on conflict (document_id) do update
    set cost = excluded.cost,
        updated_by = excluded.updated_by;
  perform pg_catalog.set_config('app.flota_cost_mutat', v_steag, true);
  new.cost := null;
  return new;
end;
$$;

create trigger vdoc_cost_in_costuri
  before insert or update of cost on public.vehicle_documents
  for each row
  when (new.cost is not null)
  execute function internal.vdoc_cost_in_costuri();

comment on column public.vehicles.valoare_achizitie is
  'GOALĂ din 0225: valoarea stă în `vehicle_costuri`. O valoare nenulă scrisă aici se mută acolo (trigger) — doar compatibilitate până se aruncă coloana.';
comment on column public.vehicle_documents.cost is
  'GOALĂ din 0225: costul stă în `vehicle_document_costuri`. O valoare nenulă scrisă aici se mută acolo (trigger) — doar compatibilitate până se aruncă coloana.';

-- ============================================================
-- 7. Backfill și golirea coloanelor vechi
-- ============================================================
-- Fără triggere de utilizator (precedentul 0200 §backfill, 0210): nimic din
-- documente sau vehicule nu se schimbă în afara coloanei golite, iar
-- `vdoc_inainte` ar refuza documentele vehiculelor șterse logic.
do $$
declare
  v_vehicule  integer;
  v_documente integer;
  v_mutate    integer;
begin
  select count(*) into v_vehicule from public.vehicles where valoare_achizitie is not null;
  select count(*) into v_documente from public.vehicle_documents where cost is not null;

  -- Cheile străine DEFERRABLE și-ar lăsa verificarea „în așteptare” până la
  -- COMMIT, iar `alter table … enable trigger` refuză o tabelă cu evenimente în
  -- așteptare. Aici părinții există deja: verificarea se face pe loc.
  set constraints public.vc_vehicul_fk, public.vdc_document_fk immediate;

  alter table public.vehicle_costuri disable trigger user;
  alter table public.vehicle_document_costuri disable trigger user;

  insert into public.vehicle_costuri
    (organization_id, vehicle_id, valoare_achizitie, created_at, updated_at, created_by, updated_by)
  select v.organization_id, v.id, v.valoare_achizitie, v.created_at, v.updated_at, v.created_by, v.updated_by
    from public.vehicles v
   where v.valoare_achizitie is not null;
  get diagnostics v_mutate = row_count;
  if v_mutate <> v_vehicule then
    raise exception '0225: backfill vehicule incomplet — % cu valoare, % mutate.', v_vehicule, v_mutate;
  end if;

  insert into public.vehicle_document_costuri
    (organization_id, document_id, cost, created_at, updated_at, created_by, updated_by)
  select d.organization_id, d.id, d.cost, d.created_at, d.updated_at, d.created_by, d.updated_by
    from public.vehicle_documents d
   where d.cost is not null;
  get diagnostics v_mutate = row_count;
  if v_mutate <> v_documente then
    raise exception '0225: backfill documente incomplet — % cu cost, % mutate.', v_documente, v_mutate;
  end if;

  alter table public.vehicle_costuri enable trigger user;
  alter table public.vehicle_document_costuri enable trigger user;

  alter table public.vehicles disable trigger user;
  update public.vehicles set valoare_achizitie = null where valoare_achizitie is not null;
  alter table public.vehicles enable trigger user;

  alter table public.vehicle_documents disable trigger user;
  update public.vehicle_documents set cost = null where cost is not null;
  alter table public.vehicle_documents enable trigger user;

  raise notice '0225: mutate % valori de achiziție și % costuri de document.', v_vehicule, v_documente;
end
$$;

-- Plasa de siguranță: dacă triggerul din §6 e vreodată oprit, scrierea cade
-- (23514) în loc să redeschidă scurgerea.
alter table public.vehicles
  add constraint vehicles_valoare_mutata_ck check (valoare_achizitie is null);
alter table public.vehicle_documents
  add constraint vdoc_cost_mutat_ck check (cost is null);

-- ============================================================
-- 8. Faptele pentru sugestia de avantaj în natură
-- ============================================================
-- Rescrisă din forma ULTIMĂ (0205 §8; verificat cu grep: nicio migrare
-- 0206–0218 n-o mai rescrie). Singura schimbare: valoarea de intrare vine din
-- `vehicle_costuri`. Rămâne a salarizării (`payroll:read = all`), pe UN angajat
-- și o lună, doar pe alocările cu folosință personală: valoarea de intrare e
-- baza legală a avantajului (Codul fiscal art. 76 alin. (3) lit. j), nu o
-- scurgere a parcului.
create or replace function public.avantaj_natura_flota(
  p_organization_id uuid,
  p_employee_id uuid,
  p_luna date
)
returns table (
  assignment_id    uuid,
  vehicle_id       uuid,
  vehicul_nr       text,
  de_la            timestamptz,
  pana_la          timestamptz,
  regim            public.vehicle_fiscal_regime,
  titlu_folosinta  public.vehicle_titlu_folosinta,
  valoare_intrare  numeric,
  chirie_lunara    numeric,
  regim_impozitare public.regim_impozitare
)
language sql
stable
security definer
set search_path = ''
as $$
  with luna as (
    select date_trunc('month', p_luna)::date as inceput,
           (date_trunc('month', p_luna) + interval '1 month - 1 day')::date as sfarsit
  )
  select
    a.id,
    v.id,
    v.nr_inmatriculare,
    a.de_la,
    a.pana_la,
    r.regim,
    r.titlu_folosinta,
    c.valoare_achizitie,
    r.chirie_lunara,
    o.regim_impozitare
  from luna l
  join public.vehicle_assignments a
    on a.organization_id = p_organization_id
   and a.employee_id = p_employee_id
   and a.deleted_at is null
   and a.folosinta_personala
   and (a.de_la at time zone 'Europe/Bucharest')::date <= l.sfarsit
   and (a.pana_la is null or (a.pana_la at time zone 'Europe/Bucharest')::date >= l.inceput)
  join public.vehicles v on v.id = a.vehicle_id and v.organization_id = p_organization_id
  join public.organizations o on o.id = p_organization_id
  left join public.vehicle_costuri c on c.vehicle_id = v.id and c.organization_id = p_organization_id
  -- Regimul la ultima zi a lunii în care omul a avut mașina.
  left join lateral (
    select x.regim, x.titlu_folosinta, x.chirie_lunara
      from public.vehicle_fiscal_regimes x
     where x.vehicle_id = v.id and x.deleted_at is null
       and x.valabil_de_la <= least(l.sfarsit, coalesce((a.pana_la at time zone 'Europe/Bucharest')::date, l.sfarsit))
     order by x.valabil_de_la desc
     limit 1
  ) r on true
  where p_organization_id is not null
    and p_employee_id is not null
    and p_luna is not null
    and ((select app.is_platform_admin())
         or (p_organization_id = any ((select app.current_org_ids())::uuid[])
             and app.has_permission(p_organization_id, 'payroll', 'read') = 'all'))
    and app.feature_on(p_organization_id, 'fleet')
    and app.feature_on(p_organization_id, 'payroll')
  order by a.de_la;
$$;

comment on function public.avantaj_natura_flota(uuid, uuid, date) is
  'Faptele pentru SUGESTIA de avantaj în natură auto (0205; valoarea de intrare din vehicle_costuri din 0225): alocările cu folosință personală ale angajatului în lună, regimul și titlul vehiculului, valoarea de intrare, chiria, regimul de impozitare. Doar payroll:read = all. Nu scrie nimic; calculul: src/domain/fleet/fiscal.ts.';

revoke all on function public.avantaj_natura_flota(uuid, uuid, date) from public, anon;
grant execute on function public.avantaj_natura_flota(uuid, uuid, date) to authenticated, service_role;

revoke all on function internal.vc_inainte() from public, anon, authenticated;
revoke all on function internal.vdc_inainte() from public, anon, authenticated;
revoke all on function internal.vehicles_valoare_in_costuri() from public, anon, authenticated;
revoke all on function internal.vdoc_cost_in_costuri() from public, anon, authenticated;

-- ============================================================
-- 9. Verificare
-- ============================================================
do $$
declare
  v_lipsa text[] := '{}';
  t text;
begin
  foreach t in array array['vehicle_costuri', 'vehicle_document_costuri'] loop
    if (select count(*) from pg_policies where schemaname = 'public' and tablename = t) <> 3 then
      v_lipsa := v_lipsa || ('trio-ul de politici pe ' || t);
    end if;
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and cmd = 'DELETE') then
      v_lipsa := v_lipsa || ('politică DELETE pe ' || t || ' (interzisă)');
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t
                    and cmd = 'UPDATE' and qual is not null and with_check is not null) then
      v_lipsa := v_lipsa || ('USING + WITH CHECK pe ' || t);
    end if;
    if not (select relforcerowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      v_lipsa := v_lipsa || ('FORCE RLS pe ' || t);
    end if;
    if has_table_privilege('authenticated', 'public.' || t, 'DELETE') then
      v_lipsa := v_lipsa || ('DELETE acordat pe ' || t);
    end if;
    if not exists (select 1 from pg_trigger where tgname = 'audit_' || t
                    and tgrelid = ('public.' || t)::regclass) then
      v_lipsa := v_lipsa || ('auditul pe ' || t);
    end if;
  end loop;
  if exists (select 1 from public.vehicles where valoare_achizitie is not null) then
    v_lipsa := v_lipsa || 'vehicles.valoare_achizitie golită';
  end if;
  if exists (select 1 from public.vehicle_documents where cost is not null) then
    v_lipsa := v_lipsa || 'vehicle_documents.cost golită';
  end if;
  if position('vehicle_costuri' in pg_get_functiondef('public.avantaj_natura_flota(uuid,uuid,date)'::regprocedure)) = 0 then
    v_lipsa := v_lipsa || 'avantaj_natura_flota din vehicle_costuri';
  end if;
  if array_length(v_lipsa, 1) > 0 then
    raise exception '0225: lipsesc %', array_to_string(v_lipsa, ', ');
  end if;
end
$$;

commit;
