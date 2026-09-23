-- supabase/migrations/0147_diurna_valori_legale.sql
--
-- POLITICA DE DIURNĂ: FIRMA DECIDE CÂT PLĂTEȘTE, LEGEA DECIDE CÂT E NEIMPOZABIL.
--
-- ── DE UNDE VINE MIGRAREA ───────────────────────────────────────────────────
-- Formularul politicii cerea angajatorului „diurna legală de bază", „multiplul
-- plafonului neimpozabil" și „plafonul în salarii de bază". Nu sunt decizii ale
-- firmei: sunt lege (HG 714/2018 + Ordinul 1235/2023, Codul fiscal art. 76
-- alin. (2) lit. k)). Un angajator care le „completează" poate doar să le
-- greșească. Iar diurna externă nu se putea da ca sumă fixă (ex. 50 EUR/zi):
-- singura pârghie era un multiplu aplicat baremului fiecărei țări.
--
-- ── CE SE SCHIMBĂ ───────────────────────────────────────────────────────────
--   1. `per_diem_valori_legale` — nomenclator GLOBAL, versionat prin
--      `valabil_de_la`, scris doar de administratorul de platformă (ca
--      `per_diem_country_rates`). Când se schimbă legea, se adaugă un rând.
--   2. Un trigger BEFORE pe `per_diem_policies` copiază valorile legale valabile
--      la `valabil_de_la` peste ce a trimis apelantul. Coloanele rămân în
--      politică (le citesc `recalculeaza_diurna`, motorul TS și salarizarea),
--      dar nu mai pot fi alese de firmă — nici din formular, nici direct pe API.
--   3. `diurna_externa_zi` + `moneda_diurna_externa` — suma fixă a firmei pentru
--      străinătate. Opțională: NULL = se plătește baremul țării × multiplu, ca
--      înainte. Plafonul neimpozabil extern rămâne 2,5 × baremul ȚĂRII.
--   4. `app.recalculeaza_diurna` folosește suma fixă. Când moneda ei diferă de
--      moneda baremului, plafonul nu se poate converti cu singurul curs al
--      deplasării — calculul se marchează incomplet, nu se inventează un curs.
--
-- ⚠ Valorile legale de mai jos se confirmă de contabil (NOTES.md, „Diurne").

-- =====================================================================================
-- 1. per_diem_valori_legale — nomenclator global (NU este multi-tenant)
-- =====================================================================================
create table public.per_diem_valori_legale (
  id uuid primary key default gen_random_uuid(),
  valabil_de_la date not null,
  diurna_baza_legala_interna numeric(14,2) not null,
  multiplu_plafon_neimpozabil numeric(6,2) not null,
  plafon_salarii_baza_luna numeric(6,2) not null,
  sursa text not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  constraint per_diem_valori_legale_sume_ck check (
    diurna_baza_legala_interna > 0
    and multiplu_plafon_neimpozabil >= 1
    and plafon_salarii_baza_luna > 0
  ),
  constraint per_diem_valori_legale_sursa_ck check (char_length(btrim(sursa)) between 2 and 500)
);

create unique index per_diem_valori_legale_uk
  on public.per_diem_valori_legale (valabil_de_la)
  where deleted_at is null;

comment on table public.per_diem_valori_legale is
  'Valorile LEGALE ale diurnei (nivelul pentru instituțiile publice, multiplul plafonului '
  'neimpozabil, plafonul lunar în salarii de bază). Se copiază în per_diem_policies de '
  'trigger; firma nu le poate alege.';

alter table public.per_diem_valori_legale enable row level security;
alter table public.per_diem_valori_legale force row level security;
revoke all on public.per_diem_valori_legale from public, anon;
grant select, insert, update on public.per_diem_valori_legale to authenticated, service_role;
revoke delete on public.per_diem_valori_legale from authenticated;

create trigger trg_set_actor before insert or update on public.per_diem_valori_legale
  for each row execute function internal.set_actor();
select internal.attach_audit('per_diem_valori_legale');

create policy per_diem_valori_legale_select on public.per_diem_valori_legale
  for select to authenticated using (true);
create policy per_diem_valori_legale_insert on public.per_diem_valori_legale
  for insert to authenticated with check (app.is_platform_admin() and deleted_at is null);
create policy per_diem_valori_legale_update on public.per_diem_valori_legale
  for update to authenticated using (app.is_platform_admin()) with check (app.is_platform_admin());

insert into public.per_diem_valori_legale
  (valabil_de_la, diurna_baza_legala_interna, multiplu_plafon_neimpozabil, plafon_salarii_baza_luna, sursa)
values
  ('2018-07-01', 20, 2.5, 3, 'HG 714/2018; Codul fiscal art. 76 alin. (2) lit. k)'),
  ('2023-04-01', 23, 2.5, 3, 'HG 714/2018 actualizat prin Ordinul 1235/2023; Codul fiscal art. 76 alin. (2) lit. k)');

-- =====================================================================================
-- 2. per_diem_policies — diurna externă fixă, opțională
-- =====================================================================================
alter table public.per_diem_policies
  add column diurna_externa_zi numeric(14,2),
  add column moneda_diurna_externa char(3),
  add constraint per_diem_policies_externa_ck check (
    (diurna_externa_zi is null and moneda_diurna_externa is null)
    or (diurna_externa_zi >= 0 and moneda_diurna_externa ~ '^[A-Z]{3}$')
  );

comment on column public.per_diem_policies.diurna_externa_zi is
  'Suma fixă pe zi pentru străinătate, în moneda_diurna_externa. NULL = baremul țării × multiplu_diurna_externa.';

-- =====================================================================================
-- 3. Valorile legale se impun, nu se aleg
-- =====================================================================================
create or replace function internal.aplica_valori_legale_diurna()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lege public.per_diem_valori_legale;
begin
  select * into v_lege
  from public.per_diem_valori_legale l
  where l.deleted_at is null and l.valabil_de_la <= new.valabil_de_la
  order by l.valabil_de_la desc
  limit 1;

  if v_lege.id is null then
    raise exception 'Nu există valori legale de diurnă încărcate pentru data de %. Alegeți o dată mai recentă.',
      to_char(new.valabil_de_la, 'DD.MM.YYYY') using errcode = 'P0001';
  end if;

  new.diurna_baza_legala_interna := v_lege.diurna_baza_legala_interna;
  new.multiplu_plafon_neimpozabil := v_lege.multiplu_plafon_neimpozabil;
  new.plafon_salarii_baza_luna := v_lege.plafon_salarii_baza_luna;
  return new;
end;
$$;

create trigger trg_aplica_valori_legale_diurna
  before insert or update on public.per_diem_policies
  for each row execute function internal.aplica_valori_legale_diurna();

revoke all on function internal.aplica_valori_legale_diurna() from public, anon, authenticated;

-- =====================================================================================
-- 4. app.recalculeaza_diurna — suma externă fixă
--    Identică cu 0015, cu excepția ramurii „țară străină".
-- =====================================================================================
create or replace function app.recalculeaza_diurna(p_trip_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip public.business_trips;
  v_pol public.per_diem_policies;
  v_etape jsonb;
  v_rand record;
  v_barem record;
  v_val_zi numeric;
  v_plafon_zi numeric;
  v_moneda char(3);
  v_curs numeric;
  v_zile numeric := 0;
  v_lei numeric := 0;
  v_plafon_lei numeric := 0;
  v_lipsa_curs boolean := false;
  v_detalii jsonb := '[]'::jsonb;
  v_calc_id uuid;
begin
  select * into v_trip from public.business_trips where id = p_trip_id and deleted_at is null;
  if not found then
    raise exception 'Deplasarea nu a fost găsită sau a fost ștearsă.' using errcode = 'P0001';
  end if;

  if not app.poate_accesa_deplasare(v_trip.organization_id, v_trip.employee_id, 'read') then
    raise exception 'Nu aveți dreptul să vedeți sau să recalculați această deplasare.' using errcode = 'P0001';
  end if;

  select * into v_pol from app.per_diem_politica(v_trip.organization_id, v_trip.plecare_la::date);
  if v_pol.id is null then
    raise exception 'Nu există o politică de diurnă valabilă la data plecării. Configurați politica firmei înainte de calcul.'
      using errcode = 'P0001';
  end if;

  with l as (
    select ordine, from_country_id, to_country_id, sosire_la
    from public.business_trip_legs
    where business_trip_id = p_trip_id and deleted_at is null
  ),
  puncte as (
    select v_trip.plecare_la as de_la,
           coalesce((select from_country_id from l order by ordine limit 1),
                    v_trip.country_id,
                    v_pol.country_id_intern) as country_id
    union all
    select sosire_la, to_country_id from l
  )
  select coalesce(jsonb_agg(jsonb_build_object('de_la', de_la, 'country_id', country_id) order by de_la), '[]'::jsonb)
  into v_etape
  from puncte
  where country_id is not null;

  for v_rand in
    select *
    from app.calculeaza_zile_diurna(
      coalesce(v_trip.plecare_efectiva_la, v_trip.plecare_la),
      coalesce(v_trip.sosire_efectiva_la, v_trip.sosire_la),
      v_pol.prag_ore_minim,
      v_pol.prag_ore_zi_intreaga,
      v_pol.fractiune_zi_partiala,
      v_pol.acorda_diurna_ziua_trecerii,
      v_pol.regula_tara_trecere,
      v_pol.categorie_barem,
      coalesce(v_trip.country_id, v_pol.country_id_intern),
      v_etape
    )
  loop
    if v_rand.tara_id is not distinct from v_pol.country_id_intern then
      v_val_zi := v_pol.diurna_interna_zi;
      v_plafon_zi := v_pol.multiplu_plafon_neimpozabil * v_pol.diurna_baza_legala_interna;
      v_moneda := v_pol.moneda_interna;
    else
      select valoare, moneda into v_barem
      from app.per_diem_barem(v_rand.tara_id, v_pol.categorie_barem, v_rand.de_la::date);
      if v_barem.valoare is null then
        raise exception 'Lipsește baremul de diurnă pentru țara aleasă la data de %. Încărcați baremul oficial înainte de calcul.',
          to_char(v_rand.de_la, 'DD.MM.YYYY') using errcode = 'P0001';
      end if;
      v_plafon_zi := v_barem.valoare * v_pol.multiplu_plafon_neimpozabil;
      v_moneda := v_barem.moneda;
      if v_pol.diurna_externa_zi is null then
        v_val_zi := v_barem.valoare * v_pol.multiplu_diurna_externa;
      elsif v_pol.moneda_diurna_externa = v_barem.moneda then
        v_val_zi := v_pol.diurna_externa_zi;
      else
        -- Suma firmei și plafonul legal sunt în monede diferite, iar deplasarea
        -- are un singur curs. Nu se inventează al doilea.
        v_val_zi := v_pol.diurna_externa_zi;
        v_moneda := v_pol.moneda_diurna_externa;
        v_lipsa_curs := true;
      end if;
    end if;

    v_curs := case when v_moneda = v_pol.moneda_interna then 1 else v_trip.curs_diurna end;
    v_zile := v_zile + v_rand.fractiune;

    if v_curs is null then
      v_lipsa_curs := true;
    else
      v_lei := v_lei + round(v_rand.fractiune * v_val_zi * v_curs, 2);
      v_plafon_lei := v_plafon_lei + round(v_rand.fractiune * v_plafon_zi * v_curs, 2);
    end if;

    v_detalii := v_detalii || jsonb_build_object(
      'fereastra', v_rand.numar_fereastra,
      'de_la', v_rand.de_la,
      'pana_la', v_rand.pana_la,
      'country_id', v_rand.tara_id,
      'fractiune', v_rand.fractiune,
      'valoare_zi', v_val_zi,
      'plafon_zi', v_plafon_zi,
      'moneda', v_moneda,
      'curs', v_curs,
      'motiv', v_rand.motiv
    );
  end loop;

  insert into public.per_diem_calculations as c (
    organization_id, business_trip_id, policy_id, calculat_la, zile_total,
    valoare_lei, plafon_neimpozabil_lei, parte_neimpozabila_lei, parte_impozabila_lei,
    curs_incomplet, detalii
  )
  values (
    v_trip.organization_id, v_trip.id, v_pol.id, now(), v_zile,
    case when v_lipsa_curs then null else v_lei end,
    case when v_lipsa_curs then null else v_plafon_lei end,
    case when v_lipsa_curs then null else least(v_lei, v_plafon_lei) end,
    case when v_lipsa_curs then null else greatest(v_lei - v_plafon_lei, 0) end,
    v_lipsa_curs, v_detalii
  )
  on conflict (business_trip_id) do update set
    policy_id = excluded.policy_id,
    calculat_la = excluded.calculat_la,
    zile_total = excluded.zile_total,
    valoare_lei = excluded.valoare_lei,
    plafon_neimpozabil_lei = excluded.plafon_neimpozabil_lei,
    parte_neimpozabila_lei = excluded.parte_neimpozabila_lei,
    parte_impozabila_lei = excluded.parte_impozabila_lei,
    curs_incomplet = excluded.curs_incomplet,
    detalii = excluded.detalii,
    updated_at = now()
  returning c.id into v_calc_id;

  return v_calc_id;
end;
$$;

revoke all on function app.recalculeaza_diurna(uuid) from public, anon;
grant execute on function app.recalculeaza_diurna(uuid) to authenticated, service_role;
