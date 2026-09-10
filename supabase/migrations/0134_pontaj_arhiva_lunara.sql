-- supabase/migrations/0134_pontaj_arhiva_lunara.sql
--
-- ARHIVA LUNARĂ A PONTAJULUI.
--
-- Până aici, „închiderea" unei luni de pontaj era doar o stare pe
-- `attendance_periods` — `blocata` — reversibilă printr-o apăsare de buton
-- (`redeschidePerioada`). Datele rămâneau în `attendance_entries`, vii și
-- editabile după redeschidere. Nu exista niciun document înghețat care să
-- poată fi arătat la un control ITM, și nicio dovadă că cifrele n-au fost
-- atinse după închidere.
--
-- Migrarea asta adaugă instantaneul: conținutul lunii, înghețat ca `jsonb`,
-- cu amprentă SHA-256 și cu număr din registrul de documente. Fișierele Excel
-- se generează din instantaneu, în aplicație, niciodată din `attendance_entries`
-- recitite — altfel „arhiva" ar fi doar o interogare cu alt nume.
--
-- Specificația completă:
-- `docs/superpowers/specs/2026-09-10-arhiva-lunara-pontaj-design.md`.
--
-- ── DE CE INSTANTANEUL SE COMPUNE ÎN SQL, NU ÎN TYPESCRIPT ──────────────────
-- Regula proiectului e că logica de calcul stă în `src/domain/`. Aici nu se
-- calculează nimic: `attendance_entries` ține deja `ore_lucrate`,
-- `ore_suplimentare` și `ore_noapte` pe fiecare rând, puse la scriere. Arhivarea
-- e o agregare, nu o repetare a logicii. Asta face posibil jobul `pg_cron`, care
-- n-are cum să cheme TypeScript.
--
-- ── DE CE NU E O SERVER ACTION ──────────────────────────────────────────────
-- Arhivarea se aprinde din trigger, la blocarea lunii, exact ca înregistrarea în
-- registrul de documente (0120, secțiunea 12). Motivul e același, scris acolo:
-- niciun ecran nu poate „uita" să arhiveze. `blocheazaPerioada` rămâne
-- NEATINSĂ — nu știe că arhiva există.
--
-- ── CE NU INTRĂ ÎN INSTANTANEU ──────────────────────────────────────────────
-- CNP și IBAN, nici măcar trunchiate. Foaia colectivă de prezență nu le cere,
-- iar `hr_read_sensitive` le păzește tocmai ca să nu ajungă în fișiere pe care
-- le duce cineva la un control.
--
-- ⚠️ Termenul de păstrare de 5 ani și denumirea documentului sunt de confirmat
-- de jurist. Vezi NOTES.md.

begin;

-- =====================================================================================
-- 1. Tipuri
-- =====================================================================================

create type public.pontaj_arhiva_motiv as enum ('blocare', 'matura_lunara');

comment on type public.pontaj_arhiva_motiv is
  'De unde a venit arhivarea: blocarea lunii de către om, sau mătura lunară pg_cron. '
  'Contează la control: o arhivă „matura_lunara" e a unei luni pe care firma n-a blocat-o.';

-- =====================================================================================
-- 2. pontaj_arhive_lunare
-- =====================================================================================
--
-- `period_id` e `on delete restrict`, nu `cascade`: o arhivă e un document, iar
-- dispariția perioadei n-are voie s-o ia cu ea. Rămâne totuși nullable, fiindcă
-- mătura poate arhiva o lună cu intrări dar fără rând de perioadă (posibil pentru
-- lunile scrise înainte de 0132, când perioada se năștea la prima scriere).

create table public.pontaj_arhive_lunare (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations (id) on delete cascade,
  period_id              uuid references public.attendance_periods (id) on delete restrict,
  an                     smallint not null check (an between 2000 and 2100),
  luna                   smallint not null check (luna between 1 and 12),
  versiune               smallint not null default 1 check (versiune > 0),
  motiv                  public.pontaj_arhiva_motiv not null,
  status_perioada        public.attendance_period_status,
  continut               jsonb not null check (jsonb_typeof(continut) = 'object'),
  checksum               text not null,
  numar_angajati         integer not null check (numar_angajati >= 0),
  total_ore              numeric(12, 2) not null check (total_ore >= 0),
  total_ore_suplimentare numeric(12, 2) not null check (total_ore_suplimentare >= 0),
  total_ore_noapte       numeric(12, 2) not null check (total_ore_noapte >= 0),
  -- DEFERRABLE, și nu din eleganță. Ordinea impusă de `pontaj_arhive_in_vigoare_uq`
  -- e: întâi marchezi versiunea veche ca înlocuită, abia apoi inserezi noua. La
  -- momentul acelui UPDATE rândul-țintă încă nu există, iar o cheie străină
  -- imediată respinge exact pasul care face versionarea posibilă. Verificarea se
  -- amână până la COMMIT, când ambele rânduri sunt acolo.
  inlocuita_de           uuid references public.pontaj_arhive_lunare (id) on delete set null
                         deferrable initially deferred,
  generat_la             timestamptz not null default now(),
  generat_de             uuid references auth.users (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  created_by             uuid references auth.users (id) on delete set null,
  updated_by             uuid references auth.users (id) on delete set null,
  deleted_at             timestamptz,
  constraint pontaj_arhive_checksum_len check (char_length(checksum) = 64),
  constraint pontaj_arhive_nu_se_inlocuieste_singura check (inlocuita_de is null or inlocuita_de <> id)
);

comment on table public.pontaj_arhive_lunare is
  'Foaia colectivă de prezență a unei luni, înghețată. Se scrie DOAR din '
  'internal.pontaj_arhiveaza_luna (security definer) — nu există politică INSERT.';

-- Indexuri parțiale, ca peste tot: `.upsert()` pe tabela asta ar cădea cu
-- 42P10 (capcana 7). Nici nu are cine să încerce — scrie o singură funcție.
create unique index pontaj_arhive_versiune_uq
  on public.pontaj_arhive_lunare (organization_id, an, luna, versiune)
  where deleted_at is null;

-- O singură versiune în vigoare pe lună. Consecință de ordine în funcția de
-- arhivare: versiunea veche se marchează `inlocuita_de` ÎNAINTE ca cea nouă să
-- fie inserată, altfel indexul ăsta respinge inserarea.
create unique index pontaj_arhive_in_vigoare_uq
  on public.pontaj_arhive_lunare (organization_id, an, luna)
  where deleted_at is null and inlocuita_de is null;

create index pontaj_arhive_listare_idx
  on public.pontaj_arhive_lunare (organization_id, an desc, luna desc)
  where deleted_at is null;

create index pontaj_arhive_period_idx
  on public.pontaj_arhive_lunare (period_id)
  where deleted_at is null;

create index pontaj_arhive_created_by_idx  on public.pontaj_arhive_lunare (created_by);
create index pontaj_arhive_updated_by_idx  on public.pontaj_arhive_lunare (updated_by);
create index pontaj_arhive_generat_de_idx  on public.pontaj_arhive_lunare (generat_de);

-- =====================================================================================
-- 3. Instantaneul
-- =====================================================================================
--
-- Forma lui `continut` e contractul dintre baza de date și generatorul de XLSX
-- din `src/lib/excel/foaie-colectiva.ts`. `versiune_format` există ca un
-- generator viitor să știe ce citește fără să ghicească după coloane.
--
-- Cheile sunt scurte („z", „i", „s", „o") fiindcă se repetă de 31 de ori per
-- angajat: pe o firmă de 50 de oameni, numele lungi ar adăuga zeci de kilobytes
-- la fiecare lună arhivată, pentru zero informație.

create or replace function internal.pontaj_instantaneu_luna(
  p_organization_id uuid,
  p_an              integer,
  p_luna            integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_inceput date := make_date(p_an, p_luna, 1);
  v_sfarsit date := (make_date(p_an, p_luna, 1) + interval '1 month')::date;
  v_rezultat jsonb;
begin
  with zile as (
    select
      e.employee_id,
      jsonb_agg(
        jsonb_build_object(
          'z',   extract(day from e.data)::integer,
          't',   e.tip_zi::text,
          'i',   to_char(e.ora_inceput, 'HH24:MI'),
          's',   to_char(e.ora_sfarsit, 'HH24:MI'),
          'o',   e.ore_lucrate,
          'sup', e.ore_suplimentare,
          'n',   e.ore_noapte,
          'obs', nullif(btrim(coalesce(e.observatii, '')), '')
        )
        order by e.data
      ) as zile,
      sum(e.ore_lucrate)        as ore,
      sum(e.ore_suplimentare)   as sup,
      sum(e.ore_noapte)         as noapte,
      count(*) filter (where e.ore_lucrate > 0) as zile_lucrate
    from public.attendance_entries e
    where e.organization_id = p_organization_id
      and e.data >= v_inceput
      and e.data <  v_sfarsit
      and e.deleted_at is null
    group by e.employee_id
  ),
  angajati as (
    select
      jsonb_build_object(
        'marca',       a.marca,
        'nume',        a.full_name,
        'functie',     p.denumire,
        'departament', d.denumire,
        'zile',        z.zile,
        'total',       jsonb_build_object(
                         'ore',          z.ore,
                         'sup',          z.sup,
                         'noapte',       z.noapte,
                         'zile_lucrate', z.zile_lucrate
                       )
      ) as rand,
      a.full_name as nume_sortare,
      z.ore, z.sup, z.noapte
    from zile z
    join public.employees a on a.id = z.employee_id
    left join public.job_positions p on p.id = a.job_position_id
    left join public.departments   d on d.id = a.department_id
  )
  select jsonb_build_object(
    'versiune_format', 1,
    'firma', (
      select jsonb_build_object(
        'denumire',        o.name,
        'denumire_legala', o.legal_name,
        'cui',             o.cui,
        'reg_com',         o.reg_com
      )
      from public.organizations o
      where o.id = p_organization_id
    ),
    'perioada', jsonb_build_object(
      'an',           p_an,
      'luna',         p_luna,
      'zile_in_luna', (v_sfarsit - v_inceput)
    ),
    'angajati', coalesce(jsonb_agg(x.rand order by x.nume_sortare), '[]'::jsonb),
    'total_general', jsonb_build_object(
      'angajati', count(*),
      'ore',      coalesce(sum(x.ore), 0),
      'sup',      coalesce(sum(x.sup), 0),
      'noapte',   coalesce(sum(x.noapte), 0)
    )
  )
  into v_rezultat
  from angajati x;

  return v_rezultat;
end;
$$;

comment on function internal.pontaj_instantaneu_luna(uuid, integer, integer) is
  'Compune foaia colectivă a unei luni ca jsonb. Contractul de formă cu '
  'src/lib/excel/foaie-colectiva.ts. Fără CNP și fără IBAN, deliberat.';

-- =====================================================================================
-- 4. Arhivarea
-- =====================================================================================
--
-- Întoarce id-ul arhivei, sau NULL dacă luna n-are nicio intrare de pontaj.
-- O arhivă goală ar spune „în august nu s-a muncit nimic", ceea ce e o
-- afirmație, nu o absență de date.

create or replace function internal.pontaj_arhiveaza_luna(
  p_organization_id uuid,
  p_an              integer,
  p_luna            integer,
  p_motiv           public.pontaj_arhiva_motiv
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_continut  jsonb;
  v_id        uuid := gen_random_uuid();
  v_versiune  smallint;
  v_perioada  public.attendance_periods%rowtype;
  v_angajati  integer;
begin
  v_continut := internal.pontaj_instantaneu_luna(p_organization_id, p_an, p_luna);
  v_angajati := coalesce((v_continut #>> '{total_general,angajati}')::integer, 0);

  if v_angajati = 0 then
    return null;
  end if;

  select * into v_perioada
  from public.attendance_periods
  where organization_id = p_organization_id
    and an = p_an
    and luna = p_luna
    and deleted_at is null;

  select coalesce(max(versiune), 0)::smallint + 1
    into v_versiune
  from public.pontaj_arhive_lunare
  where organization_id = p_organization_id
    and an = p_an
    and luna = p_luna
    and deleted_at is null;

  -- Versiunea veche se marchează ÎNAINTE de inserare: `pontaj_arhive_in_vigoare_uq`
  -- nu tolerează două rânduri cu `inlocuita_de is null` pe aceeași lună.
  update public.pontaj_arhive_lunare
  set inlocuita_de = v_id
  where organization_id = p_organization_id
    and an = p_an
    and luna = p_luna
    and inlocuita_de is null
    and deleted_at is null;

  insert into public.pontaj_arhive_lunare (
    id, organization_id, period_id, an, luna, versiune, motiv, status_perioada,
    continut, checksum, numar_angajati, total_ore, total_ore_suplimentare,
    total_ore_noapte, generat_de
  ) values (
    v_id,
    p_organization_id,
    v_perioada.id,
    p_an::smallint,
    p_luna::smallint,
    v_versiune,
    p_motiv,
    v_perioada.status,
    v_continut,
    internal.sha256_hex(v_continut::text),
    v_angajati,
    coalesce((v_continut #>> '{total_general,ore}')::numeric, 0),
    coalesce((v_continut #>> '{total_general,sup}')::numeric, 0),
    coalesce((v_continut #>> '{total_general,noapte}')::numeric, 0),
    auth.uid()
  );

  -- Numărul de înregistrare. Alocatorul e idempotent pe (firmă, tip, entitate),
  -- iar fiecare versiune e un rând propriu cu id propriu — deci v2 primește
  -- număr nou, fără să-l atingă pe al lui v1.
  perform internal.inregistreaza_document(
    p_organization_id        => p_organization_id,
    p_sens                   => 'intern'::public.registru_sens,
    p_tip_document           => 'foaie_colectiva_prezenta',
    p_continut_rezumat       => 'Foaie colectivă de prezență '
                                || lpad(p_luna::text, 2, '0') || '.' || p_an::text
                                || ' — ' || v_angajati::text || ' angajați',
    p_entitate_tip           => 'pontaj_arhive_lunare',
    p_entitate_id            => v_id,
    p_emitent                => internal.registru_denumire_org(p_organization_id)
  );

  return v_id;
end;
$$;

comment on function internal.pontaj_arhiveaza_luna(uuid, integer, integer, public.pontaj_arhiva_motiv) is
  'Îngheață o lună de pontaj: instantaneu jsonb + SHA-256 + număr de registru. '
  'NULL dacă luna n-are nicio intrare. O lună rearhivată produce versiune nouă; '
  'nimic nu se suprascrie.';

-- =====================================================================================
-- 5. Punctul de aprindere 1 — blocarea lunii
-- =====================================================================================

create or replace function internal.attendance_periods_arhiveaza()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform internal.pontaj_arhiveaza_luna(
    new.organization_id, new.an::integer, new.luna::integer, 'blocare'::public.pontaj_arhiva_motiv
  );
  return null;
end;
$$;

-- `zz_` ca să ruleze după celelalte triggere de pe aceeași tabelă, exact ca
-- triggerele de registru din 0120.
create trigger zz_attendance_periods_arhiveaza
  after update on public.attendance_periods
  for each row
  when (new.status = 'blocata' and old.status is distinct from 'blocata')
  execute function internal.attendance_periods_arhiveaza();

-- =====================================================================================
-- 6. Punctul de aprindere 2 — mătura lunară
-- =====================================================================================
--
-- Blocarea e o apăsare de buton, cere `attendance:approve` cu scope `all` și
-- multe firme n-o fac niciodată. Fără mătură, exact firmele alea ar ajunge la
-- control cu arhiva goală.
--
-- Ziua 15 lasă două săptămâni de corecții după încheierea lunii. E o constantă,
-- nu o setare de firmă: o setare ar însemna un ecran, iar ecranul ar însemna
-- încă un loc unde arhivarea se poate stinge.
--
-- Prima rulare recuperează retroactiv istoricul existent din ultimii cinci ani.

create or replace function internal.pontaj_arhiveaza_luni_incheiate()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_rand    record;
  v_facute  integer := 0;
  v_azi     date := app.azi_local();
begin
  for v_rand in
    with luni as (
      select
        e.organization_id                        as org,
        extract(year  from e.data)::integer      as an,
        extract(month from e.data)::integer      as luna
      from public.attendance_entries e
      join public.organization_features f
        on  f.organization_id = e.organization_id
        and f.feature_key     = 'attendance'
        and f.enabled
        and f.deleted_at is null
      where e.deleted_at is null
        and e.data >= (date_trunc('month', v_azi) - interval '5 years')::date
        and e.data <  date_trunc('month', v_azi)::date
      group by 1, 2, 3
    )
    select l.org, l.an, l.luna
    from luni l
    where not exists (
      select 1
      from public.pontaj_arhive_lunare a
      where a.organization_id = l.org
        and a.an              = l.an
        and a.luna            = l.luna
        and a.inlocuita_de is null
        and a.deleted_at   is null
    )
    order by l.org, l.an, l.luna
  loop
    -- Fiecare lună în propriul bloc: un exercițiu de registru închis pe anul
    -- curent ridică P0001 la înregistrare (0120, pct. 58 lit. h). Fără blocul
    -- ăsta, o singură firmă cu registrul închis ar opri mătura pentru toate.
    begin
      if internal.pontaj_arhiveaza_luna(
           v_rand.org, v_rand.an, v_rand.luna, 'matura_lunara'::public.pontaj_arhiva_motiv
         ) is not null then
        v_facute := v_facute + 1;
      end if;
    exception when others then
      raise warning 'Arhivarea pontajului %/% pentru firma % a eșuat: %',
        v_rand.luna, v_rand.an, v_rand.org, sqlerrm;
    end;
  end loop;

  return v_facute;
end;
$$;

comment on function internal.pontaj_arhiveaza_luni_incheiate() is
  'Job lunar (pg_cron): arhivează orice lună încheiată din ultimii cinci ani '
  'care are pontaj și n-are arhivă în vigoare. Prima rulare recuperează istoricul.';

-- Aceeași gardă ca în 0008, 0042 și 0103: migrarea rulează și pe un Postgres gol
-- în CI, unde pg_cron nu există. Fără ea, `create extension` oprește AICI tot
-- lanțul de migrări — deci și cele trei bariere și testul de izolare.
do $do$
begin
  if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema cron;
    perform cron.schedule(
      'pontaj-arhivare-lunara',
      '0 2 15 * *',
      $job$select internal.pontaj_arhiveaza_luni_incheiate();$job$
    );
  else
    raise warning 'pg_cron nu este disponibil (Postgres gol / CI). Jobul "pontaj-arhivare-lunara" NU a fost programat. Pe Supabase se programează normal.';
  end if;
end
$do$;

-- =====================================================================================
-- 7. RLS
-- =====================================================================================
--
-- ── DE CE O SINGURĂ POLITICĂ, ȘI NU TRIOUL ─────────────────────────────────
-- Abatere deliberată de la scheletul din 0013. Tabela se scrie EXCLUSIV din
-- `internal.pontaj_arhiveaza_luna`, care e `security definer` și ocolește RLS
-- prin construcție. O politică INSERT n-ar fi o poartă, ci o a doua cale: cea
-- prin care interfața poate fabrica un document de arhivă cu ce conținut vrea.
-- Granturile de mai jos dau `select`, atât.
--
-- Poarta e `attendance:export` la scope `all`. Din seed-ul lui 0002:
-- `org_admin` are tot, `hr` are `{read,create,update,delete,approve,export}` pe
-- `attendance` la `all`. `manager` are doar `{read,approve}` la `team`, deci nu
-- vede arhiva firmei; `employee` are `own` și nici acțiunea `export`.

alter table public.pontaj_arhive_lunare enable row level security;
alter table public.pontaj_arhive_lunare force  row level security;

create policy pontaj_arhive_lunare_select on public.pontaj_arhive_lunare
  for select to authenticated
  using (
    app.is_platform_admin()
    or (organization_id = any ((select app.current_org_ids())::uuid[])
        and app.can(organization_id, 'attendance', 'export', 'all'))
  );

-- =====================================================================================
-- 8. Actor, granturi
-- =====================================================================================
--
-- ── DE CE NU SE ATAȘEAZĂ AUDITUL GENERIC ───────────────────────────────────
-- `internal.audit_trigger` copiază rândul ÎNTREG în `audit_logs`. Rândul de aici
-- poartă `continut`, adică foaia colectivă a lunii — zeci până la sute de
-- kilobytes. Auditul ar dubla, lună de lună și firmă de firmă, exact datele pe
-- care tabela le păstrează deja imuabil.
--
-- Ce ar da auditul se află oricum: tabela e append-only (nicio politică de
-- scriere, `revoke insert, update, delete`), fiecare rând poartă `generat_la`,
-- `generat_de` și `motiv`, iar înregistrarea în `registru_documente` are număr,
-- dată și rezumat pentru fiecare versiune. Absența de aici e o alegere, nu o
-- scăpare — cine adaugă `attach_audit` mai târziu trebuie să știe ce plătește.

create trigger trg_pontaj_arhive_lunare_actor
  before insert or update on public.pontaj_arhive_lunare
  for each row execute function internal.set_actor();

create trigger trg_pontaj_arhive_lunare_updated
  before update on public.pontaj_arhive_lunare
  for each row execute function app.set_updated_at();

revoke all    on table public.pontaj_arhive_lunare from public, anon;
grant  select on table public.pontaj_arhive_lunare to authenticated;

-- =====================================================================================
-- 9. Coada REVOKE/GRANT pe funcții
-- =====================================================================================
--
-- Niciuna nu se cheamă din TypeScript. Arhivarea vine din trigger și din cron;
-- aplicația doar CITEȘTE tabela.

revoke all on function internal.pontaj_instantaneu_luna(uuid, integer, integer)
  from public, anon, authenticated;
revoke all on function internal.pontaj_arhiveaza_luna(uuid, integer, integer, public.pontaj_arhiva_motiv)
  from public, anon, authenticated;
revoke all on function internal.attendance_periods_arhiveaza()
  from public, anon, authenticated;
revoke all on function internal.pontaj_arhiveaza_luni_incheiate()
  from public, anon, authenticated;

commit;

-- =====================================================================================
-- 10. Note de proiectare
-- =====================================================================================
--
-- (a) DE CE INSTANTANEU, ȘI NU FIȘIER STOCAT. Alternativa era un PDF/XLSX urcat
--     în Storage la arhivare, cu checksum peste octeți. S-a ales instantaneul
--     pentru că e tiparul deja folosit de `hr_issued_documents`: se stochează
--     CONȚINUTUL, iar randarea se recompune din el. Un fișier stocat ar fi cerut
--     bucket nou cu politicile lui și ar fi făcut imposibilă o corecție de
--     format (o coloană în plus în Excel) fără să rescrii istoria.
--
-- (b) DE CE VERSIUNI, ȘI NU SUPRASCRIERE. O lună redeschisă și corectată produce
--     versiune nouă; cea veche rămâne, marcată `inlocuita_de`. Un control care
--     întreabă „ce ați avut în august" primește și urma corecției. E filozofia
--     registrului din 0120: nu se șterge, se înlocuiește vizibil.
--
-- (c) CE SE ÎNTÂMPLĂ LA REDESCHIDERE. Nimic. Arhiva v1 rămâne în vigoare până
--     la o nouă blocare sau până când mătura n-o mai găsește... ba o găsește:
--     `inlocuita_de is null`, deci mătura SARE peste luna aia. Corect —
--     rearhivarea vine din blocare, care e momentul în care cifrele s-au oprit
--     din nou. O lună redeschisă și lăsată așa rămâne în arhivă cu ultima formă
--     închisă, iar ecranul arată data arhivării, deci diferența e vizibilă.
--
-- (d) DE CE `status_perioada` E COPIAT ÎN ARHIVĂ. Ca să se vadă la control
--     dacă luna era blocată în momentul arhivării sau doar măturată. Citit prin
--     join pe `attendance_periods`, ar fi arătat statusul de AZI, nu pe cel de
--     atunci — adică ar fi mințit exact la întrebarea pentru care există.
