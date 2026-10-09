import { describe, expect, it } from "vitest";

import { lei } from "./lei";
import { grilaBrutNet, grilaNetBrut, salariulMinim2026, TREPTE_BRUT } from "./tabele";

describe("tabelele fixe ale calculatorului", () => {
  it("salariul minim în 2026, pe perioade: 4.050 → 2.574 / 4.134 și 4.325 → 2.699 / 4.418", () => {
    // Calculele sunt în salariu.test.ts (C3 și vectorii publicați).
    expect(salariulMinim2026()).toEqual([
      {
        perioada: "2026-1",
        eticheta: "ianuarie–iunie 2026",
        brut: 4050,
        oreLuna: "165,334",
        leiPeOra: "24,496",
        act: "HG 1506/2024",
        neimpozabil: 300,
        net: 2574,
        costTotal: 4134,
      },
      {
        perioada: "2026-2",
        eticheta: "iulie–decembrie 2026",
        brut: 4325,
        oreLuna: "166,667",
        leiPeOra: "25,949",
        act: "HG 146/2026",
        neimpozabil: 200,
        net: 2699,
        costTotal: 4418,
      },
    ]);
  });

  it("grila brut → net: cifrele verificate live pe 8 oct 2026", () => {
    // Auditul: 5.000 → 2.981 (cost 5.113), 10.000 → 5.850 (10.225), 20.000 → 11.700.
    // 5.000 cu 2 persoane: minim + 675, pasul 14, 30% − 7 = 23% × 4.325 = 994,75 → 995;
    // impozit (5.000 − 1.250 − 500 − 995) × 10% = 225,5 → 226; net 3.024.
    // Peste 6.325 deducerea dispare la orice număr de persoane: 10.000 dă 5.850 în ambele coloane.
    const g = grilaBrutNet();
    expect(g.map((r) => r.brut)).toEqual([...TREPTE_BRUT]);
    expect(g.find((r) => r.brut === 5000)).toEqual({
      brut: 5000,
      net: 2981,
      netDouaPersoane: 3024,
      costTotal: 5113,
    });
    expect(g.find((r) => r.brut === 10000)).toEqual({
      brut: 10000,
      net: 5850,
      netDouaPersoane: 5850,
      costTotal: 10225,
    });
    expect(g.find((r) => r.brut === 20000)?.net).toBe(11700);
  });

  it("grila net → brut: 3.000 → 5.036, 5.000 → 8.548, 7.000 → 11.967", () => {
    const g = grilaNetBrut();
    expect(g.find((r) => r.net === 3000)).toEqual({ net: 3000, brut: 5036, costTotal: 5149 });
    expect(g.find((r) => r.net === 5000)).toEqual({ net: 5000, brut: 8548, costTotal: 8740 });
    expect(g.find((r) => r.net === 7000)?.brut).toBe(11967);
  });

  it("llms.txt și ghidul salariului minim spun aceleași cifre ca tabelele", async () => {
    const { PAGINI } = await import("@/app/llms.txt/route");
    const text = PAGINI.find(([cale]) => cale === "/unelte/calculator-salariu")?.[1] ?? "";
    for (const c of salariulMinim2026()) expect(text, c.eticheta).toContain(lei(c.net));
    expect(text).toContain(lei(grilaBrutNet().find((r) => r.brut === 5000)?.net ?? 0));
    const { SALARIU_MINIM } = await import("@/content/legal/salariu-minim");
    const randuri = SALARIU_MINIM.tabel?.randuri ?? [];
    expect(randuri).toContainEqual([
      "Net, normă întreagă, fără persoane în întreținere",
      "2.574 lei",
      "2.699 lei",
    ]);
    expect(randuri).toContainEqual(["Cost total pentru firmă", "4.134 lei", "4.418 lei"]);
  });
});
