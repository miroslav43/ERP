-- ─────────────────────────────────────────────────────────────────────────────
-- 0006_fix_hr_sensitive.sql — auditul citirii CNP/IBAN chiar funcționează
--
-- DEFECTELE, găsite de `plpgsql_check` pe Supabase (extensia nu există local,
-- deci verificarea de pe mașina de dezvoltare nu le putea vedea):
--
-- 1. `v_campuri := v_campuri || 'cnp'` — Postgres rezolvă operatorul ca
--    `anyarray || anyarray` și încearcă să parseze `'cnp'` ca literal de tablou:
--       ERROR: malformed array literal: "cnp"
--    Corecția este castul explicit, care selectează varianta `anyarray || anyelement`.
--
-- 2. INSERT-ul în `audit_logs` folosea coloanele `actor_user_id` și `payload`.
--    Ele NU EXISTĂ; tabela are `actor_id`, `before` și `after`.
--
-- De ce contează, dincolo de „nu compilează": ambele sunt pe calea de CITIRE a
-- CNP-ului. Funcția ar fi eșuat la primul apel real, iar întregul argument de
-- conformitate — „fiecare citire a unui CNP lasă o urmă în audit" — se sprijinea
-- pe cod care nu putea rula. O funcție PL/pgSQL se creează fără ca Postgres să-i
-- valideze corpul; abia `plpgsql_check` o pune la încercare.
-- ─────────────────────────────────────────────────────────────────────────────

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

  -- Castul explicit alege `anyarray || anyelement`. Fără el, Postgres încearcă
  -- `anyarray || anyarray` și cade pe „malformed array literal".
  if v_rec.cnp_ciphertext is not null then
    v_campuri := v_campuri || 'cnp'::text;
  end if;
  if v_rec.iban_ciphertext is not null then
    v_campuri := v_campuri || 'iban'::text;
  end if;

  -- Se înregistrează DOAR numele câmpurilor atinse, niciodată valorile: un rând
  -- de audit care ar conține criptotextul ar fi o a doua copie a datelor
  -- sensibile, într-o tabelă cu alte reguli de acces.
  insert into public.audit_logs (
    organization_id, actor_id, action, entity_type, entity_id, status, after
  )
  values (
    v_org, (select auth.uid()), 'view', 'employee_sensitive_data', p_employee, 'success',
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

revoke all on function public.hr_read_sensitive(uuid) from public, anon;
grant execute on function public.hr_read_sensitive(uuid) to authenticated;

-- ── Aceleași două defecte, pe calea de SCRIERE ──────────────────────────────
-- `|| 'cnp'` fără cast, plus coloanele inexistente `actor_user_id` / `payload`.
-- Se înregistrează în continuare DOAR numele câmpurilor modificate; valorile
-- criptate nu ies niciodată din tabela lor.

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
    v_campuri := v_campuri || 'cnp'::text;
  end if;
  if p_iban_ciphertext is not null then
    if p_iban_iv is null or p_iban_tag is null or p_iban_key_version is null then
      raise exception 'IBAN-ul criptat este incomplet: lipsesc vectorul de inițializare, eticheta sau versiunea cheii.'
        using errcode = 'P0001';
    end if;
    v_campuri := v_campuri || 'iban'::text;
  end if;
  if p_banca is not null then
    v_campuri := v_campuri || 'banca'::text;
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
    organization_id, actor_id, action, entity_type, entity_id, status, after
  )
  values (
    v_org, v_uid,
    -- CASE peste literale produce `text`; coloana e enum `audit_action`.
    (case when v_exista then 'update' else 'create' end)::public.audit_action,
    'employee_sensitive_data', p_employee, 'success',
    jsonb_build_object(
      'campuri_modificate', to_jsonb(v_campuri),
      'motiv', 'scriere date sensibile din aplicație'
    )
  );

  return p_employee;
end;
$$;

revoke all on function public.hr_write_sensitive(uuid, bytea, bytea, bytea, int, text, text, bytea, bytea, bytea, int, text, text, text) from public, anon;
grant execute on function public.hr_write_sensitive(uuid, bytea, bytea, bytea, int, text, text, bytea, bytea, bytea, int, text, text, text) to authenticated;
