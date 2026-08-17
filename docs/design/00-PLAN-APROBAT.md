# Administrativo — ERP multi-tenant SaaS pentru firme din România

## Context

Construim de la zero **Administrativo** (administrativo.ro), un ERP multi-tenant vândut ca SaaS
către IMM-uri din România (10–500 angajați). Directorul `/Users/maleticimiroslav/ERP Adminio` este
gol, fără git — greenfield curat.

**Problema:** firmele mici din România țin pontajul în Excel, concediile pe email, verificările
ITP/RCA/ISCIR/medicina muncii într-o agendă, iar predarea laptopurilor pe hârtie. Expiră lucruri
fără să observe nimeni, fiecare raport pentru contabil se face manual, iar la un control ITM
lipsesc registrele obligatorii.

**Rezultatul urmărit:** o platformă unde echipa de platformă creează organizații, activează modulele
contractate și brăndează interfața per client, iar fiecare firmă își administrează angajații — cu
izolare strictă a datelor între firme, verificată automat la fiecare PR.

**Cum a fost produs planul:** 11 agenți de proiectare pe domenii, 4 lentile de critică adversarială
(securitate, legislație RO, model de date, YAGNI), 1 de sinteză. **71 de observații, dintre care 19
CRITICE**, toate rezolvate mai jos. Designurile brute (440 KB) sunt în
`/private/tmp/claude-501/-Users-maleticimiroslav-ERP-Adminio/23fa6935-c368-45bf-b1b8-2bd83e1fd434/scratchpad/design-*.md`
— **se copiază în `docs/design/` la Faza 0**, altfel se pierd la finalul sesiunii.

> ⚠️ Designurile acelea sunt **schițe, nu specificație**. Conțin query-uri care referă coloane
> inexistente. Sursa de adevăr devine `0001_kernel.sql`; documentele se regenerează după el.

---

## Decizii blocate cu clientul

| Decizie | Alegere | Consecință |
|---|---|---|
| Proiect Supabase | **Nou și gol: `nybmhorngsajoqaxjlbr`** | Migrare `0001` de la zero. Budgeting App rămâne intact pe `nggtvmdazpzmqfgomyct`. |
| Rutare tenant | **Host unic** `app.administrativo.ro` + comutator | Tenantul se rezolvă exclusiv în `lib/tenant/tenant-hint.ts`; subdomeniile = schimbare într-un singur fișier. |
| Facturare | **În afara scope-ului** | Doar `plan`, `seats_limit`, `subscription_status`, `trial_ends_at` ca limitări. |
| CNP / IBAN | **Tabelă separată + AES-256-GCM aplicativ** | Decriptare doar în Server Actions, doar `hr`/`org_admin`, audit la fiecare citire. Nu `pgsodium` (deprecat pentru TCE). |
| Email | **Resend, DNS la final** | Mod test din 1b; SPF/DKIM/DMARC în Faza 11. |
| Mediu dev | **Cloud, fără Docker** | Mitigat cu **Postgres nativ local** — vezi R5. |
| Onboarding clienți | **Sales-led** | Landing + „Autentificare" + „Cere demo". Organizațiile doar din Super-Admin. |
| Client pilot | **Nu există** | Mitigare: tenant zero intern din 1b. |
| **Scope** | **Tot, 14–18 luni** | 240–310 zile dezvoltare senior + 25–35% rework între faze. |
| **REVISAL + registre SSM** | **Ambele incluse** | REVISAL în Faza 2, registrele SSM în Faza 7. Nu erau în specificația inițială. |
| **Cumul de funcții** | **Da, proiectăm pentru el** | Unicitatea se mută la nivel de contract; `employees.is_primary`. Decizie ireversibilă, luată în 1a. |
| **Contabil** | **Disponibil** | Livrează cotele confirmate + fișier de cazuri de test = criteriul de acceptare al Fazei 9. |

### Stare mediu (verificată)

Node 23.9.0 · pnpm 10.33.0 · Supabase CLI 2.114.0 (**nelogat**) · Docker instalat, daemon oprit (irelevant).

**⚠️ MCP-ul indică proiectul greșit.** `.mcp.json` are `project_ref=nggtvmdazpzmqfgomyct` (Budgeting App):

```
! claude mcp remove supabase && claude mcp add --scope project --transport http supabase "https://mcp.supabase.com/mcp?project_ref=nybmhorngsajoqaxjlbr&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching%2Cstorage"
```

apoi `/mcp` → autentificare. Blocant pentru Faza 0.

---

## Arhitectura

### Structura de foldere (`src/`)

```
middleware.ts          # DOAR refresh sesiune. NU e boundary de securitate (CVE-2025-29927)
app/
  (marketing)/         # landing, cere-demo, prețuri, legal
  (auth)/              # autentificare, invitatie/[token], resetare-parola, alege-organizatia
  (platform)/super-admin/   # organizatii, module, membri, cereri-demo, configurari-legale, permisiuni, audit
  (app)/               # angajati, pontaj, concedii, flota, ssm, mentenanta, inventar,
                       # onboarding, anunturi, salarizare, diurna, rapoarte, setari
  (portal)/portal/     # mobile-first, UI redus
  api/                 # health, export/[entity], webhooks/resend
components/{ui,layout,data,forms,feedback}/
lib/
  supabase/{server,browser,admin,middleware}.ts
  tenant/{resolve-tenant,tenant-hint,tenant-cookie,types}.ts
  auth/{current-user,permissions,features,platform}.ts
  actions/{create-action,public-action,errors,audit,types}.ts
  queries/             # citiri RSC per domeniu — paginile NU ating supabase direct
  crypto/{aes-gcm,sensitive-data}.ts
  {email,format,utils}/
domain/                # LOGICĂ PURĂ, zero I/O — ținta principală Vitest
  {leave,attendance,payroll,per-diem,fleet,shared}/*.{ts,test.ts}
schemas/               # Zod partajat client (RHF) ↔ server (createAction)
config/{navigation,features,permissions,env}.ts
types/database.ts      # generat
supabase/{migrations,functions,seed.sql}
tests/{e2e,rls,setup}/
```

**Invariantul care ține totul:** `domain/` nu importă nimic din `lib/supabase`. De asta e 100%
testabil fără mock-uri. Componentele `_components/` sunt private rutei; dacă ajung necesare în două
module, urcă în `components/`.

### Tenancy — cookie ca *hint neîncrezut*

`resolveTenant()` (în `lib/tenant/resolve-tenant.ts`) e singurul loc care decide organizația activă.

Cookie `httpOnly` + `SameSite=Lax` + `Secure`, semnat HMAC-SHA256, tratat **exclusiv ca sugestie**;
adevărul se stabilește prin lookup validat în `organization_members`, memoizat cu `React.cache()`.

**Argumentul decisiv:** politicile RLS nu depind niciodată de „organizația activă". Se scriu ca
apartenență directă la `organization_members`. Dacă cineva falsifică cookie-ul cu id-ul altei firme,
RLS întoarce **zero rânduri** la SELECT și `42501` la INSERT. Nu există scurgere nici în cel mai rău caz.
Semnătura HMAC nu e stratul de securitate — e detectorul de tampering care ne lasă să scriem încercarea în audit.

**Claim în JWT: respins.** Un membru exclus ar păstra acces până la expirarea tokenului (până la 1h),
iar comutatorul din topbar ar cere refresh de sesiune.

**Unde se apelează:** în layout-ul `(app)`/`(portal)` și, independent, în **fiecare Server Action**
prin `createAction`. Nu în middleware (rulează pe Edge, fără context de rendering).
*Un layout nu protejează o Server Action.*

### `createAction` — 8 straturi, în ordine

```
1. autentificare        → resolveTenant()
2. rezolvare organizație → server-side; clientul NU trimite organization_id
3. feature flag          → server-side, nu doar în meniu
4. permisiune            → role_permissions, cu RANK{none:0,own:1,team:2,all:3} ≥ minScope
5. validare Zod          → schema partajată cu formularul
6. execuție              → handler(ctx, input)
7. audit                 → success | denied | error, cu payload redactat prin allow-list
8. revalidatePath
```

`minScope` e câmp **obligatoriu** în `ActionDefinition`. Fără el, `scope='none'` (refuz explicit)
ar fi citit ca permisiune acordată — a fost observația CRITICĂ nr. 2.

### Strategia RLS

Un singur namespace de helperi: `app.is_member()`, `app.current_org_ids()`,
`app.has_permission(org,resource,action) → permission_scope`, `app.current_employee_id()`,
`app.is_manager_of()`, `app.feature_on()`, `app.is_platform_admin()`. Aliasurile sunt interzise prin grep în CI.

Reguli absolute:
- **Toate funcțiile `SECURITY DEFINER` cu `SET search_path = ''`** și nume complet calificate.
  `search_path = public` permite shadowing prin `pg_temp` → escaladare de privilegii. Test de migrare care eșuează dacă apare vreuna.
- **`REVOKE EXECUTE ... FROM public, anon`** + `GRANT` explicit către `authenticated`, în fiecare migrare.
  Funcțiile de job se mută în schema `internal`, neexpusă prin PostgREST.
- **`organization_id = ANY((select app.current_org_ids()))`** — subquery-ul dă InitPlan caching.
  `current_org_id()` (singular, din cookie) **interzis în orice politică**.
- **Feature flag în TOATE politicile modulare**, inclusiv SELECT: `and app.feature_on(organization_id,'modul')`.
- **`FORCE RLS` peste tot MINUS o listă albă comisă cu motiv scris**: `organization_members`,
  `platform_admins`, `role_permissions`, `features` — altfel helperii definer reintroduc recursiunea.
- **Fără politici DELETE.** Soft delete peste tot ⇒ `REVOKE DELETE FROM authenticated` *este* regula corectă.
- **Orice `OR` la nivel superior se parantezează.** Precedența AND/OR a produs o gaură în politica de INSERT.
- **`security_invoker=true` obligatoriu pe fiecare view**, verificat prin test pe `pg_class.reloptions`.
  View-urile sunt însă **interzise în orice cale de securitate** (nu poți pune `CREATE POLICY` pe un view).
  `MATERIALIZED VIEW` interzis pe date multi-tenant.
- **`WITH CHECK` complet la INSERT**: fixează starea inițială și zerofică valorile calculate
  (`status='draft'`, `working_days=0`, `approved_by is null`). Derivatele se completează prin trigger `BEFORE`.
- **Fără `CHECK` cu `now()`/`current_date`** (nu sunt IMMUTABLE) — trec în triggere de business cu mesaj în română.

### Convenții de schemă

Identificatori SQL în **engleză**; textele UI în română (i18n). Fiecare tabelă de business are
`organization_id` denormalizat (politici RLS simple și sargable), plus `created_at/by`,
`updated_at/by`, `deleted_at`. Bani: `numeric(14,2)`, **niciodată float**. Momente: `timestamptz`;
zile calendaristice: `date`. UNIQUE-urile devin parțiale `WHERE deleted_at IS NULL`.
Nomenclatoare per organizație în loc de enum pentru tipuri pe care clientul le va extinde
(tipuri de documente, sporuri); enum doar pentru mașini de stare închise.

---

## Inventar de tabele pe module

**Nucleu (1a):** `organizations`, `organization_branding`, `profiles`, `platform_admins`,
`organization_members`, `features`, `organization_features`, `role_permissions`, `invitations`,
`audit_logs`, `notifications`, `notification_preferences`, `demo_requests`, `rate_limits`,
`document_sequences`, `retention_policies`, `email_log`.

**HR (2):** `departments`, `job_positions`, `employees`, `employee_sensitive_data`,
`employment_contracts`, `employee_documents`, `job_descriptions`, `salary_components` +
`salary_component_types`, `employee_tax_exemptions`, `work_permits`, `hr_document_templates` +
`hr_issued_documents`, **`revisal_events`**.

**Concedii (3a):** `public_holidays`, `organization_holidays`, `leave_types`,
`leave_entitlement_rules`, `leave_requests`, `leave_request_days`, `leave_balances`,
`leave_accruals`, `medical_leave_codes`, `approval_flows` + `approval_steps` + `approval_tasks`.

**Pontaj (3b):** `attendance_periods`, `attendance_settings`, `attendance_entries`,
`attendance_approval_batches`, `overtime_compensation`, `holiday_compensation`.

**Expirări (4):** `expirables`, `alert_rules`, `compliance_alerts`, `alert_notifications`.

**Inventar (5):** `inventory_categories`, `inventory_items`, `inventory_allocations`, `import_batches`.

**Checklist (6):** `checklist_templates`, `checklist_template_items`, `checklist_instances`,
`checklist_instance_items`.

**SSM/PSI/mentenanță (7):** `ssm_training_types` + `ssm_trainings` (cu `domeniu` — PSI e obligație
separată), `risk_assessments` + `risk_assessment_items`, `prevention_plan_measures`,
`work_accidents`, `dangerous_incidents`, `occupational_diseases`, `safety_committee_meetings`,
`ppe_issuances`, `fire_extinguishers` + `fire_extinguisher_checks`, `evacuation_drills`,
`hot_work_permits`, `environmental_permits`, `occupational_health_exams` +
`employee_work_restrictions`, `equipment`, `equipment_meters`, `maintenance_plans`,
`maintenance_interventions`, `fault_reports`, `iscir_authorizations`, `personnel_authorizations`.

**Flotă (8):** `vehicles`, `vehicle_documents`, `trip_sheets`, `fuel_entries`, `odometer_anomalies`.

**Salarizare (9):** `payroll_settings`, `payroll_personal_deduction_brackets`, `payroll_periods`,
`payroll_entries`, `payroll_bonuses`, `payroll_deductions`, `payslip_views`.

**Diurne (10):** `countries`, `per_diem_policies`, `per_diem_country_rates`, `business_trips`,
`business_trip_legs`, `trip_expenses`.

**Avizier + portal (11):** `announcements`, `announcement_attachments`, `announcement_targets`,
`announcement_reads`, `employee_change_requests`.

### Capcane de modelare deja rezolvate

| Problemă | Soluție |
|---|---|
| `expirables UNIQUE(entity_type, entity_id)` colapsa scadențele multiple | Cheia include `kind` — altfel stingătorul are proba de presiune expirată fără alertă |
| `vehicle_documents` cu EXCLUDE bloca reînnoirea normală | `UNIQUE(org, vehicle, tip) WHERE este_curent`; `este_curent` = `expira_la` maxim |
| `inventory_items` soft delete + număr de inventar unic | Se elimină soft delete-ul; revocarea importului pe `import_batch_id` înainte de orice alocare |
| `payroll_periods` nu permitea regularizări | `+ is_regularizare`, `secventa`; `UNIQUE(org, an, luna, secventa)` |
| `checklist_instances` bloca reangajarea | `+ ciclu smallint` în cheie |
| `organizations UNIQUE(cui)` filtrată pe `deleted_at` | Nefiltrată — CUI-ul rămâne unic și după ștergere logică |
| CM peste CO aprobat era respins de EXCLUDE | `leave_types.intrerupe_alte_concedii`; zilele suprapuse devin `intrerupta`, soldul se restituie |
| Ierarhie de management în două locuri | `employees` e sursa unică; `app.is_manager_of` folosește `manager_path uuid[]` + GIN, nu CTE recursiv |
| `payroll_periods` cerea stare de pontaj inexistentă | Condiția devine `= 'locked'` — **blocarea perioadei ESTE aprobarea ei** |

---

## Valori legale configurabile (→ `NOTES.md`)

**Niciuna nu apare în cod.** Toate în tabele cu `valabil_de_la` și istoric, verificate de contabil/jurist.

- **Fiscal:** cote CAS (+ majorate pentru condiții deosebite/speciale), CASS, impozit, CAM; salariu
  minim + minime sectoriale (construcții, agroalimentar); cotă Pilon II; reguli de rotunjire;
  plafon rețineri din net; facilități sectoriale.
- **Deducere personală:** salariu de referință, praguri venit × persoane în întreținere, degresivitate.
- **Tichete:** valoare maximă legală, regim fiscal, plafon 33% venituri neimpozabile + ordinea de includere.
- **Timp de muncă:** procente ore suplimentare / noapte / weekend / **sărbătoare legală**; durată maximă
  săptămânală + perioadă de referință; repaus minim între zile și săptămânal; termen de compensare;
  interdicții (sub 18 ani, part-time); pauze.
- **Concedii:** minim CO/an + zile suplimentare pe categorii; zile pentru evenimente familiale;
  maternitate/creștere copil (zile **calendaristice**); termen și mod de reportare; **mod de rotunjire
  a acumulării — nu are regulă legală, e CCM/RI**; coduri CM (procent, zile angajator, plătitor, bază).
- **Sărbători legale:** 12 fixe + 5 mobile (offset față de **Paștele ortodox**). Lista **s-a schimbat prin
  lege** (6/7 ianuarie în 2016, Vinerea Mare în 2018). Plus zile pentru alte culte religioase legale.
- **Diurne:** barem intern + multiplu de plafonare; barem pe țări (HG 518/1995, **importat ca date**);
  plafon 3 salarii de bază/lună; prag ore zi întreagă/jumătate; tarif/km auto personal.
- **SSM/PSI/ISCIR:** periodicități instruire SSM și **PSI separat**; intervale stingătoare (verificare,
  reîncărcare, probă presiune); periodicitate medicina muncii; termen comunicare accident la ITM;
  praguri CSSM și cotă persoane cu handicap; periodicități ISCIR; durate EIP.
- **Retenție:** state de plată (decenii), documente contabile, instruiri SSM, `audit_logs`, ștergere IP din lead-uri.
- **REVISAL:** termene de transmitere, coduri de temei încetare/suspendare, **structura fișierului —
  se validează cu Inspecția Muncii, nu se presupune**.

---

## Fazele

> Zile de lucru pentru un dezvoltator senior, fără marja de feedback.
> Total: **240–310 zile ≈ 14–18 luni calendaristice**. Ne oprim după fiecare fază.

| Fază | Zile | Livrabile | Criteriu de acceptare |
|---|---|---|---|
| **0** Setup | 5–7 | 4 proiecte Supabase (prod/staging/dev/test, Frankfurt); **Postgres nativ local**; Next.js 15 + TS strict + Tailwind v4 + shadcn; `config/env.ts` cu Zod; CI cu job `migrations`; `reset-test-db.sh` cu **listă albă** de ref-uri; ESLint `no-restricted-imports` pe `admin.ts`; copierea designurilor în `docs/design/` | PR gol trece CI verde; `psql -f migrations/*.sql` pe bază goală < 10s. Verifică `pg_partman` în `pg_available_extensions` |
| **1a** Fundația — **zero ecrane** | 18–22 | `0000_extensions.sql`; `0001_kernel.sql` (toate tabelele de nucleu, cu `organization_id`+`deleted_at`+audit din prima migrare); helperii `app.*`; politicile RLS + `attach_standard_triggers()`; seed `role_permissions`; `resolveTenant()` + `createAction()`; autentificare + acceptare invitație + rate limiting persistent; shell cu pagini goale; **testul generic de izolare RLS**; `lib/format/` | Două organizații în seed, testul de izolare verde; **adaugi intenționat o tabelă fără RLS → testul devine roșu** |
| **1b** Super-Admin | 16–20 | CRUD organizații; module per organizație; membri + invitații; `role_permissions` read-only; cereri demo prin funcție `SECURITY DEFINER` apelabilă de `anon` (**fără `service_role` pe calea publică**); jurnal de audit; comutator de organizație; Resend în mod test + `email_log` | Clientul creează o organizație reală, invită un coleg, acesta vede shell-ul cu exact modulele activate. **Regula de aur: nimic din 1b nu modifică o tabelă din 1a.** La final: tenant zero intern |
| **2** HR + REVISAL | 30–38 | Departamente (anti-ciclu), `employees` cu toate coloanele legale, contracte cu dimensiuni separate, criptare AES-256-GCM cu rotație, adeverințe, fișe de post, scutiri, permise de muncă, sporuri permanente, REVISAL + export | Import Excel cu 50+ angajați; generare adeverință de venit; citire CNP cu rând de audit vizibil; export REVISAL cu termen calculat |
| **3a** Calendar + concedii | 22–26 | `public_holidays` seed 2024–2040; tipuri + reguli de drept; cereri + zile + solduri + acumulări; coduri CM; `approval_*` cu flux **codat**; `calculeazaZileLucratoare` | `pasteOrtodox(2026)=12.04` și `(2027)=02.05` din teste cu valori scrise manual; CM peste CO întrerupe și restituie soldul; jobul de acumulare rulat de două ori nu dublează |
| **3b** Pontaj | 22–26 | Perioade, setări (repaus, medie săptămânală), intrări, aprobare în bloc, compensări ore/sărbătoare, `computeAttendance()` cu cazuri DST, sincronizare idempotentă, blocare pe două straturi, foaie colectivă | **Test de reconciliere calendar: zile lucrătoare din pontaj = din concedii, 36 de luni consecutive**; tura 22:00–06:00 peste schimbarea orei |
| **4** Expirări + notificări | 10–13 | `expirables` (cheie cu `kind`), reguli, alerte, job în 4 faze, outbox tranzacțional + webhook Resend, dashboard conformitate | Jobul rulat de două ori în aceeași zi inserează 0 alerte noi; documentul reînnoit închide seria veche |
| **5** Inventar | 16–20 | Items (fără soft delete), alocări cu `EXCLUDE USING gist`, import Excel cu staging + preview + aplicare parțială, PDF proces-verbal | Import de 300 de rânduri cu 4 duplicate → aplicare parțială + raport; două predări concurente → una eșuează cu mesaj în română |
| **6** Checklist | 10–13 | Șabloane, instanțe (cu `ciclu`), `sync_itemi_returnare_inventar()`, blocarea finalizării, dovada de parcurgere | Offboarding cu un laptop nereturnat nu se poate finaliza |
| **7** SSM + PSI + mentenanță | 32–40 | Instruiri cu `domeniu`, registrele ITM complete, stingătoare, exerciții, avize, medicina muncii + restricții, echipamente, contoare, planuri, intervenții, sesizări, ISCIR + autorizații nominale | Angajat fără autorizație de stivuitorist nu poate fi asignat pe utilaj ISCIR (override org_admin cu motiv în audit); fișa medicală expirată produce restricție |
| **8** Flotă | 16–20 | Vehicule, documente (fără EXCLUDE), foi de parcurs, alimentări, anomalii de kilometraj, rapoarte cost/km | Reînnoirea RCA cu 3 săptămâni înainte NU dă eroare; regres de kilometraj blochează, gap doar avertizează |
| **9** Salarizare | 32–40 cod / 50–60 calendaristic | Setări versionate, praguri de deducere, perioade cu regularizare, entries cu `settings_snapshot` imutabil, prime, rețineri, `calculatePayrollEntry` cu breakdown, fluturaș PDF | **Fișierul de cazuri de test de la contabil trece 100%**; recalcularea unei luni închise imposibilă fără perioadă de regularizare |
| **10** Diurne | 13–16 | Țări, barem, politici, deplasări (cu detașare transnațională), etape, cheltuieli, `calculeazaZileDiurna`, PDF-uri, bonus la depășire de plafon | Deplasare 22:00→06:00 = 0 zile; multi-țară alocă corect ziua trecerii frontierei |
| **11** Portal + finisaj | 26–33 | Portal mobile-first, cereri de modificare, branding complet (OKLCH), i18n, fluxuri configurabile, DNS Resend + warm-up, WCAG AA, E2E complet | Un angajat cere concediu de pe telefon în sub 60 de secunde; emailurile ajung în Inbox |

**Dependențe corectate față de specificația inițială:** concediile **înaintea** pontajului (pontajul
consumă concediile aprobate); infrastructura de expirări ca **fază proprie** înaintea SSM/flotă/mentenanță;
inventarul **înaintea** checklist-ului (offboarding-ul depinde de alocări); salarizarea după pontaj **și** contracte.

### Tăiat deliberat din Faza 1

Partiționarea auditului (rămâne append-only + REVOKE), `features.depends_on`/`min_plan`/`is_beta`
(constantă TS), calendar materializat (funcție pură), `notification_preferences` cu quiet hours,
`employee_change_requests`, condiții de sărire în aprobări, OKLCH complet (rămâne `primary_color` +
`pickForeground` de 10 linii), APCA, i18n cu 16 namespace-uri (rămâne `lib/format/`), PDF, outbox.
**≈ 2–3 săptămâni recuperate**, investite în testul de izolare și Super-Admin.

**Se păstrează însă mecanismul de versionare a setărilor legale** — el e cel scump retroactiv.

---

## Verificare

### Automat, la fiecare PR — cele trei bariere

1. **Testul de izolare RLS** (`tests/rls/`), parametrizat, care descoperă tabelele din
   `information_schema` și eșuează dacă: o tabelă n-are RLS; userul din org A citește un rând din org B;
   un INSERT cross-tenant reușește; o tabelă are politică DELETE. Fixture-ul trebuie să conțină **≥1 rând
   pentru org B în fiecare tabelă tenant-scoped** — altfel testul trece fals-pozitiv.
2. **Test SQL** care listează funcțiile `SECURITY DEFINER` fără `search_path` controlat și eșuează dacă găsește vreuna.
3. **`plpgsql_check` + `EXPLAIN` pe fiecare politică** din `pg_policies` — o coloană inexistentă cade imediat.

Plus: `pnpm typecheck` (zero `any`), lint, Vitest pe `domain/`, migrări aplicate pe bază goală,
regenerarea tipurilor fără diff, verificarea că `supabase_realtime` publică doar `notifications`.

### Manual, de client, la finalul Fazei 1

1. Creează „Alfa SRL" → slug generat, status `in_asteptare`, `trial_ends_at` completat.
2. A doua organizație cu același CUI scris altfel („RO 123 456") → refuz în română.
3. Activează Alfa; activează **doar** Concedii și Pontaj → restul nu apar în meniu.
4. Invită `admin@alfa.test` → linkul apare în jurnal, fără email real.
5. Deschide linkul în fereastră privată → rol corect, dashboard Alfa.
6. Reutilizează linkul → „Invitația nu mai este validă."
7. Modifică o literă din token → același mesaj, **fără să afle numele organizației**.
8. Repetă pentru „Beta SRL" cu alt utilizator.
9. **Editează cookie-ul `adm_org` punând id-ul lui Beta → nu vezi date Beta**, iar audit-ul înregistrează încercarea.
10. **Interoghează direct API-ul Supabase din consola browserului pe `organizations` → primești doar Alfa.**
11. Același email în ambele organizații; comută din topbar fără re-login → meniul se schimbă.
12. Ca `employee`: meniul Setări absent; `/setari/membri` → 404, nu pagină goală.
13. Ca `employee`, formular manipulat de invitare → `INTERZIS`, nu 500, plus rând `denied` în audit.
14. Schimbă o permisiune în `role_permissions` → efect la reîncărcare, **fără deploy**.
15. Pune `scope='none'` pe o acțiune permisă → devine refuzată.
16. Dezactivează Concedii → dispare din meniu, `/concedii` dă 404, **iar acțiunea refuză**.
17. Suspendă Alfa → utilizatorii ei pierd accesul; Beta neafectată.
18. Șterge logic un membru → acces pierdut la reîncărcare, rândul rămâne cu `deleted_at`.
19. Audit: fiecare pas cu actor, organizație, IP, oră România, **fără tokenuri sau parole**.
20. Încearcă să modifici un rând de audit → refuzat de DB.
21. „Cere demo" de trei ori → ultimele două refuzate.
22. Parolă greșită de 6 ori → lockout progresiv, **mesaj identic pentru email inexistent și existent**.
23. Pe telefon: login, comutator, meniu, empty state în română — **ș/ț cu virgulă, nu cu sedilă**.
24. Rulează testul de izolare; adaugă o tabelă fără RLS și confirmă că devine roșu.
25. Link profund după expirarea sesiunii → după login ajungi în pagina cerută, nu pe dashboard.

---

## Riscuri

**R1 — Scurgere între tenanți (catastrofic).** Un singur incident încheie produsul: notificare
ANSPDCP în 72h, reziliere, reputație irecuperabilă. Suprafață: 60+ tabele × 4 politici + Storage +
funcții definer + `service_role`. *Mitigare: cele trei bariere, pe fiecare PR, nu pe main.*

**R2 — Salarizare greșită (grav).** Modulul nu e certificat, dar dacă produce cifre pe care cineva
le plătește, răspunderea practică se întoarce la furnizor. *Mitigare: banner persistent în UI,
`settings_snapshot` imutabil, fișierul contabilului ca precondiție de livrare a Fazei 9.*

**R3 — Absența unui client pilot (certitudine).** 8–12 luni fără contact cu realitatea garantează
rescrieri în HR, pontaj și exporturi. *Mitigare: tenant zero intern din 1b + trei artefacte reale
(export Excel angajați, foaie colectivă semnată, un fluturaș) înainte de Faza 2. **Acelea sunt
specificația, nu ilustrația.***

**R4 — Storage.** Un singur contract de path, generat exclusiv prin helper validat cu Zod:
`{org_id}/{entity}/{entity_id}/{uuid}-{filename}`. `can_access_object()` consultă și rândul de
metadate (`confidential`) înainte de a permite SELECT.

**R5 — Dezvoltare doar în cloud.** Fără bază efemeră nu poți bisecta o migrare stricată, iar testele
RLS resetează baza sub picioarele cuiva. *Mitigare-cheie: **Postgres nativ local** (Postgres.app sau
`brew install postgresql@17`) — nu ai nevoie de Supabase local ca să validezi DDL, ai nevoie de
Postgres. `psql -v ON_ERROR_STOP=1` în 5 secunde înainte de push elimină ~80% din risc.* Plus:
4 proiecte separate, migrări forward-only, **zero modificări din Studio**, verificate prin `db diff` în CI.

**R6 — CNP.** Nu se decriptează niciodată într-un Server Component (ajunge în payload-ul RSC trimis
la client). Doar Server Action la cerere, cu `no-store`, plus test automat care verifică absența
valorii decriptate din HTML-ul randat. `tg_audit` **nu** se atașează pe `employee_sensitive_data` —
altfel criptotextul ajunge în `audit_logs`.

### Întrebări rămase deschise

1. **Cine este juristul de dreptul muncii** care validează termenele REVISAL, retențiile și codurile de încetare? (Fazele 2 și 7)
2. **Detașarea transnațională** apare la clienții-țintă (construcții, transport, montaj)? Câmpurile intră acum; implementarea în Faza 10.
3. **Pragul de salariați al clienților tipici** — determină dacă CSSM și cota de angajare persoane cu handicap sunt obligatorii din prima zi.
4. **Blocarea calculului de salarii la concedii în așteptare** — implicit **NU** (avertisment + decizie în bloc), pentru că plata cu întârziere e ea însăși încălcare. Rămâne blocant pe *pontaj neaprobat*.
5. **Cine deține și rotește `HR_ENCRYPTION_KEYS`?** Fără un proces documentat de custodie, criptarea CNP e teatru — cheia va sta în variabila de mediu a unui singur furnizor de hosting.

Niciuna nu blochează Faza 0 sau 1a.
