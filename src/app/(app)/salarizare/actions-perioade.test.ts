// src/app/(app)/salarizare/actions-perioade.test.ts
//
// Ciclul de viață al perioadei de salarizare: crearea, aprobarea și
// redeschiderea. `inchidePerioada` și straturile comune ale lui `createAction`
// sunt în testul canonic (`actions.test.ts`); aici e doar ce e specific
// fiecărui handler.

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
import { areFiltru, eroarePostgrest, type ClientFals } from "@/lib/teste/supabase-fals";
import { aprobaPerioada, creeazaPerioada, inchidePerioada, redeschidePerioada } from "./actions";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

// ── creeazaPerioada ──────────────────────────────────────────────────────────

describe("creeazaPerioada", () => {
  const PERMIS = { "payroll:create": "all" } as const;
  const INTRARE = { an: 2026, luna: 3 };

  function programeazaPreconditiile(server: ClientFals): void {
    server.raspunde("attendance_periods", "select", { data: { id: ID_2 } });
    server.raspunde("payroll_settings", "select", { data: { id: ID_3 } });
  }

  it("scope `team` sub pragul `all`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "payroll:create": "team" } });
    const r = await creeazaPerioada(INTRARE);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("leagă perioada de pontajul și de setările lunii, în organizația curentă", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaPreconditiile(server);
    server.raspunde("payroll_periods", "insert", { data: { id: ID_1 } });

    const r = await creeazaPerioada(INTRARE);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [pontaj] = server.apeluriPe("attendance_periods");
    expect(areFiltru(pontaj, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(pontaj, "eq", "an", 2026)).toBe(true);
    expect(areFiltru(pontaj, "eq", "luna", 3)).toBe(true);
    expect(areFiltru(pontaj, "is", "deleted_at", null)).toBe(true);

    const [setari] = server.apeluriPe("payroll_settings");
    expect(areFiltru(setari, "eq", "organization_id", ORG_ID)).toBe(true);
    // Versiunea de setări în vigoare la începutul lunii.
    expect(areFiltru(setari, "lte", "valabil_de_la", "2026-03-01")).toBe(true);
    expect(areFiltru(setari, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(setari, "order", "valabil_de_la", { ascending: false })).toBe(true);

    const [insert] = server.apeluriPe("payroll_periods", "insert");
    expect(insert?.payload).toEqual({
      organization_id: ORG_ID,
      an: 2026,
      luna: 3,
      attendance_period_id: ID_2,
      settings_id: ID_3,
    });
    expect(insert?.selectDupaScriere).toBe("id");
  });

  it("revalidează lista și panoul, iar auditul reține doar anul și luna", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaPreconditiile(server);
    server.raspunde("payroll_periods", "insert", { data: { id: ID_1 } });

    await creeazaPerioada(INTRARE);
    await asteaptaDupa();

    expect(caiRevalidate()).toEqual(["/salarizare", "/panou"]);
    expect(server.audituri()).toEqual([
      expect.objectContaining({ p_status: "success", p_after: { an: 2026, luna: 3 } }),
    ]);
  });

  it("fără perioadă de pontaj pentru lună: CONFLICT care trimite la Pontaj, fără nicio inserare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("attendance_periods", "select", { data: null });

    const r = await creeazaPerioada(INTRARE);

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toContain("Pontaj");
    expect(server.apeluriPe("payroll_settings")).toHaveLength(0);
    expect(server.apeluriPe("payroll_periods")).toHaveLength(0);
    expect(caiRevalidate()).toEqual([]);
  });

  it("fără setări valabile pentru lună: CONFLICT, fără nicio inserare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("attendance_periods", "select", { data: { id: ID_2 } });
    server.raspunde("payroll_settings", "select", { data: null });

    const r = await creeazaPerioada(INTRARE);

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toContain("setări de salarizare");
    expect(server.apeluriPe("payroll_periods")).toHaveLength(0);
  });

  it("perioadă deja existentă pentru lună (23505 pe `payroll_periods_luna_uq`): mesajul modulului", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaPreconditiile(server);
    server.raspunde("payroll_periods", "insert", {
      error: eroarePostgrest(
        "23505",
        'duplicate key value violates unique constraint "payroll_periods_luna_uq"',
      ),
    });

    const r = await creeazaPerioada(INTRARE);

    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("Există deja o perioadă") },
    });
  });

  it("luna 13 e respinsă la validare, înainte de orice citire", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await creeazaPerioada({ an: 2026, luna: 13 });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });
});

// ── aprobaPerioada ───────────────────────────────────────────────────────────

describe("aprobaPerioada", () => {
  const PERMIS = { "payroll:approve": "all" } as const;

  /** Perioada există, iar setările ei au metoda dată de calcul a indemnizației CO. */
  function programeazaSetari(server: ClientFals, mod: string): void {
    server.raspunde("payroll_periods", "select", {
      data: { settings_id: ID_3, an: 2026, luna: 7 },
    });
    server.raspunde("payroll_settings", "select", {
      data: { id: ID_3, mod_calcul_indemnizatie_co: mod },
    });
    server.raspunde("payroll_personal_deduction_brackets", "select", { data: [] });
  }

  it("scope `team` sub pragul `all`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "payroll:approve": "team" } });
    const r = await aprobaPerioada({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: trece perioada în `aprobat` pe id + organizație, cu `.select()` după UPDATE", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaSetari(server, "cea_mai_avantajoasa");
    server.raspunde("payroll_periods", "update", { data: { id: ID_1, status: "aprobat" } });

    const r = await aprobaPerioada({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: null });
    const [citire] = server.apeluriPe("payroll_periods", "select");
    expect(areFiltru(citire, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
    const [setari] = server.apeluriPe("payroll_settings");
    expect(areFiltru(setari, "eq", "id", ID_3)).toBe(true);

    const [update] = server.apeluriPe("payroll_periods", "update");
    expect(update?.payload).toEqual({ status: "aprobat" });
    expect(areFiltru(update, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(update, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(update?.selectDupaScriere).toBeDefined();
    // Metoda nu e „baza”: nu se caută zile de CO.
    expect(server.apeluriPe("payroll_entries")).toHaveLength(0);
    expect(caiRevalidate()).toEqual(["/salarizare", "/panou"]);
  });

  it("metoda „baza” și zile de CO în perioadă: CONFLICT cu trimitere la art. 150, fără UPDATE", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaSetari(server, "baza");
    server.raspunde("payroll_entries", "select", { data: [{ id: ID_2 }] });

    const r = await aprobaPerioada({ id: ID_1 });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toContain("art. 150");
    const [cuCo] = server.apeluriPe("payroll_entries");
    expect(areFiltru(cuCo, "eq", "period_id", ID_1)).toBe(true);
    expect(areFiltru(cuCo, "gt", "zile_concediu_odihna", 0)).toBe(true);
    expect(areFiltru(cuCo, "is", "deleted_at", null)).toBe(true);
    expect(server.apeluriPe("payroll_periods", "update")).toHaveLength(0);
    expect(caiRevalidate()).toEqual([]);
  });

  it("metoda „baza” fără zile de CO în perioadă: aprobarea trece", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaSetari(server, "baza");
    server.raspunde("payroll_entries", "select", { data: [] });
    server.raspunde("payroll_periods", "update", { data: { id: ID_1, status: "aprobat" } });

    const r = await aprobaPerioada({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: null });
    expect(server.apeluriPe("payroll_periods", "update")).toHaveLength(1);
  });

  it("zero rânduri afectate (nu mai e `calculat` sau USING a respins): CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaSetari(server, "media_3_luni");
    server.raspunde("payroll_periods", "update", { data: null });

    const r = await aprobaPerioada({ id: ID_1 });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toContain("nu a putut fi aprobată");
    expect(caiRevalidate()).toEqual([]);
  });

  it("perioadă invizibilă la citire: nu se citesc setări, iar UPDATE-ul gol dă CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_periods", "select", { data: null });
    server.raspunde("payroll_periods", "update", { data: null });

    const r = await aprobaPerioada({ id: ID_1 });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("payroll_settings")).toHaveLength(0);
  });

  // O eroare pe oricare dintre cele două citiri ale porții art. 150 nu are voie
  // să fie tratată ca „nimic de verificat”: aprobarea ar ocoli poarta.
  it("eroare la citirea perioadei pentru poarta de CO: fără UPDATE", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_periods", "select", { error: eroarePostgrest("57014") });
    server.raspunde("payroll_periods", "update", { data: { id: ID_1, status: "aprobat" } });

    const r = await aprobaPerioada({ id: ID_1 });

    expect(r).toMatchObject({
      ok: false,
      error: { code: "EROARE_INTERNA", message: "Operațiunea a durat prea mult și a fost oprită." },
    });
    expect(server.apeluriPe("payroll_periods", "update")).toHaveLength(0);
    expect(caiRevalidate()).toEqual([]);
  });

  it("metoda „baza” și eroare la căutarea zilelor de CO: fără UPDATE", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaSetari(server, "baza");
    server.raspunde("payroll_entries", "select", { error: eroarePostgrest("57014") });
    server.raspunde("payroll_periods", "update", { data: { id: ID_1, status: "aprobat" } });

    const r = await aprobaPerioada({ id: ID_1 });

    expect(r).toMatchObject({
      ok: false,
      error: { code: "EROARE_INTERNA", message: "Operațiunea a durat prea mult și a fost oprită." },
    });
    expect(server.apeluriPe("payroll_periods", "update")).toHaveLength(0);
    expect(caiRevalidate()).toEqual([]);
  });

  it("P0001 din triggerul de tranziție: mesajul triggerului ajunge la utilizator", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaSetari(server, "cea_mai_avantajoasa");
    const mesaj =
      "Pontajul lunii 7/2026 nu este blocat. Salariile se calculează doar peste un pontaj blocat.";
    server.raspunde("payroll_periods", "update", { error: eroarePostgrest("P0001", mesaj) });

    const r = await aprobaPerioada({ id: ID_1 });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });
});

// ── redeschidePerioada ───────────────────────────────────────────────────────

describe("redeschidePerioada", () => {
  const PERMIS = { "payroll:update": "all" } as const;

  it("scope `team` sub pragul `all`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "payroll:update": "team" } });
    const r = await redeschidePerioada({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("dreptul de aprobare nu ajunge pentru redeschidere: cere `payroll:update`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "payroll:approve": "all" } });
    const r = await redeschidePerioada({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: doar o perioadă `calculat` se întoarce în ciornă, cu `.select()` după UPDATE", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_periods", "update", { data: { id: ID_1, status: "draft" } });

    const r = await redeschidePerioada({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: null });
    const [update, ...altele] = server.apeluriPe("payroll_periods");
    expect(altele).toHaveLength(0);
    expect(update?.operatie).toBe("update");
    expect(update?.payload).toEqual({ status: "draft" });
    expect(areFiltru(update, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(update, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(update, "eq", "status", "calculat")).toBe(true);
    expect(update?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/salarizare", "/panou"]);
  });

  it("perioadă aprobată între timp (zero rânduri): CONFLICT și nicio revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_periods", "update", { data: null });

    const r = await redeschidePerioada({ id: ID_1 });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toContain("nu a putut fi redeschisă");
    expect(caiRevalidate()).toEqual([]);
  });
});

// ── inchidePerioada ──────────────────────────────────────────────────────────

describe("inchidePerioada", () => {
  const PERMIS = { "payroll:approve": "all" } as const;

  it("scope `team` sub pragul `all`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "payroll:approve": "team" } });
    const r = await inchidePerioada({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("dreptul de actualizare nu ajunge pentru închidere: cere `payroll:approve`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "payroll:update": "all" } });
    const r = await inchidePerioada({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  // Capcana 17: fără `.select()` după UPDATE, un rând respins de USING trece
  // drept succes. Aserțiunile pe `selectDupaScriere` și pe `terminal` cad dacă
  // lanțul se încheie cu `await` direct pe `.update()`.
  it("succes: trece perioada în `inchis` pe id + organizație, cu `.select().maybeSingle()` după UPDATE", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_periods", "update", { data: { id: ID_1, status: "inchis" } });

    const r = await inchidePerioada({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: null });
    const [update, ...altele] = server.apeluriPe("payroll_periods");
    expect(altele).toHaveLength(0);
    expect(update?.operatie).toBe("update");
    expect(update?.payload).toEqual({ status: "inchis" });
    expect(areFiltru(update, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(update, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(update?.selectDupaScriere).toBe("id, status");
    expect(update?.terminal).toBe("maybeSingle");
    expect(caiRevalidate()).toEqual(["/salarizare", "/panou"]);
  });

  it("zero rânduri afectate (nu mai e `aprobat` sau USING a respins): CONFLICT și nicio revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_periods", "update", { data: null });

    const r = await inchidePerioada({ id: ID_1 });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toContain("nu a putut fi închisă");
    expect(caiRevalidate()).toEqual([]);
  });

  it("P0001 din triggerul de tranziție: mesajul triggerului ajunge la utilizator", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const mesaj = "Tranziție nepermisă: calculat → inchis.";
    server.raspunde("payroll_periods", "update", { error: eroarePostgrest("P0001", mesaj) });

    const r = await inchidePerioada({ id: ID_1 });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
    expect(caiRevalidate()).toEqual([]);
  });
});
