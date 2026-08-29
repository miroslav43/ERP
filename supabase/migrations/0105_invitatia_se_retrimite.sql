-- 0105_invitatia_se_retrimite.sql
--
-- „Invită în aplicație", apăsat a doua oară, nu retrimitea nimic — refuza.
--
-- ── CE SE ÎNTÂMPLA ──────────────────────────────────────────────────────────
-- `creeazaInvitatie` (`src/lib/invitatii/creeaza.ts`) refuza pe loc adresa care
-- avea deja o invitație `pending`: „Există deja o invitație în așteptare pentru
-- această adresă." Omul care n-a primit e-mailul — ajuns în spam, adresă greșită
-- în fișă, link expirat — rămânea fără nicio cale înainte: butonul de pe fișa
-- angajatului refuza, iar retrimiterea exista DOAR în consola de platformă
-- (`super-admin/organizatii/[orgId]/membri`), unde nu ajunge niciun `org_admin`
-- și cu atât mai puțin `hr`.
--
-- ── DE CE NU AJUNGE SĂ SCOATEM MESAJUL DIN APLICAȚIE ────────────────────────
-- Sub el stau două straturi care refuză, dintre care al doilea TĂCUT:
--
--   1. `invitations_update` cere `users:update = all`. `hr` — adică exact rolul
--      care înrolează și invită — n-are NICIUN `users:*`, prin proiectare
--      (0002, reconfirmat în 0104). UPDATE-ul lui ar fi atins zero rânduri,
--      fără eroare.
--   2. `internal.guard_invitations` REPUNE valorile vechi la orice UPDATE venit
--      din client: `new.token_hash := old.token_hash`, la fel `email`,
--      `expires_at`, `role`. Regula lui e „din client, o invitație se poate doar
--      revoca". Deci UPDATE-ul ar fi „reușit" pe zero câmpuri, aplicația ar fi
--      trimis un e-mail cu tokenul NOU, iar în bază ar fi rămas hash-ul VECHI:
--      un link mort, trimis cu succes. Nimic în lanț n-ar fi semnalat ceva.
--
-- Cum consola de platformă retrimite prin `service_role`, gardianul iese pe
-- prima linie (`app.is_service_context()`) și acolo totul funcționa — motiv
-- pentru care defectul putea trece drept „merge la noi".
--
-- ── CE DESCHIDE MIGRAREA, EXACT ─────────────────────────────────────────────
-- O singură tranziție nouă: `pending` → `pending` cu ALT token. Adică
-- retrimiterea. Nu se poate, prin ea, nici accepta, nici revoca, nici șterge
-- logic o invitație, nici schimba rolul propus.
--
-- Ramura nouă din politică e îngustă din trei direcții deodată, ca cea din
-- 0104: cere `employees:invite = all`, cere ca rândul să fie `pending` ȘI cere
-- `role = 'employee'` — aceleași trei condiții pe care `invitations_insert` le
-- pune deja pentru INSERT-ul aceluiași rol. `hr` nu capătă nimic ce nu putea
-- obține revocând și reinvitând, dacă ar fi avut dreptul de a revoca.
--
-- ⚠️ FĂRĂ `role = 'employee'` ar fi fost o ESCALADARE DE PRIVILEGII: o invitație
-- `org_admin` în așteptare putea fi redirijată de `hr` către propria adresă și
-- reînnoită, iar linkul rezultat i-ar fi dat rolul de administrator. Condiția
-- nu e simetrie de stil, e poarta.
--
-- ── CE RĂMÂNE NESCHIMBAT ────────────────────────────────────────────────────
-- Revocarea rămâne la `users:update = all`, ca în nota din 0104. Rolul propus e
-- înghețat de gardian și la reînnoire — o invitație de `org_admin` retrimisă din
-- fișa angajatului rămâne de `org_admin`, nu se retrogradează tăcut.
--
-- Forward-only: 0001, 0002, 0094 și 0104 NU se editează.

\set ON_ERROR_STOP on

begin;

-- =====================================================================================
-- 1. Gardianul își recunoaște retrimiterea
-- =====================================================================================
-- Corpul e cel din 0094, octet cu octet, cu O SINGURĂ ramură nouă, așezată
-- înaintea celei de revocare. Ordinea contează: ramura de revocare pinuiește
-- `token_hash` și `expires_at` pe valorile vechi, deci orice reînnoire care ar
-- ajunge până la ea ar fi golită tăcut — chiar defectul reparat aici.

create or replace function internal.guard_invitations()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if app.is_service_context() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- R7: fereastra de valabilitate depinde de now(), deci trăiește aici, nu
    -- într-un CHECK.
    if new.expires_at is null
       or new.expires_at <= now() + interval '1 hour'
       or new.expires_at > now() + interval '30 days' then
      raise exception 'Valabilitatea invitației trebuie să fie între 1 oră și 30 de zile.'
        using errcode = 'PT400';
    end if;
    new.status      := 'pending';
    new.accepted_at := null;
    new.accepted_by := null;
    new.deleted_at  := null;
    new.invited_by  := coalesce(new.invited_by, auth.uid());
    return new;
  end if;

  /*
   * Acceptarea, venită din `public.accept_invitation`.
   *
   * Se iese ÎNAINTE de fixarea coloanelor de mai jos: `accepted_at` și
   * `accepted_by` trebuie să se schimbe, iar linia care le pinuia pe valorile
   * vechi le-ar fi șters tăcut chiar dacă excepția n-ar fi existat.
   *
   * Restul câmpurilor nu se verifică aici fiindcă funcția care aprinde steagul
   * le-a verificat deja pe toate — sesiune, potrivirea adresei, expirare,
   * apartenență anterioară — sub `for update`, pe rândul blocat.
   */
  if coalesce(current_setting('app.invitation_accept', true), 'off') = 'on'
     and old.status = 'pending'
     and new.status = 'accepted' then
    return new;
  end if;

  /*
   * RETRIMITEREA (0105) — „Invită în aplicație" apăsat a doua oară.
   *
   * Se recunoaște după tokenul schimbat pe un rând care era și rămâne
   * `pending`. Tokenul în clar nu se poate reciti din bază (stă doar ca
   * SHA-256), deci a retrimite ÎNSEAMNĂ a emite altul; un link nou îl scoate
   * din uz pe cel vechi, ceea ce e și comportamentul consolei de platformă.
   *
   * Adresa are voie să se schimbe odată cu el: cazul concret e angajatul
   * înrolat fără e-mail, care a primit o adresă sintetică
   * (`marca-0042@firma.intern`, vezi `src/lib/invitatii/adresa.ts`) și căruia i
   * se completează apoi adresa reală în fișă. Fără asta, retrimiterea ar
   * expedia la nesfârșit către un domeniu rezervat prin RFC 8375, adică nicăieri.
   *
   * Ce NU se poate, aici: să treci starea, să accepți, să ștergi logic, să muți
   * rândul în altă organizație sau să schimbi rolul propus.
   */
  if old.status = 'pending'
     and new.status = 'pending'
     and new.token_hash is distinct from old.token_hash then
    if new.expires_at is null
       or new.expires_at <= now() + interval '1 hour'
       or new.expires_at > now() + interval '30 days' then
      raise exception 'Valabilitatea invitației trebuie să fie între 1 oră și 30 de zile.'
        using errcode = 'PT400';
    end if;
    new.organization_id := old.organization_id;
    new.role            := old.role;
    new.accepted_at     := old.accepted_at;
    new.accepted_by     := old.accepted_by;
    new.created_at      := old.created_at;
    new.deleted_at      := null;
    new.invited_by      := coalesce(new.invited_by, auth.uid());
    return new;
  end if;

  -- Din client, o invitație se poate doar revoca sau șterge logic.
  if new.status is distinct from old.status and new.status <> 'revoked' then
    raise exception 'O invitație se poate doar revoca din interfață.' using errcode = 'PT403';
  end if;
  new.organization_id := old.organization_id;
  new.email           := old.email;
  new.role            := old.role;
  new.token_hash      := old.token_hash;
  new.expires_at      := old.expires_at;
  new.accepted_at     := old.accepted_at;
  new.accepted_by     := old.accepted_by;
  new.created_at      := old.created_at;
  return new;
end;
$$;

-- =====================================================================================
-- 2. Cine are dreptul de a invita, are dreptul de a retrimite ce a invitat
-- =====================================================================================
-- Ramura `users:update = all` rămâne octet cu octet cea din `0002_authz.sql`, în
-- ambele clauze. `with check` NU cerea `deleted_at is null` — și nu cere nici
-- acum, pe acea ramură: ștergerea logică a unei invitații trece prin ea.
--
-- ⚠️ `with check` vede valorile de DUPĂ gardianul BEFORE, nu ce a trimis
-- clientul (capcana 6). De aceea condițiile de mai jos se potrivesc exact cu ce
-- lasă în urmă ramura de retrimitere: `pending`, nedeschisă, neștearsă.

drop policy if exists invitations_update on public.invitations;

create policy invitations_update on public.invitations for update to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and deleted_at is null
  and (
    app.can(organization_id, 'users', 'update', 'all')
    or (
      status = 'pending'
      and role = 'employee'
      and app.can(organization_id, 'employees', 'invite', 'all')
    )
  )
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and (
    app.can(organization_id, 'users', 'update', 'all')
    or (
      status = 'pending'
      and role = 'employee'
      and deleted_at is null
      and accepted_at is null
      and accepted_by is null
      and app.can(organization_id, 'employees', 'invite', 'all')
    )
  )
);

-- =====================================================================================
-- 3. Note de proiectare
-- =====================================================================================
--
-- DE CE NU UN RPC `security definer`. Ar fi fost al treilea drum către aceeași
-- tabelă, după politică și gardian, și primul care nu se citește din
-- `pg_policies`. Aici regula chiar E o regulă de acces, deci stă unde se uită
-- oricine verifică izolarea.
--
-- DE CE NU `createAdminSupabase()` ÎN ACȚIUNE. Ar fi mers — ESLint îl permite în
-- `actions.ts` — și ar fi ocolit ambele straturi dintr-o mișcare. Dar ar fi
-- însemnat că un buton apăsat de `hr` scrie în `invitations` cu `service_role`,
-- adică fără nicio verificare de organizație în afara celei scrise de mână în
-- TypeScript. Consola de platformă face asta fiindcă acolo actorul e
-- administratorul platformei, care n-are `current_org_ids()`; într-o acțiune de
-- tenant, nu.
--
-- CE AR ASCUNDE DEFECTUL LA LOC: o probă care face UPDATE și verifică doar că
-- n-a dat eroare. Gardianul nu dă eroare — repune valoarea veche și lasă
-- comanda să reușească. Proba corectă recitește `token_hash` DUPĂ update și îl
-- compară cu cel trimis. Vezi `tests/rls/proba-retrimitere.sql`.

commit;
