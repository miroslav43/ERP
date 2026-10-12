// src/schemas/fleet.test.ts
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  alimentareSchema,
  documentVehiculSchema,
  foaieNouaSchema,
  trimiteFoaieSchema,
  vehiculNouSchema,
} from "./fleet";

const ID = "44444444-4444-4444-8444-444444444444";

describe("orele din parcul auto sunt ora României", () => {
  it("plecarea foii: 07:30 tastat, iarna ⇒ 05:30 UTC", () => {
    const foaie = foaieNouaSchema.parse({
      vehicle_id: ID,
      employee_id: ID,
      plecare_la: "2026-12-03T07:30",
      km_plecare: 1000,
      traseu: null,
      scop: null,
      observatii: null,
    });
    expect(foaie.plecare_la).toBe("2026-12-03T05:30:00.000Z");
  });

  it("sosirea și alimentarea, vara ⇒ trei ore în urmă", () => {
    expect(
      trimiteFoaieSchema.parse({ id: ID, sosire_la: "2026-07-01T18:00", km_sosire: 1200 })
        .sosire_la,
    ).toBe("2026-07-01T15:00:00.000Z");
    expect(
      alimentareSchema.parse({
        trip_sheet_id: ID,
        litri: 40,
        cost: 300,
        statie: null,
        numar_bon: null,
        alimentat_la: "2026-07-01T12:00",
        plin: false,
        observatii: null,
      }).alimentat_la,
    ).toBe("2026-07-01T09:00:00.000Z");
  });

  it("mesajele sunt în română și stau pe câmp", () => {
    const rezultat = alimentareSchema.safeParse({
      trip_sheet_id: ID,
      litri: 0,
      cost: 300,
      statie: null,
      numar_bon: null,
      alimentat_la: "",
      plin: false,
      observatii: null,
    });
    const mesaj = (camp: string) => rezultat.error?.issues.find((i) => i.path[0] === camp)?.message;
    expect(mesaj("alimentat_la")).toBe("Completați data și ora alimentării.");
    expect(mesaj("litri")).toBe("Cantitatea alimentată trebuie să fie mai mare decât zero.");
  });
});

/**
 * ADM-020: vehiculul nou trimis gol arăta „Too small: expected string to have
 * >=3 characters”, iar VIN-ul scurt chiar expresia regulată brută.
 */
describe("mesajele vehiculului și ale documentului sunt românești", () => {
  const VALID = { nr_inmatriculare: "B123ABC", marca: "Dacia", model: "Logan", km_curent: 0 };
  const mesajePe = (schema: z.ZodType, intrare: unknown) => {
    const rezultat = schema.safeParse(intrare);
    expect(rezultat.success).toBe(false);
    return z.flattenError(rezultat.error as z.ZodError).fieldErrors as Record<
      string,
      string[] | undefined
    >;
  };

  it("vehicul gol: număr de înmatriculare, marcă și model în română, cu punct", () => {
    const erori = mesajePe(vehiculNouSchema, { nr_inmatriculare: "", marca: "", model: "" });
    expect(erori["nr_inmatriculare"]).toEqual(["Introduceți numărul de înmatriculare."]);
    expect(erori["marca"]).toEqual(["Introduceți marca."]);
    expect(erori["model"]).toEqual(["Introduceți modelul."]);
  });

  it("numărul de înmatriculare prea lung are limita în text", () => {
    const erori = mesajePe(vehiculNouSchema, { ...VALID, nr_inmatriculare: "B".repeat(20) });
    expect(erori["nr_inmatriculare"]).toEqual([
      "Numărul de înmatriculare nu poate depăși 16 caractere.",
    ]);
  });

  it("VIN-ul scurt: mesaj fără expresie regulată, pe nivelul uniunii", () => {
    const erori = mesajePe(vehiculNouSchema, { ...VALID, vin: "ABC" });
    const mesaj = erori["vin"]?.[0] ?? "";
    expect(mesaj).toContain("11–17");
    expect(mesaj).not.toContain("/^");
    expect(mesaj).toMatch(/\.$/u);
  });

  it("VIN-ul scurt: fiecare problemă brută poartă mesajul (calea zodResolver)", () => {
    // zod 4.4 ridică direct problema ramurii când una singură se potrivește ca
    // tip, iar altfel dă `invalid_union`; ambele forme trebuie să spună același lucru.
    const rezultat = vehiculNouSchema.safeParse({ ...VALID, vin: "ABC" });
    const probleme = (rezultat.error?.issues ?? []).filter((i) => i.path[0] === "vin");
    const mesaje = probleme.flatMap((p) => [
      p.message,
      ...(p.code === "invalid_union" ? p.errors.flat().map((i) => i.message) : []),
    ]);
    expect(mesaje.length).toBeGreaterThan(0);
    for (const mesaj of mesaje) expect(mesaj).toBe("VIN-ul are 11–17 caractere (fără I, O, Q).");
  });

  it("anul de fabricație 1800 → „între 1900 și 2200”", () => {
    const erori = mesajePe(vehiculNouSchema, { ...VALID, an_fabricatie: 1800 });
    expect(erori["an_fabricatie"]).toEqual(["Anul de fabricație este între 1900 și 2200."]);
  });

  it("documentul cu cost negativ → „Costul nu poate fi negativ.”", () => {
    const erori = mesajePe(documentVehiculSchema, {
      vehicle_id: ID,
      document_type_id: ID,
      cost: -20,
    });
    expect(erori["cost"]).toEqual(["Costul nu poate fi negativ."]);
  });
});
