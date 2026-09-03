-- 0123_module_rapoarte_si_kpi.sql
--
-- Rapoarte și KPI devin module de sine stătătoare.
--
-- ── DE CE ───────────────────────────────────────────────────────────────────
-- Ecranele existau de mult, dar erau păzite de cheile ALTOR module: `/rapoarte`
-- de `payroll`, iar `/evaluari/kpi` și `/portal/kpi-ul-meu` de `evaluations`.
--
-- Consecința era comercială, nu tehnică. Oferta le vindea separat, la 20 și 30
-- de lei, deși erau deja incluse în cei 69 ai Salarizării și în cei 25 ai
-- Evaluărilor. Cine le-ar fi cumpărat singure ar fi plătit pentru ecrane care
-- nu s-ar fi deschis: `requireFeature` ar fi cerut modulul-părinte, negăsit.
--
-- Tot de aici veneau și sumele tăiate care nu se închideau în ofertă: „341" și
-- „263" numărau două module inexistente. Odată reale, aritmetica iese:
--   HR Extins  149 + 39+30+39+29+25+30 = 341
--   Financiar  149 + 69+25+20          = 263
--
-- ── DE CE POATE KPI SĂ STEA SINGUR ──────────────────────────────────────────
-- Verificat în cod, nu presupus: `src/lib/queries/kpi.ts` citește exclusiv
-- `kpi_seturi`, `kpi_indicatori`, `kpi_tinte_angajat`, `kpi_evaluari_lunare`,
-- `kpi_valori` — tabelele lui, din 0119 — plus `employees`. Nicio dependență de
-- tabelele de evaluări. Un client poate cumpăra KPI fără Evaluări și îi merge.
--
-- ── PARTEA CARE NU TREBUIE UITATĂ ───────────────────────────────────────────
-- Firmele care au azi `payroll` sau `evaluations` folosesc DEJA ecranele care
-- se mută. Fără secțiunea 2, ele ar fi pierdut accesul în clipa deploy-ului —
-- o regresie tăcută, care ar fi arătat ca un 404 pe un ecran cunoscut.

begin;

-- ── 1. Catalogul ────────────────────────────────────────────────────────────
-- `on conflict do nothing`: migrarea trebuie să poată fi reluată fără să pice.
insert into public.features (feature_key, denumire, descriere, icon, grup, is_core, sort_order)
values
  ('rapoarte', 'Rapoarte',
   'Venituri, concedii și tichete, agregate pe toată organizația.',
   'BarChart3', 'finance', false, 65),
  ('kpi', 'KPI-uri',
   'Indicatori de performanță pe angajat și pe echipă, cu ținte lunare.',
   'Gauge', 'hr', false, 135)
on conflict (feature_key) do nothing;

-- ── 2. Nimeni nu pierde ce avea ─────────────────────────────────────────────
-- Cine are Salarizare primește Rapoarte; cine are Evaluări primește KPI. E o
-- migrare de continuitate, nu un cadou: ecranele erau deja incluse în prețul
-- plătit, iar mutarea lor sub chei proprii n-are voie să retragă nimic.
--
-- `enabled` se copiază din rândul-părinte, nu se pune `true` orbește: o firmă
-- care avea modulul DEZACTIVAT nu trebuie să se trezească cu el pornit.
--
-- `on conflict` REPETĂ PREDICATUL indexului. `organization_features_org_key_uq`
-- e un index unic PARȚIAL — `(organization_id, feature_key) where deleted_at is
-- null` — iar un `on conflict (organization_id, feature_key)` fără `where` nu
-- se potrivește cu el și ridică „no unique or exclusion constraint matching".
-- E capcana consemnată în lista proiectului; verificată aici în catalog, nu
-- ghicită din numele indexului.
insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
select of.organization_id, 'rapoarte', of.enabled, now()
from public.organization_features of
where of.feature_key = 'payroll' and of.deleted_at is null
on conflict (organization_id, feature_key) where deleted_at is null do nothing;

insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
select of.organization_id, 'kpi', of.enabled, now()
from public.organization_features of
where of.feature_key = 'evaluations' and of.deleted_at is null
on conflict (organization_id, feature_key) where deleted_at is null do nothing;

commit;

-- ── NOTE DE PROIECTARE ──────────────────────────────────────────────────────
--
-- 1. NICIO TABELĂ NOUĂ, deci nici RLS, nici politici, nici indexuri. Migrarea
--    adaugă două rânduri într-un catalog existent și copiază drepturi între
--    rânduri din `organization_features`. Secțiunile din scheletul canonic care
--    lipsesc lipsesc fiindcă n-au obiect.
--
-- 2. `icon` e NUMELE componentei lucide, ca text — aceeași convenție ca la
--    celelalte șaptesprezece rânduri. Legătura cu componenta reală se face în
--    `src/config/features.ts`, unde `FEATURES` mapează cheia la import.
--
-- 3. CE NU FACE: nu retrage nimic. Un client care avea Salarizare rămâne cu
--    Rapoarte pornit; separarea se vede abia la următoarea ofertă, unde cele
--    două pot fi cumpărate singure. Retragerea lor de la cine nu le plătește e
--    o decizie comercială, cu preaviz, nu o migrare.
--
-- 4. DEPENDENȚA INVERSĂ NU EXISTĂ. `payroll` și `evaluations` nu citesc nimic
--    din ecranele mutate, deci nu se strică nimic în sens invers. Verificat pe
--    `src/app/(app)/salarizare/` și `src/app/(app)/evaluari/`.
