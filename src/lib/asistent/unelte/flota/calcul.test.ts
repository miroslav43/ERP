// src/lib/asistent/unelte/flota/calcul.test.ts
/**
 * Deciziile pure ale uneltelor de flotă. `alegeSoferul` e documentația în
 * TypeScript a lui `app.sofer_la` (0206): la o divergență câștigă baza.
 */
import { describe, expect, it } from "vitest";

import { consumPeVehicul, type FoaieRaport } from "@/domain/fleet/rapoarte";
import { momentDinOraRomaniei } from "@/lib/format/date";

import {
  alegeSoferul,
  clasificaVehiculeFaraFoi,
  cuNormaDeRezerva,
  frazaFaraSofer,
  limiteleZilei,
  ordoneazaScadente,
  type AlocareZi,
  type CursaZi,
  type FoaieZi,
  type IntrareSofer,
} from "./calcul";

const ZI = "2026-10-21";
const la = (ora: string, zi = ZI): string => {
  const m = momentDinOraRomaniei(`${zi}T${ora}`);
  if (m === null) throw new Error(`oră nevalidă ${ora}`);
  return m;
};

const foaie = (partial: Partial<FoaieZi> = {}): FoaieZi => ({
  id: "foaie-1",
  employee_id: "ana",
  numar: "FP-2026-0042",
  data: ZI,
  status: "trimis",
  ...partial,
});
const cursa = (partial: Partial<CursaZi> = {}): CursaZi => ({
  trip_sheet_id: "foaie-1",
  plecare_la: la("09:10"),
  sosire_la: la("11:30"),
  ...partial,
});
const alocare = (partial: Partial<AlocareZi> = {}): AlocareZi => ({
  employee_id: "bogdan",
  de_la: la("08:00", "2026-10-01"),
  pana_la: null,
  ...partial,
});
const intrare = (partial: Partial<IntrareSofer> = {}): IntrareSofer => ({
  ziua: ZI,
  moment: la("10:00"),
  foi: [],
  curse: [],
  alocari: [],
  pool: false,
  ...partial,
});

describe("alegeSoferul — la un moment dat, în ordinea lui app.sofer_la", () => {
  it("cursa care acoperă momentul dă șoferul foii", () => {
    const ales = alegeSoferul(intrare({ foi: [foaie()], curse: [cursa()], alocari: [alocare()] }));
    expect(ales.fel).toBe("cursa");
    expect(ales.fel === "cursa" ? ales.foaie.employee_id : null).toBe("ana");
  });

  it("cursa fără sosire ține până la sfârșitul zilei foii", () => {
    const ales = alegeSoferul(
      intrare({ moment: la("23:30"), foi: [foaie()], curse: [cursa({ sosire_la: null })] }),
    );
    expect(ales.fel).toBe("cursa");
  });

  it("o cursă de noapte de pe foaia de ieri acoperă dimineața de azi", () => {
    const ales = alegeSoferul(
      intrare({
        moment: la("01:00"),
        foi: [foaie({ id: "ieri", data: "2026-10-20", employee_id: "cristi" })],
        curse: [
          cursa({
            trip_sheet_id: "ieri",
            plecare_la: la("22:00", "2026-10-20"),
            sosire_la: la("02:00"),
          }),
        ],
      }),
    );
    expect(ales.fel === "cursa" ? ales.foaie.employee_id : ales.fel).toBe("cristi");
  });

  it("fără cursă potrivită, alocarea bate foaia zilei (ca baza)", () => {
    const ales = alegeSoferul(
      intrare({ moment: la("15:00"), foi: [foaie()], curse: [cursa()], alocari: [alocare()] }),
    );
    expect(ales.fel === "alocare" ? ales.alocare.employee_id : ales.fel).toBe("bogdan");
  });

  it("fără cursă potrivită și fără alocare, foaia zilei dă șoferul (extensia F12e)", () => {
    const ales = alegeSoferul(intrare({ moment: la("15:00"), foi: [foaie()], curse: [cursa()] }));
    expect(ales.fel === "foaie" ? ales.foaie.employee_id : ales.fel).toBe("ana");
  });

  it("fără foaie, alocarea", () => {
    expect(alegeSoferul(intrare({ alocari: [alocare()] })).fel).toBe("alocare");
  });

  it("o alocare închisă înainte de moment nu mai contează", () => {
    const ales = alegeSoferul(intrare({ alocari: [alocare({ pana_la: la("09:00") })] }));
    expect(ales.fel).toBe("nimic");
  });

  it("capătul alocării e exclus: predată la 10:00, nu mai e a lui la 10:00", () => {
    const ales = alegeSoferul(
      intrare({
        alocari: [
          alocare({ pana_la: la("10:00") }),
          alocare({ employee_id: "dana", de_la: la("10:00"), pana_la: null }),
        ],
      }),
    );
    expect(ales.fel === "alocare" ? ales.alocare.employee_id : ales.fel).toBe("dana");
  });

  it("o foaie respinsă se ignoră, cu cursele ei", () => {
    const ales = alegeSoferul(
      intrare({ foi: [foaie({ status: "respins" })], curse: [cursa()], pool: true }),
    );
    expect(ales.fel).toBe("pool");
  });

  it("mașina de pool fără foaie și fără alocare", () => {
    expect(alegeSoferul(intrare({ pool: true })).fel).toBe("pool");
    expect(alegeSoferul(intrare({ pool: false })).fel).toBe("nimic");
  });
});

describe("alegeSoferul — toată ziua (zi trecută, fără oră)", () => {
  it("o predare la prânz dă două nume, în ordinea orelor", () => {
    const ales = alegeSoferul(
      intrare({
        moment: null,
        alocari: [
          alocare({ employee_id: "dana", de_la: la("12:00"), pana_la: null }),
          alocare({ employee_id: "bogdan", pana_la: la("12:00") }),
        ],
      }),
    );
    expect(ales.fel).toBe("zi");
    expect(ales.fel === "zi" ? ales.alocari.map((a) => a.employee_id) : []).toEqual([
      "bogdan",
      "dana",
    ]);
  });

  it("alocările care nu ating ziua (în ora României) nu apar", () => {
    const ales = alegeSoferul(
      intrare({
        moment: null,
        alocari: [
          // Se încheie la 23:59 ora României în ziua de dinainte: 20:59 UTC.
          alocare({ employee_id: "ieri", pana_la: la("23:59", "2026-10-20") }),
          // Începe la 00:00 ora României a zilei următoare.
          alocare({ employee_id: "maine", de_la: la("00:00", "2026-10-22") }),
        ],
        pool: true,
      }),
    );
    expect(ales.fel).toBe("pool");
  });

  it("enumeră și foile zilei, fără cele respinse", () => {
    const ales = alegeSoferul(
      intrare({ moment: null, foi: [foaie(), foaie({ id: "r", status: "respins" })] }),
    );
    expect(ales.fel === "zi" ? ales.foi.map((f) => f.id) : []).toEqual(["foaie-1"]);
  });
});

describe("fraza fără șofer", () => {
  it("sub vizibilitate parțială, nu afirmă „fără foaie” sau „nealocată”", () => {
    for (const fel of ["pool", "nimic"] as const) {
      const fraza = frazaFaraSofer(fel, false);
      expect(fraza).toContain("dintre cele pe care le poți vedea");
      expect(fraza).not.toContain("nu e alocată nimănui");
      expect(fraza).not.toContain("fără foaie în ziua aceea");
    }
  });

  it("cu vizibilitate completă, spune direct", () => {
    expect(frazaFaraSofer("nimic", true)).toBe("nu e alocată nimănui");
    expect(frazaFaraSofer("pool", true)).toContain("fără foaie în ziua aceea");
  });
});

describe("limiteleZilei — ziua românească, în UTC", () => {
  it("o zi obișnuită de toamnă are 24 de ore, de la 21:00 UTC", () => {
    expect(limiteleZilei("2026-10-21")).toEqual({
      inceput: "2026-10-20T21:00:00.000Z",
      sfarsit: "2026-10-21T21:00:00.000Z",
    });
  });

  it("29 martie 2026 are 23 de ore (trecerea la ora de vară)", () => {
    expect(limiteleZilei("2026-03-29")).toEqual({
      inceput: "2026-03-28T22:00:00.000Z",
      sfarsit: "2026-03-29T21:00:00.000Z",
    });
  });

  it("25 octombrie 2026 are 25 de ore (întoarcerea la ora de iarnă)", () => {
    expect(limiteleZilei("2026-10-25")).toEqual({
      inceput: "2026-10-24T21:00:00.000Z",
      sfarsit: "2026-10-25T22:00:00.000Z",
    });
  });
});

const foaieRaport = (partial: Partial<FoaieRaport> = {}): FoaieRaport => ({
  id: "f",
  vehicle_id: "v1",
  employee_id: "ana",
  numar: "FP-1",
  data: "2026-09-10",
  km_parcursi: 100,
  vehicul_nr: "B123ABC",
  vehicul_combustibil: "motorina",
  norma_l_100km: 6,
  alimentari: [{ litri: 6, cost: 40 }],
  ...partial,
});
const etichete = new Map([["v1", "B123ABC"]]);

describe("consumul — formula rapoartelor F8, cu norma de rezervă", () => {
  it("norma se ponderează cu kilometrii: 100 km la 6 și 300 km la 8 dau 7,5", () => {
    const [rand] = consumPeVehicul(
      [
        foaieRaport({ id: "a", km_parcursi: 100, norma_l_100km: 6 }),
        foaieRaport({ id: "b", km_parcursi: 300, norma_l_100km: 8 }),
      ],
      etichete,
    );
    expect(rand?.normaMedie).toBe(7.5);
  });

  it("instantaneul de pe foaie nu se atinge; lipsa lui ia norma valabilă în ziua foii", () => {
    const { foi, cuRezerva } = cuNormaDeRezerva(
      [
        foaieRaport({ id: "a", norma_l_100km: 6 }),
        foaieRaport({ id: "b", data: "2026-09-20", norma_l_100km: null }),
      ],
      new Map([
        [
          "v1",
          [
            { valabil_de_la: "2026-01-01", l_100km: 7 },
            { valabil_de_la: "2026-09-15", l_100km: 9 },
          ],
        ],
      ]),
      new Map([["v1", 5]]),
    );
    expect(foi.map((f) => f.norma_l_100km)).toEqual([6, 9]);
    expect(cuRezerva).toBe(1);
  });

  it("fără normă proprie, consumul declarat al vehiculului", () => {
    const { foi } = cuNormaDeRezerva(
      [foaieRaport({ norma_l_100km: null })],
      new Map(),
      new Map([["v1", 6.5]]),
    );
    expect(foi[0]?.norma_l_100km).toBe(6.5);
  });

  it("fără nicio normă, abaterea nu se calculează, dar consumul real da", () => {
    const { foi, cuRezerva } = cuNormaDeRezerva(
      [foaieRaport({ id: "a", norma_l_100km: 6 }), foaieRaport({ id: "b", norma_l_100km: null })],
      new Map(),
      new Map([["v1", null]]),
    );
    expect(cuRezerva).toBe(0);
    const [rand] = consumPeVehicul(foi, etichete);
    expect(rand?.normaMedie).toBeNull();
    expect(rand?.abatere).toBeNull();
    expect(rand?.consumReal).toBe(6);
    expect(rand?.foiFaraNorma).toBe(1);
  });

  it("zero kilometri dau `null`, nu `Infinity`", () => {
    const [rand] = consumPeVehicul([foaieRaport({ km_parcursi: 0 })], etichete);
    expect(rand?.consumReal).toBeNull();
  });
});

describe("clasificaVehiculeFaraFoi", () => {
  const v = (id: string, achizitie: string | null = null, iesire: string | null = null) => ({
    id,
    data_achizitie: achizitie,
    data_iesire: iesire,
  });
  const DE_LA = "2026-09-01";
  const PANA_LA = "2026-09-30";

  it("cele trei clase", () => {
    const clase = clasificaVehiculeFaraFoi(
      [v("nimic"), v("ciorne"), v("trimis"), v("aprobat")],
      [
        { vehicle_id: "ciorne", status: "draft" },
        { vehicle_id: "ciorne", status: "respins" },
        { vehicle_id: "trimis", status: "draft" },
        { vehicle_id: "trimis", status: "trimis" },
        { vehicle_id: "aprobat", status: "aprobat" },
      ],
      DE_LA,
      PANA_LA,
    );
    expect(Object.fromEntries(clase)).toEqual({
      nimic: "nicio_foaie",
      ciorne: "doar_ciorne",
      trimis: "cu_foi",
      aprobat: "cu_foi",
    });
  });

  it("vehiculul ieșit din parc înainte de lună sau intrat după ea nu apare", () => {
    const clase = clasificaVehiculeFaraFoi(
      [
        v("iesit", null, "2026-08-31"),
        v("intrat-dupa", "2026-10-01"),
        v("iesit-in-luna", null, "2026-09-01"),
        v("intrat-in-luna", "2026-09-30"),
      ],
      [],
      DE_LA,
      PANA_LA,
    );
    expect([...clase.keys()].sort()).toEqual(["iesit-in-luna", "intrat-in-luna"]);
  });

  it("o foaie a unui vehicul din afara parcului nu creează un rând", () => {
    const clase = clasificaVehiculeFaraFoi(
      [],
      [{ vehicle_id: "x", status: "aprobat" }],
      DE_LA,
      PANA_LA,
    );
    expect(clase.size).toBe(0);
  });
});

describe("ordoneazaScadente", () => {
  it("întâi ce a trecut, apoi ce lipsește, apoi ce urmează, fiecare după dată", () => {
    const azi = "2026-10-22";
    const ordine = ordoneazaScadente(
      [
        { vehicleId: "a", ce: "ITP", data: "2026-11-10" },
        { vehicleId: "b", ce: "Rovinietă", data: null },
        { vehicleId: "c", ce: "RCA", data: "2026-10-01" },
        { vehicleId: "d", ce: "Revizie", data: null, kmRamasi: -200 },
        { vehicleId: "e", ce: "CASCO", data: "2026-10-25" },
      ],
      azi,
    );
    expect(ordine.map((s) => s.vehicleId)).toEqual(["c", "d", "b", "e", "a"]);
  });
});
