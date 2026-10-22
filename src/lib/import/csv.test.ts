import { describe, expect, it } from "vitest";

import { normalizeazaText } from "@/domain/fleet/carduri/text";

import { citesteCsv, decodeazaText, detecteazaDelimitator } from "./csv";
import { LIMITA_RANDURI } from "./excel";

const octeti = (...b: number[]) => new Uint8Array(b);

describe("decodeazaText", () => {
  it("paza imaginii Node: `windows-1250` există (ICU complet)", () => {
    expect(() => new TextDecoder("windows-1250")).not.toThrow();
  });

  it("BOM UTF-8 se scoate", () => {
    expect(decodeazaText(octeti(0xef, 0xbb, 0xbf, 0x41, 0x3b, 0x42))).toBe("A;B");
  });

  it("BOM UTF-16LE (exportul „Text Unicode” din Excel)", () => {
    expect(decodeazaText(octeti(0xff, 0xfe, 0x41, 0x00, 0x09, 0x00, 0x42, 0x00))).toBe("A\tB");
  });

  it("Windows-1250: 0xBA 0xFE ies „ş ţ” cu sedilă, iar normalizarea le face „ș ț”", () => {
    // „Staţia Bucureşti” în ANSI românesc: nu e UTF-8 valid ⇒ cade pe 1250.
    const ansi = octeti(
      0x53,
      0x74,
      0x61,
      0xfe,
      0x69,
      0x61,
      0x20,
      0x42,
      0x75,
      0x63,
      0x75,
      0x72,
      0x65,
      0xba,
      0x74,
      0x69,
    );
    const text = decodeazaText(ansi);
    expect(text).toBe("Staţia Bucureşti");
    expect(normalizeazaText(text)).toBe("Stația București");
  });

  it("UTF-8 valid rămâne UTF-8", () => {
    expect(decodeazaText(new TextEncoder().encode("Stația"))).toBe("Stația");
  });
});

describe("detecteazaDelimitator", () => {
  it("punctul și virgula românesc, cu virgulă zecimală", () => {
    expect(detecteazaDelimitator("Card;Data;Litri\n1234;05.10.2026;52,30\n")).toBe(";");
  });
  it("virgula englezească", () => {
    expect(detecteazaDelimitator("Card,Date,Qty\n1234,2026-10-05,52.3\n")).toBe(",");
  });
  it("tab", () => {
    expect(detecteazaDelimitator("Card\tData\tLitri\n1234\t05.10.2026\t52,30\n")).toBe("\t");
  });
  it("virgula din ghilimele nu se numără", () => {
    expect(detecteazaDelimitator('Statie;Valoare\n"OMV, Pipera";12,50\n"MOL, Iasi";9,10\n')).toBe(
      ";",
    );
  });
});

describe("citesteCsv", () => {
  it('ghilimele cu `;`, `""` și linie nouă în câmp; CRLF', () => {
    const text =
      'Statie;Produs\r\n"OMV; Pipera";"Motorina ""Plus"""\r\n"Linia 1\nLinia 2";AdBlue\r\n';
    const r = citesteCsv(text, { delimitator: ";" });
    if (!r.ok) throw new Error(r.mesaj);
    expect(r.foaie.antet).toEqual(["Statie", "Produs"]);
    expect(r.foaie.randuri.map((x) => [...x.celule.values()])).toEqual([
      ["OMV; Pipera", 'Motorina "Plus"'],
      ["Linia 1\nLinia 2", "AdBlue"],
    ]);
  });

  it("rândurile goale se sar; antetul duplicat se sufixează", () => {
    const r = citesteCsv("Data;Data;Valoare\n\n05.10.2026;06.10.2026;1\n;;\n", {
      delimitator: ";",
    });
    if (!r.ok) throw new Error(r.mesaj);
    expect(r.foaie.antet).toEqual(["Data", "Data (2)", "Valoare"]);
    expect(r.foaie.randuri).toHaveLength(1);
  });

  it("antetul pe rândul 3 (logo și numele firmei deasupra)", () => {
    const r = citesteCsv("Extras OMV\nFirma SRL\nCard;Valoare\n1234;10\n", {
      delimitator: ";",
      randAntet: 3,
    });
    if (!r.ok) throw new Error(r.mesaj);
    expect(r.foaie.antet).toEqual(["Card", "Valoare"]);
    expect(r.foaie.randuri[0]?.celule.get("Card")).toBe("1234");
    expect(r.foaie.randuri[0]?.rand).toBe(4);
  });

  it(`${String(LIMITA_RANDURI + 1)} de rânduri → \`trunchiat\`, cu exact ${String(LIMITA_RANDURI)} citite`, () => {
    const linii = [
      "Card;Valoare",
      ...Array.from({ length: LIMITA_RANDURI + 1 }, (_, i) => `1234;${String(i)}`),
    ];
    const r = citesteCsv(linii.join("\n"), { delimitator: ";" });
    if (!r.ok) throw new Error(r.mesaj);
    expect(r.foaie.trunchiat).toBe(true);
    expect(r.foaie.randuri).toHaveLength(LIMITA_RANDURI);
  });

  it("fără rânduri de date: refuz cu mesaj", () => {
    expect(citesteCsv("Card;Valoare\n", { delimitator: ";" })).toMatchObject({ ok: false });
  });
});
