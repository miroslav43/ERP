-- supabase/migrations/0042_pontaj_saptamanal_notificari.sql
-- Notificări pentru planul săptămânal de pontaj (0041):
--   (1) la trimitere → notificare către aprobatori (manager direct/patron);
--   (2) la decizie → notificare către angajat;
--   (3) proactiv, zilnic (pg_cron): cine nu a trimis planul săptămânii
--       viitoare (verificat doar de vineri încolo) și planuri nedecise de
--       peste 2 zile — reamintire aprobatorilor.
--
-- pg_cron e disponibil ca extensie dar NEINSTALAT în acest proiect (verificat
-- cu `list_extensions`); `0008_expirables.sql` proiectase deja un job zilnic
-- de conformitate, dar `cron.schedule(...)` a rămas comentat, niciodată
-- programat cu adevărat — asta e prima activare reală a mecanismului.

---------------------------------------------------------------------------
-- 1. Extinde internal.attendance_week_submissions_trimite — notificare la
--    trimitere, către exact aceiași candidați cărora li se creează sarcina.
---------------------------------------------------------------------------

create or replace function internal.attendance_week_submissions_trimite()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_flow_id uuid;
  v_step_id uuid;
  v_n_cand integer;
begin
  if new.status = 'trimisa' and (tg_op = 'INSERT' or old.status is distinct from 'trimisa') then
    select s.id, s.flow_id into v_step_id, v_flow_id
      from public.approval_flows f
      join public.approval_steps s on s.flow_id = f.id and s.deleted_at is null
     where f.organization_id = new.organization_id and f.entity_type = 'attendance_week_submission'
       and f.activ and f.deleted_at is null
     order by s.ordine
     limit 1;

    if v_step_id is null then
      raise exception 'Fluxul de aprobare a pontajului săptămânal nu este configurat pentru această organizație.'
        using errcode = 'P0001';
    end if;

    with inseratii as (
      insert into public.approval_tasks
        (organization_id, flow_id, step_id, entity_type, entity_id, ordine,
         approver_user_id, approver_employee_id)
      select new.organization_id, v_flow_id, v_step_id, 'attendance_week_submission', new.id, 1,
             c.user_id, c.employee_id
        from internal.rezolva_aprobator_pontaj(new.organization_id, new.employee_id) c
      returning approver_user_id
    )
    select count(*) into v_n_cand from inseratii;

    if v_n_cand = 0 then
      -- Nimeni nu poate aproba — auto-aprobat, cu urmă explicită în audit,
      -- exact ca la concedii (0017, „pas fără destinatar”).
      update public.attendance_week_submissions
         set status = 'aprobata', decis_la = now()
       where id = new.id;
      perform app.write_audit('update', new.organization_id, 'attendance_week_submissions', new.id, null,
        jsonb_build_object('eveniment', 'pas_fara_destinatar', 'auto_aprobat', true));
    else
      insert into public.notifications
        (organization_id, user_id, kind, title, body, link, entity_type, entity_id)
      select new.organization_id, c.user_id, 'approval'::public.notification_kind,
             'Plan săptămânal de aprobat',
             'Un angajat a trimis planul de prezență pentru săptămâna din '
               || to_char(new.saptamana_start, 'DD.MM.YYYY') || '.',
             '/pontaj/aprobare',
             'attendance_week_submission', new.id
        from internal.rezolva_aprobator_pontaj(new.organization_id, new.employee_id) c
       where c.user_id is not null;
    end if;
  end if;
  return null;
end;
$$;

---------------------------------------------------------------------------
-- 2. Notificare la decizie — către angajat, la aprobare SAU respingere.
---------------------------------------------------------------------------

create or replace function internal.attendance_week_submissions_notifica_decizie()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid;
begin
  if old.status = 'trimisa' and new.status in ('aprobata', 'respinsa') then
    select e.user_id into v_user_id
      from public.employees e
     where e.id = new.employee_id and e.deleted_at is null;

    if v_user_id is not null then
      insert into public.notifications
        (organization_id, user_id, kind, title, body, link, entity_type, entity_id)
      values (
        new.organization_id, v_user_id, 'approval'::public.notification_kind,
        case when new.status = 'aprobata'
          then 'Planul săptămânal a fost aprobat'
          else 'Planul săptămânal a fost respins'
        end,
        case when new.status = 'aprobata'
          then 'Planul de prezență pentru săptămâna din ' || to_char(new.saptamana_start, 'DD.MM.YYYY') || ' a fost aprobat.'
          else coalesce('Motiv: ' || new.motiv_respingere, 'Planul de prezență a fost respins.')
        end,
        '/pontaj/saptamana',
        'attendance_week_submission', new.id
      );
    end if;
  end if;
  return null;
end;
$$;

revoke all on function internal.attendance_week_submissions_notifica_decizie() from public, anon, authenticated;

create trigger trg_attendance_week_submissions_notifica_decizie
  after update on public.attendance_week_submissions
  for each row execute function internal.attendance_week_submissions_notifica_decizie();

---------------------------------------------------------------------------
-- 3. Verificare zilnică — cine nu a trimis planul + planuri restante.
--    NU folosește app.can/app.has_permission: acelea citesc auth.uid(), care
--    e null într-un job programat — greșit pentru un angajat arbitrar.
---------------------------------------------------------------------------

create or replace function internal.verifica_pontaj_saptamanal_restante()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_azi  date := current_date;
  v_dow  int := extract(dow from v_azi)::int; -- 0=duminică … 6=sâmbătă, ca JS getUTCDay()
  v_luni date := v_azi + (case when v_dow = 0 then 1 else 8 - v_dow end);
begin
  if extract(isodow from v_azi) >= 5 then
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
       and not exists (
         select 1 from public.attendance_week_submissions s
          where s.employee_id = e.id and s.saptamana_start = v_luni and s.deleted_at is null
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
         'Plan săptămânal în așteptare',
         'Un plan de prezență așteaptă decizia dvs. de mai mult de 2 zile.',
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

comment on function internal.verifica_pontaj_saptamanal_restante() is
  'Job zilnic (pg_cron): reamintește angajaților fără plan trimis pentru săptămâna viitoare (doar vineri-duminică) și aprobatorilor cu planuri nedecise de peste 2 zile. Deduplicare prin verificarea notificărilor recente, nu printr-o tabelă nouă.';

---------------------------------------------------------------------------
-- 4. pg_cron — prima activare reală în acest proiect.
---------------------------------------------------------------------------

create extension if not exists pg_cron with schema cron;

select cron.schedule(
  'pontaj-saptamanal-restante',
  '0 7 * * *',
  $$select internal.verifica_pontaj_saptamanal_restante();$$
);
