-- supabase/migrations/0205_flota_fiscal.sql
--
-- FLOTA, FAZA F10: FISCALUL — REGIMUL DE DEDUCERE AL VEHICULULUI, NORMA PROPRIE
-- DE CONSUM, REGIMUL DE IMPOZITARE AL FIRMEI ȘI SUGESTIA DE AVANTAJ ÎN NATURĂ.
--
-- Planul nu-i dădea număr; 0174–0204 s-au ocupat între timp (flota F3–F9,
-- mentenanța, registrul, asistentul, salarizarea, tichetele, aprobatorii, KPI).
--
-- ── TEMEIURILE (verificate pe 12 oct 2026, forme consolidate descărcate cu curl) ──
-- Codul fiscal, Legea 227/2015 (DetaliiDocument/312601, consolidarea din
-- 08.08.2026):
--   · art. 25 alin. (3) lit. l): 50% din cheltuielile vehiculelor rutiere
--     motorizate „care nu sunt utilizate exclusiv în scopul activității
--     economice”, cu masa ≤ 3.500 kg și cel mult 9 scaune (cu al șoferului);
--     integral deductibile pentru categoriile de la pct. 1–5; fără amortizare;
--   · art. 298 alin. (1)–(3): aceeași limitare la TVA, aceleași excepții;
--   · art. 76 alin. (4) lit. ț): NU e venit impozabil folosința personală a
--     vehiculelor cu cheltuieli deductibile 50%; lit. ț^1): nici la firmele pe
--     impozitul microîntreprinderilor sau pe impozitul specific.
-- Normele, HG 1/2016 (DetaliiDocument/307847, consolidarea din 31.03.2026):
--   · titlul IV pct. 12 alin. (5) lit. a): folosința gratuită a vehiculului se
--     evaluează la 1,7% pe lună din valoarea de intrare; vehiculul închiriat
--     de la terți, la nivelul chiriei; alin. (6) lit. a): la folosința mixtă,
--     proporțional cu km personali din total;
--   · titlul II pct. 16 alin. (2) și titlul VII pct. 68: foaia de parcurs cu
--     „norma proprie de consum” e cerută doar pentru deducerea integrală.
--
-- ── CE ADUCE ────────────────────────────────────────────────────────────────
-- A. `organizations.regim_impozitare` (micro / profit / specific), nullable:
--    null = firma n-a spus, iar sugestia de avantaj nu se calculează.
-- B. `vehicle_fiscal_regimes`: perioade (`valabil_de_la`) cu regimul de
--    deducere, motivul, excepția (art. 25 pct. 1–5, la `exceptat_categorie`)
--    și titlul de folosință (proprietate, leasing, închiriere, comodat sau
--    chirie de la o persoană fizică — mașina personală folosită în interes de
--    serviciu). Regimul în vigoare la o zi = perioada cu cel mai mare
--    `valabil_de_la` ≤ zi.
-- C. `vehicle_consumption_norms`: norma proprie, cu decizia internă. Trimiterea
--    foii (instantaneul din `internal.foi_parcurs_numerotare`, rescris de la
--    forma ULTIMĂ, 0200 §5 — verificat cu grep: nicio altă rescriere) ia norma
--    în vigoare în ziua foii, apoi `consum_mediu_declarat` ca înainte.
-- D. `public.flota_fiscal_luna(org, luna)`, SECURITY INVOKER (RLS-ul tabelelor
--    decide ce vede apelantul): pe vehicul, regimul, zilele lunii cu deducere
--    integrală, norma și foile aprobate. Verdictul („deducere integrală fără
--    foi”) îl dă domeniul pur, `src/domain/fleet/fiscal.ts`.
-- E. `public.avantaj_natura_flota(org, angajat, luna)`, SECURITY DEFINER pe
--    `payroll:read = all`: alocările cu folosință personală (F2) ale omului și
--    faptele fiscale ale vehiculului. HR face salarizarea fără să vadă parcul
--    (decizia 3), deci funcția întoarce doar ce trebuie calculului. SUGESTIE:
--    nu scrie nimic pe stat; componenta `beneficiu_natura` se adaugă de mână.
--
-- ── CE NU FACE ──────────────────────────────────────────────────────────────
--  · Nu decide „categoria vehiculului” de pe foaie (omologată M1/N1 sau de
--    utilizare): rămâne ⚠ în NOTES.md, pentru contabil.
--  · Nu proporționează avantajul pe zile sau pe km: norma nu dă regula pe zile,
--    iar km personali nu se înregistrează. Ecranul spune formula.
--  · Nu atinge `internal.foi_parcurs_inainte` și nici politicile foii.
--
-- Aplicare: psql byte-exact, după bancul local; producția cere confirmare.

begin;

-- ============================================================
-- 1. Tipuri
-- ============================================================
-- Tipuri NOI (nu valori adăugate unui enum existent), deci se folosesc în
-- aceeași tranzacție fără restricția lui `alter type … add value`.
create type public.vehicle_fiscal_regime as enum (
  'limitat_50',                  -- art. 25 alin. (3) lit. l), art. 298 alin. (1)
  'integral_exclusiv_economic',  -- folosit exclusiv în scopul activității economice
  'exceptat_categorie',          -- art. 25 alin. (3) lit. l) pct. 1–5
  'peste_3500_sau_9_locuri'      -- în afara limitării (art. 298 alin. (2))
);

create type public.vehicle_exceptie_fiscala as enum (
  'urgenta_paza_curierat',       -- pct. 1
  'agenti_vanzari_achizitii',    -- pct. 2
  'transport_persoane_plata',    -- pct. 3
  'servicii_plata',              -- pct. 4: închiriere, școli de șoferi
  'marfa_comerciala'             -- pct. 5
);

create type public.vehicle_titlu_folosinta as enum (
  'proprietate',
  'leasing_financiar',
  'leasing_operational',
  'inchiriat',
  'comodat',                     -- mașina unei persoane fizice, folosită gratuit
  'chirie_persoana_fizica'       -- mașina unei persoane fizice, cu chirie
);

create type public.regim_impozitare as enum ('micro', 'profit', 'specific');

-- ============================================================
-- 2. Regimul de impozitare al firmei
-- ============================================================
-- `guard_organizations` (0002) readuce doar coloanele platformei; coloana asta
-- o scrie `org_admin` prin politica existentă `organizations_update`.
alter table public.organizations
  add column regim_impozitare public.regim_impozitare;

comment on column public.organizations.regim_impozitare is
  'Regimul de impozitare (0205): micro / profit / specific. null = nestabilit; sugestia de avantaj în natură auto nu se calculează (Codul fiscal art. 76 alin. (4) lit. ț^1)).';

-- ============================================================
-- 3. Regimul fiscal al vehiculului
-- ============================================================
create table public.vehicle_fiscal_regimes (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations (id) on delete cascade,
  vehicle_id             uuid not null references public.vehicles (id) on delete cascade,
  valabil_de_la          date not null,
  regim                  public.vehicle_fiscal_regime not null,
  exceptie               public.vehicle_exceptie_fiscala,
  motiv                  text not null,
  titlu_folosinta        public.vehicle_titlu_folosinta not null default 'proprietate',
  proprietar_employee_id uuid,
  chirie_lunara          numeric(12,2),
  contract_numar         text,
  contract_data          date,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  created_by             uuid references auth.users (id) on delete set null,
  updated_by             uuid references auth.users (id) on delete set null,
  deleted_at             timestamptz,
  -- Proprietarul mașinii personale e un angajat AL ACESTEI firme: cheia
  -- compusă din 0074 refuză și un id fabricat din altă firmă.
  constraint vfr_proprietar_fk foreign key (proprietar_employee_id, organization_id)
    references public.employees (id, organization_id) on delete restrict,
  constraint vfr_exceptie_ck check ((regim = 'exceptat_categorie') = (exceptie is not null)),
  constraint vfr_motiv_ck check (char_length(motiv) between 3 and 1000),
  constraint vfr_proprietar_ck check (
    (titlu_folosinta in ('comodat', 'chirie_persoana_fizica')) = (proprietar_employee_id is not null)
  ),
  constraint vfr_chirie_ck check (
    chirie_lunara is null
    or (chirie_lunara >= 0
        and titlu_folosinta in ('inchiriat', 'leasing_operational', 'chirie_persoana_fizica'))
  ),
  constraint vfr_contract_ck check (contract_numar is null or char_length(contract_numar) between 1 and 60)
);

-- O singură perioadă activă care începe într-o zi dată, pe vehicul.
create unique index vfr_vehicul_de_la_uq
  on public.vehicle_fiscal_regimes (organization_id, vehicle_id, valabil_de_la)
  where deleted_at is null;

create index vfr_vehicul_idx
  on public.vehicle_fiscal_regimes (organization_id, vehicle_id, valabil_de_la desc)
  where deleted_at is null;

comment on table public.vehicle_fiscal_regimes is
  'Regimul de deducere al vehiculului pe perioade (0205): Codul fiscal art. 25 alin. (3) lit. l) și art. 298. În vigoare la o zi = cel mai mare valabil_de_la ≤ zi.';

-- ============================================================
-- 4. Norma proprie de consum
-- ============================================================
create table public.vehicle_consumption_norms (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vehicle_id      uuid not null references public.vehicles (id) on delete cascade,
  valabil_de_la   date not null,
  l_100km         numeric(6,2) not null,
  decizie_numar   text,
  decizie_data    date,
  observatii      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null,
  updated_by      uuid references auth.users (id) on delete set null,
  deleted_at      timestamptz,
  -- Aceeași plajă ca `trip_sheets.ts_norma_ck`: norma ajunge în instantaneu.
  constraint vcn_l_100km_ck check (l_100km > 0 and l_100km <= 300),
  constraint vcn_decizie_ck check (decizie_numar is null or char_length(decizie_numar) between 1 and 60),
  constraint vcn_observatii_ck check (observatii is null or char_length(observatii) <= 1000)
);

create unique index vcn_vehicul_de_la_uq
  on public.vehicle_consumption_norms (organization_id, vehicle_id, valabil_de_la)
  where deleted_at is null;

create index vcn_vehicul_idx
  on public.vehicle_consumption_norms (organization_id, vehicle_id, valabil_de_la desc)
  where deleted_at is null;

comment on table public.vehicle_consumption_norms is
  'Norma proprie de consum pe perioade (0205), HG 1/2016 titlul II pct. 16 alin. (2). Foaia o fixează în trip_sheets.norma_l_100km la trimitere.';

-- ============================================================
-- 5. Triggerele de integritate
-- ============================================================
-- Integritate, nu drepturi. Comune celor două tabele: vehiculul din aceeași
-- firmă, rândul nu se mută pe alt vehicul, rândul șters nu mai revine.
create or replace function internal.flota_fiscal_inainte()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vehicul public.vehicles%rowtype;
begin
  -- Y2: garda de firmă, prima. Vehiculul se caută în firma RÂNDULUI, înaintea
  -- WITH CHECK: pe un rând pus pe firma B, vehiculul de acolo trecea, iar
  -- regimul „peste 3.500 kg” îi spunea în mesaj masa și locurile.
  if not app.is_service_context()
     and not coalesce(new.organization_id = any ((select app.current_org_ids())::uuid[]), false) then
    raise exception using errcode = '42501',
      message = 'Nu aveți dreptul de a scrie datele fiscale ale vehiculelor în această organizație.';
  end if;

  if tg_op = 'UPDATE' and not app.is_service_context() then
    if old.deleted_at is not null then
      raise exception using errcode = 'P0001',
        message = 'Rândul a fost șters și nu se mai modifică. Adăugați unul nou.';
    end if;
    if new.organization_id is distinct from old.organization_id
       or new.vehicle_id is distinct from old.vehicle_id then
      raise exception using errcode = 'P0001',
        message = 'Rândul nu se mută pe alt vehicul. Ștergeți-l și adăugați-l pe vehiculul corect.';
    end if;
  end if;

  select * into v_vehicul from public.vehicles v where v.id = new.vehicle_id;
  if not found or v_vehicul.organization_id <> new.organization_id
     or (v_vehicul.deleted_at is not null and tg_op = 'INSERT') then
    raise exception using errcode = 'P0001',
      message = 'Vehiculul ales nu aparține organizației dumneavoastră.';
  end if;

  if new.valabil_de_la > app.azi_local() + 366 then
    raise exception using errcode = 'P0001',
      message = 'Data de la care se aplică poate fi cel mult peste un an.';
  end if;

  if tg_table_name = 'vehicle_fiscal_regimes' then
    new.motiv := btrim(coalesce(new.motiv, ''));
    -- Singura contradicție pe care baza o refuză: deducerea integrală pe motiv
    -- de masă sau locuri, la un vehicul despre care ȘTIE că e ușor. Inversul
    -- (50% la un vehicul greu) e prudent, nu riscant: ecranul doar avertizează.
    -- NU și la ștergerea logică (`new.deleted_at is not null`): corectura e
    -- „șterge + perioadă nouă”, iar fișa vehiculului poate fi completată
    -- între timp; fără excepția asta, exact rândul greșit n-ar mai putea fi
    -- șters (revizia F10).
    if new.deleted_at is null
       and new.regim = 'peste_3500_sau_9_locuri'
       and v_vehicul.masa_maxima_kg is not null and v_vehicul.masa_maxima_kg <= 3500
       and v_vehicul.numar_locuri is not null and v_vehicul.numar_locuri <= 9 then
      raise exception using errcode = 'P0001',
        message = format('Regimul „peste 3.500 kg sau peste 9 locuri” nu se potrivește: fișa vehiculului are %s kg și %s locuri. Corectați fișa sau alegeți alt regim.',
                         v_vehicul.masa_maxima_kg, v_vehicul.numar_locuri);
    end if;
  else
    new.decizie_numar := nullif(btrim(coalesce(new.decizie_numar, '')), '');
    if new.decizie_data is not null and new.decizie_data > app.azi_local() then
      raise exception using errcode = 'P0001',
        message = 'Data deciziei interne nu poate fi în viitor.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger vfr_inainte
  before insert or update on public.vehicle_fiscal_regimes
  for each row execute function internal.flota_fiscal_inainte();

create trigger vcn_inainte
  before insert or update on public.vehicle_consumption_norms
  for each row execute function internal.flota_fiscal_inainte();

-- ============================================================
-- 6. Norma în vigoare și instantaneul foii
-- ============================================================
create or replace function internal.norma_consum_la(p_vehicle_id uuid, p_zi date)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select n.l_100km
    from public.vehicle_consumption_norms n
   where n.vehicle_id = p_vehicle_id
     and n.deleted_at is null
     and n.valabil_de_la <= p_zi
   order by n.valabil_de_la desc
   limit 1;
$$;

-- Rescriere de la forma ULTIMĂ (0200 §5). Singura schimbare: norma vine din
-- `vehicle_consumption_norms` în ziua foii (`data` e GENERATED, deci într-un
-- trigger BEFORE nu e încă calculată: ziua se ia din `plecare_la`, ca acolo).
create or replace function internal.foi_parcurs_numerotare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vehicul public.vehicles%rowtype;
begin
  -- Numărul și instantaneul sunt ale BAZEI. Un client nu-și alege numărul (ar
  -- putea „rezerva” FP-2026-00001) și nu-și scrie singur norma de consum.
  if not app.is_service_context() then
    if tg_op = 'INSERT' then
      new.numar               := null;
      new.vehicul_nr          := null;
      new.vehicul_categorie   := null;
      new.vehicul_combustibil := null;
      new.norma_l_100km       := null;
    else
      new.numar               := old.numar;
      new.vehicul_nr          := old.vehicul_nr;
      new.vehicul_categorie   := old.vehicul_categorie;
      new.vehicul_combustibil := old.vehicul_combustibil;
      new.norma_l_100km       := old.norma_l_100km;
    end if;
  end if;

  -- Trimiterea fixează vehiculul așa cum era în ziua aceea. Rulează DUPĂ
  -- `foi_parcurs_inainte` (ordine alfabetică), deci după gărzile de stare și
  -- după rescrierea agregatelor: `plecare_la` e cel final.
  if tg_op = 'UPDATE' and old.status = 'draft' and new.status = 'trimis' then
    select * into v_vehicul from public.vehicles v where v.id = new.vehicle_id;
    new.vehicul_nr          := v_vehicul.nr_inmatriculare;
    new.vehicul_categorie   := v_vehicul.categorie;
    new.vehicul_combustibil := v_vehicul.tip_combustibil;
    -- 0205: norma proprie (decizia internă) în vigoare în ziua foii; fără
    -- ea, consumul declarat, ca înainte.
    new.norma_l_100km       := coalesce(
      internal.norma_consum_la(new.vehicle_id, (new.plecare_la at time zone 'Europe/Bucharest')::date),
      v_vehicul.consum_mediu_declarat);
    if new.numar is null then
      new.numar := internal.aloca_numar_foaie(
        new.organization_id,
        extract(year from (new.plecare_la at time zone 'Europe/Bucharest'))::integer);
    end if;
  end if;
  return new;
end;
$$;

comment on column public.trip_sheets.norma_l_100km is
  'Norma proprie de consum la trimitere (HG 1/2016 pct. 16 alin. (2)): din vehicle_consumption_norms în ziua foii (0205), altfel vehicles.consum_mediu_declarat.';

-- ============================================================
-- 7. Luna fiscală a parcului
-- ============================================================
-- SECURITY INVOKER: fiecare tabelă își aplică RLS-ul, deci apelantul vede
-- exact vehiculele, regimurile și foile pe care le-ar vedea și direct. Fără
-- funcții `internal.*` (invocatorul n-are EXECUTE pe schema aceea).
--
-- Vehiculul trece, în plus, prin `app.poate_vedea_vehicul` (0199), adică prin
-- scope-ul lui `vehicles:read`, nu prin politica întreagă: 0215 dă în
-- `vehicule_select` omului FĂRĂ `vehicles:read` (hr) mașina alocată lui, pentru
-- „Mașina mea” (decizia 3), nu și raportul fiscal al parcului. Moștenită, ramura
-- i-ar fi dat un rând fals: regimul îi e închis, deci „fără regim” toată luna.
-- Platforma și contextul de serviciu rămân ca în politică (serviciul ocolește
-- RLS-ul). Proba: `tests/rls/proba-livrare-roluri.sql`, hr = 0.
create or replace function public.flota_fiscal_luna(p_organization_id uuid, p_luna date)
returns table (
  vehicle_id       uuid,
  nr_inmatriculare text,
  marca            text,
  model            text,
  categorie        public.vehicle_category,
  status           public.vehicle_status,
  masa_maxima_kg   integer,
  numar_locuri     integer,
  regim            public.vehicle_fiscal_regime,
  exceptie         public.vehicle_exceptie_fiscala,
  titlu_folosinta  public.vehicle_titlu_folosinta,
  regim_de_la      date,
  zile_luna        integer,
  zile_integral    integer,
  zile_fara_regim  integer,
  norma_l_100km    numeric,
  norma_de_la      date,
  foi_aprobate     integer,
  foi_neaprobate   integer,
  km_aprobati      integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with luna as (
    select date_trunc('month', p_luna)::date as inceput,
           (date_trunc('month', p_luna) + interval '1 month - 1 day')::date as sfarsit
  )
  select
    v.id,
    v.nr_inmatriculare,
    v.marca,
    v.model,
    v.categorie,
    v.status,
    v.masa_maxima_kg,
    v.numar_locuri::integer,
    r.regim,
    r.exceptie,
    r.titlu_folosinta,
    r.valabil_de_la,
    (l.sfarsit - l.inceput + 1)::integer,
    zile.integral::integer,
    zile.fara_regim::integer,
    n.l_100km,
    n.valabil_de_la,
    coalesce(f.aprobate, 0)::integer,
    coalesce(f.neaprobate, 0)::integer,
    coalesce(f.km, 0)::integer
  from luna l
  cross join public.vehicles v
  -- Regimul în vigoare la sfârșitul lunii.
  left join lateral (
    select x.regim, x.exceptie, x.titlu_folosinta, x.valabil_de_la
      from public.vehicle_fiscal_regimes x
     where x.vehicle_id = v.id and x.deleted_at is null and x.valabil_de_la <= l.sfarsit
     order by x.valabil_de_la desc
     limit 1
  ) r on true
  -- Pe zile: câte zile ale lunii au deducere integrală și câte n-au regim.
  cross join lateral (
    select count(*) filter (where z.regim is not null and z.regim <> 'limitat_50') as integral,
           count(*) filter (where z.regim is null) as fara_regim
      from generate_series(l.inceput, l.sfarsit, interval '1 day') as d(zi)
      left join lateral (
        select y.regim
          from public.vehicle_fiscal_regimes y
         where y.vehicle_id = v.id and y.deleted_at is null and y.valabil_de_la <= d.zi::date
         order by y.valabil_de_la desc
         limit 1
      ) z on true
  ) zile
  left join lateral (
    select y.l_100km, y.valabil_de_la
      from public.vehicle_consumption_norms y
     where y.vehicle_id = v.id and y.deleted_at is null and y.valabil_de_la <= l.sfarsit
     order by y.valabil_de_la desc
     limit 1
  ) n on true
  left join lateral (
    select count(*) filter (where t.status = 'aprobat') as aprobate,
           count(*) filter (where t.status in ('draft', 'trimis')) as neaprobate,
           sum(t.km_parcursi) filter (where t.status = 'aprobat') as km
      from public.trip_sheets t
     where t.vehicle_id = v.id
       and t.organization_id = p_organization_id
       and t.deleted_at is null
       and t.data between l.inceput and l.sfarsit
  ) f on true
  where p_organization_id is not null
    and p_luna is not null
    and v.organization_id = p_organization_id
    and v.deleted_at is null
    and ((select app.is_platform_admin())
         or (select app.is_service_context())
         or app.poate_vedea_vehicul(v.organization_id, v.employee_id, v.pool))
    and (v.data_iesire is null or v.data_iesire >= l.inceput)
    and (v.data_achizitie is null or v.data_achizitie <= l.sfarsit)
  order by v.nr_inmatriculare;
$$;

comment on function public.flota_fiscal_luna(uuid, date) is
  'Luna fiscală a parcului (0205), pe vehiculele VIZIBILE apelantului (SECURITY INVOKER): regimul la sfârșitul lunii, zilele cu deducere integrală, norma, foile aprobate. Verdictul: src/domain/fleet/fiscal.ts.';

-- ============================================================
-- 8. Faptele pentru sugestia de avantaj în natură
-- ============================================================
-- Cine face statul de plată (`payroll:read = all`) află, pentru UN angajat și
-- o lună, alocările cu folosință personală și faptele fiscale ale vehiculului.
-- Nimic altceva din parc. Restul primește zero rânduri, fără eroare.
create or replace function public.avantaj_natura_flota(
  p_organization_id uuid,
  p_employee_id uuid,
  p_luna date
)
returns table (
  assignment_id    uuid,
  vehicle_id       uuid,
  vehicul_nr       text,
  de_la            timestamptz,
  pana_la          timestamptz,
  regim            public.vehicle_fiscal_regime,
  titlu_folosinta  public.vehicle_titlu_folosinta,
  valoare_intrare  numeric,
  chirie_lunara    numeric,
  regim_impozitare public.regim_impozitare
)
language sql
stable
security definer
set search_path = ''
as $$
  with luna as (
    select date_trunc('month', p_luna)::date as inceput,
           (date_trunc('month', p_luna) + interval '1 month - 1 day')::date as sfarsit
  )
  select
    a.id,
    v.id,
    v.nr_inmatriculare,
    a.de_la,
    a.pana_la,
    r.regim,
    r.titlu_folosinta,
    v.valoare_achizitie,
    r.chirie_lunara,
    o.regim_impozitare
  from luna l
  join public.vehicle_assignments a
    on a.organization_id = p_organization_id
   and a.employee_id = p_employee_id
   and a.deleted_at is null
   and a.folosinta_personala
   and (a.de_la at time zone 'Europe/Bucharest')::date <= l.sfarsit
   and (a.pana_la is null or (a.pana_la at time zone 'Europe/Bucharest')::date >= l.inceput)
  join public.vehicles v on v.id = a.vehicle_id and v.organization_id = p_organization_id
  join public.organizations o on o.id = p_organization_id
  -- Regimul la ultima zi a lunii în care omul a avut mașina.
  left join lateral (
    select x.regim, x.titlu_folosinta, x.chirie_lunara
      from public.vehicle_fiscal_regimes x
     where x.vehicle_id = v.id and x.deleted_at is null
       and x.valabil_de_la <= least(l.sfarsit, coalesce((a.pana_la at time zone 'Europe/Bucharest')::date, l.sfarsit))
     order by x.valabil_de_la desc
     limit 1
  ) r on true
  where p_organization_id is not null
    and p_employee_id is not null
    and p_luna is not null
    and ((select app.is_platform_admin())
         or (p_organization_id = any ((select app.current_org_ids())::uuid[])
             and app.has_permission(p_organization_id, 'payroll', 'read') = 'all'))
    and app.feature_on(p_organization_id, 'fleet')
    and app.feature_on(p_organization_id, 'payroll')
  order by a.de_la;
$$;

comment on function public.avantaj_natura_flota(uuid, uuid, date) is
  'Faptele pentru SUGESTIA de avantaj în natură auto (0205): alocările cu folosință personală ale angajatului în lună, regimul și titlul vehiculului, valoarea de intrare, chiria, regimul de impozitare. Doar payroll:read = all. Nu scrie nimic; calculul: src/domain/fleet/fiscal.ts.';

-- ============================================================
-- 9. RLS
-- ============================================================
-- Datele fiscale sunt ale celui care administrează parcul la nivel de firmă
-- (`vehicles:read = all`): managerul și angajatul văd vehiculul, nu regimul
-- lui — pentru ei tabela întoarce zero rânduri, iar ecranul nu arată secțiunea.
-- Fără `deleted_at` în USING-ul de SELECT (0016): ștergerea logică cu
-- RETURNING ar cădea pe propria politică.
alter table public.vehicle_fiscal_regimes enable row level security;
alter table public.vehicle_fiscal_regimes force row level security;
alter table public.vehicle_consumption_norms enable row level security;
alter table public.vehicle_consumption_norms force row level security;

create policy vehicle_fiscal_regimes_select on public.vehicle_fiscal_regimes
for select to authenticated
using (
  (select app.is_platform_admin()) or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.has_permission(organization_id, 'vehicles', 'read') = 'all'
  )
);

create policy vehicle_fiscal_regimes_insert on public.vehicle_fiscal_regimes
for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
  and deleted_at is null
);

create policy vehicle_fiscal_regimes_update on public.vehicle_fiscal_regimes
for update to authenticated
using (
  deleted_at is null
  and organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
);

create policy vehicle_consumption_norms_select on public.vehicle_consumption_norms
for select to authenticated
using (
  (select app.is_platform_admin()) or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.has_permission(organization_id, 'vehicles', 'read') = 'all'
  )
);

create policy vehicle_consumption_norms_insert on public.vehicle_consumption_norms
for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
  and deleted_at is null
);

create policy vehicle_consumption_norms_update on public.vehicle_consumption_norms
for update to authenticated
using (
  deleted_at is null
  and organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
);

-- ============================================================
-- 10. Actor, audit, drepturi
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['vehicle_fiscal_regimes', 'vehicle_consumption_norms'] loop
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function internal.set_actor()',
      'trg_' || t || '_actor', t);
    perform internal.attach_audit(t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end
$$;

revoke all on function internal.flota_fiscal_inainte() from public, anon, authenticated;
revoke all on function internal.norma_consum_la(uuid, date) from public, anon, authenticated;
revoke all on function internal.foi_parcurs_numerotare() from public, anon, authenticated;
revoke all on function public.flota_fiscal_luna(uuid, date) from public, anon;
grant execute on function public.flota_fiscal_luna(uuid, date) to authenticated, service_role;
revoke all on function public.avantaj_natura_flota(uuid, uuid, date) from public, anon;
grant execute on function public.avantaj_natura_flota(uuid, uuid, date) to authenticated, service_role;

-- ============================================================
-- 11. Verificare
-- ============================================================
do $$
declare
  v_lipsa text[] := '{}';
  t text;
begin
  foreach t in array array['vehicle_fiscal_regimes', 'vehicle_consumption_norms'] loop
    if to_regclass('public.' || t) is null then
      v_lipsa := v_lipsa || t;
      continue;
    end if;
    if (select count(*) from pg_policies where schemaname = 'public' and tablename = t) <> 3 then
      v_lipsa := v_lipsa || ('trio-ul de politici pe ' || t);
    end if;
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and cmd = 'DELETE') then
      v_lipsa := v_lipsa || ('politică DELETE pe ' || t || ' (interzisă)');
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t
                    and cmd = 'UPDATE' and qual is not null and with_check is not null) then
      v_lipsa := v_lipsa || ('USING + WITH CHECK pe ' || t || '_update');
    end if;
    if not (select relforcerowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      v_lipsa := v_lipsa || ('FORCE RLS pe ' || t);
    end if;
    if has_table_privilege('authenticated', 'public.' || t, 'DELETE') then
      v_lipsa := v_lipsa || ('DELETE acordat pe ' || t);
    end if;
    if not exists (select 1 from pg_trigger where tgname = 'audit_' || t
                    and tgrelid = ('public.' || t)::regclass) then
      v_lipsa := v_lipsa || ('auditul pe ' || t);
    end if;
    if exists (select 1 from pg_indexes where schemaname = 'public' and tablename = t
                and indexname <> t || '_pkey' and indexdef not ilike '%where (deleted_at is null)%') then
      v_lipsa := v_lipsa || ('index neparțial pe ' || t);
    end if;
  end loop;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'organizations'
                    and column_name = 'regim_impozitare') then
    v_lipsa := v_lipsa || 'organizations.regim_impozitare';
  end if;
  if position('norma_consum_la' in pg_get_functiondef('internal.foi_parcurs_numerotare()'::regprocedure)) = 0
     or position('aloca_numar_foaie' in pg_get_functiondef('internal.foi_parcurs_numerotare()'::regprocedure)) = 0 then
    v_lipsa := v_lipsa || 'internal.foi_parcurs_numerotare cu norma și numerotarea';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where (n.nspname, p.proname) in (('internal', 'flota_fiscal_inainte'), ('internal', 'norma_consum_la'),
                                               ('internal', 'foi_parcurs_numerotare'),
                                               ('public', 'flota_fiscal_luna'), ('public', 'avantaj_natura_flota'))
                and (p.proconfig is null or not ('search_path=""' = any (p.proconfig)))) then
    v_lipsa := v_lipsa || 'search_path gol pe funcțiile 0205';
  end if;
  if (select prosecdef from pg_proc where oid = 'public.flota_fiscal_luna(uuid,date)'::regprocedure) then
    v_lipsa := v_lipsa || 'flota_fiscal_luna trebuie să fie SECURITY INVOKER';
  end if;
  if array_length(v_lipsa, 1) > 0 then
    raise exception '0205: lipsesc %', array_to_string(v_lipsa, ', ');
  end if;
end $$;

commit;

-- ============================================================
-- 12. Note de proiectare
-- ============================================================
-- · Perioade, nu o coloană pe `vehicles`: regimul se schimbă (mașina devine de
--   serviciu, leasingul se încheie), iar o foaie din martie se judecă după
--   regimul din martie. Corectura e ștergere + perioadă nouă, ca la alocări.
-- · Titlul de folosință stă pe perioada fiscală, nu pe vehicul: comodatul sau
--   chiria de la o persoană fizică (mașina personală folosită în interes de
--   serviciu) se încheie și se reia exact ca regimul. Tratamentul fiscal al
--   decontului rămâne ⚠ în NOTES.md.
-- · `flota_fiscal_luna` e INVOKER ca managerul cu `vehicles:read = team` să
--   primească vehiculele echipei fără regim (RLS), nu regimul altora; pagina
--   cere oricum `vehicles:read = all`.
-- · `avantaj_natura_flota` e DEFINER fiindcă HR-ul (payroll = all) n-are
--   niciun drept pe vehicule (decizia 3) și totuși face statul de plată.
-- · Proba: `tests/rls/proba-flota-fiscal.sql`; scrierile legitime: verificarea
--   `(l)` din `tests/rls/izolare.sql`, blocul 0205.
