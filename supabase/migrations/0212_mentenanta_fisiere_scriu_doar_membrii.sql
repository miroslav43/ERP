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
-- 4. Verificarea migrării
-- ============================================================
do $$
declare
  v_lipsa text[] := '{}';
  f text;
begin
  foreach f in array array[
    'app.mentenanta_poate_atasament(uuid,text,uuid,text)',
    'app.mentenanta_poate_fisier(text,text)']
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
