-- supabase/migrations/0192_mentenanta_interventii_complete.sql
--
-- MENTENANȚĂ, FAZA M6: INTERVENȚIILE COMPLETE.
--
-- ── CE ADUCE ────────────────────────────────────────────────────────────────
-- Până aici o intervenție se putea doar înregistra: n-avea număr, nu se putea
-- corecta, nu se putea anula din interfață, iar piesele erau un text liber cu o
-- sumă tastată separat. Procesul-verbal de intervenție exista în registru
-- (`pv_interventie`, 0136/0142) fără ca documentul să aibă vreo identitate.
--
-- 1. Număr `PV-2026-0001` prin `public.document_sequences` (tipul
--    `pv_interventie`, același mecanism ca sesizările `SZ-…`, 0181 §4 — al
--    treilea contor e interzis de 0098:16). Rândurile existente îl primesc
--    retroactiv, în ordinea datei (cazul 46).
-- 2. Garanția LUCRĂRII (`garantie_lucrare_pana`), numărul documentului
--    furnizorului (deviz, factură, raport de service) și `acoperit_de_garantie`
--    — costul unei intervenții acoperite de garanție se raportează separat
--    (cazul 23).
-- 3. Linii de piese (`maintenance_intervention_parts`, decizia D4): cât există
--    măcar o linie vie, `cost_piese` = suma valorilor, iar o sumă tastată de
--    mână e suprascrisă (cazul 32: „liniile câștigă"). Ultima linie ștearsă
--    lasă `cost_piese = 0`, nu suma veche.
-- 4. Garda intervenției: anularea uneia care a rezolvat o sesizare
--    `rezolvat|inchis` e refuzată cu numărul sesizării (cazul 31); o
--    intervenție anulată nu se reactivează; numărul, echipamentul și sesizarea
--    nu se schimbă prin editare.
-- 5. `internal.ssm_intervention_apply` rescris de la forma din 0183: o EDITARE
--    a unei intervenții deja aplicate (data, citirea contorului) recalculează
--    planul din intervențiile lui, iar o atingere oarecare (descriere, cost,
--    piese) NU mai șterge amânarea curentă a planului — înainte, orice UPDATE
--    pe o intervenție reușită veche ștergea `amanat_pana`.
-- 6. `internal.maintenance_interventions_oprire` rescris de la forma din 0181:
--    editarea opririi unei intervenții planificate își mută rândul din jurnal.
-- 7. `app.mentenanta_poate_fisier` rescris de la forma din 0181: procesul-verbal
--    se urcă ÎNAINTE de intervenție (calea poartă id-ul ei, generat în
--    browser), fiindcă verificarea legală nu se poate înregistra fără el
--    (cazul 34). Pe un id de intervenție care NU EXISTĂ NICĂIERI, cine are
--    `maintenance:update` în organizația din cale poate urca și citi; rândul din
--    `maintenance_attachments` cere în continuare intervenția existentă
--    (`app.mentenanta_poate_atasament` rămâne neatinsă).
--
-- ── CE NU FACE ──────────────────────────────────────────────────────────────
--  · Nu cere PV-ul în trigger: atașamentul se inserează DUPĂ intervenție, deci
--    o regulă în bază ar refuza orice verificare legală. Regula e în acțiune.
--  · Nu impune „exact un executant" în bază: rândurile existente pot avea
--    oricare combinație (cazul 46); regula e în Zod, pentru scrierile noi.
--  · Nu rescrie harta registrului (`internal.registru_config_surse`, 0142):
--    `pv_interventie` e deja înregistrat la INSERT, cu numărul registrului;
--    numărul `PV-…` nu intră în coloana „număr de la emitent", fiindcă emitentul
--    e chiar firma (documentul intern n-are alt număr decât al registrului).
--  · Nu adaugă politici DELETE și nu atinge `app.poate_vedea_expirabil`.
--
-- Aplicare: psql byte-exact, după bancul local; pe producție doar cu
-- confirmarea explicită a utilizatorului.

begin;

-- ============================================================
-- 1. Coloane noi pe `maintenance_interventions`
-- ============================================================
alter table public.maintenance_interventions
  add column if not exists numar                    text,
  add column if not exists numar_document_furnizor  text,
  add column if not exists garantie_lucrare_pana    date,
  add column if not exists acoperit_de_garantie     boolean not null default false;

alter table public.maintenance_interventions
  drop constraint if exists maintenance_interventions_doc_furnizor_ck,
  add constraint maintenance_interventions_doc_furnizor_ck
    check (numar_document_furnizor is null or char_length(btrim(numar_document_furnizor)) between 1 and 80),
  drop constraint if exists maintenance_interventions_garantie_ck,
  add constraint maintenance_interventions_garantie_ck
    check (garantie_lucrare_pana is null or garantie_lucrare_pana >= data);

-- Lista paginată (sortarea implicită e pe dată) și filtrele noi.
create index if not exists maintenance_interventions_data_idx
  on public.maintenance_interventions (organization_id, data, id) where deleted_at is null;
create index if not exists maintenance_interventions_executant_idx
  on public.maintenance_interventions (organization_id, executant_employee_id) where deleted_at is null;
-- Garanția lucrării, citită la fiecare sesizare nouă pe echipament.
create index if not exists maintenance_interventions_garantie_idx
  on public.maintenance_interventions (organization_id, equipment_id, garantie_lucrare_pana)
  where deleted_at is null and garantie_lucrare_pana is not null;

-- ============================================================
-- 2. Liniile de piese
-- ============================================================
create table if not exists public.maintenance_intervention_parts (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete restrict,
  intervention_id  uuid not null references public.maintenance_interventions (id) on delete restrict,
  denumire         text not null,
  cod              text,
  cantitate        numeric(12,3) not null,
  unitate          text not null default 'buc',
  pret_unitar      numeric(14,2) not null default 0,
  -- Rotunjită la bani: suma liniilor trebuie să fie exact ce se vede pe ecran.
  valoare          numeric(14,2) generated always as (round(cantitate * pret_unitar, 2)) stored,
  created_at       timestamptz not null default now(),
  created_by       uuid,
  updated_at       timestamptz not null default now(),
  updated_by       uuid,
  deleted_at       timestamptz,
  constraint maintenance_intervention_parts_denumire_ck check (char_length(btrim(denumire)) between 1 and 200),
  constraint maintenance_intervention_parts_cod_ck check (cod is null or char_length(btrim(cod)) between 1 and 80),
  constraint maintenance_intervention_parts_cantitate_ck check (cantitate > 0),
  constraint maintenance_intervention_parts_unitate_ck check (char_length(btrim(unitate)) between 1 and 20),
  constraint maintenance_intervention_parts_pret_ck check (pret_unitar >= 0)
);
create index if not exists maintenance_intervention_parts_interventie_idx
  on public.maintenance_intervention_parts (intervention_id) where deleted_at is null;
create index if not exists maintenance_intervention_parts_org_idx
  on public.maintenance_intervention_parts (organization_id) where deleted_at is null;

-- ============================================================
-- 3. Numerotarea `PV-2026-0001`
-- ============================================================
create or replace function internal.aloca_numar_pv_interventie(p_org uuid, p_an integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_numar   integer;
  v_prefix  text;
  v_padding smallint;
begin
  insert into public.document_sequences (organization_id, document_type, year, prefix, next_number, padding)
  values (p_org, 'pv_interventie', p_an, 'PV', 2, 4)
  on conflict (organization_id, document_type, year) do update
    set next_number = public.document_sequences.next_number + 1,
        updated_at  = now()
  returning next_number - 1, prefix, padding
       into v_numar, v_prefix, v_padding;
  return coalesce(nullif(v_prefix, ''), 'PV') || '-' || p_an::text || '-' || lpad(v_numar::text, v_padding, '0');
end;
$$;

-- Anul documentului. `data` e tastată de om și NU are interval în bază: un an
-- „6" sau „20266" ar încălca `document_sequences_year_check` și ar opri
-- inserarea (exact ce a oprit backfill-ul registrului în 0136). În afara
-- intervalului 2000–2200 se ia anul de azi.
create or replace function internal.an_pv_interventie(p_data date)
returns integer
language sql
stable
set search_path = ''
as $$
  select case
           when p_data is not null and extract(year from p_data)::integer between 2000 and 2200
             then extract(year from p_data)::integer
           else extract(year from (now() at time zone 'Europe/Bucharest'))::integer
         end;
$$;

-- Numărul îl dă ÎNTOTDEAUNA baza (ca la sesizări): un client nu-și rezervă
-- „PV-2026-0001". Doar contextul de serviciu poate aduce unul gata făcut.
create or replace function internal.maintenance_interventions_numar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_service_context() or coalesce(new.numar, '') = '' then
    new.numar := internal.aloca_numar_pv_interventie(
      new.organization_id, internal.an_pv_interventie(new.data));
  end if;
  return new;
end;
$$;

-- Retroactiv, în ordinea datei. Triggerele de utilizator se opresc pe durata
-- umplerii (precedentul 0181 §4): altfel fiecare rând ar primi audit „update",
-- iar `ssm_intervention_apply` ar rula degeaba pe fiecare plan.
do $$
declare r record;
begin
  alter table public.maintenance_interventions disable trigger user;
  for r in
    select id, organization_id, data
      from public.maintenance_interventions
     where numar is null
     order by organization_id, data, created_at, id
  loop
    update public.maintenance_interventions
       set numar = internal.aloca_numar_pv_interventie(r.organization_id, internal.an_pv_interventie(r.data))
     where id = r.id;
  end loop;
  alter table public.maintenance_interventions enable trigger user;
end $$;

alter table public.maintenance_interventions alter column numar set not null;
-- `default ''`: tipul generat pentru `Insert` nu cere coloana (o scrie triggerul).
alter table public.maintenance_interventions alter column numar set default '';
alter table public.maintenance_interventions
  drop constraint if exists maintenance_interventions_numar_ck,
  add constraint maintenance_interventions_numar_ck check (numar ~ '^[A-Z]{2,16}-[0-9]{4}-[0-9]{1,12}$');
create unique index if not exists maintenance_interventions_numar_uq
  on public.maintenance_interventions (organization_id, numar) where deleted_at is null;

drop trigger if exists maintenance_interventions_numar on public.maintenance_interventions;
create trigger maintenance_interventions_numar
  before insert on public.maintenance_interventions
  for each row execute function internal.maintenance_interventions_numar();

-- ============================================================
-- 4. Garda intervenției
-- ============================================================
-- BEFORE UPDATE. Integritate, nu drepturi — cine poate scrie decide politica de
-- UPDATE (`maintenance:update`). De aceea anularea blocată de sesizare se aplică
-- și în contextul de serviciu: o sesizare „rezolvată" de o intervenție anulată
-- e o contradicție, oricine ar scrie-o. Restul regulilor lasă serviciul liber
-- (importuri, corecturi de date).
create or replace function internal.maintenance_interventions_garda()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sesizare record;
  v_suma     numeric(14,2);
begin
  if old.deleted_at is null and new.deleted_at is not null then
    select fr.numar, fr.status into v_sesizare
      from public.fault_reports fr
     where fr.intervention_id = new.id
       and fr.organization_id = new.organization_id
       and fr.deleted_at is null
       and fr.status in ('rezolvat', 'inchis')
     limit 1;
    if found then
      if v_sesizare.status = 'inchis' then
        raise exception using errcode = 'P0001',
          message = 'Intervenția a rezolvat sesizarea ' || v_sesizare.numar
                    || ', care e deja închisă: nu se mai poate anula. Corectați-o prin editare.';
      end if;
      raise exception using errcode = 'P0001',
        message = 'Intervenția a rezolvat sesizarea ' || v_sesizare.numar
                  || '. Redeschideți întâi sesizarea ' || v_sesizare.numar || ', apoi anulați intervenția.';
    end if;
  end if;

  if not app.is_service_context() then
    if old.deleted_at is not null and new.deleted_at is null then
      raise exception using errcode = 'P0001',
        message = 'O intervenție anulată nu se mai reactivează. Înregistrați-o din nou, dacă a avut loc.';
    end if;
    if new.equipment_id is distinct from old.equipment_id then
      raise exception using errcode = 'P0001',
        message = 'Echipamentul unei intervenții nu se schimbă. Anulați-o și înregistrați-o pe echipamentul corect.';
    end if;
    if new.fault_report_id is distinct from old.fault_report_id then
      raise exception using errcode = 'P0001',
        message = 'Sesizarea de care ține o intervenție nu se schimbă prin editare.';
    end if;
    new.numar := old.numar;
  end if;

  -- Liniile de piese câștigă peste suma tastată (cazul 32).
  select sum(p.valoare) into v_suma
    from public.maintenance_intervention_parts p
   where p.intervention_id = new.id and p.deleted_at is null;
  if v_suma is not null then
    new.cost_piese := v_suma;
  end if;

  return new;
end;
$$;

drop trigger if exists maintenance_interventions_garda on public.maintenance_interventions;
create trigger maintenance_interventions_garda
  before update on public.maintenance_interventions
  for each row execute function internal.maintenance_interventions_garda();

-- ============================================================
-- 5. Liniile de piese: garda și suma
-- ============================================================
-- Garda (BEFORE): intervenția e în aceeași firmă și VIE, iar o linie nu se mută
-- pe altă intervenție. Politica o cere și ea la INSERT; aici ține și la UPDATE.
create or replace function internal.maintenance_intervention_parts_garda()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.intervention_id is distinct from old.intervention_id then
    raise exception using errcode = 'P0001',
      message = 'O linie de piese nu se mută pe altă intervenție. Ștergeți-o și adăugați-o acolo.';
  end if;
  if not exists (
    select 1 from public.maintenance_interventions i
     where i.id = new.intervention_id
       and i.organization_id = new.organization_id
       and i.deleted_at is null
  ) then
    raise exception using errcode = 'P0001',
      message = 'Intervenția nu există în această organizație sau a fost anulată. Piesele nu se mai pot modifica.';
  end if;
  return new;
end;
$$;

drop trigger if exists maintenance_intervention_parts_garda on public.maintenance_intervention_parts;
create trigger maintenance_intervention_parts_garda
  before insert or update on public.maintenance_intervention_parts
  for each row execute function internal.maintenance_intervention_parts_garda();

-- Suma (AFTER): `cost_piese` urmează liniile vii; fără nicio linie vie, 0.
-- UPDATE-ul trece prin garda intervenției, care recalculează și ea suma — cele
-- două sunt de acord prin construcție.
create or replace function internal.maintenance_intervention_parts_suma()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.maintenance_interventions i
     set cost_piese = coalesce((
           select sum(p.valoare)
             from public.maintenance_intervention_parts p
            where p.intervention_id = i.id and p.deleted_at is null), 0),
         updated_at = now()
   where i.id = new.intervention_id
     and i.organization_id = new.organization_id
     and i.deleted_at is null;
  return null;
end;
$$;

drop trigger if exists maintenance_intervention_parts_suma on public.maintenance_intervention_parts;
create trigger maintenance_intervention_parts_suma
  after insert or update on public.maintenance_intervention_parts
  for each row execute function internal.maintenance_intervention_parts_suma();

-- ============================================================
-- 6. Aplicarea pe plan — editarea nu mai șterge amânarea
-- ============================================================
-- Rescris de la forma din 0183. Trei cazuri, după starea „aplicată" (pe plan,
-- vie, reușită) de dinainte și de după:
--   · devine aplicată (INSERT, sau UPDATE care o face aplicată ori îi schimbă
--     planul) → planul primește execuția și își pierde amânarea (ca în 0183);
--   · încetează să fie aplicată pe planul vechi → planul revine la intervenția
--     anterioară (ca în 0180/0183);
--   · rămâne aplicată pe ACELAȘI plan, dar data sau citirea s-au corectat →
--     planul se recalculează din intervențiile lui, fără să-i atingă amânarea.
-- Orice altă editare (descriere, costuri, piese) nu mai atinge planul.
create or replace function internal.ssm_intervention_apply() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_plan_echip   uuid;
  v_ultima       date;
  v_citire       numeric(14,2);
  v_nou_aplicat  boolean;
  v_vechi_aplicat boolean;
  v_plan_recalc  uuid := null;
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

  v_nou_aplicat := new.plan_id is not null and new.deleted_at is null and new.rezultat = 'reusita';
  v_vechi_aplicat := tg_op = 'UPDATE'
                     and old.plan_id is not null and old.deleted_at is null and old.rezultat = 'reusita';

  if v_nou_aplicat
     and (tg_op = 'INSERT' or not v_vechi_aplicat or new.plan_id is distinct from old.plan_id) then
    update public.maintenance_plans p
       set ultima_executie = greatest(coalesce(p.ultima_executie, new.data), new.data),
           ultima_citire_contor = coalesce(new.citire_contor, p.ultima_citire_contor),
           amanat_pana = null,
           motiv_amanare = null,
           updated_at = now()
     where p.id = new.plan_id and p.organization_id = new.organization_id;
  end if;

  if v_vechi_aplicat and (not v_nou_aplicat or new.plan_id is distinct from old.plan_id) then
    v_plan_recalc := old.plan_id;
  elsif v_vechi_aplicat and v_nou_aplicat
        and (new.data is distinct from old.data or new.citire_contor is distinct from old.citire_contor) then
    v_plan_recalc := new.plan_id;
  end if;

  if v_plan_recalc is not null then
    select max(i.data) into v_ultima
      from public.maintenance_interventions i
     where i.plan_id = v_plan_recalc and i.organization_id = new.organization_id
       and i.deleted_at is null and i.rezultat = 'reusita';
    select i.citire_contor into v_citire
      from public.maintenance_interventions i
     where i.plan_id = v_plan_recalc and i.organization_id = new.organization_id
       and i.deleted_at is null and i.rezultat = 'reusita' and i.citire_contor is not null
     order by i.data desc, i.created_at desc
     limit 1;
    update public.maintenance_plans p
       set ultima_executie = v_ultima,
           ultima_citire_contor = v_citire,
           updated_at = now()
     where p.id = v_plan_recalc and p.organization_id = new.organization_id;
  end if;

  return null;
end $$;

-- ============================================================
-- 7. Jurnalul de opriri urmează editarea intervenției
-- ============================================================
-- Rescris de la forma din 0181. Nou: pe UPDATE, o intervenție fără sesizare
-- care își schimbă oprirea, data, ora sau tipul își mută rândul din jurnal
-- (sau îl creează, ori îl anulează când oprirea devine 0). Oprirea unei
-- sesizări rămâne a sesizării (o deschide și o închide `fault_reports_oprire`).
create or replace function internal.maintenance_interventions_oprire()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inceput timestamptz;
  v_tip     text;
begin
  if tg_op = 'UPDATE' and new.deleted_at is not null and old.deleted_at is null then
    update public.equipment_opriri set deleted_at = now(), updated_at = now()
     where intervention_id = new.id and deleted_at is null;
    return null;
  end if;
  if new.deleted_at is not null or new.fault_report_id is not null then
    return null;
  end if;

  v_inceput := (new.data + coalesce(new.ora_start, time '08:00')) at time zone 'Europe/Bucharest';
  v_tip := case when new.tip = 'corectiva' then 'neplanificata' else 'planificata' end;

  if tg_op = 'INSERT' then
    if coalesce(new.oprire_minute, 0) > 0 then
      insert into public.equipment_opriri (organization_id, equipment_id, inceput, sfarsit, tip, motiv, intervention_id)
      values (new.organization_id, new.equipment_id, v_inceput,
              v_inceput + make_interval(mins => new.oprire_minute),
              v_tip, left(new.descriere, 120), new.id);
    end if;
    return null;
  end if;

  if new.oprire_minute is not distinct from old.oprire_minute
     and new.data is not distinct from old.data
     and new.ora_start is not distinct from old.ora_start
     and new.tip is not distinct from old.tip then
    return null;
  end if;

  if coalesce(new.oprire_minute, 0) > 0 then
    update public.equipment_opriri o
       set inceput = v_inceput,
           sfarsit = v_inceput + make_interval(mins => new.oprire_minute),
           tip = v_tip,
           updated_at = now()
     where o.intervention_id = new.id and o.deleted_at is null;
    if not found then
      insert into public.equipment_opriri (organization_id, equipment_id, inceput, sfarsit, tip, motiv, intervention_id)
      values (new.organization_id, new.equipment_id, v_inceput,
              v_inceput + make_interval(mins => new.oprire_minute),
              v_tip, left(new.descriere, 120), new.id);
    end if;
  else
    update public.equipment_opriri set deleted_at = now(), updated_at = now()
     where intervention_id = new.id and deleted_at is null;
  end if;
  return null;
end;
$$;

-- ============================================================
-- 8. Poarta bucketului: procesul-verbal urcă înaintea intervenției
-- ============================================================
-- Rescrisă de la forma din 0181; ramurile vechi neschimbate. Ramura nouă:
-- `intervention` cu un id care NU există în nicio organizație (verificat cu
-- drepturile proprietarului, deci și în celelalte firme) e o REZERVARE — o
-- intervenție pe cale să fie înregistrată, cu id-ul generat în browser. O poate
-- urca și citi doar cine poate înregistra intervenții în organizația din cale.
-- Un id existent în ALTĂ firmă nu e rezervare: cade pe ramura veche, care cere
-- intervenția în organizația din cale, deci refuză.
create or replace function app.mentenanta_poate_fisier(p_name text, p_actiune text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org  uuid := app.path_org(p_name);
  v_tip  text := app.path_segment(p_name, 2);
  v_id   text := app.path_segment(p_name, 3);
begin
  if v_org is null or v_tip is null or v_id is null or app.path_segment(p_name, 4) is null then
    return false;
  end if;
  if v_tip not in ('fault_report', 'equipment', 'intervention', 'iscir_authorization') then
    return false;
  end if;
  if v_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  if v_tip = 'intervention'
     and not exists (select 1 from public.maintenance_interventions i where i.id = v_id::uuid) then
    return (app.is_platform_admin() or v_org = any ((select app.current_org_ids())::uuid[]))
       and app.feature_on(v_org, 'maintenance')
       and app.ssm_acces(v_org, 'maintenance', 'update', null);
  end if;
  return app.mentenanta_poate_atasament(v_org, v_tip, v_id::uuid, p_actiune);
end;
$$;

-- ============================================================
-- 9. RLS pe liniile de piese
-- ============================================================
alter table public.maintenance_intervention_parts enable row level security;
alter table public.maintenance_intervention_parts force row level security;
revoke all on public.maintenance_intervention_parts from anon;

-- Le vede cine vede intervenția: subinterogarea rulează sub politica
-- intervențiilor, deci executantul și tehnicianul sesizării le văd și ei.
drop policy if exists maintenance_intervention_parts_select on public.maintenance_intervention_parts;
create policy maintenance_intervention_parts_select on public.maintenance_intervention_parts
for select to authenticated
using (
  app.is_platform_admin() or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'maintenance')
    and exists (
      select 1 from public.maintenance_interventions i
       where i.id = maintenance_intervention_parts.intervention_id
         and i.organization_id = maintenance_intervention_parts.organization_id)
  )
);

-- Le scrie cine administrează intervențiile (aceeași poartă ca UPDATE-ul lor).
drop policy if exists maintenance_intervention_parts_insert on public.maintenance_intervention_parts;
create policy maintenance_intervention_parts_insert on public.maintenance_intervention_parts
for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'maintenance')
  and app.ssm_acces(organization_id, 'maintenance', 'update', null)
  and deleted_at is null
  and exists (
    select 1 from public.maintenance_interventions i
     where i.id = maintenance_intervention_parts.intervention_id
       and i.organization_id = maintenance_intervention_parts.organization_id
       and i.deleted_at is null)
);

drop policy if exists maintenance_intervention_parts_update on public.maintenance_intervention_parts;
create policy maintenance_intervention_parts_update on public.maintenance_intervention_parts
for update to authenticated
using (
  app.is_platform_admin() or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'maintenance')
    and app.ssm_acces(organization_id, 'maintenance', 'update', null)
  )
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'maintenance')
  and app.ssm_acces(organization_id, 'maintenance', 'update', null)
);

-- actor, updated_at, audit, granturi
do $$
declare t text;
begin
  foreach t in array array['maintenance_intervention_parts'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_actor', t);
    execute format('create trigger %1$s_actor before insert or update on public.%1$I for each row execute function internal.set_actor()', t);
    execute format('drop trigger if exists %I on public.%I', 'set_updated_at_' || t, t);
    execute format('create trigger %I before update on public.%I for each row execute function app.set_updated_at()', 'set_updated_at_' || t, t);
    perform internal.attach_audit(t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('revoke delete on public.%I from authenticated', t);
  end loop;
end $$;

-- ============================================================
-- 10. Drepturi pe funcții
-- ============================================================
do $$
declare f text;
begin
  foreach f in array array['app.mentenanta_poate_fisier(text,text)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array[
    'internal.aloca_numar_pv_interventie(uuid,integer)',
    'internal.an_pv_interventie(date)',
    'internal.maintenance_interventions_numar()',
    'internal.maintenance_interventions_garda()',
    'internal.maintenance_intervention_parts_garda()',
    'internal.maintenance_intervention_parts_suma()',
    'internal.ssm_intervention_apply()',
    'internal.maintenance_interventions_oprire()']
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- ============================================================
-- 11. Verificarea migrării
-- ============================================================
do $$
declare
  v_lipsa text[] := '{}';
  c text;
begin
  foreach c in array array['numar', 'numar_document_furnizor', 'garantie_lucrare_pana', 'acoperit_de_garantie'] loop
    if not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'maintenance_interventions' and column_name = c) then
      v_lipsa := v_lipsa || ('maintenance_interventions.' || c);
    end if;
  end loop;
  if exists (select 1 from public.maintenance_interventions where numar is null or numar = '') then
    v_lipsa := v_lipsa || 'intervenții fără număr';
  end if;
  if not exists (select 1 from pg_catalog.pg_class cl join pg_catalog.pg_namespace n on n.oid = cl.relnamespace
                  where n.nspname = 'public' and cl.relname = 'maintenance_intervention_parts'
                    and cl.relrowsecurity and cl.relforcerowsecurity) then
    v_lipsa := v_lipsa || 'maintenance_intervention_parts fără RLS forțat';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public'
              and tablename = 'maintenance_intervention_parts' and cmd = 'DELETE') then
    v_lipsa := v_lipsa || 'politică DELETE pe piese';
  end if;
  foreach c in array array['maintenance_interventions_numar', 'maintenance_interventions_garda',
                           'maintenance_interventions_apply', 'maintenance_interventions_oprire'] loop
    if not exists (select 1 from pg_catalog.pg_trigger
                    where tgname = c and tgrelid = 'public.maintenance_interventions'::regclass) then
      v_lipsa := v_lipsa || c;
    end if;
  end loop;
  foreach c in array array['maintenance_intervention_parts_garda', 'maintenance_intervention_parts_suma',
                           'maintenance_intervention_parts_actor', 'set_updated_at_maintenance_intervention_parts'] loop
    if not exists (select 1 from pg_catalog.pg_trigger
                    where tgname = c and tgrelid = 'public.maintenance_intervention_parts'::regclass) then
      v_lipsa := v_lipsa || c;
    end if;
  end loop;
  if not exists (select 1 from pg_catalog.pg_trigger
                  where tgname = 'zz_maintenance_interventions_registru'
                    and tgrelid = 'public.maintenance_interventions'::regclass) then
    v_lipsa := v_lipsa || 'registrul nu mai înregistrează pv_interventie';
  end if;
  if array_length(v_lipsa, 1) > 0 then
    raise exception 'Migrarea 0192 e incompletă: %', array_to_string(v_lipsa, '; ');
  end if;
end $$;

commit;
