import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { unealtaDinCale } from "@/lib/unelte/masurare";

const RADACINA = "src/app/api/unelte";

function rute(dosar: string): string[] {
  return readdirSync(dosar, { withFileTypes: true }).flatMap((intrare) => {
    const cale = join(dosar, intrare.name);
    if (intrare.isDirectory()) return rute(cale);
    return intrare.name === "route.ts" ? [cale] : [];
  });
}

/**
 * Auditul din 8 oct 2026: descărcările nu erau numărate nicăieri pe server. O
 * rută nouă de unealtă care uită învelișul ar reface golul în tăcere — Umami din
 * browser nu-l vede pe cine blochează măsurarea.
 */
/**
 * O rută care doar deleagă la GET-ul altei rute (aliasul din F12:
 * `cerere-concediu-de-odihna` cheamă GET-ul din `../cerere-concediu/route`)
 * primește deja un GET învelit. Învelită încă o dată, ar număra fiecare
 * descărcare de două ori.
 */
const DELEGARE = /import \{ GET as \w+ \} from "\.\.\/[a-z0-9-]+\/route";/u;

describe("numărarea pe server acoperă toate rutele de unelte", () => {
  it("fiecare route.ts exportă GET prin cuNumarare, o singură dată", () => {
    const fisiere = rute(RADACINA);
    expect(fisiere.length, "n-am găsit nicio rută — s-a mutat dosarul?").toBeGreaterThanOrEqual(2);
    for (const fisier of fisiere) {
      const sursa = readFileSync(fisier, "utf8");
      if (DELEGARE.test(sursa)) {
        expect(sursa, `${fisier}: deleagă, deci nu se mai învelește`).not.toMatch(/cuNumarare/u);
        continue;
      }
      expect(sursa, fisier).toMatch(/export const GET = cuNumarare\(/u);
      expect(sursa, fisier).not.toMatch(/export (?:async )?function GET\b/u);
    }
  });

  it("fiecare dosar static se leagă de o unealtă din hartă", () => {
    for (const intrare of readdirSync(RADACINA, { withFileTypes: true })) {
      if (!intrare.isDirectory() || intrare.name.startsWith("[")) continue;
      expect(unealtaDinCale(`/api/unelte/${intrare.name}`), intrare.name).not.toBeNull();
    }
  });
});

/**
 * Calculatorul de salariu n-are rută de descărcare: calculul se face la
 * randarea paginii. Utilizatorul a cerut (9 oct 2026) să vadă și perioada și
 * treapta brutului, deci pagina programează ea evenimentul `calc:`.
 */
describe("calculatorul de salariu se numără la randare", () => {
  it("pagina programează evenimentCalcul cu antetele cererii și brutul rezultat", () => {
    const sursa = readFileSync("src/app/(marketing)/unelte/calculator-salariu/page.tsx", "utf8");
    expect(sursa).toMatch(
      /programeaza\(\s*evenimentCalcul\(await headers\(\), q, rezultat\?\.brut \?\? null\)/u,
    );
  });
});
