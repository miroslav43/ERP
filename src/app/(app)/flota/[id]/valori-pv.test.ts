// src/app/(app)/flota/[id]/valori-pv.test.ts
import { describe, expect, it } from "vitest";

import { constatariPvSchema } from "@/schemas/fleet-pv";

import { valoriPv } from "./valori-pv";

function formular(intrari: readonly (readonly [string, string])[]): FormData {
  const date = new FormData();
  for (const [nume, valoare] of intrari) date.append(nume, valoare);
  return date;
}

describe("valoriPv", () => {
  it("FormData gol: daunele NEDECLARATE (`null`, nu `false`), bifele liste goale, km gol", () => {
    const v = valoriPv(new FormData());
    expect(v).toEqual({
      km_bord: "",
      nivel_rezervor: null,
      numar_chei: "",
      stare_generala: null,
      anvelope: null,
      documente_bord: [],
      dotari: [],
      daune_constatate: null,
      daune: "[]",
      observatii: null,
    });
    // Prin schemă: km gol devine `null`, nu 0 (`Number("")` ar fi dat 0).
    const parsat = constatariPvSchema.parse(v);
    expect(parsat.km_bord).toBeNull();
    expect(parsat.daune_constatate).toBeNull();
  });

  it("bifele multiple se citesc toate, cu `getAll`", () => {
    const v = valoriPv(
      formular([
        ["dotari", "trusa_medicala"],
        ["dotari", "extinctor"],
        ["documente_bord", "polita_rca"],
      ]),
    );
    expect(v.dotari).toEqual(["trusa_medicala", "extinctor"]);
    expect(v.documente_bord).toEqual(["polita_rca"]);
  });

  it("„nu” golește lista de daune scrisă înainte de schimbarea răspunsului", () => {
    const v = valoriPv(
      formular([
        ["daune_constatate", "nu"],
        ["daune", JSON.stringify([{ zona: "fata", descriere: "Bară" }])],
      ]),
    );
    expect(v.daune).toBe("[]");
    expect(constatariPvSchema.safeParse(v).success).toBe(true);
  });

  it("„da” păstrează lista; schema o parsează din JSON", () => {
    const v = valoriPv(
      formular([
        ["daune_constatate", "da"],
        ["daune", JSON.stringify([{ zona: "parbriz", descriere: "Fisură" }])],
        ["km_bord", " 51200 "],
      ]),
    );
    const parsat = constatariPvSchema.parse(v);
    expect(parsat.daune).toEqual([{ zona: "parbriz", descriere: "Fisură" }]);
    expect(parsat.km_bord).toBe(51200);
  });

  it("observațiile goale sunt `null`, nu șir gol", () => {
    expect(valoriPv(formular([["observatii", "   "]])).observatii).toBeNull();
  });
});
