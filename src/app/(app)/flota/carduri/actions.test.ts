// src/app/(app)/flota/carduri/actions.test.ts
//
// Cardurile de combustibil (0214, F12b), pe clientul fals: înregistrarea (fără
// numărul întreg în payload sau în audit), corectura și ștergerea logică.
// Clientul fals prinde filtrul de organizație lipsă, `.select()` uitat și
// ramurile greșite; NU prinde o politică RLS greșită — aceea e în
// `tests/rls/proba-flota-carduri.sql` și în `izolare.sql` (l), blocul F12b.

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
  caiRevalidate,
  configureazaActiunea,
  ID_1,
  ID_2,
  ID_3,
  ORG_ID,
  USER_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";

import { actualizeazaCard, creeazaCard, stergeCard } from "./actions";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const NUMAR_INTREG = "7002510000001234";

const cardNou = {
  emitent: "omv_petrom",
  numar: "7002 5100 0000 1234",
  denumire: "",
  vehicle_id: ID_2,
  employee_id: "",
  valabil_luna: "9",
  valabil_an: "2027",
  observatii: "",
};

describe("creeazaCard", () => {
  it.each([["team"], ["own"], ["none"]] as const)(
    "sub `vehicles:create = %s`: INTERZIS, fără niciun drum la bază",
    async (scope) => {
      const { server } = configureazaActiunea({
        permisiuni: { "vehicles:create": scope },
      });
      const r = await creeazaCard(cardNou);
      expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
      expect(server.apeluri).toHaveLength(0);
    },
  );

  it("modulul fleet oprit: MODUL_DEZACTIVAT", async () => {
    configureazaActiunea({
      permisiuni: { "vehicles:create": "all" },
      functii: [],
    });
    expect(await creeazaCard(cardNou)).toMatchObject({
      ok: false,
      error: { code: "MODUL_DEZACTIVAT" },
    });
  });

  it("INSERT cu firma din tenant, ultimele 4 cifre, amprenta și ultima zi a lunii — fără numărul întreg", async () => {
    const { server } = configureazaActiunea({
      permisiuni: { "vehicles:create": "all" },
    });
    server.raspunde("fuel_cards", "insert", { data: { id: ID_1 } });

    const r = await creeazaCard(cardNou);
    await asteaptaDupa();

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [scriere] = server.apeluriPe("fuel_cards", "insert");
    const payload = scriere?.payload as Record<string, unknown>;
    expect(payload).toMatchObject({
      organization_id: ORG_ID,
      emitent: "omv_petrom",
      ultimele_cifre: "1234",
      vehicle_id: ID_2,
      employee_id: null,
      valabil_pana: "2027-09-30",
      denumire: null,
      observatii: null,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    expect(payload["amprenta_numar"]).toMatch(/^[0-9a-f]{64}$/u);
    expect(payload).not.toHaveProperty("numar");
    expect(scriere?.selectDupaScriere).toBe("id");
    // Numărul întreg nu pleacă nicăieri: nici în rând, nici în jurnalul de audit.
    expect(JSON.stringify(payload)).not.toContain(NUMAR_INTREG);
    expect(JSON.stringify(server.audituri())).not.toContain(NUMAR_INTREG);
    expect(JSON.stringify(server.audituri())).not.toContain("5100");
    expect(caiRevalidate()).toEqual(["/flota/carduri"]);
  });

  it("aceeași amprentă pentru același număr scris altfel (cu sau fără spații)", async () => {
    const { server } = configureazaActiunea({
      permisiuni: { "vehicles:create": "all" },
    });
    server.raspunde("fuel_cards", "insert", { data: { id: ID_1 } });
    server.raspunde("fuel_cards", "insert", { data: { id: ID_3 } });
    await creeazaCard(cardNou);
    await creeazaCard({ ...cardNou, numar: NUMAR_INTREG });
    const [a, b] = server
      .apeluriPe("fuel_cards", "insert")
      .map((x) => (x.payload as Record<string, unknown>)["amprenta_numar"]);
    expect(a).toBe(b);
  });

  it("doar ultimele cifre: fără amprentă", async () => {
    const { server } = configureazaActiunea({
      permisiuni: { "vehicles:create": "all" },
    });
    server.raspunde("fuel_cards", "insert", { data: { id: ID_1 } });
    await creeazaCard({ ...cardNou, numar: "561234" });
    const [scriere] = server.apeluriPe("fuel_cards", "insert");
    expect(scriere?.payload).toMatchObject({
      ultimele_cifre: "561234",
      amprenta_numar: null,
    });
  });

  it("vehicul ȘI șofer: VALIDARE pe țintă, fără drum la bază", async () => {
    const { server } = configureazaActiunea({
      permisiuni: { "vehicles:create": "all" },
    });
    const r = await creeazaCard({ ...cardNou, employee_id: ID_3 });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", fieldErrors: { tinta: expect.any(Array) } },
    });
    expect(server.apeluri).toHaveLength(0);
  });

  it("luna fără an: VALIDARE", async () => {
    configureazaActiunea({ permisiuni: { "vehicles:create": "all" } });
    const r = await creeazaCard({ ...cardNou, valabil_an: "" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
  });

  it("23505 pe `fcard_amprenta_uq`: „Cardul este deja înregistrat.” pe câmpul numărului", async () => {
    const { server } = configureazaActiunea({
      permisiuni: { "vehicles:create": "all" },
    });
    server.raspunde("fuel_cards", "insert", {
      error: eroarePostgrest(
        "23505",
        'duplicate key value violates unique constraint "fcard_amprenta_uq"',
      ),
    });
    const r = await creeazaCard(cardNou);
    expect(r).toMatchObject({
      ok: false,
      error: {
        code: "VALIDARE",
        fieldErrors: { numar: ["Cardul este deja înregistrat."] },
      },
    });
  });
});

describe("actualizeazaCard", () => {
  const corectura = {
    id: ID_1,
    denumire: "Rezervă",
    vehicle_id: "",
    employee_id: "",
    valabil_luna: "",
    valabil_an: "",
    status: "blocat",
    observatii: "",
  };

  it("UPDATE cu firma, `deleted_at is null` și `.select()`; fără emitent și fără număr", async () => {
    const { server } = configureazaActiunea({
      permisiuni: { "vehicles:update": "all" },
    });
    server.raspunde("fuel_cards", "update", { data: { id: ID_1 } });
    const r = await actualizeazaCard(corectura);
    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [scriere] = server.apeluriPe("fuel_cards", "update");
    expect(areFiltru(scriere, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(scriere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(scriere, "is", "deleted_at", null)).toBe(true);
    expect(scriere?.selectDupaScriere).toBe("id");
    expect(scriere?.payload).toEqual({
      denumire: "Rezervă",
      vehicle_id: null,
      employee_id: null,
      valabil_pana: null,
      status: "blocat",
      observatii: null,
      updated_by: USER_ID,
    });
  });

  it("zero rânduri (USING): CONFLICT, nu reușită", async () => {
    const { server } = configureazaActiunea({
      permisiuni: { "vehicles:update": "all" },
    });
    server.raspunde("fuel_cards", "update", { data: null });
    expect(await actualizeazaCard(corectura)).toMatchObject({
      ok: false,
      error: { code: "CONFLICT" },
    });
  });

  it("`vehicles:update = team` nu ajunge: politica cere `all`", async () => {
    const { server } = configureazaActiunea({
      permisiuni: { "vehicles:update": "team" },
    });
    expect(await actualizeazaCard(corectura)).toMatchObject({
      ok: false,
      error: { code: "INTERZIS" },
    });
    expect(server.apeluri).toHaveLength(0);
  });

  it("P0001 de vehicul ieșit din parc cade pe câmpul țintei", async () => {
    const { server } = configureazaActiunea({
      permisiuni: { "vehicles:update": "all" },
    });
    const mesaj =
      "Vehiculul ales pentru card nu aparține organizației dumneavoastră sau nu mai e în parc.";
    server.raspunde("fuel_cards", "update", {
      error: eroarePostgrest("P0001", mesaj),
    });
    expect(await actualizeazaCard({ ...corectura, vehicle_id: ID_2 })).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", fieldErrors: { tinta: [mesaj] } },
    });
  });
});

describe("stergeCard", () => {
  it("ștergere logică cu firma și `.select()`", async () => {
    const { server } = configureazaActiunea({
      permisiuni: { "vehicles:update": "all" },
    });
    server.raspunde("fuel_cards", "update", { data: { id: ID_1 } });
    const r = await stergeCard({ id: ID_1 });
    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [scriere] = server.apeluriPe("fuel_cards", "update");
    expect(scriere?.payload).toMatchObject({
      updated_by: USER_ID,
      deleted_at: expect.any(String),
    });
    expect(areFiltru(scriere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(scriere, "is", "deleted_at", null)).toBe(true);
    expect(scriere?.selectDupaScriere).toBe("id");
  });

  it("deja șters sau invizibil: CONFLICT", async () => {
    const { server } = configureazaActiunea({
      permisiuni: { "vehicles:update": "all" },
    });
    server.raspunde("fuel_cards", "update", { data: null });
    expect(await stergeCard({ id: ID_1 })).toMatchObject({
      ok: false,
      error: { code: "CONFLICT" },
    });
  });
});
