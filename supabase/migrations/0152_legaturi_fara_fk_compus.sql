-- supabase/migrations/0152_legaturi_fara_fk_compus.sql
--
-- APARTENENȚA LA FIRMĂ SE VERIFICĂ ÎN TRIGGER, NU ÎN CHEIA STRĂINĂ.
--
-- ── CE S-A ÎNTÂMPLAT ────────────────────────────────────────────────────────
-- 0151 a transformat trei chei străine în chei COMPUSE, ca o fișă să nu poată
-- fi legată de departamentul sau funcția altei firme (F33 din auditul
-- `docs/audit-frontend-baza-2026-09-21.md`). Constrângerile erau corecte, bancul
-- verde, izolarea verde, proba 9/9.
--
-- Și totuși a rupt aplicația în producție, în trei minute, într-un loc pe care
-- nicio probă SQL nu-l vede: PostgREST rezolvă embed-urile `?select=...` după
-- CHEILE STRĂINE, iar indiciul folosit de cod e numele COLOANEI:
--
--   employees?select=id,department:departments!department_id(id,denumire)
--   departments?select=id,manager:employees!manager_employee_id(full_name)
--
-- Cu cheia pe o singură coloană, indiciul „department_id" identifică unic
-- relația. Cu cheia compusă `(department_id, organization_id)`, nu mai există
-- nicio cheie al cărei set de coloane să fie exact `{department_id}` — iar
-- PostgREST răspunde PGRST200: „Could not find a relationship between
-- 'employees' and 'departments'". Adică lista de angajați și pagina de
-- departamente, moarte. Măsurat direct pe producție, imediat după aplicare.
--
-- ── DE CE NU „REPARĂM INDICIILE ÎN COD" ─────────────────────────────────────
-- S-ar putea: indiciul acceptă și numele constrângerii. Dar asta ar lega forma
-- interogărilor de numele unor constrângeri, ar cere un deploy sincronizat cu
-- migrarea (baza se schimbă înaintea codului, mereu) și ar lăsa producția
-- ruptă până la el. Regula pe care o apără constrângerea nu merită prețul ăsta.
--
-- ── CE FACE MIGRAREA ────────────────────────────────────────────────────────
-- Pune la loc cheile străine simple — exact cum erau înainte de 0151 — și mută
-- verificarea de apartenență într-un trigger BEFORE. Aceeași regulă, același
-- refuz, dar fără să atingă forma relațiilor pe care le vede PostgREST.
--
-- Lecția, pentru migrarea următoare: schema nu e doar constrângeri. Forma
-- cheilor străine e API public în Supabase, iar bancul nu poate vedea asta —
-- doar o cerere reală prin PostgREST o vede.

begin;

-- ── 1. Cheile străine, înapoi la forma pe care o citește PostgREST ────────
alter table public.employees drop constraint if exists employees_department_id_fkey;
alter table public.employees
  add constraint employees_department_id_fkey
  foreign key (department_id) references public.departments (id) on delete set null;

alter table public.employees drop constraint if exists employees_job_position_id_fkey;
alter table public.employees
  add constraint employees_job_position_id_fkey
  foreign key (job_position_id) references public.job_positions (id) on delete set null;

alter table public.employees drop constraint if exists employees_manager_employee_id_fkey;
alter table public.employees
  add constraint employees_manager_employee_id_fkey
  foreign key (manager_employee_id) references public.employees (id) on delete set null;

alter table public.departments drop constraint if exists departments_manager_fk;
alter table public.departments
  add constraint departments_manager_fk
  foreign key (manager_employee_id) references public.employees (id) on delete set null;

-- ── 2. Aceeași regulă, în trigger ─────────────────────────────────────────
-- Nu are ramură de „context de serviciu": o legătură între firme e greșită
-- indiferent cine o scrie. Un import, o migrare de date sau un trigger care ar
-- avea nevoie de ea ar avea, de fapt, o eroare.
create or replace function internal.employees_legaturi_in_firma()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.department_id is not null
     and not exists (
       select 1 from public.departments d
        where d.id = new.department_id and d.organization_id = new.organization_id
     ) then
    raise exception 'Departamentul ales aparține altei organizații.' using errcode = 'P0001';
  end if;

  if new.job_position_id is not null
     and not exists (
       select 1 from public.job_positions j
        where j.id = new.job_position_id and j.organization_id = new.organization_id
     ) then
    raise exception 'Funcția aleasă aparține altei organizații.' using errcode = 'P0001';
  end if;

  -- Managerul e verificat deja de `tg_employees_manager_path`, cu același
  -- mesaj; aici e pentru cazul în care calea aia nu se declanșează.
  if new.manager_employee_id is not null
     and not exists (
       select 1 from public.employees e
        where e.id = new.manager_employee_id and e.organization_id = new.organization_id
     ) then
    raise exception 'Managerul indicat aparține altei organizații.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function internal.employees_legaturi_in_firma() from public, anon;

drop trigger if exists zz_employees_legaturi_in_firma on public.employees;
create trigger zz_employees_legaturi_in_firma
  before insert or update on public.employees
  for each row execute function internal.employees_legaturi_in_firma();

create or replace function internal.departament_sef_in_firma()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.manager_employee_id is not null
     and not exists (
       select 1 from public.employees e
        where e.id = new.manager_employee_id and e.organization_id = new.organization_id
     ) then
    raise exception 'Șeful ales aparține altei organizații.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function internal.departament_sef_in_firma() from public, anon;

drop trigger if exists zz_departament_sef_in_firma on public.departments;
create trigger zz_departament_sef_in_firma
  before insert or update on public.departments
  for each row execute function internal.departament_sef_in_firma();

commit;
