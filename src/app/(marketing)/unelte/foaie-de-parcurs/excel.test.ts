import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { randeazaFoaieParcursXlsx } from "./excel";
import {
  CHEI_REZUMAT,
  coloaneAlimentari,
  coloaneCurse,
  construiesteFoaieParcurs,
  eticheteRezumat,
  RANDURI_ALIMENTARI,
  TITLU_ALIMENTARI,
  TITLU_REZUMAT,
  type ParametriFoaieParcurs,
} from "./model";

/**
 * Auditul din 8 oct 2026: Excel-ul foii de parcurs avea ZERO formule. Testele
 * citesc fișierul înapoi și rezolvă fiecare referință după ETICHETA coloanei,
 * nu după literă: o coloană mutată în model nu poate lăsa o formulă să adune
 * altceva decât spune antetul.
 */
const P: ParametriFoaieParcurs = {
  an: 2026,
  luna: 10,
  nrAuto: "B-123-ABC",
  marca: "Dacia Logan",
  sofer: "Radu Andrei",
  firma: "Construct SRL",
  cui: "RO12345678",
  nrFoaie: "17",
  categorie: "autoturism",
  combustibil: "motorina",
  utilizare: "agent",
  norma: 6.5,
  kmInitial: 125_000,
  stocInitial: 20,
  cursePeZi: 2,
};

async function deschide(p: ParametriFoaieParcurs) {
  const octeti = await randeazaFoaieParcursXlsx(p, construiesteFoaieParcurs(p));
  const registru = new ExcelJS.Workbook();
  // O copie cu `ArrayBuffer` propriu: tipul cerut de `xlsx.load`.
  await registru.xlsx.load(new Uint8Array(octeti).buffer);
  const fila = registru.getWorksheet("Foaie de parcurs");
  if (fila === undefined) throw new Error("Lipsește fila „Foaie de parcurs”.");
  return { fila, octeti };
}

const text = (c: ExcelJS.Cell) => (typeof c.value === "string" ? c.value : "");

/** Primul rând a cărui primă celulă are exact textul dat. */
function randul(fila: ExcelJS.Worksheet, prima: string): ExcelJS.Row {
  for (let r = 1; r <= fila.rowCount; r += 1) {
    if (text(fila.getRow(r).getCell(1)) === prima) return fila.getRow(r);
  }
  throw new Error(`Niciun rând nu începe cu „${prima}”.`);
}

/** Litera coloanei cu eticheta dată, pe rândul de antet. */
function litera(antet: ExcelJS.Row, eticheta: string): string {
  for (let c = 1; c <= 11; c += 1) {
    if (text(antet.getCell(c)) === eticheta) return antet.getCell(c).address.replace(/\d+/u, "");
  }
  throw new Error(`Lipsește coloana „${eticheta}”.`);
}

const formula = (c: ExcelJS.Cell) => c.formula ?? "";

describe("Excel-ul foii de parcurs", { timeout: 30_000 }, () => {
  it("antetul tabelului e cel din model, în aceeași ordine", async () => {
    const { fila } = await deschide(P);
    const antet = randul(fila, "Data");
    const etichete = Array.from({ length: 11 }, (_, i) => text(antet.getCell(i + 1)));
    expect(etichete).toEqual(coloaneCurse("l").map((c) => c.eticheta));
  });

  it("norma e număr în antet, iar fiecare cursă are km = sosire − plecare și consum = km × normă ÷ 100", async () => {
    const { fila } = await deschide(P);
    const randNorma = randul(fila, "Norma proprie de consum (l/100 km):");
    expect(randNorma.getCell(5).value).toBe(6.5);
    const N = `$E$${String(randNorma.number)}`;
    const antet = randul(fila, "Data");
    const G = litera(antet, "Km bord\nla plecare");
    const H = litera(antet, "Km bord\nla sosire");
    const I = litera(antet, "Km\nparcurși");
    const J = litera(antet, "Consum\nnormat (l)");
    const curse = 31 * 2;
    for (let k = 1; k <= curse; k += 1) {
      const r = antet.number + k;
      const rand = fila.getRow(r);
      expect(formula(fila.getCell(`${I}${String(r)}`))).toBe(
        `IF(AND(ISNUMBER(${G}${String(r)}),ISNUMBER(${H}${String(r)})),${H}${String(r)}-${G}${String(r)},"")`,
      );
      expect(formula(fila.getCell(`${J}${String(r)}`))).toBe(
        `IF(AND(ISNUMBER(${I}${String(r)}),ISNUMBER(${N})),ROUND(${I}${String(r)}*${N}/100,2),"")`,
      );
      expect(rand.getCell(1).value).toBeInstanceOf(Date);
    }
    expect(text(fila.getRow(antet.number + curse + 1).getCell(1))).toBe("Total lună");
  });

  it("data e dată adevărată, kilometrajul inițial e pe prima cursă, weekendul e umbrit", async () => {
    const { fila } = await deschide(P);
    const antet = randul(fila, "Data");
    const prima = fila.getRow(antet.number + 1);
    expect((prima.getCell(1).value as Date).toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(prima.getCell(1).numFmt).toBe("dd.mm.yyyy");
    expect(prima.getCell(7).value).toBe(125_000);
    expect(fila.getRow(antet.number + 3).getCell(7).value).toBeNull();
    // 3 octombrie 2026 e sâmbătă: rândurile 5 și 6 (două curse pe zi).
    const sambata = fila.getRow(antet.number + 5);
    expect(text(sambata.getCell(2))).toBe("Sâ");
    expect(sambata.getCell(5).fill).toMatchObject({
      fgColor: { argb: "FFE6E9E6" },
    });
  });

  it("km la sosire nu se pot scrie mai puțini decât km la plecare", async () => {
    // Citit din XML, nu prin ExcelJS: la citire, ExcelJS transformă formula
    // validării „whole” în număr (NaN). Scrisă, e corectă.
    const { fila, octeti } = await deschide(P);
    const antet = randul(fila, "Data");
    const r = String(antet.number + 1);
    const G = litera(antet, "Km bord\nla plecare");
    const H = litera(antet, "Km bord\nla sosire");
    const zip = await JSZip.loadAsync(octeti);
    const foaie = (await zip.file("xl/worksheets/sheet1.xml")?.async("string")) ?? "";
    expect(foaie).toMatch(
      new RegExp(
        `<dataValidation type="whole" operator="greaterThanOrEqual" [^>]*showErrorMessage="1"[^>]*sqref="${H}${r}"><formula1>${G}${r}</formula1>`,
        "u",
      ),
    );
  });

  it("totalul lunii adună exact cursele, nici mai mult, nici mai puțin", async () => {
    const { fila } = await deschide(P);
    const antet = randul(fila, "Data");
    const I = litera(antet, "Km\nparcurși");
    const total = randul(fila, "Total lună");
    const prima = antet.number + 1;
    const ultima = total.number - 1;
    expect(ultima - prima + 1).toBe(62);
    expect(formula(fila.getCell(`${I}${String(total.number)}`))).toBe(
      `SUM(${I}${String(prima)}:${I}${String(ultima)})`,
    );
  });

  it("alimentările: antetul din model, 8 rânduri și totalurile pe cantitate și valoare", async () => {
    const { fila } = await deschide(P);
    const titlu = randul(fila, TITLU_ALIMENTARI);
    const antet = fila.getRow(titlu.number + 1);
    expect([1, 2, 5, 6, 7, 9].map((c) => text(antet.getCell(c)))).toEqual(
      coloaneAlimentari("l").map((c) => c.eticheta),
    );
    const total = fila.getRow(antet.number + RANDURI_ALIMENTARI + 1);
    expect(text(total.getCell(1))).toBe("Total");
    const prima = String(antet.number + 1);
    const ultima = String(antet.number + RANDURI_ALIMENTARI);
    expect(formula(total.getCell(6))).toBe(`SUM(F${prima}:F${ultima})`);
    expect(formula(total.getCell(7))).toBe(`SUM(G${prima}:G${ultima})`);
  });

  it("rezumatul: etichetele din model și stocul după normă = început + alimentat − consum", async () => {
    const { fila } = await deschide(P);
    const titlu = randul(fila, TITLU_REZUMAT);
    const etichete = eticheteRezumat("l");
    const adresa = (k: (typeof CHEI_REZUMAT)[number]) =>
      `E${String(titlu.number + 1 + CHEI_REZUMAT.indexOf(k))}`;
    CHEI_REZUMAT.forEach((k, i) => {
      expect(text(fila.getRow(titlu.number + 1 + i).getCell(1))).toBe(etichete[k]);
    });
    expect(fila.getCell(adresa("kmInceput")).value).toBe(125_000);
    expect(fila.getCell(adresa("stocInceput")).value).toBe(20);
    expect(formula(fila.getCell(adresa("stocCalculat")))).toBe(
      `IF(AND(ISNUMBER(${adresa("stocInceput")}),ISNUMBER(${adresa("consumNormat")})),ROUND(${adresa("stocInceput")}+${adresa("alimentat")}-${adresa("consumNormat")},2),"")`,
    );
    expect(formula(fila.getCell(adresa("diferenta")))).toBe(
      `IF(AND(ISNUMBER(${adresa("stocConstatat")}),ISNUMBER(${adresa("stocCalculat")})),ROUND(${adresa("stocConstatat")}-${adresa("stocCalculat")},2),"")`,
    );
    const totalLuna = randul(fila, "Total lună").number;
    expect(formula(fila.getCell(adresa("kmTotal")))).toMatch(
      new RegExp(`^I${String(totalLuna)}$`, "u"),
    );
  });

  it("fără normă: celula rămâne goală de completat, formulele rămân", async () => {
    const { fila } = await deschide({
      ...P,
      norma: null,
      kmInitial: null,
      stocInitial: null,
    });
    const randNorma = randul(fila, "Norma proprie de consum (l/100 km):");
    expect(randNorma.getCell(5).value).toBeNull();
    const antet = randul(fila, "Data");
    expect(formula(fila.getRow(antet.number + 1).getCell(10))).toContain(
      `$E$${String(randNorma.number)}`,
    );
  });

  it("se recalculează la deschidere și are destule formule", async () => {
    const { octeti } = await deschide(P);
    const zip = await JSZip.loadAsync(octeti);
    const registru = (await zip.file("xl/workbook.xml")?.async("string")) ?? "";
    expect(registru).toMatch(/fullCalcOnLoad="1"/u);
    // Antetul tabelului se repetă la tipar; pe ecran nu se îngheață nimic.
    expect(registru).toMatch(/_xlnm\.Print_Titles/u);
    const foaie = (await zip.file("xl/worksheets/sheet1.xml")?.async("string")) ?? "";
    // 62 de curse × 2 + 2 totaluri de curse + 2 de alimentări + 8 în rezumat.
    expect(foaie.match(/<f>/gu)?.length).toBe(62 * 2 + 2 + 2 + 8);
    expect(foaie).not.toMatch(/<pane /u);
  });

  it("la electric, coloana de consum și norma sunt în kWh", async () => {
    const { fila } = await deschide({
      ...P,
      combustibil: "electric",
      norma: 16,
    });
    expect(randul(fila, "Norma proprie de consum (kWh/100 km):").getCell(5).value).toBe(16);
    litera(randul(fila, "Data"), "Consum\nnormat (kWh)");
  });
});
