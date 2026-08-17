// src/domain/employee/iban.test.ts
import { describe, expect, it } from "vitest";

import { cifreControlIban, formateazaIban, normalizeazaIban, valideazaIban } from "./iban";

const IBAN_TEST = "RO49AAAA1B31007593840000";

function construiesteIban(bban: string): string {
  return `RO${cifreControlIban(bban)}${bban}`;
}

describe("valideazaIban", () => {
  it("acceptă un IBAN românesc corect și separă banca de cont", () => {
    const rezultat = valideazaIban(IBAN_TEST);
    expect(rezultat.valid).toBe(true);
    if (!rezultat.valid) return;
    expect(rezultat.codBanca).toBe("AAAA");
    expect(rezultat.cont).toBe("1B31007593840000");
  });

  it("acceptă IBAN-uri construite algoritmic", () => {
    const iban = construiesteIban("BTRL0123456789012345".slice(0, 20));
    expect(valideazaIban(iban).valid).toBe(true);
  });

  it("calculează aceleași cifre de control ca standardul", () => {
    expect(cifreControlIban("AAAA1B31007593840000")).toBe("49");
  });

  it("normalizează spațiile, liniuțele și literele mici", () => {
    expect(normalizeazaIban(" ro49 aaaa-1b31 0075 9384 0000 ")).toBe(IBAN_TEST);
    expect(valideazaIban("ro49 aaaa 1b31 0075 9384 0000").valid).toBe(true);
  });

  it("respinge valoarea goală", () => {
    expect(valideazaIban("  ")).toMatchObject({ valid: false, motiv: "lipsa" });
  });

  it("respinge caracterele nepermise", () => {
    expect(valideazaIban("RO49AAAA1B3100759384000*")).toMatchObject({
      valid: false,
      motiv: "caractere",
    });
  });

  it("respinge conturile din altă țară", () => {
    expect(valideazaIban("DE89370400440532013000")).toMatchObject({ valid: false, motiv: "tara" });
  });

  it("respinge lungimea greșită", () => {
    expect(valideazaIban(`${IBAN_TEST}12`)).toMatchObject({ valid: false, motiv: "lungime" });
    expect(valideazaIban(IBAN_TEST.slice(0, 22))).toMatchObject({ valid: false, motiv: "lungime" });
  });

  it("respinge structura greșită (cifre în locul codului de bancă)", () => {
    expect(valideazaIban("RO4912341B31007593840000")).toMatchObject({
      valid: false,
      motiv: "format",
    });
  });

  it("respinge cifrele de control greșite", () => {
    expect(valideazaIban("RO50AAAA1B31007593840000")).toMatchObject({
      valid: false,
      motiv: "cifra_control",
    });
  });
});

describe("formateazaIban", () => {
  it("grupează câte patru caractere", () => {
    expect(formateazaIban(IBAN_TEST)).toBe("RO49 AAAA 1B31 0075 9384 0000");
  });
});
