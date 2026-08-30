# Funcția pe fișă — desființarea nomenclatorului de funcții

**Data:** 2026-08-30 · **Stare:** aprobat în discuție, neimplementat

## 1. De ce

Modulul „Funcții" cere un pas separat înainte de a putea angaja pe cineva: intri în
nomenclator, definești o funcție cu cod, denumire, cod COR, nivel de studii și
descriere, abia apoi te întorci în fișa angajatului și o alegi dintr-un `<select>`.
Pentru o firmă cu opt oameni, pasul ăsta e o taxă pură — o tabelă întreagă, o pagină,
trei Server Actions și un `<select>` care se poate goli, pentru un atribut care în
practică e un text și un cod din nomenclatorul COR.

Cerința, textual: _„aș vrea cumva să eliminăm modulul de funcție, că aduce prea multă
complexitate; să păstrăm de acolo direct în cadrul onboardingului de angajat doar
numele funcției și codul COR, codul COR să-ți dea să alegi ca acum"_.

Există și un al doilea motiv, care nu ține de complexitate ci de corectitudine — vezi
§3.

## 2. Starea de acum, măsurată

Interogare pe baza reală (2026-08-30):

| Ce                                             | Rânduri |
| ---------------------------------------------- | ------- |
| `job_positions` active                         | 6       |
| angajați cu funcție                            | 8 din 12 |
| contracte cu funcție                           | 8       |
| reguli de concediu pe funcție                  | **0**   |
| reguli de bonus pe funcție                     | **0**   |
| riscuri SSM pe funcție                         | **0**   |
| fișe de post (`job_descriptions`)              | **0**   |
| șabloane de checklist pe funcție               | **1**   |

Nomenclatorul e citit din ~40 de fișiere, dar aproape nimic nu se _sprijină_ pe el:
un singur rând din toată baza folosește funcția drept criteriu de regulă.

## 3. Decizia de fond: codul COR se mută pe contract

Azi `cod_cor` stă pe `job_positions`, iar contractul ajunge la el prin cheie străină
(`reconciliere.ts:170`, `queries/reges.ts:529`). Consecința e un defect tăcut, nu doar
o inconveniență: **schimbarea codului COR al unei funcții rescrie retroactiv ce se
declară la ITM pentru toate contractele semnate vreodată pe funcția aceea.** Un cod COR
e o declarație făcută la un moment dat, nu un atribut viu al unui nomenclator.

După schimbare, `cod_cor` e o coloană pe `employment_contracts`, scrisă la semnare și
înghețată acolo. `employees.cod_cor` rămâne valoarea „curentă", cea care se propagă în
contractul următor.

## 4. Schema — două migrări, deliberat

Baza e **aceeași pentru dev și pentru producție** (memoria proiectului:
„O singură bază dev+prod"). O migrare unică ce șterge `job_position_id` ar doborî
build-ul aflat în producție în fereastra dintre aplicarea migrării și deploy: codul
livrat încă face `select("job_position_id")`, iar Postgres răspunde 42703.

### 0108 — aditivă, inofensivă pentru codul vechi

```sql
alter table public.employees
  add column functie text,
  add column cod_cor text;
alter table public.employment_contracts
  add column functie text,
  add column cod_cor text;
```

cu, pe fiecare: `check (cod_cor is null or cod_cor ~ '^[0-9]{6}$')` și
`check (functie is null or char_length(btrim(functie)) between 2 and 160)`.

Backfill din nomenclator, pentru toate cele patru tabele de reguli plus cele două de
mai sus:

```sql
update public.employees e
   set functie = jp.denumire, cod_cor = jp.cod_cor
  from public.job_positions jp
 where jp.id = e.job_position_id;
```

Cele **patru** tabele de reguli — `leave_entitlement_rules`, `course_assignment_rules`,
`checklist_templates`, `payroll_bonus_rules` — primesc `cod_cor text` și backfill
identic. (`payroll_bonus_rules` nu apăruse în discuția inițială; are `tip_criteriu =
'functie'` și aceeași cheie străină, deci același tratament.)

Index parțial pe `employees (organization_id, cod_cor) where deleted_at is null`, ca
regulile pe ocupație să nu scaneze tabela.

### 0109 — distructivă, aplicată DUPĂ ce noul build rulează

Ștergerea lui `job_position_id` din `employees`, `employment_contracts` și cele patru
tabele de reguli. Nu e un `drop column` simplu: **cinci constrângeri CHECK enumeră
coloana** și trebuie rescrise în aceeași migrare —

| Tabelă                   | Constrângere                       |
| ------------------------ | ---------------------------------- |
| `leave_entitlement_rules` | `ler_criteriu_ck`                  |
| `payroll_bonus_rules`     | `pbr_criteriu_ck`                  |
| `course_assignment_rules` | `course_assignment_rules_criteriu_ck` |
| `job_descriptions`        | `job_descriptions_tinta`           |
| `leave_entitlement_rules` | indexul unic cu `coalesce(job_position_id, …)` (`0035:151`) |

Fiecare devine aceeași regulă scrisă pe `cod_cor`. `job_descriptions` și
`risk_assessments` au 0 rânduri și zero UI: coloanele lor rămân neatinse, iar tabela
`job_positions` rămâne pe disc, necitită de nimic.

## 5. Funcțiile SQL — trei, toate rescrise în 0109

Interogare pe `pg_proc`: trei funcții citesc `job_position_id` în corp.

| Funcție                            | Ce face                                | Schimbarea                                     |
| ---------------------------------- | -------------------------------------- | ---------------------------------------------- |
| `app.drept_concediu`               | evaluează regulile de concediu         | `v_job_position = r.job_position_id` → `cod_cor` |
| `internal.cursuri_aplica_regulile` | atribuie cursuri după criterii         | `e.job_position_id = v_regula.job_position_id` → `cod_cor` |
| `public.checklist_salveaza_sablon` | RPC de salvare a șablonului (JSON)     | cheia `job_position_id` din payload → `cod_cor` |

Fiecare își păstrează `search_path = ''` și coada `revoke`/`grant` existentă.

## 6. Straturile TypeScript

| Fișier                                            | Schimbarea                                                                 |
| ------------------------------------------------- | -------------------------------------------------------------------------- |
| `lib/queries/employees.ts`                        | `EMBED_FUNCTIE` dispare; `functiiActive()` → `functiiFolosite()` (denumiri distincte din `employees`, pentru sugestii și filtru) |
| `lib/queries/{departments,cursuri,leave,panou,reges,portal,checklist}.ts` | embed `job_positions!…` → coloană simplă                   |
| `lib/reges/reconciliere.ts`                       | `contract.job_positions?.cod_cor` → `contract.cod_cor`                     |
| `lib/documents/{adeverinte,context-angajat}.ts`   | **cade a doua interogare** — funcția e pe rândul deja citit                |
| `app/(app)/angajati/import/actions.ts`            | „funcție" devine text; dispare find-or-create-ul de nomenclator            |
| `app/(app)/angajati/nou/actions.ts`               | potrivirea șablonului de checklist: `job_position_id` → `cod_cor`          |
| `schemas/{employee,leave,cursuri,checklist}.ts`   | `job_position_id: uuid` → `cod_cor: codCor`                                |
| `schemas/comun.ts`                                | primește `codCorOptional`, mutat ca atare din `schemas/job-position.ts`. Verifică deja și formatul `^[0-9]{6}$`, și existența în nomenclator (`codCorExista`, 4422 de ocupații) — nu are nevoie de întărire, doar de un domiciliu comun, fiindcă `schemas/job-position.ts` dispare |
| `components/cauta-cor.tsx`                        | mutat din `app/(app)/functii/`, ca să-l poată folosi și fișa, și ecranele de reguli |

## 7. Interfața

### Fișa angajatului — secțiunea „Încadrare"

Un singur buton „Schimbă", care deschide un dialog cu patru câmpuri. Toate patru sunt
coloane pe `employees`, deci **o acțiune, o permisiune** (`employees:update`, `minScope:
"all"`):

```
Funcție         [Sudor______________________]   text liber + datalist cu ce se folosește deja
Cod COR         [721208 · Sudor manual______]   CautaCor; alegerea completează denumirea dacă e goală
Departament     [Producție                 ▾]
Manager direct  [Ionescu Maria             ▾]
```

Acțiunea nouă `actualizeazaIncadrarea` înlocuiește `atribuieFunctia`. **Nu** se
refolosește `actualizeazaAngajat`: schema ei are 36 de câmpuri cu `.default(…)`, iar un
payload de patru câmpuri ar trece de validare și ar scrie `null` peste restul fișei —
motivul e deja documentat în cod, lângă `atribuieFunctiaSchema`.

Verificări obligatorii în handler, moștenite de la `atribuieFunctia`:

- departamentul și managerul aleși se verifică **explicit** că aparțin organizației —
  cheile străine sunt simple, fără componentă pe `organization_id`, deci baza n-ar opri
  un departament împrumutat din altă firmă;
- `.select()` după `.update()` — `employees_update` refuză prin `USING` cu **zero
  rânduri și fără eroare**, iar fără verificarea rezultatului gol un refuz ar ajunge pe
  ecran drept succes;
- managerul ales nu poate fi angajatul însuși și nici cineva din subordinea lui —
  `manager_path` e menținut de trigger, dar un ciclu l-ar face să se umfle tăcut.

### Comutatorul „Șef de departament"

**Separat** de dialog, fiindcă scrie în altă tabelă (`departments.manager_employee_id`)
și cere altă permisiune (`departments:update`, all). Refolosește mecanismul livrat în
`3c9747a`: șef de departament ⇒ rol `manager`, acordat **doar dacă apelantul e
`org_admin`** (`organization_members_update` cere `app.has_role(org, ['org_admin'])`;
un `hr` are `departments:update = all` și niciun drept asupra rolurilor — atunci se
emite semnal, nu eroare). Comutatorul se randează doar când angajatul are departament.

### Restul ecranelor

- `angajati/nou`, pasul 3 (contract) și `angajati/[id]/editeaza`: `<select>`-ul de
  funcție devine aceleași două câmpuri (denumire + `CautaCor`).
- `angajati` (lista): filtrul pe `job_position_id` devine filtru pe denumire, alimentat
  de `functiiFolosite()`.
- `concedii/setari`, `cursuri/[id]/reguli`, `onboarding/sabloane`, regulile de bonus:
  criteriul „Funcție" folosește `CautaCor` în locul `<select>`-ului de nomenclator.

## 8. Ce dispare

`src/app/(app)/functii/**` (10 fișiere) · `src/lib/queries/job-positions.ts` și testul
lui · `src/schemas/job-position.ts` (rămâne doar `codCorOptional`, mutat) · intrarea
`functii` din `src/config/navigation.ts` · faptul „N funcții" din panou · acțiunile
`job_positions.create` / `.update` / `.deactivate`.

Permisiunile nu se ating: pagina `/functii` era păzită de `departments:read`, care
rămâne folosită de `/departamente`.

## 9. Verificarea

Ordinea contează, și e inversul intuiției:

1. migrarea 0108 pe **bancul local** (`banc-migrare.sh`), apoi pe cloud prin `psql`,
   byte-exact;
2. **regenerarea tipurilor din bancul local**, nu din cloud (memoria proiectului:
   „Regenerarea tipurilor"), cu cele două patch-uri manuale reaplicate;
3. abia apoi `pnpm typecheck` — care devine lista de treabă: compilatorul enumeră
   fiecare consumator rămas. Invers (întâi codul), `database.ts` încă descrie coloana
   veche, typecheck-ul trece verde și 42703 apare la runtime;
4. teste noi: `codCorOptional` contra nomenclatorului, potrivirea șablonului de
   checklist pe `cod_cor`, `queries/coloane.test.ts` ca poartă pe coloane;
5. `/proba` — scriere reală per rol pe `employees` update din fișă și pe
   `departments.manager_employee_id`, în tranzacții derulate înapoi;
6. `pnpm typecheck && pnpm lint && pnpm test`. **`pnpm build` rămâne al utilizatorului**
   (instrucțiune permanentă) — se raportează explicit ce rămâne de prins de build:
   granița server/client pe componenta `CautaCor` mutată.

## 10. Ce NU se face

- Nu se șterge tabela `job_positions` și nu se șterg coloanele din `job_descriptions` /
  `risk_assessments`. Zero rânduri, zero UI, zero câștig — și un `drop table` e singura
  operație din tot planul care n-are drum înapoi.
- Nu se migrează `nivel_studii` și `descriere` de pe funcție nicăieri. Nu le citește
  nimic (`0069:12` o spune deja: „singurul «nivel» din schemă era
  `job_positions.nivel_studii`, care e cu totul altceva").
- Nu se atinge sistemul de permisiuni.
