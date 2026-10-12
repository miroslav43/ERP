-- supabase/migrations/0196_flota_roluri.sql
--
-- FLOTA, FAZA F3: DREPTURI PE ROLURI ȘI „MAȘINA MEA” ÎN PORTAL.
--
-- ── DE UNDE VINE MIGRAREA ───────────────────────────────────────────────────
-- Până aici flota era, în practică, a unui singur rol. `employee` n-avea niciun
-- drept pe vehicule sau pe foi, `manager` aproba foi pe care nu le putea
-- întocmi și nu vedea mașinile pe care le conduce echipa lui, iar marketingul
-- promitea „Șoferii predau foile”. F1 (0171) a mutat scrierile de pe dreptul de
-- citire pe cel de scriere, F2 (0173) a adus alocările ca perioade și steagul
-- `pool`. Abia acum se pot lărgi drepturile fără să se deschidă găuri.
--
-- Planul o numea `0173_flota_roluri`; numărul s-a ocupat între timp (alocări,
-- apoi 0184–0190 pe alte trasee).
--
-- ── CE SE SCHIMBĂ ───────────────────────────────────────────────────────────
-- A. SEED (rânduri GLOBALE, `organization_id` și `member_id` null), după
--    tiparul din 0161: actualizare, apoi inserare dacă n-a găsit nimic.
--      employee: trip_sheets read/create/update = own, vehicles read = own;
--      manager:  vehicles read = team, trip_sheets create/update = own
--                (approve = team și read = team rămân).
--    Suprascrierile pe firmă și pe membru (0063, respectate de rezolvitori din
--    0189 prin `internal.scope_membru`) bat în continuare rândul global: o
--    firmă care a închis flota unui rol din pagina de permisiuni rămâne așa.
--    Nimic din migrarea asta nu rezolvă drepturile ALTUI utilizator; toate
--    verificările de mai jos privesc apelantul, prin `app.has_permission`,
--    care avea deja precedența membrului.
--
-- B. VEHICULELE POOL devin vizibile oricui are `vehicles:read` cel puțin `own`,
--    împreună cu DOCUMENTELE lor (ITP, RCA, rovinietă): sunt actele de bord ale
--    mașinii pe care șoferul o poate lua, deci decizie asumată. ANOMALIILE de
--    kilometraj NU urmează pool-ul: o anomalie e o suspiciune pe foaia unui
--    om anume. Se văd după vehicul fără ramura de pool SAU după foaia pe care
--    s-au produs (revizia de securitate).
--    `app.poate_vedea_vehicul(org, șofer)` primește geamăna cu trei argumente
--    (`…, pool`) pentru politica de pe `vehicles`, și
--    `app.poate_vedea_vehicul_dupa_id(org, vehicul)` pentru tabelele copil
--    (documente, anomalii), care ar fi făcut altfel două căutări pe vehicul.
--    Forma cu două argumente rămâne neschimbată: o mai folosește
--    `alocari_select` (0173), pe șoferul ALOCĂRII, unde pool-ul nu contează.
--
-- C. `internal.foi_parcurs_inainte` (forma ultimă: 0018 §F1, neatinsă de 0171
--    și 0173 — verificat cu grep pe toate migrările) primește două gărzi:
--
--    C1. Cine nu poate întocmi foi pe orice vehicul (`trip_sheets:create` ≠
--        `all`) întocmește doar pe un vehicul `pool` sau pe unul care îi este
--        alocat, pentru șoferul foii, în ZIUA foii (ora României). Aceeași
--        regulă la UPDATE, când se schimbă vehiculul, șoferul sau plecarea, pe
--        `trip_sheets:update` — altfel foaia s-ar fi creat pe pool și apoi
--        mutată pe mașina colegului.
--
--    C2. Ramura de APROBARE din `foi_update` (0016: aprobator pe echipă care
--        vede foaia) lăsa aprobatorul să scrie ORICE coloană pe foaia unui
--        subordonat: kilometri, ore, ștergerea logică, chiar trimiterea unei
--        ciorne. Cu `trip_sheets:update = own` dat managerului, golul ar fi
--        devenit o portiță vizibilă din interfață — aceeași clasă ca MGR-017 la
--        diurnă (2407e004), unde garda a rămas în acțiune. Aici stă în bază:
--        când apelantul NU poate scrie foaia pe dreptul de scriere, singura
--        schimbare permisă e decizia, `trimis` → `aprobat`/`respins`, cu
--        motivul ei. Orice altă coloană schimbată dă P0001.
--
--    C3. (revizia de securitate, înainte de aplicare) C2 judecă foaia VECHE.
--        Fără C3, un manager își lua foaia proprie trimisă și, într-un singur
--        UPDATE, o muta pe un subordonat și o aproba: USING trecea pe foaia
--        veche, WITH CHECK pe ramura de aprobare, iar garda „nu vă puteți
--        aproba singur” compara șoferul NOU. Acum mutarea foii pe alt șofer
--        cere dreptul de scriere și pe șoferul NOU, iar aprobarea unei foi
--        întocmite de cel care aprobă e refuzată sub `approve = all`.
--
--    C4. (santinela de izolare, înainte de aplicare) Gărzile foii APROBATE
--        fuseseră scrise când doar administratorul (`update = all`) ajungea
--        la ea. Cu `update = own`, șoferul își rescria traseul și scopul unei
--        foi aprobate, își muta semnătura aprobării pe alt om (`aprobat_de` nu
--        se rescria pe un UPDATE fără schimbare de stare), își ștergea
--        alimentările și chiar foaia. Acum: `created_by`, `trimis_la`,
--        `aprobat_de`, `aprobat_la` sunt ale bazei pe orice UPDATE; pe o foaie
--        aprobată, cine nu are `update = all` nu schimbă nimic, iar cine are
--        poate doar s-o storneze (ștergere logică). Aceeași regulă pe
--        `internal.alimentari_inainte` (secțiunea C'), unde, în plus, o
--        alimentare nu se mută de pe o foaie pe alta.
--
-- D. `app.can_path` (forma ultimă: 0144 §5). La `team`, orice resursă în afară
--    de `employees`/`leave` trecea cu `true`. Acum `trip_sheets` (segmentul 3 =
--    fișa șoferului) și `vehicles` (segmentul 3 = id-ul vehiculului) se
--    verifică pe entitate, la `team` ȘI la `own`. Pool-ul deschide doar
--    CITIREA căii unui vehicul; scrierea rămâne pe șoferul lui. `courses` își
--    păstrează excepția din 0144.
--
-- ── CE NU E AICI ────────────────────────────────────────────────────────────
-- * `hr` nu primește nimic pe flotă (decizia 3 din plan: doar permisele și
--   avizele șoferilor, în F9).
-- * Numerotarea, liniile foii și snapshot-ul vehiculului: F4.
-- * Notificările pe fluxul foii: F5.

begin;

-- ============================================================
-- A. Seed pe roluri
-- ============================================================
--
-- Fiecare pereche (rol, resursă, acțiune) are propriul UPDATE, scris în forma
-- pe care o citește `src/content/landing/matrice-roluri.test.ts`: matricea
-- publicată pe pagina de prezentare se recompune din migrări, nu din memorie.

do $$
begin
  update public.role_permissions
     set scope = 'own', updated_at = now()
   where role = 'employee' and resource = 'trip_sheets' and action = 'read'
     and organization_id is null and member_id is null and deleted_at is null;
  if not found then
    insert into public.role_permissions (role, resource, action, scope)
    values ('employee', 'trip_sheets', 'read', 'own');
  end if;

  update public.role_permissions
     set scope = 'own', updated_at = now()
   where role = 'employee' and resource = 'trip_sheets' and action = 'create'
     and organization_id is null and member_id is null and deleted_at is null;
  if not found then
    insert into public.role_permissions (role, resource, action, scope)
    values ('employee', 'trip_sheets', 'create', 'own');
  end if;

  update public.role_permissions
     set scope = 'own', updated_at = now()
   where role = 'employee' and resource = 'trip_sheets' and action = 'update'
     and organization_id is null and member_id is null and deleted_at is null;
  if not found then
    insert into public.role_permissions (role, resource, action, scope)
    values ('employee', 'trip_sheets', 'update', 'own');
  end if;

  update public.role_permissions
     set scope = 'own', updated_at = now()
   where role = 'employee' and resource = 'vehicles' and action = 'read'
     and organization_id is null and member_id is null and deleted_at is null;
  if not found then
    insert into public.role_permissions (role, resource, action, scope)
    values ('employee', 'vehicles', 'read', 'own');
  end if;

  update public.role_permissions
     set scope = 'team', updated_at = now()
   where role = 'manager' and resource = 'vehicles' and action = 'read'
     and organization_id is null and member_id is null and deleted_at is null;
  if not found then
    insert into public.role_permissions (role, resource, action, scope)
    values ('manager', 'vehicles', 'read', 'team');
  end if;

  update public.role_permissions
     set scope = 'own', updated_at = now()
   where role = 'manager' and resource = 'trip_sheets' and action = 'create'
     and organization_id is null and member_id is null and deleted_at is null;
  if not found then
    insert into public.role_permissions (role, resource, action, scope)
    values ('manager', 'trip_sheets', 'create', 'own');
  end if;

  update public.role_permissions
     set scope = 'own', updated_at = now()
   where role = 'manager' and resource = 'trip_sheets' and action = 'update'
     and organization_id is null and member_id is null and deleted_at is null;
  if not found then
    insert into public.role_permissions (role, resource, action, scope)
    values ('manager', 'trip_sheets', 'update', 'own');
  end if;
end
$$;

-- ============================================================
-- B. Vehiculele pool, vizibile la own/team
-- ============================================================

create or replace function app.poate_vedea_vehicul(
  p_organization_id uuid,
  p_sofer_id uuid,
  p_pool boolean
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case app.has_permission(p_organization_id, 'vehicles', 'read')
    when 'all'  then true
    when 'team' then coalesce(p_pool, false)
                     or (p_sofer_id is not null
                         and (p_sofer_id = app.current_employee_id(p_organization_id)
                              or app.is_manager_of(p_organization_id, p_sofer_id)))
    when 'own'  then coalesce(p_pool, false)
                     or (p_sofer_id is not null
                         and p_sofer_id = app.current_employee_id(p_organization_id))
    else false
  end;
$$;

comment on function app.poate_vedea_vehicul(uuid, uuid, boolean) is
  'Vizibilitatea unui vehicul după scope-ul vehicles:read al apelantului: all = tot; team = pool, al meu sau al echipei; own = pool sau al meu (0196).';

create or replace function app.poate_vedea_vehicul_dupa_id(p_organization_id uuid, p_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select app.poate_vedea_vehicul(p_organization_id, v.employee_id, v.pool)
      from public.vehicles v
     where v.id = p_vehicle_id
       and v.organization_id = p_organization_id
  ), false);
$$;

comment on function app.poate_vedea_vehicul_dupa_id(uuid, uuid) is
  'Ca app.poate_vedea_vehicul(org, șofer, pool), citit după id-ul vehiculului — pentru tabelele copil (documente, anomalii). O singură căutare pe vehicul (0196).';

revoke all on function app.poate_vedea_vehicul(uuid, uuid, boolean) from public, anon;
revoke all on function app.poate_vedea_vehicul_dupa_id(uuid, uuid) from public, anon;
grant execute on function app.poate_vedea_vehicul(uuid, uuid, boolean) to authenticated, service_role;
grant execute on function app.poate_vedea_vehicul_dupa_id(uuid, uuid) to authenticated, service_role;

-- Politicile de SELECT, în forma din 0018 §F2 (fără `deleted_at` în USING),
-- cu filtrul de rând înlocuit.
drop policy if exists vehicule_select on public.vehicles;
create policy vehicule_select on public.vehicles
  for select to authenticated
  using (
    (select app.is_platform_admin())
    or (
      organization_id = any ((select app.current_org_ids())::uuid[])
      and app.feature_on(organization_id, 'fleet')
      and app.poate_vedea_vehicul(organization_id, employee_id, pool)
    )
  );

drop policy if exists vdoc_select on public.vehicle_documents;
create policy vdoc_select on public.vehicle_documents
  for select to authenticated
  using (
    (select app.is_platform_admin())
    or (
      organization_id = any ((select app.current_org_ids())::uuid[])
      and app.feature_on(organization_id, 'fleet')
      and app.poate_vedea_vehicul_dupa_id(organization_id, vehicle_id)
    )
  );

-- Anomaliile: vehiculul fără ramura de pool (exact vizibilitatea dinainte de
-- 0196) SAU foaia pe care s-a produs anomalia. Pe un pool, șoferul își vede
-- anomalia de pe foaia proprie, nu și pe ale colegilor.
drop policy if exists anomalii_select on public.odometer_anomalies;
create policy anomalii_select on public.odometer_anomalies
  for select to authenticated
  using (
    (select app.is_platform_admin())
    or (
      organization_id = any ((select app.current_org_ids())::uuid[])
      and app.feature_on(organization_id, 'fleet')
      and (
        app.poate_vedea_vehicul(organization_id, app.vehicul_sofer(vehicle_id), false)
        or (trip_sheet_id is not null
            and app.poate_vedea_foaie(organization_id, app.foaie_sofer(trip_sheet_id)))
      )
    )
  );

-- ============================================================
-- C. internal.foi_parcurs_inainte — corpul din 0018 §F1 + gărzile C1 și C2
-- ============================================================
--
-- Mesajele vechi rămân cu sedilă, cuvânt cu cuvânt: `flota/erori.ts` le
-- potrivește pe forma lor. Cele două mesaje noi au ș/ț corecte.

create or replace function internal.foi_parcurs_inainte()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_vehicul public.vehicles%rowtype;
  v_ultim   integer;
  v_zi      date;
  v_scope   public.permission_scope;
  -- Coloanele pe care le poate schimba decizia unui aprobator. Restul rândului
  -- e al șoferului. `km_parcursi` e GENERATED: valoarea lui din NEW, într-un
  -- trigger BEFORE, nu e cea finală, deci nu intră în comparație.
  c_decizie constant text[] := array['status', 'motiv_respingere', 'aprobat_de', 'aprobat_la',
                                     'updated_at', 'updated_by', 'km_parcursi'];
  -- 0196 §C4: singurele coloane care se mișcă pe o foaie aprobată, la stornare.
  c_stornare constant text[] := array['deleted_at', 'updated_at', 'updated_by', 'km_parcursi'];
begin
  -- 0196 §C4: semnăturile foii sunt ale BAZEI, nu ale payload-ului. Autorul nu
  -- se rescrie niciodată, iar `trimis_la`/`aprobat_de`/`aprobat_la` se pun doar
  -- în blocul de tranziție de mai jos, din sesiune. Fără asta, pe un UPDATE care
  -- lasă starea neschimbată, șoferul își muta semnătura aprobării pe alt om.
  if tg_op = 'UPDATE' and not app.is_service_context() then
    new.created_by := old.created_by;
    new.trimis_la  := old.trimis_la;
    new.aprobat_de := old.aprobat_de;
    new.aprobat_la := old.aprobat_la;
  end if;

  -- 0196 §C2: aprobatorul care NU poate scrie foaia pe dreptul de scriere a
  -- ajuns aici doar prin ramura de aprobare a lui `foi_update`. Atunci poate
  -- decide, atât.
  if tg_op = 'UPDATE'
     and not app.is_service_context()
     and not app.poate_scrie_foaie(old.organization_id, old.employee_id) then
    if not (old.status = 'trimis' and new.status in ('aprobat', 'respins'))
       or (pg_catalog.to_jsonb(new) - c_decizie) is distinct from (pg_catalog.to_jsonb(old) - c_decizie) then
      raise exception using errcode = 'P0001',
        message = 'Foaia de parcurs a unui coleg se poate doar aproba sau respinge, după ce a fost trimisă. O completează și o trimite șoferul ei.';
    end if;
  end if;

  -- 0196 §C3: C2 judecă foaia VECHE. Mutarea foii pe alt șofer cere dreptul
  -- de scriere și pe șoferul NOU, altfel foaia proprie trimisă devenea, într-un
  -- singur UPDATE, foaia aprobată a unui subordonat.
  if tg_op = 'UPDATE'
     and not app.is_service_context()
     and new.employee_id is distinct from old.employee_id
     and not app.poate_scrie_foaie(new.organization_id, new.employee_id) then
    raise exception using errcode = 'P0001',
      message = 'Foaia se poate muta doar pe un șofer pentru care aveți drept de întocmire.';
  end if;

  select * into v_vehicul from public.vehicles v
   where v.id = new.vehicle_id and v.deleted_at is null;
  if not found or v_vehicul.organization_id <> new.organization_id then
    raise exception using errcode = 'P0001',
      message = 'Vehiculul selectat nu aparţine organizaţiei dumneavoastră.';
  end if;
  if not exists (
    select 1 from public.employees e
     where e.id = new.employee_id and e.organization_id = new.organization_id and e.deleted_at is null
  ) then
    raise exception using errcode = 'P0001',
      message = 'Şoferul selectat nu aparţine organizaţiei dumneavoastră.';
  end if;
  if tg_op = 'INSERT' and v_vehicul.status in ('vandut', 'casat') then
    raise exception using errcode = 'P0001',
      message = 'Vehiculul este ieşit din parc (vândut sau casat). Nu se mai pot întocmi foi de parcurs pentru el.';
  end if;

  -- 0196 §C1: cine nu întocmește pe orice vehicul întocmește pe pool sau pe
  -- mașina alocată șoferului foii în ziua plecării. La INSERT contează
  -- `create`, la UPDATE (doar când se mută vehiculul, șoferul sau plecarea)
  -- contează `update`.
  if not app.is_service_context()
     and (tg_op = 'INSERT'
          or (new.vehicle_id, new.employee_id, new.plecare_la)
             is distinct from (old.vehicle_id, old.employee_id, old.plecare_la)) then
    v_scope := app.has_permission(new.organization_id, 'trip_sheets',
                                  case when tg_op = 'INSERT' then 'create' else 'update' end);
    -- `none` nu intră aici: îl refuză RLS (WITH CHECK rulează după triggerele
    -- BEFORE), cu mesajul de drept, nu cu unul despre vehicul.
    if v_scope in ('own', 'team') and not v_vehicul.pool then
      v_zi := (new.plecare_la at time zone 'Europe/Bucharest')::date;
      if not exists (
        select 1 from public.vehicle_assignments a
         where a.vehicle_id = new.vehicle_id
           and a.employee_id = new.employee_id
           and a.organization_id = new.organization_id
           and a.deleted_at is null
           and a.de_la < ((v_zi + 1)::timestamp at time zone 'Europe/Bucharest')
           and coalesce(a.pana_la, 'infinity'::timestamptz) > (v_zi::timestamp at time zone 'Europe/Bucharest')
      ) then
        raise exception using errcode = 'P0001',
          message = 'Vehiculul ales nu vă este alocat în ziua plecării și nu este o mașină comună (pool). Foaia se întocmește pe vehiculul primit în folosință sau pe unul din pool.';
      end if;
    end if;
  end if;

  -- 0196 §C4: foaia APROBATĂ e document justificativ pentru combustibilul
  -- dedus. Gărzile de mai jos au fost scrise când doar administratorul
  -- (`update = all`) ajungea la ea; din 0196, șoferul și managerul au
  -- `update = own` pe foile lor. Cine nu are `update = all` nu mai atinge
  -- nimic pe o foaie aprobată: nici textul, nici ștergerea logică, nici
  -- reînvierea uneia stornate.
  if tg_op = 'UPDATE' and old.status = 'aprobat' and not app.is_service_context()
     and app.has_permission(new.organization_id, 'trip_sheets', 'update') is distinct from 'all' then
    raise exception using errcode = 'P0001',
      message = 'Foaia de parcurs este aprobată și nu se mai modifică. Dacă are o greșeală, cereți administratorului flotei să o storneze, apoi întocmiți una nouă.';
  end if;

  -- O foaie aprobată este un document justificativ: cifrele ei nu se mai ating.
  if tg_op = 'UPDATE' and old.status = 'aprobat' and new.deleted_at is null
     and (old.vehicle_id, old.employee_id, old.plecare_la, old.sosire_la, old.km_plecare, old.km_sosire)
         is distinct from (new.vehicle_id, new.employee_id, new.plecare_la, new.sosire_la, new.km_plecare, new.km_sosire) then
    raise exception using errcode = 'P0001',
      message = 'Foaia de parcurs este aprobată. Pentru corecţii, stornaţi-o şi întocmiţi una nouă.';
  end if;

  -- 0196 §C4, și pentru `update = all`: pe foaia aprobată se mișcă doar
  -- ștergerea logică (stornarea, sau anularea ei). Traseul, scopul, motivul și
  -- observațiile țin de document la fel ca cifrele de mai sus.
  if tg_op = 'UPDATE' and old.status = 'aprobat' and not app.is_service_context()
     and (pg_catalog.to_jsonb(new) - c_stornare) is distinct from (pg_catalog.to_jsonb(old) - c_stornare) then
    raise exception using errcode = 'P0001',
      message = 'Foaia de parcurs aprobată se poate doar storna. Pentru corecții, stornați-o și întocmiți una nouă.';
  end if;

  -- 0018 §F1: doar la INSERT sau la tranziţia draft→trimis.
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and old.status = 'draft' and new.status = 'trimis') then
    select max(t.km_sosire) into v_ultim
      from public.trip_sheets t
     where t.vehicle_id = new.vehicle_id
       and t.deleted_at is null
       and t.status = 'aprobat'
       and t.km_sosire is not null
       and (tg_op = 'INSERT' or t.id <> new.id);
    v_ultim := greatest(coalesce(v_ultim, 0), coalesce(v_vehicul.km_curent, 0));

    -- Prepopulare: şoferul nu trebuie să caute cifra de pe foaia precedentă.
    if new.km_plecare is null then
      new.km_plecare := v_ultim;
    end if;

    -- REGRES = imposibil fizic => refuz. (Saltul se tratează în triggerul AFTER.)
    if new.km_plecare < v_ultim then
      raise exception using errcode = 'P0001',
        message = format('Kilometrajul de plecare (%s km) este mai mic decât ultimul kilometraj cunoscut al vehiculului (%s km). Un odometru nu poate da înapoi: verificaţi cifra introdusă sau corectaţi foaia de parcurs anterioară.',
                         new.km_plecare, v_ultim);
    end if;
  end if;

  if new.km_sosire is not null and new.km_sosire <= new.km_plecare then
    raise exception using errcode = 'P0001',
      message = 'Kilometrajul de sosire trebuie să fie mai mare decât cel de plecare.';
  end if;
  if new.sosire_la is not null and new.sosire_la <= new.plecare_la then
    raise exception using errcode = 'P0001',
      message = 'Ora de sosire trebuie să fie după ora de plecare.';
  end if;

  if tg_op = 'UPDATE' and new.status <> old.status then
    if not (
      (old.status = 'draft'   and new.status = 'trimis')
      or (old.status = 'trimis'  and new.status in ('aprobat', 'respins', 'draft'))
      or (old.status = 'respins' and new.status = 'draft')
    ) then
      raise exception using errcode = 'P0001',
        message = format('Nu se poate trece foaia de parcurs din starea „%s" în starea „%s".', old.status, new.status);
    end if;

    if new.status in ('trimis', 'aprobat') and (new.km_sosire is null or new.sosire_la is null) then
      raise exception using errcode = 'P0001',
        message = 'Completaţi ora şi kilometrajul de sosire înainte de a trimite foaia spre aprobare.';
    end if;

    if new.status = 'trimis' then new.trimis_la := now(); end if;

    if new.status = 'aprobat' then
      -- Aprobarea nu se poate forja din payload: dreptul se verifică aici, iar
      -- semnătura se pune din sesiune.
      if not app.is_service_context() then
        if not app.can(new.organization_id, 'trip_sheets', 'approve', 'team') then
          raise exception using errcode = 'P0001',
            message = 'Nu aveţi dreptul de a aproba foi de parcurs.';
        end if;
        -- 0018 §F7: la scope 'team', dreptul de aprobare acoperă DOAR subordonaţii.
        if app.has_permission(new.organization_id, 'trip_sheets', 'approve') = 'team'
           and not app.is_manager_of(new.organization_id, new.employee_id) then
          raise exception using errcode = 'P0001',
            message = 'Puteţi aproba doar foile de parcurs ale angajaţilor din subordinea dumneavoastră.';
        end if;
        if new.employee_id = app.current_employee_id(new.organization_id)
           and app.has_permission(new.organization_id, 'trip_sheets', 'approve') <> 'all' then
          raise exception using errcode = 'P0001',
            message = 'Nu vă puteţi aproba singur propria foaie de parcurs.';
        end if;
        -- 0196 §C3, apărare în adâncime: nici foaia întocmită de cel care
        -- aprobă, oricare ar fi șoferul ei.
        if old.created_by = (select auth.uid())
           and app.has_permission(new.organization_id, 'trip_sheets', 'approve') <> 'all' then
          raise exception using errcode = 'P0001',
            message = 'Nu puteți aproba o foaie întocmită de dumneavoastră.';
        end if;
        new.aprobat_de := (select auth.uid());
      end if;
      new.aprobat_la := now();
    else
      new.aprobat_de := null;
      new.aprobat_la := null;
    end if;

    if new.status = 'respins' and coalesce(btrim(new.motiv_respingere), '') = '' then
      raise exception using errcode = 'P0001',
        message = 'Precizaţi motivul respingerii, ca şoferul să ştie ce are de corectat.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function internal.foi_parcurs_inainte() from public, anon, authenticated;

-- ============================================================
-- C'. internal.alimentari_inainte — corpul din 0018 §F8 + garda C4
-- ============================================================
--
-- Forma ultimă e 0018 (grep pe toate migrările: 0171 a schimbat doar
-- politicile). Scutirea din 0018, „ștergerea logică trece și pe o foaie
-- aprobată”, era scrisă pentru administrator. Din 0196, șoferul are
-- `trip_sheets:update = own`, deci `alimentari_update` (0171) îl lasă pe
-- alimentările foii lui — inclusiv pe cele ale foii APROBATE. Garda judecă
-- foaia VECHE (de pe care pleacă alimentarea), fiindcă foaia nouă poate fi o
-- ciornă oarecare.

create or replace function internal.alimentari_inainte()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_foaie public.trip_sheets%rowtype;
  v_stare_veche public.trip_sheet_status;
begin
  -- F8: validare explicită, ÎNAINTEA oricărei alte verificări, ca mesajul de
  -- business (română, P0001) să apară mereu — indiferent dacă Postgres ar fi
  -- evaluat coloana generată sau CHECK-ul înaintea acestui trigger.
  if new.litri is null or new.litri <= 0 then
    raise exception using errcode = 'P0001',
      message = 'Cantitatea de combustibil alimentată trebuie să fie mai mare decât zero.';
  end if;

  -- 0196 §C4: alimentarea unei foi aprobate nu se mai atinge, nici ștearsă,
  -- nici mutată; iar una nu se mută între foi deloc (s-ar scoate de pe un
  -- document și s-ar pune pe altul, fără urmă în niciunul).
  if tg_op = 'UPDATE' and not app.is_service_context() then
    new.created_by := old.created_by;
    select t.status into v_stare_veche from public.trip_sheets t where t.id = old.trip_sheet_id;
    if v_stare_veche = 'aprobat' then
      raise exception using errcode = 'P0001',
        message = 'Alimentarea face parte dintr-o foaie de parcurs aprobată și nu se mai modifică. Pentru corecții, foaia se stornează și se întocmește una nouă.';
    end if;
    if new.trip_sheet_id is distinct from old.trip_sheet_id then
      raise exception using errcode = 'P0001',
        message = 'Alimentarea nu se mută pe altă foaie de parcurs. Ștergeți-o și adăugați-o pe foaia corectă.';
    end if;
  end if;

  select * into v_foaie from public.trip_sheets t
   where t.id = new.trip_sheet_id and t.deleted_at is null;
  if not found or v_foaie.organization_id <> new.organization_id then
    raise exception using errcode = 'P0001',
      message = 'Foaia de parcurs selectată nu aparţine organizaţiei dumneavoastră.';
  end if;
  if v_foaie.status in ('aprobat', 'respins') and new.deleted_at is null then
    raise exception using errcode = 'P0001',
      message = 'Foaia de parcurs nu mai este în lucru. Alimentările nu se mai pot modifica după aprobare sau respingere.';
  end if;
  if new.alimentat_la < v_foaie.plecare_la
     or (v_foaie.sosire_la is not null and new.alimentat_la > v_foaie.sosire_la) then
    raise exception using errcode = 'P0001',
      message = 'Data alimentării este în afara intervalului foii de parcurs.';
  end if;
  return new;
end;
$$;

revoke all on function internal.alimentari_inainte() from public, anon, authenticated;

-- ============================================================
-- D. app.can_path — corpul din 0144 §5 + ramurile de flotă
-- ============================================================

create or replace function app.can_path(p_name text, p_action text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with p as (
    select app.path_org(p_name) as org,
           app.path_resource(p_name) as res,
           app.path_segment(p_name, 3) as ent
  )
  select coalesce((
    select case
      when p.org is null or p.res is null then false
      when not (p.org = any (app.current_org_ids())) then false
      else case app.has_permission(p.org, p.res, p_action)
             when 'all'  then true
             -- `team` verificat pe ENTITATEA din cale, pe resursele ale căror
             -- căi poartă o entitate cu proprietar în segmentul 3:
             --   `employees`, `leave`, `trip_sheets` → fișa de personal
             --     (la foi: a șoferului, `{org}/trip_sheets/{employee_id}/…`);
             --   `vehicles` → vehiculul, al cărui proprietar e șoferul alocat
             --     (`vehicles.employee_id`, derivatul alocării din 0173).
             -- `courses` rămâne pe vechiul comportament: segmentul 3 e
             -- `course_materials.id` (motivul complet în 0144 §5).
             when 'team' then case
                                when p.res in ('employees', 'leave', 'trip_sheets') then exists (
                                  select 1
                                  from public.employees e
                                  where e.id::text = p.ent
                                    and e.organization_id = p.org
                                    and e.deleted_at is null
                                    and app.is_manager_of(p.org, e.id)
                                )
                                when p.res = 'vehicles' then exists (
                                  select 1
                                  from public.vehicles v
                                  where v.id::text = p.ent
                                    and v.organization_id = p.org
                                    and v.deleted_at is null
                                    and ((p_action = 'read' and v.pool)
                                         or (v.employee_id is not null
                                             and app.is_manager_of(p.org, v.employee_id)))
                                )
                                else true
                              end
             -- Două chei pentru aceeași persoană: `auth.uid()` când entitatea
             -- din cale ESTE contul (avatare, preferințe), `employees.id` când
             -- entitatea e fișa de personal (0073 defectul b). Vehiculul are a
             -- treia: e al meu dacă îmi e alocat acum; pool-ul se citește.
             when 'own'  then case
                                when p.res = 'vehicles' then exists (
                                  select 1
                                  from public.vehicles v
                                  where v.id::text = p.ent
                                    and v.organization_id = p.org
                                    and v.deleted_at is null
                                    and ((p_action = 'read' and v.pool)
                                         or (v.employee_id is not null
                                             and v.employee_id = app.current_employee_id(p.org)))
                                )
                                else p.ent = (select auth.uid())::text
                                     or exists (
                                          select 1
                                          from public.employees e
                                          where e.id::text = p.ent
                                            and e.organization_id = p.org
                                            and e.user_id = (select auth.uid())
                                            and e.deleted_at is null
                                        )
                              end
             else false
           end
    end
    from p
  ), false);
$$;

revoke all on function app.can_path(text, text) from public, anon;
grant execute on function app.can_path(text, text) to authenticated, service_role;

-- ============================================================
-- E. Verificare
-- ============================================================

do $$
declare
  v_lipsa text;
begin
  select string_agg(format('%s %s:%s=%s', a.rol, a.res, a.act, a.scope), ', ')
    into v_lipsa
    from (values
      ('employee', 'trip_sheets', 'read',    'own'),
      ('employee', 'trip_sheets', 'create',  'own'),
      ('employee', 'trip_sheets', 'update',  'own'),
      ('employee', 'vehicles',    'read',    'own'),
      ('manager',  'vehicles',    'read',    'team'),
      ('manager',  'trip_sheets', 'create',  'own'),
      ('manager',  'trip_sheets', 'update',  'own'),
      ('manager',  'trip_sheets', 'approve', 'team'),
      ('manager',  'trip_sheets', 'read',    'team')
    ) as a(rol, res, act, scope)
   where not exists (
     select 1 from public.role_permissions rp
      where rp.role::text = a.rol and rp.resource = a.res and rp.action = a.act
        and rp.scope::text = a.scope
        and rp.organization_id is null and rp.member_id is null and rp.deleted_at is null
   );
  if v_lipsa is not null then
    raise exception '0196: seed incomplet — lipsesc: %', v_lipsa;
  end if;

  if exists (
    select 1 from public.role_permissions rp
     where rp.role = 'hr' and rp.resource in ('vehicles', 'trip_sheets')
       and rp.organization_id is null and rp.member_id is null and rp.deleted_at is null
       and rp.scope <> 'none'
  ) then
    raise exception '0196: hr are un drept global pe flotă; decizia 3 din plan spune că nu.';
  end if;
end
$$;

commit;

-- ============================================================
-- Note de proiectare
-- ============================================================
--
-- * C1 cere alocarea în ZIUA foii, nu în minutul plecării: alocarea începe
--   des „acum”, la predare, iar foaia aceleiași zile se scrie cu ora de
--   plecare de dimineață. Intervalul alocării e semideschis, ca EXCLUDE-ul din
--   0173.
-- * C1 nu verifică dacă apelantul VEDE vehiculul: triggerul e SECURITY DEFINER,
--   iar regula e despre dreptul de a conduce mașina, nu de a o citi.
-- * C3 nu se aplică lui `org_admin` (update = all, approve = all): el poate
--   întocmi o foaie pentru un șofer și o poate aproba.
-- * C2 se sprijină pe `app.poate_scrie_foaie` (0016), filtrul pe `update`. Un
--   `org_admin` (update = all) nu e atins. Contextul de serviciu (seed,
--   importuri, psql) nu e atins de niciuna dintre gărzi.
-- * `to_jsonb(new) - c_decizie` compară TOT rândul, inclusiv coloanele pe care
--   le vor adăuga F4 (data, numărul, snapshot-ul). Numerotarea din F4 e un
--   trigger separat, `foi_parcurs_numerotare`, care rulează DUPĂ acesta
--   (ordine alfabetică), deci nu se lovește de gardă.
