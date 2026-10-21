// src/lib/unelte/xlsx.test.ts
//
// Cele două căi ale randării Excel comune:
// - `subsol`: rândul „Generat gratuit cu administrativo.ro” rămâne pe fișierele
//   uneltelor publice și lipsește din exporturile aplicației plătite;
// - celulele numerice: un export al aplicației scrie NUMERE (cu format de
//   afișare), ca o coloană să se poată aduna în Excel; uneltele scriu text, ca
//   până acum.
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { SEMNATURA_FISIER, type DocumentTabelar } from "./document-tabelar";
import { raspunsDocument } from "./raspuns";
import {
  curataDocumentXlsx,
  FORMAT_LEI,
  FORMAT_NUMAR_INTREG,
  FORMAT_PROCENT_CU_SEMN,
  numar,
  randeazaXlsx,
  type DocumentXlsx,
} from "./xlsx";

const DOC: DocumentTabelar = {
  titlu: "Condica de prezență — octombrie 2026",
  subtitlu: "Firma Exemplu SRL",
  campuri: [],
  paragrafe: [],
  coloane: [
    { eticheta: "Data", latime: 2 },
    { eticheta: "Nume", latime: 4 },
  ],
  randuri: [["01.10.2026", "Popa Ion"]],
  umbrite: [],
  note: [],
  semnaturi: [],
  orientare: "portret",
  numeFisier: "condica",
  sursa: "/unelte/condica-de-prezenta",
};

async function siruri(octeti: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(octeti);
  return (await zip.file("xl/sharedStrings.xml")?.async("string")) ?? "";
}

async function legaturi(octeti: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(octeti);
  const relatii = Object.keys(zip.files).filter((f) => f.includes("worksheets/_rels/"));
  return (await Promise.all(relatii.map((f) => zip.file(f)?.async("string")))).join(" ");
}

async function fila(octeti: Uint8Array): Promise<ExcelJS.Worksheet> {
  const registru = new ExcelJS.Workbook();
  await registru.xlsx.load(new Uint8Array(octeti).buffer);
  const f = registru.worksheets[0];
  if (f === undefined) throw new Error("registrul n-are nicio filă");
  return f;
}

describe("randeazaXlsx — subsolul", () => {
  it("unealta publică: ultimul rând e semnătura, cu legătură spre unealtă", async () => {
    const octeti = await randeazaXlsx(DOC, { subsol: "unealta" });
    expect(await siruri(octeti)).toContain(SEMNATURA_FISIER);
    expect(await legaturi(octeti)).toMatch(/\/unelte\/condica-de-prezenta\?utm_source=fisier/u);
  });

  it("exportul aplicației: nicio semnătură și nicio legătură de marketing", async () => {
    const octeti = await randeazaXlsx(DOC, { subsol: "aplicatie" });
    const texte = await siruri(octeti);
    expect(texte).not.toContain(SEMNATURA_FISIER);
    expect(texte).not.toContain("administrativo.ro");
    expect(await legaturi(octeti)).not.toMatch(/utm_source/u);
    // Conținutul rămâne.
    expect(texte).toContain("Popa Ion");
  });

  it("calea uneltelor (`raspunsDocument`) își păstrează semnătura", async () => {
    const r = await raspunsDocument(DOC, "xlsx");
    expect(await siruri(new Uint8Array(await r.arrayBuffer()))).toContain(SEMNATURA_FISIER);
  });
});

describe("randeazaXlsx — celulele numerice", () => {
  const CU_NUMERE: DocumentXlsx = {
    ...DOC,
    coloane: [
      { eticheta: "Vehicul", latime: 2 },
      { eticheta: "Km", latime: 2 },
      { eticheta: "Total (lei)", latime: 2 },
      { eticheta: "Abatere", latime: 2 },
    ],
    randuri: [
      ["B100ABC", numar(1400, FORMAT_NUMAR_INTREG), numar(1002.5, FORMAT_LEI), "—"],
      [
        "CJ200XYZ",
        numar(600, FORMAT_NUMAR_INTREG),
        numar(97.25, FORMAT_LEI),
        numar(0.286, FORMAT_PROCENT_CU_SEMN),
      ],
    ],
    tabeleSuplimentare: [
      {
        titlu: "Pe șofer",
        coloane: [
          { eticheta: "Șofer", latime: 2 },
          { eticheta: "Km", latime: 2 },
        ],
        randuri: [["Popescu Ion", numar(2000, FORMAT_NUMAR_INTREG)]],
      },
    ],
  };

  it("numărul ajunge NUMĂR în celulă, cu formatul de afișare; textul rămâne text", async () => {
    const f = await fila(await randeazaXlsx(CU_NUMERE, { subsol: "aplicatie" }));
    const b100 = f.getRows(1, f.rowCount)?.find((r) => r.getCell(1).value === "B100ABC");
    expect(b100?.getCell(2).value).toBe(1400);
    expect(b100?.getCell(2).numFmt).toBe(FORMAT_NUMAR_INTREG);
    expect(b100?.getCell(3).value).toBe(1002.5);
    expect(b100?.getCell(3).numFmt).toBe(FORMAT_LEI);
    // „—” e text: SUM îl sare, nu-l ia drept zero.
    expect(b100?.getCell(4).value).toBe("—");
    const cj = f.getRows(1, f.rowCount)?.find((r) => r.getCell(1).value === "CJ200XYZ");
    expect(cj?.getCell(4).value).toBe(0.286);
    expect(cj?.getCell(4).numFmt).toBe(FORMAT_PROCENT_CU_SEMN);
    const sofer = f.getRows(1, f.rowCount)?.find((r) => r.getCell(1).value === "Popescu Ion");
    expect(sofer?.getCell(2).value).toBe(2000);
  });

  it("coloana numerică se adună: suma celulelor e suma valorilor", async () => {
    const f = await fila(await randeazaXlsx(CU_NUMERE, { subsol: "aplicatie" }));
    let suma = 0;
    f.eachRow((r) => {
      const v = r.getCell(3).value;
      if (typeof v === "number") suma += v;
    });
    expect(suma).toBeCloseTo(1099.75, 6);
  });

  it("formatele de afișare sunt coduri Excel, nu text deja formatat", () => {
    // Separatorii din cod sunt cei ai Excelului (`,` mii, `.` zecimale); Excelul
    // în limba română îi afișează `1.002,50`.
    expect(FORMAT_LEI).toBe("#,##0.00");
    expect(FORMAT_NUMAR_INTREG).toBe("#,##0");
    expect(numar(12.5, FORMAT_LEI)).toEqual({ numar: 12.5, format: FORMAT_LEI });
  });

  it("un număr care nu e finit nu ajunge în fișier ca NaN", () => {
    expect(() => numar(Number.NaN, FORMAT_LEI)).toThrow(/finit/u);
    expect(() => numar(Number.POSITIVE_INFINITY, FORMAT_LEI)).toThrow(/finit/u);
  });

  it("curățarea atinge textele și lasă numerele neschimbate", () => {
    const murdar: DocumentXlsx = {
      ...CU_NUMERE,
      titlu: "Raport\u000Blunar",
      randuri: [["B100￾ABC", numar(5, FORMAT_NUMAR_INTREG)]],
      tabeleSuplimentare: [
        {
          titlu: "Pe\u000Bșofer",
          coloane: [{ eticheta: "Ș￿ofer", latime: 2 }],
          randuri: [["Popescu\u000BIon", numar(7, FORMAT_LEI)]],
        },
      ],
    };
    const curat = curataDocumentXlsx(murdar);
    expect(curat.titlu).toBe("Raport lunar");
    expect(curat.randuri).toEqual([["B100ABC", numar(5, FORMAT_NUMAR_INTREG)]]);
    expect(curat.tabeleSuplimentare?.[0]?.titlu).toBe("Pe șofer");
    expect(curat.tabeleSuplimentare?.[0]?.coloane[0]?.eticheta).toBe("Șofer");
    expect(curat.tabeleSuplimentare?.[0]?.randuri).toEqual([["Popescu Ion", numar(7, FORMAT_LEI)]]);
  });
});
