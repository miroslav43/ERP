# Urcarea pe cuvintele cheie măsurate — plan de implementare

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Administrativo.ro să apară pe pagina 1–2 Google pentru familiile de termeni măsurate pe 2 oct 2026 (modele de documente, calculatoare, întrebări de Cod al muncii), cu fiecare pagină nouă trimițând vizitatorul spre modulul care rezolvă problema.

**Architecture:** Un singur model de document (`DocumentTabelar`) cu trei randări (PDF prin `pdf-lib` + fontul DejaVu deja încorporat, Word prin `docx`, Excel prin `exceljs`) servește toate uneltele printr-o rută de API cu registru. Fiecare unealtă = un constructor pur `parametri → DocumentTabelar` + o pagină server cu formular GET (merge fără JavaScript) și previzualizare HTML din același model. Ghidurile noi folosesc tipul existent `PaginaLege` și componenta `RandarePaginaLege`, extinsă cu un tabel opțional. Măsurarea se face prin Search Console API, pe o listă fixă de termeni-țintă.

**Tech Stack:** Next.js 16.3 App Router (pagini server, `searchParams` ca `Promise`), TypeScript strict, Vitest, `pdf-lib` + `@pdf-lib/fontkit`, `exceljs`, `docx` (dependență nouă), Search Console API prin venv-ul pluginului claude-seo.

**Spec:** [`docs/comercial/cuvinte-cheie.md`](../../comercial/cuvinte-cheie.md) (cererea măsurată) + [`docs/comercial/vizibilitate-organica.md`](../../comercial/vizibilitate-organica.md) (strategia: long tail întâi, primul link real e pasul cel mai important).

## Global Constraints

- Tot textul vizibil, comentariile și identificatorii: în română, cu ș/ț cu virgulă dedesubt (U+0219/U+021B). Testul `nicio sedilă turcească în tot stratul de marketing` din `src/content/landing/continut.test.ts` pică altfel.
- Titlul paginii (`metadatePagina({ titlu })`) are **cel mult 48 de caractere**: șablonul adaugă ` · Administrativo` (17), iar testul `titlurile randate încap în rezultatul de căutare` cere ≤ 65.
- Fiecare pagină publică nouă primește, în același commit: `metadatePagina(...)` în `page.tsx`, o intrare în `PAGINI` din `src/content/landing/harta.ts` (secțiunea potrivită, `actualizat` literal = data commitului), o intrare în `PAGINI` din `src/app/llms.txt/route.ts`, și un rând în hub-ul ei (`/unelte` sau `/ghid`). Testele `fiecare pagină statică de marketing apare în sitemap` și `llms.txt și sitemap-ul arată aceleași pagini` pică altfel.
- Nicio cifră legală (cuantum, cotă, termen, amendă) fără `temei` (articol + act) și fără verificare pe **forma consolidată** din Portalul Legislativ, descărcată cu `curl` (nu WebFetch, care trunchiază actele mari), cu data consolidării trecută în comentariul de antet al fișierului de conținut. `DetaliiDocumentAfis` poate servi o formă veche: se verifică data de pe pagină.
- Uneltele publice nu citesc și nu scriu baza de date, nu cer sesiune, iar fiecare parametru din adresă trece printr-o funcție `normalizeaza*` cu limite (an 2020–2035, cel mult 60 de nume, texte tăiate la 120 de caractere).
- Lanțul de verificare al fiecărui task: `pnpm typecheck && pnpm check:server && pnpm lint && pnpm test && node scripts/checks/lastmod.mjs`. **Fără `pnpm build`** (decizia utilizatorului). `pnpm format:check` pică azi pe `docs/comercial/linkedin/unelte/pachet/pachet-linkedin.html`, preexistent: se rulează `pnpm exec prettier --check <fișierele tale>`.
- Git: `git status --short -- <căile tale>`, `git fetch origin main`, `git commit --only -- <căile tale>`, `git merge origin/main`, `git push origin main`. Niciodată `git add -A`, niciodată rebase, niciodată ramură nouă. Atribuirea în commit: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Dependențe noi: doar `docx` (runtime) și `jszip` declarat explicit ca devDependency (e deja în arbore prin `exceljs`, dar pnpm nu lasă importul unei dependențe nedeclarate).
- Linkurile de descărcare poartă `data-umami-event="<unealta>-<format>"`, ca pe `/unelte/foaie-de-pontaj`.
- Niciun fișier din `src/app/(app)/` nu se atinge.

## Review Focus

1. **Diacritice în PDF** — un nume ca „Ștefan Țepeș-Ionescu” într-un câmp: PDF-ul se generează și conține literele, nu aruncă „WinAnsi cannot encode”. Pinned în Task 1 (`randeazaPdf nu aruncă pe ș, ț, ă, î, â`).
2. **Nume de fișier cu diacritice sau ghilimele** — `content-disposition` cu `"` sau `ș` în `filename` strică descărcarea în unele browsere. Se așteaptă un nume ASCII, fără ghilimele. Pinned în Task 1 (`numeFisierSigur`).
3. **Adresă de unealtă care atinge prototipul** — `/api/unelte/constructor`, `/api/unelte/__proto__`, `/api/unelte/toString` trebuie să dea 404, nu 500. Pinned în Task 3 (`registrul nu răspunde la cheile prototipului`).
4. **Intrare enormă** — 10.000 de rânduri în câmpul de nume, an 9999, lună 13: documentul rămâne mărginit (≤ 60 de nume, an implicit, lună implicită). Pinned în Task 3 (`condica e mărginită la intrare enormă`).
5. **Text mai lung decât celula** — un traseu de 200 de caractere în foaia de parcurs: în PDF se taie cu „…” în lățimea coloanei, nu se revarsă peste celula vecină. Pinned în Task 1 (`taie` respectă lățimea).

---

## Harta fișierelor

| Fișier                                                                             | Responsabilitate                                                            | Task  |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----- |
| `docs/comercial/cuvinte-tinta.tsv`                                                 | Lista fixă termen → pagina-țintă, sursa măsurării                           | 0     |
| `scripts/seo/pozitii.py`                                                           | Interoghează Search Console pentru termenii-țintă, scrie un rând de progres | 0     |
| `docs/comercial/cuvinte-cheie-progres.md`                                          | Istoricul pozițiilor, un tabel pe săptămână                                 | 0, 17 |
| `src/lib/unelte/document-tabelar.ts`                                               | Tipul comun, formatul, numele de fișier sigur                               | 1     |
| `src/lib/unelte/pdf.ts`                                                            | `DocumentTabelar` → PDF                                                     | 1     |
| `src/lib/unelte/docx.ts`                                                           | `DocumentTabelar` → Word                                                    | 1     |
| `src/lib/unelte/xlsx.ts`                                                           | `DocumentTabelar` → Excel                                                   | 1     |
| `src/lib/unelte/raspuns.ts`                                                        | `DocumentTabelar` + format → `Response` cu antete                           | 1     |
| `src/lib/unelte/randari.test.ts`                                                   | Testele celor trei randări                                                  | 1     |
| `src/app/(marketing)/_componente/previzualizare-document.tsx`                      | `DocumentTabelar` → tabel HTML tipăribil                                    | 1     |
| `src/app/(marketing)/_componente/descarcari.tsx`                                   | Cele trei linkuri de descărcare                                             | 1     |
| `src/app/(marketing)/unelte/foaie-de-pontaj/foaie-document.ts`                     | `Foaie` → `DocumentTabelar`                                                 | 2     |
| `src/app/api/unelte/foaie-de-pontaj/route.ts`                                      | + `?format=pdf                                                              | docx` | 2   |
| `src/lib/unelte/registru.ts`                                                       | slug → constructor, pentru ruta comună                                      | 3     |
| `src/app/api/unelte/[unealta]/route.ts`                                            | Ruta comună de descărcare                                                   | 3     |
| `src/app/(marketing)/unelte/condica-de-prezenta/{model.ts,model.test.ts,page.tsx}` | Condica                                                                     | 3     |
| `src/app/(marketing)/unelte/cerere-concediu-de-odihna/{cerere-document.ts,…}`      | Cererea în Word/PDF + variante                                              | 4     |
| `src/app/(marketing)/unelte/foaie-de-parcurs/{model.ts,model.test.ts,page.tsx}`    | Foaia de parcurs                                                            | 5     |
| `src/app/(marketing)/unelte/fisa-instruire-ssm/{model.ts,model.test.ts,page.tsx}`  | Fișa SSM                                                                    | 6     |
| `src/app/(marketing)/unelte/fisa-evaluare/{model.ts,model.test.ts,page.tsx}`       | Fișa de evaluare                                                            | 7     |
| `src/content/legal/tipuri.ts` + `_componente/pagina-lege.tsx`                      | Tabel opțional în paginile-lege                                             | 8     |
| `src/content/legal/diurna-externa{,-tari}.ts` + `ghid/diurna-externa/page.tsx`     | Diurna externă pe țări                                                      | 8     |
| `src/content/legal/ore-suplimentare.ts` + `ghid/ore-suplimentare/page.tsx`         | Ghid                                                                        | 9     |
| `src/content/legal/spor-de-noapte.ts` + `ghid/spor-de-noapte/page.tsx`             | Ghid                                                                        | 10    |
| `src/content/legal/concediu-odihna.ts`, `src/content/legal/reges.ts`               | Secțiuni noi                                                                | 11    |
| `src/content/legal/salarizare-publica.ts`                                          | Valorile legale pentru calculator, cu poarta contabilului                   | 12    |
| `src/lib/unelte/salariu.ts`                                                        | Brut → net și net → brut, prin motorul produsului                           | 13    |
| `src/app/(marketing)/unelte/calculator-salariu/page.tsx`                           | Calculatorul                                                                | 14    |
| `src/content/landing/fise-module.ts`, `ro.ts` (subsol)                             | Legăturile inverse spre unelte și ghiduri                                   | 15    |

---

## Faza 0 — Linia de bază

### Task 0: Termenii-țintă și scriptul de poziții

Fără o linie de bază, peste opt săptămâni nu se poate spune ce a mișcat ce. Search Console are întârziere de 2–3 zile și ține 16 luni, deci măsurarea pornește acum.

**Files:**

- Create: `docs/comercial/cuvinte-tinta.tsv`
- Create: `scripts/seo/pozitii.py`
- Create: `docs/comercial/cuvinte-cheie-progres.md`

**Interfaces:**

- Produces: `cuvinte-tinta.tsv` cu coloanele `termen<TAB>pagina` (pagina = cale, fără domeniu). Fiecare task de pagină adaugă rândurile lui.

- [ ] **Step 1: Scrie lista de termeni-țintă**

```tsv
termen	pagina
foaie de pontaj lunar	/unelte/foaie-de-pontaj
foaie de pontaj lunar pdf	/unelte/foaie-de-pontaj
foaie de pontaj lunar word	/unelte/foaie-de-pontaj
foaie de pontaj lunar excel	/unelte/foaie-de-pontaj
foaie colectiva de pontaj	/unelte/foaie-de-pontaj
condica de prezenta model	/unelte/condica-de-prezenta
condica de prezenta model word	/unelte/condica-de-prezenta
condica de prezenta este obligatorie	/unelte/condica-de-prezenta
cerere concediu de odihna	/unelte/cerere-concediu-de-odihna
cerere concediu de odihna word	/unelte/cerere-concediu-de-odihna
cerere concediu fara plata model	/unelte/cerere-concediu-de-odihna
foaie de parcurs model	/unelte/foaie-de-parcurs
foaie de parcurs pdf	/unelte/foaie-de-parcurs
fisa instruire ssm model	/unelte/fisa-instruire-ssm
fisa ssm completata	/unelte/fisa-instruire-ssm
fisa evaluare angajati model	/unelte/fisa-evaluare
evaluare angajati codul muncii	/unelte/fisa-evaluare
diurna externa 2026	/ghid/diurna-externa
diurna externa germania 2026	/ghid/diurna-externa
diurna externa bulgaria 2026	/ghid/diurna-externa
ore suplimentare codul muncii	/ghid/ore-suplimentare
cate ore suplimentare ai voie pe luna	/ghid/ore-suplimentare
spor de noapte codul muncii	/ghid/spor-de-noapte
spor de noapte calcul	/ghid/spor-de-noapte
zile concediu de odihna	/ghid/concediu-de-odihna
cate zile de concediu ai pe luna	/ghid/concediu-de-odihna
concediu de odihna neefectuat	/ghid/concediu-de-odihna
registru salariati reges online	/reges-online
calcul salariu net	/unelte/calculator-salariu
calcul salariu brut din net	/unelte/calculator-salariu
program salarizare	/module/salarizare
program salarii	/module/salarizare
aplicatie pontaj angajati	/pontaj-pe-telefon
program pontaj angajati	/module/pontaj
```

- [ ] **Step 2: Scrie scriptul de poziții**

`scripts/seo/pozitii.py` — rulează cu Python-ul din venv-ul pluginului, care are `google-api-python-client`. Nu citește și nu tipărește cheia; folosește calea din config.

```python
"""Pozițiile termenilor-țintă din Search Console, ultimele 28 de zile.

Rulare:
  ~/.claude/plugins/data/claude-seo-agricidaniel-claude-seo/.venv/bin/python \
    scripts/seo/pozitii.py >> docs/comercial/cuvinte-cheie-progres.md

Termenul se caută EXACT (operator `equals`), pe toate paginile; coloana „pe țintă”
spune dacă Google afișează chiar pagina pe care o vrem. Un termen fără afișări
apare cu „—”, nu lipsește: absența e informație.
"""

import csv
import datetime as dt
import json
import os
import sys

from google.oauth2 import service_account
from googleapiclient.discovery import build

CONFIG = os.path.expanduser("~/.config/claude-seo/google-api.json")
SITE = "sc-domain:administrativo.ro"
DOMENIU = "https://administrativo.ro"
TINTE = os.path.join(os.path.dirname(__file__), "..", "..", "docs", "comercial", "cuvinte-tinta.tsv")


def main() -> int:
    with open(CONFIG, encoding="utf-8") as f:
        cale_cont = json.load(f)["service_account_path"]
    acreditari = service_account.Credentials.from_service_account_file(
        cale_cont, scopes=["https://www.googleapis.com/auth/webmasters.readonly"]
    )
    gsc = build("searchconsole", "v1", credentials=acreditari, cache_discovery=False)

    sfarsit = dt.date.today() - dt.timedelta(days=3)
    inceput = sfarsit - dt.timedelta(days=27)

    with open(TINTE, encoding="utf-8") as f:
        tinte = list(csv.DictReader(f, delimiter="\t"))

    print(f"\n## {dt.date.today().isoformat()} (date {inceput} – {sfarsit})\n")
    print("| Termen | Afișări | Clicuri | Poziție | Pagina afișată | Pe țintă |")
    print("| --- | ---: | ---: | ---: | --- | :---: |")
    for t in tinte:
        corp = {
            "startDate": inceput.isoformat(),
            "endDate": sfarsit.isoformat(),
            "dimensions": ["page"],
            "dimensionFilterGroups": [
                {"filters": [{"dimension": "query", "operator": "equals", "expression": t["termen"]}]}
            ],
            "rowLimit": 5,
        }
        randuri = gsc.searchanalytics().query(siteUrl=SITE, body=corp).execute().get("rows", [])
        if not randuri:
            print(f"| {t['termen']} | — | — | — | — | — |")
            continue
        r = max(randuri, key=lambda x: x["impressions"])
        pagina = r["keys"][0].replace(DOMENIU, "") or "/"
        pe_tinta = "✅" if pagina == t["pagina"] else "❌"
        print(
            f"| {t['termen']} | {int(r['impressions'])} | {int(r['clicks'])} | "
            f"{r['position']:.1f} | `{pagina}` | {pe_tinta} |"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 3: Creează fișierul de progres și rulează linia de bază**

```bash
printf '# Pozițiile pe termenii-țintă\n\nGenerat de `scripts/seo/pozitii.py`. Un tabel pe rulare, cel mai nou jos.\n' > docs/comercial/cuvinte-cheie-progres.md
~/.claude/plugins/data/claude-seo-agricidaniel-claude-seo/.venv/bin/python scripts/seo/pozitii.py >> docs/comercial/cuvinte-cheie-progres.md
tail -40 docs/comercial/cuvinte-cheie-progres.md
```

Expected: un tabel cu 34 de rânduri; majoritatea „—” (paginile nu există încă), `program salarizare` cu poziția în jur de 58 pe `/`, `foaie de pontaj lunar` în jur de 28.

- [ ] **Step 4: Volumele reale (pasul utilizatorului)**

Utilizatorul deschide ads.google.com → Instrumente → Planificator de cuvinte cheie → „Obțineți volumele de căutare”, România, română, lipește coloana `termen` din TSV și descarcă CSV-ul în `docs/comercial/keyword-planner-2026-10.csv`. Dacă CSV-ul sosește, ordinea fazelor 1–4 se revede pe volume; dacă nu, se merge pe ordinea de mai jos. Nu blochează Task 1.

- [ ] **Step 5: Commit**

```bash
git status --short -- docs/comercial/cuvinte-tinta.tsv scripts/seo/pozitii.py docs/comercial/cuvinte-cheie-progres.md
git fetch origin main
git add docs/comercial/cuvinte-tinta.tsv scripts/seo/pozitii.py docs/comercial/cuvinte-cheie-progres.md
git commit --only -m "chore(seo): termenii-țintă și linia de bază a pozițiilor din Search Console" -- docs/comercial/cuvinte-tinta.tsv scripts/seo/pozitii.py docs/comercial/cuvinte-cheie-progres.md
git merge origin/main && git push origin main
```

---

## Faza 1 — Infrastructura comună și uneltele care refolosesc ce există

### Task 1: Modelul `DocumentTabelar` și cele trei randări

**Files:**

- Modify: `package.json` (dependențe)
- Create: `src/lib/unelte/document-tabelar.ts`
- Create: `src/lib/unelte/pdf.ts`
- Create: `src/lib/unelte/docx.ts`
- Create: `src/lib/unelte/xlsx.ts`
- Create: `src/lib/unelte/raspuns.ts`
- Create: `src/app/(marketing)/_componente/previzualizare-document.tsx`
- Create: `src/app/(marketing)/_componente/descarcari.tsx`
- Test: `src/lib/unelte/randari.test.ts`

**Interfaces:**

- Produces:
  - `type Format = "pdf" | "docx" | "xlsx"`; `normalizeazaFormat(brut: string | null): Format` (implicit `"pdf"`)
  - `type Coloana = Readonly<{ eticheta: string; latime: number }>`
  - `type DocumentTabelar` (câmpuri mai jos)
  - `numeFisierSigur(baza: string): string`
  - `randeazaPdf(d): Promise<Uint8Array>`, `randeazaDocx(d): Promise<Uint8Array>`, `randeazaXlsx(d): Promise<Uint8Array>`
  - `taie(text: string, latime: number, masoara: (t: string) => number): string`
  - `raspunsDocument(d: DocumentTabelar, format: Format): Promise<Response>`
  - `<PrevizualizareDocument document={d} />`, `<Descarcari href={(format) => string} eveniment="condica" />`

- [ ] **Step 1: Adaugă dependențele**

```bash
pnpm add docx
pnpm add -D jszip
grep -E '"(docx|jszip)"' package.json
```

Expected: două rânduri, `docx` în `dependencies`, `jszip` în `devDependencies`.

- [ ] **Step 2: Scrie tipul comun**

`src/lib/unelte/document-tabelar.ts`:

```ts
/**
 * Documentul pe care îl produce orice unealtă gratuită, înainte de format.
 *
 * ── DE CE UN MODEL, NU TREI GENERATOARE PE UNEALTĂ ────────────────────────
 * Șase unelte × trei formate ar fi optsprezece generatoare care se despart la
 * prima corectură: PDF-ul spune „Semnătura”, Word-ul „Semnatura”. Unealta
 * construiește O DATĂ ce conține documentul; randările din același director
 * decid doar cum arată. Previzualizarea HTML citește același obiect, deci ce
 * vede omul pe ecran e ce descarcă.
 */

export type Format = "pdf" | "docx" | "xlsx";

export const FORMATE: readonly Format[] = ["pdf", "docx", "xlsx"];

export function normalizeazaFormat(brut: string | null): Format {
  return brut === "docx" || brut === "xlsx" ? brut : "pdf";
}

export type Coloana = Readonly<{
  eticheta: string;
  /** Lățime RELATIVĂ; randările o transformă în procente din lățimea utilă. */
  latime: number;
}>;

export type DocumentTabelar = Readonly<{
  titlu: string;
  subtitlu: string | null;
  /** Perechi „Angajat: Popa Ion”. Valoare goală = linie de completat de mână. */
  campuri: readonly Readonly<{ eticheta: string; valoare: string }>[];
  /** Proză înaintea tabelului (corpul unei cereri). Gol pentru formularele tabelare. */
  paragrafe: readonly string[];
  /** Fără coloane, tabelul nu se randează deloc. */
  coloane: readonly Coloana[];
  randuri: readonly (readonly string[])[];
  /** Indicii coloanelor umbrite (weekend, sărbători). */
  umbrite: readonly number[];
  note: readonly string[];
  /** Etichetele liniilor de semnătură, de la stânga la dreapta. */
  semnaturi: readonly string[];
  orientare: "portret" | "peisaj";
  /** Fără extensie; trece prin `numeFisierSigur`. */
  numeFisier: string;
}>;

/**
 * Numele de fișier pentru `content-disposition`: ASCII, fără ghilimele.
 *
 * `ș` se descompune în NFD în `s` + U+0326 (virgula de dedesubt), care cade în
 * intervalul semnelor combinante — deci „foaie-ș” devine „foaie-s”, nu „foaie-”.
 */
export function numeFisierSigur(baza: string): string {
  const curat = baza
    .normalize("NFD")
    .replace(/[̀-ͯ]/gu, "")
    .replace(/[^a-zA-Z0-9-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .toLowerCase();
  return curat === "" ? "document" : curat;
}
```

- [ ] **Step 3: Scrie testele care pică**

`src/lib/unelte/randari.test.ts`:

```ts
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { numeFisierSigur, normalizeazaFormat, type DocumentTabelar } from "./document-tabelar";
import { randeazaDocx } from "./docx";
import { randeazaPdf, taie } from "./pdf";
import { raspunsDocument } from "./raspuns";
import { randeazaXlsx } from "./xlsx";

const DOC: DocumentTabelar = {
  titlu: "Condica de prezență — octombrie 2026",
  subtitlu: "Firma Exemplu SRL",
  campuri: [{ eticheta: "Angajat", valoare: "Ștefan Țepeș-Ionescu, Ână Îî" }],
  paragrafe: ["Subsemnatul, vă rog să-mi aprobați cererea."],
  coloane: [
    { eticheta: "Data", latime: 2 },
    { eticheta: "Nume și prenume", latime: 5 },
    { eticheta: "Semnătura", latime: 3 },
  ],
  randuri: Array.from({ length: 80 }, (_, i) => [`${String(i + 1)}.10.2026`, "Popa Ion", ""]),
  umbrite: [0],
  note: ["Sărbători legale în lună: niciuna"],
  semnaturi: ["Întocmit", "Aprobat"],
  orientare: "peisaj",
  numeFisier: "condica-octombrie-2026",
};

describe("modelul comun", () => {
  it("formatul necunoscut cade pe PDF", () => {
    expect(normalizeazaFormat(null)).toBe("pdf");
    expect(normalizeazaFormat("exe")).toBe("pdf");
    expect(normalizeazaFormat("docx")).toBe("docx");
  });

  it("numeFisierSigur scoate diacriticele și ghilimelele", () => {
    expect(numeFisierSigur('foaie "ș" țară/2026')).toBe("foaie-s-tara-2026");
    expect(numeFisierSigur("„”")).toBe("document");
  });
});

describe("PDF", () => {
  it("randeazaPdf nu aruncă pe ș, ț, ă, î, â și paginează rândurile", async () => {
    const octeti = await randeazaPdf(DOC);
    expect(new TextDecoder().decode(octeti.slice(0, 5))).toBe("%PDF-");
    const citit = await PDFDocument.load(octeti);
    expect(citit.getPageCount()).toBeGreaterThan(1);
    const [latime, inaltime] = [citit.getPage(0).getWidth(), citit.getPage(0).getHeight()];
    expect(latime).toBeGreaterThan(inaltime); // peisaj
  });

  it("taie respectă lățimea și pune „…” doar când trebuie", () => {
    const masoara = (t: string) => t.length * 5;
    expect(taie("scurt", 100, masoara)).toBe("scurt");
    const lung = taie("x".repeat(200), 50, masoara);
    expect(masoara(lung)).toBeLessThanOrEqual(50);
    expect(lung.endsWith("…")).toBe(true);
  });
});

describe("Word", () => {
  it("randeazaDocx produce un .docx cu titlul, diacriticele și orientarea", async () => {
    const octeti = await randeazaDocx(DOC);
    const zip = await JSZip.loadAsync(octeti);
    const xml = await zip.file("word/document.xml")?.async("string");
    expect(xml).toContain("Condica de prezență");
    expect(xml).toContain("Ștefan Țepeș-Ionescu");
    expect(xml).toContain('w:orient="landscape"');
  });
});

describe("Excel", () => {
  it("randeazaXlsx produce un registru cu antetul tabelului", async () => {
    const octeti = await randeazaXlsx(DOC);
    const zip = await JSZip.loadAsync(octeti);
    const siruri = await zip.file("xl/sharedStrings.xml")?.async("string");
    expect(siruri).toContain("Nume și prenume");
  });
});

describe("răspunsul HTTP", () => {
  it("pune tipul, numele ASCII și atașamentul", async () => {
    const r = await raspunsDocument(DOC, "docx");
    expect(r.headers.get("content-type")).toContain("wordprocessingml");
    expect(r.headers.get("content-disposition")).toBe(
      'attachment; filename="condica-octombrie-2026.docx"',
    );
  });
});
```

- [ ] **Step 4: Rulează testele, verifică că pică**

Run: `pnpm exec vitest run src/lib/unelte/randari.test.ts`
Expected: FAIL — „Failed to resolve import "./pdf"”.

- [ ] **Step 5: Scrie randarea PDF**

`src/lib/unelte/pdf.ts`:

```ts
import "server-only";

import { rgb, type PDFFont } from "pdf-lib";

import {
  GRI,
  INALTIME_A4,
  LATIME_A4,
  LINIE,
  MARGINE,
  NEGRU,
  pornesteDocument,
} from "@/lib/pdf/document";

import type { DocumentTabelar } from "./document-tabelar";

/**
 * `DocumentTabelar` → PDF.
 *
 * Folosește `pornesteDocument` din `src/lib/pdf/document.ts`, adică fontul
 * DejaVu încorporat: cele 14 fonturi standard PDF nu au `ș`/`ț` cu virgulă și
 * ar arunca la primul nume românesc.
 */

const UMBRA = rgb(0.92, 0.93, 0.92);
const MARIME = 8;
const INALT_RAND = 16;

/** Taie textul la lățimea dată, cu „…” la final. `masoara` e injectat ca să fie testabil. */
export function taie(text: string, latime: number, masoara: (t: string) => number): string {
  if (masoara(text) <= latime) return text;
  let t = text;
  while (t.length > 0 && masoara(`${t}…`) > latime) t = t.slice(0, -1);
  return `${t}…`;
}

export async function randeazaPdf(d: DocumentTabelar): Promise<Uint8Array> {
  const { doc, fonturi } = await pornesteDocument(d.titlu, "Administrativo");
  const [latime, inaltime] =
    d.orientare === "peisaj" ? [INALTIME_A4, LATIME_A4] : [LATIME_A4, INALTIME_A4];
  const util = latime - 2 * MARGINE;
  const totalRelativ = d.coloane.reduce((s, c) => s + c.latime, 0);
  const latimi = d.coloane.map((c) => (totalRelativ === 0 ? 0 : (c.latime / totalRelativ) * util));

  let pagina = doc.addPage([latime, inaltime]);
  let y = inaltime - MARGINE;

  const masoara = (font: PDFFont, marime: number) => (t: string) =>
    font.widthOfTextAtSize(t, marime);
  const paginaNoua = () => {
    pagina = doc.addPage([latime, inaltime]);
    y = inaltime - MARGINE;
  };
  const asiguraLoc = (necesar: number) => {
    if (y - necesar < MARGINE + 20) paginaNoua();
  };
  const scrie = (text: string, marime: number, font: PDFFont, culoare = NEGRU) => {
    asiguraLoc(marime + 6);
    pagina.drawText(taie(text, util, masoara(font, marime)), {
      x: MARGINE,
      y: y - marime,
      size: marime,
      font,
      color: culoare,
    });
    y -= marime + 6;
  };

  scrie(d.titlu, 14, fonturi.aldin);
  if (d.subtitlu !== null) scrie(d.subtitlu, 9, fonturi.normal, GRI);
  y -= 4;
  for (const c of d.campuri) {
    scrie(
      `${c.eticheta}: ${c.valoare === "" ? "______________________________" : c.valoare}`,
      9,
      fonturi.normal,
    );
  }
  y -= 4;
  for (const p of d.paragrafe) scrie(p, 10, fonturi.normal);

  const rand = (celule: readonly string[], aldin: boolean) => {
    const font = aldin ? fonturi.aldin : fonturi.normal;
    let x = MARGINE;
    latimi.forEach((w, i) => {
      if (d.umbrite.includes(i)) {
        pagina.drawRectangle({ x, y: y - INALT_RAND, width: w, height: INALT_RAND, color: UMBRA });
      }
      pagina.drawRectangle({
        x,
        y: y - INALT_RAND,
        width: w,
        height: INALT_RAND,
        borderColor: LINIE,
        borderWidth: 0.5,
      });
      pagina.drawText(taie(celule[i] ?? "", w - 4, masoara(font, MARIME)), {
        x: x + 2,
        y: y - INALT_RAND + 5,
        size: MARIME,
        font,
        color: NEGRU,
      });
      x += w;
    });
    y -= INALT_RAND;
  };

  if (d.coloane.length > 0) {
    const antet = d.coloane.map((c) => c.eticheta);
    asiguraLoc(INALT_RAND * 2);
    rand(antet, true);
    for (const r of d.randuri) {
      if (y - INALT_RAND < MARGINE + 20) {
        paginaNoua();
        rand(antet, true); // antetul se repetă pe fiecare pagină
      }
      rand(r, false);
    }
  }

  y -= 10;
  for (const n of d.note) scrie(n, 8, fonturi.normal, GRI);

  if (d.semnaturi.length > 0) {
    asiguraLoc(50);
    y -= 30;
    const pas = util / d.semnaturi.length;
    d.semnaturi.forEach((eticheta, i) => {
      const x = MARGINE + i * pas;
      pagina.drawLine({ start: { x, y }, end: { x: x + pas - 24, y }, thickness: 0.5, color: GRI });
      pagina.drawText(eticheta, { x, y: y - 11, size: 8, font: fonturi.normal, color: GRI });
    });
    y -= 20;
  }

  pagina.drawText("Generat gratuit cu administrativo.ro", {
    x: MARGINE,
    y: MARGINE / 2,
    size: 7,
    font: fonturi.normal,
    color: GRI,
  });

  return doc.save();
}
```

- [ ] **Step 6: Scrie randarea Word**

`src/lib/unelte/docx.ts`:

```ts
import {
  Document,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import type { DocumentTabelar } from "./document-tabelar";

/** `DocumentTabelar` → .docx. Mărimile în `docx` sunt în jumătăți de punct: 16 = 8 pt. */
export async function randeazaDocx(d: DocumentTabelar): Promise<Uint8Array> {
  const totalRelativ = d.coloane.reduce((s, c) => s + c.latime, 0) || 1;
  const celula = (text: string, i: number, aldin: boolean) =>
    new TableCell({
      width: {
        size: Math.round(((d.coloane[i]?.latime ?? 0) / totalRelativ) * 100),
        type: WidthType.PERCENTAGE,
      },
      shading: d.umbrite.includes(i)
        ? { type: ShadingType.CLEAR, color: "auto", fill: "E6E9E6" }
        : undefined,
      children: [new Paragraph({ children: [new TextRun({ text, bold: aldin, size: 16 })] })],
    });

  const paragraf = (
    text: string,
    optiuni: { bold?: boolean; size?: number; color?: string } = {},
  ) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, ...optiuni })] });

  const copii: (Paragraph | Table)[] = [paragraf(d.titlu, { bold: true, size: 28 })];
  if (d.subtitlu !== null) copii.push(paragraf(d.subtitlu, { size: 18, color: "6B7280" }));
  for (const c of d.campuri) {
    copii.push(
      paragraf(
        `${c.eticheta}: ${c.valoare === "" ? "______________________________" : c.valoare}`,
        { size: 20 },
      ),
    );
  }
  for (const p of d.paragrafe) copii.push(paragraf(p, { size: 22 }));
  if (d.coloane.length > 0) {
    copii.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: d.coloane.map((c, i) => celula(c.eticheta, i, true)),
          }),
          ...d.randuri.map(
            (r) =>
              new TableRow({ children: d.coloane.map((_, i) => celula(r[i] ?? "", i, false)) }),
          ),
        ],
      }),
    );
  }
  for (const n of d.note) copii.push(paragraf(n, { size: 16, color: "6B7280" }));
  if (d.semnaturi.length > 0) {
    copii.push(
      paragraf(""),
      paragraf(d.semnaturi.map((s) => `${s}: ____________________`).join("        "), { size: 18 }),
    );
  }
  copii.push(paragraf("Generat gratuit cu administrativo.ro", { size: 14, color: "6B7280" }));

  const document = new Document({
    creator: "Administrativo",
    title: d.titlu,
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation:
                d.orientare === "peisaj" ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
            },
          },
        },
        children: copii,
      },
    ],
  });
  return new Uint8Array(await Packer.toBuffer(document));
}
```

Dacă testul de orientare pică (unele versiuni `docx` nu inversează singure dimensiunile), se adaugă explicit `width: 16838, height: 11906` (A4 peisaj în twips) lângă `orientation`.

- [ ] **Step 7: Scrie randarea Excel**

`src/lib/unelte/xlsx.ts`:

```ts
import ExcelJS from "exceljs";

import type { DocumentTabelar } from "./document-tabelar";

/** `DocumentTabelar` → .xlsx, pe aceeași filă, cu antetul tabelului înghețat. */
export async function randeazaXlsx(d: DocumentTabelar): Promise<Uint8Array> {
  const registru = new ExcelJS.Workbook();
  registru.creator = "Administrativo";
  const fila = registru.addWorksheet("Document", {
    pageSetup: {
      orientation: d.orientare === "peisaj" ? "landscape" : "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });
  fila.columns = d.coloane.map((c) => ({ width: Math.max(6, c.latime * 6) }));

  fila.addRow([d.titlu]).font = { bold: true, size: 13 };
  if (d.subtitlu !== null) fila.addRow([d.subtitlu]);
  for (const c of d.campuri) fila.addRow([`${c.eticheta}:`, c.valoare]);
  for (const p of d.paragrafe) fila.addRow([p]);
  fila.addRow([]);

  if (d.coloane.length > 0) {
    const antet = fila.addRow(d.coloane.map((c) => c.eticheta));
    antet.font = { bold: true };
    fila.views = [{ state: "frozen", ySplit: antet.number }];
    for (const r of d.randuri) {
      const rand = fila.addRow([...r]);
      d.coloane.forEach((_, i) => {
        const celula = rand.getCell(i + 1);
        celula.border = {
          top: { style: "hair" },
          left: { style: "hair" },
          bottom: { style: "hair" },
          right: { style: "hair" },
        };
        if (d.umbrite.includes(i)) {
          celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6E9E6" } };
        }
      });
    }
  }
  fila.addRow([]);
  for (const n of d.note) fila.addRow([n]);
  if (d.semnaturi.length > 0) fila.addRow(d.semnaturi.map((s) => `${s}: ______________`));
  fila.addRow(["Generat gratuit cu administrativo.ro"]);

  return new Uint8Array(await registru.xlsx.writeBuffer());
}
```

- [ ] **Step 8: Scrie răspunsul HTTP**

`src/lib/unelte/raspuns.ts`:

```ts
import "server-only";

import { numeFisierSigur, type DocumentTabelar, type Format } from "./document-tabelar";
import { randeazaDocx } from "./docx";
import { randeazaPdf } from "./pdf";
import { randeazaXlsx } from "./xlsx";

const TIP: Readonly<Record<Format, string>> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const RANDARI: Readonly<Record<Format, (d: DocumentTabelar) => Promise<Uint8Array>>> = {
  pdf: randeazaPdf,
  docx: randeazaDocx,
  xlsx: randeazaXlsx,
};

export async function raspunsDocument(d: DocumentTabelar, format: Format): Promise<Response> {
  const continut = await RANDARI[format](d);
  return new Response(new Uint8Array(continut), {
    headers: {
      "content-type": TIP[format],
      "content-disposition": `attachment; filename="${numeFisierSigur(d.numeFisier)}.${format}"`,
      "cache-control": "public, max-age=3600",
    },
  });
}
```

- [ ] **Step 9: Rulează testele, verifică că trec**

Run: `pnpm exec vitest run src/lib/unelte/randari.test.ts`
Expected: PASS, 7 teste.

- [ ] **Step 10: Scrie previzualizarea și linkurile de descărcare**

`src/app/(marketing)/_componente/previzualizare-document.tsx`:

```tsx
import type { DocumentTabelar } from "@/lib/unelte/document-tabelar";

/**
 * Previzualizarea HTML a unui `DocumentTabelar`, din același obiect ca fișierele.
 *
 * `relative` pe containerul derulabil: fără el, `sr-only` din `<caption>` scapă
 * și târăște pagina lateral (capcana documentată pe `/module/[modul]`).
 */
export function PrevizualizareDocument({ document: d }: { document: DocumentTabelar }) {
  return (
    <figure className="mk-foaie">
      <figcaption>
        <p className="font-mk-display text-[1.0625rem] font-semibold">{d.titlu}</p>
        {d.subtitlu !== null && <p className="text-mk-text-slab text-[0.875rem]">{d.subtitlu}</p>}
      </figcaption>
      {d.campuri.length > 0 && (
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-[0.875rem] sm:grid-cols-2">
          {d.campuri.map((c) => (
            <div key={c.eticheta} className="flex gap-2">
              <dt className="text-mk-text-slab">{c.eticheta}:</dt>
              <dd>{c.valoare === "" ? "____________________" : c.valoare}</dd>
            </div>
          ))}
        </dl>
      )}
      {d.paragrafe.map((p) => (
        <p key={p} className="mt-3 max-w-[68ch] text-[0.9375rem] leading-[1.65]">
          {p}
        </p>
      ))}
      {d.coloane.length > 0 && (
        <div className="border-mk-rigla relative mt-4 overflow-x-auto border">
          <table className="w-full border-collapse text-left text-[0.8125rem]">
            <caption className="sr-only">{d.titlu}</caption>
            <thead>
              <tr className="border-mk-rigla border-b">
                {d.coloane.map((c) => (
                  <th key={c.eticheta} scope="col" className="px-2 py-1.5 font-medium">
                    {c.eticheta}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.randuri.map((r, i) => (
                <tr key={`${String(i)}-${r.join("|")}`} className="border-mk-liniatura border-b">
                  {d.coloane.map((c, j) => (
                    <td
                      key={c.eticheta}
                      className={`h-7 px-2 ${d.umbrite.includes(j) ? "bg-mk-rigla/20" : ""}`}
                    >
                      {r[j] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {d.note.map((n) => (
        <p key={n} className="text-mk-text-slab mt-3 text-[0.8125rem]">
          {n}
        </p>
      ))}
    </figure>
  );
}
```

`src/app/(marketing)/_componente/descarcari.tsx`:

```tsx
import type { Format } from "@/lib/unelte/document-tabelar";

const ETICHETE: Readonly<Record<Format, string>> = {
  pdf: "Descarcă PDF",
  docx: "Descarcă Word",
  xlsx: "Descarcă Excel",
};

/** Cele trei descărcări, ca `<a>` simple: merg fără JavaScript și se pot salva la favorite. */
export function Descarcari({
  href,
  eveniment,
  formate = ["pdf", "docx", "xlsx"],
}: Readonly<{ href: (format: Format) => string; eveniment: string; formate?: readonly Format[] }>) {
  return (
    <ul className="flex flex-wrap gap-x-8 gap-y-2" data-tipar="ascunde">
      {formate.map((f) => (
        <li key={f}>
          <a
            href={href(f)}
            data-umami-event={`${eveniment}-${f}`}
            className="text-[0.9375rem] underline underline-offset-4"
          >
            {ETICHETE[f]}
          </a>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 11: Lanțul complet, apoi commit**

```bash
pnpm typecheck && pnpm check:server && pnpm lint && pnpm test && node scripts/checks/lastmod.mjs
F="package.json pnpm-lock.yaml src/lib/unelte src/app/(marketing)/_componente/previzualizare-document.tsx src/app/(marketing)/_componente/descarcari.tsx"
git status --short -- $F && git fetch origin main
git add src/lib/unelte "src/app/(marketing)/_componente/previzualizare-document.tsx" "src/app/(marketing)/_componente/descarcari.tsx"
git commit --only -m "feat(unelte): un singur model de document, randat în PDF, Word și Excel" -- package.json pnpm-lock.yaml src/lib/unelte "src/app/(marketing)/_componente/previzualizare-document.tsx" "src/app/(marketing)/_componente/descarcari.tsx"
git merge origin/main && git push origin main
```

---

### Task 2: Foaia de pontaj în PDF și Word

Familia cea mai apropiată de pagina 1: „foaie de pontaj lunar” e deja pe poziția 28, iar „…pdf” (29) și „…word” (23) au scor mai mare decât „…excel” (18), singurul format oferit azi.

**Files:**

- Create: `src/app/(marketing)/unelte/foaie-de-pontaj/foaie-document.ts`
- Test: `src/app/(marketing)/unelte/foaie-de-pontaj/foaie-document.test.ts`
- Modify: `src/app/api/unelte/foaie-de-pontaj/route.ts` (începutul lui `GET`)
- Modify: `src/app/(marketing)/unelte/foaie-de-pontaj/page.tsx` (metadate + linkul „Descarcă în Excel” → `<Descarcari>`)
- Modify: `src/content/landing/unelte.ts` (`ANTET_FOAIE_PONTAJ.lead`)
- Modify: `src/content/landing/harta.ts` (`actualizat` pe `/unelte/foaie-de-pontaj`)
- Modify: `docs/comercial/cuvinte-tinta.tsv` (deja conține rândurile)

**Interfaces:**

- Consumes: `construiesteFoaie(an, luna, angajati, oreZi): Foaie` (existent), `DocumentTabelar`, `raspunsDocument`, `normalizeazaFormat`, `<Descarcari>` (Task 1)
- Produces: `foaieCaDocument(foaie: Foaie): DocumentTabelar`

- [ ] **Step 1: Testul care pică**

```ts
import { describe, expect, it } from "vitest";

import { construiesteFoaie } from "./foaie";
import { foaieCaDocument } from "./foaie-document";

describe("foaia de pontaj ca document", () => {
  it("are o coloană pe zi, plus numele și totalul, și umbrește weekendurile și sărbătorile", () => {
    // Decembrie 2026: 1 dec (Ziua Națională, marți), 25–26 dec (Crăciun).
    const foaie = construiesteFoaie(2026, 12, ["Popa Ion"], 8);
    const d = foaieCaDocument(foaie);
    expect(d.coloane).toHaveLength(31 + 2);
    expect(d.coloane[1]?.eticheta).toBe("1 M");
    expect(d.umbrite).toContain(1); // 1 decembrie, sărbătoare
    expect(d.randuri[0]?.[0]).toBe("Popa Ion");
    expect(d.orientare).toBe("peisaj");
    expect(d.numeFisier).toBe("pontaj-2026-12");
  });
});
```

- [ ] **Step 2: Rulează, verifică că pică**

Run: `pnpm exec vitest run "src/app/(marketing)/unelte/foaie-de-pontaj/foaie-document.test.ts"`
Expected: FAIL — modul inexistent.

- [ ] **Step 3: Implementarea**

```ts
import type { DocumentTabelar } from "@/lib/unelte/document-tabelar";

import type { Foaie } from "./foaie";

/**
 * Foaia de pontaj ca `DocumentTabelar`, pentru PDF și Word.
 *
 * Excelul rămâne pe generatorul lui din `route.ts`: acolo totalurile sunt
 * FORMULE, iar modelul comun nu știe de formule. PDF-ul și Word-ul se tipăresc
 * și se completează de mână, deci totalul e o coloană goală.
 */
export function foaieCaDocument(foaie: Foaie): DocumentTabelar {
  const sarbatori = foaie.zile.filter((z) => z.sarbatoare !== null);
  return {
    titlu: `Foaie colectivă de prezență — ${foaie.eticheta}`,
    subtitlu: `${String(foaie.zileLucratoare)} zile lucrătoare × ${String(foaie.oreZi)} h = ${String(foaie.normaLunara)} h normă`,
    campuri: [],
    paragrafe: [],
    coloane: [
      { eticheta: "Angajat", latime: 8 },
      ...foaie.zile.map((z) => ({ eticheta: `${String(z.zi)} ${z.litera}`, latime: 1 })),
      { eticheta: "Total", latime: 2 },
    ],
    randuri: foaie.angajati.map((nume) => [nume, ...foaie.zile.map(() => ""), ""]),
    umbrite: foaie.zile.flatMap((z, i) => (z.weekend || z.sarbatoare !== null ? [i + 1] : [])),
    note: [
      `Sărbători legale în lună: ${sarbatori.map((z) => `${String(z.zi)} ${z.sarbatoare ?? ""}`).join("; ") || "niciuna"}`,
    ],
    semnaturi: ["Întocmit", "Verificat"],
    orientare: "peisaj",
    numeFisier: `pontaj-${String(foaie.an)}-${String(foaie.luna).padStart(2, "0")}`,
  };
}
```

- [ ] **Step 4: Rulează testul, trece**

Run: aceeași comandă. Expected: PASS.

- [ ] **Step 5: Ruta acceptă `?format=`**

În `src/app/api/unelte/foaie-de-pontaj/route.ts`, imediat după `const foaie = construiesteFoaie(an, luna, angajati, oreZi);` adaugă:

```ts
const format = normalizeazaFormatFoaie(q.get("format"));
if (format !== "xlsx") return raspunsDocument(foaieCaDocument(foaie), format);
```

și la importuri:

```ts
import { foaieCaDocument } from "@/app/(marketing)/unelte/foaie-de-pontaj/foaie-document";
import type { Format } from "@/lib/unelte/document-tabelar";
import { raspunsDocument } from "@/lib/unelte/raspuns";

/** Aici Excel rămâne implicitul: linkurile vechi, fără `format`, trebuie să dea tot Excel. */
function normalizeazaFormatFoaie(brut: string | null): Format {
  return brut === "pdf" || brut === "docx" ? brut : "xlsx";
}
```

- [ ] **Step 6: Pagina: titlul pe căutare și cele trei descărcări**

În `page.tsx`, `metadatePagina`:

```ts
  titlu: "Foaie de pontaj lunar: PDF, Word și Excel",
  descriere:
    "Foaie colectivă de pontaj pentru orice lună, cu weekendurile și sărbătorile legale marcate automat. Descarci în PDF, Word sau Excel, fără cont.",
```

Înlocuiește `<a href={`/api/unelte/foaie-de-pontaj?...`}>Descarcă în Excel</a>` cu:

```tsx
<Descarcari
  eveniment="foaie"
  href={(format) => `/api/unelte/foaie-de-pontaj?${parametri.toString()}&format=${format}`}
/>
```

(import `Descarcari` din `../../_componente/descarcari`). În `src/content/landing/unelte.ts`, finalul lui `ANTET_FOAIE_PONTAJ.lead` devine „… Se tipărește sau se descarcă în PDF, Word ori Excel, fără cont.”. În `harta.ts`, `actualizat` pentru `/unelte/foaie-de-pontaj` devine data zilei.

- [ ] **Step 7: Verificare manuală pe dev**

```bash
pnpm exec next dev -H 127.0.0.1 -p 3917 &
sleep 25
for f in pdf docx xlsx; do curl -s -o /tmp/f.$f -w "$f %{http_code} %{content_type}\n" "http://127.0.0.1:3917/api/unelte/foaie-de-pontaj?an=2026&luna=12&format=$f"; done
curl -s -o /dev/null -w "fara format %{content_type}\n" "http://127.0.0.1:3917/api/unelte/foaie-de-pontaj?an=2026&luna=12"
pkill -f "next dev -H 127.0.0.1 -p 3917"; rm -f .next/dev/types/validator.ts
```

Expected: trei răspunsuri 200 cu `application/pdf`, `…wordprocessingml…`, `…spreadsheetml…`; fără format → `spreadsheetml`. Deschide `/tmp/f.pdf` și verifică vizual că „Crăciun” are diacritice.

- [ ] **Step 8: Lanțul + commit + push** (aceleași comenzi ca la Task 1, cu fișierele acestui task; mesaj: `feat(unelte): foaia de pontaj și în PDF și Word, nu doar în Excel`).

---

### Task 3: Condica de prezență + ruta comună de descărcare

„condica de prezență model word” (26), „…free download” (21), „…este obligatorie 2026” (19), „…în format electronic” (17). Condica diferă de foaia de pontaj: art. 119 cere ora de început și de sfârșit, deci condica are, pe fiecare zi lucrătoare, câte un rând pe om cu ora sosirii, ora plecării și semnătura.

**Files:**

- Create: `src/lib/unelte/registru.ts`
- Create: `src/lib/unelte/registru.test.ts`
- Create: `src/app/api/unelte/[unealta]/route.ts`
- Create: `src/app/(marketing)/unelte/condica-de-prezenta/model.ts`
- Create: `src/app/(marketing)/unelte/condica-de-prezenta/model.test.ts`
- Create: `src/app/(marketing)/unelte/condica-de-prezenta/page.tsx`
- Modify: `src/content/landing/unelte.ts` (+ `ANTET_CONDICA`)
- Modify: `src/app/(marketing)/unelte/page.tsx` (rând nou în `PAGINI`)
- Modify: `src/content/landing/harta.ts`, `src/app/llms.txt/route.ts`

**Interfaces:**

- Consumes: `construiesteFoaie`, `normalizeazaAn`, `normalizeazaLuna`, `normalizeazaAngajati`, `LUNI`, `AN_MIN`, `AN_MAX` din `foaie-de-pontaj/foaie.ts`; Task 1.
- Produces:
  - `type Constructor = (q: URLSearchParams) => DocumentTabelar`
  - `UNELTE: Readonly<Record<string, Constructor>>`, `constructorPentru(slug: string): Constructor | undefined`
  - `construiesteCondica(an: number, luna: number, angajati: readonly string[], firma: string): DocumentTabelar`
  - `condicaDinParametri(q: URLSearchParams): DocumentTabelar`

- [ ] **Step 1: Testele care pică**

`model.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { condicaDinParametri, construiesteCondica } from "./model";

describe("condica de prezență", () => {
  it("are câte un rând pe om pe fiecare zi LUCRĂTOARE, fără weekenduri și sărbători", () => {
    // Decembrie 2026 are 20 de zile lucrătoare (1, 25 dec sărbători; 26 e sâmbătă).
    const d = construiesteCondica(2026, 12, ["Popa Ion", "Ilie Maria"], "");
    expect(d.randuri).toHaveLength(20 * 2);
    expect(d.randuri[0]?.[0]).toBe("02.12.2026"); // 1 decembrie sare
    expect(d.coloane.map((c) => c.eticheta)).toEqual([
      "Data",
      "Nume și prenume",
      "Ora sosirii",
      "Semnătura",
      "Ora plecării",
      "Semnătura",
    ]);
  });

  it("fără nume dă câte 10 rânduri goale pe zi", () => {
    const d = construiesteCondica(
      2026,
      12,
      Array.from({ length: 10 }, () => ""),
      "",
    );
    expect(d.randuri).toHaveLength(20 * 10);
  });

  it("condica e mărginită la intrare enormă", () => {
    const q = new URLSearchParams({
      an: "9999",
      luna: "13",
      angajati: Array.from({ length: 10_000 }, (_, i) => `Om ${String(i)}`).join("\n"),
    });
    const d = condicaDinParametri(q);
    const nume = new Set(d.randuri.map((r) => r[1]));
    expect(nume.size).toBeLessThanOrEqual(60);
    expect(d.titlu).toMatch(/20(2\d|3[0-5])$/u);
  });
});
```

`src/lib/unelte/registru.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { constructorPentru } from "./registru";

describe("registrul uneltelor", () => {
  it("găsește o unealtă înregistrată", () => {
    expect(constructorPentru("condica-de-prezenta")).toBeTypeOf("function");
  });

  it("registrul nu răspunde la cheile prototipului", () => {
    for (const cheie of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
      expect(constructorPentru(cheie)).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Rulează, verifică că pică**

Run: `pnpm exec vitest run src/lib/unelte/registru.test.ts "src/app/(marketing)/unelte/condica-de-prezenta"`
Expected: FAIL — module inexistente.

- [ ] **Step 3: Modelul condicii**

`model.ts`:

```ts
import type { DocumentTabelar } from "@/lib/unelte/document-tabelar";

import {
  construiesteFoaie,
  normalizeazaAn,
  normalizeazaAngajati,
  normalizeazaLuna,
} from "../foaie-de-pontaj/foaie";

/**
 * Condica de prezență: pe fiecare zi lucrătoare, câte un rând pe om, cu ora
 * sosirii și a plecării. Zilele vin din `construiesteFoaie`, deci sărbătorile
 * (inclusiv Paștele ortodox) se scot la fel ca pe foaia de pontaj.
 */
export function construiesteCondica(
  an: number,
  luna: number,
  angajati: readonly string[],
  firma: string,
): DocumentTabelar {
  const foaie = construiesteFoaie(an, luna, angajati, 8);
  const ll = String(luna).padStart(2, "0");
  const lucratoare = foaie.zile.filter((z) => !z.weekend && z.sarbatoare === null);
  return {
    titlu: `Condica de prezență — ${foaie.eticheta}`,
    subtitlu: firma === "" ? null : firma,
    campuri: [],
    paragrafe: [],
    coloane: [
      { eticheta: "Data", latime: 2 },
      { eticheta: "Nume și prenume", latime: 6 },
      { eticheta: "Ora sosirii", latime: 2 },
      { eticheta: "Semnătura", latime: 3 },
      { eticheta: "Ora plecării", latime: 2 },
      { eticheta: "Semnătura", latime: 3 },
    ],
    randuri: lucratoare.flatMap((z) =>
      angajati.map((nume) => [
        `${String(z.zi).padStart(2, "0")}.${ll}.${String(an)}`,
        nume,
        "",
        "",
        "",
        "",
      ]),
    ),
    umbrite: [],
    note: [
      "Art. 119 alin. (1) din Codul muncii cere evidența orelor prestate zilnic, cu ora de începere și ora de sfârșit a programului.",
      `Zile scoase (weekend și sărbători legale): ${String(foaie.zile.length - lucratoare.length)}.`,
    ],
    semnaturi: ["Verificat (conducătorul locului de muncă)"],
    orientare: "portret",
    numeFisier: `condica-prezenta-${String(an)}-${ll}`,
  };
}

export function condicaDinParametri(q: URLSearchParams): DocumentTabelar {
  const acum = new Date();
  return construiesteCondica(
    normalizeazaAn(q.get("an") ?? undefined, acum.getUTCFullYear()),
    normalizeazaLuna(q.get("luna") ?? undefined, acum.getUTCMonth() + 1),
    normalizeazaAngajati(q.get("angajati") ?? undefined),
    (q.get("firma") ?? "").trim().slice(0, 120),
  );
}
```

Notă de verificare la Step 7: textul art. 119 alin. (1) se compară cu forma consolidată a Codului muncii (documentul 128647) înainte de commit; `/evidenta-orelor-de-munca` îl citează deja — formularea trebuie să fie aceeași.

- [ ] **Step 4: Registrul și ruta**

`src/lib/unelte/registru.ts`:

```ts
import { condicaDinParametri } from "@/app/(marketing)/unelte/condica-de-prezenta/model";

import type { DocumentTabelar } from "./document-tabelar";

export type Constructor = (q: URLSearchParams) => DocumentTabelar;

/**
 * Uneltele servite de `/api/unelte/[unealta]`. Foaia de pontaj NU e aici: are
 * ruta ei statică, cu Excel pe formule, iar ruta statică are prioritate.
 */
export const UNELTE: Readonly<Record<string, Constructor>> = {
  "condica-de-prezenta": condicaDinParametri,
};

/**
 * `Object.hasOwn`, nu `UNELTE[slug]`: indexarea directă întoarce
 * `Object.prototype.constructor` pentru `/api/unelte/constructor`, adică o
 * funcție care, chemată cu parametrii, dă 500 în loc de 404.
 */
export function constructorPentru(slug: string): Constructor | undefined {
  return Object.hasOwn(UNELTE, slug) ? UNELTE[slug] : undefined;
}
```

`src/app/api/unelte/[unealta]/route.ts`:

```ts
import type { NextRequest } from "next/server";

import { normalizeazaFormat } from "@/lib/unelte/document-tabelar";
import { constructorPentru } from "@/lib/unelte/registru";
import { raspunsDocument } from "@/lib/unelte/raspuns";

/**
 * Descărcarea uneltelor gratuite: `/api/unelte/<slug>?format=pdf|docx|xlsx&…`.
 *
 * Fără sesiune și fără bază, din același motiv ca ruta foii de pontaj: intrările
 * sunt parametri normalizați cu limite, iar generarea e mărginită prin construcție.
 */
export const dynamic = "force-dynamic";

export async function GET(
  cerere: NextRequest,
  { params }: { params: Promise<{ unealta: string }> },
): Promise<Response> {
  const { unealta } = await params;
  const construieste = constructorPentru(unealta);
  if (construieste === undefined) return new Response("Unealtă necunoscută.", { status: 404 });
  const q = cerere.nextUrl.searchParams;
  return raspunsDocument(construieste(q), normalizeazaFormat(q.get("format")));
}
```

- [ ] **Step 5: Rulează testele, trec**

Run: comanda de la Step 2. Expected: PASS, 5 teste.

- [ ] **Step 6: Pagina**

În `src/content/landing/unelte.ts`:

```ts
/**
 * Condica: ce caută lumea e „model Word” și „este obligatorie”. Pagina răspunde
 * la a doua întrebare înainte să dea fișierul pentru prima.
 */
export const ANTET_CONDICA: AntetPagina = {
  supratitlu: "Unealtă gratuită",
  titlu: "Condica de prezență",
  lead: "Alege luna și scrie numele: primești condica cu fiecare zi lucrătoare, ora sosirii, ora plecării și semnătura. Sărbătorile legale se scot singure. Descarci în Word, PDF sau Excel, fără cont.",
};
```

`src/app/(marketing)/unelte/condica-de-prezenta/page.tsx`:

```tsx
// src/app/(marketing)/unelte/condica-de-prezenta/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { RO } from "@/content/landing/ro";
import { ANTET_CONDICA } from "@/content/landing/unelte";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";
import { Descarcari } from "../../_componente/descarcari";
import { metadatePagina } from "../../_componente/metadate";
import { PrevizualizareDocument } from "../../_componente/previzualizare-document";
import { AN_MAX, AN_MIN, LUNI } from "../foaie-de-pontaj/foaie";
import { condicaDinParametri } from "./model";

export const metadata: Metadata = metadatePagina({
  titlu: "Condica de prezență: model Word, PDF și Excel",
  descriere:
    "Condica de prezență gata completată cu zilele lucrătoare ale lunii, ora sosirii, ora plecării și semnătura. Model gratuit în Word, PDF sau Excel. Și: e obligatorie?",
  cale: "/unelte/condica-de-prezenta",
});

type Proprietati = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;
const unul = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;
const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2 text-[0.9375rem]";

export default async function PaginaCondica({ searchParams }: Proprietati) {
  const p = await searchParams;
  const q = new URLSearchParams();
  for (const cheie of ["an", "luna", "angajati", "firma"]) {
    const v = unul(p[cheie]);
    if (v !== undefined && v !== "") q.set(cheie, v);
  }
  const document = condicaDinParametri(q);
  const [lunaAleasa, anAles] = [document.numeFisier.slice(-2), document.numeFisier.slice(-7, -3)];

  return (
    <Cadru text={RO}>
      <div data-tipar="ascunde">
        <AntetSecundar
          text={ANTET_CONDICA}
          firimituri={[
            { eticheta: "Acasă", href: "/" },
            { eticheta: "Unelte", href: "/unelte" },
            { eticheta: "Condica de prezență", href: "/unelte/condica-de-prezenta" },
          ]}
        />
      </div>

      <Banda inaltime="scurta" supratitlu="Pe scurt" titlu="Condica de prezență e obligatorie?">
        <div className="mt-4 max-w-[68ch] space-y-3 text-[0.9375rem] leading-[1.7]">
          <p>
            Legea nu cere un registru numit „condică”. Cere evidența orelor prestate zilnic de
            fiecare salariat, cu ora de începere și ora de sfârșit a programului — art. 119 din
            Codul muncii. Condica pe hârtie e felul cel mai vechi de a o ține; o aplicație de pontaj
            e altul.
          </p>
          <p>
            Ce se cere exact, unde se ține și ce amenzi sunt, cu articolul lângă fiecare:{" "}
            <Link href="/evidenta-orelor-de-munca" className="underline underline-offset-4">
              evidența orelor de muncă
            </Link>
            .
          </p>
        </div>
      </Banda>

      <Banda inaltime="scurta">
        <form
          method="get"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          data-tipar="ascunde"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Luna</span>
            <select name="luna" defaultValue={String(Number(lunaAleasa))} className={CLASA_CAMP}>
              {LUNI.map((nume, i) => (
                <option key={nume} value={String(i + 1)}>
                  {nume}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Anul</span>
            <input
              type="number"
              name="an"
              min={AN_MIN}
              max={AN_MAX}
              defaultValue={anAles}
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Firma (opțional)</span>
            <input
              type="text"
              name="firma"
              maxLength={120}
              defaultValue={unul(p.firma) ?? ""}
              className={CLASA_CAMP}
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              data-umami-event="condica-genereaza"
              className="bg-mk-cerneala text-mk-text-inv inline-flex h-11 w-full items-center justify-center rounded px-5 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
            >
              Generează
            </button>
          </div>
          <label className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4">
            <span className="text-[0.875rem] font-medium">Angajați</span>
            <span className="text-mk-text-slab text-[0.8125rem]">
              Câte un nume pe rând. Gol = câte zece rânduri pe zi, de completat cu pixul.
            </span>
            <textarea
              name="angajati"
              rows={4}
              defaultValue={unul(p.angajati) ?? ""}
              className={CLASA_CAMP}
            />
          </label>
        </form>
        <div className="mt-6">
          <Descarcari
            eveniment="condica"
            formate={["docx", "pdf", "xlsx"]}
            href={(format) => `/api/unelte/condica-de-prezenta?${q.toString()}&format=${format}`}
          />
        </div>
      </Banda>

      <Banda inaltime="scurta">
        <PrevizualizareDocument document={document} />
      </Banda>

      <Banda inaltime="scurta" supratitlu="Fără hârtie" titlu="Când condica devine prea mult">
        <p className="text-mk-text-slab mt-4 max-w-[68ch] text-[0.9375rem] leading-[1.7]">
          Cu o aplicație, ora sosirii și a plecării se scriu de pe telefonul omului, iar luna se
          închide fără să recopiezi nimic.{" "}
          <Link href="/module/pontaj" className="underline underline-offset-4">
            Cum arată modulul de pontaj
          </Link>
          .
        </p>
      </Banda>
    </Cadru>
  );
}
```

Dacă `document.numeFisier.slice(...)` pare fragil la review, se exportă din `model.ts` și `an`/`luna` normalizați printr-o funcție `parametriCondica(q)` care întoarce `{ an, luna, angajati, firma }`, folosită și de `condicaDinParametri`.

- [ ] **Step 7: Înregistrarea paginii în hub, sitemap, llms.txt**

`src/app/(marketing)/unelte/page.tsx`, în `PAGINI`, după foaia de pontaj:

```ts
  {
    href: "/unelte/condica-de-prezenta",
    titlu: ANTET_CONDICA.titlu,
    lead: ANTET_CONDICA.lead,
  },
```

(import `ANTET_CONDICA`; păstrează orice alte câmpuri pe care le au rândurile existente). `harta.ts`, după `/unelte/foaie-de-pontaj`:

```ts
  {
    cale: "/unelte/condica-de-prezenta",
    prioritate: 0.7,
    limba: "ro",
    traducere: null,
    actualizat: "<data commitului, AAAA-LL-ZZ>",
    sectiune: "Unelte și comparații",
  },
```

`src/app/llms.txt/route.ts`, în `PAGINI`, după foaia de pontaj:

```ts
  [
    "/unelte/condica-de-prezenta",
    "Unealtă gratuită: condica de prezență pentru orice lună, cu un rând pe om pe fiecare zi lucrătoare, ora sosirii, ora plecării și semnătura. Word, PDF sau Excel, fără cont. Plus răspunsul la „e obligatorie?” (art. 119 Codul muncii).",
  ],
```

- [ ] **Step 8: Verificări**

```bash
pnpm typecheck && pnpm check:server && pnpm lint && pnpm test && node scripts/checks/lastmod.mjs
```

Pe dev (comenzile de la Task 2 Step 7): `/unelte/condica-de-prezenta?luna=12&an=2026` → 200, titlul `Condica de prezență: model Word, PDF și Excel · Administrativo`; cele trei descărcări → 200; `/api/unelte/constructor` → 404; `/api/unelte/nu-exista` → 404.

- [ ] **Step 9: Commit + push** (mesaj: `feat(unelte): condica de prezență, cu răspunsul la „e obligatorie?”, și ruta comună de descărcare`).

---

### Task 4: Cererea de concediu în Word și PDF, plus variantele

„cerere concediu de odihnă word” (24), „cerere concediu fără plată model” (14), „cerere concediu căsătorie” (16), „paternal” (11).

**Files:**

- Create: `src/app/(marketing)/unelte/cerere-concediu-de-odihna/cerere-document.ts`
- Create: `src/app/(marketing)/unelte/cerere-concediu-de-odihna/cerere-document.test.ts`
- Modify: `src/lib/unelte/registru.ts` (+ `"cerere-concediu"`)
- Modify: `src/app/(marketing)/unelte/cerere-concediu-de-odihna/page.tsx` (câmp `tip`, `<Descarcari>`, metadate)
- Modify: `src/content/landing/harta.ts` (`actualizat`), `src/app/llms.txt/route.ts` (descrierea)

**Interfaces:**

- Consumes: `construiesteCerere(deLa: string, panaLa: string): Cerere` (existent; câmpuri: `excluse: readonly ZiExclusa[]`, `problema: string | null` și ceilalți din `cerere.ts`), `normalizeazaData`, `normalizeazaText`, `aziIso`, `plusZile`.
- Produces:
  - `type TipCerere = "odihna" | "fara-plata" | "eveniment"`; `normalizeazaTip(brut: string | null): TipCerere`
  - `cerereCaDocument(o: OptiuniCerere): DocumentTabelar` unde `OptiuniCerere = { tip, nume, functie, firma, deLa, panaLa, motiv }`
  - `cerereDinParametri(q: URLSearchParams): DocumentTabelar`

- [ ] **Step 0: Citește contractul `Cerere`**

```bash
sed -n '25,140p' "src/app/(marketing)/unelte/cerere-concediu-de-odihna/cerere.ts"
```

Notează numele exacte ale câmpurilor pentru numărul de zile lucrătoare (testul de mai jos folosește `zileLucratoare`; dacă în `Cerere` câmpul se numește altfel, folosește numele real în test și în implementare).

- [ ] **Step 1: Testul care pică**

```ts
import { describe, expect, it } from "vitest";

import { cerereCaDocument, normalizeazaTip } from "./cerere-document";

const BAZA = {
  nume: "Ilie Maria",
  functie: "Contabil",
  firma: "Exemplu SRL",
  deLa: "2026-12-21",
  panaLa: "2026-12-31",
  motiv: "",
};

describe("cererea de concediu ca document", () => {
  it("odihnă: numără zilele lucrătoare și enumeră sărbătorile scoase", () => {
    const d = cerereCaDocument({ ...BAZA, tip: "odihna" });
    expect(d.titlu).toBe("Cerere de concediu de odihnă");
    expect(d.paragrafe.join(" ")).toMatch(/7 zile lucrătoare/u); // 21–31 dec 2026, fără 25 și weekenduri
    expect(d.note.join(" ")).toMatch(/Crăciun/u);
    expect(d.coloane).toHaveLength(0);
  });

  it("fără plată: citează art. 153 și nu pomenește zile lucrătoare", () => {
    const d = cerereCaDocument({ ...BAZA, tip: "fara-plata" });
    expect(d.titlu).toBe("Cerere de concediu fără plată");
    expect(d.paragrafe.join(" ")).not.toMatch(/lucrătoare/u);
  });

  it("eveniment: pune motivul și NU inventează numărul de zile legal", () => {
    const d = cerereCaDocument({ ...BAZA, tip: "eveniment", motiv: "căsătoria mea" });
    expect(d.paragrafe.join(" ")).toContain("căsătoria mea");
    expect(d.paragrafe.join(" ")).toMatch(/regulamentul intern sau contractul colectiv/u);
  });

  it("tipul necunoscut cade pe odihnă", () => {
    expect(normalizeazaTip("orice")).toBe("odihna");
  });
});
```

Verificarea cifrei 7 înainte de a rula: 21–24 dec (L–J) = 4, 25 sărbătoare, 26–27 weekend, 28–31 (L–J) = 4 → **8**, nu 7. Corectează aserțiunea la `/8 zile lucrătoare/u` dacă `construiesteCerere` nu scoate și 31 decembrie (nu e sărbătoare legală). Rulează `construiesteCerere("2026-12-21","2026-12-31")` în test și compară cu numărarea de mână înainte să fixezi cifra.

- [ ] **Step 2: Rulează, pică.** Run: `pnpm exec vitest run "src/app/(marketing)/unelte/cerere-concediu-de-odihna/cerere-document.test.ts"` → FAIL.

- [ ] **Step 3: Implementarea**

```ts
import type { DocumentTabelar } from "@/lib/unelte/document-tabelar";

import { aziIso, construiesteCerere, normalizeazaData, normalizeazaText, plusZile } from "./cerere";

export type TipCerere = "odihna" | "fara-plata" | "eveniment";

export function normalizeazaTip(brut: string | null): TipCerere {
  return brut === "fara-plata" || brut === "eveniment" ? brut : "odihna";
}

export type OptiuniCerere = Readonly<{
  tip: TipCerere;
  nume: string;
  functie: string;
  firma: string;
  deLa: string;
  panaLa: string;
  motiv: string;
}>;

const TITLU: Readonly<Record<TipCerere, string>> = {
  odihna: "Cerere de concediu de odihnă",
  "fara-plata": "Cerere de concediu fără plată",
  eveniment: "Cerere de zile libere pentru eveniment familial",
};

const data = (iso: string) => iso.split("-").reverse().join(".");

/**
 * Cele trei cereri, ca proză. Varianta „eveniment” NU scrie numărul de zile:
 * art. 152 din Codul muncii trimite la contractul colectiv sau regulamentul
 * intern, iar listele cu „5 zile la căsătorie” care circulă vin din HG
 * 250/1992, aplicabilă sectorului bugetar. Cifra greșită ar fi semnată de om.
 */
export function cerereCaDocument(o: OptiuniCerere): DocumentTabelar {
  const cine = `${o.nume === "" ? "______________________" : o.nume}${o.functie === "" ? "" : `, ${o.functie}`}`;
  const perioada = `${data(o.deLa)} – ${data(o.panaLa)}`;
  const paragrafe: string[] = [];
  const note: string[] = [];

  if (o.tip === "odihna") {
    const c = construiesteCerere(o.deLa, o.panaLa);
    paragrafe.push(
      `Subsemnatul(a) ${cine}, vă rog să-mi aprobați efectuarea concediului de odihnă în perioada ${perioada}, adică ${String(c.zileLucratoare)} zile lucrătoare.`,
    );
    if (c.excluse.length > 0) {
      note.push(
        `Zile scoase din durată: ${c.excluse.map((z) => `${data(z.data)} (${z.motiv})`).join("; ")}.`,
      );
    }
    note.push(
      "Sărbătorile legale nu intră în durata concediului de odihnă — art. 145 alin. (3) din Codul muncii.",
    );
  } else if (o.tip === "fara-plata") {
    paragrafe.push(
      `Subsemnatul(a) ${cine}, vă rog să-mi aprobați un concediu fără plată pentru rezolvarea unor situații personale, în perioada ${perioada}.`,
    );
    note.push(
      "Concediul fără plată se acordă la cerere, pe durata stabilită prin contractul colectiv sau regulamentul intern — art. 153 din Codul muncii.",
    );
  } else {
    paragrafe.push(
      `Subsemnatul(a) ${cine}, vă rog să-mi aprobați zilele libere plătite cuvenite pentru ${o.motiv === "" ? "______________________" : o.motiv}, în perioada ${perioada}, conform regulamentului intern sau contractului colectiv de muncă aplicabil.`,
    );
    note.push(
      "Numărul de zile libere pentru evenimente familiale se stabilește prin contractul colectiv sau regulamentul intern — art. 152 din Codul muncii.",
    );
  }

  return {
    titlu: TITLU[o.tip],
    subtitlu: o.firma === "" ? null : `Către: ${o.firma}`,
    campuri: [],
    paragrafe,
    coloane: [],
    randuri: [],
    umbrite: [],
    note,
    semnaturi: ["Data și semnătura salariatului", "Aprobat (angajatorul)"],
    orientare: "portret",
    numeFisier: `cerere-${o.tip}-${o.deLa}`,
  };
}

export function cerereDinParametri(q: URLSearchParams): DocumentTabelar {
  const azi = aziIso();
  const deLa = normalizeazaData(q.get("de") ?? undefined, plusZile(azi, 14));
  return cerereCaDocument({
    tip: normalizeazaTip(q.get("tip")),
    nume: normalizeazaText(q.get("nume") ?? undefined),
    functie: normalizeazaText(q.get("functie") ?? undefined),
    firma: normalizeazaText(q.get("firma") ?? undefined),
    deLa,
    panaLa: normalizeazaData(q.get("pana") ?? undefined, plusZile(deLa, 4)),
    motiv: normalizeazaText(q.get("motiv") ?? undefined),
  });
}
```

Înainte de commit: art. 145 alin. (3), art. 152 și art. 153 se verifică pe forma consolidată a Codului muncii (doc. 128647). Dacă numerotarea diferă, se corectează în cod ȘI în test. Numele parametrilor din adresă (`de`, `pana`, `nume`…) se aliniază cu cei pe care îi citește azi `page.tsx` — `grep -n "unul(p\." page.tsx`.

- [ ] **Step 4: Rulează, trece.**

- [ ] **Step 5: Registru, pagină, metadate**

`registru.ts`: `"cerere-concediu": cerereDinParametri,` (+ import). În `page.tsx`: un `<select name="tip">` cu cele trei opțiuni (Odihnă / Fără plată / Eveniment familial), un câmp `motiv` vizibil doar ca text opțional, `<Descarcari eveniment="cerere" formate={["docx", "pdf"]} href={(f) => `/api/unelte/cerere-concediu?${q}&format=${f}`} />`, iar metadatele:

```ts
  titlu: "Cerere concediu de odihnă: model Word, PDF",
  descriere:
    "Cerere de concediu de odihnă cu zilele lucrătoare calculate, plus variantele fără plată și pentru evenimente familiale. Model gratuit în Word sau PDF.",
```

`harta.ts`: `actualizat` la data zilei. `llms.txt`: descrierea menționează Word, PDF și cele trei variante.

- [ ] **Step 6: Lanțul, verificare pe dev (`?tip=fara-plata&format=docx` → 200, fișierul se deschide în LibreOffice/Word), commit + push** (mesaj: `feat(unelte): cererea de concediu în Word și PDF, cu variantele fără plată și eveniment`).

---

## Faza 2 — Modele de documente noi

### Task 5: Foaia de parcurs

„foaie de parcurs model” (19), „…word free download” (18), „…completat” (17), „pdf” (17), „excel” (16). Legătura: `/module/flota`.

**Files:**

- Create: `src/app/(marketing)/unelte/foaie-de-parcurs/{model.ts,model.test.ts,page.tsx}`
- Modify: `src/lib/unelte/registru.ts`, `src/content/landing/unelte.ts` (`ANTET_FOAIE_PARCURS`), `src/app/(marketing)/unelte/page.tsx`, `src/content/landing/harta.ts`, `src/app/llms.txt/route.ts`

**Interfaces:**

- Consumes: `construiesteFoaie`, `normalizeazaAn`, `normalizeazaLuna`, Task 1–3.
- Produces: `construiesteFoaieParcurs(o: { an; luna; nrAuto; marca; sofer; firma }): DocumentTabelar`, `foaieParcursDinParametri(q): DocumentTabelar`

- [ ] **Step 1: Testul care pică**

```ts
import { describe, expect, it } from "vitest";

import { construiesteFoaieParcurs, foaieParcursDinParametri } from "./model";

describe("foaia de parcurs", () => {
  it("are un rând pe fiecare zi a lunii, cu data completată, și coloanele de kilometri", () => {
    const d = construiesteFoaieParcurs({
      an: 2026,
      luna: 2,
      nrAuto: "B-123-ABC",
      marca: "Dacia Logan",
      sofer: "Radu Andrei",
      firma: "",
    });
    expect(d.randuri).toHaveLength(28);
    expect(d.randuri[0]?.[0]).toBe("01.02.2026");
    expect(d.coloane.map((c) => c.eticheta)).toEqual([
      "Data",
      "Ora plecării",
      "Traseul (de la – la)",
      "Scopul deplasării",
      "Km la plecare",
      "Km la sosire",
      "Km parcurși",
      "Semnătura",
    ]);
    expect(d.campuri).toContainEqual({ eticheta: "Nr. de înmatriculare", valoare: "B-123-ABC" });
    expect(d.orientare).toBe("peisaj");
  });

  it("taie câmpurile de text la 120 de caractere", () => {
    const d = foaieParcursDinParametri(new URLSearchParams({ sofer: "x".repeat(500) }));
    expect(d.campuri.find((c) => c.eticheta === "Conducător auto")?.valoare).toHaveLength(120);
  });
});
```

- [ ] **Step 2: Rulează, pică.**

- [ ] **Step 3: Implementarea**

```ts
import type { DocumentTabelar } from "@/lib/unelte/document-tabelar";

import { construiesteFoaie, normalizeazaAn, normalizeazaLuna } from "../foaie-de-pontaj/foaie";

type Optiuni = Readonly<{
  an: number;
  luna: number;
  nrAuto: string;
  marca: string;
  sofer: string;
  firma: string;
}>;

const text = (v: string | null) => (v ?? "").trim().slice(0, 120);

export function construiesteFoaieParcurs(o: Optiuni): DocumentTabelar {
  const foaie = construiesteFoaie(o.an, o.luna, [""], 8);
  const ll = String(o.luna).padStart(2, "0");
  return {
    titlu: `Foaie de parcurs — ${foaie.eticheta}`,
    subtitlu: o.firma === "" ? null : o.firma,
    campuri: [
      { eticheta: "Nr. de înmatriculare", valoare: o.nrAuto },
      { eticheta: "Marca și modelul", valoare: o.marca },
      { eticheta: "Conducător auto", valoare: o.sofer },
    ],
    paragrafe: [],
    coloane: [
      { eticheta: "Data", latime: 2 },
      { eticheta: "Ora plecării", latime: 1.5 },
      { eticheta: "Traseul (de la – la)", latime: 6 },
      { eticheta: "Scopul deplasării", latime: 5 },
      { eticheta: "Km la plecare", latime: 2 },
      { eticheta: "Km la sosire", latime: 2 },
      { eticheta: "Km parcurși", latime: 1.5 },
      { eticheta: "Semnătura", latime: 2.5 },
    ],
    randuri: foaie.zile.map((z) => [
      `${String(z.zi).padStart(2, "0")}.${ll}.${String(o.an)}`,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]),
    umbrite: [],
    note: [
      "Total km parcurși în lună: ________   Consum normat (l/100 km): ________   Combustibil consumat (l): ________",
    ],
    semnaturi: ["Conducător auto", "Verificat (administrator)"],
    orientare: "peisaj",
    numeFisier: `foaie-de-parcurs-${String(o.an)}-${ll}`,
  };
}

export function foaieParcursDinParametri(q: URLSearchParams): DocumentTabelar {
  const acum = new Date();
  return construiesteFoaieParcurs({
    an: normalizeazaAn(q.get("an") ?? undefined, acum.getUTCFullYear()),
    luna: normalizeazaLuna(q.get("luna") ?? undefined, acum.getUTCMonth() + 1),
    nrAuto: text(q.get("auto")),
    marca: text(q.get("marca")),
    sofer: text(q.get("sofer")),
    firma: text(q.get("firma")),
  });
}
```

- [ ] **Step 4: Rulează, trece.**

- [ ] **Step 5: Antet, pagină, înregistrări**

```ts
export const ANTET_FOAIE_PARCURS: AntetPagina = {
  supratitlu: "Unealtă gratuită",
  titlu: "Foaie de parcurs",
  lead: "Scrie mașina, șoferul și luna: primești foaia de parcurs cu fiecare zi, traseul, scopul deplasării și kilometrii la plecare și la sosire. Descarci în Word, PDF sau Excel, fără cont.",
};
```

Pagina copiază structura din Task 3 Step 6 (Cadru → AntetSecundar cu firimituri → Banda „Pe scurt” → formular GET → `<Descarcari eveniment="parcurs" href={(f) => `/api/unelte/foaie-de-parcurs?${q}&format=${f}`} />` → `<PrevizualizareDocument>` → Banda finală cu link spre `/module/flota`), cu câmpurile `luna`, `an`, `auto`, `marca`, `sofer`, `firma`. Banda „Pe scurt” are titlul „La ce folosește foaia de parcurs” și explică: e documentul prin care firma justifică kilometrii și combustibilul unei mașini de serviciu; ce condiții de deductibilitate a cheltuielilor auto pune Codul fiscal se verifică pe forma consolidată (art. 25 alin. (3) lit. l) și normele de aplicare) **înainte** de a fi scrise — dacă textul nu e confirmat, banda spune doar că documentul ține evidența deplasărilor și trimite la contabil.

Metadate:

```ts
  titlu: "Foaie de parcurs: model Word, PDF și Excel",
  descriere:
    "Foaie de parcurs lunară gata de completat: fiecare zi, traseul, scopul deplasării, kilometrii la plecare și la sosire. Model gratuit în Word, PDF sau Excel.",
  cale: "/unelte/foaie-de-parcurs",
```

Registru: `"foaie-de-parcurs": foaieParcursDinParametri`. Hub, `harta.ts` (după condică), `llms.txt` — după tiparul din Task 3 Step 7.

- [ ] **Step 6: Lanțul, verificare pe dev, commit + push** (mesaj: `feat(unelte): foaia de parcurs, legată de modulul de parc auto`).

---

### Task 6: Fișa individuală de instruire SSM

„fișa instruire ssm model” (34), „fișa ssm în format electronic” (28), „completată” (19); „instruire ssm la reluarea activității” (32), „la angajare” (28), „după concediu medical” (26). Legătura: `/module/ssm`.

**Files:**

- Create: `src/app/(marketing)/unelte/fisa-instruire-ssm/{model.ts,model.test.ts,page.tsx}`
- Modify: registru, `unelte.ts` (`ANTET_FISA_SSM`), hub, `harta.ts`, `llms.txt`

**Interfaces:**

- Produces: `construiesteFisaSsm(o: { nume; functie; locMunca; firma; dataAngajarii }): DocumentTabelar`, `fisaSsmDinParametri(q)`

- [ ] **Step 0: Verifică modelul legal**

Descarcă HG 1425/2006 (normele metodologice ale Legii 319/2006), forma consolidată, și găsește anexa cu „Fișa de instruire individuală privind securitatea și sănătatea în muncă”:

```bash
curl -s "https://legislatie.just.ro/Public/DetaliiDocument/<id HG 1425/2006>" -o /tmp/hg1425.html
grep -o "Fișa de instruire individuală[^<]\{0,200\}" /tmp/hg1425.html | head
```

Notează: numărul anexei, câmpurile din antet (nume, funcție, loc de muncă, data angajării…) și coloanele tabelului de instruiri. Coloanele din Step 3 se aliniază la anexă; dacă anexa are coloane în plus, se adaugă. Tipurile de instruire (introductiv-generală, la locul de muncă, periodică, suplimentară) și intervalele periodicei se citesc din articolele normelor, cu numărul lor, pentru banda de ghid din pagină.

- [ ] **Step 1: Testul care pică**

```ts
import { describe, expect, it } from "vitest";

import { construiesteFisaSsm } from "./model";

describe("fișa individuală de instruire SSM", () => {
  it("are antetul cu datele lucrătorului și tabelul de instruiri cu cele două semnături", () => {
    const d = construiesteFisaSsm({
      nume: "Popa Ion",
      functie: "Electrician",
      locMunca: "Șantier Cluj",
      firma: "",
      dataAngajarii: "2026-10-01",
    });
    expect(d.campuri.map((c) => c.eticheta)).toEqual([
      "Numele și prenumele",
      "Funcția",
      "Locul de muncă",
      "Data angajării",
    ]);
    expect(d.coloane.map((c) => c.eticheta)).toContain("Semnătura lucrătorului instruit");
    expect(d.coloane.map((c) => c.eticheta)).toContain("Semnătura celui care a instruit");
    expect(d.randuri.length).toBeGreaterThanOrEqual(12);
    expect(d.randuri[0]?.[1]).toBe("Introductiv-generală");
    expect(d.randuri[1]?.[1]).toBe("La locul de muncă");
  });
});
```

- [ ] **Step 2: Rulează, pică.**

- [ ] **Step 3: Implementarea**

```ts
import type { DocumentTabelar } from "@/lib/unelte/document-tabelar";

type Optiuni = Readonly<{
  nume: string;
  functie: string;
  locMunca: string;
  firma: string;
  dataAngajarii: string;
}>;

const text = (v: string | null) => (v ?? "").trim().slice(0, 120);
const dataIso = (v: string | null) => (/^\d{4}-\d{2}-\d{2}$/u.test(v ?? "") ? (v as string) : "");

/**
 * Fișa individuală de instruire, după anexa din HG 1425/2006 (numărul anexei și
 * coloanele verificate la Step 0 al taskului). Primele două rânduri sunt
 * precompletate cu instruirile de la angajare, în ordinea în care se fac.
 */
export function construiesteFisaSsm(o: Optiuni): DocumentTabelar {
  const RANDURI_GOALE = 10;
  return {
    titlu: "Fișa individuală de instruire privind securitatea și sănătatea în muncă",
    subtitlu: o.firma === "" ? null : o.firma,
    campuri: [
      { eticheta: "Numele și prenumele", valoare: o.nume },
      { eticheta: "Funcția", valoare: o.functie },
      { eticheta: "Locul de muncă", valoare: o.locMunca },
      {
        eticheta: "Data angajării",
        valoare: o.dataAngajarii === "" ? "" : o.dataAngajarii.split("-").reverse().join("."),
      },
    ],
    paragrafe: [],
    coloane: [
      { eticheta: "Data", latime: 2 },
      { eticheta: "Tipul instruirii", latime: 4 },
      { eticheta: "Durata (ore)", latime: 1.5 },
      { eticheta: "Materialul predat", latime: 6 },
      { eticheta: "Semnătura lucrătorului instruit", latime: 3 },
      { eticheta: "Semnătura celui care a instruit", latime: 3 },
      { eticheta: "Verificat (conducătorul locului de muncă)", latime: 3 },
    ],
    randuri: [
      ["", "Introductiv-generală", "", "", "", "", ""],
      ["", "La locul de muncă", "", "", "", "", ""],
      ...Array.from({ length: RANDURI_GOALE }, () => ["", "", "", "", "", "", ""]),
    ],
    umbrite: [],
    note: [
      "Instruirea periodică, cea la reluarea activității după o întrerupere și cea suplimentară se trec pe rândurile următoare, cu tipul scris explicit.",
    ],
    semnaturi: [],
    orientare: "peisaj",
    numeFisier: `fisa-instruire-ssm-${o.nume === "" ? "necompletata" : o.nume}`,
  };
}

export function fisaSsmDinParametri(q: URLSearchParams): DocumentTabelar {
  return construiesteFisaSsm({
    nume: text(q.get("nume")),
    functie: text(q.get("functie")),
    locMunca: text(q.get("loc")),
    firma: text(q.get("firma")),
    dataAngajarii: dataIso(q.get("angajat")),
  });
}
```

- [ ] **Step 4: Rulează, trece.**

- [ ] **Step 5: Pagina, cu ghidul scurt de instruiri**

Antet:

```ts
export const ANTET_FISA_SSM: AntetPagina = {
  supratitlu: "Unealtă gratuită",
  titlu: "Fișa de instruire SSM",
  lead: "Fișa individuală de instruire, cu datele lucrătorului completate și rândurile pentru instruirea introductiv-generală, la locul de muncă și periodică. Descarci în Word sau PDF, fără cont.",
};
```

Metadate: `titlu: "Fișa de instruire SSM: model completabil"`, `cale: "/unelte/fisa-instruire-ssm"`, descriere cu „model”, „Word”, „PDF”, „la angajare”, „periodică”. Pagina are, înainte de formular, o bandă „Când se face fiecare instruire” cu un `<dl>` pe patru rânduri (introductiv-generală, la locul de muncă, periodică, la reluarea activității / suplimentară), fiecare cu articolul din HG 1425/2006 găsit la Step 0 — fără articol confirmat, rândul nu se scrie. La final, link spre `/module/ssm` („Scadențele instruirilor, cu alertă înainte”). `<Descarcari eveniment="ssm" formate={["docx", "pdf"]} …/>`. Registru, hub, `harta.ts`, `llms.txt` după tiparul Task 3 Step 7.

- [ ] **Step 6: Lanțul, verificare pe dev, commit + push** (mesaj: `feat(unelte): fișa individuală de instruire SSM, cu temeiul fiecărui tip de instruire`).

---

### Task 7: Fișa de evaluare a angajaților

„fișa evaluare angajați model” (25), „evaluare angajați codul muncii” (26), „evaluare anuală” (21), „criterii” (13). Legătura: `/module/evaluari`.

**Files:**

- Create: `src/app/(marketing)/unelte/fisa-evaluare/{model.ts,model.test.ts,page.tsx}`
- Modify: registru, `unelte.ts` (`ANTET_FISA_EVALUARE`), hub, `harta.ts`, `llms.txt`

**Interfaces:**

- Produces: `CRITERII_IMPLICITE: readonly string[]`, `construiesteFisaEvaluare(o: { nume; functie; perioada; evaluator; firma; criterii: readonly string[] }): DocumentTabelar`, `fisaEvaluareDinParametri(q)`

- [ ] **Step 1: Testul care pică**

```ts
import { describe, expect, it } from "vitest";

import { CRITERII_IMPLICITE, fisaEvaluareDinParametri } from "./model";

describe("fișa de evaluare", () => {
  it("fără criterii proprii folosește lista implicită, cu pondere, notă și observații", () => {
    const d = fisaEvaluareDinParametri(new URLSearchParams({ nume: "Ilie Maria" }));
    expect(d.randuri.map((r) => r[0])).toEqual([...CRITERII_IMPLICITE, "Total"]);
    expect(d.coloane.map((c) => c.eticheta)).toEqual([
      "Criteriu",
      "Pondere (%)",
      "Nota (1–5)",
      "Observații",
    ]);
  });

  it("criteriile proprii înlocuiesc lista, mărginite la 15", () => {
    const criterii = Array.from({ length: 40 }, (_, i) => `Criteriu ${String(i)}`).join("\n");
    const d = fisaEvaluareDinParametri(new URLSearchParams({ criterii }));
    expect(d.randuri).toHaveLength(15 + 1);
  });
});
```

- [ ] **Step 2: Rulează, pică.**

- [ ] **Step 3: Implementarea**

```ts
import type { DocumentTabelar } from "@/lib/unelte/document-tabelar";

export const CRITERII_IMPLICITE: readonly string[] = [
  "Cunoștințe și competențe profesionale",
  "Calitatea muncii",
  "Respectarea termenelor",
  "Comunicare și lucru în echipă",
  "Inițiativă și rezolvarea problemelor",
  "Respectarea procedurilor (SSM, regulament intern)",
];

const MAX_CRITERII = 15;
const text = (v: string | null) => (v ?? "").trim().slice(0, 120);

type Optiuni = Readonly<{
  nume: string;
  functie: string;
  perioada: string;
  evaluator: string;
  firma: string;
  criterii: readonly string[];
}>;

export function construiesteFisaEvaluare(o: Optiuni): DocumentTabelar {
  return {
    titlu: "Fișa de evaluare a performanțelor profesionale",
    subtitlu: o.firma === "" ? null : o.firma,
    campuri: [
      { eticheta: "Angajat", valoare: o.nume },
      { eticheta: "Funcția", valoare: o.functie },
      { eticheta: "Perioada evaluată", valoare: o.perioada },
      { eticheta: "Evaluator", valoare: o.evaluator },
    ],
    paragrafe: [],
    coloane: [
      { eticheta: "Criteriu", latime: 6 },
      { eticheta: "Pondere (%)", latime: 1.5 },
      { eticheta: "Nota (1–5)", latime: 1.5 },
      { eticheta: "Observații", latime: 6 },
    ],
    randuri: [...o.criterii.map((c) => [c, "", "", ""]), ["Total", "100", "", ""]],
    umbrite: [],
    note: [
      "Nota finală = suma (pondere × notă) / 100. Criteriile de evaluare se aduc la cunoștința salariatului înainte de perioada evaluată.",
    ],
    semnaturi: ["Evaluator", "Am luat la cunoștință (angajat)"],
    orientare: "portret",
    numeFisier: `fisa-evaluare-${o.nume === "" ? "necompletata" : o.nume}`,
  };
}

export function fisaEvaluareDinParametri(q: URLSearchParams): DocumentTabelar {
  const proprii = (q.get("criterii") ?? "")
    .split(/\n/u)
    .map((c) => c.trim().slice(0, 120))
    .filter((c) => c !== "")
    .slice(0, MAX_CRITERII);
  return construiesteFisaEvaluare({
    nume: text(q.get("nume")),
    functie: text(q.get("functie")),
    perioada: text(q.get("perioada")),
    evaluator: text(q.get("evaluator")),
    firma: text(q.get("firma")),
    criterii: proprii.length > 0 ? proprii : CRITERII_IMPLICITE,
  });
}
```

- [ ] **Step 4: Rulează, trece.**

- [ ] **Step 5: Pagina, cu răspunsul la „evaluare angajați codul muncii”**

Banda „Ce spune Codul muncii”, înainte de formular: dreptul angajatorului de a stabili obiectivele de performanță și criteriile de evaluare (art. 40 alin. (1) lit. f)) și obligația de a le comunica salariatului (art. 17 alin. (3) — litera exactă se citește din forma consolidată). Fără articol confirmat, fraza nu se scrie. Metadate: `titlu: "Fișa de evaluare a angajaților: model"`, `cale: "/unelte/fisa-evaluare"`. Formular: `nume`, `functie`, `perioada`, `evaluator`, `firma`, `criterii` (textarea, câte unul pe rând). `<Descarcari eveniment="evaluare" formate={["docx", "pdf", "xlsx"]} …/>`. Link final spre `/module/evaluari`. Registru, hub, `harta.ts`, `llms.txt`.

- [ ] **Step 6: Lanțul, verificare pe dev, commit + push** (mesaj: `feat(unelte): fișa de evaluare a angajaților, cu criteriile proprii ale firmei`).

---

## Faza 3 — Ghiduri

### Task 8: Diurna externă 2026 pe țări

„diurna externă 2026” (29), „germania” (24), „bulgaria” (22), „ungaria” (18), „turcia” (15), „marea britanie” (14), „pe zi” (15), „maximă neimpozabilă” (13).

**Atenție:** baremurile din `0015_per_diem.sql` sunt marcate „ORIENTATIVE, DE VERIFICAT DE JURIST”. Pagina NU le folosește. Cifrele vin din anexa HG 518/1995 în forma consolidată, transcrise cu `curl`.

**Files:**

- Modify: `src/content/legal/tipuri.ts` (+ `tabel?` în `PaginaLege`)
- Modify: `src/app/(marketing)/_componente/pagina-lege.tsx` (randarea tabelului)
- Create: `src/content/legal/diurna-externa-tari.ts`
- Create: `src/content/legal/diurna-externa-tari.test.ts`
- Create: `src/content/legal/diurna-externa.ts`
- Create: `src/app/(marketing)/ghid/diurna-externa/page.tsx`
- Modify: `src/app/(marketing)/ghid/page.tsx` (`PAGINI`), `src/content/landing/harta.ts`, `src/app/llms.txt/route.ts`, `src/content/legal/diurna.ts` (`legaturiConexe`)

**Interfaces:**

- Produces:
  - în `PaginaLege`: `tabel?: Readonly<{ titlu: string; coloane: readonly string[]; randuri: readonly (readonly string[])[]; idRand?: (rand: readonly string[]) => string; nota: string }>`
  - `type TaraDiurna = Readonly<{ tara: string; moneda: string; cuantum: number }>`; `DIURNA_EXTERNA_TARI: readonly TaraDiurna[]`; `plafonNeimpozabil(cuantum: number): number` (= 2,5 × cuantum, rotunjit la 2 zecimale)

- [ ] **Step 0: Transcrie anexa**

```bash
curl -s "https://legislatie.just.ro/Public/DetaliiDocument/<id HG 518/1995>" -o /tmp/hg518.html
grep -o "Forma consolidată[^<]\{0,80\}\|data de [0-9.]\{8,10\}" /tmp/hg518.html | head -3
```

Confirmă data consolidării (nu o formă veche — vezi Global Constraints). Extrage tabelul anexei (țara, moneda, cuantumul pe zi) cu `sed`/`python` în `/tmp/diurna-tari.tsv` și verifică manual 5 rânduri (Germania, Bulgaria, Ungaria, Franța, Marea Britanie) față de pagina din browser. Separat, confirmă în Codul fiscal (doc. 171282) art. 76 alin. (2) lit. k): plafonul neimpozabil pentru străinătate = 2,5 × nivelul legal pentru instituțiile publice, adică anexa de mai sus. Notează documentul, data și articolul în comentariul de antet al lui `diurna-externa-tari.ts`.

- [ ] **Step 1: Testul care pică**

```ts
import { describe, expect, it } from "vitest";

import { DIURNA_EXTERNA_TARI, plafonNeimpozabil } from "./diurna-externa-tari";

describe("diurna externă pe țări", () => {
  it("plafonul neimpozabil e 2,5 × cuantumul, la cenți", () => {
    expect(plafonNeimpozabil(35)).toBe(87.5);
    expect(plafonNeimpozabil(33.33)).toBe(83.33);
  });

  it("are țările căutate, fiecare o singură dată, cu cuantum pozitiv", () => {
    const nume = DIURNA_EXTERNA_TARI.map((t) => t.tara);
    for (const cautata of [
      "Germania",
      "Bulgaria",
      "Ungaria",
      "Franța",
      "Italia",
      "Spania",
      "Austria",
    ]) {
      expect(nume).toContain(cautata);
    }
    expect(new Set(nume).size).toBe(nume.length);
    for (const t of DIURNA_EXTERNA_TARI) {
      expect(t.cuantum).toBeGreaterThan(0);
      expect(t.moneda).toMatch(/^[A-Z]{3}$/u);
    }
  });

  it("e ordonată alfabetic, ca tabelul să se poată parcurge", () => {
    const nume = DIURNA_EXTERNA_TARI.map((t) => t.tara);
    expect(nume).toEqual([...nume].sort((a, b) => a.localeCompare(b, "ro")));
  });
});
```

- [ ] **Step 2: Rulează, pică.**

- [ ] **Step 3: Datele**

`src/content/legal/diurna-externa-tari.ts`:

```ts
/**
 * Cuantumul diurnei în străinătate pe țări, din anexa HG 518/1995.
 *
 * Sursa: <documentul și data consolidării de la Step 0>. Transcris cu `curl`,
 * cinci rânduri verificate manual în browser. Plafonul neimpozabil pentru
 * firmele private e 2,5 × cuantumul: Codul fiscal art. 76 alin. (2) lit. k),
 * <forma consolidată, data>.
 *
 * NU se citește din `per_diem_country_rates`: rândurile de acolo sunt marcate
 * „orientative, de verificat de jurist” (0015).
 */
export type TaraDiurna = Readonly<{ tara: string; moneda: string; cuantum: number }>;

export function plafonNeimpozabil(cuantum: number): number {
  return Math.round(cuantum * 2.5 * 100) / 100;
}

export const DIURNA_EXTERNA_TARI: readonly TaraDiurna[] = [
  // Rândurile transcrise din /tmp/diurna-tari.tsv, ordonate alfabetic (localeCompare "ro").
  // Formă: { tara: "Austria", moneda: "EUR", cuantum: <valoarea din anexă> },
];
```

Lista se completează integral din fișierul transcris la Step 0 — fiecare rând al anexei, nu doar cele căutate.

- [ ] **Step 4: Rulează, trece.**

- [ ] **Step 5: Tabelul în paginile-lege**

În `tipuri.ts`, în `PaginaLege`, după `sectiuni`:

```ts
  /**
   * Un tabel de date, pentru paginile care au o listă de consultat (diurna pe
   * țări). Opțional: paginile-lege existente nu-l au și nu se schimbă.
   */
  tabel?: Readonly<{
    titlu: string;
    coloane: readonly string[];
    randuri: readonly (readonly string[])[];
    nota: string;
  }>;
```

În `pagina-lege.tsx`, după banda secțiunilor de proză, înainte de „nesigur”:

```tsx
{
  text.tabel !== undefined && (
    <Banda inaltime="medie" titlu={text.tabel.titlu}>
      <div className="relative mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-left text-[0.9375rem]">
          <thead>
            <tr className="border-mk-rigla border-b">
              {text.tabel.coloane.map((c) => (
                <th key={c} scope="col" className="py-2 pr-4 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {text.tabel.randuri.map((r) => (
              <tr
                key={r[0]}
                id={(r[0] ?? "")
                  .normalize("NFD")
                  .replace(/[̀-ͯ]/gu, "")
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/gu, "-")}
                className="border-mk-rigla/40 border-b"
              >
                {r.map((celula, i) => (
                  <td key={`${r[0] ?? ""}-${String(i)}`} className="py-2 pr-4">
                    {celula}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-mk-text-slab mt-4 max-w-[72ch] text-[0.875rem]">{text.tabel.nota}</p>
    </Banda>
  );
}
```

`id`-ul pe rând face adresa `/ghid/diurna-externa#germania` utilizabilă din căutare și din linkuri.

- [ ] **Step 6: Conținutul paginii**

`src/content/legal/diurna-externa.ts` — `PaginaLege` completă: `cale: "/ghid/diurna-externa"`; `antet.titlu: "Diurna externă în 2026: cuantumul pe fiecare țară"`; `raspunsScurt` în trei propoziții (cuantumul pe țară din HG 518/1995, plafonul neimpozabil 2,5 × cuantum pentru firmele private, partea peste plafon e venit salarial cu impozit și contribuții); `reguli` cu temei pentru: ce e cuantumul, cine îl aplică obligatoriu (instituțiile publice) și cine doar ca reper de plafon (firmele private), plafonul de 2,5 ori, al doilea plafon de 3 salarii de bază pe lună (același ca la `/ghid/diurna`, citat de acolo, nu rescris), cum se socotește ziua de plecare/sosire (din HG 518/1995, articolul exact); `amenzi: []` (nu există contravenție pentru diurna greșit calculată — aceeași concluzie ca în `diurna.ts`, art. 260 citit); `tabel`:

```ts
  tabel: {
    titlu: "Cuantumul pe țări și plafonul neimpozabil",
    coloane: ["Țara", "Moneda", "Cuantum pe zi (HG 518/1995)", "Plafon neimpozabil (2,5 ×)"],
    randuri: DIURNA_EXTERNA_TARI.map((t) => [
      t.tara,
      t.moneda,
      t.cuantum.toFixed(2).replace(".", ","),
      plafonNeimpozabil(t.cuantum).toFixed(2).replace(".", ","),
    ]),
    nota: "Plafonul e limita până la care diurna nu se impozitează. Firma poate plăti mai mult; diferența intră în venitul salarial.",
  },
```

`nesigur`: (1) cursul de schimb aplicat la conversie (BNR din ziua plății vs. a deplasării — ce spune legea, ce nu); (2) țările care lipsesc din anexă. `legaturaSecundara: { eticheta: "Diurna în țară: cele două plafoane", href: "/ghid/diurna" }`; `legaturiConexe`: `/module/diurna`, `/ghid/diurna`; `surse`: HG 518/1995 și Codul fiscal, cu linkurile de la Step 0; `actualizatIso` / `publicatIso` = data verificării.

În `diurna.ts`, `legaturiConexe` primește `{ eticheta: "Diurna externă pe țări", href: "/ghid/diurna-externa" }`.

- [ ] **Step 7: Pagina și înregistrările**

`src/app/(marketing)/ghid/diurna-externa/page.tsx`:

```tsx
// src/app/(marketing)/ghid/diurna-externa/page.tsx
import type { Metadata } from "next";

import { DIURNA_EXTERNA } from "@/content/legal/diurna-externa";

import { metadatePagina } from "../../_componente/metadate";
import { RandarePaginaLege } from "../../_componente/pagina-lege";

export const metadata: Metadata = metadatePagina({
  titlu: "Diurna externă 2026: cuantumul pe țări",
  descriere:
    "Diurna pe fiecare țară din HG 518/1995 și plafonul neimpozabil de 2,5 ori, calculat: Germania, Bulgaria, Ungaria, Franța și restul. Cu articolul lângă fiecare regulă.",
  cale: "/ghid/diurna-externa",
});

export default function PaginaDiurnaExterna() {
  return <RandarePaginaLege text={DIURNA_EXTERNA} />;
}
```

`ghid/page.tsx`: `DIURNA_EXTERNA` intră în lista din `PAGINI` după `DIURNA`. `harta.ts`: intrare cu `actualizat: DIURNA_EXTERNA.actualizatIso`, secțiunea „Obligații legale”, după `/ghid/diurna`. `llms.txt`: descrierea cu „pe țări”, „2,5 ×”, „HG 518/1995”. `cuvinte-tinta.tsv` are deja rândurile.

- [ ] **Step 8: Lanțul, verificare pe dev (`/ghid/diurna-externa#germania` sare la rând), commit + push** (mesaj: `feat(ghid): diurna externă pe țări, din anexa HG 518/1995, cu plafonul calculat`).

---

### Task 9: Ghidul orelor suplimentare

„ore suplimentare codul muncii” (20), „…2026” (18), „în zi de sărbătoare legală” (18), „câte ore suplimentare ai voie pe lună” (16), „în weekend” (13), „part time” (13).

**Files:**

- Create: `src/content/legal/ore-suplimentare.ts`
- Create: `src/app/(marketing)/ghid/ore-suplimentare/page.tsx`
- Modify: `ghid/page.tsx`, `harta.ts`, `llms.txt`, `src/content/legal/evidenta-orelor.ts` (`legaturiConexe`)

**Interfaces:**

- Produces: `ORE_SUPLIMENTARE: PaginaLege`

- [ ] **Step 0: Verifică articolele**

Pe forma consolidată a Codului muncii (doc. 128647), citește și notează textul exact pentru: art. 112 (durata normală), art. 114 (durata maximă de 48 h pe săptămână și media pe perioada de referință), art. 120 (definiția și acordul salariatului), art. 121 (dacă există o regulă distinctă), art. 122 (compensarea cu timp liber plătit și termenul în zile), art. 123 (sporul minim, procentul), art. 124 (interdicția pentru tineri), art. 105 (timpul parțial — dacă interzice suplimentarele), art. 142 (munca în zi de sărbătoare: compensare/spor), art. 260 (contravenția pentru munca suplimentară, cuantumul). Orice număr de articol sau cifră care diferă de ce scrie mai jos se corectează în conținut; nicio cifră nu se scrie din memorie.

- [ ] **Step 1: Conținutul**

```ts
import type { PaginaLege } from "./tipuri";

/**
 * Conținutul paginii `/ghid/ore-suplimentare`.
 *
 * Întrebarea cea mai căutată — „câte ore suplimentare ai voie pe lună” — nu are
 * răspuns în lună: Codul muncii pune limita pe SĂPTĂMÂNĂ (48 h cu tot cu
 * suplimentarele), cu media pe o perioadă de referință. Pagina o spune pe față,
 * în loc să inventeze o cifră lunară.
 *
 * Sursa: Codul muncii, forma consolidată la <data de la Step 0> (doc. 128647).
 */
export const ORE_SUPLIMENTARE: PaginaLege = {
  cale: "/ghid/ore-suplimentare",
  antet: {
    supratitlu: "Obligație legală",
    titlu: "Ore suplimentare: ce spune Codul muncii în 2026",
    lead: "Limita e pe săptămână, nu pe lună; orele se compensează întâi cu timp liber, abia apoi cu bani; iar fără acordul salariatului nu se pot cere decât în situații de urgență.",
  },
  raspunsScurt: [
    "Munca suplimentară e munca peste durata normală de 8 ore pe zi și 40 pe săptămână. Durata maximă, cu tot cu suplimentarele, e de 48 de ore pe săptămână — art. 114. Codul muncii nu fixează o limită lunară: o săptămână poate trece de 48 de ore doar dacă media pe perioada de referință rămâne sub 48.",
    "Orele suplimentare se compensează întâi cu ore libere plătite, în termenul din art. 122. Dacă nu se compensează așa, se plătesc cu un spor de cel puțin 75% din salariul de bază — art. 123.",
    "Nu se pot cere fără acordul salariatului, în afara forței majore sau a lucrărilor urgente — art. 120. Tinerii sub 18 ani nu pot face ore suplimentare — art. 124.",
  ],
  titluReguli: "Regulile, cu articolul lângă fiecare",
  reguli: [
    {
      situatie: "Ce e munca suplimentară",
      cerinta: "Munca prestată în afara duratei normale a timpului de muncă.",
      temei: "art. 120 alin. (1) Codul muncii",
    },
    {
      situatie: "Acordul salariatului",
      cerinta:
        "Necesar, cu excepția forței majore și a lucrărilor urgente destinate prevenirii accidentelor sau înlăturării consecințelor lor.",
      temei: "art. 120 alin. (2) Codul muncii",
    },
    {
      situatie: "Limita",
      cerinta:
        "48 de ore pe săptămână, inclusiv suplimentarele; depășirea e permisă doar dacă media pe perioada de referință nu trece de 48.",
      temei: "art. 114 Codul muncii",
    },
    {
      situatie: "Compensarea",
      cerinta: "Cu ore libere plătite, în termenul prevăzut de lege după efectuarea orelor.",
      temei: "art. 122 Codul muncii",
    },
    {
      situatie: "Plata",
      cerinta: "Dacă nu se compensează cu timp liber: spor de cel puțin 75% din salariul de bază.",
      temei: "art. 123 Codul muncii",
    },
    {
      situatie: "Tinerii sub 18 ani",
      cerinta: "Nu pot presta muncă suplimentară.",
      temei: "art. 124 Codul muncii",
    },
  ],
  amenzi: [
    // Cuantumul și litera din art. 260, citite la Step 0. Fără confirmare, lista rămâne goală.
  ],
  sectiuni: [
    {
      titlu: "Câte ore suplimentare ai voie pe lună",
      paragrafe: [
        "Niciun articol nu dă o cifră lunară. Limita e de 48 de ore pe săptămână cu tot cu suplimentarele, deci, într-o săptămână obișnuită de 40 de ore, cel mult 8 ore suplimentare. Peste asta se poate merge doar în unele săptămâni, cu condiția ca media pe perioada de referință să rămână sub 48 de ore.",
      ],
    },
    {
      titlu: "În weekend și în zilele de sărbătoare legală",
      paragrafe: [
        "Munca în zilele de repaus și de sărbătoare are regulile ei de compensare și de spor, separate de cele ale orelor suplimentare: se aplică art. 142 pentru sărbători și art. 137 pentru repausul săptămânal. Pe aceeași oră nu se adună automat ambele sporuri — ce se cumulează depinde de contractul colectiv sau individual.",
      ],
    },
    {
      titlu: "La timp parțial",
      paragrafe: [
        "Ce spune art. 105 despre munca suplimentară a salariatului cu timp parțial, citit la Step 0.",
      ],
    },
  ],
  nesigur: [
    {
      intrebare: "Se cumulează sporul de ore suplimentare cu sporul de sărbătoare?",
      raspuns:
        "Codul muncii nu spune explicit. Practica și contractele colective diferă; pagina nu alege o variantă.",
    },
  ],
  legaturaSecundara: {
    eticheta: "Sporul de noapte: Codul muncii și calculul",
    href: "/ghid/spor-de-noapte",
  },
  legaturiConexe: [
    { eticheta: "Evidența orelor de muncă: art. 119", href: "/evidenta-orelor-de-munca" },
    { eticheta: "Modulul de pontaj", href: "/module/pontaj" },
    { eticheta: "Foaie de pontaj gratuită", href: "/unelte/foaie-de-pontaj" },
  ],
  surse: [
    {
      eticheta: "Codul muncii, forma consolidată (Portalul Legislativ)",
      href: "https://legislatie.just.ro/Public/DetaliiDocument/128647",
    },
  ],
  actualizat: "<luna anul verificării>",
  actualizatIso: "<AAAA-LL-ZZ verificării>",
  publicatIso: "<AAAA-LL-ZZ publicării>",
};
```

Secțiunea „La timp parțial” se rescrie cu concluzia citită la Step 0; dacă art. 105 nu mai conține regula, secțiunea se scoate. Cele trei câmpuri de dată se completează cu datele reale ale verificării și publicării.

- [ ] **Step 2: Pagina și înregistrările**

`page.tsx` după tiparul din Task 8 Step 7, cu `titlu: "Ore suplimentare: ce spune Codul muncii"` (40 de caractere), `cale: "/ghid/ore-suplimentare"`. `ghid/page.tsx`, `harta.ts` (`actualizat: ORE_SUPLIMENTARE.actualizatIso`), `llms.txt`, iar `evidenta-orelor.ts` primește link conex spre ghid. Testul `articolele legale poartă data verificării` din `continut.test.ts` acoperă datele.

- [ ] **Step 3: Lanțul, verificare pe dev, commit + push** (mesaj: `feat(ghid): orele suplimentare — limita e pe săptămână, nu pe lună`).

---

### Task 10: Ghidul sporului de noapte

„spor de noapte codul muncii” (28), „calcul” (16), „25 la sută” (15), „noapte și weekend” (16).

**Files:**

- Create: `src/content/legal/spor-de-noapte.ts`
- Create: `src/app/(marketing)/ghid/spor-de-noapte/page.tsx`
- Modify: `ghid/page.tsx`, `harta.ts`, `llms.txt`

**Interfaces:**

- Produces: `SPOR_DE_NOAPTE: PaginaLege`

- [ ] **Step 0: Verifică articolele** — art. 125 (intervalul 22:00–6:00, definiția salariatului de noapte: cel puțin 3 ore din timpul zilnic sau cel puțin 30% din timpul lunar), art. 126 (program redus cu o oră SAU spor de cel puțin 25%), art. 127 (examenul medical), art. 128 (cine nu poate lucra noaptea), pe forma consolidată. Motorul produsului aplică pragul de 3 ore (`pragOreNoapte`, comentariul din `src/domain/payroll/calc.ts`) — conținutul trebuie să spună același lucru.

- [ ] **Step 1: Conținutul** — `PaginaLege` cu `cale: "/ghid/spor-de-noapte"`, `antet.titlu: "Sporul de noapte în Codul muncii: 25% și cele 3 ore"`; `raspunsScurt`: munca de noapte e între 22 și 6; salariatul de noapte (cel puțin 3 ore pe zi sau 30% pe lună în intervalul acela) primește fie program redus cu o oră fără scăderea salariului, fie un spor de cel puțin 25% din salariul de bază — art. 126; angajatorul alege una dintre ele, nu le datorează pe amândouă. `reguli` cu temei pentru art. 125, 126, 127, 128. `sectiuni`: „Cum se calculează sporul” cu un exemplu numeric (salariu de bază 5.000 lei, 168 de ore normă în lună, 40 de ore de noapte → 5.000 / 168 × 40 × 25% = 297,62 lei — calculul se refăcut în test, vezi Step 2), „Noaptea în weekend sau de sărbătoare” (sporurile au temeiuri diferite; cumulul depinde de contract — trimite la `/ghid/ore-suplimentare`). `nesigur`: „sporul de noapte la pensie / adeverința după 2001” — pagina spune că e o întrebare de drept al pensiilor, nu de Cod al muncii, și nu răspunde. `legaturaSecundara` spre `/ghid/ore-suplimentare`; `legaturiConexe`: `/module/pontaj`, `/module/salarizare`.

- [ ] **Step 2: Testul exemplului numeric**

În `src/content/legal/spor-de-noapte.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { SPOR_DE_NOAPTE } from "./spor-de-noapte";

describe("ghidul sporului de noapte", () => {
  it("exemplul numeric din pagină e calculat corect", () => {
    const exemplu = SPOR_DE_NOAPTE.sectiuni.find((s) => s.titlu === "Cum se calculează sporul");
    const corect = Math.round((5000 / 168) * 40 * 0.25 * 100) / 100; // 297,62
    expect(exemplu?.paragrafe.join(" ")).toContain(corect.toFixed(2).replace(".", ","));
  });
});
```

Run: `pnpm exec vitest run src/content/legal/spor-de-noapte.test.ts` → FAIL până la Step 1, apoi PASS.

- [ ] **Step 3: Pagina** (`titlu: "Spor de noapte: Codul muncii și calculul"`, 40 de caractere), `ghid/page.tsx`, `harta.ts`, `llms.txt`.

- [ ] **Step 4: Lanțul, commit + push** (mesaj: `feat(ghid): sporul de noapte — 25% sau o oră mai puțin, cu exemplul calculat`).

---

### Task 11: Zilele de concediu și registrul din REGES-Online

Concediul e deja pe poziția 5,8 pentru „câte zile de concediu ai pe lună”: se extinde pagina existentă, nu se face una nouă. „registru salariați reges online” (27), „generare registru salariați” (23): secțiune nouă pe `/reges-online`.

**Files:**

- Modify: `src/content/legal/concediu-odihna.ts` (secțiuni noi + `actualizatIso`)
- Modify: `src/content/legal/reges.ts` (secțiune nouă + `actualizatIso`)
- Modify: `src/app/llms.txt/route.ts` (cele două descrieri)

- [ ] **Step 0: Verifică**
  - Codul muncii: art. 145 (durata minimă de 20 de zile lucrătoare; ce spune despre vechime — Codul nu acordă zile suplimentare pentru vechime, le pot da contractele), art. 146 alin. (4) (compensarea în bani a concediului neefectuat doar la încetarea contractului), regimul concediului în perioada de preaviz (art. 75 și ce spune despre suspendare).
  - REGES-Online: pașii de generare a registrului salariaților din ghidul oficial al Inspecției Muncii (inspectiamuncii.ro) și din HG 295/2025; memoria proiectului `reges-api-fapte-verificate.md` pentru ce e verificat deja. Fără o sursă oficială pentru fiecare pas, secțiunea spune doar ce e registrul, cine îl ține și unde se găsește în aplicație, fără pași de interfață.

- [ ] **Step 1: Secțiunile din concediu** — adaugă în `sectiuni`, în ordinea asta: „Câte zile de concediu ai pe lună” (20 de zile pe an ÷ 12 ≈ 1,67 zile pe lună lucrată; concediul se calculează proporțional cu activitatea), „Zile în funcție de vechime” (Codul muncii nu le dă; contractul colectiv, individual sau regulamentul intern pot), „Concediul neefectuat” (art. 146 alin. (4): compensare în bani doar la încetarea contractului), „Concediul în preaviz” (concluzia citită la Step 0). Ridică `actualizatIso` la data verificării.

- [ ] **Step 2: Secțiunea din REGES** — „Registrul salariaților din REGES-Online”, după regulile de la Step 0. Ridică `actualizatIso`.

- [ ] **Step 3: Lanțul (testul `pasajele care merită citate` și `articolele legale poartă data verificării` rulează pe ele), commit + push** (mesaj: `feat(ghid): zilele de concediu pe lună și la încetare; registrul salariaților din REGES-Online`).

---

## Faza 4 — Calculatorul de salariu (blocat pe confirmarea contabilului)

Cererea cea mai mare din toată cercetarea, și riscul cel mai mare: o cifră greșită la leu, pe o pagină publică, în fața exact a publicului care contează. Task 12 și 13 se pot comite; Task 14 (pagina) nu începe până când contabilul nu confirmă valorile.

### Task 12: Valorile legale, cu poarta contabilului

**Files:**

- Create: `src/content/legal/salarizare-publica.ts`
- Create: `src/content/legal/salarizare-publica.test.ts`

**Interfaces:**

- Consumes: `PayrollSettingsSnapshot`, `PragDeducerePersonala` din `src/domain/payroll/calc.ts`
- Produces: `SETARI_SALARIZARE_PUBLICE: PayrollSettingsSnapshot & { readonly verificatDeContabil: boolean; readonly sursa: string }`

- [ ] **Step 0: Valorile de pornire**

```bash
grep -n "insert into public.payroll_settings" -A40 supabase/migrations/0026_payroll.sql | head -60
grep -rn "salariu_minim\|deducere_personala" supabase/migrations/0146_bani_si_timp.sql | head
```

Copiază structura (cote CAS, CASS, impozit, CAM, grila deducerii personale, salariul minim, suma neimpozabilă dacă există) din valorile implicite ale produsului. Lista se trimite contabilului, cu întrebarea: „sunt valorile în vigoare pentru octombrie 2026, și pentru salariul minim, inclusiv schimbarea din iulie 2026?” (sugestiile Google arată „salariu minim iulie 2026”).

- [ ] **Step 1: Testul**

```ts
import { describe, expect, it } from "vitest";

import { SETARI_SALARIZARE_PUBLICE as S } from "./salarizare-publica";

describe("valorile legale ale calculatorului public", () => {
  it("cotele sunt fracții plauzibile, nu procente scrise ca 25", () => {
    for (const cota of [S.cotaCas, S.cotaCass, S.cotaImpozit, S.cotaCamAngajator]) {
      expect(cota).toBeGreaterThan(0);
      expect(cota).toBeLessThan(1);
    }
  });

  it("grila deducerii personale e ordonată și acoperă 0–4+ persoane", () => {
    const persoane = new Set(S.deducerePersonala.map((p) => p.nrPersoaneIntretinereMin));
    for (const n of [0, 1, 2, 3, 4]) expect(persoane.has(n)).toBe(true);
  });

  it("poarta: pagina publică cere confirmarea contabilului", () => {
    // Testul ăsta e DOCUMENTAȚIE executabilă: calculatorul nu se publică cu `false`.
    expect(typeof S.verificatDeContabil).toBe("boolean");
    expect(S.sursa.length).toBeGreaterThan(10);
  });
});
```

- [ ] **Step 2: Rulează, pică. Step 3: scrie constanta** cu valorile de la Step 0, `verificatDeContabil: false`, `sursa: "Valorile implicite ale produsului (0026, 0146), trimise contabilului pe <data>."`. **Step 4: rulează, trece. Step 5: commit + push** (mesaj: `feat(salarizare): valorile legale ale calculatorului public, nepublicate până la confirmare`).

### Task 13: Brut → net și net → brut, prin motorul produsului

Calculatorul public nu are voie să calculeze altfel decât produsul: folosește `calculatePayrollEntry`, cu o lună întreagă lucrată și fără sporuri.

**Files:**

- Create: `src/lib/unelte/salariu.ts`
- Create: `src/lib/unelte/salariu.test.ts`

**Interfaces:**

- Consumes: `calculatePayrollEntry(input: PayrollCalcInput): PayrollCalcResult`, `SETARI_SALARIZARE_PUBLICE`
- Produces:
  - `type RezultatSalariu = Readonly<{ brut: number; cas: number; cass: number; deducerePersonala: number; impozit: number; net: number; cam: number; costTotal: number }>`
  - `dinBrut(brut: number, persoane: number, functieDeBaza: boolean): RezultatSalariu`
  - `dinNet(net: number, persoane: number, functieDeBaza: boolean): RezultatSalariu`

- [ ] **Step 0: Citește contractul motorului**

```bash
sed -n '196,330p' src/domain/payroll/calc.ts
grep -n "readonly net\|readonly impozit\|readonly cam\|functieDeBaza\|functie_de_baza" src/domain/payroll/calc.ts
```

Notează câmpurile obligatorii din `EmployeeContractSnapshot` și `AttendanceSummary` și numele câmpurilor de rezultat pentru net, impozit și CAM. Testele și implementarea de mai jos le folosesc; dacă un nume diferă, se folosește numele real.

- [ ] **Step 1: Testele**

```ts
import { describe, expect, it } from "vitest";

import { dinBrut, dinNet } from "./salariu";

describe("calculul public de salariu", () => {
  it("netul crește cu brutul (monoton)", () => {
    let anterior = -1;
    for (let brut = 4000; brut <= 20000; brut += 500) {
      const { net } = dinBrut(brut, 0, true);
      expect(net).toBeGreaterThan(anterior);
      anterior = net;
    }
  });

  it("net → brut → net se închide la cel mult 1 leu", () => {
    for (const net of [3000, 4500, 7000, 12000]) {
      const r = dinNet(net, 1, true);
      expect(Math.abs(r.net - net)).toBeLessThanOrEqual(1);
    }
  });

  it("persoanele în întreținere nu scad netul", () => {
    expect(dinBrut(5000, 2, true).net).toBeGreaterThanOrEqual(dinBrut(5000, 0, true).net);
  });

  it("intrările absurde sunt mărginite, nu aruncă", () => {
    expect(() => dinBrut(-100, 0, true)).not.toThrow();
    expect(() => dinNet(10_000_000, 99, true)).not.toThrow();
  });

  // Vectorii de control: 3 cazuri calculate de mână de contabil, adăugate când confirmă.
  // it("caz contabil 1: brut X, 0 persoane, funcție de bază → net Y", () => { ... });
});
```

Vectorii de control ai contabilului (brut, persoane → net, la leu) se adaugă ca teste `it(...)` concrete în momentul confirmării; până atunci, testele de proprietate de mai sus țin motorul pe loc.

- [ ] **Step 2: Rulează, pică. Step 3: implementarea**

```ts
import { SETARI_SALARIZARE_PUBLICE } from "@/content/legal/salarizare-publica";
import { calculatePayrollEntry, type PayrollCalcInput } from "@/domain/payroll/calc";

export type RezultatSalariu = Readonly<{
  brut: number;
  cas: number;
  cass: number;
  deducerePersonala: number;
  impozit: number;
  net: number;
  cam: number;
  costTotal: number;
}>;

const BRUT_MIN = 1;
const BRUT_MAX = 500_000;
const mărginește = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));

/**
 * O lună întreagă, fără absențe, fără sporuri, fără tichete: exact întrebarea
 * „cât iese net din brutul ăsta”. Câmpurile contractului și ale pontajului se
 * completează cu valorile „fără efect” (0, [], null) — numele lor vin din Step 0.
 */
function intrare(brut: number, persoane: number, functieDeBaza: boolean): PayrollCalcInput {
  const zile = 21;
  return {
    settings: SETARI_SALARIZARE_PUBLICE,
    contract: {
      salariuBaza: brut,
      nrPersoaneIntretinere: functieDeBaza ? persoane : 0,
      // … restul câmpurilor obligatorii din EmployeeContractSnapshot, cu valoarea „fără efect”
    },
    attendance: {
      zileLucratoareLuna: zile,
      zileLucrate: zile,
      oreLucrate: zile * SETARI_SALARIZARE_PUBLICE.normaZilnicaOre,
      oreSuplimentare: 0,
      oreNoapte: 0,
      zileConcediuOdihna: 0,
      zileConcediuMedical: 0,
      zileAbsentaNemotivata: 0,
    },
    bonuses: [],
  } as PayrollCalcInput;
}

export function dinBrut(brut: number, persoane: number, functieDeBaza: boolean): RezultatSalariu {
  const b = Math.round(mărginește(brut, BRUT_MIN, BRUT_MAX));
  const p = Math.round(mărginește(persoane, 0, 10));
  const r = calculatePayrollEntry(intrare(b, p, functieDeBaza));
  return {
    brut: r.brut,
    cas: r.cas,
    cass: r.cass,
    deducerePersonala: r.deducerePersonala,
    impozit: r.impozit,
    net: r.net,
    cam: r.cam,
    costTotal: r.brut + r.cam,
  };
}

/** Bisecție pe brut: netul e monoton în brut (testul o cere), deci căutarea converge. */
export function dinNet(net: number, persoane: number, functieDeBaza: boolean): RezultatSalariu {
  const tinta = mărginește(net, BRUT_MIN, BRUT_MAX);
  let jos = BRUT_MIN;
  let sus = BRUT_MAX;
  for (let i = 0; i < 40 && sus - jos > 0.5; i += 1) {
    const mijloc = (jos + sus) / 2;
    if (dinBrut(mijloc, persoane, functieDeBaza).net < tinta) jos = mijloc;
    else sus = mijloc;
  }
  return dinBrut(Math.ceil(sus), persoane, functieDeBaza);
}
```

Cast-ul `as PayrollCalcInput` se scoate după ce toate câmpurile obligatorii sunt completate — `tsc` le numește pe cele lipsă. Numele `r.impozit`, `r.net`, `r.cam` se aliniază la Step 0.

- [ ] **Step 4: Rulează, trece. Step 5: lanțul, commit + push** (mesaj: `feat(salarizare): brut↔net prin același motor ca produsul, pentru calculatorul public`).

### Task 14: Pagina calculatorului — DOAR după confirmarea contabilului

**Precondiție:** contabilul a confirmat valorile; `verificatDeContabil: true`; cele trei teste-vector din Task 13 există și trec.

**Files:**

- Create: `src/app/(marketing)/unelte/calculator-salariu/page.tsx`
- Modify: `src/content/landing/unelte.ts` (`ANTET_CALCULATOR`), hub, `harta.ts`, `llms.txt`, `src/content/landing/fise-module.ts` (`ghiduri` la `payroll`)

- [ ] **Step 1:** Pagină server cu formular GET: `suma` (număr), `din` (`brut` | `net`), `persoane` (0–4+), `baza` (funcție de bază da/nu). Sub formular, tabelul desfășurat: brut, CAS, CASS, deducere personală, impozit, net, CAM, cost total angajator. Metadate: `titlu: "Calculator salariu net și brut 2026"` (35), `cale: "/unelte/calculator-salariu"`. O bandă „Salariul minim pe economie în 2026” cu valoarea din `SETARI_SALARIZARE_PUBLICE.salariuMinimBrut` și netul ei calculat cu `dinBrut` (nu scris de mână). Mențiunea vizibilă: „Calculul folosește același motor ca modulul de salarizare. Valorile legale au fost verificate de contabil pe <data>.” Link spre `/module/salarizare` („Calculul pentru toată firma, din pontajul închis”).
- [ ] **Step 2:** Garda din pagină: `if (!SETARI_SALARIZARE_PUBLICE.verificatDeContabil) notFound();` — o plasă în plus dacă flagul e coborât vreodată.
- [ ] **Step 3:** Hub, `harta.ts`, `llms.txt`, iar fișa `payroll` primește în `ghiduri` `{ href: "/unelte/calculator-salariu", eticheta: "Calculator salariu net și brut" }` și `actualizat` la data zilei.
- [ ] **Step 4:** Lanțul, verificare pe dev cu cele trei cazuri ale contabilului introduse în formular — cifrele de pe ecran = cifrele contabilului. Commit + push (mesaj: `feat(unelte): calculatorul de salariu net și brut, cu valorile confirmate de contabil`).

---

## Faza 5 — Legăturile inverse

### Task 15: Fiecare modul trimite la unealta și ghidul lui

O pagină nouă la care nu trimite nimic e „descoperită, neindexată” (exact ce s-a văzut pe 2 oct cu cele opt module). Fișele de modul au deja câmpul `ghiduri`; subsolul are coloana „Produs”.

**Files:**

- Modify: `src/content/landing/fise-module.ts` (`ghiduri` + `actualizat` la `attendance`, `fleet`, `ssm`, `evaluations`, `per_diem`, `leave`)
- Modify: `src/content/landing/ro.ts` (`subsol.coloane`)
- Test: `src/content/landing/continut.test.ts` (testele existente acoperă linkurile)

- [ ] **Step 1: Legăturile din fișe**

| Fișa (`cheie`) | Se adaugă în `ghiduri`                                                                                                                                                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `attendance`   | `{ href: "/unelte/condica-de-prezenta", eticheta: "Condica de prezență: model gratuit" }`, `{ href: "/ghid/ore-suplimentare", eticheta: "Ore suplimentare: limita și plata" }`, `{ href: "/ghid/spor-de-noapte", eticheta: "Sporul de noapte: 25% și cele 3 ore" }` |
| `fleet`        | `{ href: "/unelte/foaie-de-parcurs", eticheta: "Foaie de parcurs: model gratuit" }`                                                                                                                                                                                 |
| `ssm`          | `{ href: "/unelte/fisa-instruire-ssm", eticheta: "Fișa de instruire SSM: model" }`                                                                                                                                                                                  |
| `evaluations`  | `{ href: "/unelte/fisa-evaluare", eticheta: "Fișa de evaluare: model" }`                                                                                                                                                                                            |
| `per_diem`     | `{ href: "/ghid/diurna-externa", eticheta: "Diurna externă pe țări" }`                                                                                                                                                                                              |
| `leave`        | `{ href: "/unelte/cerere-concediu-de-odihna", eticheta: "Cerere de concediu: Word și PDF" }`                                                                                                                                                                        |

Dacă fișa nu are încă `ghiduri`, câmpul se creează; dacă are, se adaugă la listă. `actualizat` la data zilei pe fiecare fișă atinsă (poarta `lastmod` o cere).

- [ ] **Step 2: Subsolul**

În `ro.ts`, coloana „Produs”: rândul `{ eticheta: "Foaie de pontaj gratuită", href: "/unelte/foaie-de-pontaj" }` rămâne; se adaugă după el `{ eticheta: "Condica de prezență", href: "/unelte/condica-de-prezenta" }`. Coloana „Înainte să întrebi”: se adaugă `{ eticheta: "Diurna externă pe țări", href: "/ghid/diurna-externa" }` după REGES. Restul uneltelor ajung din hub-ul `/unelte`, deja legat din subsol. În `harta.ts`, `actualizat` pentru `/` rămâne neatins (subsolul e șablon, nu conținut).

- [ ] **Step 3: Lanțul + poarta lastmod + commit + push** (mesaj: `feat(seo): fiecare modul trimite la unealta și ghidul lui`).

---

## Faza 6 — Lansare și măsurare

### Task 16: Lansarea fiecărei faze

Se repetă la finalul fazelor 1, 2, 3, 4 și 5. Nu e cod: e procedura care face ca o pagină comisă să ajungă în index.

- [ ] **Step 1:** CI și staging verzi pentru ultimul commit, cu durata verificată (un workflow sub 30 de secunde a sărit pași — memoria `erp-workflow-verde-prin-sarire`):

```bash
gh run list --limit 4 --json name,headSha,status,conclusion,createdAt,updatedAt
```

- [ ] **Step 2:** Utilizatorul face deploy în producție (`./administrativo.sh`). Agentul nu face deploy în producție.
- [ ] **Step 3:** Poarta pe site-ul viu, 10 cereri pe adresă:

```bash
node scripts/checks/rute-publice.mjs
```

Expected: toate adresele din sitemap 200 și indexabile.

- [ ] **Step 4:** Retrimite sitemap-ul și inspectează paginile noi:

```bash
~/.claude/plugins/data/claude-seo-agricidaniel-claude-seo/.venv/bin/python - <<'EOF'
import os, json
from google.oauth2 import service_account
from googleapiclient.discovery import build
cfg = json.load(open(os.path.expanduser("~/.config/claude-seo/google-api.json")))
cr = service_account.Credentials.from_service_account_file(cfg["service_account_path"], scopes=["https://www.googleapis.com/auth/webmasters"])
s = build("searchconsole", "v1", credentials=cr, cache_discovery=False)
s.sitemaps().submit(siteUrl="sc-domain:administrativo.ro", feedpath="https://administrativo.ro/sitemap.xml").execute()
print(s.sitemaps().get(siteUrl="sc-domain:administrativo.ro", feedpath="https://administrativo.ro/sitemap.xml").execute())
EOF
printf '%s\n' https://administrativo.ro/unelte/condica-de-prezenta > /tmp/noi.txt   # + restul paginilor fazei
"$HOME/.claude/plugins/cache/agricidaniel-claude-seo/claude-seo/2.3.1/scripts/claude-seo" run gsc_inspect.py --batch /tmp/noi.txt --json
```

Pe 2 oct, retrimiterea a adus 8 pagini în index în 3–9 minute. Paginile rămase „necunoscute” după 48 de ore: utilizatorul apasă „Solicită indexarea” în Search Console (nu există API pentru asta; Indexing API e doar pentru joburi și transmisiuni live și nu se folosește).

### Task 17: Măsurarea săptămânală și regulile de decizie

- [ ] **Step 1: În fiecare luni**, rulează `scripts/seo/pozitii.py >> docs/comercial/cuvinte-cheie-progres.md`, comite fișierul (`chore(seo): pozițiile săptămânii <data>`), push.
- [ ] **Step 2: Regulile, aplicate la 4, 8 și 12 săptămâni după indexarea fiecărei pagini:**

| Ce arată tabelul                         | Ce înseamnă                            | Ce se face                                                                                          |
| ---------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Termen „—” la 4 săptămâni după indexare  | Google nu leagă pagina de termen       | Termenul exact în titlu, H1 și primul paragraf; verifică intenția pe prima pagină de rezultate      |
| Afișări, poziție > 20                    | Relevantă, dar slabă                   | Mai mult conținut propriu (secțiuni, întrebări), legături interne din 2–3 pagini indexate           |
| Poziție 8–20                             | Aproape                                | Titlu și descriere mai bune pentru clic; un link din afară (pasul B din `vizibilitate-organica.md`) |
| Poziție < 8, CTR < 2%                    | Văzută, neapăsată                      | Rescrie titlul și descrierea pe beneficiul concret („gata completată”, „fără cont”)                 |
| „❌ pe țintă”                            | Google arată altă pagină pentru termen | Pagina greșită primește un link cu termenul spre pagina-țintă; se verifică dublura de subiect       |
| Clicuri pe unealtă, zero vizite pe modul | Unealta nu duce mai departe            | Banda finală a uneltei se mută mai sus, cu un caz concret                                           |

- [ ] **Step 3: Evenimentele Umami** (`foaie-pdf`, `condica-docx`, `parcurs-pdf`…) se citesc lunar cu `scripts/umami-goaluri.sh`: ce format se descarcă cel mai des decide ordinea linkurilor.

### Task 18: Promovarea — pasul pe care codul nu-l poate face

Planul existent spune că primul link din afară e pasul cel mai important. Uneltele noi sunt exact genul de pagină la care alte situri trimit singure.

- [ ] **Step 1:** Câte o postare de LinkedIn pe unealtă, prin skill-ul `administrativo-postari`, în loturile din `docs/comercial/linkedin/` (o unealtă pe săptămână, cu linkul direct, nu spre pagina de start).
- [ ] **Step 2:** Utilizatorul trimite linkul condicii și al foii de pontaj contabililor din pilot (vezi `docs/comercial/vizibilitate-organica.md` pasul D) — un contabil care pune linkul pe situl cabinetului e primul link real.
- [ ] **Step 3:** Fiecare unealtă intră în `llms.txt` (deja, din task-uri) — asistenții AI citează uneltele gratuite când cineva întreabă „model condică de prezență”.

---

## Ordinea și estimarea

| Faza | Task-uri                                         | Depinde de                              | Durată estimată                              |
| ---- | ------------------------------------------------ | --------------------------------------- | -------------------------------------------- |
| 0    | 0                                                | —                                       | 1 h                                          |
| 1    | 1 → 2 → 3 → 4                                    | 1 înaintea tuturor                      | 1,5–2 zile                                   |
| 2    | 5, 6, 7 (oricare ordine)                         | 1, 3                                    | 1,5 zile                                     |
| 3    | 8, 9, 10, 11 (oricare ordine)                    | 8 înaintea celorlalte doar pentru tabel | 2 zile, din care jumătate verificare de lege |
| 4    | 12 → 13 → (contabil) → 14                        | —                                       | 1 zi + așteptarea contabilului               |
| 5    | 15                                               | paginile la care trimite                | 2 h                                          |
| 6    | 16 după fiecare fază; 17 săptămânal; 18 continuu | —                                       | —                                            |

**Așteptări realiste** (din `vizibilitate-organica.md` §6, ajustat cu ritmul de indexare văzut pe 2 oct): indexare în zile după retrimiterea sitemap-ului; primele afișări pe termenii lungi („condica de prezență model word”) în 2–4 săptămâni; pagina 1–2 pe 5–10 termeni din tabelul de mai sus la 3 luni, dacă se face și pasul de promovare; termenii comerciali („program salarizare”) rămân o țintă de 6 luni+, pe linkuri acumulate.
