import * as ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { citesteExcelDinBuffer, LIMITA_RANDURI } from "./excel";

async function registru(randuri: readonly (readonly unknown[])[]): Promise<ArrayBuffer> {
  const r = new ExcelJS.Workbook();
  const foaie = r.addWorksheet("Tranzactii");
  for (const rand of randuri) foaie.addRow([...rand]);
  const buffer = await r.xlsx.writeBuffer();
  return buffer instanceof ArrayBuffer ? buffer : new Uint8Array(buffer).buffer;
}

// Excel ține ora de perete fără fus: ExcelJS o dă înapoi ca UTC.
const moment = new Date(Date.UTC(2026, 9, 5, 14, 2, 0));
const doarData = new Date(Date.UTC(2026, 9, 5));

describe("citesteExcelDinBuffer", () => {
  it("fără opțiuni, ieșirea e cea de până acum: o celulă Date iese doar ca dată", async () => {
    const r = await citesteExcelDinBuffer(
      await registru([
        ["Data", "Valoare"],
        [moment, 10],
      ]),
    );
    if (!r.ok) throw new Error(r.mesaj);
    expect(r.foaie.antet).toEqual(["Data", "Valoare"]);
    expect(r.foaie.randuri[0]?.celule.get("Data")).toBe("2026-10-05");
    expect(r.foaie.randuri[0]?.rand).toBe(2);
  });

  it("cu `pastreazaOra`, ora de perete se păstrează; miezul nopții rămâne doar dată", async () => {
    const r = await citesteExcelDinBuffer(
      await registru([
        ["Data", "Valoare"],
        [moment, 10],
        [doarData, 11],
      ]),
      { pastreazaOra: true },
    );
    if (!r.ok) throw new Error(r.mesaj);
    expect(r.foaie.randuri[0]?.celule.get("Data")).toBe("2026-10-05T14:02:00");
    expect(r.foaie.randuri[1]?.celule.get("Data")).toBe("2026-10-05");
  });

  it("cu `randAntet`, antetul și datele încep mai jos, iar plafonul se numără pe date", async () => {
    const date = Array.from({ length: LIMITA_RANDURI }, (_, i) => ["1234", i]);
    const r = await citesteExcelDinBuffer(
      await registru([["Extras OMV"], ["Firma SRL"], ["Card", "Valoare"], ...date]),
      { randAntet: 3 },
    );
    if (!r.ok) throw new Error(r.mesaj);
    expect(r.foaie.antet).toEqual(["Card", "Valoare"]);
    expect(r.foaie.randuri).toHaveLength(LIMITA_RANDURI);
    expect(r.foaie.randuri[0]?.rand).toBe(4);
    expect(r.foaie.trunchiat).toBe(false);
  });

  it("un rând de date peste plafon → `trunchiat`", async () => {
    const date = Array.from({ length: LIMITA_RANDURI + 1 }, (_, i) => ["1234", i]);
    const r = await citesteExcelDinBuffer(await registru([["Card", "Valoare"], ...date]));
    if (!r.ok) throw new Error(r.mesaj);
    expect(r.foaie.trunchiat).toBe(true);
    expect(r.foaie.randuri).toHaveLength(LIMITA_RANDURI);
  });
});
