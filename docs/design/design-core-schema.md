## Enum-uri Postgres introduse

```
app_role                : super_admin | org_admin | manager | hr | employee
organization_status     : in_asteptare | activa | suspendata | arhivata
plan_type               : start | standard | business | enterprise
subscription_status_type: trial | activ | restant | anulat | expirat
member_status           : invitat | activ | suspendat | plecat
invitation_status       : trimisa | acceptata | expirata | revocata
feature_group           : nucleu | operational | resurse_umane | financiar | comunicare
audit_action            : creare | actualizare | stergere_logica | restaurare | autentificare | delogare | export | citire_sensibila | schimbare_rol | comutare_modul | impersonare | eroare_sistem
notification_kind       : sistem | informare | avertisment | aprobare_ceruta | aprobare_rezolvata | expirare_document | atribuire | mentiune
notification_priority   : scazuta | normala | ridicata | critica
notification_digest     : imediat | zilnic | saptamanal | niciodata
locale_code             : ro | en
demo_request_status     : nou | contactat | calificat | demo_programat | convertit | respins
employee_band           : sub_10 | b10_49 | b50_99 | b100_249 | b250_500 | peste_500
permission_scope        : toate | echipa | proprii | niciunul
```

**Exceptii de la conventiile implicite** (o singura data): `audit_logs` este append-only (fara `updated_at`, `updated_by`, `deleted_at`); `profiles`, `features`, `demo_requests` NU au `organization_id` (sunt globale/pre-tenant); `role_permissions` are `organization_id` NULL-abil (rand global = implicit de platforma).

---

### organizations
scop: firma-client, unitatea de izolare a intregului sistem.
coloane:
```
  id uuid PK DEFAULT gen_random_uuid()
  slug citext NOT NULL
  denumire text NOT NULL
  denumire_legala text NOT NULL
  forma_juridica text
  cui text NOT NULL
  cui_normalizat text GENERATED ALWAYS AS (regexp_replace(upper(cui),'[^0-9]','','g')) STORED
  platitor_tva boolean NOT NULL DEFAULT false
  reg_com text
  adresa text
  judet text NOT NULL
  oras text NOT NULL
  cod_postal text
  tara char(2) NOT NULL DEFAULT 'RO'
  email_contact citext
  telefon_contact text
  website text
  reprezentant_legal text
  status organization_status NOT NULL DEFAULT 'in_asteptare'
  plan plan_type NOT NULL DEFAULT 'start'
  seats_limit integer NOT NULL DEFAULT 10
  subscription_status subscription_status_type NOT NULL DEFAULT 'trial'
  trial_ends_at timestamptz
  timezone text NOT NULL DEFAULT 'Europe/Bucharest'
  locale locale_code NOT NULL DEFAULT 'ro'
  moneda char(3) NOT NULL DEFAULT 'RON'
  activated_at timestamptz
  suspended_at timestamptz
  suspended_reason text
```
constrangeri: `UNIQUE(slug) WHERE deleted_at IS NULL`; `UNIQUE(cui_normalizat) WHERE deleted_at IS NULL`; `CHECK(slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$')`; `CHECK(slug NOT IN ('app','www','api','admin','auth','static','cdn','mail','status','docs'))`; `CHECK(seats_limit BETWEEN 1 AND 5000)`; `CHECK(length(cui_normalizat) BETWEEN 2 AND 10)`; `CHECK(subscription_status <> 'trial' OR trial_ends_at IS NOT NULL)`; `CHECK(status <> 'suspendata' OR suspended_at IS NOT NULL)`
indexuri: `(status) WHERE deleted_at IS NULL`; `(subscription_status, trial_ends_at) WHERE deleted_at IS NULL`; `(cui_normalizat)`
rls: SELECT = membru activ al organizatiei sau platform admin; INSERT/DELETE = doar platform admin; UPDATE = platform admin (orice coloana) sau org_admin (doar coloane de profil firma — plan/seats_limit/subscription_status/status blocate prin trigger).
nota: `slug` este pregatirea pentru subdomenii; `resolveTenant()` il citeste, dar azi tenantul vine din comutatorul din topbar. `judet` ramane text pana la nomenclatorul SIRUTA din modulul de configurari (principiul 7) — atunci devine FK.

### organization_branding
scop: identitatea vizuala per firma, 1:1 cu organizatia.
coloane:
```
  organization_id uuid PK FK->organizations(id) RESTRICT
  denumire_afisata text
  primary_color text NOT NULL DEFAULT '#0F172A'
  secondary_color text NOT NULL DEFAULT '#64748B'
  accent_color text NOT NULL DEFAULT '#2563EB'
  logo_light_path text
  logo_dark_path text
  favicon_path text
  email_header_path text
  email_footer_text text
```
constrangeri: `CHECK(primary_color ~* '^#[0-9a-f]{6}$')` (idem secondary, accent)
indexuri: implicit prin PK
rls: SELECT = membru activ al organizatiei sau platform admin; INSERT/UPDATE = org_admin sau platform admin; DELETE = nimeni (soft delete pe organizatie).
nota: doar cai (`path`) din bucket-ul Storage `branding`, nu URL-uri publice — semnarea se face server-side; bucket-ul are politici pe prefix `orgId/`.

### profiles
scop: extinde `auth.users` cu date de utilizator valabile transversal, peste toate organizatiile.
coloane:
```
  id uuid PK FK->auth.users(id) ON DELETE CASCADE
  email citext NOT NULL
  full_name text
  avatar_path text
  phone text
  locale locale_code NOT NULL DEFAULT 'ro'
  timezone text NOT NULL DEFAULT 'Europe/Bucharest'
  is_platform_admin boolean NOT NULL DEFAULT false
  last_seen_at timestamptz
  last_organization_id uuid FK->organizations(id) ON DELETE SET NULL
  onboarding_completed_at timestamptz
```
constrangeri: `UNIQUE(email) WHERE deleted_at IS NULL`; `CHECK(phone IS NULL OR phone ~ '^\+?[0-9 ().-]{7,20}$')`
indexuri: `(email)`; `(is_platform_admin) WHERE is_platform_admin`
rls: SELECT = propriul profil, profilurile utilizatorilor cu care imparti cel putin o organizatie, platform admin; INSERT = doar trigger-ul SECURITY DEFINER de la signup; UPDATE = propriul profil (fara `is_platform_admin`, `email`) sau platform admin; DELETE = nimeni.
nota: `is_platform_admin` e singura sursa de adevar pentru super_admin. NU deriva din `organization_members`. Blocheaza coloana printr-un trigger BEFORE UPDATE care revine la valoarea veche daca `auth.uid()` nu e deja platform admin — o politica RLS nu poate restrictiona coloane.

### organization_members
scop: apartenenta unui utilizator la o organizatie, cu rolul din acea organizatie.
coloane:
```
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  user_id uuid NOT NULL FK->profiles(id) ON DELETE CASCADE
  role app_role NOT NULL DEFAULT 'employee'
  status member_status NOT NULL DEFAULT 'invitat'
  job_title text
  joined_at timestamptz
  invited_by uuid FK->profiles(id) ON DELETE SET NULL
  invitation_id uuid FK->invitations(id) ON DELETE SET NULL
  deactivated_at timestamptz
  deactivated_by uuid
```
constrangeri: `UNIQUE(organization_id, user_id) WHERE deleted_at IS NULL`; `CHECK(role <> 'super_admin')`; `CHECK(status <> 'activ' OR joined_at IS NOT NULL)`; `CHECK(status <> 'plecat' OR deactivated_at IS NOT NULL)`
indexuri: `(user_id, status) WHERE deleted_at IS NULL`; `(organization_id, role, status) WHERE deleted_at IS NULL`; `(organization_id) WHERE role = 'org_admin' AND status = 'activ' AND deleted_at IS NULL`
rls: SELECT = membru activ al aceleiasi organizatii (colegii se vad intre ei) sau platform admin; INSERT/UPDATE/DELETE = org_admin al organizatiei sau platform admin; nimeni nu isi poate modifica propriul `role`.
nota: capcana clasica — politica pe aceasta tabela nu are voie sa faca `SELECT` din ea insasi (recursie infinita). Toate verificarile de apartenenta trec printr-o functie `SECURITY DEFINER STABLE` (`app.is_member(org)`, `app.has_role(org, roles[])`) marcata `set search_path`. Aceeasi functie e sursa unica pentru toate celelalte tabele. Enforcement `seats_limit` printr-un trigger care numara membrii `activ`+`invitat` — nu se poate exprima ca CHECK. Ultimul `org_admin` activ nu poate fi degradat/dezactivat (trigger).

### role_permissions
scop: matricea de permisiuni ca date, nu ca `if`-uri in cod (principiul 5), cu suprascriere optionala per organizatie.
coloane:
```
  id uuid PK
  organization_id uuid FK->organizations(id) RESTRICT   -- NULL = implicit de platforma
  role app_role NOT NULL
  permission_key citext NOT NULL          -- ex. 'leave.request.approve'
  feature_key citext FK->features(key)    -- permisiunea are sens doar cu modulul activ
  allowed boolean NOT NULL DEFAULT false
  scope permission_scope NOT NULL DEFAULT 'niciunul'
```
constrangeri: `UNIQUE(COALESCE(organization_id,'00000000-...'::uuid), role, permission_key) WHERE deleted_at IS NULL` (sau doua UNIQUE partiale: unul `WHERE organization_id IS NULL`, unul `WHERE organization_id IS NOT NULL`); `CHECK(allowed = false OR scope <> 'niciunul')`
indexuri: `(role, permission_key) WHERE organization_id IS NULL AND deleted_at IS NULL`; `(organization_id, role) WHERE deleted_at IS NULL`
rls: SELECT = membru activ (are nevoie de propriile permisiuni pentru UI) sau platform admin; randurile globale (`organization_id IS NULL`) sunt vizibile tuturor autentificatilor; INSERT/UPDATE/DELETE = doar platform admin (suprascrierile per org: org_admin, in faza urmatoare).
nota: rezolvarea e „override-ul organizatiei bate implicitul de platforma"; expune-o ca view/functie `app.effective_permissions(org, uid)` ca sa nu duplici `COALESCE`-ul in fiecare Server Action.

### features
scop: catalogul global al modulelor si al capabilitatilor lor, sursa listei de feature flags.
coloane:
```
  id uuid PK
  key citext NOT NULL          -- 'attendance', 'leave', 'fleet', ...
  denumire text NOT NULL
  descriere text
  icon text                    -- nume lucide-react
  grup feature_group NOT NULL DEFAULT 'operational'
  is_core boolean NOT NULL DEFAULT false
  sort_order integer NOT NULL DEFAULT 100
  depends_on citext[] NOT NULL DEFAULT '{}'
  min_plan plan_type NOT NULL DEFAULT 'start'
  is_beta boolean NOT NULL DEFAULT false
  released_at timestamptz
```
constrangeri: `UNIQUE(key) WHERE deleted_at IS NULL`; `CHECK(key ~ '^[a-z][a-z0-9_]{2,39}$')`; `CHECK(NOT (key = ANY(depends_on)))`; `CHECK(is_core = false OR depends_on = '{}')`
indexuri: `(grup, sort_order) WHERE deleted_at IS NULL`; `GIN(depends_on)`
rls: SELECT = orice utilizator autentificat; INSERT/UPDATE/DELETE = doar platform admin.
nota: Postgres nu are FK pe elemente de array — validarea `depends_on` (fiecare cheie exista, fara cicluri) se face cu un trigger de constrangere. `is_core = true` pentru nucleu inseamna „nu poate fi dezactivat", verificat in trigger-ul de pe `organization_features`.

### organization_features
scop: activarea si configurarea unui modul pentru o organizatie concreta.
coloane:
```
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  feature_key citext NOT NULL FK->features(key) ON UPDATE CASCADE RESTRICT
  enabled boolean NOT NULL DEFAULT false
  activated_at timestamptz
  activated_by uuid FK->profiles(id) ON DELETE SET NULL
  disabled_at timestamptz
  disabled_by uuid FK->profiles(id) ON DELETE SET NULL
  settings jsonb NOT NULL DEFAULT '{}'::jsonb
```
constrangeri: `UNIQUE(organization_id, feature_key) WHERE deleted_at IS NULL`; `CHECK(jsonb_typeof(settings) = 'object')`; `CHECK(enabled = false OR activated_at IS NOT NULL)`
indexuri: `(organization_id) WHERE enabled AND deleted_at IS NULL`; `GIN(settings jsonb_path_ops)`
rls: SELECT = membru activ al organizatiei; INSERT/UPDATE = platform admin (org_admin doar pe `settings`, nu pe `enabled`); DELETE = nimeni.
nota: absenta randului = modul dezactivat, cu exceptia `features.is_core` care e mereu activ. Nu interoga tabela direct din UI: o singura functie `app.has_feature(org uuid, key citext) RETURNS boolean` — `STABLE`, `SECURITY DEFINER` — e apelata si din politicile RLS ale modulelor, si din Server Actions (principiul 4). Trigger de blocare: nu poti dezactiva un modul de care depinde alt modul activ, si nu poti activa unul cu `min_plan` peste planul organizatiei.

### invitations
scop: invitatie prin email a unui utilizator intr-o organizatie, cu token cu durata limitata.
coloane:
```
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  email citext NOT NULL
  role app_role NOT NULL DEFAULT 'employee'
  token_hash text NOT NULL              -- sha256 hex al token-ului brut
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days'
  status invitation_status NOT NULL DEFAULT 'trimisa'
  invited_by uuid NOT NULL FK->profiles(id) RESTRICT
  message text
  sent_count smallint NOT NULL DEFAULT 1
  last_sent_at timestamptz NOT NULL DEFAULT now()
  accepted_at timestamptz
  accepted_by uuid FK->profiles(id) ON DELETE SET NULL
  revoked_at timestamptz
  revoked_by uuid FK->profiles(id) ON DELETE SET NULL
```
constrangeri: `UNIQUE(token_hash)`; `UNIQUE(organization_id, email) WHERE status = 'trimisa' AND deleted_at IS NULL`; `CHECK(role <> 'super_admin')`; `CHECK(expires_at > created_at)`; `CHECK(status <> 'acceptata' OR (accepted_at IS NOT NULL AND accepted_by IS NOT NULL))`; `CHECK(length(token_hash) = 64)`; `CHECK(sent_count BETWEEN 1 AND 10)`
indexuri: `(organization_id, status) WHERE deleted_at IS NULL`; `(email, status)`; `(expires_at) WHERE status = 'trimisa'`
rls: SELECT/INSERT/UPDATE = org_admin al organizatiei sau platform admin; DELETE = nimeni (revocare = `status='revocata'`). Rolul `anon` NU are acces la tabela.
nota: tokenul brut exista doar in link-ul din email; in DB doar hash-ul. Acceptarea se face printr-o functie RPC `SECURITY DEFINER` care primeste tokenul, il hash-uieste, valideaza `status='trimisa' AND expires_at > now()`, verifica potrivirea `email` cu `auth.email()` si creeaza randul din `organization_members` — asa un utilizator anonim nu poate enumera invitatii. `pg_cron` zilnic marcheaza `expirata`.

### audit_logs
scop: jurnal append-only al tuturor actiunilor sensibile, obligatoriu pentru citirea datelor CNP/IBAN.
coloane:
```
  id uuid NOT NULL DEFAULT gen_random_uuid()
  created_at timestamptz NOT NULL DEFAULT now()
  organization_id uuid FK->organizations(id) RESTRICT     -- NULL = actiune de platforma
  actor_id uuid FK->profiles(id) ON DELETE SET NULL       -- NULL = sistem/pg_cron
  actor_email citext
  actor_role app_role
  impersonated_by uuid FK->profiles(id) ON DELETE SET NULL
  action audit_action NOT NULL
  entity_type text NOT NULL
  entity_id uuid
  entity_label text
  before jsonb
  after jsonb
  changed_fields text[]
  ip inet
  user_agent text
  request_id uuid
  severity smallint NOT NULL DEFAULT 1
  PRIMARY KEY (id, created_at)
```
constrangeri: `CHECK(action <> 'actualizare' OR (before IS NOT NULL AND after IS NOT NULL))`; `CHECK(severity BETWEEN 0 AND 3)`; `CHECK(entity_type ~ '^[a-z][a-z0-9_.]{2,63}$')`
indexuri: `(organization_id, created_at DESC)`; `(entity_type, entity_id, created_at DESC)`; `(actor_id, created_at DESC)`; `(organization_id, action, created_at DESC) WHERE action = 'citire_sensibila'`; BRIN pe `(created_at)` per partitie
rls: SELECT = org_admin al organizatiei sau platform admin (angajatul isi vede doar propriile randuri unde `actor_id = auth.uid()`); INSERT = doar prin functii `SECURITY DEFINER`; UPDATE/DELETE = NICIODATA, pentru niciun rol.
nota: PK-ul include `created_at` pentru ca tabela e partitionata pe aceasta coloana. Fara `updated_at`/`deleted_at` — imutabilitatea e principiul de baza. RLS nu opreste `service_role`, deci imutabilitatea se garanteaza suplimentar cu `REVOKE UPDATE, DELETE ON audit_logs FROM authenticated, anon, service_role` si o regula `DO INSTEAD NOTHING`. `before`/`after` NU au voie sa contina CNP/IBAN in clar — la scrierea din `employee_sensitive_data` se logheaza doar numele coloanelor citite.

### notifications
scop: notificare in-app pentru un utilizator, in contextul unei organizatii, cu urmarirea trimiterii pe email.
coloane:
```
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  user_id uuid NOT NULL FK->profiles(id) ON DELETE CASCADE
  type notification_kind NOT NULL DEFAULT 'informare'
  priority notification_priority NOT NULL DEFAULT 'normala'
  title text NOT NULL
  body text
  link text
  entity_type text
  entity_id uuid
  actor_id uuid FK->profiles(id) ON DELETE SET NULL
  dedupe_key text
  read_at timestamptz
  archived_at timestamptz
  sent_email_at timestamptz
  email_provider_id text          -- id-ul mesajului Resend
  email_error text
  expires_at timestamptz
```
constrangeri: `UNIQUE(user_id, organization_id, dedupe_key) WHERE dedupe_key IS NOT NULL AND deleted_at IS NULL`; `CHECK(link IS NULL OR link ~ '^/')`; `CHECK(length(title) BETWEEN 1 AND 200)`
indexuri: `(user_id, organization_id, created_at DESC) WHERE read_at IS NULL AND deleted_at IS NULL`; `(organization_id, created_at DESC)`; `(created_at) WHERE sent_email_at IS NULL`
rls: SELECT = doar destinatarul (`user_id = auth.uid()`); UPDATE = doar destinatarul si doar `read_at`/`archived_at`; INSERT = doar server-side (`SECURITY DEFINER`); DELETE = nimeni.
nota: destinatarul trebuie sa fie membru activ al `organization_id` — verificat la INSERT prin trigger, altfel o notificare poate scurge date intre tenanti. `link` e cale relativa, nu URL absolut (previne redirect-uri catre domenii externe din email).

### notification_preferences
scop: alegerea canalului si a frecventei per tip de notificare, per utilizator si organizatie.
coloane:
```
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  user_id uuid NOT NULL FK->profiles(id) ON DELETE CASCADE
  type notification_kind NOT NULL
  in_app boolean NOT NULL DEFAULT true
  email boolean NOT NULL DEFAULT true
  digest notification_digest NOT NULL DEFAULT 'imediat'
  quiet_hours_start time
  quiet_hours_end time
```
constrangeri: `UNIQUE(organization_id, user_id, type) WHERE deleted_at IS NULL`; `CHECK((quiet_hours_start IS NULL) = (quiet_hours_end IS NULL))`; `CHECK(digest = 'imediat' OR email = true)`
indexuri: `(user_id, organization_id) WHERE deleted_at IS NULL`
rls: SELECT/INSERT/UPDATE = doar proprietarul (`user_id = auth.uid()`) si numai in organizatii in care e membru activ; DELETE = nimeni.
nota: lipsa randului inseamna valorile implicite — nu popula tabela la crearea membrului. Rezolvarea se face cu `LEFT JOIN` + `COALESCE` intr-o singura functie, altfel fiecare modul reimplementeaza alt fallback. Notificarile `priority='critica'` ignora `quiet_hours` si `digest`.

### demo_requests
scop: lead-urile din formularul „Cere demo" de pe landing, singura poarta de intrare pre-tenant.
coloane:
```
  id uuid PK
  nume text NOT NULL
  denumire_firma text NOT NULL
  email citext NOT NULL
  telefon text
  nr_angajati employee_band
  mesaj text
  status demo_request_status NOT NULL DEFAULT 'nou'
  sursa text
  utm jsonb NOT NULL DEFAULT '{}'::jsonb
  ip inet
  user_agent text
  consent_at timestamptz NOT NULL DEFAULT now()
  assigned_to uuid FK->profiles(id) ON DELETE SET NULL
  contacted_at timestamptz
  converted_organization_id uuid FK->organizations(id) ON DELETE SET NULL
  notite_interne text
```
constrangeri: `CHECK(email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')`; `CHECK(length(mesaj) <= 2000)`; `CHECK(status <> 'convertit' OR converted_organization_id IS NOT NULL)`; `UNIQUE(email, date_trunc('day', created_at)) WHERE deleted_at IS NULL` (anti-spam)
indexuri: `(status, created_at DESC) WHERE deleted_at IS NULL`; `(email)`; `(assigned_to, status) WHERE deleted_at IS NULL`
rls: SELECT/UPDATE = doar platform admin; INSERT = NICIUN rol prin PostgREST (nici `anon`) — inserarea se face exclusiv dintr-o Server Action / Edge Function cu rate limit pe IP; DELETE = nimeni.
nota: fara `organization_id` — lead-ul exista inainte de orice tenant. Conversia nu creeaza automat organizatia: super_admin-ul o creeaza manual si abia apoi seteaza `converted_organization_id` (decizia 6). `ip` + `user_agent` sunt date cu caracter personal: sterge-le prin `pg_cron` la 12 luni pentru lead-urile respinse.

---

## (a) Partitionare si retentie `audit_logs` (3 ani)

`PARTITION BY RANGE (created_at)`, partitii **lunare** (`audit_logs_2026_08` etc.) + o partitie `DEFAULT` ca plasa de siguranta (insert-urile nu au voie sa esueze — un audit pierdut e mai grav decat o partitie dezordonata; un job alerteaza daca `DEFAULT` are randuri). `pg_partman` nu e disponibil pe Supabase, deci: o functie proprie `app.maintain_audit_partitions()` rulata de `pg_cron` in fiecare noapte de 1 ale lunii, care (1) creeaza partitiile pentru urmatoarele 3 luni cu indexurile lor, (2) pe partitiile mai vechi de 3 luni inlocuieste btree-ul pe `created_at` cu **BRIN** si ruleaza `VACUUM (FREEZE, ANALYZE)`, (3) pentru partitiile care depasesc 36 de luni face `DETACH PARTITION CONCURRENTLY`, exporta continutul in Storage (bucket privat `audit-archive`, CSV gzip, o cheie de sortare stabila + checksum SHA-256 salvat separat), si abia dupa confirmarea uploadului face `DROP TABLE`. Fereastra de 3 ani vine din termenul general de prescriptie si din cerintele de control ITM/ANAF; arhiva ramane in Storage inca 2 ani, doar pentru platform admin. Indexurile locale se creeaza per partitie, nu global; partitiile calde (ultimele 3 luni) primesc btree-uri complete, cele reci doar BRIN pe `created_at` + btree pe `(organization_id, created_at)`. Consultarile din UI sunt intotdeauna filtrate pe `organization_id` **si** pe un interval de date, ca planificatorul sa faca partition pruning; interfata impune un interval maxim de 12 luni per interogare si exportul mai mare pleaca asincron pe email.

## (b) De ce `organization_id` pe fiecare tabela

Fara denormalizare, politica RLS a unei tabele de rangul trei (ex. `leave_request_days` → `leave_requests` → `employees` → `organizations`) ar trebui sa faca 2-3 `EXISTS` cu join-uri pentru fiecare rand evaluat, iar politicile RLS se aplica **per rand returnat**, nu o data pe interogare — costul se inmulteste cu volumul si planificatorul pierde adesea sansa de a folosi indexul. Cu `organization_id` pe rand, fiecare politica devine acelasi predicat simplu si indexabil (`organization_id = ANY(app.current_org_ids())`), evaluat pe un index care are `organization_id` pe prima pozitie. Beneficii secundare: politicile arata identic pe toate tabelele deci sunt auditabile la privire si testabile mecanic; export/stergere GDPR per firma devine un filtru pe o coloana; o eroare de join intr-un query nu mai poate scurge date intre tenanti pentru ca RLS taie oricum. Costul — riscul ca `organization_id` al copilului sa nu corespunda cu al parintelui — se elimina cu **FK compuse**: parintele primeste `UNIQUE(id, organization_id)`, copilul face `FOREIGN KEY (parent_id, organization_id) REFERENCES parent(id, organization_id)`. Asa consistenta e garantata de baza de date, nu de disciplina in cod.

## (c) Trigger de creare a profilului la signup

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_full_name text;
  v_locale    public.locale_code;
begin
  v_full_name := nullif(btrim(coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    ''
  )), '');

  begin
    v_locale := coalesce(nullif(new.raw_user_meta_data->>'locale', ''), 'ro')::public.locale_code;
  exception when invalid_text_representation then
    v_locale := 'ro';
  end;

  insert into public.profiles (id, email, full_name, avatar_path, locale, created_at, updated_at)
  values (
    new.id,
    lower(new.email),
    v_full_name,
    nullif(new.raw_user_meta_data->>'avatar_url', ''),
    v_locale,
    now(),
    now()
  )
  on conflict (id) do update
    set email      = excluded.email,
        full_name  = coalesce(public.profiles.full_name, excluded.full_name),
        updated_at = now();

  return new;
exception when others then
  -- un profil lipsa se repara; un signup blocat inseamna utilizator pierdut
  insert into public.audit_logs (action, entity_type, entity_id, after, severity, created_at)
  values (
    'eroare_sistem',
    'profiles',
    new.id,
    jsonb_build_object('sursa', 'handle_new_user', 'sqlstate', sqlstate, 'mesaj', sqlerrm),
    3,
    now()
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
```

Note: `security definer` + `set search_path` fixat sunt obligatorii (trigger-ul ruleaza in contextul `supabase_auth_admin`, care nu are drepturi pe `public`). Trigger-ul creeaza DOAR profilul — **niciodata** un rand in `organization_members`: apartenenta vine exclusiv din acceptarea unei invitatii sau din Super-Admin (decizia 6). `email` se sincronizeaza si la schimbare printr-un trigger geaman `after update of email on auth.users`.