#!/usr/bin/env node
// SessionStart: injectează digest.md în contextul modelului.
//
// Tace complet dacă nu suntem în repo-ul Administrativo — plugin-ul poate fi
// activat la nivel de cont, iar convențiile ERP n-au ce căuta în alt proiect.
//
// Cifrele volatile NU se scriu în digest.md, se CALCULEAZĂ aici. Motivul e
// concret: digest.md a rămas la „43 migrări" în timp ce pe disc erau 47, iar
// antetul din CLAUDE.md a rămas la 43 după un merge care aducea două migrări
// noi. Un rezumat în cifre îmbătrânește tăcut și se citește ca fapt. O valoare
// calculată nu poate rugini, și — spre deosebire de un test care păzește un
// număr scris de mână — nu taxează pe cel care adaugă următoarea migrare.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RADACINA = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
if (!existsSync(join(RADACINA, "supabase/migrations/0002_authz.sql"))) process.exit(0);

const aici = dirname(fileURLToPath(import.meta.url));
const f = join(aici, "digest.md");
if (!existsSync(f)) process.exit(0);

/** Numără fișierele dintr-un director care trec un filtru; 0 dacă lipsește. */
function numaraFisiere(caleRelativa, potrivire) {
  const dir = join(RADACINA, caleRelativa);
  if (!existsSync(dir)) return 0;
  try {
    return readdirSync(dir).filter(potrivire).length;
  } catch {
    return 0;
  }
}

/** Numără aparițiile unui tipar în toate fișierele dintr-un arbore. */
function numaraAparitii(caleRelativa, numeFisier, tipar) {
  const radacina = join(RADACINA, caleRelativa);
  if (!existsSync(radacina)) return 0;
  let total = 0;
  const parcurge = (dir) => {
    let intrari;
    try {
      intrari = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const intrare of intrari) {
      if (intrare.name === "node_modules" || intrare.name === ".next") continue;
      const cale = join(dir, intrare.name);
      if (intrare.isDirectory()) parcurge(cale);
      else if (intrare.name === numeFisier) {
        try {
          total += (readFileSync(cale, "utf8").match(tipar) ?? []).length;
        } catch {
          /* fișier ilizibil: îl sărim, nu oprim digestul */
        }
      }
    }
  };
  parcurge(radacina);
  return total;
}

/** Capcanele numerotate din capcane.md. Citit ca buffer: a avut octeți NUL. */
function numaraCapcane() {
  const cale = join(RADACINA, "docs/design/ecrane/capcane.md");
  if (!existsSync(cale)) return 0;
  try {
    return (readFileSync(cale, "utf8").match(/^\d+\. /gm) ?? []).length;
  } catch {
    return 0;
  }
}

const valori = {
  migrari: numaraFisiere("supabase/migrations", (n) => n.endsWith(".sql")),
  actiuni: numaraAparitii("src", "actions.ts", /createAction[<(]/g),
  capcane: numaraCapcane(),
};

let text = readFileSync(f, "utf8");
for (const [cheie, valoare] of Object.entries(valori)) {
  // Dacă numărătoarea a eșuat (0), lăsăm textul fără cifră în loc să mințim.
  text = text.replaceAll(`{{${cheie}}}`, valoare > 0 ? String(valoare) : "…");
}

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: text,
    },
  }),
);
