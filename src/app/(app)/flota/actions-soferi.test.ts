// src/app/(app)/flota/actions-soferi.test.ts
//
// Permisele șoferilor și foaia legată de deplasare (0201), pe clientul fals.
// Ce refuză baza (categoriile, unicitatea, cheia compusă, mutarea, garda de
// angajat) e probat real în `tests/rls/proba-flota-soferi.sql`; aici se
// fixează ce PLEACĂ spre ea și cum se întorc refuzurile ei.

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
import { actualizeazaPermis, adaugaPermis, legaDeplasarea, stergePermis } from "./actions-soferi";

const ACUM = "2026-10-12T10:00:00.000Z";

const permis = (m: Record<string, unknown> = {}) => ({
  employee_id: ID_2,
  numar: "AB123456",
  categorii: ["b", "ce"],
  eliberat_la: "2020-01-10",
  expira_la: "2030-01-10",
  observatii: "",
  ...m,
});

const caiPermis = [`/angajati/${ID_2}`, "/portal", "/portal/masina-mea", "/flota/foi"];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(ACUM));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("adaugaPermis", () => {
  it("fără `driver_licenses:create` (managerul doar citește): INTERZIS, fără interogare", async () => {
    const { server } = configureazaActiunea({
      rol: "manager",
      permisiuni: { "driver_licenses:read": "team" },
    });
    const r = await adaugaPermis(permis());
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("cu flota oprită: refuzat înainte de bază", async () => {
    const { server } = configureazaActiunea({
      rol: "hr",
      functii: ["nucleu"],
      permisiuni: { "driver_licenses:create": "all" },
    });
    const r = await adaugaPermis(permis());
    expect(r.ok).toBe(false);
    expect(server.apeluri).toHaveLength(0);
  });

  it("hr: INSERT cu categoriile din lege, autorul explicit, fără fișier; revalidează fișa și portalul", async () => {
    const { server } = configureazaActiunea({
      rol: "hr",
      permisiuni: { "driver_licenses:create": "all" },
    });
    server.raspunde("driver_licenses", "insert", { data: { id: ID_1 } });

    const r = await adaugaPermis(permis());
    await asteaptaDupa();

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("driver_licenses", "insert");
    expect(apel?.payload).toEqual({
      organization_id: ORG_ID,
      employee_id: ID_2,
      numar: "AB123456",
      categorii: ["B", "CE"],
      eliberat_la: "2020-01-10",
      expira_la: "2030-01-10",
      observatii: null,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    expect(apel?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual(caiPermis);
    const [audit] = server.audituri();
    expect(audit).toMatchObject({
      p_action: "create",
      p_entity_type: "driver_license",
      p_entity_id: ID_1,
    });
    expect(audit?.p_after).not.toHaveProperty("numar");
  });

  it("al doilea permis activ (23505 pe indexul parțial): CONFLICT cu îndrumare spre reînnoire", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "driver_licenses:create": "all" } });
    server.raspunde("driver_licenses", "insert", {
      error: eroarePostgrest(
        "23505",
        'duplicate key value violates unique constraint "driver_licenses_angajat_uq"',
      ),
    });
    const r = await adaugaPermis(permis());
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (r.ok) return;
    expect(r.error.message).toContain("Reînnoirea");
  });

  it("P0001 pe categorie: mesajul bazei ajunge pe câmpul `categorii`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "driver_licenses:create": "all" } });
    const mesaj = "Categoria „Q” nu există pe permisul de conducere românesc.";
    server.raspunde("driver_licenses", "insert", { error: eroarePostgrest("P0001", mesaj) });
    const r = await adaugaPermis(permis());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(r.error.fieldErrors?.["categorii"]).toEqual([mesaj]);
  });

  it("schema refuză o categorie inexistentă înainte de bază", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "driver_licenses:create": "all" } });
    const r = await adaugaPermis(permis({ categorii: ["B", "Z"] }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.fieldErrors).toHaveProperty("categorii");
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("actualizeazaPermis", () => {
  it("reînnoirea: UPDATE filtrat pe id, angajat, firmă și rândul viu, cu `.select()`", async () => {
    const { server } = configureazaActiunea({
      rol: "hr",
      permisiuni: { "driver_licenses:update": "all" },
    });
    server.raspunde("driver_licenses", "update", { data: { id: ID_1 } });

    const r = await actualizeazaPermis({ id: ID_1, ...permis({ expira_la: "2035-01-10" }) });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("driver_licenses", "update");
    expect(apel?.payload).toMatchObject({ expira_la: "2035-01-10", updated_by: USER_ID });
    expect(apel?.payload).not.toHaveProperty("employee_id");
    expect(apel?.payload).not.toHaveProperty("organization_id");
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "employee_id", ID_2)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(caiPermis);
  });

  it("zero rânduri (USING a refuzat sau permisul s-a șters): CONFLICT, nu reușită", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "driver_licenses:update": "all" } });
    server.raspunde("driver_licenses", "update", { data: null });
    const r = await actualizeazaPermis({ id: ID_1, ...permis() });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("mutarea pe alt angajat (P0001 fără câmp): CONFLICT cu mesajul bazei", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "driver_licenses:update": "all" } });
    const mesaj =
      "Permisul nu se mută pe alt angajat. Ștergeți-l și înregistrați-l pe fișa corectă.";
    server.raspunde("driver_licenses", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await actualizeazaPermis({ id: ID_1, ...permis() });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });
});

describe("stergePermis", () => {
  it("ștergere logică cu momentul acțiunii; zero rânduri = CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "driver_licenses:update": "all" } });
    server.raspunde("driver_licenses", "update", { data: { id: ID_1 } });

    const r = await stergePermis({ id: ID_1, employee_id: ID_2 });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("driver_licenses", "update");
    expect(apel?.payload).toEqual({ deleted_at: ACUM, updated_by: USER_ID });
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);

    const { server: s2 } = configureazaActiunea({
      permisiuni: { "driver_licenses:update": "all" },
    });
    s2.raspunde("driver_licenses", "update", { data: null });
    expect(await stergePermis({ id: ID_1, employee_id: ID_2 })).toMatchObject({
      ok: false,
      error: { code: "CONFLICT" },
    });
  });
});

describe("legaDeplasarea", () => {
  it("șoferul (`own`) își leagă ciorna de deplasare; filtrul pe ciornă e acolo", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "trip_sheets:update": "own" },
    });
    server.raspunde("trip_sheets", "update", { data: { id: ID_1 } });

    const r = await legaDeplasarea({ id: ID_1, business_trip_id: ID_3 });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("trip_sheets", "update");
    expect(apel?.payload).toEqual({ business_trip_id: ID_3, updated_by: USER_ID });
    expect(areFiltru(apel, "eq", "status", "draft")).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(caiRevalidate()).toContain(`/portal/masina-mea/foi/${ID_1}`);
  });

  it("valoarea goală desface legătura", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "all" } });
    server.raspunde("trip_sheets", "update", { data: { id: ID_1 } });
    await legaDeplasarea({ id: ID_1, business_trip_id: "" });
    expect(server.apeluriPe("trip_sheets", "update")[0]?.payload).toMatchObject({
      business_trip_id: null,
    });
  });

  it("garda bazei (deplasarea altui angajat) ajunge pe selector", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    const mesaj =
      "Deplasarea aleasă este a altui angajat. Foaia se leagă doar de o deplasare a șoferului ei.";
    server.raspunde("trip_sheets", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await legaDeplasarea({ id: ID_1, business_trip_id: ID_3 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.fieldErrors?.["business_trip_id"]).toEqual([mesaj]);
  });

  it("foaia nu mai e ciornă (zero rânduri): CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    server.raspunde("trip_sheets", "update", { data: null });
    expect(await legaDeplasarea({ id: ID_1, business_trip_id: ID_3 })).toMatchObject({
      ok: false,
      error: { code: "CONFLICT" },
    });
  });
});
