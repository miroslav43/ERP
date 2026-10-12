import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

/**
 * Poarta `client-imports-server-only.mjs`, rulată pe un `src/` minimal scris
 * într-un dosar temporar (`--radacina`), ca să nu depindă de starea depozitului.
 *
 * Direcția inversă a fost adăugată pe 12 oct 2026: `galerie-foto.tsx` și
 * `documente-echipament.tsx` (Server Components) chemau `marimeCitibila()` din
 * `components/ui/incarcare-fisier.tsx` (`"use client"`). Pe server exportul e o
 * referință client, iar apelul aruncă „Attempted to call marimeCitibila() from
 * the server”. tsc, eslint, vitest și vechea poartă tăceau toate patru.
 */

const SCRIPT = join(process.cwd(), "scripts/checks/client-imports-server-only.mjs");

let dosare: string[] = [];

afterEach(() => {
  for (const d of dosare) rmSync(d, { recursive: true, force: true });
  dosare = [];
});

function proiect(fisiere: Readonly<Record<string, string>>): string {
  const radacina = mkdtempSync(join(tmpdir(), "poarta-client-"));
  dosare.push(radacina);
  for (const [cale, continut] of Object.entries(fisiere)) {
    const tinta = join(radacina, "src", cale);
    mkdirSync(dirname(tinta), { recursive: true });
    writeFileSync(tinta, continut);
  }
  return radacina;
}

function ruleaza(radacina: string): { cod: number | null; iesire: string } {
  const r = spawnSync(process.execPath, [SCRIPT, "--radacina", radacina], { encoding: "utf8" });
  return { cod: r.status, iesire: `${r.stdout}${r.stderr}` };
}

const CLIENT = `"use client";
export function marime(n: number): string { return String(n); }
export const LISTA = ["a"] as const;
export function Camp(): null { return null; }
export type Tip = string;
`;

describe("client-imports-server-only — direcția server → client", () => {
  it("prinde un Server Component care importă o FUNCȚIE dintr-un modul „use client”", () => {
    const r = ruleaza(
      proiect({
        "ui/camp.tsx": CLIENT,
        "pagina/galerie.tsx": `import { marime } from "@/ui/camp";\nexport const x = marime(1);\n`,
      }),
    );
    expect(r.cod).toBe(1);
    expect(r.iesire).toContain("src/pagina/galerie.tsx");
    expect(r.iesire).toContain("marime");
  });

  it("prinde și o constantă (devine un proxy pe server) și un re-export", () => {
    const r = ruleaza(
      proiect({
        "ui/camp.tsx": CLIENT,
        "pagina/a.tsx": `import { LISTA } from "../ui/camp";\nexport const n = LISTA.length;\n`,
        "pagina/b.ts": `export { marime } from "@/ui/camp";\n`,
      }),
    );
    expect(r.cod).toBe(1);
    expect(r.iesire).toContain("src/pagina/a.tsx");
    expect(r.iesire).toContain("LISTA");
    expect(r.iesire).toContain("src/pagina/b.ts");
  });

  it("lasă în pace componentele, tipurile, testele și alți clienți", () => {
    const r = ruleaza(
      proiect({
        "ui/camp.tsx": CLIENT,
        "pagina/ok.tsx": `import { Camp, type Tip } from "@/ui/camp";\nexport const c: Tip = String(Camp);\n`,
        "pagina/tip.ts": `import type { Tip } from "@/ui/camp";\nexport const t: Tip = "x";\n`,
        "ui/camp.test.tsx": `import { marime } from "./camp";\nmarime(1);\n`,
        "ui/alt-client.tsx": `"use client";\nimport { marime } from "./camp";\nexport const y = marime(2);\n`,
      }),
    );
    expect(r.iesire).not.toContain("server → client");
    expect(r.cod).toBe(0);
  });
});

describe("client-imports-server-only — direcția client → server-only (neschimbată)", () => {
  it("prinde în continuare un client care ajunge la `server-only` printr-un lanț", () => {
    const r = ruleaza(
      proiect({
        "lib/citiri.ts": `import "server-only";\nexport const STARI = ["x"];\n`,
        "lib/punte.ts": `export { STARI } from "./citiri";\n`,
        "ui/filtre.tsx": `"use client";\nimport { STARI } from "@/lib/punte";\nexport const s = STARI;\n`,
      }),
    );
    expect(r.cod).toBe(1);
    expect(r.iesire).toContain("src/ui/filtre.tsx");
    expect(r.iesire).toContain("src/lib/citiri.ts");
  });
});
