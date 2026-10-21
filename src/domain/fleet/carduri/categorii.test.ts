import { describe, expect, it } from "vitest";

import { categorieProdus } from "./categorii";

describe("categorieProdus", () => {
  it.each([
    ["Motorină", "combustibil", "motorina"],
    ["EURODIESEL", "combustibil", "motorina"],
    ["MaxxMotion Diesel", "combustibil", "motorina"],
    ["Shell V-Power Diesel", "combustibil", "motorina"],
    ["Benzină 95", "combustibil", "benzina"],
    ["Unleaded 98", "combustibil", "benzina"],
    ["Super Plus", "combustibil", "benzina"],
    ["GPL auto", "combustibil", "gpl"],
    ["Autogas", "combustibil", "gpl"],
    ["CNG", "combustibil", "gnc"],
  ] as const)("„%s” → %s / %s", (produs, categorie, tip) => {
    expect(categorieProdus(produs)).toEqual({ categorie, tipCombustibil: tip });
  });

  it.each([
    ["AdBlue", "adblue"],
    ["Diesel AdBlue 10L", "adblue"],
    ["Rovinietă 30 zile", "taxa_drum"],
    ["Taxa pod Fetești", "taxa_drum"],
    ["TollRo", "taxa_drum"],
    ["Peaj A1", "taxa_drum"],
    ["Maut DE", "taxa_drum"],
    ["Spălare auto", "spalatorie"],
    ["Car wash premium", "spalatorie"],
    ["Parcare", "parcare"],
    ["Shop", "magazin"],
    ["Ulei motor 5W30", "altele"],
    ["Necunoscut", "altele"],
  ] as const)("„%s” → %s, fără tip de combustibil", (produs, categorie) => {
    expect(categorieProdus(produs)).toEqual({ categorie, tipCombustibil: null });
  });

  it("necunoscutul NU e combustibil: n-ar trebui să ceară o alimentare pe foaie", () => {
    expect(categorieProdus("XYZ-123").categorie).not.toBe("combustibil");
  });
});
