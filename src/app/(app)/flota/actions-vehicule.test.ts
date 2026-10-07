// src/app/(app)/flota/actions-vehicule.test.ts
//
// Parcul auto: vehiculele și documentele lor. Toate șase scrierile sunt
// `minScope: "all"`, fiindcă politicile bazei cer literal
// `has_permission(...) = 'all'`; `manager` nu are niciun `vehicles:*`.
// Straturile comune ale lui `createAction` sunt în `salarizare/actions.test.ts`.

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
  actualizeazaDocument,
  actualizeazaVehicul,
  adaugaDocument,
  corecteazaKilometraj,
  creeazaVehicul,
  stergeDocument,
  stergeVehicul,
} from "./actions";

const ACUM = "2026-09-15T10:00:00.000Z";

/** Ce are un `manager` din seed pe flotă: foile echipei, niciun `vehicles:*`. */
const MANAGER = {
  "trip_sheets:read": "team",
  "trip_sheets:approve": "team",
  "trip_sheets:create": "own",
  "trip_sheets:update": "own",
} as const;

const vehicul = (modificari: Record<string, unknown> = {}) => ({
  nr_inmatriculare: "b 123 abc",
  marca: "Dacia",
  model: "Logan",
  vin: "uu1lsda1234567890",
  km_curent: "87000",
  ...modificari,
});

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(ACUM));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("creeazaVehicul", () => {
  it("managerul (fără `vehicles:*`) e refuzat înainte de bază", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: MANAGER });
    const r = await creeazaVehicul(vehicul());
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("scope `team` pe `vehicles:create` (sub `all`): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:create": "team" } });
    const r = await creeazaVehicul(vehicul());
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: intră „activ”, cu autorul pe ambele coloane, numărul nenormalizat", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:create": "all" } });
    server.raspunde("vehicles", "insert", { data: { id: ID_1 } });

    const r = await creeazaVehicul(vehicul());

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("vehicles");
    expect(apel?.operatie).toBe("insert");
    expect(apel?.payload).toMatchObject({
      organization_id: ORG_ID,
      status: "activ",
      created_by: USER_ID,
      updated_by: USER_ID,
      // Normalizarea numărului e a triggerului, nu a aplicației.
      nr_inmatriculare: "b 123 abc",
      vin: "UU1LSDA1234567890",
      categorie: "autoturism",
      tip_combustibil: "motorina",
      km_curent: 87000,
    });
    expect(apel?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual(["/flota"]);
  });

  /**
   * Defectul reparat în F1: `km_curent` nu se trimitea, coloana rămânea pe
   * `default 0`, iar prima foaie de parcurs trecea de orice verificare de
   * kilometraj. Fără cifră, crearea se oprește în schemă.
   */
  it("fără kilometraj: VALIDARE pe `km_curent`, fără interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:create": "all" } });
    const r = await creeazaVehicul(vehicul({ km_curent: undefined }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.fieldErrors).toHaveProperty("km_curent");
    expect(server.apeluri).toHaveLength(0);
  });

  it("auditul de succes poartă id-ul vehiculului nou", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:create": "all" } });
    server.raspunde("vehicles", "insert", { data: { id: ID_1 } });
    await creeazaVehicul(vehicul());
    await asteaptaDupa();
    expect(server.audituri()).toEqual([
      expect.objectContaining({
        p_status: "success",
        p_entity_type: "vehicle",
        p_entity_id: ID_1,
      }),
    ]);
  });

  it("23505 (număr sau VIN dublat): CONFLICT cu mesajul flotei", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:create": "all" } });
    server.raspunde("vehicles", "insert", { error: eroarePostgrest("23505") });
    const r = await creeazaVehicul(vehicul());
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (r.ok) return;
    expect(r.error.message).toContain("număr de înmatriculare");
  });

  it("un VIN cu litera O (exclusă din standard) e respins de schemă", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:create": "all" } });
    const r = await creeazaVehicul(vehicul({ vin: "OOOOOOOOOOOOOOOOO" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.fieldErrors).toHaveProperty("vin");
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("actualizeazaVehicul", () => {
  it("scope `team` pe `vehicles:update`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "team" } });
    const r = await actualizeazaVehicul({ id: ID_1, ...vehicul(), status: "activ" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: UPDATE pe id + organizație, pe un vehicul viu, cu `updated_by` și `.select()`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("vehicles", "update", { data: { id: ID_1 } });

    const r = await actualizeazaVehicul({
      id: ID_1,
      ...vehicul(),
      status: "vandut",
      motiv_iesire: "Vândut la licitație",
    });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("vehicles");
    expect(apel?.payload).toMatchObject({
      status: "vandut",
      motiv_iesire: "Vândut la licitație",
      updated_by: USER_ID,
    });
    for (const camp of ["id", "km_curent", "data_iesire", "deleted_at", "organization_id"]) {
      expect(apel?.payload).not.toHaveProperty(camp);
    }
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/flota", `/flota/${ID_1}`]);
  });

  it("auditul modificării păstrează doar allow-list-ul: fără valoare, observații sau culoare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("vehicles", "update", { data: { id: ID_1 } });
    await actualizeazaVehicul({
      id: ID_1,
      ...vehicul({
        culoare: "alb",
        consum_mediu_declarat: "6.5",
        valoare_achizitie: "65000",
        prag_salt_km: "500",
        observatii: "zgâriat pe portiera stângă",
      }),
      status: "activ",
    });
    await asteaptaDupa();
    const [audit] = server.audituri();
    expect(audit).toMatchObject({
      p_status: "success",
      p_entity_type: "vehicle",
      p_entity_id: ID_1,
    });
    expect(audit?.p_after).toMatchObject({ id: ID_1, marca: "Dacia", status: "activ" });
    for (const camp of [
      "culoare",
      "consum_mediu_declarat",
      "valoare_achizitie",
      "prag_salt_km",
      "observatii",
    ]) {
      expect(audit?.p_after).not.toHaveProperty(camp);
    }
  });

  it("zero rânduri: NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("vehicles", "update", { data: null });
    const r = await actualizeazaVehicul({ id: ID_1, ...vehicul(), status: "activ" });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it.each([["vandut"], ["casat"]])(
    "ieșirea din parc (`%s`) fără motiv e respinsă de schemă",
    async (status) => {
      const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
      const r = await actualizeazaVehicul({ id: ID_1, ...vehicul(), status });
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.fieldErrors).toHaveProperty("motiv_iesire");
      expect(server.apeluri).toHaveLength(0);
    },
  );

  it("P0001 cu mesaj despre vehicul ajunge pe câmpul vehiculului", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    const mesaj = "Vehiculul are o foaie de parcurs deschisă.";
    server.raspunde("vehicles", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await actualizeazaVehicul({ id: ID_1, ...vehicul(), status: "activ" });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", fieldErrors: { vehicle_id: [mesaj] } },
    });
  });
});

describe("stergeVehicul", () => {
  it("`vehicles:delete` singur nu ajunge: poarta e `vehicles:update`, ca a bazei", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:delete": "all" } });
    const r = await stergeVehicul({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("scope `team` pe `vehicles:update` (sub `all`): INTERZIS, fără interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "team" } });
    const r = await stergeVehicul({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: ștergere logică cu autor, doar pe un vehicul încă viu", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("vehicles", "update", { data: { id: ID_1 } });

    const r = await stergeVehicul({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("vehicles");
    expect(apel?.payload).toEqual({ deleted_at: ACUM, updated_by: USER_ID });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/flota"]);
  });

  it("zero rânduri (al doilea clic): CONFLICT, nu o a doua reușită", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("vehicles", "update", { data: null });
    const r = await stergeVehicul({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("adaugaDocument", () => {
  it("scope `team` pe `vehicles:create`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:create": "team" } });
    const r = await adaugaDocument({ vehicle_id: ID_1, document_type_id: ID_2 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: reînnoirea e un INSERT nou, fără `este_curent`, cu autorul", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:create": "all" } });
    server.raspunde("vehicle_documents", "insert", { data: { id: ID_3 } });

    const r = await adaugaDocument({
      vehicle_id: ID_1,
      document_type_id: ID_2,
      emitent: "Allianz",
      expira_la: "2027-09-01",
      cost: "1200",
    });

    expect(r).toEqual({ ok: true, data: { id: ID_3 } });
    const [apel, ...altele] = server.apeluriPe("vehicle_documents");
    expect(altele).toHaveLength(0);
    expect(apel?.operatie).toBe("insert");
    // Fără RETURNING, `data` e null după ce documentul s-a scris deja.
    expect(apel?.selectDupaScriere).toBe("id");
    expect(apel?.payload).toMatchObject({
      organization_id: ORG_ID,
      vehicle_id: ID_1,
      document_type_id: ID_2,
      expira_la: "2027-09-01",
      cost: 1200,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    expect(apel?.payload).not.toHaveProperty("este_curent");
    expect(caiRevalidate()).toEqual(["/flota", `/flota/${ID_1}`]);
  });

  it("auditul adăugării nu poartă costul și nici observațiile", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:create": "all" } });
    server.raspunde("vehicle_documents", "insert", { data: { id: ID_3 } });
    await adaugaDocument({
      vehicle_id: ID_1,
      document_type_id: ID_2,
      emitent: "Allianz",
      cost: "1200",
      observatii: "plătită cu cardul firmei",
    });
    await asteaptaDupa();
    const [audit] = server.audituri();
    expect(audit).toMatchObject({ p_status: "success", p_entity_id: ID_3 });
    expect(audit?.p_after).toMatchObject({ vehicle_id: ID_1, emitent: "Allianz" });
    expect(audit?.p_after).not.toHaveProperty("cost");
    expect(audit?.p_after).not.toHaveProperty("observatii");
  });

  it("o dată de expirare care nu e dată calendaristică e respinsă de schemă", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:create": "all" } });
    const r = await adaugaDocument({
      vehicle_id: ID_1,
      document_type_id: ID_2,
      expira_la: "2027-02-30",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.fieldErrors).toHaveProperty("expira_la");
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("actualizeazaDocument", () => {
  it("doar `vehicles:create`, fără `vehicles:update`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:create": "all" } });
    const r = await actualizeazaDocument({ id: ID_3, vehicle_id: ID_1, document_type_id: ID_2 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("scope `team` pe `vehicles:update` (sub `all`): INTERZIS, fără interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "team" } });
    const r = await actualizeazaDocument({ id: ID_3, vehicle_id: ID_1, document_type_id: ID_2 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: corectează rândul existent, fără să-l mute pe alt vehicul", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("vehicle_documents", "update", { data: { id: ID_3 } });

    const r = await actualizeazaDocument({
      id: ID_3,
      vehicle_id: ID_1,
      document_type_id: ID_2,
      emitent: "Groupama",
    });

    expect(r).toEqual({ ok: true, data: { id: ID_3 } });
    const [apel] = server.apeluriPe("vehicle_documents");
    expect(apel?.payload).toMatchObject({
      document_type_id: ID_2,
      emitent: "Groupama",
      updated_by: USER_ID,
    });
    expect(apel?.payload).not.toHaveProperty("vehicle_id");
    expect(apel?.payload).not.toHaveProperty("id");
    expect(apel?.payload).not.toHaveProperty("este_curent");
    expect(areFiltru(apel, "eq", "id", ID_3)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/flota", `/flota/${ID_1}`]);
  });

  it("zero rânduri: NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("vehicle_documents", "update", { data: null });
    const r = await actualizeazaDocument({ id: ID_3, vehicle_id: ID_1, document_type_id: ID_2 });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
  });
});

describe("stergeDocument", () => {
  it("scope `team` pe `vehicles:update`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "team" } });
    const r = await stergeDocument({ id: ID_3, vehicle_id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: ștergere logică cu autor, revalidând fișa vehiculului", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("vehicle_documents", "update", { data: { id: ID_3 } });

    const r = await stergeDocument({ id: ID_3, vehicle_id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_3 } });
    const [apel] = server.apeluriPe("vehicle_documents");
    expect(apel?.payload).toEqual({ deleted_at: ACUM, updated_by: USER_ID });
    expect(areFiltru(apel, "eq", "id", ID_3)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    // Filtrarea e pe id + organizație, nu pe vehiculul venit din formular.
    expect(areFiltru(apel, "eq", "vehicle_id")).toBe(false);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/flota", `/flota/${ID_1}`]);
  });

  it("zero rânduri: CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("vehicle_documents", "update", { data: null });
    const r = await stergeDocument({ id: ID_3, vehicle_id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("corecteazaKilometraj", () => {
  const corectura = { id: ID_1, km_curent: "87250", motiv: "Cifra de la creare era greșită." };

  it("scope `team` pe `vehicles:update`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "team" } });
    const r = await corecteazaKilometraj(corectura);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("fără motiv: VALIDARE pe `motiv`, fără interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    const r = await corecteazaKilometraj({ ...corectura, motiv: "" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.fieldErrors).toHaveProperty("motiv");
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: scrie DOAR kilometrajul și autorul; motivul merge în audit, nu în bază", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("vehicles", "update", { data: { id: ID_1 } });

    const r = await corecteazaKilometraj(corectura);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("vehicles");
    expect(apel?.payload).toEqual({ km_curent: 87250, updated_by: USER_ID });
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();

    await asteaptaDupa();
    const [audit] = server.audituri();
    expect(audit?.p_after).toMatchObject({
      id: ID_1,
      km_curent: 87250,
      motiv: "Cifra de la creare era greșită.",
    });
    expect(caiRevalidate()).toEqual(["/flota", `/flota/${ID_1}`]);
  });

  it("zero rânduri (vehicul șters sau din altă firmă): NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("vehicles", "update", { data: null });
    const r = await corecteazaKilometraj(corectura);
    expect(r.ok).toBe(false);
    expect(caiRevalidate()).toEqual([]);
  });
});
