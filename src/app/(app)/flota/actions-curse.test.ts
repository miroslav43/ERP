// src/app/(app)/flota/actions-curse.test.ts
//
// Cursele foii zilnice și șabloanele de traseu (0200), pe clientul fals.
// Regulile curselor (ziua, ordinea, km monoton, suprapunerile, starea foii)
// le judecă baza — aici se fixează ce PLEACĂ spre ea și cum se întorc
// refuzurile ei. Proba lor reală e în `tests/rls/proba-flota-foaia-zilnica.sql`.

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
  caiRevalidate,
  configureazaActiunea,
  ID_1,
  ID_2,
  ID_3,
  ORG_ID,
  USER_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import { actualizeazaCursa, adaugaCursa, stergeCursa } from "./actions-curse";

const ACUM = "2026-10-06T10:00:00.000Z";

const cursa = (m: Record<string, unknown> = {}) => ({
  trip_sheet_id: ID_1,
  plecare_la: "2026-10-05T08:00",
  sosire_la: "2026-10-05T09:00",
  de_la_loc: "Sediu",
  pana_la_loc: "Depozit",
  scop: "Aprovizionare",
  km_plecare: "10000",
  km_sosire: "10040",
  ...m,
});

const caiFoaie = [
  "/flota/foi",
  `/flota/foi/${ID_1}`,
  "/portal",
  "/portal/masina-mea",
  `/portal/masina-mea/foi/${ID_1}`,
];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(ACUM));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("adaugaCursa", () => {
  it("fără `trip_sheets:update`: INTERZIS, fără interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:read": "own" } });
    const r = await adaugaCursa(cursa());
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes (`own`): ora României în UTC, autorul explicit, fără `ordine` și fără șablon", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "trip_sheets:update": "own" },
    });
    server.raspunde("trip_sheet_curse", "insert", { data: { id: ID_2 } });

    const r = await adaugaCursa(cursa({ sablon_id: ID_3 }));

    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    const [apel] = server.apeluriPe("trip_sheet_curse");
    expect(apel?.operatie).toBe("insert");
    expect(apel?.selectDupaScriere).toBe("id");
    expect(apel?.payload).toMatchObject({
      organization_id: ORG_ID,
      trip_sheet_id: ID_1,
      plecare_la: "2026-10-05T05:00:00.000Z",
      sosire_la: "2026-10-05T06:00:00.000Z",
      km_plecare: 10000,
      km_sosire: 10040,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    // `ordine` o renumerotează baza; `sablon_id` e doar urmă de audit;
    // `km_parcursi` e GENERATED ALWAYS (428C9 dacă se trimite).
    for (const camp of ["ordine", "sablon_id", "km_parcursi"]) {
      expect(apel?.payload).not.toHaveProperty(camp);
    }
    expect(caiRevalidate()).toEqual(caiFoaie);
  });

  it("o cursă pe drum pleacă fără sosire", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    server.raspunde("trip_sheet_curse", "insert", { data: { id: ID_2 } });
    await adaugaCursa(cursa({ sosire_la: "", km_sosire: "" }));
    expect(server.apeluriPe("trip_sheet_curse")[0]?.payload).toMatchObject({
      sosire_la: null,
      km_sosire: null,
    });
  });

  it("km sub sosirea cursei precedente (P0001) ajunge pe `km_plecare`, cu cifrele bazei", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    const mesaj =
      "Kilometrajul de plecare al cursei (10020 km) este mai mic decât cel de la sosirea cursei precedente (10040 km). Un odometru nu poate da înapoi.";
    server.raspunde("trip_sheet_curse", "insert", { error: eroarePostgrest("P0001", mesaj) });
    const r = await adaugaCursa(cursa());
    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", message: mesaj, fieldErrors: { km_plecare: [mesaj] } },
    });
    expect(caiRevalidate()).toEqual([]);
  });

  it("pe o foaie trimisă baza refuză (§D1), iar refuzul rămâne mesaj general", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    const mesaj =
      "Cursele se modifică doar cât foaia de parcurs este ciornă. Retrageți-o sau redeschideți-o în ciornă, apoi corectați-o.";
    server.raspunde("trip_sheet_curse", "insert", { error: eroarePostgrest("P0001", mesaj) });
    const r = await adaugaCursa(cursa());
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });

  it("schema: sosirea pe jumătate e refuzată înainte de bază", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    const r = await adaugaCursa(cursa({ km_sosire: "" }));
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (r.ok) return;
    expect(Object.keys(r.error.fieldErrors ?? {})).toEqual(["km_sosire"]);
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("actualizeazaCursa", () => {
  it("succes: filtrat pe cursă, foaie și firmă, cu `.select()`; observațiile goale nu se trimit", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    server.raspunde("trip_sheet_curse", "update", { data: { id: ID_2 } });

    const r = await actualizeazaCursa({ ...cursa(), id: ID_2, km_sosire: "10045" });

    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    const [apel] = server.apeluriPe("trip_sheet_curse");
    expect(apel?.payload).toMatchObject({ km_sosire: 10045, updated_by: USER_ID });
    expect(apel?.payload).not.toHaveProperty("observatii");
    expect(apel?.payload).not.toHaveProperty("trip_sheet_id");
    expect(areFiltru(apel, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(apel, "eq", "trip_sheet_id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(caiFoaie);
  });

  it("zero rânduri (cursa altcuiva, respinsă de USING): CONFLICT, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    server.raspunde("trip_sheet_curse", "update", { data: null });
    const r = await actualizeazaCursa({ ...cursa(), id: ID_2 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });
});

describe("stergeCursa", () => {
  it("ștergere logică, doar pe o cursă încă neștearsă", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    server.raspunde("trip_sheet_curse", "update", { data: { id: ID_2 } });

    const r = await stergeCursa({ id: ID_2, trip_sheet_id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    const [apel] = server.apeluriPe("trip_sheet_curse");
    expect(apel?.payload).toEqual({ deleted_at: ACUM, updated_by: USER_ID });
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "eq", "trip_sheet_id", ID_1)).toBe(true);
  });

  it("zero rânduri: CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    server.raspunde("trip_sheet_curse", "update", { data: null });
    const r = await stergeCursa({ id: ID_2, trip_sheet_id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});
