## Enum-uri Postgres introduse

```
expirable_entity_type : vehicle_document | ssm_training | ssm_equipment | medical_exam | maintenance_task | employee_document
expirable_status      : activ | inlocuit | anulat
alert_severity        : info | warning | critical | expired
alert_status          : new | acknowledged | resolved
alert_channel         : email | in_app
notification_state    : pending | claimed | sent | failed
vehicle_category      : autoturism | autoutilitara | camion | autobuz | remorca | semiremorca | utilaj | motocicleta
fuel_type             : benzina | motorina | gpl | gnc | electric | hibrid | hibrid_plugin
vehicle_status        : activ | in_service | rezervat | indisponibil | casat | vandut
vehicle_document_type : itp | rca | casco | rovinieta | revizie | extintor→extinctor | trusa_medicala
trip_sheet_status     : draft | trimis | aprobat | respins
odometer_anomaly_type : regres | salt_anormal | gap_neacoperit
```

Helpere RLS folosite in notatie (STABLE, SECURITY DEFINER, `search_path=''`), definite o singura data in nucleu:
`app.org_ids()` → uuid[] cu organizatiile membrului; `app.has_perm(org, 'fleet.vehicle.update')` → citeste `role_permissions`; `app.feature_on(org,'fleet')`. Toate politicile scriu `organization_id = ANY(app.org_ids())` si folosesc `(select auth.uid())` — nu `auth.uid()` gol — ca sa fie evaluat ca InitPlan o singura data, nu per rand.

---

# A) Infrastructura comuna de expirari

## A0. Decizia: (a) tabela `expirables` alimentata prin triggere. FERM.

**De ce nu (b) VIEW cu UNION.** Capcana pe care ai cerut-o explicit:

- O view normala in Postgres ruleaza cu drepturile **proprietarului**, nu ale apelantului. In Supabase view-urile se creeaza de regula cu `postgres`, care este `BYPASSRLS`. Rezultat: `SELECT * FROM v_expirari` returneaza randurile **tuturor organizatiilor**, RLS-ul tabelelor sursa nu se aplica. Este scurgere multi-tenant totala, si nu se vede la testare daca testezi cu un singur tenant.
- Remediu obligatoriu: `CREATE VIEW ... WITH (security_invoker = true)` — disponibil **din PostgreSQL 15**. Supabase ruleaza PG 15/17, deci e disponibil, dar **default-ul este `false`**: orice view creata fara flag e gaurita.
- Capcane care **raman** chiar si cu `security_invoker=true`:
  1. View-urile **nu au politici RLS proprii**; nu poti scrie `CREATE POLICY` pe o view. Securitatea depinde 100% de RLS-ul fiecarei tabele sursa. O tabela sursa noua fara RLS strica view-ul.
  2. `security_invoker` nu se propaga automat: fiecare view imbricata are nevoie de flag propriu.
  3. Functiile `SECURITY DEFINER` apelate din corpul view-ului tot ruleaza ca definer → pot reintroduce ocolirea.
  4. Predicatele non-`LEAKPROOF` pot fi evaluate inaintea calificatorului RLS si pot scurge valori prin mesaje de eroare; `security_barrier` limiteaza asta, dar penalizeaza planul.
  5. **Materialized view NU suporta `security_invoker`** — deci varianta "view + matview pentru viteza" este imposibila fara a expune date cross-tenant. Aceasta singura constrangere omoara (b) ca solutie de dashboard.
- Performanta: UNION peste 6+ tabele, fiecare cu propriul `qual` RLS, nu poate folosi un index global pe `expires_at`. Orice `ORDER BY expires_at LIMIT 50` sau `count(*) FILTER (...)` forteaza materializarea tuturor ramurilor. La 6 module × mii de randuri, dashboardul devine sortare completa la fiecare incarcare. Paginarea stabila (keyset) e practic imposibila.

**De ce nu (c) duplicare per modul.** Trei implementari ale aceleiasi ferestre de 30/14/7 zile diverg in 3 luni; alertele si emailurile s-ar deduplica diferit in fiecare modul; dashboardul de conformitate ar face oricum UNION la runtime.

**(a) castiga**: un singur index pentru toate modulele, un singur job, o singura regula de deduplicare, RLS clasic pe tabela reala (deci si `INSERT`/`UPDATE` blocabile), extindere = adaugi un trigger, nu modifici DDL comun. Costul — sincronizarea — se plateste in triggere, nu in cod aplicativ.

**Regulile care fac (a) sigura:**
- `expirables` este **registru derivat, read-only pentru toata lumea**. Nicio politica `INSERT/UPDATE/DELETE` pentru roluri de aplicatie. Scriu doar functiile trigger `SECURITY DEFINER` din modulele sursa.
- `entity_id` **nu are FK** (e polimorfa) → integritatea o asigura triggerele `AFTER INSERT OR UPDATE OR DELETE` pe fiecare sursa (inclusiv trecerea `deleted_at` din NULL in non-NULL) **plus** un job saptamanal de reconciliere care marcheaza `status='anulat'` randurile orfane si logheaza diferentele.
- `organization_id` se copiaza din sursa in trigger; niciodata din client.

### expirables
scop: registru unic, denormalizat, al oricarei entitati cu data de expirare din orice modul, alimentat exclusiv prin triggere.
coloane:
```
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  entity_type expirable_entity_type NOT NULL
  entity_id uuid NOT NULL
  kind text NOT NULL                        -- 'itp','rca','instruire_periodica','medicina_muncii',...
  label text NOT NULL                       -- text gata de afisat: 'ITP · B-123-XYZ'
  reference_code text                       -- numar document / serie
  valid_from date
  expires_at date NOT NULL
  responsible_id uuid FK->employees(id) SET NULL
  fallback_role app_role NOT NULL DEFAULT 'org_admin'
  department_id uuid FK->departments(id) SET NULL
  status expirable_status NOT NULL DEFAULT 'activ'
  is_active boolean NOT NULL DEFAULT true   -- false = entitate sursa inactiva (vehicul casat, angajat plecat)
  amount numeric(14,2)
  source_updated_at timestamptz NOT NULL
```
constrangeri: `UNIQUE(entity_type, entity_id) WHERE deleted_at IS NULL`; `CHECK(valid_from IS NULL OR valid_from <= expires_at)`
indexuri:
```
  (organization_id, expires_at) INCLUDE (entity_type, kind, responsible_id)
      WHERE deleted_at IS NULL AND is_active AND status='activ'   -- indexul dashboardului
  (organization_id, entity_type, expires_at) WHERE deleted_at IS NULL AND is_active
  (organization_id, responsible_id, expires_at) WHERE deleted_at IS NULL AND is_active
```
rls: `SELECT = organization_id = ANY(app.org_ids()) AND app.has_perm(organization_id,'compliance.read')`, plus varianta restransa pentru `employee`: doar `responsible_id = app.my_employee_id(organization_id)`; `INSERT/UPDATE/DELETE = nicio politica` (scriu doar triggerele definer).
nota: `is_active` nu e redundant cu `deleted_at` — un vehicul casat isi pastreaza istoricul de documente (nu se sterge), dar iese din semafor. Fara el, flota vanduta polueaza dashboardul la infinit.

### alert_rules
scop: praguri de notificare configurabile per organizatie, cu specializare optionala pe tip de entitate si pe `kind`.
coloane:
```
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  entity_type expirable_entity_type          -- NULL = se aplica la tot
  kind text                                  -- NULL = toate kind-urile din entity_type
  thresholds_days int[] NOT NULL DEFAULT '{30,14,7}'
  notify_on_overdue boolean NOT NULL DEFAULT true
  overdue_repeat_days int NOT NULL DEFAULT 7  -- 0 = o singura alerta la depasire
  channels alert_channel[] NOT NULL DEFAULT '{email,in_app}'
  notify_responsible boolean NOT NULL DEFAULT true
  notify_roles app_role[] NOT NULL DEFAULT '{org_admin}'
  extra_recipient_emails text[] NOT NULL DEFAULT '{}'
  is_active boolean NOT NULL DEFAULT true
```
constrangeri: `UNIQUE(organization_id, entity_type, kind) WHERE deleted_at IS NULL` (NULLS NOT DISTINCT, ca sa nu poti avea doua reguli generice); `CHECK(array_length(thresholds_days,1) BETWEEN 1 AND 6)`; `CHECK(thresholds_days <@ ARRAY[1,3,7,14,30,45,60,90,180])`; `CHECK(overdue_repeat_days BETWEEN 0 AND 90)`
indexuri: `(organization_id, entity_type, kind) WHERE deleted_at IS NULL AND is_active`
rls: `SELECT = membru al org`; `INSERT/UPDATE/DELETE = app.has_perm(organization_id,'compliance.rules.manage')` (org_admin)
nota: rezolvarea regulii e "cea mai specifica intai": `(entity_type,kind)` → `(entity_type,NULL)` → `(NULL,NULL)` → default hardcodat 30/14/7 in functie, nu in cod TS. Fara seed la crearea organizatiei, un org fara reguli tot trebuie sa primeasca alerte — de aceea fallback-ul e in SQL.

### compliance_alerts
scop: alerta materializata si deduplicata pentru un prag atins al unui `expirable`, cu ciclu de viata new→acknowledged→resolved.
coloane:
```
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  expirable_id uuid NOT NULL FK->expirables(id) RESTRICT
  entity_type expirable_entity_type NOT NULL      -- copiat, pentru filtrare fara join
  entity_id uuid NOT NULL
  kind text NOT NULL
  due_date date NOT NULL                          -- = expirables.expires_at la momentul generarii
  bucket_key text NOT NULL                        -- 'T30','T14','T7','T0','OVERDUE:2026-W34'
  threshold_days int                              -- NULL pentru bucket-urile OVERDUE
  severity alert_severity NOT NULL
  status alert_status NOT NULL DEFAULT 'new'
  responsible_id uuid FK->employees(id) SET NULL
  first_seen_at timestamptz NOT NULL DEFAULT now()
  acknowledged_by uuid FK->auth.users(id) SET NULL
  acknowledged_at timestamptz
  resolved_at timestamptz
  resolution_note text
  auto_resolved boolean NOT NULL DEFAULT false
```
constrangeri:
```
  UNIQUE(organization_id, expirable_id, due_date, bucket_key)   -- cheia idempotentei, FARA filtru pe deleted_at
  CHECK((status='acknowledged') = (acknowledged_at IS NOT NULL AND acknowledged_by IS NOT NULL) OR status='resolved')
  CHECK((status='resolved') = (resolved_at IS NOT NULL))
```
indexuri: `(organization_id, status, due_date) WHERE deleted_at IS NULL`; `(organization_id, responsible_id, status) WHERE deleted_at IS NULL AND status<>'resolved'`
rls: `SELECT = membru + perm 'compliance.read'` (employee: doar `responsible_id = app.my_employee_id(...)`); `UPDATE = app.has_perm(...,'compliance.alert.ack')` si doar pe coloanele de status/ack/resolve (enforce prin `WITH CHECK` + trigger care respinge modificarea coloanelor de identitate); `INSERT/DELETE = nicio politica` — scrie doar jobul.
nota: **UNIQUE-ul acesta este intentionat NEfiltrat pe `deleted_at`**. Daca l-ai face partial `WHERE deleted_at IS NULL`, un utilizator care "sterge" o alerta ar permite jobului sa o regenereze si sa retrimita emailul. Alertele nu se sterg — se rezolva.

### alert_notifications
scop: o linie per (alerta, canal, destinatar), cu claim atomic, ca sa nu plece doua emailuri pentru acelasi eveniment.
coloane:
```
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  alert_id uuid NOT NULL FK->compliance_alerts(id) RESTRICT
  channel alert_channel NOT NULL
  recipient_user_id uuid FK->auth.users(id) SET NULL
  recipient_email citext NOT NULL
  state notification_state NOT NULL DEFAULT 'pending'
  claimed_at timestamptz
  sent_at timestamptz
  attempts int NOT NULL DEFAULT 0
  provider_message_id text
  last_error text
  idempotency_key text NOT NULL   -- md5(alert_id||channel||recipient_email) -> trimis si catre Resend
```
constrangeri: `UNIQUE(alert_id, channel, recipient_email)`; `UNIQUE(idempotency_key)`; `CHECK(attempts <= 5)`
indexuri: `(state, claimed_at) WHERE state IN ('pending','claimed')`
rls: `SELECT = app.has_perm(organization_id,'compliance.read')`; scriere doar service_role/definer.
nota: `recipient_email` e cheia de deduplicare, nu `recipient_user_id`. Daca acelasi om e si responsabil si org_admin, ar primi doua emailuri identice.

## A1. Jobul zilnic — pseudocod si idempotenta

```
pg_cron: SELECT cron.schedule('compliance-daily', '0 3 * * *',
           $$ SELECT net.http_post(edge_url('compliance-scan'), headers => auth_header()) $$);
-- ATENTIE: pg_cron pe Supabase programeaza in UTC. 03:00 UTC = 06:00 vara / 05:00 iarna la Bucuresti.
-- Daca ora locala fixa conteaza: ruleaza orar si iesi imediat daca
--   extract(hour from now() AT TIME ZONE 'Europe/Bucharest') <> 6.

EDGE FUNCTION compliance-scan(run_date := (now() AT TIME ZONE 'Europe/Bucharest')::date):

 FAZA 1 — generare alerte (o singura tranzactie SQL, per organizatie):
   INSERT INTO compliance_alerts (org, expirable_id, entity_type, entity_id, kind,
                                  due_date, bucket_key, threshold_days, severity, responsible_id)
   SELECT ... FROM expirables e
     JOIN LATERAL app.resolve_alert_rule(e.organization_id, e.entity_type, e.kind) r ON true
     CROSS JOIN LATERAL (
        -- bucket-ul curent, unul singur per expirable per zi:
        SELECT CASE
          WHEN e.expires_at <  run_date AND r.notify_on_overdue AND
               (r.overdue_repeat_days = 0
                OR (run_date - e.expires_at) % r.overdue_repeat_days = 0)
            THEN CASE WHEN r.overdue_repeat_days = 0 THEN 'OVERDUE'
                      ELSE 'OVERDUE:' || to_char(run_date,'IYYY-"W"IW') END
          WHEN e.expires_at = run_date THEN 'T0'
          WHEN (e.expires_at - run_date) = ANY(r.thresholds_days)
            THEN 'T' || (e.expires_at - run_date)
        END AS bucket_key
     ) b
   WHERE e.deleted_at IS NULL AND e.is_active AND e.status='activ'
     AND b.bucket_key IS NOT NULL
     AND app.feature_on(e.organization_id, module_of(e.entity_type))
   ON CONFLICT (organization_id, expirable_id, due_date, bucket_key) DO NOTHING
   RETURNING id;                     -- <<< doar randurile NOU inserate merg mai departe

 FAZA 2 — auto-rezolvare:
   UPDATE compliance_alerts a SET status='resolved', resolved_at=now(), auto_resolved=true
   WHERE a.status <> 'resolved'
     AND NOT EXISTS (SELECT 1 FROM expirables e
                     WHERE e.id=a.expirable_id AND e.deleted_at IS NULL
                       AND e.is_active AND e.status='activ' AND e.expires_at = a.due_date);
   -- documentul reinnoit => expires_at nou => due_date nu mai coincide => seria veche se inchide singura,
   -- iar seria noua porneste cu bucket-uri proprii. Fara cod special de "reinnoire".

 FAZA 3 — fan-out destinatari (idempotent prin UNIQUE):
   INSERT INTO alert_notifications (alert_id, channel, recipient_email, recipient_user_id, idempotency_key)
   SELECT ... FROM alertele nou inserate
     × (responsabil daca notify_responsible) ∪ (useri cu rolurile din notify_roles) ∪ extra_recipient_emails
   ON CONFLICT (alert_id, channel, recipient_email) DO NOTHING;

 FAZA 4 — trimitere (claim atomic, in loturi de 50):
   WITH claimed AS (
     UPDATE alert_notifications SET state='claimed', claimed_at=now(), attempts=attempts+1
     WHERE id IN (SELECT id FROM alert_notifications
                  WHERE state='pending'
                     OR (state='claimed' AND claimed_at < now() - interval '15 minutes')
                  ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 50)
     RETURNING *)
   SELECT * FROM claimed;
   pentru fiecare: resend.emails.send(..., headers:{'Idempotency-Key': idempotency_key})
     succes -> state='sent', sent_at=now(), provider_message_id=...
     eroare -> state = (attempts>=5 ? 'failed' : 'pending'), last_error=...
   MOD TEST (RESEND_TEST_MODE=true): nu se apeleaza API-ul, se scrie state='sent',
     provider_message_id='test:'||idempotency_key. Zero cod diferit in rest.
```

**Garantia de idempotenta, pe straturi de constrangere:**
1. `UNIQUE(organization_id, expirable_id, due_date, bucket_key)` + `ON CONFLICT DO NOTHING ... RETURNING` — a doua rulare din aceeasi zi insereaza 0 randuri, deci FAZA 3 nu are ce sa proceseze. Deduplicarea e in DB, nu in memoria functiei.
2. `bucket_key` este determinist si depinde doar de `(run_date, expires_at, regula)` — nu de `now()` cu ora. Doua rulari la 06:00 si la 06:07 produc acelasi `bucket_key`.
3. `due_date` in cheie separa seriile: reinnoirea documentului nu "reciclează" o alerta veche acknowledged.
4. `UNIQUE(alert_id, channel, recipient_email)` — chiar daca FAZA 3 s-ar rula de doua ori, exista o singura linie de notificare.
5. `UNIQUE(idempotency_key)` + antetul `Idempotency-Key` catre Resend — daca procesul moare intre apelul HTTP reusit si `UPDATE`, reluarea dupa 15 minute retrimite cererea, iar Resend o recunoaste si **nu** livreaza al doilea email.
6. `FOR UPDATE SKIP LOCKED` — doua instante concurente ale Edge Function nu iau acelasi lot.

## A2. Query dashboard "Conformitate" (semafor)

```sql
-- $1 = organization_id (derivat server-side din auth.uid(), niciodata din client)
-- $2 = fereastra "expira curand" in zile (default 30, din alert_rules generice)
WITH baza AS (
  SELECT e.entity_type,
         CASE
           WHEN e.expires_at <  current_date            THEN 'expirat'
           WHEN e.expires_at <= current_date + $2::int  THEN 'expira_curand'
           ELSE                                              'in_regula'
         END AS bucket
  FROM public.expirables e
  WHERE e.organization_id = $1
    AND e.deleted_at IS NULL
    AND e.is_active
    AND e.status = 'activ'
)
SELECT
  coalesce(entity_type::text, 'TOTAL') AS entity_type,
  count(*) FILTER (WHERE bucket = 'expirat')       AS expirat,
  count(*) FILTER (WHERE bucket = 'expira_curand') AS expira_curand,
  count(*) FILTER (WHERE bucket = 'in_regula')     AS in_regula,
  count(*)                                          AS total
FROM baza
GROUP BY GROUPING SETS ((entity_type), ())
ORDER BY entity_type = 'TOTAL', entity_type;
```

Lista drill-down (aceeasi tabela, keyset pagination, fara OFFSET):
```sql
SELECT e.id, e.entity_type, e.kind, e.label, e.reference_code, e.expires_at,
       e.expires_at - current_date AS zile_ramase, e.responsible_id
FROM public.expirables e
WHERE e.organization_id = $1 AND e.deleted_at IS NULL AND e.is_active
  AND e.status = 'activ' AND e.expires_at <= current_date + $2::int
  AND (e.expires_at, e.id) > ($3::date, $4::uuid)   -- cursor
ORDER BY e.expires_at, e.id
LIMIT 50;
```

**De ce ramane rapid la 500 angajati si mii de randuri:**
- Volum real: 500 angajati × ~6 expirari (medicina muncii, instruiri SSM, permis, contracte) + 100 vehicule × 7 documente ≈ **4.000 randuri per organizatie**. Cu indexul partial `(organization_id, expires_at) INCLUDE (entity_type, kind, responsible_id) WHERE deleted_at IS NULL AND is_active AND status='activ'`, agregarea e **index-only scan** pe un range al unei singure organizatii — sub 5 ms. Heap-ul nu e atins (necesita `autovacuum` agresiv pe tabela: `autovacuum_vacuum_scale_factor=0.02`, altfel visibility map se degradeaza si index-only scan-ul devine heap fetch).
- Predicatul RLS trebuie sa fie *sargable*: `organization_id = ANY(app.org_ids())` cu functie `STABLE` → planner-ul o evalueaza o data (InitPlan) si foloseste indexul. Daca cineva o scrie `VOLATILE` sau pune `auth.uid()` neinvelit, devine filtru per rand si dashboardul cade la secunde.
- `current_date` e STABLE → face parte din conditia de index; nu folosi `now()` (timestamptz) comparat cu `date`, produce cast per rand.
- Nu exista JOIN in query: `label`, `kind`, `reference_code` sunt denormalizate in `expirables` exact ca sa nu atingi `vehicles`/`employees`. Aceasta e ratiunea principala a variantei (a) fata de (b).
- Daca o organizatie depaseste ~200k expirari (nerealist pentru IMM): tabela `compliance_snapshot(organization_id, entity_type, bucket, count, computed_at)` **cu RLS**, reimprospatata de acelasi cron. Niciodata matview — nu suporta `security_invoker` si ar expune cross-tenant.

---

# B) Modulul FLEET

### vehicles
scop: parcul auto al organizatiei, cu alocare curenta si kilometraj de referinta.
coloane:
```
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  nr_inmatriculare citext NOT NULL
  vin citext
  marca text NOT NULL
  model text NOT NULL
  an_fabricatie int
  categorie vehicle_category NOT NULL
  tip_combustibil fuel_type NOT NULL
  capacitate_rezervor numeric(6,2)
  consum_mediu_declarat numeric(5,2)           -- l/100km (sau kWh/100km pentru electric)
  prag_abatere_consum_pct numeric(5,2) NOT NULL DEFAULT 15.00
  km_curent int NOT NULL DEFAULT 0
  km_curent_updated_at timestamptz
  employee_id uuid FK->employees(id) SET NULL
  department_id uuid FK->departments(id) SET NULL
  status vehicle_status NOT NULL DEFAULT 'activ'
  data_achizitie date
  valoare_achizitie numeric(14,2)
  observatii text
```
constrangeri:
```
  UNIQUE(organization_id, nr_inmatriculare) WHERE deleted_at IS NULL
  UNIQUE(organization_id, vin) WHERE deleted_at IS NULL AND vin IS NOT NULL
  CHECK(vin IS NULL OR length(vin) = 17)
  CHECK(km_curent >= 0)
  CHECK(consum_mediu_declarat IS NULL OR consum_mediu_declarat BETWEEN 0.5 AND 200)
  CHECK(an_fabricatie IS NULL OR an_fabricatie BETWEEN 1950 AND extract(year from current_date)::int + 1)
  CHECK(num_nonnulls(employee_id, department_id) <= 1)   -- alocare fie la om, fie la departament
```
indexuri: `(organization_id, status) WHERE deleted_at IS NULL`; `(organization_id, employee_id) WHERE deleted_at IS NULL`; `(organization_id, nr_inmatriculare) WHERE deleted_at IS NULL`
rls: `SELECT = membru AND app.feature_on(org,'fleet') AND (perm 'fleet.read' OR employee_id = app.my_employee_id(org))`; `INSERT/UPDATE = app.has_perm(org,'fleet.vehicle.write')`; `DELETE = nicio politica` (soft delete prin UPDATE cu perm `fleet.vehicle.delete`)
nota: `nr_inmatriculare` ca `citext` + normalizare in trigger (upper, fara spatii/liniute) — altfel `B123XYZ`, `B 123 XYZ` si `b-123-xyz` intra ca trei vehicule si sparg unicitatea reala. `km_curent` este **cache derivat** din foile de parcurs aprobate; sursa de adevar ramane `trip_sheets`.

### vehicle_documents
scop: documentele si dotarile cu termen de valabilitate ale unui vehicul; sursa principala de expirari pentru flota.
coloane:
```
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  vehicle_id uuid NOT NULL FK->vehicles(id) RESTRICT
  tip vehicle_document_type NOT NULL
  numar text
  emitent text
  valabil_de_la date NOT NULL
  expira_la date NOT NULL
  cost numeric(14,2) NOT NULL DEFAULT 0
  moneda char(3) NOT NULL DEFAULT 'RON'
  fisier_path text                     -- cheie in Storage bucket privat 'fleet-docs'
  fisier_size_bytes bigint
  responsible_id uuid FK->employees(id) SET NULL
  este_curent boolean NOT NULL DEFAULT true
  observatii text
```
constrangeri:
```
  CHECK(expira_la > valabil_de_la)
  CHECK(cost >= 0)
  UNIQUE(organization_id, vehicle_id, tip) WHERE deleted_at IS NULL AND este_curent
  UNIQUE(organization_id, vehicle_id, tip, numar) WHERE deleted_at IS NULL AND numar IS NOT NULL
  EXCLUDE USING gist (vehicle_id WITH =, (tip::text) WITH =,
                      daterange(valabil_de_la, expira_la, '[)') WITH &&)
    WHERE (deleted_at IS NULL)      -- doua RCA-uri suprapuse pe acelasi vehicul = eroare de operare
```
indexuri: `(organization_id, vehicle_id, tip) WHERE deleted_at IS NULL`; `(organization_id, expira_la) WHERE deleted_at IS NULL AND este_curent`
rls: `SELECT = ca la vehicles`; `INSERT/UPDATE = app.has_perm(org,'fleet.document.write')`; `DELETE = niciuna`
nota: `este_curent` se intretine prin trigger (la insert-ul unui document nou de acelasi tip, cel vechi devine `false`) — pastrezi istoricul de costuri pentru raportul TCO fara sa strici UNIQUE-ul. Triggerul `AFTER INSERT/UPDATE/DELETE` face UPSERT in `expirables` cu `entity_type='vehicle_document'`, `kind = tip::text`, `label = tip || ' · ' || nr_inmatriculare`, `is_active = (vehicles.status NOT IN ('casat','vandut') AND este_curent)`. **Capcana:** triggerul trebuie sa existe si pe `vehicles` (UPDATE al `status`), altfel un vehicul casat continua sa genereze alerte.

### trip_sheets
scop: foaia de parcurs — o cursa a unui vehicul cu un sofer, intre doua citiri de kilometraj.
coloane:
```
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  numar_foaie text NOT NULL                    -- generat server-side, serie per an
  vehicle_id uuid NOT NULL FK->vehicles(id) RESTRICT
  driver_employee_id uuid NOT NULL FK->employees(id) RESTRICT
  plecare_la timestamptz NOT NULL
  sosire_la timestamptz
  km_plecare int NOT NULL
  km_sosire int
  km_parcursi int GENERATED ALWAYS AS (km_sosire - km_plecare) STORED
  traseu text NOT NULL
  scop text NOT NULL
  status trip_sheet_status NOT NULL DEFAULT 'draft'
  business_trip_id uuid FK->business_trips(id) SET NULL   -- modulul per_diem
  submitted_at timestamptz
  approved_by uuid FK->auth.users(id) SET NULL
  approved_at timestamptz
  reject_reason text
  observatii text
```
constrangeri:
```
  UNIQUE(organization_id, numar_foaie) WHERE deleted_at IS NULL
  CHECK(km_plecare >= 0)
  CHECK(km_sosire IS NULL OR km_sosire > km_plecare)          -- cerinta explicita
  CHECK(sosire_la IS NULL OR sosire_la > plecare_la)
  CHECK((km_sosire IS NULL) = (sosire_la IS NULL))            -- se inchid impreuna
  CHECK(status = 'draft' OR (km_sosire IS NOT NULL AND sosire_la IS NOT NULL))
  CHECK((status='aprobat') = (approved_at IS NOT NULL AND approved_by IS NOT NULL))
  CHECK(status <> 'respins' OR reject_reason IS NOT NULL)
  CHECK(km_sosire IS NULL OR km_sosire - km_plecare <= 3000)  -- plafon de sanitate per foaie
```
indexuri: `(organization_id, vehicle_id, plecare_la DESC) WHERE deleted_at IS NULL`; `(organization_id, driver_employee_id, plecare_la DESC) WHERE deleted_at IS NULL`; `(organization_id, status) WHERE deleted_at IS NULL AND status='trimis'`; `(organization_id, business_trip_id) WHERE deleted_at IS NULL AND business_trip_id IS NOT NULL`
rls: `SELECT = perm 'fleet.trip.read.all' OR driver_employee_id = app.my_employee_id(org) OR manager peste departamentul soferului`; `INSERT = app.my_employee_id(org) IS NOT NULL AND status='draft'`; `UPDATE = (sofer AND status IN ('draft','respins')) OR (perm 'fleet.trip.approve' AND status='trimis')`; `DELETE = niciuna`
nota: `km_sosire > km_plecare` **strict** — o foaie cu 0 km parcursi nu e o cursa, e o eroare de introducere. `km_parcursi` este `GENERATED STORED`, deci nu poate fi falsificat de client si e indexabil. Aprobarea trebuie sa fie `SELECT ... FOR UPDATE` pe vehicul in Server Action, altfel doua aprobari concurente ale unor foi suprapuse produc `km_curent` gresit.

### fuel_entries
scop: alimentarile de carburant, legate de foaia de parcurs in care s-au consumat.
coloane:
```
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  trip_sheet_id uuid NOT NULL FK->trip_sheets(id) RESTRICT
  vehicle_id uuid NOT NULL FK->vehicles(id) RESTRICT   -- denormalizat din foaie, pentru rapoarte
  litri numeric(8,2) NOT NULL
  pret_unitar numeric(10,4)
  cost numeric(14,2) NOT NULL
  statie text
  numar_bon text
  fisier_bon_path text
  alimentat_la timestamptz NOT NULL
  km_la_alimentare int
  plin_complet boolean NOT NULL DEFAULT true
```
constrangeri:
```
  CHECK(litri > 0 AND litri <= 2000)
  CHECK(cost >= 0)
  CHECK(pret_unitar IS NULL OR pret_unitar > 0)
  CHECK(pret_unitar IS NULL OR abs(cost - round(litri * pret_unitar, 2)) <= 0.05)
  UNIQUE(organization_id, vehicle_id, numar_bon, alimentat_la) WHERE deleted_at IS NULL AND numar_bon IS NOT NULL
```
indexuri: `(organization_id, vehicle_id, alimentat_la DESC) WHERE deleted_at IS NULL`; `(trip_sheet_id) WHERE deleted_at IS NULL`
rls: `SELECT/INSERT/UPDATE = derivat din foaia parinte` (subquery `EXISTS` pe `trip_sheets` cu aceleasi conditii; INSERT permis doar cat timp foaia e `draft`/`respins`); `DELETE = niciuna`
nota: `vehicle_id` denormalizat + trigger care il sincronizeaza din foaie **si** verifica egalitatea — altfel raportul lunar per vehicul ar cere join la fiecare rand. `alimentat_la` trebuie validat in interval `[plecare_la, coalesce(sosire_la, now())]` prin trigger; un CHECK nu poate face referire la alta tabela.

### odometer_anomalies
scop: jurnal al discontinuitatilor de kilometraj detectate intre foi consecutive.
coloane:
```
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  vehicle_id uuid NOT NULL FK->vehicles(id) RESTRICT
  trip_sheet_id uuid NOT NULL FK->trip_sheets(id) RESTRICT
  previous_trip_sheet_id uuid FK->trip_sheets(id) SET NULL
  tip odometer_anomaly_type NOT NULL
  km_asteptat int NOT NULL
  km_raportat int NOT NULL
  diferenta int GENERATED ALWAYS AS (km_raportat - km_asteptat) STORED
  status alert_status NOT NULL DEFAULT 'new'
  acknowledged_by uuid FK->auth.users(id) SET NULL
  acknowledged_at timestamptz
  note text
```
constrangeri: `UNIQUE(trip_sheet_id, tip) WHERE deleted_at IS NULL`
indexuri: `(organization_id, vehicle_id, status) WHERE deleted_at IS NULL`
rls: `SELECT = perm 'fleet.read'`; `UPDATE = perm 'fleet.trip.approve'`; `INSERT = niciuna` (scrie triggerul)
nota: `gap_neacoperit` (km_plecare > ultimul km_sosire) e **avertisment**, se logheaza si se aproba mai departe — reflecta curse personale sau foi neintroduse. `regres` (km_plecare < ultimul km_sosire) e **eroare blocanta**: ori odometrul a fost inlocuit, ori datele sunt gresite; se deblocheaza doar cu perm `fleet.odometer.override`.

## B1. Prepopularea `km_plecare` (query real)

```sql
-- Server Action: getKmPlecareSugerat(vehicleId). organization_id NU vine de la client;
-- RLS pe trip_sheets/vehicles il impune oricum.
SELECT
  v.id                                   AS vehicle_id,
  v.nr_inmatriculare,
  greatest(
    coalesce(ultima.km_sosire, 0),
    v.km_curent                          -- acopera vehiculele nou introduse, fara foi
  )                                      AS km_plecare_sugerat,
  ultima.id                              AS ultima_foaie_id,
  ultima.numar_foaie,
  ultima.sosire_la                       AS ultima_sosire_la,
  ultima.km_sosire                       AS ultima_km_sosire,
  (ultima.km_sosire IS NOT NULL AND v.km_curent > ultima.km_sosire) AS exista_discrepanta
FROM public.vehicles v
LEFT JOIN LATERAL (
  SELECT ts.id, ts.numar_foaie, ts.km_sosire, ts.sosire_la
  FROM public.trip_sheets ts
  WHERE ts.vehicle_id  = v.id
    AND ts.deleted_at IS NULL
    AND ts.status IN ('trimis','aprobat')     -- draft-urile altui sofer nu sunt sursa de adevar
    AND ts.km_sosire IS NOT NULL
  ORDER BY ts.sosire_la DESC, ts.km_sosire DESC, ts.id DESC
  LIMIT 1
) ultima ON true
WHERE v.id = $1 AND v.deleted_at IS NULL AND v.status = 'activ';
```
Indexul `(organization_id, vehicle_id, plecare_la DESC)` acopera `LATERAL`-ul; adauga si `(vehicle_id, sosire_la DESC) WHERE deleted_at IS NULL AND km_sosire IS NOT NULL` pentru `ORDER BY` exact.

## B2. Detectia discontinuitatii (logica trigger, `BEFORE INSERT OR UPDATE` pe `trip_sheets`)

```
la trecerea status draft -> trimis, sau la UPDATE al km_plecare/km_sosire:
  ultima := ultima foaie inchisa a vehiculului cu (sosire_la, id) < (NEW.plecare_la, NEW.id)
  daca ultima IS NULL: iesi
  daca NEW.km_plecare < ultima.km_sosire:
      insert odometer_anomalies(tip='regres', km_asteptat=ultima.km_sosire, km_raportat=NEW.km_plecare)
      RAISE EXCEPTION 'Kilometrajul de plecare (%) este mai mic decat sosirea foii % (%).'
        -- exceptata daca app.has_perm(org,'fleet.odometer.override')
  daca NEW.km_plecare - ultima.km_sosire > 0:
      insert odometer_anomalies(tip='gap_neacoperit', ...) ON CONFLICT DO NOTHING   -- doar avertisment
  daca NEW.km_sosire - NEW.km_plecare > coalesce(setari.km_max_zi, 1500) * durata_zile:
      insert odometer_anomalies(tip='salt_anormal', ...)
  suprapunere temporala: EXISTS foaie a aceluiasi vehicul cu tstzrange(plecare_la, sosire_la) && NEW
      -> EXCEPTION (acelasi vehicul nu poate fi in doua curse simultan)

AFTER UPDATE, la status -> 'aprobat':
  UPDATE vehicles SET km_curent = GREATEST(km_curent, NEW.km_sosire),
                      km_curent_updated_at = now()
  WHERE id = NEW.vehicle_id;    -- GREATEST, nu atribuire: aprobarile pot veni in alta ordine decat cursele
```

## B3. Consum real l/100km vs declarat

```sql
-- $1 = organization_id, $2 = data_start, $3 = data_end (interval inchis)
WITH km AS (
  SELECT ts.vehicle_id, sum(ts.km_parcursi)::numeric AS km_total, count(*) AS nr_foi
  FROM public.trip_sheets ts
  WHERE ts.organization_id = $1 AND ts.deleted_at IS NULL AND ts.status = 'aprobat'
    AND ts.sosire_la >= $2::date AND ts.sosire_la < ($3::date + 1)
  GROUP BY ts.vehicle_id
),
alim AS (
  SELECT fe.vehicle_id, sum(fe.litri) AS litri_total, sum(fe.cost) AS cost_total
  FROM public.fuel_entries fe
  JOIN public.trip_sheets ts ON ts.id = fe.trip_sheet_id AND ts.status = 'aprobat'
                            AND ts.deleted_at IS NULL
  WHERE fe.organization_id = $1 AND fe.deleted_at IS NULL
    AND fe.alimentat_la >= $2::date AND fe.alimentat_la < ($3::date + 1)
  GROUP BY fe.vehicle_id
)
SELECT
  v.id, v.nr_inmatriculare, v.marca, v.model,
  km.km_total, alim.litri_total, alim.cost_total,
  v.consum_mediu_declarat,
  round(alim.litri_total * 100.0 / nullif(km.km_total, 0), 2)               AS consum_real,
  round((alim.litri_total * 100.0 / nullif(km.km_total, 0)
         - v.consum_mediu_declarat) * 100.0
        / nullif(v.consum_mediu_declarat, 0), 2)                            AS abatere_pct,
  CASE
    WHEN v.consum_mediu_declarat IS NULL OR km.km_total IS NULL
      OR km.km_total < 300 THEN 'insuficiente_date'
    WHEN (alim.litri_total * 100.0 / km.km_total - v.consum_mediu_declarat) * 100.0
         / v.consum_mediu_declarat >  v.prag_abatere_consum_pct THEN 'depasire'
    WHEN (alim.litri_total * 100.0 / km.km_total - v.consum_mediu_declarat) * 100.0
         / v.consum_mediu_declarat < -v.prag_abatere_consum_pct THEN 'sub_consum'
    ELSE 'normal'
  END                                                                        AS semnalare
FROM public.vehicles v
LEFT JOIN km   ON km.vehicle_id = v.id
LEFT JOIN alim ON alim.vehicle_id = v.id
WHERE v.organization_id = $1 AND v.deleted_at IS NULL AND v.status <> 'casat'
ORDER BY abatere_pct DESC NULLS LAST;
```
Prag implicit **15%** (`vehicles.prag_abatere_consum_pct`, suprascriptibil per vehicul — un camion incarcat si un autoturism nu au aceeasi dispersie). Reguli anti-fals-pozitiv, obligatorii:
- sub **300 km** intr-o perioada rezultatul e zgomot → `insuficiente_date`, nu alerta.
- Un plin la sfarsitul lunii care se consuma luna urmatoare deplaseaza raportul. De aceea `plin_complet` exista: media corecta se calculeaza **intre doua plinuri** (`tank-to-tank`), iar raportul lunar e o aproximare declarata ca atare in UI. Pentru analiza serioasa foloseste ferestre de minim 3 luni sau segmente intre alimentari `plin_complet = true`.
- `sub_consum` este semnalat la fel de mult ca `depasire`: inseamna de regula bonuri lipsa sau km fictivi, nu eficienta.

## B4. Rapoarte lunare

```sql
-- $1 = organization_id, $2 = luna (orice zi din luna, ex. '2026-08-01'::date)
WITH per AS (
  SELECT date_trunc('month', $2::date)::date AS luna_start,
         (date_trunc('month', $2::date) + interval '1 month')::date AS luna_end
),
km AS (
  SELECT ts.vehicle_id,
         sum(ts.km_parcursi)::int AS km_luna,
         count(*)::int            AS nr_foi,
         count(DISTINCT ts.driver_employee_id)::int AS nr_soferi
  FROM public.trip_sheets ts, per
  WHERE ts.organization_id = $1 AND ts.deleted_at IS NULL AND ts.status = 'aprobat'
    AND ts.sosire_la >= per.luna_start AND ts.sosire_la < per.luna_end
  GROUP BY ts.vehicle_id
),
comb AS (
  SELECT fe.vehicle_id, sum(fe.litri) AS litri, sum(fe.cost) AS cost_combustibil
  FROM public.fuel_entries fe, per
  WHERE fe.organization_id = $1 AND fe.deleted_at IS NULL
    AND fe.alimentat_la >= per.luna_start AND fe.alimentat_la < per.luna_end
  GROUP BY fe.vehicle_id
),
docs AS (   -- costuri de conformitate esalonate liniar pe durata de valabilitate
  SELECT vd.vehicle_id,
         sum(vd.cost * (least(vd.expira_la, per.luna_end) - greatest(vd.valabil_de_la, per.luna_start))::numeric
             / nullif((vd.expira_la - vd.valabil_de_la)::numeric, 0)) AS cost_documente
  FROM public.vehicle_documents vd, per
  WHERE vd.organization_id = $1 AND vd.deleted_at IS NULL
    AND vd.valabil_de_la < per.luna_end AND vd.expira_la >= per.luna_start
  GROUP BY vd.vehicle_id
)
SELECT
  v.nr_inmatriculare, v.marca || ' ' || v.model AS vehicul, v.categorie, v.tip_combustibil,
  coalesce(km.km_luna, 0)                                   AS km_parcursi,
  coalesce(km.nr_foi, 0)                                    AS foi_de_parcurs,
  coalesce(comb.litri, 0)                                   AS litri,
  coalesce(comb.cost_combustibil, 0)                        AS cost_combustibil,
  round(coalesce(docs.cost_documente, 0), 2)                AS cost_documente_alocat,
  round(coalesce(comb.cost_combustibil, 0)
        / nullif(km.km_luna, 0), 4)                         AS cost_combustibil_per_km,
  round((coalesce(comb.cost_combustibil, 0) + coalesce(docs.cost_documente, 0))
        / nullif(km.km_luna, 0), 4)                         AS cost_total_per_km,
  round(coalesce(comb.litri, 0) * 100.0 / nullif(km.km_luna, 0), 2) AS consum_real_l_100km,
  v.consum_mediu_declarat
FROM public.vehicles v
LEFT JOIN km   ON km.vehicle_id = v.id
LEFT JOIN comb ON comb.vehicle_id = v.id
LEFT JOIN docs ON docs.vehicle_id = v.id
WHERE v.organization_id = $1 AND v.deleted_at IS NULL
  AND v.status IN ('activ','in_service','rezervat','indisponibil')
ORDER BY km_parcursi DESC;
```
Export exceljs: `cost` si `cost_*_per_km` se scriu ca `number` cu `numFmt '#,##0.00 "lei"'` — nu ca string preformatat. Formatarea `1.234,56 lei` se aplica doar in UI (`Intl.NumberFormat('ro-RO')`), niciodata in SQL. Toate filtrele pe timp folosesc `>= start AND < end` (half-open) pe `timestamptz`, cu conversia la `Europe/Bucharest` facuta la limita: `ts.sosire_la AT TIME ZONE 'Europe/Bucharest'` daca "luna" trebuie sa fie luna calendaristica locala — altfel cursele din 31 la 23:30 cad in luna urmatoare vara.

**Integrarea fleet ↔ infrastructura A:** un singur trigger `fn_sync_expirable_vehicle_document()` pe `vehicle_documents` + un trigger de reactivare/dezactivare pe `vehicles.status`. `alert_rules` primeste la seed-ul organizatiei un rand `(entity_type='vehicle_document', kind=NULL, {30,14,7})` si unul specific `(entity_type='vehicle_document', kind='rca', {30,14,7,3})` — RCA expirat inseamna amenda si retinerea placutelor, deci merita un prag suplimentar.