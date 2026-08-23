// src/lib/tema/paleta.test.ts
import { describe, expect, it } from "vitest";

import { citesteHex, contrast } from "./culoare";
import { PRAG_CONTRAST, paletaDinPrimara, variabileTema } from "./paleta";

const CREM = citesteHex("#faf7f0")!;

function contrastCuCrem(hex: string): number {
  return contrast(citesteHex(hex)!, CREM);
}

describe("paletaDinPrimara — poarta de contrast", () => {
  it("acceptă navy-ul implicit al platformei", () => {
    const r = paletaDinPrimara("#0f1e3d");
    expect(r.ok).toBe(true);
  });

  it.each(["#1a4d3a", "#4a1d3f", "#5c2f10", "#123456", "#000000"])(
    "acceptă culoarea închisă %s",
    (hex) => {
      expect(paletaDinPrimara(hex).ok).toBe(true);
    },
  );

  it.each(["#ffffff", "#f5d78e", "#7fd4a0", "#c9a227", "#b7791f"])(
    "refuză culoarea prea deschisă %s, cu motiv scris pentru om",
    (hex) => {
      const r = paletaDinPrimara(hex);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.motiv).toContain("prea deschisă");
        expect(r.motiv).toMatch(/\d,\d\d:1/); // raportul apare în mesaj, cu virgulă zecimală
        expect(r.motiv.endsWith(".")).toBe(true);
      }
    },
  );

  it("refuză ce nu e hexazecimal, fără să arunce", () => {
    for (const rau of ["", "navy", "#fff", "rgb(0,0,0)", "0f1e3"]) {
      const r = paletaDinPrimara(rau);
      expect(r.ok, rau).toBe(false);
      if (!r.ok) expect(r.motiv).toContain("hexazecimal");
    }
  });
});

describe("paletaDinPrimara — derivarea stărilor", () => {
  it("hover și apăsat sunt mai deschise decât primarul, în ordine", () => {
    const r = paletaDinPrimara("#0f1e3d");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const { primary, primaryHover, primaryActive } = r.paleta;
    // Mai deschis = contrast MAI MIC față de cremul de deasupra.
    expect(contrastCuCrem(primaryHover)).toBeLessThan(contrastCuCrem(primary));
    expect(contrastCuCrem(primaryActive)).toBeLessThan(contrastCuCrem(primaryHover));
  });

  it("primarul se întoarce normalizat, nu ca text brut", () => {
    const r = paletaDinPrimara("0F1E3D");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.paleta.primary).toBe("#0f1e3d");
  });

  /**
   * Regula pe care se sprijină toată tema: dacă starea apăsată ar coborî sub
   * prag, pasul se scurtează. Mai bine un hover discret decât un buton pe care
   * nu se mai citește textul.
   */
  it.each(["#0f1e3d", "#1a4d3a", "#4a1d3f", "#5c2f10", "#123456", "#3d1414", "#2b2b2b"])(
    "toate cele trei stări derivate din %s rămân peste pragul de contrast",
    (hex) => {
      const r = paletaDinPrimara(hex);
      expect(r.ok, hex).toBe(true);
      if (!r.ok) return;
      for (const [nume, culoare] of Object.entries(r.paleta)) {
        expect(contrastCuCrem(culoare), `${hex} → ${nume} (${culoare})`).toBeGreaterThanOrEqual(
          PRAG_CONTRAST,
        );
      }
    },
  );

  it("un primar aproape de prag nu produce un apăsat sub prag", () => {
    // Ales ca să fie valid, dar fără marjă de deschidere.
    const candidati = ["#6b6b6b", "#707070", "#757575"];
    for (const hex of candidati) {
      const r = paletaDinPrimara(hex);
      if (!r.ok) continue;
      for (const culoare of Object.values(r.paleta)) {
        expect(contrastCuCrem(culoare), `${hex} → ${culoare}`).toBeGreaterThanOrEqual(
          PRAG_CONTRAST,
        );
      }
    }
  });
});

describe("variabileTema", () => {
  it("întoarce obiect gol când organizația n-a ales nimic", () => {
    expect(variabileTema(null)).toEqual({});
  });

  it("întoarce obiect gol pentru o culoare refuzată — nu o aplică pe jumătate", () => {
    expect(variabileTema("#ffffff")).toEqual({});
    expect(variabileTema("nu-e-culoare")).toEqual({});
  });

  it("dă exact cele trei variabile pe care le citește globals.css", () => {
    const v = variabileTema("#1a4d3a");
    expect(Object.keys(v).sort()).toEqual([
      "--color-primary",
      "--color-primary-active",
      "--color-primary-hover",
    ]);
    for (const valoare of Object.values(v)) {
      expect(valoare).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
