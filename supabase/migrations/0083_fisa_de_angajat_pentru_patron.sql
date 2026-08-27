-- supabase/migrations/0083_fisa_de_angajat_pentru_patron.sql
--
-- PATRONUL PRIMEȘTE FIȘĂ DE ANGAJAT. Până acum nu avea niciuna, niciodată.
--
-- ── PROBLEMA ─────────────────────────────────────────────────────────────────
-- Crearea unei firme insera EXCLUSIV un rând în `organization_members`, cu rolul
-- `org_admin`, și trimitea invitația (`super-admin/organizatii/nou/actions.ts`,
-- pasul owner). Niciun rând în `employees`. Nu era un defect ascuns: codul
-- susține deliberat cazul „administrator invitat, care nu e angajat"
-- (`src/lib/queries/portal.ts`, comentariul lui `StareFisa`).
--
-- Efectul, verificat pe toate cele treisprezece ecrane administrative care ating
-- fișa proprie: unul singur MOARE — `/pontaj/saptamana`, care returnează
-- „Contul dvs. nu este legat de o fișă de angajat principală". Restul tolerează
-- lipsa. Tot `/portal/*` moare și el, dar acolo e corect: e portalul
-- angajatului.
--
-- Numai că patronul unei firme mici din România E, de regulă, angajatul ei — și
-- oricum vrea să-și poată depune propriul concediu și să-și vadă propriul
-- pontaj. Un cont care administrează tot produsul, dar n-are unde să-și scrie
-- propria săptămână, e o fundătură.
--
-- ── DE CE UN TRIGGER, NU O MODIFICARE A LUI `accept_invitation` ──────────────
-- `accept_invitation` e definită în 0002 și REDEFINITĂ în 0030. Un
-- `create or replace` scris de aici ar trebui să reproducă tot corpul viu —
-- exact locul în care se pierde tăcut o bucată din 0030. Triggerul pe
-- `organization_members` nu atinge nicio funcție existentă și prinde pe deasupra
-- TOATE căile prin care apare un `org_admin`, nu doar invitația acceptată:
-- adăugarea manuală de către un super_admin, o eventuală înrolare viitoare.
--
-- ── STAREA FIȘEI: `candidat`, DELIBERAT ──────────────────────────────────────
-- Verificat, nu presupus:
--   · salarizarea filtrează `status = 'activ'` (`src/lib/queries/payroll.ts`),
--     deci fișa asta NU intră în niciun calcul și nu produce rânduri goale;
--   · REVISAL citește `revisal_events`, evenimente create explicit — o fișă
--     simplă nu ajunge acolo, deci nu există risc de transmitere greșită la ITM;
--   · limita de locuri (`seats_limit`) numără `organization_members`, nu
--     `employees`, deci nimeni nu pierde un loc plătit.
-- Patronul își pune contract și trece pe `activ` când chiar e angajat. Dacă e
-- administrator pe contract de mandat, fișa rămâne `candidat` și tot îi
-- deblochează ecranele personale, fără să-l declare salariat nicăieri.

begin;

-- ============================================================
-- 0. NUMEROTAREA, FĂRĂ GARDA DE TENANT
-- ============================================================
-- `public.urmatoarea_marca` (0034) începe cu
--   `if not (p_organization_id = any (app.current_org_ids())) then raise ...`
-- — corect pentru un RPC chemat de un om, imposibil de folosit dintr-o migrare
-- sau dintr-un trigger, unde `auth.uid()` e null și mulțimea iese vidă. Prima
-- încercare a acestei migrări a picat exact acolo:
--   ERROR: Organizația nu vă este accesibilă.
--
-- Logica contorului se mută în `internal`, iar funcția publică rămâne ce era —
-- garda, apoi delegarea. O singură implementare a numerotării, două porți.
-- `created_by`/`updated_by` acceptă null: într-un trigger nu există „cine".

create or replace function internal.urmatoarea_marca(p_organization_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_numar int;
begin
  insert into public.employee_marca_counters (organization_id, next_marca, created_by, updated_by)
  values (p_organization_id, 2, (select auth.uid()), (select auth.uid()))
  on conflict (organization_id) do update
    set next_marca = public.employee_marca_counters.next_marca + 1,
        updated_by = (select auth.uid())
  returning next_marca - 1 into v_numar;

  return lpad(v_numar::text, 4, '0');
end;
$$;

revoke all on function internal.urmatoarea_marca(uuid) from public, anon, authenticated;

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
  return internal.urmatoarea_marca(p_organization_id);
end;
$$;

revoke all on function public.urmatoarea_marca(uuid) from public, anon;
grant execute on function public.urmatoarea_marca(uuid) to authenticated;

-- ============================================================
-- 1. FUNCȚIA
-- ============================================================
-- Numele se caută în trei locuri, în ordinea încrederii: invitația (are `nume`
-- și `prenume` separate, exact cum le cere tabela), profilul (un singur
-- `full_name`, care trebuie despicat), apoi partea locală a adresei de e-mail.
-- Ultima variantă nu e frumoasă, dar `first_name`/`last_name` sunt NOT NULL, iar
-- un trigger care ar arunca aici ar bloca acceptarea invitației — adică
-- patronul n-ar mai putea intra deloc în propria firmă. Un nume urât se
-- corectează dintr-un ecran; o invitație care nu se poate accepta, nu.

create or replace function internal.membru_creeaza_fisa_de_angajat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nume    text;
  v_prenume text;
  v_full    text;
  v_email   text;
begin
  if new.role <> 'org_admin' or new.status <> 'active' or new.user_id is null then
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

drop trigger if exists trg_zorganization_members_fisa_patron on public.organization_members;
create trigger trg_zorganization_members_fisa_patron
  after insert on public.organization_members
  for each row execute function internal.membru_creeaza_fisa_de_angajat();

-- ============================================================
-- 2. FIRMELE CARE EXISTĂ DEJA
-- ============================================================
-- Triggerul acoperă doar inserările de acum înainte. Fără pasul ăsta,
-- patronii existenți ar rămâne exact cu problema pentru care s-a scris migrarea.
-- Aceleași fișe pe care le-ar fi creat triggerul dacă exista atunci.

insert into public.employees
  (organization_id, user_id, marca, first_name, last_name, status, is_primary)
select m.organization_id,
       m.user_id,
       internal.urmatoarea_marca(m.organization_id),
       coalesce(nullif(btrim(substr(btrim(p.full_name), length(split_part(btrim(p.full_name), ' ', 1)) + 1)), ''),
                'Administrator'),
       coalesce(nullif(split_part(btrim(coalesce(p.full_name, '')), ' ', 1), ''),
                split_part(u.email::text, '@', 1)),
       'candidat',
       true
  from public.organization_members m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
 where m.role = 'org_admin'
   and m.status = 'active'
   and m.deleted_at is null
   and m.user_id is not null
   and not exists (
     select 1 from public.employees e
      where e.organization_id = m.organization_id
        and e.user_id = m.user_id
        and e.deleted_at is null
   );

commit;

-- ============================================================
-- 3. NOTE DE PROIECTARE
-- ============================================================
-- · De ce DOAR `org_admin` și nu orice membru invitat: un `employee` invitat
--   fără fișă întâlnește ecranul `FaraFisa` din portal, care e construit exact
--   pentru asta și îi explică situația. Nu e o fundătură, e o stare tratată.
--   Patronul nu avea echivalentul — `/pontaj/saptamana` îi răspundea cu un
--   refuz de acces, care sună a lipsă de drepturi, deși drepturi are toate.
--   Extinderea la toate rolurile ar popula `/angajati` cu fișe pe care nu le-a
--   cerut nimeni; se poate face separat, dacă se dovedește necesar.
--
-- · De ce fișa se creează chiar dacă patronul are deja una NEPRINCIPALĂ: nu se
--   creează. Condiția testează orice fișă nescrisă-ștearsă, nu doar
--   `is_primary`. Cumulul de funcții e permis în produs (vezi `fisaMea`,
--   `limit(2)`), iar o a doua fișă generată automat ar strica exact cazul ăla.
--
-- · `marca` vine din `public.urmatoarea_marca()` (0034), aceeași sursă ca la
--   angajarea normală, deci numerotarea firmei rămâne continuă și fără coliziuni.
