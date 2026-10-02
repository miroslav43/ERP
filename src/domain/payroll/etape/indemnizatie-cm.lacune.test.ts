// src/domain/payroll/etape/indemnizatie-cm.lacune.test.ts
//
// Lacuna confirmată de audit: împărțirea zilelor lucrătoare între firmă și
// FNUASS pe un certificat ale cărui date sunt cunoscute.

import { describe, expect, it } from "vitest";

import {
  calculeazaIndemnizatieCm,
  type CertificatMedical,
  type CodIndemnizatie,
  type IntrareIndemnizatieCm,
} from "./indemnizatie-cm";

const COD_01: CodIndemnizatie = {
  cod: "01",
  procent: 75,
  zileAngajator: 5,
  platitor: "mixt",
  luniBazaCalcul: 6,
  plafonSalariiMinime: null,
};

/** Luni 03.08.2026 → miercuri 12.08.2026: 10 zile calendaristice, 8 lucrătoare. */
const CERTIFICAT: CertificatMedical = {
  serie: "AA",
  numar: "1001",
  dataInceput: "2026-08-03",
  dataSfarsit: "2026-08-12",
  zileCalendaristice: 10,
  zileLucratoare: 8,
  esteContinuare: false,
  cod: COD_01,
};

/** Șase luni a câte 6300 de lei pe 21 de zile: bază 300, la 75% → 225 lei/zi. */
const INTRARE: IntrareIndemnizatieCm = {
  certificate: [CERTIFICAT],
  istoric: Array.from({ length: 6 }, (_, i) => ({
    an: 2026,
    luna: 7 - i,
    venitBrut: 6300,
    zileLucrate: 21,
  })),
  salariuMinimBrut: 4050,
  zileLucratoareLuna: 21,
  zileAngajatorDejaConsumate: 0,
};

describe("calculeazaIndemnizatieCm — primele 5 zile calendaristice ale episodului", () => {
  it("totalul certificatului nu depinde de împărțire: 8 zile × 225 lei", () => {
    const r = calculeazaIndemnizatieCm(INTRARE);
    expect(r.bazaZilnica).toBe(300);
    expect(r.total).toBe(1800);
    const linie = r.peCertificat[0];
    expect((linie?.zileAngajator ?? 0) + (linie?.zileFnuass ?? 0)).toBe(8);
  });

  // Pasul 4 din antet: „primele `zileAngajator` zile CALENDARISTICE ale
  // EPISODULUI sunt suportate de firmă”. 3–7 august sunt luni–vineri, deci cinci
  // zile lucrătoare la firmă; 8–12 august (sâmbătă–miercuri) au trei zile
  // lucrătoare, la FNUASS. Aproximarea (a) din antet, marcată ⚠, împarte
  // proporțional și dă 4/4 — 225 de lei mutați de pe firmă pe FNUASS, care se
  // văd la recuperarea din D112. Certificatul își poartă datele, deci împărțirea
  // pe calendar e calculabilă.
  it.fails("DEFECT: zilele lucrătoare se împart după calendarul certificatului, 5/3", () => {
    const r = calculeazaIndemnizatieCm(INTRARE);
    expect(r.peCertificat[0]?.zileAngajator).toBe(5);
    expect(r.peCertificat[0]?.zileFnuass).toBe(3);
    expect(r.totalAngajator).toBe(1125);
    expect(r.totalFnuass).toBe(675);
  });
});
