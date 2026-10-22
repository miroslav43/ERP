// src/domain/fleet/contabil/fisiere.test.ts
import { describe, expect, it } from "vitest";

import { construiesteArticole } from "./articole";
import { CSV_IMPLICIT } from "./csv";
import { ETICHETA_NEINCERCAT, iesireExport } from "./fisiere";
import type { FormatExport } from "./formate";
import { configurare, FIRMA, idTest, linie } from "./test-linii";

const PARAMETRI = {
  luna: "2026-10",
  deLa: "2026-10-01",
  panaLa: "2026-10-31",
  azi: "2026-11-02",
  configurare: configurare(),
  firma: FIRMA,
  csv: CSV_IMPLICIT,
  partenerDupaCui: true,
} as const;

const PE_CARD = idTest(9);

function rezultat() {
  return construiesteArticole(
    [
      linie({ id: idTest(1) }),
      linie({ id: idTest(2), cuiFurnizor: null, document: "55" }),
      // Alimentarea potrivită cu o tranzacție de card (F12b): doar în jurnal.
      linie({ id: PE_CARD, document: "999", cuiFurnizor: "777" }),
    ].map((l) => (l.id === PE_CARD ? { ...l, peCardDeFlota: true } : l)),
    configurare(),
    FIRMA,
  );
}

/** Tot textul (și octeții DBF ca text) din ieșirea unui format. */
function continut(format: FormatExport): { nume: string; fisiere: string[]; text: string } {
  const iesire = iesireExport(format, rezultat(), PARAMETRI);
  if (iesire.fel === "csv")
    return { nume: iesire.nume, fisiere: [iesire.nume], text: iesire.continut };
  const decoder = new TextDecoder();
  return {
    nume: iesire.nume,
    fisiere: iesire.fisiere.map((f) => f.nume),
    text: iesire.fisiere
      .filter((f) => f.nume !== "de-verificat.csv")
      .map((f) => (typeof f.continut === "string" ? f.continut : decoder.decode(f.continut)))
      .join("\n"),
  };
}

describe("iesireExport — numele și fișierele fiecărui format", () => {
  it("jurnal și articole: câte un CSV, cu numele lunii", () => {
    expect(continut("jurnal_csv").nume).toBe("jurnal-costuri-flota-2026-10.csv");
    expect(continut("articole_csv").nume).toBe("articole-contabile-flota-2026-10.csv");
  });

  it("winmentor: notele, partenerii, ce n-a intrat și pașii", () => {
    const { nume, fisiere, text } = continut("winmentor");
    expect(nume).toBe("winmentor-flota-2026-10.zip");
    expect(fisiere).toEqual([
      "NoteContabile.txt",
      "Partner.txt",
      "de-verificat.csv",
      "CITESTE-MA.txt",
    ]);
    expect(text).toContain(ETICHETA_NEINCERCAT);
  });

  it("saga: XML pentru bonul cu CUI, plata lui, DBF pentru restul, ce n-a intrat și pașii", () => {
    const { nume, fisiere, text } = continut("saga");
    expect(nume).toBe("saga-flota-2026-10.zip");
    expect(fisiere).toEqual([
      "F_1590082_4521_03.10.2026.xml",
      "P_03.10.2026.xml",
      "NC_01.10.2026_31.10.2026.dbf",
      "de-verificat.csv",
      "CITESTE-MA.txt",
    ]);
    expect(text).toContain("Dezarhivati arhiva");
  });
});

describe("alimentarea plătită cu cardul de flotă (F12b, I-T4)", () => {
  it.each(["articole_csv", "winmentor", "saga"] as const)(
    "nu apare în fișierele de import %s",
    (format) => {
      const { text } = continut(format);
      expect(text).not.toContain("999");
      expect(text).not.toContain(PE_CARD);
      expect(text).not.toContain("777");
    },
  );

  it("apare în jurnal și în de-verificat.csv, cu motivul", () => {
    expect(continut("jurnal_csv").text).toContain("cardul de flotă");
    const iesire = iesireExport("saga", rezultat(), PARAMETRI);
    if (iesire.fel !== "zip") throw new Error("se aștepta un ZIP");
    const deVerificat = iesire.fisiere.find((f) => f.nume === "de-verificat.csv");
    expect(deVerificat?.continut).toContain(PE_CARD);
    expect(deVerificat?.continut).toContain("cardul de flotă");
  });
});

describe("saga la firma neplătitoare de TVA", () => {
  it("niciun XML, toate articolele în DBF, iar de-verificat spune de ce", () => {
    const firma = { ...FIRMA, platitorTva: false };
    const iesire = iesireExport("saga", construiesteArticole([linie()], configurare(), firma), {
      ...PARAMETRI,
      firma,
    });
    if (iesire.fel !== "zip") throw new Error("se aștepta un ZIP");
    expect(iesire.fisiere.map((f) => f.nume)).toEqual([
      "NC_01.10.2026_31.10.2026.dbf",
      "de-verificat.csv",
      "CITESTE-MA.txt",
    ]);
    expect(iesire.fisiere[1]?.continut).toContain("nu e plătitoare de TVA");
  });
});
