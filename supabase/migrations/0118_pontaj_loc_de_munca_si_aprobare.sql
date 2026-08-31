-- supabase/migrations/0118_pontaj_loc_de_munca_si_aprobare.sql
--
-- Două lucruri care lipseau din pontajul REAL, deși existau în plan:
--   (1) locul de muncă al zilei — birou / acasă / deplasare / delegație;
--   (2) firma poate declara că pontajul NU trece prin aprobare.
--
-- ── (1) DE CE `tip_prezenta` ERA DOAR ÎN PLAN ───────────────────────────────
-- `attendance_presence_kind` există din 0041 și stă pe
-- `attendance_week_submission_days`, adică pe ce PLANIFICI. Pe
-- `attendance_entries` — ce ai lucrat efectiv — nu exista deloc. Consecința pe
-- ecran: alegi „homeoffice" când planifici săptămâna, iar când pontezi ziua
-- trăgând peste grila orară nu te întreabă nimeni, deci informația se pierde
-- exact la trecerea din intenție în fapt. Nicio raportare de telemuncă nu se
-- putea face din pontajul real.
--
-- Enumul se REFOLOSEȘTE, nu se dublează. Un al doilea vocabular („birou/acasă"
-- pe zi, patru trepte pe plan) ar fi însemnat că aceeași zi poate spune două
-- lucruri diferite, iar traducerea între ele n-ar fi avut unde să stea.
--
-- ── DE CE NULLABLE, FĂRĂ `default 'birou'` ─────────────────────────────────
-- Zilele deja pontate n-au declarat nimic. Un `default` pe `alter table` le-ar
-- fi făcut pe toate „la birou" retroactiv — o afirmație pe care n-a făcut-o
-- nimeni, și exact greșeala pe care o descrie 0115 despre `mod_pontare_rapida`:
-- valoarea de backfill se citește mai târziu drept alegere. NULL înseamnă
-- „nedeclarat" și se afișează ca atare; implicitul pentru o zi NOUĂ e o
-- constantă în cod (`birou`), unde se poate schimba fără migrare.
--
-- ── (2) DE CE APROBAREA SE STINGE SCOȚÂND PAȘI, NU ADĂUGÂND PRIVILEGII ──────
-- Politica de INSERT pe `attendance_entries` (0013:789) CERE
-- `approved_at is null and approved_by is null and batch_id is null`. Nimeni
-- nu-și poate ștampila propria zi ca aprobată — prin construcție, nu din
-- omisiune. Iar politica de UPDATE (0013:795) lasă modificările doar cât timp
-- `approved_at` e null.
--
-- Cele două împreună dau exact comportamentul cerut de o firmă fără aprobare:
-- ziua se salvează, rămâne salvată și rămâne EDITABILĂ. Deci setarea asta nu
-- atinge nicio politică și nu adaugă niciun drum de auto-aprobare pe zile —
-- scoate pașii de aprobare din flux și din ecran. Consecința bună: stingerea și
-- reaprinderea setării sunt simetrice, fiindcă în bază nu s-a ștampilat nimic
-- ireversibil.
--
-- Singurul flux care CHIAR are nevoie de o stare terminală e planul săptămânal:
-- `attendance_week_submissions.status` e un enum, iar `trimisa` înseamnă „în
-- așteptarea cuiva". Într-o firmă fără aprobare n-ar aștepta pe nimeni, la
-- infinit. De aceea triggerul de la §3 îl duce direct pe `aprobata`.
--
-- Forward-only: 0013, 0041, 0042, 0096 și 0115 nu se editează.

\set ON_ERROR_STOP on

begin;

-- =====================================================================================
-- 1. Locul de muncă pe ziua de pontaj real
-- =====================================================================================

alter table public.attendance_entries
  add column if not exists tip_prezenta public.attendance_presence_kind;

comment on column public.attendance_entries.tip_prezenta is
  'Unde s-a lucrat ziua: același enum ca planul săptămânal (0041), refolosit '
  'deliberat ca planul și faptul să vorbească aceeași limbă. NULL înseamnă '
  '„nedeclarat" — starea tuturor zilelor de dinainte de 0118 și a celor scrise '
  'de pontarea rapidă de pe telefon, unde omul apasă un buton, nu completează '
  'un formular. Nu are `default`: o valoare de backfill s-ar citi mai târziu '
  'drept alegerea cuiva. Implicitul pentru o zi nouă stă în aplicație.';

-- =====================================================================================
-- 2. Setarea: pontajul trece sau nu prin aprobare
-- =====================================================================================
-- Aici, nu în `attendance_settings`: e o setare OPERAȚIONALĂ, fără istoric
-- juridic. Nimeni nu recalculează martie din „se cerea aprobare atunci". Tabela
-- din 0115 e locul pentru exact felul ăsta de alegere — un rând per firmă,
-- rescris, salvat dintr-o apăsare.

alter table public.setari_pontare_rapida
  add column if not exists necesita_aprobare boolean not null default true;

comment on column public.setari_pontare_rapida.necesita_aprobare is
  'Dacă pontajul trece printr-un pas de aprobare. `true` (implicit, și valoarea '
  'pentru o firmă FĂRĂ rând) păstrează comportamentul de până la 0118: fila '
  '„Aprobare", decizia pe zi, aprobarea în bloc, planul săptămânal care '
  'așteaptă un manager. `false` le scoate pe toate — ziua salvată e ziua '
  'finală. Nu ștampilează `approved_at` pe nimic: politicile din 0013 țin ziua '
  'neaprobată EDITABILĂ, ceea ce e chiar comportamentul dorit, iar stingerea '
  'setării rămâne astfel reversibilă.';

comment on table public.setari_pontare_rapida is
  'Setările OPERAȚIONALE de pontaj ale unei firme: un rând per organizație, '
  'FĂRĂ valabil_de_la. Deliberat nevesionată — spre deosebire de '
  'attendance_settings, unde stau parametrii juridici, aici nu există nimic de '
  'reconstituit pentru o lună trecută. Numele tabelei vine de la primele trei '
  'coloane (0115, pontarea de pe telefon); din 0118 poartă și regula de '
  'aprobare. Lipsa rândului e o stare normală: aplicația cade pe implicitele '
  'din src/domain/attendance/pontare-rapida.ts, aceleași cu `default`-urile '
  'coloanelor.';

-- Sursa unică a regulii, pentru cele două triggere de mai jos. `internal`, nu
-- `app`: n-o cheamă nicio politică RLS și n-o cheamă nimeni din PostgREST, deci
-- nu are de ce să fie expusă. Implicitul pentru firma fără rând e scris O
-- SINGURĂ dată, aici — perechea lui în TypeScript e `IMPLICIT_PONTARE_RAPIDA`.
create or replace function internal.pontaj_necesita_aprobare(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select s.necesita_aprobare
       from public.setari_pontare_rapida s
      where s.organization_id = p_organization_id and s.deleted_at is null
      limit 1),
    true);
$$;

comment on function internal.pontaj_necesita_aprobare(uuid) is
  'Dacă firma cere aprobare pentru pontaj. `true` și când nu există rând de '
  'setări — o firmă care n-a configurat nimic păstrează fluxul de dinainte de '
  '0118.';

revoke all on function internal.pontaj_necesita_aprobare(uuid) from public, anon, authenticated;

-- =====================================================================================
-- 3. Planul săptămânal se auto-aprobă când firma nu cere aprobare
-- =====================================================================================
-- Rescrisă peste versiunea din 0042 (care adăugase notificările peste 0041).
-- Se schimbă UN singur lucru: ramura de la început. Restul — căutarea pasului,
-- P0001 pentru flux neconfigurat, sarcinile, auto-aprobarea „pas fără
-- destinatar" și notificările — rămâne literal ce era.
--
-- Ramura nouă e ÎNAINTEA căutării fluxului, nu după: într-o firmă fără aprobare
-- nu există motiv să existe un `approval_flow`, iar P0001-ul de mai jos ar
-- refuza atunci trimiterea planului cu un mesaj despre o configurare care nu-i
-- mai trebuie nimănui.

create or replace function internal.attendance_week_submissions_trimite()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_flow_id uuid;
  v_step_id uuid;
  v_n_cand integer;
begin
  if new.status = 'trimisa' and (tg_op = 'INSERT' or old.status is distinct from 'trimisa') then

    if not internal.pontaj_necesita_aprobare(new.organization_id) then
      -- Firma a stins aprobarea: planul e final în clipa trimiterii. Fără
      -- sarcini, fără notificări — n-are cui să i se ceară ceva.
      update public.attendance_week_submissions
         set status = 'aprobata', decis_la = now()
       where id = new.id;
      perform app.write_audit('update', new.organization_id, 'attendance_week_submissions', new.id, null,
        jsonb_build_object('eveniment', 'aprobare_dezactivata', 'auto_aprobat', true));
      return null;
    end if;

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

-- =====================================================================================
-- 4. Nici notificarea de decizie, când decizia n-a fost a nimănui
-- =====================================================================================
-- Auto-aprobarea de la §3 e un UPDATE `trimisa` → `aprobata`, deci trece prin
-- triggerul de mai jos exact ca o aprobare omenească. Fără garda asta, angajatul
-- unei firme fără aprobare ar primi, la fiecare plan trimis, un „Planul
-- săptămânal a fost aprobat" de la nimeni — zgomot care arată ca o decizie.
--
-- Garda e pe SETARE, nu pe `decis_de is null`: ramura „pas fără destinatar" din
-- 0042 lasă și ea `decis_de` gol, dar acolo notificarea e utilă — omul chiar
-- aștepta un răspuns și trebuie să afle că nu mai vine niciunul.

create or replace function internal.attendance_week_submissions_notifica_decizie()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid;
begin
  if old.status = 'trimisa' and new.status in ('aprobata', 'respinsa')
     and internal.pontaj_necesita_aprobare(new.organization_id) then
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

-- =====================================================================================
-- 5. Planul auto-aprobat rămâne EDITABIL
-- =====================================================================================
-- Fără secțiunea asta, §3 ar fi produs exact pe dos față de ce cere o firmă
-- fără aprobare: prima trimitere duce săptămâna pe `aprobata`, iar upsert-ul din
-- `trimite_saptamana_pontaj` (0084) are `where … status in ('ciorna',
-- 'trimisa', 'respinsa')`. Săptămâna s-ar fi ÎNGHEȚAT la prima apăsare, cu
-- mesajul „Săptămâna a fost deja aprobată și nu mai poate fi modificată" — o
-- explicație despre o aprobare care nu s-a întâmplat.
--
-- Garda rămâne întreagă acolo unde chiar apără ceva: într-o firmă CU aprobare, o
-- săptămână decisă nu se rescrie după decizie. Se ridică doar unde n-a decis
-- nimeni. Aceeași funcție decide, `internal.pontaj_necesita_aprobare`, ca la §3
-- și §4 — o a doua citire a coloanei ar fi putut ajunge să spună altceva.
--
-- `create or replace` cu semnătura NESCHIMBATĂ (6 argumente, 0084): o semnătură
-- nouă ar fi lăsat-o pe cea veche în bază, apelabilă, iar `grant`-urile ei ar fi
-- rămas pe amândouă.

create or replace function public.trimite_saptamana_pontaj(
  p_organization_id uuid,
  p_saptamana_start date,
  p_status public.attendance_week_status,
  p_zile jsonb,
  p_lucreaza_weekend boolean default false,
  p_employee_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_employee_id   uuid;
  v_submission_id uuid;
  v_zi            jsonb;
begin
  if p_status not in ('ciorna', 'trimisa') then
    raise exception 'Statusul trimis nu este permis la salvare.' using errcode = '22023';
  end if;
  if extract(isodow from p_saptamana_start) <> 1 then
    raise exception 'Săptămâna trebuie să înceapă luni.' using errcode = '22023';
  end if;
  if not app.feature_on(p_organization_id, 'attendance') then
    raise exception 'Modulul de pontaj nu este activ pentru această organizație.' using errcode = 'P0001';
  end if;

  v_employee_id := coalesce(p_employee_id, app.current_employee_id(p_organization_id));

  if p_employee_id is not null and not exists (
    select 1 from public.employees e
     where e.id = p_employee_id
       and e.organization_id = p_organization_id
       and e.deleted_at is null
  ) then
    raise exception 'Angajatul selectat nu aparține acestei organizații.' using errcode = 'P0001';
  end if;
  if v_employee_id is null then
    raise exception 'Nu s-a putut stabili pentru cine se completează săptămâna: contul dvs. nu are fișă de angajat principală în această organizație și nu ați ales un angajat.'
      using errcode = 'P0001';
  end if;
  if not app.poate_scrie_pontaj(p_organization_id, v_employee_id) then
    raise exception 'Nu aveți dreptul de a completa pontajul.' using errcode = '42501';
  end if;

  insert into public.attendance_week_submissions
    (organization_id, employee_id, saptamana_start, status, lucreaza_weekend, trimisa_la)
  values (
    p_organization_id, v_employee_id, p_saptamana_start, p_status,
    coalesce(p_lucreaza_weekend, false),
    case when p_status = 'trimisa' then now() else null end
  )
  on conflict (organization_id, employee_id, saptamana_start) where deleted_at is null
  do update set
    status = excluded.status,
    lucreaza_weekend = excluded.lucreaza_weekend,
    trimisa_la = excluded.trimisa_la,
    decis_de = null,
    decis_la = null,
    motiv_respingere = null,
    updated_at = now()
  -- SINGURA schimbare față de 0084: a doua ramură. Într-o firmă fără aprobare,
  -- `aprobata` înseamnă „gata", nu „decis de cineva" — deci nu blochează nimic.
  where public.attendance_week_submissions.status in ('ciorna', 'trimisa', 'respinsa')
     or not internal.pontaj_necesita_aprobare(p_organization_id)
  returning id into v_submission_id;

  if v_submission_id is null then
    raise exception 'Săptămâna a fost deja aprobată și nu mai poate fi modificată.' using errcode = 'P0001';
  end if;

  delete from public.attendance_week_submission_days where submission_id = v_submission_id;

  for v_zi in select * from jsonb_array_elements(coalesce(p_zile, '[]'::jsonb))
  loop
    insert into public.attendance_week_submission_days
      (organization_id, submission_id, data, tip_prezenta,
       ora_inceput, ora_sfarsit, ore_planificate, observatii)
    values (
      p_organization_id,
      v_submission_id,
      (v_zi ->> 'data')::date,
      (v_zi ->> 'tip_prezenta')::public.attendance_presence_kind,
      -- `nullif` înaintea castului: PostgREST trimite `null` ca absență a
      -- cheii SAU ca `null` JSON, iar `''::time` ar ridica 22007.
      nullif(v_zi ->> 'ora_inceput', '')::time,
      nullif(v_zi ->> 'ora_sfarsit', '')::time,
      coalesce((v_zi ->> 'ore_planificate')::numeric, 0),
      nullif(v_zi ->> 'observatii', '')
    );
  end loop;

  return v_submission_id;
end;
$$;

revoke all on function public.trimite_saptamana_pontaj(
  uuid, date, public.attendance_week_status, jsonb, boolean, uuid) from public, anon;
grant execute on function public.trimite_saptamana_pontaj(
  uuid, date, public.attendance_week_status, jsonb, boolean, uuid) to authenticated;

commit;

-- =====================================================================================
-- 6. Note de proiectare
-- =====================================================================================
--
-- · DE CE NU SE ATINGE `attendance_entries.approved_at`. Varianta „ștampilează
--   ziua ca aprobată la salvare" ar fi cerut un trigger SECURITY DEFINER care
--   ocolește o politică scrisă intenționat ca să interzică auto-aprobarea. Ar fi
--   avut și un efect secundar exact pe dos față de ce s-a cerut: politica de
--   UPDATE (0013:795) lasă modificările doar cât timp `approved_at is null`,
--   deci ștampila ar fi făcut ziua NEEDITABILĂ pentru angajat. „Fără aprobare"
--   înseamnă „nimeni nu trebuie să confirme", nu „totul e înghețat".
--
-- · CE RĂMÂNE ÎN SARCINA APLICAȚIEI. Ascunderea filei „Aprobare" e cosmetică și
--   nu e barieră: `/pontaj/aprobare` rămâne o rută validă, iar acțiunile de
--   decizie rămân apelabile. De aceea `aprobaPontajBloc`, `decideZiPontaj` și
--   `decideSaptamanaPontaj` refuză explicit când setarea e stinsă. Regula NU se
--   poate scrie ca politică RLS: ar cere un subselect peste altă tabelă în
--   `with check`, iar refuzul ar fi apoi un UPDATE cu zero rânduri — adică tăcut
--   (capcana 17), exact felul de eșec pe care ecranul nu-l poate explica.
--
-- · DE CE NU SE MIGREAZĂ NICIUN RÂND. Nicio firmă n-a ales încă nimic despre
--   aprobare, deci `true` peste tot e păstrarea stării de fapt, nu o decizie
--   luată în locul cuiva. Prima alegere adevărată apare când cineva debifează
--   caseta pe /pontaj/setari.
--
-- · PLANUL NU SE SINCRONIZEAZĂ ÎN JOS. Ziua pontată nu SCRIE în
--   `attendance_week_submission_days`: formularul planului o citește la
--   deschidere și o arată peste rândul planificat. O scriere ar fi modificat,
--   după fapt, planul unei săptămâni deja trimise sau aprobate — adică ar fi
--   rescris ce a decis cineva. Legătura se face la citire, unde nu strică nimic.
