-- supabase/migrations/0202_flota_tipuri_si_fisiere.sql
--
-- FLOTA, FAZA F6: DOCUMENTELE VEHICULULUI — OBLIGATIVITATE PE CATEGORIE, TIPURI
-- ACTIVATE PER FIRMĂ ȘI FIȘIERELE SCANATE.
--
-- Planul o numea `0176_flota_tipuri_si_fisiere`; între timp 0176–0201 s-au
-- ocupat (alocări, mentenanță, registru, asistent, salarizare, tichete,
-- aprobatori, KPI, flota F3–F5), deci e 0202.
--
-- ── DE UNDE VINE ────────────────────────────────────────────────────────────
-- Semaforul cerea trusă medicală și stingător la REMORCI și rovinietă la un
-- camion de 12 t: „Lipsește” roșu pentru documente pe care legea nu le cere.
-- `obligatoriu` era un steag global pe tipul de platformă, fără nicio legătură
-- cu vehiculul. Iar cele patru tipuri de transport (0116) se puteau reactiva
-- doar pentru TOATE firmele deodată — 0116 o spune explicit: „nu există azi un
-- mecanism de activare per organizație”. Fișierele: `vehicle_documents.
-- fisier_path` și `fuel_entries.fisier_bon_path` există din 0012, dar fără
-- bucket și fără politici (`0012:1176`, semnalarea 1), deci nescrise niciodată.
--
-- ── CE ADUCE ────────────────────────────────────────────────────────────────
-- A. `vehicle_document_types` primește `categorii_aplicabile` (NULL = orice
--    categorie) și `masa_max_kg` (NULL = fără plafon). Seed: rovinieta până la
--    3.500 kg; trusa și stingătorul nu se cer la remorcă și semiremorcă.
--    Aplicabilitatea NU blochează scrierea: un document pe un tip neaplicabil
--    se poate înregistra; doar nu mai e cerut („obligatoriu”) vehiculului.
-- B. `vehicle_document_type_setari` (org, tip, activ, obligatoriu): firma își
--    activează sau dezactivează un tip DE PLATFORMĂ și îi schimbă
--    obligativitatea, fără să atingă celelalte firme. Tipul propriu firmei se
--    modifică direct pe rândul lui; setarea pe el se refuză (P0001), ca să nu
--    existe două adevăruri pentru același tip. Citire: `vehicles:read` ≠ none.
--    Scriere: `vehicles:update = all`, ca `vdt_update` și `fleet_settings`.
-- C. `internal.vdoc_inainte`, rescrisă din forma ULTIMĂ (0018 §F4; nicio
--    migrare ulterioară n-a redefinit-o — verificat cu grep pe toate
--    migrările): tipul e disponibil după `coalesce(setarea firmei, activ)`, iar
--    `fisier_path` trebuie să stea sub `{org}/vehicles/{vehicul}/`. Restul
--    funcției (apartenența vehiculului, `este_curent`) e neschimbat, cu
--    mesajele vechi, cu sedilă, neatinse — `erori.ts` le potrivește așa.
-- D. `internal.alimentari_bon_cale`, trigger BEFORE SEPARAT pe `fuel_entries`:
--    `fisier_bon_path` sub `{org}/trip_sheets/{foaie}/`. Separat, nu în
--    `alimentari_inainte` (forma 0200), ca o regulă de cale să nu ceară
--    retranscrierea a 60 de rânduri de reguli de foaie.
-- E. Bucketul privat `org-flota`, cu poarta proprie `app.flota_poate_fisier`
--    (tiparul 0092 §4–§5 și 0181 §9), NU `app.can_path`: la scope `team`
--    acela întoarce `true` necondiționat. Căi:
--      {org}/vehicles/{vehicle_id}/{uuid}-{fișier}   — scanarea documentului;
--      {org}/trip_sheets/{trip_sheet_id}/{uuid}-{fișier} — poza bonului.
--    Citire: cine vede vehiculul / foaia. Scriere: `vehicles:update = all` pe
--    vehicul; pe foaie, cine poate scrie foaia, cât timp e CIORNĂ (0200 §D1).
--
-- ── CE NU FACE ──────────────────────────────────────────────────────────────
--  · Nu schimbă `activ` pe niciun rând de platformă: cele 7 rămân 7 (garda din
--    0116 §3, care a rulat o singură dată, se reverifică în blocul final).
--  · Nu atinge `app.can_path`, `expirables`, `internal.flota_sincronizeaza_grup`.
--  · Nu adaugă chei de permisiune: totul stă pe `vehicles:*` și `trip_sheets:*`.
--  · Nu șterge fizic fișiere: fără politică DELETE pe bucket, ca peste tot.
--
-- Aplicare: psql byte-exact, după bancul local; producția cere confirmare.

begin;

-- ============================================================
-- 1. Aplicabilitatea tipului: categorii și masă
-- ============================================================
alter table public.vehicle_document_types
  add column categorii_aplicabile public.vehicle_category[],
  add column masa_max_kg integer;

alter table public.vehicle_document_types
  add constraint vdt_categorii_ck check (
    categorii_aplicabile is null or cardinality(categorii_aplicabile) >= 1
  ),
  add constraint vdt_masa_ck check (masa_max_kg is null or masa_max_kg between 1 and 100000);

comment on column public.vehicle_document_types.categorii_aplicabile is
  'Categoriile de vehicul cărora li se cere tipul (0202). NULL = oricare. Aplicabilitatea decide doar obligativitatea, nu blochează înregistrarea.';
comment on column public.vehicle_document_types.masa_max_kg is
  'Masa maximă autorizată (kg) până la care se cere tipul (0202). NULL = fără plafon. Un vehicul fără masă completată e tratat ca aplicabil.';

-- Seed de platformă. Plafonul rovinietei la 3,5 t e decizia planului aprobat pe
-- 7 oct, NU o valoare legală verificată: ⚠ de confirmat de jurist (OG 15/2002
-- are și categorii de rovinietă peste 3,5 t). Dacă se infirmă, plafonul se
-- scoate printr-o migrare ulterioară, fără cod nou. Trusa și stingătorul sunt
-- dotări ale autovehiculului, nu ale remorcii.
update public.vehicle_document_types
   set masa_max_kg = 3500, updated_at = now()
 where organization_id is null and deleted_at is null and cod = 'rovinieta';

update public.vehicle_document_types
   set categorii_aplicabile = array[
         'autoturism', 'autoutilitara', 'camion', 'autobuz', 'microbuz',
         'utilaj', 'motocicleta', 'altele'
       ]::public.vehicle_category[],
       updated_at = now()
 where organization_id is null and deleted_at is null
   and cod in ('trusa_medicala', 'extinctor');

-- ============================================================
-- 2. Setările tipurilor de platformă, per firmă
-- ============================================================
create table public.vehicle_document_type_setari (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  document_type_id uuid not null references public.vehicle_document_types (id) on delete cascade,
  activ            boolean not null default true,
  obligatoriu      boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references auth.users (id) on delete set null,
  updated_by       uuid references auth.users (id) on delete set null,
  deleted_at       timestamptz
);

create unique index vdts_org_tip_uq
  on public.vehicle_document_type_setari (organization_id, document_type_id)
  where deleted_at is null;

comment on table public.vehicle_document_type_setari is
  'Activarea și obligativitatea unui tip de document DE PLATFORMĂ pentru o firmă (0202). Lipsa rândului = valorile tipului. Tipurile proprii se modifică direct.';

-- ============================================================
-- 3. Triggerele setărilor
-- ============================================================
-- Integritate, nu drepturi: tipul e de platformă, iar rândul nu se mută. DEFINER
-- fiindcă citește nomenclatorul fără să depindă de politica lui de SELECT.
create or replace function internal.vdts_inainte()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and (new.organization_id, new.document_type_id)
         is distinct from (old.organization_id, old.document_type_id) then
    raise exception using errcode = 'P0001',
      message = 'Setarea tipului de document nu se mută pe altă organizație sau pe alt tip.';
  end if;

  if not exists (
    select 1 from public.vehicle_document_types t
     where t.id = new.document_type_id
       and t.organization_id is null
       and t.deleted_at is null
  ) then
    raise exception using errcode = 'P0001',
      message = 'Setarea pe firmă se aplică doar tipurilor de document de platformă. Un tip propriu se modifică direct.';
  end if;

  -- Un tip inactiv nu se cere nimănui: obligativitatea lui ar fi o promisiune
  -- pe care semaforul n-o mai citește.
  if not new.activ then
    new.obligatoriu := false;
  end if;
  return new;
end;
$$;

create trigger vdts_inainte
  before insert or update on public.vehicle_document_type_setari
  for each row execute function internal.vdts_inainte();

-- ============================================================
-- 4. internal.vdoc_inainte — forma 0018 §F4 + setarea firmei + calea
-- ============================================================
create or replace function internal.vdoc_inainte()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  select v.organization_id into v_org from public.vehicles v
   where v.id = new.vehicle_id and v.deleted_at is null;
  if v_org is null or v_org <> new.organization_id then
    raise exception using errcode = 'P0001',
      message = 'Vehiculul selectat nu aparține organizației dumneavoastră.';
  end if;

  if (tg_op = 'INSERT' or new.document_type_id is distinct from old.document_type_id) then
    -- 0202: disponibilitatea e cea EFECTIVĂ a firmei. Setarea ei bate `activ`
    -- al tipului de platformă în ambele sensuri: activează un tip de transport
    -- retras în 0116, sau retrage pentru firmă un tip activ pentru celelalte.
    if not exists (
      select 1
        from public.vehicle_document_types t
        left join public.vehicle_document_type_setari s
          on s.document_type_id = t.id
         and s.organization_id = new.organization_id
         and s.deleted_at is null
       where t.id = new.document_type_id and t.deleted_at is null
         and (t.organization_id is null or t.organization_id = new.organization_id)
         and coalesce(s.activ, t.activ)
    ) then
      raise exception using errcode = 'P0001',
        message = 'Tipul de document ales nu este disponibil sau a fost dezactivat.';
    end if;
  end if;

  -- 0202: scanarea stă în folderul VEHICULULUI din organizația rândului. Fără
  -- regula asta, un rând ar putea indica obiectul altui vehicul (sau al altei
  -- firme) și l-ar servi cu drepturile de pe vehiculul lui.
  if new.fisier_path is not null
     and (tg_op = 'INSERT'
          or new.fisier_path is distinct from old.fisier_path
          or new.vehicle_id is distinct from old.vehicle_id) then
    if not internal.flota_cale_valida(new.fisier_path, new.organization_id, 'vehicles', new.vehicle_id) then
      raise exception using errcode = 'P0001',
        message = 'Fișierul scanat nu aparține acestui vehicul. Încărcați-l din nou de pe fișa vehiculului.';
    end if;
  end if;

  -- `este_curent` este calculat. În afara recalculării, valoarea trimisă de
  -- client se ignoră tăcut: nu e o tentativă de fraudă, e un câmp pe care
  -- interfața nu ar trebui să îl trimită.
  if coalesce(pg_catalog.current_setting('app.flota_recalcul', true), 'off') <> 'on' then
    if tg_op = 'INSERT' then
      new.este_curent := false;
    else
      new.este_curent := old.este_curent;
    end if;
  end if;
  return new;
end;
$$;

-- ============================================================
-- 5. Calea unui fișier de flotă
-- ============================================================
-- `{org}/{resursă}/{entitate}/{fișier}` — exact patru segmente, fără `.`/`..`,
-- fără bară inversă și fără caractere de control. Folosită de triggerele de
-- rând; poarta bucketului (§7) are regulile ei, pe aceleași segmente.
create or replace function internal.flota_cale_valida(
  p_cale text, p_org uuid, p_resursa text, p_entitate uuid
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- `left(...) =`, nu `like`: `_` din `trip_sheets` e joker în LIKE.
  select p_cale is not null
     and left(p_cale, char_length(p_org::text || '/' || p_resursa || '/' || p_entitate::text || '/'))
         = p_org::text || '/' || p_resursa || '/' || p_entitate::text || '/'
     and pg_catalog.array_length(pg_catalog.string_to_array(p_cale, '/'), 1) = 4
     and pg_catalog.split_part(p_cale, '/', 4) not in ('', '.', '..')
     and p_cale !~ '[\\[:cntrl:]]'
     and pg_catalog.char_length(p_cale) <= 400;
$$;

-- Ordinea de mai sus contează doar la citire: `vdoc_inainte` (§4) e definită
-- înaintea helperului, dar plpgsql rezolvă apelul la RULARE, nu la creare.

-- ============================================================
-- 6. Calea pozei de bon, pe alimentare
-- ============================================================
create or replace function internal.alimentari_bon_cale()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.fisier_bon_path is not null
     and (tg_op = 'INSERT' or new.fisier_bon_path is distinct from old.fisier_bon_path) then
    if not internal.flota_cale_valida(new.fisier_bon_path, new.organization_id, 'trip_sheets', new.trip_sheet_id) then
      raise exception using errcode = 'P0001',
        message = 'Poza bonului nu aparține acestei foi de parcurs. Încărcați-o din nou de pe foaie.';
    end if;
  end if;
  return new;
end;
$$;

create trigger alimentari_bon_cale
  before insert or update on public.fuel_entries
  for each row execute function internal.alimentari_bon_cale();

-- ============================================================
-- 7. Bucketul `org-flota` și poarta lui
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'org-flota', 'org-flota', false, 20971520,
  array[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'
  ]
)
on conflict (id) do nothing;

-- Segmentele se validează ÎNAINTE de cast: un `::uuid` pe un segment stricat
-- ar ridica 22P02 din interiorul politicii, adică eroare de server, nu refuz.
-- DEFINER fiindcă citește `vehicles` și `trip_sheets`, care sunt sub RLS.
create or replace function app.flota_poate_fisier(p_name text, p_actiune text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org     uuid := app.path_org(p_name);
  v_tip     text := app.path_segment(p_name, 2);
  v_id_text text := app.path_segment(p_name, 3);
  v_id      uuid;
  v_vehicul public.vehicles%rowtype;
  v_foaie   public.trip_sheets%rowtype;
begin
  if v_org is null or v_tip is null or v_id_text is null
     or app.path_segment(p_name, 4) is null
     or app.path_segment(p_name, 5) is not null then
    return false;
  end if;
  if v_tip not in ('vehicles', 'trip_sheets') then
    return false;
  end if;
  if v_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  v_id := v_id_text::uuid;

  -- Administratorul de platformă citește (ca `vdoc_select`), nu scrie.
  if p_actiune = 'read' and app.is_platform_admin() then
    return true;
  end if;

  if not (v_org = any (app.current_org_ids())) then return false; end if;
  if not app.feature_on(v_org, 'fleet') then return false; end if;

  if v_tip = 'vehicles' then
    select * into v_vehicul from public.vehicles v
     where v.id = v_id and v.organization_id = v_org;
    if not found then return false; end if;
    if p_actiune = 'read' then
      return app.poate_vedea_vehicul(v_org, v_vehicul.employee_id, v_vehicul.pool);
    end if;
    return v_vehicul.deleted_at is null
       and app.has_permission(v_org, 'vehicles', 'update') = 'all';
  end if;

  select * into v_foaie from public.trip_sheets t
   where t.id = v_id and t.organization_id = v_org;
  if not found then return false; end if;
  if p_actiune = 'read' then
    return app.poate_vedea_foaie(v_org, v_foaie.employee_id);
  end if;
  -- Bonul urmează alimentarea: se atașează doar cât foaia e ciornă (0200 §D1).
  return v_foaie.deleted_at is null
     and v_foaie.status = 'draft'
     and app.poate_scrie_foaie(v_org, v_foaie.employee_id);
end;
$$;

comment on function app.flota_poate_fisier(text, text) is
  'Poarta bucketului org-flota (0202): {org}/vehicles/{vehicul}/… după vizibilitatea vehiculului și vehicles:update = all; {org}/trip_sheets/{foaie}/… după foaie, scriere doar pe ciornă. Fără app.can_path.';

drop policy if exists flota_objects_select on storage.objects;
create policy flota_objects_select on storage.objects
for select to authenticated
using (bucket_id = 'org-flota' and app.flota_poate_fisier(name, 'read'));

drop policy if exists flota_objects_insert on storage.objects;
create policy flota_objects_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'org-flota'
  and app.flota_poate_fisier(name, 'update')
  and owner = (select auth.uid())
);

-- UPDATE există doar ca încărcarea pe URL semnat să poată rescrie obiectul pe
-- care tot ea l-a creat. Fără DELETE: ștergerea trece prin service_role.
drop policy if exists flota_objects_update on storage.objects;
create policy flota_objects_update on storage.objects
for update to authenticated
using (
  bucket_id = 'org-flota'
  and app.flota_poate_fisier(name, 'update')
  and owner = (select auth.uid())
)
with check (
  bucket_id = 'org-flota'
  and app.flota_poate_fisier(name, 'update')
  and owner = (select auth.uid())
);

-- ============================================================
-- 8. RLS pe setările tipurilor
-- ============================================================
alter table public.vehicle_document_type_setari enable row level security;
alter table public.vehicle_document_type_setari force row level security;

-- Citite de oricine vede parcul: semaforul șoferului depinde de ele.
create policy vehicle_document_type_setari_select on public.vehicle_document_type_setari
for select to authenticated
using (
  (select app.is_platform_admin()) or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.has_permission(organization_id, 'vehicles', 'read') <> 'none'
  )
);

create policy vehicle_document_type_setari_insert on public.vehicle_document_type_setari
for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
  and deleted_at is null
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy vehicle_document_type_setari_update on public.vehicle_document_type_setari
for update to authenticated
using (
  deleted_at is null
  and organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'fleet')
  and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
  and updated_by = (select auth.uid())
);

-- ============================================================
-- 9. Actor, audit, drepturi
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['vehicle_document_type_setari'] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function internal.seteaza_updated_at()',
      t || '_set_updated_at', t);
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function internal.set_actor()',
      'trg_' || t || '_actor', t);
    perform internal.attach_audit(t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end
$$;

revoke all on function internal.vdts_inainte() from public, anon, authenticated;
revoke all on function internal.vdoc_inainte() from public, anon, authenticated;
revoke all on function internal.alimentari_bon_cale() from public, anon, authenticated;
revoke all on function internal.flota_cale_valida(text, uuid, text, uuid) from public, anon, authenticated;
revoke all on function app.flota_poate_fisier(text, text) from public, anon;
grant execute on function app.flota_poate_fisier(text, text) to authenticated, service_role;

commit;

-- ============================================================
-- 10. Verificare
-- ============================================================
do $$
declare
  v_lipsa  text[] := '{}';
  v_active integer;
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'vehicle_document_types'
                    and column_name = 'categorii_aplicabile') then
    v_lipsa := v_lipsa || 'vehicle_document_types.categorii_aplicabile';
  end if;
  if not exists (select 1 from public.vehicle_document_types
                  where organization_id is null and deleted_at is null
                    and cod = 'rovinieta' and masa_max_kg = 3500) then
    v_lipsa := v_lipsa || 'rovinieta cu masa_max_kg = 3500';
  end if;
  if exists (select 1 from public.vehicle_document_types
              where organization_id is null and deleted_at is null
                and cod in ('trusa_medicala', 'extinctor')
                and (categorii_aplicabile is null
                     or 'remorca' = any (categorii_aplicabile)
                     or 'semiremorca' = any (categorii_aplicabile))) then
    v_lipsa := v_lipsa || 'trusa/stingătorul fără remorcă și semiremorcă';
  end if;

  -- Garda din 0116 §3 a rulat o singură dată; activarea per firmă nu are voie
  -- să schimbe numărul de tipuri de platformă active.
  select count(*) into v_active
    from public.vehicle_document_types
   where organization_id is null and deleted_at is null and activ;
  if v_active <> 7 then
    v_lipsa := v_lipsa || format('7 tipuri de platformă active (sunt %s)', v_active);
  end if;

  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'vdts_org_tip_uq'
                  and indexdef ilike '%where (deleted_at is null)%') then
    v_lipsa := v_lipsa || 'vdts_org_tip_uq (parțial)';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public'
         and tablename = 'vehicle_document_type_setari') <> 3 then
    v_lipsa := v_lipsa || 'trio-ul de politici pe vehicle_document_type_setari';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public'
              and tablename = 'vehicle_document_type_setari' and cmd = 'DELETE') then
    v_lipsa := v_lipsa || 'politică DELETE pe vehicle_document_type_setari (interzisă)';
  end if;
  if not (select relforcerowsecurity from pg_class
           where oid = 'public.vehicle_document_type_setari'::regclass) then
    v_lipsa := v_lipsa || 'FORCE RLS pe vehicle_document_type_setari';
  end if;
  if position('vehicle_document_type_setari' in
              pg_get_functiondef('internal.vdoc_inainte()'::regprocedure)) = 0 then
    v_lipsa := v_lipsa || 'internal.vdoc_inainte cu setarea firmei';
  end if;
  -- Reparația 0018 §F4 trebuie să supraviețuiască rescrierii.
  if position('is distinct from old.document_type_id' in
              pg_get_functiondef('internal.vdoc_inainte()'::regprocedure)) = 0 then
    v_lipsa := v_lipsa || 'internal.vdoc_inainte a pierdut reparația 0018 §F4';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'alimentari_bon_cale'
                  and tgrelid = 'public.fuel_entries'::regclass) then
    v_lipsa := v_lipsa || 'triggerul alimentari_bon_cale';
  end if;
  if not exists (select 1 from storage.buckets where id = 'org-flota' and not public) then
    v_lipsa := v_lipsa || 'bucketul org-flota (privat)';
  end if;
  if (select count(*) from pg_catalog.pg_policy
       where polrelid = 'storage.objects'::regclass
         and polname in ('flota_objects_select', 'flota_objects_insert', 'flota_objects_update')) <> 3 then
    v_lipsa := v_lipsa || 'cele trei politici de storage ale flotei';
  end if;
  if position('can_path' in pg_get_functiondef('app.flota_poate_fisier(text,text)'::regprocedure)) > 0 then
    v_lipsa := v_lipsa || 'poarta folosește can_path, ceea ce e exact ce evităm';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where (n.nspname, p.proname) in (('internal', 'vdts_inainte'), ('internal', 'vdoc_inainte'),
                                               ('internal', 'alimentari_bon_cale'),
                                               ('internal', 'flota_cale_valida'),
                                               ('app', 'flota_poate_fisier'))
                and (p.proconfig is null or not ('search_path=""' = any (p.proconfig)))) then
    v_lipsa := v_lipsa || 'search_path gol pe funcțiile 0202';
  end if;
  if array_length(v_lipsa, 1) > 0 then
    raise exception '0202: lipsesc %', array_to_string(v_lipsa, ', ');
  end if;
end $$;

-- ============================================================
-- 11. Note de proiectare
-- ============================================================
-- · De ce setări pe firmă și nu rânduri proprii copiate din platformă: o copie
--   ar avea alt `id` și alt `cod`, deci documentele existente pe tipul de
--   platformă ar rămâne pe vechiul tip, iar `expirables.kind` s-ar dubla.
--   Setarea păstrează tipul și schimbă doar ce vede firma.
-- · De ce aplicabilitatea nu refuză scrierea: legea se schimbă prin ordin de
--   ministru, iar o firmă poate ține voluntar un document pe care nu i-l cere
--   nimeni. Refuzul ar fi o regulă juridică scrisă în trigger; obligativitatea
--   e doar ce se aprinde roșu.
-- · Vehiculul fără masă completată primește rovinieta ca obligatorie: lipsa
--   masei nu are voie să stingă tăcut o cerință, iar „Lipsește” îl trimite pe om
--   să completeze masa sau documentul.
-- · Bucketul are poarta lui, nu `app.can_path`: pe `team` acela dă `true` fără
--   să se uite la entitate (0092 §4), iar segmentul 3 aici e vehiculul sau
--   foaia, nu utilizatorul.
