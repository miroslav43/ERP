// src/domain/payroll/etape/diurna-plafoane.lacune.test.ts
//
// Lacuna confirmată de audit: valoarea lui `fractiePlafonLunar` care chiar
// ajunge în producție. Salarizarea trimite `per_diem_valori_legale.
// plafon_salarii_baza_luna` = 3, un NUMĂR de salarii (src/lib/queries/payroll.ts
// → src/app/(app)/salarizare/actions.ts), iar testele existente folosesc doar
// fracții (0,33, 0,5). Valoare de confirmat: NOTES.md §3 Diurne — „plafonul
// lunar al diurnei are două citiri în cod”. Testul fixează comportamentul ACTUAL.

import { describe, expect, it } from "vitest";

import { calculeazaDiurna, type IntrareDiurna } from "./diurna-plafoane";

/** 20 de zile externe a câte 437,5 lei — exact pe plafonul zilnic 175 × 2,5. */
const ZILE = Array.from({ length: 20 }, (_, i) => ({
  data: `2026-03-${String(i + 1).padStart(2, "0")}`,
  sumaAcordata: 437.5,
  baremLegalZi: 175,
  deplasareId: "D1",
}));

function intrare(fractiePlafonLunar: number): IntrareDiurna {
  return {
    zile: ZILE,
    multiplicatorPlafonZilnic: 2.5,
    fractiePlafonLunar,
    salariuBazaBrut: 5000,
  };
}

describe("calculeazaDiurna — plafonul lunar cu valoarea din producție", () => {
  it("cu 3 (numărul de salarii trimis azi), plafonul e 3 salarii întregi și nimic nu se impozitează", () => {
    const r = calculeazaDiurna(intrare(3));
    expect(r.totalAcordat).toBe(8750);
    expect(r.plafonLunar).toBe(15000);
    expect(r.neimpozabila).toBe(8750);
    expect(r.impozabila).toBe(0);
    expect(r.probleme.map((p) => p.cod)).not.toContain("SAL_DIURNA_PESTE_PLAFON_LUNAR");
  });

  it("cu 0,33 (fracția din tipul funcției), același lună trece de plafon", () => {
    const r = calculeazaDiurna(intrare(0.33));
    expect(r.plafonLunar).toBe(1650);
    expect(r.neimpozabila).toBe(1650);
    expect(r.impozabila).toBe(7100);
    expect(r.probleme.map((p) => p.cod)).toContain("SAL_DIURNA_PESTE_PLAFON_LUNAR");
  });

  // A treia citire, a ghidului public: 3 salarii ÷ 21 zile lucrătoare × 20 de
  // zile de delegare = 14285,71 — și aici nimic impozabil, dar plafonul ar fi
  // altul pe o delegare scurtă. Funcția nu primește zilele lucrătoare ale lunii,
  // deci citirea asta nu se poate exprima fără schimbarea intrării.
});
