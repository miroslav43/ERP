-- =============================================================================
-- 0092_integrare_dovada_fisier.sql — Faza „Integrare ca la carte”, tranșa 4
--
-- Numărul e 0092, nu 0091: altă sesiune a livrat `0091_invitatie_cu_parola.sql`
-- în paralel. Convenția proiectului la coliziune e să-ți redenumești PROPRIA
-- migrare, nu pe a celuilalt.
--
-- D2: încărcarea unei dovezi era imposibilă ARHITECTURAL, nu doar
-- neimplementată.
--
-- Ecranul cerea `dovada_document_id` — UUID-ul unui rând din
-- `employee_documents` — scris de mână într-un `<input type="text">`, cu
-- ajutorul „Identificatorul documentului încărcat la fișa angajatului”
-- (`pas-checklist.tsx:297`). Nu exista niciun upload în tot modulul.
--
-- Și nu putea exista: politica de INSERT pe `storage.objects` (0002:1489) cere
-- `app.can_path(name, 'create')`, care ia SEGMENTUL 2 al căii și îl dă lui
-- `app.has_permission` ca nume de resursă. Calea documentelor de personal e
-- `{org}/employees/{fișa}/…`, deci cere `employees:create` — pe care nici
-- angajatul, nici managerul nu-l au. Iar `employee_documents_insert`
-- (0005:577) cere egalitate STRICTĂ `employees:create = 'all'`.
--
-- ── DE CE BUCKET PROPRIU, ȘI DE CE FĂRĂ `app.can_path` ───────────────────
-- 1. La scope `team`, `app.can_path` întoarce `true` NECONDIȚIONAT
--    (`case has_permission … when 'team' then true`). Într-un bucket partajat,
--    orice manager ar citi dovada oricui din firmă, fără nicio verificare de
--    subordonare.
-- 2. `can_path(…, 'update')` ar fi adevărat pentru angajat pe propriul folder,
--    deci prin `storage_objects_update` ar putea SUPRASCRIE prin upsert o
--    dovadă deja acceptată.
-- 3. Politicile din 0002 sunt PERMISSIVE și guvernează și dosarul de personal:
--    nu se pot strânge fără să le rescrii.
--
-- Poarta de aici oglindește literal politica de RÂND și se ancorează pe PASUL
-- din segmentul 4, nu doar pe folderul persoanei. Politica de INSERT consultă
-- `checklists:update`, NU `checklists:create`: atașarea unei dovezi e semantic
-- un `update` pe pas, iar precedentul e `avatars_insert`, care consultă
-- `users:update`. Astfel nu se seedează un `checklists:create` mincinos pentru
-- rolul `employee`.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Unde stă fișierul
-- -----------------------------------------------------------------------------
alter table public.checklist_instance_items
  add column if not exists dovada_fisier_path text,
  add column if not exists dovada_fisier_nume text,
  add column if not exists dovada_fisier_mime text,
  add column if not exists dovada_fisier_marime_bytes bigint;

-- Cele patru merg împreună sau deloc. Un `path` fără `nume` ar da o descărcare
-- cu numele intern al obiectului; un `nume` fără `path` e o dovadă fantomă.
alter table public.checklist_instance_items
  add constraint checklist_instance_items_fisier_ck check (
    (dovada_fisier_path is null
      and dovada_fisier_nume is null
      and dovada_fisier_mime is null
      and dovada_fisier_marime_bytes is null)
    or (dovada_fisier_path is not null
      and dovada_fisier_nume is not null
      and dovada_fisier_mime is not null
      and dovada_fisier_marime_bytes is not null
      and dovada_fisier_marime_bytes between 1 and 26214400)
  );

comment on column public.checklist_instance_items.dovada_fisier_path is
  'Calea în bucketul org-checklists: {org}/checklists/{employee_id}/{instance_item_id}/{uuid}-{slug}.';

-- -----------------------------------------------------------------------------
-- 2. Triggerul acceptă ORICARE dintre cele două forme de dovadă-document
-- -----------------------------------------------------------------------------
-- Corpul e cel din 0088 (care la rândul lui e cel din 0014:566), rescris
-- integral. Singura schimbare: „cere un document justificativ” se satisface
-- acum și cu un fișier încărcat în pas, nu doar cu un rând din dosarul de
-- personal. Vechea formă rămâne validă — instanțele pornite înainte n-au de ce
-- să devină nefinalizabile.
create or replace function internal.checklist_pregateste_pasul()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_status public.checklist_instanta_status;
begin
  select ci.status into v_status
    from public.checklist_instances ci
   where ci.id = new.instance_id
     and ci.organization_id = new.organization_id
     and ci.deleted_at is null;

  if v_status is null then
    raise exception using errcode = 'P0001',
      message = 'Parcursul de care ține pasul nu mai există.';
  end if;

  if v_status <> 'in_curs' then
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
    if new.tip_dovada = 'document'
       and new.dovada_document_id is null
       and new.dovada_fisier_path is null then
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

revoke all on function internal.checklist_pregateste_pasul() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Bucketul
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'org-checklists', 'org-checklists', false, 26214400,
  array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 4. Poarta: oglinda politicii de rând, ancorată pe PAS
-- -----------------------------------------------------------------------------
-- `security definer` fiindcă citește `checklist_instance_items`, care e sub
-- RLS: sub invoker ar întoarce fals exact pentru cine are dreptul prin ramura
-- pe care tocmai o verificăm.
--
-- Segmentele se validează ÎNAINTE de cast: un `::uuid` pe un segment care nu e
-- UUID ridică 22P02 din interiorul unei politici, ceea ce apare ca eroare de
-- server, nu ca refuz.
create or replace function app.checklist_poate_dovada(p_name text, p_actiune text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_org      text := app.path_org(p_name);
  v_resursa  text := app.path_resource(p_name);
  v_angajat  text := app.path_segment(p_name, 3);
  v_pas      text := app.path_segment(p_name, 4);
  v_org_id   uuid;
  v_pas_id   uuid;
  v_item     public.checklist_instance_items%rowtype;
begin
  if v_org is null or v_resursa is distinct from 'checklists' or v_angajat is null or v_pas is null then
    return false;
  end if;

  if v_org !~ '^[0-9a-fA-F-]{36}$' or v_pas !~ '^[0-9a-fA-F-]{36}$' then
    return false;
  end if;

  v_org_id := v_org::uuid;
  v_pas_id := v_pas::uuid;

  if not (v_org_id = any (app.current_org_ids())) then return false; end if;
  if not app.feature_on(v_org_id, 'onboarding') then return false; end if;

  select * into v_item
    from public.checklist_instance_items ii
   where ii.id = v_pas_id
     and ii.organization_id = v_org_id
     and ii.deleted_at is null;

  if not found then return false; end if;

  -- Calea trebuie să numească exact angajatul pasului. Fără verificarea asta,
  -- cineva cu drept pe pasul lui ar putea scrie sub folderul altcuiva.
  if v_item.employee_id::text is distinct from v_angajat then return false; end if;

  -- Subiectul își citește mereu propria dovadă, chiar dacă pasul e al altcuiva:
  -- e documentul lui, din parcursul lui.
  if p_actiune = 'read'
     and app.can(v_org_id, 'checklists', 'read', 'own')
     and v_item.employee_id = app.current_employee_id(v_org_id) then
    return true;
  end if;

  return app.has_permission(v_org_id, 'checklists', 'update') = 'all'
      or (app.can(v_org_id, 'checklists', 'update', 'team')
          and app.is_manager_of(v_org_id, v_item.employee_id))
      or (app.can(v_org_id, 'checklists', 'update', 'own')
          and (v_item.responsabil_employee_id = app.current_employee_id(v_org_id)
               or app.checklist_responsabil_dinamic(
                    v_org_id, v_item.responsabil_tip, v_item.responsabil_rol, v_item.employee_id)));
end;
$fn$;

revoke all on function app.checklist_poate_dovada(text, text) from public, anon;
grant execute on function app.checklist_poate_dovada(text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Politicile de storage — proprii, fără `app.can_path`
-- -----------------------------------------------------------------------------
create policy checklists_objects_select on storage.objects
for select to authenticated
using (
  bucket_id = 'org-checklists'
  and app.checklist_poate_dovada(name, 'read')
);

create policy checklists_objects_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'org-checklists'
  and app.checklist_poate_dovada(name, 'update')
  and owner = (select auth.uid())
);

-- UPDATE există doar ca `uploadToSignedUrl` să poată rescrie un obiect pe care
-- tot el l-a creat în aceeași încercare. NU există politică DELETE: ștergerea
-- unei dovezi trece prin service_role, după audit — ca peste tot în proiect.
create policy checklists_objects_update on storage.objects
for update to authenticated
using (
  bucket_id = 'org-checklists'
  and app.checklist_poate_dovada(name, 'update')
  and owner = (select auth.uid())
)
with check (
  bucket_id = 'org-checklists'
  and app.checklist_poate_dovada(name, 'update')
  and owner = (select auth.uid())
);

commit;

-- -----------------------------------------------------------------------------
-- 6. Verificarea migrării
-- -----------------------------------------------------------------------------
do $$
declare
  v_lipsa text[] := '{}';
begin
  if not exists (select 1 from storage.buckets where id = 'org-checklists' and not public) then
    v_lipsa := v_lipsa || 'bucketul org-checklists (privat)';
  end if;

  if (select count(*) from pg_catalog.pg_policy
       where polrelid = 'storage.objects'::regclass
         and polname in ('checklists_objects_select', 'checklists_objects_insert',
                         'checklists_objects_update')) <> 3 then
    v_lipsa := v_lipsa || 'cele trei politici de storage';
  end if;

  -- Poarta NU are voie să folosească `app.can_path`: la scope `team` acela
  -- întoarce `true` necondiționat, iar dovada oricui ar deveni citibilă.
  if position('can_path' in pg_get_functiondef('app.checklist_poate_dovada(text,text)'::regprocedure)) > 0 then
    v_lipsa := v_lipsa || 'poarta folosește can_path, ceea ce e exact ce evităm';
  end if;

  if array_length(v_lipsa, 1) > 0 then
    raise exception 'Migrarea 0092 nu s-a aplicat complet: %', array_to_string(v_lipsa, ', ');
  end if;
end;
$$;
