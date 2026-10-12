// src/schemas/maintenance.test.ts
//
// ADM-025: echipamentul, planul și setările mentenanței arătau pe câmp textele
// implicite ale lui zod („Too small: expected string to have >=1 characters”,
// „Too big: expected number to be <=90”). Aici, câte un caz pe fiecare regulă.

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { echipamentSchema, planNouSchema, setariMentenantaSchema } from "./maintenance";

const ID = "44444444-4444-4444-8444-444444444444";

const eroriPe = (schema: z.ZodType, intrare: unknown) => {
  const rezultat = schema.safeParse(intrare);
  expect(rezultat.success).toBe(false);
  return z.flattenError(rezultat.error as z.ZodError).fieldErrors as Record<
    string,
    string[] | undefined
  >;
};

describe("echipamentul — mesaje românești", () => {
  it("cod și denumire goale", () => {
    const erori = eroriPe(echipamentSchema, { cod: "", denumire: "" });
    expect(erori["cod"]).toEqual(["Introduceți codul echipamentului."]);
    expect(erori["denumire"]).toEqual(["Introduceți denumirea echipamentului."]);
  });

  it("anul 3000 și valoarea negativă", () => {
    const erori = eroriPe(echipamentSchema, {
      cod: "E1",
      denumire: "Compresor",
      an_fabricatie: 3000,
      valoare_achizitie: -1,
    });
    expect(erori["an_fabricatie"]).toEqual(["Anul de fabricație este între 1900 și 2200."]);
    expect(erori["valoare_achizitie"]).toEqual(["Valoarea de achiziție nu poate fi negativă."]);
  });
});

describe("planul — periodicitatea", () => {
  it("periodicitate −10 zile", () => {
    const erori = eroriPe(planNouSchema, {
      equipment_id: ID,
      denumire: "Revizie",
      periodicitate_zile: -10,
    });
    expect(erori["periodicitate_zile"]).toEqual(["Periodicitatea este de cel puțin o zi."]);
  });

  it("periodicitate pe contor zero", () => {
    const erori = eroriPe(planNouSchema, {
      equipment_id: ID,
      denumire: "Revizie",
      periodicitate_contor: 0,
      tip_contor: "ore",
    });
    expect(erori["periodicitate_contor"]).toEqual([
      "Periodicitatea pe contor trebuie să fie mai mare decât zero.",
    ]);
  });
});

describe("setările mentenanței", () => {
  it("închidere 200, ore 30, zile 9", () => {
    const erori = eroriPe(setariMentenantaSchema, {
      inchidere_automata_zile: 200,
      ore_functionare_pe_zi: 30,
      zile_pe_saptamana: 9,
    });
    expect(erori["inchidere_automata_zile"]).toEqual([
      "Închiderea automată se face după 1–90 de zile.",
    ]);
    expect(erori["ore_functionare_pe_zi"]).toEqual([
      "Orele de funcționare pe zi sunt între 0,5 și 24.",
    ]);
    expect(erori["zile_pe_saptamana"]).toEqual(["Zilele pe săptămână sunt între 1 și 7."]);
  });
});
