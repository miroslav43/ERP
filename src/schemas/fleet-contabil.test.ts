// src/schemas/fleet-contabil.test.ts
import { describe, expect, it } from "vitest";

import { CONFIGURARE_IMPLICITA } from "@/domain/fleet/contabil/configurare";

import {
  configurareDinCerere,
  motiveZod,
  optiuniCsvDinCerere,
  schemaExportLa,
} from "./fleet-contabil";

const AZI = "2026-10-22";
const parseaza = (v: Record<string, string>) => schemaExportLa(AZI).safeParse(v);

describe("schemaExportLa", () => {
  it("doar luna și formatul: restul vine din CONFIGURARE_IMPLICITA", () => {
    const r = parseaza({ luna: "2026-09", format: "jurnal_csv" });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(configurareDinCerere(r.data)).toEqual(CONFIGURARE_IMPLICITA);
    expect(optiuniCsvDinCerere(r.data)).toEqual({ separator: ";", zecimale: "," });
    expect(r.data.wm_partener_dupa_cui).toBe("da");
  });

  it("„nu” trimis explicit rămâne „nu” (bifa absentă ar fi fost „da”)", () => {
    const r = parseaza({
      luna: "2026-09",
      format: "saga",
      doar_aprobate: "nu",
      include_service: "da",
    });
    expect(r.success && configurareDinCerere(r.data).doarAprobate).toBe(false);
    expect(r.success && configurareDinCerere(r.data).includeService).toBe(true);
  });

  it("contul cu analitic e acceptat; cel cu spațiu, cu litere la început sau prea lung, nu", () => {
    expect(
      parseaza({ luna: "2026-09", format: "saga", cont_combustibil: "6022.B123ABC" }).success,
    ).toBe(true);
    for (const gresit of ["60 22", "abc", "6022.", "6022.12345678901", "12", ""]) {
      const r = parseaza({ luna: "2026-09", format: "saga", cont_combustibil: gresit });
      expect(r.success, gresit).toBe(false);
      if (!r.success) expect(motiveZod(r.error)).toMatch(/^cont_combustibil: .+\.$/mu);
    }
  });

  it("luna curentă trece; luna viitoare, o lună inexistentă sau lipsa ei, nu", () => {
    expect(parseaza({ luna: "2026-10", format: "saga" }).success).toBe(true);
    const viitoare = parseaza({ luna: "2026-11", format: "saga" });
    expect(viitoare.success).toBe(false);
    if (!viitoare.success)
      expect(motiveZod(viitoare.error)).toContain("luna: Luna aleasă e în viitor.");
    expect(parseaza({ luna: "2026-13", format: "saga" }).success).toBe(false);
    expect(parseaza({ format: "saga" }).success).toBe(false);
  });

  it("un format necunoscut e refuzat, cu un mesaj românesc", () => {
    const r = parseaza({ luna: "2026-09", format: "xlsx" });
    expect(r.success).toBe(false);
    if (!r.success) expect(motiveZod(r.error)).toBe("format: Alegeți formatul fișierului.");
  });

  it("virgula ca separator ȘI ca zecimale e refuzată", () => {
    const r = parseaza({
      luna: "2026-09",
      format: "jurnal_csv",
      csv_separator: "virgula",
      csv_zecimale: "virgula",
    });
    expect(r.success).toBe(false);
    const bun = parseaza({
      luna: "2026-09",
      format: "jurnal_csv",
      csv_separator: "virgula",
      csv_zecimale: "punct",
    });
    expect(bun.success && optiuniCsvDinCerere(bun.data)).toEqual({ separator: ",", zecimale: "." });
  });
});
