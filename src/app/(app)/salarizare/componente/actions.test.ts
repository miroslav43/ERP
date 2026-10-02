// src/app/(app)/salarizare/componente/actions.test.ts
//
// Catalogul de șabloane de sporuri și prime (`salary_component_types`).
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
  ORG_ID,
  USER_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import {
  actualizeazaSablonComponenta,
  creeazaSablonComponenta,
  dezactiveazaSablonComponenta,
} from "./actions";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const CAI = ["/salarizare/componente"];

// ── creeazaSablonComponenta ──────────────────────────────────────────────────

describe("creeazaSablonComponenta", () => {
  const PERMIS = { "payroll:create": "all" } as const;
  const INTRARE = {
    cod: " SPOR-NOAPTE ",
    denumire: "Spor de noapte",
    kind: "spor_procent",
    impozabil: true,
    intra_in_baza_cas: true,
    intra_in_baza_cass: false,
    cod_revisal: "",
  };

  it("scope `team` sub pragul `all`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "payroll:create": "team" } });
    const r = await creeazaSablonComponenta(INTRARE);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: șablonul nou e activ, al organizației curente, cu autorul înregistrat", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("salary_component_types", "insert", { data: { id: ID_1 } });

    const r = await creeazaSablonComponenta(INTRARE);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [insert] = server.apeluriPe("salary_component_types", "insert");
    expect(insert?.payload).toEqual({
      cod: "SPOR-NOAPTE",
      denumire: "Spor de noapte",
      kind: "spor_procent",
      impozabil: true,
      intra_in_baza_cas: true,
      intra_in_baza_cass: false,
      cod_revisal: null,
      organization_id: ORG_ID,
      activ: true,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    expect(insert?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("auditul poartă id-ul șablonului creat", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("salary_component_types", "insert", { data: { id: ID_1 } });

    await creeazaSablonComponenta(INTRARE);
    await asteaptaDupa();

    expect(server.audituri()).toEqual([
      expect.objectContaining({ p_status: "success", p_entity_id: ID_1, p_action: "create" }),
    ]);
  });

  it("tip de componentă necunoscut: VALIDARE pe `kind`", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await creeazaSablonComponenta({ ...INTRARE, kind: "bonus_secret" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.fieldErrors).toHaveProperty("kind");
    expect(server.apeluri).toHaveLength(0);
  });

  it("cod deja folosit (23505): CONFLICT cu mesajul modulului", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("salary_component_types", "insert", {
      error: eroarePostgrest("23505", 'duplicate key "salary_component_types_cod_uq"'),
    });

    const r = await creeazaSablonComponenta(INTRARE);

    expect(r).toMatchObject({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Există deja o înregistrare de salarizare cu aceste date.",
      },
    });
    expect(caiRevalidate()).toEqual([]);
  });
});

// ── actualizeazaSablonComponenta ─────────────────────────────────────────────

describe("actualizeazaSablonComponenta", () => {
  const PERMIS = { "payroll:update": "all" } as const;
  const INTRARE = {
    id: ID_1,
    denumire: "Spor de noapte 25%",
    impozabil: false,
    intra_in_baza_cas: false,
    intra_in_baza_cass: true,
    cod_revisal: "SN",
  };

  it("scope `team` sub pragul `all`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "payroll:update": "team" } });
    const r = await actualizeazaSablonComponenta(INTRARE);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: actualizează câmpurile editabile pe id + organizație, fără să rescrie id-ul", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("salary_component_types", "update", { data: { id: ID_1 } });

    const r = await actualizeazaSablonComponenta(INTRARE);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [update] = server.apeluriPe("salary_component_types", "update");
    expect(update?.payload).toEqual({
      denumire: "Spor de noapte 25%",
      impozabil: false,
      intra_in_baza_cas: false,
      intra_in_baza_cass: true,
      cod_revisal: "SN",
      updated_by: USER_ID,
    });
    expect(areFiltru(update, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(update, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(update, "is", "deleted_at", null)).toBe(true);
    expect(update?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("codul și tipul nu se pot schimba după creare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("salary_component_types", "update", { data: { id: ID_1 } });

    await actualizeazaSablonComponenta({ ...INTRARE, cod: "ALT-COD", kind: "indemnizatie" });

    const [update] = server.apeluriPe("salary_component_types", "update");
    expect(update?.payload).not.toHaveProperty("cod");
    expect(update?.payload).not.toHaveProperty("kind");
  });

  it("zero rânduri (șablon inexistent sau șters): NEGASIT, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("salary_component_types", "update", { data: null });

    const r = await actualizeazaSablonComponenta(INTRARE);

    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(caiRevalidate()).toEqual([]);
  });
});

// ── dezactiveazaSablonComponenta ─────────────────────────────────────────────

describe("dezactiveazaSablonComponenta", () => {
  const PERMIS = { "payroll:update": "all" } as const;

  it("scope `team` sub pragul `all`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "payroll:update": "team" } });
    const r = await dezactiveazaSablonComponenta({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("dreptul de creare nu ajunge pentru dezactivare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "payroll:create": "all" } });
    const r = await dezactiveazaSablonComponenta({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: marchează șablonul inactiv (nu îl șterge), pe id + organizație, cu `.select()`", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("salary_component_types", "update", { data: { id: ID_1 } });

    const r = await dezactiveazaSablonComponenta({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [update, ...altele] = server.apeluriPe("salary_component_types");
    expect(altele).toHaveLength(0);
    expect(update?.operatie).toBe("update");
    expect(update?.payload).toEqual({ activ: false, updated_by: USER_ID });
    expect(areFiltru(update, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(update, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(update, "is", "deleted_at", null)).toBe(true);
    expect(update?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("auditul nu poartă niciun câmp de intrare, doar entitatea", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("salary_component_types", "update", { data: { id: ID_1 } });

    await dezactiveazaSablonComponenta({ id: ID_1 });
    await asteaptaDupa();

    expect(server.audituri()).toEqual([
      expect.objectContaining({ p_status: "success", p_entity_id: ID_1, p_after: {} }),
    ]);
  });

  it("zero rânduri: NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("salary_component_types", "update", { data: null });

    const r = await dezactiveazaSablonComponenta({ id: ID_1 });

    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
  });
});
