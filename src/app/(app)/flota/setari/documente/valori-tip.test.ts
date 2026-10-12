// src/app/(app)/flota/setari/documente/valori-tip.test.ts
import { describe, expect, it } from "vitest";

import { tipDocumentPropriuSchema } from "@/schemas/fleet";

import { valoriTip } from "./valori-tip";

function date(intrari: readonly (readonly [string, string])[]): FormData {
  const f = new FormData();
  for (const [k, v] of intrari) f.append(k, v);
  return f;
}

describe("valoriTip", () => {
  it("bifele nebifate LIPSESC din FormData și înseamnă `false`", () => {
    const v = valoriTip(date([["denumire", "Autorizație"]]));
    expect(v.cere_expirare).toBe(false);
    expect(v.obligatoriu).toBe(false);
  });

  it("categoriile vin repetate; o valoare străină se aruncă", () => {
    const v = valoriTip(
      date([
        ["denumire", "Tahograf"],
        ["categorii_aplicabile", "camion"],
        ["categorii_aplicabile", "autobuz"],
        ["categorii_aplicabile", "tractor-inventat"],
      ]),
    );
    expect(v.categorii_aplicabile).toEqual(["camion", "autobuz"]);
  });

  it("prin schemă: nicio categorie = `null` (oricare), masa goală = `null`, nu 0", () => {
    const iesire = tipDocumentPropriuSchema.parse(
      valoriTip(
        date([
          ["denumire", " Autorizație locală "],
          ["descriere", "   "],
          ["cere_expirare", "on"],
          ["masa_max_kg", ""],
        ]),
      ),
    );
    expect(iesire).toEqual({
      denumire: "Autorizație locală",
      descriere: null,
      cere_expirare: true,
      obligatoriu: false,
      categorii_aplicabile: null,
      masa_max_kg: null,
    });
  });

  it("prin schemă: masa tastată devine număr întreg", () => {
    const iesire = tipDocumentPropriuSchema.parse(
      valoriTip(
        date([
          ["denumire", "Rovinietă proprie"],
          ["masa_max_kg", "3500"],
        ]),
      ),
    );
    expect(iesire.masa_max_kg).toBe(3500);
  });
});
