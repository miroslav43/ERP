import { describe, expect, it } from "vitest";

import { verificaSalariulMinim } from "./salariu-minim";

/**
 * Regula pe care contractul n-o verifica deloc: QA pe 8 oct 2026 a încheiat
 * un contract de 100 lei, un act adițional de 0 lei și o normă de 12 h/zi
 * fără niciun avertisment (HR-021, HR-030). Salariul minim al firmei stă în
 * `payroll_settings.salariu_minim_brut` (0 = neconfigurat, ⚠️ de confirmat).
 */
describe("verificaSalariulMinim", () => {
  it("un salariu de zero sau negativ e refuzat, indiferent de setări", () => {
    expect(
      verificaSalariulMinim({
        salariuBaza: 0,
        salariuMinimBrut: 0,
        normaOreZi: 8,
        normaOreSaptamana: 40,
      }),
    ).toMatch(/mai mare decât zero/);
    expect(
      verificaSalariulMinim({
        salariuBaza: -1,
        salariuMinimBrut: 4050,
        normaOreZi: 8,
        normaOreSaptamana: 40,
      }),
    ).toMatch(/mai mare decât zero/);
  });

  it("fără salariu minim configurat (0 sau null), orice sumă pozitivă trece", () => {
    expect(
      verificaSalariulMinim({
        salariuBaza: 100,
        salariuMinimBrut: 0,
        normaOreZi: 8,
        normaOreSaptamana: 40,
      }),
    ).toBeNull();
    expect(
      verificaSalariulMinim({
        salariuBaza: 100,
        salariuMinimBrut: null,
        normaOreZi: 8,
        normaOreSaptamana: 40,
      }),
    ).toBeNull();
  });

  it("sub minimul configurat, cu normă întreagă: refuz cu ambele sume în mesaj", () => {
    const mesaj = verificaSalariulMinim({
      salariuBaza: 100,
      salariuMinimBrut: 4050,
      normaOreZi: 8,
      normaOreSaptamana: 40,
    });
    expect(mesaj).toContain("100");
    expect(mesaj).toContain("4.050");
    expect(mesaj).toMatch(/Setări/);
  });

  it("la minim sau peste, trece", () => {
    expect(
      verificaSalariulMinim({
        salariuBaza: 4050,
        salariuMinimBrut: 4050,
        normaOreZi: 8,
        normaOreSaptamana: 40,
      }),
    ).toBeNull();
    expect(
      verificaSalariulMinim({
        salariuBaza: 9000,
        salariuMinimBrut: 4050,
        normaOreZi: 8,
        normaOreSaptamana: 40,
      }),
    ).toBeNull();
  });

  it("norma parțială proporționează minimul: 4 h/zi, 20 h/săpt. cer jumătate", () => {
    expect(
      verificaSalariulMinim({
        salariuBaza: 2025,
        salariuMinimBrut: 4050,
        normaOreZi: 4,
        normaOreSaptamana: 20,
      }),
    ).toBeNull();
    expect(
      verificaSalariulMinim({
        salariuBaza: 2000,
        salariuMinimBrut: 4050,
        normaOreZi: 4,
        normaOreSaptamana: 20,
      }),
    ).toMatch(/2\.025/);
  });

  /*
   * Timpul parțial lucrat în zile întregi, dar în mai puțin de cinci zile pe
   * săptămână (art. 103–105 Codul muncii), admis de schemă din 12 oct 2026.
   * Pragul se proporționează cu norma SĂPTĂMÂNALĂ: 24 din 40 de ore. Calculat
   * din norma zilnică (8 din 8), cerea salariul minim întreg și refuza pe
   * `salariu_baza` contractul pe care schema tocmai îl acceptase.
   */
  it("8 h/zi în trei zile (24 h/săpt.) cer 24/40 din minim, nu minimul întreg", () => {
    expect(
      verificaSalariulMinim({
        salariuBaza: 2430,
        salariuMinimBrut: 4050,
        normaOreZi: 8,
        normaOreSaptamana: 24,
      }),
    ).toBeNull();
    const mesaj = verificaSalariulMinim({
      salariuBaza: 2400,
      salariuMinimBrut: 4050,
      normaOreZi: 8,
      normaOreSaptamana: 24,
    });
    expect(mesaj).toContain("2.430");
    expect(mesaj).toMatch(/24 de ore pe săptămână/);
  });

  it("norma zilnică falsă de odinioară (3,2 h/zi, 16 h/săpt.) dă același prag", () => {
    expect(
      verificaSalariulMinim({
        salariuBaza: 1620,
        salariuMinimBrut: 4050,
        normaOreZi: 3.2,
        normaOreSaptamana: 16,
      }),
    ).toBeNull();
    expect(
      verificaSalariulMinim({
        salariuBaza: 1619,
        salariuMinimBrut: 4050,
        normaOreZi: 3.2,
        normaOreSaptamana: 16,
      }),
    ).toMatch(/1\.620/);
  });

  it("fără normă săptămânală validă, pragul cade pe norma zilnică", () => {
    expect(
      verificaSalariulMinim({
        salariuBaza: 2000,
        salariuMinimBrut: 4050,
        normaOreZi: 4,
        normaOreSaptamana: Number.NaN,
      }),
    ).toMatch(/2\.025/);
  });

  it("o normă peste cea întreagă nu ridică pragul peste minimul întreg", () => {
    expect(
      verificaSalariulMinim({
        salariuBaza: 4050,
        salariuMinimBrut: 4050,
        normaOreZi: 12,
        normaOreSaptamana: 48,
      }),
    ).toBeNull();
  });
});
