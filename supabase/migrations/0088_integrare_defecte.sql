-- =============================================================================
-- 0088_integrare_defecte.sql — Faza „Integrare ca la carte”, tranșa 1
--
-- Închide nouă defecte tăcute ale modulului de integrare (checklist). Niciunul
-- n-a fost prins de typecheck, lint, cele 1960 de teste sau de cele trei bariere
-- SQL: toate se manifestă ca REFUZ FĂRĂ EROARE sau ca ACCEPTARE ÎN GOL.
--
-- D1  Managerul n-are `checklists:update`, deci nu poate bifa niciun pas. Ramura
--     scrisă pentru el în 0014:862 e cod mort din ziua întâi.
-- D4  `acces_revocat` și `documente_semnate` sunt valori de enum fără nicio
--     implementare; un pas pus pe ele e obligatoriu prin `_automat_ck` și
--     nebifabil pe veci ⇒ instanța devine imposibil de finalizat.
-- D5  `checklists:approve` e seedat din 0002 și citit de ZERO politici.
-- D6  Un responsabil care nu e subiectul checklistului nu vede INSTANȚA (doar
--     pașii), deci orice ecran îi dă 404. Mai rău: `checklist_pregateste_pasul`
--     e `security invoker` și citește `ci.status` — pentru el iese NULL, iar
--     triggerul refuză cu „Checklistul este închis”, mesaj FALS.
-- D9  `inventory_*_select_checklist` sunt gardate EXCLUSIV pe
--     `checklists:update >= team`, fără `is_manager_of` și fără
--     `returnat_la is null` ⇒ deschid tot inventarul firmei, inclusiv stocul
--     nealocat.
-- D10 O instanță FĂRĂ PAȘI se finalizează singură: poarta „niciun pas
--     obligatoriu nebifat” e adevărată ÎN GOL (`array_agg` peste zero rânduri
--     întoarce NULL). În producție există deja o dovadă imutabilă, cu checksum,
--     care atestă o integrare încheiată cu `total_pasi = 0`.
--
-- Forward-only. Nu se editează nicio migrare aplicată; 0014 și 0076 rămân pe loc.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. D1 — managerul capătă `checklists:update`, dar la scope `own`, nu `team`
-- -----------------------------------------------------------------------------
-- `own` deschide EXACT ramura pe responsabil din `checklist_instance_items_update`
-- (0014:865): „pot bifa pasul al cărui responsabil sunt”. Exact cerința —
-- managerul pregătește laptopul, face turul biroului — și nimic peste.
--
-- `team` ar fi fost greșit din două motive, ambele verificate:
--   (a) ar aprinde `inventory_*_select_checklist` (0014:916-930), care cer
--       fix `update >= team` ⇒ tot inventarul firmei (D9, secțiunea 2);
--   (b) i-ar da dreptul să bifeze pașii HR-ului din onboardingul subalternului,
--       fiindcă ramura `team` se ancorează pe subordonarea față de SUBIECT, nu
--       pe faptul că e responsabilul desemnat.
--
-- Rândul e NOU, nu o modificare: cheia unică e (organization_id, member_id, role,
-- resource, action), iar managerul are azi doar `read` și `approve` pe
-- `checklists`. Clauza de conflict enumeră toate cele cinci coloane plus
-- `where deleted_at is null`, ca indexul `role_permissions_uq` redefinit la
-- 0063:52 (`nulls not distinct`). Tiparul e cel din 0075:1551.
insert into public.role_permissions (organization_id, role, resource, action, scope)
values (null, 'manager'::public.app_role, 'checklists', 'update', 'own'::public.permission_scope)
on conflict (organization_id, member_id, role, resource, action) where deleted_at is null do nothing;

-- Verificare în migrare, nu în teste: dacă seed-ul n-a intrat, restul fișierului
-- construiește pe nisip.
do $$
begin
  if not exists (
    select 1 from public.role_permissions rp
     where rp.organization_id is null and rp.member_id is null
       and rp.role = 'manager' and rp.resource = 'checklists'
       and rp.action = 'update' and rp.scope = 'own'
       and rp.deleted_at is null
  ) then
    raise exception 'D1: managerul tot nu are checklists:update = own dupa seed.';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. D9 — îngustarea celor două politici de vizibilitate pe Inventar
-- -----------------------------------------------------------------------------
-- OBLIGATORIU în ACEEAȘI migrare cu secțiunea 1. Chiar dacă `own` nu le aprinde
-- azi, ecranul de permisiuni per membru (0063 + angajati/[id]/permisiuni) lasă
-- orice org_admin să acorde mâine `checklists:update = 'team'` unui manager
-- anume — și atunci s-ar deschide stocul întregii firme, tăcut.
--
-- Forma e cea a politicilor proprii ale Inventarului după 0016:243-268:
-- subordonare explicită + doar alocările NEreturnate.
drop policy if exists inventory_allocations_select_checklist on public.inventory_allocations;

create policy inventory_allocations_select_checklist on public.inventory_allocations
for select to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'onboarding')
  and app.can(organization_id, 'checklists', 'update', 'team')
  and (
    app.has_permission(organization_id, 'checklists', 'update') = 'all'
    or app.is_manager_of(organization_id, employee_id)
  )
);

drop policy if exists inventory_items_select_checklist on public.inventory_items;

-- Obiectul se vede doar prin alocarea nereturnată care îl leagă de cineva din
-- subarborele privitorului. Fără `exists`, predicatul era plat și arăta și
-- stocul nealocat — exact ce interzice comentariul din 0010:619.
create policy inventory_items_select_checklist on public.inventory_items
for select to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'onboarding')
  and app.can(organization_id, 'checklists', 'update', 'team')
  and (
    app.has_permission(organization_id, 'checklists', 'update') = 'all'
    or exists (
      select 1
        from public.inventory_allocations a
       where a.item_id = public.inventory_items.id
         and a.organization_id = public.inventory_items.organization_id
         and a.deleted_at is null
         and a.returnat_la is null
         and app.is_manager_of(a.organization_id, a.employee_id)
    )
  )
);

-- -----------------------------------------------------------------------------
-- 3. D5 — `checklists:approve` capătă conținut: cine ÎNCHIDE parcursul
-- -----------------------------------------------------------------------------
-- Separare curată, de aici înainte:
--   `checklists:update`  = cine bifează pași
--   `checklists:approve` = cine finalizează sau anulează parcursul
-- Managerul are deja `approve = team` din 0002:1181, deci închiderea pentru
-- subordonați i se deschide fără niciun seed nou — iar bifarea rămâne îngustă
-- la `own`. Cheia încetează să fie moartă fără să lărgim nimic.
drop policy if exists checklist_instances_update on public.checklist_instances;

create policy checklist_instances_update on public.checklist_instances
for update to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'onboarding')
  and (
    (app.has_permission(organization_id, 'checklists', 'approve') = 'all')
    or (app.can(organization_id, 'checklists', 'approve', 'team')
        and app.is_manager_of(organization_id, employee_id))
  )
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and (
    (app.has_permission(organization_id, 'checklists', 'approve') = 'all')
    or (app.can(organization_id, 'checklists', 'approve', 'team')
        and app.is_manager_of(organization_id, employee_id))
  )
);

-- Dovada se scrie de `internal.checklist_dovada_parcurgere`, care e
-- `security invoker` (0014:518) ⇒ insertul trece prin politica de mai jos, cu
-- drepturile celui care a apăsat „Finalizează”. Trebuie să se potrivească exact
-- cu politica de UPDATE de deasupra, altfel finalizarea reușește și dovada cade.
drop policy if exists checklist_completion_records_insert on public.checklist_completion_records;

create policy checklist_completion_records_insert on public.checklist_completion_records
for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'onboarding')
  and (
    (app.has_permission(organization_id, 'checklists', 'approve') = 'all')
    or (app.can(organization_id, 'checklists', 'approve', 'team')
        and app.is_manager_of(organization_id, employee_id))
  )
);

-- -----------------------------------------------------------------------------
-- 4. D6 — responsabilul vede instanța, nu doar pasul
-- -----------------------------------------------------------------------------
-- Politicile sunt PERMISSIVE, deci asta se adaugă prin OR la
-- `checklist_instances_select` (0014:768), care rămâne neatinsă.
--
-- Fără ea, „sarcina atribuită responsabilului” — cerința centrală a acestei faze
-- — se naște moartă: `checklist_instance_items_select` (0014:836) îi dă pasul,
-- dar orice pagină citește întâi instanța și dă 404.
--
-- Nu introduce recursie: `checklist_instance_items_select` nu interoghează
-- `checklist_instances` (verificat, 0014:823-840).
create policy checklist_instances_select_responsabil on public.checklist_instances
for select to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'onboarding')
  and app.can(organization_id, 'checklists', 'read', 'own')
  and exists (
    select 1
      from public.checklist_instance_items ii
     where ii.instance_id = public.checklist_instances.id
       and ii.organization_id = public.checklist_instances.organization_id
       and ii.deleted_at is null
       and ii.responsabil_employee_id = app.current_employee_id(public.checklist_instances.organization_id)
  )
);

comment on policy checklist_instances_select_responsabil on public.checklist_instances is
  'Cine are un pas de făcut vede parcursul din care face parte. Ramura lipsea din 0014 și făcea sarcinile atribuite invizibile.';

-- Indexul care face `exists`-ul de mai sus ieftin. Parțial: coloana e NULL pe
-- majoritatea pașilor de azi, iar după 0089 se completează la materializare.
create index if not exists checklist_instance_items_responsabil_idx
  on public.checklist_instance_items (organization_id, responsabil_employee_id, status)
  where deleted_at is null and responsabil_employee_id is not null;

-- -----------------------------------------------------------------------------
-- 5. D6 (a doua jumătate) — mesajul fals „Checklistul este închis”
-- -----------------------------------------------------------------------------
-- Corpul e cel din 0014:566, NESCHIMBAT, cu o singură diferență: `security
-- definer`. Se rescrie integral, nu prin petic — un `create or replace` parțial
-- ar pierde restul regulilor (dovada cerută, bifarea automată).
--
-- DE CE: sub `invoker`, `select ci.status from public.checklist_instances` trece
-- prin RLS cu drepturile celui care bifează. Pentru un responsabil care nu e
-- subiectul, rândul e invizibil ⇒ `v_status` iese NULL ⇒
-- `null is distinct from 'in_curs'` e ADEVĂRAT ⇒ refuz cu un mesaj care descrie
-- o cauză inexistentă. Secțiunea 4 repară vizibilitatea pentru ecrane, dar un
-- trigger nu are voie să depindă de o politică de citire ca să afle un fapt.
--
-- Nu lărgește nimic: funcția citește O SINGURĂ coloană a instanței pe care
-- apelantul tocmai încearcă s-o modifice, iar dreptul de a modifica e decis mai
-- devreme, de `checklist_instance_items_update`.
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

revoke all on function internal.checklist_pregateste_pasul() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. D4 — se închid cele două verificări automate fără implementare
-- -----------------------------------------------------------------------------
-- `acces_revocat` și `documente_semnate` există în enum din 0014:19 și n-au fost
-- implementate niciodată. Interfața le arată `disabled` (formular-pas.tsx:338),
-- dar `src/schemas/checklist.ts:203` acceptă enumul ÎNTREG — deci un apel direct
-- la Server Action creează un pas care, prin `_automat_ck`, e obligatoriu și
-- nebifabil pe veci, iar instanța devine imposibil de finalizat. Garda de server
-- lipsea cu totul; o punem în bază, unde nu poate fi ocolită.
--
-- Valorile NU se scot din enum (Postgres nu știe `drop value`, iar 0014 e
-- aplicată). Se închid prin CHECK, ceea ce e mai onest: rămân vizibile în
-- catalog ca istorie, dar nu se mai pot scrie.
--
-- `not valid` + `validate` separat: pe o tabelă cu rânduri, forma asta verifică
-- explicit ce e deja acolo și eșuează ZGOMOTOS dacă găsește ceva, în loc să
-- blocheze migrarea la `alter table` cu un mesaj generic.
alter table public.checklist_template_items
  add constraint checklist_template_items_verificare_ck
  check (verificare_automata is null
         or verificare_automata in ('inventar_returnat', 'curs_finalizat'))
  not valid;

alter table public.checklist_template_items
  validate constraint checklist_template_items_verificare_ck;

alter table public.checklist_instance_items
  add constraint checklist_instance_items_verificare_ck
  check (verificare_automata is null
         or verificare_automata in ('inventar_returnat', 'curs_finalizat'))
  not valid;

alter table public.checklist_instance_items
  validate constraint checklist_instance_items_verificare_ck;

comment on constraint checklist_template_items_verificare_ck on public.checklist_template_items is
  'Închide acces_revocat și documente_semnate: valori de enum din 0014 fără implementare, care fac instanța imposibil de finalizat.';

-- -----------------------------------------------------------------------------
-- 7. D10 — un parcurs fără pași nu se mai pornește și nu se mai finalizează
-- -----------------------------------------------------------------------------
-- Defectul, măsurat în producție: un șablon cu zero pași a produs o instanță
-- care s-a finalizat pe loc și a emis o `checklist_completion_records` imutabilă,
-- cu checksum, cu `total_pasi = 0` și `continut = []`. Un document care nu atestă
-- nimic, dar arată exact ca unul care atestă.
--
-- Cauza: poarta din `checklist_verifica_finalizarea` (0014:490) face
-- `array_agg(...) into v_pasi` peste pașii obligatorii nebifați și se uită dacă
-- `v_pasi is not null`. Peste ZERO rânduri, `array_agg` întoarce NULL — deci
-- „nu există pași nebifați” e adevărat ÎN GOL.
--
-- Precedentul reparației e în repo: `internal.cursuri_pregateste_inrolarea`
-- (0075:508) refuză înrolarea la un curs nepublicat, dezactivat sau FĂRĂ NICIO
-- LECȚIE. Modulul de cursuri a învățat lecția; integrarea nu.
--
-- Se repară AMBELE capete. Doar poarta de pornire n-ar ajunge: cele două
-- instanțe deja existente în producție ar rămâne finalizabile.

-- 7a. Poarta de pornire. Corpul e cel din 0014:353, rescris integral, cu un
--     singur bloc nou. Rămâne `security invoker`: funcția se bazează deja pe
--     vizibilitatea șablonului ca să dea „Șablonul nu există sau nu aparține
--     organizației curente”, iar apelantul are `checklists:create = all`.
create or replace function internal.checklist_pregateste_instanta()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_tip public.checklist_tip;
  v_activ boolean;
  v_denumire text;
  v_ciclu smallint;
  v_pasi integer;
begin
  select t.tip, t.activ, t.denumire into v_tip, v_activ, v_denumire
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

  -- D10. Fără pași, tot restul lanțului devine ceremonie: instanța se
  -- materializează goală, poarta de finalizare e adevărată în gol, iar dovada
  -- imutabilă atestă zero.
  select count(*) into v_pasi
    from public.checklist_template_items ti
   where ti.template_id = new.template_id
     and ti.organization_id = new.organization_id
     and ti.deleted_at is null;

  if v_pasi = 0 then
    raise exception using errcode = 'P0001',
      message = format('Șablonul „%s” nu are niciun pas; un parcurs gol nu se poate porni.', v_denumire),
      hint = 'Adaugă cel puțin un pas în șablon, apoi reia pornirea.';
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

-- 7b. Poarta de finalizare. Corpul e cel din 0014:451, rescris integral, cu un
--     singur bloc nou — cel care refuză o instanță fără niciun pas
--     materializat. Fără el, cele două instanțe goale deja existente în
--     producție ar rămâne finalizabile, iar 7a n-ar acoperi decât viitorul.
create or replace function internal.checklist_verifica_finalizarea()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_nume text;
  v_lipsa text[];
  v_n integer;
  v_pasi text[];
  v_total integer;
begin
  if new.status is distinct from old.status and old.status <> 'in_curs' then
    raise exception using errcode = 'P0001',
      message = 'Checklistul este deja închis; statusul nu se mai poate schimba.',
      hint = 'Pornește un ciclu nou dacă procesul trebuie reluat.';
  end if;

  if new.status = 'finalizata' and old.status is distinct from 'finalizata' then
    perform app.checklist_sincronizeaza_inventar(new.organization_id, new.employee_id);
    v_nume := coalesce(app.checklist_nume_angajat(new.organization_id, new.employee_id), 'Angajatul');

    -- D10. ÎNAINTE de orice altă verificare: pe o listă goală, toate celelalte
    -- porți sunt adevărate în gol. `array_agg` peste zero rânduri întoarce NULL,
    -- deci „niciun pas obligatoriu nebifat” trecea, iar dovada imutabilă se
    -- scria cu total_pasi = 0.
    select count(*) into v_total
      from public.checklist_instance_items ii
     where ii.instance_id = new.id
       and ii.deleted_at is null;

    if v_total = 0 then
      raise exception using errcode = 'P0001',
        message = format('Parcursul lui %s nu are niciun pas; nu se poate finaliza.', v_nume),
        hint = 'Anulează parcursul și pornește-l din nou dintr-un șablon cu pași.';
    end if;

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

-- -----------------------------------------------------------------------------
-- 8. Verificarea finală a migrării
-- -----------------------------------------------------------------------------
-- Cele trei fapte pe care restul fazei le presupune. Dacă vreunul lipsește,
-- migrarea cade AICI, nu peste trei tranșe, într-un ecran gol.
do $$
declare
  v_lipsa text[] := '{}';
begin
  if not exists (
    select 1 from pg_catalog.pg_policy
     where polname = 'checklist_instances_select_responsabil'
       and polrelid = 'public.checklist_instances'::regclass
  ) then
    v_lipsa := v_lipsa || 'politica pentru responsabil pe checklist_instances';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'internal' and p.proname = 'checklist_pregateste_pasul'
       and p.prosecdef
  ) then
    v_lipsa := v_lipsa || 'checklist_pregateste_pasul nu e security definer';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
     where conname = 'checklist_template_items_verificare_ck'
       and conrelid = 'public.checklist_template_items'::regclass
       and convalidated
  ) then
    v_lipsa := v_lipsa || 'CHECK-ul pe verificare_automata';
  end if;

  if array_length(v_lipsa, 1) > 0 then
    raise exception 'Migrarea 0088 nu s-a aplicat complet: %', array_to_string(v_lipsa, ', ');
  end if;
end;
$$;
