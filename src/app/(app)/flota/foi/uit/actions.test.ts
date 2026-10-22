// src/app/(app)/flota/foi/uit/actions.test.ts
//
// Codurile UIT de pe cursele foii (0217, F12f), pe clientul fals. Regulile de
// stare (doar ciorna), identitatea rândului și cine scrie le judecă baza — aici
// se fixează ce PLEACĂ spre ea și cum se întorc refuzurile ei. Proba lor reală e
// `tests/rls/proba-flota-uit.sql`.

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

import { actualizeazaUit, adaugaUit, stergeUit } from "./actions";

const ACUM = "2026-10-21T10:00:00.000Z";

const uitNou = (m: Record<string, unknown> = {}) => ({
  trip_sheet_id: ID_1,
  cursa_id: ID_2,
  uit: "3v0p-0l0p 0t3j.uw46",
  data_inceput: "2026-10-20",
  valabilitate_zile: "",
  observatii: "",
  ...m,
});

const caiFoaie = [
  "/flota/foi",
  `/flota/foi/${ID_1}`,
  "/flota/aprobari",
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

describe("adaugaUit", () => {
  it("fără `trip_sheets:update`: INTERZIS, fără interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:read": "own" } });
    const r = await adaugaUit(uitNou());
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes (`own`): codul normalizat, firma și autorul explicite, FĂRĂ `expira_la`", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "trip_sheets:update": "own" },
    });
    server.raspunde("trip_sheet_uit", "insert", { data: { id: ID_3 } });

    const r = await adaugaUit(uitNou());
    await asteaptaDupa();

    expect(r).toEqual({ ok: true, data: { id: ID_3 } });
    const [apel] = server.apeluriPe("trip_sheet_uit", "insert");
    expect(apel?.payload).toEqual({
      organization_id: ORG_ID,
      trip_sheet_id: ID_1,
      cursa_id: ID_2,
      uit: "3V0P0L0P0T3JUW46",
      data_inceput: "2026-10-20",
      valabilitate_zile: 5,
      observatii: null,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    expect(apel?.payload).not.toHaveProperty("expira_la");
    expect(apel?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual(caiFoaie);
    const [audit] = server.audituri();
    expect(audit).toMatchObject({
      p_action: "create",
      p_entity_type: "trip_sheet_uit",
      p_entity_id: ID_3,
    });
  });

  it("schema: cifre de control greșite, refuz pe câmp, fără drum la bază", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    const r = await adaugaUit(uitNou({ uit: "3V0P0L0P0T3JUW47" }));
    expect(r).toMatchObject({
      ok: false,
      error: {
        code: "VALIDARE",
        fieldErrors: { uit: ["Ultimele două cifre nu se potrivesc. Verificați codul primit."] },
      },
    });
    expect(server.apeluri).toHaveLength(0);
  });

  it("23505 (același cod pe cursă) dă mesajul despre UIT, nu pe cel despre vehicul", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    server.raspunde("trip_sheet_uit", "insert", {
      error: eroarePostgrest(
        "23505",
        'duplicate key value violates unique constraint "tsu_cursa_uit_uq"',
      ),
    });
    const r = await adaugaUit(uitNou());
    expect(r).toMatchObject({
      ok: false,
      error: {
        code: "VALIDARE",
        message: "Codul UIT e deja trecut pe această cursă.",
        fieldErrors: { uit: ["Codul UIT e deja trecut pe această cursă."] },
      },
    });
    if (r.ok) return;
    expect(r.error.message).not.toMatch(/vehicul/u);
    expect(caiRevalidate()).toEqual([]);
  });

  it("P0001 „Codurile UIT se modifică doar…” rămâne mesaj general", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    const mesaj =
      "Codurile UIT se modifică doar cât foaia de parcurs este ciornă. Retrageți-o sau redeschideți-o în ciornă, apoi corectați-o.";
    server.raspunde("trip_sheet_uit", "insert", { error: eroarePostgrest("P0001", mesaj) });
    const r = await adaugaUit(uitNou());
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
    if (r.ok) return;
    expect(r.error.fieldErrors ?? null).toBeNull();
  });
});

describe("actualizeazaUit", () => {
  const corectura = {
    id: ID_3,
    trip_sheet_id: ID_1,
    data_inceput: "2026-10-21",
    valabilitate_zile: "15",
    observatii: "Confirmat telefonic.",
  };

  it("succes: doar data, valabilitatea și observația, cu `updated_by` și filtre pe firmă", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    server.raspunde("trip_sheet_uit", "update", { data: { id: ID_3 } });

    const r = await actualizeazaUit(corectura);

    expect(r).toEqual({ ok: true, data: { id: ID_3 } });
    const [apel] = server.apeluriPe("trip_sheet_uit", "update");
    expect(apel?.payload).toEqual({
      data_inceput: "2026-10-21",
      valabilitate_zile: 15,
      observatii: "Confirmat telefonic.",
      updated_by: USER_ID,
    });
    for (const camp of ["uit", "cursa_id", "expira_la", "trip_sheet_id"]) {
      expect(apel?.payload).not.toHaveProperty(camp);
    }
    expect(areFiltru(apel, "eq", "id", ID_3)).toBe(true);
    expect(areFiltru(apel, "eq", "trip_sheet_id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(caiFoaie);
  });

  it("zero rânduri (USING respinge tăcut): CONFLICT, nu succes, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    server.raspunde("trip_sheet_uit", "update", { data: null });
    const r = await actualizeazaUit(corectura);
    expect(r).toMatchObject({
      ok: false,
      error: {
        code: "CONFLICT",
        message:
          "Codul UIT nu a fost modificat: foaia nu mai e în lucru sau nu aveți dreptul. Reîncărcați foaia.",
      },
    });
    expect(caiRevalidate()).toEqual([]);
  });
});

describe("stergeUit", () => {
  it("ștergere logică: `deleted_at` + `updated_by`, filtrată pe firmă și pe codul încă viu", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    server.raspunde("trip_sheet_uit", "update", { data: { id: ID_3 } });

    const r = await stergeUit({ id: ID_3, trip_sheet_id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_3 } });
    const [apel] = server.apeluriPe("trip_sheet_uit", "update");
    expect(apel?.payload).toEqual({ deleted_at: ACUM, updated_by: USER_ID });
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "trip_sheet_id", ID_1)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(caiRevalidate()).toEqual(caiFoaie);
  });

  it("zero rânduri: CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    server.raspunde("trip_sheet_uit", "update", { data: null });
    const r = await stergeUit({ id: ID_3, trip_sheet_id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});
