# ADMINISTRATIVO — Product Fact Sheet (authoritative, verified against code)

Compiled 6 Oct 2026 from the repository at `/srv/apps/ERP` (HEAD `e240cfc`) and a
read-only catalogue query on the live Supabase database. Every fact cites the file
it comes from. Where marketing copy and code disagree, **code wins**, and the
marketing claim is moved to section 10 ("Do not claim").

Conventions: `[TO CONFIRM]` = a founder must confirm before it goes into an
investor document. "Projection" is never used here — this file holds facts only.

Romanian terms used below, explained once:

- **REGES-Online** — the Romanian Labour Inspectorate's mandatory electronic
  employee register (successor of "Revisal", mandatory from 2025). Every hire,
  salary change, suspension and termination must be filed there.
- **ITM / Inspecția Muncii** — the Labour Inspectorate (territorial / national).
- **SSM / PSI** — occupational health & safety / fire prevention.
- **ANAF** — the national tax authority. **D112** — the monthly payroll
  contributions return. **CNP** — personal numeric code (national ID number).
- **ISCIR** — the state inspectorate for boilers, pressure vessels and lifting
  equipment (regulated equipment).
- **SRL** — Romanian limited-liability company.

---

## 0. Company identity (from code — reconcile with founders' facts)

| Fact | Value | Source |
| --- | --- | --- |
| Legal operator of administrativo.ro | **WISELEARNING S.R.L.**, Str. Metalurgiei nr. 2, Timișoara, jud. Timiș | `src/content/landing/contact.ts:27-43` |
| Fiscal code / trade register | CUI 50321210 · J35/2618/2024 (registered 2024) | `src/content/landing/contact.ts:35-37` |
| VAT status | **Not VAT-registered** → listed prices are final (no 21% VAT added) | `contact.ts:43`, `src/content/landing/preturi.ts:14-18` |
| Public contact | contact@administrativo.ro · 0767 991 625 | `contact.ts:7-11` |

`[TO CONFIRM]` that WISELEARNING S.R.L. is the entity whose cap table is
Miroslav Maletici 51% / Răzvan Pervulescu 49%, and that the SRL was incorporated
before this product (J…/2024 vs. development start Aug 2026) — investors will ask
what the company did between 2024 and Aug 2026.

---

## 1. Modules (19 feature keys)

Source of the list: `src/config/features.ts:43-63` (`FEATURE_KEYS`), mirrored by
the DB seed `public.features` (`supabase/migrations/0001_kernel.sql`). One-liners
are from the English landing catalogue `src/content/landing/en.ts:180-385`, kept
only where the claim was found in code; detailed pages in
`src/content/landing/fise-module.ts`. Modules are toggled per company
(`organization_features`); a disabled module disappears from menu, search and
direct URL (`requireFeature`).

| # | Key | Name (EN) | Group | One-line description (verified) | Code evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | `nucleu` | Core: organisation, roles, audit | core (cannot be disabled) | Company, members, e-mail invitations, departments, org chart, work locations, personnel files, append-only audit log; one user can belong to several companies and switch without signing out | `features.ts:76`; `src/app/(app)/{angajati,departamente,organigrama,puncte-lucru}`; `0001_kernel.sql:347-350`, `0002_authz.sql:804-830` |
| 2 | `attendance` | Attendance (time tracking) | HR | Monthly timesheet + weekly plan, overtime/night hours, approval by department/week, month locking & archiving; employees clock in from their phone, including by scanning a QR poster at the work location | `src/app/(app)/pontaj`; `src/app/(portal)/portal/{ceas,ponteaza/[cod],pontajul-meu}`; `src/domain/attendance/poarta-lunii.ts` |
| 3 | `leave` | Leave | HR | Requests through a configurable approval chain, automatic balance, public holidays excluded; **11 seeded leave types**, each with a legal basis note; team calendar/planner | `0009_leave.sql:775-791` (11 rows); `src/domain/leave/*`; `src/app/(app)/concedii/calendar` |
| 4 | `onboarding` | Onboarding / offboarding | HR | Templates with reorderable steps (tick, document or signature), printable proof of completion | `src/app/(app)/onboarding`; `src/domain/checklist`; `0030_onboarding_companie.sql` |
| 5 | `courses` | Courses | HR | PDF/video library consumed in-app, proof per item (tick, measured % watched, signed declaration), scheduled recertification | `0075_cursuri.sql`; `src/app/(app)/cursuri`; `src/domain/cursuri` |
| 6 | `reges` | REGES-Online (formerly Revisal) | HR | Contracts and employees filed with the Labour Inspectorate **directly over the REGES API**; answers/receipts land back on the employee record — see §5 | `src/lib/reges/*`, `src/domain/reges/*`, `src/app/(app)/reges` |
| 7 | `evaluations` | Performance reviews | HR | Review templates built from company-defined criteria; history per employee | `src/app/(app)/evaluari`; `src/domain/evaluations` |
| 8 | `kpi` | KPIs | HR | Reusable indicator sets, monthly targets per employee/team, closed months immutable; employee sees own KPI in portal | `0119_kpi_lunar.sql`; `src/app/(app)/evaluari/kpi`; `src/app/(portal)/portal/kpi-ul-meu`; `features.ts:146-166` |
| 9 | `payroll` | Payroll | Finance | Step-by-step gross→net calculation with breakdown and warnings; all rates in dated, versioned settings tables (none hard-coded); exports: accounting note (CSV, refused if unbalanced), D112 XML (generated, **not filed**), payroll register PDF, SEPA bank file, attendance XLSX — **undergoing accountant validation**, see §10 | `src/domain/payroll/*`, `src/domain/payroll/bancar/sepa.ts`, `src/app/api/export/salarizare/*`; `NOTES.md` §3 |
| 10 | `per_diem` | Travel & per diem | Finance | Travel orders, multi-country legs, 24-h windows counted from departure, country rates, tax-free ceiling split, printable expense report | `src/domain/per-diem`; `src/app/(app)/diurna` |
| 11 | `rapoarte` | Reports | Finance | Org-wide aggregates (income, leave, meal vouchers) computed in SQL; Excel export | `src/app/(app)/rapoarte`; separate module since 3 Sep 2026 (`features.ts:146-166`) |
| 12 | `fleet` | Fleet | Operations | Vehicles with inspection/insurance/road-tax deadlines, trip sheets with odometer and fuel; odometer regression is blocked by the database, large jumps flagged | `0012_fleet.sql`, `0018_fix_flota.sql:95-96`; `src/domain/fleet/scadente.ts` |
| 13 | `maintenance` | Maintenance | Operations | Equipment, planned servicing by days **and** by counter (hours/km/cycles), fault reports, ISCIR authorisations, parts & labour cost | `src/domain/maintenance/scadente.ts`; `src/app/(app)/mentenanta`; `docs/comercial/README.md` (cost_piese/cost_manopera) |
| 14 | `inventory` | Inventory | Operations | Items, categories, allocations with handover date; the employee confirms receipt himself; DB prevents one item being allocated to two people at once | `0010_inventory.sql:210`; `src/app/(app)/inventar`, `src/app/(portal)/portal/in-primirea-mea` |
| 15 | `ssm` | Health & safety (SSM/PSI) | Operations | Employee × briefing-type matrix with due-date traffic light ("never done" ≠ "expired"), occupational medicine, accidents with reporting countdown, fire extinguishers, PPE, nominal authorisations | `0011_ssm.sql`; `src/domain/ssm`; `src/app/(app)/ssm` |
| 16 | `ticketing` | IT ticketing | Operations | Triaged IT queue (software, hardware, faults linked to an inventory item, in-app bug reports); employees see their own tickets | `src/app/(app)/ticketing`; `src/app/(portal)/portal/tichetele-mele` |
| 17 | `announcements` | Announcements | Communication | Internal notices with read confirmation vs. number of active employees; in-app notification to every active member (+ mobile push where configured) | `src/app/(app)/anunturi/actions.ts:12-40`; `0028_announcements.sql`; `0122_push_dispozitive.sql` |
| 18 | `employee_portal` | Employee portal | Portal | Employee's own leave balance & requests, attendance/clock-in, payslip, documents, courses, KPI, tickets, travel, notifications — nothing else | `src/app/(portal)/portal/*` (20+ routes) |
| 19 | `asistent` | AI assistant | core (optional) | Answers "where do I do X?" and links to the screen, filtered by the user's own permissions; also answers with real figures (leave balance, pending approvals); executes nothing. Runs via OpenRouter (default model `google/gemini-3.7-flash`); off unless `OPENROUTER_API_KEY` is set | `features.ts:181-196`; `src/lib/asistent/{openrouter,destinatii,filtreaza}.ts`; `docker-stack.yml:90-91` — `[TO CONFIRM]` whether the key is set in production |

Platform-level (not sold as modules): self-service sign-up → company creation on a
`trial` plan (`src/app/(auth)/inregistrare`, `src/app/(onboarding)/bun-venit/page.tsx:104`);
Excel import of employees with column mapping and per-row validation report
(`src/app/(app)/angajati/import`, `src/domain/import`); document registry
(`src/app/(app)/registru`); document templates; super-admin console for the
operators: organisations, demo requests, e-mails, platform audit log
(`src/app/(platform)/super-admin/*`).

UI language: application UI is **Romanian**; the marketing site is bilingual
RO/EN (`src/content/landing/ro.ts`, `src/content/landing/en.ts`, `src/app/(marketing)/en`).

---

## 2. Pricing (exactly as in code)

Source: `src/content/landing/preturi.ts` (canonical numbers), text in
`src/content/landing/en.ts:783-827` and FAQ `en.ts:913`.

- Currency: RON ("lei"), monthly, whole numbers. **Final prices — seller is not
  VAT-registered, no VAT added** (`preturi.ts:14-18`, `en.ts:818`).
- Pricing model: **flat per company**, not per employee, **up to 20 employees**
  (`PRAG_ANGAJATI = 20`, `preturi.ts:24`). "Above 20 employees the price rises in
  steps" — **no published figure**; quote on request via `/cere-demo`
  (`en.ts:819-822`, `en.ts:913`).
- **Free trial: first month free**, for any configuration; no setup fee, no
  separately billed implementation (`en.ts:823-824`).
- **HR core** = `nucleu` + `attendance` + `leave` + `employee_portal`:
  **149 RON/month** (`PRET_NUCLEU`, `MODULE_NUCLEU`, `preturi.ts:58-68`).

Add-on modules, RON/month each (`PRETURI_MODULE`, `preturi.ts:35-51`):

| Module | RON/mo | Module | RON/mo |
| --- | ---: | --- | ---: |
| REGES-Online | 39 | Fleet | 35 |
| Onboarding | 30 | Maintenance | 25 |
| Courses | 39 | Inventory | 25 |
| SSM (health & safety) | 29 | Announcements | 15 |
| Evaluations | 25 | IT ticketing | 25 |
| KPIs | 30 | Payroll | 69 |
| Reports | 20 | Travel & per diem | 25 |
| AI assistant | 39 | | |

Packages (`PACHETE`, `preturi.ts:93-123`) — three parallel axes over the same
core, not a ladder (`preturi.ts:72-78`, `en.ts:825`). "Bought separately" is
computed by `sumaSeparat()` = core + listed modules:

| Package (EN name) | Key | Contents on top of core | Price RON/mo | Bought separately |
| --- | --- | --- | ---: | ---: |
| HR core | `nucleu` | — | **149** | 149 |
| Extended HR (*recommended*) | `hr_extins` | REGES, onboarding, courses, SSM, evaluations, KPI | **249** | 341 |
| Operations | `operational` | fleet, maintenance, inventory, announcements, ticketing | **229** | 274 |
| Finance | `financiar` | payroll, per diem, reports | **219** | 263 |
| Whole application | `tot` | all 15 add-ons incl. AI assistant; new modules included automatically | **499** | 619 |

(Separate sums computed from the table above: 149+39+30+39+29+25+30 = 341;
149+35+25+25+15+25 = 274; 149+69+25+20 = 263; 149+470 = 619.)

No accountant/firm tariff and no multi-company discount: subscription is always
paid per client company (`src/content/landing/pentru-contabili.ts:143-146`).

**Billing infrastructure: none in code.** No payment provider (no Stripe,
Netopia, SmartBill, euplatesc, Paddle — `grep` over `src/` and `package.json`
returns nothing). The DB has `plan_type` (`trial|starter|professional|enterprise`)
and `subscription_status_type` enums (`0001_kernel.sql:72-73`) and a
`trial_ends_at` field, but no automated trial expiry or invoicing was found.
Invoicing is therefore manual today.

---

## 3. Accountant channel offer

Source: `src/content/landing/pentru-contabili.ts` (page `/pentru-contabili`),
pilot constants `PILOT` at lines 169-175; announced on LinkedIn 6 Oct 2026.

- **Pilot: 10 accounting practices.** Sign-up until **15 Nov 2026**; each brings
  **1–3 client companies**, which use the product **free until 31 Mar 2027**.
- Pilot scope: core — attendance, leave, REGES-Online, SSM and employee portal;
  the team does employee import, company settings and accounting-account mapping
  with the accountant. Payroll enters the pilot only after the accountant
  validates the default legal values.
- Ask of the accountant: a 30-minute monthly feedback call and consent to an
  anonymised case description (industry, county, headcount). No testimonials, no
  logos.
- **Commission: 20% of each referred company's subscription for 6 months**, from
  its first paid month. Company pays list price after the pilot.
- Accountant account is free; one login with a separate membership per client
  company, switchable without signing out (`listUserOrganizations`,
  `comutaOrganizatiaDirect`, `src/components/layout/meniu-cont.tsx:121`). Typical
  role "HR" (sees personnel incl. sensitive data, payroll, export; no user
  management, no audit log) — `0002_authz.sql:1195-1204`.
- Deliverables to the accountant: accounting note CSV, D112 XML, payroll register
  PDF, SEPA bank file, collective attendance XLSX — each gets a registry number
  (`src/app/api/export/salarizare/*`).
- Stated limits on the page itself: files nothing with ANAF, keeps no general
  ledger, executes no payments, legal values to be confirmed by the accountant,
  price is per company (`CE_NU_FACE`, lines 121-148). No self-service full-account
  export button yet — export at termination is done by the team (line 116).

---

## 4. Engineering metrics (computed 6 Oct 2026)

| Metric | Value | Command / method |
| --- | --- | --- |
| Commits | **811** | `git rev-list --count HEAD` |
| First commit | **17 Aug 2026** (Miroslav Maletici) | `git log --reverse --format='%ad %an' --date=short \| head -1` |
| Calendar span / active days | 51 days (17 Aug → 6 Oct 2026); 44 distinct days with commits | `git log --format=%ad --date=short \| sort -u \| wc -l` |
| Commits by author e-mail | 496 `miro@vmi3162304…` (server) + 37 `miroslav.maletici@student.upt.ro` + 27 personal Gmail; 216 `razvan.pervulescu@student.upt.ro` + 1 laptop; 34 CI bots | `git log --format=%ae \| sort \| uniq -c` — `[TO CONFIRM]` server-account commits attributed to Miroslav |
| SQL migrations | **162** files, 49,045 lines | `ls supabase/migrations/*.sql \| wc -l`; `cat … \| wc -l` |
| Server Actions | **246** `createAction(...)` definitions in 40 non-test files; 53 `"use server"` files exporting 290 symbols | `grep -rcE "= createAction\|createAction\(\{\|createAction<" src --include=*.ts` (test files excluded); `grep -rl '^"use server"' src/ \| wc -l` |
| Unit/integration tests (Vitest) | **5,610** test cases in **433** test files (431 under `src/`) | `grep -rhcE "^\s*(it\|test)(\.fails\|\.skip\|\.each\(…\))?\(" --include=*.test.ts* src tests` — static count, not a `vitest list` run |
| SQL security probes | 30 `.sql` files in `tests/rls/` (tenant isolation + per-role positive write probes) | `ls tests/rls/*.sql \| wc -l` |
| E2E | Playwright suite `e2e/module.spec.ts`, `e2e/concediu.spec.ts` (runs on staging, not in CI) | `ls e2e`; `CLAUDE.md` |
| Known-defect markers | 1 `it.fails("DEFECT…")` (payroll calc) | `grep -rn 'it.fails("DEFECT' src` → `src/domain/payroll/calc.lacune.test.ts` |
| TypeScript LOC | **328,166** total under `src/` (237,693 production + 90,473 test) | `find src -name '*.ts*' \| xargs wc -l \| tail -1` |
| TS/TSX source files | 1,233 non-test | `find src -name '*.ts' -o -name '*.tsx' \| grep -v test \| wc -l` |
| DB tables (live) | **164** tables in `public`, **164/164 RLS enabled, 160 RLS FORCED**, **443 policies** | read-only query on `pg_class`/`pg_policies` (Supabase MCP `execute_sql`) |
| Tables without FORCE | `features`, `role_permissions`, `platform_admins`, `organization_members` (global catalogues / identity; still RLS-enabled) | same query |
| CI gates | typecheck, `check:server`, lint, format, test, build, bundle check | `.github/workflows/ci.yml:44-98`; also `staging.yml`, nightly multi-agent review `revizuire.yml`, docs sync |

Stack: Next.js 16.3, React 19.2, Zod 4, Tailwind v4, Supabase Postgres 17, pnpm 10
(`CLAUDE.md`). Hosting: Docker Swarm behind nginx on a VM, Supabase cloud DB
(`docker-stack.yml`, `DEPLOY.md`). Staging environment exists (`.github/workflows/staging.yml`).

Development is AI-assisted: the repo carries Claude Code project tooling
(`.claude/`, `CLAUDE.md`, nightly AI review and documentation workflows). Worth
stating openly as a productivity fact, not hidden.

---

## 5. REGES-Online API integration — status

- **Live in production.** `src/lib/reges/client.ts:25-31`: production base
  `https://api.inspectiamuncii.ro`, with the comment "confirmed in real use:
  transmission via API works in production with a real company (Miro's
  confirmation, 17 Sept 2026)". Auth is Keycloak OIDC, realm `API`, ROPC flow
  with the **employer's own** client id/secret/user/password (no global developer
  key) — `src/lib/reges/jeton.ts:4-15`.
- Credentials and tokens stored **encrypted** (AES-256-GCM) in
  `reges_credentiale`, which has no RLS policy and no privilege for
  authenticated users — service-role only (`jeton.ts:17-22`).
- Event types composed from the employee record (`src/domain/reges/plan.ts:24-36`):
  hire, salary change, job change, working-time change, duration change,
  suspension, resumption, unexcused-absence suspension/resumption, secondment,
  termination, correction.
- Flow: events → queue `reges_mesaje` with dependency chain
  (`src/lib/reges/coada.ts`); payload incl. CNP composed at send time and not
  persisted; receipts/answers reconciled back (`src/app/api/reges/reconciliere/route.ts`,
  `src/lib/reges/reconciliere-culegere*`). Retries only on network/5xx, never on
  400; 401 retried once after token refresh (`client.ts:12-16`).
- Nuance: messages carrying a CNP (employee type) are sent only by a human with
  `reges:transmit`; contract/proposal messages are sent automatically by the
  reconciliation cycle (memory note `erp-reges-api-productie.md`; `coada.ts:7-11`
  states human decision) — internal contradiction, open product decision.
- Customer-side prerequisite: each employer obtains API access from the REGES
  portal itself.
- "Each event's legal deadline, counted in working days" and "rejection reason in
  plain words" are landing claims (`en.ts:248-255`); deadline logic exists in
  `src/domain/reges` — safe to claim at that level of detail.

---

## 6. Security & architecture differentiators (verified)

| Claim | Verified evidence |
| --- | --- |
| **Tenant isolation in the database, not the app** — Postgres Row-Level Security, FORCED | 160/164 public tables FORCE RLS, 443 policies (live catalogue); `alter table … force row level security` in `0001_kernel.sql` and per-table loops (`execute format('alter table public.%I force row level security', t)`); tests `tests/rls/izolare.sql`, `proba-izolare-intre-firme.sql` |
| **Encrypted HR data (CNP, IBAN)** | AES-256-GCM, random 12-byte IV per encryption, key versioning/rotation without re-encryption (`src/lib/crypto/aes-gcm.ts`); columns `cnp_ciphertext/_iv/_tag/_key_version` + `cnp_hash` (search), same for IBAN (`0004_hr.sql`, `0005_hr_rls.sql`, `0006_fix_hr_sensitive.sql`). Decryption for D112/SEPA leaves an audit row per call (`pentru-contabili.ts`). Sensitive read requires `hr_read_sensitive = all` exactly (`CLAUDE.md`, `0023_portal_angajat.sql`) |
| **Append-only audit log**, enforced even for service role | `0001_kernel.sql:347-350` (no updated_at/deleted_at); trigger raises `'Jurnalul de audit este append-only.'` (`0002_authz.sql:804-830`); diff labels `src/lib/audit/*` |
| **5-role model** with scoped permissions | enum `app_role ('super_admin','org_admin','manager','hr','employee')` and `permission_scope ('none','own','team','all')` (`0001_kernel.sql:64-68`); matrix in `public.role_permissions` seeded in `0002_authz.sql`; vocabulary `src/config/permissions.ts`; super_admin never an org member (`platform_admins`), invitations cannot grant it (`0001_kernel.sql:227`) |
| Permission-aware everything | Every page: `requireTenant → requireFeature → getPermissionMap → can()`; every action through `createAction` (8 layers, Zod after authorisation) — `src/lib/actions/create-action.ts` |
| Legal values not hard-coded | Payroll/leave/per-diem/working-time values in dated, versioned settings tables (`NOTES.md` §3) |
| Soft delete, no DELETE policies | canonical pattern `0013_attendance.sql` (partial indexes `where deleted_at is null`, no DELETE policy) |

Infrastructure caveats to know (do not volunteer as strengths): a single Supabase
project serves both dev and production (memory note `erp-o-singura-baza-dev-prod.md`);
production encryption-key custody procedure must be written down before the first
real tenant (`NOTES.md` §4) — `[TO CONFIRM]` whether done.

---

## 7. Mobile

- **PWA**: installable web app manifest `src/app/manifest.ts` (`start_url` on
  the app, stable `id`); in-portal install prompt
  `src/app/(portal)/portal/indemn-instalare.tsx`, `/portal/instalare`.
- **Android app (APK) exists**: Expo / React Native wrapper over the employee
  portal (`mobil/`, Expo 57, RN 0.86, package `ro.administrativo.portal`).
  Native: push notifications, file download/print, biometric lock, QR scanner
  for clock-in (`mobil/App.tsx:13-16`, `push.ts`, `fisiere.ts`, `lacat.tsx`,
  `scanner.tsx`). Built locally, last build #0005 on 5 Sep 2026, ~92–97 MB,
  minSdk 24 / targetSdk 36 (`mobil/README.md`, `mobil/apk/`).
- **Not published** in Google Play: release is signed with the debug key; store
  publishing needs a proper keystore / EAS accounts (`mobil/README.md:65-72,148-152`).
  **No iOS build** (needs macOS + Xcode). Push delivery requires a server timer
  and secret configured on the VM (`mobil/README.md`).
- Correct claim: "Employees use it from their phone — browser/PWA today, an
  Android app built and in internal testing".

---

## 8. Free SEO tools and content on administrativo.ro

- **7 free tools, no account** (`src/app/(marketing)/unelte/`): salary
  calculator (`calculator-salariu`), annual-leave request form
  (`cerere-concediu-de-odihna`), attendance register (`condica-de-prezenta`),
  review form (`fisa-evaluare`), SSM briefing sheet (`fisa-instruire-ssm`),
  vehicle trip sheet (`foaie-de-parcurs`), timesheet (`foaie-de-pontaj`).
- **8 legal guides**: 6 under `/ghid/` (annual leave, ITM inspection, domestic
  per diem, foreign per diem, overtime, night-shift premium) + `/reges-online` +
  `/evidenta-orelor-de-munca` (content in `src/content/legal/*.ts`).
- Other landing pages: 19 module pages `/module/<key>`, 4 industry pages
  (construction, manufacturing, transport, services — `src/content/landing/domenii.ts`),
  `/pentru-contabili`, `/pontaj-pe-telefon`, `/comparatie/excel`, `/de-ce-nu`,
  `/incredere`, `/intrebari`, `/preturi`, `/cere-demo`, English home + pricing
  (`src/app/(marketing)/en`), `llms.txt`.
- Traffic (founder-provided, 6 Oct 2026): ~7 genuine external Romanian visitors
  in a month (Umami, 3 Sep–6 Oct); Google Search Console 201 impressions / 3
  clicks since 2 Sep, average position from ~50 to 5–20 by end of Sept; top query
  "program salarizare" (43 impressions, position ~61). → **"Pre-launch, SEO just
  starting."**

---

## 9. Screenshots in `vestventures/assets/capturi/`

All captured from the demo company "Administrativo Demo SRL" (8 fictitious
employees, Romanian UI) by `scripts/capturi/capturi.mjs`; desktop shots
1280×800 JPG, phone shots 780×1688. What each shows (route from
`capturi.mjs:113-170`, scope notes from `src/app/(marketing)/_componente/vitrine.ts:61-89`):

| File | Shows | Route |
| --- | --- | --- |
| `nucleu.jpg` | Employee list (personnel register) with roles, filters, "Import from Excel", full sidebar of modules | `/angajati` |
| `attendance.jpg` | Monthly timesheet (Aug 2026) | `/pontaj?…vizualizare=luna` |
| `leave.jpg` | Team leave calendar for one month | `/concedii/calendar` |
| `payroll.jpg` | One approved payroll period with its deliverables (exports) | `/salarizare/<id>` |
| `rapoarte.jpg` | Annual aggregated report from closed payroll periods | `/rapoarte?an=2026` |
| `ssm.jpg` | Health & safety briefing matrix | `/ssm/instruiri` |
| `fleet.jpg` | Vehicles with the first-expiring document | `/flota` |
| `inventory.jpg` | Inventory items and who holds them | `/inventar` |
| `ticketing.jpg` | Team ticket queue | `/ticketing/coada` |
| `announcements.jpg` | Published announcements, pinned one on top | `/anunturi` |
| `courses.jpg` | Company courses | `/cursuri` |
| `onboarding.jpg` | Onboarding journeys in progress | `/onboarding` |
| `evaluations.jpg` | Annual reviews | `/evaluari` |
| `kpi.jpg` | One month of KPIs | `/evaluari/kpi?an=2026&luna=8` |
| `maintenance.jpg` | Maintenance dashboard | `/mentenanta` |
| `per_diem.jpg` | Trips with estimated per diem | `/diurna` |
| `portal-pontare.jpg` | Phone: employee portal clock-in card ("Am intrat" / clock 08:00–16:30) | `/portal` |
| `portal-scanare.jpg` | Phone: clock-in screen opened after scanning the work-location QR poster | `/portal/ponteaza/<cod>` |

No screenshot exists for REGES-Online and the AI assistant (`docs/comercial/README.md`).

---

## 10. Known gaps / DO NOT CLAIM

**Traction**
- Zero paying customers. Pilots/demo companies only; accountant pilot opened 6 Oct 2026. Never imply revenue, customers, logos, testimonials, partnerships.
- The site says "first customers are in implementation" (`pentru-contabili.ts:112`) — do not upgrade this to "customers".

**Product claims with no code behind them** (`docs/comercial/README.md` table + own verification)
- Geolocation at clock-in/out — **none** (no `geolocation`/`getCurrentPosition` in `src/`).
- Access-card / badge reader at the gate — **none**.
- Announcements targeted to a department or work location — **not built** (`announcement_targets` absent, `0028_announcements.sql`); always whole company.
- Announcement attachments — **not built** (`announcement_attachments` absent).
- REGES "transmission retries by itself until it gets an answer" — **false**; queued messages wait for a person with transmit rights (except auto cycle noted in §5); retries only on network/5xx.
- KPI "in development" pill — outdated, KPI is shipped (`0119_kpi_lunar.sql`).
- **Announcements by e-mail** (landing `en.ts:368` "In-app and e-mail notification") — no e-mail template or send path for announcements found (`src/lib/email/templates/` has only welcome, demo, payslip, invitation, magic link, password reset); notifications are in-app + mobile push. Claim "in-app notification" only.
- **Inventory "batch import from Excel"** (`en.ts:311`, `ro.ts:334`) — DB schema for import batches exists (`0010_inventory.sql`), but **no UI/action** uses it; the only Excel import in the app is for employees. Do not claim.
- **Leave "cap on simultaneous absences"** (`ro.ts:252, 726`) — no such threshold found in DB or domain code; team calendar/planner exists. Do not claim.

**Payroll**
- Built end-to-end (calculation, exports, D112 XML, SEPA), but every legal value (CAS/CASS/tax rates, minimum wage, personal deduction brackets, meal vouchers, overtime/night/holiday premiums) is marked ⚠️ "do not use in production until confirmed by an accountant/lawyer" (`NOTES.md` §3). Leave-type legal bases are seeded as "(DE VERIFICAT)" = to be verified (`0009_leave.sql:781-791`). One known payroll defect test `it.fails("DEFECT…")` (`src/domain/payroll/calc.lacune.test.ts`). → Say **"built, undergoing accountant validation"**, never "certified" or "production-ready payroll".
- D112 is generated, **not filed**; no ANAF connection; no bank connection (SEPA file uploaded manually); no general ledger/invoicing (`pentru-contabili.ts:121-148`).

**Other gaps**
- `employee_change_requests` (employee-initiated change of personal data) never built (`CLAUDE.md`).
- No self-service full account export (`pentru-contabili.ts:116`).
- No billing/payment integration; trial expiry not automated (§2).
- Android APK not in Google Play (debug-signed); no iOS app (§7).
- Price above 20 employees not published (quote only).
- AI assistant depends on an external LLM via OpenRouter and on an API key — `[TO CONFIRM]` enabled in production.
- `plpgsql_check` never run on migrations after 0006; action/query tests run on a fake Supabase client (RLS correctness covered only by SQL probes) (`CLAUDE.md`).
- Single Supabase project for dev and prod; encryption key custody procedure pending (`NOTES.md` §4).
- Application UI is Romanian only.
