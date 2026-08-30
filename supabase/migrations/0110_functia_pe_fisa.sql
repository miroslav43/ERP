-- supabase/migrations/0110_functia_pe_fisa.sql
-- Funcția devine denumire + cod COR direct pe fișă și pe contract.
--
-- ┌ De ce dispare nomenclatorul ──────────────────────────────────────────────
-- │ `job_positions` cerea un pas separat înainte de a putea angaja pe cineva:
-- │ intri în nomenclator, definești o funcție cu cod, denumire, cod COR, nivel
-- │ de studii și descriere, abia apoi te întorci în fișă și o alegi dintr-un
-- │ `<select>`. Pentru firmele reale din sistem — cea mai mare are opt
-- │ angajați — pasul e o taxă pură.
-- │
-- │ Măsurat pe baza reală înainte de scrierea migrării: 6 funcții, 8 angajați
-- │ legați de ele, 8 contracte, și UN SINGUR rând din tot sistemul care
-- │ folosește funcția drept criteriu de regulă (un șablon de checklist). Zero
-- │ reguli de concediu, zero reguli de bonus, zero fișe de post, zero riscuri
-- │ SSM. Nomenclatorul era citit din ~40 de fișiere, dar nu se sprijinea nimic
-- │ pe el.
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌ De ce codul COR se mută pe CONTRACT ──────────────────────────────────────
-- │ Ăsta nu e un câștig de simplitate, e o reparație. `cod_cor` stătea pe
-- │ `job_positions`, iar contractul ajungea la el prin cheie străină
-- │ (`src/lib/reges/reconciliere.ts:170`). Consecința: schimbarea codului COR
-- │ al unei funcții REscria retroactiv ce se declară la ITM pentru toate
-- │ contractele semnate vreodată pe funcția aceea. Un cod COR e o declarație
-- │ făcută la un moment dat, nu un atribut viu al unui nomenclator.
-- │
-- │ De aici, două coloane cu roluri diferite, nu una duplicată:
-- │   • `employees.cod_cor`             — valoarea CURENTĂ, cea care se propagă
-- │                                       în contractul următor;
-- │   • `employment_contracts.cod_cor`  — ÎNGHEȚATĂ la semnare.
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌ DE CE E MIGRAREA ASTA ADITIVĂ ȘI NU ȘTERGE NIMIC ─────────────────────────
-- │ Dezvoltarea și producția împart ACEEAȘI bază (NOTES.md; `.env.local` și
-- │ `.env.production` arată către același proiect Supabase). Build-ul care
-- │ rulează acum în producție încă face `select("job_position_id")`; ștergerea
-- │ coloanei l-ar doborî cu 42703 în toată fereastra dintre migrare și deploy.
-- │
-- │ Deci: aici doar se ADAUGĂ și se copiază. Ștergerea coloanelor vechi, a
-- │ CHECK-urilor care le enumeră și rescrierea celor trei funcții plpgsql stau
-- │ în `0111_functia_fara_nomenclator.sql`, care se aplică DUPĂ ce noul build
-- │ rulează. Ordinea asta e invariantul întregii schimbări.
-- └───────────────────────────────────────────────────────────────────────────
--
-- Tabela `job_positions` NU se șterge, nici acum, nici în 0111: `job_descriptions`
-- și `risk_assessments` încă o referă (0 rânduri, zero interfață), iar un
-- `drop table` e singura operație din tot planul care n-are drum înapoi.
--
-- Plan: docs/superpowers/plans/2026-08-30-functia-pe-fisa.md
-- Design: docs/superpowers/specs/2026-08-30-functia-pe-fisa-design.md

-- =====================================================================================
-- 1. Funcția pe fișa angajatului
-- =====================================================================================

alter table public.employees
  add column if not exists functie text,
  add column if not exists cod_cor text;

alter table public.employees
  add constraint employees_functie_ck
  check (functie is null or char_length(btrim(functie)) between 2 and 160);

-- Formatul, nu existența. Că ocupația chiar figurează în Clasificarea
-- Ocupațiilor din România o verifică `codCorOptional` din `src/schemas/comun.ts`,
-- contra celor 4422 de coduri din `src/domain/hr/cor-nomenclator.ts`. Baza n-are
-- nomenclatorul și nu-l va avea: se schimbă o dată la câțiva ani, prin ordin
-- comun MMPS/INS, iar o copie în Postgres ar fi a doua sursă de adevăr.
alter table public.employees
  add constraint employees_cod_cor_ck
  check (cod_cor is null or cod_cor ~ '^[0-9]{6}$');

comment on column public.employees.functie is
  'Denumirea funcției, text liber. Poate diferi deliberat de denumirea oficială '
  'a ocupației COR („Sudor MAG, schimbul 2" pentru codul 721208).';

comment on column public.employees.cod_cor is
  'Codul COR CURENT al angajatului, 6 cifre. Se propagă în contractul următor; '
  'contractele deja semnate au propria copie, înghețată.';

-- =====================================================================================
-- 2. Funcția pe contract, înghețată la semnare
-- =====================================================================================

alter table public.employment_contracts
  add column if not exists functie text,
  add column if not exists cod_cor text;

alter table public.employment_contracts
  add constraint employment_contracts_functie_ck
  check (functie is null or char_length(btrim(functie)) between 2 and 160);

alter table public.employment_contracts
  add constraint employment_contracts_cod_cor_ck
  check (cod_cor is null or cod_cor ~ '^[0-9]{6}$');

comment on column public.employment_contracts.cod_cor is
  'Codul COR declarat la ITM pentru ACEST contract, înghețat la semnare. '
  'Nu se recalculează din fișa angajatului: o promovare de mâine nu schimbă ce '
  's-a declarat anul trecut.';

-- =====================================================================================
-- 3. Copierea din nomenclator
-- =====================================================================================
-- Fără `where functie is null`: coloanele tocmai au fost create, deci sunt goale
-- peste tot. O condiție care nu poate fi falsă ascunde ce face interogarea.

update public.employees e
   set functie = jp.denumire,
       cod_cor = jp.cod_cor
  from public.job_positions jp
 where jp.id = e.job_position_id;

update public.employment_contracts c
   set functie = jp.denumire,
       cod_cor = jp.cod_cor
  from public.job_positions jp
 where jp.id = c.job_position_id;

-- =====================================================================================
-- 4. Criteriul „funcție" al regulilor, mutat pe codul COR
-- =====================================================================================
-- Patru tabele, nu trei: `payroll_bonus_rules` are și el `tip_criteriu =
-- 'functie'` și aceeași cheie străină. Scăpat din prima enumerare a designului,
-- găsit interogând `pg_constraint` după coloană — de aceea inventarul se face pe
-- bază, nu din memorie.
--
-- DE CE COD COR ȘI NU DENUMIREA. O regulă „toți sudorii primesc cursul X"
-- potrivită pe text ar fi însemnat că „Sudor", „sudor" și „Sudor MAG" sunt trei
-- reguli diferite, fără niciun mesaj — exact clasa de refuz tăcut pe care o
-- documentează `docs/design/ecrane/capcane.md`. Codul e validat și stabil.

alter table public.leave_entitlement_rules add column if not exists cod_cor text;
alter table public.payroll_bonus_rules     add column if not exists cod_cor text;
alter table public.course_assignment_rules add column if not exists cod_cor text;
alter table public.checklist_templates     add column if not exists cod_cor text;

alter table public.leave_entitlement_rules
  add constraint ler_cod_cor_ck check (cod_cor is null or cod_cor ~ '^[0-9]{6}$');
alter table public.payroll_bonus_rules
  add constraint pbr_cod_cor_ck check (cod_cor is null or cod_cor ~ '^[0-9]{6}$');
alter table public.course_assignment_rules
  add constraint car_cod_cor_ck check (cod_cor is null or cod_cor ~ '^[0-9]{6}$');
alter table public.checklist_templates
  add constraint checklist_templates_cod_cor_ck check (cod_cor is null or cod_cor ~ '^[0-9]{6}$');

update public.leave_entitlement_rules r
   set cod_cor = jp.cod_cor
  from public.job_positions jp
 where jp.id = r.job_position_id;

update public.payroll_bonus_rules r
   set cod_cor = jp.cod_cor
  from public.job_positions jp
 where jp.id = r.job_position_id;

update public.course_assignment_rules r
   set cod_cor = jp.cod_cor
  from public.job_positions jp
 where jp.id = r.job_position_id;

update public.checklist_templates t
   set cod_cor = jp.cod_cor
  from public.job_positions jp
 where jp.id = t.job_position_id;

-- =====================================================================================
-- 5. Indexul care susține regulile pe ocupație
-- =====================================================================================
-- Parțial, ca toate indexurile proiectului: `deleted_at is null` scoate ștersele,
-- iar `cod_cor is not null` scoate fișele fără ocupație declarată — azi 4 din 12.

create index if not exists employees_org_cod_cor_idx
  on public.employees (organization_id, cod_cor)
  where deleted_at is null and cod_cor is not null;

-- =====================================================================================
-- 6. Verificarea copierii
-- =====================================================================================
-- O migrare care copiază date trebuie să spună dacă a copiat. Fără asta, un
-- `where` greșit ar lăsa fișele goale, iar aplicația ar arăta „Nealocată" pentru
-- oameni care au funcție — un defect tăcut, descoperit luni mai târziu.

do $$
declare
  v_nepreluati integer;
begin
  select count(*) into v_nepreluati
    from public.employees
   where job_position_id is not null and functie is null and deleted_at is null;

  if v_nepreluati > 0 then
    raise exception
      'Copierea funcțiilor a lăsat % fișe fără denumire, deși aveau funcție în nomenclator.',
      v_nepreluati;
  end if;

  select count(*) into v_nepreluati
    from public.employment_contracts
   where job_position_id is not null and functie is null;

  if v_nepreluati > 0 then
    raise exception
      'Copierea funcțiilor a lăsat % contracte fără denumire, deși aveau funcție în nomenclator.',
      v_nepreluati;
  end if;
end $$;
