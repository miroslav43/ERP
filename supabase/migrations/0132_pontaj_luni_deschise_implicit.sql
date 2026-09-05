-- supabase/migrations/0132_pontaj_luni_deschise_implicit.sql
--
-- O LUNĂ DE PONTAJ E DESCHISĂ PÂNĂ CÂND CINEVA O ÎNCHIDE.
--
-- Până azi era invers: luna nu exista până n-o deschidea manual cineva cu
-- `attendance:create` la scope `all`, iar `internal.pontaj_intrare_pregateste`
-- (0013:288) ridica P0001 pentru oricine încerca să scrie în ea. Consecința nu
-- era o eroare pe ecran, ci o TĂCERE: aprobarea unei cereri de concediu
-- sincronizează zilele în pontaj într-un `try` best-effort
-- (`concedii/actions.ts:250`), tocmai ca un pontaj nereușit să nu dea aprobarea
-- înapoi. Deci concediul cerut pentru octombrie se aproba, zilele nu intrau în
-- foaia de prezență, iar numărul întors — `0` — însemna deopotrivă „nicio zi
-- păstrată" și „sincronizarea n-a rulat". Nimeni nu afla nimic.
--
-- 0103 recunoștea deja problema și o trata cu un memento pe 25 ale lunii, către
-- cine POATE deschide luna. Un memento nu deschide însă nimic, iar corecția
-- retroactivă — certificatul medical adus pe 3 octombrie pentru septembrie —
-- cădea în aceeași groapă indiferent de memento.
--
-- REGULA NOUĂ, ÎNTR-O SINGURĂ PROPOZIȚIE
-- Perioada se naște singură, deschisă, la prima scriere din luna aceea. Singura
-- stare care refuză o scriere rămâne `blocata`, pusă explicit de cineva cu drept
-- de aprobare pe toată organizația. Trecutul se sigilează manual, din
-- `/pontaj/perioade`; nimic nu se închide de la sine, și nimic închis nu se
-- redeschide de la sine.
--
-- DE CE MERGE PENTRU UN `employee`, FĂRĂ SĂ LĂRGIM NICIO POLITICĂ
-- `attendance_periods_insert` (0013:762) cere `attendance:create = all` și
-- rămâne exact cum e — un `POST` direct prin PostgREST e refuzat ca înainte.
-- Nașterea se face dintr-o funcție `security definer` deținută de `postgres`,
-- care are `rolbypassrls` pe acest proiect, deci ocolește RLS chiar și peste
-- `force row level security`. Precedentul, cu aceeași motivație: 0075:25-27.
--
-- CE NU SE ATINGE
-- `internal.pontaj_luna_nu_e_blocata` (0013:313), pentru tabelele derivate:
-- el face `select ... into v_status` și, negăsind rândul, lasă `v_status` NULL,
-- adică permite deja scrierea într-o lună inexistentă. Nu avea nevoie de
-- nicio ramură nouă.
--
-- Forward-only: 0013, 0064 și 0103 NU se editează.

\set ON_ERROR_STOP on

begin;

-- =====================================================================================
-- 1. Perioada lunii, creată dacă lipsește
-- =====================================================================================
-- Un singur loc unde trăiește regula, fiindcă are DOI apelanți: triggerul de
-- pe `attendance_entries` și RPC-ul de sincronizare a concediilor. Scrisă de
-- două ori, s-ar fi despărțit la prima corecție.
--
-- CURSA E TRATATĂ, NU IGNORATĂ. Doi angajați care se pontează în aceeași
-- secundă, în prima zi a lunii, intră amândoi pe ramura „nu există". `on
-- conflict … do nothing` îl lasă pe al doilea fără rând întors — de aceea
-- urmează o a doua citire, care sub READ COMMITTED vede rândul comis de
-- primul. Predicatul `where deleted_at is null` din `on conflict` NU e
-- decorativ: `attendance_periods_luna_uq` (0013:99) e index PARȚIAL, iar fără
-- predicat inferența arbitrului cade cu 42P10.
--
-- Întoarce rândul GOL dacă nici a doua citire nu găsește nimic — singurul caz
-- rămas fiind o perioadă ștearsă logic între cele două instrucțiuni. Apelanții
-- verifică și ridică atunci eroarea de dinainte, în loc să scrie orbește.

create or replace function internal.pontaj_perioada_lunii(
  p_organization_id uuid, p_an smallint, p_luna smallint
)
returns public.attendance_periods
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perioada public.attendance_periods%rowtype;
begin
  select p.* into v_perioada
    from public.attendance_periods p
   where p.organization_id = p_organization_id
     and p.an = p_an
     and p.luna = p_luna
     and p.deleted_at is null;
  if found then
    return v_perioada;
  end if;

  -- `data_inceput`/`data_sfarsit` sunt NOT NULL fără DEFAULT; le calculează
  -- oricum `internal.pontaj_perioada_tranzitie` pe ramura de INSERT (0013:340),
  -- necondiționat. Se trimit identic, doar ca instrucțiunea să fie validă în
  -- absența triggerului. `status` rămâne implicit — `deschisa`.
  insert into public.attendance_periods (organization_id, an, luna, data_inceput, data_sfarsit)
  values (
    p_organization_id, p_an, p_luna,
    make_date(p_an::int, p_luna::int, 1),
    (make_date(p_an::int, p_luna::int, 1) + interval '1 month' - interval '1 day')::date
  )
  on conflict (organization_id, an, luna) where deleted_at is null do nothing
  returning * into v_perioada;
  if found then
    return v_perioada;
  end if;

  select p.* into v_perioada
    from public.attendance_periods p
   where p.organization_id = p_organization_id
     and p.an = p_an
     and p.luna = p_luna
     and p.deleted_at is null;

  return v_perioada;
end;
$$;

comment on function internal.pontaj_perioada_lunii(uuid, smallint, smallint) is
  'Perioada de pontaj a lunii, creată deschisă dacă lipsește. Rândul gol înseamnă că luna a fost ștearsă logic între citire și inserare.';

-- =====================================================================================
-- 2. Triggerul liniei de pontaj nu mai refuză luna inexistentă
-- =====================================================================================
-- Redefinirea lui `internal.pontaj_intrare_pregateste` (0013:275). Singura
-- schimbare de fond: ramura `if not found` cheamă funcția de mai sus în loc să
-- ridice P0001. Restul — verificarea lui `blocata`, legarea lui `period_id`,
-- deducerea lui `tip_zi` — rămâne literă cu literă.
--
-- Scutirea `and not app.is_service_context()` de pe verificarea lui `blocata` e
-- cea din 0013 și se păstrează neschimbată: sincronizarea concediilor rulează cu
-- clientul de serviciu și scrie și într-o lună blocată. E o decizie veche, nu
-- una luată aici.

create or replace function internal.pontaj_intrare_pregateste()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_perioada public.attendance_periods%rowtype;
  v_eticheta text := to_char(new.data, 'MM.YYYY');
begin
  v_perioada := internal.pontaj_perioada_lunii(
    new.organization_id,
    extract(year from new.data)::smallint,
    extract(month from new.data)::smallint
  );

  if v_perioada.id is null then
    raise exception 'Luna de pontaj % nu a putut fi deschisă. Încearcă din nou.',
      v_eticheta using errcode = 'P0001';
  end if;

  if v_perioada.status = 'blocata' and not app.is_service_context() then
    raise exception 'Perioada de pontaj % este blocată și nu mai poate fi modificată. Deblocheaz-o dacă ai nevoie de corecții.',
      v_eticheta using errcode = 'P0001';
  end if;

  new.period_id := v_perioada.id;

  if new.tip_zi is null then
    new.tip_zi := case
      when app.este_zi_lucratoare(new.organization_id, new.data) then 'lucratoare'::public.attendance_day_type
      when extract(isodow from new.data) >= 6 then 'weekend'::public.attendance_day_type
      else 'sarbatoare'::public.attendance_day_type
    end;
  end if;

  return new;
end;
$$;

-- =====================================================================================
-- 3. Sincronizarea în bloc a concediilor, la fel
-- =====================================================================================
-- Redefinirea lui `app.sincronizeaza_pontaj_concedii` (ultima formă: 0064:214).
-- Singura schimbare de fond e aceeași ramură. Refuzul pe `blocata` RĂMÂNE, și
-- rămâne fără scutire de serviciu: butonul „Sincronizează concediile" e o
-- acțiune deliberată a unui om, iar o lună sigilată nu se rescrie dintr-un
-- buton.

create or replace function app.sincronizeaza_pontaj_concedii(
  p_organization_id uuid, p_an smallint, p_luna smallint
)
returns table (linii_create integer, linii_actualizate integer, linii_pastrate integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_start date := make_date(p_an::int, p_luna::int, 1);
  v_end   date := (make_date(p_an::int, p_luna::int, 1) + interval '1 month - 1 day')::date;
  v_perioada public.attendance_periods%rowtype;
  v_total integer := 0;
  v_noi integer := 0;
  v_actualizate integer := 0;
begin
  if not app.can(p_organization_id, 'attendance', 'create', 'all') then
    raise exception 'Nu ai dreptul să sincronizezi pontajul cu concediile aprobate.' using errcode = '42501';
  end if;
  if not app.feature_on(p_organization_id, 'attendance') then
    raise exception 'Modulul de pontaj nu este activ pentru această organizație.' using errcode = 'P0001';
  end if;

  v_perioada := internal.pontaj_perioada_lunii(p_organization_id, p_an, p_luna);
  if v_perioada.id is null then
    raise exception 'Luna de pontaj % nu a putut fi deschisă. Încearcă din nou.',
      to_char(v_start, 'MM.YYYY') using errcode = 'P0001';
  end if;
  if v_perioada.status = 'blocata' then
    raise exception 'Perioada de pontaj % este blocată și nu mai poate fi sincronizată.',
      to_char(v_start, 'MM.YYYY') using errcode = 'P0001';
  end if;

  with sursa as (
    select distinct lr.employee_id, d.data, lr.id as leave_request_id,
           coalesce(lt.tip_zi_pontaj, 'concediu'::public.attendance_day_type) as tip_zi
      from public.leave_request_days d
      join public.leave_requests lr on lr.id = d.leave_request_id
      left join public.leave_types lt on lt.id = lr.leave_type_id
     where lr.organization_id = p_organization_id
       and lr.deleted_at is null
       and d.data between v_start and v_end
       -- DE ALINIAT cu valoarea reală a enum-ului de status din 0009:
       and lr.status::text in ('aprobata', 'aprobat', 'approved')
       and app.este_zi_lucratoare(p_organization_id, d.data)
  ),
  scrise as (
    insert into public.attendance_entries as e (
      organization_id, employee_id, data, ore_lucrate, ore_suplimentare, ore_noapte,
      tip_zi, sursa, leave_request_id
    )
    select p_organization_id, s.employee_id, s.data, 0, 0, 0, s.tip_zi, 'sincronizare_concedii', s.leave_request_id
      from sursa s
    on conflict (organization_id, employee_id, data) where deleted_at is null
    do update set
      tip_zi = excluded.tip_zi,
      ore_lucrate = 0,
      ore_suplimentare = 0,
      ore_noapte = 0,
      leave_request_id = excluded.leave_request_id,
      updated_at = now()
    where e.sursa = 'sincronizare_concedii'   -- liniile manuale rămân neatinse
    returning (xmax = 0) as inserata
  )
  select (select count(*) from sursa),
         count(*) filter (where inserata),
         count(*) filter (where not inserata)
    into v_total, v_noi, v_actualizate
    from scrise;

  return query select v_noi, v_actualizate, v_total - v_noi - v_actualizate;
end;
$$;

-- =====================================================================================
-- 4. Mementoul „deschideți luna" rămâne fără obiect
-- =====================================================================================
-- Jobul din 0103 trimitea lunar, pe 25, o notificare către fiecare om cu
-- `attendance:create = all`, ca să deschidă luna următoare. Luna se deschide
-- acum singură, deci mementoul ar fi o sarcină inventată: cineva ar apăsa
-- „Deschide" pentru o lună care oricum se naște la prima pontare.
--
-- Al doilea job din 0103 — `pontaj-zile-neinchise`, ziua rămasă fără „Am ieșit"
-- — NU se atinge: problema aceea există în continuare.

-- Interogarea lui `cron.job` trece prin `execute`, nu direct: PL/pgSQL planifică
-- expresia lui `if` ÎNTREAGĂ înainte s-o evalueze, deci un `and exists (select …
-- from cron.job …)" cade cu 42P01 pe un Postgres fără pg_cron — CI-ul — chiar
-- dacă prima condiție e falsă. Aceeași gardă ca în 0008, 0042 și 0103, doar cu
-- planificarea amânată.

do $do$
begin
  if exists (select 1 from pg_catalog.pg_extension where extname = 'pg_cron') then
    execute $q$select cron.unschedule(jobid) from cron.job where jobname = 'pontaj-perioada-nedeschisa'$q$;
  end if;
end
$do$;

drop function if exists internal.verifica_perioada_pontaj_nedeschisa();

-- =====================================================================================
-- 5. Privilegii
-- =====================================================================================
-- Funcția nouă e `internal`: nimeni din afara bazei n-o cheamă direct, iar
-- `authenticated` o atinge exclusiv prin trigger și prin RPC-ul de mai sus,
-- amândouă `security definer`. Coada de REVOKE/GRANT o repetă și pentru
-- funcțiile redefinite: `create or replace` păstrează privilegiile existente,
-- dar le rescriem explicit ca migrarea să fie citibilă fără 0013 alături.

revoke all on function internal.pontaj_perioada_lunii(uuid, smallint, smallint) from public, anon, authenticated;
revoke all on function internal.pontaj_intrare_pregateste() from public, anon;
revoke all on function app.sincronizeaza_pontaj_concedii(uuid, smallint, smallint) from public, anon;
grant execute on function app.sincronizeaza_pontaj_concedii(uuid, smallint, smallint) to authenticated;

commit;
