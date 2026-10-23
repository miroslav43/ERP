-- supabase/migrations/0212_mentenanta_fisiere_scriu_doar_membrii.sql
--
-- MENTENANȚĂ, REVIZIA M10: PLATFORMA CITEȘTE FIȘIERELE FIRMELOR CLIENT, NU LE SCRIE.
--
-- ── CE ERA STRÂMB ───────────────────────────────────────────────────────────
-- `app.mentenanta_poate_atasament` (0181 §3) și `app.mentenanta_poate_fisier`
-- (0181 §3, rescrisă de 0210 §8) deschideau cu aceeași condiție pentru orice
-- acțiune:
--
--     app.is_platform_admin() or p_org = any (current_org_ids)
--
-- Pentru CITIRE e intenționat: consola de platformă vede ce văd firmele client
-- (`equipment_select`, `fault_reports_select` au aceeași ramură). Pentru SCRIERE
-- nu: `app.has_permission` întoarce `all` pentru orice administrator de
-- platformă (0063:79), deci mai departe `app.ssm_acces(org, 'maintenance',
-- 'update', null)` era adevărat în ORICE firmă. Rezultatul, aflat rulând pe banc
-- la revizia M10 (nu dedus din cod):
--
--   · un `super_admin` putea INSERA rânduri în `maintenance_attachments` într-o
--     firmă client (cu `created_by` = el), deci un fișier apărea în dosarul unui
--     echipament sau al unei sesizări fără ca firma să fi cerut ceva;
--   · putea URCA obiecte în `org-mentenanta/{firmă client}/...`, atât pe un
--     echipament existent, cât și pe o rezervare de intervenție (ramura nouă din
--     0210, care cântărea la fel);
--   · în același timp `INSERT` pe `equipment` și `UPDATE` pe `fault_reports` din
--     aceeași firmă cădeau cu 42501, iar celelalte buckete (`org-checklists`,
--     `org-documents` prin `app.can_path`) cer apartenența la firmă. Fișierele
--     mentenanței erau singura ușă de scriere a platformei în datele firmelor.
--
-- ── CE FACE ─────────────────────────────────────────────────────────────────
-- Rescrie cele două funcții de la FORMA ULTIMĂ (`poate_atasament`: 0181;
-- `poate_fisier`: 0210), schimbând un singur lucru: ramura de platformă rămâne
-- doar pentru `p_actiune = 'read'`; orice altă acțiune cere apartenența la firma
-- din cale. Restul — feature-ul pornit, entitatea existentă ÎN firma din cale,
-- `maintenance:update` pentru catalog, raportorul și tehnicianul atribuit pe
-- sesizarea lor, rezervarea PV — rămâne cuvânt cu cuvânt.
--
-- ── CE NU FACE ──────────────────────────────────────────────────────────────
--  · Nu schimbă politicile de pe `maintenance_attachments` și `storage.objects`:
--    ele chemau deja funcțiile cu `'update'` pe scriere, deci corecția stă toată
--    în funcții. Fără politici recreate, nu se pierde nicio clauză `WITH CHECK`.
--  · Nu atinge CITIREA: platforma vede în continuare atașamentele și obiectele.
--  · Nu atinge scrierile prin `service_role` (acțiunile serverului, jobul de
--    curățare a obiectelor neconfirmate): el nu trece prin RLS.
--
-- Probă: `tests/rls/izolare.sql`, blocul `(l)` M10 — super_admin refuzat pe
-- `maintenance_attachments` și pe `storage.objects` (roșu pe 0181/0210, verde
-- aici), cu org_admin și raportorul ca verificări POZITIVE pe aceleași căi.
--
-- §3b (M3, 21 oct 2026): tehnicianul atribuit unei sesizări trebuie să aibă
-- efectiv `maintenance:read` (P0001 altfel), iar `public.tehnicieni_mentenanta`
-- dă selectorului exact fișele care trec de regulă, dintre cele pe care
-- apelantul le vede prin RLS-ul pe `employees`. Probă:
-- `tests/rls/proba-sesizari-tehnician-cu-drept.sql`.
--
-- Aplicare: psql byte-exact, după bancul local; pe producție doar cu
-- confirmarea explicită a utilizatorului.

begin;

-- ============================================================
-- 1. Poarta atașamentelor: platforma doar citește
-- ============================================================
create or replace function app.mentenanta_poate_atasament(
  p_org uuid, p_tip text, p_id uuid, p_actiune text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_eu uuid;
begin
  if p_org is null or p_id is null then return false; end if;
  -- Citirea: și consola de platformă. Scrierea: DOAR membrii firmei din cale —
  -- `has_permission` dă `all` platformei, deci fără ramura asta ea ar fi trecut
  -- de orice verificare de drept de mai jos.
  if p_actiune = 'read' then
    if not (app.is_platform_admin() or p_org = any ((select app.current_org_ids())::uuid[])) then
      return false;
    end if;
  elsif not (p_org = any ((select app.current_org_ids())::uuid[])) then
    return false;
  end if;
  if not app.feature_on(p_org, 'maintenance') then return false; end if;

  if p_tip = 'fault_report' then
    if not app.mentenanta_vede_sesizarea(p_id) then return false; end if;
    if p_actiune = 'read' then return true; end if;
    v_eu := app.fisa_mea(p_org);
    return app.ssm_acces(p_org, 'maintenance', 'update', null)
        or exists (
          select 1 from public.fault_reports fr
           where fr.id = p_id and fr.organization_id = p_org and fr.deleted_at is null
             and v_eu is not null
             and (fr.raportat_de_employee_id = v_eu or fr.atribuit_employee_id = v_eu));
  end if;

  -- Catalogul: documente pe echipament, PV pe intervenție, scan pe autorizație.
  -- Entitatea trebuie să existe ÎN organizația din cale — altfel o cale cu id-ul
  -- altei firme ar trece pe drepturile apelantului din firma lui.
  if p_tip = 'equipment' then
    if not exists (select 1 from public.equipment e where e.id = p_id and e.organization_id = p_org) then
      return false;
    end if;
  elsif p_tip = 'intervention' then
    if not exists (select 1 from public.maintenance_interventions i where i.id = p_id and i.organization_id = p_org) then
      return false;
    end if;
  elsif p_tip = 'iscir_authorization' then
    if not exists (select 1 from public.iscir_authorizations a where a.id = p_id and a.organization_id = p_org) then
      return false;
    end if;
  else
    return false;
  end if;

  return case p_actiune
    when 'read' then app.ssm_acces(p_org, 'maintenance', 'read', null)
    else app.ssm_acces(p_org, 'maintenance', 'update', null)
  end;
end;
$$;

-- ============================================================
-- 2. Poarta bucketului: rezervarea PV nu mai e deschisă platformei
-- ============================================================
-- De la forma din 0210 §8. Singura schimbare: ramura `intervention` cu id
-- inexistent (rezervarea) cere apartenența la firma din cale, fără
-- `is_platform_admin()`. Ramurile cu entitate existentă trec prin funcția de mai
-- sus, care acum tratează citirea și scrierea separat.
create or replace function app.mentenanta_poate_fisier(p_name text, p_actiune text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org  uuid := app.path_org(p_name);
  v_tip  text := app.path_segment(p_name, 2);
  v_id   text := app.path_segment(p_name, 3);
begin
  if v_org is null or v_tip is null or v_id is null or app.path_segment(p_name, 4) is null then
    return false;
  end if;
  if v_tip not in ('fault_report', 'equipment', 'intervention', 'iscir_authorization') then
    return false;
  end if;
  if v_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  if v_tip = 'intervention'
     and not exists (select 1 from public.maintenance_interventions i where i.id = v_id::uuid) then
    return v_org = any ((select app.current_org_ids())::uuid[])
       and app.feature_on(v_org, 'maintenance')
       and app.ssm_acces(v_org, 'maintenance', 'update', null);
  end if;
  return app.mentenanta_poate_atasament(v_org, v_tip, v_id::uuid, p_actiune);
end;
$$;

-- ============================================================
-- 3. Drepturi pe funcții (neschimbate față de 0181)
-- ============================================================
do $$
declare f text;
begin
  foreach f in array array[
    'app.mentenanta_poate_atasament(uuid,text,uuid,text)',
    'app.mentenanta_poate_fisier(text,text)']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ============================================================
-- 3b. Tehnicianul atribuit trebuie să poată deschide sesizarea (M3)
-- ============================================================
-- Defectul (integrarea din 21 oct 2026): selectorul de tehnician oferea orice
-- fișă a firmei, iar garda din 0181 §5 verifica doar că fișa e a firmei. Un
-- angajat al cărui rol n-are `maintenance:read` (de ex. `hr`, care n-are niciun
-- rând `maintenance` în seed) primea atribuirea și notificarea, apoi sesizarea
-- nu i se deschidea. Nu baza o ascundea: `fault_reports_select` (0181) are
-- ramura „atribuită mie”, deci rândul i se citește (verificat pe banc). O
-- închid paginile: atât `/mentenanta/sesizari/[id]`, cât și
-- `/portal/sesizari/[id]` cer `can(maintenance:read, own)`, adică exact
-- `maintenance:read` ≠ none.
--
-- Regula, într-un singur loc (`internal.tehnician_cu_drept`, folosită de trigger
-- și de selector): tehnicianul NOU are cont, e membru ACTIV și are efectiv
-- `maintenance:read` ≠ none (`internal.scope_membru`, 0189: suprascrierea pe
-- membru bate organizația, organizația bate globalul). Trigger separat, nu o
-- rescriere a gărzii din 0181: se aplică doar când tehnicianul se SCHIMBĂ, deci
-- nu blochează gesturile pe o sesizare atribuită înainte cuiva care și-a pierdut
-- între timp dreptul (gestionarul o reatribuie). Rulează după `fault_reports_garda`
-- (ordinea alfabetică a triggerelor BEFORE), deci „fișa altei firme” primește
-- mesajul gărzii. Contextul de serviciu (seed, clientul admin) sare peste
-- verificarea drepturilor, ca toate triggerele cu drepturi; apartenența la firmă
-- o păzește garda.
create or replace function internal.tehnician_cu_drept(p_org uuid, p_employee uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.employees e
      join public.organization_members m
        on m.organization_id = e.organization_id
       and m.user_id = e.user_id
       and m.status = 'active'
       and m.deleted_at is null
     where e.id = p_employee
       and e.organization_id = p_org
       and e.deleted_at is null
       and e.user_id is not null
       and internal.scope_membru(p_org, e.user_id, 'maintenance', 'read') <> 'none'
  );
$$;

comment on function internal.tehnician_cu_drept(uuid, uuid) is
  'Fișa poate primi o sesizare (0212 §3b): cont activ în firmă și maintenance:read efectiv ≠ none. Regula comună a triggerului fault_reports_tehnician_cu_drept și a selectorului.';

create or replace function internal.fault_reports_tehnician_cu_drept()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if app.is_service_context() then
    return new;
  end if;
  -- Y2: garda de firmă, înaintea căutării tehnicianului în firma RÂNDULUI.
  -- Pe `fault_reports` primul BEFORE e `fault_reports_garda` (0181), care are
  -- aceeași gardă din 0233; aici rămâne pentru cazul în care ordinea se schimbă.
  if not coalesce(new.organization_id = any ((select app.current_org_ids())::uuid[]), false) then
    raise exception using errcode = '42501',
      message = 'Nu aveți dreptul de a scrie sesizări în această organizație.';
  end if;
  if new.atribuit_employee_id is null
     or (tg_op = 'UPDATE' and new.atribuit_employee_id is not distinct from old.atribuit_employee_id) then
    return new;
  end if;
  if not internal.tehnician_cu_drept(new.organization_id, new.atribuit_employee_id) then
    raise exception using errcode = 'P0001',
      message = 'Tehnicianul ales nu poate deschide sesizările: nu are cont activ sau rolul lui nu are acces la mentenanță. Alegeți un tehnician din listă.';
  end if;
  return new;
end;
$$;

drop trigger if exists fault_reports_tehnician_cu_drept on public.fault_reports;
create trigger fault_reports_tehnician_cu_drept
  before insert or update of atribuit_employee_id on public.fault_reports
  for each row execute function internal.fault_reports_tehnician_cu_drept();

revoke all on function internal.tehnician_cu_drept(uuid, uuid) from public, anon, authenticated;
revoke all on function internal.fault_reports_tehnician_cu_drept() from public, anon, authenticated;

-- Garda selectorului, pe O fișă: apelantul gestionează mentenanța în firmă
-- (`maintenance:update` ≥ team, ca `atribuieSesizare`) și fișa trece de regulă.
-- SECURITY DEFINER fiindcă drepturile altor membri (`role_permissions` pe membru,
-- `organization_members`) nu se citesc prin RLS. În schema `app`: PostgREST n-o
-- expune, deci se ajunge la ea doar prin selectorul de mai jos.
create or replace function app.poate_primi_sesizari(p_org uuid, p_employee uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_org is not null
     and p_org = any ((select app.current_org_ids())::uuid[])
     and app.feature_on(p_org, 'maintenance')
     and app.ssm_acces(p_org, 'maintenance', 'update', null)
     and internal.tehnician_cu_drept(p_org, p_employee);
$$;

comment on function app.poate_primi_sesizari(uuid, uuid) is
  'Garda selectorului de tehnician (0212 §3b): apelantul are maintenance:update ≥ team în firmă și fișa are cont activ și maintenance:read efectiv ≠ none.';

revoke all on function app.poate_primi_sesizari(uuid, uuid) from public, anon;
grant execute on function app.poate_primi_sesizari(uuid, uuid) to authenticated;

-- Selectorul de tehnician, cu ACEEAȘI regulă ca triggerul. Doar gestionarul
-- atribuie; ceilalți primesc zero rânduri, fără eroare.
--
-- SECURITY INVOKER, deliberat: lista de OAMENI trece prin RLS-ul apelantului pe
-- `employees` (`employees_select`, 0005), ca `optiuniAngajati` dinainte. Prima
-- formă era SECURITY DEFINER pe tot și îi dădea unui gestionar `team` (o
-- suprascriere `maintenance:update = team`, cu `employees:read = team`) numele
-- tuturor angajaților eligibili din firmă, nu doar ale echipei lui (santinela
-- A5; `tests/rls/proba-sesizari-tehnician-cu-drept.sql` (11)). Doar drepturile
-- celorlalți se judecă privilegiat, în `app.poate_primi_sesizari`.
create or replace function public.tehnicieni_mentenanta(p_organization_id uuid)
returns table (id uuid, full_name text)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.id, e.full_name
    from public.employees e
   where e.organization_id = p_organization_id
     and e.deleted_at is null
     and e.user_id is not null
     and app.poate_primi_sesizari(p_organization_id, e.id)
   order by e.full_name nulls last, e.id
   limit 500;
$$;

comment on function public.tehnicieni_mentenanta(uuid) is
  'Fișele care pot primi o sesizare (0212 §3b): cont activ în firmă și maintenance:read efectiv ≠ none, dintre cele pe care apelantul le vede prin RLS. Doar pentru gestionarul mentenanței (update ≥ team); altfel zero rânduri.';

revoke all on function public.tehnicieni_mentenanta(uuid) from public, anon;
grant execute on function public.tehnicieni_mentenanta(uuid) to authenticated;

-- ============================================================
-- 4. Verificarea migrării
-- ============================================================
do $$
declare
  v_lipsa text[] := '{}';
  f text;
begin
  if not exists (select 1 from pg_catalog.pg_trigger
                  where tgname = 'fault_reports_tehnician_cu_drept'
                    and tgrelid = 'public.fault_reports'::regclass) then
    v_lipsa := v_lipsa || 'triggerul fault_reports_tehnician_cu_drept';
  end if;
  if has_function_privilege('anon', 'public.tehnicieni_mentenanta(uuid)'::regprocedure, 'execute') then
    v_lipsa := v_lipsa || 'tehnicieni_mentenanta executabilă de anon';
  end if;
  if not has_function_privilege('authenticated', 'public.tehnicieni_mentenanta(uuid)'::regprocedure, 'execute') then
    v_lipsa := v_lipsa || 'tehnicieni_mentenanta neexecutabilă de authenticated';
  end if;
  -- Selectorul trece prin RLS-ul apelantului pe `employees`: NU security definer.
  if exists (select 1 from pg_catalog.pg_proc p
              where p.oid = 'public.tehnicieni_mentenanta(uuid)'::regprocedure and p.prosecdef) then
    v_lipsa := v_lipsa || 'tehnicieni_mentenanta e security definer (ar ocoli RLS-ul pe employees)';
  end if;
  if has_function_privilege('authenticated', 'internal.tehnician_cu_drept(uuid,uuid)'::regprocedure, 'execute') then
    v_lipsa := v_lipsa || 'internal.tehnician_cu_drept executabilă de authenticated';
  end if;
  if not exists (select 1 from pg_catalog.pg_proc p
                  where p.oid = 'internal.tehnician_cu_drept(uuid,uuid)'::regprocedure
                    and p.prosecdef and p.proconfig @> array['search_path=""']) then
    v_lipsa := v_lipsa || 'internal.tehnician_cu_drept fără security definer sau fără search_path vid';
  end if;
  foreach f in array array[
    'app.mentenanta_poate_atasament(uuid,text,uuid,text)',
    'app.mentenanta_poate_fisier(text,text)',
    'app.poate_primi_sesizari(uuid,uuid)']
  loop
    if not exists (
      select 1 from pg_catalog.pg_proc p
       where p.oid = f::regprocedure
         and p.prosecdef
         and p.proconfig @> array['search_path=""']
    ) then
      v_lipsa := v_lipsa || (f || ' fără security definer sau fără search_path vid');
    end if;
    if has_function_privilege('anon', f::regprocedure, 'execute') then
      v_lipsa := v_lipsa || (f || ' executabilă de anon');
    end if;
    if not has_function_privilege('authenticated', f::regprocedure, 'execute') then
      v_lipsa := v_lipsa || (f || ' neexecutabilă de authenticated');
    end if;
  end loop;
  -- Ramura nouă din poarta atașamentelor: scrierea nu mai trece prin platformă.
  if pg_get_functiondef('app.mentenanta_poate_atasament(uuid,text,uuid,text)'::regprocedure)
       not like '%p_actiune = ''read''%' then
    v_lipsa := v_lipsa || 'poate_atasament nu mai separă citirea de scriere';
  end if;
  if pg_get_functiondef('app.mentenanta_poate_fisier(text,text)'::regprocedure)
       like '%is_platform_admin%' then
    v_lipsa := v_lipsa || 'poate_fisier mai primește platforma pe rezervare';
  end if;
  if array_length(v_lipsa, 1) > 0 then
    raise exception 'Migrarea 0212 e incompletă: %', array_to_string(v_lipsa, '; ');
  end if;
end $$;

commit;
