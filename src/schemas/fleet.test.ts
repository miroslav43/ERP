// src/schemas/fleet.test.ts
import { describe, expect, it } from "vitest";

import { alimentareSchema, cursaSchema, foaieNouaSchema, trimiteFoaieSchema } from "./fleet";

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

describe("foaia zilnică (0197)", () => {
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
