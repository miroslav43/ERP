-- supabase/migrations/0127_indemnizatie_cm_retineri.sql
-- Indemnizația de concediu medical încetează să fie o sumă BRUTĂ fără destin.
--
-- ┌ Ce lipsea ────────────────────────────────────────────────────────────────
-- │ `medical_leave_codes` descria cât se plătește (procent, plafon, plătitor,
-- │ zile de angajator), dar nu și ce se REȚINE din suma aceea. Etapa de calcul
-- │ întorcea `totalAngajator` / `totalFnuass` / `total` — toate brute, nicio
-- │ contribuție, niciun impozit. Orice fluturaș cu concediu medical arăta deci
-- │ un net mai mare decât cel real.
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌ De ce TREI steaguri și nu unul ───────────────────────────────────────────
-- │ Cele trei rețineri nu merg împreună. CAS se reține din toate; impozitul,
-- │ din toate în afară de maternitate (11) și risc maternal (15); CASS, DOAR
-- │ din boala obișnuită (01). Un singur steag „se impozitează" ar fi cerut ca
-- │ regula să fie rescrisă în cod la fiecare schimbare de ordonanță, în loc să
-- │ fie mutată dintr-un rând de nomenclator, fără deploy.
-- │
-- │ Valorile vin de la utilizator și rămân marcate ⚠️ ca tot ce e legal în
-- │ proiect: `temei_legal` al fiecărui rând poartă deja „(DE VERIFICAT)".
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌ De ce `zile_angajator` NU se atinge ──────────────────────────────────────
-- │ Cerința enumeră și zilele de angajator: 5 la codurile 01, 02 și 08, zero
-- │ la restul. Sunt EXACT valorile din bază, puse acolo de 0009 — verificate
-- │ rând cu rând înainte de a scrie migrarea. Un `update` care rescrie o
-- │ coloană cu propria ei valoare nu e inofensiv: atinge `updated_at`, umple
-- │ jurnalul de audit și lasă impresia unei schimbări care n-a avut loc.
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌ O nepotrivire de nume, semnalată nu rezolvată ────────────────────────────
-- │ Cerința numește codul 06 „Urgență"; în bază e „Boală infectocontagioasă",
-- │ din 0009. Steagurile se aplică după COD, nu după denumire, deci rândul
-- │ primit e cel vizat indiferent cum se cheamă. Denumirea NU se schimbă aici:
-- │ dacă e greșită, e o corectură de nomenclator care merită propria decizie,
-- │ nu un efect secundar al unei migrări despre rețineri.
-- └───────────────────────────────────────────────────────────────────────────

begin;

-- =====================================================================================
-- 1. Coloanele
-- =====================================================================================
-- `default true` pentru CAS și impozit, `default false` pentru CASS: implicitul
-- descrie cazul MAJORITAR, ca un cod nou adăugat de cineva grăbit să cadă pe
-- comportamentul comun, nu pe cel excepțional.

alter table public.medical_leave_codes
  add column if not exists retine_cas     boolean not null default true,
  add column if not exists retine_impozit boolean not null default true,
  add column if not exists retine_cass    boolean not null default false;

comment on column public.medical_leave_codes.retine_cas is
  'CAS se reține din indemnizație. Adevărat pentru toate codurile la data 0127.';
comment on column public.medical_leave_codes.retine_impozit is
  'Impozitul pe venit se reține din indemnizație. Fals la maternitate (11) și '
  'risc maternal (15) — sunt venituri neimpozabile.';
comment on column public.medical_leave_codes.retine_cass is
  'CASS se reține din indemnizație. Adevărat DOAR la boala obișnuită (01). '
  'Restul codurilor sunt scutite, deci netul lor diferă de al lui 01 la aceeași '
  'bază brută.';

-- =====================================================================================
-- 2. Valorile per cod
-- =====================================================================================
-- Scrise ca tabel, nu ca zece `update`-uri: forma asta se citește alături de
-- cerință și se verifică dintr-o privire. Codurile absente din listă și-ar
-- păstra implicitele — nu există niciunul, dar `where` nu presupune asta.

update public.medical_leave_codes c
   set retine_cas     = v.cas,
       retine_impozit = v.impozit,
       retine_cass    = v.cass,
       updated_at     = now()
  from (values
    ('01', true,  true,  true ),  -- Boală obișnuită — singurul cu CASS
    ('02', true,  true,  false),  -- Accident în timpul deplasării la lucru
    ('03', true,  true,  false),  -- Accident de muncă
    ('05', true,  true,  false),  -- Boală profesională
    ('06', true,  true,  false),  -- Boală infectocontagioasă (v. antetul)
    ('08', true,  true,  false),  -- Boli cardiovasculare
    ('09', true,  true,  false),  -- Neoplazii, SIDA
    ('10', true,  true,  false),  -- Tuberculoză
    ('11', true,  false, false),  -- Sarcină și lăuzie — venit NEIMPOZABIL
    ('12', true,  true,  false),  -- Îngrijire copil bolnav sub 7 ani
    ('15', true,  false, false)   -- Risc maternal — venit NEIMPOZABIL
  ) as v(cod, cas, impozit, cass)
 where c.cod = v.cod
   and c.deleted_at is null
   and (c.retine_cas     is distinct from v.cas
     or c.retine_impozit is distinct from v.impozit
     or c.retine_cass    is distinct from v.cass);

-- =====================================================================================
-- 3. Note de proiectare
-- =====================================================================================
--
-- (A) DE CE NU SE VERSIONEAZĂ PE `valabil_de_la`
--     Tabela are `valabil_de_la`/`valabil_pana_la`, deci o schimbare de cotă
--     s-ar putea data. Aici nu se schimbă nicio cotă: se COMPLETEAZĂ o
--     informație care lipsea. Rândurile existente n-au declarat niciodată
--     altceva despre rețineri, deci nu există o stare veche de păstrat.
--
-- (B) COTELE NU STAU AICI
--     Steagurile spun DACĂ se reține, nu CÂT. Procentele (CAS 25%, CASS 10%,
--     impozit 10%) sunt în `payroll_settings`, per organizație, și rămân acolo:
--     sunt aceleași pentru salariu și pentru indemnizație, iar duplicarea lor
--     în nomenclator ar fi creat o a doua sursă de adevăr care se poate
--     desincroniza tăcut.
--
-- (C) CE RĂMÂNE DE FĂCUT ÎN COD
--     Coloanele sunt inerte până când `calculeazaIndemnizatieCm` le citește și
--     scade sumele. Până atunci netul rămâne cel de dinainte — corectitudinea
--     nu vine din migrare, ci din etapa de calcul care o consumă.

commit;
