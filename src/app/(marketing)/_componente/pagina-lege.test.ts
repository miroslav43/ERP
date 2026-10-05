// src/app/(marketing)/_componente/pagina-lege.test.ts
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const SURSA = readFileSync("src/app/(marketing)/_componente/pagina-lege.tsx", "utf8");

describe("pagina-lege", () => {
  it("butonul de cont vine după răspunsul scurt, nu între lead și răspuns", () => {
    // Auditul GEO din 5 oct 2026: pasajul extras de motoarele generative cuprindea
    // și „Creează cont · prima lună gratuită", fiindcă antetul îl punea înaintea
    // răspunsului. Antetul nu mai primește buton; pagina îl pune după răspuns.
    expect(SURSA).toContain("cta={null}");
    const raspuns = SURSA.indexOf("text.raspunsScurt.map");
    const buton = SURSA.indexOf('data-umami-event="cta-dupa-raspuns"');
    expect(raspuns).toBeGreaterThan(0);
    expect(buton).toBeGreaterThan(raspuns);
  });
});
