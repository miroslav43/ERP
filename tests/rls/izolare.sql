-- ─────────────────────────────────────────────────────────────────────────────
-- TESTUL DE IZOLARE ÎNTRE TENANȚI
--
-- Cel mai important test din proiect. Un singur rând scurs între două firme
-- client încheie produsul: notificare ANSPDCP în 72 de ore, reziliere
-- contractuală, reputație irecuperabilă.
--
-- DE CE ÎN SQL PUR, ȘI NU DOAR PRIN SDK:
-- PostgREST execută fiecare cerere ca `set local role authenticated` plus
-- claim-urile JWT puse în GUC-uri. Reproducem exact acel context cu
-- `set local role` + `set_config('request.jwt.claim.sub', …)`, pe care
-- `auth.uid()` îl citește. Rezultatul este fidel, dar rulează pe orice Postgres,
-- fără GoTrue, fără Docker și fără proiect în cloud — deci poate rula la FIECARE
-- pull request, nu doar când cineva își amintește să configureze mediul.
--
-- Testele care chiar cer GoTrue (parole, magic link, invitații end-to-end)
-- rămân în `tests/rls/*.test.ts`, pe proiectul Supabase de test.
--
-- Rulare:
--   psql "$URL" -v ON_ERROR_STOP=1 -f tests/rls/izolare.sql
-- Ieșire diferită de zero = izolarea este ruptă.
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on
\timing off

begin;

-- ── Pregătire: două organizații complete, cu membri în fiecare ───────────────
-- Rulează ca proprietar (ocolește RLS), exact ca `service_role` la seed.

create temporary table t_ids (cheie text primary key, val uuid);

do $$
declare
  v_alfa uuid := gen_random_uuid();
  v_beta uuid := gen_random_uuid();
  v_admin_alfa uuid := gen_random_uuid();
  v_emp_alfa   uuid := gen_random_uuid();
  v_admin_beta uuid := gen_random_uuid();
  v_emp_beta   uuid := gen_random_uuid();
  -- Actori adăugați pentru verificarea (l): fixture-ul avea DOAR org_admin și
  -- employee, deci trei roluri din cinci nu erau niciodată dovedite capabile să
  -- scrie ceva. `mgr_alfa` exista ca FIȘĂ de angajat, dar `user_id`-ul ei era
  -- chiar al lui org_admin — un manager pe hârtie, nu un utilizator.
  v_mgr_alfa   uuid := gen_random_uuid();
  v_hr_alfa    uuid := gen_random_uuid();
  v_sufix      text;
begin
  -- Identificatorii se generează la fiecare rulare, nu sunt ficși.
  --
  -- Testul trebuie să meargă și pe o bază care conține deja date — altfel
  -- eșuează cu „duplicate key" și pare că izolarea e ruptă, când de fapt doar
  -- cineva a lăsat un rând în urmă. Un test care cere condiții de laborator ca
  -- să dea verde nu spune nimic despre producție.
  -- Cifra de start fixează diferența: „1…” pentru Alfa, „2…” pentru Beta.
  -- Prima variantă folosea `'9' || substr(sufix, 2)` pentru Beta, ceea ce
  -- producea ACELAȘI CUI ori de câte ori numărul aleator începea cu 9 — un
  -- eșec intermitent, adică exact felul de bug care se pune pe seama „bazei”.
  v_sufix := to_char(floor(random() * 9000000 + 1000000), 'FM9999999');

  insert into t_ids values
    ('alfa', v_alfa), ('beta', v_beta),
    ('admin_alfa', v_admin_alfa), ('emp_alfa', v_emp_alfa),
    ('admin_beta', v_admin_beta), ('emp_beta', v_emp_beta),
    ('mgr_user_alfa', v_mgr_alfa), ('hr_user_alfa', v_hr_alfa),
    ('mgr2_alfa', gen_random_uuid()), ('hr_ang_alfa', gen_random_uuid()),
    ('sub_alfa', gen_random_uuid());

  insert into auth.users (id, email) values
    (v_admin_alfa, 'admin-' || v_sufix || '@alfa.test'), (v_emp_alfa, 'angajat-' || v_sufix || '@alfa.test'),
    (v_admin_beta, 'admin-' || v_sufix || '@beta.test'), (v_emp_beta, 'angajat-' || v_sufix || '@beta.test'),
    (v_mgr_alfa, 'manager-' || v_sufix || '@alfa.test'), (v_hr_alfa, 'hr-' || v_sufix || '@alfa.test');

  insert into public.profiles (id, email, full_name) values
    (v_admin_alfa, 'admin-' || v_sufix || '@alfa.test',   'Administrator Alfa'),
    (v_emp_alfa,   'angajat-' || v_sufix || '@alfa.test', 'Angajat Alfa'),
    (v_admin_beta, 'admin-' || v_sufix || '@beta.test',   'Administrator Beta'),
    (v_emp_beta,   'angajat-' || v_sufix || '@beta.test', 'Angajat Beta'),
    (v_mgr_alfa,   'manager-' || v_sufix || '@alfa.test', 'Manager Alfa'),
    (v_hr_alfa,    'hr-' || v_sufix || '@alfa.test',      'Resurse Umane Alfa')
  on conflict (id) do nothing;

  insert into public.organizations (id, slug, name, legal_name, cui, judet, oras, status)
  values
    (v_alfa, 'alfa-' || v_sufix, 'Alfa SRL', 'ALFA SRL', '1' || v_sufix, 'Cluj', 'Cluj-Napoca', 'active'),
    (v_beta, 'beta-' || v_sufix, 'Beta SRL', 'BETA SRL', '2' || v_sufix, 'Timiș', 'Timișoara', 'active');

  insert into public.organization_members (organization_id, user_id, role, status, joined_at) values
    (v_alfa, v_admin_alfa, 'org_admin', 'active', now()),
    (v_alfa, v_emp_alfa,   'employee',  'active', now()),
    (v_beta, v_admin_beta, 'org_admin', 'active', now()),
    (v_beta, v_emp_beta,   'employee',  'active', now()),
    (v_alfa, v_mgr_alfa,   'manager',   'active', now()),
    (v_alfa, v_hr_alfa,    'hr',        'active', now());

  -- Alfa are „leave" activ, Beta nu: verificăm și feature flag-ul, nu doar tenantul.
  -- Alfa are toate modulele necesare verificării (l) activate — altfel scrierile
  -- reale ar fi refuzate de app.feature_on(), nu de lipsa dreptului.
  -- „nucleu" este is_core (mereu activ prin features.is_core — vezi (i)), dar NU
  -- primește implicit un rând în organization_features: îl adăugăm explicit.
  insert into public.organization_features (organization_id, feature_key, enabled)
  values (v_alfa, 'nucleu', true),
         (v_alfa, 'leave', true), (v_beta, 'leave', false),
         (v_alfa, 'inventory', true), (v_alfa, 'fleet', true),
         (v_alfa, 'attendance', true), (v_alfa, 'ssm', true), (v_alfa, 'maintenance', true),
         (v_alfa, 'onboarding', true), (v_alfa, 'per_diem', true),
         -- Fără modulele astea, `app.feature_on()` refuză scrierile de mai jos
         -- ÎNAINTE de orice verificare de permisiune — iar rezultatul ar arăta
         -- ca un defect de politică, deși e doar un modul stins în fixture.
         (v_alfa, 'announcements', true), (v_alfa, 'payroll', true),
         (v_alfa, 'employee_portal', true), (v_alfa, 'ticketing', true),
         (v_beta, 'ticketing', true);

  insert into public.organization_branding (organization_id, denumire_afisata)
  values (v_alfa, 'Alfa'), (v_beta, 'Beta');

  -- Cel puțin un rând PENTRU FIECARE organizație în fiecare tabelă verificată.
  -- Fără asta, testul ar trece fals-pozitiv pe tabelele goale.
  insert into public.audit_logs (organization_id, actor_id, action, status)
  values (v_alfa, v_admin_alfa, 'create', 'success'),
         (v_beta, v_admin_beta, 'create', 'success');

  insert into public.notifications (organization_id, user_id, kind, title)
  values (v_alfa, v_emp_alfa, 'info', 'Notificare Alfa'),
         (v_beta, v_emp_beta, 'info', 'Notificare Beta');

  insert into public.invitations (organization_id, email, role, token_hash, expires_at, invited_by)
  values (v_alfa, 'nou-' || v_sufix || '@alfa.test', 'employee', encode(sha256('alfa'::bytea), 'hex'), now() + interval '7 days', v_admin_alfa),
         (v_beta, 'nou-' || v_sufix || '@beta.test', 'employee', encode(sha256('beta'::bytea), 'hex'), now() + interval '7 days', v_admin_beta);

  -- ── Acoperire completă: fiecare tabelă cu organization_id primește rânduri
  -- pentru AMBELE organizații ──────────────────────────────────────────────
  --
  -- Fără rânduri pentru Beta, verificarea (c) nu demonstrează nimic pe acea
  -- tabelă: trece indiferent de politici. 21 de tabele erau în situația asta,
  -- printre ele `employees` și `employee_sensitive_data` — exact cele care
  -- contează. Testul raporta „6 tabele verificate ✓" și părea verde.

  -- Nucleu
  insert into public.document_sequences (organization_id, document_type, year)
  values (v_alfa, 'adeverinta', 2026), (v_beta, 'adeverinta', 2026);

  insert into public.email_log (organization_id, destinatar, subiect, template)
  values (v_alfa, 'a-' || v_sufix || '@alfa.test', 'Test Alfa', 'invitatie'),
         (v_beta, 'b-' || v_sufix || '@beta.test', 'Test Beta', 'invitatie');

  insert into public.notification_preferences (organization_id, user_id, kind)
  values (v_alfa, v_emp_alfa, 'info'), (v_beta, v_emp_beta, 'info');

  insert into public.retention_policies (organization_id, entity_type, retention_months)
  values (v_alfa, 'audit_logs', 36), (v_beta, 'audit_logs', 36);

  -- Onboarding companie (0030): criptotext fictiv, ca la employee_sensitive_data mai jos.
  insert into public.organization_sensitive_data (organization_id, cnp_last4)
  values (v_alfa, '1111'), (v_beta, '2222');

  insert into public.organization_bank_accounts (organization_id, banca, iban)
  values (v_alfa, 'Banca Alfa', 'RO49AAAA' || v_sufix),
         (v_beta, 'Banca Beta', 'RO50BBBB' || v_sufix);

  insert into public.puncte_lucru (organization_id, denumire)
  values (v_alfa, 'Sediu Alfa'), (v_beta, 'Sediu Beta');

  -- Înrolare unificată angajat (0033): contorul de marcă, 1:1 pe organizație.
  insert into public.employee_marca_counters (organization_id, next_marca)
  values (v_alfa, 1), (v_beta, 1);

  -- Suprascrieri de permisiuni per organizație (rândurile globale au org NULL).
  insert into public.role_permissions (organization_id, role, resource, action, scope)
  values (v_alfa, 'manager', 'payroll', 'read', 'team'),
         (v_beta, 'manager', 'payroll', 'read', 'none');

  -- HR
  insert into t_ids
  select 'dep_' || e, gen_random_uuid() from unnest(array['alfa','beta']) e union all
  select 'poz_' || e, gen_random_uuid() from unnest(array['alfa','beta']) e union all
  select 'mgr_' || e, gen_random_uuid() from unnest(array['alfa','beta']) e union all
  select 'ang_' || e, gen_random_uuid() from unnest(array['alfa','beta']) e union all
  select 'tipdoc_' || e, gen_random_uuid() from unnest(array['alfa','beta']) e union all
  select 'sct_' || e, gen_random_uuid() from unnest(array['alfa','beta']) e union all
  select 'tichet_' || e, gen_random_uuid() from unnest(array['alfa','beta']) e;

  insert into public.departments (id, organization_id, cod, denumire)
  values ((select val from t_ids where cheie='dep_alfa'), v_alfa, 'ADM', 'Administrativ'),
         ((select val from t_ids where cheie='dep_beta'), v_beta, 'ADM', 'Administrativ');

  insert into public.job_positions (id, organization_id, cod, denumire)
  values ((select val from t_ids where cheie='poz_alfa'), v_alfa, 'REF', 'Referent'),
         ((select val from t_ids where cheie='poz_beta'), v_beta, 'REF', 'Referent');

  -- Manager direct, ÎNAINTE de angajatul care îl va referi: fără o fișă de
  -- angajat legată de contul de admin, pasul „manager_direct” din fluxul de
  -- aprobare a concediilor (0009 §12, reparat în 0017) are mulțime vidă pentru
  -- Ana/Bogdan și cererea escaladează direct la org_admin — ceea ce ar ascunde
  -- exact regresia pe care 0017 a reparat-o, în loc s-o exercite.
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                department_id, job_position_id, hired_on, status, user_id)
  values ((select val from t_ids where cheie='mgr_alfa'), v_alfa, '000', 'Maria', 'Manager',
          (select val from t_ids where cheie='dep_alfa'), (select val from t_ids where cheie='poz_alfa'),
          current_date - 500, 'activ', v_admin_alfa),
         ((select val from t_ids where cheie='mgr_beta'), v_beta, '000', 'Mihai', 'Manager',
          (select val from t_ids where cheie='dep_beta'), (select val from t_ids where cheie='poz_beta'),
          current_date - 500, 'activ', v_admin_beta);

  -- `user_id` leagă fișa de angajat de contul de autentificare: fără el,
  -- app.current_employee_id() nu găsește nimic, iar orice verificare pe scope
  -- 'own' (concediu propriu, în (l)) eșuează fără să demonstreze nimic real.
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                department_id, job_position_id, manager_employee_id, hired_on, status, user_id)
  values ((select val from t_ids where cheie='ang_alfa'), v_alfa, '001', 'Ana', 'Popescu',
          (select val from t_ids where cheie='dep_alfa'), (select val from t_ids where cheie='poz_alfa'),
          (select val from t_ids where cheie='mgr_alfa'),
          current_date - 400, 'activ', v_emp_alfa),
         ((select val from t_ids where cheie='ang_beta'), v_beta, '001', 'Bogdan', 'Ionescu',
          (select val from t_ids where cheie='dep_beta'), (select val from t_ids where cheie='poz_beta'),
          (select val from t_ids where cheie='mgr_beta'),
          current_date - 300, 'activ', v_emp_beta);

  -- Fișele actorilor `manager` și `hr`, plus un subordonat al managerului.
  --
  -- Managerul PRIMEȘTE un subordonat propriu în loc să preia fișa `mgr_alfa`:
  -- aceea e legată de `v_admin_alfa` și e folosită deja de verificările (c)-(k)
  -- ca „managerul direct al Anei". Mutarea ei ar schimba tăcut premisele
  -- testelor existente. Un al doilea lanț manager→subordonat e aditiv.
  --
  -- `manager_path` NU se trimite: îl calculează triggerul BEFORE. Exact aici a
  -- fost defectul din Faza 2 — politica cerea `manager_path = '{}'` cu un
  -- comentariu care spunea „calculat de trigger", dar WITH CHECK vede valoarea
  -- DEJA scrisă de trigger (capcana 6).
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                department_id, job_position_id, hired_on, status, user_id)
  values ((select val from t_ids where cheie='mgr2_alfa'), v_alfa, '010', 'Mircea', 'Șef',
          (select val from t_ids where cheie='dep_alfa'), (select val from t_ids where cheie='poz_alfa'),
          current_date - 600, 'activ', v_mgr_alfa),
         ((select val from t_ids where cheie='hr_ang_alfa'), v_alfa, '011', 'Hortensia', 'Resurse',
          (select val from t_ids where cheie='dep_alfa'), (select val from t_ids where cheie='poz_alfa'),
          current_date - 550, 'activ', v_hr_alfa);

  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                department_id, job_position_id, manager_employee_id, hired_on, status)
  values ((select val from t_ids where cheie='sub_alfa'), v_alfa, '012', 'Sorin', 'Subordonat',
          (select val from t_ids where cheie='dep_alfa'), (select val from t_ids where cheie='poz_alfa'),
          (select val from t_ids where cheie='mgr2_alfa'),
          current_date - 200, 'activ');

  insert into public.employment_contracts (organization_id, employee_id, numar, data_contract, valabil_de_la, salariu_baza)
  values (v_alfa, (select val from t_ids where cheie='ang_alfa'), 'CIM-1', current_date - 400, current_date - 400, 5000.00),
         (v_beta, (select val from t_ids where cheie='ang_beta'), 'CIM-1', current_date - 300, current_date - 300, 6000.00);

  -- Criptotext fictiv: aici se verifică IZOLAREA, nu criptografia.
  insert into public.employee_sensitive_data (employee_id, organization_id, cnp_last4, cnp_hash)
  values ((select val from t_ids where cheie='ang_alfa'), v_alfa, '1234', 'amprenta-alfa-' || v_sufix),
         ((select val from t_ids where cheie='ang_beta'), v_beta, '5678', 'amprenta-beta-' || v_sufix);

  insert into public.employee_document_types (id, organization_id, cod, denumire)
  values ((select val from t_ids where cheie='tipdoc_alfa'), v_alfa, 'ci-org', 'Carte de identitate'),
         ((select val from t_ids where cheie='tipdoc_beta'), v_beta, 'ci-org', 'Carte de identitate');

  insert into public.employee_documents (organization_id, employee_id, document_type_id, titlu, fisier_path, fisier_nume)
  values (v_alfa, (select val from t_ids where cheie='ang_alfa'), (select val from t_ids where cheie='tipdoc_alfa'),
          'CI Ana', v_alfa || '/employee/x/a.pdf', 'a.pdf'),
         (v_beta, (select val from t_ids where cheie='ang_beta'), (select val from t_ids where cheie='tipdoc_beta'),
          'CI Bogdan', v_beta || '/employee/y/b.pdf', 'b.pdf');

  -- CHECK-ul cere ținta: fișa postului se atașează unui angajat SAU unei funcții.
  insert into public.job_descriptions (organization_id, job_position_id, titlu, valabil_de_la)
  values (v_alfa, (select val from t_ids where cheie='poz_alfa'), 'Fișa postului — Referent', current_date - 400),
         (v_beta, (select val from t_ids where cheie='poz_beta'), 'Fișa postului — Referent', current_date - 300);

  insert into public.employee_tax_exemptions (organization_id, employee_id, exemption_type, valabil_de_la)
  values (v_alfa, (select val from t_ids where cheie='ang_alfa'), 'it', current_date - 200),
         (v_beta, (select val from t_ids where cheie='ang_beta'), 'constructii', current_date - 200);

  insert into public.work_permits (organization_id, employee_id, tip_permis, numar, valabil_de_la, valabil_pana, cetatenie)
  values (v_alfa, (select val from t_ids where cheie='ang_alfa'), 'aviz', 'A-' || v_sufix, current_date - 100, current_date + 265, 'MD'),
         (v_beta, (select val from t_ids where cheie='ang_beta'), 'aviz', 'B-' || v_sufix, current_date - 100, current_date + 265, 'UA');

  insert into public.salary_component_types (id, organization_id, cod, denumire, kind)
  values ((select val from t_ids where cheie='sct_alfa'), v_alfa, 'spor_vechime_org', 'Spor de vechime', 'spor_procent'),
         ((select val from t_ids where cheie='sct_beta'), v_beta, 'spor_vechime_org', 'Spor de vechime', 'spor_procent');

  -- CHECK-ul cere exclusivitate: spor_procent are `procent`, restul au `suma`.
  insert into public.salary_components (organization_id, employee_id, component_type_id, kind, procent, valabil_de_la)
  values (v_alfa, (select val from t_ids where cheie='ang_alfa'), (select val from t_ids where cheie='sct_alfa'), 'spor_procent', 15.00, current_date - 100),
         (v_beta, (select val from t_ids where cheie='ang_beta'), (select val from t_ids where cheie='sct_beta'), 'spor_procent', 10.00, current_date - 100);

  insert into public.hr_document_templates (organization_id, cod, denumire, continut_html)
  values (v_alfa, 'adeverinta_venit_org', 'Adeverință de venit', '<p>Alfa</p>'),
         (v_beta, 'adeverinta_venit_org', 'Adeverință de venit', '<p>Beta</p>');

  insert into public.hr_issued_documents (organization_id, employee_id, serie, numar, numar_afisat, titlu, continut_checksum)
  values (v_alfa, (select val from t_ids where cheie='ang_alfa'), 'ADV', 1, 'ADV-1', 'Adeverință de venit', 'suma-alfa'),
         (v_beta, (select val from t_ids where cheie='ang_beta'), 'ADV', 1, 'ADV-1', 'Adeverință de venit', 'suma-beta');

  insert into public.revisal_config (organization_id, event_type, termen_zile, valabil_de_la)
  values (v_alfa, 'angajare', -1, current_date - 500),
         (v_beta, 'angajare', -1, current_date - 500);

  insert into public.revisal_events (organization_id, employee_id, event_type, data_evenimentului, termen_transmitere)
  values (v_alfa, (select val from t_ids where cheie='ang_alfa'), 'angajare', current_date - 400, current_date - 401),
         (v_beta, (select val from t_ids where cheie='ang_beta'), 'angajare', current_date - 300, current_date - 301);

  -- Conformitate (Faza 4). `entity_type` acoperă deliberat două regimuri
  -- diferite: un document de vehicul (drept de conformitate) și unul de angajat
  -- (drept asupra fișei), ca verificarea de vizibilitate să fie chiar exercitată.
  insert into t_ids
  select 'exp_' || e, gen_random_uuid() from unnest(array['alfa','beta']) e union all
  select 'expmed_' || e, gen_random_uuid() from unnest(array['alfa','beta']) e;

  insert into public.expirables (id, organization_id, entity_type, entity_id, kind, label, expires_at, source_table, responsible_employee_id)
  values ((select val from t_ids where cheie='exp_alfa'), v_alfa, 'vehicle_document',
          gen_random_uuid(), 'rca', 'RCA — B 01 ALF', current_date + 20, 'vehicle_documents',
          (select val from t_ids where cheie='ang_alfa')),
         ((select val from t_ids where cheie='exp_beta'), v_beta, 'vehicle_document',
          gen_random_uuid(), 'rca', 'RCA — TM 01 BET', current_date + 20, 'vehicle_documents',
          (select val from t_ids where cheie='ang_beta')),
         ((select val from t_ids where cheie='expmed_alfa'), v_alfa, 'employee_document',
          (select val from t_ids where cheie='ang_alfa'), 'fisa_aptitudine',
          'Fișă de aptitudine — marca 001', current_date + 10, 'employee_documents',
          (select val from t_ids where cheie='ang_alfa')),
         ((select val from t_ids where cheie='expmed_beta'), v_beta, 'employee_document',
          (select val from t_ids where cheie='ang_beta'), 'fisa_aptitudine',
          'Fișă de aptitudine — marca 001', current_date + 10, 'employee_documents',
          (select val from t_ids where cheie='ang_beta'));

  insert into public.alert_rules (organization_id, entity_type, kind)
  values (v_alfa, 'vehicle_document', 'rca'), (v_beta, 'vehicle_document', 'rca');

  insert into public.compliance_alerts (organization_id, expirable_id, prag_zile, due_date)
  values (v_alfa, (select val from t_ids where cheie='exp_alfa'), 30, current_date - 10),
         (v_beta, (select val from t_ids where cheie='exp_beta'), 30, current_date - 10);

  insert into public.alert_notifications (organization_id, alert_id, canal)
  select o.org, a.id, 'in_app'
  from (values (v_alfa), (v_beta)) o(org)
  join public.compliance_alerts a on a.organization_id = o.org;

  -- ── Faza 3a/5/8 (migrările 0009/0010/0012): concedii, inventar, flotă ──────
  -- Același principiu: rând pentru FIECARE organizație pe fiecare tabelă nouă
  -- cu organization_id. `leave_types`, `approval_flows` și `approval_steps` NU
  -- se ating aici — se seedează SINGURE la crearea organizației, mai sus
  -- (trg_organizations_seed_leave, 0009 §12). `medical_leave_codes` și
  -- `public_holidays` sunt naționale, fără organization_id, deci ies din
  -- bucla verificării (c) automat — nu au nevoie de fixture.

  insert into public.organization_holidays (organization_id, data, denumire, tip, created_by)
  values (v_alfa, current_date + 200, 'Zi liberă test Alfa ' || v_sufix, 'liber_suplimentar', v_admin_alfa),
         (v_beta, current_date + 200, 'Zi liberă test Beta ' || v_sufix, 'liber_suplimentar', v_admin_beta);

  -- `tip_criteriu` + discriminantul lui sunt obligatorii din 0035_reguli_concediu:
  -- `categorie` a devenit etichetă liberă, iar `ler_criteriu_ck` cere ca pentru
  -- 'vechime' să fie populat exact `vechime_ani_min`, restul null.
  insert into public.leave_entitlement_rules
    (organization_id, leave_type_id, tip_criteriu, vechime_ani_min, categorie, denumire, zile_suplimentare, temei_legal)
  select v_alfa, lt.id, 'vechime'::public.leave_rule_criterion, 5, 'vechime_test', 'Spor CO vechime (test)', 3, 'Regulament intern (DE VERIFICAT)'
    from public.leave_types lt where lt.organization_id = v_alfa and lt.key = 'odihna' and lt.deleted_at is null
  union all
  select v_beta, lt.id, 'vechime'::public.leave_rule_criterion, 5, 'vechime_test', 'Spor CO vechime (test)', 3, 'Regulament intern (DE VERIFICAT)'
    from public.leave_types lt where lt.organization_id = v_beta and lt.key = 'odihna' and lt.deleted_at is null;

  -- O cerere „trimisă" pornește motorul întreg: triggerul de sincronizare
  -- generează leave_request_days, actualizează leave_balances, scrie
  -- leave_accruals ('drept_initial') și, din fluxul seedat automat, creează
  -- approval_tasks. Un singur INSERT populează astfel CINCI tabele deodată,
  -- pentru fiecare organizație — prin motorul real, nu prin date inventate.
  insert into public.leave_requests
    (organization_id, employee_id, leave_type_id, data_inceput, data_sfarsit, motiv, status, created_by)
  select v_alfa, (select val from t_ids where cheie='ang_alfa'), lt.id,
         current_date + 40, current_date + 41, 'Fixture — verificare izolare ' || v_sufix, 'trimisa'::public.leave_request_status, v_admin_alfa
    from public.leave_types lt where lt.organization_id = v_alfa and lt.key = 'odihna' and lt.deleted_at is null
  union all
  select v_beta, (select val from t_ids where cheie='ang_beta'), lt.id,
         current_date + 40, current_date + 41, 'Fixture — verificare izolare ' || v_sufix, 'trimisa'::public.leave_request_status, v_admin_beta
    from public.leave_types lt where lt.organization_id = v_beta and lt.key = 'odihna' and lt.deleted_at is null;

  -- INVENTAR (0010)
  insert into t_ids
  select 'invcat_' || e, gen_random_uuid() from unnest(array['alfa','beta']) e union all
  select 'invitem_' || e, gen_random_uuid() from unnest(array['alfa','beta']) e union all
  select 'invbatch_' || e, gen_random_uuid() from unnest(array['alfa','beta']) e;

  insert into public.inventory_categories (id, organization_id, cod, denumire, created_by, updated_by)
  values ((select val from t_ids where cheie='invcat_alfa'), v_alfa, 'test_categ', 'Categorie de test Alfa', v_admin_alfa, v_admin_alfa),
         ((select val from t_ids where cheie='invcat_beta'), v_beta, 'test_categ', 'Categorie de test Beta', v_admin_beta, v_admin_beta);

  insert into public.inventory_import_batches (id, organization_id, fisier_nume, status, importat_de, created_by, updated_by)
  values ((select val from t_ids where cheie='invbatch_alfa'), v_alfa, 'import-alfa-' || v_sufix || '.csv', 'finalizat', v_admin_alfa, v_admin_alfa, v_admin_alfa),
         ((select val from t_ids where cheie='invbatch_beta'), v_beta, 'import-beta-' || v_sufix || '.csv', 'finalizat', v_admin_beta, v_admin_beta, v_admin_beta);

  insert into public.inventory_items (id, organization_id, category_id, denumire, numar_inventar, data_achizitie, valoare, created_by, updated_by)
  values ((select val from t_ids where cheie='invitem_alfa'), v_alfa, (select val from t_ids where cheie='invcat_alfa'),
          'Laptop de test Alfa', 'INV-' || v_sufix || '-A', current_date - 10, 3500.00, v_admin_alfa, v_admin_alfa),
         ((select val from t_ids where cheie='invitem_beta'), v_beta, (select val from t_ids where cheie='invcat_beta'),
          'Laptop de test Beta', 'INV-' || v_sufix || '-B', current_date - 10, 3500.00, v_admin_beta, v_admin_beta);

  -- Predare-primire reală: pune obiectul „alocat" prin triggerul care întreține
  -- inventory_items.status din inventory_allocations, nu printr-o scriere directă.
  insert into public.inventory_allocations (organization_id, item_id, employee_id, predat_la, stare_la_predare, created_by, updated_by)
  values (v_alfa, (select val from t_ids where cheie='invitem_alfa'), (select val from t_ids where cheie='ang_alfa'),
          now() - interval '5 days', 'bun', v_admin_alfa, v_admin_alfa),
         (v_beta, (select val from t_ids where cheie='invitem_beta'), (select val from t_ids where cheie='ang_beta'),
          now() - interval '5 days', 'bun', v_admin_beta, v_admin_beta);

  -- FLOTĂ (0012)
  insert into t_ids
  select 'vdt_' || e, gen_random_uuid() from unnest(array['alfa','beta']) e union all
  select 'veh_' || e, gen_random_uuid() from unnest(array['alfa','beta']) e union all
  select 'vdoc_' || e, gen_random_uuid() from unnest(array['alfa','beta']) e union all
  select 'trip_' || e, gen_random_uuid() from unnest(array['alfa','beta']) e;

  insert into public.vehicle_document_types (id, organization_id, cod, denumire, created_by, updated_by)
  values ((select val from t_ids where cheie='vdt_alfa'), v_alfa, 'inspectie_locala', 'Inspecție locală (test)', v_admin_alfa, v_admin_alfa),
         ((select val from t_ids where cheie='vdt_beta'), v_beta, 'inspectie_locala', 'Inspecție locală (test)', v_admin_beta, v_admin_beta);

  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, employee_id, department_id, km_curent, created_by, updated_by)
  values ((select val from t_ids where cheie='veh_alfa'), v_alfa, 'CJ' || v_sufix || 'AA', 'Dacia', 'Logan',
          (select val from t_ids where cheie='ang_alfa'), (select val from t_ids where cheie='dep_alfa'), 1000, v_admin_alfa, v_admin_alfa),
         ((select val from t_ids where cheie='veh_beta'), v_beta, 'TM' || v_sufix || 'BB', 'Dacia', 'Logan',
          (select val from t_ids where cheie='ang_beta'), (select val from t_ids where cheie='dep_beta'), 1000, v_admin_beta, v_admin_beta);

  insert into public.vehicle_documents (id, organization_id, vehicle_id, document_type_id, numar, valabil_de_la, expira_la, created_by, updated_by)
  select (select val from t_ids where cheie='vdoc_alfa'), v_alfa, (select val from t_ids where cheie='veh_alfa'),
         vdt.id, 'RCA-' || v_sufix || '-A', current_date - 30, current_date + 300, v_admin_alfa, v_admin_alfa
    from public.vehicle_document_types vdt where vdt.cod = 'rca' and vdt.organization_id is null
  union all
  select (select val from t_ids where cheie='vdoc_beta'), v_beta, (select val from t_ids where cheie='veh_beta'),
         vdt.id, 'RCA-' || v_sufix || '-B', current_date - 30, current_date + 300, v_admin_beta, v_admin_beta
    from public.vehicle_document_types vdt where vdt.cod = 'rca' and vdt.organization_id is null;

  -- Foaie de parcurs cu un salt de kilometraj peste pragul implicit (1500 km):
  -- populează odometer_anomalies prin motorul real (trigger), nu printr-un
  -- INSERT direct — politica de INSERT a tabelei cere app.is_service_context(),
  -- iar declanșarea prin trigger dovedește că motorul chiar funcționează.
  insert into public.trip_sheets (id, organization_id, vehicle_id, employee_id, plecare_la, sosire_la, km_plecare, km_sosire, scop, created_by, updated_by)
  values ((select val from t_ids where cheie='trip_alfa'), v_alfa, (select val from t_ids where cheie='veh_alfa'),
          (select val from t_ids where cheie='ang_alfa'), now() - interval '2 hours', now() - interval '1 hour',
          3000, 3050, 'Deplasare de test Alfa', v_admin_alfa, v_admin_alfa),
         ((select val from t_ids where cheie='trip_beta'), v_beta, (select val from t_ids where cheie='veh_beta'),
          (select val from t_ids where cheie='ang_beta'), now() - interval '2 hours', now() - interval '1 hour',
          3000, 3050, 'Deplasare de test Beta', v_admin_beta, v_admin_beta);

  insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, alimentat_la, statie, created_by, updated_by)
  values (v_alfa, (select val from t_ids where cheie='trip_alfa'), 40.50, 320.00, now() - interval '90 minutes', 'Stație de test Alfa', v_admin_alfa, v_admin_alfa),
         (v_beta, (select val from t_ids where cheie='trip_beta'), 40.50, 320.00, now() - interval '90 minutes', 'Stație de test Beta', v_admin_beta, v_admin_beta);

  -- ── Faza 7 (migrarea 0011): SSM, PSI, medicina muncii, ISCIR, mentenanță ────
  -- `ssm_legal_parameters`, `ssm_training_types` și `ssm_training_type_periods`
  -- se seedează SINGURE la crearea organizației (trg organizations_ssm_seed,
  -- 0011 §10) — nu se ating aici, la fel ca `leave_types` mai sus.
  insert into t_ids
  select 'equip_' || e, gen_random_uuid() from unnest(array['alfa','beta']) e union all
  select 'mplan_' || e, gen_random_uuid() from unnest(array['alfa','beta']) e union all
  select 'ra_' || e, gen_random_uuid() from unnest(array['alfa','beta']) e union all
  select 'fext_' || e, gen_random_uuid() from unnest(array['alfa','beta']) e;

  -- Tipul 'la_locul_de_munca' NU are periodicitate (luni = null în seed), deci
  -- `ssm_training_calc` nu calculează `urmatoarea_scadenta` și triggerul de
  -- sincronizare (ssm_training_sync) nu ajunge să scrie în `expirables`. Tipul
  -- 'periodic' ARE periodicitate și declanșează un defect real — vezi verificarea
  -- (l), unde e exercitat deliberat ca `authenticated`.
  insert into public.ssm_trainings (organization_id, employee_id, training_type_id, data_instruirii, durata_ore, semnatura_confirmata)
  select v_alfa, (select val from t_ids where cheie='ang_alfa'), tt.id, current_date - 100, 2.0, true
    from public.ssm_training_types tt where tt.organization_id = v_alfa and tt.cod = 'la_locul_de_munca' and tt.deleted_at is null
  union all
  select v_beta, (select val from t_ids where cheie='ang_beta'), tt.id, current_date - 100, 2.0, true
    from public.ssm_training_types tt where tt.organization_id = v_beta and tt.cod = 'la_locul_de_munca' and tt.deleted_at is null;

  insert into public.risk_assessments (id, organization_id, cod, denumire, department_id, data_evaluarii)
  values ((select val from t_ids where cheie='ra_alfa'), v_alfa, 'RA-' || v_sufix, 'Evaluare de risc — test',
          (select val from t_ids where cheie='dep_alfa'), current_date - 200),
         ((select val from t_ids where cheie='ra_beta'), v_beta, 'RA-' || v_sufix, 'Evaluare de risc — test',
          (select val from t_ids where cheie='dep_beta'), current_date - 200);

  insert into public.risk_assessment_items (organization_id, assessment_id, factor_risc, pericol, probabilitate, gravitate, responsabil_employee_id)
  values (v_alfa, (select val from t_ids where cheie='ra_alfa'), 'Cădere de la același nivel', 'Pardoseală alunecoasă', 3, 2,
          (select val from t_ids where cheie='ang_alfa')),
         (v_beta, (select val from t_ids where cheie='ra_beta'), 'Cădere de la același nivel', 'Pardoseală alunecoasă', 3, 2,
          (select val from t_ids where cheie='ang_beta'));

  insert into public.prevention_plan_measures (organization_id, assessment_id, masura, termen, responsabil_employee_id)
  values (v_alfa, (select val from t_ids where cheie='ra_alfa'), 'Montare bandă antiderapantă', current_date + 60,
          (select val from t_ids where cheie='ang_alfa')),
         (v_beta, (select val from t_ids where cheie='ra_beta'), 'Montare bandă antiderapantă', current_date + 60,
          (select val from t_ids where cheie='ang_beta'));

  insert into public.work_accidents (organization_id, numar_intern, employee_id, data_producerii, locul, imprejurari, tip)
  values (v_alfa, 'WA-' || v_sufix || '-A', (select val from t_ids where cheie='ang_alfa'), current_date - 50,
          'Depozit', 'Alunecare pe pardoseală umedă.', 'usor'),
         (v_beta, 'WA-' || v_sufix || '-B', (select val from t_ids where cheie='ang_beta'), current_date - 50,
          'Depozit', 'Alunecare pe pardoseală umedă.', 'usor');

  insert into public.dangerous_incidents (organization_id, data_producerii, locul, descriere, employee_id)
  values (v_alfa, current_date - 40, 'Hală producție', 'Scurtcircuit fără victime.', (select val from t_ids where cheie='ang_alfa')),
         (v_beta, current_date - 40, 'Hală producție', 'Scurtcircuit fără victime.', (select val from t_ids where cheie='ang_beta'));

  insert into public.occupational_diseases (organization_id, employee_id, numar_fisa_bp, data_semnalarii, noxa_profesionala)
  values (v_alfa, (select val from t_ids where cheie='ang_alfa'), 'BP-' || v_sufix || '-A', current_date - 30, 'zgomot'),
         (v_beta, (select val from t_ids where cheie='ang_beta'), 'BP-' || v_sufix || '-B', current_date - 30, 'zgomot');

  insert into public.safety_committee_meetings (organization_id, data, ordine_de_zi, presedinte_employee_id)
  values (v_alfa, current_date - 20, 'Ședință CSSM de test', (select val from t_ids where cheie='mgr_alfa')),
         (v_beta, current_date - 20, 'Ședință CSSM de test', (select val from t_ids where cheie='mgr_beta'));

  insert into public.ppe_issuances (organization_id, employee_id, articol, data_predarii)
  values (v_alfa, (select val from t_ids where cheie='ang_alfa'), 'Cizme de protecție', current_date - 60),
         (v_beta, (select val from t_ids where cheie='ang_beta'), 'Cizme de protecție', current_date - 60);

  insert into public.fire_extinguishers (id, organization_id, cod, tip, locatie)
  values ((select val from t_ids where cheie='fext_alfa'), v_alfa, 'ST-' || v_sufix || '-A', 'pulbere', 'Hol parter'),
         ((select val from t_ids where cheie='fext_beta'), v_beta, 'ST-' || v_sufix || '-B', 'pulbere', 'Hol parter');

  insert into public.fire_extinguisher_checks (organization_id, extinguisher_id, tip_verificare, data)
  values (v_alfa, (select val from t_ids where cheie='fext_alfa'), 'verificare', current_date - 10),
         (v_beta, (select val from t_ids where cheie='fext_beta'), 'verificare', current_date - 10);

  insert into public.evacuation_drills (organization_id, data, scenariu, responsabil_employee_id)
  values (v_alfa, current_date - 15, 'Incendiu la parter', (select val from t_ids where cheie='mgr_alfa')),
         (v_beta, current_date - 15, 'Incendiu la parter', (select val from t_ids where cheie='mgr_beta'));

  insert into public.hot_work_permits (organization_id, numar, locul, lucrare, valabil_de_la, valabil_pana, masuri)
  values (v_alfa, 'HWP-' || v_sufix || '-A', 'Atelier', 'Sudură', now() - interval '10 days', now() - interval '9 days', 'Stingător la îndemână.'),
         (v_beta, 'HWP-' || v_sufix || '-B', 'Atelier', 'Sudură', now() - interval '10 days', now() - interval '9 days', 'Stingător la îndemână.');

  insert into public.environmental_permits (organization_id, numar, tip, emitent, valabil_pana, responsabil_employee_id)
  values (v_alfa, 'EP-' || v_sufix || '-A', 'gestionare deșeuri', 'APM', current_date + 300, (select val from t_ids where cheie='mgr_alfa')),
         (v_beta, 'EP-' || v_sufix || '-B', 'gestionare deșeuri', 'APM', current_date + 300, (select val from t_ids where cheie='mgr_beta'));

  -- Fișă de aptitudine cu restricție: `rezultat <> 'apt'` declanșează, prin
  -- trigger (ssm_exam_sync, 0011), inserarea AUTOMATĂ în employee_work_restrictions
  -- — populăm ambele tabele printr-un singur INSERT, prin motorul real.
  insert into public.occupational_health_exams (organization_id, employee_id, tip, data_examinarii, rezultat, valabil_pana)
  values (v_alfa, (select val from t_ids where cheie='ang_alfa'), 'periodic', current_date - 100, 'apt_conditionat', current_date + 265),
         (v_beta, (select val from t_ids where cheie='ang_beta'), 'periodic', current_date - 100, 'apt_conditionat', current_date + 265);

  -- Echipament ISCIR: capcana reală e triggerul `equipment_iscir_guard` (0011)
  -- — un echipament `este_iscir` cere ca `responsabil_employee_id` să aibă o
  -- autorizație nominală (`personnel_authorizations`) VALABILĂ și de tipul
  -- cerut, altfel INSERT-ul eșuează cu P0001. Autorizația trebuie inserată
  -- ÎNAINTEA echipamentului, nu după.
  insert into public.personnel_authorizations (organization_id, employee_id, tip, numar, emitent, valabil_pana)
  values (v_alfa, (select val from t_ids where cheie='mgr_alfa'), 'stivuitorist', 'AUT-' || v_sufix || '-A', 'ISCIR', current_date + 300),
         (v_beta, (select val from t_ids where cheie='mgr_beta'), 'stivuitorist', 'AUT-' || v_sufix || '-B', 'ISCIR', current_date + 300);

  insert into public.equipment (id, organization_id, cod, denumire, department_id, responsabil_employee_id,
                                este_iscir, tip_autorizare_necesara)
  values ((select val from t_ids where cheie='equip_alfa'), v_alfa, 'ECH-' || v_sufix || '-A', 'Stivuitor de test',
          (select val from t_ids where cheie='dep_alfa'), (select val from t_ids where cheie='mgr_alfa'), true, 'stivuitorist'),
         ((select val from t_ids where cheie='equip_beta'), v_beta, 'ECH-' || v_sufix || '-B', 'Stivuitor de test',
          (select val from t_ids where cheie='dep_beta'), (select val from t_ids where cheie='mgr_beta'), true, 'stivuitorist');

  insert into public.equipment_meters (organization_id, equipment_id, tip, citire, data_citirii)
  values (v_alfa, (select val from t_ids where cheie='equip_alfa'), 'ore', 120.50, current_date - 5),
         (v_beta, (select val from t_ids where cheie='equip_beta'), 'ore', 120.50, current_date - 5);

  insert into public.maintenance_plans (id, organization_id, equipment_id, denumire, periodicitate_zile, responsabil_employee_id)
  values ((select val from t_ids where cheie='mplan_alfa'), v_alfa, (select val from t_ids where cheie='equip_alfa'),
          'Revizie periodică', 180, (select val from t_ids where cheie='mgr_alfa')),
         ((select val from t_ids where cheie='mplan_beta'), v_beta, (select val from t_ids where cheie='equip_beta'),
          'Revizie periodică', 180, (select val from t_ids where cheie='mgr_beta'));

  insert into public.maintenance_interventions (organization_id, plan_id, equipment_id, data, descriere, executant_employee_id)
  values (v_alfa, (select val from t_ids where cheie='mplan_alfa'), (select val from t_ids where cheie='equip_alfa'),
          current_date - 3, 'Intervenție de test', (select val from t_ids where cheie='mgr_alfa')),
         (v_beta, (select val from t_ids where cheie='mplan_beta'), (select val from t_ids where cheie='equip_beta'),
          current_date - 3, 'Intervenție de test', (select val from t_ids where cheie='mgr_beta'));

  insert into public.fault_reports (organization_id, equipment_id, raportat_de_employee_id, descriere)
  values (v_alfa, (select val from t_ids where cheie='equip_alfa'), (select val from t_ids where cheie='ang_alfa'), 'Zgomot neobișnuit la ridicare.'),
         (v_beta, (select val from t_ids where cheie='equip_beta'), (select val from t_ids where cheie='ang_beta'), 'Zgomot neobișnuit la ridicare.');

  insert into public.iscir_authorizations (organization_id, equipment_id, numar, tip, valabil_pana)
  values (v_alfa, (select val from t_ids where cheie='equip_alfa'), 'ISCIR-' || v_sufix || '-A', 'verificare_tehnica_periodica', current_date + 300),
         (v_beta, (select val from t_ids where cheie='equip_beta'), 'ISCIR-' || v_sufix || '-B', 'verificare_tehnica_periodica', current_date + 300);

  -- ── Faza 3b (migrarea 0013): pontaj ─────────────────────────────────────────
  insert into t_ids
  select 'aper_' || e, gen_random_uuid() from unnest(array['alfa','beta']) e;

  insert into public.attendance_settings (organization_id, valabil_de_la, ore_pe_zi, ore_pe_saptamana,
    ore_maxime_saptamanale, perioada_referinta_luni, repaus_zilnic_minim_ore, repaus_saptamanal_minim_ore,
    spor_suplimentare_procent, spor_noapte_procent, spor_weekend_procent, spor_sarbatoare_procent,
    noapte_start, noapte_sfarsit, termen_compensare_suplimentare_zile, termen_compensare_sarbatoare_zile,
    pauza_masa_minute, pauza_masa_inclusa_in_program, pauza_obligatorie_peste_ore)
  values
    (v_alfa, current_date - 400, 8, 40, 48, 3, 12, 24, 75, 25, 100, 100, '22:00', '06:00', 60, 30, 30, false, 6),
    (v_beta, current_date - 400, 8, 40, 48, 3, 12, 24, 75, 25, 100, 100, '22:00', '06:00', 60, 30, 30, false, 6);

  -- `an`/`luna` din perioada deschisă mai jos trebuie să acopere data folosită
  -- de linia de pontaj — triggerul `pontaj_intrare_pregateste` (0013) refuză
  -- orice înregistrare a cărei lună n-a fost deschisă explicit.
  insert into public.attendance_periods (id, organization_id, an, luna, data_inceput, data_sfarsit)
  values ((select val from t_ids where cheie='aper_alfa'), v_alfa,
          extract(year from current_date)::smallint, extract(month from current_date)::smallint,
          current_date, current_date),
         ((select val from t_ids where cheie='aper_beta'), v_beta,
          extract(year from current_date)::smallint, extract(month from current_date)::smallint,
          current_date, current_date);

  insert into public.attendance_approval_batches (organization_id, period_id, department_id, manager_employee_id)
  values (v_alfa, (select val from t_ids where cheie='aper_alfa'), (select val from t_ids where cheie='dep_alfa'),
          (select val from t_ids where cheie='mgr_alfa')),
         (v_beta, (select val from t_ids where cheie='aper_beta'), (select val from t_ids where cheie='dep_beta'),
          (select val from t_ids where cheie='mgr_beta'));

  -- O zi de sărbătoare lucrată declanșează, prin trigger
  -- (pontaj_genereaza_compensare_sarbatoare, 0013), inserarea AUTOMATĂ în
  -- holiday_compensation — două tabele populate printr-un singur INSERT, prin
  -- motorul real.
  insert into public.attendance_entries (organization_id, employee_id, data, ore_lucrate, tip_zi)
  values (v_alfa, (select val from t_ids where cheie='ang_alfa'), current_date, 8, 'sarbatoare'),
         (v_beta, (select val from t_ids where cheie='ang_beta'), current_date, 8, 'sarbatoare');

  insert into public.overtime_compensation (organization_id, employee_id, data_generarii, ore, termen_folosire)
  values (v_alfa, (select val from t_ids where cheie='ang_alfa'), current_date - 10, 4, current_date + 50),
         (v_beta, (select val from t_ids where cheie='ang_beta'), current_date - 10, 4, current_date + 50);

  -- ── Faza 6 (migrarea 0014): checklist de onboarding/offboarding ────────────
  insert into t_ids
  select 'ctpl_' || e, gen_random_uuid() from unnest(array['alfa','beta']) e;

  insert into public.checklist_templates (id, organization_id, denumire, tip)
  values ((select val from t_ids where cheie='ctpl_alfa'), v_alfa, 'Onboarding de test ' || v_sufix, 'onboarding'),
         ((select val from t_ids where cheie='ctpl_beta'), v_beta, 'Onboarding de test ' || v_sufix, 'onboarding');

  -- Pas neobligatoriu, responsabil = managerul direct: simplifică finalizarea
  -- de mai jos (fără el, ar trebui bifat manual înainte de a putea finaliza).
  insert into public.checklist_template_items (organization_id, template_id, ordine, titlu, responsabil_tip, obligatoriu)
  values (v_alfa, (select val from t_ids where cheie='ctpl_alfa'), 1, 'Predare echipament', 'manager_direct', false),
         (v_beta, (select val from t_ids where cheie='ctpl_beta'), 1, 'Predare echipament', 'manager_direct', false);

  -- Pornirea instanței copiază pașii din șablon prin trigger
  -- (checklist_copiaza_pasii, 0014) — populează checklist_instance_items prin
  -- motorul real. Finalizarea (fără pași obligatorii nebifați) generează, tot
  -- prin trigger, dovada imutabilă din checklist_completion_records — patru
  -- tabele, un singur flux.
  insert into public.checklist_instances (organization_id, template_id, employee_id, tip, data_referinta)
  values (v_alfa, (select val from t_ids where cheie='ctpl_alfa'), (select val from t_ids where cheie='ang_alfa'), 'onboarding', current_date),
         (v_beta, (select val from t_ids where cheie='ctpl_beta'), (select val from t_ids where cheie='ang_beta'), 'onboarding', current_date);

  update public.checklist_instances set status = 'finalizata'
   where organization_id in (v_alfa, v_beta) and status = 'in_curs';

  -- ── Faza 10 (migrarea 0015): diurne și deplasări ────────────────────────────
  -- `countries` și `per_diem_country_rates` sunt nomenclatoare GLOBALE (fără
  -- organization_id) — ies din bucla verificării (c) automat, la fel ca
  -- `medical_leave_codes`/`public_holidays` mai sus.
  insert into t_ids
  select 'btrip_' || e, gen_random_uuid() from unnest(array['alfa','beta']) e;

  -- Politica firmei TREBUIE să existe înaintea oricărei deplasări: triggerul
  -- `valideaza_deplasare` (0015) refuză INSERT-ul dacă nu găsește o politică
  -- valabilă la data plecării.
  insert into public.per_diem_policies (organization_id, denumire, country_id_intern, moneda_interna,
    diurna_interna_zi, diurna_baza_legala_interna, multiplu_plafon_neimpozabil, multiplu_diurna_externa,
    prag_ore_minim, prag_ore_zi_intreaga, fractiune_zi_partiala, tarif_km_auto_personal, moneda_tarif_km,
    plafon_salarii_baza_luna, valabil_de_la)
  select v_alfa, 'Politică diurnă de test', c.id, 'RON', 50, 50, 2.5, 1, 8, 12, 0.5, 2, 'RON', 3, current_date - 400
    from public.countries c where c.cod_alpha2 = 'RO'
  union all
  select v_beta, 'Politică diurnă de test', c.id, 'RON', 50, 50, 2.5, 1, 8, 12, 0.5, 2, 'RON', 3, current_date - 400
    from public.countries c where c.cod_alpha2 = 'RO';

  insert into public.business_trips (id, organization_id, employee_id, scop, country_id, plecare_la, sosire_la, mijloc_transport)
  select (select val from t_ids where cheie='btrip_alfa'), v_alfa, (select val from t_ids where cheie='ang_alfa'),
         'Deplasare de test — verificare izolare ' || v_sufix, c.id, now() - interval '3 days', now() - interval '1 day',
         'auto_personal'::public.business_trip_transport
    from public.countries c where c.cod_alpha2 = 'RO'
  union all
  select (select val from t_ids where cheie='btrip_beta'), v_beta, (select val from t_ids where cheie='ang_beta'),
         'Deplasare de test — verificare izolare ' || v_sufix, c.id, now() - interval '3 days', now() - interval '1 day',
         'auto_personal'::public.business_trip_transport
    from public.countries c where c.cod_alpha2 = 'RO';

  -- Etapă spre altă țară: `business_trip_legs` cere două țări DIFERITE
  -- (valideaza_etapa_deplasare, 0015) și un interval încadrat în deplasare.
  insert into public.business_trip_legs (organization_id, business_trip_id, ordine, from_country_id, to_country_id, plecare_la, sosire_la)
  select v_alfa, (select val from t_ids where cheie='btrip_alfa'), 1, ro.id, de.id, now() - interval '3 days', now() - interval '2 days'
    from public.countries ro, public.countries de where ro.cod_alpha2 = 'RO' and de.cod_alpha2 = 'DE'
  union all
  select v_beta, (select val from t_ids where cheie='btrip_beta'), 1, ro.id, de.id, now() - interval '3 days', now() - interval '2 days'
    from public.countries ro, public.countries de where ro.cod_alpha2 = 'RO' and de.cod_alpha2 = 'DE';

  insert into public.trip_expenses (organization_id, business_trip_id, tip, data_cheltuielii, suma, moneda, curs_valutar)
  values (v_alfa, (select val from t_ids where cheie='btrip_alfa'), 'cazare', current_date - 2, 250.00, 'RON', 1),
         (v_beta, (select val from t_ids where cheie='btrip_beta'), 'cazare', current_date - 2, 250.00, 'RON', 1);

  -- `per_diem_calculations` se scrie, în producție, EXCLUSIV prin
  -- app.recalculeaza_diurna() (SECURITY DEFINER care verifică drepturile
  -- apelantului) — de aceea nu are politică INSERT pentru `authenticated`.
  -- Pentru fixture (proprietar, ocolește RLS) inserăm direct rezultatul, ca
  -- pentru orice altă tabelă derivată (compliance_alerts mai sus).
  insert into public.per_diem_calculations (organization_id, business_trip_id, policy_id, zile_total, valoare_lei)
  select v_alfa, (select val from t_ids where cheie='btrip_alfa'), p.id, 2, 100.00
    from public.per_diem_policies p where p.organization_id = v_alfa
  union all
  select v_beta, (select val from t_ids where cheie='btrip_beta'), p.id, 2, 100.00
    from public.per_diem_policies p where p.organization_id = v_beta;
  -- ── Modulele adăugate după scrierea fixture-ului ────────────────────────────
  -- Salarizare (0026), anunțuri (0028), evaluări (0038) și pontajul săptămânal
  -- (0041) au intrat în proiect DUPĂ ce fixture-ul a fost scris, deci
  -- verificarea (c) le raporta drept „izolare nedemonstrată”: fără rânduri ale
  -- organizației Beta, nu ai ce încerca să citești din Alfa. Nu erau nesigure —
  -- doar nedovedite. Aici le dăm ambelor organizații câte un rând.
  insert into t_ids
  select k || '_' || e, gen_random_uuid()
    from unnest(array['alfa','beta']) e,
         unnest(array['pset','pper','anunt','etpl','wsub']) k;

  insert into public.payroll_settings (id, organization_id, valabil_de_la,
    cota_cas, cota_cass, cota_impozit, cota_cam_angajator)
  -- Cotele sunt FRACȚII între 0 și 1 (`payroll_settings_cote_ck`), nu procente:
  -- 0.25 = 25 % CAS. Valorile sunt ilustrative — cele reale trăiesc în
  -- configurație și sunt marcate ⚠️ în NOTES.md §3 până le confirmă un contabil.
  values ((select val from t_ids where cheie='pset_alfa'), v_alfa, current_date - 400, 0.25, 0.10, 0.10, 0.0225),
         ((select val from t_ids where cheie='pset_beta'), v_beta, current_date - 400, 0.25, 0.10, 0.10, 0.0225);

  insert into public.payroll_personal_deduction_brackets (organization_id, settings_id,
    nr_persoane_intretinere_min, venit_brut_max, valoare)
  values (v_alfa, (select val from t_ids where cheie='pset_alfa'), 0, 4000, 20),
         (v_beta, (select val from t_ids where cheie='pset_beta'), 0, 4000, 20);

  insert into public.payroll_periods (id, organization_id, an, luna, attendance_period_id, settings_id)
  values ((select val from t_ids where cheie='pper_alfa'), v_alfa,
          extract(year from current_date)::smallint, extract(month from current_date)::smallint,
          (select val from t_ids where cheie='aper_alfa'), (select val from t_ids where cheie='pset_alfa')),
         ((select val from t_ids where cheie='pper_beta'), v_beta,
          extract(year from current_date)::smallint, extract(month from current_date)::smallint,
          (select val from t_ids where cheie='aper_beta'), (select val from t_ids where cheie='pset_beta'));

  insert into public.payroll_entries (organization_id, period_id, employee_id,
    zile_lucratoare_luna, settings_snapshot)
  values (v_alfa, (select val from t_ids where cheie='pper_alfa'),
          (select val from t_ids where cheie='ang_alfa'), 21, '{}'::jsonb),
         (v_beta, (select val from t_ids where cheie='pper_beta'),
          (select val from t_ids where cheie='ang_beta'), 21, '{}'::jsonb);

  insert into public.payroll_bonuses (organization_id, employee_id, period_id, tip, suma, motiv)
  values (v_alfa, (select val from t_ids where cheie='ang_alfa'),
          (select val from t_ids where cheie='pper_alfa'), 'prima_performanta', 100.00, 'fixture'),
         (v_beta, (select val from t_ids where cheie='ang_beta'),
          (select val from t_ids where cheie='pper_beta'), 'prima_performanta', 100.00, 'fixture');

  insert into public.payroll_deductions (organization_id, employee_id, period_id, tip, suma, motiv)
  values (v_alfa, (select val from t_ids where cheie='ang_alfa'),
          (select val from t_ids where cheie='pper_alfa'), 'avans', 50.00, 'fixture'),
         (v_beta, (select val from t_ids where cheie='ang_beta'),
          (select val from t_ids where cheie='pper_beta'), 'avans', 50.00, 'fixture');

  insert into public.payroll_garnishments (organization_id, employee_id, dosar, creditor,
    tip_creanta, suma_totala, suma_lunara, data_inceput)
  values (v_alfa, (select val from t_ids where cheie='ang_alfa'), 'DOS-ALFA', 'Creditor Alfa',
          'alta', 5000.00, 500.00, current_date),
         (v_beta, (select val from t_ids where cheie='ang_beta'), 'DOS-BETA', 'Creditor Beta',
          'alta', 4000.00, 400.00, current_date);

  insert into public.payroll_prior_income (organization_id, employee_id, an, luna,
    venit_brut, drepturi_salariale, zile_lucrate, sursa)
  values (v_alfa, (select val from t_ids where cheie='ang_alfa'),
          extract(year from current_date)::smallint, 1, 5000.00, 5000.00, 21, 'fixture'),
         (v_beta, (select val from t_ids where cheie='ang_beta'),
          extract(year from current_date)::smallint, 1, 4000.00, 4000.00, 21, 'fixture');

  insert into public.announcements (id, organization_id, titlu, continut)
  values ((select val from t_ids where cheie='anunt_alfa'), v_alfa, 'Anunț Alfa', 'Conținut de fixture.'),
         ((select val from t_ids where cheie='anunt_beta'), v_beta, 'Anunț Beta', 'Conținut de fixture.');

  -- ── Faza 12 (migrarea 0045): tichete IT ─────────────────────────────────────
  -- Modulul a fost livrat fără rânduri în fixture, iar verificarea (c) s-a oprit
  -- exact aici: cinci tabele pe care nimeni nu demonstrase că sunt izolate.
  -- `numar_afisat` se scrie literal — în producție îl alocă
  -- `public.aloca_numar_tichet`, dar aici ne trebuie o valoare stabilă care să
  -- respecte `tickets_numar_ck`.
  -- `bug_erp` cere cele patru câmpuri de reproducere (`tickets_bug_ck`): fiecare
  -- tip de tichet are propriile coloane obligatorii, verificate prin CHECK, nu
  -- doar prin formular.
  insert into public.tickets (id, organization_id, numar_afisat, tip, titlu, descriere,
                              modul, pasi_efectuati, rezultat_asteptat, rezultat_obtinut,
                              solicitant_employee_id, created_by, updated_by)
  values ((select val from t_ids where cheie='tichet_alfa'), v_alfa, 'IT-2026-00001',
          'bug_erp', 'Tichet Alfa', 'Conținut de fixture.',
          'Pontaj', 'Am deschis luna.', 'Se salvează.', 'Nu se salvează.',
          (select val from t_ids where cheie='ang_alfa'), v_admin_alfa, v_admin_alfa),
         ((select val from t_ids where cheie='tichet_beta'), v_beta, 'IT-2026-00001',
          'bug_erp', 'Tichet Beta', 'Conținut de fixture.',
          'Pontaj', 'Am deschis luna.', 'Se salvează.', 'Nu se salvează.',
          (select val from t_ids where cheie='ang_beta'), v_admin_beta, v_admin_beta);

  insert into public.ticket_comments (organization_id, ticket_id, autor_employee_id, continut, created_by, updated_by)
  values (v_alfa, (select val from t_ids where cheie='tichet_alfa'),
          (select val from t_ids where cheie='ang_alfa'), 'Comentariu Alfa.', v_admin_alfa, v_admin_alfa),
         (v_beta, (select val from t_ids where cheie='tichet_beta'),
          (select val from t_ids where cheie='ang_beta'), 'Comentariu Beta.', v_admin_beta, v_admin_beta);

  insert into public.ticket_history (organization_id, ticket_id, actor_user_id, camp, valoare_veche, valoare_noua)
  values (v_alfa, (select val from t_ids where cheie='tichet_alfa'), v_admin_alfa, 'status', 'nou', 'in_lucru'),
         (v_beta, (select val from t_ids where cheie='tichet_beta'), v_admin_beta, 'status', 'nou', 'in_lucru');

  insert into public.ticket_watchers (organization_id, ticket_id, employee_id, created_by)
  values (v_alfa, (select val from t_ids where cheie='tichet_alfa'),
          (select val from t_ids where cheie='mgr_alfa'), v_admin_alfa),
         (v_beta, (select val from t_ids where cheie='tichet_beta'),
          (select val from t_ids where cheie='ang_beta'), v_admin_beta);

  insert into public.ticket_attachments (organization_id, ticket_id, storage_path, denumire, mime, created_by)
  values (v_alfa, (select val from t_ids where cheie='tichet_alfa'),
          v_alfa || '/tickets/a.png', 'captura-alfa.png', 'image/png', v_admin_alfa),
         (v_beta, (select val from t_ids where cheie='tichet_beta'),
          v_beta || '/tickets/b.png', 'captura-beta.png', 'image/png', v_admin_beta);

  insert into public.announcement_reads (organization_id, announcement_id, employee_id, user_id)
  values (v_alfa, (select val from t_ids where cheie='anunt_alfa'),
          (select val from t_ids where cheie='ang_alfa'), v_emp_alfa),
         (v_beta, (select val from t_ids where cheie='anunt_beta'),
          (select val from t_ids where cheie='ang_beta'), v_emp_beta);

  -- `evaluation_templates.organization_id` e NULLABIL (există șabloane de
  -- platformă). Fixture-ul dă fiecărei organizații șablonul ei, altfel
  -- `employee_evaluations` n-ar avea la ce să se lege per tenant.
  insert into public.evaluation_templates (id, organization_id, denumire)
  values ((select val from t_ids where cheie='etpl_alfa'), v_alfa, 'Evaluare anuală Alfa'),
         ((select val from t_ids where cheie='etpl_beta'), v_beta, 'Evaluare anuală Beta');

  insert into public.employee_evaluations (organization_id, employee_id, template_id, data_evaluarii)
  values (v_alfa, (select val from t_ids where cheie='ang_alfa'),
          (select val from t_ids where cheie='etpl_alfa'), current_date),
         (v_beta, (select val from t_ids where cheie='ang_beta'),
          (select val from t_ids where cheie='etpl_beta'), current_date);

  insert into public.attendance_week_submissions (id, organization_id, employee_id, saptamana_start)
  values ((select val from t_ids where cheie='wsub_alfa'), v_alfa,
          (select val from t_ids where cheie='ang_alfa'), date_trunc('week', current_date)::date),
         ((select val from t_ids where cheie='wsub_beta'), v_beta,
          (select val from t_ids where cheie='ang_beta'), date_trunc('week', current_date)::date);

  insert into public.attendance_week_submission_days (organization_id, submission_id, data)
  values (v_alfa, (select val from t_ids where cheie='wsub_alfa'), date_trunc('week', current_date)::date),
         (v_beta, (select val from t_ids where cheie='wsub_beta'), date_trunc('week', current_date)::date);

end
$$;

-- ── Utilitare de asertare ────────────────────────────────────────────────────

create or replace function pg_temp.esueaza(p_mesaj text) returns void
language plpgsql as $$
begin
  raise exception 'IZOLARE RUPTĂ: %', p_mesaj using errcode = 'P0001';
end $$;

create or replace function pg_temp.id(p_cheie text) returns uuid
language sql stable as $$ select val from t_ids where cheie = p_cheie $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (a) RLS activat pe fiecare tabelă
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare v text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into v
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'app') and c.relkind = 'r' and not c.relrowsecurity;
  if v is not null then perform pg_temp.esueaza(format('(a) tabele fără RLS: %s', v)); end if;
  raise notice '(a) RLS activat pe toate tabelele ✓';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (b) FORCE RLS, minus lista albă comisă cu motiv
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v text;
  -- Aceste patru tabele sunt citite de helperii SECURITY DEFINER. Cu FORCE,
  -- helperul ar declanșa chiar politica ce îl apelează ⇒ recursiune infinită.
  lista_alba text[] := array['organization_members','platform_admins','role_permissions','features'];
begin
  select string_agg(c.relname, ', ' order by c.relname) into v
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public','app') and c.relkind = 'r'
    and c.relrowsecurity and not c.relforcerowsecurity
    and not (c.relname = any (lista_alba));
  if v is not null then perform pg_temp.esueaza(format('(b) fără FORCE și în afara listei albe: %s', v)); end if;
  raise notice '(b) FORCE RLS aplicat, cu lista albă respectată ✓';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (c) Utilizatorul din Alfa nu poate CITI niciun rând al lui Beta
--
-- Parcurge automat FIECARE tabelă cu `organization_id`. O tabelă adăugată mâine
-- intră singură în test — nimeni nu trebuie să-și amintească să o adauge.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  t record;
  n bigint;
  v_beta uuid := pg_temp.id('beta');
  v_actor uuid := pg_temp.id('admin_alfa');
  probleme text := '';
  neacoperite text := '';
  blocate text := '';
  verificate int := 0;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace nsp on nsp.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'organization_id'
                       and a.attnum > 0 and not a.attisdropped
    where nsp.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  loop
    -- Tabela chiar conține rânduri ale lui Beta? Dacă nu, verificarea de mai jos
    -- ar trece indiferent de politici — un test verde care nu demonstrează nimic.
    -- O astfel de tabelă se RAPORTEAZĂ, nu se sare în tăcere: tăcerea arată
    -- identic cu succesul, iar aici diferența e între „izolare dovedită" și
    -- „izolare presupusă".
    execute format('select count(*) from public.%I where organization_id = $1', t.relname)
      into n using v_beta;
    if n = 0 then
      neacoperite := neacoperite || format(E'\n  %s', t.relname);
      continue;
    end if;
    verificate := verificate + 1;

    perform set_config('request.jwt.claim.sub', v_actor::text, true);
    set local role authenticated;
    begin
      execute format('select count(*) from public.%I where organization_id = $1', t.relname)
        into n using v_beta;
    exception when insufficient_privilege then
      -- Privilegiul lipsește cu totul, deci nici RLS nu mai apucă să conteze.
      -- Este o protecție MAI TARE decât o politică: `employee_sensitive_data`
      -- se atinge exclusiv prin funcțiile care scriu în audit la fiecare apel,
      -- iar un SELECT direct ar ocoli tocmai auditul. Refuzul e rezultatul dorit.
      n := -1;
    end;
    reset role;

    if n > 0 then
      probleme := probleme || format(E'\n  %s: %s rânduri ale lui Beta vizibile', t.relname, n);
    elsif n = -1 then
      blocate := blocate || format(E'\n  %s', t.relname);
    end if;
  end loop;

  if probleme <> '' then perform pg_temp.esueaza('(c) SCURGERE LA CITIRE:' || probleme); end if;
  if verificate = 0 then perform pg_temp.esueaza('(c) nicio tabelă verificată — fixture-ul nu populează nimic'); end if;
  if neacoperite <> '' then
    perform pg_temp.esueaza(format(
      E'(c) IZOLARE NEVERIFICATĂ pentru %s tabele — fixture-ul nu are rânduri ale organizației Beta în:%s\n\n'
      'Nu înseamnă că sunt nesigure; înseamnă că nimeni nu a demonstrat că sunt.\n'
      'Adaugă rânduri pentru AMBELE organizații în fixture, sau, dacă tabela chiar nu\n'
      'poate fi populată, trece-o în lista albă din acest fișier CU MOTIVUL SCRIS.',
      (length(neacoperite) - length(replace(neacoperite, E'\n', '')))::text, neacoperite));
  end if;
  if blocate <> '' then
    raise notice '(c) tabele inaccesibile direct lui authenticated — protecție mai tare decât RLS:%', blocate;
  end if;
  raise notice '(c) niciun rând al lui Beta vizibil din Alfa (% tabele verificate) ✓', verificate;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (d) INSERT cu organization_id-ul altei organizații este refuzat
--
-- La fel de grav ca citirea, și mai ușor de uitat: o politică poate avea USING
-- corect și WITH CHECK absent.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_beta uuid := pg_temp.id('beta');
  v_actor uuid := pg_temp.id('admin_alfa');
  reusit boolean := false;
begin
  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  set local role authenticated;
  begin
    insert into public.notifications (organization_id, user_id, kind, title)
    values (v_beta, v_actor, 'info', 'injectat din Alfa');
    reusit := true;
  exception when insufficient_privilege or others then
    reusit := false;
  end;
  reset role;

  if reusit then perform pg_temp.esueaza('(d) INSERT cross-tenant a REUȘIT în notifications'); end if;
  raise notice '(d) INSERT cu organizația altcuiva refuzat ✓';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (e) UPDATE pe un rând al altei organizații nu are efect
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_beta uuid := pg_temp.id('beta');
  v_actor uuid := pg_temp.id('admin_alfa');
  afectate int;
begin
  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  set local role authenticated;
  begin
    update public.organizations set name = 'DETURNAT' where id = v_beta;
    get diagnostics afectate = row_count;
  exception when others then
    afectate := 0;
  end;
  reset role;

  if afectate > 0 then perform pg_temp.esueaza('(e) UPDATE cross-tenant a modificat rânduri în organizations'); end if;
  if (select name from public.organizations where id = v_beta) <> 'Beta SRL' then
    perform pg_temp.esueaza('(e) numele organizației Beta a fost modificat din Alfa');
  end if;
  raise notice '(e) UPDATE pe rândurile altei organizații fără efect ✓';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (f) Fără politici DELETE, și DELETE revocat de la `authenticated`
--
-- Soft delete peste tot ⇒ absența politicii PLUS revocarea este regula corectă,
-- nu o omisiune. Aserțiunea este deci inversată față de celelalte.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare v text;
begin
  select string_agg(format('%s.%s', c.relname, p.polname), ', ')
    into v
  from pg_policy p join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public','app') and p.polcmd = 'd';
  if v is not null then perform pg_temp.esueaza(format('(f) există politici DELETE: %s', v)); end if;

  select string_agg(c.relname, ', ' order by c.relname) into v
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and has_table_privilege('authenticated', c.oid, 'DELETE');
  if v is not null then perform pg_temp.esueaza(format('(f) DELETE nerevocat pentru authenticated: %s', v)); end if;

  raise notice '(f) fără politici DELETE și DELETE revocat ✓';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (g) Fiecare view are `security_invoker`
--
-- O view obișnuită rulează cu drepturile creatorului și ocolește RLS-ul
-- tabelelor sursă — o poartă laterală perfect tăcută.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare v text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into v
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public','app') and c.relkind = 'v'
    and coalesce(array_to_string(c.reloptions, ','), '') not like '%security_invoker=%on%'
    and coalesce(array_to_string(c.reloptions, ','), '') not like '%security_invoker=true%';
  if v is not null then perform pg_temp.esueaza(format('(g) view-uri fără security_invoker: %s', v)); end if;
  raise notice '(g) toate view-urile au security_invoker ✓';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (h) Fiecare funcție SECURITY DEFINER are `search_path = ''`
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare v text;
begin
  select string_agg(format('%s.%s', n.nspname, p.proname), ', ') into v
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public','app','internal') and p.prosecdef
    and coalesce((select split_part(c, '=', 2) from unnest(p.proconfig) c
                  where c like 'search_path=%'), '(nesetat)') <> '""';
  if v is not null then perform pg_temp.esueaza(format('(h) SECURITY DEFINER fără search_path='''': %s', v)); end if;
  raise notice '(h) toate funcțiile SECURITY DEFINER au search_path = '''' ✓';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (i) Un modul dezactivat chiar refuză, nu doar dispare din meniu
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_alfa uuid := pg_temp.id('alfa');
  v_beta uuid := pg_temp.id('beta');
  v_actor uuid := pg_temp.id('admin_alfa');
begin
  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  set local role authenticated;
  if not app.feature_on(v_alfa, 'leave') then
    reset role;
    perform pg_temp.esueaza('(i) modulul „leave" este activ pentru Alfa dar feature_on întoarce fals');
  end if;
  if app.feature_on(v_beta, 'leave') then
    reset role;
    perform pg_temp.esueaza('(i) modulul „leave" este DEZACTIVAT pentru Beta dar feature_on întoarce adevărat');
  end if;
  -- Nucleul este mereu activ, prin `features.is_core`, nu prin comparație cu un literal.
  if not app.feature_on(v_beta, 'nucleu') then
    reset role;
    perform pg_temp.esueaza('(i) modulul de nucleu ar trebui să fie mereu activ');
  end if;
  reset role;
  raise notice '(i) feature flags respectate server-side ✓';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (j) `scope = 'none'` este refuz explicit, iar managerul nu vede salarii
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v public.permission_scope;
  v_alfa uuid := pg_temp.id('alfa');
  v_beta uuid := pg_temp.id('beta');
  v_actor uuid := pg_temp.id('admin_alfa');
begin
  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  set local role authenticated;

  v := app.has_permission(v_alfa, 'employees', 'read');
  if v <> 'all' then reset role; perform pg_temp.esueaza(format('(j) org_admin ar trebui să aibă employees:read=all, are %s', v)); end if;

  v := app.has_permission(v_alfa, 'organizations', 'delete');
  if v <> 'none' then reset role; perform pg_temp.esueaza(format('(j) org_admin nu are voie să șteargă organizații, are %s', v)); end if;

  -- O permisiune cerută pentru o organizație în care nu e membru: refuz.
  v := app.has_permission(v_beta, 'employees', 'read');
  if v <> 'none' then reset role; perform pg_temp.esueaza(format('(j) permisiune acordată într-o organizație străină: %s', v)); end if;

  reset role;
  raise notice '(j) matricea de permisiuni respectată, inclusiv refuzul explicit ✓';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (k) Gărzile chiar blochează coloanele rezervate platformei
--
-- Aici a fost gaura reală: `is_service_context()` întorcea true pentru orice
-- apelant, iar toate gărzile ieșeau pe prima linie.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_alfa uuid := pg_temp.id('alfa');
  v_actor uuid := pg_temp.id('admin_alfa');
  v_plan public.plan_type;
  v_seats integer;
begin
  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  set local role authenticated;
  begin
    update public.organizations
      set plan = 'enterprise', seats_limit = 100000, status = 'active'
      where id = v_alfa;
  exception when others then null;
  end;
  reset role;

  select plan, seats_limit into v_plan, v_seats from public.organizations where id = v_alfa;
  if v_plan = 'enterprise' then
    perform pg_temp.esueaza('(k) un org_admin și-a schimbat singur planul — garda de coloane este moartă');
  end if;
  if v_seats = 100000 then
    perform pg_temp.esueaza('(k) un org_admin și-a ridicat singur plafonul de locuri');
  end if;
  raise notice '(k) coloanele rezervate platformei rămân blocate pentru org_admin ✓';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (l) Politicile NU blochează scrierile legitime
--
-- Verificările (a)–(k) demonstrează că nimeni nu vede ce nu are voie. Niciuna
-- nu demonstrează că cine ARE voie chiar poate lucra. Diferența nu e teoretică:
-- Faza 2 a trecut typecheck, lint, teste, cele trei bariere ȘI izolarea, în timp
-- ce un `org_admin` nu putea insera un angajat — `WITH CHECK` cerea o coloană
-- pe care un trigger BEFORE o scrisese deja.
--
-- O politică prea strictă nu e o problemă de securitate, dar e o aplicație care
-- nu funcționează. Testul trebuie să prindă ambele direcții.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_alfa uuid := pg_temp.id('alfa');
  v_actor uuid := pg_temp.id('admin_alfa');
  v_dep uuid;
  v_ang uuid;
begin
  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  set local role authenticated;

  insert into public.departments (organization_id, cod, denumire)
  values (v_alfa, 'TEST-L', 'Departament de probă')
  returning id into v_dep;

  insert into public.employees (organization_id, marca, first_name, last_name, department_id)
  values (v_alfa, 'TEST-L-001', 'Test', 'Utilizator', v_dep)
  returning id into v_ang;

  reset role;

  if v_dep is null or v_ang is null then
    perform pg_temp.esueaza('(l) inserarea a reușit dar nu a întors identificatorul');
  end if;

  -- Coloanele de actor se completează automat; politicile le cer.
  if (select created_by from public.employees where id = v_ang) is null then
    perform pg_temp.esueaza('(l) `created_by` nu a fost completat — lipsește triggerul set_actor');
  end if;
  if (select manager_path from public.employees where id = v_ang) = '{}'::uuid[] then
    perform pg_temp.esueaza('(l) `manager_path` nu a fost calculat de trigger');
  end if;

  raise notice '(l) un org_admin poate crea departamente și angajați ✓';
exception when others then
  reset role;
  perform pg_temp.esueaza(format('(l) o scriere LEGITIMĂ a fost respinsă: %s (%s)', sqlerrm, sqlstate));
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (l), continuare — scrieri reale în modulele noi (concedii, aprobare, inventar,
-- flotă, pontaj, SSM, onboarding, deplasări)
--
-- Blocul de mai sus testează un singur rol (org_admin) pe un singur modul (HR).
-- Nu e suficient: un `employee` care nu-și poate crea propria cerere de concediu,
-- un manager care nu-și vede sarcina de aprobare, sau un `org_admin` care nu
-- poate înregistra un obiect de inventar, un vehicul, o linie de pontaj, o
-- instruire SSM sau un checklist, ar trece toate verificările (a)-(k) fără să
-- demonstreze că aplicația chiar funcționează. Fiecare scriere de mai jos
-- rulează independent, cu propriul actor și propriul rezultat capturat separat
-- — ca un eșec izolat să nu ascundă succesul (sau eșecul) celorlalte.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_alfa       uuid := pg_temp.id('alfa');
  v_admin      uuid := pg_temp.id('admin_alfa');   -- și org_admin, și managerul direct al Anei (mgr_alfa.user_id)
  v_emp_user   uuid := pg_temp.id('emp_alfa');
  v_ang_alfa   uuid := pg_temp.id('ang_alfa');
  -- Actori cu rolurile `manager` și `hr` PROPRIU-ZISE. Până acum, scrierile
  -- etichetate „manager" erau făcute de `v_admin`, care e `org_admin`: treceau
  -- fiindcă org_admin are scope `all`, nu fiindcă scope-ul `team` al
  -- managerului funcționează. Eticheta era aspirațională.
  v_mgr_user   uuid := pg_temp.id('mgr_user_alfa');
  v_hr_user    uuid := pg_temp.id('hr_user_alfa');
  v_sub_alfa   uuid := pg_temp.id('sub_alfa');
  v_dep_alfa   uuid := pg_temp.id('dep_alfa');
  v_equip      uuid := pg_temp.id('equip_alfa');
  -- `super_admin` NU e niciodată în `organization_members` — un CHECK din
  -- 0001_kernel.sql îl interzice. Sursa lui e `platform_admins`, iar accesul
  -- trece prin `app.is_platform_admin()`, prima ramură OR a aproape fiecărei
  -- politici SELECT. Fixture-ul n-avea niciun rând acolo, deci al cincilea rol
  -- nu era dovedit capabil de nimic.
  v_sa_user    uuid := gen_random_uuid();
  v_veh_sub    uuid;
  v_foaie_sub  uuid;
  v_randuri    integer;
  v_scapate    text := '';
  v_caz        record;
  v_leave_type uuid;
  v_leave_req_id uuid;
  v_task_id    uuid;
  v_veh_id     uuid;
  v_rand       text := replace(gen_random_uuid()::text, '-', '');
  -- Pregătiri pentru probele rolului `employee` (v. blocul din bucla de mai jos).
  v_anunt_nou  uuid;
  v_pas_meu    uuid;
  v_inst_mea   uuid;
  v_pontaj_apr uuid;
  v_esuate     text := '';
  v_reusite    text := '';
begin
  select id into v_leave_type from public.leave_types
   where organization_id = v_alfa and key = 'odihna' and deleted_at is null;

  -- 1) un `employee` din Alfa își creează o cerere de concediu pentru el însuși.
  perform set_config('request.jwt.claim.sub', v_emp_user::text, true);
  set local role authenticated;
  begin
    insert into public.leave_requests
      (organization_id, employee_id, leave_type_id, data_inceput, data_sfarsit, motiv, status, created_by)
    values (v_alfa, v_ang_alfa, v_leave_type, current_date + 60, current_date + 61,
            'Verificare (l) — cerere proprie ' || v_rand, 'trimisa', v_emp_user)
    returning id into v_leave_req_id;
    v_reusite := v_reusite || E'\n  employee -> leave_requests (cerere proprie de concediu)';
  exception when others then
    v_esuate := v_esuate || format(E'\n  employee -> leave_requests (cerere proprie de concediu): %s (%s)', sqlerrm, sqlstate);
  end;
  reset role;

  -- 2) managerul direct al Anei (mgr_alfa, user_id = v_admin — vezi pregătirea
  -- HR de mai sus) vede sarcina de aprobare generată de cererea de la pasul 1,
  -- prin pasul „manager_direct” al fluxului implicit (0009 §12, reparat în 0017).
  -- Listă goală = defect, nu absență de date: managerul a fost legat explicit.
  if v_leave_req_id is not null then
    perform set_config('request.jwt.claim.sub', v_admin::text, true);
    set local role authenticated;
    begin
      select t.id into v_task_id from public.approval_tasks t
       where t.organization_id = v_alfa and t.entity_type = 'leave_request' and t.entity_id = v_leave_req_id
         and t.approver_user_id = v_admin and t.status = 'in_asteptare'
       order by t.ordine limit 1;
      if v_task_id is null then
        raise exception using errcode = 'P0001',
          message = 'lista de sarcini vizibile managerului direct este goală';
      end if;
      v_reusite := v_reusite || E'\n  manager -> approval_tasks (vede sarcina de aprobare)';
    exception when others then
      v_esuate := v_esuate || format(E'\n  manager -> approval_tasks (vede sarcina de aprobare): %s (%s)', sqlerrm, sqlstate);
    end;
    reset role;
  end if;

  -- 3) managerul aprobă acea sarcină.
  if v_task_id is not null then
    perform set_config('request.jwt.claim.sub', v_admin::text, true);
    set local role authenticated;
    begin
      update public.approval_tasks
         set status = 'aprobata', decis_la = now(), comentariu = 'Verificare (l) — aprobat automat'
       where id = v_task_id;
      v_reusite := v_reusite || E'\n  manager -> approval_tasks (aprobă sarcina)';
    exception when others then
      v_esuate := v_esuate || format(E'\n  manager -> approval_tasks (aprobă sarcina): %s (%s)', sqlerrm, sqlstate);
    end;
    reset role;
  end if;

  -- 4) un `org_admin` din Alfa inserează un obiect de inventar.
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  begin
    insert into public.inventory_items (organization_id, denumire, numar_inventar, created_by, updated_by)
    values (v_alfa, 'Verificare (l) — obiect inventar', 'INV-L-' || left(v_rand, 10), v_admin, v_admin);
    v_reusite := v_reusite || E'\n  org_admin -> inventory_items (obiect nou)';
  exception when others then
    v_esuate := v_esuate || format(E'\n  org_admin -> inventory_items (obiect nou): %s (%s)', sqlerrm, sqlstate);
  end;
  reset role;

  -- 5) un `org_admin` din Alfa inserează un vehicul, apoi îl șterge logic
  -- (ștergerea logică a flotei a fost reparată în 0018).
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  begin
    insert into public.vehicles (organization_id, nr_inmatriculare, marca, model, created_by, updated_by)
    values (v_alfa, 'CJ' || upper(left(v_rand, 7)) || 'L', 'Dacia', 'Logan', v_admin, v_admin)
    returning id into v_veh_id;
    v_reusite := v_reusite || E'\n  org_admin -> vehicles (vehicul nou)';
  exception when others then
    v_esuate := v_esuate || format(E'\n  org_admin -> vehicles (vehicul nou): %s (%s)', sqlerrm, sqlstate);
  end;
  reset role;

  if v_veh_id is not null then
    perform set_config('request.jwt.claim.sub', v_admin::text, true);
    set local role authenticated;
    begin
      update public.vehicles set deleted_at = now() where id = v_veh_id;
      v_reusite := v_reusite || E'\n  org_admin -> vehicles (ștergere logică)';
    exception when others then
      v_esuate := v_esuate || format(E'\n  org_admin -> vehicles (ștergere logică): %s (%s)', sqlerrm, sqlstate);
    end;
    reset role;
  end if;

  -- 6) un `org_admin` din Alfa inserează o linie de pontaj pentru Ana, într-o
  -- lună deja deschisă (attendance_periods, pregătit mai sus).
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  begin
    insert into public.attendance_entries (organization_id, employee_id, data, ore_lucrate, tip_zi)
    values (v_alfa, v_ang_alfa, current_date - 1, 8, 'lucratoare');
    v_reusite := v_reusite || E'\n  org_admin -> attendance_entries (linie de pontaj)';
  exception when others then
    v_esuate := v_esuate || format(E'\n  org_admin -> attendance_entries (linie de pontaj): %s (%s)', sqlerrm, sqlstate);
  end;
  reset role;

  -- 7) un `org_admin` din Alfa înregistrează o instruire SSM, de tipul CU
  -- periodicitate ('periodic', spre deosebire de 'la_locul_de_munca' folosit în
  -- pregătire) — cel mai obișnuit caz real de utilizare a acestei tabele.
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  begin
    insert into public.ssm_trainings (organization_id, employee_id, training_type_id, data_instruirii, durata_ore, semnatura_confirmata)
    select v_alfa, v_ang_alfa, tt.id, current_date - 1, 2.0, true
      from public.ssm_training_types tt
     where tt.organization_id = v_alfa and tt.cod = 'periodic' and tt.deleted_at is null;
    v_reusite := v_reusite || E'\n  org_admin -> ssm_trainings (instruire periodică)';
  exception when others then
    v_esuate := v_esuate || format(E'\n  org_admin -> ssm_trainings (instruire periodică): %s (%s)', sqlerrm, sqlstate);
  end;
  reset role;

  -- 8) un `org_admin` din Alfa pornește o nouă instanță de checklist pentru Ana
  -- (ciclul se calculează automat — vezi 0014, checklist_pregateste_instanta).
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  begin
    insert into public.checklist_instances (organization_id, template_id, employee_id, tip, data_referinta)
    select v_alfa, t.id, v_ang_alfa, 'onboarding', current_date
      from public.checklist_templates t
     where t.organization_id = v_alfa and t.tip = 'onboarding' and t.deleted_at is null
     order by t.created_at limit 1;
    v_reusite := v_reusite || E'\n  org_admin -> checklist_instances (pornește un checklist)';
  exception when others then
    v_esuate := v_esuate || format(E'\n  org_admin -> checklist_instances (pornește un checklist): %s (%s)', sqlerrm, sqlstate);
  end;
  reset role;

  -- 9) un `employee` din Alfa își creează o deplasare (per_diem_policies pentru
  -- Alfa a fost pregătită mai sus — fără ea, valideaza_deplasare ar refuza-o
  -- pentru un motiv greșit).
  perform set_config('request.jwt.claim.sub', v_emp_user::text, true);
  set local role authenticated;
  begin
    insert into public.business_trips (organization_id, employee_id, scop, plecare_la, sosire_la, mijloc_transport)
    values (v_alfa, v_ang_alfa, 'Verificare (l) — deplasare proprie ' || v_rand,
            now() + interval '10 days', now() + interval '12 days', 'auto_personal');
    v_reusite := v_reusite || E'\n  employee -> business_trips (deplasare proprie)';
  exception when others then
    v_esuate := v_esuate || format(E'\n  employee -> business_trips (deplasare proprie): %s (%s)', sqlerrm, sqlstate);
  end;
  reset role;

  -- ───────────────────────────────────────────────────────────────────────
  -- Pregătirea probelor rolului `employee`.
  --
  -- Rulează cu rolul sesiunii (fără `set local role`), ca fixture: scopul e să
  -- EXISTE rândurile peste care angajatul va încerca apoi să scrie, nu să
  -- dovedim că cineva le poate crea.
  -- ───────────────────────────────────────────────────────────────────────

  -- Un al doilea anunț: primul are deja o confirmare de citire în fixture, iar
  -- indexul unic ar face proba să pice pe duplicat în loc de permisiune.
  insert into public.announcements (organization_id, titlu, continut, publicat_la)
  values (v_alfa, 'Anunț (l) ' || left(v_rand, 6), 'Conținut.', now())
  returning id into v_anunt_nou;

  -- O linie de pontaj DEJA APROBATĂ. `attendance_entries_update` (0013:795) cere
  -- `approved_at is null` sau `attendance:approve` la prag `team` — pe care un
  -- angajat nu-l are. Fără rândul ăsta, capcana cea mai costisitoare a modulului
  -- (editarea după aprobare, refuzată TĂCUT) n-ar avea ce proba.
  insert into public.attendance_entries (organization_id, employee_id, data, ore_lucrate, tip_zi, approved_at)
  values (v_alfa, v_ang_alfa, current_date - 5, 8, 'lucratoare', now())
  returning id into v_pontaj_apr;

  -- Instanța proprie de checklist și un pas al cărui responsabil e chiar el.
  select id into v_inst_mea from public.checklist_instances
   where organization_id = v_alfa and employee_id = v_ang_alfa and deleted_at is null
   order by created_at limit 1;

  update public.checklist_instance_items
     set responsabil_employee_id = v_ang_alfa, responsabil_tip = 'angajat'
   where instance_id = v_inst_mea
     and id = (select id from public.checklist_instance_items
                where instance_id = v_inst_mea order by ordine limit 1)
  returning id into v_pas_meu;

  -- ───────────────────────────────────────────────────────────────────────
  -- Rolurile `hr` și `manager`, cu identitatea lor reală.
  --
  -- Fiecare pereche (rol, tabelă) de mai jos a fost stabilită EMPIRIC pe un
  -- Postgres 17 cu toate migrările aplicate, nu dedusă din seed: o sondă a
  -- încercat scrierea sub identitatea rolului și a înregistrat rezultatul.
  -- Cazurile REFUZATE sunt la fel de importante ca cele permise — fără ele, o
  -- politică `using (true)` ar trece verificarea.
  -- ───────────────────────────────────────────────────────────────────────
  for v_caz in
    select * from (values
      -- rol, eticheta, asteptat, sql
      ('hr',      'employees (fișă nouă)',            'PERMIS',
       'insert into public.employees (organization_id, marca, first_name, last_name, department_id) values ($1,''L-HR-'' || $5,''Test'',''HR'',$4)'),
      ('hr',      'departments (departament nou)',    'PERMIS',
       'insert into public.departments (organization_id, cod, denumire, activ, path, depth) values ($1,''L-HR-'' || $5,''Departament (l)'',true,''{}'',0)'),
      ('hr',      'attendance_entries (pontaj)',      'PERMIS',
       'insert into public.attendance_entries (organization_id, employee_id, data, ore_lucrate, tip_zi) values ($1,$3,current_date,8,''lucratoare'')'),
      ('hr',      'ssm_trainings (instruire)',        'PERMIS',
       'insert into public.ssm_trainings (organization_id, employee_id, training_type_id, data_instruirii, durata_ore, semnatura_confirmata) select $1,$3,tt.id,current_date - 10,2,true from public.ssm_training_types tt where tt.organization_id=$1 and tt.cod=''la_locul_de_munca'' and tt.deleted_at is null limit 1'),
      ('hr',      'inventory_items (obiect)',         'PERMIS',
       'insert into public.inventory_items (organization_id, denumire, numar_inventar) values ($1,''Obiect (l)'',''L-HR-'' || $5)'),
      -- hr administrează SSM, dar NU are niciun `vehicles:*` (capcana 18/26).
      ('hr',      'vehicles (fără drept)',            'REFUZAT',
       'insert into public.vehicles (organization_id, nr_inmatriculare, marca, model, created_by, updated_by) values ($1,''CJ'' || left($5,2) || ''SND'',''Dacia'',''Logan'',auth.uid(),auth.uid())'),
      -- Calea REALĂ de aprobare a managerului. Capcana 4 îi închide scrierea
      -- linie cu linie pe `attendance_entries` (are `approve`, nu `create`),
      -- dar LOTUL de aprobare trece prin `app.can(...,'attendance','approve',
      -- 'team')` — deci exact scope-ul lui. Dacă asta s-ar rupe, managerul n-ar
      -- mai putea aproba pontajul deloc, iar verificările (a)-(k) ar rămâne
      -- toate verzi. `linii_aprobate` NU se trimite: WITH CHECK îl cere 0.
      ('manager', 'attendance_approval_batches (lot)', 'PERMIS',
       'insert into public.attendance_approval_batches (organization_id, period_id) values ($1, (select p.id from public.attendance_periods p where p.organization_id=$1 and p.deleted_at is null order by p.created_at limit 1))'),
      -- Singura scriere pe care managerul o poate face în modulele active:
      -- `maintenance:create = all` îi deschide sesizarea de defect. Capcana 35
      -- avertizează că poarta BAZEI e mai largă decât cea a aplicației.
      ('manager', 'fault_reports (sesizare)',         'PERMIS',
       'insert into public.fault_reports (organization_id, equipment_id, descriere, urgenta) values ($1,$2,''Defect semnalat în (l)'',''medie'')'),
      -- Capcana 4: are attendance:approve=team, dar NU attendance:create.
      ('manager', 'attendance_entries (fără create)', 'REFUZAT',
       'insert into public.attendance_entries (organization_id, employee_id, data, ore_lucrate, tip_zi) values ($1,$3,current_date,8,''lucratoare'')'),
      -- employees:read=team, fără create.
      ('manager', 'employees (fără create)',          'REFUZAT',
       'insert into public.employees (organization_id, marca, first_name, last_name, department_id) values ($1,''L-MG-'' || $5,''Test'',''Manager'',$4)'),

      -- ── Rolul `employee` ─────────────────────────────────────────────────
      -- Portalul e acum SINGURA lui aplicație, deci fiecare scriere de mai jos
      -- e un ecran care fie funcționează, fie nu. Până acum, verificarea (l)
      -- acoperea pentru el două scrieri din toate modulele.

      -- Ramura `own` din `app.poate_scrie_pontaj` (0013:249). Ziua de azi e
      -- liberă: fixture-ul a pus `current_date - 1` pe seama lui org_admin.
      ('employee', 'attendance_entries (ziua proprie)',    'PERMIS',
       'insert into public.attendance_entries (organization_id, employee_id, data, ore_lucrate, tip_zi) values ($1,$6,current_date,8,''lucratoare'')'),

      -- Capcana tăcută a modulului: `attendance_entries_update` (0013:795) cere
      -- `approved_at is null`. Un UPDATE respins de `USING` NU aruncă — afectează
      -- zero rânduri și tace. De aceea ecranul de portal afișează zilele aprobate
      -- ca blocate, în loc să lase butonul activ.
      ('employee', 'attendance_entries (zi aprobată)',     'ZERO',
       'update public.attendance_entries set ore_lucrate = 9 where id = $7'),

      -- Capcana 28: coloana de scope e `raportat_de_employee_id` și e nullable.
      -- Scrisă explicit, rândul rămâne vizibil autorului. `returning` e esențial:
      -- sub o politică SELECT care ascunde rândul, INSERT-ul cade cu 42501.
      ('employee', 'fault_reports (sesizare proprie)',     'PERMIS',
       'insert into public.fault_reports (organization_id, equipment_id, raportat_de_employee_id, descriere, urgenta) values ($1,$2,$6,''Defect (l) angajat'',''medie'') returning id'),

      -- Aceeași inserare FĂRĂ raportor: `ssm_acces(...,null)` cade pe ramura care
      -- cere `team`, deci rândul devine invizibil autorului și `returning` pică.
      -- Contractul acțiunii `creeazaSesizare` se sprijină pe faptul ăsta.
      ('employee', 'fault_reports (fără raportor)',        'REFUZAT',
       'insert into public.fault_reports (organization_id, equipment_id, descriere, urgenta) values ($1,$2,''Defect (l) anonim'',''medie'') returning id'),

      -- Confirmarea de primire: `inventory_allocations_update` (0010:716) are
      -- ramură `own` reală, dar cere și `updated_by = auth.uid()`.
      ('employee', 'inventory_allocations (confirmare)',   'PERMIS_RAND',
       'update public.inventory_allocations set confirmat_de_angajat_la = now(), updated_by = auth.uid() where organization_id = $1 and employee_id = $6 and returnat_la is null'),

      -- `announcement_reads_insert` (0028:118) cere fișă principală ȘI
      -- `user_id = auth.uid()`. Un membru fără fișă primește 42501.
      ('employee', 'announcement_reads (confirmare)',      'PERMIS',
       'insert into public.announcement_reads (organization_id, announcement_id, employee_id, user_id) values ($1,$8,$6,auth.uid())'),

      -- Bifează pasul al cărui responsabil e chiar el (0014:865).
      ('employee', 'checklist_instance_items (pasul meu)', 'PERMIS_RAND',
       'update public.checklist_instance_items set status = ''bifat'' where id = $9'),

      -- Dar NU un pas al altcuiva: ramura `own` compară cu
      -- `responsabil_employee_id`, nu cu `employee_id`. De aceea ecranul de
      -- portal oferă control DOAR pe pașii lui, iar restul se văd fără buton.
      ('employee', 'checklist_instance_items (pas străin)','ZERO',
       'update public.checklist_instance_items set status = ''bifat'' where instance_id = $10 and id <> $9'),

      -- Seed-ul îi dă `checklists:update = own`, dar `checklist_instances_update`
      -- (0014:802) NU are ramură `own` — doar `all` sau `team`. Dreptul există în
      -- matrice și nu are corespondent în politică: scrierea cade tăcut, la zero
      -- rânduri. Proba consemnează starea reală; dacă cineva adaugă ramura,
      -- testul devine roșu și îl obligă să treacă cazul pe PERMIS_RAND.
      ('employee', 'checklist_instances (instanța mea)',   'ZERO',
       'update public.checklist_instances set observatii = ''note (l)'' where id = $10'),

      -- Tichetele IT, acordate de 0046. `returning` prinde din nou capcana 28.
      ('employee', 'tickets (cerere IT proprie)',          'PERMIS',
       'insert into public.tickets (organization_id, solicitant_employee_id, tip, titlu, descriere, modul, pasi_efectuati, rezultat_asteptat, rezultat_obtinut) values ($1,$6,''bug_erp'',''Tichet (l)'',''Descriere.'',''Portal'',''Am apăsat.'',''Se salvează.'',''Nu se salvează.'') returning id'),

      -- Fișa unui coleg rămâne inaccesibilă: `employees:read = own` compară pe
      -- `user_id`, nu pe apartenență.
      ('employee', 'employees (fișa altui coleg)',         'ZERO',
       'update public.employees set observatii = ''(l)'' where organization_id = $1 and id = $3')
    ) as t(rol, eticheta, asteptat, sql)
  loop
    -- Ramura `employee` NU e opțională. Fără ea, orice caz marcat „employee" ar
    -- rula sub identitatea lui `hr` — care are `all` pe aproape tot — și ar
    -- trece. Testul ar fi verde, iar dovada zero: exact felul de fals-pozitiv pe
    -- care poarta asta există ca să-l facă imposibil.
    perform set_config('request.jwt.claim.sub',
      (case v_caz.rol
         when 'manager'  then v_mgr_user
         when 'employee' then v_emp_user
         else v_hr_user
       end)::text, true);
    set local role authenticated;
    begin
      execute v_caz.sql using v_alfa, v_equip, v_sub_alfa, v_dep_alfa, left(v_rand, 6),
                              v_ang_alfa, v_pontaj_apr, v_anunt_nou, v_pas_meu, v_inst_mea;
      get diagnostics v_randuri = row_count;

      -- Patru feluri de așteptare, nu două. Un UPDATE respins de clauza `USING`
      -- NU aruncă: afectează zero rânduri și tace. Un `exception when others`
      -- nu-l prinde niciodată, deci fără ramurile ZERO și PERMIS_RAND, cea mai
      -- răspândită capcană tăcută a schemei ar rămâne în afara testului.
      case v_caz.asteptat
        when 'PERMIS' then
          v_reusite := v_reusite || format(E'\n  %s -> %s', v_caz.rol, v_caz.eticheta);
        when 'PERMIS_RAND' then
          if v_randuri > 0 then
            v_reusite := v_reusite || format(E'\n  %s -> %s (%s rânduri)', v_caz.rol, v_caz.eticheta, v_randuri);
          else
            v_esuate := v_esuate || format(
              E'\n  %s -> %s: ZERO rânduri, fără eroare — politica a respins tăcut o scriere legitimă',
              v_caz.rol, v_caz.eticheta);
          end if;
        when 'ZERO' then
          if v_randuri = 0 then
            v_reusite := v_reusite || format(E'\n  %s -> %s: zero rânduri, ca așteptat', v_caz.rol, v_caz.eticheta);
          else
            v_scapate := v_scapate || format(
              E'\n  %s -> %s: a afectat %s rânduri, deși politica trebuia să-l oprească',
              v_caz.rol, v_caz.eticheta, v_randuri);
          end if;
        else
          v_scapate := v_scapate || format(E'\n  %s -> %s: scrierea a REUȘIT, deși trebuia refuzată', v_caz.rol, v_caz.eticheta);
      end case;
    exception when others then
      if v_caz.asteptat in ('PERMIS', 'PERMIS_RAND', 'ZERO') then
        v_esuate := v_esuate || format(E'\n  %s -> %s: %s (%s)', v_caz.rol, v_caz.eticheta, sqlerrm, sqlstate);
      else
        v_reusite := v_reusite || format(E'\n  %s -> %s: refuzat corect (%s)', v_caz.rol, v_caz.eticheta, sqlstate);
      end if;
    end;
    reset role;
  end loop;

  -- ───────────────────────────────────────────────────────────────────────
  -- Rolul `super_admin` și aprobarea pe echipă a managerului.
  -- ───────────────────────────────────────────────────────────────────────
  insert into auth.users (id, email) values (v_sa_user, 'platforma-' || left(v_rand, 8) || '@test.test');
  insert into public.profiles (id, email, full_name)
  values (v_sa_user, 'platforma-' || left(v_rand, 8) || '@test.test', 'Administrator de platformă')
  on conflict (id) do nothing;
  insert into public.platform_admins (user_id) values (v_sa_user);

  -- Foaia de parcurs a subordonatului, COMPLETĂ: triggerul de flotă cere ora și
  -- kilometrajul de sosire înainte de aprobare (P0001). Fără ele, proba ar fi
  -- picat pe o regulă de business și ar fi părut un refuz de permisiune.
  select id into v_veh_sub from public.vehicles
   where organization_id = v_alfa and deleted_at is null limit 1;
  insert into public.trip_sheets (organization_id, vehicle_id, employee_id,
                                  plecare_la, km_plecare, sosire_la, km_sosire, status)
  values (v_alfa, v_veh_sub, v_sub_alfa, now() - interval '2 hours', 1000,
          now() - interval '1 hour', 1120, 'trimis')
  returning id into v_foaie_sub;

  -- 1) `super_admin` comută un modul. `org_admin` are doar `features:read`,
  --    deci ecranul de module e exclusiv al platformei.
  perform set_config('request.jwt.claim.sub', v_sa_user::text, true);
  set local role authenticated;
  begin
    insert into public.organization_features (organization_id, feature_key, enabled)
    values (v_alfa, 'evaluations', true);
    v_reusite := v_reusite || E'\n  super_admin -> organization_features (comută un modul)';
  exception when others then
    v_esuate := v_esuate || format(E'\n  super_admin -> organization_features: %s (%s)', sqlerrm, sqlstate);
  end;
  reset role;

  -- 2) `super_admin` scrie o coloană rezervată platformei. Verificarea (k)
  --    demonstrează că `org_admin` NU poate; asta demonstrează reversul —
  --    altfel garda ar putea fi închisă pentru toată lumea, iar (k) ar trece
  --    exact la fel.
  perform set_config('request.jwt.claim.sub', v_sa_user::text, true);
  set local role authenticated;
  begin
    update public.organizations set seats_limit = 99 where id = v_alfa;
    get diagnostics v_randuri = row_count;
    if v_randuri = 0 then
      raise exception using errcode = 'P0001', message = 'zero rânduri afectate';
    end if;
    v_reusite := v_reusite || E'\n  super_admin -> organizations.seats_limit (coloană de platformă)';
  exception when others then
    v_esuate := v_esuate || format(E'\n  super_admin -> organizations.seats_limit: %s (%s)', sqlerrm, sqlstate);
  end;
  reset role;

  -- 3) Managerul aprobă foaia de parcurs a subordonatului SĂU. Cu
  --    `trip_sheets:approve = team`, ramura a doua din `foi_update` se închide
  --    prin `app.is_manager_of` — deci exact lanțul manager → subordonat.
  perform set_config('request.jwt.claim.sub', v_mgr_user::text, true);
  set local role authenticated;
  begin
    update public.trip_sheets set status = 'aprobat' where id = v_foaie_sub;
    get diagnostics v_randuri = row_count;
    if v_randuri = 0 then
      raise exception using errcode = 'P0001',
        message = 'zero rânduri — refuz TĂCUT al politicii, exact capcana 17';
    end if;
    v_reusite := v_reusite || E'\n  manager -> trip_sheets (aprobă foaia subordonatului)';
  exception when others then
    v_esuate := v_esuate || format(E'\n  manager -> trip_sheets (foaia subordonatului): %s (%s)', sqlerrm, sqlstate);
  end;
  reset role;

  if v_scapate <> '' then
    perform pg_temp.esueaza(format(
      E'(l) SCRIERI CARE TREBUIAU REFUZATE AU TRECUT — gaură de permisiuni:%s', v_scapate));
  end if;

  if v_reusite <> '' then
    raise notice '(l) scrieri reușite:%', v_reusite;
  end if;

  if v_esuate <> '' then
    perform pg_temp.esueaza(format(
      E'(l) SCRIERI LEGITIME RESPINSE — defect real în politică sau trigger, nu în test:%s', v_esuate));
  end if;

  raise notice '(l) toate cele CINCI roluri (super_admin, org_admin, hr, manager, employee) pot scrie ce au voie și SUNT refuzate unde nu au ✓';
end $$;

rollback;

\echo ''
\echo '════════════════════════════════════════════════════════'
\echo ' IZOLAREA ÎNTRE TENANȚI: toate verificările au trecut.'
\echo '════════════════════════════════════════════════════════'
