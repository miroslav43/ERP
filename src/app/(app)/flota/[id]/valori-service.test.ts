import { describe, expect, it } from "vitest";

import {
  actualizeazaPlanServiceSchema,
  cheltuialaSchema,
  intrareServiceSchema,
  planServiceSchema,
} from "@/schemas/fleet-service";

import {
  valoriCheltuiala,
  valoriIntrare,
  valoriPlan,
  valoriPlanActualizat,
} from "./valori-service";

const ID = "6f1c1c58-3b7e-4a43-9a52-1f3d5c0d7e11";

function formular(campuri: Readonly<Record<string, string>>): FormData {
  const date = new FormData();
  for (const [cheie, valoare] of Object.entries(campuri)) date.append(cheie, valoare);
  return date;
}

describe("valoriPlan", () => {
  it("citește câmpurile ca text și le lasă schemei; golul rămâne gol, nu 0", () => {
    const valori = valoriPlan(
      formular({
        denumire: " Revizie ",
        tip: "revizie",
        interval_km: "",
        interval_luni: "12",
        baza_data: "2026-07-01",
        baza_km: "40000",
      }),
    );
    expect(valori).toStrictEqual({
      denumire: "Revizie",
      tip: "revizie",
      interval_km: "",
      interval_luni: "12",
      baza_data: "2026-07-01",
      baza_km: "40000",
      prag_avertizare_km: "",
      observatii: "",
    });
    const parsat = planServiceSchema.parse({ vehicle_id: ID, ...valori });
    expect(parsat.interval_km).toBeNull();
    expect(parsat.interval_luni).toBe(12);
    expect(parsat.prag_avertizare_km).toBe(1000);
  });

  it("bifa `activ` nebifată lipsește din FormData: înseamnă false", () => {
    const baza = {
      denumire: "Revizie",
      tip: "revizie",
      interval_luni: "12",
      baza_data: "2026-07-01",
      baza_km: "1",
    };
    expect(valoriPlanActualizat(formular(baza)).activ).toBe(false);
    expect(valoriPlanActualizat(formular({ ...baza, activ: "on" })).activ).toBe(true);
    const parsat = actualizeazaPlanServiceSchema.parse({
      id: ID,
      vehicle_id: ID,
      ...valoriPlanActualizat(formular({ ...baza, activ: "on" })),
    });
    expect(parsat.activ).toBe(true);
  });
});

describe("valoriIntrare", () => {
  it("o intrare completă trece de schemă fără nicio conversie în plus", () => {
    const valori = valoriIntrare(
      formular({
        plan_id: "",
        data_interventiei: "2026-10-01",
        km: "46500",
        tip: "anvelope",
        descriere: "Montat iarnă",
        cost_piese: "800",
        cost_manopera: "",
        anvelope_montate: "iarna",
      }),
    );
    const parsat = intrareServiceSchema.parse({ vehicle_id: ID, ...valori });
    expect(parsat).toMatchObject({
      plan_id: null,
      km: 46500,
      cost_piese: 800,
      cost_manopera: 0,
      anvelope_montate: "iarna",
      furnizor: null,
    });
  });
});

describe("valoriCheltuiala", () => {
  it("litrii goi rămân null, nu 0", () => {
    const valori = valoriCheltuiala(
      formular({ categorie: "parcare", data_cheltuielii: "2026-10-02", suma: "15" }),
    );
    const parsat = cheltuialaSchema.parse({ vehicle_id: ID, ...valori });
    expect(parsat.litri).toBeNull();
    expect(parsat.km_bord).toBeNull();
    expect(parsat.suma).toBe(15);
  });
});
