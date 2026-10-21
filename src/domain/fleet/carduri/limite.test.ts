import { describe, expect, it } from "vitest";

import { LIMITA_RANDURI } from "@/lib/import/excel";

import {
  EXTENSII_EXTRAS,
  LIMITA_RANDURI_EXTRAS,
  MIME_PENTRU_EXTENSIE,
  extensieExtras,
  verificaFisierExtras,
} from "./limite";

describe("limitele extrasului", () => {
  it("plafonul de rânduri e același cu al cititorului Excel", () => {
    expect(LIMITA_RANDURI_EXTRAS).toBe(LIMITA_RANDURI);
  });

  it("fiecare extensie are un MIME din lista bucket-ului org-documents (0002)", () => {
    const bucket = new Set([
      "text/csv",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]);
    for (const ext of EXTENSII_EXTRAS) expect(bucket.has(MIME_PENTRU_EXTENSIE[ext])).toBe(true);
  });

  it("acceptă .csv și .xlsx, indiferent de majuscule", () => {
    expect(verificaFisierExtras("Extras.CSV", 100)).toBeNull();
    expect(verificaFisierExtras("extras.xlsx", 100)).toBeNull();
    expect(extensieExtras("EXTRAS.XLSX")).toBe(".xlsx");
  });

  it.each([
    ["extras.xls", "Excel 97"],
    ["extras.txt", ".csv sau .xlsx"],
    ["extras.xlsm", ".csv sau .xlsx"],
    ["extras.pdf", ".csv sau .xlsx"],
  ])("refuză %s", (nume, fragment) => {
    expect(verificaFisierExtras(nume, 100)).toContain(fragment);
  });

  it("refuză fișierul gol și pe cel peste 5 MB", () => {
    expect(verificaFisierExtras("a.csv", 0)).toContain("gol");
    expect(verificaFisierExtras("a.csv", 5 * 1024 * 1024 + 1)).toContain("5 MB");
  });
});
