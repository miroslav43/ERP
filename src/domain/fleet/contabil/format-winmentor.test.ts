// src/domain/fleet/contabil/format-winmentor.test.ts
import { describe, expect, it } from "vitest";

import { construiesteArticole } from "./articole";
import { noteWinMentor, numarDocumentWinMentor } from "./format-winmentor";
import { configurare, FIRMA, idTest, linie } from "./test-linii";

const CRLF = (linii: readonly string[]) => `${linii.join("\r\n")}\r\n`;

function exemplu() {
  return construiesteArticole(
    [
      linie({
        id: idTest(1),
        furnizor: "OMV Pipera; Nord",
        cuiFurnizor: "1590082",
      }),
      linie({
        id: idTest(10),
        sursa: "cheltuiala",
        categorie: "parcare",
        data: "2026-10-05",
        totalBani: 1210,
        document: "A12",
        furnizor: null,
        cuiFurnizor: null,
        sursaAreCui: false,
        litri: null,
      }),
    ],
    configurare(),
    FIRMA,
  );
}

describe("noteWinMentor", () => {
  it("fișierul de aur: o notă cu partener și jurnal, una fără, comparate la caracter", () => {
    const { note, parteneri } = noteWinMentor(exemplu(), {
      an: 2026,
      luna: 10,
      partenerDupaCui: true,
    });
    expect(note).toBe(
      CRLF([
        "[InfoPachet]",
        "AnLucru=2026",
        "LunaLucru=10",
        "Tipdocument=NOTA CONTABILA",
        "TotalNote=2",
        "",
        "[Nota_1]",
        "NrDoc=4521",
        "Data=03.10.2026",
        "Moneda=Lei",
        "Observatii=Combustibil B123ABC, bon 4521, OMV Pipera, Nord",
        "Partener=1590082",
        "TotalLinii=2",
        "Jurnal=Cumparari",
        "Baza=1",
        "TVA=2",
        "[Items_1]",
        "Item_1=X;6022;X;542;82.64;;Combustibil B123ABC, bon 4521, OMV Pipera, Nord",
        "Item_2=X;4426;X;542;17.36;;TVA deductibil, bon 4521",
        "",
        "[Nota_2]",
        "NrDoc=10",
        "Data=05.10.2026",
        "Moneda=Lei",
        "Observatii=Parcare B123ABC, doc. A12",
        "Partener=",
        "TotalLinii=2",
        "[Items_2]",
        "Item_1=X;628;X;542;10.00;;Parcare B123ABC, doc. A12",
        "Item_2=X;4426;X;542;2.10;;TVA deductibil, doc. A12",
      ]),
    );
    expect(parteneri).toBe(
      CRLF([
        "[InfoPachet]",
        "",
        "[ParteneriNoi_1590082]",
        "Denumire=OMV Pipera, Nord",
        "CodFiscal=1590082",
        "Tara=Romania",
        "SimbolTara=RO",
        "PersoanaFizica=NU",
      ]),
    );
  });

  it("fără bifa „partener după CUI”: nicio notă nu are partener, iar Partner.txt lipsește", () => {
    const { note, parteneri } = noteWinMentor(exemplu(), {
      an: 2026,
      luna: 10,
      partenerDupaCui: false,
    });
    expect(parteneri).toBeNull();
    expect(note).not.toContain("Partener=1590082");
    expect(note).not.toContain("Jurnal=");
  });

  it("la `limitat_50` nota are trei linii: bază, TVA deductibil, TVA nedeductibil", () => {
    const r = construiesteArticole([linie({ regimDeclarat: "limitat_50" })], configurare(), FIRMA);
    const { note } = noteWinMentor(r, { an: 2026, luna: 10, partenerDupaCui: true });
    expect(note).toContain("TotalLinii=3\r\n");
    expect(note).toContain("Baza=1\r\nTVA=2\r\n");
    expect(note).toContain("Item_3=X;6022;X;542;8.68;;TVA nedeductibil, bon 4521\r\n");
  });

  it("niciun `;` din text nu rupe linia de articol: fiecare Item are exact 7 câmpuri", () => {
    const { note } = noteWinMentor(exemplu(), { an: 2026, luna: 10, partenerDupaCui: true });
    for (const rand of note.split("\r\n").filter((l) => l.startsWith("Item_"))) {
      expect(rand.split(";")).toHaveLength(7);
    }
    expect(note.replace(/\r\n/gu, "")).not.toMatch(/\n/u);
  });

  it("TotalNote numără ce s-a scris: o lună fără linii incluse are zero note", () => {
    const { note } = noteWinMentor(construiesteArticole([], configurare(), FIRMA), {
      an: 2026,
      luna: 10,
      partenerDupaCui: true,
    });
    expect(note).toBe(
      CRLF([
        "[InfoPachet]",
        "AnLucru=2026",
        "LunaLucru=10",
        "Tipdocument=NOTA CONTABILA",
        "TotalNote=0",
      ]),
    );
  });
});

describe("numarDocumentWinMentor (L14)", () => {
  it("bonul numeric de cel mult 9 cifre rămâne; altfel numărul derivat din id", () => {
    expect(numarDocumentWinMentor(linie({ document: "4521" }))).toBe("4521");
    const id = "000000ff-1111-4111-8111-111111111111";
    expect(numarDocumentWinMentor(linie({ id, document: "A12" }))).toBe("255");
    expect(numarDocumentWinMentor(linie({ id, document: "1234567890" }))).toBe("255");
  });

  it("e același când lista lunii are o linie în plus sau în minus", () => {
    const fara = linie({ id: idTest(5), document: "A12" });
    const unu = construiesteArticole([fara], configurare(), FIRMA);
    const doi = construiesteArticole(
      [linie({ id: idTest(4), data: "2026-10-01" }), fara],
      configurare(),
      FIRMA,
    );
    const nr = (note: string) =>
      /NrDoc=(\d+)\r\nData=03\.10\.2026\r\nMoneda=Lei\r\nObservatii=Combustibil B123ABC, bon A12/u.exec(
        note,
      )?.[1];
    const a = nr(noteWinMentor(unu, { an: 2026, luna: 10, partenerDupaCui: false }).note);
    const b = nr(noteWinMentor(doi, { an: 2026, luna: 10, partenerDupaCui: false }).note);
    expect(a).toBe("5");
    expect(b).toBe(a);
  });
});
