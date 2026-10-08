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
    expect(verificaSalariulMinim({ salariuBaza: 0, salariuMinimBrut: 0, normaOreZi: 8 })).toMatch(
      /mai mare decât zero/,
    );
    expect(
      verificaSalariulMinim({ salariuBaza: -1, salariuMinimBrut: 4050, normaOreZi: 8 }),
    ).toMatch(/mai mare decât zero/);
  });

  it("fără salariu minim configurat (0 sau null), orice sumă pozitivă trece", () => {
    expect(
      verificaSalariulMinim({ salariuBaza: 100, salariuMinimBrut: 0, normaOreZi: 8 }),
    ).toBeNull();
    expect(
      verificaSalariulMinim({ salariuBaza: 100, salariuMinimBrut: null, normaOreZi: 8 }),
    ).toBeNull();
  });

  it("sub minimul configurat, cu normă întreagă: refuz cu ambele sume în mesaj", () => {
    const mesaj = verificaSalariulMinim({
      salariuBaza: 100,
      salariuMinimBrut: 4050,
      normaOreZi: 8,
    });
    expect(mesaj).toContain("100");
    expect(mesaj).toContain("4.050");
    expect(mesaj).toMatch(/Setări/);
  });

  it("la minim sau peste, trece", () => {
    expect(
      verificaSalariulMinim({ salariuBaza: 4050, salariuMinimBrut: 4050, normaOreZi: 8 }),
    ).toBeNull();
    expect(
      verificaSalariulMinim({ salariuBaza: 9000, salariuMinimBrut: 4050, normaOreZi: 8 }),
    ).toBeNull();
  });

  it("norma parțială proporționează minimul: 4 h/zi cer jumătate", () => {
    expect(
      verificaSalariulMinim({ salariuBaza: 2025, salariuMinimBrut: 4050, normaOreZi: 4 }),
    ).toBeNull();
    expect(
      verificaSalariulMinim({ salariuBaza: 2000, salariuMinimBrut: 4050, normaOreZi: 4 }),
    ).toMatch(/2\.025/);
  });

  it("o normă peste 8 h nu ridică pragul peste minimul întreg", () => {
    expect(
      verificaSalariulMinim({ salariuBaza: 4050, salariuMinimBrut: 4050, normaOreZi: 12 }),
    ).toBeNull();
  });
});
