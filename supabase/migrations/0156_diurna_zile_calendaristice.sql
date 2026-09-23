-- supabase/migrations/0156_diurna_zile_calendaristice.sql
--
-- DIURNA PE ZILE DIN CALENDAR.
--
-- ── DE UNDE VINE MIGRAREA ───────────────────────────────────────────────────
-- O deplasare 28.09 15:00 → 01.10 21:00 ieșea 3 zile: trei ferestre de câte 24
-- de ore de la plecare, iar restul de 6 ore, sub pragul de 12, nu primea nimic.
-- Omul e însă pe drum în patru zile din calendar, inclusiv ziua întoarcerii.
-- Multe firme plătesc așa; pentru un angajator privat e regulament intern.
--
-- ── CE SE SCHIMBĂ ───────────────────────────────────────────────────────────
--   1. `per_diem_policies.mod_calcul_zile`: `ferestre_24h` (implicit — nicio
--      politică existentă nu-și schimbă calculul) sau `zile_calendaristice`.
--   2. `app.calculeaza_zile_diurna_calendar`: fiecare zi din calendar (ora
--      României) atinsă de deplasare e o fereastră cu fracțiunea 1. Pragul
--      minim se aplică doar duratei TOTALE. Țara și ziua trecerii frontierei se
--      aleg exact ca în `calculeaza_zile_diurna`.
--   3. `app.recalculeaza_diurna` alege funcția după modul politicii. Copie a
--      versiunii din 0147, schimbată doar la sursa buclei.
--
-- Portul TypeScript: `src/domain/per-diem/ferestre.ts` (`zileCalendaristice`).

begin;

-- =====================================================================================
-- 1. Modul de calcul, pe politică
-- =====================================================================================
create type public.per_diem_mod_calcul_zile as enum ('ferestre_24h', 'zile_calendaristice');

alter table public.per_diem_policies
  add column mod_calcul_zile public.per_diem_mod_calcul_zile not null default 'ferestre_24h';

comment on column public.per_diem_policies.mod_calcul_zile is
  'ferestre_24h = câte 24 de ore de la plecare, restul tăiat de praguri; '
  'zile_calendaristice = fiecare zi din calendar (Europe/Bucharest) pe drum se plătește întreagă.';

-- =====================================================================================
-- 2. Zilele din calendar
-- =====================================================================================
create or replace function app.calculeaza_zile_diurna_calendar(
  p_plecare timestamptz,
  p_sosire timestamptz,
  p_prag_ore_minim numeric,
  p_acorda_ziua_trecerii boolean,
  p_regula_trecere public.per_diem_border_rule,
  p_categorie_barem text,
  p_tara_implicita uuid,
  p_etape jsonb default '[]'::jsonb
)
returns table (
  numar_fereastra integer,
  de_la timestamptz,
  pana_la timestamptz,
  tara_id uuid,
  fractiune numeric,
  ore_fereastra numeric,
  motiv text
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_zi date;
  v_nr integer := 0;
  v_de_la timestamptz;
  v_pana_la timestamptz;
  v_fr numeric;
  v_motiv text;
  v_tara uuid;
  v_nr_tari integer;
begin
  if p_plecare is null or p_sosire is null or p_sosire <= p_plecare then
    return;
  end if;

  -- Pragul minim, pe durata totală: 22:00 → 06:00 (8 ore) înseamnă ZERO zile.
  if extract(epoch from (p_sosire - p_plecare)) / 3600.0 < p_prag_ore_minim then
    return;
  end if;

  for v_zi in
    select g::date
    from generate_series(
      (p_plecare at time zone 'Europe/Bucharest')::date,
      (p_sosire at time zone 'Europe/Bucharest')::date,
      interval '1 day'
    ) g
  loop
    v_de_la := greatest(p_plecare, v_zi::timestamp at time zone 'Europe/Bucharest');
    v_pana_la := least(p_sosire, (v_zi + 1)::timestamp at time zone 'Europe/Bucharest');
    -- Sosirea fix la miezul nopții nu deschide o zi nouă.
    continue when v_pana_la <= v_de_la;

    v_nr := v_nr + 1;
    v_fr := 1;
    v_motiv := 'zi din calendar pe drum';

    select count(*) into v_nr_tari
    from app.per_diem_ore_pe_tara(p_etape, p_plecare, p_sosire, v_de_la, v_pana_la, p_tara_implicita);

    select o.country_id into v_tara
    from app.per_diem_ore_pe_tara(p_etape, p_plecare, p_sosire, v_de_la, v_pana_la, p_tara_implicita) o
    left join lateral app.per_diem_barem(o.country_id, p_categorie_barem, v_de_la::date) b on true
    order by
      case p_regula_trecere when 'tara_plecare' then o.primul_moment end asc nulls last,
      case p_regula_trecere when 'tara_sosire' then o.ultimul_moment end desc nulls last,
      case p_regula_trecere when 'durata_maxima' then o.ore end desc nulls last,
      case p_regula_trecere when 'tara_cu_valoare_mai_mare' then b.valoare end desc nulls last,
      o.ore desc
    limit 1;

    v_tara := coalesce(v_tara, p_tara_implicita);

    if v_nr_tari > 1 then
      if coalesce(p_acorda_ziua_trecerii, true) then
        v_motiv := v_motiv || '; trecere de frontieră — ziua atribuită unei singure țări (' || p_regula_trecere::text || ')';
      else
        v_fr := 0;
        v_motiv := 'trecere de frontieră — politica firmei nu acordă diurnă în această zi';
      end if;
    end if;

    numar_fereastra := v_nr;
    de_la := v_de_la;
    pana_la := v_pana_la;
    tara_id := v_tara;
    fractiune := v_fr;
    ore_fereastra := extract(epoch from (v_pana_la - v_de_la)) / 3600.0;
    motiv := v_motiv;
    return next;
  end loop;
end;
$$;

revoke all on function app.calculeaza_zile_diurna_calendar(timestamptz, timestamptz, numeric, boolean, public.per_diem_border_rule, text, uuid, jsonb) from public, anon;
grant execute on function app.calculeaza_zile_diurna_calendar(timestamptz, timestamptz, numeric, boolean, public.per_diem_border_rule, text, uuid, jsonb) to authenticated, service_role;

-- =====================================================================================
-- 3. Recalcularea alege funcția după politică
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
    select z.*
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
    ) z
    where v_pol.mod_calcul_zile = 'ferestre_24h'
    union all
    select c.*
    from app.calculeaza_zile_diurna_calendar(
      coalesce(v_trip.plecare_efectiva_la, v_trip.plecare_la),
      coalesce(v_trip.sosire_efectiva_la, v_trip.sosire_la),
      v_pol.prag_ore_minim,
      v_pol.acorda_diurna_ziua_trecerii,
      v_pol.regula_tara_trecere,
      v_pol.categorie_barem,
      coalesce(v_trip.country_id, v_pol.country_id_intern),
      v_etape
    ) c
    where v_pol.mod_calcul_zile = 'zile_calendaristice'
    order by 1
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

commit;
