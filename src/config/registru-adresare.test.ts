// Poarta registrului de adresare și a glosarului (docs/design/ecrane/glosar.md).
//
// Trăiește sub `src/` din același motiv ca `docs.test.ts`: proiectul `unit` din
// `vitest.config.mts` include doar `src/**/*.test.ts`, deci aici rulează pe
// `pnpm test` → `pnpm verify` → CI.
//
// Scanează DOAR textul văzut de om — șirurile și textul JSX, extrase cu
// parserul TypeScript —, nu identificatorii: `checklists:read`,
// `checklist_instances`, `NavOnboarding` sau `/onboarding/noua` rămân cum sunt
// (secțiunea (d) din glosar). Șirurile fără spații și fără majuscule sunt
// tratate drept identificatori (chei de permisiune, tabele, rute, clase CSS de
// un cuvânt) și sărite. Argumentele lui `console.*` nu ajung la om.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const RADACINA = join(__dirname, "..", "..");

const TINTE = [
  "src/app/(app)",
  "src/app/(portal)",
  "src/app/(auth)",
  "src/app/(onboarding)",
  "src/components",
  "src/lib/asistent/destinatii.ts",
  "src/lib/incarcare/stiati-ca.ts",
];

// Granițe de cuvânt conștiente de diacritice: `\b` din JS tratează „ț” ca
// non-literă, deci „ta” s-ar potrivi în „fișa ta” dar și în „ț|ta”.
const I = "(?<![\\p{L}\\p{N}_])";
const S = "(?![\\p{L}\\p{N}_])";

interface Regula {
  readonly nume: string;
  readonly tipar: RegExp;
  /**
   * Se aplică și șirurilor care arată a identificator. „dvs.” singur
   * (`esteFisaProprie ? "dvs." : …`) n-are spații și n-are majuscule, dar e
   * text pe ecran; un cod ca `checklist` n-are cum să conțină „îți”.
   */
  readonly siInIdentificatori?: boolean;
}

const REGULI: readonly Regula[] = [
  {
    nume: "„dvs.” — se scrie „dumneavoastră”",
    tipar: new RegExp(`${I}dvs\\.`, "giu"),
    siInIdentificatori: true,
  },
  {
    siInIdentificatori: true,
    nume: "persoana a doua singular — se scrie la „dumneavoastră”",
    tipar: new RegExp(
      `${I}(tău|tăi|tale|ta|îți|ți-am|ți-a|le-ai|ai ales|ai nevoie|ai acces|ai găsit|ai trimis|ai deschis|ai timp|ai deja|ai făcut|poți|vrei|deschizi|completezi|creezi|închizi|încarci|primești|intri)${S}`,
      "giu",
    ),
  },
  { nume: "„Onboarding” — se scrie „Integrare”", tipar: new RegExp(`${I}Onboarding${S}`, "gu") },
  {
    nume: "„checklist” — se scrie „parcurs”",
    tipar: new RegExp(`${I}[Cc]hecklist(ul|uri|urile|ului|urilor)?${S}`, "gu"),
  },
  {
    nume: "„instanță” — se scrie „parcurs”",
    tipar: new RegExp(`${I}[Ii]nstanț(ă|e|a|ei|ele|elor)${S}`, "gu"),
  },
  { nume: "„Ticketing IT” — se scrie „Tichete IT”", tipar: /Ticketing IT/gu },
  {
    nume: "„Ieșire din organizație” — se scrie „Plecare din firmă”",
    tipar: /Ieșire din organizație/gu,
  },
];

// Cazuri legitime, numite explicit: fișier + fragmentul de text care le face
// legitime. Fiecare intrare e o decizie, nu o scăpare.
const EXCEPTII: readonly { readonly fisier: string; readonly fragment: string }[] = [
  // „instanța” = tribunalul, în registrul de documente primite.
  { fisier: "src/app/(app)/registru/dialog-document-primit.tsx", fragment: "instanț" },
];

function fisiere(cale: string): string[] {
  const absoluta = join(RADACINA, cale);
  if (statSync(absoluta).isFile()) return [absoluta];
  const rezultat: string[] = [];
  for (const intrare of readdirSync(absoluta, { withFileTypes: true })) {
    const copil = join(absoluta, intrare.name);
    if (intrare.isDirectory()) {
      rezultat.push(...fisiere(relative(RADACINA, copil)));
    } else if (/\.(ts|tsx)$/.test(intrare.name) && !/\.test\.(ts|tsx)$/.test(intrare.name)) {
      rezultat.push(copil);
    }
  }
  return rezultat;
}

const esteIdentificator = (continut: string): boolean =>
  /^[a-z0-9_.:/@\-[\]()*#?=&,]*$/.test(continut);

const esteConsola = (nod: ts.Node): boolean =>
  ts.isCallExpression(nod) &&
  ts.isPropertyAccessExpression(nod.expression) &&
  ts.isIdentifier(nod.expression.expression) &&
  nod.expression.expression.text === "console";

interface Fragment {
  readonly text: string;
  readonly start: number;
  readonly identificator: boolean;
}

function fragmenteDeText(sursa: ts.SourceFile): Fragment[] {
  const rezultat: Fragment[] = [];
  const viziteaza = (nod: ts.Node): void => {
    if (esteConsola(nod) || ts.isImportDeclaration(nod) || ts.isExportDeclaration(nod)) return;
    if (
      ts.isStringLiteral(nod) ||
      ts.isNoSubstitutionTemplateLiteral(nod) ||
      ts.isTemplateHead(nod) ||
      ts.isTemplateMiddle(nod) ||
      ts.isTemplateTail(nod)
    ) {
      rezultat.push({
        text: nod.getText(sursa),
        start: nod.getStart(sursa),
        identificator: esteIdentificator(nod.text),
      });
    } else if (ts.isJsxText(nod)) {
      rezultat.push({
        text: sursa.text.slice(nod.pos, nod.end),
        start: nod.pos,
        identificator: false,
      });
    }
    ts.forEachChild(nod, viziteaza);
  };
  viziteaza(sursa);
  return rezultat;
}

function incalcari(): string[] {
  const gasite: string[] = [];
  for (const tinta of TINTE) {
    for (const absoluta of fisiere(tinta)) {
      const cale = relative(RADACINA, absoluta);
      const text = readFileSync(absoluta, "utf8");
      // Filtru ieftin înaintea parserului: un fișier în care niciun tipar nu
      // apare nicăieri (nici în comentarii) n-are cum să încalce regula.
      // Parsarea tuturor celor ~850 de fișiere costa 10–20 s; așa parsăm câteva
      // zeci.
      const suspect = REGULI.some((regula) => {
        regula.tipar.lastIndex = 0;
        return regula.tipar.test(text);
      });
      if (!suspect) continue;
      const sursa = ts.createSourceFile(
        absoluta,
        text,
        ts.ScriptTarget.Latest,
        true,
        absoluta.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      for (const fragment of fragmenteDeText(sursa)) {
        for (const regula of REGULI) {
          if (fragment.identificator && regula.siInIdentificatori !== true) continue;
          for (const potrivire of fragment.text.matchAll(regula.tipar)) {
            const exceptat = EXCEPTII.some(
              (e) => e.fisier === cale && potrivire[0].toLowerCase().includes(e.fragment),
            );
            if (exceptat) continue;
            const linie =
              sursa.getLineAndCharacterOfPosition(fragment.start + (potrivire.index ?? 0)).line + 1;
            gasite.push(`${cale}:${linie} — „${potrivire[0]}” — ${regula.nume}`);
          }
        }
      }
    }
  }
  return gasite;
}

describe("registrul de adresare și glosarul (docs/design/ecrane/glosar.md)", () => {
  it("niciun text de pe ecran nu folosește un jeton interzis", () => {
    const gasite = incalcari();
    expect(gasite, `\n${gasite.join("\n")}\n`).toEqual([]);
    // Parserul TypeScript pe câteva zeci de fișiere; marja e pentru CI încărcat.
  }, 30_000);

  it("poarta vede ce trebuie să vadă (sondă de control)", () => {
    // O poartă care nu găsește nimic poate fi o poartă care nu se uită
    // nicăieri. Sonda verifică extragerea pe un fragment cunoscut.
    const sursa = ts.createSourceFile(
      "sonda.tsx",
      'const a = "checklists:read";\nconst b = <p>Fișa dvs. e gata</p>;\n// Onboarding\nconst c = x ? "dvs." : "";\n',
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const fragmente = fragmenteDeText(sursa);
    const proza = fragmente.filter((f) => !f.identificator).map((f) => f.text);
    expect(proza.some((t) => t.includes("Fișa dvs."))).toBe(true);
    expect(proza.some((t) => t.includes("checklists:read"))).toBe(false);
    expect(fragmente.some((f) => f.text.includes("Onboarding"))).toBe(false);
    // „dvs.” singur arată a identificator, dar regula lui se aplică oricum.
    expect(fragmente.some((f) => f.identificator && f.text === '"dvs."')).toBe(true);
    expect(fisiere("src/app/(app)").length).toBeGreaterThan(100);
  });
});
