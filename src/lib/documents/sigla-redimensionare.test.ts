import { describe, expect, it } from "vitest";

import { SIGLA_OCTETI_MAXIM } from "@/schemas/document-template";

import {
  LATURA_MAXIMA,
  dimensiuniTinta,
  formatIesire,
  numeCuExtensie,
  seUrcaNeschimbat,
} from "./sigla-redimensionare";

describe("dimensiuniTinta", () => {
  it("micșorează după latura cea mai lungă, cu proporția păstrată", () => {
    expect(dimensiuniTinta({ latime: 4000, inaltime: 1000 })).toEqual({
      latime: LATURA_MAXIMA,
      inaltime: 150,
    });
    expect(dimensiuniTinta({ latime: 1000, inaltime: 3000 })).toEqual({
      latime: 200,
      inaltime: LATURA_MAXIMA,
    });
  });

  it("nu mărește o imagine deja în plafon", () => {
    expect(dimensiuniTinta({ latime: 300, inaltime: 120 })).toEqual({ latime: 300, inaltime: 120 });
  });

  it("nu coboară sub un pixel la o siglă extrem de lată", () => {
    expect(dimensiuniTinta({ latime: 100_000, inaltime: 10 }).inaltime).toBe(1);
  });
});

describe("seUrcaNeschimbat", () => {
  const mica = { latime: 500, inaltime: 200 };

  it("lasă în pace un PNG mic, deja la mărimea de tipar", () => {
    expect(seUrcaNeschimbat("image/png", 40_000, mica)).toBe(true);
  });

  it("reencodează JPEG-ul oricât de mic — pdf-lib nu încorporează JPEG progresiv", () => {
    expect(seUrcaNeschimbat("image/jpeg", 40_000, mica)).toBe(false);
  });

  it("reencodează un PNG prea mare în pixeli sau în octeți", () => {
    expect(seUrcaNeschimbat("image/png", 40_000, { latime: 3000, inaltime: 800 })).toBe(false);
    expect(seUrcaNeschimbat("image/png", SIGLA_OCTETI_MAXIM + 1, mica)).toBe(false);
  });

  it("convertește formatele pe care pdf-lib nu le cunoaște", () => {
    expect(seUrcaNeschimbat("image/webp", 1_000, mica)).toBe(false);
    expect(seUrcaNeschimbat("image/svg+xml", 1_000, mica)).toBe(false);
  });
});

describe("formatIesire", () => {
  it("păstrează JPEG-ul și duce restul în PNG, ca să nu piardă transparența", () => {
    expect(formatIesire("image/jpeg")).toBe("image/jpeg");
    expect(formatIesire("image/png")).toBe("image/png");
    expect(formatIesire("image/svg+xml")).toBe("image/png");
    expect(formatIesire("image/webp")).toBe("image/png");
  });
});

describe("numeCuExtensie", () => {
  it("schimbă extensia după formatul real", () => {
    expect(numeCuExtensie("sigla.svg", "image/png")).toBe("sigla.png");
    expect(numeCuExtensie("Logo firmă.final.jpeg", "image/jpeg")).toBe("Logo firmă.final.jpg");
    expect(numeCuExtensie("fara-extensie", "image/png")).toBe("fara-extensie.png");
    expect(numeCuExtensie(".png", "image/png")).toBe("sigla.png");
  });
});

describe("dimensiuniTinta pentru SVG", () => {
  it("desenează vectorul la plafon, nu la cutia implicită de 300 × 150 a browserului", () => {
    expect(dimensiuniTinta({ latime: 300, inaltime: 75 }, LATURA_MAXIMA, true)).toEqual({
      latime: LATURA_MAXIMA,
      inaltime: 150,
    });
  });
});
