-- supabase/migrations/0099_invitatia_leaga_fisa.sql
--
-- INVITAȚIA ȘTIE PE CINE INVITĂ, IAR CONTUL SE LEAGĂ DE FIȘĂ.
--
-- ── VERIGA RUPTĂ ─────────────────────────────────────────────────────────────
-- `public.employees.user_id` (`0004_hr.sql:187`) e CITIT peste tot:
-- `app.current_employee_id()`, toate ramurile `own` din RLS, portalul
-- angajatului, notificările de concedii, cursurile. Este SCRIS dintr-un singur
-- loc — triggerul din `0083_fisa_de_angajat_pentru_patron.sql`, și numai pentru
-- `org_admin`.
--
-- Deci un angajat înrolat prin `/angajati/nou` și invitat apoi din
-- `/setari/membri` primea un cont care NU ERA LEGAT de fișa lui. Portalul îi
-- spunea „nu aveți fișă", iar fișa lui nu avea cont. Singura reparație era un
-- UPDATE manual în bază. Verificat pe baza reală: 4 din 11 fișe fără `user_id`,
-- iar cele 7 legate sunt exact patronii, puși acolo de triggerul din 0083.
--
-- ── DE CE SE EXTINDE TRIGGERUL, NU `accept_invitation` ──────────────────────
-- Motivul e scris în antetul lui 0083 și a rămas valabil, ba chiar s-a întărit:
--
--   „`accept_invitation` e definită în 0002 și REDEFINITĂ în 0030. Un
--    `create or replace` scris de aici ar trebui să reproducă tot corpul viu —
--    exact locul în care se pierde tăcut o bucată din 0030."
--
-- Între timp a mai fost redefinită de DOUĂ ori: în 0091 (parola la acceptare) și
-- în 0094 (steagul care trece de gardian). Un `create or replace` scris azi ar
-- trebui să reproducă fidel patru straturi de decizii. Triggerul pe
-- `organization_members` nu atinge nicio funcție existentă și prinde pe deasupra
-- TOATE căile prin care apare un membru — invitație acceptată, adăugare de către
-- un super_admin, orice cale viitoare.
--
-- ── ⚠️ DE CE NU O ACȚIUNE NOUĂ DE AUDIT ────────────────────────────────────
-- `public.audit_action` e un enum ÎNCHIS, cu 29 de valori — interogat în baza
-- reală, niciuna nu e `employee_linked`. Un `app.write_audit('employee_linked',…)`
-- ar cădea cu 22P02 CHIAR ÎN BLOCUL de legare, adică ar anula acceptarea
-- invitației: omul n-ar mai putea intra deloc în firmă. Se folosește `update`,
-- valoare existentă, cu detaliul în încărcătură.
--
-- ── PERMISIUNEA ÎNGUSTĂ ─────────────────────────────────────────────────────
-- Rolul `hr` înrolează angajați, dar n-are NICIUN `users:*` — deci nu putea
-- trimite invitația pe care înrolarea o cere. A-i da `users:create` i-ar fi dat
-- și dreptul de a invita `org_admin` din ecranul de membri: o extindere reală de
-- privilegiu, pentru o nevoie îngustă. `employees:invite` acoperă exact nevoia,
-- iar politica RLS de mai jos o leagă de rolul `employee`: cine are doar
-- permisiunea nouă poate invita angajați, nu administratori.
--
-- Forward-only: 0001, 0002, 0004, 0074, 0083 și 0094 NU se editează.

\set ON_ERROR_STOP on

begin;

-- =====================================================================================
-- 1. Invitația știe pentru ce fișă e
-- =====================================================================================

alter table public.invitations
  add column if not exists employee_id uuid;

-- Cheie compusă, nu FK simplu: altfel un uuid de fișă din ALTĂ firmă, trimis
-- direct către Server Action, ar intra în invitație. Tiparul e din 0074, iar
-- `employees_id_org_uk` există deja acolo.
alter table public.invitations
  add constraint invitations_employee_fk
  foreign key (employee_id, organization_id)
  references public.employees (id, organization_id)
  on delete set null;

-- O singură invitație în așteptare per fișă.
--
-- Indexul existent, `invitations_org_email_pending_uq`, NU acoperă cazul: două
-- fișe pot purta aceeași adresă de e-mail (soți la aceeași firmă, o adresă de
-- familie), iar aceeași fișă poate fi invitată de două ori la adrese diferite.
create unique index invitations_employee_pending_uq
  on public.invitations (employee_id)
  where employee_id is not null and status = 'pending' and deleted_at is null;

comment on column public.invitations.employee_id is
  'Fișa de personal pentru care s-a trimis invitația. NULL = invitație de membru pur '
  '(administrator, contabil extern) — cazul pe care îl susține `portal.ts` sub numele '
  '`fara_fisa`. La acceptare, triggerul de mai jos scrie `employees.user_id`.';

-- =====================================================================================
-- 2. Permisiunea îngustă: `employees:invite`
-- =====================================================================================
-- Sursa de adevăr a vocabularului e seed-ul, nu lista din `src/config/permissions.ts`:
-- politicile RLS interoghează `role_permissions`, iar o cheie fără rând întoarce
-- `none`, adică refuz tăcut.

insert into public.role_permissions (organization_id, role, resource, action, scope)
values
  (null, 'super_admin', 'employees', 'invite', 'all'),
  (null, 'org_admin',   'employees', 'invite', 'all'),
  -- `hr` e rolul care înrolează. Fără rândul ăsta, pasul de invitație al
  -- înrolării s-ar sări mereu, cu avertisment, exact pentru omul care are
  -- nevoie de el.
  (null, 'hr',          'employees', 'invite', 'all')
  -- `manager` și `employee`: NICIUN rând. Absența permisiunii ESTE refuzul.
on conflict do nothing;

-- =====================================================================================
-- 3. Politica de INSERT pe invitații acceptă și permisiunea îngustă
-- =====================================================================================
-- Fără pasul ăsta, permisiunea de mai sus ar fi decor: `invitations_insert` din
-- `0002_authz.sql:923` cere `users:create = all`, iar RLS decide, nu acțiunea.
--
-- O politică nu se poate `create or replace`; se înlocuiește. Restul clauzelor
-- rămân octet cu octet cele din 0002 — inclusiv pinuirea stării inițiale, care e
-- regula proiectului pentru `WITH CHECK` la INSERT.

drop policy if exists invitations_insert on public.invitations;

create policy invitations_insert on public.invitations for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and role <> 'super_admin'
  and status = 'pending'
  and accepted_at is null and accepted_by is null and deleted_at is null
  and (
    -- Dreptul larg: invită pe oricine, cu orice rol invitabil.
    app.can(organization_id, 'users', 'create', 'all')
    -- Dreptul îngust: DOAR angajați, DOAR cu rolul `employee`.
    or (role = 'employee' and app.can(organization_id, 'employees', 'invite', 'all'))
  )
);

-- =====================================================================================
-- 4. La acceptare, contul se leagă de fișă
-- =====================================================================================
-- Corpul de mai jos îl include INTEGRAL pe cel din 0083 — un `create or replace`
-- înlocuiește funcția, nu o completează. Ramura patronului rămâne neatinsă;
-- ramura de legare e nouă și rulează ÎNAINTEA ei, ca verificarea „are deja fișă"
-- să vadă legătura tocmai făcută și să nu creeze un duplicat.

create or replace function internal.membru_creeaza_fisa_de_angajat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nume        text;
  v_prenume     text;
  v_full        text;
  v_email       text;
  v_employee_id uuid;
  v_legate      integer;
begin
  if new.status <> 'active' or new.user_id is null then
    return null;
  end if;

  -- ── Ramura nouă: invitația purta o fișă ────────────────────────────────────
  if new.invitation_id is not null then
    select i.employee_id into v_employee_id
      from public.invitations i
     where i.id = new.invitation_id;

    if v_employee_id is not null then
      /*
       * `user_id is null` în clauza WHERE, nu doar în verificarea de dinainte:
       * între citire și scriere poate interveni altcineva. Fără ea, o a doua
       * acceptare ar suprascrie legătura primului cont.
       *
       * `deleted_at is null`: o fișă ștearsă între trimiterea invitației și
       * acceptarea ei nu se reînvie prin legare.
       */
      update public.employees e
         set user_id = new.user_id
       where e.id              = v_employee_id
         and e.organization_id = new.organization_id
         and e.user_id is null
         and e.deleted_at is null;
      get diagnostics v_legate = row_count;

      if v_legate = 1 then
        perform app.write_audit(
          'update', new.organization_id, 'employees', v_employee_id,
          jsonb_build_object('legat_de_cont', true, 'invitation_id', new.invitation_id)
        );
        -- Fișa există și e legată: patronul n-are ce mai crea.
        return null;
      end if;

      /*
       * Zero rânduri. Trei cauze posibile, toate tratate la fel: se continuă
       * fără legătură, dar NU se aruncă.
       *   · fișa a fost ștearsă între timp;
       *   · fișa are deja alt `user_id`;
       *   · indexul `employees_org_user_primary_uniq` ar fi încălcat, fiindcă
       *     acest cont e deja fișa principală a altcuiva din firmă.
       * O excepție aici ar anula acceptarea invitației — adică omul n-ar putea
       * intra deloc în firmă din cauza unei nepotriviri de fișe. Nepotrivirea se
       * vede pe ecranul angajatului („Fără cont"), unde se poate repara.
       */
      perform app.write_audit(
        'update', new.organization_id, 'employees', v_employee_id,
        jsonb_build_object('legare_esuata', true, 'invitation_id', new.invitation_id)
      );
    end if;
  end if;

  -- ── Ramura din 0083: patronul primește fișă ────────────────────────────────
  if new.role <> 'org_admin' then
    return null;
  end if;

  -- Are deja fișă (oricare, nu doar principală): nu se atinge nimic.
  if exists (
    select 1 from public.employees e
     where e.organization_id = new.organization_id
       and e.user_id = new.user_id
       and e.deleted_at is null
  ) then
    return null;
  end if;

  if new.invitation_id is not null then
    select i.nume, i.prenume into v_nume, v_prenume
      from public.invitations i where i.id = new.invitation_id;
  end if;

  if coalesce(btrim(v_nume), '') = '' or coalesce(btrim(v_prenume), '') = '' then
    select p.full_name into v_full from public.profiles p where p.id = new.user_id;
    if coalesce(btrim(v_full), '') <> '' then
      -- `employees.full_name` e generat ca `last_name || ' ' || first_name`,
      -- deci despicarea se face în aceeași ordine: primul cuvânt e numele.
      v_nume    := split_part(btrim(v_full), ' ', 1);
      v_prenume := nullif(btrim(substr(btrim(v_full), length(split_part(btrim(v_full), ' ', 1)) + 1)), '');
    end if;
  end if;

  if coalesce(btrim(v_nume), '') = '' or coalesce(btrim(v_prenume), '') = '' then
    select u.email::text into v_email from auth.users u where u.id = new.user_id;
    v_nume    := coalesce(nullif(btrim(v_nume), ''), split_part(coalesce(v_email, 'Administrator'), '@', 1));
    v_prenume := coalesce(nullif(btrim(v_prenume), ''), 'Administrator');
  end if;

  insert into public.employees
    (organization_id, user_id, marca, first_name, last_name, status, is_primary)
  values
    (new.organization_id, new.user_id, internal.urmatoarea_marca(new.organization_id),
     v_prenume, v_nume, 'candidat', true);

  return null;
end;
$$;

revoke all on function internal.membru_creeaza_fisa_de_angajat() from public, anon, authenticated;

-- =====================================================================================
-- 5. Note de proiectare
-- =====================================================================================
--
-- ORDINEA CELOR DOUĂ RAMURI NU E ARBITRARĂ. Un `org_admin` invitat CU fișă
-- (patronul care e și angajat, înrolat înainte de a fi invitat) trece prin
-- ramura de legare, iese cu `return null`, și nu mai ajunge la ramura care i-ar
-- fi creat o a doua fișă `candidat`. Inversate, ar fi primit două.
--
-- CE RĂMÂNE NEACOPERIT, DELIBERAT: invitațiile deja trimise, dinainte de
-- migrare, au `employee_id` NULL și se comportă exact ca până acum. Nu există
-- backfill: potrivirea după e-mail ar fi o ghicitoare — `employees.email_personal`
-- și `invitations.email` sunt câmpuri diferite, iar o legare greșită dă unui om
-- accesul la fișa altuia.

commit;
