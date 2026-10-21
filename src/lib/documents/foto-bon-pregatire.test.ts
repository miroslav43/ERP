// src/lib/documents/foto-bon-pregatire.test.ts
//
// Funcțiile pure ale pregătirii pozei de bon (F12a). Desenarea pe canvas nu se
// testează aici: happy-dom n-are canvas real.

import { describe, expect, it } from "vitest";

import { esteHeic, MESAJ_HEIC, numeJpeg, seConvertesteInJpeg } from "./foto-bon-pregatire";

describe("esteHeic", () => {
  it.each([
    [{ name: "IMG_0042.HEIC", type: "" }, true],
    [{ name: "poza.heif", type: "" }, true],
    [{ name: "bon", type: "image/heic" }, true],
    [{ name: "bon", type: "image/heif" }, true],
    [{ name: "bon.jpg", type: "image/jpeg" }, false],
    [{ name: "heic.png", type: "image/png" }, false],
  ])("%j ⇒ %s", (fisier, asteptat) => {
    expect(esteHeic(fisier)).toBe(asteptat);
  });
});

describe("numeJpeg", () => {
  it.each([
    ["IMG_0042.HEIC", "IMG_0042.jpg"],
    ["bon.png", "bon.jpg"],
    ["bon.final.webp", "bon.final.jpg"],
    ["fara-extensie", "fara-extensie.jpg"],
    [".heic", "bon.jpg"],
    ["", "bon.jpg"],
  ])("„%s” ⇒ „%s”", (nume, asteptat) => {
    expect(numeJpeg(nume)).toBe(asteptat);
  });
});

describe("seConvertesteInJpeg", () => {
  it("imaginile și HEIC-ul fără tip se convertesc; PDF-ul nu", () => {
    expect(seConvertesteInJpeg({ name: "a.png", type: "image/png" })).toBe(true);
    expect(seConvertesteInJpeg({ name: "a.HEIC", type: "" })).toBe(true);
    expect(seConvertesteInJpeg({ name: "bon.pdf", type: "application/pdf" })).toBe(false);
  });
});

it("mesajul HEIC spune ce să facă, pe iPhone și pe calculator", () => {
  expect(MESAJ_HEIC).toMatch(/iPhone/u);
  expect(MESAJ_HEIC).toMatch(/JPEG\.$/u);
});
