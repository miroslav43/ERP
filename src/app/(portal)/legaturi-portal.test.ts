import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Nicio legătură din portal nu are voie să iasă din portal.
 *
 * De când `(app)/layout.tsx` redirecționează angajatul înapoi în portal, un
 * `href` către o rută de aplicație mare nu mai e o navigare — e un buton care
 * pare stricat: omul apasă „Toate anunțurile" și ajunge de unde a plecat, fără
 * niciun mesaj. Exact asta făcea `portal/page.tsx`, cu `href="/anunturi"`.
 *
 * Testul citește sursa, ca `navigation.test.ts`. Nu e o dovadă că navigarea
 * funcționează; e o capcană care ține regula vie când cineva copiază un ecran
 * din `(app)` fără să-i rescrie legăturile.
 */

const RADACINA = join(process.cwd(), "src", "app", "(portal)");

/**
 * Ieșirile permise — amândouă sunt Route Handlers, nu pagini.
 *
 * Un Route Handler NU trece prin `(app)/layout.tsx`, deci poarta de rol care
 * redirectează angajatul înapoi la `/portal` nu se aplică. Amândouă își fac
 * propria verificare, iar RLS rămâne ultima linie.
 *
 * · `documente/[id]` — singurul drum prin care angajatul își deschide o
 *   adeverință: `hr_issued_select` (`0005_hr_rls.sql:872`) are ramură `own`.
 * · `/api/export/salarizare/fluturas` — fluturașul propriu, în PDF.
 *   `payroll_entries` are `app.poate_accesa_salariul`, care la scope `own`
 *   întoarce exact rândul lui; ruta nu face nicio verificare de identitate în
 *   plus, tocmai ca să nu poată diverge de politică.
 * · `/api/materiale/` — conținutul unei lecții (PDF, film, subtitrare), servit
 *   ca flux cu suport de `Range`. Nu poate sta sub `/portal/`: e adresa pusă în
 *   `<video src>` și în `<iframe src>`, cerută de zeci de ori pe vizionare, nu
 *   navigată de om. Ruta rezolvă tenantul și citește versiunea SUB RLS; dacă
 *   rândul nu vine, răspunde 404, nu 403.
 */
const IESIRI_PERMISE: readonly string[] = [
  "/documente/",
  "/api/export/salarizare/fluturas",
  "/api/materiale/",
];

function fisiereSursa(director: string): readonly string[] {
  const rezultat: string[] = [];
  for (const intrare of readdirSync(director, { withFileTypes: true })) {
    const cale = join(director, intrare.name);
    if (intrare.isDirectory()) {
      rezultat.push(...fisiereSursa(cale));
    } else if (/\.tsx?$/u.test(intrare.name) && !intrare.name.endsWith(".test.ts")) {
      rezultat.push(cale);
    }
  }
  return rezultat;
}

describe("legăturile portalului", () => {
  const fisiere = fisiereSursa(RADACINA);

  it("există fișiere de analizat", () => {
    // Fără asta, o redenumire de director ar face testul verde pe zero fișiere.
    expect(fisiere.length).toBeGreaterThan(5);
  });

  it("niciun `href` absolut nu duce în afara portalului", () => {
    const scapate: string[] = [];

    for (const cale of fisiere) {
      const sursa = readFileSync(cale, "utf8");
      for (const potrivire of sursa.matchAll(/href=(?:"|\{`)(\/[^"`{}\s]*)/gu)) {
        const href = potrivire[1] ?? "";
        if (href === "/portal" || href.startsWith("/portal/")) continue;
        if (IESIRI_PERMISE.some((permis) => href.startsWith(permis))) continue;
        scapate.push(`${cale.replace(process.cwd(), "")} → ${href}`);
      }
    }

    expect(
      scapate,
      "Legături care ies din portal. Sub poarta de rol, angajatul e adus înapoi " +
        "instantaneu, deci butonul pare stricat. Rescrie calea sub `/portal/`, sau " +
        "adaug-o în IESIRI_PERMISE cu motivul.",
    ).toEqual([]);
  });
});
