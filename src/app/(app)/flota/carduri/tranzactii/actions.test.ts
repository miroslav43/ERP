// src/app/(app)/flota/carduri/tranzactii/actions.test.ts
//
// Reconcilierea tranzacțiilor de card (0214, F12b), pe clientul fals:
// ignorarea cere notă, legarea manuală cere foaia aceluiași vehicul și zi,
// repotrivirea scrie doar rândurile care își schimbă starea și nu atinge o
// legătură vie. „Adaugă pe foaie” ([DECIZIA-2c]) nu există: nu se testează.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("@/lib/teste/actiune")).falsuri.nextHeaders());
vi.mock("next/server", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.nextServer(await orig()),
);
vi.mock("next/cache", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.nextCache(await orig()),
);
vi.mock("@/lib/tenant/resolve-tenant", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.resolveTenant(await orig()),
);
vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);
vi.mock("@/lib/supabase/admin", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseAdmin(),
);
vi.mock("@/lib/auth/features", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.features(await orig()),
);
vi.mock("@/lib/auth/permissions", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.permissions(await orig()),
);

import {
  asteaptaDupa,
  configureazaActiunea,
  ID_1,
  ID_2,
  ID_3,
  ORG_ID,
  USER_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";

import { ignoraTranzactie, leagaTranzactie, repotrivesteTranzactii } from "./actions";

const PERMISIUNI = {
  "vehicles:update": "all",
  "vehicles:read": "all",
} as const;
const VEHICUL = ID_2;
const FOAIE = ID_3;
const ALIMENTARE = "99999999-9999-4999-8999-999999999999";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ignoraTranzactie", () => {
  it("fără notă: VALIDARE, fără drum la bază", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    expect(await ignoraTranzactie({ id: ID_1, nota: " " })).toMatchObject({
      ok: false,
      error: { code: "VALIDARE" },
    });
    expect(server.apeluri).toHaveLength(0);
  });

  it("cu notă: desface legătura, firma în filtru, `.select()`; nota NU intră în audit", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    server.raspunde("fuel_card_transactions", "update", { data: { id: ID_1 } });
    const r = await ignoraTranzactie({
      id: ID_1,
      nota: "Suspiciune: alimentare pentru alt vehicul.",
    });
    await asteaptaDupa();
    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [scriere] = server.apeluriPe("fuel_card_transactions", "update");
    expect(scriere?.payload).toEqual({
      stare_potrivire: "ignorata",
      fuel_entry_id: null,
      nota: "Suspiciune: alimentare pentru alt vehicul.",
      updated_by: USER_ID,
    });
    expect(areFiltru(scriere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(scriere?.selectDupaScriere).toBe("id");
    expect(JSON.stringify(server.audituri())).not.toContain("Suspiciune");
  });

  it("zero rânduri: CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    server.raspunde("fuel_card_transactions", "update", { data: null });
    expect(await ignoraTranzactie({ id: ID_1, nota: "Card de test." })).toMatchObject({
      ok: false,
      error: { code: "CONFLICT" },
    });
  });
});

describe("leagaTranzactie", () => {
  const tx = {
    id: ID_1,
    categorie: "combustibil",
    vehicle_id: VEHICUL,
    data_ro: "2026-10-05",
    stare_potrivire: "fara_alimentare",
    fuel_entry_id: null,
  };

  it("leagă de alimentarea de pe foaia aceluiași vehicul, din aceeași zi", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    server.raspunde("fuel_card_transactions", "select", { data: tx });
    server.raspunde("fuel_entries", "select", {
      data: {
        id: ALIMENTARE,
        trip_sheet_id: FOAIE,
        foaie: { id: FOAIE, vehicle_id: VEHICUL, data: "2026-10-05" },
      },
    });
    server.raspunde("fuel_card_transactions", "update", { data: { id: ID_1 } });

    const r = await leagaTranzactie({ id: ID_1, fuel_entry_id: ALIMENTARE });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [scriere] = server.apeluriPe("fuel_card_transactions", "update");
    expect(scriere?.payload).toEqual({
      fuel_entry_id: ALIMENTARE,
      stare_potrivire: "potrivita",
      motiv: "Legată manual.",
      updated_by: USER_ID,
    });
    expect(areFiltru(scriere, "is", "deleted_at", null)).toBe(true);
    expect(scriere?.selectDupaScriere).toBe("id");
  });

  it("alimentarea din altă zi: VALIDARE pe câmp, fără scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    server.raspunde("fuel_card_transactions", "select", { data: tx });
    server.raspunde("fuel_entries", "select", {
      data: {
        id: ALIMENTARE,
        trip_sheet_id: FOAIE,
        foaie: { id: FOAIE, vehicle_id: VEHICUL, data: "2026-10-06" },
      },
    });
    const r = await leagaTranzactie({ id: ID_1, fuel_entry_id: ALIMENTARE });
    expect(r).toMatchObject({
      ok: false,
      error: {
        code: "VALIDARE",
        fieldErrors: { fuel_entry_id: expect.any(Array) },
      },
    });
    expect(server.apeluriPe("fuel_card_transactions", "update")).toHaveLength(0);
  });

  it("AdBlue nu se leagă de o alimentare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    server.raspunde("fuel_card_transactions", "select", {
      data: { ...tx, categorie: "adblue" },
    });
    server.raspunde("fuel_entries", "select", { data: null });
    expect(await leagaTranzactie({ id: ID_1, fuel_entry_id: ALIMENTARE })).toMatchObject({
      ok: false,
      error: { code: "CONFLICT" },
    });
  });

  it("23505 pe `fctx_alimentare_uq`: alimentarea e deja legată", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    server.raspunde("fuel_card_transactions", "select", { data: tx });
    server.raspunde("fuel_entries", "select", {
      data: {
        id: ALIMENTARE,
        trip_sheet_id: FOAIE,
        foaie: { id: FOAIE, vehicle_id: VEHICUL, data: "2026-10-05" },
      },
    });
    server.raspunde("fuel_card_transactions", "update", {
      error: eroarePostgrest(
        "23505",
        'duplicate key value violates unique constraint "fctx_alimentare_uq"',
      ),
    });
    expect(await leagaTranzactie({ id: ID_1, fuel_entry_id: ALIMENTARE })).toMatchObject({
      ok: false,
      error: {
        code: "VALIDARE",
        fieldErrors: {
          fuel_entry_id: ["Alimentarea e deja legată de altă tranzacție."],
        },
      },
    });
  });
});

describe("repotrivesteTranzactii", () => {
  const baza = {
    emitent: "omv_petrom",
    card_id: null,
    card_ultimele_cifre: "1234",
    nr_inmatriculare_extras: null,
    efectuat_la: "2026-10-05T11:02:00.000Z",
    data_ro: "2026-10-05",
    are_ora: true,
    categorie: "combustibil",
    tip_combustibil: "motorina",
    cantitate: 52.3,
    valoare_bruta: 380.15,
    moneda: "RON",
    km_declarat: null,
    numar_bon: null,
    vehicle_id: null,
    trip_sheet_id: null,
    fuel_entry_id: null,
    motiv: null,
  };

  it("cardul înregistrat între timp: rândul `card_necunoscut` se potrivește; legătura vie rămâne", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    server.raspunde("fuel_card_transactions", "select", {
      data: [
        { ...baza, id: "tx-nou", stare_potrivire: "card_necunoscut" },
        {
          ...baza,
          id: "tx-legat",
          card_id: "card-1",
          vehicle_id: VEHICUL,
          trip_sheet_id: FOAIE,
          fuel_entry_id: ALIMENTARE,
          stare_potrivire: "potrivita",
          motiv: "Legată manual.",
        },
      ],
      count: 2,
    });
    server.raspunde("fuel_cards", "select", {
      data: [
        {
          id: "card-1",
          emitent: "omv_petrom",
          ultimele_cifre: "1234",
          amprenta_numar: null,
          vehicle_id: VEHICUL,
          employee_id: null,
        },
      ],
      count: 1,
    });
    server.raspunde("vehicles", "select", {
      data: [
        {
          id: VEHICUL,
          nr_inmatriculare: "B100XYZ",
          tip_combustibil: "motorina",
          deleted_at: null,
        },
      ],
      count: 1,
    });
    server.raspunde("vehicle_assignments", "select", { data: [], count: 0 });
    server.raspunde("trip_sheets", "select", {
      data: [
        {
          id: FOAIE,
          vehicle_id: VEHICUL,
          employee_id: ID_3,
          data: "2026-10-05",
          status: "aprobat",
          km_plecare: 1,
          km_sosire: 2,
        },
      ],
      count: 1,
    });
    server.raspunde("fuel_entries", "select", {
      data: [
        {
          id: ALIMENTARE,
          trip_sheet_id: FOAIE,
          litri: 52.3,
          cost: 380,
          alimentat_la: "2026-10-05T11:00:00.000Z",
          numar_bon: null,
        },
      ],
      count: 1,
    });
    server.raspunde("fuel_card_transactions", "select", {
      data: [{ id: "tx-legat", fuel_entry_id: ALIMENTARE }],
    });
    server.raspunde("fuel_card_transactions", "update", {
      data: { id: "tx-nou" },
    });

    const r = await repotrivesteTranzactii({ luna: "2026-10" });

    expect(r).toEqual({ ok: true, data: { verificate: 1, schimbate: 1 } });
    const scrieri = server.apeluriPe("fuel_card_transactions", "update");
    expect(scrieri).toHaveLength(1);
    expect(areFiltru(scrieri[0], "eq", "id", "tx-nou")).toBe(true);
    // Alimentarea e ținută de legătura manuală: rândul nou ajunge „fără alimentare”.
    expect(scrieri[0]?.payload).toMatchObject({
      card_id: "card-1",
      vehicle_id: VEHICUL,
      trip_sheet_id: FOAIE,
      fuel_entry_id: null,
      stare_potrivire: "fara_alimentare",
    });
  });

  it("luna invalidă: VALIDARE", async () => {
    configureazaActiunea({ permisiuni: PERMISIUNI });
    expect(await repotrivesteTranzactii({ luna: "2026-13" })).toMatchObject({
      ok: false,
      error: { code: "VALIDARE" },
    });
  });
});
