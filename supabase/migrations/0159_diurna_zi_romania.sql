-- supabase/migrations/0159_diurna_zi_romania.sql
--
-- DIURNA: ZIUA DIN CALENDARUL ROMÂNIEI, NU ZIUA UTC.
--
-- ── DE UNDE VINE MIGRAREA ───────────────────────────────────────────────────
-- Sesiunea Supabase rulează în UTC (`show timezone` = UTC, verificat 2 oct
-- 2026), deci `timestamptz::date` dă ziua UTC. O fereastră care începe la
-- miezul nopții de la București (21:00/22:00Z în ziua PRECEDENTĂ) își căuta
-- baremul cu o zi mai devreme: la o schimbare de barem pe 1 ale lunii, ziua
-- întâi se plătea cu baremul vechi. La fel, o plecare între 00:00 și 03:00 ora
-- României alegea politica zilei anterioare.
--
-- ── CE SE SCHIMBĂ ───────────────────────────────────────────────────────────
-- Doar conversiile `::date` din apelurile `app.per_diem_barem` și
-- `app.per_diem_politica` devin `(… at time zone 'Europe/Bucharest')::date`.
-- Corpurile sunt copii byte-exacte ale versiunilor în vigoare:
--   app.calculeaza_zile_diurna           ← 0015_per_diem.sql
--   app.calculeaza_zile_diurna_calendar  ← 0156_diurna_zile_calendaristice.sql
--   app.recalculeaza_diurna              ← 0156_diurna_zile_calendaristice.sql
--   internal.valideaza_deplasare         ← 0155_aprobarea_deplasarii.sql
-- Triggerul de validare trebuie să aleagă politica pe ACEEAȘI zi ca recalcularea:
-- altfel o plecare la 00:30 pe 1 octombrie, cu politica începând pe 1 octombrie,
-- ar fi refuzată la salvare și acceptată la calcul.
--
-- Calculele deja stocate NU se recalculează aici: diferă doar pentru
-- deplasările cu o fereastră pe ziua schimbării baremului sau cu plecare între
-- 00:00 și 03:00, iar recalcularea trece prin acțiunea modulului.
--
-- Portul TypeScript (aceeași schimbare): `src/domain/per-diem/sume.ts`
-- (`laZiIso`) și `src/domain/per-diem/ferestre.ts`.

begin;

-- =====================================================================================
-- 1. Ferestrele de 24 de ore
-- =====================================================================================
create or replace function app.calculeaza_zile_diurna(
  p_plecare timestamptz,
  p_sosire timestamptz,
  p_prag_ore_minim numeric,
  p_prag_ore_zi_intreaga numeric,
  p_fractiune_partiala numeric,
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
  v_durata numeric;
  v_ferestre_intregi integer;
  v_rest numeric;
  v_total integer;
  v_i integer;
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

  v_durata := extract(epoch from (p_sosire - p_plecare)) / 3600.0;

  -- Sub pragul minim nu se acordă nimic: 22:00 → 06:00 (8 ore) înseamnă ZERO zile.
  if v_durata < p_prag_ore_minim then
    return;
  end if;

  v_ferestre_intregi := floor(v_durata / 24.0)::integer;
  v_rest := v_durata - (v_ferestre_intregi * 24.0);
  v_total := v_ferestre_intregi + case when v_rest > 0 then 1 else 0 end;

  for v_i in 1 .. v_total loop
    v_de_la := p_plecare + ((v_i - 1) * interval '24 hours');
    v_pana_la := least(p_plecare + (v_i * interval '24 hours'), p_sosire);

    if v_i <= v_ferestre_intregi then
      v_fr := 1;
      v_motiv := 'fereastră completă de 24 de ore';
    elsif v_rest >= p_prag_ore_zi_intreaga then
      v_fr := 1;
      v_motiv := 'restul depășește pragul pentru zi întreagă';
    elsif v_rest >= p_prag_ore_minim then
      v_fr := coalesce(p_fractiune_partiala, 0);
      v_motiv := 'restul se încadrează între pragul minim și pragul pentru zi întreagă';
    else
      v_fr := 0;
      v_motiv := 'restul este sub pragul minim';
    end if;

    select count(*) into v_nr_tari
    from app.per_diem_ore_pe_tara(p_etape, p_plecare, p_sosire, v_de_la, v_pana_la, p_tara_implicita);

    select o.country_id into v_tara
    from app.per_diem_ore_pe_tara(p_etape, p_plecare, p_sosire, v_de_la, v_pana_la, p_tara_implicita) o
    left join lateral app.per_diem_barem(o.country_id, p_categorie_barem, (v_de_la at time zone 'Europe/Bucharest')::date) b on true
    order by
      case p_regula_trecere when 'tara_plecare' then o.primul_moment end asc nulls last,
      case p_regula_trecere when 'tara_sosire' then o.ultimul_moment end desc nulls last,
      case p_regula_trecere when 'durata_maxima' then o.ore end desc nulls last,
      case p_regula_trecere when 'tara_cu_valoare_mai_mare' then b.valoare end desc nulls last,
      o.ore desc
    limit 1;

    v_tara := coalesce(v_tara, p_tara_implicita);

    -- Ziua trecerii frontierei se plătește O SINGURĂ dată, unei singure țări.
    if v_nr_tari > 1 then
      if coalesce(p_acorda_ziua_trecerii, true) then
        v_motiv := v_motiv || '; trecere de frontieră — ziua atribuită unei singure țări (' || p_regula_trecere::text || ')';
      else
        v_fr := 0;
        v_motiv := 'trecere de frontieră — politica firmei nu acordă diurnă în această zi';
      end if;
    end if;

    numar_fereastra := v_i;
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

revoke all on function app.calculeaza_zile_diurna(timestamptz, timestamptz, numeric, numeric, numeric, boolean, public.per_diem_border_rule, text, uuid, jsonb) from public, anon;
grant execute on function app.calculeaza_zile_diurna(timestamptz, timestamptz, numeric, numeric, numeric, boolean, public.per_diem_border_rule, text, uuid, jsonb) to authenticated, service_role;

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
    left join lateral app.per_diem_barem(o.country_id, p_categorie_barem, (v_de_la at time zone 'Europe/Bucharest')::date) b on true
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
-- 3. Recalcularea (politica și baremul pe ziua României)
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

  select * into v_pol from app.per_diem_politica(v_trip.organization_id, (v_trip.plecare_la at time zone 'Europe/Bucharest')::date);
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
      from app.per_diem_barem(v_rand.tara_id, v_pol.categorie_barem, (v_rand.de_la at time zone 'Europe/Bucharest')::date);
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

-- =====================================================================================
-- 4. Validarea deplasării: politica la data plecării, pe ziua României
--    (copie byte-exactă din 0155_aprobarea_deplasarii.sql; doar conversia de dată)
-- =====================================================================================
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

  if not exists (select 1 from app.per_diem_politica(new.organization_id, (new.plecare_la at time zone 'Europe/Bucharest')::date)) then
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
    -- Trimiterea (ciorna/respinsa → in_aprobare) e a deținătorului: o face
    -- `trimiteDeplasare`, cu `per_diem:update`. Doar stările de DECIZIE cer
    -- aprobator. 0146 punea și `in_aprobare` în listă — nimeni fără `approve`
    -- nu-și mai putea trimite deplasarea (0155, proba-aprobare-deplasare (1)).
    if new.status is distinct from old.status
       and (new.status in ('aprobata', 'respinsa', 'decontata')
            or (new.status = 'in_aprobare' and old.status not in ('ciorna', 'respinsa')))
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
