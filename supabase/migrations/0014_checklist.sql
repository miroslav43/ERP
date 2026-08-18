-- =============================================================================
-- 0014_checklist.sql — Faza 6: checklist de integrare (onboarding) și de plecare
--
-- Reguli aplicate: RLS + FORCE pe fiecare tabelă nouă, fără politici DELETE,
-- soft delete, SECURITY DEFINER cu search_path = '' și nume complet calificate,
-- fără CHECK cu now()/current_date (regulile temporale trec în triggere, P0001).
--
-- Punctul dur al fazei: o instanță de offboarding NU poate trece în 'finalizata'
-- cât timp angajatul are bunuri nereturnate sau pași obligatorii nebifați.
-- Regula este impusă în bază (trigger), nu în interfață.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tipuri enumerate
-- -----------------------------------------------------------------------------
create type public.checklist_tip as enum ('onboarding', 'offboarding', 'transfer', 'altul');
create type public.checklist_responsabil_tip as enum ('rol', 'angajat', 'manager_direct');
create type public.checklist_tip_dovada as enum ('niciuna', 'bifa', 'document', 'semnatura');
create type public.checklist_verificare as enum ('inventar_returnat', 'acces_revocat', 'documente_semnate');
create type public.checklist_instanta_status as enum ('in_curs', 'finalizata', 'anulata');
create type public.checklist_item_status as enum ('de_facut', 'in_lucru', 'bifat', 'neaplicabil');

-- -----------------------------------------------------------------------------
-- 2. Șabloane
-- -----------------------------------------------------------------------------
create table public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  denumire text not null,
  tip public.checklist_tip not null,
  descriere text,
  department_id uuid references public.departments (id) on delete set null,
  job_position_id uuid references public.job_positions (id) on delete set null,
  activ boolean not null default true,
  valabil_de_la date not null default current_date,
  valabil_pana_la date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  constraint checklist_templates_id_org_uk unique (id, organization_id),
  constraint checklist_templates_denumire_ck check (length(btrim(denumire)) between 2 and 160),
  constraint checklist_templates_valabilitate_ck
    check (valabil_pana_la is null or valabil_pana_la > valabil_de_la)
);

create unique index checklist_templates_denumire_uk
  on public.checklist_templates (organization_id, tip, lower(btrim(denumire)))
  where deleted_at is null;

create index checklist_templates_org_idx
  on public.checklist_templates (organization_id, tip, activ)
  where deleted_at is null;

comment on table public.checklist_templates is
  'Șabloane de checklist per organizație; pot fi restrânse la un departament sau la un post.';

-- -----------------------------------------------------------------------------
-- 3. Pașii șablonului
-- -----------------------------------------------------------------------------
create table public.checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  template_id uuid not null,
  ordine smallint not null,
  titlu text not null,
  descriere text,
  responsabil_tip public.checklist_responsabil_tip not null default 'rol',
  responsabil_rol public.app_role,
  responsabil_employee_id uuid references public.employees (id) on delete set null,
  termen_zile_relativ smallint not null default 0,
  obligatoriu boolean not null default true,
  tip_dovada public.checklist_tip_dovada not null default 'bifa',
  verificare_automata public.checklist_verificare,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  constraint checklist_template_items_id_org_uk unique (id, organization_id),
  constraint checklist_template_items_template_fk
    foreign key (template_id, organization_id)
    references public.checklist_templates (id, organization_id) on delete cascade,
  constraint checklist_template_items_titlu_ck check (length(btrim(titlu)) between 2 and 200),
  constraint checklist_template_items_ordine_ck check (ordine between 1 and 500),
  -- termen relativ NEGATIV este legitim: laptopul se pregătește înainte de prima zi
  constraint checklist_template_items_termen_ck check (termen_zile_relativ between -365 and 365),
  constraint checklist_template_items_responsabil_ck check (
    (responsabil_tip = 'rol' and responsabil_rol is not null and responsabil_employee_id is null)
    or (responsabil_tip = 'angajat' and responsabil_employee_id is not null and responsabil_rol is null)
    or (responsabil_tip = 'manager_direct' and responsabil_rol is null and responsabil_employee_id is null)
  ),
  constraint checklist_template_items_automat_ck check (
    verificare_automata is null or (obligatoriu and tip_dovada = 'bifa')
  )
);

create unique index checklist_template_items_ordine_uk
  on public.checklist_template_items (template_id, ordine)
  where deleted_at is null;

create index checklist_template_items_org_idx
  on public.checklist_template_items (organization_id, template_id)
  where deleted_at is null;

-- -----------------------------------------------------------------------------
-- 4. Instanțe (un checklist pornit pentru un angajat)
-- -----------------------------------------------------------------------------
create table public.checklist_instances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  template_id uuid not null,
  employee_id uuid not null references public.employees (id) on delete restrict,
  tip public.checklist_tip not null,
  data_referinta date not null,
  status public.checklist_instanta_status not null default 'in_curs',
  ciclu smallint not null default 1,
  observatii text,
  finalizata_la timestamptz,
  finalizata_de uuid,
  anulata_la timestamptz,
  motiv_anulare text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  constraint checklist_instances_id_org_uk unique (id, organization_id),
  constraint checklist_instances_template_fk
    foreign key (template_id, organization_id)
    references public.checklist_templates (id, organization_id) on delete restrict,
  constraint checklist_instances_ciclu_ck check (ciclu between 1 and 100)
);

-- CICLUL face parte din cheia unică: un fost angajat reangajat are nevoie de un
-- al doilea onboarding pe același șablon. Fără ciclu, reangajarea ar fi blocată.
create unique index checklist_instances_ciclu_uk
  on public.checklist_instances (organization_id, employee_id, template_id, ciclu)
  where deleted_at is null;

create index checklist_instances_angajat_idx
  on public.checklist_instances (organization_id, employee_id, status)
  where deleted_at is null;

create index checklist_instances_status_idx
  on public.checklist_instances (organization_id, status, data_referinta)
  where deleted_at is null;

-- -----------------------------------------------------------------------------
-- 5. Pașii instanței — COPIE a textului din șablon, nu referință
-- -----------------------------------------------------------------------------
create table public.checklist_instance_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  instance_id uuid not null,
  employee_id uuid not null references public.employees (id) on delete restrict,
  template_item_id uuid references public.checklist_template_items (id) on delete set null,
  ordine smallint not null,
  titlu text not null,
  descriere text,
  responsabil_tip public.checklist_responsabil_tip not null,
  responsabil_rol public.app_role,
  responsabil_employee_id uuid references public.employees (id) on delete set null,
  termen date,
  obligatoriu boolean not null,
  tip_dovada public.checklist_tip_dovada not null,
  verificare_automata public.checklist_verificare,
  status public.checklist_item_status not null default 'de_facut',
  bifat_de uuid,
  bifat_la timestamptz,
  bifat_automat boolean not null default false,
  dovada text,
  dovada_document_id uuid references public.employee_documents (id) on delete set null,
  observatii text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  constraint checklist_instance_items_instance_fk
    foreign key (instance_id, organization_id)
    references public.checklist_instances (id, organization_id) on delete cascade,
  constraint checklist_instance_items_titlu_ck check (length(btrim(titlu)) between 2 and 200)
);

create unique index checklist_instance_items_ordine_uk
  on public.checklist_instance_items (instance_id, ordine)
  where deleted_at is null;

create index checklist_instance_items_instanta_idx
  on public.checklist_instance_items (organization_id, instance_id, status)
  where deleted_at is null;

create index checklist_instance_items_automat_idx
  on public.checklist_instance_items (organization_id, employee_id, verificare_automata)
  where deleted_at is null and verificare_automata is not null;

comment on column public.checklist_instance_items.titlu is
  'Text copiat din șablon la creare. Modificarea ulterioară a șablonului nu rescrie istoricul.';

-- -----------------------------------------------------------------------------
-- 6. Dovada de parcurgere — rând imutabil, generat la finalizare
-- -----------------------------------------------------------------------------
create table public.checklist_completion_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  instance_id uuid not null references public.checklist_instances (id) on delete restrict,
  employee_id uuid not null references public.employees (id) on delete restrict,
  tip public.checklist_tip not null,
  ciclu smallint not null,
  finalizata_la timestamptz not null,
  finalizat_de uuid,
  total_pasi integer not null,
  pasi_bifati integer not null,
  pasi_obligatorii integer not null,
  continut jsonb not null,
  continut_checksum text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  constraint checklist_completion_records_instance_uk unique (instance_id)
);

create index checklist_completion_records_org_idx
  on public.checklist_completion_records (organization_id, employee_id, finalizata_la desc);

comment on table public.checklist_completion_records is
  'Dovadă imutabilă: cine a finalizat, când, ce pași și ce dovezi. Nu se modifică, nu se șterge.';

-- =============================================================================
-- 7. Funcții auxiliare (schema app — vizibile politicilor și trigger-elor)
-- =============================================================================

-- Lista bunurilor nereturnate. SECURITY DEFINER: refuzul de finalizare nu are voie
-- să depindă de drepturile de citire pe Inventar ale celui care finalizează.
create or replace function app.checklist_bunuri_nereturnate(
  p_organization_id uuid,
  p_employee_id uuid
)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    array_agg(
      i.denumire || coalesce(' (' || i.numar_inventar || ')', '')
      order by i.denumire
    ),
    array[]::text[]
  )
  from public.inventory_allocations a
  join public.inventory_items i
    on i.id = a.item_id
   and i.organization_id = a.organization_id
  where a.organization_id = p_organization_id
    and a.employee_id = p_employee_id
    and a.predat_la is not null
    and a.returnat_la is null
    and a.deleted_at is null;
$$;

create or replace function app.checklist_nume_angajat(
  p_organization_id uuid,
  p_employee_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(btrim(e.full_name), ''), nullif(btrim(coalesce(e.last_name, '') || ' ' || coalesce(e.first_name, '')), ''))
  from public.employees e
  where e.id = p_employee_id
    and e.organization_id = p_organization_id;
$$;

-- Sincronizarea pașilor de tip 'inventar_returnat'. SECURITY INVOKER: scrierea
-- rămâne sub RLS-ul celui care returnează bunul.
create or replace function app.checklist_sincronizeaza_inventar(
  p_organization_id uuid,
  p_employee_id uuid
)
returns integer
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_lipsa text[];
  v_liber boolean;
  v_stare public.checklist_item_status;
  v_randuri integer;
begin
  if p_organization_id is null or p_employee_id is null then
    return 0;
  end if;

  v_lipsa := app.checklist_bunuri_nereturnate(p_organization_id, p_employee_id);
  v_liber := coalesce(array_length(v_lipsa, 1), 0) = 0;
  v_stare := (case when v_liber then 'bifat' else 'de_facut' end)::public.checklist_item_status;

  update public.checklist_instance_items ii
     set status = v_stare,
         bifat_automat = v_liber,
         bifat_la = case when v_liber then now() end,
         bifat_de = null,
         observatii = case
           when v_liber then 'Confirmat automat: nu mai există bunuri nereturnate.'
           else 'Bunuri nereturnate: ' || array_to_string(v_lipsa, ', ')
         end,
         updated_at = now()
    from public.checklist_instances ci
   where ci.id = ii.instance_id
     and ii.organization_id = p_organization_id
     and ii.employee_id = p_employee_id
     and ii.verificare_automata = 'inventar_returnat'
     and ii.deleted_at is null
     and ci.status = 'in_curs'
     and ci.deleted_at is null
     and ii.status is distinct from v_stare;

  get diagnostics v_randuri = row_count;
  return v_randuri;
end;
$$;

revoke all on function app.checklist_bunuri_nereturnate(uuid, uuid) from public, anon;
revoke all on function app.checklist_nume_angajat(uuid, uuid) from public, anon;
revoke all on function app.checklist_sincronizeaza_inventar(uuid, uuid) from public, anon;
grant execute on function app.checklist_bunuri_nereturnate(uuid, uuid) to authenticated;
grant execute on function app.checklist_nume_angajat(uuid, uuid) to authenticated;
grant execute on function app.checklist_sincronizeaza_inventar(uuid, uuid) to authenticated;

-- =============================================================================
-- 8. Trigger-e
-- =============================================================================

create or replace function internal.checklist_atinge()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Fixează starea inițială a instanței (rulează ÎNAINTE de WITH CHECK) și alocă ciclul.
create or replace function internal.checklist_pregateste_instanta()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_tip public.checklist_tip;
  v_activ boolean;
  v_ciclu smallint;
begin
  select t.tip, t.activ into v_tip, v_activ
    from public.checklist_templates t
   where t.id = new.template_id
     and t.organization_id = new.organization_id
     and t.deleted_at is null;

  if not found then
    raise exception using errcode = 'P0001',
      message = 'Șablonul de checklist nu există sau nu aparține organizației curente.';
  end if;

  if not v_activ then
    raise exception using errcode = 'P0001',
      message = 'Șablonul selectat este dezactivat și nu mai poate fi pornit.',
      hint = 'Activează șablonul sau alege altul.';
  end if;

  if not exists (
    select 1 from public.employees e
     where e.id = new.employee_id and e.organization_id = new.organization_id
  ) then
    raise exception using errcode = 'P0001',
      message = 'Angajatul selectat nu aparține organizației curente.';
  end if;

  new.tip := v_tip;
  new.status := 'in_curs';
  new.finalizata_la := null;
  new.finalizata_de := null;
  new.anulata_la := null;
  new.motiv_anulare := null;
  new.deleted_at := null;
  new.created_at := now();
  new.updated_at := now();

  select coalesce(max(ci.ciclu), 0)::smallint into v_ciclu
    from public.checklist_instances ci
   where ci.organization_id = new.organization_id
     and ci.employee_id = new.employee_id
     and ci.template_id = new.template_id
     and ci.deleted_at is null;

  if new.ciclu is null or new.ciclu <= v_ciclu then
    new.ciclu := (v_ciclu + 1)::smallint;
  end if;

  return new;
end;
$$;

-- Copiază pașii din șablon în instanță (copie, nu referință).
create or replace function internal.checklist_copiaza_pasii()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_lipsa text[];
  v_liber boolean;
begin
  v_lipsa := app.checklist_bunuri_nereturnate(new.organization_id, new.employee_id);
  v_liber := coalesce(array_length(v_lipsa, 1), 0) = 0;

  insert into public.checklist_instance_items (
    organization_id, instance_id, employee_id, template_item_id, ordine, titlu, descriere,
    responsabil_tip, responsabil_rol, responsabil_employee_id, termen, obligatoriu,
    tip_dovada, verificare_automata, status, bifat_automat, bifat_la, observatii
  )
  select
    new.organization_id, new.id, new.employee_id, ti.id, ti.ordine, ti.titlu, ti.descriere,
    ti.responsabil_tip, ti.responsabil_rol, ti.responsabil_employee_id,
    new.data_referinta + ti.termen_zile_relativ::integer, ti.obligatoriu,
    ti.tip_dovada, ti.verificare_automata,
    case
      when ti.verificare_automata = 'inventar_returnat' and v_liber then 'bifat'
      else 'de_facut'
    end::public.checklist_item_status,
    coalesce(ti.verificare_automata = 'inventar_returnat' and v_liber, false),
    case when ti.verificare_automata = 'inventar_returnat' and v_liber then now() end,
    case
      when ti.verificare_automata = 'inventar_returnat' and not v_liber
        then 'Bunuri nereturnate: ' || array_to_string(v_lipsa, ', ')
    end
  from public.checklist_template_items ti
  where ti.template_id = new.template_id
    and ti.organization_id = new.organization_id
    and ti.deleted_at is null
  order by ti.ordine;

  return null;
end;
$$;

-- REGULA CENTRALĂ: nu se finalizează cu pași obligatorii nebifați / bunuri nereturnate.
create or replace function internal.checklist_verifica_finalizarea()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_nume text;
  v_lipsa text[];
  v_n integer;
  v_pasi text[];
begin
  if new.status is distinct from old.status and old.status <> 'in_curs' then
    raise exception using errcode = 'P0001',
      message = 'Checklistul este deja închis; statusul nu se mai poate schimba.',
      hint = 'Pornește un ciclu nou dacă procesul trebuie reluat.';
  end if;

  if new.status = 'finalizata' and old.status is distinct from 'finalizata' then
    perform app.checklist_sincronizeaza_inventar(new.organization_id, new.employee_id);
    v_nume := coalesce(app.checklist_nume_angajat(new.organization_id, new.employee_id), 'Angajatul');

    if new.tip = 'offboarding' then
      v_lipsa := app.checklist_bunuri_nereturnate(new.organization_id, new.employee_id);
      v_n := coalesce(array_length(v_lipsa, 1), 0);
      if v_n > 0 then
        raise exception using errcode = 'P0001',
          message = format(
            'Nu se poate finaliza: %s are încă %s — %s.',
            v_nume,
            case when v_n = 1 then 'un bun nereturnat' else v_n || ' bunuri nereturnate' end,
            array_to_string(v_lipsa, ', ')
          ),
          hint = 'Înregistrează returnarea în modulul Inventar, apoi reia finalizarea.';
      end if;
    end if;

    select array_agg(ii.titlu order by ii.ordine) into v_pasi
      from public.checklist_instance_items ii
     where ii.instance_id = new.id
       and ii.deleted_at is null
       and ii.obligatoriu
       and ii.status not in ('bifat', 'neaplicabil');

    if v_pasi is not null then
      raise exception using errcode = 'P0001',
        message = format(
          'Nu se poate finaliza: %s are pași obligatorii nebifați — %s.',
          v_nume, array_to_string(v_pasi, ', ')
        ),
        hint = 'Bifează pașii rămași sau marchează-i „neaplicabil”, apoi reia finalizarea.';
    end if;

    new.finalizata_la := coalesce(new.finalizata_la, now());
    new.finalizata_de := coalesce(new.finalizata_de, auth.uid());
  end if;

  if new.status = 'anulata' and old.status is distinct from 'anulata' then
    if coalesce(btrim(new.motiv_anulare), '') = '' then
      raise exception using errcode = 'P0001',
        message = 'Anularea unui checklist cere un motiv scris.';
    end if;
    new.anulata_la := coalesce(new.anulata_la, now());
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- Dovada de parcurgere, scrisă o singură dată.
create or replace function internal.checklist_dovada_parcurgere()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_continut jsonb;
  v_total integer;
  v_bifati integer;
  v_obligatorii integer;
begin
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'ordine', ii.ordine,
      'titlu', ii.titlu,
      'obligatoriu', ii.obligatoriu,
      'status', ii.status,
      'tip_dovada', ii.tip_dovada,
      'verificare_automata', ii.verificare_automata,
      'dovada', ii.dovada,
      'dovada_document_id', ii.dovada_document_id,
      'bifat_de', ii.bifat_de,
      'bifat_la', ii.bifat_la,
      'bifat_automat', ii.bifat_automat,
      'observatii', ii.observatii
    ) order by ii.ordine), '[]'::jsonb),
    count(*),
    count(*) filter (where ii.status = 'bifat'),
    count(*) filter (where ii.obligatoriu)
  into v_continut, v_total, v_bifati, v_obligatorii
  from public.checklist_instance_items ii
  where ii.instance_id = new.id
    and ii.deleted_at is null;

  insert into public.checklist_completion_records (
    organization_id, instance_id, employee_id, tip, ciclu, finalizata_la, finalizat_de,
    total_pasi, pasi_bifati, pasi_obligatorii, continut, continut_checksum
  )
  values (
    new.organization_id, new.id, new.employee_id, new.tip, new.ciclu,
    coalesce(new.finalizata_la, now()), new.finalizata_de,
    coalesce(v_total, 0), coalesce(v_bifati, 0), coalesce(v_obligatorii, 0),
    v_continut, md5(v_continut::text)
  )
  on conflict (instance_id) do nothing;

  return null;
end;
$$;

-- Reguli pe pasul instanței.
create or replace function internal.checklist_pregateste_pasul()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_status public.checklist_instanta_status;
begin
  select ci.status into v_status
    from public.checklist_instances ci
   where ci.id = new.instance_id;

  if v_status is distinct from 'in_curs' then
    raise exception using errcode = 'P0001',
      message = 'Checklistul este închis; pașii lui nu se mai pot modifica.';
  end if;

  if new.titlu is distinct from old.titlu or new.obligatoriu is distinct from old.obligatoriu then
    raise exception using errcode = 'P0001',
      message = 'Textul pașilor unei instanțe nu se modifică; modifică șablonul pentru viitor.';
  end if;

  if new.status = 'bifat' and old.status is distinct from 'bifat' then
    if new.verificare_automata is not null and not new.bifat_automat then
      raise exception using errcode = 'P0001',
        message = format('Pasul „%s” se bifează automat și nu poate fi bifat manual.', new.titlu);
    end if;
    if new.tip_dovada = 'document' and new.dovada_document_id is null then
      raise exception using errcode = 'P0001',
        message = format('Pasul „%s” cere un document justificativ.', new.titlu);
    end if;
    if new.tip_dovada = 'semnatura' and coalesce(btrim(new.dovada), '') = '' then
      raise exception using errcode = 'P0001',
        message = format('Pasul „%s” cere o semnătură înregistrată.', new.titlu);
    end if;
    new.bifat_la := coalesce(new.bifat_la, now());
    if not new.bifat_automat then
      new.bifat_de := coalesce(new.bifat_de, auth.uid());
    end if;
  elsif new.status <> 'bifat' then
    new.bifat_la := null;
    new.bifat_de := null;
    new.bifat_automat := false;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- Sincronizarea la returnarea unui bun: bifa apare fără ca cineva să reintre în checklist.
create or replace function internal.sync_itemi_returnare_inventar()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE'
     and old.employee_id is not null
     and old.employee_id is distinct from new.employee_id then
    perform app.checklist_sincronizeaza_inventar(old.organization_id, old.employee_id);
  end if;

  if new.employee_id is not null then
    perform app.checklist_sincronizeaza_inventar(new.organization_id, new.employee_id);
  end if;

  return null;
end;
$$;

create or replace function internal.checklist_blocheaza_modificarea()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  raise exception using errcode = 'P0001',
    message = 'Dovada de parcurgere a checklistului este imutabilă: nu se modifică și nu se șterge.';
end;
$$;

revoke all on function internal.checklist_atinge() from public, anon;
revoke all on function internal.checklist_pregateste_instanta() from public, anon;
revoke all on function internal.checklist_copiaza_pasii() from public, anon;
revoke all on function internal.checklist_verifica_finalizarea() from public, anon;
revoke all on function internal.checklist_dovada_parcurgere() from public, anon;
revoke all on function internal.checklist_pregateste_pasul() from public, anon;
revoke all on function internal.sync_itemi_returnare_inventar() from public, anon;
revoke all on function internal.checklist_blocheaza_modificarea() from public, anon;

create trigger trg_checklist_templates_10_atinge
  before update on public.checklist_templates
  for each row execute function internal.checklist_atinge();

create trigger trg_checklist_template_items_10_atinge
  before update on public.checklist_template_items
  for each row execute function internal.checklist_atinge();

create trigger trg_checklist_instances_10_pregatire
  before insert on public.checklist_instances
  for each row execute function internal.checklist_pregateste_instanta();

create trigger trg_checklist_instances_20_finalizare
  before update on public.checklist_instances
  for each row execute function internal.checklist_verifica_finalizarea();

create trigger trg_checklist_instances_30_copiaza
  after insert on public.checklist_instances
  for each row execute function internal.checklist_copiaza_pasii();

create trigger trg_checklist_instances_40_dovada
  after update on public.checklist_instances
  for each row
  when (new.status = 'finalizata' and old.status is distinct from 'finalizata')
  execute function internal.checklist_dovada_parcurgere();

create trigger trg_checklist_instance_items_10_pas
  before update on public.checklist_instance_items
  for each row execute function internal.checklist_pregateste_pasul();

create trigger trg_checklist_completion_records_90_imutabil
  before update or delete on public.checklist_completion_records
  for each row execute function internal.checklist_blocheaza_modificarea();

create trigger trg_inventory_allocations_60_checklist
  after insert or update of returnat_la, predat_la, employee_id
  on public.inventory_allocations
  for each row execute function internal.sync_itemi_returnare_inventar();

-- =============================================================================
-- 9. RLS
-- =============================================================================
alter table public.checklist_templates            enable row level security;
alter table public.checklist_templates            force  row level security;
alter table public.checklist_template_items       enable row level security;
alter table public.checklist_template_items       force  row level security;
alter table public.checklist_instances            enable row level security;
alter table public.checklist_instances            force  row level security;
alter table public.checklist_instance_items       enable row level security;
alter table public.checklist_instance_items       force  row level security;
alter table public.checklist_completion_records   enable row level security;
alter table public.checklist_completion_records   force  row level security;

-- --- Șabloane -----------------------------------------------------------------
create policy checklist_templates_select on public.checklist_templates
for select to authenticated
using (
  app.is_platform_admin()
  or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'onboarding')
    and app.can(organization_id, 'checklists', 'read', 'own')
  )
);

create policy checklist_templates_insert on public.checklist_templates
for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'onboarding')
  and app.can(organization_id, 'checklists', 'create', 'all')
  and deleted_at is null
);

create policy checklist_templates_update on public.checklist_templates
for update to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'onboarding')
  and app.can(organization_id, 'checklists', 'update', 'all')
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.can(organization_id, 'checklists', 'update', 'all')
);

-- --- Pașii șablonului ---------------------------------------------------------
create policy checklist_template_items_select on public.checklist_template_items
for select to authenticated
using (
  app.is_platform_admin()
  or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'onboarding')
    and app.can(organization_id, 'checklists', 'read', 'own')
  )
);

create policy checklist_template_items_insert on public.checklist_template_items
for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'onboarding')
  and app.can(organization_id, 'checklists', 'create', 'all')
  and deleted_at is null
);

create policy checklist_template_items_update on public.checklist_template_items
for update to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'onboarding')
  and app.can(organization_id, 'checklists', 'update', 'all')
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.can(organization_id, 'checklists', 'update', 'all')
);

-- --- Instanțe -----------------------------------------------------------------
create policy checklist_instances_select on public.checklist_instances
for select to authenticated
using (
  app.is_platform_admin()
  or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'onboarding')
    and (
      (app.has_permission(organization_id, 'checklists', 'read') = 'all')
      or (app.can(organization_id, 'checklists', 'read', 'team')
          and app.is_manager_of(organization_id, employee_id))
      or (app.can(organization_id, 'checklists', 'read', 'own')
          and employee_id = app.current_employee_id(organization_id))
    )
  )
);

create policy checklist_instances_insert on public.checklist_instances
for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'onboarding')
  and (
    (app.has_permission(organization_id, 'checklists', 'create') = 'all')
    or (app.can(organization_id, 'checklists', 'create', 'team')
        and app.is_manager_of(organization_id, employee_id))
  )
  and status = 'in_curs'
  and finalizata_la is null
  and finalizata_de is null
  and anulata_la is null
  and deleted_at is null
);

create policy checklist_instances_update on public.checklist_instances
for update to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'onboarding')
  and (
    (app.has_permission(organization_id, 'checklists', 'update') = 'all')
    or (app.can(organization_id, 'checklists', 'update', 'team')
        and app.is_manager_of(organization_id, employee_id))
  )
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and (
    (app.has_permission(organization_id, 'checklists', 'update') = 'all')
    or (app.can(organization_id, 'checklists', 'update', 'team')
        and app.is_manager_of(organization_id, employee_id))
  )
);

-- --- Pașii instanței ----------------------------------------------------------
create policy checklist_instance_items_select on public.checklist_instance_items
for select to authenticated
using (
  app.is_platform_admin()
  or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'onboarding')
    and (
      (app.has_permission(organization_id, 'checklists', 'read') = 'all')
      or (app.can(organization_id, 'checklists', 'read', 'team')
          and app.is_manager_of(organization_id, employee_id))
      or (app.can(organization_id, 'checklists', 'read', 'own')
          and employee_id = app.current_employee_id(organization_id))
      or (app.can(organization_id, 'checklists', 'read', 'own')
          and responsabil_employee_id = app.current_employee_id(organization_id))
    )
  )
);

create policy checklist_instance_items_insert on public.checklist_instance_items
for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'onboarding')
  and app.can(organization_id, 'checklists', 'create', 'team')
  and bifat_de is null
  and deleted_at is null
  and (
    (status = 'de_facut')
    or (verificare_automata is not null and status = 'bifat' and bifat_automat)
  )
);

create policy checklist_instance_items_update on public.checklist_instance_items
for update to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'onboarding')
  and (
    (app.has_permission(organization_id, 'checklists', 'update') = 'all')
    or (app.can(organization_id, 'checklists', 'update', 'team')
        and app.is_manager_of(organization_id, employee_id))
    or (app.can(organization_id, 'checklists', 'update', 'own')
        and responsabil_employee_id = app.current_employee_id(organization_id))
    or (verificare_automata is not null
        and app.can(organization_id, 'inventory', 'update', 'own'))
  )
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and (
    (app.has_permission(organization_id, 'checklists', 'update') = 'all')
    or (app.can(organization_id, 'checklists', 'update', 'team')
        and app.is_manager_of(organization_id, employee_id))
    or (app.can(organization_id, 'checklists', 'update', 'own')
        and responsabil_employee_id = app.current_employee_id(organization_id))
    or (verificare_automata is not null
        and app.can(organization_id, 'inventory', 'update', 'own'))
  )
);

-- --- Dovada de parcurgere (fără UPDATE, fără DELETE) --------------------------
create policy checklist_completion_records_select on public.checklist_completion_records
for select to authenticated
using (
  app.is_platform_admin()
  or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'onboarding')
    and (
      (app.has_permission(organization_id, 'checklists', 'read') = 'all')
      or (app.can(organization_id, 'checklists', 'read', 'team')
          and app.is_manager_of(organization_id, employee_id))
      or (app.can(organization_id, 'checklists', 'read', 'own')
          and employee_id = app.current_employee_id(organization_id))
    )
  )
);

create policy checklist_completion_records_insert on public.checklist_completion_records
for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'onboarding')
  and (
    (app.has_permission(organization_id, 'checklists', 'update') = 'all')
    or (app.can(organization_id, 'checklists', 'update', 'team')
        and app.is_manager_of(organization_id, employee_id))
  )
);

-- Vizibilitate minimă pe Inventar pentru cine conduce offboardingul: fără ea,
-- lista bunurilor nereturnate ar depinde de drepturile pe modulul Inventar.
create policy inventory_allocations_select_checklist on public.inventory_allocations
for select to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'onboarding')
  and app.can(organization_id, 'checklists', 'update', 'team')
);

create policy inventory_items_select_checklist on public.inventory_items
for select to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'onboarding')
  and app.can(organization_id, 'checklists', 'update', 'team')
);

-- =============================================================================
-- 10. Drepturi de tabelă — fără DELETE nicăieri (soft delete)
-- =============================================================================
revoke all on public.checklist_templates          from anon, authenticated;
revoke all on public.checklist_template_items     from anon, authenticated;
revoke all on public.checklist_instances          from anon, authenticated;
revoke all on public.checklist_instance_items     from anon, authenticated;
revoke all on public.checklist_completion_records from anon, authenticated;

grant select, insert, update on public.checklist_templates          to authenticated;
grant select, insert, update on public.checklist_template_items     to authenticated;
grant select, insert, update on public.checklist_instances          to authenticated;
grant select, insert, update on public.checklist_instance_items     to authenticated;
grant select, insert          on public.checklist_completion_records to authenticated;

-- =============================================================================
-- 11. Actor + jurnal de audit pe tabelele noi
-- =============================================================================
do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array[
    'checklist_templates',
    'checklist_template_items',
    'checklist_instances',
    'checklist_instance_items',
    'checklist_completion_records'
  ]
  loop
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function internal.set_actor()',
      'trg_' || v_tabela || '_00_actor', v_tabela
    );
    execute format('select internal.attach_audit(%L)', v_tabela);
  end loop;
end;
$$;
