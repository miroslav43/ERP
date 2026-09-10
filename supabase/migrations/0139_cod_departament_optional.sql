-- supabase/migrations/0139_cod_departament_optional.sql
--
-- CODUL DEPARTAMENTULUI DEVINE OPȚIONAL.
--
-- ── DE CE ───────────────────────────────────────────────────────────────────
-- `0004_hr.sql` a născut `departments.cod` ca `not null`, pe presupunerea că
-- orice firmă are o nomenclatură internă de departamente. Nu are. O firmă mică
-- spune „Contabilitate", nu „CTB", iar formularul o obliga să inventeze un cod
-- pe care nu-l va folosi nicăieri și pe care apoi îl vede, cu font monospațiat,
-- lângă fiecare denumire din listă și din organigramă.
--
-- Codul rămâne exact ce era pentru cine îl vrea: identificator scurt, unic în
-- organizație, insensibil la majuscule. Doar obligativitatea cade.
--
-- ── CE NU SE SCHIMBĂ, ȘI DE CE NU TREBUIE ATINS ─────────────────────────────
-- 1. `departments_cod_len check (char_length(cod) between 1 and 32)` RĂMÂNE.
--    Un CHECK care se evaluează la NULL nu respinge rândul — Postgres cere
--    „not false", nu „true". Deci constrângerea continuă să interzică șirul vid
--    și codurile peste 32 de caractere, dar lasă NULL să treacă. Rescrierea ei
--    ca `cod is null or char_length(...)` ar fi zgomot fără efect.
--
-- 2. `departments_org_cod_uniq on (organization_id, lower(cod)) where
--    deleted_at is null` RĂMÂNE. Într-un index unic Postgres tratează NULL ca
--    distinct de orice alt NULL (indexul nu e declarat `nulls not distinct`),
--    deci oricâte departamente fără cod coexistă în aceeași organizație, iar
--    unicitatea continuă să muște pentru cine chiar completează codul.
--
-- 3. Triggerele din `0107_departamentul_conducere.sql` caută
--    `lower(d.cod) = 'conducere'`. Un cod NULL nu se potrivește niciodată cu
--    acea comparație — se evaluează la NULL, deci fals în clauza `where`. Un
--    departament fără cod nu poate deveni din greșeală „Conducerea", iar
--    departamentul CONDUCERE creat automat la înființarea firmei își păstrează
--    codul, scris explicit de `0107`. Repartizarea automată a conducerii merge
--    mai departe neschimbată.
--
-- Nicio politică RLS nu citește `cod`, deci izolarea între firme nu e atinsă.
-- Migrarea nu adaugă tabele, deci nu are nevoie de bucla `do $$` de actor,
-- audit și granturi.

alter table public.departments
  alter column cod drop not null;

comment on column public.departments.cod is
  'Identificator scurt, opțional, unic în organizație (insensibil la majuscule). NULL pentru firmele care folosesc doar denumirea.';
