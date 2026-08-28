-- 0094_invitatie_acceptarea_trece_de_gardian.sql
--
-- Invitația nu se putea accepta. NICIODATĂ, de nimeni, de la prima livrare.
--
-- ── CE SE ÎNTÂMPLA ──────────────────────────────────────────────────────────
-- `public.accept_invitation` face, în ordine: verifică sesiunea, adresa,
-- expirarea, inserează rândul în `organization_members`, apoi marchează
-- invitația drept `accepted`. Ultimul pas lovea în triggerul
-- `internal.guard_invitations`:
--
--     ERROR:  O invitație se poate doar revoca din interfață.
--     CONTEXT: PL/pgSQL function internal.guard_invitations() line 26 at RAISE
--       SQL statement "update public.invitations set status = 'accepted' ..."
--       PL/pgSQL function public.accept_invitation(text) line 67
--
-- Excepția anula TOATĂ tranzacția, deci și rândul de membru inserat cu zece
-- linii mai sus. Rezultatul văzut de om: „Invitația nu mai este validă", iar în
-- bază — invitație rămasă `pending`, zero membri. Exact starea în care era
-- Wiselearning S.R.L.: un cont creat și confirmat, invitație validă, și nicio
-- apartenență.
--
-- ── DE CE N-A PRINS-O NIMIC ─────────────────────────────────────────────────
-- `accept_invitation` e `security definer`, deci ocolește RLS. Dar un TRIGGER
-- se declanșează oricum — e capcana scrisă în `capcane.md` ca „WITH CHECK peste
-- triggerul BEFORE", aici în varianta ei cea mai tăcută: gardianul nu apăra
-- împotriva unui abuz, ci împotriva propriei funcții legitime a aplicației.
--
-- `app.is_service_context()` nu ajută: JWT-ul e al utilizatorului INVITAT, nu
-- al rolului de serviciu. `security definer` schimbă drepturile, nu identitatea.
--
-- ── CUM SE REPARĂ ───────────────────────────────────────────────────────────
-- Cu tiparul deja folosit în proiect pentru exact aceeași problemă:
-- `internal.cursuri_protejeaza_inrolarea` (0075) își recunoaște propria
-- recalculare printr-un `set_config(..., is_local => true)`. La fel aici.
--
-- Poarta e îngustă din trei direcții deodată:
--   1. steagul e TRANZACȚIONAL (`is_local => true`) și se stinge imediat după
--      instrucțiunea care are nevoie de el;
--   2. singurul loc care îl aprinde e `accept_invitation`, iar PostgREST nu
--      expune `set_config` — nu există drum din client către el;
--   3. tranziția permisă e exact una: `pending` → `accepted`. Orice altceva
--      cade tot pe „se poate doar revoca".

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Gardianul își recunoaște propria acceptare
-- ═══════════════════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. `accept_invitation` aprinde steagul, strict pe durata unei instrucțiuni
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.accept_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_user   record;
  v_inv    record;
  v_membru record;
  v_id     uuid;
  v_org    text;
begin
  if v_uid is null then
    raise exception 'Trebuie să fii autentificat pentru a accepta invitația.' using errcode = 'PT401';
  end if;

  select u.email, u.email_confirmed_at into v_user from auth.users u where u.id = v_uid;
  if v_user.email_confirmed_at is null then
    raise exception 'Confirmă mai întâi adresa de e-mail, apoi acceptă invitația.'
      using errcode = 'PT403';
  end if;

  select * into v_inv
  from public.invitations i
  where i.token_hash = internal.sha256_hex(btrim(coalesce(p_token, '')))
    and i.deleted_at is null
  for update;

  if not found then
    raise exception 'Invitație inexistentă sau deja folosită.' using errcode = 'PT404';
  end if;

  if v_inv.status <> 'pending' then
    raise exception 'Invitația a fost deja folosită sau revocată.' using errcode = 'PT409';
  end if;

  if v_inv.expires_at <= now() then
    perform set_config('app.invitation_accept', 'off', true);
    update public.invitations set status = 'expired' where id = v_inv.id;
    perform app.write_audit('invite_accepted', v_inv.organization_id, 'invitations', v_inv.id,
                            null, null, 'denied', 'PT410');
    raise exception 'Invitația a expirat. Cere una nouă administratorului.' using errcode = 'PT410';
  end if;

  if lower(v_user.email::text) <> lower(v_inv.email::text) then
    perform app.write_audit('invite_accepted', v_inv.organization_id, 'invitations', v_inv.id,
                            null, null, 'denied', 'PT403');
    raise exception 'Invitația este emisă pentru altă adresă de e-mail.' using errcode = 'PT403';
  end if;

  select * into v_membru
  from public.organization_members m
  where m.organization_id = v_inv.organization_id and m.user_id = v_uid;

  if found then
    if v_membru.deleted_at is not null or v_membru.status in ('inactive', 'suspended') then
      perform app.write_audit('invite_accepted', v_inv.organization_id, 'organization_members',
                              v_membru.id, null, null, 'denied', 'PT409');
      raise exception 'Ai avut anterior acces la această organizație. Este necesară reînrolarea manuală de către un administrator.'
        using errcode = 'PT409';
    end if;
    raise exception 'Ești deja membru al acestei organizații.' using errcode = 'PT409';
  end if;

  insert into public.organization_members
    (organization_id, user_id, role, status, invited_by, invitation_id, created_by, updated_by)
  values
    (v_inv.organization_id, v_uid, v_inv.role, 'active', v_inv.invited_by, v_inv.id, v_uid, v_uid)
  returning id into v_id;

  -- Steagul se aprinde IMEDIAT înainte de instrucțiunea care are nevoie de el
  -- și se stinge imediat după. `is_local => true` îl leagă oricum de tranzacție,
  -- dar fereastra rămâne cât o singură instrucțiune.
  perform set_config('app.invitation_accept', 'on', true);
  update public.invitations
     set status = 'accepted', accepted_at = now(), accepted_by = v_uid, updated_by = v_uid
   where id = v_inv.id;
  perform set_config('app.invitation_accept', 'off', true);

  update public.profiles
     set last_organization_id = v_inv.organization_id,
         full_name = coalesce(profiles.full_name, nullif(btrim(coalesce(v_inv.prenume, '') || ' ' || coalesce(v_inv.nume, '')), '')),
         phone = coalesce(profiles.phone, v_inv.telefon)
   where id = v_uid;

  select o.name into v_org from public.organizations o where o.id = v_inv.organization_id;

  perform app.write_audit('invite_accepted', v_inv.organization_id, 'invitations', v_inv.id);
  perform app.write_audit('member_added', v_inv.organization_id, 'organization_members', v_id);

  return jsonb_build_object(
    'organization_id', v_inv.organization_id,
    'organization_name', v_org,
    'member_id', v_id
  );
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Drepturi
-- ═══════════════════════════════════════════════════════════════════════════

-- `create or replace` pe aceeași semnătură și același tip de retur păstrează
-- granturile. Se repetă oricum, ca migrarea să se citească singură.
revoke execute on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated;
