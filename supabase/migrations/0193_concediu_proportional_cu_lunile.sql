-- supabase/migrations/0193_concediu_proportional_cu_lunile.sql
-- Dreptul de concediu: baza din contract, proporțional cu lunile lucrate în an.
--
-- ┌ CE REPARĂ (QA 8 oct 2026: HR-007, HR-031, HR-023) ──────────────────────────
-- │ Un angajat intrat pe 08.10.2026 primea 20 de zile întregi pe 2026 (HR-007):
-- │ `app.drept_concediu` aduna baza tipului cu grilele și se oprea acolo, iar
-- │ setarea „Rotunjirea acumulării proporționale" din /concedii/setari nu era
-- │ citită de nimeni. Zilele scrise pe contract (HR-031) erau doar un override
-- │ la însămânțare (`seed_leave_balances`), pe care „Aplică drepturile" îl
-- │ rescria din `zile_implicite` și pe care portalul nu-l vedea niciodată.
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌ DECIZIILE (orchestratorul valului 2, 12 oct 2026) ─────────────────────────
-- │ • zilele din contractul de bază sunt BAZA per angajat; grilele se adună peste;
-- │ • ancora perioadei e `employment_contracts.valabil_de_la` al contractului de
-- │   bază curent (la reangajare: contractul NOU), cu `employees.hired_on` ca
-- │   rezervă; sfârșitul e `employees.terminated_on` — ignorat când e anterior
-- │   ancorei (rămas de la contractul vechi) —, cu `incetat_la` ca rezervă;
-- │ • luna de intrare și luna de ieșire se numără ÎNTREGI (ca în calculatorul
-- │   public): 08.10 → 3 luni → 20 × 3/12 = 5;
-- │ • proporția se aplică la TOATE tipurile cu `scade_din_sold = true`; cele cu
-- │   durată fixă (medical 183, maternitate 126…) au `scade_din_sold = false` și
-- │   rămân neatinse;
-- │ • rotunjirea după `leave_types.mod_rotunjire_acumulare` DOAR la an parțial —
-- │   o bază fracționară configurată deliberat nu se schimbă de la sine;
-- │ • soldurile deja scrise NU se rescriu aici: HR le recalculează cu
-- │   previzualizare din „Aplică drepturile" (`public.aplica_drepturi_concediu`,
-- │   neatinsă — trece prin funcția de mai jos, deci devine proporțională singură,
-- │   la fel ca `public.drepturile_mele_concediu` și `internal.recalc_sold`);
-- │ • suspendările de contract rămân în afara scopului.
-- └───────────────────────────────────────────────────────────────────────────
--
-- Corpul lui `app.drept_concediu` pornește din 0111 (criteriul „funcție" pe
-- `cod_cor`), NU din 0035 (`job_position_id`): 0110/0111 au mutat criteriul.
-- Semnăturile rămân neschimbate — niciun apelant și nicio regenerare de tipuri.
-- Oglinda TypeScript: `src/domain/leave/drepturi.ts` (`luniLucrateInAn`,
-- `calculeazaDreptProportional`); proba: `tests/rls/proba-concediu-proportional.sql`.

begin;

-- =====================================================================================
-- 1. app.drept_concediu — bază din contract + grile, × luni lucrate / 12
-- =====================================================================================

create or replace function app.drept_concediu(
  p_org uuid, p_employee uuid, p_type uuid, p_an integer
) returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_key            text;
  v_zile_implicite numeric(6,2);
  v_scade          boolean;
  v_rotunjire      text;
  v_baza           numeric(6,2);
  v_suplimentar    numeric(6,2);
  v_referinta      date;
  v_hired_on       date;
  v_terminated_on  date;
  v_data_nasterii  date;
  v_conditii       text;
  v_handicap       text;
  v_department     uuid;
  v_cod_cor        text;
  v_vechime_luni   integer;
  v_zile_contract  smallint;
  v_contract_de_la date;
  v_contract_pana  date;
  v_ancora         date;
  v_inceput        date;
  v_sfarsit        date;
  v_luni           integer;
  v_brut           numeric(8,2);
begin
  select lt.key, lt.zile_implicite, lt.scade_din_sold, lt.mod_rotunjire_acumulare::text
    into v_key, v_zile_implicite, v_scade, v_rotunjire
  from public.leave_types lt
  where lt.id = p_type and lt.organization_id = p_org and lt.deleted_at is null;

  if v_zile_implicite is null then
    return 0;
  end if;

  v_referinta := make_date(p_an, 12, 31);

  select e.hired_on, e.terminated_on, e.data_nasterii, e.conditii_munca::text, e.grad_handicap,
         e.department_id, e.cod_cor
    into v_hired_on, v_terminated_on, v_data_nasterii, v_conditii, v_handicap,
         v_department, v_cod_cor
  from public.employees e
  where e.id = p_employee and e.organization_id = p_org and e.deleted_at is null;

  -- Contractul de BAZĂ (nu un act adițional) care a început până la 31 decembrie
  -- din anul dat: cel activ are întâietate (`contracts_employee_activ_uniq`
  -- garantează cel mult unul), altfel cel mai recent — un angajat încetat are
  -- încă un sold de explicat.
  select c.zile_concediu_anual, c.valabil_de_la, c.incetat_la
    into v_zile_contract, v_contract_de_la, v_contract_pana
  from public.employment_contracts c
  where c.employee_id = p_employee
    and c.organization_id = p_org
    and c.este_act_aditional = false
    and c.deleted_at is null
    and c.valabil_de_la <= v_referinta
  order by (c.status = 'activ') desc, c.valabil_de_la desc
  limit 1;

  -- Baza: zilele de pe contract pentru odihnă, altfel implicitul tipului.
  v_baza := case
    when v_key = 'odihna' and v_zile_contract is not null then v_zile_contract
    else v_zile_implicite
  end;

  v_vechime_luni := case
    when v_hired_on is null or v_hired_on > v_referinta then 0
    else (
      extract(year from age(v_referinta, v_hired_on)) * 12
      + extract(month from age(v_referinta, v_hired_on))
    )::integer
  end;

  select coalesce(sum(r.zile_suplimentare), 0) into v_suplimentar
  from public.leave_entitlement_rules r
  where r.organization_id = p_org
    and r.leave_type_id = p_type
    and r.activ
    and r.deleted_at is null
    and r.valabil_de_la <= v_referinta
    and (r.valabil_pana_la is null or r.valabil_pana_la >= v_referinta)
    and (
      (r.tip_criteriu = 'vechime' and v_vechime_luni >= r.vechime_ani_min * 12)
      or (r.tip_criteriu = 'conditii_munca' and v_conditii = r.valoare_text)
      or (r.tip_criteriu = 'grad_handicap' and v_handicap = r.valoare_text)
      or (
        r.tip_criteriu = 'varsta_sub_18'
        and v_data_nasterii is not null
        and age(v_referinta, v_data_nasterii) < interval '18 years'
      )
      or (r.tip_criteriu = 'departament' and v_department = r.department_id)
      or (r.tip_criteriu = 'functie' and v_cod_cor is not null and v_cod_cor = r.cod_cor)
    );

  -- Tipurile cu durată fixă nu se proporționalizează.
  if not v_scade then
    return v_baza + v_suplimentar;
  end if;

  -- Lunile lucrate în an: luna de intrare și cea de ieșire, întregi.
  v_ancora := coalesce(v_contract_de_la, v_hired_on);
  v_inceput := greatest(coalesce(v_ancora, make_date(p_an, 1, 1)), make_date(p_an, 1, 1));
  -- `terminated_on` contează doar dacă nu e anterior ancorei: la reangajare pe
  -- aceeași fișă, `creeazaContract` reactivează fișa fără să-l golească, iar
  -- încetarea contractului VECHI ar tăia contractul nou la 0 luni, în anul
  -- reangajării și în toți anii următori. Rezerva e `incetat_la` al
  -- contractului ales. Oglinda: `sfarsitPerioadaLucrata` din drepturi.ts.
  v_sfarsit := least(
    coalesce(
      case when v_ancora is null or v_terminated_on >= v_ancora then v_terminated_on end,
      v_contract_pana,
      v_referinta
    ),
    v_referinta
  );
  v_luni := case
    when v_inceput > v_sfarsit then 0
    else (extract(month from v_sfarsit) - extract(month from v_inceput) + 1)::integer
  end;

  if v_luni >= 12 then
    return v_baza + v_suplimentar;
  end if;

  -- `12.0`, nu `12`: împărțirea întreagă ar trunchia la 0 pentru orice lună.
  v_brut := round((v_baza + v_suplimentar) * v_luni / 12.0, 2);

  -- Enum-ul mai conține `jumatate_in_sus`/`jumatate_in_jos`, dar constrângerea
  -- `leave_types_rotunjire_fara_jumatati` (0112) le refuză; ramura `else` le-ar
  -- trata ca `fara_rotunjire` dacă ar reapărea vreodată.
  return case v_rotunjire
    when 'zi_in_sus' then ceil(v_brut)
    when 'zi_in_jos' then floor(v_brut)
    when 'matematic' then round(v_brut)
    else v_brut
  end;
end;
$$;

comment on function app.drept_concediu(uuid, uuid, uuid, integer) is
  'Dreptul anual pe un tip de concediu: baza (zilele contractului de bază pentru odihnă, '
  'altfel leave_types.zile_implicite) + grilele cumulative valabile la 31 decembrie, '
  'înmulțite cu lunile lucrate în an / 12 (luna de intrare și de ieșire întregi; ancora: '
  'valabil_de_la al contractului de bază, rezervă hired_on; sfârșit: terminated_on dacă nu e '
  'anterior ancorei, rezervă incetat_la) și rotunjite după mod_rotunjire_acumulare doar la an parțial. Tipurile cu '
  'scade_din_sold = false nu se proporționalizează. Nu scrie nimic — folosită de '
  'internal.asigura_sold, public.aplica_drepturi_concediu și public.drepturile_mele_concediu.';

revoke all on function app.drept_concediu(uuid, uuid, uuid, integer) from public, anon;
grant execute on function app.drept_concediu(uuid, uuid, uuid, integer) to authenticated;

-- =====================================================================================
-- 2. public.seed_leave_balances — fără ramura de override
--
-- Aceeași semnătură ca 0036 (tipul RPC din database.ts rămâne valid). Ramura
-- `update leave_balances set drept_anual = p_zile_odihna_override` ar ANULA
-- proporționalitatea abia calculată de `asigura_sold` și ar lăsa în istoric un
-- rând „Corecție de încadrare" la fiecare înrolare. Parametrul rămâne, ignorat:
-- build-ul aflat în producție îl mai trimite în fereastra de până la deploy.
-- =====================================================================================

create or replace function public.seed_leave_balances(
  p_employee uuid,
  p_an integer,
  p_zile_odihna_override numeric default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_tip record;
begin
  select e.organization_id into v_org
  from public.employees e
  where e.id = p_employee and e.deleted_at is null;

  if v_org is null then
    raise exception 'Fișa de angajat nu există sau a fost ștearsă.' using errcode = 'P0001';
  end if;
  if not (v_org = any ((select app.current_org_ids())::uuid[])) then
    raise exception 'Fișa de angajat aparține altei organizații.' using errcode = 'P0001';
  end if;
  -- Însămânțarea soldului e o consecință directă a înrolării, nu o acțiune
  -- separată de gestiune a concediilor — pragul e cel al înrolării.
  if app.has_permission(v_org, 'employees', 'create') <> 'all' then
    raise exception 'Nu aveți dreptul de a înrola angajați.' using errcode = 'P0001';
  end if;

  -- Dreptul vine integral din `app.drept_concediu`, prin `asigura_sold`:
  -- zilele de pe contractul activ, grilele și proporția cu lunile lucrate.
  for v_tip in
    select id
    from public.leave_types
    where organization_id = v_org and activ and deleted_at is null
  loop
    perform internal.asigura_sold(v_org, p_employee, v_tip.id, p_an);
  end loop;
end;
$$;

comment on function public.seed_leave_balances(uuid, integer, numeric) is
  'Însămânțează soldurile anului pentru toate tipurile active ale firmei angajatului, prin '
  'internal.asigura_sold. p_zile_odihna_override e IGNORAT din 0193: dreptul se calculează '
  'din contractul de bază în app.drept_concediu, proporțional cu lunile lucrate.';

revoke all on function public.seed_leave_balances(uuid, integer, numeric) from public, anon;
grant execute on function public.seed_leave_balances(uuid, integer, numeric) to authenticated;

-- =====================================================================================
-- 3. internal.asigura_sold — doar motivul rândului de istoric
--
-- Aceeași semnătură și același corp ca 0035; istoricul din /concedii/sold
-- promitea „bază + grile" neproporțional.
-- =====================================================================================

create or replace function internal.asigura_sold(
  p_org uuid, p_employee uuid, p_type uuid, p_an integer
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    uuid;
  v_nou   boolean;
  v_drept numeric(6,2);
begin
  if not coalesce(
    (select lt.scade_din_sold from public.leave_types lt where lt.id = p_type), true
  ) then
    return null;
  end if;

  v_drept := app.drept_concediu(p_org, p_employee, p_type, p_an);

  insert into public.leave_balances (organization_id, employee_id, leave_type_id, an, drept_anual)
  values (p_org, p_employee, p_type, p_an, v_drept)
  on conflict (organization_id, employee_id, leave_type_id, an) where deleted_at is null
  do update set updated_at = now()
  returning id, (xmax = 0) into v_id, v_nou;

  if v_nou then
    insert into public.leave_accruals
      (organization_id, employee_id, leave_type_id, an, eveniment, delta, motiv)
    values
      (p_org, p_employee, p_type, p_an, 'drept_initial', v_drept,
       'Drept anual inițial: baza (contract sau tipul de concediu) plus grilele companiei, '
       'proporțional cu lunile lucrate în an.');
  end if;

  return v_id;
end;
$$;

revoke all on function internal.asigura_sold(uuid, uuid, uuid, integer) from public, anon, authenticated;

commit;
