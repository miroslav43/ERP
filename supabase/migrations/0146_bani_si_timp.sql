-- supabase/migrations/0146_bani_si_timp.sql
--
-- CIFRELE CARE AJUNG ÎN SALARIU NU SE MAI SCRIU DIN CLIENT.
--
-- ── DE UNDE VINE MIGRAREA ───────────────────────────────────────────────────
-- Lotul 3 din auditul „atinge frontendul baza direct?"
-- (`docs/audit-frontend-baza-2026-09-21.md`). Loturile 1 și 2 au închis ieșirile
-- dintre firme și marginea dinspre lumea din afară. Aici sunt cifrele: orele și
-- banii, adică singurele rânduri din produs pe care cineva ar avea un motiv REAL
-- să le fabrice.
--
-- Toate patru au aceeași formă: regula trăiește în Server Action, baza acceptă
-- orice. Cu jetonul din propriul browser, un PATCH pe `/rest/v1/...` le ocolea
-- pe toate.
--
-- ── (F05) SUMELE DE SALARIU ────────────────────────────────────────────────
-- `payroll_entries_update` cere `payroll:update = all` și nimic altceva — nicio
-- restricție pe coloane. Cine are cheia (hr, org_admin) își putea pune singur
-- `net_de_plata = 99999` după calcul, apoi aproba perioada; cifra intra în
-- fluturaș, în stat, în D112 și în ordinul bancar. Probat pe banc: UPDATE direct
-- = 1 rând, singura barieră fiind CHECK-ul care cere valori ≥ 0.
--
-- Motorul de calcul e în TypeScript (`src/domain/payroll`), iar singurul lui
-- port de scriere e `payroll_scrie_rezultate` — verificat în catalog: nicio altă
-- funcție nu atinge tabela. Deci tabela primește o poartă: scrierile trec doar
-- prin motor, marcat cu un steag local de tranzacție. Tiparul e cel din
-- `app.invitation_accept` și `app.inregistrare_publica`.
--
-- ── (F06) ORELE DE PONTAJ ──────────────────────────────────────────────────
-- Un angajat își putea scrie 16 ore lucrate, 8 suplimentare și 8 de noapte pe o
-- zi cu interval 09:00-10:00. `pontaj_agregat_salarizare` nu se uită la
-- `approved_at`, deci orele fabricate ajungeau în stat de plată, cu spor.
-- Serverul rederivă orele pentru oricine n-are scope `all`; baza nu cerea nimic.
--
-- Migrarea NU duplică derivarea (pauze, praguri de noapte, setările lunii) în
-- SQL: ar diverge tăcut de `src/domain/attendance`. Impune doar plafoanele pe
-- care orice derivare corectă le respectă oricum:
--   * cu interval — orele lucrate nu-l pot depăși;
--   * fără interval (ziua declarată: telemuncă, homeoffice) — orele nu pot trece
--     de norma zilnică din contract, iar sporurile (suplimentare, noapte) cer
--     ceasul. Prima formă a gărzii interzicea orice oră fără interval și a fost
--     prinsă de verificarea (l) din `tests/rls/izolare.sql` — singura poartă
--     POZITIVĂ a proiectului — care numără ziua de homeoffice cu normă întreagă
--     printre scrierile legitime ale unui `employee`.
--
-- ── (F07, F47) COMPENSĂRILE DE ORE ─────────────────────────────────────────
-- `overtime_compensation` și `holiday_compensation` sunt tratate de tot produsul
-- drept tabele „doar trigger" — `src/domain/attendance/limite-legale.ts` o scrie
-- negru pe alb: „n-are niciun scriitor în tot produsul, nici trigger, nici cod".
-- RLS le lăsa însă scriibile de orice angajat pe propria fișă, iar motorul de
-- salarizare citește din ele orele suplimentare DE PLATĂ. Adică fix invers.
-- Politicile de scriere dispar; singurul scriitor rămâne triggerul
-- `internal.pontaj_genereaza_compensare_sarbatoare` (SECURITY DEFINER, deci
-- neatins de revocare).
--
-- ── (F08) DIURNA ───────────────────────────────────────────────────────────
-- `business_trips_update` verifica statusul de PLECARE, nu pe cel de SOSIRE:
-- deținătorul unei deplasări (orice angajat are `per_diem:update = own`) își
-- putea trece singur deplasarea până la „decontată", ocolind aprobatorul.
--
-- ── (F28) CE NU FACE MIGRAREA, DELIBERAT ───────────────────────────────────
-- Nu interzice aprobarea propriei zile de pontaj. `app.is_manager_of` include
-- propria fișă, iar `app.aproba_pontaj_bloc` conține linia
-- `or e.employee_id = app.current_employee_id(...)` — auto-aprobarea la pontaj e
-- o DECIZIE scrisă, nu un accident, și are un motiv: managerul care pontează
-- cot la cot cu echipa. Precedentul contrar există (`foi_parcurs_fara_autoaprobare`),
-- dar acolo foaia de parcurs e document justificativ pentru combustibil, aici e
-- munca proprie a unui om care oricum își scrie orele. Ce se închide e doar
-- falsificarea ACTORULUI: cine aprobă e `auth.uid()`, nu cine scrie cererea.

begin;

-- ── 1. F05: sumele de salariu trec doar prin motor ────────────────────────
CREATE OR REPLACE FUNCTION public.payroll_scrie_rezultate(p_period_id uuid, p_randuri jsonb)
 RETURNS TABLE(inserate integer, actualizate integer)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_org         uuid;
  v_inserate    integer := 0;
  v_actualizate integer := 0;
  v_lipsa       text;
  v_chei        text[] := array[
    'employee_id',
    'contract_id',
    'status',
    'zile_lucratoare_luna',
    'zile_lucrate',
    'zile_concediu_odihna',
    'zile_concediu_medical',
    'zile_absenta_nemotivata',
    'zile_fara_plata',
    'ore_lucrate',
    'ore_suplimentare',
    'ore_noapte',
    'baza_salariu',
    'suma_ore_suplimentare',
    'spor_noapte',
    'prime_total',
    'brut',
    'nr_tichete',
    'valoare_tichete',
    'baza_cas_cass',
    'cas',
    'cass',
    'deducere_personala',
    'baza_impozit',
    'impozit',
    'cam_angajator',
    'net',
    'retineri_total',
    'net_de_plata',
    'cost_total_angajator',
    'settings_snapshot',
    'calc_breakdown',
    'calc_warnings',
    'calculat_la',
    'scutire_fiscala',
    'zile_repaus_lucrate',
    'zile_sarbatoare_lucrate',
    'ore_repaus',
    'ore_sarbatoare',
    'spor_repaus',
    'spor_sarbatoare'
  ];
begin
  -- Steagul pe care îl citește `internal.payroll_entries_doar_prin_motor`.
  -- LOCAL, deci moare cu tranzacția; PostgREST dă fiecărei cereri tranzacția ei,
  -- așa că nimeni nu-l poate aprinde într-o cerere și folosi în alta.
  perform set_config('app.payroll_scrie', 'on', true);
  if jsonb_typeof(p_randuri) is distinct from 'array' then
    raise exception 'Rândurile de salariu trebuie trimise ca listă.' using errcode = 'P0001';
  end if;

  select k into v_lipsa
    from jsonb_array_elements(p_randuri) e
    cross join lateral unnest(v_chei) k
   where not (e ? k)
   limit 1;

  if v_lipsa is not null then
    raise exception
      'Rândul de salariu este incomplet: lipsește câmpul „%". Recalcularea înlocuiește rândul întreg, deci toate câmpurile sunt obligatorii.',
      v_lipsa using errcode = 'P0001';
  end if;

  select pp.organization_id into v_org
    from public.payroll_periods pp
   where pp.id = p_period_id
     and pp.deleted_at is null;

  if v_org is null then
    raise exception 'Perioada de salarizare nu a fost găsită.' using errcode = 'P0001';
  end if;

  with intrari as (
    select (jsonb_populate_record(null::public.payroll_entries, e)).*
      from jsonb_array_elements(p_randuri) e
  ),
  modificate as (
    update public.payroll_entries t
       set
           contract_id = i.contract_id,
           status = i.status,
           zile_lucratoare_luna = i.zile_lucratoare_luna,
           zile_lucrate = i.zile_lucrate,
           zile_concediu_odihna = i.zile_concediu_odihna,
           zile_concediu_medical = i.zile_concediu_medical,
           zile_absenta_nemotivata = i.zile_absenta_nemotivata,
           zile_fara_plata = i.zile_fara_plata,
           ore_lucrate = i.ore_lucrate,
           ore_suplimentare = i.ore_suplimentare,
           ore_noapte = i.ore_noapte,
           baza_salariu = i.baza_salariu,
           suma_ore_suplimentare = i.suma_ore_suplimentare,
           spor_noapte = i.spor_noapte,
           prime_total = i.prime_total,
           brut = i.brut,
           nr_tichete = i.nr_tichete,
           valoare_tichete = i.valoare_tichete,
           baza_cas_cass = i.baza_cas_cass,
           cas = i.cas,
           cass = i.cass,
           deducere_personala = i.deducere_personala,
           baza_impozit = i.baza_impozit,
           impozit = i.impozit,
           cam_angajator = i.cam_angajator,
           net = i.net,
           retineri_total = i.retineri_total,
           net_de_plata = i.net_de_plata,
           cost_total_angajator = i.cost_total_angajator,
           settings_snapshot = i.settings_snapshot,
           calc_breakdown = i.calc_breakdown,
           calc_warnings = i.calc_warnings,
           calculat_la = i.calculat_la,
           scutire_fiscala = i.scutire_fiscala,
           zile_repaus_lucrate = i.zile_repaus_lucrate,
           zile_sarbatoare_lucrate = i.zile_sarbatoare_lucrate,
           ore_repaus = i.ore_repaus,
           ore_sarbatoare = i.ore_sarbatoare,
           spor_repaus = i.spor_repaus,
           spor_sarbatoare = i.spor_sarbatoare
      from intrari i
     where t.organization_id = v_org
       and t.period_id = p_period_id
       and t.employee_id = i.employee_id
       and t.deleted_at is null
    returning 1
  )
  select count(*) into v_actualizate from modificate;

  with intrari as (
    select (jsonb_populate_record(null::public.payroll_entries, e)).*
      from jsonb_array_elements(p_randuri) e
  ),
  adaugate as (
    insert into public.payroll_entries (
        organization_id,
        period_id,
        employee_id,
        contract_id,
        status,
        zile_lucratoare_luna,
        zile_lucrate,
        zile_concediu_odihna,
        zile_concediu_medical,
        zile_absenta_nemotivata,
        zile_fara_plata,
        ore_lucrate,
        ore_suplimentare,
        ore_noapte,
        baza_salariu,
        suma_ore_suplimentare,
        spor_noapte,
        prime_total,
        brut,
        nr_tichete,
        valoare_tichete,
        baza_cas_cass,
        cas,
        cass,
        deducere_personala,
        baza_impozit,
        impozit,
        cam_angajator,
        net,
        retineri_total,
        net_de_plata,
        cost_total_angajator,
        settings_snapshot,
        calc_breakdown,
        calc_warnings,
        calculat_la,
        scutire_fiscala,
        zile_repaus_lucrate,
        zile_sarbatoare_lucrate,
        ore_repaus,
        ore_sarbatoare,
        spor_repaus,
        spor_sarbatoare
      )
      select
        v_org,
        p_period_id,
        i.employee_id,
        i.contract_id,
        i.status,
        i.zile_lucratoare_luna,
        i.zile_lucrate,
        i.zile_concediu_odihna,
        i.zile_concediu_medical,
        i.zile_absenta_nemotivata,
        i.zile_fara_plata,
        i.ore_lucrate,
        i.ore_suplimentare,
        i.ore_noapte,
        i.baza_salariu,
        i.suma_ore_suplimentare,
        i.spor_noapte,
        i.prime_total,
        i.brut,
        i.nr_tichete,
        i.valoare_tichete,
        i.baza_cas_cass,
        i.cas,
        i.cass,
        i.deducere_personala,
        i.baza_impozit,
        i.impozit,
        i.cam_angajator,
        i.net,
        i.retineri_total,
        i.net_de_plata,
        i.cost_total_angajator,
        i.settings_snapshot,
        i.calc_breakdown,
        i.calc_warnings,
        i.calculat_la,
        i.scutire_fiscala,
        i.zile_repaus_lucrate,
        i.zile_sarbatoare_lucrate,
        i.ore_repaus,
        i.ore_sarbatoare,
        i.spor_repaus,
        i.spor_sarbatoare
        from intrari i
       where not exists (
         select 1 from public.payroll_entries t
          where t.organization_id = v_org
            and t.period_id = p_period_id
            and t.employee_id = i.employee_id
            and t.deleted_at is null
       )
    returning 1
  )
  select count(*) into v_inserate from adaugate;

  return query select v_inserate, v_actualizate;
end;
$function$;

create or replace function internal.payroll_entries_doar_prin_motor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if app.is_service_context() then
    return new;
  end if;
  if coalesce(current_setting('app.payroll_scrie', true), 'off') <> 'on' then
    raise exception 'Rândurile de salariu se scriu doar prin recalcularea perioadei, nu direct. Folosește „Recalculează" din ecranul de salarizare.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function internal.payroll_entries_doar_prin_motor() from public, anon;

drop trigger if exists trg_payroll_entries_doar_prin_motor on public.payroll_entries;
create trigger trg_payroll_entries_doar_prin_motor
  before insert or update on public.payroll_entries
  for each row execute function internal.payroll_entries_doar_prin_motor();

-- ── 2. F07 + F47: compensările de ore nu se mai scriu din client ──────────
-- Singurul scriitor legitim (`internal.pontaj_genereaza_compensare_sarbatoare`)
-- e SECURITY DEFINER, deci rulează cu drepturile proprietarului și nu e atins
-- nici de revocarea de granturi, nici de dispariția politicilor.
drop policy if exists overtime_compensation_insert on public.overtime_compensation;
drop policy if exists overtime_compensation_update on public.overtime_compensation;
drop policy if exists holiday_compensation_insert on public.holiday_compensation;
drop policy if exists holiday_compensation_update on public.holiday_compensation;

revoke insert, update on public.overtime_compensation from authenticated;
revoke insert, update on public.holiday_compensation from authenticated;

-- ── 3. F06 + F46: orele și luna sursă ─────────────────────────────────────
CREATE OR REPLACE FUNCTION internal.pontaj_intrare_pregateste()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_perioada public.attendance_periods%rowtype;
  v_sursa    public.attendance_periods%rowtype;
  v_maxim    double precision;
  v_eticheta text := to_char(new.data, 'MM.YYYY');
begin
  v_perioada := internal.pontaj_perioada_lunii(
    new.organization_id,
    extract(year from new.data)::smallint,
    extract(month from new.data)::smallint
  );

  if v_perioada.id is null then
    raise exception 'Luna de pontaj % nu a putut fi deschisă. Încearcă din nou.',
      v_eticheta using errcode = 'P0001';
  end if;

  if v_perioada.status = 'blocata' and not app.is_service_context() then
    raise exception 'Perioada de pontaj % este blocată și nu mai poate fi modificată. Deblocheaz-o dacă ai nevoie de corecții.',
      v_eticheta using errcode = 'P0001';
  end if;

  -- ── Luna SURSĂ, la mutarea unei zile (F46) ────────────────────────────────
  -- Garda de mai sus se uită doar la luna în care ATERIZEAZĂ ziua. O zi
  -- neaprobată dintr-o lună blocată putea fi deci scoasă din ea, schimbându-i
  -- `data`: luna închisă rămânea închisă, dar își pierdea o zi.
  if tg_op = 'UPDATE'
     and not app.is_service_context()
     and date_trunc('month', old.data) <> date_trunc('month', new.data) then
    v_sursa := internal.pontaj_perioada_lunii(
      old.organization_id,
      extract(year from old.data)::smallint,
      extract(month from old.data)::smallint
    );
    if v_sursa.status = 'blocata' then
      raise exception 'Ziua face parte din perioada %, care este blocată. Deblocheaz-o înainte s-o muți în altă lună.',
        to_char(old.data, 'MM.YYYY') using errcode = 'P0001';
    end if;
  end if;

  -- ── Orele nu pot depăși intervalul declarat (F06) ─────────────────────────
  -- Serverul rederivă orele din interval pentru oricine NU are scope `all`
  -- (`salveazaZiPontaj`, „GAURA DE ÎNCREDERE, închisă"). Baza nu cerea nimic:
  -- un `POST /rest/v1/attendance_entries` cu interval 09:00-10:00 și 16 ore
  -- lucrate din care 8 suplimentare și 8 de noapte trecea, iar
  -- `pontaj_agregat_salarizare` le plătea — funcția nu se uită la `approved_at`.
  --
  -- Aici NU se rederivă nimic: calculul real (pauze, praguri de noapte, setările
  -- lunii) trăiește în `src/domain/attendance` și n-are ce căuta duplicat în SQL,
  -- unde ar diverge tăcut. Se impune doar plafonul pe care orice derivare corectă
  -- îl respectă oricum: nu poți lucra mai multe ore decât ține intervalul.
  if not app.is_service_context()
     and app.has_permission(new.organization_id, 'attendance', 'create') <> 'all' then
    if new.ora_inceput is null or new.ora_sfarsit is null then
      -- Ziua DECLARATĂ, fără ceas: telemunca, ziua de homeoffice trecută cu
      -- norma întreagă. `tests/rls/izolare.sql` o numără explicit printre
      -- scrierile legitime ale unui `employee`, deci nu se interzice — se
      -- plafonează la norma zilnică din contract (sau, în lipsa lui, din
      -- setările de pontaj ale firmei). Peste normă ÎNSEAMNĂ ore suplimentare,
      -- iar alea cer un interval: fără ceas nu există spor.
      select coalesce(
               (select c.norma_ore_zi from public.employment_contracts c
                 where c.employee_id = new.employee_id
                   and c.organization_id = new.organization_id
                   and c.deleted_at is null
                   and c.valabil_de_la <= new.data
                 order by c.valabil_de_la desc limit 1),
               (select s.ore_pe_zi from public.attendance_settings s
                 where s.organization_id = new.organization_id
                   and s.deleted_at is null
                   and s.valabil_de_la <= new.data
                 order by s.valabil_de_la desc limit 1),
               8
             ) into v_maxim;
      if coalesce(new.ore_lucrate, 0) > v_maxim + 0.01 then
        raise exception 'Fără oră de intrare și de ieșire, ziua nu poate trece de norma zilnică (% ore). Completează intervalul dacă ai lucrat mai mult.',
          round(v_maxim::numeric, 2) using errcode = 'P0001';
      end if;
      if coalesce(new.ore_suplimentare, 0) > 0 or coalesce(new.ore_noapte, 0) > 0 then
        raise exception 'Orele suplimentare și cele de noapte cer intervalul lucrat. Completează ora de intrare și de ieșire.'
          using errcode = 'P0001';
      end if;
    elsif new.ora_sfarsit > new.ora_inceput then
      v_maxim := extract(epoch from (new.ora_sfarsit - new.ora_inceput)) / 3600.0;
      if coalesce(new.ore_lucrate, 0) > v_maxim + 0.01 then
        raise exception 'Orele lucrate (%) depășesc intervalul declarat (% ore). Corectează intervalul sau orele.',
          new.ore_lucrate, round(v_maxim::numeric, 2) using errcode = 'P0001';
      end if;
    end if;
  end if;

  new.period_id := v_perioada.id;

  if new.tip_zi is null then
    new.tip_zi := case
      when app.este_zi_lucratoare(new.organization_id, new.data) then 'lucratoare'::public.attendance_day_type
      when extract(isodow from new.data) >= 6 then 'weekend'::public.attendance_day_type
      else 'sarbatoare'::public.attendance_day_type
    end;
  end if;

  return new;
end;
$function$;

-- ── 4. F28 (parțial): cine aprobă e cine e logat, nu cine scrie cererea ───
-- Auto-aprobarea rămâne (vezi antetul). Ce dispare e falsificarea actorului:
-- `approved_by` / `decis_de` veneau de la client într-un PATCH direct, deci
-- ziua putea apărea aprobată de altcineva decât cel care a apăsat.
create or replace function internal.pontaj_actorul_deciziei()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if app.is_service_context() then
    return new;
  end if;

  if tg_table_name = 'attendance_entries' then
    if new.approved_at is not null
       and (tg_op = 'INSERT' or old.approved_at is null or new.approved_by is distinct from old.approved_by) then
      new.approved_by := (select auth.uid());
    end if;
    if new.respins_la is not null
       and (tg_op = 'INSERT' or old.respins_la is null or new.respins_de is distinct from old.respins_de) then
      new.respins_de := (select auth.uid());
    end if;
  elsif tg_table_name = 'attendance_week_submissions' then
    if new.status in ('aprobata', 'respinsa')
       and (tg_op = 'INSERT' or old.status is distinct from new.status) then
      new.decis_de := (select auth.uid());
      new.decis_la := now();
    end if;
  end if;

  return new;
end;
$$;

revoke all on function internal.pontaj_actorul_deciziei() from public, anon;

drop trigger if exists trg_attendance_entries_actor_decizie on public.attendance_entries;
create trigger trg_attendance_entries_actor_decizie
  before insert or update on public.attendance_entries
  for each row execute function internal.pontaj_actorul_deciziei();

drop trigger if exists trg_attendance_week_actor_decizie on public.attendance_week_submissions;
create trigger trg_attendance_week_actor_decizie
  before insert or update on public.attendance_week_submissions
  for each row execute function internal.pontaj_actorul_deciziei();

-- ── 5. F08: tranzițiile de diurnă cer aprobator ───────────────────────────
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
    if new.status is distinct from old.status
       and new.status in ('in_aprobare', 'aprobata', 'respinsa', 'decontata')
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
