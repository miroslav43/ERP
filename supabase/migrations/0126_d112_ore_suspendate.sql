-- supabase/migrations/0126_d112_ore_suspendate.sql
-- Câmpul `A_7` din D112 („ore suspendate în lună") încetează să fie zero.
--
-- ┌ Ce lipsea, de fapt ───────────────────────────────────────────────────────
-- │ NU agregarea: `pontaj_agregat_salarizare` numără de la 0064 încoace
-- │ `zile_fara_plata` și o întoarce în tabelul ei de rezultate. Numărul se
-- │ calcula corect și se ARUNCA la ieșirea din RPC — `payroll_entries` n-avea
-- │ unde-l pune, iar ruta de export trimitea constanta 0 pentru fiecare
-- │ asigurat. Migrarea deschide ultima verigă a unui lanț deja construit.
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌ Ce intră în A_7 și ce nu ─────────────────────────────────────────────────
-- │ A_7 numără orele suspendate FĂRĂ acoperire medicală. Intră concediul fără
-- │ plată, creșterea copilului, acomodarea și absențele nemotivate — adică
-- │ exact zilele cu `tip_zi = 'fara_plata'` din pontaj, plus cele cu
-- │ `absenta_nemotivata`. NU intră concediul medical și maternitatea: au
-- │ rubrica lor separată în declarație (`A_6` și secțiunile B), iar numărate
-- │ aici ar fi declarate de două ori.
-- │
-- │ Nu intră nici concediul PATERNAL, deși suspendă contractul și se declară
-- │ în REGES: e plătit de firmă, deci zilele lui sunt ore lucrate din punctul
-- │ de vedere al declarației. Mulțimea „suspendă contractul" și mulțimea
-- │ „A_7" nu coincid — v. antetul lui 0125.
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌ De ce coloana intră și în lista de chei OBLIGATORII ──────────────────────
-- │ `payroll_scrie_rezultate` validează că fiecare rând primit poartă toate
-- │ cheile din `v_chei` și refuză lotul altfel. Adăugarea coloanei acolo face
-- │ ca un apelant care uită s-o trimită să PICE, în loc să scrie tăcut zero —
-- │ adică exact defectul pe care migrarea îl repară, mutat cu un strat mai sus.
-- └───────────────────────────────────────────────────────────────────────────
--
-- Corpul lui `payroll_scrie_rezultate` de mai jos e EXTRAS din bază cu
-- `pg_get_functiondef` și peticit programatic în patru locuri (lista de chei,
-- clauza SET, lista de coloane a INSERT-ului și proiecția lui). Diferența față
-- de original e de exact 4 rânduri adăugate, niciunul modificat.

begin;

-- =====================================================================================
-- 1. Coloana
-- =====================================================================================
-- `numeric(5, 2)` și `default 0`, ca surorile ei din 0026: o perioadă
-- recalculată după migrare primește valoarea reală, una veche rămâne pe zero —
-- ceea ce e adevărat, fiindcă pentru ea numărul chiar nu s-a măsurat niciodată.

alter table public.payroll_entries
  add column if not exists zile_fara_plata numeric(5, 2) not null default 0;

comment on column public.payroll_entries.zile_fara_plata is
  'Zile de suspendare fără acoperire medicală (concediu fără plată, creștere '
  'copil, acomodare), din `pontaj_agregat_salarizare`. Împreună cu '
  '`zile_absenta_nemotivata` formează câmpul A_7 al D112. NU include medicalul '
  'și maternitatea, care au rubrică proprie în declarație.';

-- =====================================================================================
-- 2. Scrierea atomică duce coloana până în rând
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
    'spor_sarbatoare'
  ];
begin
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

-- Granturile se rescriu, ca migrarea să fie corectă și pe o bază unde `create
-- or replace` ar fi creat funcția de la zero.
revoke all on function public.payroll_scrie_rezultate(uuid, jsonb) from public, anon;
grant execute on function public.payroll_scrie_rezultate(uuid, jsonb) to authenticated;

-- =====================================================================================
-- 3. Note de proiectare
-- =====================================================================================
--
-- (A) DE CE NU SE RECALCULEAZĂ PERIOADELE VECHI
--     Un UPDATE care ar umple retroactiv coloana din pontaj ar schimba cifre
--     dintr-o perioadă deja APROBATĂ sau ÎNCHISĂ, adică dintr-un stat de plată
--     semnat. Perioadele vechi rămân pe zero și se declară cum s-au declarat;
--     cine vrea numărul real recalculează perioada explicit, din ecran.
--
-- (B) A_7 SE DECLARĂ ÎN ORE, DAR SE STOCHEAZĂ ÎN ZILE
--     Zilele de suspendare au `ore_lucrate = 0` prin definiție — nu există ore
--     măsurate din care să se adune ceva. Conversia în ore se face la export,
--     înmulțind cu norma zilnică a contractului, exact ca la A_4. Stocarea în
--     zile păstrează coloana comparabilă cu surorile ei și nu îngheață norma
--     în momentul calculului.

commit;
