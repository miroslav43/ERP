// src/app/(app)/mentenanta/sesizari/valori-sesizare.test.ts

import { describe, expect, it } from "vitest";

import { valoriSesizare } from "./valori-sesizare";

function formular(perechi: Readonly<Record<string, string>>): FormData {
  const date = new FormData();
  for (const [cheie, valoare] of Object.entries(perechi)) date.set(cheie, valoare);
  return date;
}

describe("valoriSesizare", () => {
  it("echipamentul vine din câmpul ascuns; urgența goală cade pe „medie”; bifa absentă e false", () => {
    expect(valoriSesizare(formular({ descriere: "  Scârțâie și se oprește.  " }))).toEqual({
      equipment_id: "",
      descriere: "Scârțâie și se oprește.",
      urgenta: "medie",
      opreste_functionarea: false,
    });
  });

  it("valorile trimise se păstrează întocmai", () => {
    expect(
      valoriSesizare(
        formular({
          equipment_id: "11111111-1111-4111-8111-111111111111",
          descriere: "Banda s-a rupt.",
          urgenta: "critica",
          opreste_functionarea: "on",
        }),
      ),
    ).toEqual({
      equipment_id: "11111111-1111-4111-8111-111111111111",
      descriere: "Banda s-a rupt.",
      urgenta: "critica",
      opreste_functionarea: true,
    });
  });
});
