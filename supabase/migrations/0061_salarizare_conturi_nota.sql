-- supabase/migrations/0061_salarizare_conturi_nota.sql
--
-- Planul de conturi folosit la nota contabilă de salarii.
--
-- Codurile de mai jos vin din planul general de conturi românesc, deci sunt
-- aceleași pentru orice firmă. Ce diferă între firme sunt ANALITICELE (641.01,
-- 421.02 și așa mai departe), iar acelea nu se pot presupune. De aceea intră ca
-- date, cu valorile generale ca punct de plecare, nu ca literale în cod.
--
-- Nota se generează doar dacă DEBITUL egalează CREDITUL. O notă dezechilibrată
-- nu se poate înregistra în contabilitate, iar diferența ar arăta că o sumă
-- lipsește sau e numărată de două ori — de aceea verificarea e o poartă, nu o
-- observație.

\set ON_ERROR_STOP on

begin;

alter table public.payroll_settings
  add column if not exists cont_cheltuiala_salarii             text not null default '641',
  add column if not exists cont_cheltuiala_contributie_angajator text not null default '6451',
  add column if not exists cont_salarii_datorate               text not null default '421',
  add column if not exists cont_cas_retinut                    text not null default '4315',
  add column if not exists cont_cass_retinut                   text not null default '4316',
  add column if not exists cont_impozit                        text not null default '444',
  add column if not exists cont_retineri_terti                 text not null default '427',
  add column if not exists cont_avansuri                       text not null default '425';

alter table public.payroll_settings
  add constraint payroll_settings_conturi_ck
  check (
    char_length(cont_cheltuiala_salarii) between 1 and 20
    and char_length(cont_cheltuiala_contributie_angajator) between 1 and 20
    and char_length(cont_salarii_datorate) between 1 and 20
    and char_length(cont_cas_retinut) between 1 and 20
    and char_length(cont_cass_retinut) between 1 and 20
    and char_length(cont_impozit) between 1 and 20
    and char_length(cont_retineri_terti) between 1 and 20
    and char_length(cont_avansuri) between 1 and 20
  );

comment on column public.payroll_settings.cont_cheltuiala_salarii is
  'Cheltuieli cu salariile personalului. Implicit 641 din planul general; analiticele se completează de contabil.';
comment on column public.payroll_settings.cont_salarii_datorate is
  'Personal — salarii datorate. Implicit 421.';

commit;
