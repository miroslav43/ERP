# Demo interactiv per modul — pasul 0 (mașinăria + felia pe `leave`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps
> use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un chenar cu ecranul REAL de concedii pe `/module/leave`, care se deschide într-un
popup interactiv unde vizitatorul poate răsfoi și depune o cerere, cu datele trăind doar în
sesiunea lui de browser.

**Architecture:** Demo-ul trăiește într-un grup de rute public propriu (`/vitrina/*`), într-un
**document separat**, încadrat cu `<iframe>` același origin. Documentul separat rezolvă dintr-o
lovitură fontul de cifre lipsă din marketing, scurgerea regulilor `.mk`, zoom-ul iOS și
bundle-ul care altfel ar intra în cele 19 pagini prerandate — și păstrează starea-din-URL
funcțională înăuntru. Ecranele randate sunt **componentele reale** din `src/app/(app)/`,
alimentate cu fixture-uri; regulile de calcul vin din `src/domain/`, care e curat de
`server-only` și rulează în browser.

**Tech Stack:** Next.js 16.3 App Router · React 19.2 · Tailwind v4 · Vitest +
@testing-library/react · `sessionStorage`

**Spec:** `docs/superpowers/specs/2026-09-04-demo-interactiv-module-design.md`

## Global Constraints

- **Limba:** cod, comentarii, mesaje și identificatori de domeniu **în română**, cu ș/ț cu
  **virgulă dedesubt** (U+0219/U+021B), niciodată cu sedilă. Mesajele de eroare se termină cu
  punct.
- **Nimic nu pleacă spre server din vitrină.** Nicio Server Action reală, niciun `fetch`, niciun
  cookie. Cerința (c) din spec e satisfăcută prin construcție.
- **Vitrina e `noindex`** și **nu intră în sitemap** (`src/content/landing/harta.ts`).
- **Nu se rulează `pnpm build`** în sesiune (preferință explicită a utilizatorului, de două ori).
  Poarta finală rămâne `pnpm typecheck && pnpm lint && pnpm test`; ce prinde doar build-ul se
  declară neprins, nu se presupune trecut.
- **Comportamentul de client nu se poate proba local** (`next dev` nu hidratează în mediul ăsta).
  Testele de randare sunt poarta; interacțiunea reală se declară **neverificată** până la o probă
  pe producție.
- **Commit:** `git commit --only -F <fișier-mesaj> -- <căi>`. Fișierele NOI se `git add` întâi.
  `-m`/`-F` **înaintea** lui `--`. `git fetch origin main` înainte de push; `git merge`, nu
  rebase. Niciodată `git add -A`.
- **Repo partajat:** `git status --short -- <căile tale>` înainte de orice commit. Dacă
  harness-ul anunță „file changed on disk", rulează `git diff -- <cale>` înainte de a comite.

---

## File Structure

| Fișier                                              | Responsabilitate                                                       |
| --------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/demo/lume.ts`                                  | Firma fictivă, comună tuturor modulelor. Fără React, fără DOM.         |
| `src/demo/depozit.ts`                               | Starea de sesiune: citire/scriere `sessionStorage`, tolerantă la eșec. |
| `src/demo/actiune.ts`                               | Fabrica de acțiuni false, cu forma `ActionResult<T>`.                  |
| `src/demo/roluri.ts`                                | Cele trei roluri demonstrate și ce văd, derivate din vocabularul real. |
| `src/app/(vitrina)/layout.tsx`                      | Documentul demo: `monoCifre`, `data-zona`, `noindex`.                  |
| `src/app/(vitrina)/vitrina/leave/page.tsx`          | Ecranul de concedii în vitrină.                                        |
| `src/app/(vitrina)/vitrina/leave/vitrina-leave.tsx` | Arborele client: depozit + comutator de rol + componentele reale.      |
| `src/app/(marketing)/_componente/prin-geam.tsx`     | Banda de marketing: passe-partout + iframe leneș + popup `<dialog>`.   |

Fișiere de producție atinse: `src/content/landing/ro.ts`, `src/content/landing/en.ts`,
`src/proxy.ts`, `src/app/(app)/concedii/dialog-cerere-noua.tsx`,
`src/app/(marketing)/module/[modul]/page.tsx`.

---

### Task 1: Scoaterea minciunii despre jumătățile de zi

Situl promite azi, în producție, o funcție pe care baza o interzice. `0112_concediu_doar_zi_intreaga.sql:51-56`
adaugă `check (portiune_inceput = 'zi_intreaga' and portiune_sfarsit = 'zi_intreaga')` și
`check (portiune = 'zi_intreaga')`. Textul de vânzare a rămas din varianta veche.

**Files:**

- Modify: `src/content/landing/ro.ts:245`
- Modify: `src/content/landing/en.ts:225`
- Test: `src/content/landing/continut.test.ts`

**Interfaces:**

- Consumes: nimic
- Produces: nimic (reparație izolată)

- [ ] **Step 1: Write the failing test**

În `src/content/landing/continut.test.ts`, adaugă la finalul fișierului:

```ts
describe("promisiuni contrazise de bază", () => {
  /**
   * `0112_concediu_doar_zi_intreaga.sql` interzice prin `check` orice altceva
   * decât `zi_intreaga`. Un text de vânzare care promite jumătăți de zi e o
   * minciună publicată, nu o inexactitate.
   */
  it("nu promite jumătăți de zi la concedii", () => {
    const modulRo = RO.module.grupuri.flatMap((g) => g.module).find((m) => m.cheie === "leave");
    const modulEn = EN.module.grupuri.flatMap((g) => g.module).find((m) => m.cheie === "leave");

    expect(modulRo).toBeDefined();
    expect(modulEn).toBeDefined();
    expect(`${modulRo?.text} ${modulRo?.puncte.join(" ")}`).not.toMatch(/jumăt/i);
    expect(`${modulEn?.text} ${modulEn?.puncte.join(" ")}`).not.toMatch(/half[- ]day/i);
  });
});
```

Dacă `EN` nu e deja importat în fișier, adaugă importul lângă cel al lui `RO`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project unit src/content/landing/continut.test.ts -t "jumătăți de zi"`
Expected: FAIL — șirul conține „jumătățile de zi de la capete se numără corect".

- [ ] **Step 3: Rescrie ambele texte**

`src/content/landing/ro.ts:245` — înlocuiește valoarea lui `text` cu:

```ts
text: "Cererea trece pe lanțul de aprobare, soldul se recalculează singur, iar zilele nelucrătoare și sărbătorile legale se scot automat din numărătoare.",
```

`src/content/landing/en.ts:225` — înlocuiește valoarea lui `text` cu:

```ts
text: "The request travels the approval chain, the balance recalculates itself, and non-working days and public holidays drop out of the count automatically.",
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --project unit src/content/landing/continut.test.ts`
Expected: PASS, inclusiv testele existente de conținut.

- [ ] **Step 5: Commit**

```bash
git status --short -- src/content/landing/
cat > /tmp/msg.txt <<'MSG'
fix(marketing): scoate promisiunea jumătăților de zi de la concedii

0112_concediu_doar_zi_intreaga.sql interzice prin `check` orice altceva
decât `zi_intreaga`, dar ro.ts:245 și en.ts:225 promiteau că „jumătățile
de zi de la capete se numără corect". Funcția a fost scoasă din produs;
textul de vânzare rămăsese. Testul din continut.test.ts oprește recidiva.
MSG
git commit --only -F /tmp/msg.txt -- src/content/landing/ro.ts src/content/landing/en.ts src/content/landing/continut.test.ts
```

---

### Task 2: Lumea fictivă

O singură firmă, nouăsprezece ferestre în ea. Datele se generează **relativ la azi** — un
fixture cu date literale arată o lună moartă peste trei luni, fără nicio eroare.

**Files:**

- Create: `src/demo/lume.ts`
- Test: `src/demo/lume.test.ts`

**Interfaces:**

- Consumes: `RandAngajatPlanificator` din
  `src/app/(app)/concedii/calendar/planificator-concedii.tsx`; `AbsentaCelula` și `cheieCelula`
  din `@/domain/leave/planificator`
- Produces:
  - `ANGAJATI: readonly RandAngajatPlanificator[]` — 8 oameni
  - `TIPURI: readonly { id: string; denumire: string; culoare: string }[]`
  - `absenteLunii(azi: string): Readonly<Record<string, readonly AbsentaCelula[]>>`
  - `type Absenta = { employeeId: string; deLaZiuaLunii: number; panaLaZiuaLunii: number; tipId: string; stare: "aprobata" | "in_aprobare" }`

- [ ] **Step 1: Write the failing test**

Create `src/demo/lume.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { cheieCelula } from "@/domain/leave/planificator";

import { absenteLunii, ANGAJATI, TIPURI } from "./lume";

describe("lumea fictivă", () => {
  it("are opt angajați cu marcă unică", () => {
    expect(ANGAJATI).toHaveLength(8);
    expect(new Set(ANGAJATI.map((a) => a.marca)).size).toBe(8);
  });

  it("are tipuri de concediu cu culoare validă", () => {
    expect(TIPURI.length).toBeGreaterThan(2);
    for (const tip of TIPURI) expect(tip.culoare).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("așază absențele în LUNA primită, nu într-o lună fixă", () => {
    const celule = absenteLunii("2027-11-15");
    const chei = Object.keys(celule);
    expect(chei.length).toBeGreaterThan(0);
    for (const cheie of chei) expect(cheie).toContain("2027-11-");
  });

  it("cheile sunt construite cu cheieCelula, nu de mână", () => {
    const celule = absenteLunii("2026-03-10");
    const primaCheie = Object.keys(celule)[0] ?? "";
    const [employeeId = "", data = ""] = primaCheie.split("|");
    expect(cheieCelula(employeeId, data)).toBe(primaCheie);
  });

  it("conține cel puțin o absență în aprobare, ca hașura să aibă ce demonstra", () => {
    const stari = Object.values(absenteLunii("2026-03-10")).flatMap((c) => c.map((a) => a.stare));
    expect(stari).toContain("in_aprobare");
    expect(stari).toContain("aprobata");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project unit src/demo/lume.test.ts`
Expected: FAIL — `Cannot find module './lume'`.

- [ ] **Step 3: Write the implementation**

Create `src/demo/lume.ts`:

```ts
/**
 * Firma fictivă a demonstrațiilor — una singură, pentru toate modulele.
 *
 * ── DE CE O SINGURĂ LUME ──────────────────────────────────────────────────
 * Nouăsprezece seturi de fixture-uri independente ar fi arătat ca nouăsprezece
 * capturi de pe site-uri diferite. Aici același Popescu Ion apare în pontaj, în
 * concedii și pe fluturaș: vizitatorul care deschide două module vede aceeași
 * firmă, iar demonstrația capătă o poveste.
 *
 * ── DE CE TOTUL E RELATIV LA „AZI" ────────────────────────────────────────
 * `calendar/page.tsx` ancorează grila pe `todayInBucharest()` și marchează
 * coloana zilei curente. Un fixture cu date scrise literal („12 mai") arată o
 * lună moartă peste trei luni — demo-ul îmbătrânește TĂCUT pe pagina publică,
 * fără nicio eroare. De aceea absențele se descriu prin ziua din lună, iar luna
 * o dă parametrul.
 *
 * Numele sunt inventate. Nu corespund niciunui angajat real al vreunui client.
 */
import { cheieCelula, type AbsentaCelula } from "@/domain/leave/planificator";

import type { RandAngajatPlanificator } from "@/app/(app)/concedii/calendar/planificator-concedii";

export const ANGAJATI: readonly RandAngajatPlanificator[] = [
  { id: "d1", nume: "Popescu Ion", marca: "A-001" },
  { id: "d2", nume: "Ionescu Ana", marca: "A-002" },
  { id: "d3", nume: "Marin Vasile", marca: "A-003" },
  { id: "d4", nume: "Dobre Elena", marca: "A-004" },
  { id: "d5", nume: "Stan Mihai", marca: "A-005" },
  { id: "d6", nume: "Radu Cristina", marca: "A-006" },
  { id: "d7", nume: "Neagu Andrei", marca: "A-007" },
  { id: "d8", nume: "Toma Gabriela", marca: "A-008" },
];

export const TIPURI: readonly Readonly<{ id: string; denumire: string; culoare: string }>[] = [
  { id: "t-odihna", denumire: "Odihnă", culoare: "#2563EB" },
  { id: "t-medical", denumire: "Medical", culoare: "#DC2626" },
  { id: "t-fara-plata", denumire: "Fără plată", culoare: "#B4802A" },
];

export type Absenta = Readonly<{
  employeeId: string;
  deLaZiuaLunii: number;
  panaLaZiuaLunii: number;
  tipId: string;
  stare: "aprobata" | "in_aprobare";
}>;

/**
 * Absențele lunii, descrise prin ziua din lună. Deliberat sub pragul de
 * absenți simultani pe majoritatea zilelor, cu O SINGURĂ suprapunere — ea e
 * argumentul modulului, deci trebuie să se vadă.
 */
const ABSENTE: readonly Absenta[] = [
  { employeeId: "d1", deLaZiuaLunii: 4, panaLaZiuaLunii: 8, tipId: "t-odihna", stare: "aprobata" },
  { employeeId: "d2", deLaZiuaLunii: 6, panaLaZiuaLunii: 7, tipId: "t-medical", stare: "aprobata" },
  {
    employeeId: "d3",
    deLaZiuaLunii: 12,
    panaLaZiuaLunii: 16,
    tipId: "t-odihna",
    stare: "in_aprobare",
  },
  {
    employeeId: "d5",
    deLaZiuaLunii: 19,
    panaLaZiuaLunii: 21,
    tipId: "t-fara-plata",
    stare: "aprobata",
  },
  {
    employeeId: "d7",
    deLaZiuaLunii: 24,
    panaLaZiuaLunii: 26,
    tipId: "t-odihna",
    stare: "in_aprobare",
  },
];

function ziuaIso(an: number, luna: number, zi: number): string {
  return `${String(an)}-${String(luna).padStart(2, "0")}-${String(zi).padStart(2, "0")}`;
}

/** Câte zile are luna — `new Date(an, luna, 0)` dă ultima zi a lunii `luna`. */
function zileInLuna(an: number, luna: number): number {
  return new Date(an, luna, 0).getDate();
}

/**
 * Celulele planificatorului pentru luna în care cade `azi` (ISO, `YYYY-MM-DD`).
 * Cheia e cea produsă de `cheieCelula`, nu una construită de mână: dacă
 * formatul ei se schimbă, demo-ul se schimbă odată cu el.
 */
export function absenteLunii(azi: string): Readonly<Record<string, readonly AbsentaCelula[]>> {
  const an = Number(azi.slice(0, 4));
  const luna = Number(azi.slice(5, 7));
  const ultima = zileInLuna(an, luna);
  const harta = new Map<string, AbsentaCelula[]>();

  for (const absenta of ABSENTE) {
    const tip = TIPURI.find((t) => t.id === absenta.tipId);
    if (tip === undefined) continue;
    for (let zi = absenta.deLaZiuaLunii; zi <= Math.min(absenta.panaLaZiuaLunii, ultima); zi += 1) {
      const cheie = cheieCelula(absenta.employeeId, ziuaIso(an, luna, zi));
      const celula: AbsentaCelula = {
        tipId: tip.id,
        tipDenumire: tip.denumire,
        tipCuloare: tip.culoare,
        stare: absenta.stare,
      };
      const existent = harta.get(cheie);
      if (existent === undefined) harta.set(cheie, [celula]);
      else existent.push(celula);
    }
  }

  return Object.fromEntries(harta);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --project unit src/demo/lume.test.ts`
Expected: PASS — 5 teste.

Dacă testul „cheile sunt construite cu cheieCelula" pică, citește semnătura reală a lui
`cheieCelula` din `src/domain/leave/planificator.ts` și adaptează despărțirea din test la
separatorul folosit acolo — **nu** schimba `lume.ts` ca să se potrivească unei presupuneri.

- [ ] **Step 5: Commit**

```bash
git add src/demo/lume.ts src/demo/lume.test.ts
git status --short -- src/demo/
cat > /tmp/msg.txt <<'MSG'
feat(demo): firma fictivă comună tuturor demonstrațiilor

Opt angajați, trei tipuri de concediu, cinci absențe descrise prin ziua
din lună — nu prin dată literală, ca demo-ul să nu îmbătrânească tăcut pe
pagina publică. Cheile celulelor vin din `cheieCelula`, deci o schimbare
de format se propagă singură.
MSG
git commit --only -F /tmp/msg.txt -- src/demo/lume.ts src/demo/lume.test.ts
```

---

### Task 3: Depozitul de sesiune

Starea demo-ului trăiește în memorie și se oglindește în `sessionStorage`. Accesul la
`sessionStorage` **aruncă** în unele contexte (fereastră privată, date de sit blocate), deci
fiecare citire și fiecare scriere sunt înfășurate.

**Files:**

- Create: `src/demo/depozit.ts`
- Test: `src/demo/depozit.test.ts`

**Interfaces:**

- Consumes: nimic
- Produces:
  - `citesteDepozit<T>(cheie: string, implicit: T): T`
  - `scrieDepozit<T>(cheie: string, valoare: T): void`
  - `CHEIE_CONCEDII: "vitrina.concedii"`

- [ ] **Step 1: Write the failing test**

Create `src/demo/depozit.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { citesteDepozit, scrieDepozit } from "./depozit";

afterEach(() => {
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe("depozitul de sesiune", () => {
  it("întoarce implicitul când nu s-a scris nimic", () => {
    expect(citesteDepozit("proba", { n: 1 })).toEqual({ n: 1 });
  });

  it("citește înapoi ce a scris", () => {
    scrieDepozit("proba", { n: 42 });
    expect(citesteDepozit("proba", { n: 1 })).toEqual({ n: 42 });
  });

  it("întoarce implicitul când valoarea stocată e JSON stricat", () => {
    window.sessionStorage.setItem("proba", "{ nu e json");
    expect(citesteDepozit("proba", { n: 7 })).toEqual({ n: 7 });
  });

  it("nu aruncă atunci când sessionStorage însuși aruncă", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("blocat");
      },
      setItem: () => {
        throw new Error("blocat");
      },
    });
    expect(() => scrieDepozit("proba", { n: 1 })).not.toThrow();
    expect(citesteDepozit("proba", { n: 9 })).toEqual({ n: 9 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project ui src/demo/depozit.test.ts`
Expected: FAIL — `Cannot find module './depozit'`.

> Proiectul `ui` din `vitest.config.mts` e cel cu mediu de browser. Fișierul are extensia
> `.ts`, iar `include` a proiectului `ui` e `src/**/*.test.tsx` — dacă testul nu e cules,
> redenumește-l `depozit.test.tsx` **sau** rulează-l cu `--project unit` și adaugă
> `// @vitest-environment jsdom` pe prima linie. Alege varianta care se potrivește cu ce e deja
> în `vitest.config.mts`; nu modifica configul pentru un singur fișier.

- [ ] **Step 3: Write the implementation**

Create `src/demo/depozit.ts`:

```ts
/**
 * Starea demonstrațiilor, ținută EXCLUSIV în browserul vizitatorului.
 *
 * `sessionStorage`, nu `localStorage`: închiderea filei uită tot, ceea ce e
 * exact promisiunea făcută pe pagina publică. Nimic nu pleacă spre server —
 * nu e o măsură de disciplină, e o proprietate a construcției: modulul ăsta
 * n-are niciun `fetch` și nicio Server Action.
 *
 * Fiecare acces e înfășurat, fiindcă simplul CITIT al lui `sessionStorage`
 * aruncă în ferestrele private și acolo unde utilizatorul a blocat datele de
 * sit. Un demo care rupe pagina de prezentare e mai rău decât unul care uită.
 */

/** Cheia sub care trăiește starea vitrinei de concedii. */
export const CHEIE_CONCEDII = "vitrina.concedii";

export function citesteDepozit<T>(cheie: string, implicit: T): T {
  try {
    const brut = sessionStorage.getItem(cheie);
    if (brut === null) return implicit;
    return JSON.parse(brut) as T;
  } catch {
    return implicit;
  }
}

export function scrieDepozit<T>(cheie: string, valoare: T): void {
  try {
    sessionStorage.setItem(cheie, JSON.stringify(valoare));
  } catch {
    // Fereastră privată, cotă depășită, date de sit blocate. Demo-ul merge mai
    // departe din memorie; pierde doar supraviețuirea peste o reîncărcare.
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --project ui src/demo/depozit.test.ts` (sau `--project unit`, după alegerea
din Step 2)
Expected: PASS — 4 teste.

- [ ] **Step 5: Commit**

```bash
git add src/demo/depozit.ts src/demo/depozit.test.*
git status --short -- src/demo/
cat > /tmp/msg.txt <<'MSG'
feat(demo): depozitul de sesiune, tolerant la sessionStorage care aruncă

sessionStorage, nu localStorage: închiderea filei uită tot, exact ce
promite pagina publică. Citirea aruncă în fereastră privată și acolo unde
datele de sit sunt blocate, deci fiecare acces e înfășurat — un demo care
rupe pagina de prezentare e mai rău decât unul care uită.
MSG
git commit --only -F /tmp/msg.txt -- src/demo/depozit.ts src/demo/depozit.test.*
```

---

### Task 4: Fabrica de acțiuni false

`Formular` cere `actiune: (date: FormData) => Promise<ActionResult<TData>>`
(`src/components/ui/formular.tsx:61`). Fabrica produce exact forma aia, dar mută o stare locală
în loc să scrie în bază.

**Files:**

- Create: `src/demo/actiune.ts`
- Test: `src/demo/actiune.test.ts`

**Interfaces:**

- Consumes: `ActionResult` din `src/lib/actions/types.ts:81`
- Produces:
  - `actiuneDemo<TData>(scrie: (date: FormData) => TData | MesajDeRefuz): (date: FormData) => Promise<ActionResult<TData>>`
  - `type MesajDeRefuz = { refuz: string; campuri?: Readonly<Record<string, readonly string[]>> }`
  - `esteRefuz(x: unknown): x is MesajDeRefuz`

- [ ] **Step 1: Write the failing test**

Create `src/demo/actiune.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { actiuneDemo } from "./actiune";

describe("acțiunea de demonstrație", () => {
  it("întoarce ok cu datele produse de scriitor", async () => {
    const actiune = actiuneDemo((date) => ({ nume: String(date.get("nume") ?? "") }));
    const date = new FormData();
    date.set("nume", "Popescu");

    const rezultat = await actiune(date);

    expect(rezultat.ok).toBe(true);
    if (rezultat.ok) expect(rezultat.data).toEqual({ nume: "Popescu" });
  });

  it("întoarce un refuz cu forma ActionError, inclusiv requestId", async () => {
    const actiune = actiuneDemo(() => ({
      refuz: "Datele nu sunt complete.",
      campuri: { nume: ["Completați numele."] },
    }));

    const rezultat = await actiune(new FormData());

    expect(rezultat.ok).toBe(false);
    if (!rezultat.ok) {
      expect(rezultat.error.message).toBe("Datele nu sunt complete.");
      expect(rezultat.error.fieldErrors).toEqual({ nume: ["Completați numele."] });
      expect(typeof rezultat.error.requestId).toBe("string");
      expect(rezultat.error.requestId.length).toBeGreaterThan(0);
    }
  });

  it("prinde o excepție din scriitor și o traduce în refuz, nu o lasă să spargă pagina", async () => {
    const actiune = actiuneDemo(() => {
      throw new Error("ceva");
    });

    const rezultat = await actiune(new FormData());

    expect(rezultat.ok).toBe(false);
    if (!rezultat.ok) expect(rezultat.error.message).toMatch(/\.$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project unit src/demo/actiune.test.ts`
Expected: FAIL — `Cannot find module './actiune'`.

- [ ] **Step 3: Write the implementation**

Create `src/demo/actiune.ts`:

```ts
/**
 * Acțiunile demonstrației.
 *
 * `Formular` primește acțiunea ca PROP — `actiune: (date: FormData) =>
 * Promise<ActionResult<TData>>` (`src/components/ui/formular.tsx:61`). E
 * singurul punct din tot proiectul prin care scrierea se poate devia spre
 * memorie fără să atingi componentele-frunză, iar fabrica de aici produce exact
 * forma aia.
 *
 * Nu există `"use server"` aici și nu există niciun apel de rețea: forma e
 * aceeași, drumul e altul. Un vizitator anonim nu poate declanșa nimic pe
 * server din vitrină, nici din greșeală.
 */
import type { ActionResult } from "@/lib/actions/types";

export type MesajDeRefuz = Readonly<{
  refuz: string;
  campuri?: Readonly<Record<string, readonly string[]>>;
}>;

export function esteRefuz(x: unknown): x is MesajDeRefuz {
  return typeof x === "object" && x !== null && "refuz" in x;
}

/**
 * `requestId` există fiindcă `ActionError` îl cere, și fiindcă ecranele îl
 * afișează. În vitrină nu leagă nimic de niciun log — de aceea poartă prefixul
 * `demo-`, ca să nu fie căutat degeaba într-o stivă care nu există.
 */
let contor = 0;
function idCerere(): string {
  contor += 1;
  return `demo-${String(contor).padStart(4, "0")}`;
}

export function actiuneDemo<TData>(
  scrie: (date: FormData) => TData | MesajDeRefuz,
): (date: FormData) => Promise<ActionResult<TData>> {
  return (date: FormData) => {
    try {
      const rezultat = scrie(date);
      if (esteRefuz(rezultat)) {
        return Promise.resolve({
          ok: false,
          error: {
            code: "VALIDARE",
            message: rezultat.refuz,
            fieldErrors: rezultat.campuri ?? null,
            requestId: idCerere(),
          },
        } as ActionResult<TData>);
      }
      return Promise.resolve({ ok: true, data: rezultat });
    } catch {
      return Promise.resolve({
        ok: false,
        error: {
          code: "DEMO",
          message: "Demonstrația nu a putut înregistra cererea.",
          fieldErrors: null,
          requestId: idCerere(),
        },
      } as ActionResult<TData>);
    }
  };
}
```

> Dacă `ActionError` cere alte câmpuri decât `code`/`message`/`fieldErrors`/`requestId`, citește
> `src/lib/actions/types.ts` în jurul liniei 70 și completează-le. Nu adăuga `as unknown as` —
> dacă tipul nu se potrivește, potrivește-l.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --project unit src/demo/actiune.test.ts`
Expected: PASS — 3 teste.

- [ ] **Step 5: Commit**

```bash
git add src/demo/actiune.ts src/demo/actiune.test.ts
git status --short -- src/demo/
cat > /tmp/msg.txt <<'MSG'
feat(demo): fabrica de acțiuni false, cu forma ActionResult

Formular primește acțiunea ca prop — singurul punct din proiect prin care
scrierea se poate devia spre memorie fără să atingi frunzele. Fabrica
produce exact forma așteptată, fără „use server" și fără niciun apel de
rețea: un vizitator anonim nu poate declanșa nimic pe server din vitrină.
MSG
git commit --only -F /tmp/msg.txt -- src/demo/actiune.ts src/demo/actiune.test.ts
```

---

### Task 5: Ruta `/vitrina` — document propriu și poartă publică

Grupul de rute e piesa care rezolvă cele cinci coliziuni de mediu din spec §2.5 dintr-o
singură mișcare, fiindcă demo-ul primește un DOCUMENT al lui.

**Files:**

- Create: `src/app/(vitrina)/layout.tsx`
- Create: `src/app/(vitrina)/vitrina/leave/page.tsx` (schelet, umplut în Task 6)
- Modify: `src/proxy.ts:41-68` (lista `RUTE_PUBLICE`)
- Test: `src/proxy.test.ts` (creează-l dacă nu există) sau extinde
  `src/content/landing/continut.test.ts`

**Interfaces:**

- Consumes: `monoCifre` din `src/lib/ui/fonturi.ts`
- Produces: rutele `/vitrina/*`, publice și `noindex`

- [ ] **Step 1: Write the failing test**

Adaugă în `src/content/landing/continut.test.ts`:

```ts
describe("vitrina", () => {
  /**
   * O rută publică ABSENTĂ din `RUTE_PUBLICE` nu dă 404 și nu dă eroare: dă un
   * 307 către autentificare, pentru vizitator ȘI pentru robotul de indexare.
   * Poarta se citește din sursa proxy-ului, ca tot restul fișierului.
   */
  it("este înregistrată ca rută publică în proxy", () => {
    const sursa = readFileSync(new URL("../../proxy.ts", import.meta.url), "utf8");
    expect(sursa).toMatch(/"\/vitrina"/);
  });
});
```

Folosește exact mecanismul de citire a sursei deja prezent în fișier (`readFileSync` +
`new URL`); dacă acolo e altă cale relativă, copiaz-o pe aceea.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project unit src/content/landing/continut.test.ts -t "vitrina"`
Expected: FAIL — `/vitrina` nu apare în `proxy.ts`.

- [ ] **Step 3: Adaugă ruta publică și layout-ul**

În `src/proxy.ts`, în `RUTE_PUBLICE`, după `"/unelte",` adaugă:

```ts
  // Demonstrațiile interactive, încadrate în paginile de modul. Sunt publice
  // prin construcție și `noindex` prin metadata: n-au ce indexa (conținutul e
  // fictiv) și ar concura cu pagina de modul pe aceleași cuvinte.
  "/vitrina",
```

Create `src/app/(vitrina)/layout.tsx`:

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { monoCifre } from "@/lib/ui/fonturi";

/**
 * Documentul demonstrațiilor.
 *
 * ── DE CE UN DOCUMENT PROPRIU, NU O BUCATĂ DIN PAGINA DE MARKETING ────────
 * Randat direct în `/module/<cheie>`, demo-ul ar fi moștenit cinci lucruri
 * greșite deodată, toate tăcute:
 *
 *   1. `monoCifre` NU e montat în `(marketing)` — cifrele ar fi căzut pe stiva
 *      de sistem, adică alt desen al lui 1 și 7 exact acolo unde promitem
 *      fidelitate;
 *   2. `.mk :focus-visible` ar fi repictat inelul de focus în cerneala sitului;
 *   3. `.mk input:-webkit-autofill` ar fi pictat câmpurile cu hârtia rece;
 *   4. regula de 16px pe atingere e legată de `[data-zona]`, absent acolo, deci
 *      iOS Safari ar fi mărit pagina la fiecare atingere;
 *   5. bundle-ul ar fi intrat în cele nouăsprezece pagini prerandate static,
 *      care azi n-au nicio linie de JavaScript propriu.
 *
 * Un `<iframe>` același origin le rezolvă pe toate cinci, și în plus păstrează
 * starea-din-URL funcțională ÎNĂUNTRU: filele, luna și sortarea sunt `<Link>`
 * și `<form method="get">`, iar montate în pagina de marketing ar fi navigat în
 * AFARA demonstrației, spre o rută protejată.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function LayoutVitrina({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${monoCifre.variable} bg-background text-foreground min-h-dvh`}
      data-zona="vitrina"
    >
      {children}
    </div>
  );
}
```

Create `src/app/(vitrina)/vitrina/leave/page.tsx` (schelet):

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Concedii — demonstrație" };

export default function PaginaVitrinaConcedii() {
  return <main className="p-4">Demonstrația de concedii.</main>;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run --project unit src/content/landing/continut.test.ts`
Expected: PASS.

Run: `pnpm typecheck && pnpm lint`
Expected: fără erori noi.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(vitrina)"
git status --short -- "src/app/(vitrina)" src/proxy.ts src/content/landing/continut.test.ts
cat > /tmp/msg.txt <<'MSG'
feat(vitrina): grupul de rute al demonstrațiilor, cu document propriu

Un document separat rezolvă dintr-o mișcare fontul de cifre lipsă din
marketing, scurgerea regulilor `.mk`, zoom-ul iOS legat de `data-zona` și
bundle-ul care ar fi intrat în cele nouăsprezece pagini prerandate. `/vitrina`
intră în RUTE_PUBLICE — fără linia aia, ruta ar da 307 spre autentificare
pentru vizitator ȘI pentru robot. Testul citește lista din sursa proxy-ului.
MSG
git commit --only -F /tmp/msg.txt -- "src/app/(vitrina)/layout.tsx" "src/app/(vitrina)/vitrina/leave/page.tsx" src/proxy.ts src/content/landing/continut.test.ts
```

---

### Task 6: Calendarul real în vitrină

Aici se ține promisiunea meta: componenta randată e **exact** cea din aplicație.

**Files:**

- Create: `src/app/(vitrina)/vitrina/leave/vitrina-leave.tsx`
- Modify: `src/app/(vitrina)/vitrina/leave/page.tsx`
- Test: `src/app/(vitrina)/vitrina/leave/vitrina-leave.test.tsx`

**Interfaces:**

- Consumes: `ANGAJATI`, `absenteLunii` din `@/demo/lume`; `PlanificatorConcedii` din
  `@/app/(app)/concedii/calendar/planificator-concedii`; `zilelePlanificatorului` din
  `@/domain/leave/planificator`
- Produces: `VitrinaConcedii({ azi }: { readonly azi: string })`

- [ ] **Step 1: Write the failing test**

Create `src/app/(vitrina)/vitrina/leave/vitrina-leave.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ANGAJATI } from "@/demo/lume";

import { VitrinaConcedii } from "./vitrina-leave";

/**
 * Poarta anti-minciună. Precedentul din casă: vinieta-fluturaș a desenat un
 * inel INVIZIBIL în producție, fără nicio eroare, fiindcă nimic nu verifica
 * randarea. Un demo cu date fabricate n-are, din oficiu, o astfel de poartă.
 */
describe("vitrina de concedii", () => {
  it("randează toți angajații lumii fictive", () => {
    render(<VitrinaConcedii azi="2026-03-10" />);
    for (const angajat of ANGAJATI) {
      expect(screen.getByText(new RegExp(angajat.nume))).toBeInTheDocument();
    }
  });

  it("randează absențe, nu starea goală", () => {
    render(<VitrinaConcedii azi="2026-03-10" />);
    expect(screen.queryByText(/Nicio absență de echipă/)).not.toBeInTheDocument();
  });

  it("se mută odată cu luna primită", () => {
    const { unmount } = render(<VitrinaConcedii azi="2027-11-15" />);
    expect(screen.getByText(/Noiembrie 2027|noiembrie 2027|2027/)).toBeInTheDocument();
    unmount();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project ui "src/app/(vitrina)/vitrina/leave/vitrina-leave.test.tsx"`
Expected: FAIL — `Cannot find module './vitrina-leave'`.

- [ ] **Step 3: Write the implementation**

Create `src/app/(vitrina)/vitrina/leave/vitrina-leave.tsx`:

```tsx
import { PlanificatorConcedii } from "@/app/(app)/concedii/calendar/planificator-concedii";
import { zilelePlanificatorului } from "@/domain/leave/planificator";
import { absenteLunii, ANGAJATI } from "@/demo/lume";

/**
 * Ecranul demonstrat.
 *
 * `PlanificatorConcedii` e importat din `(app)`, NU copiat: e chiar componenta
 * pe care o vede un client plătitor. Aici se ține promisiunea „când modific
 * aplicația, se modifică și chenarul" — o coloană nouă, o legendă schimbată sau
 * un token de culoare mutat apar aici fără ca cineva să atingă vitrina, iar un
 * prop nou obligatoriu cade la `tsc` în loc să mintă tăcut.
 *
 * Ce NU e componenta reală: COMPOZIȚIA din jur (antetul, filele). Aceea
 * trăiește în `page.tsx`-ul aplicației, care începe cu `requireTenant()` și
 * n-are niciun parametru de date. Se rescrie aici, deci se poate desincroniza —
 * limita e cunoscută și scrisă în spec §4.
 */
export function VitrinaConcedii({ azi }: { readonly azi: string }) {
  const an = Number(azi.slice(0, 4));
  const luna = Number(azi.slice(5, 7));
  // Fără sărbători și fără zile nelucrătoare speciale: demonstrația nu pretinde
  // un calendar legal complet, iar `zilelePlanificatorului` le acceptă goale.
  const zile = zilelePlanificatorului(an, luna, [], [], []);
  const celule = absenteLunii(azi);

  return (
    <div className="space-y-4 p-4">
      <PlanificatorConcedii zile={zile} angajati={ANGAJATI} celule={celule} azi={azi} />
    </div>
  );
}
```

Modify `src/app/(vitrina)/vitrina/leave/page.tsx`:

```tsx
import type { Metadata } from "next";

import { todayInBucharest } from "@/lib/format/date";

import { VitrinaConcedii } from "./vitrina-leave";

export const metadata: Metadata = { title: "Concedii — demonstrație" };

/**
 * Ancorat la ZIUA CURENTĂ, nu la o lună scrisă în cod. Un demo cu „martie 2026"
 * arată o lună moartă peste trei luni, fără nicio eroare — îmbătrânește tăcut
 * pe pagina publică.
 */
export default function PaginaVitrinaConcedii() {
  return (
    <main>
      <VitrinaConcedii azi={todayInBucharest()} />
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --project ui "src/app/(vitrina)/vitrina/leave/vitrina-leave.test.tsx"`
Expected: PASS — 3 teste.

Dacă al treilea test pică fiindcă `PlanificatorConcedii` nu scrie luna pe ecran, înlocuiește
așteptarea cu una care verifică o zi din luna cerută (ex. `2027-11-04` într-un `title` sau
`aria-label`) — **citește ce randează efectiv componenta** înainte să schimbi testul, și nu
slăbi asertarea până nu mai verifică nimic.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(vitrina)/vitrina/leave/"
git status --short -- "src/app/(vitrina)"
cat > /tmp/msg.txt <<'MSG'
feat(vitrina): calendarul REAL de concedii, alimentat cu lumea fictivă

PlanificatorConcedii e importat din (app), nu copiat — e chiar componenta
pe care o vede un client plătitor, deci un prop nou obligatoriu cade la
typecheck în loc să mintă tăcut. Testul de randare e poarta anti-minciună:
precedentul e vinieta care a desenat un inel invizibil în producție, fără
nicio eroare, fiindcă nimic nu verifica randarea.
MSG
git commit --only -F /tmp/msg.txt -- "src/app/(vitrina)/vitrina/leave/vitrina-leave.tsx" "src/app/(vitrina)/vitrina/leave/vitrina-leave.test.tsx" "src/app/(vitrina)/vitrina/leave/page.tsx"
```

---

### Task 7: Comutatorul de rol

Argumentul comercial al produsului: izolarea se **vede**, nu se citește. Comutatorul nu-și
inventează matricea — trece prin vocabularul real de permisiuni.

**Files:**

- Create: `src/demo/roluri.ts`
- Test: `src/demo/roluri.test.ts`
- Modify: `src/app/(vitrina)/vitrina/leave/vitrina-leave.tsx`
- Modify: `src/app/(vitrina)/vitrina/leave/vitrina-leave.test.tsx`

**Interfaces:**

- Consumes: `PermissionKey` / vocabularul din `src/config/permissions.ts`
- Produces:
  - `type RolDemo = "org_admin" | "manager" | "employee"`
  - `ROLURI_DEMO: readonly { cheie: RolDemo; eticheta: string }[]`
  - `angajatiVizibili(rol: RolDemo): readonly RandAngajatPlanificator[]`
  - `poateAproba(rol: RolDemo): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/demo/roluri.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { ANGAJATI } from "./lume";
import { angajatiVizibili, poateAproba, ROLURI_DEMO } from "./roluri";

describe("rolurile demonstrației", () => {
  it("are exact trei roluri, fără super_admin", () => {
    expect(ROLURI_DEMO.map((r) => r.cheie)).toEqual(["org_admin", "manager", "employee"]);
  });

  it("administratorul vede toți angajații", () => {
    expect(angajatiVizibili("org_admin")).toHaveLength(ANGAJATI.length);
  });

  it("managerul vede strict mai puțin decât administratorul", () => {
    expect(angajatiVizibili("manager").length).toBeLessThan(ANGAJATI.length);
    expect(angajatiVizibili("manager").length).toBeGreaterThan(0);
  });

  it("angajatul se vede doar pe el", () => {
    expect(angajatiVizibili("employee")).toHaveLength(1);
  });

  it("angajatul NU poate aproba, managerul poate", () => {
    expect(poateAproba("employee")).toBe(false);
    expect(poateAproba("manager")).toBe(true);
    expect(poateAproba("org_admin")).toBe(true);
  });
});

/**
 * POARTA DE ADEVĂR. Mecanismul e copiat din `matrice-roluri.test.ts`, care
 * parsează aceeași migrare: sursa e seed-ul, nu `permissions.ts` (acolo stă doar
 * vocabularul). Fără poarta asta, comutatorul ar putea minți despre permisiuni
 * exact pe pagina unde izolarea e argumentul de vânzare.
 */
describe("comutatorul corespunde seed-ului din 0002_authz.sql", () => {
  const SEED = readFileSync("supabase/migrations/0002_authz.sql", "utf8");

  /** Are rolul `actiune` pe resursa `leave`, după seed? */
  function areInSeed(rol: string, actiune: string): boolean {
    for (const [, r, resursa, , actiuni] of SEED.matchAll(
      /\('(\w+)','([\w.]+)','(\w+)',\s*'\{([^}]*)\}'\)/g,
    )) {
      if (r !== rol || resursa !== "leave") continue;
      if ((actiuni ?? "").split(",").some((a) => a.trim() === actiune)) return true;
    }
    return false;
  }

  it("cheile despre care raționează comutatorul sunt chei reale", () => {
    for (const cheie of ["leave:read", "leave:create", "leave:approve"]) {
      expect(isPermissionKey(cheie)).toBe(true);
    }
  });

  it("`poateAproba` urmează seed-ul, nu o presupunere", () => {
    expect(poateAproba("manager")).toBe(areInSeed("manager", "approve"));
    expect(poateAproba("employee")).toBe(areInSeed("employee", "approve"));
  });

  it("nu demonstrează `super_admin` — nu e rol de organizație", () => {
    expect(ROLURI_DEMO.map((r) => r.cheie)).not.toContain("super_admin");
  });
});
```

Importurile fișierului devin:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { isPermissionKey } from "@/config/permissions";

import { ANGAJATI } from "./lume";
import { angajatiVizibili, poateAproba, ROLURI_DEMO } from "./roluri";
```

> `org_admin` nu se verifică prin `areInSeed`: primește permisiunile printr-un produs cartezian
> separat (`from unnest(array[…]) r`), nu prin lista explicită — vezi `domeniulDinSeed` din
> `matrice-roluri.test.ts`. Pentru el, `poateAproba` e adevărat prin construcție.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project unit src/demo/roluri.test.ts`
Expected: FAIL — `Cannot find module './roluri'`.

- [ ] **Step 3: Write the implementation**

Create `src/demo/roluri.ts`:

```ts
/**
 * Cele trei roluri demonstrate, și ce văd.
 *
 * ── DE CE E PARTEA CARE VINDE ─────────────────────────────────────────────
 * Orice produs din categorie SPUNE „roluri și permisiuni". Aici vizitatorul le
 * VEDE: același calendar, alți oameni pe el, alte butoane. Pentru un produs în
 * care izolarea E produsul, ăsta e argumentul.
 *
 * ── DE CE NU APARE `super_admin` ──────────────────────────────────────────
 * Nu e rol de organizație — sursa lui e `platform_admins`, niciodată
 * `organization_members`. Un comutator care i-ar arăta coloana i-ar spune unui
 * patron „furnizorul are un rol care vede tot". Aceeași decizie e luată deja în
 * `src/content/landing/matrice-roluri.ts`, din același motiv.
 *
 * ── CE E ADEVĂRAT AICI ────────────────────────────────────────────────────
 * `employee` are `leave:read = own`; `manager` are `leave:approve = team`.
 * Sursa de adevăr rămâne seed-ul din `0002_authz.sql`; testul păzește
 * corespondența, pe tiparul lui `matrice-roluri.test.ts`.
 */
import type { RandAngajatPlanificator } from "@/app/(app)/concedii/calendar/planificator-concedii";

import { ANGAJATI } from "./lume";

export type RolDemo = "org_admin" | "manager" | "employee";

export const ROLURI_DEMO: readonly Readonly<{ cheie: RolDemo; eticheta: string }>[] = [
  { cheie: "org_admin", eticheta: "Administrator" },
  { cheie: "manager", eticheta: "Manager" },
  { cheie: "employee", eticheta: "Angajat" },
];

/** Echipa managerului demonstrat: primii patru din lume. */
const ECHIPA_MANAGERULUI = ["d1", "d2", "d3", "d4"];

/** Angajatul care „e" vizitatorul, când comutatorul stă pe `employee`. */
const EU = "d1";

export function angajatiVizibili(rol: RolDemo): readonly RandAngajatPlanificator[] {
  switch (rol) {
    case "org_admin":
      return ANGAJATI;
    case "manager":
      return ANGAJATI.filter((a) => ECHIPA_MANAGERULUI.includes(a.id));
    case "employee":
      return ANGAJATI.filter((a) => a.id === EU);
  }
}

/** `leave:approve` există pentru manager (pe echipă) și administrator, nu pentru angajat. */
export function poateAproba(rol: RolDemo): boolean {
  return rol !== "employee";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --project unit src/demo/roluri.test.ts`
Expected: PASS — 5 teste.

- [ ] **Step 5: Leagă comutatorul de ecran**

Fă `VitrinaConcedii` un component client cu stare de rol. În
`src/app/(vitrina)/vitrina/leave/vitrina-leave.tsx`, pune `"use client"` pe prima linie și
înlocuiește corpul cu:

```tsx
"use client";

import { useId, useState } from "react";

import { PlanificatorConcedii } from "@/app/(app)/concedii/calendar/planificator-concedii";
import { zilelePlanificatorului } from "@/domain/leave/planificator";
import { absenteLunii } from "@/demo/lume";
import { angajatiVizibili, poateAproba, ROLURI_DEMO, type RolDemo } from "@/demo/roluri";

export function VitrinaConcedii({ azi }: { readonly azi: string }) {
  const [rol, setRol] = useState<RolDemo>("org_admin");
  const idGrup = useId();

  const an = Number(azi.slice(0, 4));
  const luna = Number(azi.slice(5, 7));
  const zile = zilelePlanificatorului(an, luna, [], [], []);
  const angajati = angajatiVizibili(rol);
  const vizibili = new Set(angajati.map((a) => a.id));

  // Celulele se filtrează după cine e vizibil: altfel calendarul ar arăta
  // absențe ale unor oameni care nu apar pe niciun rând.
  const toate = absenteLunii(azi);
  const celule = Object.fromEntries(
    Object.entries(toate).filter(([cheie]) => vizibili.has(cheie.split("|")[0] ?? "")),
  );

  return (
    <div className="space-y-4 p-4">
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend id={idGrup} className="text-corp text-muted-foreground mb-2">
          Vezi ecranul ca:
        </legend>
        {ROLURI_DEMO.map((r) => (
          <button
            key={r.cheie}
            type="button"
            aria-pressed={rol === r.cheie}
            onClick={() => {
              setRol(r.cheie);
            }}
            className={`rounded-panou text-corp border px-3 py-1.5 ${
              rol === r.cheie ? "bg-foreground text-background" : "border-border"
            }`}
          >
            {r.eticheta}
          </button>
        ))}
      </fieldset>

      <p className="text-muted-foreground text-corp">
        {poateAproba(rol)
          ? "Rolul acesta poate aproba cererile echipei."
          : "Rolul acesta nu poate aproba cereri — doar să depună propriile lui."}
      </p>

      <PlanificatorConcedii zile={zile} angajati={angajati} celule={celule} azi={azi} />
    </div>
  );
}
```

Adaugă în `vitrina-leave.test.tsx`:

```tsx
it("comutatorul de rol schimbă cine apare pe calendar", async () => {
  const { default: userEvent } = await import("@testing-library/user-event");
  const utilizator = userEvent.setup();
  render(<VitrinaConcedii azi="2026-03-10" />);

  expect(screen.getByText(/Toma Gabriela/)).toBeInTheDocument();

  await utilizator.click(screen.getByRole("button", { name: "Angajat" }));

  expect(screen.queryByText(/Toma Gabriela/)).not.toBeInTheDocument();
  expect(screen.getByText(/Popescu Ion/)).toBeInTheDocument();
});
```

Actualizează primul test din fișier ca să folosească `angajatiVizibili("org_admin")` în loc de
`ANGAJATI` — sunt aceiași, dar testul spune atunci ce verifică.

- [ ] **Step 6: Run tests**

Run: `pnpm vitest run --project unit src/demo/roluri.test.ts && pnpm vitest run --project ui "src/app/(vitrina)"`
Expected: PASS.

Dacă `@testing-library/user-event` nu e în proiect, verifică întâi
(`grep user-event package.json`) și, dacă lipsește, înlocuiește clicul cu
`fireEvent.click(...)` din `@testing-library/react`. **Nu instala o dependință nouă** pentru un
test.

- [ ] **Step 7: Commit**

```bash
git add src/demo/roluri.ts src/demo/roluri.test.ts
git status --short -- src/demo/ "src/app/(vitrina)"
cat > /tmp/msg.txt <<'MSG'
feat(vitrina): comutator de rol — izolarea se vede, nu se citește

Același calendar, alți oameni pe el, alte butoane. `super_admin` lipsește
deliberat: nu e rol de organizație, iar o coloană a lui i-ar spune unui
patron „furnizorul are un rol care vede tot" — aceeași decizie e luată deja
în matrice-roluri.ts, din același motiv.
MSG
git commit --only -F /tmp/msg.txt -- src/demo/roluri.ts src/demo/roluri.test.ts "src/app/(vitrina)/vitrina/leave/vitrina-leave.tsx" "src/app/(vitrina)/vitrina/leave/vitrina-leave.test.tsx"
```

---

### Task 8: Scrierea în memorie — o cerere care apare pe calendar

Aici se ține cerința (c). Vizitatorul depune o cerere, o vede apărând, și nimic nu pleacă spre
server.

**Files:**

- Create: `src/app/(vitrina)/vitrina/leave/formular-cerere-demo.tsx`
- Modify: `src/app/(vitrina)/vitrina/leave/vitrina-leave.tsx`
- Test: `src/app/(vitrina)/vitrina/leave/vitrina-leave.test.tsx`

**Interfaces:**

- Consumes: `actiuneDemo` din `@/demo/actiune`; `citesteDepozit`/`scrieDepozit`/`CHEIE_CONCEDII`
  din `@/demo/depozit`; `TIPURI` din `@/demo/lume`; `Formular` din `@/components/ui/formular`
- Produces:
  - `FormularCerereDemo({ angajatId, laAdaugare }: { readonly angajatId: string; readonly laAdaugare: (cerere: CerereDemo) => void })`
  - `type CerereDemo = Readonly<{ employeeId: string; deLa: string; panaLa: string; tipId: string }>`

- [ ] **Step 1: Write the failing test**

Adaugă în `vitrina-leave.test.tsx`:

```tsx
it("o cerere depusă apare pe calendar și NU pleacă spre server", async () => {
  const apeluri: string[] = [];
  vi.stubGlobal("fetch", (...a: unknown[]) => {
    apeluri.push(String(a[0]));
    return Promise.reject(new Error("vitrina nu are voie să cheme rețeaua"));
  });

  const { default: userEvent } = await import("@testing-library/user-event");
  const utilizator = userEvent.setup();
  render(<VitrinaConcedii azi="2026-03-10" />);

  await utilizator.click(screen.getByRole("button", { name: /Cerere nouă/ }));
  await utilizator.type(screen.getByLabelText(/De la/), "2026-03-02");
  await utilizator.type(screen.getByLabelText(/Până la/), "2026-03-03");
  await utilizator.click(screen.getByRole("button", { name: /Trimite/ }));

  expect(await screen.findByText(/cerere înregistrată în demonstrație/i)).toBeInTheDocument();
  expect(apeluri).toEqual([]);
});
```

Adaugă `vi` la importul din `vitest` și `afterEach(() => { vi.unstubAllGlobals(); })`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project ui "src/app/(vitrina)/vitrina/leave/vitrina-leave.test.tsx" -t "cerere depusă"`
Expected: FAIL — nu există butonul „Cerere nouă".

- [ ] **Step 3: Write the implementation**

Create `src/app/(vitrina)/vitrina/leave/formular-cerere-demo.tsx`:

```tsx
"use client";

import { useId } from "react";

import { Formular } from "@/components/ui/formular";
import { actiuneDemo } from "@/demo/actiune";
import { TIPURI } from "@/demo/lume";

export type CerereDemo = Readonly<{
  employeeId: string;
  deLa: string;
  panaLa: string;
  tipId: string;
}>;

/**
 * Formularul demonstrației.
 *
 * `Formular` e componenta REALĂ, iar `actiune` e propul prin care scrierea se
 * abate spre memorie. Nu există `"use server"` pe drumul ăsta și niciun apel de
 * rețea: cerința „datele trăiesc doar în sesiunea de browser" e o proprietate a
 * construcției, nu o promisiune.
 */
export function FormularCerereDemo({
  angajatId,
  laAdaugare,
}: {
  readonly angajatId: string;
  readonly laAdaugare: (cerere: CerereDemo) => void;
}) {
  const idDeLa = useId();
  const idPanaLa = useId();

  const trimite = actiuneDemo<CerereDemo>((date) => {
    const deLa = String(date.get("data_inceput") ?? "");
    const panaLa = String(date.get("data_sfarsit") ?? "");
    const lipsa: Record<string, readonly string[]> = {};
    if (deLa === "") lipsa["data_inceput"] = ["Alegeți ziua de început."];
    if (panaLa === "") lipsa["data_sfarsit"] = ["Alegeți ziua de sfârșit."];
    if (panaLa !== "" && deLa !== "" && panaLa < deLa) {
      lipsa["data_sfarsit"] = ["Ziua de sfârșit e înaintea celei de început."];
    }
    if (Object.keys(lipsa).length > 0) {
      return { refuz: "Cererea nu e completă.", campuri: lipsa };
    }

    const cerere: CerereDemo = {
      employeeId: angajatId,
      deLa,
      panaLa,
      tipId: String(date.get("leave_type_id") ?? TIPURI[0]?.id ?? ""),
    };
    laAdaugare(cerere);
    return cerere;
  });

  // ATENȚIE la contractul lui `Formular` (`src/components/ui/formular.tsx:44-76`):
  // `children` e RENDER PROP — primește `StareFormular<TData>` și întoarce
  // marcaj. Nu e `ReactNode`. Iar propul de confirmare se numește
  // `mesajReusita`, nu `mesajSucces`.
  return (
    <Formular actiune={trimite} mesajReusita="Cerere înregistrată în demonstrație.">
      {({ inCurs, erori, eroareGenerala, valoriTrimise }) => (
        <div className="space-y-3">
          {eroareGenerala !== null ? (
            <p role="alert" className="text-corp text-destructive">
              {eroareGenerala}
            </p>
          ) : null}

          <div>
            <label htmlFor={idDeLa}>De la</label>
            <input
              id={idDeLa}
              name="data_inceput"
              type="date"
              required
              defaultValue={valoriTrimise["data_inceput"] ?? ""}
              aria-invalid={erori["data_inceput"] !== undefined}
            />
            {erori["data_inceput"]?.map((e) => (
              <p key={e} className="text-corp text-destructive">
                {e}
              </p>
            ))}
          </div>

          <div>
            <label htmlFor={idPanaLa}>Până la</label>
            <input
              id={idPanaLa}
              name="data_sfarsit"
              type="date"
              required
              defaultValue={valoriTrimise["data_sfarsit"] ?? ""}
              aria-invalid={erori["data_sfarsit"] !== undefined}
            />
            {erori["data_sfarsit"]?.map((e) => (
              <p key={e} className="text-corp text-destructive">
                {e}
              </p>
            ))}
          </div>

          <div>
            <label htmlFor={idTip}>Tip</label>
            <select id={idTip} name="leave_type_id" defaultValue={TIPURI[0]?.id}>
              {TIPURI.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.denumire}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" disabled={inCurs}>
            {inCurs ? "Se trimite…" : "Trimite cererea"}
          </button>
        </div>
      )}
    </Formular>
  );
}
```

Adaugă `const idTip = useId();` lângă celelalte două id-uri.

Apoi, în `src/app/(vitrina)/vitrina/leave/vitrina-leave.tsx`, ține cererile depuse și îmbină-le
peste absențele lumii:

```tsx
const [cereri, setCereri] = useState<readonly CerereDemo[]>(() =>
  citesteDepozit<readonly CerereDemo[]>(CHEIE_CONCEDII, []),
);
const [casetaDeschisa, setCasetaDeschisa] = useState(false);

function adauga(cerere: CerereDemo): void {
  setCereri((precedente) => {
    const urmatoare = [...precedente, cerere];
    scrieDepozit(CHEIE_CONCEDII, urmatoare);
    return urmatoare;
  });
  setCasetaDeschisa(false);
}

/**
 * Celulele lumii, plus cele depuse în sesiunea asta.
 *
 * Cheile se construiesc cu `cheieCelula`, la fel ca în `lume.ts` — nu de mână.
 * Un format schimbat acolo se propagă singur și aici.
 */
const celuleCuCereri = { ...celule };
for (const cerere of cereri) {
  const tip = TIPURI.find((t) => t.id === cerere.tipId) ?? TIPURI[0];
  if (tip === undefined) continue;
  for (
    let zi = new Date(cerere.deLa);
    zi <= new Date(cerere.panaLa);
    zi.setDate(zi.getDate() + 1)
  ) {
    const data = zi.toISOString().slice(0, 10);
    const cheie = cheieCelula(cerere.employeeId, data);
    celuleCuCereri[cheie] = [
      ...(celuleCuCereri[cheie] ?? []),
      { tipId: tip.id, tipDenumire: tip.denumire, tipCuloare: tip.culoare, stare: "in_aprobare" },
    ];
  }
}
```

Dă `celuleCuCereri` lui `PlanificatorConcedii` în locul lui `celule`, și randează butonul plus
caseta:

```tsx
<button
  type="button"
  onClick={() => {
    setCasetaDeschisa(true);
  }}
>
  Cerere nouă
</button>;
{
  casetaDeschisa ? (
    <FormularCerereDemo angajatId={angajati[0]?.id ?? "d1"} laAdaugare={adauga} />
  ) : null;
}
```

Butonul apare pentru **toate** cele trei roluri: fiecare are `leave:create = own`.

Importurile noi în `vitrina-leave.tsx`:

```ts
import { cheieCelula } from "@/domain/leave/planificator";
import { CHEIE_CONCEDII, citesteDepozit, scrieDepozit } from "@/demo/depozit";
import { absenteLunii, TIPURI } from "@/demo/lume";

import { FormularCerereDemo, type CerereDemo } from "./formular-cerere-demo";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --project ui "src/app/(vitrina)"`
Expected: PASS — inclusiv asertarea că `fetch` n-a fost chemat.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(vitrina)/vitrina/leave/formular-cerere-demo.tsx"
git status --short -- "src/app/(vitrina)"
cat > /tmp/msg.txt <<'MSG'
feat(vitrina): cerere depusă în memorie, care apare pe calendar

Formular e componenta reală; `actiune` e propul prin care scrierea se abate
spre memorie. Testul asertează că `fetch` NU e chemat: „datele trăiesc doar
în sesiunea de browser" devine o proprietate verificată, nu o promisiune.
MSG
git commit --only -F /tmp/msg.txt -- "src/app/(vitrina)/vitrina/leave/formular-cerere-demo.tsx" "src/app/(vitrina)/vitrina/leave/vitrina-leave.tsx" "src/app/(vitrina)/vitrina/leave/vitrina-leave.test.tsx"
```

---

### Task 9: Banda `PrinGeam` și montarea ei pe `/module/leave`

Ultima piesă: chenarul din pagina de prezentare și popup-ul.

**Files:**

- Create: `src/app/(marketing)/_componente/prin-geam.tsx`
- Test: `src/app/(marketing)/_componente/prin-geam.test.tsx`
- Modify: `src/app/(marketing)/module/[modul]/page.tsx`

**Interfaces:**

- Consumes: `Banda` din `./banda`
- Produces: `PrinGeam({ cheie, titlu })` — randează banda doar dacă modulul are vitrină

- [ ] **Step 1: Write the failing test**

Create `src/app/(marketing)/_componente/prin-geam.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { arePrinGeam, PrinGeam } from "./prin-geam";

describe("banda prin geam", () => {
  it("știe pentru care module există vitrină", () => {
    expect(arePrinGeam("leave")).toBe(true);
    expect(arePrinGeam("courses")).toBe(false);
  });

  it("încadrează vitrina leneș, cu titlu și raport de aspect fix", () => {
    const { container } = render(<PrinGeam cheie="leave" titlu="Concedii" />);
    const cadru = container.querySelector("iframe");

    expect(cadru).not.toBeNull();
    expect(cadru?.getAttribute("src")).toBe("/vitrina/leave");
    expect(cadru?.getAttribute("loading")).toBe("lazy");
    expect(cadru?.getAttribute("title")).toMatch(/Concedii/);
    // Fără raport fix, iframe-ul sosește târziu și împinge pagina: CLS garantat.
    expect(container.querySelector("figure")?.getAttribute("style") ?? "").toMatch(/aspect-ratio/);
  });

  it("oferă o cale de deschidere accesibilă cu tastatura", () => {
    render(<PrinGeam cheie="leave" titlu="Concedii" />);
    expect(screen.getByRole("button", { name: /Deschide/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project ui "src/app/(marketing)/_componente/prin-geam.test.tsx"`
Expected: FAIL — `Cannot find module './prin-geam'`.

- [ ] **Step 3: Write the implementation**

Create `src/app/(marketing)/_componente/prin-geam.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";

/**
 * Ecranul real, văzut PRIN GEAM.
 *
 * ── DE CE UN IFRAME, ȘI NU COMPONENTELE MONTATE AICI ──────────────────────
 * Un document separat aduce fontul de cifre al aplicației (absent din
 * `(marketing)`), ține regulile `.mk` afară (`:focus-visible` și
 * `input:-webkit-autofill` ar repicta interiorul), activează regula de 16px pe
 * atingere prin `data-zona`, și lasă cele nouăsprezece pagini prerandate fără
 * nicio linie de JavaScript propriu. În plus, starea-din-URL a modulului
 * (file, lună, sortare) rămâne funcțională ÎNĂUNTRU; montată aici, fiecare
 * `<Link>` ar fi navigat în AFARA demonstrației, spre o rută protejată.
 *
 * ── DE CE PASSE-PARTOUT, ȘI NU UN CARD ────────────────────────────────────
 * Vocabularul sitului interzice explicit cardurile, umbrele și chenarul
 * complet (`registru.tsx:5-14`): structura o poartă riglele. Un chenar cu
 * umbră ar fi fost vizibil străin pe pagină. Așa, aplicația e clar un CITAT —
 * două limbi vizuale pe pagină, dar una dintre ele între ghilimele.
 */

/** Modulele care au vitrină. Restul nu randează banda deloc. */
const CU_VITRINA: readonly string[] = ["leave"];

export function arePrinGeam(cheie: string): boolean {
  return CU_VITRINA.includes(cheie);
}

export function PrinGeam({ cheie, titlu }: { readonly cheie: string; readonly titlu: string }) {
  const [deschis, setDeschis] = useState(false);
  const caseta = useRef<HTMLDialogElement | null>(null);

  function deschide(): void {
    setDeschis(true);
    // `showModal()` dă gratuit capcana de focus, Escape și `::backdrop`.
    caseta.current?.showModal();
  }

  function inchide(): void {
    caseta.current?.close();
    setDeschis(false);
  }

  return (
    <section className="bg-mk-hartie text-mk-text">
      <div className="max-w-mk mx-auto w-full px-[clamp(1rem,4vw,2.5rem)]">
        <div className="border-mk-rigla border-t py-16 sm:py-24">
          <p className="font-mk-date text-mk-text-slab text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
            Ecran real
          </p>

          {/*
            Raportul de aspect e FIX și nu se poate scoate: iframe-ul e leneș,
            deci sosește după layout, iar fără rezervarea locului ar împinge
            pagina în jos — CLS garantat pe o pagină publică.
          */}
          <figure
            className="border-mk-rigla mt-6 overflow-hidden border p-3 sm:p-6"
            style={{ aspectRatio: "16 / 10" }}
          >
            <iframe
              src={`/vitrina/${cheie}`}
              title={`Demonstrație interactivă: ${titlu}`}
              loading="lazy"
              // Chenarul e un CITAT, nu o zonă de lucru: nu primește nici
              // indicatorul de tastatură, nici clicuri. Interacțiunea are
              // butonul ei, de dedesubt.
              tabIndex={-1}
              aria-hidden="true"
              className="h-full w-full border-0"
              style={{ pointerEvents: "none" }}
            />
            <figcaption className="text-mk-text-slab mt-3 text-[0.8125rem]">
              Date fictive. Nimic din ce faci aici nu se salvează.
            </figcaption>
          </figure>

          <button
            type="button"
            onClick={deschide}
            className="border-mk-rigla mt-6 border px-4 py-2 text-[0.9375rem]"
          >
            Deschide demonstrația
          </button>

          {/*
            `margin: auto` e pus EXPLICIT: preflight-ul Tailwind îl șterge de pe
            `<dialog>`, iar caseta ar rămâne lipită de colțul din stânga-sus.
            Capcană verificată empiric în acest proiect.

            Al doilea iframe se creează abia la deschidere — nu la montare.
          */}
          <dialog
            ref={caseta}
            onClose={() => {
              setDeschis(false);
            }}
            className="h-[90dvh] w-[95vw] max-w-none border-0 p-0"
            style={{ margin: "auto" }}
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b p-3">
                <p className="font-mk-date text-[0.6875rem] tracking-[0.14em] uppercase">
                  {titlu} — demonstrație
                </p>
                {/* `Esc` apăsat ÎNĂUNTRUL iframe-ului nu ajunge la părinte,
                    deci butonul ăsta nu e redundant: e singura ieșire pentru
                    cine a intrat cu focusul în demonstrație. */}
                <button type="button" onClick={inchide} className="px-3 py-1">
                  Închide
                </button>
              </div>
              {deschis ? (
                <iframe
                  src={`/vitrina/${cheie}`}
                  title={`Demonstrație interactivă: ${titlu}`}
                  className="h-full w-full flex-1 border-0"
                />
              ) : null}
            </div>
          </dialog>
        </div>
      </div>
    </section>
  );
}
```

> Nu folosi componenta `Dialog` din `src/components/ui/dialog.tsx`: e din sistemul aplicației,
> nu din cel de marketing, iar `dialog.tsx:12-23` notează că elementul intră în **top layer** —
> stivuit peste `<dialog>`-ul aplicației din iframe ar fi al doilea element în top layer.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --project ui "src/app/(marketing)/_componente/prin-geam.test.tsx"`
Expected: PASS — 3 teste.

- [ ] **Step 5: Montează banda pe pagina de modul**

`src/app/(marketing)/module/[modul]/page.tsx` a fost rescris de altă sesiune în `c978a7c`.
**Rulează `git diff -- "src/app/(marketing)/module/[modul]/page.tsx"` și
`git log --oneline -3 -- "src/app/(marketing)/module/[modul]/page.tsx"` înainte de a-l atinge.**

Adaugă importul și, imediat **după** `<AntetSecundar …/>`, înainte de prima `<Banda>`:

```tsx
{
  arePrinGeam(cheie) && <PrinGeam cheie={cheie} titlu={modul.titlu} />;
}
```

Banda e opțională prin construcție: modulele fără vitrină n-o randează, exact ca `fisa` de
deasupra. Situl nu devine inconsecvent — devine gradat.

- [ ] **Step 6: Poarta completă**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: totul verde. Numărul de teste trebuie să fie mai mare decât înainte — dacă e egal,
fișierele noi de test nu sunt culese de niciun proiect din `vitest.config.mts`.

`pnpm build` NU se rulează în sesiune. Declară explicit că granița server/client rămâne
neverificată de build și că interacțiunea de client (popup, comutator, trimiterea formularului)
e neverificată în browser.

- [ ] **Step 7: Commit și push**

```bash
git add "src/app/(marketing)/_componente/prin-geam.tsx" "src/app/(marketing)/_componente/prin-geam.test.tsx"
git status --short -- "src/app/(marketing)"
git diff -- "src/app/(marketing)/module/[modul]/page.tsx"
cat > /tmp/msg.txt <<'MSG'
feat(marketing): banda „prin geam" — ecranul real, încadrat, pe pagina de modul

Chenarul e un iframe leneș către /vitrina/<cheie>, în passe-partout desenat
cu rigla sitului: fără umbră și fără chenar complet, fiindcă vocabularul
sitului le interzice și un card ar fi vizibil străin. Raportul de aspect e
fix — fără el, iframe-ul sosește după layout și împinge pagina.

Banda e opțională: modulele fără vitrină n-o randează, ca `fisa` de deasupra.
MSG
git commit --only -F /tmp/msg.txt -- "src/app/(marketing)/_componente/prin-geam.tsx" "src/app/(marketing)/_componente/prin-geam.test.tsx" "src/app/(marketing)/module/[modul]/page.tsx"
git fetch origin main
git merge origin/main
git push origin main
```

---

## Ce rămâne după planul ăsta

- **Pasul 1 din spec** — fișe pentru celelalte 14 module. Structura e deja livrată de altă
  sesiune în `c978a7c` (`src/content/landing/fise-module.ts`, 5 module din 19).
- **Intrarea paginilor de modul în sitemap** (`src/content/landing/harta.ts`), acum că au
  conținut propriu — condiția scrisă în `page.tsx:31-36` devine îndeplinită.
- **Pasul 2** — vitrină pentru `attendance`.
- **Injecția acțiunii în `DialogCerereNoua`** (`dialog-cerere-noua.tsx:312`), ca popup-ul să
  folosească formularul REAL de cerere, nu pe cel simplificat din Task 8. E un refactor în
  `(app)` cu implicit care păstrează comportamentul de producție neschimbat; merită plan propriu.
- **`postMessage` între iframe și părinte**, pentru `Esc` și pentru sincronizarea înălțimii.
- **Proba pe producție** a tot ce e comportament de client — `next dev` nu hidratează aici.
