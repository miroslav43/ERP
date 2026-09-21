-- supabase/migrations/0149_drepturi_si_campuri_derivate.sql
--
-- CE DECIDE CINE CE POATE, ȘI CE SE CALCULEAZĂ SINGUR.
--
-- ── DE UNDE VINE MIGRAREA ───────────────────────────────────────────────────
-- Lotul 5 din auditul „atinge frontendul baza direct?"
-- (`docs/audit-frontend-baza-2026-09-21.md`), partea de bază. Loturile 1-4 au
-- închis izolarea între firme, marginea platformei, cifrele de plată și actele.
-- Aici sunt două familii care au în comun forma, nu modulul:
--
--   * DREPTURILE — rânduri care decid ce poate altcineva (suprascrierile de
--     permisiuni, jurnalul de audit);
--   * CÂMPURILE DERIVATE — coloane pe care le calculează un trigger și pe care
--     nimeni n-ar trebui să le scrie de mână (`manager_path`, autorul unui
--     comentariu, câmpurile de decizie ale unui tichet, calea avatarului).
--
-- ── (F03) SUPRASCRIEREA DE PERMISIUNI SE PUTEA MUTA PE ALTCINEVA ───────────
-- `role_permissions_insert` verifică scope-ul corect: `roles:update = all`, sau
-- `= team` plus apartenența la echipă. `role_permissions_update` verifică
-- aceleași lucruri în USING — dar WITH CHECK-ul, adică rândul REZULTAT, cere
-- doar ca `member_id` să nu fie null, să nu fie chiar apelantul și să fie în
-- firmă. Un manager cu `roles:update = team` crea deci o suprascriere legitimă
-- pe un subordonat, apoi o MUTA, cu un PATCH, pe orice alt membru al firmei, cu
-- orice scope — inclusiv `employees:read = all`, singura poartă către CNP și
-- IBAN. Probat pe banc.
--
-- ── (F34) `manager_path` ───────────────────────────────────────────────────
-- Coloana e derivată: o calculează `tg_employees_manager_path` din
-- `manager_employee_id`. Dar triggerul e declarat `BEFORE UPDATE OF
-- manager_employee_id, organization_id`, deci un PATCH care atinge DOAR
-- `manager_path` nu-l trezește: valoarea clientului rămâne scrisă. Cu ea se
-- decide tot scope-ul `team` din produs — cine vede și cine scrie pe cine.
--
-- ── (F37) AUTORUL UNUI COMENTARIU DE TICHET ────────────────────────────────
-- Server Action-ul pune mereu `autor_employee_id = fișa mea`. Politica nu cerea
-- nimic, deci prin PostgREST un angajat putea posta pe propriul tichet un
-- comentariu semnat de managerul lui — o „aprobare" fabricată, în fir.
--
-- ── (F09) TICHETUL FABRICAT ────────────────────────────────────────────────
-- Gărzile de câmp ale tichetelor rulează `BEFORE UPDATE`. La INSERT nu rula
-- nimic, deci solicitantul își putea crea tichetul direct cu prioritate
-- critică, asignat cuiva, cu aprobator și dată de decizie completate.
--
-- ── (F23) JURNALUL DE AUDIT ────────────────────────────────────────────────
-- `public.log_audit_event` e apelabilă de orice `authenticated` și scrie ce i se
-- dă: acțiune, entitate, `before`/`after` nescrubate (deci date personale în
-- clar în jurnal), IP ales de client. Iar cu `p_organization_id = null`
-- verificarea de apartenență nu se evaluează deloc — oricine putea umple tabela.
--
-- ── (F18, F49) DOUĂ MICI ───────────────────────────────────────────────────
-- `profiles.avatar_path` accepta un URL extern, iar `urlAvatar()` îl întoarce
-- neatins: poza de profil devenea pixel de urmărire încărcat în browserul
-- fiecărui coleg care deschide organigrama. Iar `urmatoarea_marca` consuma un
-- număr de marcă la fiecare apel, pentru orice membru — inclusiv în buclă.
--
-- ── CE NU ATINGE, DELIBERAT ─────────────────────────────────────────────────
-- Regulile de business pe module (concedii, contracte, FK-uri între firme) sunt
-- în 0150: aici stau doar drepturile și derivatele, care se citesc împreună.

begin;

-- ── 1. F03: scopul se verifică și pe rândul REZULTAT ──────────────────────
drop policy if exists role_permissions_update on public.role_permissions;
create policy role_permissions_update on public.role_permissions
for update to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and (
    app.can(organization_id, 'roles', 'update', 'all')
    or (
      app.has_permission(organization_id, 'roles', 'update') = 'team'
      and app.membru_din_echipa(member_id)
    )
  )
)
with check (
  member_id is not null
  and resource <> 'roles'
  and member_id is distinct from app.membrul_meu(organization_id)
  and organization_id = any ((select app.current_org_ids())::uuid[])
  -- Poarta care lipsea: fără ea, rândul putea fi RETINTIT pe orice membru al
  -- firmei, cu orice scope, păstrând dreptul dobândit la crearea lui.
  and (
    app.can(organization_id, 'roles', 'update', 'all')
    or (
      app.has_permission(organization_id, 'roles', 'update') = 'team'
      and app.membru_din_echipa(member_id)
    )
  )
);

-- ── 2. F34: lanțul de subordonare se calculează, nu se trimite ────────────
-- Cascada (`tg_employees_manager_path_cascade`) scrie legitim `manager_path` pe
-- copii, fără să atingă `manager_employee_id` — adică exact forma pe care garda
-- de mai jos o refuză. De-aia își aprinde un steag local cât ține scrierea ei.
create or replace function public.tg_employees_manager_path_cascade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.manager_path is distinct from old.manager_path then
    perform set_config('app.manager_path_cascada', 'on', true);
    update public.employees e
    set manager_path = new.manager_path
                       || e.manager_path[array_length(old.manager_path, 1) + 1 : array_length(e.manager_path, 1)]
    where e.manager_path @> array[old.id] and e.id <> new.id;
    perform set_config('app.manager_path_cascada', 'off', true);
  end if;
  return null;
end;
$$;

create or replace function internal.employees_manager_path_derivat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if app.is_service_context()
     or coalesce(current_setting('app.manager_path_cascada', true), 'off') = 'on'
     or new.manager_employee_id is distinct from old.manager_employee_id then
    -- Managerul s-a schimbat: `employees_manager_path_biu` a recalculat deja
    -- valoarea corectă, iar aici n-avem ce restaura.
    return new;
  end if;
  new.manager_path := old.manager_path;
  return new;
end;
$$;

revoke all on function internal.employees_manager_path_derivat() from public, anon;

-- Numele începe cu `zz_` ca să ruleze DUPĂ `employees_manager_path_biu`
-- (triggerele se execută în ordine alfabetică): dacă ar rula înainte, recalculul
-- l-ar suprascrie și garda n-ar exista.
drop trigger if exists zz_employees_manager_path_derivat on public.employees;
create trigger zz_employees_manager_path_derivat
  before update on public.employees
  for each row execute function internal.employees_manager_path_derivat();

-- ── 3. F37: autorul comentariului e cine scrie ────────────────────────────
drop policy if exists ticket_comments_insert on public.ticket_comments;
create policy ticket_comments_insert on public.ticket_comments
for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.pot_vedea_tichetul(ticket_id)
  and (intern = false or app.can(organization_id, 'tickets', 'update', 'team'))
  -- Fără asta, un angajat posta pe propriul tichet un comentariu semnat de
  -- managerul lui. `created_by` rămânea corect, dar în ecran se vede numele
  -- din `autor_employee_id`.
  and autor_employee_id = app.fisa_mea(organization_id)
);

-- ── 4. F09: tichetul nu se naște aprobat ──────────────────────────────────
-- Câmpurile astea le scrie fluxul (triaj, aprobare, repartizare), nu
-- solicitantul. `WITH CHECK` la INSERT le pinuiește pe valorile de start —
-- tiparul casei, același ca la `attendance_entries_insert`.
drop policy if exists tickets_insert on public.tickets;
create policy tickets_insert on public.tickets
for insert to authenticated
with check (
  deleted_at is null
  and organization_id = any ((select app.current_org_ids())::uuid[])
  and app.can(organization_id, 'tickets', 'create', 'own')
  and solicitant_employee_id = app.fisa_mea(organization_id)
  and status = case
                 when tip in ('software', 'hardware') then 'in_aprobare'::public.ticket_status
                 else 'nou'::public.ticket_status
               end
  and coalesce(prioritate_manuala, false) = false
  and prioritate_motiv is null
  and asignat_employee_id is null
  and aprobat_de_employee_id is null
  and decizie_la is null
  and motiv_respingere is null
  and closed_at is null
);
-- `rezultat_obtinut` NU e pinuit, deși sună a câmp de rezolvare: pe un tichet
-- `bug_erp` e chiar descrierea solicitantului („ce s-a întâmplat în loc"), lângă
-- `pasi_efectuati` și `rezultat_asteptat`. Prima formă a politicii îl cerea null
-- și a fost prinsă de verificarea (l) din `tests/rls/izolare.sql`, care numără
-- tichetul de bug printre scrierile legitime ale unui `employee`.

-- ── 5. F23: jurnalul de audit nu se mai fabrică ───────────────────────────
create or replace function public.log_audit_event(
  p_action audit_action,
  p_status audit_status default 'success',
  p_organization_id uuid default null,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_ip text default null,
  p_user_agent text default null,
  p_request_id text default null,
  p_error_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_organization_id is not null
     and not app.is_member(p_organization_id)
     and not app.is_platform_admin()
     and not app.is_service_context() then
    raise exception 'Acces interzis la jurnalul acestei organizații.' using errcode = '42501';
  end if;

  -- Ramura care lipsea: cu organizația NULL, verificarea de mai sus nu se
  -- evalua deloc, deci orice cont putea scrie rânduri fără firmă — nevăzute de
  -- nimeni, nelimitate la număr.
  if p_organization_id is null
     and not app.is_platform_admin()
     and not app.is_service_context() then
    raise exception 'Jurnalul cere organizația în care s-a întâmplat evenimentul.'
      using errcode = '42501';
  end if;

  -- Fără plafon, un apel direct putea umple tabela de audit cu documente de
  -- megaocteți. 16 KB e mult peste orice `before`/`after` real din produs.
  if pg_catalog.pg_column_size(p_before) > 16384
     or pg_catalog.pg_column_size(p_after) > 16384 then
    raise exception 'Documentul de audit depășește 16 KB.' using errcode = 'P0001';
  end if;

  insert into public.audit_logs (
    organization_id, actor_id, action, status, entity_type, entity_id,
    before, after, ip, user_agent, request_id, error_code
  )
  values (
    p_organization_id, (select auth.uid()), p_action, p_status, p_entity_type, p_entity_id,
    -- `before`/`after` treceau brut: `app.write_audit` scrubuia deja cheile de
    -- secrete și de criptare, poarta publică nu. Acum trec prin același filtru.
    internal.scrub_jsonb(p_before), internal.scrub_jsonb(p_after),
    -- IP-ul NU se mai ia din argument, nici măcar ca rezervă: îl citim din
    -- antetul cererii. Un `coalesce(request_ip(), p_ip)` ar fi părut prudent și
    -- ar fi lăsat gaura deschisă exact pentru apelul direct, care n-are antete.
    internal.request_ip(),
    -- Antetele sunt și ele controlate de client: le tăiem la o lungime rezonabilă
    -- ca un `User-Agent` de un megaoctet să nu umple tabela de audit.
    left(p_user_agent, 512),
    left(p_request_id, 128),
    left(p_error_code, 64)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.log_audit_event(audit_action, audit_status, uuid, text, uuid, jsonb, jsonb, text, text, text, text) from public, anon;
grant execute on function public.log_audit_event(audit_action, audit_status, uuid, text, uuid, jsonb, jsonb, text, text, text, text) to authenticated, service_role;

-- ── 6. F18: calea avatarului e o cale, nu un URL ──────────────────────────
-- Producția are zero rânduri cu URL extern (verificat read-only înainte de
-- migrare), deci constrângerea nu respinge date existente.
alter table public.profiles drop constraint if exists profiles_avatar_path_ck;
alter table public.profiles
  add constraint profiles_avatar_path_ck
  check (
    avatar_path is null
    or avatar_path ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[^/]+$'
  );

-- `internal.handle_new_user` copia `avatar_url` din metadata contului — adică
-- exact un URL extern, pe calea legitimă. Cu constrângerea de mai sus ar fi
-- rupt crearea conturilor OAuth, deci nu mai copiază nimic: poza se încarcă din
-- aplicație, în bucket-ul propriu.
create or replace function internal.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null then
    return new;
  end if;

  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email::text::extensions.citext,
    nullif(btrim(coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    )), '')
  )
  on conflict (id) do update
    set email      = excluded.email,
        full_name  = coalesce(public.profiles.full_name, excluded.full_name),
        updated_at = now();

  return new;
end;
$$;

-- ── 7. F49: marca se consumă doar de cine creează angajați ────────────────
create or replace function public.urmatoarea_marca(p_organization_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (p_organization_id = any ((select app.current_org_ids())::uuid[])) then
    raise exception 'Organizația nu vă este accesibilă.' using errcode = 'P0001';
  end if;
  -- Poarta adăugată: funcția CONSUMĂ un număr din contor la fiecare apel
  -- (`internal.urmatoarea_marca` incrementează `employee_marca_counters`), deci
  -- orice membru putea arde mărci în buclă și lăsa goluri în numerotare. Marca
  -- se alocă doar cui creează angajați — la fel ca `aloca_numar_contract`.
  if not app.can(p_organization_id, 'employees', 'create', 'all') then
    raise exception 'Nu ai dreptul să aloci mărci în această organizație.' using errcode = '42501';
  end if;
  return internal.urmatoarea_marca(p_organization_id);
end;
$$;

revoke all on function public.urmatoarea_marca(uuid) from public, anon;
grant execute on function public.urmatoarea_marca(uuid) to authenticated, service_role;

commit;
