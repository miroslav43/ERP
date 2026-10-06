import { describe, expect, it } from "vitest";

import { SECUNDE_MAXIME, dateCitire, procentDerulat } from "./citire";

describe("procentDerulat", () => {
  it("rotunjește la zece", () => {
    expect(procentDerulat(0, 800, 2000)).toBe(40);
    expect(procentDerulat(470, 800, 2000)).toBe(60);
  });

  it("o pagină mai scurtă decât ecranul e citită integral", () => {
    expect(procentDerulat(0, 900, 600)).toBe(100);
  });

  it("documentul fără înălțime nu împarte la zero", () => {
    expect(procentDerulat(0, 800, 0)).toBe(100);
  });
});

describe("dateCitire", () => {
  const ordine = ["sus", "module", "preturi", "intrebari"];

  it("ultima e secțiunea cea mai de jos văzută, nu ultima în timp", () => {
    // A sărit la prețuri din antet, apoi a urcat înapoi la module.
    const date = dateCitire(
      { msActive: 42_400, procentMaxim: 70, sectiuni: ["sus", "preturi", "module"] },
      ordine,
    );
    expect(date).toEqual({
      secunde: 42,
      derulat: 70,
      sectiuni: "sus,preturi,module",
      ultima: "preturi",
    });
  });

  it("plafonează fila uitată deschisă", () => {
    const date = dateCitire({ msActive: 9 * 3600_000, procentMaxim: 10, sectiuni: [] }, ordine);
    expect(date.secunde).toBe(SECUNDE_MAXIME);
  });

  it("pe o pagină fără secțiuni nu trimite chei goale", () => {
    const date = dateCitire({ msActive: 5000, procentMaxim: 100, sectiuni: [] }, []);
    expect(date).toEqual({ secunde: 5, derulat: 100 });
  });

  it("taie lista la limita de 500 de caractere a lui Umami", () => {
    const multe = Array.from({ length: 80 }, (_, i) => `sectiunea-${i}`);
    const date = dateCitire({ msActive: 0, procentMaxim: 0, sectiuni: multe }, multe);
    expect(String(date.sectiuni).length).toBeLessThanOrEqual(500);
  });
});
