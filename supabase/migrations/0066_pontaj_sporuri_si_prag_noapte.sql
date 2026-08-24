-- supabase/migrations/0066_pontaj_sporuri_si_prag_noapte.sql
--
-- Trei parametri de drept al muncii care intrau cu valori care NU sunt cele
-- legale, iar consecința se vedea doar ca avertisment pe fluturaș.
--
-- (1) SPORUL DE SĂRBĂTOARE CĂDEA PE CEL DE WEEKEND.
--     `payroll_settings` n-avea coloană proprie, iar `calc.ts:386` face
--     `settings.procentSporSarbatoare ?? settings.procentSporWeekend`. Câmpul
--     opțional exista în motor din prima zi — nu-l popula nimeni. Iar sporul de
--     weekend intra cu `default 0` (0026:47), deci din fabrică munca de 1
--     Decembrie se plătea la tarif simplu, cu un `SAL_SPOR_SARBATOARE_NECONFIGURAT`
--     care nu oprea nimic.
--
--     Codul Muncii art. 142 alin. (2): munca în sărbătoare legală necompensată
--     cu timp liber în următoarele 30 de zile se plătește cu un spor de cel
--     puțin 100% din salariul de bază. Art. 137 alin. (2) spune același lucru
--     pentru repausul săptămânal. Deci implicitul corect e 1.00, nu 0.
--
-- (2) PRAGUL DE 3 ORE DE NOAPTE NU EXISTA ÎN PRACTICĂ.
--     `attendance_settings.prag_ore_noapte` a fost adăugată în 0057:49 cu
--     `default 0` („zero = fără prag”) și ZERO consumatori în calcul: sporul de
--     25% se acorda pe orice fracțiune de oră de noapte. Codul Muncii art. 126
--     îl leagă de „cel puțin 3 ore de muncă de noapte”.
--
--     `0` rămâne o valoare validă și înseamnă tot „fără prag” — o firmă poate
--     alege deliberat să fie mai generoasă decât legea. Se schimbă doar
--     IMPLICITUL, pentru rândurile viitoare.
--
-- Rândurile EXISTENTE nu se ating. O firmă care a pus deliberat 0 la sporul de
-- weekend a luat o decizie proastă, dar a luat-o — iar o migrare care rescrie
-- tăcut parametri salariali deja folosiți la un stat de plată închis ar fi mai
-- rea decât defectul. Ecranul de setări arată acum valorile legale ca implicit
-- vizibil, iar avertismentele rămân.
--
-- ⚠️ TOATE valorile de mai jos sunt DE CONFIRMAT de contabil/jurist înainte de
-- primul calcul real, ca restul parametrilor din NOTES.md.
--
-- Forward-only: 0026 și 0057 NU se editează.

\set ON_ERROR_STOP on

begin;

-- =====================================================================================
-- 1. Sporul de sărbătoare, coloană proprie
-- =====================================================================================

alter table public.payroll_settings
  add column if not exists procent_spor_sarbatoare numeric(6, 4) not null default 1.0;

alter table public.payroll_settings
  add constraint payroll_settings_spor_sarbatoare_ck
  check (procent_spor_sarbatoare >= 0 and procent_spor_sarbatoare <= 5);

comment on column public.payroll_settings.procent_spor_sarbatoare is
  '⚠️ DE CONFIRMAT de jurist. Sporul pentru munca în sărbătoare legală, ca '
  'fracție (1.0 = 100%). Codul Muncii art. 142 alin. (2) cere minimum 100% când '
  'munca nu e compensată cu timp liber în 30 de zile. Până la 0066 nu exista, '
  'iar motorul cădea pe sporul de weekend — care intra cu 0.';

-- Noile organizații primesc valoarea legală; cele existente rămân cum sunt.
alter table public.payroll_settings
  alter column procent_spor_weekend set default 1.0;

comment on column public.payroll_settings.procent_spor_weekend is
  '⚠️ DE CONFIRMAT de jurist. Sporul pentru munca în repausul săptămânal, ca '
  'fracție. Codul Muncii art. 137 alin. (2). Implicitul a fost 0 până la 0066 — '
  'din fabrică, sâmbăta se plătea la tarif simplu.';

-- =====================================================================================
-- 2. Pragul orelor de noapte
-- =====================================================================================

alter table public.attendance_settings
  alter column prag_ore_noapte set default 3;

comment on column public.attendance_settings.prag_ore_noapte is
  '⚠️ DE CONFIRMAT de jurist. Minimul de ore de noapte dintr-o zi de la care se '
  'acordă sporul (Codul Muncii art. 126: „cel puțin 3 ore”). 0 = fără prag, '
  'valoare validă pentru o firmă mai generoasă decât legea. Implicitul a fost 0 '
  'până la 0066, iar coloana n-avea NICIUN consumator în calcul.';

commit;

-- =====================================================================================
-- Note de proiectare
-- =====================================================================================
-- · De ce `prag_ore_noapte` NU se dublează pe `payroll_settings`: parametrul e
--   unul singur, al organizației, iar o a doua coloană ar fi însemnat două
--   surse de adevăr care pot diverge tăcut. Acțiunea de calcul îl citește din
--   `attendance_settings` și îl pune în `settings_snapshot`, deci perioada
--   rămâne reproductibilă fără să existe coloana de două ori.
--
-- · De ce nu se rescriu rândurile existente: `payroll_settings` e versionată pe
--   `valabil_de_la` și e fotografiată în `payroll_entries.settings_snapshot` la
--   fiecare calcul. A rescrie retroactiv un procent ar face ca o perioadă deja
--   închisă să nu mai poată fi explicată din datele ei.
