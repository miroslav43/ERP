import { describe, expect, it } from "vitest";

import { hrefFisa, hrefFisaDinHarta, type HartaPermisiuni } from "./fisa";

const cuDrept: HartaPermisiuni = new Map([["employees:read", "team"]]);
const faraDrept: HartaPermisiuni = new Map([["leave:read", "all"]]);

describe("hrefFisa", () => {
  it("leagă fișa venită din bază, neștearsă, când rolul are employees:read", () => {
    expect(hrefFisa({ id: "a1", deleted_at: null }, cuDrept)).toBe("/angajati/a1");
    // Fără `deleted_at` în select se presupune nești — apelantul e cel care alege.
    expect(hrefFisa({ id: "a1" }, cuDrept)).toBe("/angajati/a1");
  });

  it("nu leagă rândul absent: embed null (RLS) sau hartă fără id", () => {
    expect(hrefFisa(null, cuDrept)).toBeNull();
    expect(hrefFisa(undefined, cuDrept)).toBeNull();
    expect(hrefFisaDinHarta("a2", new Map([["a1", { id: "a1" }]]), cuDrept)).toBeNull();
    expect(hrefFisaDinHarta(null, new Map([["a1", { id: "a1" }]]), cuDrept)).toBeNull();
  });

  it("nu leagă fișa ștearsă logic: numele rămâne în istoric, linkul ar da 404", () => {
    expect(hrefFisa({ id: "a1", deleted_at: "2026-01-01T00:00:00Z" }, cuDrept)).toBeNull();
  });

  it("nu leagă fără employees:read, nici cu refuz explicit", () => {
    expect(hrefFisa({ id: "a1" }, faraDrept)).toBeNull();
    expect(hrefFisa({ id: "a1" }, new Map([["employees:read", "none"]]))).toBeNull();
  });
});
