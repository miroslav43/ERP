import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Poarta pentru cea mai tăcută greșeală de stil cu putință: o clasă Tailwind
 * care arată corect și nu există.
 *
 * ── CUM A FOST PLĂTITĂ ────────────────────────────────────────────────────
 * Pe 18 sept 2026 am scris `font-mk-titlu` în două locuri — banda de capturi
 * înalte și antetul cererii de concediu. Tokenul acela nu există: în
 * `globals.css` sunt definite `--font-mk-display` și `--font-mk-date`, atât.
 *
 * Nimic nu s-a plâns. Tailwind nu emite niciun avertisment pentru o clasă
 * necunoscută, `tsc` vede un șir, ESLint la fel, iar `next build` produce o
 * pagină validă. Titlul s-a randat cu fontul implicit, adică arăta *aproape*
 * bine — cazul cel mai prost, fiindcă nu atrage atenția nici la o privire pe
 * ecran. A ieșit la iveală doar fiindcă am comparat manual lista de tokenuri
 * folosite cu lista celor definite.
 *
 * ── CE ACOPERĂ ────────────────────────────────────────────────────────────
 * Doar prefixul `mk-`, adică paleta proprie a paginilor publice. Clasele
 * standard ale lui Tailwind (`mt-3`, `text-center`) nu se verifică: ele vin din
 * biblioteca lui și n-au cum să dispară fără să dispară biblioteca.
 *
 * Se citesc numai valorile din `className="…"`. O mențiune într-un comentariu —
 * chiar și cea din antetul lui `in-mana.tsx`, care numește tokenul inexistent ca
 * să explice de ce nu se mai folosește — nu e o clasă și n-are ce căuta aici.
 */

const RADACINA = "src/app/(marketing)";
const FOAIA = "src/app/globals.css";

function fisiereTsx(dir: string): readonly string[] {
  return readdirSync(dir).flatMap((nume) => {
    const cale = join(dir, nume);
    if (statSync(cale).isDirectory()) return fisiereTsx(cale);
    return cale.endsWith(".tsx") && !cale.endsWith(".test.tsx") ? [cale] : [];
  });
}

/**
 * Tokenurile definite, ca nume de clasă posibile.
 *
 * `--color-mk-rigla` poate apărea ca `text-mk-rigla`, `bg-mk-rigla`,
 * `border-mk-rigla` și încă vreo zece prefixe. Nu enumerăm prefixele — ne
 * interesează dacă partea de DUPĂ prefix e un token cunoscut.
 */
function tokenuriDefinite(): ReadonlySet<string> {
  const css = readFileSync(FOAIA, "utf8");
  const gasite = new Set<string>();
  /*
   * Spațiul de nume nu se enumeră.
   *
   * Prima variantă a testului cerea `--(color|font|container|spacing)-` și a
   * raportat imediat `rounded-mk-rama` din `viniete.tsx` ca inexistentă — deși
   * `--radius-mk-rama` e definit la `globals.css:664`. Tailwind v4 are zeci de
   * spații de nume (`radius`, `shadow`, `leading`, `tracking`, `ease`…), iar o
   * listă scrisă de mână ar fi produs alarme false la fiecare unul nou.
   *
   * `:` la final e ce desparte o DEFINIȚIE de o folosire: `--color-mk-rigla:`
   * definește, `var(--color-mk-rigla)` doar citește.
   */
  for (const potrivire of css.matchAll(/--[a-z][a-z-]*?-(mk(?:-[a-z0-9-]+)?)\s*:/gu)) {
    const token = potrivire[1];
    if (token !== undefined) gasite.add(token);
  }
  return gasite;
}

describe("tokenurile de stil ale paginilor publice", () => {
  it("fiecare clasă `mk-` folosită are un token definit în globals.css", () => {
    const definite = tokenuriDefinite();
    expect(definite.size, "n-am găsit niciun token în globals.css").toBeGreaterThan(10);

    const lipsa: string[] = [];
    for (const cale of fisiereTsx(RADACINA)) {
      const sursa = readFileSync(cale, "utf8");
      for (const atribut of sursa.matchAll(/className="([^"]*)"/gu)) {
        const clase = (atribut[1] ?? "").split(/\s+/u).filter(Boolean);
        for (const clasa of clase) {
          // `backdrop:bg-mk-cerneala/85` → variante, prefix, token, opacitate.
          const fara = clasa.split(":").pop() ?? clasa;
          const potrivire = /-(mk(?:-[a-z0-9-]+)?)(?:\/\d+)?$/u.exec(fara);
          const token = potrivire?.[1];
          if (token === undefined) continue;
          if (!definite.has(token)) lipsa.push(`${cale}: ${clasa}`);
        }
      }
    }

    expect(
      [...new Set(lipsa)].sort(),
      "clase `mk-` fără token definit — se randează cu valoarea implicită, tăcut",
    ).toEqual([]);
  });
});
