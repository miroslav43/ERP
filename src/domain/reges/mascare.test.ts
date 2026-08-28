// src/domain/reges/mascare.test.ts
import { describe, expect, it } from "vitest";

import { mascheazaText, ultimele4 } from "./mascare";

describe("mascheazaText", () => {
  it("ascunde CNP-ul dintr-un mesaj de eroare venit de la REGES", () => {
    expect(mascheazaText("CNP-ul 1900101070016 este deja înregistrat.")).toBe(
      "CNP-ul *********0016 este deja înregistrat.",
    );
  });

  it("ascunde IBAN-ul", () => {
    expect(mascheazaText("Cont RO49AAAA1B31007593840000 respins")).toBe(
      "Cont RO49****0000 respins",
    );
  });

  it("NU maschează codurile de nomenclator, oricât ar semăna cu o serie de act", () => {
    // Un tipar pentru „serie + număr de act" înghite „COR 251401" și lasă
    // operatorul fără nicio idee ce a greșit. Diagnosticabilitatea bate aici.
    expect(mascheazaText("Actul XZ 123456 a expirat")).toBe("Actul XZ 123456 a expirat");
  });

  it("maschează mai multe apariții în același mesaj", () => {
    const rezultat = mascheazaText("1900101070016 și 2900101070017 sunt duplicate");
    expect(rezultat).toBe("*********0016 și *********0017 sunt duplicate");
  });

  it("lasă textul fără date personale neatins", () => {
    expect(mascheazaText("Codul COR 251401 nu există în versiunea 2024.")).toBe(
      "Codul COR 251401 nu există în versiunea 2024.",
    );
  });

  it("plafonează mesajele uriașe", () => {
    const lung = "x".repeat(5000);
    const rezultat = mascheazaText(lung);
    expect(rezultat).not.toBeNull();
    expect((rezultat as string).length).toBe(2001);
    expect((rezultat as string).endsWith("…")).toBe(true);
  });

  it("întoarce null pentru absență, nu șir gol", () => {
    expect(mascheazaText(null)).toBeNull();
    expect(mascheazaText(undefined)).toBeNull();
  });
});

describe("ultimele4", () => {
  it("ia ultimele patru cifre", () => {
    expect(ultimele4("1900101070016")).toBe("0016");
  });

  it("ignoră separatorii", () => {
    expect(ultimele4("190 010 107 0016")).toBe("0016");
  });

  it("întoarce null când nu are de unde", () => {
    expect(ultimele4("12")).toBeNull();
    expect(ultimele4(null)).toBeNull();
  });
});
