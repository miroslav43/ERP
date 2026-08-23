-- supabase/migrations/0068_salarizare_d112.sql
--
-- Parametrii Declarației 112 care NU se pot deduce din datele existente.
--
-- D112 e evidența nominală a persoanelor asigurate, depusă la ANAF până pe 25 a
-- lunii următoare. Aproape tot ce conține se derivă din statul de plată deja
-- calculat — impozitul, CAS, CASS, CAM, CNP-urile, normele de lucru. Două
-- lucruri însă nu:
--
-- (1) CASA DE ASIGURĂRI DE SĂNĂTATE A ANGAJATORULUI (`casaAng`, C2).
--     Validarea ANAF cere ca ea să COINCIDĂ cu județul sediului social, dar
--     codul nu e codul de județ: e un nomenclator propriu CNAS, cu intrări
--     precum AOPSNAJ pentru cazuri speciale, iar declarația e respinsă dacă
--     lipsește sau e greșit. Nu-l ghicim din `organizations.judet`.
--
-- (2) FUNCȚIA DECLARANTULUI (`functie_declar`, C50).
--     Cine semnează declarația și cu ce calitate. „Administrator" e cazul
--     obișnuit, dar poate fi și „Contabil șef" sau „Împuternicit".
--
-- Stau pe `payroll_settings`, nu pe `organizations`, din același motiv pentru
-- care conturile notei contabile stau tot acolo (0061): sunt parametri ai
-- CALCULULUI, versionați pe `valabil_de_la` și fotografiați în
-- `settings_snapshot` la fiecare perioadă. Mutarea sediului social în alt județ
-- schimbă casa de sănătate de la o lună la alta, iar declarațiile deja depuse
-- trebuie să rămână explicabile cu parametrii lor.
--
-- ⚠️ Codurile de obligație și cele bugetare NU sunt aici, ci în
-- `src/domain/payroll/d112/coduri.ts`, cu marcaj de confirmat: Nomenclatorul 3
-- are câteva zeci de intrări, se publică separat de structura XML și se schimbă
-- prin ordin. Contabilul le confirmă o dată, la prima depunere.

\set ON_ERROR_STOP on

begin;

alter table public.payroll_settings
  add column if not exists casa_sanatate_angajator text,
  add column if not exists functie_declarant       text not null default 'Administrator';

alter table public.payroll_settings
  add constraint payroll_settings_casa_sanatate_ck
  check (
    casa_sanatate_angajator is null
    or char_length(btrim(casa_sanatate_angajator)) between 1 and 10
  );

alter table public.payroll_settings
  add constraint payroll_settings_functie_declarant_ck
  check (char_length(btrim(functie_declarant)) between 1 and 50);

comment on column public.payroll_settings.casa_sanatate_angajator is
  '⚠️ DE CONFIRMAT de contabil. Codul casei de asigurări de sănătate a '
  'angajatorului, din Nomenclatorul 2 al specificației D112 (câmpul casaAng). '
  'ANAF cere să coincidă cu județul sediului social și RESPINGE declarația dacă '
  'lipsește. Nu se deduce din organizations.judet — e nomenclator CNAS, nu cod '
  'de județ.';

comment on column public.payroll_settings.functie_declarant is
  'Funcția celui care semnează D112 (câmpul functie_declar, C50). „Administrator" '
  'e cazul obișnuit; poate fi și „Contabil șef" sau „Împuternicit".';

commit;

-- =====================================================================================
-- Note de proiectare
-- =====================================================================================
-- · De ce `casa_sanatate_angajator` intră NULL, nu cu o valoare implicită: o
--   valoare greșită ar produce o declarație care trece de validările noastre și
--   e respinsă de ANAF după depunere — cel mai prost moment posibil. NULL
--   oprește generarea aici, cu un mesaj care spune exact ce lipsește și de ce.
--
-- · De ce `functie_declarant` are implicit: e un câmp obligatoriu în XML a
--   cărui valoare corectă e „Administrator" în majoritatea covârșitoare a
--   cazurilor, iar o declarație blocată pentru el ar fi o piedică fără miză.
