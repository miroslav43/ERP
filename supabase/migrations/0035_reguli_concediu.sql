-- supabase/migrations/0035_reguli_concediu.sql
-- Reguli de concediu la nivel de companie, aplicate automat pe angajați.
--
-- Problema de azi: `leave_types.zile_implicite` e o singură cifră plată per
-- organizație — orice angajat primește exact același drept, indiferent de
-- vechime, condiții de muncă sau handicap. Tabela `leave_entitlement_rules`
-- exista deja din 0009 („CO suplimentar pe categorii"), dar nu era citită de
-- nimic — `internal.asigura_sold` folosea direct `zile_implicite`.
--
-- Ce aduce migrarea asta:
--   1) distincția FIX (reglementat legal, blocat la editare) vs. ADAPTABIL
--      (stabilit de companie, editabil) pe `leave_types`;
--   2) `leave_entitlement_rules` extinsă cu un discriminant de criteriu
--      (vechime / condiții de muncă / handicap / sub 18 ani / departament /
--      funcție), ca grilele să fie interogabile, nu doar stocate;
--   3) `app.drept_concediu` — calculul dreptului anual al UNUI angajat pe UN
--      tip de concediu, bază + suma grilelor aplicabile;
--   4) `internal.asigura_sold` folosește acest calcul (nu mai copiază
--      `zile_implicite` orb) — orice sold nou creat e deja corect;
--   5) `public.aplica_drepturi_concediu` — recalculează retroactiv soldurile
--      EXISTENTE, cu previzualizare (simulare) înainte de scriere;
--   6) `organizations.zile_concediu_anual_implicit` propagă automat spre
--      `leave_types.zile_implicite` (tip „odihna") la orice UPDATE, indiferent
--      pe ce cale a fost scrisă valoarea — golește o gaură documentată în
--      0030 („modificarea ulterioară nu propagă nimic”);
--   7) unificarea „paternal” / „nastere_copil” — același drept legal, două
--      rânduri în `leave_types` până acum.
--
-- Clasificarea reglementat/adaptabil e cea cerută explicit de client, nu o
-- presupunere: medical, maternitate, creștere copil, paternal, îngrijitor,
-- donator de sânge sunt FIXE; odihnă, căsătorie, deces în familie, fără plată
-- sunt ADAPTABILE. Valorile numerice deja seed-uite rămân DE VERIFICAT DE
-- JURIST — migrarea asta nu le schimbă, doar decide cine are voie să le atingă.

begin;

-- =====================================================================================
-- 1. leave_types.reglementat — fix legal vs. adaptabil de companie
-- =====================================================================================

alter table public.leave_types
  add column reglementat boolean not null default false;

comment on column public.leave_types.reglementat is
  'true = durată/reguli fixate prin lege (medical, maternitate, creștere copil, paternal, '
  'îngrijitor, donator de sânge) — trigger-ul trg_leave_types_protejeaza_reglementat '
  'respinge orice modificare a lor în afară de activ/culoare/denumire. false = stabilit de '
  'companie (odihnă, căsătorie, deces în familie, fără plată), liber editabil de un admin '
  'cu leave:update = all.';

update public.leave_types
   set reglementat = true
 where key in ('medical', 'maternitate', 'crestere_copil', 'paternal', 'ingrijitor', 'donator_sange');

create or replace function internal.leave_types_protejeaza_reglementat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.reglementat and (
    new.key                        is distinct from old.key
    or new.zile_implicite          is distinct from old.zile_implicite
    or new.scade_din_sold          is distinct from old.scade_din_sold
    or new.necesita_document       is distinct from old.necesita_document
    or new.se_reporteaza           is distinct from old.se_reporteaza
    or new.termen_reportare        is distinct from old.termen_reportare
    or new.plafon_reportare_zile   is distinct from old.plafon_reportare_zile
    or new.mod_rotunjire_acumulare is distinct from old.mod_rotunjire_acumulare
    or new.intrerupe_alte_concedii is distinct from old.intrerupe_alte_concedii
    or new.reglementat             is distinct from old.reglementat
  ) then
    raise exception using errcode = 'P0001', message = format(
      '„%s" este un concediu reglementat legal (%s) — durata și regulile lui nu pot fi '
      'modificate din aplicație, doar activat/dezactivat.',
      old.denumire, coalesce(old.temei_legal, 'temei legal neprecizat')
    );
  end if;
  return new;
end;
$$;

revoke all on function internal.leave_types_protejeaza_reglementat() from public, anon, authenticated;

create trigger trg_leave_types_protejeaza_reglementat
  before update on public.leave_types
  for each row execute function internal.leave_types_protejeaza_reglementat();

-- =====================================================================================
-- 2. leave_entitlement_rules — grile cumulative, cu discriminant de criteriu
-- =====================================================================================

create type public.leave_rule_criterion as enum
  ('vechime', 'conditii_munca', 'grad_handicap', 'varsta_sub_18', 'departament', 'functie');

alter table public.leave_entitlement_rules
  add column tip_criteriu    public.leave_rule_criterion not null default 'vechime',
  add column vechime_ani_min smallint,
  add column valoare_text    text,
  add column department_id   uuid references public.departments (id) on delete cascade,
  add column job_position_id uuid references public.job_positions (id) on delete cascade,
  add column activ           boolean not null default true;

alter table public.leave_entitlement_rules alter column tip_criteriu drop default;

-- `categorie` rămâne o etichetă liberă pentru audit/afișare, nu mai e cheia de
-- unicitate — discriminantul e acum `tip_criteriu` + valoarea lui specifică.
alter table public.leave_entitlement_rules drop constraint ler_categorie_ck;
alter table public.leave_entitlement_rules alter column categorie drop not null;
alter table public.leave_entitlement_rules
  add constraint ler_categorie_ck check (categorie is null or categorie ~ '^[a-z][a-z0-9_]{1,40}$');

alter table public.leave_entitlement_rules
  add constraint ler_vechime_ck check (vechime_ani_min is null or vechime_ani_min between 0 and 60);

-- Exact un discriminant populat, ales de `tip_criteriu` — restul rămân null.
-- CHECK, nu validare doar în aplicație: un insert direct (script, RPC viitor)
-- nu poate produce o regulă ambiguă sau goală.
alter table public.leave_entitlement_rules
  add constraint ler_criteriu_ck check (
    case tip_criteriu
      when 'vechime' then
        vechime_ani_min is not null and valoare_text is null
        and department_id is null and job_position_id is null
      when 'conditii_munca' then
        valoare_text in ('deosebite', 'speciale')
        and vechime_ani_min is null and department_id is null and job_position_id is null
      when 'grad_handicap' then
        valoare_text in ('accentuat', 'grav')
        and vechime_ani_min is null and department_id is null and job_position_id is null
      when 'varsta_sub_18' then
        vechime_ani_min is null and valoare_text is null
        and department_id is null and job_position_id is null
      when 'departament' then
        department_id is not null and vechime_ani_min is null
        and valoare_text is null and job_position_id is null
      when 'functie' then
        job_position_id is not null and vechime_ani_min is null
        and valoare_text is null and department_id is null
    end
  );

drop index if exists public.leave_entitlement_rules_uk;
create unique index leave_entitlement_rules_uk
  on public.leave_entitlement_rules (
    organization_id, leave_type_id, tip_criteriu,
    coalesce(vechime_ani_min, -1),
    coalesce(valoare_text, ''),
    coalesce(department_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(job_position_id, '00000000-0000-0000-0000-000000000000'::uuid),
    valabil_de_la
  )
  where deleted_at is null;

-- Index pe fiecare FK nouă cu ON DELETE CASCADE (regula din 0009: obligatoriu,
-- altfel ștergerea unui departament/funcții blochează tabela la scanare completă).
create index leave_entitlement_rules_dept_idx
  on public.leave_entitlement_rules (department_id) where department_id is not null;
create index leave_entitlement_rules_pos_idx
  on public.leave_entitlement_rules (job_position_id) where job_position_id is not null;

comment on column public.leave_entitlement_rules.tip_criteriu is
  'Discriminantul grilei. „vechime” citește vechime_ani_min (ani ÎN MUNCĂ, calculați din '
  'employees.hired_on — nu vechime în firmă separat de vechime în muncă, nu există câmp '
  'distinct pentru asta). „conditii_munca”/„grad_handicap” citesc valoare_text. „varsta_sub_18” '
  'nu are parametru — se derivă din employees.data_nasterii la data de referință. '
  '„departament”/„functie” citesc department_id/job_position_id.';

-- =====================================================================================
-- 3. app.drept_concediu — dreptul anual al unui angajat, pe un tip, pe un an
--
-- Bază (leave_types.zile_implicite) + suma CUMULATIVĂ a grilelor aplicabile,
-- active, valabile la 31 decembrie din anul dat. Data de referință e fixă —
-- rezultatul nu depinde de `now()`, deci e reproductibil oricând e re-rulat
-- (esențial pentru `aplica_drepturi_concediu`, care compară „vechi” cu „nou”).
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
  v_baza          numeric(6,2);
  v_suplimentar   numeric(6,2);
  v_referinta     date;
  v_hired_on      date;
  v_data_nasterii date;
  v_conditii      text;
  v_handicap      text;
  v_department    uuid;
  v_job_position  uuid;
  v_vechime_luni  integer;
begin
  select lt.zile_implicite into v_baza
  from public.leave_types lt
  where lt.id = p_type and lt.organization_id = p_org and lt.deleted_at is null;

  if v_baza is null then
    return 0;
  end if;

  v_referinta := make_date(p_an, 12, 31);

  select e.hired_on, e.data_nasterii, e.conditii_munca::text, e.grad_handicap,
         e.department_id, e.job_position_id
    into v_hired_on, v_data_nasterii, v_conditii, v_handicap, v_department, v_job_position
  from public.employees e
  where e.id = p_employee and e.organization_id = p_org and e.deleted_at is null;

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
      or (r.tip_criteriu = 'functie' and v_job_position = r.job_position_id)
    );

  return v_baza + v_suplimentar;
end;
$$;

comment on function app.drept_concediu(uuid, uuid, uuid, integer) is
  'Bază + grile cumulative, la 31 decembrie din anul dat. Nu scrie nimic — folosită de '
  'internal.asigura_sold (la primul sold al anului) și de public.aplica_drepturi_concediu '
  '(la recalcularea soldurilor existente).';

grant execute on function app.drept_concediu(uuid, uuid, uuid, integer) to authenticated;

-- =====================================================================================
-- 4. internal.asigura_sold — folosește app.drept_concediu în loc de zile_implicite orb
--
-- SEMNĂTURA NU SE SCHIMBĂ (returns uuid, aceiași 4 parametri) — apelanții
-- (internal.recalc_sold) rămân neatinși. Singura schimbare: `drept_anual` la
-- prima creare a soldului vine din calculul complet, nu din baza singură —
-- un angajat cu grilă de vechime primește dreptul corect din start, fără să
-- fie nevoie de „Aplică” imediat după prima cerere.
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
       'Drept anual inițial: baza tipului de concediu plus grilele companiei aplicabile.');
  end if;

  return v_id;
end;
$$;

-- =====================================================================================
-- 5. public.aplica_drepturi_concediu — recalculează soldurile EXISTENTE
--
-- `p_simulare = true` (implicit): doar întoarce diferențele, nu scrie nimic —
-- previzualizarea cerută explicit înainte de orice scriere pe angajați.
-- `p_simulare = false`: scrie `drept_anual` pentru fiecare rând care s-a
-- schimbat. NU atinge `folosite`/`in_asteptare` — trece de
-- internal.leave_balances_protejeaza_calculate, iar
-- internal.leave_balances_corectie_incadrare (0017) loghează automat
-- diferența în leave_accruals ca 'corectie_incadrare' — istoricul rămâne
-- auditabil fără cod suplimentar aici.
--
-- Gardă de permisiune explicită: funcția e SECURITY DEFINER, deci ocolește
-- RLS — verificarea `leave:update = all` trebuie făcută în corp, nu lăsată
-- politicilor.
-- =====================================================================================

create or replace function public.aplica_drepturi_concediu(
  p_organization_id uuid, p_an integer, p_simulare boolean default true
) returns table (
  employee_id  uuid,
  leave_type_id uuid,
  drept_vechi  numeric,
  drept_nou    numeric,
  ramase_dupa  numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_drept_nou numeric(6,2);
  v_vechi     numeric(6,2);
  v_folosite  numeric(6,2);
  v_asteptare numeric(6,2);
begin
  if not (p_organization_id = any ((select app.current_org_ids())::uuid[])) then
    raise exception using errcode = 'P0001', message = 'Organizația nu vă este accesibilă.';
  end if;
  if app.has_permission(p_organization_id, 'leave', 'update') <> 'all' then
    raise exception using errcode = 'P0001',
      message = 'Nu aveți dreptul de a aplica drepturile de concediu pentru toți angajații.';
  end if;
  if p_an is null or p_an < 2000 or p_an > 2199 then
    raise exception using errcode = 'P0001', message = 'Anul trebuie să fie între 2000 și 2199.';
  end if;

  for r in
    select e.id as emp_id, lt.id as type_id
    from public.employees e
    cross join public.leave_types lt
    where e.organization_id = p_organization_id
      and e.status = 'activ'
      and e.deleted_at is null
      and lt.organization_id = p_organization_id
      and lt.activ
      and lt.deleted_at is null
      and lt.scade_din_sold
  loop
    v_drept_nou := app.drept_concediu(p_organization_id, r.emp_id, r.type_id, p_an);

    select b.drept_anual, b.folosite, b.in_asteptare
      into v_vechi, v_folosite, v_asteptare
    from public.leave_balances b
    where b.organization_id = p_organization_id
      and b.employee_id = r.emp_id
      and b.leave_type_id = r.type_id
      and b.an = p_an
      and b.deleted_at is null;

    if v_vechi is null then
      v_vechi := 0;
      v_folosite := 0;
      v_asteptare := 0;
    end if;

    if v_drept_nou is distinct from v_vechi then
      employee_id := r.emp_id;
      leave_type_id := r.type_id;
      drept_vechi := v_vechi;
      drept_nou := v_drept_nou;
      ramase_dupa := v_drept_nou - v_folosite - v_asteptare;
      return next;

      if not p_simulare then
        insert into public.leave_balances (organization_id, employee_id, leave_type_id, an, drept_anual)
        values (p_organization_id, r.emp_id, r.type_id, p_an, v_drept_nou)
        on conflict (organization_id, employee_id, leave_type_id, an) where deleted_at is null
        do update set drept_anual = excluded.drept_anual;
      end if;
    end if;
  end loop;

  return;
end;
$$;

comment on function public.aplica_drepturi_concediu(uuid, integer, boolean) is
  'Previzualizare (implicit) sau aplicare a drepturilor de concediu recalculate pe toți '
  'angajații activi ai organizației, pentru anul dat. Doar leave:update = all.';

revoke all on function public.aplica_drepturi_concediu(uuid, integer, boolean) from public, anon;
grant execute on function public.aplica_drepturi_concediu(uuid, integer, boolean) to authenticated;

-- =====================================================================================
-- 6. Propagarea zilelor de bază de CO — organizations → leave_types('odihna')
--
-- 0030 citea `zile_concediu_anual_implicit` O SINGURĂ DATĂ, la crearea
-- organizației. O modificare ulterioară (din /setari/organizatie SAU din noul
-- RPC de mai jos) nu ajungea niciodată la `leave_types.zile_implicite` — gaură
-- documentată în plan. Trigger-ul rulează pe ORICE UPDATE al coloanei,
-- indiferent de calea prin care s-a scris.
-- =====================================================================================

create or replace function internal.organizations_propaga_zile_odihna()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.zile_concediu_anual_implicit is distinct from old.zile_concediu_anual_implicit then
    update public.leave_types
       set zile_implicite = new.zile_concediu_anual_implicit,
           updated_at = now()
     where organization_id = new.id
       and key = 'odihna'
       and deleted_at is null;
  end if;
  return null;
end;
$$;

revoke all on function internal.organizations_propaga_zile_odihna() from public, anon, authenticated;

create trigger trg_organizations_propaga_zile_odihna
  after update on public.organizations
  for each row execute function internal.organizations_propaga_zile_odihna();

-- RPC dedicat pentru pagina /concedii/setari: cere doar leave:update = all, nu
-- organizations:update = all (o permisiune de alt nivel — HR poate configura
-- concediile fără drept de scriere pe fișa generală a organizației).
create or replace function public.seteaza_zile_concediu_implicit(
  p_organization_id uuid, p_zile smallint
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (p_organization_id = any ((select app.current_org_ids())::uuid[])) then
    raise exception using errcode = 'P0001', message = 'Organizația nu vă este accesibilă.';
  end if;
  if app.has_permission(p_organization_id, 'leave', 'update') <> 'all' then
    raise exception using errcode = 'P0001', message = 'Nu aveți dreptul de a configura concediile.';
  end if;
  if p_zile is null or p_zile < 0 or p_zile > 60 then
    raise exception using errcode = 'P0001', message = 'Numărul de zile trebuie să fie între 0 și 60.';
  end if;

  update public.organizations
     set zile_concediu_anual_implicit = p_zile,
         updated_at = now(),
         updated_by = (select auth.uid())
   where id = p_organization_id
     and deleted_at is null;
end;
$$;

revoke all on function public.seteaza_zile_concediu_implicit(uuid, smallint) from public, anon;
grant execute on function public.seteaza_zile_concediu_implicit(uuid, smallint) to authenticated;

-- =====================================================================================
-- 7. Unificarea „paternal” / „nastere_copil” — același drept legal
--
-- Legal, în România, cele două sunt identice (zilele acordate tatălui la
-- nașterea copilului). Cererile și accrual-urile existente pe „nastere_copil”
-- se remapează pe „paternal”; soldurile (dacă există — ambele tipuri au
-- scade_din_sold = false, deci în practică nu au rânduri) se însumează
-- defensiv; tipul vechi se dezactivează și se soft-delete-uiește, nu se
-- șterge fizic — istoricul de audit îl referă în continuare prin id.
-- =====================================================================================

do $$
declare
  r record;
begin
  for r in
    select lt_nou.organization_id as org_id, lt_nou.id as id_paternal, lt_vechi.id as id_vechi
    from public.leave_types lt_nou
    join public.leave_types lt_vechi
      on lt_vechi.organization_id = lt_nou.organization_id
     and lt_vechi.key = 'nastere_copil'
     and lt_vechi.deleted_at is null
    where lt_nou.key = 'paternal'
      and lt_nou.deleted_at is null
  loop
    update public.leave_requests
       set leave_type_id = r.id_paternal,
           intrerupe_alte_concedii = false
     where leave_type_id = r.id_vechi;

    update public.leave_accruals
       set leave_type_id = r.id_paternal
     where leave_type_id = r.id_vechi;

    update public.leave_balances b_nou
       set drept_anual = b_nou.drept_anual + b_vechi.drept_anual,
           reportate   = b_nou.reportate + b_vechi.reportate,
           updated_at  = now()
      from public.leave_balances b_vechi
     where b_vechi.leave_type_id = r.id_vechi
       and b_nou.leave_type_id = r.id_paternal
       and b_nou.employee_id = b_vechi.employee_id
       and b_nou.an = b_vechi.an
       and b_nou.deleted_at is null
       and b_vechi.deleted_at is null;

    update public.leave_balances
       set leave_type_id = r.id_paternal
     where leave_type_id = r.id_vechi
       and deleted_at is null
       and not exists (
         select 1 from public.leave_balances b2
         where b2.leave_type_id = r.id_paternal
           and b2.employee_id = leave_balances.employee_id
           and b2.an = leave_balances.an
           and b2.deleted_at is null
       );

    update public.leave_balances
       set deleted_at = now()
     where leave_type_id = r.id_vechi
       and deleted_at is null;

    update public.leave_types
       set activ = false, deleted_at = now()
     where id = r.id_vechi;
  end loop;

  update public.leave_types
     set denumire = 'Concediu paternal (la nașterea copilului)'
   where key = 'paternal'
     and deleted_at is null;
end $$;

-- =====================================================================================
-- 8. internal.seed_leave_defaults — forma finală pentru organizații NOI
--
-- Fără „nastere_copil” (unificat mai sus), cu `reglementat` pe fiecare tip.
-- SEMNĂTURA NU SE SCHIMBĂ — trg_organizations_seed_leave (0009) o apelă mai
-- departe fără nicio modificare.
-- =====================================================================================

create or replace function internal.seed_leave_defaults(p_organization_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_flow uuid;
  v_zile_odihna smallint;
begin
  select o.zile_concediu_anual_implicit into v_zile_odihna
  from public.organizations o
  where o.id = p_organization_id;

  insert into public.leave_types (organization_id, key, denumire, zile_implicite, scade_din_sold,
    necesita_document, se_reporteaza, termen_reportare, intrerupe_alte_concedii,
    mod_rotunjire_acumulare, plafon_reportare_zile, culoare, temei_legal, reglementat)
  select p_organization_id, t.key, t.denumire,
         case when t.key = 'odihna' then coalesce(v_zile_odihna, t.zile) else t.zile end,
         t.scade, t.doc, t.rep, t.termen, t.intrerupe,
         t.rotunjire::public.leave_rounding_mode, t.plafon, t.culoare, t.temei, t.reglementat
  from (values
    ('odihna',        'Concediu de odihnă',                          20, true,  false, true,  18,   false, 'jumatate_in_sus', 20, '#2563EB', 'Codul Muncii art. 145 (DE VERIFICAT)', false),
    ('medical',       'Concediu medical',                           183, false, true,  false, null, true,  'fara_rotunjire', null, '#DC2626', 'OUG 158/2005 (DE VERIFICAT)', true),
    ('maternitate',   'Concediu de maternitate',                    126, false, true,  false, null, true,  'fara_rotunjire', null, '#DB2777', 'OUG 158/2005 (DE VERIFICAT)', true),
    ('paternal',      'Concediu paternal (la nașterea copilului)',   10, false, true,  false, null, false, 'fara_rotunjire', null, '#0891B2', 'Legea 210/1999 (DE VERIFICAT)', true),
    ('crestere_copil','Concediu creștere copil',                    730, false, true,  false, null, true,  'fara_rotunjire', null, '#7C3AED', 'OUG 111/2010 (DE VERIFICAT)', true),
    ('casatorie',     'Concediu pentru căsătorie',                    5, false, true,  false, null, false, 'fara_rotunjire', null, '#F59E0B', 'CCM / regulament intern (DE VERIFICAT)', false),
    ('deces_ruda',    'Concediu pentru deces în familie',             3, false, true,  false, null, false, 'fara_rotunjire', null, '#475569', 'CCM / regulament intern (DE VERIFICAT)', false),
    ('donator_sange', 'Zi liberă donator de sânge',                   1, false, true,  false, null, false, 'fara_rotunjire', null, '#B91C1C', 'Legea 282/2005 (DE VERIFICAT)', true),
    ('ingrijitor',    'Concediu de îngrijitor',                       5, false, true,  false, null, false, 'fara_rotunjire', null, '#0D9488', 'Codul Muncii art. 152^1 (DE VERIFICAT)', true),
    ('fara_plata',    'Concediu fără plată',                         90, false, false, false, null, false, 'fara_rotunjire', null, '#94A3B8', 'Regulament intern (DE VERIFICAT)', false)
  ) as t(key, denumire, zile, scade, doc, rep, termen, intrerupe, rotunjire, plafon, culoare, temei, reglementat)
  on conflict do nothing;

  insert into public.approval_flows (organization_id, entity_type, denumire)
  values (p_organization_id, 'leave_request', 'Aprobare cerere de concediu')
  on conflict do nothing;

  select id into v_flow from public.approval_flows
   where organization_id = p_organization_id and entity_type = 'leave_request'
     and activ and deleted_at is null;

  if v_flow is not null then
    insert into public.approval_steps (organization_id, flow_id, ordine, tip, permission_key, optional, sla_ore)
    values (p_organization_id, v_flow, 1, 'manager_direct', null, false, 72)
    on conflict do nothing;
    insert into public.approval_steps (organization_id, flow_id, ordine, tip, permission_key, optional, sla_ore)
    values (p_organization_id, v_flow, 2, 'permisiune', 'leave:approve', true, 72)
    on conflict do nothing;
  end if;
end; $$;

commit;
