-- supabase/migrations/0005_hr_rls.sql
-- Faza 2 — politici RLS pentru nucleul HR + helperii de acces.
-- Reguli aplicate: S4 (enable + force, politici separate, fără DELETE),
-- S5 (SECURITY DEFINER cu search_path = ''), S6 (cast explicit la uuid[]),
-- S7 (OR de nivel superior parantezat), S8 (WITH CHECK complet la INSERT),
-- S10 (audit ALLOW-LIST, fără employee_sensitive_data).

begin;

-- ============================================================
-- 0. HELPERI DE CONTEXT
-- ============================================================

-- Fișa PRINCIPALĂ a utilizatorului curent în organizația dată.
-- Returnează null dacă utilizatorul nu are fișă de angajat (ex. contabil extern).
create or replace function app.current_employee_id(p_org uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id
  from public.employees e
  where e.organization_id = p_org
    and e.user_id = (select auth.uid())
    and e.is_primary
    and e.deleted_at is null
  limit 1
$$;

comment on function app.current_employee_id(uuid) is
  'Fișa de angajat principală (is_primary) a utilizatorului autentificat în organizația dată.';

-- Subordonare directă sau indirectă, fără CTE recursiv:
-- manager_path conține lanțul de la vârf până la angajat INCLUSIV,
-- deci „X e subordonatul lui M" ⇔ X.manager_path @> array[M].
-- Angajatul însuși intră în propriul manager_path → is_manager_of(org, self) = true,
-- ceea ce face ca scope='team' să includă și fișa proprie (comportament dorit).
create or replace function app.is_manager_of(p_org uuid, p_employee uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.employees e
    where e.id = p_employee
      and e.organization_id = p_org
      and e.deleted_at is null
      and e.manager_path @> array[app.current_employee_id(p_org)]::uuid[]
  )
$$;

comment on function app.is_manager_of(uuid, uuid) is
  'Adevărat dacă angajatul indicat se află în subarborele de subordonare al fișei curente.';

-- Predicat unic de citire pentru tabelele legate de un angajat.
-- Rezolvă cele trei domenii de vizibilitate într-o singură expresie, ca să nu
-- repetăm aceeași logică în 30 de politici.
create or replace function app.can_see_employee(p_org uuid, p_employee uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case app.has_permission(p_org, 'employees', 'read')
    when 'all' then true
    when 'team' then app.is_manager_of(p_org, p_employee)
    when 'own' then p_employee = app.current_employee_id(p_org)
    else false
  end
$$;

comment on function app.can_see_employee(uuid, uuid) is
  'Vizibilitatea unui angajat pentru utilizatorul curent, după scope-ul permisiunii employees.read.';

-- Aceeași idee pentru scriere (create/update pe fișele de angajat).
create or replace function app.can_write_employee(p_org uuid, p_employee uuid, p_action text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case app.has_permission(p_org, 'employees', p_action)
    when 'all' then true
    when 'team' then app.is_manager_of(p_org, p_employee)
    when 'own' then p_employee = app.current_employee_id(p_org)
    else false
  end
$$;

revoke all on function app.current_employee_id(uuid) from public;
revoke all on function app.is_manager_of(uuid, uuid) from public;
revoke all on function app.can_see_employee(uuid, uuid) from public;
revoke all on function app.can_write_employee(uuid, uuid, text) from public;
grant execute on function app.current_employee_id(uuid) to authenticated;
grant execute on function app.is_manager_of(uuid, uuid) to authenticated;
grant execute on function app.can_see_employee(uuid, uuid) to authenticated;
grant execute on function app.can_write_employee(uuid, uuid, text) to authenticated;

-- ============================================================
-- 1. DEPARTAMENTE
-- ============================================================

create policy departments_select on public.departments
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'departments', 'read') <> 'none'
  );

create policy departments_insert on public.departments
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'departments', 'create') = 'all'
    -- S8: starea inițială e fixată aici, nu lăsată la mâna clientului.
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
    and path = '{}'::uuid[]     -- calculat de trigger, niciodată trimis de client
    and depth = 0
  );

create policy departments_update on public.departments
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'departments', 'update') = 'all'
    and deleted_at is null
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'departments', 'update') = 'all'
    and updated_by = (select auth.uid())
  );

-- ============================================================
-- 2. FUNCȚII (nomenclator)
-- ============================================================

create policy job_positions_select on public.job_positions
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      app.has_permission(organization_id, 'departments', 'read') <> 'none'
      or app.has_permission(organization_id, 'employees', 'read') <> 'none'
    )   -- S7: OR-ul de nivel superior stă în paranteze proprii
  );

create policy job_positions_insert on public.job_positions
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'departments', 'create') = 'all'
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy job_positions_update on public.job_positions
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'departments', 'update') = 'all'
    and deleted_at is null
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'departments', 'update') = 'all'
    and updated_by = (select auth.uid())
  );

-- ============================================================
-- 3. ANGAJAȚI
-- ============================================================

create policy employees_select on public.employees
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      case app.has_permission(organization_id, 'employees', 'read')
        when 'all' then true
        when 'team' then manager_path @> array[app.current_employee_id(organization_id)]::uuid[]
        when 'own' then user_id = (select auth.uid())
        else false
      end
    )
  );

create policy employees_insert on public.employees
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'employees', 'create') = 'all'
    and deleted_at is null
    and terminated_on is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
    and manager_path = '{}'::uuid[]   -- calculat de trigger
    and status in ('candidat', 'activ')
  );

create policy employees_update on public.employees
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      case app.has_permission(organization_id, 'employees', 'update')
        when 'all' then true
        when 'team' then manager_path @> array[app.current_employee_id(organization_id)]::uuid[]
        when 'own' then user_id = (select auth.uid())
        else false
      end
    )
    and deleted_at is null
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      case app.has_permission(organization_id, 'employees', 'update')
        when 'all' then true
        when 'team' then manager_path @> array[app.current_employee_id(organization_id)]::uuid[]
        when 'own' then user_id = (select auth.uid())
        else false
      end
    )
    and updated_by = (select auth.uid())
  );

-- ============================================================
-- 4. DATE SENSIBILE — CNP / IBAN
-- ============================================================
-- Regula: acces numai cu employees.read = 'all'. Un manager de echipă (team)
-- NU vede CNP-ul subordonaților; nici angajatul propriul CNP prin acest canal —
-- portalul îl primește prin hr_read_sensitive, care lasă urmă în audit.

create policy sensitive_select on public.employee_sensitive_data
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'employees', 'read') = 'all'
    and deleted_at is null
  );

create policy sensitive_insert on public.employee_sensitive_data
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'employees', 'create') = 'all'
    and app.has_permission(organization_id, 'employees', 'read') = 'all'
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy sensitive_update on public.employee_sensitive_data
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'employees', 'update') = 'all'
    and app.has_permission(organization_id, 'employees', 'read') = 'all'
    and deleted_at is null
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'employees', 'update') = 'all'
    and updated_by = (select auth.uid())
  );

-- Citirea criptotextului: OBLIGATORIU trece prin funcția asta, care scrie în audit.
-- Decriptarea rămâne în aplicație (cheia AES nu intră niciodată în baza de date).
-- Payload-ul de audit conține DOAR numele coloanelor atinse — niciodată valorile.
create or replace function public.hr_read_sensitive(p_employee uuid)
returns table (
  employee_id uuid,
  organization_id uuid,
  cnp_ciphertext bytea,
  cnp_iv bytea,
  cnp_tag bytea,
  cnp_key_version int,
  cnp_last4 text,
  iban_ciphertext bytea,
  iban_iv bytea,
  iban_tag bytea,
  iban_key_version int,
  iban_last4 text,
  banca text
)
language plpgsql
volatile                       -- scrie în audit, deci NU stable
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_campuri text[] := '{}';
  v_rec record;
begin
  select e.organization_id into v_org
  from public.employees e
  where e.id = p_employee and e.deleted_at is null;

  if v_org is null then
    raise exception 'Fișa de angajat nu există sau a fost ștearsă.' using errcode = 'P0001';
  end if;
  if not (v_org = any ((select app.current_org_ids())::uuid[])) then
    raise exception 'Fișa de angajat aparține altei organizații.' using errcode = 'P0001';
  end if;
  if app.has_permission(v_org, 'employees', 'read') <> 'all' then
    raise exception 'Nu aveți dreptul de a consulta datele personale sensibile (CNP, IBAN). Solicitați acest drept administratorului organizației.'
      using errcode = 'P0001';
  end if;

  select s.* into v_rec
  from public.employee_sensitive_data s
  where s.employee_id = p_employee and s.deleted_at is null;

  if not found then
    raise exception 'Angajatul nu are date sensibile înregistrate.' using errcode = 'P0001';
  end if;

  if v_rec.cnp_ciphertext is not null then
    v_campuri := v_campuri || 'cnp';
  end if;
  if v_rec.iban_ciphertext is not null then
    v_campuri := v_campuri || 'iban';
  end if;

  insert into public.audit_logs (
    organization_id, actor_user_id, action, entity_type, entity_id, status, payload
  )
  values (
    v_org, (select auth.uid()), 'read', 'employee_sensitive_data', p_employee, 'success',
    jsonb_build_object(
      'campuri_citite', to_jsonb(v_campuri),
      'motiv', 'citire date sensibile din aplicație'
    )
  );

  return query
    select v_rec.employee_id, v_rec.organization_id,
           v_rec.cnp_ciphertext, v_rec.cnp_iv, v_rec.cnp_tag, v_rec.cnp_key_version, v_rec.cnp_last4,
           v_rec.iban_ciphertext, v_rec.iban_iv, v_rec.iban_tag, v_rec.iban_key_version, v_rec.iban_last4,
           v_rec.banca;
end;
$$;

-- Scrierea criptotextului. Aplicația criptează, funcția doar persistă și auditează.
-- Parametrii null înseamnă „nu atinge câmpul", nu „șterge-l".
create or replace function public.hr_write_sensitive(
  p_employee uuid,
  p_cnp_ciphertext bytea default null,
  p_cnp_iv bytea default null,
  p_cnp_tag bytea default null,
  p_cnp_key_version int default null,
  p_cnp_last4 text default null,
  p_cnp_hash text default null,
  p_iban_ciphertext bytea default null,
  p_iban_iv bytea default null,
  p_iban_tag bytea default null,
  p_iban_key_version int default null,
  p_iban_last4 text default null,
  p_iban_hash text default null,
  p_banca text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_uid uuid := (select auth.uid());
  v_campuri text[] := '{}';
  v_exista boolean;
begin
  select e.organization_id into v_org
  from public.employees e
  where e.id = p_employee and e.deleted_at is null;

  if v_org is null then
    raise exception 'Fișa de angajat nu există sau a fost ștearsă.' using errcode = 'P0001';
  end if;
  if not (v_org = any ((select app.current_org_ids())::uuid[])) then
    raise exception 'Fișa de angajat aparține altei organizații.' using errcode = 'P0001';
  end if;
  if app.has_permission(v_org, 'employees', 'update') <> 'all' then
    raise exception 'Nu aveți dreptul de a modifica datele personale sensibile (CNP, IBAN).'
      using errcode = 'P0001';
  end if;

  if p_cnp_ciphertext is not null then
    if p_cnp_iv is null or p_cnp_tag is null or p_cnp_key_version is null then
      raise exception 'CNP-ul criptat este incomplet: lipsesc vectorul de inițializare, eticheta sau versiunea cheii.'
        using errcode = 'P0001';
    end if;
    v_campuri := v_campuri || 'cnp';
  end if;
  if p_iban_ciphertext is not null then
    if p_iban_iv is null or p_iban_tag is null or p_iban_key_version is null then
      raise exception 'IBAN-ul criptat este incomplet: lipsesc vectorul de inițializare, eticheta sau versiunea cheii.'
        using errcode = 'P0001';
    end if;
    v_campuri := v_campuri || 'iban';
  end if;
  if p_banca is not null then
    v_campuri := v_campuri || 'banca';
  end if;

  if array_length(v_campuri, 1) is null then
    raise exception 'Nu ați indicat niciun câmp de actualizat.' using errcode = 'P0001';
  end if;

  select true into v_exista
  from public.employee_sensitive_data s
  where s.employee_id = p_employee;

  if v_exista then
    update public.employee_sensitive_data s
    set cnp_ciphertext  = coalesce(p_cnp_ciphertext, s.cnp_ciphertext),
        cnp_iv          = coalesce(p_cnp_iv, s.cnp_iv),
        cnp_tag         = coalesce(p_cnp_tag, s.cnp_tag),
        cnp_key_version = coalesce(p_cnp_key_version, s.cnp_key_version),
        cnp_last4       = coalesce(p_cnp_last4, s.cnp_last4),
        cnp_hash        = coalesce(p_cnp_hash, s.cnp_hash),
        iban_ciphertext  = coalesce(p_iban_ciphertext, s.iban_ciphertext),
        iban_iv          = coalesce(p_iban_iv, s.iban_iv),
        iban_tag         = coalesce(p_iban_tag, s.iban_tag),
        iban_key_version = coalesce(p_iban_key_version, s.iban_key_version),
        iban_last4       = coalesce(p_iban_last4, s.iban_last4),
        iban_hash        = coalesce(p_iban_hash, s.iban_hash),
        banca            = coalesce(p_banca, s.banca),
        deleted_at       = null,
        updated_by       = v_uid
    where s.employee_id = p_employee;
  else
    insert into public.employee_sensitive_data (
      employee_id, organization_id,
      cnp_ciphertext, cnp_iv, cnp_tag, cnp_key_version, cnp_last4, cnp_hash,
      iban_ciphertext, iban_iv, iban_tag, iban_key_version, iban_last4, iban_hash,
      banca, created_by, updated_by
    )
    values (
      p_employee, v_org,
      p_cnp_ciphertext, p_cnp_iv, p_cnp_tag, p_cnp_key_version, p_cnp_last4, p_cnp_hash,
      p_iban_ciphertext, p_iban_iv, p_iban_tag, p_iban_key_version, p_iban_last4, p_iban_hash,
      p_banca, v_uid, v_uid
    );
  end if;

  insert into public.audit_logs (
    organization_id, actor_user_id, action, entity_type, entity_id, status, payload
  )
  values (
    v_org, v_uid,
    case when v_exista then 'update' else 'create' end,
    'employee_sensitive_data', p_employee, 'success',
    jsonb_build_object(
      'campuri_modificate', to_jsonb(v_campuri),
      'motiv', 'scriere date sensibile din aplicație'
    )
  );

  return p_employee;
end;
$$;

revoke all on function public.hr_read_sensitive(uuid) from public;
revoke all on function public.hr_write_sensitive(uuid, bytea, bytea, bytea, int, text, text, bytea, bytea, bytea, int, text, text, text) from public;
grant execute on function public.hr_read_sensitive(uuid) to authenticated;
grant execute on function public.hr_write_sensitive(uuid, bytea, bytea, bytea, int, text, text, bytea, bytea, bytea, int, text, text, text) to authenticated;

-- ============================================================
-- 5. CONTRACTE
-- ============================================================

create policy contracts_select on public.employment_contracts
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can_see_employee(organization_id, employee_id)
  );

create policy contracts_insert on public.employment_contracts
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'employees', 'create') = 'all'
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
    and status = 'proiect'          -- orice contract pornește ca proiect
    and incetat_la is null
    and motiv_incetare is null
    and cod_revisal is null         -- se completează după transmitere
  );

create policy contracts_update on public.employment_contracts
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'employees', 'update') = 'all'
    and deleted_at is null
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'employees', 'update') = 'all'
    and updated_by = (select auth.uid())
  );

-- ============================================================
-- 6. TIPURI DE DOCUMENTE + DOCUMENTE
-- ============================================================

create policy doc_types_select on public.employee_document_types
  for select to authenticated
  using (
    deleted_at is null
    and (
      organization_id is null
      or organization_id = any ((select app.current_org_ids())::uuid[])
    )
  );

create policy doc_types_insert on public.employee_document_types
  for insert to authenticated
  with check (
    organization_id is not null      -- tipurile de platformă nu se creează din aplicație
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'employees', 'create') = 'all'
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy doc_types_update on public.employee_document_types
  for update to authenticated
  using (
    organization_id is not null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'employees', 'update') = 'all'
    and deleted_at is null
  )
  with check (
    organization_id is not null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'employees', 'update') = 'all'
    and updated_by = (select auth.uid())
  );

-- Documentele confidențiale rămân invizibile pentru scope 'own'/'team';
-- documentele nemarcate „vizibil angajatului" nu ajung în portal.
create policy employee_documents_select on public.employee_documents
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and (
      app.has_permission(organization_id, 'employees', 'read') = 'all'
      or (
        app.can_see_employee(organization_id, employee_id)
        and confidential = false
        and vizibil_angajatului = true
      )
    )
  );

create policy employee_documents_insert on public.employee_documents
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'employees', 'create') = 'all'
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy employee_documents_update on public.employee_documents
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'employees', 'update') = 'all'
    and deleted_at is null
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'employees', 'update') = 'all'
    and updated_by = (select auth.uid())
  );

-- ============================================================
-- 7. FIȘE DE POST
-- ============================================================

create policy job_descriptions_select on public.job_descriptions
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and (
      app.has_permission(organization_id, 'employees', 'read') = 'all'
      or (employee_id is not null and app.can_see_employee(organization_id, employee_id))
      or (employee_id is null and app.has_permission(organization_id, 'employees', 'read') <> 'none')
    )
  );

create policy job_descriptions_insert on public.job_descriptions
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'employees', 'create') = 'all'
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
    and semnat_la is null            -- semnătura se aplică ulterior, nu la creare
    and semnat_de_angajat = false
    and semnatura_ip is null
  );

-- Angajatul își poate semna propria fișă (scope 'own' pe employees.update);
-- HR-ul o poate modifica integral.
create policy job_descriptions_update on public.job_descriptions
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and (
      app.has_permission(organization_id, 'employees', 'update') = 'all'
      or (employee_id is not null and employee_id = app.current_employee_id(organization_id))
    )
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      app.has_permission(organization_id, 'employees', 'update') = 'all'
      or (employee_id is not null and employee_id = app.current_employee_id(organization_id))
    )
    and updated_by = (select auth.uid())
  );

-- ============================================================
-- 8. SCUTIRI FISCALE
-- ============================================================
-- Scutirile ating salarizarea: citirea cere payroll.read SAU employees.read = 'all'.

create policy exemptions_select on public.employee_tax_exemptions
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and (
      app.has_permission(organization_id, 'payroll', 'read') <> 'none'
      or app.has_permission(organization_id, 'employees', 'read') = 'all'
      or employee_id = app.current_employee_id(organization_id)
    )
  );

create policy exemptions_insert on public.employee_tax_exemptions
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      app.has_permission(organization_id, 'payroll', 'create') = 'all'
      or app.has_permission(organization_id, 'employees', 'create') = 'all'
    )
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy exemptions_update on public.employee_tax_exemptions
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and (
      app.has_permission(organization_id, 'payroll', 'update') = 'all'
      or app.has_permission(organization_id, 'employees', 'update') = 'all'
    )
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      app.has_permission(organization_id, 'payroll', 'update') = 'all'
      or app.has_permission(organization_id, 'employees', 'update') = 'all'
    )
    and updated_by = (select auth.uid())
  );

-- ============================================================
-- 9. PERMISE DE MUNCĂ
-- ============================================================

create policy work_permits_select on public.work_permits
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and (
      app.can_see_employee(organization_id, employee_id)
      or app.has_permission(organization_id, 'compliance', 'read') <> 'none'
    )
  );

create policy work_permits_insert on public.work_permits
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      app.has_permission(organization_id, 'employees', 'create') = 'all'
      or app.has_permission(organization_id, 'compliance', 'create') = 'all'
    )
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
    and notificat_la is null          -- se completează de jobul de alerte
  );

create policy work_permits_update on public.work_permits
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and (
      app.has_permission(organization_id, 'employees', 'update') = 'all'
      or app.has_permission(organization_id, 'compliance', 'update') = 'all'
    )
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      app.has_permission(organization_id, 'employees', 'update') = 'all'
      or app.has_permission(organization_id, 'compliance', 'update') = 'all'
    )
    and updated_by = (select auth.uid())
  );

-- ============================================================
-- 10. SPORURI — tipuri + componente
-- ============================================================

create policy salary_component_types_select on public.salary_component_types
  for select to authenticated
  using (
    deleted_at is null
    and (
      organization_id is null
      or organization_id = any ((select app.current_org_ids())::uuid[])
    )
  );

create policy salary_component_types_insert on public.salary_component_types
  for insert to authenticated
  with check (
    organization_id is not null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'payroll', 'create') = 'all'
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy salary_component_types_update on public.salary_component_types
  for update to authenticated
  using (
    organization_id is not null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'payroll', 'update') = 'all'
    and deleted_at is null
  )
  with check (
    organization_id is not null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'payroll', 'update') = 'all'
    and updated_by = (select auth.uid())
  );

-- Sporurile sunt date salariale: managerul de echipă NU le vede.
create policy salary_components_select on public.salary_components
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and (
      app.has_permission(organization_id, 'payroll', 'read') <> 'none'
      or app.has_permission(organization_id, 'employees', 'read') = 'all'
      or employee_id = app.current_employee_id(organization_id)
    )
  );

create policy salary_components_insert on public.salary_components
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      app.has_permission(organization_id, 'payroll', 'create') = 'all'
      or app.has_permission(organization_id, 'employees', 'create') = 'all'
    )
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy salary_components_update on public.salary_components
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and (
      app.has_permission(organization_id, 'payroll', 'update') = 'all'
      or app.has_permission(organization_id, 'employees', 'update') = 'all'
    )
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      app.has_permission(organization_id, 'payroll', 'update') = 'all'
      or app.has_permission(organization_id, 'employees', 'update') = 'all'
    )
    and updated_by = (select auth.uid())
  );

-- ============================================================
-- 11. ADEVERINȚE — șabloane + documente emise
-- ============================================================

create policy hr_templates_select on public.hr_document_templates
  for select to authenticated
  using (
    deleted_at is null
    and (
      organization_id is null
      or organization_id = any ((select app.current_org_ids())::uuid[])
    )
  );

create policy hr_templates_insert on public.hr_document_templates
  for insert to authenticated
  with check (
    organization_id is not null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'employees', 'create') = 'all'
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy hr_templates_update on public.hr_document_templates
  for update to authenticated
  using (
    organization_id is not null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'employees', 'update') = 'all'
    and deleted_at is null
  )
  with check (
    organization_id is not null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'employees', 'update') = 'all'
    and updated_by = (select auth.uid())
  );

create policy hr_issued_select on public.hr_issued_documents
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and app.can_see_employee(organization_id, employee_id)
  );

create policy hr_issued_insert on public.hr_issued_documents
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'employees', 'create') = 'all'
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
    and emis_de = (select auth.uid())
    and anulat_la is null             -- S8: anularea e o operație ulterioară
    and motiv_anulare is null
  );

-- Adeverința emisă nu se rescrie: se anulează. Actualizarea e permisă
-- doar pentru anulare / atașarea fișierului generat.
create policy hr_issued_update on public.hr_issued_documents
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and anulat_la is null
    and app.has_permission(organization_id, 'employees', 'update') = 'all'
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'employees', 'update') = 'all'
    and updated_by = (select auth.uid())
  );

-- ============================================================
-- 12. REVISAL
-- ============================================================

create policy revisal_config_select on public.revisal_config
  for select to authenticated
  using (
    deleted_at is null
    and (
      organization_id is null
      or organization_id = any ((select app.current_org_ids())::uuid[])
    )
  );

create policy revisal_config_insert on public.revisal_config
  for insert to authenticated
  with check (
    organization_id is not null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'compliance', 'create') = 'all'
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy revisal_config_update on public.revisal_config
  for update to authenticated
  using (
    organization_id is not null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'compliance', 'update') = 'all'
    and deleted_at is null
  )
  with check (
    organization_id is not null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'compliance', 'update') = 'all'
    and updated_by = (select auth.uid())
  );

create policy revisal_events_select on public.revisal_events
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and (
      app.has_permission(organization_id, 'compliance', 'read') <> 'none'
      or app.has_permission(organization_id, 'employees', 'read') = 'all'
    )
  );

create policy revisal_events_insert on public.revisal_events
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      app.has_permission(organization_id, 'compliance', 'create') = 'all'
      or app.has_permission(organization_id, 'employees', 'create') = 'all'
    )
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
    -- S8: starea de transmitere e zerofiată; se ajunge la ea doar prin acțiuni.
    and status = 'de_pregatit'
    and transmis_la is null
    and transmis_de is null
    and numar_inregistrare is null
    and export_path is null
    and export_checksum is null
    and eroare is null
  );

create policy revisal_events_update on public.revisal_events
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and (
      app.has_permission(organization_id, 'compliance', 'update') = 'all'
      or app.has_permission(organization_id, 'employees', 'update') = 'all'
    )
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      app.has_permission(organization_id, 'compliance', 'update') = 'all'
      or app.has_permission(organization_id, 'employees', 'update') = 'all'
    )
    and updated_by = (select auth.uid())
  );

-- ============================================================
-- 13. AUDIT — atașarea trigger-ului generic
-- Auditul este atașat în 0004, prin `internal.attach_audit()`.
--
-- Blocul care exista aici crea triggere către `audit.tg_audit_row()` — o funcție
-- care nu există; schema `audit` nu a existat niciodată în acest proiect.
-- Mecanismul real trăiește în `internal` și are garda R9 încorporată: refuză
-- automat orice tabelă cu coloane sensibile. Reatașarea de aici ar fi fost și
-- greșită, și redundantă.

-- ============================================================
-- 14. SEED — completări față de 0004 (DE VERIFICAT juridic)
-- ============================================================

-- Tipuri de documente suplimentare, cerute de fluxurile fazei 2.
insert into public.employee_document_types
  (organization_id, cod, denumire, cere_valabilitate, confidential_implicit, vizibil_angajatului_implicit, ordine)
values
  (null, 'act_identitate_strain', 'Document de identitate cetățean străin', true, true, true, 15),
  (null, 'acord_telemunca', 'Acord de telemuncă', false, true, true, 35),
  (null, 'declaratie_persoane_intretinere', 'Declarație persoane în întreținere', true, true, true, 45),
  (null, 'certificat_handicap', 'Certificat de încadrare în grad de handicap', true, true, true, 55),
  (null, 'decizie_incetare', 'Decizie de încetare a contractului', false, true, true, 95),
  (null, 'contract_ucenicie', 'Contract de ucenicie / internship', false, true, true, 25)
on conflict do nothing;

-- Sporuri suplimentare frecvente. DE VERIFICAT: tratamentul fiscal al
-- tichetelor de masă și al indemnizației de telemuncă se schimbă anual.
insert into public.salary_component_types
  (organization_id, cod, denumire, kind, impozabil, intra_in_baza_cas, intra_in_baza_cass, ordine)
values
  (null, 'spor_ore_suplimentare', 'Spor pentru ore suplimentare', 'spor_procent', true, true, true, 25),
  (null, 'spor_toxicitate', 'Spor pentru condiții periculoase/vătămătoare', 'spor_procent', true, true, true, 35),
  (null, 'indemn_telemunca', 'Indemnizație de telemuncă', 'indemnizatie', false, false, false, 55),  -- DE VERIFICAT: plafon lunar neimpozabil
  (null, 'tichete_masa', 'Tichete de masă', 'beneficiu_natura', true, false, true, 65),               -- DE VERIFICAT: impozit pe venit + CASS
  (null, 'spor_limba_straina', 'Spor pentru cunoașterea unei limbi străine', 'spor_procent', true, true, true, 45),
  (null, 'prima_vacanta', 'Primă de vacanță', 'prima_recurenta', true, true, true, 75)
on conflict do nothing;

-- REVISAL: nimic nou față de 0004 (H.G. 905/2017 acoperă toate tipurile de eveniment).
-- Rândul de mai jos există doar pentru cazul în care 0004 a fost aplicat parțial.
-- DE VERIFICAT: termenele se recitesc la fiecare modificare a H.G. 905/2017.
insert into public.revisal_config
  (organization_id, event_type, termen_zile, reper, zile_lucratoare, cod_revisal, descriere, valabil_de_la)
select null, 'angajare', -1, 'valabil_de_la', true, 'A',
       'Cel târziu în ziua lucrătoare anterioară începerii activității', date '2018-01-01'
where not exists (
  select 1 from public.revisal_config c
  where c.organization_id is null and c.event_type = 'angajare' and c.valabil_de_la = date '2018-01-01'
);

commit;

-- ── Privilegii de tabelă pentru tabelele noi ─────────────────────────────────
--
-- Fără acest bloc, tabelele din 0004 nu au niciun `GRANT` către `authenticated`,
-- iar politicile RLS de mai sus devin irelevante: accesul e refuzat mai devreme,
-- la nivel de privilegiu, cu „permission denied for table departments”.
--
-- `0001_kernel.sql` face `grant ... on all tables in schema public`, dar acela
-- se aplică tabelelor care existau ATUNCI. Orice migrare care creează tabele
-- trebuie să repete blocul. Bariera 3 verifică de acum acest lucru, ca defectul
-- să nu mai poată ajunge în producție.
revoke all on all tables in schema public from anon;
grant select, insert, update on all tables in schema public to authenticated;

-- Soft delete peste tot: DELETE rămâne revocat, iar absența politicii DELETE
-- este regula, nu o omisiune.
revoke delete on all tables in schema public from public, anon, authenticated;

-- Contorul de limitare nu se citește și nu se scrie din client; se atinge
-- exclusiv prin funcții SECURITY DEFINER.
revoke all on public.rate_limits from authenticated;

-- Datele sensibile nu se ating direct nici măcar de `authenticated` cu drepturi:
-- accesul trece obligatoriu prin `hr_read_sensitive` / `hr_write_sensitive`,
-- care scriu în audit la fiecare apel. Un SELECT direct ar ocoli auditul.
revoke all on public.employee_sensitive_data from authenticated;
