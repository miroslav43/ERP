-- 0183_planuri_scadente.sql
--
-- MENTENANȚĂ, FAZA M5: PLANURILE ȘI SCADENȚELE LOR.
--
-- ── CE ADUCE ────────────────────────────────────────────────────────────────
--  · `maintenance_plans` primește MODUL de calcul al scadenței pe zile:
--      - `flotant` (implicit, ca până acum): ultima execuție + periodicitate;
--      - `fix`: o grilă pornită din `data_ancora`, avansată până la prima dată
--        de după ultima execuție și nu mai veche de azi — o revizie „în prima
--        zi a trimestrului” rămâne pe grilă chiar dacă s-a făcut cu întârziere,
--        fără să genereze instanțe restante în serie.
--  · Amânarea (`amanat_pana` + `motiv_amanare`, `numar_amanari`): bate calculul
--    cât e în viitor față de el; execuția reușită o șterge; amânările se numără.
--  · Estimări și context: `durata_estimata_ore`, `cost_estimat`,
--    `oprire_necesara`, `temei_legal`, `categorie_legala` (M7 le va popula din
--    lista de verificări legale).
--  · Index pe (organization_id, activ, urmatoarea_scadenta, id) pentru lista
--    paginată keyset a planurilor.
--
-- ── CE NU FACE ──────────────────────────────────────────────────────────────
--  · Nu schimbă politicile (rămân cele din 0011) și nu adaugă DELETE.
--  · Periodicitatea rămâne în ZILE: „lunar, în ziua 31” nu e exprimabil și nu
--    se pretinde (cazul 36 din plan rămâne deschis, documentat).
--
-- Aplicare: psql byte-exact (`aplica-cloud.sh`), după bancul local.

begin;

-- ============================================================
-- 1. Coloane noi
-- ============================================================
alter table public.maintenance_plans
  add column if not exists mod_calcul          text not null default 'flotant',
  add column if not exists data_ancora         date,
  add column if not exists amanat_pana         date,
  add column if not exists motiv_amanare       text,
  add column if not exists numar_amanari       integer not null default 0,
  add column if not exists durata_estimata_ore numeric(8,2),
  add column if not exists cost_estimat        numeric(14,2),
  add column if not exists oprire_necesara     boolean not null default false,
  add column if not exists temei_legal         text,
  add column if not exists categorie_legala    text;

alter table public.maintenance_plans drop constraint if exists maintenance_plans_mod_calcul_ck;
alter table public.maintenance_plans add constraint maintenance_plans_mod_calcul_ck
  check (mod_calcul in ('flotant', 'fix'));
alter table public.maintenance_plans drop constraint if exists maintenance_plans_amanare_ck;
alter table public.maintenance_plans add constraint maintenance_plans_amanare_ck
  check (amanat_pana is null or char_length(btrim(coalesce(motiv_amanare, ''))) >= 5);
alter table public.maintenance_plans drop constraint if exists maintenance_plans_motiv_amanare_ck;
alter table public.maintenance_plans add constraint maintenance_plans_motiv_amanare_ck
  check (motiv_amanare is null or char_length(motiv_amanare) <= 1000);
alter table public.maintenance_plans drop constraint if exists maintenance_plans_durata_ck;
alter table public.maintenance_plans add constraint maintenance_plans_durata_ck
  check (durata_estimata_ore is null or durata_estimata_ore >= 0);
alter table public.maintenance_plans drop constraint if exists maintenance_plans_cost_ck;
alter table public.maintenance_plans add constraint maintenance_plans_cost_ck
  check (cost_estimat is null or cost_estimat >= 0);
alter table public.maintenance_plans drop constraint if exists maintenance_plans_temei_ck;
alter table public.maintenance_plans add constraint maintenance_plans_temei_ck
  check (temei_legal is null or char_length(temei_legal) <= 300);
alter table public.maintenance_plans drop constraint if exists maintenance_plans_categorie_legala_ck;
alter table public.maintenance_plans add constraint maintenance_plans_categorie_legala_ck
  check (categorie_legala is null or categorie_legala ~ '^[a-z][a-z0-9_]{1,59}$');
alter table public.maintenance_plans drop constraint if exists maintenance_plans_numar_amanari_ck;
alter table public.maintenance_plans add constraint maintenance_plans_numar_amanari_ck
  check (numar_amanari >= 0);

create index if not exists maintenance_plans_scadenta_idx
  on public.maintenance_plans (organization_id, activ, urmatoarea_scadenta, id)
  where deleted_at is null;
create index if not exists maintenance_plans_responsabil_idx
  on public.maintenance_plans (organization_id, responsabil_employee_id)
  where deleted_at is null and activ;

-- ============================================================
-- 2. Calculul scadenței — mod, amânare, numărătoarea amânărilor
-- ============================================================
-- Rescris de la forma din 0182 (care recalculează doar când se schimbă
-- intrările — regula rămâne: un UPDATE pe `activ` sau `responsabil` nu mută
-- scadența; în modul `fix` grila avansează doar la execuție, nu la orice
-- atingere a rândului).
--   · flotant: ultima_executie + periodicitate; fără nicio execuție, de la ziua
--     CREĂRII planului (la INSERT = azi, ca până acum). NU de la azi la orice
--     recalcul: santinela a prins că o amânare cu 7 zile pe un plan anual
--     neexecutat și depășit dădea azi + 365 (calculul pornea din ziua amânării
--     și bătea amânarea prin `greatest`) — verificarea depășită dispărea un an.
--   · fix: grila de la ancoră; prima dată STRICT după ultima execuție și nu
--     mai veche de azi. Aritmetic, nu în buclă: n = ceil((țintă − ancoră)/P).
--   · amânarea: `urmatoarea_scadenta = greatest(calc, amanat_pana)`; o amânare
--     mai veche decât calculul e inertă, nu rupe nimic.
--   · numar_amanari crește când `amanat_pana` primește o valoare nouă.
--   · o amânare nu se pune pe un plan fără periodicitate pe zile — n-ar avea
--     ce amâna (contorul nu se amână: se citește).
create or replace function internal.ssm_plan_calc() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_citire numeric(14,2);
  v_azi    date := app.azi_local();
  v_baza   date;
  v_tinta  date;
  v_n      integer;
  v_calc   date;
begin
  if tg_op = 'UPDATE'
     and new.amanat_pana is not null
     and new.amanat_pana is distinct from old.amanat_pana then
    new.numar_amanari := old.numar_amanari + 1;
  end if;

  if tg_op = 'UPDATE'
     and new.periodicitate_zile is not distinct from old.periodicitate_zile
     and new.ultima_executie is not distinct from old.ultima_executie
     and new.mod_calcul is not distinct from old.mod_calcul
     and new.data_ancora is not distinct from old.data_ancora
     and new.amanat_pana is not distinct from old.amanat_pana then
    null; -- intrările scadenței pe zile nu s-au schimbat: nu se recalculează
  elsif new.periodicitate_zile is not null then
    if new.mod_calcul = 'fix' then
      v_baza  := coalesce(new.data_ancora, new.ultima_executie, v_azi);
      v_tinta := greatest(v_azi, coalesce(new.ultima_executie + 1, v_azi));
      v_n := greatest(0, ceil((v_tinta - v_baza)::numeric / new.periodicitate_zile)::integer);
      v_calc := (v_baza + make_interval(days => v_n * new.periodicitate_zile))::date;
    else
      v_calc := (coalesce(new.ultima_executie,
                          (new.created_at at time zone 'Europe/Bucharest')::date,
                          v_azi)
                 + make_interval(days => new.periodicitate_zile))::date;
    end if;
    if new.amanat_pana is not null and new.amanat_pana > v_calc then
      v_calc := new.amanat_pana;
    end if;
    new.urmatoarea_scadenta := v_calc;
  else
    new.urmatoarea_scadenta := null;
    if new.amanat_pana is not null then
      if tg_op = 'INSERT' or new.amanat_pana is distinct from old.amanat_pana then
        raise exception using errcode = 'P0001',
          message = 'Doar un plan cu periodicitate în zile se poate amâna; scadența pe contor se citește, nu se amână.';
      end if;
      -- Planul a trecut doar pe contor cu o amânare veche pe el: amânarea nu
      -- mai are ce amâna, se curăță — editarea nu e amânare, nu se refuză.
      new.amanat_pana := null;
      new.motiv_amanare := null;
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
-- 3. Execuția reușită șterge amânarea
-- ============================================================
-- Rescris de la forma din 0180: APLICAREA golește `amanat_pana`/`motiv_amanare`
-- (contorul de amânări rămâne, e istoric); RETRAGEREA e neschimbată.
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
           amanat_pana = null,
           motiv_amanare = null,
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
-- 4. Semnătura citirii de contor — și în bază, nu doar în aplicație
-- ============================================================
-- Rescrisă de la forma din 0182. Responsabilul utilajului (fără
-- `maintenance:update`) își semnează citirea cu PROPRIA fișă sau cu nimic;
-- `inregistreazaContor` o fixa deja, dar un POST direct la PostgREST putea
-- pune fișa unui coleg (semnătură falsă, în aceeași firmă). Gestionarul
-- alege în continuare cititorul dintre angajații firmei.
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
             and e.responsabil_employee_id = app.fisa_mea(e.organization_id)
             and (equipment_meters.citit_de_employee_id is null
                  or equipment_meters.citit_de_employee_id = app.fisa_mea(e.organization_id)))
       ))
  and (citit_de_employee_id is null or exists (
    select 1 from public.employees emp
     where emp.id = equipment_meters.citit_de_employee_id
       and emp.organization_id = equipment_meters.organization_id))
  and deleted_at is null
);

-- ============================================================
-- 5. Drepturi pe funcții
-- ============================================================
revoke all on function internal.ssm_plan_calc() from public, anon, authenticated;
revoke all on function internal.ssm_intervention_apply() from public, anon, authenticated;

-- ============================================================
-- 6. Verificare
-- ============================================================
do $$
declare v_lipsa text[] := '{}';
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'maintenance_plans' and column_name = 'mod_calcul') then
    v_lipsa := v_lipsa || 'maintenance_plans.mod_calcul';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'maintenance_plans' and column_name = 'amanat_pana') then
    v_lipsa := v_lipsa || 'maintenance_plans.amanat_pana';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'maintenance_plans_scadenta_idx') then
    v_lipsa := v_lipsa || 'maintenance_plans_scadenta_idx';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'equipment_meters' and policyname = 'equipment_meters_insert' and with_check like '%citit_de_employee_id = app.fisa_mea%') then
    v_lipsa := v_lipsa || 'equipment_meters_insert (semnătura)';
  end if;
  if array_length(v_lipsa, 1) > 0 then
    raise exception '0183: lipsesc %', array_to_string(v_lipsa, ', ');
  end if;
end $$;

commit;
