// src/app/(app)/mentenanta/iscir/dosar-control.test.ts
import { describe, expect, it } from "vitest";

import { ANTET_DOSAR_CONTROL, coloaneLinie, liniiDosarControl } from "./dosar-control";

const AZI = "2026-10-12";

const autorizatie = (
  p: Partial<Parameters<typeof liniiDosarControl>[0]["autorizatii"][number]> = {},
): Parameters<typeof liniiDosarControl>[0]["autorizatii"][number] => ({
  equipment_id: "e1",
  numar: "ISCIR-77",
  tip: "macara",
  emitent: "ISCIR",
  emis_la: "2026-01-10",
  valabil_pana: "2027-06-01",
  scadenta_verificare_tehnica: null,
  conditii: null,
  suspendata_la: null,
  regim: "inregistrat",
  motiv_suspendare: null,
  inlocuita_de_id: null,
  ...p,
});

const plan = (
  p: Partial<Parameters<typeof liniiDosarControl>[0]["planuri"][number]> = {},
): Parameters<typeof liniiDosarControl>[0]["planuri"][number] => ({
  equipment_id: "e2",
  denumire: "PRAM anual",
  tip: "verificare_legala",
  categorie_legala: "pram",
  temei_legal: null,
  ultima_executie: "2025-10-01",
  urmatoarea_scadenta: "2026-10-01",
  amanat_pana: null,
  ...p,
});

const nume = (id: string): string => (id === "e1" ? "MAC-1 — Macara" : "TBL-2 — Tablou");

describe("liniiDosarControl", () => {
  it("temeiul autorizației e cel al categoriei legale, nu emitentul", () => {
    const [linie] = liniiDosarControl({
      autorizatii: [autorizatie()],
      planuri: [],
      numeEchipament: nume,
      azi: AZI,
    });
    expect(linie?.temei).toContain("PT R1-2010");
    expect(linie?.temei).not.toBe("ISCIR");
    expect(linie?.observatii).toContain("Emitent: ISCIR");
  });

  it("un tip liber, fără categorie, lasă temeiul gol", () => {
    const [linie] = liniiDosarControl({
      autorizatii: [autorizatie({ tip: "Macara capră 5t" })],
      planuri: [],
      numeEchipament: nume,
      azi: AZI,
    });
    expect(linie?.temei).toBe("");
    expect(linie?.categorie).toBe("Macara capră 5t");
  });

  it("evidența RSVTI fără număr arată regimul; rândul înlocuit nu intră", () => {
    const linii = liniiDosarControl({
      autorizatii: [
        autorizatie({ numar: null, regim: "neinregistrat_rsvti" }),
        autorizatie({ numar: "VECHE", inlocuita_de_id: "nou" }),
      ],
      planuri: [],
      numeEchipament: nume,
      azi: AZI,
    });
    expect(linii).toHaveLength(1);
    expect(linii[0]?.numar).toBe("Neînregistrat — în evidența RSVTI");
  });

  it("expirată și suspendată sunt roșii; suspendarea își spune motivul", () => {
    const linii = liniiDosarControl({
      autorizatii: [
        autorizatie({ valabil_pana: "2026-10-01" }),
        autorizatie({ suspendata_la: "2026-10-05", motiv_suspendare: "Cablu uzat" }),
        autorizatie(),
      ],
      planuri: [],
      numeEchipament: nume,
      azi: AZI,
    });
    expect(linii.map((l) => [l.stare, l.rosu])).toEqual([
      ["Expirată", true],
      ["Suspendată", true],
      ["Valabilă", false],
    ]);
    expect(linii[1]?.observatii).toContain("Suspendată la 2026-10-05: Cablu uzat");
  });

  it("planurile: doar verificările legale; temeiul scris pe plan are prioritate", () => {
    const linii = liniiDosarControl({
      autorizatii: [],
      planuri: [
        plan(),
        plan({ temei_legal: "Contract de mentenanță nr. 4" }),
        plan({ tip: "preventiva", denumire: "Ungere" }),
      ],
      numeEchipament: nume,
      azi: AZI,
    });
    expect(linii).toHaveLength(2);
    expect(linii[0]?.temei).toMatch(/^⚠ .*\(de confirmat\)$/u);
    expect(linii[0]?.rosu).toBe(true);
    expect(linii[0]?.stare).toBe("În întârziere");
    expect(linii[1]?.temei).toBe("Contract de mentenanță nr. 4");
    expect(linii[0]?.echipament).toBe("TBL-2 — Tablou");
  });

  it("coloanele urmează antetul", () => {
    const [linie] = liniiDosarControl({
      autorizatii: [autorizatie()],
      planuri: [],
      numeEchipament: nume,
      azi: AZI,
    });
    expect(linie).toBeDefined();
    if (linie === undefined) return;
    expect(coloaneLinie(linie)).toHaveLength(ANTET_DOSAR_CONTROL.length);
    expect(coloaneLinie(linie)[0]).toBe("MAC-1 — Macara");
  });
});
