// src/schemas/fleet-pv.test.ts
import { describe, expect, it } from "vitest";

import {
  actualizeazaPvSchema,
  anuleazaPvSchema,
  constatariPvSchema,
  pvNouSchema,
} from "./fleet-pv";

const ID_A = "55555555-5555-4555-8555-555555555555";
const ID_B = "66666666-6666-4666-8666-666666666666";
const VEH = "77777777-7777-4777-8777-777777777777";

describe("constatariPvSchema", () => {
  it("nimic completat: totul `null` sau gol, iar „s-au constatat daune?” rămâne NEDECLARAT", () => {
    expect(constatariPvSchema.parse({})).toEqual({
      km_bord: null,
      nivel_rezervor: null,
      numar_chei: null,
      stare_generala: null,
      anvelope: null,
      documente_bord: [],
      dotari: [],
      daune_constatate: null,
      daune: [],
      observatii: null,
    });
  });

  it("„nu” e `false`, „da” e `true`, absența e `null` — nu `false`", () => {
    expect(constatariPvSchema.parse({ daune_constatate: "nu" }).daune_constatate).toBe(false);
    expect(
      constatariPvSchema.parse({
        daune_constatate: "da",
        daune: [{ zona: "fata", descriere: "Bară" }],
      }).daune_constatate,
    ).toBe(true);
    expect(constatariPvSchema.parse({ daune_constatate: "" }).daune_constatate).toBeNull();
  });

  it("km gol e `null`, nu 0; km zecimal e refuzat", () => {
    expect(constatariPvSchema.parse({ km_bord: "" }).km_bord).toBeNull();
    expect(constatariPvSchema.parse({ km_bord: "0" }).km_bord).toBe(0);
    expect(constatariPvSchema.safeParse({ km_bord: "1200,5" }).success).toBe(false);
  });

  it("dotările și documentele se dedublează; un cod din afara listei e refuzat", () => {
    expect(constatariPvSchema.parse({ dotari: ["extinctor", "extinctor"] }).dotari).toEqual([
      "extinctor",
    ]);
    expect(constatariPvSchema.safeParse({ dotari: ["umbrela"] }).success).toBe(false);
  });

  it("„fără daune” cu o daună în listă e refuzat pe `daune`", () => {
    const r = constatariPvSchema.safeParse({
      daune_constatate: "nu",
      daune: [{ zona: "fata", descriere: "Bară zgâriată" }],
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["daune"]);
  });

  it("„cu daune” fără nicio daună e refuzat pe `daune`", () => {
    const r = constatariPvSchema.safeParse({ daune_constatate: "da", daune: [] });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["daune"]);
  });

  it("daunele vin din FormData ca JSON; zona necunoscută și descrierea goală sunt refuzate", () => {
    expect(
      constatariPvSchema.parse({
        daune_constatate: "da",
        daune: JSON.stringify([{ zona: "parbriz", descriere: "  Fisură  " }]),
      }).daune,
    ).toEqual([{ zona: "parbriz", descriere: "Fisură" }]);
    expect(
      constatariPvSchema.safeParse({
        daune_constatate: "da",
        daune: [{ zona: "motor", descriere: "x" }],
      }).success,
    ).toBe(false);
    expect(
      constatariPvSchema.safeParse({
        daune_constatate: "da",
        daune: [{ zona: "fata", descriere: "  " }],
      }).success,
    ).toBe(false);
  });

  it("cel mult 30 de daune", () => {
    const daune = Array.from({ length: 31 }, () => ({ zona: "fata", descriere: "x" }));
    expect(constatariPvSchema.safeParse({ daune_constatate: "da", daune }).success).toBe(false);
  });
});

describe("pvNouSchema", () => {
  it("cere cel puțin o alocare", () => {
    const r = pvNouSchema.safeParse({ vehicle_id: VEH });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["alocare_primita_id"]);
  });

  it("acceptă predarea, restituirea și transferul", () => {
    expect(pvNouSchema.safeParse({ vehicle_id: VEH, alocare_primita_id: ID_A }).success).toBe(true);
    expect(pvNouSchema.safeParse({ vehicle_id: VEH, alocare_predata_id: ID_A }).success).toBe(true);
    expect(
      pvNouSchema.safeParse({ vehicle_id: VEH, alocare_predata_id: ID_A, alocare_primita_id: ID_B })
        .success,
    ).toBe(true);
  });

  it("refuză aceeași alocare pe ambele capete", () => {
    expect(
      pvNouSchema.safeParse({ vehicle_id: VEH, alocare_predata_id: ID_A, alocare_primita_id: ID_A })
        .success,
    ).toBe(false);
  });

  it("nu poartă coloanele pe care le scrie baza", () => {
    const iesire = pvNouSchema.parse({
      vehicle_id: VEH,
      alocare_primita_id: ID_A,
      sofer_employee_id: ID_B,
      tip: "transfer",
      numar: "PVA-2026-9999",
      snapshot: {},
      confirmat_primitor_de: ID_B,
    });
    for (const camp of ["sofer_employee_id", "tip", "numar", "snapshot", "confirmat_primitor_de"]) {
      expect(iesire).not.toHaveProperty(camp);
    }
  });
});

describe("actualizeazaPvSchema și anuleazaPvSchema", () => {
  it("actualizarea cere id-ul și vehiculul, plus coerența daunelor", () => {
    expect(actualizeazaPvSchema.safeParse({ id: ID_A, vehicle_id: VEH }).success).toBe(true);
    expect(
      actualizeazaPvSchema.safeParse({ id: ID_A, vehicle_id: VEH, daune_constatate: "da" }).success,
    ).toBe(false);
  });

  it("motivul anulării are între 10 și 500 de caractere", () => {
    expect(
      anuleazaPvSchema.safeParse({ id: ID_A, vehicle_id: VEH, motiv_anulare: "scurt" }).success,
    ).toBe(false);
    expect(
      anuleazaPvSchema.safeParse({
        id: ID_A,
        vehicle_id: VEH,
        motiv_anulare: "Kilometrajul a fost citit greșit.",
      }).success,
    ).toBe(true);
  });
});
