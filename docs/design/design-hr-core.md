## Preambul

**Funcții helper presupuse** (definite în modulul de nucleu, `SECURITY DEFINER`, `search_path=''`): `is_super_admin()`, `is_org_member(org uuid)`, `has_perm(org uuid, cod text)` (citește `role_permissions`), `current_profile_id()`, `current_employee_id(org uuid)`, `team_subtree(manager_employee_id uuid)` (vezi punctul b). Fiecare tabelă are în plus o politică `FOR ALL USING (is_super_admin())`. Nicio tabelă nu are politică `DELETE` — ștergerea se face prin `UPDATE deleted_at`; `REVOKE DELETE ON <tabela> FROM authenticated` întărește regula la nivel de privilegiu.

**Enum-uri Postgres introduse:**
- `contract_type`: `cim_nedeterminat`, `cim_determinat`, `part_time`, `contract_management`, `ucenicie`, `internship`, `zilier`, `conventie_civila`
- `employee_status`: `activ`, `suspendat`, `in_preaviz`, `inactiv`, `arhivat`
- `contract_doc_type`: `contract_initial`, `act_aditional`, `decizie_suspendare`, `decizie_reluare`, `decizie_incetare`
- `termination_reason`: `art55_acord`, `art56_de_drept`, `art61_disciplinar`, `art65_desfiintare_post`, `art81_demisie`, `perioada_proba`, `expirare_termen`, `altele`
- `employee_doc_type`: `ci`, `pasaport`, `permis_conducere`, `diploma`, `certificat_calificare`, `fisa_aptitudine`, `cazier`, `adeverinta`, `cv`, `contract_semnat`, `alt_document`
- `change_request_status`: `in_asteptare`, `aprobat`, `respins`, `anulat`

---

### departments
scop: Structura organizatorică ierarhică a unei firme-client.
coloane:
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  parent_id uuid NULL FK->departments(id) RESTRICT
  cod text NOT NULL
  nume text NOT NULL
  descriere text NULL
  manager_id uuid NULL FK->employees(id) RESTRICT
  cost_center text NULL
  depth int NOT NULL DEFAULT 0
  path uuid[] NOT NULL DEFAULT '{}'
  is_active boolean NOT NULL DEFAULT true
constrangeri: UNIQUE(organization_id, cod) WHERE deleted_at IS NULL; CHECK(parent_id IS NULL OR parent_id <> id); CHECK(depth BETWEEN 0 AND 12); trigger `trg_departments_no_cycle` (vezi a) care validează ciclul + recalculează `depth`/`path` și le propagă la subarbore; trigger care impune `parent.organization_id = organization_id` și `manager.organization_id = organization_id`
indexuri: (organization_id, parent_id) WHERE deleted_at IS NULL; (organization_id, cod) WHERE deleted_at IS NULL; GIN(path)
rls: SELECT = is_org_member(organization_id); INSERT/UPDATE = has_perm(organization_id,'hr.departments.write'); DELETE = fără politică
nota: FK circular cu `employees` (departments.manager_id -> employees, employees.department_id -> departments). În migrare creezi ambele tabele fără acest FK și adaugi `ALTER TABLE departments ADD CONSTRAINT ... DEFERRABLE INITIALLY DEFERRED` la final, ca seed-ul să poată insera într-o singură tranzacție.

### job_positions
scop: Nomenclator de funcții per organizație, cu cod COR opțional pentru REVISAL.
coloane:
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  cod text NOT NULL
  denumire text NOT NULL
  cod_cor text NULL
  department_id uuid NULL FK->departments(id) RESTRICT
  nivel_ierarhic int NULL
  descriere text NULL
  is_active boolean NOT NULL DEFAULT true
constrangeri: UNIQUE(organization_id, cod) WHERE deleted_at IS NULL; CHECK(cod_cor IS NULL OR cod_cor ~ '^[0-9]{6}$'); CHECK(nivel_ierarhic IS NULL OR nivel_ierarhic BETWEEN 1 AND 10)
indexuri: (organization_id, is_active) WHERE deleted_at IS NULL; (organization_id, cod_cor) WHERE deleted_at IS NULL
rls: SELECT = is_org_member(organization_id); INSERT/UPDATE = has_perm(organization_id,'hr.positions.write'); DELETE = fără politică
nota: codul COR nu se validează cu o listă hardcodată; dacă e nevoie de validare, se face contra unei tabele de configurare `cor_codes` cu `valabil_de_la`.

### employees
scop: Dosarul de bază al unui angajat, fără date sensibile (CNP/IBAN stau separat).
coloane:
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  user_id uuid NULL FK->profiles(id) RESTRICT
  marca text NOT NULL
  nume text NOT NULL
  prenume text NOT NULL
  initiala_tatalui text NULL
  email_personal citext NULL
  email_serviciu citext NULL
  telefon text NULL
  adresa_strada text NULL
  adresa_oras text NULL
  adresa_judet text NULL
  adresa_cod_postal text NULL
  adresa_tara text NOT NULL DEFAULT 'RO'
  data_nasterii date NULL
  job_position_id uuid NULL FK->job_positions(id) RESTRICT
  department_id uuid NULL FK->departments(id) RESTRICT
  manager_id uuid NULL FK->employees(id) RESTRICT
  manager_path uuid[] NOT NULL DEFAULT '{}'
  data_angajarii date NOT NULL
  data_incetarii date NULL
  tip_contract contract_type NOT NULL DEFAULT 'cim_nedeterminat'
  norma_ore_zi numeric(4,2) NOT NULL DEFAULT 8
  salariu_baza numeric(14,2) NOT NULL DEFAULT 0
  contact_urgenta_nume text NULL
  contact_urgenta_telefon text NULL
  contact_urgenta_relatie text NULL
  status employee_status NOT NULL DEFAULT 'activ'
  avatar_path text NULL
  observatii text NULL
  anonimizat_la timestamptz NULL
constrangeri: UNIQUE(organization_id, marca) WHERE deleted_at IS NULL; UNIQUE(organization_id, user_id) WHERE user_id IS NOT NULL AND deleted_at IS NULL; CHECK(manager_id <> id); CHECK(data_incetarii IS NULL OR data_incetarii >= data_angajarii); CHECK(norma_ore_zi > 0 AND norma_ore_zi <= 24); CHECK(salariu_baza >= 0); CHECK(data_incetarii IS NULL OR status IN ('inactiv','arhivat')); CHECK(data_nasterii IS NULL OR data_nasterii < CURRENT_DATE - INTERVAL '15 years'); trigger `trg_employees_no_manager_cycle` (vezi a) + trigger care impune apartenența la aceeași organizație pentru manager/department/job_position
indexuri: (organization_id, status) WHERE deleted_at IS NULL; (organization_id, department_id) WHERE deleted_at IS NULL; (organization_id, manager_id) WHERE deleted_at IS NULL; UNIQUE(user_id, organization_id) partial (de mai sus); GIN(manager_path); GIN to_tsvector('simple', nume||' '||prenume||' '||marca) pentru căutare
rls: SELECT = is_org_member(organization_id) AND (has_perm(organization_id,'hr.employees.read_all') OR id = current_employee_id(organization_id) OR id = ANY(team_subtree(current_employee_id(organization_id)))); INSERT/UPDATE = has_perm(organization_id,'hr.employees.write'); DELETE = fără politică
nota: `salariu_baza` nu poate fi protejat de RLS (RLS e pe linii, nu pe coloane). Se folosesc privilegii de coloană: `REVOKE SELECT ON employees FROM authenticated; GRANT SELECT (lista_fara_salariu_baza) ON employees TO authenticated;` iar salariul se citește exclusiv prin RPC `hr_read_salary(employee_id)` cu `has_perm(...,'hr.salary.read')`. Angajatul NU are UPDATE direct pe propriul rând — își cere modificările prin `employee_change_requests`.

### employee_sensitive_data
scop: CNP și IBAN criptate aplicativ AES-256-GCM, 1:1 cu angajatul, inaccesibile prin SELECT direct.
coloane:
  employee_id uuid PK FK->employees(id) RESTRICT
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  cnp_ciphertext bytea NULL
  cnp_iv bytea NULL
  cnp_auth_tag bytea NULL
  cnp_last4 text NULL
  cnp_hash bytea NULL
  iban_ciphertext bytea NULL
  iban_iv bytea NULL
  iban_auth_tag bytea NULL
  iban_last4 text NULL
  iban_banca text NULL
  key_version int NOT NULL DEFAULT 1
  rotated_at timestamptz NULL
constrangeri: UNIQUE(organization_id, cnp_hash) WHERE cnp_hash IS NOT NULL AND deleted_at IS NULL; CHECK(octet_length(cnp_iv) = 12 AND octet_length(cnp_auth_tag) = 16); CHECK(octet_length(iban_iv) = 12 AND octet_length(iban_auth_tag) = 16); CHECK(cnp_last4 ~ '^[0-9]{4}$'); CHECK(octet_length(cnp_hash) = 32); CHECK((cnp_ciphertext IS NULL) = (cnp_iv IS NULL)); CHECK(key_version > 0)
indexuri: (organization_id, key_version) — pentru joburile de rotație a cheii; UNIQUE de mai sus acoperă deduplicarea
rls: SELECT = **nicio politică** (deny by default pentru `authenticated`, plus `REVOKE ALL ... FROM authenticated, anon`); INSERT/UPDATE = nicio politică; DELETE = nicio politică. Accesul se face doar prin funcții `SECURITY DEFINER` (`hr_read_sensitive`, `hr_write_sensitive`) care verifică `has_perm(org,'hr.sensitive.read'/'hr.sensitive.write')` și scriu în `audit_logs`.
nota: `cnp_hash` NU e SHA256(cnp) simplu — spațiul CNP-urilor e enumerabil (~10^13, brute-force banal). Este `HMAC-SHA256(cnp, pepper_din_env)`, calculat în Node, cu pepper distinct de cheia de criptare și NEROTIT (rotația lui invalidează deduplicarea). Unicitatea e per organizație, nu globală: aceeași persoană poate fi angajat la două firme-client.

### employment_contracts
scop: Contractul individual de muncă și toate actele adiționale/deciziile care îl modifică, ca istoric imuabil.
coloane:
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  employee_id uuid NOT NULL FK->employees(id) RESTRICT
  parent_contract_id uuid NULL FK->employment_contracts(id) RESTRICT
  tip contract_doc_type NOT NULL DEFAULT 'contract_initial'
  numar text NOT NULL
  data_document date NOT NULL
  valabil_de_la date NOT NULL
  valabil_pana date NULL
  tip_contract contract_type NOT NULL
  job_position_id uuid NULL FK->job_positions(id) RESTRICT
  department_id uuid NULL FK->departments(id) RESTRICT
  salariu_baza numeric(14,2) NOT NULL
  norma_ore_zi numeric(4,2) NOT NULL DEFAULT 8
  zile_concediu_an int NULL
  perioada_proba_zile int NULL
  motiv_incetare termination_reason NULL
  storage_bucket text NOT NULL DEFAULT 'hr-contracts'
  storage_path text NULL
  revisal_transmis_la timestamptz NULL
  is_current boolean NOT NULL DEFAULT false
constrangeri: UNIQUE(organization_id, employee_id, tip, numar) WHERE deleted_at IS NULL; CHECK(valabil_pana IS NULL OR valabil_pana >= valabil_de_la); CHECK(salariu_baza >= 0); CHECK(norma_ore_zi > 0 AND norma_ore_zi <= 24); CHECK(tip = 'contract_initial' OR parent_contract_id IS NOT NULL); CHECK(tip <> 'decizie_incetare' OR motiv_incetare IS NOT NULL); CHECK(tip_contract <> 'cim_determinat' OR valabil_pana IS NOT NULL); EXCLUDE USING gist (employee_id WITH =, daterange(valabil_de_la, COALESCE(valabil_pana,'infinity'::date), '[]') WITH &&) WHERE (tip = 'contract_initial' AND deleted_at IS NULL) — necesită `btree_gist`; UNIQUE(employee_id) WHERE is_current AND deleted_at IS NULL
indexuri: (organization_id, employee_id, valabil_de_la DESC) WHERE deleted_at IS NULL; (organization_id, valabil_pana) WHERE valabil_pana IS NOT NULL AND deleted_at IS NULL — pentru alerte de expirare CIM determinat / perioadă de probă
rls: SELECT = is_org_member(organization_id) AND (has_perm(organization_id,'hr.contracts.read_all') OR employee_id = current_employee_id(organization_id)); INSERT/UPDATE = has_perm(organization_id,'hr.contracts.write'); DELETE = fără politică
nota: `employees.salariu_baza`/`norma_ore_zi` sunt cache pentru contractul curent — un trigger `AFTER INSERT/UPDATE` pe contracte cu `is_current = true` le sincronizează. Sursa de adevăr pentru orice calcul retroactiv (pontaj, salarizare) e contractul valabil la data respectivă, nu câmpul de pe `employees`.

### employee_documents
scop: Documentele din dosarul personal, stocate în Supabase Storage, cu valabilitate și marcaj de confidențialitate.
coloane:
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  employee_id uuid NOT NULL FK->employees(id) RESTRICT
  tip employee_doc_type NOT NULL
  titlu text NOT NULL
  numar_document text NULL
  storage_bucket text NOT NULL DEFAULT 'hr-documents'
  storage_path text NOT NULL
  mime_type text NOT NULL
  marime_bytes bigint NOT NULL
  checksum_sha256 text NULL
  valabil_de_la date NULL
  expira_la date NULL
  confidential boolean NOT NULL DEFAULT false
  vizibil_angajatului boolean NOT NULL DEFAULT true
  uploaded_by uuid NOT NULL FK->profiles(id) RESTRICT
  retentie_pana date NULL
constrangeri: UNIQUE(storage_bucket, storage_path); CHECK(expira_la IS NULL OR valabil_de_la IS NULL OR expira_la >= valabil_de_la); CHECK(marime_bytes > 0 AND marime_bytes <= 26214400); CHECK(mime_type IN ('application/pdf','image/jpeg','image/png','image/webp')); CHECK(NOT confidential OR NOT vizibil_angajatului OR tip <> 'cazier')
indexuri: (organization_id, employee_id, tip) WHERE deleted_at IS NULL; (organization_id, expira_la) WHERE expira_la IS NOT NULL AND deleted_at IS NULL
rls: SELECT = is_org_member(organization_id) AND (has_perm(organization_id,'hr.documents.read_all') OR (employee_id = current_employee_id(organization_id) AND vizibil_angajatului AND NOT confidential)); INSERT = has_perm(organization_id,'hr.documents.write') AND uploaded_by = current_profile_id(); UPDATE = has_perm(organization_id,'hr.documents.write'); DELETE = fără politică
nota: `storage_path` are formă impusă `{organization_id}/{employee_id}/{uuid}.{ext}` — politicile RLS pe `storage.objects` extrag `organization_id` din `(storage.foldername(name))[1]` și verifică apartenența. Bucket-ul e privat; livrarea se face doar prin signed URL cu TTL de 60s, generat într-o Server Action care logează accesul.

### employee_change_requests
scop: Cereri de modificare a datelor proprii, inițiate de angajat și aprobate de HR (angajatul nu are UPDATE direct pe `employees`).
coloane:
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  employee_id uuid NOT NULL FK->employees(id) RESTRICT
  requested_by uuid NOT NULL FK->profiles(id) RESTRICT
  campuri_propuse jsonb NOT NULL
  campuri_curente jsonb NOT NULL
  motiv text NULL
  document_id uuid NULL FK->employee_documents(id) RESTRICT
  status change_request_status NOT NULL DEFAULT 'in_asteptare'
  reviewed_by uuid NULL FK->profiles(id) RESTRICT
  reviewed_at timestamptz NULL
  motiv_respingere text NULL
  applied_at timestamptz NULL
constrangeri: CHECK(jsonb_typeof(campuri_propuse) = 'object' AND campuri_propuse <> '{}'::jsonb); CHECK(NOT (campuri_propuse ?| ARRAY['salariu_baza','marca','status','data_angajarii','data_incetarii','manager_id','department_id','job_position_id','organization_id','user_id','tip_contract'])) — lista albă efectivă e ținută în `hr_self_editable_fields` (tabelă de configurare), CHECK-ul e doar plasa de siguranță; CHECK(status <> 'respins' OR motiv_respingere IS NOT NULL); CHECK(status IN ('in_asteptare') OR reviewed_by IS NOT NULL); CHECK(status <> 'aprobat' OR applied_at IS NOT NULL); UNIQUE(employee_id) WHERE status = 'in_asteptare' AND deleted_at IS NULL
indexuri: (organization_id, status, created_at DESC) WHERE deleted_at IS NULL; (organization_id, employee_id) WHERE deleted_at IS NULL
rls: SELECT = is_org_member(organization_id) AND (has_perm(organization_id,'hr.change_requests.review') OR employee_id = current_employee_id(organization_id)); INSERT = employee_id = current_employee_id(organization_id) AND requested_by = current_profile_id() AND status = 'in_asteptare'; UPDATE = has_perm(organization_id,'hr.change_requests.review') OR (employee_id = current_employee_id(organization_id) AND status = 'in_asteptare' — doar pentru anulare); DELETE = fără politică
nota: aplicarea cererii NU se face din UPDATE-ul de status, ci într-o Server Action tranzacțională care validează Zod pe câmpurile albe, scrie `employees`, setează `applied_at` și inserează în `audit_logs`. `campuri_curente` e snapshot la momentul cererii — dacă valorile curente diferă la aprobare, cererea se marchează conflictuală și HR revalidează.

---

## (a) Prevenirea ciclurilor — trigger, nu CHECK

Un `CHECK` nu poate interoga alte rânduri, deci e imposibil. Aceeași funcție servește ambele ierarhii (departamente și manageri), pentru că problema e identică: urcă spre rădăcină și verifică dacă întâlnești rândul curent.

```sql
create or replace function hr_assert_no_cycle()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_parent uuid;
  v_path uuid[] := '{}';
  v_col text := tg_argv[0];   -- 'parent_id' sau 'manager_id'
  v_tbl text := tg_table_name;
begin
  execute format('select ($1).%I', v_col) into v_parent using new;
  while v_parent is not null loop
    if v_parent = new.id then
      raise exception 'Ciclu detectat in ierarhia %.% (id=%)', v_tbl, v_col, new.id
        using errcode = '23514';
    end if;
    if array_length(v_path, 1) > 32 then
      raise exception 'Ierarhie prea adanca sau ciclu preexistent' using errcode = '23514';
    end if;
    v_path := v_path || v_parent;
    execute format('select %I from public.%I where id = $1 and deleted_at is null', v_col, v_tbl)
      into v_parent using v_path[array_length(v_path,1)];
  end loop;
  -- materializam calea (radacina -> parinte direct) pentru scope rapid
  if v_tbl = 'departments' then
    new.path := (select array_agg(x) from unnest(v_path) with ordinality t(x,o) order by o desc);
    new.depth := coalesce(array_length(v_path,1), 0);
  else
    new.manager_path := (select array_agg(x) from unnest(v_path) with ordinality t(x,o) order by o desc);
  end if;
  return new;
end $$;

create trigger trg_departments_no_cycle
  before insert or update of parent_id on departments
  for each row execute function hr_assert_no_cycle('parent_id');

create trigger trg_employees_no_manager_cycle
  before insert or update of manager_id on employees
  for each row execute function hr_assert_no_cycle('manager_id');
```

Când se schimbă părintele unui nod cu descendenți, un trigger `AFTER UPDATE` reface `path`/`manager_path` pe subarbore printr-un singur `UPDATE ... FROM` recursiv. Blocarea se face pe rândul părinte (`SELECT ... FOR UPDATE`) ca două reparentări concurente să nu creeze un ciclu care trece de ambele verificări.

## (b) Recursive CTE pentru subarborele unui manager (scope "team")

```sql
create or replace function team_subtree(p_manager_id uuid, p_include_self boolean default false)
returns uuid[] language sql stable security definer set search_path = '' as $$
  with recursive subtree as (
    select e.id, e.organization_id, 0 as nivel
      from public.employees e
     where e.id = p_manager_id
       and e.deleted_at is null
    union all
    select c.id, c.organization_id, s.nivel + 1
      from public.employees c
      join subtree s
        on c.manager_id = s.id
       and c.organization_id = s.organization_id   -- nu traversam niciodata granita de tenant
     where c.deleted_at is null
       and s.nivel < 32
  )
  select coalesce(array_agg(id), '{}'::uuid[])
    from subtree
   where p_include_self or id <> p_manager_id;
$$;
```

Pentru interogări mari, alternativa fără recursie folosește coloana materializată: `where e.manager_path @> array[p_manager_id]` (index GIN). CTE-ul rămâne sursa de adevăr; `manager_path` e cache-ul, refăcut de trigger. `p_manager_id` NULL întoarce `'{}'`, deci un utilizator fără fișă de angajat nu vede pe nimeni.

## (c) Legătura employee ↔ profile, invitația ulterioară, unicitatea

Fișa de angajat există independent de cont: HR creează `employees` cu `user_id = NULL` (majoritatea angajaților de teren nu vor avea niciodată cont). Invitația ulterioară:

1. Server Action `inviteEmployee(employeeId)` → verifică `has_perm(org,'hr.employees.invite')` și `employees.user_id IS NULL`.
2. Caută `profiles` după email (`email_serviciu`, altfel `email_personal`). Dacă nu există, `supabase.auth.admin.inviteUserByEmail()` (service_role, doar server) creează utilizatorul; trigger-ul pe `auth.users` creează `profiles`.
3. Într-o singură tranzacție: `UPDATE employees SET user_id = $profile` **și** `INSERT INTO organization_members (organization_id, user_id, role) VALUES (..., 'employee')`. Legarea fără membership înseamnă un angajat care nu trece de RLS — cele două se fac împreună sau deloc.
4. Dacă profilul aparține deja altei organizații, nu se creează cont nou: același `user_id` primește un al doilea rând în `organization_members`. Comutatorul de organizație din topbar îl vede pe amândouă.

Unicitatea e garantată de `UNIQUE(organization_id, user_id) WHERE user_id IS NOT NULL AND deleted_at IS NULL`. Este exact perechea corectă: același `user_id` poate fi legat de fișe diferite în organizații diferite, dar niciodată de două fișe în aceeași organizație. `NULL`-urile nu intră în index, deci mii de angajați fără cont coexistă. `current_employee_id(org)` face `SELECT id FROM employees WHERE organization_id = org AND user_id = auth.uid() AND deleted_at IS NULL` — cu acest index, întoarce garantat cel mult un rând, deci nu poate deveni ambiguu. Delegarea se face prin `RESTRICT` pe FK: un profil nu se poate șterge cât timp e legat de o fișă; la plecare se face `UPDATE employees SET user_id = NULL` + dezactivarea membership-ului, ca fișa să rămână în istoric fără cont activ.

## (d) Audit la fiecare CITIRE a CNP-ului

Postgres nu are trigger pe SELECT, deci soluția e să faci imposibil SELECT-ul direct și să treci obligatoriu printr-o funcție care scrie auditul în aceeași tranzacție:

1. `REVOKE ALL ON employee_sensitive_data FROM authenticated, anon;` + RLS activ **fără nicio politică** → chiar dacă cineva ajunge la PostgREST cu JWT de utilizator, tabela e invizibilă.
2. Singura poartă: `hr_read_sensitive(p_employee_id uuid, p_camp text, p_motiv text)`, `SECURITY DEFINER`, `search_path = ''`. Ea (a) verifică `has_perm(org,'hr.sensitive.read')`, (b) inserează în `audit_logs` (`action='sensitive.read'`, `entity='employee_sensitive_data'`, `entity_id`, `actor_user_id=auth.uid()`, `metadata = {camp, motiv, ip, user_agent}` transmise prin `set_config('request.headers',...)`), (c) abia apoi returnează `ciphertext/iv/auth_tag/key_version`. Dacă INSERT-ul de audit eșuează, tranzacția face rollback și cheia nu iese — auditul nu poate fi ocolit prin construcție, nu prin disciplină.
3. Decriptarea se face în Node, în Server Action, niciodată în SQL — baza de date nu vede vreodată textul clar și nici cheia.
4. Ecranele care au nevoie doar de afișare folosesc `cnp_last4` de pe rândul propriu-zis (expus printr-o vizualizare `employees_safe`), care nu declanșează audit. Auditul se plătește doar pentru valoarea completă.
5. Extrasele în masă (state de plată, D112, REVISAL) folosesc `hr_read_sensitive_bulk(uuid[])` care scrie **un rând de audit per angajat**, plus unul de tip `sensitive.bulk_export` cu numărul de înregistrări și scopul. Un job pg_cron ridică alertă când un utilizator depășește un prag zilnic de citiri.
6. `service_role` ocolește RLS prin definiție — de aceea cheia service_role nu apare niciodată în cod client, iar Edge Functions care o folosesc apelează tot `hr_read_sensitive`, nu tabela.

## (e) Modulul TypeScript de criptare

Fișier: `src/lib/security/sensitive-crypto.ts`, cu `import "server-only";` pe prima linie — orice import accidental dintr-un Client Component rupe build-ul. Cheile se citesc exclusiv din `src/lib/env.ts` (schemă Zod validată la import).

```ts
import "server-only";

export type EncryptedField = {
  readonly ciphertext: Buffer;
  readonly iv: Buffer;        // 12 bytes, aleator per operatie
  readonly authTag: Buffer;   // 16 bytes
  readonly keyVersion: number;
};

export function encryptSensitive(plaintext: string, aad: string): EncryptedField;
export function decryptSensitive(field: EncryptedField, aad: string): string;
export function hashCnp(cnp: string): Buffer;              // HMAC-SHA256 cu pepper
export function maskLast4(value: string): string;
export function activeKeyVersion(): number;
export function rotateField(field: EncryptedField, aad: string): EncryptedField;
```

- Algoritm `aes-256-gcm` din `node:crypto`. `aad` = `${organizationId}:${employeeId}:${camp}` — leagă criptotextul de rândul lui, deci mutarea unui blob între angajați sau între tenanți dă eroare de autentificare, nu date greșite.
- Toate funcțiile sunt pure și întorc obiecte noi; `EncryptedField` e `readonly`, nu se mută nimic în loc.
- **Rotația cheii**: `HR_ENCRYPTION_KEYS` este JSON `{"1":"<base64 32B>","2":"<base64 32B>"}`, iar `HR_ENCRYPTION_ACTIVE_KEY_VERSION=2`. Decriptarea alege cheia după `key_version` din rând; criptarea folosește mereu versiunea activă. La rotație se adaugă cheia nouă, se comută versiunea activă, apoi un job (Edge Function + pg_cron, loturi de ~500) rulează `rotateField` pe rândurile cu `key_version < activ`, actualizând `key_version` și `rotated_at`. Cheia veche se scoate din env doar după ce `select count(*) from employee_sensitive_data where key_version = <veche>` e 0.
- **Boot fără cheie**: `env.ts` validează cu Zod (cheie base64 de fix 32 bytes, versiunea activă prezentă în obiect, pepper de minim 32 bytes) și aruncă la import. Procesul moare la pornire cu mesaj explicit, nu la prima citire de CNP — fail fast. Nu există fallback, nu există cheie implicită de dezvoltare: fără `HR_ENCRYPTION_KEYS` aplicația nu pornește deloc. În CI/teste, cheia vine din `.env.test` cu valori generate, distincte de producție.

## (f) Încetarea contractului: ce se păstrează, ce se șterge

**La încetare** (Server Action tranzacțională): se inserează `employment_contracts` de tip `decizie_incetare` cu `motiv_incetare`; se setează `employees.data_incetarii`, `status='inactiv'`; se închide contractul curent (`valabil_pana`, `is_current=false`); se dezactivează `organization_members` (angajatul pierde accesul, contul Supabase rămâne dacă e activ în altă organizație); se anulează cererile `in_asteptare`; se declanșează evenimente pentru module (retur active din `fleet`/`inventory`, calcul concediu neefectuat în `leave`). **Nu se șterge nimic**: fișa rămâne, pontajele rămân, contractele rămân. `status='arhivat'` se aplică ulterior, când expiră retenția activă.

**Se pot șterge la cerere GDPR** (nu au temei legal de păstrare după încetare): contact de urgență, telefon și email personal, adresă de domiciliu, avatar, observații libere, documente încărcate voluntar (CV, copii CI — copia cărții de identitate nu are temei de păstrare după încetare), preferințe de portal, notificări. Ștergerea reală, nu `deleted_at`: `UPDATE employees SET telefon=NULL, ... , anonimizat_la = now()` plus ștergerea obiectelor din Storage, totul logat în `audit_logs` cu `action='gdpr.erasure'`.

**Nu se pot șterge, se arhivează** (obligație legală care primează asupra dreptului la ștergere, art. 17(3)(b) GDPR): nume, prenume, CNP, funcția, perioada lucrată, salariile, contractul și actele adiționale, deciziile, statele de plată, pontajele, fișele SSM și de instruire, dovezile de concediu. Motivul: raportarea REVISAL, dovada vechimii în muncă la casa de pensii, controalele ITM și ANAF, litigiile de muncă.

**Termenele NU se hardcodează** (principiul 7): trăiesc în tabela de configurare `retention_policies (organization_id, entitate, tip_document, ani, temei_legal, valabil_de_la)`, cu valori implicite la nivel de platformă pe care juristul clientului le poate suprascrie. Ordinele de mărime uzuale în România — statele de plată și documentele de vechime, decenii; documentele financiar-contabile, ani în ordinul zecii; documentele de instruire SSM, câțiva ani — se introduc ca date de configurare validate de arhivarul clientului, nu ca literale în cod. Un job pg_cron citește tabela, marchează `employees.status='arhivat'` la expirarea retenției active și, la expirarea retenției legale, șterge rândul din `employee_sensitive_data` — ceea ce face CNP-ul irecuperabil (crypto-shredding) fără a atinge istoricul de business, care rămâne cu `cnp_last4` și numele.