// src/domain/fleet/contabil/format-jurnal.test.ts
import { describe, expect, it } from "vitest";

import { construiesteArticole } from "./articole";
import { celulaText, CSV_IMPLICIT, sumaCsv } from "./csv";
import { articoleCsv, deVerificatCsv, jurnalCsv } from "./format-jurnal";
import { configurare, FIRMA, idTest, linie } from "./test-linii";

function rezultat() {
  return construiesteArticole(
    [
      linie({ id: idTest(1), furnizor: "=SUM(A1)", sofer: "Ștefan Țepeș" }),
      linie({ id: idTest(2), stareFoaie: "trimis", totalBani: 5000 }),
    ],
    configurare(),
    FIRMA,
  );
}

describe("jurnalCsv", () => {
  it("UTF-8 cu BOM, CRLF, separatorul și zecimalele din opțiuni", () => {
    const csv = jurnalCsv(rezultat(), configurare(), CSV_IMPLICIT);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
    const [antet, primul] = csv.slice(1).split("\r\n");
    expect(antet?.split(";")).toHaveLength(20);
    expect(primul).toContain(";100,00;82,64;17,36;0,00;");

    const cuPunct = jurnalCsv(rezultat(), configurare(), { separator: ",", zecimale: "." });
    const [, primulCuPunct] = cuPunct.slice(1).split("\r\n");
    expect(primulCuPunct).toContain(",100.00,82.64,17.36,0.00,");
  });

  it("o formulă din text iese protejată cu apostrof; diacriticele rămân", () => {
    const csv = jurnalCsv(rezultat(), configurare(), CSV_IMPLICIT);
    expect(csv).toContain(`"'=SUM(A1)"`);
    expect(csv).toContain('"Ștefan Țepeș"');
  });

  it("linia exclusă apare cu „nu” și motivul, nu dispare", () => {
    const csv = jurnalCsv(rezultat(), configurare(), CSV_IMPLICIT);
    const exclusa = csv.split("\r\n").find((l) => l.includes(idTest(2)));
    expect(exclusa).toContain(';nu;"Foaie neaprobată: se mai poate corecta."');
  });

  it("la final: totalurile, maparea conturilor folosite și avertismentele", () => {
    const csv = jurnalCsv(
      rezultat(),
      configurare({ contDecontare: "5311", tvaNedeductibila: "cont_separat" }),
      CSV_IMPLICIT,
    );
    const linii = csv.split("\r\n");
    expect(linii.find((l) => l.startsWith('"Total în note"'))).toContain(
      ";100,00;82,64;17,36;0,00",
    );
    expect(linii.find((l) => l.startsWith('"Total în afara notelor"'))).toContain(";50,00");
    expect(linii).toContain('"Combustibil";6022');
    expect(linii).toContain('"Cont de decontare (credit)";5311');
    expect(linii).toContain('"TVA nedeductibil";635');
    expect(linii).toContain('"Avertismente"');
    expect(csv).toContain("afara României");
  });
});

describe("articoleCsv", () => {
  it("antetul Saga și câte un rând per articol, cu data ZZ.LL.AAAA și explicația în ASCII", () => {
    const csv = articoleCsv(rezultat(), CSV_IMPLICIT);
    const linii = csv.slice(1).split("\r\n");
    expect(linii[0]).toBe('"Data";"Nr. doc";"Cont debit";"Cont credit";"Suma";"Explicatie"');
    expect(linii[1]).toBe(
      '03.10.2026;"4521";6022;542;82,64;"Combustibil B123ABC, bon 4521, =SUM(A1)"',
    );
    expect(linii[2]).toBe('03.10.2026;"4521";4426;542;17,36;"TVA deductibil, bon 4521"');
    expect(linii).toHaveLength(4);
  });
});

describe("deVerificatCsv", () => {
  it("doar liniile care nu intră, cu motivul, plus avertismentele", () => {
    const csv = deVerificatCsv(rezultat(), CSV_IMPLICIT);
    expect(csv).toContain(idTest(2));
    expect(csv).not.toContain(idTest(1));
    expect(csv).toContain("Foaie neaprobată");
    expect(csv).toContain('"Avertismente"');
  });
});

describe("celulaText și sumaCsv", () => {
  it("prefixul apare doar la începutul formulei; ghilimelele se dublează", () => {
    expect(celulaText("+40 721")).toBe(`"'+40 721"`);
    expect(celulaText('Stația "Nord"')).toBe('"Stația ""Nord"""');
    expect(celulaText("a\r\nb")).toBe('"a b"');
  });

  it("sumele pe întregi, fără virgulă mobilă", () => {
    expect(sumaCsv(1, ",")).toBe("0,01");
    expect(sumaCsv(123_456, ".")).toBe("1234.56");
    expect(sumaCsv(0, ",")).toBe("0,00");
  });
});
