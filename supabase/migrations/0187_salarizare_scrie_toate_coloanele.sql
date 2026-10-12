-- supabase/migrations/0187_salarizare_scrie_toate_coloanele.sql
--
-- `payroll_scrie_rezultate` SCRIE TOT CE CALCULEAZĂ MOTORUL.
--
-- ── DEFECTUL ────────────────────────────────────────────────────────────────
-- 0054, 0055, 0057 și 0060 au adăugat pe `payroll_entries` treisprezece
-- coloane, iar `calculeazaPerioada` le trimite pe toate. Funcția de scriere —
-- redefinită în 0126 și 0146 din corpul EXTRAS din bază — a rămas cu lista din
-- 0052: `jsonb_populate_record` le citea, dar nici UPDATE-ul, nici INSERT-ul nu
-- le foloseau. Fără nicio eroare:
--   · `rest_de_plata` rămânea 0 pe orice rând nou, iar fișierul bancar
--     (`bancar/route.ts:122`) și fluturașul PDF folosesc exact acest câmp;
--   · `baza_cas`/`baza_cass` = 0 pe toate cele 16 rânduri din producție
--     (verificat prin MCP pe 8 oct 2026);
--   · indemnizațiile CO/CM, diurna și avantajele în natură intrau în brut, dar
--     coloanele lor din stat rămâneau 0.
-- Rândurile existente (firma demo, iul.–aug. 2026) au `rest_de_plata` corect
-- doar datorită backfill-ului din 0055, aplicat după calculul lor.
--
-- ── CE FACE ─────────────────────────────────────────────────────────────────
-- Cele 13 chei devin OBLIGATORII în `v_chei` (aceeași regulă ca la 0126: o
-- recalculare înlocuiește rândul întreg) și sunt scrise de ambele ramuri.
-- Corpul e cel din 0146, neschimbat în rest — inclusiv steagul local
-- `app.payroll_scrie` citit de `internal.payroll_entries_doar_prin_motor`.
--
-- Poarta care ține TS și SQL lipite: `src/app/(app)/salarizare/actions-calcul.test.ts`
-- („contractul cu `payroll_scrie_rezultate`”) compară cheile trimise de acțiune
-- cu lista, UPDATE-ul și INSERT-ul ultimei migrări care redefinește funcția.

begin;

-- =====================================================================================
-- 1. Funcția de scriere, cu toate coloanele
-- =====================================================================================
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
    'spor_sarbatoare',
    'baza_cas',
    'baza_cass',
    'indemnizatie_co',
    'indemnizatie_cm_angajator',
    'indemnizatie_cm_fnuass',
    'zile_cm_angajator',
    'zile_cm_fnuass',
    'baza_zilnica_cm',
    'ore_supl_compensate',
    'avantaje_natura',
    'diurna_neimpozabila',
    'diurna_impozabila',
    'rest_de_plata'
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
           spor_sarbatoare = i.spor_sarbatoare,
           baza_cas = i.baza_cas,
           baza_cass = i.baza_cass,
           indemnizatie_co = i.indemnizatie_co,
           indemnizatie_cm_angajator = i.indemnizatie_cm_angajator,
           indemnizatie_cm_fnuass = i.indemnizatie_cm_fnuass,
           zile_cm_angajator = i.zile_cm_angajator,
           zile_cm_fnuass = i.zile_cm_fnuass,
           baza_zilnica_cm = i.baza_zilnica_cm,
           ore_supl_compensate = i.ore_supl_compensate,
           avantaje_natura = i.avantaje_natura,
           diurna_neimpozabila = i.diurna_neimpozabila,
           diurna_impozabila = i.diurna_impozabila,
           rest_de_plata = i.rest_de_plata
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
        spor_sarbatoare,
        baza_cas,
        baza_cass,
        indemnizatie_co,
        indemnizatie_cm_angajator,
        indemnizatie_cm_fnuass,
        zile_cm_angajator,
        zile_cm_fnuass,
        baza_zilnica_cm,
        ore_supl_compensate,
        avantaje_natura,
        diurna_neimpozabila,
        diurna_impozabila,
        rest_de_plata
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
        i.spor_sarbatoare,
        i.baza_cas,
        i.baza_cass,
        i.indemnizatie_co,
        i.indemnizatie_cm_angajator,
        i.indemnizatie_cm_fnuass,
        i.zile_cm_angajator,
        i.zile_cm_fnuass,
        i.baza_zilnica_cm,
        i.ore_supl_compensate,
        i.avantaje_natura,
        i.diurna_neimpozabila,
        i.diurna_impozabila,
        i.rest_de_plata
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

-- Granturile se rescriu, ca migrarea să fie corectă și pe o bază unde `create
-- or replace` ar fi creat funcția de la zero.
revoke all on function public.payroll_scrie_rezultate(uuid, jsonb) from public, anon;
grant execute on function public.payroll_scrie_rezultate(uuid, jsonb) to authenticated;

commit;
