-- supabase/migrations/0145_marginea_platformei.sql
--
-- CE POATE FACE CINEVA FĂRĂ CONT, DIRECT PE API.
--
-- ── DE UNDE VINE MIGRAREA ───────────────────────────────────────────────────
-- Lotul 2 din auditul „atinge frontendul baza direct?"
-- (`docs/audit-frontend-baza-2026-09-21.md`). Lotul 1 (0144) a închis ieșirile
-- dintre firme. Aici e marginea dinspre lumea din afară: cele trei funcții pe
-- care `anon` le poate chema direct, cu un `curl`, fără niciun cont.
--
-- ── (F02) ÎNREGISTRAREA PUBLICĂ ÎȘI ALEGE SINGURĂ TOKENUL ───────────────────
-- `public.inregistreaza_organizatie` primește `p_token_hash` de la apelant și
-- creează invitația cu el. Server Action-ul generează tokenul și trimite doar
-- hash-ul — corect. Dar funcția e apelabilă de `anon`, deci oricine poate
-- trimite un hash al cărui token îl cunoaște, pentru ORICE adresă de e-mail,
-- apoi poate deschide `/invitatie/<token>` și își alege parola. Rezultatul e un
-- cont CONFIRMAT (`email_confirm: true`, `invitatie/[token]/actions.ts`) pe o
-- adresă pe care n-o controlează. Dovada de proprietate a e-mailului — singurul
-- lucru pe care se sprijină tot fluxul, scris negru pe alb în comentariul
-- acțiunii — nu există.
--
-- Nu există variantă sigură în care funcția rămâne apelabilă de `anon` ȘI
-- acceptă hash-ul de la apelant. Deci nu mai e apelabilă de `anon`: o cheamă
-- Server Action-ul, cu `service_role`, după limitarea lui de rată.
--
-- ── (F27) LIMITAREA DE RATĂ DIN BAZĂ NU LIMITA NIMIC ────────────────────────
-- Două defecte suprapuse, ambele măsurate pe 21 sept 2026:
--
--   1. IP-UL ERA AL NOSTRU. `internal.request_ip()` citește antetul
--      `x-forwarded-for` al cererii care ajunge la PostgREST. Funcțiile astea au
--      fost mereu chemate din Server Actions, adică de pe SERVERUL nostru — deci
--      cheia era aceeași pentru toți vizitatorii. „3 firme pe oră de pe același
--      IP" însemna, de fapt, 3 firme pe oră pe toată platforma. Iar un apelant
--      direct, care-și alege singur `x-forwarded-for`, n-avea nicio limită.
--
--   2. NUMĂRĂTOAREA SE PIERDEA LA EȘEC. `internal.rate_limit_hit` scrie în
--      `rate_limits` în ACEEAȘI tranzacție din care funcția apoi aruncă
--      (PT404/PT400/PT409). Postgres derulează înapoi și scrierea contorului.
--      Probat pe banc: după un `peek_invitation` cu token inexistent,
--      `select count(*) from rate_limits where key like 'invit:%'` = 0. Un
--      limitator care numără doar reușitele nu apără de ghicit.
--
-- Limita adevărată e cea din `createPublicAction` / pagina de invitație: cheie
-- pe IP-ul verificat din antetele cererii HTTP, scrisă prin `consume_rate_limit`
-- într-o tranzacție proprie, care nu se derulează înapoi.
--
-- ── (F21) GRANTURILE MOȘTENITE ─────────────────────────────────────────────
-- Pe producție, `anon` are ALL (inclusiv TRUNCATE) pe 24 de tabele din `public`
-- și `authenticated` are TRUNCATE pe 132 — privilegii implicite de platformă
-- Supabase, pe tabelele create înainte ca migrările să-și revoce ce trebuie.
-- Azi nu sunt exploatabile (toate cele 445 de politici sunt `to authenticated`,
-- PostgREST nu expune TRUNCATE), dar TRUNCATE ignoră RLS, iar o singură politică
-- scrisă fără `TO` ar deschide o tabelă pentru `anon`. Se curăță, și se închide
-- și robinetul: `alter default privileges`.
--
-- ── CE NU ATINGE, DELIBERAT ─────────────────────────────────────────────────
-- 1. `peek_invitation` RĂMÂNE apelabilă de `anon`: pagina de invitație e
--    singurul ecran care citește legitim fără sesiune, iar tokenul de 32 de
--    octeți face ghicitul imposibil. Se schimbă doar felul în care refuză —
--    `return {"gasit": false}` în loc de `raise` — ca numărătoarea să nu se mai
--    deruleze înapoi. Pagina tratează deja orice răspuns neconform ca invitație
--    invalidă (`peekSchema.safeParse`), deci nu vede diferența.
-- 2. ÎNSCRIEREA PUBLICĂ DIN GOTRUE (F24) nu se poate opri din SQL: e un comutator
--    din tabloul de bord Supabase („Allow new users to sign up"). `config.toml`
--    de mai jos spune ce trebuie să fie, dar producția se schimbă cu mâna.
-- 3. `internal.rate_limit_hit` NU se schimbă. Proprietatea „se derulează înapoi
--    cu tranzacția" e corectă pentru apelantul care O FOLOSEȘTE CUM TREBUIE
--    (`consume_rate_limit`, chemat separat, înainte de lucrul propriu-zis).
--    Comentariul de mai jos o scrie, ca să n-o redescopere altcineva.

begin;

-- ── 1. Înregistrarea publică: fără limitator fals, fără `anon` ─────────────
CREATE OR REPLACE FUNCTION public.inregistreaza_organizatie(p_firma text, p_cui text, p_nume text, p_prenume text, p_email text, p_token_hash text, p_expira_la timestamp with time zone, p_telefon text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ip       inet := internal.request_ip();
  v_email    text := lower(btrim(coalesce(p_email, '')));
  v_firma    text := btrim(coalesce(p_firma, ''));
  v_cui      text := btrim(coalesce(p_cui, ''));
  v_baza     text;
  v_slug     text;
  v_org      uuid;
  v_inv      uuid;
  i          integer;
begin
  -- ── Limitarea de rată NU mai e aici ───────────────────────────────────────
  -- Stătea pe primul rând al funcției și număra 3 firme/oră pe `internal.request_ip()`.
  -- Două motive pentru care a plecat, ambele măsurate (vezi 0145, antet):
  --   * IP-ul pe care îl vedea era al SERVERULUI nostru, nu al vizitatorului —
  --     funcția a fost mereu chemată din Server Action, nu din browser. Adică
  --     o singură găleată pentru toată platforma: a patra firmă dintr-o oră era
  --     refuzată, oricine ar fi fost ea.
  --   * numărătoarea se pierdea la orice eșec: `rate_limit_hit` scrie în aceeași
  --     tranzacție pe care un `raise` de mai jos o derulează înapoi.
  -- Limita reală e în `createPublicAction` (3/oră), pe IP-ul verificat din
  -- antetele cererii, scrisă cu `consume_rate_limit` într-o tranzacție proprie.
  -- Funcția asta nu mai e apelabilă de `anon`, deci nu se poate ajunge la ea
  -- decât prin acțiunea aia.

  -- ── Validare ──────────────────────────────────────────────────────────────
  -- Aceleași reguli ca `organizations_cui_ck` din 0001, verificate ÎNAINTE de
  -- insert: un 23514 ajunge la vizitator ca „Datele nu respectă regulile de
  -- validare”, care nu-i spune nimic despre ce anume a greșit.
  if char_length(v_firma) not between 2 and 200
     or char_length(btrim(coalesce(p_nume, ''))) not between 2 and 120
     or char_length(btrim(coalesce(p_prenume, ''))) not between 2 and 120
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or (p_telefon is not null and char_length(btrim(p_telefon)) not between 6 and 32) then
    raise exception 'Datele trimise nu sunt valide. Verifică numele firmei, numele tău și adresa de e-mail.'
      using errcode = 'PT400';
  end if;

  if v_cui !~* '^\s*(RO)?\s*[0-9]{2,10}\s*$' then
    raise exception 'CUI-ul nu are forma corectă. Se scriu doar cifrele, cu sau fără prefixul RO.'
      using errcode = 'PT400';
  end if;

  -- ── Identificatorul firmei ────────────────────────────────────────────────
  -- Se generează AICI, nu se primește de la client: e vizibil în adrese și e
  -- pregătirea pentru subdomenii, deci nu poate fi ales de un necunoscut.
  --
  -- `translate` peste diacriticele românești, nu `unaccent`: extensia n-ar mai
  -- fi o dependență, iar setul de litere care contează e mic și închis. Se
  -- acoperă și variantele cu sedilă (ş, ţ), fiindcă lumea le tastează.
  v_baza := lower(v_firma);
  v_baza := translate(v_baza, 'ăâîșțşţ', 'aaistst');
  v_baza := regexp_replace(v_baza, '[^a-z0-9]+', '-', 'g');
  v_baza := btrim(v_baza, '-');
  v_baza := btrim(left(v_baza, 40), '-');
  -- Sub trei caractere, formatul din 0001 respinge rândul. „firma” e un prefix
  -- onest: sufixul numeric de mai jos îl face oricum unic.
  if char_length(v_baza) < 3 then
    v_baza := 'firma';
  end if;

  v_slug := null;
  for i in 1..60 loop
    declare
      v_candidat text := case when i = 1 then v_baza else v_baza || '-' || i::text end;
    begin
      if v_candidat <> all (array['app','www','api','admin','auth','static','cdn','mail','status','docs'])
         and not exists (
           select 1 from public.organizations o
           where o.slug::text = v_candidat and o.deleted_at is null
         ) then
        v_slug := v_candidat;
        exit;
      end if;
    end;
  end loop;

  if v_slug is null then
    raise exception 'Nu am putut genera un identificator pentru firma asta. Scrie-ne și îl alegem împreună.'
      using errcode = 'PT409';
  end if;

  -- ── Organizația ───────────────────────────────────────────────────────────
  -- `status = pending` NU e o formalitate: e starea pe care o citește poarta din
  -- layout-ul aplicației și care îl duce pe administrator în asistentul de
  -- configurare la prima intrare. Activarea E terminarea asistentului.
  --
  -- `created_by` rămâne null — nu există actor. Coloana o permite; auditul
  -- păstrează IP-ul și user-agentul, care e tot ce se știe despre cine a cerut.
  -- Steagul pe care îl citește `internal.guard_organizations`. LOCAL, deci se
  -- stinge oricum la sfârșitul tranzacției — dar se stinge și explicit mai jos,
  -- ca fereastra să acopere exact inserarea asta, nu tot restul funcției.
  perform set_config('app.inregistrare_publica', 'on', true);

  begin
    insert into public.organizations (name, slug, cui, status, plan, seats_limit,
                                      subscription_status)
    values (v_firma, v_slug::extensions.citext, v_cui, 'pending', 'trial', 10, 'trialing')
    returning id into v_org;
  exception when unique_violation then
    perform set_config('app.inregistrare_publica', 'off', true);
    -- `organizations_cui_normalizat_uq`. Mesajul spune ce s-a întâmplat fără să
    -- confirme numele firmei existente: e informație despre un terț.
    raise exception 'Există deja un cont pentru CUI-ul %. Dacă e firma ta, cere-i administratorului o invitație.', v_cui
      using errcode = 'PT409';
  end;

  perform set_config('app.inregistrare_publica', 'off', true);

  -- ── Modulele pornite din prima ──────────────────────────────────────────
  -- NU doar `is_core`. Catalogul marchează drept „core" o singură cheie —
  -- `nucleu` — iar o firmă care intră cu atât n-are nici pontaj, nici concedii,
  -- nici portal. Adică exact ce promite pagina de start: „primul pontaj, în
  -- aceeași zi".
  --
  -- Cele patru de mai jos SUNT pachetul „Nucleu HR" din ofertă, cel de 149 lei:
  -- lista trebuie să rămână identică cu `MODULE_NUCLEU` din
  -- `src/content/landing/preturi.ts`, altfel prima lună gratuită dă altceva
  -- decât s-a vândut. Restul se comută la abonare.
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select v_org, f.feature_key, true, now()
  from public.features f
  where f.is_core = true
     or f.feature_key in ('attendance', 'leave', 'employee_portal');

  -- ── Invitația proprietarului ──────────────────────────────────────────────
  insert into public.invitations (organization_id, email, role, token_hash, expires_at,
                                  status, nume, prenume, telefon)
  values (v_org, v_email::extensions.citext, 'org_admin', p_token_hash, p_expira_la,
          'pending', btrim(p_nume), btrim(p_prenume),
          nullif(btrim(coalesce(p_telefon, '')), ''))
  returning id into v_inv;

  perform app.write_audit('org_created', v_org, 'organizations', v_org, null,
                          jsonb_build_object('name', v_firma, 'slug', v_slug,
                                             'cui', v_cui, 'sursa', 'inregistrare_publica'));
  perform app.write_audit('invite_sent', v_org, 'invitations', v_inv, null,
                          jsonb_build_object('email', v_email, 'role', 'org_admin'));

  return jsonb_build_object(
    'organization_id', v_org,
    'slug', v_slug,
    'invitation_id', v_inv
  );
end;
$function$;

comment on function public.inregistreaza_organizatie(text, text, text, text, text, text, timestamptz, text) is
  'Creează o organizație `pending` plus invitația proprietarului. APELABILĂ DOAR CU service_role, din `inregistrare.firma` (createPublicAction, care limitează pe IP-ul real): funcția primește token_hash de la apelant, deci un apel direct ar însemna cont confirmat pe adresa altcuiva.';

revoke execute on function public.inregistreaza_organizatie(text, text, text, text, text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.inregistreaza_organizatie(text, text, text, text, text, text, timestamptz, text) to service_role;

-- ── 2. Cererea de demo: la fel ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_demo_request(p_nume text, p_firma text, p_email text, p_telefon text DEFAULT NULL::text, p_nr_angajati employee_band DEFAULT NULL::employee_band, p_mesaj text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ip    inet := internal.request_ip();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_id    uuid;
begin
  -- Limitarea de rată a plecat de aici, din aceleași două motive ca la
  -- `inregistreaza_organizatie` (vezi antetul migrării 0145): IP-ul era al
  -- serverului, nu al vizitatorului, iar numărătoarea se pierdea la orice eșec.
  -- Limita reală trăiește în `createPublicAction`, pe IP-ul verificat.

  if char_length(btrim(coalesce(p_nume, ''))) not between 2 and 120
     or char_length(btrim(coalesce(p_firma, ''))) not between 2 and 200
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or char_length(coalesce(p_mesaj, '')) > 2000
     or (p_telefon is not null and char_length(btrim(p_telefon)) not between 6 and 32) then
    raise exception 'Datele trimise nu sunt valide. Verifică numele, firma și adresa de e-mail.'
      using errcode = 'PT400';
  end if;

  begin
    insert into public.demo_requests (nume, firma, email, telefon, nr_angajati, mesaj, ip, user_agent)
    values (
      btrim(p_nume), btrim(p_firma), v_email::extensions.citext,
      nullif(btrim(coalesce(p_telefon, '')), ''), p_nr_angajati,
      nullif(btrim(coalesce(p_mesaj, '')), ''), v_ip,
      left(coalesce(internal.request_header('user-agent'), ''), 500)
    )
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Ai trimis deja o cerere astăzi. Te contactăm în cel mai scurt timp.'
      using errcode = 'PT409';
  end;

  perform app.write_audit('demo_requested', null, 'demo_requests', v_id);
  return v_id;
end;
$function$;

revoke execute on function public.submit_demo_request(text, text, text, text, employee_band, text) from public, anon, authenticated;
grant execute on function public.submit_demo_request(text, text, text, text, employee_band, text) to service_role;

-- ── 3. `peek_invitation`: refuză fără să arunce ───────────────────────────
-- Singura schimbare de comportament: ramura „nu există / nu mai e validă"
-- întoarce `{"gasit": false}` în loc să ridice PT404. Așa, numărătoarea scrisă
-- cu o instrucțiune mai sus RĂMÂNE în `rate_limits` — altfel fiecare încercare
-- greșită își ștergea singură urma. PT429 rămâne excepție: acolo chiar vrem să
-- se vadă un refuz, iar contorul e deja peste prag.
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
    return jsonb_build_object('gasit', false);
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
    return jsonb_build_object('gasit', false);
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

revoke all on function public.peek_invitation(text) from public;
grant execute on function public.peek_invitation(text) to anon, authenticated, service_role;

comment on function internal.rate_limit_hit(text, integer, interval) is
  'Contor de rată în `rate_limits`. ATENȚIE: scrierea trăiește în tranzacția apelantului, deci se DERULEAZĂ ÎNAPOI dacă apelantul aruncă mai târziu — un limitator chemat la începutul unei funcții care apoi ridică excepție numără doar reușitele. Apelul corect e cel din `consume_rate_limit`, dintr-o tranzacție proprie, înainte de lucrul propriu-zis.';

-- ── 4. Granturile moștenite de la platformă ───────────────────────────────
-- `anon` nu are nicio politică în `public` (toate cele 445 sunt `to
-- authenticated`), deci privilegiile lui sunt greutate moartă — cu o excepție
-- care ignoră RLS și de-aia se scoate întâi: TRUNCATE.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- Robinetul: fără asta, următoarea tabelă creată de `postgres` moștenește din
-- nou ALL pentru `anon`, iar curățenia de mai sus e o stare, nu o regulă.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;

commit;
