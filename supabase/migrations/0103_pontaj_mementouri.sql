-- supabase/migrations/0103_pontaj_mementouri.sql
--
-- DOUĂ MEMENTOURI CARE REPARĂ CAUZE, NU SIMPTOME.
--
-- ── 1. LUNA CARE NU E DESCHISĂ ───────────────────────────────────────────────
-- Nimic din tot proiectul nu deschide automat o perioadă de pontaj, iar dreptul
-- de a o deschide e la scope `all` — deci numai `hr`, `org_admin` sau
-- `super_admin`. Consecința, în prima zi a fiecărei luni: triggerul
-- `internal.pontaj_intrare_pregateste` (0013:286-288) ridică P0001 pentru
-- ORICINE încearcă să se ponteze, iar butonul de pe telefon tace exact atunci
-- când toată firma îl folosește.
--
-- Ecranele știu acum să refuze devreme și cu explicație. Dar refuzul politicos
-- nu deschide luna. Cine POATE s-o deschidă trebuie anunțat ÎNAINTE, nu după ce
-- cincizeci de oameni au apăsat degeaba.
--
-- Pe 25 ale lunii, nu pe 1: cine primește mementoul în prima zi îl primește deja
-- în întârziere.
--
-- ── 2. ZIUA RĂMASĂ DESCHISĂ ──────────────────────────────────────────────────
-- Ceasul de pontaj (0096) scrie ziua în doi timpi. Între „Am intrat" și „Am
-- ieșit", rândul are `ore_lucrate = 0` — adică arată IDENTIC cu o zi legitimă de
-- zero ore. Cine uită să apese seara nu primește nicio eroare: salarizarea
-- agregă zero, tăcut, iar defectul iese la iveală pe fluturaș.
--
-- Ecranele îl arată acum ca „în curs", iar aprobarea în bloc sare peste el și-l
-- raportează. Mementoul e a treia plasă, și singura care ajunge la omul care
-- poate repara: chiar angajatul, în aceeași seară, cât mai știe la ce oră a
-- plecat.
--
-- ── DEDUPLICAREA ─────────────────────────────────────────────────────────────
-- Prin verificarea notificărilor recente, ca în 0042 — nu printr-o tabelă nouă
-- de „ce am trimis deja". O tabelă în plus ar trebui curățată, migrată și
-- explicată; interogarea de mai jos folosește chiar rândurile pe care le scrie.
--
-- Forward-only: 0013, 0042 și 0096 NU se editează.

\set ON_ERROR_STOP on

begin;

-- =====================================================================================
-- 1. Luna care nu e deschisă — către cine o poate deschide
-- =====================================================================================

create or replace function internal.verifica_perioada_pontaj_nedeschisa()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_azi   date := current_date;
  v_an    smallint;
  v_luna  smallint;
begin
  -- Numai în ultimele zile ale lunii. Rulat zilnic, ar fi zgomot.
  if extract(day from v_azi)::int < 25 then
    return;
  end if;

  -- Luna URMĂTOARE, calculată prin aritmetică de dată, nu prin `+1` pe număr:
  -- decembrie + 1 nu e luna 13, e ianuarie anul viitor.
  v_an   := extract(year  from (v_azi + interval '1 month'))::smallint;
  v_luna := extract(month from (v_azi + interval '1 month'))::smallint;

  insert into public.notifications
    (organization_id, user_id, kind, title, body, link, entity_type, entity_id)
  select distinct m.organization_id, m.user_id, 'reminder'::public.notification_kind,
         'Deschideți luna pentru pontaj',
         'Luna ' || lpad(v_luna::text, 2, '0') || '.' || v_an::text ||
           ' nu este încă deschisă. Fără ea, nimeni nu se poate ponta din prima zi.',
         '/pontaj/perioade',
         'attendance_period_missing', m.organization_id
    from public.organization_members m
   where m.status = 'active'
     and m.deleted_at is null
     and m.user_id is not null
     and app.feature_on(m.organization_id, 'attendance')
     -- Cine POATE deschide perioada: `deschidePerioada` cere
     -- `attendance:create` la scope `all` (0013 + acțiunea din aplicație).
     -- Un memento trimis cuiva care n-are dreptul e o sarcină imposibilă.
     and app.has_permission(m.organization_id, 'attendance', 'create') = 'all'
     and not exists (
       select 1 from public.attendance_periods p
        where p.organization_id = m.organization_id
          and p.an = v_an and p.luna = v_luna and p.deleted_at is null
     )
     and not exists (
       select 1 from public.notifications n
        where n.user_id = m.user_id
          and n.entity_type = 'attendance_period_missing'
          and n.entity_id = m.organization_id
          and n.created_at > now() - interval '5 days'
     );
end;
$$;

revoke all on function internal.verifica_perioada_pontaj_nedeschisa() from public, anon, authenticated;

comment on function internal.verifica_perioada_pontaj_nedeschisa() is
  'Job zilnic (pg_cron), activ doar din 25 ale lunii: anunță pe cine are '
  'attendance:create = all că luna următoare nu e deschisă pentru pontaj. '
  'Fără ea, pontarea tace pentru toată firma în prima zi a lunii.';

-- =====================================================================================
-- 2. Ziua rămasă deschisă — către angajatul care a uitat să iasă
-- =====================================================================================

create or replace function internal.verifica_zile_pontaj_neinchise()
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications
    (organization_id, user_id, kind, title, body, link, entity_type, entity_id)
  select e.organization_id, e.user_id, 'warning'::public.notification_kind,
         'Nu ați închis ziua de pontaj',
         'Ați pontat intrarea la ' || to_char(a.ora_inceput, 'HH24:MI') ||
           ' pe ' || to_char(a.data, 'DD.MM.YYYY') ||
           ', dar nu ați apăsat „Am ieșit". Ziua e înregistrată cu zero ore.',
         '/portal/pontajul-meu/zi/' || to_char(a.data, 'YYYY-MM-DD'),
         'attendance_entry_open', a.id
    from public.attendance_entries a
    join public.employees e
      on e.id = a.employee_id and e.deleted_at is null and e.user_id is not null
   where a.deleted_at is null
     and a.ora_inceput is not null
     and a.ora_sfarsit is null
     -- Numai ziua de azi și cea de ieri. Mai vechi de atât, omul oricum nu-și
     -- mai amintește ora, iar corectura e a responsabilului de pontaj.
     and a.data >= current_date - 1
     and a.approved_at is null
     and not exists (
       select 1 from public.notifications n
        where n.user_id = e.user_id
          and n.entity_type = 'attendance_entry_open'
          and n.entity_id = a.id
          and n.created_at > now() - interval '12 hours'
     );
end;
$$;

revoke all on function internal.verifica_zile_pontaj_neinchise() from public, anon, authenticated;

comment on function internal.verifica_zile_pontaj_neinchise() is
  'Job de seară (pg_cron): anunță angajatul care a apăsat „Am intrat" și n-a '
  'apăsat „Am ieșit". Ziua rămasă deschisă are ore_lucrate = 0 și e '
  'indistinguibilă de o zi legitimă fără ore — salarizarea o agregă tăcut.';

-- =====================================================================================
-- 3. Programarea
-- =====================================================================================

-- Aceeași gardă ca în 0008 și 0042: migrarea rulează și pe un Postgres gol, în
-- CI, unde pg_cron nu există. Fără ea, `create extension` oprește AICI tot
-- lanțul de migrări — deci și cele trei bariere de securitate și testul de
-- izolare, care rulează după.
do $do$
begin
  if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema cron;
    perform cron.schedule(
      'pontaj-perioada-nedeschisa',
      '0 8 * * *',
      $job$select internal.verifica_perioada_pontaj_nedeschisa();$job$
    );
    -- 19:00 UTC = 22:00 în România vara, 21:00 iarna. Destul de târziu ca tura
    -- de zi să se fi încheiat, destul de devreme cât să mai fie cineva treaz.
    perform cron.schedule(
      'pontaj-zile-neinchise',
      '0 19 * * *',
      $job$select internal.verifica_zile_pontaj_neinchise();$job$
    );
  else
    raise warning 'pg_cron nu este disponibil (Postgres gol / CI). Joburile "pontaj-perioada-nedeschisa" și "pontaj-zile-neinchise" NU au fost programate. Pe Supabase se programează normal.';
  end if;
end
$do$;

commit;
