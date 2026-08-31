import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { FEATURE_KEYS, isFeatureKey } from "@/config/features";

import { EN } from "./en";
import { RO } from "./ro";
import type { ContinutLanding } from "./tipuri";

const LIMBI: readonly (readonly [string, ContinutLanding])[] = [
  ["ro", RO],
  ["en", EN],
];

function fisiere(radacina: string, extensii: readonly string[]): string[] {
  const gasite: string[] = [];
  const mergi = (cale: string) => {
    for (const intrare of readdirSync(cale)) {
      const plin = join(cale, intrare);
      if (statSync(plin).isDirectory()) mergi(plin);
      // `join` dă `\` pe Windows, iar potrivirile de mai jos sunt scrise cu `/`:
      // fără normalizare, setul de rute iese gol și testul cade doar pe Windows.
      else if (extensii.some((ext) => plin.endsWith(ext))) gasite.push(plin.replaceAll("\\", "/"));
    }
  };
  mergi(radacina);
  return gasite;
}

const SURSE_MARKETING = [
  ...fisiere("src/content/landing", [".ts", ".tsx"]),
  ...fisiere("src/app/(marketing)", [".ts", ".tsx"]),
];

describe("landing-ul nu poate minți despre module", () => {
  it("fiecare modul numit pe pagină e o cheie reală din features.ts", () => {
    for (const [limba, text] of LIMBI) {
      for (const grup of text.module.grupuri) {
        for (const modul of grup.module) {
          expect(isFeatureKey(modul.cheie), `${limba}: ${modul.cheie}`).toBe(true);
        }
      }
    }
  });

  it("toate modulele din catalog apar pe pagină — niciunul uitat", () => {
    for (const [limba, text] of LIMBI) {
      const pePagina = text.module.grupuri.flatMap((g) => g.module.map((m) => m.cheie));
      expect(new Set(pePagina).size, `${limba}: duplicate`).toBe(pePagina.length);
      expect([...pePagina].sort(), limba).toEqual([...FEATURE_KEYS].sort());
    }
  });

  it("planurile de preț conțin doar module reale", () => {
    for (const [limba, text] of LIMBI) {
      for (const plan of text.preturi.planuri) {
        for (const cheie of plan.module) {
          expect(isFeatureKey(cheie), `${limba}/${plan.cheie}: ${cheie}`).toBe(true);
        }
        // Nucleul nu e opțiune: e inclus în orice plan.
        expect(plan.module, `${limba}/${plan.cheie}`).toContain("nucleu");
      }
    }
  });

  it("planurile cresc: fiecare îl conține pe cel dinainte", () => {
    for (const [limba, text] of LIMBI) {
      const planuri = text.preturi.planuri;
      for (let i = 1; i < planuri.length; i += 1) {
        const anterior = planuri[i - 1]?.module ?? [];
        const curent = new Set(planuri[i]?.module ?? []);
        for (const cheie of anterior) {
          expect(curent.has(cheie), `${limba}: ${planuri[i]?.cheie} nu include ${cheie}`).toBe(
            true,
          );
        }
      }
    }
  });
});

describe("engleza nu e o traducere pe jumătate", () => {
  it("are aceeași structură ca româna", () => {
    expect(EN.module.grupuri).toHaveLength(RO.module.grupuri.length);
    expect(EN.dovada.randuri).toHaveLength(RO.dovada.randuri.length);
    expect(EN.ecrane.randuri).toHaveLength(RO.ecrane.randuri.length);
    expect(EN.pontaj.livrate).toHaveLength(RO.pontaj.livrate.length);
    expect(EN.pontaj.viitoare).toHaveLength(RO.pontaj.viitoare.length);
    expect(EN.onestitate.randuri).toHaveLength(RO.onestitate.randuri.length);
    expect(EN.verticale.domenii).toHaveLength(RO.verticale.domenii.length);
    expect(EN.comparatie.perechi).toHaveLength(RO.comparatie.perechi.length);
    expect(EN.intrebari.intrebari).toHaveLength(RO.intrebari.intrebari.length);
    expect(EN.roluri.note).toHaveLength(RO.roluri.note.length);
    expect(EN.izolare.straturi).toHaveLength(RO.izolare.straturi.length);
    expect(EN.implementare.pasi).toHaveLength(RO.implementare.pasi.length);
    expect(EN.conformitate.carduri).toHaveLength(RO.conformitate.carduri.length);
  });

  it("niciun text nu a rămas netradus, identic cu româna", () => {
    // Numele proprii și cheile tehnice au voie să coincidă; frazele lungi, nu.
    const identice = RO.intrebari.intrebari.filter((intrebare, index) => {
      const pereche = EN.intrebari.intrebari[index];
      return pereche !== undefined && pereche.q === intrebare.q;
    });
    expect(identice).toHaveLength(0);
  });
});

describe("regulile de scriere ale paginii", () => {
  it("nicio sedilă turcească în tot stratul de marketing", () => {
    const cuSedila = SURSE_MARKETING.filter((f) =>
      /[\u015E\u015F\u0162\u0163]/.test(readFileSync(f, "utf8")),
    );
    expect(cuSedila).toEqual([]);
  });

  it("niciun preț în lei în copy — planurile sunt „preț la cerere”", () => {
    for (const [limba, text] of LIMBI) {
      expect(JSON.stringify(text), limba).not.toMatch(/\d[\d.,\s]*\s*(lei|LEI|RON|EUR|€)\b/);
    }
    for (const [limba, text] of LIMBI) {
      for (const plan of text.preturi.planuri) {
        expect(plan.pret, `${limba}/${plan.cheie}`).not.toMatch(/\d/);
      }
    }
  });

  it("nu promite nimic din lista interzisă", () => {
    /*
     * `asistent (AI|cu inteligen)` A FOST pe lista asta, și pe drept: pagina
     * declara în secțiunea de onestitate că nu există un asemenea asistent, iar
     * tiparul împiedica restul copy-ului să-l promită totuși.
     *
     * A fost scos pe 2026-08-31, când asistentul a fost livrat ca modul
     * `asistent`, cu comutator per firmă. Regula pe care o apăra testul —
     * „nu promitem ce nu avem" — rămâne; s-a schimbat doar ce avem. Secțiunea
     * de onestitate spune acum ce face și ce nu, exact cum promitea vechiul ei
     * text („când o să avem, o să scrie aici ce face și ce nu").
     */
    const interzise = [
      /conform legisla[țt]iei [îi]n vigoare/i,
      /ISO\s?27001/i,
      /facturare [șs]i [îi]ncas[ăa]ri/i,
      /[îi]ncearc[ăa] gratuit/i,
      /software (de salarizare )?certificat(?!\.)/i,
    ];
    // Se caută în TEXTUL LIVRAT, nu în fișier: comentariul care explică de ce o
    // formulare e interzisă conține chiar formularea, și n-are ce căuta pe ecran.
    //
    // Secțiunea de onestitate e SCOASĂ din scanare, fiindcă exact acolo numim
    // lucrurile pe care nu le avem: „Nu avem asistent cu inteligență
    // artificială" trebuie să rămână scris, nu interzis.
    for (const [limba, text] of LIMBI) {
      const { onestitate: _onestitate, ...restul } = text;
      const livrat = JSON.stringify(restul);
      for (const tipar of interzise) {
        expect(tipar.test(livrat), `${limba}: ${String(tipar)}`).toBe(false);
      }
    }
  });
});

describe("legăturile interne duc undeva", () => {
  const RUTE = new Set(
    fisiere("src/app", ["page.tsx"]).map((f) => {
      const cale = f
        .replace(/^src\/app/, "")
        .replace(/\/page\.tsx$/, "")
        .replace(/\/\([^)]+\)/g, "");
      return cale === "" ? "/" : cale;
    }),
  );

  const PUBLICE = readFileSync("src/proxy.ts", "utf8");

  it("fiecare link intern din conținut are o pagină reală", () => {
    for (const [limba, text] of LIMBI) {
      const linkuri = [...JSON.stringify(text).matchAll(/"(\/[^"#]*)(?:#[^"]*)?"/g)]
        .map((m) => m[1] ?? "")
        .filter((href) => href !== "" && !href.startsWith("//"));
      for (const href of new Set(linkuri)) {
        const cale = href === "/" ? "/" : href.replace(/\/$/, "");
        expect(RUTE.has(cale), `${limba}: ${href} nu are page.tsx`).toBe(true);
      }
    }
  });

  it("rutele publice noi sunt pe lista albă din proxy", () => {
    for (const ruta of ["/en", "/preturi", "/cere-demo", "/legal"]) {
      expect(PUBLICE, `lipsește ${ruta}`).toContain(`"${ruta}"`);
    }
  });

  it("imaginea de distribuire e accesibilă fără sesiune", () => {
    // Next îi pune un sufix de conținut în URL (`/opengraph-image-pwu6ef`),
    // deci proxy-ul are nevoie de potrivire pe PREFIX. Fără ea, orice
    // previzualizare de link apare fără imagine.
    expect(PUBLICE).toContain('"/opengraph-image"');
    expect(PUBLICE).toMatch(/startsWith\(prefix\)/);
  });
});
