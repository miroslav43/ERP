-- supabase/migrations/0167_pontaj_recupereaza_saptamanile_aprobate.sql
--
-- SĂPTĂMÂNILE APROBATE CARE N-AU AJUNS NICIODATĂ ÎN PONTAJ.
--
-- ── DE UNDE VINE MIGRAREA ───────────────────────────────────────────────────
-- Reclamat pe 6 oct 2026: un angajat cu planul săptămânii 12–18 oct APROBAT
-- (14, 15, 16 cu 08:30–17:00) nu apărea în foaia de prezență pe acele zile.
-- Foaia citește `attendance_entries`; planul aprobat nu ajunsese acolo, pe două
-- drumuri:
--
--   1. Săptămâni aprobate ÎNAINTE ca `scriePontajulSaptamanii` (0138) să ajungă
--      în producție — 10 sept 2026, 21:13–21:39 ora României. 0138 a spus
--      explicit „nimic retroactiv: se refac prin retrimitere", dar o săptămână
--      aprobată NU se mai poate retrimite (0133:116), deci n-aveau cum.
--   2. Săptămâni aprobate de TRIGGER, nu de un om: cine n-are niciun aprobator
--      deasupra (`pas_fara_destinatar`, 0118 — patronul) primea săptămâna
--      aprobată în clipa trimiterii, iar `scriePontajulSaptamanii` se chema doar
--      din decizia unui manager. Codul e reparat în același commit
--      (`trimiteSaptamanaPontaj`); migrarea reface ce a rămas în urmă.
--
-- ── CE SCRIE ───────────────────────────────────────────────────────────────
-- Pentru fiecare submisie `aprobata`, zilele cu interval COMPLET și fără niciun
-- rând activ în pontaj — exact regula din `scriePontajulSaptamanii`: nu calcă
-- nicio zi existentă, oricare i-ar fi sursa. Rândurile sosesc aprobate, cu
-- momentul și autorul DECIZIEI (`decis_la`, `decis_de`), nu cu ale migrării.
--
-- ── CE NU SCRIE, INTENȚIONAT ───────────────────────────────────────────────
-- Orele se derivă aici în SQL, deci doar unde aritmetica e SIGURĂ că dă același
-- rezultat ca `oreleZilei` din TypeScript:
--   · ziua de lucru obișnuită — nu weekend, nu sărbătoare legală, nu zi liberă
--     sau de recuperare a firmei (tipul zilei schimbă sporul);
--   · intervalul în afara ferestrei de noapte (orele de noapte au altă
--     aritmetică, cu trecere peste miezul nopții);
--   · luna NEBLOCATĂ — o lună închisă pentru salarizare nu se rescrie;
--   · setările firmei existente la data săptămânii.
-- Ce rămâne pe dinafară se vede în NOTICE-ul de la final și se reface din ziua
-- respectivă, de mână.

begin;

do $$
declare
  v_scrise int;
  v_ramase int;
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
      st.ore_pe_zi,
      st.pauza_masa_minute,
      st.pauza_masa_inclusa_in_program,
      st.pauza_obligatorie_peste_ore,
      st.noapte_start,
      st.noapte_sfarsit,
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
    -- Aceeași aritmetică ca `oreleZilei` (src/domain/attendance/calcul-ore.ts):
    -- pauza se scade în MINUTE, doar când nu e inclusă în program și tura trece
    -- de prag, și nu poate scoate ziua sub zero; rotunjire o singură dată.
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
           d.decis_la, d.decis_de
      from derivate d
    returning 1
  )
  select count(*) into v_scrise from inserate;

  -- Ce a rămas pe dinafară: aprobat, cu interval, fără rând — și neatins aici.
  select count(*) into v_ramase
    from public.attendance_week_submissions s
    join public.attendance_week_submission_days d on d.submission_id = s.id
   where s.status = 'aprobata' and s.deleted_at is null
     and d.ora_inceput is not null and d.ora_sfarsit is not null
     and not exists (
       select 1 from public.attendance_entries a
        where a.organization_id = s.organization_id and a.employee_id = s.employee_id
          and a.data = d.data and a.deleted_at is null);

  raise notice '0167: % zile scrise în pontaj din săptămâni aprobate; % rămase de refăcut de mână.',
    v_scrise, v_ramase;
end
$$;

commit;

-- =====================================================================================
-- Note de proiectare
-- =====================================================================================
-- · Idempotentă: a doua rulare nu găsește nimic, fiindcă orice zi scrisă are
--   acum rând activ.
-- · Rulează ca proprietar, deci în context de serviciu: triggerul variantei
--   (0165) și cel al lunii blocate nu o opresc. Luna blocată e exclusă explicit
--   mai sus, tocmai de aceea.
