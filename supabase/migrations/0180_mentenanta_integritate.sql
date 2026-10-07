-- supabase/migrations/0180_mentenanta_integritate.sql
--
-- MENTENANȚĂ, LOTUL 1 (M1): CINCI DEFECTE TĂCUTE ALE TRIGGERELOR DIN 0011.
--
-- ── CE ERA STRICAT ──────────────────────────────────────────────────────────
-- 1. `ssm_plan_calc` recalcula `urmatoarea_scadenta_contor = coalesce(
--    ultima_citire_contor, 0) + periodicitate` la ORICE scriere. Formularul de
--    editare trimitea mereu `ultima_citire_contor = null`, deci o simplă
--    redenumire a planului îl aducea la „0 + periodicitate": scadența pe contor
--    sărea înapoi, fără nicio eroare. Un plan nou pornea tot de la 0, nu de la
--    contorul real al utilajului, deci „revizie la 500 h" pe un utilaj cu 3.200 h
--    pe ceas apărea depășit din prima zi.
-- 2. `iscir_authorizations_exp` (`ssm_sync_exp` cu '@tip') copia `tip` VERBATIM
--    în `expirables.kind`, unde `expirables_kind_ck` cere `^[a-z][a-z0-9_]{1,48}$`:
--    o autorizație cu tipul „PT R1" cădea cu 23514 pe o tabelă pe care formularul
--    nici n-o pomenea (demo-ul a ocolit-o scriind `verificare_tehnica_periodica`,
--    scripts/demo/populeaza.mjs:4416). Iar `entity_id` era ECHIPAMENTUL, nu
--    autorizația: două autorizații pe același utilaj împărțeau un singur rând de
--    scadență, iar `scadenta_verificare_tehnica` nu ajungea nicăieri.
-- 3. `maintenance_plans_exp` ignora `activ` (un plan dezactivat rămânea în
--    scadențe și în alertele zilnice) și, când `urmatoarea_scadenta` devenea
--    null, ieșea ÎNAINTE de sincronizare — rândul vechi rămânea activ.
-- 4. `ssm_intervention_apply` nu verifica că planul e al aceluiași echipament: o
--    intervenție legată din greșeală muta scadența ALTUI utilaj. Iar anularea
--    logică a unei intervenții nu readucea planul la scadența dinainte.
-- 5. `ssm_meter_guard` verifica doar citirea ANTERIOARĂ: corectarea unei citiri
--    vechi putea face citirea URMĂTOARE, deja înregistrată, mai mică decât ea —
--    exact regresul pe care garda există să-l oprească.
-- Plus: niciuna dintre cele șase tabele n-avea `set_updated_at` (bucla de
-- descoperire din 0001 a rulat înaintea lor), deci `updated_at` rămânea la
-- valoarea de la inserare pe toată viața rândului.
--
-- ── CE NU SE FACE, ȘI DE CE ─────────────────────────────────────────────────
-- · `derogare_acordata_de` rămâne fără FK, ca `created_by`/`updated_by` din
--   `internal.tmpl_ssm`: e o urmă de audit („cine a acordat derogarea") care
--   trebuie să supraviețuiască ștergerii contului, nu o referință de navigat.
-- · Rândurile vechi din `expirables` se DEZACTIVEAZĂ, nu se șterg:
--   `compliance_alerts.expirable_id` are `on delete cascade`, iar alertele
--   confirmate de oameni sunt istoric de conformitate.
-- · Resincronizarea cheamă direct `internal.sync_expirable`, nu face UPDATE pe
--   rândurile sursă: un UPDATE ar trece prin `set_actor` (care ar pune
--   `updated_by = null` sub psql, unde `auth.uid()` e null) și prin
--   `audit_trigger` (un rând de audit per autorizație, fără ca cineva să fi
--   schimbat ceva).
-- · Scrierea directă în `expirables` cere GUC-ul `app.sincronizare_expirari`
--   (`internal.expirables_protejeaza`, 0008:239); se pornește și se oprește în
--   același bloc.

begin;

-- ============================================================
-- 1. updated_at — cele șase tabele de mentenanță
-- ============================================================
-- Tiparul din 0045:294 (`ticket_comments`), pe funcția de nucleu
-- `app.set_updated_at()` (0001:522).
do $$
declare t text;
begin
  foreach t in array array[
    'equipment', 'equipment_meters', 'maintenance_plans',
    'maintenance_interventions', 'fault_reports', 'iscir_authorizations']
  loop
    execute format('drop trigger if exists %I on public.%I', 'set_updated_at_' || t, t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function app.set_updated_at()',
      'set_updated_at_' || t, t);
  end loop;
end $$;

-- ============================================================
-- 2. ssm_plan_calc — scadența pe contor pornește de la contorul real
-- ============================================================
-- Rescris de la forma din 0011:728. Două schimbări:
--   · `ultima_citire_contor` null (plan nou, sau anulat printr-o retragere de
--     intervenție) se ancorează la ULTIMA citire a echipamentului pe acel tip
--     de contor, nu la 0. Fără citiri, rămâne 0 — ecranul spune „fără scadență"
--     și cere prima citire.
--   · o periodicitate scoasă (zile sau contor) își GOLEȘTE scadența, nu o lasă
--     la valoarea veche; triggerul de scadențe de mai jos o retrage din
--     `expirables`.
create or replace function internal.ssm_plan_calc() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_citire numeric(14,2);
begin
  if new.periodicitate_zile is not null then
    new.urmatoarea_scadenta := (coalesce(new.ultima_executie,
      (now() at time zone 'Europe/Bucharest')::date) + make_interval(days => new.periodicitate_zile))::date;
  else
    new.urmatoarea_scadenta := null;
  end if;

  if new.periodicitate_contor is not null then
    if new.ultima_citire_contor is null and new.tip_contor is not null then
      select m.citire into v_citire
        from public.equipment_meters m
       where m.organization_id = new.organization_id
         and m.equipment_id = new.equipment_id
         and m.tip = new.tip_contor
         and m.deleted_at is null
       order by m.data_citirii desc, m.created_at desc
       limit 1;
      new.ultima_citire_contor := v_citire;
    end if;
    new.urmatoarea_scadenta_contor := coalesce(new.ultima_citire_contor, 0) + new.periodicitate_contor;
  else
    new.urmatoarea_scadenta_contor := null;
  end if;
  return new;
end $$;

-- ============================================================
-- 3. ssm_meter_guard — și vecinul următor, nu doar cel anterior
-- ============================================================
-- Rescris de la forma din 0011:678. Un rând anulat logic nu se mai validează
-- (nu mai face parte din serie). Citirea ANTERIOARĂ se verifică la fel ca
-- înainte; citirea URMĂTOARE — care există doar la corecția unui rând vechi —
-- nu poate fi mai mică decât cea corectată, decât dacă ea însăși e o resetare.
create or replace function internal.ssm_meter_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_ultima   numeric(14,2);
  v_urm      numeric(14,2);
  v_urm_res  boolean;
  v_urm_data date;
begin
  if new.deleted_at is not null then return new; end if;

  if new.data_citirii > (now() at time zone 'Europe/Bucharest')::date then
    raise exception using errcode = 'P0001', message = 'Data citirii contorului nu poate fi în viitor.';
  end if;

  select m.citire into v_ultima from public.equipment_meters m
   where m.organization_id = new.organization_id and m.equipment_id = new.equipment_id
     and m.tip = new.tip and m.deleted_at is null and m.id <> new.id
     and (m.data_citirii, m.created_at) <= (new.data_citirii, coalesce(new.created_at, now()))
   order by m.data_citirii desc, m.created_at desc limit 1;
  if found and v_ultima is not null and new.citire < v_ultima and not new.resetare_contor then
    raise exception using errcode = 'P0001',
      message = format('Citirea (%s) este mai mică decât ultima citire înregistrată (%s). Corectați valoarea sau bifați „Resetare contor”.', new.citire, v_ultima);
  end if;

  select m.citire, m.resetare_contor, m.data_citirii into v_urm, v_urm_res, v_urm_data
    from public.equipment_meters m
   where m.organization_id = new.organization_id and m.equipment_id = new.equipment_id
     and m.tip = new.tip and m.deleted_at is null and m.id <> new.id
     and (m.data_citirii, m.created_at) > (new.data_citirii, coalesce(new.created_at, now()))
   order by m.data_citirii asc, m.created_at asc limit 1;
  if found and v_urm is not null and new.citire > v_urm and not v_urm_res then
    raise exception using errcode = 'P0001',
      message = format('Citirea (%s) este mai mare decât citirea următoare, deja înregistrată la %s (%s). Corectați valoarea sau anulați întâi citirea următoare.',
                       new.citire, to_char(v_urm_data, 'DD.MM.YYYY'), v_urm);
  end if;
  return new;
end $$;

-- ============================================================
-- 4. ssm_intervention_apply — planul e al echipamentului; retragerea readuce planul
-- ============================================================
-- Rescris de la forma din 0011:741.
--   · Refuză un plan care nu există în organizație sau e al altui echipament.
--   · APLICARE (rând viu, `reusita`): ca înainte — `ultima_executie` și
--     `ultima_citire_contor` înaintează.
--   · RETRAGERE (rândul e anulat logic, nu mai e `reusita`, sau a plecat pe alt
--     plan): planul se recalculează din intervențiile reușite rămase. Fără
--     niciuna, `ultima_executie` devine null (scadența se reia de azi) și
--     `ultima_citire_contor` se reancorează la contorul real prin
--     `ssm_plan_calc`. Limită asumată: o valoare scrisă de mână la crearea
--     planului („ultima dată făcut în 2024") nu se poate recupera — nu e stocată
--     nicăieri separat.
create or replace function internal.ssm_intervention_apply() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_plan_echip uuid;
  v_ultima     date;
  v_citire     numeric(14,2);
begin
  if new.plan_id is not null then
    select p.equipment_id into v_plan_echip
      from public.maintenance_plans p
     where p.id = new.plan_id and p.organization_id = new.organization_id;
    if not found then
      raise exception using errcode = 'P0001',
        message = 'Planul de mentenanță ales nu există în această organizație.';
    end if;
    if v_plan_echip <> new.equipment_id then
      raise exception using errcode = 'P0001',
        message = 'Planul de mentenanță ales aparține altui echipament. Alegeți un plan al echipamentului pe care s-a făcut intervenția.';
    end if;
  end if;

  if new.plan_id is not null and new.deleted_at is null and new.rezultat = 'reusita' then
    update public.maintenance_plans p
       set ultima_executie = greatest(coalesce(p.ultima_executie, new.data), new.data),
           ultima_citire_contor = coalesce(new.citire_contor, p.ultima_citire_contor),
           updated_at = now()
     where p.id = new.plan_id and p.organization_id = new.organization_id;
  end if;

  if tg_op = 'UPDATE'
     and old.plan_id is not null and old.deleted_at is null and old.rezultat = 'reusita'
     and (new.deleted_at is not null or new.rezultat <> 'reusita'
          or new.plan_id is distinct from old.plan_id) then
    select max(i.data) into v_ultima
      from public.maintenance_interventions i
     where i.plan_id = old.plan_id and i.organization_id = old.organization_id
       and i.deleted_at is null and i.rezultat = 'reusita';
    select i.citire_contor into v_citire
      from public.maintenance_interventions i
     where i.plan_id = old.plan_id and i.organization_id = old.organization_id
       and i.deleted_at is null and i.rezultat = 'reusita' and i.citire_contor is not null
     order by i.data desc, i.created_at desc
     limit 1;
    update public.maintenance_plans p
       set ultima_executie = v_ultima,
           ultima_citire_contor = v_citire,
           updated_at = now()
     where p.id = old.plan_id and p.organization_id = old.organization_id;
  end if;

  return null;
end $$;

-- ============================================================
-- 5. Scadențele ISCIR — un rând pe autorizație, cu `kind` fix
-- ============================================================
-- Înlocuiește `ssm_sync_exp('iscir_authorization','@tip',…,'equipment_id','')`.
-- `kind` nu mai vine din text liber: `autorizatie` pe `valabil_pana` și
-- `verificare_tehnica` pe `scadenta_verificare_tehnica`. `entity_id` e
-- autorizația. O autorizație suspendată sau ștearsă logic iese din scadențe;
-- o dată lipsă retrage rândul ei (`sync_expirable` cu dată null = retragere).
create or replace function internal.iscir_autorizatie_exp() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_activ boolean;
begin
  v_activ := new.deleted_at is null and new.suspendata_la is null;
  perform internal.sync_expirable(
    new.organization_id, 'iscir_authorization', new.id, 'autorizatie',
    'Autorizație ISCIR ' || new.numar, new.valabil_pana, tg_table_name, null, v_activ);
  perform internal.sync_expirable(
    new.organization_id, 'iscir_authorization', new.id, 'verificare_tehnica',
    'Verificare tehnică ISCIR ' || new.numar, new.scadenta_verificare_tehnica, tg_table_name, null, v_activ);
  return null;
end $$;

revoke all on function internal.iscir_autorizatie_exp() from public, anon, authenticated;

drop trigger if exists iscir_authorizations_exp on public.iscir_authorizations;
create trigger iscir_authorizations_exp
  after insert or update on public.iscir_authorizations
  for each row execute function internal.iscir_autorizatie_exp();

-- ============================================================
-- 6. Scadențele planurilor — respectă `activ`, retrage la dată lipsă
-- ============================================================
create or replace function internal.maintenance_plan_exp() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform internal.sync_expirable(
    new.organization_id, 'maintenance_plan', new.id, 'scadenta',
    'Mentenanță planificată: ' || new.denumire, new.urmatoarea_scadenta, tg_table_name,
    new.responsabil_employee_id, new.deleted_at is null and new.activ);
  return null;
end $$;

revoke all on function internal.maintenance_plan_exp() from public, anon, authenticated;

drop trigger if exists maintenance_plans_exp on public.maintenance_plans;
create trigger maintenance_plans_exp
  after insert or update on public.maintenance_plans
  for each row execute function internal.maintenance_plan_exp();

-- ============================================================
-- 7. Datele existente — retragerea rândurilor vechi, resincronizarea
-- ============================================================
do $$
declare
  r record;
  v_vechi uuid[];
begin
  -- 7a. Rândurile ISCIR scrise pe echipament (vechea formă) ies din scadențe.
  --     Direct în `expirables`, deci cu GUC-ul de sincronizare pornit.
  perform set_config('app.sincronizare_expirari', 'on', true);
  with retrase as (
    update public.expirables e
       set is_active = false, deleted_at = now(), updated_at = now()
     where e.entity_type = 'iscir_authorization'
       and e.deleted_at is null
       and not exists (select 1 from public.iscir_authorizations a where a.id = e.entity_id)
    returning e.id
  )
  select coalesce(array_agg(id), '{}') into v_vechi from retrase;

  update public.compliance_alerts c
     set status = 'rezolvat',
         resolved_at = now(),
         nota = 'Închisă automat: scadența ISCIR se ține de acum pe autorizație, nu pe echipament (0180).',
         updated_at = now()
   where c.expirable_id = any (v_vechi)
     and c.status in ('nou', 'confirmat', 'expirat')
     and c.deleted_at is null;
  perform set_config('app.sincronizare_expirari', 'off', true);

  -- 7b. Autorizațiile vii primesc rândurile lor.
  for r in select * from public.iscir_authorizations where deleted_at is null loop
    perform internal.sync_expirable(
      r.organization_id, 'iscir_authorization', r.id, 'autorizatie',
      'Autorizație ISCIR ' || r.numar, r.valabil_pana, 'iscir_authorizations', null,
      r.suspendata_la is null);
    perform internal.sync_expirable(
      r.organization_id, 'iscir_authorization', r.id, 'verificare_tehnica',
      'Verificare tehnică ISCIR ' || r.numar, r.scadenta_verificare_tehnica, 'iscir_authorizations', null,
      r.suspendata_la is null);
  end loop;

  -- 7c. Planurile: `activ` ajunge în `is_active`, scadențele nule se retrag.
  for r in select * from public.maintenance_plans where deleted_at is null loop
    perform internal.sync_expirable(
      r.organization_id, 'maintenance_plan', r.id, 'scadenta',
      'Mentenanță planificată: ' || r.denumire, r.urmatoarea_scadenta, 'maintenance_plans',
      r.responsabil_employee_id, r.activ);
  end loop;
end $$;

-- ============================================================
-- 8. Verificarea migrării
-- ============================================================
do $$
declare
  v_lipsa text[] := '{}';
  t text;
begin
  foreach t in array array[
    'equipment', 'equipment_meters', 'maintenance_plans',
    'maintenance_interventions', 'fault_reports', 'iscir_authorizations']
  loop
    if not exists (
      select 1 from pg_catalog.pg_trigger
       where tgname = 'set_updated_at_' || t and tgrelid = ('public.' || t)::regclass
    ) then
      v_lipsa := v_lipsa || ('set_updated_at_' || t);
    end if;
  end loop;

  if not exists (
    select 1 from pg_catalog.pg_trigger tg
    join pg_catalog.pg_proc p on p.oid = tg.tgfoid
    where tg.tgname = 'iscir_authorizations_exp'
      and tg.tgrelid = 'public.iscir_authorizations'::regclass
      and p.proname = 'iscir_autorizatie_exp'
  ) then
    v_lipsa := v_lipsa || 'iscir_authorizations_exp pe iscir_autorizatie_exp';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_trigger tg
    join pg_catalog.pg_proc p on p.oid = tg.tgfoid
    where tg.tgname = 'maintenance_plans_exp'
      and tg.tgrelid = 'public.maintenance_plans'::regclass
      and p.proname = 'maintenance_plan_exp'
  ) then
    v_lipsa := v_lipsa || 'maintenance_plans_exp pe maintenance_plan_exp';
  end if;

  if exists (
    select 1 from public.expirables e
     where e.entity_type = 'iscir_authorization' and e.deleted_at is null
       and not exists (select 1 from public.iscir_authorizations a where a.id = e.entity_id)
  ) then
    v_lipsa := v_lipsa || 'rânduri ISCIR vechi (pe echipament) încă active în expirables';
  end if;

  if exists (
    select 1 from public.expirables e
    join public.maintenance_plans p on p.id = e.entity_id
     where e.entity_type = 'maintenance_plan' and e.deleted_at is null and e.is_active
       and (not p.activ or p.deleted_at is not null)
  ) then
    v_lipsa := v_lipsa || 'plan inactiv încă activ în expirables';
  end if;

  if array_length(v_lipsa, 1) > 0 then
    raise exception 'Migrarea 0180 e incompletă: %', array_to_string(v_lipsa, '; ');
  end if;
end $$;

commit;
