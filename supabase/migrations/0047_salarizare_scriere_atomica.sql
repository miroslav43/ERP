-- supabase/migrations/0047_salarizare_scriere_atomica.sql
--
-- Scrierea rezultatelor de salarizare, într-o singură tranzacție.
--
-- DEFECTUL REPARAT: `calculeazaPerioada` scria cu `Promise.all` peste UPDATE-uri
-- individuale, apoi un INSERT separat, apoi încă un UPDATE de stare — fiecare o
-- cerere HTTP proprie, fără nicio tranzacție care să le lege. Pentru 200 de
-- angajați însemna 200+ cereri, iar un eșec la jumătate lăsa perioada cu
-- jumătate din rânduri recalculate și jumătate vechi, fără nimic care să arate
-- unde s-a rupt. Pe un stat de plată, asta e mai rău decât o eroare curată.
--
-- Un apel RPC prin PostgREST rulează într-o SINGURĂ tranzacție: ori se scriu
-- toate rândurile, ori niciunul.
--
-- De ce nu `.upsert()` din client: unicitatea e pe un index PARȚIAL
-- (`payroll_entries_uq ... where deleted_at is null`), iar PostgREST nu emite
-- predicatul în `ON CONFLICT` — cade cu 42P10 (capcana 7). Aici, în SQL,
-- „citește-apoi-scrie" e ieftin și corect.
--
-- SECURITY INVOKER, deliberat: politicile `payroll_entries_insert` și
-- `payroll_entries_update` se aplică apelantului. Un rol fără drept de scriere
-- primește 42501, nu o scriere reușită.
--
-- `organization_id` și `period_id` NU se iau din sarcina utilă, ci se derivă din
-- perioadă. Altfel un apel construit de mână ar putea încerca să strecoare
-- rânduri în altă organizație — RLS l-ar opri, dar e mai bine să nici nu ajungă
-- acolo. La fel, `id`, `created_*`, `updated_*` și `deleted_at` sunt în afara
-- controlului clientului: primele două le pune baza, celelalte triggerele.
--
-- Apelantul trimite rânduri COMPLETE: o recalculare înlocuiește rândul întreg,
-- nu îl peticește. O cheie lipsă din JSON devine NULL, ca la orice
-- `jsonb_populate_record`.

\set ON_ERROR_STOP on

begin;

create or replace function public.payroll_scrie_rezultate(
  p_period_id uuid,
  p_randuri   jsonb
)
returns table (inserate integer, actualizate integer)
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_org         uuid;
  v_inserate    integer := 0;
  v_actualizate integer := 0;
begin
  if jsonb_typeof(p_randuri) is distinct from 'array' then
    raise exception 'Rândurile de salariu trebuie trimise ca listă.' using errcode = 'P0001';
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
$fn$;

comment on function public.payroll_scrie_rezultate(uuid, jsonb) is
  'Scrie rândurile de salariu ale unei perioade într-o singură tranzacție. SECURITY INVOKER: RLS-ul payroll_entries rămâne bariera. organization_id si period_id se derivă din perioadă, nu din sarcina utilă.';

revoke all on function public.payroll_scrie_rezultate(uuid, jsonb) from public, anon;
grant execute on function public.payroll_scrie_rezultate(uuid, jsonb) to authenticated;

commit;
