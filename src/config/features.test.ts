import { describe, expect, it } from "vitest";

import { FEATURE_KEYS, imparteCheiDeModul, isFeatureKey } from "./features";

/**
 * Regresie: pe 2026-08-21 tabloul de bord a răspuns 500 tuturor utilizatorilor
 * unei organizații, imediat după autentificare.
 *
 * Cauza: `getEnabledFeatures` valida rândurile din `organization_features` cu
 * `z.enum(FEATURE_KEYS)`, care ARUNCĂ la prima cheie necunoscută. În bază
 * fusese adăugat modulul `ticketing` înaintea codului — o secvență absolut
 * normală de lucru — și de la acel moment fiecare pagină din spatele
 * autentificării a picat, nu doar modulul în cauză.
 *
 * Contractul corect e cel scris în capul lui `features.ts`: cheile necunoscute
 * se TAIE la citire. Aici se verifică exact asta.
 */
describe("imparteCheiDeModul", () => {
  it("păstrează cheile cunoscute, în ordinea primită", () => {
    const { cunoscute } = imparteCheiDeModul(["leave", "nucleu", "payroll"]);
    expect(cunoscute).toEqual(["leave", "nucleu", "payroll"]);
  });

  it("taie o cheie pe care codul nu o cunoaște, fără să arunce", () => {
    const { cunoscute, necunoscute } = imparteCheiDeModul(["nucleu", "ticketing", "leave"]);
    expect(cunoscute).toEqual(["nucleu", "leave"]);
    expect(necunoscute).toEqual(["ticketing"]);
  });

  it("raportează cheile necunoscute o singură dată, chiar dacă se repetă", () => {
    const { necunoscute } = imparteCheiDeModul(["ticketing", "ticketing", "crm"]);
    expect(necunoscute).toEqual(["ticketing", "crm"]);
  });

  it("acceptă lista goală", () => {
    expect(imparteCheiDeModul([])).toEqual({ cunoscute: [], necunoscute: [] });
  });

  it("nu taie nimic când baza e sincronizată cu codul", () => {
    const { cunoscute, necunoscute } = imparteCheiDeModul([...FEATURE_KEYS]);
    expect(cunoscute).toHaveLength(FEATURE_KEYS.length);
    expect(necunoscute).toEqual([]);
  });
});

describe("isFeatureKey", () => {
  it("recunoaște fiecare cheie din catalog", () => {
    for (const cheie of FEATURE_KEYS) expect(isFeatureKey(cheie)).toBe(true);
  });

  it("respinge o cheie din afara catalogului", () => {
    expect(isFeatureKey("ticketing")).toBe(false);
  });
});
