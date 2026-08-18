-- ─────────────────────────────────────────────────────────────────────────────
-- 0018_fix_flota.sql — modulul de flotă (0012_fleet.sql + 0012b) chiar funcţionează
--
-- Opt defecte, fiecare REPRODUS pe o bază curată (0001..0016 aplicate) înainte
-- de a fi atins codul, şi RE-reprodus (acum ca „nu se mai întâmplă") după.
-- `app.poate_scrie_foaie()`, politicile `foi_select`/`foi_update` şi blocarea
-- auto-aprobării — reparate deja în 0016 — NU se ating aici.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- F1. REGRESUL DE KILOMETRAJ BLOCA ORICE UPDATE, NU DOAR INTRAREA CIFREI
--
-- Reprodus: foaia A (10000→10200, „trimis”) + foaia B (12000→12100) aprobată
-- prima → vehicles.km_curent devine 12100. Apoi pe A:
--     update trip_sheets set status='aprobat' where id=A
-- → P0001 „Kilometrajul de plecare (10000 km) este mai mic decât ultimul
-- kilometraj cunoscut (12100 km)”. IDENTIC pentru status='respins',
-- deleted_at=now() şi observatii='notă' — SQLSTATE P0001, verificat pe toate
-- patru. Cauza: blocul care calculează v_ultim şi compară cu new.km_plecare
-- rulează necondiţionat, la FIECARE UPDATE, nu doar când km_plecare chiar
-- înseamnă ceva nou. Cum km_curent al vehiculului nu scade niciodată şi e
-- mereu ≥ km_sosire al propriei foi, verificarea devine imposibil de trecut
-- pentru orice foaie mai veche decât cea mai recentă aprobată — inclusiv
-- STORNAREA (,,respins”/soft-delete) unei foi greşite, exact operaţia care ar
-- trebui să rămână mereu posibilă.
--
-- Verificările automate (typecheck/lint/teste unitare) nu execută secvenţa
-- „aprobă B, apoi atinge A” — au nevoie de DOUĂ foi şi de o ordine anume de
-- aprobare, deci scapă unui test care creează o singură foaie şi o aprobă.
--
-- REMEDIU: regresul (calculul lui v_ultim + prepopularea + refuzul) rulează
-- doar la INSERT sau la tranziţia draft→trimis — momentele în care cifra de
-- plecare chiar DEVINE oficială. Verificările structurale independente
-- (sosire > plecare, oră sosire > oră plecare) rămân neschimbate, la fel ca
-- restul funcţiei (validare vehicul/şofer, imutabilitatea foii aprobate,
-- tranziţiile de stare, aprobarea/respingerea). Corpul e o COPIE a celui din
-- 0012 — singura schimbare e condiţia care înfăşoară blocul de regres, plus
-- (F7, mai jos) garda de is_manager_of pe ramura de aprobare la scope 'team'.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function internal.foi_parcurs_inainte()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_vehicul public.vehicles%rowtype;
  v_ultim   integer;
begin
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

  -- O foaie aprobată este un document justificativ: cifrele ei nu se mai ating.
  if tg_op = 'UPDATE' and old.status = 'aprobat' and new.deleted_at is null
     and (old.vehicle_id, old.employee_id, old.plecare_la, old.sosire_la, old.km_plecare, old.km_sosire)
         is distinct from (new.vehicle_id, new.employee_id, new.plecare_la, new.sosire_la, new.km_plecare, new.km_sosire) then
    raise exception using errcode = 'P0001',
      message = 'Foaia de parcurs este aprobată. Pentru corecţii, stornaţi-o şi întocmiţi una nouă.';
  end if;

  -- F1: doar la INSERT sau la tranziţia draft→trimis, adică exact momentele în
  -- care km_plecare devine cifra oficială a foii. O aprobare, o respingere, o
  -- ştergere logică sau o notă NU repun în discuţie o cifră deja acceptată —
  -- şi, mai ales, nu trebuie blocate de faptul că ALTĂ foaie a fost aprobată
  -- între timp şi a ridicat km_curent al vehiculului peste km_plecare al
  -- foii curente.
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
        -- F7: la scope 'team', dreptul de aprobare acoperă DOAR subordonaţii.
        -- app.can(...,'team') e un PRAG ("cel puţin team"), nu un filtru de
        -- rând — el lasă să treacă şi pe cineva cu scope EXACT 'team' care nu
        -- e managerul angajatului de pe foaie. La scope 'all' garda de mai jos
        -- nu se aplică (are dreptul necondiţionat).
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


-- ═════════════════════════════════════════════════════════════════════════════
-- F2. ŞTERGEREA LOGICĂ ERA IMPOSIBILĂ PE vehicles / vehicle_documents /
--     fuel_entries / odometer_anomalies, PENTRU ORICE ROL
--
-- Reprodus: ca org_admin (read=all, update=all),
--     update vehicles set deleted_at = now()
-- → „new row violates row-level security policy for table vehicles” (42501),
-- deşi WITH CHECK-ul politicii de UPDATE nu menţionează deloc `deleted_at`.
-- Cauza e politica de SELECT: `using (deleted_at is null and ...)`. La UPDATE,
-- Postgres verifică şi vizibilitatea rândului NOU prin politicile de SELECT
-- (ca un SELECT implicit al rândului rezultat) — iar rândul nou tocmai a
-- primit `deleted_at`, deci devine invizibil pentru propria lui politică de
-- SELECT şi UPDATE-ul e refuzat ca „nu respectă politica de securitate”.
-- Confirmat separat: cu `alter policy vehicule_select using (true)`, acelaşi
-- UPDATE trece.
--
-- `trip_sheets` avea exact acelaşi defect şi a fost reparat în 0016 (secţ. D):
-- `deleted_at is null` a ieşit din USING-ul politicii de SELECT. Restul
-- platformei nu pune ştergerea logică în politică: `employees`/`departments`
-- (0005) filtrează `deleted_at is null` în INTEROGĂRI, nu în RLS — vezi
-- `employees_select`, care nu are deloc `deleted_at is null`. Aliniez celelalte
-- patru tabele de flotă la aceeaşi convenţie.
--
-- Politicile de UPDATE îşi păstrează `deleted_at is null` în USING (un rând
-- deja şters nu se mai poate atinge din nou) — asta NU cauzează problema,
-- fiindcă USING la UPDATE se aplică rândului VECHI, iar rândul vechi (înainte
-- de ştergere) chiar are `deleted_at is null`.
-- ═════════════════════════════════════════════════════════════════════════════

drop policy if exists vehicule_select on public.vehicles;
create policy vehicule_select on public.vehicles
  for select to authenticated
  using (
    (select app.is_platform_admin())
    or (
      organization_id = any ((select app.current_org_ids())::uuid[])
      and app.feature_on(organization_id, 'fleet')
      and app.poate_vedea_vehicul(organization_id, employee_id)
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
      and app.poate_vedea_vehicul(organization_id, app.vehicul_sofer(vehicle_id))
    )
  );

drop policy if exists alimentari_select on public.fuel_entries;
create policy alimentari_select on public.fuel_entries
  for select to authenticated
  using (
    (select app.is_platform_admin())
    or (
      organization_id = any ((select app.current_org_ids())::uuid[])
      and app.feature_on(organization_id, 'fleet')
      and app.poate_vedea_foaie(organization_id, app.foaie_sofer(trip_sheet_id))
    )
  );

drop policy if exists anomalii_select on public.odometer_anomalies;
create policy anomalii_select on public.odometer_anomalies
  for select to authenticated
  using (
    (select app.is_platform_admin())
    or (
      organization_id = any ((select app.current_org_ids())::uuid[])
      and app.feature_on(organization_id, 'fleet')
      and app.poate_vedea_vehicul(organization_id, app.vehicul_sofer(vehicle_id))
    )
  );


-- ═════════════════════════════════════════════════════════════════════════════
-- F3. APROBAREA UNEI FOI EŞUA CU MESAJ FĂRĂ LEGĂTURĂ DACĂ ŞOFERUL ALOCAT
--     VEHICULULUI FUSESE ŞTERS LOGIC
--
-- Reprodus: angajat alocat ca şofer al vehiculului (vehicles.employee_id), cu
-- `deleted_at` setat. Aprobarea foii ALTUI şofer, pe acelaşi vehicul, ridică
-- `vehicles.km_curent` prin UPDATE (internal.foi_parcurs_dupa) → UPDATE-ul
-- trece prin `internal.vehicles_normalizeaza()` (trigger BEFORE UPDATE pe
-- vehicles), care revalidează necondiţionat `new.employee_id` — adică
-- şoferul ALOCAT VEHICULULUI, complet independent de cine a fost aprobat —
-- şi cade cu „Angajatul ales pentru vehicul nu aparţine organizaţiei
-- dumneavoastră.” Aprobarea eşuează, iar km_curent rămâne neschimbat, deşi
-- nimic din operaţie nu avea legătură cu şoferul alocat.
--
-- REMEDIU: verificarea de apartenenţă a lui `employee_id` rulează doar la
-- INSERT sau când `employee_id` chiar SE SCHIMBĂ — nu la orice UPDATE al
-- rândului `vehicles` (inclusiv cele venite din alte triggere, ca ridicarea
-- kilometrajului). Restul funcţiei e neschimbat.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function internal.vehicles_normalizeaza()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.nr_inmatriculare := upper(pg_catalog.regexp_replace(coalesce(new.nr_inmatriculare, ''), '[^A-Za-z0-9]', '', 'g'));
  if char_length(new.nr_inmatriculare) < 3 then
    raise exception using errcode = 'P0001',
      message = 'Numărul de înmatriculare este prea scurt. Introduceţi-l în forma B100XYZ.';
  end if;
  if new.vin is not null then
    new.vin := upper(pg_catalog.regexp_replace(new.vin, '[^A-Za-z0-9]', '', 'g'));
  end if;
  if new.status in ('vandut', 'casat') and new.data_iesire is null then
    new.data_iesire := app.azi_local();
  end if;
  if new.status not in ('vandut', 'casat') then
    new.data_iesire := null;
    new.motiv_iesire := null;
  end if;
  -- F3: doar la INSERT sau la schimbarea efectivă a lui employee_id — nu la
  -- orice UPDATE al vehiculului (ex. ridicarea km_curent la aprobarea unei
  -- foi de parcurs a ALTUI şofer, care nu atinge deloc alocarea curentă).
  if new.employee_id is not null
     and (tg_op = 'INSERT' or new.employee_id is distinct from old.employee_id)
     and not exists (
       select 1 from public.employees e
        where e.id = new.employee_id and e.organization_id = new.organization_id and e.deleted_at is null
     ) then
    raise exception using errcode = 'P0001',
      message = 'Angajatul ales pentru vehicul nu aparţine organizaţiei dumneavoastră.';
  end if;
  return new;
end;
$$;


-- ═════════════════════════════════════════════════════════════════════════════
-- F4. DEZACTIVAREA UNUI TIP DE DOCUMENT ÎNGHEŢA DOCUMENTELE DEJA EXISTENTE
--
-- Reprodus: `update vehicle_document_types set activ=false where cod='casco'`,
-- apoi soft-delete pe un document CASCO deja existent → P0001 „Tipul de
-- document ales nu este disponibil sau a fost dezactivat.” Cauza e simetrică
-- cu F3: `internal.vdoc_inainte()` revalidează existenţa/starea `activ` a
-- tipului la FIECARE update al documentului, deşi `document_type_id` nu se
-- schimbă — deci un document vechi, valid la creare, devine imposibil de
-- atins (nici măcar de şters logic) din clipa în care cineva dezactivează
-- tipul lui, chiar dacă tipul rămâne valabil pentru documentele EXISTENTE.
--
-- REMEDIU: verificarea de existenţă+activ rulează doar la INSERT sau când
-- `document_type_id` chiar se schimbă. Restul funcţiei (apartenenţa
-- vehiculului, calcularea lui `este_curent`) e neschimbat.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function internal.vdoc_inainte()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  select v.organization_id into v_org from public.vehicles v
   where v.id = new.vehicle_id and v.deleted_at is null;
  if v_org is null or v_org <> new.organization_id then
    raise exception using errcode = 'P0001',
      message = 'Vehiculul selectat nu aparţine organizaţiei dumneavoastră.';
  end if;

  if (tg_op = 'INSERT' or new.document_type_id is distinct from old.document_type_id) then
    if not exists (
      select 1 from public.vehicle_document_types t
       where t.id = new.document_type_id and t.deleted_at is null and t.activ
         and (t.organization_id is null or t.organization_id = new.organization_id)
    ) then
      raise exception using errcode = 'P0001',
        message = 'Tipul de document ales nu este disponibil sau a fost dezactivat.';
    end if;
  end if;

  -- `este_curent` este calculat. În afara recalculării, valoarea trimisă de
  -- client se ignoră tăcut: nu e o tentativă de fraudă, e un câmp pe care
  -- interfaţa nu ar trebui să îl trimită.
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


-- ═════════════════════════════════════════════════════════════════════════════
-- F5. ŞTERGEREA LOGICĂ A DOCUMENTULUI CURENT LĂSA DOUĂ RÂNDURI CU
--     este_curent = true
--
-- Reprodus: RCA vechi (expiră 2026-01-01) + RCA nou (expiră 2026-12-01, deci
-- CURENT). Soft-delete pe cel nou → starea de după:
--   • 2026-01-01 (vechi):  este_curent = TRUE   (corect, a preluat ştafeta)
--   • 2026-12-01 (nou, şters logic): este_curent RĂMÂNE TRUE  (bug)
-- Deci DOUĂ rânduri este_curent=true pe acelaşi (vehicul, tip). Indexul unic
-- parţial `vdoc_curent_uq` nu prinde cazul fiindcă e filtrat pe
-- `deleted_at is null`, iar rândul-problemă tocmai a primit `deleted_at`.
--
-- Cauza: în `internal.flota_sincronizeaza_grup()`, UPDATE-ul care „stinge”
-- vechiul curent are `and d.deleted_at is null` în WHERE. Rândul tocmai şters
-- avea `este_curent=true` ÎNAINTE de ştergere; după ce capătă `deleted_at`,
-- acelaşi filtru care alegea corect NOUL curent (v_curent, calculat DOAR din
-- rânduri nešterse) exclude şi rândul şters din operaţia de resetare — deci
-- flag-ul lui vechi rămâne agăţat pe true.
--
-- REMEDIU: scot `and d.deleted_at is null` din UPDATE-ul de stingere. Rândul
-- v_curent (noul curent) e oricum calculat exclusiv din rânduri nešterse, deci
-- eliminarea filtrului de aici nu poate face un rând şters să devină curent —
-- doar permite ca UN rând şters, dacă mai poartă este_curent=true, să fie
-- resetat corect la false, exact cazul din reproducere.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function internal.flota_sincronizeaza_grup(
  p_organization_id uuid,
  p_vehicle_id uuid,
  p_document_type_id uuid
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_curent  public.vehicle_documents%rowtype;
  v_vehicul public.vehicles%rowtype;
  v_cod     text;
  v_denumire text;
begin
  select * into v_vehicul from public.vehicles v where v.id = p_vehicle_id;
  if not found then return; end if;

  select t.cod, t.denumire into v_cod, v_denumire
    from public.vehicle_document_types t where t.id = p_document_type_id;
  if v_cod is null then return; end if;

  -- Curent = expira_la MAXIM. Reînnoirea făcută cu trei săptămâni înainte devine
  -- imediat documentul curent, fără ca cineva să bifeze ceva manual.
  select * into v_curent
    from public.vehicle_documents d
   where d.organization_id = p_organization_id
     and d.vehicle_id = p_vehicle_id
     and d.document_type_id = p_document_type_id
     and d.deleted_at is null
   order by d.expira_la desc nulls last, d.valabil_de_la desc nulls last, d.created_at desc
   limit 1;

  -- Steagul opreşte recursia: UPDATE-urile de mai jos trec prin acelaşi trigger.
  perform pg_catalog.set_config('app.flota_recalcul', 'on', true);

  -- F5: FĂRĂ `d.deleted_at is null` aici. v_curent (mai sus) e deja calculat
  -- doar din rânduri nešterse, deci scoaterea filtrului nu poate promova un
  -- rând şters la este_curent=true — dar permite să RESETEZE la false un rând
  -- care tocmai a fost şters logic şi mai poartă din trecut este_curent=true.
  -- Fără asta, un document şters rămâne agăţat pe „curent” la nesfârşit.
  update public.vehicle_documents d
     set este_curent = false, updated_at = now()
   where d.organization_id = p_organization_id
     and d.vehicle_id = p_vehicle_id
     and d.document_type_id = p_document_type_id
     and d.este_curent
     and (v_curent.id is null or d.id <> v_curent.id);

  if v_curent.id is not null and not v_curent.este_curent then
    update public.vehicle_documents set este_curent = true, updated_at = now()
     where id = v_curent.id;
  end if;

  perform pg_catalog.set_config('app.flota_recalcul', 'off', true);

  -- Motorul din 0008. p_expires_at NULL (niciun document activ) => scadenţa
  -- dispare logic şi alertele deschise se închid — nu ştergem istoricul.
  -- La vânzare/casare rămâne, dar cu is_active = false.
  perform internal.sync_expirable(
    p_organization_id,
    'vehicle_document',
    p_vehicle_id,
    v_cod,
    coalesce(v_denumire, v_cod) || ' — ' || coalesce(v_vehicul.nr_inmatriculare, '?'),
    case when v_curent.id is null then null else v_curent.expira_la end,
    'vehicle_documents',
    v_vehicul.employee_id,
    (v_vehicul.deleted_at is null and v_vehicul.status in ('activ', 'in_service'))
  );
end;
$$;


-- ═════════════════════════════════════════════════════════════════════════════
-- F6. COLIZIUNE DE `kind` ÎNTRE UN TIP DE DOCUMENT DE PLATFORMĂ ŞI UNUL
--     PROPRIU CU ACELAŞI COD
--
-- Reprodus: tip propriu (organization_id = firma), cod „rca” — acelaşi cod cu
-- tipul de platformă seed-uit în 0012. Un document nou pe tipul PROPRIU, care
-- expiră 2026-03-01, produce:
--   • DOUĂ documente este_curent=true pe acelaşi vehicul (unul pe tipul de
--     platformă, unul pe tipul propriu) — indexul unic `vdoc_curent_uq` e pe
--     (organization_id, vehicle_id, DOCUMENT_TYPE_ID), deci nu vede coliziunea
--     de `cod`, doar de id de tip;
--   • UN SINGUR rând în `expirables` cu kind='rca' pentru vehicul — cele două
--     sincronizări (una per document_type_id) fac UPSERT pe aceeaşi cheie
--     (organization_id, entity_type='vehicle_document', entity_id=vehicul,
--     kind='rca') din 0008, iar cea de-a doua suprascrie prima. Poliţa de
--     PLATFORMĂ (adevărata RCA activă) dispare din dashboardul de conformitate,
--     înlocuită de proiecţia tipului propriu.
--
-- ALEGERE: interzic coliziunea, nu prefixez codurile proprii. Prefixarea
-- (ex. „org_rca”) ar schimba CHEIA scadenţelor deja sincronizate — orice
-- document propriu existent, cu `kind` deja scris în `expirables`, ar necesita
-- o migrare de date care să-i redenumească rândul din `expirables` (şi
-- eventual alertele deschise pe el), altfel doar cererile viitoare l-ar
-- respecta iar cele deja sincronizate ar rămâne orfane sub cheia veche. Un
-- refuz la creare nu are nevoie de nicio migrare de date: firma îşi alege un
-- cod propriu care nu se ciocneşte, o singură dată, la înfiinţarea tipului —
-- exact cum `vdt_org_cod_uq` deja o obligă să nu-l repete pe al SĂU. Aici o
-- obligăm să nu-l repete pe-al PLATFORMEI.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function internal.vdt_normalizeaza()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.cod := pg_catalog.regexp_replace(
               pg_catalog.regexp_replace(lower(btrim(coalesce(new.cod, ''))), '[^a-z0-9]+', '_', 'g'),
               '^_+|_+$', '', 'g');

  -- F6: un tip PROPRIU nu poate purta codul unui tip de PLATFORMĂ deja
  -- existent — `kind`-ul din expirables se deduce din `cod`, iar o coliziune
  -- face ca cele două tipuri să scrie peste aceeaşi scadenţă. Tipurile de
  -- platformă (organization_id null) nu se creează din aplicaţie (vezi
  -- `vdt_insert`), deci verificarea e cu sens unic: doar rândul propriu se
  -- aliniază la namespace-ul platformei, nu invers.
  if new.organization_id is not null and exists (
    select 1 from public.vehicle_document_types t
     where t.organization_id is null and t.deleted_at is null and t.cod = new.cod
  ) then
    raise exception using errcode = 'P0001',
      message = format('Codul „%s” este deja folosit de un tip de document de platformă. Alegeţi alt cod pentru tipul propriu organizaţiei dumneavoastră.', new.cod);
  end if;

  return new;
end;
$$;


-- ═════════════════════════════════════════════════════════════════════════════
-- F8. COLOANA GENERATĂ pret_litru PRODUCEA EROARE BRUTĂ ÎNAINTEA ORICĂREI
--     VALIDĂRI DE BUSINESS
--
-- Reprodus: `insert into fuel_entries (litri, cost) values (0, 100)` →
-- „ERROR: division by zero” (SQLSTATE 22012), în engleză, ridicată la
-- CALCULAREA coloanei generate — înaintea oricărei constrângeri CHECK şi
-- înaintea triggerului `alimentari_inainte`. `fuel_litri_ck` (litri > 0)
-- deja există, dar Postgres nu apucă să-l evalueze: rândul nu poate fi
-- construit fiindcă expresia generată eşuează prima.
--
-- REMEDIU, în DOUĂ straturi complementare:
--   1. Expresia generată devine `case when litri > 0 then round(cost/litri,4)
--      end` — nu mai poate arunca ea însăşi eroare, indiferent ce ajunge să
--      fie stocat vreodată în `litri`.
--   2. `internal.alimentari_inainte()` capătă o validare explicită, cu mesaj
--      P0001 în română, ÎNAINTEA oricărei alte verificări — astfel utilizatorul
--      vede mereu mesajul de business, nu eroarea brută de Postgres, indiferent
--      de ORDINEA reală de evaluare pe care o alege planorul.
--
-- O coloană GENERATED nu se poate altera cu `alter column ... set expression`
-- (nu există în Postgres) — schimbarea cere DROP + ADD. Verificat înainte:
-- niciun index, nicio vedere şi nicio altă coloană generată nu depinde de
-- `fuel_entries.pret_litru` (0012, secţ. 6 — doar `fuel_bon_uq`, `fuel_foaie_idx`,
-- `fuel_org_data_idx`, niciunul pe `pret_litru`), deci DROP/ADD e sigur.
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.fuel_entries drop column pret_litru;
alter table public.fuel_entries add column pret_litru numeric(12,4)
  generated always as (case when litri > 0 then round(cost / litri, 4) end) stored;

comment on column public.fuel_entries.pret_litru is
  'Preţ unitar DEDUS, niciodată introdus direct. NULL dacă litri <= 0 — caz pe care fuel_litri_ck şi internal.alimentari_inainte() îl resping oricum înainte să ajungă aici; expresia rămâne sigură indiferent de ordinea de evaluare (0018/F8).';

create or replace function internal.alimentari_inainte()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_foaie public.trip_sheets%rowtype;
begin
  -- F8: validare explicită, ÎNAINTEA oricărei alte verificări, ca mesajul de
  -- business (română, P0001) să apară mereu — indiferent dacă Postgres ar fi
  -- evaluat coloana generată sau CHECK-ul înaintea acestui trigger.
  if new.litri is null or new.litri <= 0 then
    raise exception using errcode = 'P0001',
      message = 'Cantitatea de combustibil alimentată trebuie să fie mai mare decât zero.';
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


-- ── Verificare finală, zgomotoasă la eşec ────────────────────────────────────
-- F2: cele patru politici de SELECT chiar au pierdut `deleted_at`; altfel
-- ştergerea logică rămâne blocată exact ca înainte de această migrare.
do $$
declare v_rele text;
begin
  select string_agg(polname, ', ' order by polname) into v_rele
    from pg_catalog.pg_policy p
    join pg_catalog.pg_class c on c.oid = p.polrelid
   where c.relname in ('vehicles', 'vehicle_documents', 'fuel_entries', 'odometer_anomalies')
     and p.polname in ('vehicule_select', 'vdoc_select', 'alimentari_select', 'anomalii_select')
     and pg_catalog.pg_get_expr(p.polqual, p.polrelid) like '%deleted_at IS NULL%';

  if v_rele is not null then
    raise exception 'F2 nu e reparat: % mai are deleted_at is null în USING — ştergerea logică rămâne blocată pentru orice rol.', v_rele;
  end if;
end
$$;
