# Plan de implementare — Departamente: două vizualizări și mutarea persoanelor

> **Pentru executanți agentici:** SUB-SKILL OBLIGATORIU: folosiți
> `superpowers:executing-plans` pentru a implementa planul sarcină cu sarcină.
> Pașii folosesc sintaxa cu bifă (`- [ ]`).
>
> **ATENȚIE — abatere deliberată de la implicitul skill-ului:** NU se folosește
> `superpowers:subagent-driven-development`. Memoria proiectului (CLAUDE.md,
> secțiunea „Agenți") interzice fan-out-ul de implementare: șase agenți paraleli
> au produs 91 de erori de compilare, aproape toate din căi de import inventate,
> iar în patru faze agenții de construcție au murit la limita de sesiune cu zero
> cod livrat. Implementarea e directă, cu `Write`/`Edit`, într-o singură sesiune.

**Scop:** `/departamente` capătă două vizualizări comutabile (listă și
organigramă de departamente) și devine locul din care se repartizează și se mută
persoane între departamente.

**Arhitectura:** Logica de arbore coboară din `page.tsx` într-un modul pur din
`src/domain/`, testabil fără bază. Citirile primesc în sfârșit un modul propriu
în `src/lib/queries/`, prin `citesteTot`, ceea ce elimină trunchierea tăcută la
1000 de rânduri. Comutatorul de vizualizare devine primitivă partajată, extrasă
din tiparul corect existent. Mutarea persoanelor primește o Server Action
îngustă, care atinge o singură coloană.

**Stiva:** Next.js 16.3 (App Router, Server Components), React 19.2, TypeScript
strict, Zod 4, Tailwind v4, Supabase Postgres 17 cu RLS FORCED, vitest 4 +
@testing-library/react + happy-dom.

**Spec:** `docs/superpowers/specs/2026-08-24-departamente-vizualizari-design.md`

## Constrângeri globale

Valorile de mai jos se aplică fiecărei sarcini, fără repetare.

- **Limba:** cod, comentarii, mesaje și identificatori de domeniu în română, cu
  **ș/ț cu virgulă dedesubt** (U+0219/U+021B), niciodată cu sedilă (`ş`/`ţ`).
  Mesajele de eroare se termină cu punct.
- **Fără migrări.** Nicio schimbare în `supabase/migrations/`.
- **Fără permisiuni noi.** Niciun seed, niciun rol nou.
- **Verificarea:** `pnpm typecheck && pnpm lint && pnpm test`.
  **`pnpm build` NU se rulează** — cerere explicită și repetată a
  utilizatorului. Ce rămâne neprins se declară la final (§ Sarcina 9).
- **Citiri:** funcții libere, `organizationId` primul argument, tipuri
  `readonly`, `.returns<T[]>()`, `.is("deleted_at", null)` explicit, niciodată
  `.range()`.
- **Acțiuni:** `createAction` cu cele opt straturi; Zod **după** authz;
  `revalidate:` se **declară**, nu se cheamă `revalidatePath()` din handler.
- **Orice `.update()` face `.select()`** și tratează rezultatul gol drept refuz:
  un UPDATE respins de clauza `USING` afectează zero rânduri, **fără eroare**.
- **Formulare client:** `useTransition` + `FormData` + `useId`. react-hook-form
  apare în 4 fișiere din 118 — nu e implicitul.
- **Git:** `git status --short` înainte de orice `git add`; niciodată `-A` sau
  `.`. În arbore stau modificări necomise ale altei sesiuni în
  `src/components/layout/command-palette.tsx` — **nu se stagiază**. Se adaugă
  fișierele pe nume.
- **Teste:** matcheri vitest nativi. `@testing-library/jest-dom` **nu există** în
  proiect, deci `toBeInTheDocument()` nu compilează. Interacțiune prin
  `fireEvent`, nu `user-event` (instalat, dar nefolosit nicăieri).

## Structura de fișiere

| Fișier                                              | Responsabilitate                                              |
| --------------------------------------------------- | ------------------------------------------------------------- |
| `src/domain/departments/arbore.ts`                   | NOU. Construcția arborelui + efectivul cumulat. Pur.          |
| `src/domain/departments/arbore.test.ts`              | NOU. Testele logicii pure.                                     |
| `src/lib/queries/departments.ts`                     | NOU. Proprietarul citirilor de departamente.                  |
| `src/components/ui/comutator-vizualizare.tsx`        | NOU. Primitivă: segmented control pe URL.                     |
| `src/components/ui/comutator-vizualizare.test.tsx`   | NOU.                                                           |
| `src/schemas/employee.ts`                            | Modificat: `mutaAngajatiSchema`.                              |
| `src/schemas/employee.test.ts`                       | Modificat: teste pentru schema nouă.                          |
| `src/app/(app)/departamente/actions.ts`              | Modificat: `mutaAngajati`.                                     |
| `src/app/(app)/departamente/panou-departament.tsx`   | NOU. Client. Panoul de lucru cu persoanele.                   |
| `src/app/(app)/departamente/vizualizare-lista.tsx`   | NOU. Vizualizarea listă.                                       |
| `src/app/(app)/departamente/vizualizare-organigrama.tsx` | NOU. Vizualizarea organigramă.                            |
| `src/app/(app)/departamente/page.tsx`                | Modificat: porți + citiri + rutare de vizualizare.            |

---

## Sarcina 1: Arborele pur

**Fișiere:**

- Creează: `src/domain/departments/arbore.ts`
- Test: `src/domain/departments/arbore.test.ts`

**Interfețe:**

- Consumă: nimic.
- Produce: `RandArbore`, `NodArbore<T>`, `construiesteArbore<T>(randuri, efectivPeDepartament)`.

- [ ] **Pasul 1: Scrie testul care pică**

Creează `src/domain/departments/arbore.test.ts`:

```ts
// src/domain/departments/arbore.test.ts
import { describe, expect, it } from "vitest";

import { construiesteArbore } from "./arbore";

/**
 * Funcțiile astea trăiau în `departamente/page.tsx`, deci nu putea fi testată
 * niciuna. Cazurile de mai jos nu sunt ipotetice: orfanul apare de fiecare dată
 * când un părinte e șters logic, iar efectivul cumulat e cifra pe care
 * organigrama o afișează în pătrat — dacă e greșită, e greșită tăcut.
 */

interface Rand {
  readonly id: string;
  readonly parent_id: string | null;
  readonly denumire: string;
}

const rand = (id: string, parent_id: string | null, denumire = id): Rand => ({
  id,
  parent_id,
  denumire,
});

describe("construiesteArbore", () => {
  it("întoarce lista goală pentru intrare goală", () => {
    expect(construiesteArbore<Rand>([], new Map())).toEqual([]);
  });

  it("așază la rădăcină nodurile cu parent_id null", () => {
    const arbore = construiesteArbore([rand("a", null), rand("b", null)], new Map());
    expect(arbore.map((n) => n.date.id)).toEqual(["a", "b"]);
    expect(arbore[0]?.copii).toEqual([]);
  });

  it("promovează la rădăcină un nod al cărui părinte lipsește din set", () => {
    // Părintele „x" e șters logic sau invizibil prin RLS. Nodul NU se pierde.
    const arbore = construiesteArbore([rand("orfan", "x")], new Map());
    expect(arbore.map((n) => n.date.id)).toEqual(["orfan"]);
    expect(arbore[0]?.nivel).toBe(1);
  });

  it("păstrează ordinea dintre frați exact cum a primit-o", () => {
    const arbore = construiesteArbore(
      [rand("p", null), rand("z", "p"), rand("a", "p"), rand("m", "p")],
      new Map(),
    );
    expect(arbore[0]?.copii.map((n) => n.date.id)).toEqual(["z", "a", "m"]);
  });

  it("numără efectivul direct din hartă, zero când lipsește", () => {
    const arbore = construiesteArbore([rand("a", null)], new Map([["a", 5]]));
    expect(arbore[0]?.efectivDirect).toBe(5);
    const gol = construiesteArbore([rand("b", null)], new Map());
    expect(gol[0]?.efectivDirect).toBe(0);
  });

  it("cumulează efectivul pe tot subarborele, pe trei niveluri", () => {
    const randuri = [rand("r", null), rand("c1", "r"), rand("c2", "r"), rand("n", "c1")];
    const efectiv = new Map([
      ["r", 1],
      ["c1", 2],
      ["c2", 4],
      ["n", 8],
    ]);
    const arbore = construiesteArbore(randuri, efectiv);
    expect(arbore[0]?.efectivCumulat).toBe(15);
    expect(arbore[0]?.copii[0]?.efectivCumulat).toBe(10); // c1 + n
    expect(arbore[0]?.copii[1]?.efectivCumulat).toBe(4); // c2 singur
  });

  it("numerotează nivelurile de la 1", () => {
    const arbore = construiesteArbore([rand("r", null), rand("c", "r")], new Map());
    expect(arbore[0]?.nivel).toBe(1);
    expect(arbore[0]?.copii[0]?.nivel).toBe(2);
  });

  it("nu intră în buclă infinită pe un ciclu și nu pierde nodurile ciclate", () => {
    // Baza împiedică ciclurile prin trigger, dar funcția asta nu poate presupune
    // asta: primește ce i se dă. Contractul e că se OPREȘTE și nu pierde nimic.
    const arbore = construiesteArbore([rand("a", "b"), rand("b", "a")], new Map());
    const idUri = arbore.map((n) => n.date.id);
    expect(idUri).toContain("a");
    expect(idUri.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Pasul 2: Rulează testul, confirmă că pică**

```bash
pnpm vitest run --project unit src/domain/departments/arbore.test.ts
```

Așteptat: FAIL — `Failed to resolve import "./arbore"`.

- [ ] **Pasul 3: Scrie implementarea minimă**

Creează `src/domain/departments/arbore.ts`:

```ts
// src/domain/departments/arbore.ts
/**
 * Construcția arborelui de departamente, separată de ecran.
 *
 * A trăit în `departamente/page.tsx`, unde nu putea fi testată și unde a fost
 * copiată a doua oară pentru organigramă. Aici e pură: primește rânduri, dă
 * noduri, nu știe nimic despre Supabase și nici despre React.
 *
 * Două lucruri pe care le garantează și care nu se văd din semnătură:
 *
 * 1. **Niciun rând nu se pierde.** Un nod al cărui părinte nu e în setul primit
 *    — șters logic, sau invizibil prin RLS — urcă la rădăcină. Alternativa
 *    (să fie sărit) ar face ca un departament întreg să dispară de pe ecran
 *    fără nicio eroare.
 * 2. **Nu intră în buclă infinită.** Trigger-ul `tg_departments_path` respinge
 *    ciclurile în bază, dar funcția asta nu-l poate invoca drept garanție:
 *    primește ce i se dă. Setul `vizitate` oprește recursia, iar coada de la
 *    final promovează la rădăcină orice nod rămas neatins.
 */

export interface RandArbore {
  readonly id: string;
  readonly parent_id: string | null;
}

export interface NodArbore<T extends RandArbore> {
  readonly date: T;
  readonly copii: readonly NodArbore<T>[];
  /** 1 pentru rădăcini. Folosit de indentarea din vizualizarea listă. */
  readonly nivel: number;
  /** Angajați repartizați FIX în acest departament. */
  readonly efectivDirect: number;
  /** Efectivul direct plus al tuturor descendenților. */
  readonly efectivCumulat: number;
}

export function construiesteArbore<T extends RandArbore>(
  randuri: readonly T[],
  efectivPeDepartament: ReadonlyMap<string, number>,
): readonly NodArbore<T>[] {
  const existente = new Set(randuri.map((r) => r.id));

  const copiiPeParinte = new Map<string, T[]>();
  const radacini: T[] = [];
  for (const r of randuri) {
    const areParinteVizibil = r.parent_id !== null && existente.has(r.parent_id);
    if (!areParinteVizibil) {
      radacini.push(r);
      continue;
    }
    const cheie = r.parent_id as string;
    const lista = copiiPeParinte.get(cheie);
    if (lista === undefined) copiiPeParinte.set(cheie, [r]);
    else lista.push(r);
  }

  const vizitate = new Set<string>();

  function construieste(r: T, nivel: number): NodArbore<T> {
    vizitate.add(r.id);
    const copii = (copiiPeParinte.get(r.id) ?? [])
      .filter((c) => !vizitate.has(c.id))
      .map((c) => construieste(c, nivel + 1));
    const efectivDirect = efectivPeDepartament.get(r.id) ?? 0;
    return {
      date: r,
      copii,
      nivel,
      efectivDirect,
      efectivCumulat: copii.reduce((total, c) => total + c.efectivCumulat, efectivDirect),
    };
  }

  const arbore = radacini.map((r) => construieste(r, 1));

  // Coada pentru cicluri: un nod prins într-un ciclu nu e rădăcină (are părinte
  // vizibil) și nu e atins de nicio recursie pornită dintr-o rădăcină. Îl
  // promovăm, ca să nu dispară de pe ecran.
  // Bucla verifică `vizitate` la FIECARE iterație, nu o dată la început:
  // `construieste` marchează pe parcurs, iar un `.filter().map()` ar evalua
  // filtrul integral ÎNAINTE de prima construcție — deci al doilea nod al
  // aceluiași ciclu ar fi construit a doua oară, ca rădăcină duplicată.
  const suplimentare: NodArbore<T>[] = [];
  for (const r of randuri) {
    if (!vizitate.has(r.id)) suplimentare.push(construieste(r, 1));
  }
  return [...arbore, ...suplimentare];
}
```

- [ ] **Pasul 4: Rulează testele, confirmă că trec**

```bash
pnpm vitest run --project unit src/domain/departments/arbore.test.ts
```

Așteptat: 8 teste PASS.

- [ ] **Pasul 5: Comite**

```bash
git status --short
git add src/domain/departments/arbore.ts src/domain/departments/arbore.test.ts
git commit -m "feat(departamente): arborele de departamente devine logică pură, testată"
```

---

## Sarcina 2: Modulul de citiri

**Fișiere:**

- Creează: `src/lib/queries/departments.ts`

**Interfețe:**

- Consumă: `citesteTot` din `@/lib/queries/citeste-tot`, `PermissionScope` din
  `@/config/permissions`.
- Produce:
  - `RandDepartament`, `AngajatStructura`
  - `structuraDepartamentelor(organizationId): Promise<readonly RandDepartament[]>`
  - `angajatiPentruStructura(organizationId, scope, propriaFisaId): Promise<readonly AngajatStructura[]>`

Fără test automat: stratul de citiri nu are teste care ating baza nicăieri în
proiect (blocajul #3 din `PROGRESS.md`). Câștigul aici e că mutarea codului în
`src/lib/queries/` îl aduce sub poarta structurală `numaratoare-paginata.test.ts`,
care enumeră directorul.

- [ ] **Pasul 1: Scrie modulul**

Creează `src/lib/queries/departments.ts`:

```ts
// src/lib/queries/departments.ts
import "server-only";

import type { PermissionScope } from "@/config/permissions";
import { createServerSupabase } from "@/lib/supabase/server";

import { citesteTot } from "./citeste-tot";

/**
 * Citirile de departamente, în sfârșit într-un loc.
 *
 * Până acum `.from("departments")` apărea în trei module de citiri și opt
 * pagini, iar `/angajati` își lua lista din `queries/attendance.ts` — cu un
 * comentariu care recunoștea că nu e locul ei. Ecranul de structură își scria
 * SQL-ul direct în `page.tsx`.
 *
 * ── DE CE `citesteTot` ȘI NU UN SELECT SIMPLU ─────────────────────────────
 * PostgREST are `max_rows = 1000` și, la depășire, **trunchiază tăcut**.
 * Ecranul de departamente nu paginează: afișează un arbore întreg și numără
 * angajații pe fiecare nod. Cu trunchiere, pastilele de efectiv arată cifre mai
 * mici, iar un departament plin poate afișa „Departament gol" — o cifră greșită
 * fără nicio eroare, exact clasa de defect pe care restul stratului o vânează.
 * `citesteTot` paginează cu cursor keyset și ARUNCĂ la plafon, în loc să taie.
 */

export interface RandDepartament {
  readonly id: string;
  readonly parent_id: string | null;
  readonly cod: string;
  readonly denumire: string;
  readonly descriere: string | null;
  readonly activ: boolean;
  readonly manager_employee_id: string | null;
  readonly cost_center: string | null;
  readonly manager: Readonly<{ full_name: string; user_id: string | null }> | null;
}

export interface AngajatStructura {
  readonly id: string;
  readonly full_name: string;
  readonly marca: string;
  readonly department_id: string | null;
  readonly user_id: string | null;
  readonly job_position: Readonly<{ denumire: string }> | null;
}

const COLOANE_DEPARTAMENT =
  "id, parent_id, cod, denumire, descriere, activ, manager_employee_id, cost_center, manager:employees!manager_employee_id(full_name, user_id)";

const COLOANE_ANGAJAT =
  "id, full_name, marca, department_id, user_id, job_position:job_positions!job_position_id(denumire)";

export async function structuraDepartamentelor(
  organizationId: string,
): Promise<readonly RandDepartament[]> {
  const db = await createServerSupabase();
  return citesteTot<RandDepartament>(
    (dupa, pas) => {
      const q = db
        .from("departments")
        .select(COLOANE_DEPARTAMENT)
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .limit(pas);
      return (dupa === null ? q : q.gt("id", dupa)).returns<RandDepartament[]>();
    },
    (rand) => rand.id,
    { nume: "structura departamentelor" },
  );
}

/**
 * Angajații activi, cu departamentul lor.
 *
 * Întoarce ȘI angajații cu `department_id = null` — nerepartizații. Ecranul îi
 * arăta zero, fiindcă gruparea îi sărea; erau invizibili exact pe pagina de la
 * care ai nevoie să-i vezi.
 *
 * Restrângerea de scope repetă tiparul din `arboreleManagerial`: `own` se uită
 * la propria fișă, `team` la subarborele managerial (`manager_path`), `all` la
 * tot. Atenție la o confuzie ușoară: `team` NU înseamnă „departamentul meu" —
 * scope-ul se rezolvă peste tot pe `manager_path`, niciodată pe `department_id`.
 */
export async function angajatiPentruStructura(
  organizationId: string,
  scope: PermissionScope,
  propriaFisaId: string | null,
): Promise<readonly AngajatStructura[]> {
  if (scope === "none") return [];
  if (scope !== "all" && propriaFisaId === null) return [];

  const db = await createServerSupabase();
  return citesteTot<AngajatStructura>(
    (dupa, pas) => {
      let q = db
        .from("employees")
        .select(COLOANE_ANGAJAT)
        .eq("organization_id", organizationId)
        .eq("status", "activ")
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .limit(pas);
      if (scope === "own") q = q.eq("id", propriaFisaId as string);
      if (scope === "team") q = q.contains("manager_path", [propriaFisaId as string]);
      return (dupa === null ? q : q.gt("id", dupa)).returns<AngajatStructura[]>();
    },
    (rand) => rand.id,
    { nume: "angajații structurii" },
  );
}
```

- [ ] **Pasul 2: Verifică tipurile și poarta structurală**

```bash
pnpm typecheck && pnpm vitest run --project unit src/lib/queries/numaratoare-paginata.test.ts
```

Așteptat: typecheck fără erori; poarta trece (modulul nou nu folosește
`count: "exact"`, deci n-o poate încălca).

**Dacă `typecheck` iese verde suspect de repede sau fără să atingă fișierul nou:**
o eroare de sintaxă oriunde face `tsc` să tacă semantic peste tot. Pune o sondă
de control — o linie `const _sonda: number = "text";` în fișierul nou — și
confirmă că typecheck-ul o raportează. Șterge sonda după.

- [ ] **Pasul 3: Comite**

```bash
git status --short
git add src/lib/queries/departments.ts
git commit -m "feat(citiri): modul propriu pentru departamente, fără trunchiere tăcută"
```

---

## Sarcina 3: Primitiva de comutare

**Fișiere:**

- Creează: `src/components/ui/comutator-vizualizare.tsx`
- Test: `src/components/ui/comutator-vizualizare.test.tsx`

**Interfețe:**

- Consumă: `buton()` din `./buton`, `cn` din `@/lib/ui/cn`.
- Produce: `OptiuneVizualizare`, `ParametriAdresa`, `PropsComutatorVizualizare`,
  `adresaVizualizare(...)`, `ComutatorVizualizare`.

- [ ] **Pasul 1: Scrie testul care pică**

Creează `src/components/ui/comutator-vizualizare.test.tsx`:

```tsx
// src/components/ui/comutator-vizualizare.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// `next/link` are nevoie de runtime-ul Next ca să facă prefetch; în happy-dom
// nu există. Mock-ul trebuie să stea ÎNAINTEA importului componentei.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { ComutatorVizualizare, adresaVizualizare } = await import("./comutator-vizualizare");

/**
 * Defectul real apărat aici: comutatoarele scrise de mână din
 * `/rapoarte` aruncă restul query string-ului, iar cel din `/ssm/instruiri`
 * anunță `role="tablist"` fără `tabpanel`, fără `aria-controls` și fără roving
 * tabindex — un cititor de ecran promite o interacțiune care nu există.
 */

const OPTIUNI = [
  { cheie: "lista", eticheta: "Listă" },
  { cheie: "organigrama", eticheta: "Organigramă" },
] as const;

describe("adresaVizualizare", () => {
  it("păstrează parametrii necunoscuți", () => {
    const adresa = adresaVizualizare(
      "/departamente",
      { q: "vanzari", sort: "-cod" },
      "vizualizare",
      "organigrama",
      "lista",
    );
    expect(adresa).toContain("q=vanzari");
    expect(adresa).toContain("sort=-cod");
    expect(adresa).toContain("vizualizare=organigrama");
  });

  it("ȘTERGE valoarea implicită din adresă în loc s-o scrie", () => {
    const adresa = adresaVizualizare("/departamente", {}, "vizualizare", "lista", "lista");
    expect(adresa).toBe("/departamente");
  });

  it("șterge întotdeauna cursorul", () => {
    // Citirile folosesc cursor keyset: un cursor vechi ar continua de la un rând
    // care nu mai e în rezultat.
    const adresa = adresaVizualizare(
      "/departamente",
      { cursor: "eyJ4IjoxfQ" },
      "vizualizare",
      "organigrama",
      "lista",
    );
    expect(adresa).not.toContain("cursor");
  });

  it("păstrează o cheie repetată", () => {
    const adresa = adresaVizualizare(
      "/departamente",
      { stare: ["activ", "inactiv"] },
      "vizualizare",
      "organigrama",
      "lista",
    );
    expect(adresa.match(/stare=/gu)?.length).toBe(2);
  });
});

describe("ComutatorVizualizare", () => {
  it("marchează segmentul curent cu aria-current și îl lasă navigabil", () => {
    render(
      <ComutatorVizualizare
        eticheta="Cum se afișează structura"
        cheieParametru="vizualizare"
        optiuni={OPTIUNI}
        curenta="organigrama"
        implicita="lista"
        parametri={{}}
        cale="/departamente"
      />,
    );
    const activ = screen.getByRole("link", { name: "Organigramă" });
    expect(activ.getAttribute("aria-current")).toBe("true");
    const inactiv = screen.getByRole("link", { name: "Listă" });
    expect(inactiv.getAttribute("aria-current")).toBeNull();
  });

  it("expune un grup cu nume accesibil, NU un tablist", () => {
    const { container } = render(
      <ComutatorVizualizare
        eticheta="Cum se afișează structura"
        cheieParametru="vizualizare"
        optiuni={OPTIUNI}
        curenta="lista"
        implicita="lista"
        parametri={{}}
        cale="/departamente"
      />,
    );
    expect(screen.getByRole("group", { name: "Cum se afișează structura" })).toBeTruthy();
    expect(container.querySelector('[role="tablist"]')).toBeNull();
  });
});
```

- [ ] **Pasul 2: Rulează testul, confirmă că pică**

```bash
pnpm vitest run --project ui src/components/ui/comutator-vizualizare.test.tsx
```

Așteptat: FAIL — nu se rezolvă `./comutator-vizualizare`.

- [ ] **Pasul 3: Scrie implementarea**

Creează `src/components/ui/comutator-vizualizare.tsx`:

```tsx
// src/components/ui/comutator-vizualizare.tsx
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactElement } from "react";

import { cn } from "@/lib/ui/cn";

import { buton } from "./buton";

/**
 * Comutatorul de vizualizare, pe URL.
 *
 * ── DE CE O PRIMITIVĂ, ACUM ───────────────────────────────────────────────
 * Existau patru comutatoare scrise de mână: `/concedii` (corect),
 * `/ssm/instruiri`, `/rapoarte`, `/revisal`. Diferă între ele în feluri care
 * contează: cel din `/rapoarte` ARUNCĂ restul query string-ului, iar cel din
 * `/ssm/instruiri` anunță `role="tablist"` fără `tabpanel`, fără
 * `aria-controls` și fără roving tabindex — exact promisiunea neonorată despre
 * care `bara-actiuni.tsx` spune în scris că trebuie evitată.
 *
 * Primitiva asta extrage tiparul CORECT, cel din `/concedii`: `role="group"` cu
 * nume accesibil și `aria-current` pe segmentul activ. Nu e un tablist, fiindcă
 * nu comută panouri în aceeași pagină — schimbă adresa.
 *
 * ── DE CE NU E „use client" ───────────────────────────────────────────────
 * Segmentele sunt `<Link replace>`, nu butoane cu `onClick`. Comutatorul nu
 * livrează niciun octet de JavaScript, iar starea supraviețuiește reîncărcării
 * și partajării adresei.
 */

export type OptiuneVizualizare = Readonly<{
  cheie: string;
  eticheta: string;
  pictograma?: LucideIcon;
}>;

/** Forma dată de `await searchParams` în Next 16. */
export type ParametriAdresa = Readonly<Record<string, string | readonly string[] | undefined>>;

export type PropsComutatorVizualizare = Readonly<{
  /** Numele accesibil al grupului — ce aude cineva la cititorul de ecran. */
  eticheta: string;
  cheieParametru: string;
  optiuni: readonly OptiuneVizualizare[];
  curenta: string;
  /** Valoarea care se ȘTERGE din adresă în loc să fie scrisă. */
  implicita: string;
  parametri: ParametriAdresa;
  cale: string;
  className?: string;
}>;

/**
 * Adresa unui segment.
 *
 * Pornește din parametrii EXISTENȚI, nu dintr-un `URLSearchParams` gol: altfel
 * comutarea pierde filtrele deja aplicate. Exportată separat ca să fie testabilă
 * fără DOM.
 */
export function adresaVizualizare(
  cale: string,
  parametri: ParametriAdresa,
  cheieParametru: string,
  cheie: string,
  implicita: string,
): string {
  const p = new URLSearchParams();
  for (const [nume, valoare] of Object.entries(parametri)) {
    if (valoare === undefined) continue;
    if (typeof valoare === "string") p.set(nume, valoare);
    else for (const element of valoare) p.append(nume, element);
  }

  if (cheie === implicita) p.delete(cheieParametru);
  else p.set(cheieParametru, cheie);

  // Citirile folosesc cursor keyset, nu `.range()`: un cursor rămas din
  // vizualizarea precedentă ar continua de la un rând care nu mai e în rezultat.
  p.delete("cursor");

  const interogare = p.toString();
  return interogare === "" ? cale : `${cale}?${interogare}`;
}

export function ComutatorVizualizare({
  eticheta,
  cheieParametru,
  optiuni,
  curenta,
  implicita,
  parametri,
  cale,
  className,
}: PropsComutatorVizualizare): ReactElement {
  return (
    <div
      role="group"
      aria-label={eticheta}
      className={cn("border-border rounded-control inline-flex border p-0.5", className)}
    >
      {optiuni.map((optiune) => {
        const curent = optiune.cheie === curenta;
        const Pictograma = optiune.pictograma;
        return (
          <Link
            key={optiune.cheie}
            href={adresaVizualizare(cale, parametri, cheieParametru, optiune.cheie, implicita)}
            replace
            aria-current={curent ? "true" : undefined}
            className={cn(buton({ varianta: curent ? "primar" : "tertiar" }), "rounded")}
          >
            {Pictograma === undefined ? null : (
              <Pictograma aria-hidden="true" className="size-4" />
            )}
            {optiune.eticheta}
          </Link>
        );
      })}
    </div>
  );
}
```

- [ ] **Pasul 4: Rulează testele, confirmă că trec**

```bash
pnpm vitest run --project ui src/components/ui/comutator-vizualizare.test.tsx
```

Așteptat: 6 teste PASS.

- [ ] **Pasul 5: Comite**

```bash
git status --short
git add src/components/ui/comutator-vizualizare.tsx src/components/ui/comutator-vizualizare.test.tsx
git commit -m "feat(ui): comutator de vizualizare ca primitivă, cu ARIA corectă"
```

---

## Sarcina 4: Acțiunea de mutare

**Fișiere:**

- Modifică: `src/schemas/employee.ts` (adaugă la final, în secțiunea Angajat)
- Modifică: `src/schemas/employee.test.ts` (adaugă un `describe`)
- Modifică: `src/app/(app)/departamente/actions.ts` (adaugă la final)

**Interfețe:**

- Consumă: `createAction`, `businessRule`, `mapPostgrestError`, `notFound` din
  `@/lib/actions/errors`; `createServerSupabase`.
- Produce: `mutaAngajatiSchema`, `MutaAngajatiInput`,
  `mutaAngajati(input): Promise<ActionResult<{ mutati: number }>>`.

- [ ] **Pasul 1: Scrie testul de schemă care pică**

Adaugă la finalul lui `src/schemas/employee.test.ts` (păstrează importurile
existente, extinde linia de import):

```ts
describe("mutaAngajatiSchema", () => {
  it("respinge lista goală de angajați", () => {
    const rezultat = mutaAngajatiSchema.safeParse({ employee_ids: [], department_id: null });
    expect(rezultat.success).toBe(false);
  });

  it("respinge un identificator care nu e UUID", () => {
    const rezultat = mutaAngajatiSchema.safeParse({
      employee_ids: ["nu-e-uuid"],
      department_id: null,
    });
    expect(rezultat.success).toBe(false);
  });

  it("acceptă department_id null — scoaterea din departament", () => {
    const rezultat = mutaAngajatiSchema.safeParse({
      employee_ids: ["11111111-1111-4111-8111-111111111111"],
      department_id: null,
    });
    expect(rezultat.success).toBe(true);
  });

  it("pune department_id pe null când lipsește din intrare", () => {
    const rezultat = mutaAngajatiSchema.parse({
      employee_ids: ["11111111-1111-4111-8111-111111111111"],
    });
    expect(rezultat.department_id).toBeNull();
  });

  it("plafonează mutarea în masă", () => {
    const prea = Array.from({ length: 201 }, () => "11111111-1111-4111-8111-111111111111");
    expect(mutaAngajatiSchema.safeParse({ employee_ids: prea, department_id: null }).success).toBe(
      false,
    );
  });
});
```

Modifică linia de import din același fișier:

```ts
import {
  actualizeazaAngajatSchema,
  CAMPURI_EDITABILE_ANGAJAT,
  mutaAngajatiSchema,
} from "./employee";
```

- [ ] **Pasul 2: Rulează testul, confirmă că pică**

```bash
pnpm vitest run --project unit src/schemas/employee.test.ts
```

Așteptat: FAIL — `mutaAngajatiSchema` nu e exportat.

- [ ] **Pasul 3: Adaugă schema**

Adaugă în `src/schemas/employee.ts`, imediat după `actualizeazaAngajatSchema`:

```ts
/**
 * Mutarea între departamente — o schemă ÎNGUSTĂ, cu două câmpuri.
 *
 * ── DE CE NU SE REFOLOSEȘTE `actualizeazaAngajatSchema` ───────────────────
 * Aceea are 36 de câmpuri, aproape toate cu `.default(...)`. Un payload
 * `{ id, department_id }` ar trece de Zod, iar handler-ul ar trimite 34 de
 * coloane la `.update()`: adresa, reședința, actul de identitate, contactul de
 * urgență, CNP-ul și IBAN-ul s-ar scrie `null`, iar `gen`, `cetatenie`,
 * `conditii_munca` și `optiune_pilon_ii` ar reveni la implicit.
 *
 * Cea mai scumpă pierdere ar fi `manager_employee_id → null`: declanșează
 * `tg_employees_manager_path`, care rescrie `manager_path` la TOȚI subordonații.
 * Cum scope-ul `team` se rezolvă pe `manager_path`, o singură salvare parțială
 * face o ramură întreagă invizibilă pentru managerul ei. UPDATE reușit, zero
 * erori — exact defectul reparat în `e8983a5`.
 *
 * Plafonul de 200 nu e o limită de produs: e o plasă. Cea mai mare firmă din
 * sistem are 8 angajați.
 */
export const mutaAngajatiSchema = z.object({
  employee_ids: z
    .array(z.uuid("Angajatul selectat nu este valid."))
    .min(1, "Selectați cel puțin o persoană.")
    .max(200, "Se pot muta cel mult 200 de persoane deodată."),
  department_id: z.uuid("Departamentul selectat nu este valid.").nullable().default(null),
});

export type MutaAngajatiInput = z.infer<typeof mutaAngajatiSchema>;
```

- [ ] **Pasul 4: Rulează testele, confirmă că trec**

```bash
pnpm vitest run --project unit src/schemas/employee.test.ts
```

Așteptat: toate PASS (cele existente + 5 noi).

- [ ] **Pasul 5: Scrie acțiunea**

Adaugă la finalul lui `src/app/(app)/departamente/actions.ts`. Extinde importul
de scheme cu `mutaAngajatiSchema` din `@/schemas/employee`:

```ts
import { mutaAngajatiSchema } from "@/schemas/employee";
```

```ts
/**
 * Mutarea persoanelor între departamente.
 *
 * ── DE CE EXISTĂ ──────────────────────────────────────────────────────────
 * `dezactiveazaDepartament`, mai sus în acest fișier, refuză cu mesajul
 * „Mutați-i în altă structură înainte de dezactivare". Până acum, unealta la
 * care trimitea mesajul nu exista: singura cale de a schimba departamentul
 * cuiva era formularul complet al fișei, deschis pentru fiecare om în parte.
 *
 * ── PATRU DECIZII CARE NU SE VĂD DIN SEMNĂTURĂ ────────────────────────────
 * 1. `minScope: "all"`, nu `"team"`. `actualizeazaAngajat` are azi `"team"`
 *    deși pagina lui cere `"all"` — deci e invocabilă direct, ca endpoint POST,
 *    de cineva care n-a văzut niciodată ecranul. Discrepanța nu se repetă aici.
 * 2. Departamentul-țintă se verifică EXPLICIT că e al organizației.
 *    `employees.department_id` e o cheie străină simplă, fără componentă pe
 *    `organization_id` și fără trigger — spre deosebire de `parent_id` și
 *    `manager_employee_id`, care AU verificarea în aceeași migrare. E singura
 *    relație din trio-ul HR lăsată nepăzită de bază.
 * 3. `.select("id")` după `.update()`, cu lungimea comparată. RLS refuză cu
 *    zero rânduri și fără eroare; la o mutare în masă, un refuz parțial ar fi
 *    raportat altfel drept reușită deplină.
 * 4. Un refuz parțial NU se poate anula: PostgREST nu deschide o tranzacție
 *    peste două cereri. Mesajul spune deci exact ce s-a întâmplat, cu cifre —
 *    nu „a eșuat", ceea ce ar fi o minciună despre rândurile deja scrise.
 */
export const mutaAngajati = createAction<typeof mutaAngajatiSchema, { mutati: number }>({
  name: "employees.move_department",
  permission: "employees:update",
  minScope: "all",
  input: mutaAngajatiSchema,
  audit: {
    action: "update",
    entityType: "employee",
    // Auditul aplicației scrie un rând pe acțiune. Reconstituirea per persoană
    // vine din triggerul `audit_employees` de pe tabelă, care scrie rândul
    // întreg before+after pentru fiecare angajat atins.
    entityId: (input) => input.employee_ids[0] ?? "",
    allow: ["employee_ids", "department_id"],
  },
  revalidate: ["/departamente", "/angajati", "/organigrama"],
  handler: async (ctx, input) => {
    const db = await createServerSupabase();

    if (input.department_id !== null) {
      const { data: departament, error: eroareDepartament } = await db
        .from("departments")
        .select("id")
        .eq("id", input.department_id)
        .eq("organization_id", ctx.tenant.organizationId)
        .is("deleted_at", null)
        .maybeSingle();
      if (eroareDepartament !== null) throw mapPostgrestError(eroareDepartament, ctx.requestId);
      if (departament === null) throw notFound("Departamentul selectat nu a fost găsit.");
    }

    const { data, error } = await db
      .from("employees")
      .update({ department_id: input.department_id, updated_by: ctx.user.id })
      .in("id", input.employee_ids)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id");
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);

    const mutati = data?.length ?? 0;
    if (mutati !== input.employee_ids.length) {
      throw businessRule(
        `Au fost mutate ${String(mutati)} din ${String(input.employee_ids.length)} persoane. Restul au fost refuzate: fișele au fost șterse între timp sau nu aveți dreptul de a le modifica. Reîncărcați pagina.`,
      );
    }

    return { mutati };
  },
});
```

- [ ] **Pasul 6: Verifică**

```bash
pnpm typecheck && pnpm lint
```

Așteptat: fără erori. `businessRule`, `mapPostgrestError` și `notFound` sunt deja
importate în capul fișierului — nu le dubla.

- [ ] **Pasul 7: Comite**

```bash
git status --short
git add src/schemas/employee.ts src/schemas/employee.test.ts "src/app/(app)/departamente/actions.ts"
git commit -m "feat(departamente): mutarea persoanelor între departamente, pe o singură coloană"
```

---

## Sarcina 5: Direcția vizuală

**Fișiere:** niciunul. Sarcina produce decizii, nu cod.

- [ ] **Pasul 1: Încarcă skill-ul de gust**

```
Skill(skill="taste-skill:taste-skill")
```

Cerut explicit de utilizator pentru acest ecran.

- [ ] **Pasul 2: Fixează direcția pe paleta REALĂ a proiectului**

Nu se inventează o paletă. Valorile existente, din `src/app/globals.css`:

| Rol             | Token                     | Valoare                                     |
| --------------- | ------------------------- | ------------------------------------------- |
| Fundal          | `--color-background`      | `#faf7f0` (crem)                            |
| Suprafață card  | `--color-surface`         | `#f2ede1`                                   |
| Structură/acțiuni | `--color-primary`       | `#0f1e3d` (navy)                            |
| Text            | `--color-foreground`      | `#14213d`                                   |
| Text secundar   | `--color-muted-foreground` | `#5b6478`                                  |
| Chenar          | `--color-border`          | `#e3dbc9`                                   |
| Accent (rar)    | `--color-accent`          | `#c9a227` (auriu)                           |
| Cifra de panou  | `--text-cifra`            | `2rem`, mereu cu `font-mono tabular-nums`   |
| Raze            | `rounded-control` / `rounded-panou` | `0.375rem` / `0.5rem`             |
| Umbre           | `shadow-ridicat` / `shadow-plutitor` | în cerneala paletei, nu în negru |
| Hașură          | `@utility hasura`         | „nu se mai scrie aici"                      |

Constrângeri care nu se negociază:

- **O singură temă.** Nu există `.dark`, nu există `prefers-color-scheme`.
  `color-scheme: light` e declarat deliberat.
- **Auriul e rar.** Regula scrisă în paletă: „crem = fundal, navy = structură și
  acțiuni, accent = folosit rar".
- **Fără gradiente, fără umbre grele.** Interfața trebuie să arate ca un
  instrument profesional, nu ca un site de prezentare.
- **`border-border` (1,29:1) nu poate purta singur informație.** Unde un chenar
  e purtător de sens, se folosește `border-foreground/60` — vezi raționamentul
  din `rapoarte/page.tsx:224-232`.
- **Ținte de atingere:** vin gratuit din `buton()`, prin `pointer-coarse:h-11`.

- [ ] **Pasul 3: Notează direcția în plan**

Scrie două-trei propoziții despre direcția aleasă direct în discuție, ca să
existe un reper la revizuire. Fără fișier nou.

---

## Sarcina 6: Panoul de lucru

**Fișiere:**

- Creează: `src/app/(app)/departamente/panou-departament.tsx`

**Interfețe:**

- Consumă: `mutaAngajati` din `./actions`; `PanouLateral` din
  `@/components/ui/dialog`; `Buton`, `Combobox`, `AvatarAngajat`, `StareGoala`.
- Produce: `PanouDepartament`, cu props:

```ts
Readonly<{
  deschis: boolean;
  laInchidere: () => void;
  departament: Readonly<{ id: string; denumire: string; cod: string } > | null;
  persoane: readonly PersoanaPanou[];
  nerepartizati: readonly PersoanaPanou[];
  departamente: readonly Readonly<{ id: string; denumire: string; cod: string }>[];
  poateMuta: boolean;
}>
```

unde `PersoanaPanou = Readonly<{ id: string; full_name: string; marca: string; avatar_url: string | null; functie: string | null }>`.

`departament: null` = panoul „Nerepartizați".

- [ ] **Pasul 1: Scrie componenta**

Cerințe de comportament, fiecare cu motivul ei:

1. `"use client"`. Stare pe `useState` + `useTransition`, id-uri pe `useId`.
   **Nu** react-hook-form (4 fișiere din 118).
2. Căutare locală după `full_name` și `marca`, fără cerere la server: lista e
   deja încărcată.
3. Selecție multiplă cu bife (`clasaBifa` din `@/components/ui/camp`).
4. Subsol cu `Combobox` de departamente + opțiunea `— fără departament —`
   (valoare `""` → `null`), buton „Mută N persoane".
5. Secțiune „Adaugă în departament", cu `Combobox` alimentat din
   `nerepartizati` **primii**, apoi ceilalți angajați cu departamentul curent în
   `secundar`.
6. La refuz: mesajul acțiunii se afișează într-un `<p role="alert">`,
   **nu** se înghite. La reușită: `router.refresh()`.
7. Dacă `poateMuta` e fals, panoul randează lista **fără niciun control de
   scriere** — nu doar dezactivat.
8. **Nota permanentă**, într-un `Callout fel="informativ"`, text exact:

   > Mutarea între departamente nu schimbă cine vede pe cine. Drepturile de
   > vizibilitate și de aprobare vin din managerul direct al fișei, nu din
   > departament.

   Motivul: scope-ul `team` se rezolvă peste tot pe `manager_path`, niciodată pe
   `department_id` (`0005_hr_rls.sql:191`). Fără nota asta, utilizatorul crede
   că a mutat și drepturile.

- [ ] **Pasul 2: Verifică**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Pasul 3: Comite**

```bash
git status --short
git add "src/app/(app)/departamente/panou-departament.tsx"
git commit -m "feat(departamente): panoul de lucru cu persoanele unui departament"
```

---

## Sarcina 7: Vizualizarea listă și rutarea paginii

**Fișiere:**

- Creează: `src/app/(app)/departamente/vizualizare-lista.tsx`
- Modifică: `src/app/(app)/departamente/page.tsx` (rescriere)

**Interfețe:**

- Consumă: `construiesteArbore`, `NodArbore` din `@/domain/departments/arbore`;
  `structuraDepartamentelor`, `angajatiPentruStructura` din
  `@/lib/queries/departments`; `ComutatorVizualizare`; `PanouDepartament`.
- Produce: `VizualizareLista`.

Livrabilul sarcinii: ecranul funcționează **complet**, ca înainte, plus
comutatorul vizibil și panoul funcțional. Vizualizarea `organigrama` cade încă pe
listă (se rezolvă în Sarcina 8).

- [ ] **Pasul 1: Rescrie `page.tsx`**

Preambulul rămâne neatins ca ordine: `requireTenant` → `requireFeature("nucleu")`
→ `getPermissionMap` → `scopeFor`/`can` → `AccesRestrictionat`.

Nou în `page.tsx`:

```ts
interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const VIZUALIZARI = ["lista", "organigrama"] as const;
const vizualizareSchema = z.enum(VIZUALIZARI).default("lista");
```

`const parametri = await searchParams;` — în Next 16 `searchParams` e o
**promisiune**. Validarea listă-închisă face ca un URL copiat greșit să cadă pe
implicit, nu să strice ecranul.

Citirile devin:

```ts
const [structura, angajati] = await Promise.all([
  structuraDepartamentelor(tenant.organizationId),
  angajatiPentruStructura(tenant.organizationId, scopeAngajati, propriaFisaId),
]);
```

`propriaFisaId` se cere doar când `scopeAngajati !== "all"`, prin `idFisaProprie`
din `@/lib/queries/employees` — tiparul din `/organigrama`.

Booleeni pe server: `poateCrea` (`departments:create` la `all`), `poateEdita`
(`departments:update` la `all`), `poateMutaPersoane` (`employees:update` la
`all`).

- [ ] **Pasul 2: Scrie `vizualizare-lista.tsx`**

Card per departament, indentat pe `nivel`:

- pătrat de identitate `size-9 bg-background rounded-control` cu `Building2`
- denumire `font-medium` · cod `text-nota font-mono text-muted-foreground`
- badge `Inactiv` (primitiva `Badge`, `ton="neutru"`)
- manager: `AvatarAngajat marime="sm"` + link către `/angajati/{id}`, sau
  „manager nedesemnat" în italic
- **stivă de avatare**: primii 5 cu `-space-x-2`, apoi pastila `+N`
- **efectiv dublu**: `efectivDirect` mare, `efectivCumulat` ca notă
  („34 cu subordonatele") — se afișează doar când diferă de cel direct
- `BaraActiuni`: **Persoane** (deschide panoul) · Editează · Mută ·
  Dezactivează/Reactivează

Vechea componentă `Arbore` din `page.tsx` (liniile 101-231) se șterge. Comentariul
ei despre **de ce nu se folosește `role="tree"`** se PĂSTREAZĂ, mutat: motivul
rămâne valabil — pattern-ul ARIA de tip tree interzice descendenți interactivi,
iar aici sunt link-uri și butoane în fiecare nod.

- [ ] **Pasul 3: Verifică**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

- [ ] **Pasul 4: Verificare manuală**

Nu există test automat pentru pagini în acest proiect (un singur `.test.ts` în
tot grupul `(app)`, și acela pe salarizare). Deci:

```bash
pnpm dev
```

Verifică pe `http://localhost:3000/departamente`:

- lista arată ca înainte, cu efectivele corecte
- comutatorul apare și `?vizualizare=organigrama` nu dă eroare
- panoul se deschide, caută, mută o persoană, iar cifra se actualizează
- cu un cont fără `employees:update = all`, panoul nu arată niciun control de
  scriere

- [ ] **Pasul 5: Comite**

```bash
git status --short
git add "src/app/(app)/departamente/vizualizare-lista.tsx" "src/app/(app)/departamente/page.tsx"
git commit -m "feat(departamente): vizualizarea listă redesenată, cu comutator și panou"
```

---

## Sarcina 8: Organigrama de departamente și banda „Nerepartizați"

**Fișiere:**

- Creează: `src/app/(app)/departamente/vizualizare-organigrama.tsx`
- Modifică: `src/app/(app)/departamente/page.tsx` (ramura de rutare)
- Modifică: `src/app/(app)/departamente/vizualizare-lista.tsx` (banda)

**Interfețe:**

- Consumă: `NodArbore` din `@/domain/departments/arbore`; `PanouDepartament`.
- Produce: `VizualizareOrganigrama`, `BandaNerepartizati`.

- [ ] **Pasul 1: Scrie organigrama**

Refolosește CSS-ul de conectori care **există deja** în `globals.css:341` —
`.og-radacina` pentru `<ul>`-ul rădăcină, `.og-ramura` pentru fiecare `<ul>`
imbricat. Nu se scrie CSS nou; liniile sunt `::before`/`::after` pe `<li>`, tăiate
condiționat prin `:first-child`/`:last-child`/`:only-child`, în
`var(--color-border)`.

Pătratul:

- `w-40` pe desktop, `w-32` sub `sm`
- cod `text-nota font-mono` sus
- denumire `text-corp font-medium leading-tight`
- manager: `AvatarAngajat marime="sm"` + nume, sau „nedesemnat"
- **cifra de efectiv**: `text-cifra font-mono tabular-nums leading-none` —
  tokenul de KPI al proiectului
- stivă de 3 avatare jos
- departament inactiv: clasa utilitară `hasura` peste card, plus badge.
  Motivul alegerii: hașura e notația proiectului pentru „nu s-a întâmplat și nu
  se mai poate scrie aici" și **supraviețuiește tipăririi alb-negru**, spre
  deosebire de culoare.
- pătratul e `<button>`, nu `<a>`: deschide panoul, nu navighează

Învelișul: `<div className="-mx-4 overflow-x-auto px-4 pb-4">` cu un
`<div className="w-fit min-w-full">` înăuntru — derulare orizontală proprie,
niciodată pe `body`.

- [ ] **Pasul 2: Scrie banda „Nerepartizați"**

Apare în **ambele** vizualizări, deasupra structurii, **doar când există**
angajați cu `department_id === null`:

- `Callout` sau card cu `bg-accent/8`, text „N persoane fără departament"
- buton care deschide `PanouDepartament` cu `departament={null}`

`department_id is null` e azi complet invizibil pe acest ecran. E câștigul cel
mai mare al refacerii, deci nu se ascunde într-un colț.

- [ ] **Pasul 3: Cablează ramura de rutare în `page.tsx`**

```tsx
{vizualizare === "organigrama" ? (
  <VizualizareOrganigrama ... />
) : (
  <VizualizareLista ... />
)}
```

- [ ] **Pasul 4: Verifică**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

- [ ] **Pasul 5: Verificare manuală, inclusiv pe telefon**

```bash
pnpm dev
```

- comutează pe Organigramă: pătratele apar conectate ierarhic
- un departament inactiv e hașurat
- **la 375 px lățime**: organigrama derulează orizontal, iar `body` **nu**
  derulează; panoul e ecran plin; butoanele au cel puțin 44 px înălțime
- banda „Nerepartizați" apare doar când chiar există astfel de angajați

- [ ] **Pasul 6: Comite**

```bash
git status --short
git add "src/app/(app)/departamente/vizualizare-organigrama.tsx" "src/app/(app)/departamente/vizualizare-lista.tsx" "src/app/(app)/departamente/page.tsx"
git commit -m "feat(departamente): organigrama de departamente și banda nerepartizaților"
```

---

## Sarcina 9: Poarta de verificare

**Fișiere:** niciunul.

- [ ] **Pasul 1: Lanțul complet, fără build**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Așteptat: zero erori; numărul de teste crește cu 19 față de baza de plecare
(8 arbore + 6 comutator + 5 schemă).

- [ ] **Pasul 2: Sonda de control pentru typecheck**

O eroare de sintaxă oriunde face `tsc` să tacă semantic peste tot, iar poarta
devine zgomot verde. Confirmă că typecheck-ul chiar vede fișierele noi:

```bash
echo 'const _sonda: number = "text";' >> src/domain/departments/arbore.ts
pnpm typecheck   # TREBUIE să pice aici
git checkout src/domain/departments/arbore.ts
pnpm typecheck   # și să treacă după
```

- [ ] **Pasul 3: Declară ce NU s-a verificat**

`pnpm build` nu s-a rulat, la cererea explicită a utilizatorului. Rămâne
neverificată **granița server/client** pe fișierele noi — concret: că
`panou-departament.tsx` e singurul cu `"use client"`, că
`comutator-vizualizare.tsx` **nu** are directivă (altfel devine inutil ca Server
Component), și că niciun fișier `"use server"` nu exportă o constantă. `tsc` tace
la toate trei. Spune asta explicit în raport, nu-l lăsa pe utilizator să
presupună că e acoperit.

- [ ] **Pasul 4: Revizuire adversarială de izolare**

```
Agent(subagent_type="administrativo:erp-santinela-tenant")
```

Read-only, permis explicit de CLAUDE.md înainte de orice commit care atinge
`actions.ts`. Caută cele unsprezece clase de defecte repetate ale proiectului.

- [ ] **Pasul 5: Proba de scriere reală**

```
Skill(skill="administrativo:proba", args="employees department_id")
```

Verifică efectiv că `org_admin` și `hr` **POT** muta o persoană, nu doar că
`manager` nu poate. Poarta pozitivă e singura care lipsea în Faza 2, când
proiectul a fost declarat livrat în timp ce un `org_admin` nu putea insera un
angajat.

---

## Auto-revizuire a planului

**Acoperirea specificației.** Fiecare secțiune din spec are o sarcină:
§3.1 → S1 · §3.2 → S2 · §3.3 → S3 · §3.4 → S7 · §4.1 → S7 · §4.2 → S8 ·
§4.3 → S8 · §5 → S6 · §6 → S4 · §7 → S7 (booleeni pe server) · §9 → S1, S3, S4 ·
§10 → S9. Direcția vizuală cerută de utilizator (taste-skill) → S5.

**Consistența numelor.** `construiesteArbore` / `NodArbore` / `RandArbore` —
identice în S1, S7, S8. `adresaVizualizare` / `ComutatorVizualizare` — identice
în S3 și S7. `mutaAngajatiSchema` / `mutaAngajati` — identice în S4 și S6.
`structuraDepartamentelor` / `angajatiPentruStructura` — identice în S2 și S7.

**Abateri conștiente de la skill-ul writing-plans.** (1) Nu se folosește
`subagent-driven-development`, fiindcă memoria proiectului interzice fan-out-ul
de implementare. (2) Sarcinile 6-8 nu au teste automate: proiectul nu testează
pagini din `src/app/(app)/`, iar glob-ul `ui` acoperă doar
`src/components/**/*.test.tsx`. În locul lor, pași de verificare manuală
explicită, inclusiv la 375 px. Inventarea unei infrastructuri de testare pentru
pagini ar fi un al doilea proiect, nu o parte din acesta.
