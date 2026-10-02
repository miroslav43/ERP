// src/app/(app)/salarizare/actions.test.ts
//
// TESTUL CANONIC al acțiunilor construite cu `createAction`. Celelalte
// `actions.test.ts` copiază de aici blocul de `vi.mock` și forma testelor.
//
// Straturile 1–3 și 5 (autentificare, organizație, modul, Zod) sunt cod COMUN
// al lui `createAction`: se verifică aici, o dată, pe `inchidePerioada`.
// Testele per modul verifică doar ce e specific acțiunii: permisiunea și
// pragul de scope (stratul 4), handlerul (6), auditul (7) și revalidarea (8).

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
  ORG_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import { inchidePerioada } from "./actions";

const PERMIS = { "payroll:approve": "all" } as const;

beforeEach(() => {
  // Liniștește jurnalele de refuz/eroare ale lui `createAction`; aserțiile
  // se fac pe rezultat și pe apelurile falsului, nu pe consolă.
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("createAction — straturile comune (pe inchidePerioada)", () => {
  it("1. fără sesiune: NEAUTENTIFICAT, fără client și fără audit", async () => {
    const { server } = configureazaActiunea({ sesiune: "neautentificat", permisiuni: PERMIS });
    const r = await inchidePerioada({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "NEAUTENTIFICAT" } });
    expect(server.apeluri).toHaveLength(0);
    expect(server.audituri()).toHaveLength(0);
  });

  it("2. fără organizație activă: FARA_ORGANIZATIE, audit `denied` fără organizație", async () => {
    const { server } = configureazaActiunea({ sesiune: "fara_organizatie", permisiuni: PERMIS });
    const r = await inchidePerioada({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "FARA_ORGANIZATIE" } });
    expect(server.apeluri).toHaveLength(0);
    expect(server.audituri()).toEqual([
      expect.objectContaining({ p_status: "denied", p_organization_id: null }),
    ]);
  });

  it("3. modulul dezactivat: MODUL_DEZACTIVAT înaintea permisiunii", async () => {
    const { server } = configureazaActiunea({ functii: ["leave"], permisiuni: PERMIS });
    const r = await inchidePerioada({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "MODUL_DEZACTIVAT" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("4. permisiune lipsă: INTERZIS, fără nicio interogare și cu audit `denied`", async () => {
    const { server } = configureazaActiunea({ permisiuni: {} });
    const r = await inchidePerioada({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
    expect(server.audituri()).toEqual([
      expect.objectContaining({
        p_status: "denied",
        p_error_code: "INTERZIS",
        p_organization_id: ORG_ID,
      }),
    ]);
  });

  it("4. scope sub prag (`team` < `all`): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "payroll:approve": "team" } });
    const r = await inchidePerioada({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("5. validarea vine DUPĂ autorizare: intrare invalidă fără drept ⇒ INTERZIS, nu VALIDARE", async () => {
    configureazaActiunea({ permisiuni: {} });
    const r = await inchidePerioada({ id: "nu-e-uuid" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS", fieldErrors: null } });
  });

  it("5. intrare invalidă cu drept: VALIDARE cu erori pe câmp", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await inchidePerioada({ id: "nu-e-uuid" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(r.error.fieldErrors).toHaveProperty("id");
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("inchidePerioada", () => {
  it("succes: UPDATE pe id + organizație, cu `.select()` după scriere (capcana 17)", async () => {
    const { server } = configureazaActiunea({ rol: "org_admin", permisiuni: PERMIS });
    server.raspunde("payroll_periods", "update", { data: { id: ID_1, status: "inchis" } });

    const r = await inchidePerioada({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: null });
    const [apel, ...altele] = server.apeluriPe("payroll_periods");
    expect(altele).toHaveLength(0);
    expect(apel?.operatie).toBe("update");
    expect(apel?.payload).toEqual({ status: "inchis" });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(apel?.terminal).toBe("maybeSingle");
  });

  it("succes: auditul `success` se scrie în `after()`, cu entitatea și allow-list-ul", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_periods", "update", { data: { id: ID_1, status: "inchis" } });

    await inchidePerioada({ id: ID_1 });
    await asteaptaDupa();

    expect(server.audituri()).toEqual([
      expect.objectContaining({
        p_status: "success",
        p_action: "update",
        p_entity_type: "payroll_period",
        p_after: { id: ID_1 },
      }),
    ]);
  });

  it("succes: revalidează exact căile declarate", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_periods", "update", { data: { id: ID_1, status: "inchis" } });
    await inchidePerioada({ id: ID_1 });
    expect(caiRevalidate()).toEqual(["/salarizare", "/panou"]);
  });

  it("zero rânduri afectate (USING a respins tăcut): CONFLICT, nu succes, și nicio revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_periods", "update", { data: null });

    const r = await inchidePerioada({ id: ID_1 });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
    expect(server.audituri()).toEqual([
      expect.objectContaining({ p_status: "failure", p_error_code: "CONFLICT" }),
    ]);
  });

  it("P0001 din triggerul de tranziție: CONFLICT cu textul triggerului propagat", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const mesaj = "Perioada 8/2026 nu poate fi închisă: nu este aprobată.";
    server.raspunde("payroll_periods", "update", { error: eroarePostgrest("P0001", mesaj) });

    const r = await inchidePerioada({ id: ID_1 });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });

  it("42501 (RLS): INTERZIS pe calea generică", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_periods", "update", { error: eroarePostgrest("42501") });
    const r = await inchidePerioada({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
  });
});
