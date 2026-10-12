// src/app/(app)/mentenanta/echipamente/actions.test.ts
//
// Ciclul de viață al echipamentului (0182): starea, ștergerea logică cu cod
// tastat, corecția și anularea citirilor, citirile în lot, selectorul de puncte
// de lucru. Dreptul real îl decide baza (politica + garda) — aici se verifică ce
// TRIMITE acțiunea: payload-ul, filtrele, `.select()` după scriere, zero rânduri
// tratat ca eroare, clientul folosit (server sau admin) și căile revalidate.

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

import { caiRevalidate, configureazaActiunea, ID_1, ID_2, ID_3, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import {
  anuleazaCitire,
  corecteazaCitire,
  inregistreazaCitiri,
  optiuniPuncteLucru,
  schimbaStareEchipament,
  stergeEchipament,
} from "./actions";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const UPDATE_TEAM = { "maintenance:update": "team" } as const;
const DELETE_ALL = { "maintenance:delete": "all" } as const;
const CITIRE_OWN = { "maintenance:read": "own" } as const;
const ZI = "2026-10-07";

describe("schimbaStareEchipament", () => {
  it("`maintenance:update` own < team: INTERZIS, zero apeluri", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "maintenance:update": "own" },
    });
    const r = await schimbaStareEchipament({ id: ID_1, status: "in_conservare" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("conservare: UPDATE condiționat pe starea curentă, cu `.select()` și revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE_TEAM });
    server.raspunde("equipment", "update", { data: { id: ID_1, status: "in_conservare" } });

    const r = await schimbaStareEchipament({ id: ID_1, status: "in_conservare" });

    expect(r).toEqual({ ok: true, data: { id: ID_1, status: "in_conservare" } });
    const [apel] = server.apeluriPe("equipment", "update");
    expect(apel?.payload).toEqual({ status: "in_conservare", casat_la: null, motiv_casare: null });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "neq", "status", "in_conservare")).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(apel?.terminal).toBe("maybeSingle");
    expect(caiRevalidate()).toEqual(
      expect.arrayContaining([`/mentenanta/echipamente/${ID_1}`, "/mentenanta/contoare"]),
    );
  });

  it("casare fără motiv: VALIDARE pe `motiv_casare`, zero apeluri", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE_TEAM });
    const r = await schimbaStareEchipament({ id: ID_1, status: "casat" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(r.error.fieldErrors).toHaveProperty("motiv_casare");
    expect(server.apeluri).toHaveLength(0);
  });

  it("casare cu motiv și dată: payload-ul le poartă pe amândouă", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE_TEAM });
    server.raspunde("equipment", "update", { data: { id: ID_1, status: "casat" } });

    const r = await schimbaStareEchipament({
      id: ID_1,
      status: "casat",
      casat_la: ZI,
      motiv_casare: "Uzură completă a lanțului cinematic.",
    });

    expect(r).toEqual({ ok: true, data: { id: ID_1, status: "casat" } });
    const [apel] = server.apeluriPe("equipment", "update");
    expect(apel?.payload).toEqual({
      status: "casat",
      casat_la: ZI,
      motiv_casare: "Uzură completă a lanțului cinematic.",
    });
    expect(areFiltru(apel, "neq", "status", "casat")).toBe(true);
  });

  it("zero rânduri la UPDATE: CONFLICT, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE_TEAM });
    server.raspunde("equipment", "update", { data: null });
    const r = await schimbaStareEchipament({ id: ID_1, status: "in_conservare" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("P0001 din garda bazei (sesizări deschise): CONFLICT cu mesajul gărzii", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE_TEAM });
    const mesaj = "Închideți sau respingeți întâi sesizările deschise ale echipamentului.";
    server.raspunde("equipment", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await schimbaStareEchipament({
      id: ID_1,
      status: "casat",
      motiv_casare: "Uzură completă.",
    });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
    expect(caiRevalidate()).toEqual([]);
  });
});

describe("stergeEchipament", () => {
  it("`maintenance:delete` team < all: INTERZIS, zero apeluri", async () => {
    const { server } = configureazaActiunea({
      rol: "manager",
      permisiuni: { "maintenance:delete": "team" },
    });
    const r = await stergeEchipament({ id: ID_1, confirmare: "PRS-01" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("doar `maintenance:update` = all, fără delete: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "maintenance:update": "all" } });
    const r = await stergeEchipament({ id: ID_1, confirmare: "PRS-01" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("codul tastat se compară fără diferență de litere și spații: trece, UPDATE doar pe `deleted_at`", async () => {
    const { server } = configureazaActiunea({ permisiuni: DELETE_ALL });
    server.raspunde("equipment", "select", { data: { id: ID_1, cod: "PRS-01" } });
    server.raspunde("equipment", "update", { data: { id: ID_1 } });

    const r = await stergeEchipament({ id: ID_1, confirmare: "prs-01 " });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [citire] = server.apeluriPe("equipment", "select");
    expect(areFiltru(citire, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
    const [apel] = server.apeluriPe("equipment", "update");
    expect(Object.keys(apel?.payload as object)).toEqual(["deleted_at"]);
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(
      expect.arrayContaining(["/mentenanta", "/mentenanta/echipamente", "/mentenanta/contoare"]),
    );
  });

  it("cod greșit: VALIDARE pe `confirmare`, niciun UPDATE", async () => {
    const { server } = configureazaActiunea({ permisiuni: DELETE_ALL });
    server.raspunde("equipment", "select", { data: { id: ID_1, cod: "PRS-01" } });

    const r = await stergeEchipament({ id: ID_1, confirmare: "PRS-02" });

    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(r.error.fieldErrors).toHaveProperty("confirmare");
    expect(server.apeluriPe("equipment", "update")).toHaveLength(0);
    expect(caiRevalidate()).toEqual([]);
  });

  it("echipament negăsit la citire: NEGASIT, niciun UPDATE", async () => {
    const { server } = configureazaActiunea({ permisiuni: DELETE_ALL });
    server.raspunde("equipment", "select", { data: null });
    const r = await stergeEchipament({ id: ID_1, confirmare: "PRS-01" });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriPe("equipment", "update")).toHaveLength(0);
  });

  it("zero rânduri la UPDATE: NEGASIT, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: DELETE_ALL });
    server.raspunde("equipment", "select", { data: { id: ID_1, cod: "PRS-01" } });
    server.raspunde("equipment", "update", { data: null });
    const r = await stergeEchipament({ id: ID_1, confirmare: "PRS-01" });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(caiRevalidate()).toEqual([]);
  });
});

describe("corecteazaCitire", () => {
  const INTRARE = { id: ID_1, citire: 1250.5, data_citirii: ZI, observatii: "Recitit." } as const;

  it("`maintenance:update` own < team: INTERZIS, zero apeluri", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "maintenance:update": "own" },
    });
    const r = await corecteazaCitire(INTRARE);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("UPDATE pe `equipment_meters` cu valorile noi, filtrat pe organizație, cu `.select()`", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE_TEAM });
    server.raspunde("equipment_meters", "update", { data: { id: ID_1, equipment_id: ID_2 } });

    const r = await corecteazaCitire(INTRARE);

    expect(r).toEqual({ ok: true, data: { id: ID_1, equipment_id: ID_2 } });
    const [apel] = server.apeluriPe("equipment_meters", "update");
    expect(apel?.payload).toEqual({ citire: 1250.5, data_citirii: ZI, observatii: "Recitit." });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBe("id, equipment_id");
    expect(apel?.terminal).toBe("maybeSingle");
    expect(caiRevalidate()).toEqual(
      expect.arrayContaining(["/mentenanta", "/mentenanta/echipamente", "/mentenanta/contoare"]),
    );
  });

  it("citire negativă: VALIDARE, zero apeluri", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE_TEAM });
    const r = await corecteazaCitire({ ...INTRARE, citire: -1 });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(r.error.fieldErrors).toHaveProperty("citire");
    expect(server.apeluri).toHaveLength(0);
  });

  it("P0001 al gărzii (vecinul următor): CONFLICT cu mesajul gărzii", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE_TEAM });
    const mesaj = "Citirea (9500) este mai mare decât citirea următoare (9000).";
    server.raspunde("equipment_meters", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await corecteazaCitire(INTRARE);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("zero rânduri: NEGASIT, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE_TEAM });
    server.raspunde("equipment_meters", "update", { data: null });
    const r = await corecteazaCitire(INTRARE);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(caiRevalidate()).toEqual([]);
  });
});

describe("anuleazaCitire", () => {
  it("`maintenance:update` own < team: INTERZIS, zero apeluri", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "maintenance:update": "own" },
    });
    const r = await anuleazaCitire({ id: ID_1, motiv: "Valoare introdusă greșit." });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("anulare logică: `deleted_at` ISO și motivul în observații, filtrat pe organizație", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE_TEAM });
    server.raspunde("equipment_meters", "update", { data: { id: ID_1, equipment_id: ID_2 } });

    const r = await anuleazaCitire({ id: ID_1, motiv: "Valoare introdusă greșit." });

    expect(r).toEqual({ ok: true, data: { id: ID_1, equipment_id: ID_2 } });
    const [apel] = server.apeluriPe("equipment_meters", "update");
    const payload = apel?.payload as { deleted_at: string; observatii: string };
    expect(payload.deleted_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(payload.observatii).toBe("Anulată: Valoare introdusă greșit.");
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBe("id, equipment_id");
    expect(apel?.terminal).toBe("maybeSingle");
  });

  it("motiv prea scurt: VALIDARE pe `motiv`, zero apeluri", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE_TEAM });
    const r = await anuleazaCitire({ id: ID_1, motiv: "ab" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(r.error.fieldErrors).toHaveProperty("motiv");
    expect(server.apeluri).toHaveLength(0);
  });

  it("zero rânduri: NEGASIT, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE_TEAM });
    server.raspunde("equipment_meters", "update", { data: null });
    const r = await anuleazaCitire({ id: ID_1, motiv: "Valoare introdusă greșit." });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(caiRevalidate()).toEqual([]);
  });
});

describe("inregistreazaCitiri", () => {
  const LOT = {
    data_citirii: ZI,
    citiri: [
      { equipment_id: ID_1, tip: "ore", citire: 1200 },
      { equipment_id: ID_2, tip: "km", citire: 90 },
    ],
  } as const;

  it("fără `maintenance:read`: INTERZIS, zero apeluri", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: {} });
    const r = await inregistreazaCitiri(LOT);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("listă goală: VALIDARE pe `citiri`, zero apeluri", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    const r = await inregistreazaCitiri({ data_citirii: ZI, citiri: [] });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(r.error.fieldErrors).toHaveProperty("citiri");
    expect(server.apeluri).toHaveLength(0);
  });

  it("două citiri acceptate: câte un INSERT fiecare, raport cu 2 reușite", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    server.raspunde("equipment_meters", "insert", { data: null });
    server.raspunde("equipment_meters", "insert", { data: null });

    const r = await inregistreazaCitiri(LOT);

    expect(r).toEqual({
      ok: true,
      data: {
        reusite: 2,
        refuzate: 0,
        randuri: [
          { equipment_id: ID_1, tip: "ore", ok: true, mesaj: null },
          { equipment_id: ID_2, tip: "km", ok: true, mesaj: null },
        ],
      },
    });
    const inserari = server.apeluriPe("equipment_meters", "insert");
    expect(inserari).toHaveLength(2);
    expect(inserari[0]?.payload).toEqual({
      organization_id: ORG_ID,
      equipment_id: ID_1,
      tip: "ore",
      citire: 1200,
      data_citirii: ZI,
      sursa: "lot",
    });
    expect(inserari[1]?.payload).toEqual({
      organization_id: ORG_ID,
      equipment_id: ID_2,
      tip: "km",
      citire: 90,
      data_citirii: ZI,
      sursa: "lot",
    });
    expect(caiRevalidate()).toEqual(
      expect.arrayContaining(["/mentenanta", "/mentenanta/contoare", "/mentenanta/echipamente"]),
    );
  });

  it("a doua citire refuzată de gardă (P0001): rândul ei poartă mesajul gărzii, prima rămâne reușită", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    const mesaj = "Citirea (90) este mai mică decât ultima citire înregistrată (100).";
    server.raspunde("equipment_meters", "insert", { data: null });
    server.raspunde("equipment_meters", "insert", { error: eroarePostgrest("P0001", mesaj) });

    const r = await inregistreazaCitiri(LOT);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.reusite).toBe(1);
    expect(r.data.refuzate).toBe(1);
    expect(r.data.randuri[0]).toMatchObject({ equipment_id: ID_1, ok: true });
    expect(r.data.randuri[1]).toMatchObject({ equipment_id: ID_2, ok: false, mesaj });
  });

  it("refuz 42501: mesajul fix despre dreptul pe echipament", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    server.raspunde("equipment_meters", "insert", { error: eroarePostgrest("42501") });

    const r = await inregistreazaCitiri({ data_citirii: ZI, citiri: [LOT.citiri[0]] });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.refuzate).toBe(1);
    expect(r.data.randuri[0]).toMatchObject({
      ok: false,
      mesaj: "Nu aveți dreptul de a înregistra citiri pe acest echipament.",
    });
  });

  it("eroare netradusă (XX000): rândul e refuzat cu un mesaj nenul, acțiunea nu aruncă", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    server.raspunde("equipment_meters", "insert", { error: eroarePostgrest("XX000") });

    const r = await inregistreazaCitiri({ data_citirii: ZI, citiri: [LOT.citiri[0]] });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toMatchObject({ reusite: 0, refuzate: 1 });
    const [rand] = r.data.randuri;
    expect(rand?.ok).toBe(false);
    expect(rand?.mesaj ?? "").not.toHaveLength(0);
  });
});

describe("optiuniPuncteLucru", () => {
  it("`maintenance:update` own < team: INTERZIS, zero apeluri", async () => {
    const { server, admin } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "maintenance:update": "own" },
    });
    const r = await optiuniPuncteLucru({});
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
    expect(admin.apeluriPe("puncte_lucru")).toHaveLength(0);
  });

  it("citește prin clientul admin, filtrat explicit pe organizație, și mapează `denumire` la `nume`", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: UPDATE_TEAM });
    admin.raspunde("puncte_lucru", "select", {
      data: [
        { id: ID_1, denumire: "Hala A" },
        { id: ID_3, denumire: "Depozit Nord" },
      ],
    });

    const r = await optiuniPuncteLucru({});

    expect(r).toEqual({
      ok: true,
      data: [
        { id: ID_1, nume: "Hala A" },
        { id: ID_3, nume: "Depozit Nord" },
      ],
    });
    const [apel] = admin.apeluriPe("puncte_lucru", "select");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "activ", true)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.filtre).toContainEqual({ metoda: "limit", argumente: [200] });
    expect(server.apeluri).toHaveLength(0);
  });
});
