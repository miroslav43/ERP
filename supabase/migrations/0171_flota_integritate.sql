-- supabase/migrations/0171_flota_integritate.sql
--
-- FLOTA: CINCI DEFECTE DE INTEGRITATE, ÎNCHISE ÎNAINTE DE A LĂRGI DREPTURILE.
--
-- Prima fază din planul „Flotă completă” (7 oct 2026). Fazele următoare dau
-- drepturi pe flotă lui `employee` și lui `manager`. Defectele de mai jos sunt
-- inofensive azi, cât timp doar `org_admin` (read = update = create = all)
-- folosește modulul. Devin găuri reale din clipa în care un rol primește
-- scope-uri DIFERITE pe read și pe write — exact clasa închisă de 0016 la
-- `foi_update` și de 0154 la deplasări.
--
-- ── A. ALIMENTĂRILE SE SCRIAU PE DREPTUL DE CITIRE ──────────────────────────
-- `alimentari_insert`/`_update` (0012:1006-1031) aveau ca filtru de rând
-- `app.poate_vedea_foaie()`, care comută pe `trip_sheets:read`. Pragul de
-- scriere (`app.can` pe „cel puțin own”) răspunde doar la „are dreptul să
-- scrie undeva?”. Un rol cu read = all și update = own putea adăuga alimentări pe
-- foaia ORICUI. Trec pe `app.poate_scrie_foaie()` (0016), geamăna pe `update`.
--
-- ── B. FOAIA SE CREA PE DREPTUL DE CITIRE ───────────────────────────────────
-- Același tipar, la `foi_insert` (0012:953-967): read = team și create = own
-- ar fi lăsat un manager să întocmească foi în numele subordonaților.
-- `app.poate_crea_foaie()` e nouă și comută pe `trip_sheets:create`.
--
-- ── C. DEPARTAMENTUL VEHICULULUI NU ERA VERIFICAT ───────────────────────────
-- `internal.vehicles_normalizeaza()` (forma ultimă: 0018 §F3) verifica firma
-- șoferului, dar nu și a departamentului. Corpul de mai jos e o COPIE a celui
-- din 0018. Singurul adaos e blocul `department_id`, cu aceeași condiție
-- „doar la INSERT sau când chiar se schimbă” (motivul e în 0018 §F3).
--
-- ── D. O ANOMALIE CONFIRMATĂ SE PUTEA RESCRIE ───────────────────────────────
-- `internal.anomalii_protejeaza()` punea `confirmat_de` doar la prima
-- confirmare, dar lăsa `confirmat_la`, `nota` și chiar `confirmat_de`
-- modificabile după aceea. Garda stătea doar în acțiune
-- (`.is("confirmat_la", null)`). Orice alt client trecea. Acum o refuză baza.
-- În plus, `confirmat_de` nu mai poate fi pus din payload pe o anomalie
-- neconfirmată.
--
-- ── E. SEDILĂ ÎN NOMENCLATOR ────────────────────────────────────────────────
-- Două denumiri de platformă din seed-ul 0012 („Inspecţie”, „Licenţă”) au
-- ţ cu sedilă. Le rescriu cu virgula dedesubt. MESAJELE P0001 vechi NU se
-- ating: `src/app/(app)/flota/erori.ts` le potrivește tocmai pe forma lor cu
-- sedilă (vezi `erori.test.ts`).
--
-- ── CE NU E AICI ────────────────────────────────────────────────────────────
-- Kilometrajul vehiculului nou. Triggerul de după foaie (0012:674) compară
-- deja cu `greatest(ultima foaie aprobată, vehicles.km_curent)`. Defectul era
-- că aplicația nu trimitea niciodată `km_curent` la creare, deci baza rămânea
-- 0. Repararea e în `vehiculNouSchema`, nu aici.

begin;

-- ============================================================
-- A + B. Filtrele de rând pe scriere
-- ============================================================

create or replace function app.poate_crea_foaie(p_organization_id uuid, p_sofer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case app.has_permission(p_organization_id, 'trip_sheets', 'create')
    when 'all'  then true
    when 'team' then p_sofer_id is not null
                     and (p_sofer_id = app.current_employee_id(p_organization_id)
                          or app.is_manager_of(p_organization_id, p_sofer_id))
    when 'own'  then p_sofer_id is not null
                     and p_sofer_id = app.current_employee_id(p_organization_id)
    else false
  end;
$$;

revoke all on function app.poate_crea_foaie(uuid, uuid) from public, anon;
grant execute on function app.poate_crea_foaie(uuid, uuid) to authenticated, service_role;

comment on function app.poate_crea_foaie(uuid, uuid) is
  'Filtrul de rând pentru CREAREA foilor de parcurs. Comută pe trip_sheets:create, nu pe :read — altfel cine citește foile echipei le-ar și întocmi în numele ei (0171).';

drop policy if exists foi_insert on public.trip_sheets;
create policy foi_insert on public.trip_sheets
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.poate_crea_foaie(organization_id, employee_id)
    and deleted_at is null
    and status = 'draft'          -- nicio foaie nu se naște aprobată
    and aprobat_de is null
    and aprobat_la is null
    and trimis_la is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

drop policy if exists alimentari_insert on public.fuel_entries;
create policy alimentari_insert on public.fuel_entries
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.poate_scrie_foaie(organization_id, app.foaie_sofer(trip_sheet_id))
    and deleted_at is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

drop policy if exists alimentari_update on public.fuel_entries;
create policy alimentari_update on public.fuel_entries
  for update to authenticated
  using (
    deleted_at is null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.poate_scrie_foaie(organization_id, app.foaie_sofer(trip_sheet_id))
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.poate_scrie_foaie(organization_id, app.foaie_sofer(trip_sheet_id))
    and updated_by = (select auth.uid())
  );

-- ============================================================
-- C. Departamentul vehiculului, în aceeași firmă
-- ============================================================

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
  -- 0018 §F3: doar la INSERT sau la schimbarea efectivă a lui employee_id.
  if new.employee_id is not null
     and (tg_op = 'INSERT' or new.employee_id is distinct from old.employee_id)
     and not exists (
       select 1 from public.employees e
        where e.id = new.employee_id and e.organization_id = new.organization_id and e.deleted_at is null
     ) then
    raise exception using errcode = 'P0001',
      message = 'Angajatul ales pentru vehicul nu aparţine organizaţiei dumneavoastră.';
  end if;
  -- 0171: aceeași regulă pentru departament, cu aceeași condiție — ridicarea
  -- km_curent la aprobarea unei foi nu trebuie să cadă pe un departament
  -- șters între timp.
  if new.department_id is not null
     and (tg_op = 'INSERT' or new.department_id is distinct from old.department_id)
     and not exists (
       select 1 from public.departments d
        where d.id = new.department_id and d.organization_id = new.organization_id and d.deleted_at is null
     ) then
    raise exception using errcode = 'P0001',
      message = 'Departamentul ales pentru vehicul nu aparține organizației dumneavoastră.';
  end if;
  return new;
end;
$$;

-- ============================================================
-- D. Anomalia confirmată e închisă
-- ============================================================

create or replace function internal.anomalii_protejeaza()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (old.organization_id, old.vehicle_id, old.trip_sheet_id, old.km_asteptat, old.km_declarat, old.tip)
     is distinct from
     (new.organization_id, new.vehicle_id, new.trip_sheet_id, new.km_asteptat, new.km_declarat, new.tip) then
    raise exception using errcode = 'P0001',
      message = 'Datele constatate ale anomaliei nu se pot modifica. Puteţi doar să o confirmaţi şi să adăugaţi o notă.';
  end if;
  -- 0171: confirmarea e o semnătură. După ea, nici momentul, nici nota, nici
  -- semnatarul nu se mai schimbă — al doilea om ar lăsa rândul semnat de
  -- primul, dar cu explicația lui. Ștergerea logică rămâne posibilă.
  --
  -- Excepția: `confirmat_de` poate deveni NULL. Asta face FK-ul
  -- `references auth.users on delete set null`, printr-un UPDATE care trece și
  -- prin triggerul ăsta. Fără excepție, ștergerea unui cont care a confirmat
  -- vreodată o anomalie ar cădea cu mesajul de mai jos, adică ștergerea
  -- administrativă sau GDPR a utilizatorului ar fi blocată de o anomalie de
  -- kilometraj.
  if old.confirmat_la is not null
     and (
       (new.confirmat_la, new.nota) is distinct from (old.confirmat_la, old.nota)
       or (new.confirmat_de is distinct from old.confirmat_de and new.confirmat_de is not null)
     ) then
    raise exception using errcode = 'P0001',
      message = 'Anomalia a fost deja confirmată. Confirmarea și nota ei nu se mai pot modifica.';
  end if;
  if new.confirmat_la is not null and old.confirmat_la is null then
    new.confirmat_de := coalesce((select auth.uid()), new.confirmat_de);
  end if;
  -- Semnatarul nu vine din payload: fără confirmare, nu există.
  if new.confirmat_la is null then
    new.confirmat_de := null;
  end if;
  return new;
end;
$$;

-- ============================================================
-- E. Denumirile de platformă, fără sedilă
-- ============================================================

update public.vehicle_document_types
   set denumire = case cod
                    when 'itp'               then 'Inspecție tehnică periodică (ITP)'
                    when 'licenta_transport' then 'Licență de transport'
                  end,
       updated_at = now()
 where organization_id is null
   and cod in ('itp', 'licenta_transport')
   and (denumire like '%ţ%' or denumire like '%ş%' or denumire like '%Ţ%' or denumire like '%Ş%');

do $$
declare v_n integer;
begin
  select count(*) into v_n
    from public.vehicle_document_types
   where organization_id is null
     and (denumire like '%ţ%' or denumire like '%ş%' or denumire like '%Ţ%' or denumire like '%Ş%');
  if v_n > 0 then
    raise exception 'Au rămas % denumiri de platformă cu sedilă în vehicle_document_types.', v_n;
  end if;
end $$;

commit;
