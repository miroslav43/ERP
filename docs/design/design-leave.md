## Enum-uri Postgres introduse

```
leave_request_status: draft, trimisa, aprobata_manager, aprobata, respinsa, anulata, retrasa
leave_counting_mode:  zile_lucratoare, zile_calendaristice
leave_pay_source:     angajator, fnuass, buget_asigurari_sociale, neplatit
leave_accrual_event:  drept_initial, acumulare_lunara, reportare, expirare_reportate, consum, anulare_consum, ajustare_manuala, lichidare
holiday_type:         fix, mobil
org_day_kind:         zi_libera, punte, zi_lucratoare_recuperare
approval_status:      in_asteptare, aprobat, respins, anulat, expirat
approval_step_status: in_asteptare, aprobat, respins, sarit, delegat
approval_action_kind: aprobat, respins, delegat, comentariu, retras, auto_aprobat
approver_rule:        manager_direct, sef_departament, rol_in_organizatie, utilizator_fix, solicitant_insusi
```

Extensii necesare: `btree_gist` (constrângere de non-suprapunere pe intervale).
Funcții helper presupuse (există deja în nucleu): `current_org_id()`, `current_employee_id()`, `is_hr()`, `is_org_admin()`, `is_manager_of(uuid)`, `has_perm(text)`, `feature_on('leave')`.

---

## Tabele

### leave_types
scop: catalog de tipuri de concediu, configurabil per organizație și versionat în timp.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
key text NOT NULL                       -- odihna, medical, maternitate, paternal, crestere_copil,
                                        -- casatorie, nastere_copil, deces_ruda, donator_sange,
                                        -- ingrijitor, fara_plata, sau custom_*
denumire text NOT NULL
descriere text
zile_implicite numeric(5,2) NOT NULL DEFAULT 0
mod_numarare leave_counting_mode NOT NULL DEFAULT 'zile_lucratoare'
scade_din_sold boolean NOT NULL DEFAULT true
permite_sold_negativ boolean NOT NULL DEFAULT false
limita_sold_negativ numeric(5,2) NOT NULL DEFAULT 0
necesita_document boolean NOT NULL DEFAULT false
document_termen_zile int                -- în câte zile de la start trebuie încărcat actul
se_reporteaza boolean NOT NULL DEFAULT false
termen_reportare_luni int               -- luni de la 31.12 al anului de drept; RO odihnă = 18
culoare text NOT NULL DEFAULT '#64748b'
approval_flow_id uuid FK->approval_flows(id) RESTRICT   -- înlocuiește "cine_aproba", vezi (g)
plata_procent numeric(5,2) NOT NULL DEFAULT 100
suportat_de leave_pay_source NOT NULL DEFAULT 'angajator'
max_zile_pe_cerere int
max_zile_pe_an numeric(5,2)
preaviz_zile int NOT NULL DEFAULT 0
permite_jumatate_zi boolean NOT NULL DEFAULT true
necesita_inlocuitor boolean NOT NULL DEFAULT false
activ boolean NOT NULL DEFAULT true
valabil_de_la date NOT NULL
valabil_pana_la date
```
constrângeri: `UNIQUE(organization_id, key, valabil_de_la) WHERE deleted_at IS NULL`; `CHECK(valabil_pana_la IS NULL OR valabil_pana_la > valabil_de_la)`; `CHECK(culoare ~ '^#[0-9a-fA-F]{6}$')`; `CHECK(plata_procent BETWEEN 0 AND 100)`; `CHECK(zile_implicite >= 0)`; `EXCLUDE USING gist (organization_id WITH =, key WITH =, daterange(valabil_de_la, valabil_pana_la, '[)') WITH &&) WHERE (deleted_at IS NULL)`
indexuri: `(organization_id, activ, key) WHERE deleted_at IS NULL`
rls: SELECT = `organization_id = current_org_id()`; INSERT/UPDATE = `has_perm('leave.types.manage')` (hr, org_admin); DELETE = nimeni (soft delete prin UPDATE).
notă: versionare prin `valabil_de_la` — o modificare de politică creează rând nou, nu editează istoricul. Cererile și soldurile stochează ȘI `leave_type_key` (imutabil, denormalizat) pe lângă `leave_type_id` (versiunea aplicată la momentul deciziei), altfel rapoartele multi-an se rup la fiecare versiune nouă.
notă: `mod_numarare = zile_calendaristice` este obligatoriu pentru maternitate (126 zile calendaristice) și creștere copil — nu sunt zile lucrătoare.

Seed implicit RO (`valabil_de_la = '2020-01-01'`, `zile_implicite` = minimul legal):

| key | denumire | zile | scade_sold | doc | reportare |
|---|---|---|---|---|---|
| odihna | Concediu de odihnă | 20 | da | nu | da, 18 luni |
| medical | Concediu medical | 0 | nu | da (5 zile) | nu |
| maternitate | Concediu de maternitate | 126 (calendaristice) | nu | da | nu |
| paternal | Concediu paternal | 10 | nu | da | nu |
| crestere_copil | Concediu creștere copil | 0 (calendaristice) | nu | da | nu |
| casatorie | Căsătoria salariatului | 5 | nu | da | nu |
| nastere_copil | Nașterea unui copil | 5 | nu | da | nu |
| deces_ruda | Deces rudă gr. I/II | 3 | nu | da | nu |
| donator_sange | Donator de sânge | 1 | nu | da | nu |
| ingrijitor | Concediu de îngrijitor | 5 | nu | da | nu |
| fara_plata | Concediu fără plată | 0 | nu | nu | nu |

---

### leave_requests
scop: cererea de concediu, cu perioada, zilele calculate și legătura către instanța de aprobare.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
employee_id uuid NOT NULL FK->employees(id) RESTRICT
leave_type_id uuid NOT NULL FK->leave_types(id) RESTRICT
leave_type_key text NOT NULL
start_date date NOT NULL
end_date date NOT NULL
half_day_start boolean NOT NULL DEFAULT false
half_day_end boolean NOT NULL DEFAULT false
mod_numarare leave_counting_mode NOT NULL
working_days numeric(5,2) NOT NULL         -- calculat server-side, NU generated (depinde de alte tabele)
calendar_days int NOT NULL
balance_year int NOT NULL
zile_din_reportate numeric(5,2) NOT NULL DEFAULT 0
zile_din_drept_curent numeric(5,2) NOT NULL DEFAULT 0
motiv text
inlocuitor_employee_id uuid FK->employees(id) RESTRICT
atasament_path text                        -- bucket privat leave-documents/{org}/{request}
atasament_incarcat_la timestamptz
status leave_request_status NOT NULL DEFAULT 'draft'
approval_instance_id uuid FK->approval_instances(id) RESTRICT
submitted_at timestamptz
decided_at timestamptz
motiv_respingere text
anulata_la timestamptz
anulata_de uuid
motiv_anulare text
```
constrângeri: `CHECK(end_date >= start_date)`; `CHECK(working_days >= 0)`; `CHECK(status <> 'respinsa' OR motiv_respingere IS NOT NULL)`; `CHECK(zile_din_reportate + zile_din_drept_curent <= working_days)`; `EXCLUDE USING gist (employee_id WITH =, daterange(start_date, end_date, '[]') WITH &&) WHERE (deleted_at IS NULL AND status IN ('trimisa','aprobata_manager','aprobata'))`
indexuri: `(organization_id, employee_id, start_date DESC) WHERE deleted_at IS NULL`; `(organization_id, status) WHERE deleted_at IS NULL AND status IN ('trimisa','aprobata_manager')`; `(organization_id, leave_type_key, balance_year)`
rls: SELECT = `organization_id = current_org_id() AND (employee_id = current_employee_id() OR is_manager_of(employee_id) OR is_hr() OR is_org_admin())`; INSERT = `employee_id = current_employee_id() OR has_perm('leave.request.create_for_others')`; UPDATE = solicitantul doar în `draft`/`trimisa` (retragere), altfel `has_perm('leave.request.decide')` prin Server Action; DELETE = nimeni.
notă: constrângerea EXCLUDE blochează și două jumătăți de zi valide în aceeași zi (dimineața dintr-un tip, după-amiaza din altul). Dacă produsul cere asta, se mută validarea de suprapunere pe `leave_request_days` cu `UNIQUE(employee_id, data, jumatate)`; recomandarea este să nu se permită — complexitate fără valoare pentru IMM.
notă: cererea care traversează 31.12 se sparge în două cereri legate (`parent_request_id` opțional) — un singur rând nu poate consuma corect din două solduri anuale.

---

### leave_request_days
scop: expandarea cererii pe zile efective, sursa pentru calendar, raport de absenteism și detecția conflictelor de echipă.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
leave_request_id uuid NOT NULL FK->leave_requests(id) ON DELETE CASCADE
employee_id uuid NOT NULL FK->employees(id) RESTRICT
department_id uuid FK->departments(id) RESTRICT
leave_type_key text NOT NULL
data date NOT NULL
fractiune numeric(3,2) NOT NULL DEFAULT 1
status leave_request_status NOT NULL
```
constrângeri: `UNIQUE(leave_request_id, data)`; `CHECK(fractiune IN (0.5, 1))`
indexuri: `(organization_id, data)`; `(organization_id, employee_id, data)`; `(organization_id, department_id, data)`
rls: identică cu `leave_requests` (aceleași predicate, evaluate direct pe coloanele denormalizate — fără EXISTS către părinte).
notă: singura tabelă din modul care se șterge fizic — este date derivate, regenerate integral la fiecare modificare a cererii. `status` și `department_id` sunt denormalizate intenționat ca RLS și query-ul de conflict să nu facă join.

---

### leave_balances
scop: soldul agregat per angajat, tip de concediu și an; sursă unică pentru afișare și validare.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
employee_id uuid NOT NULL FK->employees(id) RESTRICT
leave_type_id uuid NOT NULL FK->leave_types(id) RESTRICT
leave_type_key text NOT NULL
an int NOT NULL
drept_anual numeric(6,2) NOT NULL DEFAULT 0          -- dreptul teoretic pentru an întreg
drept_acumulat numeric(6,2) NOT NULL DEFAULT 0       -- proporțional, crește lunar
reportate numeric(6,2) NOT NULL DEFAULT 0
folosite_din_reportate numeric(6,2) NOT NULL DEFAULT 0
reportate_expirate numeric(6,2) NOT NULL DEFAULT 0
termen_folosire_reportate date
folosite numeric(6,2) NOT NULL DEFAULT 0             -- total consumat (incl. din reportate)
in_asteptare numeric(6,2) NOT NULL DEFAULT 0
ajustari numeric(6,2) NOT NULL DEFAULT 0
ramase numeric(6,2) GENERATED ALWAYS AS
  (drept_acumulat + reportate - reportate_expirate + ajustari - folosite - in_asteptare) STORED
recalculat_la timestamptz
```
constrângeri: `UNIQUE(organization_id, employee_id, leave_type_key, an) WHERE deleted_at IS NULL`; `CHECK(an BETWEEN 2000 AND 2100)`; `CHECK(folosite >= 0 AND in_asteptare >= 0 AND reportate >= 0)`; `CHECK(folosite_din_reportate <= reportate)`
indexuri: `(organization_id, an, leave_type_key) WHERE deleted_at IS NULL`; `(organization_id, an) INCLUDE (ramase) WHERE deleted_at IS NULL`; `(organization_id, termen_folosire_reportate) WHERE termen_folosire_reportate IS NOT NULL`
rls: SELECT = self OR `is_manager_of(employee_id)` OR `is_hr()`; INSERT/UPDATE = doar prin funcții `SECURITY DEFINER` invocate din Server Actions (rolul `authenticated` nu are grant direct de UPDATE); DELETE = nimeni.
notă: `ramase` e generated, deci nu poate fi desincronizat de un UPDATE parțial. Consistența cu `leave_accruals` se verifică printr-un test de reconciliere (suma delta pe câmp = valoarea curentă), rulat nocturn.

---

### leave_accruals
scop: jurnal append-only care explică de ce soldul are valoarea curentă.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
balance_id uuid NOT NULL FK->leave_balances(id) RESTRICT
employee_id uuid NOT NULL FK->employees(id) RESTRICT
leave_type_key text NOT NULL
an int NOT NULL
eveniment leave_accrual_event NOT NULL
camp_afectat text NOT NULL
delta numeric(6,2) NOT NULL
sold_dupa numeric(6,2) NOT NULL
motiv text NOT NULL
data_efect date NOT NULL
leave_request_id uuid FK->leave_requests(id) RESTRICT
sursa text NOT NULL DEFAULT 'server_action'    -- server_action | cron | import | migrare
cheie_idempotenta text
```
constrângeri: `CHECK(delta <> 0)`; `CHECK(camp_afectat IN ('drept_acumulat','reportate','folosite','folosite_din_reportate','in_asteptare','ajustari','reportate_expirate'))`; `UNIQUE(balance_id, cheie_idempotenta) WHERE cheie_idempotenta IS NOT NULL`
indexuri: `(organization_id, employee_id, an, data_efect DESC)`; `(leave_request_id) WHERE leave_request_id IS NOT NULL`
rls: SELECT = self OR `is_manager_of(employee_id)` OR `is_hr()`; INSERT = doar `SECURITY DEFINER`; UPDATE/DELETE = `USING (false)` + `REVOKE UPDATE, DELETE`.
notă: `cheie_idempotenta` (ex. `acumulare:2026-03`) face cron-ul lunar re-rulabil fără dublare. Fără ea, o repornire de job dublează soldurile întregii organizații.

---

### public_holidays
scop: sărbătorile legale naționale, comune tuturor organizațiilor.
coloane:
```
id uuid PK
tara text NOT NULL DEFAULT 'RO'
an int NOT NULL
data date NOT NULL
denumire text NOT NULL
tip holiday_type NOT NULL
regula text                 -- 'fix:01-02' sau 'paste+49'
temei_legal text            -- ex. 'Codul Muncii art. 139'
```
constrângeri: `UNIQUE(tara, data) WHERE deleted_at IS NULL`; `CHECK(an = EXTRACT(year FROM data))`; `CHECK(tara ~ '^[A-Z]{2}$')`
indexuri: `(tara, an)`; `(data)`
rls: SELECT = `auth.role() = 'authenticated'` (fără filtru de org); INSERT/UPDATE/DELETE = `is_super_admin()`.
notă: **singura excepție** de la regula „fiecare tabelă are organization_id”. Este date de platformă, nu de client. Trebuie documentată explicit în testul de izolare RLS, altfel testul automat „orice tabelă filtrează pe org” o raportează fals-pozitiv.

---

### organization_holidays
scop: zilele libere proprii ale firmei (punți, zile de recuperare, sărbători locale).
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
data date NOT NULL
denumire text NOT NULL
tip org_day_kind NOT NULL DEFAULT 'zi_libera'
platita boolean NOT NULL DEFAULT true
department_id uuid FK->departments(id) RESTRICT   -- NULL = toată firma
location_id uuid FK->locations(id) RESTRICT       -- NULL = toate punctele de lucru
an int GENERATED ALWAYS AS (EXTRACT(year FROM data)::int) STORED
```
constrângeri: `UNIQUE(organization_id, data, COALESCE(department_id,'0000...'::uuid), COALESCE(location_id,'0000...'::uuid)) WHERE deleted_at IS NULL`
indexuri: `(organization_id, data) WHERE deleted_at IS NULL`; `(organization_id, an, tip)`
rls: SELECT = `organization_id = current_org_id()`; INSERT/UPDATE = `has_perm('leave.holidays.manage')`; DELETE = nimeni.
notă: `zi_lucratoare_recuperare` **inversează** weekendul (sâmbăta declarată lucrătoare pentru a recupera o punte). Funcția de calcul o tratează ca zi lucrătoare chiar dacă e sâmbătă — sursa clasică de erori de ±1 zi.

---

### org_calendar_days
scop: calendar materializat per organizație (o zi = lucrătoare sau nu), pentru query-uri de raportare fără recalcul.
coloane:
```
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
data date NOT NULL
este_lucratoare boolean NOT NULL
motiv text                  -- 'weekend' | 'sarbatoare_legala' | 'punte' | 'recuperare'
PK (organization_id, data)
```
constrângeri: PK compus, fără soft delete (tabelă derivată)
indexuri: `(organization_id, data) WHERE este_lucratoare` (implicit prin PK); `(data) WHERE este_lucratoare`
rls: SELECT = `organization_id = current_org_id()`; scriere = doar `SECURITY DEFINER` (regenerare la modificarea sărbătorilor).
notă: derivată, regenerabilă. Fără ea, raportul de absenteism ar face `generate_series` + anti-join pe fiecare rulare.

---

## Infrastructura de aprobări (decizia (g))

### approval_flows
scop: definiția reutilizabilă a unui lanț de aprobare, per tip de entitate.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
entity_type text NOT NULL      -- leave_request | timesheet | trip_sheet | per_diem | checklist
key text NOT NULL
denumire text NOT NULL
activ boolean NOT NULL DEFAULT true
valabil_de_la date NOT NULL
```
constrângeri: `UNIQUE(organization_id, entity_type, key, valabil_de_la) WHERE deleted_at IS NULL`; `CHECK(entity_type IN (...))`
indexuri: `(organization_id, entity_type, activ) WHERE deleted_at IS NULL`
rls: SELECT = org; INSERT/UPDATE = `has_perm('approvals.flows.manage')`; DELETE = nimeni.

### approval_steps
scop: pașii ordonați dintr-un flux și regula prin care se determină aprobatorul.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
flow_id uuid NOT NULL FK->approval_flows(id) RESTRICT
ordine int NOT NULL
denumire text NOT NULL
regula approver_rule NOT NULL
rol app_role                        -- când regula = rol_in_organizatie
utilizator_id uuid                  -- când regula = utilizator_fix
obligatoriu boolean NOT NULL DEFAULT true
permite_delegare boolean NOT NULL DEFAULT true
sla_ore int
conditie_sarire jsonb               -- ex. {"working_days": {"lte": 2}} => se sare pasul HR
```
constrângeri: `UNIQUE(flow_id, ordine)`; `CHECK((regula='rol_in_organizatie') = (rol IS NOT NULL))`; `CHECK((regula='utilizator_fix') = (utilizator_id IS NOT NULL))`
indexuri: `(flow_id, ordine)`
rls: identică cu `approval_flows`.

### approval_instances
scop: execuția unui flux pentru o entitate concretă (polimorfă).
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
flow_id uuid NOT NULL FK->approval_flows(id) RESTRICT
entity_type text NOT NULL
entity_id uuid NOT NULL
solicitant_employee_id uuid NOT NULL FK->employees(id) RESTRICT
solicitant_user_id uuid NOT NULL
status approval_status NOT NULL DEFAULT 'in_asteptare'
pas_curent int NOT NULL DEFAULT 1
deschisa_la timestamptz NOT NULL DEFAULT now()
inchisa_la timestamptz
```
constrângeri: `UNIQUE(entity_type, entity_id) WHERE deleted_at IS NULL`; `CHECK((status = 'in_asteptare') = (inchisa_la IS NULL))`
indexuri: `(organization_id, status, pas_curent)`; `(entity_type, entity_id)`
rls: SELECT = `organization_id = current_org_id() AND (solicitant_user_id = auth.uid() OR is_hr() OR is_org_admin() OR EXISTS(SELECT 1 FROM approval_tasks t WHERE t.instance_id = id AND t.approver_user_id = auth.uid()))`; INSERT/UPDATE = doar `SECURITY DEFINER`; DELETE = nimeni.

### approval_tasks
scop: sarcina concretă a unui aprobator; este inbox-ul unificat și, esențial, ancora RLS.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
instance_id uuid NOT NULL FK->approval_instances(id) RESTRICT
step_id uuid NOT NULL FK->approval_steps(id) RESTRICT
ordine int NOT NULL
approver_user_id uuid NOT NULL
entity_type text NOT NULL          -- denormalizat pentru inbox
entity_id uuid NOT NULL
rezumat text NOT NULL              -- „Concediu de odihnă 12.08–20.08, 7 zile"
status approval_step_status NOT NULL DEFAULT 'in_asteptare'
termen timestamptz
```
constrângeri: `UNIQUE(instance_id, ordine, approver_user_id) WHERE deleted_at IS NULL`
indexuri: `(approver_user_id, status) WHERE status = 'in_asteptare'`; `(organization_id, entity_type, entity_id)`
rls: SELECT = `approver_user_id = auth.uid() OR is_hr() OR is_org_admin()`; UPDATE = `approver_user_id = auth.uid()` prin Server Action; DELETE = nimeni.

### approval_actions
scop: jurnal imutabil al deciziilor.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
instance_id uuid NOT NULL FK->approval_instances(id) RESTRICT
task_id uuid FK->approval_tasks(id) RESTRICT
actor_user_id uuid NOT NULL
actiune approval_action_kind NOT NULL
comentariu text
delegat_catre_user_id uuid
actionat_la timestamptz NOT NULL DEFAULT now()
```
constrângeri: `CHECK(actiune <> 'respins' OR comentariu IS NOT NULL)`; `CHECK((actiune='delegat') = (delegat_catre_user_id IS NOT NULL))`
indexuri: `(instance_id, actionat_la)`
rls: SELECT = ca la `approval_instances`; INSERT = `SECURITY DEFINER`; UPDATE/DELETE = `USING (false)`.

---

## (g) Decizia: infrastructură generică vs. tabele per modul

**Opțiunea A — tabele separate per modul** (`leave_approvals`, `timesheet_approvals`, ...): RLS trivială (FK direct la entitate), tipare puternic tipizate, migrări independente. Costuri: 5+ copii ale aceleiași logici de stare, 5 inbox-uri diferite (utilizatorul nu are un „De aprobat" unic), 5 implementări de delegare/SLA/escaladare, iar orice regulă nouă (ex. „peste 10 zile intră și org_admin") se implementează de 5 ori. Pentru un ERP cu 12 module, e datorie tehnică garantată.

**Opțiunea B — infrastructură generică polimorfă**: o singură mașină de stare, un singur inbox, o singură implementare de delegare/notificări/rapoarte de întârziere. Obiecția reală este RLS: o politică de tip „vezi instanța dacă poți vedea entitatea" ar necesita `CASE entity_type WHEN ... THEN EXISTS(SELECT 1 FROM leave_requests ...)`, adică o politică ce crește cu fiecare modul și care nu poate folosi index.

**Recomandare fermă: opțiunea B, cu ocolirea obiecției prin `approval_tasks`.** Nu se face niciodată RLS „prin entitate". Vizibilitatea se derivă din trei coloane denormalizate pe rândurile de aprobare: `organization_id`, `solicitant_user_id`, `approver_user_id`. Politica devine o comparație pe coloană indexată, identică pentru toate modulele, independentă de `entity_type`. `entity_type`/`entity_id` rămân doar pentru navigare în UI — nu apar niciodată într-un predicat RLS.

Consecințe de respectat:
1. FK-ul polimorf nu este garantat de bază — integritatea se asigură prin funcția `SECURITY DEFINER` care e singura cale de creare a instanțelor (`deschide_aprobare(entity_type, entity_id, ...)`), plus un job nocturn de detectare a instanțelor orfane.
2. Entitatea își păstrează propriul `status` (`leave_requests.status`), sincronizat de un trigger pe `approval_instances`. Statusul de business nu se citește niciodată prin join polimorf — rapoartele rămân simple.
3. Aprobatorii se materializează în `approval_tasks` la deschiderea pasului, nu se calculează la citire. Schimbarea managerului nu rescrie retroactiv aprobările deja acordate.

Flux implicit pentru `leave_request` (seed): pas 1 `manager_direct` (obligatoriu), pas 2 `rol_in_organizatie = hr` cu `conditie_sarire = {"working_days":{"lte":2},"leave_type_key":{"in":["donator_sange","deces_ruda"]}}`.

---

## (a) Sărbători legale RO

**Fixe (11 zile):** 1 și 2 ianuarie (Anul Nou), 6 ianuarie (Bobotează), 7 ianuarie (Sf. Ioan Botezătorul), 24 ianuarie (Unirea Principatelor), 1 mai (Ziua Muncii), 1 iunie (Ziua Copilului), 15 august (Adormirea Maicii Domnului), 30 noiembrie (Sf. Andrei), 1 decembrie (Ziua Națională), 25 și 26 decembrie (Crăciunul).

**Mobile (5 zile), offset în zile față de duminica Paștelui ortodox:**

| offset | denumire |
|---|---|
| −2 | Vinerea Mare |
| 0 | Prima zi de Paște |
| +1 | A doua zi de Paște |
| +49 | Prima zi de Rusalii |
| +50 | A doua zi de Rusalii |

Total: 16 zile/an. În România sărbătoarea care cade în weekend **nu se mută** și nu se recuperează — nu se adaugă zi liberă compensatorie.

```ts
/**
 * Data Paștelui ortodox pentru un an dat.
 * Algoritmul Meeus (varianta iuliană) produce data în calendarul iulian;
 * conversia în gregorian se face prin decalajul de secol (13 zile pentru 1900–2099).
 * Întoarce un Date fixat la 00:00 UTC — niciodată ora locală, altfel DST mută ziua.
 */
export function pasteOrtodox(an: number): Date {
  if (!Number.isInteger(an) || an < 1583 || an > 2199) {
    throw new RangeError(`An nesuportat pentru calculul Paștelui ortodox: ${an}`);
  }

  const a = an % 4;
  const b = an % 7;
  const c = an % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;

  const lunaIuliana = Math.floor((d + e + 114) / 31); // 3 = martie, 4 = aprilie
  const ziIuliana = ((d + e + 114) % 31) + 1;

  // Decalaj iulian -> gregorian, în zile.
  const decalajZile = Math.floor(an / 100) - Math.floor(an / 400) - 2;

  const msIulian = Date.UTC(an, lunaIuliana - 1, ziIuliana);
  return new Date(msIulian + decalajZile * 86_400_000);
}

export const OFFSETURI_MOBILE_RO = [
  { offset: -2, denumire: 'Vinerea Mare' },
  { offset: 0, denumire: 'Prima zi de Paște' },
  { offset: 1, denumire: 'A doua zi de Paște' },
  { offset: 49, denumire: 'Prima zi de Rusalii' },
  { offset: 50, denumire: 'A doua zi de Rusalii' },
] as const;

export const ZILE_FIXE_RO = [
  [1, 1, 'Anul Nou'], [1, 2, 'Anul Nou'], [1, 6, 'Bobotează'],
  [1, 7, 'Sfântul Ioan Botezătorul'], [1, 24, 'Unirea Principatelor Române'],
  [5, 1, 'Ziua Muncii'], [6, 1, 'Ziua Copilului'],
  [8, 15, 'Adormirea Maicii Domnului'], [11, 30, 'Sfântul Andrei'],
  [12, 1, 'Ziua Națională a României'], [12, 25, 'Crăciunul'], [12, 26, 'Crăciunul'],
] as const satisfies ReadonlyArray<readonly [number, number, string]>;

export interface SarbatoareLegala {
  readonly data: string; // 'yyyy-MM-dd'
  readonly denumire: string;
  readonly tip: 'fix' | 'mobil';
}

export function sarbatoriLegaleRO(an: number): readonly SarbatoareLegala[] {
  const iso = (d: Date): string => d.toISOString().slice(0, 10);
  const paste = pasteOrtodox(an);

  const fixe = ZILE_FIXE_RO.map(([luna, zi, denumire]) => ({
    data: iso(new Date(Date.UTC(an, luna - 1, zi))),
    denumire,
    tip: 'fix' as const,
  }));

  const mobile = OFFSETURI_MOBILE_RO.map(({ offset, denumire }) => ({
    data: iso(new Date(paste.getTime() + offset * 86_400_000)),
    denumire,
    tip: 'mobil' as const,
  }));

  return [...fixe, ...mobile].sort((x, y) => x.data.localeCompare(y.data));
}
```

Verificare: `pasteOrtodox(2026)` → iulian 30 martie + 13 = **12 aprilie 2026**; `pasteOrtodox(2027)` → **2 mai 2027**. Test obligatoriu pe 2024–2035 cu valori așteptate hardcodate în test (nu recalculate cu aceeași funcție).

---

## (b) Prepopulare anuală: seed multi-an, nu pg_cron

**Recomandare: seed determinist multi-an (2024–2040) într-o migrare versionată, plus un job pg_cron care doar VERIFICĂ acoperirea și alertează. Cron-ul nu calculează nimic.**

Justificare:
1. Datele sunt cunoscute determinist cu ani înainte — nu există niciun motiv să le calculezi „just in time". Un cron care eșuează în noaptea de 31 decembrie sparge calculul zilelor lucrătoare pentru întreaga platformă exact în ziua în care nimeni nu monitorizează.
2. Duplicarea algoritmului Paștelui în PL/pgSQL înseamnă două implementări care pot diverge, și nu poți testa cea din SQL cu Vitest. Cu seed, algoritmul există într-un singur loc (TypeScript, testat), iar migrarea conține doar `INSERT ... ON CONFLICT (tara, data) DO NOTHING` cu valori literale — auditabile la code review.
3. Lista sărbătorilor legale se **schimbă prin lege** (6 și 7 ianuarie au fost adăugate în 2016, Vinerea Mare în 2018). Orice automatizare trebuie oricum revizuită de un om. Un cron care „completează singur" ar produce ani viitori tăcut greșiți.
4. Seed-ul e idempotent, rulează pe orice proiect Supabase resetabil (cerința 5) fără dependență de extensii sau de scheduler.

Job de siguranță (rulează 1 noiembrie, 03:00): dacă `SELECT count(*) FROM public_holidays WHERE tara='RO' AND an = EXTRACT(year FROM now())::int + 2` este 0, trimite email către super_admin prin Resend. Cost: zero risc, alertă cu 14 luni înainte.

Regenerarea `org_calendar_days` rămâne pe pg_cron (nocturn, incremental pe organizațiile cu `organization_holidays` modificate în ultimele 24h) — acolo e legitim, pentru că depinde de date introduse de client.

---

## (c) Funcția pură de calcul al zilelor lucrătoare

```ts
export interface ContextCalendar {
  /** 'yyyy-MM-dd' -> sărbătoare legală națională */
  readonly sarbatoriLegale: ReadonlySet<string>;
  /** zile libere proprii firmei (tip zi_libera sau punte) */
  readonly zileLibereFirma: ReadonlySet<string>;
  /** zile declarate lucrătoare deși cad în weekend (recuperări) */
  readonly zileLucratoareSuplimentare: ReadonlySet<string>;
  /** zilele săptămânii lucrătoare; implicit {1,2,3,4,5}, 0 = duminică */
  readonly zileSaptamana: ReadonlySet<number>;
}

export interface OptiuniZile {
  readonly halfDayStart?: boolean;
  readonly halfDayEnd?: boolean;
  readonly modNumarare?: 'zile_lucratoare' | 'zile_calendaristice';
}

export function calculeazaZileLucratoare(
  startDate: string,   // 'yyyy-MM-dd'
  endDate: string,     // 'yyyy-MM-dd'
  ctx: ContextCalendar,
  opt: OptiuniZile = {},
): number
```

Reguli și cazuri limită:
- `startDate > endDate` → aruncă `RangeError`. Interval mai lung de 400 de zile → aruncă (protecție împotriva unui typo de an care ar genera 40.000 de rânduri în `leave_request_days`).
- `modNumarare = 'zile_calendaristice'` → întoarce numărul de zile inclusiv, ignorând complet weekendul, sărbătorile și jumătățile de zi (maternitate, creștere copil).
- Precedența pe o zi: `zileLucratoareSuplimentare` > `sarbatoriLegale` ∪ `zileLibereFirma` > `zileSaptamana`. O recuperare declarată de firmă bate weekendul; o sărbătoare legală bate o zi de lucru normală.
- `halfDayStart` scade 0,5 **doar dacă prima zi este efectiv lucrătoare**; altfel se ignoră. Idem `halfDayEnd`. Altfel o cerere care începe sâmbăta ar produce −0,5.
- `startDate === endDate` cu ambele flag-uri true → rezultat 0,5, nu 0 (se aplică o singură dată).
- Interval integral în weekend/sărbători → 0. Server Action-ul respinge cererea cu 0 zile lucrătoare pentru tipurile cu `scade_din_sold = true`.
- Iterarea se face pe chei `yyyy-MM-dd` construite în UTC, niciodată cu aritmetică pe `Date` în ora locală — România trece la ora de vară, iar `+86400000` peste 26 octombrie produce aceeași zi de două ori.
- Rezultatul este multiplu de 0,5 și se întoarce ca `number`; persistarea se face în `numeric(5,2)`.
- Funcția este pură: contextul se încarcă separat (o singură interogare pe `org_calendar_days` pentru intervalul cerut) și se injectează. Astfel e testabilă fără bază de date.

---

## (d) Acumularea lunară proporțională

Bază legală: minimum 20 de zile lucrătoare/an, proporțional cu perioada lucrată pentru cei angajați sau plecați în cursul anului.

Formula (calendaristică, nu pe luni întregi — evită discontinuitatea între cineva angajat pe 1 și cineva pe 2 ale lunii):

```
inceput = max(data_angajare, 01.01.AN)
sfarsit = min(data_referinta, COALESCE(data_incetare, 31.12.AN), 31.12.AN)
zile_lucrate = sfarsit - inceput + 1            -- zile calendaristice, inclusiv
zile_an      = 365 sau 366 (an bisect)

drept_brut = drept_anual * zile_lucrate / zile_an     -- numeric(8,4), fără rotunjire
drept_acumulat = ceil(drept_brut * 2) / 2             -- rotunjire în SUS la 0,5 zile
```

Rotunjirea este în sus, la jumătate de zi, în favoarea salariatului — practica standard în RO și singura care nu produce reclamații. Se rotunjește **doar valoarea finală afișată/consumabilă**; `drept_brut` se păstrează la 4 zecimale în `leave_accruals.motiv` (JSON) pentru audit, altfel erorile de rotunjire se acumulează lună de lună.

Exemplu: angajare 17.03.2026, drept anual 21 zile. `zile_lucrate = 31.12 − 17.03 + 1 = 290`; `21 × 290 / 365 = 16,6849`; `ceil(16,6849 × 2)/2 = 17,0` zile.

Execuție: pg_cron, ziua 1 a fiecărei luni la 02:15 Europe/Bucharest, pentru luna încheiată. Pentru fiecare angajat activ:
```
nou = ceil(drept_anual * zile_lucrate_pana_la_sfarsit_luna_precedente / zile_an * 2) / 2
delta = nou - leave_balances.drept_acumulat
```
Dacă `delta <> 0` → UPDATE + rând în `leave_accruals` cu `eveniment='acumulare_lunara'`, `cheie_idempotenta = 'acumulare:2026-03'`. Job-ul devine astfel re-rulabil fără efecte.

La încetarea contractului: eveniment `lichidare` — se recalculează `drept_acumulat` la data încetării; dacă `folosite > drept_acumulat`, diferența se raportează HR pentru reținere, nu se corectează automat soldul.

Reportarea (1 ianuarie, 00:30): pentru tipurile cu `se_reporteaza = true`, `reportate(AN+1) = ramase(AN)`, `termen_folosire_reportate = (31.12.AN + termen_reportare_luni)`. Job separat la aceeași dată marchează `reportate_expirate` pentru soldurile cu termen depășit.

---

## (e) Verificarea soldului la trimitere

Server Action `trimiteCerereConcediu`, într-o singură tranzacție:

1. Derivă `organization_id` din `auth.uid()`; validează payload-ul cu Zod (fără `organization_id` din client).
2. Încarcă versiunea de `leave_types` validă la `start_date`. Dacă `activ = false` sau tipul nu e valabil la acea dată → eroare.
3. Calculează `working_days` server-side. Valoarea trimisă de client se ignoră complet (e doar preview în UI).
4. Verifică `preaviz_zile`, `max_zile_pe_cerere`, `necesita_document`, `necesita_inlocuitor`.
5. **Dacă `scade_din_sold = false`**: nu se atinge `leave_balances`, nu se scrie în `leave_accruals`, nu se face nicio verificare de sold. Se aplică în schimb `max_zile_pe_an` (ex. 5 zile de îngrijitor/an): `SELECT sum(working_days) FROM leave_requests WHERE ... AND balance_year = X AND status IN (...)`. Cererea intră totuși în `leave_request_days` → apare în calendar, în raportul de absenteism și în verificarea de conflict de echipă. Concediul medical se validează doar prin document și termenul de încărcare.
6. **Dacă `scade_din_sold = true`**: `SELECT ... FROM leave_balances WHERE ... FOR UPDATE` (blocarea rândului este obligatorie — două cereri trimise simultan din două tab-uri ar trece amândouă altfel). Alocarea consumului este FIFO după termen: întâi `reportate` cu `termen_folosire_reportate` cel mai apropiat și nedepășit, apoi `drept_acumulat`. Rezultatul se scrie în `zile_din_reportate` / `zile_din_drept_curent`.
7. Dacă `working_days > ramase`: dacă `permite_sold_negativ = false` → eroare blocantă cu mesaj explicit („Solicitați 7 zile, aveți disponibile 4,5"). Dacă `true` și depășirea ≤ `limita_sold_negativ` → se permite, cu avertisment vizibil și marcaj pentru HR.
8. `in_asteptare += working_days`, rând în `leave_accruals` (`eveniment='consum'`, `camp_afectat='in_asteptare'`).
9. `deschide_aprobare('leave_request', id, flow_id)` → creează instanța și task-urile primului pas.

Tranziții ulterioare: aprobare finală → `in_asteptare -= x`, `folosite += x`, `folosite_din_reportate += zile_din_reportate` (două rânduri de accrual). Respingere / retragere / anulare → `in_asteptare -= x` (`eveniment='anulare_consum'`). Anularea unei cereri deja aprobate, cu `start_date` în viitor → `folosite -= x`; cu perioada deja consumată → doar HR, cu motiv obligatoriu.

---

## (f) Avertizare la conflict de echipă

```sql
WITH tinta AS (
  SELECT id, department_id
  FROM employees
  WHERE id = $1 AND organization_id = current_org_id() AND deleted_at IS NULL
),
echipa AS (
  SELECT e.id
  FROM employees e, tinta t
  WHERE e.organization_id = current_org_id()
    AND e.department_id = t.department_id
    AND e.deleted_at IS NULL
    AND e.activ
),
absenti AS (
  SELECT DISTINCT d.employee_id, min(d.data) AS de_la, max(d.data) AS pana_la
  FROM leave_request_days d
  JOIN echipa ec ON ec.id = d.employee_id
  WHERE d.organization_id = current_org_id()
    AND d.data BETWEEN $2 AND $3
    AND d.status IN ('trimisa', 'aprobata_manager', 'aprobata')
    AND d.employee_id <> $1
  GROUP BY d.employee_id
)
SELECT
  (SELECT count(*) FROM echipa)                     AS total_echipa,
  (SELECT count(*) FROM absenti)                    AS colegi_absenti,
  ROUND((SELECT count(*) FROM absenti)::numeric
        / NULLIF((SELECT count(*) FROM echipa), 0), 4) AS rata_absenta,
  COALESCE(
    (SELECT jsonb_agg(jsonb_build_object(
              'employee_id', a.employee_id,
              'de_la', a.de_la,
              'pana_la', a.pana_la))
     FROM absenti a), '[]'::jsonb)                  AS detalii;
```

Parametri: `$1` = employee_id solicitant, `$2`/`$3` = start_date/end_date. Index folosit: `leave_request_days(organization_id, department_id, data)`.

Pragul (`prag_conflict_departament`, implicit 0,30) trăiește în setările organizației, nu hardcodat. Rezultatul este **avertisment, nu blocaj** — se afișează la solicitant („2 din 5 colegi din departament sunt deja în concediu în această perioadă") și se atașează ca `rezumat` în `approval_tasks`, ca managerul să vadă contextul fără să deschidă alt ecran. Numele colegilor se afișează doar managerului/HR; angajatului i se arată doar numărul.

---

## (h) Rapoarte

**1. Sold pe organizație** (sursă: `leave_balances` + `employees`, filtrat pe an):
```sql
SELECT e.department_id, e.id, e.nume_complet, lb.leave_type_key,
       lb.drept_anual, lb.drept_acumulat, lb.reportate, lb.folosite,
       lb.in_asteptare, lb.ramase
FROM leave_balances lb
JOIN employees e ON e.id = lb.employee_id AND e.deleted_at IS NULL
WHERE lb.organization_id = current_org_id()
  AND lb.an = $1 AND lb.deleted_at IS NULL
  AND ($2::uuid IS NULL OR e.department_id = $2)
ORDER BY e.department_id, e.nume_complet;
```
Varianta agregată pentru dashboard: același FROM cu `GROUP BY GROUPING SETS ((e.department_id, lb.leave_type_key), (lb.leave_type_key), ())`.

**2. Absenteism** (zile absente / zile lucrătoare disponibile, pe lună și tip):
```sql
WITH zile_lucr AS (
  SELECT date_trunc('month', c.data)::date AS luna, count(*) AS zile
  FROM org_calendar_days c
  WHERE c.organization_id = current_org_id()
    AND c.este_lucratoare
    AND c.data BETWEEN $1 AND $2
  GROUP BY 1
),
efectiv AS (
  SELECT date_trunc('month', d.data)::date AS luna, d.leave_type_key,
         sum(d.fractiune) AS zile_absenta,
         count(DISTINCT d.employee_id) AS angajati_afectati
  FROM leave_request_days d
  WHERE d.organization_id = current_org_id()
    AND d.data BETWEEN $1 AND $2
    AND d.status = 'aprobata'
  GROUP BY 1, 2
),
efectiv_activ AS (
  SELECT date_trunc('month', c.data)::date AS luna, count(DISTINCT e.id) AS headcount
  FROM org_calendar_days c
  CROSS JOIN employees e
  WHERE c.organization_id = current_org_id() AND e.organization_id = current_org_id()
    AND e.activ AND e.deleted_at IS NULL AND c.este_lucratoare
    AND c.data BETWEEN $1 AND $2
  GROUP BY 1
)
SELECT ef.luna, ef.leave_type_key, ef.zile_absenta, ef.angajati_afectati,
       ROUND(ef.zile_absenta / NULLIF(zl.zile * ea.headcount, 0), 4) AS rata_absenteism
FROM efectiv ef
JOIN zile_lucr zl USING (luna)
JOIN efectiv_activ ea USING (luna)
ORDER BY ef.luna, ef.leave_type_key;
```

**3. Zile neconsumate cu risc de pierdere** — două categorii:
```sql
-- (a) reportate cu termen care expiră în următoarele 90 de zile
SELECT e.id, e.nume_complet, e.department_id, lb.an, lb.leave_type_key,
       (lb.reportate - lb.folosite_din_reportate - lb.reportate_expirate) AS zile_in_pericol,
       lb.termen_folosire_reportate AS expira_la,
       (lb.termen_folosire_reportate - CURRENT_DATE) AS zile_ramase
FROM leave_balances lb
JOIN employees e ON e.id = lb.employee_id AND e.activ AND e.deleted_at IS NULL
WHERE lb.organization_id = current_org_id() AND lb.deleted_at IS NULL
  AND lb.reportate - lb.folosite_din_reportate - lb.reportate_expirate > 0
  AND lb.termen_folosire_reportate BETWEEN CURRENT_DATE AND CURRENT_DATE + 90

UNION ALL

-- (b) sold curent mai mare decât zilele lucrătoare rămase până la 31.12
SELECT e.id, e.nume_complet, e.department_id, lb.an, lb.leave_type_key,
       lb.ramase, make_date(lb.an, 12, 31), (make_date(lb.an, 12, 31) - CURRENT_DATE)
FROM leave_balances lb
JOIN employees e ON e.id = lb.employee_id AND e.activ AND e.deleted_at IS NULL
JOIN leave_types lt ON lt.id = lb.leave_type_id
WHERE lb.organization_id = current_org_id() AND lb.deleted_at IS NULL
  AND lb.an = EXTRACT(year FROM CURRENT_DATE)::int
  AND lb.ramase > 0
  AND NOT lt.se_reporteaza
  AND lb.ramase > (SELECT count(*) FROM org_calendar_days c
                   WHERE c.organization_id = current_org_id() AND c.este_lucratoare
                     AND c.data BETWEEN CURRENT_DATE AND make_date(lb.an, 12, 31))
ORDER BY expira_la, zile_in_pericol DESC;
```
Alimentează atât raportul HR, cât și un job lunar de notificare prin Resend (1 octombrie și 1 noiembrie) către angajații din listă și managerii lor.