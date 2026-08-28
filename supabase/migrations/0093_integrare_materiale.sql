-- =============================================================================
-- 0093_integrare_materiale.sql — Faza „Integrare ca la carte”, tranșa 5
--
-- Un pas poate cere CITIREA unui material — regulamentul intern, codul de
-- conduită, fișa postului — iar angajatul confirmă că l-a parcurs.
--
-- ── DE CE `course_materials`, ȘI NU O BIBLIOTECĂ NOUĂ ────────────────────
-- Conținutul rămâne `course_materials` + `course_material_versions` (0075):
-- acolo există deja versionare, `fisier_checksum`, semnătură pe octeți,
-- bucket privat și o rută de livrare legată de cookie-ul de sesiune
-- (`api/materiale/[versiuneId]/route.ts`, care răspunde 404, nu 403). O
-- bibliotecă nouă ar cere al doilea bucket, al doilea contract de cale, al
-- doilea povestitor de versiuni și a doua rută de livrare — și, mai rău, a
-- doua sursă de adevăr pentru „a citit sau nu”.
--
-- ── DAR ACCESUL NU SE REFOLOSEȘTE ────────────────────────────────────────
-- Ambele porți care lasă azi un angajat să deschidă un material sunt ancorate
-- pe ÎNROLARE: `app.curs_versiune_atribuita` (0075:416) în
-- `course_material_versions_select`, și `app.curs_obiect_atribuit` (0075:458)
-- în `courses_objects_select`. Un material atașat unui pas de integrare, fără
-- nicio înrolare, ar da 404 TĂCUT.
--
-- De aceea se scriu trei politici PERMISSIVE noi, care se adaugă prin OR.
-- 0075 nu se atinge.
--
-- ── GARDA E `onboarding`, NU `courses` ───────────────────────────────────
-- Deliberat, cu precedent scris la 0075:1385. Cu garda pe `'courses'`, o firmă
-- care stinge modulul de cursuri ar avea pași obligatorii de citire imposibil
-- de bifat, deci instanțe imposibil de finalizat — exact blocajul pe care
-- `curs_finalizat` îl are deja. Asimetria acceptată și scrisă pe ecran:
-- CREAREA unui material cere modulul `courses` activ, CITIREA nu.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Valoarea nouă de enum — bloc separat (55P04)
-- -----------------------------------------------------------------------------
-- `'citire'` a lipsit deliberat din `checklist_fel_pas` la 0089: o valoare fără
-- implementare e exact defectul D4, pe care 0088 tocmai îl închisese. Sosește
-- acum, împreună cu tabela și politicile care o fac să funcționeze.
begin;

alter type public.checklist_fel_pas add value if not exists 'citire';

commit;

begin;

-- -----------------------------------------------------------------------------
-- 2. Materialul cerut de un pas
-- -----------------------------------------------------------------------------
alter table public.checklist_template_items
  add column if not exists material_id uuid;

alter table public.checklist_instance_items
  add column if not exists material_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint where conname = 'checklist_template_items_material_fk'
  ) then
    alter table public.checklist_template_items
      add constraint checklist_template_items_material_fk
      foreign key (material_id, organization_id)
      references public.course_materials (id, organization_id) on delete restrict;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint where conname = 'checklist_instance_items_material_fk'
  ) then
    alter table public.checklist_instance_items
      add constraint checklist_instance_items_material_fk
      foreign key (material_id, organization_id)
      references public.course_materials (id, organization_id) on delete restrict;
  end if;
end;
$$;

-- `coalesce` OBLIGATORIU: un CHECK care întoarce NULL este SATISFĂCUT. Fără el,
-- un pas cu `tip_dovada <> 'bifa'` ar trece cu `material_id` completat — adică
-- o legătură care nu declanșează nimic. Aceeași formă ca `_curs_ck` (0076:79).
alter table public.checklist_template_items
  add constraint checklist_template_items_material_ck
  check (material_id is null or (obligatoriu and tip_dovada = 'bifa' and verificare_automata is null));

alter table public.checklist_instance_items
  add constraint checklist_instance_items_material_ck
  check (material_id is null or (obligatoriu and tip_dovada = 'bifa' and verificare_automata is null));

create index if not exists checklist_instance_items_material_idx
  on public.checklist_instance_items (organization_id, material_id, employee_id)
  where deleted_at is null and material_id is not null;

-- `fel` e o coloană generată: expresia ei trebuie rescrisă ca să cunoască
-- materialul. `alter column ... set expression` (Postgres 17) recalculează
-- toate rândurile, deci nu e nevoie de backfill.
create or replace function app.checklist_fel_derivat(
  p_tip_dovada public.checklist_tip_dovada,
  p_verificare public.checklist_verificare,
  p_material   uuid default null
)
returns public.checklist_fel_pas
language sql immutable parallel safe set search_path = '' as $$
  select case
    when p_verificare = 'curs_finalizat'     then 'curs'
    when p_verificare = 'inventar_returnat'  then 'automat'
    when p_material is not null              then 'citire'
    when p_tip_dovada = 'document'           then 'fisier'
    when p_tip_dovada = 'semnatura'          then 'semnatura'
    else 'bifa'
  end::public.checklist_fel_pas
$$;

revoke all on function app.checklist_fel_derivat(public.checklist_tip_dovada, public.checklist_verificare, uuid) from public, anon;
grant execute on function app.checklist_fel_derivat(public.checklist_tip_dovada, public.checklist_verificare, uuid) to authenticated;

alter table public.checklist_template_items
  alter column fel set expression as (app.checklist_fel_derivat(tip_dovada, verificare_automata, material_id));

alter table public.checklist_instance_items
  alter column fel set expression as (app.checklist_fel_derivat(tip_dovada, verificare_automata, material_id));

-- -----------------------------------------------------------------------------
-- 3. Confirmarea citirii — rând imutabil
-- -----------------------------------------------------------------------------
-- Tiparul e `announcement_reads` (0028:45-57): fără `deleted_at`, doar `_select`
-- și `_insert`, grant doar `select, insert`. „Am citit la ora X” e o PROBĂ, nu o
-- stare — nu se modifică și nu se retrage.
--
-- Tabelă separată, nu o coloană pe `checklist_instance_items`: politica de
-- UPDATE a pașilor n-are nicio ramură pe `employee_id`, doar pe
-- `responsabil_employee_id`. Un pas de citire îl parcurge SUBIECTUL, care nu e
-- neapărat responsabilul.
-- Cheia compusă pe tenant lipsea de pe pașii de instanță: `checklist_templates`
-- și `checklist_template_items` o au din 0014, dar `checklist_instance_items`
-- nu. Fără ea, FK-ul de mai jos n-ar putea fi ancorat pe organizație — iar un
-- FK simplu nu știe nimic despre firme (motivul din antetul lui 0074).
alter table public.checklist_instance_items
  add constraint checklist_instance_items_id_org_uk unique (id, organization_id);

create table public.checklist_material_reads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  instance_item_id uuid not null,
  employee_id uuid not null references public.employees (id) on delete restrict,
  material_id uuid not null,
  citit_la timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid,
  constraint checklist_material_reads_item_fk
    foreign key (instance_item_id, organization_id)
    references public.checklist_instance_items (id, organization_id) on delete cascade,
  constraint checklist_material_reads_uk unique (instance_item_id, employee_id)
);

create index checklist_material_reads_org_idx
  on public.checklist_material_reads (organization_id, employee_id, citit_la desc);

comment on table public.checklist_material_reads is
  'Confirmarea că un material a fost parcurs. Imutabilă: „am citit la ora X" e o probă, nu o stare.';

-- -----------------------------------------------------------------------------
-- 4. Bifarea pasului la confirmare — SECURITY DEFINER
-- -----------------------------------------------------------------------------
-- Definer, ca la 0076:176: pasul de citire îl parcurge SUBIECTUL, iar el n-are
-- ramură de UPDATE pe pașii care nu-i sunt atribuiți. Un `security invoker` ar
-- atinge zero rânduri, tăcut — și confirmarea ar rămâne fără efect.
create or replace function internal.checklist_bifeaza_la_citire()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.checklist_instance_items ii
     set status = 'bifat',
         bifat_la = coalesce(ii.bifat_la, new.citit_la),
         bifat_de = coalesce(ii.bifat_de, auth.uid()),
         updated_at = now()
   where ii.id = new.instance_item_id
     and ii.organization_id = new.organization_id
     and ii.deleted_at is null
     and ii.status <> 'bifat';
  return null;
end;
$$;

revoke all on function internal.checklist_bifeaza_la_citire() from public, anon, authenticated;

create trigger trg_checklist_material_reads_20_bifeaza
  after insert on public.checklist_material_reads
  for each row execute function internal.checklist_bifeaza_la_citire();

-- -----------------------------------------------------------------------------
-- 5. RLS pe confirmări — fără UPDATE, fără DELETE
-- -----------------------------------------------------------------------------
alter table public.checklist_material_reads enable row level security;
alter table public.checklist_material_reads force row level security;

create policy checklist_material_reads_select on public.checklist_material_reads
for select to authenticated
using (
  app.is_platform_admin()
  or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'onboarding')
    and (
      app.has_permission(organization_id, 'checklists', 'read') = 'all'
      or (app.can(organization_id, 'checklists', 'read', 'team')
          and app.is_manager_of(organization_id, employee_id))
      or (app.can(organization_id, 'checklists', 'read', 'own')
          and employee_id = app.current_employee_id(organization_id))
    )
  )
);

-- Insertul e ancorat pe `app.current_employee_id`: nimeni nu confirmă în locul
-- altcuiva. Nici măcar `checklists:update = all` — o citire declarată de HR în
-- numele angajatului ar goli dovada de sens.
create policy checklist_material_reads_insert on public.checklist_material_reads
for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'onboarding')
  and app.can(organization_id, 'checklists', 'update', 'own')
  and employee_id = app.current_employee_id(organization_id)
  and exists (
    select 1 from public.checklist_instance_items ii
     where ii.id = instance_item_id
       and ii.organization_id = organization_id
       and ii.deleted_at is null
       and ii.employee_id = employee_id
       and ii.material_id = material_id
  )
);

revoke all on public.checklist_material_reads from anon, authenticated;
grant select, insert on public.checklist_material_reads to authenticated;

create trigger trg_checklist_material_reads_00_actor
  before insert on public.checklist_material_reads
  for each row execute function internal.set_actor();

-- -----------------------------------------------------------------------------
-- 6. Accesul la material fără înrolare — trei politici PERMISSIVE noi
-- -----------------------------------------------------------------------------
-- Predicatul comun, ca să nu fie scris de trei ori și să diveargă.
create or replace function app.checklist_material_atribuit(p_org uuid, p_material uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.checklist_instance_items ii
     where ii.organization_id = p_org
       and ii.material_id = p_material
       and ii.deleted_at is null
       and ii.employee_id = app.current_employee_id(p_org)
  )
$$;

revoke all on function app.checklist_material_atribuit(uuid, uuid) from public, anon;
grant execute on function app.checklist_material_atribuit(uuid, uuid) to authenticated;

create policy course_materials_select_integrare on public.course_materials
for select to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'onboarding')
  and app.checklist_material_atribuit(organization_id, id)
);

create policy cmv_select_integrare on public.course_material_versions
for select to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'onboarding')
  and app.checklist_material_atribuit(organization_id, material_id)
);

-- Obiectul din Storage: segmentul 3 al căii de curs e `material_id`
-- (`src/lib/media/cale.ts`), nu o persoană — de asta `app.can_path` nu poate
-- decide singur, exact ca la `courses_objects_select` (0075:1475).
create policy courses_objects_select_integrare on storage.objects
for select to authenticated
using (
  bucket_id = 'org-courses'
  and app.path_resource(name) = 'courses'
  -- `app.path_org` întoarce deja `uuid` (sau NULL la o cale malformată), deci
  -- nu are nevoie de validare de formă. Segmentul 3 e însă `text` și se castează
  -- explicit: un `::uuid` pe ceva ce nu e UUID ridică 22P02 DIN INTERIORUL unei
  -- politici, adică apare ca eroare de server, nu ca refuz.
  and app.path_segment(name, 3) ~ '^[0-9a-fA-F-]{36}$'
  and app.path_org(name) = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(app.path_org(name), 'onboarding')
  and app.checklist_material_atribuit(app.path_org(name), app.path_segment(name, 3)::uuid)
);

-- -----------------------------------------------------------------------------
-- 7. Materializarea copiază materialul
-- -----------------------------------------------------------------------------
-- Se rescrie doar linia de coloane; restul corpului e cel din 0089.
create or replace function internal.checklist_copiaza_pasii()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_lipsa text[];
  v_liber boolean;
  v_manager uuid;
begin
  v_lipsa := app.checklist_bunuri_nereturnate(new.organization_id, new.employee_id);
  v_liber := coalesce(array_length(v_lipsa, 1), 0) = 0;

  select e.manager_employee_id into v_manager
    from public.employees e
   where e.id = new.employee_id
     and e.organization_id = new.organization_id
     and e.deleted_at is null;

  insert into public.checklist_instance_items (
    organization_id, instance_id, employee_id, template_item_id, ordine, titlu, descriere,
    responsabil_tip, responsabil_rol, responsabil_employee_id, termen, obligatoriu,
    tip_dovada, verificare_automata, curs_id, material_id,
    etapa_id, etapa_titlu, etapa_ordine, etapa_termen,
    status, bifat_automat, bifat_la, observatii
  )
  select
    new.organization_id, new.id, new.employee_id, ti.id, ti.ordine, ti.titlu, ti.descriere,
    ti.responsabil_tip, ti.responsabil_rol,
    case ti.responsabil_tip
      when 'subiect'        then new.employee_id
      when 'manager_direct' then v_manager
      else ti.responsabil_employee_id
    end,
    new.data_referinta + ti.termen_zile_relativ::integer, ti.obligatoriu,
    ti.tip_dovada, ti.verificare_automata, ti.curs_id, ti.material_id,
    ti.etapa_id, st.titlu, st.ordine,
    case when st.id is null then null
         else new.data_referinta + st.termen_zile_relativ::integer end,
    case
      when ti.verificare_automata = 'inventar_returnat' and v_liber then 'bifat'
      when ti.verificare_automata = 'curs_finalizat'
           and exists (
             select 1 from public.course_enrollments e
             where e.organization_id = new.organization_id
               and e.course_id = ti.curs_id
               and e.employee_id = new.employee_id
               and e.deleted_at is null
               and e.status = 'finalizat'
           )
        then 'bifat'
      else 'de_facut'
    end::public.checklist_item_status,
    coalesce(ti.verificare_automata in ('inventar_returnat', 'curs_finalizat'), false)
      and (ti.verificare_automata <> 'inventar_returnat' or v_liber),
    case
      when ti.verificare_automata = 'inventar_returnat' and v_liber then now()
      when ti.verificare_automata = 'curs_finalizat'
           and exists (
             select 1 from public.course_enrollments e
             where e.organization_id = new.organization_id
               and e.course_id = ti.curs_id
               and e.employee_id = new.employee_id
               and e.deleted_at is null
               and e.status = 'finalizat'
           )
        then now()
    end,
    case
      when ti.verificare_automata = 'inventar_returnat' and not v_liber
        then 'Bunuri nereturnate: ' || array_to_string(v_lipsa, ', ')
    end
  from public.checklist_template_items ti
  left join public.checklist_template_stages st
    on st.id = ti.etapa_id
   and st.organization_id = ti.organization_id
   and st.deleted_at is null
  where ti.template_id = new.template_id
    and ti.organization_id = new.organization_id
    and ti.deleted_at is null
  order by ti.ordine;

  return null;
end;
$$;

select internal.attach_audit('checklist_material_reads');

commit;

-- -----------------------------------------------------------------------------
-- 8. Verificarea migrării
-- -----------------------------------------------------------------------------
do $$
declare
  v_lipsa text[] := '{}';
begin
  if not exists (
    select 1 from pg_catalog.pg_enum e join pg_catalog.pg_type t on t.oid = e.enumtypid
     where t.typname = 'checklist_fel_pas' and e.enumlabel = 'citire'
  ) then
    v_lipsa := v_lipsa || 'valoarea de enum ''citire''';
  end if;

  if (select count(*) from pg_catalog.pg_attribute a
       where a.attrelid in ('public.checklist_template_items'::regclass,
                            'public.checklist_instance_items'::regclass)
         and a.attname = 'fel' and a.attgenerated = 's') <> 2 then
    v_lipsa := v_lipsa || 'fel a încetat să fie coloană generată';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'checklist_material_reads'
       and c.relrowsecurity and c.relforcerowsecurity
  ) then
    v_lipsa := v_lipsa || 'RLS FORCED pe checklist_material_reads';
  end if;

  -- Confirmările nu se modifică și nu se șterg: nicio politică în afară de
  -- select și insert, niciun grant peste ele.
  if exists (
    select 1 from pg_catalog.pg_policy
     where polrelid = 'public.checklist_material_reads'::regclass and polcmd in ('w', 'd')
  ) then
    v_lipsa := v_lipsa || 'confirmările au politică de UPDATE sau DELETE';
  end if;

  if array_length(v_lipsa, 1) > 0 then
    raise exception 'Migrarea 0093 nu s-a aplicat complet: %', array_to_string(v_lipsa, ', ');
  end if;
end;
$$;
