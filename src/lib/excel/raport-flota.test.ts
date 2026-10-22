// src/lib/excel/raport-flota.test.ts
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import {
  consumPeVehicul,
  costPeVehicul,
  kmPeSofer,
  registruFoi,
  totaluriCost,
  totaluriLuna,
  type FoaieRaport,
  type RaportLunar,
} from "@/domain/fleet/rapoarte";
import ExcelJS from "exceljs";

import { SEMNATURA_FISIER } from "@/lib/unelte/document-tabelar";
import {
  formatCuUnitate,
  FORMAT_LEI,
  FORMAT_NUMAR_INTREG,
  FORMAT_PROCENT_CU_SEMN,
  numar,
} from "@/lib/unelte/xlsx";

import { documentRaportFlota, xlsxRaportFlota } from "./raport-flota";

const int = (v: number) => numar(v, FORMAT_NUMAR_INTREG);
const lei = (v: number) => numar(v, FORMAT_LEI);

const V1 = "11111111-1111-4111-8111-111111111111";
const S1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const foaie = (id: string, m: Partial<FoaieRaport> = {}): FoaieRaport => ({
  id,
  vehicle_id: V1,
  employee_id: S1,
  numar: "FP-2026-0001",
  data: "2026-09-02",
  km_parcursi: 400,
  vehicul_nr: "B100ABC",
  vehicul_combustibil: "motorina",
  norma_l_100km: 7,
  alimentari: [{ litri: 36, cost: 252.5 }],
  ...m,
});

function raport(foi: readonly FoaieRaport[], m: Partial<RaportLunar> = {}): RaportLunar {
  const vehicule = new Map([[V1, "B100ABC"]]);
  const soferi = new Map([[S1, "Popescu Ion"]]);
  const costuri = costPeVehicul(
    {
      foi,
      servicii: foi.length === 0 ? [] : [{ vehicle_id: V1, cost_total: 750 }],
      cheltuieli: [],
      documente: [],
    },
    vehicule,
  );
  return {
    luna: "2026-09",
    interval: { deLa: "2026-09-01", panaLa: "2026-09-30" },
    vehicul: null,
    totaluri: totaluriLuna(foi),
    foiNeaprobate: { ciorne: 0, trimise: 0, respinse: 0 },
    consum: consumPeVehicul(foi, vehicule),
    soferi: kmPeSofer(foi, soferi),
    costuri,
    totalCost: totaluriCost(costuri),
    registru: registruFoi(foi, vehicule, soferi),
    ...m,
  };
}

const intrare = (r: RaportLunar, vehicul: string | null = null) =>
  documentRaportFlota({
    organizatie: "Firma Test SRL",
    raport: r,
    vehicul,
    generatLa: "12.10.2026 22:50",
  });

describe("documentRaportFlota", () => {
  it("titlul spune luna, subtitlul firma; pe un singur vehicul, și vehiculul", () => {
    const d = intrare(raport([foaie("f1")]));
    expect(d.titlu).toBe("Raport flotă — septembrie 2026");
    expect(d.subtitlu).toBe("Firma Test SRL");
    expect(intrare(raport([foaie("f1")]), "B100ABC").subtitlu).toBe(
      "Firma Test SRL · vehiculul B100ABC",
    );
    expect(d.numeFisier).toBe("raport-flota-2026-09");
    expect(intrare(raport([foaie("f1")]), "B100ABC").numeFisier).toBe(
      "raport-flota-2026-09-B100ABC",
    );
    expect(d.orientare).toBe("peisaj");
  });

  it("primul tabel e costul pe vehicul, cu rând de total, iar cifrele sunt NUMERE", () => {
    const d = intrare(raport([foaie("f1")]));
    expect(d.coloane.map((c) => c.eticheta)).toEqual([
      "Vehicul",
      "Foi",
      "Service",
      "Cheltuieli",
      "Documente",
      "Combustibil (foi)",
      "Total",
      "Km",
      "Lei/km",
    ]);
    // 750 service + 252,50 combustibil = 1.002,50 lei la 400 km → 2,51 lei/km
    const asteptat = [
      int(1),
      lei(750),
      lei(0),
      lei(0),
      lei(252.5),
      lei(1002.5),
      int(400),
      lei(2.51),
    ];
    expect(d.randuri[0]).toEqual(["B100ABC", ...asteptat]);
    expect(d.randuri.at(-1)).toEqual(["Total flotă", ...asteptat]);
  });

  it("consumul real față de normă, cu unitatea pe rând și abaterea cu semn", () => {
    const d = intrare(raport([foaie("f1")]));
    const consum = d.tabeleSuplimentare?.find((t) => t.titlu.startsWith("Consum"));
    expect(consum?.coloane.map((c) => c.eticheta)).toEqual([
      "Vehicul",
      "Foi",
      "Km",
      "Alimentat",
      "Consum real",
      "Norma",
      "Abatere",
      "Foi fără normă",
    ]);
    // 36 l la 400 km = 9,00 l/100 km față de norma 7,00 → +28,6%
    expect(consum?.randuri[0]).toEqual([
      "B100ABC",
      int(1),
      int(400),
      numar(36, formatCuUnitate("l")),
      numar(9, formatCuUnitate("l/100")),
      numar(7, formatCuUnitate("l/100")),
      // Fracția, nu procentul: formatul Excel înmulțește cu 100 (+28,6%).
      numar(0.286, FORMAT_PROCENT_CU_SEMN),
      int(0),
    ]);
  });

  it("fără normă pe foaie, norma și abaterea sunt „—”, nu zero", () => {
    const d = intrare(raport([foaie("f1", { norma_l_100km: null })]));
    const consum = d.tabeleSuplimentare?.find((t) => t.titlu.startsWith("Consum"));
    // „—” rămâne text: SUM îl sare, nu-l ia drept zero.
    expect(consum?.randuri[0]?.slice(5)).toEqual(["—", "—", int(1)]);
  });

  it("vehiculul electric se arată în kWh", () => {
    const d = intrare(raport([foaie("f1", { vehicul_combustibil: "electric" })]));
    const consum = d.tabeleSuplimentare?.find((t) => t.titlu.startsWith("Consum"));
    expect(consum?.randuri[0]?.[3]).toEqual(numar(36, formatCuUnitate("kWh")));
    expect(consum?.randuri[0]?.[4]).toEqual(numar(9, formatCuUnitate("kWh/100")));
  });

  it("kilometrii pe șofer și registrul foilor, cu data românească și „—” la foaia fără număr", () => {
    const d = intrare(
      raport([foaie("f1"), foaie("f2", { numar: null, data: "2026-09-03", km_parcursi: null })]),
    );
    const soferi = d.tabeleSuplimentare?.find((t) => t.titlu.startsWith("Kilometri"));
    expect(soferi?.coloane.map((c) => c.eticheta)).toEqual([
      "Șofer",
      "Foi",
      "Zile",
      "Vehicule",
      "Km",
    ]);
    expect(soferi?.randuri[0]).toEqual(["Popescu Ion", int(2), int(2), int(1), int(400)]);

    const registru = d.tabeleSuplimentare?.find((t) => t.titlu.startsWith("Foile"));
    expect(registru?.coloane.map((c) => c.eticheta)).toEqual([
      "Nr. foaie",
      "Data",
      "Vehicul",
      "Șofer",
      "Km",
      "Alimentat",
      "Cost combustibil",
      "Consum real",
      "Norma",
    ]);
    expect(registru?.randuri[0]?.slice(0, 5)).toEqual([
      "FP-2026-0001",
      "02.09.2026",
      "B100ABC",
      "Popescu Ion",
      int(400),
    ]);
    expect(registru?.randuri[1]?.[0]).toBe("—");
  });

  it("foile neaprobate se spun în antet, ca un total mic să nu fie luat drept consum mic", () => {
    const fara = intrare(raport([foaie("f1")]));
    expect(fara.campuri.find((c) => c.eticheta.startsWith("Foi neaprobate"))?.valoare).toBe(
      "nicio foaie",
    );
    const cu = intrare(
      raport([foaie("f1")], { foiNeaprobate: { ciorne: 1, trimise: 2, respinse: 1 } }),
    );
    expect(cu.campuri.find((c) => c.eticheta.startsWith("Foi neaprobate"))?.valoare).toBe(
      "1 ciornă, 2 trimise spre aprobare, 1 respinsă",
    );
  });

  it("o lună fără foi: documentul există, cu rânduri goale, fără cifre inventate", () => {
    const d = intrare(raport([]));
    expect(d.randuri.at(-1)?.slice(-2)).toEqual([int(0), "—"]);
    const registru = d.tabeleSuplimentare?.find((t) => t.titlu.startsWith("Foile"));
    expect(registru?.randuri).toEqual([]);
  });

  it("notele spun ce intră în cifre și că valorile se adună", () => {
    const note = intrare(raport([foaie("f1")])).note.join("\n");
    expect(note).toContain("foile APROBATE");
    expect(note).toContain("se adună");
    expect(note).not.toContain("nu se adună");
  });

  it("se randează în Excel: fișier valid, cu luna și vehiculul în conținut", async () => {
    const octeti = await xlsxRaportFlota(intrare(raport([foaie("f1")])));
    const zip = await JSZip.loadAsync(octeti);
    const texte = await zip.file("xl/sharedStrings.xml")?.async("string");
    expect(texte).toContain("Raport flotă — septembrie 2026");
    expect(texte).toContain("B100ABC");
    expect(texte).toContain("FP-2026-0001");
  });

  it("export al aplicației: fără „Generat gratuit cu administrativo.ro”", async () => {
    const octeti = await xlsxRaportFlota(intrare(raport([foaie("f1")])));
    const zip = await JSZip.loadAsync(octeti);
    const texte = (await zip.file("xl/sharedStrings.xml")?.async("string")) ?? "";
    expect(texte).not.toContain(SEMNATURA_FISIER);
    expect(texte).not.toContain("administrativo.ro");
  });

  it("în Excel, coloanele de sume sunt numere care se adună (contabilul face SUM)", async () => {
    const octeti = await xlsxRaportFlota(
      intrare(
        raport([
          foaie("f1"),
          foaie("f2", { data: "2026-09-03", alimentari: [{ litri: 10, cost: 70.25 }] }),
        ]),
      ),
    );
    const registru = new ExcelJS.Workbook();
    await registru.xlsx.load(new Uint8Array(octeti).buffer);
    const fila = registru.worksheets[0];
    // Rândurile registrului de foi: col. 1 = numărul foii, col. 7 = costul combustibilului.
    const costuri: unknown[] = [];
    fila?.eachRow((r) => {
      if (r.getCell(1).value === "FP-2026-0001") costuri.push(r.getCell(7).value);
    });
    expect(costuri).toEqual([252.5, 70.25]);
    expect(costuri.every((c) => typeof c === "number")).toBe(true);
    const vehicul = fila?.getRows(1, fila.rowCount)?.find((r) => r.getCell(1).value === "B100ABC");
    // Combustibilul foilor, pe vehicul = suma celor două foi; formatul e lei.
    expect(vehicul?.getCell(6).value).toBe(322.75);
    expect(vehicul?.getCell(6).numFmt).toBe(FORMAT_LEI);
  });
});
