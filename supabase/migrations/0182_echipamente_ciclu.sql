-- 0182_echipamente_ciclu.sql
--
-- MENTENANȚĂ, FAZA M4: CICLUL DE VIAȚĂ AL ECHIPAMENTULUI.
--
-- ── CE ADUCE ────────────────────────────────────────────────────────────────
--  · `equipment` primește categoria, punctul de lucru (FK compusă pe firmă),
--    garanția (cu scadență în `expirables`, kind `garantie`), service-ul de
--    garanție, echipamentul-părinte (componente, ierarhie ≤ 5 niveluri, fără
--    cicluri), casarea (dată + motiv), marcajul CE, riscul specific, folosirea
--    în afara sediului și observațiile.
--  · Garda `internal.equipment_stare_guard`: casarea cere motiv și refuză cât
--    există sesizări deschise; casarea dezactivează planurile; ștergerea logică
--    cere `maintenance:delete = all`, refuză la fel și șterge logic planurile și
--    contoarele, iar componentele se dezleagă; un echipament șters nu se
--    restaurează din aplicație; părintele, responsabilul și departamentul rămân
--    în firmă; ierarhia nu face cicluri.
--  · `in_conservare` și `casat` scot din scadențe planurile echipamentului;
--    `casat` scoate și autorizațiile ISCIR. Repunerea le readuce. Resincronizarea
--    cheamă DIRECT `sync_expirable` (prin `plan_exp_sync`/`iscir_exp_sync`), nu
--    face UPDATE pe rândurile sursă — regula din 0180.
--  · `ssm_plan_calc` recalculează scadența DOAR când se schimbă coloanele din
--    care se calculează: un UPDATE pe `activ` sau pe `responsabil` nu mai mută
--    o scadență restantă în viitor.
--  · Resetarea contorului păstrează restul până la țintă pe planurile pe contor
--    (`equipment_meters_resetare`); anularea sau corectarea resetării desface
--    mutarea.
--  · RLS: responsabilul echipamentului (fișa lui) vede rândul utilajului viu și
--    citirile lui și poate înregistra o citire OBIȘNUITĂ (nu o resetare) —
--    portalul „echipamentele în grija mea”. Politica de INSERT pe contoare cere,
--    din 0150, `update ≥ team`; aici primește ramura responsabilului și
--    verificarea că utilajul e al firmei și viu.
--
-- ── CE NU FACE ──────────────────────────────────────────────────────────────
--  · Nu schimbă seed-ul de permisiuni. Nu atinge `app.poate_vedea_expirabil`.
--  · Nu adaugă politici DELETE (ștergerea rămâne logică).
--
-- Aplicare: psql byte-exact (`aplica-cloud.sh`), după bancul local.

begin;

-- ============================================================
-- 1. Coloane noi pe `equipment`
-- ============================================================
alter table public.equipment
  add column if not exists categorie                text,
  add column if not exists punct_lucru_id           uuid,
  add column if not exists garantie_expira          date,
  add column if not exists service_garantie         text,
  add column if not exists parent_equipment_id      uuid references public.equipment (id) on delete set null,
  add column if not exists casat_la                 date,
  add column if not exists motiv_casare             text,
  add column if not exists observatii               text,
  add column if not exists marcaj_ce                text not null default 'nu_se_aplica',
  add column if not exists risc_specific            boolean not null default false,
  add column if not exists folosit_in_afara_sediului boolean not null default false;

-- Punctul de lucru rămâne în FIRMĂ: cheia compusă (0097 a adăugat
-- `puncte_lucru_id_org_uk`), ca la `attendance_entries` (0163).
alter table public.equipment drop constraint if exists equipment_punct_lucru_fk;
alter table public.equipment
  add constraint equipment_punct_lucru_fk
  foreign key (punct_lucru_id, organization_id)
  references public.puncte_lucru (id, organization_id)
  on delete set null (punct_lucru_id);

alter table public.equipment drop constraint if exists equipment_marcaj_ce_ck;
alter table public.equipment add constraint equipment_marcaj_ce_ck
  check (marcaj_ce in ('da', 'nu', 'nu_se_aplica'));
alter table public.equipment drop constraint if exists equipment_categorie_ck;
alter table public.equipment add constraint equipment_categorie_ck
  check (categorie is null or char_length(btrim(categorie)) between 1 and 80);
alter table public.equipment drop constraint if exists equipment_service_garantie_ck;
alter table public.equipment add constraint equipment_service_garantie_ck
  check (service_garantie is null or char_length(service_garantie) <= 200);
alter table public.equipment drop constraint if exists equipment_motiv_casare_ck;
alter table public.equipment add constraint equipment_motiv_casare_ck
  check (motiv_casare is null or char_length(motiv_casare) between 5 and 1000);
alter table public.equipment drop constraint if exists equipment_observatii_ck;
alter table public.equipment add constraint equipment_observatii_ck
  check (observatii is null or char_length(observatii) <= 2000);
alter table public.equipment drop constraint if exists equipment_parinte_ck;
alter table public.equipment add constraint equipment_parinte_ck
  check (parent_equipment_id is null or parent_equipment_id <> id);

create index if not exists equipment_categorie_idx
  on public.equipment (organization_id, categorie) where deleted_at is null;
create index if not exists equipment_punct_lucru_idx
  on public.equipment (organization_id, punct_lucru_id) where deleted_at is null;
create index if not exists equipment_parinte_idx
  on public.equipment (parent_equipment_id) where deleted_at is null;
create index if not exists equipment_responsabil_idx
  on public.equipment (organization_id, responsabil_employee_id) where deleted_at is null;
create index if not exists equipment_garantie_idx
  on public.equipment (organization_id, garantie_expira) where deleted_at is null and garantie_expira is not null;

-- ============================================================
-- 2. Garda ciclului de viață
-- ============================================================
-- Reguli de INTEGRITATE pentru toată lumea (și pentru contextul de serviciu):
-- un părinte din altă firmă sau un ciclu de componente e greșit indiferent
-- cine scrie. Reguli de DREPT doar pentru oameni: ștergerea cere
-- `maintenance:delete = all` — politica de UPDATE (`update ≥ team`) lasă rândul
-- oricui administrează, dar nu oricine administrează poate și șterge.
create or replace function internal.equipment_stare_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_deschise   integer;
  v_sus        integer;
  v_jos        integer;
  v_p          uuid;
  v_parent_org uuid;
begin
  -- ── Referințele rămân în FIRMĂ ────────────────────────────────────────────
  if new.responsabil_employee_id is not null
     and (tg_op = 'INSERT' or new.responsabil_employee_id is distinct from old.responsabil_employee_id)
     and not exists (select 1 from public.employees e
                      where e.id = new.responsabil_employee_id and e.organization_id = new.organization_id) then
    raise exception using errcode = 'P0001', message = 'Responsabilul ales nu aparține organizației.';
  end if;
  if new.department_id is not null
     and (tg_op = 'INSERT' or new.department_id is distinct from old.department_id)
     and not exists (select 1 from public.departments d
                      where d.id = new.department_id and d.organization_id = new.organization_id) then
    raise exception using errcode = 'P0001', message = 'Departamentul ales nu aparține organizației.';
  end if;

  -- ── Părintele: aceeași firmă, nu el însuși, fără cicluri, ≤ 5 niveluri ──
  if new.parent_equipment_id is not null
     and (tg_op = 'INSERT' or new.parent_equipment_id is distinct from old.parent_equipment_id) then
    if new.parent_equipment_id = new.id then
      raise exception using errcode = 'P0001',
        message = 'Un echipament nu poate fi propria componentă.';
    end if;
    select e.organization_id into v_parent_org
      from public.equipment e where e.id = new.parent_equipment_id and e.deleted_at is null;
    if v_parent_org is distinct from new.organization_id then
      raise exception using errcode = 'P0001',
        message = 'Echipamentul-părinte nu există sau nu aparține organizației.';
    end if;
    -- Strămoșii noului părinte (ciclu = ne întoarcem la noi înșine).
    v_p := new.parent_equipment_id;
    v_sus := 1;
    while v_p is not null loop
      if v_p = new.id then
        raise exception using errcode = 'P0001',
          message = 'Legarea ar crea un ciclu: echipamentul ales e deja o componentă a acestuia.';
      end if;
      select e.parent_equipment_id into v_p from public.equipment e where e.id = v_p;
      v_sus := v_sus + 1;
      if v_sus > 5 then
        raise exception using errcode = 'P0001',
          message = 'Ierarhia componentelor are cel mult 5 niveluri.';
      end if;
    end loop;
    -- Subarborele nodului mutat: adâncimea totală = strămoși + descendenți.
    with recursive sub as (
      select e.id, 1 as niv from public.equipment e
       where e.parent_equipment_id = new.id and e.deleted_at is null
      union all
      select e.id, sub.niv + 1 from public.equipment e join sub on e.parent_equipment_id = sub.id
       where e.deleted_at is null and sub.niv < 6
    )
    select coalesce(max(niv), 0) into v_jos from sub;
    if v_sus + v_jos > 5 then
      raise exception using errcode = 'P0001',
        message = 'Ierarhia componentelor are cel mult 5 niveluri (cu tot cu componentele acestui echipament).';
    end if;
  end if;

  if tg_op = 'INSERT' then
    if new.status = 'casat' then
      new.casat_la := coalesce(new.casat_la, app.azi_local());
      if coalesce(length(btrim(new.motiv_casare)), 0) < 5 then
        raise exception using errcode = 'P0001',
          message = 'Casarea cere un motiv scris (minimum 5 caractere).';
      end if;
    else
      new.casat_la := null;
      new.motiv_casare := null;
    end if;
    return new;
  end if;

  -- ── Restaurarea nu există ca gest ────────────────────────────────────────
  if old.deleted_at is not null and new.deleted_at is null and not app.is_service_context() then
    raise exception using errcode = 'P0001',
      message = 'Un echipament șters nu se restaurează din aplicație; înregistrați-l din nou.';
  end if;

  -- ── Casarea ───────────────────────────────────────────────────────────────
  if new.status = 'casat' and old.status <> 'casat' then
    if coalesce(length(btrim(new.motiv_casare)), 0) < 5 then
      raise exception using errcode = 'P0001',
        message = 'Casarea cere un motiv scris (minimum 5 caractere).';
    end if;
    new.casat_la := coalesce(new.casat_la, app.azi_local());
    select count(*) into v_deschise
      from public.fault_reports fr
     where fr.equipment_id = new.id and fr.deleted_at is null
       and fr.status in ('nou', 'in_analiza', 'in_lucru', 'in_asteptare');
    if v_deschise > 0 then
      raise exception using errcode = 'P0001',
        message = format('Închideți sau respingeți întâi %s pe acest echipament, apoi casați-l.',
          case when v_deschise = 1 then 'sesizarea deschisă' else 'cele ' || v_deschise || ' sesizări deschise' end);
    end if;
    -- Planurile unui utilaj casat nu mai au ce programa. `ssm_plan_calc` nu
    -- recalculează scadența la un UPDATE care nu-i atinge intrările.
    update public.maintenance_plans
       set activ = false, updated_at = now()
     where equipment_id = new.id and deleted_at is null and activ;
  elsif old.status = 'casat' and new.status <> 'casat' then
    -- Repunerea în evidență șterge urmele casării; planurile rămân inactive,
    -- cine le vrea le repornește explicit.
    new.casat_la := null;
    new.motiv_casare := null;
  end if;

  -- ── Ștergerea logică ──────────────────────────────────────────────────────
  if new.deleted_at is not null and old.deleted_at is null then
    if not (app.is_service_context() or app.is_platform_admin()
            or app.has_permission(new.organization_id, 'maintenance', 'delete') = 'all') then
      raise exception using errcode = 'P0001',
        message = 'Ștergerea unui echipament cere dreptul de ștergere pe mentenanță (administratorul organizației).';
    end if;
    select count(*) into v_deschise
      from public.fault_reports fr
     where fr.equipment_id = new.id and fr.deleted_at is null
       and fr.status in ('nou', 'in_analiza', 'in_lucru', 'in_asteptare');
    if v_deschise > 0 then
      raise exception using errcode = 'P0001',
        message = format('Echipamentul nu se poate șterge: are %s. Închideți-le sau respingeți-le întâi.',
          case when v_deschise = 1 then 'o sesizare deschisă' else v_deschise || ' sesizări deschise' end);
    end if;
    -- Componentele rămân în evidență, dezlegate de un părinte care nu mai există.
    update public.equipment
       set parent_equipment_id = null, updated_at = now()
     where parent_equipment_id = new.id and deleted_at is null;
    update public.maintenance_plans
       set deleted_at = now(), activ = false, updated_at = now()
     where equipment_id = new.id and deleted_at is null;
    update public.equipment_meters
       set deleted_at = now(), updated_at = now()
     where equipment_id = new.id and deleted_at is null;
  end if;

  return new;
end $$;

drop trigger if exists equipment_stare_guard on public.equipment;
create trigger equipment_stare_guard
  before insert or update on public.equipment
  for each row execute function internal.equipment_stare_guard();

-- ============================================================
-- 3. Scadențele țin cont de starea echipamentului — fără UPDATE pe sursă
-- ============================================================
-- Sincronizarea unui plan în `expirables`, scrisă O dată și chemată din două
-- locuri: triggerul planului și resincronizarea la schimbarea stării
-- echipamentului. Un plan al unui utilaj în conservare, casat sau șters iese
-- din scadențe și din alertele zilnice; revine la repunere.
create or replace function internal.plan_exp_sync(p public.maintenance_plans) returns void
language plpgsql security definer set search_path = '' as $$
declare v_echip_ok boolean;
begin
  select e.deleted_at is null and e.status in ('in_functiune', 'in_reparatie')
    into v_echip_ok
    from public.equipment e where e.id = p.equipment_id;
  perform internal.sync_expirable(
    p.organization_id, 'maintenance_plan', p.id, 'scadenta',
    'Mentenanță planificată: ' || p.denumire, p.urmatoarea_scadenta, 'maintenance_plans',
    p.responsabil_employee_id,
    p.deleted_at is null and p.activ and coalesce(v_echip_ok, false));
end $$;

create or replace function internal.maintenance_plan_exp() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform internal.plan_exp_sync(new);
  return null;
end $$;

-- Autorizația unui utilaj casat sau șters nu mai alertează pe nimeni.
-- Conservarea NU o scoate — autorizația expiră oricum, iar repunerea în
-- funcțiune cere una valabilă.
create or replace function internal.iscir_exp_sync(a public.iscir_authorizations) returns void
language plpgsql security definer set search_path = '' as $$
declare v_activ boolean; v_echip_ok boolean;
begin
  select e.deleted_at is null and e.status <> 'casat'
    into v_echip_ok
    from public.equipment e where e.id = a.equipment_id;
  v_activ := a.deleted_at is null and a.suspendata_la is null and coalesce(v_echip_ok, false);
  perform internal.sync_expirable(
    a.organization_id, 'iscir_authorization', a.id, 'autorizatie',
    'Autorizație ISCIR ' || a.numar, a.valabil_pana, 'iscir_authorizations', null, v_activ);
  perform internal.sync_expirable(
    a.organization_id, 'iscir_authorization', a.id, 'verificare_tehnica',
    'Verificare tehnică ISCIR ' || a.numar, a.scadenta_verificare_tehnica, 'iscir_authorizations', null, v_activ);
end $$;

create or replace function internal.iscir_autorizatie_exp() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform internal.iscir_exp_sync(new);
  return null;
end $$;

-- După schimbarea stării (sau a ștergerii), scadențele dependente se
-- resincronizează DIRECT — fără UPDATE pe planuri sau autorizații, care ar
-- lăsa rânduri de audit, ar schimba `updated_by` și ar trece prin `ssm_plan_calc`.
create or replace function internal.equipment_dupa_stare() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p public.maintenance_plans; a public.iscir_authorizations;
begin
  if new.status is distinct from old.status or new.deleted_at is distinct from old.deleted_at then
    for p in select * from public.maintenance_plans where equipment_id = new.id and deleted_at is null loop
      perform internal.plan_exp_sync(p);
    end loop;
    for a in select * from public.iscir_authorizations where equipment_id = new.id and deleted_at is null loop
      perform internal.iscir_exp_sync(a);
    end loop;
  end if;
  return null;
end $$;

drop trigger if exists equipment_dupa_stare on public.equipment;
create trigger equipment_dupa_stare
  after update on public.equipment
  for each row execute function internal.equipment_dupa_stare();

-- Garanția echipamentului: o scadență proprie, kind `garantie`. `sync_expirable`
-- retrage rândul când data dispare (0008), deci o garanție golită iese singură.
create or replace function internal.equipment_exp() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform internal.sync_expirable(
    new.organization_id, 'equipment', new.id, 'garantie',
    left('Garanție ' || new.cod || ' — ' || new.denumire, 200), new.garantie_expira, tg_table_name,
    new.responsabil_employee_id,
    new.deleted_at is null and new.status <> 'casat');
  return null;
end $$;

drop trigger if exists equipment_exp on public.equipment;
create trigger equipment_exp
  after insert or update on public.equipment
  for each row execute function internal.equipment_exp();

-- ============================================================
-- 4. `ssm_plan_calc` recalculează doar când i se schimbă intrările
-- ============================================================
-- Rescris de la forma din 0180. Un UPDATE care nu atinge `ultima_executie`
-- sau `periodicitate_zile` (de pildă `activ = false` la casare) NU mai mută
-- `urmatoarea_scadenta`: altfel orice atingere a rândului împingea o scadență
-- restantă, niciodată executată, de la „acum 10 zile” la „peste 20 de zile”,
-- iar restanța dispărea din scadențe fără urmă.
create or replace function internal.ssm_plan_calc() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_citire numeric(14,2);
begin
  if tg_op = 'INSERT'
     or new.periodicitate_zile is distinct from old.periodicitate_zile
     or new.ultima_executie is distinct from old.ultima_executie then
    if new.periodicitate_zile is not null then
      new.urmatoarea_scadenta := (coalesce(new.ultima_executie,
        (now() at time zone 'Europe/Bucharest')::date) + make_interval(days => new.periodicitate_zile))::date;
    else
      new.urmatoarea_scadenta := null;
    end if;
  end if;

  if tg_op = 'INSERT'
     or new.periodicitate_contor is distinct from old.periodicitate_contor
     or new.tip_contor is distinct from old.tip_contor
     or new.ultima_citire_contor is distinct from old.ultima_citire_contor then
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
  end if;
  return new;
end $$;

-- ============================================================
-- 5. Resetarea contorului păstrează restul până la țintă
-- ============================================================
-- O citire cu `resetare_contor` (contor înlocuit sau adus la zero) mută
-- referința planurilor pe acel tip de contor cu diferența dintre citirea nouă
-- și ultima dinaintea ei: `ssm_plan_calc` recalculează ținta din
-- `ultima_citire_contor`, deci restul până la scadență rămâne același.
-- Anularea logică sau corectarea unei resetări DESFACE mutarea (delta inversă),
-- iar o valoare nouă o reface cu delta ei.
create or replace function internal.equipment_meters_resetare() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_prec        numeric(14,2);
  v_delta_veche numeric(14,2) := 0;
  v_delta_noua  numeric(14,2) := 0;
  v_tip         public.meter_kind;
  v_echip       uuid;
begin
  v_tip := new.tip;
  v_echip := new.equipment_id;
  -- Ultima citire dinaintea rândului, fără rândul însuși.
  select m.citire into v_prec
    from public.equipment_meters m
   where m.organization_id = new.organization_id and m.equipment_id = v_echip
     and m.tip = v_tip and m.deleted_at is null and m.id <> new.id
     and (m.data_citirii, m.created_at) <= (new.data_citirii, new.created_at)
   order by m.data_citirii desc, m.created_at desc limit 1;
  if v_prec is null then return null; end if;

  if tg_op = 'UPDATE' and old.resetare_contor and old.deleted_at is null then
    v_delta_veche := old.citire - v_prec;
  end if;
  if new.resetare_contor and new.deleted_at is null then
    v_delta_noua := new.citire - v_prec;
  end if;
  if v_delta_noua = v_delta_veche then return null; end if;

  update public.maintenance_plans
     set ultima_citire_contor = ultima_citire_contor + (v_delta_noua - v_delta_veche), updated_at = now()
   where organization_id = new.organization_id and equipment_id = v_echip
     and tip_contor = v_tip and deleted_at is null and ultima_citire_contor is not null;
  return null;
end $$;

drop trigger if exists equipment_meters_resetare on public.equipment_meters;
create trigger equipment_meters_resetare
  after insert or update on public.equipment_meters
  for each row execute function internal.equipment_meters_resetare();

-- ============================================================
-- 6. RLS: responsabilul echipamentului
-- ============================================================
drop policy if exists equipment_select on public.equipment;
create policy equipment_select on public.equipment
for select to authenticated
using (
  app.is_platform_admin() or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'maintenance')
    and (
      app.ssm_acces(organization_id, 'maintenance', 'read', null)
      -- Responsabilul utilajului îl vede cât e viu (portalul „echipamentele în grija mea").
      or (deleted_at is null and responsabil_employee_id = app.fisa_mea(organization_id))
      -- Tehnicianul atribuit citește rândul utilajului de pe sesizarea lui (0181).
      or exists (
        select 1 from public.fault_reports fr
         where fr.equipment_id = equipment.id
           and fr.organization_id = equipment.organization_id
           and fr.deleted_at is null
           and fr.atribuit_employee_id = app.fisa_mea(fr.organization_id))
    )
  )
);

drop policy if exists equipment_meters_select on public.equipment_meters;
create policy equipment_meters_select on public.equipment_meters
for select to authenticated
using (
  app.is_platform_admin() or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'maintenance')
    and (
      app.ssm_acces(organization_id, 'maintenance', 'read', null)
      or exists (
        select 1 from public.equipment e
         where e.id = equipment_meters.equipment_id
           and e.organization_id = equipment_meters.organization_id
           and e.deleted_at is null
           and e.responsabil_employee_id = app.fisa_mea(e.organization_id))
    )
  )
);

-- Din 0150: `update ≥ team`. Aici: + responsabilul utilajului, DOAR pentru o
-- citire obișnuită — resetarea mută țintele planurilor, adică editează planuri
-- pe care politica lor nu-l lasă să le atingă. Pentru toată lumea: utilajul e al
-- firmei și viu, iar cititorul (dacă e numit) e un angajat al firmei.
drop policy if exists equipment_meters_insert on public.equipment_meters;
create policy equipment_meters_insert on public.equipment_meters
for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'maintenance')
  and exists (
    select 1 from public.equipment e
     where e.id = equipment_meters.equipment_id
       and e.organization_id = equipment_meters.organization_id
       and e.deleted_at is null
       and e.status <> 'casat'
       and (
         app.ssm_acces(e.organization_id, 'maintenance', 'update', null)
         or (not equipment_meters.resetare_contor
             and e.responsabil_employee_id = app.fisa_mea(e.organization_id))
       ))
  and (citit_de_employee_id is null or exists (
    select 1 from public.employees emp
     where emp.id = equipment_meters.citit_de_employee_id
       and emp.organization_id = equipment_meters.organization_id))
  and deleted_at is null
);

-- ============================================================
-- 7. Drepturi pe funcții
-- ============================================================
do $$
declare f text;
begin
  foreach f in array array[
    'internal.equipment_stare_guard()',
    'internal.equipment_dupa_stare()',
    'internal.equipment_exp()',
    'internal.equipment_meters_resetare()',
    'internal.plan_exp_sync(public.maintenance_plans)',
    'internal.iscir_exp_sync(public.iscir_authorizations)',
    'internal.maintenance_plan_exp()',
    'internal.iscir_autorizatie_exp()',
    'internal.ssm_plan_calc()']
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- ============================================================
-- 8. Datele existente: scadențele se recalculează cu starea echipamentului
-- ============================================================
-- Direct prin `sync_expirable`, nu prin UPDATE pe planuri (vezi secțiunea 3).
do $$
declare p public.maintenance_plans; a public.iscir_authorizations;
begin
  perform set_config('app.sincronizare_expirari', 'on', true);
  for p in
    select pl.* from public.maintenance_plans pl
     where pl.deleted_at is null
       and exists (select 1 from public.equipment e
                    where e.id = pl.equipment_id and (e.status in ('in_conservare', 'casat') or e.deleted_at is not null))
  loop
    perform internal.plan_exp_sync(p);
  end loop;
  for a in
    select au.* from public.iscir_authorizations au
     where au.deleted_at is null
       and exists (select 1 from public.equipment e
                    where e.id = au.equipment_id and (e.status = 'casat' or e.deleted_at is not null))
  loop
    perform internal.iscir_exp_sync(a);
  end loop;
end $$;

-- ============================================================
-- 9. Verificare
-- ============================================================
do $$
declare v_lipsa text[] := '{}';
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'equipment' and column_name = 'parent_equipment_id') then
    v_lipsa := v_lipsa || 'equipment.parent_equipment_id';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'equipment' and column_name = 'garantie_expira') then
    v_lipsa := v_lipsa || 'equipment.garantie_expira';
  end if;
  if to_regprocedure('internal.equipment_stare_guard()') is null then v_lipsa := v_lipsa || 'internal.equipment_stare_guard()'; end if;
  if to_regprocedure('internal.equipment_meters_resetare()') is null then v_lipsa := v_lipsa || 'internal.equipment_meters_resetare()'; end if;
  if to_regprocedure('internal.plan_exp_sync(public.maintenance_plans)') is null then v_lipsa := v_lipsa || 'internal.plan_exp_sync'; end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'equipment_meters' and policyname = 'equipment_meters_insert') then
    v_lipsa := v_lipsa || 'equipment_meters_insert';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.equipment'::regclass and tgname = 'equipment_exp') then
    v_lipsa := v_lipsa || 'trigger equipment_exp';
  end if;
  if array_length(v_lipsa, 1) > 0 then
    raise exception '0182: lipsesc %', array_to_string(v_lipsa, ', ');
  end if;
end $$;

commit;
