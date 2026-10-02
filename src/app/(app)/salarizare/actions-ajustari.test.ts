// src/app/(app)/salarizare/actions-ajustari.test.ts
//
// Primele și reținerile unei perioade: adăugarea și ștergerea (soft delete).
// Straturile comune ale lui `createAction` sunt în testul canonic
// (`actions.test.ts`).

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
  ID_3,
  ORG_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import { adaugaPrima, adaugaRetinere, stergePrima, stergeRetinere } from "./actions";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const PERMIS_CREARE = { "payroll:create": "all" } as const;
const PERMIS_MODIFICARE = { "payroll:update": "all" } as const;

/**
 * Drept de creare + perioada încă în ciornă: adăugările precitesc starea
 * perioadei (`cerePerioadaInCiorna`) înainte de INSERT.
 */
function cuPerioadaInCiorna() {
  const c = configureazaActiunea({ permisiuni: PERMIS_CREARE });
  c.server.raspunde("payroll_periods", "select", { data: { id: ID_1, status: "draft" } });
  return c;
}

// ── Ștergerile: aceeași formă pentru prime și rețineri ──────────────────────

describe.each([
  { nume: "stergePrima", actiune: stergePrima, tabela: "payroll_bonuses", ce: "Prima" },
  {
    nume: "stergeRetinere",
    actiune: stergeRetinere,
    tabela: "payroll_deductions",
    ce: "Reținerea",
  },
] as const)("$nume", ({ actiune, tabela, ce }) => {
  /** Rândul citit înaintea ștergerii; `garnishment_id` contează doar la rețineri. */
  const existenta = (status: string | null) => ({
    id: ID_1,
    garnishment_id: null,
    perioada: status === null ? null : { status },
  });

  it("scope `team` sub pragul `all`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "payroll:update": "team" } });
    const r = await actiune({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("dreptul de creare nu ajunge pentru ștergere: cere `payroll:update`", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS_CREARE });
    const r = await actiune({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: marchează `deleted_at` pe id + organizație, doar pe un rând încă viu, cu `.select()`", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS_MODIFICARE });
    server.raspunde(tabela, "select", { data: existenta("draft") });
    server.raspunde(tabela, "update", { data: { id: ID_1 } });
    const inainte = Date.now();

    const r = await actiune({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: null });
    const [citire] = server.apeluriPe(tabela, "select");
    expect(areFiltru(citire, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);

    const [update] = server.apeluriPe(tabela, "update");
    const payload = update?.payload as { deleted_at: string };
    expect(Object.keys(payload)).toEqual(["deleted_at"]);
    expect(Date.parse(payload.deleted_at)).toBeGreaterThanOrEqual(inainte - 1000);
    expect(areFiltru(update, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(update, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(update, "is", "deleted_at", null)).toBe(true);
    expect(update?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/salarizare", "/panou"]);
  });

  it("auditul de succes e `delete`, cu id-ul ajustării", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS_MODIFICARE });
    server.raspunde(tabela, "select", { data: existenta("draft") });
    server.raspunde(tabela, "update", { data: { id: ID_1 } });

    await actiune({ id: ID_1 });
    await asteaptaDupa();

    expect(server.audituri()).toEqual([
      expect.objectContaining({ p_status: "success", p_action: "delete", p_after: { id: ID_1 } }),
    ]);
  });

  it("rând inexistent sau deja șters: NEGASIT, fără UPDATE", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS_MODIFICARE });
    server.raspunde(tabela, "select", { data: null });

    const r = await actiune({ id: ID_1 });

    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    if (!r.ok) expect(r.error.message).toContain(`${ce} nu a fost găsită`);
    expect(server.apeluriPe(tabela, "update")).toHaveLength(0);
  });

  it.each(["calculat", "aprobat", "inchis", null])(
    "perioadă în starea %s (sau invizibilă): CONFLICT care cere redeschiderea, fără UPDATE",
    async (status) => {
      const { server } = configureazaActiunea({ permisiuni: PERMIS_MODIFICARE });
      server.raspunde(tabela, "select", { data: existenta(status) });

      const r = await actiune({ id: ID_1 });

      expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
      if (!r.ok) expect(r.error.message).toContain("Redeschideți perioada");
      expect(server.apeluriPe(tabela, "update")).toHaveLength(0);
      expect(caiRevalidate()).toEqual([]);
    },
  );

  it("UPDATE cu zero rânduri (ștearsă între timp de altcineva): CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS_MODIFICARE });
    server.raspunde(tabela, "select", { data: existenta("draft") });
    server.raspunde(tabela, "update", { data: null });

    const r = await actiune({ id: ID_1 });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toContain("nu a putut fi ștearsă");
    expect(caiRevalidate()).toEqual([]);
  });
});

describe("stergeRetinere — reținerile de poprire", () => {
  it("o reținere legată de un dosar de poprire nu se șterge de aici", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS_MODIFICARE });
    server.raspunde("payroll_deductions", "select", {
      data: { id: ID_1, garnishment_id: ID_3, perioada: { status: "draft" } },
    });

    const r = await stergeRetinere({ id: ID_1 });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toContain("dosar de poprire");
    expect(server.apeluriPe("payroll_deductions", "update")).toHaveLength(0);
  });
});

// ── adaugaPrima ──────────────────────────────────────────────────────────────

describe("adaugaPrima", () => {
  const INTRARE = {
    period_id: ID_1,
    employee_id: ID_2,
    tip: "prima_performanta",
    suma: "750.50",
    motiv: "  Proiect livrat  ",
  };

  it("scope `team` sub pragul `all`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "payroll:create": "team" } });
    const r = await adaugaPrima(INTRARE);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: inserează prima în organizația curentă, cu implicitele fiscale „impozabil” și „supus contribuțiilor”", async () => {
    const { server } = cuPerioadaInCiorna();
    server.raspunde("payroll_bonuses", "insert", {});

    const r = await adaugaPrima(INTRARE);

    expect(r).toEqual({ ok: true, data: null });
    const [insert] = server.apeluriPe("payroll_bonuses", "insert");
    expect(insert?.payload).toEqual({
      organization_id: ORG_ID,
      period_id: ID_1,
      employee_id: ID_2,
      tip: "prima_performanta",
      suma: 750.5,
      motiv: "Proiect livrat",
      impozabil: true,
      supus_contributii: true,
    });
    expect(caiRevalidate()).toEqual(["/salarizare", "/panou"]);
  });

  it("auditul reține perioada, angajatul și tipul — nu suma și nici motivul", async () => {
    const { server } = cuPerioadaInCiorna();
    server.raspunde("payroll_bonuses", "insert", {});

    await adaugaPrima(INTRARE);
    await asteaptaDupa();

    expect(server.audituri()).toEqual([
      expect.objectContaining({
        p_status: "success",
        p_after: { period_id: ID_1, employee_id: ID_2, tip: "prima_performanta" },
      }),
    ]);
  });

  it.each(["0", "-10"])(
    "suma %s nu e pozitivă: VALIDARE pe `suma`, fără inserare",
    async (suma) => {
      const { server } = configureazaActiunea({ permisiuni: PERMIS_CREARE });
      const r = await adaugaPrima({ ...INTRARE, suma });
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.code).toBe("VALIDARE");
      expect(r.error.fieldErrors).toHaveProperty("suma");
      expect(server.apeluri).toHaveLength(0);
    },
  );

  // O respingere din `with check` ieșea ca 42501, adică „nu aveți dreptul” —
  // deși dreptul există și doar luna nu mai e în ciornă. Adăugările precitesc
  // acum starea perioadei, ca ștergerile.
  it.each(["calculat", "aprobat", "inchis"])(
    "perioadă în starea %s: CONFLICT „Redeschideți perioada”, nu INTERZIS, fără INSERT",
    async (status) => {
      const { server } = configureazaActiunea({ permisiuni: PERMIS_CREARE });
      server.raspunde("payroll_periods", "select", { data: { id: ID_1, status } });

      const r = await adaugaPrima(INTRARE);

      expect(r).toMatchObject({
        ok: false,
        error: { code: "CONFLICT", message: expect.stringContaining("Redeschideți perioada") },
      });
      const [citire] = server.apeluriPe("payroll_periods", "select");
      expect(areFiltru(citire, "eq", "id", ID_1)).toBe(true);
      expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
      expect(server.apeluriPe("payroll_bonuses")).toHaveLength(0);
      expect(caiRevalidate()).toEqual([]);
    },
  );

  it("perioadă inexistentă (ștearsă între timp): NEGASIT, fără INSERT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS_CREARE });
    server.raspunde("payroll_periods", "select", { data: null });

    const r = await adaugaPrima(INTRARE);

    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriPe("payroll_bonuses")).toHaveLength(0);
  });
});

// ── adaugaRetinere ───────────────────────────────────────────────────────────

describe("adaugaRetinere", () => {
  const INTRARE = {
    period_id: ID_1,
    employee_id: ID_2,
    tip: "avans",
    suma: 400,
    motiv: "Avans chenzină",
  };

  it("scope `team` sub pragul `all`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "payroll:create": "team" } });
    const r = await adaugaRetinere(INTRARE);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: inserează reținerea, fără plafon procentual când nu e cerut", async () => {
    const { server } = cuPerioadaInCiorna();
    server.raspunde("payroll_deductions", "insert", {});

    const r = await adaugaRetinere(INTRARE);

    expect(r).toEqual({ ok: true, data: null });
    const [insert] = server.apeluriPe("payroll_deductions", "insert");
    expect(insert?.payload).toEqual({
      organization_id: ORG_ID,
      period_id: ID_1,
      employee_id: ID_2,
      tip: "avans",
      suma: 400,
      procent_maxim_din_net: null,
      motiv: "Avans chenzină",
    });
    expect(caiRevalidate()).toEqual(["/salarizare", "/panou"]);
  });

  it("plafonul procentual se transmite ca fracție", async () => {
    const { server } = cuPerioadaInCiorna();
    server.raspunde("payroll_deductions", "insert", {});

    await adaugaRetinere({ ...INTRARE, procent_maxim_din_net: "0.3" });

    const [insert] = server.apeluriPe("payroll_deductions", "insert");
    expect(insert?.payload).toMatchObject({ procent_maxim_din_net: 0.3 });
  });

  it("plafon peste 1 (procent scris ca 30, nu 0,30): VALIDARE pe `procent_maxim_din_net`", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS_CREARE });
    const r = await adaugaRetinere({ ...INTRARE, procent_maxim_din_net: 30 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(r.error.fieldErrors).toHaveProperty("procent_maxim_din_net");
    expect(server.apeluri).toHaveLength(0);
  });

  it("perioadă care nu mai e în ciornă: CONFLICT „Redeschideți perioada”, nu INTERZIS, fără INSERT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS_CREARE });
    server.raspunde("payroll_periods", "select", { data: { id: ID_1, status: "calculat" } });

    const r = await adaugaRetinere(INTRARE);

    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("Redeschideți perioada") },
    });
    const [citire] = server.apeluriPe("payroll_periods", "select");
    expect(areFiltru(citire, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(server.apeluriPe("payroll_deductions")).toHaveLength(0);
    expect(caiRevalidate()).toEqual([]);
  });

  it("perioadă inexistentă (ștearsă între timp): NEGASIT, fără INSERT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS_CREARE });
    server.raspunde("payroll_periods", "select", { data: null });

    const r = await adaugaRetinere(INTRARE);

    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriPe("payroll_deductions")).toHaveLength(0);
  });

  it("depășire numerică (22003): mesajul modulului despre fracții, nu cel generic", async () => {
    const { server } = cuPerioadaInCiorna();
    server.raspunde("payroll_deductions", "insert", { error: eroarePostgrest("22003") });

    const r = await adaugaRetinere(INTRARE);

    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("fracție") },
    });
  });
});
