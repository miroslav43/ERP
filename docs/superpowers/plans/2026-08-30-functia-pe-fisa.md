# Funcția pe fișă — plan de implementare

> **Pentru executanți:** planul se execută **direct, cu `Write`/`Edit`**, în sesiunea
> curentă. Memoria proiectului interzice fan-out-ul de agenți de implementare (6 agenți
> paraleli ⇒ 91 de erori de compilare din căi de import inventate). Pașii sunt bife
> (`- [ ]`) ca să se poată relua.

**Scop:** funcția unui angajat devine o denumire liberă plus un cod COR ales din
nomenclator, scrise direct pe fișă și înghețate pe contract; nomenclatorul
`job_positions`, pagina `/functii` și intrarea lui din meniu dispar; secțiunea
„Încadrare" a fișei devine editabilă de administrator.

**Arhitectură:** două migrări — una aditivă aplicată înainte de cod, una distructivă
aplicată după ce noul build rulează, fiindcă dev și producția împart aceeași bază.
Între ele, codul migrează consumator cu consumator, cu `tsc` drept listă de treabă după
regenerarea tipurilor.

**Stack:** Next.js 16.3 · React 19.2 · Zod 4 · Supabase Postgres 17 · vitest · pnpm 10

**Spec:** `docs/superpowers/specs/2026-08-30-functia-pe-fisa-design.md`

## Constrângeri globale

- Cod, comentarii, mesaje și identificatori de domeniu **în română**, cu ș/ț cu virgulă
  dedesubt (U+0219/U+021B), nu cu sedilă. Mesajele de eroare se termină cu punct.
- Migrările se aplică prin **`./administrativo.sh db:migrate`** (registru
  `internal.migrari_aplicate` + `psql` byte-exact). NICIODATĂ `supabase db push` sau
  `mcp__supabase__apply_migration`. **Aplicarea pe baza reală cere confirmarea explicită
  a utilizatorului, de fiecare dată** — un „da" anterior nu acoperă migrarea următoare.
- Forward-only: nicio migrare deja aplicată nu se editează.
- **`pnpm build` NU se rulează de către asistent** (instrucțiune permanentă a lui Miro,
  repetată de două ori). Poarta locală e `pnpm typecheck && pnpm lint && pnpm test`; ce
  rămâne de prins de build se raportează în cuvinte.
- Orice `.update()` de tranziție face `.select()` după — politica respinsă prin `USING`
  afectează **zero rânduri, fără eroare**.
- Server Actions prin `createAction()`, opt straturi, Zod **după** authz; `revalidate:`
  se DECLARĂ, nu se cheamă `revalidatePath()` din handler.
- Commit-uri cu `git commit --only -- <căile tale>`; indexul git e partajat cu alte
  sesiuni. `git status --short -- <căi>` înainte, niciodată `-A` sau `.`.
- Tipurile se regenerează **din bancul local**, nu din cloud, prin rețeta din
  `scripts/altoieste-tipuri.py`.

---

## Structura fișierelor

**Se creează:**

| Fișier                                        | Răspundere                                        |
| --------------------------------------------- | ------------------------------------------------- |
| `supabase/migrations/0108_functia_pe_fisa.sql` | coloane noi + backfill (aditivă)                  |
| `supabase/migrations/0109_functia_fara_nomenclator.sql` | funcții SQL rescrise, CHECK-uri rescrise, coloane vechi șterse |
| `src/domain/checklist/potrivire-sablon.ts`     | alegerea șablonului de onboarding — funcție pură  |
| `src/domain/checklist/potrivire-sablon.test.ts`| testele ei                                        |
| `src/components/cauta-cor.tsx`                 | căutarea COR, mutată din `app/(app)/functii/`     |
| `src/app/(app)/angajati/[id]/dialog-incadrare.tsx` | dialogul cu cele patru câmpuri               |
| `src/app/(app)/angajati/[id]/comutator-sef-departament.tsx` | comutatorul de șef            |

**Se șterg:** `src/app/(app)/functii/**` (10 fișiere) · `src/lib/queries/job-positions.ts`
și `job-positions.test.ts` · `src/schemas/job-position.ts` ·
`src/app/(app)/angajati/[id]/buton-schimba-functia.tsx`.

---

## Task 1: Migrarea aditivă și tipurile

**Fișiere:**

- Creează: `supabase/migrations/0108_functia_pe_fisa.sql`
- Modifică: `src/types/database.ts` (generat)

**Interfețe produse:** coloanele `functie text` și `cod_cor text` pe `employees`,
`employment_contracts`, `leave_entitlement_rules`, `payroll_bonus_rules`,
`course_assignment_rules`, `checklist_templates`.

- [ ] **Pasul 1: Scrie migrarea**

Antetul explică DE CE, în stilul lui `0106`. Corpul, pe secțiuni numerotate:

```sql
-- 1. FUNCȚIA PE FIȘĂ ȘI PE CONTRACT
alter table public.employees
  add column functie text,
  add column cod_cor text;

alter table public.employees
  add constraint employees_functie_len
    check (functie is null or char_length(btrim(functie)) between 2 and 160),
  add constraint employees_cod_cor_format
    check (cod_cor is null or cod_cor ~ '^[0-9]{6}$');

alter table public.employment_contracts
  add column functie text,
  add column cod_cor text;

alter table public.employment_contracts
  add constraint employment_contracts_functie_len
    check (functie is null or char_length(btrim(functie)) between 2 and 160),
  add constraint employment_contracts_cod_cor_format
    check (cod_cor is null or cod_cor ~ '^[0-9]{6}$');

-- 2. BACKFILL DIN NOMENCLATOR
update public.employees e
   set functie = jp.denumire, cod_cor = jp.cod_cor
  from public.job_positions jp
 where jp.id = e.job_position_id;

update public.employment_contracts c
   set functie = jp.denumire, cod_cor = jp.cod_cor
  from public.job_positions jp
 where jp.id = c.job_position_id;

-- 3. CRITERIUL „FUNCȚIE" AL REGULILOR, MUTAT PE COD COR
alter table public.leave_entitlement_rules add column cod_cor text;
alter table public.payroll_bonus_rules     add column cod_cor text;
alter table public.course_assignment_rules add column cod_cor text;
alter table public.checklist_templates     add column cod_cor text;

update public.leave_entitlement_rules r set cod_cor = jp.cod_cor
  from public.job_positions jp where jp.id = r.job_position_id;
update public.payroll_bonus_rules r set cod_cor = jp.cod_cor
  from public.job_positions jp where jp.id = r.job_position_id;
update public.course_assignment_rules r set cod_cor = jp.cod_cor
  from public.job_positions jp where jp.id = r.job_position_id;
update public.checklist_templates t set cod_cor = jp.cod_cor
  from public.job_positions jp where jp.id = t.job_position_id;

-- 4. INDEX
create index employees_org_cod_cor_idx
  on public.employees (organization_id, cod_cor)
  where deleted_at is null and cod_cor is not null;
```

Antetul trebuie să spună explicit **de ce e aditivă**: codul aflat în producție încă
face `select("job_position_id")`, iar ștergerea coloanei l-ar doborî în fereastra dintre
migrare și deploy — baza e aceeași pentru dev și pentru producție.

> **Capcană de numerotare:** pe disc există DEJA două `0107` (`0107_departamentul_conducere.sql`
> și `0107_drepturile_mele_concediu.sql`), semn că altă sesiune a lucrat în paralel.
> Verifică `ls supabase/migrations/ | tail -3` înainte de a fixa numărul; la coliziune îți
> redenumești **propria** migrare.

- [ ] **Pasul 2: Rulează pe bancul local**

```bash
bash .claude/skills/administrativo/scripts/banc-migrare.sh --pastreaza
```

Așteptat: toate migrările trec, inclusiv 0108, fără eroare.

- [ ] **Pasul 3: Verifică backfill-ul pe banc**

```sql
select count(*) filter (where functie is null and job_position_id is not null) as nepreluati
from public.employees;
```

Așteptat: `0`. Dacă nu, backfill-ul are un `where` greșit — oprește-te aici.

- [ ] **Pasul 4: Cere confirmarea și aplică pe baza reală**

Întreabă utilizatorul explicit, arătând ce face migrarea. Apoi:

```bash
./administrativo.sh db:status    # ce e neaplicat
./administrativo.sh db:migrate   # aplică doar neaplicatele
```

- [ ] **Pasul 5: Regenerează tipurile din banc**

```bash
PORT=$(docker ps --filter name=administrativo-banc --format '{{.Ports}}' \
       | grep -oE '0.0.0.0:[0-9]+' | head -1 | cut -d: -f2)
pnpm exec supabase gen types typescript \
  --db-url "postgresql://postgres:banc@localhost:$PORT/postgres" \
  | python3 scripts/altoieste-tipuri.py > src/types/database.ts
```

- [ ] **Pasul 6: Verifică**

```bash
pnpm typecheck && pnpm test
```

Așteptat: **verde**. Migrarea e aditivă; dacă pică ceva aici, altcineva a schimbat baza.

- [ ] **Pasul 7: Commit**

```bash
git commit --only -m "feat(functii): coloane functie + cod_cor pe fișă, contract și reguli" \
  -- supabase/migrations/0108_functia_pe_fisa.sql src/types/database.ts
```

---

## Task 2: `codCorOptional` mută în `comun.ts`

**Fișiere:**

- Modifică: `src/schemas/comun.ts`, `src/schemas/job-position.ts`
- Test: `src/schemas/comun.test.ts`

**Interfețe produse:** `codCorOptional` exportat din `@/schemas/comun` — acceptă `null`,
`""` și `undefined` ca `null`; respinge un cod cu alt format decât `^[0-9]{6}$` și un
cod inexistent în nomenclator (`codCorExista`).

- [ ] **Pasul 1: Scrie testul care pică**

În `src/schemas/comun.test.ts`:

```ts
describe("codCorOptional", () => {
  it("acceptă un cod real din nomenclator", () => {
    expect(codCorOptional.parse("251401")).toBe("251401");
  });

  it("normalizează golul la null", () => {
    expect(codCorOptional.parse("")).toBeNull();
    expect(codCorOptional.parse(undefined)).toBeNull();
  });

  it("respinge un cod cu format bun dar inexistent în nomenclator", () => {
    expect(() => codCorOptional.parse("999999")).toThrow();
  });
});
```

- [ ] **Pasul 2: Rulează testul, confirmă că pică**

```bash
pnpm exec vitest run --project unit src/schemas/comun.test.ts
```

Așteptat: FAIL — `codCorOptional` nu e exportat din `comun`.

- [ ] **Pasul 3: Mută definiția**

Taie blocul `codCorOptional` din `src/schemas/job-position.ts:16-37` — **cu tot cu cele
două comentarii** — și lipește-l în `src/schemas/comun.ts`, cu `export const`. Importul
`codCorExista` din `@/domain/hr/cor-nomenclator` merge cu el. În `job-position.ts`,
înlocuiește definiția locală cu `import { codCorOptional } from "./comun";` — fișierul
dispare în Task 10, dar până atunci trebuie să compileze.

`comun.test.ts` interzice redeclararea ajutoarelor comune oriunde în `src/schemas/`;
mutarea e exact ce cere regula.

- [ ] **Pasul 4: Rulează testele**

```bash
pnpm exec vitest run --project unit src/schemas/
```

Așteptat: PASS.

- [ ] **Pasul 5: Commit**

```bash
git commit --only -m "refactor(scheme): codCorOptional trece în comun.ts" \
  -- src/schemas/comun.ts src/schemas/comun.test.ts src/schemas/job-position.ts
```

---

## Task 3: Potrivirea șablonului de checklist, extrasă și testată

Logica trăiește azi inline în `angajati/nou/actions.ts:637-646`, netestată, și e exact
locul unde criteriul se mută de pe `job_position_id` pe `cod_cor`. O scoatem afară ca s-o
putem testa fără bază.

**Fișiere:**

- Creează: `src/domain/checklist/potrivire-sablon.ts`, `src/domain/checklist/potrivire-sablon.test.ts`
- Modifică: `src/app/(app)/angajati/nou/actions.ts:630-646`

**Interfețe produse:**

```ts
export interface SablonPotrivibil {
  readonly id: string;
  readonly denumire: string;
  readonly department_id: string | null;
  readonly cod_cor: string | null;
}
export function alegeSablon(
  sabloane: readonly SablonPotrivibil[],
  fisa: Readonly<{ department_id: string | null; cod_cor: string | null }>,
): SablonPotrivibil | null;
```

- [ ] **Pasul 1: Scrie testele care pică**

```ts
const SABLOANE = [
  { id: "generic", denumire: "Generic", department_id: null, cod_cor: null },
  { id: "dep", denumire: "Producție", department_id: "d1", cod_cor: null },
  { id: "cor", denumire: "Sudori", department_id: null, cod_cor: "721208" },
  { id: "ambele", denumire: "Sudori Producție", department_id: "d1", cod_cor: "721208" },
] as const;

it("alege șablonul cel mai specific", () => {
  expect(alegeSablon(SABLOANE, { department_id: "d1", cod_cor: "721208" })?.id).toBe("ambele");
});

it("codul COR bate departamentul", () => {
  expect(alegeSablon(SABLOANE, { department_id: "d2", cod_cor: "721208" })?.id).toBe("cor");
});

it("cade pe generic când nimic nu se potrivește", () => {
  expect(alegeSablon(SABLOANE, { department_id: "d9", cod_cor: "111101" })?.id).toBe("generic");
});

it("întoarce null pe listă goală", () => {
  expect(alegeSablon([], { department_id: null, cod_cor: null })).toBeNull();
});

it("o fișă fără cod COR nu prinde un șablon legat de o ocupație", () => {
  expect(alegeSablon(SABLOANE, { department_id: null, cod_cor: null })?.id).toBe("generic");
});
```

- [ ] **Pasul 2: Rulează, confirmă că pică**

```bash
pnpm exec vitest run --project unit src/domain/checklist/potrivire-sablon.test.ts
```

Așteptat: FAIL — modulul nu există.

- [ ] **Pasul 3: Scrie implementarea minimă**

```ts
export function alegeSablon(sabloane, fisa) {
  const potrivite = sabloane.filter(
    (s) =>
      (s.cod_cor === null || s.cod_cor === fisa.cod_cor) &&
      (s.department_id === null || s.department_id === fisa.department_id),
  );
  const specificitate = (s: SablonPotrivibil): number =>
    (s.cod_cor === null ? 0 : 2) + (s.department_id === null ? 0 : 1);
  return [...potrivite].sort((a, b) => specificitate(b) - specificitate(a))[0] ?? null;
}
```

Comentariul de deasupra păstrează cele două motive deja scrise în `nou/actions.ts`:
ordinea descrescătoare după `created_at` la egalitate de specificitate, și de ce
`data_referinta` e `valabil_de_la`.

- [ ] **Pasul 4: Rulează testele**

Așteptat: PASS, 5/5.

- [ ] **Pasul 5: Cheamă funcția din acțiune**

În `nou/actions.ts`, `.select("id, denumire, department_id, job_position_id")` devine
`.select("id, denumire, department_id, cod_cor")`, iar blocul de filtrare/sortare devine
`const ales = alegeSablon(sabloane ?? [], { department_id: fisa.department_id, cod_cor: fisa.cod_cor });`
cu `if (ales === null)` pe ramura de avertisment.

- [ ] **Pasul 6: Verifică**

```bash
pnpm exec vitest run --project unit && pnpm typecheck
```

- [ ] **Pasul 7: Commit**

---

## Task 4: Stratul de citiri

**Fișiere:**

- Modifică: `src/lib/queries/employees.ts` (`EMBED_FUNCTIE:25`, filtrul `:252`,
  `AngajatEditabil:662`, selectul `:688`, `:765`, `:790`, `functiiActive:906`)
- Modifică: `src/lib/queries/{departments,cursuri,leave,panou,reges,portal,checklist}.ts`
- Modifică: `src/lib/reges/reconciliere.ts:170,184`
- Modifică: `src/lib/documents/{adeverinte,context-angajat}.ts`
- Modifică: `src/app/(app)/salarizare/actions.ts:230`

**Interfețe produse:**

```ts
export async function functiiFolosite(organizationId: string): Promise<readonly string[]>;
```

— denumirile distincte, ordonate alfabetic, din `employees` neșterși ai organizației.
Înlocuiește `functiiActive(): readonly OptiuneFunctie[]`.

- [ ] **Pasul 1: Scoate embed-ul din `employees.ts`**

`const EMBED_FUNCTIE = "job_position:job_positions!job_position_id(id, denumire)"` se
șterge; peste tot unde era interpolat, se pun coloanele `functie, cod_cor`. Tipurile
`readonly job_position: { id, denumire } | null` devin
`readonly functie: string | null; readonly cod_cor: string | null`.

- [ ] **Pasul 2: Înlocuiește `functiiActive` cu `functiiFolosite`**

```ts
export async function functiiFolosite(organizationId: string): Promise<readonly string[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employees")
    .select("functie")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .not("functie", "is", null)
    .order("functie", { ascending: true })
    .returns<{ functie: string }[]>();
  if (error !== null) throw error;
  return [...new Set((data ?? []).map((r) => r.functie))];
}
```

Comentariul păstrează nota existentă: filtrul pe funcție era implementat pe server și
inaccesibil din interfață. **`.returns<T[]>` cu array MUTABIL** — `readonly T[]` în
generic rupe tăcut tipul și trimite eroarea spre `.single()`, adică spre cauza greșită.

- [ ] **Pasul 3: `reconciliere.ts` și `queries/reges.ts`**

`"…, job_positions(cod_cor)"` → `"…, functie, cod_cor"`;
`contract.job_positions?.cod_cor ?? null` → `contract.cod_cor`.

- [ ] **Pasul 4: Documentele pierd a doua interogare**

În `adeverinte.ts:53-76` și `context-angajat.ts:44-76`, selectul cere `functie` în locul
lui `job_position_id`, iar interogarea separată pe `job_positions` **se șterge cu totul**
— nu se înlocuiește cu nimic.

- [ ] **Pasul 5: Restul citirilor**

`departments.ts:64` (embed → coloană), `cursuri.ts:981`, `leave.ts:883`, `panou.ts:351`,
`portal.ts:23,115,164`, `checklist.ts`, `salarizare/actions.ts:230`.

- [ ] **Pasul 6: Verifică**

```bash
pnpm typecheck && pnpm exec vitest run --project unit src/lib/queries/coloane.test.ts
```

`coloane.test.ts` compară coloanele CERUTE de citiri cu cele care există în
`database.ts` — e poarta care prinde un `select("functie")` scris pe o tabelă care n-o
are.

- [ ] **Pasul 7: Commit**

---

## Task 5: Acțiunile

**Fișiere:**

- Modifică: `src/schemas/employee.ts:425-431`
- Modifică: `src/app/(app)/angajati/actions.ts:154-233` (`atribuieFunctia` → `actualizeazaIncadrarea`)
- Modifică: `src/app/(app)/angajati/[id]/actions.ts` (acțiunea de șef de departament)

**Interfețe produse:**

```ts
export const incadrareSchema: z.ZodType<{
  employee_id: string;
  functie: string | null;
  cod_cor: string | null;
  department_id: string | null;
  manager_employee_id: string | null;
}>;
export const actualizeazaIncadrarea: ActiuneServer<typeof incadrareSchema, { id: string }>;
export const desemneazaSefDepartament: ActiuneServer<typeof sefDepartamentSchema, { id: string }>;
```

- [ ] **Pasul 1: Schema**

```ts
export const incadrareSchema = z
  .object({
    employee_id: z.uuid("Angajatul selectat nu este valid."),
    functie: textOptional(160),
    cod_cor: codCorOptional,
    department_id: uuidOptional,
    manager_employee_id: uuidOptional,
  })
  .refine((v) => v.manager_employee_id !== v.employee_id, {
    path: ["manager_employee_id"],
    message: "Un angajat nu poate fi propriul manager.",
  });
```

`atribuieFunctiaSchema` se șterge. Comentariul care explică de ce nu se refolosește
`actualizeazaAngajat` (36 de câmpuri cu `.default()`, un payload scurt ar scrie `null`
peste restul fișei) se mută pe `incadrareSchema` — motivul rămâne valabil.

- [ ] **Pasul 2: Acțiunea**

`atribuieFunctia` devine `actualizeazaIncadrarea`, `name: "employees.update_incadrare"`,
`permission: "employees:update"`, `minScope: "all"`,
`audit.allow: ["employee_id", "functie", "cod_cor", "department_id", "manager_employee_id"]`,
`revalidate: ["/angajati", "/organigrama"]` — **`/functii` iese din listă**.

În handler, verificarea nomenclatorului (`db.from("job_positions")…`) se șterge; în
locul ei, două verificări care rămân necesare fiindcă cheile străine sunt simple, fără
componentă pe `organization_id`:

```ts
if (input.department_id !== null) {
  const { data: dep, error } = await db
    .from("departments")
    .select("id")
    .eq("id", input.department_id)
    .eq("organization_id", ctx.tenant.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error !== null) throw mapPostgrestError(error, ctx.requestId);
  if (dep === null) throw notFound("Departamentul selectat nu a fost găsit.");
}

if (input.manager_employee_id !== null) {
  const { data: mgr, error } = await db
    .from("employees")
    .select("id, manager_path")
    .eq("id", input.manager_employee_id)
    .eq("organization_id", ctx.tenant.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error !== null) throw mapPostgrestError(error, ctx.requestId);
  if (mgr === null) throw notFound("Managerul selectat nu a fost găsit.");
  // Ciclu: managerul ales îl are deja pe angajat în lanțul lui de superiori.
  // `manager_path` e menținut de trigger, dar un ciclu l-ar umfla tăcut până la
  // recursie infinită în `tg_employees_manager_path_cascade`.
  if (mgr.manager_path.includes(input.employee_id)) {
    throw businessRule(
      "Persoana aleasă este în subordinea acestui angajat, deci nu îi poate fi manager.",
    );
  }
}
```

Update-ul scrie cele patru coloane plus `updated_by`, cu `.select("id")` și
`.maybeSingle()` după — refuzul prin `USING` dă zero rânduri fără eroare.

- [ ] **Pasul 3: Acțiunea de șef de departament**

```ts
export const desemneazaSefDepartament = createAction<typeof sefDepartamentSchema, { id: string }>({
  name: "departments.set_head_from_employee",
  permission: "departments:update",
  minScope: "all",
  input: sefDepartamentSchema,   // { employee_id, department_id, sef: boolean }
  audit: { action: "update", entityType: "departments",
           entityId: (input) => input.department_id,
           allow: ["employee_id", "department_id", "sef"] },
  revalidate: ["/angajati", "/departamente", "/organigrama"],
  handler: async (ctx, input) => { /* … */ },
});
```

Handler-ul scrie `departments.manager_employee_id` (angajatul, sau `null` la debifare) și
**refolosește** helper-ul de rol din `@/domain/departments/manager-membru` plus
`contextSef(ctx, db)` din `departamente/actions.ts:116-134` — regula „șef ⇒ rol
`manager`" se acordă doar dacă `ctx.tenant.role === "org_admin"`, altfel se întoarce
semnal, nu eroare. Dacă `contextSef` trebuie folosit din alt fișier, se exportă acolo
unde e; nu se rescrie.

- [ ] **Pasul 4: Verifică**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Pasul 5: Commit**

---

## Task 6: Fișa angajatului

**Fișiere:**

- Creează: `src/app/(app)/angajati/[id]/dialog-incadrare.tsx`,
  `src/app/(app)/angajati/[id]/comutator-sef-departament.tsx`
- Șterge: `src/app/(app)/angajati/[id]/buton-schimba-functia.tsx`
- Modifică: `src/app/(app)/angajati/[id]/page.tsx:45,291,553-588`
- Mută: `src/app/(app)/functii/cauta-cor.tsx` → `src/components/cauta-cor.tsx`

**Interfețe consumate:** `actualizeazaIncadrarea`, `desemneazaSefDepartament` (Task 5),
`functiiFolosite` (Task 4).

- [ ] **Pasul 1: Mută `CautaCor`**

Fișierul se mută ca atare în `src/components/`, cu importurile ajustate. Comentariul lui
(4422 de ocupații importate în client, deliberat) rămâne — e motivul pentru care nu
devine o Server Action per tastă.

- [ ] **Pasul 2: Dialogul**

`FormularDialog` cu `useTransition` + `FormData` + `useId` — **nu** react-hook-form
(apare în 4 fișiere din 118, nu e implicitul). Patru câmpuri: `functie` (input text cu
`list=` către un `<datalist>` alimentat din `functiiFolosite`), `cod_cor` (`<CautaCor>`),
`department_id` și `manager_employee_id` (`<select>`-uri).

Alegerea unui cod COR completează denumirea **doar dacă e goală** — altfel ar șterge
un titlu intern („Sudor MAG, schimbul 2") pe care firma îl vrea diferit de eticheta
oficială.

- [ ] **Pasul 3: Comutatorul de șef**

Se randează **doar** când `angajat.department_id !== null` și actorul are
`departments:update` all. Textul spune ce se întâmplă: „Șef al departamentului
Producție — primește rolul de manager."

- [ ] **Pasul 4: Secțiunea „Încadrare" din pagină**

Cele patru `<Camp>`-uri rămân afișaj; butonul unic „Schimbă" deschide dialogul.
`optiuniFunctii` (linia 291) devine `functiiFolosite(...)`, iar pagina mai are nevoie de
lista de departamente și de colegi pentru `<select>`-uri — `colegiPentruManager` există
deja în `queries/employees.ts`.

- [ ] **Pasul 5: Verifică**

```bash
pnpm typecheck && pnpm lint && pnpm exec vitest run --project ui
```

- [ ] **Pasul 6: Commit**

---

## Task 7: Onboarding, formularul de editare, filtrele listei

**Fișiere:**

- Modifică: `src/app/(app)/angajati/nou/_components/pas-3-contract.tsx:25,143-158`
- Modifică: `src/app/(app)/angajati/nou/page.tsx:40`, `nou/actions.ts:73,286,361,499-501`
- Modifică: `src/app/(app)/angajati/formular-angajat.tsx:74,632-651`
- Modifică: `src/app/(app)/angajati/[id]/editeaza/page.tsx:52`
- Modifică: `src/app/(app)/angajati/filtre-angajati.tsx`, `angajati/page.tsx:25,234`
- Modifică: `src/app/(app)/angajati/nou/_components/etichete-campuri.ts`,
  `poarta-pasilor.test.ts`

- [ ] **Pasul 1: Pasul 3 al asistentului**

`<select job_position_id>` devine două `<Camp>`-uri: `functie` (text) și `cod_cor`
(`<CautaCor>`). Cheia `"job_position_id"` din lista de câmpuri a pasului (linia 25)
devine `"functie", "cod_cor"`; `etichete-campuri.ts` primește etichetele noi.

**Atenție la capcana `enumOptional`:** un `<select>` gol trimite ȘIRUL GOL, nu `null`.
Câmpurile noi sunt text, deci trec prin `textOptional`/`codCorOptional`, care
normalizează `""` la `null` — dar `poarta-pasilor.test.ts` trebuie actualizat, fiindcă
enumeră câmpurile pasului și pică altfel.

- [ ] **Pasul 2: Contractul înghețat**

În `nou/actions.ts:286,361`, insertul în `employment_contracts` scrie `functie` și
`cod_cor` copiate din fișă — **asta e înghețarea**. Interogarea de la `:499-501` care
citea denumirea din `job_positions` se șterge; valoarea e deja pe `fisa`.

- [ ] **Pasul 3: Formularul lung și pagina de editare**

Același înlocuitor de două câmpuri; `citesteAngajatPentruEditare` (Task 4) întoarce deja
`functie`/`cod_cor`, iar interogarea de nomenclator din `editeaza/page.tsx:52` se șterge.

- [ ] **Pasul 4: Filtrul din listă**

`filtre-angajati.tsx` filtrează pe denumire (`functie`), alimentat de `functiiFolosite`;
cheia din URL devine `functie`. Schema de filtre din `schemas/employee.ts` se
actualizează la fel.

- [ ] **Pasul 5: Verifică**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

- [ ] **Pasul 6: Commit**

---

## Task 8: Consumatorii rămași

**Fișiere:** `src/app/(app)/angajati/import/actions.ts:153,177` ·
`src/app/(app)/organigrama/page.tsx:52,61-118` · `src/app/(app)/departamente/page.tsx` ·
`src/app/(app)/reges/actions.ts:185,229` · `src/app/(app)/ssm/instruiri/page.tsx:58` ·
`src/app/(portal)/portal/echipa-mea/page.tsx` ·
`src/app/api/export/salarizare/fluturas/route.ts` ·
`src/app/(app)/angajati/[id]/sectiune-concedii.tsx`

- [ ] **Pasul 1: Importul de angajați**

`idDupaCheie(ctx, "job_positions", angajat.functie)` dispare: coloana „funcție" din
fișierul importat se scrie ca text, direct. Ajutorul `idDupaCheie` rămâne pentru
`departments`, deci parametrul `tabel` își pierde varianta `"job_positions"`.

- [ ] **Pasul 2: Restul**

Mecanic: `nod.job_position.denumire` → `nod.functie`, `functie?.cod_cor` → `c.cod_cor`.
`reges/actions.ts:185` pierde interogarea pe nomenclator — codul e pe contract.

- [ ] **Pasul 3: Verifică**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

- [ ] **Pasul 4: Commit**

---

## Task 9: Cele patru ecrane de reguli, pe cod COR

**Fișiere:** `src/app/(app)/concedii/setari/{actions.ts,formular-regula-noua.tsx,tabel-reguli.tsx}` ·
`src/app/(app)/cursuri/{actions.ts,[id]/reguli/reguli-curs.tsx,_formulare/citire.ts}` ·
`src/app/(app)/onboarding/{actions.ts,_formulare/citire.ts,sabloane/_componente/{optiuni.ts,asistent-sablon.tsx}}` ·
`src/schemas/{leave,cursuri,checklist}.ts` · regulile de bonus din `salarizare`

- [ ] **Pasul 1: Schemele**

`job_position_id: z.uuid(...)` → `cod_cor: codCorOptional` în toate patru. Criteriul
`"functie"` din enum-uri **rămâne** — se schimbă doar ce câmp îl însoțește.

- [ ] **Pasul 2: Formularele**

`<select>`-ul de nomenclator → `<CautaCor>`. În `optiuni.ts:57`, interogarea pe
`job_positions` se șterge; asistentul de șablon primește `<CautaCor>` direct.

- [ ] **Pasul 3: Afișarea**

`functii.find((f) => f.id === regula.job_position_id)?.denumire` →
`ocupatiaDupaCod(regula.cod_cor)?.denumire ?? regula.cod_cor`.

- [ ] **Pasul 4: Verifică și comite**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

---

## Task 10: Ștergerea modulului

**Fișiere:**

- Șterge: `src/app/(app)/functii/**` (10 fișiere — `cauta-cor.tsx` a fost deja mutat în
  Task 6), `src/lib/queries/job-positions.ts`, `src/lib/queries/job-positions.test.ts`,
  `src/schemas/job-position.ts`
- Modifică: `src/config/navigation.ts:200-210` (intrarea `functii`),
  `src/lib/queries/panou.ts:351` (faptul „N funcții"),
  `src/app/(app)/panou/page.tsx:449`

- [ ] **Pasul 1: Șterge fișierele**

- [ ] **Pasul 2: Scoate intrarea din meniu**

Blocul `id: "functii"` din `navigation.ts` se șterge integral. Permisiunea
`departments:read` NU se atinge — o folosește `/departamente`.

- [ ] **Pasul 3: Scoate faptul din panou**

`ContoarePanou.functii` și `<Fapt valoare={firma.functii} eticheta="funcții" />` dispar,
împreună cu interogarea de la `panou.ts:351`. Nu se înlocuiesc cu altceva: un contor de
nomenclator inexistent n-are ce număra.

- [ ] **Pasul 4: Verifică**

```bash
pnpm typecheck && pnpm lint && pnpm test
grep -rn "job_position\|/functii" src --include="*.ts" --include="*.tsx" | grep -v "^src/types/database.ts"
```

Așteptat: typecheck și lint verzi; `grep` întoarce **zero** rezultate în afara tipurilor
generate. Dacă mai apare ceva, e un consumator scăpat — nu treci mai departe.

- [ ] **Pasul 5: Commit**

---

## Task 11: Migrarea distructivă și proba reală

**Fișiere:**

- Creează: `supabase/migrations/0109_functia_fara_nomenclator.sql`
- Modifică: `src/types/database.ts`

> **Poarta umană:** acest task se execută **numai după ce noul build rulează** în
> producție. Ordinea e invariantul întregului plan; inversarea ei doboară aplicația
> livrată.

- [ ] **Pasul 1: Scrie migrarea, în ordinea asta**

1. **Rescrie cele trei funcții SQL** — corpul se copiază din migrarea de origine și se
   schimbă exact o clauză în fiecare:

   | Funcție                            | Origine                                | Clauza                                                        |
   | ---------------------------------- | -------------------------------------- | ------------------------------------------------------------- |
   | `app.drept_concediu`               | `0035_reguli_concediu.sql:179`         | `v_job_position = r.job_position_id` → `v_cod_cor = r.cod_cor`; selectul din `into` citește `e.cod_cor` |
   | `internal.cursuri_aplica_regulile` | `0078_cursuri_reguli_atribuire.sql:88` | `e.job_position_id = v_regula.job_position_id` → `e.cod_cor = v_regula.cod_cor` |
   | `public.checklist_salveaza_sablon` | `0090_integrare_salvare_sablon.sql:176`| cheia `job_position_id` din payload-ul JSON → `cod_cor`, cu `nullif(p_sablon->>'cod_cor', '')` fără cast la `uuid` |

   Fiecare își păstrează `security definer`, `set search_path = ''` și coada
   `revoke ... from public, anon, authenticated` existentă.

2. **Rescrie cele cinci CHECK-uri** care enumeră coloana:
   `ler_criteriu_ck`, `pbr_criteriu_ck`, `course_assignment_rules_criteriu_ck`,
   `job_descriptions_tinta`, plus indexul unic cu `coalesce(job_position_id, …)` din
   `0035:151`. Fiecare `drop constraint` + `add constraint` cu aceeași regulă scrisă pe
   `cod_cor`.

3. **Abia apoi** `alter table … drop column job_position_id` pe `employees`,
   `employment_contracts`, `leave_entitlement_rules`, `payroll_bonus_rules`,
   `course_assignment_rules`, `checklist_templates`.

`job_positions`, `job_descriptions.job_position_id` și `risk_assessments.job_position_id`
**rămân neatinse** — zero rânduri, zero UI, și un `drop table` e singura operație fără
drum înapoi din tot planul.

- [ ] **Pasul 2: Bancul local**

```bash
bash .claude/skills/administrativo/scripts/banc-migrare.sh
```

Așteptat: toate migrările trec.

- [ ] **Pasul 3: Cere confirmarea, aplică, regenerează tipurile**

Aceeași rețetă ca la Task 1, pașii 4-5.

- [ ] **Pasul 4: Proba reală de scriere per rol**

```bash
# skill-ul administrativo:proba, pe employees și departments
```

Pentru fiecare din cele cinci roluri, un UPDATE efectiv sub identitatea lui, în
tranzacție derulată înapoi, comparat cu matricea din `role_permissions`. Așteptat:
`org_admin` și `hr` pot scrie încadrarea; `manager` **nu** (n-are `employees:update`
all); `employee` nu; `super_admin` prin `platform_admins`. Un „refuz tăcut" raportat aici
înseamnă că politica respinge o scriere legitimă — exact defectul din Faza 2, când
proiectul a fost declarat livrat în timp ce un `org_admin` nu putea insera un angajat.

- [ ] **Pasul 5: Lanțul complet**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Se raportează utilizatorului **explicit** ce rămâne neprins fără `pnpm build`: granița
server/client pe `src/components/cauta-cor.tsx` (mutat, `"use client"`) și pe cele două
componente noi din fișă.

- [ ] **Pasul 6: Actualizează vault-ul**

`.claude/docs/modul/angajati.md` — secțiunea „Citiri" numește `functiiActive`, care nu
mai există; lista de tabele conține `job_positions`. Se actualizează, cu `scris_pe` pe
commit-ul curent.

- [ ] **Pasul 7: Commit și push**

```bash
git status --short -- <căile tale>
git fetch origin main
git commit --only -m "…" -- <căile tale>
git merge origin/main
git push origin main
```

---

## Auto-verificare a planului

**Acoperirea spec-ului:** §4 → Task 1 + 11 · §5 → Task 11 pasul 1 · §6 → Task 2, 4, 8 ·
§7 → Task 5, 6, 7 · §8 → Task 10 · §9 → pașii de verificare din fiecare task + Task 11 ·
§10 → Task 11 pasul 1, nota finală. Fără goluri.

**Consistență de nume:** `functiiFolosite` (Task 4) e consumată în Task 6 pasul 4 și Task
7 pasul 4 · `alegeSablon` (Task 3) în Task 3 pasul 5 · `actualizeazaIncadrarea` și
`desemneazaSefDepartament` (Task 5) în Task 6 · `codCorOptional` (Task 2) în Task 5 și 9.

**Riscul cel mai mare:** inversarea ordinii dintre Task 11 și livrarea build-ului.
E marcat ca poartă umană, nu ca pas.
