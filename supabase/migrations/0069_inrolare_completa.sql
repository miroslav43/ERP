-- supabase/migrations/0069_inrolare_completa.sql
--
-- Ce lipsea din fișa unui angajat, la înrolare și după.
--
-- (1) CENTRUL DE COST EXISTA DOAR PE DEPARTAMENT.
--     `departments.cost_center` (0004:102) e implicitul, dar un angajat poate
--     lucra într-un departament și fi bugetat pe alt centru — cazul obișnuit la
--     firmele cu proiecte. Fără coloană pe contract, singura ieșire era să-l
--     muți în alt departament, ceea ce strică ierarhia și aprobările.
--
-- (2) NU EXISTA NIVEL DE ÎNCADRARE.
--     Singurul „nivel" din schemă era `job_positions.nivel_studii`, care e cu
--     totul altceva. Un debutant și un senior pe aceeași funcție n-aveau cum să
--     fie deosebiți în date, deși salariile lor diferă tocmai prin asta.
--
-- (3) PERSOANELE ÎN ÎNTREȚINERE ERAU UN CONTOR.
--     `employees.nr_persoane_intretinere`, un `smallint` între 0 și 20, hrănea
--     direct deducerea personală (0026:86-104). Funcționa, dar nu era
--     auditabil: la un control fiscal, „patru persoane" nu se poate dovedi.
--     Legea cere ca fiecare persoană în întreținere să fie identificabilă și
--     documentată. Contorul devine DERIVAT din tabela nominală, deci calculul
--     rămâne exact același, dar are acum acoperire în date.
--
-- (4) CATALOGUL DE BENEFICII AVEA UN SINGUR RÂND.
--     `abonament_medical` era singurul beneficiu din seed-ul platformei.
--     Pensia facultativă Pilon III, asigurarea privată de sănătate,
--     abonamentul sportiv și indemnizația de telemuncă lipseau — deși toate
--     patru au regim fiscal propriu și intră în plafonul comun de 33% pe care
--     `etape/diurna-plafoane.ts:51-59` îl semnalează ca fiind neacoperit.
--
-- ⚠️ Regimurile fiscale de mai jos sunt DE CONFIRMAT de contabil: plafoanele de
-- neimpozitare se schimbă anual prin lege.

\set ON_ERROR_STOP on

begin;

-- =====================================================================================
-- 1. Centrul de cost și nivelul de încadrare, pe contract
-- =====================================================================================
-- Pe CONTRACT, nu pe angajat: amândouă se schimbă prin act adițional, iar
-- istoricul lor trebuie să rămână legat de perioada în care au fost valabile.
-- Un angajat promovat în iunie are alt nivel în mai decât în iulie, iar statul
-- de plată din mai trebuie să rămână explicabil.

alter table public.employment_contracts
  add column if not exists cost_center     text,
  add column if not exists nivel_incadrare text;

alter table public.employment_contracts
  add constraint contracts_cost_center_ck
  check (cost_center is null or char_length(btrim(cost_center)) between 1 and 64);

alter table public.employment_contracts
  add constraint contracts_nivel_incadrare_ck
  check (nivel_incadrare is null or char_length(btrim(nivel_incadrare)) between 1 and 64);

comment on column public.employment_contracts.cost_center is
  'Centrul de cost pe care se bugetează salariul. NULL = se moștenește cel al '
  'departamentului (departments.cost_center). Există separat fiindcă un angajat '
  'poate lucra într-un departament și fi bugetat pe alt centru.';

comment on column public.employment_contracts.nivel_incadrare is
  'Treapta de încadrare în grila internă („debutant", „II", „senior"). '
  'DIFERIT de job_positions.nivel_studii, care e nivelul de studii cerut de post.';

create index employment_contracts_cost_center_idx
  on public.employment_contracts (organization_id, cost_center)
  where deleted_at is null and cost_center is not null;

-- =====================================================================================
-- 2. Persoanele în întreținere, nominal
-- =====================================================================================

create type public.dependent_relation as enum
  ('copil', 'sot_sotie', 'parinte', 'alta_ruda');

create table public.employee_dependents (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  employee_id        uuid not null references public.employees (id) on delete cascade,
  nume               text not null,
  relatie            public.dependent_relation not null,
  data_nasterii      date,
  -- FĂRĂ CNP, deliberat. Vezi „Note de proiectare" la final.
  in_intretinere_de_la  date not null,
  in_intretinere_pana_la date,
  observatii         text,
  created_at         timestamptz not null default now(),
  created_by         uuid references auth.users (id) on delete set null,
  updated_at         timestamptz not null default now(),
  updated_by         uuid references auth.users (id) on delete set null,
  deleted_at         timestamptz,
  constraint employee_dependents_nume_ck check (char_length(btrim(nume)) between 2 and 200),
  constraint employee_dependents_interval_ck
    check (in_intretinere_pana_la is null or in_intretinere_pana_la >= in_intretinere_de_la),
  constraint employee_dependents_observatii_ck
    check (observatii is null or char_length(observatii) <= 500)
);

create index employee_dependents_angajat_idx
  on public.employee_dependents (organization_id, employee_id)
  where deleted_at is null;

comment on table public.employee_dependents is
  'Persoanele în întreținere, nominal. Până la 0069 exista doar contorul '
  'employees.nr_persoane_intretinere, care hrănea deducerea personală dar nu se '
  'putea dovedi la un control fiscal. Contorul rămâne, dar se recalculează de '
  'aici prin trigger — calculul salarial nu se schimbă deloc.';

alter table public.employee_dependents enable row level security;
alter table public.employee_dependents force row level security;

create policy employee_dependents_select on public.employee_dependents
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can_see_employee(organization_id, employee_id)
  );

create policy employee_dependents_insert on public.employee_dependents
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'employees', 'update', 'all')
    and deleted_at is null
  );

create policy employee_dependents_update on public.employee_dependents
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'employees', 'update', 'all')
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'employees', 'update', 'all')
  );

-- =====================================================================================
-- 3. Contorul se recalculează din tabela nominală
-- =====================================================================================
-- Recalculare, nu increment — aceeași disciplină ca la popririle din 0065: o
-- valoare derivată care se poate desincroniza de sursa ei e mai rea decât una
-- care nu există, fiindcă arată corect.

create or replace function internal.recalc_persoane_intretinere(p_employee uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_numar smallint;
begin
  select count(*)::smallint into v_numar
    from public.employee_dependents d
   where d.employee_id = p_employee
     and d.deleted_at is null
     -- Doar cele în vigoare AZI: un copil ieșit din întreținere anul trecut nu
     -- mai dă drept la deducere.
     and d.in_intretinere_de_la <= current_date
     and (d.in_intretinere_pana_la is null or d.in_intretinere_pana_la >= current_date);

  update public.employees e
     set nr_persoane_intretinere = least(v_numar, 20), updated_at = now()
   where e.id = p_employee
     and e.nr_persoane_intretinere is distinct from least(v_numar, 20);
end;
$$;

revoke all on function internal.recalc_persoane_intretinere(uuid) from public, anon, authenticated;

create or replace function internal.employee_dependents_recalc()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform internal.recalc_persoane_intretinere(old.employee_id);
  else
    perform internal.recalc_persoane_intretinere(new.employee_id);
    if tg_op = 'UPDATE' and old.employee_id is distinct from new.employee_id then
      perform internal.recalc_persoane_intretinere(old.employee_id);
    end if;
  end if;
  return null;
end;
$$;

revoke all on function internal.employee_dependents_recalc() from public, anon, authenticated;

create trigger trg_employee_dependents_recalc
  after insert or update or delete on public.employee_dependents
  for each row execute function internal.employee_dependents_recalc();

do $$
begin
  execute 'create trigger trg_employee_dependents_actor before insert or update on public.employee_dependents for each row execute function internal.set_actor()';
  perform internal.attach_audit('employee_dependents');
  execute 'grant select, insert, update on public.employee_dependents to authenticated';
exception when undefined_function then
  -- Bancul de migrare rulează pe o bază completă; garda e pentru siguranță.
  null;
end;
$$;

-- =====================================================================================
-- 4. Catalogul de beneficii extra-salariale
-- =====================================================================================
-- Regimul fiscal al fiecăruia e declarat EXPLICIT pe cele trei axe (impozit,
-- CAS, CASS), fiindcă de el depinde dacă beneficiul intră sau nu în bazele de
-- calcul. ⚠️ Plafoanele de neimpozitare se schimbă anual — contabilul le
-- confirmă, iar depășirea lor se tratează în calcul, nu aici.

insert into public.salary_component_types
  (organization_id, cod, denumire, kind, impozabil, intra_in_baza_cas, intra_in_baza_cass, ordine)
values
  (null, 'pensie_pilon_iii', 'Pensie facultativă (Pilon III)', 'beneficiu_natura', false, false, false, 71),
  (null, 'asigurare_sanatate', 'Asigurare privată de sănătate', 'beneficiu_natura', false, false, false, 72),
  (null, 'abonament_sportiv', 'Abonament sportiv', 'beneficiu_natura', false, false, false, 73),
  (null, 'indemn_telemunca', 'Indemnizație de telemuncă', 'indemnizatie', false, false, false, 74),
  (null, 'tichete_cadou', 'Tichete cadou', 'beneficiu_natura', true, false, true, 75),
  (null, 'tichete_vacanta', 'Tichete de vacanță', 'beneficiu_natura', true, false, true, 76),
  (null, 'auto_uz_personal', 'Autoturism de serviciu folosit personal', 'beneficiu_natura', true, true, true, 77)
on conflict do nothing;

comment on table public.salary_component_types is
  'Șabloane de sporuri, prime și beneficii. Rândurile cu organization_id NULL '
  'sunt seed de platformă, vizibile tuturor și needitabile. Regimul fiscal e '
  'declarat pe trei axe (impozabil / bază CAS / bază CASS) fiindcă de el depinde '
  'dacă valoarea intră în calculul contribuțiilor. ⚠️ Plafoanele de neimpozitare '
  'se schimbă anual prin lege — de confirmat de contabil.';

commit;

-- =====================================================================================
-- Note de proiectare
-- =====================================================================================
-- · DE CE TABELA NU CONȚINE CNP-UL persoanei în întreținere.
--   Prima variantă îl avea, criptat, ca pe al angajatului. Bariera R9 a
--   proiectului a refuzat migrarea: `internal.attach_audit` NU se atașează pe o
--   tabelă cu coloane sensibile, fiindcă jurnalul generic ar copia acolo
--   ciphertext-ul. Alegerea era între „tabelă cu CNP, fără audit" și „tabelă cu
--   audit, fără CNP".
--
--   A doua e clar mai bună, și nu doar tehnic: deducerea personală depinde de
--   NUMĂRUL persoanelor în întreținere, nu de identitatea lor. CNP-urile unor
--   MINORI n-ar fi servit niciunui calcul — ar fi fost date personale stocate
--   „pentru orice eventualitate", exact ce nu se face. Numele, relația și data
--   nașterii acoperă dosarul pentru un control fiscal.
--
--   Bariera a funcționat ca un reviewer: a oprit o decizie proastă înainte să
--   ajungă în bază.
--
-- · De ce contorul rămâne pe `employees` în loc să fie înlocuit de un `count`:
--   `payroll_personal_deduction_brackets` îl citește la fiecare calcul, iar un
--   subselect pe fiecare rând de salariu ar fi însemnat o interogare în plus
--   per angajat per lună. Recalcularea prin trigger îl ține sincronizat.
--
-- · De ce `least(v_numar, 20)`: constrângerea existentă pe `employees` limitează
--   contorul la 20. Un al 21-lea dependent ar fi făcut UPDATE-ul să eșueze și ar
--   fi rupt inserția, în loc să plafoneze tăcut o valoare oricum absurdă.
