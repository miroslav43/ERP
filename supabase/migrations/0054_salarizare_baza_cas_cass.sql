-- supabase/migrations/0054_salarizare_baza_cas_cass.sql
--
-- Separă baza CAS de baza CASS.
--
-- Până acum motorul avea o singură `baza_cas_cass` și aplica ambele cote pe
-- ea, iar comentariul din `domain/payroll/calc.ts` afirma că tichetele de masă
-- „nu intră niciodată în baza CAS/CASS — regulă legală, nu opțiune de
-- configurare". Afirmația e adevărată doar pe jumătate: tichetele nu intră în
-- baza de PENSIE, dar intră în cea de SĂNĂTATE. Cu o singură bază, cele două
-- reguli nu pot coexista.
--
-- `tichete_supuse_cass` intră cu valoarea implicită `false`, DELIBERAT: o
-- valoare implicită `true` ar schimba tăcut salariul net al fiecărui angajat
-- din fiecare organizație, la prima recalculare. Regimul fiscal al tichetelor
-- s-a schimbat de mai multe ori în ultimii ani (vezi NOTES.md §3, marcat ⚠️),
-- deci cine îl activează o face după ce confirmă cu contabilul. Motorul
-- avertizează când există tichete și comutatorul e nesetat.
--
-- `baza_cas_cass` NU se șterge și nu se redenumește: rândurile deja calculate
-- rămân interpretabile. Primește doar un comentariu care spune ce a însemnat.

\set ON_ERROR_STOP on

begin;

alter table public.payroll_settings
  add column if not exists tichete_supuse_cass boolean not null default false;

comment on column public.payroll_settings.tichete_supuse_cass is
  'Tichetele de masă intră în baza CASS (nu și în cea CAS). ⚠️ Regim fiscal de confirmat de contabil — implicit dezactivat, ca activarea să fie o decizie explicită.';

alter table public.payroll_entries
  add column if not exists baza_cas  numeric(14, 2) not null default 0,
  add column if not exists baza_cass numeric(14, 2) not null default 0;

comment on column public.payroll_entries.baza_cas is
  'Baza de calcul a contribuției de asigurări sociale (pensie). Nu include tichetele de masă.';
comment on column public.payroll_entries.baza_cass is
  'Baza de calcul a contribuției de asigurări sociale de sănătate. Poate include tichetele, după setarea tichete_supuse_cass.';
comment on column public.payroll_entries.baza_cas_cass is
  'ÎNVECHITĂ de la 0054: baza unică folosită când CAS și CASS se calculau pe aceeași sumă. Păstrată ca rândurile vechi să rămână interpretabile; pentru rândurile noi vezi baza_cas și baza_cass.';

commit;
