# Administrativo — prezentare generală a proiectului

„Administrativo" e un ERP/HR multi-tenant pentru companii românești: fiecare
organizație (firmă) e izolată de celelalte prin RLS la nivel de bază de date,
nu doar prin filtre din aplicație. Acest document e harta pentru cineva (om
sau Claude) care deschide proiectul pentru prima dată. Pentru configurarea
Claude Code însuși (setări, reguli, memorie), vezi
[`claude-setup.md`](claude-setup.md).

---

## 1. Stack tehnic

| Strat         | Alegere                                                | Notă                                                                                 |
| ------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Framework     | Next.js 16.3 (App Router)                              | „NU e cel din datele de antrenament" — vezi `AGENTS.md`                              |
| UI            | React 19.2, React Compiler activ implicit              |                                                                                      |
| Limbaj        | TypeScript 5.9, `strict` + 7 verificări suplimentare   | `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, ş.a.                       |
| Validare      | Zod 4                                                  | API de erori diferit de Zod 3 (`z.prettifyError()`)                                  |
| Formulare     | react-hook-form + `@hookform/resolvers`                |                                                                                      |
| Stil          | Tailwind v4                                            | paletă navy/crem, font Inter (subset `latin-ext`, obligatoriu pentru ș/ț cu virgulă) |
| Bază de date  | Supabase (Postgres 17), proiect `nybmhorngsajoqaxjlbr` | fără Supabase local/Docker — decizie a clientului, vezi `NOTES.md`                   |
| Pachete       | pnpm                                                   |                                                                                      |
| Teste unitare | Vitest                                                 | funcții pure din `domain/`, `format/`, `config/`                                     |
| Teste RLS     | Vitest + `psql`                                        | necesită un proiect Postgres/Supabase SEPARAT, resetabil                             |
| Teste E2E     | Playwright                                             |                                                                                      |

Comenzi esențiale (`package.json`):

```bash
pnpm dev            # server de dezvoltare
pnpm verify          # typecheck + lint + format:check + test (FĂRĂ build)
pnpm typecheck && pnpm lint && pnpm test && pnpm build   # verificarea completă folosită efectiv înainte de commit
pnpm test:rls        # izolare RLS — cere DATABASE_URL către un Postgres de test
pnpm test:e2e         # Playwright
pnpm db:types         # regenerează src/types/database.ts din CLI local (proiectul folosește de regulă MCP, vezi mai jos)
```

**Atenție**: `pnpm verify` NU rulează `build` — memoria de proiect
(`fara-agenti-implementare-directa.md`) insistă că build-ul e obligatoriu
înainte de a considera un task terminat, fiindcă e singurul care prinde
erorile de graniță server/client. Rulează-l separat.

### CI (`.github/workflows/ci.yml`) — două joburi

1. **`quality`** — `pnpm install --frozen-lockfile` → typecheck → lint →
   `format:check` → `test` → `build` (cu variabile de mediu placeholder,
   build-ul nu atinge baza reală).
2. **`migrations`** — pornește un container Postgres 17 curat, aplică TOATE
   migrările în ordine, rulează cele trei bariere de securitate
   (`scripts/checks/*.sql`), apoi **`tests/rls/izolare.sql` — testul de
   izolare între tenanți, pe FIECARE push/PR**. `PROGRESS.md` (istoric)
   documentează o perioadă în care acest test „nu a rulat niciodată pe un
   proiect de test" — **corecție**: verificat direct în workflow, azi
   rulează automat, în CI, pe fiecare PR, fără să necesite un proiect
   Supabase de test separat (folosește un Postgres efemer din job).

### Variabile de mediu (`.env.example` → copiat în `.env.local`, necomis)

Fiecare e validată la boot în `src/config/env.ts` — o valoare lipsă/invalidă
oprește aplicația imediat, nu la primul request:

| Variabilă                                                                                   | Rol                                                                                                           |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`                                 | Publice prin design (ajung în bundle-ul de client) — protecția reală e RLS                                    |
| `SUPABASE_SERVICE_ROLE_KEY`                                                                 | ⚠️ Ocolește complet RLS — exclusiv în `src/lib/supabase/admin.ts` (`server-only`), doar super-admin           |
| `HR_ENCRYPTION_KEYS` (JSON, versionat), `HR_ENCRYPTION_ACTIVE_KEY`                          | AES-256-GCM pentru CNP/IBAN — pierderea cheii = pierderea definitivă a datelor (vezi `NOTES.md` §4)           |
| `HR_HASH_KEY`                                                                               | HMAC pentru amprente de deduplicare CNP/IBAN — separată de criptare                                           |
| `TENANT_COOKIE_SECRET`                                                                      | Semnătură HMAC a cookie-ului de organizație — detector de falsificare, NU stratul de securitate (acela e RLS) |
| `EMAIL_MODE` (`test`/altă valoare), `RESEND_API_KEY`, `EMAIL_FROM`, `RESEND_WEBHOOK_SECRET` | În `test`, nimic nu se trimite real — totul se scrie în `email_log`, vizibil din Super-Admin                  |
| `NEXT_PUBLIC_APP_URL`                                                                       | Baza URL a aplicației                                                                                         |

---

## 2. Structura de foldere

```
src/
  app/
    (app)/          # aplicația principală, autentificată, per-organizație
      angajati/ departamente/ functii/ organigrama/
      concedii/ pontaj/ salarizare/
      ssm/ flota/ mentenanta/ inventar/
      diurna/ evaluari/ anunturi/ onboarding/ rapoarte/
      revisal/ documente/ notificari/ profil/ setari/
    (platform)/
      super-admin/   # panou multi-organizație, doar platform admin
    (portal)/
      portal/        # portalul angajatului — UI redus, alte rute, aceleași reguli
  domain/            # funcții PURE (fără I/O) — calcule, reguli, calendar
    attendance/ calendar/ employee/ fleet/ hr/ import/
    leave/ maintenance/ organization/ payroll/ per-diem/ revisal/ ssm/
  lib/
    actions/         # createAction() — wrapper-ul pentru TOATE Server Actions
    audit/ auth/ avatar/ crypto/ documents/ email/ import/
    navigation/ queries/ revisal/ rute/ supabase/ tenant/ utils/
  config/            # env.ts, features.ts, navigation.ts, permissions.ts, routes.ts
  schemas/           # scheme Zod, o per modul (attendance.ts, leave.ts, employee.ts, ...)
  types/database.ts  # GENERAT — tipuri Supabase, nu edita manual (vezi §6)
supabase/migrations/  # 44 fișiere .sql, forward-only, aplicate identic local+cloud
tests/rls/            # izolarea între tenanți — fixture + teste SQL
scripts/
  checks/             # cele trei bariere de securitate (rulate în CI)
  demo/seed-demo.mjs   # date demonstrative
docs/
  claude-setup.md      # acest document, dar despre Claude
  project-overview.md  # ← ești aici
  design/               # planuri istorice, pe fază — parțial învechite, vezi §9
  design/ecrane/capcane.md  # capcane cunoscute din schemă — CITEȘTE-L
NOTES.md               # decizii de arhitectură + valori legale de confirmat de contabil/jurist
PROGRESS.md             # istoric de livrare pe fază — PARȚIAL ÎNVECHIT, vezi §9
```

---

## 3. Module de business (stare curentă)

Toate au bază de date ȘI ecran (spre deosebire de o etapă istorică
documentată în `PROGRESS.md`, unde 8 din 11 module aveau doar schemă).

| Modul                          | Rută                             | Esență                                                                                              |
| ------------------------------ | -------------------------------- | --------------------------------------------------------------------------------------------------- |
| Angajați                       | `/angajati`                      | fișă completă, date sensibile criptate (CNP/IBAN), contracte, wizard de înrolare unificat           |
| Funcții                        | `/functii`                       | nomenclator de posturi, cod COR liber (fără import de catalog oficial)                              |
| Departamente / Puncte de lucru | `/departamente`, `/puncte-lucru` | CRUD simplu                                                                                         |
| Organigramă                    | `/organigrama`                   | arbore managerial, vizibil și pentru scope „own" (propria ramură)                                   |
| Concedii                       | `/concedii`                      | 11 tipuri statutare, sold per angajat/an, flux de aprobare generic (vezi §4)                        |
| Pontaj                         | `/pontaj`                        | foaie colectivă, calcul automat ore/suplimentare, plan săptămânal cu aprobare individuală (vezi §4) |
| Salarizare                     | `/salarizare`                    | motor de calcul (`domain/payroll/calc.ts`), componente salariale reutilizabile, scutiri fiscale     |
| SSM și PSI                     | `/ssm`                           | instruiri, fișe de aptitudine, autorizații nominale, EIP, stingătoare                               |
| Parc auto                      | `/flota`                         | vehicule, foi de parcurs, verificat kilometraj                                                      |
| Mentenanță                     | `/mentenanta`                    | echipamente, inclusiv ISCIR                                                                         |
| Inventar                       | `/inventar`                      | alocare obiecte, predare-primire, „ce am în primire"                                                |
| Diurne și deplasări            | `/diurna`                        | calcul diurnă intern/extern                                                                         |
| Evaluări                       | `/evaluari`                      | șabloane pe criterii, evaluări create de manageri SAU administratori                                |
| Anunțuri                       | `/anunturi`                      | fanout automat spre `notifications`, confirmare de citire                                           |
| Integrare angajați             | `/onboarding`                    | checklist-uri de onboarding                                                                         |
| Rapoarte                       | `/rapoarte`                      | analitice pentru proprietar — venit, tichete, ore suplimentare, concediu, per angajat + agregat     |
| REVISAL                        | `/revisal`                       | evenimente generate automat la contract/încetare                                                    |
| Documente                      | `/documente`                     | motor generalizat de generare (contract, fișa postului, adeverințe)                                 |
| Notificări                     | `/notificari`                    | centru de notificări in-app                                                                         |
| Setări                         | `/setari`                        | organizație, membri, roluri (matrice read-only)                                                     |
| Super-Admin                    | `/super-admin`                   | CRUD organizații, module per organizație, wizard de înrolare companie pe 6 pași                     |
| Portal angajat                 | `/portal`                        | UI redus pentru angajatul obișnuit — concediile mele, pontajul meu, salariul meu, documentele mele  |

Fiecare modul e activabil/dezactivabil per organizație prin **feature flags**
(`src/config/features.ts`, tabelele `features`/`organization_features`) —
cheile curente: `nucleu` (mereu activ), `attendance`, `leave`, `onboarding`,
`payroll`, `per_diem`, `fleet`, `maintenance`, `inventory`, `ssm`,
`announcements`, `employee_portal`, `evaluations`.

---

## 4. Pattern-uri arhitecturale cheie

### Multi-tenant prin RLS, nu prin filtre de aplicație

Fiecare tabelă relevantă are `organization_id` + RLS **FORCED** (se aplică și
proprietarului tabelei). Cookie-ul de organizație activă e tratat explicit ca
**hint neîncrezut** — un cookie falsificat produce zero rânduri, nu scurgere,
fiindcă politicile RLS verifică apartenența direct în `organization_members`.

### Trei scheme SQL, roluri diferite

- **`public`** — tot ce ajunge la PostgREST (tabele + funcții RPC apelabile
  din `.rpc()`).
- **`app`** — helperi `SECURITY DEFINER` de permisiuni/vizibilitate
  (`app.has_permission`, `app.can`, `app.current_employee_id`,
  `app.feature_on`, `app.is_manager_of`, `app.write_audit`, ...). **NU sunt
  expuși prin PostgREST** (`supabase/config.toml`: `schemas =
["public","graphql_public"]`) — orice `.rpc('nume_din_schema_app')` din
  cod client eșuează silențios; logica se portează în TypeScript sau se apelează
  DIN interiorul altei funcții SQL. Vezi capcana #1 din `capcane.md`.
- **`internal`** — funcții interne, apelabile DOAR din alte funcții SQL
  (triggere, alte funcții `SECURITY DEFINER`) — schema n-are `USAGE` pentru
  `authenticated`, deci inaccesibilă direct oricum.

### Model de permisiuni: rol × resursă × acțiune → scope

Scope-urile sunt `none < own < team < all` (`src/config/permissions.ts`,
`RANK`). Valorile efective trăiesc ca **date** în `role_permissions` (seed în
`0002_authz.sql`), niciodată hardcodate — un client își poate ajusta
permisiunile fără deploy. Verificare dublă:

- **DB**: `app.has_permission(org, resursă, acțiune)` / `app.can(org, resursă,
acțiune, prag_minim)` — folosite în politicile RLS.
- **TS**: `can()`/`scopeFor()` din `src/lib/auth/permissions.ts` — folosite
  în UI (ascunderea unui buton) și în `createAction()` (refuz explicit).

**Ascunderea din UI NU e o barieră de securitate** — e doar UX. Bariera reală
e RLS + verificarea din `createAction()`.

### `createAction()` — singurul mod de a scrie din UI

`src/lib/actions/create-action.ts`. Fiecare Server Action de scriere trece
prin el: `feature` (flag necesar activ), `permission` + `minScope`, `input`
(schemă Zod), `audit` (ce se loghează, ce se exclude), `revalidate` (căi de
reîmprospătat), `handler`. Distinge `denied` (refuz de autorizare) de
`failure` (eroare de execuție) în jurnalul de audit — un tipar de citit
diferit la incident.

**Regulă Next.js ușor de uitat**: un fișier marcat `"use server"` poate
exporta EXCLUSIV funcții `async` — orice altă valoare exportată (o constantă,
un tip) oprește build-ul cu „A 'use server' file can only export async
functions". Motivul e intenționat: tot ce exportă un astfel de modul devine
punct de intrare apelabil din rețea. De aceea, ori de câte ori un modul de
acțiuni are nevoie și de tipuri/constante partajate cu componenta client, ele
se mută într-un fișier separat (ex. `(app)/actions-types.ts` lângă
`(app)/actions.ts`) — mirosește acest tipar dacă `tsc` nu prinde eroarea
direct (uneori doar `pnpm build` o prinde, nu `typecheck`).

### Motorul generic de aprobare

`approval_flows` / `approval_steps` / `approval_tasks` (`0009_leave.sql`) —
tabele polimorfe (`entity_type` + `entity_id`, fără FK reală), reutilizate de
**concedii** (`entity_type='leave_request'`) și de **pontajul săptămânal**
(`entity_type='attendance_week_submission'`, adăugat mai târziu). Fiecare
modul își scrie propriul rezolvator de aprobatori (`internal.rezolva_aprobatori`
pentru concedii, `internal.rezolva_aprobator_pontaj` pentru pontaj) — **nu
sunt interschimbabile**, fiecare verifică o permisiune specifică modulului
(`leave:approve` vs. `attendance:approve`). Un trigger generic
(`trg_approval_tasks_anuleaza_surori`) anulează automat sarcinile-surori de
la aceeași `ordine` când una e decisă — funcționează identic pentru orice
`entity_type` nou.

### Date sensibile (CNP, IBAN) — DOAR prin RPC

Criptate AES-256-GCM (`HR_ENCRYPTION_KEYS`, rotație posibilă prin
`key_version` — vezi `NOTES.md` §4). Tabelele `employee_sensitive_data` și
`organization_sensitive_data` nu au GRANT pentru `authenticated` — singurul
drum e prin RPC-uri `SECURITY DEFINER`: `hr_write_sensitive`/
`hr_read_sensitive` (angajați), `org_write_sensitive`/`org_read_sensitive`
(organizație). **Bug cunoscut**: formularul de angajat (`angajati/actions.ts`)
încă scrie greșit, direct pe tabelă — vezi memoria
`bug_scriere_cnp_iban_angajat.md` din `claude-setup.md` §3.

### Generarea de documente

`src/lib/documents/generator.ts` — șablon HTML cu `{{variabile}}`
(`hr_document_templates`), substituție cu **escapare automată** (o valoare
care conține `<script>` devine text vizibil, nu markup executat — deci
niciun câmp de listă nu poate fi construit ca `<ul><li>`, doar text simplu),
numerotare pe serie cu retry pe coliziune, checksum SHA-256, cod de
verificare. Reutilizat pentru adeverințe, contract de muncă, fișa postului.

### Feature flags și navigație

`src/config/navigation.ts` e **sursa unică** a meniului — fiecare intrare
declară `featureKey` + `permission`/`minScope`; `navigation.test.ts` verifică
la nivel de fișier că fiecare rută din meniu are un `page.tsx` real (sau e
declarată explicit ca gol cunoscut).

---

## 5. Sesiuni concurente pe același repo

Acest proiect a fost dezvoltat, în paralel, de mai multe sesiuni Claude Code
diferite (uneori persoane reale diferite, ex. commit-uri semnate
`RazvanPervulescu-APS`). Nu e un scenariu ipotetic — s-a întâmplat repetat:
coliziuni de nume de migrare (`0035`, `0040` folosite de două sesiuni
simultan), fișiere aflate temporar în stare stricată de o altă sesiune încă
în lucru (`concedii/setari/actions.ts`, `lib/queries/leave.ts` la momentul
scrierii acestui document).

Protocol verificat, de urmat:

1. `git status --short` înainte de orice `git add` — niciodată `-A`/`.` orb.
2. `git fetch origin main` + `git log --oneline HEAD..origin/main` înainte de
   push, ca să vezi ce a apărut concurent.
3. La o coliziune de nume de migrare, redenumește-ți **propriul** fișier
   (niciodată al altcuiva) — numărul local e doar bookkeeping, migrarea deja
   aplicată pe cloud e urmărită independent, prin `list_migrations`.
4. Dacă `typecheck`/`build` eșuează pe fișiere pe care nu le-ai atins,
   verifică `git log`/`git show --stat` înainte să presupui că e vina ta —
   poate fi munca în curs a altcuiva.

---

## 6. Baza de date — convenții de migrare

- **Forward-only**: nu se editează niciodată o migrare deja aplicată pe
  cloud; se scrie una nouă.
- **Numerotare secvențială** (`00NN_descriere.sql`), dar Supabase urmărește
  aplicarea prin propriul timestamp intern (`list_migrations`), nu prin
  numele fișierului — o coliziune de nume local nu strică nimic pe cloud.
- **Aplicare prin `psql`**, cu fișierul trimis byte-exact — vezi `NOTES.md` §1
  pentru comanda completă prin pooler și pentru motiv. NICI `supabase db push`
  din CLI, NICI `mcp__supabase__apply_migration`: ambele cer ca SQL-ul să treacă
  prin model ca text. MCP-ul rămâne pentru inspecție (`execute_sql`,
  `list_migrations`, `get_advisors`, `generate_typescript_types`). Aplicarea pe
  baza live poate cere confirmare explicită a utilizatorului (clasificatorul
  Auto Mode o tratează ca acțiune ireversibilă).
- **Trei bariere de securitate**, în `scripts/checks/*.sql`, rulate în CI pe
  Postgres 17 curat:
  1. `security-definer.sql` — orice funcție `SECURITY DEFINER` trebuie
     `search_path = ''` (nu `= public`).
  2. `policies-explain.sql` — politici RLS care referă coloane inexistente.
  3. `rls-enabled.sql` — tabelă fără RLS, fără `FORCE`, sau RLS fără nicio
     politică.
- **Regenerarea `src/types/database.ts`**: `mcp__supabase__generate_typescript_types`
  întoarce un JSON prea mare pentru a fi citit direct — se salvează automat
  într-un fișier, apoi se extrage cu un script Python care reaplică 3 patch-uri
  manuale (`| null` pe argumentele opționale ale `hr_write_sensitive`/
  `log_audit_event`/`submit_demo_request`, pierdute la o regenerare brută prin
  CLI). Verifică mereu, după regenerare, că `git diff --stat` e strict
  ADITIV — o regenerare greșită poate pierde tăcut adăugările altei sesiuni.

---

## 7. Cum adaugi un modul nou — rețetă

1. **Schemă + RLS** — migrare nouă în `supabase/migrations/`, cu tabelă(e),
   enum-uri, politici (select/insert/update — rar delete, vezi mai jos),
   trigger de `updated_at`/actor/audit (mirosește un modul existent, ex.
   `0013_attendance.sql` are bucla `do $$ ... $$` care atașează actor+audit+
   grant-uri per tabelă într-un singur loc).
2. **Schemă Zod** — `src/schemas/<modul>.ts`, o schemă per operație de
   scriere + filtrele de citire.
3. **Citiri** — `src/lib/queries/<modul>.ts`, DOAR `createServerSupabase()`
   (ESLint interzice `createAdminSupabase` aici — excepția e strict
   `actions.ts`, route handlers, scripturi).
4. **Scrieri** — `src/app/(app)/<modul>/actions.ts`, fiecare export prin
   `createAction()`.
5. **UI** — `src/app/(app)/<modul>/page.tsx` + componente.
6. **Navigație** — intrare nouă în `src/config/navigation.ts` (rulează
   `navigation.test.ts` ca să confirmi că pagina există).
7. **Feature flag**, dacă modulul e opțional — cheie nouă în
   `src/config/features.ts` + migrare de seed în `features`.
8. **Fără politici DELETE** — soft delete peste tot (`deleted_at`); absența
   politicii + `REVOKE DELETE` e regula corectă, nu o omisiune.
9. Verifică `docs/design/ecrane/capcane.md` — multe capcane structurale
   (coloane calculate de trigger, indexuri unice parțiale care rup
   `.upsert()`, chei mascate pe scheme neexpuse) se repetă între module.

---

## 8. Capcane cunoscute din schemă

**Citește direct [`docs/design/ecrane/capcane.md`](design/ecrane/capcane.md)**
— 38 de capcane concrete, verificate empiric, fiecare cu explicație și fișierul
exact afectat. Cele mai relevante pentru orice modul nou:

- Orice funcție din schema `app` NU e apelabilă cu `.rpc()` din cod client.
- `max_rows = 1000` în PostgREST — paginează DUPĂ entitatea logică (angajat),
  nu după rândul brut, dacă un rând reprezintă „o zi" sau ceva similar.
- Indexurile unice sunt aproape mereu **parțiale** (`WHERE deleted_at IS
NULL`) — PostgREST nu emite predicatul în `ON CONFLICT`, deci
  `.upsert({onConflict: ...})` cade cu `42P10`; scrie citire-apoi-insert-sau-update.
- Coloane calculate de trigger `BEFORE` nu trebuie trimise de client — dar
  politica `WITH CHECK` vede valoarea DEJA scrisă de trigger, nu ce a trimis
  clientul (capcana #6, deja reprodusă de două ori istoric în acest proiect).

---

## 9. Documente istorice — ce e încă valabil, ce e învechit

| Document                        | Stare                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NOTES.md`                      | **Valabil** — decizii de arhitectură (de ce Next 16 nu 15, de ce `search_path=''`, de ce fără Supabase local) + lista valorilor legale ⚠️ de confirmat de contabil/jurist înainte de calcul real în producție.                                                                                                                                                                                                                                                                                                                                                                                    |
| `PROGRESS.md`                   | **PARȚIAL ÎNVECHIT** — se oprește la narațiunea „Faza 11 livrată" (concedii, pontaj, salarizare, flotă, SSM etc. cu ecrane complete) și NU menționează munca de după: wizard-ul de înrolare companie, funcții/COR, organigramă pe scope „own", componente salariale reutilizabile, bunuri/certificări la înrolare, evaluări de angajați, `/rapoarte`, coduri CAEN, planul săptămânal de pontaj cu aprobare individuală. Folosește-l pentru istoricul deciziilor și al defectelor găsite (secțiune cu valoare — fiecare defect e documentat cu cauză și verificare), NU ca sursă a stării curente. |
| `docs/design/*`                 | Planuri de fază, scrise ÎNAINTE de implementare — utile ca istoric de intenție, dar codul efectiv poate diferi (unele planuri au fost respinse sau simplificate la implementare — vezi `docs/design/resolutions.md` și `docs/design/critique.md`).                                                                                                                                                                                                                                                                                                                                                |
| `docs/design/ecrane/capcane.md` | **Valabil și critic** — vezi §8.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `docs/superpowers/`             | Planuri/specificații scrise prin skill-ul `superpowers` de o sesiune concurentă (feature CAEN) — la fel, istoric de intenție, nu neapărat stare finală.                                                                                                                                                                                                                                                                                                                                                                                                                                           |

**Recomandare**: dacă acest document (`project-overview.md`) ajunge la rândul
lui învechit, actualizează-l direct — nu adăuga un al treilea document
„mai nou" fără să arhivezi explicit vechile ca atare, exact problema
semnalată aici pentru `PROGRESS.md`.
