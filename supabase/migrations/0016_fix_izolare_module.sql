-- ─────────────────────────────────────────────────────────────────────────────
-- 0016_fix_izolare_module.sql — găurile de izolare din fazele 3a, 5 și 8
--
-- Vânătoarea adversarială a REPRODUS empiric fiecare defect de mai jos, cu
-- SQLSTATE-ul sau rândul returnat. Nu sunt observații de stil; sunt scenarii
-- rulate cap-coadă pe o bază cu toate migrările aplicate.
--
-- Migrarea asta repară exclusiv ce ține de IZOLARE și de PRIVILEGII — clasa R1
-- din planul de riscuri, cea care încheie produsul dacă se materializează o
-- singură dată. Defectele care fac un modul să nu funcționeze (fără să scurgă
-- nimic) sunt în migrarea următoare; ordinea e deliberată.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- A. FAZA 5 — ȘTERGERE FIZICĂ CROSS-TENANT
--
-- Reprodus integral: firma B execută
--     update inventory_items set import_batch_id = '<lotul firmei A>'
-- pe propriul obiect (îi reușește: nicio politică și niciun trigger nu leagă
-- lotul de organizație). Apoi HR-ul firmei A revocă lotul SĂU, legitim, iar
-- `app.revoca_import_inventar` filtrează doar pe `import_batch_id`. Obiectul
-- firmei B dispare FIZIC din baza de date.
--
-- Nu e o scurgere de citire, e o DISTRUGERE de date la comanda altui tenant, iar
-- `inventory_items` e singura tabelă din proiect fără soft delete, deci nu există
-- nimic de recuperat. Rândul de audit se scrie în organizația A, nu în B, așa că
-- firma păgubită nu are nici măcar urma incidentului.
--
-- Se repară pe DOUĂ straturi, fiindcă oricare singur ar fi fost suficient azi și
-- insuficient la prima refactorizare:
--   A1 — funcția nu mai atinge niciodată rânduri din altă organizație;
--   A2 — un trigger refuză de la bun început legarea la un lot străin.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function app.revoca_import_inventar(
  p_batch_id uuid,
  p_motiv text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org      uuid;
  v_status   public.inventory_import_status;
  v_alocate  integer;
  v_sterse   integer;
begin
  select b.organization_id, b.status into v_org, v_status
    from public.inventory_import_batches b
   where b.id = p_batch_id and b.deleted_at is null;

  if v_org is null then
    raise exception using errcode = 'PT404',
      message = 'Lotul de import nu a fost găsit.';
  end if;

  if not (
    v_org = any ((select app.current_org_ids())::uuid[])
    and app.can(v_org, 'inventory', 'update', 'all')
  ) then
    raise exception using errcode = 'PT403',
      message = 'Nu aveți dreptul de a revoca importuri de inventar în această organizație.';
  end if;

  if v_status = 'revocat' then
    raise exception using errcode = 'P0001',
      message = 'Lotul a fost deja revocat.';
  end if;

  -- Garda de alocări: `a.deleted_at is null` a fost SCOS deliberat.
  -- Cheia străină `inventory_allocations_item_id_fkey` e `on delete restrict` și
  -- nu știe de ștergere logică. Cu garda veche, un lot ale cărui alocări fuseseră
  -- șterse logic trecea de verificare și cădea abia la `delete`, cu eroarea brută
  -- de Postgres, în engleză, iar lotul rămânea în starea veche:
  --     ERROR: update or delete on table "inventory_items" violates foreign key
  --            constraint "inventory_allocations_item_id_fkey"
  -- Orice alocare, ștearsă sau nu, este istoric juridic și blochează revocarea.
  select count(*)::integer into v_alocate
    from public.inventory_items i
   where i.import_batch_id = p_batch_id
     and i.organization_id = v_org
     and exists (
       select 1 from public.inventory_allocations a
        where a.item_id = i.id
     );

  if v_alocate > 0 then
    raise exception using errcode = 'P0001',
      message = 'Importul nu mai poate fi revocat: ' || v_alocate::text ||
                ' obiect(e) din lot au fost deja predate unor angajați. Corectați obiectele individual sau casați-le.';
  end if;

  perform internal.sync_expirable(
            v_org, 'inventory_item', i.id, 'garantie',
            i.denumire, null::date, 'inventory_items', null, false)
     from public.inventory_items i
    where i.import_batch_id = p_batch_id
      and i.organization_id = v_org;

  delete from public.inventory_items
   where import_batch_id = p_batch_id
     and organization_id = v_org;
  get diagnostics v_sterse = row_count;

  update public.inventory_import_batches
     set status = 'revocat',
         revocat_la = now(),
         revocat_de = (select auth.uid()),
         motiv_revocare = left(p_motiv, 1000),
         updated_at = now()
   where id = p_batch_id;

  perform app.write_audit(
    'delete', v_org, 'inventory_items', p_batch_id, null,
    jsonb_build_object('import_batch_id', p_batch_id, 'obiecte_sterse', v_sterse,
                       'motiv', left(p_motiv, 1000)));

  return v_sterse;
end;
$$;

revoke all on function app.revoca_import_inventar(uuid, text) from public, anon;
grant execute on function app.revoca_import_inventar(uuid, text) to authenticated, service_role;


-- A2. `import_batch_id` nu mai poate arăta către lotul altei organizații.
--     Verificarea trăiește într-un trigger, nu într-o constrângere CHECK, fiindcă
--     depinde de alt rând. O cheie străină compusă ar fi fost mai elegantă, dar
--     ar fi cerut un UNIQUE(id, organization_id) pe loturi și o migrare de coloană
--     pe o tabelă deja populată — trigger-ul obține aceeași garanție acum.

create or replace function internal.inventory_items_lot_propriu()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lot_org uuid;
begin
  if new.import_batch_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.import_batch_id is not distinct from old.import_batch_id then
    return new;
  end if;

  select b.organization_id into v_lot_org
    from public.inventory_import_batches b
   where b.id = new.import_batch_id;

  if v_lot_org is null then
    raise exception using errcode = 'P0001',
      message = 'Lotul de import indicat nu există.';
  end if;

  if v_lot_org <> new.organization_id then
    raise exception using errcode = 'P0001',
      message = 'Lotul de import aparține altei organizații.';
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_items_lot_propriu on public.inventory_items;
create trigger inventory_items_lot_propriu
  before insert or update on public.inventory_items
  for each row execute function internal.inventory_items_lot_propriu();


-- ═════════════════════════════════════════════════════════════════════════════
-- A3. FAZA 5 — CHEIA PRIMARĂ A UNEI PREDĂRI-PRIMIRI ERA REscriibilă
--
-- Reprodus: un angajat obișnuit, cu `inventory:read` la scope 'own' și nimic mai
-- mult, a executat
--     update inventory_allocations set id = gen_random_uuid() where id = '...'
-- și a reușit. Triggerul de validare fixa 8 coloane pe UPDATE, dar lista era
-- NEAGRĂ și `id` nu figura în ea.
--
-- Trec pe listă ALBĂ. Diferența nu e cosmetică: o listă neagră trebuie extinsă la
-- fiecare coloană nouă, de către cineva care își amintește că trebuie. O listă
-- albă blochează implicit orice coloană viitoare, iar autorul ei este obligat să
-- o declare explicit ca modificabilă. Aceeași alegere ar fi prevenit defectul.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function internal.inventory_alloc_imutabile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Singurele coloane pe care o predare-primire le poate schimba după creare.
  -- Orice altceva — inclusiv `id`, `organization_id`, `item_id`, `employee_id`,
  -- `predat_la`, `created_at`, `created_by` — este istoric.
  v_modificabile constant text[] := array[
    'returnat_la', 'stare_la_returnare', 'observatii', 'pv_document_path',
    'confirmat_de_angajat_la', 'deleted_at', 'updated_at', 'updated_by'
  ];
  v_diferite text;
begin
  select string_agg(cheie, ', ' order by cheie) into v_diferite
    from jsonb_each_text(to_jsonb(new)) as n(cheie, valoare)
    join jsonb_each_text(to_jsonb(old)) as o(cheie, valoare) using (cheie)
   where n.valoare is distinct from o.valoare
     and not (n.cheie = any (v_modificabile));

  if v_diferite is not null then
    raise exception using errcode = 'P0001',
      message = 'Nu se pot modifica datele de bază ale unei predări-primiri (' || v_diferite ||
                '). Anulați predarea și înregistrați una nouă.';
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_alloc_imutabile on public.inventory_allocations;
create trigger inventory_alloc_imutabile
  before update on public.inventory_allocations
  for each row execute function internal.inventory_alloc_imutabile();


-- ═════════════════════════════════════════════════════════════════════════════
-- A4. FAZA 5 — „ce am eu în primire" arăta și ce am RETURNAT
--
-- Reprodus: un angajat cu scope 'own' care returnase un telefon acum 30 de zile
-- vedea în continuare fișa LIVE a obiectului — denumire, stare, unde se află
-- acum. Managerul, la scope 'team', vedea tot ce a atins vreodată echipa lui.
-- Politica cerea doar `a.deleted_at is null`, deci orice alocare din istoric,
-- oricât de veche, ținea vizibilitatea deschisă la nesfârșit.
--
-- Comentariul din 0010 promitea „ce am eu în primire"; codul spunea „ce am avut
-- vreodată". Adaug condiția care lipsea.
-- ═════════════════════════════════════════════════════════════════════════════

drop policy if exists inventory_items_select on public.inventory_items;
create policy inventory_items_select on public.inventory_items
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'inventory')
    and (
      app.has_permission(organization_id, 'inventory', 'read') = 'all'
      or (
        app.has_permission(organization_id, 'inventory', 'read') = 'team'
        and exists (
          select 1 from public.inventory_allocations a
           where a.item_id = public.inventory_items.id
             and a.deleted_at is null
             and a.returnat_la is null
             and app.is_manager_of(organization_id, a.employee_id)
        )
      )
      or (
        app.has_permission(organization_id, 'inventory', 'read') = 'own'
        and exists (
          select 1 from public.inventory_allocations a
           where a.item_id = public.inventory_items.id
             and a.deleted_at is null
             and a.returnat_la is null
             and a.employee_id = app.current_employee_id(organization_id)
        )
      )
    )
  );


-- ═════════════════════════════════════════════════════════════════════════════
-- B. PRIVILEGII REDESCHISE PRIN `GRANT ... ON ALL TABLES`
--
-- Măsurat pe o bază cu toate migrările aplicate:
--     select table_name, privilege_type from information_schema.role_table_grants
--      where grantee = 'authenticated'
--   → audit_logs, email_log, features, platform_admins, demo_requests au din nou
--     INSERT, SELECT, UPDATE.
--
-- Cauza: `0005_hr_rls.sql` și `0010_inventory.sql` repetă amândouă
--     grant select, insert, update on all tables in schema public to authenticated;
-- ca să acopere tabelele lor noi, dar `on all tables` nu știe care sunt „noi". Ele
-- recompensează și cele cinci tabele pe care `0001_kernel.sql` le revocase anume.
-- Compensările de după acoperă doar `rate_limits` și `employee_sensitive_data`.
--
-- Astăzi RLS încă refuză scrierile (un INSERT forjat în audit_logs ca angajat dă
-- „new row violates row-level security policy"), deci NU e o escaladare
-- exploatabilă — este erodarea apărării în adâncime. Contează fiindcă exact aceste
-- cinci tabele sunt cele în care o politică scrisă greșit nu mai are nimic în
-- spate: jurnalul de audit care trebuie să fie append-only, lista administratorilor
-- de platformă, catalogul de module.
--
-- Repar revocările ȘI mut regula într-o funcție reutilizabilă, ca migrarea
-- următoare care scrie `on all tables` să o poată chema în loc să reinventeze
-- lista din memorie.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function internal.reaplica_revocarile_de_platforma()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Append-only: rândurile se scriu exclusiv prin internal.audit_trigger() și
  -- app.write_audit(), ambele SECURITY DEFINER.
  revoke insert, update on public.audit_logs   from authenticated;
  revoke insert, update on public.email_log    from authenticated;
  -- Catalog de platformă: se administrează din Super-Admin, cu service_role.
  revoke insert, update on public.features         from authenticated;
  revoke insert, update on public.platform_admins  from authenticated;
  -- Formularul public trece printr-o funcție SECURITY DEFINER, tocmai ca să nu
  -- fie nevoie de INSERT direct pe tabelă.
  revoke insert on public.demo_requests from authenticated;
  -- Fără politici și fără privilegii, deliberat (0005/0010).
  revoke all on public.rate_limits             from authenticated;
  revoke all on public.employee_sensitive_data from authenticated;
end;
$$;

revoke all on function internal.reaplica_revocarile_de_platforma() from public, anon, authenticated;

select internal.reaplica_revocarile_de_platforma();

comment on function internal.reaplica_revocarile_de_platforma() is
  'De chemat după ORICE `grant ... on all tables in schema public`. Fără ea, granturile în masă recompensează tabelele pe care 0001 le-a revocat anume.';


-- ═════════════════════════════════════════════════════════════════════════════
-- C. FAZA 3a — ESCALADARE LA DATE DE SĂNĂTATE (art. 9 GDPR)
--
-- Cel mai grav defect găsit în tot lotul. Reprodus pas cu pas:
--   1. un angajat obișnuit citește `leave_requests` → 0 rânduri străine, corect;
--   2. execută UN SINGUR INSERT în `approval_tasks`, cu `entity_id` = cererea
--      colegului și `approver_user_id` = el însuși. Politica `approval_tasks_insert`
--      nu cerea NICIO permisiune, doar apartenența la organizație;
--   3. reia citirea. Ramura `exists (... approval_tasks ...)` din
--      `leave_requests_select` îi deschide acum cererea colegului: cod de
--      indemnizație CNAS, seria și numărul certificatului medical, plus `motiv`,
--      text liber în care oamenii scriu diagnosticul.
--
-- Valorile citite în reproducere au fost reale pentru fixture: cod `09`, serie AB,
-- număr 123456, motiv „chimioterapie".
--
-- Remediul nu e restrângerea politicii de INSERT, ci ȘTERGEREA ei. Sarcinile de
-- aprobare sunt generate exclusiv de `internal.leave_requests_sincronizeaza()`,
-- care e SECURITY DEFINER — verificat: fluxul normal nu are nevoie de privilegiul
-- de INSERT al utilizatorului. Un drept care nu e folosit de nimic legitim, dar
-- deschide o cale de citire, nu are ce căuta acordat.
-- ═════════════════════════════════════════════════════════════════════════════

drop policy if exists approval_tasks_insert on public.approval_tasks;
revoke insert on public.approval_tasks from authenticated;

comment on table public.approval_tasks is
  'Sarcini de aprobare. Fără politică și fără privilegiu de INSERT pentru `authenticated`, deliberat: se creează exclusiv din triggerele SECURITY DEFINER ale entităților aprobabile. O sarcină forjată deschidea citirea entității vizate (0016).';


-- ═════════════════════════════════════════════════════════════════════════════
-- C2. FAZA 3a — AUTO-APROBARE
--
-- Reprodus: cu propriul JWT, angajatul a executat
--     update leave_requests set status = 'aprobata', decis_de = <el însuși>
-- pe propria cerere aflată în 'trimisa' → UPDATE 1, status devenit 'aprobata',
-- `decis_la` completat de trigger.
--
-- `WITH CHECK` verifica doar organizația. `USING` permitea autorului să atingă
-- rândul cât timp e în 'ciorna'/'trimisa' — corect — dar nimic nu limita ÎN CE
-- stare are voie să-l ducă.
--
-- Separ cele două roluri în predicat:
--   • autorul poate muta cererea doar între stările proprii și nu poate scrie
--     niciodată câmpurile deciziei;
--   • aprobarea cere `leave:approve` la scope 'all' sau calitatea de manager al
--     angajatului, ȘI interzice explicit cazul în care cel care aprobă este chiar
--     angajatul — un manager își rămâne propriul superior în `manager_path`, deci
--     fără condiția asta un șef de departament s-ar aproba singur.
-- ═════════════════════════════════════════════════════════════════════════════

drop policy if exists leave_requests_update on public.leave_requests;
create policy leave_requests_update on public.leave_requests
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'leave')
    and (
      (employee_id = app.current_employee_id(organization_id) and status in ('ciorna', 'trimisa'))
      or app.is_manager_of(organization_id, employee_id)
      or app.has_permission(organization_id, 'leave', 'update') = 'all'
      or app.has_permission(organization_id, 'leave', 'approve') = 'all'
    )
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      -- Ramura autorului: stări proprii, fără câmpuri de decizie.
      (
        employee_id = app.current_employee_id(organization_id)
        and status in ('ciorna', 'trimisa', 'anulata')
        and decis_de is null
        and decis_la is null
        and motiv_respingere is null
      )
      -- Ramura celui care decide: nu poate fi angajatul însuși.
      or (
        employee_id <> app.current_employee_id(organization_id)
        and (
          app.is_manager_of(organization_id, employee_id)
          or app.has_permission(organization_id, 'leave', 'approve') = 'all'
        )
      )
      -- Ramura administrativă: HR corectează o cerere fără să o decidă.
      or (
        app.has_permission(organization_id, 'leave', 'update') = 'all'
        and employee_id <> app.current_employee_id(organization_id)
      )
    )
  );


-- ═════════════════════════════════════════════════════════════════════════════
-- C3. FAZA 3a — ORACOL CROSS-TENANT PE CALENDARUL DE LUCRU
--
-- `app.este_zi_lucratoare` și `app.numara_zile_lucratoare` sunt SECURITY DEFINER,
-- au EXECUTE pentru `authenticated` și primeau organizația ca parametru fără să
-- verifice apartenența.
--
-- Reprodus: un angajat din organizația A, pentru care `app.is_member(orgB)` e fals
-- și `select ... from organization_holidays where organization_id = orgB` întoarce
-- 0 rânduri (RLS își face treaba), a apelat
--     select app.este_zi_lucratoare(orgB, '2026-09-08')
-- și a primit `false`, față de `true` pentru propria organizație — adică a aflat
-- că firma concurentă are acolo o zi liberă proprie.
--
-- Scurgerea e mică în volum și completă în principiu: o funcție definer care
-- acceptă `organization_id` de la apelant și nu-l validează transformă orice
-- helper într-un canal lateral. Reguli identice se aplică oricărui helper viitor.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function app.este_zi_lucratoare(p_organization_id uuid, p_data date)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (app.is_service_context() or app.is_member(p_organization_id)) then
    raise exception using errcode = 'PT403',
      message = 'Nu aveți acces la calendarul acestei organizații.';
  end if;

  -- Corpul de mai jos e COPIA EXACTĂ a celui din 0009, inclusiv ordinea ramurilor.
  -- Singura modificare a acestei migrări este garda de apartenență de mai sus.
  --
  -- Ordinea contează și e ușor de stricat la o rescriere: `zi_recuperare` se
  -- evaluează ÎNAINTEA weekendului, fiindcă exact asta înseamnă — o sâmbătă
  -- lucrată în locul unei zile de punte. Dacă ramura ajunge după verificarea de
  -- weekend, nu se mai atinge niciodată, iar ziua de recuperare dispare din
  -- pontaj și din normele de concediu, fără nicio eroare vizibilă.
  return (
    select case
      when exists (
        select 1 from public.organization_holidays oh
        where oh.organization_id = p_organization_id and oh.data = p_data
          and oh.tip = 'zi_recuperare' and oh.deleted_at is null
      ) then true
      when extract(isodow from p_data) in (6, 7) then false
      when exists (
        select 1 from public.public_holidays ph
        where ph.tara = 'RO' and ph.data = p_data and ph.deleted_at is null
      ) then false
      when exists (
        select 1 from public.organization_holidays oh
        where oh.organization_id = p_organization_id and oh.data = p_data
          and oh.tip = 'liber_suplimentar' and oh.deleted_at is null
      ) then false
      else true
    end
  );
end;
$$;

-- `numara_zile_lucratoare` are CINCI parametri, ultimii doi cu valori implicite
-- pentru jumătățile de zi. Prima variantă a acestei corecții a redefinit-o cu
-- trei — ceea ce nu a suprascris nimic, ci a CREAT O SUPRAÎNCĂRCARE, iar orice
-- apel cu trei argumente a devenit imediat ambiguu:
--     ERROR: function app.numara_zile_lucratoare(uuid, date, date) is not unique
-- Adică apelul care mergea înainte de „corecție" a încetat să meargă după ea.
-- Semnătura de mai jos e identică cu cea din 0009; se schimbă doar garda.
--
-- Corpul rămâne `sql`, nu devine `plpgsql`: verificarea se face o singură dată,
-- la intrare, iar `app.este_zi_lucratoare` o repetă oricum pentru fiecare zi —
-- redundanță ieftină și, mai important, care nu se poate uita la un apel viitor
-- din altă parte.
create or replace function app.numara_zile_lucratoare(
  p_organization_id uuid, p_inceput date, p_sfarsit date,
  p_portiune_inceput public.leave_day_portion default 'zi_intreaga',
  p_portiune_sfarsit public.leave_day_portion default 'zi_intreaga'
) returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(
    case when app.este_zi_lucratoare(p_organization_id, z::date) then
      case
        when z::date = p_inceput and p_portiune_inceput <> 'zi_intreaga' then 0.5
        when z::date = p_sfarsit and p_portiune_sfarsit <> 'zi_intreaga' then 0.5
        else 1
      end
    else 0 end
  ), 0)::numeric(6,2)
  from generate_series(p_inceput, p_sfarsit, interval '1 day') as z;
$$;

revoke all on function app.este_zi_lucratoare(uuid, date) from public, anon;
grant execute on function app.este_zi_lucratoare(uuid, date) to authenticated, service_role;


-- ═════════════════════════════════════════════════════════════════════════════
-- D. FAZA 8 — DREPTUL DE SCRIERE DERIVA DIN SCOPE-UL DE CITIRE
--
-- Reprodus: un șofer cu `trip_sheets:read = all`, `update = own`, `approve = none`
-- a executat
--     update trip_sheets set observatii = '...', km_sosire = 999
-- pe foaia ALTUI șofer → UPDATE 1, valorile s-au schimbat.
--
-- Cauza e o confuzie între prag și filtru. `app.can(org,'trip_sheets','update','own')`
-- răspunde doar la „are cel puțin dreptul de a scrie undeva?"; filtrul de RÂND era
-- `app.poate_vedea_foaie()`, care comută pe `trip_sheets:read`. Cine citește tot,
-- scrie tot.
--
-- Introduc `app.poate_scrie_foaie()`, geamăna care comută pe `update`, și o
-- folosesc în politicile de scriere. Helperul de citire rămâne neatins.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function app.poate_scrie_foaie(p_organization_id uuid, p_sofer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case app.has_permission(p_organization_id, 'trip_sheets', 'update')
    when 'all'  then true
    when 'team' then p_sofer_id is not null
                     and (p_sofer_id = app.current_employee_id(p_organization_id)
                          or app.is_manager_of(p_organization_id, p_sofer_id))
    when 'own'  then p_sofer_id is not null
                     and p_sofer_id = app.current_employee_id(p_organization_id)
    else false
  end;
$$;

revoke all on function app.poate_scrie_foaie(uuid, uuid) from public, anon;
grant execute on function app.poate_scrie_foaie(uuid, uuid) to authenticated, service_role;

comment on function app.poate_scrie_foaie(uuid, uuid) is
  'Filtrul de rând pentru SCRIEREA foilor de parcurs. Comută pe trip_sheets:update, nu pe :read — altfel cine citește tot, scrie tot (0016).';

-- `deleted_at is null` iese din USING-ul politicii de SELECT.
--
-- Reprodus separat: ca `org_admin` cu read=all și update=all,
--     update trip_sheets set deleted_at = now()
-- → „new row violates row-level security policy". Ștergerea logică era imposibilă
-- pe TOATE tabelele de flotă, pentru orice rol, fiindcă politica de SELECT se
-- aplică și rândului NOU, iar rândul nou tocmai a primit `deleted_at`.
-- Restul platformei nu face asta: `employees` filtrează ștergerea logică în
-- interogări, nu în politică. Aliniez flota la convenția existentă.

drop policy if exists foi_select on public.trip_sheets;
create policy foi_select on public.trip_sheets
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.poate_vedea_foaie(organization_id, employee_id)
  );

drop policy if exists foi_update on public.trip_sheets;
create policy foi_update on public.trip_sheets
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and (
      app.poate_scrie_foaie(organization_id, employee_id)
      or (app.can(organization_id, 'trip_sheets', 'approve', 'team')
          and app.poate_vedea_foaie(organization_id, employee_id))
    )
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      app.poate_scrie_foaie(organization_id, employee_id)
      or (app.can(organization_id, 'trip_sheets', 'approve', 'team')
          and app.poate_vedea_foaie(organization_id, employee_id))
    )
  );


-- D2. Auto-aprobarea foii proprii, la orice scope.
--
-- Reprodus: un șofer cu `trip_sheets:approve = all` — scope-ul pe care seed-ul îl
-- dă lui `org_admin` — și-a aprobat propria foaie: status 'aprobat', `aprobat_de`
-- egal cu propriul uid, `employee_id` tot el.
--
-- Triggerul din 0012 excepta explicit scope-ul 'all' de la verificare
-- (`... and app.has_permission(...) <> 'all'`), presupunând că cine are dreptul
-- total e deasupra regulii. Într-o firmă mică, administratorul CHIAR e și șofer;
-- exact acolo separarea contează, fiindcă foaia de parcurs e document justificativ
-- pentru consumul de combustibil dedus fiscal.
-- Singura excepție rămâne contextul de serviciu (import, migrare, job).

create or replace function internal.foi_parcurs_fara_autoaprobare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'aprobat'
     and (tg_op = 'INSERT' or old.status is distinct from 'aprobat')
     and not app.is_service_context()
     and new.employee_id is not null
     and new.employee_id = app.current_employee_id(new.organization_id)
  then
    raise exception using errcode = 'P0001',
      message = 'Nu vă puteți aproba propria foaie de parcurs. Ea trebuie aprobată de altcineva, fiindcă este document justificativ pentru consumul de combustibil.';
  end if;
  return new;
end;
$$;

drop trigger if exists foi_parcurs_fara_autoaprobare on public.trip_sheets;
create trigger foi_parcurs_fara_autoaprobare
  before insert or update on public.trip_sheets
  for each row execute function internal.foi_parcurs_fara_autoaprobare();


-- ── Verificare finală: privilegiile chiar au rămas revocate ──────────────────
do $$
declare
  v_rele text;
begin
  select string_agg(distinct table_name, ', ' order by table_name) into v_rele
    from information_schema.role_table_grants
   where grantee = 'authenticated'
     and table_schema = 'public'
     and privilege_type in ('INSERT', 'UPDATE')
     and table_name in ('audit_logs', 'email_log', 'features', 'platform_admins');

  if v_rele is not null then
    raise exception 'Revocările de platformă nu au avut efect: % au încă INSERT sau UPDATE pentru authenticated.', v_rele;
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
     where grantee = 'authenticated' and table_schema = 'public'
       and table_name = 'approval_tasks' and privilege_type = 'INSERT'
  ) then
    raise exception 'approval_tasks are încă INSERT pentru authenticated — calea de escaladare la datele medicale rămâne deschisă.';
  end if;
end
$$;
