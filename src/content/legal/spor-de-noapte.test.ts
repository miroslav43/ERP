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
