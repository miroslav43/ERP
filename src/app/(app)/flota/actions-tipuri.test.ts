// src/app/(app)/flota/actions-tipuri.test.ts
//
// Nomenclatorul firmei (0202), pe clientul fals: setarea pe tipurile de
// platformă și tipurile proprii. Proba reală (activarea per firmă, refuzul pe
// tipul propriu, rolurile) e în `tests/rls/proba-flota-tipuri-fisiere.sql` și în
// `izolare.sql` (l).

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
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";

import {
  actualizeazaTipDocument,
  creeazaTipDocument,
  salveazaSetareTipDocument,
} from "./actions-tipuri";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const CAI = ["/flota/setari/documente", "/flota", "/portal/masina-mea"];

describe("salveazaSetareTipDocument", () => {
  const intrare = { document_type_id: ID_1, activ: true, obligatoriu: true };

  it.each([["team"], ["own"], ["none"]] as const)(
    "sub `vehicles:update = %s`: INTERZIS, fără niciun drum la bază",
    async (scope) => {
      const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": scope } });
      const r = await salveazaSetareTipDocument(intrare);
      expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
      expect(server.apeluri).toHaveLength(0);
    },
  );

  it("prima setare a firmei: INSERT cu firma și autorul, după ce tipul e de platformă", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("vehicle_document_types", "select", {
      data: { id: ID_1, organization_id: null },
    });
    server.raspunde("vehicle_document_type_setari", "select", { data: null });
    server.raspunde("vehicle_document_type_setari", "insert", { data: { id: ID_2 } });

    const r = await salveazaSetareTipDocument(intrare);

    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    const [citire] = server.apeluriPe("vehicle_document_type_setari", "select");
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "eq", "document_type_id", ID_1)).toBe(true);
    expect(server.apeluriPe("vehicle_document_type_setari", "insert")[0]?.payload).toEqual({
      document_type_id: ID_1,
      activ: true,
      obligatoriu: true,
      organization_id: ORG_ID,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("a doua setare: UPDATE pe rândul firmei, cu `.select()`; zero rânduri = CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("vehicle_document_types", "select", {
      data: { id: ID_1, organization_id: null },
    });
    server.raspunde("vehicle_document_type_setari", "select", { data: { id: ID_2 } });
    server.raspunde("vehicle_document_type_setari", "update", { data: null });

    const r = await salveazaSetareTipDocument({ ...intrare, activ: false });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    const [scriere] = server.apeluriPe("vehicle_document_type_setari", "update");
    expect(scriere?.payload).toEqual({ activ: false, obligatoriu: true, updated_by: USER_ID });
    expect(areFiltru(scriere, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(scriere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(scriere?.selectDupaScriere).toBe("id");
  });

  it("pe un tip PROPRIU: refuz înaintea bazei, fără nicio scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("vehicle_document_types", "select", {
      data: { id: ID_1, organization_id: ORG_ID },
    });
    const r = await salveazaSetareTipDocument(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("vehicle_document_type_setari")).toHaveLength(0);
  });

  it("două prime setări simultane (23505 pe `vdts_org_tip_uq`) = CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("vehicle_document_types", "select", {
      data: { id: ID_1, organization_id: null },
    });
    server.raspunde("vehicle_document_type_setari", "select", { data: null });
    server.raspunde("vehicle_document_type_setari", "insert", {
      error: eroarePostgrest(
        "23505",
        'duplicate key value violates unique constraint "vdts_org_tip_uq"',
      ),
    });
    const r = await salveazaSetareTipDocument(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("creeazaTipDocument", () => {
  const intrare = {
    denumire: "Autorizație de transport județean",
    cere_expirare: true,
    obligatoriu: true,
    categorii_aplicabile: ["camion", "camion"],
    masa_max_kg: "",
  };

  it("sub `vehicles:create` diferit de `all`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:create": "team" } });
    const r = await creeazaTipDocument(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("INSERT cu codul din denumire, `activ: true` și autorul explicite", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:create": "all" } });
    server.raspunde("vehicle_document_types", "select", { data: null });
    server.raspunde("vehicle_document_types", "insert", { data: { id: ID_1 } });

    const r = await creeazaTipDocument(intrare);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [verificare] = server.apeluriPe("vehicle_document_types", "select");
    expect(areFiltru(verificare, "is", "organization_id", null)).toBe(true);
    expect(areFiltru(verificare, "eq", "cod", "autorizatie_de_transport_judetean")).toBe(true);
    expect(server.apeluriPe("vehicle_document_types", "insert")[0]?.payload).toEqual({
      denumire: "Autorizație de transport județean",
      descriere: null,
      cere_expirare: true,
      obligatoriu: true,
      categorii_aplicabile: ["camion"],
      masa_max_kg: null,
      cod: "autorizatie_de_transport_judetean",
      organization_id: ORG_ID,
      activ: true,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("lista goală de categorii se trimite `null` (oricare), nu `{}`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:create": "all" } });
    server.raspunde("vehicle_document_types", "select", { data: null });
    server.raspunde("vehicle_document_types", "insert", { data: { id: ID_1 } });
    await creeazaTipDocument({ ...intrare, categorii_aplicabile: [] });
    expect(server.apeluriPe("vehicle_document_types", "insert")[0]?.payload).toMatchObject({
      categorii_aplicabile: null,
    });
  });

  it("denumirea unui tip de platformă: refuz pe `denumire`, cu tipul de activat", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:create": "all" } });
    server.raspunde("vehicle_document_types", "select", { data: { denumire: "Asigurare RCA" } });
    const r = await creeazaTipDocument({ ...intrare, denumire: "RCA" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (r.ok) return;
    expect(r.error.fieldErrors?.denumire?.[0]).toMatch(/„Asigurare RCA”/u);
    expect(server.apeluriPe("vehicle_document_types", "insert")).toHaveLength(0);
  });

  it("aceeași denumire de două ori în firmă (23505 pe `vdt_org_cod_uq`) ajunge pe `denumire`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:create": "all" } });
    server.raspunde("vehicle_document_types", "select", { data: null });
    server.raspunde("vehicle_document_types", "insert", {
      error: eroarePostgrest(
        "23505",
        'duplicate key value violates unique constraint "vdt_org_cod_uq"',
      ),
    });
    const r = await creeazaTipDocument(intrare);
    expect(r).toMatchObject({
      ok: false,
      error: {
        code: "VALIDARE",
        fieldErrors: { denumire: ["Firma are deja un tip de document cu această denumire."] },
      },
    });
  });

  it("mesajul de coliziune din 0018 (cu sedilă) ajunge tot pe `denumire`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:create": "all" } });
    server.raspunde("vehicle_document_types", "select", { data: null });
    server.raspunde("vehicle_document_types", "insert", {
      error: eroarePostgrest(
        "P0001",
        "Codul „rca” este deja folosit de un tip de document de platformă. Alegeţi alt cod pentru tipul propriu organizaţiei dumneavoastră.",
      ),
    });
    const r = await creeazaTipDocument(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (r.ok) return;
    expect(Object.keys(r.error.fieldErrors ?? {})).toEqual(["denumire"]);
  });
});

describe("actualizeazaTipDocument", () => {
  const intrare = {
    id: ID_1,
    activ: false,
    denumire: "Autorizație locală",
    cere_expirare: true,
    obligatoriu: true,
    categorii_aplicabile: null,
    masa_max_kg: "3500",
  };

  it("UPDATE filtrat pe firmă (exclude platforma), fără cod; retras ⇒ neobligatoriu", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("vehicle_document_types", "update", { data: { id: ID_1 } });

    const r = await actualizeazaTipDocument(intrare);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [scriere] = server.apeluriPe("vehicle_document_types", "update");
    expect(scriere?.payload).toEqual({
      activ: false,
      denumire: "Autorizație locală",
      descriere: null,
      cere_expirare: true,
      obligatoriu: false,
      categorii_aplicabile: null,
      masa_max_kg: 3500,
      updated_by: USER_ID,
    });
    expect(scriere?.payload).not.toHaveProperty("cod");
    expect(areFiltru(scriere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(scriere, "eq", "id", ID_1)).toBe(true);
    expect(scriere?.selectDupaScriere).toBe("id");
  });

  it("zero rânduri (tip de platformă sau al altei firme) = NEGASIT, nu succes tăcut", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("vehicle_document_types", "update", { data: null });
    const r = await actualizeazaTipDocument(intrare);
    expect(r.ok).toBe(false);
  });
});
