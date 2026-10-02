// src/app/(app)/salarizare/popriri/actions.test.ts
//
// Dosarele de poprire: deschiderea și închiderea/redeschiderea manuală.
// Straturile comune ale lui `createAction` sunt în testul canonic
// (`salarizare/actions.test.ts`).

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
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import { creeazaPoprire, inchidePoprire } from "./actions";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const CAI = ["/salarizare/popriri", "/salarizare"];

// ── creeazaPoprire ───────────────────────────────────────────────────────────

describe("creeazaPoprire", () => {
  const PERMIS = { "payroll:create": "all" } as const;
  const INTRARE = {
    employee_id: ID_2,
    dosar: " 123/2026 ",
    creditor: "Banca Exemplu SA",
    executor: "BEJ Popescu",
    tip_creanta: "intretinere",
    suma_totala: "12000",
    suma_lunara: "800",
    prioritate: "10",
    data_inceput: "2026-05-01",
    data_sfarsit: "",
    observatii: "Pensie de întreținere pentru doi copii",
  };

  it("scope `team` sub pragul `all`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "payroll:create": "team" } });
    const r = await creeazaPoprire(INTRARE);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: deschide dosarul în organizația curentă, fără `suma_recuperata` (o calculează triggerul)", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_garnishments", "insert", { data: { id: ID_1 } });

    const r = await creeazaPoprire(INTRARE);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [insert] = server.apeluriPe("payroll_garnishments", "insert");
    expect(insert?.payload).toEqual({
      organization_id: ORG_ID,
      employee_id: ID_2,
      dosar: "123/2026",
      creditor: "Banca Exemplu SA",
      executor: "BEJ Popescu",
      tip_creanta: "intretinere",
      suma_totala: 12000,
      suma_lunara: 800,
      prioritate: 10,
      data_inceput: "2026-05-01",
      data_sfarsit: null,
      observatii: "Pensie de întreținere pentru doi copii",
    });
    expect(insert?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("creditorul și observațiile rămân în afara jurnalului de audit", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_garnishments", "insert", { data: { id: ID_1 } });

    await creeazaPoprire(INTRARE);
    await asteaptaDupa();

    const [audit] = server.audituri();
    expect(audit).toMatchObject({ p_status: "success", p_entity_type: "payroll_garnishment" });
    expect(audit?.p_after).toEqual({
      employee_id: ID_2,
      dosar: "123/2026",
      tip_creanta: "intretinere",
      prioritate: 10,
      data_inceput: "2026-05-01",
      data_sfarsit: null,
    });
  });

  it("data de sfârșit înaintea celei de început: VALIDARE pe `data_sfarsit`", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await creeazaPoprire({ ...INTRARE, data_sfarsit: "2026-04-30" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(r.error.fieldErrors).toHaveProperty("data_sfarsit");
    expect(server.apeluri).toHaveLength(0);
  });

  it("suma lunară peste datoria totală: VALIDARE pe `suma_lunara`", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await creeazaPoprire({ ...INTRARE, suma_lunara: "12000.01" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.fieldErrors).toHaveProperty("suma_lunara");
    expect(server.apeluri).toHaveLength(0);
  });

  it("suma lunară egală cu datoria e acceptată", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_garnishments", "insert", { data: { id: ID_1 } });
    const r = await creeazaPoprire({ ...INTRARE, suma_lunara: "12000" });
    expect(r.ok).toBe(true);
  });

  it("inserare fără rând întors: CONFLICT, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_garnishments", "insert", { data: null });

    const r = await creeazaPoprire(INTRARE);

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("dosar duplicat (23505): mesajul generic al modulului", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_garnishments", "insert", {
      error: eroarePostgrest("23505", 'duplicate key "payroll_garnishments_dosar_uq"'),
    });

    const r = await creeazaPoprire(INTRARE);

    expect(r).toMatchObject({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Există deja o înregistrare de salarizare cu aceste date.",
      },
    });
  });
});

// ── inchidePoprire ───────────────────────────────────────────────────────────

describe("inchidePoprire", () => {
  const PERMIS = { "payroll:update": "all" } as const;

  it("scope `team` sub pragul `all`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "payroll:update": "team" } });
    const r = await inchidePoprire({ id: ID_1, activa: false });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it.each([false, true])(
    "succes: scrie `activa=%s` pe id + organizație, pe un dosar viu, cu `.select()`",
    async (activa) => {
      const { server } = configureazaActiunea({ permisiuni: PERMIS });
      server.raspunde("payroll_garnishments", "update", { data: { id: ID_1 } });

      const r = await inchidePoprire({ id: ID_1, activa });

      expect(r).toEqual({ ok: true, data: null });
      const [update] = server.apeluriPe("payroll_garnishments", "update");
      expect(update?.payload).toEqual({ activa });
      expect(areFiltru(update, "eq", "id", ID_1)).toBe(true);
      expect(areFiltru(update, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(update, "is", "deleted_at", null)).toBe(true);
      expect(update?.selectDupaScriere).toBeDefined();
      expect(caiRevalidate()).toEqual(CAI);
    },
  );

  it("auditul poartă id-ul dosarului ca entitate", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_garnishments", "update", { data: { id: ID_1 } });

    await inchidePoprire({ id: ID_1, activa: false });
    await asteaptaDupa();

    expect(server.audituri()).toEqual([
      expect.objectContaining({
        p_status: "success",
        p_entity_id: ID_1,
        p_after: { id: ID_1, activa: false },
      }),
    ]);
  });

  it("zero rânduri (dosar inexistent sau refuzat de RLS): CONFLICT, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_garnishments", "update", { data: null });

    const r = await inchidePoprire({ id: ID_1, activa: false });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });
});
