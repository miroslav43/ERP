-- supabase/migrations/0151_legaturi_in_aceeasi_firma.sql
--
-- O LEGĂTURĂ NU MAI POATE IEȘI DIN FIRMĂ. CONTRACTUL ÎNCETAT NU MAI ÎNVIE.
--
-- ── DE UNDE VINE MIGRAREA ───────────────────────────────────────────────────
-- Ultimele două constatări de bază din auditul „atinge frontendul baza direct?"
-- (`docs/audit-frontend-baza-2026-09-21.md`): F33 și F36.
--
-- ── (F33) CHEILE STRĂINE NU ȘTIU DE FIRMĂ ──────────────────────────────────
-- `employees.department_id → departments(id)`, `employees.job_position_id →
-- job_positions(id)` și `departments.manager_employee_id → employees(id)` leagă
-- doar pe `id`. Apartenența la aceeași organizație o verifică Server Action-ul;
-- baza n-o cere. Printr-un PATCH direct, un cont cu `employees:update = all`
-- putea pune pe o fișă un departament sau o funcție ale ALTEI firme — iar
-- `internal.pontaj_instantaneu_luna`, care face join fără să califice
-- organizația, scotea denumirile interne ale acelei firme în documentul de
-- pontaj al firmei proprii.
--
-- Producția nu are niciun rând încrucișat (verificat read-only înainte: 0 din
-- 0 pe toate patru legăturile), deci constrângerile se adaugă fără migrare de
-- date. Tiparul — cheie unică pe `(id, organization_id)` plus FK compus — e deja
-- folosit în proiect: 21 de indexuri `(id, organization_id)` existau înainte de
-- migrarea asta, iar `employees_id_org_uk` și `departments_id_org_uk` sunt chiar
-- cele de care avem nevoie.
--
-- ── (F36) CONTRACTUL DE MUNCĂ ──────────────────────────────────────────────
-- Trei reguli scrise în `angajati/actions.ts` și în niciun alt loc:
--   * un contract ÎNCETAT nu se mai modifică și nu mai revine la „activ";
--   * salariul se schimbă pe contractul activ, nu pe unul încheiat;
--   * data încetării nu poate fi înaintea începutului.
-- Prin PostgREST, un cont cu `employees:update = all` le ocolea pe toate trei.
--
-- Salariul minim legal NU e verificat aici, deliberat: valoarea lui e o decizie
-- anuală de politică publică, ține de `NOTES.md` („valori ⚠ de confirmat de
-- contabil") și nu are ce căuta înghețată într-o constrângere care s-ar
-- transforma în refuz tăcut pe 1 ianuarie.

begin;

-- ── 1. F33: cheia unică de care au nevoie FK-urile compuse ────────────────
-- `employees` și `departments` o au deja; `job_positions` nu.
create unique index if not exists job_positions_id_org_uk
  on public.job_positions (id, organization_id);

-- ── 2. F33: legăturile devin compuse ──────────────────────────────────────
-- Semantica `on delete set null` se păstrează: ștergerea unui departament lasă
-- fișa fără departament, nu o șterge. Ce se adaugă e coloana `organization_id`
-- în ambele capete — deci o legătură care ar ieși din firmă nici nu se poate
-- scrie.
alter table public.employees drop constraint if exists employees_department_id_fkey;
alter table public.employees
  add constraint employees_department_id_fkey
  foreign key (department_id, organization_id)
  references public.departments (id, organization_id) on delete set null;

alter table public.employees drop constraint if exists employees_job_position_id_fkey;
alter table public.employees
  add constraint employees_job_position_id_fkey
  foreign key (job_position_id, organization_id)
  references public.job_positions (id, organization_id) on delete set null;

alter table public.employees drop constraint if exists employees_manager_employee_id_fkey;
alter table public.employees
  add constraint employees_manager_employee_id_fkey
  foreign key (manager_employee_id, organization_id)
  references public.employees (id, organization_id) on delete set null;

alter table public.departments drop constraint if exists departments_manager_fk;
alter table public.departments
  add constraint departments_manager_fk
  foreign key (manager_employee_id, organization_id)
  references public.employees (id, organization_id) on delete set null;

-- ── 3. F36: regulile contractului de muncă ────────────────────────────────
create or replace function internal.contract_reguli_de_business()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if app.is_service_context() then
    return new;
  end if;

  if new.valabil_pana is not null and new.valabil_pana < new.valabil_de_la then
    raise exception 'Contractul nu se poate încheia înainte să înceapă.' using errcode = 'P0001';
  end if;
  if new.incetat_la is not null and new.incetat_la < new.valabil_de_la then
    raise exception 'Data încetării nu poate fi înaintea începutului contractului.'
      using errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE' and old.status = 'incetat' then
    -- Un contract încetat e un act închis: rămâne de citit, nu de rescris.
    -- Singurul lucru care se mai poate schimba e ștergerea logică, pentru o
    -- înregistrare făcută din greșeală.
    if new.status is distinct from old.status then
      raise exception 'Un contract încetat nu mai poate fi reactivat. Înregistrează unul nou.'
        using errcode = 'P0001';
    end if;
    if (new.salariu_baza, new.valabil_de_la, new.valabil_pana, new.incetat_la,
        new.motiv_incetare, new.temei_incetare, new.norma_ore_zi, new.norma_ore_saptamana,
        new.employee_id, new.numar, new.data_contract)
       is distinct from
       (old.salariu_baza, old.valabil_de_la, old.valabil_pana, old.incetat_la,
        old.motiv_incetare, old.temei_incetare, old.norma_ore_zi, old.norma_ore_saptamana,
        old.employee_id, old.numar, old.data_contract) then
      raise exception 'Contractul e încetat: datele lui nu se mai modifică.'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function internal.contract_reguli_de_business() from public, anon;

drop trigger if exists zz_contract_reguli_de_business on public.employment_contracts;
create trigger zz_contract_reguli_de_business
  before insert or update on public.employment_contracts
  for each row execute function internal.contract_reguli_de_business();

commit;
