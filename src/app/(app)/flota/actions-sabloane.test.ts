// src/app/(app)/flota/actions-sabloane.test.ts
//
// Șabloanele de traseu (0197), pe clientul fals. Poarta e `trip_sheets:update =
// all`, ca politicile; proba reală e în `tests/rls/proba-flota-foaia-zilnica.sql`.

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
  ORG_ID,
  USER_ID,
} from "@/lib/teste/actiune";
import { eroarePostgrest } from "@/lib/teste/supabase-fals";
import {
  actualizeazaSablonTraseu,
  creeazaSablonTraseu,
  stergeSablonTraseu,
} from "./actions-sabloane";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("șabloanele de traseu", () => {
  const sablon = {
    denumire: "Sediu — Depozit",
    de_la_loc: "Sediu",
    pana_la_loc: "Depozit",
    scop: "Aprovizionare",
    km_estimat: "18",
  };

  it("sub `trip_sheets:update = all`: INTERZIS — poarta bazei e literal `all`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    for (const r of [
      await creeazaSablonTraseu(sablon),
      await actualizeazaSablonTraseu({ ...sablon, id: ID_1 }),
      await stergeSablonTraseu({ id: ID_1 }),
    ]) {
      expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    }
    expect(server.apeluri).toHaveLength(0);
  });

  it("creare: firma și autorul explicite, km ca număr", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "all" } });
    server.raspunde("trip_route_templates", "insert", { data: { id: ID_2 } });
    const r = await creeazaSablonTraseu(sablon);
    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    expect(server.apeluriPe("trip_route_templates")[0]?.payload).toEqual({
      ...sablon,
      km_estimat: 18,
      organization_id: ORG_ID,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    expect(caiRevalidate()).toEqual(["/flota/foi/sabloane"]);
  });

  it("numele luat (23505) ajunge pe `denumire`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "all" } });
    server.raspunde("trip_route_templates", "insert", {
      error: eroarePostgrest(
        "23505",
        'duplicate key value violates unique constraint "trt_org_denumire_uq"',
      ),
    });
    const r = await creeazaSablonTraseu(sablon);
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (r.ok) return;
    expect(Object.keys(r.error.fieldErrors ?? {})).toEqual(["denumire"]);
  });

  it("ștergerea și corectura: zero rânduri = CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "all" } });
    server.raspunde("trip_route_templates", "update", { data: null });
    const r = await stergeSablonTraseu({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});
