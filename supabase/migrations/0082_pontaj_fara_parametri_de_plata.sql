-- supabase/migrations/0082_pontaj_fara_parametri_de_plata.sql
-- Redenumită din 0075: între timp cealaltă sesiune a ocupat 0075 cu
-- `0081_pontaj_saptamana_interval.sql`. Convenția din CLAUDE.md la coliziune e
-- să îți redenumești PROPRIA migrare. Conținutul e neschimbat și a fost deja
-- aplicat sub numele vechi; cele două nu se ating (una umblă la implicitul
-- unor coloane din `attendance_settings`, cealaltă recreează
-- `trimite_saptamana_pontaj`), deci ordinea dintre ele nu contează.
--
-- SPORURILE IES DIN ECRANUL DE PONTAJ. Un parametru, un singur loc.
--
-- ── PROBLEMA ─────────────────────────────────────────────────────────────────
-- Aceleași patru procente trăiau în două tabele, cu nume diferite:
--
--   attendance_settings.spor_suplimentare_procent  ↔  payroll_settings.procent_ore_suplimentare
--   attendance_settings.spor_noapte_procent        ↔  payroll_settings.procent_spor_noapte
--   attendance_settings.spor_weekend_procent       ↔  payroll_settings.procent_spor_weekend
--   attendance_settings.spor_sarbatoare_procent    ↔  payroll_settings.procent_spor_sarbatoare
--
-- Plătește DOAR perechea din dreapta: `salarizare/actions.ts` o pune în
-- `settings_snapshot`, iar `src/domain/payroll/calc.ts` calculează din ea.
-- Cea din stânga alimentează `app.sporuri_pontaj()` (0013:665) — o funcție care
-- nu are NICIUN apelant, verificat pe tot repo-ul: nici din migrări, nici din
-- aplicație, unde `.rpc()` n-ar ajunge oricum la schema `app`.
--
-- Pe deasupra, cele două perechi au SCĂRI diferite: `attendance_settings` ține
-- procente 0–300, `payroll_settings` ține fracții (0,25 = 25%). Două cifre
-- pentru același lucru, în două unități, pe două ecrane.
--
-- 0074 a ales să lase câmpurile pe ecran, cu un avertisment care spunea
-- „completați-le pe amândouă, cu aceleași cifre". Decizia se schimbă aici, la
-- cererea explicită a utilizatorului: o valoare de drept al muncii ținută în
-- sincron cu mâna, în două unități, între două ecrane, se va desincroniza —
-- iar cea care NU plătește arată exact la fel de oficial ca cea care plătește.
-- Nu se cere de două ori ce se folosește o dată.
--
-- ── CE FACE MIGRAREA ─────────────────────────────────────────────────────────
-- Coloanele NU se șterg: sunt `not null`, poartă valori pe organizațiile care
-- le-au completat deja, iar forward-only cere ca ștergerea să fie o decizie
-- separată, nu un efect secundar al unei mutări de ecran. Primesc însă un
-- `default`, fără de care un INSERT care nu le mai trimite (ecranul, de acum)
-- ar cădea cu 23502, și un comentariu care spune limpede că nu mai sunt
-- interfață.
--
-- `app.sporuri_pontaj()` rămâne, deliberat: nota de proiectare din 0074 spune
-- că funcția „poate fi legată cândva". Nu i se taie posibilitatea aici — dar
-- comentariul de mai jos avertizează că, dacă cineva o leagă, trebuie întâi să
-- decidă dacă sursa nu e cumva `payroll_settings`, fiindcă de acum coloanele
-- astea rămân pe implicit pentru orice organizație nouă.

begin;

-- =====================================================================================
-- 1. Implicit, ca ecranul să poată insera fără ele
-- =====================================================================================
-- `0` și nu o valoare „rezonabilă" (75, 25, 100): un implicit plauzibil ar fi
-- o cifră de drept al muncii inventată de o migrare, exact ce interzice
-- convenția ⚠️ din NOTES.md. Zero se citește ca „nesetat", nu ca „confirmat".
-- Rândurile existente nu sunt atinse — `set default` nu rescrie nimic.

alter table public.attendance_settings
  alter column spor_suplimentare_procent set default 0,
  alter column spor_noapte_procent set default 0,
  alter column spor_weekend_procent set default 0,
  alter column spor_sarbatoare_procent set default 0;

-- =====================================================================================
-- 2. Comentariile — ce sunt coloanele astea de acum
-- =====================================================================================
-- Înlocuiesc eticheta „DE VERIFICAT DE JURIST" pusă de 0013. Nu mai e nimic de
-- verificat juridic aici: valoarea juridică s-a mutat integral în
-- `payroll_settings`, iar patronul nu mai e pus să confirme cifra de două ori.

comment on column public.attendance_settings.spor_suplimentare_procent is
'NU MAI E INTERFAȚĂ, și NU plătește. Sporul care intră pe fluturaș e '
'`payroll_settings.procent_ore_suplimentare` (fracție: 0,75 = 75%), citit de '
'`src/domain/payroll/calc.ts`. Coloana asta (scară 0–300) e citită doar de '
'`app.sporuri_pontaj()`, funcție fără apelanți. Rămâne pe implicit `0` pentru '
'orice organizație nouă — înainte de a lega funcția aceea, verifică dacă sursa '
'corectă nu e chiar `payroll_settings`.';

comment on column public.attendance_settings.spor_noapte_procent is
'NU MAI E INTERFAȚĂ, și NU plătește. Vezi comentariul de pe '
'`spor_suplimentare_procent`; perechea care plătește e '
'`payroll_settings.procent_spor_noapte`. Intervalul nocturn în sine '
'(`noapte_start`, `noapte_sfarsit`, `prag_ore_noapte`) RĂMÂNE aici: acela '
'clasifică orele la pontare, nu le plătește.';

comment on column public.attendance_settings.spor_weekend_procent is
'NU MAI E INTERFAȚĂ, și NU plătește. Perechea care plătește e '
'`payroll_settings.procent_spor_weekend`. Vezi `spor_suplimentare_procent`.';

comment on column public.attendance_settings.spor_sarbatoare_procent is
'NU MAI E INTERFAȚĂ, și NU plătește. Perechea care plătește e '
'`payroll_settings.procent_spor_sarbatoare`. Vezi `spor_suplimentare_procent`. '
'Regula „maxim, nu sumă" între sărbătoare și weekend trăiește în '
'`src/domain/payroll/calc.ts:417`, nu în coloana asta.';

commit;

-- =====================================================================================
-- Note de proiectare
-- =====================================================================================
-- · De ce nu se mută valorile existente din `attendance_settings` în
--   `payroll_settings`: scările diferă (0–300 față de fracție) și, mai important,
--   `payroll_settings` are deja valorile confirmate — sunt cele după care s-au
--   calculat salariile de până acum. O migrare care le-ar suprascrie cu cifrele
--   dintr-un ecran care nu plătea nimic ar schimba retroactiv baza de calcul.
--   Ce e în `payroll_settings` rămâne singura sursă, neatinsă.
--
-- · Ce rămâne în `/pontaj/setari` după mutare: ore pe zi și pe săptămână, maximul
--   săptămânal, perioada de referință, repausurile, pauza de masă, intervalul de
--   noapte cu pragul lui, termenele de compensare și cele patru comutatoare de
--   feluri de muncă din 0074. Toate descriu CUM se înregistrează timpul. Niciunul
--   nu e o sumă de bani.
