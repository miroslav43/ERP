import { describe, expect, it } from "vitest";

import {
  MAXIM_REZUMAT_PASI,
  observatiiCuPasi,
  pasiDinInstructiuni,
  rezumatPasi,
} from "./instructiuni";

describe("pasiDinInstructiuni", () => {
  it("ia doar liniile marcate ca pași, cu orice marcaj uzual", () => {
    const text = [
      "Înainte de pornire:",
      "- Verifică nivelul de ulei",
      "* Strânge șuruburile",
      "• Curăță filtrul",
      "1. Pornește la gol 5 minute",
      "2) Notează contorul",
      "",
      "Observații libere, fără marcaj.",
    ].join("\n");
    expect(pasiDinInstructiuni(text)).toEqual([
      "Verifică nivelul de ulei",
      "Strânge șuruburile",
      "Curăță filtrul",
      "Pornește la gol 5 minute",
      "Notează contorul",
    ]);
  });

  it("întoarce gol pentru null, text gol sau fără marcaje", () => {
    expect(pasiDinInstructiuni(null)).toEqual([]);
    expect(pasiDinInstructiuni("")).toEqual([]);
    expect(pasiDinInstructiuni("Doar o frază.")).toEqual([]);
  });

  it("acceptă CRLF și spații în jurul pasului", () => {
    expect(pasiDinInstructiuni("-   Primul   \r\n- Al doilea\r\n")).toEqual([
      "Primul",
      "Al doilea",
    ]);
  });

  it("un marcaj fără text nu e pas", () => {
    expect(pasiDinInstructiuni("- \n-\n- Real")).toEqual(["Real"]);
  });
});

describe("rezumatPasi", () => {
  it("marchează bifat/nebifat în ordinea pașilor", () => {
    expect(rezumatPasi(["a", "b", "c"], new Set([0, 2]))).toBe(
      "Listă de verificare: ✓ a · ✗ b · ✓ c",
    );
  });

  it("e gol fără pași", () => {
    expect(rezumatPasi([], new Set())).toBe("");
  });

  it("taie la plafon cu „…”", () => {
    const pasi = Array.from({ length: 200 }, (_, i) => `Pasul ${String(i)} cu text lung`);
    const r = rezumatPasi(pasi, new Set());
    expect(r.length).toBe(MAXIM_REZUMAT_PASI);
    expect(r.endsWith("…")).toBe(true);
  });
});

describe("observatiiCuPasi", () => {
  it("pune rezumatul înaintea textului omului", () => {
    expect(observatiiCuPasi("Listă: ✓ a", "Totul în regulă.")).toBe(
      "Listă: ✓ a\n\nTotul în regulă.",
    );
  });

  it("întoarce null când nu e nimic de spus", () => {
    expect(observatiiCuPasi("", null)).toBeNull();
    expect(observatiiCuPasi("  ", "   ")).toBeNull();
  });

  it("păstrează doar partea existentă", () => {
    expect(observatiiCuPasi("", "Doar observații.")).toBe("Doar observații.");
    expect(observatiiCuPasi("Doar listă", null)).toBe("Doar listă");
  });
});
