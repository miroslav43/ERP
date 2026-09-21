// src/schemas/per-diem.test.ts
import { describe, expect, it } from "vitest";

import { deplasareNouaSchema, etapaNouaSchema } from "./per-diem";

const RO = "11111111-1111-4111-8111-111111111111";
const DE = "22222222-2222-4222-8222-222222222222";

const DEPLASARE = {
  employee_id: null,
  scop: "Instruire",
  country_id: DE,
  localitate: "Berlin",
  plecare_la: "2026-09-28T15:00",
  sosire_la: "2026-10-01T21:00",
  mijloc_transport: "avion",
  km_parcursi: null,
  avans_acordat: 0,
  moneda_avans: null,
  curs_diurna: null,
  observatii: null,
  detasare_transnationala: false,
  stat_gazda_country_id: null,
  salariu_minim_stat_gazda: null,
  moneda_salariu_minim: null,
};

describe("ora deplasării e ora României", () => {
  it("15:00 tastat pleacă spre bază ca 12:00 UTC (ora de vară)", () => {
    const rezultat = deplasareNouaSchema.parse(DEPLASARE);
    expect(rezultat.plecare_la).toBe("2026-09-28T12:00:00.000Z");
    expect(rezultat.sosire_la).toBe("2026-10-01T18:00:00.000Z");
  });

  it("câmp gol: mesaj în română, pe câmp", () => {
    const rezultat = deplasareNouaSchema.safeParse({ ...DEPLASARE, plecare_la: "" });
    expect(rezultat.success).toBe(false);
    const problema = rezultat.error?.issues.find((i) => i.path[0] === "plecare_la");
    expect(problema?.message).toBe("Completați data și ora plecării.");
  });

  it("zi inexistentă: spune ce e în neregulă", () => {
    const rezultat = deplasareNouaSchema.safeParse({ ...DEPLASARE, sosire_la: "2026-02-30T10:00" });
    const problema = rezultat.error?.issues.find((i) => i.path[0] === "sosire_la");
    expect(problema?.message).toMatch(/Data și ora sosirii nu sunt complete sau nu există/u);
  });

  it("sosirea înaintea plecării: eroarea stă pe sosire", () => {
    const rezultat = deplasareNouaSchema.safeParse({ ...DEPLASARE, sosire_la: "2026-09-28T14:00" });
    const problema = rezultat.error?.issues.find((i) => i.path[0] === "sosire_la");
    expect(problema).toBeDefined();
  });

  it("etapa: la fel, ora României", () => {
    const rezultat = etapaNouaSchema.parse({
      business_trip_id: "44444444-4444-4444-8444-444444444444",
      from_country_id: RO,
      to_country_id: DE,
      plecare_la: "2026-09-29T08:30",
      sosire_la: "2026-09-30T17:00",
      mijloc_transport: null,
      localitate_sosire: null,
    });
    expect(rezultat.plecare_la).toBe("2026-09-29T05:30:00.000Z");
  });
});
