-- supabase/migrations/0155_aprobarea_deplasarii.sql
--
-- DRUMUL UNEI DEPLASĂRI: ANGAJATUL TRIMITE, MANAGERUL DECIDE.
--
-- ── DE UNDE VINE MIGRAREA ───────────────────────────────────────────────────
-- `tests/rls/proba-aprobare-deplasare.sql`, rulată pe banc peste 0154, a picat
-- 4 din 6, cu identitatea reală a rolurilor:
--
--   (1) angajatul nu-și poate TRIMITE deplasarea — P0001 „Starea in_aprobare o
--       poate pune doar cine are dreptul de aprobare". 0146 (F08) a pus
--       `in_aprobare` printre stările de decizie. Dar `in_aprobare` e starea
--       în care o pune `trimiteDeplasare`, cu `per_diem:update = own`. Pe
--       producție, de la 0146, niciun angajat și niciun manager nu mai putea
--       trimite o deplasare spre aprobare.
--   (2)(3) managerul nu poate APROBA și nici RESPINGE — 42501. Capcana #16:
--       `business_trips_update` lasă aprobatorul să treacă de `USING`, dar
--       `WITH CHECK` cere `update` pe rândul nou, pe care managerul îl are doar
--       pe `own` (0154), nu pe `team`.
--   (4) managerul nu poate aproba o CHELTUIALĂ — 42501, aceeași formă pe
--       `trip_expenses_update`.
--
-- ── CE SE SCHIMBĂ ───────────────────────────────────────────────────────────
-- WITH CHECK primește aceeași ramură de aprobare pe care o are deja USING:
-- aprobatorul trece dacă rândul NOU e tot în aria lui (`approve` pe angajatul
-- rândului nou — deci nu poate muta deplasarea la cineva din afara echipei).
-- Ce are voie să schimbe aprobatorul rămâne treaba triggerelor
-- (`valideaza_deplasare`, `valideaza_cheltuiala_deplasare`), neschimbate aici
-- în afară de condiția de la (1).
--
-- Nu se dă managerului `per_diem:update = team`: i-ar deschide și ramura de
-- `USING` pentru ciornele echipei — să le scrie în locul oamenilor.

begin;

-- ── 1. business_trips: aprobatorul trece și de WITH CHECK ──────────────────
drop policy business_trips_update on public.business_trips;
create policy business_trips_update on public.business_trips
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      app.poate_accesa_deplasare(organization_id, employee_id, 'approve')
      or (app.poate_accesa_deplasare(organization_id, employee_id, 'update') and status in ('ciorna', 'respinsa'))
    )
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      app.poate_accesa_deplasare(organization_id, employee_id, 'approve')
      or app.poate_accesa_deplasare(organization_id, employee_id, 'update')
    )
  );

-- ── 2. trip_expenses: la fel ───────────────────────────────────────────────
drop policy trip_expenses_update on public.trip_expenses;
create policy trip_expenses_update on public.trip_expenses
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      app.poate_accesa_deplasare(organization_id, app.deplasare_angajat(business_trip_id), 'approve')
      or (app.poate_accesa_deplasare(organization_id, app.deplasare_angajat(business_trip_id), 'update')
          and aprobata = false)
    )
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      app.poate_accesa_deplasare(organization_id, app.deplasare_angajat(business_trip_id), 'approve')
      or app.poate_accesa_deplasare(organization_id, app.deplasare_angajat(business_trip_id), 'update')
    )
  );

-- ── 3. Trimiterea e a deținătorului (copie a funcției din 0146, o condiție) ─
CREATE OR REPLACE FUNCTION internal.valideaza_deplasare()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ok boolean;
begin
  select true into v_ok
  from public.employees e
  where e.id = new.employee_id and e.organization_id = new.organization_id and e.deleted_at is null;
  if v_ok is not true then
    raise exception 'Angajatul selectat nu aparține organizației curente.' using errcode = 'P0001';
  end if;

  if new.vehicle_id is not null and to_regclass('public.vehicles') is not null then
    execute 'select true from public.vehicles v where v.id = $1 and v.organization_id = $2'
      into v_ok using new.vehicle_id, new.organization_id;
    if v_ok is not true then
      raise exception 'Vehiculul selectat nu aparține organizației curente.' using errcode = 'P0001';
    end if;
  end if;

  if not exists (select 1 from app.per_diem_politica(new.organization_id, new.plecare_la::date)) then
    raise exception 'Nu există o politică de diurnă valabilă la data plecării. Configurați politica firmei mai întâi.'
      using errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE' then
    if new.organization_id <> old.organization_id then
      raise exception 'Deplasarea nu poate fi mutată în altă organizație.' using errcode = 'P0001';
    end if;

    -- ── Cine decide nu e cine cere (F08) ───────────────────────────────────
    -- `business_trips_update` lăsa deținătorul (per_diem:update = own, adică
    -- orice angajat) să-și plimbe singur deplasarea prin toate stările, până la
    -- „decontată": WITH CHECK-ul politicii nu se uita la statusul-ȚINTĂ, iar
    -- acțiunile care cer `per_diem:approve` (`decideDeplasare`,
    -- `deconteazaDeplasare`) se ocoleau cu un PATCH direct. Deținătorul poate
    -- muta între ciorna/trimisa; orice stare de DECIZIE cere aprobator.
    -- Tiparul e cel deja folosit corect la `trip_expenses`.
    -- Trimiterea (ciorna/respinsa → in_aprobare) e a deținătorului: o face
    -- `trimiteDeplasare`, cu `per_diem:update`. Doar stările de DECIZIE cer
    -- aprobator. 0146 punea și `in_aprobare` în listă — nimeni fără `approve`
    -- nu-și mai putea trimite deplasarea (0155, proba-aprobare-deplasare (1)).
    if new.status is distinct from old.status
       and (new.status in ('aprobata', 'respinsa', 'decontata')
            or (new.status = 'in_aprobare' and old.status not in ('ciorna', 'respinsa')))
       and not app.is_service_context()
       and not app.poate_accesa_deplasare(new.organization_id, new.employee_id, 'approve') then
      raise exception 'Starea „%" o poate pune doar cine are dreptul de aprobare a diurnei.', new.status
        using errcode = 'P0001';
    end if;
    if new.status <> old.status
       and old.status in ('decontata', 'anulata')
       and new.status <> old.status then
      raise exception 'O deplasare decontată sau anulată nu mai poate schimba starea.' using errcode = 'P0001';
    end if;
    if old.status not in ('ciorna', 'respinsa')
       and new.status = old.status
       and (new.plecare_la, new.sosire_la, new.employee_id) is distinct from (old.plecare_la, old.sosire_la, old.employee_id)
       and not app.poate_accesa_deplasare(new.organization_id, new.employee_id, 'approve') then
      raise exception 'Deplasarea este deja în aprobare; datele de bază pot fi modificate doar de un aprobator.'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$function$;

commit;
