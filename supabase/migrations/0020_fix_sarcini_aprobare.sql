-- ─────────────────────────────────────────────────────────────────────────────
-- 0020_fix_sarcini_aprobare.sql
--
-- Două defecte găsite după reparațiile din 0017-0019, semnalate de agenții care
-- le-au scris ca fiind în afara sarcinii lor. Primul e grav.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- A. ESCALADAREA LA DATE DE SĂNĂTATE, REDESCHISĂ PRIN `UPDATE`
--
-- `0016` a închis calea de INSERT: un angajat nu-și mai poate forja o sarcină de
-- aprobare care să indice cererea colegului. Politica de UPDATE a rămas însă cu
--     with check (organization_id = any ((select app.current_org_ids())::uuid[]))
-- adică singura condiție e ca rândul să rămână în aceeași organizație.
--
-- Un aprobator legitim trece de `USING` (are `approver_user_id = auth.uid()` pe
-- sarcina LUI) și poate apoi rescrie `entity_id`. Rândul rămâne al organizației
-- sale, deci `WITH CHECK` îl acceptă. Iar ramura
--     exists (select 1 from approval_tasks t
--              where t.entity_id = leave_requests.id
--                and t.approver_user_id = auth.uid())
-- din `leave_requests_select` îi deschide imediat cererea vizată.
--
-- REPRODUS integral, ca `authenticated`, cu JWT-ul lui A:
--     select count(*) from leave_requests where id = <cererea lui B>;   → 0
--     update approval_tasks set entity_id = <cererea lui B>
--      where id = <sarcina lui A>;                                      → UPDATE 1
--     select motiv from leave_requests where id = <cererea lui B>;
--       → „DIAGNOSTIC CONFIDENTIAL"
--
-- Adică exact aceeași scurgere art. 9 — cod de indemnizație CNAS, serie și număr
-- de certificat, motiv liber — pe care 0016 o închisese pe cealaltă intrare.
-- Lecția e că nu ajunge să blochezi CREAREA unui rând care ancorează vizibilitate:
-- trebuie blocată și REȚINTIREA lui.
--
-- De ce trigger și nu `WITH CHECK`: predicatul unei politici nu poate vedea `OLD`,
-- deci nu poate spune „coloana asta nu are voie să se schimbe" — poate doar
-- constrânge valoarea nouă în absolut. Identitatea sarcinii nu are o valoare
-- absolută corectă; are doar obligația de a rămâne cea dinainte.
--
-- Lista e ALBĂ, nu neagră. O listă neagră trebuie extinsă la fiecare coloană nouă,
-- de către cineva care își amintește. Aceeași alegere a prevenit deja rescrierea
-- cheii primare a unei predări-primiri (0016, punctul A3).
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function internal.approval_tasks_imutabile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Ce poate schimba un aprobator: decizia lui și urmele ei. Nimic din ceea ce
  -- stabilește PE CINE și CE anume vizează sarcina.
  v_modificabile constant text[] := array[
    'status', 'comentariu', 'decis_la', 'deleted_at', 'updated_at'
  ];
  v_diferite text;
begin
  -- Contextul de serviciu are voie: triggerul de re-țintire la reorganizare
  -- (0017) mută deliberat `approver_user_id` pe sarcinile încă neluate.
  if app.is_service_context() then
    return new;
  end if;

  select string_agg(cheie, ', ' order by cheie) into v_diferite
    from jsonb_each_text(to_jsonb(new)) as n(cheie, valoare)
    join jsonb_each_text(to_jsonb(old)) as o(cheie, valoare) using (cheie)
   where n.valoare is distinct from o.valoare
     and not (n.cheie = any (v_modificabile));

  if v_diferite is not null then
    raise exception using errcode = 'P0001',
      message = 'Nu se pot modifica datele de identitate ale unei sarcini de aprobare ('
                || v_diferite || '). Puteți doar să o aprobați, să o respingeți sau să o comentați.';
  end if;

  return new;
end;
$$;

drop trigger if exists approval_tasks_imutabile on public.approval_tasks;
create trigger approval_tasks_imutabile
  before update on public.approval_tasks
  for each row execute function internal.approval_tasks_imutabile();


-- ═════════════════════════════════════════════════════════════════════════════
-- B. `vehicle_document_types` — aceeași ștergere logică imposibilă
--
-- `0018` a scos `deleted_at is null` din USING-ul politicilor de SELECT pentru
-- vehicule, documente, alimentări și anomalii, fiindcă Postgres aplică politica
-- de SELECT și rândului NOU la un UPDATE — iar rândul nou tocmai a primit
-- `deleted_at`, deci nu mai trece de propriul filtru.
--
-- `vehicle_document_types` a rămas pe dinafară: nomenclatorul propriu al firmei
-- nu poate fi dezactivat prin ștergere logică de niciun rol. Aceeași corecție.
--
-- Rândurile de PLATFORMĂ (organization_id is null) rămân vizibile tuturor și, ca
-- până acum, nu se pot scrie din aplicație — politicile de INSERT/UPDATE cer
-- `organization_id is not null`.
-- ═════════════════════════════════════════════════════════════════════════════

drop policy if exists vdt_select on public.vehicle_document_types;
create policy vdt_select on public.vehicle_document_types
  for select to authenticated
  using (
    organization_id is null
    or (
      organization_id = any ((select app.current_org_ids())::uuid[])
      and app.feature_on(organization_id, 'fleet')
      and app.can(organization_id, 'vehicles', 'read', 'own')
    )
  );


-- ── Verificare: reținirea chiar e blocată ───────────────────────────────────
do $$
declare
  v_are_trigger boolean;
begin
  select exists (
    select 1 from pg_trigger t
     where t.tgrelid = 'public.approval_tasks'::regclass
       and t.tgname = 'approval_tasks_imutabile'
       and not t.tgisinternal
  ) into v_are_trigger;

  if not v_are_trigger then
    raise exception 'Triggerul de imutabilitate pe approval_tasks nu s-a atașat — calea de escaladare prin UPDATE rămâne deschisă.';
  end if;

  if exists (
    select 1 from pg_policy
     where polrelid = 'public.vehicle_document_types'::regclass
       and polcmd = 'r'
       and pg_get_expr(polqual, polrelid) like '%deleted_at IS NULL%'
  ) then
    raise exception 'vdt_select încă filtrează deleted_at în USING — ștergerea logică rămâne imposibilă.';
  end if;
end
$$;
