// src/app/(app)/flota/rezervari/actions.test.ts
//
// Rezervările mașinilor de pool (0216, F12d), pe clientul FALS: filtrul de
// organizație, `.select()` după UPDATE, ramurile pe scope. NU prind o politică
// RLS greșită: aceea e pe `tests/rls/proba-flota-rezervari.sql`. Straturile
// comune ale lui `createAction` sunt în `salarizare/actions.test.ts`.

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
  ID_3,
  ORG_ID,
  USER_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";

import {
  anuleazaRezervarea,
  creeazaRezervare,
  decideRezervarea,
  scurteazaRezervarea,
} from "./actions";
import { MESAJ_SUPRAPUNERE } from "./erori";

const rezervare = (modificari: Record<string, unknown> = {}) => ({
  vehicle_id: ID_1,
  de_la: "2026-10-15",
  pana_la: "2026-10-16",
  scop: "Vizită la client",
  destinatie: "Cluj-Napoca",
  observatii: "",
  ...modificari,
});

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("creeazaRezervare", () => {
  it("fără `vehicle_reservations:create`: INTERZIS, fără interogare", async () => {
    const { server } = configureazaActiunea({
      rol: "hr",
      permisiuni: { "vehicles:read": "all" },
    });
    const r = await creeazaRezervare(rezervare());
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("`own`: fișa proprie din `employees`, autorul explicit, FĂRĂ status", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "vehicle_reservations:create": "own" },
    });
    server.raspunde("employees", "select", { data: { id: ID_2 } });
    server.raspunde("vehicle_reservations", "insert", {
      data: { id: ID_3, status: "confirmata" },
    });

    const r = await creeazaRezervare(rezervare());

    expect(r).toEqual({ ok: true, data: { id: ID_3, status: "confirmata" } });
    const [fisa] = server.apeluriPe("employees");
    expect(areFiltru(fisa, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(fisa, "eq", "user_id", USER_ID)).toBe(true);
    expect(areFiltru(fisa, "eq", "is_primary", true)).toBe(true);
    expect(areFiltru(fisa, "is", "deleted_at", null)).toBe(true);

    const [apel] = server.apeluriPe("vehicle_reservations");
    expect(apel?.operatie).toBe("insert");
    expect(apel?.selectDupaScriere).toBe("id, status");
    expect(apel?.payload).toEqual({
      organization_id: ORG_ID,
      vehicle_id: ID_1,
      employee_id: ID_2,
      de_la: "2026-10-15",
      pana_la: "2026-10-16",
      scop: "Vizită la client",
      destinatie: "Cluj-Napoca",
      observatii: null,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    expect(apel?.payload).not.toHaveProperty("status");
  });

  it("`own` cu `employee_id` străin: CONFLICT, fără niciun apel la bază", async () => {
    const { server } = configureazaActiunea({
      rol: "manager",
      permisiuni: { "vehicle_reservations:create": "own" },
    });
    const r = await creeazaRezervare(rezervare({ employee_id: ID_2 }));
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("`own` fără fișă principală: CONFLICT, fără INSERT", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "vehicle_reservations:create": "own" },
    });
    server.raspunde("employees", "select", { data: null });
    const r = await creeazaRezervare(rezervare());
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("vehicle_reservations")).toHaveLength(0);
  });

  it("`all` cu `employee_id` explicit: trece, fără căutarea fișei proprii", async () => {
    const { server } = configureazaActiunea({
      permisiuni: { "vehicle_reservations:create": "all" },
    });
    server.raspunde("vehicle_reservations", "insert", { data: { id: ID_3, status: "confirmata" } });

    const r = await creeazaRezervare(rezervare({ employee_id: ID_2 }));

    expect(r).toMatchObject({ ok: true, data: { id: ID_3 } });
    expect(server.apeluriPe("employees")).toHaveLength(0);
    expect(server.apeluriPe("vehicle_reservations")[0]?.payload).toMatchObject({
      employee_id: ID_2,
    });
  });

  it("23P01: VALIDARE pe ambele zile", async () => {
    const { server } = configureazaActiunea({
      permisiuni: { "vehicle_reservations:create": "all" },
    });
    server.raspunde("vehicle_reservations", "insert", {
      error: eroarePostgrest("23P01", 'violates exclusion constraint "vr_fara_suprapunere"'),
    });
    const r = await creeazaRezervare(rezervare({ employee_id: ID_2 }));
    expect(r).toMatchObject({
      ok: false,
      error: {
        code: "VALIDARE",
        fieldErrors: { de_la: [MESAJ_SUPRAPUNERE], pana_la: [MESAJ_SUPRAPUNERE] },
      },
    });
  });

  it("ultima zi înaintea primei: VALIDARE pe `pana_la`, fără bază", async () => {
    const { server } = configureazaActiunea({
      permisiuni: { "vehicle_reservations:create": "all" },
    });
    const r = await creeazaRezervare(rezervare({ pana_la: "2026-10-14" }));
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(Object.keys(r.error.fieldErrors ?? {})).toEqual(["pana_la"]);
    expect(server.apeluri).toHaveLength(0);
  });

  it("revalidează lista, portalul, panoul și fișa vehiculului", async () => {
    const { server } = configureazaActiunea({
      permisiuni: { "vehicle_reservations:create": "all" },
    });
    server.raspunde("vehicle_reservations", "insert", { data: { id: ID_3, status: "ceruta" } });
    await creeazaRezervare(rezervare({ employee_id: ID_2 }));
    expect(caiRevalidate()).toEqual([
      "/flota/rezervari",
      "/portal/masina-mea",
      "/portal/masina-mea/rezervari",
      "/panou",
      `/flota/${ID_1}`,
    ]);
  });
});

describe("decideRezervarea", () => {
  const decizie = (modificari: Record<string, unknown> = {}) => ({
    id: ID_2,
    vehicle_id: ID_1,
    decizie: "confirmata",
    ...modificari,
  });

  it("filtrează pe id, organizație și `ceruta`, cu `.select()` după UPDATE", async () => {
    const { server } = configureazaActiunea({
      rol: "manager",
      permisiuni: { "vehicle_reservations:approve": "team" },
    });
    server.raspunde("vehicle_reservations", "update", { data: { id: ID_2 } });

    const r = await decideRezervarea(decizie());

    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    const [apel] = server.apeluriPe("vehicle_reservations");
    expect(areFiltru(apel, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "status", "ceruta")).toBe(true);
    expect(apel?.selectDupaScriere).toBe("id");
    expect(apel?.terminal).toBe("maybeSingle");
    expect(apel?.payload).toEqual({
      status: "confirmata",
      motiv_respingere: null,
      updated_by: USER_ID,
    });
  });

  it("zero rânduri (decisă sau anulată între timp): CONFLICT", async () => {
    const { server } = configureazaActiunea({
      permisiuni: { "vehicle_reservations:approve": "all" },
    });
    server.raspunde("vehicle_reservations", "update", { data: null });
    const r = await decideRezervarea(decizie());
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("respingerea fără motiv: VALIDARE pe `motiv`, fără bază", async () => {
    const { server } = configureazaActiunea({
      permisiuni: { "vehicle_reservations:approve": "all" },
    });
    const r = await decideRezervarea(decizie({ decizie: "respinsa", motiv: "  " }));
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(Object.keys(r.error.fieldErrors ?? {})).toEqual(["motiv"]);
    expect(server.apeluri).toHaveLength(0);
  });

  it("respingerea trimite motivul", async () => {
    const { server } = configureazaActiunea({
      permisiuni: { "vehicle_reservations:approve": "all" },
    });
    server.raspunde("vehicle_reservations", "update", { data: { id: ID_2 } });
    await decideRezervarea(decizie({ decizie: "respinsa", motiv: "Mașina e la service." }));
    expect(server.apeluriPe("vehicle_reservations")[0]?.payload).toMatchObject({
      status: "respinsa",
      motiv_respingere: "Mașina e la service.",
    });
  });

  it("auto-aprobarea refuzată de trigger (P0001): mesajul bazei, CONFLICT", async () => {
    const { server } = configureazaActiunea({
      rol: "manager",
      permisiuni: { "vehicle_reservations:approve": "team" },
    });
    const mesaj =
      "Nu vă puteți aproba sau respinge propria rezervare. Decizia o ia managerul sau responsabilul de flotă.";
    server.raspunde("vehicle_reservations", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await decideRezervarea(decizie());
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });

  it("`own` nu ajunge la decizie: INTERZIS", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "vehicle_reservations:approve": "own" },
    });
    const r = await decideRezervarea(decizie());
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("anuleazaRezervarea și scurteazaRezervarea", () => {
  it("anularea: `.in(status)`, organizația, motivul și autorul", async () => {
    const { server } = configureazaActiunea({
      rol: "manager",
      permisiuni: { "vehicle_reservations:update": "own" },
    });
    server.raspunde("vehicle_reservations", "update", { data: { id: ID_2 } });

    const r = await anuleazaRezervarea({ id: ID_2, vehicle_id: ID_1, motiv: "Audit." });

    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    const [apel] = server.apeluriPe("vehicle_reservations");
    expect(areFiltru(apel, "in", "status", ["ceruta", "confirmata"])).toBe(true);
    expect(areFiltru(apel, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBe("id");
    expect(apel?.payload).toEqual({
      status: "anulata",
      motiv_anulare: "Audit.",
      updated_by: USER_ID,
    });
    expect(caiRevalidate()).toContain("/portal/masina-mea/rezervari");
  });

  it("anularea cu zero rânduri: CONFLICT", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "vehicle_reservations:update": "own" },
    });
    server.raspunde("vehicle_reservations", "update", { data: null });
    const r = await anuleazaRezervarea({ id: ID_2, vehicle_id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("motivul lipsă pe rezervarea altcuiva (P0001): VALIDARE pe `motiv`", async () => {
    const { server } = configureazaActiunea({
      permisiuni: { "vehicle_reservations:update": "all" },
    });
    const mesaj =
      "Scrieți motivul anulării: rezervarea nu este a dumneavoastră, iar angajatul îl primește în notificare.";
    server.raspunde("vehicle_reservations", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await anuleazaRezervarea({ id: ID_2, vehicle_id: ID_1 });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", fieldErrors: { motiv: [mesaj] } },
    });
  });

  it("scurtarea: `.in(status)`, doar `pana_la` și autorul", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "vehicle_reservations:update": "own" },
    });
    server.raspunde("vehicle_reservations", "update", { data: { id: ID_2 } });

    const r = await scurteazaRezervarea({ id: ID_2, vehicle_id: ID_1, pana_la: "2026-10-15" });

    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    const [apel] = server.apeluriPe("vehicle_reservations");
    expect(areFiltru(apel, "in", "status", ["ceruta", "confirmata"])).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.payload).toEqual({ pana_la: "2026-10-15", updated_by: USER_ID });
  });

  it("scurtarea cu zero rânduri: CONFLICT; sub o foaie (P0001): VALIDARE pe `pana_la`", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "vehicle_reservations:update": "own" },
    });
    server.raspunde("vehicle_reservations", "update", { data: null });
    expect(
      await scurteazaRezervarea({ id: ID_2, vehicle_id: ID_1, pana_la: "2026-10-15" }),
    ).toMatchObject({ ok: false, error: { code: "CONFLICT" } });

    const mesaj =
      "Rezervarea are foaie de parcurs pe 16.10.2026; nu se poate scurta înaintea acestei zile.";
    server.raspunde("vehicle_reservations", "update", { error: eroarePostgrest("P0001", mesaj) });
    expect(
      await scurteazaRezervarea({ id: ID_2, vehicle_id: ID_1, pana_la: "2026-10-15" }),
    ).toMatchObject({ ok: false, error: { code: "VALIDARE", fieldErrors: { pana_la: [mesaj] } } });
  });
});
