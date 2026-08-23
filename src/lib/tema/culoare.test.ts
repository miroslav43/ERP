// src/lib/tema/culoare.test.ts
import { describe, expect, it } from "vitest";

import { citesteHex, contrast, deschide, dinHsl, luminanta, scrieHex, spreHsl } from "./culoare";

/**
 * Ancorele nu sunt inventate aici: sunt valorile CALCULATE în
 * `docs/design/stari-de-interactiune.md`, care a auditat toată paleta pereche
 * cu pereche. Dacă aritmetica din `culoare.ts` s-ar strica, testele astea ar
 * cădea înainte ca vreun ecran să arate greșit.
 */
const PAGINA = "#faf7f0";
const SUPRAFATA = "#f2ede1";
const CHENAR = "#e3dbc9";
const CERNEALA = "#14213d";
const CERNEALA_SLABA = "#5b6478";
const PRIMAR = "#0f1e3d";
const PERICOL = "#b3261e";
const AURIU = "#c9a227";

function raport(a: string, b: string): number {
  const ca = citesteHex(a);
  const cb = citesteHex(b);
  if (ca === null || cb === null) throw new Error("hex invalid în test");
  return contrast(ca, cb);
}

describe("citesteHex", () => {
  it("acceptă și cu diez, și fără, și în litere mari", () => {
    expect(citesteHex("#0f1e3d")).toEqual({ r: 15, g: 30, b: 61 });
    expect(citesteHex("0F1E3D")).toEqual({ r: 15, g: 30, b: 61 });
    expect(citesteHex("  #0f1e3d  ")).toEqual({ r: 15, g: 30, b: 61 });
  });

  it("refuză orice altceva, fără să arunce", () => {
    for (const rau of ["", "#fff", "#0f1e3", "#0f1e3dd", "navy", "rgb(1,2,3)", "#gggggg"]) {
      expect(citesteHex(rau), rau).toBeNull();
    }
  });
});

describe("scrieHex", () => {
  it("închide bucla pe toate culorile paletei", () => {
    for (const hex of [PAGINA, SUPRAFATA, CHENAR, CERNEALA, PRIMAR, PERICOL, AURIU]) {
      const c = citesteHex(hex);
      expect(c).not.toBeNull();
      expect(scrieHex(c!)).toBe(hex);
    }
  });

  it("rotunjește și taie în afara intervalului", () => {
    expect(scrieHex({ r: -20, g: 300, b: 127.6 })).toBe("#00ff80");
  });
});

describe("luminanta", () => {
  it("dă 0 pentru negru și 1 pentru alb", () => {
    expect(luminanta({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 6);
    expect(luminanta({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 6);
  });
});

describe("contrast — verificat față de valorile auditate în specificație", () => {
  it.each([
    ["cerneală pe pagină", CERNEALA, PAGINA, 14.93],
    ["cerneală pe suprafață", CERNEALA, SUPRAFATA, 13.67],
    ["cerneală slabă pe pagină", CERNEALA_SLABA, PAGINA, 5.55],
    ["cerneală slabă pe suprafață", CERNEALA_SLABA, SUPRAFATA, 5.08],
    ["cerneală slabă pe chenar", CERNEALA_SLABA, CHENAR, 4.31],
    ["primar pe pagină", PRIMAR, PAGINA, 15.41],
    ["pericol pe pagină", PERICOL, PAGINA, 6.11],
    ["auriu pe pagină", AURIU, PAGINA, 2.26],
  ])("%s = %s pe %s → %f:1", (_nume, a, b, asteptat) => {
    expect(raport(a, b)).toBeCloseTo(asteptat, 1);
  });

  it("e simetric", () => {
    expect(raport(CERNEALA, PAGINA)).toBeCloseTo(raport(PAGINA, CERNEALA), 10);
  });

  it("confirmă interdicțiile din specificație", () => {
    // Auriul nu poate purta o stare: 2,26:1, sub orice prag.
    expect(raport(AURIU, PAGINA)).toBeLessThan(3);
    // `bg-border` nu poate sta sub un rând de tabel: textul secundar cade sub 4,5:1.
    expect(raport(CERNEALA_SLABA, CHENAR)).toBeLessThan(4.5);
    // …dar pe suprafață trece, de aceea hover-ul de rând e `bg-surface`.
    expect(raport(CERNEALA_SLABA, SUPRAFATA)).toBeGreaterThan(4.5);
  });
});

describe("spreHsl / dinHsl", () => {
  it("închid bucla pe paleta reală, cu eroare sub o treaptă de canal", () => {
    for (const hex of [PRIMAR, CERNEALA, PERICOL, AURIU, PAGINA, SUPRAFATA]) {
      const c = citesteHex(hex)!;
      const inapoi = dinHsl(spreHsl(c));
      expect(Math.abs(inapoi.r - c.r), `${hex} r`).toBeLessThan(1);
      expect(Math.abs(inapoi.g - c.g), `${hex} g`).toBeLessThan(1);
      expect(Math.abs(inapoi.b - c.b), `${hex} b`).toBeLessThan(1);
    }
  });

  it("tratează cenușiul, unde nuanța nu există", () => {
    const gri = { r: 128, g: 128, b: 128 };
    expect(spreHsl(gri).s).toBe(0);
    const inapoi = dinHsl(spreHsl(gri));
    expect(Math.abs(inapoi.r - 128)).toBeLessThan(1);
  });
});

describe("deschide", () => {
  it("păstrează nuanța și crește luminozitatea", () => {
    const primar = citesteHex(PRIMAR)!;
    const maiDeschis = deschide(primar, 0.057);
    expect(spreHsl(maiDeschis).h).toBeCloseTo(spreHsl(primar).h, 1);
    expect(spreHsl(maiDeschis).l).toBeCloseTo(spreHsl(primar).l + 0.057, 3);
    expect(luminanta(maiDeschis)).toBeGreaterThan(luminanta(primar));
  });

  it("nu iese din interval nici la pași absurzi", () => {
    const c = deschide(citesteHex(PRIMAR)!, 5);
    expect(scrieHex(c)).toBe("#ffffff");
    const d = deschide(citesteHex(PRIMAR)!, -5);
    expect(scrieHex(d)).toBe("#000000");
  });
});
