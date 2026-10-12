// src/app/(app)/mentenanta/interventii/valori-interventie.test.ts

import { describe, expect, it } from "vitest";

import { planDinFormular, valoriInterventie } from "./valori-interventie";

function formular(perechi: Readonly<Record<string, string>>): FormData {
  const date = new FormData();
  for (const [cheie, valoare] of Object.entries(perechi)) date.set(cheie, valoare);
  return date;
}

describe("valoriInterventie", () => {
  it("câmpurile goale devin null, costurile goale devin 0, tipul și rezultatul au implicite", () => {
    expect(
      valoriInterventie(formular({ data: "2026-10-07", descriere: " Schimb ulei. " })),
    ).toEqual({
      tip: "corectiva",
      data: "2026-10-07",
      ora_start: null,
      durata_ore: null,
      executant_employee_id: null,
      executant_extern: null,
      descriere: "Schimb ulei.",
      piese: null,
      cost_piese: 0,
      cost_manopera: 0,
      rezultat: "reusita",
      oprire_minute: null,
      citire_contor: null,
      observatii: null,
    });
  });

  it("numerele se convertesc, textele se păstrează", () => {
    const v = valoriInterventie(
      formular({
        tip: "preventiva",
        data: "2026-10-01",
        ora_start: "09:30",
        durata_ore: "1.5",
        executant_extern: "Service SRL",
        descriere: "Revizie",
        piese: "Filtru",
        cost_piese: "300",
        cost_manopera: "150.5",
        rezultat: "partiala",
        oprire_minute: "45",
        citire_contor: "3250.5",
        observatii: "De urmărit",
      }),
    );
    expect(v).toMatchObject({
      tip: "preventiva",
      ora_start: "09:30",
      durata_ore: 1.5,
      executant_extern: "Service SRL",
      cost_piese: 300,
      cost_manopera: 150.5,
      rezultat: "partiala",
      oprire_minute: 45,
      citire_contor: 3250.5,
      observatii: "De urmărit",
    });
  });

  it("nu poartă plan_id și equipment_id — pe acelea le dă apelantul", () => {
    const v = valoriInterventie(formular({ plan_id: "x", equipment_id: "y", data: "2026-10-07" }));
    expect(v).not.toHaveProperty("plan_id");
    expect(v).not.toHaveProperty("equipment_id");
  });
});

describe("planDinFormular", () => {
  it("planul ales sau null", () => {
    expect(planDinFormular(formular({ plan_id: "" }))).toBeNull();
    expect(planDinFormular(formular({}))).toBeNull();
    expect(planDinFormular(formular({ plan_id: "11111111-1111-4111-8111-111111111111" }))).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
  });
});
