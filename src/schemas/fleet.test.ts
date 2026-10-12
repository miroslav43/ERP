// src/schemas/fleet.test.ts
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  alimentareSchema,
  cursaSchema,
  documentVehiculSchema,
  foaieNouaSchema,
  setariFlotaSchema,
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

  it("sosirea cursei și alimentarea, vara ⇒ trei ore în urmă", () => {
    expect(
      cursaSchema.parse({
        trip_sheet_id: ID,
        plecare_la: "2026-07-01T16:00",
        sosire_la: "2026-07-01T18:00",
        de_la_loc: "Sediu",
        pana_la_loc: "Client",
        scop: "Livrare",
        km_plecare: "1100",
        km_sosire: "1200",
      }).sosire_la,
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

describe("foaia zilnică (0200)", () => {
  const cursa = (m: Record<string, unknown> = {}) => ({
    trip_sheet_id: ID,
    plecare_la: "2026-10-05T08:00",
    sosire_la: "2026-10-05T09:00",
    de_la_loc: "Sediu",
    pana_la_loc: "Depozit",
    scop: "Aprovizionare",
    km_plecare: "10000",
    km_sosire: "10040",
    ...m,
  });

  it("trimiterea nu mai poartă sosirea: o dau cursele", () => {
    const r = trimiteFoaieSchema.parse({ id: ID, sosire_la: "2026-07-01T18:00", km_sosire: 1 });
    expect(r).toEqual({ id: ID, observatii: null });
  });

  it("o cursă în desfășurare: sosirea goală, kilometrajul gol", () => {
    const r = cursaSchema.parse(cursa({ sosire_la: "", km_sosire: "" }));
    expect(r.sosire_la).toBeNull();
    expect(r.km_sosire).toBeNull();
    expect(r.km_plecare).toBe(10000);
    expect(r.sablon_id).toBeNull();
  });

  it("sosirea se completează întreagă: ora fără km și km fără oră sunt refuzate pe câmp", () => {
    const faraKm = cursaSchema.safeParse(cursa({ km_sosire: "" }));
    expect(faraKm.error?.issues.map((i) => i.path[0])).toEqual(["km_sosire"]);
    const faraOra = cursaSchema.safeParse(cursa({ sosire_la: "" }));
    expect(faraOra.error?.issues.map((i) => i.path[0])).toEqual(["sosire_la"]);
  });

  it("km la sosire nu poate fi sub cel de la plecare", () => {
    const r = cursaSchema.safeParse(cursa({ km_sosire: "9990" }));
    expect(r.error?.issues[0]?.message).toBe(
      "Kilometrajul la sosire trebuie să fie mai mare decât cel de la plecare.",
    );
  });

  it("locul și scopul sunt obligatorii, cu mesaj în română (HG 1/2016 pct. 16)", () => {
    const r = cursaSchema.safeParse(cursa({ de_la_loc: "  ", scop: "" }));
    const mesaje = Object.fromEntries((r.error?.issues ?? []).map((i) => [i.path[0], i.message]));
    expect(mesaje).toEqual({
      de_la_loc: "Scrieți locul de plecare al cursei.",
      scop: "Scrieți scopul cursei.",
    });
  });

  it("kilometrajul gol la plecare spune „lipsește”, nu 0 km", () => {
    const r = cursaSchema.safeParse(cursa({ km_plecare: "" }));
    expect(r.error?.issues[0]?.message).toBe("Scrieți kilometrajul la plecare, în km.");
  });
});

describe("setările flotei (0201)", () => {
  const ID2 = "55555555-5555-4555-8555-555555555555";

  it("textul pragurilor devine lista din bază: descrescător, fără dubluri", () => {
    const r = setariFlotaSchema.parse({
      responsabili: [ID, ID2, ID],
      prag_salt_km: "800",
      praguri_alerta_zile: "7, 30, 14, 7",
    });
    expect(r).toEqual({
      responsabili: [ID, ID2],
      prag_salt_km: 800,
      praguri_alerta_zile: [30, 14, 7],
    });
  });

  it("fără responsabili: lista goală (toți administratorii), nu o eroare", () => {
    const r = setariFlotaSchema.parse({ prag_salt_km: 1500, praguri_alerta_zile: [30] });
    expect(r.responsabili).toEqual([]);
  });

  it.each([
    ["", "Scrieți cel puțin un prag"],
    ["30, două", "cifre întregi"],
    ["400", "între 1 și 365"],
    ["0, 7", "între 1 și 365"],
    ["1 2 3 4 5 6 7 8 9", "Cel mult 8"],
  ])("pragurile „%s” sunt refuzate pe câmp: %s", (text, mesaj) => {
    const r = setariFlotaSchema.safeParse({ prag_salt_km: 1500, praguri_alerta_zile: text });
    expect(r.success).toBe(false);
    if (r.success) return;
    const eroare = r.error.issues.find((i) => i.path[0] === "praguri_alerta_zile");
    expect(eroare?.message).toContain(mesaj);
  });

  it.each([[""], ["49"], ["100001"], ["12,5"]])("pragul de salt „%s” nu trece", (prag) => {
    const r = setariFlotaSchema.safeParse({ prag_salt_km: prag, praguri_alerta_zile: "30" });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.issues[0]?.path).toEqual(["prag_salt_km"]);
  });
});
