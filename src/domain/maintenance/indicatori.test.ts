// src/domain/maintenance/indicatori.test.ts
import { describe, expect, it } from "vitest";

import {
  MAXIM_ZILE_PERIOADA,
  PRAG_COST_VALOARE_INLOCUIRE,
  calculeazaRaport,
  citiriRestante,
  contoareCuPlan,
  fereastraCitire,
  formatOreIndicator,
  formatOreProgram,
  formatProcent,
  imparte,
  normalizeazaPerioada,
  oreOprireInProgram,
  perioadaImplicita,
  zileDeProgram,
  type IntrareRaport,
} from "./indicatori";

const P = { deLa: "2026-09-01", panaLa: "2026-09-30" } as const;
const PROGRAM = { orePeZi: 8, zilePeSaptamana: 5, costOraOprire: 100 } as const;

function intrare(peste: Partial<IntrareRaport> = {}): IntrareRaport {
  return {
    perioada: P,
    azi: "2026-10-12",
    acum: "2026-10-12T09:00:00Z",
    program: PROGRAM,
    echipamente: [
      {
        id: "e1",
        cod: "E1",
        denumire: "Compresor",
        valoare_achizitie: 10_000,
        casat_la: null,
        data_punerii_in_functiune: null,
      },
      {
        id: "e2",
        cod: "E2",
        denumire: "Strung",
        valoare_achizitie: null,
        casat_la: null,
        data_punerii_in_functiune: null,
      },
    ],
    interventii: [],
    executiiPlanuri: [],
    planuri: [],
    sesizari: [],
    opriri: [],
    ...peste,
  };
}

const interventie = (
  id: string,
  equipment_id: string,
  data: string,
  cost: number,
  extra: Partial<IntrareRaport["interventii"][number]> = {},
): IntrareRaport["interventii"][number] => ({
  id,
  equipment_id,
  data,
  tip: "corectiva",
  rezultat: "reusita",
  cost_total: cost,
  acoperit_de_garantie: false,
  executant_extern: null,
  plan_id: null,
  ...extra,
});

describe("împărțirea fără numitor zero", () => {
  it("numitor 0, negativ sau NaN dă null, nu Infinity", () => {
    expect(imparte(5, 0)).toBeNull();
    expect(imparte(5, -1)).toBeNull();
    expect(imparte(Number.NaN, 2)).toBeNull();
    expect(imparte(3, 4)).toBe(0.75);
  });

  it("formatările scriu „—” la null", () => {
    expect(formatProcent(null)).toBe("—");
    expect(formatOreIndicator(null)).toBe("—");
    expect(formatProcent(0.875)).toBe("87,5 %");
    expect(formatOreIndicator(3.25)).toBe("3,3 h");
    expect(formatOreIndicator(72)).toBe("3 zile");
  });

  // Revizia M8: orele de PROGRAM nu sunt zile calendaristice — 352 h de program
  // sunt 44 de zile de lucru de câte 8 h, nu „14,7 zile”.
  it("orele de program rămân în ore", () => {
    expect(formatOreProgram(null)).toBe("—");
    expect(formatOreProgram(352)).toBe("352 h");
    expect(formatOreProgram(171.25)).toBe("171,3 h");
  });
});

describe("perioada", () => {
  it("implicit: ultimele 12 luni, cu azi inclus", () => {
    expect(perioadaImplicita("2026-10-12")).toEqual({ deLa: "2025-10-13", panaLa: "2026-10-12" });
  });

  it("capetele inversate se schimbă între ele, cu avertisment", () => {
    const r = normalizeazaPerioada("2026-09-30", "2026-09-01", "2026-10-12");
    expect(r.perioada).toEqual(P);
    expect(r.avertisment).not.toBeNull();
  });

  it("viitorul se taie la azi; peste maxim se scurtează de la început", () => {
    expect(normalizeazaPerioada("2026-10-01", "2026-12-31", "2026-10-12").perioada).toEqual({
      deLa: "2026-10-01",
      panaLa: "2026-10-12",
    });
    const lunga = normalizeazaPerioada("2020-01-01", "2026-10-12", "2026-10-12");
    expect(lunga.avertisment).not.toBeNull();
    const zile =
      (Date.parse(`${lunga.perioada.panaLa}T00:00:00Z`) -
        Date.parse(`${lunga.perioada.deLa}T00:00:00Z`)) /
        86_400_000 +
      1;
    expect(zile).toBe(MAXIM_ZILE_PERIOADA);
  });

  it("lipsă = implicit, fără avertisment", () => {
    expect(normalizeazaPerioada(null, null, "2026-10-12")).toEqual({
      perioada: perioadaImplicita("2026-10-12"),
      avertisment: null,
    });
  });

  it("fereastra de citire acoperă 30 de zile înainte și ultimele 12 luni", () => {
    expect(fereastraCitire(P)).toEqual({ deLa: "2025-10-01", panaLa: "2026-09-30" });
    expect(fereastraCitire({ deLa: "2024-01-01", panaLa: "2026-09-30" }).deLa).toBe("2023-12-02");
  });

  it("zilele de program: luni–vineri la 5 zile pe săptămână", () => {
    // Septembrie 2026: 30 de zile, 22 lucrătoare (1 sept = marți).
    expect(zileDeProgram(P, 5)).toBe(22);
    expect(zileDeProgram(P, 7)).toBe(30);
  });
});

describe("orele de oprire în program", () => {
  it("o oprire de trei zile lucrătoare numără 3 × 8 ore, nu 72", () => {
    // Marți 8 sept 06:00 → vineri 11 sept 06:00 ora României (UTC+3).
    const ore = oreOprireInProgram(
      { inceput: "2026-09-08T03:00:00Z", sfarsit: "2026-09-11T03:00:00Z" },
      P,
      PROGRAM,
      "2026-10-12T09:00:00Z",
    );
    // Marți 18 h → 8, miercuri 8, joi 8, vineri 6 h → 6.
    expect(ore).toBe(30);
  });

  it("weekendul nu se numără; oprirea deschisă se oprește la capătul perioadei", () => {
    const ore = oreOprireInProgram(
      { inceput: "2026-09-26T07:00:00Z", sfarsit: null },
      P,
      PROGRAM,
      "2026-10-12T09:00:00Z",
    );
    // Sâmbătă 26, duminică 27: zero; luni 28, marți 29, miercuri 30: 3 × 8.
    expect(ore).toBe(24);
  });

  it("o oprire în afara perioadei dă zero", () => {
    expect(
      oreOprireInProgram(
        { inceput: "2026-08-01T07:00:00Z", sfarsit: "2026-08-02T07:00:00Z" },
        P,
        PROGRAM,
        "2026-10-12T09:00:00Z",
      ),
    ).toBe(0);
  });
});

describe("calculeazaRaport — costuri", () => {
  it("defalcă preventiv/corectiv/legal, intern/extern și scoate garanția din costul suportat", () => {
    const r = calculeazaRaport(
      intrare({
        interventii: [
          interventie("i1", "e1", "2026-09-05", 100, { tip: "preventiva" }),
          interventie("i2", "e1", "2026-09-06", 50, {
            tip: "predictiva",
            executant_extern: "Service SRL",
          }),
          interventie("i3", "e1", "2026-09-07", 200, { tip: "corectiva" }),
          interventie("i4", "e1", "2026-09-08", 30, {
            tip: "verificare_legala",
            executant_extern: "ISCIR",
          }),
          interventie("i5", "e1", "2026-09-09", 999, { acoperit_de_garantie: true }),
          // În afara perioadei: nu intră în cost, intră în cele 12 luni.
          interventie("i6", "e1", "2026-03-01", 3_620),
        ],
      }),
    );
    const e1 = r.echipamente.find((e) => e.equipmentId === "e1");
    expect(e1?.costuri).toEqual({
      preventiv: 150,
      corectiv: 200,
      legal: 30,
      intern: 300,
      extern: 80,
      garantie: 999,
      suportat: 380,
    });
    expect(e1?.numarInterventii).toBe(5);
    expect(e1?.cost12Luni).toBe(4_000);
    expect(e1?.raportCostValoare).toBe(0.4);
    // Pragul e STRICT: 0,4 nu e încă semnal.
    expect(e1?.semnalInlocuire).toBe(false);
    expect(r.totaluri.costuri.suportat).toBe(380);
  });

  it("raportul cost/valoare e null fără valoare de achiziție; peste prag dă semnal", () => {
    const r = calculeazaRaport(
      intrare({
        interventii: [
          interventie("i1", "e1", "2026-09-05", 4_001),
          interventie("i2", "e2", "2026-09-05", 10),
        ],
      }),
    );
    const e1 = r.echipamente.find((e) => e.equipmentId === "e1");
    const e2 = r.echipamente.find((e) => e.equipmentId === "e2");
    expect(e1?.raportCostValoare).toBeGreaterThan(PRAG_COST_VALOARE_INLOCUIRE);
    expect(e1?.semnalInlocuire).toBe(true);
    expect(e2?.raportCostValoare).toBeNull();
    expect(e2?.semnalInlocuire).toBe(false);
    expect(r.semnaleInlocuire).toEqual(["e1"]);
  });

  it("Pareto după cost: top 10, cu procent și cumulat; fără cost nu intră", () => {
    const ids = Array.from({ length: 12 }, (_, i) => `x${String(i).padStart(2, "0")}`);
    const r = calculeazaRaport(
      intrare({
        interventii: ids.map((id, i) => interventie(`i${id}`, id, "2026-09-10", (12 - i) * 10)),
      }),
    );
    expect(r.paretoCost).toHaveLength(10);
    expect(r.paretoCost[0]).toMatchObject({ equipmentId: "x00", valoare: 120 });
    const total = ids.reduce((s, _, i) => s + (12 - i) * 10, 0);
    expect(r.paretoCost[0]?.procent).toBeCloseTo(120 / total);
    expect(r.paretoCost[1]?.cumulat).toBeCloseTo(230 / total);
    expect(r.echipamente.find((e) => e.equipmentId === "e2")).toBeDefined();
  });
});

describe("calculeazaRaport — sesizări", () => {
  const sesizare = (
    id: string,
    equipment_id: string,
    raportat_la: string,
    extra: Partial<IntrareRaport["sesizari"][number]> = {},
  ): IntrareRaport["sesizari"][number] => ({
    id,
    equipment_id,
    raportat_la,
    atribuit_la: null,
    rezolvat_la: null,
    status: "nou",
    ...extra,
  });

  it("respinsele și retrasele nu se numără; Pareto după sesizări", () => {
    const r = calculeazaRaport(
      intrare({
        sesizari: [
          sesizare("s1", "e1", "2026-09-02T08:00:00Z"),
          sesizare("s2", "e1", "2026-09-20T08:00:00Z"),
          sesizare("s3", "e2", "2026-09-03T08:00:00Z"),
          sesizare("s4", "e2", "2026-09-04T08:00:00Z", { status: "respins" }),
          sesizare("s5", "e2", "2026-09-05T08:00:00Z", { status: "retrasa" }),
        ],
      }),
    );
    expect(r.paretoSesizari.map((p) => [p.equipmentId, p.valoare])).toEqual([
      ["e1", 2],
      ["e2", 1],
    ]);
    expect(r.totaluri.sesizari).toBe(3);
  });

  it("timpul de atribuire și de rezolvare, în ore; null fără date", () => {
    const fara = calculeazaRaport(intrare());
    expect(fara.totaluri.timpAtribuireOre).toBeNull();
    expect(fara.totaluri.timpRezolvareOre).toBeNull();

    const r = calculeazaRaport(
      intrare({
        sesizari: [
          sesizare("s1", "e1", "2026-09-02T08:00:00Z", {
            atribuit_la: "2026-09-02T10:00:00Z",
            rezolvat_la: "2026-09-03T08:00:00Z",
            status: "rezolvat",
          }),
          sesizare("s2", "e1", "2026-09-10T08:00:00Z", {
            atribuit_la: "2026-09-10T12:00:00Z",
            rezolvat_la: "2026-09-10T20:00:00Z",
            status: "inchis",
          }),
        ],
      }),
    );
    expect(r.totaluri.timpAtribuireOre).toBe(3);
    expect(r.totaluri.timpRezolvareOre).toBe(18);
  });

  it("defectele repetate: altă sesizare pe același echipament în cele 30 de zile dinainte", () => {
    const r = calculeazaRaport(
      intrare({
        sesizari: [
          // Din fereastra extinsă, înaintea perioadei: face s1 repetată.
          sesizare("s0", "e1", "2026-08-20T08:00:00Z"),
          sesizare("s1", "e1", "2026-09-02T08:00:00Z"),
          // Respinsa nu face repetare.
          sesizare("sr", "e2", "2026-09-01T08:00:00Z", { status: "respins" }),
          sesizare("s2", "e2", "2026-09-15T08:00:00Z"),
          // La 31 de zile după s0 → nu e repetare față de s0, dar e față de s1.
          sesizare("s3", "e1", "2026-09-20T08:00:00Z"),
        ],
      }),
    );
    expect(r.totaluri.defecteRepetate).toEqual({ repetate: 2, total: 3, rata: 2 / 3 });
  });
});

describe("calculeazaRaport — opriri, disponibilitate, MTTR, MTBF", () => {
  it("disponibilitatea, MTTR din opririle neplanificate închise și costul opririlor", () => {
    const r = calculeazaRaport(
      intrare({
        opriri: [
          // Neplanificată, 4 h într-o zi lucrătoare.
          {
            id: "o1",
            equipment_id: "e1",
            inceput: "2026-09-08T06:00:00Z",
            sfarsit: "2026-09-08T10:00:00Z",
            tip: "neplanificata",
          },
          // Planificată, 2 h: intră în disponibilitate și cost, nu în MTTR.
          {
            id: "o2",
            equipment_id: "e1",
            inceput: "2026-09-09T06:00:00Z",
            sfarsit: "2026-09-09T08:00:00Z",
            tip: "planificata",
          },
        ],
      }),
    );
    const e1 = r.echipamente.find((e) => e.equipmentId === "e1");
    expect(e1?.oreProgram).toBe(22 * 8);
    expect(e1?.oreOprire).toBe(6);
    expect(e1?.disponibilitate).toBeCloseTo(1 - 6 / 176);
    expect(e1?.opririNeplanificate).toBe(1);
    expect(e1?.mtbfOre).toBe(176 - 4);
    expect(e1?.costOpriri).toBe(600);
    expect(r.totaluri.mttrOre).toBe(4);
    // Parcul: două echipamente, 352 de ore de program.
    expect(r.totaluri.disponibilitate).toBeCloseTo(1 - 6 / 352);
    expect(r.totaluri.mtbfOre).toBe(352 - 4);
    expect(r.totaluri.costOpriri).toBe(600);
  });

  it("fără opriri neplanificate: MTBF și MTTR sunt „—”, nu infinit", () => {
    const r = calculeazaRaport(intrare());
    expect(r.totaluri.mttrOre).toBeNull();
    expect(r.totaluri.mtbfOre).toBeNull();
    expect(r.echipamente.every((e) => e.mtbfOre === null)).toBe(true);
    expect(r.totaluri.disponibilitate).toBe(1);
  });

  it("fără cost al orei de oprire, costul opririlor e null", () => {
    const r = calculeazaRaport(
      intrare({
        program: { ...PROGRAM, costOraOprire: null },
        opriri: [
          {
            id: "o1",
            equipment_id: "e1",
            inceput: "2026-09-08T06:00:00Z",
            sfarsit: "2026-09-08T10:00:00Z",
            tip: "neplanificata",
          },
        ],
      }),
    );
    expect(r.totaluri.costOpriri).toBeNull();
    expect(r.echipamente[0]?.costOpriri).toBeNull();
  });

  it("echipamentul casat înainte de perioadă iese din parc; cel casat în perioadă numără până la casare", () => {
    const r = calculeazaRaport(
      intrare({
        echipamente: [
          {
            id: "e1",
            cod: "E1",
            denumire: "Vechi",
            valoare_achizitie: null,
            casat_la: "2026-08-01",
            data_punerii_in_functiune: null,
          },
          {
            id: "e2",
            cod: "E2",
            denumire: "Casat în 4 sept",
            valoare_achizitie: null,
            casat_la: "2026-09-04",
            data_punerii_in_functiune: null,
          },
          {
            id: "e3",
            cod: "E3",
            denumire: "Pus în funcțiune pe 28",
            valoare_achizitie: null,
            casat_la: null,
            data_punerii_in_functiune: "2026-09-28",
          },
        ],
      }),
    );
    expect(r.echipamente.find((e) => e.equipmentId === "e1")).toBeUndefined();
    // 1–4 sept: marți–vineri = 4 zile lucrătoare.
    expect(r.echipamente.find((e) => e.equipmentId === "e2")?.oreProgram).toBe(32);
    // 28–30 sept: luni–miercuri.
    expect(r.echipamente.find((e) => e.equipmentId === "e3")?.oreProgram).toBe(24);
  });

  // ── Revizia M8: opririle suprapuse și opririle din afara parcului ──
  it("două opriri suprapuse pe același echipament se numără o dată (sesizare duplicată)", () => {
    const r = calculeazaRaport(
      intrare({
        opriri: [
          // Marți 8 sept, 09:00–13:00 și 11:00–15:00 ora României: împreună 6 h, nu 8.
          {
            id: "o1",
            equipment_id: "e1",
            inceput: "2026-09-08T06:00:00Z",
            sfarsit: "2026-09-08T10:00:00Z",
            tip: "neplanificata",
          },
          {
            id: "o2",
            equipment_id: "e1",
            inceput: "2026-09-08T08:00:00Z",
            sfarsit: "2026-09-08T12:00:00Z",
            tip: "neplanificata",
          },
        ],
      }),
    );
    const e1 = r.echipamente.find((e) => e.equipmentId === "e1");
    expect(e1?.oreOprire).toBe(6);
    expect(e1?.opririNeplanificate).toBe(1);
    expect(r.totaluri.mttrOre).toBe(6);
  });

  it("două opriri în aceeași zi nu scad mai mult decât programul zilei", () => {
    const r = calculeazaRaport(
      intrare({
        opriri: [
          {
            id: "o1",
            equipment_id: "e1",
            inceput: "2026-09-08T03:00:00Z",
            sfarsit: "2026-09-08T09:00:00Z",
            tip: "neplanificata",
          },
          {
            id: "o2",
            equipment_id: "e1",
            inceput: "2026-09-08T12:00:00Z",
            sfarsit: "2026-09-08T18:00:00Z",
            tip: "planificata",
          },
        ],
      }),
    );
    expect(r.echipamente.find((e) => e.equipmentId === "e1")?.oreOprire).toBe(8);
  });

  it("oprirea rămasă deschisă după casare nu se numără după casare, iar cea din afara parcului nu intră în total", () => {
    const r = calculeazaRaport(
      intrare({
        echipamente: [
          {
            id: "e1",
            cod: "E1",
            denumire: "Casat înainte",
            valoare_achizitie: null,
            casat_la: "2026-08-01",
            data_punerii_in_functiune: null,
          },
          {
            id: "e2",
            cod: "E2",
            denumire: "Casat în 4 sept",
            valoare_achizitie: null,
            casat_la: "2026-09-04",
            data_punerii_in_functiune: null,
          },
        ],
        opriri: [
          {
            id: "o1",
            equipment_id: "e1",
            inceput: "2026-09-10T06:00:00Z",
            sfarsit: "2026-09-10T10:00:00Z",
            tip: "neplanificata",
          },
          // Joi 3 sept 09:00, deschisă: joi 8 h + vineri 8 h, apoi echipamentul e casat.
          {
            id: "o2",
            equipment_id: "e2",
            inceput: "2026-09-03T06:00:00Z",
            sfarsit: null,
            tip: "neplanificata",
          },
        ],
      }),
    );
    const e2 = r.echipamente.find((e) => e.equipmentId === "e2");
    expect(e2?.oreProgram).toBe(32);
    expect(e2?.oreOprire).toBe(16);
    expect(e2?.disponibilitate).toBeCloseTo(0.5);
    expect(r.totaluri.oreOprire).toBe(16);
    expect(r.totaluri.disponibilitate).toBeCloseTo(0.5);
  });
});

describe("calculeazaRaport — planuri", () => {
  const plan = (
    id: string,
    extra: Partial<IntrareRaport["planuri"][number]> = {},
  ): IntrareRaport["planuri"][number] => ({
    id,
    equipment_id: "e1",
    denumire: `Plan ${id}`,
    tip: "preventiva",
    activ: true,
    periodicitate_zile: 30,
    periodicitate_contor: null,
    numar_amanari: 0,
    urmatoarea_scadenta: "2026-11-01",
    tip_contor: null,
    urmatoarea_scadenta_contor: null,
    mod_calcul: "flotant",
    data_ancora: null,
    amanat_pana: null,
    ...extra,
  });

  it("execuția la timp se reconstituie din execuția precedentă + periodicitate", () => {
    const r = calculeazaRaport(
      intrare({
        planuri: [plan("p1"), plan("p2", { tip: "verificare_legala", periodicitate_zile: 10 })],
        executiiPlanuri: [
          { id: "a", plan_id: "p1", data: "2026-08-10", citire_contor: null },
          // 8 sept ≤ 10 aug + 30 = 9 sept → la timp.
          { id: "b", plan_id: "p1", data: "2026-09-08", citire_contor: null },
          { id: "c", plan_id: "p2", data: "2026-08-25", citire_contor: null },
          // 15 sept > 25 aug + 10 = 4 sept → 11 zile întârziere.
          { id: "d", plan_id: "p2", data: "2026-09-15", citire_contor: null },
          // Prima execuție a unui plan nu se poate judeca.
          { id: "e", plan_id: "p3", data: "2026-09-15", citire_contor: null },
        ],
      }),
    );
    expect(r.totaluri.planuriLaTimp).toEqual({ laTimp: 1, evaluate: 2, rata: 0.5, restante: 0 });
    expect(r.totaluri.legaleLaTimp).toEqual({ laTimp: 0, evaluate: 1, rata: 0, restante: 0 });
    expect(r.totaluri.zileDepasire).toMatchObject({ total: 11, maxim: 11, numar: 1 });
  });

  it("pe contor: întârziată dacă a trecut de pragul de la execuția precedentă", () => {
    const r = calculeazaRaport(
      intrare({
        planuri: [plan("p1", { periodicitate_zile: null, periodicitate_contor: 500 })],
        executiiPlanuri: [
          { id: "a", plan_id: "p1", data: "2026-07-01", citire_contor: 1_000 },
          { id: "b", plan_id: "p1", data: "2026-09-10", citire_contor: 1_620 },
        ],
      }),
    );
    expect(r.totaluri.planuriLaTimp).toEqual({ laTimp: 0, evaluate: 1, rata: 0, restante: 0 });
  });

  it("fără execuții evaluabile, procentul e „—”", () => {
    const r = calculeazaRaport(intrare({ planuri: [plan("p1")] }));
    expect(r.totaluri.planuriLaTimp.rata).toBeNull();
    expect(r.totaluri.legaleLaTimp.rata).toBeNull();
  });

  it("verificarea legală activă și depășită la capătul perioadei adaugă zile de depășire", () => {
    const r = calculeazaRaport(
      intrare({
        planuri: [
          plan("p1", { tip: "verificare_legala", urmatoarea_scadenta: "2026-09-20" }),
          // Inactiv: nu se mai urmărește.
          plan("p2", { tip: "verificare_legala", activ: false, urmatoarea_scadenta: "2026-09-01" }),
        ],
      }),
    );
    expect(r.totaluri.zileDepasire).toEqual({ total: 10, maxim: 10, numar: 1 });
    // Revizia M8: verificarea depășită și neexecutată NU e „la timp”.
    expect(r.totaluri.legaleLaTimp).toEqual({ laTimp: 0, evaluate: 1, rata: 0, restante: 1 });
  });

  // ── Revizia M8 ──
  it("planul activ depășit și neexecutat intră în procent ca neexecutat la timp", () => {
    const r = calculeazaRaport(
      intrare({
        planuri: [
          plan("p1", { urmatoarea_scadenta: "2026-09-20" }),
          // Scadența după capătul perioadei: nu era încă depășit.
          plan("p2", { urmatoarea_scadenta: "2026-10-05" }),
          plan("p3", { urmatoarea_scadenta: "2026-09-01", activ: false }),
        ],
        executiiPlanuri: [
          { id: "a", plan_id: "p2", data: "2026-08-10", citire_contor: null },
          { id: "b", plan_id: "p2", data: "2026-09-05", citire_contor: null },
        ],
      }),
    );
    expect(r.totaluri.planuriLaTimp).toEqual({ laTimp: 1, evaluate: 2, rata: 0.5, restante: 1 });
  });

  it("planul pe grilă fixă se judecă față de grilă, nu față de execuția precedentă", () => {
    const r = calculeazaRaport(
      intrare({
        planuri: [
          plan("p1", {
            tip: "verificare_legala",
            mod_calcul: "fix",
            data_ancora: "2026-07-01",
            periodicitate_zile: 30,
          }),
        ],
        executiiPlanuri: [
          // Grila: 1 iul, 31 iul, 30 aug, 29 sept. După 5 aug, scadența e 30 aug.
          { id: "a", plan_id: "p1", data: "2026-08-05", citire_contor: null },
          // 3 sept: flotant ar fi la timp (5 aug + 30 = 4 sept), pe grilă e cu 4 zile întârziere.
          { id: "b", plan_id: "p1", data: "2026-09-03", citire_contor: null },
        ],
      }),
    );
    expect(r.totaluri.legaleLaTimp).toEqual({ laTimp: 0, evaluate: 1, rata: 0, restante: 0 });
    expect(r.totaluri.zileDepasire).toMatchObject({ total: 4, maxim: 4, numar: 1 });
  });

  it("contoarele cu plan: doar active, pe contor, fiecare pereche o dată", () => {
    expect(
      contoareCuPlan([
        plan("p1", { tip_contor: "ore", urmatoarea_scadenta_contor: 500 }),
        plan("p2", { tip_contor: "ore", urmatoarea_scadenta_contor: 900 }),
        plan("p3", { tip_contor: "km", urmatoarea_scadenta_contor: 100, activ: false }),
        plan("p4", { tip_contor: "km", urmatoarea_scadenta_contor: null }),
      ]),
    ).toEqual([{ equipmentId: "e1", tip: "ore" }]);
  });

  it("amânările: planurile active cu amânări, cele mai amânate primele", () => {
    const r = calculeazaRaport(
      intrare({
        planuri: [
          plan("p1", { numar_amanari: 1 }),
          plan("p2", { numar_amanari: 3 }),
          plan("p3", { numar_amanari: 0 }),
          plan("p4", { numar_amanari: 5, activ: false }),
        ],
      }),
    );
    expect(r.amanari.map((p) => p.id)).toEqual(["p2", "p1"]);
    expect(r.totaluri.amanari).toEqual({ planuri: 2, total: 4, inCurs: 0 });
  });

  // Revizia M8: `numar_amanari` e istoric (0183 nu-l golește la execuție);
  // amânarea ÎN CURS e `amanat_pana`, pe care execuția reușită o șterge.
  it("amânările în curs sunt planurile active cu `amanat_pana`, nu cele cu contor nenul", () => {
    const r = calculeazaRaport(
      intrare({
        planuri: [
          plan("p1", { numar_amanari: 2, amanat_pana: "2026-10-20" }),
          plan("p2", { numar_amanari: 3 }),
          plan("p3", { numar_amanari: 1, amanat_pana: "2026-10-20", activ: false }),
        ],
      }),
    );
    expect(r.totaluri.amanari).toEqual({ planuri: 2, total: 5, inCurs: 1 });
  });
});

describe("citirile restante", () => {
  it("numără contoarele necitite peste prag sau niciodată", () => {
    expect(citiriRestante([null, "2026-10-01", "2026-08-01"], "2026-10-12", 30)).toBe(2);
    expect(citiriRestante([], "2026-10-12", 30)).toBe(0);
  });
});
