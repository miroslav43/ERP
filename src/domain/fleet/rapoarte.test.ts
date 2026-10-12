// src/domain/fleet/rapoarte.test.ts
import { describe, expect, it } from "vitest";

import {
  consumPeVehicul,
  costPeVehicul,
  etichetaLuna,
  intervalLuna,
  kmPeSofer,
  lunaDinZi,
  lunaMutata,
  lunaValida,
  registruFoi,
  totaluriCost,
  totaluriLuna,
  type FoaieRaport,
} from "./rapoarte";

const V1 = "11111111-1111-4111-8111-111111111111";
const V2 = "22222222-2222-4222-8222-222222222222";
const S1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const S2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const foaie = (id: string, m: Partial<FoaieRaport> = {}): FoaieRaport => ({
  id,
  vehicle_id: V1,
  employee_id: S1,
  numar: null,
  data: "2026-09-02",
  km_parcursi: 100,
  vehicul_nr: "B100ABC",
  vehicul_combustibil: "diesel",
  norma_l_100km: 7,
  alimentari: [],
  ...m,
});

const VEHICULE = new Map([
  [V1, "B100ABC"],
  [V2, "CJ200XYZ"],
]);
const SOFERI = new Map([
  [S1, "Popescu Ion"],
  [S2, "Ana Maria"],
]);

describe("luna cerută", () => {
  it.each(["2026-09", "2000-01", "2199-12"])("%s e o lună validă", (luna) => {
    expect(lunaValida(luna)).toBe(true);
  });

  it.each(["2026-9", "2026-13", "2026-00", "1999-12", "2200-01", "septembrie", "2026-09-01", ""])(
    "„%s” nu e o lună validă",
    (luna) => {
      expect(lunaValida(luna)).toBe(false);
    },
  );

  it("valori care nu sunt text nu trec", () => {
    expect(lunaValida(null)).toBe(false);
    expect(lunaValida(undefined)).toBe(false);
    expect(lunaValida(202609)).toBe(false);
  });

  it("intervalul lunii: prima și ultima zi, cu februarie bisect", () => {
    expect(intervalLuna("2026-09")).toEqual({ deLa: "2026-09-01", panaLa: "2026-09-30" });
    expect(intervalLuna("2026-02")).toEqual({ deLa: "2026-02-01", panaLa: "2026-02-28" });
    expect(intervalLuna("2028-02")).toEqual({ deLa: "2028-02-01", panaLa: "2028-02-29" });
    expect(intervalLuna("2026-12")).toEqual({ deLa: "2026-12-01", panaLa: "2026-12-31" });
  });

  it("luna unei zile și mutarea peste hotarul anului", () => {
    expect(lunaDinZi("2026-09-15")).toBe("2026-09");
    expect(lunaMutata("2026-01", -1)).toBe("2025-12");
    expect(lunaMutata("2026-12", 1)).toBe("2027-01");
    expect(lunaMutata("2026-09", 0)).toBe("2026-09");
  });

  it("eticheta lunii, în română", () => {
    expect(etichetaLuna("2026-09")).toBe("septembrie 2026");
    expect(etichetaLuna("2026-03")).toBe("martie 2026");
  });
});

describe("consumPeVehicul", () => {
  it("adună kilometrii și litrii, compară consumul real cu norma", () => {
    const foi = [
      foaie("f1", { km_parcursi: 400, alimentari: [{ litri: 30, cost: 220 }] }),
      foaie("f2", {
        km_parcursi: 600,
        alimentari: [
          { litri: 40, cost: 290.4 },
          { litri: 20, cost: 150 },
        ],
      }),
    ];
    const [rand] = consumPeVehicul(foi, VEHICULE);
    expect(rand).toMatchObject({
      vehicleId: V1,
      vehicul: "B100ABC",
      foi: 2,
      km: 1000,
      litri: 90,
      costCombustibil: 660.4,
      unitate: "l",
      normaMedie: 7,
      foiFaraNorma: 0,
    });
    expect(rand?.consumReal).toBeCloseTo(9, 5);
    expect(rand?.abatere).toBeCloseTo(28.571, 2);
  });

  it("norma medie e ponderată cu kilometrii, nu o medie de medii", () => {
    const foi = [
      foaie("f1", { km_parcursi: 100, norma_l_100km: 6 }),
      foaie("f2", { km_parcursi: 300, norma_l_100km: 8 }),
    ];
    expect(consumPeVehicul(foi, VEHICULE)[0]?.normaMedie).toBe(7.5);
  });

  it("o foaie fără normă: nicio normă pe vehicul, nicio abatere, iar lipsa se numără", () => {
    const foi = [
      foaie("f1", { km_parcursi: 100, norma_l_100km: 6, alimentari: [{ litri: 7, cost: 50 }] }),
      foaie("f2", { km_parcursi: 100, norma_l_100km: null, alimentari: [{ litri: 7, cost: 50 }] }),
    ];
    const [rand] = consumPeVehicul(foi, VEHICULE);
    expect(rand?.normaMedie).toBeNull();
    expect(rand?.abatere).toBeNull();
    expect(rand?.foiFaraNorma).toBe(1);
    // Consumul real rămâne: e al ambelor foi.
    expect(rand?.consumReal).toBeCloseTo(7, 5);
  });

  it("fără litri sau fără kilometri nu există consum real — null, nu 0", () => {
    const faraLitri = consumPeVehicul([foaie("f1", { km_parcursi: 100 })], VEHICULE)[0];
    expect(faraLitri?.consumReal).toBeNull();
    expect(faraLitri?.abatere).toBeNull();
    const faraKm = consumPeVehicul(
      [foaie("f1", { km_parcursi: null, alimentari: [{ litri: 10, cost: 70 }] })],
      VEHICULE,
    )[0];
    expect(faraKm?.km).toBe(0);
    expect(faraKm?.consumReal).toBeNull();
  });

  it("vehiculul electric se măsoară în kWh", () => {
    const [rand] = consumPeVehicul(
      [foaie("f1", { vehicul_combustibil: "electric", km_parcursi: 100 })],
      VEHICULE,
    );
    expect(rand?.unitate).toBe("kWh");
  });

  it("litrii se adună exact la ban, fără 0,30000000000000004", () => {
    const [rand] = consumPeVehicul(
      [
        foaie("f1", {
          alimentari: [
            { litri: 0.1, cost: 0.1 },
            { litri: 0.2, cost: 0.2 },
          ],
        }),
      ],
      VEHICULE,
    );
    expect(rand?.litri).toBe(0.3);
    expect(rand?.costCombustibil).toBe(0.3);
  });

  it("un rând pe vehicul, în ordinea numărului de înmatriculare; eticheta lipsă cade pe instantaneu", () => {
    const foi = [
      foaie("f1", { vehicle_id: V2 }),
      foaie("f2", { vehicle_id: V1 }),
      foaie("f3", { vehicle_id: "33333333-3333-4333-8333-333333333333", vehicul_nr: "AA001ZZ" }),
      foaie("f4", {
        vehicle_id: "44444444-4444-4444-8444-444444444444",
        vehicul_nr: null,
      }),
    ];
    const randuri = consumPeVehicul(foi, VEHICULE);
    expect(randuri.map((r) => r.vehicul)).toEqual([
      "AA001ZZ",
      "B100ABC",
      "CJ200XYZ",
      "Vehicul șters",
    ]);
  });

  it("nicio foaie, niciun rând", () => {
    expect(consumPeVehicul([], VEHICULE)).toEqual([]);
  });
});

describe("kmPeSofer", () => {
  it("același șofer pe două vehicule în aceeași zi: două foi, o zi, doi vehicule", () => {
    const foi = [
      foaie("f1", { vehicle_id: V1, km_parcursi: 120 }),
      foaie("f2", { vehicle_id: V2, km_parcursi: 80 }),
      foaie("f3", { vehicle_id: V1, data: "2026-09-03", km_parcursi: 50 }),
    ];
    const [rand] = kmPeSofer(foi, SOFERI);
    expect(rand).toMatchObject({
      employeeId: S1,
      sofer: "Popescu Ion",
      foi: 3,
      zile: 2,
      vehicule: 2,
      km: 250,
    });
  });

  it("cei mai mulți kilometri întâi; la egalitate, ordinea alfabetică", () => {
    const foi = [
      foaie("f1", { employee_id: S1, km_parcursi: 50 }),
      foaie("f2", { employee_id: S2, km_parcursi: 200 }),
    ];
    expect(kmPeSofer(foi, SOFERI).map((r) => r.sofer)).toEqual(["Ana Maria", "Popescu Ion"]);
    const egal = [
      foaie("f1", { employee_id: S1, km_parcursi: 100 }),
      foaie("f2", { employee_id: S2, km_parcursi: 100 }),
    ];
    expect(kmPeSofer(egal, SOFERI).map((r) => r.sofer)).toEqual(["Ana Maria", "Popescu Ion"]);
  });

  it("foaia fără șofer și șoferul care nu se mai vede au rânduri proprii, nu dispar", () => {
    const foi = [
      foaie("f1", { employee_id: null, km_parcursi: 30 }),
      foaie("f2", { employee_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", km_parcursi: 20 }),
    ];
    const randuri = kmPeSofer(foi, SOFERI);
    expect(randuri.map((r) => [r.sofer, r.km])).toEqual([
      ["Fără șofer", 30],
      ["Șofer necunoscut", 20],
    ]);
    expect(randuri[0]?.employeeId).toBeNull();
  });

});

describe("costPeVehicul", () => {
  const foi = [
    foaie("f1", { km_parcursi: 400, alimentari: [{ litri: 30, cost: 220 }] }),
    foaie("f2", {
      km_parcursi: 600,
      alimentari: [
        { litri: 40, cost: 290.4 },
        { litri: 20, cost: 150 },
      ],
    }),
  ];

  it("cele patru surse se adună o singură dată, iar costul pe km vine din foile aprobate", () => {
    const [rand] = costPeVehicul(
      {
        foi,
        servicii: [
          { vehicle_id: V1, cost_total: 450 },
          { vehicle_id: V1, cost_total: 300 },
        ],
        cheltuieli: [
          { vehicle_id: V1, suma: 300.5 },
          { vehicle_id: V1, suma: 35 },
        ],
        documente: [
          { vehicle_id: V1, cost: 1800 },
          { vehicle_id: V1, cost: 200.5 },
          { vehicle_id: V1, cost: null },
        ],
      },
      VEHICULE,
    );
    expect(rand).toMatchObject({
      vehicleId: V1,
      vehicul: "B100ABC",
      foi: 2,
      service: 750,
      cheltuieli: 335.5,
      documente: 2000.5,
      combustibilFoi: 660.4,
      total: 3746.4,
      km: 1000,
      costPeKm: 3.75,
    });
  });

  it("vehiculul fără foi aprobate are costuri, dar nu are lei/km — null, nu 0", () => {
    const [rand] = costPeVehicul(
      {
        foi: [],
        servicii: [],
        cheltuieli: [{ vehicle_id: V2, suma: 15 }],
        documente: [],
      },
      VEHICULE,
    );
    expect(rand).toMatchObject({ vehicleId: V2, total: 15, km: 0, costPeKm: null, foi: 0 });
  });

  it("cele mai costisitoare vehicule întâi; la sume egale, după număr", () => {
    const randuri = costPeVehicul(
      {
        foi: [],
        servicii: [
          { vehicle_id: V1, cost_total: 100 },
          { vehicle_id: V2, cost_total: 100 },
        ],
        cheltuieli: [{ vehicle_id: "33333333-3333-4333-8333-333333333333", suma: 500 }],
        documente: [],
      },
      VEHICULE,
    );
    expect(randuri.map((r) => r.vehicul)).toEqual(["Vehicul șters", "B100ABC", "CJ200XYZ"]);
  });

  it("totalurile coloanelor se adună exact, iar lei/km total folosește kilometrii tuturor", () => {
    const randuri = costPeVehicul(
      {
        foi: [
          ...foi,
          foaie("f3", {
            vehicle_id: V2,
            km_parcursi: 500,
            alimentari: [{ litri: 40, cost: 300 }],
          }),
        ],
        servicii: [{ vehicle_id: V2, cost_total: 200 }],
        cheltuieli: [],
        documente: [],
      },
      VEHICULE,
    );
    const total = totaluriCost(randuri);
    expect(total).toMatchObject({
      service: 200,
      cheltuieli: 0,
      documente: 0,
      combustibilFoi: 960.4,
      total: 1160.4,
      km: 1500,
      foi: 3,
    });
    expect(total.costPeKm).toBe(0.77);
  });

  it("fără niciun rând, totalurile sunt zero iar lei/km lipsește", () => {
    expect(totaluriCost([])).toEqual({
      service: 0,
      cheltuieli: 0,
      documente: 0,
      combustibilFoi: 0,
      total: 0,
      km: 0,
      foi: 0,
      costPeKm: null,
    });
  });
});

describe("totaluriLuna", () => {
  it("foi, kilometri, litri și cost de combustibil pe toată flota", () => {
    const t = totaluriLuna([
      foaie("f1", { km_parcursi: 400, alimentari: [{ litri: 30, cost: 220 }] }),
      foaie("f2", {
        vehicle_id: V2,
        km_parcursi: null,
        alimentari: [{ litri: 10.5, cost: 70.25 }],
      }),
    ]);
    expect(t).toEqual({ foi: 2, km: 400, litri: 40.5, costCombustibil: 290.25 });
  });
});

describe("registruFoi", () => {
  it("o foaie pe rând, în ordinea zilei și a numărului, cu vehiculul și șoferul pe nume", () => {
    const randuri = registruFoi(
      [
        foaie("f2", {
          numar: "FP-2026-0002",
          data: "2026-09-04",
          km_parcursi: 200,
          alimentari: [{ litri: 20, cost: 140 }],
        }),
        foaie("f1", { numar: "FP-2026-0001", data: "2026-09-02", employee_id: S2 }),
        foaie("f3", { numar: null, data: "2026-09-02", vehicle_id: V2 }),
      ],
      VEHICULE,
      SOFERI,
    );
    expect(randuri.map((r) => r.id)).toEqual(["f1", "f3", "f2"]);
    expect(randuri[0]).toMatchObject({
      numar: "FP-2026-0001",
      vehicul: "B100ABC",
      sofer: "Ana Maria",
    });
    expect(randuri[2]).toMatchObject({
      numar: "FP-2026-0002",
      km: 200,
      litri: 20,
      costCombustibil: 140,
      norma: 7,
    });
    expect(randuri[2]?.consumReal).toBeCloseTo(10, 5);
    expect(randuri.map((r) => r.unitate)).toEqual(["l", "l", "l"]);
  });

  it("foaia vehiculului electric spune kWh pe rândul ei", () => {
    const [rand] = registruFoi([foaie("f1", { vehicul_combustibil: "electric" })], VEHICULE, SOFERI);
    expect(rand?.unitate).toBe("kWh");
  });
});
