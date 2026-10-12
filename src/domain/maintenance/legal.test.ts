// src/domain/maintenance/legal.test.ts
//
// Categoriile de verificări legale (M7): lista e închisă, codurile trec de
// CHECK-ul din bază, fiecare categorie își spune temeiul și dacă a fost
// verificată pe textul consolidat; precompletarea planului și avertismentul
// „documentul trece de maximul legal” (cazul 40: documentul are prioritate —
// se avertizează doar când e MAI LUNG decât maximul).

import { describe, expect, it } from "vitest";

import {
  adunaLuni,
  CATEGORII_LEGALE,
  CODURI_CATEGORII_LEGALE,
  categorieLegala,
  depasesteMaximulLegal,
  preCompletarePlan,
  temeiPentruPlan,
} from "./legal";

describe("CATEGORII_LEGALE", () => {
  it("are toate categoriile cerute de plan, fiecare o singură dată", () => {
    for (const cod of [
      "vtp_masini_ridicat",
      "vtp_ascensor",
      "revizie_ascensor",
      "vtp_cazan",
      "vtp_recipient",
      "verificare_gaze",
      "revizie_gaze",
      "pram",
      "paratrasnet",
      "iluminat_siguranta",
      "usi_rezistente_foc",
      "cos_fum",
      "f_gaz",
      "metrologie",
      "generator_ups",
      "verificare_montare",
    ]) {
      expect(CODURI_CATEGORII_LEGALE).toContain(cod);
    }
    expect(new Set(CODURI_CATEGORII_LEGALE).size).toBe(CODURI_CATEGORII_LEGALE.length);
    expect(CATEGORII_LEGALE.map((c) => c.cod)).toEqual([...CODURI_CATEGORII_LEGALE]);
  });

  it("fiecare cod trece de `maintenance_plans_categorie_legala_ck` (0183)", () => {
    for (const cod of CODURI_CATEGORII_LEGALE) {
      expect(cod).toMatch(/^[a-z][a-z0-9_]{1,59}$/u);
    }
  });

  it("fiecare categorie are temei, iar maximul nu e mai mic decât sugestia", () => {
    for (const c of CATEGORII_LEGALE) {
      expect(c.temei.length).toBeGreaterThan(5);
      expect(c.eticheta.length).toBeGreaterThan(3);
      if (c.maximLuni !== null && c.periodicitateZile !== null) {
        expect(c.periodicitateZile).toBeLessThanOrEqual(c.maximLuni * 31);
      }
    }
  });

  it("temeiurile verificate pe text spun și sursa; restul rămân ⚠", () => {
    const verificate = CATEGORII_LEGALE.filter((c) => c.verificat);
    expect(verificate.length).toBeGreaterThan(0);
    for (const c of verificate) expect(c.sursa).toMatch(/^https:\/\/legislatie\.just\.ro\//u);
    expect(CATEGORII_LEGALE.some((c) => !c.verificat)).toBe(true);
  });

  it("valorile verificate pe textul consolidat (12 oct 2026)", () => {
    expect(categorieLegala("vtp_masini_ridicat")).toMatchObject({
      maximLuni: 24,
      verificat: true,
    });
    expect(categorieLegala("vtp_ascensor")).toMatchObject({ maximLuni: 24, verificat: true });
    expect(categorieLegala("vtp_cazan")).toMatchObject({ maximLuni: 48, verificat: true });
    expect(categorieLegala("vtp_recipient")).toMatchObject({ maximLuni: 48, verificat: true });
    expect(categorieLegala("verificare_gaze")).toMatchObject({ maximLuni: 24, verificat: true });
    expect(categorieLegala("revizie_gaze")).toMatchObject({ maximLuni: 120, verificat: true });
    expect(categorieLegala("cos_fum")).toMatchObject({ maximLuni: 12, verificat: true });
    // HG 1146/2006 art. 5 alin. (1): legată de eveniment (montare), nu de calendar.
    expect(categorieLegala("verificare_montare")).toMatchObject({
      periodicitateZile: null,
      maximLuni: null,
    });
  });
});

describe("categorieLegala", () => {
  it("cod necunoscut sau null ⇒ null", () => {
    expect(categorieLegala("inexistent")).toBeNull();
    expect(categorieLegala(null)).toBeNull();
  });
});

describe("temeiPentruPlan", () => {
  it("temeiul neverificat poartă ⚠, cel verificat nu; ambele încap în 300 de caractere", () => {
    for (const c of CATEGORII_LEGALE) {
      const t = temeiPentruPlan(c);
      expect(t.length).toBeLessThanOrEqual(300);
      expect(t.includes("⚠")).toBe(!c.verificat);
    }
  });
});

describe("preCompletarePlan", () => {
  it("pune tipul `verificare_legala`, periodicitatea sugerată și temeiul", () => {
    const p = preCompletarePlan("verificare_gaze");
    expect(p).toMatchObject({ tip: "verificare_legala", periodicitate_zile: "730" });
    expect(p?.temei_legal).toContain("179/2015");
    expect(p?.denumire.length).toBeGreaterThan(3);
  });

  it("categoria fără periodicitate lasă câmpul gol, nu „null”", () => {
    expect(preCompletarePlan("verificare_montare")?.periodicitate_zile).toBe("");
  });

  it("cod necunoscut ⇒ null", () => {
    expect(preCompletarePlan("nimic")).toBeNull();
  });
});

describe("depasesteMaximulLegal (cazul 40)", () => {
  it("scadența mai scurtă decât maximul: documentul are prioritate, fără avertisment", () => {
    expect(depasesteMaximulLegal(24, "2026-01-10", "2027-01-10")).toBeNull();
  });

  it("scadența exact la maxim nu avertizează", () => {
    expect(depasesteMaximulLegal(24, "2026-01-10", "2028-01-10")).toBeNull();
  });

  it("„2 ani” peste un 29 februarie e tot exact la maxim (731 de zile)", () => {
    expect(depasesteMaximulLegal(24, "2027-03-01", "2029-03-01")).toBeNull();
  });

  it("scadența peste maxim ⇒ data maximă calculată pe luni", () => {
    expect(depasesteMaximulLegal(24, "2026-01-10", "2028-03-01")).toEqual({
      dataMaxima: "2028-01-10",
    });
  });

  it("fără maxim, fără dată de pornire sau fără scadență ⇒ null", () => {
    expect(depasesteMaximulLegal(null, "2026-01-10", "2030-01-01")).toBeNull();
    expect(depasesteMaximulLegal(24, null, "2030-01-01")).toBeNull();
    expect(depasesteMaximulLegal(24, "2026-01-10", null)).toBeNull();
  });
});

describe("adunaLuni", () => {
  it("taie ziua la ultima zi a lunii țintă", () => {
    expect(adunaLuni("2026-01-31", 1)).toBe("2026-02-28");
    expect(adunaLuni("2027-02-28", 12)).toBe("2028-02-28");
    expect(adunaLuni("2028-02-29", 12)).toBe("2029-02-28");
    expect(adunaLuni("2026-10-12", 24)).toBe("2028-10-12");
    expect(adunaLuni("2026-11-30", 3)).toBe("2027-02-28");
  });
});
