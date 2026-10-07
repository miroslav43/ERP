-- supabase/migrations/0173_flota_alocari.sql
--
-- FLOTA, FAZA F2: ALOCĂRILE VEHICUL ↔ ȘOFER CA PERIOADE, ȘI MAȘINILE DE POOL.
--
-- ── DE CE PERIOADE, NU UN CÂMP ──────────────────────────────────────────────
-- `vehicles.employee_id` spunea doar cine conduce ACUM. Trei lucruri cer
-- răspunsul la „cine conducea la data X”, deci un istoric:
--   - amenda: firma desemnează conducătorul (OUG 195/2002 art. 39);
--   - avantajul în natură: luna în care mașina a fost folosită personal;
--   - predarea-primirea: kilometrajul la predare și la restituire.
-- Modelat ca un câmp curent, fiecare ar fi cerut ulterior un retrofit cu
-- migrare de date.
--
-- ── CE RĂMÂNE NESCHIMBAT ────────────────────────────────────────────────────
-- `vehicles.employee_id` rămâne, ca DERIVAT al alocării deschise. Așa RLS-ul
-- existent (`app.poate_vedea_vehicul`), responsabilul din `expirables`
-- (`vehicles_dupa` → `flota_resincronizeaza_vehicul`) și toate citirile merg
-- mai departe fără nicio schimbare.
--
-- ── REGULILE ────────────────────────────────────────────────────────────────
-- 1. Alocarea CURENTĂ e cea deschisă (`pana_la is null`). Nu există alocări
--    programate în viitor: nimic nu le-ar activa la ora lor, iar câmpul
--    derivat ar minți până la următoarea scriere.
-- 2. Predarea către alt om închide automat alocarea deschisă, în același
--    INSERT, cu `km_restituire` = `km_predare` al noii alocări. Atomic, fără
--    două apeluri din aplicație.
-- 3. Două alocări ale aceluiași vehicul nu se suprapun (EXCLUDE pe gist).
-- 4. `vehicles.employee_id` nu se mai scrie direct din aplicație: P0001.
--    Excepții: sincronizarea de aici și contextul de serviciu (importuri,
--    seed-ul demo).
--
-- ── POOL ────────────────────────────────────────────────────────────────────
-- `vehicles.pool`: mașina comună, fără șofer fix. În F2 e doar un steag.
-- Vizibilitatea și dreptul de a întocmi foi pe ea le dă F3, odată cu rolurile.
--
-- Corpul lui `internal.vehicles_normalizeaza` e COPIA formei din 0171, cu
-- garda de la regula 4 adăugată.

begin;

-- ============================================================
-- 1. Pool
-- ============================================================

alter table public.vehicles
  add column if not exists pool boolean not null default false;

comment on column public.vehicles.pool is
  'Mașină comună, fără șofer fix (0173). Din F3, orice angajat cu drept de foaie poate întocmi foi pe ea fără alocare.';

-- ============================================================
-- 2. vehicle_assignments
-- ============================================================

create table public.vehicle_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete restrict,
  de_la timestamptz not null,
  pana_la timestamptz,
  folosinta_personala boolean not null default false,
  km_predare integer,
  km_restituire integer,
  observatii text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint va_interval_ck check (pana_la is null or pana_la > de_la),
  constraint va_km_ck check (
    (km_predare is null or km_predare >= 0)
    and (km_restituire is null or km_restituire >= 0)
    and (km_predare is null or km_restituire is null or km_restituire >= km_predare)
  ),
  constraint va_observatii_len check (observatii is null or char_length(observatii) <= 1000)
);

-- Interval semideschis [de_la, pana_la): predarea de la 10:00 și preluarea
-- de la 10:00 nu se suprapun.
alter table public.vehicle_assignments
  add constraint va_fara_suprapunere
  exclude using gist (
    vehicle_id with =,
    tstzrange(de_la, coalesce(pana_la, 'infinity'::timestamptz), '[)') with &&
  ) where (deleted_at is null);

create index va_vehicul_idx on public.vehicle_assignments (organization_id, vehicle_id, de_la desc)
  where deleted_at is null;
create index va_angajat_idx on public.vehicle_assignments (organization_id, employee_id, de_la desc)
  where deleted_at is null;
-- O singură alocare deschisă pe vehicul. EXCLUDE-ul o implică, dar indexul
-- face căutarea ei directă.
create unique index va_deschisa_uq on public.vehicle_assignments (vehicle_id)
  where pana_la is null and deleted_at is null;

comment on table public.vehicle_assignments is
  'Istoricul alocărilor vehicul ↔ șofer (0173). Alocarea curentă e cea cu pana_la null; vehicles.employee_id e derivatul ei.';

-- ============================================================
-- 3. Triggere
-- ============================================================

create or replace function internal.alocari_inainte()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_vehicul public.vehicles%rowtype;
begin
  if tg_op = 'UPDATE' then
    -- Cine, ce mașină și de când sunt faptul alocării. O greșeală aici se
    -- repară ștergând rândul și refăcându-l, nu rescriindu-l.
    if (new.organization_id, new.vehicle_id, new.employee_id, new.de_la)
       is distinct from (old.organization_id, old.vehicle_id, old.employee_id, old.de_la) then
      raise exception using errcode = 'P0001',
        message = 'Șoferul, vehiculul și începutul alocării nu se mai pot schimba. Ștergeți alocarea greșită și refaceți-o.';
    end if;
    if old.pana_la is not null and new.pana_la is distinct from old.pana_la and new.deleted_at is null then
      raise exception using errcode = 'P0001',
        message = 'Alocarea este deja încheiată. Sfârșitul ei nu se mai poate muta.';
    end if;
    if new.pana_la is not null and old.pana_la is null and new.pana_la > now() + interval '5 minutes' then
      raise exception using errcode = 'P0001',
        message = 'Alocarea se încheie cel târziu acum. O predare viitoare se înregistrează când are loc.';
    end if;
    return new;
  end if;

  select * into v_vehicul from public.vehicles v
   where v.id = new.vehicle_id and v.deleted_at is null;
  if not found or v_vehicul.organization_id <> new.organization_id then
    raise exception using errcode = 'P0001',
      message = 'Vehiculul ales nu aparține organizației dumneavoastră.';
  end if;
  if v_vehicul.status in ('vandut', 'casat') then
    raise exception using errcode = 'P0001',
      message = 'Vehiculul este ieșit din parc (vândut sau casat). Nu se mai poate aloca.';
  end if;
  if not exists (
    select 1 from public.employees e
     where e.id = new.employee_id and e.organization_id = new.organization_id and e.deleted_at is null
  ) then
    raise exception using errcode = 'P0001',
      message = 'Angajatul ales nu aparține organizației dumneavoastră.';
  end if;
  if new.de_la > now() + interval '5 minutes' then
    raise exception using errcode = 'P0001',
      message = 'Alocarea începe cel târziu acum. O predare viitoare se înregistrează când are loc.';
  end if;
  if new.pana_la is not null and new.pana_la > now() + interval '5 minutes' then
    raise exception using errcode = 'P0001',
      message = 'Alocarea se încheie cel târziu acum. O predare viitoare se înregistrează când are loc.';
  end if;

  -- Regula 2: predarea către alt om închide alocarea deschisă. Doar dacă
  -- noua alocare e ea însăși deschisă și începe după cea veche; altfel e o
  -- înregistrare retroactivă, iar EXCLUDE-ul hotărăște dacă încape.
  if new.pana_la is null then
    update public.vehicle_assignments a
       set pana_la = new.de_la,
           km_restituire = coalesce(a.km_restituire, new.km_predare),
           updated_at = now(),
           updated_by = new.created_by
     where a.vehicle_id = new.vehicle_id
       and a.pana_la is null
       and a.deleted_at is null
       and a.de_la < new.de_la;
  end if;
  return new;
end;
$$;

-- Derivatul: șoferul alocării deschise, sau nimeni.
create or replace function internal.alocari_sincronizeaza_vehicul(p_vehicle_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_sofer uuid;
begin
  select a.employee_id into v_sofer
    from public.vehicle_assignments a
   where a.vehicle_id = p_vehicle_id and a.pana_la is null and a.deleted_at is null
   limit 1;

  -- Steagul spune gărzii din `vehicles_normalizeaza` că scrierea vine de aici.
  perform set_config('app.flota_sincronizare_alocare', 'on', true);
  update public.vehicles v
     set employee_id = v_sofer, updated_at = now()
   where v.id = p_vehicle_id and v.employee_id is distinct from v_sofer;
  perform set_config('app.flota_sincronizare_alocare', '', true);
end;
$$;

create or replace function internal.alocari_dupa()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform internal.alocari_sincronizeaza_vehicul(new.vehicle_id);
  return null;
end;
$$;

create trigger alocari_inainte before insert or update on public.vehicle_assignments
  for each row execute function internal.alocari_inainte();
create trigger alocari_dupa after insert or update on public.vehicle_assignments
  for each row execute function internal.alocari_dupa();

-- ── Regula 4: vehicles.employee_id se scrie doar prin alocări ───────────────
create or replace function internal.vehicles_normalizeaza()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.nr_inmatriculare := upper(pg_catalog.regexp_replace(coalesce(new.nr_inmatriculare, ''), '[^A-Za-z0-9]', '', 'g'));
  if char_length(new.nr_inmatriculare) < 3 then
    raise exception using errcode = 'P0001',
      message = 'Numărul de înmatriculare este prea scurt. Introduceţi-l în forma B100XYZ.';
  end if;
  if new.vin is not null then
    new.vin := upper(pg_catalog.regexp_replace(new.vin, '[^A-Za-z0-9]', '', 'g'));
  end if;
  if new.status in ('vandut', 'casat') and new.data_iesire is null then
    new.data_iesire := app.azi_local();
  end if;
  if new.status not in ('vandut', 'casat') then
    new.data_iesire := null;
    new.motiv_iesire := null;
  end if;
  -- 0173: șoferul vehiculului e derivatul alocării deschise. Scris direct, ar
  -- rămâne fără istoric — exact golul pe care îl închid alocările.
  if (tg_op = 'INSERT' and new.employee_id is not null)
     or (tg_op = 'UPDATE' and new.employee_id is distinct from old.employee_id) then
    if coalesce(current_setting('app.flota_sincronizare_alocare', true), '') <> 'on'
       and not app.is_service_context() then
      raise exception using errcode = 'P0001',
        message = 'Șoferul vehiculului se schimbă prin alocare: fișa vehiculului, secțiunea „Alocări”.';
    end if;
  end if;
  -- 0018 §F3: doar la INSERT sau la schimbarea efectivă a lui employee_id.
  if new.employee_id is not null
     and (tg_op = 'INSERT' or new.employee_id is distinct from old.employee_id)
     and not exists (
       select 1 from public.employees e
        where e.id = new.employee_id and e.organization_id = new.organization_id and e.deleted_at is null
     ) then
    raise exception using errcode = 'P0001',
      message = 'Angajatul ales pentru vehicul nu aparţine organizaţiei dumneavoastră.';
  end if;
  -- 0171: aceeași regulă pentru departament.
  if new.department_id is not null
     and (tg_op = 'INSERT' or new.department_id is distinct from old.department_id)
     and not exists (
       select 1 from public.departments d
        where d.id = new.department_id and d.organization_id = new.organization_id and d.deleted_at is null
     ) then
    raise exception using errcode = 'P0001',
      message = 'Departamentul ales pentru vehicul nu aparține organizației dumneavoastră.';
  end if;
  return new;
end;
$$;

-- Vehiculul ieșit din parc sau șters nu mai are șofer: alocarea deschisă se
-- închide singură, ca istoricul să spună până când a condus omul mașina.
create or replace function internal.alocari_inchide_la_iesire()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.status in ('vandut', 'casat') and old.status not in ('vandut', 'casat'))
     or (new.deleted_at is not null and old.deleted_at is null) then
    update public.vehicle_assignments a
       set pana_la = greatest(now(), a.de_la + interval '1 second'),
           updated_at = now()
     where a.vehicle_id = new.id and a.pana_la is null and a.deleted_at is null;
  end if;
  return null;
end;
$$;

create trigger vehicles_inchide_alocarea after update on public.vehicles
  for each row execute function internal.alocari_inchide_la_iesire();

-- ============================================================
-- 4. RLS
-- ============================================================

alter table public.vehicle_assignments enable row level security;
alter table public.vehicle_assignments force row level security;

-- Istoricul alocărilor urmează vizibilitatea vehiculului, dar pe șoferul
-- ALOCĂRII: un șofer își vede propriile alocări, inclusiv cele încheiate.
create policy alocari_select on public.vehicle_assignments
  for select to authenticated
  using (
    (select app.is_platform_admin())
    or (
      organization_id = any ((select app.current_org_ids())::uuid[])
      and app.feature_on(organization_id, 'fleet')
      and app.poate_vedea_vehicul(organization_id, employee_id)
    )
  );

create policy alocari_insert on public.vehicle_assignments
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy alocari_update on public.vehicle_assignments
  for update to authenticated
  using (
    deleted_at is null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
    and updated_by = (select auth.uid())
  );

-- ============================================================
-- 5. Actor, audit, drepturi
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array['vehicle_assignments'] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function internal.seteaza_updated_at()',
      t || '_set_updated_at', t);
    perform internal.attach_audit(t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end
$$;

revoke all on function internal.alocari_inainte() from public, anon, authenticated;
revoke all on function internal.alocari_dupa() from public, anon, authenticated;
revoke all on function internal.alocari_sincronizeaza_vehicul(uuid) from public, anon, authenticated;
revoke all on function internal.alocari_inchide_la_iesire() from public, anon, authenticated;
grant execute on function internal.alocari_sincronizeaza_vehicul(uuid) to service_role;

-- ============================================================
-- 6. Backfill: fiecare șofer de azi devine o alocare deschisă
-- ============================================================
--
-- Începutul real nu se știe. `data_achizitie` e cea mai bună aproximare
-- disponibilă, altfel momentul în care vehiculul a intrat în evidență.
-- Rândul derivat nu se mișcă: sincronizarea găsește același șofer.

-- Un șofer ȘTERS LOGIC nu primește alocare deschisă: n-ar mai putea fi
-- restituită de nimeni din interfață. Nimic nu golea `vehicles.employee_id`
-- la ștergerea angajatului, deci starea poate exista (pe producție, la
-- scriere: zero rânduri). Vehiculul rămâne fără șofer, iar verificarea de mai
-- jos are aceeași regulă ca backfill-ul.
select set_config('app.flota_sincronizare_alocare', 'on', true);
update public.vehicles v
   set employee_id = null, updated_at = now()
 where v.employee_id is not null
   and v.deleted_at is null
   and v.status not in ('vandut', 'casat')
   and exists (select 1 from public.employees e
                where e.id = v.employee_id and e.deleted_at is not null);
select set_config('app.flota_sincronizare_alocare', '', true);

insert into public.vehicle_assignments
  (organization_id, vehicle_id, employee_id, de_la, km_predare, observatii, created_by, updated_by)
select v.organization_id, v.id, v.employee_id,
       least(coalesce(v.data_achizitie::timestamptz, v.created_at), v.created_at, now()),
       null,
       'Alocare preluată din fișa vehiculului la introducerea istoricului (0173).',
       v.created_by, v.created_by
  from public.vehicles v
 where v.employee_id is not null
   and v.deleted_at is null
   and v.status not in ('vandut', 'casat')
   and exists (select 1 from public.employees e
                where e.id = v.employee_id and e.deleted_at is null);

do $$
declare v_fara integer;
begin
  select count(*) into v_fara
    from public.vehicles v
   where v.employee_id is not null and v.deleted_at is null
     and v.status not in ('vandut', 'casat')
     and not exists (select 1 from public.vehicle_assignments a
                      where a.vehicle_id = v.id and a.pana_la is null and a.deleted_at is null);
  if v_fara > 0 then
    raise exception 'Backfill incomplet: % vehicule cu șofer rămân fără alocare deschisă.', v_fara;
  end if;
end $$;

commit;

-- ============================================================
-- Note de proiectare
-- ============================================================
--
-- * `employee_id on delete restrict`: un angajat cu istoric de alocări nu
--   dispare fizic. Oricum, ștergerea angajaților e logică în tot proiectul.
-- * Fără politică DELETE: ștergerea e logică, prin `deleted_at`, și rezervată
--   alocării greșite. Ștergerea unei alocări deschise ridică derivatul la NULL
--   prin aceeași sincronizare.
-- * `alocari_inainte` nu verifică `km_predare` față de `vehicles.km_curent`:
--   predarea se poate înregistra retroactiv, cu kilometrajul de atunci.
