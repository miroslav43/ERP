import { describe, expect, it } from "vitest";

import { EroareIntrare } from "@/lib/unelte/document-tabelar";

import { construiesteCerere } from "./cerere";
import {
  cerereCaDocument,
  cerereDinParametri,
  normalizeazaTip,
  problemaCerere,
} from "./cerere-document";

const BAZA = {
  salariat: "Ilie Maria",
  functie: "Contabil",
  angajator: "Exemplu SRL",
  localitate: "Cluj-Napoca",
  deLa: "2026-12-21",
  panaLa: "2026-12-31",
  dataCererii: "2026-10-02",
  motiv: "",
};

describe("cererea de concediu ca document", () => {
  it("odihnă: numără zilele lucrătoare cu același calcul ca pagina și enumeră sărbătorile", () => {
    // 21–24 dec (L–J) = 4, 25 Crăciunul, 26–27 weekend, 28–31 (L–J) = 4 → 8.
    expect(construiesteCerere("2026-12-21", "2026-12-31").zileLucratoare).toBe(8);
    const d = cerereCaDocument({ ...BAZA, tip: "odihna" });
    expect(d.titlu).toBe("Cerere de concediu de odihnă");
    expect(d.paragrafe.join(" ")).toMatch(/8 zile lucrătoare/u);
    expect(d.paragrafe.join(" ")).toMatch(/Crăciun/u);
    expect(d.coloane).toHaveLength(0);
    expect(d.subtitlu).toBe("Către: Exemplu SRL");
  });

  it("fără plată: citează art. 153 și nu pomenește zile lucrătoare", () => {
    const d = cerereCaDocument({ ...BAZA, tip: "fara-plata" });
    expect(d.titlu).toBe("Cerere de concediu fără plată");
    expect(d.paragrafe.join(" ")).not.toMatch(/lucrătoare/u);
    expect(d.note.join(" ")).toMatch(/art\. 153/u);
  });

  it("eveniment: pune motivul și NU inventează numărul de zile legal", () => {
    const d = cerereCaDocument({ ...BAZA, tip: "eveniment", motiv: "căsătoria mea" });
    expect(d.paragrafe.join(" ")).toContain("căsătoria mea");
    expect(d.paragrafe.join(" ")).not.toMatch(/\d+ zile/u);
    expect(d.note.join(" ")).toMatch(/art\. 152/u);
  });

  it("tipul necunoscut cade pe odihnă", () => {
    expect(normalizeazaTip("orice")).toBe("odihna");
    expect(normalizeazaTip(null)).toBe("odihna");
  });

  it("citește aceiași parametri ca pagina (de_la, pana_la, salariat, angajator)", () => {
    const d = cerereDinParametri(
      new URLSearchParams({
        tip: "fara-plata",
        salariat: "Popa Ion",
        angajator: "Firma X",
        de_la: "2026-11-02",
        pana_la: "2026-11-06",
      }),
    );
    expect(d.paragrafe.join(" ")).toContain("Popa Ion");
    expect(d.paragrafe.join(" ")).toContain("02.11.2026");
    expect(d.subtitlu).toBe("Către: Firma X");
    expect(d.numeFisier).toBe("cerere-fara-plata-2026-11-02");
  });
});

describe("intervalul invalid", () => {
  it("nu produce un document de semnat, pentru niciuna dintre variante", () => {
    // Revizuirea finală: „20.12 – 10.12, reprezentând 0 zile lucrătoare”, gata de semnat.
    for (const tip of ["odihna", "fara-plata", "eveniment"]) {
      const q = new URLSearchParams({ tip, de_la: "2026-12-20", pana_la: "2026-12-10" });
      expect(() => cerereDinParametri(q), tip).toThrow(EroareIntrare);
    }
  });

  it("problemaCerere spune ce e greșit, iar pentru un interval bun întoarce null", () => {
    expect(problemaCerere("2026-12-20", "2026-12-10")).not.toBeNull();
    expect(problemaCerere("2026-12-21", "2026-12-31")).toBeNull();
  });
});
