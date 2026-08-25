-- supabase/migrations/0077_cursuri_test_grila.sql
-- Treapta a treia de dovadă: testul grilă cu prag de trecere.
--
-- ── DE CE CHEIA DE RĂSPUNS STĂ ÎN TABELĂ SEPARATĂ ────────────────────────
-- RLS n-are granularitate pe COLOANĂ. Dacă răspunsurile corecte ar sta lângă
-- întrebări, orice angajat care poate citi întrebările — și trebuie să le poată
-- citi — ar putea citi și cheia, printr-un simplu `select *` prin PostgREST.
-- Separarea în tabelă proprie, fără nicio politică pentru `authenticated`, e
-- singura barieră reală. Testul ar fi altfel decorativ.
--
-- ── CLIENTUL PROPUNE RĂSPUNSURI, BAZA CALCULEAZĂ NOTA ────────────────────
-- Angajatul inserează o încercare cu `raspunsuri`; `scor` și `promovat` le
-- scrie un trigger `security definer`, din cheie. Coloanele nici măcar nu sunt
-- în `grant insert`, deci o încercare de a le trimite eșuează cu 42501 —
-- zgomotos, nu tăcut. Fără RPC: `.rpc()` nu ajunge la schema `app`, iar o
-- funcție în `public` ar fi însemnat încă o suprafață de apel.
--
-- ── FĂRĂ PLAFON DE REÎNCERCĂRI ──────────────────────────────────────────
-- Toate încercările se păstrează și se văd, dar nu se limitează. La opt
-- angajați, un plafon ar produce mai des blocaje de rezolvat manual decât
-- fraude oprite. Coloana `numar` există, deci plafonul se poate adăuga oricând
-- fără migrare de date.

begin;

---------------------------------------------------------------------------
-- 1. Întrebările, pe versiune — pinuite ca tot restul contractului
---------------------------------------------------------------------------

alter table public.course_material_versions
  add column if not exists intrebari jsonb;

comment on column public.course_material_versions.intrebari is
  'Întrebările testului, FĂRĂ răspunsurile corecte: [{"id","text","optiuni":[{"id","text"}]}]. Cheia stă în course_answer_keys, care nu are politică pentru authenticated.';

-- Forma se verifică în bază, nu doar în Zod: un jsonb stricat ar da un ecran
-- gol la angajat, nu o eroare la cel care l-a scris.
do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint where conname = 'cmv_intrebari_ck') then
    alter table public.course_material_versions
      add constraint cmv_intrebari_ck
      check (intrebari is null or jsonb_typeof(intrebari) = 'array');
  end if;
end;
$$;

---------------------------------------------------------------------------
-- 2. Cheia de răspuns
---------------------------------------------------------------------------

create table public.course_answer_keys (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  version_id        uuid not null unique,
  chei              jsonb not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users (id) on delete set null,
  updated_by        uuid references auth.users (id) on delete set null,
  unique (id, organization_id),
  foreign key (version_id, organization_id)
    references public.course_material_versions (id, organization_id) on delete cascade,
  constraint course_answer_keys_chei_ck check (jsonb_typeof(chei) = 'object')
);

comment on table public.course_answer_keys is
  'Răspunsurile corecte: {"id_intrebare": "id_optiune"}. Tabelă separată fiindcă RLS nu are granularitate pe coloană — lângă întrebări, cheia ar fi citibilă de oricine le poate citi.';

create index course_answer_keys_created_by_idx on public.course_answer_keys (created_by);
create index course_answer_keys_updated_by_idx on public.course_answer_keys (updated_by);

---------------------------------------------------------------------------
-- 3. Încercările
---------------------------------------------------------------------------
-- Imutabile: o încercare dată nu se rescrie. Fără `deleted_at`, fără UPDATE.

create table public.course_quiz_attempts (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  enrollment_item_id    uuid not null,
  employee_id           uuid not null,
  version_id            uuid not null,
  numar                 smallint not null default 1 check (numar between 1 and 100),
  raspunsuri            jsonb not null,
  scor                  numeric(5,2) not null default 0 check (scor between 0 and 100),
  promovat              boolean not null default false,
  trimis_la             timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  created_by            uuid references auth.users (id) on delete set null,
  unique (id, organization_id),
  foreign key (enrollment_item_id, organization_id)
    references public.course_enrollment_items (id, organization_id) on delete cascade,
  foreign key (employee_id, organization_id)
    references public.employees (id, organization_id) on delete restrict,
  foreign key (version_id, organization_id)
    references public.course_material_versions (id, organization_id) on delete restrict,
  constraint course_quiz_attempts_raspunsuri_ck check (jsonb_typeof(raspunsuri) = 'object')
);

create unique index course_quiz_attempts_numar_uk
  on public.course_quiz_attempts (enrollment_item_id, numar);
create index course_quiz_attempts_angajat_idx
  on public.course_quiz_attempts (organization_id, employee_id, trimis_la desc);
create index course_quiz_attempts_created_by_idx on public.course_quiz_attempts (created_by);

---------------------------------------------------------------------------
-- 4. Evaluarea
---------------------------------------------------------------------------

-- Numărul de întrebări la care s-a răspuns corect. `security definer` fiindcă
-- citește cheia, pe care apelantul nu are voie s-o vadă.
create or replace function app.curs_evalueaza_test(p_version_id uuid, p_raspunsuri jsonb)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  with chei as (
    select k.chei from public.course_answer_keys k where k.version_id = p_version_id
  ),
  perechi as (
    select e.key as intrebare, e.value as corect
    from chei c, lateral jsonb_each_text(c.chei) as e
  )
  select case
    when (select count(*) from perechi) = 0 then 0::numeric
    else round(
      100.0 * (
        select count(*) from perechi p
        where p_raspunsuri ->> p.intrebare = p.corect
      ) / (select count(*) from perechi),
      2)
  end;
$$;

revoke all on function app.curs_evalueaza_test(uuid, jsonb) from public, anon;
grant execute on function app.curs_evalueaza_test(uuid, jsonb) to authenticated, service_role;

-- Nota o scrie BAZA. Ce trimite clientul pe `scor`/`promovat`/`numar` se
-- ignoră — dar oricum nu poate trimite: coloanele nu sunt în `grant insert`.
create or replace function internal.cursuri_evalueaza_incercarea()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prag numeric(5,2);
begin
  select coalesce(i.prag_test, 100) into v_prag
  from public.course_enrollment_items i
  where i.id = new.enrollment_item_id;

  select coalesce(max(a.numar), 0) + 1 into new.numar
  from public.course_quiz_attempts a
  where a.enrollment_item_id = new.enrollment_item_id;

  new.scor := app.curs_evalueaza_test(new.version_id, new.raspunsuri);
  new.promovat := new.scor >= v_prag;
  new.trimis_la := now();
  return new;
end;
$$;

-- Trecerea închide lecția. `security definer` din același motiv ca peste tot:
-- statusul e derivat, nu declarat de cel evaluat.
create or replace function internal.cursuri_incercare_promovata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not new.promovat then
    return null;
  end if;
  update public.course_enrollment_items
     set status = 'finalizat',
         finalizat_la = coalesce(finalizat_la, now()),
         updated_at = now()
   where id = new.enrollment_item_id
     and status <> 'finalizat';
  return null;
end;
$$;

create trigger trg_course_quiz_attempts_10_evalueaza
  before insert on public.course_quiz_attempts
  for each row execute function internal.cursuri_evalueaza_incercarea();

create trigger trg_course_quiz_attempts_20_promovat
  after insert on public.course_quiz_attempts
  for each row execute function internal.cursuri_incercare_promovata();

create trigger trg_course_answer_keys_10_atinge
  before update on public.course_answer_keys
  for each row execute function internal.cursuri_atinge();

---------------------------------------------------------------------------
-- 5. RLS
---------------------------------------------------------------------------

alter table public.course_answer_keys    enable row level security;
alter table public.course_answer_keys    force  row level security;
alter table public.course_quiz_attempts  enable row level security;
alter table public.course_quiz_attempts  force  row level security;

-- Cheia: NICIO ramură `own`. Angajatul vede zero rânduri, fără eroare — exact
-- ce trebuie. Pragul e `team`, ca restul catalogului.
create policy course_answer_keys_select on public.course_answer_keys for select to authenticated
using (
  app.is_platform_admin()
  or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'courses')
    and app.can(organization_id, 'courses', 'read', 'team')
  )
);

create policy course_answer_keys_insert on public.course_answer_keys for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'courses')
  and app.can(organization_id, 'courses', 'create', 'team')
);

create policy course_answer_keys_update on public.course_answer_keys for update to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'courses')
  and app.can(organization_id, 'courses', 'update', 'team')
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'courses')
  and app.can(organization_id, 'courses', 'update', 'team')
);

create policy course_quiz_attempts_select on public.course_quiz_attempts for select to authenticated
using (
  app.is_platform_admin()
  or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'courses')
    and (
      app.has_permission(organization_id, 'courses', 'read') = 'all'
      or (app.can(organization_id, 'courses', 'read', 'team') and app.is_manager_of(organization_id, employee_id))
      or (app.can(organization_id, 'courses', 'read', 'own') and employee_id = app.current_employee_id(organization_id))
    )
  )
);

-- Singura scriere a angajatului din tot modulul care e un INSERT, nu un UPDATE.
create policy course_quiz_attempts_insert on public.course_quiz_attempts for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'courses')
  and app.can(organization_id, 'courses', 'update', 'own')
  and employee_id = app.current_employee_id(organization_id)
);

---------------------------------------------------------------------------
-- 6. Drepturi
---------------------------------------------------------------------------

revoke all on public.course_answer_keys   from anon, authenticated;
revoke all on public.course_quiz_attempts from anon, authenticated;

grant select, insert, update on public.course_answer_keys to authenticated;

-- Fără UPDATE: o încercare dată nu se rescrie.
-- Grant pe COLOANE la insert: `scor`, `promovat` și `numar` le scrie triggerul.
-- O încercare de a le trimite eșuează cu 42501, nu trece tăcut.
grant select on public.course_quiz_attempts to authenticated;
grant insert (organization_id, enrollment_item_id, employee_id, version_id, raspunsuri)
  on public.course_quiz_attempts to authenticated;

---------------------------------------------------------------------------
-- 7. Actor + audit
---------------------------------------------------------------------------
-- `course_quiz_attempts` NU primește `internal.set_actor()`: n-are `updated_by`,
-- iar `created_by` îl pune implicitul. Auditul îl primește totuși — cine a dat
-- testul și cu ce notă e exact genul de eveniment care se caută mai târziu.
do $$
begin
  execute 'create trigger trg_course_answer_keys_00_actor before insert or update on public.course_answer_keys for each row execute function internal.set_actor()';
  perform internal.attach_audit('course_answer_keys');
  perform internal.attach_audit('course_quiz_attempts');
end;
$$;

commit;
