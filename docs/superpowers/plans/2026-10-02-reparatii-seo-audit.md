# Reparațiile din auditul SEO din 2 oct — plan de implementare

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reparăm tot ce ține de cod din [auditul din 2 oct](../../comercial/audit-seo-2026-10-02.md): imaginea de distribuire pe toate paginile, drumul spre ofertă peste 20 de angajați, cheile interne afișate public, titlurile care se canibalizează, legăturile interne lipsă și IndexNow.

**Architecture:** Toate schimbările stau în grupul `src/app/(marketing)` și în conținutul din `src/content/landing/`. Imaginea de distribuire se mută de pe convenția `opengraph-image.tsx` (URL cu hash, care nu poate fi referit) pe o rută fixă, `/imagine-distribuire.png`, pe care `metadatePagina` o pune explicit pe fiecare pagină. Legăturile interne noi trăiesc într-un singur tabel, `LEGATURI_CONEXE`, randat de o singură componentă, `PeAcelasiSubiect`. Componenta există deja de două ori, copiată, și se extrage.

**Tech Stack:** Next.js 16.3 App Router (`next/og`, route handlers), React 19.2, Vitest (proiectul `unit` = `src/**/*.test.ts`, mediu `node`), Tailwind v4.

**Spec:** `docs/comercial/audit-seo-2026-10-02.md` (secțiunile High, Medium, Low, „Cum știm că a mers").

## Global Constraints

- Cod, comentarii și mesaje în română, cu ș/ț cu virgulă dedesubt (U+0219/U+021B), nu cu sedilă.
- Titlurile de pagină: `titlu + " · Administrativo"` ≤ 65 de caractere, fără „Administrativo" în titlu (testul din `continut.test.ts:740`).
- Descrierile fișelor ≤ 170 de caractere (`continut.test.ts:787`).
- Orice schimbare de conținut a unei pagini mută data ei de `lastmod`; poarta e `pnpm check:lastmod` (cere istoric git, deci rulează după commit).
- Lanțul meu de verificare: `pnpm typecheck && pnpm check:server && pnpm lint && pnpm format:check && pnpm test`. **Fără `pnpm build`** (memoria `erp-fara-build-de-la-mine`).
- O pagină (`page.tsx`) sau o rută (`route.ts`) exportă doar ce cere Next; constantele și funcțiile ajutătoare stau în `_componente/` sau în `src/content/`.
- Commit cu `git commit --only -- <căi>`, merge (nu rebase), push pe `main`.
- Deploy-ul pe producție (`./administrativo.sh prod`) cere confirmarea lui Miro; staging se face singur, din CI, la push.

## Review Focus

1. **Imaginea servită pe staging/producție, nu doar declarată.** Un `og:image` care arată spre o rută 404 e mai rău decât lipsa lui (LinkedIn pune cache pe eșec). Poarta `rute-publice.mjs` cere și imaginea (Task 1, Step 7).
2. **Pagina `/en` și `/en/preturi`** primesc aceeași imagine și același drum spre ofertă, cu textul în engleză (Task 1, testul cu `limba: "en"`; Task 2, `en.ts`).
3. **`/unelte/cerere-concediu-de-odihna` la tipărire:** legăturile noi nu au voie să apară pe foaia tipărită. Stau în blocul `data-tipar="ascunde"` (Task 5, Step 5).
4. **Proxy-ul și fișierul IndexNow:** `/<cheie>.txt` nu e în excluderile matcher-ului. Trebuie să treacă prin `proxy.ts` fără redirect spre autentificare (Task 7, Step 4, verificat cu `curl` pe `next dev`).
5. **`lastmod` după schimbările de conținut:** fișele de modul, paginile-lege și paginile atinse își mută data; altfel poarta din CI e roșie (Task 8, Step 3).

---

### Task 1: Imaginea de distribuire pe fiecare pagină

Regresia din 23 sept. `metadatePagina()` pune un `openGraph` propriu, iar Next îmbină metadatele **superficial** (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md`, „Merging"). Obiectul paginii îl înlocuiește pe cel moștenit, cu tot cu imaginea din `opengraph-image.tsx`. Remediul documentat de Next e o variabilă comună cu `images`. URL-ul generat de `opengraph-image.tsx` are însă un hash (`/opengraph-image-pwu6ef`), deci imaginea trece pe o rută cu adresă fixă.

**Files:**

- Modify: `src/app/(marketing)/_componente/metadate.ts`
- Create: `src/app/(marketing)/_componente/imagine-distribuire.tsx` (corpul mutat din `opengraph-image.tsx`)
- Create: `src/app/(marketing)/imagine-distribuire.png/route.ts`
- Delete: `src/app/(marketing)/opengraph-image.tsx`
- Modify: `src/app/(marketing)/layout.tsx:50-57`
- Modify: `scripts/checks/rute-publice.mjs`
- Test: `src/app/(marketing)/_componente/metadate.test.ts` (nou)

**Interfaces:**

- Produces: `IMAGINE_DISTRIBUIRE: { url: "/imagine-distribuire.png"; width: 1200; height: 630; alt: string }` exportat din `metadate.ts`; `deseneazaImagineDistribuire(): Promise<ImageResponse>` din `imagine-distribuire.tsx`.

- [ ] **Step 1: Testul care pică**

`src/app/(marketing)/_componente/metadate.test.ts`:

```ts
// src/app/(marketing)/_componente/metadate.test.ts
import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { IMAGINE_DISTRIBUIRE, metadatePagina } from "./metadate";

const MARKETING = join(process.cwd(), "src/app/(marketing)");

describe("metadatePagina", () => {
  it("pune imaginea de distribuire pe fiecare pagină, nu doar pe homepage", () => {
    // Auditul din 2 oct 2026: 47 din 48 de adrese fără `og:image`. `openGraph`
    // din pagină îl înlocuiește pe cel moștenit — imaginea trebuie să fie ÎN el.
    for (const limba of ["ro", "en"] as const) {
      const m = metadatePagina({ titlu: "Probă", descriere: "Descriere.", cale: "/proba", limba });
      expect(m.openGraph?.images, limba).toEqual([IMAGINE_DISTRIBUIRE]);
      expect(m.twitter, limba).toEqual({
        card: "summary_large_image",
        images: [IMAGINE_DISTRIBUIRE.url],
      });
    }
  });

  it("adresa imaginii are o rută care o servește", () => {
    const dosar = join(MARKETING, IMAGINE_DISTRIBUIRE.url.slice(1));
    expect(existsSync(join(dosar, "route.ts"))).toBe(true);
  });

  it("nu mai există o imagine pe convenția de fișier, cu adresă cu hash", () => {
    // Ar dubla imaginea pe `/` și ar aduce înapoi adresa care nu poate fi referită.
    expect(existsSync(join(MARKETING, "opengraph-image.tsx"))).toBe(false);
  });
});
```

- [ ] **Step 2: Rulează testul și vezi-l roșu**

Run: `pnpm vitest run "src/app/(marketing)/_componente/metadate.test.ts"`
Expected: FAIL. `IMAGINE_DISTRIBUIRE` nu e exportat (eroare de import sau `undefined`).

- [ ] **Step 3: Constanta și câmpurile din `metadatePagina`**

În `metadate.ts`, înlocuiește paragraful de la rândurile 20–21 („Imaginea nu intră aici: …") cu:

```ts
 * Imaginea INTRĂ aici. Până pe 2 oct 2026, comentariul de aici spunea că
 * `opengraph-image.tsx` „are prioritate pe tot segmentul". Situl viu arăta
 * contrariul: 47 din 48 de adrese fără `og:image`. Obiectul `openGraph` al
 * paginii îl înlocuiește pe cel moștenit cu totul, imaginea de pe fișier
 * inclusă — același mecanism descris în primul paragraf, a doua oară.
```

Adaugă, după `OG_COMUN`:

```ts
/**
 * Imaginea de distribuire, la o adresă FIXĂ.
 *
 * Nu pe convenția `opengraph-image.tsx`: într-un grup de rute, Next îi pune
 * adresei un hash (`/opengraph-image-pwu6ef`), pe care nicio pagină nu-l poate
 * referi. Ruta e `imagine-distribuire.png/route.ts`; extensia o scoate și din
 * `proxy.ts` (matcher-ul sare peste `.png`).
 */
export const IMAGINE_DISTRIBUIRE = {
  url: "/imagine-distribuire.png",
  width: 1200,
  height: 630,
  alt: "Administrativo — pontaj, concedii și salarizare pentru firme din România",
} as const;
```

În `metadatePagina`, în obiectul întors, adaugă `images` în `openGraph` și o cheie `twitter`:

```ts
    openGraph: {
      ...OG_COMUN,
      ...LOCALE[limba],
      title: titluAbsolut ? titlu : `${titlu}${SUFIX}`,
      description: descriere,
      url: cale,
      images: [IMAGINE_DISTRIBUIRE],
    },
    twitter: { card: "summary_large_image", images: [IMAGINE_DISTRIBUIRE.url] },
```

- [ ] **Step 4: Generatorul și ruta**

Creează `src/app/(marketing)/_componente/imagine-distribuire.tsx`. Mută în el, **neschimbate**, rândurile 7–35 din `opengraph-image.tsx` (comentariul despre font, `UA_TTF`, `CSS_FIRA`, `adaFira`) și constantele `HARTIE`, `CERNEALA`, `SLAB`. Funcția `Imagine` devine:

```tsx
// src/app/(marketing)/_componente/imagine-distribuire.tsx
import { ImageResponse } from "next/og";

import { IMAGINE_DISTRIBUIRE } from "./metadate";

// … comentariul, UA_TTF, CSS_FIRA, adaFira, HARTIE, CERNEALA, SLAB — mutate ca atare …

const size = { width: IMAGINE_DISTRIBUIRE.width, height: IMAGINE_DISTRIBUIRE.height };

export async function deseneazaImagineDistribuire(): Promise<ImageResponse> {
  const font = await adaFira();

  return new ImageResponse(
    // … JSX-ul din `Imagine()`, neschimbat …
  );
}
```

Corpul JSX și al doilea argument (`font === null ? { ...size } : { ...size, fonts: [...] }`) se copiază exact din `opengraph-image.tsx:47-124`.

Creează `src/app/(marketing)/imagine-distribuire.png/route.ts`:

```ts
// src/app/(marketing)/imagine-distribuire.png/route.ts
import { deseneazaImagineDistribuire } from "../_componente/imagine-distribuire";

/** Randată o dată, la build — la fel ca `opengraph-image.tsx`, pe care o înlocuiește. */
export const dynamic = "force-static";

export function GET(): Promise<Response> {
  return deseneazaImagineDistribuire();
}
```

Șterge `src/app/(marketing)/opengraph-image.tsx` (`git rm`).

- [ ] **Step 5: Rezerva din layout**

În `src/app/(marketing)/layout.tsx`, importă `IMAGINE_DISTRIBUIRE` lângă `OG_COMUN` și completează rezerva:

```ts
  openGraph: {
    ...OG_COMUN,
    locale: "ro_RO",
    alternateLocale: ["en_GB"],
    title: RO.meta.titlu,
    description: RO.meta.descriere,
    images: [IMAGINE_DISTRIBUIRE],
  },
  twitter: { card: "summary_large_image", images: [IMAGINE_DISTRIBUIRE.url] },
```

- [ ] **Step 6: Testul trece**

Run: `pnpm vitest run "src/app/(marketing)/_componente/metadate.test.ts" && pnpm typecheck && pnpm check:server`
Expected: 3 teste PASS, tsc fără erori.

- [ ] **Step 7: Poarta pe situl viu cere și imaginea**

În `scripts/checks/rute-publice.mjs`:

1. În antet, sub „── CE CERE ──", adaugă paragraful:

```js
// Din 2 oct 2026, și un `<meta property="og:image">` pe fiecare adresă, plus
// imaginea însăși (200, `image/png`). Auditul din ziua aceea a găsit 47 din 48
// de pagini fără imagine de distribuire — o regresie pe care niciun test de
// unitate n-o vedea, fiindcă vedeau ce DECLARĂ paginile, nu ce ajunge în HTML.
```

2. În `cere()`, adaugă câmpul în obiectul întors:

```js
    faraImagine: !/<meta[^>]+property="og:image"[^>]+content="[^"]+"/i.test(corp),
```

3. Filtrul de eșecuri devine:

```js
const rele = rezultate.filter(
  (r) => r.status !== 200 || (verificaIndexarea && r.noindex) || r.faraImagine,
);
```

iar eticheta: `` `${r.status}${r.noindex ? "+noindex" : ""}${r.faraImagine ? "+fara-og-image" : ""}(${r.cache})` ``.

4. Înainte de bucla pe adrese, verifică imaginea o dată:

```js
const imagine = await fetch(`${baza}/imagine-distribuire.png`, { headers: antete });
if (!imagine.ok || !(imagine.headers.get("content-type") ?? "").startsWith("image/png")) {
  console.error(
    `✗ ${baza}/imagine-distribuire.png a răspuns ${imagine.status} ` +
      `(${imagine.headers.get("content-type") ?? "fără content-type"}).`,
  );
  process.exit(1);
}
```

5. Mesajul de reușită: `toate 200, cu og:image` în loc de `toate 200`.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(marketing)/_componente/metadate.ts" "src/app/(marketing)/_componente/metadate.test.ts" \
  "src/app/(marketing)/_componente/imagine-distribuire.tsx" "src/app/(marketing)/imagine-distribuire.png/route.ts" \
  "src/app/(marketing)/layout.tsx" scripts/checks/rute-publice.mjs
git rm -q "src/app/(marketing)/opengraph-image.tsx"
git commit --only -m "fix(seo): imaginea de distribuire pe toate cele 48 de pagini, la adresă fixă" -- <căile de mai sus>
```

---

### Task 2: `/preturi` — drumul spre ofertă, titlul cu prețul, firimiturile

**Files:**

- Modify: `src/content/landing/tipuri.ts:271`
- Modify: `src/content/landing/ro.ts:864-865`, `src/content/landing/en.ts:819-820`
- Modify: `src/app/(marketing)/_componente/pagina-preturi.tsx:73-75`
- Modify: `src/app/(marketing)/_componente/benzi/comercial.tsx:255`
- Modify: `src/app/(marketing)/preturi/page.tsx`
- Modify: `src/app/(marketing)/module/page.tsx:40`, `src/app/(marketing)/intrebari/page.tsx:30`
- Test: `src/content/landing/continut.test.ts`

**Interfaces:**

- Produces: `TextLanding["preturi"]["pestePrag"]: Readonly<{ text: string; legatura: Legatura }>` (înainte: `string`).

- [ ] **Step 1: Testele care pică**

La finalul `describe`-ului principal din `continut.test.ts` (importurile `readFileSync`, `RO`, `EN` există deja în fișier; dacă `EN` lipsește, se importă din `./en`):

```ts
it("peste pragul de angajați, pagina de prețuri duce spre o ofertă", async () => {
  // Auditul din 2 oct 2026: „cere o ofertă" era text simplu. Firmele cu 21–50
  // de angajați — jumătate din publicul declarat — nu aveau nici preț, nici drum.
  const { ADRESA_SITE } = await import("./contact");
  const { intrariSitemap } = await import("./harta");
  const dinSitemap = new Set(intrariSitemap().map((i) => i.url.replace(ADRESA_SITE, "") || "/"));
  for (const text of [RO, EN]) {
    expect(dinSitemap.has(text.preturi.pestePrag.legatura.href)).toBe(true);
  }
});

it("titlul paginii de prețuri spune prețul și pragul", async () => {
  const { MONEDA, PRAG_ANGAJATI, PRET_NUCLEU } = await import("./preturi");
  const sursa = readFileSync("src/app/(marketing)/preturi/page.tsx", "utf8");
  const titlu = /\btitlu: "([^"]+)"/.exec(sursa)?.[1] ?? "";
  expect(titlu).toContain(`${PRET_NUCLEU} ${MONEDA}`);
  expect(titlu).toContain(String(PRAG_ANGAJATI));
});
```

- [ ] **Step 2: Vezi-le roșii**

Run: `pnpm vitest run src/content/landing/continut.test.ts -t "prețuri"`
Expected: FAIL. `legatura` e `undefined` pe un string; titlul e `"Prețuri"`.

- [ ] **Step 3: Tipul și textele**

`tipuri.ts:271`: `pestePrag: Readonly<{ text: string; legatura: Legatura }>;`

`ro.ts`:

```ts
    pestePrag: {
      text: "Peste 20 de angajați prețul crește în trepte.",
      legatura: { eticheta: "Cere o ofertă pentru câți oameni ai", href: "/cere-demo" },
    },
```

`en.ts`:

```ts
    pestePrag: {
      text: "Above 20 employees the price rises in steps.",
      legatura: { eticheta: "Ask for a quote for your headcount", href: "/cere-demo" },
    },
```

- [ ] **Step 4: Randarea, în ambele locuri**

În `pagina-preturi.tsx` (rândurile 73–75) și în `benzi/comercial.tsx:255`, paragraful devine (clasele rămân cele existente pe `<p>`):

```tsx
<p className="text-mk-text-slab text-[0.9375rem] leading-[1.6]">
  {text.preturi.pestePrag.text}{" "}
  <Link
    href={text.preturi.pestePrag.legatura.href}
    data-umami-event="cta-oferta-peste-prag"
    className="text-mk-text underline underline-offset-4"
  >
    {text.preturi.pestePrag.legatura.eticheta}
  </Link>
  .
</p>
```

Ambele fișiere importă deja `Link` din `next/link`.

- [ ] **Step 5: Titlul și firimiturile de pe `/preturi`**

`preturi/page.tsx`:

```ts
export const metadata: Metadata = metadatePagina({
  // Prețul în titlu: e primul lucru căutat, iar „Prețuri · Administrativo" nu-l spunea.
  // Literal, nu șablon — testul de lungime citește doar literale; testul de lângă
  // verifică faptul că cifrele de aici sunt cele din `preturi.ts`.
  titlu: "Prețuri: 149 lei pe lună, până la 20 de angajați",
  …
```

În corpul paginii, primul copil din `<Cadru>`:

```tsx
<JsonLd
  date={nodFirimituri([
    { eticheta: "Acasă", href: "/" },
    { eticheta: "Prețuri", href: "/preturi" },
  ])}
/>
```

cu importurile `import { JsonLd } from "../_componente/json-ld";` și `import { nodFirimituri } from "../_componente/noduri-json-ld";`.

`module/page.tsx:40`:

```tsx
<AntetSecundar
  text={RO.pagini.module}
  firimituri={[
    { eticheta: "Acasă", href: "/" },
    { eticheta: "Module", href: "/module" },
  ]}
/>
```

`intrebari/page.tsx:30`, la fel, cu `{ eticheta: "Întrebări", href: "/intrebari" }`.

- [ ] **Step 6: Verdele**

Run: `pnpm vitest run src/content/landing/continut.test.ts && pnpm typecheck`
Expected: PASS (inclusiv testul de lungime a titlurilor: 65/65).

- [ ] **Step 7: Commit**

`git commit --only -m "fix(seo): /preturi duce spre ofertă peste 20 de angajați; prețul în titlu" -- <fișierele din Task 2>`

---

### Task 3: Fără chei interne pe paginile publice

`evaluations:read` în tabelele de roluri (18 pagini), `payroll`/`attendance` lângă numele modulelor (`/preturi`, `/`, vecinii de pe fiecare modul). Datele rămân, inclusiv testul care leagă fiecare permisiune de aplicație (`continut.test.ts:199`). Se schimbă doar ce se afișează. În registre, coloana mono primește slug-ul românesc, care e și adresa paginii.

**Files:**

- Modify: `src/app/(marketing)/module/[modul]/page.tsx:304-306` și `:402`
- Modify: `src/app/(marketing)/_componente/pagina-preturi.tsx:119-121`
- Modify: `src/app/(marketing)/_componente/benzi/produs.tsx:84`
- Test: `src/content/landing/continut.test.ts`

- [ ] **Step 1: Testul care pică**

```ts
it("paginile publice nu afișează chei interne de modul sau de permisiune", () => {
  // Auditul din 2 oct 2026: `evaluations:read` și `payroll` pe pagini citite de un
  // patron de firmă mică. Cheia rămâne în date; pe ecran merge slug-ul românesc.
  const afisari = fisiere("src/app/(marketing)", [".tsx"]).flatMap((f) =>
    [...readFileSync(f, "utf8").matchAll(/(?:>\s*\{|cod=\{)(?:modul|actiune|vecin)\.cheie\}/g)].map(
      (m) => `${f}: ${m[0]}`,
    ),
  );
  expect(afisari).toEqual([]);
});
```

(`fisiere(radacina, sufixe)` e helperul de la `continut.test.ts:25`; potrivește după sufix.)

- [ ] **Step 2: Vezi-l roșu**

Run: `pnpm vitest run src/content/landing/continut.test.ts -t "chei interne"`
Expected: FAIL, cu patru potriviri (module page ×2, pagina-preturi, produs).

- [ ] **Step 3: Schimbările**

- `module/[modul]/page.tsx:304-306`: șterge `<span …>{actiune.cheie}</span>` din `<th>`.
- `module/[modul]/page.tsx:402`: `cod={slugModul(vecin.cheie)}` (`slugModul` e deja importat).
- `pagina-preturi.tsx:120`: `{slugModul(modul.cheie)}`, cu `import { slugModul } from "@/content/landing/slug-module";`.
- `benzi/produs.tsx:84`: `cod={slugModul(modul.cheie)}`, cu același import dacă lipsește.

- [ ] **Step 4: Verdele**

Run: `pnpm vitest run src/content/landing/continut.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit --only -m "fix(marketing): fără chei interne pe paginile publice — slug-ul românesc în registre" -- <fișierele din Task 3>`

---

### Task 4: H1 descriptiv pe fiecare modul; titluri care nu se canibalizează

**Files:**

- Modify: `src/content/landing/fise-module.ts` (tipul de la `:65` și cele 19 fișe)
- Test: `src/content/landing/continut.test.ts`

- [ ] **Step 1: Testele care pică**

```ts
it("fiecare modul are un H1 al lui, mai mult decât numele din meniu", async () => {
  // „Pontaj", „Anunțuri", „Ticketing IT" — un cuvânt nu spune ce oferă pagina.
  const { FISE } = await import("./fise-module");
  const titluri = new Map(
    RO.module.grupuri.flatMap((g) => g.module).map((m) => [m.cheie, m.titlu]),
  );
  for (const f of FISE) {
    expect(f.titluH1.length, f.cheie).toBeLessThanOrEqual(40);
    expect(f.titluH1, f.cheie).not.toBe(titluri.get(f.cheie));
  }
  expect(new Set(FISE.map((f) => f.titluH1)).size).toBe(FISE.length);
});

it("titlurile de modul nu concurează cu unealta și cu ghidul vecin", async () => {
  // SERP: „foaie de pontaj" aparține uneltei; „REGES-Online: …" aparține ghidului.
  const { fisaModulului } = await import("./fise-module");
  expect(fisaModulului("attendance")?.titluPagina).not.toMatch(/foaie/i);
  expect(fisaModulului("reges")?.titluPagina).toMatch(/^Program REGES/);
  expect(fisaModulului("per_diem")?.titluPagina).not.toMatch(/calcul/i);
});
```

- [ ] **Step 2: Vezi-le roșii**

Run: `pnpm vitest run src/content/landing/continut.test.ts -t "modul"`
Expected: FAIL (`titluH1` lipsește pe 18 fișe; titlurile vechi).

- [ ] **Step 3: Tipul**

`fise-module.ts:65`: `titluH1?: string;` → `titluH1: string;`. Comentariul de deasupra se completează: „Obligatoriu din 2 oct 2026 — numele din meniu e un cuvânt."

- [ ] **Step 4: Valorile**

După `titluPagina` din fiecare fișă, `titluH1` (măsurate: maximum 35 de caractere). Trei fișe își schimbă și `titluPagina` (≤ 65 cu sufixul, măsurat):

| `cheie`         | `titluH1`                           | `titluPagina` nou                              |
| --------------- | ----------------------------------- | ---------------------------------------------- |
| attendance      | Program de pontaj                   | Program de pontaj pentru angajați, cu aprobare |
| ssm             | Evidența SSM și PSI                 | —                                              |
| payroll         | (are deja)                          | —                                              |
| fleet           | Evidența parcului auto              | —                                              |
| per_diem        | Deplasări și diurne, până la decont | Program de diurne: deplasări, etape și decont  |
| leave           | Program de concedii                 | —                                              |
| onboarding      | Integrarea angajaților noi          | —                                              |
| courses         | Cursuri interne pentru angajați     | —                                              |
| reges           | Transmitere în REGES-Online         | Program REGES-Online: transmitere automată     |
| evaluations     | Evaluarea angajaților               | —                                              |
| kpi             | KPI-uri pe angajat                  | —                                              |
| maintenance     | Mentenanță și sesizări              | —                                              |
| inventory       | Inventarul firmei, pe angajat       | —                                              |
| ticketing       | Ticketing intern                    | —                                              |
| announcements   | Anunțuri interne cu confirmare      | —                                              |
| employee_portal | Portalul angajatului                | —                                              |
| rapoarte        | Rapoarte HR                         | —                                              |
| nucleu          | Organizație, roluri și audit        | —                                              |
| asistent        | Asistent AI pentru HR               | —                                              |

În fiecare fișă atinsă, `actualizat` devine data commit-ului (`"2026-10-02"`, sau ziua execuției): H1-ul și titlul sunt conținut, iar data ajunge în `lastmod`.

Lângă `titluPagina` din `attendance`, comentariul:

```ts
// Fără „foaie lunară" din 2 oct 2026: interogarea „foaie de pontaj" o ține
// `/unelte/foaie-de-pontaj`; două pagini pe același termen se împart.
```

- [ ] **Step 5: Verdele**

Run: `pnpm vitest run src/content/landing/ && pnpm typecheck`
Expected: PASS, inclusiv „descrierile fișelor nu se termină toate în aceeași propoziție" și lungimea titlurilor.

- [ ] **Step 6: Commit**

`git commit --only -m "feat(seo): H1 descriptiv pe fiecare modul; pontaj, REGES și diurnă fără titluri concurente" -- src/content/landing/fise-module.ts src/content/landing/continut.test.ts`

---

### Task 5: Legăturile interne — un tabel, o componentă

**Files:**

- Create: `src/content/landing/legaturi.ts`
- Create: `src/app/(marketing)/_componente/pe-acelasi-subiect.tsx`
- Modify: `src/app/(marketing)/module/[modul]/page.tsx:358-372`, `src/app/(marketing)/_componente/pagina-lege.tsx:228-241` (folosesc componenta)
- Modify: `src/app/(marketing)/ghid/page.tsx:47-68,91-103`
- Modify: `src/app/(marketing)/unelte/cerere-concediu-de-odihna/page.tsx`, `unelte/foaie-de-pontaj/page.tsx`, `comparatie/excel/page.tsx`, `pontaj-pe-telefon/page.tsx`, `domenii/[domeniu]/page.tsx`
- Modify: `src/content/legal/diurna.ts:196-200`, `src/content/legal/control-itm.ts:174-177`, `src/content/landing/fise-module.ts:576-581`
- Test: `src/content/landing/continut.test.ts`

**Interfaces:**

- Produces: `LEGATURI_CONEXE: Readonly<Record<string, readonly Legatura[]>>` (cheia = calea paginii), `DE_UNDE_GHID: readonly Readonly<{ titlu: string; text: string; href: string }>[]`, componenta `PeAcelasiSubiect({ legaturi }: { legaturi: readonly Legatura[] | undefined })`.

- [ ] **Step 1: Testul care pică**

```ts
it("legăturile conexe ale paginilor duc spre pagini din sitemap, nu spre ele însele", async () => {
  // Auditul din 2 oct 2026: unelte cu doar firimituri, `/pontaj-pe-telefon` fără
  // nicio legătură în text, cardurile „De unde începi" fără legătură deloc.
  const { ADRESA_SITE } = await import("./contact");
  const { intrariSitemap } = await import("./harta");
  const { DOMENII } = await import("./domenii");
  const { DE_UNDE_GHID, LEGATURI_CONEXE } = await import("./legaturi");
  const dinSitemap = new Set(intrariSitemap().map((i) => i.url.replace(ADRESA_SITE, "") || "/"));
  for (const [cale, legaturi] of Object.entries(LEGATURI_CONEXE)) {
    expect(dinSitemap.has(cale), `${cale} nu e în sitemap`).toBe(true);
    expect(legaturi.length, cale).toBeGreaterThanOrEqual(2);
    for (const l of legaturi) {
      expect(dinSitemap.has(l.href), `${cale}: ${l.href}`).toBe(true);
      expect(l.href, cale).not.toBe(cale);
    }
    // Tabelul nu ține loc de randare: pagina trebuie să-și ceară rândul.
    if (!cale.startsWith("/domenii/")) {
      const pagina = readFileSync(`src/app/(marketing)${cale}/page.tsx`, "utf8");
      expect(pagina, cale).toContain(`LEGATURI_CONEXE["${cale}"]`);
    }
  }
  for (const d of DOMENII) expect(LEGATURI_CONEXE[`/domenii/${d.slug}`], d.slug).toBeDefined();
  expect(DE_UNDE_GHID.length).toBe(5);
  for (const d of DE_UNDE_GHID) expect(dinSitemap.has(d.href), d.titlu).toBe(true);
});
```

- [ ] **Step 2: Vezi-l roșu**

Run: `pnpm vitest run src/content/landing/continut.test.ts -t "legăturile conexe ale paginilor"`
Expected: FAIL, `Cannot find module './legaturi'`.

- [ ] **Step 3: Tabelul**

```ts
// src/content/landing/legaturi.ts
import type { Legatura } from "./tipuri";

/**
 * Legăturile „Pe același subiect" ale paginilor care nu au un fișier de conținut
 * propriu cu așa ceva (fișele au `ghiduri`, paginile-lege `legaturiConexe`).
 *
 * Cheia e calea paginii. Testul din `continut.test.ts` cere ca fiecare cale și
 * fiecare destinație să fie în sitemap și ca pagina să-și randeze rândul.
 * Ancorele spun termenul pe care pagina-destinație vrea să-l țină.
 */
export const LEGATURI_CONEXE: Readonly<Record<string, readonly Legatura[]>> = {
  "/unelte/cerere-concediu-de-odihna": [
    { eticheta: "Concediul de odihnă: zile, programare, report", href: "/ghid/concediu-de-odihna" },
    { eticheta: "Program de concedii: cerere, aprobare și sold", href: "/module/concedii" },
  ],
  "/unelte/foaie-de-pontaj": [
    { eticheta: "Program de pontaj cu ora de început și de sfârșit", href: "/module/pontaj" },
    { eticheta: "Pontaj de pe telefon, fără instalare", href: "/pontaj-pe-telefon" },
  ],
  "/comparatie/excel": [
    { eticheta: "Program de pontaj", href: "/module/pontaj" },
    { eticheta: "Foaie de pontaj lunar, gratuită", href: "/unelte/foaie-de-pontaj" },
    { eticheta: "Ce cere art. 119 la evidența orelor", href: "/evidenta-orelor-de-munca" },
  ],
  "/pontaj-pe-telefon": [
    { eticheta: "Program de pontaj", href: "/module/pontaj" },
    { eticheta: "Ce cere art. 119 la evidența orelor", href: "/evidenta-orelor-de-munca" },
    { eticheta: "Foaie de pontaj lunar, gratuită", href: "/unelte/foaie-de-pontaj" },
  ],
  "/domenii/constructii": [
    { eticheta: "Pontaj de pe telefon, la punctul de lucru", href: "/pontaj-pe-telefon" },
    { eticheta: "Ce se cere la un control ITM", href: "/ghid/control-itm" },
  ],
  "/domenii/productie": [
    { eticheta: "Ce se cere la un control ITM", href: "/ghid/control-itm" },
    { eticheta: "REGES-ONLINE: termene și amenzi", href: "/reges-online" },
  ],
  "/domenii/transport": [
    { eticheta: "Diurna: cele două plafoane neimpozabile", href: "/ghid/diurna" },
    { eticheta: "Program de diurne și deplasări", href: "/module/diurna" },
  ],
  "/domenii/servicii": [
    { eticheta: "Concediul de odihnă: zile, programare, report", href: "/ghid/concediu-de-odihna" },
    { eticheta: "Foaie de pontaj lunar, gratuită", href: "/unelte/foaie-de-pontaj" },
  ],
};

/** Cardurile „De unde începi" de pe `/ghid`, fiecare spre ghidul lui. */
export const DE_UNDE_GHID = [
  {
    titlu: "Ai primit o înștiințare de control",
    text: "Începe cu ghidul de control ITM: ce documente se cer, în ce ordine se verifică și ce se poate pregăti în ajun — plus ce nu se mai poate.",
    href: "/ghid/control-itm",
  },
  {
    titlu: "Ai angajat pe cineva săptămâna asta",
    text: "REGES-ONLINE are termene pe zile lucrătoare, diferite pentru angajare, suspendare și încetare. Ghidul le ia pe rând, cu temeiul lângă fiecare.",
    href: "/reges-online",
  },
  {
    titlu: "Ții pontajul în fișiere de calcul",
    text: "Evidența orelor cere ora de începere și ora de sfârșit, zilnic, la locul de muncă. Ghidul spune ce înseamnă asta în practică și cât costă absența ei.",
    href: "/evidenta-orelor-de-munca",
  },
  {
    titlu: "Cineva ți-a cerut zilele rămase din anul trecut",
    text: "Ghidul de concediu de odihnă ia termenul de report de 18 luni, decizia ÎCCJ din august 2026 despre zilele rămase după el, și calculul indemnizației pe ultimele trei luni.",
    href: "/ghid/concediu-de-odihna",
  },
  {
    titlu: "Trimiți oameni în deplasare",
    text: "Diurna are două plafoane neimpozabile, nu unul, iar al doilea se calculează separat pentru fiecare lună. Ghidul le ia pe rând, cu formula scrisă în lege.",
    href: "/ghid/diurna",
  },
] as const;
```

Textele sunt cele din `ghid/page.tsx:47-68`, neschimbate; s-a adăugat doar `href`.

- [ ] **Step 4: Componenta**

```tsx
// src/app/(marketing)/_componente/pe-acelasi-subiect.tsx
import Link from "next/link";

import type { Legatura } from "@/content/landing/tipuri";

/**
 * „Pe același subiect" — legăturile interne de la finalul unei pagini.
 *
 * Existase de două ori, copiată: în pagina de modul și în pagina-lege. A treia
 * copie (uneltele, domeniile, pontajul pe telefon) a fost momentul extragerii.
 */
export function PeAcelasiSubiect({ legaturi }: { legaturi: readonly Legatura[] | undefined }) {
  if (legaturi === undefined || legaturi.length === 0) return null;
  return (
    <div className="mt-10">
      <p className="font-mk-date text-mk-text-slab text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
        Pe același subiect
      </p>
      <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
        {legaturi.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-[0.9375rem] underline underline-offset-4">
              {l.eticheta}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Înlocuiește blocurile copiate:

- `module/[modul]/page.tsx:358-372` → `<PeAcelasiSubiect legaturi={fisa.ghiduri} />` (în aceeași poziție, în interiorul condiției pe `fisa` dacă există una exterioară).
- `pagina-lege.tsx:228-241` → `<PeAcelasiSubiect legaturi={text.legaturiConexe} />`.

Dacă tipul lui `fisa.ghiduri` nu e `Legatura[]` (are aceleași chei `href`/`eticheta`), e compatibil structural; dacă tsc obiectează la `readonly`, prop-ul acceptă deja `readonly Legatura[]`.

- [ ] **Step 5: Paginile își cer rândul**

Import comun pe fiecare: `import { LEGATURI_CONEXE } from "@/content/landing/legaturi";` și `import { PeAcelasiSubiect } from "<cale relativă>/_componente/pe-acelasi-subiect";`.

- `unelte/cerere-concediu-de-odihna/page.tsx`: în blocul `<div data-tipar="ascunde">`, în `Banda` „Ce spune legea", după `div`-ul cu cele trei reguli: `<PeAcelasiSubiect legaturi={LEGATURI_CONEXE["/unelte/cerere-concediu-de-odihna"]} />`. Rămâne ascuns la tipărire.
- `unelte/foaie-de-pontaj/page.tsx`: în ultima `Banda`, după `div`-ul cu butoane (`data-tipar="ascunde"`, ~rândul 317): `<div data-tipar="ascunde"><PeAcelasiSubiect legaturi={LEGATURI_CONEXE["/unelte/foaie-de-pontaj"]} /></div>`.
- `comparatie/excel/page.tsx`: după `div`-ul cu butoane din ultima `Banda`: `<PeAcelasiSubiect legaturi={LEGATURI_CONEXE["/comparatie/excel"]} />`.
- `pontaj-pe-telefon/page.tsx`: înainte de `</Cadru>`, după `<BandaPontajViitor … />`:
  ```tsx
  <Banda inaltime="scurta">
    <PeAcelasiSubiect legaturi={LEGATURI_CONEXE["/pontaj-pe-telefon"]} />
  </Banda>
  ```
- `domenii/[domeniu]/page.tsx`: după `div`-ul cu butoane din ultima `Banda`: `<PeAcelasiSubiect legaturi={LEGATURI_CONEXE[\`/domenii/${d.slug}\`]} />`.
- `ghid/page.tsx`: șterge `DE_UNDE`, importă `DE_UNDE_GHID`, iar `<h3>` din buclă devine:

  ```tsx
  <h3 className="font-mk-display text-[1rem] leading-[1.25] font-semibold md:col-span-4">
    <Link href={d.href} className="underline underline-offset-4">
      {d.titlu}
    </Link>
  </h3>
  ```

  (cu `import Link from "next/link";` dacă lipsește).

- [ ] **Step 6: Legăturile din conținutul existent**

- `src/content/legal/diurna.ts`, la `legaturiConexe`, adaugă:
  `{ eticheta: "Program de salarizare", href: "/module/salarizare" },` și
  `{ eticheta: "Pentru contabili: aceleași date, fără exporturi", href: "/pentru-contabili" },`
- `src/content/legal/control-itm.ts`, la `legaturiConexe`, adaugă:
  `{ eticheta: "Concediul de odihnă: zile, programare, report", href: "/ghid/concediu-de-odihna" },` și
  `{ eticheta: "Transmiterea în REGES-Online, din aplicație", href: "/module/reges" },`
- `fise-module.ts`, fișa `leave`, la `ghiduri`, adaugă
  `{ href: "/unelte/cerere-concediu-de-odihna", eticheta: "Cerere de concediu cu zilele calculate" },`
  și mută `actualizat` pe data commit-ului.

- [ ] **Step 7: Verdele**

Run: `pnpm vitest run src/content/landing/ && pnpm typecheck && pnpm lint`
Expected: PASS, inclusiv testul vechi „legăturile din fișe și din paginile-lege duc spre pagini din sitemap".

- [ ] **Step 8: Commit**

`git commit --only -m "feat(seo): legături interne pe unelte, domenii, pontajul pe telefon și cardurile din /ghid" -- <fișierele din Task 5>`

---

### Task 6: Retușuri — bara de cookie-uri pe telefon, „cele 60 de zile"

**Files:**

- Modify: `src/app/(marketing)/_componente/bara-consimtamant.tsx:75-96`
- Modify: `src/app/(marketing)/ghid/diurna/page.tsx:21`

- [ ] **Step 1: Măsoară înainte**

Pornește `next dev -H 127.0.0.1` și măsoară înălțimea barei la 390×844 cu playwright-core + headless_shell din cache (memoria `erp-verificare-vizuala-headless`):

```js
// scratchpad/bara.mjs
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: process.env.HEADLESS_SHELL });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto("http://127.0.0.1:3000/module/pontaj");
const h = await p
  .locator('[aria-label="Cookie-uri de analiză"]')
  .evaluate((e) => e.getBoundingClientRect().height);
console.log("înălțimea barei:", h);
await b.close();
```

Expected: ~180 px (măsurat de audit).

- [ ] **Step 2: Compactarea, doar sub `sm`**

- `div`-ul interior: `gap-y-3 … py-4` → `gap-y-2 sm:gap-y-3 … py-3 sm:py-4`.
- `<p>`: `text-[0.875rem]` → `text-[0.8125rem] sm:text-[0.875rem]`; textul devine
  „Folosim cookie-uri de analiză ca să știm ce pagini sunt citite. Nu sunt necesare, iar dacă refuzi nu se schimbă nimic pentru tine." (fraza a doua scurtată; legătura spre politică rămâne).
- Cele două butoane: `h-12` → `h-11 sm:h-12` (44 px, pragul de țintă tactilă), plus `flex-1 sm:flex-none` ca să împartă rândul pe telefon; containerul lor `flex gap-3` → `flex w-full gap-3 sm:w-auto`.

- [ ] **Step 3: Măsoară după**

Rulează din nou scriptul. Expected: ≤ 145 px. Dacă trece de 145, scoate și `min-w-[18rem]` de pe `<p>` sub `sm` și remăsoară. Ținta de 44 px pe butoane nu se negociază.

- [ ] **Step 4: Gramatica**

`ghid/diurna/page.tsx:21`: „cei 60 de zile" → „cele 60 de zile".

- [ ] **Step 5: Commit**

`git commit --only -m "fix(marketing): bara de cookie-uri mai scundă pe telefon; „cele 60 de zile"" -- <cele două fișiere>`

---

### Task 7: IndexNow — Bing și Yandex află de pagini la fiecare deploy

Brave are 0 pagini, Bing e neconfirmat. IndexNow nu cere cont: o cheie publică servită pe domeniu și un POST cu lista de adrese.

**Files:**

- Create: `public/<CHEIE>.txt`
- Create: `scripts/indexnow.mjs`
- Modify: `ops/01-main.sh` (după poarta `rute-publice.mjs`, ~rândul 98)
- Modify: `package.json` (scriptul `seo:indexnow`)

- [ ] **Step 1: Cheia**

Run: `openssl rand -hex 16`. Notează rezultatul ca `<CHEIE>` (32 de caractere hex). Nu e un secret: specificația IndexNow o vrea publică.

Creează `public/<CHEIE>.txt` cu conținutul exact `<CHEIE>` (fără linie nouă finală nu e obligatoriu; scriptul face `trim()`).

- [ ] **Step 2: Scriptul**

```js
#!/usr/bin/env node
// scripts/indexnow.mjs
//
// Anunță Bing, Yandex și restul rețelei IndexNow că adresele din sitemap s-au
// schimbat. Rulează după fiecare deploy de producție, din `ops/01-main.sh`.
//
// ── DE CE ──────────────────────────────────────────────────────────────────
// Auditul din 2 oct 2026: Google avea 48/48 de pagini, Brave 0 (Brave
// alimentează căutarea mai multor asistenți AI), Bing neconfirmat. Search
// Console nu ajunge la ei; IndexNow da, fără cont.
//
// ── CE VERIFICĂ ÎNAINTE ────────────────────────────────────────────────────
// Că fișierul cheii e servit pe domeniu și conține cheia. Fără el, IndexNow
// răspunde 403 — mai bine aflăm de aici, cu un mesaj clar.
//
// Utilizare:
//   node scripts/indexnow.mjs [baza] [--doar-verifica]
//   baza implicită: https://administrativo.ro. Doar producția: adresele din
//   sitemap poartă domeniul de producție.

const CHEIE = "<CHEIE>";

const argumente = process.argv.slice(2);
const doarVerifica = argumente.includes("--doar-verifica");
const baza = (argumente.find((a) => !a.startsWith("--")) ?? "https://administrativo.ro").replace(
  /\/$/,
  "",
);
const antete = { "user-agent": "administrativo-indexnow/1" };

const fisier = await fetch(`${baza}/${CHEIE}.txt`, { headers: antete });
const continut = fisier.ok ? (await fisier.text()).trim() : "";
if (continut !== CHEIE) {
  console.error(
    `✗ ${baza}/${CHEIE}.txt a răspuns ${fisier.status} și nu conține cheia. ` +
      "Fișierul e în `public/`; dacă lipsește de pe server, imaginea e veche.",
  );
  process.exit(1);
}

const harta = await fetch(`${baza}/sitemap.xml`, { headers: antete });
if (!harta.ok) {
  console.error(`✗ ${baza}/sitemap.xml a răspuns ${harta.status}.`);
  process.exit(1);
}
const adrese = [...(await harta.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (adrese.length === 0) {
  console.error("✗ sitemap.xml nu conține nicio adresă.");
  process.exit(1);
}

if (doarVerifica) {
  console.log(`✓ Cheia e servită; ${adrese.length} adrese ar fi trimise. Nu s-a trimis nimic.`);
  process.exit(0);
}

const raspuns = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { ...antete, "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: new URL(baza).host,
    key: CHEIE,
    keyLocation: `${baza}/${CHEIE}.txt`,
    urlList: adrese,
  }),
});
// 200 = primit și verificat; 202 = primit, cheia se verifică ulterior.
if (raspuns.status !== 200 && raspuns.status !== 202) {
  console.error(`✗ IndexNow a răspuns ${raspuns.status}: ${await raspuns.text()}`);
  process.exit(1);
}
console.log(`✓ IndexNow: ${adrese.length} adrese trimise (${raspuns.status}).`);
```

`package.json`, lângă `check:rute-vii`: `"seo:indexnow": "node scripts/indexnow.mjs",`.

- [ ] **Step 3: Cârligul din deploy**

`ops/01-main.sh`, după blocul `rute-publice.mjs` (înainte de `success "Producția e activă…"`):

```bash
  # IndexNow: Bing și Yandex află de pagini fără să le aștepte crawler-ul. O
  # notificare, nu o poartă — un eșec aici nu face deploy-ul invalid.
  node "$ADMINISTRATIVO_ROOT/scripts/indexnow.mjs" "https://${ADM_DOMAIN}" \
    || warn "IndexNow n-a primit lista de adrese; deploy-ul rămâne valid."
```

- [ ] **Step 4: Proxy-ul lasă fișierul să treacă**

Cu `next dev -H 127.0.0.1` pornit:
Run: `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://127.0.0.1:3000/<CHEIE>.txt`
Expected: `200` și fără redirect. Dacă vine 307 spre `/autentificare`, adaugă `[0-9a-f]{32}\.txt` în lista de excluderi din `matcher` (`src/proxy.ts:204`), cu un rând în comentariul de deasupra.

Run: `node scripts/indexnow.mjs http://127.0.0.1:3000 --doar-verifica`
Expected: `✓ Cheia e servită; 48 adrese ar fi trimise.`

- [ ] **Step 5: Commit**

`git commit --only -m "feat(seo): IndexNow la fiecare deploy de producție" -- public/<CHEIE>.txt scripts/indexnow.mjs ops/01-main.sh package.json [src/proxy.ts]`

---

### Task 8: Verificarea întreagă, `lastmod`, push, deploy

- [ ] **Step 1: Lanțul**

Run: `pnpm typecheck && pnpm check:server && pnpm lint && pnpm format:check && pnpm test`
Expected: totul verde. Fără `pnpm build`.

- [ ] **Step 2: HTML-ul local, nu doar declarațiile**

Cu `next dev -H 127.0.0.1` (la oprire se șterge `.next/dev/types/validator.ts`, conform memoriei `erp-next-dev-corupe-validator`):

```bash
for p in / /module/pontaj /ghid/control-itm /preturi /en /unelte/foaie-de-pontaj; do
  printf "%-28s " "$p"
  curl -s "http://127.0.0.1:3000$p" | grep -c 'property="og:image"'
done
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://127.0.0.1:3000/imagine-distribuire.png
curl -s http://127.0.0.1:3000/module/evaluari | grep -oE '[a-z_]+:(read|create|update|approve|delete)' | head
curl -s http://127.0.0.1:3000/preturi | grep -o 'href="/cere-demo"' | head -1
```

Expected: `1` pe fiecare pagină; `200 image/png`; nicio cheie de permisiune; legătura spre `/cere-demo` prezentă.

- [ ] **Step 3: `lastmod`**

După commit-urile de mai sus: `pnpm check:lastmod`. Pentru fiecare pagină raportată ca învechită, mută data în `src/content/landing/harta.ts` (sau `actualizat` din fișa ei) pe data commit-ului care a schimbat-o. Commit separat: `fix(seo): lastmod după reparațiile din 2 oct`.

- [ ] **Step 4: Starea în raportul de audit**

În `docs/comercial/audit-seo-2026-10-02.md`, sub „High — de reparat", adaugă o coloană sau o secțiune „Reparate", cu hash-ul fiecărui commit și poarta care o ține (testul sau `rute-publice.mjs`).

- [ ] **Step 5: Push**

```bash
git status --short -- <căile mele>
git fetch origin main
git diff --name-only HEAD origin/main
git merge origin/main
git push origin main
```

Staging se face singur din CI. `staging.yml:133` rulează `rute-publice.mjs` pe staging, deci noua cerință de `og:image` se verifică acolo, pe un site viu. Verifică **durata** rulării, nu doar concluzia (memoria `erp-workflow-verde-prin-sarire`: sub 30 s = a sărit).

- [ ] **Step 6: Producția — se oprește aici și se cere confirmarea lui Miro**

După „da": `./administrativo.sh prod`. Deploy-ul rulează singur `rute-publice.mjs` (cu `og:image`) și apoi IndexNow. După aceea, LinkedIn Post Inspector pe `/module/pontaj`, ca să golească cache-ul vechi fără imagine.

---

## În afara codului — la Miro

| #   | Ce                                       | Unde                                                                                                              |
| --- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | Oprește **Email Obfuscation**            | Cloudflare → Scrape Shield. Scoate scriptul care blochează randarea (450–480 ms pe mobil) și `[email protected]`. |
| 2   | Măsoară din nou LCP-ul mobil după #1     | Decide dacă `inlineCss` rămâne (comentariul din `next.config.ts` cere măsurătoarea).                              |
| 3   | **Bing Webmaster Tools**                 | „Import from Google Search Console" — un clic, fără verificare separată. Apoi sitemap-ul.                         |
| 4   | Juristul pe Termeni și Confidențialitate | Apoi nota „nu a fost încă verificat" se înlocuiește cu numele și data.                                            |
| 5   | Omul din spatele ghidurilor              | Un nume (autor sau „verificat de" contabil/jurist) și o pagină `/despre`; fără el nu se scrie nimic inventat.     |

## Amânate, cu motivul

- **Pagini noi** (calculator de diurnă, condica de prezență, ore suplimentare etc.): fiecare e un text juridic care cere verificare. Merită un plan propriu de conținut, cu volume reale din GSC.
- **Benzi de angajați pe `/cere-demo` (5–20, 21–50):** benzile sunt în bază, deci schimbarea cere o migrare.
- **Model Word/PDF pentru unelte, descărcarea ca buton principal:** decizii de produs și de conversie, nu reparații.
- **Firimituri pe `/reges-online` și `/evidenta-orelor-de-munca`:** absența lor e o alegere documentată în `pagina-lege.tsx` („stau la rădăcină și n-au ce traseu arăta").
- **GTM/Umami după consimțământ, regula de cache HTML în Cloudflare:** se măsoară împreună cu #1–#2 de mai sus, ca să nu amestecăm cauzele.
- **Titlurile `<h2>` din subsol, grafia REGES-Online/REGES-ONLINE, descrierile de 161–170 de caractere:** Low, fără efect măsurabil; testul existent permite deliberat 170.
