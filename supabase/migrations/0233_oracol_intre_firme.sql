-- supabase/migrations/0233_oracol_intre_firme.sql
--
-- ORACOLUL DE EXISTENȚĂ ÎNTRE FIRME, PE FUNCȚIILE CARE SUNT DEJA PE PRODUCȚIE (Y2).
--
-- Trecerea sistematică (Y2) pe clasa din 0226 §1. Ce ține de migrările încă
-- neaplicate (0200–0216, 0225) s-a reparat pe loc, în ele; aici stă doar ce
-- atinge funcții din 0001–0198, forward-only. Fiecare funcție e rescrisă de la
-- FORMA ULTIMĂ (grep pe toate migrările, inclusiv 0199–0226); restul corpului e
-- neschimbat.
--
-- ── 1. PERECHILE DE MESAJE „NU EXISTĂ” / „APARȚINE ALTEI ORGANIZAȚII” ───────
-- Patru triggere răspundeau DIFERIT pentru un id inexistent și pentru id-ul
-- unui rând al ALTEI firme, pe un rând pus în firma proprie: orice membru afla,
-- id cu id, ce există în celelalte firme.
--   · `public.tg_departments_path` (0004): departamentul superior;
--   · `internal.leave_requests_pregateste` (0112): tipul de concediu;
--   · `internal.tickets_valideaza_inventarul` (0134): obiectul de inventar;
--   · `internal.inventory_items_lot_propriu` (0016): lotul de import.
-- Căutarea se face acum DOAR în firma rândului, cu un singur mesaj pentru
-- „nu există”, „e șters” și „e al altei firme”. Configurarea REGES (0087) NU
-- e în listă: `reges_read/write_credentiale` judecă apartenența la firmă
-- înaintea oricărei căutări, deci o firmă care există și una inventată primesc
-- deja același P0001 (proba, verificările c1/c2).
--
-- ── 2. GARDA DE FIRMĂ, PRIMA ────────────────────────────────────────────────
-- Un trigger BEFORE ROW rulează ÎNAINTEA politicii de scriere (WITH CHECK se
-- judecă pe rândul de după triggere). Căutarea în firma RÂNDULUI nu ajunge: un
-- rând pus pe firma B găsea id-ul care există acolo, trecea și cădea abia la
-- WITH CHECK (42501), iar id-ul inexistent primea P0001. Garda de firmă vine
-- deci prima, cu 42501 neutru, ocolită doar în contextul de serviciu (sau și
-- pentru administratorul de platformă, acolo unde politica lui îl lasă: tichetele).
-- Pe lângă cele patru de la §1:
--   · `internal.departament_sef_in_firma` (0152): șeful departamentului;
--   · `internal.alocari_inainte` (0173): primul BEFORE pe `vehicle_assignments`,
--     înaintea lui `alocari_rezervari` (0216), care dădea ziua rezervării;
--   · `internal.fault_reports_garda` (0181): primul BEFORE pe `fault_reports`,
--     înaintea lui `fault_reports_tehnician_cu_drept` (0212).
-- Pe `departments`, garda se aplică doar când rândul caută ceva (superior,
-- șef): firma nouă își primește departamentul „Conducere” (0107) dintr-un
-- trigger pe `organizations`, înainte ca apelantul să-i fie membru, iar un nod
-- rădăcină fără șef nu caută nimic, deci n-are ce spune.
--
-- Mesajele 42501 nu se propagă în aplicație (`mapPostgrestError` le dă textul
-- fix „Nu aveți dreptul…”); P0001-urile noi sunt propagate ca atare de
-- `traduEroare` din concedii, inventar și ticketing, fără tipare pe text.
--
-- Probă: tests/rls/proba-oracol-intre-firme.sql (g12, g18, g21–g25, h1–h4).
-- Aplicare: psql byte-exact, după bancul local; producția cere confirmare.

begin;

-- ============================================================
-- 1. Departamentul superior (forma ultimă 0004)
-- ============================================================
create or replace function public.tg_departments_path()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_path uuid[];
begin
  -- 0233: garda de firmă, înaintea căutării superiorului (vezi antetul).
  if new.parent_id is not null
     and not app.is_service_context()
     and not (new.organization_id = any ((select app.current_org_ids())::uuid[])) then
    raise exception using errcode = '42501',
      message = 'Nu aveți dreptul de a scrie departamente în această organizație.';
  end if;

  if new.parent_id is null then
    new.path := array[new.id];
    new.depth := 0;
  else
    -- 0233: superiorul se caută doar în firma rândului; unul inexistent, unul
    -- șters și unul din altă firmă primesc același răspuns.
    select d.path into v_parent_path
    from public.departments d
    where d.id = new.parent_id
      and d.deleted_at is null
      and d.organization_id = new.organization_id;

    if v_parent_path is null then
      raise exception 'Departamentul superior nu există în organizația dumneavoastră sau a fost șters.' using errcode = 'P0001';
    end if;
    if new.id = any (v_parent_path) then
      raise exception 'Structura ar deveni circulară: departamentul „%" nu poate fi subordonat propriului subarbore.', new.denumire using errcode = 'P0001';
    end if;
    new.path := v_parent_path || new.id;
    new.depth := array_length(v_parent_path, 1);
  end if;

  if array_length(new.path, 1) > 12 then
    raise exception 'Structura organizatorică depășește 12 niveluri.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.tg_departments_path() from public, anon, authenticated;

-- ============================================================
-- 2. Șeful departamentului (forma ultimă 0152)
-- ============================================================
create or replace function internal.departament_sef_in_firma()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 0233: garda de firmă, înaintea căutării șefului (vezi antetul).
  if new.manager_employee_id is not null
     and not app.is_service_context()
     and not (new.organization_id = any ((select app.current_org_ids())::uuid[])) then
    raise exception using errcode = '42501',
      message = 'Nu aveți dreptul de a scrie departamente în această organizație.';
  end if;

  if new.manager_employee_id is not null
     and not exists (
       select 1 from public.employees e
        where e.id = new.manager_employee_id and e.organization_id = new.organization_id
     ) then
    raise exception 'Șeful ales nu există în organizația dumneavoastră.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function internal.departament_sef_in_firma() from public, anon, authenticated;

-- ============================================================
-- 3. Tipul de concediu (forma ultimă 0112)
-- ============================================================
create or replace function internal.leave_requests_pregateste()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_tip public.leave_types%rowtype; v_org uuid;
begin
  -- 0233: garda de firmă, prima. Fără ea, pe o cerere pusă pe firma B, tipul
  -- de concediu care există acolo trecea (apoi calendarul sau politica
  -- refuzau), iar cel inexistent primea „nu există”.
  if not app.is_service_context()
     and not (new.organization_id = any ((select app.current_org_ids())::uuid[])) then
    raise exception using errcode = '42501',
      message = 'Nu aveți dreptul de a scrie cereri de concediu în această organizație.';
  end if;

  -- 0233: tipul se caută doar în firma cererii; unul inexistent, unul
  -- dezactivat și unul din altă firmă primesc același răspuns.
  select * into v_tip from public.leave_types
   where id = new.leave_type_id and deleted_at is null and organization_id = new.organization_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'Tipul de concediu selectat nu există sau a fost dezactivat.';
  end if;
  select organization_id into v_org from public.employees where id = new.employee_id and deleted_at is null;
  if v_org is null or v_org <> new.organization_id then
    raise exception using errcode = 'P0001', message = 'Angajatul selectat nu aparține organizației curente.';
  end if;

  -- Cele trei chei sunt aceleași, în aceeași ordine, ca
  -- `TIPURI_CU_ORIGINAL_FIZIC` din `src/domain/leave/documente-fizice.ts`.
  -- Actul lor se predă pe hârtie, deci trimiterea nu mai așteaptă un fișier;
  -- încărcarea rămâne posibilă din interfață, ca ajutor, dar e opțională.
  if v_tip.necesita_document and new.status = 'trimisa'
     and v_tip.key not in ('medical', 'maternitate', 'donator_sange')
     and coalesce(btrim(new.atasament_path), '') = '' and new.medical_code_id is null then
    raise exception using errcode = 'P0001',
      message = 'Acest tip de concediu necesită un document justificativ atașat înainte de trimitere.';
  end if;

  if new.data_inceput < (current_date - interval '2 years')::date then
    raise exception using errcode = 'P0001',
      message = 'Perioada solicitată este mai veche de doi ani. Corectați datele cererii.';
  end if;

  new.intrerupe_alte_concedii := v_tip.intrerupe_alte_concedii;
  new.zile_calendaristice := (new.data_sfarsit - new.data_inceput) + 1;
  new.zile_lucratoare := app.numara_zile_lucratoare(
    new.organization_id, new.data_inceput, new.data_sfarsit);

  if new.status = 'trimisa' and (tg_op = 'INSERT' or old.status <> 'trimisa') then
    new.trimisa_la := now();
  end if;
  if new.status in ('aprobata', 'respinsa') and (tg_op = 'INSERT' or old.status <> new.status) then
    new.decis_la := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function internal.leave_requests_pregateste() from public;
grant execute on function internal.leave_requests_pregateste() to authenticated, service_role;

-- ============================================================
-- 4. Obiectul de inventar al tichetului (forma ultimă 0134)
-- ============================================================
create or replace function internal.tickets_valideaza_inventarul()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alocat boolean;
  v_org_obiect uuid;
begin
  -- 0233: garda de firmă, prima. Aceeași condiție ca factorul de firmă al
  -- politicilor de tichete: membru al firmei sau administrator de platformă
  -- (`tickets_update` îl lasă pe acesta din urmă).
  if not (app.is_service_context()
          or app.is_platform_admin()
          or new.organization_id = any ((select app.current_org_ids())::uuid[])) then
    raise exception using errcode = '42501',
      message = 'Nu aveți dreptul de a scrie tichete în această organizație.';
  end if;

  if new.inventory_item_id is null then
    return new;
  end if;

  -- Fără `deleted_at`: coloana nu există pe `inventory_items`, iar prezența ei
  -- aici rupea validarea cu 42703. Existența rândului e tot ce se verifică.
  -- 0233: obiectul se caută doar în firma tichetului; unul inexistent și unul
  -- din altă firmă primesc același răspuns.
  select i.organization_id into v_org_obiect
  from public.inventory_items i
  where i.id = new.inventory_item_id
    and i.organization_id = new.organization_id;

  if v_org_obiect is null then
    raise exception using errcode = 'P0001',
      message = 'Obiectul de inventar selectat nu există în organizația dumneavoastră.';
  end if;

  -- Alocare curentă = predată și nereturnată. Aici `deleted_at` E corect:
  -- `inventory_allocations` are coloana.
  select exists (
    select 1
    from public.inventory_allocations a
    where a.item_id = new.inventory_item_id
      and a.employee_id = new.solicitant_employee_id
      and a.returnat_la is null
      and a.deleted_at is null
  ) into v_alocat;

  if not v_alocat then
    raise exception using errcode = 'P0001',
      message = 'Obiectul de inventar nu este alocat solicitantului. Alegeți unul dintre obiectele primite.';
  end if;

  return new;
end;
$$;

revoke all on function internal.tickets_valideaza_inventarul() from public, anon, authenticated;

-- ============================================================
-- 5. Lotul de import al obiectului de inventar (forma ultimă 0016)
-- ============================================================
create or replace function internal.inventory_items_lot_propriu()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lot_org uuid;
begin
  -- 0233: garda de firmă, prima (vezi antetul).
  if not app.is_service_context()
     and not (new.organization_id = any ((select app.current_org_ids())::uuid[])) then
    raise exception using errcode = '42501',
      message = 'Nu aveți dreptul de a scrie obiecte de inventar în această organizație.';
  end if;

  if new.import_batch_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.import_batch_id is not distinct from old.import_batch_id then
    return new;
  end if;

  -- 0233: lotul se caută doar în firma obiectului; unul inexistent și unul din
  -- altă firmă primesc același răspuns.
  select b.organization_id into v_lot_org
    from public.inventory_import_batches b
   where b.id = new.import_batch_id
     and b.organization_id = new.organization_id;

  if v_lot_org is null then
    raise exception using errcode = 'P0001',
      message = 'Lotul de import indicat nu există în organizația dumneavoastră.';
  end if;

  return new;
end;
$$;

revoke all on function internal.inventory_items_lot_propriu() from public, anon, authenticated;

-- ============================================================
-- 6. Alocarea vehiculului (forma ultimă 0173)
-- ============================================================
create or replace function internal.alocari_inainte()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_vehicul public.vehicles%rowtype;
begin
  -- 0233: garda de firmă, prima. Pe o alocare pusă pe firma B, vehiculul și
  -- angajatul de acolo treceau (apoi `alocari_rezervari` dădea ziua primei
  -- rezervări a vehiculului), iar cele inexistente primeau P0001.
  if not app.is_service_context()
     and not (new.organization_id = any ((select app.current_org_ids())::uuid[])) then
    raise exception using errcode = '42501',
      message = 'Nu aveți dreptul de a aloca vehicule în această organizație.';
  end if;

  if tg_op = 'UPDATE' then
    -- Cine, ce mașină și de când sunt faptul alocării. O greșeală aici se
    -- repară ștergând rândul și refăcându-l, nu rescriindu-l.
    if (new.organization_id, new.vehicle_id, new.employee_id, new.de_la)
       is distinct from (old.organization_id, old.vehicle_id, old.employee_id, old.de_la) then
      raise exception using errcode = 'P0001',
        message = 'Șoferul, vehiculul și începutul alocării nu se mai pot schimba. Ștergeți alocarea greșită și refaceți-o.';
    end if;
    if old.pana_la is not null and new.pana_la is distinct from old.pana_la and new.deleted_at is null then
      raise exception using errcode = 'P0001',
        message = 'Alocarea este deja încheiată. Sfârșitul ei nu se mai poate muta.';
    end if;
    if new.pana_la is not null and old.pana_la is null and new.pana_la > now() + interval '5 minutes' then
      raise exception using errcode = 'P0001',
        message = 'Alocarea se încheie cel târziu acum. O predare viitoare se înregistrează când are loc.';
    end if;
    return new;
  end if;

  select * into v_vehicul from public.vehicles v
   where v.id = new.vehicle_id and v.deleted_at is null;
  if not found or v_vehicul.organization_id <> new.organization_id then
    raise exception using errcode = 'P0001',
      message = 'Vehiculul ales nu aparține organizației dumneavoastră.';
  end if;
  if v_vehicul.status in ('vandut', 'casat') then
    raise exception using errcode = 'P0001',
      message = 'Vehiculul este ieșit din parc (vândut sau casat). Nu se mai poate aloca.';
  end if;
  if not exists (
    select 1 from public.employees e
     where e.id = new.employee_id and e.organization_id = new.organization_id and e.deleted_at is null
  ) then
    raise exception using errcode = 'P0001',
      message = 'Angajatul ales nu aparține organizației dumneavoastră.';
  end if;
  if new.de_la > now() + interval '5 minutes' then
    raise exception using errcode = 'P0001',
      message = 'Alocarea începe cel târziu acum. O predare viitoare se înregistrează când are loc.';
  end if;
  if new.pana_la is not null and new.pana_la > now() + interval '5 minutes' then
    raise exception using errcode = 'P0001',
      message = 'Alocarea se încheie cel târziu acum. O predare viitoare se înregistrează când are loc.';
  end if;

  -- Regula 2: predarea către alt om închide alocarea deschisă. Doar dacă
  -- noua alocare e ea însăși deschisă și începe după cea veche; altfel e o
  -- înregistrare retroactivă, iar EXCLUDE-ul hotărăște dacă încape.
  if new.pana_la is null then
    update public.vehicle_assignments a
       set pana_la = new.de_la,
           km_restituire = coalesce(a.km_restituire, new.km_predare),
           updated_at = now(),
           updated_by = new.created_by
     where a.vehicle_id = new.vehicle_id
       and a.pana_la is null
       and a.deleted_at is null
       and a.de_la < new.de_la;
  end if;
  return new;
end;
$$;

revoke all on function internal.alocari_inainte() from public, anon, authenticated;

-- ============================================================
-- 7. Garda sesizărilor (forma ultimă 0181)
-- ============================================================
-- Înlocuiește `ssm_fault_guard` (0011:753). Tranzițiile se validează pentru
-- ORICINE; cine poate schimba CE se verifică doar în afara contextului de
-- serviciu (jobul de închidere automată, clientul admin al acțiunilor).
create or replace function internal.fault_reports_garda()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_serviciu   boolean := app.is_service_context();
  v_gestionar  boolean := false;
  v_eu         uuid;
  v_raportor   boolean := false;
  v_tehnician  boolean := false;
  v_schimbate  text[];
  v_permise    text[];
  v_strain     text;
  v_permis     boolean;
begin
  -- 0233: garda de firmă, prima. Referințele de mai jos se caută în firma
  -- RÂNDULUI, înaintea WITH CHECK: pe o sesizare pusă pe firma B, echipamentul
  -- și tehnicianul de acolo treceau (apoi „Doar responsabilii…” sau 42501), iar
  -- cele inexistente primeau „nu aparține organizației”. Factorul de firmă al
  -- lui `fault_reports_insert`/`_update` (WITH CHECK), deci nu oprește pe nimeni
  -- pe care politica l-ar lăsa.
  if not v_serviciu
     and not (new.organization_id = any ((select app.current_org_ids())::uuid[])) then
    raise exception using errcode = '42501',
      message = 'Nu aveți dreptul de a scrie sesizări în această organizație.';
  end if;

  -- ── Referințele rămân în FIRMĂ (INSERT și UPDATE) ───────────────────────
  -- Cheile străine simple (`references employees (id)`) nu știu de organizație:
  -- fără verificările astea, un client ar putea atribui sesizarea fișei unui
  -- angajat din altă firmă (și i-ar trimite notificarea), ar lega-o de utilajul
  -- altei firme sau ar marca-o duplicat al unei sesizări străine.
  if (tg_op = 'INSERT' or new.equipment_id is distinct from old.equipment_id)
     and not exists (select 1 from public.equipment q
                      where q.id = new.equipment_id and q.organization_id = new.organization_id) then
    raise exception using errcode = 'P0001', message = 'Echipamentul nu aparține organizației.';
  end if;
  if new.raportat_de_employee_id is not null
     and (tg_op = 'INSERT' or new.raportat_de_employee_id is distinct from old.raportat_de_employee_id)
     and not exists (select 1 from public.employees e
                      where e.id = new.raportat_de_employee_id and e.organization_id = new.organization_id) then
    raise exception using errcode = 'P0001', message = 'Raportorul nu aparține organizației.';
  end if;
  if new.atribuit_employee_id is not null
     and (tg_op = 'INSERT' or new.atribuit_employee_id is distinct from old.atribuit_employee_id)
     and not exists (select 1 from public.employees e
                      where e.id = new.atribuit_employee_id
                        and e.organization_id = new.organization_id
                        and e.deleted_at is null) then
    raise exception using errcode = 'P0001',
      message = 'Tehnicianul ales nu aparține organizației sau nu mai are fișă activă.';
  end if;
  if new.duplicat_al_id is not null
     and (tg_op = 'INSERT' or new.duplicat_al_id is distinct from old.duplicat_al_id)
     and not exists (select 1 from public.fault_reports d
                      where d.id = new.duplicat_al_id
                        and d.organization_id = new.organization_id
                        and d.id <> new.id) then
    raise exception using errcode = 'P0001',
      message = 'Sesizarea originală nu aparține organizației.';
  end if;

  -- ── INSERT: o sesizare se naște „nou", fără atribuire și fără rezolvare ──
  if tg_op = 'INSERT' then
    if not v_serviciu then
      if new.status <> 'nou' then
        raise exception using errcode = 'P0001',
          message = 'O sesizare nouă pornește întotdeauna din starea „nouă”.';
      end if;
      if new.intervention_id is not null or new.rezolvat_la is not null or new.inchis_la is not null then
        raise exception using errcode = 'P0001',
          message = 'O sesizare nouă nu poate fi deja rezolvată sau închisă.';
      end if;
      if new.atribuit_employee_id is not null
         and not app.ssm_acces(new.organization_id, 'maintenance', 'update', null) then
        raise exception using errcode = 'P0001',
          message = 'Doar responsabilii de mentenanță pot atribui o sesizare.';
      end if;
      -- Coloanele „de sistem” nu se primesc de la client: momentul raportării e
      -- acum, contul raportorului e cel autentificat, contorul de redeschideri
      -- pornește de la zero. Numărul îl pune triggerul de numerotare.
      new.raportat_la := now();
      new.raportat_de_user_id := auth.uid();
      new.redeschisa_de_ori := 0;
      new.motiv_redeschidere := null;
      -- Câmpurile altor etape ale fluxului nu se completează la naștere.
      new.nota_rezolvare := null;
      new.motiv_respingere := null;
      new.motiv_respingere_tip := null;
      new.duplicat_al_id := null;
      new.atribuit_la := null;
    end if;
    if new.atribuit_employee_id is not null and new.atribuit_la is null then
      new.atribuit_la := now();
    end if;
    return new;
  end if;

  -- ── UPDATE ──────────────────────────────────────────────────────────────
  -- Ștergerea logică trece prin politica de UPDATE, care acum deschide ușa și
  -- raportorului și tehnicianului. Ei NU șterg: raportorul își RETRAGE
  -- sesizarea (rămâne în evidență), tehnicianul n-are ce căuta aici. Fără
  -- verificarea asta, ramura ar fi fost o poartă deschisă („fail-open").
  if new.deleted_at is not null and old.deleted_at is null then
    if not (v_serviciu or app.is_platform_admin()
            or app.ssm_acces(new.organization_id, 'maintenance', 'update', null)) then
      raise exception using errcode = 'P0001',
        message = 'Nu aveți dreptul de a șterge această sesizare.';
    end if;
    return new;
  end if;

  -- 0. Cine apasă. Actorii NOMINALI (raportor, tehnician) nu primesc coloanele
  --    scrise de triggere: se fixează la valoarea veche și le recalculează
  --    tranziția de mai jos. Fără asta, cineva ar fi putut trimite
  --    `rezolvat_la` din 2019 sau `redeschisa_de_ori = 0`, iar lista de
  --    excepții de la pasul 2 le-ar fi lăsat să treacă.
  if not v_serviciu then
    v_gestionar := app.is_platform_admin()
                   or app.ssm_acces(new.organization_id, 'maintenance', 'update', null);
    if not v_gestionar then
      new.rezolvat_la          := old.rezolvat_la;
      new.inchis_la            := old.inchis_la;
      new.atribuit_la          := old.atribuit_la;
      new.redeschisa_de_ori    := old.redeschisa_de_ori;
      new.motiv_respingere_tip := old.motiv_respingere_tip;
      new.raportat_de_user_id  := old.raportat_de_user_id;
      new.raportat_la          := old.raportat_la;
      new.numar                := old.numar;
    end if;
  end if;

  -- 0b. Intervenția trebuie să fie A ACESTEI sesizări: aceeași firmă, același
  --     echipament, legată de ea (sau nelegată încă — rândurile dinainte de
  --     0181). Se verifică ORICÂND se schimbă și, din nou, la intrarea în
  --     „rezolvat” — altfel s-ar putea agăța mai devreme, pe altă tranziție,
  --     și ar trece neverificată la rezolvare.
  if new.intervention_id is not null
     and (new.intervention_id is distinct from old.intervention_id
          or (new.status = 'rezolvat' and old.status is distinct from 'rezolvat'))
     and not exists (
       select 1 from public.maintenance_interventions mi
        where mi.id = new.intervention_id
          and mi.organization_id = new.organization_id
          and mi.equipment_id = new.equipment_id
          and mi.deleted_at is null
          and (mi.fault_report_id is null or mi.fault_report_id = new.id)) then
    raise exception using errcode = 'P0001',
      message = 'Intervenția aleasă nu aparține acestei sesizări.';
  end if;

  -- 1. Tranziția de stare, pentru toată lumea.
  if new.status is distinct from old.status then
    v_permis := case old.status
      when 'nou'          then new.status in ('in_analiza', 'in_lucru', 'respins', 'retrasa')
      when 'in_analiza'   then new.status in ('in_lucru', 'in_asteptare', 'respins', 'retrasa')
      when 'in_lucru'     then new.status in ('rezolvat', 'in_asteptare', 'in_analiza')
      when 'in_asteptare' then new.status in ('in_lucru', 'respins')
      when 'rezolvat'     then new.status in ('inchis', 'in_lucru')
      else false
    end;
    if not v_permis then
      raise exception using errcode = 'P0001',
        message = format('Sesizarea nu poate trece din „%s” în „%s”.', old.status, new.status);
    end if;

    if new.status = 'in_lucru' and new.atribuit_employee_id is null then
      raise exception using errcode = 'P0001',
        message = 'Atribuiți sesizarea unui tehnician înainte de a o trece în lucru.';
    end if;
    if new.status = 'rezolvat' and new.intervention_id is null then
      raise exception using errcode = 'P0001',
        message = 'O sesizare nu poate fi marcată rezolvată fără intervenția de mentenanță care a rezolvat-o.';
    end if;
    if new.status = 'respins' then
      if coalesce(length(btrim(new.motiv_respingere)), 0) < 5 then
        raise exception using errcode = 'P0001', message = 'Respingerea unei sesizări cere un motiv scris.';
      end if;
      new.motiv_respingere_tip := coalesce(new.motiv_respingere_tip, 'altul');
      if new.motiv_respingere_tip = 'duplicat' and new.duplicat_al_id is null then
        raise exception using errcode = 'P0001',
          message = 'Respingerea ca duplicat cere sesizarea originală.';
      end if;
    end if;
    if old.status = 'rezolvat' and new.status = 'in_lucru' then
      -- Motiv NOU, nu cel rămas pe rând de la redeschiderea anterioară.
      if coalesce(length(btrim(new.motiv_redeschidere)), 0) < 5
         or new.motiv_redeschidere is not distinct from old.motiv_redeschidere then
        raise exception using errcode = 'P0001',
          message = 'Redeschiderea unei sesizări rezolvate cere un motiv scris.';
      end if;
      new.intervention_id := null;
      new.rezolvat_la := null;
      new.redeschisa_de_ori := old.redeschisa_de_ori + 1;
    end if;
    if new.status = 'rezolvat' and new.rezolvat_la is null then new.rezolvat_la := now(); end if;
    if new.status = 'inchis' and new.inchis_la is null then new.inchis_la := now(); end if;
  end if;

  if new.atribuit_employee_id is distinct from old.atribuit_employee_id then
    new.atribuit_la := case when new.atribuit_employee_id is null then null else now() end;
  end if;

  -- 2. Drepturile nominale, doar pentru oameni (`v_gestionar` e calculat la 0).
  if not v_serviciu then
    if not v_gestionar then
      v_eu := app.fisa_mea(new.organization_id);
      v_raportor := v_eu is not null and v_eu = old.raportat_de_employee_id;
      v_tehnician := v_eu is not null and v_eu = old.atribuit_employee_id;

      -- Ce s-a schimbat, fără coloanele scrise de triggere.
      select coalesce(array_agg(n.key), '{}') into v_schimbate
        from jsonb_each(to_jsonb(new)) n
       where n.key not in ('updated_at', 'updated_by', 'rezolvat_la', 'inchis_la', 'atribuit_la',
                           'redeschisa_de_ori', 'motiv_respingere_tip')
         and n.value is distinct from (to_jsonb(old) -> n.key);

      v_permise := '{}';
      if v_raportor then
        -- Raportorul își completează sesizarea cât e „nouă", o retrage, confirmă
        -- ori contestă rezolvarea.
        if old.status = 'nou' then v_permise := v_permise || array['descriere', 'urgenta']; end if;
        if (old.status in ('nou', 'in_analiza') and new.status = 'retrasa')
           or (old.status = 'rezolvat' and new.status in ('inchis', 'in_lucru')) then
          v_permise := v_permise || array['status', 'motiv_redeschidere'];
        end if;
        -- La redeschidere, garda însăși golește `intervention_id` (pasul 1);
        -- fără excepția asta, propria scriere a gărzii ar fi „câmp străin”.
        if old.status = 'rezolvat' and new.status = 'in_lucru' then
          v_permise := v_permise || array['intervention_id'];
        end if;
      end if;
      if v_tehnician then
        -- Tehnicianul lucrează sesizarea LUI: o începe (din nouă sau din analiză,
        -- odată ce i-a fost atribuită), o pune în așteptare și o reia, o rezolvă.
        if (old.status in ('nou', 'in_analiza', 'in_asteptare') and new.status = 'in_lucru')
           or (old.status = 'in_lucru' and new.status in ('in_asteptare', 'rezolvat')) then
          v_permise := v_permise || array['status', 'nota_rezolvare'];
        end if;
        -- Intervenția se leagă DOAR la rezolvare, nu se agață dinainte.
        if old.status = 'in_lucru' and new.status = 'rezolvat' then
          v_permise := v_permise || array['intervention_id'];
        end if;
        if new.status is not distinct from old.status and old.status in ('in_lucru', 'in_asteptare') then
          v_permise := v_permise || array['nota_rezolvare'];
        end if;
      end if;

      select min(c) into v_strain from unnest(v_schimbate) c where not (c = any (v_permise));
      if v_strain is not null then
        if not (v_raportor or v_tehnician) then
          raise exception using errcode = 'P0001',
            message = 'Nu aveți dreptul de a modifica această sesizare.';
        end if;
        raise exception using errcode = 'P0001',
          message = format('Nu aveți dreptul de a modifica acest câmp al sesizării (%s).', v_strain);
      end if;
    end if;
  end if;

  -- 3. Istoricul afișat pe sesizare.
  if new.status is distinct from old.status then
    insert into public.fault_report_history (organization_id, fault_report_id, actor_user_id, camp, valoare_veche, valoare_noua, motiv)
    values (new.organization_id, new.id, auth.uid(), 'status', old.status::text, new.status::text,
            case
              when new.status = 'respins' then new.motiv_respingere
              when old.status = 'rezolvat' and new.status = 'in_lucru' then new.motiv_redeschidere
              when new.status = 'inchis' and v_serviciu then 'Închisă automat, fără obiecții din partea raportorului.'
              else null
            end);
  end if;
  if new.atribuit_employee_id is distinct from old.atribuit_employee_id then
    insert into public.fault_report_history (organization_id, fault_report_id, actor_user_id, camp, valoare_veche, valoare_noua)
    values (new.organization_id, new.id, auth.uid(), 'atribuit_employee_id',
            old.atribuit_employee_id::text, new.atribuit_employee_id::text);
  end if;
  if new.urgenta is distinct from old.urgenta then
    insert into public.fault_report_history (organization_id, fault_report_id, actor_user_id, camp, valoare_veche, valoare_noua)
    values (new.organization_id, new.id, auth.uid(), 'urgenta', old.urgenta::text, new.urgenta::text);
  end if;
  if new.equipment_id is distinct from old.equipment_id then
    insert into public.fault_report_history (organization_id, fault_report_id, actor_user_id, camp, valoare_veche, valoare_noua)
    values (new.organization_id, new.id, auth.uid(), 'equipment_id', old.equipment_id::text, new.equipment_id::text);
  end if;
  if new.duplicat_al_id is distinct from old.duplicat_al_id and new.duplicat_al_id is not null then
    insert into public.fault_report_history (organization_id, fault_report_id, actor_user_id, camp, valoare_veche, valoare_noua)
    values (new.organization_id, new.id, auth.uid(), 'duplicat_al_id', null, new.duplicat_al_id::text);
  end if;

  return new;
end;
$$;

revoke all on function internal.fault_reports_garda() from public, anon, authenticated;

-- ============================================================
-- 8. Verificare
-- ============================================================
do $$
declare
  v_lipsa text[] := '{}';
  v_f     text;
  v_def   text;
begin
  -- Nicio funcție rescrisă nu mai deosebește „altă firmă” de „nu există”.
  foreach v_f in array array['public.tg_departments_path()',
                             'internal.departament_sef_in_firma()',
                             'internal.leave_requests_pregateste()',
                             'internal.tickets_valideaza_inventarul()',
                             'internal.inventory_items_lot_propriu()'] loop
    if pg_catalog.pg_get_functiondef(v_f::regprocedure) like '%aparține altei organizații%' then
      v_lipsa := v_lipsa || ('perechea de mesaje încă deschisă în ' || v_f);
    end if;
  end loop;

  -- Garda de firmă vine înaintea primei căutări, în toate șapte.
  foreach v_f in array array['public.tg_departments_path()',
                             'internal.departament_sef_in_firma()',
                             'internal.leave_requests_pregateste()',
                             'internal.tickets_valideaza_inventarul()',
                             'internal.inventory_items_lot_propriu()',
                             'internal.alocari_inainte()',
                             'internal.fault_reports_garda()'] loop
    v_def := pg_catalog.pg_get_functiondef(v_f::regprocedure);
    if pg_catalog.strpos(v_def, 'current_org_ids') = 0
       or pg_catalog.strpos(v_def, 'current_org_ids') > pg_catalog.strpos(v_def, 'from public.') then
      v_lipsa := v_lipsa || ('garda de firmă înaintea căutării în ' || v_f);
    end if;
  end loop;

  -- Ordinea triggerelor e alfabetică: garda stă în PRIMUL BEFORE care caută.
  if (select t.tgname from pg_catalog.pg_trigger t
        join pg_catalog.pg_proc p on p.oid = t.tgfoid
       where t.tgrelid = 'public.fault_reports'::regclass and not t.tgisinternal
         and t.tgtype & 2 = 2 and p.proname <> 'set_actor'
       order by t.tgname limit 1) <> 'fault_reports_garda' then
    v_lipsa := v_lipsa || 'fault_reports_garda nu mai e primul BEFORE pe fault_reports'::text;
  end if;
  if (select t.tgname from pg_catalog.pg_trigger t
       where t.tgrelid = 'public.vehicle_assignments'::regclass and not t.tgisinternal
         and t.tgtype & 2 = 2
       order by t.tgname limit 1) <> 'alocari_inainte' then
    v_lipsa := v_lipsa || 'alocari_inainte nu mai e primul BEFORE pe vehicle_assignments'::text;
  end if;

  if array_length(v_lipsa, 1) is not null then
    raise exception '0233: lipsesc %', array_to_string(v_lipsa, ', ');
  end if;
end $$;

commit;
