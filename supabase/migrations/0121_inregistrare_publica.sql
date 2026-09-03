-- 0121_inregistrare_publica.sql
--
-- Înregistrare self-serve: o firmă se poate crea singură, fără intervenția unui
-- administrator de platformă.
--
-- ── DE CE O FUNCȚIE, ȘI NU `service_role` DIN APLICAȚIE ─────────────────────
-- Ramura „lasă datele administratorului" din `super-admin/organizatii/nou`
-- făcea deja exact asta, dar prin `createAdminSupabase()` — clientul care
-- ocolește RLS. Expus unei rute publice, ar fi devenit un punct de intrare
-- neautentificat cu drepturi de service_role.
--
-- Doctrina repo-ului e deja scrisă în `createPublicAction`: pe calea publică NU
-- se folosește niciodată `service_role`; scrierea trece printr-o funcție
-- SECURITY DEFINER apelabilă de `anon`, care își scrie singură rândul de audit.
-- Precedentul e `public.submit_demo_request` din 0002_authz.sql, iar funcția de
-- mai jos îi urmează forma pas cu pas.
--
-- ── CE VERIFICĂ E-MAILUL ───────────────────────────────────────────────────
-- Nimic din ce se creează aici nu dă acces. Organizația rămâne în `pending`, iar
-- singura cale înăuntru e invitația, al cărei token pleacă prin e-mail și e
-- stocat DOAR ca hash. Cine nu primește mesajul nu intră. Verificarea adresei nu
-- e un pas separat: e chiar mecanismul.
--
-- ── CE SE POATE ABUZA, ȘI CE FACEM ─────────────────────────────────────────
-- Rămâne posibilă crearea de firme-fantomă în `pending`. Limita e dublă — pe IP
-- (aici) și pe numele acțiunii (în `createPublicAction`) — iar CUI-ul are deja
-- `unique (cui_normalizat)` NEfiltrat pe `deleted_at`, deci același CUI nu se
-- poate înregistra de două ori nici după ștergere. Curățenia rândurilor
-- `pending` neacceptate rămâne o sarcină separată, deliberat neinclusă aici.

begin;

-- ── 1. Poarta din `guard_organizations`, lărgită cu o excepție îngustă ──────
--
-- `internal.guard_organizations()` (0002) refuză ORICE inserare care nu vine din
-- context de serviciu sau de la un administrator de platformă. E o gardă bine
-- făcută: citește GUC-ul `role`, care rămâne `anon` chiar și înăuntrul unei
-- funcții SECURITY DEFINER, tocmai ca să nu poată fi păcălită de proprietar.
--
-- Descoperit rulând, nu citind: prima versiune a funcției de mai jos pica pe ea,
-- deși tot raționamentul spunea că merge.
--
-- ── DE CE UN GUC, ȘI DE CE NU E DE AJUNS ───────────────────────────────────
-- Steagul se aprinde cu `set_config(..., true)` — LOCAL, deci se stinge la
-- sfârșitul tranzacției — și se stinge explicit imediat după inserare, ca
-- fereastra să acopere exact un rând.
--
-- Un GUC singur ar fi o parolă. De aceea excepția fixează și FORMA rândului:
-- `pending`, `trial`, fără proprietar, nesters. Chiar dacă cineva ar reuși să
-- aprindă steagul — iar `anon` n-are niciun grant pe tabelă, iar `authenticated`
-- nu poate rula `set local` prin PostgREST — tot ce ar putea crea e exact ce
-- creează oricum apelând funcția publică. Excepția nu adaugă nicio putere pe
-- care poarta publică n-o dă deja.
create or replace function internal.guard_organizations()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if app.is_service_context() or (select app.is_platform_admin()) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Singura cale prin care o firmă se poate crea singură. Steagul e pus de
    -- `public.inregistreaza_organizatie`, iar forma rândului e verificată aici,
    -- nu acolo: o gardă care se bazează pe buna-credință a apelantului nu e gardă.
    if coalesce(current_setting('app.inregistrare_publica', true), '') = 'on'
       and new.status = 'pending'
       and new.plan = 'trial'
       and new.created_by is null
       and new.deleted_at is null then
      return new;
    end if;

    raise exception 'Organizațiile se creează exclusiv din Super-Admin.'
      using errcode = 'PT403';
  end if;

  -- Coloanele rezervate platformei se readuc la valoarea veche în loc să se
  -- refuze update-ul: un org_admin poate trimite `select('*')` înapoi, iar un
  -- GRANT pe coloane ar sparge PostgREST. Rezultatul e identic ca securitate.
  new.id                  := old.id;
  new.slug                := old.slug;
  new.cui                 := old.cui;
  new.plan                := old.plan;
  new.seats_limit         := old.seats_limit;
  new.subscription_status := old.subscription_status;
  new.trial_ends_at       := old.trial_ends_at;
  new.status              := old.status;
  new.activated_at        := old.activated_at;
  new.suspended_at        := old.suspended_at;
  new.suspended_reason    := old.suspended_reason;
  new.deleted_at          := old.deleted_at;
  new.created_at          := old.created_at;
  return new;
end;
$$;

-- ── 2. Funcția de înregistrare ──────────────────────────────────────────────
--
-- Tokenul NU se generează aici. Aplicația îl produce cu `generateazaToken()`,
-- trimite doar `sha256`-ul lui, iar valoarea în clar pleacă prin e-mail și nu
-- atinge niciodată baza. Aceeași împărțire ca la invitațiile din consolă.
create or replace function public.inregistreaza_organizatie(
  p_firma      text,
  p_cui        text,
  p_nume       text,
  p_prenume    text,
  p_email      text,
  p_token_hash text,
  p_expira_la  timestamptz,
  p_telefon    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
  -- ── Limitare de rată, înaintea oricărei validări ──────────────────────────
  -- Trei firme pe oră de pe același IP. Mai strict decât cererea de demo (care
  -- doar scrie un rând), fiindcă aici se creează o organizație cu module active.
  -- Fără IP — curl direct, job — cădem pe o cheie comună, deliberat mai strictă.
  if not internal.rate_limit_hit(
       'inregistrare:' || coalesce(host(v_ip), 'fara-ip'), 3, interval '1 hour') then
    perform app.write_audit('rate_limited', null, 'organizations', null, null, null,
                            'denied', 'PT429');
    raise exception 'Prea multe înregistrări de la aceeași adresă. Încearcă din nou peste o oră.'
      using errcode = 'PT429';
  end if;

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
$$;

comment on function public.inregistreaza_organizatie(text, text, text, text, text, text, timestamptz, text)
  is 'Înregistrare self-serve. Apelabilă de anon. Organizația rămâne în pending; accesul vine exclusiv din invitația trimisă pe e-mail.';

-- ── 3. Granturi ─────────────────────────────────────────────────────────────
-- Aceeași coadă ca la `submit_demo_request`: se revocă de la `public` (rolul
-- implicit, care include tot), apoi se dă explicit celor care au voie.
revoke execute on function public.inregistreaza_organizatie(text, text, text, text, text, text, timestamptz, text) from public;
grant execute on function public.inregistreaza_organizatie(text, text, text, text, text, text, timestamptz, text)
  to anon, authenticated, service_role;

commit;

-- ── NOTE DE PROIECTARE ──────────────────────────────────────────────────────
--
-- 1. NICIO TABELĂ NOUĂ, deci nici RLS, nici trio de politici, nici indexuri.
--    Migrarea adaugă o singură funcție peste tabele care au deja tot ce trebuie
--    (`organizations`, `organization_features`, `invitations` din 0001/0002).
--    Secțiunile din scheletul canonic care lipsesc lipsesc fiindcă n-au obiect.
--
-- 2. `security definer` + `set search_path = ''` — obligatorii împreună. Fără al
--    doilea, o funcție definer poate fi păcălită să rezolve un nume de tabelă
--    într-o schemă controlată de apelant. De aceea fiecare referință de mai sus
--    e calificată complet, inclusiv `extensions.citext` și `internal.*`.
--
-- 3. TOKENUL NU SE GENEREAZĂ ÎN BAZĂ. Aplicația trimite doar hash-ul; valoarea
--    în clar pleacă prin e-mail și nu atinge Postgres. Dacă baza ar genera
--    tokenul, ar trebui să-l și întoarcă — și atunci ar exista într-un log de
--    interogări, într-un backup și în răspunsul PostgREST.
--
-- 4. ACTORUL E NULL, ȘI E CORECT. `created_by` și `invited_by` rămân goale: nu
--    există utilizator. Auditul păstrează IP-ul și user-agentul prin
--    `app.write_audit`, care le citește singur din antetele cererii.
--
-- 5. CE NU FACE, DELIBERAT: nu curăță organizațiile `pending` neacceptate. E o
--    sarcină de întreținere separată, cu propriile praguri (câte zile? se șterge
--    logic sau fizic? ce se întâmplă cu CUI-ul, care rămâne blocat prin
--    `unique (cui_normalizat)` NEfiltrat pe `deleted_at`?). Scrisă în grabă aici,
--    ar fi fost o ștergere automată fără nimeni care să-i fi ales regulile.
