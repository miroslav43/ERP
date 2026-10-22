// src/domain/fleet/contabil/format-saga.test.ts
import { describe, expect, it } from "vitest";

import { construiesteArticole } from "./articole";
import { articoleSagaDbf, facturiSagaXml, imparteSaga, numeFisierNc, textXml } from "./format-saga";
import { configurare, FIRMA, idTest, linie } from "./test-linii";

function saga(linii: Parameters<typeof construiesteArticole>[0], c = configurare()) {
  const r = construiesteArticole(linii, c, FIRMA);
  const { xml, dbf } = imparteSaga(r, FIRMA);
  return { r, xml, dbf, iesire: facturiSagaXml(xml, FIRMA, c) };
}

describe("facturiSagaXml", () => {
  it("numele F_<cui>_<nr>_<ZZ.LL.AAAA>.xml, intrarea pe CIF-ul firmei, bon de casă cu cod fiscal", () => {
    const { iesire } = saga([linie({ id: idTest(1) })]);
    expect(iesire.facturi.map((f) => f.nume)).toEqual(["F_1590082_4521_03.10.2026.xml"]);
    const [f] = iesire.facturi;
    expect(f?.continut).toContain("<ClientCIF>12345678</ClientCIF>");
    expect(f?.continut).toContain("<FurnizorCIF>1590082</FurnizorCIF>");
    expect(f?.continut).toContain("<FacturaTip>C</FacturaTip>");
    expect(f?.continut).toContain("<FacturaNumar>4521</FacturaNumar>");
    expect(f?.continut).toContain("<FacturaData>03.10.2026</FacturaData>");
    expect(f?.continut).toContain(`<FacturaID>${idTest(1)}</FacturaID>`);
  });

  it("linia: litri pe L, baza ca valoare, TVA-ul întreg, contul categoriei", () => {
    const { iesire } = saga([linie({ litri: 30 })]);
    const xml = iesire.facturi[0]?.continut ?? "";
    expect(xml).toContain("<UM>L</UM>");
    expect(xml).toContain("<Cantitate>30.00</Cantitate>");
    expect(xml).toContain("<Pret>2.7547</Pret>");
    expect(xml).toContain("<Valoare>82.64</Valoare>");
    expect(xml).toContain("<ProcTVA>21</ProcTVA>");
    expect(xml).toContain("<TVA>17.36</TVA>");
    expect(xml).toContain("<Cont>6022</Cont>");
    expect(xml).toMatch(/\r\n$/u);
    expect(xml.replace(/\r\n/gu, "")).not.toMatch(/\n/u);
  });

  it("`N50` doar la `limitat_50`; TVA-ul din XML rămâne întreg (Saga aplică singur limitarea)", () => {
    const integral = saga([linie({ regimDeclarat: "integral" })]).iesire.facturi[0]?.continut ?? "";
    const limitat =
      saga([linie({ regimDeclarat: "limitat_50" })]).iesire.facturi[0]?.continut ?? "";
    expect(integral).not.toContain("TipDeducere");
    expect(limitat).toContain("<TipDeducere>N50</TipDeducere>");
    expect(limitat).toContain("<TVA>17.36</TVA>");
  });

  it("escapează `&` și transliterează: „Popa & Fiii” devine Popa &amp; Fiii", () => {
    const xml =
      saga([linie({ furnizor: "Stația „Popa & Fiii” <Pipera>" })]).iesire.facturi[0]?.continut ??
      "";
    expect(xml).toContain(
      "<FurnizorNume>Statia &quot;Popa &amp; Fiii&quot; &lt;Pipera&gt;</FurnizorNume>",
    );
    expect(textXml("a'b")).toBe("a&apos;b");
    for (const ch of xml) expect(ch.charCodeAt(0)).toBeLessThanOrEqual(0x7e);
  });

  it("același CUI, număr și dată: al doilea fișier primește _2, cu avertisment", () => {
    const { iesire } = saga([linie({ id: idTest(1) }), linie({ id: idTest(2) })]);
    expect(iesire.facturi.map((f) => f.nume)).toEqual([
      "F_1590082_4521_03.10.2026.xml",
      "F_1590082_4521_03.10.2026_2.xml",
    ]);
    expect(iesire.avertismente.some((a) => a.includes("_2"))).toBe(true);
  });

  it("plățile, pe zi, pe contul de decontare, legate de intrare prin FacturaID", () => {
    const { iesire } = saga([
      linie({ id: idTest(1) }),
      linie({ id: idTest(2), data: "2026-10-04", document: "77" }),
    ]);
    expect(iesire.plati.map((p) => p.nume)).toEqual(["P_03.10.2026.xml", "P_04.10.2026.xml"]);
    const p = iesire.plati[0]?.continut ?? "";
    expect(p).toContain("<Plati>");
    expect(p).toContain("<Suma>100.00</Suma>");
    expect(p).toContain("<Cont>542</Cont>");
    expect(p).toContain(`<FacturaID>${idTest(1)}</FacturaID>`);
    expect(p).toContain("<CodFiscal>1590082</CodFiscal>");
  });

  it("un cont de decontare din afara clasei 5 (401) nu primește plăți, ci un avertisment", () => {
    const { iesire } = saga([linie()], configurare({ contDecontare: "401" }));
    expect(iesire.plati).toEqual([]);
    expect(iesire.avertismente.some((a) => a.includes("clasa 5"))).toBe(true);
  });
});

describe("imparteSaga și DBF-ul", () => {
  it("liniile fără CUI ajung în DBF, nu în XML", () => {
    const { xml, dbf } = saga([
      linie({ id: idTest(1) }),
      linie({ id: idTest(2), cuiFurnizor: null }),
      linie({
        id: idTest(3),
        sursa: "cheltuiala",
        categorie: "parcare",
        sursaAreCui: false,
        cuiFurnizor: null,
      }),
    ]);
    expect(xml.map((i) => i.linie.id)).toEqual([idTest(1)]);
    expect(dbf.map((i) => i.linie.id)).toEqual([idTest(2), idTest(3)]);
  });

  it("firma neplătitoare de TVA: nimic în XML, totul în DBF", () => {
    const r = construiesteArticole([linie()], configurare(), { ...FIRMA, platitorTva: false });
    const { xml, dbf } = imparteSaga(r, { ...FIRMA, platitorTva: false });
    expect(xml).toEqual([]);
    expect(dbf).toHaveLength(1);
  });

  it("rândurile DBF: câte unul per articol, explicația în ASCII tăiată la 48", () => {
    const { dbf } = saga([
      linie({
        cuiFurnizor: null,
        furnizor: "Stația de alimentare cu un nume foarte lung, Șoseaua Pipera nr. 1",
      }),
    ]);
    const randuri = articoleSagaDbf(dbf);
    expect(randuri).toHaveLength(2);
    expect(randuri[0]).toEqual([
      "4521",
      "6022",
      "542",
      82.64,
      null,
      0,
      0,
      "2026-10-03",
      "Combustibil B123ABC, bon 4521, Statia de aliment",
      null,
    ]);
    expect(String(randuri[0]?.[8]).length).toBeLessThanOrEqual(48);
  });

  it("numele DBF-ului: NC_<de-la>_<până-la>.dbf", () => {
    expect(numeFisierNc("2026-10-01", "2026-10-31")).toBe("NC_01.10.2026_31.10.2026.dbf");
  });
});
