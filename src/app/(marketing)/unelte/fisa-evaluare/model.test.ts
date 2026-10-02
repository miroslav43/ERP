import { describe, expect, it } from "vitest";

import { CRITERII_IMPLICITE, fisaEvaluareDinParametri, parametriFisaEvaluare } from "./model";

describe("fișa de evaluare", () => {
  it("fără criterii proprii folosește lista implicită, cu pondere, notă și observații", () => {
    const d = fisaEvaluareDinParametri(new URLSearchParams({ nume: "Ilie Maria" }));
    expect(d.randuri.map((r) => r[0])).toEqual([...CRITERII_IMPLICITE, "Total"]);
    expect(d.coloane.map((c) => c.eticheta)).toEqual([
      "Criteriu",
      "Pondere\n(%)",
      "Nota\n(1–5)",
      "Observații",
    ]);
    expect(d.campuri).toContainEqual({ eticheta: "Angajat", valoare: "Ilie Maria" });
  });

  it("criteriile proprii înlocuiesc lista, mărginite la 15 și la 120 de caractere", () => {
    const criterii = Array.from({ length: 40 }, (_, i) => `Criteriu ${String(i)}`).join("\n");
    const d = fisaEvaluareDinParametri(new URLSearchParams({ criterii }));
    expect(d.randuri).toHaveLength(15 + 1);
    const lung = parametriFisaEvaluare(new URLSearchParams({ criterii: "x".repeat(400) }));
    expect(lung.criterii[0]).toHaveLength(120);
  });
});
