-- supabase/migrations/0169_pontaj_plasa_saptamani_aprobate.sql
--
-- PLASA ZILNICĂ: SĂPTĂMÂNA APROBATĂ CARE N-A AJUNS ÎN PONTAJ.
--
-- ── DE UNDE VINE MIGRAREA ───────────────────────────────────────────────────
-- Scrierea săptămânii aprobate în `attendance_entries` (`scriePontajulSaptamanii`)
-- e BEST-EFFORT prin construcție: aprobarea e deja înregistrată când se ajunge
-- acolo, iar o scriere căzută n-are voie s-o desfacă. Eșecul ajunge doar în
-- jurnalul serverului. Pe 6 oct 2026 s-a văzut cât costă: 21 de zile aprobate,
-- la doi angajați, lipseau din foaia de prezență — fără nicio urmă pe ecran
-- (0167 le-a refăcut). Cauzele de atunci sunt reparate în cod; plasa de aici
-- prinde orice drum viitor pe care nu-l știm încă.
--
-- ── CE FACE, ZILNIC ────────────────────────────────────────────────────────
-- 1. REFACE singură zilele pe care le poate deriva sigur în SQL — aceeași
--    regulă ca 0167: zi lucrătoare obișnuită, interval în afara nopții, lună
--    neblocată, setări existente. Aritmetica orelor e a lui `oreleZilei`.
-- 2. ANUNȚĂ administratorii firmei despre ce rămâne (weekend, sărbătoare, tură
--    de noapte, setări lipsă), o dată pe săptămână pentru aceeași submisie —
--    acolo orele cer judecata cuiva, nu o regulă.
--
-- ── CE SĂPTĂMÂNI SUNT „DATORATE" PONTAJULUI ───────────────────────────────
-- Exact cele pe care codul le scrie: firmă pe varianta săptămânală (0165), SAU
-- firmă care cere aprobare. La o firmă pe zi, FĂRĂ aprobare, săptămâna e plan
-- și rămâne plan — plasa nu o atinge. Rândurile sosesc aprobate (cu
-- `decis_la`/`decis_de`) doar când firma cere aprobare, ca în cod.
--
-- Doar săptămâni decise de mai mult de o oră: acțiunea scrie în aceeași
-- secundă cu decizia, iar plasa nu trebuie să se ia la întrecere cu ea.

begin;

-- =====================================================================================
-- 1. Funcția
-- =====================================================================================

create or replace function internal.recupereaza_saptamani_fara_pontaj()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scrise int;
begin
  with candidati as (
    select
      s.organization_id,
      s.employee_id,
      d.data,
      d.ora_inceput,
      d.ora_sfarsit,
      d.tip_prezenta,
      d.observatii,
      s.decis_la,
      s.decis_de,
      internal.pontaj_necesita_aprobare(s.organization_id) as necesita_aprobare,
      st.ore_pe_zi,
      st.pauza_masa_minute,
      st.pauza_masa_inclusa_in_program,
      st.pauza_obligatorie_peste_ore,
      round(extract(epoch from (d.ora_sfarsit - d.ora_inceput)) / 60)::int as minute_brut
    from public.attendance_week_submissions s
    join public.attendance_week_submission_days d on d.submission_id = s.id
    cross join lateral (
      select x.*
        from public.attendance_settings x
       where x.organization_id = s.organization_id
         and x.valabil_de_la <= s.saptamana_start
         and x.deleted_at is null
       order by x.valabil_de_la desc
       limit 1
    ) st
    where s.status = 'aprobata'
      and s.deleted_at is null
      and s.decis_la < now() - interval '1 hour'
      and app.feature_on(s.organization_id, 'attendance')
      and (internal.pontaj_varianta(s.organization_id) = 'saptamanal'
           or internal.pontaj_necesita_aprobare(s.organization_id))
      and d.ora_inceput is not null
      and d.ora_sfarsit is not null
      and d.ora_sfarsit > d.ora_inceput
      and extract(isodow from d.data) between 1 and 5
      and d.ora_inceput >= st.noapte_sfarsit
      and d.ora_sfarsit <= st.noapte_start
      and not exists (
        select 1 from public.attendance_entries a
         where a.organization_id = s.organization_id
           and a.employee_id = s.employee_id
           and a.data = d.data
           and a.deleted_at is null)
      and not exists (
        select 1 from public.public_holidays h
         where h.tara = 'RO' and h.data = d.data and h.deleted_at is null)
      and not exists (
        select 1 from public.organization_holidays h
         where h.organization_id = s.organization_id and h.data = d.data
           and h.deleted_at is null)
      and not exists (
        select 1 from public.attendance_periods p
         where p.organization_id = s.organization_id
           and p.an = extract(year from d.data)
           and p.luna = extract(month from d.data)
           and p.status = 'blocata'
           and p.deleted_at is null)
  ),
  derivate as (
    -- Aritmetica lui `oreleZilei` (src/domain/attendance/calcul-ore.ts).
    select c.*,
           case
             when not c.pauza_masa_inclusa_in_program
                  and c.minute_brut / 60.0 > c.pauza_obligatorie_peste_ore
             then least(c.pauza_masa_minute, c.minute_brut)
             else 0
           end as minute_pauza
      from candidati c
  ),
  inserate as (
    insert into public.attendance_entries
      (organization_id, period_id, employee_id, data, ora_inceput, ora_sfarsit,
       ore_lucrate, ore_suplimentare, ore_noapte, tip_zi, tip_prezenta, observatii,
       sursa, approved_at, approved_by)
    select d.organization_id,
           -- Inert: `internal.pontaj_intrare_pregateste` îl suprascrie.
           '00000000-0000-0000-0000-000000000000'::uuid,
           d.employee_id, d.data, d.ora_inceput, d.ora_sfarsit,
           round((d.minute_brut - d.minute_pauza) / 60.0, 2),
           greatest(0, round((d.minute_brut - d.minute_pauza) / 60.0 - d.ore_pe_zi, 2)),
           0,
           'lucratoare',
           d.tip_prezenta, d.observatii,
           'saptamana',
           case when d.necesita_aprobare then d.decis_la end,
           case when d.necesita_aprobare then d.decis_de end
      from derivate d
    -- Două rulări suprapuse (job + manual) n-au voie să cadă pe indexul unic.
    on conflict do nothing
    returning 1
  )
  select count(*) into v_scrise from inserate;

  -- Ce rămâne: anunțat administratorilor firmei, o dată pe săptămână pe submisie.
  insert into public.notifications
    (organization_id, user_id, kind, title, body, link, entity_type, entity_id)
  select distinct r.organization_id, m.user_id, 'warning'::public.notification_kind,
         'Săptămână aprobată fără pontaj',
         'Săptămâna din ' || to_char(r.saptamana_start, 'DD.MM.YYYY') || ' a lui '
           || r.nume || ' e aprobată, dar ' || r.zile::text
           || ' zile n-au ajuns în pontaj (weekend, sărbătoare, noapte sau setări lipsă). '
           || 'Completați-le din foaia colectivă.',
         '/pontaj',
         'attendance_week_submission_fara_pontaj', r.submission_id
    from (
      select s.id as submission_id, s.organization_id, s.saptamana_start,
             coalesce(nullif(trim(e.first_name || ' ' || e.last_name), ''), e.marca) as nume,
             count(*) as zile
        from public.attendance_week_submissions s
        join public.attendance_week_submission_days d on d.submission_id = s.id
        join public.employees e on e.id = s.employee_id
       where s.status = 'aprobata'
         and s.deleted_at is null
         and s.decis_la < now() - interval '1 hour'
         and app.feature_on(s.organization_id, 'attendance')
         and (internal.pontaj_varianta(s.organization_id) = 'saptamanal'
              or internal.pontaj_necesita_aprobare(s.organization_id))
         and d.ora_inceput is not null
         and d.ora_sfarsit is not null
         and not exists (
           select 1 from public.attendance_entries a
            where a.organization_id = s.organization_id
              and a.employee_id = s.employee_id
              and a.data = d.data
              and a.deleted_at is null)
         and not exists (
           select 1 from public.attendance_periods p
            where p.organization_id = s.organization_id
              and p.an = extract(year from d.data)
              and p.luna = extract(month from d.data)
              and p.status = 'blocata'
              and p.deleted_at is null)
       group by s.id, s.organization_id, s.saptamana_start, e.first_name, e.last_name, e.marca
    ) r
    join public.organization_members m
      on m.organization_id = r.organization_id
     and m.role = 'org_admin'
     and m.deleted_at is null
   where not exists (
     select 1 from public.notifications n
      where n.user_id = m.user_id
        and n.entity_type = 'attendance_week_submission_fara_pontaj'
        and n.entity_id = r.submission_id
        and n.created_at > now() - interval '7 days');

  return v_scrise;
end;
$$;

comment on function internal.recupereaza_saptamani_fara_pontaj() is
  'Plasa zilnică (0169): reface în pontaj zilele sigure ale săptămânilor aprobate '
  'care n-au ajuns acolo și anunță administratorii despre rest. Întoarce câte '
  'zile a scris.';

revoke all on function internal.recupereaza_saptamani_fara_pontaj() from public, anon, authenticated;

-- =====================================================================================
-- 2. Programarea
-- =====================================================================================
-- 03:30 UTC — noaptea, după ce s-au încheiat aprobările zilei și înaintea
-- mementourilor de dimineață (`pontaj-perioada-nedeschisa`, 08:00 UTC).
-- Garda pentru `postgres:17-alpine` (bancul, CI), unde pg_cron nu există —
-- același tipar ca 0103.
do $do$
begin
  if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema cron;
    perform cron.schedule(
      'pontaj-saptamani-fara-pontaj',
      '30 3 * * *',
      $job$select internal.recupereaza_saptamani_fara_pontaj();$job$
    );
  else
    raise warning 'pg_cron nu este disponibil (Postgres gol / CI). Jobul "pontaj-saptamani-fara-pontaj" NU a fost programat. Pe Supabase se programează normal.';
  end if;
end
$do$;

commit;

-- =====================================================================================
-- Note de proiectare
-- =====================================================================================
-- · Idempotentă: o zi scrisă are rând activ, deci nu mai e candidată.
-- · Rulează ca proprietar (cron), deci în context de serviciu: triggerul
--   variantei (0165) și cel al lunii blocate nu o opresc. Luna blocată e exclusă
--   explicit, de aceea, și la reparație, și la anunț.
-- · `cron.schedule` cu același nume REPROGRAMEAZĂ jobul, nu-l dublează.
