## cripto-gdpr
VERDICT: Nucleul de criptare al Fazei 2 nu funcționează deloc, iar acolo unde ar funcționa nu protejează. Am confirmat empiric, rulând pe adm_f2b și pe cod: (1) modulul de criptare folosit în producție (src/lib/hr/criptare.ts) citește o variabilă de mediu inexistentă — HR_ENCRYPTION_KEY — deci fiecare salvare și fiecare dezvăluire de CNP aruncă la runtime; (2) există DOUĂ module de criptare cu spații de chei incompatibile (importul Excel scrie cu HR_ENCRYPTION_KEYS, formularul citește cu HR_ENCRYPTION_KEY), deci datele importate n-ar putea fi citite nici dacă cheia ar exista; (3) rotația cheii distruge definitiv accesul la rândurile vechi, fiindcă decripteaza refuză orice key_version diferită de cea activă; (4) hr_read_sensitive și hr_write_sensitive — „singura cale auditată” din migrare — eșuează la prima instrucțiune (malformed array literal: \"cnp\") și, dincolo de ea, inserează în coloane care nu există în audit_logs (actor_user_id, payload); (5) politica sensitive_select permite oricum SELECT direct pe criptotext, din browser, cu zero rânduri de audit — verificat: rândul se citește, audit_logs rămâne gol; (6) nicio scriere în employee_sensitive_data nu poate reuși, fiindcă triggerul set_actor a fost atașat în 0002 doar tabelelor de atunci, iar politica cere created_by = auth.uid() — verificat: „new row violates row-level security policy”; (7) importul Excel scrie CNP-urile și IBAN-urile în CLAR în bucket-ul documente și trimite 20 dintre ele în browser, anulând complet stratul AES-GCM. Pe lângă acestea, un angajat simplu (payroll:read = own) citește sporurile și scutirile fiscale ale întregii organizații — confirmat pe date reale de test —, iar validatorul de CNP conectat la formulare acceptă luna 99 și ziua 99 pentru rezidenții străini (7/8/9), în timp ce validatorul riguros din src/domain/employee/cnp.ts zace ca depinde cod mort, alături de src/lib/crypto/sensitive-data.ts, care este singurul loc din proiect unde auditul se scrie ÎNAINTE de decriptare. Recomandarea de fond: un singur modul de criptare (aes-gcm.ts), alimentat exclusiv din serverEnv; retragerea SELECT-ului direct pe employee_sensitive_data; repararea și testarea prin execuție a funcțiilor SECURITY DEFINER în CI (bariera actuală verifică doar search_path, nu că funcția rulează); și o barieră nouă care să eșueze dacă vreo tabelă cu updated_by nu are trigger set_actor.
- [CRITIC] src/lib/hr/criptare.ts
  PROBLEMA: Modulul de criptare folosit efectiv în producție citește `process.env.HR_ENCRYPTION_KEY` (linia 55 la criptare, 74 la decriptare) și `HR_ENCRYPTION_KEY_VERSION` (linia 38). Aceste variabile NU există nicăieri: `.env.example`, `.env.local` și `ci.yml` definesc `HR_ENCRYPTION_KEYS` (hartă JSON) + `HR_ENCRYPTION_ACTIVE_KEY`, iar `src/config/env.ts` validează la boot doar acele două. Verificat prin `grep -rn 'HR_ENCRYPTION_KEY\b'`: singurele referințe sunt cele trei din criptare.ts. Scenariu: orice utilizator HR salvează un angajat cu CNP → `salveazaDateSensibile` (angajati/actions.ts:48) → `citesteCheia()` aruncă „Criptarea datelor de personal nu este configurată pe server”, acțiunea returnează EROARE_INTERNA, iar fișa de angajat a fost DEJA inserată (actions.ts:133-144), deci rămâne un angajat fără CNP și fără compensare. Identic la `dezvaluieDateSensibile`. În plus, importul Excel folosește un al DOILEA modul (`@/lib/crypto/aes-gcm`, import/actions.ts:201) cu alt spațiu de chei: chiar dacă cineva ar seta `HR_ENCRYPTION_KEY`, rândurile scrise de import (cheie din `HR_ENCRYPTION_KEYS`) nu ar putea fi decriptate niciodată de `decripteaza`.
  CORECTIE: Elimină `src/lib/hr/criptare.ts` și trece `src/app/(app)/angajati/actions.ts` pe modulul unic versionat:
```ts
import { amprentaSensibila, decrypt, encrypt } from '@/lib/crypto/aes-gcm';
// scriere
const c = encrypt(cnp);
cnp_ciphertext: `\\x${c.ciphertext.toString('hex')}`,
cnp_iv: `\\x${c.iv.toString('hex')}`,
cnp_tag: `\\x${c.tag.toString('hex')}`,
cnp_key_version: Number(c.keyVersion),
cnp_hash: amprentaSensibila(cnp),
// citire
decrypt({ ciphertext: buf(data.cnp_ciphertext), iv: buf(data.cnp_iv), tag: buf(data.cnp_tag), keyVersion: String(data.cnp_key_version) })
```
Un singur modul de criptare în tot proiectul, alimentat exclusiv din `serverEnv`, niciodată din `process.env` direct.
- [CRITIC] src/lib/hr/criptare.ts
  PROBLEMA: Rotația cheii este imposibilă prin construcție. `decripteaza` (linia 71) aruncă necondiționat `if (intrare.keyVersion !== versiuneaCurenta())`, iar `citesteCheia` (linia 25) citește o singură variabilă de mediu, fără hartă pe versiuni. Scenariu: baza are 5.000 de rânduri scrise cu `key_version = 1`; administratorul rotește cheia (setează versiunea 2, conform procedurii descrise în `.env.example` și în comentariul din `aes-gcm.ts`) → din secunda aceea NICIUN CNP și NICIUN IBAN vechi nu mai poate fi citit, iar mesajul de eroare cere „recriptare”, operație care ea însăși are nevoie să decripteze rândurile vechi. Este un blocaj circular: rotația distruge definitiv accesul la date. Coloana `cnp_key_version` din 0004_hr.sql există tocmai ca să evite asta, dar calea de citire o ignoră.
  CORECTIE: Citirea trebuie să folosească versiunea SALVATĂ PE RÂND, nu versiunea activă — exact ca `obtineCheie(valoare.keyVersion)` din `src/lib/crypto/aes-gcm.ts:166`:
```ts
// corect: scrii cu cheia activă, citești cu cheia rândului
export function decrypt(v: ValoareCriptata): string {
  const cheie = obtineCheie(v.keyVersion); // hartă versiune -> cheie
  ...
}
```
O cheie veche nu se scoate din `HR_ENCRYPTION_KEYS` cât timp există rânduri cu acea `key_version`; se retrage abia după recriptarea în lot.
- [CRITIC] src/app/(app)/angajati/import/actions.ts
  PROBLEMA: Importul Excel scrie CNP-urile și IBAN-urile ÎN CLAR, în afara oricărei criptări. Trei scurgeri distincte: (1) linia 82-86 — lotul validat este serializat ca JSON și urcat în bucket-ul `documente` la `caleLotImport()` = `{org}/import/{batchId}/lot-validat.json`, conținând până la 1000 de obiecte `AngajatValidat` cu câmpurile `cnp` și `iban` în text clar (`schemaAngajatValidat`, validare.ts:95 și 116); fișierul nu este șters niciodată — `aplicaImportAngajati` nu îl elimină după aplicare. (2) linia 96 — `esantion: rezultat.valide.slice(0, 20)` întoarce în browser CNP-ul și IBAN-ul complet a 20 de persoane, fără niciun rând de audit și fără trecere prin `dezvaluieDateSensibile`. (3) fișierul .xlsx original rămâne permanent în același bucket. Scenariu: un HR importă 300 de angajați; din acel moment 300 de CNP-uri stau necriptate în Storage, iar orice compromitere a bucket-ului sau a unui URL semnat le expune direct — tot stratul AES-GCM devine decorativ.
  CORECTIE: 1) Nu persista niciodată CNP/IBAN în clar: criptează câmpurile sensibile ÎNAINTE de a scrie lotul, sau ține lotul doar în memorie/într-o tabelă cu RLS și criptare. 2) Scoate valorile sensibile din răspunsul către client:
```ts
esantion: rezultat.valide.slice(0, 20).map(({ cnp, iban, ...restul }) => ({
  ...restul,
  cnpUltimele4: cnp?.slice(-4) ?? null,
  ibanUltimele4: iban?.slice(-4) ?? null,
})),
```
3) La finalul `aplicaImportAngajati` (când `gata === true`): `await ctx.supabase.storage.from(BUCKET_DOCUMENTE).remove([caleLotImport(org, batchId), caleFisierOriginal])`.
- [CRITIC] supabase/migrations/0005_hr_rls.sql
  PROBLEMA: Politica `sensitive_select` (liniile 245-251) permite SELECT direct pe `public.employee_sensitive_data` oricui are `employees.read = 'all'`, deci criptotextul, IV-ul, tag-ul, `key_version`, `cnp_hash` și `cnp_last4` se pot extrage fără NICIUN rând de audit — direct din browser, cu cheia anon + JWT-ul de sesiune (`supabase.from('employee_sensitive_data').select('*')`). Comentariul de la linia 278 („Citirea criptotextului: OBLIGATORIU trece prin funcția asta, care scrie în audit”) este fals. Confirmat empiric pe adm_f2b: ca `org_admin`, `select employee_id, encode(cnp_ciphertext,'hex'), encode(cnp_iv,'hex'), cnp_key_version from employee_sensitive_data` a returnat rândul, iar `select count(*) from audit_logs where entity_type='employee_sensitive_data'` a returnat 0. Aplicația însăși folosește acest canal ne-auditat (`angajati/actions.ts:357`, `queries/employees.ts:231`, `documents/adeverinte.ts:101`, `revisal/actions.ts:128`).
  CORECTIE: Retrage SELECT-ul direct și lasă numai calea auditată:
```sql
drop policy sensitive_select on public.employee_sensitive_data;
revoke select on public.employee_sensitive_data from authenticated;
-- o view/funcție SECURITY DEFINER separată, fără criptotext, pentru afișarea mascată:
create or replace function public.hr_sensitive_masked(p_employee uuid)
returns table (cnp_last4 text, iban_last4 text, banca text) ...
```
Orice acces la coloanele criptografice trece obligatoriu prin `hr_read_sensitive` (după ce e reparată — vezi mai jos).
- [CRITIC] supabase/migrations/0005_hr_rls.sql
  PROBLEMA: `hr_read_sensitive` și `hr_write_sensitive` — singura cale de acces auditat prevăzută de migrare — nu se pot executa niciodată. Două defecte independente: (1) liniile 331, 334, 406, 413, 416: `v_campuri := v_campuri || 'cnp'` — literalul netipizat este rezolvat ca `text[]`, deci Postgres aruncă `malformed array literal: "cnp"`. (2) liniile 337-346 și 460-471 inserează în `public.audit_logs (organization_id, actor_user_id, ..., payload)`, dar tabela (0001_kernel.sql) NU are coloanele `actor_user_id` și `payload`; are `actor_id`, `before`, `after` — deci ar urma 42703. Confirmat empiric pe adm_f2b, ca `org_admin` cu `employees.read='all'`: `select * from public.hr_read_sensitive(<id>)` → `ERROR: malformed array literal: "cnp" ... PL/pgSQL function public.hr_read_sensitive(uuid) line 31`. Idem `hr_write_sensitive`. Fiind plpgsql, eroarea apare abia la execuție, deci migrarea „se aplică curat” și defectul trece de CI.
  CORECTIE: ```sql
-- (1) tipizează literalul
v_campuri := v_campuri || 'cnp'::text;   -- idem pentru 'iban', 'banca'
-- (2) coloanele reale ale audit_logs
insert into public.audit_logs (
  organization_id, actor_id, action, entity_type, entity_id, status, after
) values (
  v_org, (select auth.uid()), 'read', 'employee_sensitive_data', p_employee, 'success',
  jsonb_build_object('campuri_citite', to_jsonb(v_campuri), 'motiv', 'citire date sensibile din aplicație')
);
```
Și adaugă în CI un test care CHEAMĂ efectiv fiecare funcție SECURITY DEFINER — bariera actuală verifică doar `search_path`, nu și că funcția rulează.
- [MARE] supabase/migrations/0004_hr.sql
  PROBLEMA: Nicio scriere de date sensibile din aplicație nu poate reuși. `sensitive_insert` (0005:253-262) cere `created_by = auth.uid()` și `updated_by = auth.uid()`, dar triggerul `internal.set_actor` care le completează automat a fost atașat în 0002_authz.sql (bucla de la liniile ~596-616) doar tabelelor existente ATUNCI; tabelele HR sunt create în 0004 și nu îl primesc. Confirmat pe adm_f2b: `select tgname from pg_trigger ... where relname='employee_sensitive_data'` → doar `employee_sensitive_data_set_updated_at`; lista `set_actor_%` conține doar cele 12 tabele din 0001. Confirmat funcțional, ca `org_admin` autentificat: insert fără `created_by` (exact ca import/actions.ts:209) → `ERROR: new row violates row-level security policy for table "employee_sensitive_data"`; upsert cu doar `updated_by` (exact ca angajati/actions.ts:74-84) → aceeași eroare; insert cu ambele completate → reușit. Deci CNP-ul unui angajat nou nu se poate salva niciodată, pe nicio cale.
  CORECTIE: Reataşează triggerul pentru tabelele fazei 2, la finalul lui 0004_hr.sql:
```sql
do $$
declare t record;
begin
  for t in select c.relname from pg_class c
           join pg_namespace n on n.oid=c.relnamespace
           join pg_attribute a on a.attrelid=c.oid and a.attname='updated_by'
                              and a.attnum>0 and not a.attisdropped
           where n.nspname='public' and c.relkind='r'
             and not exists (select 1 from pg_trigger g
                             where g.tgrelid=c.oid and g.tgname='set_actor_'||c.relname)
  loop
    execute format('create trigger %I before insert or update on public.%I
                    for each row execute function internal.set_actor()',
                   'set_actor_'||t.relname, t.relname);
  end loop;
end $$;
```
Și adaugă în CI o barieră care eșuează dacă vreo tabelă cu `updated_by` nu are `set_actor_*`.
- [MARE] src/lib/actions/audit.ts
  PROBLEMA: Jurnalizarea consultării CNP-ului este „best effort”, nu garantată. `writeAuditLog` (liniile 59-61) înghite orice eroare într-un `console.error` și returnează normal. În `dezvaluieDateSensibile` (angajati/actions.ts:367-399) decriptarea se face ÎNAINTE de apelul de audit, iar valoarea în clar este returnată clientului indiferent dacă rândul de audit s-a scris sau nu. Scenariu: `log_audit_event` eșuează (indisponibilitate, 22P02 pe `ip`, politica `audit_logs_insert` respinsă fiindcă `organization_id` nu mai e în `app.current_org_ids()` după suspendarea organizației) → CNP-ul apare pe ecran, dar în jurnal nu există nicio urmă. Exact scenariul pe care ecranul îl promite utilizatorului: „Fiecare consultare este înregistrată în jurnalul de audit” (date-sensibile.tsx:69). Contrastul e vizibil în codul mort `src/lib/crypto/sensitive-data.ts:225-238`, care face corect: scrie auditul întâi și refuză dezvăluirea dacă scrierea eșuează.
  CORECTIE: Adaugă o variantă strictă și folosește-o pe calea datelor sensibile:
```ts
export async function writeAuditLogStrict(supabase: ServerSupabase, entry: AuditEntry): Promise<void> {
  const { error } = await supabase.rpc('log_audit_event', { /* ... */ });
  if (error) throw new Error(`Auditul nu a putut fi scris: ${error.code}`);
}
```
În `dezvaluieDateSensibile`, mută apelul ÎNAINTE de `decripteaza(...)` și lasă excepția să oprească acțiunea — valoarea nu se întoarce dacă nu a rămas urmă.
- [MARE] supabase/migrations/0005_hr_rls.sql
  PROBLEMA: Un angajat obișnuit vede datele salariale ale ÎNTREGII organizații. `salary_components_select` (linia 794) și `exemptions_select` (linia 661) folosesc `app.has_permission(organization_id, 'payroll', 'read') <> 'none'` fără nicio restrângere pe rând, iar seed-ul acordă rolului `employee` exact `payroll|read|own`. `'own' <> 'none'` este adevărat → predicatul devine „toată organizația”. Confirmat empiric pe adm_f2b: un utilizator cu rol `employee` (care are `employees.read = 'none'`, deci `select count(*) from employees` = 0) a citit totuși `salary_components` cu `employee_id` = un ALT angajat și `suma = 999.99`, plus rândul din `employee_tax_exemptions` (tip 'it') al aceluiași străin. Scope-ul 'own' este tratat ca 'all' — încălcare directă a S3.
  CORECTIE: ```sql
create or replace policy salary_components_select on public.salary_components
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and (
      app.has_permission(organization_id, 'payroll', 'read') = 'all'
      or app.has_permission(organization_id, 'employees', 'read') = 'all'
      or (app.has_permission(organization_id, 'payroll', 'read') = 'team'
          and app.is_manager_of(organization_id, employee_id))
      or (app.has_permission(organization_id, 'payroll', 'read') = 'own'
          and employee_id = app.current_employee_id(organization_id))
    )
  );
```
Identic pentru `exemptions_select`. Regula generală: `<> 'none'` nu are ce căuta pe o tabelă cu rânduri per-angajat.
- [MARE] src/domain/hr/cnp.ts
  PROBLEMA: Validatorul de CNP conectat efectiv la formulare (`schemas/employee.ts:6` importă din `@/domain/hr/cnp`) nu validează deloc data nașterii pentru prima cifră 7, 8 sau 9: `secolPentruSex` (linia 29) întoarce `null`, iar blocul de verificare a datei (liniile 74-80) este sărit complet. Confirmat prin rulare: `7009999010013` (luna 99, ziua 99), `8009999010015` și `9009999010017` sunt toate acceptate ca valide. Tot acolo: codul de județ este acceptat pe intervalul 1-52, deci trec 47/48/49/50 care nu există (`1990101472344` → valid), numărul de ordine `000` nu este respins (`1990101010007` → valid), iar `normalizeazaCnp` face `replace(/\D/gu,'')`, deci orice text care conține 13 cifre trece. Rezultat: CNP-uri imposibile ajung criptate în bază și apoi în exportul REVISAL. Validatorul riguros care acoperă exact aceste cazuri — `src/domain/employee/cnp.ts`, cu `JUDETE_CNP` explicit, pivot de secol pentru 7/8, refuz pe `numar_ordine = 000` și verificare de dată în viitor — este cod mort: singurul lui importator, `src/lib/crypto/sensitive-data.ts`, nu e importat de nimeni.
  CORECTIE: Șterge `src/domain/hr/cnp.ts` și mută `schemas/employee.ts` pe validatorul complet:
```ts
import { normalizeazaCnp, valideazaCnp } from '@/domain/employee/cnp';
const cnpOptional = z.string().trim().nullable().default(null)
  .transform((v) => (v === null || v.length === 0 ? null : normalizeazaCnp(v)))
  .superRefine((v, ctx) => {
    if (v === null) return;
    const r = valideazaCnp(v, { astazi: new Date().toISOString().slice(0, 10) });
    if (!r.valid) ctx.addIssue({ code: 'custom', message: r.mesaj });
  });
```
În plus, `domain/employee/cnp.ts` trebuie extins să valideze data și pentru cifrele 7/8 (folosind `pivotRezidenti`), nu doar să o deducă.
- [MEDIU] src/app/(app)/angajati/actions.ts
  PROBLEMA: Nu există nicio cale de ȘTERGERE a unui CNP sau IBAN. `salveazaDateSensibile` (linia 41) iese imediat dacă toate valorile sunt `null`, iar `bucataCnp`/`bucataIban` sunt `{}` când valoarea e `null` — deci `null` înseamnă „nu atinge”, niciodată „șterge”. Aceeași semantică e documentată explicit în `hr_write_sensitive` (0005:357). Conform S4 nu există politici DELETE pe `employee_sensitive_data`, iar `sensitive_update` nu interzice `deleted_at`, dar un soft-delete lasă criptotextul în tabelă. Scenariu concret: un fost angajat exercită dreptul la ștergere (art. 17 GDPR) sau se constată că un CNP a fost introdus greșit la persoana nepotrivită — operatorul HR nu are, prin nicio interfață și prin niciun API, mijlocul de a elimina valoarea; poate doar să o suprascrie cu un alt CNP valid.
  CORECTIE: Distinge explicit `undefined` (nu atinge) de `null` (șterge), ca în `src/lib/crypto/sensitive-data.ts:249-259`:
```ts
if (cnp !== undefined) {
  bucataCnp = cnp === null
    ? { cnp_ciphertext: null, cnp_iv: null, cnp_tag: null, cnp_key_version: null, cnp_last4: null, cnp_hash: null }
    : { /* valorile criptate */ };
}
```
Schema `creeazaAngajatSchema` trebuie să permită `cnp: null` transmis intenționat, iar constrângerea `sensitive_cnp_complet` din 0004 acceptă deja varianta „toate null”.
- [MEDIU] src/app/(app)/angajati/actions.ts
  PROBLEMA: Motivul consultării ajunge nefiltrat în `audit_logs`. La linia 393, `dezvaluieDateSensibile` apelează `writeAuditLog` cu `after: { camp: input.camp, motiv: input.motiv }` — ocolind `redactPayload`, care se aplică doar payload-ului gestionat de `createAction`. `internal.scrub_jsonb` (0002:391-419) redactează exclusiv după NUMELE cheii (`%ciphertext%`, `%hash%`, `%token%`...), nu după conținut, iar cheia `motiv` nu se potrivește. `motiv` este text liber de până la 200 de caractere, cerut de UI (date-sensibile.tsx:93-102) chiar în ecranul unde se afișează CNP-ul. Scenariu: operatorul scrie „verificare CNP 1960101010101 pentru bancă” → CNP-ul ajunge în clar în `audit_logs.after`, tabelă care e append-only și pe care nimeni nu o mai poate curăța (`guard_audit_logs` blochează UPDATE și DELETE). Astfel auditul, gândit ca protecție, devine a doua copie necriptată a datei sensibile.
  CORECTIE: Filtrează valoarea, nu doar cheia, înainte de scriere:
```ts
const RE_CNP = /\b\d{13}\b/g;
const RE_IBAN = /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/gi;
const motivCurat = input.motiv.replace(RE_CNP, '[redactat]').replace(RE_IBAN, '[redactat]');
```
Și extinde `internal.scrub_jsonb` cu o trecere pe VALORI (`regexp_replace` pe elementele text), ca plasa să fie și în bază, nu doar în aplicație.

## rls-scope
VERDICT: Faza 2 nu e livrabila: nucleul HR nu functioneaza deloc si, acolo unde ar functiona, scurge date salariale.

Am construit o baza curata din chiar fisierele de migrare (`adm_verif`, port 5433) fiindca `adm_f2b` era deja peticita manual — ii lipsea clauza `manager_path` din `employees_insert` si avea GRANT-uri adaugate din afara migrarilor, deci ascundea exact primele trei defecte. Toate constatarile de mai jos sunt reproduse pe baza curata.

Trei defecte opresc complet Faza 2: (1) niciuna dintre cele 16 tabele HR nu are GRANT pentru `authenticated` sau `service_role` — `grant ... on all tables` din 0001 a fost un instantaneu luat inainte ca tabelele sa existe, deci orice cerere HR raspunde 42501 si politicile din 0005 sunt cod mort; (2) `employees_insert` si (3) `departments_insert` cer `manager_path = '{}'` respectiv `path = '{}'`, valori pe care trigger-ele BEFORE le suprascriu inainte ca WITH CHECK sa fie evaluat — deci nu se poate crea nici angajat, nici departament.

Al patrulea e o scurgere reala: `salary_components_select` si `exemptions_select` folosesc `<> 'none'` in loc sa respecte scope-ul, iar seed-ul global da rolului `employee` exact `payroll:read = own`. Reprodus fara nicio suprascriere: un angajat obisnuit vede toate sporurile firmei, inclusiv indemnizatia de conducere a directorului, si toate scutirile fiscale. Acelasi tipar sta latent in `work_permits_select` si `revisal_events_select`.

Al cincilea: `hr_read_sensitive` si `hr_write_sensitive` cad de fiecare data cu „malformed array literal: cnp” (`text[] || 'cnp'` fara cast). Canalul auditat de CNP/IBAN, declarat OBLIGATORIU in comentariile din 0005, nu a functionat niciodata — iar aplicatia oricum nu il apeleaza, citeste criptotextul direct.

La scoping: `scope = own` chiar limiteaza, iar `manager_path` e mentinut corect de trigger — am verificat empiric ca mutarea unui manager reface path-ul intregului subarbore, si ca un manager NU poate aduce pe cineva din afara in subarborele lui (UPDATE 0) si nici sa isi mute un subordonat in alta organizatie (trigger-ul refuza). In schimb, WITH CHECK-ul lui `employees_update` nu fixeaza `user_id`/`is_primary`/`status`/`deleted_at`, asa ca un manager cu scope 'team' poate rescrie identitatea unui subordonat; iar `job_descriptions_update` acorda drept de scriere pe baza de identitate, fara nicio permisiune, deci cineva cu drept exclusiv de citire isi rescrie si „semneaza” singur fisa de post.

In fine, `tests/rls/izolare.sql` esueaza astazi la verificarea (c): fixture-ul nu are randuri Beta in 21 de tabele, printre care toate cele 16 ale Fazei 2. Testul e scris corect si spune adevarul — izolarea intre tenanti a nucleului HR nu a fost demonstrata niciodata. Pana nu se extinde fixture-ul, orice afirmatie despre izolarea Fazei 2 e ipoteza, nu masuratoare.

Castul `::uuid[]` la `app.current_org_ids()` e prezent in toate cele 66 de aparitii din 0005, RLS + FORCE sunt active pe toate cele 16 tabele, nu exista nicio politica DELETE, toate functiile noi au `search_path = ''` cu REVOKE/GRANT explicit, si niciun OR de nivel superior nu e neparantezat. Acolo regulile sunt respectate literal.
- [CRITIC] /Users/maleticimiroslav/ERP Adminio/supabase/migrations/0004_hr.sql
  PROBLEMA: Niciuna dintre cele 16 tabele HR noi nu primeste GRANT. 0001_kernel.sql linia 642 face `grant select, insert, update on all tables in schema public to authenticated` — un INSTANTANEU luat inainte ca 0004 sa creeze tabelele; nu exista `alter default privileges`, iar 0004/0005 nu contin niciun grant. Verificat pe baza curata: `select ... from information_schema.role_table_grants where grantee='authenticated'` returneaza 16 tabele, TOATE din 0001; `employees`, `departments`, `employment_contracts` etc. lipsesc. La fel pentru `service_role` (0 privilegii pe `employees`). Orice cerere PostgREST catre nucleul HR raspunde `42501 permission denied for table employees`, inclusiv din clientul admin. Politicile din 0005 sunt cod mort: nu se ajunge niciodata la ele. Reprodus: `set local role authenticated; insert into public.employees ... → ERROR: permission denied for table employees`.
  CORECTIE: La finalul lui 0004 (sau intr-o migrare 0006), explicit, pe lista de tabele — nu `on all tables`, ca sa nu se repete instantaneul:

do $$
declare t text;
begin
  foreach t in array array[
    'departments','job_positions','employees','employee_sensitive_data','employment_contracts',
    'employee_document_types','employee_documents','job_descriptions','employee_tax_exemptions',
    'work_permits','salary_component_types','salary_components','hr_document_templates',
    'hr_issued_documents','revisal_config','revisal_events']
  loop
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('revoke delete on public.%I from public, anon, authenticated', t);
  end loop;
end $$;

Si o verificare mecanica in tests/rls/izolare.sql: orice tabela din `public` fara `select` pentru `authenticated` si fara motiv scris in lista alba = esec.
- [CRITIC] /Users/maleticimiroslav/ERP Adminio/supabase/migrations/0005_hr_rls.sql
  PROBLEMA: `employees_insert` (linia 207) cere `manager_path = '{}'::uuid[]`, dar trigger-ul BEFORE INSERT `employees_manager_path_biu` (0004, linia 834) suprascrie coloana cu `array[new.id]` — iar in Postgres WITH CHECK se evalueaza DUPA trigger-ele BEFORE ROW. Conditia e deci mereu falsa: nu se poate crea NICIUN angajat prin RLS. Reprodus pe baza curata (dupa acordarea GRANT-urilor lipsa), in toate cele trei variante: fara `manager_path` in lista de coloane, cu `manager_path='{}'` trimis explicit, si cu `manager_employee_id` setat → de fiecare data `ERROR: new row violates row-level security policy for table "employees"`. Afecteaza direct `creeazaAngajat` din src/app/(app)/angajati/actions.ts si importul Excel.
  CORECTIE: Clauza e inutila: trigger-ul ignora oricum ce trimite clientul, deci nu exista nimic de aparat. Se scoate:

  -- and manager_path = '{}'::uuid[]   ← se sterge

Daca se vrea pastrata o gardă explicita, singura forma corecta e cea de dupa trigger:
  and manager_path = coalesce(
        (select e.manager_path from public.employees e where e.id = manager_employee_id), '{}'::uuid[]
      ) || id
dar recomandarea e stergerea simpla, plus un test care insereaza un angajat prin `set local role authenticated`.
- [CRITIC] /Users/maleticimiroslav/ERP Adminio/supabase/migrations/0005_hr_rls.sql
  PROBLEMA: Acelasi mecanism la `departments_insert` (linia 126): `and path = '{}'::uuid[] and depth = 0`. Trigger-ul `departments_path_biu` (0004, linia 770) seteaza `new.path := array[new.id]` inainte de WITH CHECK, deci `path = '{}'` e mereu fals. Reprodus pe baza curata, si cu `path`/`depth` trimise explicit si fara: `ERROR: new row violates row-level security policy for table "departments"`. Consecinta: structura organizatorica nu se poate crea deloc, iar `creeazaDepartament` (src/app/(app)/departamente/actions.ts:52) esueaza mereu, desi trimite corect created_by/updated_by.
  CORECTIE: Se sterge conditia pe `path` si se pastreaza doar ce clientul chiar controleaza:

  and deleted_at is null
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
  -- and path = '{}'::uuid[] and depth = 0   ← se sterge

`depth` poate ramane fixat corect ca `depth = coalesce((select d.depth + 1 from public.departments d where d.id = parent_id), 0)`, dar trigger-ul il recalculeaza oricum.
- [CRITIC] /Users/maleticimiroslav/ERP Adminio/supabase/migrations/0005_hr_rls.sql
  PROBLEMA: Scurgere de scope pe date salariale. `salary_components_select` (linia 794) si `exemptions_select` (linia 661) folosesc `app.has_permission(organization_id,'payroll','read') <> 'none'` — adica trateaza 'own' si 'team' ca pe 'all'. Seed-ul GLOBAL din 0002 (linia 1191) acorda rolului `employee` exact `payroll:read = own`. Reprodus pe baza curata, cu seed-ul implicit, fara nicio suprascriere: un utilizator cu rol `employee` (employees.read = own) vede `count(*) = 2` din 2 randuri din `salary_components`, inclusiv indemnizatia de conducere a directorului (`max(suma) = 9999.00`), si `count(*) = 2` din 2 randuri din `employee_tax_exemptions`. Orice angajat citeste, prin PostgREST, sporurile si scutirile fiscale ale intregii firme — inclusiv ale conducerii. Comentariul de la linia 787 („managerul de echipa NU le vede”) e contrazis de cod.
  CORECTIE: Predicatul trebuie sa respecte scope-ul, nu doar sa verifice ca nu e 'none':

create policy salary_components_select on public.salary_components
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and (
      app.has_permission(organization_id, 'payroll', 'read') = 'all'
      or app.has_permission(organization_id, 'employees', 'read') = 'all'
      or (
        app.has_permission(organization_id, 'payroll', 'read') in ('own','team')
        and employee_id = app.current_employee_id(organization_id)
      )
    )
  );

Identic pentru `exemptions_select`. Regula generala: `<> 'none'` e interzis pe orice tabela cu rand per angajat; se compara explicit cu 'all' sau se restrange prin `app.can_see_employee`.
- [CRITIC] /Users/maleticimiroslav/ERP Adminio/supabase/migrations/0005_hr_rls.sql
  PROBLEMA: `hr_read_sensitive` (linia 331) si `hr_write_sensitive` (liniile 406, 413, 416) contin `v_campuri := v_campuri || 'cnp';` unde `v_campuri` e `text[]`. In plpgsql literalul fara tip se rezolva catre `anyarray || anyarray`, deci Postgres incearca `'cnp'::text[]` si arunca `ERROR: malformed array literal: "cnp"`. Reprodus pe baza curata, ca utilizator `hr` cu employees.read/update = all, pe un angajat care ARE date sensibile: ambele functii cad, de fiecare data, pe prima ramura. Rezultatul: singurul canal de citire/scriere a CNP/IBAN care lasa urma in audit — cel descris ca OBLIGATORIU la liniile 278-280 — nu a functionat niciodata. In plus, aplicatia nici nu il apeleaza: `dezvaluieDateSensibile` (src/app/(app)/angajati/actions.ts:358) citeste criptotextul direct din tabela, deci modelul documentat in 0005 nu e cel implementat.
  CORECTIE: In ambele functii, tipul explicit sau array_append:

  v_campuri := v_campuri || 'cnp'::text;      -- sau: array_append(v_campuri,'cnp')
  v_campuri := v_campuri || 'iban'::text;
  v_campuri := v_campuri || 'banca'::text;

Si un test care apeleaza efectiv `public.hr_read_sensitive(...)` / `public.hr_write_sensitive(...)` pe un rand real (nu doar `\df`). Separat: fie aplicatia trece pe aceste functii, fie comentariul din 0005 se corecteaza ca sa descrie canalul real (`dezvaluieDateSensibile` + writeAuditLog).
- [MARE] /Users/maleticimiroslav/ERP Adminio/supabase/migrations/0005_hr_rls.sql
  PROBLEMA: `job_descriptions_update` (liniile 631-648): ramura 'own' e `employee_id = app.current_employee_id(organization_id)` — o conditie de IDENTITATE, fara nicio verificare de permisiune. Un utilizator care are DOAR `employees:read = own` (configuratia de portal, drept exclusiv de citire) capata drept de scriere pe propria fisa de post. Mai rau, WITH CHECK nu fixeaza campurile de semnatura: acelasi utilizator isi rescrie `continut` si `atributii`, apoi seteaza singur `semnat_de_angajat = true`, `semnat_la = now()` si `semnatura_ip` la o valoare inventata. Reprodus pe baza curata: cu `app.has_permission(org,'employees','update') = 'none'`, UPDATE 1, iar randul devine continut='Nu am nicio atributie', semnat_de_angajat=t, semnatura_ip='9.9.9.9'. Fisa de post semnata nu mai probeaza nimic.
  CORECTIE: 1) Se cere permisiune si pe ramura proprie:
  or (
    app.has_permission(organization_id,'employees','update') in ('own','team')
    and employee_id is not null
    and employee_id = app.current_employee_id(organization_id)
  )
2) Semnatura nu se scrie din client. Se muta intr-un RPC `public.hr_semneaza_fisa_post(p_id uuid)` SECURITY DEFINER cu `search_path = ''`, care verifica identitatea, refuza o fisa deja semnata, seteaza `semnat_la = now()`, `semnat_de_angajat = true`, `semnatura_ip = internal.request_ip()` si scrie in audit; iar in politica de UPDATE se blocheaza modificarea lor de catre angajat printr-un trigger de garda (in stilul `internal.guard_*`) care, cand apelantul nu are employees.update='all', readuce `continut`, `atributii`, `semnat_*` la valorile vechi.
- [MARE] /Users/maleticimiroslav/ERP Adminio/supabase/migrations/0005_hr_rls.sql
  PROBLEMA: `employees_select` (liniile 184-196) este SINGURA politica de SELECT din 0005 fara `deleted_at is null` — toate celelalte 15 il au. Fisele sterse logic raman vizibile in listari, cautari si export. Reprodus pe baza curata: dupa `update employees set deleted_at = now() where marca='D001'`, un utilizator `hr` primeste in continuare randul D001 cu deleted_at nenul. Nu e o scurgere intre tenanti, dar e o scurgere in timp: un angajat „sters” la cererea lui (art. 17 GDPR, dreptul la stergere) reapare in orice interogare care nu filtreaza explicit — iar `app.is_manager_of` si `app.current_employee_id` filtreaza `deleted_at`, deci comportamentul e si incoerent intre politici.
  CORECTIE: create policy employees_select on public.employees
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and (case app.has_permission(organization_id,'employees','read') ... end)
  );

Si o aserțiune in tests/rls/izolare.sql: pentru fiecare tabela cu coloana `deleted_at`, politica de SELECT trebuie sa contina `deleted_at IS NULL` (verificabil din `pg_policies.qual`).
- [MARE] /Users/maleticimiroslav/ERP Adminio/supabase/migrations/0005_hr_rls.sql
  PROBLEMA: `employees_update` (liniile 225-236): WITH CHECK fixeaza doar `organization_id` si `updated_by`. Cu scope 'team', un manager poate rescrie orice coloana a oricarui subordonat, inclusiv legatura de identitate. Reprodus pe baza curata (manager cu employees.read=team + employees.update=team): `update employees set user_id = <uid-ul managerului>, is_primary = false where id = <subordonat>` → UPDATE 1, fisa subordonatului ramane atasata contului managerului, iar victima isi pierde accesul in portal. Acelasi WITH CHECK admite `marca`, `status`, `hired_on`, `terminated_on` si `deleted_at` — adica managerul isi poate „concedia” si sterge logic subordonatii, desi S4 interzice tocmai politicile DELETE. Pe scope 'own' consecinta e simetrica: cu employees.read=own + employees.update=own, un angajat isi schimba singur marca si statutul (reprodus: marca → 'HACK', status → 'incetat').
  CORECTIE: Coloanele administrate de HR nu se lasa in WITH CHECK, ci intr-un trigger de garda in stilul `internal.guard_organizations` (0002:612), care le readuce la valorile vechi cand apelantul nu are employees.update='all':

create or replace function internal.guard_employees() returns trigger
language plpgsql set search_path = '' as $$
begin
  if app.is_service_context() or app.has_permission(new.organization_id,'employees','update') = 'all' then
    return new;
  end if;
  new.organization_id := old.organization_id;
  new.user_id  := old.user_id;   new.is_primary := old.is_primary;
  new.marca    := old.marca;     new.status     := old.status;
  new.hired_on := old.hired_on;  new.terminated_on := old.terminated_on;
  new.manager_employee_id := old.manager_employee_id;
  new.deleted_at := old.deleted_at;
  new.created_at := old.created_at; new.created_by := old.created_by;
  return new;
end $$;
create trigger guard_employees before update on public.employees
  for each row execute function internal.guard_employees();
- [MARE] /Users/maleticimiroslav/ERP Adminio/supabase/migrations/0004_hr.sql
  PROBLEMA: Trigger-ul `internal.set_actor` NU exista pe niciuna dintre tabelele HR: blocul DO din 0002 (linia 591) enumera tabelele cu coloana `updated_by` la momentul rularii lui 0002, adica inainte ca 0004 sa creeze tabelele HR. Verificat: `set_actor_*` = 0 pe employees, departments, employment_contracts, employee_documents, employee_sensitive_data, job_descriptions, salary_components, hr_issued_documents (si 1 pe organizations/organization_members). Cum WITH CHECK-urile din 0005 cer `created_by = (select auth.uid())`, orice INSERT care nu trimite explicit `created_by` e refuzat de RLS. Trei locuri din cod fac exact asta si esueaza intotdeauna: `salveazaDateSensibile` (src/app/(app)/angajati/actions.ts:74, upsert fara created_by → salvarea CNP/IBAN nu functioneaza niciodata), inserarea documentului de angajat (src/app/(app)/angajati/[id]/documente/actions.ts:105) si emiterea adeverintei (src/lib/documents/adeverinte.ts:186). Reprodus pe baza curata: acelasi INSERT fara `created_by` → `new row violates row-level security policy`; cu `created_by` → INSERT 0 1. La adeverinte eroarea e si mascata: bucla de retry trateaza orice cod diferit de 23505 ca `businessRule("Adeverinta nu a putut fi inregistrata")`.
  CORECTIE: Se reataseaza garda de actor pe tabelele HR, in 0004, dupa crearea lor:

do $$
declare t text;
begin
  foreach t in array array['departments','job_positions','employees','employee_sensitive_data',
    'employment_contracts','employee_document_types','employee_documents','job_descriptions',
    'employee_tax_exemptions','work_permits','salary_component_types','salary_components',
    'hr_document_templates','hr_issued_documents','revisal_config','revisal_events']
  loop
    execute format('create trigger %I before insert or update on public.%I
      for each row execute function internal.set_actor()', 'set_actor_' || t, t);
  end loop;
end $$;

In plus, ca sa nu se repete instantaneul: blocul din 0002 sa devina o functie `internal.attach_set_actor(text)` apelata explicit de fiecare migrare care adauga tabele. Independent de asta, `salveazaDateSensibile` trebuie sa trimita `created_by: actorId` in upsert.
- [MARE] /Users/maleticimiroslav/ERP Adminio/supabase/migrations/0005_hr_rls.sql
  PROBLEMA: `hr_issued_update` (liniile 895-907) contrazice propriul comentariu („Adeverinta emisa nu se rescrie: se anuleaza”). WITH CHECK nu fixeaza niciuna dintre coloanele care dau valoare probatorie documentului. Reprodus pe baza curata, ca `hr`: `update hr_issued_documents set continut_html='<p>Venit 50000</p>', continut_checksum='sha-falsa', numar_afisat='ADEV/999', serie='FALS'` → UPDATE 1, randul devine exact asta. `continut_checksum` e descris in 0004 (linia 635) drept „SHA-256 peste continutul final; dovedeste neaterarea” — dar poate fi rescris impreuna cu continutul, deci nu dovedeste nimic; iar `cod_verificare` (tokenul public de verificare) ramane acelasi, deci o adeverinta deja predata unei banci poate fi rescrisa in urma, pastrandu-si linkul de verificare.
  CORECTIE: Trigger de garda care lasa deschise doar anularea si atasarea fisierului generat:

create or replace function internal.guard_hr_issued() returns trigger
language plpgsql set search_path = '' as $$
begin
  if app.is_service_context() then return new; end if;
  new.organization_id := old.organization_id; new.employee_id := old.employee_id;
  new.template_id := old.template_id; new.contract_id := old.contract_id;
  new.serie := old.serie; new.numar := old.numar; new.numar_afisat := old.numar_afisat;
  new.titlu := old.titlu; new.emis_la := old.emis_la; new.emis_de := old.emis_de;
  new.date_document := old.date_document; new.continut_html := old.continut_html;
  new.continut_checksum := old.continut_checksum; new.cod_verificare := old.cod_verificare;
  if old.anulat_la is not null then
    raise exception 'O adeverinta anulata nu se mai modifica.' using errcode = 'PT403';
  end if;
  return new;
end $$;
create trigger guard_hr_issued before update on public.hr_issued_documents
  for each row execute function internal.guard_hr_issued();
- [MARE] /Users/maleticimiroslav/ERP Adminio/tests/rls/izolare.sql
  PROBLEMA: Testul de izolare ESUEAZA astazi, rulat asa cum e documentat: `psql -p 5433 -d adm_f2b -v ON_ERROR_STOP=1 -f tests/rls/izolare.sql` cade in verificarea (c) cu „IZOLARE NEVERIFICATA pentru 21 tabele” — printre care TOATE cele 16 tabele ale Fazei 2 (employees, employee_sensitive_data, employment_contracts, employee_documents, job_descriptions, employee_tax_exemptions, work_permits, salary_components, hr_issued_documents, revisal_events, ...). Fixture-ul din test (liniile 34-91) nu a fost extins cu Faza 2, deci nu exista randuri ale organizatiei Beta in nicio tabela HR. Testul e corect scris (raporteaza tacerea in loc sa o treaca), dar concluzia lui e ca izolarea intre tenanti a nucleului HR nu a fost demonstrata NICIODATA. Verificarile (d) si (e) ating in continuare doar `notifications` si `organizations`.
  CORECTIE: Se extinde blocul DO de pregatire cu randuri pentru AMBELE organizatii in fiecare tabela HR (minim: un departament, o functie, un angajat + fisa lui sensibila, un contract, un document, o fisa de post, o scutire, un permis, un spor, o adeverinta, un eveniment REVISAL per organizatie). Suplimentar, verificarile (d)/(e) sa parcurga automat toate tabelele cu `organization_id`, ca si (c), incercand INSERT/UPDATE cross-tenant, si sa se adauge un pas nou (l): pentru fiecare rol din seed, un utilizator sintetic si o asertie ca numarul de randuri vizibile in salary_components / employee_tax_exemptions / employee_documents corespunde scope-ului declarat.
- [MEDIU] /Users/maleticimiroslav/ERP Adminio/supabase/migrations/0004_hr.sql
  PROBLEMA: Doar `employment_contracts` are trigger de coerenta tenant (`tg_contracts_validari`, linia 888, verifica `v_emp_org <> new.organization_id`). Restul tabelelor-copil nu au nimic, iar WITH CHECK-urile din 0005 fixeaza doar `organization_id`, nu si apartenenta lui `employee_id`. Reprodus pe baza curata, ca `hr` in organizatia A: am inserat cu succes (INSERT 0 1 de fiecare data) un spor, o scutire fiscala, un document de angajat, un permis de munca si un eveniment REVISAL avand `organization_id = A` si `employee_id` = un angajat al organizatiei B. FK-ul valideaza doar existenta. Nu e o citire cross-tenant (randurile raman in A), dar sparge integritatea referentiala a tenancy-ului: exportul REVISAL, calculul de salarizare si dosarul de personal din A ajung sa se refere la persoane din B, si devine imposibil de garantat ca stergerea unui tenant curata tot ce il priveste.
  CORECTIE: Un singur trigger generic, atasat pe cele sase tabele:

create or replace function internal.guard_employee_tenant() returns trigger
language plpgsql set search_path = '' as $$
declare v_org uuid;
begin
  select e.organization_id into v_org from public.employees e
   where e.id = new.employee_id and e.deleted_at is null;
  if v_org is null then
    raise exception 'Angajatul indicat nu exista.' using errcode = 'P0001';
  end if;
  if v_org <> new.organization_id then
    raise exception 'Randul si angajatul apartin unor organizatii diferite.' using errcode = 'P0001';
  end if;
  return new;
end $$;

do $$ declare t text; begin
  foreach t in array array['employee_documents','job_descriptions','employee_tax_exemptions',
    'work_permits','salary_components','hr_issued_documents','employee_sensitive_data','revisal_events']
  loop
    execute format('create trigger guard_tenant_%1$s before insert or update on public.%1$I
      for each row execute function internal.guard_employee_tenant()', t);
  end loop;
end $$;
(pentru `job_descriptions`, unde employee_id poate fi null, se adauga o iesire timpurie pe `new.employee_id is null`).
- [MEDIU] /Users/maleticimiroslav/ERP Adminio/supabase/migrations/0005_hr_rls.sql
  PROBLEMA: Cumulul de functii e tratat incoerent intre politici. `app.current_employee_id` (linia 16) cere `is_primary`, deci pentru o persoana cu doua fise returneaza doar fisa principala; `app.can_see_employee` (linia 73) si toate politicile care depind de ea folosesc acest ID unic. In schimb `employees_select` (linia 192) foloseste `user_id = auth.uid()`, deci arata AMBELE fise. Reprodus pe baza curata, pentru un angajat cu doua fise (S001 principala, S002 cumul): vede in `employees` ambele fise, dar in `employment_contracts` doar C-1 (contractul fisei principale), iar documentul atasat fisei S002 e invizibil (count = 0). Angajatul isi vede in portal o fisa fara contract si fara documente, iar `hr_issued_documents` / `employee_tax_exemptions` / `work_permits` legate de a doua fisa nu ii sunt accesibile — exact scenariul de cumul pe care 0004 il declara sustinut la liniile 188-192.
  CORECTIE: Se inlocuieste identitatea unica cu multimea fiselor proprii:

create or replace function app.current_employee_ids(p_org uuid)
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(e.id), '{}'::uuid[])
  from public.employees e
  where e.organization_id = p_org and e.user_id = (select auth.uid()) and e.deleted_at is null
$$;
revoke all on function app.current_employee_ids(uuid) from public;
grant execute on function app.current_employee_ids(uuid) to authenticated;

Apoi in `app.can_see_employee` / `app.can_write_employee`: `when 'own' then p_employee = any (app.current_employee_ids(p_org))`, iar in `app.is_manager_of`: `e.manager_path && app.current_employee_ids(p_org)`. `app.current_employee_id` ramane doar pentru locurile care chiar au nevoie de fisa principala (profil, notificari). La fel, src/lib/queries/employees.ts:115 `idFisaProprie` trebuie sa intoarca o lista, nu `limit 1`.
- [MEDIU] /Users/maleticimiroslav/ERP Adminio/supabase/migrations/0005_hr_rls.sql
  PROBLEMA: `work_permits_select` (linia 710) si `revisal_events_select` (linia 955) folosesc acelasi tipar gresit ca sporurile: `app.has_permission(organization_id,'compliance','read') <> 'none'`. Astazi seed-ul global nu acorda `compliance` cu scope sub 'all' niciunui rol, deci nu se manifesta — dar `role_permissions_insert` (0002:974) permite explicit unui org_admin sa insereze un rand pe organizatie, iar comentariul din 0002:1170 incurajeaza tocmai asta. In clipa in care o firma acorda `compliance:read = team` unui responsabil SSM, acesta capata acces la TOATE permisele de munca si la TOATE evenimentele REVISAL ale firmei, nu doar la echipa lui — exact scurgerea demonstrata deja pe salary_components. S3 cere minScope, nu `<> 'none'`.
  CORECTIE: Aceeasi corectie ca la sporuri, aplicata peste tot unde apare `<> 'none'` pe o tabela cu rand per angajat (work_permits, revisal_events, job_positions e in regula fiindca e nomenclator):

  and (
    app.has_permission(organization_id,'compliance','read') = 'all'
    or app.can_see_employee(organization_id, employee_id)
  )

Si o verificare in tests/rls/izolare.sql care esueaza daca `pg_policies.qual` al unei politici de SELECT pe o tabela cu coloana `employee_id` contine sirul `<> 'none'::permission_scope`.
- [MEDIU] /Users/maleticimiroslav/ERP Adminio/supabase/migrations/0005_hr_rls.sql
  PROBLEMA: Nomenclatoarele nu verifica nicio permisiune la citire: `doc_types_select` (linia 524), `salary_component_types_select` (linia 751), `hr_templates_select` (linia 836) si `revisal_config_select` (linia 913) cer doar `organization_id is null or organization_id = any(current_org_ids)`. Prin comparatie, `departments_select` si `job_positions_select` verifica explicit `<> 'none'`. Reprodus pe baza curata: un utilizator cu rol `employee` (employees.read = none) citeste toate cele 18 tipuri de documente, 13 tipuri de spor, 3 sabloane de adeverinta si 10 randuri de configurare REVISAL. Randurile de platforma (organization_id is null) sunt neutre, dar cele PROPRII organizatiei nu sunt: `hr_document_templates.continut_html` contine textul intern al adeverintelor firmei, iar `salary_component_types` proprii expun structura de sporuri. S2/S3 cer refuz explicit acolo unde scope-ul e none.
  CORECTIE: Se separa randul de platforma de cel al organizatiei si se cere permisiune pentru al doilea:

using (
  deleted_at is null
  and (
    organization_id is null
    or (
      organization_id = any ((select app.current_org_ids())::uuid[])
      and app.has_permission(organization_id, 'employees', 'read') <> 'none'
    )
  )
)

(pentru salary_component_types: resursa 'payroll'; pentru revisal_config: 'compliance' sau 'employees').

## business-legal
VERDICT: Faza 2 NU funcționează end-to-end. Am confirmat empiric (psql pe adm_f2b + node) că fluxurile principale sunt blocate încă de la primul INSERT, iar nucleul de conformitate (REVISAL) și adeverințele sunt cod mort, fără niciun apelant.

Trei clase de defecte, în ordinea gravității:

1) RLS-ul din 0005 respinge scrierile pe care aplicația chiar le face. `employees_insert` cere `manager_path = '{}'`, dar trigger-ul BEFORE INSERT din 0004 pune `array[new.id]` ÎNAINTE ca WITH CHECK să fie evaluat (verificat: `new row violates row-level security policy for table "employees"`). Idem `departments_insert` cu `path`/`depth`. În paralel, patru acțiuni omit `created_by`/`updated_by` pe care politicile le cer (contracte, documente, date sensibile, adeverințe) — confirmat 42501 pe toate trei testate. Nu se poate crea niciun angajat, niciun departament, niciun contract, niciun document.

2) Modulele „gata” nu sunt legate. `genereazaEvenimenteRevisal` și `deduceEvenimenteContract` au ZERO apelanți; nimic nu trece un contract în `activ`; `genereazaAdeverinta` n-are apelant; `creeazaContract`/`inceteazaContract` nu sunt folosite de nicio pagină. `revisal_events` rămâne goală permanent, iar pagina REVISAL afirmă în empty-state că „evenimentele se creează automat”. Ecranele de export/marcare transmis lucrează pe o tabelă care nu se populează niciodată. Bucket-ul `documente` din `cale.ts` nu există (există `org-documents`), deci și importul, și dosarul de personal cad pe Storage.

3) Robustețe și conformitate. Un .xlsx de 3,23 MB (sub limita de 5 MB) consumă 528 MB heap / 708 MB RSS în `xlsx.load()` — limita de 1000 de rânduri se aplică DUPĂ parsare, deci e ornamentală. `HR_ENCRYPTION_KEY` cerut de `lib/hr/criptare.ts` nu există în schema de mediu; două stive de criptare paralele. Cumulul de funcții e declarat suportat în 0004 dar interzis de indexul unic pe `cnp_hash` (confirmat 23505). Permisiunile de la afișare nu coincid cu cele din acțiune la REVISAL (S2/S3). `pnpm test` e roșu (1/175), iar validatorul de CNP testat nu e cel folosit de formular.

Ce va cere o firmă reală în prima lună și nu există deloc: activarea contractului + generarea automată a evenimentului REVISAL de angajare/încetare; generarea CIM-ului și a actului adițional (există doar șabloane de adeverință); decizia de încetare; alertele de expirare (medicina muncii, CI, permis de muncă, contract pe durată determinată — schema are `valabil_pana` indexat și `notificat_la`, dar niciun job); rolul `hr` nu are NICIO permisiune `compliance`, deci specialistul de personal nu poate deschide pagina REVISAL; zilele libere declarate prin hotărâre de guvern (punți) nu pot fi configurate, deși `construiesteCalendar` acceptă parametrul.

Ce e corect și nu am raportat: funcțiile din `src/domain/**` sunt într-adevăr pure (zero `Date.now()`/`new Date()` fără argument, `azi` și calendarul intră ca parametri); termenele REVISAL vin din `revisal_config`, nu sunt hardcodate; `export.ts` marchează explicit formatul ca NECONFIRMAT; validarea importului adună toate erorile pe rând și continuă cu rândurile bune; compensarea per rând din import e gândită corect; politicile respectă S4/S5/S6 (FORCE peste tot, `search_path = ''`, cast la `uuid[]`), iar `employee_sensitive_data` e corect exclusă din audit (S10).
- [CRITIC] supabase/migrations/0005_hr_rls.sql:207 (și :126-127)
  PROBLEMA: Politica `employees_insert` cere `manager_path = '{}'::uuid[]`, dar trigger-ul BEFORE INSERT `employees_manager_path_biu` din 0004:834 setează `new.manager_path := array[new.id]` ÎNAINTE ca RLS WITH CHECK să fie evaluat (Postgres rulează BEFORE-triggerele, apoi ExecWithCheckOptions pe tupla modificată). Predicatul e imposibil de satisfăcut. Identic pentru `departments_insert` cu `path = '{}'` și `depth = 0`. CONFIRMAT pe adm_f2b: ca org_admin cu employees:create='all', `insert into public.employees (...)` → `ERROR: new row violates row-level security policy for table "employees"`; `returning manager_path` arată `{d9e35ca6-...}` și `manager_path = '{}' → f`. Efect: nu se poate crea NICIUN angajat și NICIUN departament din aplicație — creeazaAngajat, importul în masă și structura organizatorică sunt toate moarte.
  CORECTIE: Predicatul trebuie să exprime „clientul nu a trimis nimic”, nu „coloana e goală după trigger”. Cea mai simplă variantă corectă: scoate complet predicatele din WITH CHECK (coloana e oricum recalculată de trigger la fiecare INSERT/UPDATE, deci clientul nu o poate influența) și, dacă vrei apărare în adâncime, forțează-le în trigger:

-- în 0005
alter policy employees_insert on public.employees with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.has_permission(organization_id,'employees','create') = 'all'
  and deleted_at is null and terminated_on is null
  and created_by = (select auth.uid()) and updated_by = (select auth.uid())
  and status in ('candidat','activ')
);
alter policy departments_insert on public.departments with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.has_permission(organization_id,'departments','create') = 'all'
  and deleted_at is null
  and created_by = (select auth.uid()) and updated_by = (select auth.uid())
);

Apoi adaugă un test de regresie care chiar face INSERT-ul ca `authenticated`, nu doar verifică existența politicii.
- [CRITIC] src/app/(app)/angajati/import/actions.ts:130-151, :174-188, :209-221; src/app/(app)/angajati/[id]/documente/actions.ts:88-104; src/lib/documents/adeverinte.ts:159-179; src/app/(app)/angajati/actions.ts:74-84
  PROBLEMA: Politicile de INSERT din 0005 cer `created_by = (select auth.uid()) and updated_by = (select auth.uid())`, iar tabelele HR din 0004 NU au trigger `internal.set_actor()` (verificat: pe `public.employees` există doar manager_path_biu, validari_biu, set_updated_at, audit_employees; pe `employee_sensitive_data` doar set_updated_at). Șase locuri de scriere omit una sau ambele coloane: importul (employees, employment_contracts, employee_sensitive_data), salveazaDocument (employee_documents), genereazaAdeverinta (hr_issued_documents), salveazaDateSensibile din formular (upsert cu `updated_by` dar fără `created_by`). CONFIRMAT pe adm_f2b, ca org_admin: employee_documents → 42501, employment_contracts → 42501, hr_issued_documents → 42501, employee_sensitive_data fără created_by → 42501, aceeași inserare cu created_by → OK. Efect: importul eșuează pe fiecare rând care are contract sau CNP (și compensarea `anuleaza` eșuează la rândul ei — `.update({deleted_at})` nu pune `updated_by`, iar `employee_documents_update`/`employees_update` îl cer), nu se poate încărca niciun document în dosarul de personal, nu se poate emite nicio adeverință.
  CORECTIE: Pune actorul în TOATE scrierile, sau — mai bine, ca să nu se mai poată uita — atașează trigger-ul existent pe tabelele din 0004:

-- migrare nouă
do $$ declare t text; begin
  foreach t in array array['departments','job_positions','employees','employee_sensitive_data',
    'employment_contracts','employee_document_types','employee_documents','job_descriptions',
    'employee_tax_exemptions','work_permits','salary_component_types','salary_components',
    'hr_document_templates','hr_issued_documents','revisal_config','revisal_events']
  loop
    execute format('create trigger set_actor_%I before insert or update on public.%I
                    for each row execute function internal.set_actor()', t, t);
  end loop;
end $$;

Și, până atunci, adaugă explicit în fiecare insert/update:
  created_by: ctx.user.id, updated_by: ctx.user.id
respectiv, pe update-uri (inclusiv soft-delete): updated_by: ctx.user.id
- [CRITIC] src/lib/documents/cale.ts:4
  PROBLEMA: `BUCKET_DOCUMENTE = 'documente'`, dar singurele bucket-uri create sunt `org-documents` și `org-branding` (0002_authz.sql:1461), iar politicile pe `storage.objects` (0002:1470-1495) restrâng explicit la `bucket_id in ('org-documents','org-branding')`. CONFIRMAT pe adm_f2b: `select id from storage.buckets` → org-documents, org-branding. Nu există nici configurare `[storage.buckets.documente]` în supabase/config.toml. Efect: `createSignedUploadUrl`, `download` și `createSignedUrl` întorc „Bucket not found” pe toate cele trei acțiuni de import (pregateste/analizeaza/aplica) și pe toate cele patru de documente. Nici măcar dacă bucket-ul ar fi creat manual n-ar funcționa — RLS pe storage.objects l-ar refuza.
  CORECTIE: export const BUCKET_DOCUMENTE = 'org-documents';

și aliniază limitele cu bucket-ul real: LIMITA_DOCUMENT_BYTES (20 MB) < 26214400 e OK, dar MIME_ACCEPTATE din cale.ts conține `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` iar EXTENSII_ACCEPTATE din excel.ts acceptă și `.xlsm`, al cărui MIME (`application/vnd.ms-excel.sheet.macroEnabled.12`) NU e în `allowed_mime_types` al bucket-ului — încărcarea unui .xlsm va fi respinsă de Storage cu o eroare pe care utilizatorul n-o poate interpreta. Sau scoate .xlsm din EXTENSII_ACCEPTATE, sau adaugă MIME-ul în bucket.
- [CRITIC] src/lib/revisal/genereaza-evenimente.ts:102 și src/domain/revisal/evenimente.ts:313
  PROBLEMA: `genereazaEvenimenteRevisal` și `deduceEvenimenteContract` nu sunt apelate de nicăieri (grep pe tot src/, în afara testelor: zero apelanți). În plus, nicio linie de cod nu setează `status: 'activ'` pe `employment_contracts` — RLS forțează `status = 'proiect'` la INSERT (0005:501) și nu există nicio acțiune de activare. Consecință: `revisal_events` nu se populează NICIODATĂ, nici la editare individuală, nici la import (deși comentariul din genereaza-evenimente.ts:23 afirmă „IMPORTUL ÎN MASĂ apelează EXACT această funcție”). Pagina /revisal afișează în empty-state „Evenimentele REVISAL se creează automat la înregistrarea unui contract, la modificarea salariului, a funcției sau a normei, la suspendare și la încetare” — afirmație falsă care va face un operator de personal să creadă că e în regulă. Netransmiterea unui eveniment e contravenție per salariat.
  CORECTIE: Leagă generatorul de acțiunile care schimbă starea contractului. Minim:

// în creeazaContract / o acțiune nouă activeazaContract
const tipuri = deduceEvenimenteContract(stareVeche, stareNoua);
if (tipuri.length > 0) {
  const r = await genereazaEvenimenteRevisal({
    supabase: db, organizationId: ctx.tenant.organizationId, userId: ctx.user.id,
    evenimente: tipuri.map((tip) => ({
      employeeId: contract.employee_id, contractId: contract.id, tip,
      dataEvenimentului: input.data_eveniment,
      valabilDeLa: contract.valabil_de_la, dataContract: contract.data_contract,
      payload: {},
    })),
  });
  // r.respinse trebuie întors în ActionResult, nu înghițit
}

Apelează-l identic din `inceteazaContract` (tip 'incetare', termen 0 zile!) și din `aplicaImportAngajati`, după bucla de rânduri, cu tot lotul o dată. Până când există, corectează textul empty-state ca să nu mintă.
- [CRITIC] src/lib/hr/criptare.ts:59, :85, :94
  PROBLEMA: `cripteaza`/`decripteaza`/`amprenta` citesc `HR_ENCRYPTION_KEY` și `HR_ENCRYPTION_KEY_VERSION`. Aceste variabile NU există nici în .env.example, nici în .env.local, nici în schema din src/config/env.ts (care validează `HR_ENCRYPTION_KEYS` ca JSON, `HR_ENCRYPTION_ACTIVE_KEY` și `HR_HASH_KEY`). Deci `citesteCheia("HR_ENCRYPTION_KEY")` aruncă „Criptarea datelor de personal nu este configurată pe server” la FIECARE creare/actualizare de angajat care conține CNP sau IBAN și la fiecare `dezvaluieDateSensibile`. În plus există două stive paralele: formularul folosește lib/hr/criptare.ts (o singură cheie, `keyVersion` numeric), importul folosește lib/crypto/aes-gcm.ts (hartă de chei, `keyVersion` string). Chiar configurate ambele, `decripteaza()` aruncă dacă `keyVersion !== versiuneaCurenta()`, deci datele scrise de import ar deveni indescifrabile din UI, iar rotația de chei pe care aes-gcm.ts o proiectează explicit e imposibilă prin acest drum.
  CORECTIE: Șterge src/lib/hr/criptare.ts și src/domain/hr/{cnp,iban}.ts; folosește o singură stivă, cea validată de env.ts:

// src/app/(app)/angajati/actions.ts
import { encrypt, decrypt, amprentaSensibila } from '@/lib/crypto/aes-gcm';

const c = encrypt(cnp);
const bytea = (b: Buffer) => `\\x${b.toString('hex')}`;
... cnp_ciphertext: bytea(c.ciphertext), cnp_iv: bytea(c.iv), cnp_tag: bytea(c.tag),
    cnp_key_version: Number(c.keyVersion), cnp_hash: amprentaSensibila(cnp)

La citire folosește `decrypt`, care alege cheia după `key_version` de pe rând în loc să refuze versiunile vechi.
- [CRITIC] src/lib/import/excel.ts:67-104
  PROBLEMA: `await registru.xlsx.load(buffer)` parsează TOT registrul în memorie înainte ca `LIMITA_RANDURI = 1000` să fie aplicată (limita se folosește abia la :90, peste `foaie.rowCount`, care e deja rezultatul parsării). Limita de fișier de 5 MB nu protejează: XLSX e ZIP, raportul de compresie pe date tabulare repetitive e ~150:1. CONFIRMAT empiric în acest repo (node + exceljs 4.4): un .xlsx cu 260.000 de rânduri × 3 coloane are 3,23 MB (sub limită) și `xlsx.load()` îl încarcă în 2,0 s cu heapUsed = 528 MB / RSS = 708 MB; la 5 MB se depășește 1 GB. Nu e nevoie de zip bomb, e un fișier Excel perfect legitim. Câteva încărcări simultane pun jos instanța de server. `nrColoane = foaie.columnCount` e la fel neplafonat (16.384 coloane × 1000 rânduri = 16 M intrări în Map).
  CORECTIE: Folosește cititorul în flux, care oprește la limită FĂRĂ să încarce restul:

import * as ExcelJS from 'exceljs';
const reader = new ExcelJS.stream.xlsx.WorkbookReader(streamDinBuffer, {
  worksheets: 'emit', sharedStrings: 'cache', entries: 'emit',
});
let n = 0;
for await (const ws of reader) {
  for await (const row of ws) {
    if (++n > LIMITA_RANDURI + 1) { trunchiat = true; break; }
    ...
  }
  break; // doar prima foaie
}

Plafonează explicit și coloanele:
const nrColoane = Math.min(Math.max(foaie.columnCount, 1), 64);

Și coboară LIMITA_FISIER_BYTES la ~2 MB — 1000 de rânduri × 30 de coloane nu depășesc 200 KB comprimat.
- [MARE] supabase/migrations/0004_hr.sql:275-277 (vs. comentariul de la :188-192)
  PROBLEMA: 0004:188-192 declară explicit că se acceptă cumulul de funcții — „aceeași persoană poate avea două fișe active la aceeași firmă … de aceea NU punem UNIQUE(organization_id, user_id)”. Dar `employee_sensitive_cnp_hash_uniq` e UNIQUE pe (organization_id, cnp_hash), iar `employee_sensitive_data` are PK pe `employee_id`, deci fiecare fișă are rândul ei — a doua fișă a aceleiași persoane nu poate stoca același CNP. CONFIRMAT pe adm_f2b: două fișe (C001 is_primary=true, C002 is_primary=false), aceeași `cnp_hash` → `ERROR: duplicate key value violates unique constraint "employee_sensitive_cnp_hash_uniq"`. Fără CNP, `verificaIntrare` din export.ts:89 marchează evenimentul ca BLOCANT, deci a doua fișă nu poate fi transmisă la REVISAL. Al doilea defect al cumulului: `app.current_employee_id` (0005:16-30) filtrează pe `is_primary`, deci pentru fișa secundară `can_see_employee(..., 'own')` e fals — persoana își vede fișa în listă (employees_select scope 'own' merge pe `user_id`), dar nu-și vede contractul, documentele și adeverințele de pe ea.
  CORECTIE: Indexul de deduplicare CNP trebuie să prevină al doilea CNP pe ACEEAȘI fișă, nu a doua fișă a aceleiași persoane:

drop index public.employee_sensitive_cnp_hash_uniq;
-- deduplicarea rămâne un AVERTISMENT în aplicație („există deja o fișă cu acest CNP —
-- este cumul de funcții?”), nu o constrângere de bază de date.
create index employee_sensitive_cnp_hash_idx
  on public.employee_sensitive_data (organization_id, cnp_hash)
  where cnp_hash is not null and deleted_at is null;

Și extinde vizibilitatea proprie la toate fișele:
create or replace function app.current_employee_ids(p_org uuid) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(e.id), '{}'::uuid[]) from public.employees e
  where e.organization_id = p_org and e.user_id = (select auth.uid()) and e.deleted_at is null
$$;
-- can_see_employee: when 'own' then p_employee = any (app.current_employee_ids(p_org))
- [MARE] src/app/(app)/angajati/actions.ts:272-342
  PROBLEMA: `inceteazaContract` păstrează corect istoricul (nu șterge fișa, setează terminated_on și status), dar (a) NU generează evenimentul REVISAL de încetare — al cărui termen configurat e 0 zile lucrătoare, adică „cel târziu la data încetării” (0004:1038); ratarea lui e contravenție, iar acțiunea nu lasă nicio urmă în revisal_events; (b) nu atinge deloc subalternii. `manager_employee_id` și `manager_path` ale subordonaților continuă să conțină managerul plecat, iar `app.is_manager_of` (0005:40-55) și `app.current_employee_id` (0005:16-30) filtrează DOAR pe `deleted_at is null`, nu și pe `status`/`terminated_on`. Deci un manager încetat, cât timp `organization_members` îi rămâne activ, păstrează vizibilitate `scope='team'` peste toată echipa, iar organigrama arată un șef care nu mai lucrează acolo. (c) Acțiunea e oricum inaccesibilă: nu e importată de nicio pagină (pagina /angajati/[id] doar afișează contractele, read-only).
  CORECTIE: 1. Adaugă generarea evenimentului, în aceeași acțiune, după update-ul contractului:
   await genereazaEvenimenteRevisal({ supabase: db, organizationId, userId: ctx.user.id,
     evenimente: [{ employeeId: contract.employee_id, contractId: contract.id, tip: 'incetare',
       dataEvenimentului: input.incetat_la, valabilDeLa: contract.valabil_de_la,
       dataContract: contract.data_contract, payload: { temei: input.temei_incetare } }] });

2. Cere explicit un înlocuitor și mută subalternii, în aceeași tranzacție logică:
   input: ...incetareContractSchema.extend({ manager_inlocuitor_id: z.uuid().nullable() })
   await db.from('employees').update({ manager_employee_id: input.manager_inlocuitor_id,
     updated_by: ctx.user.id }).eq('manager_employee_id', contract.employee_id)
     .eq('organization_id', organizationId).is('deleted_at', null);
   (trigger-ul employees_manager_path_cascade_aiu recalculează manager_path)

3. Filtrează angajații ieșiți din helperii de acces:
   -- app.current_employee_id și app.is_manager_of
   and e.status not in ('incetat','arhivat')
- [MARE] src/lib/documents/adeverinte.ts:61-71, :156-189
  PROBLEMA: Numerotarea NU e atomică și NU folosește `document_sequences`, deși 0004:626 documentează exact invers („numar bigint not null — alocat prin public.document_sequences”); tabela există din 0001 (unique pe organization_id, document_type, year, cu next_number) și e complet nefolosită (grep: zero referințe în src/ în afara tipurilor generate). `urmatorulNumar` face MAX(numar)+1 sub RLS, iar retry-ul pe 23505 e o buclă cu 5 încercări care RECITEȘTE aceeași valoare: `hr_issued_select` (0005:872-878) filtrează `deleted_at is null` și `app.can_see_employee(...)`, în timp ce `hr_issued_org_serie_numar_uniq` NU e parțial. Deci de îndată ce o adeverință e ștearsă logic sau aparține unui angajat pe care operatorul nu-l vede, MAX vizibil rămâne sub MAX real, toate cele 5 încercări cer același număr, toate primesc 23505, iar numerotarea se blochează DEFINITIV cu „Numerotarea adeverințelor este ocupată”. Separat: `numar_afisat` include anul (`ADEV 2026/000123`) dar `numar` nu se resetează pe an, deci în 2027 seria continuă cu 000124. Și, oricum, `genereazaAdeverinta` nu are niciun apelant — nu există nici acțiune, nici pagină; funcționalitatea de adeverințe e inaccesibilă.
  CORECTIE: Alocă numărul atomic, în baza de date, cu funcția care există deja pentru asta:

create or replace function public.aloca_numar_document(p_org uuid, p_tip text, p_an int)
returns int language plpgsql volatile security definer set search_path = '' as $$
declare v int;
begin
  insert into public.document_sequences (organization_id, document_type, year, next_number)
  values (p_org, p_tip, p_an, 1)
  on conflict (organization_id, document_type, year)
  do update set next_number = public.document_sequences.next_number + 1
  returning next_number into v;   -- UPDATE ia lock pe rând ⇒ serializare reală
  return v;
end $$;

În adeverinte.ts, înlocuiește urmatorulNumar + bucla de 5 încercări cu un singur apel
`supabase.rpc('aloca_numar_document', { p_org, p_tip: 'adeverinta', p_an: Number(an) })`,
iar `numar_afisat` devine `${serie} ${an}/${padStart(numar,6)}` cu numerotare per an, coerentă cu `document_sequences`. Expune apoi funcționalitatea printr-o Server Action + pagină.
- [MARE] src/app/(app)/revisal/actions.ts:20-22 și :96-99
  PROBLEMA: Permisiunea verificată la afișare diferă de cea verificată în acțiune (încălcare S2/S3). `actiuneMarcheazaTransmis` declară `permission: 'compliance:read'` deși face UPDATE pe revisal_events (marchează evenimentul ca transmis la ITM, cu număr de înregistrare); pagina, la revisal/page.tsx:49, calculează `poateActualiza` din `compliance:update` și doar atunci afișează butonul. `actiuneExporta` declară tot `compliance:read`, în timp ce page.tsx:50 gatează butonul pe `compliance:export`. Un utilizator cu compliance:read='all' și compliance:update='none' (configurabil per organizație — role_permissions are organization_id) nu vede butonul, dar poate apela direct Server Action-ul și poate falsifica registrul de conformitate: marchează ca „transmis la ITM” evenimente care n-au fost transmise, ascunzând întârzierile din statisticile paginii.
  CORECTIE: Aliniază permisiunea acțiunii cu operația reală și cu ce gatează UI-ul:

const actiuneMarcheazaTransmis = createAction({
  ...
  permission: 'compliance:update',   // era 'compliance:read'
  minScope: 'all',
});

const actiuneExporta = createAction({
  ...
  permission: 'compliance:export',   // era 'compliance:read'
  minScope: 'all',
});

Adaugă și un test care apelează acțiunea cu un rol care are read='all' și update/export='none' și verifică refuzul.
- [MARE] src/app/(app)/angajati/import/actions.ts:119-198
  PROBLEMA: Importul pierde tăcut date pe care le-a validat. (a) `manager_marca` e definit ca alias în mapare.ts:31, validat în validare.ts:107 și inclus în lotul salvat — dar `importaUnRand` nu-l folosește NICIODATĂ (grep: zero apariții în actions.ts). O firmă care importă 300 de angajați cu coloana „Șef direct” obține o organigramă complet plată, iar `scope='team'` nu arată nimic niciunui manager. (b) Contractul se creează doar dacă `numar_contract` ȘI `salariu` sunt amândouă prezente (:173). Dacă fișierul are salariul dar nu numărul de CIM (sau invers), contractul nu se creează și salariul se pierde — fără niciun avertisment în `esuate` și fără nicio mențiune în sumarul de previzualizare, care raportează rândul drept „valid”.
  CORECTIE: (a) Rezolvă managerul într-un al doilea pas, după ce tot lotul e inserat (marca șefului poate apărea mai jos în fișier):

// după bucla de rânduri din aplicaImportAngajati, când `gata === true`
const { data: fise } = await ctx.supabase.from('employees')
  .select('id, marca').eq('organization_id', organizationId).is('deleted_at', null);
const dupaMarca = new Map(fise?.map((f) => [f.marca.toLowerCase(), f.id]) ?? []);
for (const a of lot.data) {
  if (a.manager_marca === undefined) continue;
  const mgr = dupaMarca.get(a.manager_marca.toLowerCase());
  if (mgr === undefined) { esuate.push({ rand: a.rand, marca: a.marca,
    mesaj: `Marca șefului „${a.manager_marca}” nu există în organizație.` }); continue; }
  await ctx.supabase.from('employees').update({ manager_employee_id: mgr, updated_by: ctx.user.id })
    .eq('marca', a.marca).eq('organization_id', organizationId);
}

(b) Transformă combinația incompletă în eroare de rând, la validare, nu în tăcere:
schemaAngajatValidat.superRefine((v, ctx) => {
  if ((v.numar_contract === undefined) !== (v.salariu === undefined)) {
    ctx.addIssue({ code: 'custom', path: ['numar_contract'],
      message: 'Pentru a crea contractul sunt necesare atât numărul de contract, cât și salariul de bază.' });
  }
});
- [MARE] src/app/(app)/angajati/import/actions.ts:103-117
  PROBLEMA: `idDupaCheie` interpolează valoarea brută din celula Excel direct într-un filtru PostgREST: `.or(`cod.ilike.${denumire},denumire.ilike.${denumire}`)`. Două probleme reale. (1) `ilike` interpretează `%` și `*` ca metacaractere: o celulă „Departament” care conține `%` sau `*` se potrivește cu ORICE departament, iar `.limit(1)` fără `.order()` alege unul nedeterminist — angajatul e atașat tăcut la un departament greșit, ceea ce în ERP-ul ăsta se propagă în `scope='team'`, în organigramă și în centrele de cost. (2) virgula din valoare rupe expresia `or()` și permite injectarea de condiții proprii (ex. `IT,activ.eq.false`); RLS limitează dauna la propriul tenant, dar interogarea returnează alte rânduri decât cele cerute. `idDupaCheie` nici nu filtrează pe `activ = true`, deci potrivește și nomenclatoare dezactivate.
  CORECTIE: Nu construi filtre din text de utilizator. Fă potrivirea exactă, în două interogări, și normalizează în TypeScript:

async function idDupaCheie(ctx, tabel, denumire) {
  const cheie = denumire.trim();
  const { data } = await ctx.supabase
    .from(tabel)
    .select('id, cod, denumire')
    .eq('organization_id', ctx.tenant.organizationId)
    .eq('activ', true)
    .is('deleted_at', null)
    .limit(500);
  const n = (s: string) => s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().trim();
  return data?.find((r) => n(r.cod) === n(cheie) || n(r.denumire) === n(cheie))?.id ?? null;
}

(Sau, dacă vrei să rămână în DB, folosește `.eq('cod', cheie)` și, separat, `.eq('denumire', cheie)` — niciodată `.or()` cu text neescapat.)
- [MARE] src/domain/employee/cnp.test.ts:137 și src/domain/hr/cnp.ts:41
  PROBLEMA: `pnpm test` e ROȘU: 1 test picat din 175. Fixtura „respinge o dată de naștere din viitor” folosește prefixul `512310101234`, care se descompune în sex=5, an=12, LUNA=31 — o lună inexistentă — deci implementarea întoarce corect `data_nasterii`, nu `in_viitor`. Testul e greșit, dar efectul e că ramura `in_viitor` (singura care primește `astazi`) rămâne netestată și CI-ul e blocat. Mai grav: validatorul TESTAT (`src/domain/employee/cnp.ts`) NU e cel folosit de aplicație — `src/schemas/employee.ts:6` importă `validateazaCnp` din `src/domain/hr/cnp.ts`, care nu are NICIUN test și e mai permisiv: acceptă cifra de sex 9, nu respinge numărul de ordine `000`, iar pentru rezidenții străini (7/8/9) sare complet peste verificarea calendaristică a datei de naștere. Al treilea validator, `areCnpCifraControlValida` + `dataNasteriiDinCnp` din `src/domain/import/validare.ts:15-35`, acceptă `zi <= 31` pentru orice lună când secolul nu e determinabil (deci 30 februarie trece la import).
  CORECTIE: 1. Corectează fixtura (prefix cu lună/zi valide și an în viitor):
   valideazaCnp(construiesteCnp('531010101234'), { astazi: '2026-08-17' })  // 2031-01-01

2. Elimină duplicarea: păstrează `src/domain/employee/cnp.ts` (cel testat, cel mai strict) și rescrie schema formularului pe el:
   // src/schemas/employee.ts
   import { valideazaCnp, normalizeazaCnp } from '@/domain/employee/cnp';
   cnp: z.string().transform(normalizeazaCnp)
     .refine((v) => valideazaCnp(v, { astazi: todayInBucharest() }).valid,
             (v) => ({ message: (valideazaCnp(v) as CnpInvalid).mesaj }))
   Șterge src/domain/hr/cnp.ts și src/domain/hr/iban.ts, și înlocuiește
   `areCnpCifraControlValida`/`dataNasteriiDinCnp` din import/validare.ts cu același `valideazaCnp`.
- [MARE] src/domain/revisal/export.ts:228-259 și src/app/(app)/revisal/actions.ts:~170
  PROBLEMA: `laCsv(rezultat)` scrie `rezultat.intrari` — TOATE intrările, inclusiv cele cu probleme BLOCANTE (fără CNP, fără cod COR de 6 cifre, fără temei legal de încetare, contract determinat fără dată de sfârșit). `rezultat.probleme` nu ajunge deloc în fișier, iar `gataDeTransmis` nu e folosit la filtrare. Operatorul descarcă un „listing” în care rândurile netransmisibile arată identic cu cele complete; singurul indiciu e un text efemer din UI („N complete, M au date lipsă”), care dispare la refresh. În plus, `codEveniment` e hardcodat `null` în actions.ts, deși `revisal_config.cod_revisal` conține exact codurile de eveniment ('A', 'MS', 'MF', 'I'…) — coloana „Cod” din CSV e mereu goală. Separat: exportul citește `cnp_last4` din `employee_sensitive_data`, a cărei politică cere `employees.read = 'all'`; un responsabil de conformitate care are compliance:read dar nu employees:read primește zero rânduri și fiecare intrare capătă problema blocantă „nu are CNP înregistrat” — mesaj care acuză datele în locul permisiunii.
  CORECTIE: 1. Marchează starea în fișier și adaugă motivul, ca listingul să fie autoportant:

const ANTET = ['Stare', 'Probleme', 'Tip eveniment', 'Cod', ...];
const blocante = new Map<string, string[]>();
for (const p of rezultat.probleme) if (p.blocant) blocante.set(p.evenimentId, [...(blocante.get(p.evenimentId) ?? []), p.mesaj]);
// pe rând:
const probleme = blocante.get(intrare.evenimentId);
[ probleme === undefined ? 'GATA' : 'INCOMPLET', probleme?.join(' | ') ?? '', ... ]

2. Trimite codul real: încarcă `revisal_config` în acțiune (`incarcaConfigurariRevisal` există deja) și pune `codEveniment: alegeConfigurare(configurari, tip, data)?.cod_revisal ?? null`.

3. Distinge lipsa de permisiune de lipsa datei:
if (sensibile.data === null || sensibile.data.length === 0) {
  throw businessRule('Exportul REVISAL are nevoie de dreptul „Angajați — citire (toți)” ca să poată citi CNP-urile. Solicitați-l administratorului.');
}
- [MEDIU] src/app/(app)/revisal/actiuni-client.tsx:101-142 și src/app/(app)/revisal/page.tsx:64-72
  PROBLEMA: Antetul modulului `src/domain/revisal/export.ts:1-9` avertizează corect și explicit că formatul oficial ReviSal NU este confirmat și că CSV-ul e o soluție INTERIMARĂ de validat cu Inspecția Muncii. Nimic din asta nu ajunge la utilizator: butonul spune doar „Descarcă listing (CSV)”, iar pagina nu are niciun banner. Un operator de personal va presupune rezonabil că fișierul se importă în aplicația ReviSal, va încerca, va eșua și — mai rău — poate considera obligația îndeplinită. Numele fișierului (`revisal-<cui>-<data>.csv`) întărește impresia că e fișierul oficial.
  CORECTIE: Mută avertismentul în interfață, lângă butonul care produce fișierul:

<p className="rounded-md bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-300">
  Fișierul de mai jos este un <strong>listing de lucru</strong>, pentru verificare și pentru
  introducerea manuală în aplicația ReviSal. NU este fișierul oficial de import al Inspecției
  Muncii — specificația se obține de la ITM și <strong>nu a fost încă validată</strong>.
  Transmiterea rămâne în responsabilitatea operatorului.
</p>

și redenumește fișierul: `revisal-listing-verificare-${cui}-${azi}.csv`.
- [MEDIU] src/lib/revisal/genereaza-evenimente.ts:93-96 și src/domain/revisal/evenimente.ts:113-143
  PROBLEMA: `construiesteCalendar(anInceput, anSfarsit, suplimentare)` acceptă zile libere suplimentare, dar `calendarPentruAnul` nu îi pasează niciodată nimic și nu există nicio tabelă din care ar putea veni. România declară aproape în fiecare an, prin hotărâre de guvern, zile libere suplimentare („punți”) care SUNT zile nelucrătoare în sensul art. 139 și deci contează la calculul termenelor în zile lucrătoare. Cu lista fixă din cod, un termen de 20 de zile lucrătoare calculat peste o astfel de punte iese cu o zi mai devreme decât cel legal, iar termenul de angajare (−1 zi lucrătoare față de `valabil_de_la`) poate cădea chiar pe o zi liberă — evenimentul apare „în termen” într-o zi în care nu se poate depune. Comentariul de la :110-112 recunoaște problema („DE CONFIRMAT anual cu juristul; zilele suplimentare se pot injecta din configurare”), dar configurarea nu există. Secundar: `calendarPentruAnul` reconstruiește calendarul (5 ani de Paște ortodox) în interiorul buclei, o dată per eveniment.
  CORECTIE: Adaugă tabela lipsă și pasează-o:

create table public.zile_libere_suplimentare (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade, -- null = platformă
  zi date not null, temei text, created_at timestamptz not null default now(),
  ...
);
create unique index zile_libere_uniq on public.zile_libere_suplimentare (coalesce(organization_id,'00000000-0000-0000-0000-000000000000'::uuid), zi) where deleted_at is null;

// genereaza-evenimente.ts — construiește calendarul O SINGURĂ DATĂ, în afara buclei
const suplimentare = await incarcaZileLibere(supabase, organizationId);
const anRef = Number(evenimente[0].dataEvenimentului.slice(0,4));
const calendar = construiesteCalendar(anRef - 1, anRef + 1, suplimentare);
for (const eveniment of evenimente) { /* folosește `calendar`, nu calendarPentruAnul(...) */ }
- [MEDIU] supabase/migrations/0004_hr.sql:951-969
  PROBLEMA: 0004 creează 16 tabele noi, le pune `enable/force row level security` și le atașează audit, dar nu emite niciun GRANT pentru rolul `authenticated`. Singurul grant e în 0001:642 (`grant select, insert, update on all tables in schema public to authenticated`), care se aplică doar tabelelor existente ATUNCI, și nu există niciun `alter default privileges ... grant on tables`. CONFIRMAT pe adm_f2b (Postgres 17 curat, migrările aplicate în ordine): ca `authenticated` cu org_admin, `insert into public.employees` → `ERROR: permission denied for table employees`, la fel `departments`. Pe Supabase găzduit merge accidental, prin default privileges configurate global pentru rolul `postgres` — dar `scripts/reset-test-db.sh` face DROP SCHEMA public, ceea ce șterge intrările din pg_default_acl legate de schema respectivă. Consecință directă asupra corectitudinii testelor: în suita RLS, o tentativă cross-tenant care ar trebui să eșueze prin politică eșuează în schimb prin lipsă de privilegiu (42501 în ambele cazuri) — testul de izolare trece fals-pozitiv, exact scenariul pe care fixture.ts îl documentează ca inacceptabil.
  CORECTIE: Adaugă la finalul lui 0004 (înainte de commit) și, ca plasă de siguranță, default privileges:

grant select, insert, update on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
alter default privileges in schema public grant select, insert, update on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;

Și adaugă în tests/rls o aserțiune care distinge cele două refuzuri: pentru fiecare tabelă cu tenant, un SELECT ca proprietar legitim trebuie să întoarcă ≥1 rând (dovadă că privilegiul există) ÎNAINTE de a valida că userul din cealaltă organizație primește 0 rânduri.