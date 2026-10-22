// src/lib/queries/fleet-contabil.test.ts
//
// Citirile exportului contabil al flotei (F12g), pe clientul fals: firma
// explicită pe fiecare citire, rândurile vii, limitele lunii în ora României,
// paginarea keyset, legătura cu cardul și regimul fiscal la data liniei. NU prind
// o politică RLS greșită — aceea e pe `tests/rls/proba-flota-export-contabil.sql`.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import { configureazaActiunea, ID_1, ID_2, ID_3, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest, type ClientFals } from "@/lib/teste/supabase-fals";

import { firmaPentruExport, inBaniExact, limiteLuna, liniiDeCostPeLuna } from "./fleet-contabil";

let db: ClientFals;
beforeEach(() => {
  db = configureazaActiunea().server;
});

const VEH = "99999999-9999-4999-8999-999999999999";

const alimentare = (id: string, m: Record<string, unknown> = {}) => ({
  id,
  alimentat_la: "2026-10-03T07:00:00+00:00",
  cost: 252.5,
  litri: 36,
  numar_bon: "4521",
  statie: "OMV Pipera",
  cui_statie: "1590082",
  foaie: {
    status: "aprobat",
    deleted_at: null,
    vehicle_id: VEH,
    vehicul_nr: "B100ABC",
    vehicul_combustibil: "motorina",
    vehicul: { nr_inmatriculare: "B100XYZ", masa_maxima_kg: 1800, tip_combustibil: "motorina" },
    sofer: { full_name: "Popescu Ion" },
  },
  ...m,
});

function programeaza(
  r: Partial<
    Record<"alimentari" | "cheltuieli" | "service" | "carduri" | "regimuri", unknown[]>
  > = {},
): void {
  db.raspunde("fuel_entries", "select", { data: r.alimentari ?? [] });
  db.raspunde("vehicle_expenses", "select", { data: r.cheltuieli ?? [] });
  db.raspunde("vehicle_service_entries", "select", { data: r.service ?? [] });
  if ((r.alimentari ?? []).length > 0) {
    db.raspunde("fuel_card_transactions", "select", { data: r.carduri ?? [] });
  }
  db.raspunde("vehicle_fiscal_regimes", "select", { data: r.regimuri ?? [] });
}

describe("limiteLuna", () => {
  it("octombrie 2026, cu schimbarea orei pe 25 oct: de la 30 sept 21:00 UTC la 31 oct 22:00 UTC", () => {
    expect(limiteLuna("2026-10")).toEqual({
      deLa: "2026-09-30T21:00:00.000Z",
      panaLa: "2026-10-31T22:00:00.000Z",
    });
    expect(limiteLuna("2026-12").panaLa).toBe("2026-12-31T22:00:00.000Z");
  });
});

describe("inBaniExact", () => {
  it("numeric(14,2) → bani, și aruncă pe negativ sau pe fracțiune de ban", () => {
    expect(inBaniExact(252.5, "t")).toBe(25_250);
    expect(inBaniExact(0.07, "t")).toBe(7);
    expect(() => inBaniExact(-1, "t")).toThrow(RangeError);
    expect(() => inBaniExact(1.005, "t")).toThrow(RangeError);
  });
});

describe("liniiDeCostPeLuna", () => {
  it("firma explicită și rândurile vii pe fiecare citire; luna în ora României pe alimentări, pe zile în rest", async () => {
    programeaza({ alimentari: [alimentare(ID_1)] });
    await liniiDeCostPeLuna(ORG_ID, "2026-10");

    for (const tabela of [
      "fuel_entries",
      "vehicle_expenses",
      "vehicle_service_entries",
      "fuel_card_transactions",
      "vehicle_fiscal_regimes",
    ]) {
      const [apel] = db.apeluriPe(tabela, "select");
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID), tabela).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null), tabela).toBe(true);
      expect(areFiltru(apel, "order", "id"), tabela).toBe(true);
    }
    const [alim] = db.apeluriPe("fuel_entries", "select");
    expect(areFiltru(alim, "gte", "alimentat_la", "2026-09-30T21:00:00.000Z")).toBe(true);
    expect(areFiltru(alim, "lt", "alimentat_la", "2026-10-31T22:00:00.000Z")).toBe(true);
    const [chelt] = db.apeluriPe("vehicle_expenses", "select");
    expect(areFiltru(chelt, "gte", "data_cheltuielii", "2026-10-01")).toBe(true);
    expect(areFiltru(chelt, "lte", "data_cheltuielii", "2026-10-31")).toBe(true);
    const [serv] = db.apeluriPe("vehicle_service_entries", "select");
    expect(areFiltru(serv, "gte", "data_interventiei", "2026-10-01")).toBe(true);
    expect(areFiltru(serv, "lte", "data_interventiei", "2026-10-31")).toBe(true);
    // Din fișa angajatului se ia DOAR numele (D11): nici CNP, nici IBAN.
    expect(alim?.coloane).toContain("sofer:employees!employee_id(full_name)");
    expect(alim?.coloane).not.toMatch(/cnp|iban/iu);
  });

  it("alimentarea: ziua în ora României, totalul în bani, instantaneul foii bate vehiculul de azi", async () => {
    programeaza({
      alimentari: [alimentare(ID_1, { alimentat_la: "2026-10-31T21:30:00+00:00" })],
    });
    const [l] = await liniiDeCostPeLuna(ORG_ID, "2026-10");
    expect(l).toMatchObject({
      id: ID_1,
      sursa: "alimentare",
      data: "2026-10-31",
      categorie: "combustibil",
      totalBani: 25_250,
      vehicul: { id: VEH, nr: "B100ABC", masaMaximaKg: 1800 },
      sofer: "Popescu Ion",
      document: "4521",
      furnizor: "OMV Pipera",
      cuiFurnizor: "1590082",
      sursaAreCui: true,
      detaliu: "Motorină",
      stareFoaie: "aprobat",
      foaieStearsa: false,
      peCardDeFlota: false,
      regimDeclarat: null,
    });
  });

  it("legătura cu cardul de flotă, după `fuel_entry_id`, doar pe potrivirile vii", async () => {
    programeaza({
      alimentari: [alimentare(ID_1), alimentare(ID_2)],
      carduri: [{ id: ID_3, fuel_entry_id: ID_2, stare_potrivire: "potrivita" }],
    });
    const linii = await liniiDeCostPeLuna(ORG_ID, "2026-10");
    expect(linii.map((l) => [l.id, l.peCardDeFlota])).toEqual([
      [ID_1, false],
      [ID_2, true],
    ]);
    const [apel] = db.apeluriPe("fuel_card_transactions", "select");
    expect(areFiltru(apel, "in", "fuel_entry_id", [ID_1, ID_2])).toBe(true);
    expect(areFiltru(apel, "in", "stare_potrivire", ["potrivita", "diferenta"])).toBe(true);
    // NU după luna tranzacției: o tranzacție din altă lună, legată de alimentare, contează.
    expect(apel?.filtre.some((f) => f.argumente[0] === "efectuat_la")).toBe(false);
  });

  it("regimul fiscal la data liniei, cu schimbarea la mijlocul lunii", async () => {
    programeaza({
      alimentari: [
        alimentare(ID_1, { alimentat_la: "2026-10-03T07:00:00+00:00" }),
        alimentare(ID_2, { alimentat_la: "2026-10-20T07:00:00+00:00" }),
      ],
      regimuri: [
        { id: ID_1, vehicle_id: VEH, valabil_de_la: "2026-01-01", regim: "limitat_50" },
        {
          id: ID_2,
          vehicle_id: VEH,
          valabil_de_la: "2026-10-15",
          regim: "peste_3500_sau_9_locuri",
        },
      ],
    });
    const linii = await liniiDeCostPeLuna(ORG_ID, "2026-10");
    expect(linii.map((l) => l.regimDeclarat)).toEqual(["limitat_50", "integral"]);
    const [apel] = db.apeluriPe("vehicle_fiscal_regimes", "select");
    expect(areFiltru(apel, "in", "vehicle_id", [VEH])).toBe(true);
    expect(areFiltru(apel, "lte", "valabil_de_la", "2026-10-31")).toBe(true);
  });

  it("embed-ul `vehicles` NULL (vehicul șters) dă un număr din instantaneu sau necunoscut, nu o excepție", async () => {
    programeaza({
      alimentari: [
        alimentare(ID_1, {
          foaie: { ...alimentare(ID_1).foaie, vehicul: null, vehicul_nr: null },
        }),
      ],
      cheltuieli: [
        {
          id: ID_2,
          data_cheltuielii: "2026-10-05",
          categorie: "taxa_pod",
          suma: 13,
          litri: null,
          numar_document: null,
          vehicle_id: VEH,
          vehicul: null,
        },
      ],
      service: [
        {
          id: ID_3,
          data_interventiei: "2026-10-06",
          tip: "anvelope",
          descriere: "Schimb sezonier",
          furnizor: "Vulcanizare SRL",
          numar_factura: "F77",
          cost_total: 400,
          cost_piese: 300,
          cost_manopera: 100,
          vehicle_id: VEH,
          vehicul: { nr_inmatriculare: "B100XYZ", masa_maxima_kg: null },
        },
      ],
    });
    const linii = await liniiDeCostPeLuna(ORG_ID, "2026-10");
    expect(
      linii.map((l) => [l.sursa, l.categorie, l.vehicul.nr, l.totalBani, l.sursaAreCui]),
    ).toEqual([
      ["alimentare", "combustibil", null, 25_250, true],
      ["cheltuiala", "taxe_drum", null, 1300, false],
      ["service", "anvelope", "B100XYZ", 40_000, false],
    ]);
    expect(linii[2]).toMatchObject({
      document: "F77",
      furnizor: "Vulcanizare SRL",
      detaliu: "Schimb sezonier",
    });
  });

  it("foaia ștearsă și foaia neaprobată ajung la model cu starea lor, nu se filtrează aici", async () => {
    programeaza({
      alimentari: [
        alimentare(ID_1, {
          foaie: { ...alimentare(ID_1).foaie, deleted_at: "2026-10-10T00:00:00Z" },
        }),
        alimentare(ID_2, { foaie: { ...alimentare(ID_2).foaie, status: "trimis" } }),
      ],
    });
    const linii = await liniiDeCostPeLuna(ORG_ID, "2026-10");
    expect(linii.map((l) => [l.foaieStearsa, l.stareFoaie])).toEqual([
      [true, "aprobat"],
      [false, "trimis"],
    ]);
  });

  it("pagina a doua continuă după id-ul ultimului rând (keyset), nu prin OFFSET", async () => {
    const pagina = Array.from({ length: 1000 }, (_, i) =>
      alimentare(`00000000-0000-4000-8000-${String(i).padStart(12, "0")}`),
    );
    db.raspunde("fuel_entries", "select", { data: pagina });
    db.raspunde("fuel_entries", "select", { data: [alimentare(ID_1)] });
    db.raspunde("vehicle_expenses", "select", { data: [] });
    db.raspunde("vehicle_service_entries", "select", { data: [] });
    for (let i = 0; i < 6; i += 1) db.raspunde("fuel_card_transactions", "select", { data: [] });
    db.raspunde("vehicle_fiscal_regimes", "select", { data: [] });

    const linii = await liniiDeCostPeLuna(ORG_ID, "2026-10");
    expect(linii).toHaveLength(1001);
    const [prima, aDoua] = db.apeluriPe("fuel_entries", "select");
    expect(prima?.filtre.some((f) => f.metoda === "gt")).toBe(false);
    expect(areFiltru(aDoua, "gt", "id", "00000000-0000-4000-8000-000000000999")).toBe(true);
    // Legăturile cu cardul se cer în felii de 200 de id-uri.
    expect(db.apeluriPe("fuel_card_transactions", "select")).toHaveLength(6);
  });

  it("eroarea PostgREST se propagă, nu devine o lună goală", async () => {
    db.raspunde("fuel_entries", "select", { error: eroarePostgrest("42703") });
    db.raspunde("vehicle_expenses", "select", { data: [] });
    db.raspunde("vehicle_service_entries", "select", { data: [] });
    await expect(liniiDeCostPeLuna(ORG_ID, "2026-10")).rejects.toMatchObject({ code: "42703" });
  });
});

describe("firmaPentruExport", () => {
  it("denumirea legală, CIF-ul doar cifre și starea TVA, pe id-ul firmei", async () => {
    db.raspunde("organizations", "select", {
      data: {
        name: "Firma",
        legal_name: "Firma SRL",
        cui: "RO123",
        cui_normalizat: "123",
        platitor_tva: true,
      },
    });
    expect(await firmaPentruExport(ORG_ID)).toEqual({
      denumire: "Firma SRL",
      cui: "123",
      platitorTva: true,
    });
    const [apel] = db.apeluriPe("organizations", "select");
    expect(areFiltru(apel, "eq", "id", ORG_ID)).toBe(true);
  });
});
