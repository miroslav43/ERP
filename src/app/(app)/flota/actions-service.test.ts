// src/app/(app)/flota/actions-service.test.ts
//
// Service, intervenții și cheltuieli (0203), pe clientul fals. Poarta e
// `vehicles:update = all`, ca politicile; proba reală (ce scrie fiecare rol,
// planul care se mută singur) e în `tests/rls/proba-flota-service.sql`.

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

import {
  actualizeazaPlanService,
  adaugaCheltuiala,
  adaugaIntrareService,
  creeazaPlanService,
  stergeCheltuiala,
  stergeIntrareService,
} from "./actions-service";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const ADMIN = { "vehicles:update": "all" } as const;

const plan = {
  vehicle_id: ID_1,
  denumire: "Revizie periodică",
  tip: "revizie",
  interval_km: "10000",
  interval_luni: "12",
  baza_data: "2026-07-01",
  baza_km: "40000",
  prag_avertizare_km: "",
  observatii: "",
};

const intrare = {
  vehicle_id: ID_1,
  plan_id: ID_2,
  data_interventiei: "2026-10-01",
  km: "46500",
  tip: "revizie",
  descriere: "Ulei și filtre",
  furnizor: "Service Auto SRL",
  numar_factura: "F-100",
  cost_piese: "300",
  cost_manopera: "450.50",
  anvelope_montate: "",
  observatii: "Date secrete ale facturii",
};

const cheltuiala = {
  vehicle_id: ID_1,
  categorie: "combustibil_fara_foaie",
  data_cheltuielii: "2026-10-02",
  suma: "300.50",
  litri: "40",
  km_bord: "46550",
  numar_document: "B-77",
};

describe("poarta: vehicles:update = all", () => {
  it("sub `team`: INTERZIS la toate șase, fără nicio interogare — și înaintea validării", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "team" } });
    for (const r of [
      await creeazaPlanService(plan),
      await actualizeazaPlanService({ ...plan, id: ID_3, activ: true }),
      await adaugaIntrareService(intrare),
      await stergeIntrareService({ id: ID_3, vehicle_id: ID_1 }),
      await adaugaCheltuiala(cheltuiala),
      await stergeCheltuiala({ id: ID_3, vehicle_id: ID_1 }),
      // Intrare nevalidă + drept lipsă: refuzul vine primul (Zod rulează după authz).
      await creeazaPlanService({ vehicle_id: "nu-e-uuid" }),
    ]) {
      expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    }
    expect(server.apeluri).toHaveLength(0);
  });

  it("modulul oprit: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN, functii: [] });
    const r = await adaugaCheltuiala(cheltuiala);
    expect(r).toMatchObject({ ok: false });
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("creeazaPlanService", () => {
  it("firma și autorul explicite; numere din șiruri; pragul gol cade pe 1.000 km", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_service_plans", "insert", { data: { id: ID_2 } });
    const r = await creeazaPlanService(plan);
    expect(r).toEqual({ ok: true, data: { id: ID_2 } });

    expect(server.apeluriPe("vehicle_service_plans")[0]?.payload).toEqual({
      vehicle_id: ID_1,
      denumire: "Revizie periodică",
      tip: "revizie",
      interval_km: 10000,
      interval_luni: 12,
      baza_data: "2026-07-01",
      baza_km: 40000,
      prag_avertizare_km: 1000,
      observatii: null,
      organization_id: ORG_ID,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    expect(caiRevalidate()).toEqual(["/flota", `/flota/${ID_1}`]);
  });

  it("derivatele nu pleacă niciodată din client: ultima/următoarea le calculează baza", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_service_plans", "insert", { data: { id: ID_2 } });
    await creeazaPlanService({
      ...plan,
      ultima_data: "2099-01-01",
      urmatoarea_data: "2099-01-01",
      urmatorii_km: 1,
    });
    const payload = server.apeluriPe("vehicle_service_plans")[0]?.payload as Record<
      string,
      unknown
    >;
    for (const camp of ["ultima_data", "ultimii_km", "urmatoarea_data", "urmatorii_km", "activ"]) {
      expect(payload, camp).not.toHaveProperty(camp);
    }
  });

  it("fără niciun interval: VALIDARE pe ambele câmpuri, fără interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    const r = await creeazaPlanService({ ...plan, interval_km: "", interval_luni: "" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (r.ok) return;
    expect(Object.keys(r.error.fieldErrors ?? {}).sort()).toEqual(["interval_km", "interval_luni"]);
    expect(server.apeluri).toHaveLength(0);
  });

  it("numele luat (23505) și baza în viitor (P0001) ajung pe câmpul lor", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_service_plans", "insert", {
      error: eroarePostgrest(
        "23505",
        'duplicate key value violates unique constraint "vsp_vehicul_denumire_uq"',
      ),
    });
    const a = await creeazaPlanService(plan);
    expect(a).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!a.ok) expect(Object.keys(a.error.fieldErrors ?? {})).toEqual(["denumire"]);

    server.raspunde("vehicle_service_plans", "insert", {
      error: eroarePostgrest("P0001", "Data ultimei intervenții nu poate fi în viitor."),
    });
    const b = await creeazaPlanService(plan);
    if (!b.ok) expect(Object.keys(b.error.fieldErrors ?? {})).toEqual(["baza_data"]);
  });

  it("auditul poartă id-ul planului și doar câmpurile din lista albă", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_service_plans", "insert", { data: { id: ID_2 } });
    await creeazaPlanService({ ...plan, observatii: "text liber, nu intră în audit" });
    await asteaptaDupa();
    const [audit] = server.audituri();
    expect(audit).toMatchObject({
      p_status: "success",
      p_entity_type: "vehicle_service_plan",
      p_entity_id: ID_2,
    });
    expect(audit?.p_after).toMatchObject({ denumire: "Revizie periodică", interval_km: 10000 });
    expect(audit?.p_after).not.toHaveProperty("observatii");
  });
});

describe("actualizeazaPlanService", () => {
  it("scrie pe id + firmă + rând viu; vehicle_id nu se scrie; opritul trece ca `activ: false`", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_service_plans", "update", { data: { id: ID_3 } });
    const r = await actualizeazaPlanService({ ...plan, id: ID_3, activ: false });
    expect(r).toEqual({ ok: true, data: { id: ID_3 } });

    const apel = server.apeluriPe("vehicle_service_plans", "update")[0];
    expect(apel?.payload).toMatchObject({ activ: false, updated_by: USER_ID, interval_km: 10000 });
    expect(apel?.payload).not.toHaveProperty("vehicle_id");
    expect(apel?.payload).not.toHaveProperty("id");
    expect(areFiltru(apel, "eq", "id", ID_3)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/flota", `/flota/${ID_1}`]);
  });

  it("zero rânduri: CONFLICT, nu reușită", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_service_plans", "update", { data: null });
    const r = await actualizeazaPlanService({ ...plan, id: ID_3, activ: true });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("fără `activ` explicit schema refuză: un plan nu se oprește din greșeală", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    const r = await actualizeazaPlanService({ ...plan, id: ID_3 });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("adaugaIntrareService", () => {
  it("firma și autorul explicite; costurile în lei; planul legat", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_service_entries", "insert", { data: { id: ID_3 } });
    const r = await adaugaIntrareService(intrare);
    expect(r).toEqual({ ok: true, data: { id: ID_3 } });

    expect(server.apeluriPe("vehicle_service_entries")[0]?.payload).toEqual({
      vehicle_id: ID_1,
      plan_id: ID_2,
      data_interventiei: "2026-10-01",
      km: 46500,
      tip: "revizie",
      descriere: "Ulei și filtre",
      furnizor: "Service Auto SRL",
      numar_factura: "F-100",
      cost_piese: 300,
      cost_manopera: 450.5,
      anvelope_montate: null,
      observatii: "Date secrete ale facturii",
      organization_id: ORG_ID,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    // `cost_total` e GENERATED ALWAYS: clientul nu-l trimite niciodată.
    expect(server.apeluriPe("vehicle_service_entries")[0]?.payload).not.toHaveProperty(
      "cost_total",
    );
  });

  it("auditul nu conține descrierea, factura sau observațiile", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_service_entries", "insert", { data: { id: ID_3 } });
    await adaugaIntrareService(intrare);
    await asteaptaDupa();
    const [audit] = server.audituri();
    expect(audit).toMatchObject({ p_entity_type: "vehicle_service_entry", p_entity_id: ID_3 });
    for (const camp of ["descriere", "numar_factura", "observatii", "furnizor"]) {
      expect(audit?.p_after).not.toHaveProperty(camp);
    }
    expect(audit?.p_after).toMatchObject({ km: 46500, cost_piese: 300, cost_manopera: 450.5 });
  });

  it("anvelope montate la o revizie: VALIDARE pe câmp, fără interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    const r = await adaugaIntrareService({ ...intrare, anvelope_montate: "iarna" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(Object.keys(r.error.fieldErrors ?? {})).toEqual(["anvelope_montate"]);
    expect(server.apeluri).toHaveLength(0);
  });

  it("planul altui vehicul (P0001) ajunge pe `plan_id`, data în viitor pe `data_interventiei`", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_service_entries", "insert", {
      error: eroarePostgrest("P0001", "Planul ales nu aparține acestui vehicul."),
    });
    const a = await adaugaIntrareService(intrare);
    if (!a.ok) expect(Object.keys(a.error.fieldErrors ?? {})).toEqual(["plan_id"]);
    else throw new Error("trebuia refuzat");

    server.raspunde("vehicle_service_entries", "insert", {
      error: eroarePostgrest("P0001", "Data intervenției nu poate fi în viitor."),
    });
    const b = await adaugaIntrareService(intrare);
    if (!b.ok) expect(Object.keys(b.error.fieldErrors ?? {})).toEqual(["data_interventiei"]);
    else throw new Error("trebuia refuzat");
  });
});

describe("stergeIntrareService / stergeCheltuiala", () => {
  it("ștergere logică pe id + firmă + rând viu, cu `.select()`; zero rânduri = CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_service_entries", "update", { data: { id: ID_3 } });
    const r = await stergeIntrareService({ id: ID_3, vehicle_id: ID_1 });
    expect(r).toEqual({ ok: true, data: { id: ID_3 } });

    const apel = server.apeluriPe("vehicle_service_entries", "update")[0];
    expect(apel?.payload).toMatchObject({ updated_by: USER_ID });
    expect(apel?.payload).toHaveProperty("deleted_at");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();

    server.raspunde("vehicle_service_entries", "update", { data: null });
    expect(await stergeIntrareService({ id: ID_3, vehicle_id: ID_1 })).toMatchObject({
      ok: false,
      error: { code: "CONFLICT" },
    });

    server.raspunde("vehicle_expenses", "update", { data: null });
    expect(await stergeCheltuiala({ id: ID_3, vehicle_id: ID_1 })).toMatchObject({
      ok: false,
      error: { code: "CONFLICT" },
    });
  });
});

describe("adaugaCheltuiala", () => {
  it("firma și autorul explicite; litrii doar la combustibil", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_expenses", "insert", { data: { id: ID_3 } });
    const r = await adaugaCheltuiala(cheltuiala);
    expect(r).toEqual({ ok: true, data: { id: ID_3 } });
    expect(server.apeluriPe("vehicle_expenses")[0]?.payload).toEqual({
      vehicle_id: ID_1,
      categorie: "combustibil_fara_foaie",
      data_cheltuielii: "2026-10-02",
      suma: 300.5,
      litri: 40,
      km_bord: 46550,
      numar_document: "B-77",
      observatii: null,
      organization_id: ORG_ID,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
  });

  it("litri la parcare: VALIDARE pe `litri`; suma lipsă: VALIDARE pe `suma`; nimic nu ajunge în bază", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    const a = await adaugaCheltuiala({ ...cheltuiala, categorie: "parcare" });
    expect(a).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!a.ok) expect(Object.keys(a.error.fieldErrors ?? {})).toEqual(["litri"]);
    const b = await adaugaCheltuiala({ ...cheltuiala, suma: "" });
    if (!b.ok) expect(Object.keys(b.error.fieldErrors ?? {})).toEqual(["suma"]);
    expect(server.apeluri).toHaveLength(0);
  });

  it("data în viitor (P0001) ajunge pe `data_cheltuielii`", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_expenses", "insert", {
      error: eroarePostgrest("P0001", "Data cheltuielii nu poate fi în viitor."),
    });
    const r = await adaugaCheltuiala(cheltuiala);
    if (!r.ok) expect(Object.keys(r.error.fieldErrors ?? {})).toEqual(["data_cheltuielii"]);
    else throw new Error("trebuia refuzat");
  });
});
