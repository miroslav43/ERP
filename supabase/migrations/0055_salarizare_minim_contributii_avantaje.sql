-- supabase/migrations/0055_salarizare_minim_contributii_avantaje.sql
--
-- Două lucruri care lipseau din motor: plafonul minim al bazei de contribuții
-- și avantajele în natură.
--
-- 1. MINIMUL DE CONTRIBUȚII
--
-- Pentru contractele cu normă întreagă al căror brut cade sub salariul minim,
-- CAS și CASS se calculează la salariul minim, nu la brutul efectiv. Legea
-- prevede și EXCEPȚII (elevi și studenți sub 26 de ani, pensionari, persoane
-- cu handicap, cumul de contracte care însumează cel puțin minimul) — pentru
-- ele nu există încă niciun câmp în schemă, deci motorul NU le poate aplica
-- singur. De aceea, când ridică baza, avertizează nominal: omul verifică dacă
-- angajatul e într-o excepție.
--
-- `aplica_minim_contributii` intră STINS, ca și `tichete_supuse_cass` din 0054:
-- pornit implicit, ar crește tăcut contribuțiile reținute din salariile mici
-- ale tuturor organizațiilor, la prima recalculare.
--
-- `salariu_minim_brut` intră cu 0 și e ⚠️ DE CONFIRMAT — valoarea se schimbă
-- prin hotărâre de guvern, uneori de mai multe ori pe an, iar minimele
-- sectoriale (construcții, agroalimentar) diferă. Vezi NOTES.md §3.
--
-- 2. AVANTAJELE ÎN NATURĂ
--
-- `salary_component_kind` are din 0004 valoarea 'beneficiu_natura', dar
-- motorul o trata ca pe orice primă: o aduna la brut ȘI o plătea în bani.
-- Adică angajatul primea și mașina, și contravaloarea ei. Corect: valoarea
-- intră în brut și se impozitează, apoi se SCADE din suma virată, fiindcă a
-- fost deja primită în natură.
--
-- De-aici și `rest_de_plata`, distinct de `net_de_plata`:
--   net_de_plata  = net - rețineri
--   rest_de_plata = net_de_plata - avantaje în natură (+ sume neimpozabile)
-- Fișierul bancar plătește `rest_de_plata`, niciodată `net`.
--
-- Rândurile deja calculate primesc `rest_de_plata = net_de_plata`: la momentul
-- lor nu exista nici avantaj în natură, nici diurnă neimpozabilă în calcul,
-- deci egalitatea e exactă, nu o aproximare.

\set ON_ERROR_STOP on

begin;

alter table public.payroll_settings
  add column if not exists salariu_minim_brut       numeric(14, 2) not null default 0,
  add column if not exists aplica_minim_contributii boolean        not null default false;

alter table public.payroll_settings
  add constraint payroll_settings_minim_ck
  check (salariu_minim_brut >= 0);

comment on column public.payroll_settings.salariu_minim_brut is
  '⚠️ DE CONFIRMAT de contabil. Salariul minim brut garantat, folosit ca prag al bazei de contribuții. Se schimbă prin hotărâre de guvern; minimele sectoriale diferă.';
comment on column public.payroll_settings.aplica_minim_contributii is
  'Ridică baza CAS/CASS la salariul minim când brutul e sub el. Implicit stins: pornit automat ar crește tăcut contribuțiile reținute din salariile mici.';

alter table public.payroll_entries
  add column if not exists avantaje_natura numeric(14, 2) not null default 0,
  add column if not exists rest_de_plata   numeric(14, 2) not null default 0;

comment on column public.payroll_entries.avantaje_natura is
  'Contravaloarea avantajelor primite în natură. Intră în brut și se impozitează, apoi se scade din suma virată — angajatul le-a primit deja.';
comment on column public.payroll_entries.rest_de_plata is
  'Suma efectiv virată: net_de_plata minus avantajele în natură, plus sumele neimpozabile. Fișierul bancar plătește ACEASTĂ coloană, nu net.';

-- Rândurile istorice: fără avantaje în natură și fără diurnă în calcul,
-- restul de plată ESTE netul de plată.
update public.payroll_entries
   set rest_de_plata = net_de_plata
 where rest_de_plata = 0
   and net_de_plata <> 0;

commit;
