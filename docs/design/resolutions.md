# STRAT DE DECIZIE — Administrativo

## 1. CONTRADICȚII REZOLVATE

| # | Conflict | Decizie | Justificare |
|---|---|---|---|
| 1 | `permission_scope`: `toate\|echipa\|proprii\|niciunul` vs `none\|own\|team\|all` vs `own\|team\|organization` | **`none \| own \| team \| all`** (core-authz) | Are valoarea de refuz explicit (`none`), necesară pentru retragerea de drept per organizație; `organization` din app-arch nu poate exprima refuzul. Identificatorii SQL rămân în engleză peste tot. |
| 2 | `role_permissions`: `permission_key+allowed+feature_key` vs `resource+action+scope` vs `permission+allowed` | **`resource + action + scope`** (core-authz), fără `allowed` | `scope='none'` codifică refuzul, deci `allowed` e redundant și creează două surse de adevăr. Cheia UI `resource:action` se compune, nu se stochează. `feature_key` se elimină — feature-ul se verifică separat, în politică. |
| 3 | Sursa de adevăr `super_admin`: `profiles.is_platform_admin` vs tabela `platform_admins` | **`platform_admins`**; coloana de pe `profiles` se ȘTERGE | Tabela are `granted_by`/`granted_at`/revocare/audit și nu e editabilă prin politica „îmi actualizez profilul". O coloană de privilegiu pe un rând pe care utilizatorul îl poate scrie e un accident care așteaptă. |
| 4 | Apartenență: `status member_status` vs `is_active boolean` | **`status member_status`** (`invitat\|activ\|suspendat\|plecat`); `is_active` devine coloană generată `(status = 'activ')` doar dacă e nevoie de index simplu | Ciclul real de viață are 4 stări (invitat ≠ suspendat ≠ plecat); un boolean le pierde. Toți helperii se rescriu pe `status = 'activ'`. |
| 5 | Trei tabele de audit (`audit_logs` enum RO partiționat, `audit_logs` bigint identity, `audit_log` singular) | **Una singură: `public.audit_logs`**, PK `(id uuid, created_at)`, partiționată lunar, coloane din core-schema (`action audit_action`, `entity_type`, `entity_id`, `before`, `after`) | PK-ul cu bigint identity e ilegal pe tabelă partiționată. Modulele attendance/leave își rescriu apelurile. |
| 6 | Calendar: `legal_holidays`+`organization_non_working_days` (attendance) vs `public_holidays`+`organization_holidays`+`org_calendar_days` (leave) | **Perechea din leave**, plus `org_calendar_days` ca proiecție; se șterg cele două din attendance | Un singur adevăr despre „e zi lucrătoare?"; altfel pontajul și concediile dau numere diferite pentru aceeași lună și statul de plată nu se reconciliază. |
| 7 | Helperi: `app.is_member` / `is_member_of` / `is_org_member`; `has_perm(org,text)` vs `has_permission(org,resource,action)`; `feature_on` / `org_has_feature` / `app.feature_on` | **Un singur namespace `app.*`**: `app.is_member(uuid)`, `app.current_org_ids()`, `app.has_permission(uuid,text,text)→permission_scope`, `app.current_employee_id(uuid)`, `app.is_manager_of(uuid,uuid)`, `app.feature_on(uuid,text)`, `app.is_platform_admin()` | Trei nume pentru aceeași funcție garantează că a patra variantă apare în modulul 8. Aliasurile vechi sunt interzise printr-un grep în CI. |
| 8 | Ierarhie de management: `organization_members.manager_member_id`/`department_id` vs `employees.manager_id`/`department_id` | **`employees`** e sursa unică; `organization_members` nu are ierarhie | Majoritatea angajaților nu au cont; ierarhia pe membri ar trebui dublată oricum. `app.is_manager_of` folosește `employees.manager_path` (GIN), nu CTE recursiv. |
| 9 | Aprobări: infrastructură generică (leave) vs flux codat | **Tabele generice `approval_*` din Faza 3, cu flux CODAT (manager direct → opțional HR)**; `approval_steps.conditie_sarire`, delegarea și SLA se amână la Faza 8 | Ancora RLS pe `approval_tasks.approver_user_id` e corectă și trebuie de la început; editorul de fluxuri validat de zero utilizatori e datorie tehnică. |
| 10 | `is_active` vs `deleted_at` pe `expirables` | **Ambele**, cu semantici distincte documentate | `deleted_at` = rândul nu mai există logic; `is_active=false` = entitatea-sursă e inactivă (vehicul casat) dar istoricul rămâne. Fără `is_active`, flota vândută poluează dashboardul la infinit. |
| 11 | Denumiri coloane `employees`: `nume/prenume` vs `full_name` vs `nume_complet`; `data_angajarii` vs `hired_on` | **Engleză, canonic**: `first_name`, `last_name`, `full_name GENERATED STORED`, `hired_on`, `terminated_on`, `status employee_status` | Textele UI rămân în română (i18n); identificatorii SQL în engleză elimină o clasă întreagă de query-uri rupte între module. |
| 12 | `organizations`: `denumire/denumire_legala` vs `name/legal_name`; branding pe `organizations` vs `organization_branding` | **`name`/`legal_name`** pe `organizations`; brandingul rămâne în `organization_branding`, dar în Faza 1 doar `primary_color` | Consecvent cu #11. `GRANT UPDATE (logo_path, primary_color…)` din core-authz referea coloane din altă tabelă — se elimină. |
| 13 | Protecția coloanelor comerciale: `GRANT`/`REVOKE` pe coloane vs trigger | **Trigger `BEFORE UPDATE`** care resetează la valoarea veche; `REVOKE` se păstrează DOAR pentru coloane care nu trebuie CITITE (`token_hash`, `*_ciphertext`) | Cu PostgREST, `select('*')` devine 403 aleatoriu în producție și TypeScript nu prinde asta; lista de granturi se strică la fiecare `ADD COLUMN`. |
| 14 | Vizibilitate în modul PostgREST: `current_org_id()` vs `current_org_ids()` | **`organization_id = ANY((select app.current_org_ids()))`**; `current_org_id()` INTERZIS în orice politică | Organizația activă vine dintr-un cookie, adică din client — folosită în RLS încalcă principiul 2. Rămâne strict filtru de prezentare în `lib/queries/*`. |
| 15 | `contract_type` monolitic vs dimensiuni separate | **Dimensiuni separate**: `contract_duration` (nedeterminat/determinat), `norma_ore_saptamana numeric`, `work_mode` (sediu/telemunca/domiciliu/mixt), `special_regime` (ucenicie/internship/zilier/null) | `part_time` nu e tip de contract, e fracțiune de normă; combinarea lor pierde informația necesară REVISAL. `conventie_civila` iese complet din tabela de CIM. |
| 16 | Tipuri de documente ca ENUM vs nomenclator | **Nomenclator per organizație cu seed de platformă** pentru `vehicle_document_type`, `fire_ext_type`, `employee_doc_type`, `trip_expense_type`, `payroll_bonus_type`, `payroll_deduction_type` | Prima firmă de transport cere licență/copie conformă/tahograf/ADR → migrare de platformă pentru un client. ENUM rămâne doar pentru mașini de stare închise (`*_status`). |
| 17 | Notificări: outbox complet + dispecer + webhook din Faza 1 | **Faza 1: trimitere directă + `email_log`**; outbox complet în Faza 3 | Faza 1 trimite un singur tip de email (invitația). Retrofit-ul = mutarea unui apel într-un INSERT. |
| 18 | PDF: `@react-pdf/renderer` vs Puppeteer | **`@react-pdf/renderer`**, dar amânat la faza primului document real | Argumentația din design e corectă (Deno n-are Chromium, diacritice garantate prin font embedat). Nu se construiește însă înainte să existe ce printa. |

---

## 2. CORECȚII OBLIGATORII

### 2.1 CRITIC — acceptate integral

**C1. `organization_members_insert` — precedență AND/OR + recursiune.** ACCEPT. Se elimină complet numărarea locurilor din politică. Politica finală:
```sql
create policy organization_members_insert on public.organization_members
for insert to authenticated with check (
  organization_id = any ((select app.current_org_ids()))
  and app.has_permission(organization_id,'users','create') in ('all','team')
  and role <> 'super_admin'
  and (role <> 'org_admin' or app.has_role(organization_id, array['org_admin']::public.app_role[]))
);
```
`seats_limit` se impune într-un trigger `BEFORE INSERT/UPDATE` cu `SELECT seats_limit FROM organizations WHERE id = NEW.organization_id FOR UPDATE`. Regulă de review: orice politică cu `OR` la nivel superior se parantezează obligatoriu. Test de regresie obligatoriu în 1a.

**C2. `createAction` tratează `scope='none'` ca permisiune acordată.** ACCEPT.
```ts
const RANK = { none: 0, own: 1, team: 2, all: 3 } as const;
const scope = permissions.get(def.permission) ?? 'none';
if (RANK[scope] < RANK[def.minScope ?? 'own']) return deny('INTERZIS', ...);
```
`minScope` devine câmp obligatoriu în `ActionDefinition`. Tipul `PermissionScope` se generează din `types/database.ts`, literalele scrise de mână sunt interzise prin lint. Test: pentru fiecare rând cu `scope='none'` din seed, acțiunea corespunzătoare trebuie să întoarcă `INTERZIS`.

**C3. `SECURITY DEFINER` cu `search_path = public` → shadowing prin `pg_temp`.** ACCEPT. TOATE funcțiile definer primesc `SET search_path = ''` și nume complet calificate. Test de migrare obligatoriu:
```sql
-- eșuează dacă există vreo funcție definer fără search_path controlat
select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','app') and p.prosecdef
  and not (coalesce(array_to_string(p.proconfig,','),'') like '%search_path=%');
```

**C4. Privilegii pe funcții — `REVOKE` aplicat o singură dată.** ACCEPT. În fiecare migrare care creează funcții: `REVOKE EXECUTE ... FROM public, anon` + `GRANT` explicit către `authenticated`. Plus `ALTER DEFAULT PRIVILEGES IN SCHEMA public, app REVOKE EXECUTE ON FUNCTIONS FROM public`. Toate funcțiile de job (`*_sync_*`, `expiry_upsert`, `maintain_*`) se mută în schema `internal`, NEEXPUSĂ prin PostgREST. Orice funcție definer care primește `p_org` începe cu:
```sql
if not app.is_member(p_org) and not app.is_platform_admin() then
  raise exception 'ACCES_INTERZIS' using errcode='42501'; end if;
```

**C5. Storage — path incoerent + politici care verifică doar segmentul 1.** ACCEPT. Un singur contract, generat exclusiv prin helper TS validat cu Zod:
```
{organization_id_uuid}/{entity}/{entity_id_uuid}/{uuid}-{filename}
```
Un singur registru de bucket-uri (constantă TS + migrare unică). `can_access_object()` consultă și rândul de metadate (`employee_documents.confidential`, `vizibil_angajatului`) înainte de a permite SELECT. Se elimină `hr-contracts`, `hr-documents`, `leave-documents`, `fleet-docs`, prefixul literal `org/`. Test E2E per bucket: upload+download ca org_admin și ca employee, refuz pe path fabricat cu org străin și pe documentul confidențial al unui coleg.

**C6. `tg_audit` copiază criptotextul CNP în `audit_logs`.** ACCEPT — cel mai grav din listă. `tg_audit` NU se atașează pe `employee_sensitive_data`; auditul acelei tabele vine exclusiv din `hr_read_sensitive`/`hr_write_sensitive`, cu payload = doar numele coloanelor atinse. În `tg_audit` se adaugă listă globală de coloane interzise, aplicată la runtime pe cheile jsonb (`%ciphertext%`, `%_iv`, `%auth_tag%`, `%hash%`, `%token%`, `%secret%`). Test de migrare: `tg_argv[0]` se compară cu `information_schema.columns` și eșuează dacă o coloană din lista de excludere nu există. Arhivele `audit-archive` deja exportate se verifică retroactiv.

**C7. Două surse de adevăr pentru `super_admin` + drift de coloane în predicate.** ACCEPT — vezi contradicțiile #3, #4, #7. Corecție: migrare canonică `0001_kernel.sql`; test CI care rulează `EXPLAIN` pe fiecare politică din `pg_policies` (o coloană inexistentă cade imediat).

**C8. `CHECK` cu `current_date`/`now()` — ~9 constrângeri.** ACCEPT. Toate se mută în trigger-ul de business al modulului, cu `errcode='P0001'` și mesaj în română. În `CHECK` rămân doar reguli între coloanele aceluiași rând. Jobul CI care aplică migrările pe bază goală le prinde pe toate.

**C9. Index unic pe expresie STABLE (`demo_requests`).** ACCEPT.
```sql
created_day date GENERATED ALWAYS AS ((created_at AT TIME ZONE 'Europe/Bucharest')::date) STORED
-- UNIQUE(email, created_day) WHERE deleted_at IS NULL
```
Anti-spamul principal rămâne rate-limitul pe IP, nu indexul.

**C10. `expirables UNIQUE(entity_type, entity_id)` colapsează scadențele multiple.** ACCEPT. Cheia devine `UNIQUE(organization_id, entity_type, entity_id, kind) WHERE deleted_at IS NULL`. Toate `ON CONFLICT` din trigger-ele de sincronizare se actualizează. Fără asta, stingătoarele au proba de presiune expirată fără alertă.

**C11. Fazarea — Faza 1 nu e livrabilă într-o bucată.** ACCEPT. Se sparge în 1a/1b (vezi §5).

**C12. Contract de nucleu — documentele descriu nuclee incompatibile.** ACCEPT. Prima livrare este `0001_kernel.sql`; documentele de design devin schițe, se regenerează pe baza lui.

**C13. Risc scurgere între tenanți.** ACCEPT. Trei bariere mecanice în 1a (vezi §5, Faza 1a).

**C14. REVISAL absent complet.** ACCEPT. Modul `revisal` cu `revisal_events` (vezi §3), livrat în Faza 2. Fără el, HR ține un al doilea sistem în paralel și produsul își pierde rațiunea.

### 2.2 MARE — acceptate

**M1. Feature flags neverificate în RLS (principiul 4).** ACCEPT. `and app.feature_on(organization_id,'<modul>')` în TOATE politicile tabelelor modulare, inclusiv SELECT. `app.feature_on` se corectează să consulte `features.is_core`, nu literalul `'nucleu'`, și coloanele reale (`feature_key`, `enabled`). Test: dezactivează modulul → SELECT întoarce 0 rânduri, INSERT dă 42501.

**M2. WITH CHECK incomplet pe `leave_requests`, `business_trips`, `fault_reports`.** ACCEPT. Fiecare politică INSERT fixează starea inițială și zerofică valorile calculate: `status = 'draft'`, `working_days = 0`, `approved_by is null`, `submitted_at is null`, `suma_diurna_ron = 0`, `raportor_employee_id = app.current_employee_id(organization_id)`. Valorile derivate se completează exclusiv prin trigger `BEFORE`, ignorând ce trimite clientul.

**M3. `/api/export/[entity]` fără listă albă.** ACCEPT. Enum închis de entități permise, mapare entitate→permisiune, interdicție de client admin pe rută (verificată prin ESLint).

**M4. `accept_invitation` — email neconfirmat + resurecția membership-ului.** ACCEPT.
- `if u.email_confirmed_at is null then raise exception 'EMAIL_NECONFIRMAT'`
- Refuz explicit dacă există rând cu `deleted_at is not null` sau `status='plecat'` → cere reînrolare manuală, nu resurecție automată
- `peek_invitation` întoarce DOAR `{organization_name, expired}`, niciodată emailul; rate-limitată pe IP

**M5. View-uri fără `security_invoker`.** ACCEPT. Obligatoriu pe fiecare view (`employees_safe`, `v_employee_fitness`, toate `v_*`), verificat printr-un test pe `pg_class.reloptions` pentru `relkind='v'`. `discoverTables()` se extinde la view-uri. `MATERIALIZED VIEW` INTERZIS pe date multi-tenant.

**M6. `expirables` scurge date de sănătate prin `compliance.read`.** ACCEPT. Politica reevaluează permisiunea sursei:
```sql
case entity_type
  when 'medical_exam' then app.has_permission(organization_id,'ssm_medical','read') <> 'none'
  when 'employee_document' then app.has_permission(organization_id,'employee_documents','read') <> 'none'
  else app.has_permission(organization_id,'compliance','read') <> 'none' end
```
Pentru date de sănătate, `label` e anonimizat (`Fișă de aptitudine · marca 0142`); numele se rezolvă la afișare, cu permisiunea corectă.

**M7. XSS stocat prin `announcements` scrise direct prin PostgREST.** ACCEPT. Sanitizare la RANDARE (nu doar la scriere) + trigger `BEFORE INSERT/UPDATE` care respinge taguri/atribute în afara listei albe. CSP fără `unsafe-inline`. `CHECK(link ~ '^/[^/\\]')` — varianta actuală acceptă `//evil.com`.

**M8. Rate limiting absent pe autentificare/invitații.** ACCEPT. Tabelă `rate_limits(key, window_start, count)` în Postgres (nu in-memory — serverless are N instanțe), aplicată pe: login, magic link, resetare parolă, `peek_invitation`, `accept_invitation`, trimitere/retrimitere invitație, formular demo. Răspuns identic și timp constant pentru „email inexistent" vs „existent". Lockout progresiv scris în audit.

**M9. `redactPayload` superficial + `P0001` propagat textual + CNP în payload RSC.** ACCEPT.
- `redactPayload` recursiv, regex (`/cnp|iban|salar|token|secret|parol/i`), **allow-list** per acțiune în locul deny-list
- Mesajele `P0001` se mapează pe coduri, nu se propagă textual
- CNP/IBAN NU se decriptează niciodată într-un Server Component; doar Server Action la cerere, `dynamic='force-dynamic'` + `Cache-Control: no-store`, plus test automat care verifică absența valorii decriptate din HTML-ul randat

**M10. Realtime ignoră privilegiile de coloană + imutabilitatea auditului doar pe tabela părinte.** ACCEPT. `ALTER PUBLICATION supabase_realtime SET TABLE public.notifications;` explicit, cu test CI care cade dacă publicația conține altceva. `REVOKE`/regula de imutabilitate se aplică ÎN funcția care creează partiția. Pe căile de audit obligatoriu (citire CNP, export, schimbare de rol) se elimină `exception when others` — eșecul auditului face rollback.

**M11. Performanță RLS pe căi calde.** ACCEPT. Ordinea termenilor: întâi `organization_id = ANY((select app.current_org_ids()))` (InitPlan, sargable), apoi scope. `team_subtree()` se înlocuiește cu `employees.manager_path @> ARRAY[my_employee_id]` + index GIN. Paginare keyset peste tot pe liste mari. Validare cu `EXPLAIN (ANALYZE, BUFFERS)` pe seed de 375k rânduri.

**M12. Testul de izolare RLS contrazice designul.** ACCEPT — și e cea mai valoroasă piesă din tot pachetul. Corecții:
- `FORCE RLS` pe toate MINUS listă albă comisă cu motiv: `organization_members`, `platform_admins`, `role_permissions`, `features`
- Pentru DELETE, aserțiunea se INVERSEAZĂ: nu trebuie să existe politică DELETE, iar `DELETE` trebuie revocat de la `authenticated`
- Se adaugă aserțiunea care lipsește: pentru fiecare tabelă cu `organization_id`, INSERT cross-tenant trebuie să eșueze (azi se testează doar `departments`)
- Fixture-ul trebuie să aibă ≥1 rând pentru org B în fiecare tabelă tenant-scoped, altfel testul trece fals-pozitiv

**M13. Concediu medical modelat ca un singur tip.** ACCEPT. Tabelă `medical_leave_codes` + coloane pe cerere (cod indemnizație, serie/număr certificat, zile calendaristice, certificat inițial) + split plătitor pe `leave_request_days`. NU se stochează diagnosticul (art. 9 GDPR).

**M14. Timp de muncă: repaus, medie săptămânală, compensare ore suplimentare.** ACCEPT. Extinde `attendance_settings` cu `perioada_referinta_saptamani`, `max_ore_saptamana_cu_suplimentare`, `repaus_minim_intre_zile_ore`, `repaus_saptamanal_ore`, `termen_compensare_ore_libere_zile`. Tabelă `overtime_compensation`. Fără ele, sistemul produce dovada scrisă a încălcării, semnată de firmă.

**M15. Spor sărbătoare legală absent + zile libere compensatorii.** ACCEPT. `payroll_settings.procent_spor_sarbatoare_legala` + `termen_zi_libera_compensatorie_zile` + tabelă `holiday_compensation`.

**M16. Indemnizația CO și compensarea la încetare.** ACCEPT. `co_baza_calcul_luni`, `co_include_sporuri_permanente`, `co_plata_inainte_zile_lucratoare` în `payroll_settings`; funcție pură `calculeazaBazaIndemnizatieCO`; la încetare, generare automată `payroll_bonuses` cu `tip='compensare_co_neefectuat'`.

**M17. Sporuri permanente contractuale absente.** ACCEPT. Tabelă `salary_components` + nomenclator `salary_component_types`. Fără ele, baza de calcul a indemnizației CO și CM e structural greșită pentru toți angajații.

**M18. Câmpuri legale lipsă pe `employees`.** ACCEPT. Motorul de salarii cere `nrPersoaneIntretinere`, `scutiri`, `optiunePilonII` — niciunul nu există ca coloană. Vezi §3.

**M19. Documente HR obligatorii absente.** ACCEPT. `hr_document_templates` + `hr_issued_documents` + `job_descriptions`. Adeverința de venit cerută în prima săptămână, imposibil de generat → HR revine la Word și produsul își pierde credibilitatea.

**M20. Constrângeri care blochează situații legale.** ACCEPT.
- `leave_requests` EXCLUDE: se adaugă `leave_types.intrerupe_alte_concedii boolean` și tipurile cu acest flag ies din predicat; CM peste CO marchează zilele suprapuse `intrerupta` + restituie soldul
- `employees UNIQUE(organization_id, user_id)`: unicitatea se mută la nivel de contract; se adaugă `employees.is_primary boolean` cu `UNIQUE(organization_id, user_id) WHERE is_primary AND deleted_at IS NULL`, iar `app.current_employee_id(org)` returnează fișa principală

**M21. Registre SSM obligatorii absente.** ACCEPT. `risk_assessments`, `prevention_plan_measures`, `work_accidents`, `dangerous_incidents`, `occupational_diseases`, `safety_committee_meetings`, `ppe_issuances`. Sunt primele cerute la orice control ITM.

**M22. ISCIR — autorizații de funcționare și personal deservent.** ACCEPT. `iscir_authorizations` + `personnel_authorizations`, cu verificare blocantă la asignarea unei intervenții (override doar org_admin, cu motiv, în audit).

**M23. `vehicle_documents` EXCLUDE blochează reînnoirea normală.** ACCEPT. Se renunță la EXCLUDE; rămâne `UNIQUE(organization_id, vehicle_id, tip) WHERE deleted_at IS NULL AND este_curent`. Trigger-ul de `este_curent` alege documentul cu `expira_la` maxim, nu ultimul inserat.

**M24. Trigger-e care referă coloane inexistente.** ACCEPT. Regulă absolută: nicio funcție PL/pgSQL care referă o tabelă dintr-o fază viitoare nu se scrie în avans. `plpgsql_check` pe toate funcțiile după migrare, în CI.

**M25. Retenție audit: `DETACH CONCURRENTLY` în funcție + volum.** ACCEPT PARȚIAL. `DETACH CONCURRENTLY` nu poate rula în bloc tranzacțional → se execută ca statement top-level din `pg_cron`/Edge Function. Se elimină DUBLA scriere: `attendance_audit_entry_status` și `tg_audit` înregistrează același eveniment — rămâne unul. **RESPING** afirmația că `pg_partman` e disponibil pe Supabase: se verifică efectiv înainte de a depinde de el; până atunci, funcție proprie (vezi și §2.3 R2).

**M26. UNIQUE-uri care blochează operațiuni legitime.** ACCEPT.
- `payroll_periods`: `+ is_regularizare boolean, secventa smallint`, `UNIQUE(organization_id, an, luna, secventa)`, `CHECK(secventa = 0 OR is_regularizare)`
- `inventory_items`: se ELIMINĂ soft delete-ul; revocarea unui import se face în bloc pe `import_batch_id` înainte de orice alocare; un singur index unic, normalizat, nefiltrat
- `checklist_instances`: `+ ciclu smallint` în cheie (reangajare)
- `organizations`: `UNIQUE(cui_normalizat)` NEfiltrată pe `deleted_at`

**M27. `leave_request_days` — denormalizare fără sincronizare + FK neindexat.** ACCEPT. `CREATE INDEX ON leave_request_days (leave_request_id)` (obligatoriu pentru orice FK cu CASCADE) + trigger `AFTER UPDATE OF status ON leave_requests` care propagă în aceeași tranzacție. Test de reconciliere nocturn.

**M28. Cuplarea rigidă pontaj→salarii + CHECK zile fals.** ACCEPT. `blocheaza_la_concedii_in_asteptare` devine configurabil, implicit **NU** (avertisment cu listă + decizie în bloc din ecranul de salarii). Trecerea peste avertisment cere `payroll.approve` și scrie motivul în audit. CHECK-ul devine `zile_concediu + zile_absente <= zile_lucratoare_luna`; `zile_lucrate > zile_lucratoare_luna` e legitim (schimburi, weekend) și doar semnalat în `calc_warnings`.

**M29. Enum `contract_type` amestecat.** ACCEPT — vezi contradicția #15.

**M30. `payroll_periods` — dependență de pontaj în stare inexistentă.** ACCEPT. `attendance_period_status` are doar `open|locked`, dar trigger-ul verifică `<> 'aprobat'` → calculul salariilor nu ar porni niciodată. Se adaugă starea `aprobat` în enum-ul de pontaj (`open|locked|aprobat`) sau, mai simplu, condiția devine `= 'locked'`. **Decizie: `= 'locked'`** — blocarea perioadei ESTE aprobarea ei, nu adăugăm o a treia stare.

**M31. Ordinea fazelor — 5 dependențe inversate.** ACCEPT integral. Vezi §5.

**M32. Estimare de efort.** ACCEPT. Se prezintă clientului 14–18 luni calendaristice, nu „câteva luni". Vezi §5.

**M33. Riscuri dezvoltare fără Docker.** ACCEPT. Patru proiecte Supabase (`prod`/`staging`/`dev`/`test`, toate pe plan plătit, Frankfurt). Mitigarea-cheie: **Postgres NATIV local** (Postgres.app / `brew install postgresql@15`) — nu ai nevoie de Supabase local ca să validezi DDL, ai nevoie de Postgres. `psql -v ON_ERROR_STOP=1 -f migrations/*.sql` în 5 secunde înainte de push elimină 80% din risc. `reset-test-db.sh` primește **listă albă** de ref-uri, nu neagră.

**M34. Fără client pilot.** ACCEPT mitigarea. Echipa își creează propria firmă ca tenant zero la finalul Fazei 1b și o folosește efectiv. Înainte de Faza 2, clientul livrează trei artefacte REALE: export Excel cu angajați, foaie colectivă semnată, un fluturaș. Acestea SUNT specificația.

**M35. Detașare transnațională.** ACCEPT parțial — se adaugă ACUM valoarea de enum `detasare_transnationala` și câmpurile pe `business_trips` (`stat_gazda`, `declaratie_prealabila_numar/data`, `persoana_de_legatura`, `salariu_minim_stat_gazda`). Implementarea completă a regulilor se amână la Faza 10, dar structura există de la început ca datele istorice să nu se încadreze greșit.

**M36. Sub-normalizare calendar.** ACCEPT — vezi contradicția #6. Test de reconciliere obligatoriu: zile lucrătoare calculate de motorul de pontaj = cele calculate de motorul de concedii, pentru 36 de luni consecutive.

**M37. Supra-inginerie DB de tăiat.** ACCEPT integral lista: partiționare audit (păstrează doar append-only + REVOKE + index), `features.depends_on`+`min_plan`+`is_beta` (constantă TS), `org_calendar_days` materializat (funcție pură, tabela vine când e nevoie), `notification_preferences` cu quiet_hours/digest, `employee_change_requests`, `approval_steps.conditie_sarire`, `demo_requests` cu UTM/pipeline de 6 stări, jumătate din `attendance_settings`. **PĂSTREAZĂ însă mecanismul de versionare** — el e cel scump retroactiv.

**M38. Supra-inginerie UI de tăiat în Faza 1.** ACCEPT integral: OKLCH complet (rămâne `primary_color` + `pickForeground` de 10 linii), APCA, `organization_branding` complet, i18n cu 16 namespace-uri (rămâne doar `lib/format/`), PDF, outbox de notificări. 2–3 săptămâni recuperate, investite în testul de izolare și Super-Admin.

**M39. Privilegii de coloană ca mecanism de autorizare.** ACCEPT — vezi contradicția #13.

### 2.3 RESPINSE / MODIFICATE

**R1. „`security_invoker` rezolvă problema view-urilor, deci putem folosi view-uri pentru rapoarte."** — MODIFICAT. Acceptăm `security_invoker=true` pe view-uri simple de raport, dar INTERZICEM view-uri în orice cale de securitate (nu poți pune `CREATE POLICY` pe un view; o tabelă sursă nouă fără RLS îl găurește tăcut). Rapoartele critice se scriu ca funcții `SECURITY INVOKER` sau query-uri directe în `lib/queries/`.

**R2. „`pg_partman` nu e disponibil pe Supabase" (design) / „este disponibil" (critică model-date).** — NEREZOLVAT prin argument; se VERIFICĂ empiric în Faza 0 (`select * from pg_available_extensions where name='pg_partman'`). Până la verificare, partiționarea auditului e oricum tăiată din scope (M37), deci nu blochează nimic.

**R3. „Toate tabelele trebuie să aibă `FORCE ROW LEVEL SECURITY`."** — RESPINS ca regulă universală. `organization_members`, `platform_admins`, `role_permissions`, `features` trebuie să rămână `NO FORCE`, altfel helperii `SECURITY DEFINER` deținuți de proprietar reintroduc recursiunea infinită. Lista albă e comisă în repo cu motivul scris.

**R4. „Fiecare tabelă trebuie să aibă politică DELETE."** — RESPINS. Soft delete peste tot înseamnă că absența politicii DELETE + `REVOKE DELETE` ESTE regula corectă. Testul se inversează.

**R5. „Interzice orice blocaj la calculul salariilor peste concedii în așteptare."** — MODIFICAT, nu respins: blocajul devine configurabil cu default permisiv (M28), pentru că plata cu întârziere a salariilor e ea însăși încălcare. Dar rămâne blocant pe pontaj neaprobat — acolo riscul de calcul greșit e mai mare decât cel de întârziere.

**R6. „Adaugă captcha pe formularul de demo."** — RESPINS preventiv. Rate limit persistent pe IP + funcție `SECURITY DEFINER` apelabilă de `anon` (deci fără `service_role` pe calea publică). Captcha se adaugă doar dacă apare spam real.

**R7. „Materializează vizibilitatea anunțurilor per (user, announcement)."** — RESPINS (designul îl respinge deja corect). La 400 de angajați un anunț = 400 de inserări, iar orice mutare de departament cere reconstrucție → cineva vede un anunț care nu-i mai era destinat. `match_key` + `= ANY(array)` e soluția corectă.

**R8. „APCA ca al doilea criteriu de contrast."** — RESPINS pentru Faza 1 și afișarea informativă amânată. WCAG 2.1 AA e criteriul contractual și cel invocabil la audit; APCA e draft. Se afișează doar dacă clientul îl cere explicit.

---

## 3. TABELE ȘI COLOANE LIPSĂ

### Tabele complet absente

| Tabelă | Modul | De ce e obligatorie |
|---|---|---|
| `revisal_events` | HR (Faza 2) | Termen legal de transmitere per eveniment CIM; fără ea, netransmiterea în termen = contravenție per salariat |
| `medical_leave_codes` | leave (Faza 3a) | Coduri de indemnizație cu procent, zile suportate de angajator, plătitor, bază de calcul, plafon |
| `salary_components` + `salary_component_types` | HR/payroll (Faza 2/9) | Sporuri permanente contractuale; intră în baza CO și CM — fără ele ambele calcule sunt structural greșite |
| `employee_tax_exemptions` | HR (Faza 2) | Scutirile sunt temporale (IT/construcții/agricultură), nu un array pe angajat |
| `work_permits` | HR (Faza 2) | Aviz de muncă non-UE; expiră; depășirea = muncă ilegală |
| `overtime_compensation` | attendance (Faza 3b) | Ore libere compensatorii de acordat în termen — mecanismul legal PRINCIPAL, sporul e alternativa |
| `holiday_compensation` | attendance (Faza 3b) | Zile libere compensatorii pentru muncă în sărbătoare legală |
| `leave_entitlement_rules` | leave (Faza 3a) | CO suplimentar pentru condiții deosebite/vătămătoare, nevăzători, sub 18 ani |
| `hr_document_templates` + `hr_issued_documents` | HR (Faza 2) | Adeverințe de venit/vechime, informarea art. 17, cu numerotare și hash |
| `job_descriptions` | HR (Faza 2) | Fișa postului = anexă obligatorie la CIM, cu versiuni și semnătură |
| `risk_assessments` + `risk_assessment_items` | SSM (Faza 7) | Prima cerință la orice control ITM |
| `prevention_plan_measures` | SSM (Faza 7) | Derivat din evaluarea riscurilor; măsuri, responsabili, termene |
| `work_accidents` + `dangerous_incidents` + `occupational_diseases` | SSM (Faza 7) | Registre obligatorii; termen de comunicare la ITM de ordinul orelor |
| `safety_committee_meetings` | SSM (Faza 7) | CSSM obligatoriu peste pragul de salariați — jumătate din publicul-țintă |
| `ppe_issuances` | SSM (Faza 7) | EIP gratuit, cu evidența predării și durata de utilizare; `expirable_entity_type` îl referea fără tabelă |
| `iscir_authorizations` | mentenanță (Faza 7) | Autorizația de funcționare a instalației; expirată = funcționare ilegală |
| `personnel_authorizations` | mentenanță (Faza 7) | RSVTI, stivuitorist, fochist, macaragiu — nominale, periodice |
| `evacuation_drills` + `hot_work_permits` | PSI (Faza 7) | Exerciții de evacuare cu PV, permis de lucru cu foc |
| `rate_limits` | nucleu (Faza 1a) | În-memory nu funcționează pe serverless |
| `email_log` | nucleu (Faza 1b) | Substitutul simplu al outbox-ului până în Faza 3 |
| `document_sequences` | nucleu (Faza 1a) | Numerotare per organizație și an pentru toate documentele oficiale |
| `retention_policies` | nucleu (Faza 1a, seed obligatoriu) | Promisă în design, niciodată definită; fără seed, joburile de arhivare tac |

### Coloane absente pe tabele existente

**`employees`**: `gen`, `cetatenie` (FK `countries`), `tip_act_identitate`, `serie_act`, `numar_act`, `conditii_munca` (normale/deosebite/speciale — determină cota CAS angajator), `grad_handicap`, `nr_persoane_intretinere`, `optiune_pilon_ii`, `cod_cor`, `is_primary boolean`, `manager_path uuid[]`, `full_name GENERATED STORED`.

**`payroll_settings`**: `procent_spor_sarbatoare_legala`, `termen_zi_libera_compensatorie_zile`, `co_baza_calcul_luni`, `co_include_sporuri_permanente`, `co_plata_inainte_zile_lucratoare`, `salariu_minim_constructii`, `salariu_minim_agricultura`, `plafon_poprire_procent_net`, `cota_pilon_ii`, `reguli_rotunjire jsonb`.

**`attendance_settings`**: `perioada_referinta_saptamani`, `max_ore_saptamana_cu_suplimentare`, `repaus_minim_intre_zile_ore`, `repaus_saptamanal_ore`, `termen_compensare_ore_libere_zile`, `interzice_supl_sub_18`, `interzice_supl_part_time`.

**`leave_types`**: `intrerupe_alte_concedii boolean`, `necesita_recuperare boolean`, `zile_recuperare_termen`, `mod_rotunjire_acumulare`, `mod_reportare`, `plafon_reportare_zile`.

**`payroll_periods`**: `is_regularizare boolean`, `secventa smallint`.

**`business_trips`**: `stat_gazda`, `declaratie_prealabila_numar`, `declaratie_prealabila_data`, `persoana_de_legatura`, `salariu_minim_stat_gazda`, `indemnizatie_detasare`.

**`checklist_instances`**: `ciclu smallint`.

**`employment_contracts`**: `contract_duration`, `norma_ore_saptamana`, `work_mode`, `special_regime`, `cod_revisal`, `loc_telemunca` (cu verificare SSM la acel loc).

**`ssm_training_types` / `ssm_trainings`**: `domeniu` (`ssm|psi|prim_ajutor|protectia_mediului`) — instruirea PSI e obligație SEPARATĂ, cu fișă proprie.

**`demo_requests`**: `created_day date GENERATED STORED`.

---

## 4. VALORI LEGALE CONFIGURABILE (pentru NOTES.md)

> **Toate valorile de mai jos se verifică de contabil autorizat / jurist de dreptul muncii înainte de seed. Niciuna nu apare hardcodată în cod. Fiecare are `valabil_de_la` și istoric.**

### Fiscal — salarizare (`payroll_settings`, versionat pe `valabil_de_la`)
| Valoare | De ce se schimbă |
|---|---|
| Cota CAS angajat (+ cote majorate condiții deosebite/speciale) | Cod fiscal, legea bugetului asigurărilor sociale |
| Cota CASS angajat | Cod fiscal |
| Cota impozit pe venit din salarii | Cod fiscal |
| Cota CAM angajator | Cod fiscal |
| Salariu minim brut garantat + minime sectoriale (construcții, agricultură/ind. alimentară) | HG anuală, uneori de două ori pe an |
| Cotă Pilon II + opțiunea de participare | Legea pensiilor private |
| Reguli de rotunjire per contribuție (la leu/ban, sus/matematic) | Norme metodologice |
| Plafon legal cumulat al reținerilor din net + ordinea priorității creanțelor | Cod procedură civilă |
| Facilități sectoriale IT/construcții/agroalimentar: condiții, plafoane, contribuții scutite | Se schimbă frecvent, uneori retroactiv |

### Deducere personală (`payroll_personal_deduction_brackets`)
| Valoare | De ce se schimbă |
|---|---|
| Salariu minim de referință pentru calcul | Corelat cu salariul minim |
| Praguri de venit × număr persoane în întreținere | Cod fiscal |
| Procente/sume pe fiecare prag; interval de degresivitate | Cod fiscal |

### Tichete și venituri neimpozabile (`payroll_settings`)
| Valoare | De ce se schimbă |
|---|---|
| Valoarea maximă legală a tichetului de masă | Ordin lunar/semestrial |
| Regimul fiscal al tichetelor (ce contribuții se aplică) | Schimbat de mai multe ori în ultimii ani |
| Plafon lunar cumulat venituri neimpozabile (33% din salariul de bază) + ORDINEA de includere | Cod fiscal |

### Timp de muncă și sporuri (`attendance_settings`, `payroll_settings`)
| Valoare | De ce se schimbă |
|---|---|
| Procent minim ore suplimentare (primele / următoarele) | Cod muncii, CCM poate fi mai favorabil |
| Procent minim spor de noapte + interval nocturn + prag ore | Cod muncii |
| Procent spor muncă în weekend | CCM |
| **Procent spor sărbătoare legală** + termen zi liberă compensatorie | Cod muncii |
| Durată maximă săptămânală cu ore suplimentare + perioadă de referință (4 luni, extensibilă prin CCM) | Cod muncii, directive UE |
| Repaus minim între zile de muncă / repaus săptămânal | Cod muncii |
| Termen de compensare a orelor suplimentare cu ore libere | Cod muncii |
| Interdicții ore suplimentare (sub 18 ani, part-time) | Cod muncii |
| Pauză obligatorie: după câte ore, cât durează | Cod muncii, RI |

### Concedii (`leave_types`, `leave_entitlement_rules`, `medical_leave_codes`)
| Valoare | De ce se schimbă |
|---|---|
| Zile minime CO/an (20) + zile suplimentare pe categorii (condiții deosebite, nevăzători, sub 18) | Cod muncii |
| Zile pentru evenimente familiale (căsătorie, naștere, deces, donator, îngrijitor, paternal) | Cod muncii + legi speciale |
| Durata concediului de maternitate (zile CALENDARISTICE) și creștere copil | Legi speciale |
| Termen de reportare CO (18 luni) + mod de reportare (integral/plafonat) | Cod muncii |
| Mod de rotunjire a acumulării proporționale | **NU are regulă legală** — CCM/RI; azi e hardcodat `ceil(x*2)/2` |
| Coduri de indemnizație CM: procent plată, zile suportate de angajator, plătitor, luni bază de calcul, plafon bază | OUG 158/2005 + norme, modificate anual |
| Bază de calcul indemnizație CO: câte luni, ce sporuri intră, termen de plată anticipată | Cod muncii + HG |

### Sărbători legale (`public_holidays`, seed multi-an 2024–2040)
| Valoare | De ce se schimbă |
|---|---|
| Lista celor 12 zile fixe + 5 mobile (offset față de Paștele ortodox) | **Lista s-a schimbat prin lege**: 6/7 ianuarie adăugate în 2016, Vinerea Mare în 2018 |
| Zile libere pentru salariații altor culte religioase legale | Cod muncii — obligație expresă |

### Diurne (`per_diem_policies`, `per_diem_country_rates`)
| Valoare | De ce se schimbă |
|---|---|
| Baremul intern pentru instituții publice + multiplu de plafonare (2,5×) | HG, actualizată periodic |
| Baremul HG 518/1995 pe țări și valute | HG, actualizări periodice |
| Plafon 3 salarii de bază/lună | Cod fiscal |
| Prag ore pentru zi întreagă/jumătate de zi | Regulament intern al firmei |
| Tarif/km pentru autoturism personal + plafon fiscal | Cod fiscal |
| Regim detașare transnațională: salariu minim stat gazdă, tratament indemnizație | Legea 16/2017 + directive UE |

### SSM / PSI / ISCIR (tabele de configurare cu `valabil_de_la`)
| Valoare | De ce se schimbă |
|---|---|
| Periodicitate instruire SSM: introductivă, la locul de muncă, periodică (6 vs 12 luni pe pericol) | HG 1425/2006 + evaluarea riscurilor |
| Periodicitate instruire PSI (domeniu SEPARAT de SSM) | Legea 307/2006 + norme |
| Intervale verificare stingătoare: verificare (12 luni), reîncărcare, probă presiune (60/120 luni) | Norme tehnice, per tip |
| Periodicitate medicina muncii pe categorii de post | HG 355/2007 |
| Termen comunicare accident de muncă la ITM | Legea 319/2006 |
| Prag salariați pentru CSSM obligatoriu | Legea 319/2006 |
| Prag salariați pentru cota legală de angajare persoane cu handicap + plată compensatorie | Legea 448/2006 |
| Periodicități verificare tehnică ISCIR pe tip de instalație | Prescripții tehnice ISCIR |
| Durate de utilizare EIP pe tip | Norme + evaluarea riscurilor |

### Retenție și arhivare (`retention_policies`)
| Valoare | De ce se schimbă |
|---|---|
| Termen păstrare state de plată și documente de vechime (decenii) | Legea arhivelor, cerințe casa de pensii |
| Termen păstrare documente financiar-contabile | Legea contabilității |
| Termen păstrare documente instruire SSM | Legea 319/2006 |
| Termen păstrare audit_logs (3 ani propus) | Prescripție generală + control ITM/ANAF |
| Termen ștergere IP/user_agent din lead-uri respinse | GDPR — minimizare |

### REVISAL (`revisal_config`)
| Valoare | De ce se schimbă |
|---|---|
| Termen transmitere elemente CIM (înainte de începerea activității) | HG 905/2017 + modificări |
| Termen transmitere modificări (salariu, funcție, normă, suspendare, încetare) | HG 905/2017 |
| Codurile de temei încetare/suspendare | Cod muncii |
| Structura fișierului de export | Inspecția Muncii — **se validează cu ITM, nu se presupune** |

---

## 5. PLANUL PE FAZE

> Estimările sunt **zile de lucru pentru un dezvoltator senior**, fără marja de feedback. Total dezvoltare pură: **240–310 zile**. Cu 25–35% pentru rework între faze (clientul se oprește după fiecare): **14–18 luni calendaristice**.

### FAZA 0 — Setup (5–7 zile)
**Livrabile verificabile:** 4 proiecte Supabase (`prod`/`staging`/`dev`/`test`, Frankfurt, plan plătit); Postgres nativ local pe fiecare mașină; repo cu Next.js 15 + TS strict + Tailwind v4 + shadcn; `config/env.ts` cu Zod care aruncă la boot; CI cu jobul `migrations` (aplică toate migrările pe bază goală + regenerează tipuri + diff); `scripts/reset-test-db.sh` cu **listă albă** de ref-uri; ESLint cu `no-restricted-imports` pentru `admin.ts` + `.allowlist` comis.
**Criteriu de acceptare:** un PR gol trece CI verde; `psql -f migrations/*.sql` pe bază locală goală rulează în <10s.
**Verificare punctuală:** `select * from pg_available_extensions where name='pg_partman'` — răspunde la R2.

### FAZA 1a — Fundația (18–22 zile) · ZERO ecrane
**Livrabile:**
1. `0000_extensions.sql` (`pgcrypto`, `citext`, `btree_gist`) — separat, înaintea oricărei tabele
2. `0001_kernel.sql` — enum-uri canonice, `organizations`, `profiles`, `organization_members`, `platform_admins`, `role_permissions`, `features`, `organization_features`, `invitations`, `audit_logs`, `rate_limits`, `document_sequences`, `retention_policies`; TOATE cu `organization_id`+`deleted_at`+`created_by/at`+`updated_by/at` din prima migrare
3. Helperii `app.*` (un singur namespace, `SET search_path=''`, nume calificate, `REVOKE`+`GRANT` explicit)
4. Politicile RLS pe aceste tabele + `attach_standard_triggers()`
5. Seed global `role_permissions`
6. `resolveTenant()` + cookie HMAC + `createAction()` cu 8 straturi și `minScope` obligatoriu
7. Autentificare (parolă, magic link, resetare) + acceptare invitație + rate limiting persistent
8. Shell aplicație: sidebar din `navigation.ts`, topbar, pagini goale
9. **Testul generic de izolare RLS** cu listele albe corectate (M12) + fixture cu 2 organizații complete
10. `lib/format/{date,money}.ts`
**Criteriu de acceptare:** două organizații în seed, doi utilizatori, testul de izolare verde; adaugi intenționat o tabelă fără RLS → testul devine roșu.
**Ce NU se face:** niciun ecran de administrare, OKLCH, i18n, PDF, outbox.

### FAZA 1b — Super-Admin și comutatorul (16–20 zile)
**Livrabile:** CRUD organizații (creare, activare, suspendare, plan/seats); activare module per organizație; membri + invitații din UI; `role_permissions` read-only; cereri demo (formular public prin funcție `SECURITY DEFINER` apelabilă de `anon` + rate limit — **fără `service_role` pe calea publică**); jurnal de audit filtrabil; comutator de organizație în topbar; email prin Resend în mod test + `email_log`.
**Criteriu de acceptare:** clientul creează singur o organizație reală, invită un coleg, acesta se loghează și vede shell-ul cu exact modulele activate. **Regula de aur: nimic din 1b nu modifică o tabelă din 1a.**
**La final:** echipa își creează propria firmă ca tenant zero (M34).

### FAZA 2 — HR nucleu + REVISAL (30–38 zile)
**Dependențe:** 1b. **Precondiție client:** cele trei artefacte reale (export Excel angajați, foaie colectivă, fluturaș).
**Livrabile:** `departments` (ierarhie, anti-ciclu), `job_positions`, `employees` cu TOATE coloanele legale (§3), `employment_contracts` cu dimensiuni separate, `employee_documents`, `employee_sensitive_data` + modulul de criptare AES-256-GCM cu rotație de chei, `hr_document_templates`+`hr_issued_documents`, `job_descriptions`, `employee_tax_exemptions`, `work_permits`, `salary_components`, `revisal_events` + export.
**Criteriu de acceptare:** import Excel real cu 50+ angajați; generare adeverință de venit; citire CNP cu rând de audit vizibil; export REVISAL pentru o angajare nouă cu termenul calculat.

### FAZA 3a — Calendar și concedii (22–26 zile)
**Dependențe:** 2. **Motiv de ordine:** pontajul consumă concediile aprobate, nu invers.
**Livrabile:** `public_holidays` seed multi-an 2024–2040 (17 zile/an, valori hardcodate în teste), `organization_holidays`, `leave_types` + seed complet, `leave_entitlement_rules`, `leave_requests`, `leave_request_days` (cu index pe FK + trigger de propagare status), `leave_balances`, `leave_accruals`, `medical_leave_codes`, infrastructura `approval_*` cu flux CODAT, funcția pură `calculeazaZileLucratoare`, acumulare lunară via `pg_cron`.
**Criteriu de acceptare:** `pasteOrtodox(2026)` = 12.04.2026 și `(2027)` = 02.05.2027 din teste cu valori scrise manual; CM introdus peste CO aprobat întrerupe corect și restituie soldul; job-ul de acumulare rulat de două ori nu dublează.

### FAZA 3b — Pontaj (22–26 zile)
**Dependențe:** 3a.
**Livrabile:** `attendance_periods`, `attendance_settings` (cu coloanele de repaus/medie săptămânală), `attendance_entries`, `attendance_approval_batches`, `overtime_compensation`, `holiday_compensation`, funcția pură `computeAttendance()` cu cazuri DST (29/30 martie, 25/26 octombrie), `attendance_sync_auto_entries` idempotentă, blocare perioadă pe două straturi, export foaie colectivă (Excel — primul PDF).
**Criteriu de acceptare:** **test de reconciliere calendar** — zile lucrătoare din motorul de pontaj = cele din motorul de concedii, 36 de luni consecutive; tură 22:00–06:00 peste schimbarea orei calculată corect.

### FAZA 4 — Infrastructura de expirări + notificări (10–13 zile)
**Dependențe:** 3b. **Motiv de fază proprie:** SSM, mentenanță și flotă o presupun; primul modul care o cere ar plăti un cost invizibil în estimare.
**Livrabile:** `expirables` (cheie corectată cu `kind`), `alert_rules`, `compliance_alerts`, `alert_notifications`, jobul cu 4 faze, outbox tranzacțional complet + dispecer + webhook Resend, dashboard conformitate (gol, dar funcțional).
**Criteriu de acceptare:** jobul rulat de două ori în aceeași zi inserează 0 alerte noi; documentul reînnoit închide seria veche automat.

### FAZA 5 — Inventar (16–20 zile)
**Dependențe:** 4. **Motiv de ordine:** checklist-ul de offboarding depinde de alocări.
**Livrabile:** `inventory_categories`, `inventory_items` (fără soft delete, index unic normalizat), `inventory_allocations` cu `EXCLUDE USING gist`, import Excel cu staging + preview + partial apply + raport de erori, PDF proces-verbal predare-primire.
**Criteriu de acceptare:** import de 300 de rânduri cu 4 duplicate → aplicare parțială + raport descărcabil; două predări concurente ale aceluiași obiect → una eșuează cu mesaj în română.

### FAZA 6 — Checklist onboarding/offboarding (10–13 zile)
**Dependențe:** 5.
**Livrabile:** `checklist_templates`, `checklist_template_items`, `checklist_instances` (cu `ciclu`), `checklist_instance_items`, `sync_itemi_returnare_inventar()`, trigger de blocare a finalizării pe obiecte nereturnate, dovada de parcurgere (timestamp + hash + IP).
**Criteriu de acceptare:** offboarding cu un laptop nereturnat nu se poate finaliza; înregistrarea returnării închide automat pasul.

### FAZA 7 — SSM + PSI + mentenanță (32–40 zile)
**Dependențe:** 4 (expirări), 2 (angajați).
**Livrabile:** instruiri cu `domeniu` (SSM/PSI separate), `risk_assessments`, `prevention_plan_measures`, `work_accidents`, `dangerous_incidents`, `occupational_diseases`, `safety_committee_meetings`, `ppe_issuances`, `fire_extinguishers`+verificări, `evacuation_drills`, `hot_work_permits`, `environmental_permits`, `occupational_health_exams` + `employee_work_restrictions`, `equipment`, contoare, planuri, intervenții, `fault_reports`, `iscir_authorizations`, `personnel_authorizations` cu blocare la asignare.
**Criteriu de acceptare:** angajat fără autorizație de stivuitorist valabilă nu poate fi asignat pe utilaj ISCIR (override org_admin cu motiv în audit); fișa medicală expirată produce restricție și avertisment la pontaj.

### FAZA 8 — Flotă (16–20 zile)
**Dependențe:** 4, 7 (echipamente montate pe vehicule).
**Livrabile:** `vehicles`, `vehicle_documents` (fără EXCLUDE), `trip_sheets`, `fuel_entries`, `odometer_anomalies`, rapoarte de consum și cost/km.
**Criteriu de acceptare:** reînnoirea RCA cu 3 săptămâni înainte de expirare NU dă eroare; regres de kilometraj blochează, gap doar avertizează.

### FAZA 9 — Salarizare (32–40 zile cod, 50–60 calendaristic)
**Dependențe:** 3b (pontaj aprobat), 3a (concedii), 2 (contracte + sporuri permanente).
**Livrabile:** `payroll_settings` versionat, `payroll_personal_deduction_brackets`, `payroll_periods` (cu `is_regularizare`+`secventa`), `payroll_entries` cu `settings_snapshot`, `payroll_bonuses`, `payroll_deductions`, `payslip_views`, funcția pură `calculatePayrollEntry` cu `breakdown`, fluturaș PDF, ecran de setări cu avertismentul persistent.
**Criteriu de acceptare:** fișierul de cazuri de test furnizat de contabil trece 100%; recalcularea unei luni închise e imposibilă fără perioadă de regularizare.
**Notă de risc:** diferența 32–40 → 50–60 este ciclul de întrebări-răspunsuri cu contabilul autorizat, care lucrează la altceva.

### FAZA 10 — Diurne (13–16 zile)
**Dependențe:** 9 (reîncadrare fiscală peste plafon), 8 (foaie de parcurs).
**Livrabile:** `countries`, `per_diem_country_rates`, `per_diem_policies`, `business_trips` (cu câmpurile de detașare transnațională), `business_trip_legs`, `trip_expenses`, funcția pură `calculeazaZileDiurna`, PDF ordin de deplasare + decont, trigger de creare `payroll_bonuses` la depășire de plafon.
**Criteriu de acceptare:** deplasare 22:00→06:00 = 0 zile; multi-țară alocă corect ziua trecerii frontierei; depășirea de plafon apare ca bonus impozabil în luna corectă.

### FAZA 11 — Portal angajat + finisaj (26–33 zile)
**Dependențe:** toate.
**Livrabile:** portal mobile-first, `employee_change_requests`, branding complet (OKLCH, logo, favicon), i18n next-intl, fluxuri de aprobare configurabile, `notification_preferences`, DNS Resend (SPF/DKIM/DMARC + warm-up), accesibilitate AA, E2E Playwright complet, partiționare audit dacă volumul o cere.
**Criteriu de acceptare:** un angajat de teren cere concediu de pe telefon în sub 60 de secunde; emailurile ajung în Inbox, nu în Spam.

---

## 6. TESTARE MANUALĂ LA FINALUL FAZEI 1 (executată de client)

1. Creează organizația „Alfa SRL" din Super-Admin cu CUI valid → verifică slug generat, status `in_asteptare`, `trial_ends_at` completat.
2. Încearcă a doua organizație cu ACELAȘI CUI scris altfel („RO 123 456") → refuz cu mesaj în română.
3. Activează Alfa; activează DOAR modulele Concedii și Pontaj → restul nu apar în meniu.
4. Invită `admin@alfa.test` ca org_admin → în mod test linkul apare în jurnal, fără email real trimis.
5. Deschide linkul în fereastră privată, autentifică-te → rol corect, dashboard Alfa.
6. Reutilizează același link → „Invitația nu mai este validă."
7. Modifică o literă din token în URL → același mesaj, fără stack trace și **fără să afle numele organizației**.
8. Repetă 1–5 pentru „Beta SRL" cu alt utilizator.
9. Cu userul Alfa, editează cookie-ul `adm_org` din DevTools punând id-ul lui Beta → **nu vezi date Beta**, iar în audit apare încercarea.
10. Cu tokenul userului Alfa, interoghează direct API-ul Supabase din consola browserului pe `organizations` → primești doar Alfa.
11. Invită același email în ambele organizații; comută din topbar fără re-login → meniul se schimbă după modulele fiecăreia.
12. Cu un membru `employee`: meniul Setări absent; acces direct pe `/setari/membri` → 404, nu pagină goală.
13. Cu `employee`, declanșează acțiunea de invitare (formular manipulat) → refuz `INTERZIS`, nu 500, plus rând `denied` în audit.
14. Schimbă o permisiune în `role_permissions` → efect doar cu reîncărcarea paginii, fără deploy.
15. Setează în `role_permissions` un rând cu `scope='none'` pentru o acțiune permisă → acțiunea devine refuzată (verifică C2).
16. Dezactivează modulul Concedii pentru Alfa → dispare din meniu, `/concedii` dă 404, iar acțiunea aferentă refuză.
17. Suspendă Alfa → utilizatorii ei nu mai au acces; Beta neafectată.
18. Șterge (logic) un membru → acces pierdut la reîncărcare, rândul rămâne cu `deleted_at`.
19. Deschide jurnalul de audit: fiecare pas apare cu actor, organizație, IP, oră România, și **NU conține tokenuri sau parole**.
20. Încearcă să ștergi/modifici un rând de audit → imposibil din UI și refuzat de DB.
21. Trimite „Cere demo" de trei ori la rând → ultimele două refuzate (rate limit); lead-ul vizibil în Super-Admin.
22. Greșește parola de 6 ori la login → lockout progresiv, mesaj identic pentru email inexistent și existent.
23. Pe telefon: login, comutator, meniu, un tabel gol cu empty state în română cu diacritice corecte (**ș/ț cu virgulă, nu cu sedilă**).
24. Rulează testul de izolare RLS; apoi adaugă intenționat o tabelă fără RLS și confirmă că testul devine roșu.
25. Confirmă că regenerarea tipurilor nu produce diff.
26. Deconectare, expirare de sesiune, acces pe un link profund → după login ajungi în pagina cerută, nu pe dashboard.

---

## 7. RISCURI ȘI ÎNTREBĂRI DESCHISE (ordonate după impact)

### Riscuri

**R1 — Scurgere între tenanți (catastrofic, probabilitate medie).** Un singur incident încheie produsul: notificare ANSPDCP în 72h, reziliere contractuală, reputație irecuperabilă. Suprafață: 60+ tabele × 4 politici + Storage + funcții definer + `service_role`. Mitigare: cele trei bariere mecanice din 1a, rulate pe FIECARE PR, nu pe main.

**R2 — Salarizare greșită (grav, probabilitate mare fără contabil).** Modulul nu e certificat și nu înlocuiește D112/Revisal, dar dacă produce cifre greșite pe care cineva le plătește, răspunderea practică se întoarce la furnizor. Mitigare: banner persistent, `settings_snapshot` imutabil, fișier de cazuri de test de la contabil ca precondiție de livrare a Fazei 9.

**R3 — Absența unui client pilot (grav, certitudine).** 8–12 luni fără contact cu realitatea garantează rescrieri în modulele HR, pontaj și exporturi. Mitigare: tenant zero intern din 1b + cele trei artefacte reale înainte de Faza 2 + demonstrații conduse de client.

**R4 — Estimarea acceptată de client vs realitate (grav).** Dacă clientul a bugetat „câteva luni" pentru 14–18, proiectul moare la jumătate. Mitigare: prezentarea estimării pe faze ÎNAINTE de a începe Faza 1a, cu alegerea explicită între mai puține module sau mai mult timp.

**R5 — Dezvoltare doar în cloud (mediu).** Fără bază efemeră: nu poți bisecta o migrare stricată, testele RLS resetează baza sub picioarele cuiva, latența maschează N+1. Mitigare: Postgres nativ local (nu Docker) + 4 proiecte separate + migrări forward-only + zero modificări din Studio, verificate prin `db diff` în CI.

**R6 — Documentele de design ca specificație (mediu, deja materializat).** Query-urile din documente referă coloane inexistente; dacă cineva le copiază, erorile se propagă în 5 module. Mitigare: documentele actuale sunt SCHIȚE; se regenerează după `0001_kernel.sql`; `plpgsql_check` + `EXPLAIN` pe politici, în CI.

**R7 — Acoperire legală incompletă la prima utilizare (mediu).** REVISAL, registre SSM, ISCIR, adeverințe — dacă lipsesc, HR ține un al doilea sistem și produsul își pierde rațiunea. Mitigare: sunt bugetate explicit în Fazele 2 și 7, nu la „finisaj".

**R8 — Deliverabilitate email (mic, dar vizibil).** DNS lăsat la final; SPF/DKIM/DMARC + warm-up = 3–5 zile plus rezolvarea spam-ului. Mitigare: bugetat în Faza 11; modul test funcțional din 1b.

### Întrebări deschise pentru client

1. **Estimarea de 14–18 luni este acceptabilă?** Dacă nu, care module se taie: mentenanță, diurne, portal angajat? (Salarizarea nu se poate tăia dacă pontajul rămâne — clientul va cere.)
2. **Cine este contabilul autorizat care validează valorile fiscale și livrează fișierul de cazuri de test?** Fără nume și disponibilitate confirmată, Faza 9 nu are criteriu de acceptare.
3. **Cine este juristul de dreptul muncii care validează termenele REVISAL, retențiile și codurile de încetare?** Idem pentru Fazele 2 și 7.
4. **Poate clientul furniza cele trei artefacte reale** (export Excel angajați, foaie colectivă semnată, un fluturaș) înainte de Faza 2? Sunt specificația, nu ilustrația.
5. **Cumulul de funcții la același angajator** (două CIM-uri pentru aceeași persoană) este un scenariu real la clienții-țintă? Răspunsul schimbă cheia de unicitate `employees`/`user_id` — decizie ireversibilă, se ia în 1a.
6. **Detașarea transnațională** apare la clienții-țintă (construcții, transport, montaj)? Dacă da, câmpurile intră acum, implementarea în Faza 10; dacă nu, se taie complet.
7. **Care este pragul de salariați al clienților tipici?** Determină dacă CSSM și cota de angajare persoane cu handicap sunt obligatorii din prima zi.
8. **Se acceptă blocarea calculului de salarii la concedii în așteptare** (implicit NU, cu avertisment) sau clientul preferă blocaj strict? Decizia are consecință legală în ambele direcții.
9. **Portalul angajatului este în scope-ul comercial al primei versiuni** sau se vinde separat? Faza 11 e 26–33 zile, jumătate din ea e portalul.
10. **Cine deține și rotește `HR_ENCRYPTION_KEYS`?** Fără un proces documentat de custodie și rotație, criptarea CNP e teatru — cheia va sta în variabila de mediu a unui singur furnizor de hosting.