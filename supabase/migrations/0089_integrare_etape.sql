-- =============================================================================
-- 0089_integrare_etape.sql — Faza „Integrare ca la carte”, tranșa 2
--
-- Structura pe care se sprijină tot restul fazei, plus cele două defecte care
-- fac modulul inutilizabil azi.
--
-- D7  Niciun șablon REUTILIZABIL nu poate produce un pas pe care noul angajat
--     să-l bifeze. `_responsabil_ck` (0014:89) cere pentru `'angajat'` un
--     `responsabil_employee_id` FIX, ales la scrierea șablonului — adică
--     înainte să știi pe cine angajezi. Pentru `'rol'` coloana e NULL prin
--     construcție, iar ramura „own” din `checklist_instance_items_update`
--     (0014:865) compară exact pe ea. Deci `responsabil_rol = 'employee'`,
--     singurul mod reutilizabil de a scrie „pasul ăsta îl face noul angajat”,
--     dă un pas pe care noul angajat NU-L POATE BIFA.
--     Reparația: o valoare nouă de enum, `'subiect'`, rezolvată la
--     materializare în chiar angajatul instanței.
--
-- D8  `internal.checklist_copiaza_pasii` (0076:121) copiază `responsabil_tip`,
--     `responsabil_rol` și `responsabil_employee_id` VERBATIM. Pentru `'rol'`
--     și `'manager_direct'` coloana rămâne NULL, deci ramura „own” nu se
--     aprinde niciodată, pentru nimeni. Un pas `manager_direct` e azi bifabil
--     doar de cine are `checklists:update = 'all'`.
--     Reparația: materializarea REZOLVĂ responsabilul într-o persoană, iar RLS
--     capătă ramuri dinamice ca plasă la schimbarea managerului sau a rolului
--     în mijlocul parcursului.
--
-- Plus etapele („Înainte de prima zi”, „Prima zi”, …) și discriminantul `fel`.
--
-- `ordine` pe pași rămâne GLOBALĂ pe șablon, iar indexurile `_ordine_uk` NU se
-- ating. Motivul e decisiv: `checklist_copiaza_pasii` copiază `ti.ordine`
-- verbatim, dintr-un trigger AFTER INSERT. Doi pași din etape diferite, ambii
-- cu `ordine = 1`, ar da 23505 brut la pornirea instanței, cu toată inserarea
-- anulată. Semantica devine „poziție în etapă, cu unicitate globală ca artefact
-- de index”; numărul afișat se CALCULEAZĂ cu `row_number()`, nu se citește.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Valoarea nouă de enum — bloc separat, OBLIGATORIU
-- -----------------------------------------------------------------------------
-- Postgres refuză folosirea unei valori de enum în aceeași tranzacție în care a
-- fost adăugată (55P04). Precedentul e 0076:12-27. `if not exists` face reluarea
-- idempotentă: blocul doi nu e atomic față de primul, deci o migrare întreruptă
-- la mijloc trebuie să poată fi reluată.
begin;

alter type public.checklist_responsabil_tip add value if not exists 'subiect';

commit;

begin;

-- -----------------------------------------------------------------------------
-- 2. Felul pasului — tip NOU, deci fără `alter type`, deci fără 55P04
-- -----------------------------------------------------------------------------
-- `tip_dovada` și `verificare_automata` rămân, dar devin DERIVATE din `fel`,
-- legate printr-un CHECK total. Fără discriminant, ecranul ar trebui să
-- reconstruiască felul din trei coloane — a doua sursă de adevăr, pe care
-- proiectul a plătit-o deja de două ori.
--
-- `'citire'` LIPSEȘTE DELIBERAT. Materialele de citit vin în 0092; o valoare de
-- enum fără implementare e exact defectul D4 pe care 0088 tocmai l-a închis
-- (`acces_revocat`, `documente_semnate`). Se adaugă acolo, cu backingul ei.
create type public.checklist_fel_pas as enum (
  'bifa',       -- se bifează cu mâna, fără dovadă
  'fisier',     -- cere un document justificativ
  'semnatura',  -- cere o declarație pe nume
  'curs',       -- se bifează singur când cursul legat e parcurs
  'automat'     -- se bifează singur din alt modul (azi: inventarul returnat)
);

comment on type public.checklist_fel_pas is
  'Discriminantul unui pas. `tip_dovada` și `verificare_automata` sunt derivate din el, printr-un CHECK total.';

-- -----------------------------------------------------------------------------
-- 3. Etapele șablonului
-- -----------------------------------------------------------------------------
create table public.checklist_template_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  template_id uuid not null,
  ordine smallint not null,
  titlu text not null,
  descriere text,
  -- Termenul etapei, în zile față de data de referință a instanței. NEGATIV e
  -- legitim și e chiar cazul principal: „Înainte de prima zi” = -5.
  termen_zile_relativ smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  constraint checklist_template_stages_id_org_uk unique (id, organization_id),
  constraint checklist_template_stages_template_fk
    foreign key (template_id, organization_id)
    references public.checklist_templates (id, organization_id) on delete cascade,
  constraint checklist_template_stages_titlu_ck check (length(btrim(titlu)) between 2 and 160),
  constraint checklist_template_stages_ordine_ck check (ordine between 1 and 100),
  constraint checklist_template_stages_termen_ck check (termen_zile_relativ between -365 and 365)
);

create unique index checklist_template_stages_ordine_uk
  on public.checklist_template_stages (template_id, ordine)
  where deleted_at is null;

create index checklist_template_stages_org_idx
  on public.checklist_template_stages (organization_id, template_id)
  where deleted_at is null;

comment on table public.checklist_template_stages is
  'Etapele unui șablon de integrare. O etapă poate fi GOALĂ — asistentul o cere ca antet de secțiune înainte să i se pună pași.';

-- -----------------------------------------------------------------------------
-- 4. Legătura pas ↔ etapă, și felul pasului
-- -----------------------------------------------------------------------------
-- Derivarea lui `fel` stă într-o funcție IMMUTABLE, fiindcă e chemată din
-- expresia unei coloane generate. Un `case` copiat în trei locuri ar diverge
-- tăcut; aici nu există decât o copie, iar Postgres o impune.
create or replace function app.checklist_fel_derivat(
  p_tip_dovada public.checklist_tip_dovada,
  p_verificare public.checklist_verificare
)
returns public.checklist_fel_pas
language sql immutable parallel safe set search_path = '' as $$
  select case
    when p_verificare = 'curs_finalizat'     then 'curs'
    when p_verificare = 'inventar_returnat'  then 'automat'
    when p_tip_dovada = 'document'           then 'fisier'
    when p_tip_dovada = 'semnatura'          then 'semnatura'
    else 'bifa'
  end::public.checklist_fel_pas
$$;

revoke all on function app.checklist_fel_derivat(public.checklist_tip_dovada, public.checklist_verificare) from public, anon;
grant execute on function app.checklist_fel_derivat(public.checklist_tip_dovada, public.checklist_verificare) to authenticated;

-- `fel` e o coloană GENERATĂ, nu una scrisă.
--
-- Alternativa — coloană obișnuită + trigger de completare + CHECK total care o
-- leagă de `tip_dovada`/`verificare_automata` — cere trei mecanisme ca să
-- garanteze exact ce garanția asta dă din construcție, plus un backfill. Iar
-- CHECK-ul total ar fi avut nevoie de `else false`, fiindcă un CHECK care
-- întoarce NULL este SATISFĂCUT (0076:68-73): încă o capcană de ținut minte.
--
-- Generată, coloana nu poate fi scrisă greșit de nimeni — nici de un `PATCH`
-- direct prin PostgREST — și nu poate rămâne în urma coloanelor din care se
-- naște. Consecință intenționată: felul se ALEGE punând `tip_dovada` și
-- `verificare_automata`, nu invers.
alter table public.checklist_template_items
  add column if not exists etapa_id uuid,
  add column if not exists fel public.checklist_fel_pas
    generated always as (app.checklist_fel_derivat(tip_dovada, verificare_automata)) stored;

-- `set null`, nu `cascade`: ștergerea unei etape nu are voie să ia cu ea pașii.
-- Ei rămân, fără etapă, și se văd în asistent într-o secțiune „Fără etapă”.
alter table public.checklist_template_items
  add constraint checklist_template_items_etapa_fk
  foreign key (etapa_id, organization_id)
  references public.checklist_template_stages (id, organization_id) on delete set null;

create index checklist_template_items_etapa_idx
  on public.checklist_template_items (organization_id, etapa_id)
  where deleted_at is null and etapa_id is not null;

-- Pe instanță etapa se COPIAZĂ ca text, ca tot restul pasului: modificarea
-- ulterioară a șablonului nu rescrie istoricul (0014, secțiunea 5).
-- `etapa_termen` e ABSOLUT, calculat la materializare din `data_referinta`.
alter table public.checklist_instance_items
  add column if not exists etapa_id uuid,
  add column if not exists etapa_titlu text,
  add column if not exists etapa_ordine smallint,
  add column if not exists etapa_termen date,
  -- Generată și aici, din coloanele COPIATE ale pasului. Nu se copiază din
  -- șablon: `tip_dovada` și `verificare_automata` se copiază oricum, iar
  -- derivarea din ele dă exact aceeași valoare — dintr-o singură sursă.
  add column if not exists fel public.checklist_fel_pas
    generated always as (app.checklist_fel_derivat(tip_dovada, verificare_automata)) stored;

comment on column public.checklist_instance_items.etapa_titlu is
  'Text copiat din etapa șablonului la materializare. Redenumirea etapei nu rescrie parcursurile pornite.';

-- -----------------------------------------------------------------------------
-- 5. D7 — `'subiect'` devine o formă legală de responsabil
-- -----------------------------------------------------------------------------
alter table public.checklist_template_items
  drop constraint checklist_template_items_responsabil_ck;

alter table public.checklist_template_items
  add constraint checklist_template_items_responsabil_ck check (
    (responsabil_tip = 'rol' and responsabil_rol is not null and responsabil_employee_id is null)
    or (responsabil_tip = 'angajat' and responsabil_employee_id is not null and responsabil_rol is null)
    or (responsabil_tip = 'manager_direct' and responsabil_rol is null and responsabil_employee_id is null)
    -- `subiect` = chiar angajatul pentru care s-a pornit parcursul. Se rezolvă
    -- la materializare, nu în șablon — de asta ambele coloane sunt null aici.
    or (responsabil_tip = 'subiect' and responsabil_rol is null and responsabil_employee_id is null)
  );

comment on constraint checklist_template_items_responsabil_ck on public.checklist_template_items is
  'Patru forme de responsabil. `subiect` există fiindcă un șablon REUTILIZABIL nu poate ști dinainte pe cine angajezi.';

-- -----------------------------------------------------------------------------
-- 6. D8 — materializarea REZOLVĂ responsabilul, nu-l mai copiază orbește
-- -----------------------------------------------------------------------------
-- Corpul e cel din 0076:105, rescris INTEGRAL, nu prin petic — un
-- `create or replace` parțial ar pierde restul logicii (bunurile nereturnate,
-- cursul deja parcurs). Trei lucruri noi:
--   (a) `subiect`        → chiar angajatul instanței           (D7)
--   (b) `manager_direct` → managerul lui, la data pornirii     (D8)
--   (c) etapa și felul se copiază, ca tot restul textului
--
-- `rol` NU se rezolvă: „oricine are rolul HR” nu e o persoană. Pentru el,
-- secțiunea 9 adaugă ramuri RLS dinamice.
--
-- Dacă angajatul n-are manager, un pas `manager_direct` rămâne cu
-- `responsabil_employee_id` NULL — vizibil și bifabil doar de
-- `checklists:update = 'all'`. E starea onestă: nu inventăm un responsabil.
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
    tip_dovada, verificare_automata, curs_id,
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
    ti.tip_dovada, ti.verificare_automata, ti.curs_id,
    ti.etapa_id, st.titlu, st.ordine,
    case when st.id is null then null
         else new.data_referinta + st.termen_zile_relativ::integer end,
    case
      when ti.verificare_automata = 'inventar_returnat' and v_liber then 'bifat'
      -- Cursul deja parcurs bifează pasul din prima: un om care a făcut
      -- instructajul luna trecută n-are de ce să-l refacă la reangajare.
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

-- -----------------------------------------------------------------------------
-- 7. Dovada poartă și etapa
-- -----------------------------------------------------------------------------
-- Corpul e cel din 0014:518, rescris integral, cu trei chei noi în `continut`.
-- Dovezile SCRISE ÎNAINTE de migrarea asta rămân valide și trebuie să se
-- deschidă: `continutDovadaSchema` face cele trei chei OPȚIONALE, exact pentru
-- asta. O dovadă e imutabilă — nu se rescrie retroactiv.
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
      'observatii', ii.observatii,
      'fel', ii.fel,
      'etapa_titlu', ii.etapa_titlu,
      'etapa_ordine', ii.etapa_ordine
    ) order by ii.etapa_ordine nulls first, ii.ordine), '[]'::jsonb),
    count(*),
    count(*) filter (where ii.status = 'bifat'),
    count(*) filter (where ii.obligatoriu)
  into v_continut, v_total, v_bifati, v_obligatorii
  from public.checklist_instance_items ii
  where ii.instance_id = new.id
    and ii.deleted_at is null;

  insert into public.checklist_completion_records (
    organization_id, instance_id, employee_id, tip, ciclu,
    finalizata_la, finalizat_de, total_pasi, pasi_bifati, pasi_obligatorii,
    continut, continut_checksum
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

-- -----------------------------------------------------------------------------
-- 8. Responsabilitatea DINAMICĂ — plasa pentru `rol` și `manager_direct`
-- -----------------------------------------------------------------------------
-- Materializarea din secțiunea 7 rezolvă responsabilul la PORNIRE. Dar un
-- parcurs ține săptămâni: managerul se poate schimba, rolul cuiva se poate
-- schimba. Fără ramurile de mai jos ar trebui un echivalent al lui
-- `internal.approval_tasks_retinteste_manager` (0017:412) — un trigger care
-- reetichetează pașii la fiecare mutare în organigramă. `manager_path`, ținut
-- la zi prin cascadă (0004:834), face asta inutil: întrebăm baza acum.
--
-- Acoperă DOAR cazurile dinamice. Cazul materializat
-- (`responsabil_employee_id = current_employee_id`) e deja ramura 3 din
-- `checklist_instance_items_update` (0014:865) și n-are nevoie de nimic nou.
create or replace function app.checklist_responsabil_dinamic(
  p_org uuid,
  p_tip public.checklist_responsabil_tip,
  p_rol public.app_role,
  p_subiect uuid
)
returns boolean language sql stable security definer set search_path = '' as $$
  select case p_tip
    when 'rol' then p_rol is not null and app.has_role(p_org, array[p_rol])
    when 'manager_direct' then exists (
      select 1 from public.employees e
       where e.id = p_subiect
         and e.organization_id = p_org
         and e.deleted_at is null
         and e.manager_employee_id = app.current_employee_id(p_org)
    )
    else false
  end
$$;

revoke all on function app.checklist_responsabil_dinamic(uuid, public.checklist_responsabil_tip, public.app_role, uuid) from public, anon;
grant execute on function app.checklist_responsabil_dinamic(uuid, public.checklist_responsabil_tip, public.app_role, uuid) to authenticated;

-- `security definer`: chemată din politica de pe `checklist_instances`, unde ar
-- citi `checklist_instance_items` sub RLS și ar intra în cerc.
create or replace function app.checklist_sunt_responsabil(p_org uuid, p_instanta uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.checklist_instance_items ii
     where ii.instance_id = p_instanta
       and ii.organization_id = p_org
       and ii.deleted_at is null
       and (
         ii.responsabil_employee_id = app.current_employee_id(p_org)
         or app.checklist_responsabil_dinamic(p_org, ii.responsabil_tip, ii.responsabil_rol, ii.employee_id)
       )
  )
$$;

revoke all on function app.checklist_sunt_responsabil(uuid, uuid) from public, anon;
grant execute on function app.checklist_sunt_responsabil(uuid, uuid) to authenticated;

-- Politica din 0088 acoperea doar responsabilul MATERIALIZAT. Se rescrie ca să
-- acopere și pe cel dinamic. Forward-only: 0088 rămâne pe disc neatinsă.
drop policy if exists checklist_instances_select_responsabil on public.checklist_instances;

create policy checklist_instances_select_responsabil on public.checklist_instances
for select to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'onboarding')
  and app.can(organization_id, 'checklists', 'read', 'own')
  and app.checklist_sunt_responsabil(organization_id, id)
);

-- Politicile sunt PERMISSIVE: cele două de mai jos se adaugă prin OR la cele
-- din 0014, care rămân neatinse.
create policy checklist_instance_items_select_dinamic on public.checklist_instance_items
for select to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'onboarding')
  and app.can(organization_id, 'checklists', 'read', 'own')
  and app.checklist_responsabil_dinamic(organization_id, responsabil_tip, responsabil_rol, employee_id)
);

create policy checklist_instance_items_update_dinamic on public.checklist_instance_items
for update to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'onboarding')
  and app.can(organization_id, 'checklists', 'update', 'own')
  and app.checklist_responsabil_dinamic(organization_id, responsabil_tip, responsabil_rol, employee_id)
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.can(organization_id, 'checklists', 'update', 'own')
  and app.checklist_responsabil_dinamic(organization_id, responsabil_tip, responsabil_rol, employee_id)
);

-- -----------------------------------------------------------------------------
-- 9. RLS pe etape — trio, fără politică DELETE
-- -----------------------------------------------------------------------------
alter table public.checklist_template_stages enable row level security;
alter table public.checklist_template_stages force row level security;

create policy checklist_template_stages_select on public.checklist_template_stages
for select to authenticated
using (
  app.is_platform_admin()
  or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'onboarding')
    and app.can(organization_id, 'checklists', 'read', 'own')
  )
);

create policy checklist_template_stages_insert on public.checklist_template_stages
for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'onboarding')
  and app.can(organization_id, 'checklists', 'create', 'all')
);

create policy checklist_template_stages_update on public.checklist_template_stages
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

revoke all on public.checklist_template_stages from anon, authenticated;
grant select, insert, update on public.checklist_template_stages to authenticated;

create trigger trg_checklist_template_stages_00_actor
  before insert or update on public.checklist_template_stages
  for each row execute function internal.set_actor();

create trigger trg_checklist_template_stages_10_atinge
  before update on public.checklist_template_stages
  for each row execute function internal.checklist_atinge();

select internal.attach_audit('checklist_template_stages');

commit;

-- -----------------------------------------------------------------------------
-- 10. Verificarea migrării
-- -----------------------------------------------------------------------------
-- Faptele pe care tranșele următoare le presupun. Dacă vreunul lipsește,
-- migrarea cade AICI, nu peste două tranșe, într-un ecran gol.
do $$
declare
  v_lipsa text[] := '{}';
begin
  if not exists (
    select 1 from pg_catalog.pg_enum e
      join pg_catalog.pg_type t on t.oid = e.enumtypid
     where t.typname = 'checklist_responsabil_tip' and e.enumlabel = 'subiect'
  ) then
    v_lipsa := v_lipsa || 'valoarea de enum ''subiect''';
  end if;

  -- `fel` trebuie să fie GENERATĂ pe ambele tabele. O coloană obișnuită cu
  -- același nume ar trece neobservată și ar putea rămâne în urmă.
  if (select count(*) from pg_catalog.pg_attribute a
       where a.attrelid in ('public.checklist_template_items'::regclass,
                            'public.checklist_instance_items'::regclass)
         and a.attname = 'fel' and a.attgenerated = 's') <> 2 then
    v_lipsa := v_lipsa || 'fel nu e coloana generata pe ambele tabele';
  end if;

  -- `subiect` trebuie să fie ACCEPTAT de constrângerea rescrisă. Se probează
  -- prin efect, nu prin citirea textului constrângerii.
  begin
    perform 1
      from public.checklist_template_items
     where responsabil_tip = 'subiect';
  exception when others then
    v_lipsa := v_lipsa || 'responsabil_tip nu accepta ''subiect''';
  end;

  if not exists (
    select 1 from pg_catalog.pg_policy
     where polname = 'checklist_instance_items_update_dinamic'
       and polrelid = 'public.checklist_instance_items'::regclass
  ) then
    v_lipsa := v_lipsa || 'politica dinamica de UPDATE pe pasi';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'checklist_template_stages'
       and c.relrowsecurity and c.relforcerowsecurity
  ) then
    v_lipsa := v_lipsa || 'RLS FORCED pe checklist_template_stages';
  end if;

  if array_length(v_lipsa, 1) > 0 then
    raise exception 'Migrarea 0089 nu s-a aplicat complet: %', array_to_string(v_lipsa, ', ');
  end if;
end;
$$;
