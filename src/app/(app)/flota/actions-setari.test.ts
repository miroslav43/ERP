// src/app/(app)/flota/actions-setari.test.ts
//
// Setările flotei (0198), pe clientul fals. Poarta e `vehicles:update = all`,
// ca politicile; proba reală (scrierea org_admin, refuzul managerului și al
// angajatului, oglinda în `alert_rules`) e în
// `tests/rls/proba-flota-conformitate-zilnica.sql` și în `izolare.sql` (l).

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

import { salveazaSetariFlota } from "./actions-setari";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const intrare = {
  responsabili: [ID_2, ID_3],
  prag_salt_km: "800",
  praguri_alerta_zile: "7, 30, 14",
};

describe("salveazaSetariFlota", () => {
  it.each([["team"], ["own"], ["none"]] as const)(
    "sub `vehicles:update = %s`: INTERZIS, fără niciun drum la bază",
    async (scope) => {
      const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": scope } });
      const r = await salveazaSetariFlota(intrare);
      expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
      expect(server.apeluri).toHaveLength(0);
    },
  );

  it("prima salvare: INSERT cu firma și autorul explicite, pragurile ca listă ordonată", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("fleet_settings", "select", { data: null });
    server.raspunde("fleet_settings", "insert", { data: { id: ID_1 } });

    const r = await salveazaSetariFlota(intrare);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [citire] = server.apeluriPe("fleet_settings", "select");
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
    expect(server.apeluriPe("fleet_settings", "insert")[0]?.payload).toEqual({
      responsabili: [ID_2, ID_3],
      prag_salt_km: 800,
      praguri_alerta_zile: [30, 14, 7],
      organization_id: ORG_ID,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    expect(caiRevalidate()).toEqual(["/flota/setari", "/flota"]);
  });

  it("a doua salvare: UPDATE pe rândul firmei, cu `.select()` după", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("fleet_settings", "select", { data: { id: ID_1 } });
    server.raspunde("fleet_settings", "update", { data: { id: ID_1 } });

    const r = await salveazaSetariFlota({ ...intrare, responsabili: [] });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [scriere] = server.apeluriPe("fleet_settings", "update");
    expect(scriere?.payload).toEqual({
      responsabili: [],
      prag_salt_km: 800,
      praguri_alerta_zile: [30, 14, 7],
      updated_by: USER_ID,
    });
    expect(areFiltru(scriere, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(scriere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(scriere?.selectDupaScriere).toBe("id");
  });

  it("UPDATE cu zero rânduri (USING) = CONFLICT, nu succes tăcut", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("fleet_settings", "select", { data: { id: ID_1 } });
    server.raspunde("fleet_settings", "update", { data: null });
    const r = await salveazaSetariFlota(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("responsabilul din altă firmă (P0001 din trigger) ajunge pe `responsabili`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    const mesaj = "Responsabilul de flotă ales nu este angajat al organizației.";
    server.raspunde("fleet_settings", "select", { data: { id: ID_1 } });
    server.raspunde("fleet_settings", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await salveazaSetariFlota(intrare);
    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", fieldErrors: { responsabili: [mesaj] } },
    });
  });

  it("două prime salvări simultane (23505 pe `fleet_settings_org_uq`) = CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("fleet_settings", "select", { data: null });
    server.raspunde("fleet_settings", "insert", {
      error: eroarePostgrest(
        "23505",
        'duplicate key value violates unique constraint "fleet_settings_org_uq"',
      ),
    });
    const r = await salveazaSetariFlota(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (r.ok) return;
    expect(r.error.message).toContain("între timp");
  });

  it("pragurile greșite se opresc în schemă, pe câmp, fără drum la bază", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    const r = await salveazaSetariFlota({ ...intrare, praguri_alerta_zile: "30, două" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (r.ok) return;
    expect(Object.keys(r.error.fieldErrors ?? {})).toEqual(["praguri_alerta_zile"]);
    expect(server.apeluri).toHaveLength(0);
  });
});
