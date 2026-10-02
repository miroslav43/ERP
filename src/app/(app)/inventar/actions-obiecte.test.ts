// src/app/(app)/inventar/actions-obiecte.test.ts
//
// Registrul de obiecte: creare, corectare, casare și readucerea în stoc după
// reparație. Toate patru cer `inventory:update = all` (`hr` îl are; `manager`
// și `employee` au doar `read`). Straturile comune ale lui `createAction` sunt
// în `salarizare/actions.test.ts`.

import { beforeEach, describe, expect, it, vi } from "vitest";

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
  ORG_ID,
  USER_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import { actualizeazaObiect, caseazaObiect, creeazaObiect, readuInStoc } from "./actions";

const SCRIERE = { "inventory:update": "all" } as const;
/** `manager` din seed: citește inventarul echipei, nu-l scrie. */
const MANAGER = { "inventory:read": "team", "inventory:update": "team" } as const;

const obiect = (modificari: Record<string, unknown> = {}) => ({
  denumire: "Laptop Dell Latitude",
  numar_inventar: "LT-0012",
  serie: "SN-998877",
  valoare: "4599,90",
  data_achizitie: "2026-03-01",
  garantie_expira: "2028-03-01",
  ...modificari,
});

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("creeazaObiect", () => {
  it("scope `team` pe `inventory:update` (sub `all`): INTERZIS, fără interogare", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: MANAGER });
    const r = await creeazaObiect(obiect());
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes (`hr`): intră „în stoc”, cu autorul, iar valoarea cu virgulă devine număr", async () => {
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: SCRIERE });
    server.raspunde("inventory_items", "insert", {
      data: { id: ID_1, denumire: "Laptop Dell Latitude" },
    });

    const r = await creeazaObiect(obiect());

    expect(r).toEqual({ ok: true, data: { id: ID_1, denumire: "Laptop Dell Latitude" } });
    const [apel] = server.apeluriPe("inventory_items");
    expect(apel?.operatie).toBe("insert");
    expect(apel?.payload).toMatchObject({
      organization_id: ORG_ID,
      status: "in_stoc",
      created_by: USER_ID,
      updated_by: USER_ID,
      numar_inventar: "LT-0012",
      valoare: 4599.9,
      stare: "nou",
    });
    expect(apel?.selectDupaScriere).toBe("id, denumire");
    expect(caiRevalidate()).toEqual(["/inventar", "/portal", "/portal/in-primirea-mea"]);
  });

  it("auditul poartă id-ul întors de bază", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    server.raspunde("inventory_items", "insert", { data: { id: ID_1, denumire: "Monitor" } });
    await creeazaObiect(obiect());
    await asteaptaDupa();
    expect(server.audituri()).toEqual([
      expect.objectContaining({
        p_status: "success",
        p_entity_type: "inventory_item",
        p_entity_id: ID_1,
      }),
    ]);
  });

  it("23505 (număr de inventar luat): CONFLICT cu mesajul inventarului", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    server.raspunde("inventory_items", "insert", { error: eroarePostgrest("23505") });
    const r = await creeazaObiect(obiect());
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Există deja un obiect cu acest număr de inventar." },
    });
  });

  it.each([
    [{ garantie_expira: "2026-01-01" }, "garantie_expira"],
    [{ valoare: "-5" }, "valoare"],
    [{ numar_inventar: "-LT" }, "numar_inventar"],
  ])("regulile schemei: %j ⇒ eroare pe %s", async (modificari, camp) => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    const r = await creeazaObiect(obiect(modificari));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(r.error.fieldErrors).toHaveProperty(camp);
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("actualizeazaObiect", () => {
  it("scope `team`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: MANAGER });
    const r = await actualizeazaObiect({ id: ID_1, ...obiect() });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: UPDATE pe id + organizație, fără `status` și fără `id` în payload", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    server.raspunde("inventory_items", "update", { data: { id: ID_1 } });

    const r = await actualizeazaObiect({ id: ID_1, ...obiect({ locatie: "Depozit 2" }) });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("inventory_items");
    expect(apel?.payload).toMatchObject({ locatie: "Depozit 2", updated_by: USER_ID });
    for (const camp of ["id", "status", "organization_id", "created_by"]) {
      expect(apel?.payload).not.toHaveProperty(camp);
    }
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/inventar", `/inventar/${ID_1}`]);
  });

  it("zero rânduri: NEGASIT, nicio revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    server.raspunde("inventory_items", "update", { data: null });
    const r = await actualizeazaObiect({ id: ID_1, ...obiect() });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(caiRevalidate()).toEqual([]);
  });
});

describe("caseazaObiect", () => {
  it("scope `team`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: MANAGER });
    const r = await caseazaObiect({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: trece pe „casat”, cu autorul și `.select()` după UPDATE", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    server.raspunde("inventory_items", "update", { data: { id: ID_1 } });

    const r = await caseazaObiect({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("inventory_items");
    expect(apel?.payload).toEqual({ status: "casat", updated_by: USER_ID });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/inventar", `/inventar/${ID_1}`]);
  });

  it("obiect încă predat (P0001 din trigger): mesajul bazei, CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    const mesaj = "Obiectul este predat unui angajat. Înregistrați întâi returnarea.";
    server.raspunde("inventory_items", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await caseazaObiect({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });

  it("zero rânduri: NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    server.raspunde("inventory_items", "update", { data: null });
    const r = await caseazaObiect({ id: ID_2 });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
  });
});

describe("readuInStoc", () => {
  it("scope `team`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: MANAGER });
    const r = await readuInStoc({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: doar un obiect aflat în reparație revine „în stoc”", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    server.raspunde("inventory_items", "update", { data: { id: ID_1 } });

    const r = await readuInStoc({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("inventory_items");
    expect(apel?.payload).toEqual({ status: "in_stoc", updated_by: USER_ID });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "status", "in_reparatie")).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/inventar", `/inventar/${ID_1}`]);
  });

  it("auditul de succes e un `update` pe obiectul readus", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    server.raspunde("inventory_items", "update", { data: { id: ID_1 } });
    await readuInStoc({ id: ID_1 });
    await asteaptaDupa();
    expect(server.audituri()).toEqual([
      expect.objectContaining({
        p_status: "success",
        p_action: "update",
        p_entity_type: "inventory_item",
        p_entity_id: ID_1,
      }),
    ]);
  });

  it("zero rânduri (nu mai e în reparație): NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    server.raspunde("inventory_items", "update", { data: null });
    const r = await readuInStoc({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(caiRevalidate()).toEqual([]);
  });
});
