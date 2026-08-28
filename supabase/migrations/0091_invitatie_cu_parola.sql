-- 0091_invitatie_cu_parola.sql
--
-- Invitația devine autonomă: destinatarul primește UN singur e-mail (prin
-- Resend), deschide linkul, își pune parola și are cont. Fără al doilea mesaj
-- de la mailerul Supabase, fără link magic, fără drum prin `localhost`.
--
-- ── DE CE E NEVOIE DE MIGRARE ───────────────────────────────────────────────
-- 1. `accept_invitation` returna `uuid`, iar aplicația parsa un OBIECT cu
--    `organization_id` și `organization_name` (`invitatie/[token]/actions.ts`).
--    `safeParse` pica ÎNTOTDEAUNA, deci ultimul pas al invitației răspundea
--    „Invitația nu mai este validă" — după ce inserase deja rândul de membru.
--    A doua încercare lovea PT409 („Ești deja membru"), tradus tot în același
--    mesaj. Fluxul era mort din interfață, în ambele sensuri.
--
--    Se repară CONTRACTUL, nu apelantul: funcția întoarce acum exact obiectul
--    pe care aplicația îl aștepta de la început. `v_id` rămâne în audit, unde
--    chiar contează.
--
-- 2. `peek_invitation` refuza — corect — să dea adresa invitată, ca tokenul să
--    nu devină oracol. Dar noua pagină trebuie să arate CUI îi aparține contul
--    care se creează, iar formularul diferă după cum adresa are deja cont sau
--    nu. Soluția e mijlocul: adresa MASCATĂ (`mal•••@gmail.com`) plus un
--    boolean. Un token scurs confirmă o adresă pe care oricum a primit-o, dar
--    nu livrează una nouă.
--
-- Fără politici, fără tabele: doar două funcții înlocuite.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Mascarea adresei
-- ═══════════════════════════════════════════════════════════════════════════

-- `internal`, nu `public`: nimeni din afară n-are ce chema aici.
create or replace function internal.mascheaza_email(p_email text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_local  text;
  v_domeniu text;
  v_at     integer;
begin
  if coalesce(btrim(p_email), '') = '' then
    return '';
  end if;

  v_at := position('@' in p_email);
  if v_at = 0 then
    -- Nu e o adresă; nu inventăm o mască plauzibilă pentru ceva ce nu e adresă.
    return '•••';
  end if;

  v_local   := left(p_email, v_at - 1);
  v_domeniu := substring(p_email from v_at);

  -- Sub patru caractere, chiar și trei litere ar fi aproape toată partea
  -- locală: se arată una singură. `ab@x.ro` devine `a•••@x.ro`, nu `ab•••@x.ro`.
  if length(v_local) <= 3 then
    return left(v_local, 1) || '•••' || v_domeniu;
  end if;

  return left(v_local, 3) || '•••' || v_domeniu;
end;
$$;

comment on function internal.mascheaza_email(text) is
  'Adresa redusă la primele câteva caractere + domeniu, pentru ecranul public de invitație.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. `peek_invitation` — plus adresa mascată și existența contului
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.peek_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ip   inet := internal.request_ip();
  v_rec  record;
  v_cont boolean;
begin
  if not internal.rate_limit_hit('invit:' || coalesce(host(v_ip), 'fara-ip'), 20, interval '1 hour') then
    raise exception 'Prea multe încercări. Încearcă din nou mai târziu.' using errcode = 'PT429';
  end if;

  if coalesce(btrim(p_token), '') = '' then
    raise exception 'Invitație inexistentă sau deja folosită.' using errcode = 'PT404';
  end if;

  select o.name as org_name, i.expires_at, i.status, i.email
    into v_rec
  from public.invitations i
  join public.organizations o on o.id = i.organization_id
  where i.token_hash = internal.sha256_hex(btrim(p_token))
    and i.deleted_at is null
    and i.status in ('pending', 'expired')
    and o.deleted_at is null;

  if not found then
    raise exception 'Invitație inexistentă sau deja folosită.' using errcode = 'PT404';
  end if;

  -- Decide care formular se arată: parolă nouă, sau „aveți deja cont,
  -- autentificați-vă". Fără asta, pagina ar cere o parolă pentru un cont care
  -- există deja, iar crearea ar eșua abia la server.
  select exists(
    select 1 from auth.users u where lower(u.email) = lower(v_rec.email)
  ) into v_cont;

  -- Adresa COMPLETĂ nu iese niciodată de aici; rolul, la fel. Masca arată cui
  -- îi aparține contul fără să transforme tokenul într-un oracol de adrese.
  return jsonb_build_object(
    'organization_name', v_rec.org_name,
    'expired', (v_rec.status = 'expired' or v_rec.expires_at <= now()),
    'email_mascat', internal.mascheaza_email(v_rec.email),
    'are_cont', v_cont
  );
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. `accept_invitation` — întoarce obiectul pe care aplicația îl aștepta
-- ═══════════════════════════════════════════════════════════════════════════

-- `create or replace` NU poate schimba tipul de retur: Postgres refuză cu
-- „cannot change return type of existing function". Vechea semnătură returna
-- `uuid`, deci funcția se șterge întâi. Granturile pleacă odată cu ea și se
-- rescriu în secțiunea 5.
drop function if exists public.accept_invitation(text);

create function public.accept_invitation(p_token text)
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

  update public.invitations
     set status = 'accepted', accepted_at = now(), accepted_by = v_uid, updated_by = v_uid
   where id = v_inv.id;

  update public.profiles
     set last_organization_id = v_inv.organization_id,
         full_name = coalesce(profiles.full_name, nullif(btrim(coalesce(v_inv.prenume, '') || ' ' || coalesce(v_inv.nume, '')), '')),
         phone = coalesce(profiles.phone, v_inv.telefon)
   where id = v_uid;

  select o.name into v_org from public.organizations o where o.id = v_inv.organization_id;

  perform app.write_audit('invite_accepted', v_inv.organization_id, 'invitations', v_inv.id);
  perform app.write_audit('member_added', v_inv.organization_id, 'organization_members', v_id);

  -- `member_id` rămâne în răspuns: e ce returna funcția înainte, iar cine se
  -- baza pe el nu se rupe. Noutatea sunt celelalte două chei — cele pe care
  -- aplicația le citea deja, fără ca funcția să le fi trimis vreodată.
  return jsonb_build_object(
    'organization_id', v_inv.organization_id,
    'organization_name', v_org,
    'member_id', v_id
  );
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. `email_log.template` acceptă cratima
-- ═══════════════════════════════════════════════════════════════════════════

-- Constrângerea cerea `^[a-z][a-z0-9_]{1,63}$` — doar liniuță JOS. Patru din
-- cele șase chei de șablon ale proiectului au cratimă: `resetare-parola`,
-- `bun-venit`, `cerere-demo-primita` și noul `link-magic`. Orice încercare de
-- a le înregistra pica pe constrângere, `insereazaLog` întorcea `null`, iar
-- `sendEmail` se oprea cu „baza_de_date" — fără să trimită nimic.
--
-- Cheile sunt vocabularul proiectului: apar în interfața de platformă, în
-- webhook și în teste. Se lărgește constrângerea, nu se redenumesc cheile.
-- Restul formei rămâne: literă mică la început, fără spații, fără majuscule.
alter table public.email_log drop constraint if exists email_log_template_check;
alter table public.email_log
  add constraint email_log_template_check
  check (template ~ '^[a-z][a-z0-9_-]{1,63}$');

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Drepturi
-- ═══════════════════════════════════════════════════════════════════════════

-- `accept_invitation` a fost ȘTEARSĂ și recreată (secțiunea 3), deci și-a
-- pierdut granturile. Le repetăm și pe ale lui `peek_invitation`, ca migrarea
-- să se citească singură.
revoke execute on function public.peek_invitation(text) from public;
revoke execute on function public.accept_invitation(text) from public, anon;
revoke execute on function internal.mascheaza_email(text) from public, anon, authenticated;

grant execute on function public.peek_invitation(text) to anon, authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
