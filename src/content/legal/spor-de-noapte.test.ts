import { describe, expect, it } from "vitest";

import { SPOR_DE_NOAPTE } from "./spor-de-noapte";

describe("ghidul sporului de noapte", () => {
  it("exemplul numeric din pagină e calculat corect", () => {
    const exemplu = SPOR_DE_NOAPTE.sectiuni.find((s) => s.titlu === "Cum se calculează sporul");
    const corect = Math.round((5000 / 168) * 40 * 0.25 * 100) / 100; // 297,62
    expect(exemplu?.paragrafe.join(" ")).toContain(corect.toFixed(2).replace(".", ","));
  });

  it("spune „25%”, cum scrie art. 126 lit. b), nu „cel puțin 25%”", () => {
    const tot = JSON.stringify(SPOR_DE_NOAPTE);
    expect(tot).toContain("25%");
    expect(tot).not.toMatch(/cel puțin 25/u);
  });
});

describe("amenda pentru munca de noapte", () => {
  it("e cea din art. 260 alin. (1) lit. l), 1.500 – 3.000 lei", () => {
    // Revizuirea finală: pagina spunea „nicio amendă anume” — textul consolidat
    // are lit. l), „încălcarea prevederilor legale referitoare la munca de noapte”.
    const amenda = SPOR_DE_NOAPTE.amenzi[0];
    expect(amenda?.suma).toBe("1.500 – 3.000 lei");
    expect(amenda?.temei).toBe("art. 260 alin. (1) lit. l) Codul muncii");
    expect(JSON.stringify(SPOR_DE_NOAPTE)).not.toMatch(/nicio amendă/u);
  });

  it("exemplul numeric se închide pe operanzii afișați", () => {
    const exemplu = SPOR_DE_NOAPTE.sectiuni.find((s) => s.titlu === "Cum se calculează sporul");
    expect(exemplu?.paragrafe.join(" ")).toContain("5.000 / 168 × 40 × 25% = 297,62 lei");
    expect(exemplu?.paragrafe.join(" ")).not.toContain("29,76 × 40");
  });
});
