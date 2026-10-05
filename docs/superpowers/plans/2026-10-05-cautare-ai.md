# Căutarea AI (GEO), partea de cod — plan de implementare

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Urcăm scorul de căutare AI (67/100 pe 5 oct) pe cele trei dimensiuni care țin de cod — structură, multimedia, citabilitate — și facem descoperibile paginile noi pe care motoarele nu le-au găsit încă.

**Architecture:** Ghidurile (`PaginaLege`, randate de `RandarePaginaLege`) primesc titluri-întrebare proprii, butonul de cont mutat după răspunsul scurt, o captură reală din aplicație cu legendă onestă, iar `Article` primește `image` și `citation` din datele pe care pagina le are deja. Uneltele gratuite primesc un nod `WebApplication`. Legăturile spre paginile nedescoperite intră în subsol și în „Pe același subiect".

**Tech Stack:** Next.js 16.3 App Router, React 19.2, Vitest (proiectul `unit`: `src/**/*.test.ts`, mediu `node`), schema.org JSON-LD.

**Spec:** `docs/comercial/audit-seo-2026-10-05.md` și raportul GEO (dimensiunile: citabilitate 84, structură 76, multimedia 45, autoritate 28, tehnic 92; constatările: CTA între răspuns și definiție, H2-uri șablon, `Article` fără `citation`, calculator fără `dateModified`).

## Global Constraints

- Cod, comentarii, texte în română, cu ș/ț cu virgulă dedesubt (U+0219/U+021B). Mesajele de eroare se termină cu punct.
- Nicio afirmație juridică nouă: titlurile-întrebare reformulează ce spune deja pagina; nu se adaugă reguli, cifre sau articole.
- Legendele și textul alternativ al capturilor descriu DOAR ce se vede în captură (capturile sunt din contul demonstrativ, date fictive — se spune).
- Fără FAQPage (rezultatele FAQ retrase pe 7 mai 2026). Fără HowTo.
- Data `lastmod` a unei pagini-lege = data verificării textelor de lege (`actualizatIso`), nu data editării — nu se mută pentru titluri sau legături (regula din `lastmod.mjs` §3). Paginile de unelte și cele din `harta.ts` cu dată proprie se mută în ACELAȘI commit cu schimbarea (memoria `erp-lastmod-acelasi-commit`).
- Lanțul de verificare: `pnpm typecheck && pnpm check:server && pnpm lint && pnpm format:check && pnpm test`. Fără `pnpm build`.
- `git commit --only -- <căi>`, merge (nu rebase), push pe `main`. Deploy-ul pe producție cere confirmarea lui Miro.

## Review Focus

1. **Pagina fără captură** (`/reges-online`, ghidurile de ore suplimentare și spor de noapte) se randează identic cu azi, fără figură goală și fără `image` în `Article` (Task 3, testul „fără captură, fără image").
2. **Butonul de cont rămâne deasupra pliului pe telefon** după mutare: răspunsul scurt are 102–143 de cuvinte, deci butonul coboară cu ~10–14 rânduri. Se măsoară headless la 390×844 (Task 2, Step 5).
3. **`/en` nu folosește `RandarePaginaLege`** — schimbarea nu are voie să atingă paginile engleze (Task 2, verificat prin `grep`).
4. **Captura e o cheie inexistentă** (greșeală de tipar în conținut): testul cere ca orice `captura.cheie` să aibă fișier pe disc (Task 3).
5. **Titlurile-întrebare rămân unice și se termină cu „?"** pe toate ghidurile, inclusiv pe cele adăugate după planul ăsta (Task 1 — testul iterează lista centrală, nu o listă scrisă în test).

---

### Task 1: Lista centrală a ghidurilor și titluri-întrebare

Cinci din opt ghiduri au același H2 („Regulile, cu articolul lângă fiecare"), iar „Amenzile" e fix pe toate. Motoarele AI potrivesc pasajele după întrebarea pe care o caută; un titlu-întrebare e chiar acea întrebare.

**Files:**

- Create: `src/content/legal/pagini.ts`
- Create: `src/content/legal/pagini.test.ts`
- Modify: `src/content/legal/tipuri.ts` (câmp nou `titluAmenzi`)
- Modify: cele 8 fișiere din `src/content/legal/`: `evidenta-orelor.ts`, `reges.ts`, `control-itm.ts`, `concediu-odihna.ts`, `diurna.ts`, `diurna-externa.ts`, `ore-suplimentare.ts`, `spor-de-noapte.ts`
- Modify: `src/app/(marketing)/_componente/pagina-lege.tsx:126` (`titlu="Amenzile"` → `titlu={text.titluAmenzi}`)

**Interfaces:**

- Produces: `PAGINI_LEGE: readonly PaginaLege[]` din `src/content/legal/pagini.ts`; `PaginaLege.titluAmenzi: string` (obligatoriu).

- [ ] **Step 1: Lista centrală**

```ts
// src/content/legal/pagini.ts
import { CONCEDIU_ODIHNA } from "./concediu-odihna";
import { CONTROL_ITM } from "./control-itm";
import { DIURNA } from "./diurna";
import { DIURNA_EXTERNA } from "./diurna-externa";
import { EVIDENTA_ORELOR } from "./evidenta-orelor";
import { ORE_SUPLIMENTARE } from "./ore-suplimentare";
import { REGES } from "./reges";
import { SPOR_DE_NOAPTE } from "./spor-de-noapte";
import type { PaginaLege } from "./tipuri";

/**
 * Toate paginile-lege, într-un singur loc.
 *
 * Până pe 5 oct 2026 erau importate pe rând în `harta.ts`, `ghid/page.tsx` și
 * în teste — un ghid nou putea scăpa unei verificări fără ca nimic să cadă.
 * Testele de formă iterează lista asta; un ghid nou intră aici sau nu e verificat.
 */
export const PAGINI_LEGE: readonly PaginaLege[] = [
  EVIDENTA_ORELOR,
  REGES,
  CONTROL_ITM,
  CONCEDIU_ODIHNA,
  DIURNA,
  DIURNA_EXTERNA,
  ORE_SUPLIMENTARE,
  SPOR_DE_NOAPTE,
];
```

- [ ] **Step 2: Testul care pică**

```ts
// src/content/legal/pagini.test.ts
import { readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PAGINI_LEGE } from "./pagini";

describe("paginile-lege", () => {
  it("lista centrală le cuprinde pe toate rutele de ghid", () => {
    // Fiecare `page.tsx` care randează o pagină-lege trebuie să-și aibă textul aici.
    const cai = new Set(PAGINI_LEGE.map((p) => p.cale));
    const ghiduri = readdirSync("src/app/(marketing)/ghid", { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => `/ghid/${d.name}`);
    for (const cale of [...ghiduri, "/reges-online", "/evidenta-orelor-de-munca"]) {
      expect(cai.has(cale), cale).toBe(true);
    }
  });

  it("titlurile secțiunilor de reguli și de amenzi sunt întrebări, diferite de la o pagină la alta", () => {
    // Auditul din 5 oct 2026: cinci ghiduri aveau același H2, iar „Amenzile" era fix.
    const titluri = PAGINI_LEGE.flatMap((p) => [p.titluReguli, p.titluAmenzi]);
    for (const t of titluri) expect(t, t).toMatch(/\?$/);
    expect(new Set(titluri).size).toBe(titluri.length);
  });
});
```

- [ ] **Step 3: Vezi-l roșu**

Run: `pnpm vitest run src/content/legal/pagini.test.ts`
Expected: FAIL. Al doilea test: `titluAmenzi` e `undefined` (nu se potrivește cu `/\?$/`), iar titlurile vechi nu se termină în „?".

- [ ] **Step 4: Tipul**

În `tipuri.ts`, după `titluReguli`:

```ts
/**
 * Titlul secțiunii de amenzi, ca întrebare. A fost „Amenzile", fix pe toate
 * paginile, până pe 5 oct 2026; motoarele generative potrivesc pasajul după
 * întrebarea căutată, iar un titlu identic pe opt pagini nu potrivește nimic.
 */
titluAmenzi: string;
```

Comentariul de la `titluReguli` devine: `/** Titlul tabelei de reguli, ca întrebare — diferă de la o pagină la alta. */`.

- [ ] **Step 5: Valorile**

În fiecare fișier, `titluReguli` se înlocuiește, iar `titluAmenzi` se adaugă imediat după el:

| Fișier                | `titluReguli`                                         | `titluAmenzi`                                                 |
| --------------------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| `evidenta-orelor.ts`  | Ce trebuie să conțină evidența orelor, după art. 119? | Ce amendă riscă angajatorul fără evidența orelor?             |
| `reges.ts`            | Care sunt termenele de transmitere în REGES-ONLINE?   | Ce amenzi se dau pentru REGES-ONLINE?                         |
| `control-itm.ts`      | Ce documente cere inspectorul ITM la un control?      | Ce amenzi se dau cel mai des la un control ITM?               |
| `concediu-odihna.ts`  | Ce reguli are concediul de odihnă în Codul muncii?    | Se amendează neacordarea concediului de odihnă?               |
| `diurna.ts`           | Cât e diurna neimpozabilă în 2026 și când se acordă?  | Se amendează o diurnă neacordată sau calculată greșit?        |
| `diurna-externa.ts`   | Cum se acordă diurna externă și cât e neimpozabil?    | Ce riscă firma dacă diurna externă e sub cuantumul din anexă? |
| `ore-suplimentare.ts` | Ce reguli au orele suplimentare în Codul muncii?      | Ce amendă se dă pentru ore suplimentare nelegale?             |
| `spor-de-noapte.ts`   | Ce reguli are munca de noapte în Codul muncii?        | Ce amendă se dă pentru încălcarea regulilor muncii de noapte? |

Fiecare întrebare are răspunsul deja în secțiunea de sub ea (verificat pe 5 oct: ex. concediul — „nicio contravenție" pe prima faptă; diurna internă — la fel).

- [ ] **Step 6: Randarea**

`pagina-lege.tsx:126`: `titlu="Amenzile"` → `titlu={text.titluAmenzi}`.

- [ ] **Step 7: Verdele**

Run: `pnpm vitest run src/content/legal/ && pnpm typecheck`
Expected: PASS; tsc fără erori (câmpul obligatoriu e pus pe toate cele 8).

- [ ] **Step 8: Commit**

`git commit --only -m "feat(ghid): titlurile de reguli și de amenzi, ca întrebări proprii fiecărui ghid" -- src/content/legal/ "src/app/(marketing)/_componente/pagina-lege.tsx"`

---

### Task 2: Butonul de cont după răspunsul scurt

Azi: H1 → lead → **buton** → răspunsul scurt. Pasajul pe care îl extrage un motor (lead + răspuns) conține „Creează cont · prima lună gratuită" la mijloc. Butonul rămâne sus pentru telefon (motivul din `antet-secundar.tsx`, 17 sept), dar coboară sub răspuns.

**Files:**

- Modify: `src/app/(marketing)/_componente/pagina-lege.tsx` (rândurile 67–100)
- Test: `src/app/(marketing)/_componente/pagina-lege.test.ts` (nou)

- [ ] **Step 1: Testul care pică**

```ts
// src/app/(marketing)/_componente/pagina-lege.test.ts
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const SURSA = readFileSync("src/app/(marketing)/_componente/pagina-lege.tsx", "utf8");

describe("pagina-lege", () => {
  it("butonul de cont vine după răspunsul scurt, nu între lead și răspuns", () => {
    // Auditul GEO din 5 oct 2026: pasajul extras de motoarele generative cuprindea
    // și „Creează cont · prima lună gratuită", fiindcă antetul îl punea înaintea
    // răspunsului. Antetul nu mai primește buton; pagina îl pune după răspuns.
    expect(SURSA).toContain("cta={null}");
    const raspuns = SURSA.indexOf("text.raspunsScurt.map");
    const buton = SURSA.indexOf('data-umami-event="cta-dupa-raspuns"');
    expect(raspuns).toBeGreaterThan(0);
    expect(buton).toBeGreaterThan(raspuns);
  });
});
```

- [ ] **Step 2: Vezi-l roșu**

Run: `pnpm vitest run "src/app/(marketing)/_componente/pagina-lege.test.ts"`
Expected: FAIL pe `toContain("cta={null}")`.

- [ ] **Step 3: Mutarea**

În `RandarePaginaLege`, `<AntetSecundar text={text.antet} … />` primește `cta={null}` (lângă `firimituri`). În banda răspunsului scurt, după paragraful „Textele verificate în …":

```tsx
{
  /* Butonul stă aici, nu în antet: acolo rupea pasajul pe care îl citează
            motoarele generative (lead + răspuns). Rămâne deasupra pliului pe
            telefon — răspunsul are 100–150 de cuvinte. */
}
<Link
  href={RO.hero.ctaPrimar.href}
  data-umami-event="cta-dupa-raspuns"
  className="bg-mk-cerneala text-mk-text-inv mt-6 inline-flex h-12 items-center rounded px-6 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
>
  {RO.hero.ctaPrimar.eticheta}
</Link>;
```

(`Link` și `RO` sunt deja importate în fișier.)

- [ ] **Step 4: Verdele**

Run: `pnpm vitest run "src/app/(marketing)/_componente/pagina-lege.test.ts" && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Poziția pe telefon**

Cu `next dev -H 127.0.0.1 -p 3100`, măsoară cu playwright-core + headless_shell (memoria `erp-verificare-vizuala-headless`), 390×844, pe `/ghid/ore-suplimentare` (răspunsul cel mai lung, 143 de cuvinte) și `/reges-online`:

```js
const y = await p
  .locator('[data-umami-event="cta-dupa-raspuns"]')
  .evaluate((e) => e.getBoundingClientRect().bottom);
```

Expected: valoarea raportată. Dacă depășește 2 × 844 px (a doua ecranare), se notează în jurnal ca regresie de conversie și se discută cu Miro înainte de push — decizia de pe 17 sept era „butonul vizibil fără derulare lungă".
Verifică și că `/en` nu e atins: `grep -rn RandarePaginaLege "src/app/(marketing)/en"` → nicio potrivire.

- [ ] **Step 6: Commit**

`git commit --only -m "feat(ghid): butonul de cont după răspunsul scurt — pasajul citat rămâne întreg" -- "src/app/(marketing)/_componente/pagina-lege.tsx" "src/app/(marketing)/_componente/pagina-lege.test.ts"`

---

### Task 3: Capturi reale în ghiduri; `Article` cu `image` și `citation`

Multimedia e la 45. Capturile există deja (`public/capturi/`, catalogul din `vitrine.ts`). Comentariul din `nodArticol` spune că `Article` n-are imagine fiindcă singura disponibilă era cea de Open Graph, cu hash — motivul a dispărut, iar o captură relevantă e informație, nu decor. `citation` se construiește din `surse`, pe care toate cele 8 ghiduri le au (1–3 fiecare).

**Files:**

- Modify: `src/content/legal/tipuri.ts` (câmp opțional `captura`)
- Modify: `evidenta-orelor.ts`, `concediu-odihna.ts`, `diurna.ts`, `diurna-externa.ts`, `control-itm.ts`
- Modify: `src/app/(marketing)/_componente/noduri-json-ld.ts` (`nodArticol`, comentariul „DE CE NU ARE image")
- Modify: `src/app/(marketing)/_componente/pagina-lege.tsx` (figura, după banda de reguli)
- Test: `src/app/(marketing)/_componente/noduri-json-ld.test.ts` (nou), `src/content/legal/pagini.test.ts`

**Interfaces:**

- Consumes: `PAGINI_LEGE` (Task 1); `capturaModulului(cheie)`, `arePrinGeam(cheie)`, `LATIME_CAPTURA`, `INALTIME_CAPTURA` din `vitrine.ts`.
- Produces: `PaginaLege.captura?: Readonly<{ cheie: string; alt: string; legenda: string }>`.

- [ ] **Step 1: Testele care pică**

`src/app/(marketing)/_componente/noduri-json-ld.test.ts`:

```ts
// src/app/(marketing)/_componente/noduri-json-ld.test.ts
import { describe, expect, it } from "vitest";

import { ADRESA_SITE } from "@/content/landing/contact";
import { PAGINI_LEGE } from "@/content/legal/pagini";

import { nodArticol } from "./noduri-json-ld";

describe("nodArticol", () => {
  it("citează textele de lege din `surse`", () => {
    for (const p of PAGINI_LEGE) {
      const nod = nodArticol(p);
      expect(nod.citation, p.cale).toEqual(
        (p.surse ?? []).map((s) => ({ "@type": "CreativeWork", name: s.eticheta, url: s.href })),
      );
    }
  });

  it("are `image` exact când pagina are captură", () => {
    for (const p of PAGINI_LEGE) {
      const nod = nodArticol(p);
      if (p.captura === undefined) {
        expect("image" in nod, `${p.cale}: fără captură, fără image`).toBe(false);
      } else {
        expect(nod.image, p.cale).toEqual({
          "@type": "ImageObject",
          url: `${ADRESA_SITE}/capturi/${p.captura.cheie}-1920.webp`,
          width: 1920,
          height: 1200,
          caption: p.captura.alt,
        });
      }
    }
  });
});
```

În `src/content/legal/pagini.test.ts`, în `describe`:

```ts
it("capturile din ghiduri există pe disc și au text alternativ descriptiv", async () => {
  const { arePrinGeam } = await import("@/app/(marketing)/_componente/vitrine");
  const cuCaptura = PAGINI_LEGE.filter((p) => p.captura !== undefined);
  expect(cuCaptura.length).toBeGreaterThanOrEqual(5);
  for (const p of cuCaptura) {
    expect(arePrinGeam(p.captura?.cheie ?? ""), p.cale).toBe(true);
    expect(p.captura?.alt.length ?? 0, p.cale).toBeGreaterThanOrEqual(60);
    expect(p.captura?.legenda, p.cale).toMatch(/date fictive/i);
  }
});
```

- [ ] **Step 2: Vezi-le roșii**

Run: `pnpm vitest run "src/app/(marketing)/_componente/noduri-json-ld.test.ts" src/content/legal/pagini.test.ts`
Expected: FAIL — `citation` e `undefined`; `captura` lipsește pe toate (0 < 5).

- [ ] **Step 3: Tipul**

În `tipuri.ts`, după `tabel?`:

```ts
  /**
   * O captură din aplicație care arată obligația ținută la zi — din catalogul
   * `vitrine.ts`, după cheia modulului. Opțională: unde nu există o captură care
   * să arate exact subiectul paginii, nu se pune una aproximativă.
   *
   * `alt` descrie ce se VEDE (e și `caption` în `Article.image`); `legenda` spune
   * de ce contează și că datele sunt fictive, din contul demonstrativ.
   */
  captura?: Readonly<{ cheie: string; alt: string; legenda: string }>;
```

- [ ] **Step 4: Capturile, pe cinci ghiduri**

Fiecare text descrie strict ce e în captură (verificat vizual pe 5 oct, `public/capturi/*-960.webp`):

`evidenta-orelor.ts` — `cheie: "attendance"`:

- `alt`: „Foaia lunară de pontaj din Administrativo pentru august 2026: pe fiecare zi lucrătoare, ora de începere a fiecărui angajat; 15 august, sărbătoare legală, marcată separat."
- `legenda`: „Pontajul lunar în aplicație: ora de începere pe fiecare zi, sărbătoarea legală scoasă din calcul. Date fictive, din contul demonstrativ."

`concediu-odihna.ts` — `cheie: "leave"`:

- `alt`: „Calendarul de concedii din Administrativo pe septembrie 2026: un rând pe angajat, o coloană pe zi, weekendurile marcate și un concediu de odihnă de cinci zile lucrătoare."
- `legenda`: „Cine e în concediu și când, pe o singură lună, pentru toată echipa. Date fictive, din contul demonstrativ."

`diurna.ts` — `cheie: "per_diem"`:

- `alt`: „Lista deplasărilor din Administrativo: scopul, angajatul, perioada cu ora de plecare și de sosire, starea aprobării și diurna estimată în zile și lei."
- `legenda`: „Deplasările firmei, cu perioada exactă și diurna estimată pentru fiecare. Date fictive, din contul demonstrativ."

`diurna-externa.ts` — `cheie: "per_diem"`:

- `alt`: „Lista deplasărilor din Administrativo, inclusiv deplasări în Austria, Germania și Ungaria: perioada cu ora de plecare și de sosire, starea aprobării și diurna estimată."
- `legenda`: „Deplasările interne și externe în aceeași listă, cu diurna estimată. Date fictive, din contul demonstrativ."

`control-itm.ts` — `cheie: "ssm"`:

- `alt`: „Matricea de instruiri SSM din Administrativo: pe fiecare angajat, instruirea introductiv-generală, la locul de muncă, periodică și suplimentară, cu data și starea fiecăreia, inclusiv cele care expiră în curând."
- `legenda`: „Unul dintre documentele cerute la control, ținut la zi: se vede cine are instruirea pe cale să expire. Date fictive, din contul demonstrativ."

`/reges-online`, ghidurile de ore suplimentare și de spor de noapte rămân fără captură: nu există una care să arate exact subiectul lor.

- [ ] **Step 5: `nodArticol`**

În `noduri-json-ld.ts`, importă `{ INALTIME_CAPTURA, LATIME_CAPTURA }` din `./vitrine`. Înlocuiește paragraful „── DE CE NU ARE `image`" cu:

```ts
 * ── `image`, DIN 5 OCT 2026 ───────────────────────────────────────────────
 * Lipsea fiindcă singura imagine disponibilă era cea de Open Graph, cu hash în
 * adresă. Acum un ghid poate avea o captură din aplicație care arată chiar
 * obligația ținută la zi — informație, nu decor. Fără captură, fără `image`:
 * nu se pune imaginea generică de distribuire doar ca să existe câmpul.
 *
 * ── `citation` ────────────────────────────────────────────────────────────
 * Textele de lege din `surse`, aceleași legături de pe pagină. Le leagă
 * afirmațiile de sursa primară și în datele citite de motoare, nu doar în HTML.
```

Corpul funcției, după calculul lui `modificat`:

```ts
const captura = pagina.captura;
return {
  "@context": "https://schema.org",
  "@type": "Article",
  "@id": `${url}#articol`,
  headline: pagina.antet.titlu,
  description: pagina.antet.lead,
  datePublished: pagina.publicatIso,
  dateModified: modificat,
  inLanguage: "ro-RO",
  url,
  mainEntityOfPage: url,
  author: { "@id": ID_ORGANIZATIE },
  publisher: { "@id": ID_ORGANIZATIE },
  isPartOf: { "@id": ID_SITE },
  citation: (pagina.surse ?? []).map((s) => ({
    "@type": "CreativeWork",
    name: s.eticheta,
    url: s.href,
  })),
  ...(captura === undefined
    ? {}
    : {
        image: {
          "@type": "ImageObject",
          url: `${ADRESA_SITE}/capturi/${captura.cheie}-${String(LATIME_CAPTURA)}.webp`,
          width: LATIME_CAPTURA,
          height: INALTIME_CAPTURA,
          caption: captura.alt,
        },
      }),
};
```

(Spread condiționat, nu `image: undefined` — `exactOptionalPropertyTypes` e activ și testul cere cheia absentă.)

- [ ] **Step 6: Figura în pagină**

În `pagina-lege.tsx`, importă `{ capturaModulului, INALTIME_CAPTURA, LATIME_CAPTURA }` din `./vitrine`. După banda de reguli (`</Banda>` de la ~rândul 124), înainte de banda de amenzi:

```tsx
{
  text.captura !== undefined &&
    (() => {
      const captura = capturaModulului(text.captura.cheie);
      if (captura === undefined) return null;
      return (
        <Banda inaltime="scurta">
          <figure className="max-w-[72rem]">
            <img
              src={captura.sursa}
              srcSet={captura.srcset}
              sizes="(min-width: 1240px) 1180px, 92vw"
              alt={text.captura.alt}
              width={LATIME_CAPTURA}
              height={INALTIME_CAPTURA}
              loading="lazy"
              decoding="async"
              className="border-mk-rigla block h-auto w-full rounded border"
            />
            <figcaption className="text-mk-text-slab mt-3 text-[0.8125rem] leading-[1.5]">
              {text.captura.legenda}
            </figcaption>
          </figure>
        </Banda>
      );
    })();
}
```

Dacă ESLint cere o regulă pentru `<img>` (ca în `prin-geam.tsx`), se copiază exact comentariul `eslint-disable-next-line` de acolo, cu motivul lui.

- [ ] **Step 7: Verdele**

Run: `pnpm vitest run "src/app/(marketing)/_componente/" src/content/legal/ && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 8: Commit**

`git commit --only -m "feat(ghid): capturi reale din aplicație în cinci ghiduri; Article cu image și citation" -- <fișierele din Task 3>`

---

### Task 4: Uneltele ca `WebApplication`; nota din calculator

Uneltele au azi doar firimituri. Un nod `WebApplication` gratuit le spune motoarelor ce sunt (unealtă, nu articol). Calculatorul primește `dateModified` și nota „informativ" pe care o au toate ghidurile (reauditul din 5 oct, Medium #2).

**Files:**

- Modify: `src/content/landing/harta.ts` (funcție nouă `dataPaginii`)
- Modify: `src/app/(marketing)/_componente/noduri-json-ld.ts` (funcție nouă `nodUnealta`)
- Modify: cele 7 `src/app/(marketing)/unelte/*/page.tsx`
- Modify: `src/app/(marketing)/unelte/calculator-salariu/page.tsx` (nota)
- Test: `src/app/(marketing)/_componente/noduri-json-ld.test.ts`, `src/content/landing/continut.test.ts`

**Interfaces:**

- Produces: `dataPaginii(cale: string): string` (aruncă dacă pagina nu e în `PAGINI`); `nodUnealta(u: { cale: string; nume: string; descriere: string }): object`.

- [ ] **Step 1: Testele care pică**

În `noduri-json-ld.test.ts`, import `nodUnealta` și:

```ts
describe("nodUnealta", () => {
  it("e o aplicație web gratuită, cu data din sitemap", async () => {
    const { dataPaginii } = await import("@/content/landing/harta");
    const nod = nodUnealta({
      cale: "/unelte/calculator-salariu",
      nume: "Calculator salariu net și brut",
      descriere: "Descriere.",
    });
    expect(nod).toMatchObject({
      "@type": "WebApplication",
      "@id": `${ADRESA_SITE}/unelte/calculator-salariu#unealta`,
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "RON" },
      dateModified: dataPaginii("/unelte/calculator-salariu"),
    });
  });
});
```

În `continut.test.ts`, în blocul „reparațiile din auditul SEO din 2 oct 2026" (sau un `describe` nou „auditul din 5 oct 2026"):

```ts
it("fiecare unealtă își declară nodul WebApplication", () => {
  const pagini = fisiere("src/app/(marketing)/unelte", ["page.tsx"]).filter(
    (f) => f !== "src/app/(marketing)/unelte/page.tsx",
  );
  expect(pagini.length).toBeGreaterThanOrEqual(7);
  for (const f of pagini) expect(readFileSync(f, "utf8"), f).toContain("nodUnealta(");
});

it("calculatorul de salariu spune că e informativ", () => {
  const sursa = readFileSync("src/app/(marketing)/unelte/calculator-salariu/page.tsx", "utf8");
  expect(sursa).toMatch(/informativ/i);
  expect(sursa).toMatch(/contabil/i);
});
```

- [ ] **Step 2: Vezi-le roșii**

Run: `pnpm vitest run "src/app/(marketing)/_componente/noduri-json-ld.test.ts" src/content/landing/continut.test.ts -t "unealt|calculatorul"`
Expected: FAIL (`nodUnealta`/`dataPaginii` nu există; sursele nu conțin textele).

- [ ] **Step 3: `dataPaginii`**

În `harta.ts`, după `PAGINI`:

```ts
/** Data `lastmod` a unei pagini din sitemap — aceeași cifră și în datele structurate. */
export function dataPaginii(cale: string): string {
  const pagina = PAGINI.find((p) => p.cale === cale);
  if (pagina === undefined) throw new Error(`Pagina ${cale} nu e în sitemap.`);
  return pagina.actualizat;
}
```

- [ ] **Step 4: `nodUnealta`**

În `noduri-json-ld.ts` (import `dataPaginii` din `@/content/landing/harta`):

```ts
/**
 * O unealtă gratuită, ca `WebApplication` — nu `SoftwareApplication`, care e
 * produsul cu abonament (`#aplicatie`). `dateModified` e data din sitemap, ca
 * cele două să nu poată spune lucruri diferite. Fără `aggregateRating`: nu avem
 * recenzii, iar unele inventate ar fi o afirmație falsă.
 */
export function nodUnealta(u: Readonly<{ cale: string; nume: string; descriere: string }>) {
  const url = `${ADRESA_SITE}${u.cale}`;
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${url}#unealta`,
    name: u.nume,
    description: u.descriere,
    url,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    inLanguage: "ro-RO",
    isAccessibleForFree: true,
    dateModified: dataPaginii(u.cale),
    offers: { "@type": "Offer", price: "0", priceCurrency: "RON" },
    provider: { "@id": ID_ORGANIZATIE },
    isPartOf: { "@id": ID_SITE },
  };
}
```

- [ ] **Step 5: Cele 7 pagini**

În fiecare `unelte/<x>/page.tsx`, primul copil din `<Cadru>`:

```tsx
<JsonLd date={nodUnealta({ cale: "/unelte/<x>", nume: ANTET_X.titlu, descriere: ANTET_X.lead })} />
```

cu `ANTET_X` = constanta de antet deja importată de pagină (`ANTET_FOAIE_PONTAJ`, `ANTET_CERERE_CONCEDIU`, `ANTET_CONDICA`, `ANTET_FOAIE_PARCURS`, `ANTET_FISA_SSM`, `ANTET_FISA_EVALUARE`, `ANTET_CALCULATOR`) și importurile `JsonLd` din `../../_componente/json-ld`, `nodUnealta` din `../../_componente/noduri-json-ld`.

- [ ] **Step 6: Nota din calculator**

În `calculator-salariu/page.tsx`, imediat înaintea paragrafului „Valorile verificate pe …" (~rândul 238):

```tsx
<p className="border-mk-cerneala text-mk-text mt-8 max-w-[68ch] border-l-2 pl-4 text-[0.9375rem] leading-[1.6]">
  Calculul e informativ, pentru un contract cu normă întreagă, fără sporuri și fără facilitățile de
  mai sus. Valorile sunt cele din iulie–decembrie 2026; pentru statul de plată, confirmă cu
  contabilul firmei.
</p>
```

(Fereastra „iulie–decembrie 2026" vine din comentariul lui `VERIFICARE`, `salarizare-publica.ts:27`: facilitatea expiră la 1 ianuarie 2027.)

- [ ] **Step 7: Verdele**

Run: `pnpm vitest run "src/app/(marketing)/" src/content/ && pnpm typecheck && pnpm check:server`
Expected: PASS. `check:server` contează: `harta.ts` ajunge acum importat din `noduri-json-ld.ts`.

- [ ] **Step 8: Commit**

`git commit --only -m "feat(unelte): fiecare unealtă ca WebApplication gratuită; calculatorul spune că e informativ" -- <fișierele din Task 4>`

---

### Task 5: Legături spre paginile pe care motoarele nu le-au găsit

Pe 5 oct, Google nu știa de `/ghid/ore-suplimentare`, `/ghid/spor-de-noapte`, `/unelte/fisa-evaluare` — exact paginile noi cu 2–4 legături interne. Calculatorul, cea mai căutată unealtă, avea 2. O pagină necrawlată nu poate fi citată de niciun motor.

**Files:**

- Modify: `src/content/landing/ro.ts` (subsolul, ~rândurile 988–1035)
- Modify: `src/content/legal/ore-suplimentare.ts`, `spor-de-noapte.ts`, `diurna.ts`, `control-itm.ts` (`legaturiConexe`)
- Test: `src/content/landing/continut.test.ts`

- [ ] **Step 1: Testul care pică**

```ts
it("paginile nedescoperite pe 5 oct au legături din subsol și din ghiduri", async () => {
  // GSC, 5 oct 2026: „URL is unknown to Google" pe ore-suplimentare, spor-de-noapte
  // și fisa-evaluare — paginile noi cu cele mai puține legături interne.
  const subsol = RO.subsol.coloane.flatMap((c) => c.legaturi.map((l) => l.href));
  for (const href of [
    "/unelte/calculator-salariu",
    "/ghid/ore-suplimentare",
    "/unelte/fisa-evaluare",
  ]) {
    expect(subsol, href).toContain(href);
  }
  const { PAGINI_LEGE } = await import("@/content/legal/pagini");
  const conexe = (cale: string) =>
    (PAGINI_LEGE.find((p) => p.cale === cale)?.legaturiConexe ?? []).map((l) => l.href);
  for (const cale of ["/ghid/ore-suplimentare", "/ghid/spor-de-noapte", "/ghid/diurna"]) {
    expect(conexe(cale), cale).toContain("/unelte/calculator-salariu");
  }
  expect(conexe("/ghid/control-itm")).toContain("/unelte/fisa-instruire-ssm");
});
```

(Subsolul e `RO.subsol.coloane` — `ro.ts:982`, verificat.)

- [ ] **Step 2: Vezi-l roșu**

Run: `pnpm vitest run src/content/landing/continut.test.ts -t "nedescoperite"`
Expected: FAIL pe `/unelte/calculator-salariu`.

- [ ] **Step 3: Subsolul**

În coloana „Produs", după „Cerere de concediu":

```ts
          { eticheta: "Calculator salariu net", href: "/unelte/calculator-salariu" },
          { eticheta: "Fișă de evaluare", href: "/unelte/fisa-evaluare" },
```

În „Înainte să întrebi", după „Diurna externă pe țări":

```ts
          { eticheta: "Ore suplimentare și spor de noapte", href: "/ghid/ore-suplimentare" },
```

(Ghidul de ore suplimentare leagă deja spor-de-noapte — verificat pe 5 oct.)

- [ ] **Step 4: Ghidurile**

- `ore-suplimentare.ts`, `spor-de-noapte.ts`, `diurna.ts` — în `legaturiConexe`: `{ eticheta: "Calculator salariu net și brut", href: "/unelte/calculator-salariu" },`
- `control-itm.ts` — în `legaturiConexe`: `{ eticheta: "Fișa de instruire SSM, gata de completat", href: "/unelte/fisa-instruire-ssm" },`

- [ ] **Step 5: Verdele**

Run: `pnpm vitest run src/content/`
Expected: PASS, inclusiv testul vechi „legăturile din fișe și din paginile-lege duc spre pagini din sitemap".

- [ ] **Step 6: Commit**

`git commit --only -m "feat(seo): legături spre calculator și spre paginile pe care Google nu le găsise" -- src/content/landing/ro.ts src/content/legal/ src/content/landing/continut.test.ts`

---

### Task 6: Verificare, `lastmod`, push

- [ ] **Step 1: Lanțul** — `pnpm typecheck && pnpm check:server && pnpm lint && pnpm format:check && pnpm test` → verde, fără `pnpm build`.
- [ ] **Step 2: HTML-ul local** — cu `next dev -H 127.0.0.1 -p 3100` (oprit în apel SEPARAT, memoria `erp-pkill-se-omoara-singur`; apoi șters `.next/dev/types/validator.ts`):
  - `/ghid/control-itm`: un `<h2>` cu „Ce documente cere inspectorul ITM la un control?"; `<figure>` cu captura SSM; JSON-LD `Article` cu `citation` (3) și `image`.
  - `/ghid/ore-suplimentare`: fără `<figure>`, fără `image` în `Article`.
  - `/unelte/calculator-salariu`: JSON-LD `WebApplication`; textul „informativ".
  - Subsolul de pe `/`: legăturile spre calculator, fișa de evaluare și ore suplimentare.
  - Analiză pe text vizibil, NU `sed` pe HTML-ul de o linie (memoria `erp-pipe-inghite-codul`): `python3` care scoate `<script>`/`<style>` înainte de căutare.
- [ ] **Step 3: `lastmod`** — `pnpm check:lastmod` după commit-uri. Uneltele (Task 4) își mută data în `harta.ts` în ACELAȘI commit cu schimbarea, nu la final; paginile-lege nu se mută (data lor e a verificării textelor).
- [ ] **Step 4: Starea în raport** — o secțiune „Reparate" în `docs/comercial/audit-seo-2026-10-05.md`.
- [ ] **Step 5: Push** — ritualul din CLAUDE.md; verifică DURATA rulărilor CI și Staging, nu doar concluzia.
- [ ] **Step 6: Producția** — se cere confirmarea lui Miro înainte de `./administrativo.sh prod`.

---

## În afara planului

- **Autoritatea (28/100, cea mai mare pârghie):** Bing Webmaster Tools, directoare (Capterra, GetApp, G2, SaaSHub, liste românești), comunitatea contabililor, Wikidata, autor numit + `/despre` — la Miro; codul pentru `/despre` și `sameAs` se face când există numele și adresele.
- **Video** (`VideoObject`): cere o înregistrare reală; se adaugă când există.
- **Restanțe din reaudit, mici, fără legătură cu căutarea AI:** codurile de rol `org_admin`/`hr` ca etichete pe `/module` (`benzi/produs.tsx:186`), titlul `/unelte` rămas la două unelte, greșelile din ghidul de ore suplimentare („sub 48", „≈35") și rândurile Birmania/Myanmar. Un lot separat, de o oră.
- **Blocuri de răspuns de 130–170 de cuvinte:** răspunsurile scurte au deja 102–143; după Task 2 se citesc lipite de lead (136–179). Nu se rescriu.
