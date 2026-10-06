-- supabase/migrations/0166_pontaj_saptamanal_fara_portita_concediu.sql
--
-- GARDA VARIANTEI SĂPTĂMÂNALE (0165) NU MAI CREDE `leave_request_id`.
--
-- ── DEFECTUL ────────────────────────────────────────────────────────────────
-- `internal.pontaj_doar_pe_saptamana` (0165) lăsa să treacă orice rând cu
-- `leave_request_id is not null`, ca retragerea unui concediu să-și poată șterge
-- zilele. Dar coloana o scrie CLIENTUL: politica de INSERT (0013:785) nu spune
-- nimic despre ea, FK-ul simplu (0013:146) se verifică fără RLS și fără
-- organizație, iar CHECK-ul (0013:159) merge într-un singur sens. Un angajat
-- își scria deci ziua prin PostgREST, cu 12 ore, punând id-ul oricărei cereri
-- de concediu — chiar al ALTEI firme. Găsit pe banc de revizia adversarială,
-- înainte de primul commit al variantei.
--
-- ── REPARAȚIA ──────────────────────────────────────────────────────────────
-- · INSERT: scutit doar `sursa = 'sincronizare_concedii'` — pe care politica de
--   INSERT o rezervă deja lui `attendance:create = all`.
-- · UPDATE pe un rând de concediu: scutită DOAR ștergerea lui logică, cu restul
--   conținutului neatins — exact ce face `internal.leave_requests_retrage_pontajul`
--   (0079). Orele unei zile de concediu nu le schimbă nimeni de aici.
-- · `leave_request_id` intră în lista CONȚINUTULUI comparat la UPDATE, ca o
--   decizie de manager să nu poată căra și o schimbare a lui.
--
-- În aceeași migrare (§2): mementoul de vineri cere, în varianta săptămânală,
-- pontajul săptămânii curente — nu planul celei viitoare, pe care aplicația îl
-- refuză acum.

begin;

create or replace function internal.pontaj_doar_pe_saptamana()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if app.is_service_context() then
    return new;
  end if;

  if internal.pontaj_varianta(new.organization_id) <> 'saptamanal' then
    return new;
  end if;

  if app.can(new.organization_id, 'attendance', 'create', 'all') then
    return new;
  end if;

  -- Rândul de concediu, la naștere: RLS îl permite doar cu `create = all`, deci
  -- aici ajunge doar dacă politica a decis deja că e legitim.
  if tg_op = 'INSERT' and new.sursa = 'sincronizare_concedii' then
    return new;
  end if;

  -- Retragerea concediului (0079): ștergere logică, nimic altceva.
  if tg_op = 'UPDATE'
     and old.sursa = 'sincronizare_concedii'
     and old.deleted_at is null
     and new.deleted_at is not null
     and (old.employee_id, old.data, old.ora_inceput, old.ora_sfarsit, old.ore_lucrate,
          old.ore_suplimentare, old.ore_noapte, old.tip_zi, old.tip_prezenta, old.observatii,
          old.sursa, old.punct_lucru_id, old.punct_lucru_declarat_id, old.leave_request_id)
         is not distinct from
         (new.employee_id, new.data, new.ora_inceput, new.ora_sfarsit, new.ore_lucrate,
          new.ore_suplimentare, new.ore_noapte, new.tip_zi, new.tip_prezenta, new.observatii,
          new.sursa, new.punct_lucru_id, new.punct_lucru_declarat_id, new.leave_request_id)
  then
    return new;
  end if;

  -- Doar decizia s-a schimbat: aprobare, respingere, lot. Lista e a CONȚINUTULUI
  -- zilei; `approved_*`, `respins_*`, `motiv_respingere`, `batch_id` și
  -- `updated_*` lipsesc din ea intenționat.
  if tg_op = 'UPDATE'
     and (old.employee_id, old.data, old.ora_inceput, old.ora_sfarsit, old.ore_lucrate,
          old.ore_suplimentare, old.ore_noapte, old.tip_zi, old.tip_prezenta, old.observatii,
          old.sursa, old.punct_lucru_id, old.punct_lucru_declarat_id, old.leave_request_id,
          old.deleted_at)
         is not distinct from
         (new.employee_id, new.data, new.ora_inceput, new.ora_sfarsit, new.ore_lucrate,
          new.ore_suplimentare, new.ore_noapte, new.tip_zi, new.tip_prezenta, new.observatii,
          new.sursa, new.punct_lucru_id, new.punct_lucru_declarat_id, new.leave_request_id,
          new.deleted_at)
  then
    return new;
  end if;

  raise exception 'Firma se pontează pe săptămână: completați fișa săptămânii, nu ziua.'
    using errcode = 'P0001';
end;
$$;

comment on function internal.pontaj_doar_pe_saptamana() is
  'În varianta `saptamanal` (0165/0166), refuză scrierea de mână a unei zile de '
  'pontaj. Lasă să treacă serviciul, `attendance:create = all`, nașterea și '
  'ștergerea logică a rândurilor de concediu și UPDATE-urile care ating doar '
  'decizia. `leave_request_id` NU mai e o scutire: îl scrie clientul.';

revoke all on function internal.pontaj_doar_pe_saptamana() from public, anon;

-- =====================================================================================
-- 2. Mementoul de vineri, pe varianta firmei
-- =====================================================================================
-- Corpul din 0042 cerea, oricărei firme, „planul pentru săptămâna VIITOARE".
-- În varianta săptămânală, foaia e pontaj — declară ce s-a lucrat — iar
-- `trimiteSaptamanaPontaj` refuză tocmai săptămâna viitoare. Mementoul trimitea
-- deci omul să facă exact ce aplicația nu-l lasă. Acum: varianta zilnică
-- neschimbată, varianta săptămânală cere săptămâna CURENTĂ, cât timp nu e
-- trimisă (o ciornă nu contează drept trimisă).

create or replace function internal.verifica_pontaj_saptamanal_restante()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_azi          date := current_date;
  v_dow          int := extract(dow from v_azi)::int; -- 0=duminică … 6=sâmbătă, ca JS getUTCDay()
  v_luni         date := v_azi + (case when v_dow = 0 then 1 else 8 - v_dow end);
  v_luni_curenta date := v_azi - (extract(isodow from v_azi)::int - 1);
begin
  if extract(isodow from v_azi) >= 5 then
    -- Varianta zilnică: planul săptămânii viitoare, ca în 0042.
    insert into public.notifications
      (organization_id, user_id, kind, title, body, link, entity_type, entity_id)
    select e.organization_id, e.user_id, 'reminder'::public.notification_kind,
           'Completați planul pentru săptămâna viitoare',
           'Nu ați trimis încă planul de prezență pentru săptămâna din ' || to_char(v_luni, 'DD.MM.YYYY') || '.',
           '/pontaj/saptamana',
           'attendance_week_submission_missing', e.id
      from public.employees e
     where e.deleted_at is null
       and e.status = 'activ'
       and e.user_id is not null
       and app.feature_on(e.organization_id, 'attendance')
       and internal.pontaj_varianta(e.organization_id) = 'zilnic'
       and not exists (
         select 1 from public.attendance_week_submissions s
          where s.employee_id = e.id and s.saptamana_start = v_luni and s.deleted_at is null
       )
       and not exists (
         select 1 from public.notifications n
          where n.user_id = e.user_id and n.entity_type = 'attendance_week_submission_missing'
            and n.entity_id = e.id and n.created_at > now() - interval '3 days'
       );

    -- Varianta săptămânală (0165): pontajul săptămânii care se încheie.
    insert into public.notifications
      (organization_id, user_id, kind, title, body, link, entity_type, entity_id)
    select e.organization_id, e.user_id, 'reminder'::public.notification_kind,
           'Completați pontajul săptămânii',
           'Nu ați trimis încă pontajul pentru săptămâna din ' || to_char(v_luni_curenta, 'DD.MM.YYYY') || '.',
           '/pontaj/saptamana',
           'attendance_week_submission_missing', e.id
      from public.employees e
     where e.deleted_at is null
       and e.status = 'activ'
       and e.user_id is not null
       and app.feature_on(e.organization_id, 'attendance')
       and internal.pontaj_varianta(e.organization_id) = 'saptamanal'
       and not exists (
         select 1 from public.attendance_week_submissions s
          where s.employee_id = e.id and s.saptamana_start = v_luni_curenta
            and s.status in ('trimisa', 'aprobata') and s.deleted_at is null
       )
       and not exists (
         select 1 from public.notifications n
          where n.user_id = e.user_id and n.entity_type = 'attendance_week_submission_missing'
            and n.entity_id = e.id and n.created_at > now() - interval '3 days'
       );
  end if;

  insert into public.notifications
    (organization_id, user_id, kind, title, body, link, entity_type, entity_id)
  select distinct t.organization_id, t.approver_user_id, 'reminder'::public.notification_kind,
         case when internal.pontaj_varianta(t.organization_id) = 'saptamanal'
              then 'Pontaj săptămânal în așteptare'
              else 'Plan săptămânal în așteptare' end,
         case when internal.pontaj_varianta(t.organization_id) = 'saptamanal'
              then 'Un pontaj săptămânal așteaptă decizia dvs. de mai mult de 2 zile.'
              else 'Un plan de prezență așteaptă decizia dvs. de mai mult de 2 zile.' end,
         '/pontaj/aprobare',
         'attendance_week_submission', t.entity_id
    from public.approval_tasks t
   where t.entity_type = 'attendance_week_submission'
     and t.status = 'in_asteptare'
     and t.approver_user_id is not null
     and t.created_at < now() - interval '2 days'
     and t.deleted_at is null
     and not exists (
       select 1 from public.notifications n
        where n.user_id = t.approver_user_id and n.entity_type = 'attendance_week_submission'
          and n.entity_id = t.entity_id and n.created_at > now() - interval '2 days'
     );
end;
$$;

revoke all on function internal.verifica_pontaj_saptamanal_restante() from public, anon, authenticated;

commit;

-- =====================================================================================
-- Note de proiectare
-- =====================================================================================
-- · Triggerul rămâne același (`trg_attendance_entries_varianta`, 0165); se
--   înlocuiește doar corpul funcției.
-- · Referința către o cerere de concediu a ALTEI firme rămâne posibilă în
--   varianta zilnică, unde garda asta nu rulează — FK-ul simplu din 0013 e o
--   datorie separată, mai veche decât varianta. Aici se închide doar ocolirea.
