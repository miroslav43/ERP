-- supabase/migrations/0058_salarizare_diurna.sql
--
-- Diurna ajunge în salarizare.
--
-- Modulul de deplasări calculează DEJA, din migrarea 0015, atât plafonul cât și
-- împărțirea impozabil / neimpozabil: `per_diem_calculations` are coloanele
-- `plafon_neimpozabil_lei`, `parte_neimpozabila_lei` și `parte_impozabila_lei`,
-- iar `per_diem_policies` ține cele două plafoane legale
-- (`multiplu_plafon_neimpozabil` și `plafon_salarii_baza_luna`).
--
-- Nimic din toate astea nu ajungea în `payroll_entries`. Consecința e dublă și
-- opusă: partea peste plafon nu era impozitată deloc, iar partea neimpozabilă
-- nu apărea în restul de plată. Prima e o problemă cu ANAF, a doua e o sumă pe
-- care angajatul nu o primea.
--
-- Salarizarea NU recalculează plafonul zilnic — a fost deja aplicat acolo unde
-- se cunoaște baremul pe țară și defalcarea zilnică. Ce se recalculează aici e
-- doar plafonul LUNAR, fiindcă el se verifică pe cumulul lunii și pe salariul
-- de bază al angajatului: două deplasări care separat se încadrează pot
-- împreună să depășească.

\set ON_ERROR_STOP on

begin;

alter table public.payroll_entries
  add column if not exists diurna_neimpozabila numeric(14, 2) not null default 0,
  add column if not exists diurna_impozabila   numeric(14, 2) not null default 0;

comment on column public.payroll_entries.diurna_neimpozabila is
  'Partea din diurnă care rămâne sub plafoane. Nu se impozitează și intră direct în restul de plată.';
comment on column public.payroll_entries.diurna_impozabila is
  'Partea din diurnă care depășește un plafon. Devine venit asimilat salariului: intră în brut și trece prin CAS, CASS și impozit.';

commit;
