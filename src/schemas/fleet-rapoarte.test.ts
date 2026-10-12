// src/schemas/fleet-rapoarte.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { filtreRaportSchema } from "./fleet-rapoarte";

const V1 = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-12T09:00:00+03:00"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("filtreRaportSchema", () => {
  it("fără parametri: luna curentă din România, toate vehiculele", () => {
    expect(filtreRaportSchema.parse({})).toEqual({ luna: "2026-10", vehicul: null });
  });

  it("luna și vehiculul valide trec neschimbate", () => {
    expect(filtreRaportSchema.parse({ luna: "2026-09", vehicul: V1 })).toEqual({
      luna: "2026-09",
      vehicul: V1,
    });
  });

  it.each(["2026-13", "septembrie", "2026-9", "1999-01", ""])(
    "luna „%s” cade pe luna curentă, nu pe o eroare",
    (luna) => {
      expect(filtreRaportSchema.parse({ luna, vehicul: V1 })).toEqual({
        luna: "2026-10",
        vehicul: V1,
      });
    },
  );

  it("un vehicul care nu e UUID înseamnă toată flota, iar luna bună rămâne", () => {
    expect(filtreRaportSchema.parse({ luna: "2026-09", vehicul: "B100ABC" })).toEqual({
      luna: "2026-09",
      vehicul: null,
    });
  });

  it("un parametru repetat (?luna=a&luna=b) nu strică pagina", () => {
    expect(filtreRaportSchema.parse({ luna: ["2026-09", "2026-08"] })).toEqual({
      luna: "2026-10",
      vehicul: null,
    });
  });

  it("la miezul nopții dintre 30 sept și 1 oct (ora României), luna e cea locală", () => {
    vi.setSystemTime(new Date("2026-09-30T21:30:00Z")); // 00:30 pe 1 octombrie în România
    expect(filtreRaportSchema.parse({}).luna).toBe("2026-10");
  });
});
