-- supabase/migrations/0050_salarizare_ore_repaus_sarbatoare.sql
--
-- Coloanele în care ajung orele lucrate în zilele de repaus săptămânal și de
-- sărbătoare legală, recuperate de `0049`.
--
-- De ce coloane proprii și nu îndesate în `suma_ore_suplimentare`: fluturașul
-- afișează linie cu linie. Orele normale lucrate într-o sâmbătă NU sunt ore
-- suplimentare — sunt ore de program prestate într-o zi de repaus, cu alt temei
-- și alt spor. Un fluturaș care le numește „ore suplimentare" e un document
-- oficial care spune altceva decât realitatea, iar angajatul îl semnează.
--
-- Zilele de repaus/sărbătoare lucrate NU intră în `zile_lucrate`: acela e
-- numărătorul care împarte salariul lunar la zilele lucrătoare ale lunii. O zi
-- de sâmbătă adăugată acolo ar face `zile_platite > zile_lucratoare_luna` și ar
-- opri calculul. Ele se plătesc la oră, peste salariul de bază, de aceea au
-- propriile numărătoare.
--
-- Aditiv și cu valori implicite: rândurile deja calculate rămân valide, cu zero
-- pe coloanele noi. Nu se rescrie nicio perioadă închisă.

\set ON_ERROR_STOP on

begin;

alter table public.payroll_entries
  add column if not exists zile_repaus_lucrate     numeric(5, 2)  not null default 0,
  add column if not exists zile_sarbatoare_lucrate numeric(5, 2)  not null default 0,
  add column if not exists ore_repaus              numeric(7, 2)  not null default 0,
  add column if not exists ore_sarbatoare          numeric(7, 2)  not null default 0,
  add column if not exists spor_repaus             numeric(14, 2) not null default 0,
  add column if not exists spor_sarbatoare         numeric(14, 2) not null default 0;

comment on column public.payroll_entries.zile_repaus_lucrate is
  'Zile de repaus săptămânal în care s-a lucrat. NU intră în zile_lucrate — acelea împart salariul lunar.';
comment on column public.payroll_entries.zile_sarbatoare_lucrate is
  'Zile de sărbătoare legală în care s-a lucrat. NU intră în zile_lucrate.';
comment on column public.payroll_entries.ore_repaus is
  'Total ore prestate în zile de repaus săptămânal, normale și suplimentare la un loc.';
comment on column public.payroll_entries.ore_sarbatoare is
  'Total ore prestate în zile de sărbătoare legală, normale și suplimentare la un loc.';
comment on column public.payroll_entries.spor_repaus is
  'Suma cuvenită pentru orele din zilele de repaus săptămânal, inclusiv sporul.';
comment on column public.payroll_entries.spor_sarbatoare is
  'Suma cuvenită pentru orele din zilele de sărbătoare legală, inclusiv sporul.';

commit;
