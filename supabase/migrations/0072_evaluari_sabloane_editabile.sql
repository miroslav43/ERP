-- supabase/migrations/0072_evaluari_sabloane_editabile.sql
-- Redenumită din 0071 la integrarea ramurii `feat/departamente-vizualizari`:
-- 0071 fusese între timp ocupat pe `main` de `0071_manager_cere_concediu.sql`,
-- care e DEJA aplicată pe baza de dezvoltare. Conținutul de mai jos e
-- neschimbat și NU a fost încă rulat nicăieri — `evaluation_templates` n-are
-- încă nici `versiune`, nici `criterii_sablon`.
-- Șabloanele de evaluare devin editabile, iar evaluările își păstrează
-- criteriile de la momentul completării.
--
-- Trei lucruri, în ordinea în care contează:
--
-- 1. DRIFTUL DE POARTĂ. `0070` a mutat acțiunile modulului pe cheile
--    `evaluations:*`, dar n-a atins nicio politică. Politicile din `0038` cer
--    în continuare `employees:update`, iar în `role_permissions` rolul
--    `manager` are `evaluations:{read,create,update}=team` și NICIUN
--    `employees:update`, la niciun scope. Rezultatul măsurat: managerul trece
--    de preambulul lui `createAction` și e respins de bază cu 42501 la INSERT.
--    Migrarea mută politicile pe resursa `evaluations`, unde le-a dus 0070.
--
--    Nu se repară în cealaltă direcție (acordându-i managerului
--    `employees:update`), fiindcă aia i-ar deschide și fișa angajatului, adică
--    salariul și datele personale. Poarta greșită se mută, nu se lărgește.
--
-- 2. ISTORICUL CARE SE REESCRIA. O evaluare ținea doar `template_id`, iar
--    ecranul construia denumirile din `template.criterii` — starea CURENTĂ a
--    șablonului. Din clipa în care șablonul devine editabil, orice modificare
--    ar fi rescris retroactiv sensul notelor deja date: un `scala_max` schimbat
--    de la 5 la 10 ar fi transformat un „4 din 5" istoric într-un „4 din 10".
--    De aici `criterii_sablon`: instantaneul, scris la creare.
--
-- 3. FINALIZATUL CARE NU ERA FINAL. Politica de UPDATE lăsa orice rând să fie
--    modificat, indiferent de status. O evaluare semnată se putea rescrie tăcut.
--
-- Baza live are 1 șablon (de platformă) și 0 evaluări la data scrierii, deci
-- forma lui `criterii` se poate lărgi fără migrare de date. Peste o lună n-ar
-- mai fi fost adevărat.

begin;

-- ============================================================
-- 1. ȘABLOANE — VERSIUNE ȘI CRITERII STRUCTURATE
-- ============================================================

-- Forma nouă a unui element din `criterii`, compatibilă înapoi (cheile care
-- lipsesc primesc valori implicite la citire, în `normalizeazaCriterii`):
--
--   { "cod": "calitate_munca",
--     "denumire": "Calitatea muncii",
--     "descriere": "Ghid de notare, opțional",   -- sau null
--     "tip": "scala" | "da_nu" | "text",
--     "scala_max": 5,                            -- 3|4|5|10 la `scala`, 1 la `da_nu`
--     "pondere": 30 }                            -- 0..100, sau null peste tot
--
-- `da_nu` se codifică drept scală cu maximul 1, ca punctajul ponderat să se
-- calculeze uniform peste toate tipurile, fără ramură separată. `text` nu intră
-- în punctaj deloc.

alter table public.evaluation_templates
  add column versiune integer not null default 1;

comment on column public.evaluation_templates.versiune is
  'Se incrementează la fiecare editare a criteriilor. Evaluările rețin versiunea folosită.';

-- Garanția minimă la nivel de bază. Validarea de fond (tipuri, unicitatea
-- codurilor, suma ponderilor) stă în Zod, unde poate da mesaje pe câmp; aici
-- rămâne doar ce împiedică o coloană jsonb să devină un obiect sau un număr.
alter table public.evaluation_templates
  add constraint evaluation_templates_criterii_arr
  check (jsonb_typeof(criterii) = 'array');

alter table public.evaluation_templates
  add constraint evaluation_templates_versiune_pozitiva
  check (versiune >= 1);

-- ============================================================
-- 2. EVALUĂRI — INSTANTANEUL CRITERIILOR
-- ============================================================

alter table public.employee_evaluations
  add column criterii_sablon jsonb not null default '[]'::jsonb,
  add column versiune_sablon integer;

comment on column public.employee_evaluations.criterii_sablon is
  'Copia criteriilor de la momentul completării. Ecranele citesc de aici, NU din șablon: editarea unui șablon nu are voie să schimbe sensul notelor deja date.';

alter table public.employee_evaluations
  add constraint employee_evaluations_raspunsuri_arr
  check (jsonb_typeof(raspunsuri) = 'array');

alter table public.employee_evaluations
  add constraint employee_evaluations_criterii_arr
  check (jsonb_typeof(criterii_sablon) = 'array');

-- Umplerea instantaneului pentru rândurile existente. La data scrierii sunt
-- zero, dar migrarea nu are voie să depindă de asta: dacă altcineva a inserat
-- între timp, rândul lui primește criteriile șablonului lui, nu o listă goală.
update public.employee_evaluations e
   set criterii_sablon = t.criterii,
       versiune_sablon = t.versiune
  from public.evaluation_templates t
 where t.id = e.template_id
   and e.criterii_sablon = '[]'::jsonb;

-- Toate citirile filtrează pe `organization_id`, iar singurul index existent
-- pornea de la `employee_id`. Lista modulului (toată firma, ordonată după dată)
-- făcea scanare de tabelă.
create index employee_evaluations_org_data_idx
  on public.employee_evaluations (organization_id, data_evaluarii desc)
  where deleted_at is null;

-- ============================================================
-- 3. PREDICATUL DE ACCES, PE RESURSA `evaluations`
-- ============================================================

-- Oglindește `app.can_write_employee` (0005_hr_rls.sql), dar comută pe resursa
-- `evaluations`. O singură funcție pentru toate cele trei acțiuni: dacă read,
-- create și update ar folosi predicate diferite, s-ar putea reintroduce exact
-- driftul pe care migrarea asta îl repară.
create or replace function app.can_access_evaluation(p_org uuid, p_employee uuid, p_action text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case app.has_permission(p_org, 'evaluations', p_action)
    when 'all' then true
    when 'team' then app.is_manager_of(p_org, p_employee)
    when 'own' then p_employee = app.current_employee_id(p_org)
    else false
  end
$$;

comment on function app.can_access_evaluation(uuid, uuid, text) is
  'Accesul la evaluarea unui angajat, după scope-ul permisiunii evaluations.<acțiune>. Înlocuiește cuplarea la employees.update din 0038.';

revoke all on function app.can_access_evaluation(uuid, uuid, text) from public;
grant execute on function app.can_access_evaluation(uuid, uuid, text) to authenticated;

-- ============================================================
-- 4. POLITICI — ȘABLOANE
-- ============================================================

drop policy evaluation_templates_select on public.evaluation_templates;
drop policy evaluation_templates_insert on public.evaluation_templates;
drop policy evaluation_templates_update on public.evaluation_templates;

create policy evaluation_templates_select on public.evaluation_templates
  for select to authenticated
  using (
    deleted_at is null
    and (
      organization_id is null
      or (
        organization_id = any ((select app.current_org_ids())::uuid[])
        and app.has_permission(organization_id, 'evaluations', 'read') <> 'none'
      )
    )
  );

-- Șablonul e artefact pe TOATĂ firma: îl folosește oricine evaluează pe
-- oricine. De aici scope-ul `all`, spre deosebire de evaluarea propriu-zisă,
-- pe care managerul o scrie pentru echipa lui. `0038` cerea aici
-- `employees:update in ('all','team')`, ceea ce ar fi lăsat un manager să
-- rescrie un șablon folosit de HR pe toată firma.
create policy evaluation_templates_insert on public.evaluation_templates
  for insert to authenticated
  with check (
    organization_id is not null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'evaluations', 'update') = 'all'
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

-- `organization_id is not null` rămâne poarta care face șabloanele de platformă
-- nemodificabile din aplicație. Ecranul nu oferă „Editează" pe ele; oferă
-- „Personalizează", care duplică în firmă.
create policy evaluation_templates_update on public.evaluation_templates
  for update to authenticated
  using (
    organization_id is not null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'evaluations', 'update') = 'all'
    and deleted_at is null
  )
  with check (
    organization_id is not null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'evaluations', 'update') = 'all'
    and updated_by = (select auth.uid())
  );

-- ============================================================
-- 5. POLITICI — EVALUĂRI
-- ============================================================

drop policy employee_evaluations_select on public.employee_evaluations;
drop policy employee_evaluations_insert on public.employee_evaluations;
drop policy employee_evaluations_update on public.employee_evaluations;

-- SELECT-ul folosește ACELAȘI predicat ca INSERT-ul, pe altă acțiune. Dacă ar
-- fi rămas pe `can_see_employee`, o divergență viitoare între employees.read și
-- evaluations.create ar fi produs capcana cunoscută: INSERT-ul trece, iar
-- `RETURNING` nu vede rândul, deci acțiunea raportează CONFLICT pe o scriere
-- care s-a făcut.
create policy employee_evaluations_select on public.employee_evaluations
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and app.can_access_evaluation(organization_id, employee_id, 'read')
  );

create policy employee_evaluations_insert on public.employee_evaluations
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can_access_evaluation(organization_id, employee_id, 'create')
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

-- Evaluarea finalizată e imuabilă pentru cine are scope de echipă. O corectură
-- după semnare rămâne posibilă, dar numai pentru `evaluations:update = all`
-- (hr, org_admin, super_admin) — și trece obligatoriu prin acțiunea
-- `redeschideEvaluare`, care lasă urmă în jurnalul de audit.
create policy employee_evaluations_update on public.employee_evaluations
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and app.can_access_evaluation(organization_id, employee_id, 'update')
    and (
      status = 'draft'
      or app.has_permission(organization_id, 'evaluations', 'update') = 'all'
    )
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can_access_evaluation(organization_id, employee_id, 'update')
    and updated_by = (select auth.uid())
  );

-- ============================================================
-- 6. ȘABLONUL DE PLATFORMĂ, ÎN FORMA NOUĂ
-- ============================================================

-- Rândul rămâne valid și fără asta (citirea normalizează), dar baza nu are de
-- ce să păstreze forma veche pe singurul rând pe care îl scrie ea însăși.
update public.evaluation_templates
   set criterii = '[
    {"cod": "calitate_munca", "denumire": "Calitatea muncii", "descriere": null, "tip": "scala", "scala_max": 5, "pondere": null},
    {"cod": "punctualitate", "denumire": "Punctualitate și disciplină", "descriere": null, "tip": "scala", "scala_max": 5, "pondere": null},
    {"cod": "lucru_echipa", "denumire": "Lucru în echipă", "descriere": null, "tip": "scala", "scala_max": 5, "pondere": null},
    {"cod": "initiativa", "denumire": "Inițiativă și implicare", "descriere": null, "tip": "scala", "scala_max": 5, "pondere": null}
  ]'::jsonb
 where organization_id is null
   and denumire = 'Evaluare anuală standard'
   and deleted_at is null;

commit;
