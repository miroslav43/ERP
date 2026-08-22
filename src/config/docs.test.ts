// Testul anti-ruginire al documentației.
//
// Trăiește sub `src/` DELIBERAT: `vitest.config.mts` limitează proiectul `unit`
// la `include: ["src/**/*.test.ts"]`. Pus în `docs/` sau `tests/`, n-ar rula
// niciodată — exact clasa de eșec tăcut pe care o previne. Aici merge automat
// pe `pnpm test` → `pnpm verify` → jobul `quality` din CI.

import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { PERMISSION_KEYS } from "./permissions";

const RADACINA = join(__dirname, "..", "..");
const CAPCANE = join(RADACINA, "docs/design/ecrane/capcane.md");
const PREZENTARE = join(RADACINA, "docs/project-overview.md");
const CLAUDE_MD = join(RADACINA, "CLAUDE.md");

const citeste = (cale: string): string => readFileSync(cale, "utf8");

describe("capcane.md — numerotare și lizibilitate", () => {
  it("numerele sunt contigue de la 1, fără duplicate", () => {
    const numere = [...citeste(CAPCANE).matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]));
    expect(numere.length, "n-am găsit nicio capcană numerotată").toBeGreaterThan(10);
    const asteptate = Array.from({ length: numere.length }, (_, i) => i + 1);
    expect(numere, "numerotarea capcanelor are goluri sau duplicate").toEqual(asteptate);
  });

  it("nu conține octeți NUL — altfel devine invizibil pentru grep", () => {
    // S-a întâmplat: un octet NUL literal, scris chiar în capcana care
    // avertizează despre octeți NUL, făcea `file` să raporteze „data” și
    // `grep` să întoarcă tăcut zero rezultate.
    const brut = readFileSync(CAPCANE);
    expect(
      brut.includes(0),
      "capcane.md conține un octet NUL: scrie-l ca secvență de evadare",
    ).toBe(false);
  });
});

describe("niciun fișier text urmărit nu conține octeți NUL", () => {
  // Capcana #11 cere ca separatorul de cursor keyset să fie scris ca secvență
  // de evadare, nu ca octet brut. Regula a fost încălcată în patru locuri
  // simultan — `src/lib/queries/ssm.ts` (cod viu) și trei documente de
  // proiectare, dintre care două SPUNEAU „secvența de evadare, nu octet brut"
  // folosind un octet brut. Un fișier cu NUL e `data` pentru `file` și
  // invizibil pentru `grep`: căutarea nu eșuează, întoarce zero rezultate.
  //
  // Verificarea per-fișier din `capcane.md` de mai sus nu era suficientă
  // tocmai fiindcă problema nu era localizată acolo.
  it("verifică toate fișierele text din src, tests, scripts, docs și .claude", () => {
    const brute = execSync(
      "git ls-files -z -- src tests scripts docs .claude ':!:*.ico' ':!:*.png' ':!:*.woff*'",
      { cwd: RADACINA, encoding: "buffer", maxBuffer: 8 * 1024 * 1024 },
    );
    const cai = brute
      .toString("utf8")
      .split("\0")
      .filter((c) => c.length > 0);

    expect(cai.length, "git ls-files n-a întors nimic — verificarea ar trece fals").toBeGreaterThan(
      100,
    );

    const cuNul = cai.filter((cale) => {
      const abs = join(RADACINA, cale);
      return existsSync(abs) && readFileSync(abs).includes(0);
    });

    expect(
      cuNul,
      "fișiere cu octet NUL literal — scrie-l ca secvență de evadare (capcana #11)",
    ).toEqual([]);
  });

  it("project-overview.md citează numărul REAL de capcane", () => {
    const cate = [...citeste(CAPCANE).matchAll(/^(\d+)\. /gm)].length;
    const mentiune = /(\d+)\s*(?:de\s*)?capcane concrete/.exec(citeste(PREZENTARE));
    expect(mentiune, "project-overview.md §8 nu mai citează un număr de capcane").not.toBeNull();
    expect(
      Number(mentiune?.[1]),
      `project-overview.md spune ${mentiune?.[1]}, capcane.md are ${cate}`,
    ).toBe(cate);
  });
});

describe("căile citate în documentație există", () => {
  // Domeniul e deliberat îngust: CLAUDE.md, capcane.md și plugin-ul
  // `administrativo`. Restul lui `.claude/` poate fi lucrat concurent de altă
  // sesiune, iar un test care îi cade peste munca în curs produce doar fricțiune.
  // Lărgește-l când componentele acelea se stabilizează.
  const documente = (): readonly string[] => {
    const out: string[] = [CLAUDE_MD, CAPCANE];
    const parcurge = (dir: string): void => {
      if (!existsSync(dir)) return;
      for (const intrare of readdirSync(dir)) {
        const cale = join(dir, intrare);
        if (statSync(cale).isDirectory()) parcurge(cale);
        else if (intrare.endsWith(".md")) out.push(cale);
      }
    };
    parcurge(join(RADACINA, ".claude/skills/administrativo"));
    return out;
  };

  it("fiecare cale relativă din CLAUDE.md și .claude/**/*.md se rezolvă pe disc", () => {
    // Doar căi cu extensie cunoscută sau directoare evidente: proza conține
    // și tipare (`<tabela>`, `*.sql`) care nu sunt căi reale.
    const tipar =
      /`((?:src|docs|supabase|tests|scripts|ops|\.claude)\/[A-Za-z0-9_./()[\]-]+\.(?:ts|tsx|sql|md|mjs|sh|json))`/g;
    const lipsa: string[] = [];
    for (const doc of documente()) {
      for (const m of citeste(doc).matchAll(tipar)) {
        const cale = m[1] as string;
        // Sar peste substituenți: `<tabela>`, globuri, și nume-jucărie
        // dintr-un exemplu (`x.ts`, `a.sql`).
        if (cale.includes("<") || cale.includes("*")) continue;
        const bazaFaraExt = (cale.split("/").pop() ?? "").split(".")[0] ?? "";
        if (bazaFaraExt.length <= 2) continue;
        if (!existsSync(join(RADACINA, cale)))
          lipsa.push(`${doc.replace(RADACINA + "/", "")} → ${cale}`);
      }
    }
    expect(lipsa, "documentația indică fișiere care nu există").toEqual([]);
  });
});

describe("permisiuni — literalele din cod sunt chei reale", () => {
  it("fiecare literal pasat lui can()/scopeFor() e o cheie din PERMISSION_KEYS", () => {
    // `PermissionKey` din `src/lib/auth/permissions.ts` e `string`, deci
    // TypeScript NU prinde o cheie inventată: `has_permission` întoarce 'none'
    // și butonul dispare tăcut. Vezi capcana 5.
    const cunoscute = new Set<string>(PERMISSION_KEYS);
    const gasite = new Map<string, string>();
    const parcurge = (dir: string): void => {
      for (const intrare of readdirSync(dir)) {
        if (intrare === "node_modules" || intrare === ".next") continue;
        const cale = join(dir, intrare);
        if (statSync(cale).isDirectory()) parcurge(cale);
        else if (/\.tsx?$/.test(intrare) && !/\.test\.tsx?$/.test(intrare)) {
          citeste(cale)
            .split("\n")
            .forEach((linie, i) => {
              for (const m of linie.matchAll(
                /\b(?:can|scopeFor)\s*\(\s*[A-Za-z_$][\w.$]*\s*,\s*"([a-z_]+:[a-z_]+)"/g,
              )) {
                const cheie = m[1] as string;
                if (!gasite.has(cheie))
                  gasite.set(cheie, `${cale.replace(RADACINA + "/", "")}:${i + 1}`);
              }
            });
        }
      }
    };
    parcurge(join(RADACINA, "src"));

    expect(
      gasite.size,
      "n-am găsit niciun apel can() — expresia regulată a ruginit",
    ).toBeGreaterThan(20);
    const inventate = [...gasite.entries()].filter(([cheie]) => !cunoscute.has(cheie));
    expect(inventate, "chei folosite în can() care nu există în PERMISSION_KEYS").toEqual([]);
  });
});

describe("CLAUDE.md descrie verificarea reală", () => {
  it("comanda prescrisă e derivabilă din scripturile package.json", () => {
    const pkg = JSON.parse(citeste(join(RADACINA, "package.json"))) as {
      scripts: Record<string, string>;
    };
    const verify = pkg.scripts["verify"] ?? "";
    // Contractul: `verify` NU include build; CLAUDE.md trebuie să o spună.
    expect(
      verify.includes("build"),
      "package.json: `verify` include acum build — actualizează CLAUDE.md",
    ).toBe(false);
    const claude = citeste(CLAUDE_MD);
    expect(claude, "CLAUDE.md nu mai prescrie lanțul complet cu build").toContain(
      "pnpm typecheck && pnpm lint && pnpm test && pnpm build",
    );
    expect(claude, "CLAUDE.md nu mai avertizează că `verify` sare build-ul").toMatch(
      /NU include `?build`?/,
    );
  });
});
