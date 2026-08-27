-- supabase/migrations/0080_pontaj_feluri_de_munca.sql
--
-- CE FELURI DE MUNCĂ ARE FIRMA — patru comutatoare, ca parametrii care nu i se
-- aplică să nu mai fie nici ceruți, nici calculați.
--
-- ── PROBLEMA ─────────────────────────────────────────────────────────────────
-- Ecranul `/pontaj/setari` cerea, obligatoriu, patru procente de spor și trei
-- parametri de noapte de la ORICE firmă — inclusiv de la una care nu lucrează
-- niciodată noaptea. Toate șapte poartă eticheta „DE VERIFICAT DE JURIST", deci
-- patronul era pus să confirme juridic parametri care nu i se aplică.
--
-- Al doilea gol, mai tăcut: nicăieri nu se compara ce s-a ÎNREGISTRAT cu ce
-- FELURI de muncă are firma, fiindcă felurile nu erau declarate nicăieri. O
-- lună cu ore de noapte într-o firmă fără tură de noapte, sau cu ore de
-- sărbătoare într-una care declară că nu se lucrează de sărbători, trecea fără
-- ca nimic să întrebe dacă e o eroare de pontaj sau o setare rămasă în urmă.
--
-- ── DE CE „FELURI DE MUNCĂ", NU „CE SPORURI ACORD" ───────────────────────────
-- Sporurile NU sunt opționale când munca s-a prestat: Codul Muncii art. 123
-- (ore suplimentare), art. 137 alin. (2) (repaus săptămânal) și art. 142 alin.
-- (2) (sărbătoare legală) le impun. Ce e opțional e dacă firma prestează vreodată
-- munca aceea. Un comutator numit „acordăm spor de sărbătoare" ar fi invitat la
-- o ilegalitate; unul numit „se lucrează de sărbători" descrie un fapt.
--
-- Consecința proiectării: comutatorul oprit NU anulează un drept, ci declară că
-- situația nu apare. Dacă totuși apar ore în situația aceea, calculul le tratează
-- ca până acum — vezi nota de la coadă.
--
-- ── IMPLICITUL E `true`, DELIBERAT ───────────────────────────────────────────
-- Rândurile existente păstrează exact comportamentul de azi. O migrare care ar
-- stinge tăcut sporuri pe organizații care deja calculează salarii ar fi mai rea
-- decât lipsa funcției — aceeași regulă pe care 0066 și-o impune în scris când
-- refuză să rescrie procentele existente.
--
-- Forward-only: 0013, 0057 și 0066 NU se editează.
--
-- ⚠️ Valorile de drept al muncii de mai jos sunt DE CONFIRMAT de contabil/jurist
-- înainte de primul calcul real, ca restul parametrilor din NOTES.md.

\set ON_ERROR_STOP on

begin;

-- =====================================================================================
-- 1. Cele patru comutatoare
-- =====================================================================================

alter table public.attendance_settings
  add column if not exists lucreaza_noaptea boolean not null default true,
  add column if not exists lucreaza_weekend boolean not null default true,
  add column if not exists lucreaza_sarbatori boolean not null default true,
  add column if not exists admite_ore_suplimentare boolean not null default true;

comment on column public.attendance_settings.lucreaza_noaptea is
  'Firma are tură de noapte. Când e fals, secțiunea de noapte dispare din ecranul '
  'de setări și nu mai e cerută. `ore_noapte` se derivă în continuare din interval '
  'la pontare — o oră de noapte efectiv lucrată rămâne un FAPT, iar art. 126 nu se '
  'stinge cu o bifă. Contrazicerea se raportează, nu se ascunde: salarizarea ridică '
  'SAL_ORE_IN_MOD_NEDECLARAT.';

comment on column public.attendance_settings.lucreaza_weekend is
  'Se prestează muncă în repausul săptămânal. Codul Muncii art. 137 alin. (2) '
  'impune sporul CÂND munca s-a prestat; comutatorul spune doar dacă se prestează.';

comment on column public.attendance_settings.lucreaza_sarbatori is
  'Se prestează muncă în zilele de sărbătoare legală. Codul Muncii art. 142 '
  'alin. (2) impune sporul CÂND munca s-a prestat.';

comment on column public.attendance_settings.admite_ore_suplimentare is
  'Firma admite ore suplimentare. Codul Muncii art. 123 impune compensarea lor '
  'CÂND s-au prestat; comutatorul spune doar dacă sunt admise.';

commit;

-- =====================================================================================
-- Note de proiectare
-- =====================================================================================
-- · De ce NU se șterg coloanele `spor_*_procent` din `attendance_settings`:
--   forward-only, iar `app.sporuri_pontaj()` (0013:665) le citește. Funcția n-are
--   astăzi NICIUN apelant — nici în migrări, nici din aplicație, unde `.rpc()`
--   nici n-ar ajunge la schema `app` (PostgREST expune doar `public`). Sporurile
--   care chiar plătesc trăiesc în `payroll_settings.procent_spor_*` și se citesc
--   din `src/domain/payroll/calc.ts`. Ecranul de setări spune acum asta în clar,
--   cu link, în loc să lase patronul să creadă că a configurat bani.
--
-- · De ce comutatoarele stau pe `attendance_settings`, nu pe `payroll_settings`:
--   „lucrăm noaptea" e un fapt despre PROGRAM, nu despre plată — el guvernează
--   întâi derivarea lui `ore_noapte` la pontare, abia apoi calculul. Aceeași
--   regulă ca la `prag_ore_noapte` în 0066: un parametru, un loc. Acțiunea de
--   calcul îl citește de acolo și îl pune în `settings_snapshot`, deci perioada
--   rămâne reproductibilă.
--
-- · Ce se întâmplă cu orele deja înregistrate când un comutator se stinge:
--   NIMIC. Rândurile din `attendance_entries` rămân neatinse, iar salarizarea
--   plătește ce e în ele. Comutatorul guvernează ce se DERIVĂ de acum înainte și
--   ce se cere pe ecran, nu ce s-a înregistrat deja. O lună închisă rămâne
--   explicabilă din datele ei.
