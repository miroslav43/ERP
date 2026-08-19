-- supabase/migrations/0030_onboarding_companie.sql
-- Înrolarea companiei: profil legal/fiscal complet, reprezentant legal
-- structurat, conturi bancare, puncte de lucru, program de plată, furnizor
-- SSM extern, activarea scutirilor fiscale deja modelate în 0004_hr.sql, și
-- pregătirea invitației automate a primului owner la finalul wizardului.
--
-- Toate coloanele noi pe tabele existente sunt nullable sau au un default
-- sigur — nimic breaking pe rânduri deja existente.

begin;

-- ============================================================
-- 1. ORGANIZATIONS — coloane noi
-- ============================================================

alter table public.organizations
  add column capital_social numeric(14, 2),
  add column cod_caen text,
  add column sector text,
  add column functie_reprezentant_legal text,
  add column ssm_furnizor_extern text,
  add column ssm_persoana_responsabila text,
  add column zile_concediu_anual_implicit smallint not null default 20;

alter table public.organizations
  add constraint organizations_capital_social_ck check (capital_social is null or capital_social >= 0),
  add constraint organizations_cod_caen_ck check (cod_caen is null or cod_caen ~ '^[0-9]{4}$'),
  -- Sectorul are sens doar în București; oriunde altundeva trebuie să rămână gol.
  add constraint organizations_sector_ck check (
    sector is null
    or (judet = 'București' and sector ~ '^[1-6]$')
  ),
  add constraint organizations_functie_reprezentant_ck
    check (functie_reprezentant_legal is null or char_length(functie_reprezentant_legal) <= 120),
  add constraint organizations_ssm_furnizor_ck
    check (ssm_furnizor_extern is null or char_length(ssm_furnizor_extern) <= 200),
  add constraint organizations_ssm_persoana_ck
    check (ssm_persoana_responsabila is null or char_length(ssm_persoana_responsabila) <= 160),
  add constraint organizations_zile_concediu_ck
    check (zile_concediu_anual_implicit between 0 and 60);

comment on column public.organizations.zile_concediu_anual_implicit is
  'Valoarea canonică a numărului de zile de concediu — folosită de internal.seed_leave_defaults() la crearea organizației și ca implicit la crearea unui contract nou.';

-- ============================================================
-- 2. REPREZENTANT LEGAL — CNP criptat, exact ca employee_sensitive_data
-- ============================================================
-- Scrierea/citirea NU trec prin RLS direct (ar fi un standard mai slab decât
-- la angajați): merg exclusiv prin org_write_sensitive/org_read_sensitive de
-- mai jos, SECURITY DEFINER, cu audit la fiecare citire în clar.

create table public.organization_sensitive_data (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  cnp_ciphertext bytea,
  cnp_iv bytea,
  cnp_tag bytea,
  cnp_key_version int,
  cnp_last4 text,
  cnp_hash text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint org_sensitive_cnp_complet check (
    (cnp_ciphertext is null and cnp_iv is null and cnp_tag is null and cnp_key_version is null)
    or (cnp_ciphertext is not null and cnp_iv is not null and cnp_tag is not null and cnp_key_version is not null)
  )
);

-- Fără GRANT implicit pe authenticated: la fel ca employee_sensitive_data,
-- accesul trece obligatoriu prin funcțiile SECURITY DEFINER de mai jos.
create trigger set_actor_organization_sensitive_data before insert or update on public.organization_sensitive_data
  for each row execute function internal.set_actor();
create trigger set_updated_at_organization_sensitive_data before update on public.organization_sensitive_data
  for each row execute function app.set_updated_at();

create or replace function public.org_write_sensitive(
  p_organization_id uuid,
  p_cnp_ciphertext bytea default null,
  p_cnp_iv bytea default null,
  p_cnp_tag bytea default null,
  p_cnp_key_version int default null,
  p_cnp_last4 text default null,
  p_cnp_hash text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_exista boolean;
begin
  if not (p_organization_id = any ((select app.current_org_ids())::uuid[])) then
    raise exception 'Organizația nu vă este accesibilă.' using errcode = 'P0001';
  end if;
  if app.has_permission(p_organization_id, 'organizations', 'update') <> 'all' then
    raise exception 'Nu aveți dreptul de a modifica datele personale sensibile ale reprezentantului legal.'
      using errcode = 'P0001';
  end if;

  if p_cnp_ciphertext is not null
     and (p_cnp_iv is null or p_cnp_tag is null or p_cnp_key_version is null) then
    raise exception 'CNP-ul criptat este incomplet: lipsesc vectorul de inițializare, eticheta sau versiunea cheii.'
      using errcode = 'P0001';
  end if;

  select true into v_exista
  from public.organization_sensitive_data s
  where s.organization_id = p_organization_id;

  if v_exista then
    update public.organization_sensitive_data s
    set cnp_ciphertext  = coalesce(p_cnp_ciphertext, s.cnp_ciphertext),
        cnp_iv          = coalesce(p_cnp_iv, s.cnp_iv),
        cnp_tag         = coalesce(p_cnp_tag, s.cnp_tag),
        cnp_key_version = coalesce(p_cnp_key_version, s.cnp_key_version),
        cnp_last4       = coalesce(p_cnp_last4, s.cnp_last4),
        cnp_hash        = coalesce(p_cnp_hash, s.cnp_hash),
        deleted_at      = null,
        updated_by      = v_uid
    where s.organization_id = p_organization_id;
  else
    insert into public.organization_sensitive_data (
      organization_id, cnp_ciphertext, cnp_iv, cnp_tag, cnp_key_version, cnp_last4, cnp_hash,
      created_by, updated_by
    )
    values (
      p_organization_id, p_cnp_ciphertext, p_cnp_iv, p_cnp_tag, p_cnp_key_version, p_cnp_last4, p_cnp_hash,
      v_uid, v_uid
    );
  end if;

  insert into public.audit_logs (
    organization_id, actor_id, action, entity_type, entity_id, status, after
  )
  values (
    p_organization_id, v_uid,
    (case when v_exista then 'update' else 'create' end)::public.audit_action,
    'organization_sensitive_data', p_organization_id, 'success',
    jsonb_build_object('motiv', 'scriere CNP reprezentant legal din aplicație')
  );

  return p_organization_id;
end;
$$;

revoke all on function public.org_write_sensitive(uuid, bytea, bytea, bytea, int, text, text) from public, anon;
grant execute on function public.org_write_sensitive(uuid, bytea, bytea, bytea, int, text, text) to authenticated;

create or replace function public.org_read_sensitive(p_organization_id uuid)
returns table (
  organization_id uuid,
  cnp_ciphertext bytea,
  cnp_iv bytea,
  cnp_tag bytea,
  cnp_key_version int,
  cnp_last4 text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_rec record;
begin
  if not (p_organization_id = any ((select app.current_org_ids())::uuid[])) then
    raise exception 'Organizația nu vă este accesibilă.' using errcode = 'P0001';
  end if;
  if app.has_permission(p_organization_id, 'organizations', 'update') <> 'all' then
    raise exception 'Nu aveți dreptul de a consulta datele personale sensibile ale reprezentantului legal.'
      using errcode = 'P0001';
  end if;

  select s.* into v_rec
  from public.organization_sensitive_data s
  where s.organization_id = p_organization_id and s.deleted_at is null;

  if not found or v_rec.cnp_ciphertext is null then
    raise exception 'Reprezentantul legal nu are CNP înregistrat.' using errcode = 'P0001';
  end if;

  insert into public.audit_logs (
    organization_id, actor_id, action, entity_type, entity_id, status, after
  )
  values (
    p_organization_id, v_uid, 'view', 'organization_sensitive_data', p_organization_id, 'success',
    jsonb_build_object('motiv', 'citire CNP reprezentant legal din aplicație')
  );

  return query
    select v_rec.organization_id, v_rec.cnp_ciphertext, v_rec.cnp_iv, v_rec.cnp_tag,
           v_rec.cnp_key_version, v_rec.cnp_last4;
end;
$$;

revoke all on function public.org_read_sensitive(uuid) from public, anon;
grant execute on function public.org_read_sensitive(uuid) to authenticated;

-- ============================================================
-- 3. CONTURI BANCARE ALE COMPANIEI
-- ============================================================
-- IBAN-ul companiei NU se criptează: apare oricum pe facturi, e disclosure
-- normal de business — la fel ca CUI-ul, nu ca datele personale ale cuiva.

create table public.organization_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  banca text not null,
  iban text not null,
  moneda text not null default 'RON',
  este_principal boolean not null default false,
  activ boolean not null default true,
  observatii text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint bank_accounts_banca_len check (char_length(banca) between 2 and 160),
  constraint bank_accounts_iban_format check (iban ~* '^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$'),
  constraint bank_accounts_moneda_format check (moneda ~ '^[A-Z]{3}$')
);

create unique index bank_accounts_org_iban_uq
  on public.organization_bank_accounts (organization_id, upper(iban))
  where deleted_at is null;
-- Un singur cont principal per organizație.
create unique index bank_accounts_org_principal_uq
  on public.organization_bank_accounts (organization_id)
  where este_principal and deleted_at is null;
create index bank_accounts_org_idx on public.organization_bank_accounts (organization_id, activ);

grant select, insert, update on public.organization_bank_accounts to authenticated;

create trigger set_actor_organization_bank_accounts before insert or update on public.organization_bank_accounts
  for each row execute function internal.set_actor();
create trigger set_updated_at_organization_bank_accounts before update on public.organization_bank_accounts
  for each row execute function app.set_updated_at();

create policy bank_accounts_select on public.organization_bank_accounts
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'organizations', 'read') <> 'none'
  );

create policy bank_accounts_insert on public.organization_bank_accounts
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'organizations', 'update') = 'all'
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy bank_accounts_update on public.organization_bank_accounts
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'organizations', 'update') = 'all'
    and deleted_at is null
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'organizations', 'update') = 'all'
    and updated_by = (select auth.uid())
  );

alter table public.organization_bank_accounts enable row level security;
alter table public.organization_bank_accounts force row level security;

select internal.attach_audit('organization_bank_accounts');

-- ============================================================
-- 4. PUNCTE DE LUCRU
-- ============================================================
-- Precedent structural: departments — dar flat (fără parent_id/path/depth),
-- fiindcă un punct de lucru e o locație fizică, nu o ierarhie. RLS-ul
-- reutilizează deliberat resursa de permisiuni 'departments' (structură
-- organizatorică), ca să nu fie nevoie de un rând nou în role_permissions.

create table public.puncte_lucru (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  denumire text not null,
  adresa text,
  judet text,
  oras text,
  cod_postal text,
  sediu_principal boolean not null default false,
  activ boolean not null default true,
  observatii text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint puncte_lucru_denumire_len check (char_length(denumire) between 2 and 160)
);

create unique index puncte_lucru_org_denumire_uq
  on public.puncte_lucru (organization_id, lower(denumire))
  where deleted_at is null;
create index puncte_lucru_org_activ_idx on public.puncte_lucru (organization_id, activ);

grant select, insert, update on public.puncte_lucru to authenticated;

create trigger set_actor_puncte_lucru before insert or update on public.puncte_lucru
  for each row execute function internal.set_actor();
create trigger set_updated_at_puncte_lucru before update on public.puncte_lucru
  for each row execute function app.set_updated_at();

create policy puncte_lucru_select on public.puncte_lucru
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'departments', 'read') <> 'none'
  );

create policy puncte_lucru_insert on public.puncte_lucru
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'departments', 'create') = 'all'
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy puncte_lucru_update on public.puncte_lucru
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

alter table public.puncte_lucru enable row level security;
alter table public.puncte_lucru force row level security;

select internal.attach_audit('puncte_lucru');

-- ============================================================
-- 5. PAYROLL_SETTINGS / PAYROLL_ENTRIES — coloane noi
-- ============================================================

alter table public.payroll_settings
  add column plata_avans boolean not null default false,
  add column ziua_plata_avans smallint,
  add column ziua_plata_lichidare smallint,
  add column tichete_furnizor text;

alter table public.payroll_settings
  add constraint payroll_settings_ziua_avans_ck
    check (ziua_plata_avans is null or ziua_plata_avans between 1 and 31),
  add constraint payroll_settings_ziua_lichidare_ck
    check (ziua_plata_lichidare is null or ziua_plata_lichidare between 1 and 31),
  add constraint payroll_settings_avans_completare_ck
    check (plata_avans = false or ziua_plata_avans is not null),
  add constraint payroll_settings_tichete_furnizor_ck
    check (tichete_furnizor is null or tichete_furnizor in ('edenred', 'pluxee', 'up', 'sodexo', 'altul'));

-- Suma scutirii aplicate trebuie vizibilă pe fluturaș, nu doar în calc_breakdown JSON.
alter table public.payroll_entries
  add column scutire_fiscala numeric(14, 2) not null default 0;

-- ============================================================
-- 6. INVITATIONS — nume/prenume/telefon, capturate la înrolare
-- ============================================================
-- internal.guard_invitations() nu are nevoie de nicio schimbare: scrierea
-- prin service-role (calea folosită de invitaMembru) trece deja nemodificată.

alter table public.invitations
  add column nume text,
  add column prenume text,
  add column telefon text;

alter table public.invitations
  add constraint invitations_nume_len check (nume is null or char_length(nume) <= 120),
  add constraint invitations_prenume_len check (prenume is null or char_length(prenume) <= 120),
  add constraint invitations_telefon_len check (telefon is null or char_length(telefon) <= 32);

-- ============================================================
-- 7. accept_invitation — precompletează profilul din datele invitației
-- ============================================================
-- Aditiv, coalesce: nu suprascrie NICIODATĂ un nume/telefon deja setat de
-- utilizator. peek_invitation() rămâne neschimbată (nu expune aceste date
-- înainte de acceptare, la fel ca emailul azi).

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_user   record;
  v_inv    record;
  v_membru record;
  v_id     uuid;
begin
  if v_uid is null then
    raise exception 'Trebuie să fii autentificat pentru a accepta invitația.' using errcode = 'PT401';
  end if;

  select u.email, u.email_confirmed_at into v_user from auth.users u where u.id = v_uid;
  if v_user.email_confirmed_at is null then
    raise exception 'Confirmă mai întâi adresa de e-mail, apoi acceptă invitația.'
      using errcode = 'PT403';
  end if;

  select * into v_inv
  from public.invitations i
  where i.token_hash = internal.sha256_hex(btrim(coalesce(p_token, '')))
    and i.deleted_at is null
  for update;

  if not found then
    raise exception 'Invitație inexistentă sau deja folosită.' using errcode = 'PT404';
  end if;

  if v_inv.status <> 'pending' then
    raise exception 'Invitația a fost deja folosită sau revocată.' using errcode = 'PT409';
  end if;

  if v_inv.expires_at <= now() then
    update public.invitations set status = 'expired' where id = v_inv.id;
    perform app.write_audit('invite_accepted', v_inv.organization_id, 'invitations', v_inv.id,
                            null, null, 'denied', 'PT410');
    raise exception 'Invitația a expirat. Cere una nouă administratorului.' using errcode = 'PT410';
  end if;

  if lower(v_user.email::text) <> lower(v_inv.email::text) then
    perform app.write_audit('invite_accepted', v_inv.organization_id, 'invitations', v_inv.id,
                            null, null, 'denied', 'PT403');
    raise exception 'Invitația este emisă pentru altă adresă de e-mail.' using errcode = 'PT403';
  end if;

  select * into v_membru
  from public.organization_members m
  where m.organization_id = v_inv.organization_id and m.user_id = v_uid;

  if found then
    if v_membru.deleted_at is not null or v_membru.status in ('inactive', 'suspended') then
      perform app.write_audit('invite_accepted', v_inv.organization_id, 'organization_members',
                              v_membru.id, null, null, 'denied', 'PT409');
      raise exception 'Ai avut anterior acces la această organizație. Este necesară reînrolarea manuală de către un administrator.'
        using errcode = 'PT409';
    end if;
    raise exception 'Ești deja membru al acestei organizații.' using errcode = 'PT409';
  end if;

  insert into public.organization_members
    (organization_id, user_id, role, status, invited_by, invitation_id, created_by, updated_by)
  values
    (v_inv.organization_id, v_uid, v_inv.role, 'active', v_inv.invited_by, v_inv.id, v_uid, v_uid)
  returning id into v_id;

  update public.invitations
     set status = 'accepted', accepted_at = now(), accepted_by = v_uid, updated_by = v_uid
   where id = v_inv.id;

  update public.profiles
     set last_organization_id = v_inv.organization_id,
         full_name = coalesce(profiles.full_name, nullif(btrim(coalesce(v_inv.prenume, '') || ' ' || coalesce(v_inv.nume, '')), '')),
         phone = coalesce(profiles.phone, v_inv.telefon)
   where id = v_uid;

  perform app.write_audit('invite_accepted', v_inv.organization_id, 'invitations', v_inv.id);
  perform app.write_audit('member_added', v_inv.organization_id, 'organization_members', v_id);
  return v_id;
end;
$$;

-- ============================================================
-- 8. seed_leave_defaults — citește valoarea canonică a organizației
-- ============================================================
-- Înlocuiește DOAR valoarea implicită pentru „odihna" (concediul de odihnă,
-- singurul configurabil) cu organizations.zile_concediu_anual_implicit.
-- Celelalte tipuri (medical, maternitate etc.) rămân neschimbate — sunt
-- durate legale fixe, nu configurabile per organizație.

create or replace function internal.seed_leave_defaults(p_organization_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_flow uuid;
  v_zile_odihna smallint;
begin
  select o.zile_concediu_anual_implicit into v_zile_odihna
  from public.organizations o
  where o.id = p_organization_id;

  insert into public.leave_types (organization_id, key, denumire, zile_implicite, scade_din_sold,
    necesita_document, se_reporteaza, termen_reportare, intrerupe_alte_concedii,
    mod_rotunjire_acumulare, plafon_reportare_zile, culoare, temei_legal)
  select p_organization_id, t.key, t.denumire,
         -- „odihna" citește valoarea canonică a organizației; restul rămân neschimbate.
         case when t.key = 'odihna' then coalesce(v_zile_odihna, t.zile) else t.zile end,
         t.scade, t.doc, t.rep, t.termen, t.intrerupe,
         t.rotunjire::public.leave_rounding_mode, t.plafon, t.culoare, t.temei
  from (values
    ('odihna',        'Concediu de odihnă',            20, true,  false, true,  18,   false, 'jumatate_in_sus', 20, '#2563EB', 'Codul Muncii art. 145 (DE VERIFICAT)'),
    ('medical',       'Concediu medical',             183, false, true,  false, null, true,  'fara_rotunjire', null, '#DC2626', 'OUG 158/2005 (DE VERIFICAT)'),
    ('maternitate',   'Concediu de maternitate',      126, false, true,  false, null, true,  'fara_rotunjire', null, '#DB2777', 'OUG 158/2005 (DE VERIFICAT)'),
    ('paternal',      'Concediu paternal',             10, false, true,  false, null, false, 'fara_rotunjire', null, '#0891B2', 'Legea 210/1999 (DE VERIFICAT)'),
    ('crestere_copil','Concediu creștere copil',      730, false, true,  false, null, true,  'fara_rotunjire', null, '#7C3AED', 'OUG 111/2010 (DE VERIFICAT)'),
    ('casatorie',     'Concediu pentru căsătorie',      5, false, true,  false, null, false, 'fara_rotunjire', null, '#F59E0B', 'CCM / regulament intern (DE VERIFICAT)'),
    ('nastere_copil', 'Concediu la nașterea copilului', 5, false, true,  false, null, false, 'fara_rotunjire', null, '#10B981', 'CCM / regulament intern (DE VERIFICAT)'),
    ('deces_ruda',    'Concediu pentru deces în familie', 3, false, true, false, null, false, 'fara_rotunjire', null, '#475569', 'CCM / regulament intern (DE VERIFICAT)'),
    ('donator_sange', 'Zi liberă donator de sânge',     1, false, true,  false, null, false, 'fara_rotunjire', null, '#B91C1C', 'Legea 282/2005 (DE VERIFICAT)'),
    ('ingrijitor',    'Concediu de îngrijitor',         5, false, true,  false, null, false, 'fara_rotunjire', null, '#0D9488', 'Codul Muncii art. 152^1 (DE VERIFICAT)'),
    ('fara_plata',    'Concediu fără plată',           90, false, false, false, null, false, 'fara_rotunjire', null, '#94A3B8', 'Regulament intern (DE VERIFICAT)')
  ) as t(key, denumire, zile, scade, doc, rep, termen, intrerupe, rotunjire, plafon, culoare, temei)
  on conflict do nothing;

  insert into public.approval_flows (organization_id, entity_type, denumire)
  values (p_organization_id, 'leave_request', 'Aprobare cerere de concediu')
  on conflict do nothing;

  select id into v_flow from public.approval_flows
   where organization_id = p_organization_id and entity_type = 'leave_request'
     and activ and deleted_at is null;

  if v_flow is not null then
    insert into public.approval_steps (organization_id, flow_id, ordine, tip, permission_key, optional, sla_ore)
    values (p_organization_id, v_flow, 1, 'manager_direct', null, false, 72)
    on conflict do nothing;
    insert into public.approval_steps (organization_id, flow_id, ordine, tip, permission_key, optional, sla_ore)
    values (p_organization_id, v_flow, 2, 'permisiune', 'leave:approve', true, 72)
    on conflict do nothing;
  end if;
end; $$;

-- ============================================================
-- 9. Reconcilierea 21 vs 20: aliniere la valoarea canonică
-- ============================================================

alter table public.employment_contracts alter column zile_concediu_anual set default 20;

commit;
