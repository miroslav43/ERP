// src/schemas/fleet.test.ts
import { describe, expect, it } from "vitest";

import { alimentareSchema, foaieNouaSchema, trimiteFoaieSchema } from "./fleet";

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
